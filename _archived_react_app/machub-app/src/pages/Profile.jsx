import React, { useEffect, useMemo, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { doc, getDoc, setDoc } from 'firebase/firestore';
import { db } from '../firebase';
import { useStudentStore } from '../store/studentStore';
import { usePortalData } from '../hooks/usePortalData';
import { useSettingsStore } from '../store/settingsStore';

// ── New ZIP-design components ─────────────────────────────────────────────────
import ProfilePageUI from '../components/profile/ProfilePage';   // New ZIP profile UI
import SettingsHub   from '../components/settings/SettingsHub';  // New ZIP settings drawer
import ToastContainer from '../components/ToastContainer';       // Toast system

export default function Profile() {
  const [rankingsData, setRankingsData] = useState(null);
  const [securityConfig, setSecurityConfig] = useState(null);
  const [authLoading, setAuthLoading] = useState(true);
  
  const store = useStudentStore();
  const { admissionNumber } = store;
  const location = useLocation();
  const navigate = useNavigate();

  // Determine which admission number to view
  const admissionNumberToUse = useMemo(() => {
    const searchParams = new URLSearchParams(location.search);
    return searchParams.get('admissionNumber') || admissionNumber;
  }, [location.search, admissionNumber]);

  // Settings deep-link support
  const navigateTo  = useSettingsStore((s) => s.navigateTo);
  const openSettings = useSettingsStore((s) => s.openSettings);
  const openSectionTrigger = location.state?.openSection || '';

  // Portal data hooks
  const profileRes    = usePortalData('profile');
  const subjectsRes   = usePortalData('studyMaterial');
  const attendanceRes = usePortalData('attendance');
  const assessmentRes = usePortalData('assessment');

  // ── Gated mount check ───────────────────────────────────────────────────────
  useEffect(() => {
    if (!admissionNumberToUse) {
      setAuthLoading(false);
      return;
    }
    const checkSecurity = async () => {
      try {
        setAuthLoading(true);
        const snap = await getDoc(doc(db, 'students', admissionNumberToUse));
        if (snap.exists()) {
          const data = snap.data();
          const security = data.security || {};
          setSecurityConfig(security);

          if (security.isProfileClaimed === true && security.pinHash) {
            const localToken = localStorage.getItem('machub_device_token');
            const tokens = security.deviceTokens || [];
            if (!localToken || !tokens.includes(localToken)) {
              navigate(`/pin-lock?admissionNumber=${admissionNumberToUse}`);
              return;
            }
          }
        } else {
          // Unclaimed profiles are public by default
          setSecurityConfig({ isProfileClaimed: false });
        }
      } catch (err) {
        console.error("Profile security check failed:", err);
      } finally {
        setAuthLoading(false);
      }
    };
    checkSecurity();
  }, [admissionNumberToUse, navigate]);

  // ── Load rankings ────────────────────────────────────────────────────────────
  useEffect(() => {
    const fetch = async () => {
      try {
        const snap = await getDoc(doc(db, 'rankings', 'bca_2025'));
        if (snap.exists()) setRankingsData(snap.data());
      } catch (e) { console.warn('rankings fetch failed', e); }
    };
    fetch();
  }, []);

  // ── Load custom profile overrides ────────────────────────────────────────────
  useEffect(() => {
    if (!admissionNumber) return;
    const load = async () => {
      try {
        const snap = await getDoc(doc(db, 'students', admissionNumber, 'customProfile', 'overrides'));
        if (snap.exists()) store.setCustomProfile(snap.data());
      } catch (e) { console.warn('profile overrides failed', e); }
    };
    load();
  }, [admissionNumber]);

  // ── Sync portal data into Zustand ─────────────────────────────────────────────
  useEffect(() => { if (profileRes.data)    store.setProfileData(profileRes.data); },    [profileRes.data]);
  useEffect(() => {
    const list = subjectsRes.data?.subjects || subjectsRes.data?.payload?.subjects || [];
    if (list.length) store.setSubjectsData(list.map(s => ({
      name: s.subjectName || s.name || s.subject || '',
      code: s.subjectCode || s.code || '',
    })));
  }, [subjectsRes.data]);
  useEffect(() => {
    const data = attendanceRes.data?.payload?.data || attendanceRes.data?.subjectSummary || attendanceRes.data?.subjectWise || [];
    if (data.length) store.setAttendanceSubjectWiseData(data);
  }, [attendanceRes.data]);
  useEffect(() => { if (assessmentRes.data) store.setAssessmentData(assessmentRes.data); }, [assessmentRes.data]);

  // ── Deep-link into settings drawer ──────────────────────────────────────────
  useEffect(() => {
    if (!openSectionTrigger) return;
    openSettings();
    const validViews = ['allotment-memo','hall-ticket','fee-payment','grievance','concession','app-settings','notifications','about','synced-data'];
    if (validViews.includes(openSectionTrigger)) navigateTo(openSectionTrigger);
  }, [openSectionTrigger, navigateTo, openSettings]);

  // ── Firestore compat adapter (used by ProfilePageUI save handlers) ───────────
  const firestoreDbCompat = useMemo(() => ({
    collection: (col) => ({
      doc: (docId) => ({
        collection: (subCol) => ({
          doc: (subDocId) => ({
            set: async (data, opts) => setDoc(doc(db, col, docId, subCol, subDocId), data, opts),
          }),
        }),
        set: async (data, opts) => setDoc(doc(db, col, docId), data, opts),
      }),
    }),
    clearPersistence: async () => {
      try {
        const { clearIndexedDbPersistence } = await import('firebase/firestore');
        await clearIndexedDbPersistence(db);
      } catch (e) { console.warn('clearPersistence failed', e); }
    },
  }), []);

  // ── Build storeData prop ─────────────────────────────────────────────────────
  const storeData = useMemo(() => ({
    profile: {
      data: {
        ...store.profile?.data,
        name:             store.customProfile?.displayName    || store.profile?.data?.name    || '',
        photoUrl:         store.customProfile?.photoUrl       || store.profile?.data?.photoUrl || '',
        customBio:        store.customProfile?.customBio      || '',
        photoStoragePath: store.customProfile?.photoStoragePath || '',
        admissionNo:      store.profile?.data?.admissionNo   || admissionNumber,
        course:           store.profile?.data?.course         || '',
        batch:            store.profile?.data?.batch          || '',
        semester:         store.profile?.data?.semester       || '',
        division:         store.profile?.data?.division       || '',
      },
    },
    subjects:              store.subjects              || { data: [] },
    attendanceSubjectWise: store.attendanceSubjectWise || { data: [] },
    assessment:            store.assessment            || { data: {} },
  }), [store.profile, store.subjects, store.attendanceSubjectWise, store.assessment, store.customProfile, admissionNumber]);

  // ── Loading state ────────────────────────────────────────────────────────────
  if (authLoading || (profileRes.isLoading && !store.profile?.data)) {
    return (
      <div className="flex items-center justify-center min-h-[60vh] bg-black text-zinc-400">
        <div className="flex flex-col items-center gap-3">
          <div className="animate-spin rounded-full h-8 w-8 border-t-2 border-b-2 border-[#00F5D4]" />
          <span className="text-xs font-semibold">Loading student profile…</span>
        </div>
      </div>
    );
  }

  return (
    <div className="relative min-h-screen bg-black text-white overflow-hidden">

      {/* ── Unclaimed Profile Banner ── */}
      {securityConfig && securityConfig.isProfileClaimed === false && (
        <div style={{
          background: 'linear-gradient(135deg, rgba(0, 245, 212, 0.15), rgba(3, 4, 94, 0.3))',
          borderBottom: '1px solid rgba(0, 245, 212, 0.3)',
          padding: '12px 16px',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          gap: 12,
          zIndex: 50,
          position: 'relative'
        }}>
          <div>
            <h4 style={{ fontSize: '13px', fontWeight: 700, color: '#00F5D4' }}>Unclaimed Profile</h4>
            <p style={{ fontSize: '11px', color: '#8D99AE', marginTop: 2 }}>Secure this profile and set a PIN to protect your personal information.</p>
          </div>
          <button
            onClick={() => navigate(`/claim-profile?admissionNumber=${admissionNumberToUse}`)}
            className="btn btn-primary"
            style={{ fontSize: '11px', padding: '6px 12px', minHeight: 'auto', borderRadius: '8px' }}
          >
            Claim Profile
          </button>
        </div>
      )}

      {/* ── Synced but No PIN Set Banner ── */}
      {securityConfig && securityConfig.isProfileClaimed === true && !securityConfig.pinHash && (
        <div style={{
          background: 'linear-gradient(135deg, rgba(255, 183, 3, 0.15), rgba(3, 4, 94, 0.3))',
          borderBottom: '1px solid rgba(255, 183, 3, 0.3)',
          padding: '12px 16px',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          gap: 12,
          zIndex: 50,
          position: 'relative'
        }}>
          <div>
            <h4 style={{ fontSize: '13px', fontWeight: 700, color: '#FFB703' }}>PIN Passcode Not Set</h4>
            <p style={{ fontSize: '11px', color: '#8D99AE', marginTop: 2 }}>Anyone can view your personal details. Set a PIN to lock them.</p>
          </div>
          <button
            onClick={() => navigate(`/claim-profile?admissionNumber=${admissionNumberToUse}`)}
            className="btn btn-primary"
            style={{ fontSize: '11px', padding: '6px 12px', minHeight: 'auto', borderRadius: '8px', background: '#FFB703', borderColor: '#FFB703', color: '#000' }}
          >
            Set PIN
          </button>
        </div>
      )}

      {/* ── New ZIP-design Profile UI ── */}
      <div className="relative" style={{ zIndex: 10 }}>
        <ProfilePageUI
          storeData={storeData}
          firestoreDb={firestoreDbCompat}
          rankingsData={rankingsData}
          securityConfig={securityConfig}
        />
      </div>

      {/* ── New ZIP-design Settings drawer ── */}
      <SettingsHub />

      {/* ── Toast notifications ── */}
      <ToastContainer />
    </div>
  );
}
