// 2.4.8 İş U5 (dar kontrol 15 b7; tasarim-u-248 §4, onaylı koşul b): "Bu Ay Gönderilen İleti Sayısı" deneme başına teslim — YALNIZ EKLENEN attempt_deliveries tablosu
// (CREATE IF NOT EXISTS; göç yok). Denenen: (1) 2.4.8 geliştirme kodu ad4db62b'nin GERÇEK koduyla API'den üretilmiş defter (test/fixtures/whatsapp-defter-ad4db62b;
// üretim betiği uret.mjs.txt) yeni kodla açılır — eski teslim bir kez sayılır, aynı teslimin yinelenmesi çift saymaz, 2. denemenin teslimi ayrı sayılır; (2) yarıda kalmış
// şema (tablo var, dizin / tetikleyici yok) açılışta tamamlanır; (3) yeni defterde iki deneme iki teslim, iş başına "kişi aldı" tek. Eski kodla yeni defterin açılışı
// (geri dönüş) kanıt koşusunda (docs/kanit/…/248-dkUfix-u5-geri-donus) — eski kod depoda yok.
import assert from "node:assert/strict";
import { copyFileSync, mkdtempSync, readFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { DatabaseSync } from "node:sqlite";
import { describe, it } from "node:test";
import { fileURLToPath } from "node:url";
import { openWaLedger } from "../server/lib/whatsapp/defter.mjs";
import { removeTestDir } from "./helpers.mjs";

const HERE = path.dirname(fileURLToPath(import.meta.url));
const FIXTURE = path.join(HERE, "fixtures", "whatsapp-defter-ad4db62b");
const INFO = JSON.parse(readFileSync(path.join(FIXTURE, "bilgi.json"), "utf8"));
const NOV = { from: "2026-10-31T21:00:00.000Z", to: "2026-11-30T21:00:00.000Z" };
const WABA = "102290129340398";
const quiet = { warn() {}, info() {}, error() {} };
const counts = ledger => ledger.monthCounts({ companyId: INFO.companyId, wabaId: WABA, ...NOV });

function copyFixture() {
  const dir = mkdtempSync(path.join(tmpdir(), "destekofis-u5-"));
  copyFileSync(path.join(FIXTURE, "whatsapp-gonderim.sqlite"), path.join(dir, "whatsapp-gonderim.sqlite"));
  return dir;
}

describe("2.4.8 İş U5 — Bu Ay deneme başına teslim (göçsüz)", () => {
  it("ad4db62b'nin gerçek defteri yeni kodla açılır: eski teslim 1 kez; aynı teslimin (aynı an) yinelenmesi çift saymaz; 2. denemenin teslimi ayrı (2)", () => {
    const dir = copyFixture();
    let ledger = null;
    try {
      ledger = openWaLedger({ dir, log: quiet });
      assert.equal(INFO.buAy, 1, "ön koşul: eski kodda Bu Ay 1");
      assert.equal(counts(ledger).company.delivered, 1, "eski teslim bir kez");
      assert.equal(counts(ledger).waba.delivered, 1);
      assert.equal(ledger.deliveredJob(INFO.jobId), true);
      // Meta aynı teslimi yineler (aynı zaman damgası) → deneme satırı yazılır, eski satır onunla eşleşir: yine 1.
      assert.equal(ledger.delivered({ jobId: INFO.jobId, attempt: 1, companyId: INFO.companyId, wabaId: WABA, billable: true, at: INFO.deliveredAt }), true);
      assert.equal(counts(ledger).company.delivered, 1, "yinelenen teslim çift sayılmaz");
      assert.equal(ledger.delivered({ jobId: INFO.jobId, attempt: 2, companyId: INFO.companyId, wabaId: WABA, billable: true, at: "2026-11-04T10:00:00.000Z" }), true);
      assert.deepEqual([counts(ledger).company.delivered, counts(ledger).company.billable, counts(ledger).waba.delivered], [2, 2, 2], "2. denemenin teslimi ayrı sayılır");
      ledger.close();
      ledger = openWaLedger({ dir, log: quiet }); // yeniden açılış: aynı sayım
      assert.equal(counts(ledger).company.delivered, 2);
    } finally {
      ledger?.close();
      removeTestDir(dir);
    }
  });

  it("yarıda kalmış şema (attempt_deliveries var, dizin / tetikleyici yok) açılışta tamamlanır; sayım doğru; yalnız eklenir", () => {
    const dir = copyFixture();
    let ledger = null;
    try {
      const raw = new DatabaseSync(path.join(dir, "whatsapp-gonderim.sqlite"));
      raw.exec("CREATE TABLE attempt_deliveries (job_id TEXT NOT NULL, attempt INTEGER NOT NULL, company_id TEXT NOT NULL, waba_id TEXT NOT NULL, billable INTEGER NOT NULL DEFAULT 1, at TEXT NOT NULL, PRIMARY KEY (job_id, attempt)) STRICT");
      raw.close();
      ledger = openWaLedger({ dir, log: quiet });
      const check = new DatabaseSync(path.join(dir, "whatsapp-gonderim.sqlite"), { readOnly: true });
      const names = check.prepare("SELECT name FROM sqlite_master WHERE tbl_name = 'attempt_deliveries' ORDER BY name").all().map(row => row.name);
      check.close();
      assert.deepEqual(names, ["attempt_deliveries", "attempt_deliveries_no_delete", "attempt_deliveries_no_update", "idx_attempt_deliveries_company", "idx_attempt_deliveries_waba", "sqlite_autoindex_attempt_deliveries_1"]);
      assert.equal(counts(ledger).company.delivered, 1);
      ledger.delivered({ jobId: INFO.jobId, attempt: 2, companyId: INFO.companyId, wabaId: WABA, billable: true, at: "2026-11-04T10:00:00.000Z" });
      assert.equal(counts(ledger).company.delivered, 2);
      ledger.close();
      ledger = null;
      const write = new DatabaseSync(path.join(dir, "whatsapp-gonderim.sqlite"));
      assert.throws(() => write.exec("DELETE FROM attempt_deliveries"), /yalnız eklenir/);
      write.close();
    } finally {
      ledger?.close();
      removeTestDir(dir);
    }
  });

  it("yeni defter: iki denemenin teslimi Bu Ay 2, iş başına 'kişi aldı' tek; aynı denemenin yinelenen teslimi etkisiz", () => {
    const dir = mkdtempSync(path.join(tmpdir(), "destekofis-u5-yeni-"));
    let ledger = null;
    try {
      ledger = openWaLedger({ dir, log: quiet });
      for (const [attempt, at] of [[1, "2026-11-03T10:00:00.000Z"], [1, "2026-11-03T10:00:00.000Z"], [2, "2026-11-04T10:00:00.000Z"], [2, "2026-11-04T11:00:00.000Z"]]) {
        ledger.delivered({ jobId: "waj-x", attempt, companyId: "sirket-001", wabaId: WABA, billable: true, at });
      }
      assert.equal(ledger.monthCounts({ companyId: "sirket-001", wabaId: WABA, ...NOV }).company.delivered, 2);
      assert.deepEqual([ledger.deliveredJob("waj-x"), ledger.deliveredAttempt("waj-x", 1), ledger.deliveredAttempt("waj-x", 2), ledger.deliveredAttempt("waj-x", 3)], [true, true, true, false]);
    } finally {
      ledger?.close();
      removeTestDir(dir);
    }
  });
});
