(function () {
    // Escaping helper to prevent injection
    function escapeHtml(str) {
        if (!str) return '---';
        return str
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;')
            .replace(/'/g, '&#039;');
    }

    function getStudentInfo() {
        const info = window.ExamHubProfile?.get();
        if (info && (info.adminNo || info.name)) return info;
        try {
            const stored = localStorage.getItem('mac_student_info');
            if (stored) {
                const parsed = JSON.parse(stored);
                if (parsed && (parsed.adminNo || parsed.name)) return parsed;
            }
        } catch(e) {}
        const adminNo = localStorage.getItem('machub_student_id');
        if (!adminNo) return null;
        return { name: 'Student', adminNo: adminNo, dept: 'General', classGroup: '' };
    }

    function getPortalCache(section, adminNo, semester = '') {
        if (!adminNo) return null;
        if (semester) {
            const key = `machub_portal_${section}_sem${semester}_${adminNo}`;
            const data = localStorage.getItem(key);
            if (data) return data;
            
            // Fallback: Check if generic key contains data matching the requested semester
            const directKey = `machub_portal_${section}_${adminNo}`;
            const direct = localStorage.getItem(directKey);
            if (direct) {
                try {
                    const parsed = JSON.parse(direct);
                    const payload = parsed?.data?.payload || parsed?.data || parsed;
                    const sems = payload?.semesters || payload?.semesterOptions || [];
                    const selectedOpt = sems.find(s => s.selected);
                    if (selectedOpt) {
                        const textMatch = String(selectedOpt.text || '').match(/\d+/);
                        const valMatch  = String(selectedOpt.value || '').match(/\d+/);
                        const semNumFromCache = textMatch ? textMatch[0] : (valMatch ? valMatch[0] : null);
                        if (semNumFromCache && semNumFromCache === String(semester)) {
                            return direct;
                        }
                    }
                } catch (e) {}
            }
        }
        const directKey = `machub_portal_${section}_${adminNo}`;
        const direct = localStorage.getItem(directKey);
        if (direct) return direct;
        
        // Check for semester-specific keys
        for (let i = 0; i < localStorage.length; i++) {
            const key = localStorage.key(i);
            if (key && key.startsWith(`machub_portal_${section}_sem`) && key.endsWith(`_${adminNo}`)) {
                return localStorage.getItem(key);
            }
        }
        return null;
    }

    function saveStudentInfo(profile) {
        window.ExamHubProfile.save(profile);
        return profile;
    }
    // Settings persistence (skins, active fields, battery saver tilt mode)
    function readSettings() {
        const defaults = {
            holoSkin: 'amethyst', // default skin
            showReg: true,
            showAdmin: true,
            highFidelity: true,
            goPrivate: false,
            hideGrades: false,
            anonymizeRank: false,
            localCache: true,
            autoWipe: false,
            analytics: true,
            notifyAttendance: true,
            notifyMarks: true,
            notifyFees: false,
            oledMode: true,
            animations: true
        };
        try {
            const stored = localStorage.getItem('mac_profile_settings');
            if (stored) {
                const parsed = JSON.parse(stored);
                // Force oledMode to always be true (Only Dark Mode)
                parsed.oledMode = true;
                // Force telemetry setting to always be true
                if (parsed.analytics !== true) {
                    parsed.analytics = true;
                }
                try {
                    localStorage.setItem('mac_profile_settings', JSON.stringify(parsed));
                } catch(e) {}
                return { ...defaults, ...parsed };
            }
        } catch(e) {}
        return defaults;
    }

    function writeSettings(settings) {
        try {
            localStorage.setItem('mac_profile_settings', JSON.stringify(settings));
        } catch(e) {
            console.warn('localStorage is restricted', e);
        }
    }

    function setProfileHoloSkin(skinName) {
        const settings = readSettings();
        settings.holoSkin = skinName;
        writeSettings(settings);

        // Highlight active skin button
        ['amethyst', 'cyberpunk', 'emerald', 'classic'].forEach(s => {
            const btn = document.getElementById('skin-btn-' + s);
            if (!btn) return;
            if (s === skinName) {
                btn.classList.add('bg-[var(--mac-blue)]', 'text-white');
                btn.classList.remove('border-black/10', 'dark:border-white/10');
            } else {
                btn.classList.remove('bg-[var(--mac-blue)]', 'text-white');
                btn.classList.add('border-black/10', 'dark:border-white/10');
            }
        });

        // Update card element class instantly
        const ticketEl = document.getElementById('profile-ticketEl');
        if (ticketEl) {
            // Remove existing skins
            ticketEl.classList.remove('holo-skin-amethyst', 'holo-skin-cyberpunk', 'holo-skin-emerald', 'holo-skin-classic');
            // Add new skin
            ticketEl.classList.add('holo-skin-' + skinName);
        }
        showToast(`Theme skin set to ${skinName.toUpperCase()}`, 'success');
    }
    // Toggle fields visibility or interactive 3D physics
    function toggleCardField(fieldName) {
        const settings = readSettings();
        if (fieldName === 'showReg') {
            settings.showReg = (document.getElementById('toggleShowReg-fp') || document.getElementById('toggleShowReg'))?.checked ?? true;
        } else if (fieldName === 'showAdmin') {
            settings.showAdmin = (document.getElementById('toggleShowAdmin-fp') || document.getElementById('toggleShowAdmin'))?.checked ?? true;
        } else if (fieldName === 'highFidelity') {
            settings.highFidelity = (document.getElementById('togglePerformance-fp') || document.getElementById('togglePerformance'))?.checked ?? true;
        }
        writeSettings(settings);

        // Refresh card to reflect toggles and restart tilt engine
        renderUserProfile();
    }

    function togglePrivacySetting(field) {
        const settings = readSettings();
        const elId = 'privacy' + field.charAt(0).toUpperCase() + field.slice(1);
        const el = document.getElementById(elId);
        if (el) {
            settings[field] = el.checked;
            writeSettings(settings);
            const displayNames = {
                goPrivate: 'Private Profile',
                hideGrades: 'Hide Grades & GPA',
                anonymizeRank: 'Anonymize Rank',
                localCache: 'Local Cache',
                autoWipe: 'Auto-Wipe Session',
                analytics: 'Telemetry Sharing'
            };
            showToast(`${displayNames[field] || field} ${el.checked ? 'enabled' : 'disabled'}.`, 'success');
        }
    }

    function toggleNotificationSetting(category) {
        const settings = readSettings();
        const elId = 'toggleNotify' + category.charAt(0).toUpperCase() + category.slice(1);
        const el = document.getElementById(elId);
        if (el) {
            const field = 'notify' + category.charAt(0).toUpperCase() + category.slice(1);
            settings[field] = el.checked;
            writeSettings(settings);
            showToast(`${category.charAt(0).toUpperCase() + category.slice(1)} alerts ${el.checked ? 'enabled' : 'disabled'}.`, 'success');
        }
    }

    // Toggle oled or animations preferences
    function toggleDisplaySetting(option) {
        const settings = readSettings();
        const elId = 'toggleDisplay' + option.charAt(0).toUpperCase() + option.slice(1);
        const el = document.getElementById(elId);
        if (el) {
            const field = option === 'oled' ? 'oledMode' : option;
            settings[field] = el.checked;
            writeSettings(settings);
            
            if (option === 'oled') {
                if (el.checked) {
                    document.documentElement.classList.add('dark');
                    document.body.style.backgroundColor = '#000';
                } else {
                    document.documentElement.classList.remove('dark');
                    document.body.style.backgroundColor = '';
                }
            }
            
            showToast(`${option.toUpperCase()} mode ${el.checked ? 'activated' : 'deactivated'}.`, 'success');
        }
    }

    // Triggers diagnostic wipe
    function triggerResetProfile() {
        const confirmWipe = confirm('Are you sure you want to reset your academic identity? This will wipe your saved credentials and return to the onboarding setup.');
        if (confirmWipe) {
            localStorage.removeItem('mac_student_info');
            localStorage.removeItem('mac_profile_settings');
            
            // Reload window to show onboarding step 1
            window.location.reload();
        }
    }

    // NaN Percentage Sanitizer to guard scraper calculations
    function sanitizePct(val) {
        const parsed = parseFloat(val);
        if (isNaN(parsed)) return 0;
        return Math.max(0, Math.min(100, parsed));
    }

    // Liquid glass toast notification system
    function showToast(message, type = 'info') {
        const container = document.getElementById('macToastContainer');
        if (!container) return;

        const toast = document.createElement('div');
        toast.className = 'mac-toast';

        let icon = 'ℹ️';
        if (type === 'success') icon = '✅';
        else if (type === 'error') icon = '❌';
        else if (type === 'warning') icon = '⚠️';

        toast.innerHTML = `
            <span class="mac-toast-icon">${icon}</span>
            <div class="mac-toast-content">${message}</div>
        `;

        container.appendChild(toast);

        // Auto dismiss after 3 seconds
        setTimeout(() => {
            toast.classList.add('is-leaving');
            // Wait for the opacity transition to complete before removing from DOM
            setTimeout(() => {
                toast.remove();
            }, 300);
        }, 3000);
    }

    // Share Public Profile Clipboard Handler (Supports file://, localhost, and live origins)
    function copyPublicProfileLink() {
        const info = getStudentInfo();
        const studentId = localStorage.getItem('machub_student_id') || (info && info.adminNo);
        if (!studentId) return alert('Please log in to your student profile first to share your public showcase link!');
        let publicUrl = '';

        if (window.location.protocol === 'file:') {
            const baseUrl = window.location.href.split('?')[0].split('#')[0];
            publicUrl = `${baseUrl}?p=${studentId}`;
        } else if (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1') {
            const pathBase = window.location.pathname.includes('index.html') ? window.location.pathname : '/index.html';
            publicUrl = `${window.location.origin}${pathBase}?p=${studentId}`;
        } else {
            publicUrl = `${window.location.origin}/p/${studentId}`;
        }

        if (navigator.clipboard && navigator.clipboard.writeText) {
            navigator.clipboard.writeText(publicUrl).then(() => {
                if (window.showToast) window.showToast("Public profile link copied! 🚀 Share it anywhere.", "success");
                else alert("Public profile link copied! 🚀\n" + publicUrl);
            }).catch(err => {
                console.error("Clipboard copy failed:", err);
                alert(`Your public link is: ${publicUrl}`);
            });
        } else {
            const input = document.createElement('input');
            input.value = publicUrl;
            document.body.appendChild(input);
            input.select();
            try {
                document.execCommand('copy');
                if (window.showToast) window.showToast("Public profile link copied! 🚀 Share it anywhere.", "success");
                else alert("Public profile link copied! 🚀\n" + publicUrl);
            } catch(e) {
                alert(`Your public link is: ${publicUrl}`);
            }
            document.body.removeChild(input);
        }
    }
    window.copyPublicProfileLink = copyPublicProfileLink;
    window.shareStudentProfile = copyPublicProfileLink;

    // Active Tab Switcher
    let currentProfileTab = 0;
    function selectProfileTab(index) {
        currentProfileTab = index;
        
        // Update active tab button classes
        [0, 1, 2].forEach(i => {
            const btn = document.getElementById('profileTabBtn-' + i);
            const panel = document.getElementById('profileTabPanel-' + i);
            if (btn) {
                if (i === index) {
                    btn.classList.add('active', 'text-[#f5f5f7]');
                    btn.classList.remove('text-[#86868b]');
                } else {
                    btn.classList.remove('active', 'text-[#f5f5f7]');
                    btn.classList.add('text-[#86868b]');
                }
            }
            if (panel) {
                if (i === index) {
                    panel.classList.remove('hidden');
                } else {
                    panel.classList.add('hidden');
                }
            }
        });

        // Update sliding indicator position
        const indicator = document.getElementById('profileTabIndicator');
        if (indicator) {
            indicator.style.left = (index * 33.33) + '%';
        }
    }

    // Settings Tray Drawer Control
    function openSettingsTray() {
        switchView('view-settings');
        renderSettingsProfileSummary();
        filterSettingsAvatars('all', null);
        if (window.hideBottomNav) window.hideBottomNav();
    }

    function closeSettingsTray() {
        switchView('view-profile');
        if (window.showBottomNav) window.showBottomNav();
        if (location.hash === '#settings') {
            history.replaceState(null, null, ' ');
        }
    }

    function renderSettingsProfileSummary() {
        const info = getStudentInfo();
        if (!info) return;
        const adminNo = info.adminNo || '';
        const overrides = JSON.parse(localStorage.getItem('machub_profile_overrides_' + adminNo) || '{}');
        const p = { ...info, ...overrides };

        const avImg = document.getElementById('settingsProfileAvatarImg');
        const nameEl = document.getElementById('settingsProfileName');
        const deptEl = document.getElementById('settingsProfileDept');

        if (nameEl) nameEl.textContent = p.name || '---';
        if (deptEl) deptEl.textContent = (p.dept || p.classGroup || '---') + ' · ' + (adminNo ? 'Adm ' + adminNo : '');

        if (avImg) {
            const avatarSrc = p.avatarSrc || p.photoUrl || 'assets/img/ChatGPT%20Image%20May%2018,%202026,%2010_33_49%20PM.png';
            if (avatarSrc.startsWith('assets/') || avatarSrc.startsWith('data:') || avatarSrc.startsWith('http')) {
                avImg.src = avatarSrc;
                avImg.style.display = 'block';
                const ringInner = avImg.closest('.w-12');
                if (ringInner) {
                    const emojiDisplay = ringInner.querySelector('.av-emoji-display');
                    if (emojiDisplay) emojiDisplay.remove();
                }
            } else {
                avImg.style.display = 'none';
                const ringInner = avImg.closest('.w-12');
                if (ringInner) {
                    let emojiDisplay = ringInner.querySelector('.av-emoji-display');
                    if (!emojiDisplay) {
                        emojiDisplay = document.createElement('div');
                        emojiDisplay.className = 'av-emoji-display';
                        emojiDisplay.style.cssText = 'font-size:24px;line-height:1; font-weight:800;';
                        ringInner.appendChild(emojiDisplay);
                    }
                    emojiDisplay.textContent = avatarSrc;
                }
            }
        }

        // Map allotment fields
        const allotStudent = document.getElementById('allotment-student');
        const allotAdmin = document.getElementById('allotment-admin');
        const allotCourse = document.getElementById('allotment-course');
        
        if (allotStudent) allotStudent.textContent = p.name || '---';
        if (allotAdmin) allotAdmin.textContent = adminNo || '---';
        if (allotCourse) allotCourse.textContent = p.dept || p.classGroup || '---';

        // Update Security settings overview fields
        const claimStatusText = document.getElementById('sec-claim-status-text');
        const claimBtn = document.getElementById('sec-btn-claim-profile');
        const labelPinAction = document.getElementById('sec-label-pin-action');
        const btnLen4 = document.getElementById('sec-btn-len-4');
        const btnLen6 = document.getElementById('sec-btn-len-6');

        if (claimStatusText) {
            claimStatusText.textContent = localClaimed ? 'Profile claimed and secured' : 'Profile unclaimed (public access only)';
        }

        if (claimBtn) {
            if (!localClaimed) {
                claimBtn.classList.remove('hidden');
            } else {
                claimBtn.classList.add('hidden');
            }
        }

        if (labelPinAction) {
            labelPinAction.textContent = localClaimed ? 'Change Profile PIN' : 'Set Profile PIN';
        }

        const pinLen = parseInt(localStorage.getItem('machub_pin_length_' + adminNo) || '4', 10);
        if (btnLen4 && btnLen6) {
            if (pinLen === 4) {
                btnLen4.className = 'px-3 py-1.5 rounded-lg text-[10px] font-black tracking-wide bg-zinc-800 text-white spring';
                btnLen6.className = 'px-3 py-1.5 rounded-lg text-[10px] font-black tracking-wide text-zinc-400 spring';
            } else {
                btnLen4.className = 'px-3 py-1.5 rounded-lg text-[10px] font-black tracking-wide text-zinc-400 spring';
                btnLen6.className = 'px-3 py-1.5 rounded-lg text-[10px] font-black tracking-wide bg-zinc-800 text-white spring';
            }
        }
    }

    // --- SETTINGS SECURITY ACTIONS ---

    window.triggerSettingsClaim = function () {
        const info = getStudentInfo();
        if (info && info.adminNo) {
            if (window.ExamHubClaim) {
                window.ExamHubClaim.init(info.adminNo);
            }
        }
    };

    window.triggerSettingsChangePin = async function () {
        const info = getStudentInfo();
        if (!info || !info.adminNo) return;
        const adminNo = info.adminNo;
        const localClaimed = localStorage.getItem('machub_claimed_admission') === adminNo;

        if (!localClaimed) {
            if (window.ExamHubClaim) window.ExamHubClaim.init(adminNo);
            return;
        }

        const currentPin = prompt('Enter your current PIN:');
        if (!currentPin) return;

        const db = window.firebaseFirestore;
        if (!db) {
            alert('Database not initialized.');
            return;
        }

        try {
            const studentRef = window.firestoreDoc(db, 'students', adminNo);
            const studentSnap = await window.firestoreGetDoc(studentRef);
            if (!studentSnap.exists()) return;

            const security = studentSnap.data().security || {};
            const pinHash = security.pinHash;

            if (pinHash) {
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
                if (!bcryptLib.compareSync(currentPin, pinHash)) {
                    alert('Incorrect current PIN.');
                    return;
                }
            }

            const newPin = prompt('Enter your new PIN:');
            if (!newPin) return;
            const confirmPin = prompt('Confirm your new PIN:');
            if (newPin !== confirmPin) {
                alert('PIN confirmation does not match.');
                return;
            }

            const pinLen = newPin.length;
            if (pinLen !== 4 && pinLen !== 6) {
                alert('PIN must be either 4 or 6 digits.');
                return;
            }

            const bcryptLib = window.bcrypt || dcodeIO.bcrypt;
            const salt = bcryptLib.genSaltSync(10);
            const newHash = bcryptLib.hashSync(newPin, salt);

            await window.updateFirestoreDocSecurely(adminNo, {
                'security.pinHash': newHash,
                'security.pinLength': pinLen
            });

            localStorage.setItem('machub_pin_length_' + adminNo, pinLen);
            alert('PIN updated successfully!');
            renderSettingsProfileSummary();
        } catch (e) {
            alert('Error updating PIN: ' + e.message);
        }
    };

    window.triggerSettingsPinLength = async function (length) {
        const info = getStudentInfo();
        if (!info || !info.adminNo) return;
        const adminNo = info.adminNo;
        const localClaimed = localStorage.getItem('machub_claimed_admission') === adminNo;

        if (!localClaimed) {
            alert('Claim your profile first to configure PIN options.');
            return;
        }

        const currentPin = prompt(`Enter current PIN to change length to ${length} digits:`);
        if (!currentPin) return;

        const db = window.firebaseFirestore;
        if (!db) return;

        try {
            const studentRef = window.firestoreDoc(db, 'students', adminNo);
            const studentSnap = await window.firestoreGetDoc(studentRef);
            if (!studentSnap.exists()) return;

            const security = studentSnap.data().security || {};
            const pinHash = security.pinHash;

            if (pinHash) {
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
                if (!bcryptLib.compareSync(currentPin, pinHash)) {
                    alert('Incorrect PIN.');
                    return;
                }
            }

            const newPin = prompt(`Enter new ${length}-digit PIN:`);
            if (!newPin || newPin.length !== length) {
                alert(`PIN must be exactly ${length} digits.`);
                return;
            }
            const confirmPin = prompt(`Confirm new ${length}-digit PIN:`);
            if (newPin !== confirmPin) {
                alert('PIN confirmation does not match.');
                return;
            }

            const bcryptLib = window.bcrypt || dcodeIO.bcrypt;
            const salt = bcryptLib.genSaltSync(10);
            const newHash = bcryptLib.hashSync(newPin, salt);

            await window.updateFirestoreDocSecurely(adminNo, {
                'security.pinHash': newHash,
                'security.pinLength': length
            });

            localStorage.setItem('machub_pin_length_' + adminNo, length);
            alert(`PIN length changed to ${length} digits and new PIN set successfully!`);
            renderSettingsProfileSummary();
        } catch (e) {
            alert('Error configuring PIN length: ' + e.message);
        }
    };

    window.triggerDeleteStoredPassword = async function () {
        if (!confirm('Are you sure you want to delete your stored portal password from Firebase? Next background sync attempts will pause until you re-enter your password.')) {
            return;
        }

        const info = getStudentInfo();
        if (!info || !info.adminNo) return;
        const adminNo = info.adminNo;

        const db = window.firebaseFirestore;
        if (!db) return;

        try {
            const studentRef = window.firestoreDoc(db, 'students', adminNo);
            await window.updateFirestoreDocSecurely(adminNo, {
                'security.portalPasswordEncrypted': null,
                'security.portalPasswordEncryptedAdmin': null
            });
            alert('Stored portal password deleted successfully.');
        } catch (e) {
            alert('Error deleting password: ' + e.message);
        }
    };

    window.triggerLogoutAllDevices = async function () {
        if (!confirm('Are you sure you want to logout from all devices? All other devices will be forced to re-claim/unlock.')) {
            return;
        }

        const info = getStudentInfo();
        if (info && info.adminNo) {
            const adminNo = info.adminNo;
            const db = window.firebaseFirestore;
            if (db && window.updateFirestoreDocSecurely) {
                try {
                    await window.updateFirestoreDocSecurely(adminNo, {
                        'security.deviceTokens': []
                    });
                } catch (e) {
                    console.warn('Error updating device tokens on logout:', e.message);
                }
            }
        }

        if (window.clearUserSession) {
            window.clearUserSession();
        } else {
            try {
                const keysToRemove = [];
                for (let i = 0; i < localStorage.length; i++) {
                    const key = localStorage.key(i);
                    if (key && (key.startsWith('machub_') || key.startsWith('mac_'))) {
                        keysToRemove.push(key);
                    }
                }
                keysToRemove.forEach(key => localStorage.removeItem(key));
            } catch (e) {}
        }
        window.location.reload();
    };

    // Instagram-style Full Page Rankings View Control
    let cachedRankings = null;
    let rankingsFetchPromise = null;

    function openRankingsFullPage() {
        const page = document.getElementById('rankingsFullPage');
        if (page) {
            page.classList.remove('hidden');
            setTimeout(() => {
                page.classList.add('is-open');
            }, 10);
            renderRankingsListFP();
        }
        if (window.hideBottomNav) window.hideBottomNav();
    }

    function closeRankingsFullPage() {
        const page = document.getElementById('rankingsFullPage');
        if (page) {
            page.classList.remove('is-open');
            setTimeout(() => {
                page.classList.add('hidden');
            }, 300);
            // Clear search filter input on close
            const searchInput = document.getElementById('rankingsSearchInput');
            if (searchInput) searchInput.value = '';
        }
        if (window.showBottomNav) window.showBottomNav();
    }

    function filterRankingsList() {
        renderRankingsListFP();
    }

    function fetchRankingsAndUpdateUI(adminNo, currentAttendancePct) {
        if (cachedRankings) {
            updateRankUI(adminNo, currentAttendancePct);
            return;
        }
        if (rankingsFetchPromise) return;

        if (!window.firebaseFirestore || !window.firestoreDoc || !window.firestoreGetDoc) {
            setTimeout(() => fetchRankingsAndUpdateUI(adminNo, currentAttendancePct), 500);
            return;
        }

        const docRef = window.firestoreDoc(window.firebaseFirestore, 'rankings', 'bca_2025');
        rankingsFetchPromise = window.firestoreGetDoc(docRef)
            .then(snap => {
                if (snap.exists()) {
                    cachedRankings = snap.data();
                    updateRankUI(adminNo, currentAttendancePct);
                }
            })
            .catch(err => {
                console.error('[Rankings] Failed to fetch rankings:', err.message);
                rankingsFetchPromise = null;
            });
    }

    function updateRankUI(adminNo, currentAttendancePct) {
        if (!cachedRankings || !cachedRankings.rankings) return;

        const myRank = cachedRankings.rankings.find(r => String(r.admissionNumber) === String(adminNo));
        const statRank = document.getElementById('profileStatRank');
        const statRankLabel = document.getElementById('profileStatRankLabel');

        if (statRank) {
            if (myRank && myRank.rank !== undefined && myRank.rank !== null) {
                statRank.textContent = `#${myRank.rank}`;
            } else {
                statRank.textContent = '#--';
            }
        }

        if (statRankLabel) {
            statRankLabel.textContent = `Rank (${currentAttendancePct}%)`;
        }

        const updatedTextEl = document.getElementById('rankingsUpdatedTextFP');
        if (updatedTextEl && cachedRankings.compiledAt) {
            const date = new Date(cachedRankings.compiledAt);
            updatedTextEl.textContent = `Updated: ${date.toLocaleDateString()} ${date.toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}`;
        }
    }

    function renderRankingsListFP() {
        const container = document.getElementById('rankingsListContainerFP');
        const countText = document.getElementById('rankingsCountText');
        const searchInput = document.getElementById('rankingsSearchInput');
        
        if (!container) return;

        if (!cachedRankings || !cachedRankings.rankings) {
            container.innerHTML = `
                <div class="flex flex-col items-center justify-center py-16 text-center">
                    <svg class="animate-spin h-6 w-6 text-[var(--mac-blue)] mb-2" fill="none" viewBox="0 0 24 24">
                        <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle>
                        <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                    </svg>
                    <span class="text-xs text-[#86868b] font-bold">Loading classmates...</span>
                </div>
            `;
            return;
        }

        const info = getStudentInfo() || {};
        const myAdminNo = info.adminNo || '';
        const query = (searchInput ? searchInput.value : '').toLowerCase().trim();

        // Filter rankings list based on search query
        const filtered = cachedRankings.rankings.filter(s => {
            if (!query) return true;
            return s.name.toLowerCase().includes(query) || 
                   String(s.admissionNumber).includes(query) || 
                   String(s.classNo).includes(query) ||
                   s.classGroup.toLowerCase().includes(query);
        });

        if (countText) {
            countText.textContent = `${filtered.length} Students`;
        }

        if (filtered.length === 0) {
            container.innerHTML = `
                <div class="flex flex-col items-center justify-center py-16 text-center">
                    <span class="text-3xl mb-2">🔍</span>
                    <p class="text-sm font-black text-[#1d1d1f] dark:text-[#f5f5f7]">No results found</p>
                    <p class="text-xs text-[#86868b] mt-1 font-bold">Try searching for another name or class number.</p>
                </div>
            `;
            return;
        }

        const settings = readSettings();

        const listHtml = filtered.map(student => {
            const isMe = String(student.admissionNumber) === String(myAdminNo);
            
            let name = student.name;
            let classGroup = student.classGroup;
            let classNo = student.classNo;
            let photoUrl = student.photoUrl;
            let attendancePct = student.attendancePct;
            let rank = student.rank;
            let isPending = attendancePct === null;
            
            if (isMe) {
                if (settings.goPrivate) {
                    name = 'Private Profile';
                    classGroup = '---';
                    classNo = '---';
                    photoUrl = '';
                    attendancePct = null;
                    isPending = true;
                    rank = '-';
                } else if (settings.anonymizeRank) {
                    name = 'Anonymous (You)';
                    photoUrl = '';
                    rank = '-';
                }
            }

            const rowClass = isMe 
                ? 'bg-[var(--mac-blue)]/5 dark:bg-[var(--mac-blue)]/10 font-bold border-l-4 border-[var(--mac-blue)]'
                : 'border-transparent';

            let avatarHtml = '';
            if (photoUrl) {
                avatarHtml = `<img src="${photoUrl}" class="w-full h-full object-cover rounded-full" alt="${name}">`;
            } else {
                const initials = name.split(' ').map(n => n[0]).join('').slice(0, 2).toUpperCase();
                avatarHtml = `<span class="text-xs font-black text-white">${initials || '??'}</span>`;
            }

            const hash = name.split('').reduce((acc, char) => acc + char.charCodeAt(0), 0);
            const gradients = [
                'bg-gradient-to-tr from-pink-500 to-yellow-500',
                'bg-gradient-to-tr from-purple-600 to-blue-500',
                'bg-gradient-to-tr from-green-400 to-blue-600',
                'bg-gradient-to-tr from-red-500 to-orange-500',
                'bg-gradient-to-tr from-indigo-500 to-purple-500'
            ];
            const avatarBgClass = photoUrl ? 'bg-transparent' : gradients[hash % gradients.length];

            const pillText = isPending 
                ? 'Pending' 
                : `${attendancePct}%`;

            const pillBtnClass = isMe
                ? 'bg-[var(--mac-blue)] text-white'
                : 'bg-black/5 dark:bg-white/10 text-slate-700 dark:text-slate-300';

            const rankDisplay = isPending 
                ? '-' 
                : `#${rank}`;

            let pillStyle = '';
            if (isMe && settings.hideGrades && !isPending) {
                pillStyle = 'filter: blur(4px); select-none;';
            }

            return `
                <div class="flex items-center justify-between py-3.5 px-2 border-l-4 ${rowClass} transition-all duration-150">
                    <div class="flex items-center gap-3 flex-1 min-w-0">
                        <span class="w-8 text-xs font-black text-[#86868b] dark:text-slate-400 text-center">
                            ${rankDisplay}
                        </span>
                        
                        <div class="w-10 h-10 rounded-full flex items-center justify-center overflow-hidden flex-shrink-0 ${avatarBgClass}">
                            ${avatarHtml}
                        </div>
                        
                        <div class="flex-1 min-w-0">
                            <p class="text-xs font-black text-[#1d1d1f] dark:text-[#f5f5f7] truncate">${name} ${isMe ? ' <span class="text-[9px] font-bold px-1.5 py-0.5 rounded bg-[var(--mac-blue)]/20 text-[var(--mac-blue)] ml-1">You</span>' : ''}</p>
                            <p class="text-[9px] text-[#86868b] font-extrabold mt-0.5">${classGroup} · Class No: ${classNo}</p>
                        </div>
                    </div>
                    
                    <div class="flex-shrink-0 ml-3">
                        <button class="py-1.5 px-3 rounded-lg text-[10px] font-black tracking-wide spring active:scale-95 ${pillBtnClass}" style="${pillStyle}">
                            ${pillText}
                        </button>
                    </div>
                </div>
            `;
        }).join('');

        container.innerHTML = listHtml;
    }

    function openEditProfile() {
        const info = getStudentInfo() || {};
        const adminNo = info.adminNo || '';

        const nameInput = document.getElementById('editName');
        const regInput = document.getElementById('editReg');
        const adminInput = document.getElementById('editAdminNo');
        if (nameInput) nameInput.value = info.name || '';
        if (regInput) regInput.value = info.reg || '';
        if (adminInput) adminInput.value = adminNo;

        // Load custom overrides & bank details
        const overrides = JSON.parse(localStorage.getItem('machub_profile_overrides_' + adminNo) || '{}');
        const bank = JSON.parse(localStorage.getItem('machub_bank_details_' + adminNo) || '{}');

        const bioInput = document.getElementById('editCustomBio');
        const phoneInput = document.getElementById('editPhone');
        const emailInput = document.getElementById('editEmail');
        const addrInput = document.getElementById('editAddress');
        
        const holderInput = document.getElementById('editBankHolder');
        const bankNameInput = document.getElementById('editBankName');
        const accNoInput = document.getElementById('editBankAccNo');
        const ifscInput = document.getElementById('editBankIfsc');
        const branchInput = document.getElementById('editBankBranch');

        if (bioInput) bioInput.value = overrides.customBio || '';
        if (phoneInput) phoneInput.value = overrides.phone || '';
        if (emailInput) emailInput.value = overrides.email || '';
        if (addrInput) addrInput.value = overrides.address || '';
        
        if (holderInput) holderInput.value = bank.holder || '';
        if (bankNameInput) bankNameInput.value = bank.bankName || '';
        if (accNoInput) accNoInput.value = bank.accNo || '';
        if (ifscInput) ifscInput.value = bank.ifsc || '';
        if (branchInput) branchInput.value = bank.branch || '';

        // Highlight saved dept button
        window._editDept = info.dept || '';
        ['BCA', 'BBA', 'BSW'].forEach(d => {
            const btn = document.getElementById('edit-btn-' + d);
            if (!btn) return;
            if (d === window._editDept) {
                btn.classList.add('bg-[var(--mac-blue)]', 'text-white');
                btn.classList.remove('border-black/10', 'dark:border-white/10');
            } else {
                btn.classList.remove('bg-[var(--mac-blue)]', 'text-white');
                btn.classList.add('border-black/10', 'dark:border-white/10');
            }
        });

        switchView('view-profile-edit');
        if (window.hideBottomNav) window.hideBottomNav();
    }

    function closeEditProfile() {
        switchView('view-profile');
        if (window.showBottomNav) window.showBottomNav();
    }

    async function autoSaveProfile() {
        const name = (document.getElementById('editName')?.value || '').trim();
        const reg  = (document.getElementById('editReg')?.value || '').trim();
        const adminNo = (document.getElementById('editAdminNo')?.value || '').trim();
        const dept = window._editDept;

        if (!name || !dept || !adminNo) {
            return; // Don't auto-save if name, dept, or adminNo is missing
        }

        const updated = { name, reg, adminNo, dept };
        saveStudentInfo(updated);

        // Save custom overrides & bank details
        const customBio = (document.getElementById('editCustomBio')?.value || '').trim();
        const phone = (document.getElementById('editPhone')?.value || '').trim();
        const email = (document.getElementById('editEmail')?.value || '').trim();
        const address = (document.getElementById('editAddress')?.value || '').trim();
        
        const holder = (document.getElementById('editBankHolder')?.value || '').trim();
        const bankName = (document.getElementById('editBankName')?.value || '').trim();
        const accNo = (document.getElementById('editBankAccNo')?.value || '').trim();
        const ifsc = (document.getElementById('editBankIfsc')?.value || '').trim();
        const branch = (document.getElementById('editBankBranch')?.value || '').trim();

        const oldOverrides = JSON.parse(localStorage.getItem('machub_profile_overrides_' + adminNo) || '{}');
        const overrides = { 
            ...oldOverrides,
            displayName: name,
            customBio, 
            phone, 
            email, 
            address,
            updatedAt: new Date().toISOString()
        };
        const bank = { holder, bankName, accNo, ifsc, branch };

        localStorage.setItem('machub_profile_overrides_' + adminNo, JSON.stringify(overrides));
        localStorage.setItem('machub_bank_details_' + adminNo, JSON.stringify(bank));

        // Sync to Firestore customProfile/overrides
        if (window.firebaseFirestore && window.firestoreDoc && window.firestoreSetDoc) {
            try {
                const docRef = window.firestoreDoc(window.firebaseFirestore, 'students', adminNo, 'customProfile', 'overrides');
                window.firestoreSetDoc(docRef, {
                    displayName: name,
                    customBio,
                    phone,
                    email,
                    address,
                    photoUrl: oldOverrides.photoUrl || '',
                    photoStoragePath: oldOverrides.photoStoragePath || '',
                    updatedAt: overrides.updatedAt
                }, { merge: true });
            } catch (err) {
                console.warn('[Profile Sync] Failed to save overrides to Firestore:', err.message);
            }
        }

        // Refresh UI components silently
        const homeGreet = document.getElementById('homeGreeting');
        if (homeGreet) homeGreet.textContent = `Hi, ${name.split(' ')[0]}!`;
        const deptEl = document.getElementById('homeUserDept');
        if (deptEl) deptEl.textContent = dept;
        const regEl = document.getElementById('homeUserReg');
        if (regEl) regEl.textContent = reg || 'Not set';

        if (window.setFilter) window.setFilter(dept);
        if (window.updateCountdown) window.updateCountdown();
        if (window.updateHomeSeatInfo) window.updateHomeSeatInfo();
        if (window.renderDaySelector) window.renderDaySelector();

        renderUserProfile();
    }

    async function saveEditProfile() {
        const name = (document.getElementById('editName')?.value || '').trim();
        const reg  = (document.getElementById('editReg')?.value || '').trim();
        const adminNo = (document.getElementById('editAdminNo')?.value || '').trim();
        const dept = window._editDept;

        if (!name || !dept) {
            showToast('Please fill in your name and select a department.', 'warning');
            return;
        }

        const updated = { name, reg, adminNo, dept };
        saveStudentInfo(updated);

        // Save custom overrides & bank details
        const customBio = (document.getElementById('editCustomBio')?.value || '').trim();
        const phone = (document.getElementById('editPhone')?.value || '').trim();
        const email = (document.getElementById('editEmail')?.value || '').trim();
        const address = (document.getElementById('editAddress')?.value || '').trim();
        
        const holder = (document.getElementById('editBankHolder')?.value || '').trim();
        const bankName = (document.getElementById('editBankName')?.value || '').trim();
        const accNo = (document.getElementById('editBankAccNo')?.value || '').trim();
        const ifsc = (document.getElementById('editBankIfsc')?.value || '').trim();
        const branch = (document.getElementById('editBankBranch')?.value || '').trim();

        const oldOverrides = JSON.parse(localStorage.getItem('machub_profile_overrides_' + adminNo) || '{}');
        const overrides = { 
            ...oldOverrides,
            displayName: name,
            customBio, 
            phone, 
            email, 
            address,
            updatedAt: new Date().toISOString()
        };
        const bank = { holder, bankName, accNo, ifsc, branch };

        localStorage.setItem('machub_profile_overrides_' + adminNo, JSON.stringify(overrides));
        localStorage.setItem('machub_bank_details_' + adminNo, JSON.stringify(bank));

        // Sync to Firestore customProfile/overrides
        if (window.firebaseFirestore && window.firestoreDoc && window.firestoreSetDoc) {
            try {
                const docRef = window.firestoreDoc(window.firebaseFirestore, 'students', adminNo, 'customProfile', 'overrides');
                await window.firestoreSetDoc(docRef, {
                    displayName: name,
                    customBio,
                    phone,
                    email,
                    address,
                    photoUrl: oldOverrides.photoUrl || '',
                    photoStoragePath: oldOverrides.photoStoragePath || '',
                    updatedAt: overrides.updatedAt
                }, { merge: true });
                console.log('[Profile Sync] Custom overrides saved to Firestore.');
            } catch (err) {
                console.warn('[Profile Sync] Failed to save overrides to Firestore:', err.message);
            }
        }

        // Refresh home cards instantly
        const homeGreet = document.getElementById('homeGreeting');
        if (homeGreet) homeGreet.textContent = `Hi, ${name.split(' ')[0]}!`;
        const deptEl = document.getElementById('homeUserDept');
        if (deptEl) deptEl.textContent = dept;
        const regEl = document.getElementById('homeUserReg');
        if (regEl) regEl.textContent = reg || 'Not set';

        if (window.setFilter) window.setFilter(dept);
        if (window.updateCountdown) window.updateCountdown();
        if (window.updateHomeSeatInfo) window.updateHomeSeatInfo();
        if (window.renderDaySelector) window.renderDaySelector();

        renderUserProfile();
        closeEditProfile();
        showToast('Profile overrides updated!', 'success');

        if (window.startBackgroundSync) {
            window.startBackgroundSync();
        }
    }

    function selectEditDept(dept) {
        window._editDept = dept;
        ['BCA', 'BBA', 'BSW'].forEach(d => {
            const btn = document.getElementById('edit-btn-' + d);
            if (!btn) return;
            if (d === dept) {
                btn.classList.add('bg-[var(--mac-blue)]', 'text-white');
                btn.classList.remove('border-black/10', 'dark:border-white/10');
            } else {
                btn.classList.remove('bg-[var(--mac-blue)]', 'text-white');
                btn.classList.add('border-black/10', 'dark:border-white/10');
            }
        });
        autoSaveProfile();
    }

    // Asynchronous Firestore Sync Engine
    async function syncProfileOverridesFromCloud(adminNo) {
        if (!window.firebaseFirestore || !window.firestoreDoc || !window.firestoreGetDoc || !adminNo) return;
        try {
            const docRef = window.firestoreDoc(window.firebaseFirestore, 'students', adminNo, 'customProfile', 'overrides');
            const snap = await window.firestoreGetDoc(docRef);
            if (snap.exists()) {
                const data = snap.data() || {};
                const localRaw = localStorage.getItem('machub_profile_overrides_' + adminNo);
                const local = localRaw ? JSON.parse(localRaw) : {};
                
                // Compare updated timestamp or properties
                const cloudUpdated = data.updatedAt || '';
                const localUpdated = local.updatedAt || '';
                
                if (cloudUpdated !== localUpdated || data.displayName !== local.displayName || data.customBio !== local.customBio || data.photoUrl !== local.photoUrl || data.phone !== local.phone || data.email !== local.email || data.address !== local.address) {
                    localStorage.setItem('machub_profile_overrides_' + adminNo, JSON.stringify({
                        ...local,
                        displayName: data.displayName || local.displayName || '',
                        customBio: data.customBio || local.customBio || '',
                        photoUrl: data.photoUrl || local.photoUrl || '',
                        photoStoragePath: data.photoStoragePath || local.photoStoragePath || '',
                        phone: data.phone || local.phone || '',
                        email: data.email || local.email || '',
                        address: data.address || local.address || '',
                        updatedAt: data.updatedAt || new Date().toISOString()
                    }));
                    renderUserProfile();
                }
            }
        } catch (err) {
            console.warn('[Profile Sync] Failed to load custom overrides:', err.message);
        }
    }

    // Avatar Upload Picker Logic
    function initAvatarUpload() {
        const fileInput = document.getElementById('avatarFileInput');
        if (!fileInput) return;

        // Clean any old listener by replacement
        const cloned = fileInput.cloneNode(true);
        fileInput.parentNode.replaceChild(cloned, fileInput);

        cloned.addEventListener('change', async (e) => {
            const file = e.target.files[0];
            if (!file) return;

            // Size: 5MB
            if (file.size > 5 * 1024 * 1024) {
                showToast('File size must be under 5MB.', 'error');
                cloned.value = '';
                return;
            }

            // MIME
            const allowedTypes = ['image/jpeg', 'image/png', 'image/webp'];
            if (!allowedTypes.includes(file.type)) {
                showToast('Only JPG, PNG, and WebP images are allowed.', 'error');
                cloned.value = '';
                return;
            }

            const info = getStudentInfo();
            const adminNo = info ? info.adminNo : '';
            if (!adminNo) {
                showToast('Set your Admission Number first.', 'warning');
                cloned.value = '';
                return;
            }

            if (!window.firebaseStorage || !window.storageRef || !window.storageUploadBytes || !window.storageGetDownloadURL) {
                showToast('Firebase storage is currently unavailable.', 'error');
                cloned.value = '';
                return;
            }

            const progressOverlay = document.getElementById('avatarUploadProgress');
            const progressText = document.getElementById('avatarProgressText');

            if (progressOverlay) progressOverlay.classList.remove('opacity-0', 'pointer-events-none');

            const timestamp = Date.now();
            const extension = file.type.split('/')[1] || 'jpg';
            const storagePath = `students/${adminNo}/profile/avatar_${timestamp}.${extension}`;
            const newRef = window.storageRef(window.firebaseStorage, storagePath);

            const overrides = JSON.parse(localStorage.getItem('machub_profile_overrides_' + adminNo) || '{}');
            const oldPath = overrides.photoStoragePath;

            // Start Upload task
            const uploadTask = window.storageUploadBytes(newRef, file);

            uploadTask.on('state_changed', 
                (snapshot) => {
                    const progress = Math.round((snapshot.bytesTransferred / snapshot.totalBytes) * 100);
                    if (progressText) progressText.textContent = `${progress}%`;
                }, 
                (error) => {
                    console.error('[Upload Error]', error);
                    showToast('Upload failed: ' + error.message, 'error');
                    if (progressOverlay) progressOverlay.classList.add('opacity-0', 'pointer-events-none');
                    cloned.value = '';
                }, 
                async () => {
                    try {
                        const downloadUrl = await window.storageGetDownloadURL(uploadTask.snapshot.ref);

                        // Delete old avatar if path exists
                        if (oldPath && window.storageDeleteObject) {
                            try {
                                const oldRef = window.storageRef(window.firebaseStorage, oldPath);
                                await window.storageDeleteObject(oldRef);
                                console.log('[Upload Cleanup] Deleted old avatar:', oldPath);
                            } catch (delErr) {
                                console.warn('[Upload Cleanup] Old avatar deletion failed or not found:', delErr.message);
                            }
                        }

                        // Save custom overrides
                        const updatedAt = new Date().toISOString();
                        const updatedOverrides = {
                            ...overrides,
                            photoUrl: downloadUrl,
                            photoStoragePath: storagePath,
                            updatedAt
                        };

                        localStorage.setItem('machub_profile_overrides_' + adminNo, JSON.stringify(updatedOverrides));

                        // Write to Firestore customProfile/overrides
                        if (window.firebaseFirestore && window.firestoreDoc && window.firestoreSetDoc) {
                            const docRef = window.firestoreDoc(window.firebaseFirestore, 'students', adminNo, 'customProfile', 'overrides');
                            await window.firestoreSetDoc(docRef, {
                                displayName: overrides.displayName || info.name || '',
                                customBio: overrides.customBio || '',
                                phone: overrides.phone || '',
                                email: overrides.email || '',
                                address: overrides.address || '',
                                photoUrl: downloadUrl,
                                photoStoragePath: storagePath,
                                updatedAt
                            }, { merge: true });
                        }

                        showToast('Profile picture uploaded successfully!', 'success');
                        renderUserProfile();

                    } catch (saveErr) {
                        console.error('[Save Error]', saveErr);
                        showToast('Failed to save profile changes.', 'error');
                    } finally {
                        if (progressOverlay) progressOverlay.classList.add('opacity-0', 'pointer-events-none');
                        cloned.value = '';
                    }
                }
            );
        });
    }

    // High fidelity dynamic rendering
    function renderUserProfile() {
        const info = getStudentInfo();
        if (!info) return;

        const settings = readSettings();
        const adminNo = info.adminNo || '';
        const localClaimed = localStorage.getItem('machub_claimed_admission') === adminNo;

        // Security Gate check (PIN/Claim feature removed)
        const claimBanner = document.getElementById('profileClaimBanner');
        if (claimBanner) {
            claimBanner.classList.add('hidden');
        }

        // 1. Populate details grid
        const nameEl = document.getElementById('profileGridName');
        const deptEl = document.getElementById('profileGridDept');
        const regEl = document.getElementById('profileGridReg');
        const adminEl = document.getElementById('profileGridAdmin');

        if (nameEl) nameEl.textContent = info.name || '---';
        if (deptEl) deptEl.textContent = info.dept || info.classGroup || '---';
        if (regEl) regEl.textContent = info.reg || 'Not Set';
        if (adminEl) adminEl.textContent = adminNo || 'Not Set';

        // 2. Load synced Profile Details and overrides
        let profileData = null;
        if (adminNo) {
            const cachedProfile = getPortalCache('Profile', adminNo);
            if (cachedProfile) {
                try {
                    const parsed = JSON.parse(cachedProfile);
                    profileData = parsed?.data?.payload?.sections?.[0]?.data || parsed?.data?.sections?.[0]?.data || null;
                } catch(e) {}
            }
        }

        const overrides = JSON.parse(localStorage.getItem('machub_profile_overrides_' + adminNo) || '{}');
        const p = { ...profileData, ...overrides };

        if (profileData || overrides.phone || overrides.email || overrides.address) {
            // Unhide and populate Personal details card
            const personalCard = document.getElementById('profileGridPersonalCard');
            if (personalCard) personalCard.classList.remove('hidden');

            const dobEl = document.getElementById('profilePersonalDob');
            const genderEl = document.getElementById('profilePersonalGender');
            const phoneEl = document.getElementById('profilePersonalPhone');
            const emailEl = document.getElementById('profilePersonalEmail');
            const bloodEl = document.getElementById('profilePersonalBlood');
            const aadhaarEl = document.getElementById('profilePersonalAadhaar');
            const religionEl = document.getElementById('profilePersonalReligion');
            const abcEl = document.getElementById('profilePersonalAbc');
            const addressEl = document.getElementById('profilePersonalAddress');

            if (dobEl) dobEl.textContent = p.dob || '---';
            if (genderEl) genderEl.textContent = p.gender || '---';
            if (phoneEl) phoneEl.textContent = p.phone || '---';
            if (emailEl) emailEl.textContent = p.email || '---';
            if (bloodEl) bloodEl.textContent = p.bloodGroup || 'Not Set';
            if (aadhaarEl) aadhaarEl.textContent = p.aadhar || '---';

            let religionText = '';
            if (p.religion && p.caste) religionText = `${p.religion} · ${p.caste}`;
            else if (p.religion) religionText = p.religion;
            else if (p.caste) religionText = p.caste;
            if (religionEl) religionEl.textContent = religionText || '---';

            if (abcEl) abcEl.textContent = p.abcId || 'Not Set';
            if (addressEl) addressEl.textContent = p.address || '---';

            // Unhide and populate Parent/Guardian details card
            if (p.guardianName || p.guardianPhone) {
                const guardianCard = document.getElementById('profileGridGuardianCard');
                if (guardianCard) guardianCard.classList.remove('hidden');

                const gNameEl = document.getElementById('profileGuardianName');
                const gPhoneEl = document.getElementById('profileGuardianPhone');
                if (gNameEl) gNameEl.textContent = p.guardianName || '---';
                if (gPhoneEl) gPhoneEl.textContent = p.guardianPhone || '---';
            }
        } else {
            const personalCard = document.getElementById('profileGridPersonalCard');
            if (personalCard) personalCard.classList.add('hidden');
            const guardianCard = document.getElementById('profileGridGuardianCard');
            if (guardianCard) guardianCard.classList.add('hidden');
        }

        // 3. Load bank details
        const bank = JSON.parse(localStorage.getItem('machub_bank_details_' + adminNo) || '{}');
        if (bank && bank.accNo) {
            const bankCard = document.getElementById('profileGridBankCard');
            if (bankCard) bankCard.classList.remove('hidden');

            const bankHolderEl = document.getElementById('profileBankHolder');
            const bankAccEl = document.getElementById('profileBankAcc');
            const bankNameEl = document.getElementById('profileBankName');
            const bankIfscEl = document.getElementById('profileBankIfsc');

            if (bankHolderEl) bankHolderEl.textContent = bank.holder || '---';
            if (bankAccEl) bankAccEl.textContent = bank.accNo || '---';
            if (bankNameEl) bankNameEl.textContent = bank.bankName || '---';
            if (bankIfscEl) bankIfscEl.textContent = bank.ifsc || '---';
        } else {
            const bankCard = document.getElementById('profileGridBankCard');
            if (bankCard) bankCard.classList.add('hidden');
        }

        // 4. Attendance Status logic (linked to academic rules)
        const course = (info.dept || '').toUpperCase();
        let attPercent = 81.5;
        let status = 'Good';
        let badgeColorClass = 'bg-emerald-500/10 text-emerald-500 dark:bg-emerald-500/20';

        if (course.includes('BCA')) {
            attPercent = 84.2;
            status = 'Excellent';
            badgeColorClass = 'bg-emerald-500/10 text-emerald-500 dark:bg-emerald-500/20';
        } else if (course.includes('BBA')) {
            attPercent = 77.8;
            status = 'Condonation Eligible';
            badgeColorClass = 'bg-amber-500/10 text-amber-500 dark:bg-amber-500/20';
        } else if (course.includes('BSW')) {
            attPercent = 68.5;
            status = 'Condonation Eligible';
            badgeColorClass = 'bg-amber-500/10 text-amber-500 dark:bg-amber-500/20';
        }

        let overallPresent = 0;
        let overallTotal = 0;
        let hasAttendance = false;
        let subjectsList = [];

        if (adminNo) {
            const currentSem = String(window.getStudentSemNumber ? window.getStudentSemNumber() : '2');
            const cachedAtt = getPortalCache('Attendance', adminNo, currentSem);
            if (cachedAtt) {
                try {
                    const parsed = JSON.parse(cachedAtt);
                    const rows = parsed?.data?.payload?.sections?.[0]?.rows || parsed?.data?.sections?.[0]?.rows || [];
                    rows.forEach(item => {
                        if (item.subjectName) {
                            const present = parseInt(item.presentHours) || 0;
                            const total = parseInt(item.totalHours) || 0;
                            overallPresent += present;
                            overallTotal += total;
                            hasAttendance = true;
                            subjectsList.push(item);
                        }
                    });
                } catch(e) {}
            }
        }

        if (hasAttendance && overallTotal > 0) {
            attPercent = Math.round((overallPresent / overallTotal) * 1000) / 10;
            if (attPercent >= 85) {
                status = 'Excellent';
                badgeColorClass = 'bg-emerald-500/10 text-emerald-500 dark:bg-emerald-500/20';
            } else if (attPercent >= 75) {
                status = 'Good';
                badgeColorClass = 'bg-emerald-500/10 text-emerald-500 dark:bg-emerald-500/20';
            } else if (attPercent >= 65) {
                status = 'Condonation Eligible';
                badgeColorClass = 'bg-amber-500/10 text-amber-500 dark:bg-amber-500/20';
            } else {
                status = 'Shortage';
                badgeColorClass = 'bg-red-500/10 text-red-500 dark:bg-red-500/20';
            }
        }

        // Calculate Bunks and required classes globally
        let totalBunks = 0;
        let totalRequired = 0;

        subjectsList.forEach(item => {
            const pct = sanitizePct(item.percentage);
            const present = parseInt(item.presentHours) || 0;
            const total = parseInt(item.totalHours) || 0;
            if (total > 0) {
                if (pct >= 75) {
                    const maxTotal = Math.floor(present / 0.75);
                    const safeBunks = Math.max(0, maxTotal - total);
                    totalBunks += safeBunks;
                } else {
                    const required = Math.ceil((0.75 * total - present) / 0.25);
                    totalRequired += required;
                }
            }
        });

        // Set Redesigned Layout Fields
        const bioName = document.getElementById('profileBioName');
        if (bioName) bioName.textContent = p.displayName || info.name || '---';

        const bioDept = document.getElementById('profileBioDept');
        if (bioDept) bioDept.textContent = info.dept || info.classGroup || '---';

        const bioCustom = document.getElementById('profileBioCustom');
        if (bioCustom) bioCustom.textContent = p.customBio || 'No bio written yet. Tap edit profile to customize.';

        const avatarImage = document.getElementById('profileAvatarImage');
        if (avatarImage) {
            const avatarSrc = info.avatarSrc || p.photoUrl || 'assets/img/ChatGPT%20Image%20May%2018,%202026,%2010_33_49%20PM.png';
            if (avatarSrc.startsWith('assets/') || avatarSrc.startsWith('data:') || avatarSrc.startsWith('http')) {
                avatarImage.src = avatarSrc;
                avatarImage.style.display = 'block';
                const ring = avatarImage.closest('.new-profile-avatar-ring-inner');
                if (ring) {
                    const emojiEl = ring.querySelector('.av-emoji-display');
                    if (emojiEl) emojiEl.remove();
                }
            } else {
                avatarImage.style.display = 'none';
                const ring = avatarImage.closest('.new-profile-avatar-ring-inner');
                if (ring) {
                    let emojiEl = ring.querySelector('.av-emoji-display');
                    if (!emojiEl) {
                        emojiEl = document.createElement('div');
                        emojiEl.className = 'av-emoji-display';
                        emojiEl.style.cssText = 'font-size:36px;line-height:1; font-weight:800;';
                        ring.appendChild(emojiEl);
                    }
                    emojiEl.textContent = avatarSrc;
                }
            }
        }

        // Stats row (with rankings lookup)
        if (adminNo) {
            fetchRankingsAndUpdateUI(adminNo, attPercent);
        }

        const statBunks = document.getElementById('profileStatBunks');
        if (statBunks) {
            statBunks.textContent = totalBunks > 0 ? `+${totalBunks}` : '0';
            statBunks.className = `text-base font-black tracking-tight ${totalBunks > 0 ? 'text-emerald-500' : 'text-[#1d1d1f] dark:text-[#f5f5f7]'}`;
        }

        const statClasses = document.getElementById('profileStatClasses');
        if (statClasses) {
            statClasses.textContent = totalRequired > 0 ? `${totalRequired}` : 'Safe';
            statClasses.className = `text-base font-black tracking-tight ${totalRequired > 0 ? 'text-red-500' : 'text-emerald-500'}`;
        }

        // Classic fields
        const attLabel = document.getElementById('profileAttendanceLabel');
        const attBadge = document.getElementById('profileAttendanceBadge');

        if (attLabel) attLabel.textContent = `${attPercent}% (${status} Status)`;
        if (attBadge) {
            attBadge.textContent = status;
            attBadge.className = `text-[10px] font-extrabold px-3 py-1.5 rounded-full uppercase tracking-wider ${badgeColorClass}`;
        }

        // 5. Render Subject-wise Attendance Breakdown on the Profile tab
        const breakdownCard = document.getElementById('profileAttendanceBreakdownCard');
        const breakdownList = document.getElementById('profileAttendanceBreakdownList');
        if (breakdownCard && breakdownList) {
            if (subjectsList.length > 0) {
                breakdownCard.classList.remove('hidden');
                breakdownList.innerHTML = subjectsList.map(item => {
                    const pct = sanitizePct(item.percentage);
                    const present = parseInt(item.presentHours) || 0;
                    const total = parseInt(item.totalHours) || 0;
                    
                    let progressColor = 'bg-emerald-500';
                    let textColorClass = 'text-emerald-500';
                    if (pct < 75) {
                        progressColor = 'bg-red-500';
                        textColorClass = 'text-red-500';
                    } else if (pct < 80) {
                        progressColor = 'bg-amber-500';
                        textColorClass = 'text-amber-500';
                    }
                    
                    let bunkBadge = '';
                    if (total > 0) {
                        if (pct >= 75) {
                            const maxTotal = Math.floor(present / 0.75);
                            const safeBunks = Math.max(0, maxTotal - total);
                            if (safeBunks > 0) {
                                bunkBadge = `<span class="bg-emerald-500/10 text-emerald-500 dark:bg-emerald-500/20 text-[9px] font-extrabold px-2 py-0.5 rounded-full uppercase tracking-wider">⚡ Bunk: ${safeBunks} Safe</span>`;
                            } else {
                                bunkBadge = `<span class="bg-amber-500/10 text-amber-500 dark:bg-amber-500/20 text-[9px] font-extrabold px-2 py-0.5 rounded-full uppercase tracking-wider">⚠️ Limit Reached</span>`;
                            }
                        } else {
                            const required = Math.ceil((0.75 * total - present) / 0.25);
                            if (required > 0) {
                                bunkBadge = `<span class="bg-red-500/10 text-red-500 dark:bg-red-500/20 text-[9px] font-extrabold px-2 py-0.5 rounded-full uppercase tracking-wider">🚨 Attend Next ${required}</span>`;
                            }
                        }
                    }

                    return `
                        <div class="py-2.5 border-b border-black/5 dark:border-white/5 last:border-b-0">
                            <div class="flex justify-between items-start gap-2 mb-1.5">
                                <div class="min-w-0 flex-1">
                                    <p class="text-xs font-bold text-[#1d1d1f] dark:text-[#f5f5f7] truncate">${escapeHtml(item.subjectName)}</p>
                                    <div class="flex items-center gap-2 mt-0.5 flex-wrap">
                                        <span class="text-[9px] font-bold text-[#86868b]">${present}/${total} Hours</span>
                                        ${bunkBadge}
                                    </div>
                                </div>
                                <span class="text-xs font-black ${textColorClass}">${Math.round(pct)}%</span>
                            </div>
                            <div class="w-full h-1 bg-black/5 dark:bg-white/10 rounded-full overflow-hidden">
                                <div class="${progressColor} h-full rounded-full transition-all duration-500" style="width: ${Math.min(100, pct)}%"></div>
                            </div>
                        </div>
                    `;
                }).join('');
            } else {
                breakdownCard.classList.add('hidden');
            }
        }

        // 6. Render 3D Ticket Markup inside container
        const cardContainer = document.getElementById('profile-card-container');
        if (cardContainer) {
            const colorSkin = settings.holoSkin || 'amethyst';
            
            const profInitials = (p.displayName || info.name || 'ME').split(/\s+/).slice(0, 2).map(w => w[0] || '').join('').toUpperCase();
            const profDeptShort = (info.dept || info.classGroup || info.department || '')
                .replace(/bachelor of/i, '')
                .replace(/b\.?\s*c\.?\s*a\.?/i, 'BCA')
                .replace(/b\.?\s*s\.?\s*c\.?/i, 'BSc')
                .replace(/b\.?\s*c\.?\s*o\.?\s*m\.?/i, 'BCom')
                .trim().substring(0, 8).toUpperCase() || 'DEPT';
            const profSemLabel = (info.semester || 'Sem 2').replace(/semester/i, 'Sem');
            const profYear = new Date().getFullYear();

            cardContainer.innerHTML = `
                <div id="profile-ticket-container" class="mb-4 relative z-10 mx-auto">
                    <section class="ob-ticket holo-skin-${colorSkin}" id="profile-ticketEl">

                        <!-- ── FRONT FACE ── -->
                        <section class="ob-ticket-front">
                            <div class="ob-ticket-holo"></div>
                            <img class="ob-ticket-logo-small" src="assets/img/file_00000000378c7207842a975d80367515.png" alt="MacHub">
                            <div class="data">
                                <h3 style="margin-top: 0;">Name</h3>
                                <p style="font-size: 20px; font-weight: 900; line-height: 1.1; margin-bottom: 2px; color: #fff; text-transform: uppercase; white-space: nowrap; overflow: hidden; text-overflow: ellipsis;">
                                    ${escapeHtml(p.displayName || info.name || '---')}
                                </p>
                                <p style="font-size: 12px; font-weight: 800; color: #ffd275; margin-bottom: 12px; margin-top: 0; font-family: monospace;">
                                    ${escapeHtml(info.adminNo || adminNo || '—')}
                                </p>
                                
                                <h3>Department</h3>
                                <p style="font-size: 15px; font-weight: 900; color: #fff; margin-bottom: 8px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis;">
                                    ${escapeHtml(profDeptShort)}
                                </p>
                                
                                <h3>Semester</h3>
                                <p style="font-size: 15px; font-weight: 900; color: #fff; margin-bottom: 0;">
                                    ${escapeHtml(profSemLabel)}
                                </p>
                            </div>
                            <aside class="divider">
                                <div class="username">
                                    <span>MacHub</span>
                                </div>
                                <span class="usernum">${profYear}</span>
                            </aside>
                        </section>

                        <!-- ── BACK FACE ── -->
                        <header class="ob-ticket-back">
                            <div class="ob-ticket-holo"></div>
                            <img class="logo" src="assets/img/file_00000000378c7207842a975d80367515.png" alt="MacHub">
                        </header>

                    </section>
                </div>
                ${localClaimed ? `
                <div class="px-4 mb-2">
                    <button onclick="window.ExamHubQr.show('${adminNo}')" class="w-full py-3.5 bg-white/5 border border-white/10 rounded-2xl font-bold text-xs spring active:scale-95 flex items-center justify-center gap-2">
                        🪪 View Secure Digital ID
                    </button>
                </div>
                ` : ''}
            `;
            
            // 7. Bind interactive 3D Mouse/Gyro Tilting mechanics
            if (window.bindCardTilt) {
                window.bindCardTilt('profile-ticket-container', 'profile-ticketEl');
            }
        }

        // 8. Sync Settings Panels Checkboxes
        const regToggle = document.getElementById('toggleShowReg') || document.getElementById('toggleShowReg-fp');
        const adminToggle = document.getElementById('toggleShowAdmin') || document.getElementById('toggleShowAdmin-fp');
        const perfToggle = document.getElementById('togglePerformance') || document.getElementById('togglePerformance-fp');

        if (regToggle) regToggle.checked = settings.showReg;
        if (adminToggle) adminToggle.checked = settings.showAdmin;
        if (perfToggle) perfToggle.checked = settings.highFidelity;

        // Sync Notification Checkboxes
        const nAtt = document.getElementById('toggleNotifyAttendance');
        const nMrk = document.getElementById('toggleNotifyMarks');
        const nFee = document.getElementById('toggleNotifyFees');
        if (nAtt) nAtt.checked = !!settings.notifyAttendance;
        if (nMrk) nMrk.checked = !!settings.notifyMarks;
        if (nFee) nFee.checked = !!settings.notifyFees;

        // Sync Display Checkboxes
        const dOled = document.getElementById('toggleDisplayOled');
        const dAnim = document.getElementById('toggleDisplayAnimations');
        if (dOled) dOled.checked = !!settings.oledMode;
        if (dAnim) dAnim.checked = !!settings.animations;

        // Sync Privacy Checkboxes
        ['goPrivate', 'hideGrades', 'anonymizeRank', 'localCache', 'autoWipe', 'analytics'].forEach(field => {
            const el = document.getElementById('privacy' + field.charAt(0).toUpperCase() + field.slice(1));
            if (el) el.checked = !!settings[field];
        });

        // 9. Highlight active skin button
        ['amethyst', 'cyberpunk', 'emerald', 'classic'].forEach(s => {
            const btn = document.getElementById('skin-btn-' + s);
            if (!btn) return;
            if (s === settings.holoSkin) {
                btn.classList.add('bg-[var(--mac-blue)]', 'text-white');
                btn.classList.remove('border-black/10', 'dark:border-white/10');
            } else {
                btn.classList.remove('bg-[var(--mac-blue)]', 'text-white');
                btn.classList.add('border-black/10', 'dark:border-white/10');
            }
        });

        // 10. Asynchronously pull custom overrides updates from Firestore
        syncProfileOverridesFromCloud(adminNo);
    }

    // Expose all controllers to global namespace
    window.ExamHubProfileApi = {
        getStudentInfo,
        saveStudentInfo,
        setProfileHoloSkin,
        toggleCardField,
        triggerResetProfile,
        renderUserProfile
    };

    // Keep global accessors directly on window for simple onclick attributes
    window.setProfileHoloSkin = setProfileHoloSkin;
    window.toggleCardField = toggleCardField;
    window.triggerResetProfile = triggerResetProfile;
    window.renderUserProfile = renderUserProfile;
    window.selectProfileTab = selectProfileTab;
    window.shareStudentProfile = shareStudentProfile;
    window.openSettingsTray = openSettingsTray;
    window.closeSettingsTray = closeSettingsTray;
    window.openRankingsSheet = openRankingsFullPage;
    window.closeRankingsSheet = closeRankingsFullPage;
    window.togglePrivacySetting = togglePrivacySetting;
    window.toggleNotificationSetting = toggleNotificationSetting;
    window.toggleDisplaySetting = toggleDisplaySetting;
    window.autoSaveProfile = autoSaveProfile;

    // Attach controllers to global scope once DOM is ready to override window defaults cleanly
    document.addEventListener('DOMContentLoaded', () => {
        // Redefine standard modal open/close functions to use our custom liquid sheets
        window.openEditProfile = openEditProfile;
        window.closeEditProfile = closeEditProfile;
        window.saveEditProfile = saveEditProfile;
        window.selectEditDept = selectEditDept;
        window.autoSaveProfile = autoSaveProfile;

        // Init upload picker
        initAvatarUpload();

        // Listen for anchor settings link
        window.addEventListener('hashchange', () => {
            if (location.hash === '#settings') {
                openSettingsTray();
            } else {
                closeSettingsTray();
            }
        });

        // Check hash on load
        if (location.hash === '#settings') {
            setTimeout(openSettingsTray, 500);
        }

        // Initialize default tab (new 4-tab system)
        selectNewProfileTab(0);
        // Keep old tab init for backward compat
        if (typeof selectProfileTab === 'function') {
            try { selectProfileTab(0); } catch(e) {}
        }

        // Populate settings profile summary
        renderSettingsProfileSummary();

        // Populate inline avatars
        filterSettingsAvatars('all', null);


    });

    /* ═══════════════════════════════════════════════════════════
       NEW ZIP DESIGN — 4-Tab Profile System
       ═══════════════════════════════════════════════════════════ */

    let currentNewTab = 0;
    window.selectNewProfileTab = function(index) {
        currentNewTab = index;
        [0,1,2,3].forEach(i => {
            const btn = document.getElementById('newTabBtn-' + i);
            const panel = document.getElementById('newTabPanel-' + i);
            if (btn) {
                if (i === index) btn.classList.add('active');
                else btn.classList.remove('active');
            }
            if (panel) {
                if (i === index) { panel.classList.remove('hidden'); panel.classList.add('animate-new-fade'); }
                else panel.classList.add('hidden');
            }
        });
        // Lazy render when switching to a tab
        if (index === 0) renderNewAttendanceTab();
        if (index === 1) renderNewMarksTab();
        if (index === 2) renderNewSubjectsTab();
    };

    /* ── Attendance Tab Renderer ── */
    function renderNewAttendanceTab() {
        const grid = document.getElementById('newAttendanceGrid');
        if (!grid) return;
        // Try to get attendance from cached portal data
        const info = getStudentInfo();
        const adminNo = info ? info.adminNo : null;

        // Try to pull from localStorage attendance data
        const currentSem = String(window.getStudentSemNumber ? window.getStudentSemNumber() : '2');
        const attRaw = adminNo ? getPortalCache('Attendance', adminNo, currentSem) : null;
        if (!attRaw) {
            grid.innerHTML = '<p style="color:#8d99ae;font-size:12px;text-align:center;grid-column:1/-1;padding:20px 0;">Open Attendance tab to load data first.</p>';
            return;
        }

        let attData = null;
        try { attData = JSON.parse(attRaw); } catch(e) {}
        if (!attData) {
            grid.innerHTML = '<p style="color:#8d99ae;font-size:12px;text-align:center;grid-column:1/-1;padding:20px 0;">No attendance data available.</p>';
            return;
        }

        const dataObj = attData.payload || attData.data?.payload || attData.data || attData;
        let subjects = dataObj?.subjects || dataObj?.data || [];
        if (!subjects.length && dataObj?.sections?.[0]?.rows) subjects = dataObj.sections[0].rows;

        if (!subjects.length) {
            grid.innerHTML = '<p style="color:#8d99ae;font-size:12px;text-align:center;grid-column:1/-1;padding:20px 0;">No subject data found.</p>';
            return;
        }

        // Calculate aggregate
        let totalPresent = 0, totalClasses = 0;
        subjects.forEach(s => {
            const p = parseInt(s.present || s.attended || 0);
            const t = parseInt(s.total || s.conducted || 0);
            if (!isNaN(p)) totalPresent += p;
            if (!isNaN(t)) totalClasses += t;
        });
        const aggPct = totalClasses > 0 ? Math.round(totalPresent / totalClasses * 100) : 0;
        const aggColor = aggPct >= 75 ? '#00F5D4' : aggPct >= 65 ? '#FFB703' : '#ef4444';
        const aggStatus = aggPct >= 75 ? '✅ Safe' : aggPct >= 65 ? '⚠️ Low' : '❌ Danger';

        // Update aggregate display
        const pctEl = document.getElementById('profileAttendancePct');
        const badgeEl = document.getElementById('profileAttendanceBadge');
        if (pctEl) { pctEl.textContent = aggPct + '%'; pctEl.style.color = aggColor; }
        if (badgeEl) {
            badgeEl.textContent = aggStatus;
            badgeEl.style.color = aggColor;
            badgeEl.style.background = aggColor + '18';
            badgeEl.style.borderColor = aggColor + '40';
        }

        // Render subject cards
        grid.innerHTML = subjects.slice(0, 12).map(s => {
            const name = s.subjectName || s.subject || s.name || 'Subject';
            const code = s.subjectCode || s.code || '';
            const present = parseInt(s.present || s.attended || 0);
            const total = parseInt(s.total || s.conducted || 0);
            const pct = total > 0 ? Math.round(present / total * 100) : 0;
            const color = pct >= 75 ? '#00F5D4' : pct >= 65 ? '#FFB703' : '#ef4444';
            return `
            <div class="sub-att-card">
                <span style="font-size:10px;color:#8d99ae;display:block;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">${escapeHtml(code || name)}</span>
                <span style="font-size:1.2rem;font-weight:800;color:${color};display:block;">${pct}%</span>
                <span style="font-size:9px;color:#8d99ae;">${present}/${total} classes</span>
            </div>`;
        }).join('');
    }

    /* ── Marks Tab Renderer ── */
    function renderNewMarksTab() {
        const grid = document.getElementById('newMarksGrid');
        if (!grid) return;
        const info = getStudentInfo();
        const adminNo = info ? info.adminNo : null;
        const currentSem = String(window.getStudentSemNumber ? window.getStudentSemNumber() : '2');
        const marksRaw = adminNo ? (getPortalCache('Assessment', adminNo, currentSem) || getPortalCache('InternalMark', adminNo, currentSem)) : null;
        if (!marksRaw) {
            grid.innerHTML = '<p style="color:#8d99ae;font-size:12px;text-align:center;padding:20px 0;">Open Marks tab first to load data.</p>';
            return;
        }
        let marksData = null;
        try { marksData = JSON.parse(marksRaw); } catch(e) {}
        if (!marksData) {
            grid.innerHTML = '<p style="color:#8d99ae;font-size:12px;text-align:center;padding:20px 0;">No marks data available.</p>';
            return;
        }

        const dataObj = marksData.payload || marksData.data?.payload || marksData.data || marksData;
        let subjects = dataObj?.subjects || dataObj?.data || [];
        if (!subjects.length && dataObj?.sections?.[0]?.rows) subjects = dataObj.sections[0].rows;

        if (!subjects.length) {
            grid.innerHTML = '<p style="color:#8d99ae;font-size:12px;text-align:center;padding:20px 0;">No marks data available.</p>';
            return;
        }

        const settings = readSettings();
        const blurStyle = settings.hideGrades ? 'filter: blur(5px); select-none;' : '';

        grid.innerHTML = subjects.map(s => {
            const name = s.subjectName || s.subject || s.name || 'Subject';
            const code = s.subjectCode || s.code || '';
            const internal = parseInt(s.internalMarks || s.internal || s.marks || 0);
            const maxInternal = parseInt(s.maxInternal || s.maxMarks || 50);
            const color = internal >= maxInternal * 0.8 ? '#00F5D4' : internal >= maxInternal * 0.6 ? '#FFB703' : '#ef4444';
            return `
            <div class="marks-row">
                <div style="flex:1;min-width:0;">
                    <div style="font-size:12px;font-weight:600;color:#f5f5f7;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">${escapeHtml(name)}</div>
                    <div style="font-size:10px;color:#8d99ae;">${escapeHtml(code)}</div>
                </div>
                <div style="text-align:right;margin-left:12px;${blurStyle}">
                    <span style="font-size:14px;font-weight:800;color:${color};">${internal}</span>
                    <span style="font-size:10px;color:#8d99ae;">/${maxInternal}</span>
                </div>
            </div>`;
        }).join('');
    }

    /* ── Subjects Tab Renderer ── */
    function renderNewSubjectsTab() {
        const grid = document.getElementById('newSubjectsGrid');
        if (!grid) return;
        const info = getStudentInfo();
        const adminNo = info ? info.adminNo : null;
        const currentSem = String(window.getStudentSemNumber ? window.getStudentSemNumber() : '2');
        const attRaw = adminNo ? getPortalCache('Attendance', adminNo, currentSem) : null;

        let subjects = [];
        if (attRaw) {
            try {
                const d = JSON.parse(attRaw);
                const dataObj = d.payload || d.data?.payload || d.data || d;
                subjects = dataObj?.subjects || dataObj?.data || [];
                if (!subjects.length && dataObj?.sections?.[0]?.rows) subjects = dataObj.sections[0].rows;
            } catch(e) {}
        }

        if (!subjects.length) {
            grid.innerHTML = '<p style="color:#8d99ae;font-size:12px;text-align:center;padding:20px 0;">No subjects data available.</p>';
            return;
        }

        grid.innerHTML = subjects.map(s => {
            const name = s.subjectName || s.subject || s.name || 'Subject';
            const code = s.subjectCode || s.code || '';
            const type = s.type || (code.includes('P') ? 'Lab' : 'Core');
            const typeColor = type === 'Core' ? 'rgba(0,245,212,0.12)' : type === 'Lab' ? 'rgba(255,183,3,0.12)' : 'rgba(173,232,244,0.12)';
            const typeTextColor = type === 'Core' ? '#00F5D4' : type === 'Lab' ? '#FFB703' : '#ADE8F4';
            return `
            <div class="marks-row">
                <div style="flex:1;min-width:0;">
                    <div style="font-size:12px;font-weight:600;color:#f5f5f7;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">${escapeHtml(name)}</div>
                    <div style="font-size:10px;color:#8d99ae;">${escapeHtml(code)}</div>
                </div>
                <span style="padding:3px 9px;border-radius:6px;font-size:9px;font-weight:700;flex-shrink:0;background:${typeColor};color:${typeTextColor};">${type}</span>
            </div>`;
        }).join('');
    }

    /* ═══════════════════════════════════════════════════════════
       AVATAR PICKER
       ═══════════════════════════════════════════════════════════ */

    const AVATARS = [
        { id:'av_f1', src:'assets/img/avatars/av_f1.png', label:'Priya', cat:'female', accent:'#ee2a7b' },
        { id:'av_f2', src:'assets/img/avatars/av_f2.png', label:'Meera', cat:'female', accent:'#f9ce34' },
        { id:'av_f3', src:'assets/img/avatars/av_f3.png', label:'Anjali', cat:'female', accent:'#8a2be2' },
        { id:'av_f4', src:'assets/img/avatars/av_f4.png', label:'Nisha', cat:'female', accent:'#00F5D4' },
        { id:'av_f5', src:'assets/img/avatars/av_f5.png', label:'Kavya', cat:'female', accent:'#FFB703' },
        { id:'av_m1', src:'assets/img/avatars/av_m1.png', label:'Arjun', cat:'male', accent:'#0a84ff' },
        { id:'av_m2', src:'assets/img/avatars/av_m2.png', label:'Dev', cat:'male', accent:'#00F5D4' },
        { id:'av_m3', src:'assets/img/avatars/av_m3.png', label:'Rahul', cat:'male', accent:'#ee2a7b' },
        { id:'av_m4', src:'assets/img/avatars/av_m4.png', label:'Kiran', cat:'male', accent:'#FFB703' },
        { id:'av_tech1', emoji:'💻', label:'Coder', cat:'tech', accent:'#00F5D4' },
        { id:'av_tech2', emoji:'🤖', label:'Bot', cat:'tech', accent:'#0a84ff' },
        { id:'av_tech3', emoji:'👾', label:'Gamer', cat:'tech', accent:'#8a2be2' },
        { id:'av_kerala1', emoji:'🌴', label:'Mallu', cat:'kerala', accent:'#4CAF50' },
        { id:'av_kerala2', emoji:'🥥', label:'Coconut', cat:'kerala', accent:'#FFB703' },
        { id:'av_kerala3', emoji:'🐘', label:'Elephant', cat:'kerala', accent:'#8a2be2' },
        { id:'av_football1', emoji:'⚽', label:'Messi', cat:'football', accent:'#0a84ff' },
        { id:'av_football2', emoji:'🏆', label:'Ronaldo', cat:'football', accent:'#ee2a7b' },
        { id:'av_football3', emoji:'🥅', label:'Keeper', cat:'football', accent:'#00F5D4' },
    ];

    let currentAvatarFilter = 'all';
    let selectedAvatarId = localStorage.getItem('mac_avatar_id') || null;

    // Opens two-option action sheet: Upload Photo OR Choose Avatar
    window.openAvatarPicker = function() {
        openPhotoSourceMenu();
    };

    function openPhotoSourceMenu() {
        const modal = document.getElementById('photoSourceModal');
        if (modal) {
            modal.classList.add('open');
            document.body.style.overflow = 'hidden';
        }
    }
    window.openPhotoSourceMenu = openPhotoSourceMenu;

    window.closePhotoSourceMenu = function() {
        const modal = document.getElementById('photoSourceModal');
        if (modal) modal.classList.remove('open');
        document.body.style.overflow = '';
    };

    window.handlePhotoMenuUpload = function() {
        window.closePhotoSourceMenu();
        document.getElementById('avatarFileInput')?.click();
    };

    window.handlePhotoMenuAvatar = function() {
        window.closePhotoSourceMenu();
        // Open avatar picker modal
        const modal = document.getElementById('avatarPickerModal');
        if (!modal) return;
        modal.classList.add('open');
        filterAvatars('all', document.querySelector('#avCats .av-cat-btn'));
        document.body.style.overflow = 'hidden';
    };

    window.closeAvatarPicker = function() {
        const modal = document.getElementById('avatarPickerModal');
        if (!modal) return;
        modal.classList.remove('open');
        document.body.style.overflow = '';
    };

    window.filterAvatars = function(cat, btn) {
        currentAvatarFilter = cat;
        // Update cat button active state
        document.querySelectorAll('.av-cat-btn').forEach(b => b.classList.remove('active'));
        if (btn) btn.classList.add('active');

        if (cat === 'upload') {
            closeAvatarPicker();
            document.getElementById('avatarFileInput')?.click();
            return;
        }

        const filtered = cat === 'all' ? AVATARS : AVATARS.filter(a => a.cat === cat);
        const grid = document.getElementById('avGrid');
        if (!grid) return;

        grid.innerHTML = filtered.map(av => {
            const isSelected = selectedAvatarId === av.id;
            const inner = av.src
                ? `<img src="${av.src}" alt="${av.label}" loading="lazy">`
                : `<span class="av-emoji">${av.emoji}</span>`;
            return `
            <button class="av-item" onclick="selectAvatar('${av.id}', '${av.src || av.emoji}', '${av.accent}', '${av.label}')">
                <div class="av-ring" style="background:${isSelected ? `linear-gradient(135deg,${av.accent},#6228d7)` : 'rgba(255,255,255,0.1)'};">
                    <div class="av-inner">${inner}</div>
                </div>
                <span class="av-label">${av.label}</span>
            </button>`;
        }).join('');
    };

    window.selectAvatar = function(id, src, accent, label) {
        selectedAvatarId = id;
        localStorage.setItem('mac_avatar_id', id);

        const imgEl = document.getElementById('profileAvatarImage');
        if (imgEl) {
            // Check if it's an emoji or image
            if (src.startsWith('assets/') || src.startsWith('http') || src.startsWith('data:')) {
                imgEl.src = src;
                imgEl.style.display = 'block';
            } else {
                // Emoji avatar — show as text
                imgEl.style.display = 'none';
                const ring = imgEl.closest('.new-profile-avatar-ring-inner');
                if (ring) {
                    let emojiEl = ring.querySelector('.av-emoji-display');
                    if (!emojiEl) {
                        emojiEl = document.createElement('div');
                        emojiEl.className = 'av-emoji-display';
                        emojiEl.style.cssText = 'font-size:36px;line-height:1; font-weight:800;';
                        ring.appendChild(emojiEl);
                    }
                    emojiEl.textContent = src;
                }
            }
        }

        // Update gradient ring color
        const ring = document.querySelector('.new-profile-avatar-ring');
        if (ring) ring.style.background = `linear-gradient(135deg,${accent},#6228d7)`;

        // Save to profile and Firestore Cloud
        const info = getStudentInfo();
        if (info) {
            info.avatarSrc = src;
            info.avatarAccent = accent;
            saveStudentInfo(info);
        }

        const adminNo = (info && info.adminNo) || localStorage.getItem('machub_student_id') || '';
        if (adminNo && src) {
            localStorage.setItem('machub_avatar_url_' + adminNo, src);
            if (window.firebaseFirestore && window.firestoreDoc && window.firestoreSetDoc) {
                const docRef = window.firestoreDoc(window.firebaseFirestore, 'students', adminNo);
                window.firestoreSetDoc(docRef, { photoUrl: src, avatarUrl: src, updatedAt: new Date().toISOString() }, { merge: true });
            }
            const items = getCanvasItems();
            const photoEl = items.find(it => it.type === 'photo');
            if (photoEl) {
                photoEl.url = src;
                saveCanvasItems(items);
            } else {
                window.renderCanvasPortfolio();
            }
        }

        closeAvatarPicker();
        // Sync bottom nav and settings profile summary
        if (window.syncBottomNavAvatar) window.syncBottomNavAvatar();
        if (typeof renderSettingsProfileSummary === 'function') renderSettingsProfileSummary();
        if (typeof filterSettingsAvatars === 'function') filterSettingsAvatars(currentAvatarFilter, null);
        showToast(`Avatar set to ${label}! 🎭`, 'success');
    };

    /* ═══════════════════════════════════════════════════════════
       SETTINGS NAVIGATION (sub-views)
       ═══════════════════════════════════════════════════════════ */

    const settingsNavStack = ['root'];

    window.settingsGoTo = function(view) {
        settingsNavStack.push(view);
        document.querySelectorAll('.settings-subview').forEach(el => el.classList.remove('active'));
        const target = document.getElementById('settingsView-' + view);
        if (target) target.classList.add('active');

        const titles = { 
            root: 'Settings', 
            card: 'ID Card', 
            notifications: 'Notifications', 
            display: 'Display & Theme', 
            about: 'About MacHub',
            'synced-data': 'Synced Data',
            'change-password': 'Change Password',
            'active-devices': 'Active Devices',
            'account-security': 'Security Overview',
            'allotment-memo': 'Allotment Memo',
            'hall-ticket': 'Hall Ticket Matrix',
            'fee-payment': 'Fee Payment Portals',
            'grievance': 'Grievance Form',
            'concession': 'Student Concession Pass',
            'privacy': 'Privacy Settings'
        };
        const titleEl = document.getElementById('settingsTrayTitle');
        if (titleEl) titleEl.textContent = titles[view] || view;

        const backBtn = document.getElementById('settingsBackBtn');
        if (backBtn) backBtn.classList.remove('hidden');
    };

    window.settingsGoBack = function() {
        if (settingsNavStack.length <= 1) return;
        settingsNavStack.pop();
        const prev = settingsNavStack[settingsNavStack.length - 1];
        document.querySelectorAll('.settings-subview').forEach(el => el.classList.remove('active'));
        const target = document.getElementById('settingsView-' + prev);
        if (target) target.classList.add('active');

        const titles = { 
            root: 'Settings', 
            card: 'ID Card', 
            notifications: 'Notifications', 
            display: 'Display & Theme', 
            about: 'About MacHub',
            'synced-data': 'Synced Data',
            'change-password': 'Change Password',
            'active-devices': 'Active Devices',
            'account-security': 'Security Overview',
            'allotment-memo': 'Allotment Memo',
            'hall-ticket': 'Hall Ticket Matrix',
            'fee-payment': 'Fee Payment Portals',
            'grievance': 'Grievance Form',
            'concession': 'Student Concession Pass',
            'privacy': 'Privacy Settings'
        };
        const titleEl = document.getElementById('settingsTrayTitle');
        if (titleEl) titleEl.textContent = titles[prev] || prev;

        const backBtn = document.getElementById('settingsBackBtn');
        if (backBtn && prev === 'root') backBtn.classList.add('hidden');
    };

    // Reset stack when tray opens
    const _origOpenSettings = window.openSettingsTray;
    window.openSettingsTray = function() {
        settingsNavStack.length = 0;
        settingsNavStack.push('root');
        document.querySelectorAll('.settings-subview').forEach(el => el.classList.remove('active'));
        const root = document.getElementById('settingsView-root');
        if (root) root.classList.add('active');
        const titleEl = document.getElementById('settingsTrayTitle');
        if (titleEl) titleEl.textContent = 'Settings';
        const backBtn = document.getElementById('settingsBackBtn');
        if (backBtn) backBtn.classList.add('hidden');
        if (_origOpenSettings) _origOpenSettings();
    };

    /* ═══════════════════════════════════════════════════════════
       INLINE SETTINGS AVATAR PICKER
       ═══════════════════════════════════════════════════════════ */
    window.filterSettingsAvatars = function(cat, btn) {
        currentAvatarFilter = cat;
        const catsContainer = document.getElementById('settingsAvCats');
        if (catsContainer) {
            catsContainer.querySelectorAll('.av-cat-btn').forEach(b => b.classList.remove('active'));
        }
        if (btn) btn.classList.add('active');

        if (cat === 'upload') {
            document.getElementById('avatarFileInput')?.click();
            return;
        }

        const filtered = cat === 'all' ? AVATARS : AVATARS.filter(a => a.cat === cat);
        const grid = document.getElementById('settingsAvGrid');
        if (!grid) return;

        grid.innerHTML = filtered.map(av => {
            const isSelected = selectedAvatarId === av.id;
            const inner = av.src
                ? `<img src="${av.src}" alt="${av.label}" class="w-full h-full object-cover rounded-full" loading="lazy">`
                : `<span class="text-xl">${av.emoji}</span>`;
            return `
            <button class="flex flex-col items-center justify-center p-1.5 rounded-2xl bg-white/5 border border-white/5 spring active:scale-95" onclick="selectSettingsAvatar('${av.id}', '${av.src || av.emoji}', '${av.accent}', '${av.label}')" style="border-color:${isSelected ? av.accent : 'rgba(255,255,255,0.05)'}; background:${isSelected ? 'rgba(255,255,255,0.1)' : 'rgba(255,255,255,0.02)'}">
                <div class="w-10 h-10 rounded-full flex items-center justify-center overflow-hidden bg-white/5" style="border: 2px solid ${isSelected ? av.accent : 'transparent'}">
                    ${inner}
                </div>
                <span class="text-[8px] font-bold text-[#86868b] mt-1 truncate w-full text-center">${av.label}</span>
            </button>`;
        }).join('');
    };

    window.selectSettingsAvatar = function(id, src, accent, label) {
        selectedAvatarId = id;
        localStorage.setItem('mac_avatar_id', id);

        const info = getStudentInfo();
        if (info) {
            info.avatarSrc = src;
            info.avatarAccent = accent;
            saveStudentInfo(info);
        }

        // Apply to main profile page
        const imgEl = document.getElementById('profileAvatarImage');
        if (imgEl) {
            if (src.startsWith('assets/') || src.startsWith('http') || src.startsWith('data:')) {
                imgEl.src = src;
                imgEl.style.display = 'block';
                const ring = imgEl.closest('.new-profile-avatar-ring-inner');
                if (ring) {
                    const emojiEl = ring.querySelector('.av-emoji-display');
                    if (emojiEl) emojiEl.remove();
                }
            } else {
                imgEl.style.display = 'none';
                const ring = imgEl.closest('.new-profile-avatar-ring-inner');
                if (ring) {
                    let emojiEl = ring.querySelector('.av-emoji-display');
                    if (!emojiEl) {
                        emojiEl = document.createElement('div');
                        emojiEl.className = 'av-emoji-display';
                        emojiEl.style.cssText = 'font-size:36px;line-height:1; font-weight:800;';
                        ring.appendChild(emojiEl);
                    }
                    emojiEl.textContent = src;
                }
            }
        }

        const ring = document.querySelector('.new-profile-avatar-ring');
        if (ring) ring.style.background = `linear-gradient(135deg,${accent},#6228d7)`;

        renderSettingsProfileSummary();
        filterSettingsAvatars(currentAvatarFilter, null);

        showToast(`Avatar set to ${label}! 🎭`, 'success');
    };



    // Expose showToast globally
    window.showToast = showToast;

    // Helper for HTML escaping
    function escapeHtml(str) {
        if (!str) return '';
        return String(str)
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;')
            .replace(/'/g, '&#039;');
    }

    // 1. Synced Data Sizes Calculator
    window.updateSyncedDataSizes = function() {
        const adminNo = localStorage.getItem('machub_student_id') || '';
        if (!adminNo) return;

        let sizes = {
            attendance: 0,
            marks: 0,
            profile: 0,
            timetable: 0
        };

        for (let i = 0; i < localStorage.length; i++) {
            const key = localStorage.key(i);
            if (!key || !key.includes(adminNo)) continue;
            const val = localStorage.getItem(key) || '';
            const sizeKB = val.length / 1024;

            if (key.includes('Attendance')) {
                sizes.attendance += sizeKB;
            } else if (key.includes('InternalMark') || key.includes('Assessment') || key.includes('ExamResult')) {
                sizes.marks += sizeKB;
            } else if (key.includes('Profile') || key.includes('Dashboard') || key.includes('AllotmentMemo') || key.includes('HallTicket') || key.includes('FeePay')) {
                sizes.profile += sizeKB;
            } else if (key.includes('Timetable') || key.includes('ClassTimetable')) {
                sizes.timetable += sizeKB;
            }
        }

        const setSize = (id, kb) => {
            const el = document.getElementById(id);
            if (el) el.textContent = kb > 0 ? `${kb.toFixed(1)} KB` : '0.0 KB';
        };

        setSize('syncSize-attendance', sizes.attendance);
        setSize('syncSize-marks', sizes.marks);
        setSize('syncSize-profile', sizes.profile);
        setSize('syncSize-timetable', sizes.timetable);
    };

    // 2. Trigger Full Scraper Resync
    window.triggerResyncData = async function() {
        const btn = document.querySelector('#view-settings-synced-data button');
        const origText = btn ? btn.innerHTML : '🔄 Force Resync Portal Data';
        if (btn) {
            btn.innerHTML = '🔄 Syncing...';
            btn.style.opacity = '0.5';
            btn.style.pointerEvents = 'none';
        }
        
        try {
            const adminNo = localStorage.getItem('machub_student_id');
            if (!adminNo) {
                showToast('Please login / configure your admission number first.', 'error');
                return;
            }
            
            let semNum = 2;
            const info = getStudentInfo();
            if (info && info.semester) {
                const match = info.semester.match(/\d+/);
                if (match) semNum = parseInt(match[0], 10);
            }
            
            showToast('Syncing Attendance, Marks, Profile & Dashboard... 📡', 'info');
            
            await Promise.all([
                window.MacHubPortal.fetchSection('Profile', true),
                window.MacHubPortal.fetchSection('Dashboard', true),
                window.MacHubPortal.fetchSection('Attendance', true, String(semNum)),
                window.MacHubPortal.fetchSection('Assessment', true, String(semNum)),
                window.MacHubPortal.fetchSection('InternalMark', true, String(semNum))
            ]);
            
            // Refresh views
            if (window.syncHomePortalDashboard) window.syncHomePortalDashboard();
            if (window.renderUserProfile) window.renderUserProfile();
            if (window.renderClassAttendance) window.renderClassAttendance();
            if (window.renderExamResults) window.renderExamResults();
            if (window.updateSyncedDataSizes) window.updateSyncedDataSizes();
            
            showToast('Portal data successfully synced and updated! 🚀', 'success');
        } catch (err) {
            console.error('[Sync] Force resync failed:', err);
            showToast(`Sync failed: ${err.message || err}`, 'error');
        } finally {
            if (btn) {
                btn.innerHTML = origText;
                btn.style.opacity = '';
                btn.style.pointerEvents = '';
            }
        }
    };

    // 3. Load Grievance dropdown options and tokens
    window.loadGrievancePortalData = async function(force = false) {
        const selectEl = document.getElementById('grievance_to');
        if (selectEl) {
            selectEl.innerHTML = '<option value="">Fetching officers...</option>';
        }
        
        try {
            let data = null;
            try {
                data = await window.MacHubPortal.fetchSection('Grievance', force);
            } catch (e) {
                console.log('[Grievance] Cache fetch failed:', e.message);
            }
            if (!data && !force) {
                data = await window.MacHubPortal.fetchSection('Grievance', true);
            }
            
            const payload = data.payload || data;
            const secData = payload.sections?.[0]?.data || {};
            const options = secData.options || [];
            const tokens = secData.tokens || {};
            
            window._grievanceTokens = tokens;
            
            if (selectEl) {
                if (options.length === 0) {
                    selectEl.innerHTML = '<option value="">No grievance officers found</option>';
                } else {
                    selectEl.innerHTML = options.map(opt => 
                        `<option value="${escapeHtml(opt.value)}">${escapeHtml(opt.text)}</option>`
                    ).join('');
                }
            }
        } catch (err) {
            console.error('[Grievance] Loader failed:', err);
            if (selectEl) {
                selectEl.innerHTML = '<option value="">Failed to load. Click to retry.</option>';
            }
            showToast(`Grievance config failed to load: ${err.message || err}`, 'error');
        }
    };

    // 4. Load Concession Card status and routes
    window.loadConcessionPortalData = async function(force = false) {
        const container = document.getElementById('concessionPortalDataContainer');
        if (container) {
            container.innerHTML = `
                <div class="liquid-glass rounded-3xl p-5 space-y-4 text-center">
                    <div class="animate-spin text-2xl mb-2">⏳</div>
                    <p class="text-[10px] text-[#86868b] font-bold uppercase tracking-wider">Syncing routes from ePortal...</p>
                </div>
            `;
        }
        
        try {
            let data = null;
            try {
                data = await window.MacHubPortal.fetchSection('Concession', force);
            } catch (e) {
                console.log('[Concession] Cache load failed:', e.message);
            }
            if (!data && !force) {
                data = await window.MacHubPortal.fetchSection('Concession', true);
            }
            
            const payload = data.payload || data;
            const secData = payload.sections?.[0]?.data || {};
            const routes = secData.routes || [];
            window._concessionTokens = secData.tokens || {};
            
            if (container) {
                const routeRows = [];
                for (let i = 0; i < 4; i++) {
                    const r = routes[i] || { from: '', to: '' };
                    routeRows.push(`
                        <div class="grid grid-cols-2 gap-3">
                            <div>
                                <label class="text-[9px] font-bold text-[#86868b] uppercase">Route ${i+1} From</label>
                                <input type="text" id="route_from${i+1}" value="${escapeHtml(r.from)}" class="w-full mt-1 p-3 bg-white/5 border border-white/5 rounded-xl text-xs font-bold text-white focus:border-[var(--mac-blue)] outline-none" placeholder="Origin Station" />
                            </div>
                            <div>
                                <label class="text-[9px] font-bold text-[#86868b] uppercase">Route ${i+1} To</label>
                                <input type="text" id="route_to${i+1}" value="${escapeHtml(r.to)}" class="w-full mt-1 p-3 bg-white/5 border border-white/5 rounded-xl text-xs font-bold text-white focus:border-[var(--mac-blue)] outline-none" placeholder="Destination Station" />
                            </div>
                        </div>
                    `);
                }
                
                let routesDisplay = routes.map((r, idx) => {
                    if (!r.from && !r.to) return '';
                    return `
                        <div class="flex items-center gap-3">
                            <span class="text-xs font-black bg-white/10 px-2 py-1 rounded-md text-slate-300">R${idx+1}</span>
                            <span class="text-sm font-black truncate max-w-[120px]">${escapeHtml(r.from)}</span>
                            <span class="text-slate-400">➔</span>
                            <span class="text-sm font-black truncate max-w-[120px]">${escapeHtml(r.to)}</span>
                        </div>
                    `;
                }).filter(Boolean).join('');
                
                if (!routesDisplay) {
                    routesDisplay = `<p class="text-xs text-white/40 italic">No routes specified. Fill routes below to sync.</p>`;
                }
                
                container.innerHTML = `
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
                            ${routesDisplay}
                        </div>

                        <!-- Bottom Footer Details -->
                        <div class="flex justify-between items-end pt-2 border-t border-white/10">
                            <div>
                                <span class="text-[8px] text-white/50 block">STUDENT ID</span>
                                <span class="text-xs font-bold font-mono">${escapeHtml(localStorage.getItem('machub_student_id') || '---')}</span>
                            </div>
                            <div>
                                <span class="text-[8px] text-white/50 block">EXPIRES</span>
                                <span class="text-xs font-bold font-mono">31-MAR-2027</span>
                            </div>
                        </div>
                    </div>

                    <!-- Concession Card Routes Editor -->
                    <div class="liquid-glass p-5 rounded-[2rem] border border-white/5 space-y-4">
                        <h4 class="text-xs font-black text-[var(--mac-blue)] uppercase tracking-widest mb-1">🗺️ Edit Travel Paths</h4>
                        
                        <div class="space-y-3">
                            ${routeRows.join('')}
                        </div>

                        <button onclick="window.submitConcessionRoutes()" class="w-full py-4 bg-[var(--mac-blue)] text-white rounded-2xl font-bold spring active:scale-95 text-xs flex items-center justify-center gap-2 mt-4">
                            <span>💾 Sync Travel Routes to Portal</span>
                        </button>
                    </div>
                `;
            }
        } catch (err) {
            console.error('[Concession] Loader failed:', err);
            if (container) {
                container.innerHTML = `
                    <div class="liquid-glass rounded-3xl p-5 space-y-2 text-center">
                        <p class="text-xs font-bold text-red-500">Failed to load Concession data.</p>
                        <p class="text-[10px] text-[#86868b]">${escapeHtml(err.message || err)}</p>
                        <button onclick="window.loadConcessionPortalData(true)" class="mt-2 px-4 py-2 bg-white/10 rounded-xl text-xs font-bold text-white spring active:scale-95">Retry</button>
                    </div>
                `;
            }
            showToast(`Concession data failed to load: ${err.message || err}`, 'error');
        }
    };

    // 5. Load Allotment Memo
    window.loadAllotmentMemoData = async function(force = false) {
        const info = getStudentInfo() || {};
        const adminNo = localStorage.getItem('machub_student_id') || '';
        
        const setField = (id, val) => {
            const el = document.getElementById(id);
            if (el) el.textContent = val || '---';
        };
        setField('allotment-student', info.name);
        setField('allotment-admin', info.adminNo || adminNo);
        setField('allotment-course', info.dept);

        const container = document.getElementById('allotmentPortalDataContainer');
        if (container) {
            container.innerHTML = '<p class="text-center text-[10px] text-[#86868b] font-bold uppercase tracking-wider py-4 animate-pulse">Checking ePortal for admission documents...</p>';
        }

        try {
            const data = await window.MacHubPortal.fetchSection('AllotmentMemo', force);
            if (container && data) {
                const rendered = window.MacHubPortal.renderGeneric(data.payload || data);
                container.innerHTML = `<h4 class="text-xs font-black text-[var(--mac-blue)] uppercase tracking-widest mt-4">📄 Official Portal Allotment Record</h4>` + rendered;
            }
        } catch (err) {
            console.log('[AllotmentMemo] Fetch failed:', err.message);
            if (container) container.innerHTML = '';
        }
    };

    // 6. Load Hall Ticket Matrix
    window.loadHallTicketData = async function(force = false) {
        const container = document.getElementById('hallTicketPortalDataContainer');
        if (container) {
            container.innerHTML = '<p class="text-center text-[10px] text-[#86868b] font-bold uppercase tracking-wider py-4 animate-pulse">Syncing Hall Ticket details from ePortal...</p>';
        }

        try {
            const data = await window.MacHubPortal.fetchSection('HallTicket', force);
            if (container && data) {
                const rendered = window.MacHubPortal.renderGeneric(data.payload || data);
                container.innerHTML = `<h4 class="text-xs font-black text-[var(--mac-blue)] uppercase tracking-widest mt-4">🎟️ Official Portal Seating Record</h4>` + rendered;
            }
        } catch (err) {
            console.log('[HallTicket] Fetch failed:', err.message);
            if (container) container.innerHTML = '';
        }
    };

    // 7. Load Fee Payment details
    window.loadFeePaymentData = async function(force = false) {
        const container = document.getElementById('feePaymentPortalDataContainer');
        if (container) {
            container.innerHTML = '<p class="text-center text-[10px] text-[#86868b] font-bold uppercase tracking-wider py-4 animate-pulse">Syncing fee accounts from ePortal...</p>';
        }

        try {
            const data = await window.MacHubPortal.fetchSection('FeePay', force);
            if (container && data) {
                const rendered = window.MacHubPortal.renderGeneric(data.payload || data);
                container.innerHTML = `<h4 class="text-xs font-black text-[var(--mac-blue)] uppercase tracking-widest mt-4">💳 Official Portal Fee Ledger</h4>` + rendered;
            }
        } catch (err) {
            console.log('[FeePay] Fetch failed:', err.message);
            if (container) container.innerHTML = '';
        }
    };

    // 8. Load Feedback
    window.loadFeedbackData = async function(force = false) {
        const container = document.getElementById('feedbackPortalDataContainer');
        if (container) {
            container.innerHTML = `
                <div class="liquid-glass rounded-3xl p-5 space-y-4 text-center">
                    <div class="animate-spin text-2xl mb-2">⏳</div>
                    <p class="text-[10px] text-[#86868b] font-bold uppercase tracking-wider">Syncing Feedback details from ePortal...</p>
                </div>
            `;
        }

        try {
            const data = await window.MacHubPortal.fetchSection('FeedBack', force);
            if (container && data) {
                const rendered = window.MacHubPortal.renderGeneric(data.payload || data);
                container.innerHTML = `<h4 class="text-xs font-black text-[var(--mac-blue)] uppercase tracking-widest mt-4">💬 Official Portal Feed Back</h4>` + rendered;
            }
        } catch (err) {
            console.log('[FeedBack] Fetch failed:', err.message);
            if (container) {
                container.innerHTML = `
                    <div class="liquid-glass rounded-3xl p-5 space-y-2 text-center">
                        <p class="text-xs font-bold text-red-500">Failed to load Feedback data.</p>
                        <p class="text-[10px] text-[#86868b]">${escapeHtml(err.message || err)}</p>
                        <button onclick="window.loadFeedbackData(true)" class="mt-2 px-4 py-2 bg-white/10 rounded-xl text-xs font-bold text-white spring active:scale-95">Retry</button>
                    </div>
                `;
            }
            showToast(`Feedback data failed to load: ${err.message || err}`, 'error');
        }
    };

    // Terminate Session mockup actions
    window.triggerTerminateSession = function(device) {
        showToast(`Revoked session for ${device}.`, 'success');
    };

    window.triggerTerminateAllSessions = function() {
        showToast('Terminated all other active sessions! 📱', 'success');
    };

    window.triggerPayFee = function(type) {
        showToast(`Redirecting to payment gateway for Sem 2 ${type} fee... 💳`, 'success');
    };

    // Restore saved avatar on load
    (function restoreSavedAvatar() {
        const info = getStudentInfo();
        if (!info) return;
        const src = info.avatarSrc;
        const accent = info.avatarAccent;
        if (!src) return;
        const imgEl = document.getElementById('profileAvatarImage');
        if (imgEl && (src.startsWith('assets/') || src.startsWith('data:') || src.startsWith('http'))) {
            imgEl.src = src;
        }
        if (accent) {
            const ring = document.querySelector('.new-profile-avatar-ring');
            if (ring) ring.style.background = `linear-gradient(135deg,${accent},#6228d7)`;
        }
    })();

    // Profile Claim Handler
    window.triggerProfileClaim = function () {
        const info = getStudentInfo();
        if (info && info.adminNo) {
            if (window.ExamHubClaim) {
                window.ExamHubClaim.init(info.adminNo);
            }
        } else {
            alert('Please select or search your profile first.');
        }
    };

    // ═══════════════════════════════════════════════════════════
    // FREE CANVAS PROFILE ENGINE (CanvasProfile.jsx v2 Reference Build)
    // ═══════════════════════════════════════════════════════════
    const FONT_IMPORT_URL = "https://fonts.googleapis.com/css2?family=Archivo+Expanded:wght@700;800&family=Archivo:wght@400;500;600&family=JetBrains+Mono:wght@400;500&display=swap";
    const ACCENT_PALETTE = ["#3D4A5C", "#8C4A3D", "#3D5C46", "#5C3D57", "#4A4A4A"];
    let currentAccentIndex = 0;
    let currentFontKey = 'grotesk';

    const FONT_PAIRINGS = {
        grotesk: { display: "'Archivo Expanded', sans-serif", body: "'Archivo', sans-serif" },
        mono: { display: "'JetBrains Mono', monospace", body: "'Archivo', sans-serif" }
    };

    function clamp(v, min, max) {
        return Math.max(min, Math.min(max, v));
    }

    // Viewport pan & scale state
    let canvasViewportState = { x: 0, y: 0, scale: 1 };

    window.resetCanvasViewport = function() {
        canvasViewportState = { x: 0, y: 0, scale: 1 };
        window.renderCanvasPortfolio();
    };

    function generateDefaultCanvasItems() {
        const info = getStudentInfo() || {};
        const adminNo = localStorage.getItem('machub_student_id') || (info && info.adminNo) || '';

        // 1. Real Student Name & Tagline
        const rawName = (info.name && info.name !== 'Student') ? info.name : (info.fullName || info.displayName || 'Student Profile');
        const formattedName = rawName.includes(' ') ? rawName.replace(' ', '\n') : rawName;

        const deptStr = info.dept || info.department || info.course || 'Student';
        const classStr = (info.classGroup || info.batch) ? (`Batch ${info.classGroup || info.batch}`) : '';
        const regStr = info.reg ? `Reg: ${info.reg}` : (adminNo ? `Admin: ${adminNo}` : '');
        const taglineStr = [deptStr, classStr, regStr].filter(Boolean).join(' · ');

        // 2. Real Live Synced Attendance
        let realAttendance = 0;
        try {
            const rawAtt = getPortalCache('Attendance', adminNo) || getPortalCache('attendance', adminNo);
            if (rawAtt) {
                const parsed = JSON.parse(rawAtt);
                const payload = parsed?.data?.payload || parsed?.data || parsed;
                const val = payload?.totalPercentage || payload?.attendancePercentage || payload?.percentage || payload?.overallPercentage || payload?.attendance;
                if (val) realAttendance = Math.round(parseFloat(val));
            }
        } catch(e) {}

        // 3. Real Live Synced Exam Marks Cards
        let realMarkCards = [];
        try {
            const rawMarks = getPortalCache('Internal_Marks', adminNo) || getPortalCache('Exam_Results', adminNo) || getPortalCache('marks', adminNo);
            if (rawMarks) {
                const parsed = JSON.parse(rawMarks);
                const payload = parsed?.data?.payload || parsed?.data || parsed;
                const subjects = payload?.subjects || payload?.marks || payload?.courses || payload?.examResults || payload?.results || [];
                if (Array.isArray(subjects) && subjects.length > 0) {
                    subjects.slice(0, 3).forEach((sub, idx) => {
                        const subName = sub.name || sub.subjectName || sub.courseName || sub.subject || `Subject ${idx+1}`;
                        const score = sub.totalMarks || sub.marksObtained || sub.score || sub.internalMarks || sub.mark || '0';
                        const total = sub.maxMarks || sub.total || '50';
                        realMarkCards.push({
                            id: 'mark' + (idx + 1),
                            type: 'markcard',
                            x: 44 + (idx * 246),
                            y: 480,
                            w: 220,
                            h: 120,
                            subject: subName,
                            score: String(score),
                            total: String(total)
                        });
                    });
                }
            }
        } catch(e) {}

        if (realMarkCards.length === 0) {
            realMarkCards = [
                { id: "mark1", type: "markcard", x: 44, y: 480, w: 220, h: 120, subject: "Exam Marks", score: "0", total: "100" }
            ];
        }

        // 4. Real Academic Info Card
        const academicBlock = {
            id: "academic",
            type: "academic",
            x: 44,
            y: 300,
            w: 320,
            h: 140,
            adminNo: adminNo || '---',
            regNo: info.reg || '---',
            dept: info.dept || info.department || 'General'
        };

        // 5. Real Avatar Photo
        const photoUrl = info.photoUrl || info.photo || localStorage.getItem('machub_avatar_url_' + adminNo) || null;

        return [
            { id: "name", type: "text", variant: "display", x: 40, y: 70, w: 520, h: 130, content: formattedName },
            { id: "tagline", type: "text", variant: "tagline", x: 44, y: 210, w: 420, h: 60, content: taglineStr },
            { id: "attendance", type: "stat", x: 600, y: 70, w: 200, h: 200, label: "ATTENDANCE", value: realAttendance, suffix: "%" },
            { id: "photo", type: "photo", x: 600, y: 290, w: 200, h: 240, url: photoUrl },
            academicBlock,
            ...realMarkCards
        ];
    }

    function getCanvasItems() {
        const adminNo = localStorage.getItem('machub_student_id') || 'default';
        let items = null;
        try {
            const data = localStorage.getItem('machub_canvas_elements_v2_' + adminNo);
            if (data) items = JSON.parse(data);
        } catch(e) {}
        
        if (!items) items = getLiveStudentCanvasItems();

        if (canvasHistoryStack.length === 0 && items) {
            recordCanvasHistory(items);
        }
        return items;
    }

    let canvasCloudSyncTimer = null;

    window.syncCanvasToCloud = async function(adminNo, items) {
        if (!adminNo || adminNo === 'default') return;
        try {
            if (window.updateFirestoreDocSecurely) {
                await window.updateFirestoreDocSecurely(adminNo, {
                    canvasElements: items,
                    updatedAt: new Date().toISOString()
                });
            } else if (window.firebaseFirestore && window.firestoreDoc && window.firestoreSetDoc) {
                const docRef = window.firestoreDoc(window.firebaseFirestore, 'students', adminNo);
                await window.firestoreSetDoc(docRef, {
                    canvasElements: items,
                    updatedAt: new Date().toISOString()
                }, { merge: true });
            }
        } catch(e) {
            console.warn('[Canvas Cloud Sync] Save failed:', e.message);
        }
    };

    window.syncCanvasFromCloud = async function(adminNo) {
        if (!adminNo || adminNo === 'default') return;
        try {
            if (window.firebaseFirestore && window.firestoreDoc && window.firestoreGetDoc) {
                const docRef = window.firestoreDoc(window.firebaseFirestore, 'students', adminNo);
                const snap = await window.firestoreGetDoc(docRef);
                if (snap.exists()) {
                    const data = snap.data();
                    let updated = false;
                    if (data.canvasElements && Array.isArray(data.canvasElements)) {
                        localStorage.setItem('machub_canvas_elements_v2_' + adminNo, JSON.stringify(data.canvasElements));
                        updated = true;
                    }
                    if (data.photoUrl || data.avatarUrl) {
                        localStorage.setItem('machub_avatar_url_' + adminNo, data.photoUrl || data.avatarUrl);
                        updated = true;
                    }
                    if (data.designSettings) {
                        localStorage.setItem('machub_design_settings_' + adminNo, JSON.stringify(data.designSettings));
                        updated = true;
                    }
                    if (updated) window.renderCanvasPortfolio();
                }
            }
        } catch(e) {
            console.warn('[Canvas Cloud Sync] Fetch failed:', e.message);
        }
    };

    let canvasHistoryStack = [];
    let canvasRedoStack = [];
    let isExecutingHistoryAction = false;

    function recordCanvasHistory(items) {
        if (isExecutingHistoryAction) return;
        const snapshot = JSON.stringify(items);
        if (canvasHistoryStack.length > 0 && canvasHistoryStack[canvasHistoryStack.length - 1] === snapshot) {
            return;
        }
        canvasHistoryStack.push(snapshot);
        if (canvasHistoryStack.length > 60) {
            canvasHistoryStack.shift();
        }
        canvasRedoStack = [];
        if (window.updateUndoRedoButtonsState) window.updateUndoRedoButtonsState();
    }

    window.updateUndoRedoButtonsState = function() {
        const undoBtn = document.getElementById('undoBtn');
        const redoBtn = document.getElementById('redoBtn');
        const undoBar = document.getElementById('undoRedoEditBar');
        const isEdit = (window.appState && window.appState.profileMode === 'edit');

        if (undoBar) {
            if (isEdit) undoBar.classList.remove('hidden');
            else undoBar.classList.add('hidden');
        }

        if (undoBtn) {
            undoBtn.disabled = canvasHistoryStack.length <= 1;
        }
        if (redoBtn) {
            redoBtn.disabled = canvasRedoStack.length === 0;
        }
    };

    window.undoCanvasEdit = function() {
        if (canvasHistoryStack.length <= 1) return;
        isExecutingHistoryAction = true;

        const currentState = canvasHistoryStack.pop();
        canvasRedoStack.push(currentState);

        const prevState = canvasHistoryStack[canvasHistoryStack.length - 1];
        const items = JSON.parse(prevState);

        saveCanvasItemsDirect(items);
        window.renderCanvasPortfolio();
        window.updateUndoRedoButtonsState();

        isExecutingHistoryAction = false;
    };

    window.redoCanvasEdit = function() {
        if (canvasRedoStack.length === 0) return;
        isExecutingHistoryAction = true;

        const redoState = canvasRedoStack.pop();
        canvasHistoryStack.push(redoState);

        const items = JSON.parse(redoState);
        saveCanvasItemsDirect(items);
        window.renderCanvasPortfolio();
        window.updateUndoRedoButtonsState();

        isExecutingHistoryAction = false;
    };

    function saveCanvasItemsDirect(items) {
        const adminNo = localStorage.getItem('machub_student_id') || 'default';
        localStorage.setItem('machub_canvas_elements_v2_' + adminNo, JSON.stringify(items));
        clearTimeout(canvasCloudSyncTimer);
        canvasCloudSyncTimer = setTimeout(() => {
            if (window.syncCanvasToCloud) window.syncCanvasToCloud(adminNo, items);
        }, 350);
    }

    function saveCanvasItems(items) {
        saveCanvasItemsDirect(items);
        recordCanvasHistory(items);
    }

    let activeDragState = null;
    let activeResizeState = null;

    window.initCanvasDrag = function(e, id) {
        if (!window.appState || window.appState.profileMode !== 'edit') return;
        if (e.target && (e.target.getAttribute('aria-label') === 'Resize element' || e.target.getAttribute('aria-label') === 'Delete element')) return;
        if (e.pointerType === 'touch' && e.isPrimary === false) return;
        e.stopPropagation();
        window.selectCanvasElement(id);

        const items = getCanvasItems();
        const el = items.find(it => it.id === id);
        if (!el) return;

        const startX = e.clientX;
        const startY = e.clientY;
        activeDragState = { id, startX, startY, origX: el.x, origY: el.y };

        const onMove = (ev) => {
            if (!activeDragState) return;
            const scale = (canvasViewportState && canvasViewportState.scale) ? canvasViewportState.scale : 1;
            const dx = (ev.clientX - activeDragState.startX) / scale;
            const dy = (ev.clientY - activeDragState.startY) / scale;
            const updatedItems = getCanvasItems().map(item => {
                if (item.id === activeDragState.id) {
                    return {
                        ...item,
                        x: clamp(Math.round(activeDragState.origX + dx), -400, 3000),
                        y: clamp(Math.round(activeDragState.origY + dy), -400, 4000)
                    };
                }
                return item;
            });
            saveCanvasItems(updatedItems);
            window.renderCanvasPortfolio();
        };

        const onUp = () => {
            activeDragState = null;
            window.removeEventListener('pointermove', onMove);
            window.removeEventListener('pointerup', onUp);
        };

        window.addEventListener('pointermove', onMove);
        window.addEventListener('pointerup', onUp);
    };

    window.initCanvasResize = function(e, id) {
        if (!window.appState || window.appState.profileMode !== 'edit') return;
        e.stopPropagation();
        e.preventDefault();
        const items = getCanvasItems();
        const el = items.find(it => it.id === id);
        if (!el) return;

        const startX = e.clientX;
        const startY = e.clientY;
        activeResizeState = { id, startX, startY, origW: el.w, origH: el.h };

        const onMove = (ev) => {
            if (!activeResizeState) return;
            const scale = (canvasViewportState && canvasViewportState.scale) ? canvasViewportState.scale : 1;
            const dx = (ev.clientX - activeResizeState.startX) / scale;
            const dy = (ev.clientY - activeResizeState.startY) / scale;
            const updatedItems = getCanvasItems().map(item => {
                if (item.id === activeResizeState.id) {
                    return {
                        ...item,
                        w: clamp(Math.round(activeResizeState.origW + dx), 90, 900),
                        h: clamp(Math.round(activeResizeState.origH + dy), 60, 700)
                    };
                }
                return item;
            });
            saveCanvasItems(updatedItems);
            window.renderCanvasPortfolio();
        };

        const onUp = () => {
            activeResizeState = null;
            window.removeEventListener('pointermove', onMove);
            window.removeEventListener('pointerup', onUp);
        };

        window.addEventListener('pointermove', onMove);
        window.addEventListener('pointerup', onUp);
    };

    window.renderCanvasPortfolio = function() {
        const container = document.getElementById('profileCanvasContainer');
        if (!container) return;

        const isEdit = (window.appState && window.appState.profileMode === 'edit');
        const items = getCanvasItems();

        // Apply dark paper dot-grid styling to profile view container
        const profileView = document.getElementById('view-profile');
        if (profileView) {
            profileView.classList.add('canvas-dot-grid');
        }

        container.style.position = 'relative';
        container.style.width = '100%';
        container.style.minHeight = '700px';
        container.style.transformOrigin = '0 0';
        container.style.transform = `translate(${canvasViewportState.x}px, ${canvasViewportState.y}px) scale(${canvasViewportState.scale})`;

        let html = items.map((el) => {
            const isSelected = isEdit && selectedCanvasElementId === el.id;
            const pointerDownAttr = isEdit ? `onpointerdown="window.initCanvasDrag(event, '${el.id}')"` : '';
            const clickAttr = isEdit ? `onclick="event.stopPropagation(); window.selectCanvasElement('${el.id}', event);"` : '';

            let bodyHtml = '';
            if (el.type === 'text') {
                const isDisplay = (el.variant === 'display');
                bodyHtml = `
                    <div contenteditable="${isEdit}" onpointerdown="event.stopPropagation();" oninput="window.handleCanvasInlineInput(event, '${el.id}', 'content')" style="font-family:${isDisplay ? "'Archivo Expanded', sans-serif" : "'Archivo', sans-serif"}; font-weight:${isDisplay ? 800 : 500}; font-size:${isDisplay ? 34 : 14}px; line-height:${isDisplay ? 0.98 : 1.4}; letter-spacing:${isDisplay ? '-0.02em' : '0'}; color:${isDisplay ? '#F5F5F7' : 'rgba(245,245,247,0.65)'}; white-space:pre-line; width:100%; height:100%; outline:none; cursor:${isEdit ? 'text' : 'inherit'};">
                        ${escapeHtml(el.content || '')}
                    </div>
                `;
            } else if (el.type === 'academic') {
                bodyHtml = `
                    <div style="width:100%; height:100%; display:flex; flex-direction:column; justify-content:space-between; font-family:'Archivo', sans-serif;">
                        <div style="font-size:10px; letter-spacing:0.1em; color:rgba(245,245,247,0.4); text-transform:uppercase;">ACADEMIC DETAILS</div>
                        <div style="display:flex; flex-direction:column; gap:4px; font-size:13px; color:#F5F5F7;">
                            <div><span style="color:rgba(245,245,247,0.5);">Admin No:</span> <span contenteditable="${isEdit}" onpointerdown="event.stopPropagation();" oninput="window.handleCanvasInlineInput(event, '${el.id}', 'adminNo')" style="outline:none;">${escapeHtml(el.adminNo || '---')}</span></div>
                            <div><span style="color:rgba(245,245,247,0.5);">Register No:</span> <span contenteditable="${isEdit}" onpointerdown="event.stopPropagation();" oninput="window.handleCanvasInlineInput(event, '${el.id}', 'regNo')" style="outline:none;">${escapeHtml(el.regNo || '---')}</span></div>
                            <div><span style="color:rgba(245,245,247,0.5);">Department:</span> <span contenteditable="${isEdit}" onpointerdown="event.stopPropagation();" oninput="window.handleCanvasInlineInput(event, '${el.id}', 'dept')" style="outline:none;">${escapeHtml(el.dept || '---')}</span></div>
                        </div>
                    </div>
                `;
            } else if (el.type === 'section') {
                bodyHtml = `
                    <div style="width:100%; height:100%; display:flex; align-items:center; border-bottom:1.5px solid rgba(0,245,212,0.3); padding-bottom:8px;">
                        <div contenteditable="${isEdit}" onpointerdown="event.stopPropagation();" oninput="window.handleCanvasInlineInput(event, '${el.id}', 'title')" style="font-family:'Archivo Expanded', sans-serif; font-size:18px; font-weight:700; color:#00F5D4; text-transform:uppercase; letter-spacing:0.04em; outline:none; width:100%;">
                            ${escapeHtml(el.title || 'SECTION HEADER')}
                        </div>
                    </div>
                `;
            } else if (el.type === 'photo') {
                const photoSrc = el.url || el.photoUrl || null;
                const studentName = getStudentInfo().name || 'Student';
                const initialChar = studentName.charAt(0).toUpperCase();

                bodyHtml = photoSrc ? `
                    <div onclick="${isEdit ? `event.stopPropagation(); window.editCanvasElementContent('${el.id}');` : ''}" style="width:100%; height:100%; border-radius:18px; position:relative; overflow:hidden; cursor:${isEdit ? 'pointer' : 'default'};">
                        <img src="${escapeHtml(photoSrc)}" style="width:100%; height:100%; object-fit:cover;" alt="${escapeHtml(studentName)}" />
                        <div style="position:absolute; inset:0; border:1.5px solid rgba(255,255,255,0.08); border-radius:18px;"></div>
                    </div>
                ` : `
                    <div onclick="${isEdit ? `event.stopPropagation(); window.editCanvasElementContent('${el.id}');` : ''}" style="width:100%; height:100%; border-radius:18px; background:linear-gradient(155deg, #1E202B 0%, #121319 100%); display:flex; flex-direction:column; align-items:center; justify-content:center; gap:8px; font-family:'Archivo', sans-serif; font-size:12px; color:rgba(245,245,247,0.4); position:relative; overflow:hidden; cursor:${isEdit ? 'pointer' : 'default'};">
                        <div style="position:absolute; inset:0; border:1.5px solid rgba(255,255,255,0.08); border-radius:18px;"></div>
                        <div style="width:52px; height:52px; border-radius:50%; background:rgba(255,255,255,0.08); display:flex; align-items:center; justify-content:center; font-size:22px; font-weight:700; color:#F5F5F7;">
                            ${escapeHtml(initialChar)}
                        </div>
                        <span style="font-size:11px; letter-spacing:0.04em;">${escapeHtml(studentName)}</span>
                    </div>
                `;
            } else if (el.type === 'stat') {
                const val = (typeof el.value === 'number') ? el.value : 0;
                const dashOffset = (val / 100) * 238.76;
                bodyHtml = `
                    <div style="width:100%; height:100%; display:flex; flex-direction:column; align-items:center; justify-content:center; gap:6px;">
                        <svg width="88" height="88" viewBox="0 0 88 88">
                            <circle cx="44" cy="44" r="38" fill="none" stroke="rgba(255,255,255,0.08)" stroke-width="6" />
                            <circle cx="44" cy="44" r="38" fill="none" stroke="#00F5D4" stroke-width="6" stroke-linecap="round" stroke-dasharray="${dashOffset} 238.76" transform="rotate(-90 44 44)" />
                        </svg>
                        <div style="font-family:'JetBrains Mono', monospace; font-size:24px; font-weight:500; color:#F5F5F7; margin-top:-58px;">
                            ${val}${el.suffix || '%'}
                        </div>
                        <div contenteditable="${isEdit}" onpointerdown="event.stopPropagation();" oninput="window.handleCanvasInlineInput(event, '${el.id}', 'statLabel')" style="font-family:'JetBrains Mono', monospace; font-size:10px; letter-spacing:0.12em; color:rgba(245,245,247,0.4); margin-top:28px; outline:none;">
                            ${escapeHtml(el.label || 'ATTENDANCE')}
                        </div>
                    </div>
                `;
            } else if (el.type === 'links') {
                bodyHtml = `
                    <div style="display:flex; flex-direction:column; gap:10px; width:100%;">
                        ${(el.items || []).map(item => `
                            <div style="display:flex; justify-content:space-between; align-items:baseline; border-bottom:1px solid rgba(255,255,255,0.08); padding-bottom:8px; font-family:'Archivo', sans-serif;">
                                <span contenteditable="${isEdit}" onpointerdown="event.stopPropagation();" oninput="window.handleCanvasInlineInput(event, '${el.id}', 'linkLabel')" style="font-size:11px; letter-spacing:0.08em; color:rgba(245,245,247,0.4); text-transform:uppercase; outline:none;">${escapeHtml(item.label)}</span>
                                <span contenteditable="${isEdit}" onpointerdown="event.stopPropagation();" oninput="window.handleCanvasInlineInput(event, '${el.id}', 'linkHandle')" style="font-size:15px; font-weight:600; color:#F5F5F7; outline:none;">${escapeHtml(item.handle)}</span>
                            </div>
                        `).join('')}
                    </div>
                `;
            } else if (el.type === 'markcard') {
                bodyHtml = `
                    <div style="width:100%; height:100%; display:flex; flex-direction:column; justify-content:space-between;">
                        <div contenteditable="${isEdit}" onpointerdown="event.stopPropagation();" oninput="window.handleCanvasInlineInput(event, '${el.id}', 'subject')" style="font-family:'Archivo', sans-serif; font-size:13px; font-weight:600; color:rgba(245,245,247,0.6); outline:none;">
                            ${escapeHtml(el.subject || 'Subject')}
                        </div>
                        <div style="font-family:'JetBrains Mono', monospace; font-size:28px; color:#F5F5F7; display:flex; align-items:baseline; gap:4px;">
                            <span contenteditable="${isEdit}" onpointerdown="event.stopPropagation();" oninput="window.handleCanvasInlineInput(event, '${el.id}', 'score')" style="outline:none;">${escapeHtml(el.score || '0')}</span>
                            <span style="font-size:15px; color:rgba(245,245,247,0.35);">/<span contenteditable="${isEdit}" onpointerdown="event.stopPropagation();" oninput="window.handleCanvasInlineInput(event, '${el.id}', 'total')" style="outline:none;">${escapeHtml(el.total || '50')}</span></span>
                        </div>
                    </div>
                `;
            } else {
                bodyHtml = `<div contenteditable="${isEdit}" onpointerdown="event.stopPropagation();" oninput="window.handleCanvasInlineInput(event, '${el.id}', 'content')" style="font-family:'Archivo', sans-serif; font-size:13px; color:#F5F5F7; outline:none;">${escapeHtml(el.content || '')}</div>`;
            }

            const isText = (el.type === 'text');
            const elementFont = el.fontFamily ? `'${el.fontFamily}', sans-serif` : (currentFontKey === 'mono' ? "'JetBrains Mono', monospace" : "'Archivo', sans-serif");
            const elementAccent = el.accentColor || ACCENT_PALETTE[currentAccentIndex] || '#00F5D4';
            const elementShadow = el.customShadow || (SHADOW_STYLES[currentShadowStyleIndex] || SHADOW_STYLES[0]).css;
            const shadowStyle = isText ? 'none' : (isSelected && isEdit ? `0 18px 40px -12px ${elementAccent}44, 0 2px 8px ${elementAccent}22` : elementShadow);
            const bgStyle = isText ? 'transparent' : (el.customBg || '#181920');
            const borderRadiusVal = el.customRadius !== undefined ? el.customRadius : (isText ? 0 : 20);
            const borderStyle = isText ? 'none' : `1.5px solid ${isSelected && isEdit ? elementAccent : 'rgba(255,255,255,0.08)'}`;
            const paddingStyle = isText ? '0' : '20px';

            const dblClickAttr = isEdit ? `ondblclick="event.stopPropagation(); window.editCanvasElementContent('${el.id}')"` : '';
            const handlesHtml = (isEdit && isSelected) ? `
                <div style="position:absolute; inset:-6px; border:1.5px dashed ${elementAccent}; border-radius:${borderRadiusVal + 4}px; pointer-events:none;"></div>
                <button onclick="event.stopPropagation(); window.editCanvasElementContent('${el.id}');" style="position:absolute; top:-14px; left:-14px; width:28px; height:28px; border-radius:50%; background:#181920; color:${elementAccent}; border:1px solid ${elementAccent}; font-size:12px; cursor:pointer; display:flex; align-items:center; justify-content:center; box-shadow:0 4px 10px rgba(0,0,0,0.5);" title="Edit Content" aria-label="Edit content">✎</button>
                <button onclick="event.stopPropagation(); window.deleteCanvasItem('${el.id}');" style="position:absolute; top:-14px; right:-14px; width:28px; height:28px; border-radius:50%; background:#000000; color:#F5F5F7; border:1px solid rgba(255,255,255,0.2); font-size:14px; cursor:pointer; display:flex; align-items:center; justify-content:center; box-shadow:0 4px 10px rgba(0,0,0,0.5);" aria-label="Delete element">×</button>
                <div onpointerdown="window.initCanvasResize(event, '${el.id}')" style="position:absolute; bottom:-8px; right:-8px; width:20px; height:20px; border-radius:50%; background:${elementAccent}; border:2px solid #0D0E12; cursor:nwse-resize; touch-action:none; box-shadow:0 2px 6px rgba(0,0,0,0.4);" aria-label="Resize element"></div>
            ` : '';

            return `
                <div ${pointerDownAttr} ${clickAttr} ${dblClickAttr} style="position:absolute; left:${el.x}px; top:${el.y}px; width:${el.w}px; height:${el.h}px; cursor:${isEdit ? 'grab' : 'default'}; user-select:none; touch-action:none; font-family:${elementFont};">
                    <div style="width:100%; height:100%; padding:${paddingStyle}; box-sizing:border-box; border-radius:${borderRadiusVal}px; background:${bgStyle}; border:${borderStyle}; box-shadow:${shadowStyle}; transition:all 0.25s ease; position:relative;">
                        ${bodyHtml}
                    </div>
                    ${handlesHtml}
                </div>
            `;
        }).join('');

        container.innerHTML = html;
    };

    window.addCanvasSectionBlock = function() {
        window.toggleCanvasAddMenu(false);
        const title = prompt('Enter Section Title (e.g. Featured Projects):', 'New Section');
        if (!title) return;

        const items = getCanvasItems();
        items.push({
            id: 'c_sec_' + Date.now(),
            type: 'section',
            title: title.trim()
        });
        saveCanvasItems(items);
        window.renderCanvasPortfolio();
        if (window.showToast) window.showToast('Section added to canvas!', 'success');
    };

    window.deleteCanvasSectionOrSelected = function() {
        window.toggleCanvasAddMenu(false);
        const items = getCanvasItems();
        const sections = items.filter(it => it.type === 'section');
        
        if (sections.length === 0) {
            if (window.showToast) window.showToast('No sections found on canvas.', 'info');
            return;
        }

        const sectionTitle = prompt(`Enter section name to remove:\nAvailable: ${sections.map(s => s.title).join(', ')}`, sections[sections.length - 1].title);
        if (!sectionTitle) return;

        const filtered = items.filter(it => !(it.type === 'section' && it.title.toLowerCase() === sectionTitle.trim().toLowerCase()));
        saveCanvasItems(filtered);
        window.renderCanvasPortfolio();
        if (window.showToast) window.showToast(`Section "${sectionTitle}" deleted.`, 'success');
    };

    window.updateCanvasSectionTitle = function(id, newTitle) {
        const items = getCanvasItems();
        const item = items.find(it => it.id === id);
        if (item && newTitle !== null && newTitle !== undefined) {
            item.title = newTitle.trim();
            saveCanvasItems(items);
            window.renderCanvasPortfolio();
        }
    };

    window.addCanvasTextBlock = function() {
        window.toggleCanvasAddMenu(false);
        const items = getCanvasItems();
        items.push({
            id: 'c_text_' + Date.now(),
            type: 'text',
            content: 'New Portfolio Note / Heading (Tap to edit)'
        });
        saveCanvasItems(items);
        window.renderCanvasPortfolio();
        if (window.showToast) window.showToast('Text block added to canvas!', 'success');
    };

    window.addCanvasLinkCard = function() {
        window.toggleCanvasAddMenu(false);
        const title = prompt('Enter Link Title (e.g. GitHub):', 'My Link');
        if (!title) return;
        const url = prompt('Enter Link URL (e.g. https://...):', 'https://');
        if (!url) return;

        const items = getCanvasItems();
        items.push({
            id: 'c_link_' + Date.now(),
            type: 'link',
            title: title.trim(),
            url: url.trim()
        });
        saveCanvasItems(items);
        window.renderCanvasPortfolio();
        if (window.showToast) window.showToast('Link card added to canvas!', 'success');
    };

    window.addCanvasImageCard = function() {
        window.toggleCanvasAddMenu(false);
        const url = prompt('Enter Image URL (or paste image web link):', 'https://images.unsplash.com/photo-1518770660439-4636190af475');
        if (!url) return;

        const items = getCanvasItems();
        items.push({
            id: 'c_img_' + Date.now(),
            type: 'image',
            url: url.trim()
        });
        saveCanvasItems(items);
        window.renderCanvasPortfolio();
        if (window.showToast) window.showToast('Image card added to canvas!', 'success');
    };

    window.deleteCanvasItem = function(id) {
        let items = getCanvasItems();
        items = items.filter(it => it.id !== id);
        saveCanvasItems(items);
        window.renderCanvasPortfolio();
    };

    window.moveCanvasItem = function(index, direction) {
        const items = getCanvasItems();
        const newIndex = index + direction;
        if (newIndex < 0 || newIndex >= items.length) return;
        const temp = items[index];
        items[index] = items[newIndex];
        items[newIndex] = temp;
        saveCanvasItems(items);
        window.renderCanvasPortfolio();
    };

    // Visibility state management & Persistence
    // NOTE TO DEVELOPER: These visibility flags dictate UI rendering in this phase.
    // TODO: Enforce server-side access control via Firestore Security Rules when the Public Directory / Search feature ships in Phase 2.
    function getVisibilityState() {
        const defaultVisibility = {
            attendancePublic: true,
            marksPublic: true,
            rankPublic: false,
            profilePublic: true
        };
        try {
            const stored = localStorage.getItem('machub_profile_visibility');
            if (stored) return { ...defaultVisibility, ...JSON.parse(stored) };
        } catch(e) {}
        return defaultVisibility;
    }

    window.openVisibilityPanel = function() {
        if (typeof window.openSettingsTray === 'function') {
            window.openSettingsTray();
            if (typeof window.settingsGoTo === 'function') window.settingsGoTo('privacy');
        }
    };

    window.closeVisibilityPanel = function() {};

    window.updateVisibilityFlag = function(key, isChecked) {
        const vis = getVisibilityState();
        vis[key] = !!isChecked;
        try {
            localStorage.setItem('machub_profile_visibility', JSON.stringify(vis));
        } catch(e) {}
        window.renderCanvasPortfolio();
    };

    // Auto-Portfolio Data Generator
    function getSyncedAutoPortfolioData() {
        const info = getStudentInfo();
        const adminNo = info.adminNo || localStorage.getItem('machub_student_id') || '';
        
        let attendancePct = 0;
        let attendanceBadge = '---';
        const rawAtt = getPortalCache('attendance', adminNo);
        if (rawAtt) {
            try {
                const parsed = JSON.parse(rawAtt);
                const payload = parsed?.data?.payload || parsed?.data || parsed;
                if (payload?.aggregatePct) {
                    attendancePct = parseFloat(payload.aggregatePct) || 0;
                } else if (payload?.subjects) {
                    let totalAtt = 0, totalClasses = 0;
                    payload.subjects.forEach(s => {
                        totalAtt += (parseInt(s.attended) || 0);
                        totalClasses += (parseInt(s.total) || 0);
                    });
                    if (totalClasses > 0) attendancePct = Math.round((totalAtt / totalClasses) * 100);
                }
            } catch(e) {}
        }
        if (attendancePct >= 85) attendanceBadge = 'Safe';
        else if (attendancePct >= 75) attendanceBadge = 'Warning';
        else if (attendancePct > 0) attendanceBadge = 'Shortage';

        // Parse Exam Marks cards
        let subjectMarks = [];
        const rawMarks = getPortalCache('marks', adminNo);
        if (rawMarks) {
            try {
                const parsed = JSON.parse(rawMarks);
                const payload = parsed?.data?.payload || parsed?.data || parsed;
                const subs = payload?.subjects || payload?.marks || [];
                subjectMarks = subs.slice(0, 4).map(s => ({
                    code: s.code || s.subjectCode || 'SUB',
                    title: s.title || s.subjectName || 'Subject',
                    score: s.score || s.marks || s.grade || '--'
                }));
            } catch(e) {}
        }
        if (subjectMarks.length === 0) {
            subjectMarks = [
                { code: 'CS301', title: 'Data Structures', score: '88/100' },
                { code: 'CS302', title: 'Database Systems', score: '92/100' },
                { code: 'CS303', title: 'Web Development', score: '95/100' }
            ];
        }

        return {
            info,
            attendancePct: attendancePct || 86,
            attendanceBadge,
            subjectMarks
        };
    }

    // Inline Session-Suppressible Suggestions
    window.dismissSessionSuggestion = function(key) {
        try {
            sessionStorage.setItem('machub_suppress_sug_' + key, 'true');
        } catch(e) {}
        window.renderCanvasPortfolio();
    };

    function isSuggestionSuppressed(key) {
        try {
            return sessionStorage.getItem('machub_suppress_sug_' + key) === 'true';
        } catch(e) {}
        return false;
    }

    window.updateCanvasTextContent = function(id, newContent) {
        const items = getCanvasItems();
        const item = items.find(it => it.id === id);
        if (item) {
            item.content = newContent;
            saveCanvasItems(items);
        }
    };

    window.updateCanvasLink = function(id, newTitle, newUrl) {
        const items = getCanvasItems();
        const item = items.find(it => it.id === id);
        if (item) {
            if (newTitle !== null && newTitle !== undefined) item.title = newTitle.trim();
            if (newUrl !== null && newUrl !== undefined) item.url = newUrl.trim();
            saveCanvasItems(items);
            window.renderCanvasPortfolio();
        }
    };

    window.updatePlusButtonState = function() {
        const arcMenu = document.getElementById('arcToolPopover');
        const symbolEl = document.getElementById('aiPlusIconSymbol');

        const isArcMenuOpen = arcMenu && !arcMenu.classList.contains('hidden') && arcMenu.classList.contains('is-open');

        if (symbolEl) {
            if (isArcMenuOpen) {
                symbolEl.textContent = '✕';
                symbolEl.style.transform = 'rotate(90deg) scale(0.9)';
            } else {
                symbolEl.textContent = '+';
                symbolEl.style.transform = 'rotate(0deg) scale(1)';
            }
        }
    };

    window.handleCanvasInlineInput = function(e, id, fieldKey) {
        const text = (e.target.innerText || e.target.textContent || '').trim();
        const items = getCanvasItems();
        const item = items.find(it => it.id === id);
        if (!item) return;

        if (fieldKey === 'content') item.content = text;
        else if (fieldKey === 'title') item.title = text;
        else if (fieldKey === 'subject') item.subject = text;
        else if (fieldKey === 'score') item.score = text;
        else if (fieldKey === 'total') item.total = text;
        else if (fieldKey === 'adminNo') item.adminNo = text;
        else if (fieldKey === 'regNo') item.regNo = text;
        else if (fieldKey === 'dept') item.dept = text;
        else if (fieldKey === 'statLabel') item.label = text;
        else if (fieldKey === 'statValue') item.value = parseFloat(text) || 0;
        else if (fieldKey === 'linkLabel') {
            if (!item.items) item.items = [{}];
            item.items[0].label = text;
        } else if (fieldKey === 'linkHandle') {
            if (!item.items) item.items = [{}];
            item.items[0].handle = text;
        }

        saveCanvasItems(items);
    };

    window.editCanvasElementContent = function(id) {
        if (!window.appState || window.appState.profileMode !== 'edit') return;
        const items = getCanvasItems();
        const item = items.find(it => it.id === id);
        if (!item) return;

        let modal = document.getElementById('canvasElementEditModal');
        if (!modal) {
            modal = document.createElement('div');
            modal.id = 'canvasElementEditModal';
            modal.style.cssText = `
                position: fixed; inset: 0; z-index: 99999;
                background: rgba(0,0,0,0.75); backdrop-filter: blur(20px); -webkit-backdrop-filter: blur(20px);
                display: flex; align-items: center; justify-content: center; padding: 20px;
                animation: fadeIn 0.25s ease;
            `;
            document.body.appendChild(modal);
        }

        let fieldsHtml = '';
        if (item.type === 'text') {
            fieldsHtml = `
                <div style="display:flex; flex-direction:column; gap:12px;">
                    <label style="font-size:12px; font-weight:700; color:rgba(245,245,247,0.6); text-transform:uppercase; letter-spacing:0.08em;">Text Content / Title</label>
                    <textarea id="editFieldContent" rows="4" style="width:100%; background:#181920; border:1.5px solid rgba(255,255,255,0.15); border-radius:14px; padding:12px; color:#F5F5F7; font-family:'Archivo', sans-serif; font-size:14px; outline:none; resize:vertical;">${escapeHtml(item.content || '')}</textarea>
                </div>
            `;
        } else if (item.type === 'section') {
            fieldsHtml = `
                <div style="display:flex; flex-direction:column; gap:12px;">
                    <label style="font-size:12px; font-weight:700; color:rgba(245,245,247,0.6); text-transform:uppercase; letter-spacing:0.08em;">Section Header Title</label>
                    <input type="text" id="editFieldTitle" value="${escapeHtml(item.title || '')}" style="width:100%; background:#181920; border:1.5px solid rgba(255,255,255,0.15); border-radius:14px; padding:12px; color:#F5F5F7; font-family:'Archivo', sans-serif; font-size:14px; outline:none;" />
                </div>
            `;
        } else if (item.type === 'academic') {
            fieldsHtml = `
                <div style="display:flex; flex-direction:column; gap:12px;">
                    <div>
                        <label style="font-size:11px; font-weight:700; color:rgba(245,245,247,0.6); text-transform:uppercase;">Admission Number</label>
                        <input type="text" id="editFieldAdminNo" value="${escapeHtml(item.adminNo || '')}" style="width:100%; background:#181920; border:1.5px solid rgba(255,255,255,0.15); border-radius:14px; padding:10px; color:#F5F5F7; font-size:14px; outline:none; margin-top:4px;" />
                    </div>
                    <div>
                        <label style="font-size:11px; font-weight:700; color:rgba(245,245,247,0.6); text-transform:uppercase;">Register Number</label>
                        <input type="text" id="editFieldRegNo" value="${escapeHtml(item.regNo || '')}" style="width:100%; background:#181920; border:1.5px solid rgba(255,255,255,0.15); border-radius:14px; padding:10px; color:#F5F5F7; font-size:14px; outline:none; margin-top:4px;" />
                    </div>
                    <div>
                        <label style="font-size:11px; font-weight:700; color:rgba(245,245,247,0.6); text-transform:uppercase;">Department / Branch</label>
                        <input type="text" id="editFieldDept" value="${escapeHtml(item.dept || '')}" style="width:100%; background:#181920; border:1.5px solid rgba(255,255,255,0.15); border-radius:14px; padding:10px; color:#F5F5F7; font-size:14px; outline:none; margin-top:4px;" />
                    </div>
                </div>
            `;
        } else if (item.type === 'markcard') {
            fieldsHtml = `
                <div style="display:flex; flex-direction:column; gap:12px;">
                    <div>
                        <label style="font-size:11px; font-weight:700; color:rgba(245,245,247,0.6); text-transform:uppercase;">Subject Name</label>
                        <input type="text" id="editFieldSubject" value="${escapeHtml(item.subject || '')}" style="width:100%; background:#181920; border:1.5px solid rgba(255,255,255,0.15); border-radius:14px; padding:10px; color:#F5F5F7; font-size:14px; outline:none; margin-top:4px;" />
                    </div>
                    <div style="display:grid; grid-template-columns:1fr 1fr; gap:10px;">
                        <div>
                            <label style="font-size:11px; font-weight:700; color:rgba(245,245,247,0.6); text-transform:uppercase;">Score Obtained</label>
                            <input type="text" id="editFieldScore" value="${escapeHtml(item.score || '')}" style="width:100%; background:#181920; border:1.5px solid rgba(255,255,255,0.15); border-radius:14px; padding:10px; color:#F5F5F7; font-size:14px; outline:none; margin-top:4px;" />
                        </div>
                        <div>
                            <label style="font-size:11px; font-weight:700; color:rgba(245,245,247,0.6); text-transform:uppercase;">Total Marks</label>
                            <input type="text" id="editFieldTotal" value="${escapeHtml(item.total || '')}" style="width:100%; background:#181920; border:1.5px solid rgba(255,255,255,0.15); border-radius:14px; padding:10px; color:#F5F5F7; font-size:14px; outline:none; margin-top:4px;" />
                        </div>
                    </div>
                </div>
            `;
        } else if (item.type === 'stat') {
            fieldsHtml = `
                <div style="display:flex; flex-direction:column; gap:12px;">
                    <div>
                        <label style="font-size:11px; font-weight:700; color:rgba(245,245,247,0.6); text-transform:uppercase;">Stat Metric Label</label>
                        <input type="text" id="editFieldStatLabel" value="${escapeHtml(item.label || '')}" style="width:100%; background:#181920; border:1.5px solid rgba(255,255,255,0.15); border-radius:14px; padding:10px; color:#F5F5F7; font-size:14px; outline:none; margin-top:4px;" />
                    </div>
                    <div>
                        <label style="font-size:11px; font-weight:700; color:rgba(245,245,247,0.6); text-transform:uppercase;">Percentage Value (0-100)</label>
                        <input type="number" id="editFieldStatValue" value="${item.value || 0}" style="width:100%; background:#181920; border:1.5px solid rgba(255,255,255,0.15); border-radius:14px; padding:10px; color:#F5F5F7; font-size:14px; outline:none; margin-top:4px;" />
                    </div>
                </div>
            `;
        } else if (item.type === 'links') {
            const first = (item.items && item.items[0]) || { label: 'Link', handle: '@username' };
            fieldsHtml = `
                <div style="display:flex; flex-direction:column; gap:12px;">
                    <div>
                        <label style="font-size:11px; font-weight:700; color:rgba(245,245,247,0.6); text-transform:uppercase;">Link Platform / Label</label>
                        <input type="text" id="editFieldLinkLabel" value="${escapeHtml(first.label || '')}" style="width:100%; background:#181920; border:1.5px solid rgba(255,255,255,0.15); border-radius:14px; padding:10px; color:#F5F5F7; font-size:14px; outline:none; margin-top:4px;" />
                    </div>
                    <div>
                        <label style="font-size:11px; font-weight:700; color:rgba(245,245,247,0.6); text-transform:uppercase;">Username / Handle / URL</label>
                        <input type="text" id="editFieldLinkHandle" value="${escapeHtml(first.handle || '')}" style="width:100%; background:#181920; border:1.5px solid rgba(255,255,255,0.15); border-radius:14px; padding:10px; color:#F5F5F7; font-size:14px; outline:none; margin-top:4px;" />
                    </div>
                </div>
            `;
        } else if (item.type === 'photo') {
            fieldsHtml = `
                <div style="display:flex; flex-direction:column; gap:12px;">
                    <label style="font-size:11px; font-weight:700; color:rgba(245,245,247,0.6); text-transform:uppercase;">Photo Image URL</label>
                    <input type="text" id="editFieldPhotoUrl" value="${escapeHtml(item.url || item.photoUrl || '')}" placeholder="https://..." style="width:100%; background:#181920; border:1.5px solid rgba(255,255,255,0.15); border-radius:14px; padding:10px; color:#F5F5F7; font-size:14px; outline:none; margin-top:4px;" />
                </div>
            `;
        }

        modal.innerHTML = `
            <div style="width:100%; max-width:440px; background:#0D0E12; border:1.5px solid rgba(255,255,255,0.15); border-radius:24px; padding:24px; box-shadow:0 24px 60px rgba(0,0,0,0.8), 0 0 30px rgba(0,245,212,0.15); display:flex; flex-direction:column; gap:20px; font-family:'Archivo', sans-serif;">
                <div style="display:flex; justify-content:space-between; align-items:center;">
                    <h3 style="font-size:18px; font-weight:700; color:#F5F5F7; margin:0;">Edit Canvas Element</h3>
                    <button onclick="document.getElementById('canvasElementEditModal').remove();" style="width:32px; height:32px; border-radius:50%; background:rgba(255,255,255,0.08); border:none; color:#F5F5F7; font-size:16px; cursor:pointer;">✕</button>
                </div>
                ${fieldsHtml}
                <div style="display:flex; gap:12px; justify-content:flex-end; margin-top:8px;">
                    <button onclick="document.getElementById('canvasElementEditModal').remove();" style="padding:10px 18px; border-radius:14px; background:transparent; border:1px solid rgba(255,255,255,0.2); color:#F5F5F7; font-size:13px; font-weight:600; cursor:pointer;">Cancel</button>
                    <button onclick="window.saveCanvasElementEditModal('${item.id}');" style="padding:10px 22px; border-radius:14px; background:#00F5D4; border:none; color:#0D0E12; font-size:13px; font-weight:700; cursor:pointer; box-shadow:0 4px 14px rgba(0,245,212,0.3);">Save Changes</button>
                </div>
            </div>
        `;
    };

    window.saveCanvasElementEditModal = function(id) {
        const items = getCanvasItems();
        const item = items.find(it => it.id === id);
        if (!item) return;

        const contentEl = document.getElementById('editFieldContent');
        const titleEl = document.getElementById('editFieldTitle');
        const adminNoEl = document.getElementById('editFieldAdminNo');
        const regNoEl = document.getElementById('editFieldRegNo');
        const deptEl = document.getElementById('editFieldDept');
        const subjectEl = document.getElementById('editFieldSubject');
        const scoreEl = document.getElementById('editFieldScore');
        const totalEl = document.getElementById('editFieldTotal');
        const statLabelEl = document.getElementById('editFieldStatLabel');
        const statValueEl = document.getElementById('editFieldStatValue');
        const linkLabelEl = document.getElementById('editFieldLinkLabel');
        const linkHandleEl = document.getElementById('editFieldLinkHandle');
        const photoUrlEl = document.getElementById('editFieldPhotoUrl');

        if (contentEl) item.content = contentEl.value;
        if (titleEl) item.title = titleEl.value;
        if (adminNoEl) item.adminNo = adminNoEl.value;
        if (regNoEl) item.regNo = regNoEl.value;
        if (deptEl) item.dept = deptEl.value;
        if (subjectEl) item.subject = subjectEl.value;
        if (scoreEl) item.score = scoreEl.value;
        if (totalEl) item.total = totalEl.value;
        if (statLabelEl) item.label = statLabelEl.value;
        if (statValueEl) item.value = parseFloat(statValueEl.value) || 0;
        if (linkLabelEl || linkHandleEl) {
            item.items = [{ label: linkLabelEl ? linkLabelEl.value : 'Link', handle: linkHandleEl ? linkHandleEl.value : '@username' }];
        }
        if (photoUrlEl) {
            item.url = photoUrlEl.value.trim();
            item.photoUrl = photoUrlEl.value.trim();
        }

        saveCanvasItems(items);
        window.renderCanvasPortfolio();
        const modal = document.getElementById('canvasElementEditModal');
        if (modal) modal.remove();
        if (window.showToast) window.showToast('Element updated & synced to Cloud! ☁️', 'success');
    };

    window.toggleCanvasAddMenu = function(force) {
        const menu = document.getElementById('canvasAddMenu');
        if (!menu) return;

        // Hide arc radial popover so 2 menus NEVER overlap!
        const popover = document.getElementById('arcToolPopover');
        const backdrop = document.getElementById('arcPopoverBackdrop');
        if (popover) {
            popover.classList.add('hidden');
            popover.classList.remove('is-open');
        }
        if (backdrop) backdrop.classList.add('hidden');

        if (typeof force === 'boolean') {
            menu.classList.toggle('hidden', !force);
        } else {
            menu.classList.toggle('hidden');
        }
        if (window.updatePlusButtonState) window.updatePlusButtonState();
    };

    // ── Design Settings State & Persistence ──
    function getDesignSettings() {
        const defaultSettings = {
            fontPairing: 'font-pair-apple',
            accentColor: '#00F5D4',
            backgroundTone: 'bg-tone-midnight',
            density: 'normal'
        };
        try {
            const adminNo = localStorage.getItem('machub_student_id') || 'default';
            const stored = localStorage.getItem('machub_design_settings_' + adminNo);
            if (stored) return { ...defaultSettings, ...JSON.parse(stored) };
        } catch(e) {}
        return defaultSettings;
    }

    function saveDesignSettings(settings) {
        try {
            const adminNo = localStorage.getItem('machub_student_id') || 'default';
            localStorage.setItem('machub_design_settings_' + adminNo, JSON.stringify(settings));
        } catch(e) {}
        applyDesignSettings(settings);
    }

    function applyDesignSettings(settings) {
        if (!settings) settings = getDesignSettings();
        const profileView = document.getElementById('view-profile');
        if (profileView) {
            // Font Pairing
            ['font-pair-apple', 'font-pair-nothing', 'font-pair-outfit', 'font-pair-serif', 'font-pair-inter'].forEach(cls => {
                profileView.classList.remove(cls);
            });
            if (settings.fontPairing) profileView.classList.add(settings.fontPairing);

            // Background Tone
            ['bg-tone-midnight', 'bg-tone-pitchblack', 'bg-tone-deepslate', 'bg-tone-glassfrost'].forEach(cls => {
                profileView.classList.remove(cls);
            });
            if (settings.backgroundTone) profileView.classList.add(settings.backgroundTone);

            // Accent Color
            if (settings.accentColor) {
                document.documentElement.style.setProperty('--machub-accent', settings.accentColor);
            }
        }
    }

    // Direct Canvas Element Selection State
    let selectedCanvasElementId = null;

    window.selectCanvasElement = function(elementId, event) {
        if (event) event.stopPropagation();
        if (!window.appState || window.appState.profileMode !== 'edit') return;
        selectedCanvasElementId = elementId;
        window.renderCanvasPortfolio();
    };

    window.deselectCanvasElement = function() {
        if (selectedCanvasElementId !== null) {
            selectedCanvasElementId = null;
            window.renderCanvasPortfolio();
        }
    };

    window.cycleElementSize = function(id, event) {
        if (event) event.stopPropagation();
        const items = getCanvasItems();
        const item = items.find(it => it.id === id);
        if (item) {
            const sizes = ['normal', 'compact', 'wide', 'full'];
            const currIdx = sizes.indexOf(item.size || 'normal');
            item.size = sizes[(currIdx + 1) % sizes.length];
            saveCanvasItems(items);
            window.renderCanvasPortfolio();
            if (window.showToast) window.showToast(`Element size: ${item.size}`, 'info');
        }
    };

    window.deleteSelectedCanvasElement = function(id, event) {
        if (event) event.stopPropagation();
        window.deleteCanvasItem(id);
        selectedCanvasElementId = null;
    };

    // ── Machub 4-Menu Radial Arc Engine (Parent & Nested Child Arcs) ──
    let activeArcToolId = null;
    let activeParentArcId = null;

    window.closeArcToolMenu = function() {
        activeArcToolId = null;
        activeParentArcId = null;
        const popover = document.getElementById('arcToolPopover');
        const backdrop = document.getElementById('arcPopoverBackdrop');
        const backBtn = document.getElementById('arcBackBtn');
        if (popover) popover.classList.remove('is-open');
        if (backdrop) backdrop.classList.add('hidden');
        if (backBtn) backBtn.classList.add('hidden');
    };

    window.returnToParentArc = function() {
        if (activeParentArcId) {
            window.toggleArcToolMenu(activeParentArcId, true);
        } else {
            window.closeArcToolMenu();
        }
    };

    window.toggleArcToolMenu = function(toolId, isBackNavigation) {
        const popover = document.getElementById('arcToolPopover');
        const backdrop = document.getElementById('arcPopoverBackdrop');
        const titleEl = document.getElementById('arcPopoverTitle');
        const gridEl = document.getElementById('arcPopoverGrid');
        const backBtn = document.getElementById('arcBackBtn');

        if (!popover || !gridEl) return;

        if (!isBackNavigation && activeArcToolId === toolId && popover.classList.contains('is-open')) {
            window.closeArcToolMenu();
            return;
        }

        if (['canvas', 'layout', 'design', 'manage'].includes(toolId)) {
            activeParentArcId = toolId;
            if (backBtn) backBtn.classList.add('hidden');
        } else {
            if (backBtn) backBtn.classList.remove('hidden');
        }

        activeArcToolId = toolId;
        let title = '';
        let itemsHtml = '';

        // ── 1. CANVAS MENU ──
        if (toolId === 'canvas') {
            title = '🎨 Canvas Elements';
            itemsHtml = `
                <button onclick="window.closeArcToolMenu(); window.addCanvasTextBlock();" class="arc-item-btn">
                    <span class="text-xl mb-1">📝</span>
                    <span>Text</span>
                </button>
                <button onclick="window.openChildArc('canvas_links');" class="arc-item-btn">
                    <span class="text-xl mb-1">🔗</span>
                    <span>Links ›</span>
                </button>
                <button onclick="window.closeArcToolMenu(); window.addCanvasSkillChips();" class="arc-item-btn">
                    <span class="text-xl mb-1">🏷️</span>
                    <span>Skills/Tags</span>
                </button>
                <button onclick="window.closeArcToolMenu(); window.addCanvasProjectCard();" class="arc-item-btn">
                    <span class="text-xl mb-1">💼</span>
                    <span>Projects</span>
                </button>
                <button onclick="window.closeArcToolMenu(); window.addCanvasImageCard();" class="arc-item-btn col-span-2">
                    <span class="text-xl mb-1">🖼️</span>
                    <span>Images</span>
                </button>
            `;
        } else if (toolId === 'canvas_links') {
            title = '🔗 Add Link Type';
            itemsHtml = `
                <button onclick="window.closeArcToolMenu(); window.addCanvasSocialLink('instagram');" class="arc-item-btn">
                    <span class="text-xl mb-1">📸</span>
                    <span>Instagram</span>
                </button>
                <button onclick="window.closeArcToolMenu(); window.addCanvasSocialLink('linkedin');" class="arc-item-btn">
                    <span class="text-xl mb-1">💼</span>
                    <span>LinkedIn</span>
                </button>
                <button onclick="window.closeArcToolMenu(); window.addCanvasSocialLink('github');" class="arc-item-btn">
                    <span class="text-xl mb-1">💻</span>
                    <span>GitHub</span>
                </button>
                <button onclick="window.closeArcToolMenu(); window.addCanvasLinkCard();" class="arc-item-btn col-span-3">
                    <span class="text-xl mb-1">🌐</span>
                    <span>Custom Website Link</span>
                </button>
            `;
        }
        // ── 2. LAYOUT MENU ──
        else if (toolId === 'layout') {
            title = '📐 Layout Organizers';
            itemsHtml = `
                <button onclick="window.closeArcToolMenu(); window.addCanvasSectionBlock();" class="arc-item-btn">
                    <span class="text-xl mb-1">📌</span>
                    <span>Sections</span>
                </button>
                <button onclick="window.closeArcToolMenu(); window.addCanvasColumnsBlock();" class="arc-item-btn">
                    <span class="text-xl mb-1">🏛️</span>
                    <span>2-Col Grid</span>
                </button>
                <button onclick="window.closeArcToolMenu(); window.addCanvasPageBreak();" class="arc-item-btn">
                    <span class="text-xl mb-1">📄</span>
                    <span>Page Break</span>
                </button>
            `;
        }
        // ── 3. DESIGN MENU ──
        else if (toolId === 'design') {
            title = '💎 Design Customization';
            itemsHtml = `
                <button onclick="window.openChildArc('design_font');" class="arc-item-btn">
                    <span class="text-xl mb-1">🔤</span>
                    <span>Font ›</span>
                </button>
                <button onclick="window.openChildArc('design_color');" class="arc-item-btn">
                    <span class="text-xl mb-1">🎨</span>
                    <span>Color ›</span>
                </button>
                <button onclick="window.closeArcToolMenu(); window.toggleSpacingDensity();" class="arc-item-btn">
                    <span class="text-xl mb-1">📏</span>
                    <span>Spacing</span>
                </button>
                <button onclick="window.closeArcToolMenu(); window.openAvatarPicker();" class="arc-item-btn">
                    <span class="text-xl mb-1">🖼️</span>
                    <span>Photo</span>
                </button>
                <button onclick="window.closeArcToolMenu(); window.openVisibilityPanel();" class="arc-item-btn col-span-2">
                    <span class="text-xl mb-1">👁️</span>
                    <span>Visibility Toggles</span>
                </button>
            `;
        } else if (toolId === 'design_font') {
            title = '🔤 Font Style Presets';
            itemsHtml = `
                <button onclick="window.setFontPairing('font-pair-apple');" class="arc-item-btn col-span-3">
                    <span class="text-sm font-bold mb-0.5">Apple SF Modern</span>
                    <span class="text-[9px] text-[#86868b]">Clean & Pro</span>
                </button>
                <button onclick="window.setFontPairing('font-pair-nothing');" class="arc-item-btn col-span-3">
                    <span class="text-sm font-bold mb-0.5 font-mono">Nothing Monospace</span>
                    <span class="text-[9px] text-[#86868b]">Tech Mono</span>
                </button>
                <button onclick="window.setFontPairing('font-pair-outfit');" class="arc-item-btn col-span-3">
                    <span class="text-sm font-bold mb-0.5" style="font-family: Outfit;">Outfit Grotesk</span>
                    <span class="text-[9px] text-[#86868b]">Modern Bold</span>
                </button>
            `;
        } else if (toolId === 'design_color') {
            title = '🎨 Accent Palette';
            const colors = [
                { hex: '#00F5D4', name: 'Teal' },
                { hex: '#0071E3', name: 'Blue' },
                { hex: '#FF2D55', name: 'Pink' },
                { hex: '#AF52DE', name: 'Purple' },
                { hex: '#FF9500', name: 'Orange' },
                { hex: '#34C759', name: 'Emerald' }
            ];
            itemsHtml = colors.map(c => `
                <button onclick="window.setAccentColor('${c.hex}');" class="arc-item-btn flex flex-col items-center gap-1">
                    <span class="color-swatch-pill" style="background:${c.hex};"></span>
                    <span class="text-[9px]">${c.name}</span>
                </button>
            `).join('');
        }
        // ── 4. MANAGE MENU ──
        else if (toolId === 'manage') {
            title = '⚙️ Manage & Housekeeping';
            itemsHtml = `
                <button onclick="window.closeArcToolMenu(); window.manageDeleteSection();" class="arc-item-btn text-red-400">
                    <span class="text-xl mb-1">🗑️</span>
                    <span>Delete Section</span>
                </button>
                <button onclick="window.closeArcToolMenu(); window.manageDuplicateSection();" class="arc-item-btn">
                    <span class="text-xl mb-1">📋</span>
                    <span>Duplicate</span>
                </button>
                <button onclick="window.closeArcToolMenu(); window.toggleReorderMode();" class="arc-item-btn">
                    <span class="text-xl mb-1">↕️</span>
                    <span>Reorder</span>
                </button>
                <button onclick="window.closeArcToolMenu(); window.manageResetTemplate();" class="arc-item-btn col-span-3 text-amber-400">
                    <span class="text-xl mb-1">🔄</span>
                    <span>Reset to Default Template</span>
                </button>
            `;
        }

        if (titleEl) titleEl.innerHTML = title;
        gridEl.innerHTML = itemsHtml;
        popover.classList.add('is-open');
        if (backdrop) backdrop.classList.remove('hidden');
    };

    window.openChildArc = function(childId) {
        window.toggleArcToolMenu(childId, true);
    };

    // Sub-tool Design & Manage Controllers
    window.setFontPairing = function(pairingClass) {
        const settings = getDesignSettings();
        settings.fontPairing = pairingClass;
        saveDesignSettings(settings);
        window.closeArcToolMenu();
        if (window.showToast) window.showToast('Font style updated!', 'success');
    };

    window.setAccentColor = function(colorHex) {
        const settings = getDesignSettings();
        settings.accentColor = colorHex;
        saveDesignSettings(settings);
        window.closeArcToolMenu();
        if (window.showToast) window.showToast('Accent color updated!', 'success');
    };

    window.toggleSpacingDensity = function() {
        const settings = getDesignSettings();
        settings.density = (settings.density === 'spacious') ? 'normal' : 'spacious';
        saveDesignSettings(settings);
        if (window.showToast) window.showToast(`Layout density: ${settings.density}`, 'info');
    };

    window.addCanvasProjectCard = function() {
        const title = prompt('Enter Project Title:', 'Portfolio App');
        if (!title) return;
        const link = prompt('Enter Project Link URL (optional):', 'https://github.com');
        
        const items = getCanvasItems();
        items.push({
            id: 'c_proj_' + Date.now(),
            type: 'link',
            title: '💼 ' + title.trim(),
            url: link ? link.trim() : '#'
        });
        saveCanvasItems(items);
        window.renderCanvasPortfolio();
        if (window.showToast) window.showToast('Project card added!', 'success');
    };

    window.addCanvasColumnsBlock = function() {
        const items = getCanvasItems();
        items.push({
            id: 'c_sec_' + Date.now(),
            type: 'section',
            title: '🏛️ Grid Section'
        });
        saveCanvasItems(items);
        window.renderCanvasPortfolio();
        if (window.showToast) window.showToast('2-Column Grid section added!', 'success');
    };

    window.addCanvasPageBreak = function() {
        const items = getCanvasItems();
        items.push({
            id: 'c_sec_' + Date.now(),
            type: 'section',
            title: '📄 Page Break Divider'
        });
        saveCanvasItems(items);
        window.renderCanvasPortfolio();
        if (window.showToast) window.showToast('Page break divider added!', 'success');
    };

    window.manageDeleteSection = function() {
        const items = getCanvasItems();
        const sections = items.filter(it => it.type === 'section');
        if (sections.length === 0) {
            if (window.showToast) window.showToast('No sections to delete.', 'info');
            return;
        }
        const title = prompt(`Select section to delete:\nAvailable: ${sections.map(s => s.title).join(', ')}`, sections[sections.length - 1].title);
        if (!title) return;
        if (confirm(`Are you sure you want to delete section "${title}"?`)) {
            const filtered = items.filter(it => !(it.type === 'section' && it.title.toLowerCase() === title.trim().toLowerCase()));
            saveCanvasItems(filtered);
            window.renderCanvasPortfolio();
            if (window.showToast) window.showToast('Section removed!', 'success');
        }
    };

    window.manageDuplicateSection = function() {
        const items = getCanvasItems();
        if (items.length === 0) return;
        const lastItem = { ...items[items.length - 1], id: 'c_dup_' + Date.now() };
        items.push(lastItem);
        saveCanvasItems(items);
        window.renderCanvasPortfolio();
        if (window.showToast) window.showToast('Item duplicated!', 'success');
    };

    window.toggleReorderMode = function() {
        if (window.showToast) window.showToast('Drag handles enabled! Touch & hold any element to reorder.', 'info');
    };

    window.manageResetTemplate = function() {
        if (confirm('Reset your portfolio canvas to default auto-generated state? This will clear custom text/links.')) {
            const adminNo = localStorage.getItem('machub_student_id') || 'default';
            localStorage.removeItem('machub_canvas_items_' + adminNo);
            window.renderCanvasPortfolio();
            if (window.showToast) window.showToast('Portfolio reset to default template!', 'success');
        }
    };

    window.toggleEditToolsMenu = function(force) {
        const addMenu = document.getElementById('canvasAddMenu');
        const arcMenu = document.getElementById('arcToolPopover');

        const isAddMenuOpen = addMenu && !addMenu.classList.contains('hidden');
        const isArcMenuOpen = arcMenu && !arcMenu.classList.contains('hidden') && arcMenu.classList.contains('is-open');

        if (typeof force === 'boolean') {
            if (force) {
                window.toggleCanvasAddMenu(true);
            } else {
                window.closeArcToolMenu();
                window.toggleCanvasAddMenu(false);
            }
        } else {
            if (isAddMenuOpen || isArcMenuOpen) {
                window.closeArcToolMenu();
                window.toggleCanvasAddMenu(false);
            } else {
                window.toggleCanvasAddMenu(true);
            }
        }
        if (window.updatePlusButtonState) window.updatePlusButtonState();
    };

    // ── Helper Subtool Handlers ──
    window.sendSelectedElementToBack = function() {
        if (!selectedCanvasElementId) return alert('Select an element first, then tap Back');
        const items = getCanvasItems();
        const idx = items.findIndex(it => it.id === selectedCanvasElementId);
        if (idx === -1) return;
        const [item] = items.splice(idx, 1);
        items.unshift(item);
        saveCanvasItems(items);
        window.renderCanvasPortfolio();
        if (window.showToast) window.showToast('Sent to back!', 'success');
    };

    window.alignCanvasItems = function() {
        const items = getCanvasItems();
        if (!items || items.length === 0) return;
        let currentY = 70;
        items.forEach((item) => {
            item.x = 60;
            item.y = currentY;
            currentY += item.h + 20;
        });
        saveCanvasItems(items);
        window.renderCanvasPortfolio();
        if (window.showToast) window.showToast('Canvas elements auto-aligned!', 'success');
    };

    let isSnapGridActive = false;
    window.toggleSnapGrid = function() {
        isSnapGridActive = !isSnapGridActive;
        const container = document.getElementById('profileCanvasContainer');
        if (container) container.classList.toggle('snap-grid-active', isSnapGridActive);
        if (window.showToast) window.showToast(`Snap grid ${isSnapGridActive ? 'Enabled' : 'Disabled'}`, 'info');
    };

    window.resetCanvasViewport = function() {
        canvasViewportState = { x: 0, y: 0, scale: 1 };
        window.renderCanvasPortfolio();
        if (window.showToast) window.showToast('Viewport reset to 100%', 'info');
    };

    let avatarBorderIndex = 0;
    const AVATAR_BORDERS = ['cyan', 'story', 'glass'];
    window.cycleAvatarBorder = function() {
        avatarBorderIndex = (avatarBorderIndex + 1) % AVATAR_BORDERS.length;
        const borderStyle = AVATAR_BORDERS[avatarBorderIndex];
        const ring = document.querySelector('.new-profile-avatar-ring');
        if (ring) {
            if (borderStyle === 'cyan') ring.style.background = 'linear-gradient(135deg, #00F5D4, #0071e3)';
            else if (borderStyle === 'story') ring.style.background = 'linear-gradient(45deg, #f09433, #e6683c 25%, #dc2743 50%, #cc2366 75%, #bc1888)';
            else ring.style.background = 'rgba(255, 255, 255, 0.2)';
        }
        if (window.showToast) window.showToast(`Avatar border: ${borderStyle}`, 'info');
    };

    let currentCanvasPage = 1;
    window.toggleMultiPageMode = function() {
        currentCanvasPage = (currentCanvasPage === 1 ? 2 : 1);
        if (window.showToast) window.showToast(`Switched to Portfolio Page ${currentCanvasPage}`, 'success');
        window.renderCanvasPortfolio();
    };

    let currentShadowStyleIndex = 0;
    const SHADOW_STYLES = [
        { key: 'ambient', label: 'Ambient Soft', css: '0 14px 34px -12px rgba(0,0,0,0.65), 0 2px 8px rgba(0,0,0,0.25)' },
        { key: 'liquid', label: 'Liquid Sheen', css: '0 20px 48px -10px rgba(0,245,212,0.25), 0 0 1px inset rgba(255,255,255,0.4)' },
        { key: 'deep', label: 'Deep Floating', css: '0 30px 60px -15px rgba(0,0,0,0.9), 0 4px 16px rgba(0,0,0,0.5)' },
        { key: 'flat', label: 'Flat Minimal', css: '0 2px 6px rgba(0,0,0,0.3)' }
    ];
    window.cycleShadowDepth = function() {
        currentShadowStyleIndex = (currentShadowStyleIndex + 1) % SHADOW_STYLES.length;
        const shadow = SHADOW_STYLES[currentShadowStyleIndex];
        if (window.showToast) window.showToast(`Card Shadow: ${shadow.label}`, 'info');
        window.renderCanvasPortfolio();
    };

    let isCanvasThemeLight = false;
    window.toggleCanvasTheme = function() {
        isCanvasThemeLight = !isCanvasThemeLight;
        const container = document.getElementById('profileCanvasContainer');
        const view = document.getElementById('view-profile');
        if (container && view) {
            if (isCanvasThemeLight) {
                view.style.background = '#F4F5F8';
                view.style.color = '#121319';
                container.classList.add('theme-light-surface');
            } else {
                view.style.background = '#0D0E12';
                view.style.color = '#F5F5F7';
                container.classList.remove('theme-light-surface');
            }
        }
        if (window.showToast) window.showToast(`Canvas Theme: ${isCanvasThemeLight ? 'Paper Light ☀️' : 'Midnight Dark 🌙'}`, 'info');
    };

    window.forceCloudSync = async function() {
        const adminNo = localStorage.getItem('machub_student_id') || '';
        if (!adminNo) return alert('Log in or set Admission Number first');
        const items = getCanvasItems();
        if (window.syncCanvasToCloud) {
            await window.syncCanvasToCloud(adminNo, items);
            if (window.showToast) window.showToast('Canvas synced to Firestore Cloud! ☁️', 'success');
        }
    };

    // ── Geometric 180° Half-Circle Radial Menu Engine (5 Subtools Per Menu) ──
    const RADIAL_MENUS = {
        canvas: [
            { key: "text", icon: "➕", label: "Text" },
            { key: "links", icon: "🔗", label: "Links" },
            { key: "photo", icon: "🖼️", label: "Photo" },
            { key: "markcard", icon: "📊", label: "Marks" },
            { key: "align", icon: "✨", label: "Align" }
        ],
        layout: [
            { key: "section", icon: "▭", label: "Section" },
            { key: "columns", icon: "❘❘", label: "Columns" },
            { key: "pages", icon: "▤", label: "Pages" },
            { key: "snap", icon: "📐", label: "Snap Grid" },
            { key: "resetview", icon: "🔍", label: "Reset View" }
        ],
        design: [
            { key: "font", icon: "Aa", label: "Font" },
            { key: "color", icon: "◐", label: "Color" },
            { key: "shadow", icon: "↕", label: "Shadow" },
            { key: "theme", icon: "🎨", label: "Theme" },
            { key: "avatarborder", icon: "🖼️", label: "Avatar" }
        ],
        manage: [
            { key: "duplicate", icon: "⧉", label: "Duplicate" },
            { key: "front", icon: "⇡", label: "Front" },
            { key: "back", icon: "⇣", label: "Back" },
            { key: "sync", icon: "☁️", label: "Sync Cloud" },
            { key: "reset", icon: "↺", label: "Reset All" }
        ]
    };

    let activeRadialMenuKey = null;

    window.closeSecondaryArcMenu = function() {
        const secPopover = document.getElementById('secondaryArcToolPopover');
        if (secPopover) {
            secPopover.classList.add('hidden');
            const secGrid = document.getElementById('secondaryArcPopoverGrid');
            if (secGrid) secGrid.innerHTML = '';
        }
    };

    window.closeArcToolMenu = function() {
        activeRadialMenuKey = null;
        window.closeSecondaryArcMenu();
        const popover = document.getElementById('arcToolPopover');
        const backdrop = document.getElementById('arcPopoverBackdrop');
        const gridEl = document.getElementById('arcPopoverGrid');
        if (popover) {
            popover.classList.add('hidden');
            popover.classList.remove('is-open');
        }
        if (gridEl) gridEl.innerHTML = '';
        if (backdrop) backdrop.classList.add('hidden');
        if (window.updatePlusButtonState) window.updatePlusButtonState();
    };

    window.toggleCanvasAddMenu = function(force) {
        window.toggleArcToolMenu('canvas');
    };

    window.toggleEditToolsMenu = function(force) {
        const arcMenu = document.getElementById('arcToolPopover');
        const isArcMenuOpen = arcMenu && !arcMenu.classList.contains('hidden') && arcMenu.classList.contains('is-open');

        if (typeof force === 'boolean') {
            if (force) {
                window.toggleArcToolMenu(activeRadialMenuKey || 'canvas');
            } else {
                window.closeArcToolMenu();
            }
        } else {
            if (isArcMenuOpen) {
                window.closeArcToolMenu();
            } else {
                window.toggleArcToolMenu(activeRadialMenuKey || 'canvas');
            }
        }
    };

    window.addCanvasElement = function(type) {
        const items = getCanvasItems();
        const id = type + '_' + Date.now();
        const base = { id, type, x: 60, y: 120, w: 240, h: 140 };
        const withContent =
            type === "text" ? { ...base, variant: "tagline", content: "New text block" } :
            type === "links" ? { ...base, items: [{ label: "Link", handle: "@username" }] } :
            type === "photo" ? { ...base, w: 200, h: 240, url: "" } :
            type === "markcard" ? { ...base, subject: "Subject", score: "0", total: "50" } :
            type === "section" ? { ...base, w: 320, h: 60, title: "New Section" } :
            base;
        items.push(withContent);
        saveCanvasItems(items);
        selectedCanvasElementId = id;
        window.closeArcToolMenu();
        window.renderCanvasPortfolio();
        if (window.editCanvasElementContent) window.editCanvasElementContent(id);
        if (window.showToast) window.showToast(`${type} added to canvas!`, 'success');
    };

    window.duplicateSelectedCanvasElement = function() {
        if (!selectedCanvasElementId) return alert('Select an element first, then tap Duplicate');
        const items = getCanvasItems();
        const selected = items.find(it => it.id === selectedCanvasElementId);
        if (!selected) return;
        const newId = selected.type + '_' + Date.now();
        const newItem = { ...selected, id: newId, x: selected.x + 24, y: selected.y + 24 };
        items.push(newItem);
        saveCanvasItems(items);
        selectedCanvasElementId = newId;
        window.renderCanvasPortfolio();
        if (window.showToast) window.showToast('Element duplicated!', 'success');
    };

    window.bringSelectedElementToFront = function() {
        if (!selectedCanvasElementId) return alert('Select an element first, then tap Front');
        const items = getCanvasItems();
        const idx = items.findIndex(it => it.id === selectedCanvasElementId);
        if (idx === -1) return;
        const [item] = items.splice(idx, 1);
        items.push(item);
        saveCanvasItems(items);
        window.renderCanvasPortfolio();
        if (window.showToast) window.showToast('Brought to front!', 'success');
    };

    window.expandSelectedElementSize = function() {
        if (!selectedCanvasElementId) return alert('Select an element first to adjust spacing');
        const items = getCanvasItems();
        const item = items.find(it => it.id === selectedCanvasElementId);
        if (item) {
            item.w += 20;
            item.h += 10;
            saveCanvasItems(items);
            window.renderCanvasPortfolio();
            if (window.showToast) window.showToast('Dimensions expanded!', 'info');
        }
    };

    const CHILD_RADIAL_MENUS = {
        'design:color': {
            title: 'Select Color Accent',
            items: [
                { key: 'back', label: 'Back', icon: '‹', isBack: true },
                { key: '#FF2D55', label: 'Red', icon: '●', color: '#FF2D55' },
                { key: '#FFD60A', label: 'Yellow', icon: '●', color: '#FFD60A' },
                { key: '#34C759', label: 'Green', icon: '●', color: '#34C759' },
                { key: '#00F5D4', label: 'Cyan', icon: '●', color: '#00F5D4' },
                { key: '#0071E3', label: 'Blue', icon: '●', color: '#0071E3' },
                { key: '#FF9500', label: 'Orange', icon: '●', color: '#FF9500' },
                { key: '#AF52DE', label: 'Purple', icon: '●', color: '#AF52DE' },
                { key: '#F5F5F7', label: 'White', icon: '●', color: '#F5F5F7' },
                { key: '#181920', label: 'Dark', icon: '●', color: '#181920' }
            ]
        },
        'design:font': {
            title: 'Select Typography Font',
            items: [
                { key: 'back', label: 'Back', icon: '‹', isBack: true },
                { key: 'Archivo', label: 'Archivo', icon: 'Aa' },
                { key: 'JetBrains Mono', label: 'Mono', icon: '⌥' },
                { key: 'Archivo Expanded', label: 'Expanded', icon: 'Aa' },
                { key: 'Inter', label: 'Inter', icon: 'T' },
                { key: 'Space Grotesk', label: 'Space', icon: '⚡' }
            ]
        },
        'design:shadow': {
            title: 'Select Card Shadow',
            items: [
                { key: 'back', label: 'Back', icon: '‹', isBack: true },
                { key: '0 18px 40px -12px rgba(0,245,212,0.35)', label: 'Cyan Glow', icon: '✨' },
                { key: '0 24px 60px -15px rgba(0,0,0,0.85)', label: 'Deep Dark', icon: '🌑' },
                { key: '0 4px 14px rgba(0,0,0,0.4)', label: 'Soft', icon: '☁️' },
                { key: '0 0 25px rgba(0,113,227,0.5)', label: 'Neon Blue', icon: '💡' },
                { key: 'none', label: 'Flat', icon: '▫️' }
            ]
        },
        'design:theme': {
            title: 'Select Card Tone',
            items: [
                { key: 'back', label: 'Back', icon: '‹', isBack: true },
                { key: '#181920', label: 'Dark Slate', icon: '⬛' },
                { key: '#0D0E12', label: 'Midnight', icon: '▪️' },
                { key: '#1E202B', label: 'Navy Blue', icon: '🟦' },
                { key: '#2A2C38', label: 'Charcoal', icon: '🩶' },
                { key: 'transparent', label: 'Glass', icon: '🔲' }
            ]
        },
        'design:avatarborder': {
            title: 'Select Border Radius',
            items: [
                { key: 'back', label: 'Back', icon: '‹', isBack: true },
                { key: '20', label: '20px Round', icon: '▢' },
                { key: '28', label: '28px Round', icon: '◯' },
                { key: '36', label: '36px Pill', icon: '💊' },
                { key: '12', label: '12px Small', icon: '▫️' },
                { key: '0', label: '0px Sharp', icon: '▭' }
            ]
        },
        'canvas:text': {
            title: 'Add Text Card Style',
            items: [
                { key: 'back', label: 'Back', icon: '‹', isBack: true },
                { key: 'display', label: 'Header Title', icon: 'H1' },
                { key: 'tagline', label: 'Body Subtitle', icon: '¶' }
            ]
        },
        'canvas:links': {
            title: 'Add Social Badge',
            items: [
                { key: 'back', label: 'Back', icon: '‹', isBack: true },
                { key: 'instagram', label: 'Instagram', icon: '📸' },
                { key: 'github', label: 'GitHub', icon: '🐙' },
                { key: 'linkedin', label: 'LinkedIn', icon: '💼' },
                { key: 'portfolio', label: 'Portfolio', icon: '🌐' }
            ]
        },
        'canvas:photo': {
            title: 'Add Photo Card',
            items: [
                { key: 'back', label: 'Back', icon: '‹', isBack: true },
                { key: 'portrait', label: 'Portrait Avatar', icon: '🖼️' },
                { key: 'banner', label: 'Banner Showcase', icon: '🏞️' }
            ]
        },
        'canvas:markcard': {
            title: 'Add Score Card',
            items: [
                { key: 'back', label: 'Back', icon: '‹', isBack: true },
                { key: 'exam', label: 'Exam 48/50', icon: '📝' },
                { key: 'sgpa', label: 'SGPA 9.2/10', icon: '🎓' }
            ]
        },
        'layout:section': {
            title: 'Add Section Divider',
            items: [
                { key: 'back', label: 'Back', icon: '‹', isBack: true },
                { key: 'About Me', label: 'About Me', icon: '📌' },
                { key: 'Featured Projects', label: 'Projects', icon: '🚀' },
                { key: 'Academic Scores', label: 'Marks', icon: '📊' },
                { key: 'Technical Skills', label: 'Skills', icon: '⚡' }
            ]
        }
    };

    window.openSecondaryMiniArcMenu = function(menuKey, itemKey, btnX, btnY) {
        const secPopover = document.getElementById('secondaryArcToolPopover');
        const secGrid = document.getElementById('secondaryArcPopoverGrid');
        if (!secPopover || !secGrid) return;

        const childMenuKey = menuKey + ':' + itemKey;
        const childObj = CHILD_RADIAL_MENUS[childMenuKey];
        if (!childObj) return;

        if (!secPopover.classList.contains('hidden') && secPopover.getAttribute('data-active-key') === childMenuKey) {
            window.closeSecondaryArcMenu();
            return;
        }

        secPopover.setAttribute('data-active-key', childMenuKey);
        const items = childObj.items.filter(it => !it.isBack);
        const radius = 95;
        const count = items.length;

        const startAngle = Math.PI * 1.15;
        const endAngle = -Math.PI * 0.15;
        const angleStep = count > 1 ? (startAngle - endAngle) / (count - 1) : 0;

        let itemsHtml = items.map((item, i) => {
            const angle = startAngle - i * angleStep;
            const tx = Math.cos(angle) * radius;
            const ty = -Math.sin(angle) * radius;
            const delay = i * 25;
            const isColor = !!item.color;

            const iconContent = isColor ?
                `<div style="width:24px; height:24px; border-radius:50%; background:${item.color}; border:2px solid #FFF; box-shadow:0 0 10px ${item.color};"></div>` :
                `<span style="font-size:18px; pointer-events:none;">${item.icon}</span>`;

            return `
                <button type="button"
                    onpointerdown="event.stopPropagation(); window.applySubtoolOption('${menuKey}', '${itemKey}', '${item.key}'); window.closeArcToolMenu();"
                    onclick="event.stopPropagation(); window.applySubtoolOption('${menuKey}', '${itemKey}', '${item.key}'); window.closeArcToolMenu();"
                    style="position:fixed; left:${btnX}px; top:${btnY}px; transform:translate(-50%, -50%) translate(${tx}px, ${ty}px); width:64px; height:64px; border-radius:50%; background:#14151C; border:1.5px solid #00F5D4; box-shadow:0 14px 32px -6px rgba(0,0,0,0.9), 0 0 20px rgba(0,245,212,0.4); display:flex; flex-direction:column; align-items:center; justify-content:center; gap:2px; cursor:pointer; font-family:'Archivo', sans-serif; font-size:9px; font-weight:700; color:#F5F5F7; pointer-events:auto; animation:secondaryArcIn 0.25s cubic-bezier(0.2,0.8,0.2,1) both; animation-delay:${delay}ms; z-index:1003;" class="spring active:scale-95">
                    ${iconContent}
                    <span style="pointer-events:none; font-size:8.5px; text-transform:uppercase; letter-spacing:0.03em;">${item.label}</span>
                </button>
            `;
        }).join('');

        secGrid.innerHTML = itemsHtml;
        secPopover.classList.remove('hidden');
    };

    window.toggleArcToolMenu = function(menuKey, subKey) {
        const popover = document.getElementById('arcToolPopover');
        const backdrop = document.getElementById('arcPopoverBackdrop');
        const gridEl = document.getElementById('arcPopoverGrid');

        if (!popover || !gridEl) return;

        const fullKey = subKey ? (menuKey + ':' + subKey) : menuKey;

        if (activeRadialMenuKey === fullKey && !popover.classList.contains('hidden')) {
            window.closeArcToolMenu();
            return;
        }

        activeRadialMenuKey = fullKey;
        const childMenuObj = CHILD_RADIAL_MENUS[fullKey];
        const items = childMenuObj ? childMenuObj.items : (RADIAL_MENUS[menuKey] || []);

        const NAV_BAR_HEIGHT = 78;
        const ARC_CLEARANCE = 40;
        const originY = window.innerHeight - NAV_BAR_HEIGHT - ARC_CLEARANCE;
        const originX = window.innerWidth / 2;
        const radius = clamp(window.innerWidth * 0.32, 90, 135);
        const count = items.length;
        const angleStep = count > 1 ? Math.PI / (count - 1) : 0;

        let itemsHtml = items.map((item, i) => {
            const angle = Math.PI - i * angleStep;
            const tx = Math.cos(angle) * radius;
            const ty = -Math.sin(angle) * radius;
            const delay = i * 25;
            const isColor = !!item.color;

            const iconContent = isColor ? `<div style="width:22px; height:22px; border-radius:50%; background:${item.color}; border:1.5px solid #FFF; box-shadow:0 0 8px ${item.color};"></div>` : `<span style="font-size:20px; pointer-events:none;">${item.icon}</span>`;

            return `
                <button type="button" onpointerdown="event.stopPropagation(); window.handleRadialPick('${menuKey}', '${item.key}', '${subKey || ''}', event);" onclick="event.stopPropagation(); window.handleRadialPick('${menuKey}', '${item.key}', '${subKey || ''}', event);"
                    style="position:fixed; left:${originX}px; top:${originY}px; transform:translate(-50%, -50%) translate(${tx}px, ${ty}px); width:74px; height:74px; border-radius:50%; background:${item.isBack ? '#252631' : '#181920'}; border:1.5px solid ${item.isBack ? 'rgba(255,255,255,0.4)' : 'rgba(0,245,212,0.5)'}; box-shadow:0 16px 36px -10px rgba(0,0,0,0.85), 0 0 20px rgba(0,245,212,0.3); display:flex; flex-direction:column; align-items:center; justify-content:center; gap:3px; cursor:pointer; font-family:'Archivo', sans-serif; font-size:10px; font-weight:700; color:#F5F5F7; pointer-events:auto; animation:arcIn 0.25s cubic-bezier(0.2,0.8,0.2,1) both; animation-delay:${delay}ms; z-index:1001;" class="spring active:scale-95">
                    ${iconContent}
                    <span style="pointer-events:none; font-size:9px; text-transform:uppercase; letter-spacing:0.04em;">${item.label}</span>
                </button>
            `;
        }).join('');

        gridEl.innerHTML = itemsHtml;
        popover.classList.remove('hidden');
        popover.classList.add('is-open');
        if (backdrop) backdrop.classList.remove('hidden');
        if (window.updatePlusButtonState) window.updatePlusButtonState();
    };

    window.openSubtoolOptionsDrawer = function(menuKey, itemKey) {
        const items = getCanvasItems();
        const selectedItem = selectedCanvasElementId ? items.find(it => it.id === selectedCanvasElementId) : null;

        let drawer = document.getElementById('subtoolOptionsPopover');
        if (drawer) drawer.remove();

        drawer = document.createElement('div');
        drawer.id = 'subtoolOptionsPopover';
        drawer.style.cssText = `
            position: fixed; bottom: 100px; left: 50%; transform: translateX(-50%); z-index: 10000;
            width: calc(100% - 32px); max-width: 420px; max-height: 70vh; overflow-y: auto;
            background: rgba(18, 19, 26, 0.98); backdrop-filter: blur(28px); -webkit-backdrop-filter: blur(28px);
            border: 1.5px solid rgba(0, 245, 212, 0.35); border-radius: 24px; padding: 18px;
            box-shadow: 0 24px 60px rgba(0,0,0,0.9), 0 0 35px rgba(0,245,212,0.25);
            font-family: 'Archivo', sans-serif; color: #F5F5F7; pointer-events: auto; animation: springUp 0.3s cubic-bezier(0.2,0.8,0.2,1);
        `;
        document.body.appendChild(drawer);

        let title = '';
        let contentHtml = '';

        if (menuKey === 'design') {
            if (itemKey === 'color') {
                title = 'Select Color Accent ' + (selectedItem ? '(Selected Card)' : '(Global)');
                const colors = [
                    { hex: '#00F5D4', name: 'Cyan' },
                    { hex: '#0071E3', name: 'Blue' },
                    { hex: '#FF2D55', name: 'Pink' },
                    { hex: '#FF9500', name: 'Orange' },
                    { hex: '#AF52DE', name: 'Purple' },
                    { hex: '#34C759', name: 'Emerald' },
                    { hex: '#FFD60A', name: 'Gold' },
                    { hex: '#F5F5F7', name: 'White' },
                    { hex: '#181920', name: 'Dark' }
                ];
                contentHtml = `
                    <div style="display:grid; grid-template-columns: repeat(5, 1fr); gap:10px; margin-top:12px;">
                        ${colors.map(c => `
                            <button onclick="window.applySubtoolOption('design', 'color', '${c.hex}')" style="display:flex; flex-direction:column; align-items:center; gap:6px; background:transparent; border:none; cursor:pointer;" class="spring active:scale-95">
                                <div style="width:38px; height:38px; border-radius:50%; background:${c.hex}; border:2px solid ${selectedItem && selectedItem.accentColor === c.hex ? '#FFF' : 'rgba(255,255,255,0.2)'}; box-shadow:0 4px 12px rgba(0,0,0,0.4); display:flex; align-items:center; justify-content:center; font-size:12px;">
                                    ${selectedItem && selectedItem.accentColor === c.hex ? '✓' : ''}
                                </div>
                                <span style="font-size:9px; font-weight:600; color:rgba(245,245,247,0.7); text-align:center;">${c.name}</span>
                            </button>
                        `).join('')}
                    </div>
                `;
            } else if (itemKey === 'font') {
                title = 'Select Typography Font ' + (selectedItem ? '(Selected Card)' : '(Global)');
                const fonts = [
                    { id: 'Archivo', label: 'Archivo Clean' },
                    { id: 'JetBrains Mono', label: 'JetBrains Code Mono' },
                    { id: 'Archivo Expanded', label: 'Archivo Bold Expanded' },
                    { id: 'Inter', label: 'Inter Swiss' },
                    { id: 'Space Grotesk', label: 'Space Grotesk Tech' }
                ];
                contentHtml = `
                    <div style="display:flex; flex-direction:column; gap:8px; margin-top:12px;">
                        ${fonts.map(f => `
                            <button onclick="window.applySubtoolOption('design', 'font', '${f.id}')" style="width:100%; padding:10px 14px; border-radius:14px; background:${selectedItem && selectedItem.fontFamily === f.id ? 'rgba(0,245,212,0.15)' : 'rgba(255,255,255,0.05)'}; border:1px solid ${selectedItem && selectedItem.fontFamily === f.id ? '#00F5D4' : 'rgba(255,255,255,0.1)'}; color:#F5F5F7; font-family:'${f.id}', sans-serif; font-size:13px; text-align:left; cursor:pointer; display:flex; justify-content:space-between; align-items:center;" class="spring active:scale-98">
                                <span>${f.label}</span>
                                <span style="font-size:11px; opacity:0.6;">Aa Bb 123</span>
                            </button>
                        `).join('')}
                    </div>
                `;
            } else if (itemKey === 'shadow') {
                title = 'Select Shadow Glow Depth ' + (selectedItem ? '(Selected Card)' : '(Global)');
                const shadows = [
                    { id: 'cyan_glow', label: 'Cyan Aura Glow', css: '0 18px 40px -12px rgba(0,245,212,0.35)' },
                    { id: 'deep_dark', label: 'Deep Dark Sheen', css: '0 24px 60px -15px rgba(0,0,0,0.85)' },
                    { id: 'soft_minimal', label: 'Soft Minimal Ambient', css: '0 4px 14px rgba(0,0,0,0.4)' },
                    { id: 'neon_aura', label: 'Neon Blue Sheen', css: '0 0 25px rgba(0,113,227,0.5)' },
                    { id: 'flat_none', label: 'Flat Minimal (No Shadow)', css: 'none' }
                ];
                contentHtml = `
                    <div style="display:flex; flex-direction:column; gap:8px; margin-top:12px;">
                        ${shadows.map(s => `
                            <button onclick="window.applySubtoolOption('design', 'shadow', '${s.css}')" style="width:100%; padding:10px 14px; border-radius:14px; background:rgba(255,255,255,0.05); border:1px solid rgba(255,255,255,0.1); color:#F5F5F7; font-size:12px; font-weight:600; text-align:left; cursor:pointer; box-shadow:${s.css};" class="spring active:scale-98">
                                ${s.label}
                            </button>
                        `).join('')}
                    </div>
                `;
            } else if (itemKey === 'theme') {
                title = 'Select Card Background Tone ' + (selectedItem ? '(Selected Card)' : '(Global)');
                const bgs = [
                    { hex: '#181920', label: 'Dark Slate Glass' },
                    { hex: '#0D0E12', label: 'Midnight Pitch Black' },
                    { hex: '#1E202B', label: 'Deep Navy Blue' },
                    { hex: '#2A2C38', label: 'Charcoal Sheen' },
                    { hex: '#FFFFFF', label: 'Paper White' },
                    { hex: 'transparent', label: 'Transparent Glass' }
                ];
                contentHtml = `
                    <div style="display:grid; grid-template-columns:1fr 1fr; gap:8px; margin-top:12px;">
                        ${bgs.map(b => `
                            <button onclick="window.applySubtoolOption('design', 'theme', '${b.hex}')" style="padding:10px; border-radius:14px; background:${b.hex === 'transparent' ? 'rgba(255,255,255,0.05)' : b.hex}; border:1px solid rgba(255,255,255,0.15); color:${b.hex === '#FFFFFF' ? '#000' : '#F5F5F7'}; font-size:11px; font-weight:600; text-align:center; cursor:pointer;" class="spring active:scale-95">
                                ${b.label}
                            </button>
                        `).join('')}
                    </div>
                `;
            } else if (itemKey === 'avatarborder') {
                title = 'Select Border Radius ' + (selectedItem ? '(Selected Card)' : '(Global)');
                const radii = [
                    { val: 20, label: 'Standard Round (20px)' },
                    { val: 28, label: 'Super Round (28px)' },
                    { val: 36, label: 'Pill Round (36px)' },
                    { val: 12, label: 'Compact Round (12px)' },
                    { val: 0, label: 'Sharp Corner (0px)' }
                ];
                contentHtml = `
                    <div style="display:flex; flex-direction:column; gap:8px; margin-top:12px;">
                        ${radii.map(r => `
                            <button onclick="window.applySubtoolOption('design', 'avatarborder', ${r.val})" style="width:100%; padding:10px 14px; border-radius:${r.val}px; background:rgba(255,255,255,0.08); border:1.5px solid #00F5D4; color:#F5F5F7; font-size:12px; font-weight:600; text-align:center; cursor:pointer;" class="spring active:scale-98">
                                ${r.label}
                            </button>
                        `).join('')}
                    </div>
                `;
            }
        } else if (menuKey === 'canvas') {
            if (itemKey === 'text') {
                title = 'Add Text Card Style';
                contentHtml = `
                    <div style="display:grid; grid-template-columns:1fr 1fr; gap:8px; margin-top:12px;">
                        <button onclick="window.addCanvasElementPreset('text', { variant:'display', content:'HEADER TITLE' })" style="padding:12px; border-radius:14px; background:rgba(255,255,255,0.05); border:1px solid rgba(255,255,255,0.1); color:#F5F5F7; text-align:left; cursor:pointer;" class="spring active:scale-95">
                            <div style="font-weight:800; font-size:16px;">Header Display</div>
                            <div style="font-size:10px; opacity:0.5; margin-top:2px;">Large bold headline</div>
                        </button>
                        <button onclick="window.addCanvasElementPreset('text', { variant:'tagline', content:'Subtitle tagline or bio note...' })" style="padding:12px; border-radius:14px; background:rgba(255,255,255,0.05); border:1px solid rgba(255,255,255,0.1); color:#F5F5F7; text-align:left; cursor:pointer;" class="spring active:scale-95">
                            <div style="font-weight:600; font-size:13px;">Body Subtitle</div>
                            <div style="font-size:10px; opacity:0.5; margin-top:2px;">Bio, tagline or paragraph</div>
                        </button>
                    </div>
                `;
            } else if (itemKey === 'links') {
                title = 'Add Social Link Badge';
                const presets = [
                    { label: 'Instagram', handle: '@username' },
                    { label: 'GitHub', handle: 'github.com/user' },
                    { label: 'LinkedIn', handle: 'linkedin.com/in/user' },
                    { label: 'Portfolio', handle: 'mywebsite.app' }
                ];
                contentHtml = `
                    <div style="display:grid; grid-template-columns:1fr 1fr; gap:8px; margin-top:12px;">
                        ${presets.map(p => `
                            <button onclick="window.addCanvasElementPreset('links', { items: [{ label:'${p.label}', handle:'${p.handle}' }] })" style="padding:10px 12px; border-radius:14px; background:rgba(255,255,255,0.05); border:1px solid rgba(255,255,255,0.1); color:#F5F5F7; text-align:left; cursor:pointer;" class="spring active:scale-95">
                                <div style="font-size:12px; font-weight:700; color:#00F5D4;">${p.label}</div>
                                <div style="font-size:10px; opacity:0.6;">${p.handle}</div>
                            </button>
                        `).join('')}
                    </div>
                `;
            } else if (itemKey === 'photo') {
                title = 'Add Photo Card';
                contentHtml = `
                    <div style="display:grid; grid-template-columns:1fr 1fr; gap:8px; margin-top:12px;">
                        <button onclick="window.addCanvasElementPreset('photo', { url:'https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&w=400&q=80' })" style="padding:10px 12px; border-radius:14px; background:rgba(255,255,255,0.05); border:1px solid rgba(255,255,255,0.1); color:#F5F5F7; text-align:left; cursor:pointer;" class="spring active:scale-95">
                            <div style="font-size:12px; font-weight:700; color:#00F5D4;">🖼️ Portrait Avatar</div>
                            <div style="font-size:10px; opacity:0.6;">Profile portrait picture</div>
                        </button>
                        <button onclick="window.addCanvasElementPreset('photo', { url:'https://images.unsplash.com/photo-1618005182384-a83a8bd57fbe?auto=format&fit=crop&w=600&q=80', w:300, h:160 })" style="padding:10px 12px; border-radius:14px; background:rgba(255,255,255,0.05); border:1px solid rgba(255,255,255,0.1); color:#F5F5F7; text-align:left; cursor:pointer;" class="spring active:scale-95">
                            <div style="font-size:12px; font-weight:700; color:#00F5D4;">🏞️ Banner Showcase</div>
                            <div style="font-size:10px; opacity:0.6;">Wide landscape photo</div>
                        </button>
                    </div>
                `;
            } else if (itemKey === 'markcard') {
                title = 'Add Exam / Academic Score Card';
                contentHtml = `
                    <div style="display:grid; grid-template-columns:1fr 1fr; gap:8px; margin-top:12px;">
                        <button onclick="window.addCanvasElementPreset('markcard', { subject:'Internal Exam', score:'48', total:'50' })" style="padding:10px 12px; border-radius:14px; background:rgba(255,255,255,0.05); border:1px solid rgba(255,255,255,0.1); color:#F5F5F7; text-align:left; cursor:pointer;" class="spring active:scale-95">
                            <div style="font-size:12px; font-weight:700;">Internal Exam</div>
                            <div style="font-size:14px; color:#00F5D4; font-family:'JetBrains Mono';">48/50</div>
                        </button>
                        <button onclick="window.addCanvasElementPreset('markcard', { subject:'Semester SGPA', score:'9.2', total:'10' })" style="padding:10px 12px; border-radius:14px; background:rgba(255,255,255,0.05); border:1px solid rgba(255,255,255,0.1); color:#F5F5F7; text-align:left; cursor:pointer;" class="spring active:scale-95">
                            <div style="font-size:12px; font-weight:700;">Semester SGPA</div>
                            <div style="font-size:14px; color:#00F5D4; font-family:'JetBrains Mono';">9.2/10</div>
                        </button>
                    </div>
                `;
            } else if (itemKey === 'align') {
                title = 'Canvas Alignment Presets';
                contentHtml = `
                    <div style="display:flex; flex-direction:column; gap:8px; margin-top:12px;">
                        <button onclick="window.alignCanvasItems(); document.getElementById('subtoolOptionsPopover').remove();" style="padding:12px 14px; border-radius:14px; background:rgba(0,245,212,0.15); border:1px solid #00F5D4; color:#F5F5F7; font-size:12px; font-weight:700; cursor:pointer; text-align:left;" class="spring active:scale-98">✨ Auto-Stack Vertical Alignment</button>
                    </div>
                `;
            }
        } else if (menuKey === 'layout') {
            if (itemKey === 'section') {
                title = 'Add Section Header Divider';
                const sections = ['About Me', 'Featured Projects', 'Academic Scores', 'Technical Skills', 'Certifications & Honors'];
                contentHtml = `
                    <div style="display:flex; flex-direction:column; gap:8px; margin-top:12px;">
                        ${sections.map(sec => `
                            <button onclick="window.addCanvasElementPreset('section', { title:'${sec}', w:320, h:60 })" style="padding:10px 14px; border-radius:14px; background:rgba(255,255,255,0.05); border:1px solid rgba(255,255,255,0.1); color:#00F5D4; font-weight:700; font-size:12px; text-align:left; cursor:pointer;" class="spring active:scale-98">
                                📌 ${sec}
                            </button>
                        `).join('')}
                    </div>
                `;
            } else if (itemKey === 'columns') {
                title = 'Column Layout Presets';
                contentHtml = `
                    <div style="display:grid; grid-template-columns:1fr 1fr; gap:8px; margin-top:12px;">
                        <button onclick="window.addCanvasElementPreset('section', { title:'Left Column Deck', w:160, h:200 }); document.getElementById('subtoolOptionsPopover').remove();" style="padding:12px; border-radius:14px; background:rgba(255,255,255,0.05); border:1px solid rgba(255,255,255,0.1); color:#F5F5F7; font-size:12px; font-weight:700; cursor:pointer;">❘ 1-Column Deck</button>
                        <button onclick="window.addCanvasElementPreset('section', { title:'Dual Grid Deck', w:320, h:200 }); document.getElementById('subtoolOptionsPopover').remove();" style="padding:12px; border-radius:14px; background:rgba(0,245,212,0.15); border:1px solid #00F5D4; color:#F5F5F7; font-size:12px; font-weight:700; cursor:pointer;">❘❘ Dual Grid Deck</button>
                    </div>
                `;
            } else if (itemKey === 'pages') {
                title = 'Portfolio Page Navigator';
                contentHtml = `
                    <div style="display:grid; grid-template-columns:1fr 1fr; gap:8px; margin-top:12px;">
                        <button onclick="window.toggleMultiPageMode(); document.getElementById('subtoolOptionsPopover').remove();" style="padding:12px; border-radius:14px; background:rgba(0,245,212,0.15); border:1px solid #00F5D4; color:#F5F5F7; font-size:13px; font-weight:700; cursor:pointer;">Page 1 (Primary Deck)</button>
                        <button onclick="window.toggleMultiPageMode(); document.getElementById('subtoolOptionsPopover').remove();" style="padding:12px; border-radius:14px; background:rgba(255,255,255,0.05); border:1px solid rgba(255,255,255,0.1); color:#F5F5F7; font-size:13px; font-weight:700; cursor:pointer;">Page 2 (Secondary Deck)</button>
                    </div>
                `;
            } else if (itemKey === 'snap') {
                title = 'Snap Grid Settings';
                contentHtml = `
                    <div style="display:flex; flex-direction:column; gap:8px; margin-top:12px;">
                        <button onclick="window.toggleSnapGrid(); document.getElementById('subtoolOptionsPopover').remove();" style="padding:12px 14px; border-radius:14px; background:rgba(0,245,212,0.15); border:1px solid #00F5D4; color:#F5F5F7; font-size:12px; font-weight:700; cursor:pointer; text-align:left;">📐 Toggle Smart Snap Grid</button>
                    </div>
                `;
            } else if (itemKey === 'resetview') {
                title = 'Reset Canvas Viewport';
                contentHtml = `
                    <div style="display:flex; flex-direction:column; gap:8px; margin-top:12px;">
                        <button onclick="window.resetCanvasViewport(); document.getElementById('subtoolOptionsPopover').remove();" style="padding:12px 14px; border-radius:14px; background:rgba(0,245,212,0.15); border:1px solid #00F5D4; color:#F5F5F7; font-size:12px; font-weight:700; cursor:pointer; text-align:left;">🔍 Reset Viewport Scale to 100%</button>
                    </div>
                `;
            }
        } else if (menuKey === 'manage') {
            if (itemKey === 'duplicate') {
                title = 'Duplicate Selection';
                contentHtml = `
                    <div style="display:flex; flex-direction:column; gap:8px; margin-top:12px;">
                        <button onclick="window.duplicateSelectedCanvasElement(); document.getElementById('subtoolOptionsPopover').remove();" style="padding:12px 14px; border-radius:14px; background:rgba(0,245,212,0.15); border:1px solid #00F5D4; color:#F5F5F7; font-size:12px; font-weight:700; cursor:pointer; text-align:left;">⧉ Duplicate Selected Card</button>
                    </div>
                `;
            } else if (itemKey === 'front') {
                title = 'Bring Layer to Front';
                contentHtml = `
                    <div style="display:flex; flex-direction:column; gap:8px; margin-top:12px;">
                        <button onclick="window.bringSelectedElementToFront(); document.getElementById('subtoolOptionsPopover').remove();" style="padding:12px 14px; border-radius:14px; background:rgba(0,245,212,0.15); border:1px solid #00F5D4; color:#F5F5F7; font-size:12px; font-weight:700; cursor:pointer; text-align:left;">⇡ Bring Card to Front Layer</button>
                    </div>
                `;
            } else if (itemKey === 'back') {
                title = 'Send Layer to Back';
                contentHtml = `
                    <div style="display:flex; flex-direction:column; gap:8px; margin-top:12px;">
                        <button onclick="window.sendSelectedElementToBack(); document.getElementById('subtoolOptionsPopover').remove();" style="padding:12px 14px; border-radius:14px; background:rgba(0,245,212,0.15); border:1px solid #00F5D4; color:#F5F5F7; font-size:12px; font-weight:700; cursor:pointer; text-align:left;">⇣ Send Card to Back Layer</button>
                    </div>
                `;
            } else if (itemKey === 'sync') {
                title = 'Cloud Firestore Sync';
                contentHtml = `
                    <div style="display:flex; flex-direction:column; gap:8px; margin-top:12px;">
                        <button onclick="window.forceCloudSync(); document.getElementById('subtoolOptionsPopover').remove();" style="padding:12px 14px; border-radius:14px; background:rgba(0,245,212,0.15); border:1px solid #00F5D4; color:#F5F5F7; font-size:12px; font-weight:700; cursor:pointer; text-align:left;">☁️ Sync Live Changes to Cloud Now</button>
                    </div>
                `;
            } else if (itemKey === 'reset') {
                title = 'Reset Canvas Template';
                contentHtml = `
                    <div style="display:flex; flex-direction:column; gap:8px; margin-top:12px;">
                        <button onclick="window.manageResetTemplate(); document.getElementById('subtoolOptionsPopover').remove();" style="padding:12px 14px; border-radius:14px; background:rgba(255,45,85,0.15); border:1px solid #FF2D55; color:#FF2D55; font-size:12px; font-weight:700; cursor:pointer; text-align:left;">↺ Reset Canvas to Default Template</button>
                    </div>
                `;
            }
        }

        drawer.innerHTML = `
            <div style="display:flex; justify-content:space-between; align-items:center; border-bottom:1px solid rgba(255,255,255,0.1); padding-bottom:8px;">
                <span style="font-size:12px; font-weight:700; color:#F5F5F7; text-transform:uppercase; letter-spacing:0.04em;">${title}</span>
                <button onclick="document.getElementById('subtoolOptionsPopover').remove();" style="width:28px; height:28px; border-radius:50%; background:rgba(255,255,255,0.08); border:none; color:#F5F5F7; font-size:14px; cursor:pointer;">✕</button>
            </div>
            ${contentHtml}
        `;
    };

    window.applySubtoolOption = function(menuKey, itemKey, value) {
        const items = getCanvasItems();
        const selectedItem = selectedCanvasElementId ? items.find(it => it.id === selectedCanvasElementId) : null;

        if (itemKey === 'color') {
            if (selectedItem) {
                selectedItem.accentColor = value;
                if (window.showToast) window.showToast(`Card accent color set to ${value}`, 'success');
            } else {
                items.forEach(it => { it.accentColor = value; });
                if (window.showToast) window.showToast(`Canvas accent color set to ${value}`, 'info');
            }
            saveCanvasItems(items);
        } else if (itemKey === 'font') {
            if (selectedItem) {
                selectedItem.fontFamily = value;
                if (window.showToast) window.showToast(`Card font set to ${value}`, 'success');
            } else {
                items.forEach(it => { it.fontFamily = value; });
                if (window.showToast) window.showToast(`Canvas font set to ${value}`, 'info');
            }
            saveCanvasItems(items);
        } else if (itemKey === 'shadow') {
            if (selectedItem) {
                selectedItem.customShadow = value;
                if (window.showToast) window.showToast(`Card shadow depth updated!`, 'success');
            } else {
                items.forEach(it => { it.customShadow = value; });
                if (window.showToast) window.showToast(`Canvas shadows updated!`, 'info');
            }
            saveCanvasItems(items);
        } else if (itemKey === 'theme') {
            if (selectedItem) {
                selectedItem.customBg = value;
                if (window.showToast) window.showToast(`Card background tone updated!`, 'success');
            } else {
                items.forEach(it => { it.customBg = value; });
                if (window.showToast) window.showToast(`Canvas card tones updated!`, 'info');
            }
            saveCanvasItems(items);
        } else if (itemKey === 'avatarborder') {
            const rad = Number(value);
            if (selectedItem) {
                selectedItem.customRadius = rad;
                if (window.showToast) window.showToast(`Card border radius set to ${rad}px!`, 'success');
            } else {
                items.forEach(it => { it.customRadius = rad; });
                if (window.showToast) window.showToast(`Canvas border radii set to ${rad}px!`, 'info');
            }
            saveCanvasItems(items);
        } else if (itemKey === 'text') {
            window.addCanvasElementPreset('text', { variant: value === 'display' ? 'display' : 'tagline', content: value === 'display' ? 'HEADER TITLE' : 'Subtitle tagline or bio note...' });
            return;
        } else if (itemKey === 'links') {
            const label = value.charAt(0).toUpperCase() + value.slice(1);
            window.addCanvasElementPreset('links', { items: [{ label: label, handle: '@' + value }] });
            return;
        } else if (itemKey === 'photo') {
            const url = value === 'banner' ? 'https://images.unsplash.com/photo-1618005182384-a83a8bd57fbe?auto=format&fit=crop&w=600&q=80' : 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&w=400&q=80';
            const w = value === 'banner' ? 300 : 200;
            const h = value === 'banner' ? 160 : 240;
            window.addCanvasElementPreset('photo', { url, w, h });
            return;
        } else if (itemKey === 'markcard') {
            if (value === 'exam') window.addCanvasElementPreset('markcard', { subject: 'Internal Exam', score: '48', total: '50' });
            else window.addCanvasElementPreset('markcard', { subject: 'Semester SGPA', score: '9.2', total: '10' });
            return;
        } else if (itemKey === 'section') {
            window.addCanvasElementPreset('section', { title: value, w: 320, h: 60 });
            return;
        }

        window.renderCanvasPortfolio();
        const drawer = document.getElementById('subtoolOptionsPopover');
        if (drawer) drawer.remove();
    };

    window.addCanvasElementPreset = function(type, presetData) {
        const items = getCanvasItems();
        const id = type + '_' + Date.now();
        const base = { id, type, x: 60, y: 120, w: 240, h: 140, ...presetData };
        items.push(base);
        saveCanvasItems(items);
        selectedCanvasElementId = id;
        window.closeArcToolMenu();
        window.renderCanvasPortfolio();
        const drawer = document.getElementById('subtoolOptionsPopover');
        if (drawer) drawer.remove();
        if (window.editCanvasElementContent) window.editCanvasElementContent(id);
        if (window.showToast) window.showToast(`Added ${type} card to canvas!`, 'success');
    };

    window.handleRadialPickDirect = function(menuKey, itemKey) {
        if (menuKey === 'canvas') {
            if (itemKey === 'text') window.addCanvasElement('text');
            else if (itemKey === 'links') window.addCanvasElement('links');
            else if (itemKey === 'photo') window.addCanvasElement('photo');
            else if (itemKey === 'markcard') window.addCanvasElement('markcard');
            else if (itemKey === 'align') window.alignCanvasItems();
        } else if (menuKey === 'layout') {
            if (itemKey === 'section') window.addCanvasElement('section');
            else if (itemKey === 'columns') { window.addCanvasElement('section'); window.addCanvasElement('section'); }
            else if (itemKey === 'pages') window.toggleMultiPageMode();
            else if (itemKey === 'snap') window.toggleSnapGrid();
            else if (itemKey === 'resetview') window.resetCanvasViewport();
        } else if (menuKey === 'manage') {
            if (itemKey === 'duplicate') window.duplicateSelectedCanvasElement();
            else if (itemKey === 'front') window.bringSelectedElementToFront();
            else if (itemKey === 'back') window.sendSelectedElementToBack();
            else if (itemKey === 'sync') window.forceCloudSync();
            else if (itemKey === 'reset') window.manageResetTemplate();
        }
    };

    let isHandlingRadialPick = false;
    window.handleRadialPick = function(menuKey, itemKey, activeSubKey) {
        if (isHandlingRadialPick) return;
        isHandlingRadialPick = true;
        setTimeout(function() { isHandlingRadialPick = false; }, 250);

        if (itemKey === 'back') {
            window.toggleArcToolMenu(menuKey);
            return;
        }

        const childMenuKey = menuKey + ':' + itemKey;
        if (CHILD_RADIAL_MENUS[childMenuKey]) {
            // Morph radial buttons into child subtools arc!
            window.toggleArcToolMenu(menuKey, itemKey);
            return;
        }

        // If currently inside a child subtool menu:
        if (activeSubKey) {
            window.applySubtoolOption(menuKey, activeSubKey, itemKey);
            window.closeArcToolMenu();
            return;
        }

        // Direct action fallback & open options drawer:
        window.openSubtoolOptionsDrawer(menuKey, itemKey);
    };

    window.handleEditNavClick = function(menuKey) {
        const buttons = document.querySelectorAll('.edit-nav-item');
        buttons.forEach(btn => {
            if (btn.id === 'editNavBtn_' + menuKey) {
                btn.classList.add('active-centered');
                btn.classList.remove('inactive-flank');
            } else {
                btn.classList.remove('active-centered');
                btn.classList.add('inactive-flank');
            }
        });
        window.toggleArcToolMenu(menuKey);
    };

    function updateBottomNavForMode(mode) {
        const navPill = document.getElementById('navPill');
        if (!navPill) return;

        if (mode === 'edit') {
            navPill.innerHTML = `
                <button id="editNavBtn_canvas" onclick="window.handleEditNavClick('canvas')" class="nav-item edit-nav-item flex-1 text-center py-1.5" title="Direct Canvas Mode">
                    <span class="text-base block">✎</span>
                    <span class="nav-label text-[9px] font-bold">Canvas</span>
                </button>
                <button id="editNavBtn_layout" onclick="window.handleEditNavClick('layout')" class="nav-item edit-nav-item flex-1 text-center py-1.5" title="Layout Organizers">
                    <span class="text-base block">▦</span>
                    <span class="nav-label text-[9px] font-bold">Layout</span>
                </button>
                <button id="editNavBtn_design" onclick="window.handleEditNavClick('design')" class="nav-item edit-nav-item flex-1 text-center py-1.5" title="Design Customization">
                    <span class="text-base block">✺</span>
                    <span class="nav-label text-[9px] font-bold">Design</span>
                </button>
                <button id="editNavBtn_manage" onclick="window.handleEditNavClick('manage')" class="nav-item edit-nav-item flex-1 text-center py-1.5" title="Manage Housekeeping">
                    <span class="text-base block">⚙</span>
                    <span class="nav-label text-[9px] font-bold">Manage</span>
                </button>
            `;
            applyDesignSettings();
        } else {
            navPill.innerHTML = `
                <div id="navIndicator" class="nav-indicator"></div>
                <button onclick="switchView('view-home')" id="tab-view-home" class="nav-item active" c-option="1">
                    <span class="nav-icon">
                        <svg class="icon-outline" width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linejoin="round">
                            <path d="M22 23h-6.001a1 1 0 0 1-1-1v-5.645a2.002 2.002 0 0 0-2.001-2.001 2.002 2.002 0 0 0-2.001 2.001v5.645a1.001 1.001 0 0 1-1 1H2a1 1 0 0 1-1-1V11.058a1.001 1.001 0 0 1 .326-.743L11.326 1.7a1 1 0 0 1 1.348 0L22.675 10.3a1.001 1.001 0 0 1 .325.758V22a1 1 0 0 1-1 1z"></path>
                        </svg>
                        <svg class="icon-filled" width="22" height="22" viewBox="0 0 24 24" fill="currentColor">
                            <path d="M22 23h-6.001a1 1 0 0 1-1-1v-5.645a2.002 2.002 0 0 0-2.001-2.001 2.002 2.002 0 0 0-2.001 2.001v5.645a1.001 1.001 0 0 1-1 1H2a1 1 0 0 1-1-1V11.058a1.001 1.001 0 0 1 .326-.743L11.326 1.7a1 1 0 0 1 1.348 0L22.675 10.3a1.001 1.001 0 0 1 .325.758V22a1 1 0 0 1-1 1z"></path>
                        </svg>
                    </span>
                    <span class="nav-label">Home</span>
                </button>
                <button onclick="switchExamView()" id="tab-view-exam" class="nav-item" c-option="2">
                    <span class="nav-icon">
                        <svg class="icon-outline" width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.3" stroke-linecap="round" stroke-linejoin="round">
                            <rect x="3" y="4" width="18" height="18" rx="2" ry="2"></rect>
                            <line x1="16" y1="2" x2="16" y2="6"></line>
                            <line x1="8" y1="2" x2="8" y2="6"></line>
                            <line x1="3" y1="10" x2="21" y2="10"></line>
                        </svg>
                        <svg class="icon-filled" width="22" height="22" viewBox="0 0 24 24" fill="currentColor">
                            <path d="M19 4h-1V2h-2v2H8V2H6v2H5c-1.11 0-1.99.9-1.99 2L3 20c0 1.1.89 2 2 2h14c1.1 0 2-.9 2-2V6c0-1.1-.9-2-2-2zm0 16H5V10h14v10z"/>
                        </svg>
                    </span>
                    <span class="nav-label">Schedule</span>
                </button>
                <button onclick="switchView('view-chat'); if(window.initChatView) window.initChatView();" id="tab-view-chat" class="nav-item" c-option="3">
                    <span class="nav-icon">
                        <svg class="icon-outline" width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.3" stroke-linecap="round" stroke-linejoin="round">
                            <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"></path>
                        </svg>
                        <svg class="icon-filled" width="22" height="22" viewBox="0 0 24 24" fill="currentColor">
                            <path d="M20 2H4c-1.1 0-2 .9-2 2v18l4-4h14c1.1 0 2-.9 2-2V4c0-1.1-.9-2-2-2z"/>
                        </svg>
                    </span>
                    <span class="nav-label">Chat</span>
                </button>
                <button onclick="switchView('view-profile')" id="tab-view-profile" class="nav-item active" c-option="4">
                    <span class="nav-icon">
                        <div class="nav-profile-avatar">
                            <div class="nav-profile-avatar-inner"><span id="navProfileInitialsText">P</span></div>
                        </div>
                    </span>
                    <span class="nav-label">Profile</span>
                </button>
            `;
        }
    }

    window.switchProfileMode = function(mode) {
        if (!window.appState) window.appState = {};
        window.appState.profileMode = mode;

        const subnav = document.querySelector('#view-profile .exam-subnav');
        const viewBtn = document.getElementById('tab-profile-view');
        const editBtn = document.getElementById('tab-profile-edit');
        const aiBtn = document.getElementById('macAiFloatingBtn');
        const aiNormalIcon = document.getElementById('aiBtnNormalIcon');
        const aiPlusIcon = document.getElementById('aiBtnPlusIcon');

        if (viewBtn && editBtn) {
            viewBtn.classList.toggle('is-active', mode === 'view');
            editBtn.classList.toggle('is-active', mode === 'edit');
        }

        if (subnav) {
            if (mode === 'edit') {
                subnav.setAttribute('c-current', '2');
                subnav.setAttribute('c-previous', '1');
            } else {
                subnav.setAttribute('c-current', '1');
                subnav.setAttribute('c-previous', '2');
            }
        }

        // Swap nav bar icons for mode
        updateBottomNavForMode(mode);

        // Morph AI button into + and X button pair when in Edit Mode
        if (aiBtn) {
            if (mode === 'edit') {
                aiBtn.classList.add('is-plus-btn');
                if (aiNormalIcon) {
                    aiNormalIcon.classList.add('opacity-0', 'pointer-events-none');
                    aiNormalIcon.classList.remove('opacity-100');
                }
                if (aiPlusIcon) {
                    aiPlusIcon.classList.remove('opacity-0', 'pointer-events-none');
                    aiPlusIcon.classList.add('opacity-100', 'scale-100');
                }
            } else {
                aiBtn.classList.remove('is-plus-btn');
                if (aiNormalIcon) {
                    aiNormalIcon.classList.remove('opacity-0', 'pointer-events-none');
                    aiNormalIcon.classList.add('opacity-100');
                }
                if (aiPlusIcon) {
                    aiPlusIcon.classList.add('opacity-0', 'pointer-events-none');
                    aiPlusIcon.classList.remove('opacity-100', 'scale-100');
                }
                window.toggleCanvasAddMenu(false);
            }
        }

        window.renderCanvasPortfolio();
    };

    // Dedicated Profile Edit Mode scroll-hiding handler
    let lastProfileScrollY = 0;
    let profileScrollTimer = null;
    let profileScrollTicking = false;

    if (typeof window.addEventListener === 'function') {
        window.addEventListener('scroll', function() {
            if (profileScrollTicking) return;
            profileScrollTicking = true;

            requestAnimationFrame(function() {
                const profileView = document.getElementById('view-profile');
                const isProfilePage = profileView && !profileView.classList.contains('hidden');
                const isEditMode = window.appState && window.appState.profileMode === 'edit';

                if (isProfilePage && isEditMode) {
                    const currentY = window.scrollY || 0;
                    const delta = currentY - lastProfileScrollY;

                    if (delta > 5 && currentY > 40) {
                        document.body.classList.add('is-scrolling-down');
                        if (typeof window.toggleCanvasAddMenu === 'function') {
                            window.toggleCanvasAddMenu(false);
                        }
                    } else if (delta < -5 || currentY <= 20) {
                        document.body.classList.remove('is-scrolling-down');
                    }

                    clearTimeout(profileScrollTimer);
                    profileScrollTimer = setTimeout(function() {
                        document.body.classList.remove('is-scrolling-down');
                    }, 1000);

                    lastProfileScrollY = currentY <= 0 ? 0 : currentY;
                } else {
                    document.body.classList.remove('is-scrolling-down');
                }
                profileScrollTicking = false;
            });
        }, { passive: true });
    }

    // ═══════════════════════════════════════════════════════════
    // PUBLIC SHARE PAGE SYSTEM (machub.app/p/{publicSlug})
    // ═══════════════════════════════════════════════════════
    window.getOrCreatePublicSlug = function() {
        let slug = localStorage.getItem('machub_public_slug');
        if (!slug) {
            const info = getStudentInfo() || {};
            const baseName = (info.name || 'student').toLowerCase().replace(/[^a-z0-9]/g, '').substring(0, 10) || 'student';
            const hash = Math.random().toString(36).substring(2, 6);
            slug = `${baseName}-${hash}`;
            localStorage.setItem('machub_public_slug', slug);
        }
        return slug;
    };

    window.syncPublicProfile = async function(publicSlug, items) {
        if (!publicSlug) return;
        const info = getStudentInfo() || {};
        const filteredData = {
            name: info.name || 'Student Showcase',
            publicSlug: publicSlug,
            canvasElements: items || [],
            designSettings: {
                fontFamily: currentFontKey,
                accentColor: ACCENT_PALETTE[currentAccentIndex]
            },
            updatedAt: new Date().toISOString()
        };

        // Mirror locally for instant offline preview & fallback
        localStorage.setItem('machub_public_profile_' + publicSlug, JSON.stringify(filteredData));

        // Sync to Firestore publicProfiles/{publicSlug} collection
        if (window.firebaseFirestore && window.firestoreDoc && window.firestoreSetDoc) {
            try {
                const docRef = window.firestoreDoc(window.firebaseFirestore, 'publicProfiles', publicSlug);
                await window.firestoreSetDoc(docRef, filteredData, { merge: true });
            } catch(e) {
                console.warn('[Public Profile Sync] Failed:', e.message);
            }
        }
    };

    window.copyToClipboard = async function(text) {
        let copied = false;
        if (navigator.clipboard && navigator.clipboard.writeText) {
            try {
                await navigator.clipboard.writeText(text);
                copied = true;
            } catch(e) {}
        }
        if (!copied) {
            try {
                const textArea = document.createElement("textarea");
                textArea.value = text;
                textArea.style.position = "fixed";
                textArea.style.left = "-999999px";
                textArea.style.top = "-999999px";
                document.body.appendChild(textArea);
                textArea.focus();
                textArea.select();
                copied = document.execCommand('copy');
                document.body.removeChild(textArea);
            } catch (err) {}
        }
        return copied;
    };

    window.openShareSheet = async function() {
        try {
            const publicSlug = window.getOrCreatePublicSlug();
            const items = typeof getCanvasItems === 'function' ? getCanvasItems() : [];
            if (window.syncPublicProfile) {
                await window.syncPublicProfile(publicSlug, items);
            }

            const basePath = window.location.pathname.endsWith('.html') ? window.location.pathname.replace(/[^/]+\.html$/, '') : window.location.pathname;
            const cleanOrigin = window.location.origin + (basePath.endsWith('/') ? basePath : basePath + '/');
            const shareUrl = `${cleanOrigin}public.html?p=${publicSlug}`;
            
            // Always copy link to clipboard reliably
            const copied = await window.copyToClipboard(shareUrl);
            
            if (copied) {
                if (window.showToast) {
                    window.showToast('🔗 Public link copied to clipboard!', 'success');
                } else {
                    alert('🔗 Public Profile Link Copied:\n' + shareUrl);
                }
            } else {
                prompt('Copy your public profile link:', shareUrl);
            }

            // Also trigger native share sheet on mobile if available
            if (navigator.share) {
                try {
                    await navigator.share({
                        title: 'My Machub Profile Canvas',
                        text: 'Check out my student profile canvas on Machub!',
                        url: shareUrl
                    });
                } catch(e) {}
            }
        } catch(err) {
            console.error('[Share Sheet Error]', err);
            const slug = localStorage.getItem('machub_public_slug') || 'student-4f2a';
            const url = `${window.location.origin}${window.location.pathname}#p/${slug}`;
            prompt('Copy your public profile link:', url);
        }
    };

    window.shareStudentProfile = window.openShareSheet;
    window.copyPublicProfileLink = window.openShareSheet;

    window.loadPublicProfileView = async function(publicSlug) {
        if (!publicSlug) return;

        // Enable isolated public showcase mode class on body
        document.body.classList.add('public-showcase-mode');

        // Hide bottom nav bar completely to isolate public showcase view
        const bottomNav = document.getElementById('bottomNav');
        if (bottomNav) {
            bottomNav.classList.add('nav-hidden', 'hidden');
            bottomNav.style.setProperty('display', 'none', 'important');
        }

        // Hide top app header chrome
        const header = document.getElementById('appHeader');
        if (header) header.style.setProperty('display', 'none', 'important');

        // Hide floating AI button
        const aiBtn = document.getElementById('macAiFloatingBtn');
        if (aiBtn) aiBtn.style.setProperty('display', 'none', 'important');

        // Switch active view panel to view-public-profile
        if (typeof window.switchView === 'function') {
            window.switchView('view-public-profile');
        } else {
            document.querySelectorAll('.view-panel').forEach(el => el.classList.remove('is-active'));
            const pubView = document.getElementById('view-public-profile');
            if (pubView) pubView.classList.add('is-active');
        }

        const loadingState = document.getElementById('pub-loading-state');
        const contentState = document.getElementById('pub-profile-content');
        const unavailState = document.getElementById('pub-profile-unavailable');

        if (loadingState) loadingState.style.display = 'block';
        if (contentState) contentState.style.display = 'none';
        if (unavailState) unavailState.classList.add('hidden');

        let profileData = null;

        // 1. Check local storage mirror
        try {
            const rawLocal = localStorage.getItem('machub_public_profile_' + publicSlug);
            if (rawLocal) profileData = JSON.parse(rawLocal);
        } catch(e) {}

        // 2. Read strictly from publicProfiles/{publicSlug} in Firestore
        if (!profileData && window.firebaseFirestore && window.firestoreDoc && window.firestoreGetDoc) {
            try {
                const docRef = window.firestoreDoc(window.firebaseFirestore, 'publicProfiles', publicSlug);
                const snap = await window.firestoreGetDoc(docRef);
                if (snap.exists()) {
                    profileData = snap.data();
                }
            } catch(e) {}
        }

        if (loadingState) loadingState.style.display = 'none';

        // If public profile not found or unavailable:
        if (!profileData || !profileData.canvasElements) {
            if (unavailState) unavailState.classList.remove('hidden');
            return;
        }

        // Render Public Read-Only Canvas
        if (contentState) contentState.style.display = 'block';

        const nameEl = document.getElementById('pub-student-name');
        if (nameEl) nameEl.textContent = profileData.name || 'Student Showcase';

        const container = document.getElementById('pubCanvasContainer');
        if (!container) return;

        const items = profileData.canvasElements || [];
        container.style.position = 'relative';
        container.style.width = '100%';
        container.style.minHeight = '580px';

        let html = items.map((el) => {
            let bodyHtml = '';
            if (el.type === 'text') {
                const isDisplay = (el.variant === 'display');
                bodyHtml = `
                    <div style="font-family:${isDisplay ? "'Archivo Expanded', sans-serif" : "'Archivo', sans-serif"}; font-weight:${isDisplay ? 800 : 500}; font-size:${isDisplay ? 34 : 14}px; line-height:${isDisplay ? 0.98 : 1.4}; letter-spacing:${isDisplay ? '-0.02em' : '0'}; color:${isDisplay ? '#F5F5F7' : 'rgba(245,245,247,0.65)'}; white-space:pre-line; width:100%; height:100%;">
                        ${escapeHtml(el.content || '')}
                    </div>
                `;
            } else if (el.type === 'academic') {
                bodyHtml = `
                    <div style="width:100%; height:100%; display:flex; flex-direction:column; justify-content:space-between; font-family:'Archivo', sans-serif;">
                        <div style="font-size:10px; letter-spacing:0.1em; color:rgba(245,245,247,0.4); text-transform:uppercase;">ACADEMIC DETAILS</div>
                        <div style="display:flex; flex-direction:column; gap:4px; font-size:13px; color:#F5F5F7;">
                            <div><span style="color:rgba(245,245,247,0.5);">Admin No:</span> <span>${escapeHtml(el.adminNo || '---')}</span></div>
                            <div><span style="color:rgba(245,245,247,0.5);">Program:</span> <span>${escapeHtml(el.dept || 'Degree Program')}</span></div>
                        </div>
                    </div>
                `;
            } else if (el.type === 'section') {
                bodyHtml = `
                    <div style="font-family:'Archivo Expanded', sans-serif; font-size:16px; font-weight:800; color:#F5F5F7; letter-spacing:-0.01em; border-bottom:1.5px solid rgba(255,255,255,0.12); padding-bottom:6px; text-transform:uppercase;">
                        ${escapeHtml(el.title || 'SECTION')}
                    </div>
                `;
            } else if (el.type === 'markcard') {
                bodyHtml = `
                    <div style="width:100%; height:100%; display:flex; flex-direction:column; justify-content:space-between; font-family:'Archivo', sans-serif;">
                        <div style="font-size:10px; font-weight:700; color:rgba(245,245,247,0.45); text-transform:uppercase;">${escapeHtml(el.subject || 'INTERNAL EXAM')}</div>
                        <div style="font-size:32px; font-weight:800; color:#00F5D4; font-family:'Archivo Expanded', sans-serif; line-height:1;">
                            ${escapeHtml(el.score || '0')}<span style="font-size:14px; font-weight:600; color:rgba(245,245,247,0.4);">/${escapeHtml(el.total || '50')}</span>
                        </div>
                    </div>
                `;
            } else if (el.type === 'links') {
                const links = Array.isArray(el.items) ? el.items : [];
                bodyHtml = `
                    <div style="display:flex; flex-direction:column; gap:8px; width:100%; font-family:'Archivo', sans-serif;">
                        ${links.map(l => `
                            <div style="display:flex; justify-content:space-between; align-items:center; background:rgba(255,255,255,0.06); padding:8px 12px; border-radius:12px; border:1px solid rgba(255,255,255,0.08);">
                                <span style="font-size:12px; font-weight:700; color:#F5F5F7;">${escapeHtml(l.label)}</span>
                                <span style="font-size:11px; font-weight:600; color:#00F5D4;">${escapeHtml(l.handle)}</span>
                            </div>
                        `).join('')}
                    </div>
                `;
            } else if (el.type === 'photo') {
                bodyHtml = `<img src="${escapeHtml(el.url || '')}" style="width:100%; height:100%; object-fit:cover; border-radius:inherit;" alt="Photo" />`;
            }

            const itemBg = el.customBg || '#181920';
            const itemShadow = el.customShadow || '0 14px 34px -12px rgba(0,0,0,0.65)';
            const itemRadius = typeof el.customRadius === 'number' ? el.customRadius : 24;
            const itemAccent = el.accentColor || '#00F5D4';
            const itemFont = el.fontFamily ? `'${el.fontFamily}', sans-serif` : 'inherit';

            return `
                <div style="position:absolute; left:${el.x}px; top:${el.y}px; width:${el.w}px; height:${el.h}px; background:${itemBg}; border-radius:${itemRadius}px; border:1.5px solid ${itemAccent}; box-shadow:${itemShadow}; padding:16px; font-family:${itemFont}; pointer-events:none;">
                    ${bodyHtml}
                </div>
            `;
        }).join('');

        container.innerHTML = html;
    };

    function checkPublicProfileRoute() {
        const path = window.location.pathname || '';
        const search = window.location.search || '';
        const hash = window.location.hash || '';
        let publicSlug = null;

        if (path.includes('/p/')) {
            publicSlug = path.split('/p/')[1]?.split('/')[0]?.split('?')[0]?.split('#')[0];
        } else if (search.includes('p=')) {
            const params = new URLSearchParams(search);
            publicSlug = params.get('p');
        } else if (hash.includes('#p/')) {
            publicSlug = hash.replace('#p/', '').split('?')[0];
        } else if (hash.includes('p=')) {
            const params = new URLSearchParams(hash.replace('#', '?'));
            publicSlug = params.get('p');
        }

        if (publicSlug) {
            window.loadPublicProfileView(publicSlug);
        }
    }

    if (typeof window.addEventListener === 'function') {
        window.addEventListener('hashchange', checkPublicProfileRoute);
    }

    // Auto-initialize canvas and check public profile route on page load
    setTimeout(function() {
        if (typeof window.renderCanvasPortfolio === 'function') window.renderCanvasPortfolio();
        const adminNo = localStorage.getItem('machub_student_id') || '';
        if (adminNo && window.syncCanvasFromCloud) {
            window.syncCanvasFromCloud(adminNo);
        }
        checkPublicProfileRoute();
    }, 200);

})();

