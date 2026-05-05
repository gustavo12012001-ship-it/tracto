// service-worker.js
// Base code for handling incoming Web Push notifications

self.addEventListener('push', function (event) {
  if (event.data) {
    let payload = { title: 'Tracto', body: 'Nova notificação do sistema.' };
    
    try {
      if (typeof event.data.json === 'function') {
        payload = event.data.json();
      } else {
        payload.body = event.data.text();
      }
    } catch (e) {
      payload.body = event.data.text();
    }

    const options = {
      body: payload.body,
      icon: '/tracto-icon.png',
      badge: '/tracto-icon.png',
      vibrate: [100, 50, 100],
      data: {
        dateOfArrival: Date.now(),
        primaryKey: 1,
        url: payload.url || '/'
      }
    };

    event.waitUntil(self.registration.showNotification(payload.title, options));
  }
});

self.addEventListener('notificationclick', function(event) {
  event.notification.close();
  const targetUrl = event.notification.data.url;
  
  event.waitUntil(
    clients.matchAll({ type: 'window' }).then(windowClients => {
      // Check if there is already a window/tab open with the target URL
      for (var i = 0; i < windowClients.length; i++) {
        var client = windowClients[i];
        if (client.url === targetUrl && 'focus' in client) {
          return client.focus();
        }
      }
      // If not, open a new window
      if (clients.openWindow) {
        return clients.openWindow(targetUrl);
      }
    })
  );
});
