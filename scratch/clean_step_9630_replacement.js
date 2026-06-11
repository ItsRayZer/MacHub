"    } else {
        // Internal marks subtab (renders both final university internals & monthly continuous assessments)
        const activeSem = appState.selectedInternalSem || String(getStudentSemNumber());
        const internalRaw = getPortalCache('InternalMark', adminNo, activeSem);
        const assessRaw = getPortalCache('Assessment', adminNo, activeSem);

        if (!appState.internalFetchStatus) {
            appState.internalFetchStatus = {};
        }

        const fetchStatus = appState.internalFetchStatus[activeSem];

        // 1. If not fetched yet and no cached data, show skeleton and trigger fetch
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
                <div class="space-y-4 animate-pulse">
                    <div class="glass-panel rounded-[2rem] p-6 border border-white/5 h-28 bg-white/5"></div>
                    <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div class="glass-panel rounded-[2rem] p-6 border border-white/5 h-5
<truncated 20419 bytes>