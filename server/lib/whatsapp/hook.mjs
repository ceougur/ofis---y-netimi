// 2.4.8 W9 — WhatsApp durum bildirimi (web kancası) PROGRAM ucu (docs/erp/WHATSAPP-API-PLANI-2.4.8.md §3 C, §6 W9; §11 S1 A; §7a 3, 16–18).
//
// Yol: Meta → https://<ofis>.destekofis.net/wa/kanca/<32 baytlık gizli yol> → kapıcı (bulut/kapi/kapi.mjs; cihaz denetimi YOK, saklamaz, çerez/başlık geçmez,
// "x-do-kapi" işareti) → ofisin tüneli → uzak dinleyici (app.mjs remoteServer) → BURASI. Mobil uzak oturum kapısından (lib/mobile-remote.mjs) ÖNCE işlenir:
// kanca isteğinin cihazı/oturumu yoktur; mobil özetin yazma tetiği (mobileSync.izle) de çalışmaz (kanca veri yazması değildir).
//
// Doğrulama: kapıcı açıkken (mobileSync.enabled) işaret ZORUNLU (tüneli atlatan istek 401). İşaretin cihaz bölümü "wa1" = kapıcı Meta imzasını (X-Hub-Signature-256)
// DestekOfis uygulama sırrıyla doğruladı (Yol 2, "WhatsApp'ı Bağla"), "wa0" = imzasız / doğrulanamadı (Yol 1 "Elle Bağla": imza müşterinin uygulama sırrıyla atılır,
// programda o sır YOK — plan §3 C). Yol 2 bağlantısında imzasız istek reddedilir (BAŞ MİMAR KARARI: plan "kapıcı geçersizi düşürür" der; kapıcı şirketin yolunu
// bilmediğinden imzasızı "wa0" diye geçirir, düşürme programda — etki aynı). Gizli yol karmasıyla şirket bulunur (lib/whatsapp/hub.mjs registry); şirket açık
// değilse açılır, geri yükleniyorsa 503 (Meta 7 gün yeniden dener). Yinelenen / sırasız bildirim etkisizdir (queue.applyStatuses yalnız ileri yazar).
//   GET  ?hub.mode=subscribe&hub.verify_token=…&hub.challenge=… → 200 challenge (düz metin) | 403
//   POST { object, entry[].changes[] { field: "messages", value: { metadata.phone_number_id, statuses[] } } } → 200 (durumlar yazılır; gelen ileti / öbür alanlar
//        SAKLANMAZ — kapsam dışı)
import { HOOK_PATH, sha256 } from "./connection.mjs";
import { META_D0 } from "./meta-graph.mjs";

export const HOOK_PREFIX = "/wa/kanca/";
export const HOOK_MAX_BYTES = 3 * 1024 * 1024; // kapıcıyla aynı sınır (plan §6 W9)
const HEADERS = { "x-content-type-options": "nosniff", "cache-control": "no-store", "referrer-policy": "no-referrer" };

/** İstek kanca yolunda mı (geçersiz gizli yol dahil — mobil kapısına hiç gitmez, 404 alır). */
export const isHookRequest = req => String(req.url || "").startsWith(HOOK_PREFIX);

function reply(res, status, body, type = "application/json; charset=utf-8") {
  if (res.headersSent) return;
  const text = typeof body === "string" ? body : JSON.stringify(body);
  res.writeHead(status, { "content-type": type, "content-length": Buffer.byteLength(text), ...HEADERS });
  res.end(text);
}
const failure = (res, status, code, error) => reply(res, status, { ok: false, code, error });

async function readBody(req, max) {
  const declared = Number(req.headers["content-length"] || 0);
  if (declared > max) return null;
  const parts = [];
  let size = 0;
  for await (const chunk of req) {
    size += chunk.length;
    if (size > max) return null;
    parts.push(chunk);
  }
  return Buffer.concat(parts);
}

/**
 * @param {object} o
 * @param {object} o.registry lib/whatsapp/hub.mjs registry (companyOfHook)
 * @param {(id: string) => object|null} o.companyOf şirket kimliği → şirket kaydı
 * @param {(company: object) => object} o.appFor şirketin program örneği (app.mjs appFor; meşgulse HttpError 503 atar)
 * @param {(req) => { ok: boolean, signed?: boolean }} o.verifyMark kapıcı işareti (lib/mobile-sync.mjs kancaIsareti)
 */
export function createWhatsappHook({ registry, companyOf, appFor, verifyMark = () => ({ ok: true, signed: false }), log = console, maxBytes = HOOK_MAX_BYTES }) {
  async function handle(req, res) {
    const url = new URL(String(req.url || "/"), "http://kanca.invalid");
    const secret = url.pathname.slice(HOOK_PREFIX.length);
    const method = req.method === "HEAD" ? "GET" : req.method;
    if (!HOOK_PATH.test(secret)) return failure(res, 404, "whatsapp-hook-missing", "Bu adres uzaktan erişime açık değil.");
    if (method !== "GET" && method !== "POST") return failure(res, 405, "whatsapp-hook-method", "Yöntem desteklenmiyor.");
    const mark = verifyMark(req);
    if (!mark?.ok) return failure(res, 401, "whatsapp-hook-mark", "İstek kapıcıdan gelmedi.");
    const companyId = registry.companyOfHook(sha256(secret));
    const company = companyId ? companyOf(companyId) : null;
    if (!company) return failure(res, 404, "whatsapp-hook-missing", "Bu adres uzaktan erişime açık değil.");
    let app;
    try {
      app = appFor(company);
    } catch (error) {
      // Geri yükleme / silme sürüyor: Meta bildirimi yeniden dener (200 dışı yanıtta 7 güne kadar).
      return failure(res, error?.status === 503 ? 503 : 500, "whatsapp-hook-busy", "Şirket şu anda açılamıyor; bildirim yeniden denenecek.");
    }
    const wa = app?.context?.whatsapp;
    // Kayıt bayatsa (bağlantı kaldırıldı / kanca yenilendi) şirketin kendi kaydıyla yeniden denetlenir.
    if (!wa?.connection?.hookMatches(secret)) return failure(res, 404, "whatsapp-hook-missing", "Bu adres uzaktan erişime açık değil.");
    if (method === "GET") {
      const ok = url.searchParams.get("hub.mode") === "subscribe" && wa.connection.verifyMatches(url.searchParams.get("hub.verify_token") || "");
      if (!ok) return failure(res, 403, "whatsapp-hook-verify", "Doğrulama belirteci geçersiz.");
      return reply(res, 200, String(url.searchParams.get("hub.challenge") || "").slice(0, 200), "text/plain; charset=utf-8");
    }
    const record = wa.connection.read();
    if (record?.mode === "embedded" && !mark.signed) return failure(res, 401, "whatsapp-hook-signature", "Meta imzası doğrulanmadı.");
    const body = await readBody(req, maxBytes);
    if (!body) return failure(res, 413, "whatsapp-hook-large", "İstek çok büyük.");
    let payload;
    try {
      payload = JSON.parse(body.toString("utf8"));
    } catch {
      return failure(res, 400, "whatsapp-hook-json", "İstek okunamadı.");
    }
    const out = { applied: 0, ignored: 0, unknown: 0 };
    if (wa.queue) {
      for (const entry of Array.isArray(payload?.entry) ? payload.entry : []) {
        for (const change of Array.isArray(entry?.changes) ? entry.changes : []) {
          if (change?.field !== META_D0.hookEnvelope.field || !Array.isArray(change?.value?.statuses)) continue; // D0-18
          const result = wa.queue.applyStatuses(change.value.statuses, { phoneNumberId: String(change.value.metadata?.phone_number_id || ""), signed: mark.signed === true });
          for (const key of Object.keys(out)) out[key] += result[key] || 0;
        }
      }
    }
    if (out.applied || out.unknown) log.info?.(`WhatsApp durum bildirimi: ${out.applied} yazıldı, ${out.unknown} tanınmadı, ${out.ignored} değişmedi.`);
    return reply(res, 200, { ok: true });
  }
  return {
    async handle(req, res) {
      try {
        await handle(req, res);
      } catch (error) {
        log.error?.("WhatsApp durum bildirimi işlenemedi", error);
        failure(res, 500, "whatsapp-hook-error", "Bildirim işlenemedi; yeniden denenecek.");
      }
    },
  };
}
