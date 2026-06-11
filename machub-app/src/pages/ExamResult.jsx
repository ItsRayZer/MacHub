import { useState, useEffect, useMemo } from 'react';
import { usePortalData } from '../hooks/usePortalData';
import { useStudentStore } from '../store/studentStore';
import PageHeader from '../components/PageHeader';
import DataTable from '../components/DataTable';
import SkeletonLoader from '../components/SkeletonLoader';

/* ─── helpers ──────────────────────────────────────────────────── */
function extractResults(data) {
  if (!data) return [];
  return data?.payload?.results || data?.results || data?.payload?.sections || data?.sections || [];
}
function getMaxSem(profile) {
  const s = profile?.data?.semester || profile?.semester || '2';
  const m = String(s).match(/\d+/);
  return m ? parseInt(m[0], 10) : 2;
}

const SEM_OPTS = (max) => [
  { value: 'all', label: '🎓 All Semesters' },
  ...Array.from({ length: max }, (_, i) => ({ value: String(i + 1), label: `Semester ${i + 1}` }))
];

export default function ExamResult() {
  const { data: profile } = usePortalData('profile');
  const { data, isLoading, refresh, error } = usePortalData('examResult');

  const [selectedSem, setSelectedSem] = useState('all');
  const [openDropdown, setOpenDropdown] = useState(null); // 'semester' | null

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

  const maxSem = useMemo(() => getMaxSem(profile), [profile]);
  const semOpts = useMemo(() => SEM_OPTS(maxSem), [maxSem]);

  const filteredResults = useMemo(() => {
    const allResults = extractResults(data);
    if (selectedSem === 'all') {
      return allResults.map((r, idx) => ({ table: r, semNum: allResults.length - idx }));
    }
    
    const semNum = parseInt(selectedSem, 10);
    const totalSems = allResults.length;
    const targetIdx = totalSems - semNum;
    
    if (targetIdx >= 0 && targetIdx < totalSems) {
      return [{ table: allResults[targetIdx], semNum }];
    }
    return [];
  }, [data, selectedSem]);

  return (
    <div className="fade-in">
      <PageHeader
        title="University Exam Results"
        subtitle="Your semester publication grades and GPA details"
        onRefresh={refresh}
        isLoading={isLoading}
      />

      {error && (
        <div className="alert alert-warning">
          <span>⚠️</span>
          <span>Could not refresh live exam results. Showing cached view.</span>
        </div>
      )}

      {/* Semester Dropdown */}
      <div style={styles.filtersRow}>
        <div className={`seat-dropdown ${openDropdown === 'semester' ? 'is-open' : ''}`} style={styles.dropdownCol}>
          <button
            className="seat-dropdown__trigger"
            onClick={(e) => {
              e.stopPropagation();
              setOpenDropdown(openDropdown === 'semester' ? null : 'semester');
            }}
          >
            <div className="seat-dropdown__meta">
              <span className="seat-dropdown__label">Semester Selection</span>
              <span className="seat-dropdown__value">
                {selectedSem === 'all' ? '🎓 All Semesters' : `Semester ${selectedSem}`}
              </span>
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
      </div>

      {isLoading ? (
        <div style={styles.loadingWrapper}>
          <SkeletonLoader lines={5} />
        </div>
      ) : (
        <div style={styles.container}>
          {filteredResults.length > 0 ? (
            filteredResults.map((item, idx) => (
              <div key={idx} className="card" style={styles.resultCard}>
                <div style={styles.resultHeader}>
                  <div style={styles.bullet}>🎓</div>
                  <h3 style={styles.resultTitle}>Semester {item.semNum} Results</h3>
                </div>
                <DataTable
                  headers={item.table.headers}
                  rows={item.table.rows}
                  passField="Result"
                  failValues={['Fail', 'F', 'Absent', 'Supply', 'Reappear']}
                />
              </div>
            ))
          ) : (
            <div className="card">
              <div className="empty-state">
                <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
                  <path d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
                <h3>No Exam Results Published</h3>
                <p>No semester publication results are available in your portal account for Semester {selectedSem}.</p>
              </div>
            </div>
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
    gridTemplateColumns: '1fr',
    marginBottom: '24px',
  },
  dropdownCol: {
    width: '100%',
  },
  resultCard: {
    padding: '24px',
    background: 'rgba(255, 255, 255, 0.01)',
  },
  resultHeader: {
    display: 'flex',
    alignItems: 'center',
    gap: '12px',
    marginBottom: '20px',
  },
  bullet: {
    fontSize: '20px',
  },
  resultTitle: {
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
