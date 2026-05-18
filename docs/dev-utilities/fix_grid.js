const fs = require('fs');
const indexHtmlPath = 'index.html';
let indexHtml = fs.readFileSync(indexHtmlPath, 'utf8');

indexHtml = indexHtml.replace(
  '<div class="glass-panel p-6 rounded-[2.5rem]">\r\n                <p class="text-[10px] font-bold text-[#86868b] uppercase tracking-widest mb-2">Location</p>',
  '<div class="glass-panel p-6 rounded-[2.5rem] col-span-2">\r\n                <p class="text-[10px] font-bold text-[#86868b] uppercase tracking-widest mb-2">Location</p>'
);

fs.writeFileSync(indexHtmlPath, indexHtml);
console.log('Fixed grid');
