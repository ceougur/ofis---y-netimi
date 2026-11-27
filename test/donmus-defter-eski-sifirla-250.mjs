#!/usr/bin/env node
// 2.5.0 Ç3 tur 1 ORTA-2 — ESKİ SÜRÜM (2.4.9'un GERÇEK kodu, `git archive v2.4.9` kopyası; ders 23) 2.5.0'ın göç 47'lik dosyasında Şirket Verisini Sıfırla + yeni veri +
// yeniden kilit; sonra 2.5.0 açılışı (docs/erp/C3-DONDURMA-TASARIM.md §7, §17). 2.4.9'un sıfırlaması MOVEMENT_TABLES'taki ledger_snapshots'ı siler (önce audit_events: dondurma izi
// gider, silme geçer) ama ledger_snapshot_runs'ı bilmez → koşular kalır. Dar kontrolün betikleri (p5 / p5b) programın kendi API'leriyle, iki değişke:
//   A) yeni kod kilit 31.12.2026 → eski kod sıfırla, 05.05.2026 Kasa 7.777, kilit 31.12.2026 (AYNI gün) → yeni kod;
//   B) yeni kod kilit 30.06.2026 → eski kod sıfırla, 05.05.2026 Kasa 7.777, kilit 31.12.2026 (İLERİ) → yeni kod.
// Beklenen (yeni kod): kilitli yılın Yevmiye Defteri = canlı türetme (satır satır), Hesap Planı Mizanı'nda Kasa 7.777, Mutabakat Testi tutarlı, donmuş = canlı, yeniden donan
// dönem GAP_RULE (2.4.9; KULLANICI KARARI 06.11 S13 = A), onarım "damaged". Eski kodda (10ed14cf) Yevmiye Defteri 0 satır, Kasa yok.
//   node test/donmus-defter-eski-sifirla-250.mjs --eski <2.4.9 kopyası>   (HUKUK_LICENSE_URL=http://127.0.0.1:9; ders 30)
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { DatabaseSync } from "node:sqlite";
import { fileURLToPath, pathToFileURL } from "node:url";

const argv = process.argv.slice(2);
const OLD = path.resolve(argv[argv.indexOf("--eski") + 1] || "");
const NEW = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const NOW = "2027-01-10T10:00:00+03:00";
const helpersOf = async code => import(pathToFileURL(path.join(code, "test/helpers.mjs")).href);
const neu = await helpersOf(NEW);
const old = await helpersOf(OLD);
let tests = 0;
let failed = 0;
const check = (ok, text) => {
  tests += 1;
  if (!ok) failed += 1;
  console.log(`${ok ? "ok" : "not ok"} ${tests} - ${text}`);
};
const must = async (label, promise) => {
  const r = await promise;
  if (r.status !== 200) throw new Error(`${label}: ${r.status} ${JSON.stringify(r.data).slice(0, 300)}`);
  return r.data.data;
};
const canon = entries => entries.map(entry => JSON.stringify([entry.id, entry.date, entry.lines.map(line => [line.account, line.sub || "", line.party || "", line.debit, line.credit])]));

async function scenario(label, firstLock) {
  const root = mkdtempSync(path.join(tmpdir(), "donma-eski-sifirla-"));
  const dirs = { dataDir: path.join(root, "data"), backupDir: path.join(root, "backups") };
  const raw = sql => {
    const db = new DatabaseSync(path.join(dirs.dataDir, "destekofis.sqlite"), { readOnly: true });
    try {
      return db.prepare(sql).all().map(row => ({ ...row }));
    } finally {
      db.close();
    }
  };
  try {
    // 1) yeni kod: veri + kilit (donar)
    let server = await neu.startTestServer({ ...dirs, now: { time: NOW, fixed: true } });
    let admin = await neu.loginAdmin(server);
    await must("kasa eski", admin.post("/api/workspace/cash", { kind: "in", amount: "1.000", date: "2026-03-03", description: "Sıfırlamadan önceki veri" }));
    await must("kilit", admin.put("/api/admin/period-lock", { lockedUntil: firstLock }));
    check(server.app.ledger.snapshots.coverage() === firstLock && server.app.store.get("SELECT COUNT(*) AS n FROM ledger_snapshots").n === 2, `${label}: yeni kod ${firstLock}'e kadar dondurdu (2 satır)`);
    await server.close();
    // 2) eski kod: Şirket Verisini Sıfırla, yeni veri, yeniden kilit
    server = await old.startTestServer({ ...dirs, now: { time: NOW, fixed: true } });
    admin = await old.loginAdmin(server);
    check(server.app.store.get("PRAGMA user_version").user_version === 47, `${label}: eski kod dosyayı göç ettirmedi (şema 47)`);
    await must("eski sıfırla", admin.post("/api/companies/sirket-001/reset", { mode: "movements", confirm: "001", password: old.ADMIN_PASSWORD }));
    await must("eski kasa yeni", admin.post("/api/workspace/cash", { kind: "in", amount: "7.777", date: "2026-05-05", description: "Sıfırlamadan sonraki gerçek veri" }));
    await must("eski kilit", admin.put("/api/admin/period-lock", { lockedUntil: "2026-12-31", force: true }));
    await server.close();
    const runs = raw("SELECT no, kind, state, through FROM ledger_snapshot_runs");
    check(raw("SELECT COUNT(*) AS n FROM ledger_snapshots")[0].n === 0 && runs.length === 1 && runs[0].through === firstLock, `${label}: ön koşul — eski kod donmuş satırları sildi, koşuyu bilmedi (${JSON.stringify(runs)})`);
    // 3) yeni kod açılışı
    server = await neu.startTestServer({ ...dirs, now: { time: NOW, fixed: true } });
    try {
      const S = server.app.ledger.snapshots;
      await S.runPending();
      admin = await neu.loginAdmin(server);
      check(server.app.context?.snapshotRepair?.damaged === true, `${label}: açılış onarımı eksik satırı gördü (${JSON.stringify(server.app.context?.snapshotRepair)})`);
      const yev = await must("yevmiye", admin.get("/api/workspace/report-center/yevmiye?from=2026-01-01&to=2026-12-31"));
      const live = server.app.ledger.build().filter(entry => entry.date <= "2026-12-31");
      const liveLines = live.filter(entry => entry.date >= "2026-01-01").reduce((sum, entry) => sum + entry.lines.length, 0);
      check(yev.rows.length === liveLines && liveLines === 2 && yev.rows.some(row => row[0] === "05.05.2026" && row[4] === "7.777,00 TL"), `${label}: kilitli yılın Yevmiye Defteri = canlı (${yev.rows.length} / ${liveLines} satır; ${JSON.stringify(yev.rows.slice(0, 2))})`);
      const miz = await must("mizan", admin.get("/api/workspace/report-center/hesap-mizani?from=2026-01-01&to=2026-12-31"));
      const kasa = miz.rows.find(row => row[0] === "100");
      check(kasa?.[5] === "7.777,00 TL" && /Mutabakat tutarlı/.test(miz.subtitle), `${label}: Hesap Planı Mizanı Kasa 7.777 (${JSON.stringify(kasa)} · ${miz.subtitle})`);
      check(JSON.stringify(canon(S.entries())) === JSON.stringify(canon(live)) && S.coverage() === "2026-12-31" && S.state().pending === null, `${label}: donmuş = canlı, kapsam = kilit`);
      check(server.app.store.get("SELECT GROUP_CONCAT(DISTINCT rule_version) AS v FROM ledger_snapshots").v === "2.4.9", `${label}: yeniden donan dönem GAP_RULE (2.4.9; S13 = A)`);
      const scan = await must("tarama", admin.get("/api/workspace/ledger/integrity"));
      check(scan.ok === true, `${label}: Mutabakat Testi tutarlı (${JSON.stringify(scan.checks.filter(item => !item.ok).map(item => ({ code: item.code, sample: item.sample })))})`);
    } finally {
      await server.close();
    }
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
}

await scenario("A (aynı gün)", "2026-12-31");
await scenario("B (ileri kilit)", "2026-06-30");
console.log(`\n# tests ${tests}\n# pass ${tests - failed}\n# fail ${failed}`);
process.exit(failed ? 1 : 0);
