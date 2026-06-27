import { useSettingsStore } from '../../store/settingsStore';
import { feeRecords } from '../../data/mockData';
import { CheckCircle2, AlertTriangle, ExternalLink, Receipt, CalendarDays } from 'lucide-react';

export default function FeePaymentView() {
  const showToast = useSettingsStore((s) => s.showToast);

  const totalPaid = feeRecords.filter((f) => f.status === 'paid').reduce((sum, f) => sum + f.amount, 0);
  const totalPending = feeRecords.filter((f) => f.status === 'pending').reduce((sum, f) => sum + f.amount, 0);

  return (
    <div className="p-4 pb-8 space-y-4">
      <div className="grid grid-cols-2 gap-3">
        <div className="liquid-glass rounded-xl p-4 text-center">
          <CheckCircle2 className="w-5 h-5 text-[#00F5D4] mx-auto mb-1" />
          <span className="text-lg font-bold font-display text-[#00F5D4]">₹{totalPaid.toLocaleString()}</span>
          <span className="text-[9px] text-[#8D99AE] block">Total Paid</span>
        </div>
        <div className="liquid-glass rounded-xl p-4 text-center">
          <AlertTriangle className="w-5 h-5 text-[#FFB703] mx-auto mb-1" />
          <span className="text-lg font-bold font-display text-[#FFB703]">₹{totalPending.toLocaleString()}</span>
          <span className="text-[9px] text-[#8D99AE] block">Pending</span>
        </div>
      </div>

      {feeRecords.some((f) => f.status === 'pending') && (
        <>
          <h4 className="text-[11px] font-bold text-[#FFB703] uppercase tracking-wider px-1 flex items-center gap-2">
            <AlertTriangle className="w-3 h-3" />
            Pending Payments
          </h4>
          <div className="space-y-2">
            {feeRecords
              .filter((f) => f.status === 'pending')
              .map((fee) => (
                <div
                  key={fee.id}
                  className="p-4 rounded-xl"
                  style={{ background: 'rgba(255, 183, 3, 0.05)', border: '1px solid rgba(255, 183, 3, 0.15)' }}
                >
                  <div className="flex justify-between items-start mb-2">
                    <div>
                      <h5 className="text-xs font-bold text-white">{fee.semester}</h5>
                      <span className="text-[10px] text-[#8D99AE]">{fee.category}</span>
                    </div>
                    <span className="text-sm font-bold font-display text-[#FFB703]">₹{fee.amount.toLocaleString()}</span>
                  </div>
                  <div className="flex items-center gap-2 mb-3">
                    <CalendarDays className="w-3 h-3 text-[#8D99AE]" />
                    <span className="text-[10px] text-[#8D99AE]">Due: {fee.dueDate}</span>
                  </div>
                  <button
                    onClick={() => showToast('Redirecting to MGU payment gateway...', 'info')}
                    className="w-full py-2.5 rounded-lg font-bold text-[11px] text-black transition-all active:scale-[0.98] flex items-center justify-center gap-2"
                    style={{ background: '#FFB703' }}
                  >
                    <ExternalLink className="w-3.5 h-3.5" />
                    Pay Now
                  </button>
                </div>
              ))}
          </div>
        </>
      )}

      <h4 className="text-[11px] font-bold text-[#00F5D4] uppercase tracking-wider px-1 flex items-center gap-2">
        <CheckCircle2 className="w-3 h-3" />
        Payment History
      </h4>
      <div className="space-y-2">
        {feeRecords
          .filter((f) => f.status === 'paid')
          .map((fee) => (
            <div key={fee.id} className="liquid-glass rounded-xl p-4">
              <div className="flex justify-between items-start">
                <div className="flex items-center gap-2">
                  <Receipt className="w-4 h-4 text-[#00F5D4]" />
                  <div>
                    <h5 className="text-xs font-bold text-white">{fee.semester}</h5>
                    <span className="text-[10px] text-[#8D99AE]">{fee.category}</span>
                  </div>
                </div>
                <span className="text-sm font-bold font-display text-[#00F5D4]">₹{fee.amount.toLocaleString()}</span>
              </div>
              <div className="flex items-center gap-3 mt-2 pt-2 border-t border-white/5">
                <span className="text-[10px] text-[#8D99AE] font-mono-tech">{fee.transactionId}</span>
                <span className="text-[10px] text-[#8D99AE]">{fee.paidDate}</span>
              </div>
            </div>
          ))}
      </div>
    </div>
  );
}
