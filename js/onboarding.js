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

function enterAppWithProfile(profile) {
    saveProfile(profile);

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
    }

    if (activeTiltLoops[containerId]) {
        cancelAnimationFrame(activeTiltLoops[containerId]);
        delete activeTiltLoops[containerId];
    }

    // Reset styles
    el.style.setProperty('--o', '0');
    el.style.setProperty('--rx', '0deg');
    el.style.setProperty('--ry', '0deg');

    // If battery saver performance mode is on, return immediately
    if (!settings.highFidelity) {
        return;
    }

    let currentX = 0;
    let currentY = 0;
    let targetX = 0;
    let targetY = 0;
    let isActive = false;
    let autoRotation = 0;

    const onPointerMove = event => {
        const rect = el.getBoundingClientRect();
        const x = event.clientX - rect.left;
        const y = event.clientY - rect.top;
        
        const px = Math.max(0, Math.min(1, x / rect.width));
        const py = Math.max(0, Math.min(1, y / rect.height));
        
        targetX = (px - 0.5) * 40; 
        targetY = (0.5 - py) * 40;
        
        el.style.setProperty('--p', `${px * 100}%`);
        el.style.setProperty('--h', `${py * 100}%`);
        el.style.setProperty('--o', '1');
        isActive = true;
    };

    const onPointerLeave = () => {
        targetX = 0;
        targetY = 0;
        el.style.setProperty('--o', '0');
        isActive = false;
    };

    el.addEventListener('pointermove', onPointerMove, { passive: true });
    el.addEventListener('pointerleave', onPointerLeave, { passive: true });

    // Store listener references for clean teardown
    el._cardTiltListeners = { move: onPointerMove, leave: onPointerLeave };

    function loop() {
        if (!isActive) {
            autoRotation += 0.2; // Slow auto rotation
            targetX = Math.sin(autoRotation * Math.PI / 180) * 15;
            targetY = Math.cos(autoRotation * 0.8 * Math.PI / 180) * 5;
            
            const autoPx = (Math.sin(autoRotation * Math.PI / 180) + 1) / 2;
            const autoPy = (Math.cos(autoRotation * Math.PI / 180) + 1) / 2;
            el.style.setProperty('--p', `${autoPx * 100}%`);
            el.style.setProperty('--h', `${autoPy * 100}%`);
            el.style.setProperty('--o', '0.6');
        }

        currentX += (targetX - currentX) * 0.1;
        currentY += (targetY - currentY) * 0.1;
        
        el.style.setProperty('--rx', `${currentY}deg`);
        el.style.setProperty('--ry', `${currentX}deg`);
        
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
            const color = profileAccent(s);
            const initials = (s.name || 'ME').split(/\s+/).slice(0, 2).map(part => part[0]).join('').toUpperCase();
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
                                    <img class="profile-pic" src="assets/img/ChatGPT%20Image%20May%2018,%202026,%2010_33_49%20PM.png" alt="Profile">
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
                </div>`;
                
            // Reset bind so it attaches to new element
            _profileTiltBound = false;
            bindProfileCardTilt();

            // Populate the Apple-like liquid glass actions row
            const actionsEl = document.getElementById('ob-step3-actions');
            if (actionsEl) {
                actionsEl.innerHTML = `
                    <div class="grid grid-cols-2 gap-3.5">
                        <button onclick="window.nextObStep(1)" class="btn-liquid-glass red flex-1 py-4 text-xs font-bold spring">
                            Not Me
                        </button>
                        <button onclick="window.triggerSecureAccountModal('${escapeHtml(s.adminNo)}')" class="btn-liquid-glass gold flex-1 py-4 text-xs font-bold spring">
                            Secure Account
                        </button>
                    </div>
                    <button onclick="if (window.finishOnboarding) window.finishOnboarding(event)" class="btn-liquid-glass blue w-full py-4.5 text-sm font-bold spring mt-1">
                        This is me
                    </button>
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
            btn.classList.remove('opacity-30', 'pointer-events-none');
            btn.classList.add('spring');
        }
    } else {
        if (btn) {
            btn.classList.add('opacity-30', 'pointer-events-none');
            btn.classList.remove('spring');
        }
    }
};

window.finishOnboarding = finishSmartOnboarding;

let secureAccountAdmin = '';

window.triggerSecureAccountModal = function(adminNo) {
    secureAccountAdmin = adminNo;
    const modal = document.getElementById('secureAccountModal');
    if (!modal) return;

    const oldPwdInput = document.getElementById('sec-old-pwd');
    if (oldPwdInput) oldPwdInput.value = adminNo;

    const newPwdInput = document.getElementById('sec-new-pwd');
    if (newPwdInput) newPwdInput.value = '';

    const confirmPwdInput = document.getElementById('sec-confirm-pwd');
    if (confirmPwdInput) confirmPwdInput.value = '';

    modal.classList.add('open');
};

window.closeSecureAccountModal = function() {
    const modal = document.getElementById('secureAccountModal');
    if (modal) modal.classList.remove('open');
};

window.submitSecureAccountPasswordChange = async function() {
    const adminNo = secureAccountAdmin;
    const oldPassword = document.getElementById('sec-old-pwd')?.value || '';
    const newPassword = document.getElementById('sec-new-pwd')?.value || '';
    const confirmPassword = document.getElementById('sec-confirm-pwd')?.value || '';

    if (!oldPassword || !newPassword || !confirmPassword) {
        alert('All fields are required.');
        return;
    }

    if (newPassword !== confirmPassword) {
        alert('New passwords do not match.');
        return;
    }

    const btn = document.getElementById('btn-submit-secure-pwd');
    const originalText = btn ? btn.innerHTML : 'Change & Save';
    if (btn) btn.innerHTML = '⏳ Processing...';

    const CF_WORKER_URL = 'https://machub-proxy.mrabensojan.workers.dev';

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
            throw new Error(json.error || 'Password update failed');
        }

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
                        'security.portalPasswordEncrypted': encJson.encrypted,
                        'security.credentialStatus': 'valid'
                    });
                }
            }
        } catch (saveErr) {
            console.warn('[Onboarding] Failed to sync updated password to database:', saveErr);
        }

        alert('Account secured! Portal password updated successfully.');
        window.closeSecureAccountModal();

    } catch (err) {
        alert('Failed to secure account: ' + err.message);
    } finally {
        if (btn) btn.innerHTML = originalText;
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
