"import { useState, useEffect } from 'react';
import { usePortalData } from '../hooks/usePortalData';
import { useStudentStore } from '../store/studentStore';
import { WORKER_URL } from '../config';
import PageHeader from '../components/PageHeader';
import SkeletonLoader from '../components/SkeletonLoader';

/* ─── helpers ─────────────────────────────────────────────────────────── */
function extractRecords(data) {
  if (!data) return [];
  // data is already unwrapped from payload by usePortalData
  // structure: { sections: [{ headers, rows: [...subjects] }], semesters: [...] }
  const sections = data?.sections || [];
  if (sections.length > 0 && sections[0].rows) return sections[0].rows;
  // fallback for older format
  return data?.data || data?.records || [];
}

function extractSemesters(data) {
  if (!data) return [];
  return data?.semesters || data?.semesterOptions || [];
}

/* ─── main component ──────────────────────────────────────────────────── */
export default function Attendance() {
  const { admissionNumber } = useStudentStore();
  const { data, isLoading, refresh, error } = usePortalData('attendance');

  const [selectedSem, setSelectedSem] = useState('');
  const [records, setRecords] = useState([]);
  const [semesters, setSemesters] = useState([]);
  const [localLoading, setLocalLoading] = useState(false);
  const [localError, setLocalError] = useState('');

  // Sync state when portal data loads
  useEffect(() => {
    if (data) {
      const recs = extractRecords(data);
      const sems = extractSemesters(data);
      setRecords(recs);
      setSemesters(sems);
      const activeSem = sems.find(s => s.selected || s.active);
      if (activeSem) setSelectedSem(activeSem.value);
      else if (sems.length > 0) setSelected
<truncated 8988 bytes>