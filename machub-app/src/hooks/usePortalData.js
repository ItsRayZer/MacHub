/**
 * usePortalData — Core stale-while-revalidate data hook.
 *
 * Flow:
 * 1. Read from Firestore (instant, ~50ms)
 * 2. If data exists → render immediately
 * 3. If stale or missing → fetch from Cloudflare Worker in background
 * 4. Update Firestore + React state with fresh data
 * 5. Errors show inline, never block navigation
 */
import { useState, useEffect, useCallback, useRef } from 'react';
import { doc, getDoc, setDoc, updateDoc } from 'firebase/firestore';
import { db } from '../firebase';
import { WORKER_URL, SECTION_TTL } from '../config';
import { useStudentStore } from '../store/studentStore';

const SLOW_FETCH_TIMEOUT = 3000; // Show "Portal is slow" after 3s

/**
 * Check if a cached section is stale based on its TTL.
 */
function isStale(cachedAt, ttl) {
  if (!cachedAt || !ttl) return true;
  if (ttl === Infinity) return false;
  const cachedTime = cachedAt?.toMillis ? cachedAt.toMillis() : Number(cachedAt);
  return Date.now() - cachedTime > ttl;
}

/**
 * Fetch data from Cloudflare Worker for a given section.
 */
async function fetchFromWorker(section, admissionNumber) {
  const res = await fetch(`${WORKER_URL}/api/scrape/${section}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ admissionNumber }),
  });

  if (res.status === 401) {
    throw new Error('UNAUTHORIZED');
  }
  if (!res.ok) {
    throw new Error(`WORKER_ERROR:${res.status}`);
  }

  const json = await res.json();
  if (!json.success) {
    throw new Error(json.error || 'Worker returned failure');
  }

  return json.data;
}

/**
 * Save fresh data to Firestore under students/{admissionNumber}/{section}.
 */
function maskSensitiveFields(profileData) {
  if (!profileData) return null;
  return {
    name:          profileData.name || '',
    admissionNo:   profileData.admissionNo || '',
    course:        profileData.course || '',
    batch:         profileData.batch || '',
    division:      profileData.division || '',
    semester:      profileData.semester || '',
    department:    profileData.department || '',
    photoUrl:      profileData.photoUrl || '',
    phone:         profileData.phone
                   ? '****' + profileData.phone.slice(-4)
                   : '',
  };
}

/**
 * Save fresh data to Firestore under students/{admissionNumber}/{section}.
 */
async function saveToFirestore(admissionNumber, section, data) {
  const docRef = doc(db, 'students', admissionNumber);
  
  let dataToSave = data;
  if (section === 'profile') {
    dataToSave = maskSensitiveFields(data);
  }

  const update = {
    [`${section}.data`]: dataToSave,
    [`${section}.cachedAt`]: new Date(),
    lastSeen: new Date(),
  };

  try {
    await setDoc(docRef, {
      admissionNumber,
      ...update,
    }, { merge: true });
  } catch (err) {
    console.warn(`[Firestore] Failed to save ${section}:`, err);
  }
}

/**
 * Main hook — use in every page component.
 *
 * @param {string} section - The section name (e.g., 'assessment', 'attendance')
 * @returns {{ data, isLoading, isRefreshing, error, refresh, isSlowLoad }}
 */
export function usePortalData(section) {
  const { admissionNumber, firebaseUid, logout } = useStudentStore();
  const [data, setData] = useState(null);
  const [isLoading, setIsLoading] = useState(true);    // true only when NO cached data
  const [isRefreshing, setIsRefreshing] = useState(false); // true when silently refreshing
  const [error, setError] = useState(null);
  const [isSlowLoad, setIsSlowLoad] = useState(false);
  const slowTimer = useRef(null);
  const isMounted = useRef(true);

  useEffect(() => {
    isMounted.current = true;
    return () => { isMounted.current = false; };
  }, []);

  const fetchFresh = useCallback(async (hasExistingData) => {
    if (!admissionNumber) return;

    if (!hasExistingData) setIsLoading(true);
    else setIsRefreshing(true);
    setError(null);
    setIsSlowLoad(false);

    // Start slow-load timer
    slowTimer.current = setTimeout(() => {
      if (isMounted.current) setIsSlowLoad(true);
    }, SLOW_FETCH_TIMEOUT);

    try {
      const freshData = await fetchFromWorker(section, admissionNumber);
      if (isMounted.current) {
        setData(freshData);
        setIsLoading(false);
        setIsRefreshing(false);
        setIsSlowLoad(false);
      }
      // Save to Firestore (non-blocking)
      saveToFirestore(admissionNumber, section, freshData).catch(console.warn);
    } catch (err) {
      if (!isMounted.current) return;
      const msg = err.message || 'Unknown error';

      if (msg === 'UNAUTHORIZED') {
        logout();
        return;
      }

      setError(msg.includes('WORKER_ERROR:502') ? 'portal_unreachable' : 'fetch_failed');
      setIsLoading(false);
      setIsRefreshing(false);
      setIsSlowLoad(false);
    } finally {
      clearTimeout(slowTimer.current);
    }
  }, [section, admissionNumber, firebaseUid, logout]);

  // Load from Firestore, then check staleness
  useEffect(() => {
    if (!admissionNumber) return;

    let cancelled = false;

    async function load() {
      try {
        // Step 1: Read from Firestore
        const docRef = doc(db, 'students', admissionNumber);
        const snap = await getDoc(docRef);
        const docData = snap.exists() ? snap.data() : null;
        const sectionData = docData?.[section];

        if (cancelled) return;

        const hasCachedData = sectionData?.data != null;
        const ttl = SECTION_TTL[section];

        if (hasCachedData) {
          // Show cached data immediately
          setData(sectionData.data);
          setIsLoading(false);

          // Check if stale
          if (isStale(sectionData.cachedAt, ttl)) {
            fetchFresh(true); // Background refresh
          }
        } else {
          // No cache — fetch from worker
          fetchFresh(false);
        }
      } catch (err) {
        if (cancelled) return;
        console.warn(`[Firestore] Read failed for ${section}:`, err);
        fetchFresh(false);
      }
    }

    load();
    return () => { cancelled = true; };
  }, [section, admissionNumber]);

  /** Force refresh regardless of TTL */
  const refresh = useCallback(() => {
    fetchFresh(data !== null);
  }, [fetchFresh, data]);

  return { data, isLoading, isRefreshing, error, refresh, isSlowLoad };
}
