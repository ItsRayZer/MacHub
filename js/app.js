const EXAM_DAYS = [
    { label: 'Day 1', date: '16_04_2026' },
    { label: 'Day 2', date: '17_04_2026' },
    { label: 'Day 3', date: '18_04_2026' },
    { label: 'Day 4', date: '19_04_2026' },
    { label: 'Day 5', date: '20_04_2026' }
];

let appState = window.ExamHubState || { selectedDate: '16_04_2026', view: 'view-home', openSeatDropdown: null };
appState.selectedDate = appState.selectedDate || '16_04_2026';
appState.view = appState.view || 'view-home';
appState.openSeatDropdown = appState.openSeatDropdown || null;
if (typeof appState.completedSubjectsExpanded !== 'boolean') appState.completedSubjectsExpanded = false;

function getStudentInfo() {
    if (window.ExamHubProfileApi) return window.ExamHubProfileApi.getStudentInfo();
    try {
        return JSON.parse(localStorage.getItem('mac_student_info'));
    } catch (error) {
        return null;
    }
}

function saveStudentInfo(profile) {
    if (window.ExamHubProfileApi) return window.ExamHubProfileApi.saveStudentInfo(profile);
    localStorage.setItem('mac_student_info', JSON.stringify(profile));
    return profile;
}

function getISTDate(dateStr) {
    // dateStr format: "16-04-2026"
    const [day, month, year] = dateStr.split('-').map(Number);
    // Exam is at 10:30 AM IST = 05:00 AM UTC
    return new Date(Date.UTC(year, month - 1, day, 5, 0, 0));
}

function formatSeatDateLabel(dateStr) {
    const [day, month, year] = dateStr.split('-').map(Number);
    return new Date(year, month - 1, day).toLocaleDateString('en-IN', {
        day: 'numeric',
        month: 'short'
    }).toUpperCase();
}

function getStudentRecord(reg) {
    return window.STUDENT_NAMES?.[String(reg || '').toUpperCase()] || null;
}

function getStudentName(reg) {
    return getStudentRecord(reg)?.name || '';
}

function seatMatchesSearch(info, query) {
    if (!info || !query) return false;
    const searchable = [
        info.r,
        info.s,
        info.d,
        info.n,
        getStudentName(info.r)
    ].filter(Boolean).join(' ').toLowerCase();
    return searchable.includes(query);
}

function closeSeatDropdowns() {
    appState.openSeatDropdown = null;
}

function toggleSeatDropdown(name) {
    appState.openSeatDropdown = appState.openSeatDropdown === name ? null : name;
    renderDaySelector();
    renderFilters();
}

function updateCountdown() {
    if (!window.EXAM_TIMETABLE || window.EXAM_TIMETABLE.length === 0) return;

    const info = getStudentInfo();
    const userDept = info ? info.dept.toUpperCase() : null;

    if (info) {
        const homeGreeting = document.getElementById('homeGreeting');
        if (homeGreeting) homeGreeting.textContent = `Hi, ${info.name.split(' ')[0]}!`;
        const homeUserDept = document.getElementById('homeUserDept');
        if (homeUserDept) homeUserDept.textContent = info.dept;
    }

    const now = new Date();
    let nextExam = null;
    
    const sortedTimetable = getCountdownSchedule(userDept, now);

    for (let exam of sortedTimetable) {
        if (userDept && exam.dept.toUpperCase() !== userDept) continue;
        const examDate = getISTDate(exam.date);
        if (examDate > now) {
            nextExam = exam;
            break;
        }
    }

    const titleEl = document.getElementById('nextExamTitle');
    const dateEl = document.getElementById('nextExamDate');
    const daysEl = document.getElementById('daysLeft');
    const hoursEl = document.getElementById('hoursLeft');
    const minsEl = document.getElementById('minsLeft');
    const secsEl = document.getElementById('secsLeft');

    if (!nextExam) {
        if (titleEl) titleEl.textContent = "All exams completed!";
        if (dateEl) dateEl.textContent = "Good luck with your results!";
        if (daysEl) daysEl.textContent = "00";
        if (hoursEl) hoursEl.textContent = "00";
        if (minsEl) minsEl.textContent = "00";
        if (secsEl) secsEl.textContent = "00";
        return;
    }

    const targetDate = getISTDate(nextExam.date);
    const diff = targetDate - now;

    if (diff <= 0) {
        if (titleEl) titleEl.textContent = "Exam Started!";
        if (dateEl) dateEl.textContent = nextExam.date;
        return;
    }

    const days = Math.floor(diff / (1000 * 60 * 60 * 24));
    const hours = Math.floor((diff % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
    const mins = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
    const secs = Math.floor((diff % (1000 * 60)) / 1000);

    if (daysEl) daysEl.textContent = days.toString().padStart(2, '0');
    if (hoursEl) hoursEl.textContent = hours.toString().padStart(2, '0');
    if (minsEl) minsEl.textContent = mins.toString().padStart(2, '0');
    if (secsEl) secsEl.textContent = secs.toString().padStart(2, '0');

    if (titleEl) titleEl.textContent = nextExam.title;
    if (dateEl) dateEl.textContent = `${nextExam.date} - ${nextExam.dept} - ${nextExam.type === 'practical' ? 'Practical' : (nextExam.time || '10:30 AM')}`;
}

function updateLiveClock() {
    const now = new Date();
    const clockEl = document.getElementById('liveClock');
    if (clockEl) {
        clockEl.textContent = now.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', second: '2-digit' });
    }
}

// Guard so startTimers only ever creates ONE interval
let _timersStarted = false;
function startTimers() {
    if (_timersStarted) return;
    _timersStarted = true;
    updateCountdown();
    updateLiveClock();
    setInterval(() => {
        updateCountdown();
        updateLiveClock();
    }, 1000);
}

// We make ALL_DEPARTMENTS let so we can overwrite it when switching days
let ALL_DEPARTMENTS = [];
let RAW_DATA = [];
let HALL_DATA = {};
let HALL_KEYS = [];

function switchView(viewId) {
    appState.view = viewId;
    document.querySelectorAll('.view-panel').forEach(el => {
        el.classList.remove('is-active');
    });
    const panel = document.getElementById(viewId);
    if (panel) {
        panel.classList.add('is-active');
    }

    // Show header only on home
    const header = document.getElementById('appHeader');
    if (header) header.style.display = viewId === 'view-home' ? '' : 'none';
    
    if (viewId === 'view-timetable') renderTimetable();
    if (viewId === 'view-departments') renderDepartments();
    if (viewId === 'view-home') updateCountdown();
    if (viewId === 'view-seats') showSeatNote();

    // Update Nav Bar active & Indicator movement
    const tabs = ['view-home', 'view-timetable', 'view-seats'];
    const navPill = document.getElementById('navPill');
    const nextIndex = tabs.indexOf(viewId);

    if (navPill && nextIndex !== -1) {
        const currentOption = navPill.getAttribute('c-current') || '1';
        const nextOption = String(nextIndex + 1);
        navPill.setAttribute('c-previous', currentOption);
        navPill.setAttribute('c-current', nextOption);
    }

    tabs.forEach((tab, index) => {
        const btn = document.getElementById('tab-' + tab);
        if (!btn) return;
        if (tab === viewId) {
            btn.classList.add('active');
        } else {
            btn.classList.remove('active');
        }
    });
}

function renderDaySelector() {
    const ds = document.getElementById('daySelector');
    if(!ds) return;
    
    const info = getStudentInfo();
    const userDept = info ? info.dept.toUpperCase() : 'BCA';

    const deptExams = window.EXAM_TIMETABLE.filter(e => e.dept.toUpperCase() === userDept);
    const uniqueDates = [...new Set(deptExams.map(e => e.date))];
    const selectedDate = appState.selectedDate.replace(/_/g, '-');
    const activeDate = uniqueDates.includes(selectedDate) ? selectedDate : uniqueDates[0];
    const isOpen = appState.openSeatDropdown === 'date';

    ds.innerHTML = `
        <div class="seat-dropdown ${isOpen ? 'is-open' : ''}">
            <button type="button" onclick="toggleSeatDropdown('date')" class="seat-dropdown__trigger">
                <div class="seat-dropdown__meta">
                    <span class="seat-dropdown__label">Next Exam</span>
                    <span class="seat-dropdown__value">${formatSeatDateLabel(activeDate)}</span>
                </div>
                <span class="seat-dropdown__icon">⌄</span>
            </button>
            <div class="seat-dropdown__menu">
                ${uniqueDates.map(dateStr => {
                    const folderName = dateStr.replace(/-/g, '_');
                    const isActive = activeDate === dateStr;
                    return `
                        <button type="button" onclick="selectDay('${folderName}')" class="seat-dropdown__option ${isActive ? 'is-active' : ''}">
                            <span class="seat-dropdown__option-title">${formatSeatDateLabel(dateStr)}</span>
                            <span class="seat-dropdown__option-meta">${dateStr}</span>
                        </button>
                    `;
                }).join('')}
            </div>
        </div>
    `;
}

function selectDay(dateStr) {
    appState.selectedDate = dateStr;
    closeSeatDropdowns();
    renderDaySelector();

    // Clear old data globally
    window.BCA_DATA = null;
    window.BBA_DATA = null;
    window.BSW_DATA = null;
    ALL_DEPARTMENTS = [];
    RAW_DATA = [];

    // UI show loading state
    const gridParent = document.getElementById('seatingGrid')?.parentElement?.parentElement;
    if (gridParent) gridParent.classList.add('hidden');
    const emptyState = document.getElementById('emptyState');
    if (emptyState) emptyState.classList.add('hidden');
    const hallTabsParent = document.getElementById('hallTabs')?.parentElement;
    if (hallTabsParent) hallTabsParent.classList.add('hidden');

    window.ExamHubSeats.loadDay(dateStr).then((payload) => {
        applyLoadedSeatData(payload);

        if (gridParent) gridParent.classList.remove('hidden');
        if (hallTabsParent) hallTabsParent.classList.remove('hidden');
    }).catch(() => {
        if (emptyState) emptyState.classList.remove('hidden');
    });
}

function applyLoadedSeatData(payload) {
    ALL_DEPARTMENTS = payload.allDepartments || [];
    RAW_DATA = payload.rawData || [];
    HALL_DATA = payload.halls || {};
    HALL_KEYS = Object.keys(HALL_DATA);
    app.h = payload.firstHall || "Hall 1";
    render();
    updateHomeSeatInfo();
}

function renderDepartmentOptions(depts) {
    const selectedDept = app.f === 'ALL' ? 'ALL' : app.f;
    return depts.map(dept => {
        const isActive = selectedDept === dept;
        return `
            <button type="button" onclick="setFilter('${dept}')" class="seat-dropdown__option ${isActive ? 'is-active' : ''}">
                <span class="seat-dropdown__option-title">${dept}</span>
                <span class="seat-dropdown__option-meta">${dept === 'ALL' ? 'All departments' : 'Department filter'}</span>
            </button>
        `;
    }).join('');
}

function injectScript(src) {
    return new Promise((resolve, reject) => {
        const s = document.createElement('script');
        s.src = src;
        s.onload = resolve;
        s.onerror = reject;
        document.body.appendChild(s);
    });
}

function processLoadedData() {
    const rawAll = [
        ...(window.BCA_DATA || []),
        ...(window.BBA_DATA || []),
        ...(window.BSW_DATA || []),
    ];
    
    // Purify data: Only include the 3 core departments
    ALL_DEPARTMENTS = rawAll.filter(d => ['BCA', 'BBA', 'BSW'].includes(d[6].toUpperCase()));

    
    RAW_DATA = [];
    const seatGroups = {};
    ALL_DEPARTMENTS.forEach(([roll, hall, room, sec, row, side, dept]) => {
        let rowNum = row === 'ESK' ? 0 : parseInt(row);
        const key = hall + "|" + room + "|" + sec + "|" + rowNum;
        
        if (!seatGroups[key]) {
            seatGroups[key] = { h: hall, aud: room, c: sec, r: rowNum, l: null, ri: null };
        }
        
        const reg = roll.toUpperCase();
        const student = getStudentRecord(reg);
        const seatObj = { d: dept, r: reg, s: dept, n: student?.name || '', g: student?.gender || '' };
        
        if (side === "Left") seatGroups[key].l = seatObj;
        else seatGroups[key].ri = seatObj;
    });

    Object.values(seatGroups).forEach(g => RAW_DATA.push(g));
    RAW_DATA.sort((a,b) => {
        if(a.c !== b.c) return a.c - b.c;
        return a.r - b.r;
    });
    HALL_DATA = {};
    RAW_DATA.forEach(item => {
        (HALL_DATA[item.h] ||= []).push(item);
    });
    HALL_KEYS = Object.keys(HALL_DATA);
    app.h = RAW_DATA.length > 0 ? RAW_DATA[0].h : "Hall 1"; // Default to first hall found
    render();
    updateHomeSeatInfo();
}

function updateHomeSeatInfo() {
    const infoStr = getStudentInfo();
    if (!infoStr) return;
    const info = infoStr;
    
    const hallEl = document.getElementById('homeUserHall');
    const seatEl = document.getElementById('homeUserSeat');
    if (!hallEl || !seatEl) return;

    if (!info.reg) {
        hallEl.textContent = "N/A";
        seatEl.textContent = "Set Reg No";
        return;
    }

    const match = ALL_DEPARTMENTS.find(d => d[0].toLowerCase().includes(info.reg.toLowerCase()));
    if (match) {
        // match format: [roll, hall, room, sec, row, side, dept]
        hallEl.textContent = match[1];
        seatEl.textContent = `B${match[3]} / R${match[4] === 'ESK' ? '0' : match[4]}`;
    } else {
        hallEl.textContent = "---";
        seatEl.textContent = "Not in data";
    }
}

function getExamEndTime(dateStr) {
    // After 12:00 PM IST = 06:30 UTC, exam is considered over
    const [day, month, year] = dateStr.split('-').map(Number);
    return new Date(Date.UTC(year, month - 1, day, 6, 30, 0));
}

function getDepartmentScheduleByCode(deptCode) {
    const deptMap = {
        'BCA': window.TIMETABLE_BCA,
        'BBA': window.TIMETABLE_BBA,
        'BSW': window.TIMETABLE_BSW
    };

    return (deptMap[deptCode] || []).slice().sort((a, b) => getISTDate(a.date) - getISTDate(b.date));
}

function getDepartmentPracticalScheduleByCode(deptCode) {
    const practicalMap = {
        'BCA': window.PRACTICAL_TIMETABLE_BCA
    };

    return (practicalMap[deptCode] || []).slice().sort((a, b) => getISTDate(a.date) - getISTDate(b.date));
}

function markScheduleDept(schedule, dept, type) {
    return schedule.map(exam => ({
        ...exam,
        dept,
        type: exam.type || type
    }));
}

function areAllTheoryExamsCompleted(theorySchedule, now) {
    return theorySchedule.length > 0 && theorySchedule.every(exam => now > getExamEndTime(exam.date));
}

function getCountdownSchedule(userDept, now) {
    if (userDept) {
        const theorySchedule = markScheduleDept(getDepartmentScheduleByCode(userDept), userDept, 'theory');
        const practicalSchedule = markScheduleDept(getDepartmentPracticalScheduleByCode(userDept), userDept, 'practical');
        const activeSchedule = areAllTheoryExamsCompleted(theorySchedule, now)
            ? practicalSchedule
            : theorySchedule;

        return activeSchedule.sort((a, b) => getISTDate(a.date) - getISTDate(b.date));
    }

    return [...window.EXAM_TIMETABLE].sort((a, b) => getISTDate(a.date) - getISTDate(b.date));
}

function clamp(value, min, max) {
    return Math.min(max, Math.max(min, value));
}

function formatShortExamDate(dateStr) {
    const [day, month, year] = dateStr.split('-').map(Number);
    return new Date(year, month - 1, day).toLocaleDateString('en-IN', {
        day: 'numeric',
        month: 'short'
    });
}

function formatLongExamDate(dateStr) {
    const [day, month, year] = dateStr.split('-').map(Number);
    return new Date(year, month - 1, day).toLocaleDateString('en-IN', {
        weekday: 'short',
        day: 'numeric',
        month: 'long',
        year: 'numeric'
    });
}

function getDaysBetween(fromDate, toDate) {
    return Math.max(0, (toDate - fromDate) / (1000 * 60 * 60 * 24));
}

function getCountdownLabel(targetDate, now) {
    const diff = targetDate - now;
    if (diff <= 0) return 'Ready now';

    const days = Math.floor(diff / (1000 * 60 * 60 * 24));
    const hours = Math.floor((diff % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));

    if (days > 0) return `${days}d ${hours}h left`;
    if (hours > 0) return `${hours}h left`;
    const mins = Math.max(1, Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60)));
    return `${mins}m left`;
}

function buildTimetableMapMetrics(schedule) {
    const baseTop = 96;
    const baseStopHeight = 132;
    let currentTop = baseTop;

    return schedule.map((exam, index) => {
        const nextExam = schedule[index + 1];
        const connectorHeight = nextExam
            ? Math.round(clamp(88 + (getDaysBetween(getExamEndTime(exam.date), getISTDate(nextExam.date)) * 28), 88, 220))
            : 0;

        const metric = {
            ...exam,
            index,
            top: currentTop,
            laneOffset: index % 2 === 0 ? 0 : 14,
            connectorHeight
        };

        currentTop += baseStopHeight + connectorHeight;
        return metric;
    });
}

function getTimetableMarkerPosition(metrics, now) {
    if (!metrics.length) return { top: 18, label: 'Journey starting' };

    const routeStart = new Date(getISTDate(metrics[0].date).getTime() - 36 * 60 * 60 * 1000);
    const firstTop = metrics[0].top + 2;

    if (now <= routeStart) {
        return { top: 18, label: 'Journey starting' };
    }

    if (now < getISTDate(metrics[0].date)) {
        const ratio = clamp((now - routeStart) / (getISTDate(metrics[0].date) - routeStart), 0, 1);
        return {
            top: 18 + ((firstTop - 18) * ratio),
            label: `Approaching ${metrics[0].title}`
        };
    }

    for (let i = 0; i < metrics.length; i++) {
        const currentExam = metrics[i];
        const examStart = getISTDate(currentExam.date);
        const examEnd = getExamEndTime(currentExam.date);

        if (now >= examStart && now <= examEnd) {
            return {
                top: currentExam.top + 2,
                label: `${currentExam.title} in progress`
            };
        }

        const nextExam = metrics[i + 1];
        if (nextExam && now > examEnd && now < getISTDate(nextExam.date)) {
            const startTop = currentExam.top + 2;
            const endTop = nextExam.top + 2;
            const ratio = clamp((now - examEnd) / (getISTDate(nextExam.date) - examEnd), 0, 1);
            return {
                top: startTop + ((endTop - startTop) * ratio),
                label: `Gliding to ${nextExam.title}`
            };
        }
    }

    return {
        top: metrics[metrics.length - 1].top + 2,
        label: 'Final exam reached'
    };
}

function getMarksEntry(dept, examCode) {
    const marksData = window.EXAM_MARKS_DATA || [];
    return marksData.find(entry => entry.dept === dept && entry.code === examCode) || null;
}

function escapeHtml(value) {
    return String(value).replace(/[&<>"']/g, char => ({
        '&': '&amp;',
        '<': '&lt;',
        '>': '&gt;',
        '"': '&quot;',
        "'": '&#39;'
    }[char]));
}

let currentPredictionEntry = null;
let currentPredictionState = [];
let currentPredictionKey = '';
let currentQuestionPaperUrl = '';

function getPredictionStorageKey(dept, examCode) {
    return `mac_exam_prediction_${dept}_${examCode}`;
}

function normalizeExamCodeKey(examCode) {
    return String(examCode || '').replace(/\s+/g, '').toUpperCase();
}

function getQuestionPaperUrl(dept, examCode) {
    const entry = getMarksEntry(dept, examCode);
    if (entry?.questionPaperPdf) return entry.questionPaperPdf;
    if (entry?.questionPaperUrl) return entry.questionPaperUrl;

    const paperMap = window.EXAM_QUESTION_PAPERS || {};
    const normalizedCode = normalizeExamCodeKey(examCode);

    return (
        paperMap[`${String(dept || '').toUpperCase()}::${normalizedCode}`] ||
        paperMap[normalizedCode] ||
        null
    );
}

function createPredictionState(entry) {
    return (entry.questions || []).map(question => ({
        selectedOption: question.type === 'optional' ? null : null,
        selfScore: question.type === 'optional' ? null : ''
    }));
}

function clampScore(value, maxMarks) {
    const numeric = Number(value);
    if (Number.isNaN(numeric)) return 0;
    return Math.max(0, Math.min(maxMarks, numeric));
}

function normalizePredictionState(entry, savedState) {
    if (!Array.isArray(savedState)) return createPredictionState(entry);

    return (entry.questions || []).map((question, index) => {
        const savedQuestion = savedState[index] || {};

        if (question.type === 'optional') {
            const optionIndex = Number.isInteger(savedQuestion.selectedOption) ? savedQuestion.selectedOption : null;
            const isValidOption = optionIndex !== null && optionIndex >= 0 && optionIndex < (question.options?.length || 0);
            return {
                selectedOption: isValidOption ? optionIndex : null,
                selfScore: null
            };
        }

        const rawScore = savedQuestion.selfScore;
        return {
            selectedOption: null,
            selfScore: rawScore === '' || rawScore === null || typeof rawScore === 'undefined'
              ? ''
              : clampScore(rawScore, question.marks)
        };
    });
}

function loadPredictionState(entry, dept, examCode) {
    const storageKey = getPredictionStorageKey(dept, examCode);
    currentPredictionKey = storageKey;

    try {
        const saved = localStorage.getItem(storageKey);
        if (!saved) return createPredictionState(entry);
        return normalizePredictionState(entry, JSON.parse(saved));
    } catch (error) {
        return createPredictionState(entry);
    }
}

function savePredictionState() {
    if (!currentPredictionKey) return;
    try {
        localStorage.setItem(currentPredictionKey, JSON.stringify(currentPredictionState));
    } catch (error) {
        // Ignore storage issues so prediction UI still works in-memory.
    }
}

function getQuestionScore(question, state) {
    if (!question || !state) return 0;

    if (question.type === 'optional') {
        if (state.selectedOption === null) return 0;
        const selected = question.options?.[state.selectedOption];
        return selected && selected.isCorrect ? question.marks : 0;
    }

    if (state.selfScore === '' || state.selfScore === null || typeof state.selfScore === 'undefined') {
        return 0;
    }

    return clampScore(state.selfScore, question.marks);
}

function getPredictedGrade(total, maxTotal) {
    if (!maxTotal) return '--';
    const percentage = (total / maxTotal) * 100;
    if (percentage >= 90) return 'A+';
    if (percentage >= 80) return 'A';
    if (percentage >= 70) return 'B+';
    if (percentage >= 60) return 'B';
    if (percentage >= 50) return 'C';
    if (percentage >= 40) return 'D';
    return 'F';
}

function calculatePredictionSummary(entry, state) {
    const questions = entry?.questions || [];
    const totalQuestions = questions.length;
    let completedQuestions = 0;
    let total = 0;

    questions.forEach((question, index) => {
        const questionState = state[index];
        if (!questionState) return;

        if (question.type === 'optional') {
            if (questionState.selectedOption !== null) completedQuestions += 1;
        } else if (questionState.selfScore !== '' && questionState.selfScore !== null && typeof questionState.selfScore !== 'undefined') {
            completedQuestions += 1;
        }

        total += getQuestionScore(question, questionState);
    });

    return {
        total,
        totalQuestions,
        completedQuestions,
        totalMarks: entry.totalMarks,
        grade: getPredictedGrade(total, entry.totalMarks)
    };
}

function renderPredictionSummary(entry) {
    const summaryEl = document.getElementById('marksSummary');
    if (!summaryEl) return;

    const summary = calculatePredictionSummary(entry, currentPredictionState);
    summaryEl.innerHTML = `
        <p class="text-[10px] font-black text-[#86868b] uppercase tracking-widest mb-3">Prediction Panel</p>
        <div class="grid grid-cols-3 gap-3">
            <div class="bg-black/5 dark:bg-white/5 rounded-2xl p-3">
                <p class="text-2xl font-black tracking-tight text-[var(--mac-blue)]">${summary.total}/${summary.totalMarks}</p>
                <p class="text-[9px] font-bold text-[#86868b] uppercase tracking-widest mt-1">Predicted</p>
            </div>
            <div class="bg-black/5 dark:bg-white/5 rounded-2xl p-3">
                <p class="text-2xl font-black tracking-tight text-[#1d1d1f] dark:text-[#f5f5f7]">${summary.grade}</p>
                <p class="text-[9px] font-bold text-[#86868b] uppercase tracking-widest mt-1">Grade</p>
            </div>
            <div class="bg-black/5 dark:bg-white/5 rounded-2xl p-3">
                <p class="text-2xl font-black tracking-tight text-[#1d1d1f] dark:text-[#f5f5f7]">${summary.completedQuestions}/${summary.totalQuestions}</p>
                <p class="text-[9px] font-bold text-[#86868b] uppercase tracking-widest mt-1">Checked</p>
            </div>
        </div>
        <p class="text-xs font-bold text-[#86868b] mt-4">Select the option you attempted for optional questions and enter self-marks for descriptive answers after comparing with the sample answer.</p>
    `;
}

function renderPredictionQuestions(entry) {
    const questionListEl = document.getElementById('marksQuestionList');
    if (!questionListEl) return;

    questionListEl.innerHTML = entry.questions.map((question, index) => {
        const state = currentPredictionState[index] || {};
        const currentScore = getQuestionScore(question, state);

        if (question.type === 'optional') {
            const selectedOption = state.selectedOption;
            const selectedAnswer = selectedOption !== null ? question.options[selectedOption] : null;

            return `
                <div class="glass-panel rounded-[1.75rem] p-4">
                    <div class="flex items-start justify-between gap-3 mb-3">
                        <div>
                            <p class="text-[10px] font-black text-[#86868b] uppercase tracking-widest mb-1">${escapeHtml(question.label)} • Optional</p>
                            <p class="text-sm font-bold text-[#1d1d1f] dark:text-[#f5f5f7] leading-relaxed">${escapeHtml(question.prompt)}</p>
                        </div>
                        <span class="px-3 py-1 rounded-full bg-[var(--mac-blue)]/10 text-[var(--mac-blue)] text-[10px] font-black whitespace-nowrap">${question.marks} Mark${question.marks > 1 ? 's' : ''}</span>
                    </div>
                    <div class="grid gap-2">
                        ${question.options.map((option, optionIndex) => `
                            <button onclick="setSelectedOption(${index}, ${optionIndex})" class="text-left px-4 py-3 rounded-2xl border font-bold text-sm transition-all ${
                                selectedOption === optionIndex
                                  ? 'bg-[var(--mac-blue)] text-white border-transparent shadow-lg'
                                  : 'bg-black/5 dark:bg-white/5 border-black/5 dark:border-white/10 text-[#1d1d1f] dark:text-[#f5f5f7]'
                            }">
                                ${escapeHtml(option.text)}
                            </button>
                        `).join('')}
                    </div>
                    <div class="mt-4 pt-4 border-t border-black/5 dark:border-white/5">
                        <p class="text-[10px] font-black text-[var(--mac-blue)] uppercase tracking-widest mb-2">Result</p>
                        <p class="text-sm font-bold text-[#86868b] leading-relaxed">${selectedAnswer ? escapeHtml(selectedAnswer.answer) : 'Select the option you wrote in the exam to auto-check this question.'}</p>
                        <div class="mt-3 flex items-center justify-between gap-3">
                            <p class="text-[10px] font-bold text-[#86868b] uppercase tracking-widest">${selectedAnswer ? (selectedAnswer.isCorrect ? 'Matched Correct Answer' : 'Selected Option Is Wrong') : 'Awaiting Your Selection'}</p>
                            <p class="text-sm font-black text-[var(--mac-blue)]">${currentScore}/${question.marks}</p>
                        </div>
                    </div>
                </div>
            `;
        }

        return `
            <div class="glass-panel rounded-[1.75rem] p-4">
                <div class="flex items-start justify-between gap-3 mb-3">
                    <div>
                        <p class="text-[10px] font-black text-[#86868b] uppercase tracking-widest mb-1">${escapeHtml(question.label)} • ${question.type === 'long' ? 'Long Answer' : 'Short Answer'}</p>
                        <p class="text-sm font-bold text-[#1d1d1f] dark:text-[#f5f5f7] leading-relaxed">${escapeHtml(question.prompt)}</p>
                    </div>
                    <span class="px-3 py-1 rounded-full bg-[var(--mac-blue)]/10 text-[var(--mac-blue)] text-[10px] font-black whitespace-nowrap">${question.marks} Mark${question.marks > 1 ? 's' : ''}</span>
                </div>
                <div class="rounded-2xl bg-black/5 dark:bg-white/5 p-4">
                    <p class="text-[10px] font-black text-[var(--mac-blue)] uppercase tracking-widest mb-2">Sample Full Answer</p>
                    <p class="text-sm font-bold text-[#86868b] leading-relaxed">${escapeHtml(question.answer)}</p>
                </div>
                <div class="mt-4 flex items-end gap-3">
                    <div class="flex-1">
                        <p class="text-[10px] font-black text-[#86868b] uppercase tracking-widest mb-2">Your Self Mark</p>
                        <input type="number" min="0" max="${question.marks}" step="0.5" value="${state.selfScore}" oninput="setSelfScore(${index}, this.value)" class="w-full px-4 py-3 rounded-2xl bg-black/5 dark:bg-white/10 text-[#1d1d1f] dark:text-[#f5f5f7] font-bold text-base outline-none border border-transparent focus:border-[var(--mac-blue)] transition-all" placeholder="0 to ${question.marks}">
                    </div>
                    <div class="px-4 py-3 rounded-2xl bg-[var(--mac-blue)]/10 text-center min-w-[84px]">
                        <p id="questionScore-${index}" class="text-lg font-black text-[var(--mac-blue)]">${currentScore}/${question.marks}</p>
                        <p class="text-[9px] font-bold text-[#86868b] uppercase tracking-widest mt-1">Scored</p>
                    </div>
                </div>
                <p class="text-xs font-bold text-[#86868b] mt-3">${escapeHtml(question.guidance || 'Compare your answer and enter the mark you think you should receive.')}</p>
            </div>
        `;
    }).join('');
}

function rerenderPredictionUi() {
    if (!currentPredictionEntry) return;
    renderPredictionSummary(currentPredictionEntry);
    renderPredictionQuestions(currentPredictionEntry);
}

function setSelectedOption(questionIndex, optionIndex) {
    if (!currentPredictionState[questionIndex]) return;
    currentPredictionState[questionIndex].selectedOption = optionIndex;
    savePredictionState();
    rerenderPredictionUi();
}

function setSelfScore(questionIndex, value) {
    const question = currentPredictionEntry?.questions?.[questionIndex];
    if (!question || !currentPredictionState[questionIndex]) return;

    currentPredictionState[questionIndex].selfScore = value === '' ? '' : clampScore(value, question.marks);
    savePredictionState();
    renderPredictionSummary(currentPredictionEntry);
    const scoreEl = document.getElementById(`questionScore-${questionIndex}`);
    if (scoreEl) scoreEl.textContent = `${getQuestionScore(question, currentPredictionState[questionIndex])}/${question.marks}`;
}

function resetPredictionState() {
    if (!currentPredictionEntry) return;

    currentPredictionState = createPredictionState(currentPredictionEntry);

    if (currentPredictionKey) {
        try {
            localStorage.removeItem(currentPredictionKey);
        } catch (error) {
            // Ignore storage issues and still reset the in-memory state.
        }
    }

    rerenderPredictionUi();
}

function openMarksSheet(dept, examCode) {
    const deptScheduleMap = {
        'BCA': window.TIMETABLE_BCA,
        'BBA': window.TIMETABLE_BBA,
        'BSW': window.TIMETABLE_BSW
    };
    const exam = (deptScheduleMap[dept] || []).find(item => item.code === examCode);
    if (!exam) return;

    const entry = getMarksEntry(dept, examCode);
    const titleEl = document.getElementById('marksSheetTitle');
    const deptEl = document.getElementById('marksSheetDept');
    const metaEl = document.getElementById('marksSheetMeta');
    const summaryEl = document.getElementById('marksSummary');
    const questionListEl = document.getElementById('marksQuestionList');
    const availableState = document.getElementById('marksAvailableState');
    const comingSoonState = document.getElementById('marksComingSoonState');
    const questionPaperLink = document.getElementById('marksQuestionPaperLink');
    const sheet = document.getElementById('marksSheet');
    const backdrop = document.getElementById('marksBackdrop');

    if (titleEl) titleEl.textContent = exam.title;
    if (deptEl) deptEl.textContent = dept;
    if (metaEl) metaEl.textContent = `${exam.date} • ${exam.code}`;

    currentQuestionPaperUrl = getQuestionPaperUrl(dept, examCode) || '';
    if (questionPaperLink) {
        if (currentQuestionPaperUrl) {
            questionPaperLink.href = currentQuestionPaperUrl;
            questionPaperLink.download = `${normalizeExamCodeKey(examCode)}-question-paper.pdf`;
            questionPaperLink.classList.remove('hidden');
        } else {
            questionPaperLink.href = '#';
            questionPaperLink.download = '';
            questionPaperLink.classList.add('hidden');
        }
    }

    if (entry) {
        currentPredictionEntry = entry;
        currentPredictionState = loadPredictionState(entry, dept, examCode);
        renderPredictionSummary(entry);
        renderPredictionQuestions(entry);

        if (availableState) availableState.classList.remove('hidden');
        if (comingSoonState) comingSoonState.classList.add('hidden');
    } else {
        currentPredictionEntry = null;
        currentPredictionState = [];
        currentPredictionKey = '';
        if (summaryEl) summaryEl.innerHTML = '';
        if (questionListEl) questionListEl.innerHTML = '';
        if (availableState) availableState.classList.add('hidden');
        if (comingSoonState) comingSoonState.classList.remove('hidden');
    }

    initDraggableSheet('marksSheet', 'marksSheetDragHandle', closeMarksSheetState);
    if (sheet) snapSheetOpen(sheet);
    if (backdrop) backdrop.classList.remove('hidden');
    hideBottomNav();
}

function closeMarksSheetState() {
    const backdrop = document.getElementById('marksBackdrop');
    if (backdrop) backdrop.classList.add('hidden');
    currentPredictionEntry = null;
    currentPredictionState = [];
    currentPredictionKey = '';
    currentQuestionPaperUrl = '';
    showBottomNav();
}

function closeMarksSheet() {
    const sheet = document.getElementById('marksSheet');
    snapSheetClosed(sheet, closeMarksSheetState);
}

function openTimetableExamSheet(index) {
    const schedule = window.ACTIVE_TIMETABLE_SCHEDULE || [];
    const exam = schedule[index];
    if (!exam) return;

    const now = new Date();
    const examStart = getISTDate(exam.date);
    const examEnd = getExamEndTime(exam.date);
    const isPractical = window.ACTIVE_TIMETABLE_TYPE === 'practical' || exam.type === 'practical';
    const isCompleted = now > examEnd;
    const isCurrent = now >= examStart && now <= examEnd;
    const nextExam = schedule[index + 1];

    const badgeEl = document.getElementById('timetableExamSheetBadge');
    const titleEl = document.getElementById('timetableExamSheetTitle');
    const dateEl = document.getElementById('timetableExamSheetDate');
    const codeEl = document.getElementById('timetableExamSheetCode');
    const timeEl = document.getElementById('timetableExamSheetTime');
    const deptEl = document.getElementById('timetableExamSheetDept');
    const statusEl = document.getElementById('timetableExamSheetStatus');
    const insightEl = document.getElementById('timetableExamSheetInsight');
    const marksBtn = document.getElementById('timetableExamSheetMarks');

    if (titleEl) titleEl.textContent = exam.title;
    if (dateEl) dateEl.textContent = formatLongExamDate(exam.date);
    if (codeEl) codeEl.textContent = exam.code || '---';
    if (timeEl) timeEl.textContent = isPractical ? (exam.time || 'Tentative') : (exam.time || '10:30 AM');
    if (deptEl) deptEl.textContent = isPractical ? `${window.ACTIVE_TIMETABLE_DEPT || '---'} Practical` : (window.ACTIVE_TIMETABLE_DEPT || '---');

    let badgeText = 'Upcoming';
    let badgeClass = 'px-3 py-1 rounded-full bg-[var(--mac-blue)]/10 text-[var(--mac-blue)] text-[10px] font-black uppercase tracking-[0.18em]';
    let statusText = getCountdownLabel(examStart, now);
    let insightText = nextExam
        ? `${Math.max(1, Math.round(getDaysBetween(examEnd, getISTDate(nextExam.date))))} day transition to ${nextExam.title}.`
        : isPractical ? 'This is the final practical examination listed.' : 'This is the final stop in your exam journey.';

    if (isPractical) {
        badgeText = 'Practical';
        badgeClass = 'px-3 py-1 rounded-full bg-amber-500/10 text-amber-600 text-[10px] font-black uppercase tracking-[0.18em]';
        statusText = isCompleted ? 'Practical date passed' : getCountdownLabel(examStart, now);
        insightText = nextExam
            ? `Next practical: ${nextExam.title}.`
            : 'Last tentative practical date for BCA second semester.';
    }

    if (!isPractical && isCompleted) {
        badgeText = 'Completed';
        badgeClass = 'px-3 py-1 rounded-full bg-green-500/10 text-green-600 text-[10px] font-black uppercase tracking-[0.18em]';
        statusText = 'Completed after 12:00 PM';
        insightText = nextExam
            ? `The liquid route has already moved on toward ${nextExam.title}.`
            : 'You have finished the final exam on the route.';
    } else if (!isPractical && isCurrent) {
        badgeText = 'Live';
        badgeClass = 'px-3 py-1 rounded-full bg-red-500/10 text-red-500 text-[10px] font-black uppercase tracking-[0.18em]';
        statusText = 'Exam happening now';
        insightText = 'The live droplet is locked on this exam node until the exam window ends.';
    }

    if (badgeEl) {
        badgeEl.className = badgeClass;
        badgeEl.textContent = badgeText;
    }
    if (statusEl) statusEl.textContent = statusText;
    if (insightEl) insightEl.textContent = insightText;

    if (marksBtn) {
        marksBtn.dataset.examCode = exam.code || '';
        marksBtn.classList.toggle('hidden', isPractical || !isCompleted);
    }

    const sheet = document.getElementById('timetableExamSheet');
    const backdrop = document.getElementById('timetableExamBackdrop');
    initDraggableSheet('timetableExamSheet', 'timetableExamDragHandle', closeTimetableExamSheetState);
    if (sheet) snapSheetOpen(sheet);
    if (backdrop) backdrop.classList.remove('hidden');
    hideBottomNav();
}

function closeTimetableExamSheetState() {
    const backdrop = document.getElementById('timetableExamBackdrop');
    if (backdrop) backdrop.classList.add('hidden');
    showBottomNav();
}

function closeTimetableExamSheet() {
    const sheet = document.getElementById('timetableExamSheet');
    snapSheetClosed(sheet, closeTimetableExamSheetState);
}

function openTimetableMarksFromSheet() {
    const marksBtn = document.getElementById('timetableExamSheetMarks');
    const examCode = marksBtn?.dataset.examCode;
    const dept = window.ACTIVE_TIMETABLE_DEPT;
    if (!examCode || !dept) return;
    closeTimetableExamSheet();
    openMarksSheet(dept, examCode);
}

function renderTimetableLegacy() {
    const container = document.getElementById('timetableContent');
    const studentInfo = getStudentInfo();
    
    if (!container) return;

    const userDept = studentInfo ? studentInfo.dept.toUpperCase() : 'BCA';
    
    // Pick the correct dept-specific timetable
    const deptMap = {
        'BCA': window.TIMETABLE_BCA,
        'BBA': window.TIMETABLE_BBA,
        'BSW': window.TIMETABLE_BSW
    };
    const schedule = deptMap[userDept];

    if (!schedule || schedule.length === 0) {
        container.innerHTML = `<div class="p-10 text-center opacity-50">No schedule found for ${userDept}.</div>`;
        return;
    }

    const now = new Date();
    let nextExamFound = false;

    container.innerHTML = schedule.map((exam, i) => {
        const examEnd = getExamEndTime(exam.date);   // 12:00 PM IST
        const examStart = getISTDate(exam.date);      // 10:30 AM IST
        
        const isCompleted = now > examEnd;
        const isToday = now >= examStart && now <= examEnd;
        const isTomorrow = !isCompleted && !isToday && i === schedule.findIndex(e => getISTDate(e.date) > now);
        
        // Mark the very first upcoming exam as "Next"
        let isNext = false;
        if (!nextExamFound && !isCompleted && !isToday) {
            isNext = true;
            nextExamFound = true;
        }

        let statusText, statusColor;
        if (isCompleted) {
            statusText = "✓ Completed";
            statusColor = "text-green-500";
        } else if (isToday) {
            statusText = "🔴 Exam Today!";
            statusColor = "text-red-500";
        } else if (isNext) {
            statusText = "⏳ Next Exam";
            statusColor = "text-[var(--mac-blue)]";
        } else {
            const diff = examStart - now;
            const days = Math.floor(diff / (1000 * 60 * 60 * 24));
            statusText = `${days} Days Left`;
            statusColor = "text-[#86868b]";
        }

        const cardOpacity = isCompleted ? "opacity-50" : "";
        const highlight = isToday ? "border-2 border-red-400" : isNext ? "border-2 border-[var(--mac-blue)]" : "";

        return `
            <div class="timeline-item ${cardOpacity}">
                <div class="timeline-dot ${isCompleted ? 'bg-green-500' : isToday ? 'bg-red-500' : 'bg-[var(--mac-blue)]'}"></div>
                <div class="glass-panel p-4 rounded-2xl ${highlight}">
                    <div class="flex justify-between items-start mb-2">
                        <div>
                            <span class="px-2 py-0.5 bg-[var(--mac-blue)] text-white text-[9px] font-bold rounded-md uppercase">${userDept}</span>
                            ${isToday || isNext ? `<span class="ml-1 px-2 py-0.5 ${isToday ? 'bg-red-500' : 'bg-[var(--mac-blue)]/20 text-[var(--mac-blue)]'} text-white text-[9px] font-bold rounded-md uppercase">${isToday ? 'TODAY' : 'NEXT'}</span>` : ''}
                        </div>
                        <div class="text-right">
                            <span class="block text-[10px] font-bold text-[#86868b]">${exam.date} • ${exam.time}</span>
                            <span class="text-[9px] font-black ${statusColor} uppercase tracking-tight">${statusText}</span>
                        </div>
                    </div>
                    <h4 class="text-sm font-bold text-[#1d1d1f] dark:text-[#f5f5f7] mb-1">${exam.title}</h4>
                    <p class="text-[9px] font-mono font-bold opacity-30 uppercase tracking-tighter">${exam.code}</p>
                    ${isCompleted ? `
                        <div class="mt-3 flex justify-end">
                            <button onclick="openMarksSheet('${userDept}', '${exam.code}')" class="liquid-pill px-4 py-2 bg-[var(--mac-blue)]/12 text-[var(--mac-blue)] rounded-full font-bold text-[11px] border border-[var(--mac-blue)]/15 spring">
                                Cheak Ans
                            </button>
                        </div>
                    ` : ''}
                </div>
            </div>
        `;
    }).join('');
}

function toggleCompletedSubjects() {
    appState.completedSubjectsExpanded = !appState.completedSubjectsExpanded;
    renderTimetable();
}

function renderCompletedSubjectsPanel(completedSubjects, userDept, showPracticalRoute) {
    if (!completedSubjects.length) return '';

    const expanded = appState.completedSubjectsExpanded;
    const visibleSubjects = expanded ? completedSubjects : completedSubjects.slice(-4);
    const overflowCount = Math.max(0, completedSubjects.length - visibleSubjects.length);
    const typeLabel = showPracticalRoute ? 'Completed theory' : 'Completed subjects';

    return `
        <button type="button" class="completed-subjects-toggle spring ${expanded ? 'is-expanded' : ''}" onclick="toggleCompletedSubjects()">
            <div class="completed-subjects-head">
                <div>
                    <p class="completed-subjects-kicker">${typeLabel}</p>
                    <h4>${completedSubjects.length} subject${completedSubjects.length > 1 ? 's' : ''} finished</h4>
                </div>
                <span>${expanded ? 'Hide' : 'Expand'}</span>
            </div>
            <div class="completed-subjects-strip">
                ${overflowCount && !expanded ? `<span class="completed-subject-mini is-more">+${overflowCount}</span>` : ''}
                ${visibleSubjects.map(exam => `
                    <span class="completed-subject-mini">
                        <strong>${formatShortExamDate(exam.date)}</strong>
                        ${escapeHtml(exam.title)}
                    </span>
                `).join('')}
            </div>
            ${expanded ? `
                <div class="completed-subjects-grid">
                    ${completedSubjects.map(exam => `
                        <div class="completed-subject-card">
                            <p>${formatShortExamDate(exam.date)}</p>
                            <h5>${escapeHtml(exam.title)}</h5>
                            <span>${userDept} ${exam.type === 'practical' ? 'Practical' : 'Theory'}</span>
                        </div>
                    `).join('')}
                </div>
            ` : ''}
        </button>
    `;
}


function renderTimetable() {
    const container = document.getElementById('timetableContent');
    const studentInfo = getStudentInfo();

    if (!container) return;

    const userDept = studentInfo ? studentInfo.dept.toUpperCase() : 'BCA';
    const now = new Date();
    const theorySchedule = getDepartmentScheduleByCode(userDept);
    const practicalSchedule = getDepartmentPracticalScheduleByCode(userDept);
    const theoryComplete = areAllTheoryExamsCompleted(theorySchedule, now);
    const showPracticalRoute = theoryComplete && practicalSchedule.length > 0;
    const schedule = showPracticalRoute ? practicalSchedule : theorySchedule;
    const activeScheduleType = showPracticalRoute ? 'practical' : 'theory';
    const typedSchedule = markScheduleDept(schedule, userDept, activeScheduleType);

    if (!schedule || schedule.length === 0) {
        container.innerHTML = `<div class="p-10 text-center opacity-50">No schedule found for ${userDept}.</div>`;
        return;
    }

    const completedSubjects = typedSchedule.filter(exam => now > getExamEndTime(exam.date));
    const routeSchedule = typedSchedule.filter(exam => now <= getExamEndTime(exam.date));
    const visibleRouteSchedule = routeSchedule.length ? routeSchedule : typedSchedule.slice(-1);
    const metrics = buildTimetableMapMetrics(visibleRouteSchedule);
    const nextIndex = metrics.findIndex(exam => now < getISTDate(exam.date));
    const currentIndex = metrics.findIndex(exam => now >= getISTDate(exam.date) && now <= getExamEndTime(exam.date));
    const marker = getTimetableMarkerPosition(metrics, now);
    const completedCount = completedSubjects.length;
    const activeIndex = currentIndex !== -1 ? currentIndex : nextIndex;
    const focusExam = activeIndex !== -1 ? metrics[activeIndex] : metrics[metrics.length - 1];
    const finalExam = typedSchedule[typedSchedule.length - 1];
    const routeHeight = (metrics[metrics.length - 1]?.top || 0) + 180;
    const progressStart = (metrics[0]?.top || 96) + 14;
    const progressEnd = marker.top + 12;
    const progressHeight = Math.max(0, progressEnd - progressStart);

    window.ACTIVE_TIMETABLE_SCHEDULE = metrics;
    window.ACTIVE_TIMETABLE_DEPT = userDept;
    window.ACTIVE_TIMETABLE_TYPE = activeScheduleType;

    const secondaryPanel = showPracticalRoute
        ? `
            <div class="practical-switch-panel is-theory-done">
                <div>
                    <p class="practical-switch-kicker">Theory completed</p>
                    <h4>BCA practical examinations are now showing.</h4>
                </div>
                <span>${theorySchedule.length}/${theorySchedule.length}</span>
            </div>
        `
        : practicalSchedule.length
            ? `
                <div class="practical-switch-panel">
                    <div>
                        <p class="practical-switch-kicker">Practical exams</p>
                        <h4>Starts after all theory exams finish.</h4>
                        <p>${practicalSchedule.map(exam => `${formatShortExamDate(exam.date)} - ${escapeHtml(exam.title)}`).join(' | ')}</p>
                    </div>
                    <span>Minimized</span>
                </div>
            `
            : '';

    container.innerHTML = `
        <div class="exam-map-shell">
            <div class="exam-map-hero">
                <div class="relative z-[1]">
                    <p class="text-[10px] font-black text-[var(--mac-blue)] uppercase tracking-[0.24em] mb-2">${userDept} ${activeScheduleType} route map</p>
                    <div class="flex items-start justify-between gap-4">
                        <div>
                            <h4 class="text-2xl font-bold tracking-tight text-[#1d1d1f] dark:text-[#f5f5f7]">${showPracticalRoute ? 'Practical Journey' : 'Exam Journey'}</h4>
                            <p class="text-sm font-bold text-[#86868b] mt-2">${escapeHtml(marker.label)}</p>
                        </div>
                        <div class="w-14 h-14 rounded-[1.5rem] bg-[var(--mac-blue)]/12 flex items-center justify-center text-xl font-black shadow-lg">${showPracticalRoute ? 'LAB' : 'EX'}</div>
                    </div>
                    <div class="exam-map-stat-grid">
                        <div class="exam-map-stat">
                            <p class="text-[9px] font-black text-[#86868b] uppercase tracking-[0.18em] mb-2">Completed</p>
                            <p class="text-2xl font-bold tracking-tight text-[#1d1d1f] dark:text-[#f5f5f7]">${completedCount}/${typedSchedule.length}</p>
                        </div>
                        <div class="exam-map-stat">
                            <p class="text-[9px] font-black text-[#86868b] uppercase tracking-[0.18em] mb-2">Current Focus</p>
                            <p class="text-sm font-bold leading-tight text-[#1d1d1f] dark:text-[#f5f5f7]">${escapeHtml(focusExam.title)}</p>
                        </div>
                        <div class="exam-map-stat">
                            <p class="text-[9px] font-black text-[#86868b] uppercase tracking-[0.18em] mb-2">Final Exam</p>
                            <p class="text-sm font-bold leading-tight text-[#1d1d1f] dark:text-[#f5f5f7]">${formatShortExamDate(finalExam.date)}</p>
                        </div>
                    </div>
                </div>
            </div>

            ${renderCompletedSubjectsPanel(completedSubjects, userDept, showPracticalRoute)}

            ${secondaryPanel}

            <div class="exam-route ${showPracticalRoute ? 'is-practical-route' : ''}" style="--marker-top:${marker.top}px; --progress-start:${progressStart}px; --progress-height:${progressHeight}px; min-height:${routeHeight}px;">
                <div class="exam-route-start">✦</div>
                <div class="exam-route-progress"></div>
                <div class="route-orb"></div>
                ${metrics.map((exam, index) => {
                    const examStart = getISTDate(exam.date);
                    const examEnd = getExamEndTime(exam.date);
                    const isCompleted = now > examEnd;
                    const isCurrent = now >= examStart && now <= examEnd;
                    const isNext = !isCompleted && !isCurrent && index === nextIndex;
                    const isFinal = index === metrics.length - 1;
                    const statusLabel = isCompleted
                        ? 'Completed'
                        : isCurrent
                            ? 'Exam live now'
                            : isNext
                                ? getCountdownLabel(examStart, now)
                                : `${Math.max(0, Math.ceil(getDaysBetween(now, examStart)))} days away`;
                    const gapLabel = exam.connectorHeight
                        ? `${Math.max(1, Math.round(getDaysBetween(examEnd, getISTDate(metrics[index + 1].date))))} day glide`
                        : 'Final landing';

                    return `
                        <div class="exam-stop ${isCompleted ? 'is-completed' : ''} ${isCurrent ? 'is-current' : ''} ${isNext ? 'is-next' : ''}" style="--stop-top:${exam.top}px; --lane-offset:${exam.laneOffset}px;">
                            <div class="exam-node"></div>
                            ${exam.connectorHeight ? `<div class="exam-connector" style="--connector-height:${exam.connectorHeight}px;"></div>` : ''}
                            <button type="button" class="exam-card spring" onclick="openTimetableExamSheet(${index})">
                                <div class="exam-kicker">
                                    <span class="exam-badge">${showPracticalRoute ? 'Practical' : userDept}</span>
                                    ${isFinal ? `<span class="exam-badge is-final">Final</span>` : ''}
                                    ${isCompleted ? `<span class="exam-badge is-done">Done</span>` : ''}
                                    ${isCurrent ? `<span class="exam-badge is-live">Now</span>` : ''}
                                    ${!isCompleted && !isCurrent && !isNext ? `<span class="exam-badge is-soft">Ahead</span>` : ''}
                                </div>
                                <p class="text-[11px] font-black text-[#86868b] uppercase tracking-[0.2em] mb-2">${formatShortExamDate(exam.date)}</p>
                                <h4 class="text-base font-bold leading-tight text-[#1d1d1f] dark:text-[#f5f5f7]">${escapeHtml(exam.title)}</h4>
                                <p class="text-[11px] font-bold text-[#86868b] mt-3">${escapeHtml(statusLabel)}</p>
                                <p class="exam-connector-note">${gapLabel}</p>
                            </button>
                        </div>
                    `;
                }).join('')}
            </div>
        </div>
    `;
}

function renderDepartments() {
    const container = document.getElementById('deptContent');
    if (!container) return;

    const depts = ['BCA', 'BBA', 'BSW'];
    container.innerHTML = depts.map(dept => {
        const count = ALL_DEPARTMENTS.filter(d => d[6].toUpperCase() === dept).length;
        return `
            <div class="glass-panel p-6 rounded-[2rem] flex items-center justify-between shadow-sm">
                <div class="flex items-center gap-4">
                    <div class="w-12 h-12 bg-[#0071e3] rounded-2xl flex items-center justify-center text-white text-xl font-bold">${dept[0]}</div>
                    <div>
                        <h4 class="text-lg font-bold text-[#1d1d1f] dark:text-[#f5f5f7]">${dept}</h4>
                        <p class="text-[10px] font-bold text-[#86868b] uppercase tracking-widest mt-0.5">Mac Ramapuram</p>
                    </div>
                </div>
                <div class="text-right">
                    <p class="text-2xl font-bold tracking-tighter text-[#1d1d1f] dark:text-[#f5f5f7]">${count}</p>
                    <p class="text-[8px] font-bold text-[#86868b] uppercase tracking-widest">Students</p>
                </div>
            </div>
        `;
    }).join('');
}


let app = { h: "Hall 1", f: "ALL", s: "" };

function render() {
    renderFilters();
    renderTabs();
    renderMap();
}

function renderFilters() {
    const filtersContainer = document.getElementById('departmentFilters');
    if (!filtersContainer) return;

    const preferredOrder = ['ALL', 'BCA', 'BBA', 'BSW'];
    const available = [...new Set(ALL_DEPARTMENTS.map(d => d[6].toUpperCase()))].filter(Boolean);
    const depts = preferredOrder.filter(dept => dept === 'ALL' || available.includes(dept));
    const currentValue = app.f === 'ALL' ? 'ALL' : app.f;
    const isOpen = appState.openSeatDropdown === 'department';

    filtersContainer.innerHTML = `
        <div class="seat-dropdown ${isOpen ? 'is-open' : ''}">
            <button type="button" onclick="toggleSeatDropdown('department')" class="seat-dropdown__trigger">
                <div class="seat-dropdown__meta">
                    <span class="seat-dropdown__label">Department</span>
                    <span class="seat-dropdown__value">${currentValue}</span>
                </div>
                <span class="seat-dropdown__icon">⌄</span>
            </button>
            <div class="seat-dropdown__menu">
                ${renderDepartmentOptions(depts)}
            </div>
        </div>
    `;
}

function renderTabs() {
    // Hall tabs row is hidden; we only update the dot indicators in the glass card header
    const halls = HALL_KEYS.length ? HALL_KEYS : [...new Set(RAW_DATA.map(d => d.h))];
    const dotsContainer = document.getElementById('hallDots');
    if (dotsContainer) {
        dotsContainer.innerHTML = halls.map(h => `
            <div class="w-1.5 h-1.5 rounded-full transition-all duration-300 ${
                app.h === h
                  ? 'bg-[var(--mac-blue)] w-3'
                  : 'bg-black/20 dark:bg-white/20'
            }"></div>
        `).join('');
    }
}

function renderMap() {
    const grid = document.getElementById('seatingGrid');
    if (!grid) return;
    grid.innerHTML = '';
    
    const data = HALL_DATA[app.h] || RAW_DATA.filter(d => d.h === app.h);
    const hallTitle = document.getElementById('currentHallTitle');
    const audInfo = document.getElementById('currentAudInfo');
    if (hallTitle) hallTitle.textContent = app.h;
    if (audInfo) audInfo.textContent = data[0]?.aud || "Main Building";

    const allCols = [1, 2, 3];

    allCols.forEach(col => {
        const blockCol = document.createElement('div');
        blockCol.className = "flex flex-col gap-2";
        blockCol.innerHTML = `<div class="text-center text-[8px] font-black text-[#86868b] uppercase tracking-widest mb-1">Block ${col}</div>`;

        const columnSeats = data.filter(d => d.c === col);
        if (columnSeats.length === 0) {
            // Optional: Add a placeholder if the entire block is empty
            blockCol.innerHTML += `<div class="p-4 text-center text-[10px] text-[#86868b] italic opacity-20">Empty</div>`;
        } else {
            columnSeats.forEach(seat => {
                const rowDiv = document.createElement('div');
                rowDiv.className = "flex gap-2 w-full h-14";
                rowDiv.innerHTML = `
                    ${createSeat(seat.l, seat)}
                    ${createSeat(seat.ri, seat)}
                `;
                blockCol.appendChild(rowDiv);
            });
        }
        grid.appendChild(blockCol);
    });
}

function createSeat(info, seat) {
    if (!info) return `<div class="w-1/2 bg-black/5 dark:bg-white/5 rounded-[0.75rem]"></div>`;
    const isMatch = seatMatchesSearch(info, app.s);
    const isFilter = app.f !== "ALL" && info.d === app.f;
    const seatLabel = info.s || info.d;

    return `
        <div onclick='openDrawer(${JSON.stringify(info)}, ${JSON.stringify(seat)})' 
            class="w-1/2 glass-panel rounded-[0.75rem] flex flex-col items-center justify-center p-1.5 spring 
            ${isMatch ? 'active-seat' : ''} 
            ${isFilter ? 'dept-tag' : ''}">
            <span class="seat-student-name text-[10px] sm:text-[11px] font-bold tracking-tight leading-tight text-center text-slate-500 dark:text-slate-400">${seatLabel}</span>
            <span class="text-[12px] sm:text-[14px] font-mono font-bold opacity-100 leading-none mt-1.5">${info.r.slice(-4)}</span>
        </div>
    `;
}

function changeHall(h) { 
    if(app.h === h) return;
    const halls = HALL_KEYS.length ? HALL_KEYS : [...new Set(RAW_DATA.map(d => d.h))];
    const currentIndex = halls.indexOf(app.h);
    const newIndex = halls.indexOf(h);
    const dir = newIndex >= currentIndex ? 'next' : 'prev';
    changeHallAnimated(h, dir);
}

function changeHallDir(dir) {
    const halls = HALL_KEYS.length ? HALL_KEYS : [...new Set(RAW_DATA.map(d => d.h))];
    if(halls.length <= 1) return;
    const currentIndex = halls.indexOf(app.h);
    if(currentIndex === -1) return;
    
    let nextIndex = currentIndex;
    if (dir === 'next') {
        nextIndex = (currentIndex + 1) % halls.length;
    } else {
        nextIndex = (currentIndex - 1 + halls.length) % halls.length;
    }
    changeHallAnimated(halls[nextIndex], dir);
}

let isAnimatingHall = false;
let sheetDragState = null;

function snapSheetOpen(sheet) {
    if (!sheet) return;
    sheet.classList.remove('is-dragging');
    sheet.style.transform = 'translateY(0)';
}

function snapSheetClosed(sheet, closeAction) {
    if (!sheet) return;
    sheet.classList.remove('is-dragging');
    sheet.style.transform = 'translateY(100%)';
    if (typeof closeAction === 'function') closeAction();
}

function initDraggableSheet(sheetId, handleId, closeAction) {
    const sheet = document.getElementById(sheetId);
    const handle = document.getElementById(handleId);
    if (!sheet || !handle || handle.dataset.dragReady) return;
    handle.dataset.dragReady = 'true';

    const startDrag = (event) => {
        const point = event;
        sheetDragState = {
            sheet,
            startY: point.clientY,
            lastY: point.clientY,
            lastTime: performance.now(),
            velocity: 0,
            height: sheet.offsetHeight || window.innerHeight,
            closeAction
        };
        sheet.classList.add('is-dragging');
        handle.setPointerCapture?.(event.pointerId);
        if (event.cancelable) event.preventDefault();
    };

    const moveDrag = (event) => {
        if (!sheetDragState || sheetDragState.sheet !== sheet) return;
        const point = event;
        const now = performance.now();
        const delta = point.clientY - sheetDragState.startY;
        const timeDelta = Math.max(1, now - sheetDragState.lastTime);
        sheetDragState.velocity = (point.clientY - sheetDragState.lastY) / timeDelta;
        sheetDragState.lastY = point.clientY;
        sheetDragState.lastTime = now;

        const resisted = delta < 0 ? delta * 0.22 : delta;
        const offset = Math.max(-36, Math.min(sheetDragState.height, resisted));
        sheet.style.transform = `translateY(${offset}px)`;
        if (event.cancelable) event.preventDefault();
    };

    const endDrag = () => {
        if (!sheetDragState || sheetDragState.sheet !== sheet) return;
        const moved = sheetDragState.lastY - sheetDragState.startY;
        const shouldClose = moved > sheetDragState.height * 0.22 || sheetDragState.velocity > 0.75;
        const action = sheetDragState.closeAction;
        sheetDragState = null;
        if (shouldClose) snapSheetClosed(sheet, action);
        else snapSheetOpen(sheet);
    };

    handle.addEventListener('pointerdown', startDrag);
    window.addEventListener('pointermove', moveDrag);
    window.addEventListener('pointerup', endDrag);
    window.addEventListener('pointercancel', endDrag);
}

function closeSeatDetailSheet() {
    const backdrop = document.getElementById('drawerBackdrop');
    if (backdrop) backdrop.classList.add('hidden');
    showBottomNav();
}

function initDrawerDrag() {
    initDraggableSheet('detailDrawer', 'drawerDragHandle', closeSeatDetailSheet);
}

function changeHallAnimated(newHall, dir) {
    if(newHall === app.h || isAnimatingHall) return;
    isAnimatingHall = true;
    
    const grid = document.getElementById('seatingGrid');
    if (!grid) {
        app.h = newHall;
        render();
        isAnimatingHall = false;
        return;
    }
    
    // Smooth slide out
    grid.style.transition = 'transform 0.25s cubic-bezier(0.32, 0.72, 0, 1), opacity 0.2s ease-out';
    grid.style.transform = dir === 'next' ? 'translateX(-40px)' : 'translateX(40px)';
    grid.style.opacity = '0';
    
    setTimeout(() => {
        app.h = newHall;
        
        // Prepare to slide in from opposite side
        grid.style.transition = 'none';
        grid.style.transform = dir === 'next' ? 'translateX(40px)' : 'translateX(-40px)';
        
        render(); // This recreates content inside seatingGrid
        
        // Force Reflow
        void grid.offsetWidth;
        
        // Slide in
        grid.style.transition = 'transform 0.35s cubic-bezier(0.34, 1.56, 0.64, 1), opacity 0.3s ease-in';
        grid.style.transform = 'translateX(0)';
        grid.style.opacity = '1';
        
        setTimeout(() => {
            isAnimatingHall = false;
        }, 350);
    }, 250);
}

function setFilter(d) {
    app.f = d;
    closeSeatDropdowns();
    renderFilters();
    renderMap();
}

function openDrawer(info, seat) {
    const studentName = info.n || getStudentName(info.r);
    document.getElementById('drawerDeptName').textContent = info.d;
    document.getElementById('drawerStudentName').textContent = studentName || 'Name not available';
    document.getElementById('drawerRegId').textContent = info.r;
    document.getElementById('drawerHallId').textContent = seat.h;
    document.getElementById('drawerSeatPos').textContent = `Block ${seat.c} • Row ${seat.r === 0 ? 'ESK' : seat.r}`;
    document.getElementById('drawerDeptIcon').textContent = info.d.charAt(0);

    // Look up exam details for this dept on the selected date
    const examCard = document.getElementById('drawerExamCard');
    const examTitle = document.getElementById('drawerExamTitle');
    const examMeta = document.getElementById('drawerExamMeta');
    
    const deptMap = { 'BCA': window.TIMETABLE_BCA, 'BBA': window.TIMETABLE_BBA, 'BSW': window.TIMETABLE_BSW };
    const schedule = deptMap[info.d.toUpperCase()];
    const selectedDateFormatted = appState.selectedDate.replace(/_/g, '-');
    
    if (schedule && examCard) {
        const exam = schedule.find(e => e.date === selectedDateFormatted);
        if (exam) {
            if (examTitle) examTitle.textContent = exam.title;
            const dateEl = document.getElementById('drawerExamDate');
            const timeEl = document.getElementById('drawerExamTime');
            const codeEl = document.getElementById('drawerExamCode');
            if (dateEl) dateEl.textContent = exam.date;
            if (timeEl) timeEl.textContent = `⏰ ${exam.time || '10:30 AM'}`;
            if (codeEl) codeEl.textContent = exam.code || '';
            examCard.classList.remove('hidden');
        } else {
            examCard.classList.add('hidden');
        }
    } else if (examCard) {
        examCard.classList.add('hidden');
    }

    const drawer = document.getElementById('detailDrawer');
    const backdrop = document.getElementById('drawerBackdrop');
    initDrawerDrag();
    if (drawer) {
        drawer.classList.remove('is-dragging');
        drawer.style.transform = 'translateY(0)';
    }
    if (backdrop) backdrop.classList.remove('hidden');

    // Hide bottom nav when drawer opens
    hideBottomNav();
}

function closeDrawer() {
    const drawer = document.getElementById('detailDrawer');
    snapSheetClosed(drawer, closeSeatDetailSheet);
}

const searchInput = document.getElementById('globalSearch');
if (searchInput) {
    searchInput.addEventListener('input', (e) => {
        app.s = e.target.value.toLowerCase();
        if (app.s.length > 2) {
            const match = ALL_DEPARTMENTS.find(d => {
                const reg = String(d[0] || '').toLowerCase();
                const name = getStudentName(d[0]).toLowerCase();
                return reg.includes(app.s) || name.includes(app.s);
            });
            if (match) {
                // match format: [roll, hall, room, sec, row, side, dept]
                if (match[1] !== app.h) changeHall(match[1]);
            }
        }
        renderMap();
    });
}

let obData = { name: '', dept: '', reg: '' };

function validateObStep2() {
    const nameVal = (document.getElementById('ob-name')?.value || "").trim();
    const regVal = (document.getElementById('ob-reg')?.value || "").trim();
    
    obData.name = nameVal;
    obData.reg = regVal;

    const btn = document.getElementById('ob-final-btn');
    if (obData.name && obData.dept) {
        if (btn) {
            btn.classList.remove('opacity-30', 'pointer-events-none');
            btn.classList.add('spring');
        }
        // Update greeting and countdown in background
        // Temporarily save to local storage to let updateCountdown use it
        const tempInfo = { name: obData.name, dept: obData.dept, reg: obData.reg };
        saveStudentInfo(tempInfo);
        updateCountdown();
    } else {
        if (btn) {
            btn.classList.add('opacity-30', 'pointer-events-none');
            btn.classList.remove('spring');
        }
    }
}

function nextObStep(step) {
    if (step === 2) {
        const step1 = document.getElementById('ob-step-1');
        const step2 = document.getElementById('ob-step-2');
        if (step1) step1.classList.add('hidden');
        if (step2) step2.classList.remove('hidden');
        const dot1 = document.getElementById('dot-1');
        const dot2 = document.getElementById('dot-2');
        if (dot1) dot1.classList.remove('active');
        if (dot2) dot2.classList.add('active');
    } else if (step === 3) {
        // Final sync before moving to guide
        obData.name = (document.getElementById('ob-name')?.value || "").trim();
        obData.reg = (document.getElementById('ob-reg')?.value || "").trim();
        
        if (!obData.name || !obData.dept) return;

        const screen = document.getElementById('onboardingScreen');
        if (screen) screen.classList.add('no-blur');
        
        const step2 = document.getElementById('ob-step-2');
        const step3 = document.getElementById('ob-step-3');
        if (step2) step2.classList.add('hidden');
        if (step3) step3.classList.remove('hidden');
        
        const dot2 = document.getElementById('dot-2');
        const dot3 = document.getElementById('dot-3');
        if (dot2) dot2.classList.remove('active');
        if (dot3) dot3.classList.add('active');
        
        showGuideHighlight();
    }
}

async function selectObDept(dept) {
    obData.dept = dept;
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

    // Immediately sync the countdown for the chosen dept
    validateObStep2();
}

async function showGuideHighlight() {
    const highlight = document.getElementById('guideHighlight');
    if (!highlight) return;

    highlight.style.opacity = '1';
    
    // First highlight: Home
    const homeBtn = document.getElementById('tab-view-home');
    if (homeBtn) {
        const rect = homeBtn.getBoundingClientRect();
        highlight.style.top = (rect.top - 10) + 'px';
        highlight.style.left = (rect.left - 10) + 'px';
        highlight.style.width = (rect.width + 20) + 'px';
        highlight.style.height = (rect.height + 20) + 'px';
    }

    await new Promise(r => setTimeout(r, 2000));

    // Second highlight: Timetable
    const ttBtn = document.getElementById('tab-view-timetable');
    if (ttBtn) {
        const rect = ttBtn.getBoundingClientRect();
        highlight.style.top = (rect.top - 10) + 'px';
        highlight.style.left = (rect.left - 10) + 'px';
        highlight.style.width = (rect.width + 20) + 'px';
        highlight.style.height = (rect.height + 20) + 'px';
    }

    await new Promise(r => setTimeout(r, 2000));

    // Third highlight: Seats
    const seatBtn = document.getElementById('tab-view-seats');
    if (seatBtn) {
        const rect2 = seatBtn.getBoundingClientRect();
        highlight.style.top = (rect2.top - 10) + 'px';
        highlight.style.left = (rect2.left - 10) + 'px';
        highlight.style.width = (rect2.width + 20) + 'px';
        highlight.style.height = (rect2.height + 20) + 'px';
    }

    await new Promise(r => setTimeout(r, 2000));
    highlight.style.opacity = '0';
}

function finishOnboarding() {
    saveStudentInfo(obData);
    const obScreen = document.getElementById('onboardingScreen');
    if (obScreen) obScreen.classList.add('collapsed');
    applyUserProfile();
    updateCountdown();
}

async function applyUserProfile() {
    const infoStr = getStudentInfo();
    if (infoStr) {
        const info = infoStr;
        const deptEl = document.getElementById('homeUserDept');
        if (deptEl) deptEl.textContent = info.dept;

        const regEl = document.getElementById('homeUserReg');
        if (regEl) regEl.textContent = info.reg || 'Tap to set';

        // Auto filter to their department
        setFilter(info.dept);

        // Update countdown immediately with their dept
        updateCountdown();

        // If they provided a Reg No, auto search/highlight it
        if (info.reg) {
            app.s = info.reg.toLowerCase();
            const searchInput = document.getElementById('globalSearch');
            if (searchInput) searchInput.value = info.reg;
            
            const match = ALL_DEPARTMENTS.find(d => d[0].toLowerCase().includes(app.s));
            if (match) {
                if (match[1] !== app.h) changeHall(match[1]);
            }
        }
    }
}

function checkOnboarding() {
    const saved = getStudentInfo();
    const obScreen = document.getElementById('onboardingScreen');

    if (!saved) {
        // First launch: show the onboarding popup
        if (obScreen) obScreen.classList.remove('hidden');
    } else {
        // Returning user: keep onboarding hidden, restore their profile instantly
        if (obScreen) obScreen.classList.add('hidden', 'collapsed');
        applyUserProfile();
    }
}

let _editDept = '';

function openEditProfile() {
    const info = getStudentInfo() || {};
    _editDept = info.dept || '';

    const nameInput = document.getElementById('editName');
    const regInput = document.getElementById('editReg');
    if (nameInput) nameInput.value = info.name || '';
    if (regInput) regInput.value = info.reg || '';

    // Highlight saved dept button
    ['BCA', 'BBA', 'BSW'].forEach(d => {
        const btn = document.getElementById('edit-btn-' + d);
        if (!btn) return;
        if (d === _editDept) {
            btn.classList.add('bg-[var(--mac-blue)]', 'text-white');
            btn.classList.remove('border-[#86868b]/30');
        } else {
            btn.classList.remove('bg-[var(--mac-blue)]', 'text-white');
            btn.classList.add('border-[#86868b]/30');
        }
    });

    const sheet = document.getElementById('editProfileSheet');
    if (sheet) sheet.classList.remove('hidden');
}

function closeEditProfile() {
    const sheet = document.getElementById('editProfileSheet');
    if (sheet) sheet.classList.add('hidden');
}

function selectEditDept(dept) {
    _editDept = dept;
    ['BCA', 'BBA', 'BSW'].forEach(d => {
        const btn = document.getElementById('edit-btn-' + d);
        if (!btn) return;
        if (d === dept) {
            btn.classList.add('bg-[var(--mac-blue)]', 'text-white');
            btn.classList.remove('border-[#86868b]/30');
        } else {
            btn.classList.remove('bg-[var(--mac-blue)]', 'text-white');
            btn.classList.add('border-[#86868b]/30');
        }
    });
}

function saveEditProfile() {
    const name = (document.getElementById('editName')?.value || '').trim();
    const reg  = (document.getElementById('editReg')?.value || '').trim();
    const dept = _editDept;

    if (!name || !dept) {
        alert('Please fill in your name and select a department.');
        return;
    }

    const updated = { name, reg, dept };
    saveStudentInfo(updated);

    // Refresh home cards instantly
    const homeGreet = document.getElementById('homeGreeting');
    if (homeGreet) homeGreet.textContent = `Hi, ${name.split(' ')[0]}!`;
    const deptEl = document.getElementById('homeUserDept');
    if (deptEl) deptEl.textContent = dept;
    const regEl = document.getElementById('homeUserReg');
    if (regEl) regEl.textContent = reg || 'Not set';

    setFilter(dept);
    updateCountdown();
    updateHomeSeatInfo();
    renderDaySelector();

    closeEditProfile();
}
function autoSelectNextExamDay() {
    if (!window.EXAM_TIMETABLE || window.EXAM_TIMETABLE.length === 0) {
        selectDay('16_04_2026');
        return;
    }

    const info = getStudentInfo();
    const userDept = info ? info.dept.toUpperCase() : null;
    const now = new Date();
    
    const sortedTimetable = [...window.EXAM_TIMETABLE].sort((a, b) => getISTDate(a.date) - getISTDate(b.date));
    
    let nextDateStr = null;
    for (let exam of sortedTimetable) {
        if (userDept && exam.dept.toUpperCase() !== userDept) continue;
        
        const examOverTime = getExamEndTime(exam.date);
        if (examOverTime > now) {
            nextDateStr = exam.date;
            break;
        }
    }
    
    if (nextDateStr) {
        const folderName = nextDateStr.replace(/-/g, '_');
        selectDay(folderName);
    } else {
        const lastExam = sortedTimetable[sortedTimetable.length - 1];
        selectDay(lastExam.date.replace(/-/g, '_'));
    }
}
function showSeatNote() {
    const hasShown = sessionStorage.getItem('seat_note_shown');
    if (!hasShown) {
        const popup = document.getElementById('dailyNotePopup');
        const content = document.getElementById('dailyNoteContent');
        if (popup && content) {
            popup.classList.remove('hidden');
            setTimeout(() => {
                content.classList.remove('scale-95', 'opacity-0');
                content.classList.add('scale-100', 'opacity-100');
            }, 10);
            sessionStorage.setItem('seat_note_shown', 'true');
        }
    }
}

function closeDailyNote() {
    const popup = document.getElementById('dailyNotePopup');
    const content = document.getElementById('dailyNoteContent');
    if (popup && content) {
        content.classList.remove('scale-100', 'opacity-100');
        content.classList.add('scale-95', 'opacity-0');
        setTimeout(() => popup.classList.add('hidden'), 300);
    }
}

let touchStartX = 0;
let touchEndX = 0;

function setupSwipeGestures() {
    const wrapper = document.getElementById('seatingWrapper');
    if(wrapper) {
        wrapper.addEventListener('touchstart', e => {
            touchStartX = e.changedTouches[0].screenX;
        }, {passive: true});
        
        wrapper.addEventListener('touchend', e => {
            touchEndX = e.changedTouches[0].screenX;
            handleSwipe();
        }, {passive: true});
    }
}

function handleSwipe() {
    const swipeThreshold = 50; 
    if (touchEndX < touchStartX - swipeThreshold) {
        changeHallDir('next'); // Swiped left
    }
    if (touchEndX > touchStartX + swipeThreshold) {
        changeHallDir('prev'); // Swiped right
    }
}

// ── Bottom Nav Auto-Hide ──────────────────────────────────────────────────────
let _navHidden = false;
let _lastScrollY = 0;
let _scrollTicking = false;
let _navLockedHidden = false; // locked while drawer is open

function hideBottomNav() {
    const nav = document.getElementById('bottomNav');
    if (nav) nav.classList.add('nav-hidden');
    _navHidden = true;
    _navLockedHidden = true;
}

function showBottomNav() {
    const drawer = document.getElementById('detailDrawer');
    const marksSheet = document.getElementById('marksSheet');
    const timetableExamSheet = document.getElementById('timetableExamSheet');
    const drawerOpen = drawer && drawer.style.transform !== 'translateY(100%)' && drawer.style.transform !== '';
    const marksOpen = marksSheet && marksSheet.style.transform !== 'translateY(100%)' && marksSheet.style.transform !== '';
    const timetableOpen = timetableExamSheet && timetableExamSheet.style.transform !== 'translateY(100%)' && timetableExamSheet.style.transform !== '';
    if (drawerOpen || marksOpen || timetableOpen) return;
    _navLockedHidden = false;
    const nav = document.getElementById('bottomNav');
    if (nav) nav.classList.remove('nav-hidden');
    _navHidden = false;
}

function setupScrollHide() {
    return;
    window.addEventListener('scroll', () => {
        if (_navLockedHidden) return; // don't fight with the drawer
        if (_scrollTicking) return;
        _scrollTicking = true;
        requestAnimationFrame(() => {
            const currentY = window.scrollY;
            const delta = currentY - _lastScrollY;

            if (delta > 6 && !_navHidden) {
                // Scrolling DOWN — hide nav
                const nav = document.getElementById('bottomNav');
                if (nav) nav.classList.add('nav-hidden');
                _navHidden = true;
            } else if (delta < -6 && _navHidden) {
                // Scrolling UP — show nav
                const nav = document.getElementById('bottomNav');
                if (nav) nav.classList.remove('nav-hidden');
                _navHidden = false;
            }

            _lastScrollY = currentY <= 0 ? 0 : currentY;
            _scrollTicking = false;
        });
    }, { passive: true });
}

window.initExamHubApp = () => {
    checkOnboarding();
    switchView('view-home');
    startTimers();
    setupSwipeGestures();
    setupScrollHide();
    document.body.classList.add('app-ready');

    if (window.ExamHubUI) {
        window.ExamHubUI.afterFirstPaint(() => {
            autoSelectNextExamDay();
        });
        return;
    }

    requestAnimationFrame(() => autoSelectNextExamDay());
};

document.addEventListener('click', (event) => {
    if (!event.target.closest('.seat-dropdown')) {
        if (appState.openSeatDropdown) {
            closeSeatDropdowns();
            renderDaySelector();
            renderFilters();
        }
    }
});
