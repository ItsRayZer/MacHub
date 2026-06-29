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
let timetableDisplayMode = 'today';
let currentClassDay = (function() {
    const DAYS_OF_WEEK = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
    const now = new Date();
    const currentDayName = DAYS_OF_WEEK[now.getDay()];
    const isWeekend = [0, 6].includes(now.getDay());
    const totalSecsToday = now.getHours() * 3600 + now.getMinutes() * 60 + now.getSeconds();
    
    if (isWeekend || totalSecsToday >= 15.5 * 3600) {
        timetableDisplayMode = 'next';
        let nextSchoolDayName = "Monday";
        if (now.getDay() === 5 || now.getDay() === 6 || now.getDay() === 0) {
            nextSchoolDayName = "Monday";
        } else {
            nextSchoolDayName = DAYS_OF_WEEK[now.getDay() + 1];
        }
        return nextSchoolDayName;
    }
    return ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday"].includes(currentDayName) ? currentDayName : "Monday";
})();
let currentClassDept = 'BCA';

function getStudentInfo() {
    if (window.ExamHubProfileApi) {
        const info = window.ExamHubProfileApi.getStudentInfo();
        if (info) {
            info.dept = info.dept || info.department || info.course || '';
            info.adminNo = info.adminNo || info.admissionNo || info.admissionNumber || '';
        }
        return info;
    }
    try {
        const info = JSON.parse(localStorage.getItem('mac_student_info'));
        if (info) {
            info.dept = info.dept || info.department || info.course || '';
            info.adminNo = info.adminNo || info.admissionNo || info.admissionNumber || '';
        }
        return info;
    } catch (error) {
        return null;
    }
}

// How long before cached data is considered stale and a background refresh is triggered (4 hours)
const PORTAL_CACHE_STALE_MS = 4 * 60 * 60 * 1000;

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
                    // Match by text-based number first (e.g. "Semester 4" → "4"), then raw value
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

/**
 * Returns true if the cached data for the given section is older than PORTAL_CACHE_STALE_MS.
 * Also returns true when there is no cached data at all.
 */
function isPortalCacheStale(section, adminNo, semester = '') {
    const raw = getPortalCache(section, adminNo, semester);
    if (!raw) return true;
    try {
        const parsed = JSON.parse(raw);
        const savedAt = parsed?.savedAt || 0;
        if (!savedAt) return true;
        return (Date.now() - savedAt) > PORTAL_CACHE_STALE_MS;
    } catch (e) { return true; }
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
        if (typeof window.tickClassTimetable === 'function') {
            window.tickClassTimetable();
        }
    }, 1000);
}

// We make ALL_DEPARTMENTS let so we can overwrite it when switching days
let ALL_DEPARTMENTS = [];
let RAW_DATA = [];
let HALL_DATA = {};
let HALL_KEYS = [];

function getMainNavView(viewId) {
    if (viewId === 'view-ai') return 'view-ai';
    if (['view-timetable', 'view-seats', 'view-exam-resources', 'view-class'].includes(viewId)) return 'view-exam';
    if (viewId === 'view-resources') return 'view-resources';
    if (viewId === 'view-profile' || viewId === 'view-profile-edit' || viewId === 'view-settings' || (viewId && viewId.startsWith('view-settings-'))) return 'view-profile';
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
window.switchExamView = switchExamView;

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
};

function switchView(viewId) {
    // Save current view state before normalization
    if (viewId) {
        localStorage.setItem('machub_current_view', viewId);
        if (['view-class', 'view-seats', 'view-timetable', 'view-results', 'view-exam-resources'].includes(viewId)) {
            appState.examSubView = viewId;
            localStorage.setItem('machub_exam_sub_view', viewId);
        }
    }

    // Clear navigation hidden state locks when entering level-0 main tabs
    if (['view-home', 'view-class', 'view-seats', 'view-resources', 'view-profile'].includes(viewId)) {
        _navLockedHidden = false;
        _navHidden = false;
        const nav = document.getElementById('bottomNav');
        if (nav) nav.classList.remove('nav-hidden');
    }

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
    const currentViewId = appState.view;

    const getViewDepth = (id) => {
        if (!id) return 0;
        if (id === 'view-home' || id === 'view-class' || id === 'view-seats' || id === 'view-resources' || id === 'view-profile') {
            return 0; // Main Tabs
        }
        if (id === 'view-announcements' || id === 'view-settings' || id === 'view-profile-edit' || id === 'view-departments' || id === 'view-exam-resources' || id === 'view-ai') {
            return 1; // Primary Child Pages
        }
        if (id.startsWith('view-settings-')) {
            return 2; // Secondary Child Pages
        }
        return 1;
    };

    const currentDepth = getViewDepth(currentViewId);
    const targetDepth = getViewDepth(viewId);

    const fromPanel = document.getElementById(currentViewId);
    const toPanel = document.getElementById(viewId);

    const performUpdate = () => {
        appState.view = viewId;
        
        // Scroll to top of page when changing view
        window.scrollTo(0, 0);

        document.querySelectorAll('.view-panel').forEach(el => {
            el.classList.remove('is-active', 'page-from', 'page-to', 'page-slide-in-right', 'page-slide-out-left', 'page-slide-in-left', 'page-slide-out-right', 'page-fade-in');
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

        if (viewId === 'view-home') {
            updateCountdown();
        }
        if (viewId === 'view-profile' && typeof renderUserProfile === 'function') renderUserProfile();
        syncExternalAppView();

        // Update Nav Bar active & Indicator movement
        const tabs = ['view-home', 'view-exam', 'view-resources', 'view-profile'];
        const navPill = document.getElementById('navPill');
        const activeMainView = (viewId === 'view-seats' || viewId === 'view-results' || viewId === 'view-exam-resources') ? 'view-exam' : getMainNavView(viewId);
        const nextIndex = tabs.indexOf(activeMainView);

        if (navPill) {
            if (nextIndex !== -1) {
                const currentOption = navPill.getAttribute('c-current') || '1';
                const nextOption = String(nextIndex + 1);
                navPill.setAttribute('c-previous', currentOption);
                navPill.setAttribute('c-current', nextOption);
            } else {
                const currentOption = navPill.getAttribute('c-current') || '1';
                navPill.setAttribute('c-previous', currentOption);
                navPill.setAttribute('c-current', '0');
            }
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

        // Automatically manage bottom nav bar visibility - always show by default
        const bottomNav = document.getElementById('bottomNav');
        const input = document.getElementById('navAiInput');
        const btn = document.getElementById('macAiFloatingBtn');
        if (bottomNav) {
            bottomNav.classList.remove('nav-scrolled-down');
            const isAiPage = (viewId === 'view-ai');
            if (isAiPage) {
                if (!bottomNav.classList.contains('ai-active')) {
                    bottomNav.classList.add('ai-active');
                }
            } else {
                if (bottomNav.classList.contains('ai-active')) {
                    bottomNav.classList.remove('ai-active');
                    if (input) input.value = '';
                    if (btn) btn.classList.remove('send-mode');
                }
            }
        }
    };

    // Perform instant view update with a quick elegant fade to keep navigation stay still and smooth
    try {
        performUpdate();
    } catch (e) {
        console.error('[switchView] Error during instant view update:', e);
    }
    if (toPanel) {
        toPanel.classList.add('page-fade-in');
    }
}

window.switchView = switchView;
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
                const payload = parsed?.data?.payload || parsed?.data || parsed?.payload || parsed;
                const rows = payload?.sections?.[0]?.rows || payload?.rows || [];
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
                const payload = parsed?.data?.payload || parsed?.data || parsed?.payload || parsed;
                const rows = payload?.sections?.[0]?.rows || payload?.rows || [];
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

    const adminNoVal = (document.getElementById('ob-adminNo')?.value || "").trim();
    obData.adminNo = adminNoVal;

    const btn = document.getElementById('ob-final-btn');
    if (obData.adminNo.length > 2) {
        if (btn) {
            btn.classList.remove('opacity-30', 'pointer-events-none');
            btn.classList.add('spring');
        }
    } else {
        if (btn) {
            btn.classList.add('opacity-30', 'pointer-events-none');
            btn.classList.remove('spring');
        }
    }
}

async function fetchAndFinishOnboarding() {
    obData = window.obData || obData || { name: '', dept: '', reg: '', adminNo: '' };
    const adminNo = (document.getElementById('ob-adminNo')?.value || "").trim();
    if (!adminNo) return;
    
    const btn = document.getElementById('ob-final-btn');
    const originalText = btn.innerHTML;
    btn.innerHTML = `Scraping Portal...`;
    btn.classList.add('opacity-50', 'pointer-events-none');

    const CF_WORKER_URL = 'https://machub-proxy.mrabensojan.workers.dev';
    
    try {
        let profilePayload = null;
        let scrapeSuccessful = false;

        // Try Worker profile scrape directly using adminNo as password
        try {
            const scrapeRes = await fetch(`${CF_WORKER_URL}/api/scrape/profile`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    admissionNumber: adminNo,
                    password: adminNo
                })
            });
            const scrapeData = await scrapeRes.json();
            if (scrapeRes.ok && scrapeData.success) {
                profilePayload = scrapeData.data?.payload || scrapeData.data || scrapeData;
                scrapeSuccessful = true;
            }
        } catch (scrapeErr) {
            console.warn('Direct worker scrape failed, trying Cloud Function:', scrapeErr.message);
        }

        // If direct scrape failed, try Cloud Function
        if (!scrapeSuccessful) {
            try {
                let responseData;
                if (window.firebaseFunctions) {
                    const onDemandScrapeFunc = window.firebaseFunctions.httpsCallable('onDemandScrape');
                    const result = await onDemandScrapeFunc({
                        admissionNumber: adminNo,
                        target: 'profile',
                        customPassword: adminNo
                    });
                    responseData = result.data;
                } else {
                    const res = await fetch(`https://asia-south1-machub-6af39.cloudfunctions.net/onDemandScrape`, {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({ data: { admissionNumber: adminNo, target: 'profile', customPassword: adminNo } })
                    });
                    const json = await res.json();
                    if (res.ok) responseData = json.result;
                }

                if (responseData && responseData.success) {
                    profilePayload = responseData.data?.payload || responseData.data || responseData;
                    scrapeSuccessful = true;
                }
            } catch (fnErr) {
                console.error('Cloud Function scrape failed:', fnErr.message);
            }
        }

        if (!scrapeSuccessful || !profilePayload) {
            throw new Error("Failed to verify portal credentials. Please check your Admission Number.");
        }

        // Extract student details from scraped profile payload (handles nested sections[0].data format)
        const profileData = profilePayload?.sections?.[0]?.data || profilePayload?.data || profilePayload || {};
        const name = profileData.name || profileData.studentName || profilePayload.name || "Student";
        let rawDept = profileData.course || profileData.department || profilePayload.course || "BCA";
        if (rawDept === '(' || !rawDept || rawDept.length < 2) rawDept = "BCA";
        const reg = profileData.regNo || profileData.prn || profileData.registerNo || profilePayload.regNo || "";
        const batchVal = profileData.batch || profilePayload.batch || "";

        // Helper to normalize department name to standard BBA/BCA/BSW/etc.
        const normalizeDept = (course) => {
            const c = String(course || '').toUpperCase();
            if (c.includes('COMPUTER APPLICATIONS') || c.includes('BCA')) return 'BCA';
            if (c.includes('BUSINESS ADMINISTRATION') || c.includes('BBA')) return 'BBA';
            if (c.includes('COMMERCE') || c.includes('B.COM')) return 'B.Com';
            if (c.includes('SOCIAL WORK') || c.includes('BSW')) return 'BSW';
            if (c.includes('ENGLISH') || c.includes('BA ENGLISH')) return 'BA English';
            return course || 'BCA';
        };

        // Helper to calculate semester and batch year dynamically from start year (e.g. 2024)
        const calculateSemesterFromBatch = (batchStr) => {
            const match = String(batchStr || '').match(/(\d{4})/);
            const startYear = match ? parseInt(match[1], 10) : 2024;
            const currentDate = new Date();
            const currentYear = currentDate.getFullYear();
            const currentMonth = currentDate.getMonth() + 1; // 1-indexed

            let elapsedYears = currentYear - startYear;
            if (currentMonth < 6) {
                elapsedYears -= 1;
            }
            if (elapsedYears < 0) elapsedYears = 0;

            let semesterNum = 1;
            if (elapsedYears === 0) {
                semesterNum = (currentMonth >= 6 && currentMonth < 11) ? 1 : 2;
            } else if (elapsedYears === 1) {
                semesterNum = (currentMonth >= 6 && currentMonth < 11) ? 3 : 4;
            } else if (elapsedYears === 2) {
                semesterNum = (currentMonth >= 6 && currentMonth < 11) ? 5 : 6;
            } else {
                semesterNum = 6;
            }

            const yearNum = Math.ceil(semesterNum / 2);
            return {
                semester: `Sem ${semesterNum}`,
                year: yearNum,
                startYear
            };
        };

        const dept = normalizeDept(rawDept);
        const batchInfo = calculateSemesterFromBatch(batchVal);

        obData.name = name;
        obData.dept = dept;
        obData.reg = reg;
        obData.adminNo = adminNo;
        window.obData = obData;

        // Authenticate with Firebase first to grant Firestore write permission
        if (window.authenticateFirebase) {
            await window.authenticateFirebase(adminNo);
        }

        // Auto-create/update student doc in Firestore via the secure Cloudflare Worker endpoint
        try {
            const newStudent = {
                name: name.toUpperCase(),
                regNo: reg.toUpperCase(),
                adminNo: adminNo,
                classNo: '',
                department: dept,
                classGroup: dept,
                semester: batchInfo.semester,
                batch: batchVal || `${batchInfo.startYear} - ${batchInfo.startYear + 3}`,
                batchYear: batchInfo.year,
                status: 'active',
                credentialStatus: 'valid',
                createdAt: new Date().toISOString(),
                updatedAt: new Date().toISOString(),
                security: {
                    isProfileClaimed: false,
                    deviceTokens: []
                }
            };

            await fetch(`${CF_WORKER_URL}/api/auth/update-student`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    admissionNumber: adminNo,
                    fields: newStudent
                })
            });

            // Expose to smart finder preloaded DB search
            if (window.STUDENTS_DB) {
                window.STUDENTS_DB.push({
                    name: name.toUpperCase(),
                    regNo: reg.toUpperCase(),
                    adminNo: adminNo,
                    classNo: '',
                    department: dept,
                    classGroup: dept,
                    semester: batchInfo.semester
                });
            }
        } catch (dbErr) {
            console.warn('Failed to auto-create student in Firestore via Worker:', dbErr.message);
        }

        // Save scraped profile cache locally so it loads instantly
        const cacheKey = `machub_portal_Profile_${adminNo}`;
        localStorage.setItem(cacheKey, JSON.stringify({
            data: { success: true, payload: profilePayload },
            savedAt: Date.now()
        }));

        // Proceed to confirm steps
        window._selectedStudentFromDB = {
            name: name.toUpperCase(),
            regNo: reg.toUpperCase(),
            adminNo: adminNo,
            classNo: '',
            department: dept,
            classGroup: dept,
            semester: batchInfo.semester
        };

        nextObStep(3);

    } catch (err) {
        console.error("Onboarding setup failed:", err);
        alert(err.message || "Failed to setup profile. Please try again.");
    } finally {
        btn.innerHTML = originalText;
        btn.classList.remove('opacity-50', 'pointer-events-none');
    }
}

window.fetchAndFinishOnboarding = fetchAndFinishOnboarding;

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
    localStorage.setItem('machub_current_view', 'view-home');
    switchView('view-home');
    if (typeof showBottomNav === 'function') showBottomNav();
}

window.nextObStep = nextObStep;
window.selectObDept = selectObDept;
window.validateObStep2 = validateObStep2;
window.finishOnboarding = finishOnboarding;
window.applyUserProfile = applyUserProfile;

async function applyUserProfile() {
    const info = getStudentInfo();
    if (!info) return;

    const greetingEl = document.getElementById('homeGreeting');
    const initialsEl = document.getElementById('homeProfileInitials');
    const deptEl = document.getElementById('homeUserDept');
    const semEl = document.getElementById('homeUserSem');
    const subEl = document.getElementById('homeProfileSub');

    if (greetingEl) {
        const firstName = info.name && info.name !== 'Guest' ? info.name.split(' ')[0] : 'Hello!';
        greetingEl.textContent = firstName;
    }
    if (initialsEl) {
        const initials = info.name && info.name !== 'Guest' ? info.name.substring(0, 2).toUpperCase() : 'MAC';
        initialsEl.textContent = initials;
    }
    if (deptEl) {
        deptEl.textContent = info.dept || 'COURSE';
    }
    if (semEl) {
        const rawSem = info.semester || '';
        const semNum = rawSem.match(/\d+/) ? rawSem.match(/\d+/)[0] : '';
        semEl.textContent = semNum ? `SEM ${semNum}` : `SEM -`;
    }
    if (subEl) {
        subEl.textContent = info.adminNo || 'VIEW PROFILE';
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

    if (window.syncBottomNavAvatar) {
        window.syncBottomNavAvatar();
    }

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
}

function checkOnboarding() {
    const saved = getStudentInfo();
    const obScreen = document.getElementById('onboardingScreen');

    if (!saved) {
        if (obScreen) obScreen.classList.remove('hidden');
        if (typeof hideBottomNav === 'function') hideBottomNav();
    } else {
        if (obScreen) obScreen.classList.add('hidden', 'collapsed');
        applyUserProfile();
        if (typeof showBottomNav === 'function') showBottomNav();
    }
}



let _editDept = '';

function legacyOpenEditProfile() {
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

function legacyCloseEditProfile() {
    const sheet = document.getElementById('editProfileSheet');
    if (sheet) sheet.classList.add('hidden');
}

function legacySelectEditDept(dept) {
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

function legacySaveEditProfile() {
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

    legacyCloseEditProfile();

    if (window.startBackgroundSync) {
        window.startBackgroundSync();
    }
}
window.openEditProfileModal = legacyOpenEditProfile;
window.saveEditProfileModal = legacySaveEditProfile;
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
    const portalNavDrawer = document.getElementById('portalNavDrawer');
    const drawerOpen = drawer && drawer.style.transform !== 'translateY(100%)' && drawer.style.transform !== '';
    const marksOpen = marksSheet && marksSheet.style.transform !== 'translateY(100%)' && marksSheet.style.transform !== '';
    const timetableOpen = timetableExamSheet && timetableExamSheet.style.transform !== 'translateY(100%)' && timetableExamSheet.style.transform !== '';
    const academicOpen = academicSheet && academicSheet.style.transform !== 'translateY(100%)' && academicSheet.style.transform !== '';
    const portalDrawerOpen = portalNavDrawer && portalNavDrawer.style.transform !== 'translateY(100%)' && portalNavDrawer.style.transform !== '';
    if (drawerOpen || marksOpen || timetableOpen || academicOpen || portalDrawerOpen) return;
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
    let _lastScrollY = window.scrollY || 0;
    let _scrollTicking = false;

    if (typeof window.addEventListener === 'function') {
        window.addEventListener('scroll', () => {
            if (_scrollTicking) return;
            _scrollTicking = true;
            requestAnimationFrame(() => {
                const currentY = window.scrollY || 0;
                const isAiPage = document.getElementById('view-ai')?.classList.contains('is-active');
                
                if (!isAiPage) {
                    const delta = currentY - _lastScrollY;
                    const bottomNav = document.getElementById('bottomNav');
                    
                    if (bottomNav) {
                        if (delta > 8 && currentY > 50) {
                            bottomNav.classList.add('nav-scrolled-down');
                        } else if (delta < -8 || currentY <= 20) {
                            bottomNav.classList.remove('nav-scrolled-down');
                        }
                    }
                }

                _lastScrollY = currentY <= 0 ? 0 : currentY;
                _scrollTicking = false;
            });
        }, { passive: true });
    }
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
    localStorage.setItem('machub_class_sub_tab', tab);

    if (tab === 'attendance') {
        renderClassAttendance();
    }
};

function getDayNames() {
    const DAYS_OF_WEEK = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
    const today = new Date();
    const todayName = DAYS_OF_WEEK[today.getDay()];
    
    let nextSchoolDayName = "Monday";
    if (today.getDay() === 5) { // Friday -> Monday
        nextSchoolDayName = "Monday";
    } else if (today.getDay() === 6) { // Saturday -> Monday
        nextSchoolDayName = "Monday";
    } else if (today.getDay() === 0) { // Sunday -> Monday
        nextSchoolDayName = "Monday";
    } else {
        nextSchoolDayName = DAYS_OF_WEEK[today.getDay() + 1];
    }
    return { todayName, nextSchoolDayName, dayOfWeek: today.getDay() };
}

function formatTimeRemaining(secs) {
    if (secs <= 0) return '0s';
    const days = Math.floor(secs / (24 * 3600));
    let rem = secs % (24 * 3600);
    const hours = Math.floor(rem / 3600);
    rem %= 3600;
    const mins = Math.floor(rem / 60);
    const seconds = Math.floor(rem % 60);
    
    let parts = [];
    if (days > 0) parts.push(`${days}d`);
    if (hours > 0 || days > 0) parts.push(`${hours}h`);
    if (mins > 0 || hours > 0 || days > 0) parts.push(`${mins}m`);
    parts.push(`${seconds}s`);
    return parts.join(' ');
}

window.getCurrentScheduleState = function(now = new Date()) {
    const { todayName, nextSchoolDayName, dayOfWeek } = getDayNames();
    const dept = currentClassDept.toUpperCase();
    const ttKey = `CLASS_TIMETABLE_${dept}`;
    const todayTimetable = window[ttKey]?.[todayName] || [];
    const nextTimetable = window[ttKey]?.[nextSchoolDayName] || [];
    
    const isWeekend = [0, 6].includes(dayOfWeek);
    const hour = now.getHours();
    const min = now.getMinutes();
    const sec = now.getSeconds();
    const totalSecsToday = (hour * 3600) + (min * 60) + sec;
    
    const P1_START = 9 * 3600 + 30 * 60; // 09:30 AM
    const P1_END = 10 * 3600 + 30 * 60;   // 10:30 AM
    const P2_END = 11 * 3600 + 30 * 60;   // 11:30 AM
    const P3_END = 12 * 3600 + 30 * 60;   // 12:30 PM
    const LUNCH_END = 13 * 3600 + 30 * 60; // 01:30 PM
    const P4_END = 14 * 3600 + 30 * 60;   // 02:30 PM
    const P5_END = 15 * 3600 + 30 * 60;   // 03:30 PM
    
    let state = {
        status: 'weekend',
        periodIndex: -1,
        currentTitle: 'Weekend Mode',
        currentSubtitle: 'School is closed',
        currentRoom: 'Closed',
        currentCode: '',
        nextTitle: '',
        nextSubtitle: '',
        remainingSecs: 0,
        elapsedSecs: 0,
        totalSecs: 0,
        progressPct: 0,
        timerLabel: 'MONDAY CLASSES START IN'
    };
    
    if (isWeekend) {
        state.status = 'weekend';
        let daysToMonday = (dayOfWeek === 6) ? 2 : 1;
        const secsToMidnight = (24 * 3600) - totalSecsToday;
        state.remainingSecs = secsToMidnight + ((daysToMonday - 1) * 24 * 3600) + P1_START;
        
        const firstPeriod = nextTimetable[0];
        state.nextTitle = firstPeriod ? firstPeriod.title : 'No Class';
        state.nextSubtitle = firstPeriod ? `Period 1 • ${firstPeriod.time}` : '09:30 AM';
        return state;
    }
    
    if (totalSecsToday < P1_START) {
        state.status = 'before_school';
        state.currentTitle = 'Before College';
        state.currentSubtitle = 'Morning Prep';
        state.currentRoom = 'Lobby';
        state.remainingSecs = P1_START - totalSecsToday;
        state.timerLabel = 'FIRST BELL RINGS IN';
        
        const firstPeriod = todayTimetable[0];
        state.nextTitle = firstPeriod ? firstPeriod.title : 'No Class';
        state.nextSubtitle = firstPeriod ? `Period 1 • ${firstPeriod.time}` : '09:30 AM';
    } else if (totalSecsToday >= P1_START && totalSecsToday < P1_END) {
        state.status = 'period1';
        state.periodIndex = 0;
        const p = todayTimetable[0];
        state.currentTitle = p ? p.title : 'Free Period';
        state.currentSubtitle = 'Period 1 • 09:30 AM - 10:30 AM';
        state.currentRoom = p ? p.room : '---';
        state.currentCode = p ? p.code : '';
        state.remainingSecs = P1_END - totalSecsToday;
        state.elapsedSecs = totalSecsToday - P1_START;
        state.totalSecs = 3600;
        state.timerLabel = 'BELL RINGS IN';
        
        const nextP = todayTimetable[1];
        state.nextTitle = nextP ? nextP.title : 'Free Period';
        state.nextSubtitle = nextP ? `Period 2 • ${nextP.time}` : '10:30 AM';
    } else if (totalSecsToday >= P1_END && totalSecsToday < P2_END) {
        state.status = 'period2';
        state.periodIndex = 1;
        const p = todayTimetable[1];
        state.currentTitle = p ? p.title : 'Free Period';
        state.currentSubtitle = 'Period 2 • 10:30 AM - 11:30 AM';
        state.currentRoom = p ? p.room : '---';
        state.currentCode = p ? p.code : '';
        state.remainingSecs = P2_END - totalSecsToday;
        state.elapsedSecs = totalSecsToday - P1_END;
        state.totalSecs = 3600;
        state.timerLabel = 'BELL RINGS IN';
        
        const nextP = todayTimetable[2];
        state.nextTitle = nextP ? nextP.title : 'Free Period';
        state.nextSubtitle = nextP ? `Period 3 • ${nextP.time}` : '11:30 AM';
    } else if (totalSecsToday >= P2_END && totalSecsToday < P3_END) {
        state.status = 'period3';
        state.periodIndex = 2;
        const p = todayTimetable[2];
        state.currentTitle = p ? p.title : 'Free Period';
        state.currentSubtitle = 'Period 3 • 11:30 AM - 12:30 PM';
        state.currentRoom = p ? p.room : '---';
        state.currentCode = p ? p.code : '';
        state.remainingSecs = P3_END - totalSecsToday;
        state.elapsedSecs = totalSecsToday - P2_END;
        state.totalSecs = 3600;
        state.timerLabel = 'BELL RINGS IN';
        
        state.nextTitle = 'Lunch Break';
        state.nextSubtitle = 'Interval • 12:30 PM - 01:30 PM';
    } else if (totalSecsToday >= P3_END && totalSecsToday < LUNCH_END) {
        state.status = 'lunch_break';
        state.currentTitle = 'Lunch Break';
        state.currentSubtitle = 'Interval';
        state.currentRoom = 'Canteen';
        state.remainingSecs = LUNCH_END - totalSecsToday;
        state.elapsedSecs = totalSecsToday - P3_END;
        state.totalSecs = 3600;
        state.timerLabel = 'INTERVAL ENDS IN';
        
        const nextP = todayTimetable[3];
        state.nextTitle = nextP ? nextP.title : 'Free Period';
        state.nextSubtitle = nextP ? `Period 4 • ${nextP.time}` : '01:30 PM';
    } else if (totalSecsToday >= LUNCH_END && totalSecsToday < P4_END) {
        state.status = 'period4';
        state.periodIndex = 3;
        const p = todayTimetable[3];
        state.currentTitle = p ? p.title : 'Free Period';
        state.currentSubtitle = 'Period 4 • 01:30 PM - 02:30 PM';
        state.currentRoom = p ? p.room : '---';
        state.currentCode = p ? p.code : '';
        state.remainingSecs = P4_END - totalSecsToday;
        state.elapsedSecs = totalSecsToday - LUNCH_END;
        state.totalSecs = 3600;
        state.timerLabel = 'BELL RINGS IN';
        
        const nextP = todayTimetable[4];
        state.nextTitle = nextP ? nextP.title : 'Free Period';
        state.nextSubtitle = nextP ? `Period 5 • ${nextP.time}` : '02:30 PM';
    } else if (totalSecsToday >= P4_END && totalSecsToday < P5_END) {
        state.status = 'period5';
        state.periodIndex = 4;
        const p = todayTimetable[4];
        state.currentTitle = p ? p.title : 'Free Period';
        state.currentSubtitle = 'Period 5 • 02:30 PM - 03:30 PM';
        state.currentRoom = p ? p.room : '---';
        state.currentCode = p ? p.code : '';
        state.remainingSecs = P5_END - totalSecsToday;
        state.elapsedSecs = totalSecsToday - P4_END;
        state.totalSecs = 3600;
        state.timerLabel = 'FINAL BELL RINGS IN';
        
        state.nextTitle = 'School Closed';
        state.nextSubtitle = 'Classes complete for today';
    } else {
        state.status = 'after_school';
        state.currentTitle = 'Classes Finished';
        state.currentSubtitle = 'All periods completed for today';
        state.currentRoom = 'Closed';
        state.timerLabel = 'NEXT SCHOOL DAY STARTS IN';
        
        let daysToNext = (dayOfWeek === 5) ? 3 : 1;
        const secsToMidnight = (24 * 3600) - totalSecsToday;
        state.remainingSecs = secsToMidnight + ((daysToNext - 1) * 24 * 3600) + P1_START;
        
        const firstPeriod = nextTimetable[0];
        state.nextTitle = firstPeriod ? firstPeriod.title : 'No Class';
        state.nextSubtitle = firstPeriod ? `Period 1 • ${firstPeriod.time}` : '09:30 AM';
    }
    
    if (state.totalSecs > 0) {
        state.progressPct = Math.min(100, (state.elapsedSecs / state.totalSecs) * 100);
    }
    
    return state;
};

window.setTimetableDisplayMode = function(mode) {
    timetableDisplayMode = mode;
    localStorage.setItem('machub_timetable_user_toggled', 'true');
    const { todayName, nextSchoolDayName } = getDayNames();
    const isWeekend = [0, 6].includes(new Date().getDay());
    
    if (mode === 'today') {
        currentClassDay = isWeekend ? "Monday" : todayName;
    } else {
        currentClassDay = nextSchoolDayName;
    }
    
    renderClassFilters();
    renderClassDaySelector();
    renderClassTimetable();
};

window.tickClassTimetable = function() {
    const clockEl = document.getElementById('timetable-live-clock');
    if (!clockEl) return;
    
    const now = new Date();
    clockEl.textContent = now.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: true }) + ' IST';
    
    const scheduleState = getCurrentScheduleState(now);
    
    const statusEl = document.getElementById('timetable-live-status');
    if (statusEl) {
        statusEl.textContent = scheduleState.status === 'weekend' ? 'WEEKEND' : scheduleState.status === 'lunch_break' ? 'BREAK' : scheduleState.status === 'before_school' ? 'MORNING' : scheduleState.status === 'after_school' ? 'OFFLINE' : 'LIVE CLASS';
    }
    
    const titleEl = document.getElementById('timetable-live-title');
    if (titleEl && titleEl.textContent !== scheduleState.currentTitle) {
        titleEl.textContent = scheduleState.currentTitle;
    }
    
    const subtitleEl = document.getElementById('timetable-live-subtitle');
    if (subtitleEl && subtitleEl.textContent !== scheduleState.currentSubtitle) {
        subtitleEl.textContent = scheduleState.currentSubtitle;
    }
    
    const roomEl = document.getElementById('timetable-live-room');
    if (roomEl) {
        if (scheduleState.currentRoom && scheduleState.currentRoom !== 'Closed') {
            roomEl.style.display = '';
            roomEl.textContent = scheduleState.currentRoom;
        } else {
            roomEl.style.display = 'none';
        }
    }
    
    const timerLabelEl = document.getElementById('timetable-live-timer-label');
    if (timerLabelEl && timerLabelEl.textContent !== scheduleState.timerLabel) {
        timerLabelEl.textContent = scheduleState.timerLabel;
    }
    
    const timerValueEl = document.getElementById('timetable-live-timer-value');
    if (timerValueEl) {
        timerValueEl.textContent = formatTimeRemaining(scheduleState.remainingSecs);
    }
    
    const progressEl = document.getElementById('timetable-live-progress');
    if (progressEl) {
        progressEl.style.width = `${scheduleState.progressPct}%`;
    }

    const nextEl = document.getElementById('timetable-live-next');
    if (nextEl) {
        const nextText = scheduleState.nextTitle ? `${scheduleState.nextTitle} · ${(scheduleState.nextSubtitle||'').split(' • ')[0]}` : '';
        if (nextEl.textContent !== nextText) nextEl.textContent = nextText;
    }

    if (window._lastPeriodStatus !== scheduleState.status) {
        window._lastPeriodStatus = scheduleState.status;
        renderClassTimetable();
    }
};

window.toggleTimetableDayDropdown = function() {
    appState.openTimetableDayDropdown = !appState.openTimetableDayDropdown;
    renderClassTimetable();
};

window.selectClassDayFromDropdown = function(dayName) {
    appState.openTimetableDayDropdown = false;
    window.selectClassDay(dayName);
};

window.renderClassTimetable = function() {
    const container = document.getElementById('classTimetableContent');
    if (!container) return;

    const info = getStudentInfo();
    const dept = currentClassDept.toUpperCase();
    const { todayName, nextSchoolDayName, dayOfWeek } = getDayNames();
    const isWeekend = [0, 6].includes(dayOfWeek);
    const day = currentClassDay;
    const now = new Date();

    // Gather synced attendance subjects
    const actualSubjects = [];
    const adminNo = info?.adminNo || localStorage.getItem('machub_student_id') || '';
    if (adminNo) {
        const cached = getPortalCache('Attendance', adminNo);
        if (cached) {
            try {
                const parsed = JSON.parse(cached);
                const rows = parsed?.data?.payload?.sections?.[0]?.rows || parsed?.data?.sections?.[0]?.rows || [];
                rows.forEach(item => { if (item.subjectName) actualSubjects.push(item); });
            } catch(e) {}
        }
    }

    const semNum = getStudentSemNumber();
    const semKey = `CLASS_TIMETABLE_${dept}_SEM_${semNum}`;
    let dayPeriods = window[semKey]?.[day];

    if (!dayPeriods) {
        const fallbackKey = `CLASS_TIMETABLE_${dept}`;
        dayPeriods = window[fallbackKey]?.[day] || [];
    }

    if (dayPeriods.length === 0) {
        const studentName = info?.name || 'Student';
        const mailSubject = encodeURIComponent(`Timetable Update Request for ${dept} Sem ${semNum}`);
        const mailBody = encodeURIComponent(`Hi Admin,\n\nPlease update the timetable for ${dept} Sem ${semNum}.\n\nAdmission Number: ${adminNo}\nName: ${studentName}\n\n[Attach a photo/screenshot of your timetable here]`);
        const mailtoUrl = `mailto:machub.admin@gmail.com?subject=${mailSubject}&body=${mailBody}`;

        container.innerHTML = `
            <div style="padding:2.5rem 2rem; text-align:center; background:rgba(255,255,255,0.02); border:1px dashed rgba(255,255,255,0.1); border-radius:2rem; margin:0.5rem 0;">
                <div style="font-size:2.2rem; margin-bottom:1rem;">📅</div>
                <h4 style="font-size:15px; font-weight:800; color:#f5f5f7; margin-bottom:8px;">No Timetable Uploaded</h4>
                <p style="font-size:11px; color:#86868b; line-height:1.5; margin-bottom:18px; max-width: 250px; margin-left: auto; margin-right: auto;">
                    We don't have the active timetable for <strong>${dept} Sem ${semNum}</strong> yet.
                </p>
                <a href="${mailtoUrl}" class="inline-flex items-center gap-2 px-5 py-3 bg-[var(--mac-blue)] hover:bg-[#0077ed] text-white rounded-full text-xs font-black spring active:scale-95 transition-all shadow-md" style="text-decoration:none; display: inline-block;">
                    ✉️ Email Timetable to Admin
                </a>
            </div>`;
        return;
    }

    const scheduleState = getCurrentScheduleState(now);
    const formattedTimer = formatTimeRemaining(scheduleState.remainingSecs);
    const statusLabel = scheduleState.status === 'weekend' ? 'WEEKEND'
        : scheduleState.status === 'lunch_break' ? 'LUNCH BREAK'
        : scheduleState.status === 'before_school' ? 'MORNING'
        : scheduleState.status === 'after_school' ? 'SCHOOL OVER'
        : 'LIVE CLASS';

    // ── 1. Live Status Island ────────────────────────────────────────────
    const liveStatusHtml = `
        <div style="position:relative; border-radius:1.75rem; overflow:hidden; background:linear-gradient(150deg,#181818 0%,#0c0c0c 100%); border:1px solid rgba(255,255,255,0.08); margin-bottom:16px;">
            <div style="position:absolute;inset:0;pointer-events:none;background:radial-gradient(ellipse at 80% 110%, rgba(0,113,227,0.2) 0%, transparent 55%);"></div>
            <div style="position:relative;z-index:1;padding:18px 20px;display:flex;flex-direction:column;gap:12px;">
                <div style="display:flex;align-items:center;justify-content:space-between;">
                    <div style="display:flex;align-items:center;gap:8px;">
                        <span style="position:relative;display:inline-flex;width:8px;height:8px;flex-shrink:0;">
                            <span class="live-pulse-dot" style="position:absolute;inset:0;border-radius:50%;background:#34d399;opacity:0.7;"></span>
                            <span style="position:relative;width:8px;height:8px;border-radius:50%;background:#10b981;display:inline-block;"></span>
                        </span>
                        <span id="timetable-live-status" style="font-size:9px;font-weight:900;text-transform:uppercase;letter-spacing:0.16em;color:#86868b;">${statusLabel}</span>
                    </div>
                    <span id="timetable-live-clock" style="font-size:9px;font-weight:900;color:#86868b;text-transform:uppercase;letter-spacing:0.1em;">${now.toLocaleTimeString('en-US',{hour:'2-digit',minute:'2-digit',second:'2-digit',hour12:true})} IST</span>
                </div>
                <div>
                    <h3 id="timetable-live-title" style="font-size:17px;font-weight:700;color:#f5f5f7;line-height:1.3;margin:0 0 4px 0;">${scheduleState.currentTitle}</h3>
                    <div style="display:flex;align-items:center;gap:6px;flex-wrap:wrap;">
                        <span id="timetable-live-subtitle" style="font-size:11px;font-weight:600;color:#86868b;">${scheduleState.currentSubtitle}</span>
                        ${scheduleState.currentRoom && scheduleState.currentRoom !== 'Closed' ? `
                            <span style="color:#86868b;font-size:9px;">•</span>
                            <span id="timetable-live-room" style="font-size:9px;font-weight:800;color:#f5f5f7;background:rgba(255,255,255,0.1);padding:2px 8px;border-radius:8px;">${scheduleState.currentRoom}</span>
                        ` : `<span id="timetable-live-room" style="display:none;"></span>`}
                    </div>
                </div>
                <div id="timetable-live-progress-container" style="display:flex;flex-direction:column;gap:6px;">
                    <div style="display:flex;align-items:center;justify-content:space-between;">
                        <span id="timetable-live-timer-label" style="font-size:9px;font-weight:900;color:#86868b;text-transform:uppercase;letter-spacing:0.12em;">${scheduleState.timerLabel}</span>
                        <span id="timetable-live-timer-value" style="font-size:11px;font-weight:900;color:#f5f5f7;">${formattedTimer}</span>
                    </div>
                    <div style="width:100%;height:3px;background:rgba(255,255,255,0.08);border-radius:99px;overflow:hidden;">
                        <div id="timetable-live-progress" style="height:100%;border-radius:99px;background:#0071e3;width:${scheduleState.progressPct}%;transition:width 0.5s ease;"></div>
                    </div>
                </div>
                ${scheduleState.nextTitle ? `
                    <div style="display:flex;align-items:center;justify-content:space-between;gap:12px;padding-top:10px;border-top:1px solid rgba(255,255,255,0.06);">
                        <span style="font-size:9px;font-weight:900;color:#86868b;text-transform:uppercase;letter-spacing:0.12em;white-space:nowrap;">UP NEXT</span>
                        <span id="timetable-live-next" style="font-size:11px;font-weight:700;color:#f5f5f7;text-align:right;overflow-wrap:break-word;max-width:65%;">${scheduleState.nextTitle} · ${(scheduleState.nextSubtitle||'').split(' • ')[0]}</span>
                    </div>
                ` : ''}
            </div>
        </div>
    `;

    // ── 2. Today / Next Day Toggle ───────────────────────────────────────
    const todayToggleLabel = `Today (${isWeekend ? 'Mon' : todayName.slice(0,3)})`;
    const nextToggleLabel = `Next (${nextSchoolDayName.slice(0,3)})`;
    const toggleHtml = `
        <div style="display:flex;padding:4px;background:rgba(255,255,255,0.05);border:1px solid rgba(255,255,255,0.06);border-radius:1rem;gap:4px;margin-bottom:14px;">
            <button type="button" onclick="window.setTimetableDisplayMode('today')" id="tt-toggle-today" style="flex:1;padding:9px 4px;font-size:12px;font-weight:700;border-radius:12px;outline:none;border:none;cursor:pointer;transition:all 0.25s ease;${timetableDisplayMode === 'today' ? 'background:#ffffff;color:#1d1d1f;box-shadow:0 2px 8px rgba(0,0,0,0.15);' : 'background:transparent;color:#86868b;'}">${todayToggleLabel}</button>
            <button type="button" onclick="window.setTimetableDisplayMode('next')" id="tt-toggle-next" style="flex:1;padding:9px 4px;font-size:12px;font-weight:700;border-radius:12px;outline:none;border:none;cursor:pointer;transition:all 0.25s ease;${timetableDisplayMode === 'next' ? 'background:#ffffff;color:#1d1d1f;box-shadow:0 2px 8px rgba(0,0,0,0.15);' : 'background:transparent;color:#86868b;'}">${nextToggleLabel}</button>
        </div>
    `;

    // ── 3. Day Selector Dropdown (seat-dropdown style) ───────────────────
    const weekdays = ['Monday','Tuesday','Wednesday','Thursday','Friday'];
    const isDayOpen = appState.openTimetableDayDropdown === true;
    const daySelectorHtml = `
        <div style="margin-bottom:16px;">
            <div class="seat-dropdown ${isDayOpen ? 'is-open' : ''}">
                <button type="button" onclick="window.toggleTimetableDayDropdown()" class="seat-dropdown__trigger">
                    <div class="seat-dropdown__meta">
                        <span class="seat-dropdown__label">Viewing Day</span>
                        <span class="seat-dropdown__value">📅 ${day}</span>
                    </div>
                    <span class="seat-dropdown__icon">⌄</span>
                </button>
                <div class="seat-dropdown__menu">
                    ${weekdays.map(wd => {
                        const isToday = wd === (isWeekend ? 'Monday' : todayName);
                        const isTomorrow = wd === nextSchoolDayName && !isToday;
                        return `
                            <button type="button" onclick="window.selectClassDayFromDropdown('${wd}')" class="seat-dropdown__option ${wd === day ? 'is-active' : ''}">
                                <span class="seat-dropdown__option-title">${wd}</span>
                                ${isToday ? '<span class="seat-dropdown__option-meta">— Today</span>' : isTomorrow ? '<span class="seat-dropdown__option-meta">— Tomorrow</span>' : ''}
                            </button>`;
                    }).join('')}
                </div>
            </div>
        </div>
    `;

    // ── 4. Sync Banner ───────────────────────────────────────────────────
    const syncAlertHtml = actualSubjects.length === 0 ? `
        <div style="display:flex;align-items:center;justify-content:space-between;gap:12px;padding:12px 16px;margin-bottom:14px;border-radius:1rem;background:rgba(245,158,11,0.06);border:1px solid rgba(245,158,11,0.2);">
            <p style="font-size:11px;font-weight:600;color:rgba(251,191,36,0.9);flex:1;margin:0;">💡 Sync your portal to see live attendance per subject</p>
            <button onclick="window.openPortalDrawer()" style="flex-shrink:0;padding:6px 12px;background:#f5a623;color:#000;font-size:10px;font-weight:900;border-radius:10px;border:none;cursor:pointer;text-transform:uppercase;letter-spacing:0.05em;">Sync</button>
        </div>
    ` : '';

    // ── 5. Period Cards ──────────────────────────────────────────────────
    const isDayToday = (day === (isWeekend ? 'Monday' : todayName));
    const ACCENT_COLORS = ['#0071e3','#7c3aed','#059669','#d97706','#e11d48'];
    let cardsHtml = '<div style="display:flex;flex-direction:column;gap:10px;">';

    dayPeriods.forEach((period, idx) => {
        const periodNum = parseInt(period.period);
        const isLive = isDayToday && scheduleState.periodIndex === idx;
        const isPast = isDayToday && scheduleState.periodIndex > idx;
        const accent = ACCENT_COLORS[idx % ACCENT_COLORS.length];

        // Attendance row
        let attHtml = '';
        const attMatch = actualSubjects.find(s =>
            s.subjectName && (
                s.subjectName.toLowerCase().includes(period.title.toLowerCase()) ||
                period.title.toLowerCase().includes(s.subjectName.toLowerCase())
            )
        );
        if (attMatch) {
            const pct = parseFloat(attMatch.percentage) || 0;
            const present = parseInt(attMatch.presentHours) || 0;
            const total = parseInt(attMatch.totalHours) || 0;
            const barClr = pct < 75 ? '#ef4444' : pct < 80 ? '#f59e0b' : '#10b981';
            let badge = '';
            if (total > 0) {
                if (pct >= 75) {
                    const safe = Math.max(0, Math.floor(present / 0.75) - total);
                    badge = safe > 0
                        ? `<span style="background:rgba(16,185,129,0.12);color:#10b981;font-size:9px;font-weight:900;padding:2px 8px;border-radius:99px;white-space:nowrap;">⚡ ${safe} safe bunks</span>`
                        : `<span style="background:rgba(245,158,11,0.12);color:#f59e0b;font-size:9px;font-weight:900;padding:2px 8px;border-radius:99px;white-space:nowrap;">⚠️ At limit</span>`;
                } else {
                    const need = Math.ceil((0.75 * total - present) / 0.25);
                    badge = `<span style="background:rgba(239,68,68,0.12);color:#ef4444;font-size:9px;font-weight:900;padding:2px 8px;border-radius:99px;white-space:nowrap;">🚨 Need ${need} more</span>`;
                }
            }
            attHtml = `
                <div style="margin-top:10px;padding-top:10px;border-top:1px solid rgba(255,255,255,0.06);">
                    <div style="display:flex;align-items:center;justify-content:space-between;gap:8px;margin-bottom:5px;flex-wrap:wrap;">
                        <div style="display:flex;align-items:center;gap:8px;flex-wrap:wrap;min-width:0;">
                            <span style="font-size:9px;font-weight:900;color:#86868b;text-transform:uppercase;letter-spacing:0.1em;">Attendance</span>
                            <span style="font-size:10px;font-weight:700;color:#f5f5f7;">${present}/${total}</span>
                            ${badge}
                        </div>
                        <span style="font-size:12px;font-weight:900;color:#f5f5f7;flex-shrink:0;">${Math.round(pct)}%</span>
                    </div>
                    <div style="width:100%;height:3px;background:rgba(255,255,255,0.08);border-radius:99px;overflow:hidden;">
                        <div style="height:100%;border-radius:99px;background:${barClr};width:${Math.min(100,pct)}%;"></div>
                    </div>
                </div>`;
        }

        cardsHtml += `
            <div style="position:relative;border-radius:1.5rem;border:1px solid ${isLive ? 'rgba(0,113,227,0.35)' : 'rgba(255,255,255,0.07)'};background:${isLive ? 'rgba(0,113,227,0.06)' : 'rgba(255,255,255,0.025)'};overflow:hidden;opacity:${isPast ? 0.52 : 1};transition:opacity 0.3s;">
                <div style="position:absolute;left:14px;top:14px;bottom:14px;width:3px;border-radius:99px;background:${accent};opacity:${isPast ? 0.3 : isLive ? 1 : 0.65};"></div>
                <div style="padding:14px 16px 14px 28px;">
                    <div style="display:flex;align-items:center;justify-content:space-between;gap:8px;margin-bottom:4px;">
                        <div style="display:flex;align-items:center;gap:6px;min-width:0;overflow:hidden;">
                            <span style="font-size:9px;font-weight:900;color:#86868b;text-transform:uppercase;letter-spacing:0.1em;white-space:nowrap;">P${periodNum}</span>
                            <span style="color:#86868b;font-size:9px;">·</span>
                            <span style="font-size:9px;font-weight:700;color:#86868b;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">${period.time}</span>
                        </div>
                        <div style="display:flex;align-items:center;gap:5px;flex-shrink:0;">
                            ${isLive ? `<span class="live-pulse-dot" style="font-size:9px;font-weight:900;color:#0071e3;background:rgba(0,113,227,0.12);padding:2px 8px;border-radius:99px;text-transform:uppercase;">● LIVE</span>` : ''}
                            ${isPast ? `<span style="font-size:9px;font-weight:900;color:#10b981;background:rgba(16,185,129,0.1);padding:2px 8px;border-radius:99px;">✓ Done</span>` : ''}
                        </div>
                    </div>
                    <div style="font-size:14px;font-weight:700;color:#f5f5f7;line-height:1.35;margin-bottom:5px;overflow-wrap:break-word;">${period.title}</div>
                    <div style="display:flex;align-items:center;gap:8px;flex-wrap:wrap;">
                        <span style="font-size:9px;font-weight:800;color:#86868b;text-transform:uppercase;letter-spacing:0.1em;">${period.code}</span>
                        <span style="color:#86868b;font-size:9px;">·</span>
                        <span style="font-size:9px;font-weight:700;color:#86868b;">📍 ${period.room}</span>
                    </div>
                    ${attHtml}
                </div>
            </div>`;

        // Lunch break after period 3
        if (idx === 2) {
            const isLunchLive = isDayToday && scheduleState.status === 'lunch_break';
            const isLunchPast = isDayToday && ['period4','period5','after_school'].includes(scheduleState.status);
            cardsHtml += `
                <div style="position:relative;border-radius:1.5rem;border:${isLunchLive ? '1px solid rgba(245,158,11,0.35)' : '1px dashed rgba(255,255,255,0.1)'};background:${isLunchLive ? 'rgba(245,158,11,0.06)' : 'transparent'};overflow:hidden;opacity:${isLunchPast ? 0.52 : 1};transition:opacity 0.3s;">
                    <div style="position:absolute;left:14px;top:12px;bottom:12px;width:3px;border-radius:99px;background:#f59e0b;opacity:${isLunchLive ? 1 : 0.4};"></div>
                    <div style="padding:12px 16px 12px 28px;display:flex;align-items:center;justify-content:space-between;gap:12px;">
                        <div>
                            <div style="font-size:9px;font-weight:900;color:#86868b;text-transform:uppercase;letter-spacing:0.1em;margin-bottom:3px;">Lunch Break</div>
                            <div style="font-size:13px;font-weight:700;color:#f5f5f7;">12:30 PM – 1:30 PM</div>
                        </div>
                        <span style="font-size:9px;font-weight:800;color:#86868b;background:rgba(255,255,255,0.05);border:1px solid rgba(255,255,255,0.08);padding:4px 10px;border-radius:10px;flex-shrink:0;">🍴 Canteen</span>
                    </div>
                </div>`;
        }
    });

    cardsHtml += '</div>';

    container.innerHTML = `
        ${liveStatusHtml}
        ${toggleHtml}
        ${daySelectorHtml}
        ${syncAlertHtml}
        ${cardsHtml}
    `;
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

        container.innerHTML = window.getFreshnessIndicatorHtml('Assessment') + actualSubjects.map((subject, idx) => {
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

    container.innerHTML = window.getFreshnessIndicatorHtml('Assessment') + `
        <div class="glass-panel p-8 text-center my-4 rounded-[2rem] border border-white/10 dark:border-white/5">
            <div class="w-12 h-12 rounded-full bg-[var(--mac-blue)]/10 text-[var(--mac-blue)] flex items-center justify-center text-xl mx-auto mb-4 border border-[var(--mac-blue)]/20">
                🔄
            </div>
            <h4 class="text-sm font-extrabold text-[#1d1d1f] dark:text-[#f5f5f7] mb-1">No Synced Data</h4>
            <p class="text-xs text-[#86868b] max-w-xs mx-auto mb-4">Please sync your student portal to load your subjects.</p>
            <button onclick="window.openPortalDrawer()" class="px-5 py-2.5 bg-[var(--mac-blue)] text-white text-xs font-bold rounded-xl spring active:scale-95">
                Sync Portal Now
            </button>
        </div>
    `;
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

window.switchAttendanceSemester = function (sem) {
    appState.selectedAttendanceSem = sem;
    appState.openInternalDropdown = null;
    window.renderClassAttendance();
    
    // Auto-sync if specific semester selected and portal API is available
    if (sem !== 'all' && window.MacHubPortal && typeof window.MacHubPortal.fetchSection === 'function') {
        const btn = document.getElementById('sync-attendance-btn');
        if (btn) {
            btn.innerHTML = '🔄 Syncing...';
            btn.style.opacity = '0.5';
            btn.style.pointerEvents = 'none';
        }
        window.MacHubPortal.fetchSection('Attendance', true, sem)
            .then(() => {
                window.renderClassAttendance();
            })
            .catch(err => {
                console.error("Attendance sync failed:", err);
                window.renderClassAttendance();
            });
    }
};

window.renderClassAttendance = function() {
    const container = document.getElementById('classAttendanceContent');
    if (!container) return;

    const info = getStudentInfo();
    const adminNo = info?.adminNo || localStorage.getItem('machub_student_id') || '';
    
    const maxSem = getStudentSemNumber();
    const selectedSem = appState.selectedAttendanceSem || String(getStudentSemNumber());
    const isSemOpen = appState.openInternalDropdown === 'attendanceSem';

    let semFilterHtml = `
        <div class="grid grid-cols-1 mb-5 w-full">
            <div class="seat-dropdown ${isSemOpen ? 'is-open' : ''}">
                <button type="button" onclick="window.toggleInternalDropdown('attendanceSem')" class="seat-dropdown__trigger">
                    <div class="seat-dropdown__meta">
                        <span class="seat-dropdown__label">Semester Selection</span>
                        <span class="seat-dropdown__value">${selectedSem === 'all' ? 'Latest Cached' : 'Semester ' + selectedSem}</span>
                    </div>
                    <span class="seat-dropdown__icon">⌄</span>
                </button>
                <div class="seat-dropdown__menu">
                    <button type="button" onclick="window.switchAttendanceSemester('all')" class="seat-dropdown__option ${selectedSem === 'all' ? 'is-active' : ''}">
                        <span class="seat-dropdown__option-title">Latest Cached</span>
                    </button>
                    ${Array.from({ length: maxSem }, (_, i) => {
                        const sem = String(i + 1);
                        const isActive = selectedSem === sem;
                        return `
                            <button type="button" onclick="window.switchAttendanceSemester('${sem}')" class="seat-dropdown__option ${isActive ? 'is-active' : ''}">
                                <span class="seat-dropdown__option-title">Semester ${sem}</span>
                            </button>
                        `;
                    }).join('')}
                </div>
            </div>
        </div>
    `;

    // Pull subject rows from stored attendance data
    const subjects = [];
    if (adminNo) {
        let cached = null;
        if (selectedSem !== 'all') {
            cached = getPortalCache('Attendance', adminNo, selectedSem);
        } else {
            cached = getPortalCache('Attendance', adminNo);
        }
        
        if (!cached) {
            const fallbackKey = `machub_data_Attendance`;
            cached = localStorage.getItem(fallbackKey);
        }

        if (cached) {
            try {
                const parsed = JSON.parse(cached);
                const dataObj = parsed?.data?.payload || parsed?.payload || parsed?.data || parsed;
                // Support both possible data structures
                const rows =
                    dataObj?.subjectWise?.sections?.[0]?.rows ||
                    dataObj?.sections?.[0]?.rows ||
                    dataObj?.sections?.[0]?.data ||
                    dataObj?.subjects ||
                    [];
                rows.forEach(item => {
                    if (item.subjectName || item.subject) {
                        subjects.push({
                            name: item.subjectName || item.subject,
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
        // Show spinner + trigger auto fetch in background
        container.innerHTML = window.getFreshnessIndicatorHtml('Attendance', selectedSem === 'all' ? '' : selectedSem) + semFilterHtml + `
            <div id="attendance-loading-state" style="text-align:center;padding:3rem 1rem;">
                <div class="w-10 h-10 border-4 border-[var(--mac-blue)] border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
                <p style="font-size:0.85rem;font-weight:700;color:var(--mac-secondary,#86868b);">Fetching attendance...</p>
            </div>
        `;
        // Auto-fetch and re-render
        if (adminNo && window.MacHubPortal && typeof window.MacHubPortal.fetchSection === 'function') {
            const semToFetch = selectedSem !== 'all' ? selectedSem : '';
            window.MacHubPortal.fetchSection('Attendance', true, semToFetch)
                .then(() => { window.renderClassAttendance(); })
                .catch(() => {
                    const loadEl = document.getElementById('attendance-loading-state');
                    if (loadEl) loadEl.innerHTML = `
                        <div style="font-size:2rem;margin-bottom:0.75rem;">📊</div>
                        <p style="font-size:0.9rem;font-weight:700;color:var(--mac-secondary,#86868b);">No attendance data for this semester</p>
                        <button onclick="window.switchAttendanceSemester('${selectedSem}')" class="mt-4 px-6 py-2.5 bg-[var(--mac-blue)] text-white rounded-full text-xs font-black spring active:scale-95">🔄 Retry Sync</button>
                    `;
                });
        }
        return;
    }

    // ── Stale-data background refresh ─────────────────────────────────────
    // Data found but stale (>4h) → silently re-fetch and re-render
    if (adminNo && isPortalCacheStale('Attendance', adminNo, selectedSem !== 'all' ? selectedSem : '')) {
        if (window.MacHubPortal && typeof window.MacHubPortal.fetchSection === 'function') {
            const semToFetch = selectedSem !== 'all' ? selectedSem : '';
            window.MacHubPortal.fetchSection('Attendance', true, semToFetch)
                .then(() => { window.renderClassAttendance(); })
                .catch(() => {}); // silent — we already have data to show
        }
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
    const heroHtml = window.getFreshnessIndicatorHtml('Attendance', selectedSem === 'all' ? '' : selectedSem) + semFilterHtml + `
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

function getStudentSemNumber() {
    autoUpdateSemesterFromCache();
    const info = getStudentInfo();
    if (info && info.semester) {
        const match = info.semester.match(/\d+/);
        if (match) return parseInt(match[0], 10);
    }
    return 2; // Default fallback sem
}
window.getStudentSemNumber = getStudentSemNumber;

function autoUpdateSemesterFromCache() {
    try {
        // Read directly from localStorage first to avoid caching issues during onboarding/init
        const rawInfo = localStorage.getItem('mac_student_info');
        if (!rawInfo) return;
        const info = JSON.parse(rawInfo);
        if (!info) return;
        const adminNo = info.adminNo || info.admissionNo || info.admissionNumber || localStorage.getItem('machub_student_id') || '';
        if (!adminNo) return;
        
        let maxSem = 0;
        
        // 1. Scan localStorage keys for semester suffixes
        for (let i = 0; i < localStorage.length; i++) {
            const key = localStorage.key(i);
            if (key && key.includes(adminNo)) {
                const match = key.match(/_sem(\d+)_/);
                if (match) {
                    const s = parseInt(match[1], 10);
                    if (s > 0 && s <= 8) {
                        maxSem = Math.max(maxSem, s);
                    }
                }
            }
        }
        
        // 2. Parse generic keys (without suffix) to check their selected semesters
        const checkPayloadForSelectedSem = (section) => {
            const raw = localStorage.getItem(`machub_portal_${section}_${adminNo}`);
            if (!raw) return 0;
            try {
                const parsed = JSON.parse(raw);
                const dataObj = parsed?.data?.payload || parsed?.payload || parsed?.data || parsed;
                const sems = dataObj?.semesters || dataObj?.semesterOptions || [];
                const selectedOpt = sems.find(s => s.selected);
                if (selectedOpt) {
                    const textMatch = String(selectedOpt.text || '').match(/\d+/);
                    const valMatch  = String(selectedOpt.value || '').match(/\d+/);
                    if (textMatch) return parseInt(textMatch[0], 10);
                    if (valMatch) return parseInt(valMatch[0], 10);
                }
            } catch(e) {}
            return 0;
        };

        maxSem = Math.max(maxSem, checkPayloadForSelectedSem('Attendance'));
        maxSem = Math.max(maxSem, checkPayloadForSelectedSem('Assessment'));
        maxSem = Math.max(maxSem, checkPayloadForSelectedSem('InternalMark'));

        // 3. Parse Dashboard cache
        const dashRaw = localStorage.getItem(`machub_portal_Dashboard_${adminNo}`);
        if (dashRaw) {
            try {
                const parsed = JSON.parse(dashRaw);
                const dataObj = parsed?.data?.payload || parsed?.payload || parsed?.data || parsed;
                const dashSem = dataObj?.semester;
                if (dashSem) {
                    const match = String(dashSem).match(/\d+/);
                    if (match) {
                        maxSem = Math.max(maxSem, parseInt(match[0], 10));
                    }
                }
            } catch(e) {}
        }

        // 4. Calculate based on batch as a fallback/verification
        if (info.batch) {
            const matchBatch = String(info.batch).match(/(\d{4})/);
            if (matchBatch) {
                const startYear = parseInt(matchBatch[1], 10);
                const currentDate = new Date();
                const currentYear = currentDate.getFullYear();
                const currentMonth = currentDate.getMonth() + 1;
                
                let elapsedYears = currentYear - startYear;
                if (currentMonth < 6) {
                    elapsedYears -= 1;
                }
                if (elapsedYears >= 0) {
                    let calculatedSem = 1;
                    if (elapsedYears === 0) {
                        calculatedSem = (currentMonth >= 6 && currentMonth < 11) ? 1 : 2;
                    } else if (elapsedYears === 1) {
                        calculatedSem = (currentMonth >= 6 && currentMonth < 11) ? 3 : 4;
                    } else if (elapsedYears === 2) {
                        calculatedSem = (currentMonth >= 6 && currentMonth < 11) ? 5 : 6;
                    } else {
                        calculatedSem = 6;
                    }
                    maxSem = Math.max(maxSem, calculatedSem);
                }
            }
        }
        
        if (maxSem > 0) {
            const match = info.semester ? info.semester.match(/\d+/) : null;
            const currentSemNum = match ? parseInt(match[0], 10) : 2;
            if (maxSem !== currentSemNum) {
                console.log(`[MacHub] Auto-updating student semester: Sem ${currentSemNum} -> Sem ${maxSem}`);
                info.semester = `Sem ${maxSem}`;
                
                // Write directly to localstorage AND memory cache using ExamHubProfile if available
                if (window.ExamHubProfile && typeof window.ExamHubProfile.save === 'function') {
                    window.ExamHubProfile.save(info);
                } else {
                    localStorage.setItem('mac_student_info', JSON.stringify(info));
                }
                
                // Update selections
                appState.selectedAttendanceSem = String(maxSem);
                appState.selectedInternalSem = String(maxSem);
                appState.selectedExamSem = String(maxSem);
            }
        }
    } catch(e) {
        console.warn('Failed to auto update semester:', e);
    }
}

window.toggleInternalDropdown = function (name) {
    appState.openInternalDropdown = appState.openInternalDropdown === name ? null : name;
    window.renderExamResults();
};

window.switchInternalSemester = function (sem) {
    appState.selectedInternalSem = sem;
    appState.openInternalDropdown = null;
    
    // Automatically trigger scraping/fetch for the selected semester
    if (typeof window.autoFetchInternals === 'function') {
        window.autoFetchInternals(sem, true);
    }
    
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
    
    // When force=true, reset any previous 'fetching' lock so we can re-fetch
    if (force && appState.internalFetchStatus[semester] === 'fetching') {
        appState.internalFetchStatus[semester] = null;
    }
    if (appState.internalFetchStatus[semester] === 'fetching') return;

    appState.internalFetchStatus[semester] = 'fetching';
    try {
        if (window.MacHubPortal && typeof window.MacHubPortal.fetchSection === 'function') {
            const [internalResult, assessResult] = await Promise.allSettled([
                window.MacHubPortal.fetchSection('InternalMark', force, semester),
                window.MacHubPortal.fetchSection('Assessment', force, semester)
            ]);
            console.log('[College Results] InternalMark fetch:', internalResult?.status, internalResult?.value);
            console.log('[College Results] Assessment fetch:', assessResult?.status, assessResult?.value);
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
            // Sync all results: University results AND College results (InternalMark & Assessment)
            await Promise.all([
                window.MacHubPortal.fetchSection('ExamResult', true),
                window.MacHubPortal.fetchSection('InternalMark', true, activeSem),
                window.MacHubPortal.fetchSection('Assessment', true, activeSem)
            ]);
            
            if (appState.internalFetchStatus) {
                appState.internalFetchStatus[activeSem] = 'success';
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
            container.innerHTML = window.getFreshnessIndicatorHtml('ExamResult') + headerHtml + `
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
            results = parsed?.data?.payload?.results || parsed?.data?.results || parsed?.payload?.results || parsed?.results || parsed?.sections || parsed?.data?.sections || parsed?.payload?.sections || [];
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

        container.innerHTML = window.getFreshnessIndicatorHtml('ExamResult', selectedSem === 'all' ? '' : selectedSem) + headerHtml + semFilterHtml + resultsHtml;

    } else {
        // College Results / Internal Marks subtab
        const activeSem = appState.selectedInternalSem || String(getStudentSemNumber());
        const internalRaw = getPortalCache('InternalMark', adminNo, activeSem);
        const assessRaw = getPortalCache('Assessment', adminNo, activeSem);

        if (!appState.internalFetchStatus) {
            appState.internalFetchStatus = {};
        }
        const fetchStatus = appState.internalFetchStatus[activeSem];

        // Background stale-refresh: data exists but is >4h old
        if ((internalRaw || assessRaw) && 
            isPortalCacheStale('InternalMark', adminNo, activeSem) &&
            fetchStatus !== 'fetching') {
            window.autoFetchInternals(activeSem, true);
        }

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

        // ── Parse helpers: extract sections from any cache wrapper format ─────
        // writeCache saves: { data: <apiPayload>, savedAt: timestamp }
        // apiPayload is: { success, payload: { page, sections, semesters } }
        // The worker executeScrape returns: { success, section, data: { page, sections }, page, timestamp }
        // api.js fetchSection normalises: { success, payload: json.data }
        // So writeCache stores: { data: { success, payload: { page, sections } }, savedAt }
        function extractSections(raw, label) {
            if (!raw) return [];
            try {
                const parsed = JSON.parse(raw);
                // PRIMARY: { data: { payload: { sections } }, savedAt } — standard localStorage cache format
                if (Array.isArray(parsed?.data?.payload?.sections) && parsed.data.payload.sections.length > 0)
                    return parsed.data.payload.sections;
                // ALSO try if data.payload is the page object itself (page, sections, semesters at top level of payload)
                if (Array.isArray(parsed?.data?.payload?.sections))
                    return parsed.data.payload.sections;
                // Worker direct format: { data: { page, sections, ... } } without payload wrapper
                if (Array.isArray(parsed?.data?.sections))
                    return parsed.data.sections;
                // Unwrapped: { payload: { sections } }
                if (Array.isArray(parsed?.payload?.sections))
                    return parsed.payload.sections;
                // { sections } directly
                if (Array.isArray(parsed?.sections))
                    return parsed.sections;
                // Flat array
                if (Array.isArray(parsed))
                    return parsed;
                // Last resort: if data has rows/headers directly, wrap it
                if (parsed?.data?.payload?.rows && Array.isArray(parsed.data.payload.rows)) {
                    return [{ subject: label || 'General', headers: parsed.data.payload.headers || [], rows: parsed.data.payload.rows }];
                }
                if (parsed?.data?.rows && Array.isArray(parsed.data.rows)) {
                    return [{ subject: label || 'General', headers: parsed.data.headers || [], rows: parsed.data.rows }];
                }
                console.warn(`[CollegeResults] extractSections(${label}): unrecognised shape`, JSON.stringify(parsed).substring(0, 200));
            } catch (e) {
                console.error('[InternalMark] Parse error:', e);
            }
            return [];
        }

        // Parse continuous assessments (Assessment section)
        const assessData = extractSections(assessRaw, 'Assessment');

        // Parse InternalMark — it also returns sections[] (same shape as Assessment)
        // Each section: { subject, headers, rows }
        // The rows contain the final university internal mark data
        const internalData = extractSections(internalRaw, 'InternalMark');

        console.log('[College Results] Sem', activeSem, '\u2014 assessData:', assessData.length, 'internalData:', internalData.length);
        if (assessData.length === 0 && internalRaw) {
            try { console.log('[College Results] Raw assessRaw keys:', Object.keys(JSON.parse(assessRaw)?.data || {}).join(',')); } catch(e){}
        }
        if (internalData.length === 0 && internalRaw) {
            try { console.log('[College Results] Raw internalRaw keys:', Object.keys(JSON.parse(internalRaw)?.data || {}).join(',')); } catch(e){}
        }

        // Build unified set of all subject names from both data sources
        const subjectNames = new Set();
        assessData.forEach(sec => { if (sec.subject && sec.subject.trim() !== '') subjectNames.add(sec.subject); });
        internalData.forEach(sec => { if (sec.subject && sec.subject.trim() !== '') subjectNames.add(sec.subject); });

        let contentHtml = '';
        if (subjectNames.size > 0) {
            contentHtml = Array.from(subjectNames).map(subjectName => {
                const matchingAssess   = assessData.find(sec => sec.subject && sec.subject.toLowerCase() === subjectName.toLowerCase());
                // Find matching internal mark:
                // Case A: Multi-table format (one table per subject section)
                let matchingInternal = internalData.find(sec => sec.subject && sec.subject.toLowerCase() === subjectName.toLowerCase());
                let internalRow = matchingInternal?.rows?.[0];
                let internalHeaders = matchingInternal?.headers || [];
                let internalRowsAll = matchingInternal?.rows || [];

                // Case B: Single-table format (one table containing all subjects as rows)
                if (!internalRow) {
                    for (const sec of internalData) {
                        const foundRow = sec.rows?.find(r => {
                            const subName = r['Subject Name'] || r['SubjectName'] || r['subject name'] || r['subject'] || r['col_1'] || r['col_0'] || '';
                            return subName.toLowerCase().replace(/\s*\([^)]+\)/g, '').trim() === subjectName.toLowerCase();
                        });
                        if (foundRow) {
                            internalRow = foundRow;
                            internalHeaders = sec.headers || [];
                            internalRowsAll = [foundRow];
                            matchingInternal = sec;
                            break;
                        }
                    }
                }

                // Filter CCR rows based on selection (Assessment section)
                let rowsToRender = [];
                if (matchingAssess && matchingAssess.rows) {
                    matchingAssess.rows.forEach(r => {
                        const type = r['Assessment Type'] || r['col_0'] || '';
                        const isModel    = type.toLowerCase().includes('model');
                        const isInternal = type.toLowerCase().includes('internal');
                        if (activeType === 'both') rowsToRender.push(r);
                        else if (activeType === 'model'    && isModel)    rowsToRender.push(r);
                        else if (activeType === 'internal' && isInternal) rowsToRender.push(r);
                    });
                }

                // Render final university internal mark rows (InternalMark section)
                let finalUniversityHtml = '';
                if (internalRow && (activeType === 'both' || activeType === 'internal')) {
                    // Helper to get a value from a row by possible keys
                    const getVal = (row, ...keys) => {
                        for (const k of keys) {
                            if (row[k] !== undefined && row[k] !== null && String(row[k]).trim() !== '') return String(row[k]).trim();
                        }
                        return '—';
                    };

                    const markVal = getVal(internalRow,
                        'Obtained Mark', 'ObtainedMark', 'obtained mark', 'internalMark',
                        'Internal Mark', 'Mark', 'Score', 'mark', 'score',
                        'col_1', 'col_2'
                    );
                    const maxVal  = getVal(internalRow,
                        'Max Mark', 'MaxMark', 'max mark', 'maxMark',
                        'Maximum', 'Out Of', 'Total Mark',
                        'col_2', 'col_3'
                    );

                    // If there are multiple rows in the section (Case A only), render them all as a table
                    if (internalRowsAll.length > 1) {
                        const tableHeaders = internalHeaders.length > 0 ? internalHeaders : Object.keys(internalRow);
                        finalUniversityHtml = `
                            <div style="overflow-x:auto; border-radius:12px; border:1px solid var(--glass-border); margin-bottom: 12px;">
                                <table class="data-table">
                                    <thead><tr>${tableHeaders.map(h => `<th>${h}</th>`).join('')}</tr></thead>
                                    <tbody>
                                        ${internalRowsAll.map(row => `
                                            <tr>${tableHeaders.map(h => `<td>${row[h] !== undefined ? row[h] : '—'}</td>`).join('')}</tr>
                                        `).join('')}
                                    </tbody>
                                </table>
                            </div>
                        `;
                    } else {
                        // Single row — show as a clean summary card
                        finalUniversityHtml = `
                            <div class="flex items-center justify-between p-3.5 bg-white/5 dark:bg-white/5 border border-white/5 rounded-2xl">
                                <div class="flex flex-col">
                                    <span class="text-[10px] font-bold text-white uppercase tracking-wider">Final University Internal</span>
                                    <span class="text-[9px] text-[#86868b] mt-0.5">Official mark submitted to MGU University</span>
                                </div>
                                <div class="flex items-baseline gap-0.5">
                                    <span class="text-sm font-black text-[var(--mac-blue)]">${markVal}</span>
                                    <span class="text-[9px] font-bold text-[#86868b]">/ ${maxVal}</span>
                                </div>
                            </div>
                        `;
                    }
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
                                        const type   = row['Assessment Type'] || row['col_0'] || '—';
                                        const score  = row['Score'] || row['col_1'] || '—';
                                        const max    = row['Max Mark'] || row['col_2'] || '—';
                                        const pass   = row['Pass Mark'] || row['col_3'] || '—';
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

        // ── Fallback: if no subject names (sections exist but have empty/no subject field)
        // Render all sections as raw tables so data is NEVER silently lost
        if (!contentHtml && (assessData.length > 0 || internalData.length > 0)) {
            const allSections = [
                ...assessData.map(s => ({ ...s, _source: 'Assessment' })),
                ...internalData.map(s => ({ ...s, _source: 'InternalMark' }))
            ].filter(s => s.rows && s.rows.length > 0);

            if (allSections.length > 0) {
                contentHtml = allSections.map(sec => {
                    const headers = sec.headers && sec.headers.length > 0
                        ? sec.headers
                        : Object.keys(sec.rows[0] || {});
                    const title = sec.subject && sec.subject !== 'General'
                        ? sec.subject
                        : (sec._source === 'Assessment' ? 'College Assessment Marks' : 'Internal Marks');
                    return `
                        <div class="glass-panel rounded-[2rem] p-5 mb-4 border border-white/5">
                            <div class="flex items-center gap-2.5 mb-3.5">
                                <span class="text-base">📝</span>
                                <h4 class="text-[12px] font-bold text-white">${title}</h4>
                            </div>
                            <div style="overflow-x:auto; border-radius:12px; border:1px solid var(--glass-border);">
                                <table class="data-table">
                                    <thead><tr>${headers.map(h => `<th>${h}</th>`).join('')}</tr></thead>
                                    <tbody>
                                        ${sec.rows.map(row => `
                                            <tr>${headers.map(h => `<td>${row[h] !== undefined ? row[h] : '—'}</td>`).join('')}</tr>
                                        `).join('')}
                                    </tbody>
                                </table>
                            </div>
                        </div>
                    `;
                }).join('');
            }
        }

        if (!contentHtml) {
            const hasFetchError = fetchStatus === 'error';
            contentHtml = `
                <div class="glass-panel rounded-[2rem] p-8 text-center my-6 border border-white/5">
                    <div class="w-16 h-16 bg-black/5 dark:bg-white/5 rounded-2xl flex items-center justify-center text-3xl mx-auto mb-4">📭</div>
                    <h3 class="text-base font-black text-white">${hasFetchError ? 'Portal Fetch Failed' : 'No College Marks Found'}</h3>
                    <p class="text-[10px] font-bold text-[#86868b] mt-2 leading-relaxed mb-4">
                        ${hasFetchError
                            ? 'Could not connect to the college portal. Check your internet or portal credentials.'
                            : `The portal returned no internal marks for Semester ${activeSem}. This semester may not have marks published yet.`}
                    </p>
                    <button onclick="window.autoFetchInternals('${activeSem}', true)" class="px-6 py-2.5 bg-[var(--mac-blue)] text-white rounded-full text-xs font-black spring active:scale-95">
                        🔄 Retry Fetch
                    </button>
                </div>`;
        }

        container.innerHTML = window.getFreshnessIndicatorHtml('InternalMark', activeSem) + headerHtml + filterHtml + contentHtml;
    }
}

// Helper to convert time format (e.g. "09:30 AM") to minutes since midnight
function getMinutesFromTimeString(timeStr) {
    const parts = timeStr.trim().split(' ');
    if (parts.length < 2) return 0;
    const timeParts = parts[0].split(':');
    let hour = parseInt(timeParts[0], 10);
    const min = parseInt(timeParts[1], 10);
    const ampm = parts[1].toLowerCase();
    if (ampm === 'pm' && hour < 12) hour += 12;
    if (ampm === 'am' && hour === 12) hour = 0;
    return hour * 60 + min;
}

function getLiveClassTrackerHtml(dept, semNum) {
    const timetableKey = `CLASS_TIMETABLE_${dept}_SEM_${semNum}`;
    let timetable = window[timetableKey];
    if (!timetable) {
        timetable = window[`CLASS_TIMETABLE_${dept}`];
    }
    if (!timetable) return '';

    const DAYS = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
    const now = new Date();
    const utc = now.getTime() + (now.getTimezoneOffset() * 60000);
    const istNow = new Date(utc + (3600000 * 5.5)); // IST timezone
    
    const dayName = DAYS[istNow.getDay()];
    const todaySchedule = timetable[dayName] || [];

    if (dayName === 'Sunday' || dayName === 'Saturday' || todaySchedule.length === 0) {
        return `
            <div class="glass-panel p-5 rounded-[2rem] border border-white/5 bg-white/5 backdrop-blur-md relative overflow-hidden">
                <div class="flex items-center justify-between mb-2">
                    <span class="text-[9px] font-black text-[#86868b] uppercase tracking-wider">Smart Campus</span>
                    <span class="text-xs">☀️</span>
                </div>
                <h4 class="text-sm font-bold text-white">Weekend Rest</h4>
                <p class="text-[10px] font-bold text-[#86868b] mt-1">No classes scheduled for today. Enjoy your day!</p>
            </div>
        `;
    }

    const currentMins = istNow.getHours() * 60 + istNow.getMinutes();
    let activePeriod = null;
    let nextPeriod = null;

    todaySchedule.forEach((item, idx) => {
        const timeParts = item.time.split('-');
        if (timeParts.length < 2) return;
        const startMins = getMinutesFromTimeString(timeParts[0]);
        const endMins = getMinutesFromTimeString(timeParts[1]);

        if (currentMins >= startMins && currentMins < endMins) {
            activePeriod = { ...item, startMins, endMins };
            nextPeriod = todaySchedule[idx + 1] || null;
        }
    });

    const lunchStart = 12 * 60 + 30; // 12:30 PM
    const lunchEnd = 13 * 60 + 30;  // 01:30 PM
    let isLunchBreak = (currentMins >= lunchStart && currentMins < lunchEnd);

    if (isLunchBreak) {
        nextPeriod = todaySchedule.find(item => {
            const startStr = item.time.split('-')[0];
            return getMinutesFromTimeString(startStr) >= lunchEnd;
        });
    }

    if (activePeriod) {
        const totalDuration = activePeriod.endMins - activePeriod.startMins;
        const elapsed = currentMins - activePeriod.startMins;
        const progressPct = Math.min(100, Math.max(0, (elapsed / totalDuration) * 100));
        const minsLeft = activePeriod.endMins - currentMins;

        return `
            <div class="glass-panel p-5 rounded-[2rem] border border-[rgba(0,113,227,0.25)] bg-[rgba(0,113,227,0.03)] backdrop-blur-md relative overflow-hidden">
                <div class="absolute top-5 right-5 flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-[#00d4aa]/15 border border-[#00d4aa]/25">
                    <span class="w-1.5 h-1.5 rounded-full bg-[#00d4aa] animate-pulse"></span>
                    <span class="text-[8px] font-black text-[#00d4aa] uppercase tracking-wider">LIVE</span>
                </div>

                <div class="flex flex-col mb-3">
                    <span class="text-[9px] font-black text-[var(--mac-blue)] uppercase tracking-wider mb-1">Live Class Tracker</span>
                    <h4 class="text-sm font-black text-white leading-tight">Period ${activePeriod.period}: ${activePeriod.title}</h4>
                    <span class="text-[10px] font-bold text-[#86868b] mt-1">📍 ${activePeriod.room || 'Room 201'} • ⏱ ${activePeriod.time}</span>
                </div>

                <div class="w-full h-1.5 bg-white/5 rounded-full overflow-hidden mb-3">
                    <div class="h-full bg-[var(--mac-blue)] rounded-full transition-all duration-1000" style="width: ${progressPct}%;"></div>
                </div>

                <div class="flex justify-between items-center text-[10px] font-bold text-[#86868b]">
                    <span>${minsLeft} minutes remaining</span>
                    ${nextPeriod ? `<span>Next: ${nextPeriod.title}</span>` : `<span>Last period for today</span>`}
                </div>
            </div>
        `;
    }

    if (isLunchBreak) {
        const lunchMinsLeft = lunchEnd - currentMins;
        return `
            <div class="glass-panel p-5 rounded-[2rem] border border-orange-500/20 bg-orange-500/5 backdrop-blur-md relative overflow-hidden">
                <div class="flex items-center justify-between mb-2">
                    <span class="text-[9px] font-black text-orange-400 uppercase tracking-wider">Smart Campus</span>
                    <span class="text-xs">☕</span>
                </div>
                <h4 class="text-sm font-bold text-white">Lunch Break</h4>
                <p class="text-[10px] font-bold text-[#86868b] mt-1">Class resumes in ${lunchMinsLeft}m at 01:30 PM.</p>
                ${nextPeriod ? `<div class="mt-3 pt-3 border-t border-white/5 text-[9px] font-black text-[#86868b] uppercase tracking-wider">Next: Period ${nextPeriod.period} - ${nextPeriod.title}</div>` : ''}
            </div>
        `;
    }

    const lastPeriod = todaySchedule[todaySchedule.length - 1];
    if (lastPeriod) {
        const lastEndStr = lastPeriod.time.split('-')[1];
        const lastEndMins = getMinutesFromTimeString(lastEndStr);
        if (currentMins >= lastEndMins) {
            return `
                <div class="glass-panel p-5 rounded-[2rem] border border-white/5 bg-white/5 backdrop-blur-md relative overflow-hidden">
                    <div class="flex items-center justify-between mb-2">
                        <span class="text-[9px] font-black text-[#86868b] uppercase tracking-wider">Smart Campus</span>
                        <span class="text-xs">🌅</span>
                    </div>
                    <h4 class="text-sm font-bold text-white">Classes Over</h4>
                    <p class="text-[10px] font-bold text-[#86868b] mt-1">All classes completed for today. Have a great evening!</p>
                </div>
            `;
        }
    }

    return `
        <div class="glass-panel p-5 rounded-[2rem] border border-white/5 bg-white/5 backdrop-blur-md relative overflow-hidden">
            <div class="flex items-center justify-between mb-2">
                <span class="text-[9px] font-black text-[#86868b] uppercase tracking-wider">Smart Campus</span>
                <span class="text-xs">🕒</span>
            </div>
            <h4 class="text-sm font-bold text-white">Morning Prep</h4>
            <p class="text-[10px] font-bold text-[#86868b] mt-1">First class starts at 09:30 AM.</p>
        </div>
    `;
}

function getAttendanceSummaryHtml(adminNo) {
    return '';
}

function getPendingActivitiesHtml(adminNo) {
    return '';
}

function getLatestAnnouncementHtml() {
    return '';
}

window.renderHomepageDashboard = function() {
    /* homeDashboardContainer removed — home only shows shortcuts */
};

window.renderClassActivity = function() {
    const container = document.getElementById('classSubjectsContent');
    if (!container) return;

    const info = getStudentInfo();
    const adminNo = info?.adminNo || localStorage.getItem('machub_student_id') || '';

    if (!adminNo) {
        container.innerHTML = `
            <div class="glass-panel rounded-[2rem] p-6 text-center my-6 border border-white/5">
                <div class="text-3xl mb-3">🔑</div>
                <h3 class="text-sm font-black text-white">Admission Number Required</h3>
                <p class="text-[10px] font-bold text-[#86868b] mt-2 leading-relaxed">
                    Go to Profile → Edit and enter your Admission Number to track activities.
                </p>
            </div>`;
        return;
    }

    if (!appState.activityFilter) {
        appState.activityFilter = 'all';
    }

    const assignRaw = getPortalCache('Assignment', adminNo);
    const seminarRaw = getPortalCache('Seminar', adminNo);

    let activeAssignments = [];
    let expiredAssignments = [];
    if (assignRaw) {
        try {
            const parsed = JSON.parse(assignRaw);
            const payload = parsed?.data?.payload || parsed?.data || parsed?.payload || parsed;
            const sections = payload?.sections || [];
            const activeSection = sections.find(s => s.label === 'Active' || s.label === 'active');
            const expiredSection = sections.find(s => s.label === 'Expired' || s.label === 'expired' || s.label === 'Exprired');
            activeAssignments = activeSection?.rows || [];
            expiredAssignments = expiredSection?.rows || [];
        } catch(e) {}
    }

    let seminarRows = [];
    if (seminarRaw) {
        try {
            const parsed = JSON.parse(seminarRaw);
            const payload = parsed?.data?.payload || parsed?.data || parsed?.payload || parsed;
            const sections = payload?.sections || [];
            sections.forEach(sec => {
                if (sec.rows) seminarRows.push(...sec.rows);
            });
        } catch(e) {}
    }

    const items = [];
    
    activeAssignments.forEach(r => {
        const statusStr = String(r['Status'] || r['status'] || r['col_4'] || '').trim().toLowerCase();
        const isSubmitted = statusStr.includes('submit') || statusStr.includes('complete') || statusStr.includes('yes');
        items.push({
            type: 'assignment',
            subject: r['Subject'] || r['subject'] || r['col_1'] || 'General',
            topic: r['Topic'] || r['topic'] || r['col_2'] || 'Assignment Topic',
            date: r['Last Date'] || r['last date'] || r['LastDate'] || r['col_3'] || '—',
            status: isSubmitted ? 'submitted' : 'pending',
            score: r['Mark'] || r['mark'] || r['score'] || r['col_5'] || '—',
            isExpired: false
        });
    });

    expiredAssignments.forEach(r => {
        const statusStr = String(r['Status'] || r['status'] || r['col_4'] || '').trim().toLowerCase();
        const isSubmitted = statusStr.includes('submit') || statusStr.includes('complete') || statusStr.includes('yes');
        items.push({
            type: 'assignment',
            subject: r['Subject'] || r['subject'] || r['col_1'] || 'General',
            topic: r['Topic'] || r['topic'] || r['col_2'] || 'Assignment Topic',
            date: r['Last Date'] || r['last date'] || r['LastDate'] || r['col_3'] || '—',
            status: isSubmitted ? 'submitted' : 'expired',
            score: r['Mark'] || r['mark'] || r['score'] || r['col_5'] || '—',
            isExpired: true
        });
    });

    seminarRows.forEach(r => {
        const statusStr = String(r['Status'] || r['status'] || r['col_4'] || '').trim().toLowerCase();
        const isCompleted = statusStr.includes('complete') || statusStr.includes('submit') || statusStr.includes('present') || statusStr.includes('yes') || statusStr.includes('completed');
        items.push({
            type: 'seminar',
            subject: r['Subject'] || r['subject'] || r['col_1'] || 'General',
            topic: r['Topic'] || r['topic'] || r['col_2'] || 'Seminar Presentation',
            date: r['Date'] || r['date'] || r['col_3'] || '—',
            status: isCompleted ? 'submitted' : 'pending',
            score: r['Score'] || r['score'] || r['Mark'] || r['mark'] || r['col_5'] || '—',
            isExpired: false
        });
    });

    let isDemo = false;
    if (items.length === 0) {
        isDemo = true;
        items.push({
            type: 'assignment',
            subject: 'Java Programming',
            topic: 'Write a multithreaded chat server using sockets',
            date: 'Tomorrow, 5:00 PM',
            status: 'pending',
            score: '—',
            isExpired: false
        });
        items.push({
            type: 'seminar',
            subject: 'Database Systems',
            topic: 'NoSQL vs Relational Databases performance study',
            date: '3 days ago',
            status: 'submitted',
            score: '9.5 / 10',
            isExpired: false
        });
        items.push({
            type: 'assignment',
            subject: 'Python Programming',
            topic: 'Implement a REST API using Flask and SQLAlchemy',
            date: 'Expired yesterday',
            status: 'expired',
            score: '—',
            isExpired: true
        });
        items.push({
            type: 'seminar',
            subject: 'Computer Networks',
            topic: 'TCP Congestion Control Algorithms overview',
            date: 'Last week',
            status: 'submitted',
            score: '8.0 / 10',
            isExpired: false
        });
    }

    const totalCount = items.length;
    const pendingCount = items.filter(i => i.status === 'pending').length;
    const completedCount = items.filter(i => i.status === 'submitted').length;

    const statsHtml = `
        <div class="grid grid-cols-3 gap-2 mb-4 w-full">
            <div class="glass-panel p-3 rounded-2xl border border-white/5 text-center bg-white/5 backdrop-blur-md">
                <span class="text-[8px] font-black text-[#86868b] uppercase tracking-wider block">Total</span>
                <span class="text-sm font-black text-white mt-0.5 block">${totalCount}</span>
            </div>
            <div class="glass-panel p-3 rounded-2xl border border-white/5 text-center bg-white/5 backdrop-blur-md">
                <span class="text-[8px] font-black text-[#86868b] uppercase tracking-wider block">Pending</span>
                <span class="text-sm font-black text-orange-400 mt-0.5 block">${pendingCount}</span>
            </div>
            <div class="glass-panel p-3 rounded-2xl border border-white/5 text-center bg-white/5 backdrop-blur-md">
                <span class="text-[8px] font-black text-[#86868b] uppercase tracking-wider block">Done</span>
                <span class="text-sm font-black text-[#00d4aa] mt-0.5 block">${completedCount}</span>
            </div>
        </div>
    `;

    const demoBannerHtml = isDemo ? `
        <div class="glass-panel p-4 rounded-[2rem] border border-orange-500/20 bg-orange-500/5 backdrop-blur-md mb-5 flex flex-col gap-2">
            <div class="flex items-center gap-2">
                <span class="text-lg">✨</span>
                <h4 class="text-xs font-black text-white">Showing Demo Preview</h4>
            </div>
            <p class="text-[9px] font-bold text-[#86868b] leading-normal">
                Your assignments and seminars are currently empty. Sync from ePortal to view your actual data.
            </p>
            <button onclick="window.syncAndOpenNative('Assignment', 'view-class', 'subjects')" class="mt-1 w-full py-2 bg-[var(--mac-blue)] text-white rounded-full text-[10px] font-black uppercase tracking-wider spring active:scale-95">
                🔄 Sync ePortal Data
            </button>
        </div>
    ` : '';

    const filtered = items.filter(item => {
        if (appState.activityFilter === 'all') return true;
        return item.type === appState.activityFilter;
    });

    const segmentsHtml = `
        <div class="flex bg-black/10 dark:bg-white/5 p-1 rounded-2xl gap-1 border border-white/5 mb-5 w-full">
            <button type="button" onclick="window.switchActivityFilter('all')" class="flex-1 py-2 text-[10px] font-black uppercase tracking-wider rounded-xl transition-all ${appState.activityFilter === 'all' ? 'bg-[var(--mac-blue)] text-white shadow-md' : 'text-[#86868b] hover:text-white'}">All</button>
            <button type="button" onclick="window.switchActivityFilter('assignment')" class="flex-1 py-2 text-[10px] font-black uppercase tracking-wider rounded-xl transition-all ${appState.activityFilter === 'assignment' ? 'bg-[var(--mac-blue)] text-white shadow-md' : 'text-[#86868b] hover:text-white'}">Assignments</button>
            <button type="button" onclick="window.switchActivityFilter('seminar')" class="flex-1 py-2 text-[10px] font-black uppercase tracking-wider rounded-xl transition-all ${appState.activityFilter === 'seminar' ? 'bg-[var(--mac-blue)] text-white shadow-md' : 'text-[#86868b] hover:text-white'}">Seminars</button>
        </div>
    `;

    let listHtml = '';
    if (filtered.length === 0) {
        listHtml = `
            <div class="glass-panel rounded-[2rem] p-8 text-center my-6 border border-white/5">
                <p class="text-xs font-bold text-[#86868b]">No records matching the selected filter.</p>
            </div>`;
    } else {
        listHtml = filtered.map(item => {
            const isSubmitted = item.status === 'submitted';
            const isExpired = item.status === 'expired';
            
            let statusBadge = '';
            if (isSubmitted) {
                statusBadge = `<span class="px-2 py-0.5 rounded-full bg-[#00d4aa]/15 text-[#00d4aa] text-[8px] font-black uppercase tracking-wider">✓ Done</span>`;
            } else if (isExpired) {
                statusBadge = `<span class="px-2 py-0.5 rounded-full bg-red-500/10 text-red-400 text-[8px] font-black uppercase tracking-wider">⚠️ Expired</span>`;
            } else {
                statusBadge = `<span class="px-2 py-0.5 rounded-full bg-orange-500/15 text-orange-400 text-[8px] font-black uppercase tracking-wider">⏱ Pending</span>`;
            }

            const borderClass = item.type === 'assignment' ? 'border-l-[4px] border-l-[#0071e3]/60' : 'border-l-[4px] border-l-rose-500/60';
            const typeLabel = item.type === 'assignment' ? 'Assignment' : 'Seminar';

            return `
                <div class="glass-panel p-5 rounded-[2rem] border border-white/5 bg-white/5 backdrop-blur-md relative overflow-hidden flex flex-col gap-2 ${borderClass}">
                    <div class="flex justify-between items-start gap-3">
                        <div class="flex-1 min-w-0">
                            <span class="text-[8px] font-black text-[#86868b] uppercase tracking-wider block">${typeLabel} • ${item.subject}</span>
                            <h4 class="text-xs font-black text-white mt-0.5 leading-snug line-clamp-2">${item.topic}</h4>
                        </div>
                        ${statusBadge}
                    </div>
                    
                    <div class="flex justify-between items-center mt-2 pt-2 border-t border-white/5 text-[9px] font-bold text-[#86868b]">
                        <span>${item.type === 'assignment' ? 'Due:' : 'Date:'} ${item.date}</span>
                        ${item.score && item.score !== '—' && item.score !== '' ? `<span class="text-[var(--mac-blue)]">Score: ${item.score}</span>` : ''}
                    </div>
                </div>
            `;
        }).join('');
    }

    container.innerHTML = window.getFreshnessIndicatorHtml(appState.activityFilter === 'seminar' ? 'Seminar' : 'Assignment') + demoBannerHtml + statsHtml + segmentsHtml + listHtml;
};

window.renderClassSubjects = window.renderClassActivity;

window.switchActivityFilter = function(filter) {
    appState.activityFilter = filter;
    window.renderClassActivity();
};

window.initExamHubApp = () => {
    autoUpdateSemesterFromCache();
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

    const storedClassSubTab = localStorage.getItem('machub_class_sub_tab');
    if (storedClassSubTab && typeof window.switchClassTab === 'function') {
        window.switchClassTab(storedClassSubTab);
    } else if (typeof window.switchClassTab === 'function') {
        window.switchClassTab('timetable');
    }

    // Restore persisted view or default to view-home
    const persistedView = localStorage.getItem('machub_current_view');
    let targetView = 'view-home';
    if (persistedView) {
        if (['view-timetable', 'view-seats', 'view-results'].includes(persistedView)) {
            targetView = persistedView;
        } else {
            const panel = document.getElementById(persistedView);
            if (panel && panel.classList.contains('view-panel')) {
                targetView = persistedView;
            }
        }
    }

    if (targetView === 'view-ai' && typeof window.openMacAI === 'function') {
        window.openMacAI();
    } else if (targetView === 'view-profile-edit' && typeof window.openEditProfile === 'function') {
        window.openEditProfile();
    } else if (targetView.startsWith('view-settings')) {
        if (typeof window.openSettingsTray === 'function') {
            window.openSettingsTray();
        }
        if (targetView !== 'view-settings') {
            switchView(targetView);
            if (targetView === 'view-settings-synced-data' && typeof window.updateSyncedDataSizes === 'function') {
                window.updateSyncedDataSizes();
            } else if (targetView === 'view-settings-allotment-memo' && typeof window.loadAllotmentMemoData === 'function') {
                window.loadAllotmentMemoData();
            } else if (targetView === 'view-settings-hall-ticket' && typeof window.loadHallTicketData === 'function') {
                window.loadHallTicketData();
            } else if (targetView === 'view-settings-fee-payment' && typeof window.loadFeePaymentData === 'function') {
                window.loadFeePaymentData();
            } else if (targetView === 'view-settings-grievance' && typeof window.loadGrievancePortalData === 'function') {
                window.loadGrievancePortalData();
            } else if (targetView === 'view-settings-concession' && typeof window.loadConcessionPortalData === 'function') {
                window.loadConcessionPortalData();
            } else if (targetView === 'view-settings-feedback' && typeof window.loadFeedbackData === 'function') {
                window.loadFeedbackData();
            }
        }
    } else {
        switchView(targetView);
    }
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
            renderClassSubjects();
            renderClassAttendance();
        }
        if (appState.openInternalDropdown) {
            appState.openInternalDropdown = null;
            window.renderExamResults();
        }
    }
});

// ── Freshness Indicators & Celebration Overlay ────────────────────────────────

window.getFreshnessIndicatorHtml = function(section, semester = '') {
    const adminNo = window.ExamHubProfile?.get()?.adminNo || window.getStudentInfo?.()?.adminNo || localStorage.getItem('machub_student_id') || '';
    if (!adminNo) return '';

    let raw = null;
    let targetSem = semester;
    
    if (!targetSem || targetSem === 'all') {
        let maxSavedAt = 0;
        let bestRaw = null;
        for (let sem = 1; sem <= 8; sem++) {
            const key = `machub_portal_${section}_sem${sem}_${adminNo}`;
            const val = localStorage.getItem(key);
            if (val) {
                try {
                    const parsed = JSON.parse(val);
                    if (parsed.savedAt > maxSavedAt) {
                        maxSavedAt = parsed.savedAt;
                        bestRaw = val;
                    }
                } catch(e) {}
            }
        }
        if (bestRaw) {
            raw = bestRaw;
        } else {
            const key = `machub_portal_${section}_${adminNo}`;
            raw = localStorage.getItem(key);
        }
    } else {
        const semSuffix = `_sem${targetSem}`;
        const cacheKey = `machub_portal_${section}${semSuffix}_${adminNo}`;
        raw = localStorage.getItem(cacheKey);
    }
    
    if (!raw) {
        const cacheKey = `machub_portal_${section}_${adminNo}`;
        raw = localStorage.getItem(cacheKey);
    }

    let indicatorColor = 'bg-slate-500';
    let indicatorText = 'Not yet available';
    let isFrozen = false;
    let savedAt = 0;

    if (raw) {
        try {
            const parsed = JSON.parse(raw);
            savedAt = parsed.savedAt || 0;
            const data = parsed.data || {};
            if (section === 'ExamResult' && data) {
                isFrozen = true;
            }
        } catch (e) {
            console.error(e);
        }
    }

    if (savedAt) {
        const diffMs = Date.now() - savedAt;
        const diffMin = Math.floor(diffMs / 60000);
        const diffHrs = Math.floor(diffMin / 60);

        if (diffMin < 5) {
            indicatorColor = 'bg-green-500';
            indicatorText = 'Live';
        } else if (diffMin < 60) {
            indicatorColor = 'bg-yellow-500 animate-pulse';
            indicatorText = `${diffMin} min ago`;
        } else if (diffHrs < 24) {
            indicatorColor = 'bg-yellow-500';
            indicatorText = `${diffHrs} hr${diffHrs > 1 ? 's' : ''} ago`;
        } else {
            const dateStr = new Date(savedAt).toLocaleDateString();
            indicatorColor = 'bg-slate-500';
            indicatorText = `Cached ${dateStr}`;
        }
    }

    if (isFrozen) {
        indicatorColor = 'bg-indigo-500';
        indicatorText = '🔒 Verified record';
    }

    return `
        <div class="freshness-indicator-pill flex items-center gap-1.5 px-3 py-1.5 rounded-full text-[9px] font-extrabold bg-white/5 border border-white/5 text-[#86868b] transition-all duration-300 w-fit mb-3"
             data-section="${section}" data-semester="${semester || ''}" data-saved-at="${savedAt}">
            <span class="w-1.5 h-1.5 rounded-full ${indicatorColor}"></span>
            <span>${indicatorText}</span>
        </div>
    `;
};

window.showExamResultCelebration = function(resultsData) {
    const student = window.getStudentInfo?.();
    const semester = resultsData?.semester || student?.semester || 'Active Semester';
    const semKey = String(semester).replace(/\s+/g, '_');
    
    // Prevent duplicate display
    if (localStorage.getItem(`machub_exam_result_celebration_shown_${semKey}`) === 'true') {
        return;
    }

    const overlay = document.getElementById('examResultCelebrationOverlay');
    const card = document.getElementById('examResultCelebrationCard');
    
    // Populate details
    const nameEl = document.getElementById('celebStudentName');
    if (nameEl) nameEl.textContent = student?.name || student?.studentName || 'Student';

    const semEl = document.getElementById('celebSemester');
    if (semEl) semEl.textContent = semester;

    let status = 'PASS';
    let sgpa = '--';

    try {
        const subjects = resultsData?.subjects || resultsData?.rows || [];
        let hasFail = false;
        
        subjects.forEach(sub => {
            const grade = sub.grade || sub.Grade || sub.col_5 || '';
            if (grade.toUpperCase() === 'F' || grade.toUpperCase() === 'FAIL' || grade.toUpperCase() === 'AB') {
                hasFail = true;
            }
        });

        if (hasFail) {
            status = 'FAIL';
            const statusEl = document.getElementById('celebStatus');
            if (statusEl) {
                statusEl.textContent = 'FAIL';
                statusEl.className = 'text-xl font-black text-red-500 mt-1';
            }
        } else {
            status = 'PASS';
            const statusEl = document.getElementById('celebStatus');
            if (statusEl) {
                statusEl.textContent = 'PASS';
                statusEl.className = 'text-xl font-black text-green-400 mt-1';
            }
        }

        sgpa = resultsData?.sgpa || resultsData?.SGPA || resultsData?.creditPoint || '--';
        const sgpaEl = document.getElementById('celebSgpa');
        if (sgpaEl) sgpaEl.textContent = sgpa;
    } catch (e) {
        console.error('Failed to parse exam results for celebration:', e);
    }

    if (overlay && card) {
        overlay.classList.remove('hidden');
        overlay.classList.add('flex');
        setTimeout(() => {
            card.classList.remove('scale-90', 'opacity-0');
            card.classList.add('scale-100', 'opacity-1');
        }, 50);
    }
};

window.dismissCelebrationOverlay = function(action) {
    const overlay = document.getElementById('examResultCelebrationOverlay');
    const card = document.getElementById('examResultCelebrationCard');
    const semester = document.getElementById('celebSemester')?.textContent || 'UNKNOWN';
    const semKey = semester.replace(/\s+/g, '_');
    
    // Mark as shown locally immediately
    localStorage.setItem(`machub_exam_result_celebration_shown_${semKey}`, 'true');

    if (overlay && card) {
        card.classList.remove('scale-100', 'opacity-1');
        card.classList.add('scale-90', 'opacity-0');
        setTimeout(() => {
            overlay.classList.add('hidden');
            overlay.classList.remove('flex');
        }, 300);
    }
    
    // Save to Firestore to prevent showing again on other devices
    const student = window.getStudentInfo?.();
    const adminNo = student?.adminNo || student?.admissionNo || localStorage.getItem('machub_student_id') || '';
    if (window.firebaseFirestore && window.firestoreDoc && window.firestoreSetDoc && adminNo) {
        const docRef = window.firestoreDoc(window.firebaseFirestore, 'students', adminNo);
        window.firestoreSetDoc(docRef, {
            notifications: {
                [`examResultShown_${semKey}`]: {
                    shown: true,
                    shownAt: new Date().toISOString()
                }
            }
        }, { merge: true }).catch(err => {
            console.warn('Failed to save notification state to Firestore:', err);
        });
    }

    if (action === 'view') {
        if (typeof window.switchView === 'function') {
            window.switchView('view-results');
        }
    }
};

// Start refresh timer for freshness indicator pills
setInterval(() => {
    document.querySelectorAll('.freshness-indicator-pill').forEach(el => {
        const section = el.getAttribute('data-section');
        const semester = el.getAttribute('data-semester');
        const savedAt = parseInt(el.getAttribute('data-saved-at') || '0', 10);
        if (!savedAt) return;

        const isFrozen = (section === 'ExamResult');

        const diffMs = Date.now() - savedAt;
        const diffMin = Math.floor(diffMs / 60000);
        const diffHrs = Math.floor(diffMin / 60);

        let indicatorColor = 'bg-slate-500';
        let indicatorText = 'Not yet available';

        if (diffMin < 5) {
            indicatorColor = 'bg-green-500';
            indicatorText = 'Live';
        } else if (diffMin < 60) {
            indicatorColor = 'bg-yellow-500 animate-pulse';
            indicatorText = `${diffMin} min ago`;
        } else if (diffHrs < 24) {
            indicatorColor = 'bg-yellow-500';
            indicatorText = `${diffHrs} hr${diffHrs > 1 ? 's' : ''} ago`;
        } else {
            const dateStr = new Date(savedAt).toLocaleDateString();
            indicatorColor = 'bg-slate-500';
            indicatorText = `Cached ${dateStr}`;
        }

        if (isFrozen) {
            indicatorColor = 'bg-indigo-500';
            indicatorText = '🔒 Verified record';
        }

        const dot = el.querySelector('span:first-child');
        const txt = el.querySelector('span:last-child');
        if (dot && txt) {
            dot.className = `w-1.5 h-1.5 rounded-full ${indicatorColor}`;
            txt.textContent = indicatorText;
        }
    });
}, 60000);

