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

const SEHIR = process.argv[2] || '13952';          // Soest, Hollanda
const KESIF = process.argv.includes('--kesif');
const URL = `https://namazvakitleri.diyanet.gov.tr/tr-TR/${SEHIR}/`;

async function getir(url) {
  const r = await fetch(url, {
    headers: {
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/120 Safari/537.36',
      'Accept-Language': 'tr,en;q=0.8'
    }
  });
  if (!r.ok) throw new Error(`HTTP ${r.status} — ${url}`);
  return r.text();
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

/* Diyanet aylik tabloyu veriyor: her satir bir gun, alti vakit.
   Satirdaki ilk hucre tarih, ardindan Imsak, Gunes, Ogle, Ikindi,
   Aksam, Yatsi geliyor. */
function ayristir(html) {
  const gunler = {};
  const satirlar = html.match(/<tr[\s\S]*?<\/tr>/gi) || [];

  for (const satir of satirlar) {
    const hucre = (satir.match(/<td[\s\S]*?<\/td>/gi) || [])
      .map(h => h.replace(/<[^>]*>/g, ' ').replace(/&nbsp;/g, ' ').replace(/\s+/g, ' ').trim());
    if (hucre.length < 7) continue;

    // ilk hucrede gun.ay.yil
    const t = hucre[0].match(/(\d{1,2})[.\/](\d{1,2})[.\/](\d{4})/);
    if (!t) continue;

    const saatler = hucre.slice(1).map(h => (h.match(/^(\d{1,2}:\d{2})$/) || [])[1]).filter(Boolean);
    if (saatler.length < 6) continue;

    const gun = `${t[3]}-${String(t[2]).padStart(2, '0')}-${String(t[1]).padStart(2, '0')}`;
    gunler[gun] = saatler.slice(0, 6);
  }
  return gunler;
}

(async () => {
  const html = await getir(URL);

  if (KESIF) { kesfet(html); return; }

  const gunler = ayristir(html);
  const sayi = Object.keys(gunler).length;
  if (sayi < 5) {
    console.error(`Ayristirilamadi: sadece ${sayi} gun bulundu. Sayfa yapisi degismis olabilir.`);
    console.error('Yapiyi gormek icin: node scripts/fetch-prayer-times.js ' + SEHIR + ' --kesif');
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
  console.log('ornek', ilk, '→', gunler[ilk].join('  '));
})();
