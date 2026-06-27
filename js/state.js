(function () {
    const state = {
        selectedDate: '16_04_2026',
        view: 'view-home',
        openSeatDropdown: null,
        profile: null,
        seatCache: {},
        seatLoadPromises: {},
        timersStarted: false,
        mobileOptimized: false,
        lowEndDevice: false,
        externalApp: {
            isOpen: false,
            url: '',
            title: ''
        },
        // Security Slice
        security: {
            isProfileClaimed: false,
            pinLength: 4,
            isUnlocked: false,
            deviceToken: null,
            verificationQuestions: [],
            currentAdmissionNumber: null,
            credentialStatus: 'valid', // 'valid' | 'invalid'
            loading: false,
            error: null
        }
    };

    function readProfile() {
        if (state.profile) return state.profile;
        try {
            state.profile = JSON.parse(localStorage.getItem('mac_student_info') || 'null');
        } catch (error) {
            state.profile = null;
        }
        return state.profile;
    }

    function writeProfile(profile) {
        state.profile = profile;
        try {
            localStorage.setItem('mac_student_info', JSON.stringify(profile));
        } catch (error) {
            console.warn('localStorage is restricted', error);
        }
    }

    function clearProfileCache() {
        state.profile = null;
    }

    window.ExamHubState = state;
    window.ExamHubProfile = {
        get: readProfile,
        save: writeProfile,
        clearCache: clearProfileCache
    };
})();
