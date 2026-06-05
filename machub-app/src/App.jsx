import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { useStudentStore } from './store/studentStore';

// Layout
import AppShell from './components/AppShell';

// Pages
import Login from './pages/Login';
import Dashboard from './pages/Dashboard';
import Profile from './pages/Profile';
import Attendance from './pages/Attendance';
import Assessment from './pages/Assessment';
import StudyMaterial from './pages/StudyMaterial';
import Assignment from './pages/Assignment';
import Seminar from './pages/Seminar';
import InternalMark from './pages/InternalMark';
import ExamResult from './pages/ExamResult';
import HallTicket from './pages/HallTicket';
import AllotmentMemo from './pages/AllotmentMemo';
import FeePayment from './pages/FeePayment';
import OnlineExam from './pages/OnlineExam';
import OnlineClass from './pages/OnlineClass';
import FYUGP from './pages/FYUGP';
import GraceMark from './pages/GraceMark';
import FeedBack from './pages/FeedBack';
import Grievance from './pages/Grievance';
import Concession from './pages/Concession';

/** Route guard — redirects unauthenticated users to login */
function PrivateRoute({ children }) {
  const { isLoggedIn } = useStudentStore();
  if (!isLoggedIn) return <Navigate to="/login" replace />;
  return children;
}

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        {/* Public */}
        <Route path="/login" element={<Login />} />

        {/* Protected — inside AppShell (sidebar + topbar) */}
        <Route path="/" element={<PrivateRoute><AppShell /></PrivateRoute>}>
          <Route index element={<Navigate to="/dashboard" replace />} />
          <Route path="dashboard" element={<Dashboard />} />
          <Route path="profile" element={<Profile />} />
          <Route path="attendance" element={<Attendance />} />
          <Route path="academic/assessment" element={<Assessment />} />
          <Route path="academic/study-material" element={<StudyMaterial />} />
          <Route path="academic/assignment" element={<Assignment />} />
          <Route path="academic/seminar" element={<Seminar />} />
          <Route path="academic/internal-mark" element={<InternalMark />} />
          <Route path="academic/exam-result" element={<ExamResult />} />
          <Route path="academic/online-exam" element={<OnlineExam />} />
          <Route path="academic/online-class" element={<OnlineClass />} />
          <Route path="academic/fyugp" element={<FYUGP />} />
          <Route path="academic/grace-mark" element={<GraceMark />} />
          <Route path="hall-ticket" element={<HallTicket />} />
          <Route path="allotment-memo" element={<AllotmentMemo />} />
          <Route path="fee-payment" element={<FeePayment />} />
          <Route path="feedback" element={<FeedBack />} />
          <Route path="grievance" element={<Grievance />} />
          <Route path="concession" element={<Concession />} />
        </Route>

        {/* Catch-all */}
        <Route path="*" element={<Navigate to="/dashboard" replace />} />
      </Routes>
    </BrowserRouter>
  );
}
