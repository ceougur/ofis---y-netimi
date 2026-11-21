// Dar kontrol Ç6-HESAP — senaryo 2: v2.4.9 GERÇEK koduyla üretilmiş KİLİTLİ fikstür (test/fixtures/c6h-v249) bugünkü kodla açılır; mali tablolar okunur; Kural Farkı Düzeltme Fişi yazılır;
// tablolar yeniden okunur. Beklenen (elle, kitaptan): fişten önce ve sonra kilit tarihinin (30.06.2026) Bilanço'su ve 2025 Gelir Tablosu AYNI (donmuş); Aktif = Pasif her tarihte;
// fişten sonra Kesin Değil'de 'kural-farki' YOK; fişin 6 / 7 satırları yalnız 2026'nın Gelir Tablosu'na (fiş tarihi kilit + 1) girer, 1–5 satırları (500 / 519) Bilanço'ya.
// ROOT=<kod> SINIF=acilis,taksit,... node s2.mjs
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
let fails = 0;
const log = s => console.log(s);
const eq = (label, got, want) => { const ok = JSON.stringify(got) === JSON.stringify(want); if (!ok) fails += 1; log(`${ok ? "OK  " : "FARK"} ${label}: ${JSON.stringify(got)}${ok ? "" : ` beklenen ${JSON.stringify(want)}`}`); };
const strip = o => JSON.stringify({ ...o, kesinDegil: o.kesinDegil?.map(r => r.kod).filter(k => k !== "kural-farki") });
for (const sinif of (process.env.SINIF || "acilis,taksit,satis-fatura,alis-fatura,stok,kasa,elle-borc-alacak,banka,pos,cek-senet,supheli,vergi").split(",")) {
  const root = mkdtempSync(path.join(tmpdir(), `dk-c6h-${sinif}-`));
  const dataDir = path.join(root, "data");
  mkdirSync(dataDir, { recursive: true });
  writeFileSync(path.join(dataDir, "destekofis.sqlite"), gunzipSync(readFileSync(path.join(DIR, `${sinif}-kilitli.sqlite.gz`))));
  copyFileSync(path.join(DIR, `${sinif}-kilitli.sirketler.json`), path.join(dataDir, "sirketler.json"));
  const server = await startTestServer({ dataDir, backupDir: path.join(root, "backups"), now: { time: old.now, fixed: true }, env: { HUKUK_LICENSE_URL: "http://127.0.0.1:9" } });
  try {
    await server.app.ledger.snapshots.runPending();
    const c = await loginAdmin(server);
    const get = async url => { const r = await c.get(url); if (r.status !== 200) throw new Error(`${url} ${r.status} ${JSON.stringify(r.data).slice(0, 300)}`); return unwrap(r); };
    const read = async () => ({
      bs0630: await get(`${FS}/balance-sheet?date=2026-06-30`), bs1231: await get(`${FS}/balance-sheet?date=2025-12-31`), bsNow: await get(`${FS}/balance-sheet?date=2026-10-20`),
      gt25: await get(`${FS}/income-statement?from=2025-01-01&to=2025-12-31`), gt26a: await get(`${FS}/income-statement?from=2026-01-01&to=2026-06-30`),
      gt26: await get(`${FS}/income-statement?from=2026-01-01&to=2026-10-20`), gt26b: await get(`${FS}/income-statement?from=2026-07-01&to=2026-10-20`),
    });
    const before = await read();
    const view = await get("/api/admin/ledger/rule-diff-correction");
    log(`--- ${sinif}: kilit ${view.lockedUntil} fiş ${view.date} satırlar ${JSON.stringify(view.lines.map(l => [l.account, l.sub, l.debit, l.credit]))} pasif ${view.disabled} ${view.code}`);
    log(`    önce Kesin Değil (bugün): ${before.bsNow.kesinDegil.map(r => r.kod).join(",")} | fark ${before.bsNow.toplamlar.farkMinor}`);
    for (const k of ["bs0630", "bs1231", "bsNow"]) eq(`${sinif} önce ${k} Aktif−Pasif`, before[k].toplamlar.farkMinor, 0);
    if (!view.disabled) {
      const r = await c.post("/api/admin/ledger/rule-diff-correction", { requestId: `dkc6h-istek-${sinif}-0000000001`, digest: view.digest, confirm: true });
      log(`    fiş yazımı: ${r.status} ${r.status !== 200 ? JSON.stringify(r.data).slice(0, 500) : ""}`);
      const after = await read();
      for (const k of ["bs0630", "bs1231", "bsNow"]) eq(`${sinif} sonra ${k} Aktif−Pasif`, after[k].toplamlar.farkMinor, 0);
      eq(`${sinif} 2025 GT fişten sonra aynı`, strip(after.gt25) === strip(before.gt25), true);
      eq(`${sinif} 2026 [01.01, 30.06] GT fişten sonra aynı`, strip(after.gt26a) === strip(before.gt26a), true);
      eq(`${sinif} Bilanço 30.06 fişten sonra aynı`, strip(after.bs0630) === strip(before.bs0630), true);
      eq(`${sinif} Bilanço 31.12.2025 fişten sonra aynı`, strip(after.bs1231) === strip(before.bs1231), true);
      // Fişin 6 / 7 satırları 2026 GT'ye: [07.01, 10.20] dönem kârı farkı = fişin 6 / 7 net (alacak − borç).
      const pl = view.lines.filter(l => /^[67]/.test(l.account)).reduce((s, l) => s + (l.credit - l.debit), 0);
      eq(`${sinif} 2026 [07.01, 10.20] dönem kârı farkı = fişin 6/7 neti`, after.gt26b.subtotals.donemNetKari - before.gt26b.subtotals.donemNetKari, pl);
      eq(`${sinif} Bilanço bugün DNK farkı = fişin 6/7 neti`, after.bsNow.hesaplanmis.donemNetKari.tutarMinor - before.bsNow.hesaplanmis.donemNetKari.tutarMinor, pl);
      log(`    sonra Kesin Değil (bugün): ${after.bsNow.kesinDegil.map(r => r.kod).join(",")} | GT 2026 ${after.gt26.kesinDegil.map(r => r.kod).join(",")}`);
      eq(`${sinif} sonra bugün 'kural-farki' yok`, after.bsNow.kesinDegil.some(r => r.kod === "kural-farki"), false);
      const acc = (o, h) => o.accounts.find(r => r.hesap === h)?.defterMinor || 0;
      log(`    500 / 519 bugün önce ${acc(before.bsNow, "500")} / ${acc(before.bsNow, "519")} sonra ${acc(after.bsNow, "500")} / ${acc(after.bsNow, "519")}`);
      const items = o => Object.fromEntries(o.items.map(i => [i.kod, i.tutarMinor]));
      log(`    GT [07.01, 10.20] kalemler önce ${JSON.stringify(items(before.gt26b))} sonra ${JSON.stringify(items(after.gt26b))}`);
    }
  } finally {
    await server.close();
    removeTestDir(root);
  }
}
log(`SONUÇ: ${fails} fark`);
process.exitCode = fails ? 1 : 0;
