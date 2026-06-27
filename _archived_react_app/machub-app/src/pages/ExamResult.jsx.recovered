import { usePortalData } from '../hooks/usePortalData';
import PageHeader from '../components/PageHeader';
import DataTable from '../components/DataTable';
import SkeletonLoader from '../components/SkeletonLoader';

export default function ExamResult() {
  const { data, isLoading, refresh, error } = usePortalData('examResult');

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

      {isLoading ? (
        <div style={styles.loadingWrapper}>
          <SkeletonLoader lines={5} />
        </div>
      ) : (
        <div style={styles.container}>
          {data?.results && data.results.length > 0 ? (
            data.results.map((resTable, idx) => (
              <div key={idx} className="card" style={styles.resultCard}>
                <div style={styles.resultHeader}>
                  <div style={styles.bullet}>🎓</div>
                  <h3 style={styles.resultTitle}>Semester {data.results.length - idx} Results</h3>
                </div>
                <DataTable
                  headers={resTable.headers}
                  rows={resTable.rows}
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
                <p>No semester publication results are available in your portal account yet.</p>
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
