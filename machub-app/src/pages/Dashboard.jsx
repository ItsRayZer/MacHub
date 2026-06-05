import { useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { usePortalData } from '../hooks/usePortalData';
import { useStudentStore } from '../store/studentStore';
import { doc, setDoc } from 'firebase/firestore';
import { db } from '../firebase';
import { WORKER_URL } from '../config';
import PageHeader from '../components/PageHeader';

export default function Dashboard() {
  const { admissionNumber, isFirstLogin, setFirstLogin, setProfile } = useStudentStore();
  const { data, isLoading, refresh, error } = usePortalData('dashboard');
  const navigate = useNavigate();
  const queueStarted = useRef(false);

  // Background queue for scraping remaining sections on first login
  useEffect(() => {
    if (!admissionNumber) return;

    // Load profile once into the Zustand store if available
    if (data?.studentName) {
      setProfile({
        name: data.studentName,
        department: data.department,
        semester: data.semester,
        batch: data.batch,
      });
    }

    if (isFirstLogin && !queueStarted.current) {
      queueStarted.current = true;
      
      const sections = ['assessment', 'attendance', 'assignment', 'seminar', 'internalUniversity'];
      
      const runBackgroundQueue = async () => {
        console.log('[Background Queue] Starting background scraper...');
        for (const section of sections) {
          try {
            const res = await fetch(`${WORKER_URL}/api/scrape/${section}`, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ admissionNumber }),
            });
            if (!res.ok) throw new Error(`HTTP ${res.status}`);
            
            const json = await res.json();
            if (json.success) {
              const docRef = doc(db, 'students', admissionNumber);
              await setDoc(docRef, {
                [section]: {
                  data: json.data,
                  cachedAt: new Date(),
                }
              }, { merge: true });
              console.log(`[Background Queue] Synced ${section}`);
            }
          } catch (err) {
            console.warn(`[Background Queue] Scraping ${section} failed:`, err.message);
          }
          // 300ms gap between requests
          await new Promise(r => setTimeout(r, 300));
        }
        console.log('[Background Queue] Scraper complete');
        setFirstLogin(false);
      };

      runBackgroundQueue();
    }
  }, [isFirstLogin, admissionNumber, data]);

  const stats = [
    { label: 'Study Material', count: data?.studyMaterial ?? 0, icon: '📚', path: '/academic/study-material' },
    { label: 'Assessment', count: data?.assessment ?? 0, icon: '📝', path: '/academic/assessment' },
    { label: 'Assignment', count: data?.assignment ?? 0, icon: '📂', path: '/academic/assignment' },
    { label: 'Seminar', count: data?.seminar ?? 0, icon: '🎙️', path: '/academic/seminar' },
    { label: 'Internal Mark', count: data?.internalMark ?? 0, icon: '📊', path: '/academic/internal-mark' },
  ];

  return (
    <div className="fade-in">
      <PageHeader
        title="Dashboard"
        subtitle="Quick overview of your academic stats and shortcuts"
        onRefresh={refresh}
        isLoading={isLoading}
      />

      {error && (
        <div className="alert alert-warning">
          <span>⚠️</span>
          <span>Could not refresh live dashboard data. Showing cached view.</span>
        </div>
      )}

      {isLoading ? (
        <div style={styles.grid}>
          {[1, 2, 3, 4, 5].map(i => (
            <div key={i} className="card skeleton" style={{ height: 120 }} />
          ))}
        </div>
      ) : (
        <>
          {isFirstLogin && (
            <div className="alert alert-info" style={{ animation: 'pulse 2s infinite' }}>
              <span>🚀</span>
              <span>Syncing your student details in the background. Feel free to explore other pages!</span>
            </div>
          )}

          <div style={styles.grid}>
            {stats.map(stat => (
              <div
                key={stat.label}
                className="card"
                style={styles.statCard}
                onClick={() => navigate(stat.path)}
              >
                <div style={styles.cardHeader}>
                  <span style={styles.cardIcon}>{stat.icon}</span>
                  <span style={styles.cardLabel}>{stat.label}</span>
                </div>
                <div style={styles.cardValue}>{stat.count}</div>
              </div>
            ))}
          </div>

          <div style={{ marginTop: 32 }}>
            <h2 style={styles.sectionTitle}>Enrolled Courses / Activity</h2>
            <div className="card" style={styles.coursesCard}>
              {data?.activeCourses && data.activeCourses.length > 0 ? (
                <div style={styles.coursesList}>
                  {data.activeCourses.map((course, idx) => (
                    <div key={idx} style={styles.courseItem}>
                      <div style={styles.courseBullet}>⚡</div>
                      <div>
                        <div style={styles.courseName}>{course}</div>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="empty-state">
                  <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
                    <path d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" strokeLinecap="round" strokeLinejoin="round" />
                  </svg>
                  <h3>No Active Courses Listed</h3>
                  <p>Your current courses will be displayed here once fetched from the portal.</p>
                </div>
              )}
            </div>
          </div>
        </>
      )}
    </div>
  );
}

const styles = {
  grid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))',
    gap: '20px',
    marginBottom: '24px',
  },
  statCard: {
    padding: '24px',
    cursor: 'pointer',
    display: 'flex',
    flexDirection: 'column',
    justifyContent: 'space-between',
    minHeight: '120px',
  },
  cardHeader: {
    display: 'flex',
    alignItems: 'center',
    gap: '8px',
    color: 'var(--text-secondary)',
  },
  cardIcon: {
    fontSize: '20px',
  },
  cardLabel: {
    fontSize: '13px',
    fontWeight: 600,
  },
  cardValue: {
    fontSize: '32px',
    fontWeight: 800,
    color: 'var(--text-primary)',
    marginTop: '12px',
    fontFamily: 'Syne, sans-serif',
  },
  sectionTitle: {
    fontSize: '20px',
    fontWeight: 700,
    color: 'var(--text-primary)',
    marginBottom: '16px',
  },
  coursesCard: {
    padding: '24px',
    background: 'rgba(255, 255, 255, 0.02)',
  },
  coursesList: {
    display: 'flex',
    flexDirection: 'column',
    gap: '16px',
  },
  courseItem: {
    display: 'flex',
    alignItems: 'flex-start',
    gap: '12px',
    padding: '12px',
    borderRadius: '10px',
    background: 'rgba(255, 255, 255, 0.01)',
    border: '1px solid rgba(255, 255, 255, 0.03)',
  },
  courseBullet: {
    color: 'var(--accent)',
    fontWeight: 700,
  },
  courseName: {
    fontSize: '14px',
    fontWeight: 600,
    color: 'var(--text-primary)',
  },
};
