/**
 * AppShell — Layout with fixed sidebar (desktop) and bottom nav (mobile)
 */
import { Outlet } from 'react-router-dom';
import Sidebar from './Sidebar';
import TopBar from './TopBar';
import BottomNav from './BottomNav';
export default function AppShell() {
  return (
    <div className="app-shell">
      <Sidebar />
      <div className="main-content">
        <TopBar />
        <div className="page-content fade-in">
          <Outlet />
        </div>
      </div>
      <BottomNav />
    </div>
  );
}
