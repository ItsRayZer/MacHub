import { useSettingsStore } from '../../store/settingsStore';
import { useStudentStore } from '../../store/studentStore';
import {
  Database,
  Shield,
  Settings2,
  LogOut,
  Trash2,
  ChevronRight,
  FileText,
  Ticket,
  CreditCard,
  Mail,
  Bus,
  Bell,
  Info,
  KeyRound,
  Smartphone,
} from 'lucide-react';

export default function SettingsRoot() {
  const navigateTo = useSettingsStore((s) => s.navigateTo);
  const showToast = useSettingsStore((s) => s.showToast);
  const closeSettings = useSettingsStore((s) => s.closeSettings);

  const student = useStudentStore((s) => s.profile?.data || {});
  const customProfile = useStudentStore((s) => s.customProfile || {});
  const displayName = customProfile.displayName || student.name || 'Student Name';
  const photoUrl = customProfile.photoUrl || student.photoUrl || '/avatar.jpg';
  const admissionNo = student.admissionNo || 'MGU2023BCA0129';
  const course = student.course || 'BCA';
  const batch = student.batch || '2023-2026';

  const handleLogout = () => {
    useStudentStore.getState().logout();
    showToast('Logged out successfully', 'success');
    setTimeout(() => {
      closeSettings();
      window.location.reload();
    }, 500);
  };

  const handleWipeData = async () => {
    try {
      const { clearIndexedDbPersistence } = await import('firebase/firestore');
      const { db } = await import('../../firebase');
      await clearIndexedDbPersistence(db);
      useStudentStore.getState().logout();
      showToast('Local snapshot data wiped successfully', 'success');
      setTimeout(() => {
        closeSettings();
        window.location.reload();
      }, 800);
    } catch (err) {
      console.warn("Failed to wipe local DB:", err);
      showToast('Wipe failed or not supported in this state', 'error');
    }
  };

  const sections = [
    {
      title: 'Synced Portal Documents',
      items: [
        { id: 'synced-data', label: 'All Synced Data', icon: <Database className="w-4 h-4" />, view: 'synced-data' },
      ],
    },
    {
      title: 'Account & Security',
      items: [
        { id: 'change-password', label: 'Change Password', icon: <KeyRound className="w-4 h-4" />, view: 'change-password' },
        { id: 'active-devices', label: 'Active Devices', icon: <Smartphone className="w-4 h-4" />, view: 'active-devices' },
        { id: 'account-security', label: 'Security Overview', icon: <Shield className="w-4 h-4" />, view: 'account-security' },
      ],
    },
    {
      title: 'App Settings',
      items: [
        { id: 'app-settings', label: 'Appearance & General', icon: <Settings2 className="w-4 h-4" />, view: 'app-settings' },
        { id: 'notifications', label: 'Notifications', icon: <Bell className="w-4 h-4" />, view: 'notifications' },
        { id: 'about', label: 'About MacHub', icon: <Info className="w-4 h-4" />, view: 'about' },
      ],
    },
    {
      title: 'Quick Access',
      items: [
        { id: 'allotment-memo', label: 'Allotment Memo', icon: <FileText className="w-4 h-4" />, view: 'allotment-memo' },
        { id: 'hall-ticket', label: 'Hall Ticket Matrix', icon: <Ticket className="w-4 h-4" />, view: 'hall-ticket' },
        { id: 'fee-payment', label: 'Fee Payment Portals', icon: <CreditCard className="w-4 h-4" />, view: 'fee-payment' },
        { id: 'grievance', label: 'Grievance Form', icon: <Mail className="w-4 h-4" />, view: 'grievance' },
        { id: 'concession', label: 'Student Concession Pass', icon: <Bus className="w-4 h-4" />, view: 'concession' },
      ],
    },
    {
      title: 'Danger Zone',
      items: [
        { id: 'logout', label: 'Logout', icon: <LogOut className="w-4 h-4" />, action: handleLogout },
        { id: 'wipe-data', label: 'Wipe Profile & Delete Local Records', icon: <Trash2 className="w-4 h-4" />, danger: true, action: handleWipeData },
      ],
    },
  ];

  return (
    <div className="p-4 pb-8 space-y-5">
      <div className="liquid-glass rounded-2xl p-4 flex items-center gap-4">
        <div
          className="w-14 h-14 rounded-full p-[2px] shrink-0"
          style={{
            background: 'linear-gradient(135deg, #00F5D4 0%, #03045E 100%)',
          }}
        >
          <img
            src={photoUrl}
            alt="Profile"
            className="w-full h-full rounded-full object-cover"
            onError={(e) => {
              e.target.src = '/avatar.jpg';
            }}
          />
        </div>
        <div className="flex-1 min-w-0">
          <h4 className="text-sm font-bold text-white truncate">{displayName}</h4>
          <p className="text-[11px] text-[#8D99AE] font-mono-tech">{admissionNo}</p>
          <p className="text-[10px] text-[#00F5D4]">{course} — Batch {batch}</p>
        </div>
      </div>

      {sections.map((section) => (
        <div key={section.title}>
          <h4 className="text-[10px] font-bold text-[#8D99AE] uppercase tracking-wider px-1 mb-2">
            {section.title}
          </h4>
          <div
            className="rounded-xl divide-y overflow-hidden"
            style={{
              background: section.items.some((i) => i.danger)
                ? 'rgba(255, 71, 87, 0.05)'
                : 'rgba(255, 255, 255, 0.03)',
              border: `1px solid ${
                section.items.some((i) => i.danger)
                  ? 'rgba(255, 71, 87, 0.15)'
                  : 'rgba(255, 255, 255, 0.06)'
              }`,
            }}
          >
            {section.items.map((item) => (
              <button
                key={item.id}
                onClick={() => {
                  if (item.action) {
                    item.action();
                  } else if (item.view) {
                    navigateTo(item.view);
                  }
                }}
                className="w-full p-3.5 flex items-center justify-between text-left settings-row transition-colors"
                style={{
                  color: item.danger ? '#ff6b6b' : 'white',
                }}
              >
                <div className="flex items-center gap-3">
                  <span style={{ color: item.danger ? '#ff6b6b' : '#ADE8F4' }}>{item.icon}</span>
                  <span className={`font-medium text-[12px] ${item.danger ? 'text-red-400' : 'text-white'}`}>
                    {item.label}
                  </span>
                </div>
                <div className="flex items-center gap-2">
                  {item.rightText && (
                    <span className="text-[11px] text-[#8D99AE] font-mono-tech">{item.rightText}</span>
                  )}
                  <ChevronRight className="w-4 h-4 text-[#8D99AE]" />
                </div>
              </button>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}
