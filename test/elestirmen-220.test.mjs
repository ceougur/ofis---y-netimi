// 2.2.0 bağımsız eleştirmen bulguları (docs/kanit/2026-10-12/elestirmen-220/e2, e4, e5, e6). Beklenen sayılar planın önceden yazılmış
// tablolarından (§4.2 BSMV Dahil %2,5: 10.000 → kom. 250, net 9.750; §4.6 Komisyon Tahsili / valörden sonra iade; §4.7 takvim; §9.1 yetki) —
// program kodundan türetilmez.
//   E-1/E-2  POS Ödeme Takvimi ve ANLIK DURUM'da tür kalemin rolünden: aynı gün POS · Blokeli POS · Komisyon Tahsili ayrı satır; valörden sonraki
//            iade Komisyon Tahsili değildir.
//   E-3      2.1.0'a dönülüp POS tahsilatının tutarı değiştirilince satış "Onarım Bekliyor"; o POS'un öbür satışları bankaya geçmeye devam eder.
//   E-4      Bekleyen POS kalemi olan hesap pasife alınamaz (409; önce Bekleyenleri Yeni Hesaba Taşı).
//   E-5      Kasa yanıtı banka bakiyesini (byMethod.bank) bank.view yetkisi olmayana vermez.
import assert from "node:assert/strict";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { describe, it } from "node:test";
import { createUser } from "./helpers.mjs";
import { apiOf } from "./banka-210-ortak.mjs";
import { BANK, balanceOf, bootBank, expectStatus, flagPos, kurus, must, openAcceptanceAccounts, openPos, posCheck, settle, ziraatPos } from "./banka-220-pos-ortak.mjs";
import { CURRENT, bootVersion, tagsAvailable } from "./guvenilirlik/surumler.mjs";

const setDay = (ctx, day) => ctx.server.clock.set(`${day}T12:00:00+03:00`);
const single = (bankAccountId, extra = {}) => ziraatPos(bankAccountId, { rates: [{ installments: 1, rate: "2,5" }], ...extra });

describe("Eleştirmen E-1/E-2: POS Ödeme Takvimi ve ANLIK DURUM'da tür kalemin rolünden", () => {
  it("C1: 09.11'de POS 9.750 · Blokeli POS 9.750 · Komisyon Tahsili −250 ayrı satır; Komisyon Tahsili 250; aktarım sonrası Ziraat +19.250", async () => {
    const ctx = await bootBank();
    try {
      const acc = await openAcceptanceAccounts(ctx.api);
      const normal = await openPos(ctx.api, single(acc.ziraat.id));
      const blocked = await openPos(ctx.api, single(acc.ziraat.id, { name: "Bloke POS", merchantNo: "987654321", terminalNo: "T002", blockDays: 30 }));
      const party = await must("cari", ctx.api.post("/api/workspace/accounts", { name: "ABC Ltd.", type: "customer", registeredOn: "2026-10-01" }));
      await must("bloke satış", ctx.api.post(`/api/workspace/accounts/${party.id}/entries`, { kind: "in", amount: "10.000", method: "card", posId: blocked.id, date: "2026-10-08" }));
      setDay(ctx, "2026-11-05");
      await must("satış A", ctx.api.post(`/api/workspace/accounts/${party.id}/entries`, { kind: "in", amount: "10.000", method: "card", posId: normal.id, date: "2026-11-05" }));
      await must("satış B", ctx.api.post(`/api/workspace/accounts/${party.id}/entries`, { kind: "in", amount: "10.000", method: "card", posId: normal.id, date: "2026-11-05", similarOk: true }));
      const saleB = (await must("satışlar", ctx.api.get(`${BANK}/pos/sales?kind=sale`))).sales.filter(sale => sale.posId === normal.id).sort((a, b) => (a.eventNo < b.eventNo ? 1 : -1))[0];
      await must("satış B tam iade (valörden önce, İade Edilmez)", ctx.api.post(`${BANK}/pos/sales/${saleB.id}/refund`, { amount: "10.000", date: "2026-11-05" }));
      const cal = await must("takvim", ctx.api.get(`${BANK}/pos/calendar`));
      assert.deepEqual(cal.rows.map(row => [row.valueDate, row.kindLabel, row.netMinor]).sort(), [["2026-11-09", "Blokeli POS", kurus(9750)], ["2026-11-09", "Komisyon Tahsili", -kurus(250)], ["2026-11-09", "POS", kurus(9750)]]);
      assert.deepEqual([cal.totals.totalMinor, cal.totals.feeMinor], [kurus(19250), kurus(250)]);
      const summary = await must("özet", ctx.api.get(`${BANK}/summary`));
      assert.deepEqual([summary.posPending.netMinor, summary.posPending.blockedMinor, summary.posPending.feeMinor], [kurus(9500), kurus(9750), kurus(250)], "POS Bekleyen (Net) 9.500 · Blokeli 9.750 · Komisyon Tahsili 250");
      const before = await balanceOf(ctx.api, acc.ziraat.id);
      setDay(ctx, "2026-11-09");
      await settle(ctx.api);
      assert.equal((await balanceOf(ctx.api, acc.ziraat.id)) - before, kurus(19250));
      await posCheck(ctx.api, "C1");
    } finally {
      await ctx.server.close();
    }
  });

  it("C2: valörden SONRA 3.000 iade → bekleyen iade kalemi Komisyon Tahsili değil (takvim ve ANLIK DURUM 0); nakit akışında posFee yok", async () => {
    const ctx = await bootBank();
    try {
      const acc = await openAcceptanceAccounts(ctx.api);
      await openPos(ctx.api, single(acc.ziraat.id));
      const party = await must("cari", ctx.api.post("/api/workspace/accounts", { name: "ABC Ltd.", type: "customer", registeredOn: "2026-10-01" }));
      await must("satış", ctx.api.post(`/api/workspace/accounts/${party.id}/entries`, { kind: "in", amount: "10.000", method: "card", date: "2026-10-08" }));
      const sale = (await must("satışlar", ctx.api.get(`${BANK}/pos/sales?kind=sale`))).sales[0];
      setDay(ctx, "2026-10-12");
      await settle(ctx.api);
      await must("valörden sonra iade", ctx.api.post(`${BANK}/pos/sales/${sale.id}/refund`, { amount: "3.000", date: "2026-10-12" }));
      const cal = await must("takvim", ctx.api.get(`${BANK}/pos/calendar`));
      assert.ok(!cal.rows.some(row => row.kind === "fee" || row.kindLabel === "Komisyon Tahsili"), JSON.stringify(cal.rows));
      assert.equal(cal.totals.feeMinor, 0);
      assert.equal(cal.totals.totalMinor, -kurus(3000), "iade bankadan çıkacak 3.000");
      assert.equal((await must("özet", ctx.api.get(`${BANK}/summary`))).posPending.feeMinor, 0);
      const overview = await must("Genel Bakış", ctx.api.get("/api/workspace/overview"));
      assert.ok(!JSON.stringify(overview).includes('"source":"posFee"'), "nakit akışında Komisyon Tahsili kaynağı yok");
      await posCheck(ctx.api, "C2");
    } finally {
      await ctx.server.close();
    }
  });
});

describe("Eleştirmen E-4: bekleyen POS kalemi olan hesap pasife alınamaz", () => {
  it("05.10 taksitli satış (Ziraat'e geçecek) → POS Garanti'ye bağlansa da Ziraat Pasife Al 409; Bekleyenleri Taşı'dan sonra pasife alınır; Ziraat değişmez", async () => {
    const ctx = await bootBank();
    try {
      const acc = await openAcceptanceAccounts(ctx.api);
      await flagPos(ctx.api, acc.garanti.id);
      const pos = await openPos(ctx.api, ziraatPos(acc.ziraat.id));
      const party = await must("cari", ctx.api.post("/api/workspace/accounts", { name: "ABC Ltd.", type: "customer", registeredOn: "2026-10-01" }));
      await must("POS 3 taksit", ctx.api.post(`/api/workspace/accounts/${party.id}/entries`, { kind: "in", amount: "12.000", method: "card", installments: 3, date: "2026-10-05" }));
      const ziraat0 = await balanceOf(ctx.api, acc.ziraat.id);
      setDay(ctx, "2026-10-20");
      await must("POS → Garanti", ctx.api.put(`${BANK}/pos/${pos.id}`, { bankAccountId: acc.garanti.id }));
      await must("Ziraat POS Kullan kapat", ctx.api.put(`${BANK}/accounts/${acc.ziraat.id}`, { usePos: false }));
      const refused = await ctx.api.post(`${BANK}/accounts/${acc.ziraat.id}/status`, { status: "passive" });
      expectStatus(refused, 409, "bank-pos-pending", "bekleyen POS'u olan Ziraat pasife");
      assert.match(refused.error, /Bekleyenleri Yeni Hesaba Taşı/);
      assert.equal((await must("Ziraat", ctx.api.get(`${BANK}/accounts/${acc.ziraat.id}`))).status, "active", "reddedilen istek durumu değiştirmedi");
      await must("Bekleyenleri Taşı", ctx.api.post(`${BANK}/pos/${pos.id}/move-pending`, { bankAccountId: acc.garanti.id }));
      await must("Ziraat Pasife Al", ctx.api.post(`${BANK}/accounts/${acc.ziraat.id}/status`, { status: "passive" }));
      setDay(ctx, "2027-01-12");
      await settle(ctx.api);
      assert.equal(await balanceOf(ctx.api, acc.ziraat.id), ziraat0, "pasif Ziraat'e para yazılmadı");
      await posCheck(ctx.api, "E-4");
    } finally {
      await ctx.server.close();
    }
  });
});

describe("Eleştirmen E-5: Kasa yanıtı banka bakiyesini bank.view yetkisi olmayana vermez", () => {
  it("bank.view kaldırılmış muhasebe: /api/workspace/cash yanıtında byMethod.bank yok, 123.456,78 hiçbir alanda yok; yönetici görür", async () => {
    const ctx = await bootBank();
    try {
      await must("hesap", ctx.api.post(`${BANK}/accounts`, { bankName: "Ziraat Bankası", name: "Ana TL", kind: "demand", currency: "TRY", opening: { date: "2026-10-01", amount: "123.456,78", confirmed: true } }));
      const client = await createUser(ctx.server, ctx.api.client, { username: "e5-muh", role: "muhasebe" });
      const users = await ctx.api.client.get("/api/admin/users");
      const list = users.data?.data?.users || users.data?.users || users.data?.data || [];
      const target = list.find(user => user.username === "e5-muh");
      assert.equal((await ctx.api.client.patch(`/api/admin/users/${target.id}`, { grants: { add: [], remove: ["bank.view", "bank.reports"] } })).status, 200);
      const staff = apiOf(client);
      expectStatus(await staff.get(`${BANK}/summary`), 403, undefined, "banka özeti yetkisiz");
      const cash = await must("Kasa (muhasebe)", staff.get("/api/workspace/cash"));
      assert.equal("bank" in cash.byMethod, false, "byMethod.bank yok");
      assert.ok(!JSON.stringify(cash).includes("123456.78"), "banka bakiyesi yanıtta yok");
      assert.equal((await must("Kasa (yönetici)", ctx.api.get("/api/workspace/cash"))).byMethod.bank, 123456.78, "yönetici görür");
    } finally {
      await ctx.server.close();
    }
  });
});

// E-3 — gerçek v2.1.0 koduna dönüş (git etiketi; sığ klonda atlanır). Plan §10.6/g; Y4 (eski sürümün değiştirdiği satışın parası) BİLİNEN SINIR.
const OLD = "v2.1.0";
describe(`Eleştirmen E-3: ${OLD}'a dönüp POS tahsilatının tutarı değiştirilince satış Onarım Bekliyor; öbür satışlar aktarılır`, { skip: tagsAvailable([OLD]) ? false : `${OLD} etiketi yok` }, () => {
  it("10.000 POS tahsilatı v2.1.0'da 8.000'e → repair + neden; Mutabakat tamam; dönüşten sonraki 1.000 satış valörde Ziraat'e (+975)", { timeout: 300_000 }, async () => {
    const root = mkdtempSync(path.join(tmpdir(), "elestirmen-e3-"));
    const dirs = { dataDir: path.join(root, "data"), backupDir: path.join(root, "backups") };
    try {
      let ids;
      {
        const server = await bootVersion(CURRENT, { ...dirs, now: "2026-10-08T12:00:00+03:00" });
        try {
          const api = apiOf((await server.login()).client);
          const ziraat = await must("hesap", api.post(`${BANK}/accounts`, { bankName: "Ziraat Bankası", name: "Ana TL Hesabı", kind: "demand", currency: "TRY", opening: { date: "2026-10-01", amount: "100.000", confirmed: true } }));
          await openPos(api, single(ziraat.id));
          const party = await must("cari", api.post("/api/workspace/accounts", { name: "ABC Ltd.", type: "customer", registeredOn: "2026-10-01" }));
          const entry = await must("POS 10.000", api.post(`/api/workspace/accounts/${party.id}/entries`, { kind: "in", amount: "10.000", method: "card", date: "2026-10-08" }));
          ids = { ziraat: ziraat.id, party: party.id, entry: entry.entryId };
        } finally {
          await server.close();
        }
      }
      {
        const old = await bootVersion(OLD, { ...dirs, now: "2026-10-09T12:00:00+03:00" });
        try {
          const api = apiOf((await old.login()).client);
          await must("v2.1.0 düzelt 10.000 → 8.000", api.put(`/api/workspace/accounts/${ids.party}/entries/${ids.entry}`, { amount: "8.000" }));
        } finally {
          await old.close();
        }
      }
      let before;
      {
        const server = await bootVersion(CURRENT, { ...dirs, now: "2026-10-09T12:00:00+03:00" });
        try {
          const api = apiOf((await server.login()).client);
          const [sale] = (await must("satışlar", api.get(`${BANK}/pos/sales?kind=sale`))).sales;
          assert.equal(sale.status, "repair", "satış Onarım Bekliyor");
          const repair = JSON.parse(server.app.store.setting("meta.bank.repair", "{}"));
          const why = (repair.pending || []).find(item => item.id === sale.id);
          assert.ok(why && /silip doğru tutarla yeniden girin/.test(why.reason), `neden görünür: ${JSON.stringify(repair.pending)}`);
          await posCheck(api, "dönüşten sonra");
          before = await balanceOf(api, ids.ziraat);
          await must("yeni POS satışı 1.000", api.post(`/api/workspace/accounts/${ids.party}/entries`, { kind: "in", amount: "1.000", method: "card", date: "2026-10-09", similarOk: true }));
        } finally {
          await server.close();
        }
      }
      const server = await bootVersion(CURRENT, { ...dirs, now: "2026-10-13T12:00:00+03:00" });
      try {
        const api = apiOf((await server.login()).client);
        await settle(api);
        assert.equal((await balanceOf(api, ids.ziraat)) - before, kurus(975), "yeni satış aktarıldı (1.000 − 25)");
        assert.equal((await must("özet", api.get(`${BANK}/summary`))).posPending.due.count, 0, "Onarım Bekliyor satış 'aktarılmadı' sayılmaz");
        await posCheck(api, "aktarım sonrası");
      } finally {
        await server.close();
      }
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });
});
