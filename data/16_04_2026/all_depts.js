(function() {
    const RAW_DATA = [];

    function populateRange(hall, aud, colStart, colEnd, rows, deptL, startL, deptR, startR, isBcaL = false) {
        for (let c = colStart; c <= colEnd; c++) {
            for (let r = 1; r <= rows; r++) {
                const lIdx = (c - colStart) * rows + (r - 1);
                const rIdx = lIdx;
                RAW_DATA.push({
                    h: hall, aud: aud, c: c, r: r,
                    l: { d: deptL, r: `MG25103A${startL + lIdx}`, s: isBcaL ? `BCA ${Math.floor(startL + lIdx - 2838 + 1)}` : null },
                    ri: deptR ? { d: deptR, r: `MG25102A${startR + rIdx}` } : null
                });
            }
        }
    }

    populateRange("Hall No. 1", "Auditorium A", 1, 1, 5, "BCA", 2838, "BBA", 2113, true);
    populateRange("Hall No. 1", "Auditorium A", 2, 2, 5, "BCA", 2843, "BBA", 2118, true);
    populateRange("Hall No. 1", "Auditorium A", 3, 3, 5, "BCA", 2849, "BBA", 2123, true);
    populateRange("Hall No. 2", "Auditorium B", 1, 1, 5, "BCA", 2855, "BBA", 2130, true);
    populateRange("Hall No. 2", "Auditorium B", 2, 2, 5, "BCA", 2860, "BBA", 2135, true);
    populateRange("Hall No. 2", "Auditorium B", 3, 3, 5, "BCA", 2865, "BBA", 2140, true);
    populateRange("Hall No. 3", "Auditorium C", 1, 1, 5, "BCA", 2870, "BBA", 2145, true);
    populateRange("Hall No. 3", "Auditorium C", 2, 2, 5, "BCA", 2877, "BBA", 2150, true);
    populateRange("Hall No. 3", "Auditorium C", 3, 3, 5, "BCA", 2882, "BBA", 2156, true);
    for(let c=1; c<=3; c++) {
        for(let r=1; r<=5; r++) {
            let base = (c-1)*5 + (r-1);
            RAW_DATA.push({ h: "Hall No. 4", aud: "Auditorium D", c: c, r: r, l: { d: "BCA", s: `BCA ${46+base}`, r: `MG23103A${2887+base}` }, ri: { d: "BBA", r: `MG25102A${2160+base}` } });
        }
    }
    populateRange("Hall No. 5", "Auditorium E", 1, 1, 5, "BCA", 2902, "BBA", 2177, true);
    populateRange("Hall No. 5", "Auditorium E", 2, 2, 5, "BCA", 2907, "BBA", 2182, true);
    RAW_DATA.push({ h: "Hall No. 5", aud: "Auditorium E", c: 3, r: 1, l: { d: "BCA", s: "BCA 71", r: "MG25103A2912" }, ri: { d: "BBA", r: "MG25102A2187" } });
    RAW_DATA.push({ h: "Hall No. 5", aud: "Auditorium E", c: 3, r: 2, l: { d: "BCA", s: "BCA 72", r: "MG25103A2913" }, ri: { d: "Commerce", r: "MG25101A7970" } });
    RAW_DATA.push({ h: "Hall No. 5", aud: "Auditorium E", c: 3, r: 3, l: { d: "BCA", s: "BCA 73", r: "MG25103A2914" }, ri: { d: "Commerce", r: "MG25101A7971" } });
    RAW_DATA.push({ h: "Hall No. 5", aud: "Auditorium E", c: 3, r: 4, l: { d: "BCA", s: "BCA 74", r: "MG25103A2915" }, ri: { d: "Commerce", r: "MG25101A7972" } });
    RAW_DATA.push({ h: "Hall No. 5", aud: "Auditorium E", c: 3, r: 5, l: { d: "BCA", s: "BCA 75", r: "MG25103A2916" }, ri: { d: "Commerce", r: "MG25101A7973" } });
    populateRange("Hall No. 6", "A 16", 1, 1, 6, "BCA", 2917, "Commerce", 7974, true);
    populateRange("Hall No. 6", "A 16", 2, 2, 5, "BCA", 2924, "Commerce", 7981, true);
    populateRange("Hall No. 6", "A 16", 3, 3, 4, "BCA", 2929, "Commerce", 7986, true);
    populateRange("Hall No. 7", "A 15", 1, 1, 6, "BCA", 2933, "Commerce", 7990, true);
    populateRange("Hall No. 7", "A 15", 2, 2, 5, "BCA", 2939, "Commerce", 7996, true);
    populateRange("Hall No. 7", "A 15", 3, 3, 4, "BCA", 2944, "Commerce", 8008, true);
    populateRange("Hall No. 8", "A 14", 1, 1, 6, "BCA", 2948, "Commerce", 8012, true);
    populateRange("Hall No. 8", "A 14", 2, 2, 5, "BCA", 2954, "Commerce", 8018, true);
    RAW_DATA.push({ h: "Hall No. 8", aud: "A 14", c: 3, r: 1, l: { d: "BCA", s: "BCA 117", r: "MG25103A2960" }, ri: null });
    RAW_DATA.push({ h: "Hall No. 8", aud: "A 14", c: 3, r: 2, l: { d: "Science", r: "MG25101A7965" }, ri: null });
    RAW_DATA.push({ h: "Hall No. 8", aud: "A 14", c: 3, r: 3, l: { d: "Science", r: "MG25101A7966" }, ri: null });
    RAW_DATA.push({ h: "Hall No. 8", aud: "A 14", c: 3, r: 4, l: { d: "Science", r: "MG25101A7967" }, ri: null });
    populateRange("Hall No. 9", "A 13", 1, 1, 6, "Science", 7968, "Science", 8179);
    RAW_DATA.push({ h: "Hall No. 9", aud: "A 13", c: 2, r: 1, l: { d: "Commerce", r: "MG25101A8001" }, ri: { d: "BBA", r: "MG24102A2027" } });
    RAW_DATA.push({ h: "Hall No. 9", aud: "A 13", c: 2, r: 2, l: { d: "Commerce", r: "MG25101A8002" }, ri: { d: "BBA", r: "MG24102A2030" } });
    RAW_DATA.push({ h: "Hall No. 9", aud: "A 13", c: 2, r: 3, l: { d: "BCA", s: "BCA 118", r: "MG24103A2597" }, ri: { d: "Commerce", r: "MG24101A0954" } });
    RAW_DATA.push({ h: "Hall No. 9", aud: "A 13", c: 2, r: 4, l: { d: "BCA", s: "BCA 119", r: "MG24103A2618" }, ri: null });
    RAW_DATA.push({ h: "Hall No. 9", aud: "A 13", c: 2, r: 5, l: { d: "BCA", s: "BCA 120", r: "MG24103A2657" }, ri: null });
    populateRange("Hall No. 9", "A 13", 3, 3, 4, "BCA", 2661, null, null, true);

    window.ALL_DEPTS_DATA = RAW_DATA;
})();
