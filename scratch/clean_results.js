window.switchExamTab = function(tab) {
    const timetableEl = document.getElementById('sub-view-timetable');
    const seatsEl = document.getElementById('sub-view-seats');
    const resultsEl = document.getElementById('sub-view-results');
    const timetableBtn = document.getElementById('tab-timetable');
    const seatsBtn = document.getElementById('tab-seats');
    const resultsBtn = document.getElementById('tab-results');

    if (!timetableEl || !seatsEl || !resultsEl) return;

    timetableEl.classList.toggle('hidden', tab !== 'timetable');
    seatsEl.classList.toggle('hidden', tab !== 'seats');
    resultsEl.classList.toggle('hidden', tab !== 'results');

    if (timetableBtn) timetableBtn.classList.toggle('is-active', tab === 'timetable');
    if (seatsBtn) seatsBtn.classList.toggle('is-active', tab === 'seats');
    if (resultsBtn) resultsBtn.classList.toggle('is-active', tab === 'results');

    if (tab === 'timetable') {
        appState.examSubView = 'view-timetable';
        if (typeof renderTimetable === 'function') renderTimetable();
    } else if (tab === 'seats') {
        appState.examSubView = 'view-seats';
        if (typeof showSeatNote === 'function') showSeatNote();
    } else {
        appState.examSubView = 'view-results';
        if (typeof window.renderExamResults === 'function') window.renderExamResults();
    }
    
    // Sync top toggle states
    document.querySelectorAll('.exam-subnav-item[data-top-target="exam"]').forEach(el => el.classList.add('is-active'));
    document.querySelectorAll('.exam-subnav-item[data-top-target="class"]').forEach(el => el.classList.remove('is-active'));
    document.querySelectorAll('.exam-subnav-item[data-exam-target]').forEach(el => {
        el.classList.toggle('is-active', el.dataset.examTarget === appState.examSubView);
    });
},

/* ─── Academic Results Section & Custom Dropdowns ────────────────────────── */
function getStudentSemNumber() {
    const info = getStudentInfo();
    if (info && info.semester) {
        const match = info.semester.match(/\d+/);
        if (match) return parseInt(match[0], 10);
    }
    return 2; // Default fallback sem
}

window.toggleInternalDropdown = function (name) {
    appState.openInternalDropdown = appState.openInternalDropdown === name ? null : name;
    window.renderExamResults();
};

window.switchInternalSemester = function (sem) {
    appState.selectedInternalSem = sem;
    appState.openInternalDropdown = null;
    window.renderExamResults();
};

window.switchInternalType = function (type) {
    appState.selectedInternalType = type;
    appState.openInternalDropdown = null;
    window.renderExamResults();
};

window.switchExamSemester = function (sem) {
    appState.selectedExamSem = sem;
    appState.openInternalDropdown = null;
    window.renderExamResults();
};

window.autoFetchInternals = async function (semester, force = false) {
    const adminNo = (window.MacHubPortal && window.MacHubPortal.getAdminNo()) || localStorage.getItem('machub_student_id');
    if (!adminNo) return;

    if (!appState.internalFetchStatus) {
        appState.internalFetchStatus = {};
    }
    
    if (appState.internalFetchStatus[semester] === 'fetching') return;

    appState.internalFetchStatus[semester] = 'fetching';
    try {
        if (window.MacHubPortal && typeof window.MacHubPortal.fetchSection === 'function') {
            await Promise.all([
                window.MacHubPortal.fetchSection('InternalMark', force, semester),
                window.MacHubPortal.fetchSection('Assessment', force, semester)
            ]);
            appState.internalFetchStatus[semester] = 'success';
        } else {
            throw new Error('Portal not initialized');
        }
    } catch (err) {
        console.warn('Auto fetch internals failed:', err);
        appState.internalFetchStatus[semester] = 'error';
    } finally {
        window.renderExamResults();
    }
};

window.syncExamResults = async function () {
    const container = document.getElementById('sub-view-results');
    if (!container) return;

    // Show loading spinner
    container.innerHTML = `
        <div class="flex justify-center mb-6">
            <div class="bg-black/10 dark:bg-white/5 p-1 rounded-2xl flex gap-1 border border-white/5">
                <button onclick="window.switchResultsSubTab('exam')" class="px-5 py-2 text-[10px] font-black uppercase tracking-wider rounded-xl transition-all ${appState.resultsSubTab === 'exam' ? 'bg-[var(--mac-blue)] text-white shadow-md' : 'text-[#86868b] hover:text-white'}">
                    🏆 University Results
                </button>
                <button onclick="window.switchResultsSubTab('internal')" class="px-5 py-2 text-[10px] font-black uppercase tracking-wider rounded-xl transition-all ${appState.resultsSubTab === 'internal' ? 'bg-[var(--mac-blue)] text-white shadow-md' : 'text-[#86868b] hover:text-white'}">
                    🏫 College Results
                </button>
            </div>
        </div>
        <div class="glass-panel rounded-[2rem] p-12 text-center my-6 border border-white/5">
            <div class="animate-spin text-4xl mb-4">⏳</div>
            <h3 class="text-sm font-black text-white">Syncing Academic Results...</h3>
            <p class="text-[10px] font-bold text-[#86868b] mt-2">Connecting to college portal to fetch your official marks.</p>
        </div>`;

    const adminNo = (window.MacHubPortal && window.MacHubPortal.getAdminNo()) || localStorage.getItem('machub_student_id');
    try {
        if (window.MacHubPortal && typeof window.MacHubPortal.fetchSection === 'function') {
            const activeSem = appState.selectedInternalSem || String(getStudentSemNumber());
            if (appState.resultsSubTab === 'internal') {
                await Promise.all([
                    window.MacHubPortal.fetchSection('InternalMark', true, activeSem),
                    window.MacHubPortal.fetchSection('Assessment', true, activeSem)
                ]);
            } else {
                await window.MacHubPortal.fetchSection('ExamResult', true);
            }
        } else {
            throw new Error('Sync API not initialized');
        }
    } catch (err) {
        console.error('Sync results failed:', err);
    } finally {
        window.renderExamResults();
    }
};

window.showResultsTab = function (tab) {
    if (tab === 'semester') tab = 'exam';
    appState.resultsSubTab = tab;
    if (window.switchExamView) {
        window.switchExamView('view-results');
    } else {
        window.renderExamResults();
    }
};

window.switchResultsSubTab = function (tab) {
    window.showResultsTab(tab);
};

window.renderExamResults = function () {
    const container = document.getElementById('sub-view-results');
    if (!container) return;

    const adminNo = (window.MacHubPortal && window.MacHubPortal.getAdminNo()) || localStorage.getItem('machub_student_id');
    if (!adminNo) {
        container.innerHTML = `
            <div class="glass-panel rounded-[2rem] p-6 text-center my-6 border border-white/5">
                <div class="text-3xl mb-3">🔑</div>
                <h3 class="text-sm font-black text-white">Admission Number Required</h3>
                <p class="text-[10px] font-bold text-[#86868b] mt-2 leading-relaxed">
                    Go to Profile → Edit and enter your Admission Number to sync exam results.
                </p>
            </div>`;
        return;
    }

    if (!appState.resultsSubTab) {
        appState.resultsSubTab = 'exam';
    }

    // Pill tab switch header
    let headerHtml = `
        <div class="flex justify-center mb-6">
            <div class="bg-black/10 dark:bg-white/5 p-1 rounded-2xl flex gap-1 border border-white/5">
                <button onclick="window.switchResultsSubTab('exam')" class="px-5 py-2 text-[10px] font-black uppercase tracking-wider rounded-xl transition-all ${appState.resultsSubTab === 'exam' ? 'bg-[var(--mac-blue)] text-white shadow-md' : 'text-[#86868b] hover:text-white'}">
                    🏆 University Results
                </button>
                <button onclick="window.switchResultsSubTab('internal')" class="px-5 py-2 text-[10px] font-black uppercase tracking-wider rounded-xl transition-all ${appState.resultsSubTab === 'internal' ? 'bg-[var(--mac-blue)] text-white shadow-md' : 'text-[#86868b] hover:text-white'}">
                    🏫 College Results
                </button>
            </div>
        </div>
    `;

    if (appState.resultsSubTab === 'exam') {
        // University Exam Results view
        const examRaw = getPortalCache('ExamResult', adminNo);
        if (!examRaw) {
            container.innerHTML = headerHtml + `
                <div class="glass-panel rounded-[2rem] p-8 text-center my-6 relative overflow-hidden border border-white/5">
                    <div class="w-16 h-16 bg-black/5 dark:bg-white/5 rounded-2xl flex items-center justify-center text-3xl mx-auto mb-4 floating">🏆</div>
                    <h3 class="text-base font-black text-white">Exam Results Not Synced</h3>
                    <p class="text-[10px] font-bold text-[#86868b] mt-2 leading-relaxed mb-4">
                        Sync your university semester exam results from the college ePortal.
                    </p>
                    <button onclick="window.syncExamResults()" class="px-6 py-2.5 bg-[var(--mac-blue)] text-white rounded-full text-xs font-black spring active:scale-95">
                        🔄 Sync Academic Data
                    </button>
                </div>`;
            return;
        }

        let results = [];
        try {
            const parsed = JSON.parse(examRaw);
            results = parsed?.data?.payload?.results || parsed?.data?.results || parsed?.payload?.results || parsed?.results || [];
        } catch (e) {
            console.error(e);
        }

        // Dropdown filter for semesters
        const maxSem = getStudentSemNumber();
        const selectedSem = appState.selectedExamSem || 'all';
        const isSemOpen = appState.openInternalDropdown === 'semester';

        let semFilterHtml = `
            <div class="grid grid-cols-1 mb-5 w-full">
                <div class="seat-dropdown ${isSemOpen ? 'is-open' : ''}">
                    <button type="button" onclick="window.toggleInternalDropdown('semester')" class="seat-dropdown__trigger">
                        <div class="seat-dropdown__meta">
                            <span class="seat-dropdown__label">Semester Selection</span>
                            <span class="seat-dropdown__value">${selectedSem === 'all' ? 'All Semesters' : 'Semester ' + selectedSem}</span>
                        </div>
                        <span class="seat-dropdown__icon">⌄</span>
                    </button>
                    <div class="seat-dropdown__menu">
                        <button type="button" onclick="window.switchExamSemester('all')" class="seat-dropdown__option ${selectedSem === 'all' ? 'is-active' : ''}">
                            <span class="seat-dropdown__option-title">All Semesters</span>
                        </button>
                        ${Array.from({ length: maxSem }, (_, i) => {
                            const sem = String(i + 1);
                            const isActive = selectedSem === sem;
                            return `
                                <button type="button" onclick="window.switchExamSemester('${sem}')" class="seat-dropdown__option ${isActive ? 'is-active' : ''}">
                                    <span class="seat-dropdown__option-title">Semester ${sem}</span>
                                </button>
                            `;
                        }).join('')}
                    </div>
                </div>
            </div>
        `;

        let filteredResults = [];
        if (selectedSem === 'all') {
            filteredResults = results.map((r, idx) => ({ table: r, semNum: results.length - idx }));
        } else {
            const semNum = parseInt(selectedSem, 10);
            const totalSems = results.length;
            const targetIdx = totalSems - semNum;
            if (targetIdx >= 0 && targetIdx < totalSems) {
                filteredResults = [{ table: results[targetIdx], semNum }];
            }
        }

        let resultsHtml = '';
        if (filteredResults.length > 0) {
            resultsHtml = filteredResults.map(item => {
                const table = item.table;
                const headers = table.headers || [];
                const rows = table.rows || [];

                let tableRowsHtml = '';
                if (rows.length > 0) {
                    tableRowsHtml = rows.map(row => {
                        const passValue = row['Result'] || row['col_3'] || '';
                        const isFail = ['fail', 'f', 'absent', 'supply', 'reappear'].some(f => String(passValue).toLowerCase().includes(f));
                        const isPass = passValue && !isFail;
                        const rowClass = isPass ? 'row-pass' : isFail ? 'row-fail' : '';

                        return `
                            <tr class="${rowClass}">
                                ${headers.map(h => `<td>${row[h] ?? '—'}</td>`).join('')}
                            </tr>
                        `;
                    }).join('');
                } else {
                    tableRowsHtml = `<tr><td colspan="${headers.length || 1}" class="text-center text-xs text-[#86868b] py-4">No records found.</td></tr>`;
                }

                return `
                    <div class="glass-panel rounded-[2rem] p-6 mb-6 border border-white/5">
                        <div class="flex items-center gap-3 mb-4">
                            <span class="text-xl">🎓</span>
                            <h3 class="text-sm font-bold text-white">Semester ${item.semNum} Results</h3>
                        </div>
                        <div style="overflow-x:auto; border-radius:12px; border:1px solid var(--glass-border);">
                            <table class="data-table">
                                <thead>
                                    <tr>
                                        ${headers.map(h => `<th>${h}</th>`).join('')}
                                    </tr>
                                </thead>
                                <tbody>
                                    ${tableRowsHtml}
                                </tbody>
                            </table>
                        </div>
                    </div>
                `;
            }).join('');
        } else {
            resultsHtml = `
                <div class="glass-panel rounded-[2rem] p-8 text-center my-6 border border-white/5">
                    <div class="w-16 h-16 bg-black/5 dark:bg-white/5 rounded-2xl flex items-center justify-center text-3xl mx-auto mb-4 floating">🏆</div>
                    <h3 class="text-base font-black text-white">No Exam Results Published</h3>
                    <p class="text-[10px] font-bold text-[#86868b] mt-2 leading-relaxed">
                        No semester publication results are available in your portal account for Semester ${selectedSem}.
                    </p>
                </div>`;
        }

        container.innerHTML = headerHtml + semFilterHtml + resultsHtml;

    } else {
        // College Results / Internal Marks subtab
        const activeSem = appState.selectedInternalSem || String(getStudentSemNumber());
        const internalRaw = getPortalCache('InternalMark', adminNo, activeSem);
        const assessRaw = getPortalCache('Assessment', adminNo, activeSem);

        if (!appState.internalFetchStatus) {
            appState.internalFetchStatus = {};
        }
        const fetchStatus = appState.internalFetchStatus[activeSem];

        // If not fetched yet and no cached data, show skeleton and trigger fetch
        if (!internalRaw && !assessRaw && fetchStatus !== 'success' && fetchStatus !== 'error') {
            container.innerHTML = headerHtml + `
                <div class="flex justify-center mb-6 overflow-x-auto max-w-full no-scrollbar">
                    <div class="bg-black/10 dark:bg-white/5 p-1 rounded-2xl flex gap-1 border border-white/5">
                        ${['1', '2', '3', '4', '5', '6'].map(sem => {
                            const isActive = activeSem === sem;
                            return `
                                <button onclick="window.switchInternalSemester('${sem}')" 
                                        class="px-4 py-2 text-[10px] font-black uppercase tracking-wider rounded-xl transition-all ${isActive ? 'bg-[var(--mac-blue)] text-white shadow-md' : 'text-[#86868b] hover:text-white'}">
                                    Sem ${sem}
                                </button>
                            `;
                        }).join('')}
                    </div>
                </div>
                <div class="flex items-center justify-center p-12 my-6">
                    <div class="w-10 h-10 border-4 border-[var(--mac-blue)] border-t-transparent rounded-full animate-spin"></div>
                </div>
            `;
            window.autoFetchInternals(activeSem);
            return;
        }

        if (!internalRaw && !assessRaw) {
            container.innerHTML = headerHtml + `
                <div class="flex justify-center mb-6 overflow-x-auto max-w-full no-scrollbar">
                    <div class="bg-black/10 dark:bg-white/5 p-1 rounded-2xl flex gap-1 border border-white/5">
                        ${['1', '2', '3', '4', '5', '6'].map(sem => {
                            const isActive = activeSem === sem;
                            return `
                                <button onclick="window.switchInternalSemester('${sem}')" 
                                        class="px-4 py-2 text-[10px] font-black uppercase tracking-wider rounded-xl transition-all ${isActive ? 'bg-[var(--mac-blue)] text-white shadow-md' : 'text-[#86868b] hover:text-white'}">
                                    Sem ${sem}
                                </button>
                            `;
                        }).join('')}
                    </div>
                </div>
                <div class="glass-panel rounded-[2rem] p-8 text-center my-6 relative overflow-hidden border border-white/5">
                    <div class="w-16 h-16 bg-black/5 dark:bg-white/5 rounded-2xl flex items-center justify-center text-3xl mx-auto mb-4 floating">📝</div>
                    <h3 class="text-base font-black text-white">No College Data Found</h3>
                    <p class="text-[10px] font-bold text-[#86868b] mt-2 leading-relaxed mb-4">
                        We couldn't retrieve internal marks or CCA assessments for Semester ${activeSem} from the portal.
                    </p>
                    <button onclick="window.syncExamResults()" class="px-6 py-2.5 bg-[var(--mac-blue)] text-white rounded-full text-xs font-black spring active:scale-95">
                        🔄 Retry Sync
                    </button>
                </div>`;
            return;
        }

        // Set default filter type
        if (!appState.selectedInternalType) {
            appState.selectedInternalType = 'both';
        }
        const activeType = appState.selectedInternalType;
        const typeLabel = activeType === 'internal' 
            ? 'Internal Marks' 
            : activeType === 'model' 
                ? 'Model Exams' 
                : 'All College Marks';

        const maxSem = getStudentSemNumber();
        const semesters = [];
        for (let s = 1; s <= maxSem; s++) {
            semesters.push(String(s));
        }

        const isSemOpen = appState.openInternalDropdown === 'semester';
        const isTypeOpen = appState.openInternalDropdown === 'markType';

        let filterHtml = `
            <div class="grid grid-cols-2 gap-3 mb-5 w-full">
                <!-- Semester Selector -->
                <div class="seat-dropdown ${isSemOpen ? 'is-open' : ''}">
                    <button type="button" onclick="window.toggleInternalDropdown('semester')" class="seat-dropdown__trigger">
                        <div class="seat-dropdown__meta">
                            <span class="seat-dropdown__label">Semester</span>
                            <span class="seat-dropdown__value">Sem ${activeSem}</span>
                        </div>
                        <span class="seat-dropdown__icon">⌄</span>
                    </button>
                    <div class="seat-dropdown__menu">
                        ${semesters.map(sem => {
                            const isActive = activeSem === sem;
                            return `
                                <button type="button" onclick="window.switchInternalSemester('${sem}')" class="seat-dropdown__option ${isActive ? 'is-active' : ''}">
                                    <span class="seat-dropdown__option-title">Sem ${sem}</span>
                                    <span class="seat-dropdown__option-meta">View Semester ${sem} Marks</span>
                                </button>
                            `;
                        }).join('')}
                    </div>
                </div>
                <!-- Type Selector -->
                <div class="seat-dropdown ${isTypeOpen ? 'is-open' : ''}">
                    <button type="button" onclick="window.toggleInternalDropdown('markType')" class="seat-dropdown__trigger">
                        <div class="seat-dropdown__meta">
                            <span class="seat-dropdown__label">Mark Type</span>
                            <span class="seat-dropdown__value">${typeLabel}</span>
                        </div>
                        <span class="seat-dropdown__icon">⌄</span>
                    </button>
                    <div class="seat-dropdown__menu">
                        <button type="button" onclick="window.switchInternalType('both')" class="seat-dropdown__option ${activeType === 'both' ? 'is-active' : ''}">
                            <span class="seat-dropdown__option-title">All College Marks</span>
                            <span class="seat-dropdown__option-meta">Show internals & model exams</span>
                        </button>
                        <button type="button" onclick="window.switchInternalType('internal')" class="seat-dropdown__option ${activeType === 'internal' ? 'is-active' : ''}">
                            <span class="seat-dropdown__option-title">Internal Marks Only</span>
                            <span class="seat-dropdown__option-meta">Show final university internals</span>
                        </button>
                        <button type="button" onclick="window.switchInternalType('model')" class="seat-dropdown__option ${activeType === 'model' ? 'is-active' : ''}">
                            <span class="seat-dropdown__option-title">Model Exams Only</span>
                            <span class="seat-dropdown__option-meta">Show continuous evaluation model marks</span>
                        </button>
                    </div>
                </div>
            </div>
        `;

        // Parse continuous assessments and final internals
        let assessData = [];
        if (assessRaw) {
            try {
                const parsed = JSON.parse(assessRaw);
                assessData = parsed?.data?.payload?.sections || parsed?.data?.sections || parsed?.payload?.sections || parsed?.sections || [];
            } catch (e) {
                console.error(e);
            }
        }

        let internalSubjects = [];
        if (internalRaw) {
            try {
                const parsed = JSON.parse(internalRaw);
                internalSubjects = parsed?.data?.payload?.subjects || parsed?.data?.subjects || parsed?.payload?.subjects || parsed?.subjects || [];
            } catch (e) {
                console.error(e);
            }
        }

        // Render merged subjects
        const subjectNames = new Set();
        assessData.forEach(sec => { if (sec.subject) subjectNames.add(sec.subject); });
        internalSubjects.forEach(sub => { if (sub.subjectName) subjectNames.add(sub.subjectName); });

        let contentHtml = '';
        if (subjectNames.size > 0) {
            contentHtml = Array.from(subjectNames).map(subjectName => {
                const matchingAssess = assessData.find(sec => sec.subject && sec.subject.toLowerCase() === subjectName.toLowerCase());
                const matchingInternal = internalSubjects.find(sub => sub.subjectName && sub.subjectName.toLowerCase() === subjectName.toLowerCase());

                // Filter rows based on selection
                let rowsToRender = [];
                if (matchingAssess && matchingAssess.rows) {
                    matchingAssess.rows.forEach(r => {
                        const type = r['Assessment Type'] || r['col_0'] || '';
                        const isModel = type.toLowerCase().includes('model');
                        const isInternal = type.toLowerCase().includes('internal');
                        if (activeType === 'both') rowsToRender.push(r);
                        else if (activeType === 'model' && isModel) rowsToRender.push(r);
                        else if (activeType === 'internal' && isInternal) rowsToRender.push(r);
                    });
                }

                let finalUniversityHtml = '';
                if (matchingInternal && (activeType === 'both' || activeType === 'internal')) {
                    const score = matchingInternal.internalMark || matchingInternal.mark || matchingInternal.col_1 || '—';
                    const maxMark = matchingInternal.maxMark || matchingInternal.col_2 || '—';
                    finalUniversityHtml = `
                        <div class="flex items-center justify-between p-3.5 bg-white/5 dark:bg-white/5 border border-white/5 rounded-2xl">
                            <div class="flex flex-col">
                                <span class="text-[10px] font-bold text-white uppercase tracking-wider">Final University Internal</span>
                                <span class="text-[9px] text-[#86868b] mt-0.5">Calculated out of maximum university internal score</span>
                            </div>
                            <div class="flex items-baseline gap-0.5">
                                <span class="text-sm font-black text-[var(--mac-blue)]">${score}</span>
                                <span class="text-[9px] font-bold text-[#86868b]">/ ${maxMark}</span>
                            </div>
                        </div>
                    `;
                }

                let ccrRowsHtml = '';
                if (rowsToRender.length > 0) {
                    ccrRowsHtml = `
                        <div style="overflow-x:auto; border-radius:12px; border:1px solid var(--glass-border); margin-bottom: 12px;">
                            <table class="data-table">
                                <thead>
                                    <tr>
                                        <th>Assessment Type</th>
                                        <th>Score</th>
                                        <th>Max Mark</th>
                                        <th>Pass</th>
                                        <th>Result</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    ${rowsToRender.map(row => {
                                        const type = row['Assessment Type'] || row['col_0'] || '—';
                                        const score = row['Score'] || row['col_1'] || '—';
                                        const max = row['Max Mark'] || row['col_2'] || '—';
                                        const pass = row['Pass Mark'] || row['col_3'] || '—';
                                        const result = row['P/F'] || row['Result'] || row['col_4'] || '—';

                                        const isFail = ['fail', 'f'].some(f => String(result).toLowerCase().includes(f));
                                        const isPass = result && !isFail && result !== '—';
                                        const rowClass = isPass ? 'row-pass' : isFail ? 'row-fail' : '';

                                        return `
                                            <tr class="${rowClass}">
                                                <td>${type}</td>
                                                <td>${score}</td>
                                                <td>${max}</td>
                                                <td>${pass}</td>
                                                <td>${result}</td>
                                            </tr>
                                        `;
                                    }).join('')}
                                </tbody>
                            </table>
                        </div>
                    `;
                }

                if (!ccrRowsHtml && !finalUniversityHtml) return '';

                return `
                    <div class="glass-panel rounded-[2rem] p-5 mb-4 border border-white/5">
                        <div class="flex items-center gap-2.5 mb-3.5">
                            <span class="text-base">📝</span>
                            <h4 class="text-[12px] font-bold text-white">${subjectName}</h4>
                        </div>
                        ${ccrRowsHtml}
                        ${finalUniversityHtml}
                    </div>
                `;
            }).join('');
        }

        if (!contentHtml) {
            contentHtml = `
                <div class="glass-panel rounded-[2rem] p-8 text-center my-6 border border-white/5">
                    <p class="text-xs font-bold text-[#86868b]">No records found matching the chosen mark type for Semester ${activeSem}.</p>
                </div>`;
        }

        container.innerHTML = headerHtml + filterHtml + contentHtml;
    }
}