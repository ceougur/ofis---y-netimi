// 2.5.0 Ç5-K tur 2 — Kasa açılış denetiminin İZLERİ (dar kontrol 10.11; docs/erp/C5K-KASA-TASARIM.md §10):
//   DÜŞÜK-1 (BAŞ MİMAR 10.11, sakınca süzgeci: tetiklenirse yanlış para → bu turda kapatılır): "bu işlemde eklenip düzeltilen satırın eklendiği hâli önceki hâl sayılmaz"
//     kuralı "son COMMIT'teki en büyük rowid" sezgisiydi; başka bağlantı yazınca (data_version) bilinmez sayılıp KABUL yönünde kapanıyordu (p12: RED → dış yazımdan sonra
//     KABUL → RED). Artık işlem kapsamı (lib/db.mjs scope.inserted / scope.born) eklenen satırları kesin tutar → dış yazım sonucu değiştirmez (RED / RED / RED).
//     Bugünkü 19 API yolunda davranış DEĞİŞMEDİ (açılıştan önce 409, aynı gün 200 — dış yazım yokken de, başka bağlantı yazdıktan hemen sonra da; dar kontrol p1b / p1c).
//   DÜŞÜK-3 (yaşayan mutantlar): K5 — açılış SİLİNİNCE önbellek düşer; K6 — olaysız (eski sürüm biçimli) açılış öncesi tahsilatın Taksite Aktar'la taşınması önceki hâl (d)
//     ile eşlenir (yeni hareket sayılmaz); K8 — açılış önbelleğinin damgası: başka bağlantı ve store dışı yazım açılışı değiştirince önbellek bayatlamaz; 002 şirketi +
//     yedekten geri yükleme sonrası da kural geri gelen açılışla işler.
// Sahte saat (ders 13); iki TZ'de koşulur; lisans servisi yok (ders 30). Veri programın API'sinden; K6'nın ön koşulu (olaysız + açılış öncesi satır) bugünkü hiçbir ürün yolundan
// kurulamaz (olay 2.1.0'dan, Kasa açılışı 2.2.0'dan; ilk hareketten sonraya açılış 409; Silinenler'den dönen olaysız satır yeni olay alır) → satır 2.0.26 biçiminde
// doğrudan yazılır, program açılış taramasıyla benimser (integrity.start; senaryo-226 İ8 deseni) ve geri kalan her adım ürün yolundan.
import assert from "node:assert/strict";
import { DatabaseSync } from "node:sqlite";
import { after, before, describe, it } from "node:test";
import { ADMIN_PASSWORD, loginAdmin, startTestServer } from "./helpers.mjs";

process.env.HUKUK_LICENSE_URL ||= "http://127.0.0.1:9";
const NOW = "2026-03-20T12:00:00";
const OPEN = "2026-03-10";
const BEFORE = "2026-03-09";
const AFTER = "2026-03-11";
const EARLY = "2026-03-05";

const unwrap = r => ({ status: r.status, data: r.data && typeof r.data === "object" && r.data.ok === true ? r.data.data : r.data, code: r.data?.code, error: r.data?.error });
const apiOf = client => ({
  client,
  get: async url => unwrap(await client.get(url)),
  post: async (url, body) => unwrap(await client.post(url, body)),
  put: async (url, body) => unwrap(await client.put(url, body)),
  del: async url => unwrap(await client.del(url)),
});
const must = async (label, promise) => {
  const res = await promise;
  assert.equal(res.status, 200, `${label}: ${res.status} ${res.code || ""} ${JSON.stringify(res.data).slice(0, 400)}`);
  return res.data;
};
const refused = async (label, promise, openingDate = OPEN) => {
  const res = await promise;
  assert.equal(res.status, 409, `${label}: beklenen 409 cash-before-opening, gelen ${res.status} ${res.code || ""} ${JSON.stringify(res.data).slice(0, 300)}`);
  assert.equal(res.code, "cash-before-opening", `${label}: kod ${res.code} — ${String(res.error || "").slice(0, 200)}`);
  if (openingDate) assert.equal(res.data?.openingDate, openingDate, `${label}: kuralın açılış tarihi`);
  return res;
};
const idOf = data => data?.id || data?.account?.id || data?.item?.id || data?.plan?.id || data?.cheque?.id || data?.invoice?.id || data?.entry?.id || "";
const FORCE = { cashForce: true, similarOk: true, force: true, exceedOk: true };
const TABLES = ["payments", "cash_entries", "account_entries", "plan_entries", "stock_moves", "cheque_events", "fin_events", "invoices", "cheques"];
const snapshot = store => JSON.stringify(TABLES.map(table => store.get(`SELECT COUNT(*) AS n, COALESCE(SUM(rowid), 0) AS r FROM ${table}`)));
const cashBalance = async api => (await must("Kasa", api.get("/api/workspace/cash"))).totals.balance;
const kasaGiris = (api, date, q = "") => api.post(`/api/workspace/cash${q}`, { kind: "in", amount: "10", date, description: `giriş ${date}`, method: "cash", ...FORCE });
/** Aynı dosyaya BAŞKA bağlantıdan yazım (data_version değişir) — ikinci süreç / ayrı bağlantı benzetimi. */
function otherConnection(store, sql, ...args) {
  const file = store.get("PRAGMA database_list").file;
  const other = new DatabaseSync(file);
  try {
    other.exec("PRAGMA busy_timeout = 5000");
    other.prepare(sql).run(...args);
  } finally {
    other.close();
  }
}

async function setup(api) {
  await api.post("/api/workspace/bank/setup/dismiss", {});
  const bank = await must("banka hesabı", api.post("/api/workspace/bank/accounts", { bankName: "Ziraat Bankası", name: "Vadesiz", kind: "demand", currency: "TRY", opening: { date: "2026-01-01", amount: "500.000", confirmed: true } }));
  const bankId = idOf(bank);
  await must("banka ayarı", api.put(`/api/workspace/bank/accounts/${bankId}`, { usePos: true, useCheque: true, useNote: true, negativePolicy: "off" }));
  const customer = idOf(await must("müşteri", api.post("/api/workspace/accounts", { name: "Ayşe Nakit", type: "customer", registeredOn: "2026-01-01", similarOk: true, force: true })));
  const supplier = idOf(await must("tedarikçi", api.post("/api/workspace/accounts", { name: "Tedarik Nakit", type: "supplier", registeredOn: "2026-01-01", similarOk: true, force: true })));
  const item = idOf(await must("ürün", api.post("/api/workspace/stock", { name: "Kalem", unit: "Adet", kind: "product", code: "K-1", unitPrice: "10,00", vatRate: "20" })));
  const plan = idOf(await must("taksit kartı", api.post("/api/workspace/plans", { accountId: customer, name: "Ayşe Kartı", total: "10.000,00", registeredOn: "2026-01-02", mode: "auto", count: 2, firstDue: "2026-04-01" })));
  const saleId = idOf(await must("satış faturası", api.post("/api/workspace/invoices", { kind: "sale", accountId: customer, issueDate: "2026-03-01", lines: [{ name: "Hizmet", qty: 10, unitPrice: "100,00", vatRate: 20 }], payment: { cash: [], rest: "open" }, force: true })));
  const saleLine = (await must("fatura kartı", api.get(`/api/workspace/invoices/${saleId}`))).lines[0].id;
  const purchase = idOf(await must("alış faturası", api.post("/api/workspace/invoices", { kind: "purchase", accountId: supplier, number: "A-1", issueDate: "2026-03-01", scenario: "expense_purchase", lines: [{ name: "Gider", qty: 1, unitPrice: "50,00", vatRate: 20, expenseCode: "other" }], payment: { cash: [], rest: "open" }, force: true })));
  return { bankId, customer, supplier, item, plan, saleId, saleLine, purchase };
}
let serial = 0;
const chequeIn = async (api, ctx) => idOf(await must("alınan çek", api.post("/api/workspace/cheques", { direction: "in", instrument: "cheque", amount: "300", accountId: ctx.customer, issueDate: "2026-03-01", dueDate: "2026-03-01", serialNo: `CI-${++serial}`, bank: "Akbank", drawer: "Ayşe Nakit" })));
const chequeOut = async (api, ctx) => idOf(await must("verilen çek", api.post("/api/workspace/cheques", { direction: "out", instrument: "cheque", amount: "200", accountId: ctx.supplier, issueDate: "2026-03-01", dueDate: "2026-03-01", serialNo: `CO-${++serial}`, bank: "Ziraat", drawer: "Biz", bankAccountId: ctx.bankId })));
// 100'e yazan bugünkü 19 API yolu (dar kontrol p1b / p1c listesi; tasarım §1).
const PATHS = [
  ["1 Kasa Giriş", (api, ctx, date) => api.post("/api/workspace/cash", { kind: "in", amount: "100", date, description: "Kasaya giriş", method: "cash", ...FORCE })],
  ["1b Kasa Çıkış", (api, ctx, date) => api.post("/api/workspace/cash", { kind: "out", amount: "10", date, description: "Kırtasiye", method: "cash", ...FORCE })],
  ["2 Bankadan Kasaya", (api, ctx, date) => api.post("/api/workspace/cash/transfer", { direction: "to-cash", amount: "50", date, bankAccountId: ctx.bankId, ...FORCE })],
  ["2b Kasadan Bankaya", (api, ctx, date) => api.post("/api/workspace/cash/transfer", { direction: "to-bank", amount: "5", date, bankAccountId: ctx.bankId, ...FORCE })],
  ["3 Vergi Ödemesi", (api, ctx, date) => api.post("/api/workspace/tax/payments", { way: "cash", date, taxType: "kdv", amount: "7", description: "KDV", ...FORCE })],
  ["4 cari nakit tahsilat", (api, ctx, date) => api.post(`/api/workspace/accounts/${ctx.customer}/entries`, { kind: "in", amount: "40", date, method: "cash", note: "nakit", ...FORCE })],
  ["4k cari nakit tahsilat + Kapatılacak Fatura", (api, ctx, date) => api.post(`/api/workspace/accounts/${ctx.customer}/entries`, { kind: "in", amount: "40", date, method: "cash", note: "nakit", invoiceId: ctx.saleId, ...FORCE })],
  ["4b cari nakit ödeme", (api, ctx, date) => api.post(`/api/workspace/accounts/${ctx.supplier}/entries`, { kind: "out", amount: "4", date, method: "cash", note: "nakit", ...FORCE })],
  ["4bk cari nakit ödeme + Kapatılacak Fatura", (api, ctx, date) => api.post(`/api/workspace/accounts/${ctx.supplier}/entries`, { kind: "out", amount: "4", date, method: "cash", note: "nakit", invoiceId: ctx.purchase, ...FORCE })],
  ["5 satış faturası peşin nakit", (api, ctx, date) => api.post("/api/workspace/invoices", { kind: "sale", accountId: ctx.customer, issueDate: date, lines: [{ name: "Hizmet", qty: 1, unitPrice: "100,00", vatRate: 20 }], payment: { cash: [{ amount: "120,00", method: "cash", lineKey: "p1" }], rest: "open" }, ...FORCE })],
  ["5a alış faturası peşin nakit", (api, ctx, date) => api.post("/api/workspace/invoices", { kind: "purchase", accountId: ctx.supplier, number: `A-${++serial + 10}`, issueDate: date, scenario: "expense_purchase", lines: [{ name: "Gider", qty: 1, unitPrice: "50,00", vatRate: 20, expenseCode: "other" }], payment: { cash: [{ amount: "60,00", method: "cash", lineKey: "p1" }], rest: "open" }, ...FORCE })],
  ["5b satıştan iade nakit para iadesi", (api, ctx, date) => api.post("/api/workspace/invoices", { kind: "sale_return", originalId: ctx.saleId, issueDate: date, lines: [{ originLineId: ctx.saleLine, qty: 1 }], payment: { cash: [{ amount: "120,00", method: "cash", lineKey: "r1" }] }, ...FORCE })],
  ["6 taksit tahsilatı nakit", (api, ctx, date) => api.post(`/api/workspace/plans/${ctx.plan}/entries`, { kind: "in", amount: "25", date, method: "cash", ...FORCE })],
  ["6b taksit iadesi nakit", (api, ctx, date) => api.post(`/api/workspace/plans/${ctx.plan}/entries`, { kind: "out", amount: "5", date, method: "cash", ...FORCE })],
  ["7 kayıt tahsilatı", (api, ctx, date) => api.post("/api/workspace/cases/DOSYA-NAKIT/payments", { amount: "15", date, method: "cash", caseTitle: "Dosya Nakit" })],
  ["9 çekin Kasa'dan tahsili", async (api, ctx, date) => api.post(`/api/workspace/cheques/${await chequeIn(api, ctx)}/actions`, { action: "collect", date, method: "cash", ...FORCE })],
  ["9b verilen çekin nakit ödemesi", async (api, ctx, date) => api.post(`/api/workspace/cheques/${await chequeOut(api, ctx)}/actions`, { action: "pay", date, method: "cash", ...FORCE })],
  ["10 nakit stok alımı", (api, ctx, date) => api.post(`/api/workspace/stock/${ctx.item}/moves`, { kind: "in", qty: "1", unitPrice: "10,00", pay: "cash", method: "cash", date, note: "nakit alım", ...FORCE })],
  ["10b nakit stok satışı", (api, ctx, date) => api.post(`/api/workspace/stock/${ctx.item}/moves`, { kind: "out", qty: "1", unitPrice: "12,00", pay: "cash", method: "cash", date, note: "nakit satış", ...FORCE })],
];

describe("Ç5-K tur 2 DÜŞÜK-1 — aynı işlemde eklenip düzeltilen açılış öncesi nakit satırı: dış yazımdan sonra da YENİ hareket (RED / RED / RED; store düzeyi, dar kontrol p12)", () => {
  let server;
  before(async () => {
    server = await startTestServer({ now: { time: NOW, fixed: true }, moneyStrict: false, gateVerify: false });
    const api = apiOf(await loginAdmin(server));
    await api.post("/api/workspace/bank/setup/dismiss", {});
    await must("Kasa açılışı", api.post("/api/workspace/cash/opening", { amount: "5.000", date: OPEN }));
  });
  after(() => server?.close());

  it("1) dış yazım yok → 409; 2) başka bağlantı ayar yazdıktan sonra → 409 (önceden KABUL); 3) hemen ardından → 409; 4) store dışı yazımdan sonra → 409; açılıştan önce tarihli satır yazılmadı", () => {
    const store = server.app.store;
    const addAndFix = id => {
      try {
        store.tx(() => {
          store.run("INSERT INTO cash_entries (id, kind, amount, date, description, method, created_by, created_at) VALUES (?, 'in', 5, ?, 'eklenip düzeltilen', 'cash', 'test', ?)", id, BEFORE, NOW);
          store.run("UPDATE cash_entries SET description = 'düzeltildi' WHERE id = ?", id);
        });
        return "KABUL";
      } catch (error) {
        return `RED ${error?.extra?.code || error?.code || String(error?.message).slice(0, 60)}`;
      }
    };
    const seen = [addAndFix("iz-1")];
    otherConnection(store, "INSERT INTO settings (key, value, updated_at) VALUES ('d2t3.dis', '1', ?) ON CONFLICT(key) DO UPDATE SET value = value || '1'", new Date().toISOString());
    seen.push(addAndFix("iz-2"), addAndFix("iz-3"));
    server.app.db.prepare("INSERT INTO settings (key, value, updated_at) VALUES ('d2t3.ham', '1', ?) ON CONFLICT(key) DO UPDATE SET value = value || '1'").run(new Date().toISOString());
    seen.push(addAndFix("iz-4"));
    assert.deepEqual(seen, ["RED cash-before-opening", "RED cash-before-opening", "RED cash-before-opening", "RED cash-before-opening"]);
    assert.equal(store.get("SELECT COUNT(*) AS n FROM cash_entries WHERE date < ? AND is_opening = 0", OPEN).n, 0, "açılıştan önce tarihli satır yazılmadı");
  });

  it("işlem kapsamı: eklenen satırın iki kez düzeltilmesinde ilk yakalanan hâl 'eklendiği hâl' (born); işlemden önce var olan satırın önceki hâli born DEĞİL (lib/db.mjs sözleşmesi)", () => {
    const store = server.app.store;
    store.run("INSERT INTO cash_entries (id, kind, amount, date, description, method, created_by, created_at) VALUES ('iz-var', 'in', 5, ?, 'önceden var', 'cash', 'test', ?)", AFTER, NOW);
    const seen = {};
    const remove = store.addCommitGuard({
      check({ scope }) {
        const rowidOf = id => store.get("SELECT rowid AS r FROM cash_entries WHERE id = ?", id)?.r;
        const born = scope?.born?.get("cash_entries") || new Set();
        const inserted = scope?.inserted?.get("cash_entries") || new Set();
        seen.yeni = { born: born.has(rowidOf("iz-yeni")), inserted: inserted.has(rowidOf("iz-yeni")) };
        seen.var = { born: born.has(rowidOf("iz-var")), inserted: inserted.has(rowidOf("iz-var")), before: Boolean(scope?.before?.get("cash_entries")?.has(rowidOf("iz-var"))) };
      },
    });
    try {
      store.tx(() => {
        store.run("UPDATE cash_entries SET description = 'düzeltildi' WHERE id = 'iz-var'");
        store.run("INSERT INTO cash_entries (id, kind, amount, date, description, method, created_by, created_at) VALUES ('iz-yeni', 'in', 5, ?, 'yeni', 'cash', 'test', ?)", AFTER, NOW);
        store.run("UPDATE cash_entries SET description = 'bir' WHERE id = 'iz-yeni'");
        store.run("UPDATE cash_entries SET description = 'iki' WHERE id = 'iz-yeni'");
      });
    } finally {
      remove();
    }
    assert.deepEqual(seen, { yeni: { born: true, inserted: true }, var: { born: false, inserted: false, before: true } });
  });
});

describe("Ç5-K tur 2 DÜŞÜK-1 — bugünkü 19 API yolunda davranış değişmedi: açılıştan bir gün önce 409 (dış yazım yokken de, başka bağlantı yazdıktan hemen sonra da), aynı gün 200", () => {
  let server;
  let api;
  let ctx;
  before(async () => {
    server = await startTestServer({ now: { time: NOW, fixed: true } });
    api = apiOf(await loginAdmin(server));
    ctx = await setup(api);
    await must("Kasa açılışı", api.post("/api/workspace/cash/opening", { amount: "100.000", date: OPEN }));
    // 6b'nin ön koşulu: iade edilecek tahsilat (açılıştan sonra; yoksa iade 400 refund-exceeds ile Kasa kuralından önce düşer).
    await must("taksit tahsilatı (açılıştan sonra)", api.post(`/api/workspace/plans/${ctx.plan}/entries`, { kind: "in", amount: "100", date: AFTER, method: "cash", ...FORCE }));
  });
  after(() => server?.close());

  for (const external of [false, true]) {
    it(`açılıştan bir gün önce (${BEFORE}), ${external ? "her istekten hemen önce BAŞKA BAĞLANTI yazdı" : "dış yazım yok"}: 19 yolun hepsi 409 cash-before-opening; hiçbir şey yazılmadı, Kasa aynı`, async () => {
      const kasa = await cashBalance(api);
      const results = [];
      for (const [name, run] of PATHS) {
        const prior = snapshot(server.app.store);
        if (external) otherConnection(server.app.store, "INSERT INTO settings (key, value, updated_at) VALUES ('d2t3.dis', '1', ?) ON CONFLICT(key) DO UPDATE SET value = value || '1'", new Date().toISOString());
        const res = await run(api, ctx, BEFORE);
        results.push(`${name}: ${res.status} ${res.code || ""}`.trim());
        // Ön koşul satırları (çek) ayrı istekte yazılır; yolun kendi isteği hiçbir şey yazmamalı (ders 3).
        if (!name.startsWith("9")) assert.equal(snapshot(server.app.store), prior, `${name}: ret yarım yazım bırakmadı`);
      }
      assert.deepEqual(results, PATHS.map(([name]) => `${name}: 409 cash-before-opening`));
      assert.equal(await cashBalance(api), kasa, "Kasa aynı");
    });
  }

  it(`açılış günü (${OPEN}), her istekten önce başka bağlantı yazdı: 19 yolun hepsi 200`, async () => {
    const results = [];
    for (const [name, run] of PATHS) {
      otherConnection(server.app.store, "INSERT INTO settings (key, value, updated_at) VALUES ('d2t3.dis', '1', ?) ON CONFLICT(key) DO UPDATE SET value = value || '1'", new Date().toISOString());
      const res = await run(api, ctx, OPEN);
      results.push(`${name}: ${res.status}${res.status === 200 ? "" : ` ${res.code || ""} ${String(res.error || "").slice(0, 120)}`}`);
    }
    assert.deepEqual(results, PATHS.map(([name]) => `${name}: 200`));
  });
});

describe("Ç5-K tur 2 DÜŞÜK-3 K5 — Kasa açılışı SİLİNİNCE önbellek düşer (açılışsız Kasa'da kural yok)", () => {
  let server;
  let api;
  before(async () => {
    server = await startTestServer({ now: { time: NOW, fixed: true } });
    api = apiOf(await loginAdmin(server));
    await api.post("/api/workspace/bank/setup/dismiss", {});
  });
  after(() => server?.close());

  it("açılış 10.03 → 11.03 girişi (önbellek dolar) → 09.03 girişi 409 → açılış silinir → 09.03 girişi 200", async () => {
    const opening = await must("Kasa açılışı", api.post("/api/workspace/cash/opening", { amount: "5.000", date: OPEN }));
    await must("11.03 giriş", kasaGiris(api, AFTER));
    await refused("09.03 giriş (açılış varken)", kasaGiris(api, BEFORE));
    const openingId = idOf(opening) || server.app.store.get("SELECT id FROM cash_entries WHERE is_opening = 1").id;
    await must("açılışı sil", api.del(`/api/workspace/cash/${openingId}`));
    assert.equal(server.app.store.get("SELECT COUNT(*) AS n FROM cash_entries WHERE is_opening = 1").n, 0, "açılış silindi");
    await must("09.03 giriş (açılış silindikten sonra — kural yok)", kasaGiris(api, BEFORE));
  });
});

describe("Ç5-K tur 2 DÜŞÜK-3 K6 — olaysız (eski sürüm biçimli) açılış öncesi kayıt tahsilatı Taksite Aktar ile karta taşınır: önceki hâl (d), yeni hareket SAYILMAZ", () => {
  let server;
  let api;
  const ids = {};
  before(async () => {
    server = await startTestServer({ now: { time: NOW, fixed: true } });
    api = apiOf(await loginAdmin(server));
    await api.post("/api/workspace/bank/setup/dismiss", {});
    const matrix = [["Ad Soyad", "Telefon", "Mart 2026 taksiti", "Nisan 2026 taksiti", "Toplam", "Ödenen"], ["Veli Olaysız", "0532 111 22 55", "1.000", "1.000", "2.000", ""]];
    const staged = await must("tablo yükle", api.post("/api/workspace/dataset/stage", { kind: "excel", fileName: "okul.xlsx", sheets: [{ name: "Okul", matrix }] }));
    await must("tablo onayla", api.post("/api/workspace/dataset/commit", { stageId: staged.stageId, mode: "replace" }));
    const rows = (await api.client.get(`/api/trpc/sheets.getRows?input=${encodeURIComponent(JSON.stringify({ json: {} }))}`)).data.result.data.json.rows;
    ids.key = rows.find(row => row["Ad Soyad"] === "Veli Olaysız").__hofKey;
    await must("Kasa açılışı", api.post("/api/workspace/cash/opening", { amount: "1.000", date: OPEN }));
    // 2.0.26 biçiminde (olay yok: event_id '') açılıştan önce tarihli kayıt tahsilatı; program açılış taramasıyla benimser (eski sürüm verisi gibi).
    server.app.db.prepare("INSERT INTO payments (id, case_key, case_title, amount, date, note, method, fin_ref, event_id, created_by, created_at) VALUES ('pay-olaysiz-k6', ?, 'Veli Olaysız', 500, ?, 'eski nakit', 'cash', '', '', 'eski', ?)").run(ids.key, EARLY, "2026-01-01T00:00:00.000Z");
    server.app.integrity.start();
  });
  after(() => server?.close());

  it("ön koşul: olaysız tahsilat açılıştan önce, uyarıda; Taksite Aktar 200 (paymentsMoved 1), karttaki satır aynı gün ve tutar, Kasa değişmez; Mutabakat Testi uyarı dışı sapma yok", async () => {
    assert.deepEqual({ ...server.app.store.get("SELECT date, event_id AS e FROM payments WHERE id = 'pay-olaysiz-k6'") }, { date: EARLY, e: "" });
    const before_ = await must("Mutabakat Testi", api.get("/api/workspace/ledger/integrity"));
    assert.ok((before_.checks.find(item => item.code === "cash:before-opening")?.count || 0) >= 1, "uyarıda");
    const kasa = await cashBalance(api);
    const preview = await must("ön izleme", api.get("/api/workspace/plans/from-table"));
    const result = await must("Taksite Aktar", api.post("/api/workspace/plans/from-table", { keys: [ids.key], fingerprint: preview.fingerprint }));
    assert.equal(result.paymentsMoved, 1);
    const moved = server.app.store.get("SELECT e.date AS date, e.amount AS amount, e.event_id AS e FROM plan_entries e JOIN plans p ON p.id = e.plan_id WHERE p.import_id = ? AND e.opening = 0", result.importId);
    assert.deepEqual({ date: moved.date, amount: moved.amount }, { date: EARLY, amount: 500 }, "taşınan satır aynı gün ve tutar");
    assert.ok(moved.e, "taşınan satır işlem başlığı aldı (önceki hâl eşlemesi (b) tutmaz — (d) ile eşlendi)");
    assert.equal(server.app.store.get("SELECT COUNT(*) AS n FROM payments WHERE id = 'pay-olaysiz-k6'").n, 0, "kayıt tahsilatı karta taşındı");
    assert.equal(await cashBalance(api), kasa, "Kasa aynı");
    const integrity = await must("Mutabakat Testi", api.get("/api/workspace/ledger/integrity"));
    assert.deepEqual(integrity.failures.filter(item => item.severity !== "warning").map(item => item.code), []);
  });
});

describe("Ç5-K tur 2 DÜŞÜK-3 K8 — açılış önbelleğinin damgası: başka bağlantı / store dışı yazım açılışı değiştirince bayatlamaz; 002 + yedekten geri yükleme", () => {
  let server;
  let api;
  before(async () => {
    server = await startTestServer({ now: { time: NOW, fixed: true } });
    api = apiOf(await loginAdmin(server));
    await api.post("/api/workspace/bank/setup/dismiss", {});
    await must("Kasa açılışı 10.03", api.post("/api/workspace/cash/opening", { amount: "5.000", date: OPEN }));
    await must("11.03 giriş (önbellek dolar: 10.03)", kasaGiris(api, AFTER));
  });
  after(() => server?.close());

  it("BAŞKA BAĞLANTI açılışı 05.03'e alır → 07.03 girişi 200 (yeni açılışla), 04.03 girişi 409 (açılış 05.03)", async () => {
    await refused("07.03 (açılış 10.03 iken)", kasaGiris(api, "2026-03-07"));
    otherConnection(server.app.store, "UPDATE cash_entries SET date = '2026-03-05' WHERE is_opening = 1");
    await must("07.03 giriş (başka bağlantıdan sonra)", kasaGiris(api, "2026-03-07"));
    await refused("04.03 giriş", kasaGiris(api, "2026-03-04"), "2026-03-05");
  });

  it("STORE DIŞI yazım (aynı bağlantı) açılışı 03.03'e alır → 04.03 girişi 200, 02.03 girişi 409 (açılış 03.03)", async () => {
    server.app.db.prepare("UPDATE cash_entries SET date = '2026-03-03' WHERE is_opening = 1").run();
    await must("04.03 giriş (store dışı yazımdan sonra)", kasaGiris(api, "2026-03-04"));
    await refused("02.03 giriş", kasaGiris(api, "2026-03-02"), "2026-03-03");
  });

  it("002: açılış 05.03 iken yedek → açılış 10.03'e düzeltilir, 11.03 girişi (önbellek 10.03), 07.03 girişi 409 → yedekten geri yükleme → 07.03 girişi 200, 04.03 409 (geri gelen açılış 05.03); 001'in kuralı etkilenmez", async () => {
    const second = (await must("002", api.post("/api/companies", { name: "Kasa İkinci" }))).company;
    const q = `?hofCompany=${second.id}`;
    await api.post(`/api/workspace/bank/setup/dismiss${q}`, {});
    await must("002 açılış 05.03", api.post(`/api/workspace/cash/opening${q}`, { amount: "1.000", date: "2026-03-05" }));
    const backup = await must("002 yedek", api.post("/api/admin/backups", { scope: "one", companyId: second.id }));
    const name = backup.backups?.[0]?.name;
    assert.ok(name, JSON.stringify(backup).slice(0, 300));
    await must("002 açılış 10.03'e düzeltilir", api.post(`/api/workspace/cash/opening${q}`, { amount: "1.000", date: OPEN }));
    await must("002 11.03 giriş", kasaGiris(api, AFTER, q));
    await refused("002 07.03 (açılış 10.03)", kasaGiris(api, "2026-03-07", q));
    await must("002 yedekten geri yükle", api.post("/api/admin/backups/restore", { name, company: second.id, confirm: second.code, password: ADMIN_PASSWORD }));
    await must("002 07.03 giriş (geri gelen açılış 05.03)", kasaGiris(api, "2026-03-07", q));
    await refused("002 04.03", kasaGiris(api, "2026-03-04", q), "2026-03-05");
    await refused("001 02.03 (001 açılışı 03.03, etkilenmedi)", kasaGiris(api, "2026-03-02"), "2026-03-03");
  });
});
