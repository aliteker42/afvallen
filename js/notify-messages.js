/* Bildirim metinleri — hem sayfa hem service worker bunu kullanır */

const NOTIFY_POOL = {
  sabah: [
    { t: "Tartı zamanı ⚖️", b: "Tuvaletten sonra, aç karnına. 10 saniye sürer, günün tonunu belirler." },
    { t: "Günaydın", b: "Rakamdan korkma. Ölçmediğin şeyi düzeltemezsin." },
    { t: "Bugünün ilk kararı", b: "Tartıl, kaydet, devam et. Gerisi akşam belli olur." },
    { t: "Sabah kontrolü", b: "Dün nasıl geçtiyse geçti. Bugün yeni sayfa." }
  ],
  ogle: [
    { t: "Protein aldın mı? 🍳", b: "Öğlene kadar 60 g hedefle. Protein tokluğun tek gerçek kalkanı." },
    { t: "Su hatırlatması 💧", b: "Sıkıntının yarısı susuzluk. Bir bardak iç, 20 dakika bekle." },
    { t: "Gün ortası", b: "Hedefin içinde misin? Uygulamayı aç, 5 saniyede gör." }
  ],
  tehlike: [
    { t: "Tehlike saati 🛑", b: "Akşam yemeğinden sonrası senin zayıf noktan. Bu gece atlat." },
    { t: "Hadis", b: "\u201cÂdemoğluna belini doğrultacak birkaç lokma yeter.\u201d — Tirmizî, Zühd 47" },
    { t: "Hadis", b: "\u201cGerçek mücâhid, nefsiyle cihad edendir.\u201d — Tirmizî, nr. 1621" },
    { t: "Mutfağa gitme", b: "Aç değilsin, sıkılıyorsun. Butona bas, 90 saniye ver." },
    { t: "Dur bir saniye", b: "Şimdi yersen bu gece yine tıkanarak uyursun. Buna değer mi?" },
    { t: "Bu his 20 dakika sürer", b: "Pişmanlık 3 gün. Uygulamayı aç, sana bir görev vereyim." },
    { t: "104 kg olan adam", b: "O adam bu saatte yemedi. O yüzden 104'tü." }
  ],
  motivasyon: [
    { t: "Hatırlatma", b: "133'ten 104'e indin. Yapabilir misin sorusu çoktan cevaplandı." },
    { t: "Âyet", b: "\u201cYiyin, için, fakat israf etmeyin. Çünkü O, israf edenleri sevmez.\u201d — A'râf 31" },
    { t: "Hadis", b: "\u201cAllah katında amellerin en sevimlisi, az da olsa devamlı olanıdır.\u201d — Buhârî, Rikâk 18" },
    { t: "Hadis", b: "\u201cİki nimet vardır ki insanların çoğu onlar hakkında aldanmıştır: sağlık ve boş vakit.\u201d — Buhârî, nr. 6412" },
    { t: "Tansiyonun düşüyor", b: "Verilen her kilo yaklaşık 1 mmHg. Sessizce kazanıyorsun." },
    { t: "Nefes ve uyku", b: "Terazi yavaş konuşur ama nefesin daha erken haber verir." },
    { t: "Diz yükü", b: "Her 1 kg, yürürken dizlerinden 4 kg'lık baskıyı kaldırıyor." },
    { t: "Devam", b: "Mükemmel olman gerekmiyor. Dünden iyi olman yeter." }
  ]
};

function pickNotify(slot) {
  const pool = NOTIFY_POOL[slot] || NOTIFY_POOL.motivasyon;
  return pool[Math.floor(Math.random() * pool.length)];
}

if (typeof self !== 'undefined' && typeof window === 'undefined') {
  self.NOTIFY_POOL = NOTIFY_POOL;
  self.pickNotify = pickNotify;
}
