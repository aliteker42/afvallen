/* Namaz vakitleri — Diyanet verisi (js/prayer-data.js) üstünde çalışır.

   Vakitler burada hesaplanmıyor; Diyanet'in Soest sayfasından çekilip
   derleme anında gömülüyor. Veri yoksa bölüm hiç görünmüyor: yanlış
   vakit göstermektense hiç göstermemek doğru. */

const VAKIT_ADI = ['İmsak', 'Güneş', 'Öğle', 'İkindi', 'Akşam', 'Yatsı'];
// Güneş bir namaz vakti değil, sadece imsakın bitişi — kılınacaklar bunlar
const KILINAN = [0, 2, 3, 4, 5];

const Prayer = {
  varMi() {
    return typeof PRAYER_TIMES !== 'undefined' && Object.keys(PRAYER_TIMES).length > 0;
  },

  /* Verilen günün vakitleri: [{i, ad, saat, dk}] */
  gun(d) {
    if (!this.varMi()) return null;
    const t = PRAYER_TIMES[d || today()];
    if (!t) return null;
    return t.map((saat, i) => {
      const [h, m] = saat.split(':').map(Number);
      return { i, ad: VAKIT_ADI[i], saat, dk: h * 60 + m };
    });
  },

  /* Şu andan sonraki ilk vakit; gün bittiyse yarının imsakı */
  sirada() {
    const bugun = this.gun();
    if (!bugun) return null;
    const n = new Date();
    const simdi = n.getHours() * 60 + n.getMinutes();

    const kalan = bugun.filter(v => v.dk > simdi);
    if (kalan.length) {
      const v = kalan[0];
      return { ...v, kalanDk: v.dk - simdi, yarin: false };
    }
    // gün bitti: yarının ilk vakti
    const y = new Date(n.getTime() + 86400000);
    const yarin = this.gun(dateKey(y));
    if (!yarin) return null;
    return { ...yarin[0], kalanDk: 1440 - simdi + yarin[0].dk, yarin: true };
  },

  /* Kılındı işaretleri — {'YYYY-MM-DD': [0,2,3]} */
  kayit() {
    return Store.data.prayers || (Store.data.prayers = {});
  },
  kilindiMi(i, d) {
    return (this.kayit()[d || today()] || []).includes(i);
  },
  isaretle(i, d) {
    const gun = d || today();
    const k = this.kayit();
    const liste = k[gun] || [];
    k[gun] = liste.includes(i) ? liste.filter(x => x !== i) : liste.concat(i).sort();
    if (!k[gun].length) delete k[gun];
    Store.save();
  },
  bugunSayi() {
    return (this.kayit()[today()] || []).filter(i => KILINAN.includes(i)).length;
  },

  /* --- bildirimler ---
     Vakitler her gün değiştiği için haftalık tekrar kurulamıyor;
     önümüzdeki günlerin vakitleri tek tek zamanlanıyor ve uygulama
     her açıldığında tazeleniyor. Kimlikler 1.000.000 üstünde:
     hatırlatıcılarla çakışmasın. */

  bildirimAcik() {
    return Store.data.prayerNotify !== false;
  },
  bildirimAyar(v) {
    Store.data.prayerNotify = !!v;
    Store.save();
    return this.zamanla();
  },

  async zamanla() {
    const P = Reminders.plugin();
    if (!P) return { kod: 'tarayici' };
    if (!this.varMi()) return { kod: 'veri-yok' };

    try {
      const bekleyen = await P.getPending();
      const benim = ((bekleyen && bekleyen.notifications) || []).filter(n => n.id >= BILDIRIM_SINIR);
      if (benim.length) await P.cancel({ notifications: benim.map(n => ({ id: n.id })) });

      if (!this.bildirimAcik()) return { kod: 'kapali' };
      if (!(await Reminders.izinVar(false))) return { kod: 'izin-yok' };

      const simdi = new Date();
      const liste = [];
      for (let g = 0; g < 10; g++) {
        const t = new Date(simdi.getTime() + g * 86400000);
        const d = dateKey(t);
        const vakitler = this.gun(d);
        if (!vakitler) continue;
        for (const v of vakitler) {
          if (!KILINAN.includes(v.i)) continue;         // güneş için bildirim yok
          const [h, m] = v.saat.split(':').map(Number);
          const at = new Date(t.getFullYear(), t.getMonth(), t.getDate(), h, m, 0, 0);
          if (at <= simdi) continue;
          liste.push({
            id: BILDIRIM_SINIR + g * 10 + v.i,
            title: v.ad + ' vakti',
            body: v.saat + ' · Soest',
            schedule: { at, allowWhileIdle: true },
            smallIcon: 'ic_launcher'
          });
        }
      }
      if (liste.length) await P.schedule({ notifications: liste });
      return { kod: 'ok', sayi: liste.length };
    } catch (e) {
      return { kod: 'hata', ek: e.message };
    }
  },

  /* Üst üste kaç gün beş vakit tamam */
  seri() {
    let n = 0;
    for (let g = 0; g < 400; g++) {
      const d = dateKey(new Date(Date.now() - g * 86400000));
      const k = (this.kayit()[d] || []).filter(i => KILINAN.includes(i));
      if (k.length === KILINAN.length) n++;
      else if (g > 0) break;          // bugün henüz tamam olmayabilir
      else if (n === 0 && g === 0) continue;
    }
    return n;
  }
};
