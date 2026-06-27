import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { authenticateWithToken, db } from '../firebase';
import { doc, getDoc, setDoc } from 'firebase/firestore';
import { useStudentStore } from '../store/studentStore';
import { WORKER_URL } from '../config';

const FIRESTORE_KEY = {
  attendance:         'Attendance',
  attendanceDetails:  'AttendanceDetails',
  examResult:         'ExamResult',
  internalMark:       'InternalMark',
  assessment:         'Assessment',
  assignment:         'Assignment',
  seminar:            'Seminar',
  studyMaterial:      'StudyMaterial',
  dashboard:          'Dashboard',
  profile:            'Profile',
  onlineExam:         'OnlineExam',
  onlineClass:        'OnlineClass',
  fyugp:              'FYUGP',
  graceMark:          'GraceMark',
  hallTicket:         'HallTicket',
  allotmentMemo:      'AllotmentMemo',
  feePayment:         'FeePayment',
  feedback:           'FeedBack',
  grievance:          'Grievance',
  concession:         'Concession',
  internalUniversity: 'InternalUniversity',
};

export default function Login() {
  const [adm, setAdm] = useState('');
  const [loading, setLoading] = useState(false);
  const [statusText, setStatusText] = useState('');
  const [errorText, setErrorText] = useState('');
  
  const { setAdmissionNumber, setFirstLogin } = useStudentStore();
  const navigate = useNavigate();

  // Helper to save a section's scraped data to Firestore
  const saveSectionToFirestore = async (admissionNumber, section, data) => {
    const docRef = doc(db, 'students', admissionNumber);
    
    if (section === 'attendance') {
      const update = {
        'attendanceSubjectWise.data': data.subjectSummary || data.subjectWise || null,
        'attendanceSubjectWise.cachedAt': new Date(),
        'attendanceDetails.data': data.detailsLog || data.details || null,
        'attendanceDetails.cachedAt': new Date(),
        lastSeen: new Date(),
      };
      try {
        await setDoc(docRef, { admissionNumber, ...update }, { merge: true });
      } catch (err) {
        console.warn(`[Firestore] Failed to save attendance legacy keys:`, err);
      }

      const fKey = FIRESTORE_KEY[section] || section;
      const activeSem = data?.semesters?.find(s => s.selected || s.active)?.value ||
                        data?.semesterOptions?.find(s => s.selected || s.active)?.value;
      
      const standardUpdate = {
        [`${fKey}.data`]: data,
        [`${fKey}.cachedAt`]: new Date(),
        lastSeen: new Date(),
      };
      
      if (activeSem) {
        standardUpdate[`${fKey}_sem${activeSem}.data`] = data;
        standardUpdate[`${fKey}_sem${activeSem}.cachedAt`] = new Date();
      }

      await setDoc(docRef, { admissionNumber, ...standardUpdate }, { merge: true });
      return;
    }

    const fKey = FIRESTORE_KEY[section] || section;
    
    // Mask profile fields if it's the profile section
    let dataToSave = data;
    if (section === 'profile') {
      dataToSave = {
        name:          data.name || '',
        admissionNo:   data.admissionNo || '',
        course:        data.course || '',
        batch:         data.batch || '',
        division:      data.division || '',
        semester:      data.semester || '',
        department:    data.department || '',
        photoUrl:      data.photoUrl || '',
        phone:         data.phone ? '****' + data.phone.slice(-4) : '',
      };
    }

    const update = {
      [`${fKey}.data`]: dataToSave,
      [`${fKey}.cachedAt`]: new Date(),
      lastSeen: new Date(),
    };

    await setDoc(docRef, { admissionNumber, ...update }, { merge: true });
  };

  // Helper to clear worker session and retry once on SESSION_EXPIRED
  const fetchWithRetry = async (section, admissionNumber, retried = false) => {
    try {
      const res = await fetch(`${WORKER_URL}/api/scrape/${section}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ admissionNumber }),
      });

      if (!res.ok) {
        const errorData = await res.json();
        throw new Error(errorData.error || `HTTP ${res.status}`);
      }

      const json = await res.json();
      if (!json.success) throw new Error(json.error || 'Scrape failed');
      return json.data;
    } catch (err) {
      if ((err.message.includes('SESSION_EXPIRED') || err.message.includes('401')) && !retried) {
        // Clear session in worker
        await fetch(`${WORKER_URL}/api/session/clear`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ admissionNumber }),
        }).catch(console.warn);
        
        // Retry once
        return fetchWithRetry(section, admissionNumber, true);
      }
      throw err;
    }
  };

  const handleLogin = async (e) => {
    e.preventDefault();
    const admissionNumber = adm.trim();
    if (!admissionNumber) {
      setErrorText('Please enter your Admission Number');
      return;
    }

    setLoading(true);
    setErrorText('');
    setStatusText('Contacting portal...');

    try {
      // Step 1: Call worker auth endpoint
      const authRes = await fetch(`${WORKER_URL}/api/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ admissionNumber }),
      });

      if (!authRes.ok) {
        const authErr = await authRes.json();
        throw new Error(authErr.error || 'Invalid admission number or portal login failed');
      }

      const authData = await authRes.json();
      setStatusText('Authenticating securely...');

      // Step 2: Sign in with Firebase Custom Token
      await authenticateWithToken(authData.token);

      // Step 3: Check if student document exists in Firestore
      const docRef = doc(db, 'students', admissionNumber);
      const docSnap = await getDoc(docRef);

      if (docSnap.exists() && (docSnap.data().Profile || docSnap.data().profile)) {
        // Returning Student
        setStatusText('Welcome back! Loading cache...');
        setAdmissionNumber(admissionNumber);
        setFirstLogin(false);
        
        // Run lightweight verify in the background
        fetch(`${WORKER_URL}/api/auth/verify`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ admissionNumber }),
        }).catch(console.warn);

        navigate('/dashboard');
      } else {
        // First-Time Login Waterfall Scrape
        setFirstLogin(true);

        // 1a. scrapeProfile
        setStatusText('Syncing profile details...');
        const profileData = await fetchWithRetry('profile', admissionNumber);
        await saveSectionToFirestore(admissionNumber, 'profile', profileData);

        // 1b. scrapeStudyMaterial
        setStatusText('Mapping study materials...');
        try {
          const studyData = await fetchWithRetry('studyMaterial', admissionNumber);
          await saveSectionToFirestore(admissionNumber, 'studyMaterial', studyData);
        } catch (err) {
          console.warn('Study material waterfall skip:', err.message);
        }

        // 1c. scrapeDashboard
        setStatusText('Building your dashboard...');
        try {
          const dashData = await fetchWithRetry('dashboard', admissionNumber);
          await saveSectionToFirestore(admissionNumber, 'dashboard', dashData);
        } catch (err) {
          console.warn('Dashboard waterfall skip:', err.message);
        }

        // 1d. scrapeAttendance
        setStatusText('Retrieving attendance logs...');
        try {
          const attData = await fetchWithRetry('attendance', admissionNumber);
          await saveSectionToFirestore(admissionNumber, 'attendance', attData);
        } catch (err) {
          console.warn('Attendance waterfall skip:', err.message);
        }

        // 1e. scrapeExamResult
        setStatusText('Retrieving exam results...');
        try {
          const examData = await fetchWithRetry('examResult', admissionNumber);
          await saveSectionToFirestore(admissionNumber, 'examResult', examData);
        } catch (err) {
          console.warn('Exam result waterfall skip:', err.message);
        }

        setAdmissionNumber(admissionNumber);
        navigate('/dashboard');
      }
    } catch (err) {
      console.error(err);
      setErrorText(err.message || 'An unexpected error occurred. Please try again.');
      setLoading(false);
    }
  };

  return (
    <div style={styles.container}>
      <div style={styles.glow} />
      
      <div className="card fade-in" style={styles.loginCard}>
        <div style={styles.logoHeader}>
          <div style={styles.logoIcon}>M</div>
          <h1 style={styles.title}>MacHub</h1>
          <p style={styles.subtitle}>Mar Augusthinose College Student Portal</p>
        </div>

        {errorText && (
          <div className="alert alert-error" style={{ marginBottom: 16 }}>
            <span>⚠️</span>
            <span>{errorText}</span>
          </div>
        )}

        {loading ? (
          <div style={styles.loadingContainer}>
            <div className="spin" style={styles.spinner}>⚙️</div>
            <p style={styles.statusText}>{statusText}</p>
            <p style={styles.hintText}>Please wait, configuring your workspace.</p>
          </div>
        ) : (
          <form onSubmit={handleLogin} style={styles.form}>
            <div style={styles.inputGroup}>
              <label style={styles.label} htmlFor="admNo">Admission Number</label>
              <input
                id="admNo"
                className="input"
                type="text"
                placeholder="Enter your Admission Number (e.g. 12965)"
                value={adm}
                onChange={(e) => setAdm(e.target.value)}
                autoComplete="off"
                disabled={loading}
              />
            </div>
            
            <button className="btn btn-primary" type="submit" style={styles.submitBtn}>
              Sign In
            </button>
          </form>
        )}

        <div style={styles.footer}>
          <p>© 2026 MacHub. Apple-inspired student portal.</p>
        </div>
      </div>
    </div>
  );
}

const styles = {
  container: {
    minHeight: '100vh',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    background: '#07070a',
    position: 'relative',
    overflow: 'hidden',
    padding: '20px',
  },
  glow: {
    position: 'absolute',
    width: '400px',
    height: '400px',
    background: 'radial-gradient(circle, rgba(79, 142, 247, 0.15) 0%, rgba(0,0,0,0) 70%)',
    top: '50%',
    left: '50%',
    transform: 'translate(-50%, -50%)',
    pointerEvents: 'none',
  },
  loginCard: {
    width: '100%',
    maxWidth: '420px',
    padding: '40px 32px',
    background: 'rgba(17, 17, 24, 0.8)',
    boxShadow: '0 20px 40px rgba(0,0,0,0.5)',
  },
  logoHeader: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    textAlign: 'center',
    marginBottom: '32px',
  },
  logoIcon: {
    width: '64px',
    height: '64px',
    borderRadius: '16px',
    background: 'linear-gradient(135deg, #4f8ef7, #00d4aa)',
    color: '#ffffff',
    fontSize: '32px',
    fontWeight: 800,
    fontFamily: 'Syne, sans-serif',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: '16px',
    boxShadow: '0 8px 24px rgba(79, 142, 247, 0.3)',
  },
  title: {
    fontSize: '28px',
    fontWeight: 800,
    color: 'var(--text-primary)',
    fontFamily: 'Syne, sans-serif',
    marginBottom: '6px',
  },
  subtitle: {
    fontSize: '13px',
    color: 'var(--text-secondary)',
    lineHeight: 1.4,
  },
  form: {
    display: 'flex',
    flexDirection: 'column',
    gap: '20px',
  },
  inputGroup: {
    display: 'flex',
    flexDirection: 'column',
    gap: '8px',
  },
  label: {
    fontSize: '12px',
    fontWeight: 600,
    color: 'var(--text-secondary)',
    textTransform: 'uppercase',
    letterSpacing: '0.5px',
  },
  submitBtn: {
    width: '100%',
    justifyContent: 'center',
    padding: '12px',
    fontSize: '15px',
    marginTop: '8px',
  },
  loadingContainer: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    padding: '30px 10px',
    textAlign: 'center',
  },
  spinner: {
    fontSize: '40px',
    marginBottom: '16px',
    color: 'var(--accent)',
  },
  statusText: {
    fontSize: '15px',
    fontWeight: 600,
    color: 'var(--text-primary)',
    marginBottom: '4px',
  },
  hintText: {
    fontSize: '12px',
    color: 'var(--text-muted)',
  },
  footer: {
    marginTop: '32px',
    textAlign: 'center',
    fontSize: '11px',
    color: 'var(--text-muted)',
  },
};
