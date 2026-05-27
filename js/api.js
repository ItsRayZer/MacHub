(function() {
    // Configurable Cloudflare Worker endpoint
    const CLOUDFLARE_WORKER_URL = 'https://machin-refresh.mrabensojan.workers.dev';
    
    let isSyncing = false;
    let currentListeningAdmin = null;
    let dbUnsubscribe = null;

    // Realtime Database listener setup
    function setupFirebaseListener(adminNo) {
        if (dbUnsubscribe) {
            dbUnsubscribe();
            dbUnsubscribe = null;
        }

        if (!adminNo) return;

        // If firebase references aren't initialized yet, retry in 500ms
        if (!window.firebaseDb || !window.firebaseDbOnValue || !window.firebaseDbRef) {
            setTimeout(() => setupFirebaseListener(adminNo), 500);
            return;
        }

        const studentRef = window.firebaseDbRef(window.firebaseDb, `/students/${adminNo}`);
        console.log(`[MacHub API] Listening to Realtime DB path /students/${adminNo}`);

        dbUnsubscribe = window.firebaseDbOnValue(studentRef, (snapshot) => {
            const data = snapshot.val();
            if (data) {
                console.log("[MacHub API] Firebase Realtime DB data updated:", data);
                try {
                    localStorage.setItem('mac_academic_data', JSON.stringify(data));
                    localStorage.removeItem('mac_academic_error');
                } catch (e) { console.warn('localStorage is restricted', e); }
                
                // If syncing was in progress, stop the spinner since we got the data
                isSyncing = false;

                // Re-render UI
                if (window.renderAcademicData) {
                    window.renderAcademicData();
                }
            }
        }, (error) => {
            console.error("[MacHub API] Firebase Realtime DB listener error:", error);
        });
    }

    async function startBackgroundSync() {
        const info = window.ExamHubProfile?.get() || window.getStudentInfo?.();
        if (!info || !info.adminNo) {
            console.log('Background Sync: No Admin No provided.');
            return;
        }

        // Set up real-time listener if we haven't already for this student
        if (currentListeningAdmin !== info.adminNo) {
            currentListeningAdmin = info.adminNo;
            setupFirebaseListener(info.adminNo);
        }

        if (isSyncing) return;
        isSyncing = true;
        window.syncStartTime = Date.now();
        console.log('Background Sync: Triggering refresh via Cloudflare Worker for Admin No', info.adminNo);

        try {
            try {
                localStorage.removeItem('mac_academic_error');
            } catch (e) { console.warn('localStorage is restricted', e); }

            if (window.renderAcademicData) {
                window.renderAcademicData();
            }

            const response = await fetch(CLOUDFLARE_WORKER_URL, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({ admission_no: info.adminNo })
            });

            if (!response.ok) {
                const errorData = await response.json().catch(() => ({}));
                throw new Error(errorData.error || `HTTP error ${response.status}`);
            }

            const resData = await response.json();
            console.log('Background Sync: Triggered successfully.', resData.message);

            // Note: The UI stays in isSyncing state (showing the spinner) while we wait for GitHub Actions
            // to scrape the portal and update Firebase. Once Firebase updates, our firebaseDbOnValue
            // listener above will receive the new data, write it to localStorage, and reset isSyncing to false.

        } catch (error) {
            console.error('Background Sync Error:', error.message);
            isSyncing = false; // Reset since the trigger itself failed
            try {
                localStorage.setItem('mac_academic_error', error.message);
            } catch (e) { console.warn('localStorage is restricted', e); }
            if (window.renderAcademicData) {
                window.renderAcademicData();
            }
        }
    }

    // Attempt to sync automatically when the app loads
    setTimeout(() => {
        startBackgroundSync();
    }, 3000); // 3 seconds after load to prevent blocking main thread
    
    // Attempt sync every 1 hour if the app stays open
    setInterval(() => {
        startBackgroundSync();
    }, 3600 * 1000);

    window.startBackgroundSync = startBackgroundSync;

    // ----- UI Integration -----
    
    window.openAcademicSheet = function() {
        const sheet = document.getElementById('academicSheet');
        const backdrop = document.getElementById('academicBackdrop');
        
        if (window.initDraggableSheet) {
            window.initDraggableSheet('academicSheet', 'academicSheetDragHandle', closeAcademicSheetState);
        }
        if (sheet && window.snapSheetOpen) {
            window.snapSheetOpen(sheet);
        } else if (sheet) {
            sheet.classList.remove('translate-y-full');
        }
        
        if (backdrop) backdrop.classList.remove('hidden');
        if (window.hideBottomNav) window.hideBottomNav();
        
        renderAcademicData();
    };

    function closeAcademicSheetState() {
        const backdrop = document.getElementById('academicBackdrop');
        if (backdrop) backdrop.classList.add('hidden');
        if (window.showBottomNav) window.showBottomNav();
    }

    window.closeAcademicSheet = function() {
        const sheet = document.getElementById('academicSheet');
        if (sheet && window.snapSheetClosed) {
            window.snapSheetClosed(sheet, closeAcademicSheetState);
        } else {
            if (sheet) sheet.classList.add('translate-y-full');
            closeAcademicSheetState();
        }
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

        if (isSyncing) {
            const elapsed = window.syncStartTime ? (Date.now() - window.syncStartTime) : 0;
            const syncText = elapsed > 12000 
                ? "GitHub Actions is running the scraper. Synced data will appear here in ~15 seconds..."
                : "Triggering on-demand refresh via Cloudflare Worker...";

            contentEl.innerHTML = `
                <div class="glass-panel p-6 text-center rounded-[2rem]">
                    <div class="w-10 h-10 border-4 border-[var(--mac-blue)]/30 border-t-[var(--mac-blue)] rounded-full animate-spin mx-auto mb-4"></div>
                    <p class="text-sm font-bold text-[#1d1d1f] dark:text-[#f5f5f7]">Refreshing Portal Data</p>
                    <p class="text-[10px] font-bold text-[#86868b] mt-2">${syncText}</p>
                </div>
            `;
            // Re-render to update the text if it's still syncing
            setTimeout(() => { if(isSyncing && window.renderAcademicData) window.renderAcademicData(); }, 3000);
            return;
        }

        if (!dataStr) {
            if (errorStr) {
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
            const marks = data.assessments || data.internalMarks || [];
            const lastSyncStr = data.last_synced || data.timestamp || new Date().toISOString();
            const lastSyncDate = new Date(lastSyncStr).toLocaleString('en-IN', { hour: '2-digit', minute: '2-digit', day: 'numeric', month: 'short' });

            let html = `<p class="text-[10px] font-black text-[#86868b] uppercase tracking-widest text-center mb-4">Last Synced: ${lastSyncDate}</p>`;

            // Attendance Section
            if (attendance.length > 0) {
                html += `
                    <div class="mb-6">
                        <h4 class="text-xs font-black text-[var(--mac-blue)] uppercase tracking-widest mb-3">Attendance</h4>
                        <div class="space-y-3">
                `;
                attendance.forEach(item => {
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

            // Internal Marks (Assessments) Section
            if (marks.length > 0) {
                html += `
                    <div>
                        <h4 class="text-xs font-black text-[var(--mac-blue)] uppercase tracking-widest mb-3">Internal Marks</h4>
                        <div class="grid grid-cols-2 gap-3">
                `;
                marks.forEach(item => {
                    const subject = item.subject || 'Unknown Subject';
                    const score = item.score !== undefined ? item.score : item.mark;
                    const type = item.assessment_type ? `<p class="text-[8px] font-bold text-[#86868b] uppercase tracking-wider mb-1">${item.assessment_type}</p>` : '';
                    const statusText = item.status ? ` <span class="text-[9px] font-bold text-[#86868b]">(${item.status})</span>` : '';
                    
                    html += `
                        <div class="glass-panel p-4 rounded-2xl flex flex-col justify-between">
                            ${type}
                            <p class="text-[10px] font-bold text-[#86868b] line-clamp-2 leading-tight mb-2">${subject}</p>
                            <p class="text-sm font-black tracking-tight text-[var(--mac-blue)]">${score}${statusText}</p>
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

            // Sync Button at the very bottom
            html += `
                <div class="text-center mt-6">
                    <button onclick="window.startBackgroundSync(); window.renderAcademicData();" class="px-6 py-2.5 bg-black/5 dark:bg-white/10 rounded-full text-xs font-bold spring">
                        🔄 Refresh Data
                    </button>
                </div>
            `;

            contentEl.innerHTML = html;

        } catch (e) {
            console.error(e);
            contentEl.innerHTML = `<p class="text-sm font-bold text-red-500">Error reading data. Please clear cache and try again.</p>`;
        }
    };

})();
