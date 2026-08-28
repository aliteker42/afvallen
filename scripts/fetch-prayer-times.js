/* Diyanet'ten namaz vakitlerini ceker ve js/prayer-data.js dosyasina yazar.

   Neden derleme aninda? Uygulama sayfasi Diyanet'ten dogrudan veri
   cekemez (CORS). Vakitler onceden bilinen veriler oldugu icin aylik
   tabloyu burada alip uygulamaya gomuyoruz: cevrimdisi da calisiyor,
   hesap bize kalmiyor, kaynak Diyanet.

   Kullanim:
     node scripts/fetch-prayer-times.js [sehirId] [--kesif]
   --kesif: ayristirmadan once sayfanin yapisini yazar (parser yazarken). */

const fs = require('fs');
const path = require('path');

const { execFileSync } = require('child_process');

const SEHIR = process.argv[2] || '13952';          // Soest, Hollanda
const KESIF = process.argv.includes('--kesif');
const URL = `https://namazvakitleri.diyanet.gov.tr/tr-TR/${SEHIR}/soest-icin-namaz-vakti`;

const UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36';

/* Node'un kendi fetch'i Diyanet tarafindan TLS seviyesinde
   kesiliyordu (ECONNRESET); curl'un TLS yigini gecebiliyor.
   Once fetch deneniyor, olmazsa curl'e dusuluyor. */
async function getir(url) {
  try {
    const r = await fetch(url, {
      headers: { 'User-Agent': UA, 'Accept-Language': 'tr,en;q=0.8' }
    });
    if (!r.ok) throw new Error('HTTP ' + r.status);
    const t = await r.text();
    console.log('fetch ile alindi:', t.length, 'bayt');
    return t;
  } catch (e) {
    console.log('fetch olmadi (' + e.message + '), curl deneniyor…');
    const t = execFileSync('curl', [
      '-sSL', '--compressed', '-m', '40',
      '-H', 'User-Agent: ' + UA,
      '-H', 'Accept-Language: tr,en;q=0.8',
      '-H', 'Accept: text/html,application/xhtml+xml',
      url
    ], { encoding: 'utf8', maxBuffer: 40 * 1024 * 1024 });
    console.log('curl ile alindi:', t.length, 'bayt');
    return t;
  }
}

function kesfet(html) {
  console.log('boyut:', html.length);
  console.log('baslik:', (html.match(/<title>([^<]*)</i) || [])[1]);
  console.log('İmsak geciyor mu:', /imsak/i.test(html));
  console.log('\n--- tablo etiketleri:');
  (html.match(/<table[^>]*>/gi) || []).slice(0, 6).forEach(t => console.log('  ', t));
  console.log('\n--- id/class icinde vakit gecenler:');
  [...new Set((html.match(/(id|class)="[^"]*(vakit|prayer|time|imsak)[^"]*"/gi) || []))]
    .slice(0, 12).forEach(t => console.log('  ', t));
  console.log('\n--- ilk tablonun ilk 3 satiri:');
  const t = html.match(/<table[\s\S]*?<\/table>/i);
  if (t) (t[0].match(/<tr[\s\S]*?<\/tr>/gi) || []).slice(0, 3)
    .forEach(r => console.log('  ', r.replace(/\s+/g, ' ').slice(0, 400)));
  console.log('\n--- saat sayisi:', (html.match(/\b\d{1,2}:\d{2}\b/g) || []).length);
  console.log('--- ilk 12 saat:', (html.match(/\b\d{1,2}:\d{2}\b/g) || []).slice(0, 12).join(' '));
}

/* Diyanet tablosu:
     <tr><td>28 Ağustos 2026 Cuma</td><td>15 Rebiulevvel 1448</td>
         <td>04:32</td><td>06:36</td><td>13:45</td><td>17:32</td>
         <td>20:44</td><td>22:31</td></tr>
   Tarih sayiyla degil ay adiyla yaziliyor; ilk denemede bunu
   kacirmistim. Turkce harfler sadelestirilip ay adi eslestiriliyor. */

const AYLAR = ['ocak', 'subat', 'mart', 'nisan', 'mayis', 'haziran',
               'temmuz', 'agustos', 'eylul', 'ekim', 'kasim', 'aralik'];

function sadelestir(x) {
  return x.toLowerCase()
    .replace(/ğ/g, 'g').replace(/ü/g, 'u').replace(/ş/g, 's')
    .replace(/ı/g, 'i').replace(/ö/g, 'o').replace(/ç/g, 'c')
    .replace(/â/g, 'a').replace(/î/g, 'i');
}

function metin(hucre) {
  return hucre
    .replace(/<[^>]*>/g, ' ')
    .replace(/&#(\d+);/g, (_, n) => String.fromCharCode(+n))
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/\s+/g, ' ')
    .trim();
}

function ayristir(html) {
  const gunler = {};
  for (const satir of html.match(/<tr[\s\S]*?<\/tr>/gi) || []) {
    const hucre = (satir.match(/<td[\s\S]*?<\/td>/gi) || []).map(metin);
    if (hucre.length < 8) continue;

    const t = hucre[0].match(/(\d{1,2})\s+(\S+)\s+(\d{4})/);
    if (!t) continue;
    const ay = AYLAR.indexOf(sadelestir(t[2]));
    if (ay < 0) continue;

    const saatler = hucre.slice(2, 8)
      .map(h => (h.match(/^(\d{1,2}):(\d{2})$/) || [])[0])
      .filter(Boolean);
    if (saatler.length !== 6) continue;

    const gun = `${t[3]}-${String(ay + 1).padStart(2, '0')}-${String(t[1]).padStart(2, '0')}`;
    gunler[gun] = saatler.map(x => x.padStart(5, '0'));
  }
  return gunler;
}

(async () => {
  const html = await getir(URL);

  if (KESIF) { kesfet(html); return; }

  const gunler = ayristir(html);
  const sayi = Object.keys(gunler).length;
  if (sayi < 5) {
    console.error(`Ayristirilamadi: sadece ${sayi} gun bulundu.\n`);
    console.error('--- sayfanin yapisi (parser bunu gore duzeltilecek) ---');
    kesfet(html);
    process.exit(1);
  }

  const cikti = `/* Diyanet namaz vakitleri — otomatik uretildi, elle duzenleme.
   Kaynak: ${URL}
   Uretim: ${new Date().toISOString().slice(0, 10)}
   Vakit sirasi: imsak, gunes, ogle, ikindi, aksam, yatsi */
const PRAYER_CITY = ${JSON.stringify(SEHIR)};
const PRAYER_TIMES = ${JSON.stringify(gunler, null, 0)};
`;
  fs.writeFileSync(path.join(__dirname, '..', 'js', 'prayer-data.js'), cikti);

  const ilk = Object.keys(gunler).sort()[0];
  const son = Object.keys(gunler).sort().pop();
  console.log(`${sayi} gun yazildi: ${ilk} → ${son}`);
  console.log('dosya boyutu:', fs.statSync(path.join(__dirname, '..', 'js', 'prayer-data.js')).size, 'bayt');
  console.log('ornek', ilk, '→', gunler[ilk].join('  '));
})();
