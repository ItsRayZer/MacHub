export interface StudentProfile {
  name: string;
  admissionNo: string;
  course: string;
  batch: string;
  semester: number;
  division: string;
  email: string;
  phone: string;
  college: string;
  photoUrl: string;
  isClassRep: boolean;
}

export interface Subject {
  id: string;
  name: string;
  code: string;
  type: 'Core' | 'Elective' | 'Lab';
  attendance: number;
  totalClasses: number;
  attendedClasses: number;
  internalMarks: number;
  maxInternalMarks: number;
}

export interface AttendanceRecord {
  subjectId: string;
  subjectName: string;
  subjectCode: string;
  totalClasses: number;
  attendedClasses: number;
  percentage: number;
  status: 'safe' | 'warning' | 'critical';
}

export interface ExamSchedule {
  id: string;
  courseCode: string;
  courseName: string;
  examDate: string;
  session: 'FN' | 'AN';
  time: string;
  venue: string;
  seatNumber: string;
}

export interface FeeRecord {
  id: string;
  semester: string;
  amount: number;
  status: 'paid' | 'pending' | 'overdue';
  transactionId?: string;
  paidDate?: string;
  dueDate: string;
  category: 'Tuition' | 'Exam' | 'Library' | 'Lab' | 'Other';
}

export interface AllotmentMemo {
  id: string;
  courseName: string;
  collegeName: string;
  seatCategory: 'Merit' | 'Management' | 'Sports' | 'NRI';
  allottedDate: string;
  status: 'active' | 'withdrawn' | 'completed';
  pdfUrl: string;
}

export interface HallTicket {
  id: string;
  examName: string;
  semester: string;
  issueDate: string;
  status: 'active' | 'expired';
  examSchedule: ExamSchedule[];
  qrData: string;
}

export interface GrievanceSubmission {
  id: string;
  category: 'Academic' | 'Examination' | 'Fee' | 'Infrastructure' | 'Other';
  subject: string;
  description: string;
  status: 'pending' | 'in-progress' | 'resolved' | 'rejected';
  submittedDate: string;
  response?: string;
}

export interface ConcessionPass {
  id: string;
  passType: 'Bus' | 'Rail' | 'Both';
  passNumber: string;
  validFrom: string;
  validUntil: string;
  status: 'active' | 'expired' | 'pending-renewal';
  route?: string;
  downloadUrl: string;
}

export interface AppSettings {
  themeMode: 'system' | 'dark' | 'light';
  attendanceAlerts: boolean;
  marksNotifications: boolean;
  feeDueReminders: boolean;
  generalAnnouncements: boolean;
  syncFrequency: 'realtime' | 'hourly' | 'daily';
}

export interface DeviceSession {
  id: string;
  deviceName: string;
  ipAddress: string;
  lastActive: string;
  isCurrent: boolean;
}

export type SettingsView = 
  | 'root'
  | 'synced-data'
  | 'allotment-memo'
  | 'hall-ticket'
  | 'fee-payment'
  | 'feedback'
  | 'grievance'
  | 'concession'
  | 'account-security'
  | 'change-password'
  | 'active-devices'
  | 'app-settings'
  | 'notifications'
  | 'about';

export interface Toast {
  id: string;
  message: string;
  type: 'success' | 'error' | 'info';
}
