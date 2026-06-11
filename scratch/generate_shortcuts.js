const fs = require('fs');

const SHORTCUTS = [
  { label: 'Attendance', desc: 'Track daily class hours & percentage', icon: '📅', section: 'Attendance', color: '#00d4aa' },
  { label: 'Internal Marks', desc: 'View continuous evaluation grades', icon: '📊', section: 'InternalMark', color: '#4f8ef7' },
  { label: 'Exam Results', desc: 'Check university semester grades', icon: '🎓', section: 'ExamResult', color: '#ffb347' },
  { label: 'Study Material', desc: 'Download lecture notes & PDFs', icon: '📚', section: 'StudyMaterial', color: '#a55eea' },
  { label: 'Assessment', desc: 'Continuous evaluation test grades', icon: '📋', section: 'Assessment', color: '#fd9644' },
  { label: 'Assignment', desc: 'Track pending submissions & deadlines', icon: '📂', section: 'Assignment', color: '#2d98da' },
  { label: 'Seminar', desc: 'Track seminar presentations & scores', icon: '🎙️', section: 'Seminar', color: '#fc5c65' },
  { label: 'Hall Ticket', desc: 'Download university hall ticket', icon: '🎫', section: 'HallTicket', color: '#4b7bec' },
  { label: 'Fee Payment', desc: 'View fee payment history & balances', icon: '💳', section: 'FeePayment', color: '#26de81' },
  { label: 'Allotment Memo', desc: 'View college admission details', icon: '📄', section: 'AllotmentMemo', color: '#eb3b5a' },
  { label: 'Online Class', desc: 'Join scheduled video lectures', icon: '💻', section: 'OnlineClass', color: '#3867d6' },
  { label: 'Online Exam', desc: 'Attend online tests and exams', icon: '✏️', section: 'OnlineExam', color: '#fed330' },
  { label: 'FYUGP', desc: 'Select 4-Year UG Program courses', icon: '🌿', section: 'FYUGP', color: '#20bf6b' },
  { label: 'Grace Mark', desc: 'Sports/extracurricular applications', icon: '🏆', section: 'GraceMark', color: '#fa8231' },
  { label: 'Feedback', desc: 'Submit feedback for faculty & courses', icon: '💬', section: 'Feedback', color: '#a5b1c2' },
  { label: 'Grievance', desc: 'Raise complaints or suggestions', icon: '📬', section: 'Grievance', color: '#778ca3' },
  { label: 'Concession', desc: 'Railway and KSRTC travel concessions', icon: '🪪', section: 'Concession', color: '#45aaf2' },
];

function hexToRgb(hex) {
  const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
  return result ? `${parseInt(result[1], 16)}, ${parseInt(result[2], 16)}, ${parseInt(result[3], 16)}` : '255, 255, 255';
}

let html = `
        <!-- Live Portal Dashboard Section (Redesigned as Shortcuts) -->
        <div class="mb-6">
            <h4 class="text-[10px] font-black text-[#86868b] uppercase tracking-widest mb-3 pl-1 flex items-center gap-1.5">
                <span class="text-xl">⚡</span> QUICK SHORTCUTS
            </h4>
            <div class="grid grid-cols-2 gap-3" id="homePortalDashboard">
`;

for (const sc of SHORTCUTS) {
    const rgb = hexToRgb(sc.color);
    html += `
                <!-- ${sc.label} -->
                <div class="glass-panel p-4 rounded-3xl spring active:scale-95 text-center flex flex-col items-center justify-center gap-2 cursor-pointer"
                     onclick="window.loadPortalSection('${sc.section}', '${sc.label}')"
                     style="background: rgba(255,255,255,0.03); border: 1px solid rgba(255,255,255,0.08);">
                    <div class="w-12 h-12 rounded-[1rem] flex items-center justify-center text-2xl shadow-sm mb-1"
                         style="background: rgba(${rgb}, 0.15); color: ${sc.color}; border: 1px solid rgba(${rgb}, 0.3);">
                        ${sc.icon}
                    </div>
                    <div>
                        <h3 class="text-[13px] font-black tracking-tight text-[#1d1d1f] dark:text-[#f5f5f7]">${sc.label}</h3>
                        <p class="text-[9px] font-bold text-[#86868b] leading-[1.2] mt-0.5">${sc.desc}</p>
                    </div>
                </div>
`;
}

html += `
            </div>
        </div>
`;

fs.writeFileSync('scratch/shortcuts.html', html);
console.log('Generated shortcuts.html');
