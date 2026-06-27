import React, { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import { getStorage, ref, uploadBytesResumable, getDownloadURL, deleteObject } from 'firebase/storage';
import { sanitizePercentage } from '../utils/sanitizePercentage';
import { useToast } from '../hooks/useToast';
import AvatarPicker from './profile/AvatarPicker';

const CONFIG_API_BASE = "http://localhost:3001/api";

const MacHubInstagramProfile = React.memo(({ storeData, firestoreDb, openSectionTrigger, rankingsData }) => {
  const [activeTab, setActiveTab] = useState('attendance');
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [isEditProfileOpen, setIsEditProfileOpen] = useState(false);
  const [activeSettingsAnchor, setActiveSettingsAnchor] = useState('');
  const [isRankingsOpen, setIsRankingsOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [isAvatarPickerOpen, setIsAvatarPickerOpen] = useState(false);
  const [selectedAvatar, setSelectedAvatar] = useState(null);

  const userRankInfo = useMemo(() => {
    if (!rankingsData?.rankings) return null;
    const admNo = storeData?.profile?.data?.admissionNo || '12965';
    return rankingsData.rankings.find(r => String(r.admissionNumber) === String(admNo));
  }, [rankingsData, storeData]);

  const filteredRankings = useMemo(() => {
    if (!rankingsData?.rankings) return [];
    const query = searchQuery.trim().toLowerCase();
    if (!query) return rankingsData.rankings;
    return rankingsData.rankings.filter(student => 
      student.name?.toLowerCase().includes(query) ||
      (student.classNo && String(student.classNo).toLowerCase().includes(query)) ||
      (student.admissionNumber && String(student.admissionNumber).includes(query))
    );
  }, [rankingsData, searchQuery]);

  const [displayName, setDisplayName] = useState(storeData?.profile?.data?.name || '');
  const [customBio, setCustomBio] = useState(storeData?.profile?.data?.customBio || '');
  const [avatarUri, setAvatarUri] = useState(storeData?.profile?.data?.photoUrl || '');
  const [charCount, setCharCount] = useState(storeData?.profile?.data?.customBio?.length || 0);
  const [isSaving, setIsSaving] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [imageError, setImageError] = useState(false);
  
  const fileInputRef = useRef(null);
  const storage = getStorage();
  const { toast, showToast } = useToast();

  const usernameHandle = `@${storeData?.profile?.data?.admissionNo || '12965'}`;
  const courseCategory = `${storeData?.profile?.data?.course || 'BCA'} — Batch ${storeData?.profile?.data?.batch || '2024-2027'}`;

  // Sync state with store data when it changes
  useEffect(() => {
    if (storeData?.profile?.data) {
      if (storeData.profile.data.name) setDisplayName(storeData.profile.data.name);
      if (storeData.profile.data.customBio) {
        setCustomBio(storeData.profile.data.customBio);
        setCharCount(storeData.profile.data.customBio.length);
      }
      if (storeData.profile.data.photoUrl) setAvatarUri(storeData.profile.data.photoUrl);
    }
  }, [storeData]);

  const aggregateAttendance = useMemo(() => {
    const subjects = storeData?.attendanceSubjectWise?.data || [];
    if (!subjects.length) return { percentage: '0.00', status: 'No Data', color: '#71717a' };
    const total = subjects.reduce((sum, s) => sum + sanitizePercentage(s["Total %"] || s.percentage), 0);
    const avg = (total / subjects.length).toFixed(2);
    const numAvg = parseFloat(avg);
    let status = 'Critical';
    let color = '#ef4444';
    if (numAvg >= 75) { status = 'Safe Range'; color = '#00d4aa'; }
    else if (numAvg >= 65) { status = 'Warning'; color = '#f59e0b'; }
    return { percentage: avg, status, color };
  }, [storeData]);

  useEffect(() => {
    if (openSectionTrigger) {
      setActiveSettingsAnchor(openSectionTrigger);
      setIsSettingsOpen(true);
    }
  }, [openSectionTrigger]);

  const earnedBadges = useMemo(() => {
    const badges = [];
    const subjects = storeData?.attendanceSubjectWise?.data || [];
    const perfectAttendance = subjects.some(s => sanitizePercentage(s["Total %"] || s.percentage) === 100);
    if (perfectAttendance) badges.push({ id: 'perf', emoji: '🥇', title: 'Perfect Attendance' });
    const highAttendance = subjects.some(s => sanitizePercentage(s["Total %"] || s.percentage) > 90);
    if (highAttendance) badges.push({ id: 'high', emoji: '📚', title: 'Above 90%' });
    if (storeData?.profile?.data?.isClassRep) badges.push({ id: 'rep', emoji: '⚡', title: 'Class Rep' });
    badges.push({ id: 'actv', emoji: '🎯', title: 'Active Student' });
    return badges;
  }, [storeData]);

  const initials = useMemo(() => {
    const name = displayName || storeData?.profile?.data?.name || 'AS';
    return name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2);
  }, [displayName, storeData]);

  // GHOST FILE DESTROYER: Wipes old avatar from Storage before uploading new one
  const handleAvatarChange = useCallback(async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    
    if (!file.type.startsWith('image/')) {
      showToast('Please select a valid image file', 'error');
      return;
    }
    if (file.size > 5 * 1024 * 1024) {
      showToast('Image must be under 5MB', 'error');
      return;
    }

    setIsUploading(true);
    setUploadProgress(0);
    setImageError(false);

    try {
      const admNo = storeData?.profile?.data?.admissionNo || '12965';
      const oldStoragePath = storeData?.profile?.data?.photoStoragePath;
      
      if (oldStoragePath) {
        try {
          const oldRef = ref(storage, oldStoragePath);
          await deleteObject(oldRef);
        } catch (delErr) {
          console.warn("Old avatar cleanup skipped:", delErr.code);
        }
      }

      const storagePath = `students/${admNo}/profile/avatar_${Date.now()}`;
      const storageRef = ref(storage, storagePath);
      
      const uploadTask = uploadBytesResumable(storageRef, file);
      
      uploadTask.on('state_changed',
        (snapshot) => {
          const progress = (snapshot.bytesTransferred / snapshot.totalBytes) * 100;
          setUploadProgress(Math.round(progress));
        },
        (error) => {
          console.error("Upload failed:", error);
          showToast('Failed to upload image', 'error');
          setIsUploading(false);
        },
        async () => {
          const downloadURL = await getDownloadURL(uploadTask.snapshot.ref);
          setAvatarUri(downloadURL);
          
          await firestoreDb.collection('students').doc(admNo).collection('customProfile').doc('overrides').set({
            photoUrl: downloadURL,
            photoStoragePath: storagePath,
            updatedAt: new Date().toISOString()
          }, { merge: true });
          
          showToast('Profile photo updated', 'success');
          setIsUploading(false);
          setUploadProgress(0);
        }
      );
    } catch (err) {
      console.error("Avatar upload error:", err);
      showToast('Something went wrong', 'error');
      setIsUploading(false);
    }
  }, [storeData, firestoreDb, storage, showToast]);

  const saveProfileChanges = useCallback(async (e) => {
    e.preventDefault();
    setIsSaving(true);
    try {
      const admNo = storeData?.profile?.data?.admissionNo || '12965';
      await firestoreDb.collection('students').doc(admNo).collection('customProfile').doc('overrides').set({
        displayName: displayName.trim(),
        customBio: customBio.trim(),
        updatedAt: new Date().toISOString()
      }, { merge: true });
      setIsEditProfileOpen(false);
      showToast('Profile saved successfully', 'success');
    } catch (err) {
      console.error("Save failed:", err);
      showToast('Failed to save changes', 'error');
    } finally {
      setIsSaving(false);
    }
  }, [displayName, customBio, storeData, firestoreDb, showToast]);

  const handleLogout = useCallback(() => {
    localStorage.clear();
    window.location.reload();
  }, []);

  const handleClearCache = useCallback(async () => {
    try {
      await firestoreDb.clearPersistence();
      showToast('Cache cleared', 'success');
      setTimeout(() => window.location.reload(), 800);
    } catch (err) {
      showToast('Failed to clear cache', 'error');
    }
  }, [firestoreDb, showToast]);

  const tabContent = useMemo(() => {
    switch (activeTab) {
      case 'attendance':
        return (
          <div className="space-y-3 animate-fadeIn">
            <div className="p-4 bg-zinc-900/40 border border-zinc-900 rounded-2xl flex justify-between items-center">
              <div>
                <span className="text-zinc-400 block text-[10px] uppercase font-bold tracking-wider">Aggregate Track</span>
                <span className="text-xl font-bold" style={{ color: aggregateAttendance.color }}>{aggregateAttendance.percentage}%</span>
              </div>
              <div className="text-right">
                <span className="text-[10px] px-2 py-1 rounded-full bg-zinc-800 text-zinc-300 font-medium">{aggregateAttendance.status}</span>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-2">
              {(storeData?.attendanceSubjectWise?.data || []).slice(0, 4).map((sub, i) => (
                <div key={i} className="p-3 bg-zinc-900/30 border border-zinc-900 rounded-xl">
                  <span className="text-[10px] text-zinc-500 block truncate">{sub.name || sub.subject || sub.Subjects || 'General'}</span>
                  <span className="text-sm font-bold" style={{ color: sanitizePercentage(sub["Total %"] || sub.percentage) >= 75 ? '#00d4aa' : '#ef4444' }}>
                    {sanitizePercentage(sub["Total %"] || sub.percentage).toFixed(2)}%
                  </span>
                </div>
              ))}
            </div>
          </div>
        );
      case 'marks':
        return (
          <div className="text-center py-8 text-zinc-500 border border-dashed border-zinc-900 rounded-2xl animate-fadeIn">
            <span className="text-2xl block mb-2">📊</span>
            Internal tracking score sheets linked down completely.
          </div>
        );
      case 'subjects':
        return (
          <div className="grid grid-cols-1 gap-2 animate-fadeIn">
            {(storeData?.subjects?.data || [{name: 'Data Structures', code: 'MG2CCRBCA101'}]).map((sub, i) => (
              <div key={i} className="p-3 bg-zinc-900/30 border border-zinc-900 rounded-xl flex justify-between items-center hover:bg-zinc-900/50 transition-colors">
                <div>
                  <h4 className="font-semibold text-white text-xs">{sub.name}</h4>
                  <span className="text-[10px] font-mono text-zinc-500">{sub.code}</span>
                </div>
                <span className="px-2 py-1 bg-blue-500/10 text-[#3897f0] border border-blue-500/20 rounded-md text-[9px] font-bold">Core Course</span>
              </div>
            ))}
          </div>
        );
      case 'info':
        return (
          <div className="bg-zinc-900/30 border border-zinc-900 rounded-2xl p-4 space-y-2 text-zinc-300 animate-fadeIn">
            <div className="flex justify-between border-b border-zinc-900/50 pb-2">
              <span className="text-zinc-500 text-[11px]">Admission Code</span>
              <span className="font-mono text-xs">{storeData?.profile?.data?.admissionNo || '12965'}</span>
            </div>
            <div className="flex justify-between pt-1">
              <span className="text-zinc-500 text-[11px]">Masked Phone</span>
              <span className="text-xs">*******{storeData?.profile?.data?.phone ? storeData.profile.data.phone.slice(-3) : '242'}</span>
            </div>
            <div className="flex justify-between pt-1">
              <span className="text-zinc-500 text-[11px]">Email Domain</span>
              <span className="text-xs text-zinc-400">{storeData?.profile?.data?.email || 'Not linked'}</span>
            </div>
          </div>
        );
      default:
        return null;
    }
  }, [activeTab, storeData, aggregateAttendance]);

  return (
    <div className="min-h-screen bg-black text-white font-sans antialiased max-w-lg mx-auto border-x border-zinc-900 shadow-2xl relative pb-20 overflow-hidden">
      
      {/* LIQUID GLASS STICKY TOP HEADER */}
      <div className="sticky top-0 z-40 px-4 py-3 flex items-center justify-between"
        style={{
          background: 'rgba(0,0,0,0.65)',
          backdropFilter: 'blur(24px) saturate(180%)',
          WebkitBackdropFilter: 'blur(24px) saturate(180%)',
          borderBottom: '1px solid rgba(255,255,255,0.08)',
          boxShadow: 'inset 0 1px 1px rgba(255,255,255,0.05)'
        }}>
        <div className="flex items-center gap-1.5">
          <span className="font-bold text-sm tracking-tight lowercase">{usernameHandle}</span>
          <span className="text-[#3897f0] text-xs">✓</span>
        </div>
        <div className="flex items-center gap-4">
          <button onClick={() => { setActiveSettingsAnchor(''); setIsSettingsOpen(true); }} 
            className="text-xl transition-transform active:scale-95 hover:opacity-80 cursor-pointer">☰</button>
        </div>
      </div>

      {/* INSTAGRAM CONTAINER BLOCK */}
      <div className="p-4 space-y-5">
        <div className="flex items-center justify-between gap-6">
          {/* PROFILE IMAGE — tap to open avatar picker */}
          <div className="relative group cursor-pointer" onClick={() => setIsAvatarPickerOpen(true)}>
            <div
              className="w-20 h-20 rounded-full p-[2.5px] shadow-lg transition-all duration-300 group-hover:scale-105"
              style={{
                background: selectedAvatar?.accent
                  ? `linear-gradient(135deg, ${selectedAvatar.accent}, #6228d7)`
                  : 'linear-gradient(135deg, #f9ce34 0%, #ee2a7b 50%, #6228d7 100%)',
                boxShadow: selectedAvatar?.accent ? `0 0 20px ${selectedAvatar.accent}50` : undefined,
              }}
            >
              <div className="w-full h-full bg-black rounded-full overflow-hidden relative flex items-center justify-center">
                {isUploading ? (
                  <div className="absolute inset-0 bg-black/70 flex items-center justify-center">
                    <div className="text-[10px] font-bold text-white">{uploadProgress}%</div>
                  </div>
                ) : selectedAvatar?.emoji && !selectedAvatar?.src ? (
                  <span className="text-4xl leading-none select-none">{selectedAvatar.emoji}</span>
                ) : selectedAvatar?.src ? (
                  <img src={selectedAvatar.src} alt="Avatar" className="w-full h-full object-cover" />
                ) : avatarUri && !imageError ? (
                  <img src={avatarUri} alt="Profile" className="w-full h-full object-cover" onError={() => setImageError(true)} />
                ) : (
                  <div className="w-full h-full flex items-center justify-center font-bold text-xl bg-zinc-800 text-zinc-300">{initials}</div>
                )}
                {/* hover overlay */}
                <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity flex flex-col items-center justify-center gap-0.5 rounded-full">
                  <span className="text-base">😊</span>
                  <span className="text-[8px] text-white font-semibold">Change</span>
                </div>
              </div>
            </div>
            {/* small picker badge */}
            <button
              onClick={e => { e.stopPropagation(); setIsAvatarPickerOpen(true); }}
              className="absolute bottom-0 right-0 w-6 h-6 rounded-full flex items-center justify-center text-[11px] shadow-md transition-all active:scale-90 hover:scale-110"
              style={{ background: '#3897f0', border: '2px solid #000' }}
            >
              🎭
            </button>
            <input ref={fileInputRef} type="file" accept="image/*" className="hidden" onChange={handleAvatarChange} />
          </div>

          {/* SYSTEM STATS ARRAY */}
          <div className="flex-1 flex justify-around text-center">
            <div className="group cursor-default">
              <span className="block font-bold text-base group-hover:text-white transition-colors">{storeData?.subjects?.data?.length || 0}</span>
              <span className="text-zinc-500 text-[10px]">Courses</span>
            </div>
            <div className="group cursor-pointer active:scale-95 transition-transform" onClick={() => setIsRankingsOpen(true)}>
              <span className="block font-bold text-base text-[#3897f0] group-hover:text-blue-400 transition-colors">
                {userRankInfo?.rank ? `#${userRankInfo.rank}` : '#--'}
              </span>
              <span className="text-zinc-500 text-[10px]">Rank ({aggregateAttendance.percentage}%)</span>
            </div>
            <div className="group cursor-default">
              <span className="block font-bold text-base text-zinc-300 group-hover:text-white transition-colors">{earnedBadges.length}</span>
              <span className="text-zinc-500 text-[10px]">Awards</span>
            </div>
          </div>
        </div>

        {/* BIO DETAILS DESCRIPTION PANEL */}
        <div className="text-xs space-y-1">
          <h2 className="font-bold text-sm text-white">{displayName}</h2>
          <p className="text-zinc-400 font-medium">{courseCategory}</p>
          <p className="text-zinc-500 text-[11px]">MAC Ramapuram | Sem {storeData?.profile?.data?.semester || '2'} | Div {storeData?.profile?.data?.division || 'A'}</p>
          <p className="text-zinc-300 pt-1 leading-relaxed text-[11px]">{customBio || `Official MacHub profile page generated for session verification parameters.`}</p>
        </div>

        {/* ACTION NAVIGATION LAYER */}
        <div className="flex gap-2">
          <button onClick={() => setIsEditProfileOpen(true)} 
            className="flex-1 py-2.5 bg-zinc-900 hover:bg-zinc-800 text-white font-semibold text-xs rounded-xl transition-all border border-zinc-800/50 active:scale-[0.98] cursor-pointer">
            Edit Profile
          </button>
          <button onClick={() => { 
            navigator.clipboard.writeText(`👤 ${displayName}\n🎓 ${courseCategory}\n📊 Attendance: ${aggregateAttendance.percentage}%\n📱 Machub App`);
            showToast('Profile link copied', 'success');
          }} 
            className="px-4 py-2.5 bg-zinc-900 hover:bg-zinc-800 text-white font-semibold text-xs rounded-xl transition-all border border-zinc-800/50 active:scale-[0.98] cursor-pointer">
            Share Profile
          </button>
        </div>

        {/* CIRCULAR ACCREDITATION HIGHLIGHTS SHEET */}
        <div className="flex gap-4 overflow-x-auto py-2 no-scrollbar border-y border-zinc-900/50">
          {earnedBadges.map((badge) => (
            <div key={badge.id} className="flex flex-col items-center space-y-1 text-center min-w-[64px] flex-shrink-0 group cursor-default">
              <div className="w-12 h-12 rounded-full bg-zinc-900 border border-zinc-800 group-hover:border-zinc-700 transition-all flex items-center justify-center text-xl shadow-inner group-hover:shadow-lg group-hover:scale-105">
                {badge.emoji}
              </div>
              <span className="text-[10px] text-zinc-400 max-w-[64px] truncate font-medium group-hover:text-zinc-300">{badge.title}</span>
            </div>
          ))}
        </div>

        {/* INTERACTIVE TAB SELECTION BAR */}
        <div className="flex border-b border-zinc-900 text-center text-xs font-semibold text-zinc-400">
          {['attendance', 'marks', 'subjects', 'info'].map((tab) => (
            <button key={tab} onClick={() => setActiveTab(tab)} 
              className={`flex-1 pb-3 capitalize transition-all duration-200 cursor-pointer ${activeTab === tab ? 'text-[#3897f0] border-b-2 border-[#3897f0]' : 'hover:text-white'}`}>
              {tab}
            </button>
          ))}
        </div>

        {/* DETAILED ACTIVE COMPONENT WINDOW VIEWPORTS */}
        <div className="pt-2 text-xs min-h-[200px]">
          {tabContent}
        </div>
      </div>

      {/* ── LIQUID GLASS INSTAGRAM-STYLE SLIDE-UP SETTINGS BOTTOM SHEET ── */}
      {isSettingsOpen && (
        <div className="fixed inset-0 z-50 flex items-end animate-slideUp" onClick={() => setIsSettingsOpen(false)}>
          <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" />
          <div className="w-full max-w-lg mx-auto relative rounded-t-3xl max-h-[85vh] overflow-y-auto pb-8 text-xs font-sans"
            style={{
              background: 'rgba(9,9,11,0.85)',
              backdropFilter: 'blur(40px) saturate(200%)',
              WebkitBackdropFilter: 'blur(40px) saturate(200%)',
              borderTop: '1px solid rgba(255,255,255,0.12)',
              boxShadow: 'inset 0 1px 1px rgba(255,255,255,0.08), 0 -8px 32px rgba(0,0,0,0.4)'
            }}
            onClick={(e) => e.stopPropagation()}>
            
            <div className="w-10 h-1 bg-zinc-600 mx-auto my-3 rounded-full cursor-pointer hover:bg-zinc-500 transition-colors" onClick={() => setIsSettingsOpen(false)} />
            
            <div className="px-4 py-2 border-b border-zinc-800/50 flex justify-between items-center"
              style={{ borderColor: 'rgba(255,255,255,0.06)' }}>
              <h3 className="text-sm font-bold">Settings & Portal Configuration</h3>
              <button onClick={() => setIsSettingsOpen(false)} className="text-zinc-400 font-semibold text-[11px] hover:text-white transition-colors cursor-pointer">Done</button>
            </div>

            <div className="p-4 space-y-4">
              {/* SEGMENT 1: DEEP LINKED COMPONENT ANCHORS */}
              <h4 className="text-[10px] font-bold text-zinc-500 uppercase tracking-wider">Synced Portal Documents</h4>
              <div className="space-y-1.5">
                {[
                  { id: 'allotment', label: 'Allotment Memo', icon: '📄' },
                  { id: 'hallticket', label: 'Hall Ticket Matrix', icon: '🎟️' },
                  { id: 'feepayment', label: 'Fee Payment Portals', icon: '💳' },
                  { id: 'feedback', label: 'Official Feedback Form', icon: '💬' },
                  { id: 'grievance', label: 'Grievance Submission Form', icon: '📬' },
                  { id: 'concession', label: 'Student Concession Pass', icon: '🪪' }
                ].map((item) => (
                  <div key={item.id} 
                    className={`p-3.5 rounded-xl flex items-center justify-between transition-all cursor-pointer ${activeSettingsAnchor === item.id ? 'bg-[#3897f0]/10 border border-[#3897f0]/30 text-white' : 'bg-zinc-900/40 border border-zinc-800/50 hover:bg-zinc-800/60 hover:border-zinc-700/50'}`}
                    style={activeSettingsAnchor === item.id ? {} : { background: 'rgba(255,255,255,0.03)', borderColor: 'rgba(255,255,255,0.06)' }}>
                    <div className="flex items-center gap-3"><span className="text-sm">{item.icon}</span><span className="font-semibold text-[11px]">{item.label}</span></div>
                    {activeSettingsAnchor === item.id ? <span className="text-[9px] font-bold bg-[#3897f0] text-white px-2 py-0.5 rounded-full">ACTIVE FROM HOME</span> : <span className="text-zinc-600">❯</span>}
                  </div>
                ))}
              </div>

              {/* SEGMENT 2: CREDENTIAL CONFIGURATION */}
              <h4 className="text-[10px] font-bold text-zinc-500 uppercase tracking-wider pt-2">System Credentials</h4>
              <div className="rounded-xl divide-y divide-zinc-800/50 overflow-hidden"
                style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.06)' }}>
                <div className="p-3 flex justify-between items-center cursor-pointer hover:bg-zinc-800/40 transition-colors">
                  <span className="text-[11px]">🔒 Modify MacHub Application Password</span>
                  <span className="text-zinc-600">❯</span>
                </div>
                <div className="p-3 flex justify-between items-center cursor-pointer hover:bg-zinc-800/40 transition-colors" onClick={handleClearCache}>
                  <span className="text-[11px]">🔄 Clear Local Snapshot Caches</span>
                  <span className="text-[#ffa502] font-medium">Purge</span>
                </div>
              </div>

              {/* SEGMENT 3: DANGER ZONE */}
              <h4 className="text-[10px] font-bold text-[#ff4757] uppercase tracking-wider pt-2">Danger Zone Operations</h4>
              <div className="rounded-xl divide-y divide-zinc-800/50 overflow-hidden"
                style={{ background: 'rgba(239,68,68,0.05)', border: '1px solid rgba(239,68,68,0.15)' }}>
                <div className="p-3 flex justify-between items-center cursor-pointer hover:bg-red-500/10 transition-colors text-red-400 font-medium" onClick={handleLogout}>
                  <span className="text-[11px]">🚪 Terminate Application Session (Logout)</span>
                  <span className="text-[10px]">Exit</span>
                </div>
                <div className="p-3 flex justify-between items-center cursor-pointer hover:bg-red-700/20 transition-colors text-red-600 font-bold">
                  <span className="text-[11px]">⚠️ Wipe Profile & Delete Local Records</span>
                  <span className="text-[10px]">Destroy</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ── LIQUID GLASS INTERACTIVE PROFILE EDITOR BOTTOM SHEET ── */}
      {isEditProfileOpen && (
        <div className="fixed inset-0 z-50 flex items-end animate-slideUp" onClick={() => setIsEditProfileOpen(false)}>
          <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" />
          <form onSubmit={saveProfileChanges} className="w-full max-w-lg mx-auto relative rounded-t-3xl p-6 space-y-4 text-xs font-sans"
            style={{
              background: 'rgba(9,9,11,0.9)',
              backdropFilter: 'blur(40px) saturate(200%)',
              WebkitBackdropFilter: 'blur(40px) saturate(200%)',
              borderTop: '1px solid rgba(255,255,255,0.12)',
              boxShadow: 'inset 0 1px 1px rgba(255,255,255,0.08), 0 -8px 32px rgba(0,0,0,0.4)'
            }}
            onClick={(e) => e.stopPropagation()}>
            
            <div>
              <h3 className="text-sm font-bold">Edit Profile Parameters</h3>
              <p className="text-[11px] text-zinc-500 mt-0.5">Configure public display options saved directly to the network node.</p>
            </div>

            <div className="space-y-3">
              <div>
                <label className="block text-zinc-400 mb-1.5 font-medium text-[11px]">Custom Display Name</label>
                <input type="text" value={displayName} onChange={e => setDisplayName(e.target.value)} 
                  className="w-full bg-zinc-900/80 border border-zinc-800 p-3 rounded-xl text-white outline-none focus:border-[#3897f0] transition-colors text-xs"
                  style={{ background: 'rgba(255,255,255,0.05)', borderColor: 'rgba(255,255,255,0.08)' }} />
              </div>

              <div>
                <div className="flex justify-between items-center mb-1.5">
                  <label className="text-zinc-400 font-medium text-[11px]">Personalized Bio Text</label>
                  <span className="text-[10px] text-zinc-600">{charCount}/150</span>
                </div>
                <textarea maxLength={150} value={customBio} 
                  onChange={e => { setCustomBio(e.target.value); setCharCount(e.target.value.length); }} 
                  rows={3} placeholder="Type a custom bio text matching your profile..." 
                  className="w-full bg-zinc-900/80 border border-zinc-800 p-3 rounded-xl text-white outline-none focus:border-[#3897f0] resize-none transition-colors text-xs"
                  style={{ background: 'rgba(255,255,255,0.05)', borderColor: 'rgba(255,255,255,0.08)' }} />
              </div>

              {/* LOCK BOX PANEL */}
              <div className="p-3 rounded-xl text-zinc-500 space-y-1.5"
                style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.06)' }}>
                <div className="flex justify-between items-center"><span className="text-[11px]">🔒 Verified Admission Identifier</span><span className="font-mono text-[10px] text-zinc-400">{storeData?.profile?.data?.admissionNo || '12965'}</span></div>
                <div className="flex justify-between items-center pt-1"><span className="text-[11px]">🔒 Assigned Program Stream</span><span className="text-[10px] text-zinc-400">{courseCategory}</span></div>
                <p className="text-[9px] text-zinc-600 pt-1 border-t border-zinc-800/50 mt-1">These institutional identities are fetched from EduloomPro and locked down completely.</p>
              </div>
            </div>

            <div className="flex gap-2 pt-2">
              <button type="button" onClick={() => setIsEditProfileOpen(false)} 
                className="flex-1 py-3 bg-zinc-900 border border-zinc-800 rounded-xl font-semibold transition-colors hover:bg-zinc-800 active:scale-[0.98] text-[11px] cursor-pointer"
                style={{ background: 'rgba(255,255,255,0.05)', borderColor: 'rgba(255,255,255,0.08)' }}>
                Discard
              </button>
              <button type="submit" disabled={isSaving} 
                className="flex-1 py-3 bg-[#3897f0] hover:bg-blue-600 font-bold rounded-xl text-white transition-colors active:scale-[0.98] disabled:opacity-50 disabled:cursor-not-allowed text-[11px] cursor-pointer">
                {isSaving ? 'Saving Changes...' : 'Save Changes'}
              </button>
            </div>
          </form>
        </div>
      )}
      {/* ── INSTAGRAM-STYLE FULL-PAGE RANKINGS OVERLAY ── */}
      <div className={`absolute inset-0 z-45 bg-black flex flex-col transition-transform duration-300 ease-out ${isRankingsOpen ? 'translate-x-0' : 'translate-x-full pointer-events-none'}`}>
        {/* HEADER */}
        <div className="px-4 py-3 flex items-center justify-between border-b border-zinc-900 bg-black/90 backdrop-blur-md sticky top-0 z-10">
          <button type="button" onClick={() => { setIsRankingsOpen(false); setSearchQuery(''); }} className="w-8 h-8 flex items-center justify-start text-xl text-zinc-300 hover:text-white active:scale-90 transition-transform cursor-pointer">
            ←
          </button>
          <div className="flex-1 text-center pr-8">
            <h3 className="font-bold text-sm text-white">Rankings</h3>
            <p className="text-[9px] text-zinc-500 font-medium">BCA 2025 • {rankingsData?.rankings?.length || 0} Students</p>
          </div>
        </div>

        {/* SEARCH BAR */}
        <div className="px-4 py-2 bg-black">
          <div className="relative flex items-center bg-zinc-900/60 border border-zinc-900 rounded-xl px-3 py-2 text-xs focus-within:border-zinc-800 transition-colors">
            <span className="text-zinc-500 mr-2">🔍</span>
            <input 
              type="text" 
              value={searchQuery} 
              onChange={(e) => setSearchQuery(e.target.value)} 
              placeholder="Search" 
              className="w-full bg-transparent border-none outline-none text-white text-xs placeholder-zinc-605" 
            />
            {searchQuery && (
              <button type="button" onClick={() => setSearchQuery('')} className="text-zinc-500 hover:text-white ml-2 text-xs cursor-pointer">
                ✕
              </button>
            )}
          </div>
        </div>

        {/* LIST CONTAINER */}
        <div className="flex-1 overflow-y-auto px-4 py-2 divide-y divide-zinc-950/40 no-scrollbar pb-24">
          {filteredRankings.length > 0 ? (
            filteredRankings.map((student) => {
              const isCurrentUser = String(student.admissionNumber) === String(storeData?.profile?.data?.admissionNo || '12965');
              
              // Define Rank badge styling
              let rankBadge = null;
              if (student.attendancePct === null) {
                rankBadge = (
                  <div className="text-[9px] px-2 py-1 bg-zinc-900/50 border border-zinc-800/40 text-zinc-500 rounded-lg font-bold">
                    Pending
                  </div>
                );
              } else if (student.rank === 1) {
                rankBadge = (
                  <div className="flex items-center justify-center w-8 h-8 rounded-full bg-yellow-500/10 text-yellow-500 border border-yellow-500/30 text-base font-bold shadow-[0_0_12px_rgba(234,179,8,0.15)] animate-pulse">
                    🥇
                  </div>
                );
              } else if (student.rank === 2) {
                rankBadge = (
                  <div className="flex items-center justify-center w-8 h-8 rounded-full bg-zinc-400/10 text-zinc-300 border border-zinc-400/30 text-base font-bold">
                    🥈
                  </div>
                );
              } else if (student.rank === 3) {
                rankBadge = (
                  <div className="flex items-center justify-center w-8 h-8 rounded-full bg-amber-700/10 text-amber-600 border border-amber-700/30 text-base font-bold">
                    🥉
                  </div>
                );
              } else {
                rankBadge = (
                  <div className="flex items-center justify-center w-8 h-8 rounded-full bg-zinc-900/80 border border-zinc-800/50 text-zinc-400 text-xs font-bold font-mono">
                    #{student.rank}
                  </div>
                );
              }

              return (
                <div 
                  key={student.admissionNumber} 
                  className={`py-3 flex items-center justify-between gap-3 transition-all ${
                    isCurrentUser 
                      ? 'bg-zinc-900/40 border border-zinc-800/60 rounded-2xl px-3 my-1 shadow-[inset_0_1px_1px_rgba(255,255,255,0.05)]' 
                      : ''
                  }`}
                >
                  {/* AVATAR */}
                  <div className={`w-10 h-10 rounded-full overflow-hidden bg-zinc-850 flex-shrink-0 flex items-center justify-center border relative ${
                    isCurrentUser ? 'border-blue-500/40 shadow-[0_0_8px_rgba(56,151,240,0.2)]' : 'border-zinc-800'
                  }`}>
                    {student.photoUrl ? (
                      <img src={student.photoUrl} alt={student.name} className="w-full h-full object-cover" />
                    ) : (
                      <span className="font-bold text-xs text-zinc-500">
                        {student.name.split(' ').map(n => n[0]).join('').slice(0, 2).toUpperCase()}
                      </span>
                    )}
                  </div>

                  {/* DETAILS */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-1.5">
                      <span className={`font-semibold text-xs truncate ${isCurrentUser ? 'text-white' : 'text-zinc-200'}`}>
                        {student.name}
                      </span>
                      {isCurrentUser && (
                        <span className="text-[8px] bg-[#3897f0]/20 text-[#3897f0] border border-blue-500/20 px-1.5 py-0.5 rounded-full font-black tracking-wider">
                          YOU
                        </span>
                      )}
                    </div>
                    <div className="flex items-center gap-1.5 mt-0.5">
                      <span className="text-[10px] text-zinc-500 font-medium">
                        Class No: {student.classNo || 'N/A'}
                      </span>
                      {student.attendancePct !== null && (
                        <>
                          <span className="text-zinc-700 text-[8px]">•</span>
                          <span className={`text-[10px] font-bold ${
                            student.attendancePct >= 75 ? 'text-[#00d4aa]' : student.attendancePct >= 65 ? 'text-[#f59e0b]' : 'text-[#ef4444]'
                          }`}>
                            {student.attendancePct.toFixed(1)}% attendance
                          </span>
                        </>
                      )}
                    </div>
                  </div>

                  {/* RANK BADGE */}
                  <div className="flex-shrink-0">
                    {rankBadge}
                  </div>
                </div>
              );
            })
          ) : (
            <div className="text-center py-16 text-zinc-650">
              <span className="text-3xl block mb-2">🔍</span>
              <p className="text-xs font-semibold">No students found matching your search</p>
              <p className="text-[10px] text-zinc-500 mt-1">Try entering another name or class number</p>
            </div>
          )}
        </div>
      </div>

      {/* AVATAR PICKER SHEET */}
      {isAvatarPickerOpen && (
        <AvatarPicker
          currentSrc={selectedAvatar?.src || selectedAvatar?.emoji || avatarUri}
          onSelect={(src, avatarObj) => {
            setSelectedAvatar(avatarObj);
            setIsAvatarPickerOpen(false);
            showToast(`Avatar set to ${avatarObj.label} 🎉`, 'success');
          }}
          onClose={() => setIsAvatarPickerOpen(false)}
        />
      )}

      {/* TOAST NOTIFICATION SYSTEM */}
      {toast && (
        <div className="fixed top-4 left-1/2 -translate-x-1/2 z-[60] animate-fadeIn px-4 py-2.5 rounded-full text-xs font-medium shadow-2xl flex items-center gap-2"
          style={{
            background: toast.type === 'error' ? 'rgba(239,68,68,0.9)' : toast.type === 'success' ? 'rgba(0,212,170,0.9)' : 'rgba(56,151,240,0.9)',
            backdropFilter: 'blur(20px) saturate(150%)',
            WebkitBackdropFilter: 'blur(20px) saturate(150%)',
            border: '1px solid rgba(255,255,255,0.15)',
            boxShadow: '0 4px 24px rgba(0,0,0,0.3)'
          }}>
          <span>{toast.type === 'error' ? '⚠️' : toast.type === 'success' ? '✓' : 'ℹ️'}</span>
          {toast.message}
        </div>
      )}
    </div>
  );
});

export default MacHubInstagramProfile;
