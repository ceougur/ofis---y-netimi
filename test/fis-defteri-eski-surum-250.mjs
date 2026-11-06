#!/usr/bin/env node
// 2.5.0 Ç2 — BS-7 TASARIM GİRDİSİ kanıtı (docs/erp/C2-FIS-DEFTERI-TASARIM.md §8): başarısız 2.5.0 güncellemesinden sonra ESKİ SÜRÜM (2.4.9'un GERÇEK kodu, `git archive`
// kopyası; ders 23) göç etmiş (46 ve sonrası; şimdi 47) dosyayı yazılabilir açar. Senaryo programın kendi API'leriyle:
//   1) yeni kod: fiş + ters kaydı + Kasa hareketi yazılır;
//   2) eski kod: dosyayı açar (şema ≥ 46 > 45: göç yok), Kasa hareketi yazar, Mutabakat Testi koşar — fişler bozulmaz (tetikleyici, iz);
//   3) yeni kod: fişler aynen, onarım YOK;
//   4) eski kod: Şirket Verisini Sıfırla (Tüm Hareketleri Sil) — fiş tablosunu bilmez, fişler artakalır;
//   5) yeni kod: açılış onarımı artakalan fişleri kaldırır (Mutabakat Günlüğü "repair"), Mutabakat tutarlı.
//   node test/fis-defteri-eski-surum-250.mjs --eski <2.4.9 kopyası>   (HUKUK_LICENSE_URL=http://127.0.0.1:9; ders 30)
import assert from "node:assert/strict";
import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { DatabaseSync } from "node:sqlite";
import { fileURLToPath, pathToFileURL } from "node:url";

const argv = process.argv.slice(2);
const OLD = path.resolve(argv[argv.indexOf("--eski") + 1] || "");
const NEW = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const NOW = "2027-01-10T10:00:00+03:00";
const root = mkdtempSync(path.join(tmpdir(), "fis-eski-surum-"));
const dirs = { dataDir: path.join(root, "data"), backupDir: path.join(root, "backups") };
const helpersOf = async code => import(pathToFileURL(path.join(code, "test/helpers.mjs")).href);
const neu = await helpersOf(NEW);
const { LATEST_VERSION: LATEST } = await import(pathToFileURL(path.join(NEW, "server/lib/migrations.mjs")).href);
const old = await helpersOf(OLD);
const USER = { id: "eski-surum", display_name: "Eski Sürüm Kanıtı" };
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
    return db.prepare(sql).all();
  } finally {
    db.close();
  }
};
const vouchers = () => raw("SELECT id, no, type FROM ledger_vouchers ORDER BY rowid");

// 1) yeni kod
let server = await neu.startTestServer({ ...dirs, now: { time: NOW, fixed: true } });
let admin = await neu.loginAdmin(server);
const V = server.app.ledger.vouchers;
const a = V.post(USER, { type: "closing", date: "2027-01-06", description: "Eski sürüm kanıtı", requestKey: "eski-surum-kapanis-1", lines: [{ account: "602", debit: 70000 }, { account: "690", credit: 70000 }] });
V.reverse(USER, a.id, { requestKey: "eski-surum-ters-1" });
check((await admin.post("/api/workspace/cash", { kind: "in", amount: "125", date: "2027-01-06", description: "Yeni kod kasa" })).status === 200, "yeni kod: Kasa hareketi");
const version = server.app.store.get("PRAGMA user_version").user_version;
await server.close();
// G3 (Ç2 tur 1): beklenen şema programın son göçü (LATEST_VERSION) — Ç3 göç 47 (2ba5ac0b) birleşince betik hâlâ 46 bekliyordu (taban kodda da 2/17 kırmızı).
check(version === LATEST && vouchers().length === 2, `yeni kod: şema ${version} (son göç ${LATEST}), fiş ${vouchers().length}`);

// 2) eski kod (2.4.9) — normal iş
server = await old.startTestServer({ ...dirs, now: { time: NOW, fixed: true } });
admin = await old.loginAdmin(server);
check(server.app.store.get("PRAGMA user_version").user_version === LATEST, `eski kod dosyayı göç ettirmedi (şema ${LATEST} kaldı)`);
check((await admin.post("/api/workspace/cash", { kind: "in", amount: "33", date: "2027-01-07", description: "Eski kod kasa" })).status === 200, "eski kod: Kasa hareketi yazdı");
const oldScan = await admin.get("/api/workspace/ledger/integrity");
check(oldScan.status === 200 && oldScan.data.data.ok === true, `eski kod: Mutabakat Testi ${oldScan.status} ${oldScan.data?.data?.ok}`);
let blocked = "";
try {
  server.app.store.run("DELETE FROM ledger_vouchers");
} catch (error) {
  blocked = error.message;
}
check(/silinemez/.test(blocked), `eski kodun bağlantısında fiş silinemez (tetikleyici dosyada): ${blocked}`);
await server.close();
check(vouchers().length === 2, "eski kodun normal işi fişlere dokunmadı");

// 3) yeni kod — onarım yok
server = await neu.startTestServer({ ...dirs, now: { time: NOW, fixed: true } });
check(server.app.context.voucherRepair === null, `yeni kod: onarım yok (${JSON.stringify(server.app.context.voucherRepair)})`);
check(server.app.ledger.check().reconciliation.ok === true, "yeni kod: Defter Mutabakatı tutarlı");
await server.close();

// 4) eski kod — Şirket Verisini Sıfırla
server = await old.startTestServer({ ...dirs, now: { time: NOW, fixed: true } });
admin = await old.loginAdmin(server);
const reset = await admin.post("/api/companies/sirket-001/reset", { mode: "movements", confirm: "001", password: old.ADMIN_PASSWORD });
check(reset.status === 200, `eski kod: Şirket Verisini Sıfırla ${reset.status} ${JSON.stringify(reset.data?.data?.counts || reset.data)}`.slice(0, 400));
await server.close();
const left = vouchers().length;
check(left === 2, `eski kodun sıfırlamasından sonra fişler ARTAKALDI (${left}) — onarım gerekçesi`);
check(raw("SELECT COUNT(*) AS n FROM audit_events WHERE type = 'ledger.voucher.created'")[0].n === 0, "eski kod işlem geçmişini (fiş izleri dahil) sildi");

// 5) yeni kod — açılış onarımı
server = await neu.startTestServer({ ...dirs, now: { time: NOW, fixed: true } });
try {
  const repair = server.app.context.voucherRepair;
  check(repair?.removed === 2, `yeni kod: artakalan ${repair?.removed} fiş kaldırıldı`);
  check(server.app.store.get("SELECT COUNT(*) AS n FROM ledger_vouchers").n === 0 && server.app.store.get("SELECT COUNT(*) AS n FROM ledger_voucher_lines").n === 0, "fiş tabloları boş");
  check(Boolean(server.app.store.get("SELECT 1 AS found FROM integrity_log WHERE action = 'repair' AND tables = 'ledger_vouchers'")), "Mutabakat Günlüğü'nde onarım kaydı");
  check(server.app.store.all("SELECT name FROM sqlite_master WHERE type = 'trigger' AND name LIKE 'ledger_vou%'").length === 6, "tetikleyiciler yeniden kurulu");
  const scan = await (await neu.loginAdmin(server)).get("/api/workspace/ledger/integrity");
  check(scan.status === 200 && scan.data.data.ok === true, "yeni kod: Mutabakat Testi tutarlı");
  assert.ok(true);
} finally {
  await server.close();
  neu.removeTestDir(root);
}
console.log(`1..${tests}\n# tests ${tests}\n# pass ${tests - failed}\n# fail ${failed}\n# cancelled 0\n# skipped 0\n# todo 0`);
process.exit(failed ? 1 : 0);
