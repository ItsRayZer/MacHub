import React, { useState, useEffect } from 'react';
import { useSettingsStore } from '../../store/settingsStore';
import { useStudentStore } from '../../store/studentStore';
import { doc, getDoc, setDoc, deleteField } from 'firebase/firestore';
import { db } from '../../firebase';
import { Shield, KeyRound, Smartphone, LogOut, ChevronRight, Lock, Eye, EyeOff, AlertTriangle } from 'lucide-react';
import bcrypt from 'bcryptjs';

export default function AccountSecurityView() {
  const navigateTo = useSettingsStore((s) => s.navigateTo);
  const showToast = useSettingsStore((s) => s.showToast);
  const closeSettings = useSettingsStore((s) => s.closeSettings);

  const { admissionNumber, logout } = useStudentStore();

  const [loading, setLoading] = useState(true);
  const [securityConfig, setSecurityConfig] = useState(null);

  // Modal / Dialog States
  const [activeModal, setActiveModal] = useState(null); // 'pin', 'length', 'logout', 'password'
  const [errorText, setErrorText] = useState('');

  // PIN Form States
  const [currentPin, setCurrentPin] = useState('');
  const [newPin, setNewPin] = useState('');
  const [confirmPin, setConfirmPin] = useState('');
  const [tempLength, setTempLength] = useState(4);

  // Password Visibility
  const [showPins, setShowPins] = useState(false);

  // Fetch security info from Firestore
  const fetchSecurity = async () => {
    if (!admissionNumber) return;
    setLoading(true);
    try {
      const snap = await getDoc(doc(db, 'students', admissionNumber));
      if (snap.exists()) {
        setSecurityConfig(snap.data().security || {});
        setTempLength(snap.data().security?.pinLength || 4);
      }
    } catch (err) {
      console.warn("Failed to fetch security details:", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchSecurity();
  }, [admissionNumber]);

  // Handle PIN Set / Change
  const handlePinSubmit = async (e) => {
    e.preventDefault();
    setErrorText('');

    const hasCurrentPin = !!securityConfig?.pinHash;
    const targetLength = securityConfig?.pinLength || tempLength;

    try {
      // 1. Verify current PIN if set
      if (hasCurrentPin) {
        if (!currentPin || currentPin.length !== targetLength) {
          throw new Error(`Please enter your current ${targetLength}-digit PIN`);
        }
        const verify = bcrypt.compareSync(currentPin, securityConfig.pinHash);
        if (!verify) {
          throw new Error("Incorrect current PIN passcode");
        }
      }

      // 2. Validate new PIN
      if (!newPin || newPin.length !== targetLength) {
        throw new Error(`New PIN must be exactly ${targetLength} digits`);
      }
      if (newPin !== confirmPin) {
        throw new Error("New PINs do not match");
      }

      // 3. Hash and Save
      const hash = bcrypt.hashSync(newPin, 10);
      const docRef = doc(db, 'students', admissionNumber);
      
      await setDoc(docRef, {
        security: {
          pinHash: hash,
          pinLength: targetLength,
          isProfileClaimed: true,
        }
      }, { merge: true });

      showToast("PIN passcode updated successfully", "success");
      setActiveModal(null);
      resetForms();
      fetchSecurity();
    } catch (err) {
      setErrorText(err.message);
    }
  };

  // Handle Toggle PIN Length
  const handleLengthSubmit = async (e) => {
    e.preventDefault();
    setErrorText('');

    const hasPin = !!securityConfig?.pinHash;
    const currentLength = securityConfig?.pinLength || 4;
    const nextLength = currentLength === 4 ? 6 : 4;

    try {
      if (hasPin) {
        if (!currentPin || currentPin.length !== currentLength) {
          throw new Error(`Verify your current ${currentLength}-digit PIN first`);
        }
        const verify = bcrypt.compareSync(currentPin, securityConfig.pinHash);
        if (!verify) {
          throw new Error("Incorrect current PIN");
        }
      }

      // Save new preference length and prompt them to update PIN
      const docRef = doc(db, 'students', admissionNumber);
      await setDoc(docRef, {
        security: {
          pinLength: nextLength,
          // Clear current pin since its length is invalid now
          pinHash: null,
        }
      }, { merge: true });

      showToast(`PIN length toggled to ${nextLength} digits. Please set a new PIN.`, "success");
      setActiveModal(null);
      resetForms();
      fetchSecurity();
      // Auto open PIN set modal
      setTimeout(() => {
        setActiveModal('pin');
      }, 500);
    } catch (err) {
      setErrorText(err.message);
    }
  };

  // Handle Logout from All Devices
  const handleLogoutAllDevices = async () => {
    setLoading(true);
    try {
      const docRef = doc(db, 'students', admissionNumber);
      await setDoc(docRef, {
        security: {
          deviceTokens: [],
        }
      }, { merge: true });

      localStorage.removeItem('machub_device_token');
      logout();
      showToast("Successfully logged out all devices", "success");
      
      closeSettings();
      setTimeout(() => {
        window.location.reload();
      }, 500);
    } catch (err) {
      showToast("Logout failed. Try again.", "error");
      setLoading(false);
    }
  };

  // Handle Delete Stored Password
  const handleDeleteSavedPassword = async () => {
    setLoading(true);
    try {
      const docRef = doc(db, 'students', admissionNumber);
      await setDoc(docRef, {
        security: {
          portalPasswordEncrypted: deleteField(),
        }
      }, { merge: true });

      showToast("Saved portal password deleted", "success");
      setActiveModal(null);
      fetchSecurity();
    } catch (err) {
      showToast("Failed to delete saved password", "error");
      setLoading(false);
    }
  };

  const resetForms = () => {
    setCurrentPin('');
    setNewPin('');
    setConfirmPin('');
    setErrorText('');
  };

  if (loading && !securityConfig) {
    return (
      <div className="p-8 text-center text-xs text-[#8D99AE]">
        Loading security details...
      </div>
    );
  }

  const isPinConfigured = !!securityConfig?.pinHash;
  const isPasswordSaved = !!securityConfig?.portalPasswordEncrypted;

  return (
    <div className="p-4 pb-8 space-y-5">
      {/* Overview Status Banner */}
      <div
        className="p-4 rounded-xl flex items-center gap-3"
        style={{
          background: isPinConfigured ? 'rgba(0, 245, 212, 0.08)' : 'rgba(255, 183, 3, 0.08)',
          border: `1px solid ${isPinConfigured ? 'rgba(0, 245, 212, 0.2)' : 'rgba(255, 183, 3, 0.2)'}`
        }}
      >
        <Shield className="w-6 h-6 shrink-0" style={{ color: isPinConfigured ? '#00F5D4' : '#FFB703' }} />
        <div>
          <p className="text-[12px] font-semibold" style={{ color: isPinConfigured ? '#00F5D4' : '#FFB703' }}>
            {isPinConfigured ? 'Profile Protected' : 'PIN Lock Not Set'}
          </p>
          <p className="text-[10px] text-[#8D99AE]">
            {isPinConfigured ? 'Personal details are gated behind your PIN' : 'Anyone can view your personal details'}
          </p>
        </div>
      </div>

      {/* Profile Security Config */}
      <div>
        <h4 className="text-[10px] font-bold text-[#8D99AE] uppercase tracking-wider px-1 mb-2">Profile Passcode Lock</h4>
        <div
          className="rounded-xl divide-y overflow-hidden"
          style={{ background: 'rgba(255, 255, 255, 0.03)', border: '1px solid rgba(255, 255, 255, 0.06)' }}
        >
          {/* Row 1: Set / Change PIN */}
          <button
            onClick={() => { resetForms(); setActiveModal('pin'); }}
            className="w-full p-4 flex items-center justify-between text-left settings-row transition-colors hover:bg-white/5"
          >
            <div className="flex items-center gap-3">
              <KeyRound className="w-4 h-4 text-[#ADE8F4]" />
              <div>
                <span className="font-semibold text-[12px] text-white block">
                  {isPinConfigured ? 'Change PIN Lock' : 'Set Up PIN Lock'}
                </span>
                <span className="text-[10px] text-[#8D99AE]">
                  {isPinConfigured ? 'Modify your secure access code' : 'Gating DOB, phone, address, and Aadhaar'}
                </span>
              </div>
            </div>
            <span className="text-[10px] font-bold flex items-center gap-1" style={{ color: isPinConfigured ? '#00F5D4' : '#FFB703' }}>
              {isPinConfigured ? '🔒 Active' : 'Not Configured'}
              <ChevronRight className="w-4 h-4 text-[#8D99AE]" />
            </span>
          </button>

          {/* Row 2: PIN Length */}
          <button
            onClick={() => { resetForms(); setActiveModal('length'); }}
            className="w-full p-4 flex items-center justify-between text-left settings-row transition-colors hover:bg-white/5"
          >
            <div className="flex items-center gap-3">
              <Lock className="w-4 h-4 text-[#ADE8F4]" />
              <div>
                <span className="font-semibold text-[12px] text-white block">PIN Passcode Length</span>
                <span className="text-[10px] text-[#8D99AE]">Toggle 4-digit vs 6-digit PIN</span>
              </div>
            </div>
            <span className="text-[10px] font-semibold text-[#00F5D4] flex items-center gap-1">
              {securityConfig?.pinLength || 4} Digits
              <ChevronRight className="w-4 h-4 text-[#8D99AE]" />
            </span>
          </button>
        </div>
      </div>

      {/* Portal Credentials Control */}
      <div>
        <h4 className="text-[10px] font-bold text-[#8D99AE] uppercase tracking-wider px-1 mb-2">Saved Portal Credentials</h4>
        <div
          className="rounded-xl divide-y overflow-hidden"
          style={{ background: 'rgba(255, 255, 255, 0.03)', border: '1px solid rgba(255, 255, 255, 0.06)' }}
        >
          {/* Row 3: Delete Saved Password */}
          <button
            onClick={() => {
              if (isPasswordSaved) {
                setActiveModal('password');
              } else {
                showToast("No saved portal password found", "warning");
              }
            }}
            className="w-full p-4 flex items-center justify-between text-left settings-row transition-colors hover:bg-white/5"
            style={{ opacity: isPasswordSaved ? 1 : 0.5 }}
          >
            <div className="flex items-center gap-3">
              <Shield className="w-4 h-4 text-[#FFB703]" />
              <div>
                <span className="font-semibold text-[12px] text-white block">Delete Saved Password</span>
                <span className="text-[10px] text-[#8D99AE]">Remove portal credentials from Firebase caching</span>
              </div>
            </div>
            <span className="text-[10px] font-bold" style={{ color: isPasswordSaved ? '#ef4444' : '#8D99AE' }}>
              {isPasswordSaved ? 'Wipe Stored' : 'Not Stored'}
            </span>
          </button>
        </div>
      </div>

      {/* Session Controls */}
      <div>
        <h4 className="text-[10px] font-bold text-[#8D99AE] uppercase tracking-wider px-1 mb-2">Device & Session Control</h4>
        <div
          className="rounded-xl divide-y overflow-hidden"
          style={{ background: 'rgba(255, 255, 255, 0.03)', border: '1px solid rgba(255, 255, 255, 0.06)' }}
        >
          <button
            onClick={() => navigateTo('active-devices')}
            className="w-full p-4 flex items-center justify-between text-left settings-row transition-colors hover:bg-white/5"
          >
            <div className="flex items-center gap-3">
              <Smartphone className="w-4 h-4 text-[#ADE8F4]" />
              <div>
                <span className="font-semibold text-[12px] text-white block">Authorized Devices</span>
                <span className="text-[10px] text-[#8D99AE]">{securityConfig?.deviceTokens?.length || 0} active tokens</span>
              </div>
            </div>
            <ChevronRight className="w-4 h-4 text-[#8D99AE]" />
          </button>

          <button
            onClick={() => setActiveModal('logout')}
            className="w-full p-4 flex items-center justify-between text-left settings-row transition-colors hover:bg-white/5"
          >
            <div className="flex items-center gap-3">
              <LogOut className="w-4 h-4 text-[#ef4444]" />
              <div>
                <span className="font-semibold text-[12px] text-[#ef4444] block">Log Out All Devices</span>
                <span className="text-[10px] text-[#8D99AE]">Invalidate session tokens for all browsers</span>
              </div>
            </div>
          </button>
        </div>
      </div>

      {/* ── MODAL: PIN SUBMIT ── */}
      {activeModal === 'pin' && (
        <div style={styles.modalBackdrop}>
          <div className="card fade-in" style={styles.modalCard}>
            <h3 style={styles.modalTitle}>{isPinConfigured ? 'Change PIN Lock' : 'Set Up PIN Lock'}</h3>
            <p style={styles.modalSubtitle}>Verify ownership to update profile passcode.</p>

            {errorText && (
              <div className="alert alert-error" style={{ fontSize: '11px', padding: '8px 12px' }}>
                <span>⚠️ {errorText}</span>
              </div>
            )}

            <form onSubmit={handlePinSubmit} style={styles.modalForm}>
              {isPinConfigured && (
                <div style={styles.formGroup}>
                  <label style={styles.modalLabel}>Current PIN</label>
                  <div style={styles.inputWrap}>
                    <input
                      className="input"
                      type={showPins ? "text" : "password"}
                      maxLength={securityConfig?.pinLength || 4}
                      value={currentPin}
                      onChange={(e) => setCurrentPin(e.target.value.replace(/\D/g, ''))}
                      placeholder="••••"
                      autoFocus
                    />
                  </div>
                </div>
              )}

              <div style={styles.formGroup}>
                <label style={styles.modalLabel}>New PIN ({securityConfig?.pinLength || tempLength} digits)</label>
                <div style={styles.inputWrap}>
                  <input
                    className="input"
                    type={showPins ? "text" : "password"}
                    maxLength={securityConfig?.pinLength || tempLength}
                    value={newPin}
                    onChange={(e) => setNewPin(e.target.value.replace(/\D/g, ''))}
                    placeholder={Array.from({ length: securityConfig?.pinLength || tempLength }).map(() => '•').join('')}
                  />
                </div>
              </div>

              <div style={styles.formGroup}>
                <label style={styles.modalLabel}>Confirm PIN</label>
                <div style={styles.inputWrap}>
                  <input
                    className="input"
                    type={showPins ? "text" : "password"}
                    maxLength={securityConfig?.pinLength || tempLength}
                    value={confirmPin}
                    onChange={(e) => setConfirmPin(e.target.value.replace(/\D/g, ''))}
                    placeholder={Array.from({ length: securityConfig?.pinLength || tempLength }).map(() => '•').join('')}
                  />
                </div>
              </div>

              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <button
                  type="button"
                  onClick={() => setShowPins(!showPins)}
                  style={styles.eyeBtn}
                >
                  {showPins ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  {showPins ? 'Hide' : 'Show'} PINs
                </button>
              </div>

              <div style={styles.modalActions}>
                <button type="button" className="btn" onClick={() => setActiveModal(null)} style={{ flex: 1, justifyContent: 'center' }}>
                  Cancel
                </button>
                <button type="submit" className="btn btn-primary" style={{ flex: 1.5, justifyContent: 'center' }}>
                  Save PIN
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ── MODAL: PIN LENGTH TOGGLE ── */}
      {activeModal === 'length' && (
        <div style={styles.modalBackdrop}>
          <div className="card fade-in" style={styles.modalCard}>
            <h3 style={styles.modalTitle}>Change Passcode Length</h3>
            <p style={styles.modalSubtitle}>
              Changing PIN length from {securityConfig?.pinLength || 4} to {securityConfig?.pinLength === 4 ? 6 : 4} digits will clear your current PIN.
            </p>

            {errorText && (
              <div className="alert alert-error" style={{ fontSize: '11px', padding: '8px 12px' }}>
                <span>⚠️ {errorText}</span>
              </div>
            )}

            <form onSubmit={handleLengthSubmit} style={styles.modalForm}>
              {isPinConfigured && (
                <div style={styles.formGroup}>
                  <label style={styles.modalLabel}>Confirm current PIN ({securityConfig?.pinLength || 4} digits)</label>
                  <input
                    className="input"
                    type="password"
                    maxLength={securityConfig?.pinLength || 4}
                    value={currentPin}
                    onChange={(e) => setCurrentPin(e.target.value.replace(/\D/g, ''))}
                    placeholder="••••"
                    autoFocus
                  />
                </div>
              )}

              <div style={styles.modalActions}>
                <button type="button" className="btn" onClick={() => setActiveModal(null)} style={{ flex: 1, justifyContent: 'center' }}>
                  Cancel
                </button>
                <button type="submit" className="btn btn-primary" style={{ flex: 2, justifyContent: 'center' }}>
                  Verify & Toggle Length
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ── MODAL: LOGOUT ALL DEVICES ── */}
      {activeModal === 'logout' && (
        <div style={styles.modalBackdrop}>
          <div className="card fade-in" style={styles.modalCard}>
            <div style={{ textAlign: 'center', marginBottom: 16 }}>
              <div style={styles.warningCircle}>⚠️</div>
              <h3 style={styles.modalTitle}>Logout from All Devices</h3>
              <p style={styles.modalSubtitle}>
                This will invalidate session access across all devices. You will need to log back in.
              </p>
            </div>

            <div style={styles.modalActions}>
              <button className="btn" onClick={() => setActiveModal(null)} style={{ flex: 1, justifyContent: 'center' }}>
                Cancel
              </button>
              <button className="btn btn-primary" onClick={handleLogoutAllDevices} style={{ flex: 2, justifyContent: 'center', background: '#ef4444', borderColor: '#ef4444' }}>
                Log Out All Devices
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── MODAL: DELETE STORED PASSWORD ── */}
      {activeModal === 'password' && (
        <div style={styles.modalBackdrop}>
          <div className="card fade-in" style={styles.modalCard}>
            <div style={{ textAlign: 'center', marginBottom: 16 }}>
              <AlertTriangle className="w-12 h-12 text-[#FFB703] mx-auto mb-2" />
              <h3 style={styles.modalTitle}>Delete Saved Password?</h3>
              <p style={styles.modalSubtitle} className="text-[#FFB703]">
                ⚠️ Warning: Removing your portal password means background sync and automatic marks/attendance checking will stop working.
              </p>
            </div>

            <div style={styles.modalActions}>
              <button className="btn" onClick={() => setActiveModal(null)} style={{ flex: 1, justifyContent: 'center' }}>
                Cancel
              </button>
              <button className="btn btn-primary" onClick={handleDeleteSavedPassword} style={{ flex: 2, justifyContent: 'center', background: '#ef4444', borderColor: '#ef4444' }}>
                Wipe Stored Password
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

const styles = {
  modalBackdrop: {
    position: 'fixed',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    background: 'rgba(0, 0, 0, 0.8)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 9999,
    padding: '20px',
  },
  modalCard: {
    width: '100%',
    maxWidth: '400px',
    background: '#0d0d12',
    border: '1px solid rgba(255, 255, 255, 0.08)',
    borderRadius: '20px',
    padding: '24px',
    boxShadow: '0 20px 48px rgba(0,0,0,0.6)',
  },
  modalTitle: {
    fontSize: '16px',
    fontWeight: 700,
    color: '#ffffff',
    marginBottom: '6px',
  },
  modalSubtitle: {
    fontSize: '11px',
    color: '#8D99AE',
    lineHeight: 1.4,
    marginBottom: '16px',
  },
  modalForm: {
    display: 'flex',
    flexDirection: 'column',
    gap: '12px',
  },
  formGroup: {
    display: 'flex',
    flexDirection: 'column',
    gap: '6px',
  },
  modalLabel: {
    fontSize: '10px',
    fontWeight: 600,
    color: '#ADE8F4',
    textTransform: 'uppercase',
  },
  inputWrap: {
    display: 'flex',
    alignItems: 'center',
  },
  eyeBtn: {
    display: 'flex',
    alignItems: 'center',
    gap: '6px',
    fontSize: '10px',
    fontWeight: 600,
    color: '#ADE8F4',
    background: 'transparent',
    border: 'none',
    cursor: 'pointer',
    padding: '4px 0',
  },
  modalActions: {
    display: 'flex',
    gap: '12px',
    marginTop: '12px',
  },
  warningCircle: {
    width: '48px',
    height: '48px',
    borderRadius: '50%',
    background: 'rgba(239, 68, 68, 0.1)',
    color: '#ef4444',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    fontSize: '24px',
    margin: '0 auto 12px',
  },
};
