/* Fotoğrafla yemek analizi — Claude API (opsiyonel) */

const Photo = {
  MODEL: 'claude-sonnet-5',

  /* Fotoğrafı küçült: hem depolama hem yükleme hızı için */
  async shrink(file, maxSide, quality) {
    maxSide = maxSide || 900;
    quality = quality || 0.75;
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
    return `Bu fotoğraftaki yemeği analiz et. Kullanıcı ${p.age} yaşında, ${p.heightCm} cm, ${kg} kg, günlük kalori hedefi ${t.kcal} kcal ve bugün şu ana kadar ${eaten} kcal almış.

Porsiyon büyüklüğünü fotoğraftaki tabak/kap oranından tahmin et. Türk mutfağı ağırlıklı düşün.

SADECE şu JSON'u döndür, başka hiçbir şey yazma:
{"name":"kısa yemek adı","items":["bileşen (tahmini gram)"],"kcal":sayı,"protein":sayı,"confidence":"dusuk|orta|yuksek","note":"tek cümlelik porsiyon/tahmin notu"}`;
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
        model: this.MODEL,
        max_tokens: 500,
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
