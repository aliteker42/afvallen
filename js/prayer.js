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
