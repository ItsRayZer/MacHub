import { useStore } from '@/store/useStore';
import { studentProfile } from '@/data/mockData';
import { Shield, KeyRound, Smartphone, LogOut, ChevronRight, Lock } from 'lucide-react';
import type { SettingsView } from '@/types';

export default function AccountSecurityView() {
  const navigateTo = useStore((s: { navigateTo: (v: SettingsView) => void }) => s.navigateTo);
  const showToast = useStore((s: { showToast: (m: string, t?: 'success' | 'error' | 'info') => void }) => s.showToast);

  return (
    <div className="p-4 pb-8 space-y-5">
      <div
        className="p-4 rounded-xl flex items-center gap-3"
        style={{ background: 'rgba(0, 245, 212, 0.08)', border: '1px solid rgba(0, 245, 212, 0.2)' }}
      >
        <Shield className="w-6 h-6 text-[#00F5D4] shrink-0" />
        <div>
          <p className="text-[12px] font-semibold text-[#00F5D4]">Account Secure</p>
          <p className="text-[10px] text-[#8D99AE]">Your account is protected with a strong password</p>
        </div>
      </div>

      <div>
        <h4 className="text-[10px] font-bold text-[#8D99AE] uppercase tracking-wider px-1 mb-2">Credentials</h4>
        <div
          className="rounded-xl divide-y overflow-hidden"
          style={{ background: 'rgba(255, 255, 255, 0.03)', border: '1px solid rgba(255, 255, 255, 0.06)' }}
        >
          <button
            onClick={() => navigateTo('change-password')}
            className="w-full p-4 flex items-center justify-between text-left settings-row transition-colors hover:bg-white/5"
          >
            <div className="flex items-center gap-3">
              <KeyRound className="w-4 h-4 text-[#ADE8F4]" />
              <div>
                <span className="font-semibold text-[12px] text-white block">MacHub App Password</span>
                <span className="text-[10px] text-[#8D99AE]">Change your login password</span>
              </div>
            </div>
            <ChevronRight className="w-4 h-4 text-[#8D99AE]" />
          </button>
        </div>
      </div>

      <div>
        <h4 className="text-[10px] font-bold text-[#8D99AE] uppercase tracking-wider px-1 mb-2">Session Control</h4>
        <div
          className="rounded-xl divide-y overflow-hidden"
          style={{ background: 'rgba(255, 255, 255, 0.03)', border: '1px solid rgba(255, 255, 255, 0.06)' }}
        >
          <button
            onClick={() => navigateTo('active-devices')}
            className="w-full p-4 flex items-center justify-between text-left settings-row transition-colors hover:bg-white/5"
          >
            <div className="flex items-center gap-3">
              <Smartphone className="w-4 h-4 text-[#ADE8F4]" />
              <div>
                <span className="font-semibold text-[12px] text-white block">Active Devices</span>
                <span className="text-[10px] text-[#8D99AE]">3 devices currently logged in</span>
              </div>
            </div>
            <ChevronRight className="w-4 h-4 text-[#8D99AE]" />
          </button>
          <button
            onClick={() => showToast('Logged out successfully', 'success')}
            className="w-full p-4 flex items-center justify-between text-left settings-row transition-colors hover:bg-white/5"
          >
            <div className="flex items-center gap-3">
              <LogOut className="w-4 h-4 text-[#FFB703]" />
              <span className="font-semibold text-[12px] text-[#FFB703]">Logout</span>
            </div>
          </button>
        </div>
      </div>

      <div className="liquid-glass rounded-xl p-4 space-y-3">
        <h4 className="text-[11px] font-bold text-[#8D99AE] uppercase tracking-wider">Account Info</h4>
        <div className="flex justify-between items-center">
          <span className="text-[11px] text-white">Student ID</span>
          <span className="text-[11px] text-[#8D99AE] font-mono-tech">{studentProfile.admissionNo}</span>
        </div>
        <div className="flex justify-between items-center">
          <span className="text-[11px] text-white">Portal Email</span>
          <span className="text-[11px] text-[#8D99AE]">{studentProfile.email}</span>
        </div>
        <div className="flex justify-between items-center">
          <span className="text-[11px] text-white">Auth Method</span>
          <span className="text-[11px] text-[#00F5D4] flex items-center gap-1">
            <Lock className="w-3 h-3" />
            Password
          </span>
        </div>
      </div>
    </div>
  );
}
