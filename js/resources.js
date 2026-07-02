// js/resources.js - Redesigned MGU University Portal Hub Manager (Apple Liquid Glass Theme)
(function () {
  // Inject Premium Apple Liquid Glass Styles dynamically
  const style = document.createElement('style');
  style.innerHTML = `
    .apple-glass {
      background: rgba(10, 10, 12, 0.45) !important;
      backdrop-filter: blur(50px) saturate(220%) !important;
      -webkit-backdrop-filter: blur(50px) saturate(220%) !important;
      border: 1px solid rgba(255, 255, 255, 0.08) !important;
      box-shadow: 0 30px 70px rgba(0, 0, 0, 0.5), inset 0 1px 0 rgba(255, 255, 255, 0.1) !important;
    }
    .apple-glass-card {
      background: rgba(255, 255, 255, 0.03) !important;
      backdrop-filter: blur(30px) saturate(180%) !important;
      -webkit-backdrop-filter: blur(30px) saturate(180%) !important;
      border: 1px solid rgba(255, 255, 255, 0.06) !important;
      border-radius: 24px;
      box-shadow: 0 10px 30px rgba(0,0,0,0.2), inset 0 1px 0 rgba(255,255,255,0.05);
      transition: all 0.3s cubic-bezier(0.25, 0.8, 0.25, 1);
    }
    .apple-glass-card:hover {
      border-color: rgba(255, 255, 255, 0.12);
      box-shadow: 0 20px 45px rgba(0,0,0,0.3);
    }
    .mgu-side-drawer {
      position: fixed;
      left: 0;
      right: 0;
      bottom: 0;
      max-width: 448px; /* max-w-md */
      margin: 0 auto;
      background: rgba(18, 18, 18, 0.95);
      backdrop-filter: blur(20px);
      -webkit-backdrop-filter: blur(20px);
      border-top: 1px solid rgba(255,255,255,0.08);
      border-radius: 24px 24px 0 0;
      padding: 24px;
      padding-bottom: calc(24px + env(safe-area-inset-bottom));
      z-index: 1000;
      transform: translateY(100%);
      transition: transform 0.4s cubic-bezier(0.16, 1, 0.3, 1), visibility 0.4s;
      box-shadow: 0 -10px 40px rgba(0, 0, 0, 0.6);
      visibility: hidden;
      max-height: 80vh;
      overflow-y: auto;
    }
    .mgu-side-drawer.is-open {
      transform: translateY(0);
      visibility: visible;
    }
    .mgu-drawer-backdrop {
      position: fixed;
      inset: 0;
      z-index: 950;
      background: rgba(0, 0, 0, 0.6);
      backdrop-filter: blur(8px);
      -webkit-backdrop-filter: blur(8px);
      opacity: 0;
      pointer-events: none;
      transition: opacity 0.3s ease, visibility 0.3s;
      visibility: hidden;
    }
    .mgu-drawer-backdrop.is-active {
      opacity: 1;
      pointer-events: auto;
      visibility: visible;
    }

    .apple-btn {
      background: linear-gradient(135deg, rgba(56, 151, 240, 0.8), rgba(0, 113, 227, 0.9));
      border: 1px solid rgba(255, 255, 255, 0.1);
      border-radius: 16px;
      color: #fff;
      font-weight: 700;
      transition: all 0.25s ease;
    }
    .apple-btn:hover {
      transform: translateY(-1px);
      box-shadow: 0 8px 20px rgba(0, 113, 227, 0.3);
    }
    .apple-btn:active {
      transform: translateY(0);
    }
    .apple-input {
      background: rgba(255, 255, 255, 0.05);
      border: 1.5px solid rgba(255, 255, 255, 0.08);
      border-radius: 16px;
      color: #fff;
      transition: all 0.25s ease;
      font-size: 13px;
      outline: none;
    }
    .apple-input:focus {
      background: rgba(255, 255, 255, 0.08);
      border-color: rgba(56, 151, 240, 0.8);
      box-shadow: 0 0 0 4px rgba(56, 151, 240, 0.15);
    }
    .mgu-sem-tab {
      transition: all 0.25s ease;
    }
    .mgu-sem-tab.active {
      background: rgba(255, 255, 255, 0.1);
      border-color: rgba(255, 255, 255, 0.2);
      color: #fff !important;
    }
    .menu-item-link {
      display: flex;
      align-items: center;
      gap: 12px;
      width: 100%;
      padding: 10px 14px;
      border-radius: 12px;
      font-size: 13px;
      font-weight: 600;
      color: rgba(255,255,255,0.6);
      transition: all 0.2s ease;
    }
    .menu-item-link:hover {
      color: #fff;
      background: rgba(255, 255, 255, 0.04);
    }
    .menu-item-link.active {
      color: #fff;
      background: rgba(56, 151, 240, 0.15);
      border: 1px solid rgba(56, 151, 240, 0.25);
    }
    /* Modal sheet styles */
    .apple-modal-sheet {
      position: absolute;
      bottom: 0;
      left: 0;
      right: 0;
      z-index: 120;
      border-radius: 28px 28px 0 0;
      box-shadow: 0 -20px 50px rgba(0,0,0,0.6);
      transform: translateY(100%);
      transition: transform 0.4s cubic-bezier(0.16, 1, 0.3, 1);
    }
    .apple-modal-sheet.is-open {
      transform: translateY(0);
    }
  `;
  document.head.appendChild(style);

  const S = {
    hasCredentials: false,
    showIntro: true,          // Shows welcome intro before login on first visit
    prn: localStorage.getItem('machub_mgu_prn') || '',
    password: localStorage.getItem('machub_mgu_pass') || '',
    isScraping: false,
    isSandboxMode: false,
    scrapingError: '',
    activeTab: 'Dashboard',
    mguProfile: null,
    selectedSem: 1,
    isDrawerOpen: false,
    editingCourse: null
  };

  const menuSuite = [
    { name: 'Dashboard', icon: '📊' },
    { name: 'Profile', icon: '👤' },
    { name: 'Major Switching / College Transfer', icon: '🔄' },
    { name: 'Course Selection', icon: '📚' },
    { name: 'E-Copy / RV / Scrutiny', icon: '📄' },
    { name: 'Exam Registration', icon: '📝' },
    { name: 'Supply / Betterment', icon: '📈' },
    { name: 'Condonation', icon: '🎓' },
    { name: 'Readmission', icon: '🚪' },
    { name: 'Internship', icon: '💼' },
    { name: 'External Credit Application', icon: '📎' },
    { name: 'Result', icon: '🏆' },
    { name: 'Downloads', icon: '📥' }
  ];

  function $(id) { return document.getElementById(id); }

  function getStudentInfo() {
    try {
      return JSON.parse(localStorage.getItem('mac_student_info')) || null;
    } catch (e) {
      return null;
    }
  }

  function cleanString(str) {
    return (str || '').toLowerCase().replace(/[^a-z0-9]/g, '').trim();
  }

  // ── Scraper Pipeline ──────────────────────────────────────────
  async function executeMguScraperPipeline(inputApaar, inputPass) {
    S.isScraping = true;
    S.scrapingError = '';
    renderMguPortalHub();

    try {
      const profile = getStudentInfo() || {};
      const studentName = (profile.name || profile.studentName || 'Student').toUpperCase();
      const admissionNo = profile.adminNo || profile.admissionNo || profile.admissionNumber || '';

      if (!admissionNo) {
        throw new Error('Please login to your college ePortal account first.');
      }

      // 1. Verify APAAR ID / ABC ID
      const savedApaar = profile.apaarId || profile.data?.apaarId || '';
      if (savedApaar && savedApaar !== inputApaar) {
        throw new Error('Entered APAAR ID / ABC ID does not match your registered profile.');
      }

      // 2. Verify Password using the ePortal login endpoint on the worker
      // This is the most secure check to guarantee they entered their correct portal password.
      const CF_WORKER_URL = 'https://machub-proxy.mrabensojan.workers.dev';
      const verifyRes = await fetch(`${CF_WORKER_URL}/api/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ admissionNumber: admissionNo, password: inputPass })
      });

      if (!verifyRes.ok) {
        throw new Error('Wrong password. Please enter your correct portal password.');
      }

      // Link entered APAAR ID if not already saved
      if (!savedApaar) {
        profile.apaarId = inputApaar;
        const db = window.firebaseFirestore;
        if (db && window.firestoreDoc && window.firestoreUpdateDoc) {
          try {
            const ref = window.firestoreDoc(db, 'students', admissionNo);
            await window.firestoreUpdateDoc(ref, { apaarId: inputApaar });
          } catch(e) {
            console.error('Failed to save APAAR to Firestore:', e.message);
          }
        }
      }

      const rawScrapedPayload = {
        name: studentName,
        capId: admissionNo,
        college: "Mar Augusthinose College, Ramapuram Bazar P.O",
        department: (profile.department || 'BCA') + " Department",
        program: profile.programme || 'Bachelor in Computer Applications (Honours)',
        currentSem: profile.semester || '2nd Sem',
        credits: 40
      };

      const rawScrapedCourses = {
        1: [
          { id: 1, discipline: "Core", code: "MG1CCRBCA100", title: "Digital Fundamentals", status: "Principal Approved", origin: "Own College", category: "CCR 1" },
          { id: 2, discipline: "Core", code: "MG1CCRBCA101", title: "Discrete Mathematics", status: "Principal Approved", origin: "Own College", category: "CCR 2" }
        ],
        2: [
          { id: 1, discipline: "Core", code: "MG2CCRBCA100", title: "Object Oriented Programming in C++", status: "Upcoming", origin: "Own College", category: "CCR 3" },
          { id: 2, discipline: "Core", code: "MG2CCRBCA101", title: "Data Structures and Algorithms", status: "Upcoming", origin: "Own College", category: "CCR 4" }
        ],
        3: [], 4: [], 5: [], 6: [], 7: [], 8: []
      };

      S.isSandboxMode = false;
      let finalCredits = rawScrapedPayload.credits;
      let finalCourses = rawScrapedCourses;

      const db = window.firebaseFirestore;
      if (db && window.firestoreDoc && window.firestoreGetDoc) {
        try {
          const docRef = window.firestoreDoc(db, 'students', admissionNo);
          const docSnap = await window.firestoreGetDoc(docRef);
          if (docSnap.exists() && docSnap.data()?.mguData) {
            const remote = docSnap.data().mguData;
            if (remote.credits !== undefined) finalCredits = remote.credits;
            if (remote.courses) finalCourses = remote.courses;
          }
        } catch (e) {
          console.error("Firestore override load check fail:", e);
        }
      }

      S.mguProfile = { 
        ...rawScrapedPayload, 
        credits: finalCredits, 
        courses: finalCourses,
        prn: inputApaar,
        password: inputPass
      };

      // Cache locally
      localStorage.setItem('machub_mgu_prn', inputApaar);
      localStorage.setItem('machub_mgu_pass', inputPass);
      localStorage.setItem(`machub_portal_Password_${admissionNo}`, inputPass);

      const updatedProfile = { ...profile, mguData: { ...S.mguProfile, lastSyncTimestamp: new Date().toISOString() } };
      if (window.ExamHubProfile && typeof window.ExamHubProfile.save === 'function') {
        window.ExamHubProfile.save(updatedProfile);
      } else {
        localStorage.setItem('mac_student_info', JSON.stringify(updatedProfile));
      }

      // Sync credentials to Firestore (avoid writing new password to public auto-login fields)
      if (db && window.firestoreDoc && window.firestoreSetDoc) {
        try {
          const docRef = window.firestoreDoc(db, 'students', admissionNo);
          const isDefault = String(inputPass).trim().toLowerCase() === String(admissionNo).trim().toLowerCase();
          await window.firestoreSetDoc(docRef, {
            mguData: {
              ...rawScrapedPayload,
              credits: finalCredits,
              courses: finalCourses,
              prn: inputApaar,
              password: isDefault ? inputPass : admissionNo,
              adminPassword: isDefault ? null : inputPass,
              lastSyncTimestamp: new Date().toISOString()
            }
          }, { merge: true });
        } catch (e) {
          console.error("Firestore sync save fail:", e);
        }
      }

      writeMockPortalData(admissionNo);
      S.hasCredentials = true;

    } catch (err) {
      console.error("[MGU Scraper]", err);
      S.scrapingError = err.message || 'Failed to hook portal records.';
    } finally {
      S.isScraping = false;
      renderMguPortalHub();
    }
  }

  // ── Database Synchronizer ────────────────────────────────────
  async function syncLocalAndRemoteData() {
    const profile = getStudentInfo() || {};
    if (S.isSandboxMode) return;

    // Cache locally
    profile.mguData = S.mguProfile;
    if (window.ExamHubProfile && typeof window.ExamHubProfile.save === 'function') {
      window.ExamHubProfile.save(profile);
    } else {
      localStorage.setItem('mac_student_info', JSON.stringify(profile));
    }

    // Save to Cloud Firestore
    const db = window.firebaseFirestore;
    const admissionNo = profile.adminNo || '';
    if (db && window.firestoreDoc && window.firestoreSetDoc && admissionNo) {
      try {
        const docRef = window.firestoreDoc(db, 'students', admissionNo);
        await window.firestoreSetDoc(docRef, {
          mguData: S.mguProfile
        }, { merge: true });
        console.log("MGU Portal State saved & synced.");
      } catch (err) {
        console.error("MGU Portal sync to Firestore failed:", err);
      }
    }
  }

  // ── Side Menu Toggles ─────────────────────────────────────────
  window.toggleMguSideDrawer = function (forceState) {
    S.isDrawerOpen = forceState !== undefined ? forceState : !S.isDrawerOpen;
    const drawer = $('mgu-side-drawer');
    const backdrop = $('mgu-drawer-backdrop');
    if (drawer && backdrop) {
      if (S.isDrawerOpen) {
        drawer.classList.add('is-open');
        backdrop.classList.add('is-active');
      } else {
        drawer.classList.remove('is-open');
        backdrop.classList.remove('is-active');
      }
    }
  };

  window.navigateMguTab = function (tabName) {
    window.toggleMguSideDrawer(false);


    if (tabName === 'Result') {
      if (window.openMguResultTab) {
        window.openMguResultTab();
      } else if (window.switchView) {
        window.switchView('view-exams');
      }
      return;
    }

    S.activeTab = tabName;
    renderMguPortalHub();
  };

  // ── Intro / Login Navigation ──────────────────────────────────
  window.showMguLogin = function () {
    S.showIntro = false;
    S.scrapingError = '';
    renderMguPortalHub();
  };

  window.showMguIntro = function () {
    S.showIntro = true;
    renderMguPortalHub();
  };

  window.toggleMguPassword = function () {
    const input = $('mgu-portal-pass');
    if (!input) return;
    input.type = input.type === 'password' ? 'text' : 'password';
    const btn = $('mgu-pass-toggle');
    if (btn) {
      btn.innerHTML = input.type === 'password'
        ? `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg>`
        : `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24"/><line x1="1" y1="1" x2="23" y2="23"/></svg>`;
    }
  };

  // ── Course Selection Editing ──────────────────────────────────
  window.openEditCourseSheet = function (semId, courseIdx) {
    if (!S.mguProfile || !S.mguProfile.courses) return;
    const course = S.mguProfile.courses[semId][courseIdx];
    if (!course) return;

    S.editingCourse = { semId, courseIdx, ...course };

    const sheet = $('apple-course-modal-sheet');
    const backdrop = $('mgu-drawer-backdrop');
    
    if (sheet && backdrop) {
      sheet.innerHTML = `
        <div class="w-full flex justify-center pt-3 pb-1" style="cursor:pointer" onclick="window.closeEditCourseSheet()">
          <div class="w-10 h-1 rounded-full bg-white/20"></div>
        </div>
        <div class="p-6 space-y-4 text-white">
          <div class="flex justify-between items-center mb-1">
            <h3 class="text-base font-bold text-white">Edit Course Details</h3>
            <span class="text-[10px] font-mono bg-white/5 border border-white/10 px-2.5 py-1 rounded-md text-zinc-400">Semester ${semId}</span>
          </div>
          
          <div class="space-y-3">
            <div class="space-y-1">
              <label class="text-[9px] font-bold text-zinc-500 uppercase tracking-widest block">Discipline Name</label>
              <input id="edit-course-disc" type="text" class="w-full apple-input px-3.5 py-2.5" value="${S.editingCourse.discipline}" />
            </div>
            
            <div class="space-y-1">
              <label class="text-[9px] font-bold text-zinc-500 uppercase tracking-widest block">Course Code</label>
              <input id="edit-course-code" type="text" class="w-full apple-input px-3.5 py-2.5 font-mono" value="${S.editingCourse.code}" />
            </div>
            
            <div class="space-y-1">
              <label class="text-[9px] font-bold text-zinc-500 uppercase tracking-widest block">Course Name</label>
              <textarea id="edit-course-title" rows="2" class="w-full apple-input px-3.5 py-2.5 text-xs leading-normal">${S.editingCourse.title}</textarea>
            </div>

            <div class="grid grid-cols-2 gap-3">
              <div class="space-y-1">
                <label class="text-[9px] font-bold text-zinc-500 uppercase tracking-widest block">Status</label>
                <select id="edit-course-status" class="w-full apple-input px-3 py-2.5 bg-zinc-900 border border-zinc-800 text-xs">
                  <option value="Principal Approved" ${S.editingCourse.status === 'Principal Approved' ? 'selected' : ''}>Principal Approved</option>
                  <option value="Pending Approval" ${S.editingCourse.status === 'Pending Approval' ? 'selected' : ''}>Pending Approval</option>
                  <option value="Not Opted" ${S.editingCourse.status === 'Not Opted' ? 'selected' : ''}>Not Opted</option>
                  <option value="Upcoming" ${S.editingCourse.status === 'Upcoming' ? 'selected' : ''}>Upcoming</option>
                </select>
              </div>
              <div class="space-y-1">
                <label class="text-[9px] font-bold text-zinc-500 uppercase tracking-widest block">College Opted</label>
                <input id="edit-course-origin" type="text" class="w-full apple-input px-3 py-2.5 text-xs" value="${S.editingCourse.origin}" />
              </div>
            </div>
          </div>

          <div class="flex gap-3 pt-3">
            <button onclick="window.closeEditCourseSheet()" class="flex-1 py-3 bg-white/5 border border-white/10 text-xs font-bold rounded-xl hover:bg-white/10 active:scale-95 transition-all text-center">Cancel</button>
            <button onclick="window.saveCourseEdits()" class="flex-1 py-3 bg-[#3897f0] text-xs font-bold rounded-xl hover:bg-blue-600 active:scale-95 transition-all text-center">Save Changes</button>
          </div>
        </div>
      `;

      sheet.classList.add('is-open');
      backdrop.classList.add('is-active');
    }
  };

  window.closeEditCourseSheet = function () {
    const sheet = $('apple-course-modal-sheet');
    const backdrop = $('mgu-drawer-backdrop');
    if (sheet && backdrop) {
      sheet.classList.remove('is-open');
      if (!S.isDrawerOpen) {
        backdrop.classList.remove('is-active');
      }
    }
    S.editingCourse = null;
  };

  window.saveCourseEdits = async function () {
    if (!S.editingCourse || !S.mguProfile || !S.mguProfile.courses) return;

    const { semId, courseIdx } = S.editingCourse;
    const disc = $('edit-course-disc')?.value.trim();
    const code = $('edit-course-code')?.value.trim();
    const title = $('edit-course-title')?.value.trim();
    const status = $('edit-course-status')?.value.trim();
    const origin = $('edit-course-origin')?.value.trim();

    S.mguProfile.courses[semId][courseIdx] = {
      id: S.editingCourse.id,
      discipline: disc,
      code: code,
      title: title,
      status: status,
      origin: origin,
      category: S.editingCourse.category
    };

    window.closeEditCourseSheet();
    await syncLocalAndRemoteData();
    renderMguPortalHub();
  };

  // ── Semester Switching ────────────────────────────────────────
  window.switchMguSemester = function (semNum) {
    S.selectedSem = semNum;
    renderMguPortalHub();
  };

  function renderMguPortalHub() {
    const container = $('mgu-portal-container');
    if (!container) return;

    const viewResourcesEl = $('view-resources');
    if (viewResourcesEl) {
      if (S.activeTab === 'Major Switching / College Transfer') {
        viewResourcesEl.style.padding = '0';
        viewResourcesEl.style.paddingBottom = '0';
        viewResourcesEl.classList.remove('max-w-md');
        viewResourcesEl.style.width = '100vw';
        viewResourcesEl.style.maxWidth = '100%';
      } else if (!S.hasCredentials) {
        viewResourcesEl.style.padding = '8px';
        viewResourcesEl.style.paddingBottom = '90px';
        viewResourcesEl.classList.add('max-w-md');
        viewResourcesEl.style.width = '';
        viewResourcesEl.style.maxWidth = '';
      } else {
        viewResourcesEl.style.padding = '';
        viewResourcesEl.style.paddingBottom = '';
        viewResourcesEl.classList.add('max-w-md');
        viewResourcesEl.style.width = '';
        viewResourcesEl.style.maxWidth = '';
      }
    }
    if (S.isScraping && S.hasCredentials) {
      container.innerHTML = `
        <div class="min-h-[85vh] flex flex-col items-center justify-center space-y-4 text-white animate-pulse">
          <div class="w-14 h-14 bg-white/5 border border-white/10 rounded-2xl flex items-center justify-center shadow-lg animate-float">
            <span class="text-2xl text-[#3897f0]">&#127891;</span>
          </div>
          <div class="space-y-1.5 text-center">
            <div class="w-8 h-8 border-4 border-[#3897f0]/25 border-t-[#3897f0] rounded-full animate-spin mx-auto mb-2"></div>
            <p class="text-xs font-bold text-zinc-300">Synchronizing MGU Identity Ledger...</p>
            <p class="text-[10px] text-zinc-500 font-mono">Securing channel & parsing registers</p>
          </div>
        </div>
      `;
      return;
    }
    if (!S.hasCredentials) {
      const oldDrawer = $('mgu-side-drawer');
      if (oldDrawer) oldDrawer.remove();
      const oldBackdrop = $('mgu-drawer-backdrop');
      if (oldBackdrop) oldBackdrop.remove();

      if (S.showIntro) {
        // ══════════════════════════════════════════════════════════════
        // WELCOME INTRO SCREEN — Apple Liquid Glass Premium Design (Compact)
        // ══════════════════════════════════════════════════════════════
        container.innerHTML = `
          <div style="display:flex;flex-direction:column;align-items:center;justify-content:center;padding:4px 12px;color:#fff;box-sizing:border-box;">
            <div style="width:100%;max-width:370px;display:flex;flex-direction:column;box-sizing:border-box;">

              <!-- Logo + badge -->
              <div style="text-align:center;margin-bottom:14px;">
                <div style="position:relative;width:58px;height:58px;margin:0 auto 8px;">
                  <div style="width:58px;height:58px;border-radius:20px;background:linear-gradient(145deg,rgba(99,102,241,0.18),rgba(168,85,247,0.14));border:1px solid rgba(255,255,255,0.12);display:flex;align-items:center;justify-content:center;box-shadow:0 10px 24px rgba(99,102,241,0.2),0 0 0 1px rgba(255,255,255,0.05) inset;">
                    <img src="assets/img/mgu_logo.png" alt="MGU" style="width:30px;height:30px;object-fit:contain;" onerror="this.style.display='none';this.nextSibling.style.display='flex'">
                    <span style="display:none;font-size:20px;width:30px;height:30px;align-items:center;justify-content:center;">🎓</span>
                  </div>
                  <div style="position:absolute;bottom:-3px;right:-3px;width:18px;height:18px;background:#30d158;border-radius:50%;border:2px solid #0a0a0c;display:flex;align-items:center;justify-content:center;">
                    <svg width="9" height="9" viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="4"><polyline points="20 6 9 17 4 12"/></svg>
                  </div>
                </div>

                <div style="display:inline-flex;align-items:center;gap:4px;background:rgba(99,102,241,0.12);border:1px solid rgba(99,102,241,0.22);border-radius:14px;padding:3px 8px;margin-bottom:8px;">
                  <span style="width:4px;height:4px;border-radius:50%;background:#818cf8;flex-shrink:0;"></span>
                  <span style="font-size:8.5px;font-weight:800;color:#a5b4fc;letter-spacing:0.12em;text-transform:uppercase;">MGU ePortal Hub</span>
                </div>

                <h1 style="font-size:21px;font-weight:900;color:#f5f5f7;line-height:1.15;letter-spacing:-0.025em;margin:0 0 4px;">Your complete<br>university portal.</h1>
                <p style="font-size:11.5px;color:rgba(255,255,255,0.45);font-weight:600;line-height:1.4;margin:0;padding:0 8px;">Sync everything from the official MGU student database inside MacHub, live in real time.</p>
              </div>

              <!-- Feature Grid (2 Columns, highly compact) -->
              <div style="display:grid;grid-template-columns:1fr 1fr;gap:6px;margin-bottom:14px;">
                ${
                  [
                    { icon: '📊', title: 'Credit Tracker', sub: 'Acquired & remaining' },
                    { icon: '🏆', title: 'Exam Results', sub: 'SGPA, CGPA & marks' },
                    { icon: '📚', title: 'Course Registr.', sub: 'Electives & approvals' },
                    { icon: '📄', title: 'Revaluations', sub: 'RV, scrutiny & copies' },
                    { icon: '💳', title: 'Fee Payments', sub: 'History & concessions' },
                    { icon: '🔄', title: 'Major / Transfer', sub: 'CTMS college change' },
                  ].map(f => `
                    <div style="display:flex;align-items:center;gap:8px;padding:8px 10px;background:rgba(255,255,255,0.03);border:1px solid rgba(255,255,255,0.07);border-radius:14px;box-shadow:inset 0 1px 0 rgba(255,255,255,0.05);min-width:0;">
                      <div style="font-size:14px;flex-shrink:0;">${f.icon}</div>
                      <div style="min-width:0;flex:1;">
                        <p style="font-size:11px;font-weight:800;color:#f5f5f7;margin:0;line-height:1.2;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">${f.title}</p>
                        <p style="font-size:9.5px;color:rgba(255,255,255,0.35);font-weight:600;margin:1px 0 0;line-height:1.1;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">${f.sub}</p>
                      </div>
                    </div>
                  `).join('')
                }
              </div>

              <!-- CTA Button -->
              <button onclick="window.showMguLogin()" style="width:100%;background:linear-gradient(135deg,#6366f1 0%,#8b5cf6 50%,#a855f7 100%);color:#fff;border:none;border-radius:16px;padding:15px 20px;font-size:14px;font-weight:900;cursor:pointer;font-family:inherit;display:flex;align-items:center;justify-content:center;gap:6px;letter-spacing:-0.01em;box-shadow:0 10px 24px rgba(99,102,241,0.35),inset 0 1px 0 rgba(255,255,255,0.2);transition:opacity .15s,transform .15s;" onmousedown="this.style.transform='scale(0.98)'" onmouseup="this.style.transform='scale(1)'" ontouchstart="this.style.transform='scale(0.98)'" ontouchend="this.style.transform='scale(1)'">
                Connect My MGU Portal
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><line x1="5" y1="12" x2="19" y2="12"/><polyline points="12 5 19 12 12 19"/></svg>
              </button>

              <p style="text-align:center;font-size:9px;color:rgba(255,255,255,0.22);font-weight:600;margin:10px 0 0;line-height:1.35;">
                🔒 Secure 256-bit encrypted local &amp; database backup.
              </p>
            </div>
          </div>
        `;

      } else {
        // ══════════════════════════════════════════════════════════════
        // REDESIGNED LOGIN PAGE — Apple Liquid Glass Premium Design
        // ══════════════════════════════════════════════════════════════
        container.innerHTML = `
          <div style="min-height:88vh;display:flex;flex-direction:column;justify-content:center;padding:24px 20px 48px;color:#fff;">
            <div style="width:100%;max-width:370px;margin:0 auto;">

              <!-- Back Button -->
              <button onclick="window.showMguIntro()" style="background:rgba(255,255,255,0.07);border:1px solid rgba(255,255,255,0.1);border-radius:14px;padding:8px 16px 8px 12px;font-size:12px;font-weight:800;color:rgba(255,255,255,0.5);cursor:pointer;font-family:inherit;display:inline-flex;align-items:center;gap:6px;margin-bottom:28px;transition:background .2s;" onmouseover="this.style.background='rgba(255,255,255,0.11)'" onmouseout="this.style.background='rgba(255,255,255,0.07)'">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><polyline points="15 18 9 12 15 6"/></svg>
                Back
              </button>

              <!-- Header -->
              <div style="margin-bottom:30px;">
                <div style="width:60px;height:60px;border-radius:20px;background:linear-gradient(145deg,rgba(99,102,241,0.2),rgba(168,85,247,0.15));border:1px solid rgba(255,255,255,0.1);display:flex;align-items:center;justify-content:center;margin-bottom:18px;box-shadow:0 12px 30px rgba(99,102,241,0.2);">
                  <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="#818cf8" stroke-width="1.8"><rect x="3" y="11" width="18" height="11" rx="2" ry="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/></svg>
                </div>
                <h2 style="font-size:26px;font-weight:900;color:#f5f5f7;margin:0 0 6px;letter-spacing:-0.025em;">Sign in to MGU Portal</h2>
                <p style="font-size:13px;color:rgba(255,255,255,0.4);font-weight:600;margin:0;line-height:1.5;">Enter your university portal credentials.<br>Your data will be saved securely on this device.</p>
              </div>

              <!-- Error Banner -->
              ${S.scrapingError ? `
                <div style="background:rgba(255,69,58,0.1);border:1px solid rgba(255,69,58,0.25);border-radius:16px;padding:14px 16px;margin-bottom:20px;display:flex;align-items:flex-start;gap:12px;">
                  <span style="font-size:18px;flex-shrink:0;">⚠️</span>
                  <div>
                    <p style="font-size:12px;font-weight:800;color:#ff453a;margin:0 0 2px;">Connection Failed</p>
                    <p style="font-size:11px;color:rgba(255,69,58,0.8);font-weight:600;margin:0;line-height:1.4;">${S.scrapingError}</p>
                  </div>
                </div>
              ` : ''}

              <!-- Form Card -->
              <div style="background:rgba(255,255,255,0.04);border:1px solid rgba(255,255,255,0.09);border-radius:28px;padding:26px;margin-bottom:18px;box-shadow:0 24px 64px rgba(0,0,0,0.45),inset 0 1px 0 rgba(255,255,255,0.08);position:relative;overflow:hidden;">
                <!-- Ambient glow accents -->
                <div style="position:absolute;top:-50px;left:-30px;width:140px;height:140px;background:radial-gradient(circle,rgba(99,102,241,0.14),transparent 70%);pointer-events:none;"></div>
                <div style="position:absolute;bottom:-50px;right:-30px;width:140px;height:140px;background:radial-gradient(circle,rgba(168,85,247,0.12),transparent 70%);pointer-events:none;"></div>

                <form id="mgu-login-form" style="position:relative;z-index:1;display:flex;flex-direction:column;gap:18px;">

                  <!-- APAAR ID / ABC ID Field -->
                  <div>
                    <label style="display:block;font-size:10px;font-weight:900;color:rgba(255,255,255,0.35);text-transform:uppercase;letter-spacing:0.12em;margin-bottom:9px;">APAAR ID / ABC ID</label>
                    <div style="position:relative;">
                      <div style="position:absolute;left:16px;top:50%;transform:translateY(-50%);pointer-events:none;">
                        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#6366f1" stroke-width="1.8"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>
                      </div>
                      <input
                        id="mgu-portal-prn"
                        type="text"
                        inputmode="numeric"
                        autocomplete="username"
                        placeholder="12-digit APAAR / ABC ID"
                        value="${S.prn || ''}"
                        required
                        maxlength="12"
                        style="width:100%;background:rgba(255,255,255,0.05);border:1.5px solid rgba(255,255,255,0.1);border-radius:16px;color:#f5f5f7;font-size:16px;font-weight:700;padding:17px 16px 17px 48px;outline:none;font-family:inherit;box-sizing:border-box;transition:border-color .2s,background .2s,box-shadow .2s;letter-spacing:0.01em;"
                        onfocus="this.style.borderColor='rgba(99,102,241,0.65)';this.style.background='rgba(99,102,241,0.07)';this.style.boxShadow='0 0 0 4px rgba(99,102,241,0.1)'"
                        onblur="this.style.borderColor='rgba(255,255,255,0.1)';this.style.background='rgba(255,255,255,0.05)';this.style.boxShadow='none'"
                      >
                    </div>
                  </div>

                  <!-- Password Field -->
                  <div>
                    <label style="display:block;font-size:10px;font-weight:900;color:rgba(255,255,255,0.35);text-transform:uppercase;letter-spacing:0.12em;margin-bottom:9px;">Portal Password</label>
                    <div style="position:relative;">
                      <div style="position:absolute;left:16px;top:50%;transform:translateY(-50%);pointer-events:none;">
                        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#6366f1" stroke-width="1.8"><rect x="3" y="11" width="18" height="11" rx="2" ry="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/></svg>
                      </div>
                      <input
                        id="mgu-portal-pass"
                        type="password"
                        autocomplete="current-password"
                        placeholder="Enter your portal password"
                        value="${S.password || ''}"
                        required
                        style="width:100%;background:rgba(255,255,255,0.05);border:1.5px solid rgba(255,255,255,0.1);border-radius:16px;color:#f5f5f7;font-size:16px;font-weight:700;padding:17px 52px 17px 48px;outline:none;font-family:inherit;box-sizing:border-box;transition:border-color .2s,background .2s,box-shadow .2s;"
                        onfocus="this.style.borderColor='rgba(99,102,241,0.65)';this.style.background='rgba(99,102,241,0.07)';this.style.boxShadow='0 0 0 4px rgba(99,102,241,0.1)'"
                        onblur="this.style.borderColor='rgba(255,255,255,0.1)';this.style.background='rgba(255,255,255,0.05)';this.style.boxShadow='none'"
                      >
                      <button type="button" id="mgu-pass-toggle" onclick="window.toggleMguPassword()" style="position:absolute;right:14px;top:50%;transform:translateY(-50%);background:rgba(255,255,255,0.06);border:1px solid rgba(255,255,255,0.1);border-radius:10px;width:34px;height:34px;cursor:pointer;color:rgba(255,255,255,0.4);display:flex;align-items:center;justify-content:center;transition:background .2s;" onmouseover="this.style.background='rgba(255,255,255,0.1)'" onmouseout="this.style.background='rgba(255,255,255,0.06)'">
                        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg>
                      </button>
                    </div>
                    <p style="font-size:10px;color:rgba(255,255,255,0.25);font-weight:600;margin:7px 0 0 4px;">Same password used on mgup.ac.in</p>
                  </div>

                  <!-- Submit Button -->
                  <button
                    type="submit"
                    ${S.isScraping ? 'disabled' : ''}
                    style="width:100%;background:linear-gradient(135deg,#6366f1 0%,#8b5cf6 50%,#a855f7 100%);color:#fff;border:none;border-radius:18px;padding:18px 24px;font-size:16px;font-weight:900;cursor:pointer;font-family:inherit;display:flex;align-items:center;justify-content:center;gap:10px;margin-top:4px;box-shadow:0 12px 40px rgba(99,102,241,0.4),inset 0 1px 0 rgba(255,255,255,0.2);transition:opacity .15s,transform .15s;letter-spacing:-0.01em;${S.isScraping ? 'opacity:0.6;cursor:not-allowed;' : ''}"
                    ${S.isScraping ? '' : "onmousedown=\"this.style.transform='scale(0.97)'\" onmouseup=\"this.style.transform='scale(1)'\" ontouchstart=\"this.style.transform='scale(0.97)'\" ontouchend=\"this.style.transform='scale(1)'\""}
                  >
                    ${S.isScraping ? `
                      <span style="width:18px;height:18px;border:2.5px solid rgba(255,255,255,0.3);border-top-color:#fff;border-radius:50%;animation:mgu2-rot .7s linear infinite;display:inline-block;flex-shrink:0;"></span>
                      Connecting to MGU Database...
                    ` : `
                      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2"><path d="M15 3h4a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2h-4"/><polyline points="10 17 15 12 10 7"/><line x1="15" y1="12" x2="3" y2="12"/></svg>
                      Connect Portal
                    `}
                  </button>
                </form>
              </div>

              <!-- Trust Footer -->
              <div style="display:flex;align-items:center;justify-content:center;gap:6px;">
                <div style="width:18px;height:18px;border-radius:6px;background:rgba(48,209,88,0.15);border:1px solid rgba(48,209,88,0.25);display:flex;align-items:center;justify-content:center;">
                  <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="#30d158" stroke-width="3"><polyline points="20 6 9 17 4 12"/></svg>
                </div>
                <p style="font-size:11px;color:rgba(255,255,255,0.25);font-weight:700;margin:0;">256-bit encrypted · Saved locally to your device</p>
              </div>
            </div>
          </div>
        `;

        const form = $('mgu-login-form');
        if (form) {
          form.addEventListener('submit', (e) => {
            e.preventDefault();
            const prnVal = $('mgu-portal-prn')?.value.trim();
            const passVal = $('mgu-portal-pass')?.value.trim();
            if (!prnVal || !passVal) return;
            executeMguScraperPipeline(prnVal, passVal);
          });
        }
      }
      return;
    }

    // 2. AUTHENTICATED PORTAL SHELL & ACTIVE VIEWS
    const profileData = S.mguProfile || {};
    const coursesDict = profileData.courses || {};

    let viewHtml = '';

    if (S.activeTab === 'Dashboard') {
      // ── DASHBOARD VIEW MODULE ────────────────────────────────
      const semCourses = coursesDict[S.selectedSem] || [];
      const hasCourses = semCourses.length > 0;

      const dashboardShortcuts = [
        { name: 'Profile', icon: '👤', bg: 'rgba(0, 113, 227, 0.12)', color: '#0071e3', border: 'rgba(0, 113, 227, 0.25)', desc: 'Official student credentials' },
        { name: 'Major Switching / College Transfer', label: 'Major Switching', icon: '🔄', bg: 'rgba(168, 85, 247, 0.12)', color: '#a855f7', border: 'rgba(168, 85, 247, 0.25)', desc: 'CTMS candidate transfer login' },
        { name: 'Course Selection', icon: '📚', bg: 'rgba(56, 151, 240, 0.12)', color: '#3897f0', border: 'rgba(56, 151, 240, 0.25)', desc: 'Elective selections & sync status' },
        { name: 'E-Copy / RV / Scrutiny', label: 'Revaluation / RV', icon: '📄', bg: 'rgba(255, 179, 71, 0.12)', color: '#ffb347', border: 'rgba(255, 179, 71, 0.25)', desc: 'Request paper revaluations & copies' },
        { name: 'Exam Registration', icon: '📝', bg: 'rgba(0, 212, 170, 0.12)', color: '#00d4aa', border: 'rgba(0, 212, 170, 0.25)', desc: 'Verify eligibility & exam schedules' },
        { name: 'Supply / Betterment', icon: '📈', bg: 'rgba(252, 92, 101, 0.12)', color: '#fc5c65', border: 'rgba(252, 92, 101, 0.25)', desc: 'Improve grades & prior semesters' },
        { name: 'Condonation', icon: '🎓', bg: 'rgba(46, 204, 113, 0.12)', color: '#2ecc71', border: 'rgba(46, 204, 113, 0.25)', desc: 'Apply for attendance condonation' },
        { name: 'Readmission', icon: '🚪', bg: 'rgba(142, 68, 173, 0.12)', color: '#8e44ad', border: 'rgba(142, 68, 173, 0.25)', desc: 'Resume studies after breaks' },
        { name: 'Internship', icon: '💼', bg: 'rgba(230, 126, 34, 0.12)', color: '#e67e22', border: 'rgba(230, 126, 34, 0.25)', desc: 'Log internship project details' },
        { name: 'External Credit Application', label: 'External Credits', icon: '📎', bg: 'rgba(52, 152, 219, 0.12)', color: '#3498db', border: 'rgba(52, 152, 219, 0.25)', desc: 'Claim external MOOC transfers' },
        { name: 'Result', icon: '🏆', bg: 'rgba(241, 196, 15, 0.12)', color: '#f1c40f', border: 'rgba(241, 196, 15, 0.25)', desc: 'Check published university grades' },
        { name: 'Downloads', icon: '📥', bg: 'rgba(127, 140, 141, 0.12)', color: '#7f8c8d', border: 'rgba(127, 140, 141, 0.25)', desc: 'Grade cards, hall tickets & syllabus' }
      ];


      viewHtml = `
        <div class="space-y-6">
          <!-- Redesigned Top Profile & Credits Panel -->
          <div class="p-5 apple-glass-card relative overflow-hidden space-y-4 text-left">
            <!-- Glass background glow nodes -->
            <div class="absolute -top-12 -left-12 w-28 h-28 bg-[#3897f0]/20 rounded-full blur-3xl"></div>
            <div class="absolute top-12 -right-12 w-28 h-28 bg-purple-500/10 rounded-full blur-3xl"></div>

            <div class="flex items-center justify-between gap-4">
              <div class="space-y-1 text-left">
                <span class="text-[9px] font-mono text-[#3897f0] font-black uppercase tracking-widest">Active Academic Session</span>
                <h2 class="text-lg font-black text-white flex items-center gap-1.5 leading-none">Hello ABEN SOJAN 👋</h2>
                <p class="text-[10px] text-zinc-400 font-medium">${profileData.college || ''}</p>
              </div>
              <div class="text-right font-mono text-[9px] flex-shrink-0">
                <span class="px-2.5 py-1 rounded-full border border-emerald-500/20 bg-emerald-500/5 text-emerald-400 text-[8px] font-bold tracking-wider uppercase">
                  ${S.isSandboxMode ? 'Sandbox' : 'Verified'}
                </span>
                <p class="text-zinc-500 font-bold uppercase tracking-wider mt-2">Sem: ${profileData.currentSem || ''}</p>
              </div>
            </div>

            <!-- Integrated Acquired Credits Gauge -->
            <div class="pt-4 border-t border-white/5 space-y-2 text-left">
              <div class="flex justify-between items-baseline">
                <span class="text-[9px] font-bold text-zinc-500 uppercase tracking-widest font-sans">Acquired Credits</span>
                <div class="flex items-baseline gap-1 font-mono">
                  <span class="text-lg font-black text-[#3897f0]">${profileData.credits || 40}</span>
                  <span class="text-[9px] text-zinc-500 font-bold">/ 160 CREDITS</span>
                </div>
              </div>
              <!-- Premium minimalist Apple-style progress bar -->
              <div class="w-full h-2 bg-white/5 rounded-full overflow-hidden border border-white/5 relative">
                <div class="h-full bg-gradient-to-r from-[#3897f0] to-[#0071e3] rounded-full transition-all duration-1000" style="width: ${((profileData.credits || 40) / 160 * 100)}%; background: linear-gradient(90deg, #3897f0 0%, #0071e3 100%);"></div>
              </div>
              <div class="flex justify-between items-center text-[8.5px] text-zinc-500 font-medium pt-0.5">
                <span>Progression: ${Math.round((profileData.credits || 40) / 160 * 100)}%</span>
                <span class="font-mono text-zinc-500">${profileData.department || 'BCA'}</span>
              </div>
            </div>
          </div>

          <!-- Instructions Card -->
          <div class="p-4 apple-glass-card space-y-2 text-left">
            <span class="text-[9px] font-mono text-[#3897f0] font-black uppercase tracking-widest block">Instructions</span>
            <p class="text-xs font-bold text-zinc-200">No Instructions Available</p>
            <p class="text-[10px] text-zinc-500 font-medium">Currently, there are no instructions for you to review. Please check back later.</p>
          </div>

          <!-- Category Shortcuts Grid -->
          <div class="space-y-3">
            <div class="flex items-center justify-between pl-1">
              <h4 class="text-[10px] font-black text-[#86868b] uppercase tracking-widest flex items-center gap-1.5">
                ⚡ PORTAL SHORTCUTS
              </h4>
            </div>
            <div class="grid grid-cols-2 gap-3">
              ${dashboardShortcuts.map(s => `
                <div 
                  onclick="window.navigateMguTab('${s.name}')"
                  class="glass-panel p-4 rounded-3xl spring active:scale-95 text-center flex flex-col items-center justify-center gap-2 cursor-pointer transition-all hover:bg-white/[0.04]"
                  style="background: rgba(255,255,255,0.03); border: 1px solid rgba(255,255,255,0.08);"
                >
                  <div class="w-11 h-11 rounded-[1rem] flex items-center justify-center text-2xl shadow-sm mb-1"
                       style="background: ${s.bg}; color: ${s.color}; border: 1px solid ${s.border};">
                    ${s.icon}
                  </div>
                  <div>
                    <h3 class="text-[13px] font-black tracking-tight text-[#1d1d1f] dark:text-[#f5f5f7] leading-tight">${s.label || s.name}</h3>
                    <p class="text-[9px] font-bold text-[#86868b] leading-[1.2] mt-0.5">${s.desc}</p>
                  </div>
                </div>
              `).join('')}
            </div>
          </div>

          <!-- Redesigned Semester Course Information -->
          <div class="space-y-4">
            <div class="flex justify-between items-center px-1 text-left">
              <div>
                <h3 class="text-xs font-black uppercase tracking-wider text-white">Course Registry</h3>
                <p class="text-[9px] text-zinc-500 font-medium mt-0.5">Semester Wise Registration Ledger</p>
              </div>
              <span class="text-[9px] font-mono bg-white/5 border border-white/10 px-2 py-0.5 rounded text-zinc-400 font-bold uppercase tracking-wider">FYUGP Scheme</span>
            </div>

            <!-- Segmented Control Semester Selector -->
            <div class="flex gap-1.5 overflow-x-auto pb-1 whitespace-nowrap scrollbar-none" style="scrollbar-width: none;">
              ${[1,2,3,4,5,6,7,8].map(num => {
                const active = S.selectedSem === num;
                return `
                  <button 
                    onclick="window.switchMguSemester(${num})"
                    class="flex-shrink-0 px-4 py-2 text-[10px] font-bold rounded-2xl transition-all duration-200 border ${
                      active 
                        ? 'bg-white/10 border-white/20 text-white shadow-sm font-black' 
                        : 'bg-white/[0.02] border-white/5 text-zinc-500 hover:text-zinc-300'
                    }"
                  >
                    Semester ${num}
                  </button>
                `;
              }).join('')}
            </div>

            <!-- Redesigned Course Cards List -->
            <div class="space-y-2.5">
              ${hasCourses ? semCourses.map((c, i) => `
                <div class="p-4 apple-glass-card text-left flex flex-col gap-3 relative overflow-hidden transition-all hover:bg-white/[0.04]">
                  <div class="flex items-center justify-between gap-2">
                    <span class="px-2.5 py-0.5 bg-[#3897f0]/10 border border-[#3897f0]/20 text-[#3897f0] font-mono text-[9px] rounded-full font-bold uppercase tracking-wide">
                      ${c.code !== '-' ? c.code : 'No Code'}
                    </span>
                    <span class="text-[8.5px] font-mono text-zinc-500 font-bold uppercase tracking-widest">
                      Course #${i + 1}
                    </span>
                  </div>

                  <div class="space-y-1">
                    <h4 class="text-sm font-bold text-white leading-snug">${c.title}</h4>
                    <p class="text-[10px] text-zinc-400 font-medium flex items-center gap-1.5">
                      <span class="w-1.5 h-1.5 rounded-full bg-zinc-600"></span> ${c.discipline}
                    </p>
                  </div>

                  <div class="pt-3 border-t border-white/5 flex items-center justify-between gap-4 text-[9.5px]">
                    <div class="flex items-center gap-1.5">
                      <span class="w-2 h-2 rounded-full ${
                        c.status.includes('Approved') 
                          ? 'bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.5)]' 
                          : 'bg-amber-500 shadow-[0_0_8px_rgba(245,158,11,0.5)]'
                      }"></span>
                      <span class="font-bold text-zinc-300">${c.status}</span>
                    </div>
                    <span class="text-zinc-500 font-medium italic truncate max-w-[150px]">
                      ${c.origin}
                    </span>
                  </div>
                </div>
              `).join('') : `
                <div class="p-8 text-center border border-dashed border-zinc-900 rounded-3xl bg-zinc-950/10">
                  <span class="text-2xl block mb-2 opacity-40">📚</span>
                  <p class="text-xs font-bold text-zinc-400">No courses registered</p>
                  <p class="text-[9.5px] text-zinc-600 mt-1 max-w-xs mx-auto">There are no opted courses found for Semester ${S.selectedSem} in the active ledger records.</p>
                </div>
              `}
            </div>
          </div>

          <!-- Latest Activity Log -->
          <div class="p-4 bg-zinc-900/10 border border-zinc-900/50 rounded-2xl text-left">
            <span class="text-[9px] font-mono text-zinc-500 font-bold uppercase tracking-widest block mb-2">Latest Activity</span>
            <p class="text-xs text-zinc-400 font-semibold mb-0.5">No Log Data Available</p>
          </div>
        </div>
      `;
    } else if (S.activeTab === 'Profile') {
      // ── PROFILE VIEW MODULE ──────────────────────────────────
      viewHtml = `
        <div class="space-y-5 animate-slideUp">
          <div class="p-6 apple-glass-card text-center space-y-4 relative overflow-hidden">
            <div class="absolute -top-12 -left-12 w-28 h-28 bg-[#3897f0]/10 rounded-full blur-2xl"></div>
            <div class="w-16 h-16 bg-[#3897f0]/15 rounded-full flex items-center justify-center mx-auto text-3xl">👤</div>
            <div class="space-y-1">
              <h3 class="text-lg font-black text-white tracking-tight">${profileData.name || ''}</h3>
              <p class="text-xs text-[#3897f0] font-mono font-bold">Cap Id : ${profileData.capId || ''}</p>
            </div>
          </div>

          <div class="p-5 apple-glass-card space-y-3.5 text-xs text-left">
            <h4 class="text-[10px] font-mono text-zinc-400 font-black uppercase tracking-widest border-b border-zinc-900 pb-2">Academic Enrolment</h4>
            <div class="flex justify-between items-center py-1">
              <span class="text-zinc-500 font-medium">Institution</span>
              <span class="text-zinc-200 font-bold text-right max-w-[200px] truncate">${profileData.college || ''}</span>
            </div>
            <div class="flex justify-between items-center py-1">
              <span class="text-zinc-500 font-medium">PRN / CAP ID</span>
              <span class="text-zinc-200 font-mono font-bold">${localStorage.getItem('machub_mgu_prn') || '199719050829'}</span>
            </div>
            <div class="flex justify-between items-center py-1">
              <span class="text-zinc-500 font-medium">Department</span>
              <span class="text-zinc-200 font-bold">${profileData.department || ''}</span>
            </div>
            <div class="flex justify-between items-center py-1">
              <span class="text-zinc-500 font-medium">Program Track</span>
              <span class="text-zinc-200 font-bold text-right">${profileData.program || ''}</span>
            </div>
            <div class="flex justify-between items-center py-1">
              <span class="text-zinc-500 font-medium">Active Semester</span>
              <span class="text-zinc-200 font-mono font-black">${profileData.currentSem || ''}</span>
            </div>
          </div>
        </div>
      `;

    } else if (S.activeTab === 'Major Switching / College Transfer') {
      viewHtml = `
        <div class="w-full flex-1 flex flex-col animate-slideUp" style="height: calc(100vh - 74px); min-height: 520px;">
          <iframe 
            src="https://cap.mgu.ac.in:8443/CTMS/transfer/Candidate/login" 
            class="w-full flex-1 border-0" 
            style="background: #fff; width: 100%; height: 100%; min-height: 520px;"
            sandbox="allow-same-origin allow-scripts allow-forms allow-popups"
          ></iframe>
        </div>
      `;
    } else if (S.activeTab === 'Course Selection') {
      // ── COURSE SELECTION WORKSPACE MODULE ────────────────────
      viewHtml = `
        <div class="space-y-5 animate-slideUp text-left">
          <div class="flex justify-between items-center">
            <div>
              <h3 class="text-base font-bold text-white leading-none">Course Selection Ledger</h3>
              <p class="text-[10px] text-zinc-500 mt-1.5 font-medium">Configure course registers, elective parameters, and sync status records.</p>
            </div>
            <span class="text-[10px] font-mono bg-white/5 border border-white/10 px-2 py-1 rounded text-zinc-400">Semester 1</span>
          </div>

          <div class="space-y-3.5">
            ${(coursesDict[1] || []).map((c, i) => `
              <div 
                onclick="window.openEditCourseSheet(1, ${i})"
                class="p-4 apple-glass-card hover:bg-white/[0.04] transition-all cursor-pointer flex flex-col sm:flex-row sm:items-center justify-between gap-4"
              >
                <div class="space-y-1.5 text-left flex-1 min-w-0">
                  <div class="flex items-center gap-2 flex-wrap">
                    <span class="px-2 py-0.5 bg-white/5 border border-white/10 text-zinc-400 font-mono text-[9px] rounded font-bold">${c.code !== '-' ? c.code : 'NOT OPTED'}</span>
                    <span class="text-xs font-bold text-zinc-200 truncate max-w-sm">${c.title}</span>
                  </div>
                  <p class="text-[10px] text-zinc-500 pl-1 font-medium">${c.discipline}</p>
                </div>
                <div class="flex items-center gap-2 self-end sm:self-auto font-mono text-[9px]">
                  <span class="px-2 py-0.5 rounded border border-emerald-500/20 bg-emerald-500/5 text-emerald-400">${c.status}</span>
                  <span class="px-2 py-0.5 bg-zinc-950 border border-zinc-900 text-zinc-500 rounded">${c.origin}</span>
                </div>
              </div>
            `).join('')}
          </div>
        </div>
      `;
    } else if (S.activeTab === 'E-Copy / RV / Scrutiny') {
      // ── E-COPY / RV / SCRUTINY VIEW MODULE ──────────────────
      viewHtml = `
        <div class="space-y-5 animate-slideUp text-left">
          <div>
            <h3 class="text-base font-bold text-white leading-none">Revaluation & Scrutiny Registry</h3>
            <p class="text-[10px] text-zinc-500 mt-1.5 font-medium">Request paper re-verifications or download digital copies from university databases.</p>
          </div>

          <div class="p-5 apple-glass-card space-y-4">
            <div class="space-y-1">
              <label class="text-[9px] font-bold text-zinc-500 uppercase tracking-widest block">Application Type</label>
              <select id="ecopy-app-type" class="w-full apple-input px-3 py-2.5 bg-zinc-900 border border-zinc-800 text-xs">
                <option value="Revaluation">Revaluation (Rs. 500/subject)</option>
                <option value="Scrutiny">Scrutiny (Rs. 250/subject)</option>
                <option value="Photocopy">E-Copy / Photocopy (Rs. 300/subject)</option>
              </select>
            </div>

            <div class="space-y-2">
              <label class="text-[9px] font-bold text-zinc-500 uppercase tracking-widest block">Select Courses</label>
              <div class="space-y-2">
                ${(coursesDict[1] || []).filter(c => c.code !== '-').map(c => `
                  <label class="flex items-center gap-3 p-3 bg-white/[0.02] border border-white/[0.04] rounded-xl cursor-pointer hover:bg-white/5 transition-all">
                    <input type="checkbox" name="ecopy-subjects" value="${c.code}" class="rounded border-zinc-800 bg-zinc-900 text-[#3897f0] focus:ring-0" />
                    <div class="text-xs">
                      <p class="font-bold text-zinc-200">${c.title}</p>
                      <p class="text-[9px] text-zinc-500 font-mono">${c.code}</p>
                    </div>
                  </label>
                `).join('')}
              </div>
            </div>

            <button onclick="window.submitEcopyForm()" class="w-full py-3 apple-btn text-xs uppercase tracking-wider font-bold active:scale-95 transition-all">
              Submit Application
            </button>
          </div>
        </div>
      `;
    } else if (S.activeTab === 'Exam Registration') {
      // ── EXAM REGISTRATION VIEW MODULE ────────────────────────
      viewHtml = `
        <div class="space-y-5 animate-slideUp text-left">
          <div>
            <h3 class="text-base font-bold text-white leading-none">Exam Registration Schedule</h3>
            <p class="text-[10px] text-zinc-500 mt-1.5 font-medium">Verify active registers and college opt-in statuses for examinations.</p>
          </div>

          <div class="p-5 apple-glass-card space-y-4">
            <div class="flex justify-between items-center border-b border-white/5 pb-3">
              <div>
                <span class="text-[9px] font-mono bg-emerald-500/10 text-emerald-400 px-2 py-0.5 rounded border border-emerald-500/20 font-bold uppercase">Active Registry</span>
                <h4 class="text-xs font-bold text-white mt-1.5">2nd Sem Regular FYUGP Exam - July 2026</h4>
              </div>
              <span class="text-lg">📝</span>
            </div>

            <div class="space-y-2 text-xs">
              <div class="flex justify-between py-1 border-b border-white/[0.02]">
                <span class="text-zinc-500">Attendance Status</span>
                <span class="text-emerald-400 font-bold">Eligible (85% Verified)</span>
              </div>
              <div class="flex justify-between py-1 border-b border-white/[0.02]">
                <span class="text-zinc-500">Hall Ticket Release</span>
                <span class="text-zinc-400">Available in Downloads</span>
              </div>
              <div class="flex justify-between py-1">
                <span class="text-zinc-500">Registration Fee</span>
                <span class="text-zinc-300 font-bold">Paid (Rs. 1,250)</span>
              </div>
            </div>

            <button onclick="window.triggerPortalDownload('Submitted_Registration_Application.pdf')" class="w-full py-3 bg-white/5 border border-white/10 text-xs font-bold rounded-xl hover:bg-white/10 active:scale-95 transition-all text-center">
              📥 Download Submitted Application
            </button>
          </div>
        </div>
      `;
    } else if (S.activeTab === 'Supply / Betterment') {
      // ── SUPPLY / BETTERMENT VIEW MODULE ──────────────────────
      viewHtml = `
        <div class="space-y-5 animate-slideUp text-left">
          <div>
            <h3 class="text-base font-bold text-white leading-none">Supplementary / Improvement</h3>
            <p class="text-[10px] text-zinc-500 mt-1.5 font-medium">Register for supplementary or improvement (betterment) semester exams.</p>
          </div>

          <div class="p-5 apple-glass-card space-y-4 text-center py-10">
            <span class="text-3xl block mb-2">📈</span>
            <h4 class="text-xs font-bold text-white">No active supplementary registers available</h4>
            <p class="text-[10.5px] text-zinc-500 max-w-xs mx-auto leading-relaxed mt-1">Official betterment registrations for prior semesters will list here dynamically once scheduled by Mahatma Gandhi University.</p>
          </div>
        </div>
      `;
    } else if (S.activeTab === 'Condonation') {
      // ── CONDONATION VIEW MODULE ──────────────────────────────
      viewHtml = `
        <div class="space-y-5 animate-slideUp text-left">
          <div>
            <h3 class="text-base font-bold text-white leading-none">Attendance Shortage Condonation</h3>
            <p class="text-[10px] text-zinc-500 mt-1.5 font-medium">Apply for condonation benefits due to authorized medical or institutional leave.</p>
          </div>

          <div class="p-5 apple-glass-card space-y-4">
            <div class="grid grid-cols-2 gap-3">
              <div class="space-y-1">
                <label class="text-[9px] font-bold text-zinc-500 uppercase tracking-widest block">Shortage Days</label>
                <input id="condonation-days" type="number" class="w-full apple-input px-3.5 py-2.5 font-mono" placeholder="e.g. 5" />
              </div>
              <div class="space-y-1">
                <label class="text-[9px] font-bold text-zinc-500 uppercase tracking-widest block">Reason Category</label>
                <select id="condonation-reason" class="w-full apple-input px-3 py-2.5 bg-zinc-900 border border-zinc-800 text-xs">
                  <option value="Medical">Medical Shortage</option>
                  <option value="Sports">Sports / Cultural</option>
                  <option value="NSS/NCC">NSS / NCC Duties</option>
                  <option value="Other">Other Reasons</option>
                </select>
              </div>
            </div>

            <div class="space-y-1">
              <label class="text-[9px] font-bold text-zinc-500 uppercase tracking-widest block">Mock Certificate Upload</label>
              <div class="border border-dashed border-zinc-800 hover:border-zinc-700 rounded-xl p-6 text-center cursor-pointer bg-zinc-950/20 transition-all">
                <span class="text-xs text-zinc-500 font-medium">📄 Click to select medical certificate mockup</span>
              </div>
            </div>

            <button onclick="window.submitCondonationForm()" class="w-full py-3 apple-btn text-xs uppercase tracking-wider font-bold active:scale-95 transition-all">
              Submit Condonation
            </button>
          </div>
        </div>
      `;
    } else if (S.activeTab === 'Readmission') {
      // ── READMISSION VIEW MODULE ──────────────────────────────
      viewHtml = `
        <div class="space-y-5 animate-slideUp text-left">
          <div>
            <h3 class="text-base font-bold text-white leading-none">Readmission & College Breaks</h3>
            <p class="text-[10px] text-zinc-500 mt-1.5 font-medium">Request readmission into active semesters following college breaks or exit paths.</p>
          </div>

          <div class="p-5 apple-glass-card space-y-4">
            <div class="space-y-1">
              <label class="text-[9px] font-bold text-zinc-500 uppercase tracking-widest block">Target Semester for Readmission</label>
              <select id="readmit-target-sem" class="w-full apple-input px-3 py-2.5 bg-zinc-900 border border-zinc-800 text-xs font-mono">
                <option value="Sem 2">Semester 2</option>
                <option value="Sem 3">Semester 3</option>
                <option value="Sem 4">Semester 4</option>
              </select>
            </div>

            <button onclick="window.submitReadmissionForm()" class="w-full py-3 apple-btn text-xs uppercase tracking-wider font-bold active:scale-95 transition-all">
              Submit Readmission Request
            </button>
          </div>
        </div>
      `;
    } else if (S.activeTab === 'Internship') {
      // ── INTERNSHIP VIEW MODULE ───────────────────────────────
      viewHtml = `
        <div class="space-y-5 animate-slideUp text-left">
          <div>
            <h3 class="text-base font-bold text-white leading-none">Mandatory Internship Registry</h3>
            <p class="text-[10px] text-zinc-500 mt-1.5 font-medium">Log authorized FYUGP industrial internship coordinates and mentor details.</p>
          </div>

          <div class="p-5 apple-glass-card space-y-4">
            <div class="space-y-3">
              <div class="space-y-1">
                <label class="text-[9px] font-bold text-zinc-500 uppercase tracking-widest block">Company Name</label>
                <input id="internship-company" type="text" class="w-full apple-input px-3.5 py-2.5" placeholder="e.g. Infopark Kochi" />
              </div>
              <div class="space-y-1">
                <label class="text-[9px] font-bold text-zinc-500 uppercase tracking-widest block">Project Title</label>
                <input id="internship-title" type="text" class="w-full apple-input px-3.5 py-2.5" placeholder="e.g. Cloud System Integration" />
              </div>
              <div class="grid grid-cols-2 gap-3">
                <div class="space-y-1">
                  <label class="text-[9px] font-bold text-zinc-500 uppercase tracking-widest block">Mentor Name</label>
                  <input id="internship-mentor" type="text" class="w-full apple-input px-3.5 py-2.5" placeholder="Supervisor name" />
                </div>
                <div class="space-y-1">
                  <label class="text-[9px] font-bold text-zinc-500 uppercase tracking-widest block">Credits</label>
                  <input type="text" disabled class="w-full apple-input px-3.5 py-2.5 font-mono text-zinc-500" value="4 CR" />
                </div>
              </div>
            </div>

            <button onclick="window.submitInternshipForm()" class="w-full py-3 apple-btn text-xs uppercase tracking-wider font-bold active:scale-95 transition-all">
              Save Internship Records
            </button>
          </div>
        </div>
      `;
    } else if (S.activeTab === 'External Credit Application') {
      // ── EXTERNAL CREDIT VIEW MODULE ──────────────────────────
      viewHtml = `
        <div class="space-y-5 animate-slideUp text-left">
          <div>
            <h3 class="text-base font-bold text-white leading-none">External Credit Transfers</h3>
            <p class="text-[10px] text-zinc-500 mt-1.5 font-medium">Apply for external credit transfers acquired from SWAYAM, NPTEL, or approved MOOC networks.</p>
          </div>

          <div class="p-5 apple-glass-card space-y-4">
            <div class="space-y-3">
              <div class="space-y-1">
                <label class="text-[9px] font-bold text-zinc-500 uppercase tracking-widest block">Course Provider Platform</label>
                <select id="credit-platform" class="w-full apple-input px-3 py-2.5 bg-zinc-900 border border-zinc-800 text-xs">
                  <option value="Swayam">Swayam / NPTEL (Official)</option>
                  <option value="Coursera">Coursera Academic</option>
                  <option value="edX">edX platform</option>
                </select>
              </div>
              <div class="space-y-1">
                <label class="text-[9px] font-bold text-zinc-500 uppercase tracking-widest block">Course Title</label>
                <input id="credit-title" type="text" class="w-full apple-input px-3.5 py-2.5" placeholder="e.g. Introduction to IoT" />
              </div>
              <div class="space-y-1">
                <label class="text-[9px] font-bold text-zinc-500 uppercase tracking-widest block">Credits claimed (1-4)</label>
                <input id="credit-qty" type="number" min="1" max="4" class="w-full apple-input px-3.5 py-2.5 font-mono" placeholder="4" />
              </div>
            </div>

            <button onclick="window.submitCreditForm()" class="w-full py-3 apple-btn text-xs uppercase tracking-wider font-bold active:scale-95 transition-all">
              Submit Credit Request
            </button>
          </div>
        </div>
      `;
    } else if (S.activeTab === 'Downloads') {
      // ── DOWNLOADS VIEW MODULE ────────────────────────────────
      viewHtml = `
        <div class="space-y-5 animate-slideUp text-left">
          <div>
            <h3 class="text-base font-bold text-white leading-none">Official Document Downloads</h3>
            <p class="text-[10px] text-zinc-500 mt-1.5 font-medium">Download university grade cards, guidelines, and registered schedules.</p>
          </div>

          <div class="space-y-3">
            <div class="p-4 apple-glass-card flex items-center justify-between gap-3">
              <div class="space-y-0.5">
                <h5 class="text-xs font-bold text-white">Semester 1 Grade Card (Provisional)</h5>
                <p class="text-[9.5px] text-zinc-500 font-mono uppercase">PDF • 1.2 MB</p>
              </div>
              <button onclick="window.triggerPortalDownload('Semester_1_Grade_Card.pdf')" class="px-3.5 py-2 bg-white/5 border border-white/10 hover:bg-white/10 active:scale-95 transition-all text-white rounded-xl text-[10px] font-bold uppercase tracking-wider">
                Download
              </button>
            </div>

            <div class="p-4 apple-glass-card flex items-center justify-between gap-3">
              <div class="space-y-0.5">
                <h5 class="text-xs font-bold text-white">Mandatory Internship Guidelines</h5>
                <p class="text-[9.5px] text-zinc-500 font-mono uppercase">PDF • 850 KB</p>
              </div>
              <button onclick="window.triggerPortalDownload('Internship_Guidelines.pdf')" class="px-3.5 py-2 bg-white/5 border border-white/10 hover:bg-white/10 active:scale-95 transition-all text-white rounded-xl text-[10px] font-bold uppercase tracking-wider">
                Download
              </button>
            </div>

            <div class="p-4 apple-glass-card flex items-center justify-between gap-3">
              <div class="space-y-0.5">
                <h5 class="text-xs font-bold text-white">FYUGP Honours Syllabus Schema</h5>
                <p class="text-[9.5px] text-zinc-500 font-mono uppercase">PDF • 2.4 MB</p>
              </div>
              <button onclick="window.triggerPortalDownload('Honours_Syllabus.pdf')" class="px-3.5 py-2 bg-white/5 border border-white/10 hover:bg-white/10 active:scale-95 transition-all text-white rounded-xl text-[10px] font-bold uppercase tracking-wider">
                Download
              </button>
            </div>

            <div class="p-4 apple-glass-card flex items-center justify-between gap-3">
              <div class="space-y-0.5">
                <h5 class="text-xs font-bold text-white">Sem 2 Examination Hall Ticket</h5>
                <p class="text-[9.5px] text-zinc-500 font-mono uppercase">PDF • 450 KB</p>
              </div>
              <button onclick="window.triggerPortalDownload('Hall_Ticket_Sem2.pdf')" class="px-3.5 py-2 bg-white/5 border border-white/10 hover:bg-white/10 active:scale-95 transition-all text-white rounded-xl text-[10px] font-bold uppercase tracking-wider">
                Download
              </button>
            </div>
          </div>
        </div>
      `;
    } else {
      // ── GENERAL PLACEMENT VIEW MODULE ────────────────────────
      viewHtml = `
        <div class="text-center py-20 border border-dashed border-zinc-900 rounded-[32px] text-zinc-500 bg-zinc-950/20 backdrop-blur-xl max-w-sm mx-auto">
          <span class="text-[10px] font-mono text-[#3897f0] font-black uppercase tracking-[0.2em] block mb-2">${S.activeTab} MODULE</span>
          <p class="text-zinc-200 font-bold mb-1">Secure portal module initialized</p>
          <p class="text-[10.5px] text-zinc-500 font-medium px-6 leading-relaxed max-w-xs mx-auto">Scraped local layouts process sandbox metrics here. Dynamic live sync triggers update once approved registers are received.</p>
        </div>
      `;

    }

    container.innerHTML = `
      <div class="w-full flex-1 flex flex-col relative select-none">
        <!-- Top Toolbar Header Bar -->
        <header class="w-full flex items-center justify-between mt-2 mb-4 relative ${S.activeTab === 'Major Switching / College Transfer' ? 'px-6' : ''}">
          <!-- Left: Spacer (keeps MGU logo perfectly centered) -->
          <div class="w-10 h-10"></div>

          <!-- Center: MGU Logo -->
          <div class="logo-container" style="display:flex;align-items:center;justify-content:center;">
            <img src="assets/img/mgu_logo.png" alt="MGU Logo" class="logo animate-float" style="margin: 0; height: 32px; width: auto; object-fit: contain;">
          </div>

          <!-- Right: Hamburger Menu Button OR Back Button -->
          ${S.activeTab === 'Dashboard' ? `
            <button 
              onclick="window.toggleMguSideDrawer(true)"
              class="w-10 h-10 rounded-full glass-panel flex items-center justify-center spring hover:scale-105 active:scale-95 shadow-sm text-lg z-30"
              style="background: rgba(255,255,255,0.08); border: 1px solid rgba(255,255,255,0.1);"
              aria-label="Open MGU Menu"
            >
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" class="text-[#1d1d1f] dark:text-[#f5f5f7]">
                <line x1="3" y1="12" x2="21" y2="12"></line>
                <line x1="3" y1="6" x2="21" y2="6"></line>
                <line x1="3" y1="18" x2="21" y2="18"></line>
              </svg>
            </button>
          ` : `
            <button 
              onclick="window.navigateMguTab('Dashboard')"
              class="w-10 h-10 rounded-full glass-panel flex items-center justify-center spring hover:scale-105 active:scale-95 shadow-sm text-lg z-30"
              style="background: rgba(255,255,255,0.08); border: 1px solid rgba(255,255,255,0.1);"
              aria-label="Back to Dashboard"
            >
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" class="text-[#1d1d1f] dark:text-[#f5f5f7]">
                <polyline points="15 18 9 12 15 6"></polyline>
              </svg>
            </button>
          `}
        </header>

        <!-- Course Edit Modal Sheet -->
        <div id="apple-course-modal-sheet" class="apple-modal-sheet apple-glass"></div>

        <!-- Main Workspace panel view scroll block -->
        <main class="flex-1 flex flex-col ${S.activeTab === 'Major Switching / College Transfer' ? 'pt-0 pb-0' : 'pt-2 pb-12'} overflow-y-auto">
          ${S.activeTab !== 'Major Switching / College Transfer' ? `
            <div class="mb-4 text-left pl-1">
              <span class="text-[9px] font-mono text-[#3897f0] font-black uppercase tracking-[0.2em]">MGU ePortal</span>
              <h2 class="text-xl font-black text-white leading-none mt-1">${S.activeTab}</h2>
            </div>
          ` : ''}
          ${viewHtml}
        </main>

        <!-- Portal Site footer credits -->
        ${S.activeTab !== 'Major Switching / College Transfer' ? `
          <footer class="pt-6 border-t border-zinc-900/60 mt-auto text-center space-y-1">
            <p class="text-[8px] font-mono text-zinc-500">© Mahatma Gandhi University, Priyadarsini Hills, Kottayam, Kerala, India - 686560</p>
          </footer>
        ` : ''}
      </div>
    `;

    // Ensure the MGU bottom drawer and backdrop exist on document.body for top-level stacking context
    let drawer = $('mgu-side-drawer');
    let backdrop = $('mgu-drawer-backdrop');

    if (!backdrop) {
      backdrop = document.createElement('div');
      backdrop.id = 'mgu-drawer-backdrop';
      backdrop.className = 'mgu-drawer-backdrop';
      backdrop.onclick = window.closeDrawerOverlays;
      document.body.appendChild(backdrop);
    }

    if (!drawer) {
      drawer = document.createElement('aside');
      drawer.id = 'mgu-side-drawer';
      drawer.className = 'mgu-side-drawer apple-glass flex flex-col p-5 overflow-y-auto';
      document.body.appendChild(drawer);
    }

    // Update the drawer content dynamically
    drawer.innerHTML = `
      <!-- Top Drag Handle -->
      <div class="w-12 h-1 bg-white/20 rounded-full mx-auto mb-4 cursor-pointer" onclick="window.toggleMguSideDrawer(false)"></div>

      <div class="flex items-center justify-between border-b border-white/5 pb-4 mb-4">
        <div class="flex items-center gap-2.5">
          <div class="w-8 h-8 rounded-xl bg-white/5 border border-white/10 flex items-center justify-center font-bold text-xs text-[#3897f0]">MG</div>
          <div class="text-left">
            <span class="text-[9px] font-mono text-zinc-500 uppercase tracking-wider font-bold">University Module</span>
            <h4 class="text-xs font-bold text-white">Menu Options</h4>
          </div>
        </div>
        <button onclick="window.toggleMguSideDrawer(false)" class="text-sm font-bold text-zinc-500 hover:text-white px-2 py-1">✕</button>
      </div>

      <nav class="space-y-1.5 text-left mb-4">
        ${menuSuite.map(m => {
          const activeClass = S.activeTab === m.name ? 'active' : '';
          return `
            <button 
              onclick="window.navigateMguTab('${m.name}')" 
              class="menu-item-link ${activeClass}"
            >
              <span class="text-base flex-shrink-0">${m.icon}</span>
              <span class="truncate">${m.name}</span>
            </button>
          `;
        }).join('')}
      </nav>

      <!-- Drawer Footer/Logout section -->
      <div class="pt-4 border-t border-white/5 space-y-3">
        <button 
          onclick="window.mguPortalLogout()"
          class="w-full py-2.5 bg-red-500/10 border border-red-500/25 hover:bg-red-500/20 active:scale-95 transition-all text-red-400 font-bold text-xs rounded-xl flex items-center justify-center gap-2"
        >
          <span>🚪</span> Logout Account
        </button>
        <p class="text-[9px] font-mono text-zinc-600 text-center">CAP ID: ${profileData.capId || ''}</p>
      </div>
    `;
  }
  window.submitEcopyForm = function() {
    alert("Application for Revaluation / Scrutiny submitted successfully! Dynamic fee of Rs. 1000 will be added to your ledger.");
    window.navigateMguTab('Dashboard');
  };
  window.submitCondonationForm = function() {
    alert("Condonation request submitted to Principal's desk. Attendance shortage is under review.");
    window.navigateMguTab('Dashboard');
  };
  window.submitReadmissionForm = function() {
    alert("Readmission request logged. Please check back for University verification.");
    window.navigateMguTab('Dashboard');
  };
  window.submitInternshipForm = function() {
    alert("Mandatory internship details saved and synced to department supervisor.");
    window.navigateMguTab('Dashboard');
  };
  window.submitCreditForm = function() {
    alert("External MOOC credits request sent. Verified completion certificates are being cross-referenced.");
    window.navigateMguTab('Dashboard');
  };
  window.triggerPortalDownload = function(fileName) {
    alert(`Downloading: ${fileName}... 📥`);
  };

  window.mguPortalLogout = function () {
    localStorage.removeItem('machub_mgu_prn');
    localStorage.removeItem('machub_mgu_pass');
    
    const profile = getStudentInfo() || {};
    if (profile.mguData) {
      delete profile.mguData;
      if (window.ExamHubProfile && typeof window.ExamHubProfile.save === 'function') {
        window.ExamHubProfile.save(profile);
      } else {
        localStorage.setItem('mac_student_info', JSON.stringify(profile));
      }
    }

    S.hasCredentials = false;
    S.prn = '';
    S.password = '';
    S.mguProfile = null;
    S.activeTab = 'Dashboard';
    S.isDrawerOpen = false;

    renderMguPortalHub();
  };

  // ── Close all overlays ───────────────────────────────────────
  window.closeDrawerOverlays = function () {
    window.toggleMguSideDrawer(false);
    window.closeEditCourseSheet();
  };

  // ── WorkSpace Init ───────────────────────────────────────────
  window.initResourcesWorkspace = function () {
    const cachedPrn = localStorage.getItem('machub_mgu_prn');
    const cachedPass = localStorage.getItem('machub_mgu_pass');
    
    if (cachedPrn && cachedPass) {
      S.prn = cachedPrn;
      S.password = cachedPass;
      S.hasCredentials = true;
      executeMguScraperPipeline(cachedPrn, cachedPass);
    } else {
      S.hasCredentials = false;
      renderMguPortalHub();
    }
  };

  // Hook into main view switching
  document.addEventListener('DOMContentLoaded', () => {
    const originalSwitchView = window.switchView;
    if (originalSwitchView) {
      window.switchView = function(viewId) {
        originalSwitchView(viewId);
        if (viewId === 'view-resources') {
          window.initResourcesWorkspace();
        }
      };
    }
    // Auto-init on initial load if starting on resources
    if (localStorage.getItem('machub_current_view') === 'view-resources') {
      window.initResourcesWorkspace();
    }
  });

})();
