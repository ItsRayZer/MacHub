import { useState } from 'react';
import { usePortalData } from '../hooks/usePortalData';
import PageHeader from '../components/PageHeader';
import DataTable from '../components/DataTable';
import SkeletonLoader from '../components/SkeletonLoader';

export default function Assignment() {
  const { data, isLoading, refresh, error } = usePortalData('assignment');
  const [activeTab, setActiveTab] = useState('active');

  const active = data?.active || [];
  const expired = data?.expired || [];

  return (
    <div className="fade-in">
      <PageHeader
        title="Assignments"
        subtitle="Manage and upload your coursework submissions"
        onRefresh={refresh}
        isLoading={isLoading}
      />

      {error && (
        <div className="alert alert-warning">
          <span>⚠️</span>
          <span>Could not refresh live assignments. Showing cached list.</span>
        </div>
      )}

      {isLoading ? (
        <div style={styles.loadingWrapper}>
          <SkeletonLoader lines={5} />
        </div>
      ) : (
        <>
          <div className="tabs">
            <button
              className={`tab ${activeTab === 'active' ? 'active' : ''}`}
              onClick={() => setActiveTab('active')}
            >
              Active ({active.length})
            </button>
            <button
              className={`tab ${activeTab === 'expired' ? 'active' : ''}`}
              onClick={() => setActiveTab('expired')}
            >
              Expired ({expired.length})
            </button>
          </div>

          <div style={styles.container}>
            {activeTab === 'active' ? (
              active.length > 0 ? (
                <div style={styles.list}>
                  {active.map((assign, i) => (
                    <div key={i} className="card" style={styles.assignmentCard}>
                      <div style={styles.cardHeader}>
                        <div style={styles.bulletActive}>⚡</div>
                        <div style={{ flex: 1 }}>
                          <h3 style={styles.topic}>{assign.Topic || assign.topic || 'Assignment Submission'}</h3>
                          <p style={styles.subject}>{assign.Subject || assign.subject || 'Coursework Module'}</p>
                        </div>
                      </div>
                      <div style={styles.details}>
                        {Object.entries(assign)
                          .filter(([k]) => !k.startsWith('_') && !['topic', 'topic', 'subject', 'subject'].includes(k.toLowerCase()))
                          .map(([key, val]) => (
                            <div key={key} style={styles.detailRow}>
                              <span style={styles.detailLabel}>{key}:</span>
                              <span style={styles.detailValue}>{val}</span>
                            </div>
                          ))}
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="card">
                  <div className="empty-state">
                    <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
                      <path d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" strokeLinecap="round" strokeLinejoin="round" />
                    </svg>
                    <h3>No Active Assignments</h3>
                    <p>You are completely caught up! No pending submissions found.</p>
                  </div>
                </div>
              )
            ) : (
              expired.length > 0 ? (
                <div style={styles.list}>
                  {expired.map((assign, i) => (
                    <div key={i} className="card" style={{ ...styles.assignmentCard, opacity: 0.65 }}>
                      <div style={styles.cardHeader}>
                        <div style={styles.bulletExpired}>⌛</div>
                        <div style={{ flex: 1 }}>
                          <h3 style={styles.topic}>{assign.Topic || assign.topic || 'Expired Assignment'}</h3>
                          <p style={styles.subject}>{assign.Subject || assign.subject || 'Coursework Module'}</p>
                        </div>
                      </div>
                      <div style={styles.details}>
                        {Object.entries(assign)
                          .filter(([k]) => !k.startsWith('_') && !['topic', 'subject'].includes(k.toLowerCase()))
                          .map(([key, val]) => (
                            <div key={key} style={styles.detailRow}>
                              <span style={styles.detailLabel}>{key}:</span>
                              <span style={styles.detailValue}>{val}</span>
                            </div>
                          ))}
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="card">
                  <div className="empty-state">
                    <h3>No Expired Assignments</h3>
                    <p>No past assignment records found in this section.</p>
                  </div>
                </div>
              )
            )}
          </div>
        </>
      )}
    </div>
  );
}

const styles = {
  container: {
    display: 'flex',
    flexDirection: 'column',
  },
  list: {
    display: 'flex',
    flexDirection: 'column',
    gap: '16px',
  },
  assignmentCard: {
    padding: '24px',
    background: 'rgba(255, 255, 255, 0.01)',
  },
  cardHeader: {
    display: 'flex',
    alignItems: 'center',
    gap: '16px',
    marginBottom: '16px',
  },
  bulletActive: {
    fontSize: '22px',
    color: 'var(--accent)',
  },
  bulletExpired: {
    fontSize: '22px',
    color: 'var(--text-muted)',
  },
  topic: {
    fontSize: '15px',
    fontWeight: 700,
    color: 'var(--text-primary)',
  },
  subject: {
    fontSize: '12px',
    color: 'var(--text-secondary)',
    marginTop: '2px',
  },
  details: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))',
    gap: '12px',
    padding: '16px',
    borderRadius: '10px',
    background: 'rgba(255,255,255,0.015)',
    border: '1px solid rgba(255,255,255,0.03)',
  },
  detailRow: {
    display: 'flex',
    flexDirection: 'column',
    gap: '4px',
  },
  detailLabel: {
    fontSize: '10px',
    fontWeight: 700,
    color: 'var(--text-muted)',
    textTransform: 'uppercase',
    letterSpacing: '0.5px',
  },
  detailValue: {
    fontSize: '13px',
    color: 'var(--text-secondary)',
  },
  loadingWrapper: {
    padding: '40px',
    background: 'var(--glass-bg)',
    borderRadius: '16px',
    border: '1px solid var(--glass-border)',
  },
};
