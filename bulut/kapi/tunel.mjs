// 2.4.7 M4 — KAPICI (Cloudflare Worker) tarafının TÜNEL bölümü (docs/mobil/M4-TASARIM.md §2). M3'ün kapıcısı (bulut/kapi/kapi.mjs) bu modülü içe aktarır
// ve `POST /v1/ofis/<ofis>/tunel` isteğini tunelIstegi'ne verir (bağlama: tasarım §9 — kapi.mjs'e içe aktarma + tek satır). Yeni bir kimlik doğrulama yolu
// YOK: M3'ün ofis kaydı ve imzası aynen kullanılır (lib/kapi-protokol.mjs):
//   1. ofis kimliği `o` + 16 base32 (OFIS_KIMLIGI); kapıcıda kayıtlı olmalı (M3 kayit ucu: lisans belirteci Ed25519 + ofisin ECDSA P-256 anahtarı, ilk
//      kayıtta bağlanır — ilk kullanımda güven M3'te);
//   2. istek ofisin KENDİ anahtarıyla imzalı: mesaj.ofis("POST", yol, ms, sha256(gövde)), başlıklar x-do-zaman / x-do-imza, ±5 dk (M3 ofisImzasi ile aynı);
//      başka ofisin anahtarıyla imzalı istek o ofisin tünelini alamaz;
//   3. lisans M3'ün görünümüyle (P9: en çok 1 saat eski; engelli/bitmiş → ret) — kapi.mjs kendi lisansGorunumu işlevini verir;
//   4. Cloudflare: tünel `destekofis-<ofis>` yoksa oluşturulur (config_src "local" — giriş kuralı programda), varsa YENİDEN KULLANILIR; DNS CNAME
//      `<ofis>.<OFIS_ALANI>` → `<tünel>.cfargotunnel.com` (proxied: M3 rotası `*.destekofis.net/*` bu adın ÖNÜNDE durur, Worker canlı isteği kapıdan sonra
//      rota kökenine = tünele iletir) yoksa eklenir, farklıysa düzeltilir; tünel çalıştırma belirteci alınır;
//   5. yanıt { ok, data: { tunnelId, hostname, publicUrl, token } } — Cloudflare HESAP belirteci (env.CF_API_TOKEN) hiçbir zaman yanıta girmez; kapıcı
//      tünel kimliğini saklamaz (ad ofis kimliğinden türer; ofis kaydına — meta.json — yazmaz → M3'ün koşullu yazımıyla yarış yok).
//   6. (bağımsız gözden geçirme B3) yalnız makinenin GÜNCEL ofisi tünel alır (bulut/kapi/makine.mjs tek eşleme; değilse 410 kapi-ofis-degisti), makine
//      başına saatlik başvuru sınırı (429 kapi-hiz); devre dışı kalan eski ofislerin tüneli ve DNS kaydı burada da silinir (ofisTuneliniSil).
// Yalnız Web standartları (fetch, Request/Response, WebCrypto): Worker'da ve Node 22'de aynı kod; Cloudflare API soyut fetch ile (testte sahte).
import { KAPI_KURALLARI as K, OFIS_KIMLIGI, ecdsaDogrula, mesaj, sha256Hex } from "../../server/lib/kapi-protokol.mjs";
import { MakineHatasi, bekleyenleriIsle, metaAnahtari, tunelMakine } from "./makine.mjs";

export const TUNEL_YOLU = /^\/v1\/ofis\/([^/]+)\/tunel$/;
const CF_API = "https://api.cloudflare.com/client/v4";
const GOVDE_AZAMI = 4 * 1024;

const HATA = Object.freeze({
  "kapi-istek": [400, "İstek okunamadı."],
  "kapi-ofis-yok": [404, "Bu ofis kapıcıda kayıtlı değil. Ofisteki programın internete bağlı olduğunu denetleyin."],
  "kapi-imza": [401, "İmza doğrulanamadı."],
  "kapi-zaman": [401, "Cihazın saati sunucunun saatiyle uyuşmuyor."],
  "kapi-lisans": [403, "Lisans geçerli değil; uzaktan erişim kapalı."],
  "kapi-lisans-dogrulanamadi": [503, "Lisans bir saattir doğrulanamadı; uzaktan erişim geçici olarak kapalı."],
  "kapi-tunel": [502, "Bağlantı hizmeti şu an yanıt vermiyor; birazdan yeniden denenecek."],
  "kapi-tunel-ayar": [500, "Kapıcının bağlantı hizmeti ayarı eksik."],
  "kapi-ofis-degisti": [410, "Bu ofis kimliği kapandı: aynı lisans yeni bir kurulumla kaydoldu. Uzaktan erişim yeni kurulumdan sürer."],
  // kapi-ofis-yok yukarıda: makine eşlemesi olmayan eski biçim kayıt da bu kodu alır (program kaydı yenileyip yeniden başvurur).
  "kapi-hiz": [429, "Çok sık istek; biraz sonra yeniden deneyin."],
  "kapi-yaris": [409, "Eşzamanlı güncelleme; yeniden deneyin."],
});
const json = (status, body) => new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json; charset=utf-8", "cache-control": "no-store", "x-content-type-options": "nosniff" } });
class TunelHatasi extends Error {
  constructor(kod, ek = {}) {
    super(kod);
    this.kod = kod;
    this.ek = ek;
  }
}
const at = (kod, ek) => {
  throw new TunelHatasi(kod, ek);
};

/**
 * Cloudflare API (soyut fetch). Belirteç izinleri: Account → Cloudflare Tunnel: Edit; Zone (alan) → DNS: Edit.
 */
export function createCloudflareTunnels({ accountId, zoneId, apiToken, fetchImpl = (...args) => fetch(...args) }) {
  async function call(method, path, body) {
    let response;
    try {
      response = await fetchImpl(`${CF_API}${path}`, { method, headers: { authorization: `Bearer ${apiToken}`, "content-type": "application/json" }, body: body ? JSON.stringify(body) : undefined });
    } catch {
      at("kapi-tunel");
    }
    let data = null;
    try {
      data = await response.json();
    } catch {
      data = null;
    }
    if (!response.ok || !data?.success) at("kapi-tunel", { cf: `${method} ${path.split("?")[0]} → ${response.status}` });
    return data.result;
  }
  return {
    async findTunnel(name) {
      const list = await call("GET", `/accounts/${accountId}/cfd_tunnel?name=${encodeURIComponent(name)}&is_deleted=false`);
      return (Array.isArray(list) ? list : []).find(item => item?.name === name && !item.deleted_at) || null;
    },
    async createTunnel(name) {
      const sir = new Uint8Array(32);
      crypto.getRandomValues(sir);
      return call("POST", `/accounts/${accountId}/cfd_tunnel`, { name, tunnel_secret: btoa(String.fromCharCode(...sir)), config_src: "local" });
    },
    tunnelToken: id => call("GET", `/accounts/${accountId}/cfd_tunnel/${id}/token`),
    async ensureCname(hostname, target) {
      const list = await call("GET", `/zones/${zoneId}/dns_records?type=CNAME&name=${encodeURIComponent(hostname)}`);
      const found = (Array.isArray(list) ? list : []).find(item => item?.name === hostname);
      if (!found) return call("POST", `/zones/${zoneId}/dns_records`, { type: "CNAME", name: hostname, content: target, proxied: true, ttl: 1, comment: "DestekOfis ofis tüneli (kapıcı)" });
      if (found.content === target && found.proxied === true) return found;
      return call("PATCH", `/zones/${zoneId}/dns_records/${found.id}`, { content: target, proxied: true });
    },
    // B3: devre dışı ofisin tüneli. Bağlı cloudflared varken Cloudflare tüneli silmez → önce bağlantıları temizlenir (başarısızsa da silme denenir).
    async deleteTunnel(id) {
      try {
        await call("DELETE", `/accounts/${accountId}/cfd_tunnel/${id}/connections`);
      } catch {
        // bağlantı yoksa ya da temizlenemediyse silme yine denenir (asıl sonuç silmenin yanıtı)
      }
      return call("DELETE", `/accounts/${accountId}/cfd_tunnel/${id}`);
    },
    async deleteCname(hostname) {
      const list = await call("GET", `/zones/${zoneId}/dns_records?type=CNAME&name=${encodeURIComponent(hostname)}`);
      for (const item of (Array.isArray(list) ? list : []).filter(record => record?.name === hostname)) await call("DELETE", `/zones/${zoneId}/dns_records/${item.id}`);
      return true;
    },
  };
}

/** Worker ortamında Cloudflare ayarı varsa API istemcisi, yoksa null (kayıt sırasındaki temizlik yalnız ayar varken; tünel ucu ayarsız 500 verir). */
export const cloudflareVarsa = env =>
  env.CF_API_TOKEN && env.CF_ACCOUNT_ID && env.CF_ZONE_ID ? createCloudflareTunnels({ accountId: env.CF_ACCOUNT_ID, zoneId: env.CF_ZONE_ID, apiToken: env.CF_API_TOKEN }) : null;

/** B3: devre dışı ofisin tünelini (destekofis-<ofis>) ve DNS kaydını (<ofis>.<alan>) siler. Dönüş true (bulunamayan zaten silinmiş sayılır). */
export async function ofisTuneliniSil(cf, ofis, alan) {
  const tunel = await cf.findTunnel(`destekofis-${ofis}`);
  if (tunel) await cf.deleteTunnel(tunel.id);
  await cf.deleteCname(`${ofis}.${String(alan || "destekofis.net").toLowerCase()}`);
  return true;
}

const cloudflareOf = env => {
  if (!env.CF_API_TOKEN || !env.CF_ACCOUNT_ID || !env.CF_ZONE_ID) at("kapi-tunel-ayar");
  return createCloudflareTunnels({ accountId: env.CF_ACCOUNT_ID, zoneId: env.CF_ZONE_ID, apiToken: env.CF_API_TOKEN });
};

/**
 * Tünel başvurusu. kapi.mjs fetchHandler'ından: `if (TUNEL_YOLU.test(url.pathname)) return tunelIstegi(request, env, { now, lisansGorunumu });`
 * @param {Request} request
 * @param {object} env Worker ortamı: OZET (R2; M3'ün ofis kaydı ofis/<ofis>/meta.json), OFIS_ALANI, CF_API_TOKEN (gizli), CF_ACCOUNT_ID, CF_ZONE_ID
 * @param {object} o
 * @param {() => number} o.now
 * @param {(env, meta) => Promise<{ durum: "gecerli"|"gecersiz"|"dogrulanamadi" }>} o.lisansGorunumu M3 kapıcısının P9 lisans görünümü
 * @param {object} [o.cloudflare] testte sahte (yoksa env'den)
 */
export async function tunelIstegi(request, env, { now = () => Date.now(), lisansGorunumu, cloudflare = null } = {}) {
  try {
    const url = new URL(request.url);
    const eslesme = TUNEL_YOLU.exec(url.pathname);
    if (!eslesme || request.method !== "POST") at("kapi-istek");
    const ofis = eslesme[1];
    if (!OFIS_KIMLIGI.test(ofis)) at("kapi-istek");
    if (Number(request.headers.get("content-length") || 0) > GOVDE_AZAMI) at("kapi-istek");
    const metin = new TextDecoder().decode(await request.arrayBuffer());
    if (metin.length > GOVDE_AZAMI) at("kapi-istek");
    const nesne = await env.OZET.get(metaAnahtari(ofis));
    if (!nesne) at("kapi-ofis-yok");
    const meta = await nesne.json();
    // M3 ofisImzasi ile aynı: zaman payı, sonra ofis anahtarıyla imza.
    const ms = Number(request.headers.get("x-do-zaman"));
    if (!Number.isSafeInteger(ms) || Math.abs(now() - ms) > K.zamanPayiMs) at("kapi-zaman", { zaman: now() });
    if (!(await ecdsaDogrula(meta.anahtar, mesaj.ofis("POST", url.pathname, ms, await sha256Hex(metin)), request.headers.get("x-do-imza") || ""))) at("kapi-imza");
    let govde;
    try {
      govde = JSON.parse(metin);
    } catch {
      at("kapi-istek");
    }
    if (govde?.v !== 1 || govde.ofis !== ofis || meta.ofis !== ofis) at("kapi-istek");
    // B3: devre dışı (aynı makine yeni ofisle kaydoldu) ofis tünel alamaz.
    if (meta.devreDisi) at("kapi-ofis-degisti");
    if (typeof lisansGorunumu !== "function") at("kapi-tunel-ayar");
    const gorunum = await lisansGorunumu(env, meta);
    if (gorunum?.durum === "dogrulanamadi") at("kapi-lisans-dogrulanamadi");
    // 2.4.8 L1: ücretli lisansın 30 günlük hoşgörüsünde de tünel verilir (canlı bağlantı salt okunur; kapi-protokol mobilHakki — programla aynı kural).
    if (gorunum?.durum !== "gecerli" && gorunum?.durum !== "hosgoru") at("kapi-lisans");

    const cf = cloudflare || cloudflareOf(env);
    const alan = String(env.OFIS_ALANI || "destekofis.net").toLowerCase();
    // B3: yalnız makinenin güncel ofisi + makine başına saatlik sınır; sonra makinenin devre dışı eski ofislerinin tüneli ve DNS kaydı silinir.
    await tunelMakine(env, { makine: meta.makine, ofis, simdi: now() });
    await bekleyenleriIsle(env, meta.makine, { simdi: now(), temizle: eski => ofisTuneliniSil(cf, eski, alan) });
    const ad = `destekofis-${ofis}`;
    const hostname = `${ofis}.${alan}`;
    let tunel = await cf.findTunnel(ad);
    if (!tunel) {
      try {
        tunel = await cf.createTunnel(ad);
      } catch (error) {
        // Eşzamanlı iki başvuru: ikincisi "ad var" alır → yeniden ara.
        tunel = await cf.findTunnel(ad);
        if (!tunel) throw error;
      }
    }
    await cf.ensureCname(hostname, `${tunel.id}.cfargotunnel.com`);
    const token = await cf.tunnelToken(tunel.id);
    if (typeof token !== "string" || !token) at("kapi-tunel");
    return json(200, { ok: true, data: { tunnelId: tunel.id, hostname, publicUrl: `https://${hostname}`, token } });
  } catch (error) {
    if (error instanceof TunelHatasi || (error instanceof MakineHatasi && HATA[error.kod])) {
      const [status, mesajMetni] = HATA[error.kod];
      return json(status, { ok: false, code: error.kod, error: mesajMetni, ...(error.ek?.zaman ? { zaman: error.ek.zaman } : {}) });
    }
    return json(500, { ok: false, code: "kapi-hata", error: "Kapıcı isteği işleyemedi." });
  }
}
