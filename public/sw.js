// AeroDrop PWA Service Worker (v1.0)
const CACHE_NAME = "aerodrop-cache-v1";
const STATIC_ASSETS = [
  "/",
  "/dashboard",
  "/icon.svg",
  "/icons/icon-192.svg",
  "/icons/icon-512.svg",
];

// Install: Cache essential shell
self.addEventListener("install", (event) => {
  event.waitUntil(
    caches
      .open(CACHE_NAME)
      .then((cache) => cache.addAll(STATIC_ASSETS))
      .then(() => self.skipWaiting()),
  );
});

// Activate: Clean up old caches & take control immediately
self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) =>
        Promise.all(
          keys.filter((key) => key !== CACHE_NAME).map((key) => caches.delete(key)),
        ),
      )
      .then(() => self.clients.claim()),
  );
});

// Fetch: Network-first with offline cache fallback
self.addEventListener("fetch", (event) => {
  if (event.request.method !== "GET") return;

  const url = new URL(event.request.url);

  // Skip caching for auth/api routes and external APIs
  if (
    url.pathname.startsWith("/api/") ||
    url.pathname.startsWith("/auth/") ||
    url.origin !== self.location.origin
  ) {
    return;
  }

  event.respondWith(
    fetch(event.request)
      .then((response) => {
        if (response && response.status === 200) {
          const responseToCache = response.clone();
          caches.open(CACHE_NAME).then((cache) => {
            cache.put(event.request, responseToCache);
          });
        }
        return response;
      })
      .catch(() => caches.match(event.request)),
  );
});

// Web Push: Display native OS / browser notification
self.addEventListener("push", (event) => {
  let data = {
    title: "✈️ AeroDrop Flight Alert",
    body: "Flight price drop detected on your monitored route!",
    url: "/dashboard",
  };

  if (event.data) {
    try {
      data = event.data.json();
    } catch {
      data.body = event.data.text();
    }
  }

  const options = {
    body: data.body || "Flight price updated!",
    icon: data.icon || "/icons/icon-192.svg",
    badge: data.badge || "/icon.svg",
    tag: data.tag || `aerodrop-${Date.now()}`,
    renotify: true,
    vibrate: [100, 50, 100],
    data: {
      url: data.url || "/dashboard",
    },
    actions: [
      { action: "explore", title: "View Flight Radar" },
      { action: "dismiss", title: "Close" },
    ],
  };

  event.waitUntil(
    self.registration.showNotification(data.title || "✈️ AeroDrop Flight Alert", options),
  );
});

// Notification Click: Focus existing window or open target route
self.addEventListener("notificationclick", (event) => {
  event.notification.close();

  if (event.action === "dismiss") {
    return;
  }

  const targetUrl = event.notification.data?.url || "/dashboard";

  event.waitUntil(
    self.clients
      .matchAll({ type: "window", includeUncontrolled: true })
      .then((windowClients) => {
        for (const client of windowClients) {
          if (client.url.includes(targetUrl) && "focus" in client) {
            return client.focus();
          }
        }
        if (self.clients.openWindow) {
          return self.clients.openWindow(targetUrl);
        }
      }),
  );
});
