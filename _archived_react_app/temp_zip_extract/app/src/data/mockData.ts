import type {
  StudentProfile,
  Subject,
  AttendanceRecord,
  ExamSchedule,
  FeeRecord,
  AllotmentMemo,
  HallTicket,
  GrievanceSubmission,
  ConcessionPass,
  AppSettings,
  DeviceSession,
} from '@/types';

export const studentProfile: StudentProfile = {
  name: 'Pranav Suresh',
  admissionNo: 'MGU2023BCA0129',
  course: 'BCA',
  batch: '2023-2026',
  semester: 4,
  division: 'A',
  email: 'pranav.suresh@mgu.ac.in',
  phone: '9876543242',
  college: 'MAC Ramapuram',
  photoUrl: '/avatar.jpg',
  isClassRep: true,
};

export const subjects: Subject[] = [
  { id: '1', name: 'Data Structures & Algorithms', code: 'MG2B01', type: 'Core', attendance: 87, totalClasses: 46, attendedClasses: 40, internalMarks: 42, maxInternalMarks: 50 },
  { id: '2', name: 'Object Oriented Programming', code: 'MG2B02', type: 'Core', attendance: 91, totalClasses: 44, attendedClasses: 40, internalMarks: 45, maxInternalMarks: 50 },
  { id: '3', name: 'Database Management Systems', code: 'MG2B03', type: 'Core', attendance: 79, totalClasses: 48, attendedClasses: 38, internalMarks: 38, maxInternalMarks: 50 },
  { id: '4', name: 'Computer Networks', code: 'MG2B04', type: 'Core', attendance: 83, totalClasses: 42, attendedClasses: 35, internalMarks: 41, maxInternalMarks: 50 },
  { id: '5', name: 'Web Technologies', code: 'MG2B05', type: 'Core', attendance: 95, totalClasses: 40, attendedClasses: 38, internalMarks: 47, maxInternalMarks: 50 },
  { id: '6', name: 'Software Engineering', code: 'MG2B06', type: 'Core', attendance: 71, totalClasses: 42, attendedClasses: 30, internalMarks: 35, maxInternalMarks: 50 },
  { id: '7', name: 'Python Programming', code: 'MG2B07', type: 'Lab', attendance: 88, totalClasses: 36, attendedClasses: 32, internalMarks: 44, maxInternalMarks: 50 },
  { id: '8', name: 'Communication Skills', code: 'MG2B08', type: 'Elective', attendance: 92, totalClasses: 24, attendedClasses: 22, internalMarks: 46, maxInternalMarks: 50 },
];

export const attendanceRecords: AttendanceRecord[] = subjects.map((s) => ({
  subjectId: s.id,
  subjectName: s.name,
  subjectCode: s.code,
  totalClasses: s.totalClasses,
  attendedClasses: s.attendedClasses,
  percentage: s.attendance,
  status: s.attendance >= 75 ? 'safe' : s.attendance >= 65 ? 'warning' : 'critical',
}));

export const examSchedules: ExamSchedule[] = [
  { id: 'e1', courseCode: 'MG2B01', courseName: 'Data Structures & Algorithms', examDate: '2025-07-15', session: 'FN', time: '9:30 AM - 12:30 PM', venue: 'Block A - Room 301', seatNumber: 'A-45' },
  { id: 'e2', courseCode: 'MG2B02', courseName: 'Object Oriented Programming', examDate: '2025-07-17', session: 'AN', time: '2:00 PM - 5:00 PM', venue: 'Block B - Room 205', seatNumber: 'B-12' },
  { id: 'e3', courseCode: 'MG2B03', courseName: 'Database Management Systems', examDate: '2025-07-19', session: 'FN', time: '9:30 AM - 12:30 PM', venue: 'Block A - Room 302', seatNumber: 'A-67' },
  { id: 'e4', courseCode: 'MG2B04', courseName: 'Computer Networks', examDate: '2025-07-21', session: 'AN', time: '2:00 PM - 5:00 PM', venue: 'Block C - Room 105', seatNumber: 'C-23' },
  { id: 'e5', courseCode: 'MG2B05', courseName: 'Web Technologies', examDate: '2025-07-23', session: 'FN', time: '9:30 AM - 12:30 PM', venue: 'Block A - Room 303', seatNumber: 'A-89' },
  { id: 'e6', courseCode: 'MG2B06', courseName: 'Software Engineering', examDate: '2025-07-25', session: 'FN', time: '9:30 AM - 12:30 PM', venue: 'Block B - Room 206', seatNumber: 'B-34' },
];

export const feeRecords: FeeRecord[] = [
  { id: 'f1', semester: 'Semester 1 (2023-24)', amount: 28500, status: 'paid', transactionId: 'TXN783649201', paidDate: '2023-08-15', dueDate: '2023-08-31', category: 'Tuition' },
  { id: 'f2', semester: 'Semester 2 (2023-24)', amount: 28500, status: 'paid', transactionId: 'TXN784120956', paidDate: '2024-01-20', dueDate: '2024-01-31', category: 'Tuition' },
  { id: 'f3', semester: 'Semester 3 (2024-25)', amount: 29500, status: 'paid', transactionId: 'TXN790384621', paidDate: '2024-08-18', dueDate: '2024-08-31', category: 'Tuition' },
  { id: 'f4', semester: 'Semester 4 (2024-25)', amount: 29500, status: 'pending', dueDate: '2025-01-31', category: 'Tuition' },
  { id: 'f5', semester: 'Exam Fee - End Semester', amount: 1250, status: 'paid', transactionId: 'TXN801245673', paidDate: '2025-06-10', dueDate: '2025-06-15', category: 'Exam' },
  { id: 'f6', semester: 'Lab Fee - Semester 4', amount: 3500, status: 'pending', dueDate: '2025-01-31', category: 'Lab' },
  { id: 'f7', semester: 'Library Fee - Annual', amount: 500, status: 'paid', transactionId: 'TXN801245674', paidDate: '2024-08-18', dueDate: '2024-08-31', category: 'Library' },
];

export const allotmentMemos: AllotmentMemo[] = [
  {
    id: 'am1',
    courseName: 'Bachelor of Computer Applications (BCA)',
    collegeName: 'Mahatma Arts & Science College, Ramapuram',
    seatCategory: 'Merit',
    allottedDate: '2023-07-24',
    status: 'active',
    pdfUrl: 'https://studentportal.mgu.ac.in/allotment/MGU2023BCA0129.pdf',
  },
];

export const hallTickets: HallTicket[] = [
  {
    id: 'ht1',
    examName: 'Fourth Semester Examination 2025',
    semester: '4',
    issueDate: '2025-06-28',
    status: 'active',
    examSchedule: examSchedules,
    qrData: 'MGU|MGU2023BCA0129|SEM4|2025',
  },
];

export const grievanceSubmissions: GrievanceSubmission[] = [
  {
    id: 'g1',
    category: 'Examination',
    subject: 'Internal Marks Discrepancy - DBMS',
    description: 'The internal marks uploaded for DBMS (MG2B03) do not match the marks announced in class. I scored 42 but 38 is showing.',
    status: 'resolved',
    submittedDate: '2025-03-15',
    response: 'Marks have been verified and corrected. Your actual internal marks: 42/50.',
  },
  {
    id: 'g2',
    category: 'Academic',
    subject: 'Attendance Calculation Error',
    description: 'My attendance for Software Engineering is showing 71% but I have attended 34 out of 42 classes which should be 80.9%.',
    status: 'in-progress',
    submittedDate: '2025-06-01',
  },
];

export const concessionPasses: ConcessionPass[] = [
  {
    id: 'cp1',
    passType: 'Bus',
    passNumber: 'MGU-BUS-2023-0129',
    validFrom: '2024-09-01',
    validUntil: '2025-08-31',
    status: 'active',
    route: 'Ramapuram - MGU Campus',
    downloadUrl: 'https://studentportal.mgu.ac.in/concession/MGU2023BCA0129.pdf',
  },
];

export const defaultAppSettings: AppSettings = {
  themeMode: 'dark',
  attendanceAlerts: true,
  marksNotifications: true,
  feeDueReminders: true,
  generalAnnouncements: false,
  syncFrequency: 'hourly',
};

export const deviceSessions: DeviceSession[] = [
  { id: 'd1', deviceName: 'iPhone 15 Pro', ipAddress: '117.213.42.105', lastActive: '2025-06-11T21:30:00Z', isCurrent: true },
  { id: 'd2', deviceName: 'Chrome on Windows', ipAddress: '117.213.42.110', lastActive: '2025-06-10T14:20:00Z', isCurrent: false },
  { id: 'd3', deviceName: 'Safari on MacBook Pro', ipAddress: '103.21.45.88', lastActive: '2025-06-08T09:15:00Z', isCurrent: false },
];

export const getAggregateAttendance = () => {
  const total = attendanceRecords.reduce((sum, s) => sum + s.percentage, 0);
  const avg = total / attendanceRecords.length;
  return {
    percentage: avg.toFixed(2),
    status: avg >= 75 ? 'Safe Range' : avg >= 65 ? 'Warning' : 'Critical',
    color: avg >= 75 ? '#00F5D4' : avg >= 65 ? '#FFB703' : '#ef4444',
  };
};

export const getBadges = () => {
  const badges = [];
  const perfectAttendance = attendanceRecords.some((s) => s.percentage === 100);
  if (perfectAttendance) badges.push({ id: 'perf', emoji: '🥇', title: 'Perfect Attendance' });
  const highAttendance = attendanceRecords.some((s) => s.percentage > 90);
  if (highAttendance) badges.push({ id: 'high', emoji: '📚', title: 'Above 90%' });
  if (studentProfile.isClassRep) badges.push({ id: 'rep', emoji: '⚡', title: 'Class Rep' });
  badges.push({ id: 'actv', emoji: '🎯', title: 'Active Student' });
  return badges;
};
