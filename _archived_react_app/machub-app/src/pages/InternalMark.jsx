import { useState, useEffect, useMemo } from 'react';
import { usePortalData } from '../hooks/usePortalData';
import { useStudentStore } from '../store/studentStore';
import PageHeader from '../components/PageHeader';
import DataTable from '../components/DataTable';
import SkeletonLoader from '../components/SkeletonLoader';

/* ─── helpers ──────────────────────────────────────────────────── */
function extractSubjects(data) {
  if (!data) return [];
  return data?.payload?.subjects || data?.subjects || [];
}
function extractSections(data) {
  if (!data) return [];
  return data?.payload?.sections || data?.sections || [];
}
function getMaxSem(profile) {
  const s = profile?.data?.semester || profile?.semester || '2';
  const m = String(s).match(/\d+/);
  return m ? parseInt(m[0], 10) : 2;
}

const SEM_OPTS = (max) => Array.from({ length: max }, (_, i) => ({ value: String(i + 1), label: `Semester ${i + 1}` }));
const MARK_OPTS = [
  { value: 'university', label: '🎓 University Marks' },
  { value: 'assessment', label: '📋 CCA / Assessment' },
];

export default function InternalMark() {
  const { data: profile } = usePortalData('profile');
  
  const defaultSemNum = useMemo(() => {
    const s = profile?.data?.semester || profile?.semester || '2';
    const m = String(s).match(/\d+/);
    return m ? m[0] : '2';
  }, [profile]);

  const [selectedSem, setSelectedSem] = useState('2');
  const [filterType, setFilterType] = useState('university'); // 'university' | 'assessment'
  const [openDropdown, setOpenDropdown] = useState(null); // 'semester' | 'markType' | null

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

  // Sync selectedSem when defaultSemNum is loaded/changed from student profile
  useEffect(() => {
    if (defaultSemNum) {
      setSelectedSem(defaultSemNum);
    }
  }, [defaultSemNum]);

  const { data: internalMarkData, isLoading: internalLoading, refresh: refreshInternals, error: internalError } = usePortalData(
    'internalMark',
    selectedSem ? { semester: selectedSem } : {}
  );
  
  const { data: assessmentData, isLoading: assessLoading, refresh: refreshAssess, error: assessError } = usePortalData(
    'assessment',
    selectedSem ? { semester: selectedSem } : {}
  );

  const maxSem = useMemo(() => getMaxSem(profile), [profile]);
  const semOpts = useMemo(() => SEM_OPTS(maxSem), [maxSem]);

  const isLoading = internalLoading || assessLoading;
  const error = internalError || assessError;

  const refresh = () => {
    refreshInternals();
    refreshAssess();
  };

  const univSubjects = useMemo(() => extractSubjects(internalMarkData), [internalMarkData]);
  const ccaSections = useMemo(() => extractSections(assessmentData), [assessmentData]);

  return (
    <div className="fade-in">
      <PageHeader
        title="College & University Internals"
        subtitle="Track your internal marks and continuous evaluation grades"
        onRefresh={refresh}
        isLoading={isLoading}
      />

      {error && (
        <div className="alert alert-warning">
          <span>⚠️</span>
          <span>Could not refresh live evaluation details. Showing cached view.</span>
        </div>
      )}

      {/* Side-by-side Dropdown Filters */}
      <div style={styles.filtersRow}>
        {/* Semester Dropdown */}
        <div className={`seat-dropdown ${openDropdown === 'semester' ? 'is-open' : ''}`} style={styles.dropdownCol}>
          <button
            className="seat-dropdown__trigger"
            onClick={(e) => {
              e.stopPropagation();
              setOpenDropdown(openDropdown === 'semester' ? null : 'semester');
            }}
          >
            <div className="seat-dropdown__meta">
              <span className="seat-dropdown__label">Semester</span>
              <span className="seat-dropdown__value">Semester {selectedSem}</span>
            </div>
            <div className="seat-dropdown__icon">▼</div>
          </button>
          <div className="seat-dropdown__menu">
            {semOpts.map((opt) => (
              <button
                key={opt.value}
                className={`seat-dropdown__option ${selectedSem === opt.value ? 'is-active' : ''}`}
                onClick={() => {
                  setSelectedSem(opt.value);
                  setOpenDropdown(null);
                }}
              >
                <span className="seat-dropdown__option-title">{opt.label}</span>
              </button>
            ))}
          </div>
        </div>

        {/* Mark Type Dropdown */}
        <div className={`seat-dropdown ${openDropdown === 'markType' ? 'is-open' : ''}`} style={styles.dropdownCol}>
          <button
            className="seat-dropdown__trigger"
            onClick={(e) => {
              e.stopPropagation();
              setOpenDropdown(openDropdown === 'markType' ? null : 'markType');
            }}
          >
            <div className="seat-dropdown__meta">
              <span className="seat-dropdown__label">Mark Type</span>
              <span className="seat-dropdown__value">
                {MARK_OPTS.find(o => o.value === filterType)?.label || 'Select Type'}
              </span>
            </div>
            <div className="seat-dropdown__icon">▼</div>
          </button>
          <div className="seat-dropdown__menu">
            {MARK_OPTS.map((opt) => (
              <button
                key={opt.value}
                className={`seat-dropdown__option ${filterType === opt.value ? 'is-active' : ''}`}
                onClick={() => {
                  setFilterType(opt.value);
                  setOpenDropdown(null);
                }}
              >
                <span className="seat-dropdown__option-title">{opt.label}</span>
              </button>
            ))}
          </div>
        </div>
      </div>

      {isLoading ? (
        <div style={styles.loadingWrapper}>
          <SkeletonLoader lines={6} />
        </div>
      ) : (
        <div style={styles.container}>
          {filterType === 'university' ? (
            univSubjects.length > 0 ? (
              univSubjects.map((sub, idx) => (
                <div key={idx} className="card" style={styles.subjectCard}>
                  <div style={styles.subjectHeader}>
                    <div style={styles.bullet}>🎓</div>
                    <h3 style={styles.subjectName}>{sub.subject}</h3>
                  </div>
                  <DataTable
                    headers={sub.headers}
                    rows={sub.rows}
                  />
                </div>
              ))
            ) : (
              <div className="card">
                <div className="empty-state">
                  <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
                    <path d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 002 2h2a2 2 0 002-2z" strokeLinecap="round" strokeLinejoin="round" />
                  </svg>
                  <h3>No University Internals Uploaded</h3>
                  <p>No final university internal marks have been uploaded or published yet for Semester {selectedSem}.</p>
                </div>
              </div>
            )
          ) : (
            ccaSections.length > 0 ? (
              ccaSections.map((sec, idx) => (
                <div key={idx} className="card" style={styles.subjectCard}>
                  <div style={styles.subjectHeader}>
                    <div style={styles.bullet}>📋</div>
                    <h3 style={styles.subjectName}>{sec.title}</h3>
                  </div>
                  <DataTable
                    headers={sec.headers}
                    rows={sec.rows}
                  />
                </div>
              ))
            ) : (
              <div className="card">
                <div className="empty-state">
                  <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
                    <path d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 002 2h2a2 2 0 002-2z" strokeLinecap="round" strokeLinejoin="round" />
                  </svg>
                  <h3>No Assessment Grades Uploaded</h3>
                  <p>No continuous internal assessment (CCA) grades or marks are available yet for Semester {selectedSem}.</p>
                </div>
              </div>
            )
          )}
        </div>
      )}
    </div>
  );
}

const styles = {
  container: {
    display: 'flex',
    flexDirection: 'column',
    gap: '24px',
  },
  filtersRow: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))',
    gap: '16px',
    marginBottom: '24px',
  },
  dropdownCol: {
    flex: 1,
    minWidth: 0,
  },
  subjectCard: {
    padding: '24px',
    background: 'rgba(255, 255, 255, 0.01)',
  },
  subjectHeader: {
    display: 'flex',
    alignItems: 'center',
    gap: '12px',
    marginBottom: '20px',
  },
  bullet: {
    fontSize: '20px',
  },
  subjectName: {
    fontSize: '15px',
    fontWeight: 700,
    color: 'var(--text-primary)',
  },
  loadingWrapper: {
    padding: '40px',
    background: 'var(--glass-bg)',
    borderRadius: '16px',
    border: '1px solid var(--glass-border)',
  },
};
