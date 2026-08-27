/**
 * Copies the front-end libraries the app depends on out of node_modules and
 * into static/libs, which is what index.html actually loads. The copies are
 * committed so the app never needs a CDN (or a build step) to run.
 *
 * Usage: npm run vendor   (copies the libraries, then rebuilds tailwind.css)
 */
const fs = require('fs');
const path = require('path');

const root = path.join(__dirname, '..');
const libs = path.join(root, 'static', 'libs');

const files = [
  ['leaflet/dist/leaflet.js', 'leaflet.js'],
  ['leaflet/dist/leaflet.css', 'leaflet.css'],
  ['lucide/dist/umd/lucide.min.js', 'lucide.min.js'],
  ['qrcodejs/qrcode.min.js', 'qrcode.min.js']
];

// leaflet.css references these by relative path (images/marker-icon.png, ...)
const directories = [
  ['leaflet/dist/images', 'images']
];

function copyFile(from, to) {
  const source = path.join(root, 'node_modules', from);
  if (!fs.existsSync(source)) {
    throw new Error(`Missing ${from} - run "npm install" first`);
  }
  fs.copyFileSync(source, path.join(libs, to));
  console.log(`${from} -> static/libs/${to}`);
}

fs.mkdirSync(libs, { recursive: true });

for (const [from, to] of files) {
  copyFile(from, to);
}

for (const [from, to] of directories) {
  const source = path.join(root, 'node_modules', from);
  const target = path.join(libs, to);
  fs.rmSync(target, { recursive: true, force: true });
  fs.cpSync(source, target, { recursive: true });
  console.log(`${from}/ -> static/libs/${to}/`);
}
