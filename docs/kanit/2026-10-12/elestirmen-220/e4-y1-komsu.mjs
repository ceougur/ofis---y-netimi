// Eleştirmen 2.2.0 — e4: Y1'in komşu yolu. Kilitli dönemde taksitli satışı olan POS'ta "Bekleyenleri Yeni Hesaba Taşı" reddedilince
// kullanıcının gerçek alternatifi: POS'u yeni hesaba bağla (§4.6: bekleyenler eski hesaba kopyayla geçer) → eski hesapta POS Kullan kapat → eski
// hesabı Pasife Al → Kasım/Aralık/Ocak valörleri nereye gider? Beklenen (plan §4.6): kalemler satış anındaki hesap kopyasına (Ziraat) geçer;
// pasif hesaba para yazılacaksa ya pasife alma bekleyen kalem varken reddedilir ya da aktarım nedenli hata verir — sessiz yazım değil.
// Koşu: node docs/kanit/2026-10-12/elestirmen-220/e4-y1-komsu.mjs
import { BANK, bootBank, must, openAcceptanceAccounts } from "../../../../test/banka-210-hesap-ortak.mjs";

const show = (label, r) => console.log(`${label}: ${r.status} ${r.code || ""} ${r.error ? "— " + r.error : ""}`);
const ctx = await bootBank();
const acc = await openAcceptanceAccounts(ctx.api);
for (const a of [acc.ziraat, acc.garanti]) await must("POS Kullan", ctx.api.put(`${BANK}/accounts/${a.id}`, { usePos: true }));
const pos = (await must("POS", ctx.api.post(`${BANK}/pos`, {
  name: "Ziraat Fiziki POS", bankAccountId: acc.ziraat.id, kind: "physical", providerKind: "bank", tax: "bsmv_incl", valorRule: "business", valorDays: 2, installmentPayout: "monthly",
  provisionDays: 0, refundCommission: "none", merchantNo: "123456789", terminalNo: "T001", validFrom: "2026-10-01", rates: [{ installments: 1, rate: "2,5" }, { installments: 3, rate: "3,5" }],
}))).pos;
const party = await must("cari", ctx.api.post("/api/workspace/accounts", { name: "ABC Ltd.", type: "customer", registeredOn: "2026-10-01" }));
await must("POS 3 taksit", ctx.api.post(`/api/workspace/accounts/${party.id}/entries`, { kind: "in", amount: "12.000", method: "card", installments: 3, date: "2026-10-05" }));
ctx.server.clock.set("2026-10-20T12:00:00+03:00");
show("kilit 10.10", await ctx.api.put("/api/admin/period-lock", { lockedUntil: "2026-10-10" }));
show("Bekleyenleri Yeni Hesaba Taşı (Y1)", await ctx.api.post(`${BANK}/pos/${pos.id}/move-pending`, { bankAccountId: acc.garanti.id }));
show("POS kartında bağlı hesap → Garanti", await ctx.api.put(`${BANK}/pos/${pos.id}`, { bankAccountId: acc.garanti.id }));
show("Ziraat POS Kullan kapat", await ctx.api.put(`${BANK}/accounts/${acc.ziraat.id}`, { usePos: false }));
show("Ziraat Pasife Al", await ctx.api.post(`${BANK}/accounts/${acc.ziraat.id}/status`, { status: "passive" }));
const z = await must("Ziraat", ctx.api.get(`${BANK}/accounts/${acc.ziraat.id}`));
console.log("Ziraat durum:", z.status, "bakiye:", z.balanceMinor / 100);
ctx.server.clock.set("2027-01-12T12:00:00+03:00");
show("aktar (Kasım–Ocak valörleri)", await ctx.api.post(`${BANK}/settle`, {}));
const sale = (await must("satışlar", ctx.api.get(`${BANK}/pos/sales?kind=sale`))).sales[0];
console.log("kalemler:", JSON.stringify(sale.items.map(i => [i.valueDate, i.status, i.error])));
console.log("Ziraat:", (await must("Ziraat", ctx.api.get(`${BANK}/accounts/${acc.ziraat.id}`))).balanceMinor / 100, "Garanti:", (await must("Garanti", ctx.api.get(`${BANK}/accounts/${acc.garanti.id}`))).balanceMinor / 100);
const integ = await must("mutabakat", ctx.api.get("/api/workspace/ledger/integrity"));
console.log("Mutabakat:", integ.ok, JSON.stringify((integ.failures || []).map(f => f.code || f.label).slice(0, 5)));
await ctx.server.close();
