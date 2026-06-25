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
        const nav = document.getElementById('bottomNav');
        if (nav) nav.classList.add('nav-hidden');
        _macaiInit();
    };

    window.closeMacAI = function () {
        const nav = document.getElementById('bottomNav');
        if (nav) nav.classList.remove('nav-hidden');
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

    window.macaiSend = async function () {
        if (macaiIsStreaming) return;

        const input = document.getElementById('macaiInput');
        if (!input) return;
        const rawText = input.value.trim();
        if (!rawText) return;

        // Apply mode tag prefix to user message
        const text = macaiActiveTag ? `[${macaiActiveTag}] ${rawText}` : rawText;
        input.value = '';

        // Append user bubble to UI
        _macaiAppendMsg('user', rawText);
        _syncChatUI();

        // Close plus menu
        const menu = document.getElementById('macaiPlusMenu');
        if (menu) menu.classList.remove('open');
        const icon = document.getElementById('macaiPlusIcon');
        if (icon) icon.style.transform = 'rotate(0deg)';
        macaiClearTag();

        // Show typing indicator
        const typingEl = _macaiShowTyping();
        macaiIsStreaming = true;
        _updateSendBtn(true);

        // Check if Gemini model is ready
        const gemini = window._macaiGemini;
        if (!gemini) {
            typingEl.remove();
            macaiIsStreaming = false;
            _updateSendBtn(false);
            _macaiAppendMsg('ai', '⚠️ **MacAI not ready yet** — Firebase AI is still initializing. Please wait a second and try again.');
            return;
        }

        try {
            // Create (or reuse) a persistent chat session
            if (!macaiChatSession) {
                macaiChatSession = gemini.startChat({
                    systemInstruction: { role: 'system', parts: [{ text: _buildSystemPrompt() }] },
                    history: [], // fresh conversation
                });
            }

            // Build the final prompt (with deep thinking prefix if enabled)
            const fullPrompt = macaiDeepThink
                ? `[Think step by step before answering]\n\n${text}`
                : text;

            // Create streaming bubble and stream the response
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

            // Save to display history
            macaiMessages.push({ role: 'ai', text: fullResponse });

        } catch (err) {
            console.error('MacAI Gemini error:', err);
            typingEl?.remove?.();
            let errMsg = '❌ **MacAI error** — Something went wrong.';
            const msg = err.message || '';
            if (msg.includes('API_KEY') || msg.includes('403')) {
                errMsg = '🔑 **Firebase AI not enabled** — Go to **Firebase Console → Build → AI Logic** and confirm it is enabled for project `machub-6af39`.';
            } else if (msg.includes('Failed to fetch') || msg.includes('network') || msg.includes('NetworkError')) {
                errMsg = '📡 **Network error** — Check your internet connection and try again.';
            } else if (msg.includes('429') || msg.includes('RESOURCE_EXHAUSTED') || msg.includes('quota')) {
                errMsg = '⏳ **Rate limited** — Too many requests. Please wait a moment and try again.';
            } else if (msg.includes('PERMISSION_DENIED') || msg.includes('permission')) {
                errMsg = '🔒 **Permission denied** — Firebase AI Logic must be enabled in **Firebase Console → Build → AI Logic**.';
            }
            _macaiAppendMsg('ai', errMsg);
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

})();
