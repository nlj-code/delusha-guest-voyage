// Delusha service worker: works offline and shows phone notifications.
const VERSION = 'delusha-v6';
const SHELL = [
  './',
  './index.html',
  './styles.css',
  './manifest.webmanifest',
  './icon.svg',
  './icon-192.png',
  './icon-512.png',
  './vendor/supabase-2.45.4.js',
  './vendor/qrcode-1.4.4.js',
  './coastline-data.js',
  './voyage-data.js',
  './router-worker.js',
  './js/config.js',
  './js/util.js',
  './js/store.js',
  './js/session.js',
  './js/map.js',
  './js/uploads.js',
  './js/push.js',
  './js/weather.js',
  './js/position.js',
  './js/main.js',
  './js/views/ui.js',
  './js/views/welcome.js',
  './js/views/login.js',
  './js/views/today.js',
  './js/views/voyage.js',
  './js/views/photos.js',
  './js/views/dining.js',
  './js/views/aboard.js',
  './js/views/safety.js',
  './js/views/alerts.js',
  './js/views/prefs.js',
  './js/views/requests.js',
  './js/views/host.js',
  './js/views/crew.js',
  './js/views/tv.js',
  './js/views/addstop.js',
  './Delusha%20Beauty%20Shots/IMG-20250617-WA0015.jpg',
  './Delusha%20Beauty%20Shots/IMG-20250617-WA0013.jpg',
  './Delusha%20Beauty%20Shots/IMG-20250617-WA0018.jpg'
];

self.addEventListener('install', (event) => {
  event.waitUntil(caches.open(VERSION).then((c) => c.addAll(SHELL)).then(() => self.skipWaiting()));
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== VERSION).map((k) => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (event) => {
  const req = event.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);

  // App files: network first so updates arrive, cache when offline.
  if (url.origin === self.location.origin) {
    event.respondWith(
      fetch(req)
        .then((res) => {
          if (res.ok) {
            const copy = res.clone();
            caches.open(VERSION).then((c) => c.put(req, copy));
          }
          return res;
        })
        .catch(() => caches.match(req, { ignoreSearch: true }).then((r) => r || caches.match('./index.html')))
    );
    return;
  }

  // Fonts: cache first.
  if (url.hostname.endsWith('fonts.googleapis.com') || url.hostname.endsWith('fonts.gstatic.com')) {
    event.respondWith(
      caches.match(req).then(
        (hit) =>
          hit ||
          fetch(req).then((res) => {
            const copy = res.clone();
            caches.open(VERSION).then((c) => c.put(req, copy));
            return res;
          })
      )
    );
    return;
  }

  // Shared photo thumbnails (signed URLs change, so key on the file path).
  if (url.pathname.includes('/storage/v1/object/sign/media/') && /_t\.jpg$/.test(url.pathname)) {
    const key = new Request(url.origin + url.pathname);
    event.respondWith(
      caches.open(`${VERSION}-thumbs`).then((c) =>
        fetch(req)
          .then((res) => {
            if (res.ok) c.put(key, res.clone());
            return res;
          })
          .catch(() => c.match(key))
      )
    );
  }
});

self.addEventListener('push', (event) => {
  let data = {};
  try {
    data = event.data ? event.data.json() : {};
  } catch {
    data = { title: 'Delusha', body: event.data?.text() || '' };
  }
  event.waitUntil(
    self.registration.showNotification(data.title || 'Delusha', {
      body: data.body || '',
      icon: './icon-192.png',
      badge: './icon-192.png',
      tag: data.tag,
      data: { url: data.url || './#/today' }
    })
  );
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const target = event.notification.data?.url || './#/today';
  event.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((wins) => {
      for (const w of wins) {
        if ('focus' in w) {
          w.postMessage({ type: 'open', url: target.replace(/^\.\//, '') });
          return w.focus();
        }
      }
      return self.clients.openWindow(target);
    })
  );
});
