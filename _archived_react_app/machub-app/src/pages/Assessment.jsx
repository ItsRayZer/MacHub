import { usePortalData } from '../hooks/usePortalData';
import PageHeader from '../components/PageHeader';
import DataTable from '../components/DataTable';
import SkeletonLoader from '../components/SkeletonLoader';

export default function Assessment() {
  const { data, isLoading, refresh, error } = usePortalData('assessment');

  return (
    <div className="fade-in">
      <PageHeader
        title="Assessment Marks"
        subtitle="Subject-wise internal exams and assignment scores"
        onRefresh={refresh}
        isLoading={isLoading}
      />

      {error && (
        <div className="alert alert-warning">
          <span>⚠️</span>
          <span>Could not refresh live assessment details. Showing cached records.</span>
        </div>
      )}

      {isLoading ? (
        <div style={styles.loadingWrapper}>
          <SkeletonLoader lines={6} />
        </div>
      ) : (
        <div style={styles.container}>
          {data?.subjects && data.subjects.length > 0 ? (
            data.subjects.map((sub, idx) => (
              <div key={idx} className="card" style={styles.subjectCard}>
                <div style={styles.subjectHeader}>
                  <div style={styles.bullet}>📝</div>
                  <h3 style={styles.subjectName}>{sub.subject}</h3>
                </div>
                <DataTable
                  headers={sub.headers}
                  rows={sub.rows}
                  passField="Status"
                  failValues={['Fail', 'F', 'Absent']}
                />
              </div>
            ))
          ) : (
            <div className="card">
              <div className="empty-state">
                <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
                  <path d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
                <h3>No Assessments Found</h3>
                <p>No internal assessment scores have been posted for this semester yet.</p>
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
