/* JS'in aradigi her element ya index.html'de olmali ya da JS'in kendi
   urettigi isaretlemede gecmeli. Daha once eksik bir element (#prog-now)
   tum ekrani bos birakmisti; bu kontrol ayni hatayi derlemede yakalar. */

const fs = require('fs');
const path = require('path');
const root = path.join(__dirname, '..');

const html = fs.readFileSync(path.join(root, 'index.html'), 'utf8');
const jsFiles = fs.readdirSync(path.join(root, 'js')).filter(f => f.endsWith('.js'));
const js = jsFiles.map(f => fs.readFileSync(path.join(root, 'js', f), 'utf8')).join('\n');

const staticIds = new Set([...html.matchAll(/id="([^"]+)"/g)].map(m => m[1]));
// JS icinde uretilen isaretleme: id="x" ya da el.id = 'x'
const madeInJs = new Set([
  ...[...js.matchAll(/id="([A-Za-z0-9_-]+)"/g)].map(m => m[1]),
  ...[...js.matchAll(/\.id\s*=\s*'([A-Za-z0-9_-]+)'/g)].map(m => m[1])
]);

const wanted = [...new Set([...js.matchAll(/\$\('#([A-Za-z0-9_-]+)'\)/g)].map(m => m[1]))];
const missing = wanted.filter(id => !staticIds.has(id) && !madeInJs.has(id));

if (missing.length) {
  console.error('Bu elemanlar hicbir yerde yok: ' + missing.join(', '));
  process.exit(1);
}
console.log(`${wanted.length} element referansi dogrulandi.`);
