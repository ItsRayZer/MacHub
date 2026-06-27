/**
 * Sidebar — Fixed left navigation panel with glass morphism design.
 * Collapses on mobile (replaced by BottomNav).
 * Includes collapsible Academic dropdown.
 */
import { useState } from 'react';
import { NavLink, useNavigate } from 'react-router-dom';
import { useStudentStore } from '../store/studentStore';

const NAV_ITEMS = [
  { label: 'Dashboard',        path: '/dashboard',              icon: '🏠' },
  { label: 'About / Profile',  path: '/profile',                icon: '👤' },
  { label: 'Allotment Memo',   path: '/allotment-memo',         icon: '📄' },
  { label: 'Hall Ticket',      path: '/hall-ticket',            icon: '🎫' },
  {
    label: 'Academic',
    icon: '🎓',
    children: [
      { label: 'Study Material',         path: '/academic/study-material' },
      { label: 'Assessment',             path: '/academic/assessment' },
      { label: 'Assignment',             path: '/academic/assignment' },
      { label: 'Seminar',                path: '/academic/seminar' },
      { label: 'Internal To University', path: '/academic/internal-mark' },
      { label: 'Online Class',           path: '/academic/online-class' },
      { label: 'Online Exam',            path: '/academic/online-exam' },
      { label: 'FYUGP Course Selection', path: '/academic/fyugp' },
      { label: 'Exam Result',            path: '/academic/exam-result' },
      { label: 'Grace Mark Application', path: '/academic/grace-mark' },
      { label: 'Find Student',            path: '/profile-search' },
    ],
  },
  { label: 'Fee Payment',      path: '/fee-payment',            icon: '💳' },
  { label: 'Feed Back',        path: '/feedback',               icon: '💬' },
  { label: 'Internal Mark',    path: '/academic/internal-mark', icon: '📊' },
  { label: 'Attendance',       path: '/attendance',             icon: '📅' },
  { label: 'Grievance Form',   path: '/grievance',              icon: '📬' },
  { label: 'Concession Card',  path: '/concession',             icon: '🪪' },
];

export default function Sidebar() {
  const [academicOpen, setAcademicOpen] = useState(false);
  const { profile, logout } = useStudentStore();
  const navigate = useNavigate();

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  return (
    <aside className="sidebar-container">
      {/* Logo */}
      <div style={styles.logo}>
        <div style={styles.logoIcon}>M</div>
        <div>
          <div style={styles.logoText}>MacHub</div>
          <div style={styles.logoSub}>Student Portal</div>
        </div>
      </div>

      <div style={styles.divider} />

      {/* Navigation */}
      <nav style={styles.nav}>
        {NAV_ITEMS.map((item) => {
          if (item.children) {
            return (
              <div key={item.label}>
                <button
                  style={{
                    ...styles.navItem,
                    ...(academicOpen ? styles.navItemActive : {}),
                  }}
                  onClick={() => setAcademicOpen(v => !v)}
                  aria-expanded={academicOpen}
                >
                  <span style={styles.navIcon}>{item.icon}</span>
                  <span style={styles.navLabel}>{item.label}</span>
                  <span style={{ ...styles.chevron, transform: academicOpen ? 'rotate(90deg)' : 'none' }}>
                    ›
                  </span>
                </button>

                {academicOpen && (
                  <div style={styles.submenu}>
                    {item.children.map(child => (
                      <NavLink
                        key={child.path}
                        to={child.path}
                        style={({ isActive }) => ({
                          ...styles.subItem,
                          ...(isActive ? styles.subItemActive : {}),
                        })}
                      >
                        {child.label}
                      </NavLink>
                    ))}
                  </div>
                )}
              </div>
            );
          }

          return (
            <NavLink
              key={item.path}
              to={item.path}
              style={({ isActive }) => ({
                ...styles.navItem,
                ...(isActive ? styles.navItemActive : {}),
              })}
            >
              <span style={styles.navIcon}>{item.icon}</span>
              <span style={styles.navLabel}>{item.label}</span>
            </NavLink>
          );
        })}
      </nav>

      {/* Logout */}
      <div style={styles.footer}>
        <div style={styles.divider} />
        <button style={styles.logoutBtn} onClick={handleLogout}>
          <span>🚪</span>
          <span>Logout</span>
        </button>
      </div>
    </aside>
  );
}

const styles = {
  sidebar: {
    position: 'fixed',
    left: 0,
    top: 0,
    bottom: 0,
    width: 'var(--sidebar-w)',
    background: 'rgba(10, 10, 15, 0.95)',
    borderRight: '1px solid var(--glass-border)',
    backdropFilter: 'blur(20px)',
    display: 'flex',
    flexDirection: 'column',
    zIndex: 100,
    overflowY: 'auto',
    paddingBottom: '16px',
    '@media (max-width: 768px)': { display: 'none' },
  },
  logo: {
    display: 'flex',
    alignItems: 'center',
    gap: '12px',
    padding: '24px 20px 20px',
  },
  logoIcon: {
    width: 40,
    height: 40,
    borderRadius: '12px',
    background: 'linear-gradient(135deg, #4f8ef7, #00d4aa)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    color: 'white',
    fontSize: '20px',
    fontWeight: 800,
    fontFamily: 'Syne, sans-serif',
    flexShrink: 0,
  },
  logoText: {
    fontSize: '18px',
    fontWeight: 800,
    color: 'var(--text-primary)',
    fontFamily: 'Syne, sans-serif',
    lineHeight: 1.2,
  },
  logoSub: {
    fontSize: '11px',
    color: 'var(--text-muted)',
    letterSpacing: '0.5px',
  },
  divider: {
    height: 1,
    background: 'var(--glass-border)',
    margin: '0 16px',
  },
  nav: {
    flex: 1,
    padding: '12px 10px',
    display: 'flex',
    flexDirection: 'column',
    gap: '2px',
    overflowY: 'auto',
  },
  navItem: {
    display: 'flex',
    alignItems: 'center',
    gap: '10px',
    padding: '10px 12px',
    borderRadius: '10px',
    fontSize: '14px',
    fontWeight: 500,
    color: 'var(--text-secondary)',
    cursor: 'pointer',
    border: 'none',
    background: 'transparent',
    width: '100%',
    textAlign: 'left',
    transition: 'all 0.15s ease',
    textDecoration: 'none',
  },
  navItemActive: {
    background: 'rgba(79, 142, 247, 0.12)',
    color: 'var(--accent)',
    borderLeft: '3px solid var(--accent)',
    paddingLeft: '9px',
  },
  navIcon: {
    fontSize: '18px',
    width: '22px',
    textAlign: 'center',
    flexShrink: 0,
  },
  navLabel: {
    flex: 1,
    lineHeight: 1.3,
  },
  chevron: {
    fontSize: '18px',
    color: 'var(--text-muted)',
    transition: 'transform 0.2s ease',
    marginLeft: 'auto',
  },
  submenu: {
    display: 'flex',
    flexDirection: 'column',
    gap: '1px',
    marginTop: '2px',
    paddingLeft: '32px',
  },
  subItem: {
    padding: '8px 12px',
    borderRadius: '8px',
    fontSize: '13px',
    color: 'var(--text-muted)',
    textDecoration: 'none',
    transition: 'all 0.15s ease',
    display: 'block',
  },
  subItemActive: {
    color: 'var(--accent)',
    background: 'rgba(79,142,247,0.08)',
  },
  footer: {
    padding: '0 10px 0',
  },
  logoutBtn: {
    display: 'flex',
    alignItems: 'center',
    gap: '10px',
    padding: '10px 12px',
    borderRadius: '10px',
    fontSize: '14px',
    fontWeight: 500,
    color: 'var(--danger)',
    cursor: 'pointer',
    border: 'none',
    background: 'transparent',
    width: '100%',
    marginTop: '8px',
    transition: 'all 0.15s ease',
  },
};
