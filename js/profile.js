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

    function saveStudentInfo(profile) {
        window.ExamHubProfile.save(profile);
        return profile;
    }

    // Settings persistence (skins, active fields, battery saver tilt mode)
    function readSettings() {
        try {
            const stored = localStorage.getItem('mac_profile_settings');
            if (stored) return JSON.parse(stored);
        } catch(e) {}
        return {
            holoSkin: 'amethyst', // default skin
            showReg: true,
            showAdmin: true,
            highFidelity: true
        };
    }

    function writeSettings(settings) {
        try {
            localStorage.setItem('mac_profile_settings', JSON.stringify(settings));
        } catch(e) {
            console.warn('localStorage is restricted', e);
        }
    }

    // Change Holo ID Skin instantly
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
                btn.classList.remove('border-[#86868b]/30');
            } else {
                btn.classList.remove('bg-[var(--mac-blue)]', 'text-white');
                btn.classList.add('border-[#86868b]/30');
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
    }

    // Toggle fields visibility or interactive 3D physics
    function toggleCardField(fieldName) {
        const settings = readSettings();
        if (fieldName === 'showReg') {
            settings.showReg = document.getElementById('toggleShowReg')?.checked ?? true;
        } else if (fieldName === 'showAdmin') {
            settings.showAdmin = document.getElementById('toggleShowAdmin')?.checked ?? true;
        } else if (fieldName === 'highFidelity') {
            settings.highFidelity = document.getElementById('togglePerformance')?.checked ?? true;
        }
        writeSettings(settings);

        // Refresh card to reflect toggles and restart tilt engine
        renderUserProfile();
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

    // High fidelity dynamic rendering
    function renderUserProfile() {
        const info = getStudentInfo();
        if (!info) return;

        const settings = readSettings();

        // 1. Populate details grid
        const nameEl = document.getElementById('profileGridName');
        const deptEl = document.getElementById('profileGridDept');
        const regEl = document.getElementById('profileGridReg');
        const adminEl = document.getElementById('profileGridAdmin');

        if (nameEl) nameEl.textContent = info.name || '---';
        if (deptEl) deptEl.textContent = info.dept || info.classGroup || '---';
        if (regEl) regEl.textContent = info.reg || 'Not Set';
        if (adminEl) adminEl.textContent = info.adminNo || 'Not Set';

        // 2. Attendance Status logic (linked to academic rules)
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
            status = 'Condonation Eligible'; // 65%-75% medical condonation window
            badgeColorClass = 'bg-amber-500/10 text-amber-500 dark:bg-amber-500/20';
        } else if (course.includes('BSW')) {
            attPercent = 68.5;
            status = 'Condonation Eligible';
            badgeColorClass = 'bg-amber-500/10 text-amber-500 dark:bg-amber-500/20';
        }

        const attLabel = document.getElementById('profileAttendanceLabel');
        const attBadge = document.getElementById('profileAttendanceBadge');

        if (attLabel) attLabel.textContent = `${attPercent}% (${status} Status)`;
        if (attBadge) {
            attBadge.textContent = status;
            attBadge.className = `text-[10px] font-extrabold px-3 py-1.5 rounded-full uppercase tracking-wider ${badgeColorClass}`;
        }

        // 3. Render 3D Ticket Markup inside container
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
                                <p>${escapeHtml(info.name)}</p>
                                <h3>Department</h3>
                                <p>${escapeHtml(info.dept || info.classGroup)}</p>
                                ${settings.showReg && info.reg ? `<h3>Reg No</h3><p>${escapeHtml(info.reg)}</p>` : ''}
                                ${settings.showAdmin && info.adminNo ? `<h3>Admission No</h3><p>${escapeHtml(info.adminNo)}</p>` : ''}
                                <h3>Semester</h3>
                                <p>Sem 2</p>
                            </div>
                            <aside class="divider">
                                <div class="username">
                                    <img class="profile-pic" src="assets/img/ChatGPT%20Image%20May%2018,%202026,%2010_33_49%20PM.png" alt="Profile">
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
                </div>`;
            
            // 4. Bind interactive 3D Mouse/Gyro Tilting mechanics
            if (window.bindCardTilt) {
                window.bindCardTilt('profile-ticket-container', 'profile-ticketEl');
            }
        }

        // 5. Sync Settings Panels Checkboxes
        const regToggle = document.getElementById('toggleShowReg');
        const adminToggle = document.getElementById('toggleShowAdmin');
        const perfToggle = document.getElementById('togglePerformance');

        if (regToggle) regToggle.checked = settings.showReg;
        if (adminToggle) adminToggle.checked = settings.showAdmin;
        if (perfToggle) perfToggle.checked = settings.highFidelity;

        // 6. Highlight active skin button
        ['amethyst', 'cyberpunk', 'emerald', 'classic'].forEach(s => {
            const btn = document.getElementById('skin-btn-' + s);
            if (!btn) return;
            if (s === settings.holoSkin) {
                btn.classList.add('bg-[var(--mac-blue)]', 'text-white');
                btn.classList.remove('border-[#86868b]/30');
            } else {
                btn.classList.remove('bg-[var(--mac-blue)]', 'text-white');
                btn.classList.add('border-[#86868b]/30');
            }
        });
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
})();
