// Eleştirmen 2.2.0 — e2: (C) POS Ödeme Takvimi / ANLIK DURUM: blokeli + Komisyon Tahsili + normal kalem AYNI gün; valörden sonra iade kalemi.
//                      (R) yedekten geri yükleme ile bekleyen POS kalemi.
// Beklenen (plan §4.7): "Takvim bekleyen kalemleri valör gününe göre NET gösterir; blokeli kalemler ve Komisyon Tahsili kalemleri AYRI satırda."
// §4.6: Komisyon Tahsili = neti eksiye düşen kalem için açılan `fee` kalemi; valörden sonra iade = `refund` kalemi (Komisyon Tahsili DEĞİL).
// §4.4/1–5: (POS, gün) başına tek net fiş; GET yazmaz; her gün kendi tarihiyle. Yedek tatbikatı (CLAUDE.md): yedek → çalış → geri yükle → sayılar.
// Sahte saat. Koşu: node docs/kanit/2026-10-12/elestirmen-220/e2-takvim-geri-yukle.mjs
import { BANK, bootBank, must, openAcceptanceAccounts, subBalances } from "../../../../test/banka-210-hesap-ortak.mjs";
import { ADMIN_PASSWORD } from "../../../../test/helpers.mjs";

const out = [];
const check = (id, label, expected, actual) => {
  const ok = JSON.stringify(expected) === JSON.stringify(actual);
  out.push({ id, ok });
  console.log(`${ok ? "UYDU " : "FARK "} [${id}] ${label} :: beklenen=${JSON.stringify(expected)} gerçek=${JSON.stringify(actual)}`);
};
const posBody = (accId, extra = {}) => ({
  name: "Ziraat Fiziki POS", bankAccountId: accId, kind: "physical", providerKind: "bank", tax: "bsmv_incl", valorRule: "business", valorDays: 2, installmentPayout: "monthly",
  provisionDays: 0, refundCommission: "none", merchantNo: "123456789", terminalNo: "T001", validFrom: "2026-10-01", rates: [{ installments: 1, rate: "2,5" }], ...extra,
});
const setDay = (ctx, d) => ctx.server.clock.set(`${d}T12:00:00+03:00`);
const bal = async (ctx, id) => (await must("hesap", ctx.api.get(`${BANK}/accounts/${id}`))).balanceMinor / 100;
const integ = async ctx => {
  const r = await must("mutabakat", ctx.api.get("/api/workspace/ledger/integrity"));
  return r.ok ? true : (r.failures || []).map(f => f.code || f.label).slice(0, 5);
};

// ---------- C1: aynı gün (09.11.2026) normal + Komisyon Tahsili (aynı POS) + blokeli (başka POS) ----------
{
  const ctx = await bootBank();
  const acc = await openAcceptanceAccounts(ctx.api);
  await must("POS Kullan", ctx.api.put(`${BANK}/accounts/${acc.ziraat.id}`, { usePos: true }));
  const normal = (await must("POS", ctx.api.post(`${BANK}/pos`, posBody(acc.ziraat.id)))).pos;
  const blocked = (await must("POS bloke", ctx.api.post(`${BANK}/pos`, posBody(acc.ziraat.id, { name: "Bloke POS", merchantNo: "987654321", terminalNo: "T002", blockDays: 30 })))).pos;
  const party = await must("cari", ctx.api.post("/api/workspace/accounts", { name: "ABC Ltd.", type: "customer", registeredOn: "2026-10-01" }));
  await must("bloke satış", ctx.api.post(`/api/workspace/accounts/${party.id}/entries`, { kind: "in", amount: "10.000", method: "card", posId: blocked.id, date: "2026-10-08" }));
  setDay(ctx, "2026-11-05");
  await must("satış A", ctx.api.post(`/api/workspace/accounts/${party.id}/entries`, { kind: "in", amount: "10.000", method: "card", posId: normal.id, date: "2026-11-05" }));
  await must("satış B", ctx.api.post(`/api/workspace/accounts/${party.id}/entries`, { kind: "in", amount: "10.000", method: "card", posId: normal.id, date: "2026-11-05", similarOk: true }));
  const sales = (await must("satışlar", ctx.api.get(`${BANK}/pos/sales?kind=sale`))).sales;
  const saleB = sales.filter(s => s.posId === normal.id).sort((a, b) => (a.eventNo < b.eventNo ? 1 : -1))[0];
  const rf = await ctx.api.post(`${BANK}/pos/sales/${saleB.id}/refund`, { amount: "10.000", date: "2026-11-05" });
  check("C1-0", "satış B tam iade (İade Edilmez) durum", 200, rf.status);
  const items = (await must("satış B", ctx.api.get(`${BANK}/pos/sales/${saleB.id}`)));
  console.log("   satış B kalemleri:", JSON.stringify((items.sale || items).items?.map(i => [i.role, i.valueDate, i.grossMinor, i.plannedNetMinor])));
  const cal = await must("takvim", ctx.api.get(`${BANK}/pos/calendar`));
  const rows = cal.rows.map(r => [r.valueDate, r.kindLabel, r.netMinor / 100]).sort();
  check("C1-1", "takvim 09.11: POS 9.750 · Blokeli POS 9.750 · Komisyon Tahsili −250 (üç ayrı satır)",
    [["2026-11-09", "Blokeli POS", 9750], ["2026-11-09", "Komisyon Tahsili", -250], ["2026-11-09", "POS", 9750]], rows);
  check("C1-2", "takvim toplam 19.250, Komisyon Tahsili toplamı 250", [19250, 250], [cal.totals.totalMinor / 100, cal.totals.feeMinor / 100]);
  const sum = await must("özet", ctx.api.get(`${BANK}/summary`));
  check("C1-3", "ANLIK DURUM: POS Bekleyen (Net, blokesiz) 9.500, Blokeli 9.750, Komisyon Tahsili Bekleyen 250",
    [9500, 9750, 250], [sum.posPending.netMinor / 100, sum.posPending.blockedMinor / 100, sum.posPending.feeMinor / 100]);
  setDay(ctx, "2026-11-09");
  await must("aktar", ctx.api.post(`${BANK}/settle`, {}));
  check("C1-4", "09.11 aktarım sonrası Ziraat 100.000 + 9.750 + 9.750 − 250", 119250, await bal(ctx, acc.ziraat.id));
  check("C1-5", "Mutabakat", true, await integ(ctx));
  await ctx.server.close();
}

// ---------- C2: valörden SONRA 3.000 iade → bekleyen 'refund' kalemi Komisyon Tahsili sayılmamalı ----------
{
  const ctx = await bootBank();
  const acc = await openAcceptanceAccounts(ctx.api);
  await must("POS Kullan", ctx.api.put(`${BANK}/accounts/${acc.ziraat.id}`, { usePos: true }));
  await must("POS", ctx.api.post(`${BANK}/pos`, posBody(acc.ziraat.id)));
  const party = await must("cari", ctx.api.post("/api/workspace/accounts", { name: "ABC Ltd.", type: "customer", registeredOn: "2026-10-01" }));
  await must("satış", ctx.api.post(`/api/workspace/accounts/${party.id}/entries`, { kind: "in", amount: "10.000", method: "card", date: "2026-10-08" }));
  const sale = (await must("satışlar", ctx.api.get(`${BANK}/pos/sales?kind=sale`))).sales[0];
  setDay(ctx, "2026-10-12");
  await must("aktar", ctx.api.post(`${BANK}/settle`, {}));
  // İade 12.10'da (Pazartesi) girilir; iade kalemi iade valörüne (ileri iş günü) düşer → bekler.
  const rf = await ctx.api.post(`${BANK}/pos/sales/${sale.id}/refund`, { amount: "3.000", date: "2026-10-12" });
  check("C2-0", "valörden sonra 3.000 iade durum", 200, rf.status);
  const cal = await must("takvim", ctx.api.get(`${BANK}/pos/calendar`));
  console.log("   takvim:", JSON.stringify(cal.rows.map(r => [r.valueDate, r.kind, r.kindLabel, r.netMinor / 100])));
  check("C2-1", "bekleyen iade kalemi 'Komisyon Tahsili' etiketi TAŞIMAZ (§4.6: refund kalemi ≠ fee)", false, cal.rows.some(r => r.kindLabel === "Komisyon Tahsili"));
  check("C2-2", "takvim Komisyon Tahsili toplamı 0 (komisyon tahsili yok)", 0, cal.totals.feeMinor / 100);
  const sum = await must("özet", ctx.api.get(`${BANK}/summary`));
  check("C2-3", "ANLIK DURUM Komisyon Tahsili Bekleyen 0", 0, sum.posPending.feeMinor / 100);
  const ov = await ctx.api.get("/api/workspace/overview");
  const flowText = JSON.stringify(ov.data || {});
  console.log("   overview 'Komisyon Tahsili' geçiyor mu:", /Komisyon Tahsili/.test(flowText), "posFee:", /posFee/.test(flowText));
  await ctx.server.close();
}

// R bölümü e3-geri-yukle-002.mjs dosyasında (001 geri yüklemesi 'staged': yeniden başlatma ister; geçersiz koşu e2.out'ta).
const bad = out.filter(x => !x.ok);
console.log(`\nTOPLAM ${out.length} denetim, FARK ${bad.length}: ${bad.map(x => x.id).join(", ")}`);
process.exitCode = bad.length ? 1 : 0;
