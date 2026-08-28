/* Uygulama: yönlendirme, ekran çizimi, etkileşimler */

const $ = s => document.querySelector(s);
const $$ = s => Array.from(document.querySelectorAll(s));

let currentRange = 30;
let panicTimer = null;
let hungerState = { i: 0, answers: [] };
let pendingPhoto = null;
let selectedMealDate = today(); // Seçili öğün tarihi
let stepsData = { active: false, count: 0, lastUpdate: null, accelerometer: null };

/* ---------------- init ---------------- */
function init() {
  Store.load();
  seedIfEmpty();
  bindNav();
  bindWeigh();
  bindMeals();
  bindPanic();
  bindHunger();
  bindSettings();
  bindNotify();
  bindGame();
  bindSteps();
  bindReminders();
  bindWater();
  updatePhotoHint();
  const settled = Game.settleYesterday();
  renderAll();
  if (settled.length) setTimeout(() => celebrate(settled), 900);
  registerSW();
  handleIncomingShare();
  openFromHash();

  // APK'da izin daha önce verildiyse adımlar sessizce gelir
  syncStepsFromHealth(false);
  Reminders.sync(false);
  Prayer.zamanla();
  // sıradaki vakit geri sayımı dakikada bir tazelensin
  setInterval(renderPrayer, 60000);
  document.addEventListener('visibilitychange', () => {
    if (!document.hidden) syncStepsFromHealth(false);
  });
}

/* Claude/ChatGPT'den paylaşılan cevap uygulamaya düştüğünde */
function handleIncomingShare() {
  const q = new URLSearchParams(location.search);
  const text = [q.get('text'), q.get('title')].filter(Boolean).join('\n');
  if (!text) return;
  history.replaceState(null, '', location.pathname);

  const parsed = Photo.parseAnswer(text);
  const pending = Store.takePending();
  go('yemek');
  if (!parsed) {
    showPasteBox(pending && pending.photo, text);
    toast('Kalori okunamadı, elle düzelt', 'bad');
    return;
  }
  showParsedResult(parsed, pending && pending.photo);
}

/* Bildirime tıklanınca ilgili ekranı aç.
   Uygulama zaten açıksa DOMContentLoaded tekrar çalışmaz, o yüzden hashchange de dinlenir. */
window.addEventListener('hashchange', () => openFromHash());

function openFromHash() {
  const h = (location.hash || '').replace('#', '');
  if (['bugun', 'tarti', 'yemek', 'sikinti', 'saglik', 'ayarlar'].includes(h)) go(h);
}

function seedIfEmpty() {
  if (!Store.data.weights.length) {
    Store.addWeight(Store.data.profile.startWeight, today());
  }
}

/* ---------------- nav ---------------- */
function bindNav() {
  $$('[data-goto]').forEach(b => b.addEventListener('click', () => go(b.dataset.goto)));
  $$('.btn-settings').forEach(b => b.addEventListener('click', () => go('ayarlar')));
}

function go(name) {
  $$('.page').forEach(p => p.classList.add('hidden'));
  $('#page-' + name).classList.remove('hidden');
  $$('.tab').forEach(t => t.classList.toggle('active', t.dataset.goto === name));
  window.scrollTo(0, 0);
  if (name === 'tarti') renderChart();
  if (name === 'yemek') renderMeals();
  if (name === 'sikinti') { renderBoredom(); renderBoss(); renderBadges(); }
  if (name === 'saglik') renderHealth();
  if (name === 'ayarlar') { fillSettings(); renderReminders(); renderPrayerSettings(); }
}

/* ---------------- render ---------------- */
function renderAll() {
  renderToday();
  renderChart();
  renderMeals();
  renderBoredom();
  renderMilestoneList();
  renderHistory();
  renderHealth();
  renderGame();
  renderSteps();
  renderWater();
  renderPrayer();
  renderTodo();
}

function renderToday() {
  const p = Store.data.profile;
  const w = Store.data.weights;
  const kg = Store.currentKg();
  const t = Store.data.targets;

  $('#hdr-date').textContent = new Date().toLocaleDateString('tr-TR', { weekday: 'long', day: 'numeric', month: 'long' });
  $('#hero-weight').textContent = kg.toFixed(1);

  // günlük fark
  const el = $('#hero-delta');
  if (w.length >= 2) {
    const diff = +(w[w.length - 1].kg - w[w.length - 2].kg).toFixed(1);
    el.className = 'hero-delta ' + (diff < 0 ? 'down' : diff > 0 ? 'up' : 'flat');
    el.textContent = `${diff > 0 ? '+' : ''}${diff.toFixed(1)} kg · önceki tartıya göre`;
  } else {
    el.className = 'hero-delta flat';
    el.textContent = 'İlk kayıt';
  }

  const b = Calc.bmi(kg, p.heightCm);
  const tag = Calc.bmiTag(b);
  $('#hero-bmi').textContent = b.toFixed(1);
  $('#hero-bmi-tag').textContent = tag.text;
  $('#hero-bmi-tag').className = 'bmi-tag ' + tag.cls;

  // ilerleme
  const total = Math.max(0.1, p.startWeight - p.goalWeight);
  const done = Math.min(total, Math.max(0, p.startWeight - kg));
  const pct = (done / total) * 100;
  $('#prog-start').textContent = p.startWeight.toFixed(1);
  $('#prog-now').textContent = kg.toFixed(1) + ' kg';
  $('#prog-goal').textContent = p.goalWeight.toFixed(1);
  $('#goal-weight').textContent = p.goalWeight.toFixed(1) + ' kg';
  $('#prog-fill').style.width = pct.toFixed(1) + '%';
  $('#prog-marker').style.left = `calc(${Math.min(100, pct).toFixed(1)}% - 1.5px)`;
  const kalan = Math.max(0, kg - p.goalWeight);
  const weekly = Calc.expectedWeeklyLoss(kg, p, t.kcal);
  $('#prog-caption').textContent = kalan <= 0
    ? 'Hedefe ulaştın. Yeni hedef belirle.'
    : `Hedefe ${kalan.toFixed(1)} kg · ${done.toFixed(1)} kg verildi` +
      (weekly > 0 ? ` · bu hızla ≈ ${Math.ceil(kalan / weekly)} hafta` : '');
  $('#goal-info').textContent = kalan <= 0
    ? 'Hedefe ulaştın! 🎉'
    : `${kalan.toFixed(1)} kg kaldı` + (weekly > 0 ? ` · ~${Math.ceil(kalan / weekly)} hafta` : '');

  // kalori / protein
  const tot = Store.dayTotals();
  const left = t.kcal - tot.kcal;
  $('#stat-kcal').textContent = left >= 0 ? left : '+' + Math.abs(left);
  $('#stat-kcal-sub').textContent = `${tot.kcal} / ${t.kcal} kcal`;
  const kp = Math.min(100, (tot.kcal / t.kcal) * 100);
  $('#bar-kcal').style.width = kp + '%';
  $('#bar-kcal').classList.toggle('over', tot.kcal > t.kcal);

  $('#stat-protein').textContent = tot.protein + 'g';
  $('#stat-protein-sub').textContent = `hedef ${t.protein}g`;
  $('#bar-protein').style.width = Math.min(100, (tot.protein / t.protein) * 100) + '%';

  // sıradaki kilometre taşı
  const next = Calc.nextMilestone(p, w);
  if (next) {
    $('#ms-weight').textContent = next.kg;
    $('#ms-title').textContent = next.note;
    const eta = Calc.etaDays(w, kg, next.kg, p, t.kcal);
    $('#ms-eta').textContent = eta === null
      ? `${(kg - next.kg).toFixed(1)} kg kaldı`
      : `${(kg - next.kg).toFixed(1)} kg · tahmini ${eta} gün`;
    $('#card-milestone').classList.remove('hidden');
  } else {
    $('#card-milestone').classList.add('hidden');
  }

  // sıradaki sağlık kazanımı
  const gain = Health.nextGain(p, w);
  if (gain) {
    $('#gain-icon').textContent = gain.icon;
    $('#gain-title').textContent = gain.text;
    $('#gain-need').textContent = `${gain.track} · ${gain.remaining} kg kaldı`;
    $('#card-gain').classList.remove('hidden');
  } else {
    $('#card-gain').classList.add('hidden');
  }

  // bugünün tahmini kaybı
  $('#stat-kcal-sub').textContent = `${tot.kcal} / ${t.kcal} kcal`;
  renderBalance();

  renderSteps();
  renderWater();
  renderPrayer();
  renderTodo();
  renderDeen();
  $('#coach-text').textContent = Coach.pick('idle');
}

function getMotivation() {
  const kg = Store.currentKg();
  const p = Store.data.profile;
  const t = Store.data.targets;
  const tot = Store.dayTotals();
  const left = t.kcal - tot.kcal;
  const kalan = Math.max(0, kg - p.goalWeight);

  // Kalori açığına göre motivasyon
  if (left >= t.kcal * 0.5) {
    return `Bugün çok iyi gidişat! ${left} kcal daha var. Devam et! 💪`;
  } else if (left > 0) {
    return `Yaşasın! ${left} kcal bakiye kaldı. Seni yeterince iyi biliyorum, kütlemen artmayacak! 🎯`;
  } else if (left > -300) {
    return `Sadece ${Math.abs(left)} kcal kaçtın. Yarın daha dikkatli ol. Sorun değil! 🙌`;
  } else {
    return `Bugün yemenin fazla oldu. Tamam, hata yapılır. Tüm hafta için endişelenme. 💖`;
  }
}

function renderDeen() {
  const card = $('#card-deen');
  if (!card.dataset.bound) {
    card.dataset.bound = '1';
    card.addEventListener('click', showDeenList);
  }
  if (!Deen.enabled()) { card.classList.add('hidden'); return; }
  const d = Deen.ofTheDay();
  card.classList.remove('hidden');
  $('#deen-text').textContent = d.t;
  $('#deen-src').textContent = d.k;
}

/* ---------------- adımlar ----------------
   APK içinde adımlar Health Connect'ten okunur: Samsung Health, Google Fit
   ve benzerleri verilerini oraya yazar. Tarayıcıda böyle bir yol yok
   (sağlık verisine erişen bir web API'si yok), orada sayı elle girilir.
   Eklentiye köprü üzerinden bağlanıyoruz çünkü uygulama derleyici
   kullanmıyor; npm paketini import etmek mümkün değil. */

/* Native köprü eklentileri Capacitor.Plugins altında sunar; bunları
   JSExport.getPluginJS sayfaya doğrudan enjekte eder. registerPlugin
   ise @capacitor/core npm paketinden gelir ve bu uygulama derleyici
   kullanmadığı için yüklü değildir — önce Plugins'e bakılmalı. */
function healthPlugin() {
  const C = window.Capacitor;
  if (!C || typeof C.isNativePlatform !== 'function' || !C.isNativePlatform()) return null;
  const P = C.Plugins && C.Plugins.HealthPlugin;
  if (P) return P;
  if (typeof C.registerPlugin === 'function') {
    try { return C.registerPlugin('HealthPlugin'); } catch (e) {}
  }
  return null;
}

/* Android tarafi {permissions:{READ_STEPS:true}} donduruyor (duz nesne).
   Paketin TypeScript tanimi ise dizi diyor; tanima guvenince .some()
   patliyordu. Iki sekli de kabul ediyoruz. */
function hasStepPermission(res) {
  const p = res && res.permissions;
  if (!p) return false;
  if (Array.isArray(p)) return p.some(x => x && x.READ_STEPS === true);
  return p.READ_STEPS === true;
}

/* Her aşamayı ayrı ayrı raporlar. Sessizce null dönmek yerine nerede
   takıldığını söyler; "gelmedi" demek yerine sebebini gösterebilelim. */
async function healthCheck(ask) {
  const C = window.Capacitor;
  if (!C) return { kod: 'tarayici' };
  if (typeof C.isNativePlatform !== 'function' || !C.isNativePlatform()) return { kod: 'tarayici' };
  if (!C.Plugins) return { kod: 'kopru-eksik' };

  const H = healthPlugin();
  if (!H || typeof H.isHealthAvailable !== 'function') {
    // Hangi eklentilerin geldiğini yaz: eksikse burada görünür
    const varolan = Object.keys(C.Plugins || {}).join(', ') || 'hiç yok';
    return { kod: 'eklenti-yok', ek: 'yüklü eklentiler: ' + varolan };
  }

  let avail;
  try { avail = await H.isHealthAvailable(); }
  catch (e) { return { kod: 'hata', ek: 'isHealthAvailable: ' + e.message, H }; }
  if (!avail || avail.available !== true) return { kod: 'hc-yok', H };

  const req = { permissions: ['READ_STEPS'] };
  let perm;
  try {
    perm = await H.checkHealthPermissions(req);
    if (!hasStepPermission(perm) && ask) perm = await H.requestHealthPermissions(req);
  } catch (e) { return { kod: 'hata', ek: 'izin: ' + e.message, H }; }
  if (!hasStepPermission(perm)) return { kod: ask ? 'izin-red' : 'izin-yok', H };

  const d = today();
  let r;
  try {
    r = await H.queryAggregated({
      startDate: new Date(d + 'T00:00:00').toISOString(),
      endDate: new Date().toISOString(),
      dataType: 'steps',
      bucket: 'day'
    });
  } catch (e) { return { kod: 'hata', ek: 'sorgu: ' + e.message, H }; }

  const kayit = (r && r.aggregatedData) || [];
  const toplam = Math.round(kayit.reduce((a, x) => a + (Number(x.value) || 0), 0));
  if (!kayit.length || toplam === 0) return { kod: 'veri-yok', H };
  return { kod: 'ok', steps: toplam, H };
}

/* Ayarlardaki sınama: her aşamayı tek tek yazar */
async function runHealthDiag() {
  const host = $('#health-diag');
  host.classList.remove('hidden');
  host.innerHTML = '<div class="hd-row">Sınanıyor…</div>';

  const C = window.Capacitor;
  const satir = [];
  const ok = (t, v) => satir.push(`<div class="hd-row ${v ? 'ok' : 'no'}"><span>${v ? '✓' : '✗'}</span>${escapeHtml(t)}</div>`);

  ok('Uygulama içinde (tarayıcı değil)', !!(C && typeof C.isNativePlatform === 'function' && C.isNativePlatform()));
  ok('Capacitor köprüsü', !!(C && C.Plugins));

  // Hangi sürümün çalıştığı ve köprünün gerçekte ne sunduğu — bunlar
  // olmadan "eski önbellek mi, gerçek arıza mı" ayırt edilemiyor.
  const surum = ($('#build-stamp') && $('#build-stamp').textContent) || '?';
  const anahtar = C ? Object.keys(C).sort().join(', ') : '(Capacitor yok)';
  const eklenti = C && C.Plugins ? Object.keys(C.Plugins).sort().join(', ') : '(Plugins yok)';

  const r = await healthCheck(false);
  const asama = ['eklenti-yok', 'hc-yok', 'izin-yok', 'izin-red', 'veri-yok', 'ok', 'hata'];
  const i = asama.indexOf(r.kod);
  ok('Sağlık eklentisi yüklü', i > 0);
  ok('Health Connect kurulu', i > 1);
  ok('Adım izni verilmiş', ['veri-yok', 'ok'].includes(r.kod));
  ok('Bugün için veri var', r.kod === 'ok');

  satir.push(`<div class="hd-sonuc">${escapeHtml(r.kod === 'ok'
    ? `${r.steps.toLocaleString('tr-TR')} adım okundu.`
    : (HEALTH_MESAJ[r.kod] || 'Bilinmeyen durum: ' + r.kod))}</div>`);
  if (r.ek) satir.push(`<div class="hd-ek">${escapeHtml(r.ek)}</div>`);
  satir.push(`<div class="hd-ek">sürüm: ${escapeHtml(surum)}
Capacitor: ${escapeHtml(anahtar)}
Plugins: ${escapeHtml(eklenti)}</div>`);

  host.innerHTML = satir.join('');

  if (r.H && r.H.openHealthConnectSettings && r.kod !== 'ok' && r.kod !== 'tarayici') {
    const b = document.createElement('button');
    b.className = 'secondary-btn';
    b.style.marginTop = '10px';
    b.textContent = 'Health Connect ayarlarını aç';
    b.addEventListener('click', () => r.H.openHealthConnectSettings().catch(() => toast('Açılamadı', 'bad')));
    host.appendChild(b);
  }
}

const HEALTH_MESAJ = {
  'tarayici':    'Tarayıcıdasın. Adımları sağlık uygulamasından okumak sadece kurulu uygulamada çalışır.',
  'kopru-eksik': 'Uygulama köprüsü yüklenmemiş. Uygulamayı tamamen kapatıp yeniden aç.',
  'eklenti-yok': 'Sağlık eklentisi bulunamadı. Eski bir sürüm kurulu olabilir; APK\'yı yeniden kur.',
  'hc-yok':      'Health Connect bulunamadı. Android 14 altındaysan Play Store\'dan "Health Connect" uygulamasını kur.',
  'izin-yok':    'Adım izni verilmemiş. Karta dokunup izin ver.',
  'izin-red':    'İzin verilmedi. Health Connect ayarlarından İrade\'ye adım izni verebilirsin.',
  'veri-yok':    'İzin var ama bugün için adım verisi yok. Samsung Health / Google Fit\'in Health Connect\'e yazdığından emin ol.',
  'hata':        'Okuma sırasında hata oldu.'
};

/* Uygulama açıldığında ve öne geldiğinde sessizce tazele */
async function syncStepsFromHealth(ask) {
  const r = await healthCheck(ask);
  if (r.kod !== 'ok') return r;
  Store.setSteps(r.steps);
  renderSteps();
  renderToday();
  return r;
}

const KCAL_PER_KG = 7700;                 // 1 kg yağ ≈ 7700 kcal
const KCAL_PER_STEP_PER_KG = 0.00037;     // adım başına net (dinlenmenin üstü)
const HAREKETSIZ = 1.2;                   // adım biliniyorken taban katsayı

function bindSteps() {
  const card = $('#card-steps');
  if (card) card.addEventListener('click', askSteps);
}

async function askSteps() {
  // APK'da önce Health Connect denenir; izin yoksa burada sorulur.
  if (healthPlugin()) {
    toast('Sağlık verisi okunuyor…');
    const r = await syncStepsFromHealth(true);
    if (r.kod === 'ok') { toast(`${r.steps.toLocaleString('tr-TR')} adım alındı`, 'win'); return; }

    const mesaj = (HEALTH_MESAJ[r.kod] || 'Okunamadı.') + (r.ek ? '\n\n(' + r.ek + ')' : '');
    // Health Connect ayarlarini acabiliyorsak teklif et
    if ((r.kod === 'izin-red' || r.kod === 'veri-yok') && r.H && r.H.openHealthConnectSettings) {
      if (confirm(mesaj + '\n\nHealth Connect ayarlarını açayım mı?')) {
        try { await r.H.openHealthConnectSettings(); return; } catch (e) {}
      }
    } else {
      alert(mesaj);
    }
  }
  const cur = Store.stepsOn();
  const v = prompt('Bugün kaç adım attın?\n(Telefonundaki sağlık uygulamasından bakabilirsin)',
                   cur ? String(cur) : '');
  if (v === null) return;
  const n = parseInt(String(v).replace(/[^\d]/g, ''), 10);
  if (isNaN(n)) { toast('Sayı gir', 'bad'); return; }
  Store.setSteps(n);
  renderSteps();
  renderToday();
  toast(n ? `${n.toLocaleString('tr-TR')} adım kaydedildi` : 'Adım silindi');
}

function stepKcal(steps) {
  return Math.round(steps * KCAL_PER_STEP_PER_KG * Store.currentKg());
}

/* Günün şu ana kadarki yakımı.
   Adım biliniyorsa taban hareketsiz katsayıya (1.2) çekilip gerçek adım
   eklenir; TDEE'nin kendi hareket katsayısı (1.375) kullanılsaydı hareket
   iki kez sayılırdı. Dinlenme yakımı geçen saate göre orantılanır, yoksa
   günün başında bütün günün yakımı açık gibi görünürdü. */
function burnSoFar() {
  const kg = Store.currentKg();
  const p = Store.data.profile;
  const steps = Store.stepsOn();
  const n = new Date();
  const gecenGun = Math.min(1, Math.max(0.02, (n.getHours() * 60 + n.getMinutes()) / 1440));

  const gunlukDinlenme = steps > 0
    ? Calc.bmr(kg, p.heightCm, p.age, p.sex) * HAREKETSIZ
    : Calc.tdee(kg, p);

  const dinlenme = Math.round(gunlukDinlenme * gecenGun);
  const adim = steps > 0 ? stepKcal(steps) : 0;
  return { dinlenme, adim, steps, toplam: dinlenme + adim, oran: gecenGun };
}

function renderSteps() {
  const el = $('#stat-steps');
  if (!el) return;
  const n = Store.stepsOn();
  el.textContent = n ? n.toLocaleString('tr-TR') : '—';
  $('#stat-steps-sub').textContent = n
    ? `≈ ${stepKcal(n)} kcal yaktın`
    : (healthPlugin() ? 'dokun · sağlıktan oku' : 'dokun ve gir');
}

/* Bugünün kalori açığından tahmini kayıp.
   Açık = günlük yakım (TDEE) − yenen. TDEE zaten hareket katsayısını
   içerdiği için adımlar ayrıca eklenmiyor, yoksa iki kez sayılır. */
function todayBalance() {
  const b = burnSoFar();
  const yenen = Store.dayTotals().kcal;
  const acik = b.toplam - yenen;
  return { ...b, yenen, acik, gram: Math.round(acik / KCAL_PER_KG * 1000) };
}

function todayGrams() {
  return todayBalance().gram;
}

/* Gun sonu tahmini: butun gunun dinlenme yakimi + su ana kadarki adim,
   eksi hedef kalori (hedefi asmissa gercekten yedigi). Adim ilerisi
   tahmin edilmiyor; bu yuzden rakam ihtiyatli kaliyor, gun ilerledikce
   ve yurudukce yukseliyor. */
function projectedBalance() {
  const kg = Store.currentKg();
  const p = Store.data.profile;
  const t = Store.data.targets;
  const steps = Store.stepsOn();

  const gunlukDinlenme = Math.round(steps > 0
    ? Calc.bmr(kg, p.heightCm, p.age, p.sex) * HAREKETSIZ
    : Calc.tdee(kg, p));
  const adim = steps > 0 ? stepKcal(steps) : 0;
  const yakim = gunlukDinlenme + adim;

  const yenen = Store.dayTotals().kcal;
  const varsayilan = Math.max(t.kcal, yenen);
  const acik = yakim - varsayilan;
  return { yakim, varsayilan, acik, gram: Math.round(acik / KCAL_PER_KG * 1000) };
}

function renderBalance() {
  const el = $('#today-grams');
  if (!el) return;
  const say = n => Math.round(n).toLocaleString('tr-TR');
  const b = todayBalance();     // şu ana kadar gerçekleşen
  const t = projectedBalance(); // gün sonu tahmini

  // Büyük rakam gün sonu tahmini: "bugün ne kadar gider" sorusunun cevabı.
  el.textContent = t.acik >= 0
    ? `≈ ${say(t.gram)} g gider`
    : `≈ ${say(Math.abs(t.gram))} g gelir`;
  el.className = 'grams-text ' + (t.acik > 0 ? 'good' : t.acik < 0 ? 'over' : '');

  $('#balance-line').textContent = t.acik >= 0
    ? `hedefinde kalırsan · ${say(t.acik)} kcal açık`
    : `bu gidişle ${say(Math.abs(t.acik))} kcal fazla`;

  // Şu ana kadar gerçekten olan — gün ilerledikçe üstteki rakama yaklaşır
  $('#balance-now').textContent = b.acik >= 0
    ? `Şu ana kadar: ${say(b.acik)} kcal açık · ≈ ${say(b.gram)} g`
    : `Şu ana kadar: ${say(Math.abs(b.acik))} kcal fazla · ≈ ${say(Math.abs(b.gram))} g`;

  const adimKismi = b.steps > 0 ? ` + ${say(b.steps)} adım ${say(b.adim)}` : '';
  $('#balance-detail').textContent =
    `Yakım ${say(b.toplam)} (dinlenme ${say(b.dinlenme)}${adimKismi}) · yenen ${say(b.yenen)}`;
}

/* ---------------- namaz vakitleri ---------------- */
function renderPrayer() {
  const card = $('#card-prayer');
  if (!card) return;
  if (!Prayer.varMi() || !Prayer.gun()) { card.classList.add('hidden'); return; }
  card.classList.remove('hidden');

  const s = Prayer.sirada();
  if (s) {
    const sa = Math.floor(s.kalanDk / 60), dk = s.kalanDk % 60;
    $('#prayer-next-name').textContent = s.ad + (s.yarin ? ' (yarın)' : '');
    $('#prayer-next-clock').textContent = s.saat;
    $('#prayer-next-left').textContent = sa > 0 ? `${sa} sa ${dk} dk kaldı` : `${dk} dk kaldı`;
  }

  const vakitler = Prayer.gun().filter(v => KILINAN.includes(v.i));
  $('#prayer-row').innerHTML = vakitler.map(v => `
    <button class="pv ${Prayer.kilindiMi(v.i) ? 'done' : ''} ${s && s.i === v.i && !s.yarin ? 'next' : ''}"
            data-vakit="${v.i}">
      <span class="pv-ad">${v.ad}</span>
      <span class="pv-saat">${v.saat}</span>
      <span class="pv-tik">${Prayer.kilindiMi(v.i) ? '✓' : ''}</span>
    </button>`).join('');

  $('#prayer-row').querySelectorAll('[data-vakit]').forEach(b => {
    b.addEventListener('click', () => {
      Prayer.isaretle(+b.dataset.vakit);
      renderPrayer();
      vibrate(20);
      if (Prayer.bugunSayi() === KILINAN.length) toast('Beş vakit tamam 🤲', 'win');
    });
  });

  const n = Prayer.bugunSayi();
  const seri = Prayer.seri();
  $('#prayer-sub').textContent = `${n}/5 kılındı` + (seri > 1 ? ` · ${seri} gün üst üste` : '');
}

/* ---------------- su ----------------
   Hedef kiloya göre 30 ml/kg, ama 2–3 L arasında tutuluyor: ham hesap
   senin kilonda 3.7 L (15 bardak) çıkıyor ve o kadarı caydırıcı.
   Bardak 250 ml. */
const BARDAK = 250;

function waterGoal() {
  const kg = Store.currentKg();
  return Math.min(3000, Math.max(2000, Math.round(kg * 30 / 100) * 100));
}

function bindWater() {
  $('#btn-water-glass').addEventListener('click', () => {
    const v = Store.addWater(BARDAK);
    renderWater();
    vibrate(20);
    if (v >= waterGoal() && v - BARDAK < waterGoal()) {
      toast('Günlük su hedefin tamam 💧', 'win');
      celebrate(Game.award('su'));
      renderGame();
    }
  });
  $('#btn-water-minus').addEventListener('click', () => {
    Store.addWater(-BARDAK);
    renderWater();
  });
}

function renderWater() {
  const el = $('#water-now');
  if (!el) return;
  const ml = Store.waterOn();
  const hedef = waterGoal();
  el.textContent = (ml / 1000).toFixed(1).replace('.', ',');
  $('#water-goal').textContent = (hedef / 1000).toFixed(1).replace('.', ',');
  $('#bar-water').style.width = Math.min(100, (ml / hedef) * 100) + '%';

  const kalan = Math.max(0, hedef - ml);
  $('#water-sub').textContent = kalan === 0
    ? `Hedef tamam · ${Math.round(ml / BARDAK)} bardak`
    : `${Math.round(ml / BARDAK)} bardak · ${Math.ceil(kalan / BARDAK)} bardak daha`;
}

/* ---------------- hatırlatıcılar ---------------- */
function renderTodo() {
  const card = $('#card-todo');
  if (!card) return;
  const liste = Reminders.today();
  if (!liste.length) { card.classList.add('hidden'); return; }
  card.classList.remove('hidden');

  const biten = liste.filter(r => Reminders.isDone(r)).length;
  $('#todo-count').textContent = `${biten}/${liste.length}`;
  $('#todo-list').innerHTML = liste
    .slice()
    .sort((a, b) => a.time.localeCompare(b.time))
    .map(r => `
      <button class="todo ${Reminders.isDone(r) ? 'done' : ''}" data-todo="${r.id}">
        <span class="todo-box">${Reminders.isDone(r) ? '✓' : ''}</span>
        <span class="todo-t">${escapeHtml(r.t)}</span>
        <span class="todo-time">${r.time}</span>
      </button>`).join('');

  $('#todo-list').querySelectorAll('[data-todo]').forEach(b => {
    b.addEventListener('click', () => {
      Reminders.toggleDone(b.dataset.todo);
      renderTodo();
      vibrate(20);
    });
  });
}

/* Ayarlardaki hatırlatıcı yönetimi */
let remSecilenGunler = [];

function bindReminders() {
  const gunHost = $('#rem-days');
  gunHost.innerHTML = GUNLER.map(g =>
    `<button class="day-chip" data-day="${g.i}" title="${g.u}">${g.k}</button>`).join('');
  gunHost.addEventListener('click', e => {
    const b = e.target.closest('[data-day]');
    if (!b) return;
    const d = +b.dataset.day;
    remSecilenGunler = remSecilenGunler.includes(d)
      ? remSecilenGunler.filter(x => x !== d)
      : remSecilenGunler.concat(d);
    b.classList.toggle('on');
  });

  $('#btn-rem-add').addEventListener('click', async () => {
    const t = $('#rem-text').value.trim();
    if (!t) { toast('Ne yapman gerektiğini yaz', 'bad'); return; }
    const r = Reminders.add({ t, days: remSecilenGunler, time: $('#rem-time').value });
    if (!r) { toast('Eklenemedi', 'bad'); return; }

    $('#rem-text').value = '';
    remSecilenGunler = [];
    $('#rem-days').querySelectorAll('.day-chip').forEach(c => c.classList.remove('on'));
    renderReminders(); renderTodo();

    // İlk hatırlatıcıda bildirim izni burada isteniyor
    const s = await Reminders.sync(true);
    toast(s.kod === 'ok' ? 'Eklendi, hatırlatma kuruldu' : 'Eklendi', 'win');
    renderReminders();
  });
}

function renderPrayerSettings(r) {
  const h = $('#prayer-set-hint');
  if (!h) return;
  if (!Prayer.varMi()) { h.textContent = 'Vakit verisi yüklenemedi.'; return; }
  const g = Object.keys(PRAYER_TIMES).sort();
  const kaynak = `Diyanet · Soest · ${g[0]} – ${g[g.length - 1]} arası yüklü.`;
  if (!Reminders.plugin()) { h.textContent = kaynak + ' Bildirimler kurulu uygulamada çalışır.'; return; }
  const durum = !r ? ''
    : r.kod === 'ok' ? ` ${r.sayi} bildirim kurulu.`
    : r.kod === 'kapali' ? ' Bildirimler kapalı.'
    : r.kod === 'izin-yok' ? ' Bildirim izni gerekiyor.'
    : r.kod === 'hata' ? ' Kurulamadı: ' + r.ek : '';
  h.textContent = kaynak + durum;
}

function renderReminders() {
  const host = $('#rem-list');
  if (!host) return;
  const liste = Reminders.all();

  host.innerHTML = liste.length
    ? liste.map(r => `
        <div class="rem ${r.on ? '' : 'off'}">
          <button class="rem-toggle" data-rem-on="${r.id}">${r.on ? '🔔' : '🔕'}</button>
          <div class="rem-body">
            <div class="rem-t">${escapeHtml(r.t)}</div>
            <div class="rem-meta">${escapeHtml(Reminders.gunAdi(r.days))} · ${r.time}</div>
          </div>
          <button class="del-btn" data-rem-del="${r.id}" aria-label="Sil">×</button>
        </div>`).join('')
    : '<div class="empty">Henüz hatırlatıcı yok.</div>';

  host.querySelectorAll('[data-rem-del]').forEach(b => b.addEventListener('click', async () => {
    Reminders.remove(b.dataset.remDel);
    renderReminders(); renderTodo();
    await Reminders.sync();
    toast('Silindi');
  }));
  host.querySelectorAll('[data-rem-on]').forEach(b => b.addEventListener('click', async () => {
    const r = Reminders.all().find(x => x.id === b.dataset.remOn);
    Reminders.update(r.id, { on: !r.on });
    renderReminders(); renderTodo();
    await Reminders.sync();
  }));

  // Hangi yolla hatırlatıldığını açıkça yaz
  const h = $('#rem-hint');
  if (Reminders.plugin()) {
    h.textContent = liste.length
      ? 'Hatırlatmalar telefonun kendi zamanlayıcısına kurulu; uygulama kapalıyken de gelir.'
      : 'Ekle dediğinde telefonun zamanlayıcısına kurulur, uygulama kapalıyken de gelir.';
  } else {
    h.textContent = 'Tarayıcıda hatırlatma ancak uygulama açıkken çalışır. Kurulu uygulamada telefonun kendi zamanlayıcısı kullanılır.';
  }
}

/* ---------------- oyun ---------------- */
function bindGame() {
  $('#xp-strip').addEventListener('click', () => { go('sikinti'); toast('Rozetler aşağıda'); });

  // Otomatik görevler kendiliğinden işaretlenir; tıklamak onları
  // bedavaya kapatmak yerine yapılacağı ekrana götürür.
  const QUEST_ROUTE = {
    tarti: () => go('tarti'),
    direnis: () => { go('sikinti'); openPanic(); },
    protein: () => go('yemek'),
    ogun3: () => go('yemek'),
    kalori: () => go('yemek')
  };

  $('#quest-list').addEventListener('click', e => {
    const b = e.target.closest('[data-quest]');
    if (!b || b.classList.contains('done')) return;
    const id = b.dataset.quest;

    if (QUEST_ROUTE[id]) { QUEST_ROUTE[id](); return; }

    const r = Game.completeQuest(id);
    if (!r) return;
    renderGame();
    if (r.all) { celebrate([{ type: 'xp', amount: r.xp }]); toast('Günün üç görevi de bitti 🎉', 'win'); }
    else toast(`+${r.xp} XP`, 'win');
    vibrate(30);
  });
}

function renderGame() {
  // otomatik biten görevlerin XP'si burada yazılır
  const questEvents = Game.syncQuests();

  const lv = Game.level();
  $('#xp-icon').textContent = lv.icon;
  $('#xp-title').textContent = `Seviye ${lv.n} · ${lv.title}`;
  $('#xp-num').textContent = `${lv.xp} XP`;
  $('#xp-fill').style.width = lv.pct.toFixed(1) + '%';
  $('#xp-next').textContent = lv.nextTitle
    ? `${lv.toNext} XP sonra: ${lv.nextTitle}`
    : 'En üst seviye';

  // görevler
  const qs = Game.quests();
  $('#quest-count').textContent = `${qs.filter(q => q.done).length}/${qs.length}`;
  $('#quest-list').innerHTML = qs.map(q => `
    <button class="quest ${q.done ? 'done' : ''} ${q.manual ? 'manual' : 'auto'}"
            data-quest="${q.id}" ${q.done ? 'disabled' : ''}>
      <span class="quest-box">${q.done ? '✓' : (q.manual ? '' : '›')}</span>
      <span class="quest-t">${escapeHtml(q.t)}</span>
      <span class="quest-xp">+${q.xp}</span>
    </button>`).join('');

  // seri
  const st = Game.streak();
  $('#streak-pill').textContent = `${st > 0 ? '🔥' : '💤'} ${st} gün`;
  $('#streak-cal').innerHTML = Game.calendar(14).map(c => `
    <div class="cal-day ${c.on ? 'on' : ''} ${c.today ? 'now' : ''}" title="${c.d}">
      ${c.on ? '●' : ''}
    </div>`).join('');

  if (questEvents.length) {
    const total = questEvents.reduce((a, e) => a + e.amount, 0);
    setTimeout(() => toast(`Görev tamam · +${total} XP`, 'win'), 400);
  }
}

function renderBoss() {
  const b = Game.boss();
  const pct = (b.hp / b.max) * 100;
  $('#boss-hp-text').textContent = b.hp > 0 ? `${b.hp} / ${b.max}` : 'YIKILDI';
  $('#boss-fill').style.width = pct.toFixed(1) + '%';
  $('#boss-face').textContent = b.hp === 0 ? '🏁' : b.hp < b.max * 0.35 ? '🪨' : '🧱';
  $('#boss-hint').textContent = b.hp === 0
    ? `Bu haftanın duvarı yıkıldı. Toplam ${Game.state().bossKills} duvar yıktın. Yeni hafta yenisini getirir.`
    : 'Her atlattığın kriz duvardan bir parça götürür, her teslim oluş onu geri örer. Hafta bitmeden yık.';
}

function renderBadges() {
  const owned = Game.state().badges;
  $('#badge-count').textContent = `${owned.length}/${BADGES.length}`;
  $('#badge-grid').innerHTML = BADGES.map(b => {
    const has = owned.includes(b.id);
    return `<div class="badge ${has ? 'on' : ''}" title="${escapeHtml(b.d)}">
      <div class="badge-ic">${has ? b.i : '🔒'}</div>
      <div class="badge-t">${escapeHtml(has ? b.t : '???')}</div>
    </div>`;
  }).join('');
}

/* Ödül olaylarını kutla: konfeti, rozet kartı, toast */
function celebrate(events) {
  if (!events || !events.length) return;
  const badges = events.filter(e => e.type === 'badge').map(e => e.badge);
  const levelUp = events.find(e => e.type === 'level');
  const kill = events.find(e => e.type === 'boss' && e.killed);
  const xp = events.filter(e => e.type === 'xp').reduce((a, e) => a + e.amount, 0);

  if (levelUp || badges.length || kill) confetti();

  if (kill) {
    showAward('🏁', 'DUVAR YIKILDI', 'Bu haftanın can sıkıntısı duvarını yıktın.');
    vibrate([60, 80, 60, 80, 160]);
  } else if (levelUp) {
    showAward(levelUp.level.icon, `Seviye ${levelUp.level.n}`, levelUp.level.title);
    vibrate([50, 70, 50, 120]);
  } else if (badges.length) {
    showAward(badges[0].i, badges[0].t, badges[0].d);
    vibrate([40, 60, 40]);
  } else if (xp) {
    toast(`+${xp} XP`, 'win');
  }

  // birden fazla rozet açıldıysa sırayla göster
  badges.slice(levelUp || kill ? 0 : 1).forEach((b, i) => {
    setTimeout(() => showAward(b.i, b.t, b.d), 2200 * (i + 1));
  });
}

let awardTimer = null;
function showAward(icon, title, sub) {
  let el = $('#award');
  if (!el) {
    el = document.createElement('div');
    el.id = 'award';
    el.className = 'award';
    document.body.appendChild(el);
  }
  el.innerHTML = `<div class="award-ic">${icon}</div>
    <div class="award-t">${escapeHtml(title)}</div>
    <div class="award-s">${escapeHtml(sub)}</div>`;
  el.classList.remove('hidden');
  el.classList.add('show');
  clearTimeout(awardTimer);
  awardTimer = setTimeout(() => el.classList.remove('show'), 2000);
}

function confetti() {
  if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
  const colors = ['#3fb950', '#58a6ff', '#e3b341', '#bc8cff', '#f85149'];
  const host = document.createElement('div');
  host.className = 'confetti';
  for (let i = 0; i < 42; i++) {
    const p = document.createElement('i');
    p.style.left = Math.random() * 100 + '%';
    p.style.background = colors[i % colors.length];
    p.style.animationDelay = (Math.random() * 0.35).toFixed(2) + 's';
    p.style.animationDuration = (1.5 + Math.random() * 0.9).toFixed(2) + 's';
    p.style.transform = `rotate(${Math.random() * 360}deg)`;
    host.appendChild(p);
  }
  document.body.appendChild(host);
  setTimeout(() => host.remove(), 2800);
}

/* ---------------- sağlık ---------------- */
function renderHealth() {
  const p = Store.data.profile;
  const w = Store.data.weights;
  const sum = Health.summary(p, w);

  $('#gs-lost').textContent = sum.lost.toFixed(1);
  $('#gs-bp').textContent = '−' + sum.sysDrop;
  $('#gs-load').textContent = sum.kneeLoad;
  $('#gs-hint').textContent = sum.lost < 0.1
    ? 'Henüz kayıp yok. İlk kilo gittiği anda buradaki üç rakam da hareket etmeye başlar.'
    : `${sum.total} kazanımın ${sum.unlocked} tanesi açıldı. Tansiyon ve diz yükü tahmini, ` +
      'bilimsel ortalamalara dayanıyor.';

  $('#tracks-host').innerHTML = Health.tracks(p, w).map(tr => `
    <div class="card track">
      <div class="track-head">
        <div class="track-ic">${tr.icon}</div>
        <div class="track-name">${escapeHtml(tr.title)}</div>
        <div class="track-count ${tr.done ? 'some' : ''}">${tr.done}/${tr.total}</div>
      </div>
      <div class="track-lead">${escapeHtml(tr.lead)}</div>
      <div class="steps">
        ${tr.steps.map(st => {
          const isNext = !st.done && tr.next && st.need === tr.next.need;
          return `<div class="step ${st.done ? 'done' : ''} ${isNext ? 'next' : ''}">
            <div class="step-dot">${st.done ? '✓' : ''}</div>
            <div class="step-kg">−${st.need} kg</div>
            <div class="step-t">${escapeHtml(st.text)}</div>
            ${st.done ? '' : `<div class="step-left">${st.remaining} kg kaldı</div>`}
          </div>`;
        }).join('')}
      </div>
    </div>`).join('');
}

function renderChart() {
  Chart.render($('#chart-host'), Store.data.weights, Store.data.profile.goalWeight, currentRange);
  const w = Store.data.weights;
  setDelta('#d7', Calc.changeOver(w, 7));
  setDelta('#d30', Calc.changeOver(w, 30));
  const totalDiff = w.length >= 2 ? +(w[w.length - 1].kg - w[0].kg).toFixed(1) : null;
  setDelta('#dtotal', totalDiff);
}

function setDelta(sel, v) {
  const el = $(sel);
  if (v === null || v === undefined) { el.textContent = '—'; el.className = 'mini-num'; return; }
  el.textContent = (v > 0 ? '+' : '') + v.toFixed(1) + ' kg';
  el.className = 'mini-num ' + (v < 0 ? 'down' : v > 0 ? 'up' : '');
}

function renderMilestoneList() {
  const host = $('#milestone-list');
  const ms = Calc.milestones(Store.data.profile, Store.data.weights);
  if (!ms.length) { host.innerHTML = '<div class="empty">Kilometre taşı yok.</div>'; return; }
  host.innerHTML = ms.map(m => `
    <div class="ms-item ${m.done ? 'done' : ''}">
      <div class="chk">${m.done ? '✓' : ''}</div>
      <div class="ms-w">${m.kg} kg</div>
      <div class="ms-d">${escapeHtml(m.note)}</div>
    </div>`).join('');
}

function renderHistory() {
  const host = $('#weight-history');
  const w = Store.data.weights.slice().reverse();
  if (!w.length) { host.innerHTML = '<div class="empty">Kayıt yok.</div>'; return; }
  host.innerHTML = w.slice(0, 60).map((row, i) => {
    const prev = w[i + 1];
    const diff = prev ? +(row.kg - prev.kg).toFixed(1) : null;
    const cls = diff === null ? 'flat' : diff < 0 ? 'down' : diff > 0 ? 'up' : 'flat';
    const txt = diff === null ? '—' : (diff > 0 ? '+' : '') + diff.toFixed(1);
    return `<div class="h-row">
      <span class="h-date">${fmtDate(row.d)}</span>
      <span class="h-val">${row.kg.toFixed(1)} kg</span>
      <span class="h-diff ${cls}">${txt}</span>
      <button class="del-btn" data-del-weight="${row.d}" aria-label="Sil">×</button>
    </div>`;
  }).join('');
  host.querySelectorAll('[data-del-weight]').forEach(b => {
    b.addEventListener('click', () => {
      Store.removeWeight(b.dataset.delWeight);
      renderAll();
      toast('Silindi');
    });
  });
}

/* ---------------- tartı ---------------- */
function bindWeigh() {
  const input = $('#w-input');
  input.value = Store.currentKg().toFixed(1);
  $('#w-minus').addEventListener('click', () => step(-0.1));
  $('#w-plus').addEventListener('click', () => step(0.1));
  $('#btn-save-weight').addEventListener('click', saveWeight);
  $$('.rt').forEach(b => b.addEventListener('click', () => {
    $$('.rt').forEach(x => x.classList.remove('active'));
    b.classList.add('active');
    currentRange = +b.dataset.range;
    renderChart();
  }));

  function step(d) {
    const v = (parseFloat(input.value) || Store.currentKg()) + d;
    input.value = v.toFixed(1);
  }
}

function saveWeight() {
  const v = parseFloat($('#w-input').value);
  if (!v || v < 30 || v > 400) { toast('Geçerli bir kilo gir', 'bad'); return; }
  const prev = Store.latestWeight();
  const prevKg = prev && prev.d !== today() ? prev.kg : (prev && prev.d === today() ? null : null);
  Store.addWeight(+v.toFixed(1));
  renderAll();
  const msg = Coach.onWeighIn(prevKg, v);
  $('#coach-text').textContent = msg;
  $('#weigh-hint').textContent = msg;
  checkMilestoneHit(v);
  const erken = new Date().getHours() < 9;
  celebrate(Game.award('tarti', erken ? 'sabah' : null));
  renderGame();
  toast('Kaydedildi', 'win');
}

function checkMilestoneHit(kg) {
  const ms = Calc.milestones(Store.data.profile, Store.data.weights);
  const hit = ms.find(m => m.done && Math.abs(m.kg - Math.ceil(kg)) < 5 && kg <= m.kg);
  if (hit && kg <= hit.kg) {
    setTimeout(() => {
      celebrate(Game.award('kilometre'));
      toast(`🎉 ${hit.kg} kg geçildi! +${XP.kilometre} XP`, 'win');
    }, 1200);
    vibrate([40, 60, 40, 60, 120]);
  }
}

/* ---------------- yemek ---------------- */
function bindMeals() {
  $('#btn-add-meal').addEventListener('click', () => {
    const name = $('#meal-name').value.trim() || 'Öğün';
    const kcal = parseInt($('#meal-kcal').value, 10) || 0;
    const protein = parseInt($('#meal-protein').value, 10) || 0;
    if (!kcal) { toast('Kalori gir', 'bad'); return; }
    Store.addMeal({ name, kcal, protein });
    clearMealForm();
    celebrate(Game.award('ogun'));
    renderMeals(); renderToday(); renderGame();
    toast(`${kcal} kcal eklendi`);
  });

  $('#quick-foods').innerHTML = QUICK_FOODS
    .map((f, i) => `<button class="qf" data-qf="${i}">${escapeHtml(f.n)} · ${f.k}</button>`).join('');
  $('#quick-foods').addEventListener('click', e => {
    const b = e.target.closest('[data-qf]');
    if (!b) return;
    const f = QUICK_FOODS[+b.dataset.qf];
    Store.addMeal({ name: f.n, kcal: f.k, protein: f.p });
    celebrate(Game.award('ogun'));
    renderMeals(); renderToday(); renderGame();
    toast(`${f.n} · ${f.k} kcal`);
  });

  $('#photo-input').addEventListener('change', onPhoto);

  // Tarih navigasyonu
  $('#btn-prev-day').addEventListener('click', () => {
    const d = new Date(selectedMealDate);
    d.setDate(d.getDate() - 1);
    selectedMealDate = d.toISOString().split('T')[0];
    updateMealDateDisplay();
  });

  $('#btn-next-day').addEventListener('click', () => {
    const d = new Date(selectedMealDate);
    d.setDate(d.getDate() + 1);
    selectedMealDate = d.toISOString().split('T')[0];
    updateMealDateDisplay();
  });

  $('#btn-today').addEventListener('click', () => {
    selectedMealDate = today();
    updateMealDateDisplay();
  });

  $('#meal-date-picker').addEventListener('change', (e) => {
    selectedMealDate = e.target.value;
    updateMealDateDisplay();
  });

  // yerel veritabanı — API'ye gitmeden kalori doldurur
  $('#food-list').innerHTML = FOOD_DB.map(f => `<option value="${escapeHtml(f.n)}">`).join('');
  $('#meal-name').addEventListener('input', () => {
    const hit = findFood($('#meal-name').value);
    const kEl = $('#meal-kcal'), pEl = $('#meal-protein');
    if (hit && !kEl.dataset.touched) {
      kEl.value = hit.k;
      pEl.value = hit.p;
      kEl.classList.add('auto'); pEl.classList.add('auto');
    }
  });
  [$('#meal-kcal'), $('#meal-protein')].forEach(el => {
    el.addEventListener('input', () => { el.dataset.touched = '1'; el.classList.remove('auto'); });
  });
}

function clearMealForm() {
  ['#meal-name', '#meal-kcal', '#meal-protein'].forEach(sel => {
    const el = $(sel);
    el.value = ''; delete el.dataset.touched; el.classList.remove('auto');
  });
}

function updateMealDateDisplay() {
  const picker = $('#meal-date-picker');
  if (picker) picker.value = selectedMealDate;

  const todayBtn = $('#btn-today');
  if (todayBtn) {
    if (selectedMealDate === today()) {
      todayBtn.classList.add('date-today');
    } else {
      todayBtn.classList.remove('date-today');
    }
  }

  renderMeals();
}

function renderMeals() {
  const t = Store.data.targets;
  const tot = Store.dayTotals(selectedMealDate);
  const displayDate = new Date(selectedMealDate + 'T00:00:00').toLocaleDateString('tr-TR', { day: 'numeric', month: 'long' });
  const isToday = selectedMealDate === today();

  $('#yemek-date').textContent = isToday ? 'Bugün' : displayDate;
  $('#ds-kcal').textContent = tot.kcal;
  $('#ds-protein').textContent = tot.protein + 'g';
  $('#ds-left').textContent = t.kcal - tot.kcal;

  // Motivasyon mesajı göster
  const motCard = $('#card-motivation');
  if (isToday && tot.kcal > 0) {
    const left = t.kcal - tot.kcal;
    let motMsg = '';
    if (left >= t.kcal * 0.5) {
      motMsg = `Bugün çok iyi gidişat! ${left} kcal daha var. Devam et! 💪`;
    } else if (left > 0) {
      motMsg = `Yaşasın! ${left} kcal bakiye kaldı. Seni yeterince iyi biliyorum, kütlemen artmayacak! 🎯`;
    } else if (left > -300) {
      motMsg = `Sadece ${Math.abs(left)} kcal kaçtın. Yarın daha dikkatli ol. Sorun değil! 🙌`;
    } else {
      motMsg = `Bugün yemenin fazla oldu. Tamam, hata yapılır. Tüm hafta için endişelenme. 💖`;
    }
    motCard.classList.remove('hidden');
    const b = todayBalance();
    const ek = b.acik >= 0
      ? ` Bugün ${b.acik.toLocaleString('tr-TR')} kcal açık — ≈ ${b.gram} g gitmiş olmalı.`
      : ` Bugün ${Math.abs(b.acik).toLocaleString('tr-TR')} kcal fazla.`;
    $('#motivation-text').textContent = motMsg + ek;
  } else {
    motCard.classList.add('hidden');
  }

  const list = Store.mealsOn(selectedMealDate).slice().reverse();
  const host = $('#meal-list');
  const emptyMsg = isToday ? 'Bugün henüz bir şey eklemedin.' : 'Bu günde yemek kaydı yok.';
  if (!list.length) { host.innerHTML = `<div class="empty">${emptyMsg}</div>`; return; }
  host.innerHTML = list.map(m => `
    <div class="m-row">
      ${m.photo ? `<img class="m-thumb" src="${m.photo}" alt="">` : '<div class="m-thumb"></div>'}
      <div class="m-body">
        <div class="m-name">${escapeHtml(m.name)}</div>
        <div class="m-meta">${m.protein || 0}g protein · ${fmtTime(m.ts)}</div>
      </div>
      <div class="m-kcal">${m.kcal}</div>
      <button class="del-btn" data-del-meal="${m.id}" aria-label="Sil">×</button>
    </div>`).join('');
  host.querySelectorAll('[data-del-meal]').forEach(b => b.addEventListener('click', () => {
    Store.removeMeal(b.dataset.delMeal);
    renderMeals(); renderToday();
  }));
}

async function onPhoto(e) {
  const file = e.target.files && e.target.files[0];
  e.target.value = '';
  if (!file) return;

  const box = $('#photo-result');
  box.classList.remove('hidden');
  box.innerHTML = '<div class="spinner"></div><div class="hint" style="text-align:center">Fotoğraf hazırlanıyor…</div>';

  let full, thumb;
  try {
    full = await Photo.shrink(file);
    thumb = await Photo.thumb(full);
  } catch (err) {
    box.innerHTML = `<div class="pr-verdict">Fotoğraf okunamadı: ${escapeHtml(err.message)}</div>`;
    return;
  }
  pendingPhoto = thumb;

  showMethodChooser(box, thumb, full);
}

/* Her fotoğrafta yöntemi sen seçiyorsun. Ayarlardaki tercih sadece
   hangisinin başta ve vurgulu duracağını belirler. */
function showMethodChooser(box, thumb, full) {
  const pref = Photo.mode();
  const hasKey = Photo.hasKey();

  const methods = {
    app: {
      icon: '📲', title: 'Uygulamaya gönder',
      sub: 'Claude / ChatGPT · ücretsiz',
      run: () => shareForAnalysis(box, thumb, full)
    },
    api: {
      icon: '⚡', title: hasKey ? 'API ile analiz et' : 'API ile analiz et',
      sub: hasKey ? 'tek dokunuş · ~0.1 cent' : 'anahtar gerekiyor — ayarlara git',
      run: () => hasKey ? runApiAnalysis(box, thumb, full) : goToApiSettings()
    },
    off: {
      icon: '✍️', title: 'Elle gir',
      sub: 'kaloriyi kendin yaz',
      run: () => { box.innerHTML = `<img src="${thumb}" alt="">`; showPhotoManual(box, thumb, true); }
    }
  };

  const order = [pref].concat(Object.keys(methods).filter(k => k !== pref));

  box.innerHTML = `
    <img src="${thumb}" alt="">
    <div class="label" style="margin-bottom:8px">Nasıl analiz edelim?</div>
    <div class="method-list">
      ${order.map((k, i) => `
        <button class="method ${i === 0 ? 'primary' : ''}" data-method="${k}">
          <span class="method-ic">${methods[k].icon}</span>
          <span class="method-body">
            <span class="method-t">${escapeHtml(methods[k].title)}</span>
            <span class="method-s">${escapeHtml(methods[k].sub)}</span>
          </span>
        </button>`).join('')}
    </div>
    <button class="ghost-btn small" id="method-cancel">Vazgeç</button>`;

  box.querySelectorAll('[data-method]').forEach(b => {
    b.addEventListener('click', () => methods[b.dataset.method].run());
  });
  // seçenekler ekranın altında kalmasın
  box.scrollIntoView({ behavior: 'smooth', block: 'center' });
  $('#method-cancel').addEventListener('click', () => {
    box.classList.add('hidden'); box.innerHTML = '';
  });
}

function goToApiSettings() {
  go('ayarlar');
  const el = $('#mode-picker');
  Store.data.analyzeMode = 'api';
  Store.save();
  fillSettings();
  if (el) el.scrollIntoView({ behavior: 'smooth', block: 'center' });
  toast('Anahtarı gir, sonra fotoğrafı tekrar çek', 'bad');
}

async function runApiAnalysis(box, thumb, full) {
  box.innerHTML = `<img src="${thumb}" alt=""><div class="spinner"></div>
    <div class="hint" style="text-align:center">Analiz ediliyor…</div>`;
  try {
    const r = await Photo.analyze(full);
    Game.award('', 'foto');
    showPhotoResult(box, thumb, r);
  } catch (err) {
    box.innerHTML = `<img src="${thumb}" alt="">
      <div class="pr-verdict">Analiz yapılamadı: ${escapeHtml(err.message)}</div>`;
    showPhotoManual(box, thumb, true);
  }
}

/* Telefondaki Claude/ChatGPT uygulamasına gönder, cevabı geri bekle */
async function shareForAnalysis(box, thumb, full) {
  Store.setPending(thumb);
  box.innerHTML = `
    <img src="${thumb}" alt="">
    <div class="pr-verdict">Fotoğrafı Claude ya da ChatGPT uygulamasına gönder, cevabı buraya yapıştır.</div>
    <div class="pr-actions" style="margin-bottom:12px">
      <button class="go" id="sh-send">📲 Uygulamaya gönder</button>
      <button id="sh-cancel">Vazgeç</button>
    </div>
    <div id="sh-paste"></div>`;

  $('#sh-cancel').addEventListener('click', () => {
    Store.takePending();
    box.classList.add('hidden'); box.innerHTML = '';
  });

  $('#sh-send').addEventListener('click', async () => {
    const res = await Photo.shareToApp(full);
    if (res === 'cancelled') return;
    if (res === 'copied') toast('İstem panoya kopyalandı');
    if (res === 'unsupported') toast('Paylaşım desteklenmiyor, istemi elle yaz', 'bad');
  });

  showPasteBox(thumb, '', $('#sh-paste'));
}

/* Cevabın yapıştırılacağı alan */
function showPasteBox(thumb, prefill, host) {
  const box = $('#photo-result');
  box.classList.remove('hidden');
  const target = host || box;
  if (!host) {
    box.innerHTML = thumb ? `<img src="${thumb}" alt="">` : '';
  }
  const wrap = document.createElement('div');
  wrap.innerHTML = `
    <div class="label" style="margin-top:8px">Cevabı yapıştır</div>
    <textarea id="paste-answer" class="paste-area" rows="4"
      placeholder='{"name":"Adana kebap","kcal":650,"protein":35}  ya da düz metin'>${escapeHtml(prefill || '')}</textarea>
    <div class="pr-actions">
      <button class="go" id="paste-read">Oku ve ekle</button>
      <button id="paste-manual">Elle gir</button>
    </div>`;
  target.appendChild(wrap);

  $('#paste-read').addEventListener('click', () => {
    const parsed = Photo.parseAnswer($('#paste-answer').value);
    if (!parsed) { toast('Kalori bulunamadı — elle gir', 'bad'); return; }
    showParsedResult(parsed, thumb);
  });
  $('#paste-manual').addEventListener('click', () => {
    box.innerHTML = thumb ? `<img src="${thumb}" alt="">` : '';
    showPhotoManual(box, thumb, true);
  });
}

/* Yapıştırılan cevabı API sonucuyla aynı ekranda göster */
function showParsedResult(parsed, thumb) {
  showPhotoResult($('#photo-result'), thumb || '', {
    name: parsed.name, items: [], kcal: parsed.kcal,
    protein: parsed.protein, confidence: 'orta', note: parsed.note
  });
}

function showPhotoManual(box, thumb, append) {
  box.classList.remove('hidden');
  const html = `
    ${append ? '' : `<img src="${thumb}" alt="">`}
    <div class="pr-verdict">${append ? 'Kaloriyi elle gir:' : 'Analiz için Ayarlar\'dan API anahtarı gerekiyor. Şimdilik elle gir:'}</div>
    <div class="meal-form">
      <input type="text" id="pm-name" placeholder="Ne yedin?">
      <div class="meal-row">
        <input type="number" id="pm-kcal" inputmode="numeric" placeholder="kcal">
        <input type="number" id="pm-protein" inputmode="numeric" placeholder="protein g">
      </div>
    </div>
    <div class="pr-actions" style="margin-top:10px">
      <button class="go" id="pm-add">Kaydet</button>
      <button id="pm-cancel">Vazgeç</button>
    </div>`;
  if (append) box.insertAdjacentHTML('beforeend', html); else box.innerHTML = html;

  $('#pm-add').addEventListener('click', () => {
    const kcal = parseInt($('#pm-kcal').value, 10) || 0;
    if (!kcal) { toast('Kalori gir', 'bad'); return; }
    Store.addMeal({
      name: $('#pm-name').value.trim() || 'Fotoğraflı öğün',
      kcal, protein: parseInt($('#pm-protein').value, 10) || 0, photo: thumb
    });
    box.classList.add('hidden'); box.innerHTML = '';
    renderMeals(); renderToday();
    toast('Eklendi', 'win');
  });
  $('#pm-cancel').addEventListener('click', () => { box.classList.add('hidden'); box.innerHTML = ''; });
}

function showPhotoResult(box, thumb, r) {
  box.classList.remove('hidden');   // paylaşım yolundan gelindiğinde kart gizli olabiliyor
  const p = Store.data.profile;
  const eaten = Store.dayTotals().kcal;
  const imp = Calc.mealImpact(r.kcal, Store.currentKg(), p, Store.data.targets.kcal, eaten);
  imp.kcal = r.kcal;
  const verdict = Coach.verdict(imp, r.name);
  const confLabel = { dusuk: 'düşük', orta: 'orta', yuksek: 'yüksek' }[r.confidence] || r.confidence;

  box.innerHTML = `
    ${thumb ? `<img src="${thumb}" alt="">` : ''}
    <div style="font-weight:700;font-size:16px;margin-bottom:4px">${escapeHtml(r.name)}</div>
    <div class="pr-nums">
      <span><b>${r.kcal}</b> kcal</span>
      <span><b>${r.protein}</b>g protein</span>
      <span>güven: ${escapeHtml(confLabel)}</span>
    </div>
    ${r.items.length ? `<div class="hint" style="margin-top:0;margin-bottom:10px">${escapeHtml(r.items.join(' · '))}</div>` : ''}
    <div class="pr-verdict">${escapeHtml(verdict)}</div>
    ${r.note ? `<div class="hint" style="margin-top:-4px;margin-bottom:10px">${escapeHtml(r.note)}</div>` : ''}
    <div class="pr-actions">
      <button class="go" id="pr-add">Yedim, ekle</button>
      <button id="pr-half">Yarısını yedim</button>
      <button id="pr-skip">Yemedim 💪</button>
    </div>`;

  const finish = (msg, cls) => {
    box.classList.add('hidden'); box.innerHTML = '';
    renderMeals(); renderToday();
    toast(msg, cls);
  };
  $('#pr-add').addEventListener('click', () => {
    Store.addMeal({ name: r.name, kcal: r.kcal, protein: r.protein, photo: thumb });
    finish(`${r.kcal} kcal eklendi`);
  });
  $('#pr-half').addEventListener('click', () => {
    Store.addMeal({
      name: r.name + ' (yarım)', kcal: Math.round(r.kcal / 2),
      protein: Math.round(r.protein / 2), photo: thumb
    });
    celebrate(Game.award('ogun', 'yarim'));
    finish(`${Math.round(r.kcal / 2)} kcal eklendi — iyi karar`, 'win');
  });
  $('#pr-skip').addEventListener('click', () => {
    Store.addBoredom(`Fotoğraf: ${r.name} (${r.kcal} kcal) — yemedi`, 'resisted');
    const events = Game.award('foto_red');
    renderBoredom(); renderGame();
    celebrate(events);
    vibrate([30, 50, 30]);
    finish(`${r.kcal} kcal kurtardın · +${XP.foto_red} XP 💪`, 'win');
  });
}

/* ---------------- sıkıntı ---------------- */
function bindPanic() {
  $('#btn-panic').addEventListener('click', openPanic);
  $('#btn-panic-2').addEventListener('click', openPanic);
  $('#btn-panic-another').addEventListener('click', () => { newTask(); });
  $('#btn-panic-done').addEventListener('click', () => closePanic('resisted'));
  $('#btn-panic-ate').addEventListener('click', () => closePanic('ate'));
}

let currentTask = null;

function openPanic() {
  vibrate(60);
  $('#overlay-panic').classList.remove('hidden');
  $('#panic-msg').textContent = Coach.pick('panic');
  const pd = $('#panic-deen');
  if (Deen.enabled()) {
    const d = Deen.forPanic();
    $('#panic-deen-text').textContent = d.t;
    $('#panic-deen-src').textContent = d.k;
    pd.classList.remove('hidden');
  } else {
    pd.classList.add('hidden');
  }
  newTask();
  startTimer(90);
}

function newTask() {
  currentTask = TASKS[Math.floor(Math.random() * TASKS.length)];
  $('#task-card').textContent = currentTask.t;
}

function startTimer(sec) {
  clearInterval(panicTimer);
  const C = 339.3;
  let left = sec;
  const numEl = $('#timer-num'), ring = $('#ring-fg');
  const paint = () => {
    numEl.textContent = left;
    ring.style.strokeDashoffset = (C * (1 - left / sec)).toFixed(1);
  };
  paint();
  panicTimer = setInterval(() => {
    left--;
    if (left <= 0) {
      clearInterval(panicTimer);
      left = 0; paint();
      numEl.textContent = '✓';
      vibrate([50, 80, 50]);
      return;
    }
    paint();
  }, 1000);
}

function closePanic(outcome) {
  clearInterval(panicTimer);
  $('#overlay-panic').classList.add('hidden');
  Store.addBoredom(currentTask ? currentTask.t : '', outcome);
  const gece = new Date().getHours() >= 22;
  const events = Game.award(outcome === 'resisted' ? 'direnis' : 'yedi', gece && outcome === 'resisted' ? 'gece' : null);
  renderBoredom(); renderToday(); renderGame(); renderBoss(); renderBadges();
  if (outcome === 'resisted') {
    celebrate(events);
    const n = Store.resistCount();
    if (!events.some(e => e.type === 'badge' || e.type === 'level' || (e.type === 'boss' && e.killed))) {
      toast(`${n}. kez atlattın · +${XP.direnis} XP 💪`, 'win');
    }
    vibrate([40, 60, 40]);
  } else {
    toast('Duvar biraz geri örüldü. Bir sonrakinde yık.', 'bad');
  }
}

function renderBoredom() {
  const n = Store.resistCount();
  $('#streak-num').textContent = n;
  const saved = n * 400;
  $('#streak-sub').textContent = n === 0
    ? 'İlk kez sıkıldığında butona bas.'
    : `Yaklaşık ${saved.toLocaleString('tr-TR')} kcal ≈ ${(saved / 7700).toFixed(1)} kg yağ kurtardın.`;

  const host = $('#boredom-log');
  const log = Store.data.boredom.slice().reverse().slice(0, 25);
  if (!log.length) { host.innerHTML = '<div class="empty">Henüz kayıt yok.</div>'; return; }
  host.innerHTML = log.map(b => `
    <div class="h-row">
      <span class="h-date">${fmtTime(b.ts)}</span>
      <span class="m-name" style="flex:1">${escapeHtml((b.task || '').slice(0, 46))}</span>
      <span class="h-diff ${b.outcome === 'resisted' ? 'down' : 'up'}">${b.outcome === 'resisted' ? '💪' : '🍽'}</span>
    </div>`).join('');
}

/* ---------------- açlık testi ---------------- */
function bindHunger() {
  $('#btn-hunger-test').addEventListener('click', () => {
    hungerState = { i: 0, answers: [] };
    $('#overlay-hunger').classList.remove('hidden');
    paintQuestion();
  });
  $('#q-yes').addEventListener('click', () => answerHunger(true));
  $('#q-no').addEventListener('click', () => answerHunger(false));
  $('#btn-hunger-close').addEventListener('click', () => $('#overlay-hunger').classList.add('hidden'));
}

function paintQuestion() {
  $('#q-count').textContent = `${hungerState.i + 1}/3`;
  $('#q-text').textContent = HUNGER_QUESTIONS[hungerState.i];
  $('#q-yes').textContent = 'Evet';
  $('#q-no').textContent = 'Hayır';
  $('#q-yes').classList.remove('hidden');
  $('#q-no').classList.remove('hidden');
}

function answerHunger(v) {
  hungerState.answers.push(v);
  hungerState.i++;
  if (hungerState.i < HUNGER_QUESTIONS.length) { paintQuestion(); return; }

  // 1. soru: son 3 saatte yedin mi (evet => aç değilsin)
  // 2. soru: karnın boş mu (evet => açsın)
  // 3. soru: elma yer miydin (evet => gerçek açlık)
  const [ate, empty, apple] = hungerState.answers;
  let score = 0;
  if (!ate) score++;
  if (empty) score++;
  if (apple) score++;

  const real = score >= 2;
  $('#q-count').textContent = 'SONUÇ';
  $('#q-text').textContent = real
    ? 'Gerçekten açsın. Ye — ama proteinli ve doğru şeyi ye. Yumurta, yoğurt, tavuk.'
    : 'Aç değilsin, canın sıkkın. Yemek bunu çözmez, 20 dakika sonra aynı yerde olursun.';
  $('#q-yes').textContent = real ? 'Yemek ekle' : '90 saniye ver bana';
  $('#q-no').textContent = 'Kapat';
  $('#q-yes').onclick = () => {
    $('#overlay-hunger').classList.add('hidden');
    bindHunger();
    if (real) go('yemek'); else openPanic();
  };
  $('#q-no').onclick = () => { $('#overlay-hunger').classList.add('hidden'); bindHunger(); };
}

function updatePhotoHint() {
  $('#photo-hint').textContent = Photo.hasKey()
    ? 'Fotoğrafı çek, sonra yöntemi seç: telefondaki Claude/ChatGPT uygulamasına gönder (ücretsiz), API ile analiz et ya da elle yaz.'
    : 'Fotoğrafı çek, sonra yöntemi seç: telefondaki Claude/ChatGPT uygulamasına gönder (ücretsiz) ya da elle yaz. API için Ayarlar\'dan anahtar gir.';
}

function showDeenList() {
  let ov = $('#deen-overlay');
  if (!ov) {
    ov = document.createElement('div');
    ov.id = 'deen-overlay';
    ov.className = 'overlay deen-overlay';
    document.body.appendChild(ov);
  }
  ov.innerHTML = `
    <div class="deen-sheet">
      <div class="deen-head">
        <h2>Âyet ve hadisler</h2>
        <button class="icon-btn" id="deen-close">✕</button>
      </div>
      <p class="hint" style="margin:0 0 14px">
        Her metnin altında kaynağı yazılı: sûre ve âyet numarası ya da hadis külliyatı,
        bab ve numara. Meal ve numaralar birden fazla bağımsız kaynakla karşılaştırıldı;
        yine de kendin kontrol etmek istersen kaynaklar bunun için burada.
      </p>
      ${Deen.all().map(d => `
        <div class="card deen">
          <div class="deen-mark">﴾﴿</div>
          <div class="deen-text">${escapeHtml(d.t)}</div>
          <div class="deen-src">${escapeHtml(d.k)}</div>
        </div>`).join('')}
    </div>`;
  ov.classList.remove('hidden');
  $('#deen-close').addEventListener('click', () => ov.classList.add('hidden'));
}

/* ---------------- bildirimler ---------------- */
function bindNotify() {
  $('#ntf-slots').innerHTML = Notify.SLOTS.map(sl => `
    <div class="ntf-row">
      <button class="ntf-chk" data-slot="${sl.id}" role="switch"><span></span></button>
      <div class="ntf-label">${escapeHtml(sl.label)}</div>
      <input type="time" class="ntf-time" data-time="${sl.id}" value="${sl.def}">
    </div>`).join('');

  $('#ntf-toggle').addEventListener('click', async () => {
    const cfg = Store.data.notify;
    if (!cfg.enabled) {
      const p = await Notify.request();
      if (p !== 'granted') {
        toast(p === 'denied' ? 'Bildirim izni reddedilmiş — tarayıcı ayarlarından aç' : 'Bildirim desteklenmiyor', 'bad');
        renderNotify();
        return;
      }
      cfg.enabled = true;
    } else {
      cfg.enabled = false;
    }
    Store.save();
    Notify.schedule();
    renderNotify();
  });

  $('#ntf-slots').addEventListener('click', e => {
    const b = e.target.closest('[data-slot]');
    if (!b) return;
    const id = b.dataset.slot;
    Store.data.notify.slots[id] = !Store.data.notify.slots[id];
    Store.save(); Notify.schedule(); renderNotify();
  });

  $('#ntf-slots').addEventListener('change', e => {
    const t = e.target.closest('[data-time]');
    if (!t) return;
    Store.data.notify.times[t.dataset.time] = t.value;
    Store.save(); Notify.schedule(); renderNotify();
  });

  $('#ntf-test').addEventListener('click', async () => {
    const ok = await Notify.test();
    toast(ok ? 'Gönderildi' : 'İzin verilmedi', ok ? 'win' : 'bad');
  });

  if (Store.data.notify.enabled) Notify.schedule();
  renderNotify();
}

async function renderNotify() {
  const cfg = Store.data.notify;
  const on = cfg.enabled && Notify.permission() === 'granted';
  $('#ntf-toggle').classList.toggle('on', on);
  $('#ntf-toggle').setAttribute('aria-checked', String(on));
  $('#ntf-slots').classList.toggle('disabled', !on);

  $$('[data-slot]').forEach(b => b.classList.toggle('on', !!cfg.slots[b.dataset.slot]));
  $$('[data-time]').forEach(t => { t.value = cfg.times[t.dataset.time] || t.value; });

  if (!Notify.supported()) {
    $('#ntf-hint').textContent = 'Bu tarayıcı bildirimleri desteklemiyor.';
    return;
  }
  const bg = await Notify.backgroundActive();
  $('#ntf-hint').textContent = !on
    ? 'Kapalı. Açarsan seçtiğin saatlerde hatırlatma gelir — özellikle akşam tehlike saatinde.'
    : bg
      ? 'Açık ve arka planda çalışıyor. Uygulama kapalıyken de bildirim gelir.'
      : 'Açık. Arka plan izni yok, yani bildirimler uygulama açık ya da yakın zamanda kullanılmışken gelir. Ana ekrana kurmak bunu iyileştirir.';
}

/* ---------------- ayarlar ---------------- */
function bindSettings() {
  const map = {
    '#set-height': ['profile', 'heightCm', 'num'],
    '#set-age': ['profile', 'age', 'num'],
    '#set-sex': ['profile', 'sex', 'str'],
    '#set-activity': ['profile', 'activity', 'num'],
    '#set-start': ['profile', 'startWeight', 'num'],
    '#set-goal': ['profile', 'goalWeight', 'num'],
    '#set-kcal': ['targets', 'kcal', 'num'],
    '#set-protein': ['targets', 'protein', 'num']
  };
  Object.entries(map).forEach(([sel, [grp, key, type]]) => {
    $(sel).addEventListener('change', () => {
      const raw = $(sel).value;
      Store.data[grp][key] = type === 'num' ? (parseFloat(raw) || 0) : raw;
      Store.save();
      renderAll(); fillSettings();
    });
  });

  $('#set-apikey').addEventListener('change', () => {
    Store.data.apiKey = $('#set-apikey').value.trim();
    Store.save();
    updatePhotoHint();
    toast(Photo.hasKey() ? 'Anahtar kaydedildi' : 'Anahtar silindi');
  });

  $('#mode-picker').addEventListener('click', e => {
    const b = e.target.closest('[data-mode]');
    if (!b) return;
    Store.data.analyzeMode = b.dataset.mode;
    Store.save();
    fillSettings();
    updatePhotoHint();
    toast('Yöntem değişti');
  });

  $('#set-model').addEventListener('change', () => {
    Store.data.apiModel = $('#set-model').value;
    Store.save(); fillSettings();
    toast('Model değişti');
  });

  $('#btn-recalc').addEventListener('click', () => {
    const p = Store.data.profile;
    const kg = Store.currentKg();
    Store.data.targets.kcal = Calc.suggestKcal(kg, p);
    Store.data.targets.protein = Calc.suggestProtein(p.goalWeight);
    Store.save();
    fillSettings(); renderAll();
    toast('Hedefler güncellendi', 'win');
  });

  $('#tone-picker').addEventListener('click', e => {
    const b = e.target.closest('[data-tone]');
    if (!b) return;
    Store.data.profile.tone = b.dataset.tone;
    Store.save();
    fillSettings();
    $('#coach-text').textContent = Coach.pick('idle');
    toast('Ton değişti');
  });

  $('#deen-toggle').addEventListener('click', () => {
    Store.data.deen = !Deen.enabled();
    Store.save();
    fillSettings(); renderDeen();
    toast(Deen.enabled() ? 'Açık' : 'Kapalı');
  });

  $('#deen-list-btn').addEventListener('click', showDeenList);

  const pn = $('#prayer-notify');
  if (pn) {
    pn.checked = Prayer.bildirimAcik();
    pn.addEventListener('change', async () => {
      const r = await Prayer.bildirimAyar(pn.checked);
      renderPrayerSettings(r);
      if (pn.checked && r.kod === 'izin-yok') {
        await Reminders.izinVar(true);
        renderPrayerSettings(await Prayer.zamanla());
      }
    });
  }

  $('#btn-health-test').addEventListener('click', runHealthDiag);
  $('#btn-export').addEventListener('click', doExport);
  $('#import-input').addEventListener('change', doImport);
  $('#btn-reset').addEventListener('click', () => {
    if (!confirm('Tüm veriler silinecek. Emin misin?')) return;
    if (!confirm('Gerçekten emin misin? Bu geri alınamaz.')) return;
    Store.reset(); seedIfEmpty(); renderAll(); fillSettings();
    toast('Sıfırlandı');
  });
}

function fillSettings() {
  const p = Store.data.profile, t = Store.data.targets;
  $('#set-height').value = p.heightCm;
  $('#set-age').value = p.age;
  $('#set-sex').value = p.sex;
  $('#set-activity').value = String(p.activity);
  $('#set-start').value = p.startWeight;
  $('#set-goal').value = p.goalWeight;
  $('#set-kcal').value = t.kcal;
  $('#set-protein').value = t.protein;
  $('#set-apikey').value = Store.data.apiKey || '';
  $$('.tone').forEach(b => b.classList.toggle('active', b.dataset.tone === p.tone));
  $('#deen-toggle').classList.toggle('on', Deen.enabled());
  $('#deen-toggle').setAttribute('aria-checked', String(Deen.enabled()));

  const kg = Store.currentKg();
  const tdee = Calc.tdee(kg, p);
  const weekly = Calc.expectedWeeklyLoss(kg, p, t.kcal);
  $('#tdee-hint').textContent =
    `Bazal yakım ${Calc.bmr(kg, p.heightCm, p.age, p.sex)} kcal · günlük toplam yakım ≈ ${tdee} kcal. ` +
    `${t.kcal} kcal ile günlük açık ${tdee - t.kcal} kcal ≈ haftada ${weekly.toFixed(2)} kg.`;

  const mode = Photo.mode();
  $$('.mode').forEach(b => b.classList.toggle('active', b.dataset.mode === mode));
  $('#mode-hint').textContent = {
    app: 'Fotoğraf çektiğinde bu seçenek başta ve vurgulu gelir. Telefondaki Claude/ChatGPT uygulaması API değildir — abonelik ayrı faturalanır ve bir web sayfası ona doğrudan bağlanamaz; bu yüzden paylaş sayfası köprü olarak kullanılır. Android\'de cevabı "İrade"ye paylaşırsan otomatik okunur.',
    api: 'Fotoğraf çektiğinde bu seçenek başta gelir. Tek dokunuş, uygulamadan çıkmadan — anahtar aşağıda.',
    off: 'Fotoğraf çektiğinde elle giriş başta gelir. Diğer ikisi yine listede durur.'
  }[mode];

  $('#set-model').value = Store.data.apiModel;
  const u = Store.data.apiUsage;
  const cost = Store.apiCost();
  $('#usage-box').innerHTML = u.calls
    ? `Bu ay <b>${u.calls}</b> fotoğraf analizi · ${(u.inTok + u.outTok).toLocaleString('tr-TR')} jeton · yaklaşık <b>$${cost.toFixed(3)}</b>`
    : 'Bu ay henüz API kullanılmadı. Elle yazdığın yemekler ücretsiz.';

  const bytes = new Blob([Store.exportJSON()]).size;
  $('#backup-hint').textContent =
    `${Store.data.weights.length} tartı, ${Store.data.meals.length} öğün kaydı · ${(bytes / 1024).toFixed(0)} KB. Ayda bir yedek al.`;
}

/* Yedek dışa aktarma.

   APK'nın WebView'inde <a download> ile blob indirme çalışmıyor: indirme
   yöneticisi bağlı değil, tıklama sessizce hiçbir şey yapmıyordu. Eski kod
   sonucu hiç kontrol etmeden "indirildi" diyordu — dosya inmiyordu.

   Artık uygulamada dosya gerçekten yazılıyor ve paylaşım sayfası açılıyor;
   yedeği Drive'a, e-postaya ya da istediğin yere gönderebiliyorsun.
   Telefonda kalan yedek zayıf yedektir: telefon giderse o da gider. */
async function disaAktar() {
  const json = Store.exportJSON();
  const ad = `irade-${today()}.json`;
  const C = window.Capacitor;
  const native = C && typeof C.isNativePlatform === 'function' && C.isNativePlatform();
  const FS = native && C.Plugins && C.Plugins.Filesystem;

  if (FS) {
    let uri;
    try {
      const r = await FS.writeFile({ path: ad, data: json, directory: 'CACHE', encoding: 'utf8' });
      uri = r && r.uri;
    } catch (e) {
      return { kod: 'hata', ek: e.message };
    }

    const SH = C.Plugins.Share;
    if (SH && SH.share) {
      try {
        await SH.share({ title: 'İrade yedeği', text: ad, files: [uri] });
        return { kod: 'paylasildi', ad };
      } catch (e) {
        // Paylaşımı iptal etmek hata değil; dosya yazıldı.
        return { kod: 'yazildi', ad, yer: uri };
      }
    }
    return { kod: 'yazildi', ad, yer: uri };
  }

  /* Eklenti yoksa — eski kurulumlar da dahil — hiçbir eklenti
     gerektirmeyen yollar. Web Share zaten fotoğraf paylaşımında
     kullanılıyor, yani kurulu uygulamada çalışıyor. */
  if (navigator.share) {
    try {
      await navigator.share({ title: 'İrade yedeği ' + ad, text: json });
      return { kod: 'paylasildi', ad };
    } catch (e) {
      if (e && e.name === 'AbortError') return { kod: 'iptal' };
      // desteklenmiyorsa aşağıdaki yollara düş
    }
  }

  if (!native) {
    try {
      const blob = new Blob([json], { type: 'application/json' });
      const a = document.createElement('a');
      a.href = URL.createObjectURL(blob);
      a.download = ad;
      document.body.appendChild(a);
      a.click();
      setTimeout(() => { URL.revokeObjectURL(a.href); a.remove(); }, 500);
      return { kod: 'indirildi', ad };
    } catch (e) { /* panoya düş */ }
  }

  if (navigator.clipboard && navigator.clipboard.writeText) {
    try {
      await navigator.clipboard.writeText(json);
      return { kod: 'kopyalandi', ad, boyut: json.length };
    } catch (e) { /* ekrana düş */ }
  }

  return { kod: 'ekranda', ad, json };
}

/* Son çare: yedeği ekranda göster, elle kopyalanabilsin */
function yedegiGoster(json, ad) {
  let ov = $('#backup-overlay');
  if (!ov) {
    ov = document.createElement('div');
    ov.id = 'backup-overlay';
    ov.className = 'overlay';
    document.body.appendChild(ov);
  }
  ov.innerHTML = `
    <div class="backup-sheet">
      <div class="label">${escapeHtml(ad)}</div>
      <div class="hint" style="margin:0 0 10px">Hepsini seç, kopyala ve kendine gönder. Geri yüklerken bu metni bir .json dosyasına yapıştırman yeterli.</div>
      <textarea id="backup-text" readonly>${escapeHtml(json)}</textarea>
      <button class="primary-btn" id="backup-copy">Kopyala</button>
      <button class="ghost-btn" id="backup-close">Kapat</button>
    </div>`;
  const ta = $('#backup-text');
  ta.focus(); ta.select();
  $('#backup-copy').addEventListener('click', async () => {
    ta.select();
    try {
      if (navigator.clipboard && navigator.clipboard.writeText) await navigator.clipboard.writeText(json);
      else document.execCommand('copy');
      toast('Panoya kopyalandı', 'win');
    } catch (e) { toast('Kopyalanamadı, elle seç', 'bad'); }
  });
  $('#backup-close').addEventListener('click', () => ov.remove());
}

async function doExport() {
  const btn = $('#btn-export');
  btn.disabled = true;
  const eski = btn.textContent;
  btn.textContent = 'Hazırlanıyor…';
  try {
    const r = await disaAktar();
    if (r.kod === 'paylasildi') toast('Yedek paylaşıldı', 'win');
    else if (r.kod === 'indirildi') toast('Yedek indirildi', 'win');
    else if (r.kod === 'yazildi') { toast('Yedek kaydedildi'); alert(`Yedek kaydedildi:\n${r.ad}\n\n${r.yer || ''}`); }
    else if (r.kod === 'kopyalandi') { toast('Yedek panoya kopyalandı', 'win'); alert(`Yedek panoya kopyalandı (${r.boyut} karakter).\n\nKendine gönder: WhatsApp, e-posta ya da not defteri.`); }
    else if (r.kod === 'ekranda') yedegiGoster(r.json, r.ad);
    else if (r.kod === 'iptal') toast('Vazgeçildi');
    else { toast('Yedek alınamadı', 'bad'); alert('Yedek alınamadı: ' + (r.ek || 'bilinmeyen hata')); }
  } finally {
    btn.disabled = false;
    btn.textContent = eski;
  }
}

function doImport(e) {
  const f = e.target.files && e.target.files[0];
  e.target.value = '';
  if (!f) return;
  const r = new FileReader();
  r.onload = () => {
    try {
      Store.importJSON(r.result);
      renderAll(); fillSettings();
      toast('Yedek yüklendi', 'win');
    } catch (err) {
      toast('Dosya okunamadı', 'bad');
    }
  };
  r.readAsText(f);
}

/* ---------------- yardımcılar ---------------- */
function escapeHtml(s) {
  return String(s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}

function fmtDate(k) {
  const d = parseKey(k);
  return d.toLocaleDateString('tr-TR', { day: 'numeric', month: 'short' });
}

function fmtTime(ts) {
  return new Date(ts).toLocaleTimeString('tr-TR', { hour: '2-digit', minute: '2-digit' });
}

let toastTimer = null;
function toast(msg, cls) {
  const el = $('#toast');
  el.textContent = msg;
  el.className = 'toast ' + (cls || '');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => el.classList.add('hidden'), 2600);
}

function vibrate(pattern) {
  if (navigator.vibrate) { try { navigator.vibrate(pattern); } catch (e) {} }
}

function registerSW() {
  if (!('serviceWorker' in navigator)) return;
  navigator.serviceWorker.register('sw.js').catch(() => {});
  navigator.serviceWorker.addEventListener('message', e => {
    if (e.data && e.data.type === 'open') {
      go(e.data.slot === 'tehlike' ? 'sikinti' : e.data.slot === 'sabah' ? 'tarti' : 'bugun');
      if (e.data.slot === 'tehlike') openPanic();
    }
  });
}

document.addEventListener('DOMContentLoaded', init);
