const fs = require('fs');
const path = require('path');

const appJsPath = path.join(__dirname, '../js/app.js');
let appJs = fs.readFileSync(appJsPath, 'utf8');

// Remove secondaryPanel string assignment logic
appJs = appJs.replace(/const secondaryPanel = showPracticalRoute[\s\S]*?:\s*'';/, 'const secondaryPanel = \'\';');
fs.writeFileSync(appJsPath, appJs);

const indexHtmlPath = path.join(__dirname, '../index.html');
let indexHtml = fs.readFileSync(indexHtmlPath, 'utf8');

// Remove Edit Profile button in view-home grid
indexHtml = indexHtml.replace(/<div onclick="openEditProfile\(\)"[\s\S]*?<\/div>/, '');

// Remove Academic Info button in view-home
indexHtml = indexHtml.replace(/<button onclick="openAcademicSheet\(\)"[^>]*>[\s\S]*?<\/button>/, '');
// And other Academic Info buttons (resource-action-card)
indexHtml = indexHtml.replace(/<button onclick="openAcademicSheet\(\)" class="resource-action-card spring">[\s\S]*?<\/button>/g, '');

// Remove the hamburger menu for Edit Profile
indexHtml = indexHtml.replace(/<button onclick="openEditProfile\(\)" id="tab-view-profile-menu"[^>]*>[\s\S]*?<\/button>/, '');

// Remove Edit Profile Bottom Sheet
indexHtml = indexHtml.replace(/<!-- Edit Profile Bottom Sheet -->[\s\S]*?<div id="editProfileSheet"[\s\S]*?<\/div>\s*<\/div>/, '');

// Remove Academic Sheet
indexHtml = indexHtml.replace(/<!-- Academic Sheet -->[\s\S]*?<div id="academicSheet"[\s\S]*?<\/div>\s*<\/div>\s*<div id="academicBackdrop"[^>]*><\/div>/, '');

fs.writeFileSync(indexHtmlPath, indexHtml);

console.log('Features removed');
