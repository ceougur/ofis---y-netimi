// Bilinen sınır sondası (T11): bu dalda taksite sayılmış çekin karşılıksızı (çekli ters kayıt, 'out') yazıldıktan sonra GERÇEK v2.1.0 açılınca
// v2.1.0'ın Mutabakat Testi ve Geri Al'ı ne der? Kod değiştirmez. Koşum (worktree kökünden): node docs/kanit/2026-10-12/tahsile-ver/duzeltme-tur2/sonda-v210-donus.mjs
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { apiOf } from "../../../../../test/banka-210-ortak.mjs";
import { CURRENT, bootVersion } from "../../../../../test/guvenilirlik/surumler.mjs";

const CH = "/api/workspace/cheques";
const root = mkdtempSync(path.join(tmpdir(), "sonda-v210-"));
const dataDir = path.join(root, "data");
const backupDir = path.join(root, "backups");
const must = async (label, p) => {
  const r = await p;
  if (r.status !== 200) throw new Error(`${label}: ${r.status} ${JSON.stringify(r.data).slice(0, 300)}`);
  return r.data;
};
let ids;
{
  const s = await bootVersion(CURRENT, { dataDir, backupDir, now: "2026-10-08T12:00:00+03:00" });
  const api = apiOf((await s.login()).client);
  const buyer = await must("cari", api.post("/api/workspace/accounts", { name: "Sonda", type: "customer", registeredOn: "2026-09-01" }));
  const plan = await must("kart", api.post("/api/workspace/plans", { name: "Sonda Kart", accountId: buyer.id, total: "1.200", mode: "auto", count: 1, firstDue: "2026-11-30", registeredOn: "2026-10-01" }));
  const cheque = await must("çek", api.post(CH, { direction: "in", instrument: "cheque", amount: "1.200", issueDate: "2026-10-03", dueDate: "2026-11-05", accountId: buyer.id, planId: plan.id, serialNo: "S-1" }));
  await must("karşılıksız", api.post(`${CH}/${cheque.id}/actions`, { action: "bounce", date: "2026-10-08" }));
  ids = { cheque: cheque.id };
  await s.close();
}
{
  const old = await bootVersion("v2.1.0", { dataDir, backupDir, now: "2026-10-09T12:00:00+03:00" });
  const api = apiOf((await old.login()).client);
  const integrity = await api.get("/api/workspace/ledger/integrity");
  console.log("v2.1.0 Mutabakat", JSON.stringify({ status: integrity.status, ok: integrity.data?.ok, bad: integrity.data?.checks?.filter(c => !c.ok).map(c => [c.code, c.sample]) }));
  const other = await api.post(CH, { direction: "in", instrument: "cheque", amount: "300", issueDate: "2026-10-09", dueDate: "2026-11-09", drawer: "Başka", serialNo: "S-2" });
  console.log("v2.1.0 yeni çek", other.status, other.data?.code || "");
  const undo = await api.post(`${CH}/${ids.cheque}/undo`, {});
  console.log("v2.1.0 karşılıksızı Geri Al", undo.status, undo.data?.code || "", (undo.data?.error || "").slice(0, 200));
  const after = await api.get("/api/workspace/ledger/integrity");
  console.log("v2.1.0 Mutabakat (Geri Al sonrası)", JSON.stringify({ ok: after.data?.ok, bad: after.data?.checks?.filter(c => !c.ok).map(c => [c.code, c.sample]) }));
  await old.close();
}
{
  const s = await bootVersion(CURRENT, { dataDir, backupDir, now: "2026-10-10T12:00:00+03:00" });
  const api = apiOf((await s.login()).client);
  const integrity = await api.get("/api/workspace/ledger/integrity");
  console.log("bu dal yeniden: Mutabakat", JSON.stringify({ ok: integrity.data?.ok, bad: integrity.data?.checks?.filter(c => !c.ok).map(c => [c.code, c.sample]) }));
  await s.close();
}
rmSync(root, { recursive: true, force: true });
