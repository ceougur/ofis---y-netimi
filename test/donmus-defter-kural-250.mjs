#!/usr/bin/env node
// 2.5.0 Ç3 — kural değişikliği benzetimi GERÇEK KOD KOPYASIYLA (docs/erp/C3-DONDURMA-TASARIM.md §14 F5; plan docs/erp/MUHASEBE-CEKIRDEGI-PLANI.md §9 madde 1): sürüm yükseltmesi gibi.
//   1) bu kod: veri programın API'sinden girilir, 31.12.2026'ya kilitlenir (donar), raporlar dökülür;
//   2) kural değişmiş kopya (--kopya: `git archive HEAD` kopyası; betik kopyanın general-ledger.mjs'inde Kasa'ya elle girişin karşılığını 649 → 642 yapar ve LEDGER_RULE_VERSION'ı
//      "2.5.0-deneme"ye yükseltir) aynı dosyayı açar: kilitli yılın Yevmiye Defteri ve Hesap Planı Mizanı birebir AYNI; açık dönem yeni kuralla; Mutabakat Testi ve Defter
//      Mutabakatı "Kural Değişikliği Farkı"; yeni kilit (05.01.2027) yeni kural etiketiyle donar, eski satırlar eski etiketle kalır;
//   3) kopyada kilit 30.06.2026'ya geri çekilip yeniden 31.12.2026'ya konunca açılan dönem yeni kuralla yeniden donar (plan §4: "yeniden türetilir"), fark yalnız 30.06'ya kadar kalır.
//   HUKUK_LICENSE_URL=http://127.0.0.1:9 node test/donmus-defter-kural-250.mjs --kopya <git archive HEAD kopyası>
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const argv = process.argv.slice(2);
const COPY = path.resolve(argv[argv.indexOf("--kopya") + 1] || "");
const SELF = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const NOW = "2027-01-10T10:00:00+03:00";
let tests = 0;
let failed = 0;
const check = (ok, text, detail = "") => {
  tests += 1;
  if (!ok) failed += 1;
  console.log(`${ok ? "ok" : "not ok"} ${tests} - ${text}${!ok && detail ? `\n  # ${String(detail).slice(0, 600)}` : ""}`);
};
// Kural değişikliği: kopyanın türetmesinde Kasa'ya elle girişin karşılığı 642 (kural sürümü yükselir).
const glFile = path.join(COPY, "server/lib/general-ledger.mjs");
let gl = readFileSync(glFile, "utf8");
const before = 'post(`cash:${row.id}`, row.date, "Kasa", row.description || "Kasaya giriş", moneyOf(row), "649", row.amount);';
if (!gl.includes(before) && !gl.includes('"2.5.0-deneme"')) throw new Error("kopyada değiştirilecek kural satırı yok");
gl = gl.replace(before, before.replace('"649"', '"642"')).replace('export const LEDGER_RULE_VERSION = "2.5.0";', 'export const LEDGER_RULE_VERSION = "2.5.0-deneme";');
writeFileSync(glFile, gl);
const helpersOf = root => import(pathToFileURL(path.join(root, "test/helpers.mjs")).href);
const root = mkdtempSync(path.join(tmpdir(), "donma-kural-"));
const dirs = { dataDir: path.join(root, "data"), backupDir: path.join(root, "backups") };
const must = async (label, promise) => {
  const response = await promise;
  if (response.status !== 200) throw new Error(`${label}: ${response.status} ${JSON.stringify(response.data).slice(0, 300)}`);
  return response.data.data;
};
const fullReport = async (server, id, from, to) => {
  const user = { ...server.app.store.get("SELECT * FROM users WHERE username = 'admin'"), role: "admin", permissions: [] };
  const data = await server.app.context.reportCenter.run(user, id, new URLSearchParams({ from, to }), { limit: 0 });
  return { rows: data.rows, summary: data.summary || null };
};
try {
  // 1) Bu kod.
  const self = await helpersOf(SELF);
  let server = await self.startTestServer({ now: { time: NOW, fixed: true }, ...dirs });
  let base;
  try {
    const admin = await self.loginAdmin(server);
    const customer = await must("cari", admin.post("/api/workspace/accounts", { name: "Deniz Ak", registeredOn: "2026-01-05" }));
    await must("açılış", admin.post(`/api/workspace/accounts/${customer.id}/entries`, { kind: "debt", amount: "900", date: "2026-01-05", note: "Açılış bakiyesi" }));
    for (const [day, amount] of [["2026-02-10", "1.200"], ["2026-05-20", "300"], ["2026-09-09", "450"], ["2026-12-31", "80"], ["2027-01-02", "70"]]) await must(`kasa ${day}`, admin.post("/api/workspace/cash", { kind: "in", amount, date: day, description: `Giriş ${day}` }));
    await must("tahsilat", admin.post(`/api/workspace/accounts/${customer.id}/entries`, { kind: "in", amount: "250", date: "2026-07-07", method: "cash", note: "Tahsilat" }));
    await must("kilit", admin.put("/api/admin/period-lock", { lockedUntil: "2026-12-31" }));
    // Ç3 tur 2: uç dondurmayı beklemez (arkada sürer); raporlar ve kapanış dondurma bittikten sonra.
    await server.app.ledger.snapshots.runPending();
    base = { journal: await fullReport(server, "yevmiye", "2026-01-01", "2026-12-31"), trial: await fullReport(server, "hesap-mizani", "2026-01-01", "2026-12-31"), scan: await must("tarama", admin.get("/api/workspace/ledger/integrity")) };
    check(server.app.ledger.snapshots.coverage() === "2026-12-31", "bu kod: 31.12.2026'ya kadar dondu");
    check(base.journal.rows.some(row => row[3] === "649") && !base.journal.rows.some(row => row[3] === "642"), "bu kod: Kasa girişleri 649'da");
    check(base.scan.ok === true, "bu kod: Mutabakat Testi tutarlı");
  } finally {
    await server.close();
  }
  // 2) Kural değişmiş kopya (sürüm yükseltmesi).
  const next = await helpersOf(COPY);
  server = await next.startTestServer({ now: { time: NOW, fixed: true }, ...dirs });
  try {
    const admin = await next.loginAdmin(server);
    const journal = await fullReport(server, "yevmiye", "2026-01-01", "2026-12-31");
    const trial = await fullReport(server, "hesap-mizani", "2026-01-01", "2026-12-31");
    check(JSON.stringify(journal) === JSON.stringify(base.journal), `yeni kural: kilitli yılın Yevmiye Defteri birebir aynı (${journal.rows.length} satır)`, JSON.stringify(journal.rows.find((row, i) => JSON.stringify(row) !== JSON.stringify(base.journal.rows[i]))));
    check(JSON.stringify(trial) === JSON.stringify(base.trial), "yeni kural: kilitli yılın Hesap Planı Mizanı birebir aynı");
    const open = await fullReport(server, "yevmiye", "2027-01-01", "2027-12-31");
    check(open.rows.some(row => row[3] === "642") && !open.rows.some(row => row[3] === "649"), "yeni kural: açık dönem (02.01.2027) yeni kuralla (642)");
    const scan = await must("tarama", admin.get("/api/workspace/ledger/integrity"));
    const diff = scan.checks.find(item => item.code === "ledger:rule-diff");
    check(diff && diff.ok === false && diff.severity === "warning" && diff.count === 4, `yeni kural: Mutabakat Testi "Kural Değişikliği Farkı" uyarısı, 4 madde (${JSON.stringify(diff)})`);
    const report = await must("Defter Mutabakatı", admin.get("/api/workspace/report-center/defter-mutabakati"));
    check(report.rows.some(row => row[0] === "642" && row[5] === "Kural Değişikliği Farkı") && report.rows.some(row => row[0] === "649" && row[5] === "Kural Değişikliği Farkı"), "yeni kural: Defter Mutabakatı hesap bazında fark satırları (642, 649)");
    check(/Kural Değişikliği Farkı/.test(report.subtitle || ""), `yeni kural: Defter Mutabakatı alt başlığı (${report.subtitle})`);
    const balances = server.app.ledger.snapshots.ruleDiff().balances.map(row => [row.year, row.account, row.differenceMinor]);
    check(JSON.stringify(balances) === JSON.stringify([[2026, "642", -203000], [2026, "649", 203000]]), `yeni kural: ruleDiff tutarları (${JSON.stringify(balances)})`);
    await must("açık döneme yazım", admin.post("/api/workspace/cash", { kind: "in", amount: "5", date: "2027-01-06", description: "Yeni kural" }));
    check(true, "yeni kural: açık döneme yazım engellenmez");
    // Yeni kilit yeni kural etiketiyle; eski satırlar eski etiketle.
    await must("kilit 05.01", admin.put("/api/admin/period-lock", { lockedUntil: "2027-01-05" }));
    await server.app.ledger.snapshots.runPending();
    const labels = server.app.store.all("SELECT rule_version AS rule, MIN(date) AS first, MAX(date) AS last FROM ledger_snapshots GROUP BY rule_version ORDER BY rule_version").map(row => ({ ...row }));
    check(JSON.stringify(labels) === JSON.stringify([{ rule: "2.5.0", first: "2026-01-05", last: "2026-12-31" }, { rule: "2.5.0-deneme", first: "2027-01-02", last: "2027-01-02" }]), `yeni kilit: kural etiketleri (${JSON.stringify(labels)})`);
    // 3) Geri çek + yeniden kilitle: açılan dönem yeni kuralla yeniden donar; fark yalnız 30.06'ya kadar.
    await must("geri çek", admin.put("/api/admin/period-lock", { lockedUntil: "2026-06-30" }));
    await must("yeniden kilitle", admin.put("/api/admin/period-lock", { lockedUntil: "2026-12-31" }));
    await server.app.ledger.snapshots.runPending();
    const again = await fullReport(server, "yevmiye", "2026-07-01", "2026-12-31");
    check(again.rows.some(row => row[3] === "642") && !again.rows.some(row => row[3] === "649"), "yeniden kilit: 01.07–31.12 yeni kuralla yeniden dondu");
    const after = (await must("tarama", admin.get("/api/workspace/ledger/integrity"))).checks.find(item => item.code === "ledger:rule-diff");
    check(after && after.count === 2, `yeniden kilit: fark yalnız 30.06'ya kadarki 2 maddede (${JSON.stringify(after)})`);
  } finally {
    await server.close();
  }
} finally {
  rmSync(root, { recursive: true, force: true });
}
console.log(`\n# tests ${tests}\n# pass ${tests - failed}\n# fail ${failed}`);
process.exit(failed ? 1 : 0);
