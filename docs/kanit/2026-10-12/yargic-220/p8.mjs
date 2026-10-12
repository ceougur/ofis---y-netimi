// Yargıç 2.2.0 — p8: banka bakiyesi yetkisiz kişiye sızıyor mu (İz 2.7: "banka bakiyesi yetkisi olmayana gösterilmez")?
// Personel (bank.view YOK) için bakiye taşıyabilecek uçlar taranır: seçici, bakiye, Kasa, ANLIK DURUM, POS önizleme, çek kartı, fatura formu verisi.
// Ziraat bakiyesi 123.456,78 gibi ayırt edici bir sayıyla açılır; yanıt gövdelerinde bu sayı (ya da kuruşu) aranır.
// Koşu: node docs/kanit/2026-10-12/yargic-220/p8.mjs
import { apiOf } from "../../../../test/banka-210-ortak.mjs";
import { BANK, bootBank, must } from "../../../../test/banka-210-hesap-ortak.mjs";
import { createUser } from "../../../../test/helpers.mjs";

const ctx = await bootBank();
const z = await must("hesap", ctx.api.post(`${BANK}/accounts`, { bankName: "Ziraat Bankası", name: "Ana TL", kind: "demand", currency: "TRY", opening: { date: "2026-10-01", amount: "123.456,78", confirmed: true }, useCheque: true, useNote: true, usePos: true }));
await must("POS", ctx.api.post(`${BANK}/pos`, { name: "Ziraat POS", bankAccountId: z.id, kind: "physical", providerKind: "bank", tax: "bsmv_incl", valorRule: "business", valorDays: 2, installmentPayout: "monthly", provisionDays: 0, refundCommission: "none", merchantNo: "1", terminalNo: "T1", validFrom: "2026-10-01", rates: [{ installments: 1, rate: "2,5" }] }));
const party = await must("cari", ctx.api.post("/api/workspace/accounts", { name: "ABC Ltd.", type: "customer", registeredOn: "2026-10-01" }));
const cq = await must("çek", ctx.api.post("/api/workspace/cheques", { direction: "in", instrument: "cheque", amount: "500", issueDate: "2026-10-02", dueDate: "2026-11-01", accountId: party.id, serialNo: "P1", bank: "Akbank" }));
const staff = apiOf(await createUser(ctx.server, ctx.api.client, { username: "y-pers", role: "personel" }));
const needles = ["123456.78", "123456,78", "12345678", "123.456,78"];
const urls = [
  `${BANK}/choices`, `${BANK}/choices?date=2026-10-08`, `${BANK}/balances`, "/api/workspace/cash", "/api/workspace/cash/opening", "/api/workspace/overview",
  `${BANK}/pos/preview?pos=&amount=100&installments=1&date=2026-10-08`, `/api/workspace/cheques/${cq.id}`, "/api/workspace/cheques", `/api/workspace/accounts/${party.id}`,
  "/api/workspace/invoices/form", "/api/workspace/invoices/options", `${BANK}/accounts`, `${BANK}/summary`,
];
for (const url of urls) {
  const res = await staff.get(url);
  const body = JSON.stringify(res.data ?? "");
  const hit = needles.filter(n => body.includes(n));
  console.log(`${hit.length ? "SIZINTI" : "temiz  "} ${res.status} ${url} ${hit.join(",")}`);
}
await ctx.server.close();
process.exit(0);
