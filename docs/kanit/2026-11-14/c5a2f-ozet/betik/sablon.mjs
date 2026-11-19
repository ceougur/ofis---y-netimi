// v2.4.9'un GERÇEK koduyla şablon veri: bir cari, üç "Açılış…" Borç Yaz (göç 48 aday yapar), v2.4.9 kilidi 05.10.2026. Kullanım: node sablon.mjs <hedef klasör>
import { mkdirSync, writeFileSync } from "node:fs";
import path from "node:path";
import { SV, must } from "./ortak.mjs";
const target = process.argv[2];
mkdirSync(target, { recursive: true });
const dataDir = path.join(target, "data");
const backupDir = path.join(target, "backups");
const old = await SV.bootVersion("v2.4.9", { dataDir, backupDir, now: { time: "2026-12-30T12:00:00+03:00", fixed: true } });
const ids = {};
try {
  const o = await old.login();
  await o.post("/api/workspace/bank/setup/dismiss", {});
  const a = await must("cari", o.post("/api/workspace/accounts", { name: "Sıra Deneme Müşteri", type: "customer", registeredOn: "2026-09-01" }));
  const b = await must("cari2", o.post("/api/workspace/accounts", { name: "Sıra Deneme Müşteri", type: "customer", registeredOn: "2026-09-01", phone: "05550000002" }));
  ids.account = a.id;
  ids.account2 = b.id;
  const add = async (acc, note, amount, date) => {
    await must(note, o.post(`/api/workspace/accounts/${acc}/entries`, { kind: "debt", amount, date, note }));
    return old.app.store.get("SELECT id FROM account_entries WHERE account_id = ? AND note = ? AND date = ?", acc, note, date).id;
  };
  ids.r1 = await add(a.id, "Açılış bakiyesi", "700", "2026-10-02");
  ids.r2 = await add(a.id, "Açılış devri", "300", "2026-11-10");
  ids.r3 = await add(b.id, "Açılış farkı", "50", "2026-12-30");
  await must("kilit", o.put("/api/admin/period-lock", { lockedUntil: "2026-10-05" }));
} finally {
  await old.close();
}
writeFileSync(path.join(target, "ids.json"), JSON.stringify(ids));
console.log(JSON.stringify(ids));
