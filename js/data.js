/* Sabit içerik: sıkıntı görevleri, sorular, hızlı yemekler, koç cümleleri */

const TASKS = [
  { t: "2 büyük bardak su iç. Yavaş. Bitene kadar başka bir şey yok.", tag: "su" },
  { t: "Ayakkabını giy, sokağa çık, 10 dakika yürü. Telefon cebinde kalsın.", tag: "hareket" },
  { t: "20 şınav. Dizden olur, tek şart: sayacaksın.", tag: "hareket" },
  { t: "30 squat. Sandalyeye oturur gibi in, kalk.", tag: "hareket" },
  { t: "Duş al. Soğuk suyla bitir. Sonra hâlâ istiyorsan konuşuruz.", tag: "kesinti" },
  { t: "Dişlerini fırçala. Ağzında nane varken yemek istemezsin.", tag: "kesinti" },
  { t: "Şekersiz kahve veya bitki çayı yap. Demlenmesini bekle, acele etme.", tag: "kesinti" },
  { t: "Bulaşıkları yıka ya da bir odayı topla. Eller doluysa ağız boş kalır.", tag: "kesinti" },
  { t: "Birine mesaj at. Konuşacak biri bul. Sıkıntı yalnızlıktan besleniyor.", tag: "sosyal" },
  { t: "90 saniye plank dene. Yapamazsan da dene.", tag: "hareket" },
  { t: "En sevdiğin şarkıyı aç, sonuna kadar dinle. Sonra karar ver.", tag: "kesinti" },
  { t: "Merdiven varsa 3 kere çık in. Yoksa yerinde koş.", tag: "hareket" },
  { t: "Eski fotoğrafına bak — 104 kg olduğun günden. O adam hâlâ içeride.", tag: "hafıza" },
  { t: "Buzdolabını aç, kapat, mutfaktan çık. 3 saniye. Şimdi.", tag: "kesinti" },
  { t: "10 derin nefes. 4 saniye al, 6 saniye ver. Say.", tag: "kesinti" },
  { t: "Yarın ne yiyeceğini yaz. Plan yapmak yemek yemekten daha çok doyurur.", tag: "plan" },
  { t: "Bir bardak su + 5 dakika yürüyüş. İkisi de bedava, ikisi de işe yarar.", tag: "su" },
  { t: "Telefonu bırak, 20 dakika bir şey oku. Sıkıntının panzehiri boşluk değil, dolgu.", tag: "kesinti" }
];

const HUNGER_QUESTIONS = [
  "Son 3 saatte bir şey yedin mi?",
  "Şu anda karnın guruldayacak kadar boş mu?",
  "Elma yemeyi teklif etsem yer miydin?"
];

const QUICK_FOODS = [
  { n: "Yumurta (1)", k: 78, p: 6 },
  { n: "Haşlanmış yumurta (3)", k: 234, p: 19 },
  { n: "Yoğurt (200g)", k: 120, p: 10 },
  { n: "Beyaz peynir (50g)", k: 130, p: 9 },
  { n: "Tavuk göğsü (150g)", k: 248, p: 46 },
  { n: "Kıymalı yemek (1 porsiyon)", k: 420, p: 28 },
  { n: "Mercimek çorbası", k: 180, p: 9 },
  { n: "Pilav (1 porsiyon)", k: 300, p: 6 },
  { n: "Ekmek (1 dilim)", k: 80, p: 3 },
  { n: "Salata (yağsız)", k: 60, p: 2 },
  { n: "Ton balığı (1 kutu)", k: 130, p: 28 },
  { n: "Döner dürüm", k: 650, p: 30 },
  { n: "Pide (1 adet)", k: 750, p: 30 },
  { n: "Lahmacun (1)", k: 300, p: 13 },
  { n: "Pizza (1 dilim)", k: 285, p: 12 },
  { n: "Hamburger menü", k: 1100, p: 35 },
  { n: "Cips (1 paket)", k: 500, p: 6 },
  { n: "Çikolata (1 tablet)", k: 530, p: 7 },
  { n: "Kola (330ml)", k: 139, p: 0 },
  { n: "Bira (500ml)", k: 215, p: 2 },
  { n: "Baklava (2 dilim)", k: 400, p: 5 },
  { n: "Kuruyemiş (50g)", k: 300, p: 9 }
];

/* Koç cümleleri — {kg}, {kalan}, {rekor}, {gun} yer tutucuları doldurulur */
const COACH = {
  sert: {
    idle: [
      "133'ten 104'e indin, sonra 127.7'ye çıktın. İkinci düşüş birincisinden zor değil — sadece daha az bahanen var.",
      "Bugün tartıya çıkmadıysan sebebi bellidir. Çık.",
      "Hedefe {kalan} kg. Bu rakam kendi kendine küçülmeyecek.",
      "Bir yıl kaybettin. Bugünü de kaybetme.",
      "Aç değilsin. Sıkılıyorsun. İkisi aynı şey değil ve sen bunu biliyorsun.",
      "Tansiyonun yüksek, gece doğru düzgün nefes alamıyorsun. Bunlar kilonun faturası, yaşın değil.",
      "Merdiven çıkarken tıkanmandan şikâyet ediyorsun ama düzeltecek tek şey elinde: bugün ne yediğin.",
      "Her gece horlayarak uyuduğun için değil, 127 kiloyla yattığın için yorgun kalkıyorsun."
    ],
    gain: [
      "Terazi yukarı gitti. Sebebi dün akşamdı ve sen ne olduğunu biliyorsun.",
      "+{fark} kg. Kaza değil bu, karardı."
    ],
    loss: [
      "-{fark} kg. Güzel. Şimdi yarın da aynısını yap.",
      "Düştü. Kutlama yok, devam var."
    ],
    panic: [
      "Şimdi yersen yarın sabah terazide görürsün. Her seferinde öyle oldu.",
      "Bu his 20 dakika sürer. Pişmanlık 3 gün.",
      "104 kg olan adam bu anda yemedi. O yüzden 104'tü.",
      "Şimdi yersen bu gece yine tıkanarak uyursun. Bunu bilerek uzat elini.",
      "Tansiyonun her kiloyla düşüyor. Bu atıştırmalık o düşüşü durdurmak demek."
    ]
  },
  soguk: {
    idle: [
      "Hedefe {kalan} kg. Günlük 1000 kcal açıkla ≈ {hafta} hafta.",
      "BMI {bmi}. Hedef kiloda BMI {bmigoal} olacak.",
      "Günlük yakım ≈ {tdee} kcal. Hedef alım {hedefkcal} kcal.",
      "Son 7 gün: {d7} kg. Son 30 gün: {d30} kg.",
      "Verilen kilo: {verilen} kg. Tahmini sistolik düşüş: −{mmhg} mmHg.",
      "Diz yükü her adımda {diz} kg azaldı. %10 kayıpta uyku apnesi ortalama dörtte bir hafifler."
    ],
    gain: ["+{fark} kg. Tek günlük veri, trend çizgisine bak."],
    loss: ["-{fark} kg. Trend aşağı."],
    panic: [
      "Ortalama atıştırmalık 450 kcal ≈ günlük açığın yarısı.",
      "500 kcal fazla = 0.065 kg yağ ≈ 15 günde 1 kg.",
      "Bu his ortalama 12-20 dakikada geçer. Ölçüldü.",
      "1 kg ≈ 1 mmHg sistolik. Her geri alınan kilo o kadar geri gider."
    ]
  },
  koc: {
    idle: [
      "Sen bunu bir kere yaptın: 133 → 104. Yani soru 'yapabilir miyim' değil, 'bugün ne yapıyorum'.",
      "Hedefe {kalan} kg kaldı. Parça parça: önce {sonraki} kg'ı gör.",
      "Tartıya çıkmaktan korkuyordun, çıktın. En zor kısım bitti bile.",
      "Kötü bir gün planı bozmaz. Kötü bir hafta bozar. Bugün hangisi olacak?",
      "Bugün mükemmel olmak zorunda değilsin. Sadece dünden iyi ol.",
      "Terazi yavaş bir geri bildirim. Asıl haberi nefesin ve uykun verecek — onlar kilodan önce düzelir.",
      "Hedef sadece rakam değil: tansiyonun düşsün, geceleri rahat uyu, merdivende tıkanma. Üçü de aynı yolda.",
      "İlk 5 kiloda horlaman azalır, tansiyonun ~5 mmHg iner. Bunlar {kalan} kg beklemeden gelen kazançlar.",
      "Sabah dinlenmiş kalkmak istiyorsan yol bu. Uyku hapı değil, boyun çevresi meselesi."
    ],
    gain: [
      "+{fark} kg — su olabilir, tuz olabilir, dün akşam olabilir. Panik yok, sadece bugüne odaklan.",
      "Yukarı gitti. Olur. Önemli olan yarın ne yaptığın."
    ],
    loss: [
      "-{fark} kg. İşliyor. Aynen devam.",
      "Düşüyor. Gördün mü, vücut cevap veriyor."
    ],
    panic: [
      "Dur bir saniye. Karnın mı aç, canın mı sıkkın? Genelde ikincisi.",
      "Bu isteğin bir ömrü var: 15-20 dakika. Sen ondan uzun dayanırsın.",
      "Şu an yemezsen yarın sabah bu ana teşekkür edeceksin.",
      "Bu gece nasıl uyuyacağını şu an veriyorsun. Geç saatte yenen şey en çok uykuyu vuruyor.",
      "Nefesin ve tansiyonun için verdiğin savaşta bu an küçük ama sayılan bir tur."
    ]
  }
};

const MILESTONE_NOTES = {
  120: "120 altı. 7 kg gitti, dizlerinden her adımda 28 kg'lık yük kalktı.",
  115: "115. Kan basıncın ve şekerinde ilk ciddi düzelme burada başlar.",
  110: "110. Yolun yarısına yaklaştın, uyku kalitesi belirgin düzelir.",
  104: "104 — ESKİ REKORUN. Buraya gelirsen bir yıllık kayıp silinir.",
  100: "100. Üç haneden çıkmak için tek kilo kaldı.",
  99: "99 — ilk kez 100 altı. Yıllardır görmediğin rakam.",
  95: "95. BMI 30 altına yaklaşıyorsun, 'obez' sınıfı geride kalıyor.",
  90: "90. Nefes darlığı, eklem ağrısı büyük ölçüde biter.",
  85: "85. BMI 27 — fazla kilolu sınırının alt ucu.",
  78: "78 — BMI 25. Normal kilo. Bitiş çizgisi."
};

/* ---------------- Sağlık ---------------- */
/* Ölçüm yok — bunlar kilo düştükçe açılan, dert bazlı yol haritaları.
   kg: mutlak kilo kaybı eşiği · pct: başlangıç kilosunun yüzdesi */

const HEALTH_TRACKS = [
  {
    id: "tansiyon",
    icon: "🩸",
    title: "Tansiyon",
    lead: "Ortalama olarak verilen her 1 kg, büyük tansiyonu yaklaşık 1 mmHg düşürür. Bu senin en hızlı kazandığın cephe — ilk haftalarda bile hissedilir.",
    steps: [
      { kg: 2,   t: "Yaklaşık 2 mmHg aşağı. Küçük görünür ama ölçülebilir bir düşüş." },
      { kg: 5,   t: "~5 mmHg. Tuzu da kısarsan bu rahat 8-10 olur." },
      { kg: 10,  t: "~10 mmHg — düşük doz bir tansiyon ilacının yaptığı işe denk." },
      { kg: 15,  t: "~15 mmHg. İlaç kullanıyorsan doz konuşulacak seviye. Doktoruna sor." },
      { kg: 23.7, t: "104'e dönüş. Çoğu insanda tansiyon bu noktada normal aralığa oturur." }
    ]
  },
  {
    id: "uyku",
    icon: "😴",
    title: "Uyku ve horlama",
    lead: "Kilo boyun çevresinde ve dilin arkasında birikir; yatınca hava yolunu daraltan şey bu. Erimesi doğrudan uykuya yansır.",
    steps: [
      { kg: 3,   t: "Boyun çevresi incelmeye başlar, horlamanın sesi düşer." },
      { pct: 5,  t: "Gece uyanmaların seyrekleşir, reflü hafifler. Sabah daha dinlenmiş kalkarsın." },
      { pct: 10, t: "Uyku apnesi şiddeti ortalama dörtte bir azalır — en büyük sıçrama burada." },
      { pct: 15, t: "Sabah baş ağrısı ve gün içi uyuklama belirgin geriler." },
      { kg: 23.7, t: "Gece boyunca kesintisiz uyku yeniden mümkün hale gelir." }
    ]
  },
  {
    id: "nefes",
    icon: "🫁",
    title: "Nefes",
    lead: "Fazla kilo hem göğsün üstünde ağırlık hem de her hareketle daha çok oksijen ihtiyacı demek. İkisi de kilo gidince birlikte düşer.",
    steps: [
      { kg: 4,  t: "Merdivende ilk fark: aynı kat, daha az soluk." },
      { kg: 8,  t: "Sırtındaki 8 kg'lık çanta indi. Yürüyüş hızın kendiliğinden artar." },
      { kg: 14, t: "Yatarken göğsündeki baskı azalır, düz yatmak kolaylaşır." },
      { kg: 20, t: "Eğilip ayakkabı bağlamak nefesini kesmez." },
      { kg: 23.7, t: "Konuşurken nefes almak için duraklamazsın." }
    ]
  },
  {
    id: "genel",
    icon: "🦵",
    title: "Eklemler ve metabolizma",
    lead: "Terazide görünmeyen ama her adımda hissedilen taraf.",
    steps: [
      { kg: 1,   t: "Her adımda dizlerinden ~4 kg'lık yük kalkar." },
      { pct: 5,  t: "Karaciğer yağlanmasının gerilemeye başladığı bilimsel eşik." },
      { pct: 7,  t: "Tip 2 diyabete gidiş ciddi biçimde yavaşlar." },
      { kg: 16,  t: "Diz ve bel yükü her adımda ~64 kg azaldı. Ağrı kesici ihtiyacı düşer." },
      { kg: 20,  t: "Genelde 2 pantolon bedeni. Dolabın yarısı geri gelir." }
    ]
  }
];
