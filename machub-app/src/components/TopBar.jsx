/**
 * TopBar — Fixed top header with student info, department badge, refresh.
 */
import { useStudentStore } from '../store/studentStore';

export default function TopBar() {
  const { profile, admissionNumber } = useStudentStore();
  const name = profile?.name || `Student ${admissionNumber}`;
  const dept = profile?.department || '';
  const sem = profile?.semester || '';
  const batch = profile?.batch || '';

  return (
    <header className="topbar-container">
      <div style={styles.left}>
        <div style={styles.greeting}>
          Welcome back, <span style={styles.name}>{name.split(' ')[0]}</span>
        </div>
        <div style={styles.badges}>
          {dept && <span className="badge badge-accent">{dept}</span>}
          {sem && <span className="badge badge-muted">{sem}</span>}
          {batch && <span className="badge badge-muted">Batch {batch}</span>}
        </div>
      </div>
      <div style={styles.right}>
        <span style={styles.admNo}>ADM: {admissionNumber}</span>
      </div>
    </header>
  );
}

const styles = {
  topbar: {
    position: 'fixed',
    top: 0,
    left: 'var(--sidebar-w)',
    right: 0,
    height: 'var(--topbar-h)',
    background: 'rgba(10,10,15,0.8)',
    backdropFilter: 'blur(16px)',
    borderBottom: '1px solid var(--glass-border)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: '0 32px',
    zIndex: 90,
  },
  left: { display: 'flex', alignItems: 'center', gap: '16px' },
  greeting: { fontSize: '15px', color: 'var(--text-secondary)' },
  name: { color: 'var(--text-primary)', fontWeight: 700 },
  badges: { display: 'flex', gap: '6px', flexWrap: 'wrap' },
  right: { display: 'flex', alignItems: 'center', gap: '12px' },
  admNo: { fontSize: '12px', color: 'var(--text-muted)', fontFamily: 'monospace' },
};
