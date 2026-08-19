const DEFAULT_NOTIFICATION = {
  title: "SaharaCare",
  body: "It’s almost time for your medicine. Open SaharaCare to check your reminder.",
  url: "/patient",
  tag: "saharacare-medication-reminder",
  silent: false,
};

self.addEventListener("install", () => self.skipWaiting());
self.addEventListener("activate", (event) => event.waitUntil(self.clients.claim()));

self.addEventListener("push", (event) => {
  let payload = DEFAULT_NOTIFICATION;
  try {
    payload = { ...DEFAULT_NOTIFICATION, ...(event.data ? event.data.json() : {}) };
  } catch {
    payload = DEFAULT_NOTIFICATION;
  }

  event.waitUntil(self.registration.showNotification(payload.title, {
    body: payload.body,
    tag: payload.tag,
    data: { url: payload.url },
    silent: Boolean(payload.silent),
    vibrate: payload.silent ? undefined : [150, 75, 150],
  }));
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const target = new URL(event.notification.data?.url || "/patient", self.location.origin).href;

  event.waitUntil((async () => {
    const windows = await self.clients.matchAll({ type: "window", includeUncontrolled: true });
    const existing = windows.find((client) => client.url.startsWith(self.location.origin));
    if (existing) {
      await existing.navigate(target);
      return existing.focus();
    }
    return self.clients.openWindow(target);
  })());
});
