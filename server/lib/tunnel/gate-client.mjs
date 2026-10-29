// 2.4.7 M4 — kapıcı istemcisi: programın kendi tünelini kapıcıdan istemesi (docs/mobil/M4-TASARIM.md §2; kapıcı tarafı bulut/kapi/tunel.mjs).
//
// İstek: POST <kapıcı>/v1/tunel { v, license (imzalı lisans zarfı, olduğu gibi), machine, publicKey, ts, nonce, sig }.
//   sig = programın KENDİ Ed25519 anahtarıyla provisionMessage() imzası. Lisans zarfı tek başına yetmez (internetsiz etkinleştirme kodu e-postayla dolaşabilir —
//   zarfın kendisidir); kapıcı ofisin ilk başvurusundaki açık anahtarı ofise bağlar (ilk kullanımda güven) ve sonraki başvurularda aynı anahtarı ister.
// Yanıt: { ok, tunnelId, hostname, publicUrl, token }. Tünel çalıştırma belirteci YALNIZ bellekte tutulur (diske, günlüğe, ekrana yazılmaz); Cloudflare
// hesap belirteci hiçbir zaman programa gelmez (yalnız Worker gizlisinde).
// Programın anahtarı ortak katman ayarında (mobile.tunnel.key), veri klasöründeki kasa anahtarıyla (secret-box) mühürlü: veri tabanı yedeği tek başına
// anahtarı açığa çıkarmaz.
import { createHash, createPrivateKey, createPublicKey, generateKeyPairSync, randomBytes, sign } from "node:crypto";
import { TunnelError } from "./download.mjs";

export const TUNNEL_GATE_PATH = "/v1/tunel";
export const DEFAULT_GATE_URL = "https://kapi.destekofis.net";
const KEY_SETTING = "mobile.tunnel.key";

/** Kapıcının da aynen kurduğu imza metni (bulut/kapi/tunel.mjs provisionMessage ile birebir). */
export const provisionMessage = ({ machine, publicKey, ts, nonce, licenseHash }) => `DestekOfis-tunel-v1\n${machine}\n${publicKey}\n${ts}\n${nonce}\n${licenseHash}`;
export const licenseHashOf = licenseText => createHash("sha256").update(String(licenseText)).digest("hex");

/** Programın tünel anahtarı (yoksa üretir). { privateKey, publicKey (SPKI DER base64) } */
export function programKey({ store, box }) {
  const sealed = store.setting(KEY_SETTING, "");
  let pem = sealed ? (box ? box.open(sealed) : sealed) : "";
  if (!pem) {
    const pair = generateKeyPairSync("ed25519");
    pem = pair.privateKey.export({ type: "pkcs8", format: "pem" });
    store.setSetting(KEY_SETTING, box ? box.seal(pem) : pem);
  }
  const privateKey = createPrivateKey(pem);
  const publicKey = createPublicKey(privateKey).export({ type: "spki", format: "der" }).toString("base64");
  return { privateKey, publicKey };
}

const GATE_ERRORS = {
  "tunnel-license": "Lisans kapıcı tarafından doğrulanamadı; uzaktan bağlantı açılamadı.",
  "tunnel-key": "Bu ofisin uzaktan bağlantısı başka bir kurulumla eşli. Destek ile iletişime geçin.",
  "tunnel-machine": "Lisans bu bilgisayara ait değil.",
  "tunnel-signature": "Program kapıcıya kendini doğrulayamadı.",
  "tunnel-request": "Kapıcı isteği tanımadı.",
  "tunnel-cloudflare": "Bağlantı hizmeti şu an yanıt vermiyor; birazdan yeniden denenecek.",
};

/**
 * @param {object} o
 * @param {string} o.gateUrl kapıcı adresi (ör. https://kapi.destekofis.net)
 * @param {Function} o.fetchImpl vekil sunucuya uyan fetch
 * @param {object} o.store ortak katman deposu (lisans zarfı license.token, anahtar)
 * @param {object} [o.box] secret-box
 */
export function createGateClient({ gateUrl = DEFAULT_GATE_URL, fetchImpl, store, box = null, timeoutMs = 20_000, now = () => Date.now() }) {
  async function provision() {
    const licenseText = store.setting("license.token", "");
    if (!licenseText) throw new TunnelError("license", "Lisans bilgisi yok; uzaktan bağlantı açılamaz.");
    let license;
    try {
      license = JSON.parse(licenseText);
    } catch {
      throw new TunnelError("license", "Kayıtlı lisans bilgisi okunamadı.");
    }
    let machine = "";
    try {
      machine = JSON.parse(Buffer.from(license.payload, "base64").toString("utf8")).machine || "";
    } catch {
      machine = "";
    }
    const { privateKey, publicKey } = programKey({ store, box });
    const ts = new Date(now()).toISOString();
    const nonce = randomBytes(16).toString("base64url");
    const message = provisionMessage({ machine, publicKey, ts, nonce, licenseHash: licenseHashOf(license.payload) });
    const sig = sign(null, Buffer.from(message, "utf8"), privateKey).toString("base64");
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);
    timer.unref?.();
    let response;
    try {
      response = await fetchImpl(`${String(gateUrl).replace(/\/+$/, "")}${TUNNEL_GATE_PATH}`, {
        method: "POST",
        headers: { "content-type": "application/json", "user-agent": "DestekOfis" },
        body: JSON.stringify({ v: 1, license, machine, publicKey, ts, nonce, sig }),
        signal: controller.signal,
      });
    } catch (error) {
      throw new TunnelError("gate", "Kapıcıya ulaşılamadı (internet bağlantısı yok ya da engelli).", error);
    } finally {
      clearTimeout(timer);
    }
    let data = null;
    try {
      data = await response.json();
    } catch {
      data = null;
    }
    if (!response.ok || !data?.ok) {
      const code = String(data?.code || "");
      const error = new TunnelError(response.status >= 500 || !response.status ? "gate" : "gate-refused", GATE_ERRORS[code] || `Kapıcı isteği reddetti (HTTP ${response.status}).`);
      error.gateCode = code;
      error.status = response.status;
      throw error;
    }
    const { tunnelId, hostname, token } = data;
    if (!tunnelId || !hostname || !token) throw new TunnelError("gate", "Kapıcı yanıtı eksik.");
    return { tunnelId: String(tunnelId), hostname: String(hostname).toLowerCase(), publicUrl: `https://${String(hostname).toLowerCase()}`, token: String(token) };
  }
  return { provision };
}
