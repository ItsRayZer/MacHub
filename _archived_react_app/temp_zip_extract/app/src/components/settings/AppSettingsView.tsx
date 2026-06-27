import { useStore } from '@/store/useStore';
import type { AppSettings, SettingsView } from '@/types';
import { Monitor, Bell, Database, Trash2, ChevronRight } from 'lucide-react';

export default function AppSettingsView() {
  const appSettings = useStore((s: { appSettings: AppSettings }) => s.appSettings);
  const updateAppSettings = useStore((s: { updateAppSettings: (settings: Partial<AppSettings>) => void }) => s.updateAppSettings);
  const navigateTo = useStore((s: { navigateTo: (v: SettingsView) => void }) => s.navigateTo);
  const showToast = useStore((s: { showToast: (m: string, t?: 'success' | 'error' | 'info') => void }) => s.showToast);
  const isClearingCache = useStore((s: { isClearingCache: boolean }) => s.isClearingCache);
  const setClearingCache = useStore((s: { setClearingCache: (v: boolean) => void }) => s.setClearingCache);

  const handleClearCache = () => {
    setClearingCache(true);
    setTimeout(() => {
      setClearingCache(false);
      showToast('Local cache cleared', 'success');
    }, 1500);
  };

  const themeOptions: Array<'system' | 'dark' | 'light'> = ['system', 'dark', 'light'];
  const syncOptions: Array<'realtime' | 'hourly' | 'daily'> = ['realtime', 'hourly', 'daily'];

  return (
    <div className="p-4 pb-8 space-y-5">
      <div>
        <h4 className="text-[10px] font-bold text-[#8D99AE] uppercase tracking-wider px-1 mb-2">Appearance</h4>
        <div
          className="rounded-xl p-4"
          style={{ background: 'rgba(255, 255, 255, 0.03)', border: '1px solid rgba(255, 255, 255, 0.06)' }}
        >
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-3">
              <Monitor className="w-4 h-4 text-[#ADE8F4]" />
              <span className="text-[12px] font-medium text-white">Theme Mode</span>
            </div>
          </div>
          <div className="flex gap-1 p-1 rounded-lg bg-black/40">
            {themeOptions.map((mode) => (
              <button
                key={mode}
                onClick={() => updateAppSettings({ themeMode: mode })}
                className="flex-1 py-2 rounded-md text-[11px] font-semibold capitalize transition-all"
                style={{
                  background: appSettings.themeMode === mode ? 'rgba(255, 255, 255, 0.1)' : 'transparent',
                  color: appSettings.themeMode === mode ? '#00F5D4' : '#8D99AE',
                  border: appSettings.themeMode === mode ? '1px solid rgba(0, 245, 212, 0.2)' : '1px solid transparent',
                }}
              >
                {mode}
              </button>
            ))}
          </div>
        </div>
      </div>

      <div>
        <h4 className="text-[10px] font-bold text-[#8D99AE] uppercase tracking-wider px-1 mb-2">Notifications</h4>
        <div
          className="rounded-xl overflow-hidden"
          style={{ background: 'rgba(255, 255, 255, 0.03)', border: '1px solid rgba(255, 255, 255, 0.06)' }}
        >
          <button
            onClick={() => navigateTo('notifications')}
            className="w-full p-4 flex items-center justify-between text-left settings-row transition-colors hover:bg-white/5"
          >
            <div className="flex items-center gap-3">
              <Bell className="w-4 h-4 text-[#ADE8F4]" />
              <div>
                <span className="font-semibold text-[12px] text-white block">Notification Settings</span>
                <span className="text-[10px] text-[#8D99AE]">4 categories configured</span>
              </div>
            </div>
            <ChevronRight className="w-4 h-4 text-[#8D99AE]" />
          </button>
        </div>
      </div>

      <div>
        <h4 className="text-[10px] font-bold text-[#8D99AE] uppercase tracking-wider px-1 mb-2">Data Management</h4>
        <div
          className="rounded-xl divide-y overflow-hidden"
          style={{ background: 'rgba(255, 255, 255, 0.03)', border: '1px solid rgba(255, 255, 255, 0.06)' }}
        >
          <div className="p-4">
            <div className="flex items-center justify-between mb-2">
              <div className="flex items-center gap-3">
                <Database className="w-4 h-4 text-[#ADE8F4]" />
                <span className="text-[12px] font-medium text-white">Sync Frequency</span>
              </div>
            </div>
            <div className="flex gap-1 p-1 rounded-lg bg-black/40">
              {syncOptions.map((freq) => (
                <button
                  key={freq}
                  onClick={() => updateAppSettings({ syncFrequency: freq })}
                  className="flex-1 py-2 rounded-md text-[11px] font-semibold capitalize transition-all"
                  style={{
                    background: appSettings.syncFrequency === freq ? 'rgba(255, 255, 255, 0.1)' : 'transparent',
                    color: appSettings.syncFrequency === freq ? '#00F5D4' : '#8D99AE',
                    border: appSettings.syncFrequency === freq ? '1px solid rgba(0, 245, 212, 0.2)' : '1px solid transparent',
                  }}
                >
                  {freq}
                </button>
              ))}
            </div>
          </div>
          <button
            onClick={handleClearCache}
            disabled={isClearingCache}
            className="w-full p-4 flex items-center justify-between text-left settings-row transition-colors hover:bg-white/5"
          >
            <div className="flex items-center gap-3">
              <Trash2 className="w-4 h-4 text-[#FFB703]" />
              <span className="font-semibold text-[12px] text-white">Clear Local Snapshot Caches</span>
            </div>
            <span className="text-[11px] text-[#FFB703] font-medium">
              {isClearingCache ? 'Clearing...' : 'Purge'}
            </span>
          </button>
        </div>
      </div>
    </div>
  );
}
