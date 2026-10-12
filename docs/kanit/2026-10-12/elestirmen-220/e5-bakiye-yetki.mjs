// Eleştirmen 2.2.0 — e5: yargıç p8'in zayıf noktası — personel çoğu uçta 403/404 aldığı için "temiz" sayıldı (ders 3: reddedilen istek kanıt değil).
// Gerçek durum: Kasa/cari/fatura/çek yetkisi OLAN ama banka bakiyesi yetkisi (bank.view) KALDIRILMIŞ kişi (muhasebe − bank.view − bank.reports).
// Beklenen (İz 2.7, plan §9.1): bu kişiye banka bakiyesi hiçbir uçta görünmez. Ayırt edici bakiye 123.456,78; yanıt gövdesinde aranır.
// Koşu: node docs/kanit/2026-10-12/elestirmen-220/e5-bakiye-yetki.mjs
import { apiOf } from "../../../../test/banka-210-ortak.mjs";
import { BANK, bootBank, must } from "../../../../test/banka-210-hesap-ortak.mjs";
import { createUser } from "../../../../test/helpers.mjs";

const ctx = await bootBank();
const z = await must("hesap", ctx.api.post(`${BANK}/accounts`, { bankName: "Ziraat Bankası", name: "Ana TL", kind: "demand", currency: "TRY", opening: { date: "2026-10-01", amount: "123.456,78", confirmed: true }, useCheque: true, useNote: true, usePos: true }));
const party = await must("cari", ctx.api.post("/api/workspace/accounts", { name: "ABC Ltd.", type: "customer", registeredOn: "2026-10-01" }));
const cq = await must("çek", ctx.api.post("/api/workspace/cheques", { direction: "in", instrument: "cheque", amount: "500", issueDate: "2026-10-02", dueDate: "2026-11-01", accountId: party.id, serialNo: "P1", bank: "Akbank" }));
const client = await createUser(ctx.server, ctx.api.client, { username: "e-muh", role: "muhasebe" });
const users = await ctx.api.client.get("/api/admin/users");
const target = (users.data?.data?.users || users.data?.users || users.data?.data || []).find(u => u.username === "e-muh");
const pr = await ctx.api.client.patch(`/api/admin/users/${target.id}`, { grants: { add: [], remove: ["bank.view", "bank.reports"] } });
console.log("yetki kaldır:", pr.status);
const muh = apiOf(client);
const needles = ["123456.78", "123456,78", "12345678", "123.456,78"];
const urls = [
  `${BANK}/choices`, `${BANK}/choices?date=2026-10-08`, `${BANK}/balances`, `${BANK}/summary`, `${BANK}/accounts`, `${BANK}/accounts/${z.id}`,
  "/api/workspace/cash", "/api/workspace/cash/opening", "/api/workspace/overview", "/api/companies/report",
  `/api/workspace/cheques/${cq.id}`, "/api/workspace/cheques", `/api/workspace/accounts/${party.id}`, "/api/workspace/accounts",
  "/api/workspace/report-center", "/api/workspace/ledger/trial-balance", "/api/workspace/ledger/integrity",
];
for (const url of urls) {
  const res = await muh.get(url);
  const body = JSON.stringify(res.data ?? "");
  const hit = needles.filter(n => body.includes(n));
  console.log(`${hit.length ? "SIZINTI" : res.status === 200 ? "temiz  " : "RED    "} ${res.status} ${url} ${hit.join(",")}`);
}
await ctx.server.close();
process.exit(0);
