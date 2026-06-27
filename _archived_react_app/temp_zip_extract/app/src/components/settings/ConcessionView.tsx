import { useStore } from '@/store/useStore';
import { concessionPasses, studentProfile } from '@/data/mockData';
import { Bus, Calendar, MapPin, FileDown, CheckCircle2, AlertTriangle } from 'lucide-react';

export default function ConcessionView() {
  const showToast = useStore((s: { showToast: (m: string, t?: 'success' | 'error' | 'info') => void }) => s.showToast);
  const pass = concessionPasses[0];
  const isActive = pass.status === 'active';

  return (
    <div className="p-4 pb-8 space-y-4">
      <div
        className="p-3 rounded-xl flex items-center gap-3"
        style={{
          background: isActive ? 'rgba(0, 245, 212, 0.08)' : 'rgba(255, 183, 3, 0.08)',
          border: isActive ? '1px solid rgba(0, 245, 212, 0.2)' : '1px solid rgba(255, 183, 3, 0.2)',
        }}
      >
        {isActive ? (
          <CheckCircle2 className="w-5 h-5 text-[#00F5D4] shrink-0" />
        ) : (
          <AlertTriangle className="w-5 h-5 text-[#FFB703] shrink-0" />
        )}
        <div>
          <p className="text-[11px] font-semibold" style={{ color: isActive ? '#00F5D4' : '#FFB703' }}>
            Pass {isActive ? 'Active' : 'Expired'}
          </p>
          <p className="text-[10px] text-[#8D99AE]">
            {isActive ? `Valid until ${pass.validUntil}` : 'Please renew your pass'}
          </p>
        </div>
      </div>

      <div className="liquid-glass rounded-2xl p-5 space-y-4">
        <div className="flex items-center gap-4 pb-3 border-b border-white/5">
          <div className="w-12 h-12 rounded-xl bg-[#00F5D4]/10 flex items-center justify-center">
            <Bus className="w-6 h-6 text-[#00F5D4]" />
          </div>
          <div>
            <h4 className="text-sm font-bold text-white">Student Concession Pass</h4>
            <p className="text-[10px] text-[#8D99AE]">{pass.passType} Pass</p>
          </div>
        </div>

        <div className="space-y-3">
          <div className="flex items-start gap-3">
            <div className="w-4 h-4 flex items-center justify-center shrink-0 mt-0.5">
              <span className="text-[10px] text-[#ADE8F4] font-mono-tech">ID</span>
            </div>
            <div>
              <p className="text-[10px] text-[#8D99AE]">Pass Number</p>
              <p className="text-xs text-white font-medium font-mono-tech">{pass.passNumber}</p>
            </div>
          </div>

          <div className="flex items-start gap-3">
            <Calendar className="w-4 h-4 text-[#ADE8F4] mt-0.5 shrink-0" />
            <div>
              <p className="text-[10px] text-[#8D99AE]">Valid Period</p>
              <p className="text-xs text-white font-medium font-mono-tech">
                {pass.validFrom} — {pass.validUntil}
              </p>
            </div>
          </div>

          {pass.route && (
            <div className="flex items-start gap-3">
              <MapPin className="w-4 h-4 text-[#ADE8F4] mt-0.5 shrink-0" />
              <div>
                <p className="text-[10px] text-[#8D99AE]">Route</p>
                <p className="text-xs text-white font-medium">{pass.route}</p>
              </div>
            </div>
          )}

          <div className="flex items-start gap-3">
            <div className="w-4 h-4 flex items-center justify-center shrink-0 mt-0.5">
              <span className="text-[10px] text-[#ADE8F4]">ID</span>
            </div>
            <div>
              <p className="text-[10px] text-[#8D99AE]">Student</p>
              <p className="text-xs text-white font-medium">{studentProfile.name}</p>
              <p className="text-[10px] text-[#8D99AE] font-mono-tech">{studentProfile.admissionNo}</p>
            </div>
          </div>
        </div>
      </div>

      <button
        onClick={() => showToast('Downloading concession pass PDF...', 'success')}
        className="w-full py-3.5 rounded-xl font-bold text-xs text-black transition-all active:scale-[0.98] flex items-center justify-center gap-2"
        style={{ background: '#00F5D4' }}
      >
        <FileDown className="w-4 h-4" />
        Download Concession Pass
      </button>

      {!isActive && (
        <div
          className="p-3 rounded-xl flex items-center gap-3"
          style={{ background: 'rgba(255, 183, 3, 0.08)', border: '1px solid rgba(255, 183, 3, 0.2)' }}
        >
          <AlertTriangle className="w-5 h-5 text-[#FFB703] shrink-0" />
          <div>
            <p className="text-[11px] font-semibold text-[#FFB703]">Pass Expired</p>
            <p className="text-[10px] text-[#8D99AE]">Please visit the college office to renew your concession pass.</p>
          </div>
        </div>
      )}
    </div>
  );
}
