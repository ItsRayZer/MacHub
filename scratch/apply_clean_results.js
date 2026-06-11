const fs = require('fs');
const path = require('path');

const appJsPath = path.resolve(__dirname, '../js/app.js');
const cleanResultsPath = path.resolve(__dirname, 'clean_results.js');

if (!fs.existsSync(appJsPath)) {
    console.error('js/app.js not found!');
    process.exit(1);
}

if (!fs.existsSync(cleanResultsPath)) {
    console.error('clean_results.js not found!');
    process.exit(1);
}

// Read and normalize file line endings to \n
let appJsContent = fs.readFileSync(appJsPath, 'utf8').replace(/\r\n/g, '\n');
const cleanResultsLines = fs.readFileSync(cleanResultsPath, 'utf8').replace(/\r\n/g, '\n').split('\n');

// 1. Target switchExamTab block to replace
const oldSwitchExamTab = `window.switchExamTab = function(tab) {
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
};`.replace(/\r\n/g, '\n');

const newSwitchExamTab = `window.switchExamTab = function(tab) {
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
};`.replace(/\r\n/g, '\n');

if (!appJsContent.includes(oldSwitchExamTab)) {
    console.error('Could not find old switchExamTab in js/app.js!');
    // Let's print a part of appJsContent around where "switchExamTab" is to see what's wrong.
    const index = appJsContent.indexOf('window.switchExamTab');
    if (index !== -1) {
        console.error('Found switchExamTab at index:', index);
        console.error('Context:', JSON.stringify(appJsContent.substring(index, index + 300)));
    } else {
        console.error('Could not find switchExamTab at all!');
    }
    process.exit(1);
}

appJsContent = appJsContent.replace(oldSwitchExamTab, newSwitchExamTab);
console.log('1. Updated window.switchExamTab');

// 2. Extract lines 39 to the end of clean_results.js (index 38 onwards)
const restOfResultsCode = cleanResultsLines.slice(38).join('\n');

const initAppTarget = 'window.initExamHubApp = () => {';
if (!appJsContent.includes(initAppTarget)) {
    console.error('Could not find window.initExamHubApp in js/app.js!');
    process.exit(1);
}

// Insert the rest of the results functions before initExamHubApp
appJsContent = appJsContent.replace(initAppTarget, restOfResultsCode + '\n\n' + initAppTarget);
console.log('2. Inserted Exam Results rendering functions');

// 3. Update the click event listener
const oldClickListener = `document.addEventListener('click', (event) => {
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
});`.replace(/\r\n/g, '\n');

const newClickListener = `document.addEventListener('click', (event) => {
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
});`.replace(/\r\n/g, '\n');

if (!appJsContent.includes(oldClickListener)) {
    console.error('Could not find old click listener in js/app.js!');
    const clickIdx = appJsContent.indexOf("document.addEventListener('click'");
    if (clickIdx !== -1) {
        console.error('Found click listener at:', clickIdx);
        console.error('Context:', JSON.stringify(appJsContent.substring(clickIdx, clickIdx + 400)));
    }
    process.exit(1);
}

appJsContent = appJsContent.replace(oldClickListener, newClickListener);
fs.writeFileSync(appJsPath, appJsContent, 'utf8');
console.log('3. Successfully updated click event listener and wrote updated js/app.js');
