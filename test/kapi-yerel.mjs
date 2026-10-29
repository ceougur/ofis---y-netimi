// 2.4.7 M3 test yardımcısı: kapıcıyı (bulut/kapi/kapi.mjs — Cloudflare Worker) Node'da, SAHTE R2 kovası, sahte saat, sahte lisans servisi ve sahte "tünel" (ofisin
// uzak dinleyicisine iletim) ile koşar. Gerçek Cloudflare'e, gerçek lisans servisine istek GİTMEZ (ders 30): lisans servisi her zaman verilen işlevdir.
// Worker'ın kendisi değiştirilmeden yüklenir; yalnız createKapi'nin dört bağlantı noktası (now, fetchOrigin, lisansFetch, onbellek) verilir.
//
// Adres düzeni üretimdekiyle aynı: ofisin telefon adresi <ofis kimliği>.<alan> (ör. o...e.destekofis.test), program uçları /v1/ofis/… (her adreste).
// Node istemcisi (sürücü, birim testi) Host başlığıyla; Chromium (e2e) --host-resolver-rules ile aynı porta yönlenir (https; kendinden imzalı sertifika).
import http from "node:http";
import https from "node:https";
import { createHash } from "node:crypto";
import { createKapi } from "../bulut/kapi/kapi.mjs";
import { TRUSTED_LICENSE_KEYS } from "../server/lib/license-keys.mjs";
import { selfSignedCert } from "./tls-sertifika.mjs";

/** R2 kovasının (Workers bağlaması) sınamada kullanılan alt kümesi: get/head/put/delete, onlyIf etagMatches, customMetadata. Sınıf A/B sayaçları (kota tahmini). */
export function sahteR2() {
  const nesneler = new Map();
  const sayac = { A: 0, B: 0 };
  let surum = 0;
  const nesne = (key, kayit, govdeli) => {
    const veri = kayit.veri;
    return {
      key,
      etag: kayit.etag,
      httpEtag: `"${kayit.etag}"`,
      size: veri.length,
      uploaded: new Date(kayit.zaman),
      customMetadata: { ...kayit.customMetadata },
      httpMetadata: { ...kayit.httpMetadata },
      ...(govdeli
        ? {
            body: new Blob([veri]).stream(),
            text: async () => new TextDecoder().decode(veri),
            json: async () => JSON.parse(new TextDecoder().decode(veri)),
            arrayBuffer: async () => veri.buffer.slice(veri.byteOffset, veri.byteOffset + veri.length),
          }
        : {}),
    };
  };
  return {
    nesneler,
    sayac,
    async get(key) {
      sayac.B += 1;
      const kayit = nesneler.get(key);
      return kayit ? nesne(key, kayit, true) : null;
    },
    async head(key) {
      sayac.B += 1;
      const kayit = nesneler.get(key);
      return kayit ? nesne(key, kayit, false) : null;
    },
    async put(key, value, secenek = {}) {
      sayac.A += 1;
      const onceki = nesneler.get(key);
      const kosul = secenek.onlyIf || {};
      if (kosul.etagMatches !== undefined && (!onceki || onceki.etag !== kosul.etagMatches)) return null;
      if (kosul.etagDoesNotMatch !== undefined && onceki && (kosul.etagDoesNotMatch === "*" || onceki.etag === kosul.etagDoesNotMatch)) return null;
      const veri = typeof value === "string" ? new TextEncoder().encode(value) : new Uint8Array(value instanceof ArrayBuffer ? value : await new Response(value).arrayBuffer());
      surum += 1;
      const etag = createHash("md5").update(veri).update(String(surum)).digest("hex");
      const kayit = { veri, etag, zaman: Date.now(), customMetadata: secenek.customMetadata || {}, httpMetadata: secenek.httpMetadata || {} };
      nesneler.set(key, kayit);
      return nesne(key, kayit, false);
    },
    async delete(key) {
      sayac.A += 1;
      nesneler.delete(key);
    },
  };
}

/** Cache API (caches.default) eşdeğeri: anahtar adres. */
export function sahteOnbellek() {
  const kayitlar = new Map();
  return {
    kayitlar,
    async match(request) {
      const kayit = kayitlar.get(typeof request === "string" ? request : request.url);
      return kayit ? new Response(kayit) : undefined;
    },
    async put(request, response) {
      kayitlar.set(typeof request === "string" ? request : request.url, await response.text());
    },
    temizle: () => kayitlar.clear(),
  };
}

// Sahte "tünel": kapıcının ilettiği isteği ofisin uzak dinleyicisine (program) Host başlığını koruyarak iletir (cloudflared gibi). Kökeni olmayan ofis → bağlantı hatası.
function tunelIlet(kokenler) {
  return async (request, ofis) => {
    const taban = kokenler.get(ofis);
    if (!taban) throw new TypeError("fetch failed (tünel yok)");
    return kokeneIlet(request, taban);
  };
}

/** İsteği verilen tabana (ör. sahte cloudflared'in yerel ucu) Host başlığını koruyarak iletir; uçtan uca testin sahte Cloudflare kenarı da bunu kullanır. */
export async function kokeneIlet(request, taban) {
  const url = new URL(request.url);
  const hedef = new URL(taban);
  const basliklar = {};
  for (const [ad, deger] of request.headers) if (ad !== "set-cookie") basliklar[ad] = deger;
  basliklar.host = url.host;
  const govde = request.method === "GET" || request.method === "HEAD" ? null : Buffer.from(await request.arrayBuffer());
  if (govde) basliklar["content-length"] = String(govde.length);
  return new Promise((resolve, reject) => {
    const istek = http.request({ host: hedef.hostname, port: hedef.port, method: request.method, path: `${url.pathname}${url.search}`, headers: basliklar }, yanit => {
      const parcalar = [];
      yanit.on("data", parca => parcalar.push(parca));
      yanit.on("end", () => {
        const h = new Headers();
        for (const [ad, deger] of Object.entries(yanit.headers)) for (const tek of [].concat(deger)) h.append(ad, String(tek));
        const veri = Buffer.concat(parcalar);
        resolve(new Response(yanit.statusCode === 204 || yanit.statusCode === 304 || request.method === "HEAD" ? null : veri, { status: yanit.statusCode, headers: h }));
      });
    });
    istek.on("error", reject);
    if (govde) istek.write(govde);
    istek.end();
  });
}

/**
 * Yerel kapıcı sunucusu.
 * @param {object} o
 * @param {() => number} o.now kapıcının saati (programla aynı sahte saat)
 * @param {(url: string, init: object) => Promise<Response>} [o.lisansFetch] lisans servisinin kapıcı ucu (/v1/kapi/durum); verilmezse servis yok
 * @param {string} [o.alan] ofis alanı (varsayılan destekofis.test)
 * @param {boolean} [o.tls] ayrıca https dinleyicisi (Chromium için; kendinden imzalı)
 * @param {object} [o.trustedKeys] lisans açık anahtarları (varsayılan programınkiler)
 * @param {Function} [o.fetchOrigin] canlı istek iletimi (varsayılan: tunel() ile verilen tabana; uçtan uca testte sahte Cloudflare kenarı)
 */
export async function startKapi({ now = () => Date.now(), lisansFetch = null, alan = "destekofis.test", tls = false, trustedKeys = TRUSTED_LICENSE_KEYS, fetchOrigin = null } = {}) {
  const r2 = sahteR2();
  const onbellek = sahteOnbellek();
  const kokenler = new Map();
  const gunluk = [];
  const env = { OZET: r2, LISANS_ANAHTARLARI: JSON.stringify(trustedKeys), OFIS_ALANI: alan, ...(lisansFetch ? { LISANS_URL: "https://lisans.kapi.test/api/lisans", KAPI_LISANS_ANAHTARI: "test-kapi-anahtari" } : {}) };
  const kapi = createKapi({
    now,
    fetchOrigin: fetchOrigin || tunelIlet(kokenler),
    lisansFetch: lisansFetch || (async () => {
      throw new TypeError("lisans servisi yok");
    }),
    onbellek,
  });
  const isle = tlsMi => async (req, res) => {
    const parcalar = [];
    for await (const parca of req) parcalar.push(parca);
    const govde = Buffer.concat(parcalar);
    const host = req.headers.host || "127.0.0.1";
    const basliklar = new Headers();
    for (const [ad, deger] of Object.entries(req.headers)) for (const tek of [].concat(deger)) basliklar.append(ad, String(tek));
    // Cloudflare'in istemci adresi başlığı (kapıcı hız sınırında kullanır); istemcinin gönderdiği eşdeğer başlıklar kapıcıya ulaşmaz.
    basliklar.set("cf-connecting-ip", req.socket.remoteAddress || "?");
    const request = new Request(`${tlsMi ? "https" : "http"}://${host}${req.url}`, { method: req.method, headers: basliklar, body: req.method === "GET" || req.method === "HEAD" ? undefined : govde, duplex: "half" });
    let yanit;
    try {
      yanit = await kapi.fetch(request, env, { waitUntil() {} });
    } catch (error) {
      yanit = new Response(JSON.stringify({ ok: false, code: "kapi-yerel", error: String(error?.message || error) }), { status: 500 });
    }
    gunluk.push({ yontem: req.method, adres: `${host}${req.url}`, durum: yanit.status });
    const cikis = {};
    for (const [ad, deger] of yanit.headers) if (ad !== "set-cookie") cikis[ad] = deger;
    const cerezler = yanit.headers.getSetCookie?.() || [];
    if (cerezler.length) cikis["set-cookie"] = cerezler;
    const veri = Buffer.from(await yanit.arrayBuffer());
    res.writeHead(yanit.status, cikis);
    res.end(veri);
  };
  // http her zaman (program ve Node istemcileri); tls: true ise ayrıca https (Chromium: güvenli bağlam, Secure çerez, service worker).
  const sunucu = http.createServer((req, res) => isle(false)(req, res).catch(() => res.end()));
  await new Promise(resolve => sunucu.listen(0, "127.0.0.1", resolve));
  const port = sunucu.address().port;
  let tlsSunucu = null;
  if (tls) {
    const sertifika = selfSignedCert(`*.${alan}`);
    tlsSunucu = https.createServer({ cert: sertifika.cert, key: sertifika.key }, (req, res) => isle(true)(req, res).catch(() => res.end()));
    await new Promise(resolve => tlsSunucu.listen(0, "127.0.0.1", resolve));
  }
  return {
    base: `http://127.0.0.1:${port}`,
    port,
    tlsPort: tlsSunucu ? tlsSunucu.address().port : null,
    alan,
    r2,
    onbellek,
    gunluk,
    env,
    kapi,
    /** Ofisin "tüneli": kapıcının canlı istekleri ileteceği uzak dinleyici adresi (null = tünel kapalı / ofis kapalı). */
    tunel: (ofis, taban) => (taban ? kokenler.set(ofis, taban) : kokenler.delete(ofis)),
    ofisHost: ofis => `${ofis}.${alan}`,
    meta: ofis => {
      const kayit = r2.nesneler.get(`ofis/${ofis}/meta.json`);
      return kayit ? JSON.parse(new TextDecoder().decode(kayit.veri)) : null;
    },
    close: async () => {
      sunucu.closeAllConnections?.();
      await new Promise(resolve => sunucu.close(() => resolve()));
      if (tlsSunucu) {
        tlsSunucu.closeAllConnections?.();
        await new Promise(resolve => tlsSunucu.close(() => resolve()));
      }
    },
  };
}
