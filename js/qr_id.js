/**
 * ╔══════════════════════════════════════════════════════════════════╗
 * ║   MAC Exam Hub — Dynamic QR Digital ID Card                       ║
 * ║   Features: 30s auto-refresh, JWT signed, holographic card design ║
 * ╚══════════════════════════════════════════════════════════════════╝
 */

(function () {
    'use strict';

    let refreshInterval = null;
    let refreshProgressTimeout = null;
    let syncBarInterval = null;
    let qrInstance = null;

    async function ensureQrLibrary() {
        if (window.QRCode || window.qrcode) return true;
        return new Promise((resolve) => {
            const script = document.createElement('script');
            script.src = 'https://cdnjs.cloudflare.com/ajax/libs/qrcode-generator/1.4.4/qrcode.min.js';
            script.onload = () => resolve(true);
            script.onerror = () => {
                console.error('Failed to load QR code generator library.');
                resolve(false);
            };
            document.head.appendChild(script);
        });
    }

    async function showDigitalIdCard(admissionNumber) {
        const studentInfo = window.ExamHubProfile?.get();
        if (!studentInfo || (studentInfo.adminNo !== admissionNumber && studentInfo.admissionNo !== admissionNumber)) {
            alert('Claim your profile first to view your digital ID.');
            return;
        }

        const deviceToken = localStorage.getItem('machub_device_token');
        if (!deviceToken) {
            alert('Authentication error. Please re-claim or re-unlock your profile.');
            return;
        }

        const success = await ensureQrLibrary();
        if (!success) {
            alert('Unable to load QR code components. Check your internet connection.');
            return;
        }

        // Render card framework
        renderCardFramework(studentInfo);
        
        // Start QR loop
        startQrGenerationLoop(admissionNumber, deviceToken);

        switchView('view-qr-id');
    }

    function renderCardFramework(s) {
        const container = document.getElementById('qr-id-card-container');
        if (!container) return;

        const initials = (s.name || 'ME').split(/\s+/).slice(0, 2).map(part => part[0]).join('').toUpperCase();

        container.innerHTML = `
            <div class="qr-card rounded-3xl p-6 relative max-w-sm mx-auto space-y-6">
                <!-- Glowing effect background -->
                <div class="qr-card-glow" style="top: -20px; left: -20px;"></div>
                <div class="qr-shimmer"></div>

                <!-- CARD HEADER -->
                <div class="flex items-center justify-between relative z-10">
                    <div class="flex items-center gap-2">
                        <img src="assets/img/file_00000000378c7207842a975d80367515.png" alt="MacHub" class="h-6 opacity-80" />
                        <span class="text-[10px] font-black tracking-widest text-[#86868b] uppercase">Digital Student ID</span>
                    </div>
                    <span class="px-2 py-0.5 rounded-full bg-emerald-500/15 border border-emerald-500/20 text-emerald-400 text-[8px] font-black tracking-wider uppercase pulse-glow">
                        Active Verified
                    </span>
                </div>

                <!-- PHOTO & DETAILS -->
                <div class="flex items-center gap-4 relative z-10">
                    <div class="w-16 h-16 rounded-2xl border border-white/10 overflow-hidden bg-zinc-800 flex items-center justify-center font-black text-xl text-zinc-400">
                        ${s.photoUrl ? `<img src="${s.photoUrl}" alt="Photo" class="w-full h-full object-cover" />` : initials}
                    </div>
                    <div class="space-y-1">
                        <h4 class="text-base font-black tracking-tight leading-tight">${s.name}</h4>
                        <p class="text-xs text-zinc-400 leading-tight">${s.dept || s.classGroup || '---'}</p>
                        <div class="flex gap-3 text-[10px] text-zinc-500 font-bold">
                            <span>ADMN: ${s.adminNo || s.admissionNo || '---'}</span>
                            <span>ROLL: ${s.classNo || '---'}</span>
                        </div>
                    </div>
                </div>

                <!-- QR CODE AREA -->
                <div class="relative z-10 flex flex-col items-center justify-center bg-zinc-900/60 p-5 rounded-2xl border border-white/5 space-y-3">
                    <div id="qr-render-area" class="qr-container w-[160px] h-[160px]">
                        <div class="animate-pulse w-full h-full bg-zinc-800 rounded-lg flex items-center justify-center text-xs text-zinc-500">
                            Generating Secure Token...
                        </div>
                    </div>
                    
                    <div class="w-full space-y-1.5 text-center">
                        <div class="w-full bg-zinc-800/80 rounded-full h-1 overflow-hidden">
                            <div id="qr-sync-bar" class="sync-bar"></div>
                        </div>
                        <p class="text-[9px] text-zinc-500 font-bold tracking-wider uppercase">Auto-updates every 30 seconds</p>
                    </div>
                </div>

                <!-- BRANDING FOOTER -->
                <div class="flex justify-between items-center text-[10px] text-zinc-600 font-bold pt-2 border-t border-white/5 relative z-10">
                    <span>MAR AUGUSTHINOSE COLLEGE</span>
                    <span>EXAM HUB 2026</span>
                </div>
            </div>
        `;
    }

    async function generateSecureQrCode(admissionNumber, deviceToken) {
        const qrArea = document.getElementById('qr-render-area');
        const syncBar = document.getElementById('qr-sync-bar');
        if (!qrArea) return;

        try {
            const CF_WORKER_URL = 'https://machub-proxy.mrabensojan.workers.dev';
            const res = await fetch(`${CF_WORKER_URL}/api/auth/generate-qr-token`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ admissionNumber, deviceToken })
            });

            if (!res.ok) {
                throw new Error('Verification token request rejected');
            }

            const data = await res.json();
            if (!data.success || !data.token) {
                throw new Error(data.error || 'Failed to mint secure token');
            }

            // Generate QR Code using the qrcode-generator library
            // Type 0 = auto select type/version, Error Correction Level = 'L'
            const typeNumber = 0;
            const errorCorrectionLevel = 'L';
            const qr = window.qrcode(typeNumber, errorCorrectionLevel);
            qr.addData(data.token);
            qr.make();

            // Render as image tag inside area
            qrArea.innerHTML = qr.createImgTag(4, 8); // cell size = 4, margin = 8

            // Reset and start sync bar progress animation (30s)
            if (syncBar) {
                syncBar.style.transition = 'none';
                syncBar.style.width = '0%';
                void syncBar.offsetWidth; // trigger reflow
                syncBar.style.transition = 'width 30s linear';
                syncBar.style.width = '100%';
            }

        } catch (e) {
            qrArea.innerHTML = `
                <div class="flex flex-col items-center justify-center w-full h-full text-[10px] text-red-400 p-4 leading-tight">
                    <span>⚠️ Token Sync Failed</span>
                    <button onclick="window.retryQrGeneration()" class="mt-2 px-3 py-1 bg-white/5 border border-white/10 rounded-full font-bold text-[8px] uppercase tracking-wider text-white">
                        Retry
                    </button>
                </div>
            `;
            console.error('QR Generator loop error:', e.message);
        }
    }

    function startQrGenerationLoop(admissionNumber, deviceToken) {
        // Clear existing intervals
        stopQrGenerationLoop();

        // Initial generation
        generateSecureQrCode(admissionNumber, deviceToken);

        // Set interval for 30 seconds
        refreshInterval = setInterval(() => {
            generateSecureQrCode(admissionNumber, deviceToken);
        }, 30000);

        // Helper global reference for retry button
        window.retryQrGeneration = () => {
            generateSecureQrCode(admissionNumber, deviceToken);
        };
    }

    function stopQrGenerationLoop() {
        if (refreshInterval) {
            clearInterval(refreshInterval);
            refreshInterval = null;
        }
        if (refreshProgressTimeout) {
            clearTimeout(refreshProgressTimeout);
            refreshProgressTimeout = null;
        }
        if (syncBarInterval) {
            clearInterval(syncBarInterval);
            syncBarInterval = null;
        }
    }

    // Teardown QR generation when user navigates away
    window.teardownQrLoop = function () {
        stopQrGenerationLoop();
    };

    window.ExamHubQr = {
        show: showDigitalIdCard,
        stop: stopQrGenerationLoop
    };

})();
