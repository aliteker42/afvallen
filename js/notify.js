/* Bildirimler — sunucu yok, her şey cihazda.
   Kurulu PWA + Chrome'da arka planda da çalışır (periodic sync),
   diğer durumlarda uygulama açıkken zamanlanır. */

const Notify = {
  SLOTS: [
    { id: 'sabah',      label: 'Sabah tartısı',   def: '08:00' },
    { id: 'ogle',       label: 'Gün ortası',      def: '13:00' },
    { id: 'tehlike',    label: 'Tehlike saati',   def: '21:00' },
    { id: 'motivasyon', label: 'Rastgele motivasyon', def: '17:00' }
  ],

  timers: [],

  supported() {
    return 'Notification' in window && 'serviceWorker' in navigator;
  },

  permission() {
    return this.supported() ? Notification.permission : 'unsupported';
  },

  async request() {
    if (!this.supported()) return 'unsupported';
    const p = await Notification.requestPermission();
    if (p === 'granted') {
      await this.registerBackground();
      this.schedule();
    }
    return p;
  },

  /* Chrome + kurulu PWA'da arka plan tetikleyicisi */
  async registerBackground() {
    try {
      const reg = await navigator.serviceWorker.ready;
      if (!('periodicSync' in reg)) return false;
      const st = await navigator.permissions.query({ name: 'periodic-background-sync' });
      if (st.state !== 'granted') return false;
      await reg.periodicSync.register('motivate', { minInterval: 4 * 60 * 60 * 1000 });
      return true;
    } catch (e) {
      return false;
    }
  },

  async backgroundActive() {
    try {
      const reg = await navigator.serviceWorker.ready;
      if (!('periodicSync' in reg)) return false;
      const tags = await reg.periodicSync.getTags();
      return tags.includes('motivate');
    } catch (e) {
      return false;
    }
  },

  /* Uygulama açıkken günün kalan slotlarını zamanla */
  schedule() {
    this.timers.forEach(clearTimeout);
    this.timers = [];
    const cfg = Store.data.notify;
    if (!cfg.enabled || this.permission() !== 'granted') return;

    const now = new Date();
    this.SLOTS.forEach(slot => {
      if (!cfg.slots[slot.id]) return;
      const [h, m] = (cfg.times[slot.id] || slot.def).split(':').map(Number);
      const at = new Date(now);
      at.setHours(h, m, 0, 0);
      const delay = at - now;
      // sadece bugünün kalan slotları, en fazla 12 saat ileri
      if (delay > 1000 && delay < 12 * 3600 * 1000) {
        this.timers.push(setTimeout(() => this.fire(slot.id), delay));
      }
    });
  },

  async fire(slot) {
    if (this.permission() !== 'granted') return;
    // aynı slot bugün zaten gönderildiyse tekrarlama
    const key = today() + ':' + slot;
    if (Store.data.notify.sent.includes(key)) return;
    Store.data.notify.sent = Store.data.notify.sent.slice(-20).concat(key);
    Store.save();

    const msg = pickNotify(slot);
    try {
      const reg = await navigator.serviceWorker.ready;
      await reg.showNotification(msg.t, {
        body: msg.b,
        icon: 'icons/icon-192.png',
        badge: 'icons/icon-192.png',
        tag: 'yeniden104-' + slot,
        renotify: false,
        data: { slot }
      });
    } catch (e) {
      new Notification(msg.t, { body: msg.b, icon: 'icons/icon-192.png' });
    }
  },

  /* Ayarlardan test */
  async test() {
    if (this.permission() !== 'granted') {
      const p = await this.request();
      if (p !== 'granted') return false;
    }
    const msg = pickNotify('motivasyon');
    const reg = await navigator.serviceWorker.ready;
    await reg.showNotification(msg.t, {
      body: msg.b, icon: 'icons/icon-192.png', tag: 'yeniden104-test'
    });
    return true;
  }
};
