// Service worker do Navo. Mantém o PWA instalável e trata notificações push administrativas.
self.addEventListener('install', () => {
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(self.clients.claim());
});

// Passthrough: toda leitura e gravação continua ocorrendo pela API e pelo banco.
self.addEventListener('fetch', (event) => {
  event.respondWith(fetch(event.request));
});

self.addEventListener('push', (event) => {
  let payload = {
    title: 'Navo Administrativo',
    body: 'Há uma nova atualização na operação.',
    tag: 'navo-admin-operation',
    url: '/admin',
  };

  try {
    if (event.data) payload = { ...payload, ...event.data.json() };
  } catch {
    // Mantém o texto padrão se o payload não for JSON válido.
  }

  event.waitUntil(self.registration.showNotification(payload.title, {
    body: payload.body,
    icon: '/pwa-admin-192x192.svg',
    badge: '/pwa-admin-192x192.svg',
    tag: payload.tag,
    data: { url: payload.url || '/admin' },
  }));
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const targetUrl = new URL(event.notification.data?.url || '/admin', self.location.origin).href;

  event.waitUntil(self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clientList) => {
    for (const client of clientList) {
      if (new URL(client.url).origin === self.location.origin && 'focus' in client) {
        return client.navigate(targetUrl).then(() => client.focus());
      }
    }
    if (self.clients.openWindow) return self.clients.openWindow(targetUrl);
    return undefined;
  }));
});
