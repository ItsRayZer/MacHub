import { useSettingsStore } from '../../store/settingsStore';
import { hallTickets, studentProfile } from '../../data/mockData';
import { QrCode, Calendar, MapPin, Clock, Download, CheckCircle2 } from 'lucide-react';

export default function HallTicketView() {
  const showToast = useSettingsStore((s) => s.showToast);
  const ticket = hallTickets[0];

  return (
    <div className="p-4 pb-8 space-y-4">
      <div
        className="p-3 rounded-xl flex items-center gap-3"
        style={{ background: 'rgba(0, 245, 212, 0.08)', border: '1px solid rgba(0, 245, 212, 0.2)' }}
      >
        <CheckCircle2 className="w-5 h-5 text-[#00F5D4] shrink-0" />
        <div>
          <p className="text-[11px] font-semibold text-[#00F5D4]">Hall Ticket Issued</p>
          <p className="text-[10px] text-[#8D99AE]">Issued on {ticket.issueDate}</p>
        </div>
      </div>

      <div className="liquid-glass rounded-2xl p-5 space-y-4">
        <div className="flex items-center gap-4">
          <div
            className="w-16 h-16 rounded-full p-[2px]"
            style={{ background: 'linear-gradient(135deg, #00F5D4 0%, #FFB703 100%)' }}
          >
            <img src="/avatar.jpg" alt="" className="w-full h-full rounded-full object-cover" />
          </div>
          <div>
            <h4 className="text-sm font-bold text-white">{studentProfile.name}</h4>
            <p className="text-[11px] text-[#8D99AE] font-mono-tech">{studentProfile.admissionNo}</p>
            <p className="text-[10px] text-[#00F5D4]">{studentProfile.course} — Semester {ticket.semester}</p>
          </div>
        </div>

        <div className="flex justify-center py-2">
          <div className="w-32 h-32 rounded-xl flex items-center justify-center" style={{ background: 'white' }}>
            <div className="text-center">
              <QrCode className="w-16 h-16 text-black mx-auto" />
              <span className="text-[8px] text-black font-mono-tech mt-1 block">{ticket.qrData}</span>
            </div>
          </div>
        </div>
      </div>

      <h4 className="text-[11px] font-bold text-[#8D99AE] uppercase tracking-wider px-1">Exam Schedule</h4>
      <div className="space-y-2">
        {ticket.examSchedule.map((exam) => (
          <div key={exam.id} className="liquid-glass rounded-xl p-4 space-y-2">
            <div className="flex justify-between items-start">
              <div className="flex-1 min-w-0">
                <h5 className="text-xs font-bold text-white truncate">{exam.courseName}</h5>
                <p className="text-[10px] text-[#8D99AE] font-mono-tech">{exam.courseCode}</p>
              </div>
              <span
                className="px-2 py-0.5 text-[9px] font-bold rounded-md shrink-0"
                style={{
                  background: exam.session === 'FN' ? 'rgba(0, 245, 212, 0.1)' : 'rgba(255, 183, 3, 0.1)',
                  color: exam.session === 'FN' ? '#00F5D4' : '#FFB703',
                  border: `1px solid ${exam.session === 'FN' ? 'rgba(0, 245, 212, 0.2)' : 'rgba(255, 183, 3, 0.2)'}`,
                }}
              >
                {exam.session}
              </span>
            </div>
            <div className="grid grid-cols-3 gap-2 pt-1">
              <div className="flex items-center gap-1.5">
                <Calendar className="w-3 h-3 text-[#8D99AE]" />
                <span className="text-[10px] text-white font-mono-tech">{exam.examDate}</span>
              </div>
              <div className="flex items-center gap-1.5">
                <Clock className="w-3 h-3 text-[#8D99AE]" />
                <span className="text-[10px] text-white">{exam.time}</span>
              </div>
              <div className="flex items-center gap-1.5">
                <MapPin className="w-3 h-3 text-[#8D99AE]" />
                <span className="text-[10px] text-white truncate">{exam.venue}</span>
              </div>
            </div>
          </div>
        ))}
      </div>

      <button
        onClick={() => showToast('Downloading hall ticket PDF...', 'success')}
        className="w-full py-3.5 rounded-xl font-bold text-xs text-black transition-all active:scale-[0.98] flex items-center justify-center gap-2"
        style={{ background: '#00F5D4' }}
      >
        <Download className="w-4 h-4" />
        Download Hall Ticket PDF
      </button>
    </div>
  );
}
