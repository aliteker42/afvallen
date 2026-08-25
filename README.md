# Yeniden 104

Kişisel kilo takip uygulaması. Tek amacı var: **can sıkıntısından yemeyi durdurmak** ve kiloyu tekrar aşağı çekmek.

Çevrimdışı çalışan bir PWA. Sunucu yok, hesap yok, veriler telefondan çıkmıyor.

---

## Ekranlar

| Ekran | Ne yapar |
|---|---|
| **Bugün** | Güncel kilo, BMI, hedefe kalan, günün kalorisi/proteini, sıradaki kilometre taşı, koç cümlesi |
| **Tartı** | Kilo girişi, trend grafiği (7 günlük ortalama — günlük su dalgalanmasını süzer), 7/30 gün değişimi, kilometre taşları, geçmiş |
| **Yemek** | Fotoğrafla veya elle öğün ekleme, hazır Türk yemekleri listesi, günlük toplam |
| **Sıkıntı** | `CANIM SIKILIYOR` butonu, 90 saniyelik görev, "gerçekten aç mıyım" testi, atlatma sayacı |
| **Sağlık** | Tansiyon, uyku ve nefeste kilo düştükçe ne kazanıldığını gösteren yol haritaları |
| **Ayarlar** | Profil, hedefler, koç tonu, API anahtarı, yedekleme (⚙ simgesinden açılır) |

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

### Fotoğrafla kalori
Yemeğin fotoğrafını çek → Claude görüntüyü analiz eder → porsiyon tahmini, kalori, protein ve **somut sonuç cümlesi** döner. Sonra üç seçenek: `Yedim, ekle` · `Yarısını yedim` · `Yemedim 💪`.

Anahtar yoksa fotoğraf yine kaydedilir, kaloriyi elle yazarsın.

### Koç tonu
Ayarlardan üç mod: **Sert** (suçluluk üzerinden), **Soğuk** (yalnız rakamlar), **Koç** (uyarır, alternatif sunar). Kötü günde tonu yumuşat, iyi günde sertleştir.

---

## Kurulum

### Telefona kurmak
1. Dosyaları herhangi bir HTTPS sunucusuna at (kendi hostingin yeterli — build adımı yok, olduğu gibi yükle).
2. Telefondan adresi aç.
3. **Android/Chrome:** menü → "Uygulamayı yükle". **iPhone/Safari:** paylaş → "Ana Ekrana Ekle".

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
js/chart.js               bağımlılıksız SVG grafik
js/coach.js               tona göre cümle üretimi
js/photo.js               fotoğraf küçültme + Claude API analizi
js/app.js                 ekran çizimi ve etkileşimler
sw.js                     çevrimdışı önbellek
manifest.webmanifest      PWA tanımı
```

Bağımlılık yok, build adımı yok. Dosyaları düzenle, yükle, bitti.

---

## Not

Bu uygulama bir takip ve alışkanlık aracı. Kalori tahminleri — özellikle fotoğraftan gelenler — yaklaşıktır. Sağlık sayfasındaki rakamlar bilimsel ortalamalara dayalı tahminlerdir, kişisel tıbbi tavsiye değildir.

Tansiyon ilacı kullanılıyorsa kilo verirken dozun düşmesi gerekebilir; bu doktorla yapılır, kendi başına değil. Ciddi kilo verme sürecinde bir hekime danışmakta fayda var.
