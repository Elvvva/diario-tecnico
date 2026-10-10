// Service worker: guarda la app para que funcione sin conexión.
// Estrategia "red primero": si hay internet se usa la versión más nueva;
// si no, la copia guardada. Sube VERSION cuando cambies archivos y quieras forzar la actualización.
const VERSION = 'dt-v1';
const ASSETS = [
  './', 'index.html', 'manifest.json',
  'css/base.css', 'css/layout.css', 'css/components.css',
  'js/app.js', 'js/router.js', 'js/db.js', 'js/settings.js',
  'js/services/sections.js', 'js/services/clips.js', 'js/services/notes.js',
  'js/services/thumbnails.js', 'js/services/storage.js',
  'js/views/welcome.js', 'js/views/add.js', 'js/views/section.js',
  'js/views/clip.js', 'js/views/evolution.js', 'js/views/compare.js',
  'js/components/player.js', 'js/components/dialogs.js', 'js/components/chip-picker.js',
  'js/components/clip-card.js', 'js/components/section-actions.js',
  'js/utils/dom.js', 'js/utils/dates.js', 'js/utils/format.js',
  'icons/icon-192.png', 'icons/icon-512.png', 'icons/icon-maskable-512.png'
];

self.addEventListener('install', (e) => {
  e.waitUntil(caches.open(VERSION).then((c) => c.addAll(ASSETS)).then(() => self.skipWaiting()));
});

self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== VERSION).map((k) => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (e) => {
  const req = e.request;
  if (req.method !== 'GET' || new URL(req.url).origin !== location.origin) return;
  e.respondWith(
    fetch(req)
      .then((res) => {
        if (res.ok) { const copy = res.clone(); caches.open(VERSION).then((c) => c.put(req, copy)); }
        return res;
      })
      .catch(() => caches.match(req).then((r) => r || caches.match('index.html')))
  );
});
