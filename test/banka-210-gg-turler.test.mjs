// 2.1.0 — Aşama 2, bağımsız gözden geçirme B5: zincir fikstürlerinde olmayan para türleri (docs/2.1.0-KANIT.md "Aşama 2 — Bağımsız
// Gözden Geçirme").
//
// Veri UYDURMA DEĞİL: test/fixtures/surum-2.0.26-turler, surum-2.0.26-zincir kurulumunun devamında GERÇEK v2.0.26 koduyla o sürümün
// API'sinden girildi (node tools/surum-verisi.mjs --fikstur turler --devam v2.0.26 --kaynak zincir): verilen çek bankadan ve verilen
// senet nakit ödendi, müşteri çeki tedarikçiye ciro edildi, taksit kartından havale iadesi, Excel'den taksit kartı ("Ödenen" kolonu =
// açılış/devir), taksit kartına bağlı çek nakit tahsil edildi, havaleyle peşin stok alışı, nakit ve havaleyle peşin stok satışı.
// Göçten önceki ölçü GERÇEK v2.0.26 koduyla alındı (--oncesi); birebir karşılaştırma banka-210-goc-zinciri'nde (bu fikstür de orada).
//
// Bu dosya: göçten SONRA bu eski (olaysız) satırlar güncel kodla işlenebiliyor mu — sıkı para denetimi (K6) ve kapı eşdeğerlik
// denetimi AÇIK (test kipi). NASIL BOZARIM: ciroyu geri al + yeniden ciro et, verilen çekin ödemesini geri al + yeniden öde, senet
// ödemesini ve karta bağlı çekin tahsilini geri al, eski taksit iadesini ve açılışı düzelt, eski peşin stok alış/satışını düzelt ve sil.
// Hiçbiri 500 (kapı eşdeğerliği / para yazımı) vermemeli; Mutabakat Testi'nde yeni sapma çıkmamalı; yeni yazılan para satırları olaylı.
import assert from "node:assert/strict";
import { DatabaseSync } from "node:sqlite";
import path from "node:path";
import { describe, it } from "node:test";
import { fixtureExists, readFixture, unpackFixture } from "./guvenilirlik/fikstur.mjs";
import { CURRENT, bootVersion } from "./guvenilirlik/surumler.mjs";
import { companyDbFile, readRegistry } from "./guvenilirlik/uretici.mjs";
import { MODULE_TABLES, moneyWhere } from "../server/lib/bank/money-lines.mjs";

const NAME = "surum-2.0.26-turler";
const MONEY_TABLES = MODULE_TABLES;

describe("B5 — 2.0.26'nın eski para türleri göçten sonra güncel kodla işlenir", { skip: !fixtureExists(NAME) && `${NAME} yok` }, () => {
  it("ciro, verilen çek/senet, karta bağlı çek, taksit iadesi/açılışı, peşin stok: geri al / düzelt / sil → 200, yeni sapma yok", async () => {
    const before = readFixture(NAME).oncesi;
    const fixture = unpackFixture(NAME);
    let server = null;
    try {
      // Sıkı K6 ve kapı eşdeğerliği (bootVersion CURRENT varsayılanı) açık; saat ölçünün alındığı gün.
      server = await bootVersion(CURRENT, { dataDir: fixture.dataDir, backupDir: fixture.backupDir, maxCompanies: 10, now: `${before.today}T15:00:00+03:00` });
      const api = await server.login();
      const day = before.today;
      const companies = Object.entries(before.companies).filter(([, item]) => ["001", "002"].includes(item.code));
      assert.equal(companies.length, 2);
      const marks = {};
      for (const [id, company] of companies) {
        const label = `${company.code} · ${company.name}`;
        assert.equal((await api.post("/api/companies/select", { id })).status, 200);
        const failures = data => (data.failures || []).map(item => `${item.code}|${item.severity}|${item.count ?? ""}`).sort();
        const start = failures((await api.get("/api/workspace/ledger/integrity")).data);
        // Bu şirketin veri dosyasında işlemlerden önceki en büyük rowid'ler (sonra yazılanlar olaylı olmalı).
        const file = companyDbFile(fixture.dataDir, (readRegistry(fixture.dataDir) || []).find(entry => entry.id === id) || { id, dir: "" });
        const db = new DatabaseSync(file, { readOnly: true });
        try {
          marks[id] = Object.fromEntries(MONEY_TABLES.map(table => [table, db.prepare(`SELECT COALESCE(MAX(rowid), 0) AS n FROM ${table}`).get().n]));
        } finally {
          db.close();
        }
        const step = async (what, promise) => {
          const response = await promise;
          assert.equal(response.status, 200, `${label} ${what}: ${response.status} ${JSON.stringify(response.data ?? response.body).slice(0, 300)}`);
          return response.data;
        };
        const listed = (await api.get("/api/workspace/cheques?limit=500")).data;
        const cheques = listed.items || listed.cheques || listed;
        const bySerial = prefix => {
          const found = cheques.find(item => String(item.serialNo || "").startsWith(prefix) && String(item.serialNo).endsWith(`-${company.code}-T`));
          assert.ok(found, `${label}: ${prefix} evrakı fikstürde yok`);
          return found;
        };
        const endorsed = bySerial("CR-");
        const paidCheque = bySerial("VC-");
        const paidNote = bySerial("VS-");
        const planCheque = bySerial("TC-");
        assert.equal(endorsed.status, "endorsed");
        assert.equal(paidCheque.status, "paid");
        const supplierId = (await step("verilen çek kartı", api.get(`/api/workspace/cheques/${paidCheque.id}`))).accountId;
        await step("ciroyu geri al", api.post(`/api/workspace/cheques/${endorsed.id}/undo`, {}));
        await step("yeniden ciro et", api.post(`/api/workspace/cheques/${endorsed.id}/actions`, { action: "endorse", date: day, accountId: supplierId }));
        await step("verilen çekin ödemesini geri al", api.post(`/api/workspace/cheques/${paidCheque.id}/undo`, { cashForce: true }));
        await step("verilen çeki yeniden öde", api.post(`/api/workspace/cheques/${paidCheque.id}/actions`, { action: "pay", date: day, method: "bank", cashForce: true }));
        await step("senet ödemesini geri al", api.post(`/api/workspace/cheques/${paidNote.id}/undo`, { cashForce: true }));
        await step("karta bağlı çekin tahsilini geri al", api.post(`/api/workspace/cheques/${planCheque.id}/undo`, { cashForce: true }));
        const planList = (await api.get("/api/workspace/plans?limit=500")).data;
        const plans = (planList.items || planList.plans || planList).filter(plan => String(plan.name || "").endsWith(`-${company.code}-T)`));
        assert.equal(plans.length, 3, `${label}: taksit kartları (1 elle + 2 Excel)`);
        let refunds = 0;
        let openings = 0;
        for (const plan of plans) {
          for (const entry of (await step("taksit kartı", api.get(`/api/workspace/plans/${plan.id}`))).entries || []) {
            if (entry.kind === "out") {
              refunds += 1;
              await step("eski taksit iadesini düzelt", api.put(`/api/workspace/plans/${plan.id}/entries/${entry.id}`, { amount: "100", cashForce: true }));
            }
            if (entry.opening) {
              openings += 1;
              await step("eski açılışı düzelt", api.put(`/api/workspace/plans/${plan.id}/entries/${entry.id}`, { amount: String(Number(entry.amount) - 50) }));
            }
          }
        }
        assert.equal(refunds, 1, `${label}: taksit iadesi`);
        assert.equal(openings, 2, `${label}: Excel açılışları`);
        const stock = (await api.get("/api/workspace/stock?limit=500")).data;
        const item = (stock.items || stock).find(row => String(row.code || "") === `STK-2.0.26-${company.code}-T`);
        assert.ok(item, `${label}: stok kartı`);
        const moves = (await step("stok kartı", api.get(`/api/workspace/stock/${item.id}`))).moves || [];
        const cashSale = moves.find(move => move.kind === "out" && move.pay === "cash" && move.method === "cash");
        const bankSale = moves.find(move => move.kind === "out" && move.pay === "cash" && move.method === "bank");
        const bankBuy = moves.find(move => move.kind === "in" && move.pay === "cash" && move.method === "bank");
        assert.ok(cashSale && bankSale && bankBuy, `${label}: peşin stok hareketleri`);
        await step("eski havale alışını düzelt", api.put(`/api/workspace/stock/${item.id}/moves/${bankBuy.id}`, { unitPrice: "85", cashForce: true }));
        await step("eski nakit satışı düzelt", api.put(`/api/workspace/stock/${item.id}/moves/${cashSale.id}`, { qty: "3", cashForce: true }));
        await step("eski havale satışını sil", api.del(`/api/workspace/stock/${item.id}/moves/${bankSale.id}?cashForce=1`));
        const end = failures((await api.get("/api/workspace/ledger/integrity")).data);
        assert.deepEqual(end, start, `${label}: Mutabakat Testi'nde yeni sapma`);
      }
      await api.post("/api/companies/select", { id: "sirket-001" });
      await server.close();
      server = null;
      // İşlemlerle yazılan her para satırı olaylı (K6): işaretin üstündeki satırlarda boş event_id yok.
      for (const [id, company] of companies) {
        const file = companyDbFile(fixture.dataDir, (readRegistry(fixture.dataDir) || []).find(entry => entry.id === id) || { id, dir: "" });
        const db = new DatabaseSync(file, { readOnly: true });
        try {
          for (const table of MONEY_TABLES) {
            const rows = db.prepare(`SELECT COUNT(*) AS n FROM ${table} WHERE rowid > ? AND COALESCE(event_id, '') = '' AND ${moneyWhere(table)}`).get(marks[id][table]).n;
            assert.equal(rows, 0, `${company.code} ${table}: işlemlerle yazılan olaysız para satırı`);
          }
        } finally {
          db.close();
        }
      }
    } finally {
      await server?.close().catch(() => {});
      fixture.cleanup();
    }
  });
});
