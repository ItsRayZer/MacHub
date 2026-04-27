(function () {
    function getStudentInfo() {
        return window.ExamHubProfile.get();
    }

    function saveStudentInfo(profile) {
        window.ExamHubProfile.save(profile);
        return profile;
    }

    window.ExamHubProfileApi = {
        getStudentInfo,
        saveStudentInfo
    };
})();
