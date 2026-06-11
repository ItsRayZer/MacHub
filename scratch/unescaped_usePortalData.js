"/**
 * usePortalData — Core stale-while-revalidate data hook.
 *
 * Flow:
 * 1. Read from Firestore (instant, ~50ms)
 * 2. If data exists → render immediately (unwraps payload if present)
 * 3. If stale or missing → fetch from Cloudflare Worker in background
 * 4. Update Firestore + React state with fresh data
 * 5. Errors show inline, never block navigation
 */
import { useState, useEffect, useCallback, useRef } from 'react';
import { doc, getDoc, setDoc } from 'firebase/firestore';
import { db } from '../firebase';
import { WORKER_URL, SECTION_TTL } from '../config';
import { useStudentStore } from '../store/studentStore';

const SLOW_FETCH_TIMEOUT = 3000; // Show "Portal is slow" after 3s

/**
 * Firestore stores section keys in PascalCase (e.g. "Attendance", "ExamResult").
 * This map converts the hook's camelCase section name to the Firestore key.
 */
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

/**
 * Unwrap the payload if the worker wraps data inside `payload`.
 * Returns the inner payload if it contains meaningful keys, otherwise returns as-is.
 */
function unwrapData(raw) {
  if (!raw) return null;
  // If data has a payload key and payload has real content, return the payload
  if (raw.payload && typeof ra
<truncated 5665 bytes>