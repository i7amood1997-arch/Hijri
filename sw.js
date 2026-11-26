// Service worker: يخزّن ملفات التطبيق ليعمل بدون إنترنت.
// غيّر رقم النسخة عند أي تعديل على الملفات.
const CACHE = 'hadi-v6';
const FILES = [
  './', 'index.html', 'css/style.css',
  'js/hijri.js', 'js/prayer.js', 'js/calendar-data.js', 'js/events.js', 'js/app.js',
  'fonts/vazirmatn-arabic-wght-normal.woff2', 'fonts/vazirmatn-latin-wght-normal.woff2',
  'manifest.webmanifest', 'icons/icon.svg', 'icons/icon-192.png', 'icons/icon-512.png', 'icons/apple-touch-icon.png'
];

self.addEventListener('install', function (e) {
  e.waitUntil(caches.open(CACHE).then(function (c) { return c.addAll(FILES); }).then(function () { return self.skipWaiting(); }));
});

self.addEventListener('activate', function (e) {
  e.waitUntil(
    caches.keys().then(function (keys) {
      return Promise.all(keys.filter(function (k) { return k !== CACHE; }).map(function (k) { return caches.delete(k); }));
    }).then(function () { return self.clients.claim(); })
  );
});

// الشبكة أولاً (لتصل التحديثات)، وعند انقطاع الإنترنت نستخدم النسخة المخزّنة.
self.addEventListener('fetch', function (e) {
  if (e.request.method !== 'GET') return;
  e.respondWith(
    fetch(e.request).then(function (res) {
      const copy = res.clone();
      caches.open(CACHE).then(function (c) { c.put(e.request, copy); });
      return res;
    }).catch(function () { return caches.match(e.request).then(function (r) { return r || caches.match('index.html'); }); })
  );
});
