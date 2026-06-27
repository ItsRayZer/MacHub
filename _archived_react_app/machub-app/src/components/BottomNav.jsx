/**
 * BottomNav — Mobile-only fixed bottom navigation bar.
 */
import { NavLink } from 'react-router-dom';

const MOBILE_NAV = [
  { label: 'Home',       path: '/dashboard',  icon: '🏠' },
  { label: 'Attendance', path: '/attendance', icon: '📅' },
  { label: 'Academic',   path: '/academic/assessment', icon: '🎓' },
  { label: 'Profile',    path: '/profile',    icon: '👤' },
  { label: 'Fees',       path: '/fee-payment', icon: '💳' },
];

export default function BottomNav() {
  return (
    <nav className="bottom-nav-container">
      {MOBILE_NAV.map(item => (
        <NavLink
          key={item.path}
          to={item.path}
          style={({ isActive }) => ({
            ...styles.item,
            ...(isActive ? styles.itemActive : {}),
          })}
        >
          <span style={styles.icon}>{item.icon}</span>
          <span style={styles.label}>{item.label}</span>
        </NavLink>
      ))}
    </nav>
  );
}

const styles = {
  nav: {
    display: 'none',
    position: 'fixed',
    bottom: 0,
    left: 0,
    right: 0,
    height: '64px',
    background: 'rgba(10,10,15,0.95)',
    backdropFilter: 'blur(16px)',
    borderTop: '1px solid var(--glass-border)',
    zIndex: 100,
    '@media (max-width: 768px)': { display: 'flex' },
  },
  item: {
    flex: 1,
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    gap: '2px',
    textDecoration: 'none',
    color: 'var(--text-muted)',
    padding: '8px 4px',
    transition: 'color 0.15s ease',
  },
  itemActive: {
    color: 'var(--accent)',
  },
  icon: { fontSize: '20px' },
  label: { fontSize: '10px', fontWeight: 600, letterSpacing: '0.3px' },
};
