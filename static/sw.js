// Offline support: the app shell is served from cache and refreshed in the
// background. The text-recognition engine and barcode reader (from jsDelivr) are
// cached after first use, so photo checking works offline afterwards. Product
// lookups are never cached here — they always need the network.
const VERSION = "__BUILD_VERSION__";
const CACHE = `vegsure-${VERSION}`;
const SHELL = ["./", "index.html", "styles.css", "app.js", "manifest.webmanifest", "icon.svg"];

self.addEventListener("install", (event) => {
  event.waitUntil(caches.open(CACHE).then((c) => c.addAll(SHELL)).then(() => self.skipWaiting()));
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.filter((k) => k.startsWith("vegsure-") && k !== CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim()),
  );
});

self.addEventListener("fetch", (event) => {
  const req = event.request;
  if (req.method !== "GET") return;
  const url = new URL(req.url);
  const sameOrigin = url.origin === self.location.origin;
  const engine = url.hostname === "cdn.jsdelivr.net";
  if (!sameOrigin && !engine) return;
  // The Android app download is large and changes with each release: never cache it.
  if (url.pathname.endsWith(".apk")) return;

  event.respondWith(
    caches.open(CACHE).then(async (cache) => {
      const cached = await cache.match(req, { ignoreSearch: sameOrigin });
      const network = fetch(req)
        .then((res) => {
          if (res.ok || res.type === "opaque") cache.put(req, res.clone());
          return res;
        })
        .catch(() => cached);
      return cached ?? network;
    }),
  );
});
