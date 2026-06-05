import { useState, useEffect } from 'react';
import { usePortalData } from '../hooks/usePortalData';
import { useStudentStore } from '../store/studentStore';
import { WORKER_URL } from '../config';
import PageHeader from '../components/PageHeader';
import SkeletonLoader from '../components/SkeletonLoader';

export default function Attendance() {
  const { admissionNumber } = useStudentStore();
  const { data, isLoading, refresh, error } = usePortalData('attendance');
  
  const [selectedSem, setSelectedSem] = useState('');
  const [records, setRecords] = useState([]);
  const [semesters, setSemesters] = useState([]);
  const [localLoading, setLocalLoading] = useState(false);
  const [localError, setLocalError] = useState('');

  // Sync state with portal data when loaded
  useEffect(() => {
    if (data) {
      setRecords(data.records || []);
      setSemesters(data.semesters || []);
      
      const activeSem = data.semesters?.find(s => s.selected || s.active);
      if (activeSem) setSelectedSem(activeSem.value);
    }
  }, [data]);

  // Fetch specific semester attendance
  const handleSemesterChange = async (semId) => {
    setSelectedSem(semId);
    setLocalLoading(true);
    setLocalError('');
    try {
      const res = await fetch(`${WORKER_URL}/api/scrape/attendance`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ admissionNumber, semester: semId }),
      });

      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const json = await res.json();
      if (!json.success) throw new Error(json.error || 'Failed to fetch');

      setRecords(json.data.records || []);
    } catch (err) {
      console.error(err);
      setLocalError('Failed to fetch attendance for selected semester.');
    } finally {
      setLocalLoading(false);
    }
  };

  // Compute overall attendance percentage
  const calculateOverall = () => {
    if (!records || records.length === 0) return 0;
    let totalPresent = 0;
    let totalConducted = 0;
    
    records.forEach(r => {
      const p = parseInt(r.presentHours, 10);
      const t = parseInt(r.totalHours, 10);
      if (!isNaN(p) && !isNaN(t) && t > 0) {
        totalPresent += p;
        totalConducted += t;
      }
    });

    return totalConducted > 0 ? Math.round((totalPresent / totalConducted) * 1000) / 10 : 0;
  };

  const overall = calculateOverall();
  const getProgressColor = (pct) => {
    if (pct >= 75) return 'var(--success)';
    if (pct >= 60) return 'var(--warning)';
    return 'var(--danger)';
  };

  const getProgressClass = (pct) => {
    if (pct >= 75) return 'good';
    if (pct >= 60) return 'warning';
    return 'danger';
  };

  return (
    <div className="fade-in">
      <PageHeader
        title="Attendance Tracker"
        subtitle="Real-time track of your lecture presence"
        onRefresh={refresh}
        isLoading={isLoading || localLoading}
      />

      {(error || localError) && (
        <div className="alert alert-warning">
          <span>⚠️</span>
          <span>{error || localError}</span>
        </div>
      )}

      {isLoading ? (
        <div style={styles.loadingWrapper}>
          <SkeletonLoader lines={5} />
        </div>
      ) : (
        <div style={styles.layout}>
          {/* Left Column: Overall stats & Sem selector */}
          <div style={styles.statsCol}>
            <div className="card" style={styles.summaryCard}>
              <h3 style={styles.cardTitle}>Overall Attendance</h3>
              <div style={styles.gaugeContainer}>
                {/* SVG Circular Progress Ring */}
                <svg width="160" height="160" viewBox="0 0 160 160">
                  <circle cx="80" cy="80" r="70" fill="none" stroke="rgba(255,255,255,0.03)" strokeWidth="12" />
                  <circle
                    cx="80"
                    cy="80"
                    r="70"
                    fill="none"
                    stroke={getProgressColor(overall)}
                    strokeWidth="12"
                    strokeDasharray={440}
                    strokeDashoffset={440 - (440 * Math.min(overall, 100)) / 100}
                    strokeLinecap="round"
                    transform="rotate(-90 80 80)"
                    style={{ transition: 'stroke-dashoffset 0.6s ease' }}
                  />
                  <text x="80" y="86" textAnchor="middle" style={{ ...styles.gaugeText, fill: getProgressColor(overall) }}>
                    {overall}%
                  </text>
                </svg>
              </div>
              <p style={{ ...styles.gaugeSubText, color: overall >= 75 ? 'var(--success)' : overall >= 60 ? 'var(--warning)' : 'var(--danger)' }}>
                {overall >= 75 ? 'Attendance is on track' : overall >= 60 ? 'Close to falling below' : 'Below university requirements (75%)'}
              </p>
            </div>

            {semesters.length > 0 && (
              <div className="card" style={styles.selectorCard}>
                <h3 style={styles.cardTitle}>Select Semester</h3>
                <select
                  className="input"
                  style={styles.select}
                  value={selectedSem}
                  onChange={(e) => handleSemesterChange(e.target.value)}
                  disabled={localLoading}
                >
                  {semesters.map(sem => (
                    <option key={sem.value} value={sem.value}>
                      {sem.text}
                    </option>
                  ))}
                </select>
              </div>
            )}
          </div>

          {/* Right Column: Subject details list */}
          <div style={styles.listCol}>
            {records.length > 0 ? (
              <div style={styles.subjectList}>
                {records.map((rec, idx) => {
                  const pct = parseFloat(rec.percentage) || 0;
                  return (
                    <div key={idx} className="card" style={styles.subjectCard}>
                      <div style={styles.subjectHeader}>
                        <div>
                          <h4 style={styles.subjectName}>{rec.subjectName}</h4>
                          <span style={styles.subjectCode}>{rec.subjectCode || 'No Code'}</span>
                        </div>
                        <div style={{ ...styles.subjectPct, color: getProgressColor(pct) }}>
                          {rec.percentage}
                        </div>
                      </div>
                      
                      <div className="progress-bar" style={{ margin: '12px 0' }}>
                        <div
                          className={`progress-fill ${getProgressClass(pct)}`}
                          style={{ width: `${Math.min(pct, 100)}%` }}
                        />
                      </div>

                      <div style={styles.subjectFooter}>
                        <span>Classes Attended: <strong>{rec.presentHours}</strong> / {rec.totalHours}</span>
                        {pct < 75 && (
                          <span style={{ color: 'var(--danger)', fontSize: 11, fontWeight: 600 }}>
                            ⚠️ Shortage ({rec.percentage})
                          </span>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            ) : (
              <div className="card">
                <div className="empty-state">
                  <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
                    <path d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" strokeLinecap="round" strokeLinejoin="round" />
                  </svg>
                  <h3>No Attendance Records</h3>
                  <p>We couldn't find any attendance logs for this semester.</p>
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

const styles = {
  layout: {
    display: 'grid',
    gridTemplateColumns: '1.2fr 2fr',
    gap: '28px',
    alignItems: 'start',
    '@media (max-width: 900px)': {
      gridTemplateColumns: '1fr',
    },
  },
  statsCol: {
    display: 'flex',
    flexDirection: 'column',
    gap: '24px',
  },
  summaryCard: {
    padding: '28px',
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    textAlign: 'center',
  },
  cardTitle: {
    fontSize: '15px',
    fontWeight: 700,
    color: 'var(--text-secondary)',
    marginBottom: '20px',
    width: '100%',
    textAlign: 'left',
  },
  gaugeContainer: {
    margin: '10px 0 20px',
  },
  gaugeText: {
    fontSize: '28px',
    fontWeight: 800,
    fontFamily: 'Syne, sans-serif',
  },
  gaugeSubText: {
    fontSize: '12px',
    fontWeight: 600,
    marginTop: '4px',
  },
  selectorCard: {
    padding: '24px',
  },
  select: {
    cursor: 'pointer',
    background: 'rgba(255,255,255,0.02)',
  },
  listCol: {
    display: 'flex',
    flexDirection: 'column',
  },
  subjectList: {
    display: 'flex',
    flexDirection: 'column',
    gap: '16px',
  },
  subjectCard: {
    padding: '20px 24px',
  },
  subjectHeader: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    gap: '16px',
  },
  subjectName: {
    fontSize: '14px',
    fontWeight: 700,
    color: 'var(--text-primary)',
    lineHeight: 1.4,
  },
  subjectCode: {
    fontSize: '11px',
    color: 'var(--text-muted)',
    fontFamily: 'monospace',
  },
  subjectPct: {
    fontSize: '20px',
    fontWeight: 800,
    fontFamily: 'Syne, sans-serif',
  },
  subjectFooter: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    fontSize: '12px',
    color: 'var(--text-secondary)',
  },
  loadingWrapper: {
    padding: '40px',
    background: 'var(--glass-bg)',
    borderRadius: '16px',
    border: '1px solid var(--glass-border)',
  },
};
