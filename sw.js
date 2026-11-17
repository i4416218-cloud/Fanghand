/* Fanghand: hält die App offline verfügbar.
   Bei einer neuen Version VERSION hochzählen, damit die Handys die neue Datei holen. */
const VERSION = "fanghand-v1";
const FONTS = "fanghand-fonts";
const CORE = [
  "./",
  "./index.html",
  "./manifest.webmanifest",
  "./icon-192.png",
  "./icon-512.png",
  "./icon-maskable-512.png",
  "./apple-touch-icon.png"
];

self.addEventListener("install", (e) => {
  e.waitUntil(caches.open(VERSION).then((c) => c.addAll(CORE)).then(() => self.skipWaiting()));
});

self.addEventListener("activate", (e) => {
  e.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== VERSION && k !== FONTS).map((k) => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

function timeout(ms) {
  return new Promise((_, reject) => setTimeout(() => reject(new Error("timeout")), ms));
}

self.addEventListener("fetch", (e) => {
  const req = e.request;
  if (req.method !== "GET") return;
  const url = new URL(req.url);

  /* Seite selbst: zuerst Netz (max. 3 s, schlechter Empfang in der Halle), sonst gespeicherte Version */
  if (req.mode === "navigate") {
    e.respondWith(
      Promise.race([fetch(req), timeout(3000)])
        .then((res) => {
          if (res && res.ok) {
            const copy = res.clone();
            caches.open(VERSION).then((c) => c.put("./index.html", copy));
          }
          return res;
        })
        .catch(() => caches.match("./index.html").then((m) => m || caches.match("./")))
    );
    return;
  }

  /* Eigene Dateien: aus dem Speicher, sonst Netz */
  if (url.origin === self.location.origin) {
    e.respondWith(
      caches.match(req).then((m) => m || fetch(req).then((res) => {
        if (res && res.ok) {
          const copy = res.clone();
          caches.open(VERSION).then((c) => c.put(req, copy));
        }
        return res;
      }))
    );
    return;
  }

  /* Schriften von Google: einmal laden, danach aus dem Speicher */
  if (url.host === "fonts.googleapis.com" || url.host === "fonts.gstatic.com") {
    e.respondWith(
      caches.open(FONTS).then((c) => c.match(req).then((m) => {
        const net = fetch(req).then((res) => { c.put(req, res.clone()); return res; }).catch(() => m);
        return m || net;
      }))
    );
  }
});
