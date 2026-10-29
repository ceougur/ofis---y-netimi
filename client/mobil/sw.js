// DestekOfis Mobil: yalnız uygulama kabuğu (sayfa, stil, betik, simge) önbelleğe alınır; mali API yanıtları ASLA saklanmaz, yeniden oynatılmaz,
// sıraya alınmaz. Kapsam /mobil/ (dosyanın kendi klasörü); masaüstü programın sayfalarına karışmaz.
// 2.4.7 M3: ofis sunucusu kapalıyken kapıcı sayfa dosyası yerine 503 verir (ağ hatası değil) → başarısız yanıtta da önbellekteki kabuk açılır; sayfa
// kapıcıdan şifreli son özeti alır (/kapi/ozet; önbelleğe ALINMAZ).
const CACHE = "destekofis-mobil-kabuk-v4";
const BASE = new URL("./", self.location).pathname;
// 2.4.7 gezinti B1: kayıt girişi modülleri (yazma*) de kabuğun parçası — sunucu kapalıyken açılan sayfa, sunucu dönünce düğmeleri gösterir.
const ASSETS = ["", "index.html", "styles.css", "ozet.css", "app.js", "ozet.js", "yazma.js", "yazma.css", "yazma-bekleyen.js", "manifest.webmanifest", "icons/app.svg"].map(name => BASE + name);
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
  e.respondWith(
    fetch(e.request)
      .then(response => (response.ok ? response : caches.match(e.request).then(cached => cached || response)))
      .catch(() => caches.match(e.request)),
  );
});
