import { usePortalData } from '../hooks/usePortalData';
import PageHeader from '../components/PageHeader';
import DataTable from '../components/DataTable';
import SkeletonLoader from '../components/SkeletonLoader';

export default function FeedBack() {
  const { data, isLoading, refresh, error } = usePortalData('feedback');

  const tables = data?.tables || [];

  return (
    <div className="fade-in">
      <PageHeader
        title="Faculty Feedback"
        subtitle="Submit your feedback evaluations for teachers and classes"
        onRefresh={refresh}
        isLoading={isLoading}
      />

      {error && (
        <div className="alert alert-warning">
          <span>⚠️</span>
          <span>Could not refresh evaluation forms. Showing cached view.</span>
        </div>
      )}

      {isLoading ? (
        <div style={styles.loadingWrapper}>
          <SkeletonLoader lines={4} />
        </div>
      ) : (
        <div style={styles.container}>
          {tables.length > 0 ? (
            tables.map((table, i) => (
              <div key={i} className="card" style={styles.tableCard}>
                <DataTable headers={table.headers} rows={table.rows} />
              </div>
            ))
          ) : (
            <div className="card">
              <div className="empty-state">
                <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
                  <path d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
                <h3>No Evaluation Forms Open</h3>
                <p>There are no active faculty feedback or class evaluation surveys open in your portal at this time.</p>
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
  tableCard: {
    padding: '24px',
  },
  loadingWrapper: {
    padding: '40px',
    background: 'var(--glass-bg)',
    borderRadius: '16px',
    border: '1px solid var(--glass-border)',
  },
};
