import { useState } from 'react';
import { usePortalData } from '../hooks/usePortalData';
import PageHeader from '../components/PageHeader';
import DataTable from '../components/DataTable';
import SkeletonLoader from '../components/SkeletonLoader';

export default function Seminar() {
  const { data, isLoading, refresh, error } = usePortalData('seminar');
  const [activeTab, setActiveTab] = useState('active');

  const active = data?.active || [];
  const expired = data?.expired || [];

  return (
    <div className="fade-in">
      <PageHeader
        title="Seminars"
        subtitle="Track department seminars and presentation schedules"
        onRefresh={refresh}
        isLoading={isLoading}
      />

      {error && (
        <div className="alert alert-warning">
          <span>⚠️</span>
          <span>Could not refresh live seminar records. Showing cached list.</span>
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
                  {active.map((sem, i) => (
                    <div key={i} className="card" style={styles.seminarCard}>
                      <div style={styles.cardHeader}>
                        <div style={styles.bulletActive}>🎙️</div>
                        <div style={{ flex: 1 }}>
                          <h3 style={styles.topic}>{sem.Topic || sem.topic || 'Seminar Presentation'}</h3>
                          <p style={styles.subject}>{sem.Subject || sem.subject || 'Academic Presentation'}</p>
                        </div>
                      </div>
                      <div style={styles.details}>
                        {Object.entries(sem)
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
                    <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
                      <path d="M19 11a7 7 0 01-7 7m0 0a7 7 0 01-7-7m7 7v4m0 0H8m4 0h4m-4-8a3 3 0 01-3-3V5a3 3 0 116 0v6a3 3 0 01-3 3z" strokeLinecap="round" strokeLinejoin="round" />
                    </svg>
                    <h3>No Active Seminars</h3>
                    <p>No upcoming seminar slots have been assigned to you.</p>
                  </div>
                </div>
              )
            ) : (
              expired.length > 0 ? (
                <div style={styles.list}>
                  {expired.map((sem, i) => (
                    <div key={i} className="card" style={{ ...styles.seminarCard, opacity: 0.65 }}>
                      <div style={styles.cardHeader}>
                        <div style={styles.bulletExpired}>⌛</div>
                        <div style={{ flex: 1 }}>
                          <h3 style={styles.topic}>{sem.Topic || sem.topic || 'Past Seminar Presentation'}</h3>
                          <p style={styles.subject}>{sem.Subject || sem.subject || 'Academic Presentation'}</p>
                        </div>
                      </div>
                      <div style={styles.details}>
                        {Object.entries(sem)
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
                    <h3>No Past Seminars</h3>
                    <p>No past seminar records found.</p>
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
  seminarCard: {
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
