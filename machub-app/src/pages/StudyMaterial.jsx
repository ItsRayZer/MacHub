import { useState } from 'react';
import { usePortalData } from '../hooks/usePortalData';
import { useStudentStore } from '../store/studentStore';
import { WORKER_URL } from '../config';
import PageHeader from '../components/PageHeader';
import SkeletonLoader from '../components/SkeletonLoader';

export default function StudyMaterial() {
  const { admissionNumber } = useStudentStore();
  const { data, isLoading, refresh, error } = usePortalData('studyMaterial');
  
  const [activeSubject, setActiveSubject] = useState(null);
  const [materials, setMaterials] = useState([]);
  const [loadingDetail, setLoadingDetail] = useState(false);
  const [detailError, setDetailError] = useState('');
  const [modalOpen, setModalOpen] = useState(false);

  // Fetch subject study material details (files list)
  const viewSubjectNotes = async (subject) => {
    setActiveSubject(subject);
    setModalOpen(true);
    setLoadingDetail(true);
    setDetailError('');
    setMaterials([]);

    try {
      // Extract relative path from absolute viewUrl
      const urlObj = new URL(subject.viewUrl);
      const path = urlObj.pathname + urlObj.search;

      const res = await fetch(`${WORKER_URL}/api/scrape/studyMaterialDetail`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ admissionNumber, path }),
      });

      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const json = await res.json();
      if (!json.success) throw new Error(json.error || 'Failed to fetch');

      // Extract first table rows
      const tableData = json.data.tables?.[0]?.rows || [];
      setMaterials(tableData);
    } catch (err) {
      console.error(err);
      setDetailError('Failed to fetch files for this subject.');
    } finally {
      setLoadingDetail(false);
    }
  };

  return (
    <div className="fade-in">
      <PageHeader
        title="Study Materials"
        subtitle="Subject notes, slides, and reference files uploaded by teachers"
        onRefresh={refresh}
        isLoading={isLoading}
      />

      {error && (
        <div className="alert alert-warning">
          <span>⚠️</span>
          <span>Could not refresh live subjects. Showing cached list.</span>
        </div>
      )}

      {isLoading ? (
        <div style={styles.grid}>
          {[1, 2, 4].map(i => (
            <div key={i} className="card skeleton" style={{ height: 160 }} />
          ))}
        </div>
      ) : (
        <div style={styles.grid}>
          {data?.subjects && data.subjects.length > 0 ? (
            data.subjects.map((sub, idx) => (
              <div key={idx} className="card" style={styles.subjectCard}>
                <div style={styles.cardInfo}>
                  <div className="badge badge-accent" style={{ marginBottom: 10 }}>
                    {sub.category || 'Course Module'}
                  </div>
                  <h3 style={styles.subjectName}>{sub.name}</h3>
                  <p style={styles.subjectCode}>{sub.code || '—'}</p>
                </div>
                
                <button
                  className="btn btn-ghost"
                  style={styles.viewBtn}
                  onClick={() => viewSubjectNotes(sub)}
                >
                  📂 View Notes
                </button>
              </div>
            ))
          ) : (
            <div className="card" style={{ gridColumn: '1 / -1' }}>
              <div className="empty-state">
                <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
                  <path d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
                <h3>No Materials Found</h3>
                <p>No subjects are currently configured with study materials.</p>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Slideout Modal/Panel for Notes details */}
      {modalOpen && (
        <div style={styles.modalOverlay} onClick={() => setModalOpen(false)}>
          <div className="card fade-in" style={styles.modalContent} onClick={e => e.stopPropagation()}>
            <div style={styles.modalHeader}>
              <div>
                <h3 style={styles.modalTitle}>{activeSubject?.name}</h3>
                <p style={styles.modalSubtitle}>{activeSubject?.code}</p>
              </div>
              <button style={styles.closeBtn} onClick={() => setModalOpen(false)}>×</button>
            </div>

            <div style={styles.modalBody}>
              {loadingDetail ? (
                <SkeletonLoader lines={4} />
              ) : detailError ? (
                <div className="alert alert-error">{detailError}</div>
              ) : materials.length > 0 ? (
                <div style={styles.filesList}>
                  {materials.map((mat, i) => {
                    // Extract a download link. The parser stores link as _link_[ColumnName]
                    const linkKey = Object.keys(mat).find(k => k.startsWith('_link_'));
                    const downloadUrl = linkKey ? mat[linkKey] : null;
                    
                    // Display text keys (excluding links/raw)
                    const textKeys = Object.keys(mat).filter(k => !k.startsWith('_'));
                    const titleKey = textKeys.find(k => k.toLowerCase().includes('topic') || k.toLowerCase().includes('title') || k.toLowerCase().includes('name')) || textKeys[0];
                    const descKey = textKeys.find(k => k !== titleKey && !k.toLowerCase().includes('download') && !k.toLowerCase().includes('view'));

                    return (
                      <div key={i} style={styles.fileItem}>
                        <div style={styles.fileIcon}>📄</div>
                        <div style={styles.fileInfo}>
                          <h4 style={styles.fileName}>{mat[titleKey] || 'Attachment'}</h4>
                          {descKey && mat[descKey] && (
                            <p style={styles.fileDesc}>{mat[descKey]}</p>
                          )}
                        </div>
                        {downloadUrl && (
                          <a
                            href={downloadUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="btn btn-primary"
                            style={styles.downloadBtn}
                          >
                            ⬇️ Download
                          </a>
                        )}
                      </div>
                    );
                  })}
                </div>
              ) : (
                <div className="empty-state">
                  <h3>No Files Uploaded</h3>
                  <p>No study documents or PDF notes have been uploaded for this subject yet.</p>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

const styles = {
  grid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))',
    gap: '24px',
  },
  subjectCard: {
    padding: '24px',
    display: 'flex',
    flexDirection: 'column',
    justifyContent: 'space-between',
    minHeight: '180px',
  },
  cardInfo: {
    marginBottom: '20px',
  },
  subjectName: {
    fontSize: '15px',
    fontWeight: 700,
    color: 'var(--text-primary)',
    lineHeight: 1.4,
    marginBottom: '6px',
  },
  subjectCode: {
    fontSize: '11px',
    color: 'var(--text-muted)',
    fontFamily: 'monospace',
  },
  viewBtn: {
    width: '100%',
    justifyContent: 'center',
    padding: '8px 12px',
    fontSize: '13px',
  },
  modalOverlay: {
    position: 'fixed',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    background: 'rgba(0,0,0,0.6)',
    backdropFilter: 'blur(8px)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 200,
    padding: '20px',
  },
  modalContent: {
    width: '100%',
    maxWidth: '600px',
    background: 'rgba(15,15,22,0.95)',
    padding: '28px',
    boxShadow: '0 24px 48px rgba(0,0,0,0.6)',
    maxHeight: '90vh',
    overflowY: 'auto',
  },
  modalHeader: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: '24px',
  },
  modalTitle: {
    fontSize: '18px',
    fontWeight: 800,
    color: 'var(--text-primary)',
  },
  modalSubtitle: {
    fontSize: '11px',
    color: 'var(--text-muted)',
    fontFamily: 'monospace',
    marginTop: '4px',
  },
  closeBtn: {
    background: 'transparent',
    border: 'none',
    color: 'var(--text-secondary)',
    fontSize: '24px',
    cursor: 'pointer',
    padding: '0 4px',
    lineHeight: 1,
  },
  modalBody: {
    minHeight: '120px',
  },
  filesList: {
    display: 'flex',
    flexDirection: 'column',
    gap: '14px',
  },
  fileItem: {
    display: 'flex',
    alignItems: 'center',
    gap: '16px',
    padding: '16px',
    borderRadius: '12px',
    background: 'rgba(255, 255, 255, 0.02)',
    border: '1px solid rgba(255,255,255,0.04)',
  },
  fileIcon: {
    fontSize: '24px',
  },
  fileInfo: {
    flex: 1,
  },
  fileName: {
    fontSize: '14px',
    fontWeight: 600,
    color: 'var(--text-primary)',
  },
  fileDesc: {
    fontSize: '12px',
    color: 'var(--text-secondary)',
    marginTop: '2px',
  },
  downloadBtn: {
    padding: '6px 12px',
    fontSize: '12px',
  },
};
