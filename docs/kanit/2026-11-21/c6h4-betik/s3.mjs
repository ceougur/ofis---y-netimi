// Dar kontrol Ç6-HESAP — senaryo 3: alt hesap düzeyindeki kural farkı (Ç7b / KG-2 / KG-24: 602 → 602.90, 600 → 600.90, 770 → 770.90) Gelir Tablosu'nun Kesin Değil'inde görünüyor mu;
// Yönetim'in Kural Farkı ön izlemesi ile karşılaştırma; aynı veri kilitsiz kopyada (güncel kural) ne gösteriyor. Kural Farkı fişinden sonra Bilanço'nun Kesin Değil'i.
// ROOT=<kod> SINIF=pos,stok,kasa node s3.mjs
import { copyFileSync, mkdirSync, mkdtempSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { gunzipSync } from "node:zlib";
const ROOT = process.env.ROOT;
const { loginAdmin, removeTestDir, startTestServer } = await import(path.join(ROOT, "test/helpers.mjs"));
const DIR = path.join(ROOT, "test/fixtures/c6h-v249");
const FS = "/api/workspace/financial-statements";
const old = JSON.parse(readFileSync(path.join(DIR, "v249.json"), "utf8"));
const unwrap = r => (r.data && typeof r.data === "object" && "ok" in r.data ? (r.data.ok ? r.data.data : r.data) : r.data);
const show = gt => JSON.stringify(gt.items.filter(i => i.hesaplar.length).map(i => [i.kod, i.hesaplar.map(h => [h.hesap, h.tutarMinor, h.altlar.map(a => [a.hesap, a.tutarMinor])])]));
async function open(sinif, kip, fn) {
  const root = mkdtempSync(path.join(tmpdir(), `dk-c6h3-${sinif}-`));
  const dataDir = path.join(root, "data");
  mkdirSync(dataDir, { recursive: true });
  writeFileSync(path.join(dataDir, "destekofis.sqlite"), gunzipSync(readFileSync(path.join(DIR, `${sinif}-${kip}.sqlite.gz`))));
  copyFileSync(path.join(DIR, `${sinif}-${kip}.sirketler.json`), path.join(dataDir, "sirketler.json"));
  const server = await startTestServer({ dataDir, backupDir: path.join(root, "backups"), now: { time: old.now, fixed: true }, env: { HUKUK_LICENSE_URL: "http://127.0.0.1:9" } });
  try {
    await server.app.ledger.snapshots.runPending();
    const c = await loginAdmin(server);
    const get = async url => { const r = await c.get(url); if (r.status !== 200) throw new Error(`${url} ${r.status}`); return unwrap(r); };
    await fn({ c, get });
  } finally {
    await server.close();
    removeTestDir(root);
  }
}
for (const sinif of (process.env.SINIF || "pos,stok,kasa").split(",")) {
  for (const kip of ["kilitsiz", "kilitli"]) {
    await open(sinif, kip, async ({ c, get }) => {
      for (const [a, b] of [["2025-01-01", "2025-12-31"], ["2026-01-01", "2026-06-30"]]) {
        const gt = await get(`${FS}/income-statement?from=${a}&to=${b}`);
        console.log(`${sinif} ${kip} GT ${a}..${b}: ${show(gt)}`);
        console.log(`    Kesin Değil: ${JSON.stringify(gt.kesinDegil.map(r => [r.kod, r.ayrinti || null]))} · dipnot .90: ${JSON.stringify(gt.footnotes.find(f => f.kod === "siniflandirilmamis") || null)} · dipnot 3: ${gt.footnotes.find(f => f.kod === "kasa-banka-gider").tutarMinor}`);
      }
      if (kip === "kilitli") {
        const view = await get("/api/admin/ledger/rule-diff-correction");
        console.log(`    Yönetim Kural Farkı ön izlemesi: ${view.count} madde; satırlar ${JSON.stringify(view.lines.map(l => [l.account, l.sub, l.debit, l.credit]))}`);
        const bs = await get(`${FS}/balance-sheet?date=2026-10-20`);
        console.log(`    Bilanço 20.10 Kesin Değil: ${JSON.stringify(bs.kesinDegil.map(r => [r.kod, r.ayrinti || null]))}`);
        if (!view.disabled) {
          const r = await c.post("/api/admin/ledger/rule-diff-correction", { requestId: `dkc6h-s3-${sinif}-00000001`, digest: view.digest, confirm: true });
          const after = await get("/api/admin/ledger/rule-diff-correction");
          const bs2 = await get(`${FS}/balance-sheet?date=2026-10-20`);
          console.log(`    fiş ${r.status}; Yönetim sonra: kalan satır ${after.lines.length}, ${after.code}, fişler ${JSON.stringify(after.vouchers.map(v => v.noText))}`);
          console.log(`    Bilanço 20.10 fişten SONRA Kesin Değil: ${JSON.stringify(bs2.kesinDegil.map(r => [r.kod, r.ayrinti || null]))}`);
        }
      }
    });
  }
}
