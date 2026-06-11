"import { useState, useEffect, useMemo } from 'react';
import { usePortalData } from '../hooks/usePortalData';
import { useStudentStore } from '../store/studentStore';
import PageHeader from '../components/PageHeader';
import DataTable from '../components/DataTable';
import SkeletonLoader from '../components/SkeletonLoader';

/* ─── helpers ──────────────────────────────────────────────────── */
function extractSubjects(data) {
  if (!data) return [];
  return data?.payload?.subjects || data?.subjects || [];
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

/* ─── filter panel ─────────────────────────────────────────────── */
const SEM_OPTS = (max) => Array.from({ length: max }, (_, i) => ({ value: String(i + 1), label: `Semester ${i + 1}` }));
const MARK_OPTS = [
  { value: 'university', label: '🎓 University Marks' },
  { value: 'assessment', label: '📋 CCA / Assessment' },
];

function FilterPanel({ sems, selectedSem, onSem, markType, onMark, expanded, onToggle }) {
  return (
    <div style={fp.wrap}>
      <button style={fp.toggleBtn} onClick={onToggle} id="filter-toggle-btn">
        <span style={fp.icon}>⚙️</span>
        <span>Filter</span>
        <span style={{ ...fp.arrow, transform: expanded ? 'rotate(180deg)' : 'none' }}>▾</span>
      </button>

      <div style={{ ...fp.panel, maxHeight: expanded ? '200px' : '0', opacity: expanded ? 1 : 0 }}>
        <div style={fp.row}>
          {/* Semester column */}
          <div style={fp.col}>
            <p style={fp.colLabel}>SEMESTER</p>
            {sems.m
<truncated 7521 bytes>