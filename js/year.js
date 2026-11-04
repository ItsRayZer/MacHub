/**
 * MacHub - Student Year Detection
 *
 * Derives a student's current year of study from student data ONLY -
 * no server call, no extra input. It works from the fields MacHub
 * already has: regNo, batch, admission_no, semester, department.
 *
 * Priority of evidence:
 *   1. regNo like "MG25103A2838"  -> "MG" + YY  => admission year 20YY
 *   2. batch like "2021 - 2024"   -> start year => admission year
 *   3. semester like "Sem 3"      -> year = ceil(sem / 2)  (fallback only)
 *
 * Year of study = currentAcademicYear - admissionYear + 1,
 * where the academic year rolls over in June.
 * Result is clamped to 1..programYears (from batch span, else 4 for
 * BCA (Honours) / UG programmes, else 3).
 *
 * Example: regNo MG25..., today Nov 2026 -> academic year 2026 ->
 * 2026 - 2025 + 1 = Year 2. Correct for the 2025 BCA batch.
 */

(function () {
    'use strict';

    // ── Evidence extractors ───────────────────────────────────────────────

    // "MG25103A2838" -> 2025
    function admissionYearFromRegNo(regNo) {
        const m = String(regNo || '').toUpperCase().match(/^MG(\d{2})/);
        if (!m) return null;
        const yy = parseInt(m[1], 10);
        return yy <= 40 ? 2000 + yy : 1900 + yy;
    }

    // "2021 - 2024" -> { start: 2021, end: 2024 }
    function parseBatch(batch) {
        const m = String(batch || '').match(/(\d{4})\s*[-\u2013]\s*(\d{4})/);
        if (!m) return null;
        const start = parseInt(m[1], 10);
        const end = parseInt(m[2], 10);
        if (end < start || start < 1990 || end > 2100) return null;
        return { start, end };
    }

    // "Sem 3" / "Semester 2" -> 3
    function semesterNumber(sem) {
        const m = String(sem || '').match(/(\d{1,2})/);
        if (!m) return null;
        const n = parseInt(m[1], 10);
        return (n >= 1 && n <= 12) ? n : null;
    }

    // Academic year rolls over in June (new admissions join June/July).
    function academicYear(date) {
        const d = date instanceof Date ? date : new Date();
        const y = d.getFullYear();
        return d.getMonth() >= 5 ? y : y - 1;
    }

    function ordinal(n) {
        const s = ['th', 'st', 'nd', 'rd'];
        const v = n % 100;
        return n + (s[(v - 20) % 10] || s[v] || s[0]);
    }

    // ── Main API ──────────────────────────────────────────────────────────

    /**
     * @param {Object} student  fields: regNo/reg, batch, admission_no/adminNo,
     *                          semester, department
     * @param {Date}   [now]    override "today" (for tests)
     * @returns {{year:number, label:string, admissionYear:number|null,
     *            programYears:number, source:string}}
     */
    function detectStudentYear(student, now) {
        const s = student || {};
        const regNo = s.regNo || s.reg || s.registerNo || s.prn || '';
        const batchInfo = parseBatch(s.batch);

        let admissionYear = admissionYearFromRegNo(regNo);
        let source = 'regNo';
        if (admissionYear == null && batchInfo) {
            admissionYear = batchInfo.start;
            source = 'batch';
        }

        let programYears = 4; // BCA (Honours) default
        if (batchInfo && batchInfo.end > batchInfo.start) {
            programYears = batchInfo.end - batchInfo.start;
        }

        let year = null;
        if (admissionYear != null) {
            year = academicYear(now) - admissionYear + 1;
            year = Math.max(1, Math.min(programYears, year));
        } else {
            // Last resort: semester field only
            const sem = semesterNumber(s.semester);
            if (sem != null) {
                year = Math.max(1, Math.min(programYears, Math.ceil(sem / 2)));
                source = 'semester';
            }
        }

        if (year == null) {
            return { year: null, label: '', admissionYear: null, programYears, source: 'unknown' };
        }

        return {
            year,
            label: 'Year ' + year,
            longLabel: ordinal(year) + ' Year',
            admissionYear,
            programYears,
            source,
        };
    }

    /** One-liner for UI badges: "Year 2" or "" when unknown. */
    function yearBadgeText(student, now) {
        const r = detectStudentYear(student, now);
        return r.year ? r.label : '';
    }

    /**
     * Full home department line: "BCA A · Year 2".
     * Falls back to semester text ("SEM 2") when year is unknown.
     * Never throws; safe to call from any profile refresh path.
     */
    function deptYearLine(profile) {
        const p = profile || {};
        const base = p.dept || p.classGroup || p.department || '';
        let yearText = '';
        try { yearText = yearBadgeText(p); } catch (_) { yearText = ''; }
        if (!yearText) yearText = p.semester || '';
        if (!base) return yearText || '---';
        return yearText ? (base + ' · ' + yearText) : base;
    }

    // ── Auto-enhance: fill any [data-machub-year] elements ─────────────────
    function autoEnhance() {
        try {
            const els = document.querySelectorAll('[data-machub-year]');
            if (!els.length) return;
            let student = null;
            try {
                const raw = localStorage.getItem('machub_student_profile');
                student = raw ? JSON.parse(raw) : null;
            } catch (_) { /* ignore */ }
            const text = yearBadgeText(student || {});
            els.forEach(el => { if (text) el.textContent = text; });
        } catch (_) { /* never break the app */ }
    }

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', autoEnhance);
    } else {
        autoEnhance();
    }

    window.MacHubYear = {
        detectStudentYear,
        yearBadgeText,
        deptYearLine,
        admissionYearFromRegNo,
        parseBatch,
        academicYear,
    };
})();
