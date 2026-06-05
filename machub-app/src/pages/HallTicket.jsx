import { usePortalData } from '../hooks/usePortalData';
import PageHeader from '../components/PageHeader';
import SkeletonLoader from '../components/SkeletonLoader';

export default function HallTicket() {
  const { data, isLoading, refresh, error } = usePortalData('hallTicket');

  const pdfLink = data?.pdfLinks?.[0] || '';
  const hasTicket = data?.hasTicket || pdfLink;

  return (
    <div className="fade-in">
      <PageHeader
        title="Exam Hall Ticket"
        subtitle="Download and view your university hall ticket"
        onRefresh={refresh}
        isLoading={isLoading}
      />

      {error && (
        <div className="alert alert-warning">
          <span>⚠️</span>
          <span>Could not refresh hall ticket details. Showing cached view.</span>
        </div>
      )}

      {isLoading ? (
        <div style={styles.loadingWrapper}>
          <SkeletonLoader lines={4} />
        </div>
      ) : (
        <div style={styles.container}>
          {hasTicket ? (
            <div className="card" style={styles.ticketCard}>
              <div style={styles.ticketIcon}>🎫</div>
              <h3 style={styles.ticketTitle}>Your Hall Ticket is Ready</h3>
              <p style={styles.ticketDesc}>
                The university has published your official hall ticket for upcoming examinations.
                Click below to download or view the PDF document.
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
                    title="Hall Ticket Preview"
                    style={styles.iframe}
                  />
                </div>
              )}
            </div>
          ) : (
            <div className="card">
              <div className="empty-state">
                <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
                  <path d="M15 5v2m0 4v2m0 4v2M5 5h14a2 2 0 012 2v3a2 2 0 110 4v3a2 2 0 01-2 2H5a2 2 0 01-2-2v-3a2 2 0 110-4V7a2 2 0 012-2z" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
                <h3>No Hall Ticket Published</h3>
                <p>
                  No active hall ticket is currently published for your account. Hall tickets are
                  usually released a week before university examinations.
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
  ticketCard: {
    padding: '36px 28px',
    textAlign: 'center',
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
  },
  ticketIcon: {
    fontSize: '64px',
    marginBottom: '20px',
    filter: 'drop-shadow(0 8px 16px rgba(79, 142, 247, 0.3))',
  },
  ticketTitle: {
    fontSize: '20px',
    fontWeight: 800,
    color: 'var(--text-primary)',
    marginBottom: '10px',
  },
  ticketDesc: {
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
