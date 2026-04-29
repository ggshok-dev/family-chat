const CACHE_NAME = 'fchat-v1';
const urlsToCache = [
  '/family-chat/',
  '/family-chat/index.html'
];

self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE_NAME).then(cache => cache.addAll(urlsToCache))
  );
});

self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys().then(cacheNames => {
      return Promise.all(
        cacheNames.filter(name => name !== CACHE_NAME).map(name => caches.delete(name))
      );
    })
  );
});

self.addEventListener('fetch', event => {
  event.respondWith(
    caches.match(event.request).then(response => response || fetch(event.request))
  );
});

self.addEventListener('push', event => {
  const data = event.data ? event.data.json() : {};
  const options = {
    body: data.body || 'Новое сообщение',
    icon: '/family-chat/icon-192.png',
    badge: '/family-chat/icon-192.png',
    vibrate: [200, 100, 200],
    tag: 'fchat-message',
    requireInteraction: false
  };
  event.waitUntil(self.registration.showNotification(data.title || 'FChat', options));
});

self.addEventListener('notificationclick', event => {
  event.notification.close();
  event.waitUntil(
    clients.matchAll({ type: 'window' }).then(clientList => {
      for (const client of clientList) {
        if (client.url.includes('/family-chat/') && 'focus' in client) {
          return client.focus();
        }
      }
      if (clients.openWindow) return clients.openWindow('/family-chat/');
    })
  );
});
