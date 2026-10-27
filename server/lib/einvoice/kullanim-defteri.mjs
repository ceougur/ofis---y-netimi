// e-Belge KULLANIM DEFTERİ (2.4.7 E4; kullanıcı kararı S4, 27.10.2026: "Yedekten Geri Yükle ve Şirket Verisini Sıfırla sayacı ETKİLEMEZ"). EDM iş ortaklığı
// hak edişinin programdaki kaydı, şirket veri dosyalarının DIŞINDA: kurulumun ana veri klasöründe ayrı, yalnız eklenen bir SQLite dosyası
// (e-belge-kullanim.sqlite). Şirket yedeği bu dosyayı içermez; geri yükleme ve sıfırlama ona dokunmaz.
//
// İKİ YAZIM (şirket dosyası + bu defter) tek işlemde birleşemez (SQLite ayrı dosyalar arasında WAL'da atomik işlem vermez). Sıra ve hata yönü:
//   1) Şirketin işleminde durum yazımıyla BİRLİKTE şirket dosyasına iz satırı (edoc_usage; lib/einvoice/kullanim.mjs recordUsage) — durum ile iz ya
//      birlikte yazılır ya hiç.
//   2) İşlem bittikten sonra iz satırı bu deftere eklenir (add). Ekleme düşerse (disk, kilit) iz şirket dosyasında kalır; açılışta ve her kullanım
//      özetinde bütün şirketlerin izleri deftere yeniden aktarılır (syncFrom). Anahtar (şirket, ETTN, ortam) birincil anahtardır: aktarma kaç kez
//      yinelenirse yinelensin ÇİFT SAYIM OLMAZ.
//   Hata yönü: çift sayım asla; kayıp yalnız "iz yazıldı, deftere eklenemedi, ardından eklenmeden önce şirket bu andan ESKİ bir yedekten geri yüklendi"
//   penceresinde mümkün (eksik sayım: hak ediş fazla gösterilmez).
import { mkdirSync } from "node:fs";
import path from "node:path";
import { openDatabase } from "../db.mjs";

const SCHEMA = `
  CREATE TABLE IF NOT EXISTS usage (
    company_id TEXT NOT NULL, ettn TEXT NOT NULL, env TEXT NOT NULL CHECK (env IN ('test', 'live')),
    kind TEXT NOT NULL CHECK (kind IN ('efatura', 'earsiv', 'esmm')), month TEXT NOT NULL CHECK (length(month) = 7),
    company_code TEXT NOT NULL DEFAULT '', invoice_id TEXT NOT NULL DEFAULT '', source TEXT NOT NULL DEFAULT '', created_at TEXT NOT NULL,
    added_at TEXT NOT NULL, PRIMARY KEY (company_id, ettn, env)
  ) STRICT;
  CREATE INDEX IF NOT EXISTS idx_usage_month ON usage(month, env, kind);
  CREATE TRIGGER IF NOT EXISTS usage_no_update BEFORE UPDATE ON usage BEGIN SELECT RAISE(ABORT, 'kullanım defteri yalnız eklenir'); END;
  CREATE TRIGGER IF NOT EXISTS usage_no_delete BEFORE DELETE ON usage BEGIN SELECT RAISE(ABORT, 'kullanım defteri yalnız eklenir'); END;
`;
export const USAGE_LEDGER_FILE = "e-belge-kullanim.sqlite";

/**
 * @param {{ dir: string, log?: object, fault?: (row) => boolean }} options fault: testlerde kesinti (true → ekleme düşer)
 */
export function openUsageLedger({ dir, log = console, fault = null }) {
  mkdirSync(dir, { recursive: true });
  const db = openDatabase(path.join(dir, USAGE_LEDGER_FILE));
  db.exec(SCHEMA);
  const insert = db.prepare("INSERT OR IGNORE INTO usage (company_id, ettn, env, kind, month, company_code, invoice_id, source, created_at, added_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)");
  const put = (companyId, companyCode, row) => {
    if (fault?.(row)) throw new Error("kullanım defteri yazılamadı (test kesintisi)");
    return Number(insert.run(String(companyId), String(row.ettn), row.env, row.kind, row.month, String(companyCode || ""), String(row.invoice_id ?? row.invoiceId ?? ""), String(row.source || ""), String(row.created_at ?? row.createdAt ?? ""), new Date().toISOString()).changes) > 0;
  };
  return {
    file: path.join(dir, USAGE_LEDGER_FILE),
    /** Tek iz satırı (durum yazımından hemen sonra). Hata fırlatmaz: false + günlük; iz sonraki aktarmada gelir. */
    add(companyId, companyCode, row) {
      try {
        return put(companyId, companyCode, row);
      } catch (error) {
        log.warn?.(`e-Belge kullanım defteri: ${companyCode || companyId} ${row?.ettn || ""} eklenemedi (${error.message}); sonraki aktarmada eklenecek.`);
        return false;
      }
    },
    /** Bir şirketin bütün iz satırlarını aktarır; eklenen satır sayısı. */
    syncFrom(companyId, companyCode, rows = []) {
      let added = 0;
      db.exec("BEGIN");
      try {
        for (const row of rows) if (put(companyId, companyCode, row)) added += 1;
        db.exec("COMMIT");
      } catch (error) {
        db.exec("ROLLBACK");
        throw error;
      }
      return added;
    },
    /** Ay × ortam × tür sayıları ({ month, env, kind, count }); companyId verilirse yalnız o şirket. */
    counts({ from = "", companyId = null } = {}) {
      const where = companyId ? "WHERE month >= ? AND company_id = ?" : "WHERE month >= ?";
      return db.prepare(`SELECT month, env, kind, COUNT(*) AS count FROM usage ${where} GROUP BY month, env, kind`).all(...(companyId ? [from, companyId] : [from]));
    },
    has(companyId, ettn, env) {
      return Boolean(db.prepare("SELECT 1 AS found FROM usage WHERE company_id = ? AND ettn = ? AND env = ?").get(String(companyId), String(ettn).toLowerCase(), env));
    },
    close() {
      db.close();
    },
  };
}
