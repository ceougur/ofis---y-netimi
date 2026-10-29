// 2.4.7 M4 — kapıcı istemcisi: programın kendi tünelini kapıcıdan istemesi (docs/mobil/M4-TASARIM.md §2; kapıcı tarafı bulut/kapi/tunel.mjs).
//
// Kimlik doğrulama M3'ün düzeni, AYNEN (yeni yol yok): ofis kimliği ve ECDSA P-256 imza anahtarı lib/mobile-ozet.mjs ofisKaydi() (ortak katman ayarı
// meta.mobile.office); istek `POST <kapıcı>/v1/ofis/<ofis>/tunel`, gövde { v: 1, ofis }, imza mesaj.ofis("POST", yol, ms, sha256(gövde)) → x-do-zaman / x-do-imza.
// Kapıcı ofisi M3 kaydından tanır (lisans belirteci + ofis anahtarı ilk kayıtta bağlanır); kayıt yoksa "kapi-ofis-yok" döner — yönetici M3'ün kaydını
// (mobileSync.kayitGonder) bir kez tetikleyip yeniden dener (attach.mjs).
// Yanıt: { tunnelId, hostname, publicUrl, token }. Tünel çalıştırma belirteci YALNIZ bellekte tutulur (diske, günlüğe, ekrana yazılmaz); Cloudflare hesap
// belirteci hiçbir zaman programa gelmez (yalnız Worker gizlisinde).
import { ecdsaImzala, mesaj, sha256Hex } from "../kapi-protokol.mjs";
import { ofisKaydi } from "../mobile-ozet.mjs";
import { TunnelError } from "./download.mjs";

const GATE_ERRORS = {
  "kapi-ofis-yok": "Ofis kapıcıda henüz kayıtlı değil; kayıt yapılıp yeniden denenecek.",
  "kapi-imza": "Program kapıcıya kendini doğrulayamadı.",
  "kapi-zaman": "Bu bilgisayarın saati yanlış görünüyor; saat düzeltilince bağlantı açılır.",
  "kapi-lisans": "Lisans kapıcı tarafından geçerli görülmedi; uzaktan bağlantı açılamadı.",
  "kapi-lisans-dogrulanamadi": "Lisans kapıcıda doğrulanamadı; birazdan yeniden denenecek.",
  "kapi-istek": "Kapıcı isteği tanımadı.",
  "kapi-tunel": "Bağlantı hizmeti şu an yanıt vermiyor; birazdan yeniden denenecek.",
  "kapi-tunel-ayar": "Kapıcının bağlantı hizmeti ayarı eksik; destek bilgilendirilmeli.",
};

/**
 * @param {object} o
 * @param {string} o.gateUrl kapıcı adresi (M3 config.mobileKapiUrl; ör. https://kapi.destekofis.net)
 * @param {Function} o.fetchImpl vekil sunucuya uyan fetch
 * @param {object} o.store ortak katman deposu (M3 ofis kaydı)
 * @param {() => number} [o.now] saat (ms; M3 ile aynı: config.remoteNow)
 */
export function createGateClient({ gateUrl, fetchImpl, store, now = () => Date.now(), timeoutMs = 20_000 }) {
  async function provision() {
    const ofis = await ofisKaydi(store);
    const yol = `/v1/ofis/${ofis.id}/tunel`;
    const govde = JSON.stringify({ v: 1, ofis: ofis.id });
    const ms = now();
    const imza = await ecdsaImzala(ofis.imzaAnahtari, mesaj.ofis("POST", yol, ms, await sha256Hex(govde)));
    let response;
    try {
      response = await fetchImpl(`${String(gateUrl).replace(/\/+$/, "")}${yol}`, {
        method: "POST",
        headers: { "content-type": "application/json", accept: "application/json", "x-do-zaman": String(ms), "x-do-imza": imza },
        body: govde,
        signal: AbortSignal.timeout(timeoutMs),
      });
    } catch (error) {
      throw new TunnelError("gate", "Kapıcıya ulaşılamadı (internet bağlantısı yok ya da engelli).", error);
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
    const { tunnelId, hostname, token } = data.data || {};
    if (!tunnelId || !hostname || !token) throw new TunnelError("gate", "Kapıcı yanıtı eksik.");
    const host = String(hostname).toLowerCase();
    return { tunnelId: String(tunnelId), hostname: host, publicUrl: `https://${host}`, token: String(token) };
  }
  return { provision };
}
