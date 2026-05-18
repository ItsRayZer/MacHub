/**
 * MacHub - Smart Student Finder
 * Identifies a student from STUDENTS_DB using any field:
 * name, adminNo, regNo, classNo
 */

window.SmartFinder = (function() {

    function normalize(str) {
        return (str || '').toString().toLowerCase().trim();
    }

    /**
     * Search across all fields. Returns array of matches.
     */
    function findStudent(query) {
        if (!query || !window.STUDENTS_DB) return [];
        const q = normalize(query);
        if (!q) return [];

        return window.STUDENTS_DB.filter(s => {
            return normalize(s.name).includes(q) ||
                   normalize(s.adminNo) === q ||
                   normalize(s.classNo) === q ||
                   normalize(s.regNo) === q ||
                   // partial name match from start of any word
                   normalize(s.name).split(' ').some(word => word.startsWith(q));
        });
    }

    /**
     * Apply a student record to the app state.
     */
    function applyStudent(student) {
        const profileData = {
            name: student.name,
            reg: student.regNo,
            adminNo: student.adminNo,
            dept: student.department,
            classGroup: student.classGroup,
            classNo: student.classNo,
            semester: student.semester
        };

        // Save to localStorage
        if (window.saveStudentInfo) window.saveStudentInfo(profileData);

        // Trigger UI refresh
        const homeGreet = document.getElementById('homeGreeting');
        if (homeGreet) homeGreet.textContent = `Hi, ${student.name.split(' ')[0]}!`;
        const deptEl = document.getElementById('homeUserDept');
        if (deptEl) deptEl.textContent = `${student.classGroup} · ${student.semester}`;
        const regEl = document.getElementById('homeUserReg');
        if (regEl) regEl.textContent = student.regNo || student.classNo || 'Not set';

        if (window.setFilter) window.setFilter(student.department);
        if (window.updateCountdown) window.updateCountdown();
        if (window.updateHomeSeatInfo) window.updateHomeSeatInfo();

        // Trigger background sync if adminNo exists
        if (student.adminNo && window.startBackgroundSync) {
            window.startBackgroundSync();
        }
    }

    return { findStudent, applyStudent };
})();
