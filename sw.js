// Service Worker для оффлайн + push
const CACHE_NAME = 'fchat-v3';
const urlsToCache = [
  '/family-chat/',
  '/family-chat/index.html',
  '/family-chat/style.css',
  '/family-chat/main.js',
  '/family-chat/manifest.json'
];

self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then(cache => cache.addAll(urlsToCache))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys().then(cacheNames => {
      return Promise.all(
        cacheNames
          .filter(name => name !== CACHE_NAME)
          .map(name => caches.delete(name))
      );
    })
  );
});

self.addEventListener('fetch', event => {
  event.respondWith(
    caches.match(event.request)
      .then(response => response || fetch(event.request))
  );
});

self.addEventListener('push', event => {
  let body = 'Новое сообщение!';
  if (event.data) {
    try {
      const data = event.data.json();
      body = data.body || body;
    } catch(e) {
      body = event.data.text() || body;
    }
  }
  
  const options = {
    body: body,
    icon: '/family-chat/icon-192.png',
    badge: '/family-chat/icon-192.png',
    vibrate: [200, 100, 200],
    tag: 'fchat',
    actions: [{ action: 'open', title: 'Открыть' }]
  };
  
  event.waitUntil(self.registration.showNotification('👨‍👩‍👧‍👦 FChat', options));
});

self.addEventListener('notificationclick', event => {
  event.notification.close();
  event.waitUntil(clients.openWindow('/family-chat/'));
});
