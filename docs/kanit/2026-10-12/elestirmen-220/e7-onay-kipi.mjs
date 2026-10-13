// Eleştirmen 2.2.0 — e7: POS onay kipi ("Elle Onay"; plan §4.4/7). Valörü gelen kalem "Onay Bekleyen"e düşer, aktarım yazmaz; onayda gerçek
// tarih + net girilir; fark BSMV kipinde 653'e, KDV kipinde sağlayıcı carisine ("Komisyon Farkı"). Beklenen el hesabı:
//   BSMV Dahil 10.000 @ %2,5: planlanan net 9.750; banka 9.740 bildirir → Ziraat +9.740, 653 = 260.
//   KDV Hariç: planlanan net 9.700 (kesinti 300); banka 9.690 bildirir → Ziraat +9.690, 653 = 0, sağlayıcı lehimize 310.
// Koşu: node docs/kanit/2026-10-12/elestirmen-220/e7-onay-kipi.mjs
import { BANK, bootBank, must, openAcceptanceAccounts, trialBalances, subBalances } from "../../../../test/banka-210-hesap-ortak.mjs";

const out = [];
const check = (id, label, expected, actual) => {
  const ok = JSON.stringify(expected) === JSON.stringify(actual);
  out.push({ id, ok });
  console.log(`${ok ? "UYDU " : "FARK "} [${id}] ${label} :: beklenen=${JSON.stringify(expected)} gerçek=${JSON.stringify(actual)}`);
};
for (const [mode, reported, exp] of [["bsmv_incl", "9.740", { bank: 109740, k653: 260, prov: 0 }], ["vat_excl", "9.690", { bank: 109690, k653: 0, prov: 310 }]]) {
  const ctx = await bootBank();
  const acc = await openAcceptanceAccounts(ctx.api);
  const provider = await must("sağlayıcı", ctx.api.post("/api/workspace/accounts", { name: "Ödeme Kuruluşu A.Ş.", type: "supplier", registeredOn: "2026-10-01" }));
  const party = await must("cari", ctx.api.post("/api/workspace/accounts", { name: "ABC Ltd.", type: "customer", registeredOn: "2026-10-01" }));
  await must("POS Kullan", ctx.api.put(`${BANK}/accounts/${acc.ziraat.id}`, { usePos: true }));
  const vat = mode.startsWith("vat");
  const pos = (await must("POS", ctx.api.post(`${BANK}/pos`, {
    name: "Onaylı POS", bankAccountId: acc.ziraat.id, kind: "physical", providerKind: vat ? "payment_institution" : "bank", tax: mode, ...(vat ? { providerAccountId: provider.id } : {}),
    valorRule: "business", valorDays: 2, installmentPayout: "monthly", provisionDays: 0, refundCommission: "none", merchantNo: "1", terminalNo: "T1", validFrom: "2026-10-01",
    settleMode: "manual", rates: [{ installments: 1, rate: "2,5" }],
  }))).pos;
  await must("satış", ctx.api.post(`/api/workspace/accounts/${party.id}/entries`, { kind: "in", amount: "10.000", method: "card", date: "2026-10-08" }));
  ctx.server.clock.set("2026-10-13T12:00:00+03:00");
  await must("aktar", ctx.api.post(`${BANK}/settle`, {}));
  const z0 = (await must("h", ctx.api.get(`${BANK}/accounts/${acc.ziraat.id}`))).balanceMinor / 100;
  const sum = await must("özet", ctx.api.get(`${BANK}/summary`));
  check(`${mode}-1`, `${mode}: onay kipinde aktarım yazmaz; Onay Bekleyen 1 kalem`, [100000, 1], [z0, sum.posPending.awaiting.count]);
  const c = await ctx.api.post(`${BANK}/pos/items/confirm`, { posId: pos.id, valueDate: "2026-10-12", date: "2026-10-13", netAmount: reported });
  check(`${mode}-2`, `${mode}: onay durumu`, 200, c.status);
  if (c.status !== 200) console.log("   ", c.code, c.error);
  const tb = await trialBalances(ctx.api);
  const subs = await subBalances(ctx.api);
  const prov = (await must("sağlayıcı", ctx.api.get(`/api/workspace/accounts/${provider.id}`)));
  const f = { bank: (await must("h", ctx.api.get(`${BANK}/accounts/${acc.ziraat.id}`))).balanceMinor / 100, k653: tb["653"] ?? 0, prov: prov.totals.balance };
  check(`${mode}-3`, `${mode}: banka bildirdiği net ${reported} ile`, exp, f);
  check(`${mode}-4`, `${mode}: 108.01 = 0`, 0, subs["108.01"]?.balance ?? 0);
  if (vat) console.log("   sağlayıcı ekstresi:", JSON.stringify(prov.ledger).slice(0, 900));
  const integ = await must("mutabakat", ctx.api.get("/api/workspace/ledger/integrity"));
  check(`${mode}-5`, `${mode}: Mutabakat`, true, integ.ok);
  await ctx.server.close();
}
const bad = out.filter(x => !x.ok);
console.log(`\nTOPLAM ${out.length} denetim, FARK ${bad.length}: ${bad.map(x => x.id).join(", ")}`);
process.exitCode = bad.length ? 1 : 0;
