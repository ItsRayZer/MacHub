import { useState, useMemo, useCallback, useRef, useEffect } from 'react';
import { useSettingsStore } from '../../store/settingsStore';
import { BookOpen, GraduationCap, Award, TrendingUp, TrendingDown, AlertTriangle, Edit, Upload, Smile } from 'lucide-react';
import { getStorage, ref, uploadBytesResumable, getDownloadURL, deleteObject } from 'firebase/storage';
import { sanitizePercentage } from '../../utils/sanitizePercentage';
import AvatarPicker from './AvatarPicker';

export default function ProfilePage({ storeData, firestoreDb, rankingsData, securityConfig }) {
  const [activeTab, setActiveTab] = useState('attendance');
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [isAvatarPickerOpen, setIsAvatarPickerOpen] = useState(false);
  const [selectedAvatar, setSelectedAvatar] = useState(null); // local override avatar

  // Settings store actions
  const openSettings = useSettingsStore((s) => s.openSettings);
  const showToast = useSettingsStore((s) => s.showToast);
  
  // Local state for profile edits
  const [displayName, setDisplayName] = useState('');
  const [customBio, setCustomBio] = useState('');
  const [isSaving, setIsSaving] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  
  const fileInputRef = useRef(null);
  const storage = getStorage();

  // Load initial student details
  const student = useMemo(() => {
    const data = storeData?.profile?.data || {};
    return {
      name: data.name || 'Student Name',
      admissionNo: data.admissionNo || 'MGU2023BCA0129',
      course: data.course || 'BCA',
      batch: data.batch || '2023-2026',
      semester: data.semester || '4',
      division: data.division || 'A',
      email: data.email || 'student@mgu.ac.in',
      phone: data.phone || '9876543210',
      college: data.college || 'MAC Ramapuram',
      photoUrl: data.photoUrl || '/avatar.jpg',
      isClassRep: data.isClassRep || false,
      customBio: data.customBio || '',
      dob: data.dob || '',
      bloodGroup: data.bloodGroup || data.blood_group || '',
      aadhar: data.aadhar || data.aadhaar || '',
      guardianName: data.guardianName || data.fatherName || '',
      guardianPhone: data.guardianPhone || data.parentPhone || '',
      address: data.address || data.permanentAddress || '',
      commAddress: data.commAddress || data.presentAddress || '',
    };
  }, [storeData]);

  // Sync display name and custom bio local state
  useEffect(() => {
    if (student.name) setDisplayName(student.name);
    if (student.customBio) setCustomBio(student.customBio);
  }, [student]);

  // Privacy check helper
  const shouldShowPersonalData = useCallback(() => {
    if (!securityConfig || securityConfig.isProfileClaimed === false) return true;
    if (!securityConfig.pinHash) return true;
    const localToken = localStorage.getItem('machub_device_token');
    const tokens = securityConfig.deviceTokens || [];
    if (localToken && tokens.includes(localToken)) return true;
    return false;
  }, [securityConfig]);

  // Calculate live aggregate attendance
  const aggregate = useMemo(() => {
    const rawList = storeData?.attendanceSubjectWise?.data || [];
    if (!rawList.length) {
      return { percentage: '0.00', status: 'No Data', color: '#8D99AE' };
    }
    const total = rawList.reduce((sum, s) => sum + sanitizePercentage(s["Total %"] || s.percentage), 0);
    const avg = (total / rawList.length).toFixed(2);
    const numAvg = parseFloat(avg);
    return {
      percentage: avg,
      status: numAvg >= 75 ? 'Safe Range' : numAvg >= 65 ? 'Warning' : 'Critical',
      color: numAvg >= 75 ? '#00F5D4' : numAvg >= 65 ? '#FFB703' : '#ef4444',
    };
  }, [storeData]);

  // Map live attendance records
  const attendanceRecords = useMemo(() => {
    const rawList = storeData?.attendanceSubjectWise?.data || [];
    return rawList.map((item, index) => {
      const percentage = sanitizePercentage(item["Total %"] || item.percentage);
      return {
        subjectId: String(index),
        subjectName: item.subjectName || item.subject || item.Subjects || 'Subject',
        subjectCode: item.subjectCode || item.code || '',
        totalClasses: parseInt(item.totalHours || item.total || '0'),
        attendedClasses: parseInt(item.presentHours || item.present || '0'),
        percentage: percentage.toFixed(2),
        status: percentage >= 75 ? 'safe' : percentage >= 65 ? 'warning' : 'critical',
      };
    });
  }, [storeData]);

  // Map live subject lists
  const subjectsList = useMemo(() => {
    const rawList = storeData?.subjects?.data || [];
    return rawList.map((item, index) => ({
      id: String(index),
      name: item.name || item.subjectName || 'Course Unit',
      code: item.code || item.subjectCode || 'MG2CC',
      type: item.type || (item.name?.toLowerCase().includes('lab') ? 'Lab' : 'Core'),
    }));
  }, [storeData]);

  // Parse assessment marks
  const assessmentMarks = useMemo(() => {
    const rawList = storeData?.assessment?.data?.subjects || [];
    return rawList.map((sub, index) => {
      // Find internal score from rows
      const rows = sub.rows || [];
      const testRow = rows.find(r => r["Test / Assignment"]?.toLowerCase().includes('internal') || r["Test"]?.toLowerCase().includes('internal'));
      const score = testRow ? parseFloat(testRow["Obtained Marks"] || testRow["Marks"] || '0') : 0;
      const maxScore = testRow ? parseFloat(testRow["Max Marks"] || '50') : 50;

      return {
        id: String(index),
        name: sub.subject || 'Subject',
        code: sub.code || '',
        internalMarks: score || 0,
        maxInternalMarks: maxScore || 50,
      };
    });
  }, [storeData]);

  // Calculate badges from live records
  const badges = useMemo(() => {
    const list = [];
    const rawList = storeData?.attendanceSubjectWise?.data || [];
    const perfectAttendance = rawList.some(s => sanitizePercentage(s["Total %"] || s.percentage) === 100);
    if (perfectAttendance) list.push({ id: 'perf', emoji: '🥇', title: 'Perfect Attendance' });
    const highAttendance = rawList.some(s => sanitizePercentage(s["Total %"] || s.percentage) > 90);
    if (highAttendance) list.push({ id: 'high', emoji: '📚', title: 'Above 90%' });
    if (student.isClassRep) list.push({ id: 'rep', emoji: '⚡', title: 'Class Rep' });
    list.push({ id: 'actv', emoji: '🎯', title: 'Active Student' });
    return list;
  }, [storeData, student.isClassRep]);

  // Share profile details handler
  const handleShare = useCallback(() => {
    const text = `👤 ${displayName}\n🎓 ${student.course} — Batch ${student.batch}\n📊 Attendance: ${aggregate.percentage}%\n🏛️ ${student.college}\n📱 MacHub App`;
    navigator.clipboard.writeText(text).then(() => {
      showToast('Profile copied to clipboard', 'success');
    });
  }, [displayName, student.course, student.batch, student.college, aggregate.percentage, showToast]);

  // Save edits to Firebase Firestore
  const handleSaveProfile = async (e) => {
    e.preventDefault();
    setIsSaving(true);
    try {
      await firestoreDb.collection('students').doc(student.admissionNo).collection('customProfile').doc('overrides').set({
        displayName: displayName.trim(),
        customBio: customBio.trim(),
        updatedAt: new Date().toISOString()
      }, { merge: true });
      setIsEditModalOpen(false);
      showToast('Profile saved successfully', 'success');
    } catch (err) {
      console.error("Save profile overrides failed:", err);
      showToast('Failed to save changes', 'error');
    } finally {
      setIsSaving(false);
    }
  };

  // Upload custom avatar image to Firebase Storage
  const handleAvatarChange = async (e) => {
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

    try {
      const oldStoragePath = storeData?.profile?.data?.photoStoragePath;
      if (oldStoragePath) {
        try {
          const oldRef = ref(storage, oldStoragePath);
          await deleteObject(oldRef);
        } catch (delErr) {
          console.warn("Old avatar cleanup skipped:", delErr.code);
        }
      }

      const storagePath = `students/${student.admissionNo}/profile/avatar_${Date.now()}`;
      const storageRef = ref(storage, storagePath);
      const uploadTask = uploadBytesResumable(storageRef, file);

      uploadTask.on('state_changed',
        (snapshot) => {
          const progress = (snapshot.bytesTransferred / snapshot.totalBytes) * 100;
          setUploadProgress(Math.round(progress));
        },
        (error) => {
          console.error("Upload avatar failed:", error);
          showToast('Failed to upload image', 'error');
          setIsUploading(false);
        },
        async () => {
          const downloadURL = await getDownloadURL(uploadTask.snapshot.ref);
          await firestoreDb.collection('students').doc(student.admissionNo).collection('customProfile').doc('overrides').set({
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
      console.error("Avatar upload process error:", err);
      showToast('Something went wrong', 'error');
      setIsUploading(false);
    }
  };

  // Render sub-view depending on active tab
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
            
            {attendanceRecords.length > 0 ? (
              <div className="grid grid-cols-2 gap-2">
                {attendanceRecords.map((sub, i) => (
                  <div
                    key={i}
                    className="p-3 liquid-glass rounded-xl transition-all duration-200 hover:scale-[1.02]"
                  >
                    <span className="text-[10px] text-[#8D99AE] block truncate">{sub.subjectName}</span>
                    <span
                      className="text-lg font-bold font-display"
                      style={{
                        color: parseFloat(sub.percentage) >= 75 ? '#00F5D4' : parseFloat(sub.percentage) >= 65 ? '#FFB703' : '#ef4444',
                      }}
                    >
                      {sub.percentage}%
                    </span>
                    <span className="text-[9px] text-[#8D99AE] block mt-0.5 font-mono-tech">
                      {sub.attendedClasses}/{sub.totalClasses} hours
                    </span>
                  </div>
                ))}
              </div>
            ) : (
              <div className="p-8 text-center text-xs text-[#8D99AE] liquid-glass rounded-2xl">
                No attendance records found.
              </div>
            )}
          </div>
        );

      case 'marks':
        return (
          <div className="space-y-2 animate-fadeIn">
            {assessmentMarks.length > 0 ? (
              assessmentMarks.map((sub, i) => (
                <div key={i} className="p-3 liquid-glass rounded-xl flex justify-between items-center">
                  <div className="flex-1 min-w-0">
                    <h4 className="font-semibold text-white text-xs truncate">{sub.name}</h4>
                    <span className="text-[10px] font-mono-tech text-[#8D99AE]">{sub.code || 'University Internal'}</span>
                  </div>
                  <div className="text-right ml-3">
                    <span
                      className="text-sm font-bold font-display"
                      style={{
                        color: sub.internalMarks >= (sub.maxInternalMarks * 0.75) ? '#00F5D4' : sub.internalMarks >= (sub.maxInternalMarks * 0.6) ? '#FFB703' : '#ef4444',
                      }}
                    >
                      {sub.internalMarks}
                    </span>
                    <span className="text-[10px] text-[#8D99AE]">/{sub.maxInternalMarks}</span>
                  </div>
                </div>
              ))
            ) : (
              <div className="p-8 text-center text-xs text-[#8D99AE] liquid-glass rounded-2xl">
                Internal marks tracking details not published yet.
              </div>
            )}
          </div>
        );

      case 'subjects':
        return (
          <div className="grid grid-cols-1 gap-2 animate-fadeIn">
            {subjectsList.length > 0 ? (
              subjectsList.map((sub, i) => (
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
              ))
            ) : (
              <div className="p-8 text-center text-xs text-[#8D99AE] liquid-glass rounded-2xl">
                No subjects registered for this semester.
              </div>
            )}
          </div>
        );

      case 'info':
        const showPersonal = shouldShowPersonalData();
        return (
          <div className="liquid-glass rounded-2xl p-4 space-y-3 text-[#8D99AE] animate-fadeIn">
            {[
              { label: 'Admission Code', value: student.admissionNo },
              { label: 'Course', value: `${student.course} — Batch ${student.batch}` },
              { label: 'Semester', value: `Semester ${student.semester}` },
              { label: 'Division', value: `Div ${student.division}` },
              { label: 'College', value: student.college },
              { label: 'Email', value: student.email, isPersonal: true },
              { label: 'Phone', value: student.phone, isPersonal: true },
              { label: 'Date of Birth', value: student.dob, isPersonal: true },
              { label: 'Blood Group', value: student.bloodGroup, isPersonal: true },
              { label: 'Aadhaar Number', value: student.aadhar, isPersonal: true },
              { label: 'Father\'s Name', value: student.guardianName, isPersonal: true },
              { label: 'Parent\'s Phone', value: student.guardianPhone, isPersonal: true },
              { label: 'Permanent Address', value: student.address, isPersonal: true },
              { label: 'Present Address', value: student.commAddress, isPersonal: true },
            ].map((item, i) => {
              const visible = !item.isPersonal || showPersonal;
              return (
                <div key={i} className={`flex justify-between items-center ${i > 0 ? 'pt-2 border-t border-white/5' : ''}`}>
                  <span className="text-[11px]">{item.label}</span>
                  <span className="font-mono-tech text-xs text-white">
                    {visible ? (item.value || 'N/A') : <span className="text-[#FFB703] flex items-center gap-1 font-semibold">🔒 Set up PIN to view</span>}
                  </span>
                </div>
              );
            })}
          </div>
        );

      default:
        return null;
    }
  }, [activeTab, aggregate, attendanceRecords, assessmentMarks, subjectsList, student]);

  return (
    <div className="min-h-screen text-white font-sans antialiased max-w-lg mx-auto relative pb-8 overflow-hidden bg-black">
      {/* Top sticky header */}
      <div
        className="sticky top-0 z-40 px-4 py-3 flex items-center justify-between"
        style={{
          background: 'rgba(0, 0, 0, 0.75)',
          backdropFilter: 'blur(24px) saturate(180%)',
          WebkitBackdropFilter: 'blur(24px) saturate(180%)',
          borderBottom: '1px solid rgba(255, 255, 255, 0.08)',
          boxShadow: 'inset 0 1px 1px rgba(255, 255, 255, 0.05)',
        }}
      >
        <div className="flex items-center gap-1.5">
          <span className="font-bold text-sm tracking-tight font-display">machub</span>
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
        {/* Profile Stats & Photo */}
        <div className="flex items-center justify-between gap-5">
          {/* ── Avatar with picker button ── */}
          <div className="relative group cursor-pointer" onClick={() => setIsAvatarPickerOpen(true)}>
            <div
              className="w-20 h-20 rounded-full p-[2.5px] relative transition-all duration-300 group-hover:scale-105"
              style={{
                background: selectedAvatar?.accent
                  ? `linear-gradient(135deg, ${selectedAvatar.accent}, #03045E, #FFB703)`
                  : 'linear-gradient(135deg, #00F5D4 0%, #03045E 50%, #FFB703 100%)',
                boxShadow: selectedAvatar?.accent
                  ? `0 0 24px ${selectedAvatar.accent}50`
                  : '0 0 20px rgba(0, 245, 212, 0.3)',
              }}
            >
              <div className="w-full h-full bg-black rounded-full overflow-hidden relative flex items-center justify-center">
                {isUploading ? (
                  <div className="absolute inset-0 bg-black/60 flex flex-col items-center justify-center">
                    <span className="text-[10px] text-[#00F5D4] font-bold font-mono-tech">{uploadProgress}%</span>
                  </div>
                ) : selectedAvatar?.emoji && !selectedAvatar?.src ? (
                  <span className="text-4xl leading-none select-none">{selectedAvatar.emoji}</span>
                ) : (
                  <img
                    src={selectedAvatar?.src || student.photoUrl}
                    alt="Profile"
                    className="w-full h-full object-cover"
                    onError={(e) => { e.target.src = '/avatar.jpg'; }}
                  />
                )}
                {/* hover overlay */}
                <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity flex flex-col items-center justify-center gap-1">
                  <Smile className="w-4 h-4 text-white" />
                  <span className="text-[8px] text-white font-semibold">Change</span>
                </div>
              </div>
            </div>
            <input
              type="file"
              ref={fileInputRef}
              onChange={handleAvatarChange}
              className="hidden"
              accept="image/*"
            />
            {/* online dot */}
            <div className="absolute bottom-0 right-0 w-5 h-5 bg-[#00F5D4] rounded-full border-2 border-black flex items-center justify-center">
              <div className="w-2 h-2 bg-white rounded-full" />
            </div>
          </div>

          <div className="flex-1 flex justify-around text-center">
            <div className="group cursor-default">
              <span className="block font-bold text-base group-hover:text-white transition-colors">
                {subjectsList.length}
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

        {/* Profile Card Header Info */}
        <div className="text-xs space-y-1">
          <h2 className="font-bold text-sm text-white font-display flex items-center gap-1.5">
            {displayName}
            {student.isClassRep && (
              <span className="text-[9px] px-1.5 py-0.5 rounded bg-[#FFB703]/20 border border-[#FFB703]/40 text-[#FFB703] font-bold">
                CR
              </span>
            )}
          </h2>
          <p className="text-[#8D99AE] font-medium">
            {student.course} — Batch {student.batch}
          </p>
          <p className="text-[#8D99AE] text-[11px]">
            {student.college} | Sem {student.semester} | Div {student.division}
          </p>
          {student.customBio ? (
            <p className="text-white pt-1 leading-relaxed text-[11px] font-mono-tech italic opacity-95">
              "{student.customBio}"
            </p>
          ) : (
            <p className="text-[#8D99AE] pt-1 leading-relaxed text-[11px] opacity-70">
              Official MacHub profile for session verification and academic tracking.
            </p>
          )}
        </div>

        {/* Profile edit & share actions */}
        <div className="flex gap-2">
          {securityConfig?.isProfileClaimed === true && !securityConfig?.pinHash && (
            <button
              onClick={() => window.location.hash = `/claim-profile?admissionNumber=${student.admissionNo}`}
              className="flex-1 py-2.5 bg-[#FFB703] hover:bg-[#FFB703]/90 text-black font-bold text-xs rounded-xl transition-all active:scale-[0.98] flex items-center justify-center gap-1.5"
            >
              🔒 Set PIN
            </button>
          )}
          <button
            onClick={() => setIsEditModalOpen(true)}
            className="flex-1 py-2.5 liquid-glass text-white font-semibold text-xs rounded-xl transition-all active:scale-[0.98] hover:bg-white/10 flex items-center justify-center gap-1.5"
          >
            <Edit className="w-3.5 h-3.5" />
            Edit Profile
          </button>
          <button
            onClick={handleShare}
            className="px-4 py-2.5 liquid-glass text-white font-semibold text-xs rounded-xl transition-all active:scale-[0.98] hover:bg-white/10"
          >
            Share Profile
          </button>
        </div>

        {/* Info Grid */}
        <div className="grid grid-cols-3 gap-2">
          <div className="liquid-glass rounded-xl p-3 text-center">
            <BookOpen className="w-4 h-4 text-[#00F5D4] mx-auto mb-1" />
            <span className="text-xs font-bold font-display">{subjectsList.filter((s) => s.type === 'Core').length}</span>
            <span className="text-[9px] text-[#8D99AE] block">Core Subjects</span>
          </div>
          <div className="liquid-glass rounded-xl p-3 text-center">
            <GraduationCap className="w-4 h-4 text-[#FFB703] mx-auto mb-1" />
            <span className="text-xs font-bold font-display">{student.semester}th</span>
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

        {/* Badges Carousel */}
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

        {/* Threshold alert */}
        {parseFloat(aggregate.percentage) < 75 && rawList.length > 0 && (
          <div className="p-3 rounded-xl flex items-center gap-3" style={{ background: 'rgba(255, 183, 3, 0.08)', border: '1px solid rgba(255, 183, 3, 0.2)' }}>
            <AlertTriangle className="w-5 h-5 text-[#FFB703] shrink-0" />
            <div>
              <p className="text-[11px] font-semibold text-[#FFB703]">Attendance Below Threshold</p>
              <p className="text-[10px] text-[#8D99AE]">Your overall attendance is below 75%. Please ensure you meet the minimum requirement.</p>
            </div>
          </div>
        )}

        {/* Tabs navigation */}
        <div className="flex border-b border-white/10 text-center text-xs font-semibold text-[#8D99AE]">
          {['attendance', 'marks', 'subjects', 'info'].map((tab) => (
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

        {/* Tab content view */}
        <div className="pt-2 text-xs min-h-[200px]">{tabContent}</div>

        {/* Quick actions buttons */}
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

      {/* ── Avatar Picker Sheet ── */}
      {isAvatarPickerOpen && (
        <AvatarPicker
          currentSrc={selectedAvatar?.src || selectedAvatar?.emoji || student.photoUrl}
          onSelect={(src, avatarObj) => {
            setSelectedAvatar(avatarObj);
            setIsAvatarPickerOpen(false);
            showToast(`Avatar set to ${avatarObj.label}`, 'success');
          }}
          onClose={() => setIsAvatarPickerOpen(false)}
        />
      )}

      {/* Edit Profile glassmorphic Modal overlay */}
      {isEditModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div
            className="absolute inset-0 bg-black/80 backdrop-blur-md"
            onClick={() => setIsEditModalOpen(false)}
          />
          <div className="w-full max-w-sm liquid-glass-strong rounded-3xl p-6 relative space-y-4 animate-springIn">
            <h3 className="font-bold text-sm text-white font-display">Edit Profile overrides</h3>
            <p className="text-[10px] text-[#8D99AE]">Customise your displayName and customBio locally in MacHub.</p>
            
            <form onSubmit={handleSaveProfile} className="space-y-4 pt-2">
              <div>
                <label className="block text-[10px] text-[#8D99AE] uppercase tracking-wider mb-1 font-bold">Display Name</label>
                <input
                  type="text"
                  value={displayName}
                  onChange={(e) => setDisplayName(e.target.value)}
                  className="w-full bg-black/60 border border-white/10 rounded-xl px-3 py-2.5 text-xs text-white outline-none focus:border-[#00F5D4] transition-colors"
                  placeholder="Enter name"
                  required
                />
              </div>

              <div>
                <label className="block text-[10px] text-[#8D99AE] uppercase tracking-wider mb-1 font-bold">Status Quote / customBio</label>
                <textarea
                  value={customBio}
                  onChange={(e) => setCustomBio(e.target.value)}
                  className="w-full bg-black/60 border border-white/10 rounded-xl px-3 py-2.5 text-xs text-white outline-none focus:border-[#00F5D4] transition-colors h-20 resize-none"
                  placeholder="Enter a status quote..."
                />
              </div>

              <div className="flex gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setIsEditModalOpen(false)}
                  className="flex-1 py-2 bg-white/5 border border-white/10 text-white rounded-xl text-xs font-semibold hover:bg-white/10 transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSaving}
                  className="flex-1 py-2 text-black rounded-xl text-xs font-bold transition-all active:scale-[0.98]"
                  style={{ background: '#00F5D4' }}
                >
                  {isSaving ? 'Saving...' : 'Save Changes'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
