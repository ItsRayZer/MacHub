import { useSettingsStore } from '../../store/settingsStore';
import { deviceSessions } from '../../data/mockData';
import { Smartphone, Monitor, Laptop, LogOut, CheckCircle2 } from 'lucide-react';

export default function ActiveDevicesView() {
  const showToast = useSettingsStore((s) => s.showToast);

  const getDeviceIcon = (name) => {
    if (name.includes('iPhone') || name.includes('Android')) return <Smartphone className="w-5 h-5 text-[#00F5D4]" />;
    if (name.includes('MacBook') || name.includes('Laptop')) return <Laptop className="w-5 h-5 text-[#ADE8F4]" />;
    return <Monitor className="w-5 h-5 text-[#FFB703]" />;
  };

  return (
    <div className="p-4 pb-8 space-y-4">
      <p className="text-[11px] text-[#8D99AE] px-1">
        These are the devices currently logged into your MacHub account. End any session you don't recognize.
      </p>

      <div className="space-y-2">
        {deviceSessions.map((device) => (
          <div
            key={device.id}
            className="liquid-glass rounded-xl p-4"
            style={device.isCurrent ? { border: '1px solid rgba(0, 245, 212, 0.2)' } : {}}
          >
            <div className="flex items-start justify-between">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-lg bg-white/5 flex items-center justify-center">
                  {getDeviceIcon(device.deviceName)}
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <h5 className="text-xs font-bold text-white">{device.deviceName}</h5>
                    {device.isCurrent && (
                      <span className="text-[9px] font-bold text-[#00F5D4] flex items-center gap-0.5">
                        <CheckCircle2 className="w-3 h-3" />
                        Current
                      </span>
                    )}
                  </div>
                  <p className="text-[10px] text-[#8D99AE] font-mono-tech">{device.ipAddress}</p>
                  <p className="text-[10px] text-[#8D99AE]">
                    Last active: {new Date(device.lastActive).toLocaleString()}
                  </p>
                </div>
              </div>
              {!device.isCurrent && (
                <button
                  onClick={() => showToast('Session ended', 'success')}
                  className="p-2 rounded-lg hover:bg-red-500/10 transition-colors text-red-400"
                >
                  <LogOut className="w-4 h-4" />
                </button>
              )}
            </div>
          </div>
        ))}
      </div>

      <div
        className="p-3 rounded-xl flex items-center gap-3"
        style={{ background: 'rgba(255, 183, 3, 0.08)', border: '1px solid rgba(255, 183, 3, 0.2)' }}
      >
        <CheckCircle2 className="w-5 h-5 text-[#FFB703] shrink-0" />
        <p className="text-[10px] text-[#8D99AE]">
          If you don't recognize a device, end its session immediately and change your password.
        </p>
      </div>
    </div>
  );
}
