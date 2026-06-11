"function showBottomNav() {
    const drawer = document.getElementById('detailDrawer');
    const marksSheet = document.getElementById('marksSheet');
    const timetableExamSheet = document.getElementById('timetableExamSheet');
    const academicSheet = document.getElementById('academicSheet');
    const portalNavDrawer = document.getElementById('portalNavDrawer');
    const drawerOpen = drawer && drawer.style.transform !== 'translateY(100%)' && drawer.style.transform !== '';
    const marksOpen = marksSheet && marksSheet.style.transform !== 'translateY(100%)' && marksSheet.style.transform !== '';
    const timetableOpen = timetableExamSheet && timetableExamSheet.style.transform !== 'translateY(100%)' && timetableExamSheet.style.transform !== '';
    const academicOpen = academicSheet && academicSheet.style.transform !== 'translateY(100%)' && academicSheet.style.transform !== '';
    const portalDrawerOpen = portalNavDrawer && portalNavDrawer.style.transform !== 'translateY(100%)' && portalNavDrawer.style.transform !== '';
    if (drawerOpen || marksOpen || timetableOpen || academicOpen || portalDrawerOpen) return;
    _navLockedHidden = false;
    const nav = document.getElementById('bottomNav');
    if (nav) nav.classList.remove('nav-hidden');
    _navHidden = false;
}

// Expose navigation/sheet utilities to global scope
window.hideBottomNav = hideBottomNav;
window.showBottomNav = showBottomNav;

window.openPortalDrawer = function() {
    const backdrop = document.getElementById('portalNavBackdrop');
    const drawer = document.getElementById('portalNavDrawer');
    if (backdrop) backdrop.classList.remove('hidden');
    if (drawer) {
        drawer.style.transform = 'translateY(0)';
        drawer.style.pointerEvents = 'auto';
    }
    
    // Set student name in the portal drawer if available
    const nameEl = document.getElementById('portalDrawerStudentName');
    if (nameEl && typeof getStudentInfo === 'function') {
        const student = getStudentInfo();
        if (s
<truncated 780 bytes>