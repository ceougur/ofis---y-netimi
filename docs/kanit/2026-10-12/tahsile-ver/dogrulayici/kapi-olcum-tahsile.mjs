// Bağımsız doğrulayıcı — Tahsile Ver yazımında mutabakat kapısının süresi (plan §3.11 madde 5 bütçesi: tek yazmada kapı 100.000 para satırında
// ≤ 150 ms). Veri: program kendi şemasını kurar (ilk açılış), sonra N Kasa satırı ham SQL ile eklenir (geçmiş tarihli, nakit; yalnız hacim),
// program yeniden açılır (taban taraması bu veriyle). Üretim ayarı: gateVerify false (testlerdeki çift kapı kapalı), moneyStrict false.
// Ölçülen: HTTP süresi + kapının yolu (scoped/full) ve nedeni (integrity.stats). Kod değiştirmez.
import { DatabaseSync } from "node:sqlite";
import { randomUUID } from "node:crypto";
import { mkdtempSync, rmSync } from "node:fs";
import os from "node:os";
import path from "node:path";
import { startTestServer, loginAdmin } from "../../../../../test/helpers.mjs";
import { apiOf, must } from "../../../../../test/banka-210-ortak.mjs";
import { openAcceptanceAccounts } from "../../../../../test/banka-210-hesap-ortak.mjs";

const N = Number(process.argv[2] || 100000);
const NOW = "2026-10-15T12:00:00+03:00";
const root = mkdtempSync(path.join(process.env.OLCUM_TMP || os.tmpdir(), "tahsile-kapi-"));
const dataDir = path.join(root, "data");
const opts = { dataDir, now: NOW, gateVerify: false, moneyStrict: false };
let s = await startTestServer(opts);
let api = apiOf(await loginAdmin(s));
const acc = await openAcceptanceAccounts(api);
const abc = await must("cari", api.post("/api/workspace/accounts", { name: "ABC Ltd.", type: "customer", registeredOn: "2025-01-01" }));
await s.close?.() ?? s.app.close();
const db = new DatabaseSync(path.join(dataDir, "destekofis.sqlite"));
const cols = db.prepare("PRAGMA table_info(cash_entries)").all().map(c => c.name);
const ins = db.prepare(`INSERT INTO cash_entries (${cols.join(", ")}) VALUES (${cols.map(() => "?").join(", ")})`);
db.exec("BEGIN");
for (let i = 0; i < N; i += 1) {
  const d = new Date(Date.UTC(2025, 0, 1) + (i % 600) * 86400000).toISOString().slice(0, 10);
  const row = { id: `cash-${randomUUID()}`, kind: i % 3 ? "in" : "out", amount: 10 + (i % 97), date: d, description: "hacim", created_by: "admin", created_at: "2025-01-01T00:00:00.000Z", method: "cash" };
  ins.run(...cols.map(c => (c in row ? row[c] : c === "updated_by" || c === "updated_at" ? null : c.endsWith("_minor") ? 0 : "")));
}
db.exec("COMMIT");
db.close();
const t0 = performance.now();
s = await startTestServer(opts);
const openMs = performance.now() - t0;
api = apiOf(await loginAdmin(s));
const app = s.app;
const out = { N, openMs: Math.round(openMs), writes: [] };
const rec = async (label, fn) => {
  const at = performance.now();
  const res = await fn();
  const ms = performance.now() - at;
  const gate = app.integrity.stats?.()?.gate || {};
  out.writes.push({ label, status: res.status, code: res.code || "", httpMs: Math.round(ms), gatePath: gate.path, gateReason: gate.reason || "", gateMs: Math.round(gate.ms || 0) });
  return res;
};
for (let r = 0; r < 3; r += 1) {
  await rec("Kasa nakit girişi", () => api.post("/api/workspace/cash", { kind: "in", amount: "12,50", method: "cash", description: "ölçüm", date: "2026-10-15" }));
  await rec("Cari havale tahsilatı", () => api.post(`/api/workspace/accounts/${abc.id}/entries`, { kind: "in", amount: "300", method: "bank", bankAccountId: acc.ziraat.id, note: "ölçüm", date: "2026-10-15" }));
  const c = await rec("Çek alış", () => api.post("/api/workspace/cheques", { direction: "in", instrument: "cheque", amount: "750", issueDate: "2026-10-14", dueDate: "2026-11-14", accountId: abc.id, serialNo: `OLC-${r}` }));
  await rec("Bankaya Tahsile Ver", () => api.post(`/api/workspace/cheques/${c.data.id}/actions`, { action: "bank-deposit", date: "2026-10-15", bankAccountId: acc.ziraat.id }));
  await rec("Bankadan Geri Al", () => api.post(`/api/workspace/cheques/${c.data.id}/actions`, { action: "bank-withdraw", date: "2026-10-15" }));
  await rec("Bankaya Tahsile Ver (2)", () => api.post(`/api/workspace/cheques/${c.data.id}/actions`, { action: "bank-deposit", date: "2026-10-15", bankAccountId: acc.ziraat.id }));
  await rec("Tahsil Edildi (tahsildeki)", () => api.post(`/api/workspace/cheques/${c.data.id}/actions`, { action: "collect", date: "2026-10-15" }));
}
console.log(JSON.stringify(out, null, 1));
await s.close?.() ?? s.app.close();
rmSync(root, { recursive: true, force: true });
