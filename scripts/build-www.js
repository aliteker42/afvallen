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

/* Calisan surumu ekranda gorebilmek icin derleme damgasi.
   Onbellekten eski kod mu geliyor, yoksa gercek ariza mi — bunu
   ayirt etmenin baska yolu yok. */
const stamp = (process.env.GITHUB_SHA || 'dev').slice(0, 7);

for (const f of FILES) {
  const src = path.join(root, f);
  if (f === 'index.html') {
    fs.writeFileSync(path.join(out, f),
      fs.readFileSync(src, 'utf8').replace('__BUILD__', stamp));
  } else {
    fs.copyFileSync(src, path.join(out, f));
  }
}
for (const d of DIRS) {
  fs.cpSync(path.join(root, d), path.join(out, d), { recursive: true });
}

console.log('www/ hazır (' + stamp + '):', fs.readdirSync(out).join(', '));
