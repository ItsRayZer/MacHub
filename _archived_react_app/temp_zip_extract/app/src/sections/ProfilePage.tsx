import { useState, useMemo, useCallback } from 'react';
import { useStore } from '@/store/useStore';
import { studentProfile, subjects, attendanceRecords, getAggregateAttendance, getBadges } from '@/data/mockData';
import { BookOpen, GraduationCap, Award, TrendingUp, TrendingDown, AlertTriangle } from 'lucide-react';

type TabType = 'attendance' | 'marks' | 'subjects' | 'info';

export default function ProfilePage() {
  const [activeTab, setActiveTab] = useState<TabType>('attendance');
  const openSettings = useStore((s: { openSettings: () => void }) => s.openSettings);
  const showToast = useStore((s: { showToast: (m: string, t?: 'success' | 'error' | 'info') => void }) => s.showToast);
  const displayName = useStore((s: { displayName: string }) => s.displayName);

  const aggregate = useMemo(() => getAggregateAttendance(), []);
  const badges = useMemo(() => getBadges(), []);

  const handleShare = useCallback(() => {
    const text = `👤 ${displayName}\n🎓 ${studentProfile.course} — Batch ${studentProfile.batch}\n📊 Attendance: ${aggregate.percentage}%\n🏛️ ${studentProfile.college}\n📱 MacHub App`;
    navigator.clipboard.writeText(text).then(() => {
      showToast('Profile copied to clipboard', 'success');
    });
  }, [displayName, aggregate.percentage, showToast]);

  const tabContent = useMemo(() => {
    switch (activeTab) {
      case 'attendance':
        return (
          <div className="space-y-3 animate-fadeIn">
            <div className="p-4 liquid-glass rounded-2xl flex justify-between items-center">
              <div>
                <span className="text-[#8D99AE] block text-[10px] uppercase font-bold tracking-wider">
                  Aggregate Track
                </span>
                <span className="text-2xl font-bold font-display" style={{ color: aggregate.color }}>
                  {aggregate.percentage}%
                </span>
              </div>
              <div className="text-right">
                <span
                  className="text-[10px] px-3 py-1.5 rounded-full font-medium"
                  style={{
                    background: aggregate.color + '15',
                    color: aggregate.color,
                    border: `1px solid ${aggregate.color}30`,
                  }}
                >
                  {aggregate.status}
                </span>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-2">
              {attendanceRecords.slice(0, 6).map((sub, i) => (
                <div
                  key={i}
                  className="p-3 liquid-glass rounded-xl transition-all duration-200 hover:scale-[1.02]"
                >
                  <span className="text-[10px] text-[#8D99AE] block truncate">{sub.subjectCode}</span>
                  <span
                    className="text-lg font-bold font-display"
                    style={{
                      color: sub.percentage >= 75 ? '#00F5D4' : sub.percentage >= 65 ? '#FFB703' : '#ef4444',
                    }}
                  >
                    {sub.percentage}%
                  </span>
                  <span className="text-[9px] text-[#8D99AE] block mt-0.5">
                    {sub.attendedClasses}/{sub.totalClasses} classes
                  </span>
                </div>
              ))}
            </div>
          </div>
        );

      case 'marks':
        return (
          <div className="space-y-2 animate-fadeIn">
            {subjects.map((sub, i) => (
              <div key={i} className="p-3 liquid-glass rounded-xl flex justify-between items-center">
                <div className="flex-1 min-w-0">
                  <h4 className="font-semibold text-white text-xs truncate">{sub.name}</h4>
                  <span className="text-[10px] font-mono-tech text-[#8D99AE]">{sub.code}</span>
                </div>
                <div className="text-right ml-3">
                  <span
                    className="text-sm font-bold font-display"
                    style={{
                      color: sub.internalMarks >= 40 ? '#00F5D4' : sub.internalMarks >= 30 ? '#FFB703' : '#ef4444',
                    }}
                  >
                    {sub.internalMarks}
                  </span>
                  <span className="text-[10px] text-[#8D99AE]">/{sub.maxInternalMarks}</span>
                </div>
              </div>
            ))}
          </div>
        );

      case 'subjects':
        return (
          <div className="grid grid-cols-1 gap-2 animate-fadeIn">
            {subjects.map((sub, i) => (
              <div
                key={i}
                className="p-3 liquid-glass rounded-xl flex justify-between items-center transition-all duration-200 hover:scale-[1.01]"
              >
                <div className="flex-1 min-w-0">
                  <h4 className="font-semibold text-white text-xs truncate">{sub.name}</h4>
                  <span className="text-[10px] font-mono-tech text-[#8D99AE]">{sub.code}</span>
                </div>
                <span
                  className="px-2.5 py-1 text-[9px] font-bold rounded-md shrink-0"
                  style={{
                    background:
                      sub.type === 'Core'
                        ? 'rgba(0, 245, 212, 0.1)'
                        : sub.type === 'Lab'
                        ? 'rgba(255, 183, 3, 0.1)'
                        : 'rgba(173, 232, 244, 0.1)',
                    color:
                      sub.type === 'Core' ? '#00F5D4' : sub.type === 'Lab' ? '#FFB703' : '#ADE8F4',
                    border: `1px solid ${
                      sub.type === 'Core'
                        ? 'rgba(0, 245, 212, 0.2)'
                        : sub.type === 'Lab'
                        ? 'rgba(255, 183, 3, 0.2)'
                        : 'rgba(173, 232, 244, 0.2)'
                    }`,
                  }}
                >
                  {sub.type}
                </span>
              </div>
            ))}
          </div>
        );

      case 'info':
        return (
          <div className="liquid-glass rounded-2xl p-4 space-y-3 text-[#8D99AE] animate-fadeIn">
            {[
              { label: 'Admission Code', value: studentProfile.admissionNo },
              { label: 'Course', value: `${studentProfile.course} — Batch ${studentProfile.batch}` },
              { label: 'Semester', value: `Semester ${studentProfile.semester}` },
              { label: 'Division', value: `Div ${studentProfile.division}` },
              { label: 'College', value: studentProfile.college },
              { label: 'Email', value: studentProfile.email },
              { label: 'Phone', value: `*******${studentProfile.phone.slice(-3)}` },
            ].map((item, i) => (
              <div key={i} className={`flex justify-between ${i > 0 ? 'pt-2 border-t border-white/5' : ''}`}>
                <span className="text-[11px]">{item.label}</span>
                <span className="font-mono-tech text-xs text-white">{item.value}</span>
              </div>
            ))}
          </div>
        );

      default:
        return null;
    }
  }, [activeTab, aggregate]);

  return (
    <div className="min-h-screen text-white font-sans antialiased max-w-lg mx-auto relative pb-8 overflow-hidden">
      <div
        className="sticky top-0 z-40 px-4 py-3 flex items-center justify-between"
        style={{
          background: 'rgba(0, 0, 0, 0.65)',
          backdropFilter: 'blur(24px) saturate(180%)',
          WebkitBackdropFilter: 'blur(24px) saturate(180%)',
          borderBottom: '1px solid rgba(255, 255, 255, 0.08)',
          boxShadow: 'inset 0 1px 1px rgba(255, 255, 255, 0.05)',
        }}
      >
        <div className="flex items-center gap-1.5">
          <span className="font-bold text-sm tracking-tight">machub</span>
          <span className="text-[#00F5D4] text-xs">
            <Award className="w-3.5 h-3.5 inline" />
          </span>
        </div>
        <button
          onClick={openSettings}
          className="hamburger-lines"
          aria-label="Open Settings"
        >
          <span />
          <span />
          <span />
        </button>
      </div>

      <div className="p-4 space-y-5">
        <div className="flex items-center justify-between gap-5">
          <div className="relative group cursor-pointer">
            <div
              className="w-20 h-20 rounded-full p-[2.5px]"
              style={{
                background: 'linear-gradient(135deg, #00F5D4 0%, #03045E 50%, #FFB703 100%)',
                boxShadow: '0 0 20px rgba(0, 245, 212, 0.3)',
              }}
            >
              <div className="w-full h-full bg-black rounded-full overflow-hidden relative flex items-center justify-center">
                <img
                  src={studentProfile.photoUrl}
                  alt="Profile"
                  className="w-full h-full object-cover"
                  onError={(e) => {
                    (e.target as HTMLImageElement).style.display = 'none';
                  }}
                />
              </div>
            </div>
            <div className="absolute bottom-0 right-0 w-5 h-5 bg-[#00F5D4] rounded-full border-2 border-black flex items-center justify-center">
              <div className="w-2 h-2 bg-white rounded-full" />
            </div>
          </div>

          <div className="flex-1 flex justify-around text-center">
            <div className="group cursor-default">
              <span className="block font-bold text-base group-hover:text-white transition-colors">
                {subjects.length}
              </span>
              <span className="text-[#8D99AE] text-[10px]">Courses</span>
            </div>
            <div className="group cursor-default">
              <span
                className="block font-bold text-base transition-colors"
                style={{ color: aggregate.color }}
              >
                {aggregate.percentage}%
              </span>
              <span className="text-[#8D99AE] text-[10px]">Attendance</span>
            </div>
            <div className="group cursor-default">
              <span className="block font-bold text-base text-[#00F5D4]">{badges.length}</span>
              <span className="text-[#8D99AE] text-[10px]">Awards</span>
            </div>
          </div>
        </div>

        <div className="text-xs space-y-1">
          <h2 className="font-bold text-sm text-white font-display">{displayName}</h2>
          <p className="text-[#8D99AE] font-medium">
            {studentProfile.course} — Batch {studentProfile.batch}
          </p>
          <p className="text-[#8D99AE] text-[11px]">
            {studentProfile.college} | Sem {studentProfile.semester} | Div {studentProfile.division}
          </p>
          <p className="text-[#8D99AE] pt-1 leading-relaxed text-[11px] opacity-70">
            Official MacHub profile for session verification and academic tracking.
          </p>
        </div>

        <div className="flex gap-2">
          <button
            onClick={() => showToast('Edit Profile coming soon', 'info')}
            className="flex-1 py-2.5 liquid-glass text-white font-semibold text-xs rounded-xl transition-all active:scale-[0.98] hover:bg-white/10"
          >
            Edit Profile
          </button>
          <button
            onClick={handleShare}
            className="px-4 py-2.5 liquid-glass text-white font-semibold text-xs rounded-xl transition-all active:scale-[0.98] hover:bg-white/10"
          >
            Share Profile
          </button>
        </div>

        <div className="grid grid-cols-3 gap-2">
          <div className="liquid-glass rounded-xl p-3 text-center">
            <BookOpen className="w-4 h-4 text-[#00F5D4] mx-auto mb-1" />
            <span className="text-xs font-bold font-display">{subjects.filter((s) => s.type === 'Core').length}</span>
            <span className="text-[9px] text-[#8D99AE] block">Core Subjects</span>
          </div>
          <div className="liquid-glass rounded-xl p-3 text-center">
            <GraduationCap className="w-4 h-4 text-[#FFB703] mx-auto mb-1" />
            <span className="text-xs font-bold font-display">{studentProfile.semester}th</span>
            <span className="text-[9px] text-[#8D99AE] block">Semester</span>
          </div>
          <div className="liquid-glass rounded-xl p-3 text-center">
            {parseFloat(aggregate.percentage) >= 75 ? (
              <TrendingUp className="w-4 h-4 text-[#00F5D4] mx-auto mb-1" />
            ) : (
              <TrendingDown className="w-4 h-4 text-[#ef4444] mx-auto mb-1" />
            )}
            <span
              className="text-xs font-bold font-display"
              style={{ color: parseFloat(aggregate.percentage) >= 75 ? '#00F5D4' : '#ef4444' }}
            >
              {parseFloat(aggregate.percentage) >= 75 ? 'Good' : 'At Risk'}
            </span>
            <span className="text-[9px] text-[#8D99AE] block">Status</span>
          </div>
        </div>

        <div className="flex gap-3 overflow-x-auto py-2 no-scrollbar border-y border-white/5">
          {badges.map((badge) => (
            <div
              key={badge.id}
              className="flex flex-col items-center space-y-1 text-center min-w-[64px] flex-shrink-0 group cursor-default"
            >
              <div className="w-12 h-12 rounded-full bg-white/5 border border-white/10 group-hover:border-[#00F5D4]/30 transition-all flex items-center justify-center text-xl shadow-inner group-hover:shadow-lg group-hover:scale-105">
                {badge.emoji}
              </div>
              <span className="text-[10px] text-[#8D99AE] max-w-[64px] truncate font-medium group-hover:text-white transition-colors">
                {badge.title}
              </span>
            </div>
          ))}
        </div>

        {parseFloat(aggregate.percentage) < 75 && (
          <div className="p-3 rounded-xl flex items-center gap-3" style={{ background: 'rgba(255, 183, 3, 0.08)', border: '1px solid rgba(255, 183, 3, 0.2)' }}>
            <AlertTriangle className="w-5 h-5 text-[#FFB703] shrink-0" />
            <div>
              <p className="text-[11px] font-semibold text-[#FFB703]">Attendance Below Threshold</p>
              <p className="text-[10px] text-[#8D99AE]">Your overall attendance is below 75%. Please ensure you meet the minimum requirement.</p>
            </div>
          </div>
        )}

        <div className="flex border-b border-white/10 text-center text-xs font-semibold text-[#8D99AE]">
          {(['attendance', 'marks', 'subjects', 'info'] as TabType[]).map((tab) => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              className={`flex-1 pb-3 capitalize transition-all duration-200 ${
                activeTab === tab
                  ? 'text-[#00F5D4] border-b-2 border-[#00F5D4]'
                  : 'hover:text-white'
              }`}
            >
              {tab}
            </button>
          ))}
        </div>

        <div className="pt-2 text-xs min-h-[200px]">{tabContent}</div>

        <div className="grid grid-cols-2 gap-2 pt-4">
          <button
            onClick={() => showToast('Revaluation portal opening...', 'info')}
            className="p-3 bg-black/40 border border-white/10 rounded-xl text-[10px] font-semibold text-[#8D99AE] hover:text-white hover:border-[#00F5D4]/30 transition-all text-center"
          >
            Apply for Revaluation
          </button>
          <button
            onClick={() => showToast('Hall Ticket downloading...', 'info')}
            className="p-3 bg-black/40 border border-white/10 rounded-xl text-[10px] font-semibold text-[#8D99AE] hover:text-white hover:border-[#00F5D4]/30 transition-all text-center"
          >
            Download Hall Ticket
          </button>
        </div>
      </div>
    </div>
  );
}
