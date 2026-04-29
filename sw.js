// Service Worker для оффлайн + push
const CACHE_NAME = 'fchat-v1';
const urlsToCache = [
  '/', 'styles.css', 'config.js', 'auth.js', 'ui.js', 
  'messaging.js', 'main.js', 'manifest.json'
];

self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then(cache => cache.addAll(urlsToCache))
  );
});

self.addEventListener('fetch', event => {
  event.respondWith(
    caches.match(event.request)
      .then(response => response || fetch(event.request))
  );
});

// PUSH уведомления
self.addEventListener('push', event => {
  const options = {
    body: event.data ? event.data.text() : 'Новое сообщение!',
    icon: '/icon-192.png',
    badge: '/icon-192.png',
    vibrate: [100, 50, 100],
    data: { date: Date.now() },
    actions: [
      { action: 'open', title: 'Открыть чат' },
      { action: 'close', title: 'Закрыть' }
    ]
  };
  event.waitUntil(
    self.registration.showNotification('FChat', options)
  );
});

self.addEventListener('notificationclick', event => {
  event.notification.close();
  if (event.action === 'open') {
    event.waitUntil(
      clients.openWindow('/')
    );
  }
});
