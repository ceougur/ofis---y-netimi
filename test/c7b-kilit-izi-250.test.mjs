// 2.5.0 Ç7b tur 2b — B-7 (BAŞ MİMAR KARARI 19.11 04:35; docs/erp/C7B-FATURA-TASARIM.md §11.5, §12): KG-24'ün (ihracat 601) okuduğu kalem alanları — kalemin hesabı, istisna kodu, neti —
// kilit izine girer; kilit izi TANIMININ sürümü artar (LOCK_SQL_VERSION 2.5.1). VAR OLAN kilitler (önceki tanımla kaydedilmiş iz; v2.4.9'un gerçek koduyla üretilmiş kilitli veri) güncellemede
// yanlış "değişti" alarmı VERMEZ; kilitli ihracat satışının 600 → 601 farkı Kural Değişikliği Farkı'nda (uyarı) görünür, donmuş defter değişmez. Veri v2.4.9'un GERÇEK koduyla API'den
// (ders 17); sahte saat, lisans servisi yok (ders 13, 30). Beklenen sayılar elle (kalemin neti).
import assert from "node:assert/strict";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { DatabaseSync } from "node:sqlite";
import { describe, it } from "node:test";
import { LOCK_SQL_VERSION, lockDigestOf } from "../server/lib/integrity.mjs";
import { CURRENT, bootVersion, tagsAvailable } from "./guvenilirlik/surumler.mjs";

process.env.HUKUK_LICENSE_URL ||= "http://127.0.0.1:9";
const NOW = { time: "2026-10-20T12:00:00+03:00", fixed: true };
const LOCK = "2026-09-30";

describe("Ç7b B-7 — kalem istisna kodu kilit izinde; var olan kilitte yanlış alarm yok", () => {
  it("kilit izi tanımı 2.5.1: ihracat kaleminin hesabı / istisna kodu / neti izde; 2.5.0 tanımının izi bu alanlarla DEĞİŞMEZ (önceki koşular kendi tanımıyla)", { timeout: 240_000, skip: tagsAvailable(["v2.4.9"]) ? false : "v2.4.9 etiketi yok" }, async () => {
    const root = mkdtempSync(path.join(tmpdir(), "c7b-b7-"));
    const dirs = { dataDir: path.join(root, "data"), backupDir: path.join(root, "backups") };
    let server = null;
    const must = async (label, promise) => {
      const res = await promise;
      assert.equal(res.status, 200, `${label}: ${res.status} ${JSON.stringify(res.data).slice(0, 300)}`);
      return res.data;
    };
    try {
      const old = await bootVersion("v2.4.9", { ...dirs, now: NOW });
      try {
        const api = await old.login();
        const party = await must("cari", api.post("/api/workspace/accounts", { name: "B7 Yurt Dışı Alıcı", type: "customer", registeredOn: "2026-08-01" }));
        // Karma fatura: yurt içi 3.000 (%20) + ihracat 2.000 (%0, 301) — kilitli dönemde.
        await must("karma ihracat", api.post("/api/workspace/invoices", { scenario: "service_sale", accountId: party.id, issueDate: "2026-09-12", lines: [{ name: "Yurt İçi", qty: 1, unitPrice: 3000, vatRate: 20 }, { name: "Yurt Dışı", qty: 1, unitPrice: 2000, vatRate: 0, exemptionCode: "301" }], payment: { rest: "open" } }));
        await must("ihracatsız satış", api.post("/api/workspace/invoices", { scenario: "service_sale", accountId: party.id, issueDate: "2026-09-13", lines: [{ name: "Danışmanlık", qty: 1, unitPrice: 1000, vatRate: 20 }], payment: { rest: "open" } }));
        await must("kilit", api.put("/api/admin/period-lock", { lockedUntil: LOCK }));
      } finally {
        await old.close();
      }
      server = await bootVersion(CURRENT, { ...dirs, now: NOW, integrityScan: false });
      const { app } = server;
      await app.ledger.snapshots.runPending();
      assert.equal(app.ledger.snapshots.state().pending, null, "açılıştaki dondurma bitmeli");
      const api = await server.login();
      // (1) Güncellemede yanlış alarm yok: kilit izi / donmuş defterin kaynağı tutarlı; tek uyarı kural farkı (600 → 601, KG-24).
      const scan = await must("Mutabakat Testi", api.get("/api/workspace/ledger/integrity"));
      const failures = (scan.failures || []).map(item => item.code);
      assert.equal(failures.includes("period-lock"), false, `güncellemede kilit izi alarmı: ${JSON.stringify(failures)}`);
      assert.equal(failures.includes("ledger:snapshot"), false, `Donmuş Defter denetimi temiz (kaynak değişmedi): ${JSON.stringify(failures)}`);
      const diff = (scan.checks || []).find(item => item.code === "ledger:rule-diff");
      assert.ok(diff && diff.ok === false && diff.severity === "warning", `kural farkı uyarısı: ${JSON.stringify(diff).slice(0, 400)}`);
      // Elle: ihracat kaleminin neti 2.000 TL → 600'den 601'e (kalem payı; yurt içi 3.000 ve ihracatsız 1.000 600'de kalır).
      assert.deepEqual(Object.fromEntries(diff.breakdown.map(row => [row.account, row.differenceMinor])), { 600: 200000, 601: -200000 }, `kural farkı yalnız KG-24: ${JSON.stringify(diff.breakdown)}`);
      assert.deepEqual(failures.filter(code => code !== "ledger:rule-diff"), [], "kural farkı dışında Mutabakat Testi temiz");
      // (2) Kilit izi: güncel tanım (2.5.1) kalem alanlarını izler, 2.5.0 tanımı izlemez (önceki koşunun izi kendi tanımıyla aynı kalır).
      const store = app.store;
      const run = store.get("SELECT digest_version AS v, source_digest AS d FROM ledger_snapshot_runs WHERE state = 'done' ORDER BY no DESC LIMIT 1");
      assert.equal(run.v, LOCK_SQL_VERSION, "güncellemedeki dondurma koşusu güncel tanımla");
      assert.equal(lockDigestOf(store, LOCK, { version: run.v }), run.d, "koşunun kaynak izi");
      const line = store.get("SELECT l.id, l.exemption_code AS code, l.gl_account AS gl, l.net FROM invoice_lines l JOIN invoices i ON i.id = l.invoice_id WHERE l.exemption_code = '301'");
      assert.ok(line, "ön koşul: kilitli ihracat kalemi");
      const plain = store.get("SELECT l.id FROM invoice_lines l JOIN invoices i ON i.id = l.invoice_id WHERE i.issue_date = '2026-09-13'");
      const before = { now: lockDigestOf(store, LOCK, { version: LOCK_SQL_VERSION }), v250: lockDigestOf(store, LOCK, { version: "2.5.0" }) };
      const other = new DatabaseSync(store.get("PRAGMA database_list").file);
      try {
        other.exec("PRAGMA busy_timeout = 5000");
        for (const [label, sql, args, undo] of [
          ["istisna kodu", "UPDATE invoice_lines SET exemption_code = '' WHERE id = ?", [line.id], ["UPDATE invoice_lines SET exemption_code = ? WHERE id = ?", [line.code, line.id]]],
          ["kalem hesabı", "UPDATE invoice_lines SET gl_account = '602' WHERE id = ?", [line.id], ["UPDATE invoice_lines SET gl_account = ? WHERE id = ?", [line.gl, line.id]]],
          ["kalem neti", "UPDATE invoice_lines SET net = net + 1 WHERE id = ?", [line.id], ["UPDATE invoice_lines SET net = ? WHERE id = ?", [line.net, line.id]]],
          ["ihracatsız faturaya ihracat kodu", "UPDATE invoice_lines SET exemption_code = '302' WHERE id = ?", [plain.id], ["UPDATE invoice_lines SET exemption_code = '' WHERE id = ?", [plain.id]]],
        ]) {
          other.prepare(sql).run(...args);
          try {
            assert.notEqual(lockDigestOf(store, LOCK, { version: LOCK_SQL_VERSION }), before.now, `${label}: güncel kilit izi değişmeli`);
            assert.equal(lockDigestOf(store, LOCK, { version: "2.5.0" }), before.v250, `${label}: 2.5.0 tanımının izi değişmemeli (önceki koşu yanlış alarm vermez)`);
          } finally {
            other.prepare(undo[0]).run(...undo[1]);
          }
        }
      } finally {
        other.close();
      }
      assert.equal(lockDigestOf(store, LOCK, { version: LOCK_SQL_VERSION }), before.now, "geri alındı");
      assert.equal(LOCK_SQL_VERSION, "2.5.1", "kilit izi tanımının sürümü arttı (B-7)");
    } finally {
      await server?.close();
      rmSync(root, { recursive: true, force: true });
    }
  });
});
