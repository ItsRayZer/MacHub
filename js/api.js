(function() {
    const API_URL = 'https://mac-data-sync-1.onrender.com/sync-deep-live';
    let isSyncing = false;

    async function startBackgroundSync() {
        const info = window.ExamHubProfile?.get() || window.getStudentInfo?.();
        if (!info || !info.adminNo) {
            console.log('Background Sync: No Admin No provided.');
            return;
        }

        if (isSyncing) return;
        isSyncing = true;
        window.syncStartTime = Date.now();
        console.log('Background Sync: Started for Admin No', info.adminNo);

        try {
            try {
                localStorage.removeItem('mac_academic_error');
            } catch (e) { console.warn('localStorage is restricted', e); }
            const response = await fetch(API_URL, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({ adminNo: info.adminNo })
            });

            if (!response.ok) {
                const errorData = await response.json().catch(() => ({}));
                throw new Error(errorData.message || 'Scraping Failed');
            }

            const data = await response.json();
            try {
                localStorage.setItem('mac_academic_data', JSON.stringify(data));
            } catch (e) { console.warn('localStorage is restricted', e); }
            console.log('Background Sync: Completed successfully.', data);

            // If the academic sheet is open, refresh it
            if (window.renderAcademicData) {
                window.renderAcademicData();
            }

        } catch (error) {
            console.error('Background Sync Error:', error.message);
            isSyncing = false; // Reset before rendering
            try {
                localStorage.setItem('mac_academic_error', error.message);
            } catch (e) { console.warn('localStorage is restricted', e); }
            if (window.renderAcademicData) {
                window.renderAcademicData();
            }
        } finally {
            isSyncing = false;
        }
    }

    // Attempt to sync automatically when the app loads
    setTimeout(() => {
        startBackgroundSync();
    }, 5000); // 5 seconds after load to prevent blocking main thread
    
    // Attempt sync every 1 hour if the app stays open
    setInterval(() => {
        startBackgroundSync();
    }, 3600 * 1000);

    window.startBackgroundSync = startBackgroundSync;

    // ----- UI Integration -----
    
    window.openAcademicSheet = function() {
        const sheet = document.getElementById('academicSheet');
        const backdrop = document.getElementById('academicBackdrop');
        if (sheet) sheet.classList.remove('translate-y-full');
        if (backdrop) backdrop.classList.remove('hidden');
        
        renderAcademicData();
    };

    window.closeAcademicSheet = function() {
        const sheet = document.getElementById('academicSheet');
        const backdrop = document.getElementById('academicBackdrop');
        if (sheet) sheet.classList.add('translate-y-full');
        if (backdrop) backdrop.classList.add('hidden');
    };

    window.renderAcademicData = function() {
        const contentEl = document.getElementById('academicContent');
        if (!contentEl) return;

        const info = window.ExamHubProfile?.get() || window.getStudentInfo?.();
        if (!info || !info.adminNo) {
            contentEl.innerHTML = `
                <div class="glass-panel p-6 text-center rounded-[2rem]">
                    <div class="w-12 h-12 bg-black/5 dark:bg-white/5 rounded-full flex items-center justify-center text-2xl mx-auto mb-4">⚙️</div>
                    <p class="text-sm font-bold text-[#1d1d1f] dark:text-[#f5f5f7]">Admin No Required</p>
                    <p class="text-[10px] font-bold text-[#86868b] mt-2">Please go to Edit Profile and enter your Admin No to sync your attendance and internal marks.</p>
                </div>
            `;
            return;
        }

        let dataStr = null;
        let errorStr = null;
        try {
            dataStr = localStorage.getItem('mac_academic_data');
            errorStr = localStorage.getItem('mac_academic_error');
        } catch (e) {
            console.warn('localStorage is restricted', e);
        }

        if (!dataStr) {
            if (isSyncing) {
                const elapsed = window.syncStartTime ? (Date.now() - window.syncStartTime) : 0;
                const syncText = elapsed > 15000 
                    ? "Waking up the cloud server. This can take up to 2 minutes on the first request of the day..."
                    : "Extracting your latest academic records from the portal in the background...";

                contentEl.innerHTML = `
                    <div class="glass-panel p-6 text-center rounded-[2rem]">
                        <div class="w-10 h-10 border-4 border-[var(--mac-blue)]/30 border-t-[var(--mac-blue)] rounded-full animate-spin mx-auto mb-4"></div>
                        <p class="text-sm font-bold text-[#1d1d1f] dark:text-[#f5f5f7]">Syncing Data</p>
                        <p class="text-[10px] font-bold text-[#86868b] mt-2">${syncText}</p>
                    </div>
                `;
                // Re-render to update the text if it's still syncing
                setTimeout(() => { if(isSyncing && window.renderAcademicData) window.renderAcademicData(); }, 5000);
            } else if (errorStr) {
                contentEl.innerHTML = `
                    <div class="glass-panel p-6 text-center rounded-[2rem] border border-red-500/20">
                        <div class="w-12 h-12 bg-red-500/10 text-red-500 rounded-full flex items-center justify-center text-2xl mx-auto mb-4">⚠️</div>
                        <p class="text-sm font-bold text-[#1d1d1f] dark:text-[#f5f5f7]">Sync Failed</p>
                        <p class="text-[10px] font-bold text-[#86868b] mt-2">${errorStr}</p>
                        <button onclick="try { localStorage.removeItem('mac_academic_error'); } catch(e){} window.startBackgroundSync(); window.renderAcademicData();" class="mt-4 px-6 py-2 bg-black/5 dark:bg-white/10 rounded-full text-xs font-bold spring">Retry</button>
                    </div>
                `;
            } else {
                contentEl.innerHTML = `
                    <div class="glass-panel p-6 text-center rounded-[2rem]">
                        <p class="text-sm font-bold text-[#1d1d1f] dark:text-[#f5f5f7]">No Data Yet</p>
                        <p class="text-[10px] font-bold text-[#86868b] mt-2">Data sync is queued. Please check back in a few minutes.</p>
                        <button onclick="window.startBackgroundSync(); window.renderAcademicData();" class="mt-4 px-6 py-2 bg-black/5 dark:bg-white/10 rounded-full text-xs font-bold spring">Sync Now</button>
                    </div>
                `;
            }
            return;
        }

        try {
            const data = JSON.parse(dataStr);
            const attendance = data.attendance || [];
            const marks = data.internalMarks || [];
            const lastSyncDate = new Date(data.timestamp).toLocaleString('en-IN', { hour: '2-digit', minute: '2-digit', day: 'numeric', month: 'short' });

            let html = `<p class="text-[10px] font-black text-[#86868b] uppercase tracking-widest text-center mb-4">Last Synced: ${lastSyncDate}</p>`;

            // Attendance Section
            if (attendance.length > 0) {
                html += `
                    <div class="mb-6">
                        <h4 class="text-xs font-black text-[var(--mac-blue)] uppercase tracking-widest mb-3">Attendance</h4>
                        <div class="space-y-3">
                `;
                attendance.forEach(item => {
                    // Try to parse the percentage, or default to 0
                    const percNum = parseFloat(item.percentage) || 0;
                    const isLow = percNum < 75;
                    const percColor = isLow ? 'text-red-500' : 'text-[#1d1d1f] dark:text-[#f5f5f7]';
                    const ringColor = isLow ? 'border-red-500' : 'border-[var(--mac-blue)]';
                    
                    html += `
                        <div class="glass-panel p-4 rounded-2xl flex items-center justify-between gap-4">
                            <div class="flex-1 min-w-0">
                                <p class="text-sm font-bold text-[#1d1d1f] dark:text-[#f5f5f7] truncate">${item.subjectName}</p>
                                <p class="text-[10px] font-bold text-[#86868b] mt-1">${item.presentHours} / ${item.totalHours} Hours</p>
                            </div>
                            <div class="w-12 h-12 rounded-full border-4 ${ringColor} border-t-transparent flex items-center justify-center relative flex-shrink-0">
                                <span class="text-[10px] font-black ${percColor}">${Math.round(percNum)}%</span>
                            </div>
                        </div>
                    `;
                });
                html += `</div></div>`;
            }

            // Internal Marks Section
            if (marks.length > 0) {
                html += `
                    <div>
                        <h4 class="text-xs font-black text-[var(--mac-blue)] uppercase tracking-widest mb-3">Internal Marks</h4>
                        <div class="grid grid-cols-2 gap-3">
                `;
                marks.forEach(item => {
                    html += `
                        <div class="glass-panel p-4 rounded-2xl flex flex-col justify-between">
                            <p class="text-[10px] font-bold text-[#86868b] line-clamp-2 leading-tight mb-2">${item.subject}</p>
                            <p class="text-lg font-black tracking-tight text-[var(--mac-blue)]">${item.mark}</p>
                        </div>
                    `;
                });
                html += `</div></div>`;
            }

            if (attendance.length === 0 && marks.length === 0) {
                html += `
                    <div class="glass-panel p-6 text-center rounded-[2rem]">
                        <p class="text-sm font-bold text-[#86868b]">No attendance or marks found in the portal.</p>
                    </div>
                `;
            }

            if (errorStr) {
                html += `<p class="text-[9px] font-bold text-red-500 mt-4 text-center">Background sync failed last time: ${errorStr}</p>`;
            }

            contentEl.innerHTML = html;

        } catch (e) {
            contentEl.innerHTML = `<p class="text-sm font-bold text-red-500">Error reading data. Please clear cache and try again.</p>`;
        }
    };

})();
