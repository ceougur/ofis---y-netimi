// Ç5-A tur 2b hız ölçümü (tur 1'in betiği + Kural Farkı Düzeltme ön izlemesi) (ders 47, 53): değişen her yol, temiz 100 bin satırlık verinin KENDİ kopyasında, önce (taban) / sonra.
// Kullanım: HUKUK_LICENSE_URL=http://127.0.0.1:9 flock -x -n <olcum.lock> node olc-c5a1.mjs <kod kökü> <veri kopyası> [tekrar=2]
import { readFileSync } from "node:fs";
import path from "node:path";
import { monitorEventLoopDelay } from "node:perf_hooks";
import { pathToFileURL } from "node:url";

process.env.HUKUK_LICENSE_URL ||= "http://127.0.0.1:9";
const [root, dir, repeatText = "2"] = process.argv.slice(2);
const repeat = Number(repeatText) || 2;
const load = () => readFileSync("/proc/loadavg", "utf8").trim().split(" ").slice(0, 3).join(" ");
console.log(`kod ${root} · veri ${dir} · yük (başta) ${load()} · TZ ${process.env.TZ || "(yerel)"}`);
const { createApp } = await import(pathToFileURL(path.join(root, "server", "app.mjs")).href);
const { createClient } = await import(pathToFileURL(path.join(root, "test", "helpers.mjs")).href);
const PASS = "Kapi-Olcum-2026!";
const t0 = performance.now();
const app = createApp({
  dataDir: path.join(dir, "data"), backupDir: path.join(dir, "backups"), logLevel: "silent", scheduleBackups: false,
  env: { HUKUK_ADMIN_PASSWORD: PASS, HUKUK_DATASET_AUTOSYNC: "0" }, license: { enforce: false, machineId: "0123456789abcdef0123456789abcdef" },
  startLicenseTimers: false, integrityScan: false, analysisWorker: false, now: "2026-10-08T12:00:00+03:00", moneyStrict: false,
});
const { port } = await app.listen(0, "127.0.0.1");
console.log(`açılış (göç dahil) ${Math.round(performance.now() - t0)} ms · şema ${app.store.get("PRAGMA user_version").user_version}`);
// Tur 1b: kilitli kipte göç 47'nin bekleyen 2.4.9 koşusu (donma) — süresi; sonra okumalar karma (S127 bağlılık denetimi bu yolda koşar).
{
  const st = app.ledger.snapshots.state();
  if (st.pending) {
    const d0 = performance.now();
    await app.ledger.snapshots.runPending();
    console.log(`donma (bekleyen ${st.pending.rule} koşusu, ${st.pending.through}'e kadar) ${Math.round(performance.now() - d0)} ms · kapsam ${app.ledger.snapshots.state().coverage}`);
  } else console.log(`donma: bekleyen koşu yok (kapsam ${st.coverage || "—"})`);
}
const client = createClient(`http://127.0.0.1:${port}`);
if ((await client.login("admin", PASS)).status !== 200) throw new Error("giriş");
const store = app.store;
const counts = store.get("SELECT (SELECT COUNT(*) FROM accounts WHERE deleted_at IS NULL) AS a, (SELECT COUNT(*) FROM account_entries) AS e, (SELECT COUNT(*) FROM cash_entries) AS c, (SELECT COUNT(*) FROM cheques) AS k, (SELECT COUNT(*) FROM bank_lines) AS b");
console.log(`veri: ${counts.a} cari, ${counts.e} cari satırı, ${counts.c} Kasa satırı, ${counts.k} evrak, ${counts.b} banka satırı`);
const acc = store.get("SELECT a.id FROM accounts a WHERE a.deleted_at IS NULL AND a.type = 'customer' ORDER BY (SELECT COUNT(*) FROM account_entries e WHERE e.account_id = a.id) DESC LIMIT 1").id;
const ev = store.get("SELECT id FROM fin_events WHERE type = 'opening' LIMIT 1")?.id || store.get("SELECT id FROM fin_events LIMIT 1")?.id;
const h = monitorEventLoopDelay({ resolution: 5 });
h.enable();
const r = v => Math.round(v * 10) / 10;
const timed = async (label, call) => {
  h.reset();
  const s = performance.now();
  const res = await call();
  const ms = performance.now() - s;
  const gate = app.integrity?.stats?.().gate || {};
  console.log(`  ${label}: ${res.status} · ${r(ms)} ms · olay döngüsü en çok ${r(h.max / 1e6)} ms${label.includes("YAZIM") ? ` · kapı yolu ${gate.path}${gate.reason ? ` (neden: ${gate.reason})` : ""} · kapı ${r(gate.ms || 0)} ms` : ""}`);
  return res;
};
const RANGE = "from=2026-01-01&to=2026-12-31";
for (let i = 0; i < repeat; i += 1) {
  console.log(`tur ${i + 1} · yük ${load()}`);
  await timed("Mizan + mutabakat (GET ledger)", () => client.get("/api/workspace/ledger"));
  await timed("Yevmiye Defteri (rapor)", () => client.get(`/api/workspace/report-center/yevmiye?${RANGE}`));
  await timed("Hesap Planı Mizanı (rapor)", () => client.get(`/api/workspace/report-center/hesap-mizani?${RANGE}`));
  await timed("Alt Hesap Mizanı (rapor)", () => client.get(`/api/workspace/report-center/alt-hesap-mizani?${RANGE}`));
  await timed("Defter Mutabakatı (rapor)", () => client.get("/api/workspace/report-center/defter-mutabakati"));
  await timed("Mutabakat Testi (GET ledger/integrity)", () => client.get("/api/workspace/ledger/integrity"));
  await timed("Alacak Yaşlandırma (rapor)", () => client.get("/api/workspace/report-center/alacak-yaslandirma"));
  await timed("Yevmiye Defteri bütün zaman (rapor)", () => client.get("/api/workspace/report-center/yevmiye?from=2000-01-01&to=2099-12-31"));
  if (ev) await timed("Banka İşlem Kartı (GET bank/events)", () => client.get(`/api/workspace/bank/events/${encodeURIComponent(ev)}`));
  await timed("YAZIM Borç Yaz (bütünlük kapısı)", () => client.post(`/api/workspace/accounts/${acc}/entries`, { kind: "debt", amount: "10", note: `ölçüm ${i}`, date: "2026-10-08" }));
  await timed("YAZIM evrak (alınan çek, carili)", () => client.post("/api/workspace/cheques", { direction: "in", instrument: "cheque", serialNo: `OLC-${i}-${Date.now()}`, bank: "Akbank", accountId: acc, amount: "10", issueDate: "2026-10-08", dueDate: "2026-12-08" }));
  await timed("Açılış Olabilir listesi (sayfasız; tur 1 ucu)", () => client.get("/api/workspace/opening-review"));
  await timed("Açılış Olabilir listesi sayfalı (tur 2c; tabanda limit yok sayılır)", () => client.get("/api/workspace/opening-review?limit=200&offset=0&all=1"));
  await timed("Zil sayısı (tur 2c; tabanda tam liste)", () => client.get("/api/workspace/opening-review?counts=1"));
  await timed("Kural Farkı Düzeltme ön izlemesi", () => client.get("/api/admin/ledger/rule-diff-correction"));
  await timed("Açılış Eşleştirme GET (tur 2c; tabanda 404)", () => client.get("/api/admin/ledger/opening-match?date=2026-10-08"));
  await timed("Açılış Eşleştirme ön izleme (tur 2c; tabanda 404)", () => client.post("/api/admin/ledger/opening-match/preview", { date: "2026-10-08", lines: [{ account: "500", side: "credit", amount: "1" }] }));
}
console.log(`yük (sonda) ${load()}`);
await app.close();
