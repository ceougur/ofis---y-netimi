// DestekOfis Mobil: yalnız uygulama kabuğu (sayfa, stil, betik, simge) önbelleğe alınır; mali API yanıtları ASLA saklanmaz, yeniden oynatılmaz,
// sıraya alınmaz. Kapsam /mobil/ (dosyanın kendi klasörü); masaüstü programın sayfalarına karışmaz.
const CACHE = "destekofis-mobil-kabuk-v2";
const BASE = new URL("./", self.location).pathname;
const ASSETS = ["", "index.html", "styles.css", "app.js", "manifest.webmanifest", "icons/app.svg"].map(name => BASE + name);
self.addEventListener("install", e => {
  e.waitUntil(caches.open(CACHE).then(c => c.addAll(ASSETS)).then(() => self.skipWaiting()));
});
self.addEventListener("activate", e => {
  e.waitUntil(caches.keys().then(keys => Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k)))).then(() => self.clients.claim()));
});
self.addEventListener("fetch", e => {
  const url = new URL(e.request.url);
  if (e.request.method !== "GET" || url.origin !== self.location.origin || url.pathname.startsWith("/api/")) return;
  if (!ASSETS.includes(url.pathname)) return;
  e.respondWith(fetch(e.request).catch(() => caches.match(e.request)));
});
