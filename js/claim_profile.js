/**
 * ╔══════════════════════════════════════════════════════════════════╗
 * ║   MAC Exam Hub — Profile Claim Flow                              ║
 * ║   Steps: Portal password → Identity verification → Set PIN      ║
 * ╚══════════════════════════════════════════════════════════════════╝
 */

(function () {
    'use strict';

    const CF_WORKER_URL = 'https://machub-proxy.mrabensojan.workers.dev';

    const CLAIM_STATE = {
        admissionNumber: '',
        password: '',
        questions: [],
        currentStep: 1, // 1: password, 2: identity, 3: pin
        attemptsRemaining: 5,
        lockedUntil: null
    };

    const QUESTION_LABELS = {
        dob: 'Date of Birth (YYYY-MM-DD or DD-MM-YYYY)',
        phone: 'Registered Mobile Number (10 digits)',
        phoneLast4: 'Last 4 Digits of your Registered Mobile Number',
        aadhaarLast4: 'Last 4 Digits of your Aadhaar Number',
        fatherName: 'Father / Guardian Name',
        motherName: 'Mother\'s Name',
        parentPhone: 'Parent / Guardian Phone Number',
        email: 'Registered Email Address',
        bloodGroup: 'Blood Group (e.g. O+, A+)',
        pincode: '6-digit Address PIN Code'
    };

    function generateVerificationQuestions(profileData) {
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
        if (data.parentPhone || data.guardianPhone) pool.push('parentPhone');
        if (data.email) pool.push('email');
        if (data.bloodGroup || data.blood_group) pool.push('bloodGroup');
        if (data.address || data.permanentAddress) pool.push('pincode');

        // Select 3 random unique questions from the pool
        const selected = [];
        const available = [...pool];
        while (selected.length < 3 && available.length > 0) {
            const idx = Math.floor(Math.random() * available.length);
            selected.push(available.splice(idx, 1)[0]);
        }
        return selected;
    }

    async function initProfileClaim(admissionNumber) {
        if (!admissionNumber) {
            alert('Admission number is required.');
            return;
        }

        CLAIM_STATE.admissionNumber = admissionNumber;
        CLAIM_STATE.currentStep = 1;
        CLAIM_STATE.attemptsRemaining = 5;
        CLAIM_STATE.lockedUntil = null;

        renderClaimStep(1);
        switchView('view-claim-profile');
    }

    function renderClaimStep(step) {
        CLAIM_STATE.currentStep = step;
        const container = document.getElementById('claim-flow-container');
        if (!container) return;

        // Render progress dots
        const dots = [1, 2, 3].map(s => 
            `<div class="step-dot ${s === step ? 'active' : ''}"></div>`
        ).join('');

        let content = '';

        if (step === 1) {
            // STEP 1: Portal Password
            content = `
                <div class="space-y-5">
                    <div class="text-center">
                        <p class="text-sm text-[#86868b]">Step 1 of 3</p>
                        <h4 class="text-xl font-black mt-1">Verify Portal Credentials</h4>
                        <p class="text-xs text-zinc-400 mt-2 px-6">Enter your official ePortal password to authenticate profile ownership.</p>
                    </div>

                    <div class="space-y-4 bg-zinc-900/40 p-5 rounded-3xl border border-white/5">
                        <div>
                            <label class="claim-input-label">Admission Number</label>
                            <input type="text" class="claim-input opacity-60" value="${CLAIM_STATE.admissionNumber}" readonly />
                        </div>
                        <div>
                            <label class="claim-input-label">Portal Password</label>
                            <input type="password" id="claim-portal-pass" class="claim-input" placeholder="••••••••" />
                        </div>
                    </div>

                    <button onclick="window.submitClaimStep1()" id="claim-btn-1" class="w-full py-4 bg-[var(--mac-blue)] text-white rounded-2xl font-bold text-sm spring active:scale-95 flex items-center justify-center gap-2">
                        Verify & Continue
                    </button>
                </div>
            `;
        } else if (step === 2) {
            // STEP 2: Identity Verification
            const questionsHtml = CLAIM_STATE.questions.map((q, idx) => `
                <div>
                    <label class="claim-input-label">${QUESTION_LABELS[q] || q}</label>
                    <input type="text" id="claim-ans-${q}" class="claim-input" placeholder="Your answer..." />
                </div>
            `).join('');

            content = `
                <div class="space-y-5">
                    <div class="text-center">
                        <p class="text-sm text-[#86868b]">Step 2 of 3</p>
                        <h4 class="text-xl font-black mt-1">Identity Verification</h4>
                        <p class="text-xs text-zinc-400 mt-2 px-6">Answer these verification questions from your profile database to secure your identity.</p>
                    </div>

                    <div class="space-y-4 bg-zinc-900/40 p-5 rounded-3xl border border-white/5">
                        ${questionsHtml}
                    </div>

                    <div class="text-center text-xs">
                        <p class="${CLAIM_STATE.attemptsRemaining <= 2 ? 'text-red-400' : 'text-zinc-500'} font-bold">
                            ${CLAIM_STATE.attemptsRemaining} verification attempts remaining
                        </p>
                    </div>

                    <button onclick="window.submitClaimStep2()" id="claim-btn-2" class="w-full py-4 bg-[var(--mac-blue)] text-white rounded-2xl font-bold text-sm spring active:scale-95">
                        Verify Identity
                    </button>
                </div>
            `;
        } else if (step === 3) {
            // STEP 3: Set PIN (Optional)
            content = `
                <div class="space-y-5">
                    <div class="text-center">
                        <p class="text-sm text-[#86868b]">Step 3 of 3</p>
                        <h4 class="text-xl font-black mt-1">Secure Your Profile</h4>
                        <p class="text-xs text-zinc-400 mt-2 px-6">Create a quick entry PIN to instantly lock and unlock your academic records.</p>
                    </div>

                    <div class="space-y-4 bg-zinc-900/40 p-5 rounded-3xl border border-white/5">
                        <div>
                            <label class="claim-input-label">PIN Length</label>
                            <div class="flex gap-2">
                                <button onclick="window.setClaimPinLength(4)" id="btn-pin-len-4" class="flex-1 py-3 bg-[var(--mac-blue)] text-white border border-white/10 rounded-xl font-bold text-xs spring">4 Digits</button>
                                <button onclick="window.setClaimPinLength(6)" id="btn-pin-len-6" class="flex-1 py-3 bg-zinc-800 text-zinc-400 border border-white/5 rounded-xl font-bold text-xs spring">6 Digits</button>
                            </div>
                        </div>
                        <div>
                            <label class="claim-input-label">Enter PIN</label>
                            <input type="password" id="claim-pin" class="claim-input text-center text-xl tracking-[0.3em]" maxlength="4" placeholder="••••" />
                        </div>
                        <div>
                            <label class="claim-input-label">Confirm PIN</label>
                            <input type="password" id="claim-pin-confirm" class="claim-input text-center text-xl tracking-[0.3em]" maxlength="4" placeholder="••••" />
                        </div>
                    </div>

                    <div class="space-y-3">
                        <button onclick="window.submitClaimStep3()" class="w-full py-4 bg-[var(--mac-blue)] text-white rounded-2xl font-bold text-sm spring active:scale-95">
                            Set PIN & Finish
                        </button>
                        <button onclick="window.skipClaimPin()" class="w-full py-3 bg-white/5 border border-white/10 text-white rounded-2xl font-bold text-xs spring active:scale-95">
                            Skip for Now
                        </button>
                    </div>
                </div>
            `;
        }

        // Apply template
        container.innerHTML = `
            <div class="flex justify-center gap-1.5 mb-6">${dots}</div>
            ${content}
        `;
    }

    // --- BUTTON / ACTIONS HANDLERS ---

    window.submitClaimStep1 = async function () {
        const passwordInput = document.getElementById('claim-portal-pass');
        const pass = (passwordInput?.value || '').trim();
        if (!pass) {
            alert('Please enter your portal password.');
            return;
        }

        const btn = document.getElementById('claim-btn-1');
        btn.disabled = true;
        btn.innerHTML = '<span class="loading-spinner"></span> Authenticating...';

        try {
            // Call the Cloudflare Worker login endpoint directly to verify the portal credentials
            const res = await fetch(`${CF_WORKER_URL}/api/auth/login`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    admissionNumber: CLAIM_STATE.admissionNumber,
                    password: pass
                })
            });
            const json = await res.json();

            if (!res.ok || !json.success) {
                throw new Error(json.error || 'Invalid credentials or portal error.');
            }

            // Immediately authenticate user in Firebase Auth using custom token
            if (json.token && window.firebaseAuth && window.firebaseSignInWithCustomToken) {
                await window.firebaseSignInWithCustomToken(window.firebaseAuth, json.token);
                console.log('✅ Authenticated Firebase with custom token');
            }

            CLAIM_STATE.password = pass;

            // Build identity verification questions using profile returned directly by Worker
            let profileData = json.profile?.payload?.sections?.[0]?.data || json.profile?.sections?.[0]?.data || json.profile || null;
            
            if (profileData) {
                CLAIM_STATE.questions = generateVerificationQuestions(profileData);
            } else {
                // Try Firestore read fallback just in case
                const db = window.firebaseFirestore;
                if (db) {
                    try {
                        const docRef = window.firestoreDoc(db, 'portalDataCache', CLAIM_STATE.admissionNumber);
                        const docSnap = await window.firestoreGetDoc(docRef);
                        if (docSnap.exists()) {
                            const dataVal = docSnap.data();
                            const profileDataVal = dataVal.profile?.data || dataVal.profile || dataVal;
                            CLAIM_STATE.questions = generateVerificationQuestions(profileDataVal);
                        }
                    } catch (e) {
                        console.warn('Firestore profile read fallback failed:', e.message);
                    }
                }
            }

            if (CLAIM_STATE.questions.length < 3) {
                // Not enough profile data for questions, skip verification step and go directly to PIN
                renderClaimStep(3);
            } else {
                renderClaimStep(2);
            }
        } catch (err) {
            alert(err.message || 'Incorrect portal password or network error.');
        } finally {
            btn.disabled = false;
            btn.innerHTML = 'Verify & Continue';
        }
    };

    window.submitClaimStep2 = async function () {
        const answers = {};
        let missing = false;

        CLAIM_STATE.questions.forEach(q => {
            const input = document.getElementById(`claim-ans-${q}`);
            const val = (input?.value || '').trim();
            if (!val) missing = true;
            answers[q] = val;
        });

        if (missing) {
            alert('Please answer all verification questions.');
            return;
        }

        const btn = document.getElementById('claim-btn-2');
        btn.disabled = true;
        btn.innerHTML = 'Verifying identity...';

        try {
            const res = await fetch(`${CF_WORKER_URL}/api/auth/verify-profile-data`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    admissionNumber: CLAIM_STATE.admissionNumber,
                    answers
                })
            });
            const result = await res.json();

            if (result.success && result.verified) {
                renderClaimStep(3);
            } else {
                CLAIM_STATE.attemptsRemaining = result.attemptsRemaining || 0;
                if (result.error === 'LOCKED' || CLAIM_STATE.attemptsRemaining <= 0) {
                    alert('Profile verification locked for 30 minutes due to consecutive failures.');
                    switchView('view-home');
                } else {
                    alert('Verification failed. Some answers are incorrect. Try again.');
                    renderClaimStep(2); // regenerate inputs
                }
            }
        } catch (err) {
            alert('Error during identity verification: ' + err.message);
        } finally {
            btn.disabled = false;
        }
    };

    window.setClaimPinLength = function (len) {
        const pinIn = document.getElementById('claim-pin');
        const confirmIn = document.getElementById('claim-pin-confirm');
        const btn4 = document.getElementById('btn-pin-len-4');
        const btn6 = document.getElementById('btn-pin-len-6');

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

    // Helper to generate a random cryptographically secure token
    function generateDeviceToken() {
        const array = new Uint8Array(24);
        crypto.getRandomValues(array);
        return Array.from(array, byte => byte.toString(16).padStart(2, '0')).join('');
    }

    window.submitClaimStep3 = async function () {
        const pinVal = document.getElementById('claim-pin')?.value || '';
        const confirmVal = document.getElementById('claim-pin-confirm')?.value || '';
        const pinLen = document.getElementById('claim-pin')?.maxLength || 4;

        if (pinVal.length !== pinLen) {
            alert(`PIN must be exactly ${pinLen} digits.`);
            return;
        }
        if (pinVal !== confirmVal) {
            alert('PIN confirmation does not match.');
            return;
        }

        try {
            // Load bcryptjs dynamically if not already present
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

            await finishProfileClaim(pinHash, pinLen);
        } catch (e) {
            alert('Error hashing PIN: ' + e.message);
        }
    };

    window.skipClaimPin = async function () {
        if (confirm('Skipping PIN means anyone with access to your device can view your personal info. Continue?')) {
            await finishProfileClaim(null, 4);
        }
    };

    async function finishProfileClaim(pinHash, pinLen) {
        const db = window.firebaseFirestore;
        if (!db) {
            alert('Database is not initialized. Please reload the app.');
            return;
        }

        const deviceToken = generateDeviceToken();

        let portalPasswordEncrypted = null;
        if (CLAIM_STATE.password) {
            try {
                const encRes = await fetch(`${CF_WORKER_URL}/api/auth/encrypt-password`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ password: CLAIM_STATE.password })
                });
                const encData = await encRes.json();
                if (encData.success) {
                    portalPasswordEncrypted = encData.encrypted;
                }
            } catch (encErr) {
                console.warn('Failed to encrypt portal password on claim:', encErr.message);
            }
        }

        try {
            const securityData = {
                pinHash,
                pinLength: pinLen,
                isProfileClaimed: true,
                claimedAt: new Date().toISOString(),
                lastVerifiedAt: new Date().toISOString(),
                identityVerified: true,
                deviceTokens: [deviceToken],
                portalPasswordEncrypted
            };

            // Call the secure Worker endpoint to update the student doc in Firestore (bypassing rules)
            const updateRes = await fetch(`${CF_WORKER_URL}/api/auth/update-student`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    admissionNumber: CLAIM_STATE.admissionNumber,
                    password: CLAIM_STATE.password,
                    fields: {
                        security: securityData
                    }
                })
            });
            const updateJson = await updateRes.json();
            if (!updateRes.ok || !updateJson.success) {
                throw new Error(updateJson.error || 'Worker update failed');
            }

            // Save to localStorage
            localStorage.setItem('machub_device_token', deviceToken);
            localStorage.setItem('machub_claimed_admission', CLAIM_STATE.admissionNumber);
            localStorage.setItem('machub_pin_configured_' + CLAIM_STATE.admissionNumber, pinHash ? 'true' : 'false');

            // Update app state
            window.ExamHubState.security.isProfileClaimed = true;
            window.ExamHubState.security.pinLength = pinLen;
            window.ExamHubState.security.deviceToken = deviceToken;
            window.ExamHubState.security.isUnlocked = true;

            alert('Profile claimed successfully!');
            
            // Switch to profile
            if (typeof window.viewStudentProfile === 'function') {
                window.viewStudentProfile(CLAIM_STATE.admissionNumber);
            } else {
                switchView('view-profile');
            }
        } catch (err) {
            alert('Failed to save security settings: ' + err.message);
        }
    }

    window.ExamHubClaim = {
        init: initProfileClaim
    };

})();
