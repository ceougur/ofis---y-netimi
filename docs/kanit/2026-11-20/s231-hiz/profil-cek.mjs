// S231 çek hızı nedeni (ölçerek): olc-s223.mjs ile AYNI ön adımlar (cari Excel 2.000 + taksit Excel 2.000, hepsi yeni ad), sonra çek 500 (hepsi yeni ad).
// Çek isteği sırasında accounts servisinin matchName / personIndex işlevleri ve store.all / store.get çağrıları zaman sayacıyla sarılır (yalnız ölçüm).
// Kullanım: node profil-cek.mjs <kod kökü> <veri kopyası> [tekrar=5]
import path from "node:path";
import { pathToFileURL } from "node:url";

process.env.HUKUK_LICENSE_URL ||= "http://127.0.0.1:9";
const [root, dir, repeat = "5"] = process.argv.slice(2);
const { createApp } = await import(pathToFileURL(path.join(root, "server", "app.mjs")).href);
const { createClient } = await import(pathToFileURL(path.join(root, "test", "helpers.mjs")).href);
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
if (process.env.MIKRO) {
  const { foldPersonName } = await import(pathToFileURL(path.join(root, "server", "lib", "names.mjs")).href);
  const tm = (label, fn, n = 20) => { const xs = []; let out; for (let k = 0; k < n; k += 1) { const s = performance.now(); out = fn(); xs.push(performance.now() - s); } xs.sort((a, b) => a - b); console.log(`${label}: en iyi ${xs[0].toFixed(2)} ortanca ${xs[n >> 1].toFixed(2)} ms`); return out; };
  const rows = tm("SQL id,name", () => store.all("SELECT id, name FROM accounts WHERE deleted_at IS NULL"));
  tm("SQL name", () => store.all("SELECT name FROM accounts WHERE deleted_at IS NULL"));
  tm("fold hepsi", () => { let n = 0; for (const row of rows) n += foldPersonName(row.name).length; return n; });
  tm("Map+Set", () => { const m = new Map(); for (const row of rows) { const k = foldPersonName(row.name); let s = m.get(k); if (!s) m.set(k, (s = new Set())); s.add(row.id); } return m; });
  tm("Map tekil", () => { const m = new Map(); for (const row of rows) { const k = foldPersonName(row.name); const v = m.get(k); if (v === undefined) m.set(k, row.id); else if (typeof v === "string") m.set(k, [v, row.id]); else v.push(row.id); } return m; });
  const PAIRS = [["I", "ı"], ["İ", "i"], ["Ç", "ç"], ["Ğ", "ğ"], ["Ö", "ö"], ["Ş", "ş"], ["Ü", "ü"], ["Â", "â"], ["Î", "î"], ["Û", "û"]];
  const skelSql = col => `lower(${PAIRS.reduce((sql, [a, b]) => `replace(${sql}, '${a}', '${b}')`, `replace(${col}, ' ', '')`)})`;
  const GLOB = "*[^ -~ÇçĞğİıÖöŞşÜüÂâÎîÛû]*";
  const wanted = Array.from({ length: 500 }, (_, k) => foldPersonName(`Çek Yenişehirli Çağlayan ${k}`).replaceAll(" ", ""));
  const narrow = `SELECT id, name FROM accounts WHERE deleted_at IS NULL AND (${skelSql("name")} IN (SELECT value FROM json_each(?)) OR name GLOB ?)`;
  const got = tm("SQL daraltılmış", () => store.all(narrow, JSON.stringify(wanted), GLOB));
  console.log(`daraltılmış satır ${got.length}; güvensiz ${store.get("SELECT COUNT(*) AS n FROM accounts WHERE deleted_at IS NULL AND name GLOB ?", GLOB).n}`);
  const hit = Array.from({ length: 500 }, (_, k) => foldPersonName(`CARİ YENİŞEHİRLİ ÇAĞLAYAN ${k}`).replaceAll(" ", ""));
  console.log(`var olan 500 ad: ${store.all(narrow, JSON.stringify(hit), GLOB).length} satır`);
  tm("yalnız GLOB", () => store.all("SELECT id FROM accounts WHERE deleted_at IS NULL AND name GLOB ?", GLOB));
  tm("yalnız iskelet IN", () => store.all(`SELECT id FROM accounts WHERE deleted_at IS NULL AND ${skelSql("name")} IN (SELECT value FROM json_each(?))`, JSON.stringify(wanted)));
  tm("yalnız lower IN", () => store.all(`SELECT id FROM accounts WHERE deleted_at IS NULL AND lower(name) IN (SELECT value FROM json_each(?))`, JSON.stringify(wanted)));
  tm("tam tarama sayım", () => store.all(`SELECT COUNT(*) AS n FROM accounts WHERE deleted_at IS NULL AND name <> ''`));
  console.log("sqlite", store.get("SELECT sqlite_version() AS v").v);
  tm("SQL concat", () => store.get("SELECT COUNT(*) AS n, group_concat(id || char(1) || name, char(0)) AS s FROM accounts WHERE deleted_at IS NULL"));
  tm("concat+fold+split+scan", () => {
    const row = store.get("SELECT COUNT(*) AS n, group_concat(id || char(1) || name, char(0)) AS s FROM accounts WHERE deleted_at IS NULL");
    const raw = row.s || "";
    let f = raw.normalize("NFC").replace(/\s+/g, " ").replace(/ ?([\0\x01]) ?/g, "$1");
    f = (f.includes("I") || f.includes("İ") ? f.replace(/[Iİ]/g, c => (c === "I" ? "ı" : "i")) : f).toLowerCase();
    const items = f.split("\0");
    const want = new Set(wanted);
    let hits = 0;
    for (const item of items) { const k = item.slice(item.indexOf("\x01") + 1); if (want.has(k.replaceAll(" ", ""))) hits += 1; }
    return hits;
  });
  tm("satır+fold+scan", () => {
    const want = new Set(wanted);
    let hits = 0;
    for (const row of store.all("SELECT id, name FROM accounts WHERE deleted_at IS NULL")) if (want.has(foldPersonName(row.name).replaceAll(" ", ""))) hits += 1;
    return hits;
  });
  tm("NOCASE 500", () => { for (let k = 0; k < 500; k += 1) store.all("SELECT id FROM accounts WHERE deleted_at IS NULL AND name = ? COLLATE NOCASE LIMIT 2", `Çek Yenişehirli Çağlayan ${k}`); });
  tm("NOCASE 500 lower", () => { for (let k = 0; k < 500; k += 1) store.all("SELECT id FROM accounts WHERE deleted_at IS NULL AND name = ? COLLATE NOCASE LIMIT 2", `çek yenişehirli çağlayan ${k}`); });
  await app.close?.();
  process.exit(0);
}

const acc = app.context.accounts;
const t = { nocase: 0, nocaseN: 0, map: 0, mapN: 0, matchName: 0, matchNameN: 0, personIndex: 0, all: 0, allN: 0, get: 0, getN: 0, run: 0, runN: 0 };
let active = false;
const wrap = (obj, key, slot) => {
  const fn = obj[key];
  if (typeof fn !== "function") return;
  obj[key] = function (...args) {
    if (!active) return fn.apply(this, args);
    const s = performance.now();
    try {
      return fn.apply(this, args);
    } finally {
      t[slot] += performance.now() - s;
      if (`${slot}N` in t) t[`${slot}N`] += 1;
    }
  };
};
wrap(acc, "matchName", "matchName");
wrap(acc, "personIndex", "personIndex");
{
  const fn = store.all;
  store.all = function (sql, ...args) {
    if (!active) return fn.call(this, sql, ...args);
    const s = performance.now();
    try {
      return fn.call(this, sql, ...args);
    } finally {
      const d = performance.now() - s;
      t.all += d;
      t.allN += 1;
      if (String(sql).includes("COLLATE NOCASE LIMIT 2")) (t.nocase += d), (t.nocaseN += 1);
      if (sql === "SELECT id, name FROM accounts WHERE deleted_at IS NULL") (t.map += d), (t.mapN += 1);
    }
  };
}
wrap(store, "get", "get");
wrap(store, "run", "run");
const r = v => Math.round(v * 10) / 10;
const count = store.get("SELECT COUNT(*) AS n FROM accounts WHERE deleted_at IS NULL").n;
console.log(`kod ${root} · cari ${count} · matchName ${typeof acc.matchName}`);
for (let k = 0; k < Number(repeat); k += 1) {
  for (const key of Object.keys(t)) t[key] = 0;
  active = true;
  const s = performance.now();
  const res = await client.post("/api/workspace/cheques/import", {
    matrix: [["Çek No", "Banka", "Keşideci", "Tutar", "Vade"], ...people(500, `Çek${k}`).map(([name], i) => [`P${k}-${i}`, "Ziraat", name, "750", "01.12.2026"])],
    headerAt: 0, roles: { 0: "serial", 1: "bank", 2: "drawer", 3: "amount", 4: "due" }, direction: "in", fileName: `p-cek-${k}.xlsx`,
  });
  const ms = performance.now() - s;
  active = false;
  console.log(`tur ${k}: durum ${res.status} · toplam ${r(ms)} ms · matchName ${r(t.matchName)} ms (${t.matchNameN}) · personIndex ${r(t.personIndex)} · store.all ${r(t.all)} ms (${t.allN}) [NOCASE ${r(t.nocase)} (${t.nocaseN}), harita SQL ${r(t.map)} (${t.mapN})] · store.get ${r(t.get)} ms (${t.getN}) · store.run ${r(t.run)} ms (${t.runN})`);
}
await app.close?.();
process.exit(0);
