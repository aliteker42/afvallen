/* Web dosyalarını www/ klasörüne kopyalar.
   Capacitor webDir olarak proje kökünü kullanamaz (kendi içine kopyalayamaz),
   bu yüzden yayınlanacak dosyaları ayrı bir klasörde topluyoruz. */

const fs = require('fs');
const path = require('path');

const root = path.join(__dirname, '..');
const out = path.join(root, 'www');

const FILES = ['index.html', 'manifest.webmanifest', 'sw.js', '.nojekyll'];
const DIRS = ['css', 'js', 'icons'];

fs.rmSync(out, { recursive: true, force: true });
fs.mkdirSync(out, { recursive: true });

for (const f of FILES) {
  fs.copyFileSync(path.join(root, f), path.join(out, f));
}
for (const d of DIRS) {
  fs.cpSync(path.join(root, d), path.join(out, d), { recursive: true });
}

console.log('www/ hazır:', fs.readdirSync(out).join(', '));
