};

window.switchInternalSemester = function (sem) {
    appState.selectedInternalSem = sem;
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

window.switchBcaResultsTab = function (tab) {
    appState.bcaSubTab = tab;
    window.renderExamResults();
};