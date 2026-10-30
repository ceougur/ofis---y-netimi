// DestekOfis Mobil — sunucu kapalıyken şifreli son özet (2.4.7 M3; docs/mobil/M3-TASARIM.md §3, §6). app.js'in AYNI ekranları bu katmandan beslenir; app.js'te
// yalnız bağlantı satırları vardır (bagla + kanca çağrıları).
//
// Eşlemede tarayıcı ikinci, DIŞA AKTARILAMAZ ECDH P-256 şifreleme anahtarı üretir (M2 imza anahtarından ayrı; IndexedDB, ofisin kökeninde). Ofis sunucusuna
// ulaşılamazsa (kapalı / internetsiz) kapıcıdan (/kapi/ozet, aynı adres) özet M2 cihaz anahtarıyla İMZALI istekle alınır; ofisin imzası (eşlemede alınan
// anahtar) doğrulanmadan hiçbir alan kullanılmaz; sıra gerilerse reddedilir; veri anahtarı bu cihazın anahtarıyla açılır. Çözülen bilgi YALNIZ bellekte.
// Bağlam metinleri server/lib/kapi-protokol.mjs ile aynı (test/mobil-ozet-247.test.mjs kaynakta denetler).
let d = null; // app.js bağımlılıkları (bagla)
const offline = { veri: null, uretim: "" };
const te = new TextEncoder();
const unb64 = s => {
  const t = String(s || "");
  return Uint8Array.from(atob(t.replace(/-/g, "+").replace(/_/g, "/") + "===".slice((t.length + 3) % 4)), c => c.charCodeAt(0));
};
const ecJwk = j => ({ kty: "EC", crv: "P-256", x: j?.x, y: j?.y });
const el = id => document.getElementById(id);
const keyGet = name => d.keyOp("readonly", s => s.get(name));

export const NO_OFFLINE = Symbol("cevrimdisi-yok");
export function bagla(deps) {
  d = deps;
  el("offline-open")?.addEventListener("click", openFromLogin);
}
export const aktif = () => Boolean(offline.veri);

// ---------- Eşleme ----------
export async function sifreAnahtari() {
  const enc = await crypto.subtle.generateKey({ name: "ECDH", namedCurve: "P-256" }, false, ["deriveBits"]);
  const jwk = await crypto.subtle.exportKey("jwk", enc.publicKey);
  return { gizli: enc.privateKey, acik: { kty: jwk.kty, crv: jwk.crv, x: jwk.x, y: jwk.y } };
}
export async function eslesmeKaydet(paired, enc) {
  await d.keyOp("readwrite", s => s.put({ privateKey: enc.gizli }, "sifre"));
  await d.keyOp("readwrite", s => s.put(paired?.device?.id || "", "cihaz"));
  await d.keyOp("readwrite", s => s.put(paired?.ofis || null, "ofis"));
  await d.keyOp("readwrite", s => s.put(0, "sira"));
}

// ---------- Özeti alma ve çözme ----------
async function summaryKeys() {
  if (!d.secure()) return null;
  try {
    const [cihaz, ofis, anahtar, sifre] = await Promise.all(["cihaz", "ofis", "anahtar", "sifre"].map(keyGet));
    return cihaz && ofis?.kimlik && anahtar?.privateKey && sifre?.privateKey ? { cihaz, ofis, anahtar, sifre } : null;
  } catch {
    return null;
  }
}
async function openSummary(text, { cihaz, ofis, sifre }) {
  const z = JSON.parse(text);
  if (z?.v !== 1 || typeof z.govde !== "string") throw Error("Son özet okunamadı.");
  const okey = await crypto.subtle.importKey("jwk", ecJwk(ofis.anahtar), { name: "ECDSA", namedCurve: "P-256" }, false, ["verify"]);
  if (!(await crypto.subtle.verify({ name: "ECDSA", hash: "SHA-256" }, okey, unb64(z.imza), te.encode(z.govde)))) throw Error("Son özetin imzası doğrulanamadı; yöneticinize bildirin.");
  const g = JSON.parse(z.govde);
  if (g.ofis !== ofis.kimlik) throw Error("Son özet bu ofise ait değil.");
  const seen = Number(await keyGet("sira")) || 0;
  if (g.sira < seen) throw Error("Kapıcı daha eski bir özet verdi; yeniden deneyin.");
  const e = g.cihazlar?.[cihaz];
  if (!e) throw Error("Bu cihaz için özet henüz hazırlanmadı; ofis sunucusu açılınca hazırlanır.");
  const epk = await crypto.subtle.importKey("jwk", ecJwk(g.epk), { name: "ECDH", namedCurve: "P-256" }, false, []);
  const bits = await crypto.subtle.deriveBits({ name: "ECDH", public: epk }, sifre.privateKey, 256);
  const hk = await crypto.subtle.importKey("raw", bits, "HKDF", false, ["deriveKey"]);
  const kek = await crypto.subtle.deriveKey({ name: "HKDF", hash: "SHA-256", salt: te.encode(`DestekOfis-ozet-v1|${g.ofis}|${g.sira}`), info: te.encode(`sarma|${cihaz}`) }, hk, { name: "AES-GCM", length: 256 }, false, ["decrypt"]);
  const raw = await crypto.subtle.decrypt({ name: "AES-GCM", iv: unb64(e.iv), additionalData: te.encode(`sarma|${g.ofis}|${g.sira}|${cihaz}|${e.u}`) }, kek, unb64(e.anahtar));
  const k = g.kullanicilar[e.u];
  const dk = await crypto.subtle.importKey("raw", raw, { name: "AES-GCM" }, false, ["decrypt"]);
  const plain = await crypto.subtle.decrypt({ name: "AES-GCM", iv: unb64(k.iv), additionalData: te.encode(`veri|${g.ofis}|${g.sira}|${e.u}`) }, dk, unb64(k.veri));
  if (typeof DecompressionStream !== "function") throw Error("Bu tarayıcı son özeti açamıyor; tarayıcınızı güncelleyin.");
  const json = await new Response(new Blob([plain]).stream().pipeThrough(new DecompressionStream("gzip"))).text();
  await d.keyOp("readwrite", s => s.put(g.sira, "sira"));
  return JSON.parse(json);
}
// Kapıcıdan özet: cihaz anahtarıyla imzalı istek. Telefonun saati kaymışsa kapıcı kendi saatini döner, bir kez düzeltilip yinelenir.
export async function loadSummary() {
  const keys = await summaryKeys();
  if (!keys) return null;
  let skew = 0;
  for (let i = 0; i < 2; i += 1) {
    const ms = Date.now() + skew;
    const sig = await crypto.subtle.sign({ name: "ECDSA", hash: "SHA-256" }, keys.anahtar.privateKey, te.encode(`DestekOfis-kapi-cihaz\nGET\n/kapi/ozet\n${keys.cihaz}\n${ms}`));
    let resp;
    try {
      resp = await fetch("/kapi/ozet", { headers: { "x-do-cihaz": keys.cihaz, "x-do-zaman": String(ms), "x-do-imza": d.b64url(sig) }, cache: "no-store", credentials: "omit" });
    } catch {
      throw Error("İnternet bağlantısı yok; son özet de alınamadı.");
    }
    if (resp.ok) return await openSummary(await resp.text(), keys);
    let data = {};
    try {
      data = await resp.json();
    } catch {
      data = {};
    }
    if (data.code === "kapi-zaman" && Number(data.zaman) && i === 0) {
      skew = Number(data.zaman) - Date.now();
      continue;
    }
    if (!data.code) return null; // kapıcı yok (ofis ağındaki yerel adres)
    if (data.code === "kapi-cihaz" || data.code === "kapi-imza") {
      d.loggedOut();
      d.showUnpaired(data.error);
      throw new d.SessionEnded(data.error);
    }
    throw Object.assign(Error(data.error || "Son özet alınamadı."), { code: data.code });
  }
  return null;
}

// ---------- Çevrimdışı görünüm ----------
const fmtTime = iso => {
  try {
    return new Date(iso).toLocaleString("tr-TR", { dateStyle: "short", timeStyle: "short" });
  } catch {
    return iso;
  }
};
export function enter(veri) {
  offline.veri = veri;
  offline.uretim = veri.uretim || "";
  d.setAuth(veri.oturum);
  d.state.writesEnabled = false; // 2.4.7 M5 birleşimi: sunucu kapalıyken kayıt girilmez — oturumdan kalan yazma hakkı çevrimdışı görünümde düğme göstermesin
  const when = fmtTime(offline.uretim);
  el("offline-banner").textContent = `Ofis sunucusuna ulaşılamıyor. Son güncelleme: ${when} — bilgiler salt okunurdur; yenilemek için ↻.`;
  el("offline-banner").classList.remove("hidden");
  el("offline-note")?.classList.add("hidden");
  d.serverState(false);
  el("top-server-status").textContent = `Son Güncelleme ${when}`;
  el("side-server-status").textContent = `Sunucu kapalı · son güncelleme ${when}`;
}
export function leave() {
  offline.veri = null;
  offline.uretim = "";
  el("offline-banner")?.classList.add("hidden");
}
// Oturum sürerken sunucu kapanırsa son özete kendiliğinden geçilir (yalnız okuma). Açılışta ise kullanıcı "Son Özeti Göster"e basar (bilinçli adım; 2.4.8 M5:
// düğme formun üstünde, kendiliğinden açılma yok — kullanıcı kararı).
export async function tryOffline(path, body) {
  if (body !== undefined || !d.state.user) return NO_OFFLINE;
  let veri = null;
  try {
    veri = await loadSummary();
  } catch (e) {
    if (e instanceof d.SessionEnded) throw e;
    return NO_OFFLINE;
  }
  if (!veri) return NO_OFFLINE;
  enter(veri);
  return data(path);
}
// app.js api() yerine: özetten M1 uçlarının yanıtı (liste araması / sayfalama özetin içinde). Yazma ve rapor yok.
export function api(full, body) {
  if (body !== undefined) throw Error("Ofis sunucusu kapalıyken bu işlem yapılamaz; bilgiler son özetten salt okunur gösteriliyor.");
  return data(full);
}
function data(full) {
  const u = new URL(full, "https://ozet.invalid/");
  const p = u.pathname;
  const veri = offline.veri;
  if (p === "/session") return veri.oturum;
  if (p.startsWith("/reports") || p === "/accounts/search") throw Object.assign(Error("Raporlar ofis sunucusu açıkken alınır; sunucu kapalıyken son özetteki bakiyeler ve hareketler görünür."), { status: 503 });
  const company = u.searchParams.get("company") || veri.oturum?.company;
  const c = veri.sirketler?.[company];
  if (!c) throw Object.assign(Error("Bu şirketin bilgisi son özette yok."), { status: 403 });
  if (p === "/accounts" || p === "/stock") {
    const all0 = c[p];
    if (!all0) throw Object.assign(Error("Yetki Yok"), { status: 403 });
    const key = p === "/accounts" ? "accounts" : "items";
    const q = String(u.searchParams.get("q") || "").toLocaleLowerCase("tr-TR");
    const all = (Array.isArray(all0[key]) ? all0[key] : []).filter(o => !q || ["name", "refNo", "code", "category"].some(n => String(o?.[n] ?? "").toLocaleLowerCase("tr-TR").includes(q)));
    const offset = Math.max(0, Number(u.searchParams.get("offset")) || 0);
    const limit = Math.max(1, Number(u.searchParams.get("limit")) || 50);
    return { ...all0, [key]: all.slice(offset, offset + limit), total: q ? all.length : all0.total ?? all.length };
  }
  if (/^\/(accounts|stock)\/[^/]+$/.test(p)) {
    const x = c[decodeURIComponent(p)];
    if (!x) throw Error("Bu kaydın ayrıntısı son özette yok; ofis sunucusu açılınca görünür.");
    return x;
  }
  if (c[p]) return c[p];
  throw Object.assign(Error("Yetki Yok"), { status: 403 });
}
export function assertOnline() {
  if (offline.veri) throw Error("Ofis sunucusu kapalıyken PDF ve Excel alınamaz.");
}
// 2.4.8 M5 (kullanıcı kararı): "Son Özeti Göster" giriş formunun ÜSTÜNDE ve belirgin; ulaşılamıyor uyarısı da bu cümleyi söyler. Kendiliğinden açılmaz.
export const OFFLINE_HINT = "Son Özeti Göster'e basarak son yüklenen bilgileri görebilirsiniz.";
/** Bu cihazda son özet açılabiliyorsa düğmeyi gösterir; gösterdiyse true. */
export async function offer() {
  const has = Boolean(await summaryKeys());
  if (has) el("offline-note")?.classList.remove("hidden");
  return has;
}
// Yenile (↻) çevrimdışında: önce canlıyı dener, olmazsa yeni özeti alır.
export async function refresh(startSession) {
  leave();
  try {
    await startSession();
  } catch (e) {
    if (e instanceof d.SessionEnded) return;
    let veri = null;
    let hata = e;
    try {
      veri = await loadSummary();
    } catch (e2) {
      if (e2 instanceof d.SessionEnded) return;
      hata = e2;
    }
    if (veri) {
      enter(veri);
      d.setPage(d.state.page);
    } else {
      d.loggedOut();
      const ileti = hata?.message || "Son özet alınamadı.";
      el("login-error").textContent = ileti;
      el("login-error").classList.remove("hidden");
      offer().then(has => {
        if (has && hata?.unreachable) el("login-error").textContent = `${ileti} ${OFFLINE_HINT}`;
      });
    }
  }
}
async function openFromLogin() {
  const button = el("offline-open");
  button.disabled = true;
  try {
    const veri = await loadSummary();
    if (!veri) throw Error("Bu cihaz için son özet yok.");
    enter(veri);
    d.setPage("home");
  } catch (e) {
    if (!(e instanceof d.SessionEnded)) {
      el("login-error").textContent = e.message;
      el("login-error").classList.remove("hidden");
    }
  } finally {
    button.disabled = false;
  }
}
