/* Veri katmanı — her şey localStorage'da, telefondan çıkmaz */

const KEY = 'yeniden104:v1';

const DEFAULTS = {
  profile: {
    heightCm: 177,
    age: 39,
    sex: 'm',
    activity: 1.375,
    startWeight: 127.7,
    goalWeight: 104,
    recordLow: 104,
    tone: 'koc'
  },
  targets: { kcal: 1800, protein: 165 },
  weights: [],   // {d:'YYYY-MM-DD', kg:127.7}
  meals: [],     // {id, d, ts, name, kcal, protein, photo}
  boredom: [],   // {id, ts, task, outcome:'resisted'|'ate'}
  apiKey: '',
  apiModel: 'claude-haiku-4-5',
  analyzeMode: 'app',   // 'app' = telefondaki Claude/ChatGPT'ye gönder, 'api' = doğrudan API, 'off' = elle
  apiUsage: { month: '', calls: 0, inTok: 0, outTok: 0 },
  notify: {
    enabled: false,
    slots: { sabah: true, ogle: false, tehlike: true, motivasyon: true },
    times: { sabah: '08:00', ogle: '13:00', tehlike: '21:00', motivasyon: '17:00' },
    sent: []
  },
  pending: null,        // paylaşıma gönderilen fotoğraf, cevap dönene kadar bekler
  createdAt: null
};

const Store = {
  data: null,

  load() {
    try {
      const raw = localStorage.getItem(KEY);
      this.data = raw ? deepMerge(clone(DEFAULTS), JSON.parse(raw)) : clone(DEFAULTS);
    } catch (e) {
      console.warn('Kayıt okunamadı, sıfırdan başlanıyor', e);
      this.data = clone(DEFAULTS);
    }
    if (!this.data.createdAt) this.data.createdAt = today();
    return this.data;
  },

  save() {
    try {
      localStorage.setItem(KEY, JSON.stringify(this.data));
    } catch (e) {
      toast('Kaydedilemedi — depolama dolu olabilir', 'bad');
    }
  },

  /* --- kilo --- */
  addWeight(kg, d) {
    d = d || today();
    const i = this.data.weights.findIndex(w => w.d === d);
    if (i >= 0) this.data.weights[i].kg = kg;
    else this.data.weights.push({ d, kg });
    this.data.weights.sort((a, b) => a.d < b.d ? -1 : 1);
    this.save();
  },
  removeWeight(d) {
    this.data.weights = this.data.weights.filter(w => w.d !== d);
    this.save();
  },
  latestWeight() {
    const w = this.data.weights;
    return w.length ? w[w.length - 1] : null;
  },
  currentKg() {
    const l = this.latestWeight();
    return l ? l.kg : this.data.profile.startWeight;
  },

  /* --- yemek --- */
  addMeal(m) {
    this.data.meals.push(Object.assign({
      id: uid(), d: today(), ts: Date.now(), name: '', kcal: 0, protein: 0, photo: null
    }, m));
    this.save();
  },
  removeMeal(id) {
    this.data.meals = this.data.meals.filter(m => m.id !== id);
    this.save();
  },
  mealsOn(d) {
    return this.data.meals.filter(m => m.d === (d || today()));
  },
  dayTotals(d) {
    return this.mealsOn(d).reduce((a, m) => {
      a.kcal += +m.kcal || 0;
      a.protein += +m.protein || 0;
      return a;
    }, { kcal: 0, protein: 0 });
  },

  /* --- sıkıntı --- */
  addBoredom(task, outcome) {
    this.data.boredom.push({ id: uid(), ts: Date.now(), task, outcome });
    this.save();
  },
  resistCount() {
    return this.data.boredom.filter(b => b.outcome === 'resisted').length;
  },

  /* --- bekleyen paylaşım --- */
  setPending(photo) {
    this.data.pending = { photo, ts: Date.now() };
    this.save();
  },
  takePending(maxAgeMs) {
    const p = this.data.pending;
    this.data.pending = null;
    this.save();
    if (!p) return null;
    return (Date.now() - p.ts) < (maxAgeMs || 3600000) ? p : null;
  },

  /* --- API kullanımı --- */
  trackApi(inTok, outTok) {
    const m = today().slice(0, 7);
    const u = this.data.apiUsage;
    if (u.month !== m) { u.month = m; u.calls = 0; u.inTok = 0; u.outTok = 0; }
    u.calls++;
    u.inTok += inTok || 0;
    u.outTok += outTok || 0;
    this.save();
  },
  /* Haiku fiyatlaması üzerinden kaba aylık maliyet (USD) */
  apiCost() {
    const u = this.data.apiUsage;
    const haiku = this.data.apiModel.includes('haiku');
    const inRate = haiku ? 1 : 2;      // $ / milyon giriş jetonu
    const outRate = haiku ? 5 : 10;    // $ / milyon çıkış jetonu
    return (u.inTok / 1e6) * inRate + (u.outTok / 1e6) * outRate;
  },

  /* --- yedek --- */
  exportJSON() {
    return JSON.stringify(this.data, null, 2);
  },
  importJSON(text) {
    const parsed = JSON.parse(text);
    if (!parsed || typeof parsed !== 'object') throw new Error('Geçersiz dosya');
    this.data = deepMerge(clone(DEFAULTS), parsed);
    this.save();
  },
  reset() {
    this.data = clone(DEFAULTS);
    this.data.createdAt = today();
    this.save();
  }
};

/* --- yardımcılar --- */
function clone(o) { return JSON.parse(JSON.stringify(o)); }

function deepMerge(base, patch) {
  for (const k in patch) {
    const v = patch[k];
    if (v && typeof v === 'object' && !Array.isArray(v) && base[k] && typeof base[k] === 'object' && !Array.isArray(base[k])) {
      deepMerge(base[k], v);
    } else if (v !== undefined) {
      base[k] = v;
    }
  }
  return base;
}

function uid() {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
}

function today() {
  return dateKey(new Date());
}

function dateKey(dt) {
  const p = n => String(n).padStart(2, '0');
  return `${dt.getFullYear()}-${p(dt.getMonth() + 1)}-${p(dt.getDate())}`;
}

function parseKey(k) {
  const [y, m, d] = k.split('-').map(Number);
  return new Date(y, m - 1, d);
}

function daysBetween(a, b) {
  return Math.round((parseKey(b) - parseKey(a)) / 86400000);
}
