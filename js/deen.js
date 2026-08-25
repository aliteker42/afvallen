/* Kilo, yeme-içme ve nefse hâkimiyetle ilgili âyet ve hadisler.
   Her metnin kaynağı uygulamada görünür — doğrulanabilsin diye.
   Meal ve kaynak numaraları eklenmeden önce birden fazla bağımsız
   kaynakla karşılaştırıldı; hiçbiri serbestçe yazılmadı. */

const DEEN = [
  {
    t: 'Ey Âdemoğulları! … Yiyin, için, fakat israf etmeyin. Çünkü O, israf edenleri sevmez.',
    k: 'A’râf sûresi, 31. âyet · Diyanet İşleri meali',
    tag: ['yemek', 'panik']
  },
  {
    t: 'Size rızık olarak verdiklerimizin temiz olanlarından yiyin, bu hususta taşkınlık ve nankörlük de etmeyin…',
    k: 'Tâhâ sûresi, 81. âyet · Diyanet Vakfı meali',
    tag: ['yemek']
  },
  {
    t: 'Âdemoğlu, midesinden daha kötü bir kap doldurmamıştır. Âdemoğluna belini doğrultacak birkaç lokma yeter. Mutlaka yemesi gerekiyorsa midesinin üçte birini yemeğe, üçte birini içeceğe, üçte birini de nefesine ayırsın.',
    k: 'Tirmizî, Zühd 47 (nr. 2380); İbn Mâce, Et’ime 50 (nr. 3349)',
    tag: ['yemek', 'panik']
  },
  {
    t: 'İki nimet vardır ki insanların çoğu onlar hakkında aldanmıştır: sağlık ve boş vakit.',
    k: 'Buhârî, Rikâk (nr. 6412) · İbn Abbas’tan',
    tag: ['saglik', 'panik']
  },
  {
    t: 'Allah katında amellerin en sevimlisi, az da olsa devamlı olanıdır.',
    k: 'Buhârî, Rikâk 18; Müslim, Müsâfirîn 218',
    tag: ['devam']
  },
  {
    t: 'Kuvvetli mü’min, Allah katında zayıf mü’minden daha hayırlı ve daha sevimlidir. Bununla beraber her ikisinde de hayır vardır. Sana yararlı olan şeyi elde etmeye çalış, Allah’tan yardım dile ve asla acz gösterme.',
    k: 'Müslim, Kader 34 (nr. 2664)',
    tag: ['saglik', 'panik']
  },
  {
    t: 'Şüphesiz bedeninin senin üzerinde hakkı vardır.',
    k: 'Buhârî, Savm 51; Müslim, Sıyâm 182 · Abdullah b. Amr’dan',
    tag: ['saglik']
  },
  {
    t: 'Gerçek mücâhid, nefsiyle cihad edendir.',
    k: 'Tirmizî, Fedâilü’l-cihâd 2 (nr. 1621)',
    tag: ['nefis', 'panik']
  },
  {
    t: 'Ey iman edenler! Sabır ve namaz ile Allah’tan yardım isteyin. Çünkü Allah muhakkak sabredenlerle beraberdir.',
    k: 'Bakara sûresi, 153. âyet · Diyanet meali',
    tag: ['sabir', 'panik']
  }
];

const Deen = {
  enabled() {
    return Store.data.deen !== false;
  },

  /* Gün içinde değişmesin diye tarihten türetilir */
  ofTheDay() {
    const key = today();
    let seed = 0;
    for (let i = 0; i < key.length; i++) seed = (seed * 31 + key.charCodeAt(i)) >>> 0;
    return DEEN[seed % DEEN.length];
  },

  /* Sıkıntı anına uygun olanlardan rastgele */
  forPanic() {
    const pool = DEEN.filter(d => d.tag.includes('panik'));
    return pool[Math.floor(Math.random() * pool.length)];
  },

  all() { return DEEN; }
};
