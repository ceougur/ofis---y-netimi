// 2.4.8 W9 — WhatsApp durum bildirimi (web kancası) PROGRAM ucu (docs/erp/WHATSAPP-API-PLANI-2.4.8.md §3 C, §6 W9; §11 S1 A; §7a 3, 16–18).
//
// Yol: Meta → https://<ofis>.destekofis.net/wa/kanca/<32 baytlık gizli yol> → kapıcı (bulut/kapi/kapi.mjs; cihaz denetimi YOK, saklamaz, çerez/başlık geçmez,
// "x-do-kapi" işareti) → ofisin tüneli → uzak dinleyici (app.mjs remoteServer) → BURASI. Mobil uzak oturum kapısından (lib/mobile-remote.mjs) ÖNCE işlenir:
// kanca isteğinin cihazı/oturumu yoktur; mobil özetin yazma tetiği (mobileSync.izle) de çalışmaz (kanca veri yazması değildir).
//
// Doğrulama: kapıcı açıkken (mobileSync.enabled) işaret ZORUNLU (tüneli atlatan istek 401). İşaretin cihaz bölümü "wa1" = kapıcı Meta imzasını (X-Hub-Signature-256)
// DestekOfis uygulama sırrıyla doğruladı (Yol 2, "WhatsApp'ı Bağla"), "wa0" = imzasız / doğrulanamadı (Yol 1 "Elle Bağla": imza müşterinin uygulama sırrıyla atılır,
// programda o sır YOK — plan §3 C). Yol 2 bağlantısında imzasız istek reddedilir (BAŞ MİMAR KARARI: plan "kapıcı geçersizi düşürür" der; kapıcı şirketin yolunu
// bilmediğinden imzasızı "wa0" diye geçirir, düşürme programda — etki aynı). T2-3/4 (bağımsız gözden geçirme r2 + r7): gizli yolun karması WABA'nın kaydını bulur
// (makine defteri, şirket dosyası DIŞINDA — Meta'da alternatif adres WABA başına tektir); her durum bildirimi şirketine wamid'le (deftere kabul yazan şirket) ya da
// — yalnız imzalı olayda — iş kimliğiyle (biz_opaque_callback_data) gider; şirketi bilinmeyen olay düşer. Şirket açık değilse açılır, geri yükleniyorsa 503
// (Meta 7 gün yeniden dener). Yinelenen / sırasız bildirim etkisizdir (queue.applyStatuses yalnız ileri yazar).
//   GET  ?hub.mode=subscribe&hub.verify_token=…&hub.challenge=… → 200 challenge (düz metin) | 403
//   POST { object, entry[].changes[] { field: "messages", value: { metadata.phone_number_id, statuses[] } } } → 200 (durumlar yazılır; gelen ileti / öbür alanlar
//        SAKLANMAZ — kapsam dışı)
import { PROBE_CLOSED, isLockError } from "../db.mjs";
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
// İş T A6: sahibi bulunamayan bildirime 503 dönülen pencere — talebi bu kadar yeni olup sonucu yazılmamış istek varken (istek zaman aşımı + toparlama payı).
const PENDING_MS = 5 * 60_000;

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
 * @param {object} o.hooks makine defteri (lib/whatsapp/defter.mjs: hookByPath, companyOfWamid, companyOfJob, hookSeen)
 * @param {(id: string) => object|null} o.companyOf şirket kimliği → şirket kaydı
 * @param {(company: object) => object} o.appFor şirketin program örneği (app.mjs appFor; meşgulse HttpError 503 atar)
 * @param {(req) => { ok: boolean, signed?: boolean }} o.verifyMark kapıcı işareti (lib/mobile-sync.mjs kancaIsareti)
 */
export function createWhatsappHook({ hooks, companyOf, companies = () => [], appFor, verifyMark = () => ({ ok: true, signed: false }), log = console, maxBytes = HOOK_MAX_BYTES, now = () => new Date() }) {
  // T1 ayıklaması İş M (soru 8 / K7 + "KİME KAÇ KEZ" ilkesi (5)): başka bilgisayardan TAŞINAN veride bildirimin sahibi bu makinenin defterinde yoktur; o zaman wamid
  // şirket dosyalarında, yalnız BU DEFTERDE AÇILMAMIŞ toplu işlerin işlerinde aranır (queue.movedOwnerOfWamid; aynı bilgisayardaki veride karar defterindir). Sahip
  // şirketin WABA'sı kancanınkiyle aynı olmalı (aşağıda); Yol 2'de imzasız bildirim yine yazılmaz (aynı kurallar). İş U6 (dar kontrol 15): kabulü deftere yazılamamış
  // işin wamid'i de dosyada aranır (queue.movedOwnerOfWamid). Şirket GEÇİCİ olarak açılamıyorsa (geri yükleme / açılış sürüyor, kilit) lookup.busy işaretlenir →
  // sahibi bulunamayan bildirim 503 alır (Meta yeniden dener); KALICI açılamama (veri dosyası yok, bozuk kayıt) atlanır.
  // İş V1 (dar kontrol 16 n2/n11): KALICI yalnız sürüp giden veri dosyası yokluğu (app.mjs appFor COMPANY_DATA_MISSING) — öbür her açılış hatası (geri yükleme / Ayır
  // sürüyor [busyCompanies], kilit, disk dolu, G/Ç, bozuk dosya, "Ayır" gerektiren kayıt) GEÇİCİ: 503, Meta yeniden dener.
  const temporary = error => error?.code !== "COMPANY_DATA_MISSING";
  function movedOwnerOf(wamid, lookup) {
    if (!wamid) return null;
    for (const company of companies() || []) {
      if (!company) continue;
      try {
        const found = appFor(company)?.context?.whatsapp?.queue?.movedOwnerOfWamid?.(wamid);
        if (found) return { companyId: company.id, wabaId: found.wabaId };
      } catch (error) {
        if (temporary(error)) lookup.busy = true;
      }
    }
    return null;
  }
  // İş U (K1′ + onaylı koşul (a)) + İş V1 (dar kontrol 16 n2): şirket SİLİNMİŞ ya da veri dosyası KALICI olarak yoksa durum yalnız deftere yazılır — K4 kuralı defterin
  // TEK yardımcısında (ledgerOnlyResult; queue.applyLedgerOnly ile aynı): D/R o denemeye teslim, F (131049 dahil) son denemeye teslim edilemedi. 200 (Meta 7 gün yeniden
  // denemeye itilmez); yazılamazsa 503.
  function ledgerOnly(items, owner, signed, out) {
    for (const { status } of items) {
      const value = String(status?.status || "").toLowerCase();
      const wamid = String(status?.id || "").slice(0, 200);
      const opaque = signed ? String(status?.biz_opaque_callback_data || "").slice(0, 120) : "";
      const lastOf = opaque ? hooks.attempts?.(opaque)?.at(-1) : null;
      const target = hooks.attemptOfWamid?.(wamid) || (lastOf ? { jobId: opaque, attempt: lastOf.attempt } : null);
      if (!target || !["delivered", "read", "failed"].includes(value)) {
        out.ignored += 1;
        continue;
      }
      const at = Number(status?.timestamp) > 0 ? new Date(Number(status.timestamp) * 1000).toISOString() : now().toISOString();
      const billable = status?.pricing && typeof status.pricing === "object" && "billable" in status.pricing ? status.pricing.billable !== false : true;
      const result = hooks.ledgerOnlyResult({ jobId: target.jobId, attempt: target.attempt, companyId: owner.companyId, wabaId: owner.wabaId, value, billable, at });
      if (result === "error") throw Object.assign(new Error("WhatsApp gönderim defterine yazılamadı"), { code: "WA_LEDGER_WRITE" });
      if (result === "applied") out.applied += 1;
      else out.ignored += 1;
    }
  }
  async function handle(req, res) {
    const url = new URL(String(req.url || "/"), "http://kanca.invalid");
    const secret = url.pathname.slice(HOOK_PREFIX.length);
    const method = req.method === "HEAD" ? "GET" : req.method;
    if (!HOOK_PATH.test(secret)) return failure(res, 404, "whatsapp-hook-missing", "Bu adres uzaktan erişime açık değil.");
    if (method !== "GET" && method !== "POST") return failure(res, 405, "whatsapp-hook-method", "Yöntem desteklenmiyor.");
    const mark = verifyMark(req);
    if (!mark?.ok) return failure(res, 401, "whatsapp-hook-mark", "İstek kapıcıdan gelmedi.");
    const hook = hooks?.hookByPath(sha256(secret)) || null;
    if (!hook) return failure(res, 404, "whatsapp-hook-missing", "Bu adres uzaktan erişime açık değil.");
    if (method === "GET") {
      const token = url.searchParams.get("hub.verify_token") || "";
      const ok = url.searchParams.get("hub.mode") === "subscribe" && Boolean(token) && hook.verifyHash === sha256(token);
      if (!ok) return failure(res, 403, "whatsapp-hook-verify", "Doğrulama belirteci geçersiz.");
      return reply(res, 200, String(url.searchParams.get("hub.challenge") || "").slice(0, 200), "text/plain; charset=utf-8");
    }
    const body = await readBody(req, maxBytes);
    if (!body) return failure(res, 413, "whatsapp-hook-large", "İstek çok büyük.");
    let payload;
    try {
      payload = JSON.parse(body.toString("utf8"));
    } catch {
      return failure(res, 400, "whatsapp-hook-json", "İstek okunamadı.");
    }
    const signed = mark.signed === true;
    // 2.4.8 İş P1 (c2): makine defteri başka süreçte kilitliyse (kısa sınama) durumlar 10 sn beklemeden yazılmaz → 503, Meta yeniden dener (P3 ile aynı yanıt).
    const ledgerWritable = hooks.probeWritable?.();
    if (ledgerWritable === false || ledgerWritable === PROBE_CLOSED) return failure(res, 503, "whatsapp-hook-busy", "Şirket şu anda açılamıyor; bildirim yeniden denenecek.");
    hooks.hookSeen?.(hook.wabaId, now().toISOString());
    // Durumlar şirkete göre toplanır (wamid → kabulü yazan şirket; imzalı olayda iş kimliği → talebi yazan şirket). Aynı WABA'nın olayı değilse düşer.
    const groups = new Map(); // şirket → [{ phoneNumberId, statuses[] }]
    const out = { applied: 0, ignored: 0, unknown: 0 };
    let unowned = 0; // İş T A6: hiçbir şirkette sahibi bulunamayan bildirim
    const lookup = { busy: false }; // İş U6: dosya araması sırasında geçici olarak açılamayan şirket var mı
    for (const entry of Array.isArray(payload?.entry) ? payload.entry : []) {
      for (const change of Array.isArray(entry?.changes) ? entry.changes : []) {
        if (change?.field !== META_D0.hookEnvelope.field || !Array.isArray(change?.value?.statuses)) continue; // D0-18
        const phoneNumberId = String(change.value.metadata?.phone_number_id || "");
        for (const status of change.value.statuses) {
          const wamid = String(status?.id || "").slice(0, 200);
          const owner = hooks.companyOfWamid(wamid) || (signed ? hooks.companyOfJob(String(status?.biz_opaque_callback_data || "").slice(0, 120)) : null) || movedOwnerOf(wamid, lookup);
          if (!owner || owner.wabaId !== hook.wabaId) {
            out.unknown += 1;
            if (!owner) unowned += 1;
            continue;
          }
          const list = groups.get(owner.companyId) || [];
          list.push({ phoneNumberId, status, owner });
          groups.set(owner.companyId, list);
        }
      }
    }
    let unsigned = 0;
    for (const [companyId, items] of groups) {
      const company = companyOf(companyId);
      if (!company) {
        ledgerOnly(items, items[0].owner, signed, out); // İş U (a): silinmiş şirket → yalnız defter
        continue;
      }
      let app;
      try {
        app = appFor(company);
      } catch (error) {
        // Geri yükleme / açılış sürüyor (geçici): Meta bildirimi yeniden dener (200 dışı yanıtta 7 güne kadar; uygulanmış olanlar yinelenince etkisizdir).
        if (temporary(error)) return failure(res, 503, "whatsapp-hook-busy", "Şirket şu anda açılamıyor; bildirim yeniden denenecek.");
        // İş U (a): KALICI açılamama (veri dosyası yok / bozuk kayıt) → yalnız defter, 200.
        log.warn?.(`WhatsApp durum bildirimi: şirket açılamadı (${error?.message}); yalnız defter yazıldı.`);
        ledgerOnly(items, items[0].owner, signed, out);
        continue;
      }
      // 2.4.8 İş P3: şirket dosyası kilitliyse (kısa sınama / arka plan işareti; lib/write-lock.mjs) durumlar 10 sn beklemeden yazılmaz → 503, Meta yeniden dener
      // (uygulanmış durumlar yinelenince etkisiz). İmza / işaret / WABA denetimleri yukarıda, aynen.
      if (app?.context?.canWriteInBackground?.() === false) return failure(res, 503, "whatsapp-hook-busy", "Şirket şu anda açılamıyor; bildirim yeniden denenecek.");
      const wa = app?.context?.whatsapp;
      const record = wa?.connection?.read?.();
      if (!wa?.queue || !record || record.wabaId !== hook.wabaId) {
        out.ignored += items.length;
        continue;
      }
      if (record.mode === "embedded" && !signed) {
        unsigned += items.length;
        continue;
      }
      const byPhone = new Map();
      for (const item of items) byPhone.set(item.phoneNumberId, [...(byPhone.get(item.phoneNumberId) || []), item.status]);
      for (const [phoneNumberId, statuses] of byPhone) {
        const result = wa.queue.applyStatuses(statuses, { phoneNumberId, signed });
        for (const key of Object.keys(out)) out[key] += result[key] || 0;
      }
    }
    // Yol 2 bağlantısında imzasız bildirim yazılmaz; hiçbir şey yazılmadıysa 401 (kapıcı imzayı doğrulamadı).
    if (unsigned && !out.applied) return failure(res, 401, "whatsapp-hook-signature", "Meta imzası doğrulanmadı.");
    // İş T A6 (K5 istisnası; İ2 "almış olabilir → kayıp yok"): sahibi bulunamayan bildirim varken bu WABA'da yanıtı henüz işlenmemiş istek (talep var, sonuç yok, son
    // PENDING_MS içinde) varsa bildirim o isteğin olabilir (Meta durumu yanıttan önce yollayabilir) → 503, Meta yeniden dener; yanıt işlenince tanınır. Pencere SINIRLI:
    // daha eski sonuçsuz talep toparlamada "Sonucu Belirsiz" olur; pencere dışında ya da bekleyen talep yokken 200 (yabancı iletiler — aynı WABA'yı başka araçla kullanan
    // müşteri — Meta'yı sonsuz yeniden denemeye itmez). BİLİNEN SINIR: pencere içinde yabancı iletilerin durumları da 503 alır; sayısı günlüğe yazılır.
    if (unowned && lookup.busy) {
      log.warn?.(`WhatsApp durum bildirimi: ${unowned} bildirim tanınmadı, bir şirket şu an açılamıyor → 503 (Meta yeniden deneyecek).`);
      return failure(res, 503, "whatsapp-hook-busy", "Şirket şu anda açılamıyor; bildirim yeniden denenecek.");
    }
    if (unowned && hooks.pendingClaims?.(hook.wabaId, new Date(now().getTime() - PENDING_MS).toISOString()) > 0) {
      log.warn?.(`WhatsApp durum bildirimi: ${unowned} bildirim tanınmadı, yanıtı beklenen istek var → 503 (Meta yeniden deneyecek).`);
      return failure(res, 503, "whatsapp-hook-pending", "Bildirim henüz eşleşmedi; yeniden denenecek.");
    }
    if (out.applied || out.unknown) log.info?.(`WhatsApp durum bildirimi: ${out.applied} yazıldı, ${out.unknown} tanınmadı, ${out.ignored} değişmedi.`);
    return reply(res, 200, { ok: true });
  }
  return {
    async handle(req, res) {
      try {
        await handle(req, res);
      } catch (error) {
        // İş T A5 (K0): yazım sırasında kilit / defter yazılamadı / kapanan şirket → 503 (Meta yeniden dener; yazımlar eşgüçlü). Öbür hata 500 (o da yeniden denenir).
        if (isLockError(error) || error?.code === "WA_LEDGER_WRITE" || error?.code === "ERR_INVALID_STATE") {
          log.warn?.(`WhatsApp durum bildirimi yazılamadı (${error?.code || error?.message}); 503 — Meta yeniden deneyecek.`);
          return failure(res, 503, "whatsapp-hook-busy", "Şirket şu anda açılamıyor; bildirim yeniden denenecek.");
        }
        log.error?.("WhatsApp durum bildirimi işlenemedi", error);
        failure(res, 500, "whatsapp-hook-error", "Bildirim işlenemedi; yeniden denenecek.");
      }
    },
  };
}
