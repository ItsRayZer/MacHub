"window.renderExamResults = function () {
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

    const examRaw = getPortalCache('ExamResult', adminNo);
    const assessRaw = getPortalCache('Assessment', adminNo);
    const internalRaw = getPortalCache('InternalMark', adminNo);

    // Pill tab switch header
    let headerHtml = `
        <div class="flex justify-center mb-6">
            <div class="bg-black/10 dark:bg-white/5 p-1 rounded-2xl flex gap-1 border border-white/5">
                <button onclick="window.switchResultsSubTab('exam')" class="px-5 py-2 text-[10px] font-black uppercase tracking-wider rounded-xl transition-all ${appState.resultsSubTab === 'exam' ? 'bg-[var(--mac-blue)] text-white shadow-md' : 'text-[#86868b] hover:text-white'}">
                    🏆 University Exams
                </button>
                <button onclick="window.switchResultsSubTab('internal')" class="px-5 py-2 text-[10px] font-black uppercase tracking-wider rounded-xl transition-all ${appState.resultsSubTab === 'internal' ? 'bg-[var(--mac-blue)] text-white shadow-md' : 'text-[#86868b] hover:text-white'}">
                    📝 Internal Marks
                </button>
            </di
<truncated 53038 bytes>