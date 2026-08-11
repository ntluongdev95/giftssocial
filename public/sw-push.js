// Service Worker — push notifications only.
//
// next-pwa is currently disabled in next.config (Turbopack incompat) so
// this is the only SW the site registers. It's intentionally tiny: no
// caching, no fetch handler — just push + notificationclick.
//
// Registered at scope '/' from PushPermissionButton. Push events fire
// independent of scope so a sub-scope would also work, but root keeps
// the openWindow() call cleaner.

self.addEventListener('install', (event) => {
  // Activate immediately on first install so the very first reminder push
  // doesn't have to wait until a tab refresh.
  event.waitUntil(self.skipWaiting());
});

self.addEventListener('activate', (event) => {
  event.waitUntil(self.clients.claim());
});

self.addEventListener('push', (event) => {
  let payload = { title: 'Gao Streak Reminder', body: 'Tap to open the app' };
  if (event.data) {
    try { payload = event.data.json(); }
    catch { try { payload = { ...payload, body: event.data.text() }; } catch {} }
  }
  const {
    title = 'Gao Streak Reminder',
    body = '',
    icon = '/icons/icon-192.png',
    badge = '/icons/badge-72.png',
    tag,
    data,
  } = payload;

  event.waitUntil(
    self.registration.showNotification(title, {
      body,
      icon,
      badge,
      tag,                // collapses duplicates (e.g. same streak)
      renotify: true,     // still vibrate when a duplicate-tag updates
      data,               // forwarded to click handler
    }),
  );
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const url = (event.notification.data && event.notification.data.url) || '/streaks';

  event.waitUntil((async () => {
    const clientList = await self.clients.matchAll({ type: 'window', includeUncontrolled: true });
    // If a Gao tab is already open, focus it and navigate.
    for (const client of clientList) {
      if ('focus' in client) {
        try {
          await client.focus();
          if ('navigate' in client) await client.navigate(url);
          return;
        } catch { /* fall through to openWindow */ }
      }
    }
    if (self.clients.openWindow) await self.clients.openWindow(url);
  })());
});
