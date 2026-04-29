// Service Worker для оффлайн + push
const CACHE_NAME = 'fchat-v2';
const urlsToCache = [
  '/',
  '/index.html',
  '/style.css',
  '/script.js',
  '/manifest.json'
];

// Установка Service Worker
self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then(cache => cache.addAll(urlsToCache))
      .then(() => self.skipWaiting())
  );
});

// Активация и очистка старого кэша
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

// Перехват запросов (оффлайн-режим)
self.addEventListener('fetch', event => {
  event.respondWith(
    caches.match(event.request)
      .then(response => response || fetch(event.request))
  );
});

// Push-уведомления
self.addEventListener('push', event => {
  let body = 'Новое сообщение в семейном чате!';
  
  if (event.data) {
    try {
      const data = event.data.json();
      body = data.body || body;
    } catch (e) {
      body = event.data.text() || body;
    }
  }
  
  const options = {
    body: body,
    icon: '/icon-192.png',
    badge: '/icon-192.png',
    vibrate: [200, 100, 200],
    tag: 'fchat-message',
    requireInteraction: false,
    actions: [
      { action: 'open', title: 'Открыть чат' },
      { action: 'close', title: 'Закрыть' }
    ]
  };
  
  event.waitUntil(
    self.registration.showNotification('👨‍👩‍👧‍👦 FChat', options)
  );
});

// Клик по уведомлению
self.addEventListener('notificationclick', event => {
  event.notification.close();
  
  if (event.action === 'open' || !event.action) {
    event.waitUntil(
      clients.matchAll({ type: 'window' }).then(clientList => {
        // Если чат уже открыт — фокусируемся на нём
        for (const client of clientList) {
          if (client.url.includes(self.location.origin) && 'focus' in client) {
            return client.focus();
          }
        }
        // Иначе открываем новое окно
        if (clients.openWindow) {
          return clients.openWindow('/');
        }
      })
    );
  }
});
