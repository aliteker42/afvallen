/* Kişisel hatırlatıcılar — kendi tanımladığın işler, gün ve saatle.

   APK'da bunlar Android'in kendi zamanlayıcısına kuruluyor
   (@capacitor/local-notifications), yani uygulama kapalıyken de geliyor.
   Tarayıcıda böyle bir güvence yok: sayfa kapalıyken zamanlayıcı çalışmaz,
   orada ancak uygulama açıkken hatırlatma yapılabiliyor. */

const GUNLER = [
  { i: 1, k: 'Pzt', u: 'Pazartesi' },
  { i: 2, k: 'Sal', u: 'Salı' },
  { i: 3, k: 'Çar', u: 'Çarşamba' },
  { i: 4, k: 'Per', u: 'Perşembe' },
  { i: 5, k: 'Cum', u: 'Cuma' },
  { i: 6, k: 'Cmt', u: 'Cumartesi' },
  { i: 0, k: 'Paz', u: 'Pazar' }
];

/* Bildirim kimlik araligi: hatirlaticilar bu sinirin altinda,
   namaz vakitleri ustunde. Ikisi birbirinin bildirimini silmesin. */
const BILDIRIM_SINIR = 1000000;

const Reminders = {
  all() {
    return Store.data.reminders || (Store.data.reminders = []);
  },

  add({ t, days, time }) {
    const r = {
      id: 'r' + Date.now().toString(36) + Math.random().toString(36).slice(2, 6),
      nid: Math.floor(Math.random() * 90000) + 1000,   // bildirim kimliği (sayı olmalı)
      t: String(t || '').trim().slice(0, 80),
      days: (days && days.length ? days : [0, 1, 2, 3, 4, 5, 6]).slice().sort(),
      time: /^\d{2}:\d{2}$/.test(time) ? time : '10:00',
      on: true,
      doneOn: null
    };
    if (!r.t) return null;
    this.all().push(r);
    Store.save();
    this.sync();
    return r;
  },

  update(id, patch) {
    const r = this.all().find(x => x.id === id);
    if (!r) return null;
    Object.assign(r, patch);
    Store.save();
    this.sync();
    return r;
  },

  remove(id) {
    Store.data.reminders = this.all().filter(x => x.id !== id);
    Store.save();
    this.sync();
  },

  /* Bugün yapılacaklar: bugünün gününe denk gelen ve açık olanlar */
  today() {
    const g = new Date().getDay();
    return this.all().filter(r => r.on && r.days.includes(g));
  },

  isDone(r) {
    return r.doneOn === today();
  },

  toggleDone(id) {
    const r = this.all().find(x => x.id === id);
    if (!r) return;
    r.doneOn = this.isDone(r) ? null : today();
    Store.save();
  },

  gunAdi(days) {
    if (days.length === 7) return 'her gün';
    return GUNLER.filter(g => days.includes(g.i)).map(g => g.k).join(', ');
  },

  /* --- native zamanlayıcı --- */

  plugin() {
    const C = window.Capacitor;
    if (!C || typeof C.isNativePlatform !== 'function' || !C.isNativePlatform()) return null;
    return (C.Plugins && C.Plugins.LocalNotifications) || null;
  },

  async izinVar(iste) {
    const P = this.plugin();
    if (!P) return false;
    try {
      let s = await P.checkPermissions();
      if (s.display !== 'granted' && iste) s = await P.requestPermissions();
      return s.display === 'granted';
    } catch (e) {
      return false;
    }
  },

  /* Tüm hatırlatıcıları Android'in zamanlayıcısına yeniden kurar.
     Önce hepsi iptal edilir, sonra açık olanlar haftalık tekrarla kurulur;
     böylece silinen ya da kapatılan bir hatırlatıcı geride kalmaz. */
  async sync(iste) {
    const P = this.plugin();
    if (!P) return { kod: 'tarayici' };
    if (!(await this.izinVar(iste))) return { kod: 'izin-yok' };

    try {
      // Yalniz kendi kimlik araligini iptal et: namaz bildirimleri
      // 1.000.000 ustunde duruyor, onlara dokunulmamali.
      const bekleyen = await P.getPending();
      const benim = ((bekleyen && bekleyen.notifications) || []).filter(n => n.id < BILDIRIM_SINIR);
      if (benim.length) await P.cancel({ notifications: benim.map(n => ({ id: n.id })) });

      const liste = [];
      for (const r of this.all()) {
        if (!r.on) continue;
        const [h, m] = r.time.split(':').map(Number);
        for (const g of r.days) {
          liste.push({
            id: r.nid * 10 + g,
            title: r.t,
            body: 'Hatırlatma · ' + r.time,
            // Capacitor'da hafta günü Pazar = 1; JS'te Pazar = 0
            schedule: { on: { weekday: g + 1, hour: h, minute: m }, repeats: true, allowWhileIdle: true },
            smallIcon: 'ic_launcher',
            extra: { rid: r.id }
          });
        }
      }
      if (liste.length) await P.schedule({ notifications: liste });
      return { kod: 'ok', sayi: liste.length };
    } catch (e) {
      return { kod: 'hata', ek: e.message };
    }
  }
};
