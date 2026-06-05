/**
 * MacHub — Portal Live Sync API
 * Direct Node.js Reverse Proxy integration.
 * Fully replaces the old Cloudflare Worker → GitHub Actions → Firebase pipeline.
 *
 * Strategy:
 *  - Each portal section is loaded ON DEMAND only when the user taps it.
 *  - Results are cached in localStorage to avoid re-fetching on every tap.
 *  - Admission number persisted in localStorage ('machub_student_id').
 */
(function () {
  'use strict';

  // ── Config ─────────────────────────────────────────────────────────────────
  // Proxy is served from same origin when Node.js serves static files.
  // Falls back to a deployed Render URL if needed.
  const PROXY_BASE = window.MACHUB_PROXY_URL || 
    (['localhost', '127.0.0.1'].includes(window.location.hostname) ? 'http://localhost:3001' : 
     (window.location.protocol === 'file:' ? 'http://localhost:3001' : ''));

  // Local cache TTL: 10 minutes per section
  const CACHE_TTL_MS = 10 * 60 * 1000;

  // ── State ──────────────────────────────────────────────────────────────────
  let currentlyLoading = {};   // { sectionName: true } while in-flight
  let academicSheetOpen = false;

  // ── Admission Number Persistence ───────────────────────────────────────────
  function normalizeId(value) {
    return String(value || '').trim().toLowerCase();
  }

  function findLinkedStudent(profile) {
    const db = window.STUDENTS_DB || [];
    if (!profile || !db.length) return null;
    const admin = normalizeId(profile.adminNo || profile.admissionNo);
    const reg = normalizeId(profile.reg || profile.regNo);
    const classNo = normalizeId(profile.classNo);
    const name = normalizeId(profile.name);

    return db.find(student => {
      return (admin && normalizeId(student.adminNo) === admin) ||
             (reg && normalizeId(student.regNo) === reg) ||
             (classNo && normalizeId(student.classNo) === classNo) ||
             (name && normalizeId(student.name) === name);
    }) || null;
  }

  function saveResolvedStudent(profile, student) {
    if (!profile || !student?.adminNo) return;
    const resolved = {
      ...profile,
      name: profile.name || student.name,
      reg: profile.reg || student.regNo,
      regNo: profile.regNo || student.regNo,
      adminNo: student.adminNo,
      dept: profile.dept || student.department,
      classGroup: profile.classGroup || student.classGroup,
      classNo: profile.classNo || student.classNo,
      semester: profile.semester || student.semester
    };
    try {
      if (window.ExamHubProfile?.save) window.ExamHubProfile.save(resolved);
      else localStorage.setItem('mac_student_info', JSON.stringify(resolved));
      localStorage.setItem('machub_student_id', student.adminNo);
    } catch (err) {
      console.warn('[MacHub API] Could not persist resolved admission number:', err.message);
    }
  }

  function getAdminNo() {
    // Priority: ExamHubProfile → localStorage machub_student_id
    const profile = window.ExamHubProfile?.get() || window.getStudentInfo?.();
    if (profile?.adminNo || profile?.admissionNo) return profile.adminNo || profile.admissionNo;
    const saved = localStorage.getItem('machub_student_id') || '';
    if (saved) return saved;

    const linkedStudent = findLinkedStudent(profile);
    if (linkedStudent?.adminNo) {
      saveResolvedStudent(profile, linkedStudent);
      return linkedStudent.adminNo;
    }

    return '';
  }

  function saveAdminNo(no) {
    if (no) localStorage.setItem('machub_student_id', no);
  }

  // Helper to mask profile details before saving to Firestore or local storage cache
  function maskSensitiveFields(profileData) {
    if (!profileData) return null;
    return {
      name:          profileData.name || '',
      admissionNo:   profileData.admissionNo || '',
      course:        profileData.course || '',
      batch:         profileData.batch || '',
      division:      profileData.division || '',
      semester:      profileData.semester || '',
      department:    profileData.department || '',
      photoUrl:      profileData.photoUrl || '',
      phone:         profileData.phone ? '****' + profileData.phone.slice(-4) : '',
    };
  }

  // ── Cache helpers ───────────────────────────────────────────────────────────
  function cacheKey(section, semester = '') {
    const semSuffix = semester ? `_sem${semester}` : '';
    return `machub_portal_${section}${semSuffix}_${getAdminNo()}`;
  }

  function readCache(section, semester = '') {
    try {
      const raw = localStorage.getItem(cacheKey(section, semester));
      if (!raw) return null;
      const { data, savedAt } = JSON.parse(raw);
      if (Date.now() - savedAt > CACHE_TTL_MS) return null;
      return data;
    } catch (_) { return null; }
  }

  function writeCache(section, data, semester = '') {
    try {
      // Mask profile details from local cache
      let dataToCache = data;
      if (section === 'Profile') {
        const profilePayload = data.payload || (data.sections && data.sections[0]?.data) || data;
        const maskedData = maskSensitiveFields(profilePayload);
        dataToCache = { ...data, payload: { ...profilePayload, ...maskedData, isMasked: true } };
      }
      
      localStorage.setItem(cacheKey(section, semester), JSON.stringify({ data: dataToCache, savedAt: Date.now() }));
      
      // Fire and forget cloud cache write to Firestore
      writeCloudCache(section, dataToCache, semester).catch(err => {
        console.warn('[MacHub API] Background cloud cache write failed:', err.message);
      });
    } catch (_) {}
  }

  function clearCache(section, semester = '') {
    try { localStorage.removeItem(cacheKey(section, semester)); } catch (_) {}
  }

  async function writeCloudCache(section, data, semester = '') {
    const adminNo = getAdminNo();
    if (!window.firebaseFirestore || !window.firestoreDoc || !window.firestoreSetDoc || !adminNo) return;
    try {
      const docRef = window.firestoreDoc(window.firebaseFirestore, 'students', adminNo);
      const sectionKey = semester ? `${section}_sem${semester}` : section;
      const update = {
        [sectionKey]: {
          data,
          cachedAt: new Date().toISOString()
        },
        lastSeen: new Date().toISOString(),
        admissionNumber: adminNo
      };
      await window.firestoreSetDoc(docRef, update, { merge: true });
      console.log(`[MacHub API] Firestore write: ${section} (sem: ${semester})`);
    } catch (err) {
      console.warn('[MacHub API] Firestore write failed:', err.message);
    }
  }

  async function readCloudCache(section, semester = '') {
    const adminNo = getAdminNo();
    if (!window.firebaseFirestore || !window.firestoreDoc || !window.firestoreGetDoc || !adminNo) return null;
    try {
      const docRef = window.firestoreDoc(window.firebaseFirestore, 'students', adminNo);
      const snap = await window.firestoreGetDoc(docRef);
      if (snap.exists()) {
        const docData = snap.data();
        const sectionKey = semester ? `${section}_sem${semester}` : section;
        const cachedSection = docData[sectionKey];
        if (cachedSection && cachedSection.data) {
          return cachedSection.data;
        }
      }
      return null;
    } catch (err) {
      console.warn('[MacHub API] Firestore read failed:', err.message);
      return null;
    }
  }

  // ── Core Fetch — talks to Node.js proxy ────────────────────────────────────
  async function fetchSection(sectionName, force = false, semester = '') {
    const adminNo = getAdminNo();

    if (!adminNo) throw new Error('NO_ADMIN: Set your admission number in Profile first.');

    // Return cache if fresh
    if (!force) {
      const cached = readCache(sectionName, semester);
      if (cached) {
        console.log(`[MacHub API] Cache hit: ${sectionName} (sem: ${semester})`);
        return cached;
      }
      const cloudCached = await readCloudCache(sectionName, semester);
      if (cloudCached) {
        // Write locally without re-writing to cloud (using direct storage to avoid infinite loop)
        localStorage.setItem(cacheKey(sectionName, semester), JSON.stringify({ data: cloudCached, savedAt: Date.now() }));
        console.log(`[MacHub API] Firestore cache hit: ${sectionName} (sem: ${semester})`);
        return cloudCached;
      }
    }

    const loadKey = `${sectionName}_${semester}`;
    if (currentlyLoading[loadKey]) {
      throw new Error('ALREADY_LOADING');
    }

    currentlyLoading[loadKey] = true;
    const t0 = Date.now();

    try {
      let url = `${PROXY_BASE}/api/sync-portal/${encodeURIComponent(sectionName)}?admissionNumber=${encodeURIComponent(adminNo)}`;
      if (semester) {
        url += `&semester=${encodeURIComponent(semester)}`;
      }
      const res = await fetch(url, { signal: AbortSignal.timeout(12000) });

      const json = await res.json();

      if (!res.ok || !json.success) {
        throw new Error(json.error || `HTTP ${res.status}`);
      }

      console.log(`[MacHub API] ✅ ${sectionName} fetched in ${Date.now() - t0}ms`);
      
      // Mask profile details for the cache write, but return the full unmasked json in-memory
      writeCache(sectionName, json, semester);
      return json;

    } catch (err) {
      const cloudCached = await readCloudCache(sectionName, semester);
      if (cloudCached) {
        localStorage.setItem(cacheKey(sectionName, semester), JSON.stringify({ data: cloudCached, savedAt: Date.now() }));
        return cloudCached;
      }
      throw err;
    } finally {
      currentlyLoading[loadKey] = false;
    }
  }

  window.startBackgroundSync = function () {
    const adminNo = getAdminNo();
    if (!adminNo) return Promise.resolve(false);
    
    // Use the non-blocking background queue with 300ms gaps
    if (window.startBackgroundScrapeQueue) {
      window.startBackgroundScrapeQueue(adminNo);
    }
    return Promise.resolve(true);
  };

  window.startBackgroundScrapeQueue = function (adminNo) {
    if (!adminNo) return;
    console.log('[MacHub API] Starting Phase 2 Background Scrape Queue...');
    const queue = ['Assessment', 'Attendance', 'Assignment', 'Seminar'];
    queue.forEach((section, index) => {
      setTimeout(() => {
        console.log(`[MacHub API] Background sync executing for ${section}...`);
        fetchSection(section, true)
          .then(res => {
            console.log(`[MacHub API] Background sync successful for ${section}`);
          })
          .catch(err => {
            console.warn(`[MacHub API] Background sync failed for ${section}:`, err.message);
          });
      }, index * 600);
    });
  };

  // ══════════════════════════════════════════════════════════════════════════
  //  ACADEMIC SHEET — Attendance + Assessment (Internal Marks)
  // ══════════════════════════════════════════════════════════════════════════

  window.openAcademicSheet = function () {
    const sheet    = document.getElementById('academicSheet');
    const backdrop = document.getElementById('academicBackdrop');
    if (!sheet) return;

    if (window.initDraggableSheet) {
      window.initDraggableSheet('academicSheet', 'academicSheetDragHandle', _closeAcademicState);
    }
    if (window.snapSheetOpen) window.snapSheetOpen(sheet);
    else sheet.classList.remove('translate-y-full');

    if (backdrop) backdrop.classList.remove('hidden');
    if (window.hideBottomNav) window.hideBottomNav();
    academicSheetOpen = true;

    renderAcademicSheet();
  };

  function _closeAcademicState() {
    const backdrop = document.getElementById('academicBackdrop');
    if (backdrop) backdrop.classList.add('hidden');
    if (window.showBottomNav) window.showBottomNav();
    academicSheetOpen = false;
  }

  window.closeAcademicSheet = function () {
    const sheet = document.getElementById('academicSheet');
    if (!sheet) return;
    if (window.snapSheetClosed) window.snapSheetClosed(sheet, _closeAcademicState);
    else { sheet.classList.add('translate-y-full'); _closeAcademicState(); }
  };

  // Render the academic sheet content — loads Attendance + Assessment in parallel
  async function renderAcademicSheet() {
    const el = document.getElementById('academicContent');
    if (!el) return;

    const adminNo = getAdminNo();
    if (!adminNo) {
      el.innerHTML = _noAdminHtml();
      return;
    }

    el.innerHTML = _skeletonHtml(3);

    try {
      const [attResult, assessResult] = await Promise.allSettled([
        fetchSection('Attendance'),
        fetchSection('Assessment'),
      ]);

      let html = _syncTimestamp();

      // Attendance
      if (attResult.status === 'fulfilled') {
        html += _renderAttendance(attResult.value.payload);
      } else {
        html += _errorCard('Attendance', attResult.reason.message);
      }

      // Internal Marks
      if (assessResult.status === 'fulfilled') {
        html += _renderAssessment(assessResult.value.payload);
      } else {
        html += _errorCard('Internal Marks', assessResult.reason.message);
      }

      html += _refreshBtn(() => {
        clearCache('Attendance');
        clearCache('Assessment');
        renderAcademicSheet();
      });

      el.innerHTML = html;

    } catch (err) {
      el.innerHTML = _errorCard('Academic Records', err.message) + _retryBtn('window.__renderAcademicSheet()');
    }
  }

  window.__renderAcademicSheet = renderAcademicSheet;

  // ══════════════════════════════════════════════════════════════════════════
  //  PORTAL NAV DRAWER — opens when the portal menu button is tapped
  // ══════════════════════════════════════════════════════════════════════════

  function getPortalStudentName() {
    const profile = window.ExamHubProfile?.get() || window.getStudentInfo?.();
    if (profile?.name) return profile.name;

    const adminNo = getAdminNo();
    if (adminNo) {
      const cachedRaw = localStorage.getItem(`machub_portal_Profile_${adminNo}`);
      if (cachedRaw) {
        try {
          const parsed = JSON.parse(cachedRaw);
          const name = parsed?.data?.payload?.sections?.[0]?.data?.name;
          if (name) return name;
        } catch (e) {}
      }
      const overrides = JSON.parse(localStorage.getItem('machub_profile_overrides_' + adminNo) || '{}');
      if (overrides.name) return overrides.name;
    }
    return 'ABEN SOJAN';
  }

  window.openPortalDrawer = function () {
    const drawer   = document.getElementById('portalNavDrawer');
    const backdrop = document.getElementById('portalNavBackdrop');
    if (!drawer || !backdrop) return;

    const nameEl = document.getElementById('portalDrawerStudentName');
    if (nameEl) {
      nameEl.textContent = getPortalStudentName();
    }

    backdrop.classList.remove('hidden');
    drawer.classList.remove('pointer-events-none');
    backdrop.style.zIndex = '200';
    backdrop.style.pointerEvents = 'auto';
    drawer.style.zIndex = '210';
    drawer.style.pointerEvents = 'auto';
    if (window.hideBottomNav) window.hideBottomNav();
    requestAnimationFrame(() => {
      drawer.style.transform = 'translateY(0)';
    });
  };

  window.closePortalDrawer = function () {
    const drawer   = document.getElementById('portalNavDrawer');
    const backdrop = document.getElementById('portalNavBackdrop');
    if (!drawer || !backdrop) return;
    drawer.style.transform = 'translateY(100%)';
    drawer.classList.add('pointer-events-none');
    drawer.style.pointerEvents = 'none';
    setTimeout(() => {
      backdrop.classList.add('hidden');
      backdrop.style.pointerEvents = 'none';
      if (window.showBottomNav) window.showBottomNav();
    }, 320);
  };

  // Load a specific portal section into the academic sheet
  window.loadPortalSection = function (sectionName, label, semester = '') {
    closePortalDrawer();

    const sheet    = document.getElementById('academicSheet');
    const backdrop = document.getElementById('academicBackdrop');
    const titleEl  = document.querySelector('#academicSheet h3');
    const metaEl   = document.querySelector('#academicSheet [id$="Meta"], #academicSheet p.text-\\[10px\\]');
    const el       = document.getElementById('academicContent');
    if (!el || !sheet) return;

    if (titleEl) titleEl.textContent = label;

    if (window.initDraggableSheet) {
      window.initDraggableSheet('academicSheet', 'academicSheetDragHandle', _closeAcademicState);
    }
    if (window.snapSheetOpen) window.snapSheetOpen(sheet);
    else sheet.classList.remove('translate-y-full');

    if (backdrop) backdrop.classList.remove('hidden');
    if (window.hideBottomNav) window.hideBottomNav();
    academicSheetOpen = true;

    // Show persistent quick-nav menu at the top of the sheet
    const navBarHtml = _renderPortalSheetMenu(sectionName, label);
    el.innerHTML = navBarHtml + _skeletonHtml(4);

    fetchSection(sectionName, false, semester)
      .then(result => {
        let html = navBarHtml;
        html += _syncTimestamp(result.elapsed);
        
        // Render semester selector dropdown/pills if the page returned a list of semesters
        if (result.payload && result.payload.semesters && result.payload.semesters.length > 1) {
          html += _renderSemesterSelector(sectionName, label, result.payload.semesters, semester);
        }

        html += _renderSection(sectionName, result.payload);
        html += _refreshBtn(() => {
          clearCache(sectionName, semester);
          window.loadPortalSection(sectionName, label, semester);
        });
        el.innerHTML = html;

        // If loading Profile, trigger background fetch to get full unmasked details in-memory only
        if (sectionName === 'Profile') {
          console.log('[MacHub API] Fetching live profile details in memory...');
          fetchSection('Profile', true)
            .then(liveResult => {
              // Ensure user is still on Profile tab and drawer is open
              const activeBtn = document.querySelector('.flex.overflow-x-auto .bg-\\[var\\(--mac-blue\\)\\]');
              if (academicSheetOpen && activeBtn && activeBtn.textContent.includes('Profile')) {
                let liveHtml = navBarHtml + _syncTimestamp(liveResult.elapsed) + _renderSection('Profile', liveResult.payload);
                liveHtml += _refreshBtn(() => {
                  clearCache('Profile');
                  window.loadPortalSection('Profile', 'Profile');
                });
                el.innerHTML = liveHtml;
              }
            })
            .catch(err => {
              console.warn('[MacHub API] Failed to fetch live unmasked profile details:', err.message);
            });
        }
      })
      .catch(err => {
        if (err.message === 'NO_ADMIN') {
          el.innerHTML = _noAdminHtml();
          return;
        }
        el.innerHTML = navBarHtml + _errorCard(label, err.message) + `
          <div class="text-center mt-4">
            <button onclick="clearCache_('${sectionName}', '${semester}'); window.loadPortalSection('${sectionName}', '${label}', '${semester}');"
              class="px-6 py-2.5 bg-black/5 dark:bg-white/10 rounded-full text-xs font-bold spring">
              🔄 Retry
            </button>
          </div>`;
      });
  };

  // Render a horizontal scroll bar of all 14 portal sections at the top of the sheet
  function _renderPortalSheetMenu(activeSection, activeLabel) {
    const items = [
      { name: 'Dashboard', label: 'Dashboard', icon: '🏠' },
      { name: 'Profile', label: 'Profile', icon: '👤' },
      { name: 'Attendance', label: 'Attendance', icon: '📅' },
      { name: 'Assessment', label: 'Internal Marks', icon: '📊' },
      { name: 'StudyMaterial', label: 'Study Material', icon: '📚' },
      { name: 'Assignment', label: 'Assignments', icon: '✏️' },
      { name: 'Seminar', label: 'Seminar', icon: '🎤' },
      { name: 'HallTicket', label: 'Hall Ticket', icon: '🎫' },
      { name: 'InternalMark', label: 'Univ. Marks', icon: '📝' },
      { name: 'FeePay', label: 'Fee Payment', icon: '💳' },
      { name: 'AllotmentMemo', label: 'Allotment', icon: '📄' },
      { name: 'FeedBack', label: 'Feedback', icon: '💬' },
      { name: 'Grievance', label: 'Grievance', icon: '📬' },
      { name: 'Concession', label: 'Concession', icon: '🪪' },
      { name: 'ChangePwd', label: 'Change Password', icon: '🔑' },
      { name: 'ExamResult', label: 'Exam Result', icon: '🏆' }
    ];

    let html = `<div class="flex items-center gap-1.5 overflow-x-auto pb-3 mb-4 -mx-6 px-6 no-scrollbar" style="scrollbar-width:none;-ms-overflow-style:none;">`;
    items.forEach(item => {
      const active = item.name === activeSection;
      const bg = active ? 'bg-[var(--mac-blue)] text-white shadow-md shadow-[var(--mac-blue)]/10' : 'bg-black/5 dark:bg-white/5 text-slate-700 dark:text-[#a1a1a6]';
      const border = active ? 'border border-[var(--mac-blue)]/50' : 'border border-white/5';
      html += `
        <button onclick="window.loadPortalSection('${item.name}', '${item.label}')" 
                class="px-3.5 py-2 rounded-full text-xs font-black flex items-center gap-1.5 flex-shrink-0 spring active:scale-95 ${bg} ${border}">
          <span>${item.icon}</span>
          <span>${item.label}</span>
        </button>`;
    });
    html += `</div>`;
    return html;
  }

  // Render semester selector buttons dynamically
  function _renderSemesterSelector(sectionName, label, semesters, currentVal) {
    let html = `<div class="flex gap-2 overflow-x-auto pb-3 mb-4 no-scrollbar justify-center">`;
    semesters.forEach(sem => {
      // Determine if selected
      const isSelected = currentVal ? (sem.value === currentVal) : sem.selected;
      const bg = isSelected ? 'bg-[var(--mac-blue)]/20 text-[var(--mac-blue)] border-[var(--mac-blue)]/40' : 'bg-black/5 dark:bg-white/5 text-[#86868b] border-white/5';
      html += `
        <button onclick="window.loadPortalSection('${sectionName}', '${label}', '${sem.value}')"
                class="px-3.5 py-2 rounded-2xl text-[10px] font-black border uppercase tracking-wider flex-shrink-0 spring active:scale-95 ${bg}">
          ${_esc(sem.text)}
        </button>`;
    });
    html += `</div>`;
    return html;
  }

  // Sync and render the home page portal dashboard counters
  window.syncHomePortalDashboard = function (force = false) {
    const container = document.getElementById('homePortalDashboard');
    if (!container) return;

    fetchSection('Dashboard', force)
      .then(result => {
        if (!result.success || !result.payload?.sections?.[0]?.data) {
          container.innerHTML = `<p class="col-span-2 text-center text-xs font-bold text-[#86868b] py-4">Dashboard data unavailable</p>`;
          return;
        }
        const d = result.payload.sections[0].data;

        // Determine the course name dynamically
        let courseName = '';
        const adminNo = getAdminNo();
        if (adminNo) {
          const cachedRaw = localStorage.getItem(`machub_portal_Profile_${adminNo}`);
          if (cachedRaw) {
            try {
              const parsed = JSON.parse(cachedRaw);
              courseName = parsed?.data?.payload?.sections?.[0]?.data?.course;
            } catch (e) {}
          }
        }
        if (!courseName) {
          const info = window.getStudentInfo?.();
          courseName = info?.dept || 'Bachelor of Computer Applications';
        }

        container.innerHTML = `
          <!-- Active Course Card -->
          <div class="col-span-2 glass-panel p-5 rounded-3xl border border-[var(--mac-blue)]/30 relative overflow-hidden mb-2" style="background: linear-gradient(135deg, rgba(0,113,227,0.08) 0%, rgba(0,0,0,0) 100%);">
            <div class="flex items-center gap-3">
              <span class="text-2xl animate-pulse">🎓</span>
              <div class="flex-1 min-w-0">
                <p class="text-[9px] font-black text-[var(--mac-blue)] uppercase tracking-[0.2em]">Active Course</p>
                <h4 class="text-sm font-black text-white leading-tight mt-1 truncate">${_esc(courseName)}</h4>
              </div>
            </div>
          </div>

          <!-- Study Material -->
          <div class="glass-panel p-4.5 rounded-2xl text-left border border-white/5 flex flex-col justify-between min-h-[110px]">
            <div class="flex items-start justify-between w-full">
              <span class="text-2xl">📚</span>
              <span class="text-[20px] font-black text-[var(--mac-blue)] leading-none">${d.study_material ?? 0}</span>
            </div>
            <div class="mt-2.5">
              <h5 class="text-[11px] font-black text-white">Study Material</h5>
              <button onclick="window.loadPortalSection('StudyMaterial', 'Study Material')" class="text-[9px] font-black text-[var(--mac-blue)] uppercase tracking-wider mt-1 hover:underline flex items-center gap-0.5">
                View Details <span class="text-xs">›</span>
              </button>
            </div>
          </div>

          <!-- Assessment -->
          <div class="glass-panel p-4.5 rounded-2xl text-left border border-white/5 flex flex-col justify-between min-h-[110px]">
            <div class="flex items-start justify-between w-full">
              <span class="text-2xl">📊</span>
              <span class="text-[20px] font-black text-[var(--mac-blue)] leading-none">${d.assessment ?? 0}</span>
            </div>
            <div class="mt-2.5">
              <h5 class="text-[11px] font-black text-white">Assessment</h5>
              <button onclick="window.loadPortalSection('Assessment', 'Assessment')" class="text-[9px] font-black text-[var(--mac-blue)] uppercase tracking-wider mt-1 hover:underline flex items-center gap-0.5">
                View Details <span class="text-xs">›</span>
              </button>
            </div>
          </div>

          <!-- Assignment -->
          <div class="glass-panel p-4.5 rounded-2xl text-left border border-white/5 flex flex-col justify-between min-h-[110px]">
            <div class="flex items-start justify-between w-full">
              <span class="text-2xl">✏️</span>
              <span class="text-[20px] font-black text-[var(--mac-blue)] leading-none">${d.assignment ?? 0}</span>
            </div>
            <div class="mt-2.5">
              <h5 class="text-[11px] font-black text-white">Assignment</h5>
              <button onclick="window.loadPortalSection('Assignment', 'Assignment')" class="text-[9px] font-black text-[var(--mac-blue)] uppercase tracking-wider mt-1 hover:underline flex items-center gap-0.5">
                View Details <span class="text-xs">›</span>
              </button>
            </div>
          </div>

          <!-- Seminar -->
          <div class="glass-panel p-4.5 rounded-2xl text-left border border-white/5 flex flex-col justify-between min-h-[110px]">
            <div class="flex items-start justify-between w-full">
              <span class="text-2xl">🎤</span>
              <span class="text-[20px] font-black text-[var(--mac-blue)] leading-none">${d.seminar ?? 0}</span>
            </div>
            <div class="mt-2.5">
              <h5 class="text-[11px] font-black text-white">Seminar</h5>
              <button onclick="window.loadPortalSection('Seminar', 'Seminar')" class="text-[9px] font-black text-[var(--mac-blue)] uppercase tracking-wider mt-1 hover:underline flex items-center gap-0.5">
                View Details <span class="text-xs">›</span>
              </button>
            </div>
          </div>

          <!-- Internal Mark -->
          <div class="glass-panel p-4.5 rounded-2xl text-left border border-white/5 flex flex-col justify-between min-h-[110px]">
            <div class="flex items-start justify-between w-full">
              <span class="text-2xl">📝</span>
              <span class="text-[20px] font-black text-[var(--mac-blue)] leading-none">${d.internal_mark ?? 0}</span>
            </div>
            <div class="mt-2.5">
              <h5 class="text-[11px] font-black text-white">Internal Mark</h5>
              <button onclick="window.loadPortalSection('InternalMark', 'Internal Mark')" class="text-[9px] font-black text-[var(--mac-blue)] uppercase tracking-wider mt-1 hover:underline flex items-center gap-0.5">
                View Details <span class="text-xs">›</span>
              </button>
            </div>
          </div>

          <!-- Feed Back -->
          <div class="glass-panel p-4.5 rounded-2xl text-left border border-white/5 flex flex-col justify-between min-h-[110px]">
            <div class="flex items-start justify-between w-full">
              <span class="text-2xl">💬</span>
              <span class="text-[20px] font-black text-[var(--mac-blue)] leading-none">${d.feedback ?? 0}</span>
            </div>
            <div class="mt-2.5">
              <h5 class="text-[11px] font-black text-white">Feed Back</h5>
              <button onclick="window.loadPortalSection('FeedBack', 'Feedback')" class="text-[9px] font-black text-[var(--mac-blue)] uppercase tracking-wider mt-1 hover:underline flex items-center gap-0.5">
                View Details <span class="text-xs">›</span>
              </button>
            </div>
          </div>
        `;
      })
      .catch(err => {
        if (err.message && err.message.includes('NO_ADMIN')) {
          container.innerHTML = `
            <div class="col-span-2 glass-panel p-5 text-center rounded-2xl border border-white/5">
              <p class="text-xs font-bold text-[#86868b]">Admission Number Required</p>
              <p class="text-[9px] font-semibold text-[#86868b] mt-1">Sync your portal data by adding your ID in profile.</p>
            </div>`;
        } else {
          container.innerHTML = `
            <div class="col-span-2 glass-panel p-5 text-center rounded-2xl border border-white/5">
              <p class="text-xs font-bold text-[#86868b]">Sync Failed</p>
              <button onclick="window.syncHomePortalDashboard(true)" class="mt-2 px-4 py-1.5 bg-black/10 dark:bg-white/10 text-xs font-bold rounded-lg spring active:scale-95">🔄 Retry Sync</button>
            </div>`;
        }
      });
  };

  window.clearCache_ = function (sectionName, semester = '') {
    clearCache(sectionName, semester);
  };

  // ══════════════════════════════════════════════════════════════════════════
  //  SECTION RENDERERS
  // ══════════════════════════════════════════════════════════════════════════

  function _renderSection(name, payload) {
    switch (name) {
      case 'Attendance':    return _renderAttendance(payload);
      case 'Assessment':    return _renderAssessment(payload);
      case 'Assignment':    return _renderAssignment(payload);
      case 'StudyMaterial': return _renderStudyMaterial(payload);
      case 'Dashboard':     return _renderDashboardCards(payload);
      case 'Profile':       return _renderProfile(payload);
      case 'Concession':    return _renderConcession(payload);
      case 'ChangePwd':     return _renderChangePassword();
      case 'Grievance':     return _renderGrievance(payload);
      default:              return _renderGeneric(payload);
    }
  }

  function _renderProfile(payload) {
    const live = payload?.sections?.[0]?.data || {};
    const overrides = JSON.parse(localStorage.getItem('machub_profile_overrides_' + getAdminNo()) || '{}');
    const bank = JSON.parse(localStorage.getItem('machub_bank_details_' + getAdminNo()) || '{}');

    // Merge overrides
    const p = { ...live, ...overrides };

    let html = `
      <div class="space-y-6 pb-6">
        <!-- Profile Banner -->
        <div class="glass-panel p-5 rounded-[2rem] flex flex-col items-center text-center relative overflow-hidden border border-white/5">
          <div class="w-20 h-20 rounded-full bg-[var(--mac-blue)]/20 border-2 border-[var(--mac-blue)]/50 flex items-center justify-center text-3xl font-black text-white overflow-hidden mb-3 shadow-lg shadow-[var(--mac-blue)]/10">
            ${p.photoUrl ? `<img src="${_esc(p.photoUrl)}" class="w-full h-full object-cover" />` : `👤`}
          </div>
          <h3 class="text-lg font-black text-[#1d1d1f] dark:text-[#f5f5f7] leading-tight">${_esc(p.name)}</h3>
          <p class="text-[10px] font-black text-[#86868b] uppercase tracking-wider mt-1">${_esc(p.course)}</p>
          <div class="flex gap-2 mt-3">
            <span class="text-[9px] font-extrabold px-3 py-1 bg-black/5 dark:bg-white/5 rounded-full border border-white/5 text-[#86868b]">ADM: ${_esc(p.admissionNo || getAdminNo())}</span>
            <span class="text-[9px] font-extrabold px-3 py-1 bg-black/5 dark:bg-white/5 rounded-full border border-white/5 text-[#86868b]">BATCH: ${_esc(p.batch)}</span>
          </div>
        </div>

        <!-- Academic & Personal Info Grid -->
        <div class="glass-panel p-5 rounded-[2rem] border border-white/5 space-y-4">
          <h4 class="text-xs font-black text-[var(--mac-blue)] uppercase tracking-widest mb-1">📝 Personal &amp; Academic Info</h4>
          
          <div class="grid grid-cols-2 gap-4">
            <div>
              <p class="text-[9px] font-bold text-[#86868b] uppercase tracking-wide">Date of Birth</p>
              <p class="text-xs font-black text-[#1d1d1f] dark:text-[#f5f5f7] mt-0.5">${_esc(p.dob)}</p>
            </div>
            <div>
              <p class="text-[9px] font-bold text-[#86868b] uppercase tracking-wide">Gender</p>
              <p class="text-xs font-black text-[#1d1d1f] dark:text-[#f5f5f7] mt-0.5">${_esc(p.gender)}</p>
            </div>
            <div>
              <p class="text-[9px] font-bold text-[#86868b] uppercase tracking-wide">Mobile Number</p>
              <p class="text-xs font-black text-[#1d1d1f] dark:text-[#f5f5f7] mt-0.5">${_esc(p.phone)} ${overrides.phone ? `<span class="text-[8px] px-1.5 py-0.5 rounded-full bg-[var(--mac-blue)]/10 text-[var(--mac-blue)] ml-1">Custom</span>` : ''}</p>
            </div>
            <div>
              <p class="text-[9px] font-bold text-[#86868b] uppercase tracking-wide">Email ID</p>
              <p class="text-xs font-black text-[#1d1d1f] dark:text-[#f5f5f7] mt-0.5 truncate">${_esc(p.email)} ${overrides.email ? `<span class="text-[8px] px-1.5 py-0.5 rounded-full bg-[var(--mac-blue)]/10 text-[var(--mac-blue)] ml-1">Custom</span>` : ''}</p>
            </div>
            <div>
              <p class="text-[9px] font-bold text-[#86868b] uppercase tracking-wide">Blood Group</p>
              <p class="text-xs font-black text-[#1d1d1f] dark:text-[#f5f5f7] mt-0.5">${_esc(p.bloodGroup || 'Not Set')}</p>
            </div>
            <div>
              <p class="text-[9px] font-bold text-[#86868b] uppercase tracking-wide">Aadhaar Card</p>
              <p class="text-xs font-black text-[#1d1d1f] dark:text-[#f5f5f7] mt-0.5">${_esc(p.aadhar)}</p>
            </div>
            <div>
              <p class="text-[9px] font-bold text-[#86868b] uppercase tracking-wide">Religion &amp; Caste</p>
              <p class="text-xs font-black text-[#1d1d1f] dark:text-[#f5f5f7] mt-0.5">${_esc(p.religion)} · ${_esc(p.caste)}</p>
            </div>
            <div>
              <p class="text-[9px] font-bold text-[#86868b] uppercase tracking-wide">ABC Student ID</p>
              <p class="text-xs font-black text-[#1d1d1f] dark:text-[#f5f5f7] mt-0.5">${_esc(p.abcId || 'Not Set')}</p>
            </div>
          </div>
          
          <div class="pt-2">
            <p class="text-[9px] font-bold text-[#86868b] uppercase tracking-wide">Permanent Address</p>
            <p class="text-xs font-black text-[#1d1d1f] dark:text-[#f5f5f7] mt-0.5 leading-relaxed">${_esc(p.address)} ${overrides.address ? `<span class="text-[8px] px-1.5 py-0.5 rounded-full bg-[var(--mac-blue)]/10 text-[var(--mac-blue)] ml-1">Custom</span>` : ''}</p>
          </div>
        </div>

        <!-- Guardian Info -->
        <div class="glass-panel p-5 rounded-[2rem] border border-white/5 space-y-4">
          <h4 class="text-xs font-black text-[var(--mac-blue)] uppercase tracking-widest mb-1">👨‍👩‍👦 Parent / Guardian Details</h4>
          <div class="grid grid-cols-2 gap-4">
            <div>
              <p class="text-[9px] font-bold text-[#86868b] uppercase tracking-wide">Father Name</p>
              <p class="text-xs font-black text-[#1d1d1f] dark:text-[#f5f5f7] mt-0.5">${_esc(p.guardianName)}</p>
            </div>
            <div>
              <p class="text-[9px] font-bold text-[#86868b] uppercase tracking-wide">Father Phone</p>
              <p class="text-xs font-black text-[#1d1d1f] dark:text-[#f5f5f7] mt-0.5">${_esc(p.guardianPhone)}</p>
            </div>
          </div>
        </div>

        <!-- Bank Details Card -->
        <div class="glass-panel p-5 rounded-[2rem] border border-white/5 space-y-4 relative overflow-hidden">
          <div class="absolute top-4 right-4 text-xs font-black text-emerald-500 bg-emerald-500/10 px-3 py-1 rounded-full uppercase tracking-wider">
            ${bank.accNo ? '🔒 Synced' : '❌ Unset'}
          </div>
          <h4 class="text-xs font-black text-[var(--mac-blue)] uppercase tracking-widest mb-1">💳 Bank Account Details</h4>
          
          ${bank.accNo ? `
            <div class="grid grid-cols-2 gap-4">
              <div>
                <p class="text-[9px] font-bold text-[#86868b] uppercase tracking-wide">Account Holder</p>
                <p class="text-xs font-black text-[#1d1d1f] dark:text-[#f5f5f7] mt-0.5">${_esc(bank.holder)}</p>
              </div>
              <div>
                <p class="text-[9px] font-bold text-[#86868b] uppercase tracking-wide">Bank Name</p>
                <p class="text-xs font-black text-[#1d1d1f] dark:text-[#f5f5f7] mt-0.5">${_esc(bank.bankName)}</p>
              </div>
              <div>
                <p class="text-[9px] font-bold text-[#86868b] uppercase tracking-wide">Account Number</p>
                <p class="text-xs font-black text-[#1d1d1f] dark:text-[#f5f5f7] mt-0.5">${_esc(bank.accNo)}</p>
              </div>
              <div>
                <p class="text-[9px] font-bold text-[#86868b] uppercase tracking-wide">IFSC Code</p>
                <p class="text-xs font-black text-[#1d1d1f] dark:text-[#f5f5f7] mt-0.5">${_esc(bank.ifsc)}</p>
              </div>
            </div>
            <div class="pt-2">
              <p class="text-[9px] font-bold text-[#86868b] uppercase tracking-wide">Branch Office</p>
              <p class="text-xs font-black text-[#1d1d1f] dark:text-[#f5f5f7] mt-0.5">${_esc(bank.branch)}</p>
            </div>
          ` : `
            <div class="text-center py-4">
              <p class="text-xs font-bold text-[#86868b]">No bank account linked yet.</p>
              <p class="text-[10px] text-[#86868b]/60 mt-1">Tap below to add your account details.</p>
            </div>
          `}
        </div>

        <!-- Settings Actions -->
        <div class="grid grid-cols-2 gap-3 pt-2">
          <button onclick="window.openEditProfile()" class="w-full py-4 bg-[var(--mac-blue)] text-white rounded-2xl font-bold spring active:scale-95 text-xs">
            ⚙️ Edit Info &amp; Bank
          </button>
          <button onclick="window.loadPortalSection('ChangePwd', 'Change Password')" class="w-full py-4 bg-black/10 dark:bg-white/10 rounded-2xl font-bold spring active:scale-95 text-[#1d1d1f] dark:text-[#f5f5f7] text-xs">
            🔑 Change Portal PW
          </button>
        </div>
      </div>
    `;
    return html;
  }

  function _renderConcession(payload) {
    const data = payload?.sections?.[0]?.data || {};
    const routes = data.routes || [];
    window._concessionTokens = data.tokens || {};

    let html = `
      <div class="space-y-6 pb-6">
        <!-- Bus Pass Ticket Glassmorphism Card -->
        <div class="relative overflow-hidden rounded-[2.5rem] p-6 text-white border border-white/10 shadow-2xl flex flex-col justify-between min-h-[220px]" style="background: linear-gradient(135deg, rgba(30,60,114,0.7) 0%, rgba(42,82,152,0.7) 50%, rgba(20,40,80,0.8) 100%); backdrop-filter: blur(20px);">
          <div class="absolute inset-0 pointer-events-none opacity-10 flex items-center justify-center text-[7rem] font-black select-none">PASS</div>
          <div class="flex justify-between items-start">
            <div>
              <span class="text-[9px] font-black tracking-[0.2em] bg-white/20 px-3 py-1 rounded-full uppercase">KSRTC Concession</span>
              <h3 class="text-lg font-black mt-2 leading-none">TRAVEL PASS</h3>
            </div>
            <div class="text-right">
              <span class="text-[9px] font-black text-white/50 block">STATUS</span>
              <span class="text-[10px] font-black text-emerald-400 uppercase tracking-widest bg-emerald-500/10 px-2 py-0.5 rounded-md mt-1 inline-block">● ACTIVE</span>
            </div>
          </div>

          <!-- Routes Display -->
          <div class="my-5 space-y-2">
            ${routes.map((r, idx) => {
              if (!r.from && !r.to) return '';
              return `
                <div class="flex items-center gap-3">
                  <span class="text-xs font-black bg-white/10 px-2 py-1 rounded-md text-slate-300">R${idx+1}</span>
                  <span class="text-sm font-black truncate max-w-[120px]">${_esc(r.from)}</span>
                  <span class="text-slate-400">➔</span>
                  <span class="text-sm font-black truncate max-w-[120px]">${_esc(r.to)}</span>
                </div>
              `;
            }).filter(Boolean).join('') || `<p class="text-xs text-white/40 italic">No routes specified. Fill routes below to sync.</p>`}
          </div>

          <!-- Bottom Footer Details -->
          <div class="flex justify-between items-end pt-2 border-t border-white/10">
            <div>
              <span class="text-[8px] text-white/50 block">STUDENT ID</span>
              <span class="text-xs font-bold font-mono">${getAdminNo()}</span>
            </div>
            <div>
              <span class="text-[8px] text-white/50 block">EXPIRES</span>
              <span class="text-xs font-bold font-mono">31-MAR-2027</span>
            </div>
          </div>
        </div>

        <!-- Concession Card Routes Editor -->
        <div class="glass-panel p-5 rounded-[2rem] border border-white/5 space-y-4">
          <h4 class="text-xs font-black text-[var(--mac-blue)] uppercase tracking-widest mb-1">🗺️ Edit Travel Paths</h4>
          
          <div class="space-y-3">
            <div class="grid grid-cols-2 gap-3">
              <div>
                <label class="text-[9px] font-bold text-[#86868b] uppercase">Route 1 From</label>
                <input type="text" id="route_from1" value="${_esc(routes[0]?.from)}" class="w-full mt-1 p-3 bg-black/5 dark:bg-white/5 border border-white/5 rounded-xl text-xs font-bold text-[#1d1d1f] dark:text-[#f5f5f7]" />
              </div>
              <div>
                <label class="text-[9px] font-bold text-[#86868b] uppercase">Route 1 To</label>
                <input type="text" id="route_to1" value="${_esc(routes[0]?.to)}" class="w-full mt-1 p-3 bg-black/5 dark:bg-white/5 border border-white/5 rounded-xl text-xs font-bold text-[#1d1d1f] dark:text-[#f5f5f7]" />
              </div>
            </div>
            <div class="grid grid-cols-2 gap-3">
              <div>
                <label class="text-[9px] font-bold text-[#86868b] uppercase">Route 2 From</label>
                <input type="text" id="route_from2" value="${_esc(routes[1]?.from)}" class="w-full mt-1 p-3 bg-black/5 dark:bg-white/5 border border-white/5 rounded-xl text-xs font-bold text-[#1d1d1f] dark:text-[#f5f5f7]" />
              </div>
              <div>
                <label class="text-[9px] font-bold text-[#86868b] uppercase">Route 2 To</label>
                <input type="text" id="route_to2" value="${_esc(routes[1]?.to)}" class="w-full mt-1 p-3 bg-black/5 dark:bg-white/5 border border-white/5 rounded-xl text-xs font-bold text-[#1d1d1f] dark:text-[#f5f5f7]" />
              </div>
            </div>
            <div class="grid grid-cols-2 gap-3">
              <div>
                <label class="text-[9px] font-bold text-[#86868b] uppercase">Route 3 From</label>
                <input type="text" id="route_from3" value="${_esc(routes[2]?.from)}" class="w-full mt-1 p-3 bg-black/5 dark:bg-white/5 border border-white/5 rounded-xl text-xs font-bold text-[#1d1d1f] dark:text-[#f5f5f7]" />
              </div>
              <div>
                <label class="text-[9px] font-bold text-[#86868b] uppercase">Route 3 To</label>
                <input type="text" id="route_to3" value="${_esc(routes[2]?.to)}" class="w-full mt-1 p-3 bg-black/5 dark:bg-white/5 border border-white/5 rounded-xl text-xs font-bold text-[#1d1d1f] dark:text-[#f5f5f7]" />
              </div>
            </div>
            <div class="grid grid-cols-2 gap-3">
              <div>
                <label class="text-[9px] font-bold text-[#86868b] uppercase">Route 4 From</label>
                <input type="text" id="route_from4" value="${_esc(routes[3]?.from)}" class="w-full mt-1 p-3 bg-black/5 dark:bg-white/5 border border-white/5 rounded-xl text-xs font-bold text-[#1d1d1f] dark:text-[#f5f5f7]" />
              </div>
              <div>
                <label class="text-[9px] font-bold text-[#86868b] uppercase">Route 4 To</label>
                <input type="text" id="route_to4" value="${_esc(routes[3]?.to)}" class="w-full mt-1 p-3 bg-black/5 dark:bg-white/5 border border-white/5 rounded-xl text-xs font-bold text-[#1d1d1f] dark:text-[#f5f5f7]" />
              </div>
            </div>
          </div>

          <button onclick="window.submitConcessionRoutes()" class="w-full py-4 bg-[var(--mac-blue)] text-white rounded-2xl font-bold spring active:scale-95 text-xs flex items-center justify-center gap-2 mt-4">
            <span>💾 Sync Travel Routes to Portal</span>
          </button>
        </div>
      </div>
    `;
    return html;
  }

  function _renderChangePassword() {
    let html = `
      <div class="space-y-6 pb-6">
        <div class="glass-panel p-5 rounded-[2rem] border border-white/5 space-y-4">
          <div class="flex items-center gap-3 mb-2">
            <div class="w-10 h-10 rounded-full bg-amber-500/10 text-amber-500 flex items-center justify-center text-xl font-bold">🔑</div>
            <div>
              <h4 class="text-xs font-black text-[#1d1d1f] dark:text-[#f5f5f7] uppercase tracking-widest">Security Settings</h4>
              <p class="text-[10px] text-[#86868b]">Sync your new password to the official portal database.</p>
            </div>
          </div>
          
          <div class="space-y-4 pt-2">
            <div>
              <label class="text-[9px] font-bold text-[#86868b] uppercase">Old Password</label>
              <input type="password" id="pwd_old" placeholder="••••••••" class="w-full mt-1 p-3.5 bg-black/5 dark:bg-white/5 border border-white/5 rounded-xl text-xs font-bold text-[#1d1d1f] dark:text-[#f5f5f7]" />
            </div>
            <div>
              <label class="text-[9px] font-bold text-[#86868b] uppercase">New Password</label>
              <input type="password" id="pwd_new" placeholder="••••••••" class="w-full mt-1 p-3.5 bg-black/5 dark:bg-white/5 border border-white/5 rounded-xl text-xs font-bold text-[#1d1d1f] dark:text-[#f5f5f7]" />
            </div>
            <div>
              <label class="text-[9px] font-bold text-[#86868b] uppercase">Confirm New Password</label>
              <input type="password" id="pwd_confirm" placeholder="••••••••" class="w-full mt-1 p-3.5 bg-black/5 dark:bg-white/5 border border-white/5 rounded-xl text-xs font-bold text-[#1d1d1f] dark:text-[#f5f5f7]" />
            </div>
          </div>

          <button onclick="window.submitPortalPasswordChange()" class="w-full py-4 bg-[var(--mac-blue)] text-white rounded-2xl font-bold spring active:scale-95 text-xs flex items-center justify-center gap-2 mt-4">
            <span>🔐 Update Portal Password</span>
          </button>
        </div>
      </div>
    `;
    return html;
  }

  function _renderGrievance(payload) {
    const data = payload?.sections?.[0]?.data || {};
    const options = data.options || [];
    window._grievanceTokens = data.tokens || {};

    let html = `
      <div class="space-y-6 pb-6">
        <div class="glass-panel p-5 rounded-[2rem] border border-white/5 space-y-4">
          <div class="flex items-center gap-3 mb-2">
            <div class="w-10 h-10 rounded-full bg-red-500/10 text-red-500 flex items-center justify-center text-xl font-bold">📬</div>
            <div>
              <h4 class="text-xs font-black text-[#1d1d1f] dark:text-[#f5f5f7] uppercase tracking-widest">Submit Grievance</h4>
              <p class="text-[10px] text-[#86868b]">File a formal complaint or request to the administration.</p>
            </div>
          </div>
          
          <div class="space-y-4 pt-2">
            <div>
              <label class="text-[9px] font-bold text-[#86868b] uppercase">Submit To</label>
              <select id="grievance_to" class="w-full mt-1 p-3.5 bg-black/5 dark:bg-white/5 border border-white/5 rounded-xl text-xs font-bold text-[#1d1d1f] dark:text-[#f5f5f7] focus:outline-none">
                ${options.map(opt => `<option value="${_esc(opt.value)}">${_esc(opt.text)}</option>`).join('')}
              </select>
            </div>
            <div>
              <label class="text-[9px] font-bold text-[#86868b] uppercase">Subject</label>
              <input type="text" id="grievance_subject" placeholder="Enter grievance subject..." class="w-full mt-1 p-3.5 bg-black/5 dark:bg-white/5 border border-white/5 rounded-xl text-xs font-bold text-[#1d1d1f] dark:text-[#f5f5f7]" />
            </div>
            <div>
              <label class="text-[9px] font-bold text-[#86868b] uppercase">Message Details</label>
              <textarea id="grievance_message" rows="4" placeholder="Describe your grievance in detail..." class="w-full mt-1 p-3.5 bg-black/5 dark:bg-white/5 border border-white/5 rounded-xl text-xs font-bold text-[#1d1d1f] dark:text-[#f5f5f7] resize-none"></textarea>
            </div>
          </div>

          <button onclick="window.submitPortalGrievance()" class="w-full py-4 bg-[var(--mac-blue)] text-white rounded-2xl font-bold spring active:scale-95 text-xs flex items-center justify-center gap-2 mt-4">
            <span>📤 Submit Grievance Request</span>
          </button>
        </div>
      </div>
    `;
    return html;
  }

  // Frontend Submission Handlers
  window.submitConcessionRoutes = async function () {
    const from1 = document.getElementById('route_from1')?.value || '';
    const to1 = document.getElementById('route_to1')?.value || '';
    const from2 = document.getElementById('route_from2')?.value || '';
    const to2 = document.getElementById('route_to2')?.value || '';
    const from3 = document.getElementById('route_from3')?.value || '';
    const to3 = document.getElementById('route_to3')?.value || '';
    const from4 = document.getElementById('route_from4')?.value || '';
    const to4 = document.getElementById('route_to4')?.value || '';
    const tokens = window._concessionTokens || {};

    const button = document.querySelector('[onclick="window.submitConcessionRoutes()"]');
    const originalText = button.innerHTML;
    button.disabled = true;
    button.innerHTML = `<span>⏳ Syncing to Portal...</span>`;

    try {
      const res = await fetch(`${PROXY_BASE}/api/submit-concession`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          admissionNumber: getAdminNo(),
          from1, to1, from2, to2, from3, to3, from4, to4,
          hid_stdid: tokens.hid_stdid
        })
      });

      const json = await res.json();
      if (!res.ok || !json.success) throw new Error(json.error || 'Update failed');

      button.innerHTML = `<span>✅ Sync Successful!</span>`;
      button.style.backgroundColor = '#30d158';
      
      clearCache('Concession');
      setTimeout(() => {
        button.disabled = false;
        button.innerHTML = originalText;
        button.style.backgroundColor = '';
        window.loadPortalSection('Concession', 'Concession Card');
      }, 1000);

    } catch (err) {
      alert('Error updating routes: ' + err.message);
      button.disabled = false;
      button.innerHTML = originalText;
    }
  };

  window.submitPortalPasswordChange = async function () {
    const oldPassword = document.getElementById('pwd_old')?.value || '';
    const newPassword = document.getElementById('pwd_new')?.value || '';
    const confirmPassword = document.getElementById('pwd_confirm')?.value || '';

    if (!oldPassword || !newPassword || !confirmPassword) {
      alert('Please fill in all fields.');
      return;
    }
    if (newPassword !== confirmPassword) {
      alert('New passwords do not match.');
      return;
    }

    const button = document.querySelector('[onclick="window.submitPortalPasswordChange()"]');
    const originalText = button.innerHTML;
    button.disabled = true;
    button.innerHTML = `<span>⏳ Changing Password...</span>`;

    try {
      const res = await fetch(`${PROXY_BASE}/api/change-password`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          admissionNumber: getAdminNo(),
          oldPassword,
          newPassword,
          confirmPassword
        })
      });

      const json = await res.json();
      if (!res.ok || !json.success) throw new Error(json.error || 'Password update failed');

      button.innerHTML = `<span>✅ Password Changed!</span>`;
      button.style.backgroundColor = '#30d158';
      
      document.getElementById('pwd_old').value = '';
      document.getElementById('pwd_new').value = '';
      document.getElementById('pwd_confirm').value = '';

      setTimeout(() => {
        button.disabled = false;
        button.innerHTML = originalText;
        button.style.backgroundColor = '';
        alert('Your portal password has been updated successfully!');
      }, 1000);

    } catch (err) {
      alert('Password change failed: ' + err.message);
      button.disabled = false;
      button.innerHTML = originalText;
    }
  };

  window.submitPortalGrievance = async function () {
    const ddlTo = document.getElementById('grievance_to')?.value || '0';
    const subject = document.getElementById('grievance_subject')?.value || '';
    const message = document.getElementById('grievance_message')?.value || '';
    const tokens = window._grievanceTokens || {};

    if (!subject || !message) {
      alert('Please fill in both subject and message details.');
      return;
    }

    const button = document.querySelector('[onclick="window.submitPortalGrievance()"]');
    const originalText = button.innerHTML;
    button.disabled = true;
    button.innerHTML = `<span>⏳ Submitting...</span>`;

    try {
      const res = await fetch(`${PROXY_BASE}/api/submit-grievance`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          admissionNumber: getAdminNo(),
          ddlTo, subject, message,
          hid_stdid: tokens.hid_stdid,
          hdnBatch: tokens.hdnBatch
        })
      });

      const json = await res.json();
      if (!res.ok || !json.success) throw new Error(json.error || 'Submission failed');

      button.innerHTML = `<span>✅ Submitted Successfully!</span>`;
      button.style.backgroundColor = '#30d158';

      document.getElementById('grievance_subject').value = '';
      document.getElementById('grievance_message').value = '';

      setTimeout(() => {
        button.disabled = false;
        button.innerHTML = originalText;
        button.style.backgroundColor = '';
        alert('Grievance ticket created successfully on portal!');
      }, 1000);

    } catch (err) {
      alert('Submission failed: ' + err.message);
      button.disabled = false;
      button.innerHTML = originalText;
    }
  };

  function _renderAttendance(payload) {
    if (!payload?.sections?.length) return _emptyCard('No attendance records found.');
    const rows = payload.sections[0]?.rows || [];
    if (!rows.length) return _emptyCard('No attendance records found.');

    let html = `<div class="mb-6">
      <h4 class="text-xs font-black text-[var(--mac-blue)] uppercase tracking-widest mb-3 pl-1 flex items-center gap-1.5">
        <span class="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse"></span> ePortal Synced Attendance
      </h4>
      <div class="space-y-3">`;

    rows.forEach(item => {
      const pct = parseFloat(item.percentage) || 0;
      const present = parseInt(item.presentHours) || 0;
      const total = parseInt(item.totalHours) || 0;

      // Color coding
      let color = 'text-[#30d158]'; // Green
      if (pct < 75) {
        color = 'text-[#ff453a]'; // Red
      } else if (pct < 80) {
        color = 'text-[#ff9f0a]'; // Orange/Amber
      }

      // Bunk calculator logic
      let bunkNote = '';
      if (total > 0) {
        if (pct >= 75) {
          const maxTotal = Math.floor(present / 0.75);
          const safeBunks = Math.max(0, maxTotal - total);
          if (safeBunks > 0) {
            bunkNote = `⚡ You can safely bunk next <b>${safeBunks}</b> class${safeBunks > 1 ? 'es' : ''}`;
          } else {
            bunkNote = `⚠️ On the borderline! Attend next class`;
          }
        } else {
          const required = Math.ceil((0.75 * total - present) / 0.25);
          if (required > 0) {
            bunkNote = `🚨 Must attend next <b>${required}</b> class${required > 1 ? 'es' : ''} to reach 75%`;
          }
        }
      }

      html += `
        <div class="glass-panel p-4 rounded-2xl flex items-center justify-between gap-4 border border-white/5 relative overflow-hidden">
          <div class="flex-1 min-w-0">
            <p class="text-sm font-bold text-[#1d1d1f] dark:text-[#f5f5f7] truncate">${_esc(item.subjectName || item.subject || Object.values(item)[0] || '')}</p>
            <p class="text-[10px] font-bold text-[#86868b] mt-1">${present} / ${total} Hours attended</p>
            ${bunkNote ? `<p class="text-[9px] font-bold mt-2 ${pct < 75 ? 'text-red-400' : pct < 80 ? 'text-amber-400' : 'text-emerald-400'} uppercase tracking-wide">${bunkNote}</p>` : ''}
          </div>
          <div class="w-14 h-14 flex-shrink-0 relative">
            <svg class="w-full h-full transform -rotate-90" viewBox="0 0 36 36">
              <path class="text-black/5 dark:text-white/10" stroke-width="3" stroke="currentColor" fill="none" d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831" />
              <path class="${color} transition-all duration-500" stroke-width="3" stroke-dasharray="${pct}, 100" stroke-linecap="round" stroke="currentColor" fill="none" d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831" />
            </svg>
            <div class="absolute inset-0 flex items-center justify-center">
              <span class="text-[10px] font-black text-[#1d1d1f] dark:text-[#f5f5f7]">${Math.round(pct)}%</span>
            </div>
          </div>
        </div>`;
    });

    html += `</div></div>`;
    return html;
  }

  function _renderAssessment(payload) {
    if (!payload?.sections?.length) return _emptyCard('No assessment records found.');
    let html = `<div class="mb-6">
      <h4 class="text-xs font-black text-[var(--mac-blue)] uppercase tracking-widest mb-3">📝 Internal Marks</h4>
      <div class="space-y-4">`;

    payload.sections.forEach(section => {
      if (!section.rows?.length) return;
      html += `<div class="glass-panel p-4 rounded-2xl">
        <p class="text-[10px] font-black text-[#86868b] uppercase tracking-widest mb-3">${_esc(section.subject || '')}</p>
        <div class="grid grid-cols-2 gap-2">`;
        
      const getRowType = (row) => {
        const primaryHeader = section.headers?.[0];
        if (primaryHeader && row[primaryHeader] !== undefined) {
          return String(row[primaryHeader]).trim().toLowerCase();
        }
        for (const k of Object.keys(row)) {
          if (k.toLowerCase().includes('type') || k.toLowerCase().includes('assess')) {
            return String(row[k]).trim().toLowerCase();
          }
        }
        const firstKey = Object.keys(row)[0];
        return firstKey ? String(row[firstKey]).trim().toLowerCase() : '';
      };

      // Sort rows: "model" should go last, "internal" should go first
      const sortedRows = [...section.rows].sort((a, b) => {
        const typeA = getRowType(a);
        const typeB = getRowType(b);
        const isModelA = typeA.includes('model');
        const isModelB = typeB.includes('model');
        const isInternalA = typeA.includes('internal');
        const isInternalB = typeB.includes('internal');

        if (isModelA && !isModelB) return 1;
        if (!isModelA && isModelB) return -1;
        if (isInternalA && !isInternalB) return -1;
        if (!isInternalA && isInternalB) return 1;

        return typeA.localeCompare(typeB);
      });

      sortedRows.forEach(row => {
        const typeKey  = section.headers?.[0] || Object.keys(row).find(k => k.toLowerCase().includes('type')) || Object.keys(row)[0] || '';
        const scoreKey = section.headers?.[1] || Object.keys(row).find(k => k.toLowerCase().includes('score') || k.toLowerCase().includes('obtained')) || Object.keys(row)[1] || '';
        const maxKey   = section.headers?.[2] || Object.keys(row).find(k => k.toLowerCase().includes('max')) || Object.keys(row)[2] || '';
        
        const type  = row[typeKey] || '';
        const score = row[scoreKey] || '';
        const max   = row[maxKey] || '';
        const pass  = row.status || row['P/F'] || row['P / F'] || row['pass/fail'] || '';
        const passColor = pass.toLowerCase().includes('pass') ? '#30d158' : pass ? '#ff3b30' : '#86868b';
        
        html += `<div class="bg-black/5 dark:bg-white/5 rounded-xl p-3">
          <p class="text-[9px] font-bold text-[#86868b] uppercase tracking-wide mb-1">${_esc(type)}</p>
          <p class="text-lg font-black text-[var(--mac-blue)] leading-none">${_esc(score)}<span class="text-[10px] font-bold text-[#86868b]">/${_esc(max)}</span></p>
          ${pass ? `<p class="text-[8px] font-bold mt-1" style="color:${passColor}">${_esc(pass)}</p>` : ''}
        </div>`;
      });
      html += `</div></div>`;
    });

    html += `</div></div>`;
    return html;
  }

  function _renderAssignment(payload) {
    if (!payload?.sections?.length) return _emptyCard('No assignments found.');
    let html = '';
    payload.sections.forEach(section => {
      if (!section.rows?.length) return;
      html += `<div class="mb-6">
        <h4 class="text-xs font-black text-[var(--mac-blue)] uppercase tracking-widest mb-3">
          ${section.label === 'Active' ? '🟢' : '🔴'} ${_esc(section.label)} Assignments
        </h4>
        <div class="space-y-3">`;
      section.rows.forEach(row => {
        const vals = Object.values(row).filter(Boolean);
        html += `<div class="glass-panel p-4 rounded-2xl">
          <p class="text-sm font-bold text-[#1d1d1f] dark:text-[#f5f5f7]">${_esc(vals[0] || '')}</p>
          ${vals[1] ? `<p class="text-[10px] font-bold text-[#86868b] mt-1">${_esc(vals[1])}</p>` : ''}
        </div>`;
      });
      html += `</div></div>`;
    });
    return html || _emptyCard('No assignments found.');
  }

  function _renderStudyMaterial(payload) {
    if (!payload?.sections?.length) return _emptyCard('No study materials found.');
    const rows = payload.sections[0]?.rows || [];
    if (!rows.length) return _emptyCard('No study materials found.');
    let html = `<div class="mb-6">
      <h4 class="text-xs font-black text-[var(--mac-blue)] uppercase tracking-widest mb-3">📚 Study Materials</h4>
      <div class="space-y-3">`;
    rows.forEach(row => {
      const vals = Object.values(row).filter(Boolean);
      const link = row._viewUrl;
      html += `<div class="glass-panel p-4 rounded-2xl flex items-center justify-between gap-4">
        <p class="text-sm font-bold text-[#1d1d1f] dark:text-[#f5f5f7] flex-1">${_esc(vals[0] || '')}</p>
        ${link ? `<a href="${_esc(link)}" target="_blank" class="px-4 py-2 bg-[var(--mac-blue)] text-white rounded-full text-[10px] font-black spring flex-shrink-0">View</a>` : ''}
      </div>`;
    });
    html += `</div></div>`;
    return html;
  }

  function _renderDashboardCards(payload) {
    if (!payload?.sections?.[0]?.data) return _emptyCard('Dashboard data not available.');
    const d = payload.sections[0].data;
    return `<div class="grid grid-cols-2 gap-3 mb-6">
      ${_dashCard('📚', 'Study Material', d.study_material, 'StudyMaterial', 'Study Material')}
      ${_dashCard('✏️', 'Assignment', d.assignment, 'Assignment', 'Assignments')}
      ${_dashCard('📝', 'Assessment', d.assessment, 'Assessment', 'Internal Marks')}
      ${_dashCard('🎤', 'Seminar', d.seminar, 'Seminar', 'Seminars')}
    </div>`;
  }

  function _dashCard(icon, label, count, section, displayName) {
    return `<button onclick="window.loadPortalSection('${section}','${displayName}')"
      class="glass-panel p-5 rounded-2xl text-left spring active:scale-95">
      <div class="text-2xl mb-2">${icon}</div>
      <p class="text-[10px] font-black text-[#86868b] uppercase tracking-widest">${label}</p>
      <p class="text-2xl font-black text-[var(--mac-blue)] mt-1">${count ?? '—'}</p>
    </button>`;
  }

  function _renderGeneric(payload) {
    if (!payload?.sections?.length) return _emptyCard('No data found.');
    let html = '';
    payload.sections.forEach(sec => {
      if (!sec.rows?.length) return;
      html += `<div class="glass-panel rounded-2xl overflow-hidden mb-4"><div class="divide-y divide-black/5 dark:divide-white/5">`;
      sec.rows.forEach(row => {
        const vals = Object.entries(row).filter(([k,v]) => v && !k.startsWith('_'));
        html += `<div class="p-3 space-y-1">`;
        vals.forEach(([k,v]) => {
          html += `<p class="text-[11px]"><span class="font-bold text-[#86868b] uppercase tracking-wide">${_esc(k)}: </span><span class="font-bold text-[#1d1d1f] dark:text-[#f5f5f7]">${_esc(v)}</span></p>`;
        });
        html += `</div>`;
      });
      html += `</div></div>`;
    });
    return html || _emptyCard('No data found.');
  }

  // ══════════════════════════════════════════════════════════════════════════
  //  HELPER HTML FRAGMENTS
  // ══════════════════════════════════════════════════════════════════════════

  function _skeletonHtml(count = 3) {
    let h = '';
    for (let i = 0; i < count; i++) {
      h += `<div class="glass-panel p-4 rounded-2xl mb-3 animate-pulse">
        <div class="h-3 bg-black/10 dark:bg-white/10 rounded-full w-2/3 mb-3"></div>
        <div class="h-3 bg-black/10 dark:bg-white/10 rounded-full w-1/2 mb-2"></div>
        <div class="h-3 bg-black/10 dark:bg-white/10 rounded-full w-3/4"></div>
      </div>`;
    }
    return h;
  }

  function _syncTimestamp(elapsedMs) {
    const t = new Date().toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' });
    const speed = elapsedMs ? ` · ${elapsedMs}ms` : '';
    return `<p class="text-[10px] font-black text-[#86868b] uppercase tracking-widest text-center mb-4">Live data · synced ${t}${speed}</p>`;
  }

  function _refreshBtn(fn) {
    const id = 'machub_refresh_' + Math.random().toString(36).slice(2);
    window[id] = fn;
    return `<div class="text-center mt-6 pb-2">
      <button onclick="window['${id}']()" class="px-6 py-2.5 bg-black/5 dark:bg-white/10 rounded-full text-xs font-bold spring">
        🔄 Refresh
      </button>
    </div>`;
  }

  function _errorCard(label, msg) {
    if (msg === 'ALREADY_LOADING') return _skeletonHtml(2);
    return `<div class="glass-panel p-5 rounded-2xl border border-[#ff3b30]/20 text-center mb-4">
      <div class="text-3xl mb-2">⚠️</div>
      <p class="text-sm font-bold text-[#1d1d1f] dark:text-[#f5f5f7]">${_esc(label)} Unavailable</p>
      <p class="text-[10px] font-bold text-[#86868b] mt-2">${_esc(msg)}</p>
    </div>`;
  }

  function _retryBtn(jsCall) {
    return `<div class="text-center mt-3">
      <button onclick="${jsCall}" class="px-6 py-2.5 bg-black/5 dark:bg-white/10 rounded-full text-xs font-bold spring">Retry</button>
    </div>`;
  }

  function _emptyCard(msg) {
    return `<div class="glass-panel p-6 text-center rounded-2xl mb-4">
      <p class="text-sm font-bold text-[#86868b]">${_esc(msg)}</p>
    </div>`;
  }

  function _noAdminHtml() {
    return `<div class="glass-panel p-6 text-center rounded-[2rem]">
      <div class="w-12 h-12 bg-black/5 dark:bg-white/5 rounded-full flex items-center justify-center text-2xl mx-auto mb-4">⚙️</div>
      <p class="text-sm font-bold text-[#1d1d1f] dark:text-[#f5f5f7]">Admission Number Required</p>
      <p class="text-[10px] font-bold text-[#86868b] mt-2">Go to Profile → Edit and enter your Admission Number to sync portal data.</p>
    </div>`;
  }

  function _esc(str) {
    return String(str || '').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
  }

  window.portalLogout = function () {
    const adminNo = getAdminNo();
    if (adminNo) {
      const sections = ['Dashboard', 'Profile', 'Attendance', 'StudyMaterial', 'Assessment', 'Assignment', 'Seminar', 'InternalMark', 'FeedBack', 'AllotmentMemo', 'HallTicket', 'FeePay', 'Grievance', 'Concession', 'ChangePwd'];
      sections.forEach(sec => {
        localStorage.removeItem(`machub_portal_${sec}_${adminNo}`);
        for (let s = 1; s <= 8; s++) {
          localStorage.removeItem(`machub_portal_${sec}_sem${s}_${adminNo}`);
        }
      });
      localStorage.removeItem(`machub_profile_overrides_${adminNo}`);
      localStorage.removeItem(`machub_bank_details_${adminNo}`);
    }
    localStorage.removeItem('machub_student_id');
    localStorage.removeItem('mac_student_info');
    alert('Logged out from ePortal successfully!');
    window.location.reload();
  };

  // ── Public API ──────────────────────────────────────────────────────────────
  window.MacHubPortal = {
    fetchSection,
    loadSection: window.loadPortalSection,
    openDrawer : window.openPortalDrawer,
    saveAdminNo,
    getAdminNo,
    clearCache,
    logout: window.portalLogout
  };

  // Legacy compatibility — old code called window.renderAcademicData
  window.renderAcademicData = renderAcademicSheet;

  // Auto-save admission number and sync dashboard on startup
  document.addEventListener('DOMContentLoaded', () => {
    const adminNo = getAdminNo();
    if (adminNo) saveAdminNo(adminNo);
    setTimeout(() => {
      if (window.syncHomePortalDashboard) window.syncHomePortalDashboard();
    }, 500);
  });

})();
