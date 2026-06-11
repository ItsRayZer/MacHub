const fs = require('fs');
const vm = require('vm');

const code = fs.readFileSync('js/api.js', 'utf8');

const mockWindow = {
  MACHUB_PROXY_URL: '',
  location: { hostname: 'localhost', protocol: 'http:' },
  localStorage: {
    getItem: () => null,
    setItem: () => {},
    removeItem: () => {}
  },
  ExamHubProfile: { get: () => null },
  getStudentInfo: () => null,
  STUDENTS_DB: [],
  document: {
    addEventListener: () => {}
  },
  console: console
};

const sandbox = {
  window: mockWindow,
  document: mockWindow.document,
  console: console,
  localStorage: mockWindow.localStorage,
  setTimeout: setTimeout,
  encodeURIComponent: encodeURIComponent,
  fetch: () => Promise.resolve(),
  Promise: Promise,
  AbortSignal: AbortSignal
};

try {
  vm.createContext(sandbox);
  vm.runInContext(code, sandbox);
  console.log('SUCCESS! window.openPortalDrawer is type:', typeof mockWindow.openPortalDrawer);
} catch (e) {
  console.error('RUNTIME ERROR:', e.message);
  console.error(e.stack);
}
