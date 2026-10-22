// 2.4.3 (163dd5d GERÇEK kodu) veri üretir → 2.4.4 adayı açar (v31) → personel eklenir → 2.4.3 aynı dosyayı yeniden açar (geri dönüş).
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { pathToFileURL } from "node:url";
const [oldRoot, newRoot] = process.argv.slice(2);
const root = mkdtempSync(path.join(tmpdir(), "personel-gecis-"));
const opts = { dataDir: path.join(root, "data"), backupDir: path.join(root, "backups"), logLevel: "silent", scheduleBackups: false, env: { HUKUK_ADMIN_PASSWORD: "Gecis-244-Admin!", HUKUK_DATASET_AUTOSYNC: "0", HUKUK_LICENSE_URL: "http://127.0.0.1:9" }, license: { enforce: false, machineId: "0123456789abcdef0123456789abcd44" } };
const { createClient } = await import(pathToFileURL(path.join(newRoot, "test", "helpers.mjs")).href);
const start = async dir => { const { createApp } = await import(pathToFileURL(path.join(dir, "server", "app.mjs")).href + `?${Math.random()}`); const app = createApp(opts); const { port } = await app.listen(0, "127.0.0.1"); const c = createClient(`http://127.0.0.1:${port}`); await c.login("admin", "Gecis-244-Admin!"); return { app, c }; };
const d = r => { if (r.status !== 200) throw new Error(`${r.status} ${JSON.stringify(r.data)}`); return r.data.data; };
let ok = true; let n = 0; let bad = 0; const check = (c, m) => { console.log(`${c ? "✓" : "✗"} ${m}`); n += 1; if (!c) bad += 1; ok &&= c; };
let s = await start(oldRoot);
d(await s.c.post("/api/workspace/accounts", { name: "Eski Cari", type: "customer" }));
check(s.app.store.get("PRAGMA user_version").user_version === 30, "2.4.3 veri dosyası v30");
await s.app.close();
s = await start(newRoot);
check(s.app.store.get("PRAGMA user_version").user_version === 31, "2.4.4 adayı v31'e geçirdi");
check(d(await s.c.get("/api/workspace/accounts")).accounts.some(a => a.name === "Eski Cari"), "eski cari duruyor");
d(await s.c.post("/api/workspace/staff", { fullName: "Geçiş Personeli", salary: "10.000" }));
check(d(await s.c.get("/api/workspace/staff")).items.length === 1, "personel kartı eklendi");
await s.app.close();
s = await start(oldRoot);
check(s.app.store.get("PRAGMA user_version").user_version === 31, "2.4.3 v31 dosyayı açtı (göç yok)");
check(d(await s.c.get("/api/workspace/accounts")).accounts.some(a => a.name === "Eski Cari"), "2.4.3'te cari okunur");
check((await s.c.get("/api/workspace/staff")).status === 404, "2.4.3'te personel ucu yok (404), veri dokunulmaz");
check(s.app.store.get("SELECT COUNT(*) AS n FROM staff_members").n === 1, "kart dosyada korunur");
await s.app.close();
s = await start(newRoot);
check(d(await s.c.get("/api/workspace/staff")).items[0]?.fullName === "Geçiş Personeli", "2.4.4'e dönünce kart yerinde");
await s.app.close();
rmSync(root, { recursive: true, force: true });
console.log(`# tests ${n}
# pass ${n - bad}
# fail ${bad}
# cancelled 0
# skipped 0
# todo 0`); process.exitCode = ok ? 0 : 1;
