/* Oyun katmanı: XP, seviye, rozet, günlük görev, haftalık canavar.
   Hepsi mevcut kayıtlardan beslenir — ayrı bir şey girmen gerekmez. */

const LEVELS = [
  { xp: 0,    t: 'Çaylak',          i: '🥚' },
  { xp: 150,  t: 'Kararlı',         i: '🐣' },
  { xp: 400,  t: 'Direnişçi',       i: '🔥' },
  { xp: 800,  t: 'Sıkıntı Avcısı',  i: '🏹' },
  { xp: 1400, t: 'Disiplinli',      i: '⚔️' },
  { xp: 2200, t: 'Demir İrade',     i: '🛡️' },
  { xp: 3200, t: 'Rekor Kırıcı',    i: '👑' },
  { xp: 4500, t: 'Efsane',          i: '🐉' }
];

const XP = {
  tarti: 10, ogun: 5, direnis: 25, foto_red: 40,
  temiz_gun: 50, protein_gun: 20, kilometre: 100, gorev: 0, boss: 150
};

const BADGES = [
  { id: 'ilk_tarti',   i: '👣', t: 'İlk Adım',        d: 'İlk kez tartıldın.' },
  { id: 'seri7',       i: '📅', t: 'Bir Hafta',       d: '7 gün üst üste tartıldın.' },
  { id: 'seri30',      i: '🗓️', t: 'Bir Ay',          d: '30 gün üst üste tartıldın.' },
  { id: 'ilk_direnis', i: '✋', t: 'Hayır Dedim',      d: 'İlk kez sıkıntıyı yemeden atlattın.' },
  { id: 'direnis10',   i: '🔟', t: 'On Kere Hayır',    d: '10 kez atlattın.' },
  { id: 'direnis50',   i: '🥋', t: 'Sıkıntı Ustası',   d: '50 kez atlattın.' },
  { id: 'gece',        i: '🌙', t: 'Gece Bekçisi',     d: 'Gece 22:00\'den sonra atlattın.' },
  { id: 'sabah',       i: '🌅', t: 'Sabah Kuşu',       d: 'Sabah 9\'dan önce tartıldın.' },
  { id: 'protein',     i: '🥩', t: 'Protein Canavarı', d: 'Günlük protein hedefini tutturdun.' },
  { id: 'temiz_gun',   i: '✅', t: 'Temiz Gün',        d: 'Bir günü kalori hedefinin altında kapattın.' },
  { id: 'temiz5',      i: '🏆', t: 'Temiz Hafta',      d: '5 temiz gün topladın.' },
  { id: 'yarim',       i: '🍽️', t: 'Yarısı Yeter',     d: 'Bir öğünün yarısında durdun.' },
  { id: 'foto',        i: '📷', t: 'Objektif',         d: 'İlk fotoğraf analizini yaptın.' },
  { id: 'eksi5',       i: '5️⃣', t: '-5 kg',            d: 'Başlangıçtan 5 kg aşağıdasın.' },
  { id: 'eksi10',      i: '🔟', t: '-10 kg',           d: 'Başlangıçtan 10 kg aşağıdasın.' },
  { id: 'rekor',       i: '🐐', t: 'Rekor Avcısı',     d: 'Eski rekorunu kırdın.' },
  { id: 'boss',        i: '💀', t: 'Canavar Avcısı',   d: 'Can sıkıntısı canavarını devirdin.' },
  { id: 'boss5',       i: '☠️', t: 'Seri Katil',       d: '5 canavar devirdin.' }
];

const QUEST_POOL = [
  { id: 'tarti',   t: 'Bugün tartıl',                       xp: 15, auto: () => Store.data.weights.some(w => w.d === today()) },
  { id: 'direnis', t: 'Sıkıntıyı bir kez atlat',            xp: 25, auto: () => todayResists() >= 1 },
  { id: 'protein', t: 'Protein hedefinin yarısını geç',     xp: 20, auto: () => Store.dayTotals().protein >= Store.data.targets.protein / 2 },
  { id: 'ogun3',   t: '3 öğün kaydet',                      xp: 15, auto: () => Store.mealsOn().length >= 3 },
  { id: 'kalori',  t: 'Kalori hedefinin altında kal',       xp: 30, auto: () => { const t = Store.dayTotals().kcal; return t > 0 && t <= Store.data.targets.kcal; } },
  { id: 'su',      t: '2 litre su iç',                      xp: 15, manual: true },
  { id: 'yuru',    t: '10 dakika yürü',                     xp: 20, manual: true },
  { id: 'merdiven',t: 'Asansör yerine merdiven kullan',     xp: 20, manual: true },
  { id: 'sekersiz',t: 'Bugün şekerli içecek içme',          xp: 25, manual: true }
];

const BOSS_MAX = 500;
const BOSS_DMG = { direnis: 70, foto_red: 60, temiz_gun: 50, tarti: 15 };
const BOSS_HEAL = 40;

const Game = {
  state() { return Store.data.game; },

  /* --- seviye --- */
  level() {
    const xp = this.state().xp;
    let idx = 0;
    for (let i = 0; i < LEVELS.length; i++) if (xp >= LEVELS[i].xp) idx = i;
    const cur = LEVELS[idx];
    const next = LEVELS[idx + 1] || null;
    const base = cur.xp;
    const span = next ? next.xp - base : 1;
    return {
      n: idx + 1, title: cur.t, icon: cur.i, xp,
      into: xp - base, span,
      pct: next ? Math.min(100, ((xp - base) / span) * 100) : 100,
      toNext: next ? next.xp - xp : 0,
      nextTitle: next ? next.t : null
    };
  },

  /* --- ana giriş noktası --- */
  award(kind, meta) {
    const g = this.state();
    const before = this.level().n;
    const events = [];

    const gain = XP[kind] || 0;
    if (gain) { g.xp += gain; events.push({ type: 'xp', amount: gain }); }

    const dmg = BOSS_DMG[kind];
    if (dmg) {
      const killed = this.hitBoss(dmg);
      events.push({ type: 'boss', damage: dmg, killed });
      if (killed) {
        g.xp += XP.boss;
        events.push({ type: 'xp', amount: XP.boss });
      }
    }
    if (kind === 'yedi') this.healBoss(BOSS_HEAL);

    this.checkBadges(meta).forEach(b => events.push({ type: 'badge', badge: b }));

    const after = this.level().n;
    if (after > before) events.push({ type: 'level', level: this.level() });

    Store.save();
    return events;
  },

  /* --- rozetler --- */
  unlock(id) {
    const g = this.state();
    if (g.badges.includes(id)) return null;
    g.badges.push(id);
    return BADGES.find(b => b.id === id);
  },

  checkBadges(meta) {
    const g = this.state();
    const w = Store.data.weights;
    const out = [];
    const push = id => { const b = this.unlock(id); if (b) out.push(b); };

    if (w.length >= 1) push('ilk_tarti');
    const streak = this.streak();
    if (streak >= 7) push('seri7');
    if (streak >= 30) push('seri30');

    const r = Store.resistCount();
    if (r >= 1) push('ilk_direnis');
    if (r >= 10) push('direnis10');
    if (r >= 50) push('direnis50');

    const lost = Store.data.profile.startWeight - Store.currentKg();
    if (lost >= 5) push('eksi5');
    if (lost >= 10) push('eksi10');
    if (w.length && Store.currentKg() <= (Store.data.profile.recordLow || 0)) push('rekor');

    if (Store.dayTotals().protein >= Store.data.targets.protein) push('protein');
    if (g.cleanDays >= 1) push('temiz_gun');
    if (g.cleanDays >= 5) push('temiz5');
    if (g.bossKills >= 1) push('boss');
    if (g.bossKills >= 5) push('boss5');

    if (meta === 'gece') push('gece');
    if (meta === 'sabah') push('sabah');
    if (meta === 'yarim') push('yarim');
    if (meta === 'foto') push('foto');

    return out;
  },

  /* --- seri: kaç gün üst üste tartıldın --- */
  streak() {
    const days = Store.data.weights.map(w => w.d).sort();
    if (!days.length) return 0;
    const last = days[days.length - 1];
    const gap = daysBetween(last, today());
    if (gap > 1) return 0;
    let n = 1;
    for (let i = days.length - 1; i > 0; i--) {
      if (daysBetween(days[i - 1], days[i]) === 1) n++;
      else break;
    }
    return n;
  },

  /* son 14 günün tartı takvimi */
  calendar(n) {
    n = n || 14;
    const have = new Set(Store.data.weights.map(w => w.d));
    const out = [];
    for (let i = n - 1; i >= 0; i--) {
      const d = dateKey(new Date(Date.now() - i * 86400000));
      out.push({ d, on: have.has(d), today: d === today() });
    }
    return out;
  },

  /* --- günlük görevler --- */
  quests() {
    const g = this.state();
    if (!g.quests || g.quests.d !== today()) {
      g.quests = { d: today(), picked: this.pickQuests(today()), done: [] };
      Store.save();
    }
    return g.quests.picked.map(id => {
      const q = QUEST_POOL.find(x => x.id === id);
      const manualDone = g.quests.done.includes(id);
      return {
        id, t: q.t, xp: q.xp, manual: !!q.manual,
        done: q.manual ? manualDone : (manualDone || q.auto())
      };
    });
  },

  /* Gün içinde değişmesin diye tarihten türetilen sabit seçim */
  pickQuests(dayKey) {
    let seed = 0;
    for (let i = 0; i < dayKey.length; i++) seed = (seed * 31 + dayKey.charCodeAt(i)) >>> 0;
    const pool = QUEST_POOL.slice();
    const picked = [];
    for (let i = 0; i < 3 && pool.length; i++) {
      seed = (seed * 1103515245 + 12345) >>> 0;
      picked.push(pool.splice(seed % pool.length, 1)[0].id);
    }
    return picked;
  },

  /* Otomatik tamamlanan görevlerin XP'sini bir kez yaz.
     Bunlar tıklanmadığı için completeQuest'ten geçmiyordu. */
  syncQuests() {
    const g = this.state();
    const out = [];
    this.quests().forEach(q => {
      if (q.manual || !q.done || g.quests.done.includes(q.id)) return;
      g.quests.done.push(q.id);
      g.xp += q.xp;
      out.push({ type: 'xp', amount: q.xp, quest: q.t });
    });
    if (out.length) Store.save();
    return out;
  },

  completeQuest(id) {
    const g = this.state();
    this.quests();                       // bugünün listesi hazır olsun
    if (g.quests.done.includes(id)) return null;
    const q = QUEST_POOL.find(x => x.id === id);
    if (!q) return null;
    g.quests.done.push(id);
    g.xp += q.xp;
    Store.save();
    return { xp: q.xp, all: this.quests().every(x => x.done) };
  },

  /* --- haftalık canavar --- */
  boss() {
    const g = this.state();
    const wk = weekKey();
    if (!g.boss || g.boss.week !== wk) {
      g.boss = { week: wk, hp: BOSS_MAX, max: BOSS_MAX };
      Store.save();
    }
    return g.boss;
  },

  hitBoss(dmg) {
    const b = this.boss();
    if (b.hp <= 0) return false;
    b.hp = Math.max(0, b.hp - dmg);
    if (b.hp === 0) { this.state().bossKills++; return true; }
    return false;
  },

  healBoss(amount) {
    const b = this.boss();
    if (b.hp <= 0) return;
    b.hp = Math.min(b.max, b.hp + amount);
    Store.save();
  },

  /* --- dün temiz miydi: gün başında bir kez değerlendirilir --- */
  settleYesterday() {
    const g = this.state();
    const y = dateKey(new Date(Date.now() - 86400000));
    if (g.lastSettled === y) return [];
    g.lastSettled = y;

    const meals = Store.data.meals.filter(m => m.d === y);
    if (!meals.length) { Store.save(); return []; }

    const kcal = meals.reduce((a, m) => a + (+m.kcal || 0), 0);
    const protein = meals.reduce((a, m) => a + (+m.protein || 0), 0);
    const events = [];
    if (kcal <= Store.data.targets.kcal) {
      g.cleanDays++;
      events.push(...this.award('temiz_gun'));
    }
    if (protein >= Store.data.targets.protein) events.push(...this.award('protein_gun'));
    Store.save();
    return events;
  }
};

function todayResists() {
  const start = parseKey(today()).getTime();
  return Store.data.boredom.filter(b => b.outcome === 'resisted' && b.ts >= start).length;
}

function weekKey() {
  const d = new Date();
  const jan1 = new Date(d.getFullYear(), 0, 1);
  const week = Math.floor(((d - jan1) / 86400000 + jan1.getDay()) / 7);
  return `${d.getFullYear()}-${week}`;
}
