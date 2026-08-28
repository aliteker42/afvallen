/* Fotoğrafla yemek analizi — Claude API (opsiyonel) */

const Photo = {
  /* Jeton maliyeti ≈ (en × boy) / 750. 600 px kare ≈ 480 jeton;
     900 px'te bu iki katına çıkardı, isabet farkı ise ihmal edilebilir. */
  MAX_SIDE: 600,

  model() {
    return Store.data.apiModel || 'claude-haiku-4-5';
  },

  mode() {
    return Store.data.analyzeMode || 'app';
  },

  /* Fotoğrafı küçült: hem depolama hem jeton maliyeti için */
  async shrink(file, maxSide, quality) {
    maxSide = maxSide || this.MAX_SIDE;
    quality = quality || 0.7;
    const dataUrl = await new Promise((res, rej) => {
      const r = new FileReader();
      r.onload = () => res(r.result);
      r.onerror = () => rej(new Error('Dosya okunamadı'));
      r.readAsDataURL(file);
    });
    const img = await new Promise((res, rej) => {
      const i = new Image();
      i.onload = () => res(i);
      i.onerror = () => rej(new Error('Görsel açılamadı'));
      i.src = dataUrl;
    });
    const scale = Math.min(1, maxSide / Math.max(img.width, img.height));
    const c = document.createElement('canvas');
    c.width = Math.round(img.width * scale);
    c.height = Math.round(img.height * scale);
    c.getContext('2d').drawImage(img, 0, 0, c.width, c.height);
    return c.toDataURL('image/jpeg', quality);
  },

  /* Küçük küçük thumbnail — listede saklamak için */
  async thumb(dataUrl) {
    const img = await new Promise(res => { const i = new Image(); i.onload = () => res(i); i.src = dataUrl; });
    const side = 160;
    const scale = Math.min(1, side / Math.max(img.width, img.height));
    const c = document.createElement('canvas');
    c.width = Math.round(img.width * scale);
    c.height = Math.round(img.height * scale);
    c.getContext('2d').drawImage(img, 0, 0, c.width, c.height);
    return c.toDataURL('image/jpeg', 0.6);
  },

  hasKey() {
    return !!(Store.data.apiKey && Store.data.apiKey.trim());
  },

  buildPrompt() {
    const p = Store.data.profile;
    const kg = Store.currentKg();
    const t = Store.data.targets;
    const eaten = Store.dayTotals().kcal;
    return `Türk mutfağı. Porsiyonu tabak oranından tahmin et. Bugün ${eaten}/${t.kcal} kcal alındı.
Sadece JSON döndür:
{"name":"yemek adı","items":["bileşen (g)"],"kcal":0,"protein":0,"confidence":"dusuk|orta|yuksek","note":"tek cümle"}`;
  },

  /* Telefondaki Claude/ChatGPT uygulamasına gönderilecek, kendi başına
     anlaşılır istem. API'den farklı olarak bağlam burada açıkça yazılır. */
  sharePrompt() {
    const t = Store.data.targets;
    const eaten = Store.dayTotals().kcal;
    return `Bu fotoğraftaki yemeği analiz et. Türk mutfağı, porsiyonu tabak oranından tahmin et.
Bugün ${eaten}/${t.kcal} kcal aldım.

Cevabı sadece şu JSON olarak ver:
{"name":"yemek adı","kcal":0,"protein":0,"note":"tek cümle porsiyon notu"}`;
  },

  async dataUrlToFile(dataUrl, name) {
    const blob = await (await fetch(dataUrl)).blob();
    return new File([blob], name || 'yemek.jpg', { type: 'image/jpeg' });
  },

  /* Paylaş sayfasını aç — kullanıcı Claude ya da ChatGPT uygulamasını seçer */
  async shareToApp(dataUrl) {
    const text = this.sharePrompt();
    let file = null;
    try { file = await this.dataUrlToFile(dataUrl); } catch (e) {}

    if (navigator.share) {
      try {
        if (file && navigator.canShare && navigator.canShare({ files: [file] })) {
          await navigator.share({ files: [file], text });
          return 'shared';
        }
        await navigator.share({ text });
        return 'shared-text';
      } catch (e) {
        if (e && e.name === 'AbortError') return 'cancelled';
      }
    }
    // Paylaşım yoksa en azından istemi panoya koy
    try {
      await navigator.clipboard.writeText(text);
      return 'copied';
    } catch (e) {
      return 'unsupported';
    }
  },

  /* Claude/ChatGPT cevabını serbest metinden de okuyabilen ayrıştırıcı */
  parseAnswer(text) {
    if (!text || !text.trim()) return null;

    // Önce JSON dene
    const j = text.match(/\{[\s\S]*?\}/);
    if (j) {
      try {
        const o = JSON.parse(j[0]);
        if (o.kcal !== undefined || o.calories !== undefined) {
          return {
            name: o.name || o.yemek || 'Yemek',
            kcal: Math.round(+(o.kcal ?? o.calories) || 0),
            protein: Math.round(+(o.protein || 0)),
            note: o.note || ''
          };
        }
      } catch (e) { /* düz metne düş */ }
    }

    // Düz metin: "650 kcal", "kalori: 650", "protein 35 g"
    const norm = text.replace(/\./g, '').toLocaleLowerCase('tr');
    const kcalM = norm.match(/(\d{2,5})\s*(?:kcal|kalori|cal\b)/) ||
                  norm.match(/(?:kcal|kalori)\s*[:=]?\s*(\d{2,5})/);
    if (!kcalM) return null;
    const protM = norm.match(/(\d{1,3})\s*g(?:r|ram)?\s*protein/) ||
                  norm.match(/protein\s*[:=]?\s*(\d{1,3})/);

    // İlk satır genelde yemeğin adı olur — ama rakam/kalori cümlesiyse ad sayma
    const firstLine = text.trim().split('\n')[0].slice(0, 60).replace(/[*#:]/g, '').trim();
    const looksLikeName = firstLine &&
      !/^\d/.test(firstLine) &&
      !/\d{2,5}\s*(kcal|kalori)/i.test(firstLine) &&
      firstLine.length <= 45;

    return {
      name: looksLikeName ? firstLine : 'Yemek',
      kcal: parseInt(kcalM[1], 10),
      protein: protM ? parseInt(protM[1], 10) : 0,
      note: ''
    };
  },

  async analyze(dataUrl) {
    const key = Store.data.apiKey.trim();
    const base64 = dataUrl.split(',')[1];

    const res = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        'x-api-key': key,
        'anthropic-version': '2023-06-01',
        'anthropic-dangerous-direct-browser-access': 'true'
      },
      body: JSON.stringify({
        model: this.model(),
        max_tokens: 300,
        messages: [{
          role: 'user',
          content: [
            { type: 'image', source: { type: 'base64', media_type: 'image/jpeg', data: base64 } },
            { type: 'text', text: this.buildPrompt() }
          ]
        }]
      })
    });

    if (!res.ok) {
      let detail = '';
      try { detail = (await res.json()).error?.message || ''; } catch (e) {}
      if (res.status === 401) throw new Error('API anahtarı geçersiz. Ayarlar\'dan kontrol et.');
      if (res.status === 429) throw new Error('Çok fazla istek. Biraz bekle.');
      throw new Error(`Analiz başarısız (${res.status}). ${detail}`);
    }

    const json = await res.json();
    if (json.usage) Store.trackApi(json.usage.input_tokens, json.usage.output_tokens);
    const text = (json.content || []).filter(c => c.type === 'text').map(c => c.text).join('');
    return this.parse(text);
  },

  parse(text) {
    const m = text.match(/\{[\s\S]*\}/);
    if (!m) throw new Error('Cevap anlaşılamadı');
    const o = JSON.parse(m[0]);
    return {
      name: o.name || 'Yemek',
      items: Array.isArray(o.items) ? o.items : [],
      kcal: Math.max(0, Math.round(+o.kcal || 0)),
      protein: Math.max(0, Math.round(+o.protein || 0)),
      confidence: o.confidence || 'orta',
      note: o.note || ''
    };
  }
};
