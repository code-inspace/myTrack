const CACHE_NAME = "mytrack-cache-v1";
const STATIC_ASSETS = [
  "/",
  "/tasks",
  "/dashboard",
  "/chat",
  "/profile",
  "/manifest.json",
];

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      return cache.addAll(STATIC_ASSETS);
    })
  );
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys().then((keys) => {
      return Promise.all(
        keys.map((key) => {
          if (key !== CACHE_NAME) {
            return caches.delete(key);
          }
        })
      );
    })
  );
  self.clients.claim();
});

self.addEventListener("fetch", (event) => {
  if (event.request.method !== "GET") return;

  event.respondWith(
    caches.match(event.request).then((cachedResponse) => {
      if (cachedResponse) {
        return cachedResponse;
      }
      return fetch(event.request).catch(() => {
        // Return offline fallback if navigating
        if (event.request.mode === "navigate") {
          return caches.match("/tasks");
        }
      });
    })
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
