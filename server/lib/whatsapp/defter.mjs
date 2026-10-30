// WhatsApp GÖNDERİM DEFTERİ — 2.4.8 W2 (docs/erp/WHATSAPP-API-PLANI-2.4.8.md §6 W2 "GÜNLÜK SINIR", "ÇİFT GÖNDERİM YOK", "Program kapanırsa…").
//
// Kurulumun ana veri klasöründe (şirket dosyalarının DIŞINDA) ayrı, YALNIZ EKLENEN bir SQLite dosyası (whatsapp-gonderim.sqlite) — e-Belge kullanım defterinin
// düzeni (lib/einvoice/kullanim-defteri.mjs). Şirket yedeği bu dosyayı içermez; Yedekten Geri Yükle, Şirket Verisini Sıfırla ve verinin başka bilgisayara
// taşınması ona dokunmaz. Görevleri:
//   1. ÇİFT GÖNDERİM KİLİDİ: Meta'ya her ileti isteğinden ÖNCE (iş, deneme) için bir "talep" (claim) yazılır; istek bitince sonucu (accepted / failed /
//      uncertain). Bir işin önceki bir denemesi kabul edilmişse, sonucu belirsizse ya da sonucu hiç yazılmamışsa (istek sürerken süreç öldü) yeni talep
//      REDDEDİLİR — geri yüklenen eski bir yedek, iki sekme, çift tık ya da yeniden başlatma aynı işi ikinci kez gönderemez.
//   2. 24 SAAT SINIRI: Meta'nın gönderim sınırı (portföy başına, kayan 24 saatte FARKLI kişi) WABA kimliğine göre bu defterden sayılır: son 24 saatte talebi
//      olup sonucu "failed" OLMAYAN farklı numaralar (kabul edilen + sonucu belirsiz + süren). İki şirket aynı portföyü kullansa da tek sayaç; geri yükleme
//      sayacı azaltmaz.
//   3. CANLI TOPLU İŞLER: toplu iş açılınca "open", bitince/iptalde/geri yüklemede/sıfırlamada "stop" olayı. İşçi yalnız defterde canlı olan toplu işi yürütür
//      → geri yüklenen ya da başka bilgisayardan taşınan veri eski işleri DİRİLTMEZ (plan "Taşınan Veri — Durduruldu").
//   4. AYLIK SAYIM: teslim edilen (ücretli) iletiler — "Bu Ay Gönderilen İleti Sayısı" = TESLİM (Teslim Edildi + Okundu), ay = teslim zamanı (Türkiye saati),
//      kapsam WABA (plan §7a madde 19); kabul edilenler ayrıca. Geri yüklemeden etkilenmez.
//   5. META SINIR BEKLEMESİ: Meta sınır hatası verince aynı WABA'nın BÜTÜN işleri (iki şirket de) 24 saat bekler (plan §7a madde 30).
// Zamanlar iş saatinden (config.now) ISO metni; karşılaştırmalar metin üzerinden (hepsi toISOString biçiminde, UTC).
import { mkdirSync } from "node:fs";
import { randomUUID } from "node:crypto";
import path from "node:path";
import { openDatabase } from "../db.mjs";

export const WA_LEDGER_FILE = "whatsapp-gonderim.sqlite";
const SCHEMA = `
  CREATE TABLE IF NOT EXISTS meta (key TEXT PRIMARY KEY, value TEXT NOT NULL) STRICT;
  CREATE TABLE IF NOT EXISTS batch_events (
    batch_id TEXT NOT NULL, company_id TEXT NOT NULL, event TEXT NOT NULL CHECK (event IN ('open', 'stop')), reason TEXT NOT NULL DEFAULT '', at TEXT NOT NULL,
    PRIMARY KEY (batch_id, event)
  ) STRICT;
  CREATE INDEX IF NOT EXISTS idx_batch_events_company ON batch_events(company_id, event);
  CREATE TABLE IF NOT EXISTS claims (
    job_id TEXT NOT NULL, attempt INTEGER NOT NULL, batch_id TEXT NOT NULL, company_id TEXT NOT NULL, waba_id TEXT NOT NULL, phone TEXT NOT NULL,
    account_id TEXT NOT NULL DEFAULT '', kind TEXT NOT NULL DEFAULT '', period_key TEXT NOT NULL DEFAULT '', at TEXT NOT NULL,
    PRIMARY KEY (job_id, attempt)
  ) STRICT;
  CREATE INDEX IF NOT EXISTS idx_claims_waba ON claims(waba_id, at);
  CREATE INDEX IF NOT EXISTS idx_claims_account ON claims(company_id, account_id, kind, at);
  CREATE TABLE IF NOT EXISTS outcomes (
    job_id TEXT NOT NULL, attempt INTEGER NOT NULL, outcome TEXT NOT NULL CHECK (outcome IN ('accepted', 'failed', 'uncertain')), wamid TEXT NOT NULL DEFAULT '', at TEXT NOT NULL,
    PRIMARY KEY (job_id, attempt)
  ) STRICT;
  -- Kabul edilip sonradan TESLİM EDİLEMEDİĞİ bildirilen deneme (durum kancası "failed"): kilit çözülür ("Başarısızları Yeniden Dene" çift değildir),
  -- 24 saat sayacına girmez.
  CREATE TABLE IF NOT EXISTS failures (job_id TEXT NOT NULL, attempt INTEGER NOT NULL, at TEXT NOT NULL, PRIMARY KEY (job_id, attempt)) STRICT;
  CREATE TABLE IF NOT EXISTS accepts (job_id TEXT PRIMARY KEY, company_id TEXT NOT NULL, waba_id TEXT NOT NULL, at TEXT NOT NULL) STRICT;
  CREATE INDEX IF NOT EXISTS idx_accepts_company ON accepts(company_id, at);
  CREATE TABLE IF NOT EXISTS holds (waba_id TEXT NOT NULL, until TEXT NOT NULL, reason TEXT NOT NULL DEFAULT '', at TEXT NOT NULL) STRICT;
  CREATE INDEX IF NOT EXISTS idx_holds_waba ON holds(waba_id, until);
  CREATE TRIGGER IF NOT EXISTS holds_no_update BEFORE UPDATE ON holds BEGIN SELECT RAISE(ABORT, 'gönderim defteri yalnız eklenir'); END;
  CREATE TRIGGER IF NOT EXISTS holds_no_delete BEFORE DELETE ON holds BEGIN SELECT RAISE(ABORT, 'gönderim defteri yalnız eklenir'); END;
  CREATE TABLE IF NOT EXISTS deliveries (job_id TEXT PRIMARY KEY, company_id TEXT NOT NULL, waba_id TEXT NOT NULL, billable INTEGER NOT NULL DEFAULT 1, at TEXT NOT NULL) STRICT;
  CREATE INDEX IF NOT EXISTS idx_deliveries_company ON deliveries(company_id, at);
  CREATE TRIGGER IF NOT EXISTS batch_events_no_update BEFORE UPDATE ON batch_events BEGIN SELECT RAISE(ABORT, 'gönderim defteri yalnız eklenir'); END;
  CREATE TRIGGER IF NOT EXISTS batch_events_no_delete BEFORE DELETE ON batch_events BEGIN SELECT RAISE(ABORT, 'gönderim defteri yalnız eklenir'); END;
  CREATE TRIGGER IF NOT EXISTS claims_no_update BEFORE UPDATE ON claims BEGIN SELECT RAISE(ABORT, 'gönderim defteri yalnız eklenir'); END;
  CREATE TRIGGER IF NOT EXISTS claims_no_delete BEFORE DELETE ON claims BEGIN SELECT RAISE(ABORT, 'gönderim defteri yalnız eklenir'); END;
  CREATE TRIGGER IF NOT EXISTS outcomes_no_update BEFORE UPDATE ON outcomes BEGIN SELECT RAISE(ABORT, 'gönderim defteri yalnız eklenir'); END;
  CREATE TRIGGER IF NOT EXISTS outcomes_no_delete BEFORE DELETE ON outcomes BEGIN SELECT RAISE(ABORT, 'gönderim defteri yalnız eklenir'); END;
  CREATE TRIGGER IF NOT EXISTS failures_no_update BEFORE UPDATE ON failures BEGIN SELECT RAISE(ABORT, 'gönderim defteri yalnız eklenir'); END;
  CREATE TRIGGER IF NOT EXISTS failures_no_delete BEFORE DELETE ON failures BEGIN SELECT RAISE(ABORT, 'gönderim defteri yalnız eklenir'); END;
  CREATE TRIGGER IF NOT EXISTS accepts_no_update BEFORE UPDATE ON accepts BEGIN SELECT RAISE(ABORT, 'gönderim defteri yalnız eklenir'); END;
  CREATE TRIGGER IF NOT EXISTS accepts_no_delete BEFORE DELETE ON accepts BEGIN SELECT RAISE(ABORT, 'gönderim defteri yalnız eklenir'); END;
  CREATE TRIGGER IF NOT EXISTS deliveries_no_update BEFORE UPDATE ON deliveries BEGIN SELECT RAISE(ABORT, 'gönderim defteri yalnız eklenir'); END;
  CREATE TRIGGER IF NOT EXISTS deliveries_no_delete BEFORE DELETE ON deliveries BEGIN SELECT RAISE(ABORT, 'gönderim defteri yalnız eklenir'); END;
`;
export const DAY_MS = 86_400_000;

/**
 * @param {{ dir: string, log?: object, fault?: (op: string, row?: object) => boolean }} options fault: testlerde kesinti (true → o yazım düşer; "disk dolu")
 */
export function openWaLedger({ dir, log = console, fault = null }) {
  mkdirSync(dir, { recursive: true });
  const file = path.join(dir, WA_LEDGER_FILE);
  const db = openDatabase(file);
  db.exec(SCHEMA);
  let id = db.prepare("SELECT value FROM meta WHERE key = 'ledgerId'").get()?.value;
  if (!id) {
    id = `wal-${randomUUID()}`;
    db.prepare("INSERT OR IGNORE INTO meta (key, value) VALUES ('ledgerId', ?)").run(id);
    id = db.prepare("SELECT value FROM meta WHERE key = 'ledgerId'").get().value;
  }
  const guard = (op, row) => {
    if (fault?.(op, row)) {
      const error = new Error("WhatsApp gönderim defteri yazılamadı (test kesintisi: disk dolu)");
      error.code = "ENOSPC";
      throw error;
    }
  };
  const q = {
    open: db.prepare("INSERT OR IGNORE INTO batch_events (batch_id, company_id, event, reason, at) VALUES (?, ?, 'open', '', ?)"),
    stop: db.prepare("INSERT OR IGNORE INTO batch_events (batch_id, company_id, event, reason, at) VALUES (?, ?, 'stop', ?, ?)"),
    events: db.prepare("SELECT event, reason, at FROM batch_events WHERE batch_id = ?"),
    liveOf: db.prepare("SELECT o.batch_id AS batchId FROM batch_events o WHERE o.company_id = ? AND o.event = 'open' AND NOT EXISTS (SELECT 1 FROM batch_events s WHERE s.batch_id = o.batch_id AND s.event = 'stop')"),
    liveCompanies: db.prepare("SELECT DISTINCT o.company_id AS companyId FROM batch_events o WHERE o.event = 'open' AND NOT EXISTS (SELECT 1 FROM batch_events s WHERE s.batch_id = o.batch_id AND s.event = 'stop')"),
    attempts: db.prepare(`SELECT c.attempt, CASE WHEN f.job_id IS NOT NULL THEN 'failed' ELSE o.outcome END AS outcome, o.wamid FROM claims c
      LEFT JOIN outcomes o ON o.job_id = c.job_id AND o.attempt = c.attempt LEFT JOIN failures f ON f.job_id = c.job_id AND f.attempt = c.attempt WHERE c.job_id = ? ORDER BY c.attempt`),
    claim: db.prepare("INSERT INTO claims (job_id, attempt, batch_id, company_id, waba_id, phone, account_id, kind, period_key, at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)"),
    outcome: db.prepare("INSERT OR IGNORE INTO outcomes (job_id, attempt, outcome, wamid, at) VALUES (?, ?, ?, ?, ?)"),
    accept: db.prepare("INSERT OR IGNORE INTO accepts (job_id, company_id, waba_id, at) VALUES (?, ?, ?, ?)"),
    failure: db.prepare("INSERT OR IGNORE INTO failures (job_id, attempt, at) VALUES (?, ?, ?)"),
    deliver: db.prepare("INSERT OR IGNORE INTO deliveries (job_id, company_id, waba_id, billable, at) VALUES (?, ?, ?, ?, ?)"),
    window: db.prepare(`SELECT c.phone, MIN(c.at) AS first FROM claims c LEFT JOIN outcomes o ON o.job_id = c.job_id AND o.attempt = c.attempt
      WHERE c.waba_id = ? AND c.at > ? AND (o.outcome IS NULL OR o.outcome <> 'failed')
      AND NOT EXISTS (SELECT 1 FROM failures f WHERE f.job_id = c.job_id AND f.attempt = c.attempt) GROUP BY c.phone`),
    // R3 (plan §7a revizyonu): bu cariye bu şablon + dönem Meta'ya KABUL ETTİRİLMİŞ mi (Meta Kabul Etti ve sonrası; sonradan teslim edilemedi diye düşen hariç).
    // Kabul her zaman işin son denemesindedir (kabulden / belirsizden sonra yeni deneme yok).
    sentBefore: db.prepare(`SELECT c.account_id AS accountId, MAX(a.at) AS last FROM accepts a
      JOIN claims c ON c.job_id = a.job_id AND c.attempt = (SELECT MAX(c2.attempt) FROM claims c2 WHERE c2.job_id = a.job_id)
      WHERE c.company_id = ? AND c.kind = ? AND c.period_key = ? AND NOT EXISTS (SELECT 1 FROM failures f WHERE f.job_id = c.job_id AND f.attempt = c.attempt)
      GROUP BY c.account_id`),
    hold: db.prepare("INSERT INTO holds (waba_id, until, reason, at) VALUES (?, ?, ?, ?)"),
    holdOf: db.prepare("SELECT MAX(until) AS until FROM holds WHERE waba_id = ? AND until > ?"),
    accepted: db.prepare("SELECT COUNT(*) AS n FROM accepts WHERE company_id = ? AND at >= ? AND at < ?"),
    acceptedWaba: db.prepare("SELECT COUNT(*) AS n FROM accepts WHERE waba_id = ? AND at >= ? AND at < ?"),
    delivered: db.prepare("SELECT COUNT(*) AS n, COALESCE(SUM(billable), 0) AS billable FROM deliveries WHERE company_id = ? AND at >= ? AND at < ?"),
    deliveredWaba: db.prepare("SELECT COUNT(*) AS n, COALESCE(SUM(billable), 0) AS billable FROM deliveries WHERE waba_id = ? AND at >= ? AND at < ?"),
  };
  return {
    file,
    id,
    // ---------- Toplu işler ----------
    openBatch(batchId, companyId, at) {
      guard("open", { batchId });
      q.open.run(String(batchId), String(companyId), String(at));
    },
    /** Toplu işi kalıcı olarak durdurur (bitti, iptal, geri yükleme, sıfırlama, taşınma). İkinci kez yazılmaz (ilk neden kalır). */
    stopBatch(batchId, companyId, reason, at) {
      try {
        guard("stop", { batchId });
        q.stop.run(String(batchId), String(companyId), String(reason || ""), String(at));
        return true;
      } catch (error) {
        log.warn?.(`WhatsApp gönderim defteri: toplu iş ${batchId} durduruldu olarak yazılamadı (${error.message}).`);
        return false;
      }
    },
    /** { live, opened, stopped, reason } — işçi yalnız live işleri yürütür. */
    batchState(batchId) {
      const events = q.events.all(String(batchId));
      const open = events.find(item => item.event === "open");
      const stop = events.find(item => item.event === "stop");
      return { live: Boolean(open && !stop), opened: Boolean(open), stopped: Boolean(stop), reason: stop?.reason || "" };
    },
    liveBatches: companyId => q.liveOf.all(String(companyId)).map(row => row.batchId),
    liveCompanies: () => q.liveCompanies.all().map(row => row.companyId),
    /** Şirketin bütün canlı toplu işlerini durdurur (geri yükleme, sıfırlama); durdurulanların kimlikleri. */
    stopCompany(companyId, reason, at) {
      const ids = q.liveOf.all(String(companyId)).map(row => row.batchId);
      for (const batchId of ids) this.stopBatch(batchId, companyId, reason, at);
      return ids;
    },
    // ---------- Çift gönderim kilidi ----------
    /** Bir işin denemeleri: [{ attempt, outcome (null = sonuç yazılmadı), wamid }]. */
    attempts: jobId => q.attempts.all(String(jobId)).map(row => ({ attempt: row.attempt, outcome: row.outcome || null, wamid: row.wamid || "" })),
    /**
     * Yeni deneme talebi. Önceki bir deneme kabul edilmiş / belirsiz / sonuçsuz ise talep YAZILMAZ: { ok: false, previous }. Yazım düşerse hata fırlatır
     * (çağıran isteği GÖNDERMEZ).
     */
    claim(row) {
      const previous = q.attempts.all(String(row.jobId)).map(item => ({ attempt: item.attempt, outcome: item.outcome || null, wamid: item.wamid || "" }));
      const blocking = previous.find(item => item.outcome !== "failed");
      if (blocking) return { ok: false, previous: blocking };
      guard("claim", row);
      db.exec("BEGIN IMMEDIATE");
      try {
        const again = q.attempts.all(String(row.jobId)).find(item => item.outcome !== "failed");
        if (again) {
          db.exec("ROLLBACK");
          return { ok: false, previous: { attempt: again.attempt, outcome: again.outcome || null, wamid: again.wamid || "" } };
        }
        q.claim.run(String(row.jobId), Number(row.attempt), String(row.batchId), String(row.companyId), String(row.wabaId), String(row.phone), String(row.accountId || ""), String(row.kind || ""), String(row.periodKey || ""), String(row.at));
        db.exec("COMMIT");
      } catch (error) {
        try {
          db.exec("ROLLBACK");
        } catch {
          // işlem zaten kapanmış
        }
        throw error;
      }
      return { ok: true };
    },
    /** Denemenin sonucu (ilk yazılan kalır). accepted ise aylık sayım satırı da. Hata fırlatmaz: false + günlük. */
    outcome(row) {
      try {
        guard("outcome", row);
        q.outcome.run(String(row.jobId), Number(row.attempt), row.outcome, String(row.wamid || ""), String(row.at));
        if (row.outcome === "accepted") q.accept.run(String(row.jobId), String(row.companyId), String(row.wabaId), String(row.at));
        return true;
      } catch (error) {
        log.warn?.(`WhatsApp gönderim defteri: ${row.jobId} sonucu (${row.outcome}) yazılamadı (${error.message}).`);
        return false;
      }
    },
    /** Belirsiz işin kabul edildiği sonradan (durum bildirimiyle) anlaşıldı: aylık sayıma girer. */
    lateAccept(row) {
      try {
        guard("accept", row);
        q.accept.run(String(row.jobId), String(row.companyId), String(row.wabaId), String(row.at));
        return true;
      } catch (error) {
        log.warn?.(`WhatsApp gönderim defteri: ${row.jobId} kabulü yazılamadı (${error.message}).`);
        return false;
      }
    },
    /** Kabul edilmiş deneme teslim edilemedi (durum kancası "failed"): kilit çözülür, 24 saat sayacından düşer. */
    deliveryFailed(row) {
      try {
        guard("failure", row);
        q.failure.run(String(row.jobId), Number(row.attempt), String(row.at));
        return true;
      } catch (error) {
        log.warn?.(`WhatsApp gönderim defteri: ${row.jobId} teslim hatası yazılamadı (${error.message}).`);
        return false;
      }
    },
    delivered(row) {
      try {
        guard("deliver", row);
        q.deliver.run(String(row.jobId), String(row.companyId), String(row.wabaId), row.billable === false ? 0 : 1, String(row.at));
        return true;
      } catch (error) {
        log.warn?.(`WhatsApp gönderim defteri: ${row.jobId} teslimi yazılamadı (${error.message}).`);
        return false;
      }
    },
    // ---------- 24 saat sınırı ----------
    /** Kayan pencere (since = şimdi − 24 sa, ISO): { count, phones: Set, oldest (ISO | null) }. */
    windowUsage(wabaId, since) {
      const rows = q.window.all(String(wabaId), String(since));
      let oldest = null;
      for (const row of rows) if (!oldest || row.first < oldest) oldest = row.first;
      return { count: rows.length, phones: new Set(rows.map(row => row.phone)), oldest };
    },
    /** R3: { companyId, kind, periodKey } → Map(cari kimliği → son kabul anı ISO). Geri yükleme bu bilgiyi silmez (makine defteri). */
    sentBefore({ companyId, kind, periodKey }) {
      return new Map(q.sentBefore.all(String(companyId), String(kind), String(periodKey)).map(row => [row.accountId, row.last]));
    },
    // ---------- Meta sınır beklemesi (WABA başına) ----------
    holdWaba(wabaId, until, reason, at) {
      try {
        guard("hold", { wabaId });
        q.hold.run(String(wabaId), String(until), String(reason || ""), String(at));
        return true;
      } catch (error) {
        log.warn?.(`WhatsApp gönderim defteri: ${wabaId} sınır beklemesi yazılamadı (${error.message}).`);
        return false;
      }
    },
    /** Süren bekleme bitişi (ISO) ya da null. */
    holdOf: (wabaId, now) => q.holdOf.get(String(wabaId), String(now))?.until || null,
    // ---------- Aylık sayım ----------
    monthCounts({ companyId, wabaId = "", from, to }) {
      const company = { accepted: q.accepted.get(String(companyId), from, to).n, ...(row => ({ delivered: row.n, billable: row.billable }))(q.delivered.get(String(companyId), from, to)) };
      const waba = wabaId ? { accepted: q.acceptedWaba.get(String(wabaId), from, to).n, ...(row => ({ delivered: row.n, billable: row.billable }))(q.deliveredWaba.get(String(wabaId), from, to)) } : null;
      return { company, waba };
    },
    close() {
      db.close();
    },
  };
}
