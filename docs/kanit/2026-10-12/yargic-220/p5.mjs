// Yargıç 2.2.0 — p5: KDV kipinde (Ödeme Kuruluşu, KDV Hariç) Eylül kesintisi + Eylül KİLİTLİ iken Eylül komisyon faturası taslağı kaydedilebiliyor mu?
// Plan §4.3/3–4: taslak = o ayın bağlanmamış kesintileri; kaydette kesinti satırları faturaya bağlanır (bank.post 'assign'). Kilit §4.4/6.
// Bağımsız beklenen: 10.000 @ %2,5 KDV Hariç → kesinti 250 + 50 = 300; taslak KDV Dahil 300 (matrah 250, KDV 50); kayıttan sonra 191 = 50,
// sağlayıcı 0, fatura Ödendi. Koşu: node docs/kanit/2026-10-12/yargic-220/p5.mjs
import { BANK, bootBank, must, openAcceptanceAccounts, trialBalances } from "../../../../test/banka-210-hesap-ortak.mjs";

const out = [];
const check = (id, label, expected, actual) => {
  const ok = JSON.stringify(expected) === JSON.stringify(actual);
  out.push({ id, ok });
  console.log(`${ok ? "UYDU " : "FARK "} [${id}] ${label} :: beklenen=${JSON.stringify(expected)} gerçek=${JSON.stringify(actual)}`);
};
const note = (id, v) => console.log(`NOT   [${id}] ${JSON.stringify(v).slice(0, 600)}`);

for (const variant of ["kilitsiz", "eylul-kilitli"]) {
  console.log(`\n===== ${variant} =====`);
  const ctx = await bootBank();
  const acc = await openAcceptanceAccounts(ctx.api);
  // açılış 01.10 — Eylül satışı için hesabı 01.09'da açalım
  const z = await must("hesap", ctx.api.post(`${BANK}/accounts`, { bankName: "Papara", name: "TL", kind: "demand", currency: "TRY", opening: { date: "2026-09-01", amount: "1.000", confirmed: true }, usePos: true }));
  const provider = await must("sağlayıcı", ctx.api.post("/api/workspace/accounts", { name: "Örnek Ödeme Kuruluşu A.Ş.", type: "supplier", registeredOn: "2026-09-01" }));
  const customer = await must("müşteri", ctx.api.post("/api/workspace/accounts", { name: "ABC Ltd.", type: "customer", registeredOn: "2026-09-01" }));
  if (!(await must("h", ctx.api.get(`${BANK}/accounts/${z.id}`))).usePos) await must("POS Kullan", ctx.api.put(`${BANK}/accounts/${z.id}`, { usePos: true }));
  await must("POS", ctx.api.post(`${BANK}/pos`, {
    name: "Sanal POS", bankAccountId: z.id, kind: "virtual", providerKind: "payment_institution", tax: "vat_excl", providerAccountId: provider.id, valorRule: "business", valorDays: 2,
    installmentPayout: "monthly", provisionDays: 0, refundCommission: "none", merchantNo: "9", terminalNo: "V1", validFrom: "2026-09-01", rates: [{ installments: 1, rate: "2,5" }],
  }));
  await must("POS tahsilatı 25.09", ctx.api.post(`/api/workspace/accounts/${customer.id}/entries`, { kind: "in", amount: "10.000", method: "card", date: "2026-09-25" }));
  await must("aktar", ctx.api.post(`${BANK}/settle`, {}));
  check("K1", "Papara (1.000 + 9.700)", 10700, (await must("h", ctx.api.get(`${BANK}/accounts/${z.id}`))).balanceMinor / 100);
  const prov = await must("sağlayıcı", ctx.api.get(`/api/workspace/accounts/${provider.id}`));
  check("K2", "sağlayıcı bakiyesi (bizim lehimize 300)", 300, prov.totals.balance);
  if (variant === "eylul-kilitli") {
    const lock = await ctx.api.put("/api/admin/period-lock", { lockedUntil: "2026-09-30" });
    note("K3-kilit", [lock.status, lock.code]);
  }
  const created = await ctx.api.post(`${BANK}/pos/commission-invoices`, { month: "2026-09" });
  note("K4-taslak", [created.status, created.code, created.error, created.data?.created]);
  const draftId = created.data?.created?.[0]?.invoiceId;
  if (draftId) {
    const draft = await must("taslak", ctx.api.get(`/api/workspace/invoices/${draftId}`));
    note("K5-taslak", [draft.issueDate, draft.payableTotal, draft.netTotal, draft.vatTotal]);
    let issued = await ctx.api.post(`/api/workspace/invoices/${draftId}/issue`, { number: "OK-1", force: true });
    note("K6-kaydet (taslak tarihiyle)", [issued.status, issued.code, issued.error]);
    if (issued.status !== 200) {
      const lines = draft.lines.map(line => ({ name: line.name, qty: line.qty, unitPrice: line.unitPrice, vatRate: line.vatRate, expenseCode: line.expenseCode }));
      issued = await ctx.api.post(`/api/workspace/invoices/${draftId}/issue`, { number: "OK-1", issueDate: "2026-10-08", pricesIncludeVat: true, lines, force: true });
      note("K7-kaydet (tarih 08.10'a alınarak)", [issued.status, issued.code, issued.error]);
    }
    const doc = await must("fatura", ctx.api.get(`/api/workspace/invoices/${draftId}`));
    note("K8-fatura", [doc.status, doc.issueDate, doc.paymentStatus || doc.payState || doc.payment?.status, doc.openAmount ?? doc.remaining]);
    const tb = await trialBalances(ctx.api);
    note("K9-mizan 191/653/320/108", [tb["191"] ?? 0, tb["653"] ?? 0, tb["320"] ?? 0, tb["108"] ?? 0]);
    const prov2 = await must("sağlayıcı", ctx.api.get(`/api/workspace/accounts/${provider.id}`));
    check("K10", "kayıttan sonra sağlayıcı bakiyesi", 0, prov2.totals.balance);
  }
  const integ = await must("mutabakat", ctx.api.get("/api/workspace/ledger/integrity"));
  check("K11", "Mutabakat", true, integ.ok);
  const logs = ctx.store.all("SELECT action, summary FROM integrity_log");
  note("K12-integrity_log", logs);
  await ctx.server.close();
}
console.log("\nÖZET", out.filter(o => !o.ok).length, "fark /", out.length, "denetim");
process.exit(0);
