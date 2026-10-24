// 2.4.4 madde 15 (UX18; kullanıcı kararı 21.10.2026, CLAUDE.md Açık iş "KARARLAR" (2)): faturadan (Tahsilat Ekle / Ödeme Yap) ya da cari formunda
// "Kapatılacak Fatura" seçilerek alınan (verilen) çek/senet BU faturayı kapatır. Bağ YALNIZ alış/veriliş olayının cheque_events.invoice_id'sinde,
// cheques.invoice_id BOŞ → fatura iptal edilince evrak portföyde kalır, bağ düşer. Taksitli faturaya, başka cariye ve ters yöne bağ yok (cari kartının
// invoiceLink kuralı). Karşılıksız dönünce bağlı fatura yeniden açılır. Yevmiye değişmez (B 101.01 / 121.01 / A 120; verilende B 320 / A 103).
// Şüpheli alacak kuralı değişmez (BİLİNEN SINIR).
//
// NASIL BOZULUR (testler bu listeden):
//   N1 kısmi çek + nakit aynı faturada (iki sıra), çek faturanın açığını aşar (fazlası en eski açık faturaya)          → T2
//   N2 evrak işlemleri: tahsil, geri al, Bankaya Tahsile Ver, ciro, karşılıksız (ciro edilmişken de), geri al           → T3, T4
//   N3 fatura iptali çekten SONRA (bağ düşer, evrak kalır) / ÖNCE (bağ kurulmaz); faturanın düzenlenmesi (cari, taksit)   → T5, T11
//   N4 aynı evrak iki faturaya (bağ değiştirme), cari değişince bağ sessizce düşmez, işlem görmüş evrakta bağ değişmez     → T9
//   N5 iade faturası, taksitli fatura, başka cari, ters yön, taslak, taksite sayılan evrak, carisiz evrak               → T6
//   N6 verilen çek ↔ alış faturası, senet (121)                                                                       → T7, T8
//   N7 sil + Silinenler'den geri yükle (fatura geçerliyse bağ döner, iptal edildiyse bağsız + neden)                     → T10
//   N8 002 şirketi + yedek → çalış → geri yükle                                                                        → T12
//   N9 eski sürüm verisi (v2.4.3 GERÇEK kodu, API'den): faturalı çek, cariden çek, bağlı nakit                          → T13
//   N10 (31a F2) bağlı evrak karşılıksız → sonraki bağsız tahsilat en eski açık faturaya (fatura kendi tarihiyle açık)  → T15
//   N11 (31a F3, kullanıcı kararı 22.10) BAĞSIZ evrak karşılıksız: kapattığı faturalar açılır; kısmi, geri al, sonraki ödeme en eskiye, ciro
//       edilmiş, iki karşılıksız (bağlı + bağsız), iade faturası, taksitli/taksite sayılan (değişmez), şüpheli alacak, tahsildeki,
//       Mevcut Borç kartı arada; 002 şirketi; v2.4.3 verisinde karşılıksız bağsız evrak (Ödendi → Açık, bakiye aynı)         → T17, T12, T13
//   N12 (r31e Y8, 31e dar kontrol 23.10) faturanın KENDİ formundan alınan çek "kendi ödemesi": yalnız o varken Düzenle → taksitli İZİNLİ (olumlu yol
//       hiçbir testte yoktu; ownPaymentLines çek olaylarını saymayan mutant M6q yaşıyordu)                                     → T11b
// Beklenen sayılar programdan bağımsız: burada girilen tutarların elle toplamı / kuralı (karar metni); veri tabanı satırları ayrıca okunur (ders 3).
import assert from "node:assert/strict";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { after, before, describe, test } from "node:test";
import { settleInvoices } from "../server/lib/invoice-settle.mjs";
import { CURRENT, bootVersion, tagsAvailable } from "./guvenilirlik/surumler.mjs";
import { ADMIN_PASSWORD } from "./helpers.mjs";
import { GARANTI_IBAN, ZIRAAT_IBAN } from "./banka-210-hesap-ortak.mjs";

const pad = value => String(value).padStart(2, "0");
const day = offset => {
  const date = new Date();
  date.setDate(date.getDate() + offset);
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
};
const must = async (label, promise) => {
  const res = await promise;
  assert.equal(res.status, 200, `${label}: ${res.status} ${JSON.stringify(res.data).slice(0, 400)}`);
  return res.data;
};
const refused = async (label, promise, status, code = "") => {
  const res = await promise;
  assert.equal(res.status, status, `${label}: ${res.status} ${JSON.stringify(res.data).slice(0, 300)}`);
  if (code) assert.equal(res.data?.code, code, `${label}: kod ${JSON.stringify(res.data).slice(0, 300)}`);
  return res.data;
};
const cents = value => Math.round(Number(value || 0) * 100);

/** Bir şirkete bağlı yardımcılar (api: oturum; db: o şirketin store'u ya da withCompanyDb sarmalı). */
function kit(api, read) {
  let n = 0;
  let cursor = -100;
  const next = () => day(cursor++);
  const one = (sql, ...args) => read(db => db.prepare(sql).get(...args));
  const many = (sql, ...args) => read(db => db.prepare(sql).all(...args));
  const helpers = {
    next,
    one,
    many,
    item: null,
    async init() {
      const tag = Math.random().toString(36).slice(2, 7);
      helpers.item = await must("ürün", api.post("/api/workspace/stock", { kind: "service", code: `UX18-${tag}`, name: `UX18 Hizmet ${tag}`, unit: "Adet", salePrice: "100" }));
    },
    account: (label, type = "customer") => must("cari", api.post("/api/workspace/accounts", { name: `UX18 ${label}`, type, phone: `0500 018 ${pad(Math.floor((n += 1) / 100))} ${pad(n % 100)}` })),
    async invoice(account, amount, { kind = "sale", payment = { rest: "open" }, date = next() } = {}) {
      const scenario = kind === "purchase" ? "expense_purchase" : "service_sale";
      const lines = kind === "purchase" ? [{ name: "UX18 Gider", qty: 1, unitPrice: amount, vatRate: 0, expenseCode: "general" }] : [{ itemId: helpers.item.id, qty: 1, unitPrice: amount, vatRate: 0 }];
      const doc = await must(`fatura ${kind} ${amount}`, api.post("/api/workspace/invoices", { kind, scenario, accountId: account.id, issueDate: date, lines, payment, ...(kind === "purchase" ? { number: `UX18-A${(n += 1)}` } : {}) }));
      return must("fatura oku", api.get(`/api/workspace/invoices/${doc.id}`));
    },
    state: async id => {
      const doc = await must("fatura", api.get(`/api/workspace/invoices/${id}`));
      return { open: doc.open, paid: doc.paid, payState: doc.payState, closers: doc.closers };
    },
    open: async id => (await helpers.state(id)).open,
    balance: async account => (await must("cari", api.get(`/api/workspace/accounts/${account.id}`))).totals.balance,
    cheque: (account, amount, extra = {}) => must(`evrak ${amount}`, api.post("/api/workspace/cheques", { direction: "in", instrument: "cheque", accountId: account?.id || "", amount, issueDate: day(0), dueDate: day(45), serialNo: `UX${(n += 1)}`, bank: "Ziraat", ...extra })),
    act: (cheque, action, extra = {}) => must(`evrak ${action}`, api.post(`/api/workspace/cheques/${cheque.id}/actions`, { action, date: day(0), method: "cash", cashForce: true, ...extra })),
    /** Veri tabanından: evrak satırı ve alış/veriliş olayının bağı. */
    row: id => one("SELECT c.invoice_id AS own, c.status, c.deleted_at AS deletedAt, c.account_id AS accountId, ev.invoice_id AS bond FROM cheques c JOIN cheque_events ev ON ev.cheque_id = c.id AND ev.kind IN ('receive', 'issue') WHERE c.id = ?", id),
    count: () => one("SELECT COUNT(*) AS n FROM cheques").n,
    integrity: async () => {
      const data = await must("Mutabakat Testi", api.get("/api/workspace/ledger/integrity"));
      assert.equal(data.ok, true, `Mutabakat Testi: ${JSON.stringify((data.checks || []).filter(check => !check.ok)).slice(0, 600)}`);
    },
    /** Yevmiye Defteri raporundan bir evrakın satırları: [hesap, borç, alacak] (kuruş). */
    journal: async serialNo => {
      const report = await must("yevmiye", api.get(`/api/workspace/report-center/yevmiye?from=${day(-400)}&to=${day(0)}`));
      const money = cell => cents(String(cell || "0").replace(/[^\d,-]/g, "").replace(",", "."));
      return report.rows.filter(row => String(row[2]).includes(`No ${serialNo}`)).map(row => [row[3], money(row[4]), money(row[5])]);
    },
    trial: async () => {
      const data = await must("ana defter", api.get("/api/workspace/ledger"));
      return Object.fromEntries(data.trial.accounts.map(row => [row.code, cents(row.balance)]));
    },
  };
  return helpers;
}

describe("2.4.4 UX18: faturadan / Kapatılacak Fatura ile alınan çek-senet bu faturayı kapatır", () => {
  const root = mkdtempSync(path.join(tmpdir(), "ux18-244-"));
  let server;
  let api;
  let k;
  before(async () => {
    server = await bootVersion(CURRENT, { dataDir: path.join(root, "data"), backupDir: path.join(root, "backups") });
    api = await server.login();
    await must("kurulum geç", api.post("/api/workspace/bank/setup/dismiss", {}));
    k = kit(api, fn => fn(server.app.store.db));
    await k.init();
  });
  after(async () => {
    await server?.close();
    rmSync(root, { recursive: true, force: true });
  });

  test("T1 bağlı çek seçilen faturayı kapatır, en eski açık faturayı değil; bağ yalnız olayda; yevmiye B 101.01 / A 120", async () => {
    const acc = await k.account("T1");
    const older = await k.invoice(acc, 1000);
    const newer = await k.invoice(acc, 800);
    const trialBefore = await k.trial();
    const cheque = await k.cheque(acc, 800, { invoiceId: newer.id });
    assert.deepEqual([await k.open(newer.id), await k.open(older.id)], [0, 1000], "seçilen (yeni) fatura kapandı; eski açık kaldı");
    assert.equal((await k.state(newer.id)).payState, "paid");
    assert.equal(await k.balance(acc), 1000, "cari bakiye 1.000 + 800 − 800");
    const row = k.row(cheque.id);
    assert.deepEqual([row.own, row.bond, row.status, row.deletedAt], ["", newer.id, "portfolio", null], "cheques.invoice_id boş; bağ alış olayında");
    assert.equal(cheque.closesInvoice?.id, newer.id, "evrak kartı Kapatılacak Fatura'yı gösterir");
    assert.deepEqual(await k.journal(cheque.serialNo), [["101.01", 80000, 0], ["120", 0, 80000]], "yevmiye bağdan bağımsız: B 101.01 / A 120");
    const trialAfter = await k.trial();
    assert.equal((trialAfter["101"] || 0) - (trialBefore["101"] || 0), 80000, "mizan 101 +800");
    assert.equal((trialAfter["120"] || 0) - (trialBefore["120"] || 0), -80000, "mizan 120 −800");
    // Bağsız çek bugünkü gibi en eski açık faturayı kapatır (FIFO; değişmedi).
    const free = await k.cheque(acc, 300);
    assert.deepEqual([await k.open(older.id), k.row(free.id).bond], [700, ""], "bağsız çek eski faturadan düştü");
    await k.integrity();
  });

  test("T2 kısmi çek + nakit aynı faturada (iki sıra); çek açığı aşınca fazlası en eski açık faturaya", async () => {
    for (const order of ["nakit-önce", "çek-önce"]) {
      const acc = await k.account(`T2 ${order}`);
      const older = await k.invoice(acc, 500);
      const target = await k.invoice(acc, 1000);
      const cash = () => must("bağlı nakit", api.post(`/api/workspace/accounts/${acc.id}/entries`, { kind: "in", amount: 300, date: day(0), method: "cash", invoiceId: target.id, cashForce: true }));
      if (order === "nakit-önce") await cash();
      await k.cheque(acc, 400, { invoiceId: target.id });
      if (order === "çek-önce") await cash();
      assert.deepEqual([await k.open(target.id), await k.open(older.id)], [300, 500], `${order}: 1.000 − 300 − 400; eski fatura açık`);
      await k.cheque(acc, 700, { invoiceId: target.id });
      assert.deepEqual([await k.open(target.id), await k.open(older.id)], [0, 100], `${order}: 700'ün 300'ü bu faturayı kapattı, 400'ü en eski faturaya`);
      assert.equal(await k.balance(acc), 100, `${order}: Σ açık = cari bakiye (1.500 − 1.400)`);
    }
    await k.integrity();
  });

  test("T3 karşılıksız dönünce bağlı fatura yeniden açılır (fazlası da geri döner); geri alınca kapanır; Σ kapatan = ödenen", async () => {
    const acc = await k.account("T3");
    const older = await k.invoice(acc, 500);
    const target = await k.invoice(acc, 500);
    const cheque = await k.cheque(acc, 1000, { invoiceId: target.id });
    assert.deepEqual([await k.open(target.id), await k.open(older.id)], [0, 0], "500 bu faturaya, 500 en eski faturaya");
    await k.act(cheque, "bounce");
    assert.deepEqual([await k.open(target.id), await k.open(older.id), await k.balance(acc)], [500, 500, 1000], "karşılıksız: iki fatura da yeniden açık, bakiye 1.000");
    const after = await k.state(target.id);
    assert.equal(cents(after.closers.reduce((sum, item) => sum + item.amount, 0)), cents(after.paid), `kapatanların toplamı ödenen kadar: ${JSON.stringify(after.closers)}`);
    // 31a F2: karşılıksız evrak faturayı ödememiştir — "Bu Faturayı Kapatanlar"da evrakın satırı yok (eksi kayıt da yok).
    const chequeLines = new Set(k.many("SELECT id FROM account_entries WHERE source = 'cheque' AND source_id = ?", cheque.id).map(row => row.id));
    assert.ok(chequeLines.size === 2 && !after.closers.some(item => chequeLines.has(item.id)), `kapatanlarda karşılıksız evrak yok: ${JSON.stringify(after.closers)}`);
    // Karşılıksızdan sonra bağlı nakit tahsilat yine bu faturayı kapatır.
    await must("bağlı nakit", api.post(`/api/workspace/accounts/${acc.id}/entries`, { kind: "in", amount: 200, date: day(0), method: "cash", invoiceId: target.id, cashForce: true }));
    assert.deepEqual([await k.open(target.id), await k.open(older.id)], [300, 500], "200 bağlı nakit bu faturaya");
    await must("karşılıksızı geri al", api.post(`/api/workspace/cheques/${cheque.id}/undo`, {}));
    assert.deepEqual([await k.open(target.id), await k.open(older.id), await k.balance(acc)], [0, 0, -200], "geri alınca iki fatura kapalı, 200 avans");
    await k.integrity();
  });

  test("T3b faturayla alınan çek (faturanın kendi evrakı) karşılıksız dönünce de fatura açılır; taksitli faturada açık = kartın kalanı (değişmedi)", async () => {
    const acc = await k.account("T3b");
    const own = await k.invoice(acc, 600, { payment: { cheques: [{ instrument: "cheque", amount: 600, dueDate: day(30), serialNo: "UX18-OWN", bank: "Z" }], rest: "open" } });
    assert.equal(await k.open(own.id), 0);
    const ownCheque = (await must("evraklar", api.get(`/api/workspace/cheques?q=UX18-OWN`))).cheques[0];
    await k.act(ownCheque, "bounce");
    assert.deepEqual([await k.open(own.id), await k.balance(acc)], [600, 600], "fatura yeniden açık");
    // Karşılıksızın eksi kapatanı, cari kartından bağlanan ödemeyi gizlemez: sonradan taksitlendirme nedenli reddedilir.
    await must("bağlı nakit", api.post(`/api/workspace/accounts/${acc.id}/entries`, { kind: "in", amount: 100, date: day(0), method: "cash", invoiceId: own.id, cashForce: true }));
    const edit = { kind: "sale", scenario: "service_sale", accountId: acc.id, issueDate: own.issueDate, lines: [{ itemId: k.item.id, qty: 1, unitPrice: 600, vatRate: 0 }], payment: { rest: "installments", installments: { count: 2, firstDue: day(20), everyMonths: 1 } } };
    await refused("taksitlendir", api.post(`/api/workspace/invoices/${own.id}/edit`, edit), 409, "invoice-paid-elsewhere");
    assert.equal(await k.open(own.id), 500);
    const planned = await k.invoice(acc, 1200, { payment: { cheques: [{ instrument: "cheque", amount: 300, dueDate: day(30), serialNo: "UX18-PLN", bank: "Z" }], rest: "installments", installments: { count: 3, firstDue: day(20), everyMonths: 1 } } });
    const plannedCheque = (await must("evraklar", api.get(`/api/workspace/cheques?q=UX18-PLN`))).cheques[0];
    const card = async () => (await must("kart", api.get(`/api/workspace/plans/${planned.planId}`))).totals.remaining;
    assert.deepEqual([await k.open(planned.id), await card()], [900, 900]);
    await k.act(plannedCheque, "bounce");
    assert.deepEqual([await k.open(planned.id), await card()], [900, 900], "taksitli fatura: açık = kartın kalanı (karşılıksız serbest borç)");
    await k.integrity();
  });

  test("T4 tahsil / geri al / Bankaya Tahsile Ver / ciro: fatura kapalı kalır; ciro edilmişken karşılıksız müşterinin faturasını açar; faturayla ciroda alış faturası da açılır", async () => {
    const acc = await k.account("T4");
    const supplier = await k.account("T4 Tedarikçi", "supplier");
    const target = await k.invoice(acc, 1000);
    const cheque = await k.cheque(acc, 1000, { invoiceId: target.id });
    await k.act(cheque, "collect");
    assert.equal(await k.open(target.id), 0, "tahsil: kapalı");
    await must("tahsili geri al", api.post(`/api/workspace/cheques/${cheque.id}/undo`, {}));
    assert.equal(await k.open(target.id), 0, "geri al: kapalı (evrak portföyde)");
    const bank = await must("banka hesabı", api.post("/api/workspace/bank/accounts", { bankName: "Ziraat Bankası", name: "UX18 TL", kind: "demand", currency: "TRY", iban: ZIRAAT_IBAN, useCheque: true, useNote: true, opening: { date: day(-150), amount: "0", confirmed: true } }));
    await k.act(cheque, "bank-deposit", { bankAccountId: bank.id, status: "portfolio" });
    assert.equal(await k.open(target.id), 0, "tahsile verildi: kapalı");
    await k.act(cheque, "bank-withdraw");
    const purchase = await k.invoice(supplier, 1000, { kind: "purchase" });
    await k.act(cheque, "endorse", { accountId: supplier.id });
    assert.deepEqual([await k.open(target.id), await k.open(purchase.id)], [0, 0], "ciro: satış kapalı, tedarikçinin alışı (en eski) ciroyla kapandı");
    await k.act(cheque, "bounce");
    assert.deepEqual([await k.open(target.id), await k.balance(acc)], [1000, 1000], "ciro edilmişken karşılıksız: müşterinin bağlı faturası açık");
    assert.equal(await k.balance(supplier), -1000, "tedarikçiye borç geri geldi");
    // Faturayla ciro (alış faturasının ödeme bölümünde portföy evrakı): o evrak karşılıksız dönünce alış faturası da açılır.
    const second = await k.cheque(acc, 400);
    const paidByEndorse = await k.invoice(supplier, 400, { kind: "purchase", date: day(0), payment: { endorse: [second.id], rest: "open" } });
    assert.equal(await k.open(paidByEndorse.id), 0);
    await k.act(second, "bounce");
    assert.equal(await k.open(paidByEndorse.id), 400, "faturayla ciro edilen evrak karşılıksız: alış faturası açık");
    await k.integrity();
  });

  test("T5 fatura iptali: evrak portföyde kalır, bağ düşer, kapama en eski faturaya döner; iptal edilmiş faturaya bağ kurulmaz", async () => {
    const acc = await k.account("T5");
    const older = await k.invoice(acc, 500);
    const target = await k.invoice(acc, 700);
    const cheque = await k.cheque(acc, 700, { invoiceId: target.id });
    assert.deepEqual([await k.open(target.id), await k.open(older.id)], [0, 500]);
    await must("iptal", api.post(`/api/workspace/invoices/${target.id}/cancel`, { reason: "UX18" }));
    const row = k.row(cheque.id);
    assert.deepEqual([row.own, row.bond, row.status, row.deletedAt], ["", "", "portfolio", null], "evrak silinmedi, portföyde; bağ düştü");
    assert.equal(k.one("SELECT COUNT(*) AS n FROM account_entries WHERE source = 'cheque' AND source_id = ?", cheque.id).n, 1, "evrakın cari satırı duruyor");
    assert.deepEqual([await k.open(older.id), await k.balance(acc)], [0, -200], "700 evrak en eski faturayı kapattı, 200 avans");
    assert.equal((await must("evrak", api.get(`/api/workspace/cheques/${cheque.id}`))).closesInvoice, null);
    const before = k.count();
    const body = await refused("iptal edilmiş faturaya", api.post("/api/workspace/cheques", { direction: "in", instrument: "cheque", accountId: acc.id, amount: 100, issueDate: day(0), dueDate: day(30), serialNo: "UX18-T5", invoiceId: target.id }), 409, "cheque-invoice");
    assert.equal(body.field, "invoiceId");
    assert.equal(k.count(), before, "evrak yazılmadı");
    await k.integrity();
  });

  test("T6 bağ kurulamayanlar: taksitli, başka cari, ters yön, iade, taslak, taksite sayılan, carisiz — hiçbir şey yazılmaz", async () => {
    const acc = await k.account("T6");
    const other = await k.account("T6 Başka");
    const sale = await k.invoice(acc, 500);
    const planned = await k.invoice(acc, 900, { payment: { rest: "installments", installments: { count: 3, firstDue: day(20), everyMonths: 1 } } });
    const foreign = await k.invoice(other, 500);
    const purchase = await k.invoice(acc, 500, { kind: "purchase" });
    const ret = await must("iade", api.post("/api/workspace/invoices", { kind: "sale_return", originalId: sale.id, issueDate: k.next(), lines: [{ originLineId: sale.lines[0].id, qty: 1 }], payment: {} }));
    const draft = await must("taslak", api.post("/api/workspace/invoices", { status: "draft", kind: "sale", scenario: "service_sale", accountId: acc.id, issueDate: day(0), lines: [{ itemId: k.item.id, qty: 1, unitPrice: 50, vatRate: 0 }] }));
    const card = await must("kart", api.post("/api/workspace/plans", { accountId: acc.id, name: "UX18 Kart", total: "300", registeredOn: day(-30), mode: "auto", count: 1, firstDue: day(10) }));
    const before = k.count();
    const base = { direction: "in", instrument: "cheque", accountId: acc.id, amount: 100, issueDate: day(0), dueDate: day(30) };
    const tries = [
      ["taksitli fatura", { ...base, invoiceId: planned.id }, 409],
      ["başka carinin faturası", { ...base, invoiceId: foreign.id }, 404],
      ["alınan evrak → alış faturası", { ...base, invoiceId: purchase.id }, 409],
      ["verilen evrak → satış faturası", { ...base, direction: "out", invoiceId: sale.id }, 409],
      ["iade faturası", { ...base, invoiceId: ret.id }, 409],
      ["taksite sayılan evrak", { ...base, planId: card.id, invoiceId: sale.id }, 400],
      ["carisiz evrak", { ...base, accountId: "", drawer: "Keşideci", invoiceId: sale.id }, 400],
      ["olmayan fatura", { ...base, invoiceId: "invoice-yok" }, 404],
      ["taslak", { ...base, invoiceId: draft.id }, 409],
    ];
    for (const [label, body, status] of tries) {
      const data = await refused(label, api.post("/api/workspace/cheques", { ...body, serialNo: `UX18-T6-${label}` }), status);
      assert.equal(data.field, "invoiceId", `${label}: hata Kapatılacak Fatura alanında`);
    }
    assert.equal(k.count(), before, "reddedilen hiçbir evrak yazılmadı");
    assert.equal(await k.open(planned.id), 900);
    await k.integrity();
  });

  test("T7 verilen çek bağlı alış faturasını kapatır (en eskiyi değil); ödenince kapalı kalır; yevmiye B 320 / A 103", async () => {
    const supplier = await k.account("T7 Tedarikçi", "supplier");
    const older = await k.invoice(supplier, 900, { kind: "purchase" });
    const target = await k.invoice(supplier, 600, { kind: "purchase" });
    const cheque = await k.cheque(supplier, 600, { direction: "out", invoiceId: target.id });
    assert.deepEqual([await k.open(target.id), await k.open(older.id)], [0, 900]);
    assert.deepEqual(k.row(cheque.id).bond, target.id);
    assert.deepEqual(await k.journal(cheque.serialNo), [["320", 60000, 0], ["103", 0, 60000]]);
    await k.act(cheque, "pay");
    assert.equal(await k.open(target.id), 0, "ödendi: kapalı");
    await k.integrity();
  });

  test("T8 senet de bağlanır: B 121.01 / A 120", async () => {
    const acc = await k.account("T8");
    await k.invoice(acc, 300);
    const target = await k.invoice(acc, 400);
    const note = await k.cheque(acc, 400, { instrument: "note", invoiceId: target.id });
    assert.equal(await k.open(target.id), 0);
    assert.deepEqual(await k.journal(note.serialNo), [["121.01", 40000, 0], ["120", 0, 40000]]);
    await k.integrity();
  });

  test("T9 bağ değiştirme / kaldırma; cari değişince bağ sessizce düşmez; işlem görmüş evrakta bağ değişmez", async () => {
    const acc = await k.account("T9");
    const other = await k.account("T9 Başka");
    const first = await k.invoice(acc, 300);
    const second = await k.invoice(acc, 300);
    const cheque = await k.cheque(acc, 300, { invoiceId: second.id });
    assert.deepEqual([await k.open(first.id), await k.open(second.id)], [300, 0]);
    const moved = await must("bağı değiştir", api.put(`/api/workspace/cheques/${cheque.id}`, { invoiceId: first.id, updatedAt: cheque.updatedAt }));
    assert.deepEqual([await k.open(first.id), await k.open(second.id), k.row(cheque.id).bond], [0, 300, first.id], "aynı evrak artık ilk faturayı kapatır (iki faturaya birden değil)");
    const cleared = await must("bağı kaldır", api.put(`/api/workspace/cheques/${cheque.id}`, { invoiceId: "", updatedAt: moved.updatedAt }));
    assert.deepEqual([k.row(cheque.id).bond, await k.open(first.id), await k.open(second.id)], ["", 0, 300], "Otomatik: en eski fatura");
    const relinked = await must("yeniden bağla", api.put(`/api/workspace/cheques/${cheque.id}`, { invoiceId: second.id, updatedAt: cleared.updatedAt }));
    const data = await refused("cari değişti, bağ kaldı", api.put(`/api/workspace/cheques/${cheque.id}`, { accountId: other.id, updatedAt: relinked.updatedAt }), 404);
    assert.equal(data.field, "invoiceId");
    assert.deepEqual([k.row(cheque.id).accountId, k.row(cheque.id).bond], [acc.id, second.id], "reddedildi; hiçbir şey değişmedi");
    await k.act(cheque, "collect");
    await refused("tahsil edilmiş evrakta bağ değişmez", api.put(`/api/workspace/cheques/${cheque.id}`, { invoiceId: first.id }), 409, "cheque-invoice");
    assert.equal(k.row(cheque.id).bond, second.id);
    await k.integrity();
  });

  test("T10 evrak silinince fatura açılır; Silinenler'den dönünce bağ korunur; fatura bu arada taksitlendirildiyse ya da iptal edildiyse bağsız döner", async () => {
    const acc = await k.account("T10");
    const target = await k.invoice(acc, 500);
    const cheque = await k.cheque(acc, 500, { invoiceId: target.id });
    await must("evrak sil", api.del(`/api/workspace/cheques/${cheque.id}`));
    assert.equal(await k.open(target.id), 500, "silinen evrak faturayı kapatmaz");
    const trashId = async () => (await must("silinenler", api.get("/api/admin/trash"))).find(item => item.id === `cheque:${cheque.id}`)?.id;
    await must("geri yükle", api.post("/api/admin/trash/restore", { id: await trashId() }));
    assert.deepEqual([await k.open(target.id), k.row(cheque.id).bond], [0, target.id], "bağ korundu");
    // Evrak silindikten sonra fatura taksitlendirilir (silinen evrak engel değil); geri gelen evrak taksitli faturaya bağlanmaz, nedeni söylenir.
    await must("yine sil", api.del(`/api/workspace/cheques/${cheque.id}`));
    const body = { kind: "sale", scenario: "service_sale", accountId: acc.id, issueDate: target.issueDate, lines: [{ itemId: k.item.id, qty: 1, unitPrice: 500, vatRate: 0 }] };
    await must("taksitlendir", api.post(`/api/workspace/invoices/${target.id}/edit`, { ...body, payment: { rest: "installments", installments: { count: 2, firstDue: day(20), everyMonths: 1 } } }));
    const restored = await must("geri yükle", api.post("/api/admin/trash/restore", { id: await trashId() }));
    assert.match(JSON.stringify(restored), /taksitli olduğu \(kendi taksit kartıyla kapandığı\) için faturaya bağlanmadı/);
    assert.deepEqual([k.row(cheque.id).bond, k.row(cheque.id).deletedAt], ["", null]);
    assert.equal(await k.open(target.id), 500, "taksitli fatura kartıyla kapanır; evrak bağsız (en eski borç)");
    // Fatura iptali silinmiş evrakın bağını da düşürür: geri gelen evrak bağsızdır.
    const other = await k.invoice(acc, 300);
    const second = await k.cheque(acc, 300, { invoiceId: other.id });
    await must("evrak sil", api.del(`/api/workspace/cheques/${second.id}`));
    await must("faturayı iptal", api.post(`/api/workspace/invoices/${other.id}/cancel`, { reason: "UX18" }));
    assert.equal(k.row(second.id).bond, "", "iptal silinmiş evrakın bağını da düşürdü");
    await must("geri yükle", api.post("/api/admin/trash/restore", { id: (await must("silinenler", api.get("/api/admin/trash"))).find(item => item.id === `cheque:${second.id}`)?.id }));
    assert.deepEqual([k.row(second.id).bond, k.row(second.id).deletedAt], ["", null]);
    await k.integrity();
  });

  test("T11 bağlı evraklı fatura sonradan taksitlendirilemez ve carisi değiştirilemez (nedenli)", async () => {
    const acc = await k.account("T11");
    const other = await k.account("T11 Başka");
    const target = await k.invoice(acc, 1000);
    await k.cheque(acc, 400, { invoiceId: target.id });
    const body = { kind: "sale", scenario: "service_sale", accountId: acc.id, issueDate: target.issueDate, lines: [{ itemId: k.item.id, qty: 1, unitPrice: 1000, vatRate: 0 }] };
    await refused("taksitlendir", api.post(`/api/workspace/invoices/${target.id}/edit`, { ...body, payment: { rest: "installments", installments: { count: 2, firstDue: day(20), everyMonths: 1 } } }), 409, "invoice-paid-elsewhere");
    await refused("cari değiştir", api.post(`/api/workspace/invoices/${target.id}/edit`, { ...body, accountId: other.id, payment: { rest: "open" } }), 400, "invoice-bonded");
    assert.equal(await k.open(target.id), 600);
    await k.integrity();
  });

  test("T11b yalnız faturanın kendi formundan alınan çek varken Düzenle → taksitli izinli: kalan 200 TL karta, çek tek ve faturanın; Mutabakat Testi temiz", async () => {
    const acc = await k.account("T11b");
    const cheques = [{ instrument: "cheque", amount: 400, dueDate: day(30), serialNo: "UX18-T11B", bank: "Ziraat" }];
    const target = await k.invoice(acc, 600, { payment: { cheques, rest: "open" } });
    assert.equal(await k.open(target.id), 200, "ön koşul: 600 − kendi çeki 400");
    const body = { kind: "sale", scenario: "service_sale", accountId: acc.id, issueDate: target.issueDate, lines: [{ itemId: k.item.id, qty: 1, unitPrice: 600, vatRate: 0 }] };
    const edited = await must("taksitlendir", api.post(`/api/workspace/invoices/${target.id}/edit`, { ...body, payment: { cheques, rest: "installments", installments: { count: 2, firstDue: day(20), everyMonths: 1 } } }));
    assert.equal(edited.id, target.id);
    const plan = k.one("SELECT id, total FROM plans WHERE invoice_id = ? AND deleted_at IS NULL", target.id);
    assert.ok(plan, "fatura taksit kartına bağlandı");
    assert.equal(cents(plan.total), 20000, "kart yalnız kalanı taşır: 600 − 400 = 200");
    const own = k.many("SELECT c.id, c.amount, c.invoice_id AS own FROM cheques c WHERE c.account_id = ? AND c.deleted_at IS NULL", acc.id);
    assert.deepEqual(own.map(row => [cents(row.amount), row.own]), [[40000, target.id]], "çek tek, faturanın kendi evrakı (form yeniden yazdı, ikinci çek açılmadı)");
    await k.integrity();
  });

  test("T14 Mutabakat Testi bozuk evrak bağını yakalar (başka carinin / taksitli / iptal faturası, taksite sayılan evrak)", async () => {
    const acc = await k.account("T14");
    const other = await k.account("T14 Başka");
    const target = await k.invoice(acc, 500);
    const foreign = await k.invoice(other, 500);
    const planned = await k.invoice(acc, 600, { payment: { rest: "installments", installments: { count: 2, firstDue: day(20), everyMonths: 1 } } });
    const cheque = await k.cheque(acc, 500, { invoiceId: target.id });
    const event = k.one("SELECT id FROM cheque_events WHERE cheque_id = ? AND kind = 'receive'", cheque.id).id;
    // Program bu bağları kurmaz (T6); eski / elle bozulmuş veri benzetimi: doğrudan veri dosyasına (uygulama katmanı atlanır).
    const raw = (sql, ...args) => server.app.store.db.prepare(sql).run(...args);
    for (const [label, bond] of [["başka carinin faturası", foreign.id], ["taksitli fatura", planned.id], ["olmayan fatura", "invoice-yok"]]) {
      raw("UPDATE cheque_events SET invoice_id = ? WHERE id = ?", bond, event);
      const data = await must("Mutabakat Testi", api.get("/api/workspace/ledger/integrity"));
      const check = (data.checks || []).find(item => item.code === "invoice:offset");
      assert.ok(data.ok === false && check?.ok === false && JSON.stringify(check.sample).includes(`evrak bağı ${event}`), `${label}: ${JSON.stringify(check)}`);
      // Kapama bozuk bağı yok sayar: taksitli fatura kendi kartıyla kapanır, evrak en eski açık faturaya (cari kartı bağının kuralı, v2.0.23).
      if (bond === planned.id) assert.deepEqual([await k.open(planned.id), await k.open(target.id)], [600, 0], "taksitli faturaya bağ yok sayıldı");
    }
    raw("UPDATE cheque_events SET invoice_id = ? WHERE id = ?", target.id, event);
    await k.integrity();
  });

  // 31a bağımsız kâhin F2 (b2-ux18-sira; PLAN §8.10 "Otomatik (En Eski)" + kullanıcı kararı 21.10.2026): karşılıksız dönen bağlı evrak hiç alınmamış
  // gibidir — fatura KENDİ tarihiyle yeniden açılır; sonra gelen bağsız tahsilat en eski açık faturayı kapatır (önceden karşılıksız satırı karşılıksız
  // gününe yazılıyor, bağsız tahsilat daha yeni faturayı kapatıyordu).
  test("T15 karşılıksızdan sonra bağsız tahsilat en eski açık faturayı kapatır (fatura kendi tarihiyle açılır); Mevcut Borç kartı arada açıldıysa kapsamı değişmez", async () => {
    const acc = await k.account("T15");
    const f1 = await k.invoice(acc, 1000);
    const f2 = await k.invoice(acc, 1000);
    const e1 = await k.cheque(acc, 1000, { invoiceId: f1.id });
    assert.deepEqual([await k.open(f1.id), await k.open(f2.id)], [0, 1000]);
    await k.act(e1, "bounce");
    assert.deepEqual([await k.open(f1.id), await k.open(f2.id), await k.balance(acc)], [1000, 1000, 2000], "karşılıksız: F1 yeniden açık");
    await must("bağsız nakit", api.post(`/api/workspace/accounts/${acc.id}/entries`, { kind: "in", amount: 1000, date: day(0), method: "cash", cashForce: true }));
    assert.deepEqual([await k.open(f1.id), await k.open(f2.id), await k.balance(acc)], [0, 1000, 1000], "bağsız 1.000 en eski açık F1'i kapattı, F2 açık");
    // Fazlası başka faturaya giden bağlı evrak: karşılıksızdan sonra bağsız tahsilat yine en eski faturadan başlar.
    const acc2 = await k.account("T15 Fazla");
    const w = await k.invoice(acc2, 500);
    const x = await k.invoice(acc2, 500);
    const e2 = await k.cheque(acc2, 1000, { invoiceId: x.id });
    await k.act(e2, "bounce");
    await must("bağsız nakit", api.post(`/api/workspace/accounts/${acc2.id}/entries`, { kind: "in", amount: 600, date: day(0), method: "cash", cashForce: true }));
    assert.deepEqual([await k.open(w.id), await k.open(x.id), await k.balance(acc2)], [0, 400, 400], "600: önce en eski W (500), sonra X (100)");
    // Mevcut Borç kartı evrak portföydeyken açıldı (o an açık olan eski fatura G kapsandı); karşılıksız sonrası kapsam aynı kalır, bağsız tahsilat bağlı faturayı kapatır.
    const acc3 = await k.account("T15 Kart");
    const g = await k.invoice(acc3, 1000);
    const h = await k.invoice(acc3, 1000);
    const e3 = await k.cheque(acc3, 1000, { invoiceId: h.id });
    await must("Mevcut Borç kartı", api.post("/api/workspace/plans", { name: "UX18 T15 Kart", registeredOn: day(0), total: "1000", accountId: acc3.id, mode: "auto", count: "2", firstDue: day(30), coversBalance: true }));
    await k.act(e3, "bounce");
    await must("bağsız nakit", api.post(`/api/workspace/accounts/${acc3.id}/entries`, { kind: "in", amount: 1000, date: day(0), method: "cash", cashForce: true }));
    assert.deepEqual([await k.open(g.id), await k.open(h.id)], [1000, 0], "kart G'yi kapsar (kartın taksitleriyle kapanır); bağsız 1.000 karşılıksızla açılan H'yi kapattı");
    await k.integrity();
  });

  // 31a bağımsız kâhin F6 (b2-ux18-karsiliksiz "bdm"): faturayla kaydedilen evrağın bağı faturanın kendisidir (iptalde evrak geri alınır); PUT invoiceId ile
  // "kaldırma" isteği önceden 200 dönüp hiçbir şey yapmıyordu (reddedilen istek başarı değildir, ters yönü: kabul edilip yapılmayan istek).
  test("T16 faturayla kaydedilen evrakın bağı kaldırılamaz / değiştirilemez (409, hiçbir şey yazılmaz); aynı değer serbest", async () => {
    const acc = await k.account("T16");
    const other = await k.invoice(acc, 300);
    const own = await k.invoice(acc, 450, { payment: { cheques: [{ instrument: "cheque", amount: 450, dueDate: day(30), serialNo: "UX18-T16", bank: "Z" }], rest: "open" } });
    const cheque = (await must("evraklar", api.get("/api/workspace/cheques?q=UX18-T16"))).cheques[0];
    const card = await must("evrak", api.get(`/api/workspace/cheques/${cheque.id}`));
    for (const [label, invoiceId] of [["kaldır", ""], ["başka faturaya", other.id]]) {
      const data = await refused(label, api.put(`/api/workspace/cheques/${cheque.id}`, { invoiceId, updatedAt: card.updatedAt }), 409, "invoice-linked");
      assert.equal(data.field, "invoiceId");
      assert.deepEqual([k.row(cheque.id).own, k.row(cheque.id).bond], [own.id, own.id], `${label}: bağ değişmedi`);
    }
    await must("aynı değer (no değişikliği)", api.put(`/api/workspace/cheques/${cheque.id}`, { invoiceId: own.id, serialNo: "UX18-T16b", updatedAt: card.updatedAt }));
    assert.deepEqual([await k.open(own.id), await k.open(other.id)], [0, 300]);
    await k.integrity();
  });

  // 31a bağımsız kâhin F3 + kullanıcı kararı 22.10.2026 ("en yaygın uygulama"; QuickBooks "Record bounced check", Xero, Sage: ödeme geri alınır, fatura
  // ödenmemiş olur): BAĞSIZ alınan evrak karşılıksız dönünce kapattığı faturalar da yeniden açılır, kalan ödemeler en eski açık faturadan yeniden dağılır.
  // Değişmez: Σ açık fatura = cari bakiye (faturasız borç yoksa); bakiye DEĞİŞMEZ; taksitli fatura (kendi kartı) ve taksite sayılan evrak aynen.
  // Beklenen sayılar karar metninden elle (FIFO: en eski açık fatura önce).
  test("T17 bağsız evrak karşılıksız dönünce kapattığı faturalar açılır (kısmi, geri al, sonraki ödeme en eskiye, ciro, iki karşılıksız, iade, taksitli, şüpheli, tahsildeki, Mevcut Borç kartı)", async () => {
    const opens = async list => Promise.all(list.map(item => k.open(item.id)));
    // (a) kısmi: 1.500'lük evrak G1'i ve G2'nin 500'ünü kapattı; karşılıksız → ikisi de açık; geri al → eski hâl; yeniden karşılıksız; bağsız nakit en eskiye.
    const a = await k.account("T17 Kısmi");
    const g = [await k.invoice(a, 1000), await k.invoice(a, 1000)];
    const ea = await k.cheque(a, 1500);
    assert.deepEqual(await opens(g), [0, 500], "bağsız 1.500: G1 + G2'nin 500'ü");
    await k.act(ea, "bounce");
    assert.deepEqual([...(await opens(g)), await k.balance(a)], [1000, 1000, 2000], "karşılıksız: G1 ve G2 açık, Σ açık = bakiye 2.000");
    await must("karşılıksızı geri al", api.post(`/api/workspace/cheques/${ea.id}/undo`, {}));
    assert.deepEqual([...(await opens(g)), await k.balance(a)], [0, 500, 500], "geri al: evrak yine G1 + G2'nin 500'ünü kapatır");
    await k.act(ea, "bounce");
    await must("bağsız nakit", api.post(`/api/workspace/accounts/${a.id}/entries`, { kind: "in", amount: 1000, date: day(0), method: "cash", cashForce: true }));
    assert.deepEqual([...(await opens(g)), await k.balance(a)], [0, 1000, 1000], "bağsız 1.000 en eski G1'i kapattı");
    const g1 = await k.state(g[0].id);
    const chequeLines = new Set(k.many("SELECT id FROM account_entries WHERE source = 'cheque' AND source_id = ?", ea.id).map(row => row.id));
    assert.ok(!g1.closers.some(item => chequeLines.has(item.id)) && cents(g1.closers.reduce((sum, item) => sum + item.amount, 0)) === cents(g1.paid), `G1 kapatanlarında karşılıksız evrak yok: ${JSON.stringify(g1.closers)}`);
    // (b) evrak H1'i, nakit H2'yi kapattı; evrak karşılıksız → nakit en eski H1'e yeniden dağılır, H2 açık.
    const b = await k.account("T17 Dağılım");
    const h = [await k.invoice(b, 1000), await k.invoice(b, 1000)];
    const eb = await k.cheque(b, 1000);
    await must("bağsız nakit", api.post(`/api/workspace/accounts/${b.id}/entries`, { kind: "in", amount: 1000, date: day(0), method: "cash", cashForce: true }));
    assert.deepEqual(await opens(h), [0, 0]);
    await k.act(eb, "bounce");
    assert.deepEqual([...(await opens(h)), await k.balance(b)], [0, 1000, 1000], "nakit H1'e, H2 açık; bakiye 1.000");
    // (c) bağsız evrak ciro edildi (tedarikçinin alışı FIFO ile kapandı); karşılıksız → müşterinin satışı ve tedarikçinin alışı açık.
    const c = await k.account("T17 Ciro");
    const supplier = await k.account("T17 Ciro Tedarikçi", "supplier");
    const sale = await k.invoice(c, 1000);
    const purchase = await k.invoice(supplier, 1000, { kind: "purchase" });
    const ec = await k.cheque(c, 1000);
    await k.act(ec, "endorse", { accountId: supplier.id });
    assert.deepEqual([await k.open(sale.id), await k.open(purchase.id)], [0, 0], "evrak satışı, ciro alışı kapattı");
    await k.act(ec, "bounce");
    assert.deepEqual([await k.open(sale.id), await k.open(purchase.id), await k.balance(c), await k.balance(supplier)], [1000, 1000, 1000, -1000], "ciro edilmişken karşılıksız: iki fatura da açık");
    // (d) iki karşılıksız (biri bağlı L3'e, biri bağsız → L1); nakit L2'yi kapatmıştı → ikisinden sonra nakit L1'e, L2 ve L3 açık.
    const d = await k.account("T17 İki");
    const l = [await k.invoice(d, 600), await k.invoice(d, 600), await k.invoice(d, 600)];
    const bonded = await k.cheque(d, 600, { invoiceId: l[2].id });
    const free = await k.cheque(d, 600);
    await must("bağsız nakit", api.post(`/api/workspace/accounts/${d.id}/entries`, { kind: "in", amount: 600, date: day(0), method: "cash", cashForce: true }));
    assert.deepEqual(await opens(l), [0, 0, 0]);
    await k.act(bonded, "bounce");
    assert.deepEqual(await opens(l), [0, 0, 600], "bağlı karşılıksız: L3 açık");
    await k.act(free, "bounce");
    assert.deepEqual([...(await opens(l)), await k.balance(d)], [0, 600, 600, 1200], "bağsız karşılıksız: nakit L1'e, L2 ve L3 açık; Σ = bakiye 1.200");
    // (e) iade faturası (300) asıl faturanın bir kısmını, bağsız evrak (700) kalanını kapattı; karşılıksız → açık 700 = bakiye.
    const e = await k.account("T17 İade");
    const m = await k.invoice(e, 1000);
    await must("iade", api.post("/api/workspace/invoices", { kind: "sale_return", originalId: m.id, issueDate: k.next(), lines: [{ originLineId: m.lines[0].id, qty: 0.3 }], payment: {} }));
    const ee = await k.cheque(e, 700);
    assert.equal(await k.open(m.id), 0);
    await k.act(ee, "bounce");
    assert.deepEqual([await k.open(m.id), await k.balance(e)], [700, 700], "iade 300 kalır, evrakın 700'ü açılır");
    // (f) taksitli fatura DEĞİŞMEZ: bağsız evrak onu kapatmaz (avans), karşılıksızda da açık = kartın kalanı; taksite sayılan evrak kartı açar.
    const f = await k.account("T17 Taksitli");
    const planned = await k.invoice(f, 1200, { payment: { rest: "installments", installments: { count: 3, firstDue: day(20), everyMonths: 1 } } });
    const remaining = async () => (await must("kart", api.get(`/api/workspace/plans/${planned.planId}`))).totals.remaining;
    const ef = await k.cheque(f, 500);
    assert.deepEqual([await k.open(planned.id), await remaining(), await k.balance(f)], [1200, 1200, 700], "bağsız evrak taksitli faturayı kapatmaz");
    await k.act(ef, "bounce");
    assert.deepEqual([await k.open(planned.id), await remaining(), await k.balance(f)], [1200, 1200, 1200]);
    const counted = await k.cheque(f, 400, { planId: planned.planId });
    assert.deepEqual([await k.open(planned.id), await remaining()], [800, 800], "taksite sayılan evrak");
    await k.act(counted, "bounce");
    assert.deepEqual([await k.open(planned.id), await remaining()], [1200, 1200], "taksite sayılan evrak karşılıksız: kart ve fatura aynı");
    // (g) şüpheli alacağa alınan karşılıksız evrak: fatura açık kalır (şüpheli alacak kuralı değişmez; cari bakiye aynı).
    const s = await k.account("T17 Şüpheli");
    const q = await k.invoice(s, 1000);
    const es = await k.cheque(s, 1000);
    await k.act(es, "bounce");
    assert.equal(await k.open(q.id), 1000);
    await must("şüpheli alacağa al", api.post(`/api/workspace/accounts/${s.id}/doubtful`, { chequeId: es.id, date: day(0) }));
    assert.deepEqual([await k.open(q.id), await k.balance(s)], [1000, 1000], "şüpheli alacakta fatura açık");
    // (h) Bankaya Tahsile Verilmiş evrak bankadan karşılıksız döner: fatura açılır.
    const t = await k.account("T17 Tahsilde");
    const v = await k.invoice(t, 1000);
    const et = await k.cheque(t, 1000);
    const bank = await must("banka hesabı", api.post("/api/workspace/bank/accounts", { bankName: "Garanti BBVA", name: "UX18 T17 TL", kind: "demand", currency: "TRY", iban: GARANTI_IBAN, useCheque: true, useNote: true, opening: { date: day(-150), amount: "0", confirmed: true } }));
    await k.act(et, "bank-deposit", { bankAccountId: bank.id, status: "portfolio" });
    assert.equal(await k.open(v.id), 0, "tahsilde: kapalı");
    await k.act(et, "bounce");
    assert.deepEqual([await k.open(v.id), await k.balance(t)], [1000, 1000], "tahsilden karşılıksız: açık");
    // (i) Mevcut Borç kartı evrak portföydeyken açıldı (o an açık olan Y'yi kapsadı); karşılıksız → X açılır, kart kapsamı aynı; bağsız nakit X'i kapatır.
    const u = await k.account("T17 Kart");
    const x = await k.invoice(u, 1000);
    const y = await k.invoice(u, 1000);
    const eu = await k.cheque(u, 1000);
    await must("Mevcut Borç kartı", api.post("/api/workspace/plans", { name: "UX18 T17 Kart", registeredOn: day(0), total: "1000", accountId: u.id, mode: "auto", count: "2", firstDue: day(30), coversBalance: true }));
    await k.act(eu, "bounce");
    assert.deepEqual([await k.open(x.id), await k.open(y.id), await k.balance(u)], [1000, 1000, 2000], "karşılıksız: X açık; Y kartın kapsamında");
    await must("bağsız nakit", api.post(`/api/workspace/accounts/${u.id}/entries`, { kind: "in", amount: 1000, date: day(0), method: "cash", cashForce: true }));
    assert.deepEqual([await k.open(x.id), await k.open(y.id)], [0, 1000], "bağsız 1.000 X'i kapattı; Y kartın taksitleriyle kapanır");
    await k.integrity();
  });
});

describe("2.4.4 UX18: 002 şirketinde aynı kural; yedek → çalış → geri yükle", () => {
  const root = mkdtempSync(path.join(tmpdir(), "ux18-244-002-"));
  let server;
  after(async () => {
    await server?.close();
    rmSync(root, { recursive: true, force: true });
  });
  test("T12 002'de bağlı çek; yedekten sonraki bağlı evrak geri yüklemeyle gider; sayılar yedekteki gibi", async () => {
    server = await bootVersion(CURRENT, { dataDir: path.join(root, "data"), backupDir: path.join(root, "backups") });
    const api = await server.login();
    await must("kurulum geç", api.post("/api/workspace/bank/setup/dismiss", {}));
    const second = (await must("002", api.post("/api/companies", { code: "002", name: "UX18 İkinci", select: true }))).company;
    await must("kurulum geç 002", api.post("/api/workspace/bank/setup/dismiss", {}));
    const k = kit(api, fn => server.app.context.withCompanyDb(server.app.companies.get(second.id), fn));
    await k.init();
    const acc = await k.account("002");
    const older = await k.invoice(acc, 1000);
    const target = await k.invoice(acc, 600);
    const cheque = await k.cheque(acc, 600, { invoiceId: target.id });
    assert.deepEqual([await k.open(target.id), await k.open(older.id), k.row(cheque.id).bond], [0, 1000, target.id], "002: seçilen fatura kapandı");
    assert.equal(server.app.store.get("SELECT COUNT(*) AS n FROM cheques").n, 0, "001'e hiçbir evrak yazılmadı");
    const backup = await must("yedek", api.post("/api/admin/backups", { scope: "one", companyId: second.id }));
    const name = backup.backups.find(item => item.code === "002").name;
    await k.cheque(acc, 1000, { invoiceId: older.id });
    assert.equal(await k.open(older.id), 0);
    await must("geri yükle", api.post("/api/admin/backups/restore", { name, company: second.id, confirm: "002", password: ADMIN_PASSWORD }));
    assert.deepEqual([await k.open(target.id), await k.open(older.id), await k.balance(acc)], [0, 1000, 1000], "yedekteki durum");
    assert.equal(k.count(), 1, "yedekten sonraki evrak geri yüklemeyle gitti");
    // Geri yüklemeden sonra yeniden çalış.
    await k.cheque(acc, 400, { invoiceId: older.id });
    assert.deepEqual([await k.open(older.id), await k.balance(acc)], [600, 600]);
    // 31a F3 (kullanıcı kararı 22.10): 002'de bağsız evrak karşılıksız dönünce kapattığı fatura açılır.
    const free = await k.cheque(acc, 600);
    assert.deepEqual([await k.open(older.id), await k.balance(acc)], [0, 0], "002: bağsız evrak en eski açık faturayı kapattı");
    await k.act(free, "bounce");
    assert.deepEqual([await k.open(older.id), await k.balance(acc)], [600, 600], "002: karşılıksız → fatura yeniden açık");
    await k.integrity();
  });
});

// Arayüzden kurulamayan (bozuk / eski) veride karşılıksız çifti: yalnız tarafı ters (karşılıksız borç ↔ alış alacak, karşılıksız alacak ↔ ciro borç) ve
// tutarı aynı çift kapamadan çıkar; öbürleri bugünkü gibi kalır (evrak alındığı cariye ciro edilemez — üç yolda da reddedilir; tutar değişikliği olay
// görmüş evrakta yok). Beklenen: kural metninden elle.
describe("2.4.4 UX18: karşılıksız çiftinin korumaları (kapama çekirdeği, birim)", () => {
  const line = (id, origin, date, debit, credit, extra = {}) => ({ id, origin, kind: extra.kind || (debit ? "debt" : "credit"), date, at: `${date}T10:00:00Z`, debit, credit, ...extra });
  const run = (lines, invoices, chequeEvents, reversals) => settleInvoices({ lines, invoices, chequeEvents: new Map(chequeEvents), reversals: new Map(reversals), today: "2026-06-30" });
  test("T18 tutarı farklı ya da tarafı aynı çift çıkarılmaz; doğru çift çıkarılır", () => {
    const sale = [{ id: "F1", kind: "sale", status: "issued", payable: 1000 }];
    const receive = line("R", "cheque", "2026-06-02", 0, 1000);
    const invoiceLine = line("I1", "invoice", "2026-06-01", 1000, 0, { sourceId: "F1" });
    assert.equal(run([invoiceLine, receive, line("B", "cheque", "2026-06-03", 1000, 0)], sale, [["R", "receive"], ["B", "bounce"]], [["B", "R"]]).get("F1").open, 1000, "doğru çift: fatura açık");
    assert.equal(run([invoiceLine, receive, line("B", "cheque", "2026-06-03", 900, 0)], sale, [["R", "receive"], ["B", "bounce"]], [["B", "R"]]).get("F1").open, 0, "tutarı farklı: çıkarılmaz, evrak faturayı kapatır");
    // Tarafı aynı: karşılıksız BORÇ satırı ciro (borç) satırını ters çeviremez — ciro alış faturasını kapatmış kalır.
    const purchase = [{ id: "P1", kind: "purchase", status: "issued", payable: 1000 }];
    const lines = [line("I2", "invoice", "2026-06-01", 0, 1000, { sourceId: "P1" }), line("E", "cheque", "2026-06-02", 1000, 0), line("B2", "cheque", "2026-06-03", 1000, 0)];
    assert.equal(run(lines, purchase, [["E", "endorse"], ["B2", "bounce"]], [["B2", "E"]]).get("P1").open, 0, "tarafı aynı: çıkarılmaz");
    assert.equal(run([lines[0], lines[1], line("B2", "cheque", "2026-06-03", 0, 1000)], purchase, [["E", "endorse"], ["B2", "bounce"]], [["B2", "E"]]).get("P1").open, 1000, "ciro edilen caride karşılıksız alacak satırı ciroyu ters çevirir: alış açık");
  });
});

const OLD = "v2.4.3";
describe(`2.4.4 UX18: ${OLD} gerçek koduyla üretilmiş veri`, { skip: !tagsAvailable([OLD]) && `${OLD} etiketi yok (git fetch --tags)` }, () => {
  const root = mkdtempSync(path.join(tmpdir(), "ux18-244-eski-"));
  const dirs = { dataDir: path.join(root, "data"), backupDir: path.join(root, "backups") };
  const ids = {};
  let oldView = null;
  let oldF3 = null;
  const view = async (api, k) => ({
    states: await Promise.all([ids.older, ids.own, ids.linked, ids.cash].map(async id => { const s = await k.state(id); return [s.open, s.paid, s.payState]; })),
    balance: await k.balance({ id: ids.acc }),
  });
  before(async () => {
    const old = await bootVersion(OLD, dirs);
    try {
      const api = await old.login();
      await must("kurulum geç", api.post("/api/workspace/bank/setup/dismiss", {}));
      const k = kit(api, fn => fn(old.app.store.db));
      await k.init();
      const acc = await k.account("Eski");
      ids.acc = acc.id;
      ids.older = (await k.invoice(acc, 700)).id;
      ids.own = (await k.invoice(acc, 500, { payment: { cheques: [{ instrument: "cheque", amount: 500, dueDate: day(30), serialNo: "UX18-ESKI-1", bank: "Z" }], rest: "open" } })).id;
      ids.linked = (await k.invoice(acc, 400)).id;
      ids.cash = (await k.invoice(acc, 300)).id;
      // 2.4.3: carinin "+ Tahsilat → Çek / Senet" yolu Kapatılacak Fatura'yı taşımıyordu (FIFO); nakit bağlı.
      await k.cheque(acc, 200, { serialNo: "UX18-ESKI-2" });
      await must("bağlı nakit", api.post(`/api/workspace/accounts/${acc.id}/entries`, { kind: "in", amount: 300, date: day(0), method: "cash", invoiceId: ids.cash, cashForce: true }));
      oldView = await view(api, k);
      // 31a F3: v2.4.3'te bağsız alınıp karşılıksız dönen evrak (kapattığı faturalar 2.4.3'te kapalı kalıyordu).
      const b = await k.account("Eski Karşılıksız");
      ids.bounced = b.id;
      ids.f3 = [(await k.invoice(b, 1000)).id, (await k.invoice(b, 1000)).id];
      await k.act(await k.cheque(b, 1500, { serialNo: "UX18-ESKI-K" }), "bounce");
      oldF3 = { opens: await Promise.all(ids.f3.map(id => k.open(id))), balance: await k.balance(b) };
    } finally {
      await old.close();
    }
  });
  after(() => rmSync(root, { recursive: true, force: true }));
  test("T13 yeni kod eski veriyi aynı okur; eski veride yeni bağ çalışır; Mutabakat Testi temiz", async () => {
    // Elle kâhin (2.4.3 kuralı): 200'lük bağsız çek en eski faturadan (700 → 500); faturalı çek kendi faturasını, bağlı nakit kendi faturasını kapatır.
    assert.deepEqual(oldView.states.map(item => item[0]), [500, 0, 400, 0], `${OLD}: açıklar`);
    assert.equal(oldView.balance, 900, `${OLD}: bakiye 1.900 − 1.000`);
    const server = await bootVersion(CURRENT, dirs);
    try {
      const api = await server.login();
      const k = kit(api, fn => fn(server.app.store.db));
      assert.deepEqual(await view(api, k), oldView, "yeni kodda açıklar, durumlar ve bakiye aynı");
      // 31a F3 (kullanıcı kararı 22.10, sürüm notu): eski veride karşılıksız bağsız evrakın kapattığı faturalar artık açık; bakiye aynı (göç yok).
      assert.deepEqual(oldF3, { opens: [0, 500], balance: 2000 }, `${OLD}: karşılıksız bağsız evrak G1'i ve G2'nin 500'ünü kapalı bırakıyordu`);
      assert.deepEqual({ opens: await Promise.all(ids.f3.map(id => k.open(id))), balance: await k.balance({ id: ids.bounced }) }, { opens: [1000, 1000], balance: 2000 }, "yeni kodda iki fatura açık, bakiye aynı");
      await k.integrity();
      await k.init();
      const cheque = await k.cheque({ id: ids.acc }, 400, { invoiceId: ids.linked, serialNo: "UX18-ESKI-3" });
      assert.deepEqual([await k.open(ids.linked), await k.open(ids.older)], [0, 500], "eski veride yeni bağ: seçilen fatura kapandı");
      assert.equal(k.row(cheque.id).bond, ids.linked);
      await k.integrity();
    } finally {
      await server.close();
    }
  });
});
