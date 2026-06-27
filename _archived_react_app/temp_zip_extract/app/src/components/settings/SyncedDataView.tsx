import { useStore } from '@/store/useStore';
import { FileText, Ticket, CreditCard, Mail, Bus, ChevronRight } from 'lucide-react';
import type { SettingsView } from '@/types';

const dataItems: { id: SettingsView; label: string; icon: React.ReactNode; desc: string }[] = [
  { id: 'allotment-memo', label: 'Allotment Memo', icon: <FileText className="w-4 h-4" />, desc: 'Course allotment & seat details' },
  { id: 'hall-ticket', label: 'Hall Ticket Matrix', icon: <Ticket className="w-4 h-4" />, desc: 'Exam schedule & hall tickets' },
  { id: 'fee-payment', label: 'Fee Payment Portals', icon: <CreditCard className="w-4 h-4" />, desc: 'Fee status & payment history' },
  { id: 'grievance', label: 'Grievance Form', icon: <Mail className="w-4 h-4" />, desc: 'Submit & track grievances' },
  { id: 'concession', label: 'Student Concession Pass', icon: <Bus className="w-4 h-4" />, desc: 'Bus/rail pass details' },
];

export default function SyncedDataView() {
  const navigateTo = useStore((s: { navigateTo: (v: SettingsView) => void }) => s.navigateTo);

  return (
    <div className="p-4 pb-8 space-y-4">
      <p className="text-[11px] text-[#8D99AE] px-1">
        These documents are synced from the MGU student portal. Data is refreshed based on your sync frequency settings.
      </p>

      <div
        className="rounded-xl divide-y overflow-hidden"
        style={{ background: 'rgba(255, 255, 255, 0.03)', border: '1px solid rgba(255, 255, 255, 0.06)' }}
      >
        {dataItems.map((item) => (
          <button
            key={item.id}
            onClick={() => navigateTo(item.id)}
            className="w-full p-4 flex items-center justify-between text-left settings-row transition-colors hover:bg-white/5"
          >
            <div className="flex items-center gap-3">
              <span className="text-[#ADE8F4]">{item.icon}</span>
              <div>
                <span className="font-semibold text-[12px] text-white block">{item.label}</span>
                <span className="text-[10px] text-[#8D99AE]">{item.desc}</span>
              </div>
            </div>
            <ChevronRight className="w-4 h-4 text-[#8D99AE]" />
          </button>
        ))}
      </div>

      <div className="liquid-glass rounded-xl p-4 space-y-2">
        <h4 className="text-[11px] font-bold text-[#8D99AE] uppercase tracking-wider">Sync Status</h4>
        <div className="flex justify-between items-center">
          <span className="text-[11px] text-white">Last Synced</span>
          <span className="text-[11px] text-[#00F5D4] font-mono-tech">Just now</span>
        </div>
        <div className="flex justify-between items-center">
          <span className="text-[11px] text-white">Sync Frequency</span>
          <span className="text-[11px] text-[#8D99AE] font-mono-tech">Hourly</span>
        </div>
        <div className="flex justify-between items-center">
          <span className="text-[11px] text-white">Data Sources</span>
          <span className="text-[11px] text-[#00F5D4] font-mono-tech">5 active</span>
        </div>
        <div className="flex justify-between items-center">
          <span className="text-[11px] text-white">Portal URL</span>
          <span className="text-[10px] text-[#8D99AE] font-mono-tech truncate max-w-[180px]">studentportal.mgu.ac.in</span>
        </div>
      </div>
    </div>
  );
}
