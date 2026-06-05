const EXAM_DAYS = [
    { label: 'Day 1', date: '16_04_2026' },
    { label: 'Day 2', date: '17_04_2026' },
    { label: 'Day 3', date: '18_04_2026' },
    { label: 'Day 4', date: '19_04_2026' },
    { label: 'Day 5', date: '20_04_2026' }
];

let appState = window.ExamHubState || { selectedDate: '16_04_2026', view: 'view-home', examSubView: 'view-class', openSeatDropdown: null };
appState.selectedDate = appState.selectedDate || '16_04_2026';
appState.view = appState.view || 'view-home';
appState.examSubView = appState.examSubView || 'view-class';
appState.openSeatDropdown = appState.openSeatDropdown || null;
appState.externalApp = appState.externalApp || { isOpen: false, url: '', title: '' };
if (typeof appState.completedSubjectsExpanded !== 'boolean') appState.completedSubjectsExpanded = false;

// Class Hub state
let currentClassDay = (function() {
    const DAYS_OF_WEEK = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
    const currentDayName = DAYS_OF_WEEK[new Date().getDay()];
    return ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday"].includes(currentDayName) ? currentDayName : "Monday";
})();
let currentClassDept = 'BCA';

function getStudentInfo() {
    if (window.ExamHubProfileApi) return window.ExamHubProfileApi.getStudentInfo();
    try {
        return JSON.parse(localStorage.getItem('mac_student_info'));
    } catch (error) {
        return null;
    }
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
    if (window.ExamHubProfileApi) return window.ExamHubProfileApi.saveStudentInfo(profile);
    try {
        localStorage.setItem('mac_student_info', JSON.stringify(profile));
    } catch (error) {
        console.warn('localStorage is restricted', error);
    }
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

function getFutureSeatExamDates(userDept, now = new Date()) {
    if (!window.EXAM_TIMETABLE) return [];

    const deptExams = window.EXAM_TIMETABLE
        .filter(e => e.dept.toUpperCase() === userDept)
        .filter(e => getExamEndTime(e.date) > now)
        .sort((a, b) => getISTDate(a.date) - getISTDate(b.date));

    return [...new Set(deptExams.map(e => e.date))];
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

    const bannerContainer = document.getElementById('statusBanner');

    if (!nextExam) {
        if (titleEl) titleEl.textContent = "All exams completed!";
        if (dateEl) dateEl.textContent = "Good luck with your results!";
        if (daysEl) daysEl.textContent = "00";
        if (hoursEl) hoursEl.textContent = "00";
        if (minsEl) minsEl.textContent = "00";
        if (secsEl) secsEl.textContent = "00";

        // Hide banner if already marked as seen for the current timetable's last exam
        if (userDept && window.EXAM_TIMETABLE && window.EXAM_TIMETABLE.length > 0) {
            const deptExams = window.EXAM_TIMETABLE.filter(e => e.dept.toUpperCase() === userDept);
            if (deptExams.length > 0) {
                const dates = deptExams.map(e => e.date).sort();
                const latestDate = dates[dates.length - 1];
                const seenKey = `machub_completed_seen_${userDept}_${latestDate}`;
                
                if (localStorage.getItem(seenKey) === 'true') {
                    if (bannerContainer) bannerContainer.classList.add('hidden');
                } else {
                    if (bannerContainer) bannerContainer.classList.remove('hidden');
                    localStorage.setItem(seenKey, 'true');
                }
            } else {
                if (bannerContainer) bannerContainer.classList.add('hidden');
            }
        } else {
            if (bannerContainer) bannerContainer.classList.add('hidden');
        }
        return;
    }

    // Next exam exists: ensure banner is visible and display countdown details
    if (bannerContainer) bannerContainer.classList.remove('hidden');

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
        clockEl.textContent = now.toLocaleTimeString('en-IN', { 
            hour: '2-digit', 
            minute: '2-digit', 
            second: '2-digit',
            hour12: true 
        }) + ' IST';
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

function getMainNavView(viewId) {
    if (['view-timetable', 'view-seats', 'view-exam-resources', 'view-class'].includes(viewId)) return 'view-exam';
    if (viewId === 'view-resources') return 'view-resources';
    if (viewId === 'view-profile') return 'view-profile';
    return 'view-home';
}

function updateExamSubnav(activeView) {
    document.querySelectorAll('.exam-subnav-item').forEach(btn => {
        if (btn.hasAttribute('data-exam-target')) {
            btn.classList.toggle('is-active', btn.dataset.examTarget === activeView);
        } else if (btn.hasAttribute('data-top-target')) {
            const target = btn.dataset.topTarget;
            const isActive = (target === 'class' && activeView === 'view-class') ||
                             (target === 'exam' && (activeView === 'view-timetable' || activeView === 'view-seats' || activeView === 'view-exam-resources' || activeView === 'view-results'));
            btn.classList.toggle('is-active', isActive);
        }
    });
}

let externalAppLoadTimer = null;

function syncExternalAppView() {
    const state = appState.externalApp || { isOpen: false, url: '', title: '' };
    const home = document.getElementById('view-home');
    const shell = document.getElementById('externalAppShell');
    const frame = document.getElementById('externalAppFrame');
    const title = document.getElementById('externalAppTitle');
    const loader = document.getElementById('externalAppLoader');
    const fallback = document.getElementById('externalAppFallback');
    const header = document.getElementById('appHeader');
    const isHomeActive = appState.view === 'view-home';

    if (home) home.classList.toggle('external-app-open', !!state.isOpen);
    if (shell) shell.classList.toggle('hidden', !state.isOpen);
    if (title) title.textContent = state.title || 'Student Portal';
    if (header && isHomeActive) header.style.display = state.isOpen ? 'none' : '';

    if (!frame) return;

    if (state.isOpen && state.url && frame.src !== state.url) {
        if (loader) loader.classList.remove('hidden');
        if (fallback) fallback.classList.add('hidden');
        frame.classList.remove('is-loaded');
        frame.title = state.title || 'External app';
        frame.src = state.url;

        clearTimeout(externalAppLoadTimer);
        externalAppLoadTimer = setTimeout(() => {
            if (!frame.classList.contains('is-loaded') && fallback) {
                fallback.classList.remove('hidden');
            }
        }, 12000);
    }
}

function openExternalApp(url, title) {
    if (!url) return;
    appState.externalApp = {
        isOpen: true,
        url,
        title: title || 'Student Portal'
    };
    switchView('view-home');
    syncExternalAppView();
}

function closeExternalApp() {
    if (!appState.externalApp) appState.externalApp = { isOpen: false, url: '', title: '' };
    appState.externalApp.isOpen = false;
    appState.externalApp.url = '';
    appState.externalApp.title = '';

    const frame = document.getElementById('externalAppFrame');
    const loader = document.getElementById('externalAppLoader');
    const fallback = document.getElementById('externalAppFallback');
    clearTimeout(externalAppLoadTimer);
    if (frame) {
        frame.classList.remove('is-loaded');
        frame.removeAttribute('src');
    }
    if (loader) loader.classList.add('hidden');
    if (fallback) fallback.classList.add('hidden');
    switchView('view-home');
    syncExternalAppView();
}

function switchExamView(viewId) {
    if (viewId === 'view-timetable' || viewId === 'view-seats' || viewId === 'view-results') {
        const targetTab = viewId === 'view-timetable' ? 'timetable' : (viewId === 'view-seats' ? 'seats' : 'results');
        switchView('view-seats');
        switchExamTab(targetTab);
        return;
    }
    
    appState.examSubView = viewId || appState.examSubView || 'view-class';
    switchView(appState.examSubView);
}

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
    }
    
    // Sync top toggle states
    document.querySelectorAll('.exam-subnav-item[data-top-target="exam"]').forEach(el => el.classList.add('is-active'));
    document.querySelectorAll('.exam-subnav-item[data-top-target="class"]').forEach(el => el.classList.remove('is-active'));
    document.querySelectorAll('.exam-subnav-item[data-exam-target]').forEach(el => {
        el.classList.toggle('is-active', el.dataset.examTarget === appState.examSubView);
    });
};

function switchView(viewId) {
    // Handle unified view-exam-hub alias and old aliases
    if (viewId === 'view-exam-hub' || viewId === 'view-exam') {
        viewId = 'view-class';
    }

    if (viewId === 'view-timetable' || viewId === 'view-seats' || viewId === 'view-results') {
        if (appState.view !== 'view-seats') {
            const targetTab = viewId === 'view-timetable' ? 'timetable' : (viewId === 'view-seats' ? 'seats' : 'results');
            switchExamTab(targetTab);
        }
        viewId = 'view-seats';
    }

    appState.view = viewId;
    document.querySelectorAll('.view-panel').forEach(el => {
        el.classList.remove('is-active');
    });
    const panel = document.getElementById(viewId);
    if (panel) {
        panel.classList.add('is-active');
        panel.classList.remove('view-reenter');
        void panel.offsetWidth;
        panel.classList.add('view-reenter');
    }

    // Show header only on home
    const header = document.getElementById('appHeader');
    if (header) header.style.display = viewId === 'view-home' ? '' : 'none';
    
    updateExamSubnav(viewId);

    if (viewId === 'view-seats') {
        if (appState.examSubView === 'view-timetable' && typeof renderTimetable === 'function') renderTimetable();
        if (appState.examSubView === 'view-seats' && typeof showSeatNote === 'function') showSeatNote();
    }

    if (viewId === 'view-departments') renderDepartments();
    if (viewId === 'view-home') updateCountdown();
    if (viewId === 'view-profile' && typeof renderUserProfile === 'function') renderUserProfile();
    syncExternalAppView();

    // Update Nav Bar active & Indicator movement
    const tabs = ['view-home', 'view-exam', 'view-resources', 'view-profile'];
    const navPill = document.getElementById('navPill');
    const activeMainView = (viewId === 'view-seats' || viewId === 'view-results' || viewId === 'view-exam-resources') ? 'view-exam' : getMainNavView(viewId);
    const nextIndex = tabs.indexOf(activeMainView);

    if (navPill && nextIndex !== -1) {
        const currentOption = navPill.getAttribute('c-current') || '1';
        const nextOption = String(nextIndex + 1);
        navPill.setAttribute('c-previous', currentOption);
        navPill.setAttribute('c-current', nextOption);
    }

    tabs.forEach((tab, index) => {
        const btn = document.getElementById('tab-' + tab);
        if (!btn) return;
        if (tab === activeMainView) {
            btn.classList.add('active');
        } else {
            btn.classList.remove('active');
        }
    });

    const indicator = document.getElementById('navIndicator');
    if (indicator && nextIndex !== -1) {
        indicator.style.transform = `translateX(${nextIndex * 100}%)`;
    }
}

window.openExternalApp = openExternalApp;
window.closeExternalApp = closeExternalApp;
window.syncExternalAppView = syncExternalAppView;

document.addEventListener('DOMContentLoaded', () => {
    const frame = document.getElementById('externalAppFrame');
    if (!frame) return;
    frame.addEventListener('load', () => {
        frame.classList.add('is-loaded');
        document.getElementById('externalAppLoader')?.classList.add('hidden');
        document.getElementById('externalAppFallback')?.classList.add('hidden');
        clearTimeout(externalAppLoadTimer);
    });
    frame.addEventListener('error', () => {
        frame.classList.remove('is-loaded');
        document.getElementById('externalAppLoader')?.classList.add('hidden');
        document.getElementById('externalAppFallback')?.classList.remove('hidden');
        clearTimeout(externalAppLoadTimer);
    });
});

function renderDaySelector() {
    const ds = document.getElementById('daySelector');
    if(!ds) return;
    
    const info = getStudentInfo();
    const userDept = info ? info.dept.toUpperCase() : 'BCA';

    const uniqueDates = getFutureSeatExamDates(userDept);
    const selectedDate = appState.selectedDate.replace(/_/g, '-');
    const activeDate = uniqueDates.includes(selectedDate) ? selectedDate : uniqueDates[0];
    const isOpen = appState.openSeatDropdown === 'date';

    if (!uniqueDates.length) {
        ds.innerHTML = `
            <div class="seat-dropdown">
                <button type="button" class="seat-dropdown__trigger" disabled>
                    <div class="seat-dropdown__meta">
                        <span class="seat-dropdown__label">Next Exam</span>
                        <span class="seat-dropdown__value">No future seating</span>
                    </div>
                </button>
            </div>
        `;
        return;
    }

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
    const info = getStudentInfo();
    const adminNo = info?.adminNo || localStorage.getItem('machub_student_id') || '';
    const actualSubjects = [];
    if (adminNo) {
        const cached = getPortalCache('Attendance', adminNo);
        if (cached) {
            try {
                const parsed = JSON.parse(cached);
                const rows = parsed?.data?.payload?.sections?.[0]?.rows || [];
                rows.forEach(item => {
                    if (item.subjectName) actualSubjects.push(item.subjectName);
                });
            } catch(e) {}
        }
    }

    if (actualSubjects.length > 0) {
        return actualSubjects.map((sub, idx) => {
            const date = new Date('2026-06-10'); // Theory exams start June 10
            date.setDate(date.getDate() + (idx * 2));
            const dateStr = `${String(date.getDate()).padStart(2, '0')}-${String(date.getMonth() + 1).padStart(2, '0')}-${date.getFullYear()}`;
            return {
                date: dateStr,
                code: `MG2CCR${deptCode.toUpperCase()}${101 + idx}`,
                title: sub,
                time: "10:30 AM"
            };
        });
    }

    const deptMap = {
        'BCA': window.TIMETABLE_BCA,
        'BBA': window.TIMETABLE_BBA,
        'BSW': window.TIMETABLE_BSW
    };

    return (deptMap[deptCode] || []).slice().sort((a, b) => getISTDate(a.date) - getISTDate(b.date));
}

function getDepartmentPracticalScheduleByCode(deptCode) {
    const info = getStudentInfo();
    const adminNo = info?.adminNo || localStorage.getItem('machub_student_id') || '';
    const actualSubjects = [];
    if (adminNo) {
        const cached = getPortalCache('Attendance', adminNo);
        if (cached) {
            try {
                const parsed = JSON.parse(cached);
                const rows = parsed?.data?.payload?.sections?.[0]?.rows || [];
                rows.forEach(item => {
                    if (item.subjectName) {
                        const name = item.subjectName.toLowerCase();
                        if (name.includes('structures') || name.includes('technology') || name.includes('lab') || name.includes('practical')) {
                            actualSubjects.push(item.subjectName);
                        }
                    }
                });
            } catch(e) {}
        }
    }

    if (actualSubjects.length > 0) {
        return actualSubjects.map((sub, idx) => {
            const date = new Date('2026-06-25'); // Practicals start later
            date.setDate(date.getDate() + idx);
            const dateStr = `${String(date.getDate()).padStart(2, '0')}-${String(date.getMonth() + 1).padStart(2, '0')}-${date.getFullYear()}`;
            return {
                date: dateStr,
                code: `${deptCode.toUpperCase()}-PRACTICAL-${idx + 1}`,
                title: sub + " Practical",
                time: "Tentative",
                type: "practical"
            };
        });
    }

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

function isPracticalScheduleActiveForUser() {
    const info = getStudentInfo();
    const userDept = info ? info.dept.toUpperCase() : null;
    if (!userDept) return false;

    const now = new Date();
    const activeSchedule = getCountdownSchedule(userDept, now);
    return activeSchedule.some(exam => exam.type === 'practical' && getExamEndTime(exam.date) > now);
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
        let saved = null;
        try { saved = localStorage.getItem(storageKey); } catch (e) { console.warn('localStorage restricted', e); }
        if (!saved) return createPredictionState(entry);
        return normalizePredictionState(entry, JSON.parse(saved));
    } catch (error) {
        return createPredictionState(entry);
    }
}

function savePredictionState() {
    if (!currentPredictionKey) return;
    try {
        try {
            localStorage.setItem(currentPredictionKey, JSON.stringify(currentPredictionState));
        } catch (e) { console.warn('localStorage restricted', e); }
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
            try {
                localStorage.removeItem(currentPredictionKey);
            } catch (e) { console.warn('localStorage restricted', e); }
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
    const metrics = buildTimetableMapMetrics(typedSchedule);
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

    const secondaryPanel = '';

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



            ${secondaryPanel}

            <div class="exam-route ${showPracticalRoute ? 'is-practical-route' : ''}" style="--marker-top:${marker.top}px; --progress-start:${progressStart}px; --progress-height:${progressHeight}px; min-height:${routeHeight}px;">
                <div class="exam-route-start" aria-hidden="true"></div>
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
    const invigilatorDesk = document.getElementById('invigilatorDesk');
    invigilatorDesk?.classList.remove('hidden');

    const info = getStudentInfo();
    const userDept = info ? info.dept.toUpperCase() : 'BCA';
    const futureSeatDates = getFutureSeatExamDates(userDept);
    const activeTimetableIsPractical = window.ACTIVE_TIMETABLE_TYPE === 'practical' || isPracticalScheduleActiveForUser();
    const selectedDateFormatted = appState.selectedDate.replace(/_/g, '-');
    const selectedDateIsPractical = (window.PRACTICAL_TIMETABLE_BCA || []).some(exam => exam.date === selectedDateFormatted);
    if (!futureSeatDates.length && !activeTimetableIsPractical && !selectedDateIsPractical) {
        const hallTitle = document.getElementById('currentHallTitle');
        const audInfo = document.getElementById('currentAudInfo');
        if (hallTitle) hallTitle.textContent = 'No Future Seating';
        if (audInfo) audInfo.textContent = 'Check back later';
        invigilatorDesk?.classList.add('hidden');
        grid.innerHTML = `
            <div class="practical-seat-empty">
                <div class="practical-seat-empty__icon">SEAT</div>
                <p class="practical-seat-empty__kicker">Not available</p>
                <h3>No future seating has been published.</h3>
                <p>Past seating maps are hidden here. New seating will appear when the next exam arrangement is available.</p>
            </div>
        `;
        return;
    }

    if (activeTimetableIsPractical || selectedDateIsPractical) {
        const hallTitle = document.getElementById('currentHallTitle');
        const audInfo = document.getElementById('currentAudInfo');
        if (hallTitle) hallTitle.textContent = 'Practical Exam';
        if (audInfo) audInfo.textContent = 'Seating not available';
        invigilatorDesk?.classList.add('hidden');
        grid.innerHTML = `
            <div class="practical-seat-empty">
                <div class="practical-seat-empty__icon">LAB</div>
                <p class="practical-seat-empty__kicker">Practical mode</p>
                <h3>Seating is not available for practical exams.</h3>
                <p>Lab allocations are handled separately, so this seating map is only shown for theory exam days.</p>
            </div>
        `;
        return;
    }
    
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

window.obData = { name: '', dept: '', reg: '', adminNo: '' };
let obData = window.obData;

function validateObStep2() {
    obData = window.obData || obData || { name: '', dept: '', reg: '', adminNo: '' };
    window.obData = obData;

    const nameVal = (document.getElementById('ob-name')?.value || "").trim();
    const regVal = (document.getElementById('ob-reg')?.value || "").trim();
    const adminNoVal = (document.getElementById('ob-adminNo')?.value || "").trim();
    
    obData.name = nameVal;
    obData.reg = regVal;
    obData.adminNo = adminNoVal;

    const btn = document.getElementById('ob-final-btn');
    if (obData.name && obData.dept) {
        if (btn) {
            btn.classList.remove('opacity-30', 'pointer-events-none');
            btn.classList.add('spring');
        }
        // Update greeting and countdown in background
        // Temporarily save to local storage to let updateCountdown use it
        const tempInfo = { name: obData.name, dept: obData.dept, reg: obData.reg, adminNo: obData.adminNo };
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
    ['ob-step-1', 'ob-step-2', 'ob-step-2b', 'ob-step-3'].forEach(id => {
        const el = document.getElementById(id);
        if (!el) return;
        el.classList.add('hidden');
        el.style.display = '';
    });
    ['dot-1', 'dot-2', 'dot-3'].forEach(id => {
        document.getElementById(id)?.classList.remove('active');
    });

    const stepId = step === 2.5 ? 'ob-step-2b' : `ob-step-${step}`;
    const dotId = step === 1 ? 'dot-1' : step === 3 ? 'dot-3' : 'dot-2';
    const stepEl = document.getElementById(stepId);
    if (stepEl) {
        stepEl.classList.remove('hidden');
        stepEl.style.display = '';
    }
    document.getElementById(dotId)?.classList.add('active');
}

function selectObDept(dept) {
    obData = window.obData || obData || { name: '', dept: '', reg: '', adminNo: '' };
    window.obData = obData;
    obData.dept = dept;

    ['BCA', 'BBA', 'BSW'].forEach(d => {
        const btn = document.getElementById('btn-' + d);
        if (!btn) return;
        if (d === dept) {
            btn.classList.add('bg-[var(--mac-blue)]', 'text-white', 'opacity-100');
            btn.classList.remove('opacity-60');
        } else {
            btn.classList.remove('bg-[var(--mac-blue)]', 'text-white', 'opacity-100');
            btn.classList.add('opacity-60');
        }
    });
    validateObStep2();
}

function finishOnboarding() {
    obData = window.obData || obData || { name: '', dept: '', reg: '', adminNo: '' };
    window.obData = obData;

    const profile = {
        name: (obData.name || '').trim(),
        dept: (obData.dept || '').trim(),
        reg: (obData.reg || '').trim(),
        adminNo: (obData.adminNo || '').trim(),
        classGroup: obData.classGroup || '',
        classNo: obData.classNo || ''
    };

    if (!profile.name || !profile.dept) {
        alert('Please choose your profile or complete the manual setup.');
        nextObStep(2);
        return;
    }

    saveStudentInfo(profile);
    const obScreen = document.getElementById('onboardingScreen');
    if (obScreen) {
        obScreen.classList.add('collapsed');
        obScreen.classList.add('hidden');
        setTimeout(() => obScreen.style.display = 'none', 600);
    }
    applyUserProfile();
    autoSelectNextExamDay();
}

window.nextObStep = nextObStep;
window.selectObDept = selectObDept;
window.validateObStep2 = validateObStep2;
window.finishOnboarding = finishOnboarding;
window.applyUserProfile = applyUserProfile;

async function applyUserProfile() {
    const info = getStudentInfo();
    const deptEl = document.getElementById('homeUserDept');
    const greetingEl = document.getElementById('homeGreeting');
    const regEl = document.getElementById('homeUserReg');

    if (info) {
        if (deptEl) deptEl.textContent = info.dept || 'General';
        
        if (regEl) {
            regEl.textContent = info.reg || 'Not set';
            regEl.classList.toggle('opacity-30', !info.reg);
        }

        if (greetingEl) {
            const displayName = info.name && info.name !== 'Guest' ? info.name.split(' ')[0] : 'Guest';
            greetingEl.textContent = `Hi, ${displayName}!`;
        }

        if (info.dept) {
            setFilter(info.dept);
            currentClassDept = info.dept.toUpperCase();
            if (typeof renderClassFilters === 'function') {
                renderClassFilters();
                renderClassDaySelector();
                renderClassTimetable();
                renderClassSubjects();
                renderClassAttendance();
            }
        }
        updateCountdown();

        if (info.adminNo && window.startBackgroundSync) {
            window.startBackgroundSync();
        }

        if (info.reg) {
            app.s = info.reg.toLowerCase();
            const searchInput = document.getElementById('globalSearch');
            if (searchInput) searchInput.value = info.reg;
            
            if (window.ALL_DEPARTMENTS) {
                const match = ALL_DEPARTMENTS.find(d => d[0].toLowerCase().includes(app.s));
                if (match) {
                    if (match[1] !== app.h) changeHall(match[1]);
                }
            }
        }
    } else {
        if (greetingEl) greetingEl.textContent = 'Hello!';
        if (deptEl) deptEl.textContent = '---';
        if (regEl) regEl.textContent = '---';
    }
}

function checkOnboarding() {
    const saved = getStudentInfo();
    const obScreen = document.getElementById('onboardingScreen');

    if (!saved) {
        if (obScreen) obScreen.classList.remove('hidden');
    } else {
        if (obScreen) obScreen.classList.add('hidden', 'collapsed');
        applyUserProfile();
    }
}



let _editDept = '';

function openEditProfile() {
    const info = getStudentInfo() || {};
    _editDept = info.dept || '';
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

    const phoneInput = document.getElementById('editPhone');
    const emailInput = document.getElementById('editEmail');
    const addrInput = document.getElementById('editAddress');
    const holderInput = document.getElementById('editBankHolder');
    const bankNameInput = document.getElementById('editBankName');
    const accNoInput = document.getElementById('editBankAccNo');
    const ifscInput = document.getElementById('editBankIfsc');
    const branchInput = document.getElementById('editBankBranch');

    if (phoneInput) phoneInput.value = overrides.phone || '';
    if (emailInput) emailInput.value = overrides.email || '';
    if (addrInput) addrInput.value = overrides.address || '';
    
    if (holderInput) holderInput.value = bank.holder || '';
    if (bankNameInput) bankNameInput.value = bank.bankName || '';
    if (accNoInput) accNoInput.value = bank.accNo || '';
    if (ifscInput) ifscInput.value = bank.ifsc || '';
    if (branchInput) branchInput.value = bank.branch || '';

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
    const adminNo = (document.getElementById('editAdminNo')?.value || '').trim();
    const dept = _editDept;

    if (!name || !dept) {
        alert('Please fill in your name and select a department.');
        return;
    }

    const updated = { name, reg, adminNo, dept };
    saveStudentInfo(updated);

    // Save custom overrides & bank details
    const phone = (document.getElementById('editPhone')?.value || '').trim();
    const email = (document.getElementById('editEmail')?.value || '').trim();
    const address = (document.getElementById('editAddress')?.value || '').trim();
    
    const holder = (document.getElementById('editBankHolder')?.value || '').trim();
    const bankName = (document.getElementById('editBankName')?.value || '').trim();
    const accNo = (document.getElementById('editBankAccNo')?.value || '').trim();
    const ifsc = (document.getElementById('editBankIfsc')?.value || '').trim();
    const branch = (document.getElementById('editBankBranch')?.value || '').trim();

    const overrides = { phone, email, address };
    const bank = { holder, bankName, accNo, ifsc, branch };

    localStorage.setItem('machub_profile_overrides_' + adminNo, JSON.stringify(overrides));
    localStorage.setItem('machub_bank_details_' + adminNo, JSON.stringify(bank));

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

    if (typeof renderUserProfile === 'function') {
        renderUserProfile();
    }
    
    // Clear and reload Profile section if currently viewed
    if (window.MacHubPortal && typeof window.MacHubPortal.clearCache === 'function') {
      window.MacHubPortal.clearCache('Profile');
      // If we are currently on the profile tab in portal, reload it
      const activeBtn = document.querySelector('.flex.overflow-x-auto .bg-\\[var\\(--mac-blue\\)\\]');
      if (activeBtn && activeBtn.textContent.includes('Profile')) {
        window.loadPortalSection('Profile', 'Profile');
      }
    }

    closeEditProfile();

    if (window.startBackgroundSync) {
        window.startBackgroundSync();
    }
}
window.openEditProfileModal = openEditProfile;
window.saveEditProfileModal = saveEditProfile;
function autoSelectNextExamDay() {
    if (!window.EXAM_TIMETABLE || window.EXAM_TIMETABLE.length === 0) {
        appState.selectedDate = '';
        renderDaySelector();
        renderMap();
        return;
    }

    const info = getStudentInfo();
    const userDept = info ? info.dept.toUpperCase() : null;
    const now = new Date();
    const futureSeatDates = userDept ? getFutureSeatExamDates(userDept, now) : [];
    const nextDateStr = futureSeatDates[0] || null;
    
    if (nextDateStr) {
        const folderName = nextDateStr.replace(/-/g, '_');
        selectDay(folderName);
    } else {
        appState.selectedDate = '';
        renderDaySelector();
        renderMap();
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
    const academicSheet = document.getElementById('academicSheet');
    const drawerOpen = drawer && drawer.style.transform !== 'translateY(100%)' && drawer.style.transform !== '';
    const marksOpen = marksSheet && marksSheet.style.transform !== 'translateY(100%)' && marksSheet.style.transform !== '';
    const timetableOpen = timetableExamSheet && timetableExamSheet.style.transform !== 'translateY(100%)' && timetableExamSheet.style.transform !== '';
    const academicOpen = academicSheet && academicSheet.style.transform !== 'translateY(100%)' && academicSheet.style.transform !== '';
    if (drawerOpen || marksOpen || timetableOpen || academicOpen) return;
    _navLockedHidden = false;
    const nav = document.getElementById('bottomNav');
    if (nav) nav.classList.remove('nav-hidden');
    _navHidden = false;
}

// Expose navigation/sheet utilities to global scope
window.hideBottomNav = hideBottomNav;
window.showBottomNav = showBottomNav;
if (typeof snapSheetOpen !== 'undefined') window.snapSheetOpen = snapSheetOpen;
if (typeof snapSheetClosed !== 'undefined') window.snapSheetClosed = snapSheetClosed;
if (typeof initDraggableSheet !== 'undefined') window.initDraggableSheet = initDraggableSheet;

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

// ==================== ANNOUNCEMENTS PORTAL ====================
window.openAnnouncements = function() {
    switchView('view-announcements');
    const nav = document.getElementById('bottomNav');
    if (nav) nav.classList.add('nav-hidden');
    renderAnnouncements('All');
};

window.closeAnnouncements = function() {
    const nav = document.getElementById('bottomNav');
    if (nav) nav.classList.remove('nav-hidden');
    switchView('view-home');
};

window.renderAnnouncements = function(category = 'All') {
    const container = document.getElementById('announcementsList');
    if (!container) return;

    // Render categories filter pills
    const categoriesContainer = document.getElementById('announcementCategories');
    if (categoriesContainer) {
        const categories = ['All', 'Exam', 'Class', 'Sports'];
        categoriesContainer.innerHTML = categories.map(cat => {
            const isActive = cat.toLowerCase() === category.toLowerCase();
            return `
                <button type="button" onclick="renderAnnouncements('${cat}')" class="px-4 py-1.5 rounded-full text-[9px] font-black uppercase tracking-wider transition-all duration-300 flex-shrink-0 ${
                    isActive
                        ? 'bg-[var(--mac-blue)] text-white shadow-sm'
                        : 'bg-black/5 dark:bg-white/5 text-[#86868b] hover:bg-black/10 dark:hover:bg-white/10'
                }">
                    ${cat}
                </button>
            `;
        }).join('');
    }

    const data = window.ANNOUNCEMENTS_DATA || [];
    const filtered = category.toLowerCase() === 'all' ? data : data.filter(a => a.category.toLowerCase() === category.toLowerCase());

    if (!filtered.length) {
        container.innerHTML = `
            <div class="glass-panel p-8 text-center my-6 rounded-3xl text-[#86868b]">
                <p class="text-4xl mb-3">🔔</p>
                <p class="text-sm font-bold">No announcements in ${category}</p>
            </div>
        `;
        return;
    }

    container.innerHTML = filtered.map(item => {
        let icon = '📢';
        let badgeColor = 'bg-blue-500/10 text-blue-500';
        if (item.category === 'Exam') {
            icon = '📝';
            badgeColor = 'bg-red-500/10 text-red-500';
        } else if (item.category === 'Class') {
            icon = '🏫';
            badgeColor = 'bg-green-500/10 text-green-500';
        } else if (item.category === 'Sports') {
            icon = '⚽';
            badgeColor = 'bg-orange-500/10 text-orange-500';
        }

        return `
            <div class="glass-panel p-5 rounded-[2rem] border border-white/10 dark:border-white/5 relative overflow-hidden transition-all duration-300 hover:translate-y-[-2px] hover:shadow-md">
                <div class="flex items-center justify-between gap-3 mb-2.5">
                    <div class="flex items-center gap-2">
                        <span class="w-8 h-8 bg-black/5 dark:bg-white/5 rounded-xl flex items-center justify-center text-lg">${icon}</span>
                        <div class="flex flex-wrap gap-1">
                            <span class="${badgeColor} text-[8px] font-black px-2 py-0.5 rounded-full uppercase tracking-wider">
                                ${item.category}
                            </span>
                            ${item.badge ? `
                            <span class="bg-black/5 dark:bg-white/5 text-[#86868b] text-[8px] font-bold px-2 py-0.5 rounded-full uppercase tracking-wider">
                                ${item.badge}
                            </span>` : ''}
                        </div>
                    </div>
                    <span class="text-[9px] font-bold text-[#86868b] tracking-tight">
                        ${item.date} • ${item.time}
                    </span>
                </div>
                <h4 class="text-base font-bold text-[#1d1d1f] dark:text-[#f5f5f7] leading-tight mb-2">
                    ${item.title}
                </h4>
                <p class="text-xs text-[#86868b] dark:text-[#86868b]/90 leading-relaxed font-medium font-bold">
                    ${item.content}
                </p>
            </div>
        `;
    }).join('');
};

// ==================== CLASS HUB FUNCTIONS ====================
window.renderClassFilters = function() {
    const container = document.getElementById('classDepartmentFilters');
    if (!container) return;

    const isOpen = appState.openClassDropdown === 'department';

    container.innerHTML = `
        <div class="seat-dropdown ${isOpen ? 'is-open' : ''}">
            <button type="button" onclick="toggleClassDropdown('department')" class="seat-dropdown__trigger">
                <div class="seat-dropdown__meta">
                    <span class="seat-dropdown__label">Department</span>
                    <span class="seat-dropdown__value">${currentClassDept}</span>
                </div>
                <span class="seat-dropdown__icon">⌄</span>
            </button>
            <div class="seat-dropdown__menu">
                <button type="button" onclick="selectClassDept('BCA')" class="seat-dropdown__option ${currentClassDept === 'BCA' ? 'is-active' : ''}">
                    <span class="seat-dropdown__option-title">BCA</span>
                    <span class="seat-dropdown__option-meta">Computer Applications</span>
                </button>
                <button type="button" onclick="selectClassDept('BBA')" class="seat-dropdown__option ${currentClassDept === 'BBA' ? 'is-active' : ''}">
                    <span class="seat-dropdown__option-title">BBA</span>
                    <span class="seat-dropdown__option-meta">Business Administration</span>
                </button>
                <button type="button" onclick="selectClassDept('BSW')" class="seat-dropdown__option ${currentClassDept === 'BSW' ? 'is-active' : ''}">
                    <span class="seat-dropdown__option-title">BSW</span>
                    <span class="seat-dropdown__option-meta">Social Work</span>
                </button>
            </div>
        </div>
    `;
};

window.renderClassDaySelector = function() {
    const container = document.getElementById('classDaySelector');
    if (!container) return;

    const isOpen = appState.openClassDropdown === 'day';
    const days = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday'];

    container.innerHTML = `
        <div class="seat-dropdown ${isOpen ? 'is-open' : ''}">
            <button type="button" onclick="toggleClassDropdown('day')" class="seat-dropdown__trigger">
                <div class="seat-dropdown__meta">
                    <span class="seat-dropdown__label">Day</span>
                    <span class="seat-dropdown__value">${currentClassDay}</span>
                </div>
                <span class="seat-dropdown__icon">⌄</span>
            </button>
            <div class="seat-dropdown__menu">
                ${days.map(day => `
                    <button type="button" onclick="selectClassDay('${day}')" class="seat-dropdown__option ${currentClassDay === day ? 'is-active' : ''}">
                        <span class="seat-dropdown__option-title">${day}</span>
                        <span class="seat-dropdown__option-meta">Timetable for ${day}</span>
                    </button>
                `).join('')}
            </div>
        </div>
    `;
};

window.toggleClassDropdown = function(name) {
    appState.openClassDropdown = appState.openClassDropdown === name ? null : name;
    renderClassFilters();
    renderClassDaySelector();
};

window.closeClassDropdowns = function() {
    appState.openClassDropdown = null;
};

window.selectClassDept = function(dept) {
    currentClassDept = dept;
    closeClassDropdowns();
    renderClassFilters();
    renderClassDaySelector();
    renderClassTimetable();
    renderClassSubjects();
    renderClassAttendance();
};

window.selectClassDay = function(day) {
    currentClassDay = day;
    closeClassDropdowns();
    renderClassFilters();
    renderClassDaySelector();
    renderClassTimetable();
};

window.switchClassTab = function(tab) {
    const timetableEl = document.getElementById('sub-view-class-timetable');
    const subjectsEl = document.getElementById('sub-view-class-subjects');
    const attendanceEl = document.getElementById('sub-view-class-attendance');
    const timetableBtn = document.getElementById('tab-class-timetable');
    const subjectsBtn = document.getElementById('tab-class-subjects');
    const attendanceBtn = document.getElementById('tab-class-attendance');

    if (!timetableEl || !subjectsEl || !attendanceEl) return;

    timetableEl.classList.toggle('hidden', tab !== 'timetable');
    subjectsEl.classList.toggle('hidden', tab !== 'subjects');
    attendanceEl.classList.toggle('hidden', tab !== 'attendance');

    if (timetableBtn) timetableBtn.classList.toggle('is-active', tab === 'timetable');
    if (subjectsBtn) subjectsBtn.classList.toggle('is-active', tab === 'subjects');
    if (attendanceBtn) attendanceBtn.classList.toggle('is-active', tab === 'attendance');

    appState.classSubTab = tab;

    if (tab === 'attendance') {
        renderClassAttendance();
    }
};

window.renderClassTimetable = function() {
    const container = document.getElementById('classTimetableContent');
    if (!container) return;

    const info = getStudentInfo();
    const dept = currentClassDept.toUpperCase();
    const day = currentClassDay;

    // Retrieve actual subjects from synced ePortal Attendance
    const actualSubjects = [];
    const adminNo = info?.adminNo || localStorage.getItem('machub_student_id') || '';
    if (adminNo) {
        const cached = getPortalCache('Attendance', adminNo);
        if (cached) {
            try {
                const parsed = JSON.parse(cached);
                const rows = parsed?.data?.payload?.sections?.[0]?.rows || parsed?.data?.sections?.[0]?.rows || [];
                rows.forEach(item => {
                    if (item.subjectName) {
                        actualSubjects.push({
                            subjectName: item.subjectName,
                            percentage: item.percentage,
                            presentHours: item.presentHours,
                            totalHours: item.totalHours
                        });
                    }
                });
            } catch(e) {}
        }
    }

    if (actualSubjects.length > 0) {
        // Distribute actual subjects across Monday-Friday periods
        const dayIndex = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday'].indexOf(day);
        const periods = [];
        const times = ['09:30 AM - 10:30 AM', '10:30 AM - 11:30 AM', '11:30 AM - 12:30 PM', '01:30 PM - 02:30 PM', '02:30 PM - 03:30 PM'];
        
        for (let i = 0; i < 5; i++) {
            const subjectIdx = (dayIndex * 5 + i) % actualSubjects.length;
            const subjectData = actualSubjects[subjectIdx];
            periods.push({
                period: i + 1,
                time: times[i],
                title: subjectData.subjectName,
                code: `MG2CCR${dept.toUpperCase()}${101 + subjectIdx}`,
                percentage: subjectData.percentage,
                presentHours: subjectData.presentHours,
                totalHours: subjectData.totalHours
            });
        }

        container.innerHTML = periods.map(period => {
            const pct = parseFloat(period.percentage) || 0;
            const present = parseInt(period.presentHours) || 0;
            const total = parseInt(period.totalHours) || 0;
            
            // Color coding
            let progressColor = 'bg-emerald-500';
            if (pct < 75) {
                progressColor = 'bg-red-500';
            } else if (pct < 80) {
                progressColor = 'bg-amber-500';
            }

            // Bunk calculations
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
                <div class="glass-panel p-5 rounded-[2rem] border border-white/10 dark:border-white/5 relative overflow-hidden transition-all duration-300 hover:translate-y-[-2px] hover:shadow-md flex flex-col gap-3">
                    <div class="absolute left-0 top-0 bottom-0 w-1.5 bg-[var(--mac-blue)]"></div>
                    
                    <div class="flex items-center justify-between gap-4 w-full pl-2">
                        <div class="flex-1 min-w-0">
                            <div class="flex items-center gap-2 mb-1">
                                <span class="bg-[var(--mac-blue)]/10 text-[var(--mac-blue)] dark:text-blue-400 text-[10px] font-black px-2 py-0.5 rounded-full uppercase tracking-wider">
                                    Period ${period.period}
                                </span>
                                <span class="text-[#86868b] dark:text-[#86868b]/75 text-[10px] font-bold">
                                    ${period.time}
                                </span>
                            </div>
                            <h4 class="text-base font-bold text-[#1d1d1f] dark:text-[#f5f5f7] leading-tight truncate">
                                ${period.title}
                            </h4>
                        </div>
                        <div class="flex-shrink-0">
                            <span class="inline-block bg-black/5 dark:bg-white/5 text-[#1d1d1f] dark:text-[#f5f5f7] text-[10px] font-bold px-3 py-1 rounded-xl border border-white/5">
                                📍 Lab/Room ${201 + (period.period % 3)}
                            </span>
                        </div>
                    </div>
                    
                    <div class="pl-2 w-full">
                        <div class="flex flex-col gap-1.5 w-full">
                            <div class="flex items-center justify-between gap-2">
                                <div class="flex items-center gap-1.5 flex-wrap">
                                    <span class="text-[10px] font-bold text-[#86868b] uppercase tracking-wider">${period.code}</span>
                                    <span class="text-[9px] text-[#86868b]">•</span>
                                    <span class="text-[10px] font-black text-[#1d1d1f] dark:text-[#f5f5f7]">${present}/${total} Hours</span>
                                    ${bunkBadge}
                                </div>
                                <span class="text-xs font-black text-[#1d1d1f] dark:text-[#f5f5f7]">${Math.round(pct)}%</span>
                            </div>
                            <!-- Micro progress bar -->
                            <div class="w-full h-1.5 bg-black/5 dark:bg-white/10 rounded-full overflow-hidden border border-white/5">
                                <div class="${progressColor} h-full rounded-full transition-all duration-500" style="width: ${Math.min(100, pct)}%"></div>
                            </div>
                        </div>
                    </div>
                </div>
            `;
        }).join('');
        return;
    }

    const timetableKey = `CLASS_TIMETABLE_${dept}`;
    const timetableData = window[timetableKey] ? window[timetableKey][day] : null;

    if (!timetableData || !timetableData.length) {
        container.innerHTML = `
            <div class="text-center p-8 text-[#86868b]">
                <p class="text-3xl mb-2">💤</p>
                <p class="text-sm font-bold">No lectures scheduled for ${day}</p>
            </div>
        `;
        return;
    }

    container.innerHTML = timetableData.map(period => {
        const subjectsKey = `CLASS_SUBJECTS_${dept}`;
        const subjectDetail = window[subjectsKey]?.find(s => s.code === period.code) || {};
        const teacherName = subjectDetail.teacher?.name || "Faculty Assigned";

        // Try to find matching attendance data from synced cache
        let attData = null;
        if (adminNo) {
            const cached = getPortalCache('Attendance', adminNo);
            if (cached) {
                try {
                    const parsed = JSON.parse(cached);
                    const rows = parsed?.data?.payload?.sections?.[0]?.rows || parsed?.data?.sections?.[0]?.rows || [];
                    attData = rows.find(r => r.subjectName && (
                        r.subjectName.toLowerCase().includes(period.title.toLowerCase()) ||
                        period.title.toLowerCase().includes(r.subjectName.toLowerCase())
                    ));
                } catch(e) {}
            }
        }

        let attendanceHtml = '';
        if (attData) {
            const pct = parseFloat(attData.percentage) || 0;
            const present = parseInt(attData.presentHours) || 0;
            const total = parseInt(attData.totalHours) || 0;
            
            let progressColor = 'bg-emerald-500';
            if (pct < 75) {
                progressColor = 'bg-red-500';
            } else if (pct < 80) {
                progressColor = 'bg-amber-500';
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

            attendanceHtml = `
                <div class="flex flex-col gap-1.5 w-full mt-2">
                    <div class="flex items-center justify-between gap-2">
                        <div class="flex items-center gap-1.5 flex-wrap">
                            <span class="text-[10px] font-bold text-[#86868b] uppercase tracking-wider">${period.code}</span>
                            <span class="text-[9px] text-[#86868b]">•</span>
                            <span class="text-[10px] font-black text-[#1d1d1f] dark:text-[#f5f5f7]">${present}/${total} Hours</span>
                            ${bunkBadge}
                        </div>
                        <span class="text-xs font-black text-[#1d1d1f] dark:text-[#f5f5f7]">${Math.round(pct)}%</span>
                    </div>
                    <!-- Micro progress bar -->
                    <div class="w-full h-1.5 bg-black/5 dark:bg-white/10 rounded-full overflow-hidden border border-white/5">
                        <div class="${progressColor} h-full rounded-full transition-all duration-500" style="width: ${Math.min(100, pct)}%"></div>
                    </div>
                </div>
            `;
        } else {
            attendanceHtml = `
                <div class="flex items-center gap-2 mt-2">
                    <span class="text-[10px] font-bold text-[#86868b] uppercase tracking-wider">${period.code}</span>
                    <span class="text-[9px] text-[#86868b]">•</span>
                    <span class="text-[10px] text-[#86868b] font-bold">${teacherName}</span>
                </div>
            `;
        }

        return `
            <div class="glass-panel p-5 rounded-[2rem] border border-white/10 dark:border-white/5 relative overflow-hidden transition-all duration-300 hover:translate-y-[-2px] hover:shadow-md flex flex-col gap-2">
                <div class="absolute left-0 top-0 bottom-0 w-1.5 bg-[var(--mac-blue)]"></div>
                
                <div class="flex items-center justify-between gap-4 w-full pl-2">
                    <div class="flex-1 min-w-0">
                        <div class="flex items-center gap-2 mb-1">
                            <span class="bg-[var(--mac-blue)]/10 text-[var(--mac-blue)] dark:text-blue-400 text-[10px] font-black px-2 py-0.5 rounded-full uppercase tracking-wider">
                                Period ${period.period}
                            </span>
                            <span class="text-[#86868b] dark:text-[#86868b] text-[10px] font-bold">
                                ${period.time}
                            </span>
                        </div>
                        <h4 class="text-lg font-bold text-[#1d1d1f] dark:text-[#f5f5f7] leading-tight truncate">
                            ${period.title}
                        </h4>
                    </div>
                    
                    <div class="text-right flex-shrink-0">
                        <span class="inline-block bg-black/5 dark:bg-white/5 text-[#1d1d1f] dark:text-[#f5f5f7] text-[10px] font-bold px-3 py-1 rounded-xl border border-white/5">
                            📍 ${period.room}
                        </span>
                    </div>
                </div>
                
                <div class="pl-2 w-full">
                    ${attendanceHtml}
                </div>
            </div>
        `;
    }).join('');
};

window.renderClassSubjects = function() {
    const container = document.getElementById('classSubjectsContent');
    if (!container) return;

    const info = getStudentInfo();
    const adminNo = info?.adminNo || localStorage.getItem('machub_student_id') || '';
    
    // Retrieve actual subjects from synced ePortal Attendance
    const actualSubjects = [];
    if (adminNo) {
        const cached = getPortalCache('Attendance', adminNo);
        if (cached) {
            try {
                const parsed = JSON.parse(cached);
                const rows = parsed?.data?.payload?.sections?.[0]?.rows || [];
                rows.forEach(item => {
                    if (item.subjectName) {
                        actualSubjects.push({
                            title: item.subjectName,
                            percentage: item.percentage,
                            presentHours: item.presentHours,
                            totalHours: item.totalHours
                        });
                    }
                });
            } catch(e) {}
        }
    }

    if (actualSubjects.length > 0) {
        // Look up assessment details for each subject to show marks in expanded view
        let assessData = [];
        if (adminNo) {
            const cachedAssess = getPortalCache('Assessment', adminNo);
            if (cachedAssess) {
                try {
                    assessData = JSON.parse(cachedAssess)?.data?.payload?.sections || [];
                } catch(e) {}
            }
        }

        container.innerHTML = actualSubjects.map((subject, idx) => {
            const uniqueId = `subject-card-${idx}`;
            
            // Find corresponding assessment section for this subject
            const matchingAssess = assessData.find(sec => 
                sec.subject && (sec.subject.toLowerCase().includes(subject.title.toLowerCase()) || 
                                subject.title.toLowerCase().includes(sec.subject.toLowerCase()))
            );
            
            let assessmentHtml = '';
            if (matchingAssess && matchingAssess.rows?.length) {
                assessmentHtml = matchingAssess.rows.map(row => {
                    const rowKeys = Object.keys(row);
                    const label = row[rowKeys[0]] || '';
                    const marks = row['marks'] || row['score'] || row[rowKeys[1]] || '';
                    return `
                        <div class="border-l border-white/10 dark:border-white/5 pl-3 py-1.5 flex justify-between items-center">
                            <div>
                                <p class="text-xs font-bold text-[#1d1d1f] dark:text-[#f5f5f7]">${label}</p>
                            </div>
                            <span class="text-xs font-black text-[var(--mac-blue)]">${marks}</span>
                        </div>
                    `;
                }).join('');
            } else {
                assessmentHtml = `
                    <p class="text-xs font-bold text-[#86868b] italic pl-3">No assessment marks uploaded yet.</p>
                `;
            }

            const pct = parseFloat(subject.percentage) || 0;
            const isLow = pct < 75;
            const pctColor = isLow ? 'text-red-500 bg-red-500/10' : 'text-[var(--mac-blue)] bg-[var(--mac-blue)]/10';

            return `
                <div id="${uniqueId}" class="class-subject-card glass-panel rounded-[2rem] border border-white/10 dark:border-white/5 overflow-hidden transition-all duration-300 relative">
                    <div onclick="toggleClassSubjectCard('${uniqueId}')" class="p-5 cursor-pointer flex items-center justify-between gap-4 select-none">
                        <div class="flex-1 min-w-0">
                            <div class="flex items-center gap-2 mb-1.5">
                                <span class="bg-black/5 dark:bg-white/5 text-[#86868b] text-[10px] font-bold px-2.5 py-0.5 rounded-full uppercase tracking-wider">
                                    Enrolled Subject
                                </span>
                                <span class="${pctColor} text-[10px] font-black px-2 py-0.5 rounded-full uppercase tracking-wider">
                                    Attendance: ${subject.percentage || '0%'}
                                </span>
                            </div>
                            <h4 class="text-base font-bold text-[#1d1d1f] dark:text-[#f5f5f7] leading-tight mb-1 truncate">
                                ${subject.title}
                            </h4>
                            <p class="text-xs font-bold text-[#86868b]">
                                Attendance Hours: ${subject.presentHours}/${subject.totalHours} Hours
                            </p>
                        </div>
                        <span class="card-chevron text-lg text-[#86868b] transition-transform duration-300">▼</span>
                    </div>

                    <div class="card-syllabus-content max-h-0 overflow-hidden transition-all duration-300 ease-in-out">
                        <div class="px-5 pb-5 pt-1 border-t border-black/5 dark:border-white/5 space-y-4">
                            <div>
                                <h5 class="text-[10px] font-black text-[#86868b] uppercase tracking-[0.15em] mb-2">Synced Assessment Details</h5>
                                <div class="space-y-3">
                                    ${assessmentHtml}
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            `;
        }).join('');
        return;
    }

    const dept = currentClassDept.toUpperCase();
    const subjectsKey = `CLASS_SUBJECTS_${dept}`;
    const subjectsData = window[subjectsKey] || [];

    if (!subjectsData.length) {
        container.innerHTML = `
            <div class="text-center p-8 text-[#86868b]">
                <p class="text-3xl mb-2">📚</p>
                <p class="text-sm font-bold">No subjects loaded</p>
            </div>
        `;
        return;
    }

    container.innerHTML = subjectsData.map((subject, idx) => {
        const uniqueId = `subject-card-${idx}`;
        const modulesHtml = subject.syllabus.map(mod => {
            const parts = mod.split(':');
            const title = parts[0];
            const desc = parts[1] || '';
            return `
                <div class="border-l border-white/10 dark:border-white/5 pl-3 py-1">
                    <p class="text-xs font-bold text-[#1d1d1f] dark:text-[#f5f5f7]">${title}</p>
                    <p class="text-[11px] text-[#86868b] mt-0.5">${desc}</p>
                </div>
            `;
        }).join('');

        return `
            <div id="${uniqueId}" class="class-subject-card glass-panel rounded-[2rem] border border-white/10 dark:border-white/5 overflow-hidden transition-all duration-300 relative">
                <div onclick="toggleClassSubjectCard('${uniqueId}')" class="p-5 cursor-pointer flex items-center justify-between gap-4 select-none">
                    <div class="flex-1">
                        <div class="flex items-center gap-2 mb-1.5">
                            <span class="bg-black/5 dark:bg-white/5 text-[#86868b] text-[10px] font-bold px-2.5 py-0.5 rounded-full uppercase tracking-wider">
                                ${subject.type}
                            </span>
                            <span class="bg-blue-500/10 text-blue-500 text-[10px] font-black px-2 py-0.5 rounded-full uppercase tracking-wider">
                                ${subject.credits} Credits
                            </span>
                        </div>
                        <h4 class="text-lg font-bold text-[#1d1d1f] dark:text-[#f5f5f7] leading-tight mb-1">
                            ${subject.title}
                        </h4>
                        <p class="text-xs font-bold text-[#86868b]">
                            Code: ${subject.code}
                        </p>
                    </div>
                    <span class="card-chevron text-lg text-[#86868b] transition-transform duration-300">▼</span>
                </div>

                <div class="card-syllabus-content max-h-0 overflow-hidden transition-all duration-300 ease-in-out">
                    <div class="px-5 pb-5 pt-1 border-t border-black/5 dark:border-white/5 space-y-4">
                        <div>
                            <h5 class="text-[10px] font-black text-[#86868b] uppercase tracking-[0.15em] mb-2">Syllabus Breakdown</h5>
                            <div class="space-y-3">
                                ${modulesHtml}
                            </div>
                        </div>
                        
                        <div class="bg-black/5 dark:bg-white/5 rounded-2xl p-4 flex items-center justify-between gap-3 border border-white/5">
                            <div class="flex-1">
                                <p class="text-[8px] font-black text-[#86868b] uppercase tracking-wider mb-0.5">Assigned Faculty</p>
                                <p class="text-sm font-bold text-[#1d1d1f] dark:text-[#f5f5f7]">${subject.teacher.name}</p>
                                <p class="text-[10px] text-[#86868b]">${subject.teacher.designation}</p>
                                <p class="text-[10px] text-[#86868b] mt-1">📍 ${subject.teacher.room}</p>
                            </div>
                            <a href="mailto:${subject.teacher.email}" class="w-10 h-10 bg-[var(--mac-blue)] rounded-full flex items-center justify-center spring hover:scale-105 active:scale-95 text-white text-base shadow-sm">
                                ✉️
                            </a>
                        </div>
                    </div>
                </div>
            </div>
        `;
    }).join('');
};

window.toggleClassSubjectCard = function(cardId) {
    const card = document.getElementById(cardId);
    if (!card) return;

    const content = card.querySelector('.card-syllabus-content');
    const chevron = card.querySelector('.card-chevron');
    if (!content || !chevron) return;

    const isExpanded = card.classList.toggle('is-expanded');
    chevron.style.transform = isExpanded ? 'rotate(180deg)' : 'rotate(0deg)';

    if (isExpanded) {
        content.style.maxHeight = content.scrollHeight + 'px';
    } else {
        content.style.maxHeight = '0px';
    }
};

window.renderClassTeachers = function() {
    const container = document.getElementById('classTeachersContent');
    if (!container) return;

    const dept = currentClassDept.toUpperCase();
    const subjectsKey = `CLASS_SUBJECTS_${dept}`;
    const subjectsData = window[subjectsKey] || [];
    
    const teachersMap = new Map();
    subjectsData.forEach(subject => {
        if (subject.teacher && !teachersMap.has(subject.teacher.name)) {
            teachersMap.set(subject.teacher.name, {
                ...subject.teacher,
                subjectTitle: subject.title
            });
        }
    });

    const uniqueTeachers = Array.from(teachersMap.values());

    if (!uniqueTeachers.length) {
        container.innerHTML = `
            <div class="text-center p-8 text-[#86868b]">
                <p class="text-3xl mb-2">👥</p>
                <p class="text-sm font-bold">No faculty loaded</p>
            </div>
        `;
        return;
    }

    container.innerHTML = uniqueTeachers.map(teacher => {
        return `
            <div class="glass-panel p-5 rounded-[2rem] border border-white/10 dark:border-white/5 relative overflow-hidden transition-all duration-300 hover:shadow-md flex items-center justify-between gap-4">
                <div class="flex-1">
                    <p class="text-[8px] font-black text-[#86868b] uppercase tracking-wider mb-0.5">${teacher.designation}</p>
                    <h4 class="text-lg font-bold text-[#1d1d1f] dark:text-[#f5f5f7] leading-tight mb-1">
                        ${teacher.name}
                    </h4>
                    <p class="text-xs font-bold text-[var(--mac-blue)] dark:text-blue-400 mb-2">
                        Course: ${teacher.subjectTitle}
                    </p>
                    <div class="space-y-1 text-[11px] text-[#86868b] dark:text-[#86868b]/80">
                        <p>📍 ${teacher.room}</p>
                        <p>🕒 Hours: ${teacher.hours}</p>
                    </div>
                </div>
                
                <a href="mailto:${teacher.email}" class="bg-[var(--mac-blue)] text-white px-4 py-2.5 rounded-[1.25rem] text-xs font-bold tracking-tight spring hover:scale-105 active:scale-95 shadow-md flex items-center gap-1.5 whitespace-nowrap">
                    <span>Email Teacher</span>
                    <span class="text-[10px]">✉️</span>
                </a>
            </div>
        `;
    }).join('');
};

window.renderClassAttendance = function() {
    const container = document.getElementById('classAttendanceContent');
    if (!container) return;

    const info = getStudentInfo();
    const adminNo = info?.adminNo || localStorage.getItem('machub_student_id') || '';

    // Pull subject rows from stored attendance data
    const subjects = [];
    if (adminNo) {
        const cached = getPortalCache('Attendance', adminNo);
        if (cached) {
            try {
                const parsed = JSON.parse(cached);
                // Support both possible data structures
                const rows =
                    parsed?.data?.payload?.sections?.[0]?.rows ||
                    parsed?.data?.sections?.[0]?.rows ||
                    parsed?.sections?.[0]?.rows ||
                    [];
                rows.forEach(item => {
                    if (item.subjectName) {
                        subjects.push({
                            name: item.subjectName,
                            present: parseFloat(item.presentHours) || 0,
                            total: parseFloat(item.totalHours) || 0,
                            pct: parseFloat(item.percentage) || 0
                        });
                    }
                });
            } catch(e) {}
        }
    }

    if (!subjects.length) {
        container.innerHTML = `
            <div style="text-align:center;padding:3rem 1rem;">
                <div style="font-size:3rem;margin-bottom:1rem;">📊</div>
                <p style="font-size:0.9rem;font-weight:700;color:var(--mac-secondary,#86868b);">No attendance data yet</p>
                <p style="font-size:0.75rem;color:var(--mac-secondary,#86868b);margin-top:0.4rem;">Your attendance will appear here once it's available.</p>
            </div>
        `;
        return;
    }

    // ── Compute overall stats ──────────────────────────────────────────────
    const totalPresent = subjects.reduce((s, x) => s + x.present, 0);
    const totalHours   = subjects.reduce((s, x) => s + x.total,   0);
    const overallPct   = totalHours > 0 ? (totalPresent / totalHours) * 100 : 0;

    const safeSubjects = subjects.filter(s => s.pct >= 75);
    const warnSubjects = subjects.filter(s => s.pct >= 60 && s.pct < 75);
    const lowSubjects  = subjects.filter(s => s.pct < 60);

    // ── Helper: bunk / attend badge ────────────────────────────────────────
    function calcBadge(present, total, pct) {
        if (total <= 0) return '';
        if (pct >= 75) {
            const maxTotal  = Math.floor(present / 0.75);
            const safeBunks = Math.max(0, maxTotal - total);
            if (safeBunks > 0) {
                return `<span class="att-badge att-badge--safe">⚡ Can skip ${safeBunks}</span>`;
            }
            return `<span class="att-badge att-badge--ok">✅ On Track</span>`;
        } else {
            const needed = Math.ceil((0.75 * total - present) / 0.25);
            if (needed > 0) {
                return `<span class="att-badge att-badge--warn">🚨 Attend ${needed} more</span>`;
            }
            return '';
        }
    }

    // ── Colour helpers ─────────────────────────────────────────────────────
    function pctColor(pct) {
        if (pct >= 80) return '#30d158'; // green
        if (pct >= 75) return '#ff9f0a'; // amber
        return '#ff453a';                // red
    }
    function barBg(pct) {
        if (pct >= 80) return 'linear-gradient(90deg,#30d158,#34c759)';
        if (pct >= 75) return 'linear-gradient(90deg,#ff9f0a,#ffcc00)';
        return 'linear-gradient(90deg,#ff453a,#ff6961)';
    }
    function ringColor(pct) {
        if (pct >= 80) return '#30d158';
        if (pct >= 75) return '#ff9f0a';
        return '#ff453a';
    }

    const overallColor = ringColor(overallPct);
    const dashVal      = Math.min(100, overallPct);
    // SVG circle: r=44, circumference ≈ 276.5
    const circum = 276.5;
    const dash   = (dashVal / 100) * circum;

    // ── Overall hero card ──────────────────────────────────────────────────
    const heroHtml = `
        <div class="att-hero glass-panel" style="
            border-radius:2rem;
            padding:1.5rem 1.25rem;
            background:linear-gradient(135deg,
                color-mix(in srgb,${overallColor} 12%,transparent),
                color-mix(in srgb,${overallColor} 4%,transparent));
            border:1px solid color-mix(in srgb,${overallColor} 25%,transparent);
            display:flex;flex-direction:column;gap:1rem;">

            <!-- Top row: ring + info -->
            <div style="display:flex;align-items:center;gap:1.5rem;">
                <!-- SVG ring -->
                <div style="position:relative;flex-shrink:0;width:96px;height:96px;">
                    <svg width="96" height="96" viewBox="0 0 96 96" style="transform:rotate(-90deg);">
                        <circle cx="48" cy="48" r="44" fill="none"
                            stroke="rgba(128,128,128,.12)" stroke-width="8"/>
                        <circle cx="48" cy="48" r="44" fill="none"
                            stroke="${overallColor}" stroke-width="8"
                            stroke-linecap="round"
                            stroke-dasharray="${dash.toFixed(1)} ${circum.toFixed(1)}"
                            style="transition:stroke-dasharray .8s cubic-bezier(.4,0,.2,1)"/>
                    </svg>
                    <div style="position:absolute;inset:0;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:0;">
                        <span style="font-size:1.35rem;font-weight:900;color:${overallColor};line-height:1;">${overallPct.toFixed(1)}%</span>
                        <span style="font-size:.55rem;font-weight:700;color:#86868b;text-transform:uppercase;letter-spacing:.08em;">Overall</span>
                    </div>
                </div>

                <!-- Stats column -->
                <div style="flex:1;min-width:0;">
                    <p style="font-size:.6rem;font-weight:800;color:#86868b;text-transform:uppercase;letter-spacing:.12em;margin:0 0 .3rem;">Attendance Summary</p>
                    <h3 style="font-size:1.2rem;font-weight:900;color:var(--mac-fg,#1d1d1f);margin:0 0 .6rem;line-height:1.1;">${totalPresent.toFixed(0)} / ${totalHours.toFixed(0)} Hrs</h3>
                    <div style="display:flex;gap:.4rem;flex-wrap:wrap;">
                        <span style="font-size:.6rem;font-weight:800;padding:.25rem .6rem;border-radius:999px;background:rgba(48,209,88,.12);color:#30d158;">✓ ${safeSubjects.length} Safe</span>
                        ${warnSubjects.length ? `<span style="font-size:.6rem;font-weight:800;padding:.25rem .6rem;border-radius:999px;background:rgba(255,159,10,.12);color:#ff9f0a;">⚠ ${warnSubjects.length} Low</span>` : ''}
                        ${lowSubjects.length  ? `<span style="font-size:.6rem;font-weight:800;padding:.25rem .6rem;border-radius:999px;background:rgba(255,69,58,.12);color:#ff453a;">✗ ${lowSubjects.length} Critical</span>` : ''}
                    </div>
                </div>
            </div>

            <!-- 75% target bar -->
            <div>
                <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:.4rem;">
                    <span style="font-size:.6rem;font-weight:700;color:#86868b;text-transform:uppercase;letter-spacing:.1em;">Progress to 75% Target</span>
                    <span style="font-size:.7rem;font-weight:900;color:${overallColor};">${overallPct.toFixed(1)}%</span>
                </div>
                <div style="height:6px;border-radius:999px;background:rgba(128,128,128,.12);overflow:hidden;">
                    <div style="height:100%;border-radius:999px;background:${barBg(overallPct)};width:${Math.min(100,(overallPct/75)*100).toFixed(1)}%;transition:width .8s cubic-bezier(.4,0,.2,1);"></div>
                </div>
                <div style="display:flex;justify-content:flex-end;margin-top:.3rem;">
                    <span style="font-size:.55rem;font-weight:700;color:#86868b;">Minimum: 75%</span>
                </div>
            </div>
        </div>`;

    // ── Subject cards ──────────────────────────────────────────────────────
    const subjectCards = subjects.map((s, idx) => {
        const pct    = s.pct;
        const color  = pctColor(pct);
        const badge  = calcBadge(s.present, s.total, pct);
        const barPct = Math.min(100, pct);
        const shortName = s.name.length > 36 ? s.name.slice(0, 34) + '…' : s.name;

        return `
            <div class="att-subject-card glass-panel" style="
                border-radius:1.75rem;
                padding:1.1rem 1.25rem;
                border:1px solid rgba(128,128,128,.1);
                position:relative;
                overflow:hidden;
                transition:transform .2s ease,box-shadow .2s ease;"
                onmouseenter="this.style.transform='translateY(-2px)';this.style.boxShadow='0 8px 32px rgba(0,0,0,.1)'"
                onmouseleave="this.style.transform='translateY(0)';this.style.boxShadow='none'">

                <!-- Left accent bar -->
                <div style="position:absolute;left:0;top:0;bottom:0;width:4px;background:${color};border-radius:4px 0 0 4px;"></div>

                <!-- Subject index badge -->
                <div style="position:absolute;top:.9rem;right:1rem;">
                    <span style="font-size:1.1rem;font-weight:900;color:${color};opacity:.18;">${String(idx+1).padStart(2,'0')}</span>
                </div>

                <div style="padding-left:.5rem;">
                    <!-- Subject name -->
                    <p style="font-size:.58rem;font-weight:700;color:#86868b;text-transform:uppercase;letter-spacing:.1em;margin:0 0 .2rem;">Subject</p>
                    <h4 style="font-size:.9rem;font-weight:800;color:var(--mac-fg,#1d1d1f);margin:0 0 .75rem;line-height:1.3;padding-right:2rem;">${shortName}</h4>

                    <!-- Hours row -->
                    <div style="display:flex;align-items:center;gap:1rem;margin-bottom:.75rem;flex-wrap:wrap;">
                        <div>
                            <p style="font-size:.52rem;font-weight:700;color:#86868b;text-transform:uppercase;letter-spacing:.08em;margin:0;">Present</p>
                            <p style="font-size:1rem;font-weight:900;color:${color};margin:0;">${s.present.toFixed(0)}<span style="font-size:.6rem;font-weight:600;color:#86868b;"> hrs</span></p>
                        </div>
                        <div style="width:1px;height:2rem;background:rgba(128,128,128,.15);"></div>
                        <div>
                            <p style="font-size:.52rem;font-weight:700;color:#86868b;text-transform:uppercase;letter-spacing:.08em;margin:0;">Total</p>
                            <p style="font-size:1rem;font-weight:900;color:var(--mac-fg,#1d1d1f);margin:0;">${s.total.toFixed(0)}<span style="font-size:.6rem;font-weight:600;color:#86868b;"> hrs</span></p>
                        </div>
                        <div style="width:1px;height:2rem;background:rgba(128,128,128,.15);"></div>
                        <div>
                            <p style="font-size:.52rem;font-weight:700;color:#86868b;text-transform:uppercase;letter-spacing:.08em;margin:0;">Attendance</p>
                            <p style="font-size:1rem;font-weight:900;color:${color};margin:0;">${pct.toFixed(1)}%</p>
                        </div>
                    </div>

                    <!-- Progress bar -->
                    <div style="margin-bottom:.6rem;">
                        <div style="height:5px;border-radius:999px;background:rgba(128,128,128,.12);overflow:hidden;">
                            <div style="height:100%;border-radius:999px;background:${barBg(pct)};width:${barPct.toFixed(1)}%;transition:width .9s cubic-bezier(.4,0,.2,1) ${idx * 0.05}s;"></div>
                        </div>
                    </div>

                    <!-- Badge row -->
                    ${badge ? `<div style="margin-top:.4rem;">${badge}</div>` : ''}
                </div>
            </div>`;
    }).join('');

    // ── Inline styles for badges ───────────────────────────────────────────
    const styleBlock = `
        <style id="att-styles">
            .att-badge{display:inline-block;font-size:.58rem;font-weight:800;padding:.25rem .65rem;border-radius:999px;text-transform:uppercase;letter-spacing:.08em;}
            .att-badge--safe{background:rgba(48,209,88,.12);color:#30d158;}
            .att-badge--ok{background:rgba(0,122,255,.10);color:var(--mac-blue,#007aff);}
            .att-badge--warn{background:rgba(255,69,58,.12);color:#ff453a;}
        </style>`;

    container.innerHTML = styleBlock + heroHtml + `<div style="display:flex;flex-direction:column;gap:.85rem;margin-top:1rem;">` + subjectCards + `</div>`;
};

window.initExamHubApp = () => {
    checkOnboarding();
    
    // Sync class department with student info
    const student = getStudentInfo();
    if (student && student.dept) {
        currentClassDept = student.dept.toUpperCase();
    }
    
    // Initialize Class Hub
    renderClassFilters();
    renderClassDaySelector();
    renderClassTimetable();
    renderClassSubjects();
    renderClassAttendance();

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
        if (appState.openClassDropdown) {
            closeClassDropdowns();
            renderClassFilters();
            renderClassDaySelector();
        }
    }
});
