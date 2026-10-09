// 2.1.0 — Aşama 2, bağımsız gözden geçirme: "bir olay = bir para hareketi" (K11) ve K6 (b)/(c) delikleri (docs/2.1.0-KANIT.md
// "Aşama 2 — Bağımsız Gözden Geçirme": B1, B2, D1, D10).
//
// ÇALIŞIYOR MU:
//  - Kasa ↔ Banka transferinin iki bacağı tek olayı paylaşır (tek istisna); Mutabakat Testi temiz.
//  - Kasa girişi çıkışa çevrilince işlem başlığının türü de değişir (cash_in → cash_out); İşlem No aynı kalır.
// NASIL BOZARIM:
//  B1. bank.post DIŞINDAN geçerli bir para satırı eklenir ama event_id DOLU: (a) uydurma olay kimliği, (b) başka satırın etkin olayı
//      → test kipinde money-guard (money-event), satır yazılmaz; üretimde günlük. Önceden yalnız event_id = '' yakalanıyordu: (b)'deki
//      999 TL Kasa'ya girip hiçbir denetimde görünmüyordu.
//  B1. bank.post dışından INSERT OR REPLACE / ON CONFLICT DO UPDATE (eski satırı ve olayını sessizce siler) → money-raw.
//  B1. Bir olayın iki etkin satırı (transfer ikizi dışında) → tam tarama bank:event bulur (Mutabakat Testi).
//  B2. Taksite Aktar (bağlanan kart) → taşınan tahsilatı sil → aktarımı geri al → Silinenler'den geri yükle: olay iki satır taşıyor,
//      Kasa 1.000 → 2.000 oluyordu (2.0.26'dan beri çift sayım). Şimdi geri yükleme 409, Kasa 1.000, olay başına tek satır.
//  D10. İzinli (para dışı) yazıcı assertNonMoney'e INSERT'teki gerçek değer nesnesini verir: yazıcı bozulup para satırı yazarsa
//      (mutasyon) test kipinde hata.
import assert from "node:assert/strict";
import { after, before, describe, it } from "node:test";
import { boot, integrityOf, integrityOk, localDay, must } from "./banka-210-ortak.mjs";

const TODAY = localDay(0);
const guardOf = error => error?.extra?.code === "money-guard" ? error.extra.violations || [] : null;
const MODULE_TABLES = ["payments", "cash_entries", "account_entries", "plan_entries", "stock_moves", "cheque_events"];
const rowsOfEvent = (store, eventId) => MODULE_TABLES.flatMap(table => store.all(`SELECT '${table}' AS t, id, amount FROM ${table} WHERE event_id = ? AND event_id <> ''`, eventId));
const cashBalance = async api => {
  const data = await must("Kasa", api.get("/api/workspace/cash"));
  return Number(data.summary?.balance ?? data.totals?.balance);
};
const insertCash = (store, { id, amount = 999, eventId = "", verb = "INSERT" }) =>
  store.run(`${verb} INTO cash_entries (id, kind, amount, date, description, method, event_id, created_by, created_at) VALUES (?, 'in', ?, ?, 'Kaçak', 'cash', ?, 'test', ?)`, id, amount, TODAY, eventId, new Date().toISOString());

describe("B1 — bank.post dışından olaylı para satırı (test kipi)", () => {
  let ctx;
  before(async () => {
    ctx = await boot();
  });
  after(() => ctx.server.close());

  it("uydurma olay kimliğiyle eklenen para satırı → money-guard; satır yazılmaz", async () => {
    const { store } = ctx;
    assert.throws(() => store.tx(() => insertCash(store, { id: "kacak-uydurma", eventId: "ev-uydurma" })), error => {
      const violations = guardOf(error);
      return Boolean(violations?.some(item => item.code === "money-event" && item.table === "cash_entries"));
    });
    assert.equal(store.get("SELECT COUNT(*) AS n FROM cash_entries WHERE id = 'kacak-uydurma'").n, 0);
  });

  it("başka satırın etkin olayıyla eklenen para satırı → money-guard; Kasa değişmez", async () => {
    const { api, store } = ctx;
    const real = await must("Kasa girişi", api.post("/api/workspace/cash", { kind: "in", amount: "100", date: TODAY, description: "Gerçek" }));
    const eventId = store.get("SELECT event_id AS e FROM cash_entries WHERE id = ?", real.id).e;
    const before = await cashBalance(api);
    assert.throws(() => store.tx(() => insertCash(store, { id: "kacak-baska-olay", eventId })), error => Boolean(guardOf(error)?.some(item => item.code === "money-event")));
    assert.equal(store.get("SELECT COUNT(*) AS n FROM cash_entries WHERE id = 'kacak-baska-olay'").n, 0);
    assert.equal(await cashBalance(api), before);
    assert.deepEqual(rowsOfEvent(store, eventId).map(row => row.id), [real.id]);
  });

  it("bank.post dışından INSERT OR REPLACE ve ON CONFLICT DO UPDATE → money-raw; eski satır ve olayı yerinde", async () => {
    const { api, store } = ctx;
    const real = await must("Kasa girişi", api.post("/api/workspace/cash", { kind: "in", amount: "250", date: TODAY, description: "Yerinde" }));
    const eventId = store.get("SELECT event_id AS e FROM cash_entries WHERE id = ?", real.id).e;
    assert.throws(() => store.tx(() => insertCash(store, { id: real.id, amount: 5, eventId, verb: "INSERT OR REPLACE" })), error => Boolean(guardOf(error)?.some(item => item.code === "money-raw")));
    assert.throws(
      () => store.tx(() => store.run("INSERT INTO cash_entries (id, kind, amount, date, description, method, event_id, created_by, created_at) VALUES (?, 'in', 5, ?, 'x', 'cash', ?, 'test', ?) ON CONFLICT(id) DO UPDATE SET amount = excluded.amount", real.id, TODAY, eventId, new Date().toISOString())),
      error => Boolean(guardOf(error)?.some(item => item.code === "money-raw")),
    );
    assert.equal(store.get("SELECT amount FROM cash_entries WHERE id = ?", real.id).amount, 250);
    await integrityOk(api, "REPLACE denemeleri sonrası");
  });

  it("üretim kipinde aynı yazım işi durdurmaz ama günlüğe düşer; tam tarama olayın ikinci satırını (bank:event) bulur", async () => {
    const prod = await boot({ moneyStrict: false, gateVerify: false });
    try {
      const { api, store } = prod;
      const real = await must("Kasa girişi", api.post("/api/workspace/cash", { kind: "in", amount: "100", date: TODAY, description: "Gerçek" }));
      const eventId = store.get("SELECT event_id AS e FROM cash_entries WHERE id = ?", real.id).e;
      store.tx(() => insertCash(store, { id: "kacak-uretim", eventId }));
      const log = JSON.parse(store.setting("meta.bank.integrity", "[]"));
      assert.ok(log.some(item => item.code === "money-event" && item.table === "cash_entries"), `K6 günlüğü: ${JSON.stringify(log)}`);
      const result = await integrityOf(api);
      assert.equal(result.ok, false, "tam tarama bozukluğu görmeli");
      const broken = result.failures.find(item => item.code.startsWith("bank:event"));
      assert.ok(broken, `bank:event bulunmalı: ${JSON.stringify(result.failures)}`);
      assert.match(JSON.stringify(broken.sample), /birden çok|2 etkin satır/);
    } finally {
      await prod.server.close();
    }
  });
});

describe("B1/K11 — Kasa ↔ Banka transferi tek olay, iki satır (tek istisna)", () => {
  let ctx;
  before(async () => {
    ctx = await boot();
  });
  after(() => ctx.server.close());

  it("transferin iki bacağı aynı olayda; Mutabakat Testi temiz; düzeltmede de", async () => {
    const { api, store } = ctx;
    await must("Kasa girişi", api.post("/api/workspace/cash", { kind: "in", amount: "1000", date: TODAY, description: "Açılış" }));
    const transfer = await must("transfer", api.post("/api/workspace/cash/transfer", { direction: "to-bank", amount: "300", date: TODAY, description: "Bankaya" }));
    const rows = store.all("SELECT id, event_id AS e FROM cash_entries WHERE transfer_id <> '' ORDER BY id");
    assert.equal(rows.length, 2, JSON.stringify(transfer));
    assert.equal(rows[0].e, rows[1].e);
    assert.equal(rowsOfEvent(store, rows[0].e).length, 2);
    await integrityOk(api, "transfer");
  });
});

describe("B2 — Taksite Aktar → sil → geri al → geri yükle: olay iki satır taşıyamaz (Kasa çift sayılmaz)", () => {
  let ctx;
  before(async () => {
    ctx = await boot();
  });
  after(() => ctx.server.close());

  it("bağlanan kartta dört adım: geri yükleme 409, Kasa 1.000, olay başına tek satır, Mutabakat Testi temiz", async () => {
    const { api, store } = ctx;
    const NAMES = ["Ocak", "Şubat", "Mart", "Nisan", "Mayıs", "Haziran", "Temmuz", "Ağustos", "Eylül", "Ekim", "Kasım", "Aralık"];
    const now = new Date();
    const header = offset => {
      const d = new Date(now.getFullYear(), now.getMonth() + offset, 1);
      return `${NAMES[d.getMonth()]} ${d.getFullYear()} taksiti`;
    };
    const matrix = [["Ad Soyad", "Telefon", header(-1), header(0), header(1), "Toplam"], ["Zeynep Ak", "", "1.000", "1.000", "1.000", "3.000"]];
    const staged = await must("tablo", api.post("/api/workspace/dataset/stage", { kind: "excel", fileName: "a.xlsx", sheets: [{ name: "Liste", matrix }] }));
    await must("tablo kaydı", api.post("/api/workspace/dataset/commit", { stageId: staged.stageId, mode: "replace" }));
    const rows = (await api.client.get(`/api/trpc/sheets.getRows?input=${encodeURIComponent(JSON.stringify({ json: {} }))}`)).data.result.data.json.rows;
    const key = rows.find(row => row["Ad Soyad"] === "Zeynep Ak").__hofKey;
    // Aynı adlı BAĞSIZ kart → ön izlemede "link" (bağlanan kart).
    await must("kart", api.post("/api/workspace/plans", { name: "Zeynep Ak", total: "3.000", mode: "auto", count: 3, firstDue: localDay(-20), registeredOn: localDay(-20) }));
    await must("kayıt tahsilatı", api.post(`/api/workspace/cases/${encodeURIComponent(key)}/payments`, { amount: "1.000", date: TODAY, method: "cash", caseTitle: "Zeynep Ak" }));
    const payment = store.get("SELECT id, event_id AS e FROM payments WHERE case_key = ?", key);
    assert.ok(payment?.e, "kayıt tahsilatı olay almalı");
    assert.equal(await cashBalance(api), 1000);
    const preview = await must("ön izleme", api.get("/api/workspace/plans/from-table"));
    assert.ok(preview.records.some(item => item.status === "link"), JSON.stringify(preview.records.map(item => [item.name, item.status])));
    const result = await must("Taksite Aktar", api.post("/api/workspace/plans/from-table", { keys: preview.records.filter(item => item.selected).map(item => item.key), fingerprint: preview.fingerprint }));
    assert.equal(result.paymentsMoved, 1);
    const moved = store.get("SELECT id, plan_id AS planId FROM plan_entries WHERE event_id = ?", payment.e);
    assert.ok(moved, "taşınan tahsilat aynı olayla karta geçmeli");
    await must("taşınan tahsilatı sil", api.del(`/api/workspace/plans/${moved.planId}/entries/${moved.id}`));
    assert.equal(await cashBalance(api), 0);
    await must("aktarımı geri al", api.post(`/api/workspace/plans/imports/${result.importId}/undo`, {}));
    assert.equal(await cashBalance(api), 1000, "geri almada kayıt tahsilatı kayıt kartına döner");
    const trash = store.get("SELECT id FROM trash WHERE ref = ? AND restored_at IS NULL", moved.id);
    const restored = await api.post("/api/admin/trash/restore", { id: `trash:${trash.id}` });
    assert.equal(restored.status, 409, `geri yükleme reddedilmeli: ${restored.status} ${JSON.stringify(restored.data).slice(0, 300)}`);
    assert.match(String(restored.error || restored.data?.error || ""), /zaten|ikinci kez/);
    assert.equal(await cashBalance(api), 1000, "Kasa çift sayılmamalı");
    assert.deepEqual(rowsOfEvent(store, payment.e).map(row => row.t), ["payments"]);
    assert.equal(store.get("SELECT COUNT(*) AS n FROM plan_entries WHERE id = ?", moved.id).n, 0);
    await integrityOk(api, "dört adım sonrası");
  });
});

describe("D1 — işlem başlığının türü satırı izler; İşlem No kalıcıdır", () => {
  let ctx;
  before(async () => {
    ctx = await boot();
  });
  after(() => ctx.server.close());

  it("Kasa girişi çıkışa çevrilince tür cash_out; tarih geçen yıla alınınca numara aynı (kalıcı kimlik); bank:event türü de denetler", async () => {
    const { api, store } = ctx;
    await must("Kasa girişi (bakiye)", api.post("/api/workspace/cash", { kind: "in", amount: "5000", date: TODAY, description: "Bakiye" }));
    const entry = await must("Kasa girişi", api.post("/api/workspace/cash", { kind: "in", amount: "1000", date: TODAY, description: "Tür" }));
    const eventId = store.get("SELECT event_id AS e FROM cash_entries WHERE id = ?", entry.id).e;
    const first = store.get("SELECT no, type FROM fin_events WHERE id = ?", eventId);
    assert.equal(first.type, "cash_in");
    await must("çıkışa çevir", api.put(`/api/workspace/cash/${entry.id}`, { kind: "out", amount: "1000", date: TODAY, description: "Tür", force: true, cashForce: true }));
    const second = store.get("SELECT no, type, direction FROM fin_events WHERE id = ?", eventId);
    assert.equal(second.direction, "out");
    assert.equal(second.type, "cash_out", "tür satırdan yeniden türetilmeli");
    assert.equal(second.no, first.no, "İşlem No değişmez");
    const lastYear = `${Number(TODAY.slice(0, 4)) - 1}-12-30`;
    await must("tarihi geçen yıla al", api.put(`/api/workspace/cash/${entry.id}`, { kind: "out", amount: "1000", date: lastYear, description: "Tür", force: true, cashForce: true }));
    const third = store.get("SELECT no, year, date FROM fin_events WHERE id = ?", eventId);
    assert.equal(third.date, lastYear, "kopyanın tarihi satırdan");
    assert.equal(third.no, first.no, "İşlem No kalıcı kimliktir (tarih yılı değişse de)");
    // bank:event türü de denetler: türü elle bozulan olay tam taramada görünür.
    store.raw("test: tür bozma", () => store.tx(() => store.run("UPDATE fin_events SET type = 'cash_in' WHERE id = ?", eventId)));
    const result = await integrityOf(api);
    assert.ok(result.failures.some(item => item.code.startsWith("bank:event")), JSON.stringify(result.failures));
  });
});

describe("D10 — para dışı yazıcı yazdığı GERÇEK satırla denetlenir (mutasyon)", () => {
  let ctx;
  before(async () => {
    ctx = await boot();
  });
  after(() => ctx.server.close());

  it("açık hesap stok satışının cari satırı bozulup tahsilat (para satırı) yazılırsa → money-nonmoney; hiçbir şey yazılmaz", async () => {
    const { api, store } = ctx;
    const account = await must("cari", api.post("/api/workspace/accounts", { name: "Mutasyon Cari", type: "customer", registeredOn: "2026-01-01" }));
    const item = await must("ürün", api.post("/api/workspace/stock", { name: "Mutasyon Ürünü", unit: "Adet", unitPrice: "10", salePrice: "20", openingQty: "10" }));
    // Doğru kullanım: açık hesap satışı cariye borç yazar (para satırı değil, olay yok).
    await must("açık hesap satış", api.post(`/api/workspace/stock/${item.id}/moves`, { kind: "out", qty: "1", unitPrice: "20", pay: "account", accountId: account.id, date: TODAY }));
    // Mutasyon: yazıcının INSERT'i stok kaynağı yerine elle tahsilat (source '', kind 'in') yazar.
    const original = store.run;
    store.run = (sql, ...args) => {
      if (/^\s*INSERT INTO account_entries/.test(sql) && args[7] === "stock") {
        args[2] = "in";
        args[7] = "";
      }
      return original(sql, ...args);
    };
    let response;
    try {
      response = await api.post(`/api/workspace/stock/${item.id}/moves`, { kind: "out", qty: "1", unitPrice: "20", pay: "account", accountId: account.id, date: TODAY });
    } finally {
      store.run = original;
    }
    assert.equal(response.status, 500, JSON.stringify(response.data).slice(0, 300));
    assert.equal(response.code, "money-guard");
    // Yazıcının kendi denetimi (yazılan satır) yakalar; önceden yalnız COMMIT'teki money:event (olaysız para satırı) yakalıyordu.
    assert.ok((response.data?.violations || []).some(item => item.code === "money-nonmoney" && item.table === "account_entries"), JSON.stringify(response.data?.violations));
    assert.equal(store.get("SELECT COUNT(*) AS n FROM account_entries WHERE account_id = ?", account.id).n, 1, "bozuk satır yazılmadı");
    assert.equal(store.get("SELECT COUNT(*) AS n FROM stock_moves WHERE item_id = ? AND kind = 'out'", item.id).n, 1);
  });
});
