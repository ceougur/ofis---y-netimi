// S231 çek hızı: personIndex ↔ personIndexFor kurulum süresi (ilk ids çağrısı) ve parçaları. Kullanım: node profil2.mjs <kod> <veri kopyası>
import path from "node:path";
import { pathToFileURL } from "node:url";

process.env.HUKUK_LICENSE_URL ||= "http://127.0.0.1:9";
const [root, dir] = process.argv.slice(2);
const { createApp } = await import(pathToFileURL(path.join(root, "server", "app.mjs")).href);
const { createClient } = await import(pathToFileURL(path.join(root, "test", "helpers.mjs")).href);
const names = await import(pathToFileURL(path.join(root, "server", "lib", "names.mjs")).href);
const PASS = "Kapi-Olcum-2026!";
const app = createApp({
  dataDir: path.join(dir, "data"), backupDir: path.join(dir, "backups"), logLevel: "silent", scheduleBackups: false,
  env: { HUKUK_ADMIN_PASSWORD: PASS, HUKUK_DATASET_AUTOSYNC: "0" }, license: { enforce: false, machineId: "0123456789abcdef0123456789abcdef" },
  startLicenseTimers: false, integrityScan: false, analysisWorker: false, now: "2026-10-08T12:00:00+03:00", moneyStrict: false, legacyTableTransfer: true,
});
const { port } = await app.listen(0, "127.0.0.1");
const client = createClient(`http://127.0.0.1:${port}`);
await client.login("admin", PASS);
const fresh = (prefix, i) => `${prefix} Yenişehirli Çağlayan ${i}`;
const people = (n, prefix) => Array.from({ length: n }, (_, i) => [fresh(prefix, i), `0599 ${String(100000 + i).slice(0, 3)} ${String(i % 100).padStart(2, "0")} ${String((i * 7) % 100).padStart(2, "0")}`]);
await client.post("/api/workspace/accounts/import", { matrix: [["Ad Soyad", "Telefon"], ...people(2000, "Cari")], headerAt: 0, roles: { 0: "name", 1: "phone" }, mode: "skip", fileName: "p-cari.xlsx" });
await client.post("/api/workspace/plans/import", {
  matrix: [["Ad Soyad", "Telefon", "Toplam Tutar", "Taksit Sayısı", "İlk Vade"], ...people(2000, "Taksit").map(([n, p]) => [n, p, "1.200", "3", "01.11.2026"])],
  headerAt: 0, roles: { 0: "name", 1: "phone", 2: "total", 3: "count", 4: "firstDue" }, linkRecords: false, fileName: "p-taksit.xlsx",
});
const store = app.store;
const acc = app.context.accounts;
const drawers = Array.from({ length: 500 }, (_, i) => fresh("Çek", i));
const tm = (label, fn, n = 20) => {
  const xs = [];
  for (let k = 0; k < n; k += 1) {
    const s = performance.now();
    fn();
    xs.push(performance.now() - s);
  }
  xs.sort((a, b) => a - b);
  console.log(`${label}: en iyi ${xs[0].toFixed(2)} ortanca ${xs[n >> 1].toFixed(2)} ms`);
};
const SQL = "SELECT COUNT(*) AS n, COALESCE(SUM(instr(name, char(31)) > 0 OR instr(name, char(30)) > 0), 0) AS bad, COALESCE(group_concat(name, char(31)), '') AS s FROM accounts WHERE deleted_at IS NULL";
tm("personIndex kurulum + 500 ids", () => { const ix = acc.personIndex(); for (const d of drawers) ix.ids(d); });
if (acc.personIndexFor) tm("personIndexFor kurulum + 500 ids", () => { const ix = acc.personIndexFor(drawers); for (const d of drawers) ix.ids(d); });
tm("SQL birleşik (instr ile)", () => store.get(SQL));
tm("SQL birleşik (instr yok)", () => store.get("SELECT COUNT(*) AS n, group_concat(id || char(30) || name, char(31)) AS s FROM accounts WHERE deleted_at IS NULL"));
tm("SQL satır", () => store.all("SELECT id, name FROM accounts WHERE deleted_at IS NULL"));
const s = store.get(SQL).s;
if (names.foldJoinedNames) tm("foldJoinedNames", () => names.foldJoinedNames(s));
tm("split", () => s.split("\u001f"));
if (names.foldJoinedNames) {
  const f = names.foldJoinedNames(s);
  tm("split ham + katlanmış", () => { s.split("\u001f"); f.split("\u001f"); });
  const keys = new Set(drawers.map(names.foldPersonName));
  const raw = s.split("\u001f"), fo = f.split("\u001f");
  tm("döngü", () => { let h = 0; for (let i = 0; i < raw.length; i += 1) { const cut = raw[i].indexOf("\u001e"); if (fo[i].indexOf("\u001e") !== cut) break; if (keys.has(fo[i].slice(cut + 1))) h += 1; } return h; });
  tm("normalize", () => s.normalize("NFC"));
  tm("boşluk regex", () => s.replace(/\s+/g, " "));
  tm("lower", () => s.toLowerCase());
  console.log("metin uzunluğu", s.length);
}
tm("500 foldPersonName", () => { for (const d of drawers) names.foldPersonName(d); });
tm("500 matchName (personIndex)", () => { const ix = acc.personIndex(); for (const d of drawers) acc.matchName(d, ix); });
if (acc.personIndexFor) tm("500 matchName (personIndexFor)", () => { const ix = acc.personIndexFor(drawers); for (const d of drawers) acc.matchName(d, ix); });
await app.close?.();
process.exit(0);
