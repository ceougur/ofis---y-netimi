// 2.5.0 WE — "Elle Bağla"nın UYGULAMA DÜZEYİ webhook bilgileri (docs/erp/WHATSAPP-PAKETI-2.5.0-PLANI.md §1 WE; 2.4.9 teslim notu (d) "Elle Bağla webhook Callback URL +
// Verify token kalıcı çözüm"). Meta, Elle Bağla'da müşterinin kendi uygulamasının WhatsApp ayarlarında bir varsayılan webhook adresi (Configure Webhooks → Callback URL +
// Verify token → Verify and save) ister; program bildirim adresini (WABA'ya alternatif adres, lib/whatsapp/connection.mjs registerHook) ancak bundan sonra kaydedebilir.
// Bu iki değeri artık program kendisi verir (kılavuzdaki "destekten alın" kalktı):
//   Callback URL  <ofisin telefon adresi>/wa/kanca/<32 baytlık gizli yol>  — kapıcının cihazsız geçirdiği kanca yolu (bulut/kapi/kapi.mjs KANCA_YOLU; kapıcı değişmez).
//   Verify token  32 baytlık rastgele belirteç.
// KURULUM BAŞINA tek çift (bütün şirketler, bütün Meta uygulamaları aynı değerleri girebilir): ortak katmanın (001) ayarında "whatsapp.appWebhook", ikisi de secret-box ile
// MÜHÜRLÜ (anahtar veri klasöründe secret.key — yedeğe girmez) + SHA-256 karmaları (gelen istek karmayla karşılaştırılır; açık değer yalnız yöneticinin ekranında açılır).
// GİZLİ BİLGİ (plan 2.4.8 §4 "kanca gizli yolu ve verify_token belirteç gibi saklanır"): günlüğe, işlem geçmişine, hata iletisine, başka dosyaya girmez; yalnız
// system.manage (yönetici) görür. Şirket Verisini Sıfırla'da (KEEP_SETTINGS "whatsapp") ve 001'in yedekten geri yüklenmesinde (company-backups.mjs COMMON_SETTINGS) korunur. Mühür bu bilgisayarda açılamıyorsa (veri başka bilgisayardan taşındı) yeni çift
// üretilir — Meta'da yeniden girilir.
// Bu adrese gelen istek (lib/whatsapp/hook.mjs): GET doğrulaması (hub.verify_token → hub.challenge). POST — KULLANICI KARARI S41 = A (06.11.2026; baş mimar kararı (5)
// "uygulama düzeyi POST işlenmez" bu durum için KALKTI): Meta'da WABA'nın alternatif adresi yokken bildirim buraya gelir; bu kurulumda kaydı olan WABA'nın bildirimi
// alternatif adresle AYNI kurallarla işlenir (Yol 1 imzasız kabul, Yol 2 yalnız imzalı; kaydı olmayan WABA'nınki düşer) ve Meta'daki adres hemen yeniden denetlenir
// (aşağıda rechecks: WABA başına tek uçuş + en çok APP_LEVEL_RECHECK_MS'de bir; tasarım docs/erp/WA-TUR1-TASARIM.md §3).
import { randomBytes } from "node:crypto";
import { createSecretBox } from "../secret-box.mjs";
import { isSchemaAhead } from "../migrations.mjs";
import { HOOK_PATH, hookBase, sha256, usableBase } from "./connection.mjs";

export const APP_WEBHOOK_KEY = "whatsapp.appWebhook";
const HASH = /^[0-9a-f]{64}$/;
export const APP_WEBHOOK_NOT_READY = "Ofisin uzaktan bağlantı adresi henüz hazır değil; Yönetim → Mobil Cihazlar'da uzaktan bağlantı açılınca bildirim adresi burada görünür.";
// 2.5.0 WE + BS-7 (gerileme düzeltmesi; docs/2.5.0-IS-LISTESI.md): ortak katmanın (001) veri dosyası programın daha yeni bir sürümüyle açılmışsa (şema sürüm kapısı,
// app.mjs schemaGate) o dosyaya YAZILMAZ — çift yoksa ya da bu bilgisayarda açılamıyorsa üretilmez, yanıt ready false + bu neden. Var olan çift okunur ve gösterilir
// (okuma yazma değildir). Kapının ortak katman istisnası yalnız giriş / lisans / şirket seçimidir; webhook çifti ona girmez.
export const APP_WEBHOOK_SCHEMA_AHEAD = "001 şirketinin verisi programın daha yeni bir sürümüyle açıldığı için webhook bilgileri hazırlanamıyor; programı güncelleyince burada görünür.";
// 2.5.0 BİRLEŞİK TUR 5 madde 7 (BAŞ MİMAR KARARI; WE + BS-7 ile aynı düzen — okuma yazma değildir): salt okunur lisansta (genel kapı GET'i kesmez) çift YOKSA ya da bu
// bilgisayarda açılamıyorsa ÜRETİLMEZ — yanıt ready false + bu neden; var olan çift okunur ve gösterilir. Lisans durumu çağıranın: reveal(publicUrl, { writable }).
export const APP_WEBHOOK_READ_ONLY = "Lisans salt okunur; Webhook Bilgileri lisans etkinleşince gösterilir.";
// S41 = A: uygulama düzeyi adrese bildirim gelince Meta'daki alternatif adresin yeniden denetlenme sıklığı (WABA başına). Meta her durum için ayrı POST gönderir; her POST'ta
// Meta'ya istek gitmez. Bellekte tutulur (program yeniden açılınca ilk bildirimde yine hemen); bakım turunun saatlik denetimi ayrıca sürer.
export const APP_LEVEL_RECHECK_MS = 15 * 60_000;

/**
 * @param {object} o
 * @param {object} o.store ortak katmanın (001) deposu — setting / setSetting
 * @param {string} o.dataDir secret.key'in klasörü (ortak katmanın veri klasörü)
 */
export function createAppWebhook({ store, dataDir, now = () => new Date() }) {
  let box = null;
  // Kapı: deponun kendi dosyasının şema numarası (app.mjs schemaGate ile aynı ölçüt: migrations.mjs isSchemaAhead). Her üretimden ÖNCE okunur; okunamazsa hata
  // yukarı çıkar (uç 503 "hazırlanamadı" der) — yazmaya düşülmez.
  const schemaAhead = () => Boolean(store.db) && isSchemaAhead(Number(store.db.prepare("PRAGMA user_version").get()?.user_version));
  const secrets = () => (box ||= createSecretBox(dataDir || "."));
  function record() {
    let raw = null;
    try {
      raw = JSON.parse(store.setting(APP_WEBHOOK_KEY, "") || "null");
    } catch {
      raw = null;
    }
    if (!raw || typeof raw !== "object" || !HASH.test(String(raw.pathHash || "")) || !HASH.test(String(raw.verifyHash || ""))) return null;
    return raw;
  }
  function create() {
    const path = randomBytes(32).toString("base64url");
    const verify = randomBytes(32).toString("base64url");
    const row = { v: 1, pathSealed: secrets().seal(path), verifySealed: secrets().seal(verify), pathHash: sha256(path), verifyHash: sha256(verify), at: now().toISOString() };
    store.setSetting(APP_WEBHOOK_KEY, JSON.stringify(row));
    return { path, verify };
  }
  /** Kanca isteğinin gizli yolu bu kurulumun uygulama düzeyi adresi mi (karmayla). */
  function matchesPath(secret) {
    const row = record();
    return Boolean(row && HOOK_PATH.test(String(secret || "")) && sha256(secret) === row.pathHash);
  }
  /** Meta'nın GET doğrulamasındaki belirteç bu kurulumunki mi (karmayla). */
  function matchesVerify(token) {
    const row = record();
    return Boolean(row && token && sha256(token) === row.verifyHash);
  }
  /**
   * Yöneticinin ekranı için açık değerler (yoksa ya da bu bilgisayarda açılamıyorsa üretilir; 001 şema kapısındaysa ya da lisans salt okunursa ÜRETİLMEZ). publicUrl: ofisin
   * uzaktan adresi; writable: lisans yazılabilir mi (false → salt okunur). Dönüş: { ready, callbackUrl ("" — adres hazır değil), verifyToken ("" — üretilemedi), reason }.
   */
  function reveal(publicUrl, { writable = true } = {}) {
    const row = record();
    let path = row ? secrets().open(row.pathSealed) : "";
    let verify = row ? secrets().open(row.verifySealed) : "";
    if (!HOOK_PATH.test(String(path || "")) || !verify || sha256(path) !== row?.pathHash || sha256(verify) !== row?.verifyHash) {
      if (schemaAhead()) return { ready: false, callbackUrl: "", verifyToken: "", reason: APP_WEBHOOK_SCHEMA_AHEAD };
      if (writable === false) return { ready: false, callbackUrl: "", verifyToken: "", reason: APP_WEBHOOK_READ_ONLY };
      ({ path, verify } = create());
    }
    const base = hookBase(publicUrl);
    const ready = usableBase(base);
    return { ready, callbackUrl: ready ? `${base}/wa/kanca/${path}` : "", verifyToken: verify, reason: ready ? "" : APP_WEBHOOK_NOT_READY };
  }
  // S41 = A — "Meta'daki adres hemen yeniden denetlenir": denetimin kendisi kancada (lib/whatsapp/hook.mjs; bağlı şirketin connection.ensureHook'u). Burada yalnız sıklık:
  // WABA başına tek uçuş + en çok APP_LEVEL_RECHECK_MS'de bir (programın saatiyle; saat geri giderse beklenmez). settled(): süren denetimlerin bitişi (testler ve kapanış).
  const lastRecheck = new Map(); // WABA → son denetimin başladığı an (ms)
  const flying = new Map(); // WABA → süren denetim
  const rechecks = {
    /** task: () => Promise. Denetim başlatıldıysa true; aynı WABA'da süren denetim varsa ya da son denetim APP_LEVEL_RECHECK_MS'den yeniyse false. Görev hatası yutulur. */
    request(wabaId, task) {
      const key = String(wabaId || "");
      if (!key || flying.has(key)) return false;
      const at = now().getTime();
      const previous = lastRecheck.get(key);
      if (Number.isFinite(previous) && at >= previous && at - previous < APP_LEVEL_RECHECK_MS) return false;
      lastRecheck.set(key, at);
      const run = Promise.resolve()
        .then(task)
        .catch(() => null)
        .finally(() => flying.delete(key));
      flying.set(key, run);
      return true;
    },
    settled: () => Promise.allSettled([...flying.values()]),
  };
  return { matchesPath, matchesVerify, reveal, rechecks };
}
