import { useState, useEffect } from 'react';
import { useStudentStore } from '../store/studentStore';
import { doc, getDoc } from 'firebase/firestore';
import { db } from '../firebase';
import { WORKER_URL } from '../config';
import PageHeader from '../components/PageHeader';
import SkeletonLoader from '../components/SkeletonLoader';

export default function Profile() {
  const { admissionNumber } = useStudentStore();
  const [cachedProfile, setCachedProfile] = useState(null);
  const [liveProfile, setLiveProfile] = useState(null);
  const [loadingLive, setLoadingLive] = useState(true);
  const [error, setError] = useState(null);

  // Load cached profile from Firestore on mount
  useEffect(() => {
    if (!admissionNumber) return;
    
    const loadCache = async () => {
      try {
        const docRef = doc(db, 'students', admissionNumber);
        const snap = await getDoc(docRef);
        const docData = snap.exists() ? snap.data() : null;
        if (docData) {
          const profileField = docData.Profile || docData.profile;
          if (profileField) {
            setCachedProfile(profileField.data);
          }
        }
      } catch (err) {
        console.warn('Failed to load profile cache:', err);
      }
    };
    loadCache();
  }, [admissionNumber]);

  // Fetch live unmasked profile from worker on mount
  const fetchLiveProfile = async () => {
    setLoadingLive(true);
    setError(null);
    try {
      const res = await fetch(`${WORKER_URL}/api/scrape/profile`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ admissionNumber }),
      });

      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const json = await res.json();
      if (!json.success) throw new Error(json.error || 'Failed to fetch');
      
      setLiveProfile(json.data);
    } catch (err) {
      console.error(err);
      setError('Failed to fetch live details from college portal.');
    } finally {
      setLoadingLive(false);
    }
  };

  useEffect(() => {
    if (admissionNumber) {
      fetchLiveProfile();
    }
  }, [admissionNumber]);

  // Use live data if available, fallback to cached data
  const profile = liveProfile || cachedProfile;

  return (
    <div className="fade-in">
      <PageHeader
        title="Student Profile"
        subtitle="Your official college enrollment records"
        onRefresh={fetchLiveProfile}
        isLoading={loadingLive}
      />

      {error && (
        <div className="alert alert-warning">
          <span>⚠️</span>
          <span>{error} showing cached basic details instead.</span>
        </div>
      )}

      <div style={styles.container}>
        {/* Left Card: Basic details & Avatar */}
        <div className="card" style={styles.leftCard}>
          <div style={styles.avatarContainer}>
            {profile?.photoUrl ? (
              <img src={profile.photoUrl} alt="Student Avatar" style={styles.avatar} />
            ) : (
              <div style={styles.avatarPlaceholder}>
                {profile?.name ? profile.name.charAt(0) : '🎓'}
              </div>
            )}
            <h2 style={styles.name}>{profile?.name || 'Loading Name...'}</h2>
            <p style={styles.course}>{profile?.course || 'Loading Course...'}</p>
            <div style={styles.badges}>
              {profile?.department && <span className="badge badge-accent">{profile.department}</span>}
              {profile?.semester && <span className="badge badge-muted">{profile.semester}</span>}
            </div>
          </div>
          
          <div style={styles.divider} />
          
          <div style={styles.basicInfoList}>
            <div style={styles.infoRow}>
              <span style={styles.infoLabel}>Admission No</span>
              <span style={styles.infoVal}>{admissionNumber}</span>
            </div>
            <div style={styles.infoRow}>
              <span style={styles.infoLabel}>Batch</span>
              <span style={styles.infoVal}>{profile?.batch || '—'}</span>
            </div>
          </div>
        </div>

        {/* Right Card: Full details (including sensitive ones) */}
        <div className="card" style={styles.rightCard}>
          <h3 style={styles.sectionTitle}>Personal & Academic Details</h3>
          
          <div style={styles.detailsGrid}>
            <div style={styles.detailItem}>
              <span style={styles.detailLabel}>Email Address</span>
              <span style={styles.detailVal}>
                {loadingLive ? <SkeletonLoader lines={1} width="80%" /> : (liveProfile?.email || '—')}
              </span>
            </div>

            <div style={styles.detailItem}>
              <span style={styles.detailLabel}>Mobile Number</span>
              <span style={styles.detailVal}>
                {loadingLive ? <SkeletonLoader lines={1} width="60%" /> : (liveProfile?.phone || '—')}
              </span>
            </div>

            <div style={styles.detailItem}>
              <span style={styles.detailLabel}>Date of Birth</span>
              <span style={styles.detailVal}>
                {loadingLive ? <SkeletonLoader lines={1} width="50%" /> : (liveProfile?.dob || '—')}
              </span>
            </div>

            <div style={styles.detailItem}>
              <span style={styles.detailLabel}>Gender</span>
              <span style={styles.detailVal}>
                {loadingLive ? <SkeletonLoader lines={1} width="40%" /> : (liveProfile?.gender || '—')}
              </span>
            </div>

            <div style={styles.detailItem}>
              <span style={styles.detailLabel}>Aadhaar Number</span>
              <span style={styles.detailVal}>
                {loadingLive ? <SkeletonLoader lines={1} width="70%" /> : (liveProfile?.aadhar || '—')}
              </span>
            </div>

            <div style={styles.detailItem}>
              <span style={styles.detailLabel}>ABC ID</span>
              <span style={styles.detailVal}>
                {loadingLive ? <SkeletonLoader lines={1} width="70%" /> : (liveProfile?.abcId || '—')}
              </span>
            </div>

            <div style={styles.detailItemFull}>
              <span style={styles.detailLabel}>Guardian Info</span>
              <span style={styles.detailVal}>
                {loadingLive ? (
                  <SkeletonLoader lines={1} width="90%" />
                ) : (
                  liveProfile?.guardianName
                    ? `${liveProfile.guardianName} ${liveProfile.guardianPhone ? `(${liveProfile.guardianPhone})` : ''}`
                    : '—'
                )}
              </span>
            </div>

            <div style={styles.detailItemFull}>
              <span style={styles.detailLabel}>Permanent Address</span>
              <span style={styles.detailVal}>
                {loadingLive ? (
                  <SkeletonLoader lines={2} />
                ) : (
                  liveProfile?.address || '—'
                )}
              </span>
            </div>

            <div style={styles.detailItemFull}>
              <span style={styles.detailLabel}>Communication Address</span>
              <span style={styles.detailVal}>
                {loadingLive ? (
                  <SkeletonLoader lines={2} />
                ) : (
                  liveProfile?.commAddress || '—'
                )}
              </span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

const styles = {
  container: {
    display: 'grid',
    gridTemplateColumns: '1fr 2fr',
    gap: '28px',
    alignItems: 'start',
    '@media (max-width: 900px)': {
      gridTemplateColumns: '1fr',
    },
  },
  leftCard: {
    padding: '32px 24px',
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    textAlign: 'center',
  },
  avatarContainer: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    width: '100%',
  },
  avatar: {
    width: '120px',
    height: '120px',
    borderRadius: '50%',
    objectFit: 'cover',
    border: '4px solid rgba(255, 255, 255, 0.05)',
    boxShadow: '0 8px 24px rgba(0,0,0,0.3)',
    marginBottom: '20px',
  },
  avatarPlaceholder: {
    width: '120px',
    height: '120px',
    borderRadius: '50%',
    background: 'linear-gradient(135deg, #4f8ef7, #00d4aa)',
    color: '#ffffff',
    fontSize: '48px',
    fontWeight: 700,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: '20px',
    boxShadow: '0 8px 24px rgba(79, 142, 247, 0.3)',
  },
  name: {
    fontSize: '20px',
    fontWeight: 800,
    color: 'var(--text-primary)',
    marginBottom: '4px',
  },
  course: {
    fontSize: '13px',
    color: 'var(--text-secondary)',
    marginBottom: '16px',
    lineHeight: 1.4,
  },
  badges: {
    display: 'flex',
    gap: '8px',
    justifyContent: 'center',
  },
  divider: {
    width: '100%',
    height: '1px',
    background: 'var(--glass-border)',
    margin: '24px 0',
  },
  basicInfoList: {
    width: '100%',
    display: 'flex',
    flexDirection: 'column',
    gap: '12px',
  },
  infoRow: {
    display: 'flex',
    justifyContent: 'space-between',
    fontSize: '13px',
  },
  infoLabel: {
    color: 'var(--text-secondary)',
    fontWeight: 500,
  },
  infoVal: {
    color: 'var(--text-primary)',
    fontWeight: 600,
  },
  rightCard: {
    padding: '32px',
  },
  sectionTitle: {
    fontSize: '18px',
    fontWeight: 700,
    color: 'var(--text-primary)',
    marginBottom: '24px',
  },
  detailsGrid: {
    display: 'grid',
    gridTemplateColumns: '1fr 1fr',
    gap: '24px',
  },
  detailItem: {
    display: 'flex',
    flexDirection: 'column',
    gap: '6px',
  },
  detailItemFull: {
    display: 'flex',
    flexDirection: 'column',
    gap: '6px',
    gridColumn: 'span 2',
  },
  detailLabel: {
    fontSize: '11px',
    fontWeight: 700,
    color: 'var(--text-muted)',
    textTransform: 'uppercase',
    letterSpacing: '0.8px',
  },
  detailVal: {
    fontSize: '14px',
    color: 'var(--text-secondary)',
    lineHeight: 1.5,
  },
};
