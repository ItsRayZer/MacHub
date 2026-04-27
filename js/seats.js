(function () {
    function injectScriptOnce(src) {
        return new Promise((resolve, reject) => {
            const s = document.createElement('script');
            s.src = src;
            s.async = true;
            s.onload = () => {
                s.remove();
                resolve();
            };
            s.onerror = () => {
                s.remove();
                reject(new Error(`Failed to load ${src}`));
            };
            document.body.appendChild(s);
        });
    }

    function normalizeSeatData(rawAll) {
        const allDepartments = rawAll.filter(d => ['BCA', 'BBA', 'BSW'].includes(String(d[6] || '').toUpperCase()));
        const seatGroups = {};

        allDepartments.forEach(([roll, hall, room, sec, row, side, dept]) => {
            const rowNum = row === 'ESK' ? 0 : parseInt(row, 10);
            const key = `${hall}|${room}|${sec}|${rowNum}`;

            if (!seatGroups[key]) {
                seatGroups[key] = { h: hall, aud: room, c: sec, r: rowNum, l: null, ri: null };
            }

            const reg = String(roll).toUpperCase();
            const student = window.STUDENT_NAMES?.[reg] || null;
            const seatObj = {
                d: dept,
                r: reg,
                s: dept,
                n: student?.name || '',
                g: student?.gender || ''
            };
            if (side === 'Left') seatGroups[key].l = seatObj;
            else seatGroups[key].ri = seatObj;
        });

        const rawData = Object.values(seatGroups).sort((a, b) => {
            if (a.h !== b.h) return String(a.h).localeCompare(String(b.h), undefined, { numeric: true });
            if (a.c !== b.c) return a.c - b.c;
            return a.r - b.r;
        });

        const halls = {};
        rawData.forEach(item => {
            (halls[item.h] ||= []).push(item);
        });

        return {
            allDepartments,
            rawData,
            halls,
            firstHall: rawData.length ? rawData[0].h : 'Hall 1'
        };
    }

    function loadDay(dateStr) {
        const globalState = window.ExamHubState;
        if (globalState.seatCache[dateStr]) {
            return Promise.resolve(globalState.seatCache[dateStr]);
        }
        if (globalState.seatLoadPromises[dateStr]) {
            return globalState.seatLoadPromises[dateStr];
        }

        globalState.seatLoadPromises[dateStr] = Promise.all([
            injectScriptOnce(`data/${dateStr}/bca.js`),
            injectScriptOnce(`data/${dateStr}/bba.js`),
            injectScriptOnce(`data/${dateStr}/bsw.js`)
        ]).then(() => {
            const normalized = normalizeSeatData([
                ...(window.BCA_DATA || []),
                ...(window.BBA_DATA || []),
                ...(window.BSW_DATA || [])
            ]);

            globalState.seatCache[dateStr] = normalized;
            window.BCA_DATA = null;
            window.BBA_DATA = null;
            window.BSW_DATA = null;
            return normalized;
        }).finally(() => {
            delete globalState.seatLoadPromises[dateStr];
        });

        return globalState.seatLoadPromises[dateStr];
    }

    window.ExamHubSeats = {
        loadDay,
        normalizeSeatData
    };
})();
