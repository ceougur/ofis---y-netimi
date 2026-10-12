// Eleştirmen 2.2.0 — e1: POS vergi kipleri (BSMV Dahil/Hariç, KDV Dahil/Hariç, Yok) × iade kuralı (İade Edilmez / Oransal) × zaman
// (valörden önce / sonra) + tam iade (Komisyon Tahsili). Beklenen plan §4.3 formüllerinden ELLE (programın kodundan değil):
//   kom = round(brüt × oran); BSMV Hariç kesinti = kom + round(kom×%5); KDV Hariç = kom + round(kom×%20); Dahil/Yok = kom.
//   Son durum (bütün valörler geçince) iade zamanından BAĞIMSIZDIR (değişmez kural): banka = 100.000 + (10.000 − iade) − kesinti(kalan kom).
//   KDV kipinde kesinti 653'e değil sağlayıcı carisine (320, bizim lehimize) gider; BSMV/Yok kipinde 653'e.
// Sahte saat 08.10.2026 Perşembe. Koşu: node docs/kanit/2026-10-12/elestirmen-220/e1-vergi-kipleri.mjs
import { BANK, bootBank, must, openAcceptanceAccounts, subBalances, trialBalances } from "../../../../test/banka-210-hesap-ortak.mjs";

const out = [];
const check = (id, label, expected, actual) => {
  const ok = JSON.stringify(expected) === JSON.stringify(actual);
  out.push({ id, ok });
  console.log(`${ok ? "UYDU " : "FARK "} [${id}] ${label} :: beklenen=${JSON.stringify(expected)} gerçek=${JSON.stringify(actual)}`);
};
const r2 = x => Math.round(x * 100) / 100;
const roundK = x => Math.round(x * 100) / 100; // kuruşa yuvarlama
const deduction = (mode, kom) => {
  if (mode === "bsmv_excl") return r2(kom + roundK(kom * 0.05));
  if (mode === "vat_excl") return r2(kom + roundK(kom * 0.2));
  return kom;
};
const isVat = mode => mode.startsWith("vat");

async function world(mode, refundCommission) {
  const ctx = await bootBank();
  const acc = await openAcceptanceAccounts(ctx.api);
  const provider = await must("sağlayıcı", ctx.api.post("/api/workspace/accounts", { name: "Ödeme Kuruluşu A.Ş.", type: "supplier", registeredOn: "2026-10-01" }));
  const party = await must("cari", ctx.api.post("/api/workspace/accounts", { name: "ABC Ltd.", type: "customer", registeredOn: "2026-10-01" }));
  await must("POS Kullan", ctx.api.put(`${BANK}/accounts/${acc.ziraat.id}`, { usePos: true }));
  const pos = (await must("POS", ctx.api.post(`${BANK}/pos`, {
    name: "Deneme POS", bankAccountId: acc.ziraat.id, kind: "physical", providerKind: isVat(mode) ? "payment_institution" : "bank", tax: mode,
    ...(isVat(mode) ? { providerAccountId: provider.id } : {}), valorRule: "business", valorDays: 2, installmentPayout: "monthly",
    provisionDays: 0, refundCommission, merchantNo: "123456789", terminalNo: "T001", validFrom: "2026-10-01", rates: [{ installments: 1, rate: "2,5" }],
  }))).pos;
  await must("POS tahsilatı", ctx.api.post(`/api/workspace/accounts/${party.id}/entries`, { kind: "in", amount: "10.000", method: "card", date: "2026-10-08" }));
  const sale = (await must("satışlar", ctx.api.get(`${BANK}/pos/sales?kind=sale`))).sales[0];
  return { ctx, acc, provider, party, pos, sale };
}
const facts = async w => {
  const tb = await trialBalances(w.ctx.api);
  const subs = await subBalances(w.ctx.api);
  const bank = (await must("hesap", w.ctx.api.get(`${BANK}/accounts/${w.acc.ziraat.id}`))).balanceMinor / 100;
  const prov = (await must("sağlayıcı", w.ctx.api.get(`/api/workspace/accounts/${w.provider.id}`))).totals.balance;
  const integ = await must("mutabakat", w.ctx.api.get("/api/workspace/ledger/integrity"));
  return { bank, k653: tb["653"] ?? 0, k108: subs["108.01"]?.balance ?? 0, prov, integ: integ.ok, fails: (integ.failures || []).map(f => f.code || f.label).slice(0, 4) };
};
const settleAt = async (w, day) => {
  w.ctx.server.clock.set(`${day}T12:00:00+03:00`);
  await must("aktar", w.ctx.api.post(`${BANK}/settle`, {}));
};
const expect = (mode, keptKom, grossLeft) => {
  const d = deduction(mode, keptKom);
  return { bank: r2(100000 + grossLeft - d), k653: isVat(mode) ? 0 : d, k108: 0, prov: isVat(mode) ? d : 0, integ: true };
};
const pickF = f => ({ bank: f.bank, k653: f.k653, k108: f.k108, prov: f.prov, integ: f.integ });

const MODES = ["bsmv_incl", "bsmv_excl", "vat_incl", "vat_excl", "none"];
for (const mode of MODES) {
  // 0) iadesiz: §4.3 tablosu
  {
    const w = await world(mode, "none");
    await settleAt(w, "2026-10-12");
    const f = await facts(w);
    check(`${mode}-0`, `${mode} iadesiz 12.10 valör`, expect(mode, 250, 10000), pickF(f));
    if (!f.integ) console.log("   mutabakat:", f.fails);
    if (mode === "vat_incl" || mode === "vat_excl") {
      // Plan §4.3/3: taslak KDV Dahil, toplam = kesintiler. vat_incl: 250 → matrah 208,33 + KDV 41,67; vat_excl: 300 → 250 + 50.
      const total = deduction(mode, 250);
      const net = r2(Math.round((total / 1.2) * 100) / 100);
      const created = await w.ctx.api.post(`${BANK}/pos/commission-invoices`, { month: "2026-10" });
      const draftId = created.data?.created?.[0]?.invoiceId;
      const draft = draftId ? await must("taslak", w.ctx.api.get(`/api/workspace/invoices/${draftId}`)) : null;
      check(`${mode}-T1`, `${mode} komisyon taslağı (toplam, matrah, KDV)`, [total, net, r2(total - net)], draft ? [draft.payableTotal, draft.netTotal, draft.vatTotal] : [created.status, created.code, created.error]);
      if (draftId) {
        const iss = await w.ctx.api.post(`/api/workspace/invoices/${draftId}/issue`, { number: `OK${mode}0001`, force: true });
        const tb = await trialBalances(w.ctx.api);
        const doc = await must("fatura", w.ctx.api.get(`/api/workspace/invoices/${draftId}`));
        const prov = (await must("sağlayıcı", w.ctx.api.get(`/api/workspace/accounts/${w.provider.id}`))).totals.balance;
        check(`${mode}-T2`, `${mode} taslak kaydı: 191, 653, sağlayıcı, fatura durumu`, [200, r2(total - net), net, 0, "paid"], [iss.status, tb["191"] ?? 0, tb["653"] ?? 0, prov, doc.payState]);
      }
    }
    await w.ctx.server.close();
  }
  // 1) 3.000 kısmi iade × kural × zaman
  for (const policy of ["none", "proportional"]) {
    const kept = policy === "none" ? 250 : 250 - Math.round(250 * 0.3);
    for (const when of ["once", "sonra"]) {
      const w = await world(mode, policy);
      let r;
      if (when === "once") {
        w.ctx.server.clock.set("2026-10-09T12:00:00+03:00");
        r = await w.ctx.api.post(`${BANK}/pos/sales/${w.sale.id}/refund`, { amount: "3.000", date: "2026-10-09" });
        await settleAt(w, "2026-10-12");
      } else {
        await settleAt(w, "2026-10-12");
        w.ctx.server.clock.set("2026-10-13T12:00:00+03:00");
        r = await w.ctx.api.post(`${BANK}/pos/sales/${w.sale.id}/refund`, { amount: "3.000", date: "2026-10-13" });
      }
      await settleAt(w, "2026-10-30");
      const f = await facts(w);
      check(`${mode}-${policy}-${when}`, `${mode} 3.000 iade, ${policy}, valörden ${when} (iade durumu ${r.status}${r.code ? " " + r.code : ""})`, expect(mode, kept, 7000), pickF(f));
      if (!f.integ) console.log("   mutabakat:", f.fails);
      await w.ctx.server.close();
    }
  }
  // 2) tam iade valörden önce, İade Edilmez → Komisyon Tahsili (§4.6 "Net eksiye düşerse")
  {
    const w = await world(mode, "none");
    w.ctx.server.clock.set("2026-10-09T12:00:00+03:00");
    const r = await w.ctx.api.post(`${BANK}/pos/sales/${w.sale.id}/refund`, { amount: "10.000", date: "2026-10-09" });
    const cal = await must("takvim", w.ctx.api.get(`${BANK}/pos/calendar`));
    const d = deduction(mode, 250);
    check(`${mode}-tam-takvim`, `${mode} tam iade: takvimde Komisyon Tahsili satırı (12.10, −kesinti)`, [["2026-10-12", "fee", -Math.round(d * 100)]], cal.rows.map(x => [x.valueDate, x.kind, x.netMinor]));
    await settleAt(w, "2026-10-12");
    const f = await facts(w);
    check(`${mode}-tam`, `${mode} tam iade valörden önce (iade ${r.status})`, expect(mode, 250, 0), pickF(f));
    if (!f.integ) console.log("   mutabakat:", f.fails);
    await w.ctx.server.close();
  }
}
const bad = out.filter(x => !x.ok);
console.log(`\nTOPLAM ${out.length} denetim, FARK ${bad.length}: ${bad.map(x => x.id).join(", ")}`);
process.exitCode = bad.length ? 1 : 0;
