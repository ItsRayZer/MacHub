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
import { doc, getDoc, setDoc } from 'firebase/firestore';
import { db } from '../firebase';
import { WORKER_URL, SECTION_TTL } from '../config';
import { useStudentStore } from '../store/studentStore';

const SLOW_FETCH_TIMEOUT = 3000; // Show "Portal is slow" after 3s

/**
 * Firestore stores section keys in PascalCase (e.g. "Attendance", "ExamResult").
 * This map converts the hook's camelCase section name to the Firestore key.
 */
const FIRESTORE_KEY = {
  attendance:         'Attendance',
  attendanceDetails:  'AttendanceDetails',
  examResult:         'ExamResult',
  internalMark:       'InternalMark',
  assessment:         'Assessment',
  assignment:         'Assignment',
  seminar:            'Seminar',
  studyMaterial:      'StudyMaterial',
  dashboard:          'Dashboard',
  profile:            'Profile',
  onlineExam:         'OnlineExam',
  onlineClass:        'OnlineClass',
  fyugp:              'FYUGP',
  graceMark:          'GraceMark',
  hallTicket:         'HallTicket',
  allotmentMemo:      'AllotmentMemo',
  feePayment:         'FeePayment',
  feedback:           'FeedBack',
  grievance:          'Grievance',
  concession:         'Concession',
  internalUniversity: 'InternalUniversity',
};

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
async function fetchFromWorker(section, admissionNumber, params = {}) {
  const res = await fetch(`${WORKER_URL}/api/scrape/${section}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ admissionNumber, ...params }),
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
 * Mask sensitive fields in profile.
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
 * Save fresh data to Firestore.
 */
async function saveToFirestore(admissionNumber, section, data, params = {}) {
  const docRef = doc(db, 'students', admissionNumber);
  
  if (section === 'attendance') {
    const update = {
      'attendanceSubjectWise.data': data.subjectSummary || data.subjectWise || null,
      'attendanceSubjectWise.cachedAt': new Date(),
      'attendanceDetails.data': data.detailsLog || data.details || null,
      'attendanceDetails.cachedAt': new Date(),
      lastSeen: new Date(),
    };
    try {
      await setDoc(docRef, { admissionNumber, ...update }, { merge: true });
    } catch (err) {
      console.warn(`[Firestore] Failed to save attendance legacy keys:`, err);
    }

    const fKey = FIRESTORE_KEY[section] || section;
    const firestoreKey = params.semester ? `${fKey}_sem${params.semester}` : fKey;
    const standardUpdate = {
      [`${firestoreKey}.data`]: data,
      [`${firestoreKey}.cachedAt`]: new Date(),
      lastSeen: new Date(),
    };
    if (params.semester) {
      standardUpdate[`${fKey}.data`] = data;
      standardUpdate[`${fKey}.cachedAt`] = new Date();
    }
    try {
      await setDoc(docRef, { admissionNumber, ...standardUpdate }, { merge: true });
    } catch (err) {
      console.warn(`[Firestore] Failed to save standard attendance:`, err);
    }
    return;
  }

  const fKey = FIRESTORE_KEY[section] || section;
  const firestoreKey = params.semester ? `${fKey}_sem${params.semester}` : fKey;
  let dataToSave = section === 'profile' ? maskSensitiveFields(data) : data;

  const update = {
    [`${firestoreKey}.data`]: dataToSave,
    [`${firestoreKey}.cachedAt`]: new Date(),
    lastSeen: new Date(),
  };
  if (params.semester) {
    update[`${fKey}.data`] = dataToSave;
    update[`${fKey}.cachedAt`] = new Date();
  }

  try {
    await setDoc(docRef, {
      admissionNumber,
      ...update,
    }, { merge: true });
  } catch (err) {
    console.warn(`[Firestore] Failed to save ${section}:`, err);
  }
}

function unwrapData(raw) {
  if (!raw) return null;
  if (raw.payload !== undefined && raw.payload !== null) {
    return raw.payload;
  }
  return raw;
}

/**
 * Main hook — use in every page component.
 *
 * @param {string} section - The camelCase section name (e.g., 'assessment', 'attendance')
 * @param {object} params - Optional parameters (e.g., { semester: '2' })
 * @returns {{ data, isLoading, isRefreshing, error, refresh, isSlowLoad }}
 */
export function usePortalData(section, params = {}) {
  const { admissionNumber, firebaseUid, logout } = useStudentStore();
  const [data, setData] = useState(null);
  const [isLoading, setIsLoading] = useState(true);    // true only when NO cached data
  const [isRefreshing, setIsRefreshing] = useState(false); // true when silently refreshing
  const [error, setError] = useState(null);
  const [isSlowLoad, setIsSlowLoad] = useState(false);
  
  const slowTimer = useRef(null);
  const isMounted = useRef(true);
  const hasFetched = useRef(false);

  const paramsStr = JSON.stringify(params);

  useEffect(() => {
    hasFetched.current = false;
  }, [section, paramsStr]);

  useEffect(() => {
    isMounted.current = true;
    return () => { isMounted.current = false; };
  }, []);

  const fetchFresh = useCallback(async (hasExistingData) => {
    if (!admissionNumber) return;
    if (hasFetched.current) return;
    hasFetched.current = true;

    if (!hasExistingData) setIsLoading(true);
    else setIsRefreshing(true);
    setError(null);
    setIsSlowLoad(false);

    // Start slow-load timer
    slowTimer.current = setTimeout(() => {
      if (isMounted.current) setIsSlowLoad(true);
    }, SLOW_FETCH_TIMEOUT);

    try {
      const freshData = await fetchFromWorker(section, admissionNumber, params);
      if (isMounted.current) {
        setData(unwrapData(freshData));
        setIsLoading(false);
        setIsRefreshing(false);
        setIsSlowLoad(false);
      }
      // Save to Firestore (non-blocking)
      saveToFirestore(admissionNumber, section, freshData, params).catch(console.warn);
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
  }, [section, admissionNumber, firebaseUid, logout, paramsStr]);

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

        const fKey = FIRESTORE_KEY[section] || section;
        const firestoreKey = params.semester ? `${fKey}_sem${params.semester}` : fKey;
        let sectionData = docData?.[firestoreKey];
        let hasCachedData = sectionData?.data != null;

        // Fallback to generic key (e.g. 'Attendance', 'Assessment', 'InternalMark') if semester-specific key is missing
        if (!hasCachedData && params.semester && fKey !== firestoreKey) {
          const genericData = docData?.[fKey];
          if (genericData?.data != null) {
            const cachedData = genericData.data;
            const semesters = cachedData?.semesters || cachedData?.semesterOptions || [];
            const activeSem = semesters.find(s => s.selected || s.active)?.value;
            const studentSem = String(docData?.semester || docData?.Profile?.data?.semester || '').match(/\d+/)?.[0];
            
            // Check if this generic data matches the requested semester
            if (activeSem === String(params.semester) || (!activeSem && studentSem === String(params.semester))) {
              sectionData = genericData;
              hasCachedData = true;
              console.log(`[usePortalData] Cache fallback: using generic ${fKey} for ${firestoreKey}`);
            }
          }
        }

        if (cancelled) return;
        const ttl = SECTION_TTL[section];

        if (hasCachedData) {
          // Show cached data immediately
          setData(unwrapData(sectionData.data));
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
  }, [section, admissionNumber, paramsStr, fetchFresh]);

  /** Force refresh regardless of TTL */
  const refresh = useCallback(() => {
    hasFetched.current = false;
    fetchFresh(data !== null);
  }, [fetchFresh, data]);

  return { data, isLoading, isRefreshing, error, refresh, isSlowLoad };
}
