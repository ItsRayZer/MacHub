import React, { useState, useEffect } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import { doc, getDoc, setDoc } from 'firebase/firestore';
import { db } from '../firebase';
import { WORKER_URL } from '../config';
import { useStudentStore } from '../store/studentStore';
import bcrypt from 'bcryptjs';

const MONTH_NAMES = [
  { value: '01', label: 'January' },
  { value: '02', label: 'February' },
  { value: '03', label: 'March' },
  { value: '04', label: 'April' },
  { value: '05', label: 'May' },
  { value: '06', label: 'June' },
  { value: '07', label: 'July' },
  { value: '08', label: 'August' },
  { value: '09', label: 'September' },
  { value: '10', label: 'October' },
  { value: '11', label: 'November' },
  { value: '12', label: 'December' },
];

const BLOOD_GROUPS = ['A+', 'A-', 'B+', 'B-', 'AB+', 'AB-', 'O+', 'O-'];

export default function PinLock() {
  const [searchParams] = useSearchParams();
  const admissionNumber = searchParams.get('admissionNumber') || '';
  const navigate = useNavigate();
  const store = useStudentStore();

  const [loading, setLoading] = useState(true);
  const [errorText, setErrorText] = useState('');
  const [statusText, setStatusText] = useState('');

  // Profile data
  const [studentDoc, setStudentDoc] = useState(null);
  const [studentName, setStudentName] = useState('Student');
  const [studentCourse, setStudentCourse] = useState('');
  const [studentPhoto, setStudentPhoto] = useState('/avatar.jpg');

  // Lock Page Modes: 'lock' = PIN entry, 'forgot' = Identity Verification, 'reset' = Set New PIN
  const [mode, setMode] = useState('lock');

  // Lock state
  const [pin, setPin] = useState('');
  const [pinLength, setPinLength] = useState(4);
  const [pinHash, setPinHash] = useState(null);

  // Identity Verification State (Forgot PIN)
  const [questions, setQuestions] = useState([]);
  const [answers, setAnswers] = useState({});
  const [attemptsRemaining, setAttemptsRemaining] = useState(5);
  const [lockedUntil, setLockedUntil] = useState(null);
  const [lockCountdown, setLockCountdown] = useState(0);

  // Reset PIN State
  const [newPinLength, setNewPinLength] = useState(4);
  const [newPin, setNewPin] = useState('');
  const [confirmNewPin, setConfirmNewPin] = useState('');

  // Load student doc and details
  const loadDetails = async () => {
    if (!admissionNumber) {
      setErrorText('No admission number provided');
      setLoading(false);
      return;
    }
    setLoading(true);
    try {
      const snap = await getDoc(doc(db, 'students', admissionNumber));
      if (!snap.exists()) {
        throw new Error('Profile not found in database');
      }
      const data = snap.data();
      setStudentDoc(data);

      const profile = data.profile?.data || {};
      setStudentName(profile.name || 'Student');
      setStudentCourse(profile.course ? `${profile.course} — Batch ${profile.batch || ''}` : '');
      setStudentPhoto(profile.photoUrl || '/avatar.jpg');

      const sec = data.security || {};
      setPinLength(sec.pinLength || 4);
      setPinHash(sec.pinHash || null);

      if (sec.verificationLockedUntil) {
        const lockedTime = new Date(sec.verificationLockedUntil).getTime();
        if (lockedTime > Date.now()) {
          setLockedUntil(lockedTime);
          setLockCountdown(Math.ceil((lockedTime - Date.now()) / 1000));
        }
      }
      if (sec.verificationAttempts !== undefined) {
        setAttemptsRemaining(Math.max(0, 5 - sec.verificationAttempts));
      }
    } catch (err) {
      setErrorText(err.message || 'Failed to load profile details');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadDetails();
  }, [admissionNumber]);

  // Lock countdown timer
  useEffect(() => {
    if (!lockedUntil) return;
    const timer = setInterval(() => {
      const remaining = Math.ceil((lockedUntil - Date.now()) / 1000);
      if (remaining <= 0) {
        setLockedUntil(null);
        setLockCountdown(0);
        setAttemptsRemaining(5);
        clearInterval(timer);
      } else {
        setLockCountdown(remaining);
      }
    }, 1000);
    return () => clearInterval(timer);
  }, [lockedUntil]);

  // Pin entry handler
  useEffect(() => {
    if (mode !== 'lock' || pin.length !== pinLength || !pinHash) return;
    
    // Validate PIN
    const match = bcrypt.compareSync(pin, pinHash);
    if (match) {
      handleUnlockSuccess();
    } else {
      setErrorText('Incorrect PIN. Please try again.');
      setPin('');
      // Vibrate if available
      if (navigator.vibrate) navigator.vibrate(200);
    }
  }, [pin, pinLength, pinHash, mode]);

  const handleUnlockSuccess = async () => {
    setLoading(true);
    setErrorText('');
    setStatusText('Unlocking profile...');

    try {
      const deviceToken = Math.random().toString(36).substring(2) + Date.now().toString(36);
      
      const docRef = doc(db, 'students', admissionNumber);
      const currentTokens = studentDoc?.security?.deviceTokens || [];
      const updatedTokens = [...currentTokens, deviceToken];

      await setDoc(docRef, {
        security: {
          deviceTokens: updatedTokens,
          lastVerifiedAt: new Date().toISOString(),
        }
      }, { merge: true });

      localStorage.setItem('machub_device_token', deviceToken);
      store.setAdmissionNumber(admissionNumber);
      store.setSecurityDeviceToken(deviceToken);
      store.setSecurityClaimed(true);
      store.setSecurityUnlocked(true);

      showToast('Profile unlocked!', 'success');
      navigate(`/profile?admissionNumber=${admissionNumber}`);
    } catch (err) {
      setErrorText(err.message || 'Failed to authorize device');
      setLoading(false);
    }
  };

  const handleBypass = async () => {
    if (pinHash) return; // Cannot bypass if PIN is configured
    await handleUnlockSuccess();
  };

  // Generate Questions for Identity reset
  const handleForgotPinClick = () => {
    if (!studentDoc) return;
    const profile = studentDoc.profile?.data || {};
    const pool = [];

    if (profile.dob) {
      pool.push({ id: 'dob', label: 'Your date of birth', type: 'dob' });
    }
    if (profile.phone) {
      pool.push({ id: 'phone', label: 'Your registered mobile number', type: 'phone' });
      pool.push({ id: 'phoneLast4', label: 'Last 4 digits of your registered phone number', type: 'phoneLast4' });
    }
    if (profile.aadhar) {
      pool.push({ id: 'aadhaarLast4', label: 'Last 4 digits of your Aadhaar ID', type: 'aadharLast4' });
    }
    if (profile.guardianName) {
      pool.push({ id: 'fatherName', label: "Your father's/guardian's full name", type: 'fatherName' });
    }
    if (profile.guardianPhone) {
      pool.push({ id: 'parentPhone', label: "Your parent's/guardian's phone number", type: 'parentPhone' });
    }
    if (profile.email) {
      pool.push({ id: 'email', label: 'Your registered email address', type: 'email' });
    }
    if (profile.bloodGroup || profile.blood_group) {
      pool.push({ id: 'bloodGroup', label: 'Your blood group', type: 'bloodGroup' });
    }
    const address = profile.address || profile.permanentAddress || '';
    if (address && /\b\d{6}\b/.test(address)) {
      pool.push({ id: 'pincode', label: 'PIN code of your permanent address', type: 'pincode' });
    }

    const shuffled = pool.sort(() => 0.5 - Math.random());
    const selected = shuffled.slice(0, Math.min(3, shuffled.length));
    const finalQuestions = selected.sort(() => 0.5 - Math.random());

    setQuestions(finalQuestions);
    const initialAnswers = {};
    finalQuestions.forEach(q => {
      if (q.type === 'dob') {
        initialAnswers.dob = { dd: '', mm: '', yyyy: '' };
      } else {
        initialAnswers[q.id] = '';
      }
    });
    setAnswers(initialAnswers);
    setErrorText('');
    setMode('forgot');
  };

  // Verify Identity Answers
  const handleVerifyForgotAnswers = async (e) => {
    e.preventDefault();
    if (lockedUntil) return;

    const formattedAnswers = {};
    let incomplete = false;

    questions.forEach(q => {
      if (q.type === 'dob') {
        const { dd, mm, yyyy } = answers.dob || {};
        if (!dd || !mm || !yyyy) {
          incomplete = true;
        } else {
          formattedAnswers.dob = `${dd}-${mm}-${yyyy}`;
        }
      } else {
        const val = answers[q.id];
        if (!val) {
          incomplete = true;
        } else {
          formattedAnswers[q.id] = val;
        }
      }
    });

    if (incomplete) {
      setErrorText('Please answer all verification questions.');
      return;
    }

    setLoading(true);
    setErrorText('');

    try {
      const res = await fetch(`${WORKER_URL}/api/auth/verify-profile-data`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ admissionNumber, answers: formattedAnswers }),
      });

      const json = await res.json();
      if (json.success && json.verified) {
        setStatusText('Identity verified!');
        setTimeout(() => {
          setMode('reset');
          setLoading(false);
        }, 800);
      } else {
        if (json.error === 'LOCKED') {
          const lockedTime = new Date(json.lockedUntil).getTime();
          setLockedUntil(lockedTime);
          setLockCountdown(Math.ceil((lockedTime - Date.now()) / 1000));
          throw new Error('Too many failed attempts. Try again in 30 minutes.');
        } else {
          const remaining = json.attemptsRemaining !== undefined ? json.attemptsRemaining : 5;
          setAttemptsRemaining(remaining);
          if (remaining === 0) {
            const lockedTime = Date.now() + 30 * 60 * 1000;
            setLockedUntil(lockedTime);
            setLockCountdown(Math.ceil((lockedTime - Date.now()) / 1000));
            throw new Error('Too many failed attempts. Try again in 30 minutes.');
          }

          let wrongMsg = "One or more answers don't match your college profile.";
          if (json.wrongQuestions && json.wrongQuestions.length > 0) {
            const wrongIndices = json.wrongQuestions.map(qKey => {
              const idx = questions.findIndex(q => q.id === qKey || (qKey === 'dob' && q.type === 'dob'));
              return idx >= 0 ? `Question ${idx + 1}` : '';
            }).filter(Boolean);
            if (wrongIndices.length > 0) {
              wrongMsg = `${wrongIndices.join(' and ')} failed matching check. Please try again.`;
            }
          }
          
          setErrorText(`${wrongMsg} (${remaining} attempts remaining)`);
          
          // Re-generate questions
          handleForgotPinClick();
        }
      }
    } catch (err) {
      setErrorText(err.message || 'Verification failed');
      setLoading(false);
    }
  };

  // Save new PIN
  const handleSaveNewPin = async (skip = false) => {
    setLoading(true);
    setErrorText('');
    setStatusText(skip ? 'Saving settings...' : 'Saving new PIN...');

    try {
      let hashedPin = null;
      if (!skip) {
        if (!newPin || newPin.length !== newPinLength) {
          throw new Error(`PIN must be exactly ${newPinLength} digits`);
        }
        if (newPin !== confirmNewPin) {
          setNewPin('');
          setConfirmNewPin('');
          throw new Error("PINs don't match. Please try again.");
        }
        hashedPin = bcrypt.hashSync(newPin, 10);
      }

      const deviceToken = Math.random().toString(36).substring(2) + Date.now().toString(36);
      const docRef = doc(db, 'students', admissionNumber);
      const currentTokens = studentDoc?.security?.deviceTokens || [];
      const updatedTokens = [...currentTokens, deviceToken];

      const securityUpdate = {
        pinHash: hashedPin,
        pinLength: newPinLength,
        deviceTokens: updatedTokens,
        lastVerifiedAt: new Date().toISOString(),
      };

      await setDoc(docRef, {
        security: securityUpdate
      }, { merge: true });

      localStorage.setItem('machub_device_token', deviceToken);
      store.setAdmissionNumber(admissionNumber);
      store.setSecurityDeviceToken(deviceToken);
      store.setSecurityClaimed(true);
      store.setSecurityUnlocked(true);

      showToast(skip ? 'PIN cleared and profile unlocked!' : 'New PIN set and profile unlocked!', 'success');
      navigate(`/profile?admissionNumber=${admissionNumber}`);
    } catch (err) {
      setErrorText(err.message || 'Failed to update PIN');
      setLoading(false);
    }
  };

  const showToast = (msg, type) => {
    try {
      const { useSettingsStore } = require('../store/settingsStore');
      useSettingsStore.getState().showToast(msg, type);
    } catch (e) {
      alert(msg);
    }
  };

  // Loading Screen
  if (loading && mode === 'lock') {
    return (
      <div style={styles.container}>
        <div style={styles.glow} />
        <div className="card" style={styles.card}>
          <div style={styles.loadingContainer}>
            <div className="spin" style={styles.spinner}>⚙️</div>
            <p style={styles.statusText}>{statusText || 'Loading profile security configuration...'}</p>
          </div>
        </div>
      </div>
    );
  }

  // Locked countdown screen
  if (lockedUntil && lockCountdown > 0 && mode === 'forgot') {
    const mins = Math.floor(lockCountdown / 60);
    const secs = lockCountdown % 60;
    return (
      <div style={styles.container}>
        <div style={styles.glow} />
        <div className="card" style={styles.card}>
          <div style={styles.logoHeader}>
            <div style={styles.lockIcon}>🔒</div>
            <h1 style={styles.title}>Verification Locked</h1>
            <p style={styles.subtitle}>Too many failed attempts to reset your PIN.</p>
          </div>
          <div style={styles.countdownContainer}>
            <div style={styles.timerText}>
              {String(mins).padStart(2, '0')}:{String(secs).padStart(2, '0')}
            </div>
            <p style={styles.hintText}>Please wait 30 minutes before trying again.</p>
          </div>
          <button className="btn" onClick={() => setMode('lock')} style={{ marginTop: 20, width: '100%', justifyContent: 'center' }}>
            Back to PIN Screen
          </button>
        </div>
      </div>
    );
  }

  return (
    <div style={styles.container}>
      <div style={styles.glow} />

      <div className="card fade-in" style={styles.card}>
        
        {/* MODE: LOCK (Enter PIN) */}
        {mode === 'lock' && (
          <div>
            <div style={styles.logoHeader}>
              <div style={styles.lockIcon}>🔒</div>
              <h1 style={styles.title}>Profile Locked</h1>
              <p style={styles.subtitle}>Enter your PIN to unlock {studentName}'s profile</p>
            </div>

            {/* Profile Mini Card */}
            <div style={styles.miniCard}>
              <img
                src={studentPhoto}
                alt={studentName}
                style={styles.miniAvatar}
                onError={(e) => { e.target.src = '/avatar.jpg'; }}
              />
              <div style={styles.miniMeta}>
                <h3 style={styles.miniName}>{studentName}</h3>
                <p style={styles.miniSub}>{studentCourse}</p>
                <p style={styles.miniCode}>ID: {admissionNumber}</p>
              </div>
            </div>

            {errorText && (
              <div className="alert alert-error" style={{ marginBottom: 16 }}>
                <span>⚠️</span>
                <span>{errorText}</span>
              </div>
            )}

            <div style={styles.inputGroup}>
              <div style={styles.pinDotContainer}>
                {Array.from({ length: pinLength }).map((_, i) => (
                  <div
                    key={i}
                    style={{
                      ...styles.pinDot,
                      ...(pin.length > i ? styles.pinDotFilled : {})
                    }}
                  />
                ))}
              </div>
            </div>

            {/* Keypad */}
            <div style={styles.keypad}>
              {[1, 2, 3, 4, 5, 6, 7, 8, 9, 'Clear', 0, 'Delete'].map((keyVal) => {
                const isSpecial = typeof keyVal === 'string';
                return (
                  <button
                    key={keyVal}
                    style={{
                      ...styles.keypadBtn,
                      ...(isSpecial ? styles.keypadBtnSpecial : {})
                    }}
                    onClick={() => {
                      if (keyVal === 'Clear') {
                        setPin('');
                      } else if (keyVal === 'Delete') {
                        if (pin.length > 0) {
                          setPin(pin.slice(0, -1));
                        }
                      } else {
                        if (pin.length < pinLength) {
                          setPin(pin + keyVal);
                        }
                      }
                    }}
                  >
                    {keyVal}
                  </button>
                );
              })}
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: 10, marginTop: 20 }}>
              <button
                className="btn"
                onClick={handleForgotPinClick}
                style={{ width: '100%', justifyContent: 'center', background: 'rgba(255,255,255,0.03)', color: '#00F5D4' }}
              >
                Forgot PIN?
              </button>
              
              {!pinHash && (
                <button
                  className="btn btn-primary"
                  onClick={handleBypass}
                  style={{ width: '100%', justifyContent: 'center' }}
                >
                  Bypass / No PIN Set
                </button>
              )}
            </div>
          </div>
        )}

        {/* MODE: FORGOT (Verification Questions) */}
        {mode === 'forgot' && (
          <div>
            <div style={styles.logoHeader}>
              <div style={styles.iconCircle}>🛡️</div>
              <h1 style={styles.title}>Reset PIN</h1>
              <p style={styles.subtitle}>Answer these security questions to verify ownership and reset your PIN.</p>
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
                <p style={styles.statusText}>Checking answers...</p>
              </div>
            ) : (
              <form onSubmit={handleVerifyForgotAnswers} style={styles.form}>
                {questions.map((q, idx) => (
                  <div key={q.id} style={styles.inputGroup}>
                    <label style={styles.label}>
                      Question {idx + 1}: {q.label}
                    </label>

                    {q.type === 'dob' ? (
                      <div style={styles.dobGrid}>
                        <input
                          className="input text-center"
                          type="text"
                          maxLength={2}
                          placeholder="DD"
                          value={answers.dob?.dd || ''}
                          onChange={(e) => {
                            const val = e.target.value.replace(/\D/g, '');
                            setAnswers(prev => ({
                              ...prev,
                              dob: { ...prev.dob, dd: val }
                            }));
                          }}
                        />
                        <select
                          className="input"
                          style={{ appearance: 'none', WebkitAppearance: 'none' }}
                          value={answers.dob?.mm || ''}
                          onChange={(e) => {
                            setAnswers(prev => ({
                              ...prev,
                              dob: { ...prev.dob, mm: e.target.value }
                            }));
                          }}
                        >
                          <option value="">Month</option>
                          {MONTH_NAMES.map(m => (
                            <option key={m.value} value={m.value}>{m.label}</option>
                          ))}
                        </select>
                        <input
                          className="input text-center"
                          type="text"
                          maxLength={4}
                          placeholder="YYYY"
                          value={answers.dob?.yyyy || ''}
                          onChange={(e) => {
                            const val = e.target.value.replace(/\D/g, '');
                            setAnswers(prev => ({
                              ...prev,
                              dob: { ...prev.dob, yyyy: val }
                            }));
                          }}
                        />
                      </div>
                    ) : q.type === 'bloodGroup' ? (
                      <select
                        className="input"
                        value={answers[q.id] || ''}
                        onChange={(e) => {
                          setAnswers(prev => ({ ...prev, [q.id]: e.target.value }));
                        }}
                      >
                        <option value="">Select Blood Group</option>
                        {BLOOD_GROUPS.map(bg => (
                          <option key={bg} value={bg}>{bg}</option>
                        ))}
                      </select>
                    ) : q.type === 'phone' || q.type === 'parentPhone' ? (
                      <div style={styles.phoneInputWrap}>
                        <span style={styles.prefix}>+91</span>
                        <input
                          className="input"
                          type="text"
                          maxLength={10}
                          placeholder="10-digit mobile number"
                          value={answers[q.id] || ''}
                          onChange={(e) => {
                            const val = e.target.value.replace(/\D/g, '');
                            setAnswers(prev => ({ ...prev, [q.id]: val }));
                          }}
                          style={{ flex: 1 }}
                        />
                      </div>
                    ) : q.type === 'phoneLast4' || q.type === 'aadharLast4' ? (
                      <div style={styles.digitInputGrid}>
                        {Array.from({ length: 4 }).map((_, i) => (
                          <input
                            key={i}
                            className="input text-center font-bold"
                            type="text"
                            maxLength={1}
                            placeholder="•"
                            value={answers[q.id]?.[i] || ''}
                            onChange={(e) => {
                              const val = e.target.value.replace(/\D/g, '');
                              const currentVal = answers[q.id] || '';
                              let newVal = currentVal.split('');
                              newVal[i] = val;
                              newVal = newVal.join('');
                              setAnswers(prev => ({ ...prev, [q.id]: newVal }));
                              
                              if (val && e.target.nextSibling) {
                                e.target.nextSibling.focus();
                              }
                            }}
                          />
                        ))}
                      </div>
                    ) : q.type === 'pincode' ? (
                      <input
                        className="input"
                        type="text"
                        maxLength={6}
                        placeholder="6-digit pincode"
                        value={answers[q.id] || ''}
                        onChange={(e) => {
                          const val = e.target.value.replace(/\D/g, '');
                          setAnswers(prev => ({ ...prev, [q.id]: val }));
                        }}
                      />
                    ) : (
                      <input
                        className="input"
                        type="text"
                        placeholder="Enter full name or email address"
                        value={answers[q.id] || ''}
                        onChange={(e) => {
                          setAnswers(prev => ({ ...prev, [q.id]: e.target.value }));
                        }}
                      />
                    )}
                  </div>
                ))}

                <div style={{ display: 'flex', gap: 12, marginTop: 12 }}>
                  <button
                    className="btn"
                    type="button"
                    onClick={() => setMode('lock')}
                    style={{ flex: 1, justifySelf: 'center', background: 'rgba(255,255,255,0.05)', color: 'white', justifyContent: 'center' }}
                  >
                    Cancel
                  </button>
                  <button className="btn btn-primary" type="submit" style={{ flex: 2, justifyContent: 'center' }}>
                    Verify Answers
                  </button>
                </div>
              </form>
            )}
          </div>
        )}

        {/* MODE: RESET (Set New PIN) */}
        {mode === 'reset' && (
          <div>
            <div style={styles.logoHeader}>
              <div style={styles.iconCircle}>🔒</div>
              <h1 style={styles.title}>Choose New PIN</h1>
              <p style={styles.subtitle}>Create a new passcode to secure your personal data.</p>
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
              </div>
            ) : (
              <div style={styles.form}>
                <div style={styles.inputGroup}>
                  <label style={styles.label}>Choose PIN Length</label>
                  <div style={styles.toggleContainer}>
                    <button
                      style={{
                        ...styles.toggleBtn,
                        ...(newPinLength === 4 ? styles.toggleBtnActive : {})
                      }}
                      onClick={() => { setNewPinLength(4); setNewPin(''); setConfirmNewPin(''); }}
                    >
                      4 Digits
                    </button>
                    <button
                      style={{
                        ...styles.toggleBtn,
                        ...(newPinLength === 6 ? styles.toggleBtnActive : {})
                      }}
                      onClick={() => { setNewPinLength(6); setNewPin(''); setConfirmNewPin(''); }}
                    >
                      6 Digits
                    </button>
                  </div>
                </div>

                <div style={styles.inputGroup}>
                  <label style={styles.label}>Enter new PIN</label>
                  <div style={styles.pinDotContainer}>
                    {Array.from({ length: newPinLength }).map((_, i) => (
                      <div
                        key={i}
                        style={{
                          ...styles.pinDot,
                          ...(newPin.length > i ? styles.pinDotFilled : {})
                        }}
                      />
                    ))}
                  </div>
                </div>

                <div style={styles.inputGroup}>
                  <label style={styles.label}>Confirm new PIN</label>
                  <div style={styles.pinDotContainer}>
                    {Array.from({ length: newPinLength }).map((_, i) => (
                      <div
                        key={i}
                        style={{
                          ...styles.pinDot,
                          ...(confirmNewPin.length > i ? styles.pinDotFilled : {})
                        }}
                      />
                    ))}
                  </div>
                </div>

                {/* Keypad */}
                <div style={styles.keypad}>
                  {[1, 2, 3, 4, 5, 6, 7, 8, 9, 'Clear', 0, 'Delete'].map((keyVal) => {
                    const isSpecial = typeof keyVal === 'string';
                    return (
                      <button
                        key={keyVal}
                        style={{
                          ...styles.keypadBtn,
                          ...(isSpecial ? styles.keypadBtnSpecial : {})
                        }}
                        onClick={() => {
                          if (keyVal === 'Clear') {
                            setNewPin('');
                            setConfirmNewPin('');
                          } else if (keyVal === 'Delete') {
                            if (confirmNewPin.length > 0) {
                              setConfirmNewPin(confirmNewPin.slice(0, -1));
                            } else if (newPin.length > 0) {
                              setNewPin(newPin.slice(0, -1));
                            }
                          } else {
                            if (newPin.length < newPinLength) {
                              setNewPin(newPin + keyVal);
                            } else if (confirmNewPin.length < newPinLength) {
                              setConfirmNewPin(confirmNewPin + keyVal);
                            }
                          }
                        }}
                      >
                        {keyVal}
                      </button>
                    );
                  })}
                </div>

                <div style={{ display: 'flex', gap: 12, marginTop: 16 }}>
                  <button
                    className="btn"
                    onClick={() => handleSaveNewPin(true)}
                    style={{ flex: 1, background: 'rgba(255,255,255,0.05)', color: 'white', justifyContent: 'center' }}
                  >
                    Clear PIN
                  </button>
                  <button
                    className="btn btn-primary"
                    onClick={() => handleSaveNewPin(false)}
                    style={{ flex: 2, justifyContent: 'center' }}
                    disabled={newPin.length !== newPinLength || confirmNewPin.length !== newPinLength}
                  >
                    Set PIN & Unlock
                  </button>
                </div>
              </div>
            )}
          </div>
        )}
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
    overflowY: 'auto',
    padding: '40px 20px',
  },
  glow: {
    position: 'absolute',
    width: '500px',
    height: '500px',
    background: 'radial-gradient(circle, rgba(0, 245, 212, 0.1) 0%, rgba(3, 4, 94, 0.15) 50%, rgba(0,0,0,0) 80%)',
    top: '50%',
    left: '50%',
    transform: 'translate(-50%, -50%)',
    pointerEvents: 'none',
  },
  card: {
    width: '100%',
    maxWidth: '460px',
    padding: '32px 24px',
    background: 'rgba(12, 12, 18, 0.85)',
    border: '1px solid rgba(255, 255, 255, 0.08)',
    borderRadius: '24px',
    boxShadow: '0 24px 64px rgba(0,0,0,0.6)',
    backdropFilter: 'blur(30px)',
    zIndex: 1,
  },
  logoHeader: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    textAlign: 'center',
    marginBottom: '20px',
  },
  iconCircle: {
    width: '60px',
    height: '60px',
    borderRadius: '18px',
    background: 'linear-gradient(135deg, #00F5D4, #03045E)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    fontSize: '28px',
    marginBottom: '16px',
    boxShadow: '0 8px 24px rgba(0, 245, 212, 0.25)',
  },
  lockIcon: {
    width: '60px',
    height: '60px',
    borderRadius: '18px',
    background: 'linear-gradient(135deg, #ef4444, #03045E)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    fontSize: '28px',
    marginBottom: '16px',
    boxShadow: '0 8px 24px rgba(239, 68, 68, 0.25)',
  },
  title: {
    fontSize: '22px',
    fontWeight: 800,
    color: '#ffffff',
    fontFamily: 'Syne, sans-serif',
    marginBottom: '6px',
  },
  subtitle: {
    fontSize: '12px',
    color: '#8D99AE',
    lineHeight: 1.5,
    maxWidth: '320px',
  },
  miniCard: {
    display: 'flex',
    alignItems: 'center',
    gap: '16px',
    padding: '16px',
    background: 'rgba(255, 255, 255, 0.02)',
    border: '1px solid rgba(255, 255, 255, 0.06)',
    borderRadius: '16px',
    marginBottom: '24px',
  },
  miniAvatar: {
    width: '50px',
    height: '50px',
    borderRadius: '50%',
    objectCover: 'cover',
    border: '2px solid rgba(0, 245, 212, 0.3)',
  },
  miniMeta: {
    display: 'flex',
    flexDirection: 'column',
    gap: '2px',
  },
  miniName: {
    fontSize: '14px',
    fontWeight: 700,
    color: '#ffffff',
  },
  miniSub: {
    fontSize: '11px',
    color: '#8D99AE',
  },
  miniCode: {
    fontSize: '10px',
    fontWeight: 600,
    color: '#00F5D4',
    fontFamily: 'monospace',
  },
  form: {
    display: 'flex',
    flexDirection: 'column',
    gap: '18px',
  },
  inputGroup: {
    display: 'flex',
    flexDirection: 'column',
    gap: '8px',
  },
  label: {
    fontSize: '11px',
    fontWeight: 600,
    color: '#ADE8F4',
    textTransform: 'uppercase',
    letterSpacing: '0.5px',
  },
  dobGrid: {
    display: 'grid',
    gridTemplateColumns: '1fr 2fr 1.5fr',
    gap: '8px',
  },
  digitInputGrid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(4, 1fr)',
    gap: '12px',
  },
  phoneInputWrap: {
    display: 'flex',
    alignItems: 'center',
    border: '1px solid rgba(255,255,255,0.08)',
    borderRadius: '10px',
    background: 'rgba(255,255,255,0.02)',
    overflow: 'hidden',
  },
  prefix: {
    padding: '0 12px',
    fontSize: '13px',
    fontWeight: 600,
    color: '#8D99AE',
    borderRight: '1px solid rgba(255,255,255,0.08)',
  },
  toggleContainer: {
    display: 'flex',
    background: 'rgba(255, 255, 255, 0.03)',
    borderRadius: '12px',
    padding: '3px',
    border: '1px solid rgba(255,255,255,0.06)',
  },
  toggleBtn: {
    flex: 1,
    padding: '8px',
    fontSize: '12px',
    fontWeight: 600,
    color: '#8D99AE',
    background: 'transparent',
    border: 'none',
    borderRadius: '9px',
    cursor: 'pointer',
    transition: 'all 0.2s',
  },
  toggleBtnActive: {
    background: 'rgba(0, 245, 212, 0.15)',
    color: '#00F5D4',
  },
  pinDotContainer: {
    display: 'flex',
    justifyContent: 'center',
    gap: '16px',
    padding: '10px 0',
  },
  pinDot: {
    width: '14px',
    height: '14px',
    borderRadius: '50%',
    border: '2px solid rgba(255, 255, 255, 0.2)',
    transition: 'all 0.15s ease',
  },
  pinDotFilled: {
    background: '#00F5D4',
    borderColor: '#00F5D4',
    boxShadow: '0 0 10px rgba(0, 245, 212, 0.6)',
  },
  keypad: {
    display: 'grid',
    gridTemplateColumns: 'repeat(3, 1fr)',
    gap: '12px',
    marginTop: '10px',
  },
  keypadBtn: {
    padding: '14px',
    fontSize: '18px',
    fontWeight: 600,
    color: '#ffffff',
    background: 'rgba(255, 255, 255, 0.03)',
    border: '1px solid rgba(255, 255, 255, 0.05)',
    borderRadius: '14px',
    cursor: 'pointer',
    transition: 'all 0.1s',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
  },
  keypadBtnSpecial: {
    fontSize: '11px',
    color: '#8D99AE',
    background: 'transparent',
    border: 'none',
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
    fontSize: '36px',
    marginBottom: '16px',
    color: '#00F5D4',
  },
  statusText: {
    fontSize: '13px',
    fontWeight: 600,
    color: '#ffffff',
  },
  countdownContainer: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    marginTop: '20px',
  },
  timerText: {
    fontSize: '44px',
    fontWeight: 800,
    color: '#ef4444',
    fontFamily: 'monospace',
    letterSpacing: '2px',
    marginBottom: '12px',
  },
  hintText: {
    fontSize: '12px',
    color: '#8D99AE',
  },
};
