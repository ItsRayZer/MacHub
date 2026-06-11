"import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { authenticateWithToken, db } from '../firebase';
import { doc, getDoc, setDoc } from 'firebase/firestore';
import { useStudentStore } from '../store/studentStore';
import { WORKER_URL } from '../config';

/* ─── animated particle background ────────────────────────────── */
function Particles() {
  return (
    <div style={ps.host} aria-hidden="true">
      {Array.from({ length: 18 }).map((_, i) => (
        <div key={i} style={{
          ...ps.dot,
          width:  `${2 + (i % 3)}px`,
          height: `${2 + (i % 3)}px`,
          left:   `${(i * 5.5) % 100}%`,
          top:    `${(i * 7.3) % 100}%`,
          animationDelay: `${(i * 0.4).toFixed(1)}s`,
          animationDuration: `${5 + (i % 4)}s`,
          opacity: 0.08 + (i % 5) * 0.04,
        }} />
      ))}
    </div>
  );
}
const ps = {
  host: { position: 'absolute', inset: 0, overflow: 'hidden', pointerEvents: 'none' },
  dot: {
    position: 'absolute',
    borderRadius: '50%',
    background: '#4f8ef7',
    animation: 'floatUp 6s ease-in-out infinite alternate',
  },
};

/* ─── step indicator ───────────────────────────────────────────── */
const STEPS = [
  { icon: '🔐', label: 'Connecting to portal…' },
  { icon: '✅', label: 'Authenticated!' },
  { icon: '👤', label: 'Loading your profile…' },
  { icon: '📚', label: 'Syncing study materials…' },
  { icon: '🏠', label: 'Building your dashboard…' },
  { icon: '🚀', label: 'All set — welcome!' },
];

/* ─── feature pills shown on the intro ────────────────────────── */
const FEATURES = [
  { icon: '📊', text: 'Live Attendance' },
  { icon: '📋', text: 'Internal Marks' },
  { icon: '🎓', text: 'Exam Res
<truncated 17183 bytes>