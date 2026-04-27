(function () {
    function detectDeviceMode() {
        const coarse = window.matchMedia && window.matchMedia('(pointer: coarse)').matches;
        const narrow = window.innerWidth <= 820;
        const lowMemory = navigator.deviceMemory && navigator.deviceMemory <= 4;
        const lowCpu = navigator.hardwareConcurrency && navigator.hardwareConcurrency <= 4;
        const reducedMotion = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;

        const mobileOptimized = coarse || narrow;
        const lowEndDevice = !!(reducedMotion || lowMemory || lowCpu);

        document.body.classList.toggle('mobile-optimized', mobileOptimized);
        document.body.classList.toggle('low-end-device', lowEndDevice);

        window.ExamHubState.mobileOptimized = mobileOptimized;
        window.ExamHubState.lowEndDevice = lowEndDevice;
    }

    window.ExamHubHome = {
        detectDeviceMode
    };
})();
