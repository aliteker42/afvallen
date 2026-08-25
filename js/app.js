/* Uygulama: yönlendirme, ekran çizimi, etkileşimler */

const $ = s => document.querySelector(s);
const $$ = s => Array.from(document.querySelectorAll(s));

let currentRange = 30;
let panicTimer = null;
let hungerState = { i: 0, answers: [] };
let pendingPhoto = null;

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
  updatePhotoHint();
  renderAll();
  registerSW();
  handleIncomingShare();
  openFromHash();
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
  if (name === 'sikinti') renderBoredom();
  if (name === 'saglik') renderHealth();
  if (name === 'ayarlar') fillSettings();
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
  $('#prog-fill').style.width = pct.toFixed(1) + '%';
  $('#prog-marker').style.left = `calc(${Math.min(100, pct).toFixed(1)}% - 1.5px)`;
  const kalan = Math.max(0, kg - p.goalWeight);
  const weekly = Calc.expectedWeeklyLoss(kg, p, t.kcal);
  $('#prog-caption').textContent = kalan <= 0
    ? 'Hedefe ulaştın. Yeni hedef belirle.'
    : `Hedefe ${kalan.toFixed(1)} kg · ${done.toFixed(1)} kg verildi` +
      (weekly > 0 ? ` · bu hızla ≈ ${Math.ceil(kalan / weekly)} hafta` : '');

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

  $('#coach-text').textContent = Coach.pick('idle');
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
  toast('Kaydedildi', 'win');
}

function checkMilestoneHit(kg) {
  const ms = Calc.milestones(Store.data.profile, Store.data.weights);
  const hit = ms.find(m => m.done && Math.abs(m.kg - Math.ceil(kg)) < 5 && kg <= m.kg);
  if (hit && kg <= hit.kg) {
    setTimeout(() => toast(`🎉 ${hit.kg} kg geçildi!`, 'win'), 1200);
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
    renderMeals(); renderToday();
    toast(`${kcal} kcal eklendi`);
  });

  $('#quick-foods').innerHTML = QUICK_FOODS
    .map((f, i) => `<button class="qf" data-qf="${i}">${escapeHtml(f.n)} · ${f.k}</button>`).join('');
  $('#quick-foods').addEventListener('click', e => {
    const b = e.target.closest('[data-qf]');
    if (!b) return;
    const f = QUICK_FOODS[+b.dataset.qf];
    Store.addMeal({ name: f.n, kcal: f.k, protein: f.p });
    renderMeals(); renderToday();
    toast(`${f.n} · ${f.k} kcal`);
  });

  $('#photo-input').addEventListener('change', onPhoto);

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

function renderMeals() {
  const t = Store.data.targets;
  const tot = Store.dayTotals();
  $('#yemek-date').textContent = new Date().toLocaleDateString('tr-TR', { day: 'numeric', month: 'long' });
  $('#ds-kcal').textContent = tot.kcal;
  $('#ds-protein').textContent = tot.protein + 'g';
  $('#ds-left').textContent = t.kcal - tot.kcal;

  const list = Store.mealsOn().slice().reverse();
  const host = $('#meal-list');
  if (!list.length) { host.innerHTML = '<div class="empty">Bugün henüz bir şey eklemedin.</div>'; return; }
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
    finish(`${Math.round(r.kcal / 2)} kcal eklendi — iyi karar`, 'win');
  });
  $('#pr-skip').addEventListener('click', () => {
    Store.addBoredom(`Fotoğraf: ${r.name} (${r.kcal} kcal) — yemedi`, 'resisted');
    renderBoredom();
    vibrate([30, 50, 30]);
    finish(`${r.kcal} kcal kurtardın 💪`, 'win');
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
  renderBoredom(); renderToday();
  if (outcome === 'resisted') {
    const n = Store.resistCount();
    toast(`${n}. kez atlattın 💪`, 'win');
    vibrate([40, 60, 40]);
  } else {
    toast('Kaydedildi. Bir sonrakinde tekrar dene.', 'bad');
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

  const kg = Store.currentKg();
  const tdee = Calc.tdee(kg, p);
  const weekly = Calc.expectedWeeklyLoss(kg, p, t.kcal);
  $('#tdee-hint').textContent =
    `Bazal yakım ${Calc.bmr(kg, p.heightCm, p.age, p.sex)} kcal · günlük toplam yakım ≈ ${tdee} kcal. ` +
    `${t.kcal} kcal ile günlük açık ${tdee - t.kcal} kcal ≈ haftada ${weekly.toFixed(2)} kg.`;

  const mode = Photo.mode();
  $$('.mode').forEach(b => b.classList.toggle('active', b.dataset.mode === mode));
  $('#mode-hint').textContent = {
    app: 'Fotoğraf çektiğinde bu seçenek başta ve vurgulu gelir. Telefondaki Claude/ChatGPT uygulaması API değildir — abonelik ayrı faturalanır ve bir web sayfası ona doğrudan bağlanamaz; bu yüzden paylaş sayfası köprü olarak kullanılır. Android\'de cevabı "Yeniden 104"e paylaşırsan otomatik okunur.',
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

function doExport() {
  const blob = new Blob([Store.exportJSON()], { type: 'application/json' });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = `yeniden104-${today()}.json`;
  document.body.appendChild(a);
  a.click();
  setTimeout(() => { URL.revokeObjectURL(a.href); a.remove(); }, 500);
  toast('Yedek indirildi');
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
