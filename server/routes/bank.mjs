// Banka uçları (v2.1.0 Aşama 3; docs/BANKA-MODULU-PLAN.md §8.1 "API", §9.1 yetkiler). Hizmet: lib/bank/accounts.mjs.
//
// Özel yollar ":id"li yollardan önce kaydedilir. Yazan her uç bank.post'tan geçer ve "x-hof-request" (istek kimliği) alır; GET uçları
// hiçbir koşulda yazmaz. Yanıt { ok, data }; hata Türkçe cümle ve code taşır.
//   GET  /bank/summary                       bank.view       K10 adları, Gerçek Banka, Hesabı Atanmamış, kart ve kredi borcu; setup.dismissed
//                                                            (bu kişi Kurulum Sihirbazı'nı bu şirkette kapattı mı)
//   GET  /bank/badge?count=1                 bank.view       menü rozeti: Hesabı Belirsiz Yeni Hareketler sayısı (yalnız okuma, ucuz)
//   POST /bank/setup/dismiss                 bank.view       Kurulum Sihirbazı'nı kapat (kişi ve şirket bazında; para yazmaz)
//   GET  /bank/choices?date=                 (seçici izinleri) form seçicileri; v2.2.0: bakiye yalnız bank.view'e (Nakit Kasa cash.view'e), canDefine
//   GET  /bank/balances?date=                bank.view | cash.view  seçicilerin o tarihteki bakiyeleri (tarih değişince)
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
import { createReportHeader } from "../lib/report-header.mjs";
import { reportFileBase, reportPdf, reportXlsx } from "../lib/report-files.mjs";
import { footerRow } from "./report-center.mjs";
import { canUser } from "../lib/permissions.mjs";
import { createBankAccounts } from "../lib/bank/accounts.mjs";
import { createBankMovements } from "../lib/bank/movements.mjs";
import { TRANSFER_TYPES, createBankVouchers } from "../lib/bank/vouchers.mjs";
import { GROUP_LABELS } from "../lib/bank/event-types.mjs";
import { CHART } from "../lib/general-ledger.mjs";
import { createModuleBank } from "../lib/bank/module-ref.mjs";
import { createPos } from "../lib/bank/pos.mjs";
import { registerPosRoutes } from "./bank-pos.mjs";
import { NEGATIVE_KEY, readNegativePolicy } from "../lib/pay-method.mjs";

const BASE = "/api/workspace/bank";
/** Seçiciyi görebilenler (§8.1): banka formu olan her modülün yazma yetkisi ya da banka görüntüleme. */
const CHOICE_PERMISSIONS = ["bank.view", "accounts.collect", "plans.collect", "payments.create", "invoices.manage", "stock.sell", "stock.manage", "cheques.manage", "cash.manage"];

export function registerBankRoutes(router, context) {
  const { store, auth, audit, events, bank, period, money } = context;
  const service = createBankAccounts({ store, bank, period, money, ledger: () => context.ledger, now: context.now, fxEnabled: () => context.config?.fxEnabled === true, laterOk: () => context.config?.bankLater === true });
  const movements = createBankMovements({ store, money, accounts: service, ledger: () => context.ledger, period, now: context.now, pos: () => service.pos });
  const vouchers = createBankVouchers({ store, bank, period, money, accounts: service, movements, invoices: () => context.invoices, parties: () => context.accounts, audit, now: context.now });
  // Yargıç B2: Bu Hesaba Ata, Kurulum Sihirbazı ve Geri Al K7'yi Banka Fişi'nin eksi bakiye denetimiyle yapar.
  service.useNegative(vouchers.negative);
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
  // v2.2.0 (İz 2.7): seçicideki bakiye yalnız Banka Görüntüleme yetkisine (bank.view) gider; Nakit Kasa bakiyesi Kasa Görüntüleme'ye (cash.view).
  // Yetkisi olmayana alan hiç dönmez (ekran da göstermez). canDefine: "… Tanımla" düğmesi (Banka Hesabı Tanımlama yetkisi; yoksa ekran
  // "… tanımlı değil, yöneticinize başvurun" yazar — sunucu yine 403 verir).
  const balancesFor = (user, date) => {
    const out = {};
    if (canUser(user, "bank.view")) out.balances = service.selectorBalances({ date });
    if (canUser(user, "cash.view") && money?.wayBalance) {
      const at = /^\d{4}-\d{2}-\d{2}$/.test(String(date || "")) ? new Date(`${date}T00:00:00Z`) : null;
      const real = Boolean(at) && !Number.isNaN(at.getTime()) && at.toISOString().slice(0, 10) === date;
      const day = out.balances?.date || (real ? date : period.today());
      const way = money.wayBalance("cash", day);
      const policy = readNegativePolicy(store.setting(NEGATIVE_KEY, "")).cash;
      out.cash = { date: day, atMinor: Math.round(way.at * 100), totalMinor: Math.round(way.all * 100), policy };
    }
    return out;
  };
  router.get(`${BASE}/choices`, async ({ req, res, url }) => {
    const user = auth.requireUser(req);
    if (!CHOICE_PERMISSIONS.some(permission => canUser(user, permission))) throw new HttpError(403, "Bu işlem için yetkiniz yok.", { code: "FORBIDDEN" });
    ok(res, { ...service.choices(), canDefine: canUser(user, "bank.accounts"), ...balancesFor(user, text(url.searchParams.get("date"))) });
  });
  // Tarih değişince yalnız bakiyeler (seçici yeniden kurulmaz): bank.view ya da cash.view.
  router.get(`${BASE}/balances`, async ({ req, res, url }) => {
    const user = auth.requireUser(req);
    if (!canUser(user, "bank.view") && !canUser(user, "cash.view")) throw new HttpError(403, "Bakiyeleri görmek için Banka Görüntüleme yetkisi gerekir.", { code: "FORBIDDEN" });
    ok(res, balancesFor(user, text(url.searchParams.get("date"))));
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
    // Yargıç B2: Geri Al'ın eksi bakiye sorusu (409 cash-negative) "Yine de Kaydet" ile negativeOk / cashForce taşır.
    const body = await readJson(req);
    const result = service.undo(user, params.id, body);
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
  // 2.3.0 İz 5.1 (müşteri isteği): Hareketler sekmesinin PDF / Excel düğmeleri — ekrandaki süzgeçlerle (hesap, tür, yön, durum, POS, tarih, tutar,
  // arama) aynı liste (movements.list; veri ikinci kez hesaplanmaz, sayfalar imleçle birleştirilir), alt TOPLAM, Rapor Merkezi'nin üreticisi
  // (lib/report-files.mjs). Yetki: bank.view — kullanıcı yalnız ekranda gördüğü satırları indirir (aynı süzgeç, aynı yetki).
  const EXPORT_ROWS = 20_000;
  function movementsTable(params) {
    const query = new URLSearchParams(params);
    query.delete("cursor");
    query.delete("limit");
    query.delete("planned");
    query.set("limit", "200");
    const rows = [];
    let cursor = "";
    let page = movements.list(query);
    const balance = page.balance;
    const account = page.account;
    for (;;) {
      rows.push(...page.rows);
      if (!page.hasMore || !page.nextCursor || rows.length >= EXPORT_ROWS) break;
      cursor = page.nextCursor;
      query.set("cursor", cursor);
      page = movements.list(query);
    }
    const accountLabel = account ? service.rowOf(account) : null;
    const name = accountLabel ? `${accountLabel.bank_name} · ${accountLabel.name}` : "Tüm Hesaplar";
    const cents = minor => `${new Intl.NumberFormat("tr-TR", { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format((Number(minor) || 0) / 100)} TL`;
    const dayOf = iso => (iso ? `${iso.slice(8, 10)}.${iso.slice(5, 7)}.${iso.slice(0, 4)}` : "");
    const filters = [];
    const get = key => text(query.get(key) || "");
    if (get("type")) filters.push(`Tür: ${GROUP_LABELS[get("type")] || get("type")}`);
    if (get("dir")) filters.push(get("dir") === "in" ? "Giriş" : "Çıkış");
    if (get("status")) filters.push(`Durum: ${{ active: "Etkin", reversed: "Ters Kaydedildi", cancelled: "İptal Edildi", all: "Tümü" }[get("status")] || get("status")}`);
    if (get("pos")) filters.push(`POS: ${service.pos?.list?.().find(item => item.id === get("pos"))?.name || get("pos")}`);
    if (get("from") || get("to")) filters.push(`${get("from") ? dayOf(get("from")) : "…"} – ${get("to") ? dayOf(get("to")) : "…"}`);
    if (get("min") || get("max")) filters.push(`Tutar ${get("min") || "…"} – ${get("max") || "…"}`);
    if (get("q")) filters.push(`Arama: ${get("q")}`);
    const totals = { in: 0, out: 0 };
    const body = rows.map(row => {
      const amount = Number(row.signedMinor) || 0;
      if (row.status === "active") totals[amount >= 0 ? "in" : "out"] += Math.abs(amount);
      const desc = [row.partyName, row.counterAccountLabel ? `Karşı Hesap ${row.counterAccountLabel}` : "", row.description, row.reference ? `Ref. ${row.reference}` : "", row.invoiceNo ? `Fatura ${row.invoiceNo}` : ""].filter(Boolean).join(" · ");
      return [dayOf(row.date), row.no || "", row.typeLabel || "", row.accountLabel || "", desc, amount >= 0 ? cents(amount) : "", amount < 0 ? cents(-amount) : "", balance && row.balanceAfterMinor !== null ? cents(row.balanceAfterMinor) : "", row.statusLabel || "", row.createdByName || ""];
    });
    const data = {
      id: "banka-hareketler",
      title: "Banka Hareketleri",
      subtitle: [name, ...filters, rows.length >= EXPORT_ROWS ? `ilk ${EXPORT_ROWS.toLocaleString("tr-TR")} satır` : ""].filter(Boolean).join(" · "),
      headers: ["Tarih", "İşlem No", "Tür", "Hesap", "Açıklama", "Giriş", "Çıkış", "Bakiye", "Durum", "Giren"],
      types: ["", "", "", "", "", "money", "money", "money", "", ""],
      rows: body,
      summary: [["Hesap", name], ["Hareket", String(rows.length)], ["Giriş (Etkin)", cents(totals.in)], ["Çıkış (Etkin)", cents(totals.out)], ["Net", cents(totals.in - totals.out)]],
      total: rows.length,
      query: Object.fromEntries(query.entries()),
    };
    data.footer = footerRow(data);
    return data;
  }
  // 2.4.5 madde 6c: etiket ve Tabela Adı başlığı tek yardımcıda (lib/report-header.mjs; önceden üç rotada aynı kopya).
  const header = createReportHeader({ store, company: () => (typeof context.company === "function" ? context.company() : null) });
  const companyLabel = header.companyLabel;
  const fileCtx = user => ({ now: context.now(), companyLabel: companyLabel(), userName: user.display_name || user.username || "", brand: store.setting("office.name", "") || "DestekOfis", header });
  router.get(`${BASE}/movements.pdf`, async ({ req, res, url }) => {
    const user = auth.requirePermission(req, "bank.view");
    const data = movementsTable(url.searchParams);
    audit(user, "report.exported", data.id, { format: "pdf", rows: data.total, ...data.query });
    sendBuffer(res, reportPdf(data, fileCtx(user)), { type: "application/pdf", name: `${reportFileBase(data.title, period.today())}.pdf`, inline: url.searchParams.get("download") !== "1" });
  });
  router.get(`${BASE}/movements.xlsx`, async ({ req, res, url }) => {
    const user = auth.requirePermission(req, "bank.view");
    const data = movementsTable(url.searchParams);
    audit(user, "report.exported", data.id, { format: "xlsx", rows: data.total, ...data.query });
    sendBuffer(res, reportXlsx(data, fileCtx(user)), { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet", name: `${reportFileBase(data.title, period.today())}.xlsx` });
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

  // POS (2.2.0, Aşama 10–11; lib/bank/pos.mjs): POS kartı ve oranlar, bank.post'un POS kancası (satış, iade, valör takvimi), valör kuyruğu,
  // KDV kipi komisyon taslağı; özetin POS Bekleyen'i ve seçicinin POS listesi; İşlem Kartı'nın POS bölümü.
  const pos = createPos({ store, bank, money, period, settings: service.settings, audit, now: context.now, log: context.log, invoices: () => context.invoices, notify: extra => events?.publish("workspace.changed", { kind: "bank", ...extra }) });
  bank.usePos(pos);
  service.usePos(pos);
  service.pos = pos;
  registerPosRoutes(router, { auth, events, pos, accounts: () => context.accounts, period, chooser: user => CHOICE_PERMISSIONS.some(permission => canUser(user, permission)) });
  // Modül formlarının hesap seçimi ve K7'si (Aşama 5–6; cari, Kasa ↔ Banka): modül rotaları istek anında context.bankAccounts.module'e ulaşır.
  service.module = createModuleBank({ store, accounts: service, negative: vouchers.negative, legacy: () => context.config?.bankPickLegacy === true, pos: () => pos });
  service.module.pos = pos;
  // Rapor Merkezi'nin Banka grubu (Aşama 14): Banka Masraf Raporu bu uçla aynı kaynaktan (movements.feeReport) okur.
  service.movements = movements;
  // 2.3.0 İz 3.3 (plan §8.9, §8.10; eşleme 301): planlı işlemler Nakit Akış / Banka Nakit Akış Raporu (flows), Vade Takip (flows) ve Zil'e (dueItems)
  // bu okuma yollarıyla girer (routes/overview.mjs, routes/dues.mjs, routes/report-center.mjs); fingerprint zilin önbellek anahtarına.
  service.plans = { flows: vouchers.planFlows, dueItems: vouchers.planDueItems, fingerprint: vouchers.plansFingerprint, cardDues: vouchers.cardDueFlows };
  // 2.4.3 MM3: Vergi Ödemesi (bankadan) — routes/tax.mjs bu yolla Banka Fişi "tax_payment" yazar (K7 ve Ters Kaydet Banka Fişi'nin kuralıyla).
  service.taxPayment = vouchers.taxPayment;
  return service;
}
