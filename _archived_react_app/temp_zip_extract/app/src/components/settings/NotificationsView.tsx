import { useStore } from '@/store/useStore';
import type { AppSettings } from '@/types';
import { TrendingDown, GraduationCap, CreditCard, Bell } from 'lucide-react';

interface NotificationToggle {
  key: string;
  label: string;
  description: string;
  icon: React.ReactNode;
  settingKey: 'attendanceAlerts' | 'marksNotifications' | 'feeDueReminders' | 'generalAnnouncements';
}

export default function NotificationsView() {
  const appSettings = useStore((s: { appSettings: AppSettings }) => s.appSettings);
  const updateAppSettings = useStore((s: { updateAppSettings: (settings: Partial<AppSettings>) => void }) => s.updateAppSettings);

  const toggles: NotificationToggle[] = [
    {
      key: 'attendance',
      label: 'Attendance Alerts',
      description: 'Warn when attendance drops below 75%',
      icon: <TrendingDown className="w-4 h-4" />,
      settingKey: 'attendanceAlerts',
    },
    {
      key: 'marks',
      label: 'New Marks Published',
      description: 'Get notified when internal marks are uploaded',
      icon: <GraduationCap className="w-4 h-4" />,
      settingKey: 'marksNotifications',
    },
    {
      key: 'fee',
      label: 'Fee Due Reminders',
      description: 'Reminders before fee payment deadlines',
      icon: <CreditCard className="w-4 h-4" />,
      settingKey: 'feeDueReminders',
    },
    {
      key: 'general',
      label: 'General Announcements',
      description: 'College and university announcements',
      icon: <Bell className="w-4 h-4" />,
      settingKey: 'generalAnnouncements',
    },
  ];

  return (
    <div className="p-4 pb-8 space-y-4">
      <p className="text-[11px] text-[#8D99AE] px-1">
        Choose which notifications you want to receive. Attendance alerts and fee reminders are highly recommended.
      </p>

      <div className="space-y-2">
        {toggles.map((toggle) => {
          const isActive = appSettings[toggle.settingKey];
          return (
            <div key={toggle.key} className="liquid-glass rounded-xl p-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <span className="text-[#ADE8F4]">{toggle.icon}</span>
                  <div>
                    <span className="text-[12px] font-semibold text-white block">{toggle.label}</span>
                    <span className="text-[10px] text-[#8D99AE]">{toggle.description}</span>
                  </div>
                </div>
                <button
                  onClick={() => updateAppSettings({ [toggle.settingKey]: !isActive })}
                  className={`toggle-switch ${isActive ? 'active' : ''}`}
                >
                  <div className="toggle-switch-thumb" />
                </button>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
