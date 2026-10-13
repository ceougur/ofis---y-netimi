// Eleştirmen 2.2.0 — e8: vergi kipi × 3 taksit × kuruş artığı. Plan §4.2/§4.3: kom = round(brüt × oran) SATIŞ düzeyinde, kuruş artığı son kaleme.
// 10.000,01 @ %3,33 → kom 333,00; BSMV Hariç kesinti 333 + 16,65 = 349,65; KDV Hariç 333 + 66,60 = 399,60; KDV Dahil/BSMV Dahil/Yok 333,00.
// Son durum (3 valör geçince): Ziraat = 100.000 + 10.000,01 − kesinti; KDV kipinde sağlayıcı lehimize = kesinti, 653 = 0.
// Koşu: node docs/kanit/2026-10-12/elestirmen-220/e8-taksit-kurus.mjs
import { BANK, bootBank, must, openAcceptanceAccounts, trialBalances, subBalances } from "../../../../test/banka-210-hesap-ortak.mjs";
const out = [];
const check = (id, label, e, a) => { const ok = JSON.stringify(e) === JSON.stringify(a); out.push(ok); console.log(`${ok ? "UYDU " : "FARK "} [${id}] ${label} :: beklenen=${JSON.stringify(e)} gerçek=${JSON.stringify(a)}`); };
const DED = { bsmv_incl: 333, bsmv_excl: 349.65, vat_incl: 333, vat_excl: 399.6, none: 333 };
for (const [mode, ded] of Object.entries(DED)) {
  const ctx = await bootBank();
  const acc = await openAcceptanceAccounts(ctx.api);
  const provider = await must("sağlayıcı", ctx.api.post("/api/workspace/accounts", { name: "Ödeme Kuruluşu A.Ş.", type: "supplier", registeredOn: "2026-10-01" }));
  const party = await must("cari", ctx.api.post("/api/workspace/accounts", { name: "ABC Ltd.", type: "customer", registeredOn: "2026-10-01" }));
  await must("POS Kullan", ctx.api.put(`${BANK}/accounts/${acc.ziraat.id}`, { usePos: true }));
  const vat = mode.startsWith("vat");
  await must("POS", ctx.api.post(`${BANK}/pos`, { name: "Taksit POS", bankAccountId: acc.ziraat.id, kind: "physical", providerKind: vat ? "payment_institution" : "bank", tax: mode, ...(vat ? { providerAccountId: provider.id } : {}),
    valorRule: "business", valorDays: 2, installmentPayout: "monthly", provisionDays: 0, refundCommission: "none", merchantNo: "1", terminalNo: "T1", validFrom: "2026-10-01", rates: [{ installments: 1, rate: "2,5" }, { installments: 3, rate: "3,33" }] }));
  await must("satış", ctx.api.post(`/api/workspace/accounts/${party.id}/entries`, { kind: "in", amount: "10.000,01", method: "card", installments: 3, date: "2026-10-08" }));
  const sale = (await must("s", ctx.api.get(`${BANK}/pos/sales?kind=sale`))).sales[0];
  const sumItems = sale.items.reduce((s, i) => s + (i.grossMinor - i.netMinor), 0) / 100;
  check(`${mode}-k`, `${mode}: satış kesintisi = Σ kalem (brüt − net)`, [ded, ded], [Math.round((sale.grossMinor - sale.netMinor)) / 100, Math.round(sumItems * 100) / 100]);
  ctx.server.clock.set("2027-01-20T12:00:00+03:00");
  await must("aktar", ctx.api.post(`${BANK}/settle`, {}));
  const tb = await trialBalances(ctx.api); const subs = await subBalances(ctx.api);
  const prov = (await must("p", ctx.api.get(`/api/workspace/accounts/${provider.id}`))).totals.balance;
  const bank = (await must("h", ctx.api.get(`${BANK}/accounts/${acc.ziraat.id}`))).balanceMinor / 100;
  const integ = (await must("m", ctx.api.get("/api/workspace/ledger/integrity"))).ok;
  check(`${mode}-son`, `${mode}: son durum`, { bank: Math.round((110000.01 - ded) * 100) / 100, k653: vat ? 0 : ded, prov: vat ? ded : 0, k108: 0, integ: true }, { bank, k653: tb["653"] ?? 0, prov, k108: subs["108.01"]?.balance ?? 0, integ });
  await ctx.server.close();
}
console.log(`\nTOPLAM ${out.length}, FARK ${out.filter(x => !x).length}`); process.exitCode = out.every(Boolean) ? 0 : 1;
