// Ç2 tur 3 — integrity.mjs:803 / :833 ölçüsü: açılışta bulunan sapmanın (taban, "baseline") ayrıntısı 20.000 karakteri aşınca ne olur?
// Veri programın kendi yoluyla (cari tahsilatı) yazılır; sonra kapalı sunucunun dosyasında 5 satırın tarihi uzun geçersiz metne çevrilir (eski sürümden bozuk veri benzetimi).
// Kullanım: HUKUK_LICENSE_URL=http://127.0.0.1:9 node taban-kesik.mjs <kod kökü> <uzunluk>
import { mkdirSync, rmSync } from "node:fs";
import path from "node:path";
import { DatabaseSync } from "node:sqlite";
import { pathToFileURL } from "node:url";

const [root, lenArg] = process.argv.slice(2);
const len = Number(lenArg || 6000);
const h = await import(pathToFileURL(path.join(root, "test", "helpers.mjs")).href);
const base = `/tmp/claude-0/-home-user/de5e1cbf-7e68-5683-b7bb-f27655eaed4f/scratchpad/c2t3-calisma/taban-${path.basename(root)}-${len}`;
rmSync(base, { recursive: true, force: true });
mkdirSync(base, { recursive: true });
const dirs = { dataDir: `${base}/data`, backupDir: `${base}/backups` };
const open = async fn => {
  const server = await h.startTestServer({ now: { time: "2027-01-10T10:00:00+03:00", fixed: true }, ...dirs });
  try {
    return await fn(server);
  } finally {
    await server.close();
  }
};
const file = await open(async server => {
  const admin = await h.loginAdmin(server);
  const acc = (await admin.post("/api/workspace/accounts", { name: "Taban Cari", type: "customer", registeredOn: "2026-12-01" })).data.data;
  for (let i = 0; i < 6; i += 1) {
    const r = await admin.post(`/api/workspace/accounts/${acc.id}/entries`, { kind: "in", amount: String(10 + i), date: "2027-01-05" });
    if (r.status !== 200) throw new Error(`tahsilat ${r.status}`);
  }
  return server.app.config.dbPath;
});
{
  const db = new DatabaseSync(file);
  const garbage = "9".repeat(len);
  db.prepare("UPDATE account_entries SET date = ? || id WHERE id IN (SELECT id FROM account_entries ORDER BY rowid LIMIT 5)").run(garbage);
  db.prepare("UPDATE cash_entries SET date = ? || id WHERE id IN (SELECT id FROM cash_entries ORDER BY rowid LIMIT 5)").run(garbage);
  db.close();
}
const baselines = srv => srv.app.store.all("SELECT detail_json AS detail FROM integrity_log WHERE action = 'baseline' ORDER BY rowid");
const valid = text => {
  try {
    JSON.parse(text);
    return true;
  } catch {
    return false;
  }
};
for (const turn of [1, 2, 3]) {
  await open(async server => {
    const rows = baselines(server);
    const admin = await h.loginAdmin(server);
    const scan = await admin.get("/api/workspace/ledger/integrity");
    const failures = server.app.context.integrity.run().failures;
    const plain = JSON.stringify(failures);
    console.log(`açılış ${turn}: ${JSON.stringify({ tabanSatiri: rows.length, sonUzunluk: rows.at(-1)?.detail.length, sonGecerli: rows.length ? valid(rows.at(-1).detail) : null, tamUzunluk: plain.length, birebir: rows.at(-1)?.detail === plain, basarisiz: failures.map(item => item.code), mutabakatTestiHTTP: scan.status })}`);
  });
}
rmSync(base, { recursive: true, force: true });
