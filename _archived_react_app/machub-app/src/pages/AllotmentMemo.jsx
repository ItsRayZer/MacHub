import { usePortalData } from '../hooks/usePortalData';
import PageHeader from '../components/PageHeader';
import SkeletonLoader from '../components/SkeletonLoader';

export default function AllotmentMemo() {
  const { data, isLoading, refresh, error } = usePortalData('allotmentMemo');

  const pdfLink = data?.pdfLinks?.[0] || '';
  const hasMemo = data?.hasMemo || pdfLink;

  return (
    <div className="fade-in">
      <PageHeader
        title="Allotment Memo"
        subtitle="View and download your official admission allotment details"
        onRefresh={refresh}
        isLoading={isLoading}
      />

      {error && (
        <div className="alert alert-warning">
          <span>⚠️</span>
          <span>Could not refresh allotment details. Showing cached view.</span>
        </div>
      )}

      {isLoading ? (
        <div style={styles.loadingWrapper}>
          <SkeletonLoader lines={4} />
        </div>
      ) : (
        <div style={styles.container}>
          {hasMemo ? (
            <div className="card" style={styles.memoCard}>
              <div style={styles.memoIcon}>📄</div>
              <h3 style={styles.memoTitle}>Your Allotment Memo</h3>
              <p style={styles.memoDesc}>
                Your official Mar Augusthinose College admission allotment memo is available.
                Click below to download or view the document in PDF format.
              </p>
              
              <div style={styles.actions}>
                {pdfLink && (
                  <a
                    href={pdfLink}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="btn btn-primary"
                    style={styles.downloadBtn}
                  >
                    ⬇️ Download PDF
                  </a>
                )}
              </div>

              {data.iframes && data.iframes.length > 0 && (
                <div style={styles.previewContainer}>
                  <h4 style={styles.previewTitle}>Document Preview</h4>
                  <iframe
                    src={data.iframes[0]}
                    title="Allotment Memo Preview"
                    style={styles.iframe}
                  />
                </div>
              )}
            </div>
          ) : (
            <div className="card">
              <div className="empty-state">
                <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
                  <path d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
                <h3>No Allotment Memo Found</h3>
                <p>
                  No allotment memo is registered for your account. If you are an older batch student,
                  this document may have been archived.
                </p>
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
    maxWidth: '600px',
    margin: '0 auto',
  },
  memoCard: {
    padding: '36px 28px',
    textAlign: 'center',
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
  },
  memoIcon: {
    fontSize: '64px',
    marginBottom: '20px',
    filter: 'drop-shadow(0 8px 16px rgba(79, 142, 247, 0.3))',
  },
  memoTitle: {
    fontSize: '20px',
    fontWeight: 800,
    color: 'var(--text-primary)',
    marginBottom: '10px',
  },
  memoDesc: {
    fontSize: '14px',
    color: 'var(--text-secondary)',
    lineHeight: 1.6,
    marginBottom: '28px',
  },
  actions: {
    width: '100%',
    display: 'flex',
    justifyContent: 'center',
    marginBottom: '20px',
  },
  downloadBtn: {
    padding: '12px 24px',
    fontSize: '15px',
  },
  previewContainer: {
    width: '100%',
    marginTop: '24px',
    textAlign: 'left',
  },
  previewTitle: {
    fontSize: '14px',
    fontWeight: 700,
    color: 'var(--text-secondary)',
    marginBottom: '12px',
  },
  iframe: {
    width: '100%',
    height: '450px',
    border: '1px solid var(--glass-border)',
    borderRadius: '12px',
    background: '#ffffff',
  },
  loadingWrapper: {
    padding: '40px',
    background: 'var(--glass-bg)',
    borderRadius: '16px',
    border: '1px solid var(--glass-border)',
  },
};
