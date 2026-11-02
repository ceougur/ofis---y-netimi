// DestekOfis Mobil — 2.4.8 M4: iPhone / iPad eşleme akışı (CLAUDE.md / docs/2.4.8-IS-LISTESI.md "KARAR M4").
// iOS'ta ana ekran simgesi (standalone) Safari'den AYRI depoyla açılır: Safari'de yapılan eşleme (HttpOnly cihaz çerezi + IndexedDB anahtarları) simgeye geçmez.
// Bu yüzden iOS tarayıcı sekmesinde karekod sayfası EŞLEMEZ, kodu sunucuya göndermez (tüketmez) ve seçenek sunmaz; yalnız "Ana Ekrana Ekle → simgede
// Karekodu Okut" der. Simgenin içinde kamera açılır, karekod çözülür (vendor/jsqr-1.4.0.js, Apache 2.0; CDN yok), karekoddaki adresin BU ofisin adresi
// olduğu doğrulanır ve bugünkü eşleme akışı simgenin deposunda tamamlanır. Android ve masaüstü tarayıcı bugünkü akışla sürer (simge depoyu paylaşır).
export const KOD_KALIBI = /^#eslesme=([A-Za-z0-9_-]{8,64})$/;
export const MOBIL_YOLU = "/mobil/";

/** iPhone, iPod ya da iPad (iPadOS 13+ masaüstü imzası "Macintosh" + dokunmatik). */
export function iosMu(nav = globalThis.navigator) {
  const ua = String(nav?.userAgent || "");
  return /iPhone|iPad|iPod/.test(ua) || (/Macintosh/.test(ua) && Number(nav?.maxTouchPoints) > 1);
}
/** Ana ekran simgesinden (standalone) mı açıldı? iOS Safari navigator.standalone; öbürleri display-mode. */
export function simgeMi(win = globalThis) {
  if (win?.navigator?.standalone === true) return true;
  try {
    return Boolean(win?.matchMedia?.("(display-mode: standalone)")?.matches);
  } catch {
    return false;
  }
}
/** iOS tarayıcı sekmesi (simge değil): eşleme yapılmaz, yalnız yönlendirilir. */
export const iosTarayici = (win = globalThis) => iosMu(win?.navigator) && !simgeMi(win);
/** iOS ana ekran simgesi: eşleme "Karekodu Okut" ile simgenin içinde. */
export const iosSimge = (win = globalThis) => iosMu(win?.navigator) && simgeMi(win);

export const ILETI = Object.freeze({
  degil: "Bu karekod bir DestekOfis eşleme karekodu değil. Bilgisayarda Yönetim → Mobil Cihazlar'da oluşturulan karekodu okutun.",
  baskaOfis: "Bu karekod başka bir ofisin adresine ait; bu simge yalnız kendi ofisine eşlenir. Bu ofisin bilgisayarındaki karekodu okutun ya da yöneticinizden yeni karekod isteyin.",
  izin: "Kamera izni verilmedi. Karekodu okutmak için kameraya izin verin (iPhone: Ayarlar → Safari → Kamera → Sor ya da İzin Ver), sonra Karekodu Okut'a yeniden dokunun.",
  kameraYok: "Bu cihazda kamera bulunamadı ya da açılamadı. Kamerayı başka bir uygulama kullanıyorsa kapatıp Karekodu Okut'a yeniden dokunun.",
  desteklenmiyor: "Bu cihaz kameraya erişime izin vermiyor (güvenli bağlantı ya da güncel iOS gerekir). iOS'u güncelleyip yeniden deneyin.",
  cozucu: "Karekod okuyucu yüklenemedi; internet bağlantınızı denetleyip yeniden deneyin.",
});

/**
 * Karekoddan okunan metinden eşleme kodu. Kabul: http(s)://<bu ofisin adresi>/mobil/#eslesme=<kod> (lib/mobile-remote.mjs createCode ile aynı biçim).
 * Başka kökene (başka ofis, başka site) gidilmez; kod yalnız bu kökenin eşleme ucuna gönderilir.
 * @param {string} metin karekodun içeriği
 * @param {{ origin: string }} konum bu sayfanın kökeni (location)
 * @returns {{ kod: string } | { hata: string }}
 */
export function eslesmeKodu(metin, konum) {
  let u;
  try {
    u = new URL(String(metin ?? "").trim());
  } catch {
    return { hata: ILETI.degil };
  }
  const m = KOD_KALIBI.exec(u.hash);
  if (!/^https?:$/.test(u.protocol) || u.pathname !== MOBIL_YOLU || u.search || u.username || u.password || !m) return { hata: ILETI.degil };
  if (u.origin !== String(konum?.origin || "")) return { hata: ILETI.baskaOfis };
  return { kod: m[1] };
}

/** getUserMedia hatası → kullanıcıya açık ileti. */
export function kameraHatasi(error) {
  const ad = String(error?.name || "");
  if (ad === "NotAllowedError" || ad === "PermissionDeniedError" || ad === "SecurityError") return ILETI.izin;
  if (ad === "TypeError") return ILETI.desteklenmiyor;
  return ILETI.kameraYok;
}

let cozucuSozu = null;
/** Çözücü yalnız gerektiğinde yüklenir (simgede Karekodu Okut). */
export function cozucu() {
  cozucuSozu ||= import("./vendor/jsqr-1.4.0.js").then(m => m.default).catch(error => {
    cozucuSozu = null;
    throw Object.assign(Error(ILETI.cozucu), { cause: error });
  });
  return cozucuSozu;
}

/** Görüntü karesinden karekod metni (yoksa null). Ters renk denenmez (Yönetim → Mobil Cihazlar karekodu açık zemin üstüne koyu; kare başına çözüm süresi yarıya iner). */
export function kareCoz(jsQR, data, width, height) {
  const r = jsQR(data, width, height, { inversionAttempts: "dontInvert" });
  return r && typeof r.data === "string" && r.data ? r.data : null;
}

const bekle = ms => new Promise(resolve => setTimeout(resolve, ms));

/**
 * Kamerayı açar ve karekod bulunana dek kareleri çözer. iptal() true dönünce durur (null). Kamera her çıkışta kapatılır.
 * @param {HTMLVideoElement} video
 * @param {{ iptal: () => boolean, durum?: (metin: string) => void }} o
 * @returns {Promise<string|null>}
 */
export async function karekodOku(video, { iptal, durum = () => {} }) {
  if (!globalThis.navigator?.mediaDevices?.getUserMedia) throw Error(ILETI.desteklenmiyor);
  const jsQR = await cozucu();
  let akis;
  try {
    akis = await navigator.mediaDevices.getUserMedia({ video: { facingMode: { ideal: "environment" } }, audio: false });
  } catch (error) {
    throw Error(kameraHatasi(error));
  }
  try {
    video.setAttribute("playsinline", "");
    video.muted = true;
    video.srcObject = akis;
    await video.play().catch(() => {});
    durum("Karekodu çerçevenin içine getirin.");
    const tuval = document.createElement("canvas");
    const ctx = tuval.getContext("2d", { willReadFrequently: true });
    while (!iptal()) {
      if (video.readyState >= 2 && video.videoWidth > 0) {
        const olcek = Math.min(1, 800 / Math.max(video.videoWidth, video.videoHeight));
        const w = Math.max(1, Math.round(video.videoWidth * olcek));
        const h = Math.max(1, Math.round(video.videoHeight * olcek));
        tuval.width = w;
        tuval.height = h;
        ctx.drawImage(video, 0, 0, w, h);
        const metin = kareCoz(jsQR, ctx.getImageData(0, 0, w, h).data, w, h);
        if (metin) return metin;
      }
      await bekle(120);
    }
    return null;
  } finally {
    for (const iz of akis.getTracks()) iz.stop();
    video.srcObject = null;
  }
}
