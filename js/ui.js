(function () {
    function afterFirstPaint(callback) {
        requestAnimationFrame(() => requestAnimationFrame(callback));
    }

    function deferWork(callback, timeout) {
        if ('requestIdleCallback' in window) {
            requestIdleCallback(callback, { timeout: timeout || 1200 });
            return;
        }
        setTimeout(callback, timeout || 180);
    }

    window.ExamHubUI = {
        afterFirstPaint,
        deferWork
    };
})();
