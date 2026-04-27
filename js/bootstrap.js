(function () {
    function initFirebaseDeferred() {
        const state = window.ExamHubState;
        if (!state || state.mobileOptimized || state.lowEndDevice || window.__examHubAnalyticsStarted) return;
        window.__examHubAnalyticsStarted = true;

        const start = () => {
            Promise.all([
                import('https://www.gstatic.com/firebasejs/10.9.0/firebase-app.js'),
                import('https://www.gstatic.com/firebasejs/10.9.0/firebase-analytics.js')
            ]).then(([firebaseApp, firebaseAnalytics]) => {
                const firebaseConfig = {
                    apiKey: 'AIzaSyDnGbuXe01gH_NK3CZtuH_xSSjgh-ZTVXA',
                    authDomain: 'mac-exam-hub.firebaseapp.com',
                    projectId: 'mac-exam-hub',
                    storageBucket: 'mac-exam-hub.firebasestorage.app',
                    messagingSenderId: '299707041721',
                    appId: '1:299707041721:web:c5bef788177ee75e515868',
                    measurementId: 'G-R0E8CK9HQ6'
                };

                const app = firebaseApp.initializeApp(firebaseConfig);
                firebaseAnalytics.getAnalytics(app);
            }).catch(() => {
                window.__examHubAnalyticsStarted = false;
            });
        };

        const boot = () => window.ExamHubUI.deferWork(start, 2200);
        window.addEventListener('pointerdown', boot, { once: true, passive: true });
        window.addEventListener('keydown', boot, { once: true });
        setTimeout(boot, 3000);
    }

    document.addEventListener('DOMContentLoaded', () => {
        if (window.ExamHubHome) {
            window.ExamHubHome.detectDeviceMode();
        }

        if (typeof window.initExamHubApp === 'function') {
            window.initExamHubApp();
        }

        initFirebaseDeferred();
    });
})();
