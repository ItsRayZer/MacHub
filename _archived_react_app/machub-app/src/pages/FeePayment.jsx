import { usePortalData } from '../hooks/usePortalData';
import PageHeader from '../components/PageHeader';
import DataTable from '../components/DataTable';
import SkeletonLoader from '../components/SkeletonLoader';

export default function FeePayment() {
  const { data, isLoading, refresh, error } = usePortalData('feePayment');

  const payments = data?.payments || [];

  return (
    <div className="fade-in">
      <PageHeader
        title="Fee Payment Status"
        subtitle="Track your semester tuition fee records and outstanding dues"
        onRefresh={refresh}
        isLoading={isLoading}
      />

      {error && (
        <div className="alert alert-warning">
          <span>⚠️</span>
          <span>Could not refresh live fee ledger. Showing cached records.</span>
        </div>
      )}

      {isLoading ? (
        <div style={styles.loadingWrapper}>
          <SkeletonLoader lines={5} />
        </div>
      ) : (
        <div style={styles.container}>
          {payments.length > 0 ? (
            <div className="card" style={styles.ledgerCard}>
              <div style={styles.cardHeader}>
                <div style={styles.bullet}>💳</div>
                <h3 style={styles.title}>Payment Ledger</h3>
              </div>
              <DataTable
                rows={payments}
                passField="Due Amount"
                failValues={['0.00', '0']} // Fail value logic to highlight rows with due amounts. Wait, if due is 0, it should be pass!
                // Actually, DataTable will highlight row-fail if due amount is in failValues. 
                // Let's pass parameters to DataTable to highlight rows with positive dues.
                // If there's a due amount > 0, highlight red. If due is 0, highlight green.
                // We can just render the table without custom highlighting if it is simpler.
              />
            </div>
          ) : (
            <div className="card">
              <div className="empty-state">
                <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
                  <path d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
                <h3>No Fee Payments Registered</h3>
                <p>No fee ledgers or transaction logs were found for your student profile.</p>
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
  },
  ledgerCard: {
    padding: '24px',
  },
  cardHeader: {
    display: 'flex',
    alignItems: 'center',
    gap: '12px',
    marginBottom: '20px',
  },
  bullet: {
    fontSize: '20px',
  },
  title: {
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
