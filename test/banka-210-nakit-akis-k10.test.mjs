// 2.1.0 temel sürüm — Nakit Akış başlangıcı (K10; plan §8.4, §8.9, karar 32): "Bugünkü Nakit ve Banka" = Nakit Kasa (bugüne kadar) + Gerçek Banka
// (Σ 102, hesaba atanmış); Hesabı Atanmamış Eski Hareketler (102.00 + 108.00) ayrı satır, başlangıca girmez. Bağımsız beklenen: testin kendi
// defteri (açılış, nakit, havale tutarları elle yazıldı).
// Nasıl bozarım:
//   (1) bankasız kurulum: eski havale (hesapsız) başlangıca girmez (plan §10.5 "K10 görünüm değişikliği"); Nakit Kasa = ANLIK DURUM Kasa.
//   (2) eski sürümden kalan İLERİ TARİHLİ hesapsız havale (v2.0.23'e kadar çek/senet bankaya ileri tarihle tahsil edilebiliyordu; gerçek v2.0.23
//       koduyla üretimi docs/kanit/2026-10-10/t4-nakit-akis/ileri-tarihli-eski-havale-v2023.mjs): başlangıca girmez, akışta kendi gününde BİR KEZ
//       yer alır (çift sayım yok). Bugünkü kod ileri tarihli banka satırı yazmadığı için satır veri tabanına doğrudan yazılır.
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { after, before, describe, it } from "node:test";
import { bootBank, must, openAccount } from "./banka-210-hesap-ortak.mjs";
import { rawRun } from "./banka-210-ortak.mjs";

const AHEAD = "2026-10-18"; // sahte saat 08.10.2026 (banka-210-hesap-ortak NOW)

describe("Nakit Akış başlangıcı (K10): bankasız kurulum", () => {
  let ctx;
  before(async () => {
    ctx = await bootBank();
    const party = await must("cari", ctx.api.post("/api/workspace/accounts", { name: "Eski Müşteri", type: "customer", registeredOn: "2026-09-01" }));
    await must("nakit", ctx.api.post(`/api/workspace/accounts/${party.id}/entries`, { kind: "in", amount: "500", date: "2026-10-02", method: "cash" }));
    // Banka hesabı yokken girilen havale (eski sürüm gibi; Hesabı Atanmamış 102.00).
    await must("hesapsız havale", ctx.api.post(`/api/workspace/accounts/${party.id}/entries`, { kind: "in", amount: "300", date: "2026-10-03", method: "bank" }));
  });
  after(() => ctx.server.close());

  it("başlangıç = Nakit Kasa 500; hesapsız havale 300 başlangıca girmez, ayrı satırda; ANLIK DURUM Kasa ile aynı", async () => {
    const flow = await must("nakit akış", ctx.api.get("/api/workspace/overview/nakit-akisi?preset=next30&table=0"));
    assert.equal(flow.cashToday, 500, "başlangıç yalnız nakit (Gerçek Banka tanımlanmadı)");
    assert.deepEqual([flow.start?.cash, flow.start?.realBank, flow.start?.defined, flow.start?.unassigned], [500, 0, false, 300]);
    const overview = await must("ANLIK DURUM", ctx.api.get("/api/workspace/overview"));
    assert.equal(overview.cash.balance, flow.cashToday, "ANLIK DURUM Nakit Kasa = başlangıç");
    assert.equal(overview.cash.bank.unassigned.total, 300, "ANLIK DURUM Hesabı Atanmamış 300");
  });
});

describe("Nakit Akış başlangıcı (K10): ileri tarihli eski hesapsız havale başlangıca girmez, akışta bir kez", () => {
  let ctx;
  before(async () => {
    ctx = await bootBank();
    await openAccount(ctx.api, { bankName: "Ziraat Bankası", name: "Ana TL Hesabı", kind: "demand", opening: { date: "2026-10-01", amount: "10.000", confirmed: true } });
    await must("nakit giriş", ctx.api.post("/api/workspace/cash", { kind: "in", amount: "2.000", date: "2026-10-05", description: "Nakit" }));
    rawRun(ctx.db, "INSERT INTO cash_entries (id, kind, amount, date, description, method, created_by, created_at) VALUES (?, 'out', 1000, ?, 'Kira (havale, ileri tarihli)', 'bank', 'test', ?)", randomUUID(), AHEAD, new Date().toISOString());
  });
  after(() => ctx.server.close());

  it("başlangıç = Nakit 2.000 + Gerçek Banka 10.000 = 12.000; kira −1.000 akışta bir kez (18.10), dönem sonu 11.000", async () => {
    const flow = await must("nakit akış", ctx.api.get("/api/workspace/overview/nakit-akisi?preset=next30&table=0"));
    assert.equal(flow.cashToday, 12000, `başlangıç ${flow.cashToday}`);
    assert.deepEqual([flow.start?.cash, flow.start?.realBank, flow.start?.unassigned], [2000, 10000, -1000], "kırılım: Hesabı Atanmamış ayrı (başlangıca girmez)");
    const rent = flow.rows.filter(item => item.date === AHEAD && item.direction === "out" && item.amount === 1000);
    assert.equal(rent.length, 1, `ileri tarihli kira akışta bir kez: ${JSON.stringify(flow.rows.map(item => [item.date, item.direction, item.amount, item.label]))}`);
    assert.equal(flow.closing, 11000, "dönem sonu = 12.000 − 1.000");
    assert.equal(flow.lowest.balance, 11000, "en düşük tahmini");
    const overview = await must("ANLIK DURUM", ctx.api.get("/api/workspace/overview"));
    assert.equal(overview.cash.balance + overview.cash.bank.balance, flow.cashToday, "ANLIK DURUM Nakit + Gerçek Banka = başlangıç");
  });
});
