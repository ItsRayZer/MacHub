/**
 * TopBar — Fixed top header with student info, department badge, refresh.
 */
import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { doc, getDoc } from 'firebase/firestore';
import { db } from '../firebase';
import { useStudentStore } from '../store/studentStore';

export default function TopBar() {
  const { profile, admissionNumber } = useStudentStore();
  const navigate = useNavigate();

  const [securityConfig, setSecurityConfig] = useState(null);

  useEffect(() => {
    if (!admissionNumber) return;
    const fetchSecurity = async () => {
      try {
        const snap = await getDoc(doc(db, 'students', admissionNumber));
        if (snap.exists()) {
          const sec = snap.data().security || {};
          setSecurityConfig(sec);
        } else {
          setSecurityConfig({ isProfileClaimed: false });
        }
      } catch (err) {
        console.warn("TopBar security fetch failed:", err);
      }
    };
    fetchSecurity();
  }, [admissionNumber]);

  const getSecurityState = () => {
    if (!securityConfig) return 'loading';
    if (securityConfig.isProfileClaimed === false) return 'unclaimed';
    if (!securityConfig.pinHash) return 'unlocked';
    
    const localToken = localStorage.getItem('machub_device_token');
    const tokens = securityConfig.deviceTokens || [];
    if (localToken && tokens.includes(localToken)) {
      return 'unlocked';
    }
    return 'locked';
  };

  const secState = getSecurityState();
  const name = profile?.name || `Student ${admissionNumber}`;
  const dept = profile?.department || '';
  const sem = profile?.semester || '';
  const batch = profile?.batch || '';

  const handleIndicatorClick = () => {
    if (secState === 'unclaimed') {
      navigate(`/claim-profile?admissionNumber=${admissionNumber}`);
    } else if (secState === 'locked') {
      navigate(`/pin-lock?admissionNumber=${admissionNumber}`);
    } else if (secState === 'unlocked') {
      navigate(`/profile?admissionNumber=${admissionNumber}`);
    }
  };

  return (
    <header className="topbar-container">
      <div style={styles.left}>
        <div style={styles.greeting}>
          Welcome back, <span style={styles.name}>{name.split(' ')[0]}</span>
        </div>
        <div style={styles.badges}>
          {dept && <span className="badge badge-accent">{dept}</span>}
          {sem && <span className="badge badge-muted">{sem}</span>}
          {batch && <span className="badge badge-muted">Batch {batch}</span>}
        </div>
      </div>
      <div style={styles.right} className="flex items-center">
        <span style={styles.admNo}>ADM: {admissionNumber}</span>

        {secState !== 'loading' && (
          <button
            onClick={handleIndicatorClick}
            style={{
              background: 'transparent',
              border: 'none',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              padding: 0,
              marginLeft: '12px'
            }}
            aria-label="Security Status"
          >
            {secState === 'unclaimed' && (
              <span
                style={{
                  fontSize: '11px',
                  fontWeight: 'bold',
                  background: 'rgba(0, 245, 212, 0.15)',
                  color: '#00F5D4',
                  border: '1px solid rgba(0, 245, 212, 0.3)',
                  padding: '4px 10px',
                  borderRadius: '6px'
                }}
              >
                Claim
              </span>
            )}
            {secState === 'locked' && (
              <span
                style={{
                  fontSize: '15px',
                  background: 'rgba(239, 68, 68, 0.15)',
                  padding: '6px',
                  borderRadius: '50%',
                  border: '1px solid rgba(239, 68, 68, 0.3)',
                  display: 'inline-flex',
                  alignItems: 'center',
                  justifyContent: 'center'
                }}
              >
                🔒
              </span>
            )}
            {secState === 'unlocked' && (
              <img
                src={profile?.photoUrl || '/avatar.jpg'}
                alt="Avatar"
                style={{
                  width: '32px',
                  height: '32px',
                  borderRadius: '50%',
                  objectFit: 'cover',
                  border: '2px solid #00F5D4',
                  boxShadow: '0 0 8px rgba(0, 245, 212, 0.3)'
                }}
                onError={(e) => { e.target.src = '/avatar.jpg'; }}
              />
            )}
          </button>
        )}
      </div>
    </header>
  );
}

const styles = {
  topbar: {
    position: 'fixed',
    top: 0,
    left: 'var(--sidebar-w)',
    right: 0,
    height: 'var(--topbar-h)',
    background: 'rgba(10,10,15,0.8)',
    backdropFilter: 'blur(16px)',
    borderBottom: '1px solid var(--glass-border)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: '0 32px',
    zIndex: 90,
  },
  left: { display: 'flex', alignItems: 'center', gap: '16px' },
  greeting: { fontSize: '15px', color: 'var(--text-secondary)' },
  name: { color: 'var(--text-primary)', fontWeight: 700 },
  badges: { display: 'flex', gap: '6px', flexWrap: 'wrap' },
  right: { display: 'flex', alignItems: 'center', gap: '12px' },
  admNo: { fontSize: '12px', color: 'var(--text-muted)', fontFamily: 'monospace' },
};
