// 2.1.0 — Aşama 2, Dilim 5: mutabakat kapısının süzgeç yolu ("dokunulan varlıklar") veri büyüdükçe yavaşlamamalı.
//
// Ölçüm (tools/kapi-olcum.mjs, docs/2.1.0-KANIT.md): süzgeç yolu ilk hâliyle 100.000 para satırında yazım başına ~770 ms'ydi; süre
// veriyle doğrusal büyüyordu. Nedeni: istatistiksiz SQLite planlayıcısı (ANALYZE yok) dokunulan kimlik listesi yerine durum/silinme
// kolonunun indeksini (accounts.deleted_at, invoices.status, fin_events.src_table …) seçiyor ya da kolonlar arası OR (a IN … OR b IN …)
// yüzünden tabloyu baştan sona dolaşıyordu. Düzeltme: süzgeçli sorgular kimlik kümesinden (UNION) ve satır tablosundan başlar
// (CROSS JOIN sırayı belirler), durum kolonlarının indeksi tekli + ile kapatılır; dokunulan stok hareketine bağlı fatura kalemi için
// indeks (idx_invoice_lines_move, v20). Sonuç: 100.000 satırda yazım başına ~7 ms, 1.000.000'da KANIT'taki tablo.
//
// Planlayıcı istatistik olmadan her tabloyu aynı büyüklükte varsayar: sorgu planı veri miktarından bağımsızdır. Bu yüzden küçük veride
// alınan plan büyük veridekiyle aynıdır ve test hızlıdır.
//
// ÇALIŞIYOR MU: günlük işlerin (Kasa, cari tahsilat/ödeme, Borç Yaz, peşin/taksitli fatura, iade, stok satışı, taksit tahsilatı, çek alış/
//   tahsil/ciro) her birinde süzgeç yolu çalışır ve sorgularının HİÇBİRİ büyük bir tabloyu baştan sona dolaşmaz (EXPLAIN QUERY PLAN'da
//   "SCAN <tablo>" yok; yalnız kimlik listesi, alt sorgu ve küçük ayar tabloları).
// NASIL BOZARIM:
//   1. Süzgece kolonlar arası OR'lu ya da durum indeksine kayan bir denetim eklemek → bu test o sorgunun planında "SCAN" görür ve kırılır.
//   2. İndeksi kaldırmak (idx_invoice_lines_move) → fatura denetimi invoice_lines'ı dolaşır → kırılır.
//   3. Süzgeçli okumada CROSS JOIN'i geri almak (money-lines, ledger) → cari/taksit/çek satırları görünürlük tablosundan dolaşılır → kırılır.
import assert from "node:assert/strict";
import { after, before, describe, it } from "node:test";
import { boot, must } from "./banka-210-ortak.mjs";

const NOW = "2026-10-08T12:00:00+03:00";
const TODAY = "2026-10-08";
const day = offset => new Date(Date.UTC(2026, 9, 8 + offset)).toISOString().slice(0, 10);
const PROD = { now: NOW, gateVerify: false, moneyStrict: false };

// Büyük (veriyle büyüyen) tablolar: bunlardan biri süzgeç yolunda baştan sona dolaşılırsa süre veriyle doğrusal büyür.
const BIG = new Set([
  "payments", "cash_entries", "accounts", "account_entries", "plans", "plan_items", "plan_entries", "stock_items", "stock_moves", "cheques", "cheque_events",
  "invoices", "invoice_lines", "invoice_offsets", "fin_events", "bank_lines",
]);

/** Kapının süzgeç yolunda (evaluate) çalışan bütün SQL'ler: [{ sql, args }]. */
function recorder(app) {
  const store = app.store;
  const seen = new Map();
  let active = false;
  const remember = (sql, args) => {
    if (active && !seen.has(sql)) seen.set(sql, args);
  };
  for (const name of ["all", "get"]) {
    const original = store[name];
    store[name] = (sql, ...args) => {
      remember(sql, args);
      return original(sql, ...args);
    };
  }
  const prepare = store.db.prepare.bind(store.db);
  store.db.prepare = sql => {
    remember(sql, null);
    return prepare(sql);
  };
  const engine = app.integrity.scopedGate();
  const evaluate = engine.evaluate;
  engine.evaluate = (...args) => {
    active = true;
    try {
      return evaluate(...args);
    } finally {
      active = false;
    }
  };
  return { take: () => { const out = [...seen].map(([sql, args]) => ({ sql, args })); seen.clear(); return out; }, prepare };
}

/** SQL'deki tablo takma adları → tablo (FROM/JOIN tablo ad). */
function aliases(sql) {
  const out = new Map();
  for (const match of sql.matchAll(/\b(?:FROM|JOIN)\s+([a-z_]+)(?:\s+(?:AS\s+)?([a-z_]+))?/gi)) {
    const table = match[1];
    const alias = match[2] && !/^(ON|WHERE|LEFT|JOIN|CROSS|INNER|GROUP|ORDER|LIMIT|UNION|USING)$/i.test(match[2]) ? match[2] : table;
    out.set(alias, table);
    out.set(table, table);
  }
  return out;
}

// Seçici olmayan kolonlar: yalnız bunlarla yapılan indeks araması (SEARCH … (deleted_at=?), (status=?), (src_table=?) …) tablonun hemen
// hepsini dolaşır — planda "SEARCH" yazsa da tam taramadır (ilk ölçümdeki yavaşlığın asıl nedeni buydu).
const LOW = new Set(["deleted_at", "status", "src_table", "kind", "source", "type", "pay", "gl", "date", "method", "direction", "opening", "role", "side", "year", "created_at"]);

/** Planda büyük tablonun baştan sona dolaşıldığı satırlar. */
function fullScans(prepare, { sql, args }) {
  if (/^\s*PRAGMA/i.test(sql)) return [];
  // Varlık yoklaması (SELECT 1 AS found … LIMIT 1, koşulu yalnız indeksli eşitlik): ilk satırda ya da indeks aramasında hemen biter.
  if (/^SELECT 1 AS found FROM \w+ WHERE \w+ = '[^']*' LIMIT 1$/.test(sql.trim())) return [];
  const names = aliases(sql);
  const binds = args ?? [];
  let plan;
  try {
    plan = prepare(`EXPLAIN QUERY PLAN ${sql}`).all(...binds);
  } catch {
    // Adlı parametreli sorgu (money-lines iterate): bağsız hazırlanır; EXPLAIN bağ istemez.
    plan = prepare(`EXPLAIN QUERY PLAN ${sql}`).all(Object.fromEntries([...sql.matchAll(/:([a-z_]+)/gi)].map(match => [match[1], "[]"])));
  }
  return plan
    .map(row => row.detail)
    .filter(detail => {
      if (/VIRTUAL TABLE|CONSTANT ROW/.test(detail)) return false;
      const scan = /^SCAN (\w+)/.exec(detail);
      if (scan) return BIG.has(names.get(scan[1]) || scan[1]);
      const search = /^SEARCH (\w+) USING (?:COVERING )?INDEX \S+ \((.+)\)$/.exec(detail);
      if (!search || !BIG.has(names.get(search[1]) || search[1])) return false;
      const columns = [...search[2].matchAll(/(\w+)(?:[=<>]|\s+IN)/g)].map(match => match[1]);
      return columns.length > 0 && columns.every(column => LOW.has(column));
    });
}

describe("kapı süzgeci — sorgu planı veriyle büyümez (EXPLAIN QUERY PLAN)", () => {
  let ctx;
  let rec;
  let customer;
  let supplier;
  let item;
  before(async () => {
    ctx = await boot(PROD);
    rec = recorder(ctx.app);
    customer = await must("cari", ctx.api.post("/api/workspace/accounts", { name: "Plan Müşterisi", type: "customer", registeredOn: day(-60) }));
    supplier = await must("tedarikçi", ctx.api.post("/api/workspace/accounts", { name: "Plan Tedarikçisi", type: "supplier", registeredOn: day(-60) }));
    item = await must("ürün", ctx.api.post("/api/workspace/stock", { name: "Plan Ürünü", unit: "Adet", unitPrice: "10", salePrice: "20", openingQty: "100" }));
    rec.take();
  });
  after(() => ctx.server.close());

  const check = async (label, step) => {
    await step();
    const gate = ctx.app.integrity.stats().gate;
    assert.equal(gate.path, "scoped", `${label}: süzgeç yolu (${gate.reason || ""})`);
    const queries = rec.take();
    assert.ok(queries.length > 0, `${label}: süzgeç sorgusu kaydedilmedi`);
    const bad = queries.map(query => ({ sql: query.sql.replace(/\s+/g, " ").slice(0, 220), scans: fullScans(rec.prepare, query) })).filter(item => item.scans.length);
    assert.deepEqual(bad, [], `${label}: süzgeç yolunda tam tarama`);
    return queries.length;
  };

  it("günlük işlerin hiçbirinde büyük tablo baştan sona dolaşılmaz", async () => {
    const { api, store } = ctx;
    let total = 0;
    total += await check("Kasa girişi", () => must("Kasa", api.post("/api/workspace/cash", { kind: "in", amount: "125,50", date: TODAY, description: "Kasa" })));
    total += await check("cari havale tahsilatı", () => must("tahsilat", api.post(`/api/workspace/accounts/${customer.id}/entries`, { kind: "in", amount: "300", method: "bank", date: TODAY })));
    total += await check("tedarikçiye ödeme", () => must("ödeme", api.post(`/api/workspace/accounts/${supplier.id}/entries`, { kind: "out", amount: "50", method: "cash", date: TODAY })));
    total += await check("Borç Yaz", () => must("borç", api.post(`/api/workspace/accounts/${customer.id}/entries`, { kind: "debt", amount: "900", date: TODAY, note: "Borç" })));
    let sale = null;
    total += await check("peşin satış faturası", async () => {
      sale = await must("fatura", api.post("/api/workspace/invoices", { kind: "sale", accountId: customer.id, issueDate: TODAY, lines: [{ itemId: item.id, name: "", qty: 2, unitPrice: 100, discountRate: 0, vatRate: 20 }], payment: { cash: [{ amount: 240, method: "cash" }], cheques: [], endorse: [], rest: "open" }, force: true }));
    });
    total += await check("taksitli satış faturası", () => must("taksitli", api.post("/api/workspace/invoices", { kind: "sale", accountId: customer.id, issueDate: TODAY, lines: [{ itemId: item.id, name: "", qty: 3, unitPrice: 100, discountRate: 0, vatRate: 0 }], payment: { cash: [], cheques: [], endorse: [], rest: "installments", installments: { count: 3, firstDue: day(30) } }, force: true })));
    total += await check("alış faturası", () => must("alış", api.post("/api/workspace/invoices", { kind: "purchase", accountId: supplier.id, number: "TDR-PLN-1", issueDate: TODAY, lines: [{ itemId: item.id, name: "", qty: 5, unitPrice: 10, discountRate: 0, vatRate: 20 }], payment: { cash: [], cheques: [], endorse: [], rest: "open" }, force: true })));
    const line = store.get("SELECT id FROM invoice_lines WHERE invoice_id = ? ORDER BY seq LIMIT 1", sale.id);
    total += await check("satıştan iade", () => must("iade", api.post("/api/workspace/invoices", { kind: "sale_return", accountId: customer.id, originalId: sale.id, issueDate: TODAY, lines: [{ itemId: item.id, name: "", qty: 1, unitPrice: 100, discountRate: 0, vatRate: 20, originLineId: line.id }], payment: { cash: [{ amount: 120, method: "cash" }], cheques: [], endorse: [], rest: "open" }, force: true })));
    total += await check("stok satışı", () => must("stok", api.post(`/api/workspace/stock/${item.id}/moves`, { kind: "out", qty: "2", unitPrice: "20", pay: "cash", method: "card", date: TODAY })));
    const plan = store.get("SELECT id FROM plans WHERE account_id = ? AND deleted_at IS NULL ORDER BY created_at DESC LIMIT 1", customer.id);
    total += await check("taksit tahsilatı", () => must("taksit", api.post(`/api/workspace/plans/${plan.id}/entries`, { kind: "in", amount: "100", method: "cash", date: TODAY })));
    let cheque = null;
    total += await check("çek alış", async () => {
      cheque = await must("çek", api.post("/api/workspace/cheques", { direction: "in", instrument: "cheque", amount: "750", issueDate: TODAY, dueDate: day(30), accountId: customer.id, serialNo: "PLN-1", bank: "Test" }));
    });
    total += await check("çek tahsili", () => must("çek tahsil", api.post(`/api/workspace/cheques/${cheque.id}/actions`, { action: "collect", date: TODAY, method: "bank" })));
    let cheque2 = null;
    total += await check("ikinci çek alış", async () => {
      cheque2 = await must("çek 2", api.post("/api/workspace/cheques", { direction: "in", instrument: "cheque", amount: "400", issueDate: TODAY, dueDate: day(30), accountId: customer.id, serialNo: "PLN-2", bank: "Test" }));
    });
    total += await check("çek cirosu", () => must("ciro", api.post(`/api/workspace/cheques/${cheque2.id}/actions`, { action: "endorse", date: TODAY, accountId: supplier.id })));
    assert.ok(total > 50, `süzgeç yolunda kaydedilen sorgu sayısı ${total}`);
  });
});
