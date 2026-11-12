// Ç5-A tur 1c eşdeğerlik (ders 47): bir kod kökünün defter çıktıları — aynı veri kopyasında taban ve tur 1c ayrı ayrı koşulur, sonra karşılaştırılır (esdeger-karsilastir.mjs).
// Kullanım: node esdeger.mjs <kod kökü> <veri kökü (data/ backups/)> <bugün YYYY-AA-GG> <çıktı.json>
// Çıktı: her uç için yanıtın kararlı JSON'u (süre alanları çıkarılmış) ve sha256'sı; ayrıca build() maddelerinin özeti (madde sayısı + sha256, sıra dahil).
import path from "node:path";
import { createHash } from "node:crypto";
import { writeFileSync } from "node:fs";
import { pathToFileURL } from "node:url";

process.env.HUKUK_LICENSE_URL ||= "http://127.0.0.1:9";
const [root, dir, today, outFile] = process.argv.slice(2);
const { createApp } = await import(pathToFileURL(path.join(root, "server", "app.mjs")).href);
const { createClient, ADMIN_PASSWORD } = await import(pathToFileURL(path.join(root, "test", "helpers.mjs")).href);
// 100 bin şablonu ölçüm düzeneğinin parolasıyla, sürüm fikstürleri test/helpers.mjs'inkiyle kurulmuştur (PAROLA=fikstur).
const PASS = process.env.PAROLA === "fikstur" ? ADMIN_PASSWORD : "Kapi-Olcum-2026!";
const app = createApp({
  dataDir: path.join(dir, "data"), backupDir: path.join(dir, "backups"), logLevel: "silent", scheduleBackups: false, maxCompanies: 10,
  env: { HUKUK_ADMIN_PASSWORD: PASS, HUKUK_DATASET_AUTOSYNC: "0" }, license: { enforce: false, machineId: "0123456789abcdef0123456789abcdef" },
  startLicenseTimers: false, integrityScan: false, analysisWorker: false, now: { time: `${today}T12:00:00+03:00`, fixed: true }, moneyStrict: false,
});
const { port } = await app.listen(0, "127.0.0.1");
const st = app.ledger.snapshots.state();
if (st.pending) await app.ledger.snapshots.runPending();
const client = createClient(`http://127.0.0.1:${port}`);
const login = await client.login("admin", PASS);
if (login.status !== 200) throw new Error(`giriş ${login.status} ${JSON.stringify(login.data).slice(0, 200)}`);
const VOLATILE = new Set(["durationMs", "ms", "generatedAt", "elapsedMs", "tookMs"]);
const stable = value => {
  if (Array.isArray(value)) return value.map(stable);
  // Mutabakat Günlüğü satırının rastgele kimliği (int-<uuid>; her yazımda yeni) karşılaştırılmaz; içeriği (eylem, an, özet, ayrıntı) karşılaştırılır.
  if (value && typeof value === "object") return Object.fromEntries(Object.keys(value).filter(key => !VOLATILE.has(key) && !(key === "id" && /^int-[0-9a-f-]{36}$/.test(String(value[key])))).sort().map(key => [key, stable(value[key])]));
  return value;
};
const sha = text => createHash("sha256").update(text).digest("hex");
const year = today.slice(0, 4);
const RANGE = `from=${year}-01-01&to=${year}-12-31`;
const PREV = `from=${Number(year) - 1}-01-01&to=${Number(year) - 1}-12-31`;
const paths = {
  "GET ledger": "/api/workspace/ledger",
  "GET ledger (dönem)": `/api/workspace/ledger?${RANGE}`,
  "Yevmiye Defteri (bu yıl)": `/api/workspace/report-center/yevmiye?${RANGE}`,
  "Yevmiye Defteri (geçen yıl)": `/api/workspace/report-center/yevmiye?${PREV}`,
  "Yevmiye Defteri (bütün zaman)": "/api/workspace/report-center/yevmiye?from=2000-01-01&to=2099-12-31",
  "Hesap Planı Mizanı (bu yıl)": `/api/workspace/report-center/hesap-mizani?${RANGE}`,
  "Hesap Planı Mizanı (geçen yıl)": `/api/workspace/report-center/hesap-mizani?${PREV}`,
  "Alt Hesap Mizanı": `/api/workspace/report-center/alt-hesap-mizani?${RANGE}`,
  "Defter Mutabakatı": "/api/workspace/report-center/defter-mutabakati",
  "Mutabakat Testi": "/api/workspace/ledger/integrity",
  "Alacak Yaşlandırma": "/api/workspace/report-center/alacak-yaslandirma",
  "Açılış Olabilir": "/api/workspace/opening-review",
  "Açılış Olabilir (hepsi)": "/api/workspace/opening-review?all=1",
};
const out = { root, dir, today, tz: process.env.TZ || "", schema: app.store.get("PRAGMA user_version").user_version, freeze: app.ledger.snapshots.state(), outputs: {} };
for (const [name, url] of Object.entries(paths)) {
  const response = await client.get(url);
  const text = JSON.stringify(stable({ status: response.status, data: response.data }));
  out.outputs[name] = { status: response.status, sha: sha(text), bytes: text.length, text: text.length <= 400_000 ? text : undefined };
}
// Türetmenin kendisi (sıra dahil): build() ve süzgeçli build (kapının yolu) — her cari için değil, ilk 20 carinin süzgeciyle.
const entries = app.ledger.build();
const entriesText = JSON.stringify(entries);
out.outputs["build() maddeleri"] = { status: 200, sha: sha(entriesText), bytes: entriesText.length, count: entries.length };
const parties = app.store.all("SELECT id FROM accounts WHERE deleted_at IS NULL ORDER BY rowid LIMIT 20").map(row => row.id);
const filtered = app.ledger.build({ parties: new Set(parties) });
const filteredText = JSON.stringify(filtered);
out.outputs["build(süzgeç: 20 cari)"] = { status: 200, sha: sha(filteredText), bytes: filteredText.length, count: filtered.length };
writeFileSync(outFile, JSON.stringify(out, null, 1));
console.log(`${root} · şema ${out.schema} · ${Object.entries(out.outputs).map(([k, v]) => `${k} ${v.status} ${v.sha.slice(0, 10)}`).join(" · ")}`);
await app.close();
