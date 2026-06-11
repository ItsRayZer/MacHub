import { useNavigate } from 'react-router-dom';
import { usePortalData } from '../hooks/usePortalData';
import { useStudentStore } from '../store/studentStore';
import PageHeader from '../components/PageHeader';

const SHORTCUTS = [
  {
    label: 'Attendance',
    desc: 'Track daily class hours, percentage, and bunk calculator',
    icon: '📅',
    path: '/attendance',
    color: '#00d4aa',
  },
  {
    label: 'Internal Marks',
    desc: 'View continuous evaluation grades and university internals',
    icon: '📊',
    path: '/academic/internal-mark',
    color: '#4f8ef7',
    countKey: 'internalMark',
  },
  {
    label: 'Exam Results',
    desc: 'Check university semester publication grades and GPA',
    icon: '🎓',
    path: '/academic/exam-result',
    color: '#ffb347',
  },
  {
    label: 'Study Material',
    desc: 'Download lecture notes, module PDFs, and materials',
    icon: '📚',
    path: '/academic/study-material',
    color: '#a55eea',
    countKey: 'studyMaterial',
  },
  {
    label: 'Assessment',
    desc: 'Continuous evaluation progress and CCA test grades',
    icon: '📋',
    path: '/academic/assessment',
    color: '#fd9644',
    countKey: 'assessment',
  },
  {
    label: 'Assignment',
    desc: 'Track pending submissions, details, and deadlines',
    icon: '📂',
    path: '/academic/assignment',
    color: '#2d98da',
    countKey: 'assignment',
  },
  {
    label: 'Seminar',
    desc: 'Track seminar presentations, schedules, and scores',
    icon: '🎙️',
    path: '/academic/seminar',
    color: '#fc5c65',
    countKey: 'seminar',
  },
  {
    label: 'Hall Ticket',
    desc: 'Download university examination hall ticket',
    icon: '🎫',
    path: '/hall-ticket',
    color: '#4b7bec',
  },
  {
    label: 'Fee Payment',
    desc: 'View fee payment history and pending balances',
    icon: '💳',
    path: '/fee-payment',
    color: '#26de81',
  },
  {
    label: 'Allotment Memo',
    desc: 'View college admission allotment memorandum details',
    icon: '📄',
    path: '/allotment-memo',
    color: '#eb3b5a',
  },
  {
    label: 'Online Class',
    desc: 'Join scheduled video lectures and virtual rooms',
    icon: '💻',
    path: '/academic/online-class',
    color: '#3867d6',
  },
  {
    label: 'Online Exam',
    desc: 'Attend online tests and portal examinations',
    icon: '✏️',
    path: '/academic/online-exam',
    color: '#fed330',
  },
  {
    label: 'FYUGP Selection',
    desc: 'Select academic courses under 4-Year UG Program',
    icon: '🌿',
    path: '/academic/fyugp',
    color: '#20bf6b',
  },
  {
    label: 'Grace Mark App',
    desc: 'Submit applications for sports/extracurricular grace marks',
    icon: '🏆',
    path: '/academic/grace-mark',
    color: '#fa8231',
  },
  {
    label: 'Feedback',
    desc: 'Submit feedback for faculty, courses, and facilities',
    icon: '💬',
    path: '/feedback',
    color: '#a5b1c2',
    countKey: 'feedback',
  },
  {
    label: 'Grievance Form',
    desc: 'Raise complaints or suggestions to the administration',
    icon: '📬',
    path: '/grievance',
    color: '#778ca3',
  },
  {
    label: 'Concession Card',
    desc: 'Request railway and KSRTC bus travel concessions',
    icon: '🪪',
    path: '/concession',
    color: '#45aaf2',
  },
];

export default function Dashboard() {
  const { admissionNumber } = useStudentStore();
  const { data: dashboardData, isLoading: isDashLoading, refresh: refreshDash, error: dashError } = usePortalData('dashboard');
  const { data: profileData } = usePortalData('profile');
  const navigate = useNavigate();

  const handleRefreshAll = () => {
    refreshDash();
  };

  return (
    <div className="fade-in">
      {/* Page Header (No skeleton wrapper blocks the page) */}
      <PageHeader
        title="Dashboard"
        subtitle="Mar Augusthinose College Student Portal Control Center"
        onRefresh={handleRefreshAll}
        isLoading={isDashLoading}
      />

      {dashError && (
        <div className="alert alert-warning">
          <span>⚠️</span>
          <span>Could not refresh live stats. Showing cached shortcuts.</span>
        </div>
      )}

      {/* Welcome Banner & Student Profile Card */}
      <div style={styles.headerSection}>
        {/* Welcome Text */}
        <div style={styles.welcomeTextContainer}>
          <h1 style={styles.welcomeTitle}>
            Welcome, <span className="gradient-text">{profileData?.name || 'Student'}</span>!
          </h1>
          <p style={styles.welcomeSubtitle}>
            Access your university grades, track attendance, and download study materials instantly.
          </p>
        </div>

        {/* Profile Card Snippet */}
        <div className="card" style={styles.profileCard}>
          <div style={styles.profileAvatarContainer}>
            {profileData?.photoUrl ? (
              <img
                src={profileData.photoUrl}
                alt="Student Profile"
                style={styles.profileAvatar}
                onError={(e) => {
                  e.target.onerror = null;
                  e.target.src = 'https://via.placeholder.com/150';
                }}
              />
            ) : (
              <div style={styles.avatarPlaceholder}>👤</div>
            )}
          </div>
          <div style={styles.profileInfo}>
            <div style={styles.profileName}>{profileData?.name || 'Loading Student...'}</div>
            <div style={styles.profileMeta}>Adm No: {profileData?.admissionNo || admissionNumber}</div>
            <div style={styles.profileMeta}>
              {profileData?.course || 'Loading details...'}
            </div>
            {profileData?.batch && (
              <div style={styles.profileMeta}>Batch: {profileData.batch}</div>
            )}
          </div>
        </div>
      </div>

      {/* Grid of Shortcuts (ALWAYS rendered and visible!) */}
      <div style={styles.shortcutsSection}>
        <h2 style={styles.sectionTitle}>Quick Access Shortcuts</h2>
        <div style={styles.grid}>
          {SHORTCUTS.map((shortcut) => {
            // Retrieve count if defined and loaded
            const count = shortcut.countKey ? dashboardData?.[shortcut.countKey] : null;
            const hasCount = shortcut.countKey !== undefined;

            return (
              <div
                key={shortcut.label}
                className="card"
                style={styles.shortcutCard}
                onClick={() => navigate(shortcut.path)}
              >
                {/* Icon with colored glow */}
                <div
                  style={{
                    ...styles.iconContainer,
                    background: `rgba(${hexToRgb(shortcut.color)}, 0.12)`,
                    border: `1px solid rgba(${hexToRgb(shortcut.color)}, 0.25)`,
                  }}
                >
                  <span style={{ fontSize: '24px' }}>{shortcut.icon}</span>
                </div>

                {/* Label and description */}
                <div style={styles.cardContent}>
                  <div style={styles.cardHeaderRow}>
                    <span style={styles.cardLabel}>{shortcut.label}</span>
                    {hasCount && (
                      <span
                        style={{
                          ...styles.countBadge,
                          background: isDashLoading ? 'rgba(255, 255, 255, 0.05)' : `rgba(${hexToRgb(shortcut.color)}, 0.18)`,
                          color: isDashLoading ? 'var(--text-secondary)' : shortcut.color,
                        }}
                      >
                        {isDashLoading ? '...' : (count ?? 0)}
                      </span>
                    )}
                  </div>
                  <p style={styles.cardDesc}>{shortcut.desc}</p>
                </div>

                {/* Arrow */}
                <div style={styles.arrowIcon}>→</div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Enrolled Courses / Activity */}
      <div style={{ marginTop: 32 }}>
        <h2 style={styles.sectionTitle}>Enrolled Courses & Activity</h2>
        <div className="card" style={styles.coursesCard}>
          {isDashLoading && !dashboardData?.activeCourses ? (
            <div className="skeleton" style={{ height: 120, borderRadius: '12px' }} />
          ) : dashboardData?.activeCourses && dashboardData.activeCourses.length > 0 ? (
            <div style={styles.coursesList}>
              {dashboardData.activeCourses.map((course, idx) => (
                <div key={idx} style={styles.courseItem}>
                  <div style={styles.courseBullet}>⚡</div>
                  <div style={styles.courseName}>{course}</div>
                </div>
              ))}
            </div>
          ) : (
            <div className="empty-state" style={{ padding: '30px 20px' }}>
              <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
                <path d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
              <h3>No Active Courses Listed</h3>
              <p>Your current courses will be displayed here once fetched from the portal.</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// Helper function to convert HEX color to RGB components for opacity rendering
function hexToRgb(hex) {
  // Expand shorthand form (e.g. "03F") to full form (e.g. "0033FF")
  const shorthandRegex = /^#?([a-f\d])([a-f\d])([a-f\d])$/i;
  const fullHex = hex.replace(shorthandRegex, (m, r, g, b) => r + r + g + g + b + b);
  const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(fullHex);
  return result
    ? `${parseInt(result[1], 16)}, ${parseInt(result[2], 16)}, ${parseInt(result[3], 16)}`
    : '255, 255, 255';
}

const styles = {
  headerSection: {
    display: 'flex',
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: '24px',
    alignItems: 'stretch',
    marginBottom: '32px',
  },
  welcomeTextContainer: {
    flex: '2 1 400px',
    display: 'flex',
    flexDirection: 'column',
    justifyContent: 'center',
    padding: '16px 8px',
  },
  welcomeTitle: {
    fontSize: '32px',
    fontWeight: 800,
    marginBottom: '12px',
  },
  welcomeSubtitle: {
    fontSize: '16px',
    color: 'var(--text-secondary)',
    lineHeight: 1.5,
  },
  profileCard: {
    flex: '1 1 300px',
    padding: '20px',
    display: 'flex',
    alignItems: 'center',
    gap: '16px',
    background: 'rgba(255, 255, 255, 0.02)',
  },
  profileAvatarContainer: {
    width: '72px',
    height: '72px',
    borderRadius: '50%',
    overflow: 'hidden',
    border: '2px solid var(--glass-border)',
    flexShrink: 0,
    background: 'rgba(255, 255, 255, 0.03)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
  },
  profileAvatar: {
    width: '100%',
    height: '100%',
    objectFit: 'cover',
  },
  avatarPlaceholder: {
    fontSize: '32px',
  },
  profileInfo: {
    display: 'flex',
    flexDirection: 'column',
    gap: '4px',
    minWidth: 0,
  },
  profileName: {
    fontSize: '16px',
    fontWeight: 700,
    color: 'var(--text-primary)',
    whiteSpace: 'nowrap',
    overflow: 'hidden',
    textOverflow: 'ellipsis',
  },
  profileMeta: {
    fontSize: '12px',
    color: 'var(--text-secondary)',
    whiteSpace: 'nowrap',
    overflow: 'hidden',
    textOverflow: 'ellipsis',
  },
  shortcutsSection: {
    marginTop: '16px',
  },
  sectionTitle: {
    fontSize: '20px',
    fontWeight: 700,
    color: 'var(--text-primary)',
    marginBottom: '16px',
  },
  grid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))',
    gap: '16px',
  },
  shortcutCard: {
    display: 'flex',
    alignItems: 'center',
    padding: '16px',
    cursor: 'pointer',
    position: 'relative',
    background: 'rgba(255, 255, 255, 0.02)',
    overflow: 'hidden',
  },
  iconContainer: {
    width: '48px',
    height: '48px',
    borderRadius: '12px',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
    marginRight: '16px',
  },
  cardContent: {
    flex: 1,
    minWidth: 0,
    marginRight: '24px',
  },
  cardHeaderRow: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: '8px',
    marginBottom: '4px',
  },
  cardLabel: {
    fontSize: '15px',
    fontWeight: 700,
    color: 'var(--text-primary)',
  },
  cardDesc: {
    fontSize: '12px',
    color: 'var(--text-secondary)',
    lineHeight: 1.4,
    whiteSpace: 'nowrap',
    overflow: 'hidden',
    textOverflow: 'ellipsis',
  },
  countBadge: {
    fontSize: '11px',
    fontWeight: 700,
    padding: '2px 8px',
    borderRadius: '10px',
    minWidth: '24px',
    textAlign: 'center',
  },
  arrowIcon: {
    fontSize: '18px',
    color: 'var(--text-muted)',
    transition: 'transform 0.2s ease',
  },
  coursesCard: {
    padding: '20px',
    background: 'rgba(255, 255, 255, 0.02)',
  },
  coursesList: {
    display: 'flex',
    flexDirection: 'column',
    gap: '12px',
  },
  courseItem: {
    display: 'flex',
    alignItems: 'center',
    gap: '12px',
    padding: '10px 14px',
    borderRadius: '8px',
    background: 'rgba(255, 255, 255, 0.01)',
    border: '1px solid var(--glass-border)',
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
