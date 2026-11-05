#!/usr/bin/env node
// 2.5.0 Ç3 — ESKİ SÜRÜM (2.4.9'un GERÇEK kodu, `git archive v2.4.9` kopyası; ders 23) 2.5.0'ın göç 47'lik dosyasını açar (BS-7 kapısını bilmez, yazılabilir açar) —
// docs/erp/C3-DONDURMA-TASARIM.md §3, §7, §14 F12. Senaryo programın kendi API'leriyle:
//   1) yeni kod: veri + kilit 30.06.2026 (donar);
//   2) eski kod: dosyayı açar (şema 47 > 45: göç yok), kilidi 31.12.2026'ya İLERLETİR, açık döneme Kasa hareketi yazar; Mutabakat Testi tutarlı; donmuş satırlara dokunamaz
//      (tetikleyici dosyada);
//   3) yeni kod: açılış onarımı — aradaki dönem (30.06, 31.12] 2.4.9 kuralıyla donar (GAP_RULE), kapsam = kilit, donmuş = canlı;
//   4) eski kod: kilidi KALDIRIR; 5) yeni kod: thaw (repair), kapsam boş;
//   6) eski kod: yeniden kilitler (31.12) ve Şirket Verisini Sıfırla (Tüm Hareketleri Sil) — MOVEMENT_TABLES'taki ledger_snapshots'ı siler (önce audit_events: iz gider, silme geçer);
//      sıfırlama 200 döner; 7) yeni kod: kapsam boş, donmuş satır yok, Mutabakat Testi tutarlı; yeniden kilit donar.
//   node test/donmus-defter-eski-surum-250.mjs --eski <2.4.9 kopyası>   (HUKUK_LICENSE_URL=http://127.0.0.1:9; ders 30)
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { DatabaseSync } from "node:sqlite";
import { fileURLToPath, pathToFileURL } from "node:url";

const argv = process.argv.slice(2);
const OLD = path.resolve(argv[argv.indexOf("--eski") + 1] || "");
const NEW = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const NOW = "2027-01-10T10:00:00+03:00";
const root = mkdtempSync(path.join(tmpdir(), "donma-eski-surum-"));
const dirs = { dataDir: path.join(root, "data"), backupDir: path.join(root, "backups") };
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
const raw = sql => {
  const db = new DatabaseSync(path.join(dirs.dataDir, "destekofis.sqlite"), { readOnly: true });
  try {
    return db.prepare(sql).all().map(row => ({ ...row }));
  } finally {
    db.close();
  }
};
const lockOf = () => raw("SELECT value FROM settings WHERE key = 'ledger.lockedUntil'")[0]?.value || "";
const canon = entries => entries.map(entry => JSON.stringify([entry.id, entry.date, entry.lines.map(line => [line.account, line.sub || "", line.party || "", line.debit, line.credit])]));
const sameAsLive = (server, lock) => JSON.stringify(canon(server.app.ledger.snapshots.entries())) === JSON.stringify(canon(server.app.ledger.build().filter(entry => entry.date <= lock)));
try {
  // 1) yeni kod
  let server = await neu.startTestServer({ ...dirs, now: { time: NOW, fixed: true } });
  let admin = await neu.loginAdmin(server);
  const customer = (await admin.post("/api/workspace/accounts", { name: "Eski Sürüm Carisi", registeredOn: "2026-01-05" })).data.data;
  await admin.post(`/api/workspace/accounts/${customer.id}/entries`, { kind: "debt", amount: "600", date: "2026-01-05", note: "Açılış bakiyesi" });
  for (const [day, amount] of [["2026-03-03", "100"], ["2026-08-08", "200"], ["2026-12-12", "300"]]) await admin.post("/api/workspace/cash", { kind: "in", amount, date: day, description: `Giriş ${day}` });
  check((await admin.put("/api/admin/period-lock", { lockedUntil: "2026-06-30" })).status === 200, "yeni kod: kilit 30.06.2026");
  check(server.app.ledger.snapshots.coverage() === "2026-06-30", "yeni kod: 30.06'ya kadar dondu");
  const version = server.app.store.get("PRAGMA user_version").user_version;
  await server.close();
  check(version === 47, `yeni kod: şema ${version}`);

  // 2) eski kod: kilidi ilerletir, açık döneme yazar
  server = await old.startTestServer({ ...dirs, now: { time: NOW, fixed: true } });
  admin = await old.loginAdmin(server);
  check(server.app.store.get("PRAGMA user_version").user_version === 47, "eski kod dosyayı göç ettirmedi (şema 47 kaldı)");
  check((await admin.put("/api/admin/period-lock", { lockedUntil: "2026-12-31", force: true })).status === 200, "eski kod: kilit 31.12.2026'ya ilerletildi");
  check((await admin.post("/api/workspace/cash", { kind: "in", amount: "44", date: "2027-01-07", description: "Eski kod kasa" })).status === 200, "eski kod: açık döneme Kasa hareketi");
  const oldScan = await admin.get("/api/workspace/ledger/integrity");
  check(oldScan.status === 200 && oldScan.data.data.ok === true, `eski kod: Mutabakat Testi ${oldScan.status} ${oldScan.data?.data?.ok}`);
  let blocked = "";
  try {
    server.app.store.run("UPDATE ledger_snapshots SET debit_minor = debit_minor + 1");
  } catch (error) {
    blocked = error.message;
  }
  check(/değiştirilemez/.test(blocked), `eski kodun bağlantısında donmuş satır değiştirilemez (tetikleyici dosyada): ${blocked}`);
  await server.close();
  check(lockOf() === "2026-12-31" && raw("SELECT COUNT(*) AS n FROM ledger_snapshot_runs WHERE state = 'pending'")[0].n === 0, "eski kod koşu açmadı (kapsam 30.06, kilit 31.12)");

  // 3) yeni kod: aradaki dönem 2.4.9 kuralıyla donar
  server = await neu.startTestServer({ ...dirs, now: { time: NOW, fixed: true } });
  await server.app.ledger.snapshots.runPending();
  const gap = server.app.store.get("SELECT kind, state, reason, rule_version AS rule, from_date AS fromDate, through FROM ledger_snapshot_runs ORDER BY no DESC LIMIT 1");
  check(gap.kind === "freeze" && gap.state === "done" && gap.reason === "repair" && gap.rule === "2.4.9" && gap.fromDate === "2026-06-30" && gap.through === "2026-12-31", `yeni kod: açılış onarımı aradaki dönemi 2.4.9 kuralıyla dondurdu (${JSON.stringify({ ...gap })})`);
  check(server.app.ledger.snapshots.coverage() === "2026-12-31" && sameAsLive(server, "2026-12-31"), "yeni kod: kapsam = kilit, donmuş = canlı");
  admin = await neu.loginAdmin(server);
  check((await admin.get("/api/workspace/ledger/integrity")).data.data.ok === true, "yeni kod: Mutabakat Testi tutarlı");
  await server.close();

  // 4) eski kod: kilidi kaldırır; 5) yeni kod: thaw
  server = await old.startTestServer({ ...dirs, now: { time: NOW, fixed: true } });
  admin = await old.loginAdmin(server);
  check((await admin.put("/api/admin/period-lock", { lockedUntil: "" })).status === 200, "eski kod: kilit kaldırıldı");
  await server.close();
  server = await neu.startTestServer({ ...dirs, now: { time: NOW, fixed: true } });
  await server.app.ledger.snapshots.runPending();
  const thaw = server.app.store.get("SELECT kind, reason, through FROM ledger_snapshot_runs ORDER BY no DESC LIMIT 1");
  check(thaw.kind === "thaw" && thaw.reason === "repair" && thaw.through === "" && server.app.ledger.snapshots.coverage() === "" && server.app.store.get("SELECT COUNT(*) AS n FROM ledger_snapshots").n === 0, `yeni kod: thaw (repair), kapsam boş, bayat satır silindi (${JSON.stringify({ ...thaw })})`);
  admin = await neu.loginAdmin(server);
  check((await admin.put("/api/admin/period-lock", { lockedUntil: "2026-12-31" })).status === 200 && sameAsLive(server, "2026-12-31"), "yeni kod: yeniden kilit, donmuş = canlı");
  await server.close();

  // 6) eski kod: Şirket Verisini Sıfırla (Tüm Hareketleri Sil) — donmuş satırlar varken
  const before = raw("SELECT COUNT(*) AS n FROM ledger_snapshots")[0].n;
  server = await old.startTestServer({ ...dirs, now: { time: NOW, fixed: true } });
  admin = await old.loginAdmin(server);
  const reset = await admin.post("/api/companies/sirket-001/reset", { mode: "movements", confirm: "001", password: old.ADMIN_PASSWORD });
  check(reset.status === 200, `eski kod: Şirket Verisini Sıfırla ${reset.status} ${reset.status === 200 ? "" : JSON.stringify(reset.data).slice(0, 300)} (önce ${before} donmuş satır)`);
  await server.close();
  check(raw("SELECT COUNT(*) AS n FROM ledger_snapshots")[0].n === 0 && raw("SELECT COUNT(*) AS n FROM ledger_snapshot_runs")[0].n > 0 && lockOf() === "", "eski kod sıfırlaması donmuş satırları sildi, koşuları bilmez (kaldı), kilit kalktı");

  // 7) yeni kod: tutarlı
  server = await neu.startTestServer({ ...dirs, now: { time: NOW, fixed: true } });
  await server.app.ledger.snapshots.runPending();
  check(server.app.ledger.snapshots.coverage() === "" && server.app.ledger.snapshots.state().pending === null, "yeni kod: açılış onarımı kapsamı kilide (boş) indirdi");
  admin = await neu.loginAdmin(server);
  const scan = await admin.get("/api/workspace/ledger/integrity");
  check(scan.status === 200 && scan.data.data.ok === true, `yeni kod: Mutabakat Testi tutarlı (${JSON.stringify(scan.data.data?.checks?.filter(item => !item.ok).map(item => item.code))})`);
  await admin.post("/api/workspace/cash", { kind: "in", amount: "10", date: "2026-11-11", description: "Sıfırlamadan sonra" });
  check((await admin.put("/api/admin/period-lock", { lockedUntil: "2026-12-31" })).status === 200 && sameAsLive(server, "2026-12-31") && server.app.ledger.snapshots.entries().length > 0, "yeni kod: sıfırlamadan sonra kilit yeniden donar");
  await server.close();
} finally {
  rmSync(root, { recursive: true, force: true });
}
console.log(`\n# tests ${tests}\n# pass ${tests - failed}\n# fail ${failed}`);
process.exit(failed ? 1 : 0);
