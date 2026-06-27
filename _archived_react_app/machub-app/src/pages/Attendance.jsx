import { useState, useEffect, useMemo, useRef } from 'react';
import { usePortalData } from '../hooks/usePortalData';
import { useStudentStore } from '../store/studentStore';
import PageHeader from '../components/PageHeader';
import SkeletonLoader from '../components/SkeletonLoader';

/* ─── helpers ─────────────────────────────────────────────────────────── */
const getProgressColor = (pct) => {
  if (pct >= 80) return '#00d4aa'; // green (safe)
  if (pct >= 75) return '#ffb347'; // amber (warning)
  return '#ff4757';                // red (critical)
};

const getProgressBarBg = (pct) => {
  if (pct >= 80) return 'linear-gradient(90deg, #00d4aa, #34c759)';
  if (pct >= 75) return 'linear-gradient(90deg, #ffb347, #ffcc00)';
  return 'linear-gradient(90deg, #ff4757, #ff6961)';
};

function calcBadge(present, total, pct) {
  if (total <= 0) return null;
  if (pct >= 75) {
    const maxTotal = Math.floor(present / 0.75);
    const safeBunks = Math.max(0, maxTotal - total);
    if (safeBunks > 0) {
      return { type: 'safe', text: `⚡ Can skip ${safeBunks} lectures` };
    }
    return { type: 'ok', text: '✅ Attendance on Track' };
  } else {
    const needed = Math.ceil((0.75 * total - present) / 0.25);
    if (needed > 0) {
      return { type: 'warn', text: `🚨 Attend ${needed} more lectures` };
    }
    return null;
  }
}

export default function Attendance() {
  const [selectedSem, setSelectedSem] = useState('');
  const [openDropdown, setOpenDropdown] = useState(null); // 'semester' | null

  // Fetch data stale-while-revalidate for the selected semester
  const { data, isLoading, refresh, error } = usePortalData(
    'attendance',
    selectedSem ? { semester: selectedSem } : {}
  );

  // Close dropdown on click outside
  useEffect(() => {
    const handleOutsideClick = (e) => {
      if (!e.target.closest('.seat-dropdown')) {
        setOpenDropdown(null);
      }
    };
    document.addEventListener('click', handleOutsideClick);
    return () => document.removeEventListener('click', handleOutsideClick);
  }, []);

  // Parse records from payload
  const records = useMemo(() => {
    if (!data) return [];
    
    // Check subjectWise sections first
    const sections = data?.sections || [];
    if (sections.length > 0 && sections[0].rows) {
      return sections[0].rows.map(item => ({
        subjectName: item.subjectName || item.subject || '',
        subjectCode: item.subjectCode || '',
        presentHours: parseFloat(item.presentHours || item.present || '0'),
        totalHours: parseFloat(item.totalHours || item.total || '0'),
        percentage: parseFloat(item.percentage || item.pct || '0'),
      })).filter(item => item.subjectName);
    }
    
    // Fallback for older formats
    const rawRecs = data?.records || data?.data || [];
    return rawRecs.map(item => ({
      subjectName: item.subjectName || item.subject || '',
      subjectCode: item.subjectCode || '',
      presentHours: parseFloat(item.presentHours || item.present || '0'),
      totalHours: parseFloat(item.totalHours || item.total || '0'),
      percentage: parseFloat(item.percentage || item.pct || '0'),
    })).filter(item => item.subjectName);
  }, [data]);

  // Parse semesters
  const semesters = useMemo(() => {
    return data?.semesters || data?.semesterOptions || [];
  }, [data]);

  // Sync selectedSem when semesters are loaded
  useEffect(() => {
    if (semesters.length > 0 && !selectedSem) {
      const activeSem = semesters.find(s => s.selected || s.active);
      if (activeSem) setSelectedSem(activeSem.value);
      else setSelectedSem(semesters[0].value);
    }
  }, [semesters, selectedSem]);

  // Compute overall stats
  const stats = useMemo(() => {
    if (!records || records.length === 0) {
      return { present: 0, total: 0, overall: 0, safe: 0, warn: 0, low: 0 };
    }
    let totalPresent = 0;
    let totalConducted = 0;
    let safeCount = 0;
    let warnCount = 0;
    let lowCount = 0;

    records.forEach(r => {
      totalPresent += r.presentHours;
      totalConducted += r.totalHours;
      if (r.percentage >= 80) safeCount++;
      else if (r.percentage >= 75) warnCount++;
      else lowCount++;
    });

    const overall = totalConducted > 0 ? (totalPresent / totalConducted) * 100 : 0;
    return {
      present: totalPresent,
      total: totalConducted,
      overall,
      safe: safeCount,
      warn: warnCount,
      low: lowCount,
    };
  }, [records]);

  const overallColor = getProgressColor(stats.overall);
  const circum = 439.8; // 2 * pi * r (r=70)
  const strokeDashoffset = circum - (circum * Math.min(stats.overall, 100)) / 100;

  return (
    <div className="fade-in">
      <PageHeader
        title="Attendance Tracker"
        subtitle="Real-time track of your lecture presence and bunk planner"
        onRefresh={refresh}
        isLoading={isLoading}
      />

      {error && (
        <div className="alert alert-warning">
          <span>⚠️</span>
          <span>Could not refresh live attendance logs. Showing cached view.</span>
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
            {/* Circular Progress hero card */}
            <div className="card" style={{
              ...styles.heroCard,
              background: `linear-gradient(135deg, color-mix(in srgb, ${overallColor} 10%, transparent), color-mix(in srgb, ${overallColor} 3%, transparent))`,
              borderColor: `color-mix(in srgb, ${overallColor} 20%, transparent)`
            }}>
              <h3 style={styles.cardTitle}>Overall Attendance</h3>
              <div style={styles.gaugeRow}>
                {/* SVG circular ring */}
                <div style={styles.svgWrapper}>
                  <svg width="150" height="150" viewBox="0 0 160 160">
                    <circle cx="80" cy="80" r="70" fill="none" stroke="rgba(255,255,255,0.03)" strokeWidth="10" />
                    <circle
                      cx="80"
                      cy="80"
                      r="70"
                      fill="none"
                      stroke={overallColor}
                      strokeWidth="10"
                      strokeDasharray={circum}
                      strokeDashoffset={strokeDashoffset}
                      strokeLinecap="round"
                      transform="rotate(-90 80 80)"
                      style={{ transition: 'stroke-dashoffset 0.8s cubic-bezier(0.4, 0, 0.2, 1)' }}
                    />
                  </svg>
                  <div style={styles.gaugeTextContainer}>
                    <span style={{ ...styles.gaugePercent, color: overallColor }}>
                      {stats.overall.toFixed(1)}%
                    </span>
                    <span style={styles.gaugeSub}>Status</span>
                  </div>
                </div>

                {/* Stats summary column */}
                <div style={styles.summaryCol}>
                  <p style={styles.summaryLabel}>Total presence</p>
                  <h4 style={styles.summaryVal}>{stats.present.toFixed(0)} / {stats.total.toFixed(0)} Hrs</h4>
                  <div style={styles.badgeRow}>
                    <span className="badge badge-success">✓ {stats.safe} Safe</span>
                    {stats.warn > 0 && <span className="badge badge-warning">⚠ {stats.warn} Alert</span>}
                    {stats.low > 0 && <span className="badge badge-danger">✗ {stats.low} Shortage</span>}
                  </div>
                </div>
              </div>

              {/* 75% target progress bar */}
              <div style={styles.progressBarSection}>
                <div style={styles.progressBarHeader}>
                  <span style={styles.progressBarLabel}>Progress to 75% target</span>
                  <span style={{ ...styles.progressBarVal, color: overallColor }}>{stats.overall.toFixed(1)}%</span>
                </div>
                <div className="progress-bar">
                  <div
                    className="progress-fill"
                    style={{
                      width: `${Math.min(100, (stats.overall / 75) * 100)}%`,
                      background: getProgressBarBg(stats.overall)
                    }}
                  />
                </div>
                <div style={styles.progressBarFooter}>
                  <span>Target: 75%</span>
                </div>
              </div>
            </div>

            {/* Semester Selection Dropdown */}
            {semesters.length > 0 && (
              <div className="card" style={styles.selectorCard}>
                <div className={`seat-dropdown ${openDropdown === 'semester' ? 'is-open' : ''}`} style={styles.dropdownCol}>
                  <button
                    className="seat-dropdown__trigger"
                    onClick={(e) => {
                      e.stopPropagation();
                      setOpenDropdown(openDropdown === 'semester' ? null : 'semester');
                    }}
                  >
                    <div className="seat-dropdown__meta">
                      <span className="seat-dropdown__label">Active Semester</span>
                      <span className="seat-dropdown__value">
                        {semesters.find(s => s.value === selectedSem)?.text || `Semester ${selectedSem}`}
                      </span>
                    </div>
                    <div className="seat-dropdown__icon">▼</div>
                  </button>
                  <div className="seat-dropdown__menu">
                    {semesters.map((sem) => (
                      <button
                        key={sem.value}
                        className={`seat-dropdown__option ${selectedSem === sem.value ? 'is-active' : ''}`}
                        onClick={() => {
                          setSelectedSem(sem.value);
                          setOpenDropdown(null);
                        }}
                      >
                        <span className="seat-dropdown__option-title">{sem.text}</span>
                        {sem.active && <span className="seat-dropdown__option-meta">Active Semester</span>}
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* Right Column: Subject details list */}
          <div style={styles.listCol}>
            {records.length > 0 ? (
              <div style={styles.subjectList}>
                {records.map((rec, idx) => {
                  const pct = rec.percentage;
                  const badge = calcBadge(rec.presentHours, rec.totalHours, pct);
                  
                  return (
                    <div key={idx} className="card" style={styles.subjectCard}>
                      <div style={styles.subjectHeader}>
                        <div>
                          <h4 style={styles.subjectName}>{rec.subjectName}</h4>
                          <span style={styles.subjectCode}>{rec.subjectCode || 'General Lectures'}</span>
                        </div>
                        <div style={{ ...styles.subjectPct, color: getProgressColor(pct) }}>
                          {pct.toFixed(1)}%
                        </div>
                      </div>
                      
                      <div className="progress-bar" style={{ margin: '12px 0 16px' }}>
                        <div
                          className="progress-fill"
                          style={{
                            width: `${Math.min(pct, 100)}%`,
                            background: getProgressBarBg(pct)
                          }}
                        />
                      </div>

                      <div style={styles.subjectFooter}>
                        <span style={styles.attendedText}>
                          Attended: <strong>{rec.presentHours.toFixed(0)}</strong> / {rec.totalHours.toFixed(0)} Hrs
                        </span>
                        {badge && (
                          <span className={`badge ${badge.type === 'safe' || badge.type === 'ok' ? 'badge-success' : 'badge-danger'}`} style={styles.bunkBadge}>
                            {badge.text}
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
                  <h3>No Attendance Records Found</h3>
                  <p>There are no attendance records cached or published for Semester {selectedSem}.</p>
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
    gridTemplateColumns: '1.2fr 1.8fr',
    gap: '28px',
    alignItems: 'start',
  },
  statsCol: {
    display: 'flex',
    flexDirection: 'column',
    gap: '24px',
  },
  heroCard: {
    padding: '24px',
    borderRadius: '24px',
  },
  cardTitle: {
    fontSize: '15px',
    fontWeight: 700,
    color: 'var(--text-primary)',
    marginBottom: '20px',
  },
  gaugeRow: {
    display: 'flex',
    alignItems: 'center',
    gap: '20px',
  },
  svgWrapper: {
    position: 'relative',
    width: '150px',
    height: '150px',
    flexShrink: 0,
  },
  gaugeTextContainer: {
    position: 'absolute',
    inset: 0,
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
  },
  gaugePercent: {
    fontSize: '24px',
    fontWeight: 900,
    fontFamily: 'Syne, sans-serif',
    lineHeight: 1,
  },
  gaugeSub: {
    fontSize: '9px',
    fontWeight: 700,
    color: 'var(--text-secondary)',
    textTransform: 'uppercase',
    letterSpacing: '0.12em',
    marginTop: '2px',
  },
  summaryCol: {
    flex: 1,
    minWidth: 0,
  },
  summaryLabel: {
    fontSize: '9px',
    fontWeight: 800,
    color: 'var(--text-muted)',
    textTransform: 'uppercase',
    letterSpacing: '0.12em',
    marginBottom: '4px',
  },
  summaryVal: {
    fontSize: '20px',
    fontWeight: 800,
    color: 'var(--text-primary)',
    marginBottom: '12px',
  },
  badgeRow: {
    display: 'flex',
    flexDirection: 'column',
    gap: '6px',
    alignItems: 'flex-start',
  },
  progressBarSection: {
    marginTop: '24px',
    paddingTop: '20px',
    borderTop: '1px solid rgba(255, 255, 255, 0.06)',
  },
  progressBarHeader: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: '8px',
  },
  progressBarLabel: {
    fontSize: '10px',
    fontWeight: 700,
    color: 'var(--text-secondary)',
    textTransform: 'uppercase',
    letterSpacing: '0.08em',
  },
  progressBarVal: {
    fontSize: '12px',
    fontWeight: 800,
  },
  progressBarFooter: {
    display: 'flex',
    justifyContent: 'flex-end',
    marginTop: '6px',
    fontSize: '10px',
    color: 'var(--text-muted)',
  },
  selectorCard: {
    padding: '20px',
    borderRadius: '20px',
  },
  dropdownCol: {
    width: '100%',
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
    background: 'rgba(255, 255, 255, 0.01)',
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
  },
  attendedText: {
    color: 'var(--text-secondary)',
  },
  bunkBadge: {
    fontSize: '11px',
    padding: '4px 10px',
  },
  loadingWrapper: {
    padding: '40px',
    background: 'var(--glass-bg)',
    borderRadius: '16px',
    border: '1px solid var(--glass-border)',
  },
};
