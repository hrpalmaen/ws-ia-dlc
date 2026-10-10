// Writes a minimal package.json into dist/esm so Node/bundlers treat the
// ESM output (.js files) as ES modules. Run after the ESM tsc build.
const fs = require('fs');
const path = require('path');

const esmDir = path.join(__dirname, 'dist', 'esm');
fs.mkdirSync(esmDir, { recursive: true });
fs.writeFileSync(
  path.join(esmDir, 'package.json'),
  JSON.stringify({ type: 'module' }, null, 2) + '\n'
);
console.log('Wrote dist/esm/package.json ({ type: "module" })');
