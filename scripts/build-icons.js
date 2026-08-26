/* Tum ikonlari tek kaynaktan uretir: web (icons/) + Capacitor (assets/).
   Calistir: npm run icons */

const sharp = require('sharp');
const fs = require('fs');
const path = require('path');

const root = path.join(__dirname, '..');
const S = 1024;

const GREEN_TOP = '#4FD168';
const GREEN_BOT = '#2D9D3F';
const AMBER = '#FFB84D';
const LIGHT = '#F6F8FA';
const DARK = '#12161C';

/* Isaret: inen kilo egrisi, ucunda kehribar nokta.
   Ortadaki hafif kabarti gercek tarti verisinin dalgalanmasi; genel yon asagi. */
const PTS = [[236, 336], [438, 516], [606, 480], [772, 650]];
const STROKE = 76;
const DOT = 84;

/* Isareti tuvalin ortasina, verilen kutuya sigacak sekilde yerlestirir.
   BOX=620 -> %60.5: Android adaptive ikonun (%66) ve maskable'in
   (%80 daire) guvenli alanlarinin ikisine de payla siginir. */
function place(BOX = 620) {
  const pad = STROKE / 2;
  const last = PTS[PTS.length - 1];
  const xs = PTS.map(p => p[0]), ys = PTS.map(p => p[1]);
  const minX = Math.min(...xs.map((x, i) => x - pad), last[0] - DOT);
  const maxX = Math.max(...xs.map((x, i) => x + pad), last[0] + DOT);
  const minY = Math.min(...ys.map((y, i) => y - pad), last[1] - DOT);
  const maxY = Math.max(...ys.map((y, i) => y + pad), last[1] + DOT);
  const k = BOX / Math.max(maxX - minX, maxY - minY);
  const cx = (minX + maxX) / 2, cy = (minY + maxY) / 2;
  return `translate(${S / 2} ${S / 2}) scale(${k.toFixed(4)}) translate(${-cx} ${-cy})`;
}

const mark = (line, dot, t = place()) => `<g transform="${t}">
    <polyline points="${PTS.map(p => p.join(',')).join(' ')}" fill="none" stroke="${line}"
      stroke-width="${STROKE}" stroke-linecap="round" stroke-linejoin="round"/>
    <circle cx="${PTS[PTS.length - 1][0]}" cy="${PTS[PTS.length - 1][1]}" r="${DOT}" fill="${dot}"/>
  </g>`;

const defs = `<defs>
    <linearGradient id="g" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0" stop-color="${GREEN_TOP}"/><stop offset="1" stop-color="${GREEN_BOT}"/>
    </linearGradient>
    <radialGradient id="sheen" cx="0.28" cy="0.22" r="0.75">
      <stop offset="0" stop-color="#FFFFFF" stop-opacity="0.20"/>
      <stop offset="1" stop-color="#FFFFFF" stop-opacity="0"/>
    </radialGradient>
  </defs>`;

const svg = inner =>
  `<svg xmlns="http://www.w3.org/2000/svg" width="${S}" height="${S}" viewBox="0 0 ${S} ${S}">${inner}</svg>`;

/* rx=0 -> tam kare (maskable/adaptive), rx>0 -> yuvarlatilmis (web "any") */
const field = rx => `${defs}
  <rect width="${S}" height="${S}" rx="${rx}" fill="url(#g)"/>
  <rect width="${S}" height="${S}" rx="${rx}" fill="url(#sheen)"/>`;

const full = rx => svg(`${field(rx)}${mark('#FFFFFF', AMBER)}`);
const splash = bgColor => svg(`<rect width="${S}" height="${S}" fill="${bgColor}"/>
  ${mark(bgColor === LIGHT ? GREEN_BOT : '#FFFFFF', AMBER, place(380))}`);

const render = (svgStr, size, out) =>
  sharp(Buffer.from(svgStr)).resize(size, size).png({ compressionLevel: 9 }).toFile(path.join(root, out));

(async () => {
  fs.mkdirSync(path.join(root, 'assets'), { recursive: true });
  fs.mkdirSync(path.join(root, 'icons'), { recursive: true });

  await Promise.all([
    // web — "any" koseleri yuvarlak, maskable tam kare (maskeyi sistem uygular)
    render(full(230), 192, 'icons/icon-192.png'),
    render(full(230), 512, 'icons/icon-512.png'),
    render(full(0), 512, 'icons/icon-maskable-512.png'),

    // Capacitor kaynaklari — Android launcher ikonlari bunlardan uretilir
    render(full(0), 1024, 'assets/icon.png'),
    render(svg(field(0)), 1024, 'assets/icon-background.png'),
    render(svg(mark('#FFFFFF', AMBER)), 1024, 'assets/icon-foreground.png'),

    render(splash(LIGHT), 2732, 'assets/splash.png'),
    render(splash(DARK), 2732, 'assets/splash-dark.png')
  ]);

  console.log('ikonlar uretildi');
})();
