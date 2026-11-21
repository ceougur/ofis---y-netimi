// Ç6-HESAP tur 5 — YANIT EŞDEĞERLİĞİ (tur 4'ün GERÇEK kodu ↔ yeni kod; süre değil). Programın KENDİ uçlarıyla: mali tablolar okunur → Kural Farkı Düzeltme Fişi → okunur → kilit 30.09.2026
// (through < kapsam) → okunur; kasa: kilit 31.12.2025'e geri (KALAN ≠ 0) → okunur; taksit: fiş ters kaydı → okunur. Her yanıtın JSON metni dosyaya (karşılaştırma fark5.py, bayt bayt).
// Kullanım: ROOT=<kod> OUT=<çıktı.json> node fark5.mjs fikstur        (13 sınıf × kilitli + kilitsiz, test/fixtures/c6h-v249 — ROOT'unkiler)
//           ROOT=<kod> OUT=<çıktı.json> node fark5.mjs 100k <veri kopyası>   (temiz 100 bin; kilit.py ile kilitli ya da kilitsiz)
import { copyFileSync, mkdirSync, mkdtempSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { pathToFileURL } from "node:url";
import { gunzipSync } from "node:zlib";

process.env.HUKUK_LICENSE_URL ||= "http://127.0.0.1:9";
const ROOT = process.env.ROOT;
const OUT = process.env.OUT;
const [mode, dataCopy] = process.argv.slice(2);
const imp = rel => import(pathToFileURL(path.join(ROOT, rel)).href);
const FS = "/api/workspace/financial-statements";
const unwrap = r => (r.data && typeof r.data === "object" && "ok" in r.data ? (r.data.ok ? r.data.data : r.data) : r.data);
const out = {};
let reads = 0;

const GT = [["2026-01-01", "2026-12-31"], ["2026-01-01", "2026-10-20"], ["2026-01-01", "2026-06-30"], ["2026-07-01", "2026-10-20"], ["2026-07-01", "2026-12-31"], ["2026-07-01", "2026-07-31"], ["2026-01-01", "2026-07-31"], ["2026-06-30", "2026-07-15"], ["2025-01-01", "2025-12-31"], ["2026-10-01", "2026-10-20"]];
const BS = ["2025-12-31", "2026-06-30", "2026-07-01", "2026-07-15", "2026-09-30", "2026-10-08", "2026-10-20", "2026-12-31"];

async function session(label, client, waitForFreeze, extra) {
  const get = async url => {
    const r = await client.get(url);
    reads += 1;
    return JSON.stringify({ status: r.status, body: unwrap(r) });
  };
  const readAll = async state => {
    for (const [a, b] of GT) out[`${label}|${state}|GT ${a}..${b}`] = await get(`${FS}/income-statement?from=${a}&to=${b}`);
    for (const d of BS) out[`${label}|${state}|BS ${d}`] = await get(`${FS}/balance-sheet?date=${d}`);
  };
  const lockTo = async day => {
    const put = await client.put("/api/admin/period-lock", { lockedUntil: day, force: true });
    out[`${label}|kilit ${day}|PUT`] = String(put.status);
    if (put.status !== 200) return false;
    await waitForFreeze(client, { timeoutMs: 600000 });
    return true;
  };
  await readAll("once");
  const view = unwrap(await client.get("/api/admin/ledger/rule-diff-correction"));
  out[`${label}|yonetim`] = JSON.stringify({ disabled: view.disabled, code: view.code, lines: view.lines?.length, excluded: view.excluded?.length });
  if (view.disabled) return;
  const res = await client.post("/api/admin/ledger/rule-diff-correction", { requestId: "c6h5-fark-istek-0000000001", digest: view.digest, confirm: true });
  out[`${label}|fis`] = JSON.stringify({ status: res.status, no: unwrap(res)?.voucher?.no });
  if (res.status !== 200) return;
  const voucher = unwrap(res).voucher;
  await readAll("fisten-sonra");
  if (extra === "taksit") {
    const rev = await client.post(`/api/admin/ledger/vouchers/${voucher.id}/reverse`, { requestId: "c6h5-fark-ters-taksit-0001", date: "2026-10-20" });
    out[`${label}|ters`] = String(rev.status);
    await readAll("ters-kayit");
  }
  if (extra === "kasa") {
    if (await lockTo("2025-12-31")) await readAll("kilit-geri-2025");
  }
  if (await lockTo("2026-09-30")) await readAll("kilit-0930");
}

const { loginAdmin, removeTestDir, startTestServer, createClient } = await imp("test/helpers.mjs");
const { waitForFreeze } = await imp("test/fixtures/donma-bekle.mjs");
if (mode === "fikstur") {
  const DIR = path.join(ROOT, "test/fixtures/c6h-v249");
  const OLD = JSON.parse(readFileSync(path.join(DIR, "v249.json"), "utf8"));
  for (const sinif of process.env.SINIF ? process.env.SINIF.split(",") : Object.keys(OLD.siniflar)) {
    for (const kip of ["kilitli", "kilitsiz"]) {
      const root = mkdtempSync(path.join(tmpdir(), `c6h5-fark-${sinif}-`));
      const dataDir = path.join(root, "data");
      mkdirSync(dataDir, { recursive: true });
      writeFileSync(path.join(dataDir, "destekofis.sqlite"), gunzipSync(readFileSync(path.join(DIR, `${sinif}-${kip}.sqlite.gz`))));
      copyFileSync(path.join(DIR, `${sinif}-${kip}.sirketler.json`), path.join(dataDir, "sirketler.json"));
      const server = await startTestServer({ dataDir, backupDir: path.join(root, "backups"), now: { time: OLD.now, fixed: true }, env: { HUKUK_LICENSE_URL: "http://127.0.0.1:9" } });
      try {
        await server.app.ledger.snapshots.runPending();
        const client = await loginAdmin(server);
        await session(`${sinif}-${kip}`, client, waitForFreeze, sinif);
      } finally {
        await server.close();
        removeTestDir(root);
      }
    }
  }
} else {
  const { createApp } = await imp("server/app.mjs");
  const PASS = "Kapi-Olcum-2026!";
  const app = createApp({
    dataDir: path.join(dataCopy, "data"), backupDir: path.join(dataCopy, "backups"), logLevel: "silent", scheduleBackups: false,
    env: { HUKUK_ADMIN_PASSWORD: PASS, HUKUK_DATASET_AUTOSYNC: "0" }, license: { enforce: false, machineId: "0123456789abcdef0123456789abcdef" },
    startLicenseTimers: false, integrityScan: false, analysisWorker: false, now: "2026-10-08T12:00:00+03:00", moneyStrict: false,
  });
  const { port } = await app.listen(0, "127.0.0.1");
  await app.ledger.snapshots.runPending();
  const client = createClient(`http://127.0.0.1:${port}`);
  if ((await client.login("admin", PASS)).status !== 200) throw new Error("giriş");
  await session(`100k-${app.ledger.snapshots.state().coverage ? "kilitli" : "kilitsiz"}`, client, waitForFreeze, "");
  await app.close?.();
}
writeFileSync(OUT, JSON.stringify(out));
console.log(`okuma ${reads} · anahtar ${Object.keys(out).length} · ${OUT}`);
process.exit(0);
