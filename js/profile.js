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
        const adminNo = info.adminNo || '';

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
                    const pct = parseFloat(item.percentage) || 0;
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
            
            // 7. Bind interactive 3D Mouse/Gyro Tilting mechanics
            if (window.bindCardTilt) {
                window.bindCardTilt('profile-ticket-container', 'profile-ticketEl');
            }
        }

        // 8. Sync Settings Panels Checkboxes
        const regToggle = document.getElementById('toggleShowReg');
        const adminToggle = document.getElementById('toggleShowAdmin');
        const perfToggle = document.getElementById('togglePerformance');

        if (regToggle) regToggle.checked = settings.showReg;
        if (adminToggle) adminToggle.checked = settings.showAdmin;
        if (perfToggle) perfToggle.checked = settings.highFidelity;

        // 9. Highlight active skin button
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
