// Banka uçları (v2.1.0 Aşama 3; docs/BANKA-MODULU-PLAN.md §8.1 "API", §9.1 yetkiler). Hizmet: lib/bank/accounts.mjs.
//
// Özel yollar ":id"li yollardan önce kaydedilir. Yazan her uç bank.post'tan geçer ve "x-hof-request" (istek kimliği) alır; GET uçları
// hiçbir koşulda yazmaz. Yanıt { ok, data }; hata Türkçe cümle ve code taşır.
//   GET  /bank/summary                       bank.view       K10 adları, Gerçek Banka, Hesabı Atanmamış, kart ve kredi borcu
//   GET  /bank/choices                       (seçici izinleri) form seçicileri; BAKİYE DÖNMEZ
//   GET  /bank/settings · PUT · POST /reset  view · settings Banka Ayarları (Temel/Gelişmiş, Varsayılanlara Dön)
//   GET  /bank/accounts · POST               view · accounts hesap listesi; hesap aç (açılış dahil)
//   GET  /bank/accounts/:id · PUT · DELETE   view · accounts hesap kartı; düzelt; sil (yalnız hareketsiz)
//   POST /bank/accounts/:id/status           accounts        Pasife Al / Etkinleştir
//   POST /bank/accounts/:id/opening          accounts (+ düzeltmede cancel)  Açılış Bakiyesi Gir / Açılışı Düzelt
//   GET  /bank/legacy · POST /assign · /reclass  view · accounts  Hesabı Atanmamış Eski Hareketler; Bu Hesaba Ata; Bankaya Geçmiş Say
//   POST /bank/setup?dryRun=1 · GET · POST /setup/:id/undo  accounts · view · accounts  Kurulum ve Aktarım Sihirbazı
//   GET  /bank/sub-trial?from=&to=           bank.reports    Alt Hesap Mizanı
import { HttpError, ok, readJson, text } from "../lib/http.mjs";
import { canUser } from "../lib/permissions.mjs";
import { createBankAccounts } from "../lib/bank/accounts.mjs";

const BASE = "/api/workspace/bank";
/** Seçiciyi görebilenler (§8.1): banka formu olan her modülün yazma yetkisi ya da banka görüntüleme. */
const CHOICE_PERMISSIONS = ["bank.view", "accounts.collect", "plans.collect", "payments.create", "invoices.manage", "stock.sell", "stock.manage", "cheques.manage", "cash.manage"];

export function registerBankRoutes(router, context) {
  const { store, auth, audit, events, bank, period, money } = context;
  const service = createBankAccounts({ store, bank, period, money, ledger: () => context.ledger, now: context.now });
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
    return { values, defaults: service.settings.defaults(), sections };
  };

  // ---------- Özet, seçici, ayarlar ----------
  router.get(`${BASE}/summary`, async ({ req, res }) => {
    auth.requirePermission(req, "bank.view");
    ok(res, service.summary());
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
    ok(res, service.view(mustAccount(params.id)));
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
    if (service.openingOf(params.id)) auth.requirePermission(req, "bank.cancel");
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

  return service;
}
