// Banka uçları (v2.1.0 Aşama 3; docs/BANKA-MODULU-PLAN.md §8.1 "API", §9.1 yetkiler). Hizmet: lib/bank/accounts.mjs.
//
// Özel yollar ":id"li yollardan önce kaydedilir. Yazan her uç bank.post'tan geçer ve "x-hof-request" (istek kimliği) alır; GET uçları
// hiçbir koşulda yazmaz. Yanıt { ok, data }; hata Türkçe cümle ve code taşır.
//   GET  /bank/summary                       bank.view       K10 adları, Gerçek Banka, Hesabı Atanmamış, kart ve kredi borcu; setup.dismissed
//                                                            (bu kişi Kurulum Sihirbazı'nı bu şirkette kapattı mı)
//   GET  /bank/badge?count=1                 bank.view       menü rozeti: Hesabı Belirsiz Yeni Hareketler sayısı (yalnız okuma, ucuz)
//   POST /bank/setup/dismiss                 bank.view       Kurulum Sihirbazı'nı kapat (kişi ve şirket bazında; para yazmaz)
//   GET  /bank/choices                       (seçici izinleri) form seçicileri; BAKİYE DÖNMEZ
//   GET  /bank/settings · PUT · POST /reset  view · settings Banka Ayarları (Temel/Gelişmiş, Varsayılanlara Dön)
//   GET  /bank/accounts · POST               view · accounts hesap listesi; hesap aç (açılış dahil)
//   GET  /bank/accounts/:id · PUT · DELETE   view · accounts hesap kartı (+ son hareketler: recent); düzelt; sil (yalnız hareketsiz)
//   POST /bank/accounts/:id/status           accounts        Pasife Al / Etkinleştir
//   POST /bank/accounts/:id/opening          accounts (+ düzeltmede cancel)  Açılış Bakiyesi Gir / Açılışı Düzelt
//   GET  /bank/legacy · POST /assign · /reclass  view · accounts  Hesabı Atanmamış Eski Hareketler; Bu Hesaba Ata; Bankaya Geçmiş Say
//   POST /bank/setup?dryRun=1 · GET · POST /setup/:id/undo  accounts · view · accounts  Kurulum ve Aktarım Sihirbazı
//   GET  /bank/sub-trial?from=&to=           bank.reports    Alt Hesap Mizanı
// Aşama 4 (Banka Hareketleri; lib/bank/vouchers.mjs, lib/bank/movements.mjs):
//   GET  /bank/voucher-meta                  bank.view       fiş formunun seçenekleri (türler, masraf türleri, vergi kipleri, tekrarlar)
//   POST /bank/vouchers                      bank.move (+ kredi: bank.transfer; KDV'li masraf: invoices.manage)  Banka Fişi → İşlem Kartı
//   POST /bank/transfers                     bank.transfer   Bankalar Arası Transfer (ücret, kanal, valör), Kredi Kullanımı/Geri Ödemesi (Aşama 9)
//   GET  /bank/movements?account=&type=&dir=&status=&from=&to=&q=&planned=1&limit=&cursor=  bank.view  Hareketler (imleçli)
//   GET  /bank/events/:ref                   bank.view       İşlem Kartı (İşlem No ya da kimlik)
//   POST /bank/events/:id/reverse            bank.cancel (+ KDV'li masraf: invoices.manage)  Ters Kaydet
//   POST /bank/events/:id/correct            bank.move + bank.cancel (+ kredi / KDV'li masraf)  Düzelt (ters + yeni, tek işlem)
//   PUT  /bank/events/:id/info               bank.move       açıklama ve referans (kilitli dönemde de)
//   GET  /bank/plans · POST · /:id/execute · /:id/skip · DELETE /:id   view · move  Planlı İşlemler (deftere girmez; Gerçekleştir fiş yazar)
//   GET  /bank/reports/fees?from=&to=&account=&format=xlsx  bank.reports  Banka Masraf Raporu verisi (Excel: metin hücreleri)
import { HttpError, ok, readJson, sendBuffer, text } from "../lib/http.mjs";
import { canUser } from "../lib/permissions.mjs";
import { createBankAccounts } from "../lib/bank/accounts.mjs";
import { createBankMovements } from "../lib/bank/movements.mjs";
import { TRANSFER_TYPES, createBankVouchers } from "../lib/bank/vouchers.mjs";
import { CHART } from "../lib/general-ledger.mjs";
import { createModuleBank } from "../lib/bank/module-ref.mjs";

const BASE = "/api/workspace/bank";
/** Seçiciyi görebilenler (§8.1): banka formu olan her modülün yazma yetkisi ya da banka görüntüleme. */
const CHOICE_PERMISSIONS = ["bank.view", "accounts.collect", "plans.collect", "payments.create", "invoices.manage", "stock.sell", "stock.manage", "cheques.manage", "cash.manage"];

export function registerBankRoutes(router, context) {
  const { store, auth, audit, events, bank, period, money } = context;
  const service = createBankAccounts({ store, bank, period, money, ledger: () => context.ledger, now: context.now, fxEnabled: () => context.config?.fxEnabled === true });
  const movements = createBankMovements({ store, money, accounts: service, ledger: () => context.ledger, period, now: context.now });
  const vouchers = createBankVouchers({ store, bank, period, money, accounts: service, movements, invoices: () => context.invoices, parties: () => context.accounts, audit, now: context.now });
  const changed = (user, extra = {}) => events?.publish("workspace.changed", { kind: "bank", actorId: user.id, actorName: user.display_name, ...extra }, { except: user.id });
  const requestIdOf = (req, body) => text(req.headers["x-hof-request"]) || text(body?.requestId);
  const mustAccount = id => {
    const row = service.rowOf(id);
    if (!row) throw new HttpError(404, "Banka hesabı bulunamadı. Silinmiş ya da başka şirkete ait olabilir.", { code: "bank-account-missing" });
    return row;
  };
  const settingsView = () => {
    const values = service.settings.read();
    const sections = service.settings.sections().map(section => ({ ...section, items: section.items.map(item => (item.type === "fixed" ? item : { ...item, value: values[section.id]?.[item.key] })) }));
    // chart: hesap eşlemelerinde kodun yanında hesap adı (770 Genel Giderler ve Alış Faturaları …).
    return { values, defaults: service.settings.defaults(), sections, chart: CHART };
  };

  // ---------- Özet, seçici, ayarlar ----------
  router.get(`${BASE}/summary`, async ({ req, res }) => {
    const user = auth.requirePermission(req, "bank.view");
    const summary = service.summary();
    // Aşama 9 (§8.4 K10, §12.3 Aşama 6 "Banka Bugün Çıkış transferi saymaz, Transfer satırında"): Bugün ve Bu Ay giriş-çıkışı tek kaynaktan;
    // Bu Ay'ın Banka Masrafları Banka Masraf Raporu'yla aynı tanım (masraf fişleri, KDV'li masraf ve transfer ücretleri).
    const today = period.today();
    const monthStart = `${today.slice(0, 7)}-01`;
    const flows = money?.flows?.(today, monthStart) || null;
    if (flows) flows.month.feeMinor = movements.feeReport({ from: monthStart, to: today }).totals.totalMinor;
    ok(res, { ...summary, setup: { ...summary.setup, dismissed: service.setupDismissed(user) }, ...(flows ? { flows: { ...flows, day: today, monthStart } } : {}) });
  });
  router.get(`${BASE}/badge`, async ({ req, res }) => {
    auth.requirePermission(req, "bank.view");
    // 2.1.0'da rozet Hesabı Belirsiz Yeni Hareketler'i (eski sürümün yazdığı, açılış onarımının bulduğu satırlar) ve vadesi gelen Planlı
    // İşlemler'i (Aşama 4) sayar; eşleşmeyen ekstre satırı (2.3.0) ve onay bekleyen valör (2.2.0) o sürümlerde eklenir. Yazmaz.
    ok(res, { count: service.badgeCount() + vouchers.dueCount() });
  });
  router.get(`${BASE}/choices`, async ({ req, res }) => {
    const user = auth.requireUser(req);
    if (!CHOICE_PERMISSIONS.some(permission => canUser(user, permission))) throw new HttpError(403, "Bu işlem için yetkiniz yok.", { code: "FORBIDDEN" });
    ok(res, service.choices());
  });
  router.get(`${BASE}/settings`, async ({ req, res }) => {
    auth.requirePermission(req, "bank.view");
    ok(res, settingsView());
  });
  router.put(`${BASE}/settings`, async ({ req, res }) => {
    const user = auth.requirePermission(req, "bank.settings");
    const body = await readJson(req);
    store.tx(() => {
      const { previous, next } = service.settings.update(body?.values, user.id);
      audit(user, "bank.settings.updated", "bank.settings", { previous, next });
    });
    changed(user, { settings: true });
    ok(res, settingsView());
  });
  router.post(`${BASE}/settings/reset`, async ({ req, res }) => {
    const user = auth.requirePermission(req, "bank.settings");
    const body = await readJson(req);
    store.tx(() => {
      const { previous, next, sections } = service.settings.reset({ section: text(body?.section), level: text(body?.level) }, user.id);
      audit(user, "bank.settings.reset", "bank.settings", { previous, next, sections });
    });
    changed(user, { settings: true });
    ok(res, settingsView());
  });

  // ---------- Hesabı Atanmamış Eski Hareketler, Kurulum Sihirbazı (özel yollar :id'den önce) ----------
  router.get(`${BASE}/legacy`, async ({ req, res, url }) => {
    auth.requirePermission(req, "bank.view");
    ok(res, service.legacy({ way: text(url.searchParams.get("way")), limit: Number(url.searchParams.get("limit")) || 1000 }));
  });
  router.post(`${BASE}/legacy/assign`, async ({ req, res }) => {
    const user = auth.requirePermission(req, "bank.accounts");
    const body = await readJson(req);
    const result = service.assign(user, body, { requestId: requestIdOf(req, body) });
    changed(user);
    ok(res, result);
  });
  router.post(`${BASE}/legacy/reclass`, async ({ req, res }) => {
    const user = auth.requirePermission(req, "bank.accounts");
    const body = await readJson(req);
    const result = service.reclass(user, body, { requestId: requestIdOf(req, body) });
    changed(user);
    ok(res, result);
  });
  router.get(`${BASE}/setup`, async ({ req, res }) => {
    auth.requirePermission(req, "bank.view");
    ok(res, { runs: service.runs() });
  });
  router.post(`${BASE}/setup`, async ({ req, res, url }) => {
    const user = auth.requirePermission(req, "bank.accounts");
    const body = await readJson(req);
    const dryRun = ["1", "true"].includes(text(url.searchParams.get("dryRun")));
    const result = service.setup(user, body, { dryRun, requestId: requestIdOf(req, body) });
    if (!dryRun) changed(user);
    ok(res, result);
  });
  router.post(`${BASE}/setup/dismiss`, async ({ req, res }) => {
    const user = auth.requirePermission(req, "bank.view");
    ok(res, service.dismissSetup(user));
  });
  router.post(`${BASE}/setup/:id/undo`, async ({ req, res, params }) => {
    const user = auth.requirePermission(req, "bank.accounts");
    const result = service.undo(user, params.id);
    changed(user);
    ok(res, result);
  });
  router.get(`${BASE}/sub-trial`, async ({ req, res, url }) => {
    auth.requirePermission(req, "bank.reports");
    ok(res, service.subTrialData({ from: text(url.searchParams.get("from")), to: text(url.searchParams.get("to")) }));
  });

  // ---------- Hesaplar ----------
  router.get(`${BASE}/accounts`, async ({ req, res, url }) => {
    auth.requirePermission(req, "bank.view");
    const status = text(url.searchParams.get("status"));
    if (status && !["active", "passive", "all"].includes(status)) throw new HttpError(400, "Durum süzgeci Etkin, Pasif ya da Tümü olmalı.", { code: "bank-status" });
    ok(res, service.list({ status }));
  });
  router.post(`${BASE}/accounts`, async ({ req, res }) => {
    const user = auth.requirePermission(req, "bank.accounts");
    const body = await readJson(req);
    const result = service.create(user, body, { requestId: requestIdOf(req, body) });
    changed(user);
    ok(res, result);
  });
  router.get(`${BASE}/accounts/:id`, async ({ req, res, params }) => {
    auth.requirePermission(req, "bank.view");
    const row = mustAccount(params.id);
    const recent = service.recent(row);
    ok(res, { ...service.view(row), recent: recent.items, recentTotal: recent.total });
  });
  router.put(`${BASE}/accounts/:id`, async ({ req, res, params }) => {
    const user = auth.requirePermission(req, "bank.accounts");
    mustAccount(params.id);
    const body = await readJson(req);
    const result = service.update(user, params.id, body);
    changed(user);
    ok(res, result);
  });
  router.post(`${BASE}/accounts/:id/status`, async ({ req, res, params }) => {
    const user = auth.requirePermission(req, "bank.accounts");
    mustAccount(params.id);
    const body = await readJson(req);
    const result = service.setStatus(user, params.id, text(body?.status));
    changed(user);
    ok(res, result);
  });
  router.post(`${BASE}/accounts/:id/opening`, async ({ req, res, params }) => {
    const user = auth.requirePermission(req, "bank.accounts");
    mustAccount(params.id);
    // Açılışı Düzelt eski açılışı ters kaydeder: Banka Hareketi Silme, İptal ve Ters Kayıt yetkisi de gerekir (§9.1).
    // GG2 (düşük bulgu): sıfır (satırsız) açılışın yerine ilk açılışı girmek ters kayıt yazmaz → bank.cancel istemez (silme kuralıyla aynı).
    if (service.openingOf(params.id)?.lines) auth.requirePermission(req, "bank.cancel");
    const body = await readJson(req);
    const result = service.setOpening(user, params.id, body);
    changed(user);
    ok(res, result);
  });
  router.delete(`${BASE}/accounts/:id`, async ({ req, res, params }) => {
    const user = auth.requirePermission(req, "bank.accounts");
    mustAccount(params.id);
    if (service.openingOf(params.id)?.lines) auth.requirePermission(req, "bank.cancel");
    const result = service.remove(user, params.id);
    changed(user);
    ok(res, result);
  });

  // ---------- Aşama 4: Banka Fişi, Hareketler, İşlem Kartı, Planlı İşlemler, Banka Masraf Raporu ----------
  // Fişin ek yetkileri: kredi kullanımı/geri ödemesi Transfer Yapma (§9.1), KDV'li masraf (gider faturası keser) Fatura Yönetimi.
  const voucherPermissions = (req, body) => {
    const user = auth.requirePermission(req, "bank.move");
    if (TRANSFER_TYPES.has(text(body?.type))) auth.requirePermission(req, "bank.transfer");
    if (vouchers.needsInvoice(body)) auth.requirePermission(req, "invoices.manage");
    return user;
  };
  const eventPermissions = (req, ref, { cancel = false, move = false } = {}) => {
    let user = auth.requirePermission(req, cancel ? "bank.cancel" : "bank.move");
    if (move) user = auth.requirePermission(req, "bank.move");
    const event = movements.eventRow(ref);
    if (event && TRANSFER_TYPES.has(event.type)) auth.requirePermission(req, "bank.transfer");
    if (event && movements.isFeeHeader(event)) auth.requirePermission(req, "invoices.manage");
    return user;
  };
  router.get(`${BASE}/voucher-meta`, async ({ req, res }) => {
    auth.requirePermission(req, "bank.view");
    ok(res, vouchers.meta());
  });
  router.post(`${BASE}/vouchers`, async ({ req, res }) => {
    const body = await readJson(req);
    const user = voucherPermissions(req, body);
    const result = vouchers.create(user, body, { requestId: requestIdOf(req, body) });
    if (!result.replayed) changed(user, { eventId: result.id });
    ok(res, result);
  });
  // Aşama 9 (§7 POST /bank/transfers; §9.1 bank.transfer): Bankalar Arası Transfer (ücret, kanal, valör), Kredi Kullanımı ve Kredi Geri Ödemesi.
  // Yalnız "Transfer Yapma" yetkisi (§3.7 #11, #17). Ters Kaydet / Düzelt İşlem Kartı'ndan (bank.cancel + bank.transfer).
  router.post(`${BASE}/transfers`, async ({ req, res }) => {
    const user = auth.requirePermission(req, "bank.transfer");
    const body = await readJson(req);
    const result = vouchers.create(user, body, { requestId: requestIdOf(req, body), endpoint: "transfers" });
    if (!result.replayed) changed(user, { eventId: result.id });
    ok(res, result);
  });
  router.get(`${BASE}/movements`, async ({ req, res, url }) => {
    auth.requirePermission(req, "bank.view");
    ok(res, movements.list(url.searchParams));
  });
  router.get(`${BASE}/events/:ref`, async ({ req, res, params }) => {
    auth.requirePermission(req, "bank.view");
    ok(res, movements.card(params.ref));
  });
  router.post(`${BASE}/events/:ref/reverse`, async ({ req, res, params }) => {
    const user = eventPermissions(req, params.ref, { cancel: true });
    const body = await readJson(req);
    const result = vouchers.reverse(user, params.ref, body, { requestId: requestIdOf(req, body) });
    if (!result.replayed) changed(user, { eventId: result.original?.id });
    ok(res, result);
  });
  router.post(`${BASE}/events/:ref/correct`, async ({ req, res, params }) => {
    const user = eventPermissions(req, params.ref, { cancel: true, move: true });
    const body = await readJson(req);
    // Aşama 4 dilim 4 (nasıl bozarım): BSMV'li ya da vergisiz masrafı Düzelt'te "KDV Dahil/Hariç" yapmak gider faturası keser → Fatura
    // Yönetimi ister (önceden yalnız asıl masraf faturalıysa isteniyordu: yetkisiz kişi Düzelt'le fatura kesebiliyordu).
    const event = movements.eventRow(params.ref);
    if (event?.type === "fee" && text(body?.tax) && vouchers.needsInvoice({ type: "fee", tax: text(body.tax) })) auth.requirePermission(req, "invoices.manage");
    const result = vouchers.correct(user, params.ref, body, { requestId: requestIdOf(req, body) });
    if (!result.replayed) changed(user, { eventId: result.next?.id });
    ok(res, result);
  });
  router.put(`${BASE}/events/:ref/info`, async ({ req, res, params }) => {
    const user = auth.requirePermission(req, "bank.move");
    const body = await readJson(req);
    const result = vouchers.info(user, params.ref, body);
    changed(user, { eventId: result.id });
    ok(res, result);
  });
  router.get(`${BASE}/plans`, async ({ req, res, url }) => {
    auth.requirePermission(req, "bank.view");
    ok(res, vouchers.listPlans(url.searchParams));
  });
  router.post(`${BASE}/plans`, async ({ req, res }) => {
    const body = await readJson(req);
    const user = auth.requirePermission(req, "bank.move");
    if (TRANSFER_TYPES.has(text(body?.kind ?? body?.type))) auth.requirePermission(req, "bank.transfer");
    const result = vouchers.createPlan(user, body);
    changed(user, { planId: result.id });
    ok(res, result);
  });
  router.post(`${BASE}/plans/:id/execute`, async ({ req, res, params }) => {
    const user = auth.requirePermission(req, "bank.move");
    const plan = vouchers.mustPlan(params.id);
    if (TRANSFER_TYPES.has(plan.kind)) auth.requirePermission(req, "bank.transfer");
    const body = await readJson(req);
    const result = vouchers.executePlan(user, params.id, body, { requestId: requestIdOf(req, body) });
    if (!result.replayed) changed(user, { planId: params.id, eventId: result.event?.id });
    ok(res, result);
  });
  router.post(`${BASE}/plans/:id/skip`, async ({ req, res, params }) => {
    const user = auth.requirePermission(req, "bank.move");
    const body = await readJson(req);
    const result = vouchers.skipPlan(user, params.id, body);
    changed(user, { planId: params.id });
    ok(res, result);
  });
  router.delete(`${BASE}/plans/:id`, async ({ req, res, params }) => {
    const user = auth.requirePermission(req, "bank.move");
    const result = vouchers.cancelPlan(user, params.id);
    changed(user, { planId: params.id });
    ok(res, result);
  });
  router.get(`${BASE}/reports/fees`, async ({ req, res, url }) => {
    const user = auth.requirePermission(req, "bank.reports");
    const report = movements.feeReport(url.searchParams);
    if (text(url.searchParams.get("format")) === "xlsx") {
      const buffer = movements.feeXlsx(report);
      audit(user, "report.exported", "bank-fees", { format: "xlsx", rows: report.rows.length, from: report.from, to: report.to });
      return sendBuffer(res, buffer, { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet", name: "Banka Masraf Raporu.xlsx" });
    }
    ok(res, report);
  });

  // Modül formlarının hesap seçimi ve K7'si (Aşama 5–6; cari, Kasa ↔ Banka): modül rotaları istek anında context.bankAccounts.module'e ulaşır.
  service.module = createModuleBank({ store, accounts: service, negative: vouchers.negative, legacy: () => context.config?.bankPickLegacy === true });
  // Rapor Merkezi'nin Banka grubu (Aşama 14): Banka Masraf Raporu bu uçla aynı kaynaktan (movements.feeReport) okur.
  service.movements = movements;
  return service;
}
