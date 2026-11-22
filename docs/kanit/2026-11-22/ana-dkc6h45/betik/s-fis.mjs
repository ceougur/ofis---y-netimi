// DK-C6H45 s-fis: ORTA-2 / tur 5 eşdeğerliği — v2.4.9 kilitli fikstürleri (fikstür kodun kendi test/fixtures'ından), kodu ROOT olan programda.
// Aşamalar: (0) fişten önce, (1) fiş (01.07.2026), (2) kilit 30.09.2026'ya ilerler (fiş donmuş dönemde), (3) kilit 31.12.2025'e geri çekilir.
// Kullanım: node s-fis.mjs <ROOT> <çıktı.json> [sınıf …]
import { copyFileSync, mkdirSync, mkdtempSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { pathToFileURL } from "node:url";
import { gunzipSync } from "node:zlib";
process.env.HUKUK_LICENSE_URL = "http://127.0.0.1:9";
const [root, out, ...only] = process.argv.slice(2);
const { loginAdmin, removeTestDir, startTestServer } = await import(pathToFileURL(path.join(root, "test", "helpers.mjs")).href);
const { waitForFreeze } = await import(pathToFileURL(path.join(root, "test", "fixtures", "donma-bekle.mjs")).href);
const DIR = path.join(root, "test", "fixtures", "c6h-v249");
const OLD = JSON.parse(readFileSync(path.join(DIR, "v249.json"), "utf8"));
const FS = "/api/workspace/financial-statements";
const unwrap = r => (r.data && typeof r.data === "object" && "ok" in r.data ? (r.data.ok ? r.data.data : r.data) : r.data);
const CLASSES = only.length ? only : ["acilis", "alis-fatura", "banka", "cek-senet", "elle-borc-alacak", "kasa", "pos", "satis-fatura", "stok", "supheli", "taksit", "vergi"];
const READS = {
  bs1231: `${FS}/balance-sheet?date=2025-12-31`, bs0630: `${FS}/balance-sheet?date=2026-06-30`, bs0701: `${FS}/balance-sheet?date=2026-07-01`, bs0801: `${FS}/balance-sheet?date=2026-08-01`,
  bs0930: `${FS}/balance-sheet?date=2026-09-30`, bsNow: `${FS}/balance-sheet?date=2026-10-20`,
  gt25: `${FS}/income-statement?from=2025-01-01&to=2025-12-31`, gt26a: `${FS}/income-statement?from=2026-01-01&to=2026-06-30`, gt26: `${FS}/income-statement?from=2026-01-01&to=2026-10-20`,
  gt26b: `${FS}/income-statement?from=2026-07-01&to=2026-10-20`, gt26c: `${FS}/income-statement?from=2026-07-01&to=2026-09-30`, gt26d: `${FS}/income-statement?from=2026-08-01&to=2026-09-30`,
  gt26e: `${FS}/income-statement?from=2026-07-01&to=2026-07-01`,
};
const pick = o => ({
  kesinDegil: (o.kesinDegil || []).map(r => ({ kod: r.kod, aciklama: r.kod === "kural-farki" ? r.aciklama : undefined, ayrinti: r.kod === "kural-farki" ? r.ayrinti : undefined })),
  bilgi: o.bilgi, fark: o.toplamlar?.farkMinor, kar: o.subtotals?.donemNetKari ?? o.hesaplanmis?.donemNetKari?.tutarMinor, full: JSON.stringify(o),
});
const result = {};
for (const sinif of CLASSES) {
  const tmp = mkdtempSync(path.join(tmpdir(), `dkc6h45-${sinif}-`));
  const dataDir = path.join(tmp, "data");
  mkdirSync(dataDir, { recursive: true });
  writeFileSync(path.join(dataDir, "destekofis.sqlite"), gunzipSync(readFileSync(path.join(DIR, `${sinif}-kilitli.sqlite.gz`))));
  copyFileSync(path.join(DIR, `${sinif}-kilitli.sirketler.json`), path.join(dataDir, "sirketler.json"));
  const server = await startTestServer({ dataDir, backupDir: path.join(tmp, "backups"), now: { time: OLD.now, fixed: true }, env: { HUKUK_LICENSE_URL: "http://127.0.0.1:9" } });
  const R = (result[sinif] = {});
  try {
    await server.app.ledger.snapshots.runPending();
    const client = await loginAdmin(server);
    const get = async url => { const r = await client.get(url); return r.status === 200 ? unwrap(r) : { status: r.status, body: r.data }; };
    const stage = async name => {
      const view = await get("/api/admin/ledger/rule-diff-correction");
      R[name] = { cover: server.app.ledger.snapshots.state().coverage, view: { disabled: view.disabled, code: view.code, lines: view.lines, excluded: view.excluded, ownYearOver: view.ownYearOver }, reads: {} };
      for (const [k, url] of Object.entries(READS)) R[name].reads[k] = pick(await get(url));
      return view;
    };
    const v0 = await stage("s0");
    if (v0.disabled) { R.note = `fiş yazılamaz: ${v0.code}`; continue; }
    const p = await client.post("/api/admin/ledger/rule-diff-correction", { requestId: `dkc6h45-${sinif}-00000000001`, digest: v0.digest, confirm: true });
    R.post = p.status;
    if (p.status !== 200) { R.note = JSON.stringify(p.data).slice(0, 300); continue; }
    await stage("s1");
    const a = await client.put("/api/admin/period-lock", { lockedUntil: "2026-09-30" });
    R.lock0930 = a.status; await waitForFreeze(client);
    await stage("s2");
    const b = await client.put("/api/admin/period-lock", { lockedUntil: "2025-12-31" });
    R.lock1231 = b.status; await waitForFreeze(client);
    await stage("s3");
  } catch (e) { R.error = String(e?.stack || e).slice(0, 800); }
  finally { await server.close(); removeTestDir(tmp); }
}
writeFileSync(out, JSON.stringify(result, null, 1));
console.log("yazıldı", out);
