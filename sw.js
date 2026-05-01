// Service Worker для оффлайн + push
const CACHE_NAME = 'fchat-v6';
const urlsToCache = [
  '/family-chat/',
  '/family-chat/index.html',
  '/family-chat/style.css',
  '/family-chat/main.js',
  '/family-chat/manifest.json',
  '/family-chat/icon-192.png'
];

// Установка
self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE_NAME).then(cache => cache.addAll(urlsToCache)).then(() => self.skipWaiting())
  );
});

// Активация
self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys().then(names => Promise.all(names.filter(n => n !== CACHE_NAME).map(n => caches.delete(n)))).then(() => self.clients.claim())
  );
});

// Оффлайн
self.addEventListener('fetch', event => {
  event.respondWith(caches.match(event.request).then(r => r || fetch(event.request)));
});

// Push-уведомления
self.addEventListener('push', event => {
  let data = { title: 'FChat', body: 'Новое сообщение', icon: '/family-chat/icon-192.png' };
  
  if (event.data) {
    try { data = event.data.json(); } catch(e) { data.body = event.data.text(); }
  }
  
  const options = {
    body: data.body,
    icon: data.icon || '/family-chat/icon-192.png',
    badge: '/family-chat/icon-192.png',
    vibrate: [200, 100, 200, 100, 200],
    tag: 'fchat-msg',
    renotify: true,
    requireInteraction: false,
    actions: [
      { action: 'open', title: 'Открыть чат' },
      { action: 'close', title: 'Закрыть' }
    ],
    data: { url: '/family-chat/' }
  };
  
  event.waitUntil(self.registration.showNotification(data.title, options));
});

// Клик по уведомлению
self.addEventListener('notificationclick', event => {
  event.notification.close();
  if (event.action === 'open' || !event.action) {
    event.waitUntil(clients.matchAll({ type: 'window' }).then(clientList => {
      for (const client of clientList) {
        if (client.url.includes('/family-chat/') && 'focus' in client) return client.focus();
      }
      return clients.openWindow('/family-chat/');
    }));
  }
});
