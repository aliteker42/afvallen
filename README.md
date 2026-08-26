# İrade

Kişisel kilo takip uygulaması. Tek amacı var: **can sıkıntısından yemeyi durdurmak** ve kiloyu tekrar aşağı çekmek.

Çevrimdışı çalışan bir PWA. Sunucu yok, hesap yok, veriler telefondan çıkmıyor.

---

## Ekranlar

| Ekran | Ne yapar |
|---|---|
| **Bugün** | Güncel kilo, BMI, hedefe kalan, günün kalorisi/proteini, sıradaki kilometre taşı, koç cümlesi |
| **Tartı** | Kilo girişi, trend grafiği (7 günlük ortalama — günlük su dalgalanmasını süzer), 7/30 gün değişimi, kilometre taşları, geçmiş |
| **Yemek** | Fotoğrafla veya elle öğün ekleme, hazır Türk yemekleri listesi, günlük toplam |
| **Sıkıntı** | `CANIM SIKILIYOR` butonu, 90 saniyelik görev, haftanın duvarı, rozetler, "gerçekten aç mıyım" testi |
| **Sağlık** | Tansiyon, uyku ve nefeste kilo düştükçe ne kazanıldığını gösteren yol haritaları |
| **Ayarlar** | Profil, hedefler, koç tonu, bildirimler, fotoğraf analizi yöntemi, yedekleme (⚙ simgesinden açılır) |

### Âyet ve hadisler
Kilo, yeme-içme ve nefse hâkimiyetle ilgili **9 metin**. Bugün ekranında günün metni (tarihten türetilir, gün içinde değişmez), sıkıntı ekranında o ana uygun olanlardan biri, ve bildirim havuzunda birkaçı görünür. Ayarlardan kapatılabilir; "Hepsini kaynaklarıyla gör" ile tam liste açılır.

**Her metnin altında kaynağı yazılıdır** — sûre ve âyet numarası ya da hadis külliyatı, bab ve numara. Hiçbiri serbestçe yazılmadı; meal ve numaralar eklenmeden önce birden fazla bağımsız kaynakla karşılaştırıldı.

| Metin | Kaynak |
|---|---|
| "Yiyin, için, fakat israf etmeyin…" | A'râf 31 (Diyanet İşleri meali) |
| "Temiz olanlarından yiyin, taşkınlık etmeyin…" | Tâhâ 81 (Diyanet Vakfı meali) |
| "Âdemoğlu, midesinden daha kötü bir kap doldurmamıştır…" | Tirmizî, Zühd 47 (nr. 2380); İbn Mâce, Et'ime 50 (nr. 3349) |
| "İki nimet vardır ki insanların çoğu aldanmıştır: sağlık ve boş vakit." | Buhârî, Rikâk (nr. 6412) |
| "Amellerin en sevimlisi, az da olsa devamlı olanıdır." | Buhârî, Rikâk 18; Müslim, Müsâfirîn 218 |
| "Kuvvetli mü'min… daha hayırlı ve daha sevimlidir." | Müslim, Kader 34 (nr. 2664) |
| "Bedeninin senin üzerinde hakkı vardır." | Buhârî, Savm 51; Müslim, Sıyâm 182 |
| "Gerçek mücâhid, nefsiyle cihad edendir." | Tirmizî, Fedâilü'l-cihâd 2 (nr. 1621) |
| "Sabır ve namaz ile Allah'tan yardım isteyin…" | Bakara 153 (Diyanet meali) |

Metinler `js/deen.js` içinde; eklemek ya da çıkarmak isteyen aynı biçimde (metin + kaynak) yazar.

### Oyun katmanı
Ayrı bir şey girmen gerekmez — hepsi zaten tuttuğun kayıtlardan beslenir.

**Seviye ve XP.** Tartılmak +10, öğün kaydı +5, sıkıntıyı atlatmak +25, fotoğraftaki yemeği yememek +40, günü kalori hedefinin altında kapatmak +50, kilometre taşı +100. Sekiz seviye: 🥚 Çaylak → 🐣 Kararlı → 🔥 Direnişçi → 🏹 Sıkıntı Avcısı → ⚔️ Disiplinli → 🛡️ Demir İrade → 👑 Rekor Kırıcı → 🦁 Efsane.

**Günün görevleri.** Her gün havuzdan 3 tane seçilir (tarihten türetilir, gün içinde değişmez). Otomatik olanlar kendiliğinden işaretlenir ve tıklayınca seni yapılacağı ekrana götürür — bedavaya kapatamazsın. Elle olanlar ("2 litre su iç", "asansör yerine merdiven") dokunarak işaretlenir.

**Tartı serisi.** 14 günlük takvim ızgarası ve 🔥 sayacı. Zinciri kırma.

**Haftanın duvarı.** 500 puanlık bir *Can Sıkıntısı Duvarı* 🧱. Her atlattığın kriz 70, fotoğraftaki yemeği reddetmek 60, temiz gün 50, tartılmak 15 götürür. Teslim olursan 40 geri örülür. Yıkınca +150 XP, konfeti ve rozet. Duvar çatlayınca 🪨, yıkılınca 🏁 olur. Her hafta yenisi gelir.

**18 rozet.** İlk Adım, Hayır Dedim, Gece Bekçisi (22:00 sonrası atlatma), Sabah Kuşu, Yarısı Yeter, Protein Ustası, Temiz Hafta, Rekor Avcısı, Duvar Yıkıcı, Beş Duvar… Kilitliyken `🔒 ???` görünür.

Seviye atlama, rozet ve duvar yıkımında konfeti + titreşim + ödül kartı gelir. `prefers-reduced-motion` açıksa animasyonlar kapanır.

### Can sıkıntısı butonu
Yemeden önce basılır. 90 saniyelik geri sayım başlar ve rastgele bir görev verir (su iç, 20 şınav, yürü, duş al, dişini fırçala…). Sonunda "Yaptım, geçti" veya "Yine de yedim" işaretlenir. Atlatılan her kriz sayılır ve kaç kalori kurtardığın gösterilir.

### Gerçekten aç mıyım testi
Üç soru: son 3 saatte yedin mi, karnın boş mu, elma yer miydin. İkiden az "gerçek açlık" işareti çıkarsa uygulama sıkıntı ekranına yönlendirir.

### Sağlık yol haritaları
Hiçbir ölçüm istenmez — her şey kilodan hesaplanır. Dört ayrı cephe (**tansiyon**, **uyku ve horlama**, **nefes**, **eklemler ve metabolizma**), her biri 5 basamaklı. Kilo düştükçe basamaklar sırayla açılır:

> ✓ −2 kg · Yaklaşık 2 mmHg aşağı. Küçük görünür ama ölçülebilir bir düşüş.
> ✓ −5 kg · ~5 mmHg. Tuzu da kısarsan bu rahat 8-10 olur.
> ◯ **−10 kg · ~10 mmHg — düşük doz bir tansiyon ilacının yaptığı işe denk.** *3.5 kg kaldı*

Bugün ekranında da en yakın kazanım kartı durur, böylece "3.5 kg sonra ne oluyor" hep gözünün önünde.

Eşikler yayımlanmış ortalamalara dayanır: 1 kg ≈ 1 mmHg sistolik, %5 kayıp ≈ karaciğer yağının gerilemeye başladığı nokta, %7 ≈ tip 2 diyabet riskinde ciddi düşüş, %10 ≈ uyku apnesi şiddetinde ortalama dörtte bir azalma, 1 kg ≈ her adımda 4 kg diz yükü.

### Bildirimler
Dört zaman dilimi, her biri ayrı açılıp kapanır ve saati değiştirilebilir:

| Slot | Varsayılan | Ne der |
|---|---|---|
| Sabah tartısı | 08:00 | *"Tuvaletten sonra, aç karnına. 10 saniye sürer."* |
| Gün ortası | 13:00 | *"Protein aldın mı? Öğlene kadar 60 g hedefle."* |
| **Tehlike saati** | 21:00 | *"Aç değilsin, sıkılıyorsun. Butona bas, 90 saniye ver."* |
| Rastgele motivasyon | 17:00 | *"133'ten 104'e indin. Yapabilir misin sorusu çoktan cevaplandı."* |

Bildirime dokununca doğrudan ilgili ekran açılır — tehlike saati bildirimi sıkıntı ekranını, sabah bildirimi tartıyı açar.

Sunucu yok, push servisi yok; her şey cihazda üretilir. Ana ekrana kurulu Chrome'da arka planda da çalışır (`periodicSync`); diğer durumlarda uygulama açık ya da yakın zamanda kullanılmışken gelir. Ayarlar sayfası hangi modda olduğunu yazar.

### Fotoğrafla kalori

Fotoğrafı çektikten sonra **üç yöntem birden karşına çıkar**, her seferinde istediğini seçersin. Ayarlardaki tercih yalnızca hangisinin başta ve vurgulu duracağını belirler.

**📲 Telefondaki uygulama (varsayılan, ücretsiz).** Telefonundaki Claude ya da ChatGPT uygulamasını kullanır. Fotoğrafı çek → "Uygulamaya gönder" → paylaş sayfasından Claude'u seç (hazır istem fotoğrafla birlikte gider) → gelen cevabı uygulamaya yapıştır. Cevap JSON da olabilir düz metin de; *"Adana kebap, yaklaşık 650 kcal ve 35 g protein"* cümlesinden de rakamları çıkarır.

Android'de daha kısası var: uygulama bir **paylaşım hedefi** olarak kayıtlı, yani Claude'daki cevabı "İrade"ye paylaştığında sonuç doğrudan ekrana düşer.

> **Neden doğrudan bağlanmıyor?** Telefondaki Claude/ChatGPT uygulaması API değil. Abonelik (Claude Pro, ChatGPT Plus) ile API erişimi ayrı ürünler, ayrı faturalanır; bir web sayfasının o uygulamaya prompt gönderip cevabı programatik olarak alması için herhangi bir genel arayüz yok. Paylaş sayfası bu yüzden köprü: birkaç dokunuş fazla, ama sıfır ek maliyet.

**⚡ Doğrudan API.** Tek dokunuş, uygulamadan çıkmadan. Anthropic Console'dan bir anahtar gerekir; anahtar yokken bu seçeneğe basmak seni doğrudan ayarlara götürür.

**✍️ Kapalı.** Fotoğraf kaydedilir, kaloriyi elle yazarsın.

Hangi yöntem olursa olsun sonuç aynı ekranda çıkar ve üç seçenek sunar: `Yedim, ekle` · `Yarısını yedim` · `Yemedim 💪` (sonuncusu sıkıntı sayacına yazılır).

**API kullanımı zaten en aza indirilmiş durumda:**
- Elle yazdığın yemekler **84 kalemlik yerel veritabanından** bulunur — yazmaya başladığın anda kalori ve protein kendiliğinden dolar, hiçbir yere istek gitmez.
- Varsayılan model **Haiku 4.5** ($1/$5 per MTok); Sonnet 5 ($2/$10) seçilebilir.
- Fotoğraf 600 px'e küçültülür: jeton maliyeti ≈ (en × boy) / 750 olduğu için bu, 900 px'e göre maliyeti yarıya indirir.
- İstem kısa, cevap 300 jetonla sınırlı.

Ölçülen sonuç: fotoğraf başına **$0.00116** (Haiku) — yani 0.12 cent. Günde 3 fotoğraf ≈ ayda 10 cent. Sonnet ile iki katı. Ayarlar o ayki çağrı sayısını, jetonu ve tahmini tutarı gösterir.

### Koç tonu
Ayarlardan üç mod: **Sert** (suçluluk üzerinden), **Soğuk** (yalnız rakamlar), **Koç** (uyarır, alternatif sunar). Kötü günde tonu yumuşat, iyi günde sertleştir.

---

## Kurulum

### Yayına almak

**Seçenek A — GitHub Pages (otomatik).** Depoda hazır bir Actions iş akışı var (`.github/workflows/deploy.yml`). Tek seferlik bir tık gerekiyor:

> **Settings → Pages → Source: "GitHub Actions"**

Bunu iş akışının kendisi yapamıyor — `GITHUB_TOKEN` Pages sitesi oluşturma yetkisine sahip değil (`Resource not accessible by integration`). Ayar açılana kadar iş akışı kırmızıya düşmez: dosyaları kontrol eder, "Pages kapalı" uyarısı bırakır ve yeşil geçer. Ayarı açtığın anda sonraki push kendiliğinden yayına çıkar.

Not: `github-pages` ortamı varsayılan olarak yalnızca ana daldan yayına izin verebilir. Feature dalından yayınlanmıyorsa dalı `main`'e birleştir ya da ortam ayarlarından dalı ekle.

Her push'ta çalışan kontroller: tüm JS dosyalarının sözdizimi, manifest'teki simgelerin varlığı, `index.html`'in var olmayan dosyaya bakmaması, `sw.js` önbelleğinin `js/` ve `css/` altındaki her dosyayı içermesi.

**Seçenek B — kendi hostingin.** Build adımı yok: klasörün içeriğini olduğu gibi FTP'yle at, bitti. Tek şart **HTTPS** — service worker, bildirimler ve "ana ekrana ekle" yalnızca HTTPS'te çalışır.

### Telefona kurmak
1. Telefondan adresi aç.
2. **Android/Chrome:** menü → "Uygulamayı yükle". **iPhone/Safari:** paylaş → "Ana Ekrana Ekle".
3. Ayarlar → Bildirimler → aç, izni ver.

Simge ana ekrana gelir, tam ekran açılır, internet olmadan da çalışır.

### Gerçek APK istersen
PWA'yı [PWABuilder](https://www.pwabuilder.com) veya `bubblewrap` ile imzalı bir APK'ya sarabilirsin — kod değişmez, aynı `manifest.webmanifest` kullanılır.

### Fotoğraf analizini açmak
1. [console.anthropic.com](https://console.anthropic.com) → API anahtarı oluştur.
2. Uygulamada Ayarlar → Claude API anahtarı → yapıştır.

Anahtar yalnızca telefonun `localStorage`'ında durur ve sadece Anthropic'e gider. Fotoğraf analizi tarayıcıdan doğrudan API'ye gittiği için anahtar cihazda açıkta sayılır — telefonu başkasıyla paylaşıyorsan bunu bil.

---

## Veri

Her şey `localStorage`'da, anahtar `yeniden104:v1`.

- **Yedek al:** Ayarlar → "Yedeği indir (JSON)"
- **Geri yükle:** Ayarlar → "Yedekten geri yükle"

Tarayıcı verisini temizlemek uygulamayı da siler. Ayda bir yedek al.

---

## Hesaplar

- **BMI** = kg / m²
- **Bazal yakım (BMR):** Mifflin-St Jeor
- **Günlük yakım (TDEE):** BMR × hareket katsayısı
- **Önerilen kalori:** TDEE − 1000, ama BMR'ın %95'inin ve 1500 kcal'ın altına inmez
- **Protein:** hedef kilonun 1.6 katı gram (kas korumak + tokluk için)
- **Trend çizgisi:** 7 günlük hareketli ortalama
- **Hız tahmini:** son 14 günün gerçek trendi; yeterli veri yoksa 7700 kcal ≈ 1 kg yağ varsayımı

---

## Dosya yapısı

```
index.html                tüm ekranlar
css/style.css             tema ve düzen
js/data.js                sıkıntı görevleri, sorular, yemek listesi, koç cümleleri
js/store.js               localStorage katmanı
js/calc.js                BMI, TDEE, trend, tahmin, kilometre taşları
js/health.js              kilo kaybının tansiyon/uyku/nefeste açtığı kazanımlar
js/game.js                XP, seviye, rozet, günlük görev, haftalık duvar
js/deen.js                âyet ve hadisler, kaynaklarıyla birlikte
js/notify.js              bildirim izni ve zamanlama
js/notify-messages.js     bildirim metinleri (sayfa ve service worker ortak kullanır)
js/chart.js               bağımlılıksız SVG grafik
js/coach.js               tona göre cümle üretimi
js/photo.js               fotoğraf küçültme + Claude API analizi
js/app.js                 ekran çizimi ve etkileşimler
sw.js                     çevrimdışı önbellek + arka plan bildirimleri
.github/workflows/        GitHub Pages otomatik yayını
manifest.webmanifest      PWA tanımı
```

Bağımlılık yok, build adımı yok. Dosyaları düzenle, yükle, bitti.

---

## Not

Bu uygulama bir takip ve alışkanlık aracı. Kalori tahminleri — özellikle fotoğraftan gelenler — yaklaşıktır. Sağlık sayfasındaki rakamlar bilimsel ortalamalara dayalı tahminlerdir, kişisel tıbbi tavsiye değildir.

Tansiyon ilacı kullanılıyorsa kilo verirken dozun düşmesi gerekebilir; bu doktorla yapılır, kendi başına değil. Ciddi kilo verme sürecinde bir hekime danışmakta fayda var.
