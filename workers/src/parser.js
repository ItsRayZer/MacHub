/**
 * ╔══════════════════════════════════════════════════════════════════╗
 * ║   MacHub Parser Module — HTML Parsers using cheerio              ║
 * ║   All parsers run inside Cloudflare Worker (no Node.js APIs)     ║
 * ╚══════════════════════════════════════════════════════════════════╝
 */

import * as cheerio from 'cheerio';
import { SPECS } from './specs.js';

const BASE_URL = SPECS.baseUrl;

// ═══════════════════════════════════════════════════════════════
//  PRIMITIVE HELPERS
// ═══════════════════════════════════════════════════════════════

/**
 * Parse a single HTML table into { headers, rows }.
 * Headers come from first row (th or td).
 * Rows are arrays of objects keyed by header name.
 */
export function parseSingleTable($, tableEl) {
  const headers = [];
  const rows = [];

  $(tableEl).find('tr').first().find('th, td').each((_, el) => {
    headers.push($(el).text().trim());
  });

  $(tableEl).find('tr').slice(1).each((_, rowEl) => {
    const rowData = {};
    let hasData = false;
    $(rowEl).find('td').each((i, cell) => {
      const key = headers[i] || `col_${i}`;
      const text = $(cell).text().trim();
      rowData[key] = text;
      // Capture first link found in cell
      const link = $(cell).find('a[href]').first();
      if (link.length) {
        const href = link.attr('href') || '';
        rowData[`_link_${key}`] = href.startsWith('http') ? href : `${BASE_URL}${href.startsWith('/') ? '' : '/'}${href}`;
      }
      if (text) hasData = true;
    });
    if (hasData) rows.push(rowData);
  });

  return { headers, rows };
}

// ═══════════════════════════════════════════════════════════════
//  PAGE-SPECIFIC PARSERS
// ═══════════════════════════════════════════════════════════════

/**
 * Dashboard parser — extracts counter cards and active courses.
 */
export function parseDashboard(html) {
  const $ = cheerio.load(html);

  const result = {
    studyMaterial: 0,
    assessment: 0,
    assignment: 0,
    seminar: 0,
    internalMark: 0,
    feedback: 0,
    activeCourses: [],
    studentName: '',
    department: '',
    semester: '',
    batch: '',
  };

  // Extract student info from header area
  const headerArea = $('h4, h3, .student-name, [class*="welcome"], [class*="profile"]').first();
  if (headerArea.length) {
    result.studentName = headerArea.text().trim();
  }

  // Look for department/programme info
  $('span, td, p, div').each((_, el) => {
    const text = $(el).text().trim();
    const lower = text.toLowerCase();
    if (lower.includes('bca') || lower.includes('bba') || lower.includes('b.com') ||
        lower.includes('b.sc') || lower.includes('mca') || lower.includes('mba')) {
      if (text.length < 100 && !result.department) {
        result.department = text;
      }
    }
    if (/sem\s*\d/i.test(text) && text.length < 30 && !result.semester) {
      result.semester = text.trim();
    }
    if (/\d{4}\s*-\s*\d{4}/i.test(text) && !result.batch) {
      const match = text.match(/(\d{4}\s*-\s*\d{4})/);
      if (match) result.batch = match[1];
    }
  });

  // Extract card counters using text proximity
  const lines = $.text()
    .split('\n')
    .map(l => l.trim())
    .filter(Boolean);

  const cardLabels = {
    'study material': 'studyMaterial',
    'studymaterial': 'studyMaterial',
    'assessment': 'assessment',
    'assignment': 'assignment',
    'seminar': 'seminar',
    'internal mark': 'internalMark',
    'internal marks': 'internalMark',
    'feedback': 'feedback',
    'feed back': 'feedback',
  };

  lines.forEach((line, i) => {
    const lower = line.toLowerCase().replace(/\s+/g, ' ');
    for (const [label, key] of Object.entries(cardLabels)) {
      if (lower === label || lower.includes(label)) {
        // Search ±3 lines for a standalone number
        for (let offset = -3; offset <= 3; offset++) {
          const idx = i + offset;
          if (idx >= 0 && idx < lines.length && /^\d+$/.test(lines[idx])) {
            result[key] = parseInt(lines[idx], 10);
            break;
          }
        }
      }
    }
  });

  // Also try to find counters from the DOM structure — cards/badges
  $('[class*="count"], [class*="badge"], [class*="number"], [class*="counter"]').each((_, el) => {
    const num = parseInt($(el).text().trim(), 10);
    if (!isNaN(num)) {
      const parent = $(el).closest('[class]').text().toLowerCase();
      for (const [label, key] of Object.entries(cardLabels)) {
        if (parent.includes(label)) {
          result[key] = num;
          break;
        }
      }
    }
  });

  return { page: 'Dashboard', data: result };
}

/**
 * Profile parser — extracts detailed student profile info.
 */
export function parseProfile(html) {
  const $ = cheerio.load(html);

  // Remove noise
  $('script, style, select, button, noscript').remove();

  const result = {
    name: '',
    admissionNo: '',
    course: '',
    batch: '',
    semester: '',
    dob: '',
    phone: '',
    email: '',
    gender: '',
    bloodGroup: '',
    aadhar: '',
    nationality: '',
    religion: '',
    caste: '',
    category: '',
    income: '',
    address: '',
    commAddress: '',
    guardianName: '',
    guardianPhone: '',
    guardianEmail: '',
    photoUrl: '',
    abcId: '',
    department: '',
  };

  // Photo
  const photo = $('img[id*="photo" i], img[id*="profile" i], img[id*="student" i], img[src*="student" i], img[src*="photo" i]').first();
  if (photo.length) {
    const src = photo.attr('src') || '';
    result.photoUrl = src.startsWith('http') ? src : `${BASE_URL}/${src.replace(/^\//, '')}`;
  }

  const bodyText = $('body').text().replace(/\s+/g, ' ').trim();

  // Try table row parsing first (label → value pairs)
  $('tr').each((_, rowEl) => {
    const cells = $(rowEl).find('td');
    if (cells.length >= 2) {
      const label = cells.eq(0).text().trim().toLowerCase().replace(/\s+/g, ' ');
      const value = cells.eq(1).text().trim();

      const fieldMap = {
        'name': 'name',
        'student name': 'name',
        'admission no': 'admissionNo',
        'admission number': 'admissionNo',
        'programme': 'course',
        'course': 'course',
        'batch': 'batch',
        'semester': 'semester',
        'date of birth': 'dob',
        'dob': 'dob',
        'mobile': 'phone',
        'phone': 'phone',
        'mobile number': 'phone',
        'email': 'email',
        'gender': 'gender',
        'blood group': 'bloodGroup',
        'aadhaar': 'aadhar',
        'aadhar': 'aadhar',
        'nationality': 'nationality',
        'religion': 'religion',
        'caste': 'caste',
        'reservation': 'category',
        'annual income': 'income',
        'permanent address': 'address',
        'communication address': 'commAddress',
        'abc id': 'abcId',
        'department': 'department',
      };

      for (const [lbl, field] of Object.entries(fieldMap)) {
        if (label.includes(lbl) && value && !result[field]) {
          result[field] = value;
        }
      }
    }
  });

  // Try dt/dd pairs
  $('dt').each((_, dtEl) => {
    const label = $(dtEl).text().trim().toLowerCase();
    const ddEl = $(dtEl).next('dd');
    if (!ddEl.length) return;
    const value = ddEl.text().trim();
    if (label.includes('name') && !result.name) result.name = value;
    if (label.includes('admission') && !result.admissionNo) result.admissionNo = value;
    if (label.includes('programme') && !result.course) result.course = value;
  });

  // Regex fallbacks on full body text
  const extract = (pattern) => {
    const match = bodyText.match(pattern);
    return match ? match[1].trim() : '';
  };

  if (!result.name) result.name = extract(/View Student Profile\s*([A-Z][A-Z\s]+?)\s*\d/i);
  if (!result.admissionNo) result.admissionNo = extract(/Admission No[:\s]+(\d+)/i);
  if (!result.course) result.course = extract(/Programme[:\s]+([A-Z\s()\-&,]+?)(?:\s*\(|\s*Batch|\s*Semester)/i);
  if (!result.batch) {
    const bm = bodyText.match(/(\d{4}\s*-\s*\d{4})/);
    if (bm) result.batch = bm[1];
  }
  if (!result.dob) result.dob = extract(/Date Of Birth[:\s]+([0-9\/\-]+)/i);
  if (!result.phone) result.phone = extract(/Mobile[:\s]+([\d\s]{10,})/i);
  if (!result.email) result.email = extract(/Email[:\s]+([a-zA-Z0-9._%+\-]+@[a-zA-Z0-9.\-]+\.[a-zA-Z]{2,})/i);
  if (!result.gender) result.gender = extract(/Gender[:\s]+(MALE|FEMALE|OTHER)/i);
  if (!result.aadhar) result.aadhar = extract(/Aadhaar[:\s]+(\d{12})/i);
  if (!result.abcId) result.abcId = extract(/ABC ID[:\s]+([A-Za-z0-9_\-]+)/i);

  // Department detection — from course name
  if (!result.department && result.course) {
    const courseText = result.course.toUpperCase();
    if (courseText.includes('BCA') || courseText.includes('COMPUTER APPLICATIONS')) result.department = 'BCA';
    else if (courseText.includes('BBA') || courseText.includes('BUSINESS ADMINISTRATION')) result.department = 'BBA';
    else if (courseText.includes('B.COM') || courseText.includes('COMMERCE')) result.department = 'B.Com';
    else if (courseText.includes('B.SC') || courseText.includes('SCIENCE')) result.department = 'B.Sc';
    else if (courseText.includes('BA') || courseText.includes('ARTS')) result.department = 'BA';
    else if (courseText.includes('MCA')) result.department = 'MCA';
    else if (courseText.includes('MSC') || courseText.includes('M.SC')) result.department = 'M.Sc';
    else result.department = result.course.split(' ').slice(0, 2).join(' ');
  }

  return { page: 'Profile', data: result };
}

/**
 * Attendance parser — subject-wise attendance table.
 */
export function parseAttendance(html) {
  const $ = cheerio.load(html);
  const records = [];

  // Extract semester options
  const semesters = [];
  const semSelect = $('#MainContent_ddlsem, #MainContent_drpsem, select[id*="sem" i]').first();
  if (semSelect.length) {
    semSelect.find('option').each((_, opt) => {
      semesters.push({
        value: $(opt).attr('value'),
        text: $(opt).text().trim(),
        selected: $(opt).is('[selected]') || $(opt).prop('selected'),
      });
    });
  }

  $('table').each((_, table) => {
    const firstRowText = $(table).find('tr').first().text().toLowerCase();
    if (!firstRowText.includes('subject') && !firstRowText.includes('attendance')
        && !firstRowText.includes('present') && !firstRowText.includes('conducted')) {
      return;
    }

    const headers = [];
    $(table).find('tr').first().find('th, td').each((_, el) => {
      headers.push($(el).text().trim().toLowerCase());
    });

    $(table).find('tr').slice(1).each((_, rowEl) => {
      const cells = $(rowEl).find('td');
      if (!cells.length) return;

      const row = {};
      cells.each((i, cell) => {
        row[headers[i] || `col_${i}`] = $(cell).text().trim();
      });

      const record = {
        subjectName: row['subject'] || row['subject name'] || row['programme']
                     || row['course'] || row[headers[1]] || row[headers[0]] || '',
        subjectCode: row['code'] || row['subject code'] || row['course code'] || '',
        presentHours: row['present'] || row['present hours'] || row['no. of present'] || row['present days'] || '',
        totalHours: row['total'] || row['total hours'] || row['conducted'] || row['total days'] || row['no. of class'] || '',
        percentage: row['percentage'] || row['%'] || row['attendance %'] || row['attendance percentage'] || '',
        semester: row['semester'] || row['sem'] || '',
      };

      // Calculate percentage if missing
      if (!record.percentage && record.presentHours && record.totalHours) {
        const p = parseFloat(record.presentHours);
        const t = parseFloat(record.totalHours);
        if (t > 0) record.percentage = ((p / t) * 100).toFixed(1) + '%';
      }

      if (record.subjectName) records.push(record);
    });
  });

  return { page: 'Attendance', data: { records, semesters } };
}

/**
 * Assessment parser — groups assessment rows by subject.
 * Each subject has an h3/h4/b heading before its table.
 */
export function parseAssessment(html) {
  const $ = cheerio.load(html);
  const subjects = [];

  // Extract semester options
  const semesters = [];
  $('#MainContent_ddlsem, #MainContent_drpsem, select[id*="sem" i]').first().find('option').each((_, opt) => {
    semesters.push({
      value: $(opt).attr('value'),
      text: $(opt).text().trim(),
      selected: $(opt).is('[selected]') || $(opt).prop('selected'),
    });
  });

  $('table').each((_, table) => {
    const { headers, rows } = parseSingleTable($, table);
    if (rows.length === 0) return;

    // Find subject heading before this table
    let subjectName = '';
    let cursor = $(table);

    // Walk up and look at preceding siblings for headings
    for (let depth = 0; depth < 5; depth++) {
      const prev = cursor.prevAll('h3, h4, h5, strong, b').first();
      if (prev.length) {
        subjectName = prev.text().replace(/\s*\([^)]+\)/g, '').trim();
        break;
      }
      const parentPrev = cursor.parent().prevAll('h3, h4, h5, strong, b').first();
      if (parentPrev.length) {
        subjectName = parentPrev.text().replace(/\s*\([^)]+\)/g, '').trim();
        break;
      }
      cursor = cursor.parent();
    }

    if (!subjectName) subjectName = 'Unknown Subject';

    subjects.push({ subject: subjectName, headers, rows });
  });

  return { page: 'Assessment', data: { subjects, semesters } };
}

/**
 * Assignment parser — Active vs Expired tabs.
 */
export function parseAssignment(html) {
  const $ = cheerio.load(html);
  const active = [];
  const expired = [];

  $('table').each((_, table) => {
    // Determine tab context by looking at previous headings/tabs
    const prevElements = $(table).prevAll('h3, h4, h5, div[class*="tab"], a, p, strong, b');
    let isExpired = false;

    prevElements.each((_, el) => {
      const text = $(el).text().toLowerCase();
      if (text.includes('expir')) {
        isExpired = true;
        return false; // break
      }
      if (text.includes('active')) {
        isExpired = false;
        return false; // break
      }
    });

    const { rows } = parseSingleTable($, table);
    const noData = rows.length === 0 ||
      (rows.length === 1 && Object.values(rows[0]).some(v => v.toLowerCase().includes('no data') || v.toLowerCase().includes('no record')));

    if (!noData) {
      if (isExpired) expired.push(...rows);
      else active.push(...rows);
    }
  });

  return { page: 'Assignment', data: { active, expired } };
}

/**
 * Seminar parser — Active vs Expired tabs.
 */
export function parseSeminar(html) {
  const $ = cheerio.load(html);
  const active = [];
  const expired = [];

  $('table').each((_, table) => {
    const prevElements = $(table).prevAll('h3, h4, h5, div[class*="tab"], a, p, strong, b');
    let isExpired = false;

    prevElements.each((_, el) => {
      const text = $(el).text().toLowerCase();
      if (text.includes('expir')) { isExpired = true; return false; }
      if (text.includes('active')) { isExpired = false; return false; }
    });

    const { rows } = parseSingleTable($, table);
    const noData = rows.length === 0 ||
      (rows.length === 1 && Object.values(rows[0]).some(v => v.toLowerCase().includes('no data')));

    if (!noData) {
      if (isExpired) expired.push(...rows);
      else active.push(...rows);
    }
  });

  return { page: 'Seminar', data: { active, expired } };
}

/**
 * Study Material subject list parser.
 */
export function parseStudyMaterial(html) {
  const $ = cheerio.load(html);
  const subjects = [];

  $('table').each((_, table) => {
    const firstRowText = $(table).find('tr').first().text().toLowerCase();
    if (!firstRowText.includes('subject') && !firstRowText.includes('material')
        && !firstRowText.includes('programme') && !firstRowText.includes('sem')) {
      return;
    }

    const headers = [];
    $(table).find('tr').first().find('th, td').each((_, el) => {
      headers.push($(el).text().trim());
    });

    $(table).find('tr').slice(1).each((_, rowEl) => {
      const cells = $(rowEl).find('td');
      if (!cells.length) return;

      const row = {};
      let hasData = false;
      cells.each((i, cell) => {
        const key = headers[i] || `col_${i}`;
        row[key] = $(cell).text().trim();
        if (row[key]) hasData = true;

        const anchor = $(cell).find('a[href]').first();
        if (anchor.length) {
          const href = anchor.attr('href') || '';
          row._viewUrl = href.startsWith('http') ? href : `${BASE_URL}${href.startsWith('/') ? '' : '/'}${href}`;
        }
      });

      if (hasData) {
        // Extract subject code from name or dedicated code column
        let name = '';
        let code = '';
        let semester = '';
        let category = '';

        for (const [k, v] of Object.entries(row)) {
          const kl = k.toLowerCase();
          if (kl.includes('subject') || kl.includes('name') || kl.includes('programme')) name = name || v;
          if (kl.includes('code')) code = code || v;
          if (kl.includes('sem')) semester = semester || v;
          if (kl.includes('category') || kl.includes('type') || kl.includes('course type')) category = category || v;
        }

        // Extract code from parentheses in name if not found
        if (!code && name) {
          const codeMatch = name.match(/\(([A-Z0-9]+)\)/);
          if (codeMatch) code = codeMatch[1];
        }

        subjects.push({
          name: name || Object.values(row)[0] || '',
          code,
          semester,
          category,
          viewUrl: row._viewUrl || '',
          raw: row,
        });
      }
    });
  });

  return { page: 'StudyMaterial', data: { subjects } };
}

/**
 * Internal mark (InternalToUniversity) parser — multi-subject tables.
 */
export function parseInternalMark(html) {
  const $ = cheerio.load(html);
  const subjects = [];

  // Extract semester options
  const semesters = [];
  $('select[id*="sem" i], select[id*="Sem" i]').first().find('option').each((_, opt) => {
    semesters.push({
      value: $(opt).attr('value'),
      text: $(opt).text().trim(),
      selected: $(opt).is('[selected]') || $(opt).prop('selected'),
    });
  });

  $('table').each((_, table) => {
    const { headers, rows } = parseSingleTable($, table);
    if (rows.length === 0) return;

    let subjectName = '';
    let cursor = $(table);
    for (let depth = 0; depth < 5; depth++) {
      const prev = cursor.prevAll('h3, h4, h5, strong, b').first();
      if (prev.length) {
        subjectName = prev.text().replace(/\s*\([^)]+\)/g, '').trim();
        break;
      }
      cursor = cursor.parent();
    }

    subjects.push({ subject: subjectName || 'Unknown Subject', headers, rows });
  });

  return { page: 'InternalMark', data: { subjects, semesters } };
}

/**
 * Generic fallback parser — extracts all tables.
 */
export function parseGeneric(pageName, html) {
  const $ = cheerio.load(html);
  const tables = [];

  $('table').each((_, table) => {
    const { headers, rows } = parseSingleTable($, table);
    if (rows.length > 0) tables.push({ headers, rows });
  });

  return { page: pageName, data: { tables } };
}

/**
 * Fee Payment parser.
 */
export function parseFeePayment(html) {
  const $ = cheerio.load(html);
  const payments = [];

  $('table').each((_, table) => {
    const firstRowText = $(table).find('tr').first().text().toLowerCase();
    if (!firstRowText.includes('fee') && !firstRowText.includes('amount')
        && !firstRowText.includes('pay') && !firstRowText.includes('receipt')) return;

    const { headers, rows } = parseSingleTable($, table);
    payments.push(...rows);
  });

  return { page: 'FeePayment', data: { payments } };
}

/**
 * Exam Result parser.
 */
export function parseExamResult(html) {
  const $ = cheerio.load(html);
  const results = [];

  $('table').each((_, table) => {
    const firstRowText = $(table).find('tr').first().text().toLowerCase();
    if (!firstRowText.includes('result') && !firstRowText.includes('grade')
        && !firstRowText.includes('mark') && !firstRowText.includes('subject')) return;

    const { headers, rows } = parseSingleTable($, table);
    if (rows.length > 0) results.push({ headers, rows });
  });

  return { page: 'ExamResult', data: { results } };
}

/**
 * Hall Ticket parser.
 */
export function parseHallTicket(html) {
  const $ = cheerio.load(html);

  const iframes = [];
  $('iframe').each((_, el) => {
    iframes.push($(el).attr('src') || '');
  });

  const pdfLinks = [];
  $('a[href$=".pdf"], a[href*="pdf" i]').each((_, el) => {
    const href = $(el).attr('href') || '';
    pdfLinks.push(href.startsWith('http') ? href : `${BASE_URL}${href}`);
  });

  const tables = [];
  $('table').each((_, table) => {
    const { rows } = parseSingleTable($, table);
    if (rows.length > 0) tables.push(rows);
  });

  return {
    page: 'HallTicket',
    data: { iframes, pdfLinks, tables, hasTicket: iframes.length > 0 || pdfLinks.length > 0 }
  };
}

/**
 * Allotment Memo parser.
 */
export function parseAllotmentMemo(html) {
  const $ = cheerio.load(html);

  const iframes = [];
  $('iframe').each((_, el) => {
    iframes.push($(el).attr('src') || '');
  });

  const pdfLinks = [];
  $('a[href$=".pdf"], a[href*="pdf" i]').each((_, el) => {
    const href = $(el).attr('href') || '';
    pdfLinks.push(href.startsWith('http') ? href : `${BASE_URL}${href}`);
  });

  return { page: 'AllotmentMemo', data: { iframes, pdfLinks, hasMemo: iframes.length > 0 || pdfLinks.length > 0 } };
}

/**
 * FYUGP Course Selection parser.
 */
export function parseFYUGP(html) {
  const $ = cheerio.load(html);
  const courses = [];

  $('table').each((_, table) => {
    const { headers, rows } = parseSingleTable($, table);
    if (rows.length > 0) courses.push({ headers, rows });
  });

  return { page: 'FYUGP', data: { courses } };
}

/**
 * Route pageName to the correct parser.
 */
export function parseHtml(pageName, html) {
  switch (pageName) {
    case 'Dashboard': return parseDashboard(html);
    case 'Profile': return parseProfile(html);
    case 'Attendance': return parseAttendance(html);
    case 'Assessment': return parseAssessment(html);
    case 'Assignment': return parseAssignment(html);
    case 'Seminar': return parseSeminar(html);
    case 'StudyMaterial': return parseStudyMaterial(html);
    case 'InternalMark': return parseInternalMark(html);
    case 'InternalToUniversity': return parseInternalMark(html);
    case 'FeePayment': return parseFeePayment(html);
    case 'ExamResult': return parseExamResult(html);
    case 'HallTicket': return parseHallTicket(html);
    case 'AllotmentMemo': return parseAllotmentMemo(html);
    case 'FYUGP': return parseFYUGP(html);
    default: return parseGeneric(pageName, html);
  }
}
