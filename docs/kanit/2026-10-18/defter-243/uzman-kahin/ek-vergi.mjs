// MM3 bağımsız denetim: denetçinin Eylül verisi (ay.mjs) üzerinde KDV Mahsup Fişi ve Vergi Ödemesi. Beklenen sayılar denetçinin BULGULAR.md'sinden
// (temiz oda; programın kodundan değil): "KDV 191 = 2.816, 391 = 2.055, devreden 761"; "360 = 360 (tevkifat) + 2.000 (kira stopajı)".
import { writeFileSync } from "node:fs";
import path from "node:path";
import { boot } from "./ortak.mjs";
const dir = path.dirname(new URL(import.meta.url).pathname);
const { server, call } = await boot({ dataDir: path.join(dir, "veri"), now: "2026-10-26T12:00:00+03:00" });
const out = {};
try {
  const tb = async to => Object.fromEntries((await call("mizan", "GET", `/api/workspace/ledger${to ? `?to=${to}` : ""}`)).data.trial.accounts.map(r => [r.code, r.balance]));
  out.once = await tb("2026-09-30");
  out.onizleme = (await call("ön izleme", "GET", "/api/workspace/tax/vat-offset?month=2026-09")).data.preview;
  out.mahsup = (await call("mahsup", "POST", "/api/workspace/tax/vat-offset", { month: "2026-09" })).status;
  out.eylulSonu = await tb("2026-09-30");
  const bank = (await call("hesaplar", "GET", "/api/workspace/bank/accounts?status=all")).data.accounts.find(a => a.kind === "demand");
  out.muhtasar = (await call("muhtasar", "POST", "/api/workspace/tax/payments", { way: "bank", accountId: bank.id, date: "2026-10-26", taxType: "muhtasar", amount: "2.000" })).status;
  out.kdv2 = (await call("KDV-2", "POST", "/api/workspace/tax/payments", { way: "bank", accountId: bank.id, date: "2026-10-26", taxType: "kdv", amount: "360" })).status;
  out.son = await tb("");
  out.mutabakat = (await call("mutabakat", "GET", "/api/workspace/ledger/integrity")).data;
} finally {
  writeFileSync(path.join(dir, "ek-vergi-sonuc.json"), JSON.stringify(out, null, 1));
  await server.app.close();
}
const e = out;
const want = [["Eylül sonu 391", e.eylulSonu["391"] ?? 0, 0], ["Eylül sonu 191", e.eylulSonu["191"] ?? 0, 0], ["Eylül sonu 190 (devreden)", e.eylulSonu["190"] ?? 0, 761], ["son 360", e.son["360"] ?? 0, 0], ["son 102", e.son["102"], 50602.5 - 2360], ["mutabakat", e.mutabakat.ok, true]];
for (const [label, got, exp] of want) console.log(`${got === exp ? "✓" : "✗"} ${label}: program ${got} · beklenen ${exp}`);
console.log("ön izleme:", JSON.stringify(e.onizleme.lines.map(l => [l.account, l.debitMinor / 100, l.creditMinor / 100])));
process.exitCode = want.every(([, got, exp]) => got === exp) ? 0 : 1;
