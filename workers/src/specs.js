/**
 * Portal specs — verified by live browser discovery (2026-06-05)
 * All URLs confirmed by live session with admission number 12965
 */
export const SPECS = {
  baseUrl: 'https://eportal.maraugusthinosecollege.org',
  loginPage: '/Default.aspx',

  formFields: {
    username: 'txtusername',
    password: 'txtpassword',
    submitButton: 'Submit',
    submitValue: 'Login',
  },

  hiddenTokens: {
    __VIEWSTATE: '__VIEWSTATE',
    __VIEWSTATEGENERATOR: '__VIEWSTATEGENERATOR',
    __EVENTVALIDATION: '__EVENTVALIDATION',
    // reCAPTCHA token is client-side only — server does NOT validate it
    recaptchaToken: 'recaptchaToken',
  },

  // ⚠️  THESE URLs HAVE PORTAL TYPOS — they are intentional and correct
  sectionEndpoints: {
    Dashboard:            '/Dashboard.aspx',
    Profile:              '/Profile.aspx',
    Attendance:           '/AttendanceNew.aspx',
    AttendanceDetails:    '/AttendanceDetails.aspx',   // POST target for subject data
    StudyMaterial:        '/StudyMeterialSubjectListNew.aspx',  // ⚠️ "Meterial" typo is intentional
    Assessment:           '/StdAssessmentNew.aspx',
    Assignment:           '/Assignment.aspx',
    Seminar:              '/Seminar.aspx',
    InternalMark:         '/StdInterenalNew.aspx',     // ⚠️ "Interenal" typo is intentional
    InternalToUniversity: '/StdInterenalNew.aspx',     // Same page
    OnlineClass:          '/OnlineClass.aspx',
    OnlineExam:           '/OnlineExamNEW.aspx',       // ⚠️ "NEW" is uppercase — NOT /OnlineExam.aspx
    FYUGP:                '/StudentCourse_Selection.aspx',
    ExamResult:           '/ExamResult.aspx',
    GraceMark:            '/GraceMarkApplication.aspx',
    HallTicket:           '/HallTicket.aspx',
    AllotmentMemo:        '/adm_AllotmentMemo.aspx',   // ⚠️ "adm_" prefix — NOT /AllotmentMemo.aspx
    FeePay:               '/StudFeePayment.aspx',
    FeedBack:             '/Evalution.aspx',           // ⚠️ "Evalution" typo — NOT /FeedBack.aspx
    Grievance:            '/GrievanceForm.aspx',
    Concession:           '/StudentIConcessionCard.aspx',
    SignOut:              '/SignOut.aspx',
  },

  // Attendance page uses postback to get subject-wise data
  attendanceHiddenFields: {
    semesterDropdown:  'ctl00$MainContent$ddlsem',
    submitButton:      'ctl00$MainContent$btnsubmit',
    hidBatch:          'MainContent_hid_batch',
    hidStudent:        'MainContent_hid_student',
  },

  sessionTimeoutIndicators: [
    'txtusername',
    'txtpassword',
    'id="Submit"',
  ],

  loginSuccessIndicators: [
    'Dashboard.aspx',
    'SignOut',
    'Logout',
  ],

  // Department detection — read from Profile.aspx course field
  departmentDetection: {
    method: 'profile_course_field',
    sampleFor12965: 'BACHELOR OF COMPUTER APPLICATIONS (HONOURS)',
    sampleDept: 'BCA',
  },
};
