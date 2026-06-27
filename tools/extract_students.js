/**
 * extract_students.js
 * Reads students_db.js and produces students_all.json with
 * { admission_no, password, name, regNo, classNo, classGroup, department, semester }
 */
const fs = require('fs');
const path = require('path');

const src = fs.readFileSync(
  path.join(__dirname, '..', 'data', 'common', 'students_db.js'), 'utf8'
);

// Evaluate safely — replace window.STUDENTS_DB with a var
const sandboxed = src.replace('window.STUDENTS_DB', 'var STUDENTS_DB');
const vm = require('vm');
const ctx = {};
vm.createContext(ctx);
vm.runInContext(sandboxed, ctx);

const db = ctx.STUDENTS_DB || [];
const students = db
  .filter(s => s.adminNo)
  .map(s => ({
    admission_no : s.adminNo,
    password     : s.adminNo,   // default portal password = admission number
    name         : s.name       || '',
    regNo        : s.regNo      || '',
    classNo      : s.classNo    || '',
    classGroup   : s.classGroup || 'BCA A',
    department   : s.department || 'BCA',
    semester     : s.semester   || 'Sem 2'
  }));

const out = path.join(__dirname, '..', 'students_all.json');
fs.writeFileSync(out, JSON.stringify(students, null, 2));
console.log(`✅ Extracted ${students.length} students → students_all.json`);
console.log('Sample:', JSON.stringify(students[0], null, 2));
