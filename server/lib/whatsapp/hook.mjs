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
// 2.5.0 WhatsApp tur 1 (KULLANICI KARARLARI S33, S41, S43 = A — 06.11.2026; tasarım docs/erp/WA-TUR1-TASARIM.md): "bildirim yolu çalışıyor" işareti yalnız ŞİRKET düzeyinde ve
// şirketin kipine göre (Yol 2'de yalnız imzalı, tanınan bildirim) — WABA düzeyinde işaret konmaz (deliver açıklaması). Elle Bağla'nın uygulama düzeyi adresine gelen bildirim
// (Meta'da alternatif adres yokken) kaydı olan WABA'nınsa AYNI işleme yolundan geçer ve Meta'daki adres hemen yeniden denetlenir (appLevel).
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
 * @param {object} o.hooks makine defteri (lib/whatsapp/defter.mjs: hookByPath, hookOf, companyOfWamid, companyOfJob, pendingClaims)
 * @param {(id: string) => object|null} o.companyOf şirket kimliği → şirket kaydı
 * @param {(company: object) => object} o.appFor şirketin program örneği (app.mjs appFor; meşgulse HttpError 503 atar)
 * @param {(req) => { ok: boolean, signed?: boolean }} o.verifyMark kapıcı işareti (lib/mobile-sync.mjs kancaIsareti)
 * @param {(companyId: string, wabaId: string) => "manual"|"embedded"|null} o.modeOf şirketin o WABA'daki bağlantı kipi, dosyası açılamazken de (lib/whatsapp/hub.mjs modeOf)
 * @param {object|null} o.appWebhook Elle Bağla'nın uygulama düzeyi webhook adresi (lib/whatsapp/app-webhook.mjs matchesPath / matchesVerify / rechecks)
 */
export function createWhatsappHook({ hooks, companyOf, companies = () => [], appFor, verifyMark = () => ({ ok: true, signed: false }), modeOf = () => null, appWebhook = null, log = console, maxBytes = HOOK_MAX_BYTES, now = () => new Date() }) {
  // 2.5.0 WY (2.4.8 dar kontrol 18 DÜŞÜK "Yol 2'de imzasız bildirim 503 yolunda deftere yazılıyor"; plan docs/erp/WHATSAPP-PAKETI-2.5.0-PLANI.md §1 WY): Yol 2 ("WhatsApp'ı
  // Bağla", kip embedded) bağlantısında imzası doğrulanamayan bildirim HİÇBİR yolda yazılmaz — şirket dosyası açılamazken de (silinmiş şirket, kalıcı açılamama, geçici açılamamada
  // 503'ten önceki defter yazımı); "tanınmadı" diye günlüğe yazılır, 200 dönülmez (Meta yeniden dener; gerçek, imzalı bildirim gelince uygulanır). Kip şirket + WABA başına
  // (modeOf: ortak kayıt, yoksa makine defterindeki son kip). Kip BİLİNMİYORSA Yol 1 sayılır (BAŞ MİMAR KARARI: 2.5.0'dan önce Yol 2 ileti gönderemezdi — Tech Provider onayı
  // yok —, kipi bilinmeyen bağlantı Yol 1'dir; Yol 1'in imzasız bildirimi tasarım gereğidir, plan 2.4.8 §3 C — davranışı değişmez).
  const unsignedRejected = (owner, signed) => !signed && modeOf(owner.companyId, owner.wabaId) === "embedded";
  // "Tanınmadı" kaydı (yalnız sayı; gizli yol / wamid / içerik yazılmaz).
  const noteUnsigned = count => log.warn?.(`WhatsApp durum bildirimi: ${count} bildirim tanınmadı — Meta imzası doğrulanamadı (WhatsApp'ı Bağla bağlantısı); yazılmadı.`);
  // T1 ayıklaması İş M (soru 8 / K7 + "KİME KAÇ KEZ" ilkesi (5)): başka bilgisayardan TAŞINAN veride bildirimin sahibi bu makinenin defterinde yoktur; o zaman wamid
  // şirket dosyalarında, yalnız BU DEFTERDE AÇILMAMIŞ toplu işlerin işlerinde aranır (queue.movedOwnerOfWamid; aynı bilgisayardaki veride karar defterindir). Sahip
  // şirketin WABA'sı kancanınkiyle aynı olmalı (aşağıda); Yol 2'de imzasız bildirim yine yazılmaz (aynı kurallar). İş U6 (dar kontrol 15): kabulü deftere yazılamamış
  // işin wamid'i de dosyada aranır (queue.movedOwnerOfWamid). Dosya aramasında YALNIZ gerçekten geçici açılamama (geri yükleme / Ayır sürüyor [busyCompanies,
  // retryAfter], kilit) lookup.busy koyar → sahibi bulunamayan bildirim 503 (Meta yeniden dener); öbür açılamama (bozuk dosya, "Ayır" gerektiren kayıt, izin, veri dosyası
  // yok) aramada atlanır — tanınmayan bildirim süresiz 503 almaz (İş X1, dar kontrol 17 f1; karar 6).
  // İş V1 (dar kontrol 16 n2/n11): sahibi BİLİNEN bildirimde KALICI yalnız sürüp giden veri dosyası yokluğu (app.mjs appFor dataMissing) → 200 + yalnız defter; öbür
  // her açılış hatası (geçici + bozuk / Ayır / izin) 503 — ama İş X1: 503'ten ÖNCE delivered / read deftere yazılır (karar 1 "teslim her durumda sayılır").
  const permanent = error => error?.dataMissing === true;
  const transient = error => Boolean(error?.retryAfter || error?.extra?.retryAfter) || isLockError(error); // HttpError(503, …, { retryAfter }) — appFor busyCompanies
  function movedOwnerOf(wamid, lookup) {
    if (!wamid) return null;
    for (const company of companies() || []) {
      if (!company) continue;
      try {
        const found = appFor(company)?.context?.whatsapp?.queue?.movedOwnerOfWamid?.(wamid);
        if (found) return { companyId: company.id, wabaId: found.wabaId };
      } catch (error) {
        if (transient(error)) lookup.busy = true;
      }
    }
    return null;
  }
  // İş U (K1′ + onaylı koşul (a)) + İş V1 (dar kontrol 16 n2): şirket SİLİNMİŞ ya da veri dosyası KALICI olarak yoksa durum yalnız deftere yazılır — K4 kuralı defterin
  // TEK yardımcısında (ledgerOnlyResult; queue.applyLedgerOnly ile aynı): D/R o denemeye teslim, F (131049 dahil) son denemeye teslim edilemedi. 200 (Meta 7 gün yeniden
  // denemeye itilmez); yazılamazsa 503.
  function ledgerOnly(items, owner, signed, out) {
    if (unsignedRejected(owner, signed)) {
      out.unsigned += items.length; // 2.5.0 WY: Yol 2'de imzasız → yazılmaz (tanınmadı)
      return;
    }
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
  // ---------- 2.5.0 WhatsApp tur 1: S41 = A (uygulama düzeyi adres) — tasarım docs/erp/WA-TUR1-TASARIM.md §3 ----------
  // "Bu kurulumda kaydı olan WABA": makine defterinde Bildirim Yolu kaydı olan (kaldırılmış kayıt dahil — alternatif adresin geç bildirimleri de böyle kabul edilir) ya da bir
  // şirketin o WABA'daki kipi bilinen WABA. Kaydı olmayan WABA'nın bildirimi uygulama düzeyi adreste düşer (200; işlenmez, saklanmaz).
  function registeredWaba(wabaId) {
    if (!wabaId) return false;
    if (hooks?.hookOf?.(wabaId)) return true;
    return (companies() || []).some(company => company?.id && modeOf(company.id, wabaId));
  }
  const hasStatuses = entries => entries.some(entry => (Array.isArray(entry?.changes) ? entry.changes : []).some(change => change?.field === META_D0.hookEnvelope.field && Array.isArray(change?.value?.statuses) && change.value.statuses.length));
  const describe = result => {
    if (!result) return "sonuç yok";
    if (result.verified) return "adres Meta'da kayıtlı";
    if (result.registered) return "adres Meta'ya yeniden kaydedildi";
    if (result.conflict) return "çakışma";
    if (result.failed) return `kaydedilemedi: ${String(result.failed).slice(0, 300)}`;
    return `atlandı: ${result.skipped || "?"}`;
  };
  // "Meta'daki adres hemen yeniden denetlenir": o WABA'ya bağlı bir şirketin Bağlantıyı Sına yolu (connection.ensureHook force — Meta'daki kayıtlı alternatif adres okunur,
  // programınki değilse / yoksa yeniden kaydedilir). Şirket: önce bildirimin sahipleri, sonra o WABA'da kipi bilinenler; kaydı o WABA'da, arka planda yazılabilir
  // (BS-7 şema kapısı + yazma kilidi: kapılı şirkete hiç yazılmaz), lisans yazılabilir, belirteç süresi dolmamış İLK şirket. Sıklık app-webhook.mjs rechecks'te.
  async function recheckAddress(wabaId, entries) {
    const ids = [];
    for (const entry of entries)
      for (const change of Array.isArray(entry?.changes) ? entry.changes : [])
        for (const status of Array.isArray(change?.value?.statuses) ? change.value.statuses : []) {
          const owner = hooks.companyOfWamid?.(String(status?.id || "").slice(0, 200));
          if (owner?.wabaId === wabaId) ids.push(String(owner.companyId));
        }
    for (const company of companies() || []) if (company?.id && modeOf(company.id, wabaId)) ids.push(String(company.id));
    for (const id of [...new Set(ids)]) {
      const company = companyOf(id);
      if (!company) continue;
      let context;
      try {
        context = appFor(company)?.context;
      } catch {
        continue; // açılamayan şirket (geri yükleme sürüyor, bozuk dosya…) atlanır
      }
      const connection = context?.whatsapp?.connection;
      const record = connection?.read?.();
      // Belirteçsiz kayıt ensureHook'ta atlanır (mühürlü belirtece yalnız bağlantı modülü dokunur — whatsapp-w1-baglanti kaynak taraması).
      // 2.5.0 WhatsApp tur 2 — KULLANICI KARARI S63 = A: "S41 denetimi yalnız Elle Bağla şirketiyle" — uygulama düzeyi adres Elle Bağla'nın (müşterinin uygulamasının) panel
      // ayarıdır; WhatsApp'ı Bağla şirketi (DestekOfis uygulaması) bu denetimi yapmaz (yalnız kendi uygulamasının adresini denetleyebilirdi — anlamsız Meta isteği).
      if (!record || record.wabaId !== wabaId || record.mode === "embedded") continue;
      if (context.canWriteInBackground?.() === false) continue;
      if (context.license?.writable?.() === false) continue;
      if (connection.tokenStatus?.(record)?.state === "expired") continue;
      const result = await connection.ensureHook(context.mobileRemote?.publicUrl?.() || "", { force: true });
      if (result?.skipped === "no-connection") continue; // belirteçsiz kayıt: sıradaki şirket
      log.info?.(`WhatsApp: durum bildirimi uygulama düzeyi adrese geldi; Meta'daki bildirim adresi yeniden denetlendi (${describe(result)}).`);
      return result;
    }
    log.warn?.("WhatsApp: durum bildirimi uygulama düzeyi adrese geldi; Meta'daki bildirim adresini denetleyecek Elle Bağla şirketi bulunamadı (bakım turu yine dener).");
    return null;
  }
  // 2.5.0 WE: Elle Bağla'nın UYGULAMA DÜZEYİ webhook adresi (lib/whatsapp/app-webhook.mjs; Meta uygulama paneli → Configure Webhooks). GET: Meta'nın doğrulaması (bu kurulumun
  // belirteci → hub.challenge, yoksa 403). POST (S41 = A): entry.id'si kaydı olan WABA'nın bildirimleri alternatif adresin AYNI işleme yolundan (deliver) geçer; kaydı olmayan
  // WABA'nınki düşer. Kaydı olan WABA'nın durum bildirimi geldiyse Meta'daki adres arka planda (yanıt beklemeden) yeniden denetlenir.
  async function appLevel(req, res, url, method, mark) {
    if (method === "GET") {
      const token = url.searchParams.get("hub.verify_token") || "";
      if (url.searchParams.get("hub.mode") !== "subscribe" || !appWebhook.matchesVerify(token)) return failure(res, 403, "whatsapp-hook-verify", "Doğrulama belirteci geçersiz.");
      return reply(res, 200, String(url.searchParams.get("hub.challenge") || "").slice(0, 200), "text/plain; charset=utf-8");
    }
    const payload = await readPayload(req, res);
    if (payload === undefined) return;
    const batches = new Map(); // WABA (entry.id) → entry[]
    for (const entry of Array.isArray(payload?.entry) ? payload.entry : []) {
      const wabaId = String(entry?.id ?? "").slice(0, 64);
      if (!registeredWaba(wabaId)) continue;
      batches.set(wabaId, [...(batches.get(wabaId) || []), entry]);
    }
    if (!batches.size) return reply(res, 200, { ok: true });
    for (const [wabaId, entries] of batches) {
      if (!hasStatuses(entries)) continue;
      appWebhook.rechecks?.request(wabaId, () =>
        recheckAddress(wabaId, entries).catch(error => {
          log.warn?.(`WhatsApp: Meta'daki bildirim adresi yeniden denetlenemedi (${error?.code || error?.message || error}); bakım turu yine dener.`);
          return null;
        }),
      );
    }
    return deliver(res, batches, mark.signed === true);
  }
  /** Gövdeyi okur ve ayrıştırır; olmazsa yanıtı yazar ve undefined döner. */
  async function readPayload(req, res) {
    const body = await readBody(req, maxBytes);
    if (!body) {
      failure(res, 413, "whatsapp-hook-large", "İstek çok büyük.");
      return undefined;
    }
    try {
      return JSON.parse(body.toString("utf8"));
    } catch {
      failure(res, 400, "whatsapp-hook-json", "İstek okunamadı.");
      return undefined;
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
    if (!hook && appWebhook?.matchesPath(secret)) return appLevel(req, res, url, method, mark);
    if (!hook) return failure(res, 404, "whatsapp-hook-missing", "Bu adres uzaktan erişime açık değil.");
    if (method === "GET") {
      const token = url.searchParams.get("hub.verify_token") || "";
      const ok = url.searchParams.get("hub.mode") === "subscribe" && Boolean(token) && hook.verifyHash === sha256(token);
      if (!ok) return failure(res, 403, "whatsapp-hook-verify", "Doğrulama belirteci geçersiz.");
      return reply(res, 200, String(url.searchParams.get("hub.challenge") || "").slice(0, 200), "text/plain; charset=utf-8");
    }
    const payload = await readPayload(req, res);
    if (payload === undefined) return;
    return deliver(res, new Map([[hook.wabaId, Array.isArray(payload?.entry) ? payload.entry : []]]), mark.signed === true);
  }
  /**
   * TEK işleme yolu — WABA'nın alternatif adresi ve (S41) uygulama düzeyi adres. batches: WABA → entry[] (alternatif adreste WABA gizli yolun kaydından, uygulama düzeyinde
   * entry.id'den). signed: kapıcı Meta imzasını DestekOfis uygulama sırrıyla doğruladı ("wa1").
   * BİLDİRİM YOLU İŞARETİ (KULLANICI KARARLARI S33 = A, S43 = A; tasarım §2 — işaret kipe göre, ŞİRKET + İMZA düzeyinde): WABA düzeyinde işaret (makine defteri hook_seen)
   * KONMAZ — 3fe5a92d'ye dek her POST, imza ve tanınma denetiminden önce koyuyordu. İşaret yalnız şirket düzeyinde: aşağıda şirketin işlemesine verilen (sahibi bu kurulumun o
   * şirketi, WABA'sı bildirimin WABA'sı; Yol 2'de YALNIZ imzalı) bildirim queue.applyStatuses'ta koyar. Tanınmayan (bu kurulumun göndermediği) wamid, Yol 2'de imzasız
   * bildirim ve başka şirketin bildirimi bir şirketi işaretlemez. Tanınma: wamid → (yalnız imzalı) iş kimliği → taşınan veride dosya.
   */
  async function deliver(res, batches, signed) {
    // 2.4.8 İş P1 (c2): makine defteri başka süreçte kilitliyse (kısa sınama) durumlar 10 sn beklemeden yazılmaz → 503, Meta yeniden dener (P3 ile aynı yanıt).
    const ledgerWritable = hooks.probeWritable?.();
    if (ledgerWritable === false || ledgerWritable === PROBE_CLOSED) return failure(res, 503, "whatsapp-hook-busy", "Şirket şu anda açılamıyor; bildirim yeniden denenecek.");
    // Durumlar şirket + WABA'ya göre toplanır (wamid → kabulü yazan şirket; imzalı olayda iş kimliği → talebi yazan şirket). Aynı WABA'nın olayı değilse düşer.
    const groups = new Map(); // `${şirket}|${WABA}` → [{ phoneNumberId, status, owner }]
    const out = { applied: 0, ignored: 0, unknown: 0, unsigned: 0 }; // unsigned (2.5.0 WY): Yol 2'de imzası doğrulanamadığı için yazılmayan
    const unowned = new Map(); // İş T A6: WABA → hiçbir şirkette sahibi bulunamayan bildirim sayısı
    const lookup = { busy: false }; // İş U6: dosya araması sırasında geçici olarak açılamayan şirket var mı
    for (const [wabaId, entries] of batches) {
      for (const entry of entries) {
        for (const change of Array.isArray(entry?.changes) ? entry.changes : []) {
          if (change?.field !== META_D0.hookEnvelope.field || !Array.isArray(change?.value?.statuses)) continue; // D0-18
          const phoneNumberId = String(change.value.metadata?.phone_number_id || "");
          for (const status of change.value.statuses) {
            const wamid = String(status?.id || "").slice(0, 200);
            const owner = hooks.companyOfWamid(wamid) || (signed ? hooks.companyOfJob(String(status?.biz_opaque_callback_data || "").slice(0, 120)) : null) || movedOwnerOf(wamid, lookup);
            if (!owner || owner.wabaId !== wabaId) {
              out.unknown += 1;
              if (!owner) unowned.set(wabaId, (unowned.get(wabaId) || 0) + 1);
              continue;
            }
            const key = `${owner.companyId}|${wabaId}`;
            const list = groups.get(key) || [];
            list.push({ phoneNumberId, status, owner });
            groups.set(key, list);
          }
        }
      }
    }
    for (const items of groups.values()) {
      const { companyId, wabaId } = items[0].owner;
      const company = companyOf(companyId);
      if (!company) {
        ledgerOnly(items, items[0].owner, signed, out); // İş U (a): silinmiş şirket → yalnız defter
        continue;
      }
      let app;
      try {
        app = appFor(company);
      } catch (error) {
        // Geri yükleme / açılış sürüyor, kilit, bozuk dosya …: 503, Meta bildirimi yeniden dener (200 dışı yanıtta 7 güne kadar; uygulanmış olanlar yinelenince etkisizdir).
        // İş X1 (dar kontrol 17 f1b): 503'ten ÖNCE delivered / read deftere (o denemeye; eşgüçlü) — Meta bırakırsa da teslim sayılır; failed şirket açılınca uygulanır.
        if (!permanent(error)) {
          // 2.5.0 WY: Yol 2'de imzasız D/R bu ön yazıma da girmez (ledgerOnly); yanıt yine 503 (şirket açılınca olağan yol imzasızı 401 ile reddeder).
          const early = { applied: 0, ignored: 0, unknown: 0, unsigned: 0 };
          ledgerOnly(items.filter(item => ["delivered", "read"].includes(String(item.status?.status || "").toLowerCase())), items[0].owner, signed, early);
          if (early.unsigned) noteUnsigned(early.unsigned);
          return failure(res, 503, "whatsapp-hook-busy", "Şirket şu anda açılamıyor; bildirim yeniden denenecek.");
        }
        // İş U (a) + V1: KALICI açılamama (sürüp giden veri dosyası yokluğu) → yalnız defter, 200.
        if (!unsignedRejected(items[0].owner, signed)) log.warn?.(`WhatsApp durum bildirimi: şirket açılamadı (${error?.message}); yalnız defter yazıldı.`);
        ledgerOnly(items, items[0].owner, signed, out);
        continue;
      }
      // 2.4.8 İş P3: şirket dosyası kilitliyse (kısa sınama / arka plan işareti; lib/write-lock.mjs) durumlar 10 sn beklemeden yazılmaz → 503, Meta yeniden dener
      // (uygulanmış durumlar yinelenince etkisiz). İmza / işaret / WABA denetimleri yukarıda, aynen.
      if (app?.context?.canWriteInBackground?.() === false) return failure(res, 503, "whatsapp-hook-busy", "Şirket şu anda açılamıyor; bildirim yeniden denenecek.");
      const wa = app?.context?.whatsapp;
      const record = wa?.connection?.read?.();
      if (!wa?.queue || !record || record.wabaId !== wabaId) {
        out.ignored += items.length;
        continue;
      }
      // Yol 2'de imzasız bildirim şirketin işine verilmez → queue.applyStatuses çağrılmaz → bildirim yolu işareti de konmaz (S33 = A).
      if (record.mode === "embedded" && !signed) {
        out.unsigned += items.length;
        continue;
      }
      const byPhone = new Map();
      for (const item of items) byPhone.set(item.phoneNumberId, [...(byPhone.get(item.phoneNumberId) || []), item.status]);
      for (const [phoneNumberId, statuses] of byPhone) {
        const result = wa.queue.applyStatuses(statuses, { phoneNumberId, signed });
        for (const key of Object.keys(out)) out[key] += result[key] || 0;
      }
    }
    // Yol 2 bağlantısında imzasız bildirim yazılmaz (şirket dosyası açılamazken de — 2.5.0 WY); hiçbir şey yazılmadıysa 401 (kapıcı imzayı doğrulamadı; Meta yeniden dener).
    if (out.unsigned) noteUnsigned(out.unsigned);
    if (out.unsigned && !out.applied) return failure(res, 401, "whatsapp-hook-signature", "Meta imzası doğrulanmadı.");
    // İş T A6 (K5 istisnası; İ2 "almış olabilir → kayıp yok"): sahibi bulunamayan bildirim varken bu WABA'da yanıtı henüz işlenmemiş istek (talep var, sonuç yok, son
    // PENDING_MS içinde) varsa bildirim o isteğin olabilir (Meta durumu yanıttan önce yollayabilir) → 503, Meta yeniden dener; yanıt işlenince tanınır. Pencere SINIRLI:
    // daha eski sonuçsuz talep toparlamada "Sonucu Belirsiz" olur; pencere dışında ya da bekleyen talep yokken 200 (yabancı iletiler — aynı WABA'yı başka araçla kullanan
    // müşteri — Meta'yı sonsuz yeniden denemeye itmez). BİLİNEN SINIR: pencere içinde yabancı iletilerin durumları da 503 alır; sayısı günlüğe yazılır.
    const unownedCount = [...unowned.values()].reduce((sum, n) => sum + n, 0);
    if (unownedCount && lookup.busy) {
      log.warn?.(`WhatsApp durum bildirimi: ${unownedCount} bildirim tanınmadı, bir şirket şu an açılamıyor → 503 (Meta yeniden deneyecek).`);
      return failure(res, 503, "whatsapp-hook-busy", "Şirket şu anda açılamıyor; bildirim yeniden denenecek.");
    }
    const since = new Date(now().getTime() - PENDING_MS).toISOString();
    if ([...unowned].some(([wabaId, n]) => n > 0 && hooks.pendingClaims?.(wabaId, since) > 0)) {
      log.warn?.(`WhatsApp durum bildirimi: ${unownedCount} bildirim tanınmadı, yanıtı beklenen istek var → 503 (Meta yeniden deneyecek).`);
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
