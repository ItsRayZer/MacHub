// ═══════════════════════════════════════════════════════════════════════════
// js/mac_ai.js  —  MacAI · Firebase AI (Gemini 2.0 Flash) Edition
// Nothing OS × Apple Liquid Glass Design, integrated into MacHub
// ═══════════════════════════════════════════════════════════════════════════
(function () {
    'use strict';

    // ── State ──────────────────────────────────────────────────────────────
    let macaiActiveTag   = null;
    let macaiDeepThink   = false;
    let macaiMessages    = [];        // [{role, text}] for display
    let macaiChatSession = null;      // Persistent Gemini chat session
    let macaiCurrentTab  = 'boss';
    let macaiIsStreaming = false;

    // Default subjects for Mind tab
    const DEFAULT_SUBJECTS = [
        { name: 'Web Technology',       progress: 65, priority: 'high' },
        { name: 'Data Structures',      progress: 45, priority: 'high' },
        { name: 'Discrete Mathematics', progress: 75, priority: 'medium' },
        { name: 'Operating Systems',    progress: 50, priority: 'medium' },
        { name: 'Professional Ethics',  progress: 90, priority: 'low' }
    ];

    // ── MacHub Navigation Hooks ────────────────────────────────────────────
    window.openMacAI = function () {
        if (typeof switchView === 'function') {
            switchView('view-ai');
        } else {
            document.querySelectorAll('.view-panel').forEach(el => el.classList.remove('is-active'));
            const panel = document.getElementById('view-ai');
            if (panel) panel.classList.add('is-active');
        }
        _macaiInit();
    };

    window.closeMacAI = function () {
        if (typeof switchView === 'function') {
            switchView('view-home');
        } else {
            const panel = document.getElementById('view-ai');
            if (panel) panel.classList.remove('is-active');
        }
    };

    // ── Init ───────────────────────────────────────────────────────────────
    function _macaiInit() {
        macaiSwitchTab(macaiCurrentTab, true);
        _macaiRenderMind();
        _macaiRenderProfile();
        _syncChatUI();
    }

    // ── Build Gemini System Prompt from MacHub Live Data ───────────────────
    function _getPortalCache(section, adminNo) {
        if (!adminNo) return null;
        const directKey = `machub_portal_${section}_${adminNo}`;
        const direct = localStorage.getItem(directKey);
        if (direct) return direct;
        
        for (let i = 0; i < localStorage.length; i++) {
            const key = localStorage.key(i);
            if (key && key.startsWith(`machub_portal_${section}_sem`) && key.endsWith(`_${adminNo}`)) {
                return localStorage.getItem(key);
            }
        }
        return null;
    }

    function _buildSystemPrompt() {
        const info = _getStudentInfo();
        const name = info?.name || 'Student';
        const dept = info?.dept?.toUpperCase() || 'BCA';
        const reg  = info?.reg  || 'Not set';
        const adminNo = info?.adminNo || '';

        let prompt = `You are MacAI, an intelligent academic assistant embedded inside MacHub — a college companion app for Macfast College (Mahathma Gandhi University, Kerala, India).

You are helpful, warm, and slightly motivational — like a smart senior student who knows everything about college. Keep responses concise and formatted with bold headings (**text**) where useful. Use bullet points for lists.

Student Profile:
- Name: ${name}
- Department: ${dept}
- Registration No: ${reg}
- Admission No: ${adminNo}
`;

        // 1. Live profile details from ePortal
        if (adminNo) {
            const cachedProfile = _getPortalCache('Profile', adminNo);
            if (cachedProfile) {
                try {
                    const parsed = JSON.parse(cachedProfile);
                    const p = parsed?.data?.payload?.sections?.[0]?.data || parsed?.data?.sections?.[0]?.data;
                    const overrides = JSON.parse(localStorage.getItem('machub_profile_overrides_' + adminNo) || '{}');
                    const profile = { ...p, ...overrides };
                    if (profile) {
                        prompt += `\nStudent Live Profile Details:\n`;
                        if (profile.dob) prompt += `- Date of Birth: ${profile.dob}\n`;
                        if (profile.gender) prompt += `- Gender: ${profile.gender}\n`;
                        if (profile.phone) prompt += `- Mobile: ${profile.phone}\n`;
                        if (profile.email) prompt += `- Email: ${profile.email}\n`;
                        if (profile.bloodGroup) prompt += `- Blood Group: ${profile.bloodGroup}\n`;
                        if (profile.religion || profile.caste) prompt += `- Religion & Caste: ${profile.religion || ''} ${profile.caste || ''}\n`;
                        if (profile.abcId) prompt += `- ABC Student ID: ${profile.abcId}\n`;
                        if (profile.address) prompt += `- Address: ${profile.address}\n`;
                        if (profile.guardianName) prompt += `- Father/Guardian Name: ${profile.guardianName}\n`;
                        if (profile.guardianPhone) prompt += `- Father/Guardian Phone: ${profile.guardianPhone}\n`;
                    }
                } catch(e) {}
            }
        }

        // 2. Live attendance details from ePortal
        if (adminNo) {
            const cachedAtt = _getPortalCache('Attendance', adminNo);
            if (cachedAtt) {
                try {
                    const parsed = JSON.parse(cachedAtt);
                    const rows = parsed?.data?.payload?.sections?.[0]?.rows || parsed?.data?.sections?.[0]?.rows || [];
                    if (rows.length > 0) {
                        prompt += `\nLive Attendance (Subject-wise):\n`;
                        rows.forEach(item => {
                            if (item.subjectName) {
                                prompt += `- ${item.subjectName}: ${item.percentage}% (${item.presentHours}/${item.totalHours} Hours)\n`;
                            }
                        });
                    }
                } catch(e) {}
            }
        }

        // 3. Live assessment marks from ePortal
        if (adminNo) {
            const cachedAssess = _getPortalCache('Assessment', adminNo);
            if (cachedAssess) {
                try {
                    const parsed = JSON.parse(cachedAssess);
                    const sections = parsed?.data?.payload?.sections || parsed?.data?.sections || [];
                    if (sections.length > 0) {
                        prompt += `\nLive Assessment Marks (Internals/Tests):\n`;
                        sections.forEach(sec => {
                            if (sec.subject && sec.rows?.length) {
                                prompt += `- ${sec.subject}:\n`;
                                sec.rows.forEach(row => {
                                    const keys = Object.keys(row);
                                    const label = row[keys[0]] || '';
                                    const marks = row['marks'] || row['score'] || row[keys[1]] || '';
                                    prompt += `  * ${label}: ${marks}\n`;
                                });
                            }
                        });
                    }
                } catch(e) {}
            }
        }

        // 4. Live assignments from ePortal
        if (adminNo) {
            const cachedAssign = _getPortalCache('Assignment', adminNo);
            if (cachedAssign) {
                try {
                    const parsed = JSON.parse(cachedAssign);
                    const sections = parsed?.data?.payload?.sections || parsed?.data?.sections || [];
                    if (sections.length > 0) {
                        prompt += `\nLive Assignments:\n`;
                        sections.forEach(sec => {
                            if (sec.rows?.length) {
                                prompt += `- Status: ${sec.label || 'Active'}\n`;
                                sec.rows.forEach(row => {
                                    const vals = Object.values(row).filter(Boolean);
                                    prompt += `  * ${vals[0] || ''} - ${vals[1] || ''}\n`;
                                });
                            }
                        });
                    }
                } catch(e) {}
            }
        }

        prompt += '\n';

        // Inject timetable context
        const ttKey = `CLASS_TIMETABLE_${dept}`;
        if (window[ttKey]) {
            prompt += `\nClass Timetable (${dept}):\n`;
            const DAYS = ['Monday','Tuesday','Wednesday','Thursday','Friday'];
            DAYS.forEach(day => {
                const periods = window[ttKey][day];
                if (periods?.length) {
                    prompt += `${day}: `;
                    prompt += periods.map(p => `Period ${p.period} (${p.time}) — ${p.title} in ${p.room}`).join(' | ');
                    prompt += '\n';
                }
            });
        }

        // Inject subjects context
        const subKey = `CLASS_SUBJECTS_${dept}`;
        if (window[subKey]?.length) {
            prompt += `\n${dept} Subjects:\n`;
            window[subKey].forEach(s => {
                prompt += `- ${s.title} (${s.code}): ${s.credits} credits`;
                if (s.teacher?.name) prompt += `, taught by ${s.teacher.name} (${s.teacher.room})`;
                if (s.syllabus?.length) prompt += `. Modules: ${s.syllabus.slice(0,3).join(', ')}...`;
                prompt += '\n';
            });
        }

        // Inject exam seating
        if (info?.reg && window.ALL_DEPARTMENTS) {
            const seat = window.ALL_DEPARTMENTS.find(d =>
                d[0]?.toLowerCase().includes(info.reg.toLowerCase())
            );
            if (seat) {
                prompt += `\nStudent's Exam Seat: Hall ${seat[1]}, Room ${seat[2]}, Row ${seat[4]}, ${seat[5]} Side, Dept ${seat[6]}\n`;
            }
        }

        // Inject FAQ
        if (window.MAC_AI_FAQ?.length) {
            prompt += `\nCollege FAQ:\n`;
            window.MAC_AI_FAQ.slice(0, 20).forEach(f => {
                prompt += `Q: ${f.keywords?.join('/')} — A: ${f.answer}\n`;
            });
        }

        prompt += `\nAnswer questions about this student's timetable, subjects, syllabus, faculty, exam seating, attendance, and general college queries. If you don't know something specific, say so honestly but helpfully.`;

        return prompt;
    }

    // ── Tab Switching ──────────────────────────────────────────────────────
    window.macaiSwitchTab = function (tab, silent) {
        macaiCurrentTab = tab;
        ['boss', 'mind', 'profile'].forEach(t => {
            const btn  = document.getElementById('macai-tab-' + t);
            const pane = document.getElementById('macai-pane-' + t);
            if (btn)  btn.classList.toggle('active', t === tab);
            if (pane) pane.style.display = (t === tab) ? (t === 'boss' ? 'flex' : 'block') : 'none';
        });
        if (tab === 'mind')    _macaiRenderMind();
        if (tab === 'profile') _macaiRenderProfile();
    };

    function _generateLocalDatabaseReply(rawText) {
        const query = rawText.toLowerCase();
        const info = _getStudentInfo();
        const name = info?.name || 'Student';
        const dept = info?.dept?.toUpperCase() || 'BCA';
        const adminNo = info?.adminNo || '';
        const reg = info?.reg || '';

        // 1. Timetable / Schedule queries
        if (query.includes('timetable') || query.includes('class') || query.includes('period') || query.includes('schedule') || query.includes('time table')) {
            const timetable = window[`CLASS_TIMETABLE_${dept}`] || window.CLASS_TIMETABLE_BCA;
            if (timetable) {
                let targetDay = '';
                const days = ['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday'];
                for (const d of days) {
                    if (query.includes(d)) {
                        targetDay = d.charAt(0).toUpperCase() + d.slice(1);
                        break;
                    }
                }
                
                if (!targetDay) {
                    const todayIndex = new Date().getDay();
                    const dayMap = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
                    targetDay = dayMap[todayIndex];
                    if (targetDay === 'Sunday' || targetDay === 'Saturday') {
                        targetDay = 'Monday';
                    }
                }

                const daySchedule = timetable[targetDay] || timetable['Monday'];
                if (daySchedule) {
                    let itemsHtml = '';
                    daySchedule.forEach((sub, idx) => {
                        const timeSlots = ['09:30 - 10:30', '10:30 - 11:30', '11:45 - 12:45', '01:45 - 02:45', '02:45 - 03:45'];
                        const time = timeSlots[idx] || '';
                        itemsHtml += `
                            <div style="display: flex; justify-content: space-between; align-items: center; padding: 12px 16px; background: rgba(255,255,255,0.03); border-radius: 14px; margin-bottom: 8px; border: 1px solid rgba(255,255,255,0.05);">
                                <div style="display: flex; align-items: center; gap: 10px; max-width: 70%;">
                                    <span style="font-size: 13px; font-weight: 800; opacity: 0.5;">P${idx+1}</span>
                                    <span style="font-size: 13.5px; font-weight: 600; color: #fff; text-overflow: ellipsis; overflow: hidden; white-space: nowrap;">${sub || 'Free Period'}</span>
                                </div>
                                <span style="font-size: 11px; opacity: 0.4; font-weight: 700; color: #fff;">${time}</span>
                            </div>
                        `;
                    });

                    return `
                        <div class="macai-glass glass-card indigo">
                            <div class="glass-card-shine"></div>
                            <div class="glass-card-content" style="align-items: stretch; text-align: left; width: 100%;">
                                <div style="font-size: 11px; font-weight: 800; text-transform: uppercase; letter-spacing: 0.1em; opacity: 0.5; margin-bottom: 12px; color: #fff;">📅 Timetable for ${targetDay} (${dept})</div>
                                <div class="boss-task-card" style="padding: 0;">
                                    ${itemsHtml}
                                </div>
                                <div style="font-size: 10px; opacity: 0.4; font-weight: 600; text-align: center; margin-top: 4px; color: #fff;">Synced with local registers</div>
                            </div>
                            <div class="glass-card-border"></div>
                        </div>
                    `;
                }
            }
        }

        // 2. Attendance queries
        if (query.includes('attendance') || query.includes('present') || query.includes('absent') || query.includes('percentage')) {
            if (adminNo) {
                const cachedAtt = _getPortalCache('Attendance', adminNo);
                if (cachedAtt) {
                    try {
                        const parsed = JSON.parse(cachedAtt);
                        const rows = parsed?.data?.payload?.sections?.[0]?.rows || parsed?.data?.sections?.[0]?.rows || [];
                        if (rows.length > 0) {
                            let totalPresent = 0;
                            let totalHours = 0;
                            let subjectListHtml = '';
                            rows.forEach(item => {
                                if (item.subjectName) {
                                    const percentageVal = parseFloat(item.percentage) || 0;
                                    const isLow = percentageVal < 75;
                                    subjectListHtml += `
                                        <div style="background: rgba(255,255,255,0.02); border: 1px solid rgba(255,255,255,0.05); padding: 12px 14px; border-radius: 16px; margin-bottom: 8px;">
                                            <div style="display: flex; justify-content: space-between; font-size: 13px; font-weight: 600; margin-bottom: 6px;">
                                                <span style="color: #fff; max-width: 70%; text-overflow: ellipsis; overflow: hidden; white-space: nowrap;">${item.subjectName}</span>
                                                <span style="color: ${isLow ? '#FF3B30' : '#30D158'}; font-weight: 800;">${percentageVal}%</span>
                                            </div>
                                            <div style="height: 4px; background: rgba(255,255,255,0.08); border-radius: 2px; overflow: hidden;">
                                                <div style="height: 100%; width: ${percentageVal}%; background: ${isLow ? '#FF3B30' : '#30D158'};"></div>
                                            </div>
                                            <div style="font-size: 10px; opacity: 0.4; margin-top: 4px; font-weight: 700; color: #fff;">${item.presentHours}/${item.totalHours} hrs attended</div>
                                        </div>
                                    `;
                                    totalPresent += parseInt(item.presentHours) || 0;
                                    totalHours += parseInt(item.totalHours) || 0;
                                }
                            });
                            const totalPercentage = totalHours > 0 ? ((totalPresent / totalHours) * 100).toFixed(1) : 0;
                            const isTotalLow = totalPercentage < 75;

                            return `
                                <div class="macai-glass glass-card gold">
                                    <div class="glass-card-shine"></div>
                                    <div class="glass-card-content" style="align-items: stretch; width: 100%;">
                                        <div class="boss-progress-card" style="padding: 16px 0 24px; text-align: center;">
                                            <div style="position: relative; width: 100px; height: 100px; margin: 0 auto 12px;">
                                                <svg width="100" height="100" viewBox="0 0 100 100">
                                                    <circle cx="50" cy="50" r="44" fill="none" stroke="rgba(255,255,255,0.05)" stroke-width="6" />
                                                    <circle cx="50" cy="50" r="44" fill="none" stroke="${isTotalLow ? '#FF3B30' : '#30D158'}" stroke-width="6" stroke-dasharray="276.46" stroke-dashoffset="${276.46 * (1 - totalPercentage / 100)}" stroke-linecap="round" transform="rotate(-90 50 50)" style="transition: stroke-dashoffset 1s ease-out;" />
                                                </svg>
                                                <div style="position: absolute; inset: 0; display: flex; align-items: center; justify-content: center; font-size: 20px; font-weight: 800; color: #fff;">${totalPercentage}%</div>
                                            </div>
                                            <div style="font-size: 12px; font-weight: 800; text-transform: uppercase; letter-spacing: 0.1em; opacity: 0.5; color: #fff;">Overall Attendance</div>
                                        </div>
                                        
                                        <div style="font-size: 11px; font-weight: 800; text-transform: uppercase; letter-spacing: 0.1em; opacity: 0.5; margin-bottom: 8px; color: #fff;">Subject Breakdown</div>
                                        <div>
                                            ${subjectListHtml}
                                        </div>
                                        
                                        <div style="margin-top: 8px; padding-top: 12px; border-top: 1px solid rgba(255,255,255,0.06); font-size: 11.5px; font-weight: 600; text-align: center; color: ${isTotalLow ? '#FF3B30' : '#30D158'};">
                                            ${isTotalLow ? '⚠️ Below 75% university requirement!' : '✅ Status good. Keep attending classes!'}
                                        </div>
                                    </div>
                                    <div class="glass-card-border"></div>
                                </div>
                            `;
                        }
                    } catch(e) {}
                }
            }
            return `
                <div class="macai-glass glass-card red">
                    <div class="glass-card-shine"></div>
                    <div class="glass-card-content" style="align-items: stretch; width: 100%;">
                        <div style="font-size: 11px; font-weight: 800; text-transform: uppercase; letter-spacing: 0.1em; opacity: 0.5; margin-bottom: 8px; color: #fff;">📊 Attendance Sync</div>
                        <div style="font-size: 13.5px; line-height: 1.4; color: rgba(255,255,255,0.8);">No cached attendance data found for Admission Number <code>${adminNo || 'not set'}</code>. Sync your credentials in Profile to cache records.</div>
                    </div>
                    <div class="glass-card-border"></div>
                </div>
            `;
        }

        // 3. Marks / Internal assessments
        if (query.includes('marks') || query.includes('grade') || query.includes('result') || query.includes('assessment') || query.includes('internal')) {
            if (adminNo) {
                const cachedAssess = _getPortalCache('Assessment', adminNo);
                if (cachedAssess) {
                    try {
                        const parsed = JSON.parse(cachedAssess);
                        const sections = parsed?.data?.payload?.sections || parsed?.data?.sections || [];
                        if (sections.length > 0) {
                            let cardsHtml = '';
                            sections.forEach(sec => {
                                const title = sec.title || 'Internal Assessment';
                                const rows = sec.rows || [];
                                let rowsHtml = '';
                                rows.forEach(r => {
                                    if (r.subjectName) {
                                        const isPass = (r.remarks || '').toUpperCase().includes('PASS') || (parseInt(r.markObtained) / parseInt(r.maxMark) >= 0.4);
                                        rowsHtml += `
                                            <div style="display: flex; justify-content: space-between; align-items: center; padding: 12px 16px; background: rgba(255,255,255,0.03); border-radius: 14px; margin-bottom: 8px; border: 1px solid rgba(255,255,255,0.05);">
                                                <div style="display: flex; align-items: center; gap: 10px; max-width: 70%;">
                                                    <div style="width: 18px; height: 18px; border-radius: 5px; background: ${isPass ? '#30D158' : '#8E8E93'}; display: grid; place-items: center; flex-shrink: 0;">
                                                        <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="4"><polyline points="20 6 9 17 4 12"/></svg>
                                                    </div>
                                                    <span style="font-size: 13.5px; font-weight: 600; color: #fff; text-overflow: ellipsis; overflow: hidden; white-space: nowrap;">${r.subjectName}</span>
                                                </div>
                                                <span style="font-size: 13.5px; font-weight: 800; color: #fff;">${r.markObtained || '—'} / ${r.maxMark || '—'}</span>
                                            </div>
                                        `;
                                    }
                                });
                                
                                cardsHtml += `
                                    <div class="macai-glass glass-card indigo" style="margin-bottom: 12px;">
                                        <div class="glass-card-shine"></div>
                                        <div class="glass-card-content" style="align-items: stretch; text-align: left; width: 100%;">
                                            <div style="font-size: 11px; font-weight: 800; text-transform: uppercase; letter-spacing: 0.1em; opacity: 0.5; margin-bottom: 12px; color: #fff;">📝 ${title}</div>
                                            <div class="boss-task-card" style="padding: 0;">
                                                ${rowsHtml}
                                            </div>
                                        </div>
                                        <div class="glass-card-border"></div>
                                    </div>
                                `;
                            });
                            return cardsHtml;
                        }
                    } catch(e) {}
                }
            }
            return `
                <div class="macai-glass glass-card red">
                    <div class="glass-card-shine"></div>
                    <div class="glass-card-content" style="align-items: stretch; width: 100%;">
                        <div style="font-size: 11px; font-weight: 800; text-transform: uppercase; letter-spacing: 0.1em; opacity: 0.5; margin-bottom: 8px; color: #fff;">📝 Marks Sync</div>
                        <div style="font-size: 13.5px; line-height: 1.4; color: rgba(255,255,255,0.8);">No cached assessment records found. Sync your portal credentials in Profile to load results.</div>
                    </div>
                    <div class="glass-card-border"></div>
                </div>
            `;
        }

        // 4. Exam seat allocations
        if (query.includes('seat') || query.includes('hall') || query.includes('room') || query.includes('bench') || query.includes('exam')) {
            if (reg && window.ALL_DEPARTMENTS) {
                const seat = window.ALL_DEPARTMENTS.find(d =>
                    d[0]?.toLowerCase().includes(reg.toLowerCase())
                );
                if (seat) {
                    return `
                        <div class="macai-glass glass-card green">
                            <div class="glass-card-shine"></div>
                            <div class="glass-card-content" style="align-items: stretch; text-align: left; width: 100%;">
                                <div style="font-size: 11px; font-weight: 800; text-transform: uppercase; letter-spacing: 0.1em; opacity: 0.5; margin-bottom: 16px; color: #fff;">🏫 Exam Seating Allocation</div>
                                
                                <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 12px; margin-bottom: 16px;">
                                    <div style="background: rgba(255,255,255,0.03); border: 1px solid rgba(255,255,255,0.05); padding: 12px; border-radius: 16px; text-align: center;">
                                        <div style="font-size: 10px; opacity: 0.4; font-weight: 700; text-transform: uppercase; color: #fff;">Hall</div>
                                        <div style="font-size: 18px; font-weight: 900; color: #fff; margin-top: 4px;">Hall ${seat[1]}</div>
                                    </div>
                                    <div style="background: rgba(255,255,255,0.03); border: 1px solid rgba(255,255,255,0.05); padding: 12px; border-radius: 16px; text-align: center;">
                                        <div style="font-size: 10px; opacity: 0.4; font-weight: 700; text-transform: uppercase; color: #fff;">Room No</div>
                                        <div style="font-size: 18px; font-weight: 900; color: #fff; margin-top: 4px;">Room ${seat[2]}</div>
                                    </div>
                                    <div style="background: rgba(255,255,255,0.03); border: 1px solid rgba(255,255,255,0.05); padding: 12px; border-radius: 16px; text-align: center;">
                                        <div style="font-size: 10px; opacity: 0.4; font-weight: 700; text-transform: uppercase; color: #fff;">Desk Row</div>
                                        <div style="font-size: 18px; font-weight: 900; color: #fff; margin-top: 4px;">Row ${seat[4]}</div>
                                    </div>
                                    <div style="background: rgba(255,255,255,0.03); border: 1px solid rgba(255,255,255,0.05); padding: 12px; border-radius: 16px; text-align: center;">
                                        <div style="font-size: 10px; opacity: 0.4; font-weight: 700; text-transform: uppercase; color: #fff;">Desk Column</div>
                                        <div style="font-size: 18px; font-weight: 900; color: #fff; margin-top: 4px;">${seat[5]} Side</div>
                                    </div>
                                </div>
                                <div style="font-size: 10px; opacity: 0.4; font-weight: 600; text-align: center; color: #fff;">Block: ${seat[6] || 'Main Block'} · Keep Hall Ticket ready</div>
                            </div>
                            <div class="glass-card-border"></div>
                        </div>
                    `;
                }
            }
            return `
                <div class="macai-glass glass-card red">
                    <div class="glass-card-shine"></div>
                    <div class="glass-card-content" style="align-items: stretch; width: 100%;">
                        <div style="font-size: 11px; font-weight: 800; text-transform: uppercase; letter-spacing: 0.1em; opacity: 0.5; margin-bottom: 8px; color: #fff;">🏫 Exam Seating Allocation</div>
                        <div style="font-size: 13.5px; line-height: 1.4; color: rgba(255,255,255,0.8);">Could not locate exam seating details. Confirm that your Registration Number <code>${reg || 'not set'}</code> is configured in your Profile.</div>
                    </div>
                    <div class="glass-card-border"></div>
                </div>
            `;
        }

        // 5. Syllabus / Course Modules
        if (query.includes('syllabus') || query.includes('subject') || query.includes('course') || query.includes('module')) {
            const subKey = `SUBJECTS_${dept}`;
            if (window[subKey]?.length) {
                let subjectsHtml = '';
                window[subKey].forEach(s => {
                    subjectsHtml += `
                        <div style="background: rgba(255,255,255,0.02); border: 1px solid rgba(255,255,255,0.05); padding: 14px; border-radius: 18px; margin-bottom: 10px;">
                            <div style="display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 6px;">
                                <div style="font-size: 14px; font-weight: 700; color: #fff; max-width: 75%;">${s.title}</div>
                                <span style="font-size: 10.5px; background: rgba(255,255,255,0.08); padding: 2px 8px; border-radius: 9999px; font-weight: 800; color: #fff;">${s.credits} Credits</span>
                            </div>
                            <div style="font-size: 11px; opacity: 0.5; font-weight: 700; margin-bottom: 8px; color: #fff;">Code: ${s.code} · Faculty: ${s.teacher?.name || '—'} (${s.teacher?.room || '—'})</div>
                            <div style="font-size: 11.5px; opacity: 0.7; font-weight: 500; line-height: 1.4; color: #fff;">Modules: ${s.syllabus?.join(', ') || '—'}</div>
                        </div>
                    `;
                });

                return `
                    <div class="macai-glass glass-card indigo">
                        <div class="glass-card-shine"></div>
                        <div class="glass-card-content" style="align-items: stretch; text-align: left; width: 100%;">
                            <div style="font-size: 11px; font-weight: 800; text-transform: uppercase; letter-spacing: 0.1em; opacity: 0.5; margin-bottom: 12px; color: #fff;">📚 Syllabus details (${dept})</div>
                            <div>
                                ${subjectsHtml}
                            </div>
                        </div>
                        <div class="glass-card-border"></div>
                    </div>
                `;
            }
        }

        // 6. College general info & FAQ matching
        if (window.MAC_AI_FAQ?.length) {
            let bestMatch = null;
            let maxMatches = 0;
            window.MAC_AI_FAQ.forEach(item => {
                let matches = 0;
                item.keywords?.forEach(k => {
                    if (query.includes(k.toLowerCase())) matches++;
                });
                if (matches > maxMatches) {
                    maxMatches = matches;
                    bestMatch = item;
                }
            });

            if (bestMatch && maxMatches > 0) {
                return `
                    <div class="macai-glass glass-card indigo">
                        <div class="glass-card-shine"></div>
                        <div class="glass-card-content" style="align-items: stretch; text-align: left; width: 100%;">
                            <div style="font-size: 11px; font-weight: 800; text-transform: uppercase; letter-spacing: 0.1em; opacity: 0.5; margin-bottom: 8px; color: #fff;">💡 College FAQ System</div>
                            <div style="font-size: 14px; line-height: 1.5; color: #fff; font-weight: 500;">${bestMatch.answer}</div>
                        </div>
                        <div class="glass-card-border"></div>
                    </div>
                `;
            }
        }

        // Default: Welcome / Help Card
        return `
            <div class="macai-glass glass-card indigo">
                <div class="glass-card-shine"></div>
                <div class="glass-card-content" style="align-items: stretch; text-align: left; width: 100%;">
                    <div style="font-size: 11px; font-weight: 800; text-transform: uppercase; letter-spacing: 0.1em; opacity: 0.5; margin-bottom: 12px; color: #fff;">📡 MacAI Local Sync Mode</div>
                    <div style="font-size: 14.5px; font-weight: 700; color: #fff; margin-bottom: 12px; line-height: 1.3;">Hello ${name}! I'm running in offline mode using synced profile databases.</div>
                    
                    <div style="font-size: 11px; font-weight: 800; text-transform: uppercase; letter-spacing: 0.1em; opacity: 0.5; margin-bottom: 8px; color: #fff;">Quick Actions</div>
                    <div class="ai-options-list">
                        <button class="ai-option-item" onclick="macaiSendSuggested('Show my timetable')">
                            <div class="ai-option-index">1</div>
                            <div class="ai-option-text">Show my Timetable</div>
                        </button>
                        <button class="ai-option-item" onclick="macaiSendSuggested('Show my attendance')">
                            <div class="ai-option-index">2</div>
                            <div class="ai-option-text">Check Attendance Progress</div>
                        </button>
                        <button class="ai-option-item" onclick="macaiSendSuggested('Show my internal marks')">
                            <div class="ai-option-index">3</div>
                            <div class="ai-option-text">View Internal Assessment Marks</div>
                        </button>
                        <button class="ai-option-item" onclick="macaiSendSuggested('Where is my exam seat')">
                            <div class="ai-option-index">4</div>
                            <div class="ai-option-text">Locate Exam Seat Allocation</div>
                        </button>
                        <button class="ai-option-item" onclick="macaiSendSuggested('Show syllabus')">
                            <div class="ai-option-index">5</div>
                            <div class="ai-option-text">List Syllabus Modules & Teachers</div>
                        </button>
                    </div>
                </div>
                <div class="glass-card-border"></div>
            </div>
        `;
    }

    window.macaiSend = async function () {
        if (macaiIsStreaming) return;

        const input = document.getElementById('macaiInput');
        if (!input) return;
        const rawText = input.value.trim();
        if (!rawText) return;

        const text = macaiActiveTag ? `[${macaiActiveTag}] ${rawText}` : rawText;
        input.value = '';
        const chatSendBtn = document.getElementById('macaiSendBtn');
        if (chatSendBtn) chatSendBtn.classList.remove('send-mode');

        _macaiAppendMsg('user', rawText);
        _syncChatUI();

        const menu = document.getElementById('macaiPlusMenu');
        if (menu) menu.classList.remove('open');
        const icon = document.getElementById('macaiPlusIcon');
        if (icon) icon.style.transform = 'rotate(0deg)';
        macaiClearTag();

        const typingEl = _macaiShowTyping();
        macaiIsStreaming = true;
        _updateSendBtn(true);

        const gemini = window._macaiGemini;
        if (!gemini) {
            // Failsafe 1: Direct REST call to Gemini Developer API
            const apiKey = "AIzaSyBjBdMAJisAwQ-P_EixsIMyQ_fxG5ry2m4";
            const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${apiKey}`;
            
            try {
                const response = await fetch(url, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        contents: [
                            { role: 'user', parts: [{ text: _buildSystemPrompt() + "\n\nUser Query: " + text }] }
                        ],
                        generationConfig: {
                            temperature: 0.8,
                            maxOutputTokens: 1024
                        }
                    })
                });
                
                const data = await response.json();
                typingEl.remove();
                
                let aiResponse = '';
                if (data.candidates && data.candidates[0] && data.candidates[0].content && data.candidates[0].content.parts[0]) {
                    aiResponse = data.candidates[0].content.parts[0].text;
                } else {
                    throw new Error(data.error?.message || 'Invalid API response format');
                }
                
                _macaiAppendMsg('ai', aiResponse);
                _syncChatUI();
            } catch (err) {
                console.error('REST Gemini error, falling back to local database:', err);
                typingEl?.remove?.();
                const localReply = _generateLocalDatabaseReply(rawText);
                _macaiAppendMsg('ai', localReply);
                _syncChatUI();
            } finally {
                macaiIsStreaming = false;
                _updateSendBtn(false);
            }
            return;
        }

        try {
            if (!macaiChatSession) {
                macaiChatSession = gemini.startChat({
                    systemInstruction: { role: 'system', parts: [{ text: _buildSystemPrompt() }] },
                    history: [],
                });
            }

            const fullPrompt = macaiDeepThink
                ? `[Think step by step before answering]\n\n${text}`
                : text;

            typingEl.remove();
            const aiBubble = _macaiCreateStreamBubble();
            let fullResponse = '';

            const result = await macaiChatSession.sendMessageStream(fullPrompt);

            for await (const chunk of result.stream) {
                const chunkText = chunk.text();
                fullResponse += chunkText;
                aiBubble.innerHTML = _macaiParseMarkdown(fullResponse);
                const scroll = document.getElementById('macaiBossScroll');
                if (scroll) scroll.scrollTop = scroll.scrollHeight + 200;
            }

            macaiMessages.push({ role: 'ai', text: fullResponse });

        } catch (err) {
            console.error('MacAI Gemini error, falling back to direct API:', err);
            // Failsafe 2: Direct REST call on stream failure
            const apiKey = "AIzaSyBjBdMAJisAwQ-P_EixsIMyQ_fxG5ry2m4";
            const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${apiKey}`;
            try {
                const response = await fetch(url, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        contents: [
                            { role: 'user', parts: [{ text: _buildSystemPrompt() + "\n\nUser Query: " + text }] }
                        ],
                        generationConfig: {
                            temperature: 0.8,
                            maxOutputTokens: 1024
                        }
                    })
                });
                const data = await response.json();
                typingEl?.remove?.();
                let aiResponse = '';
                if (data.candidates && data.candidates[0] && data.candidates[0].content && data.candidates[0].content.parts[0]) {
                    aiResponse = data.candidates[0].content.parts[0].text;
                } else {
                    throw new Error(data.error?.message || 'Invalid API response format');
                }
                _macaiAppendMsg('ai', aiResponse);
                _syncChatUI();
            } catch (restErr) {
                console.error('REST Gemini fallback error:', restErr);
                typingEl?.remove?.();
                const localReply = _generateLocalDatabaseReply(rawText);
                _macaiAppendMsg('ai', localReply);
                _syncChatUI();
            }
        } finally {
            macaiIsStreaming = false;
            _updateSendBtn(false);
        }
    };

    window.macaiSendSuggested = function (text) {
        const input = document.getElementById('macaiInput');
        if (input) { input.value = text; macaiSend(); }
    };

    // ── Chat Helpers ───────────────────────────────────────────────────────
    function _macaiAppendMsg(role, text) {
        macaiMessages.push({ role, text });
        const container = document.getElementById('macaiMessages');
        if (!container) return;

        const div = document.createElement('div');
        div.className = 'macai-bubble ' + (role === 'user' ? 'user' : 'ai');
        div.style.whiteSpace = 'pre-line';
        div.innerHTML = _macaiParseMarkdown(text);
        container.appendChild(div);

        const scroll = document.getElementById('macaiBossScroll');
        if (scroll) setTimeout(() => { scroll.scrollTop = scroll.scrollHeight + 200; }, 50);
    }

    function _macaiCreateStreamBubble() {
        const container = document.getElementById('macaiMessages');
        const div = document.createElement('div');
        div.className = 'macai-bubble ai';
        div.style.whiteSpace = 'pre-line';
        div.innerHTML = '<span class="macai-cursor">▍</span>';
        if (container) container.appendChild(div);
        const scroll = document.getElementById('macaiBossScroll');
        if (scroll) scroll.scrollTop = scroll.scrollHeight + 200;
        return div;
    }

    function _macaiShowTyping() {
        const container = document.getElementById('macaiMessages');
        const div = document.createElement('div');
        div.className = 'macai-bubble ai';
        div.innerHTML = '<div class="macai-typing"><span></span><span></span><span></span></div>';
        if (container) container.appendChild(div);
        const scroll = document.getElementById('macaiBossScroll');
        if (scroll) scroll.scrollTop = scroll.scrollHeight + 200;
        return div;
    }

    function _updateSendBtn(loading) {
        const btn = document.querySelector('.macai-circle.send');
        if (!btn) return;
        btn.innerHTML = loading
            ? '<div style="width:14px;height:14px;border:2px solid #000;border-top-color:transparent;border-radius:50%;animation:macai-spin .7s linear infinite;"></div>'
            : '➔';
        btn.style.opacity = loading ? '0.7' : '1';
    }

    function _syncChatUI() {
        const hasMessages = macaiMessages.length > 0;
        const hero    = document.getElementById('macaiHero');
        const suggest = document.getElementById('macaiSuggestGrid');
        if (hero)    hero.style.display    = hasMessages ? 'none' : '';
        if (suggest) suggest.style.display = hasMessages ? 'none' : '';
    }

    function _macaiParseMarkdown(text) {
        if (text.trim().startsWith('<')) {
            return text;
        }
        return text
            .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
            .replace(/`(.*?)`/g, '<code style="background:rgba(255,255,255,.1);padding:1px 5px;border-radius:4px;font-size:12px;font-family:monospace;">$1</code>')
            .replace(/^• /gm, '&bull; ')
            .replace(/\n/g, '<br>');
    }

    // ── Clear Chat ─────────────────────────────────────────────────────────
    window.macaiClearAllChats = function () {
        macaiMessages    = [];
        macaiChatSession = null;  // Reset persistent chat so next message gets fresh system prompt
        const container = document.getElementById('macaiMessages');
        if (container) container.innerHTML = '';
        _syncChatUI();
    };

    // ── Plus Menu ──────────────────────────────────────────────────────────
    window.macaiTogglePlusMenu = function () {
        const menu = document.getElementById('macaiPlusMenu');
        const icon = document.getElementById('macaiPlusIcon');
        if (!menu) return;
        const isOpen = menu.classList.toggle('open');
        if (icon) icon.style.transform = isOpen ? 'rotate(45deg)' : 'rotate(0deg)';
    };

    window.macaiSelectTag = function (tag) {
        macaiActiveTag = tag;
        const tagRow  = document.getElementById('macaiTagRow');
        const tagText = document.getElementById('macaiTagText');
        if (tagText) tagText.textContent = tag;
        if (tagRow)  tagRow.classList.add('show');
        const menu = document.getElementById('macaiPlusMenu');
        const icon = document.getElementById('macaiPlusIcon');
        if (menu) menu.classList.remove('open');
        if (icon) icon.style.transform = 'rotate(0deg)';
    };

    window.macaiClearTag = function () {
        macaiActiveTag = null;
        const tagRow = document.getElementById('macaiTagRow');
        if (tagRow) tagRow.classList.remove('show');
    };

    // ── Deep Thinking Toggle ───────────────────────────────────────────────
    window.macaiToggleThinking = function () {
        macaiDeepThink = !macaiDeepThink;
        const btn = document.getElementById('macaiThinkBtn');
        if (btn) {
            btn.style.color     = macaiDeepThink ? '#FFD60A' : '';
            btn.style.transform = macaiDeepThink ? 'scale(1.15)' : '';
            btn.title           = macaiDeepThink ? 'Deep Thinking ON' : 'Deep Thinking';
        }
    };

    // ── Mind Tab ───────────────────────────────────────────────────────────
    function _macaiRenderMind() {
        _renderSubjects();
        _renderExamCountdown();
    }

    function _renderSubjects() {
        const list = document.getElementById('macaiSubjectList');
        if (!list) return;

        const dept = _getStudentInfo()?.dept?.toUpperCase() || 'BCA';
        const subjectsKey = 'CLASS_SUBJECTS_' + dept;
        let subjects = DEFAULT_SUBJECTS;
        if (window[subjectsKey]?.length) {
            subjects = window[subjectsKey].map(s => ({
                name: s.title,
                progress: Math.floor(Math.random() * 40) + 45,
                priority: 'medium'
            }));
        }

        list.innerHTML = subjects.map(s => {
            const pc = s.priority === 'high' ? '#FF453A' :
                       s.priority === 'medium' ? '#FF9F0A' : '#30D158';
            return `
            <div class="macai-subject-row">
                <div style="flex:1;min-width:0;">
                    <div style="font-size:13px;font-weight:700;color:#fff;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">${s.name}</div>
                    <div class="macai-prog-bar" style="margin-top:6px;">
                        <div class="macai-prog-fill" style="width:0%;"></div>
                    </div>
                </div>
                <div style="text-align:right;flex-shrink:0;margin-left:10px;">
                    <div style="font-size:12px;font-weight:800;color:#fff;">${s.progress}%</div>
                    <div style="font-size:9px;color:${pc};font-weight:700;text-transform:uppercase;letter-spacing:.06em;margin-top:2px;">${s.priority}</div>
                </div>
            </div>`;
        }).join('');

        requestAnimationFrame(() => {
            list.querySelectorAll('.macai-prog-fill').forEach((el, i) => {
                const pct = subjects[i]?.progress || 0;
                setTimeout(() => { el.style.width = pct + '%'; }, 100 + i * 60);
            });
        });
    }

    function _renderExamCountdown() {
        const daysEl  = document.getElementById('macaiDaysLeft');
        const titleEl = document.getElementById('macaiNextExamTitle');
        if (!daysEl || !titleEl) return;

        const dept      = _getStudentInfo()?.dept?.toUpperCase() || 'BCA';
        const key       = 'TIMETABLE_' + dept;
        const timetable = window[key] || window.EXAM_TIMETABLE || [];
        const now       = Date.now();

        let next = null;
        for (const exam of timetable) {
            const dateStr = exam.date || '';
            if (!dateStr) continue;
            const [d, m, y] = dateStr.split('-').map(Number);
            const ts = new Date(y, m - 1, d).getTime();
            if (ts > now && (!next || ts < next.ts)) {
                next = { ts, title: exam.title || exam.subject || 'Exam', date: dateStr };
            }
        }

        if (next) {
            daysEl.textContent  = Math.ceil((next.ts - now) / 864e5);
            titleEl.textContent = next.title + ' · ' + next.date;
        } else {
            daysEl.textContent  = '—';
            titleEl.textContent = 'No upcoming exams found';
        }
    }

    // ── Profile Tab ────────────────────────────────────────────────────────
    function _macaiRenderProfile() {
        const info = _getStudentInfo();
        const nameEl = document.getElementById('macaiProfileName');
        const deptEl = document.getElementById('macaiProfileDept');
        const regEl  = document.getElementById('macaiProfileReg');
        if (nameEl) nameEl.textContent = info?.name  || 'Student';
        if (deptEl) deptEl.textContent = info?.dept  || '—';
        if (regEl)  regEl.textContent  = 'REG: ' + (info?.reg || '—');
    }

    // ── Utils ──────────────────────────────────────────────────────────────
    function _getStudentInfo() {
        if (window.ExamHubProfileApi) return window.ExamHubProfileApi.getStudentInfo();
        try { return JSON.parse(localStorage.getItem('mac_student_info')); } catch { return null; }
    }

    // ── Legacy aliases ─────────────────────────────────────────────────────
    window.submitMacAiMessage  = window.macaiSend;
    window.sendSuggestedMessage = window.macaiSendSuggested;
    window.clearChatHistory    = window.macaiClearAllChats;
    window.togglePlusMenu      = window.macaiTogglePlusMenu;
    window.selectAiTag         = window.macaiSelectTag;
    window.clearActiveTag      = window.macaiClearTag;
    window.toggleDeepThinking  = window.macaiToggleThinking;
    window.handleAiInputKey    = (e) => { if (e.key === 'Enter') macaiSend(); };

    // ── Close plus menu on outside click ──────────────────────────────────
    document.addEventListener('click', function (e) {
        const menu    = document.getElementById('macaiPlusMenu');
        const plusBtn = document.getElementById('macaiPlusBtn');
        if (menu?.classList.contains('open')) {
            if (!menu.contains(e.target) && !plusBtn?.contains(e.target)) {
                menu.classList.remove('open');
                const icon = document.getElementById('macaiPlusIcon');
                if (icon) icon.style.transform = 'rotate(0deg)';
            }
        }
    });

    // ── Apple-style Bottom Nav AI Menu Animation Logic ─────────────────────
    function handleMacAiBtnClick(event) {
        if (event) {
            event.preventDefault();
            event.stopPropagation();
        }

        const bottomNav = document.getElementById('bottomNav');
        const inputContainer = document.getElementById('navAiInputContainer');
        const input = document.getElementById('navAiInput');
        const btn = document.getElementById('macAiFloatingBtn');

        if (!bottomNav || !inputContainer || !input || !btn) return;

        // If currently scrolled down (only AI button showing), expand menu first
        if (bottomNav.classList.contains('nav-scrolled-down')) {
            bottomNav.classList.remove('nav-scrolled-down');
            bottomNav.classList.remove('ai-active'); // Ensure menu shows, not text box
            return;
        }

        const isAiActive = bottomNav.classList.contains('ai-active');

        if (!isAiActive) {
            bottomNav.classList.add('ai-active');
            input.value = '';
            btn.classList.remove('send-mode');
            
            requestAnimationFrame(() => {
                setTimeout(() => { input.focus(); }, 50);
            });

            input.removeEventListener('input', handleNavAiInput);
            input.addEventListener('input', handleNavAiInput);
            input.removeEventListener('keydown', handleNavAiKeydown);
            input.addEventListener('keydown', handleNavAiKeydown);
        } else {
            const text = input.value.trim();
            if (text) {
                const mainInput = document.getElementById('macaiInput');
                if (mainInput) {
                    mainInput.value = text;
                }
                
                window.openMacAI();
                
                if (typeof window.macaiSend === 'function') {
                    window.macaiSend();
                }

                input.value = '';
                btn.classList.remove('send-mode');
            } else {
                bottomNav.classList.remove('ai-active');
                btn.classList.remove('send-mode');
                input.blur();
            }
        }
    }

    function handleNavAiInput() {
        const input = document.getElementById('navAiInput');
        const btn = document.getElementById('macAiFloatingBtn');
        if (!input || !btn) return;

        const hasText = input.value.trim().length > 0;
        if (hasText) {
            btn.classList.add('send-mode');
        } else {
            btn.classList.remove('send-mode');
        }
    }

    function handleNavAiKeydown(e) {
        if (e.key === 'Enter') {
            handleMacAiBtnClick(e);
        } else if (e.key === 'Escape') {
            const input = document.getElementById('navAiInput');
            if (input) input.blur();
        }
    }

    // Collapse bottom nav back to menu layout if user clicks outside of bottomNav while text box is visible (only on non-AI pages)
    document.addEventListener('click', function(e) {
        const bottomNav = document.getElementById('bottomNav');
        const btn = document.getElementById('macAiFloatingBtn');
        const input = document.getElementById('navAiInput');
        const isAiPage = document.getElementById('view-ai')?.classList.contains('is-active');
        if (!isAiPage && bottomNav && bottomNav.classList.contains('ai-active')) {
            if (!bottomNav.contains(e.target)) {
                bottomNav.classList.remove('ai-active');
                if (input) input.value = '';
                if (btn) btn.classList.remove('send-mode');
            }
        }
    });

    window.handleMacAiBtnClick = handleMacAiBtnClick;

    function handleChatPageSendClick(event) {
        if (event) {
            event.preventDefault();
            event.stopPropagation();
        }

        const input = document.getElementById('macaiInput');
        if (!input) return;

        const text = input.value.trim();
        if (text) {
            window.macaiSend();
        } else {
            // Close the chatbot view
            window.closeMacAI();
            
            // Expand the bottom navigation menu buttons
            const bottomNav = document.getElementById('bottomNav');
            if (bottomNav) {
                bottomNav.classList.remove('ai-active');
            }
        }
    }

    // Attach listener to chat input for morphing send button
    document.addEventListener('DOMContentLoaded', () => {
        const chatInput = document.getElementById('macaiInput');
        const chatSendBtn = document.getElementById('macaiSendBtn');
        if (chatInput && chatSendBtn) {
            chatInput.addEventListener('input', () => {
                const hasText = chatInput.value.trim().length > 0;
                if (hasText) {
                    chatSendBtn.classList.add('send-mode');
                } else {
                    chatSendBtn.classList.remove('send-mode');
                }
            });
        }
    });

    window.handleChatPageSendClick = handleChatPageSendClick;

    function handleNewChatClick(btnElement) {
        if (!btnElement) return;
        btnElement.classList.add('elastic-active');
        setTimeout(() => {
            btnElement.classList.remove('elastic-active');
        }, 500);

        if (typeof window.macaiClearAllChats === 'function') {
            window.macaiClearAllChats();
        }
    }
    window.handleNewChatClick = handleNewChatClick;

    // ── Inject spinner keyframe ────────────────────────────────────────────
    if (!document.getElementById('macai-spin-style')) {
        const s = document.createElement('style');
        s.id = 'macai-spin-style';
        s.textContent = `
            @keyframes macai-spin { to { transform: rotate(360deg); } }
            .macai-cursor { animation: macai-pulse 1s ease-in-out infinite; }
        `;
        document.head.appendChild(s);
    }

    // ── Visual Viewport Virtual Keyboard Handler for Mobile ────────────────
    if (window.visualViewport) {
        const handleViewportResize = () => {
            const viewportHeight = window.visualViewport.height;
            const windowHeight = window.innerHeight;
            const keyboardHeight = windowHeight - viewportHeight;
            const offset = Math.max(0, keyboardHeight);

            // 1. Adjust bottom navigation dock (Ask MacAI box)
            const bottomNav = document.getElementById('bottomNav');
            if (bottomNav) {
                if (offset > 0) {
                    bottomNav.style.bottom = `${offset + 10}px`;
                } else {
                    bottomNav.style.bottom = ''; // restore to CSS default (20px)
                }
            }

            // 2. Adjust full-screen view-ai panel
            const viewAi = document.getElementById('view-ai');
            if (viewAi && viewAi.classList.contains('is-active')) {
                if (offset > 0) {
                    viewAi.style.bottom = `${offset}px`;
                    // Automatically scroll chat to bottom when keyboard appears
                    const scrollContainer = viewAi.querySelector('.macai-scroll');
                    if (scrollContainer) {
                        scrollContainer.scrollTop = scrollContainer.scrollHeight;
                    }
                } else {
                    viewAi.style.bottom = '0px';
                }
            }
        };

        window.visualViewport.addEventListener('resize', handleViewportResize);
        window.visualViewport.addEventListener('scroll', handleViewportResize);
        
        // Wrap window.openMacAI to trigger resize sync
        const originalOpen = window.openMacAI;
        window.openMacAI = function() {
            if (typeof originalOpen === 'function') originalOpen();
            setTimeout(handleViewportResize, 50);
        };
        
        // Wrap window.closeMacAI to reset styles
        const originalClose = window.closeMacAI;
        window.closeMacAI = function() {
            if (typeof originalClose === 'function') originalClose();
            const viewAi = document.getElementById('view-ai');
            if (viewAi) viewAi.style.bottom = '0px';
            const bottomNav = document.getElementById('bottomNav');
            if (bottomNav) bottomNav.style.bottom = '';
        };
    }

})();
