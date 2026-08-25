/* Fotoğrafla yemek analizi — Claude API (opsiyonel) */

const Photo = {
  /* Jeton maliyeti ≈ (en × boy) / 750. 600 px kare ≈ 480 jeton;
     900 px'te bu iki katına çıkardı, isabet farkı ise ihmal edilebilir. */
  MAX_SIDE: 600,

  model() {
    return Store.data.apiModel || 'claude-haiku-4-5-20251001';
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
