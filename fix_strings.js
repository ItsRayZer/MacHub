const fs = require('fs');
const files = [
  'machub-app/src/pages/InternalMark.jsx',
  'machub-app/src/pages/ExamResult.jsx',
  'machub-app/src/hooks/usePortalData.js'
];
files.forEach(f => {
  let c = fs.readFileSync(f, 'utf8');
  if (c.startsWith('"')) {
    try {
      c = JSON.parse(c);
      fs.writeFileSync(f, c, 'utf8');
      console.log('fixed ' + f);
    } catch(e) {
      console.error('Failed to parse', f, e);
    }
  }
});
