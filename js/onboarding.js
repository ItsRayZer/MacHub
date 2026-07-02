/**
 * Smart Onboarding Controller
 * Handles the new smart search flow in onboarding
 */

window._selectedStudentFromDB = window._selectedStudentFromDB || null;
let _profileTiltBound = false;

function escapeHtml(value) {
    return String(value || '').replace(/[&<>"']/g, char => ({
        '&': '&amp;',
        '<': '&lt;',
        '>': '&gt;',
        '"': '&quot;',
        "'": '&#39;'
    }[char]));
}

function profileAccent(student) {
    const palette = ['#0071e3', '#34c759', '#ff9f0a', '#ff375f', '#5e5ce6', '#32ade6'];
    const seed = `${student?.adminNo || ''}${student?.classNo || ''}${student?.name || ''}`;
    const code = seed.split('').reduce((sum, char) => sum + char.charCodeAt(0), 0);
    return palette[code % palette.length];
}

window.initOnboardingBackground = function() {
    const bgContainer = document.getElementById('ob-mesh-bg');
    if (!bgContainer) return;
    
    // Hardcoded color palettes derived from the images to ensure 0 CPU overhead
    const backgrounds = [
        { image: 'assets/onboarding_bg/bg1.jpg', colors: ['#3b82f6', '#a855f7', '#ec4899', '#6366f1'] },
        { image: 'assets/onboarding_bg/bg2.jpg', colors: ['#10b981', '#3b82f6', '#14b8a6', '#8b5cf6'] },
        { image: 'assets/onboarding_bg/bg3.jpg', colors: ['#f59e0b', '#ef4444', '#db2777', '#f97316'] },
        { image: 'assets/onboarding_bg/bg4.jpg', colors: ['#6366f1', '#4ade80', '#0ea5e9', '#d946ef'] },
        { image: 'assets/onboarding_bg/bg5.jpg', colors: ['#eab308', '#ec4899', '#8b5cf6', '#3b82f6'] },
        { image: 'assets/onboarding_bg/bg6.jpg', colors: ['#f43f5e', '#a855f7', '#3b82f6', '#06b6d4'] },
        { image: 'assets/onboarding_bg/bg7.jpg', colors: ['#8b5cf6', '#ec4899', '#f43f5e', '#f97316'] },
        { image: 'assets/onboarding_bg/bg8.jpg', colors: ['#14b8a6', '#3b82f6', '#6366f1', '#a855f7'] },
        { image: 'assets/onboarding_bg/bg9.jpg', colors: ['#ec4899', '#f43f5e', '#eab308', '#22c55e'] },
        { image: 'assets/onboarding_bg/bg10.jpeg', colors: ['#3b82f6', '#8b5cf6', '#d946ef', '#f43f5e'] },
        { image: 'assets/onboarding_bg/bg11.jpeg', colors: ['#22c55e', '#14b8a6', '#0ea5e9', '#3b82f6'] },
        { image: 'assets/onboarding_bg/bg12.jpeg', colors: ['#f97316', '#eab308', '#22c55e', '#14b8a6'] }
    ];
    
    const randomIndex = Math.floor(Math.random() * backgrounds.length);
    const selected = backgrounds[randomIndex];
    
    // 1. Immediately inject the CSS variables for colors so the fluid blobs appear and animate INSTANTLY.
    bgContainer.style.setProperty('--mesh-color-1', selected.colors[0]);
    bgContainer.style.setProperty('--mesh-color-2', selected.colors[1]);
    bgContainer.style.setProperty('--mesh-color-3', selected.colors[2]);
    bgContainer.style.setProperty('--mesh-color-4', selected.colors[3]);
    
    // 2. Set an initial fast-loading dark background
    bgContainer.style.backgroundColor = '#050505';
    
    // 3. Asynchronously load and off-thread decode the heavy JPEG image to prevent UI stutter/lag
    const img = new Image();
    img.src = selected.image;
    
    const applyImage = () => {
        requestAnimationFrame(() => {
            bgContainer.style.backgroundImage = `url('${selected.image}')`;
        });
    };

    if ('decode' in img) {
        // Off-main-thread decoding prevents the page from freezing when loading large 300KB JPEGs
        img.decode().then(applyImage).catch(applyImage);
    } else {
        img.onload = applyImage;
    }
};

function syncSelectedProfileToObData() {
    if (!window._selectedStudentFromDB) return null;
    if (!window.obData) window.obData = { name: '', dept: '', reg: '', adminNo: '' };

    window.obData.name = window._selectedStudentFromDB.name || '';
    window.obData.reg = window._selectedStudentFromDB.regNo || '';
    window.obData.adminNo = window._selectedStudentFromDB.adminNo || '';
    window.obData.dept = window._selectedStudentFromDB.department || '';
    window.obData.classGroup = window._selectedStudentFromDB.classGroup || '';
    window.obData.classNo = window._selectedStudentFromDB.classNo || '';
    window.obData.semester = window._selectedStudentFromDB.semester || '';
    return window.obData;
}

function buildProfileFromObData() {
    const data = syncSelectedProfileToObData() || window.obData || {};
    return {
        name: (data.name || '').trim(),
        dept: (data.dept || '').trim(),
        reg: (data.reg || '').trim(),
        adminNo: (data.adminNo || '').trim(),
        classGroup: data.classGroup || '',
        classNo: data.classNo || '',
        semester: data.semester || ''
    };
}

function saveProfile(profile) {
    if (window.ExamHubProfileApi) {
        window.ExamHubProfileApi.saveStudentInfo(profile);
    } else if (window.ExamHubProfile) {
        window.ExamHubProfile.save(profile);
    } else {
        try {
            localStorage.setItem('mac_student_info', JSON.stringify(profile));
        } catch (error) {
            console.warn('localStorage is restricted', error);
        }
    }
}

async function enterAppWithProfile(profile) {
    saveProfile(profile);

    if (profile.adminNo && typeof window.checkCredentialStatus === 'function') {
        await window.checkCredentialStatus(profile.adminNo);
        if (window.isPortalLocked) {
            const obScreen = document.getElementById('onboardingScreen');
            if (obScreen) {
                obScreen.classList.add('collapsed', 'hidden');
                obScreen.style.pointerEvents = 'none';
                setTimeout(() => {
                    obScreen.style.display = 'none';
                }, 450);
            }
            return;
        }
    }

    const obScreen = document.getElementById('onboardingScreen');
    if (obScreen) {
        obScreen.classList.add('collapsed', 'hidden');
        obScreen.style.pointerEvents = 'none';
        setTimeout(() => {
            obScreen.style.display = 'none';
        }, 450);
    }

    if (typeof window.applyUserProfile === 'function') {
        window.applyUserProfile();
    } else {
        const firstName = profile.name.split(/\s+/)[0] || 'there';
        const greetingEl = document.getElementById('homeGreeting');
        if (greetingEl) greetingEl.textContent = `Hi, ${firstName}!`;

        const deptEl = document.getElementById('homeUserDept');
        if (deptEl) deptEl.textContent = profile.dept || profile.classGroup || '---';
    }

    if (typeof window.autoSelectNextExamDay === 'function') window.autoSelectNextExamDay();
    if (profile.adminNo && typeof window.startBackgroundSync === 'function') window.startBackgroundSync();
    
    // Always navigate to home screen upon login/onboarding completion
    if (typeof window.switchView === 'function') {
        window.switchView('view-home');
    }
    
    // Explicitly show bottom navigation menu
    if (typeof window.showBottomNav === 'function') {
        window.showBottomNav();
    }
}

async function finishSmartOnboarding(event) {
    if (event?.preventDefault) event.preventDefault();
    const profile = buildProfileFromObData();

    if (!profile.name || !profile.dept) {
        alert('Please choose your profile or complete the manual setup.');
        window.nextObStep(window._selectedStudentFromDB ? 3 : 2.5);
        return false;
    }

    // Save profile and enter app immediately — no loading screen, no portal handshake
    localStorage.setItem('machub_student_id', profile.adminNo || '');
    saveProfile(profile);

    // Try to restore any existing cloud cache silently in the background
    if (profile.adminNo) {
        (async () => {
            try {
                // Authenticate first
                if (window.authenticateFirebase) {
                    await window.authenticateFirebase(profile.adminNo);
                }
                // Attempt Firestore restore if Firebase is available (silent, no UI)
                if (window.firebaseFirestore && window.firestoreDoc && window.firestoreGetDoc) {
                    const docRef = window.firestoreDoc(window.firebaseFirestore, 'students', profile.adminNo);
                    const docSnap = await window.firestoreGetDoc(docRef);
                    if (docSnap.exists()) {
                        const docData = docSnap.data();
                        for (const key of Object.keys(docData)) {
                            const cachedSection = docData[key];
                            if (cachedSection && cachedSection.data) {
                                let section = key;
                                let semester = '';
                                if (key.includes('_sem')) {
                                    const parts = key.split('_sem');
                                    section = parts[0];
                                    semester = parts[1];
                                }
                                const keyName = `machub_portal_${section}${semester ? `_sem${semester}` : ''}_${profile.adminNo}`;
                                // Only write if not already cached locally
                                if (!localStorage.getItem(keyName)) {
                                    localStorage.setItem(keyName, JSON.stringify({
                                        data: cachedSection.data,
                                        savedAt: Date.now()
                                    }));
                                }
                            }
                        }
                    }
                }
            } catch (e) {
                // Silent — cloud restore is best-effort only
            }

            // Trigger background scrape after entering app
            if (window.startBackgroundScrapeQueue) {
                window.startBackgroundScrapeQueue(profile.adminNo);
            }
        })();
    }

    enterAppWithProfile(profile);
    return false;
}

// Generic high-performance 3D Card tilting & holographic reflection physics binder
const activeTiltLoops = {};
function bindCardTilt(containerId, ticketId) {
    const el = document.getElementById(containerId);
    const ticket = document.getElementById(ticketId);
    if (!el || !ticket) return;

    // Check performance settings from storage
    let settings = { highFidelity: true };
    try {
        const stored = localStorage.getItem('mac_profile_settings');
        if (stored) settings = JSON.parse(stored);
    } catch(e) {}

    // Clean up old listeners
    const oldListeners = el._cardTiltListeners;
    if (oldListeners) {
        el.removeEventListener('pointermove', oldListeners.move);
        el.removeEventListener('pointerleave', oldListeners.leave);
        if (oldListeners.click && oldListeners.ticket) {
            oldListeners.ticket.removeEventListener('click', oldListeners.click);
        }
    }

    if (activeTiltLoops[containerId]) {
        cancelAnimationFrame(activeTiltLoops[containerId]);
        delete activeTiltLoops[containerId];
    }

    // Reset styles
    el.style.setProperty('--o', '0');
    el.style.setProperty('--rx', '0deg');
    el.style.setProperty('--ry', '0deg');
    el.style.setProperty('--rx-num', '0');
    el.style.setProperty('--ry-num', '0');
    
    ticket.style.setProperty('--o', '0');
    ticket.style.setProperty('--rx', '0deg');
    ticket.style.setProperty('--ry', '0deg');
    ticket.style.setProperty('--rx-num', '0');
    ticket.style.setProperty('--ry-num', '0');

    let currentX = 0; // tilt Y
    let currentY = 0; // tilt X
    let currentFlipY = 0;
    let targetX = 0;
    let targetY = 0;
    let targetFlipY = 0; // 0 or 180
    let isActive = false;
    let autoRotation = 0;

    const onPointerMove = event => {
        const rect = ticket.getBoundingClientRect();
        const x = event.clientX - rect.left;
        const y = event.clientY - rect.top;
        
        const px = Math.max(0, Math.min(1, x / rect.width));
        const py = Math.max(0, Math.min(1, y / rect.height));
        
        // Invert horizontal tilt when card is flipped
        const factor = targetFlipY === 180 ? -1 : 1;
        targetX = (px - 0.5) * 40 * factor; 
        targetY = (0.5 - py) * 40;
        
        ticket.style.setProperty('--p', `${px * 100}%`);
        ticket.style.setProperty('--h', `${py * 100}%`);
        ticket.style.setProperty('--o', '1');
        isActive = true;
    };

    const onPointerLeave = () => {
        targetX = 0;
        targetY = 0;
        ticket.style.setProperty('--o', '0');
        isActive = false;
    };

    const onClick = () => {
        targetFlipY = targetFlipY === 0 ? 180 : 0;
        ticket.classList.toggle('is-flipped', targetFlipY === 180);
    };

    el.addEventListener('pointermove', onPointerMove, { passive: true });
    el.addEventListener('pointerleave', onPointerLeave, { passive: true });
    ticket.addEventListener('click', onClick);

    // Store listener references for clean teardown
    el._cardTiltListeners = { move: onPointerMove, leave: onPointerLeave, click: onClick, ticket: ticket };

    function loop() {
        if (!el || !document.body.contains(el) || el.offsetParent === null) {
            delete activeTiltLoops[containerId];
            return;
        }

        if (!isActive) {
            autoRotation += 0.2; // Slow auto rotation
            targetX = Math.sin(autoRotation * Math.PI / 180) * 15;
            targetY = Math.cos(autoRotation * 0.8 * Math.PI / 180) * 5;
            
            const autoPx = (Math.sin(autoRotation * Math.PI / 180) + 1) / 2;
            const autoPy = (Math.cos(autoRotation * Math.PI / 180) + 1) / 2;
            ticket.style.setProperty('--p', `${autoPx * 100}%`);
            ticket.style.setProperty('--h', `${autoPy * 100}%`);
            ticket.style.setProperty('--o', '0.6');
        }

        currentX += (targetX - currentX) * 0.1;
        currentY += (targetY - currentY) * 0.1;
        currentFlipY += (targetFlipY - currentFlipY) * 0.1;
        
        const totalRotY = currentX + currentFlipY;
        
        ticket.style.setProperty('--rx', `${currentY}deg`);
        ticket.style.setProperty('--ry', `${totalRotY}deg`);
        ticket.style.setProperty('--rx-num', String(currentY));
        ticket.style.setProperty('--ry-num', String(totalRotY));
        
        activeTiltLoops[containerId] = requestAnimationFrame(loop);
    }
    
    activeTiltLoops[containerId] = requestAnimationFrame(loop);
}

window.bindCardTilt = bindCardTilt;

function bindProfileCardTilt() {
    if (_profileTiltBound) return;
    _profileTiltBound = true;
    
    const el = document.getElementById('ob-ticket-container');
    if (!el) {
        _profileTiltBound = false;
        return;
    }
    
    bindCardTilt('ob-ticket-container', 'ob-ticketEl');
}

// Override the old nextObStep
window.nextObStep = function(step) {
    // Hide all steps
    ['ob-step-1','ob-step-2','ob-step-2b','ob-step-3'].forEach(id => {
        const el = document.getElementById(id);
        if (el) {
            el.classList.add('hidden');
            el.style.display = '';
        }
    });
    ['dot-1','dot-2','dot-3'].forEach(id => {
        document.getElementById(id)?.classList.remove('active');
    });

    if (step === 1) {
        const s1 = document.getElementById('ob-step-1');
        if (s1) {
            s1.classList.remove('hidden');
            s1.style.display = '';
        }
        document.getElementById('dot-1')?.classList.add('active');
    } else if (step === 2) {
        const s1 = document.getElementById('ob-step-1');
        if (s1) {
            s1.classList.remove('hidden');
            s1.style.display = '';
        }
        document.getElementById('dot-1')?.classList.add('active');
        setTimeout(() => document.getElementById('ob-smart-search')?.focus(), 160);
        setTimeout(() => document.getElementById('ob-smart-search')?.focus(), 200);
    } else if (step === 2.5) {
        // Manual Entry Step
        const s2b = document.getElementById('ob-step-2b');
        if (s2b) {
            s2b.classList.remove('hidden');
            s2b.style.display = '';
        }
        document.getElementById('dot-2')?.classList.add('active');
    } else if (step === 3) {
        // From manual entry (step-2b) - build student from form
        if (!window._selectedStudentFromDB) {
            const name = (document.getElementById('ob-name')?.value || '').trim();
            const reg = (document.getElementById('ob-reg')?.value || '').trim();
            const adminNo = (document.getElementById('ob-adminNo')?.value || '').trim();
            if (!name || !window.obData?.dept) {
                alert('Please enter your name and select a department.');
                window.nextObStep(2.5);
                return;
            }
            window._selectedStudentFromDB = {
                name: name.toUpperCase(), 
                regNo: reg.toUpperCase(), 
                adminNo, 
                classNo: '',
                department: window.obData.dept,
                classGroup: window.obData.dept,
                semester: 'Sem 2'
            };
        }

        // Populate confirm card
        const card = document.getElementById('ob-confirm-card');
        if (card && window._selectedStudentFromDB) {
            const s = window._selectedStudentFromDB;
            // 3D Holographic ID Card markup
            card.innerHTML = `
                <div id="ob-ticket-container" class="mb-4 relative z-10 mx-auto">
                    <section class="ob-ticket" id="ob-ticketEl">
                        <!-- FRONT FACE (visible to user) — all student data here -->
                        <section class="ob-ticket-front">
                            <div class="ob-ticket-holo"></div>
                            <img class="ob-ticket-logo-small" src="assets/img/file_00000000378c7207842a975d80367515.png" alt="MacHub">
                            <div class="data">
                                <h3>Name</h3>
                                <p>${escapeHtml(s.name || '---')}</p>
                                <h3>Department</h3>
                                <p>${escapeHtml(s.classGroup || s.department || '---')}</p>
                                ${s.regNo ? `<h3>Reg No</h3><p>${escapeHtml(s.regNo)}</p>` : ''}
                                ${s.adminNo ? `<h3>Admission No</h3><p>${escapeHtml(s.adminNo)}</p>` : ''}
                                ${s.classNo ? `<h3>Class Roll</h3><p>${escapeHtml(s.classNo)}</p>` : ''}
                                ${s.semester ? `<h3>Semester</h3><p>${escapeHtml(s.semester)}</p>` : ''}
                            </div>
                            <aside class="divider">
                                <div class="username">
                                    <span>MacHub</span>
                                </div>
                                <span class="usernum">2026</span>
                            </aside>
                        </section>
                        <!-- BACK FACE (flipped away) — MacHub branding only -->
                        <header class="ob-ticket-back">
                            <div class="ob-ticket-holo"></div>
                            <img class="logo" src="assets/img/file_00000000378c7207842a975d80367515.png" alt="MacHub">
                        </header>
                    </section>
                </div>
            `;
                
            // Reset bind so it attaches to new element
            _profileTiltBound = false;
            bindProfileCardTilt();

            // Populate the Apple-like liquid glass actions row
            const actionsEl = document.getElementById('ob-step3-actions');
            if (actionsEl) {
                actionsEl.innerHTML = `
                    <div class="flex items-center gap-3">
                        <button onclick="window.nextObStep(1)" class="btn-liquid-glass red flex-1 py-3 text-sm font-bold spring">
                            Back
                        </button>
                        <button onclick="if (window.finishOnboarding) window.finishOnboarding(event)" class="btn-liquid-glass blue flex-1 py-3 text-sm font-bold spring">
                            Next
                        </button>
                    </div>
                    <div class="text-center mt-3">
                        <button onclick="window.triggerSecureAccountModal('${escapeHtml(s.adminNo)}')" class="btn-liquid-glass py-2.5 px-6 text-xs font-bold spring inline-block" style="border:1px solid rgba(255,255,255,0.1); background:rgba(255,255,255,0.05); color:#fff; border-radius:14px; backdrop-filter:blur(20px); -webkit-backdrop-filter:blur(20px);">
                            Secure Account
                        </button>
                    </div>
                `;
            }
        }

        syncSelectedProfileToObData();

        const s3 = document.getElementById('ob-step-3');
        if (s3) {
            s3.classList.remove('hidden');
            s3.style.display = '';
        }
        document.getElementById('dot-3')?.classList.add('active');
    }
};

window.handleSmartSearch = function(query) {
    if (typeof window.loadLocalProfiles === 'function') {
        window.loadLocalProfiles();
    }
    const resultsEl = document.getElementById('ob-results');
    if (!resultsEl) return;
    const q = (query || '').trim();
    if (!q) { resultsEl.innerHTML = ''; return; }

    // Direct admin number entry → select student or show "Next & Scrape" if unlisted
    if (/^\d{4,6}$/.test(q)) {
        const direct = window.STUDENTS_DB?.find(x => x.adminNo === q);
        if (direct) {
            resultsEl.innerHTML = `
                <button onclick="selectStudentFromDB('${escapeHtml(direct.adminNo)}')" class="ob-result-row spring">
                    <span class="ob-result-avatar">${escapeHtml((direct.name || '?').charAt(0))}</span>
                    <div class="flex-1 min-w-0">
                        <p>${escapeHtml(direct.name)}</p>
                        <small>${escapeHtml(direct.classGroup)} / ADMN ${escapeHtml(direct.adminNo)} / ROLL ${escapeHtml(direct.classNo)}</small>
                    </div>
                    <span class="ob-result-arrow" aria-hidden="true"></span>
                </button>`;
            return;
        } else {
            // Not listed! Show a "Next" button to scrape and auto-create the profile
            resultsEl.innerHTML = `
                <div class="p-4 bg-white/5 border border-white/10 rounded-2xl flex flex-col gap-3">
                    <p class="text-xs font-bold text-slate-300">Admission number "${escapeHtml(q)}" is not in our database yet. Would you like to check the portal and create it?</p>
                    <button onclick="startDirectAdminOnboarding('${escapeHtml(q)}')" class="w-full bg-[var(--mac-blue)] text-white py-3.5 rounded-xl font-bold text-sm spring flex items-center justify-center gap-1.5 hover:scale-[1.02] active:scale-[0.98]">
                        Next & Scrape Profile ➔
                    </button>
                </div>`;
            return;
        }
    }

    const matches = window.SmartFinder ? window.SmartFinder.findStudent(q) : [];

    if (matches.length === 0) {
        resultsEl.innerHTML = `
            <div class="ob-empty-result text-center p-4">
                <p class="text-xs font-bold text-[#86868b] mb-3">No profile found for "${escapeHtml(q)}". Would you like to create a new profile?</p>
                <button onclick="showManualEntry()" class="w-full bg-[var(--mac-blue)] text-white py-3 rounded-xl font-bold text-xs spring hover:scale-[1.02] active:scale-[0.98]">
                    Create new profile
                </button>
            </div>`;
        return;
    }

    resultsEl.innerHTML = matches.slice(0, 6).map(s => `
        <button onclick="selectStudentFromDB('${escapeHtml(s.adminNo)}')" class="ob-result-row spring">
            <span class="ob-result-avatar">${escapeHtml((s.name || '?').charAt(0))}</span>
            <div class="flex-1 min-w-0">
                <p>${escapeHtml(s.name)}</p>
                <small>${escapeHtml(s.classGroup)} / ADMN ${escapeHtml(s.adminNo)} / ROLL ${escapeHtml(s.classNo)}</small>
            </div>
            <span class="ob-result-arrow" aria-hidden="true"></span>
        </button>
    `).join('');
};

window.startDirectAdminOnboarding = function(adminNo) {
    const input = document.getElementById('ob-adminNo');
    if (input) {
        input.value = adminNo;
    }
    window.nextObStep(2.5);
    if (typeof window.validateObStep2 === 'function') {
        window.validateObStep2();
    }
    // Automatically trigger scraping
    if (typeof window.fetchAndFinishOnboarding === 'function') {
        window.fetchAndFinishOnboarding();
    }
};

window.selectStudentFromDB = function(adminNo) {
    const s = window.STUDENTS_DB?.find(x => x.adminNo === adminNo);
    if (!s) return;
    window._selectedStudentFromDB = s;
    syncSelectedProfileToObData();
    localStorage.setItem('machub_student_id', adminNo);
    window.nextObStep(3);
};
window.showManualEntry = function() {
    window._selectedStudentFromDB = null;
    window.nextObStep(2.5);
};

window.selectObDept = function(dept) {
    if (!window.obData) window.obData = { name: '', dept: '', reg: '', adminNo: '' };
    window.obData.dept = dept;
    ['BCA', 'BBA', 'BSW'].forEach(d => {
        const btn = document.getElementById('btn-' + d);
        if(!btn) return;
        if (d === dept) {
            btn.classList.add('bg-[var(--mac-blue)]', 'text-white', 'opacity-100');
            btn.classList.remove('opacity-60');
        } else {
            btn.classList.remove('bg-[var(--mac-blue)]', 'text-white', 'opacity-100');
            btn.classList.add('opacity-60');
        }
    });
    window.validateObStep2();
};

window.validateObStep2 = function() {
    if (!window.obData) window.obData = { name: '', dept: '', reg: '', adminNo: '' };
    
    const adminInput = document.getElementById('ob-adminNo');
    const adminNoVal = (adminInput?.value || "").trim();
    
    const isValid = /^\d{4,6}$/.test(adminNoVal);

    if (isValid) {
        window.obData.adminNo = adminNoVal;
        
        // Auto-lookup if admin number matches exactly in preloaded DB
        const matchedStudent = window.STUDENTS_DB?.find(x => x.adminNo === adminNoVal);
        if (matchedStudent) {
            window._selectedStudentFromDB = matchedStudent;
            syncSelectedProfileToObData();
        } else {
            window._selectedStudentFromDB = null;
            window.obData.name = '';
            window.obData.dept = '';
            window.obData.reg = '';
        }
    } else {
        window._selectedStudentFromDB = null;
        window.obData.adminNo = '';
    }

    const btn = document.getElementById('ob-final-btn');
    if (isValid) {
        if (btn) {
            btn.classList.remove('opacity-30');
            btn.classList.add('spring');
        }
    } else {
        if (btn) {
            btn.classList.add('opacity-30');
            btn.classList.remove('spring');
        }
    }
};

window.finishOnboarding = finishSmartOnboarding;

let secureAccountAdmin = '';

window.triggerSecureAccountModal = function(adminNo) {
    window.secureAccountAdmin = adminNo;
    
    // Clear fields
    ['sec-old-pwd', 'sec-new-pwd', 'sec-confirm-pwd'].forEach(id => {
        const el = document.getElementById(id);
        if (el) { el.value = ''; el.classList.remove('sa-error'); }
    });
    const errEl = document.getElementById('sec-old-pwd-error');
    if (errEl) errEl.style.display = 'none';

    // Hide onboarding screen temporarily so the new view is on top
    const obScreen = document.getElementById('onboardingScreen');
    if (obScreen && obScreen.style.display !== 'none') {
        window._onboardingWasActive = true;
        obScreen.classList.add('hidden', 'collapsed');
        obScreen.style.display = 'none';
    }
    
    // Switch to the dedicated full-screen view instead of popup
    if (typeof switchView === 'function') {
        switchView('view-secure-account');
    }

    setTimeout(() => {
        const inp = document.getElementById('sec-old-pwd');
        if (inp) inp.focus();
    }, 150);
};

window.closeSecureAccountModal = function() {
    // If we came from onboarding, show it again
    if (window._onboardingWasActive) {
        window._onboardingWasActive = false;
        const obScreen = document.getElementById('onboardingScreen');
        if (obScreen) {
            obScreen.classList.remove('hidden', 'collapsed');
            obScreen.style.display = 'flex';
        }
        // Home is active behind onboarding usually
        if (typeof switchView === 'function') {
            switchView('view-home');
        }
        return;
    }
    
    // Otherwise go to home
    if (typeof switchView === 'function') {
        switchView('view-home');
    }
};

window.submitSecureAccountPasswordChange = async function() {
    const adminNo = window.secureAccountAdmin;
    let oldPassword = document.getElementById('sec-old-pwd')?.value || '';
    const newPassword = document.getElementById('sec-new-pwd')?.value || '';
    const confirmPassword = document.getElementById('sec-confirm-pwd')?.value || '';

    if (!oldPassword) {
        oldPassword = adminNo;
    }

    if (!newPassword || !confirmPassword) {
        alert('New password fields are required.');
        return;
    }

    if (newPassword !== confirmPassword) {
        alert('New passwords do not match.');
        return;
    }

    const btn = document.getElementById('btn-submit-secure-pwd');
    const originalText = btn ? btn.innerHTML : 'Change & Save';
    if (btn) {
        btn.innerHTML = '⏳ Verifying...';
        btn.disabled = true;
    }

    const CF_WORKER_URL = 'https://machub-proxy.mrabensojan.workers.dev';

    // Helper: show/hide the inline error below the old password field
    function showOldPwdError(msg) {
        const errEl = document.getElementById('sec-old-pwd-error');
        const inputEl = document.getElementById('sec-old-pwd');
        if (errEl) {
            errEl.textContent = msg || '⚠️ Current password is incorrect. Please try again.';
            errEl.style.display = 'block';
        }
        if (inputEl) {
            inputEl.style.borderColor = 'rgba(239,68,68,0.7)';
            inputEl.style.boxShadow = '0 0 0 3px rgba(239,68,68,0.12)';
            inputEl.focus();
            inputEl.select();
        }
    }

    function clearOldPwdError() {
        const errEl = document.getElementById('sec-old-pwd-error');
        const inputEl = document.getElementById('sec-old-pwd');
        if (errEl) errEl.style.display = 'none';
        if (inputEl) {
            inputEl.style.borderColor = 'rgba(255,255,255,0.1)';
            inputEl.style.boxShadow = 'none';
        }
    }

    clearOldPwdError();

    try {
        // ── STEP 1: Verify old password via portal login ──────────────────────
        let oldPwdVerified = false;
        try {
            const verifyRes = await fetch(`${CF_WORKER_URL}/api/auth/login`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ admissionNumber: adminNo, password: oldPassword }),
                signal: AbortSignal.timeout(10000)
            });
            const verifyJson = await verifyRes.json().catch(() => ({}));
            if (verifyRes.ok && verifyJson.success) {
                oldPwdVerified = true;
            }
        } catch (verifyErr) {
            console.warn('[SecureAccount] Old password verification network error:', verifyErr.message);
            if (btn) { btn.innerHTML = originalText; btn.disabled = false; }
            alert('Network error. Please check your connection and try again.');
            return;
        }

        if (!oldPwdVerified) {
            if (btn) { btn.innerHTML = originalText; btn.disabled = false; }
            showOldPwdError('⚠️ Current password is incorrect. Please try again.');
            return;
        }

        // ── STEP 2: Old password is correct — proceed with change ──────────────
        if (btn) {
            btn.innerHTML = '⏳ Changing...';
        }

        let changeError = null;
        try {
            const res = await fetch(`${CF_WORKER_URL}/api/change-password`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    admissionNumber: adminNo,
                    oldPassword,
                    newPassword,
                    confirmPassword
                })
            });
            const json = await res.json();
            if (!res.ok || !json.success) {
                changeError = json.error || 'Password update failed';
            }
        } catch (e) {
            changeError = e.message;
        }

        // ── STEP 2.5: Auto-login with new password to verify success ───────────
        if (btn) {
            btn.innerHTML = '⏳ Verifying new password...';
        }

        let newPwdWorks = false;
        try {
            const checkRes = await fetch(`${CF_WORKER_URL}/api/auth/login`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ admissionNumber: adminNo, password: newPassword }),
                signal: AbortSignal.timeout(10000)
            });
            const checkJson = await checkRes.json().catch(() => ({}));
            if (checkRes.ok && checkJson.success) {
                newPwdWorks = true;
            }
        } catch (e) {
            console.warn('[SecureAccount] Auto-login check network error:', e);
        }

        if (newPwdWorks) {
            // The password was successfully changed on the portal!
            // We ignore any spurious error message the change-password API might have returned.
            console.log('[SecureAccount] Auto-login successful with new password!');
        } else {
            // New password does not work.
            throw new Error(changeError || 'Portal rejected password change. Please ensure the new password meets the college requirements.');
        }

        // ── STEP 3: Save new password locally and to Firestore ────────────────
        localStorage.setItem(`machub_portal_Password_${adminNo}`, newPassword);

        try {
            const encRes = await fetch(`${CF_WORKER_URL}/api/auth/encrypt-password`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ password: newPassword })
            });
            const encJson = await encRes.json();
            if (encRes.ok && encJson.success && encJson.encrypted) {
                if (window.authenticateFirebase) {
                    await window.authenticateFirebase(adminNo);
                }
                
                if (window.updateFirestoreDocSecurely) {
                    await window.updateFirestoreDocSecurely(adminNo, {
                        'security.portalPasswordEncryptedAdmin': encJson.encrypted,
                        'security.portalPasswordEncrypted': null,
                        'security.credentialStatus': 'valid',
                        'credentialStatus': 'valid'
                    });
                }
            }
        } catch (saveErr) {
            console.warn('[Onboarding] Failed to sync updated password to database:', saveErr);
        }

        // ── STEP 4: Success — close modal, show toast, auto-sync ──────────────
        window.closeSecureAccountModal();

        if (window.showToast) {
            window.showToast('Password changed successfully! 🔐', 'success');
        } else {
            alert('Password changed successfully!');
        }

        window.isPortalLocked = false;
        localStorage.removeItem(`machub_portal_locked_${adminNo}`);

        window.closeSecureAccountModal();

        if (window.syncHomePortalDashboard) {
            window.syncHomePortalDashboard();
        }

        setTimeout(() => {
            try {
                ['Attendance', 'InternalMark', 'Assessment', 'Assignment'].forEach(sec => {
                    if (window.MacHubPortal && typeof window.MacHubPortal.fetchSection === 'function') {
                        window.MacHubPortal.fetchSection(sec).catch(() => {});
                    }
                });
            } catch(e) {}
        }, 1500);

    } catch (err) {
        if (window.showToast) {
            window.showToast('Failed to change password: ' + err.message, 'error');
        } else {
            alert('Failed to change password: ' + err.message);
        }
    } finally {
        if (btn) {
            btn.innerHTML = originalText;
            btn.disabled = false;
        }
    }
};

window.skipOnboarding = function() {
    const guestProfile = {
        name: 'Guest',
        dept: 'General',
        reg: '',
        adminNo: '',
        classGroup: 'Guest',
        classNo: '',
        semester: 'Sem 2',
        isSkipped: true
    };
    enterAppWithProfile(guestProfile);
};
