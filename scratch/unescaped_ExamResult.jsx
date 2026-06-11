"import { useState, useEffect, useMemo } from 'react';
import { usePortalData } from '../hooks/usePortalData';
import { useStudentStore } from '../store/studentStore';
import PageHeader from '../components/PageHeader';
import DataTable from '../components/DataTable';
import SkeletonLoader from '../components/SkeletonLoader';

/* ─── helpers ──────────────────────────────────────────────────── */
function extractResults(data) {
  if (!data) return [];
  return data?.payload?.results || data?.results || [];
}
function extractSections(data) {
  if (!data) return [];
  return data?.payload?.sections || data?.sections || [];
}
function getMaxSem(profile) {
  const s = profile?.data?.semester || profile?.semester || '2';
  const m = String(s).match(/\d+/);
  return m ? parseInt(m[0], 10) : 2;
}

/* ─── semester filter panel ─────────────────────────────────────── */
const SEM_OPTS = (max) => Array.from({ length: max }, (_, i) => ({ value: String(i + 1), label: `Semester ${i + 1}` }));

function SemFilterPanel({ sems, selectedSem, onSem, expanded, onToggle }) {
  return (
    <div style={fp.wrap}>
      <button style={fp.toggleBtn} onClick={onToggle} id="examresult-filter-toggle">
        <span style={fp.icon}>🎯</span>
        <span>Filter by Semester</span>
        <span style={{ ...fp.arrow, transform: expanded ? 'rotate(180deg)' : 'none' }}>▾</span>
      </button>

      <div style={{ ...fp.panel, maxHeight: expanded ? '160px' : '0', opacity: expanded ? 1 : 0 }}>
        <div style={fp.chips}>
          <button
            id="sem-filter-all"
            style={{ ...fp.chip, ...(selectedSem === 'all' ? fp.chipActive : {}) }}
            onClick={() => onSem('all')}
          >All Semesters</button>
          {sems.map(s => (
            <button
              key={s.value}

<truncated 8568 bytes>