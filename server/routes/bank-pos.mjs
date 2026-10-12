// POS uçları (v2.2.0, plan §7 "API Planı" POS satırları; Aşama 10–11). Hizmet: lib/bank/pos.mjs. Bütün uçlar /api/workspace/bank/* altında
// ve şirkete gider; yazan her uç bank.post'tan geçer, GET uçları yazmaz. Özel yollar ":id"li yollardan önce kaydedilir.
//   GET  /bank/pos                              bank.view        POS listesi (bugün geçerli oranlar, bekleyen kalem özeti)
//   POST /bank/pos                              bank.pos (+ oran: bank.commission)  POS aç (oran ızgarası dahil)
//   GET  /bank/pos/preview?pos=&amount=&installments=&date=  (seçici izinleri)  tahsilat formunun önizlemesi (komisyon, net, valör günleri)
//   GET  /bank/pos/origins?invoice=|party=|plan=&pos=          (seçici izinleri)  POS İadesinin asıl işlem önerisi
//   GET  /bank/pos/row?row=tablo:kimlik                        (seçici izinleri)  düzeltme formunun POS bilgisi (taksit, provizyon, son 4)
//   GET  /bank/pos/sales?pos=&from=&to=&status=&kind=&row=  bank.view  POS İşlemleri (satış ve iadeler, kalemleriyle; row: tablo:kimlik)
//   GET  /bank/pos/sales/:id                    bank.view        POS işlemi (iadeleriyle)
//   POST /bank/pos/sales/:id/void               bank.cancel + accounts.manage  İptal Et (yalnız provizyon süresi içinde ve valörden önce; cari tahsilatı)
//   POST /bank/pos/sales/:id/refund             accounts.manage + bank.move  cari "POS İadesi" (asıl işleme bağlı)
//   GET  /bank/pos/calendar?from=&to=&pos=      bank.view        POS Ödeme Takvimi (net; blokeli ve Komisyon Tahsili ayrı)
//   POST /bank/settle                           bank.move        "Şimdi Aktar" (vadesi gelmiş gün fişleri)
//   POST /bank/pos/items/confirm                bank.reconcile   onay kipinde gerçek tarih ve net tutar
//   GET  /bank/pos/commission-invoices?month=   bank.view        KDV kipi: Faturası Beklenen Komisyonlar, taslaklar, İade Alacağı
//   POST /bank/pos/commission-invoices          bank.commission + invoices.manage  "Şimdi Oluştur" (aylık taslak)
//   GET  /bank/pos/:id · PUT                    view · pos       POS kartı (oran geçmişi); düzelt (oran hariç)
//   POST /bank/pos/:id/status                   bank.pos         Pasife Al / Etkinleştir
//   DELETE /bank/pos/:id                        bank.pos         yalnız hiç kullanılmamış POS
//   GET  /bank/pos/:id/rates · POST             view · commission  tarihli oran ızgarası (kayıt yerinde değişmez; yeni valid_from)
//   POST /bank/pos/:id/move-pending             bank.pos         "Bekleyenleri Yeni Hesaba Taşı"
import { HttpError, ok, readJson, text } from "../lib/http.mjs";
import { canUser } from "../lib/permissions.mjs";
import { parseMinor } from "../lib/minor.mjs";

const BASE = "/api/workspace/bank";

export function registerPosRoutes(router, { auth, events, pos, accounts = () => null, period, chooser = () => false }) {
  const changed = (user, extra = {}) => events?.publish("workspace.changed", { kind: "bank", pos: true, actorId: user.id, actorName: user.display_name, ...extra }, { except: user.id });
  const requestIdOf = (req, body) => text(req.headers["x-hof-request"]) || text(body?.requestId);
  const need = (user, ...keys) => {
    for (const key of keys) if (!canUser(user, key)) throw new HttpError(403, "Bu işlem için yetkiniz yok.", { code: "FORBIDDEN", permission: key });
  };

  router.get(`${BASE}/pos`, async ({ req, res, url }) => {
    auth.requirePermission(req, "bank.view");
    ok(res, { pos: pos.list({ status: text(url.searchParams.get("status")) }), stats: pos.pendingStats() });
  });
  router.post(`${BASE}/pos`, async ({ req, res }) => {
    const user = auth.requirePermission(req, "bank.pos");
    const body = await readJson(req);
    const result = pos.create(user, body, { requestId: requestIdOf(req, body) });
    changed(user);
    ok(res, result);
  });

  // ---------- Tahsilat formlarının POS alanı (İz 3.2; seçici izinleri: GET /bank/choices ile aynı) ----------
  // Önizleme: satış yazımıyla aynı hesap (oran, komisyon, net, valör günleri); hiçbir şey yazmaz. Asıl işlem: POS İadesinin önerisi.
  const choose = req => {
    const user = auth.requireUser(req);
    if (!chooser(user)) throw new HttpError(403, "Bu işlem için yetkiniz yok.", { code: "FORBIDDEN" });
    return user;
  };
  router.get(`${BASE}/pos/preview`, async ({ req, res, url }) => {
    choose(req);
    const q = url.searchParams;
    ok(res, pos.preview({ posId: text(q.get("pos")), amount: text(q.get("amount")), installments: text(q.get("installments")) || 1, date: text(q.get("date")) }));
  });
  // Düzeltme formunun POS bilgisi (satırın etkin POS kaydı: POS, taksit, provizyon, son 4 hane, asıl işlem): yalnız bu alanlar (tutar/oran dönmez).
  router.get(`${BASE}/pos/row`, async ({ req, res, url }) => {
    choose(req);
    const sale = pos.sales({ row: text(url.searchParams.get("row")), limit: 5 }).find(item => item.status === "active" && item.src !== "cancel") || null;
    ok(res, { sale: sale ? { posId: sale.posId, kind: sale.kind, installments: sale.installments, authCode: sale.authCode, cardLast4: sale.cardLast4, originId: sale.origin?.id || "", sourceless: sale.src === "sourceless" } : null });
  });
  router.get(`${BASE}/pos/origins`, async ({ req, res, url }) => {
    choose(req);
    const q = url.searchParams;
    ok(res, { sales: pos.origins({ invoiceId: text(q.get("invoice")), partyId: text(q.get("party")), planId: text(q.get("plan")), posId: text(q.get("pos")) }) });
  });

  // ---------- POS İşlemleri ----------
  router.get(`${BASE}/pos/sales`, async ({ req, res, url }) => {
    auth.requirePermission(req, "bank.view");
    const q = url.searchParams;
    ok(res, { sales: pos.sales({ posId: text(q.get("pos")), from: text(q.get("from")), to: text(q.get("to")), status: text(q.get("status")), kind: text(q.get("kind")), limit: Number(q.get("limit")) || 200, row: text(q.get("row")) }) });
  });
  router.get(`${BASE}/pos/sales/:id`, async ({ req, res, params }) => {
    auth.requirePermission(req, "bank.view");
    ok(res, pos.saleDetail(params.id));
  });
  router.post(`${BASE}/pos/sales/:id/void`, async ({ req, res, params }) => {
    const user = auth.requirePermission(req, "bank.cancel");
    const sale = pos.saleDetail(params.id);
    if (sale.kind !== "sale" || sale.status !== "active") throw new HttpError(409, "Yalnız etkin POS satışı iptal edilir.", { code: "pos-not-active" });
    if (sale.items.some(item => item.status === "settled")) throw new HttpError(409, "Bu POS tahsilatı bankaya geçti; müşteriye iade ise POS İadesi yapın.", { code: "pos-settled" });
    if (!sale.voidable) throw new HttpError(409, "Provizyon süresi geçti; iptal (void) yapılamaz. Müşteriye iade ise POS İadesi yapın.", { code: "pos-provision-expired" });
    const head = pos.voidTarget(sale.eventId);
    if (head?.table === "account_entries" && head.source === "") {
      need(user, "accounts.view");
      accounts()?.posEntry?.remove(user, head.id);
    } else if (head?.table === "account_entries" && head.source === "invoice") {
      throw new HttpError(409, "Bu POS tahsilatı bir faturanın peşini; faturayı İptal Et ile \"Müşteriye İade Edildi\" seçerek iptal edin (provizyon süresi içinde komisyonsuz iptal olur).", { code: "pos-void-invoice", invoiceId: head.sourceId });
    } else {
      throw new HttpError(409, "Bu POS tahsilatı kendi bölümünden (kayıt, taksit ya da stok) silinerek iptal edilir; silme valörden önce komisyonsuz iptaldir.", { code: "pos-void-module", table: head?.table || "" });
    }
    changed(user);
    ok(res, pos.saleDetail(params.id));
  });
  router.post(`${BASE}/pos/sales/:id/refund`, async ({ req, res, params }) => {
    const user = auth.requirePermission(req, "accounts.manage");
    const body = await readJson(req);
    const sale = pos.saleDetail(params.id);
    if (sale.kind !== "sale" || sale.status !== "active") throw new HttpError(409, "Yalnız etkin POS satışı iade edilir.", { code: "pos-not-active" });
    if (!sale.party) throw new HttpError(409, "Bu POS satışının carisi yok (kayıt tahsilatı); iadeyi ilgili bölümden girin.", { code: "pos-refund-party" });
    const amount = parseMinor(body.amount, { label: "İade Tutarı" }) / 100;
    const date = period ? period.movementDate(body) : text(body.date);
    const result = accounts()?.posEntry?.refund(user, sale.party.id, { amount, date, note: text(body.note) || `POS İadesi · ${sale.eventNo}`, posId: sale.posId, refundOf: sale.id, requestId: requestIdOf(req, body) });
    changed(user);
    ok(res, { ...(result?.replayed ? { replayed: true } : {}), sale: pos.saleDetail(params.id) });
  });

  // ---------- Takvim, kuyruk, onay ----------
  router.get(`${BASE}/pos/calendar`, async ({ req, res, url }) => {
    auth.requirePermission(req, "bank.view");
    const q = url.searchParams;
    ok(res, pos.calendarView({ from: text(q.get("from")), to: text(q.get("to")), posId: text(q.get("pos")) }));
  });
  router.post(`${BASE}/settle`, async ({ req, res }) => {
    const user = auth.requirePermission(req, "bank.move");
    const body = await readJson(req);
    const result = pos.drain({ posId: text(body?.posId) });
    if (result.settled) changed(user);
    ok(res, { ...result, stats: pos.pendingStats() });
  });
  router.post(`${BASE}/pos/items/confirm`, async ({ req, res }) => {
    const user = auth.requirePermission(req, "bank.reconcile");
    const body = await readJson(req);
    const result = pos.confirm(user, body);
    changed(user);
    ok(res, result);
  });

  // ---------- KDV kipi: komisyon faturaları ----------
  router.get(`${BASE}/pos/commission-invoices`, async ({ req, res, url }) => {
    auth.requirePermission(req, "bank.view");
    ok(res, pos.commissionInvoices({ month: text(url.searchParams.get("month")) }));
  });
  router.post(`${BASE}/pos/commission-invoices`, async ({ req, res }) => {
    const user = auth.requirePermission(req, "bank.commission");
    need(user, "invoices.manage");
    const body = await readJson(req);
    const result = pos.createCommissionDrafts(user, { month: text(body?.month), posId: text(body?.posId) });
    changed(user);
    ok(res, { ...result, ...pos.commissionInvoices({ month: result.month }) });
  });

  // ---------- POS kartı (:id) ----------
  router.get(`${BASE}/pos/:id`, async ({ req, res, params }) => {
    auth.requirePermission(req, "bank.view");
    ok(res, pos.detail(params.id));
  });
  router.put(`${BASE}/pos/:id`, async ({ req, res, params }) => {
    const user = auth.requirePermission(req, "bank.pos");
    const body = await readJson(req);
    const result = pos.update(user, params.id, body);
    changed(user);
    ok(res, result);
  });
  router.post(`${BASE}/pos/:id/status`, async ({ req, res, params }) => {
    const user = auth.requirePermission(req, "bank.pos");
    const body = await readJson(req);
    const result = pos.setStatus(user, params.id, text(body?.status));
    changed(user);
    ok(res, result);
  });
  router.delete(`${BASE}/pos/:id`, async ({ req, res, params }) => {
    const user = auth.requirePermission(req, "bank.pos");
    const result = pos.remove(user, params.id);
    changed(user);
    ok(res, result);
  });
  router.get(`${BASE}/pos/:id/rates`, async ({ req, res, params }) => {
    auth.requirePermission(req, "bank.view");
    const detail = pos.detail(params.id);
    ok(res, { current: detail.rates, history: detail.rateHistory });
  });
  router.post(`${BASE}/pos/:id/rates`, async ({ req, res, params }) => {
    const user = auth.requirePermission(req, "bank.commission");
    const body = await readJson(req);
    const result = pos.addRates(user, params.id, body);
    changed(user);
    ok(res, result);
  });
  router.post(`${BASE}/pos/:id/move-pending`, async ({ req, res, params }) => {
    const user = auth.requirePermission(req, "bank.pos");
    const body = await readJson(req);
    const result = pos.movePending(user, params.id, body);
    changed(user);
    ok(res, result);
  });
}
