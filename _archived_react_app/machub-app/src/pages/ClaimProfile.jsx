import React, { useState, useEffect, useMemo } from 'react';
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

export default function ClaimProfile() {
  const [searchParams] = useSearchParams();
  const admissionNumber = searchParams.get('admissionNumber') || '';
  const navigate = useNavigate();

  const store = useStudentStore();

  // Step state: 1 = Portal Password, 2 = Identity Questions, 3 = PIN Setup
  const [step, setStep] = useState(1);
  const [loading, setLoading] = useState(false);
  const [errorText, setErrorText] = useState('');
  const [statusText, setStatusText] = useState('');

  // Step 1 State: Password
  const [password, setPassword] = useState('');

  // Step 2 State: Identity Verification
  const [scrapedData, setScrapedData] = useState(null);
  const [questions, setQuestions] = useState([]);
  const [answers, setAnswers] = useState({});
  const [attemptsRemaining, setAttemptsRemaining] = useState(5);
  const [lockedUntil, setLockedUntil] = useState(null);
  const [lockCountdown, setLockCountdown] = useState(0);

  // Step 3 State: PIN Setup
  const [pinLength, setPinLength] = useState(4);
  const [pin, setPin] = useState('');
  const [confirmPin, setConfirmPin] = useState('');

  // Check lock on mount
  useEffect(() => {
    if (!admissionNumber) return;
    const checkLock = async () => {
      try {
        const snap = await getDoc(doc(db, 'students', admissionNumber));
        if (snap.exists()) {
          const sec = snap.data().security || {};
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
        }
      } catch (err) {
        console.error("Lock check failed:", err);
      }
    };
    checkLock();
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

  // Step 1: Portal Login
  const handleVerifyPassword = async (e) => {
    e.preventDefault();
    if (!password) {
      setErrorText('Please enter your portal password');
      return;
    }
    setLoading(true);
    setErrorText('');
    setStatusText('Verifying portal password...');

    try {
      // 1. Scrape profile to verify credentials
      const scrapeRes = await fetch(`${WORKER_URL}/api/scrape/profile`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ admissionNumber, password }),
      });

      if (!scrapeRes.ok) {
        throw new Error('Incorrect password. Please try again.');
      }

      const scrapeJson = await scrapeRes.json();
      if (!scrapeJson.success || !scrapeJson.data) {
        throw new Error('Handshake failed. Double check your portal password.');
      }

      setScrapedData(scrapeJson.data);
      setStatusText('Encrypting credentials...');

      // 2. Encrypt password via worker
      const encRes = await fetch(`${WORKER_URL}/api/auth/encrypt-password`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ password }),
      });

      if (!encRes.ok) {
        throw new Error('Encryption service unavailable. Try again later.');
      }

      const encJson = await encRes.json();
      const encryptedPassword = encJson.encrypted;

      // 3. Write encrypted password to security block
      const docRef = doc(db, 'students', admissionNumber);
      await setDoc(docRef, {
        admissionNumber,
        security: {
          portalPasswordEncrypted: encryptedPassword,
          isProfileClaimed: false,
          identityVerified: false,
          verificationAttempts: 0,
        }
      }, { merge: true });

      // Generate question pool
      generateQuestions(scrapeJson.data);
      setStep(2);
    } catch (err) {
      setErrorText(err.message || 'An error occurred during password check');
    } finally {
      setLoading(false);
    }
  };

  // Generate 3 random questions from available data
  const generateQuestions = (profile) => {
    const data = profile.sections?.[0]?.data || profile;
    const pool = [];

    if (data.dob) {
      pool.push({
        id: 'dob',
        label: 'Your date of birth',
        type: 'dob',
      });
    }
    if (data.phone) {
      pool.push({
        id: 'phone',
        label: 'Your registered mobile number',
        type: 'phone',
      });
      pool.push({
        id: 'phoneLast4',
        label: 'Last 4 digits of your registered phone number',
        type: 'phoneLast4',
      });
    }
    if (data.aadhar) {
      pool.push({
        id: 'aadhaarLast4',
        label: 'Last 4 digits of your Aadhaar ID',
        type: 'aadharLast4',
      });
    }
    if (data.guardianName) {
      pool.push({
        id: 'fatherName',
        label: "Your father's/guardian's full name",
        type: 'fatherName',
      });
    }
    if (data.guardianPhone) {
      pool.push({
        id: 'parentPhone',
        label: "Your parent's/guardian's phone number",
        type: 'parentPhone',
      });
    }
    if (data.email) {
      pool.push({
        id: 'email',
        label: 'Your registered email address',
        type: 'email',
      });
    }
    if (data.bloodGroup || data.blood_group) {
      pool.push({
        id: 'bloodGroup',
        label: 'Your blood group',
        type: 'bloodGroup',
      });
    }
    const address = data.address || data.permanentAddress || '';
    if (address && /\b\d{6}\b/.test(address)) {
      pool.push({
        id: 'pincode',
        label: 'PIN code of your permanent address',
        type: 'pincode',
      });
    }

    // Shuffle pool and pick exactly 3 (or whatever is available)
    const shuffled = pool.sort(() => 0.5 - Math.random());
    const selected = shuffled.slice(0, Math.min(3, shuffled.length));
    
    // Randomize their order again
    const finalQuestions = selected.sort(() => 0.5 - Math.random());
    setQuestions(finalQuestions);

    // Reset answers
    const initialAnswers = {};
    finalQuestions.forEach(q => {
      if (q.type === 'dob') {
        initialAnswers.dob = { dd: '', mm: '', yyyy: '' };
      } else {
        initialAnswers[q.id] = '';
      }
    });
    setAnswers(initialAnswers);
  };

  // Step 2: Answer Verification
  const handleVerifyAnswers = async (e) => {
    e.preventDefault();
    if (lockedUntil) return;

    // Check that all questions have input
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
          setStep(3);
          setLoading(false);
        }, 800);
      } else {
        // Failed
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

          // Format error and generate NEW questions
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
          
          // Generate new questions
          if (scrapedData) {
            generateQuestions(scrapedData);
          }
        }
      }
    } catch (err) {
      setErrorText(err.message || 'Verification failed');
    } finally {
      if (!lockedUntil && step === 2) {
        setLoading(false);
      }
    }
  };

  // Step 3: PIN Setup
  const handleSavePin = async (skip = false) => {
    setLoading(true);
    setErrorText('');
    setStatusText(skip ? 'Configuring profile access...' : 'Securing your profile with PIN...');

    try {
      let pinHash = null;
      if (!skip) {
        if (!pin || pin.length !== pinLength) {
          throw new Error(`PIN must be exactly ${pinLength} digits`);
        }
        if (pin !== confirmPin) {
          setPin('');
          setConfirmPin('');
          throw new Error("PINs don't match. Please try again.");
        }
        // Hash PIN client-side
        pinHash = bcrypt.hashSync(pin, 10);
      }

      // Generate device token
      const deviceToken = Math.random().toString(36).substring(2) + Date.now().toString(36);

      // Save to Firestore
      const docRef = doc(db, 'students', admissionNumber);
      const studentSnap = await getDoc(docRef);
      const currentTokens = studentSnap.exists() ? (studentSnap.data().security?.deviceTokens || []) : [];
      const updatedTokens = [...currentTokens, deviceToken];

      const securityUpdate = {
        pinHash,
        pinLength,
        isProfileClaimed: true,
        identityVerified: true,
        claimedAt: new Date().toISOString(),
        lastVerifiedAt: new Date().toISOString(),
        deviceTokens: updatedTokens,
      };

      await setDoc(docRef, {
        admissionNumber,
        security: securityUpdate,
      }, { merge: true });

      // Save locally
      localStorage.setItem('machub_device_token', deviceToken);
      store.setAdmissionNumber(admissionNumber);
      store.setSecurityDeviceToken(deviceToken);
      store.setSecurityClaimed(true);
      store.setSecurityUnlocked(true);

      showToast(skip ? 'Profile claimed successfully!' : 'Profile claimed and PIN locked!', 'success');
      
      // Redirect
      navigate(`/profile?admissionNumber=${admissionNumber}`);
    } catch (err) {
      setErrorText(err.message || 'Failed to complete profile claim');
      setLoading(false);
    }
  };

  const showToast = (msg, type) => {
    // Custom trigger if settingsStore toast exists
    try {
      const { useSettingsStore } = require('../store/settingsStore');
      useSettingsStore.getState().showToast(msg, type);
    } catch (e) {
      alert(msg);
    }
  };

  // Render Lock Countdown Screen if locked
  if (lockedUntil && lockCountdown > 0) {
    const mins = Math.floor(lockCountdown / 60);
    const secs = lockCountdown % 60;
    return (
      <div style={styles.container}>
        <div style={styles.glow} />
        <div className="card" style={styles.card}>
          <div style={styles.logoHeader}>
            <div style={styles.lockIcon}>🔒</div>
            <h1 style={styles.title}>Verification Locked</h1>
            <p style={styles.subtitle}>Too many failed attempts to verify your profile.</p>
          </div>
          <div style={styles.countdownContainer}>
            <div style={styles.timerText}>
              {String(mins).padStart(2, '0')}:{String(secs).padStart(2, '0')}
            </div>
            <p style={styles.hintText}>Please wait 30 minutes before trying again.</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div style={styles.container}>
      <div style={styles.glow} />

      <div className="card fade-in" style={styles.card}>
        {/* Step 1: Portal Password */}
        {step === 1 && (
          <div>
            <div style={styles.logoHeader}>
              <div style={styles.iconCircle}>🔐</div>
              <h1 style={styles.title}>Claim Your Profile</h1>
              <p style={styles.subtitle}>Enter your EduloomPro portal password to verify ownership</p>
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
              <form onSubmit={handleVerifyPassword} style={styles.form}>
                <div style={styles.inputGroup}>
                  <label style={styles.label}>Admission Number</label>
                  <input
                    className="input"
                    type="text"
                    value={admissionNumber}
                    readOnly
                    style={{ opacity: 0.6, cursor: 'not-allowed' }}
                  />
                </div>
                <div style={styles.inputGroup}>
                  <label style={styles.label}>Portal Password</label>
                  <input
                    className="input"
                    type="password"
                    placeholder="Enter your college ePortal password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    autoFocus
                  />
                  <p style={styles.helperText}>
                    This is the same password you use to login to the college portal.
                  </p>
                </div>

                <button className="btn btn-primary" type="submit" style={styles.submitBtn}>
                  Continue
                </button>
              </form>
            )}

            {!loading && (
              <div style={styles.forgotPassContainer}>
                <a
                  href="https://eportal.maraugusthinosecollege.org"
                  target="_blank"
                  rel="noreferrer"
                  style={styles.link}
                >
                  Forgot Password?
                </a>
              </div>
            )}
          </div>
        )}

        {/* Step 2: Identity Verification */}
        {step === 2 && (
          <div>
            <div style={styles.logoHeader}>
              <div style={styles.iconCircle}>👤</div>
              <h1 style={styles.title}>Verify Your Identity</h1>
              <p style={styles.subtitle}>Answer these questions from your college profile to prove it's really you.</p>
            </div>

            {errorText && (
              <div className="alert alert-error" style={{ marginBottom: 16 }}>
                <span>⚠️</span>
                <span>{errorText}</span>
              </div>
            )}

            {loading ? (
              <div style={styles.loadingContainer}>
                <div className="spin" style={styles.spinner}>🛡️</div>
                <p style={styles.statusText}>Checking answers...</p>
              </div>
            ) : (
              <form onSubmit={handleVerifyAnswers} style={styles.form}>
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
                              
                              // Auto focus next input
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

                <button className="btn btn-primary" type="submit" style={styles.submitBtn}>
                  Verify Answers
                </button>
              </form>
            )}
          </div>
        )}

        {/* Step 3: Secure Your Profile */}
        {step === 3 && (
          <div>
            <div style={styles.logoHeader}>
              <div style={styles.iconCircle}>🔒</div>
              <h1 style={styles.title}>Secure Your Profile</h1>
              <p style={styles.subtitle}>Set a PIN to lock your personal information. This is optional but recommended.</p>
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
                        ...(pinLength === 4 ? styles.toggleBtnActive : {})
                      }}
                      onClick={() => { setPinLength(4); setPin(''); setConfirmPin(''); }}
                    >
                      4 Digits
                    </button>
                    <button
                      style={{
                        ...styles.toggleBtn,
                        ...(pinLength === 6 ? styles.toggleBtnActive : {})
                      }}
                      onClick={() => { setPinLength(6); setPin(''); setConfirmPin(''); }}
                    >
                      6 Digits
                    </button>
                  </div>
                </div>

                <div style={styles.inputGroup}>
                  <label style={styles.label}>Enter your PIN</label>
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

                <div style={styles.inputGroup}>
                  <label style={styles.label}>Confirm your PIN</label>
                  <div style={styles.pinDotContainer}>
                    {Array.from({ length: pinLength }).map((_, i) => (
                      <div
                        key={i}
                        style={{
                          ...styles.pinDot,
                          ...(confirmPin.length > i ? styles.pinDotFilled : {})
                        }}
                      />
                    ))}
                  </div>
                </div>

                {/* Big touch target keypad */}
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
                            setConfirmPin('');
                          } else if (keyVal === 'Delete') {
                            if (confirmPin.length > 0) {
                              setConfirmPin(confirmPin.slice(0, -1));
                            } else if (pin.length > 0) {
                              setPin(pin.slice(0, -1));
                            }
                          } else {
                            if (pin.length < pinLength) {
                              setPin(pin + keyVal);
                            } else if (confirmPin.length < pinLength) {
                              setConfirmPin(confirmPin + keyVal);
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
                    onClick={() => handleSavePin(true)}
                    style={{ flex: 1, background: 'rgba(255,255,255,0.05)', color: 'white', justifyContent: 'center' }}
                  >
                    Skip for Now
                  </button>
                  <button
                    className="btn btn-primary"
                    onClick={() => handleSavePin(false)}
                    style={{ flex: 2, justifyContent: 'center' }}
                    disabled={pin.length !== pinLength || confirmPin.length !== pinLength}
                  >
                    Secure Profile
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
    marginBottom: '28px',
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
  submitBtn: {
    width: '100%',
    justifyContent: 'center',
    padding: '12px',
    fontSize: '14px',
    marginTop: '12px',
  },
  helperText: {
    fontSize: '11px',
    color: '#8D99AE',
    marginTop: '2px',
  },
  forgotPassContainer: {
    marginTop: '20px',
    textAlign: 'center',
  },
  link: {
    fontSize: '12px',
    color: '#00F5D4',
    textDecoration: 'none',
    fontWeight: 500,
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
    padding: '16px 0',
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
    marginTop: '20px',
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
