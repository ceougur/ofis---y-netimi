// WhatsApp ile ekstre ve mesaj gönderimi (v2.0.13, müşteri talebi): tek cariye ya da toplu (tüm cariler, süzgeçteki
// cariler ya da seçilen N cari).
//
// Mimari karar: WhatsApp'ın resmi toplu gönderimi (Business Platform) ücretli hesap, onaylı şablon ve internetteki bir
// hizmet ister; yerel-öncelikli bu programda kullanıcının kendi WhatsApp'ı (masaüstü/web) kullanılır. Sunucu alıcıları
// hazırlar (telefon doğrulama, bakiye, taksit, kişiye özel ekstre metni), arayüz bir "gönderim sırası" ile her kişi için
// mesajı hazır açar; her gönderim cari kartına kaydedilir (kime, ne zaman, kim, ne gönderildi).
//   POST /api/workspace/whatsapp/targets  { ids | all + süzgeçler, kind: statement|message, preset }
//   POST /api/workspace/whatsapp/log      { batchId, accountId, kind, body, status: sent|skipped }
//   GET  /api/workspace/whatsapp/history?accountId=
//
// 2.4.8 W1 (docs/erp/WHATSAPP-API-PLANI-2.4.8.md §4, §6 W1): WhatsApp Business API (Meta Cloud API) bağlantısı — Yönetim → WhatsApp. Şirket başına;
// yalnız yönetici (system.manage). Belirteç sunucuda şifreli (lib/whatsapp/connection.mjs); yanıtlarda yalnız "kayıtlı" işareti.
//   GET    /api/workspace/whatsapp/connection             bağlantı görünümü (belirteç yok)
//   PUT    /api/workspace/whatsapp/connection             Elle Bağla { phoneNumberId, wabaId, appId?, token? (boş = kayıtlı belirteç kalır) }
//   DELETE /api/workspace/whatsapp/connection             Bağlantıyı Kaldır
//   POST   /api/workspace/whatsapp/connection/test        Bağlantıyı Sına (numara, görünen ad, kalite, sınır basamağı, şablonlar)
//   POST   /api/workspace/whatsapp/connection/self-test   Kendime Deneme Gönder { to } — yazılabilir lisans
//   POST   /api/workspace/whatsapp/connection/embedded            2.4.8 W7 WhatsApp'ı Bağla: oturum aç → { session, url (kapi.<alan>/wa/bagla#o=…), seconds }
//   POST   /api/workspace/whatsapp/connection/embedded/:session   oturumun sonucu: { state: waiting | error (message) | ready (connection) }
// Yazma uçları salt okunur lisansta app.mjs'teki genel kapıda (license.assertWritable) 403 LICENSE_READ_ONLY alır; deneme ayrıca burada denetlenir.
//
// 2.4.8 W2 (plan §6 W2; lib/whatsapp/queue.mjs): gönderim çekirdeği — toplu gönderim (Ekstre + PDF / Ödeme Hatırlatma), yetki whatsapp.send.
//   GET  /api/workspace/whatsapp/ack                         bir kez onay ("Aydınlatma metnimi okudum, carilerime ulaştıracağım.") — whatsapp.send
//   PUT  /api/workspace/whatsapp/ack                         { ack: true | false } — yalnız yönetici (system.manage)
//   GET|PUT /api/workspace/whatsapp/sending-settings         { dailyCap (elle günlük sınır, boş = Meta), ttlHours (S2 A: 72) } — system.manage
//   POST /api/workspace/whatsapp/batches/preview             önizleme: kişiler, atlama nedenleri, bugünkü sınırdan kalan, yarına kalacak (Meta'ya yalnız okuma)
//   POST /api/workspace/whatsapp/batches                     { kind: statement|reminder, ids | all + süzgeçler, preset | from + to, requestId, repeat }
//   GET  /api/workspace/whatsapp/batches                     son toplu gönderimler; GET …/batches/:id ayrıntı + işler
//   POST /api/workspace/whatsapp/batches/:id/pause | resume | cancel | retry-failed
//   POST /api/workspace/whatsapp/jobs/:id/send-anyway        Sonucu Belirsiz → "Yine de Gönder" { confirm: true }
//   GET  /api/workspace/whatsapp/stats?month=YYYY-MM         "Bu Ay Gönderilen İleti Sayısı" (Meta Kabul Etti / Teslim Edilen (Ücretli) / yaklaşık ücret)
// 2.4.8 W4 (gönderim ekranı, client/assets/hof-whatsapp-api.js):
//   GET  /api/workspace/whatsapp/sending-status              cari ekranının WhatsApp penceresi hangi yolu açacak: bağlantı (sınanmış mı), şablonların son denetimi,
//                                                           lisans, kişinin yetkisi, onay, süren gönderimler, bu ay sayısı. accounts.view (wa.me yolunun yetkisi) —
//                                                           gizli değer YOK, Meta'ya istek YOK; yetkisiz kişi yalnız "yetkiniz yok" nedenini görür.
// Onay ve salt okunur lisans SUNUCUDA da denetlenir (istemci atlatılsa da gönderim başlamaz).
import { HttpError, isRemoteRequest, limited, ok, readJson, text } from "../lib/http.mjs";
import { roundMoney } from "../lib/money.mjs";
import { systemClock } from "../lib/clock.mjs";
import { createWhatsappConnection } from "../lib/whatsapp/connection.mjs";
import { createEmbeddedSignup, requestOrigin } from "../lib/whatsapp/embedded.mjs";
import { createWaQueue } from "../lib/whatsapp/queue.mjs";
import { createReportHeader } from "../lib/report-header.mjs";
import { waNumber, waPresetRange as presetRange } from "../lib/whatsapp/alici.mjs";
import { registerWhatsappTemplateRoutes } from "./whatsapp-sablon.mjs";
import { canUser } from "../lib/permissions.mjs";

const MAX_TARGETS = 5000;
const pad = value => String(value).padStart(2, "0");
const dayText = iso => (iso ? `${iso.slice(8, 10)}.${iso.slice(5, 7)}.${iso.slice(0, 4)}` : "");
const tl = value => `${new Intl.NumberFormat("tr-TR", { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(Number(value) || 0)} TL`;

// Telefon → wa.me biçimi ve WhatsApp penceresinin dönemleri: lib/whatsapp/alici.mjs (2.4.8 W2: API çekirdeği de aynı kuralla okur).
export { waNumber };

// Kişiye özel ekstre metni (WhatsApp'ta düz metin; kalın için *…*). En çok 20 hareket; fazlası sayı olarak belirtilir.
export function statementText({ office, account, lines, range, next, overdue }) {
  const inRange = lines.filter(line => (!range.from || line.date >= range.from) && (!range.to || line.date <= range.to));
  const before = range.from ? lines.filter(line => line.date < range.from) : [];
  const opening = before.length ? before.at(-1).balance : 0;
  const closing = lines.length ? lines.filter(line => !range.to || line.date <= range.to).at(-1)?.balance ?? opening : 0;
  const side = value => (value > 0.005 ? "borcunuz" : value < -0.005 ? "alacağınız" : "");
  const shown = inRange.slice(-20);
  const out = [`Sayın ${account.name},`, `${office ? `${office} ` : ""}cari hesap ekstreniz${range.from ? ` (${dayText(range.from)} – ${dayText(range.to)})` : ""}:`, ""];
  if (before.length) out.push(`Devir: ${tl(Math.abs(opening))}${side(opening) ? ` (${side(opening)})` : ""}`);
  if (inRange.length > shown.length) out.push(`… önceki ${inRange.length - shown.length} hareket`);
  for (const line of shown) {
    const amount = line.debit ? `+${tl(line.debit)}` : line.credit ? `−${tl(line.credit)}` : "";
    if (!amount) continue;
    out.push(`${dayText(line.date)} ${line.label}${line.note ? ` · ${String(line.note).slice(0, 60)}` : ""}: ${amount}`);
  }
  if (!inRange.length) out.push("Bu dönemde hareket yok.");
  out.push("", `*Güncel bakiye: ${tl(Math.abs(closing))}${side(closing) ? ` (${side(closing)})` : ""}*`);
  if (overdue?.count) out.push(`Vadesi geçen: ${overdue.count} taksit, ${tl(overdue.amount)}`);
  if (next) out.push(`Sıradaki taksit: ${dayText(next.dueDate)} · ${tl(next.remaining ?? next.amount)}`);
  out.push("", "İyi günler dileriz.");
  return out.join("\n");
}

export function registerWhatsappRoutes(router, { store, auth, audit, accounts = () => null, config = {}, license = null, now: clock = systemClock, whatsapp = null, companyId = "", events = null, log = console, mobileRemote = null, mobileSyncOf = () => null }) {
  const today = () => {
    const d = clock();
    return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
  };
  const newId = prefix => `${prefix}-${crypto.randomUUID()}`;
  const lastSends = ids => {
    const out = new Map();
    if (!ids.length) return out;
    for (const row of store.all(`SELECT account_id AS accountId, kind, status, created_at AS at FROM message_sends WHERE account_id IN (${ids.map(() => "?").join(",")}) AND status = 'sent' ORDER BY created_at`, ...ids)) out.set(row.accountId, row);
    return out;
  };

  // 2.4.8 W2: gönderim kuyruğu (aşağıda kurulur; geçmiş ucu istek anında okur).
  let queue = null;
  router.post("/api/workspace/whatsapp/targets", async ({ req, res }) => {
    const user = auth.requirePermission(req, "accounts.view");
    const body = await readJson(req, { limit: 2_000_000 });
    const kind = body.kind === "statement" ? "statement" : "message";
    const service = accounts();
    if (!service?.list || !service?.detail) throw new HttpError(503, "Cari modülü hazır değil.");
    let ids;
    if (body.all === true) {
      ids = service.list(user, { q: text(body.q).slice(0, 120), group: text(body.group), subgroup: text(body.subgroup), type: text(body.type), status: ["active", "passive", "all"].includes(text(body.status)) ? text(body.status) : "active", balance: text(body.balance) || "all" }).accounts.map(item => item.id);
      // "Hepsini seç, sonra birkaçını çıkar": except — işareti kaldırılanlar gönderilmez.
      const except = new Set(Array.isArray(body.except) ? body.except.map(value => String(value || "")) : []);
      ids = ids.filter(id => !except.has(id));
    } else ids = [...new Set((Array.isArray(body.ids) ? body.ids : []).map(value => String(value || "").slice(0, 120)).filter(Boolean))];
    if (!ids.length) throw new HttpError(400, "Gönderilecek carileri seçin.");
    if (ids.length > MAX_TARGETS) throw new HttpError(400, `Tek seferde en çok ${MAX_TARGETS} cariye gönderilebilir; süzgeçle daraltın.`);
    const range = presetRange(text(body.preset) || "thisMonth", today());
    const office = store.setting("office.name", "") || "";
    const sent = lastSends(ids);
    const recipients = [];
    for (const id of ids) {
      let account;
      try {
        account = service.detail(id, user);
      } catch {
        continue;
      }
      const phone = waNumber(account.phone);
      // 2.4.8 W2: "WhatsApp Mesajı İstemiyor" işaretli cari elle (wa.me) toplu/tekli gönderimde de seçilemez (BAŞ MİMAR KARARI; Sohbeti Aç serbest).
      if (Number(account.waOptOut) === 1) Object.assign(phone, { valid: false, reason: "WhatsApp Mesajı İstemiyor" });
      const plans = (account.plans || []).filter(plan => plan.status === "active");
      const next = plans.map(plan => plan.next).filter(Boolean).sort((a, b) => (a.dueDate < b.dueDate ? -1 : 1))[0] || null;
      const overdue = { count: account.totals.overdueCount || 0, amount: roundMoney(account.totals.overdue || 0) };
      const payments = (account.ledger || []).filter(line => line.kind === "in" || line.kind === "plan-in");
      const last = payments.at(-1) || null;
      recipients.push({
        id: account.id,
        refNo: account.refNo,
        name: account.name,
        type: account.type,
        phone: account.phone || "",
        wa: phone.wa,
        valid: phone.valid,
        reason: phone.reason,
        optOut: Number(account.waOptOut) === 1,
        balance: account.totals.balance,
        next: next ? { dueDate: next.dueDate, amount: roundMoney(next.remaining ?? next.amount ?? 0) } : null,
        overdue,
        lastPayment: last ? { date: last.date, amount: last.credit } : null,
        lastSend: sent.get(account.id) || null,
        statement: kind === "statement" ? statementText({ office, account, lines: account.ledger || [], range, next, overdue }) : "",
      });
    }
    audit(user, "whatsapp.prepared", "batch", { kind, count: recipients.length, valid: recipients.filter(item => item.valid).length });
    ok(res, { kind, office, range, today: today(), recipients });
  });

  router.post("/api/workspace/whatsapp/log", async ({ req, res }) => {
    const user = auth.requirePermission(req, "accounts.view");
    const body = await readJson(req, { limit: 200_000 });
    const accountId = limited(body.accountId, 120, "Cari");
    if (!accounts()?.exists?.(accountId)) throw new HttpError(400, "Cari bulunamadı.");
    const kind = body.kind === "statement" ? "statement" : "message";
    const status = body.status === "skipped" ? "skipped" : "sent";
    const id = newId("wa");
    store.run(
      "INSERT INTO message_sends (id, batch_id, account_id, kind, phone, body, status, created_by, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)",
      id, limited(body.batchId, 120, "Gönderim") || id, accountId, kind, limited(body.phone, 30, "Telefon"), limited(body.body, 8000, "Mesaj"), status, user.id, clock().toISOString(),
    );
    ok(res, { id });
  });

  router.get("/api/workspace/whatsapp/history", async ({ req, res, url }) => {
    auth.requirePermission(req, "accounts.view");
    const accountId = limited(url.searchParams.get("accountId"), 120, "Cari");
    const manual = store.all(
      `SELECT s.id, s.kind, s.status, s.body, s.created_at AS at, COALESCE(u.display_name, '') AS actorName FROM message_sends s LEFT JOIN users u ON u.id = s.created_by
       WHERE s.account_id = ? ORDER BY s.created_at DESC LIMIT 20`,
      accountId,
    );
    // 2.4.8 W2: cari kartı geçmişi iki yolu birleştirir (plan §6 W2): elle (wa.me, message_sends) + otomatik (WhatsApp Business API, wa_jobs; channel "api").
    const automatic = queue ? queue.historyOf(accountId) : [];
    ok(res, [...manual.map(row => ({ ...row, channel: "manual" })), ...automatic].sort((a, b) => (a.at < b.at ? 1 : a.at > b.at ? -1 : 0)).slice(0, 20));
  });

  // ---------- 2.4.8 W1: WhatsApp Business API bağlantısı ----------
  // onChange (W2/W9): ortak katmanın kaydı (tünel kuralı, durum bildiriminin şirketi) — lib/whatsapp/hub.mjs.
  const connection = createWhatsappConnection({ store, config, audit, now: clock, onChange: summary => whatsapp?.registry?.set(companyId, summary) });
  const writable = () => !license || license.writable();
  const view = () => connection.view({ writable: writable() });
  router.get("/api/workspace/whatsapp/connection", async ({ req, res }) => {
    auth.requirePermission(req, "system.manage");
    ok(res, view());
  });
  router.put("/api/workspace/whatsapp/connection", async ({ req, res }) => {
    const user = auth.requirePermission(req, "system.manage");
    // Belirteç uzunluğuna sınır konmaz (Meta: değişken uzunluk); gövde bütünüyle 64 KB ile sınırlı.
    const body = await readJson(req, { limit: 64 * 1024 });
    connection.save(user, body);
    ok(res, view());
  });
  router.delete("/api/workspace/whatsapp/connection", async ({ req, res }) => {
    const user = auth.requirePermission(req, "system.manage");
    connection.remove(user);
    ok(res, view());
  });
  router.post("/api/workspace/whatsapp/connection/test", async ({ req, res }) => {
    const user = auth.requirePermission(req, "system.manage");
    await connection.test(user);
    ok(res, view());
  });
  // 2.4.8 W9: durum bildirimi (web kancası) adresini Meta'ya şimdi kaydet (bakım turu da kendiliğinden kaydeder; bu uç ekrandaki "Yeniden Kaydet" içindir).
  router.post("/api/workspace/whatsapp/connection/hook", async ({ req, res }) => {
    const user = auth.requirePermission(req, "system.manage");
    if (!writable()) throw new HttpError(403, "Program salt okunur çalışıyor; durum bildirimi adresi kaydedilemez.", { code: "LICENSE_READ_ONLY" });
    await connection.registerHook(user, mobileRemote?.publicUrl?.() || "");
    ok(res, view());
  });
  router.post("/api/workspace/whatsapp/connection/self-test", async ({ req, res }) => {
    // Bağlantı ekranının denemesi: yalnız yönetici (system.manage yalnız yönetici rolündedir ve yönetici her yetkiye — whatsapp.send dahil — sahiptir).
    // whatsapp.send kişiye verilebilen toplu gönderim yetkisidir (W2/W4). Salt okunur lisansta gönderim başlamaz (plan §4): genel kapı + burada da.
    const user = auth.requirePermission(req, "system.manage");
    if (!writable()) throw new HttpError(403, "Program salt okunur çalışıyor; WhatsApp iletisi gönderilemez.", { code: "LICENSE_READ_ONLY" });
    const body = await readJson(req, { limit: 4096 });
    const phone = waNumber(limited(body.to, 40, "Cep Telefonu"));
    if (!phone.valid) throw new HttpError(400, `Deneme numarası kullanılamaz: ${phone.reason}. Kendi cep telefonu numaranızı yazın (ör. 0532 123 45 67).`, { code: "whatsapp-invalid", field: "to" });
    // Meta: numara "+" ve ülke koduyla verilmezse işletmenin ülke kodu eklenir (yanlış kişi riski) — her zaman "+" ile.
    const result = await connection.selfTest(user, `+${phone.wa}`);
    ok(res, { result: result.result, connection: view() });
  });

  // ---------- 2.4.8 W7: "WhatsApp'ı Bağla" (Embedded Signup + birlikte kullanım; lib/whatsapp/embedded.mjs, kapıcı bulut/kapi/wa-bagla.mjs) ----------
  // Düğme düz açık (ürün sahibi kararı); DestekOfis Meta'da Tech Provider olana dek kapıcı "Bu bağlantı DestekOfis'in Meta onayından sonra çalışır; şimdilik
  // Elle Bağla." der. Belirteç kapıcıdan şifreli gelir, burada mühürlenir; yanıtlara girmez.
  const embedded = createEmbeddedSignup({ mobileSync: mobileSyncOf, now: () => clock().getTime() });
  router.post("/api/workspace/whatsapp/connection/embedded", async ({ req, res }) => {
    auth.requirePermission(req, "system.manage");
    if (!writable()) throw new HttpError(403, "Program salt okunur çalışıyor; WhatsApp bağlanamaz.", { code: "LICENSE_READ_ONLY" });
    // Yanıttaki tek kullanımlık sır yalnız bu ekrana (adrese yazılmaz, işlem geçmişine / günlüğe girmez); oturum yalnız programın yerel adresinden açılır.
    ok(res, await embedded.start({ companyId, origin: requestOrigin(req, config.trustProxy), remote: isRemoteRequest(req), firma: store.setting("office.name", "") || "" }));
  });
  router.post("/api/workspace/whatsapp/connection/embedded/:session", async ({ req, res, params }) => {
    const user = auth.requirePermission(req, "system.manage");
    if (!writable()) throw new HttpError(403, "Program salt okunur çalışıyor; WhatsApp bağlanamaz.", { code: "LICENSE_READ_ONLY" });
    const result = await embedded.poll({ session: params.session, companyId });
    if (result.state !== "ready") return ok(res, { state: result.state, ...(result.message ? { message: result.message } : {}) });
    connection.saveEmbedded(user, { token: result.token, wabaId: result.wabaId, phoneNumberId: result.phoneNumberId, olay: result.event });
    // Meta adımları (birlikte kullanımda eşitleme / değilse numara kaydı) ve Bağlantıyı Sına: hata bağlantıyı bozmaz, sonuç kartta.
    for (const step of [() => connection.embeddedSteps(user), () => connection.test(user)]) {
      try {
        await step();
      } catch (error) {
        log.warn?.(`WhatsApp'ı Bağla sonrası adım tamamlanamadı: ${error?.message || error}`);
      }
    }
    ok(res, { state: "ready", connection: view() });
  });

  // ---------- 2.4.8 W5: bilgilendirme şablonları (routes/whatsapp-sablon.mjs) ----------
  const templates = registerWhatsappTemplateRoutes(router, { store, auth, audit, config, license, now: clock, connection });

  // ---------- 2.4.8 W4: gönderim ekranının durumu ----------
  router.get("/api/workspace/whatsapp/sending-status", async ({ req, res }) => {
    const user = auth.requirePermission(req, "accounts.view");
    const record = connection.read();
    const canSend = canUser(user, "whatsapp.send");
    const base = { configured: Boolean(record), writable: writable(), canSend, canManage: canUser(user, "system.manage"), api: Boolean(queue) };
    if (!record) return ok(res, base);
    const conn = connection.view({ writable: writable() });
    const stored = templates?.view?.() || null;
    const items = Object.fromEntries((stored?.items || []).map(item => [item.kind, { name: item.name, usable: Boolean(item.usable), statusLabel: item.statusLabel || "" }]));
    const tested = Boolean(conn.lastTest?.ok);
    const linkBlock = !conn.graphAvailable
      ? "Bu kurulumda WhatsApp Business API adresi tanımlı değil; Meta'ya bağlanılamaz."
      : !conn.tokenUsable
        ? "Kayıtlı erişim belirteci bu bilgisayarda açılamıyor; yönetici Yönetim → WhatsApp'ta belirteci yeniden girmeli."
        : !conn.lastTest
          ? "WhatsApp bağlantısı henüz sınanmadı; yönetici Yönetim → WhatsApp'ta Bağlantıyı Sına'ya basmalı."
          : !tested
            ? `WhatsApp bağlantısının son sınaması başarısız (${conn.lastTest.message || "neden bilinmiyor"}); yönetici Yönetim → WhatsApp'ta bilgileri düzeltip yeniden sınamalı.`
            : "";
    const out = {
      ...base,
      mode: conn.mode,
      tested,
      linkBlock,
      phone: tested ? { display: conn.lastTest.phone?.display || "", verifiedName: conn.lastTest.phone?.verifiedName || "", tierLabel: conn.lastTest.phone?.tierLabel || "" } : null,
      templates: { checkedAt: stored?.checkedAt || null, statement: items.statement || null, reminder: items.reminder || null },
    };
    if (queue && canSend) {
      out.ack = queue.ackView();
      out.active = queue.list({ limit: 20 }).filter(batch => ["running", "paused"].includes(batch.state)).map(batch => ({ id: batch.id, kindLabel: batch.kindLabel, stateLabel: batch.stateLabel, total: batch.total, createdAt: batch.createdAt }));
      out.stats = queue.monthStats("");
    }
    ok(res, out);
  });

  // ---------- 2.4.8 W2: gönderim çekirdeği ----------
  if (!whatsapp?.ledger) return { connection, queue: null };
  const header = createReportHeader({ store });
  queue = createWaQueue({
    store,
    companyId,
    ledger: whatsapp.ledger,
    connection,
    accounts,
    now: clock,
    audit,
    log,
    license: { status: () => ({ writable: writable() }) },
    header: () => header.pdf({ brand: store.setting("office.name", "") || "DestekOfis" }),
    events,
    kick: () => whatsapp.scheduler?.kick(),
    fault: config.whatsappFault || null,
    // W9: durum bildirimi adresinin tabanı = ofisin uzaktan (telefon) adresi (tünel açılınca hazır; lib/tunnel/manager.mjs).
    hookUrl: () => mobileRemote?.publicUrl?.() || "",
  });
  const sendUser = req => auth.requirePermission(req, "whatsapp.send");
  router.get("/api/workspace/whatsapp/ack", async ({ req, res }) => {
    sendUser(req);
    ok(res, queue.ackView());
  });
  router.put("/api/workspace/whatsapp/ack", async ({ req, res }) => {
    const user = auth.requirePermission(req, "system.manage");
    const body = await readJson(req, { limit: 4096 });
    ok(res, queue.setAck(user, body.ack === true));
  });
  router.get("/api/workspace/whatsapp/sending-settings", async ({ req, res }) => {
    auth.requirePermission(req, "system.manage");
    ok(res, queue.settings());
  });
  router.put("/api/workspace/whatsapp/sending-settings", async ({ req, res }) => {
    const user = auth.requirePermission(req, "system.manage");
    const body = await readJson(req, { limit: 4096 });
    ok(res, queue.setSending(user, body));
  });
  // Plan §7a 29: başlatma reddi sırası bağlı değil → yetki → lisans → onay → şablon (salt okunur lisansta app.mjs'nin genel yazma kapısı her POST'tan önce 403 verir).
  router.post("/api/workspace/whatsapp/batches/preview", async ({ req, res }) => {
    queue.connected();
    const user = sendUser(req);
    const body = await readJson(req, { limit: 2_000_000 });
    ok(res, await queue.preview(user, body));
  });
  router.post("/api/workspace/whatsapp/batches", async ({ req, res }) => {
    queue.connected();
    const user = sendUser(req);
    const body = await readJson(req, { limit: 2_000_000 });
    ok(res, await queue.createBatch(user, body));
  });
  router.get("/api/workspace/whatsapp/batches", async ({ req, res, url }) => {
    sendUser(req);
    ok(res, queue.list({ limit: Number(url.searchParams.get("limit")) || 50 }));
  });
  router.get("/api/workspace/whatsapp/batches/:id", async ({ req, res, params }) => {
    sendUser(req);
    ok(res, queue.detail(params.id));
  });
  for (const action of ["pause", "resume", "cancel", "retry-failed"]) {
    router.post(`/api/workspace/whatsapp/batches/:id/${action}`, async ({ req, res, params }) => {
      const user = sendUser(req);
      const body = await readJson(req, { limit: 4096 }).catch(() => ({}));
      if (action === "pause") return ok(res, queue.pause(user, params.id));
      if (action === "resume") return ok(res, queue.resume(user, params.id));
      if (action === "cancel") return ok(res, queue.cancel(user, params.id));
      ok(res, await queue.retryFailed(user, params.id, body || {}));
    });
  }
  router.post("/api/workspace/whatsapp/jobs/:id/send-anyway", async ({ req, res, params }) => {
    const user = sendUser(req);
    const body = await readJson(req, { limit: 4096 });
    ok(res, await queue.sendAnyway(user, params.id, body));
  });
  router.get("/api/workspace/whatsapp/stats", async ({ req, res, url }) => {
    sendUser(req);
    ok(res, queue.monthStats(url.searchParams.get("month") || ""));
  });
  return { connection, queue };
}
