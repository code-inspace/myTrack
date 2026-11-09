// Ce service worker ne sert qu'aux notifications. Il ne met RIEN en cache :
// l'ancienne version servait les pages en cache-first à vie, ce qui figeait la
// PWA sur une vieille version (ou une page supprimée) sans jamais se mettre à jour.

self.addEventListener("install", () => {
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    // Purge tous les anciens caches (v1 et suivants) laissés par l'ancienne version.
    caches
      .keys()
      .then((keys) => Promise.all(keys.map((key) => caches.delete(key))))
      .then(() => self.clients.claim())
  );
});

// Interactive push notification clicks
self.addEventListener("notificationclick", (event) => {
  event.notification.close();

  const action = event.action;
  const taskId = event.notification.data?.taskId;

  event.waitUntil(
    clients.matchAll({ type: "window", includeUncontrolled: true }).then((clientList) => {
      for (const client of clientList) {
        if (client.url.includes("/tasks") && "focus" in client) {
          client.postMessage({ type: "NOTIFICATION_ACTION", action, taskId });
          return client.focus();
        }
      }
      if (clients.openWindow) {
        return clients.openWindow(`/tasks?notifAction=${action}&taskId=${taskId || ""}`);
      }
    })
  );
});
