import { useState } from 'react';
import { useSettingsStore } from '../../store/settingsStore';
import { Eye, EyeOff, Lock, Shield, AlertCircle } from 'lucide-react';

export default function ChangePasswordView() {
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showCurrent, setShowCurrent] = useState(false);
  const [showNew, setShowNew] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [error, setError] = useState('');
  const showToast = useSettingsStore((s) => s.showToast);
  const navigateBack = useSettingsStore((s) => s.navigateBack);

  const handleSubmit = () => {
    setError('');
    if (!currentPassword || !newPassword || !confirmPassword) {
      setError('All fields are required');
      return;
    }
    if (newPassword.length < 8) {
      setError('New password must be at least 8 characters');
      return;
    }
    if (newPassword !== confirmPassword) {
      setError('New passwords do not match');
      return;
    }
    showToast('Password updated successfully', 'success');
    navigateBack();
  };

  return (
    <div className="p-4 pb-8 space-y-5">
      <div
        className="p-3 rounded-xl flex items-center gap-3"
        style={{ background: 'rgba(173, 232, 244, 0.08)', border: '1px solid rgba(173, 232, 244, 0.2)' }}
      >
        <Shield className="w-5 h-5 text-[#ADE8F4] shrink-0" />
        <div>
          <p className="text-[11px] font-semibold text-[#ADE8F4]">Password Policy</p>
          <p className="text-[10px] text-[#8D99AE]">Min 8 characters. Use a mix of letters, numbers, and symbols.</p>
        </div>
      </div>

      <div className="liquid-glass rounded-2xl p-5 space-y-4">
        <div>
          <label className="block text-[11px] text-[#8D99AE] mb-1.5 font-medium">Current Password</label>
          <div className="relative">
            <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[#8D99AE]" />
            <input
              type={showCurrent ? 'text' : 'password'}
              value={currentPassword}
              onChange={(e) => setCurrentPassword(e.target.value)}
              placeholder="Enter current password"
              className="w-full bg-black/40 border border-white/10 pl-10 pr-10 py-3 rounded-xl text-white text-xs outline-none focus:border-[#00F5D4] transition-colors placeholder:text-[#8D99AE]/50"
            />
            <button
              onClick={() => setShowCurrent(!showCurrent)}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-[#8D99AE] hover:text-white transition-colors"
            >
              {showCurrent ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
            </button>
          </div>
        </div>

        <div>
          <label className="block text-[11px] text-[#8D99AE] mb-1.5 font-medium">New Password</label>
          <div className="relative">
            <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[#8D99AE]" />
            <input
              type={showNew ? 'text' : 'password'}
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
              placeholder="Enter new password"
              className="w-full bg-black/40 border border-white/10 pl-10 pr-10 py-3 rounded-xl text-white text-xs outline-none focus:border-[#00F5D4] transition-colors placeholder:text-[#8D99AE]/50"
            />
            <button
              onClick={() => setShowNew(!showNew)}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-[#8D99AE] hover:text-white transition-colors"
            >
              {showNew ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
            </button>
          </div>
        </div>

        <div>
          <label className="block text-[11px] text-[#8D99AE] mb-1.5 font-medium">Confirm New Password</label>
          <div className="relative">
            <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[#8D99AE]" />
            <input
              type={showConfirm ? 'text' : 'password'}
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              placeholder="Confirm new password"
              className="w-full bg-black/40 border border-white/10 pl-10 pr-10 py-3 rounded-xl text-white text-xs outline-none focus:border-[#00F5D4] transition-colors placeholder:text-[#8D99AE]/50"
            />
            <button
              onClick={() => setShowConfirm(!showConfirm)}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-[#8D99AE] hover:text-white transition-colors"
            >
              {showConfirm ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
            </button>
          </div>
        </div>

        {error && (
          <div className="flex items-center gap-2 text-red-400">
            <AlertCircle className="w-4 h-4 shrink-0" />
            <span className="text-[11px]">{error}</span>
          </div>
        )}
      </div>

      <button
        onClick={handleSubmit}
        className="w-full py-3.5 rounded-xl font-bold text-xs text-black transition-all active:scale-[0.98] flex items-center justify-center gap-2"
        style={{ background: '#00F5D4' }}
      >
        <Shield className="w-4 h-4" />
        Update Password
      </button>

      <p className="text-[10px] text-[#8D99AE] text-center px-4">
        This password is synced with the MGU student portal protocol. Changing it here will update your portal password too.
      </p>
    </div>
  );
}
