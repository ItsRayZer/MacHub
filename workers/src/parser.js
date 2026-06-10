/**
 * ╔══════════════════════════════════════════════════════════════════╗
 * ║   MacHub Parser Module — HTML Parsers using cheerio              ║
 * ║   All parsers run inside Cloudflare Worker (no Node.js APIs)     ║
 * ╚══════════════════════════════════════════════════════════════════╝
 */

import * as cheerio from 'cheerio';
import { SPECS } from './specs.js';

const BASE_URL = SPECS.baseUrl;

/** Generic single HTML table → array of row objects */
function parseSingleTable($, tableEl) {
  const headers = [];
  const rows    = [];

  $(tableEl).find('tr').first().find('th, td').each((_, el) => {
    headers.push($(el).text().trim());
  });

  $(tableEl).find('tr').slice(1).each((_, rowEl) => {
    const rowData = {};
    $(rowEl).find('td').each((i, cell) => {
      const key = headers[i] || `col_${i}`;
      rowData[key] = $(cell).text().trim();
    });
    if (Object.values(rowData).some(v => v)) rows.push(rowData);
  });

  return { headers, rows };
}

/** Attendance page parser — extracts subject-wise attendance */
function parseAttendance(html) {
  const $ = cheerio.load(html);
  const subjects = [];
  let dataTable = null;

  // Extract semesters list
  const semesters = [];
  const semSelect = $('#MainContent_ddlsem, #MainContent_drpsem');
  if (semSelect.length) {
    semSelect.find('option').each((_, opt) => {
      semesters.push({
        value: $(opt).attr('value'),
        text: $(opt).text().trim(),
        selected: $(opt).attr('selected') === 'selected' || $(opt).prop('selected') || false
      });
    });
  }

  // LOCK TARGET: Isolate table containing summary statistics 
  $("table").each((_, el) => {
    const tableText = $(el).text();
    if (tableText.includes("Subjects") || tableText.includes("No. of Sessions") || tableText.includes("Total %")) {
      dataTable = $(el);
    }
  });

  if (!dataTable || !dataTable.length) {
    return { page: 'Attendance', sections: [], semesters };
  }

  // Dynamic Header Matrix Generation
  const headers = [];
  dataTable.find("tr").each((_, row) => {
    if (headers.length > 0) return;
    const cells = $(row).find("th, td");
    if (cells.text().includes("Subjects") || cells.text().includes("Sessions")) {
      cells.each((_, cell) => {
        headers.push($(cell).text().trim().toLowerCase());
      });
    }
  });

  // Row loop calculations
  dataTable.find("tr").each((_, row) => {
    const cells = $(row).find("td");
    if (!cells.length) return;

    const rowData = {};
    cells.each((i, cell) => {
      const key = headers[i] || `col_${i}`;
      rowData[key] = $(cell).text().trim();
    });

    const subjectTitle = rowData["subjects"] || rowData["subject"] || rowData["subject name"] || rowData["programme"] || rowData[headers[0]] || "";
    // Exclude structural headings or spacer rows
    if (!subjectTitle || subjectTitle.toLowerCase().includes("subjects") || subjectTitle.toLowerCase().includes("total")) return;

    const sessions = parseFloat(rowData["no. of sessions"] || rowData["total"] || rowData["total hours"] || rowData["conducted"] || rowData["col_3"] || "0");
    const present  = parseFloat(rowData["no. of present"] || rowData["present"] || rowData["present hours"] || rowData["col_2"] || "0");
    const absent = parseFloat(rowData["no. of absent"] || rowData["absent"] || "0");
    const odAttendance = rowData["od attendance"] || rowData["od"] || "0";
    const medical = rowData["medical"] || "0";
    let percentageText = rowData["total %"] || rowData["total%"] || rowData["%"] || rowData["percentage"] || rowData["pct"] || "";

    if (!percentageText && sessions > 0) {
      percentageText = ((present / sessions) * 100).toFixed(2) + "%";
    }

    const cleanPct = parseFloat(percentageText);
    subjects.push({
      subject: subjectTitle,
      subjectName: subjectTitle,
      Subjects: subjectTitle,
      sessions: sessions,
      totalHours: String(sessions),
      "No. of Sessions": String(sessions),
      present: present,
      presentHours: String(present),
      "No. of Present": String(present),
      absent: absent,
      absentHours: String(absent),
      "No. of Absent": String(absent),
      odAttendance: odAttendance,
      od: odAttendance,
      "OD Attendance": odAttendance,
      medical: medical,
      Medical: medical,
      percentage: percentageText,
      percentageClean: cleanPct,
      "Total %": percentageText,
      "Total%": percentageText,
      belowThreshold: !isNaN(cleanPct) && cleanPct < 75
    });
  });

  return { 
    page: 'Attendance', 
    sections: [{ headers: ['Subject', 'Present', 'Total', '%'], rows: subjects }],
    data: subjects,
    semesters,
    semesterOptions: semesters
  };
}

/** Assessment page parser — groups rows by subject heading */
function parseAssessment(html) {
  const $        = cheerio.load(html);
  const sections = [];

  // Extract semesters list
  const semesters = [];
  const semSelect = $('#MainContent_ddlsem, #MainContent_drpsem');
  if (semSelect.length) {
    semSelect.find('option').each((_, opt) => {
      semesters.push({
        value: $(opt).attr('value'),
        text: $(opt).text().trim(),
        selected: $(opt).attr('selected') === 'selected' || $(opt).prop('selected') || false
      });
    });
  }

  // Multi-table mode: each subject has an h3/h4/b heading then a table
  $('table').each((_, table) => {
    // Try to find the subject name using robust parent-traversal
    let subjectName = '';
    
    // We can look at the table itself or its parents to find direct children of col-sm-12/body
    let current = $(table);
    while (current.length && current.parent().length && !current.parent().is('.col-sm-12') && !current.parent().is('body')) {
      current = current.parent();
    }
    
    // Now current is a direct child of the main container. Look at preceding headings.
    let prevH = current.prevAll('h3, h4, h5, b, strong').first();
    if (prevH.length) {
      subjectName = prevH.text().replace(/\s*\([^)]+\)/g, '').trim();
    } else {
      // Try inside the table's container itself, in case it's in a card
      let prevHInParent = $(table).parent().find('h3, h4, h5, b, strong').first();
      if (prevHInParent.length) {
        subjectName = prevHInParent.text().replace(/\s*\([^)]+\)/g, '').trim();
      }
    }

    if (!subjectName) {
      // Fallback search up the tree
      let el = $(table).parent();
      while (el.length && !subjectName) {
        const candidate = el.find('h3, h4, h5, b, strong').first();
        const text = (candidate.length ? candidate : el).text().trim();
        if (text && text.length > 3 && !/^\d+$/.test(text) && !text.includes('Semester')) {
          subjectName = text.replace(/\s*\([^)]+\)/, '').trim();
        }
        el = el.parent();
      }
    }

    if (!subjectName) {
      subjectName = 'Unknown Subject';
    }

    const { headers, rows } = parseSingleTable($, table);
    if (rows.length > 0) {
      sections.push({ subject: subjectName, headers, rows });
    }
  });

  return { page: 'Assessment', sections, semesters };
}

/** Assignment page parser — splits Active vs Expired tables */
function parseAssignment(html) {
  const $       = cheerio.load(html);
  const active  = [];
  const expired = [];

  $('table').each((_, table) => {
    const prevText = $(table).prevAll('h3, h4, h5, b, p, div').first().text().toLowerCase();
    const isExpired = prevText.includes('expir') || prevText.includes('expired');
    const { rows } = parseSingleTable($, table);

    if (isExpired) {
      expired.push(...rows);
    } else {
      active.push(...rows);
    }
  });

  return { page: 'Assignment', sections: [{ label: 'Active', rows: active }, { label: 'Expired', rows: expired }] };
}

/** Study Material page parser — extracts subject list with view links */
function parseStudyMaterial(html) {
  const $        = cheerio.load(html);
  const subjects = [];
  let headers    = [];

  $('table').each((_, table) => {
    const headerText = $(table).find('tr').first().text().toLowerCase();
    if (!headerText.includes('subject') && !headerText.includes('material') && !headerText.includes('programme')) return;

    headers = [];
    $(table).find('tr').first().find('th, td').each((_, el) => {
      headers.push($(el).text().trim());
    });

    $(table).find('tr').slice(1).each((_, rowEl) => {
      const cells = $(rowEl).find('td');
      if (!cells.length) return;

      const row = {};
      cells.each((i, cell) => {
        const key = headers[i] || `col_${i}`;
        row[key] = $(cell).text().trim();

        // Capture view link if present
        const anchor = $(cell).find('a[href]');
        if (anchor.length) {
          const href = anchor.attr('href');
          row._viewUrl = href.startsWith('http') ? href : `${BASE_URL}/${href.replace(/^\//, '')}`;
        }
      });

      if (Object.values(row).some(v => v && v !== '')) subjects.push(row);
    });
  });

  return { page: 'StudyMaterial', sections: [{ headers, rows: subjects }] };
}

/** Seminar page parser — generic table */
function parseSeminar(html) {
  const $        = cheerio.load(html);
  const sections = [];

  $('table').each((_, table) => {
    const { headers, rows } = parseSingleTable($, table);
    if (rows.length > 0) sections.push({ headers, rows });
  });

  return { page: 'Seminar', sections };
}

/** Dashboard parser — card counters and active courses */
function parseDashboard(html) {
  const $ = cheerio.load(html);
  const result = {
    study_material: 0,
    assessment    : 0,
    assignment    : 0,
    seminar       : 0,
    internal_mark : 0,
    feedback      : 0,
    active_courses: [],
  };

  const lines = $.text().split('\n').map(l => l.trim()).filter(Boolean);
  const cardLabels = {
    'study material': 'study_material',
    'assessment'    : 'assessment',
    'assignment'    : 'assignment',
    'seminar'       : 'seminar',
    'internal mark' : 'internal_mark',
    'internal marks': 'internal_mark',
    'feedback'      : 'feedback',
    'feed back'     : 'feedback',
  };

  lines.forEach((line, i) => {
    for (const [label, key] of Object.entries(cardLabels)) {
      if (line.toLowerCase() === label || line.toLowerCase().includes(label)) {
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

  return { page: 'Dashboard', sections: [{ data: result }] };
}

function deobfuscateCloudflareEmail(encodedString) {
  try {
    let email = "";
    const key = parseInt(encodedString.substring(0, 2), 16);
    for (let n = 2; n < encodedString.length; n += 2) {
      const charCode = parseInt(encodedString.substring(n, 2), 16) ^ key;
      email += String.fromCharCode(charCode);
    }
    return email;
  } catch (e) {
    return "";
  }
}

function processObfuscatedEmails($) {
  $('a').each((_, el) => {
    const href = $(el).attr('href') || '';
    if (href.includes('email-protection')) {
      let cfemail = $(el).attr('data-cfemail') || '';
      if (!cfemail) {
        const hashMatch = href.match(/email-protection#([a-fA-F0-9]+)/);
        if (hashMatch) {
          cfemail = hashMatch[1];
        }
      }
      if (cfemail) {
        const plainEmail = deobfuscateCloudflareEmail(cfemail);
        if (plainEmail) {
          $(el).replaceWith(plainEmail);
        }
      }
    }
  });
}

/** Profile page parser — parses detailed student details */
function parseProfile(html) {
  const $ = cheerio.load(html);
  processObfuscatedEmails($);
  
  // Remove script and style elements
  $('script, style, select, input, textarea, button').remove();
  
  const bodyText = $('body').text().replace(/\s+/g, ' ');

  const result = {
    name: '',
    admissionNo: '',
    course: '',
    batch: '',
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
    abcId: ''
  };

  // Find photo URL
  const $full = cheerio.load(html);
  const photo = $full('img[id*="photo"], img[id*="profile"], img[id*="student"], img[src*="student"]').first();
  if (photo.length) {
    result.photoUrl = photo.attr('src');
  }

  // Name, Admission No, Course, Batch
  const nameMatch = bodyText.match(/View Student Profile\s*([A-Z\s]+?)\s*(\d+)/i);
  if (nameMatch) {
    result.name = nameMatch[1].trim();
    result.admissionNo = nameMatch[2].trim();
  }
  
  const courseMatch = bodyText.match(/View Student Profile[^]+?\d+\s*([A-Z\s()&,-]+?)\s*\(\s*\d{4}/i);
  if (courseMatch) {
    result.course = courseMatch[1].trim();
  }
  
  const batchMatch = bodyText.match(/\(\s*(\d{4}\s*-\s*\d{4})\s*\)/);
  if (batchMatch) {
    result.batch = batchMatch[1].trim();
  }

  const extractField = (pattern) => {
    const match = bodyText.match(pattern);
    return match ? match[1].trim() : '';
  };

  result.dob = extractField(/Date Of Birth\s*([0-9-]{10})/i);
  result.phone = extractField(/Mobile\s*(\d{10})/i);
  result.email = extractField(/Email\s*([a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,4})/i);
  result.gender = extractField(/Gender\s*(MALE|FEMALE|OTHER)/i);
  
  // Blood group matches
  const bgMatch = bodyText.match(/Blood Group\s*(A\+|A-|B\+|B-|AB\+|AB-|O\+|O-)/i);
  result.bloodGroup = bgMatch ? bgMatch[1].trim() : '';
  
  result.aadhar = extractField(/Aadhaar\s*(\d{12})/i);
  result.nationality = extractField(/Nationality\s*([A-Z\s]+?)\s*(Other Details|Religion)/i);
  result.religion = extractField(/Religion\s*([A-Z\s]+?)\s*Caste/i);
  result.caste = extractField(/Caste\s*([A-Z\s]+?)\s*Reservation/i);
  result.category = extractField(/Reservation\s*([A-Z\s]+?)\s*Annual Income/i);
  result.income = extractField(/Annual Income\s*([0-9\s]*?)\s*(Permanent Address|Communication Address|Other Details)/i);
  result.abcId = extractField(/ABC ID\s*([A-Za-z0-9_-]+)/i);

  // Address matching
  const addrMatch = bodyText.match(/Permanent Address\s*([^]+?)\s*Communication Address/i);
  if (addrMatch) {
    result.address = addrMatch[1].trim().replace(/\s*-$/, '').trim();
  }

  const commMatch = bodyText.match(/Communication Address\s*([^]+?)\s*(Father Info|Mother Info|Guardian Info)/i);
  if (commMatch) {
    result.commAddress = commMatch[1].trim().replace(/\s*-$/, '').trim();
  }

  // Parent matching
  const fatherMatch = bodyText.match(/Father Info\s*Name\s*([A-Z\s]+?)\s*(Occupation|Phone|Email)/i);
  if (fatherMatch) {
    result.guardianName = fatherMatch[1].trim();
  }
  const fatherPhone = bodyText.match(/Father Info[^]+?Phone\s*(\d{10})/i);
  if (fatherPhone) {
    result.guardianPhone = fatherPhone[1].trim();
  }
  const fatherEmail = bodyText.match(/Father Info[^]+?Email\s*([a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,4})/i);
  if (fatherEmail) {
    result.guardianEmail = fatherEmail[1].trim();
  }

  return { page: 'Profile', sections: [{ data: result }] };
}

/** Concession card page parser — extracts route inputs and security tokens */
function parseConcession(html) {
  const $ = cheerio.load(html);
  
  const routes = [
    { from: $('#MainContent_txtFrom1').val() || '', to: $('#MainContent_txtTo1').val() || '' },
    { from: $('#MainContent_txtFrom2').val() || '', to: $('#MainContent_txtTo2').val() || '' },
    { from: $('#MainContent_txtFrom3').val() || '', to: $('#MainContent_txtTo3').val() || '' },
    { from: $('#MainContent_txtFrom4').val() || '', to: $('#MainContent_txtTo4').val() || '' }
  ];

  const hid_stdid = $('#MainContent_hid_stdid').val() || $('[name="ctl00$MainContent$hid_stdid"]').val() || '';

  const tokens = {
    __VIEWSTATE: $('#__VIEWSTATE').val() || '',
    __VIEWSTATEGENERATOR: $('#__VIEWSTATEGENERATOR').val() || '',
    __EVENTVALIDATION: $('#__EVENTVALIDATION').val() || '',
    hid_stdid
  };

  return { page: 'Concession', sections: [{ data: { routes, tokens } }] };
}

/** Grievance form page parser */
function parseGrievance(html) {
  const $ = cheerio.load(html);
  const options = [];
  
  $('#MainContent_ddlTo option').each((_, el) => {
    options.push({
      value: $(el).attr('value'),
      text: $(el).text().trim()
    });
  });

  const hid_stdid = $('#MainContent_hid_stdid').val() || '';
  const hdnBatch = $('#MainContent_hdnBatch').val() || '';

  const tokens = {
    __VIEWSTATE: $('#__VIEWSTATE').val() || '',
    __VIEWSTATEGENERATOR: $('#__VIEWSTATEGENERATOR').val() || '',
    __EVENTVALIDATION: $('#__EVENTVALIDATION').val() || '',
    hid_stdid,
    hdnBatch
  };

  return { page: 'Grievance', sections: [{ data: { options, tokens } }] };
}

function parseAttendanceDetails(html) {
  const $ = cheerio.load(html);
  const records = [];
  let dataTable = null;

  // Extract semesters list
  const semesters = [];
  const semSelect = $('#MainContent_ddlsem, #MainContent_drpsem');
  if (semSelect.length) {
    semSelect.find('option').each((_, opt) => {
      semesters.push({
        value: $(opt).attr('value'),
        text: $(opt).text().trim(),
        selected: $(opt).attr('selected') === 'selected' || $(opt).prop('selected') || false
      });
    });
  }

  // DETERMINISTIC SCAN: Identify the precise table matching the transactional schema
  $("table").each((_, el) => {
    const tableText = $(el).text();
    if (tableText.includes("1st Hour") || tableText.includes("Date") || tableText.includes("SL")) {
      dataTable = $(el);
    }
  });

  if (!dataTable || !dataTable.length) {
    return { page: 'AttendanceDetails', sections: [], semesters };
  }

  // Isolate Headers securely
  const headers = [];
  dataTable.find("tr").each((rowIndex, row) => {
    if (headers.length > 0) return; // Keep only the first matched header row
    const cells = $(row).find("th, td");
    const sampleText = cells.text();
    if (sampleText.includes("Date") || sampleText.includes("1st Hour")) {
      cells.each((_, cell) => {
        headers.push($(cell).text().trim());
      });
    }
  });

  // Process Transactional Rows cleanly
  dataTable.find("tr").each((_, row) => {
    const cells = $(row).find("td");
    if (!cells.length) return;

    const rowData = {};
    let hasMeaningfulData = false;

    cells.each((i, cell) => {
      const key = headers[i] || `col_${i}`;
      if (key === `col_${i}`) return; // Skip unmatched alignment bounds

      const cellText = $(cell).text().trim();
      rowData[key] = cellText;
      if (cellText) hasMeaningfulData = true;

      // Hour-column validation & Status detection rules
      if (key.toLowerCase().includes("hour") || key.toLowerCase().includes("b2")) {
        let status = "present";
        const cellHtml = $(cell).html() || "";
        
        if (cellHtml.includes("color:Red") || cellHtml.includes("color: red") || cellHtml.includes('color="Red"') || $(cell).find("[style*='red'], [style*='Red']").length) {
          status = "absent";
        } else if (cellHtml.includes("color:Orange") || cellHtml.includes("color: orange") || cellText.toLowerCase().includes("special")) {
          status = "special";
        }
        rowData[`${key}_status`] = status;
      }
    });

    // Filter out system spacer rows or layout paddings
    if (hasMeaningfulData && (rowData["SL"] || rowData["Date"])) {
      records.push(rowData);
    }
  });

  return { 
    page: 'AttendanceDetails', 
    sections: [{ headers, rows: records }],
    data: records,
    semesters,
    semesterOptions: semesters,
    meta: {
      totalLogCount: records.length
    }
  };
}

function parseAttendanceSubjectWise(html) {
  const parsed = parseAttendance(html);
  parsed.page = 'AttendanceSubjectWise';
  return parsed;
}

/** Generic fallback parser for unknown pages */
function parseGeneric(page, html) {
  const $        = cheerio.load(html);
  const sections = [];

  $('table').each((_, table) => {
    const { headers, rows } = parseSingleTable($, table);
    if (rows.length > 0) sections.push({ headers, rows });
  });

  return { page, sections };
}

/** Route pageName to the correct parser. */
export function parseHtml(pageName, html) {
  switch (pageName) {
    case 'Dashboard': return parseDashboard(html);
    case 'Profile': return parseProfile(html);
    case 'Attendance': return parseAttendance(html);
    case 'AttendanceDetails': return parseAttendanceDetails(html);
    case 'AttendanceSubjectWise': return parseAttendanceSubjectWise(html);
    case 'SubjectWiseAttendance': return parseAttendanceSubjectWise(html);
    case 'Assessment': return parseAssessment(html);
    case 'Assignment': return parseAssignment(html);
    case 'Seminar': return parseSeminar(html);
    case 'StudyMaterial': return parseStudyMaterial(html);
    case 'Concession': return parseConcession(html);
    case 'Grievance': return parseGrievance(html);
    default: return parseGeneric(pageName, html);
  }
}
