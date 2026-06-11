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