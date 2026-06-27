import { useCallback } from 'react';
import { useStore } from '@/store/useStore';
import type { SettingsView } from '@/types';
import SettingsRoot from './SettingsRoot';
import SyncedDataView from './SyncedDataView';
import AllotmentMemoView from './AllotmentMemoView';
import HallTicketView from './HallTicketView';
import FeePaymentView from './FeePaymentView';
import GrievanceView from './GrievanceView';
import ConcessionView from './ConcessionView';
import AccountSecurityView from './AccountSecurityView';
import ChangePasswordView from './ChangePasswordView';
import ActiveDevicesView from './ActiveDevicesView';
import AppSettingsView from './AppSettingsView';
import NotificationsView from './NotificationsView';
import AboutView from './AboutView';
import FeedbackView from './FeedbackView';
import { ChevronLeft } from 'lucide-react';

const viewTitles: Record<SettingsView, string> = {
  root: 'Settings',
  'synced-data': 'Synced Data Sources',
  'allotment-memo': 'Allotment Memo',
  'hall-ticket': 'Hall Ticket Matrix',
  'fee-payment': 'Fee Payment Portals',
  feedback: 'Official Feedback',
  grievance: 'Grievance Form',
  concession: 'Student Concession Pass',
  'account-security': 'Account & Security',
  'change-password': 'Change Password',
  'active-devices': 'Active Devices',
  'app-settings': 'App Settings',
  notifications: 'Notifications',
  about: 'About MacHub',
};

export default function SettingsHub() {
  const isSettingsOpen = useStore((s: { isSettingsOpen: boolean }) => s.isSettingsOpen);
  const currentView = useStore((s: { currentSettingsView: SettingsView }) => s.currentSettingsView);
  const closeSettings = useStore((s: { closeSettings: () => void }) => s.closeSettings);
  const navigateBack = useStore((s: { navigateBack: () => void }) => s.navigateBack);

  const handleBackdropClick = useCallback(() => {
    closeSettings();
  }, [closeSettings]);

  if (!isSettingsOpen) return null;

  const showBackButton = currentView !== 'root';

  const renderView = () => {
    switch (currentView) {
      case 'root':
        return <SettingsRoot />;
      case 'synced-data':
        return <SyncedDataView />;
      case 'allotment-memo':
        return <AllotmentMemoView />;
      case 'hall-ticket':
        return <HallTicketView />;
      case 'fee-payment':
        return <FeePaymentView />;
      case 'grievance':
        return <GrievanceView />;
      case 'concession':
        return <ConcessionView />;
      case 'account-security':
        return <AccountSecurityView />;
      case 'change-password':
        return <ChangePasswordView />;
      case 'active-devices':
        return <ActiveDevicesView />;
      case 'app-settings':
        return <AppSettingsView />;
      case 'notifications':
        return <NotificationsView />;
      case 'about':
        return <AboutView />;
      case 'feedback':
        return <FeedbackView />;
      default:
        return <SettingsRoot />;
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-end" onClick={handleBackdropClick}>
      <div
        className="absolute inset-0 animate-fadeIn"
        style={{
          background: 'rgba(0, 0, 0, 0.6)',
          backdropFilter: 'blur(4px)',
          WebkitBackdropFilter: 'blur(4px)',
        }}
      />

      <div
        className="w-full max-w-lg mx-auto relative rounded-t-3xl overflow-hidden animate-slideUp"
        style={{
          height: '92vh',
          background: 'rgba(9, 9, 11, 0.92)',
          backdropFilter: 'blur(40px) saturate(200%)',
          WebkitBackdropFilter: 'blur(40px) saturate(200%)',
          borderTop: '1px solid rgba(255, 255, 255, 0.12)',
          boxShadow: 'inset 0 1px 1px rgba(255, 255, 255, 0.08), 0 -8px 32px rgba(0, 0, 0, 0.4)',
        }}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex justify-center pt-3 pb-1">
          <div
            className="w-10 h-1 rounded-full cursor-pointer"
            style={{ background: 'rgba(255, 255, 255, 0.2)' }}
            onClick={closeSettings}
          />
        </div>

        <div
          className="px-4 py-3 flex items-center gap-3 sticky top-0 z-10"
          style={{
            borderBottom: '1px solid rgba(255, 255, 255, 0.08)',
            background: 'rgba(9, 9, 11, 0.8)',
            backdropFilter: 'blur(20px)',
          }}
        >
          {showBackButton && (
            <button
              onClick={navigateBack}
              className="p-1 -ml-1 rounded-lg hover:bg-white/10 transition-colors"
            >
              <ChevronLeft className="w-5 h-5 text-white" />
            </button>
          )}
          <h3 className="text-base font-bold font-display flex-1">{viewTitles[currentView]}</h3>
          {currentView === 'root' && (
            <button
              onClick={closeSettings}
              className="text-[11px] font-semibold text-[#00F5D4] hover:text-white transition-colors"
            >
              Done
            </button>
          )}
        </div>

        <div className="overflow-y-auto no-scrollbar" style={{ height: 'calc(92vh - 100px)' }}>
          {renderView()}
        </div>
      </div>
    </div>
  );
}
