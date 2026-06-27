import { useStore } from '@/store/useStore';
import { allotmentMemos, studentProfile } from '@/data/mockData';
import { FileDown, Building2, GraduationCap, Calendar, CheckCircle2 } from 'lucide-react';

export default function AllotmentMemoView() {
  const showToast = useStore((s: { showToast: (m: string, t?: 'success' | 'error' | 'info') => void }) => s.showToast);
  const memo = allotmentMemos[0];

  return (
    <div className="p-4 pb-8 space-y-4">
      <div
        className="p-3 rounded-xl flex items-center gap-3"
        style={{ background: 'rgba(0, 245, 212, 0.08)', border: '1px solid rgba(0, 245, 212, 0.2)' }}
      >
        <CheckCircle2 className="w-5 h-5 text-[#00F5D4] shrink-0" />
        <div>
          <p className="text-[11px] font-semibold text-[#00F5D4]">Allotment Active</p>
          <p className="text-[10px] text-[#8D99AE]">Your seat is confirmed and active</p>
        </div>
      </div>

      <div className="liquid-glass rounded-2xl p-5 space-y-4">
        <div className="flex items-center gap-3 pb-3 border-b border-white/5">
          <div className="w-10 h-10 rounded-lg bg-[#00F5D4]/10 flex items-center justify-center">
            <Building2 className="w-5 h-5 text-[#00F5D4]" />
          </div>
          <div>
            <h4 className="text-sm font-bold text-white">{memo.collegeName}</h4>
            <p className="text-[10px] text-[#8D99AE]">Affiliated College</p>
          </div>
        </div>

        <div className="space-y-3">
          <div className="flex items-start gap-3">
            <GraduationCap className="w-4 h-4 text-[#ADE8F4] mt-0.5 shrink-0" />
            <div>
              <p className="text-[10px] text-[#8D99AE]">Course</p>
              <p className="text-xs text-white font-medium">{memo.courseName}</p>
            </div>
          </div>

          <div className="flex items-start gap-3">
            <Building2 className="w-4 h-4 text-[#ADE8F4] mt-0.5 shrink-0" />
            <div>
              <p className="text-[10px] text-[#8D99AE]">College</p>
              <p className="text-xs text-white font-medium">{memo.collegeName}</p>
            </div>
          </div>

          <div className="flex items-start gap-3">
            <Calendar className="w-4 h-4 text-[#ADE8F4] mt-0.5 shrink-0" />
            <div>
              <p className="text-[10px] text-[#8D99AE]">Allotted Date</p>
              <p className="text-xs text-white font-medium font-mono-tech">{memo.allottedDate}</p>
            </div>
          </div>

          <div className="flex items-start gap-3">
            <CheckCircle2 className="w-4 h-4 text-[#ADE8F4] mt-0.5 shrink-0" />
            <div>
              <p className="text-[10px] text-[#8D99AE]">Seat Category</p>
              <span
                className="inline-block px-2 py-0.5 text-[10px] font-bold rounded-md mt-0.5"
                style={{ background: 'rgba(0, 245, 212, 0.1)', color: '#00F5D4', border: '1px solid rgba(0, 245, 212, 0.2)' }}
              >
                {memo.seatCategory}
              </span>
            </div>
          </div>

          <div className="flex items-start gap-3">
            <div className="w-4 h-4 flex items-center justify-center shrink-0 mt-0.5">
              <span className="text-[10px] text-[#ADE8F4]">ID</span>
            </div>
            <div>
              <p className="text-[10px] text-[#8D99AE]">Student ID</p>
              <p className="text-xs text-white font-medium font-mono-tech">{studentProfile.admissionNo}</p>
            </div>
          </div>
        </div>
      </div>

      <button
        onClick={() => showToast('Downloading allotment memo PDF...', 'success')}
        className="w-full py-3.5 rounded-xl font-bold text-xs text-black transition-all active:scale-[0.98] flex items-center justify-center gap-2"
        style={{ background: '#00F5D4' }}
      >
        <FileDown className="w-4 h-4" />
        Download Allotment Memo PDF
      </button>

      <p className="text-[10px] text-[#8D99AE] text-center px-4">
        This document is issued by Mahatma Gandhi University and is valid for the current academic session.
      </p>
    </div>
  );
}
