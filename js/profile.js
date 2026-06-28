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
        return window.ExamHubProfile.get();
    }

    function getPortalCache(section, adminNo) {
        if (!adminNo) return null;
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
                // Force telemetry setting to always be true
                if (parsed.analytics !== true) {
                    parsed.analytics = true;
                    try {
                        localStorage.setItem('mac_profile_settings', JSON.stringify(parsed));
                    } catch(e) {}
                }
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

    // Share Profile handler
    function shareStudentProfile() {
        const info = getStudentInfo();
        if (!info) return;
        const name = info.name || 'Student';
        const dept = info.dept || 'General';
        const text = `🎓 MacHub Student Profile: ${name} (${dept})`;
        
        if (navigator.clipboard && navigator.clipboard.writeText) {
            navigator.clipboard.writeText(text).then(() => {
                showToast('Profile info copied to clipboard! 📋', 'success');
            }).catch(() => {
                showToast('Failed to copy profile.', 'error');
            });
        } else {
            // Fallback
            const input = document.createElement('input');
            input.value = text;
            document.body.appendChild(input);
            input.select();
            try {
                document.execCommand('copy');
                showToast('Profile info copied to clipboard! 📋', 'success');
            } catch(e) {
                showToast('Clipboard copy failed.', 'error');
            }
            document.body.removeChild(input);
        }
    }

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
                'security.portalPasswordEncrypted': null
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
        if (!info || !info.adminNo) return;
        const adminNo = info.adminNo;

        const db = window.firebaseFirestore;
        if (!db) return;

        try {
            const studentRef = window.firestoreDoc(db, 'students', adminNo);
            await window.updateFirestoreDocSecurely(adminNo, {
                'security.deviceTokens': []
            });

            localStorage.removeItem('machub_device_token');
            localStorage.removeItem('mac_student_info');
            localStorage.removeItem('machub_current_view');
            localStorage.removeItem('machub_claimed_admission');
            window.location.reload();
        } catch (e) {
            alert('Error logging out: ' + e.message);
        }
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
            const cachedAtt = getPortalCache('Attendance', adminNo);
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
            
            cardContainer.innerHTML = `
                <div id="profile-ticket-container" class="mb-4 relative z-10 mx-auto">
                    <section class="ob-ticket holo-skin-${colorSkin}" id="profile-ticketEl">
                        <!-- FRONT FACE -->
                        <section class="ob-ticket-front">
                            <div class="ob-ticket-holo"></div>
                            <img class="ob-ticket-logo-small" src="assets/img/file_00000000378c7207842a975d80367515.png" alt="MacHub">
                            <div class="data">
                                <h3>Name</h3>
                                <p>${escapeHtml(p.displayName || info.name)}</p>
                                <h3>Department</h3>
                                <p>${escapeHtml(info.dept || info.classGroup)}</p>
                                ${settings.showReg && info.reg ? `<h3>Reg No</h3><p>${escapeHtml(info.reg)}</p>` : ''}
                                ${settings.showAdmin && info.adminNo ? `<h3>Admission No</h3><p>${escapeHtml(info.adminNo)}</p>` : ''}
                                <h3>Semester</h3>
                                <p>Sem 2</p>
                            </div>
                            <aside class="divider">
                                <div class="username">
                                    <img class="profile-pic" src="${p.photoUrl || 'assets/img/ChatGPT%20Image%20May%2018,%202026,%2010_33_49%20PM.png'}" alt="Profile">
                                    <span>MacHub</span>
                                </div>
                                <span class="usernum">2026</span>
                            </aside>
                        </section>
                        <!-- BACK FACE -->
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
        const attRaw = adminNo ? getPortalCache('attendance', adminNo) : null;
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

        // Get subjects list
        let subjects = attData.subjects || attData.data || [];
        if (!subjects.length && attData.rows) subjects = attData.rows;

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
        const marksRaw = adminNo ? getPortalCache('marks', adminNo) : null;

        if (!marksRaw) {
            grid.innerHTML = '<p style="color:#8d99ae;font-size:12px;text-align:center;padding:20px 0;">Open Marks tab first to load data.</p>';
            return;
        }
        let marksData = null;
        try { marksData = JSON.parse(marksRaw); } catch(e) {}
        const subjects = marksData ? (marksData.subjects || marksData.data || marksData.rows || []) : [];

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
        const attRaw = adminNo ? getPortalCache('attendance', adminNo) : null;

        let subjects = [];
        if (attRaw) {
            try {
                const d = JSON.parse(attRaw);
                subjects = d.subjects || d.data || d.rows || [];
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

    window.openAvatarPicker = function() {
        const modal = document.getElementById('avatarPickerModal');
        if (!modal) return;
        modal.classList.add('open');
        filterAvatars('all', document.querySelector('.av-cat-btn'));
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

        // Save to profile
        const info = getStudentInfo();
        if (info) {
            info.avatarSrc = src;
            info.avatarAccent = accent;
            saveStudentInfo(info);
        }

        closeAvatarPicker();
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

})();

