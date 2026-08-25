/* Çevrimdışı önbellek + arka plan bildirimleri */
importScripts('./js/notify-messages.js');

const CACHE = 'yeniden104-v5';
const ASSETS = [
  './',
  './index.html',
  './manifest.webmanifest',
  './css/style.css',
  './js/data.js',
  './js/store.js',
  './js/calc.js',
  './js/health.js',
  './js/chart.js',
  './js/coach.js',
  './js/photo.js',
  './js/notify-messages.js',
  './js/notify.js',
  './js/app.js',
  './icons/icon-192.png',
  './icons/icon-512.png'
];

self.addEventListener('install', e => {
  e.waitUntil(
    caches.open(CACHE).then(c => c.addAll(ASSETS)).then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', e => {
  e.waitUntil(
    caches.keys()
      .then(keys => Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', e => {
  const req = e.request;
  if (req.method !== 'GET') return;
  if (!req.url.startsWith(self.location.origin)) return;   // API çağrıları önbelleğe girmesin

  e.respondWith(
    caches.match(req).then(hit => {
      const net = fetch(req).then(res => {
        if (res && res.status === 200) {
          const copy = res.clone();
          caches.open(CACHE).then(c => c.put(req, copy));
        }
        return res;
      }).catch(() => hit);
      return hit || net;
    })
  );
});

/* --- bildirimler --- */

function slotForHour(h) {
  if (h >= 5 && h < 11) return 'sabah';
  if (h >= 11 && h < 15) return 'ogle';
  if (h >= 19 && h < 24) return 'tehlike';
  return 'motivasyon';
}

function dayKey() {
  const d = new Date();
  const p = n => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
}

async function notifyNow(slot) {
  const msg = pickNotify(slot);
  // aynı slot aynı gün ikinci kez gösterilmesin
  const tag = `yeniden104-${slot}-${dayKey()}`;
  const existing = await self.registration.getNotifications({ tag });
  if (existing.length) return;
  return self.registration.showNotification(msg.t, {
    body: msg.b,
    icon: './icons/icon-192.png',
    badge: './icons/icon-192.png',
    tag,
    data: { slot }
  });
}

self.addEventListener('periodicsync', e => {
  if (e.tag !== 'motivate') return;
  e.waitUntil(notifyNow(slotForHour(new Date().getHours())));
});

self.addEventListener('message', e => {
  if (e.data && e.data.type === 'notify') {
    e.waitUntil(notifyNow(e.data.slot || 'motivasyon'));
  }
});

self.addEventListener('notificationclick', e => {
  e.notification.close();
  const slot = e.notification.data && e.notification.data.slot;
  // tehlike saatinde doğrudan sıkıntı ekranına düş
  const url = slot === 'tehlike' ? './index.html#sikinti'
            : slot === 'sabah'   ? './index.html#tarti'
            : './index.html';
  e.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then(list => {
      for (const c of list) {
        if (c.url.includes(self.location.origin)) {
          c.postMessage({ type: 'open', slot });
          return c.focus();
        }
      }
      return self.clients.openWindow(url);
    })
  );
});
