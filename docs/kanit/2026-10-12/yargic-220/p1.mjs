// Yargıç 2.2.0 — p1: POS para doğruluğu + yetki + eşzamanlılık + istek kimliği + dönem kilidi (Bekleyenleri Taşı).
// Beklenen sayılar plan §4.2/§4.3/§4.6 tablolarından ve §9.1'den (programın kodundan türetilmez). Sahte saat 08.10.2026.
// Koşu: node docs/kanit/2026-10-12/yargic-220/p1.mjs
import { apiOf } from "../../../../test/banka-210-ortak.mjs";
import { BANK, bootBank, must, openAcceptanceAccounts, subBalances, trialBalances } from "../../../../test/banka-210-hesap-ortak.mjs";
import { createUser } from "../../../../test/helpers.mjs";

const out = [];
const check = (id, label, expected, actual) => {
  const ok = JSON.stringify(expected) === JSON.stringify(actual);
  out.push({ id, ok, label, expected, actual });
  console.log(`${ok ? "UYDU " : "FARK "} [${id}] ${label} :: beklenen=${JSON.stringify(expected)} gerçek=${JSON.stringify(actual)}`);
};
const pos = (api, accId, extra = {}) =>
  must("POS", api.post(`${BANK}/pos`, {
    name: "Ziraat Fiziki POS", bankAccountId: accId, kind: "physical", providerKind: "bank", tax: "bsmv_incl", valorRule: "business", valorDays: 2, installmentPayout: "monthly",
    provisionDays: 0, refundCommission: "none", merchantNo: "123456789", terminalNo: "T001", validFrom: "2026-10-01",
    rates: [{ installments: 1, rate: "2,5" }, { installments: 3, rate: "3,5" }], ...extra,
  })).then(d => d.pos);
const integ = async api => {
  const r = await must("mutabakat", api.get("/api/workspace/ledger/integrity"));
  return { ok: r.ok, failures: (r.failures || []).map(f => f.code || f.label).slice(0, 8) };
};
const bal = async (api, id) => (await must("hesap", api.get(`${BANK}/accounts/${id}`))).balanceMinor / 100;

// ---------- A: yetki — personel (accounts.manage, bank.move YOK) POS İadesi yapabiliyor mu (plan §9.1: POS iadesi bank.move) ----------
{
  const ctx = await bootBank();
  const acc = await openAcceptanceAccounts(ctx.api);
  await must("POS Kullan", ctx.api.put(`${BANK}/accounts/${acc.ziraat.id}`, { usePos: true }));
  await pos(ctx.api, acc.ziraat.id);
  const party = await must("cari", ctx.api.post("/api/workspace/accounts", { name: "ABC Ltd.", type: "customer", registeredOn: "2026-10-01" }));
  await must("POS tahsilatı", ctx.api.post(`/api/workspace/accounts/${party.id}/entries`, { kind: "in", amount: "10.000", method: "card", date: "2026-10-08" }));
  const sale = (await must("satışlar", ctx.api.get(`${BANK}/pos/sales?kind=sale`))).sales[0];
  const staff = apiOf(await createUser(ctx.server, ctx.api.client, { username: "y-personel", role: "personel" }));
  // valörden sonra (banka parası çıkar)
  ctx.server.clock.set("2026-10-13T12:00:00+03:00");
  await must("aktar", ctx.api.post(`${BANK}/settle`, {}));
  const before = await bal(ctx.api, acc.ziraat.id);
  check("A0", "Ziraat valör sonrası (100.000 + 9.750)", 109750, before);
  const r1 = await staff.post(`${BANK}/pos/sales/${sale.id}/refund`, { amount: "1.000", date: "2026-10-13" });
  check("A1", "personel POS İadesi uç (§9.1 bank.move ister) durum", 403, r1.status);
  const r2 = await staff.post(`/api/workspace/accounts/${party.id}/entries`, { kind: "out", amount: "500", method: "card", date: "2026-10-13", posRefundOf: sale.id });
  check("A2", "personel cari 'POS İadesi' (out, card) durum", 403, r2.status);
  ctx.server.clock.set("2026-10-16T12:00:00+03:00");
  await must("aktar", ctx.api.post(`${BANK}/settle`, {}));
  const after = await bal(ctx.api, acc.ziraat.id);
  check("A3", "Ziraat bakiyesi personel denemelerinden sonra (değişmemeli)", before, after);
  const refunds = (await must("iadeler", ctx.api.get(`${BANK}/pos/sales?kind=refund`))).sales;
  check("A4", "personelin yazdığı iade sayısı", 0, refunds.length);
  out.push({ id: "A-detay", r1: [r1.status, r1.code, r1.error], r2: [r2.status, r2.code, r2.error], refunds: refunds.map(r => [r.grossMinor, r.createdBy || r.created_by]) });
  check("A5", "Mutabakat Testi", true, (await integ(ctx.api)).ok);
  await ctx.server.close();
}

// ---------- B: aynı anda iki iade (6.000 + 6.000 > 10.000) ve istek kimliği tekrarı ----------
{
  const ctx = await bootBank();
  const acc = await openAcceptanceAccounts(ctx.api);
  await must("POS Kullan", ctx.api.put(`${BANK}/accounts/${acc.ziraat.id}`, { usePos: true }));
  await pos(ctx.api, acc.ziraat.id);
  const party = await must("cari", ctx.api.post("/api/workspace/accounts", { name: "ABC Ltd.", type: "customer", registeredOn: "2026-10-01" }));
  await must("POS tahsilatı", ctx.api.post(`/api/workspace/accounts/${party.id}/entries`, { kind: "in", amount: "10.000", method: "card", date: "2026-10-08" }));
  const sale = (await must("satışlar", ctx.api.get(`${BANK}/pos/sales?kind=sale`))).sales[0];
  const [a, b] = await Promise.all([
    ctx.api.post(`${BANK}/pos/sales/${sale.id}/refund`, { amount: "6.000", date: "2026-10-08" }),
    ctx.api.post(`${BANK}/pos/sales/${sale.id}/refund`, { amount: "6.000", date: "2026-10-08" }),
  ]);
  check("B1", "aynı anda iki 6.000 iade: durumlar (biri 200, biri 409)", [200, 409], [a.status, b.status].sort());
  const RQ = crypto.randomUUID();
  const r3 = await ctx.api.post(`${BANK}/pos/sales/${sale.id}/refund`, { amount: "1.000", date: "2026-10-08", requestId: RQ });
  const r4 = await ctx.api.post(`${BANK}/pos/sales/${sale.id}/refund`, { amount: "1.000", date: "2026-10-08", requestId: RQ });
  const r5 = await ctx.api.post(`${BANK}/pos/sales/${sale.id}/refund`, { amount: "2.000", date: "2026-10-08", requestId: RQ });
  check("B2", "aynı istek kimliği 2. kez: 200 + replayed", [200, true], [r4.status, r4.data?.replayed === true]);
  check("B3", "aynı kimlik farklı gövde: 409", 409, r5.status);
  const refunds = (await must("iadeler", ctx.api.get(`${BANK}/pos/sales?kind=refund`))).sales;
  check("B4", "toplam iade (6.000 + 1.000)", 7000, refunds.reduce((s, r) => s + r.grossMinor, 0) / 100);
  ctx.server.clock.set("2026-10-12T12:00:00+03:00");
  await must("aktar", ctx.api.post(`${BANK}/settle`, {}));
  // plan §4.6 tablosu (İade Edilmez, valörden önce): kalan brüt 3.000, komisyon 250 → net 2.750
  check("B5", "Ziraat 12.10 (100.000 + 3.000 − 250)", 102750, await bal(ctx.api, acc.ziraat.id));
  const tb = await trialBalances(ctx.api);
  check("B6", "mizan 108 / 653 / 120 (carisiz-faturasız tahsilat: 120 = −10.000 + 7.000)", [0, 250, -3000], [tb["108"] ?? 0, tb["653"] ?? 0, tb["120"] ?? 0]);
  const cari = await must("cari", ctx.api.get(`/api/workspace/accounts/${party.id}`));
  out.push({ id: "B-cari", cari: cari.balance ?? cari.account?.balance });
  check("B7", "Mutabakat Testi", true, (await integ(ctx.api)).ok);
  await ctx.server.close();
}

// ---------- C: kilitli dönemdeki satışın bekleyenlerini yeni hesaba taşı (pos_sales.bank_account_id kilit izinde) ----------
{
  const ctx = await bootBank();
  const acc = await openAcceptanceAccounts(ctx.api);
  for (const a of [acc.ziraat, acc.garanti]) await must("POS Kullan", ctx.api.put(`${BANK}/accounts/${a.id}`, { usePos: true }));
  const p = await pos(ctx.api, acc.ziraat.id);
  const party = await must("cari", ctx.api.post("/api/workspace/accounts", { name: "ABC Ltd.", type: "customer", registeredOn: "2026-10-01" }));
  await must("POS 3 taksit", ctx.api.post(`/api/workspace/accounts/${party.id}/entries`, { kind: "in", amount: "12.000", method: "card", installments: 3, date: "2026-10-05" }));
  ctx.server.clock.set("2026-10-20T12:00:00+03:00");
  const lock = await ctx.api.put("/api/admin/period-lock", { lockedUntil: "2026-10-10" });
  check("C1", "kilit 10.10 (taksit valörleri Kasım+, bekleyen vadesi gelmemiş)", 200, lock.status);
  const i0 = await integ(ctx.api);
  check("C2", "kilitten sonra Mutabakat", true, i0.ok);
  const mv = await ctx.api.post(`${BANK}/pos/${p.id}/move-pending`, { bankAccountId: acc.garanti.id });
  out.push({ id: "C-mv", status: mv.status, code: mv.code, error: mv.error, data: mv.data?.moved });
  const i1 = await integ(ctx.api);
  check("C3", "Bekleyenleri Taşı sonrası Mutabakat (kilitli satış): ya 409 ile reddedilir ya da sahte fark doğmaz", true, mv.status !== 200 ? true : i1.ok);
  out.push({ id: "C-integ", i1, integrityLog: ctx.store.all("SELECT * FROM integrity_log").map(r => JSON.stringify(r).slice(0, 300)) });
  // kalemler Garanti'ye mi gidiyor
  ctx.server.clock.set("2026-11-12T12:00:00+03:00");
  await must("aktar", ctx.api.post(`${BANK}/settle`, {}));
  out.push({ id: "C-bal", ziraat: await bal(ctx.api, acc.ziraat.id), garanti: await bal(ctx.api, acc.garanti.id) });
  const i2 = await integ(ctx.api);
  check("C4", "Kasım valöründen sonra Mutabakat", true, i2.ok);
  out.push({ id: "C-integ2", i2 });
  await ctx.server.close();
}

// ---------- D: kilitli döneme iade, kilitli satışın Oransal kısmi iadesi (açık dönemde) ----------
{
  const ctx = await bootBank();
  const acc = await openAcceptanceAccounts(ctx.api);
  await must("POS Kullan", ctx.api.put(`${BANK}/accounts/${acc.ziraat.id}`, { usePos: true }));
  await pos(ctx.api, acc.ziraat.id, { refundCommission: "proportional" });
  const party = await must("cari", ctx.api.post("/api/workspace/accounts", { name: "ABC Ltd.", type: "customer", registeredOn: "2026-10-01" }));
  await must("POS 3 taksit", ctx.api.post(`/api/workspace/accounts/${party.id}/entries`, { kind: "in", amount: "12.000", method: "card", installments: 3, date: "2026-10-05" }));
  const sale = (await must("satışlar", ctx.api.get(`${BANK}/pos/sales?kind=sale`))).sales[0];
  ctx.server.clock.set("2026-10-20T12:00:00+03:00");
  await must("kilit", ctx.api.put("/api/admin/period-lock", { lockedUntil: "2026-10-10" }));
  const rl = await ctx.api.post(`${BANK}/pos/sales/${sale.id}/refund`, { amount: "1.000", date: "2026-10-09" });
  check("D1", "kilitli tarihe iade 409", 409, rl.status);
  const ro = await ctx.api.post(`${BANK}/pos/sales/${sale.id}/refund`, { amount: "5.000", date: "2026-10-20" });
  check("D2", "açık tarihe 5.000 Oransal iade (kilitli satışın bekleyen kalemleri)", 200, ro.status);
  out.push({ id: "D-ro", status: ro.status, code: ro.code, error: ro.error });
  const i1 = await integ(ctx.api);
  check("D3", "Mutabakat (kilit izi bozulmamalı)", true, i1.ok);
  out.push({ id: "D-integ", i1 });
  // bağımsız beklenen: 12.000, %3,5 → kom 420; 3 kalem 4.000/140/3.860. 5.000 iade sondan başa: 3. kalem 4.000→0, 2. kalem 4.000→3.000.
  // Oransal kom. iadesi round(420 × 5.000/12.000) = 175 → kalan kom. 245. Kalan brüt 7.000 → net toplam 7.000 − 245 = 6.755.
  for (const d of ["2026-11-12", "2026-12-14", "2027-01-12"]) {
    ctx.server.clock.set(`${d}T12:00:00+03:00`);
    await must("aktar", ctx.api.post(`${BANK}/settle`, {}));
  }
  check("D4", "Ziraat son (100.000 + 6.755)", 106755, await bal(ctx.api, acc.ziraat.id));
  const tb = await trialBalances(ctx.api);
  check("D5", "mizan 108 / 653", [0, 245], [tb["108"] ?? 0, tb["653"] ?? 0]);
  check("D6", "son Mutabakat", true, (await integ(ctx.api)).ok);
  await ctx.server.close();
}

console.log("\nÖZET", out.filter(o => o.ok === false).length, "fark /", out.filter(o => "ok" in o).length, "denetim");
console.log(JSON.stringify(out.filter(o => !("ok" in o)), null, 1));
process.exit(0);
