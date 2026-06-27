/**
 * ╔══════════════════════════════════════════════════════════════════╗
 * ║   MAC Exam Hub — PIN Lock Screen Controller                      ║
 * ║   Features: Secure entry, unlock, forgot PIN fallback           ║
 * ╚══════════════════════════════════════════════════════════════════╝
 */

(function () {
    'use strict';

    const LOCK_STATE = {
        admissionNumber: '',
        pinLength: 4,
        currentInput: '',
        attemptsRemaining: 5,
        lockedUntil: null,
        forgotQuestions: [],
        forgotAnswers: {}
    };

    function showPinLock(admissionNumber, pinLength = 4) {
        if (window.hideBottomNav) window.hideBottomNav();

        LOCK_STATE.admissionNumber = admissionNumber;
        LOCK_STATE.pinLength = parseInt(pinLength, 10) || 4;
        LOCK_STATE.currentInput = '';
        LOCK_STATE.attemptsRemaining = 5;

        // Resolve student name offline
        let studentName = 'Student';
        const localInfo = JSON.parse(localStorage.getItem('mac_student_info') || '{}');
        if (localInfo && localInfo.name) {
            studentName = localInfo.name;
        } else {
            const cacheKey = `machub_portal_Profile_${admissionNumber}`;
            const cached = localStorage.getItem(cacheKey);
            if (cached) {
                try {
                    const parsed = JSON.parse(cached);
                    const payload = parsed?.data?.payload || parsed?.data || parsed;
                    if (payload && (payload.name || payload.studentName)) {
                        studentName = payload.name || payload.studentName;
                    }
                } catch (e) {}
            }
        }
        LOCK_STATE.studentName = studentName;

        // Render initial keypad UI
        renderPinScreen();
        switchView('view-pin-lock');
    }

    function renderPinScreen() {
        const container = document.getElementById('pin-lock-container');
        if (!container) return;

        // Generate dots HTML
        let dots = '';
        for (let i = 0; i < LOCK_STATE.pinLength; i++) {
            const isFilled = i < LOCK_STATE.currentInput.length;
            dots += `<div class="pin-dot ${isFilled ? 'filled' : ''}" style="width:14px; height:14px; border-radius:50%; border:2.5px solid rgba(255,255,255,0.25); background:transparent; transition:all 0.12s cubic-bezier(0.32,0.94,0.6,1); ${isFilled ? 'background:#fff; border-color:#fff; box-shadow:0 0 10px rgba(255,255,255,0.8); transform:scale(1.2);' : ''}"></div>`;
        }

        const letters = {
            1: '&nbsp;', 2: 'A B C', 3: 'D E F',
            4: 'G H I', 5: 'J K L', 6: 'M N O',
            7: 'P Q R S', 8: 'T U V', 9: 'W X Y Z',
            0: ''
        };

        container.innerHTML = `
            <div class="flex flex-col items-center justify-between min-h-[85vh] py-12 text-center select-none">
                <!-- TOP HEADER -->
                <div class="space-y-3 mt-6">
                    <div class="w-14 h-14 rounded-full bg-white/5 border border-white/10 flex items-center justify-center mx-auto text-xl shadow-inner backdrop-blur-md">
                        🔒
                    </div>
                    <h4 class="text-xl font-bold tracking-tight text-white/90">Enter Profile PIN</h4>
                    <p class="text-xs text-zinc-400 max-w-[280px] mx-auto leading-relaxed">Unlock your student profile records for Admn. #${LOCK_STATE.admissionNumber}</p>
                </div>

                <!-- PIN DOTS -->
                <div class="flex justify-center gap-5 my-10">
                    ${dots}
                </div>

                <!-- KEYPAD -->
                <div class="grid grid-cols-3 gap-x-5 gap-y-4 max-w-[270px] mx-auto mb-10">
                    ${[1, 2, 3, 4, 5, 6, 7, 8, 9].map(num => `
                        <button onclick="window.pressPinKey('${num}')" class="w-[72px] h-[72px] rounded-full bg-white/5 border border-white/10 flex flex-col items-center justify-center text-white active:bg-white/15 active:scale-95 transition-all duration-75">
                            <span class="text-2xl font-semibold leading-tight">${num}</span>
                            <small class="text-[8px] font-black text-zinc-500 tracking-wider -mt-0.5">${letters[num]}</small>
                        </button>
                    `).join('')}
                    <button onclick="window.forgotPin()" class="text-xs font-bold text-zinc-400 active:text-white active:scale-95 transition-all duration-75 flex items-center justify-center">
                        Forgot?
                    </button>
                    <button onclick="window.pressPinKey('0')" class="w-[72px] h-[72px] rounded-full bg-white/5 border border-white/10 flex flex-col items-center justify-center text-white active:bg-white/15 active:scale-95 transition-all duration-75">
                        <span class="text-2xl font-semibold leading-tight">0</span>
                    </button>
                    <button onclick="window.pressPinKey('back')" class="w-[72px] h-[72px] rounded-full bg-transparent flex items-center justify-center text-zinc-400 active:scale-90 active:text-white transition-all duration-75">
                        <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
                            <path d="M21 4H8l-7 8 7 8h13a2 2 0 0 0 2-2V6a2 2 0 0 0-2-2z"/>
                            <line x1="18" y1="9" x2="12" y2="15"/>
                            <line x1="12" y1="9" x2="18" y2="15"/>
                        </svg>
                    </button>
                </div>

                <!-- BOTTOM ACTIONS -->
                <div class="flex flex-col items-center gap-3">
                    ${LOCK_STATE.attemptsRemaining < 5 ? `
                        <div class="text-[10px] text-red-400 font-extrabold uppercase tracking-wider mb-2">
                            ${LOCK_STATE.attemptsRemaining} Attempts Remaining
                        </div>
                    ` : ''}
                    <button onclick="if (window.portalLogout) { window.portalLogout(); } else { window.location.reload(); }" class="px-6 py-2 rounded-full bg-red-500/10 border border-red-500/20 text-red-400 text-[10px] font-black uppercase tracking-widest active:scale-95 transition-all duration-100">
                        🚪 Log Out / Exit
                    </button>
                </div>
            </div>
        `;
    }

    window.pressPinKey = async function (key) {
        if (key === 'back') {
            LOCK_STATE.currentInput = LOCK_STATE.currentInput.slice(0, -1);
            renderPinScreen();
            return;
        }

        if (LOCK_STATE.currentInput.length >= LOCK_STATE.pinLength) return;
        LOCK_STATE.currentInput += key;
        renderPinScreen();

        if (LOCK_STATE.currentInput.length === LOCK_STATE.pinLength) {
            // Trigger auto check
            setTimeout(checkPin, 100);
        }
    };

    async function checkPin() {
        const pin = LOCK_STATE.currentInput;
        LOCK_STATE.currentInput = ''; // Clear input immediately for security

        const db = window.firebaseFirestore;
        if (!db) {
            alert('Database not initialized.');
            renderPinScreen();
            return;
        }

        try {
            const studentRef = window.firestoreDoc(db, 'students', LOCK_STATE.admissionNumber);
            const studentSnap = await window.firestoreGetDoc(studentRef);

            if (!studentSnap.exists()) {
                alert('Student profile not found.');
                switchView('view-home');
                return;
            }

            const security = studentSnap.data().security || {};
            const pinHash = security.pinHash;

            if (!pinHash) {
                // No PIN configured but claimed? Self repair or enter profile
                window.ExamHubState.security.isUnlocked = true;
                enterProfile();
                return;
            }

            // Verify using bcryptjs
            if (typeof dcodeIO === 'undefined' && typeof bcrypt === 'undefined') {
                await new Promise((resolve, reject) => {
                    const script = document.createElement('script');
                    script.src = 'https://cdnjs.cloudflare.com/ajax/libs/bcryptjs/2.4.3/bcrypt.min.js';
                    script.onload = resolve;
                    script.onerror = reject;
                    document.head.appendChild(script);
                });
            }

            const bcryptLib = window.bcrypt || dcodeIO.bcrypt;
            const match = bcryptLib.compareSync(pin, pinHash);

            if (match) {
                // Successful unlock
                const deviceToken = generateDeviceToken();
                const currentTokens = security.deviceTokens || [];
                
                // Add new token (keep max 5 active devices)
                currentTokens.unshift(deviceToken);
                const updatedTokens = currentTokens.slice(0, 5);

                await window.updateFirestoreDocSecurely(LOCK_STATE.admissionNumber, {
                    'security.deviceTokens': updatedTokens,
                    'security.lastVerifiedAt': new Date().toISOString()
                });

                localStorage.setItem('machub_device_token', deviceToken);
                localStorage.setItem('machub_claimed_admission', LOCK_STATE.admissionNumber);

                window.ExamHubState.security.isUnlocked = true;
                window.ExamHubState.security.deviceToken = deviceToken;

                enterProfile();
            } else {
                LOCK_STATE.attemptsRemaining--;
                if (LOCK_STATE.attemptsRemaining <= 0) {
                    alert('Too many incorrect PIN attempts. Use "Forgot PIN" or reset profile.');
                    LOCK_STATE.attemptsRemaining = 5;
                } else {
                    alert(`Incorrect PIN. ${LOCK_STATE.attemptsRemaining} attempts remaining.`);
                }
                renderPinScreen();
            }
        } catch (err) {
            alert('Verification error: ' + err.message);
            renderPinScreen();
        }
    }

    function generateDeviceToken() {
        const array = new Uint8Array(24);
        crypto.getRandomValues(array);
        return Array.from(array, byte => byte.toString(16).padStart(2, '0')).join('');
    }

    function enterProfile() {
        if (window.showBottomNav) window.showBottomNav();
        if (typeof window.viewStudentProfile === 'function') {
            window.viewStudentProfile(LOCK_STATE.admissionNumber);
        } else {
            switchView('view-profile');
        }
    }

    // --- FORGOT PIN HANDLERS ---

    window.forgotPin = async function () {
        try {
            const adminNo = LOCK_STATE.admissionNumber;
            const localKey = `machub_portal_Profile_${adminNo}`;
            const cachedData = localStorage.getItem(localKey);
            let profileData = null;

            if (cachedData) {
                try {
                    const parsed = JSON.parse(cachedData);
                    profileData = parsed?.data?.payload || parsed?.data || parsed;
                } catch (e) {}
            }

            if (!profileData) {
                // Try fallback
                for (let i = 0; i < localStorage.length; i++) {
                    const key = localStorage.key(i);
                    if (key && key.startsWith('machub_portal_Profile_') && key.endsWith(adminNo)) {
                        try {
                            const parsed = JSON.parse(localStorage.getItem(key));
                            profileData = parsed?.data?.payload || parsed?.data || parsed;
                        } catch (e) {}
                        break;
                    }
                }
            }

            if (!profileData) {
                alert('No profile data cached. PIN cannot be recovered. Please contact the administrator.');
                return;
            }

            renderRecoveryQuestions(profileData);
        } catch (e) {
            alert('Error starting recovery: ' + e.message);
        }
    };

    function renderRecoveryQuestions(profileData) {
        // Select questions
        const pool = [];
        const data = profileData || {};

        if (data.dob) pool.push('dob');
        if (data.phone) {
            pool.push('phoneLast4');
            if (data.phone.replace(/\D/g, '').length >= 10) pool.push('phone');
        }
        if (data.aadhar || data.aadhaar) pool.push('aadhaarLast4');
        if (data.fatherName || data.guardianName) pool.push('fatherName');
        if (data.motherName) pool.push('motherName');

        const selected = [];
        const available = [...pool];
        while (selected.length < 3 && available.length > 0) {
            const idx = Math.floor(Math.random() * available.length);
            selected.push(available.splice(idx, 1)[0]);
        }

        LOCK_STATE.forgotQuestions = selected;

        const container = document.getElementById('pin-lock-container');
        if (!container) return;

        const QUESTION_LABELS = {
            dob: 'Date of Birth (YYYY-MM-DD or DD-MM-YYYY)',
            phone: 'Registered Mobile Number (10 digits)',
            phoneLast4: 'Last 4 Digits of your Registered Mobile Number',
            aadhaarLast4: 'Last 4 Digits of your Aadhaar Number',
            fatherName: 'Father / Guardian Name',
            motherName: 'Mother\'s Name'
        };

        const questionsHtml = selected.map(q => `
            <div>
                <label class="claim-input-label">${QUESTION_LABELS[q] || q}</label>
                <input type="text" id="recover-ans-${q}" class="claim-input" placeholder="Answer..." />
            </div>
        `).join('');

        container.innerHTML = `
            <div class="px-4 py-8 space-y-6">
                <div class="text-center space-y-2">
                    <h4 class="text-xl font-black">Reset Profile PIN</h4>
                    <p class="text-xs text-zinc-400">Prove your identity to choose a new PIN and unlock your profile.</p>
                </div>

                <div class="space-y-4 bg-zinc-900/40 p-5 rounded-3xl border border-white/5 text-left">
                    ${questionsHtml}
                </div>

                <div class="flex gap-3">
                    <button onclick="window.submitPinRecovery()" class="flex-1 py-4 bg-[var(--mac-blue)] text-white rounded-2xl font-bold text-sm spring active:scale-95">
                        Verify & Reset
                    </button>
                    <button onclick="window.cancelPinRecovery()" class="py-4 px-6 bg-zinc-800 text-zinc-400 rounded-2xl font-bold text-sm spring active:scale-95">
                        Cancel
                    </button>
                </div>
            </div>
        `;
    }

    window.cancelPinRecovery = function () {
        renderPinScreen();
    };

    window.submitPinRecovery = async function () {
        const answers = {};
        let missing = false;

        LOCK_STATE.forgotQuestions.forEach(q => {
            const input = document.getElementById(`recover-ans-${q}`);
            const val = (input?.value || '').trim();
            if (!val) missing = true;
            answers[q] = val;
        });

        if (missing) {
            alert('Please answer all questions.');
            return;
        }

        const CF_WORKER_URL = 'https://machub-proxy.mrabensojan.workers.dev';

        try {
            const res = await fetch(`${CF_WORKER_URL}/api/auth/verify-profile-data`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    admissionNumber: LOCK_STATE.admissionNumber,
                    answers
                })
            });
            const result = await res.json();

            if (result.success && result.verified) {
                // Identity verified. Let them enter a new PIN.
                renderNewPinSetup();
            } else {
                alert('Verification failed. Incorrect details provided.');
            }
        } catch (err) {
            alert('Error during verification: ' + err.message);
        }
    };

    function renderNewPinSetup() {
        const container = document.getElementById('pin-lock-container');
        if (!container) return;

        container.innerHTML = `
            <div class="px-4 py-8 space-y-6">
                <div class="text-center space-y-2">
                    <h4 class="text-xl font-black">Choose New PIN</h4>
                    <p class="text-xs text-zinc-400">Set a new 4 or 6 digit PIN to secure your account details.</p>
                </div>

                <div class="space-y-4 bg-zinc-900/40 p-5 rounded-3xl border border-white/5 text-left">
                    <div>
                        <label class="claim-input-label">PIN Length</label>
                        <div class="flex gap-2">
                            <button onclick="window.setRecoveryPinLength(4)" id="rec-btn-pin-len-4" class="flex-1 py-3 bg-[var(--mac-blue)] text-white border border-white/10 rounded-xl font-bold text-xs spring">4 Digits</button>
                            <button onclick="window.setRecoveryPinLength(6)" id="rec-btn-pin-len-6" class="flex-1 py-3 bg-zinc-800 text-zinc-400 border border-white/5 rounded-xl font-bold text-xs spring">6 Digits</button>
                        </div>
                    </div>
                    <div>
                        <label class="claim-input-label">New PIN</label>
                        <input type="password" id="recover-pin" class="claim-input text-center text-xl tracking-[0.3em]" maxlength="4" placeholder="••••" />
                    </div>
                    <div>
                        <label class="claim-input-label">Confirm PIN</label>
                        <input type="password" id="recover-pin-confirm" class="claim-input text-center text-xl tracking-[0.3em]" maxlength="4" placeholder="••••" />
                    </div>
                </div>

                <button onclick="window.submitPinReset()" class="w-full py-4 bg-[var(--mac-blue)] text-white rounded-2xl font-bold text-sm spring active:scale-95">
                    Update PIN & Unlock
                </button>
            </div>
        `;
    }

    window.setRecoveryPinLength = function (len) {
        const pinIn = document.getElementById('recover-pin');
        const confirmIn = document.getElementById('recover-pin-confirm');
        const btn4 = document.getElementById('rec-btn-pin-len-4');
        const btn6 = document.getElementById('rec-btn-pin-len-6');

        if (len === 4) {
            pinIn.maxLength = 4;
            pinIn.placeholder = '••••';
            confirmIn.maxLength = 4;
            confirmIn.placeholder = '••••';
            btn4.className = "flex-1 py-3 bg-[var(--mac-blue)] text-white border border-white/10 rounded-xl font-bold text-xs spring";
            btn6.className = "flex-1 py-3 bg-zinc-800 text-zinc-400 border border-white/5 rounded-xl font-bold text-xs spring";
        } else {
            pinIn.maxLength = 6;
            pinIn.placeholder = '••••••';
            confirmIn.maxLength = 6;
            confirmIn.placeholder = '••••••';
            btn4.className = "flex-1 py-3 bg-zinc-800 text-zinc-400 border border-white/5 rounded-xl font-bold text-xs spring";
            btn6.className = "flex-1 py-3 bg-[var(--mac-blue)] text-white border border-white/10 rounded-xl font-bold text-xs spring";
        }
        pinIn.value = '';
        confirmIn.value = '';
    };

    window.submitPinReset = async function () {
        const pinVal = document.getElementById('recover-pin')?.value || '';
        const confirmVal = document.getElementById('recover-pin-confirm')?.value || '';
        const pinLen = document.getElementById('recover-pin')?.maxLength || 4;

        if (pinVal.length !== pinLen) {
            alert(`PIN must be exactly ${pinLen} digits.`);
            return;
        }
        if (pinVal !== confirmVal) {
            alert('PIN confirmation does not match.');
            return;
        }

        const db = window.firebaseFirestore;
        if (!db) return;

        try {
            if (typeof dcodeIO === 'undefined' && typeof bcrypt === 'undefined') {
                await new Promise((resolve, reject) => {
                    const script = document.createElement('script');
                    script.src = 'https://cdnjs.cloudflare.com/ajax/libs/bcryptjs/2.4.3/bcrypt.min.js';
                    script.onload = resolve;
                    script.onerror = reject;
                    document.head.appendChild(script);
                });
            }

            const bcryptLib = window.bcrypt || dcodeIO.bcrypt;
            const salt = bcryptLib.genSaltSync(10);
            const pinHash = bcryptLib.hashSync(pinVal, salt);

            // Save reset
            const studentRef = window.firestoreDoc(db, 'students', LOCK_STATE.admissionNumber);
            const deviceToken = generateDeviceToken();

            await window.updateFirestoreDocSecurely(LOCK_STATE.admissionNumber, {
                'security.pinHash': pinHash,
                'security.pinLength': pinLen,
                'security.deviceTokens': [deviceToken]
            });

            localStorage.setItem('machub_device_token', deviceToken);
            localStorage.setItem('machub_claimed_admission', LOCK_STATE.admissionNumber);

            window.ExamHubState.security.isUnlocked = true;
            window.ExamHubState.security.deviceToken = deviceToken;

            alert('PIN updated and account unlocked!');
            enterProfile();
        } catch (e) {
            alert('Error updating PIN: ' + e.message);
        }
    };

    window.ExamHubLock = {
        show: showPinLock
    };

})();
