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
//   6. DURUM BİLDİRİMİ ADRESİ (T2-3/4, bağımsız gözden geçirme r2 + r7): Meta'da kanca adresi (override_callback_uri) WABA + uygulama başına TEKTİR (plan §3) → kaydı
//      da WABA başına tek ve şirket dosyalarının DIŞINDA (hook_events; gizli yolun ve doğrulama belirtecinin yalnız SHA-256 karması — açık değer hiçbir yerde
//      saklanmaz). Aynı WABA'yı kullanan iki şirket aynı adresi paylaşır; gelen bildirim wamid'den (claims + outcomes) ya da imzalı iş kimliğinden doğru şirkete
//      yönlendirilir. Yedekten Geri Yükle / Şirket Verisini Sıfırla bu kaydı değiştirmez (eski bir dosya eski gizli yolu "geri getiremez"). hook_seen: bu WABA'nın
//      kancasına son bildirim (saat başına bir satır; §7a 16 "bildirim yolu çalışıyor").
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
  -- T2 dar kontrol ORTA-1: ilk açılış / ilk durdurmadan SONRAKİ yaşam döngüsü (131049 ile yeniden açılma, sonraki durdurma / iptal / bitiş) sırayla. Son olay geçerlidir;
  -- günlük yoksa batch_events geçerlidir. Geri yüklenen eski dosya defterdeki son kararı (ör. iptal) geri alamaz.
  CREATE TABLE IF NOT EXISTS batch_log (
    seq INTEGER PRIMARY KEY AUTOINCREMENT, batch_id TEXT NOT NULL, company_id TEXT NOT NULL, event TEXT NOT NULL CHECK (event IN ('reopen', 'stop')),
    reason TEXT NOT NULL DEFAULT '', at TEXT NOT NULL
  ) STRICT;
  CREATE INDEX IF NOT EXISTS idx_batch_log_batch ON batch_log(batch_id, seq);
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
  -- T1 B2: kabul edilip durum kancasıyla 131049 (ekosistem sağlığı) bildirilen deneme — iş "Meta Bekletti (24 Saat Sonra Yeniden)": kilit çözülür (24 saat sonra BİR
  -- kez yeniden), ama 24 saat sayacından DÜŞMEZ (iletinin alıcısı pencerede sayılmış kalır; plan §6 W2, §7a 14).
  CREATE TABLE IF NOT EXISTS releases (job_id TEXT NOT NULL, attempt INTEGER NOT NULL, at TEXT NOT NULL, PRIMARY KEY (job_id, attempt)) STRICT;
  CREATE TABLE IF NOT EXISTS accepts (job_id TEXT PRIMARY KEY, company_id TEXT NOT NULL, waba_id TEXT NOT NULL, at TEXT NOT NULL) STRICT;
  CREATE INDEX IF NOT EXISTS idx_accepts_company ON accepts(company_id, at);
  CREATE TABLE IF NOT EXISTS holds (waba_id TEXT NOT NULL, until TEXT NOT NULL, reason TEXT NOT NULL DEFAULT '', at TEXT NOT NULL) STRICT;
  CREATE INDEX IF NOT EXISTS idx_holds_waba ON holds(waba_id, until);
  CREATE TRIGGER IF NOT EXISTS holds_no_update BEFORE UPDATE ON holds BEGIN SELECT RAISE(ABORT, 'gönderim defteri yalnız eklenir'); END;
  CREATE TRIGGER IF NOT EXISTS holds_no_delete BEFORE DELETE ON holds BEGIN SELECT RAISE(ABORT, 'gönderim defteri yalnız eklenir'); END;
  CREATE TABLE IF NOT EXISTS deliveries (job_id TEXT PRIMARY KEY, company_id TEXT NOT NULL, waba_id TEXT NOT NULL, billable INTEGER NOT NULL DEFAULT 1, at TEXT NOT NULL) STRICT;
  -- T2-3/4: durum bildirimi adresinin kayıt olayları (WABA başına; son satır geçerli kayıt). reason: manual (Yeniden Kaydet / Bağlantıyı Sına), auto (bakım turu:
  -- kayıt yok / adres değişti / düşmüştü), mismatch (Meta'daki adres programınkinden farklıydı).
  CREATE TABLE IF NOT EXISTS hook_events (
    seq INTEGER PRIMARY KEY AUTOINCREMENT, waba_id TEXT NOT NULL, path_hash TEXT NOT NULL, verify_hash TEXT NOT NULL, base TEXT NOT NULL,
    state TEXT NOT NULL CHECK (state IN ('pending', 'active', 'failed', 'conflict')), reason TEXT NOT NULL DEFAULT '', error TEXT NOT NULL DEFAULT '', at TEXT NOT NULL
  ) STRICT;
  CREATE INDEX IF NOT EXISTS idx_hook_events_waba ON hook_events(waba_id, seq);
  CREATE INDEX IF NOT EXISTS idx_hook_events_path ON hook_events(path_hash);
  CREATE TABLE IF NOT EXISTS hook_seen (waba_id TEXT NOT NULL, hour TEXT NOT NULL, at TEXT NOT NULL, PRIMARY KEY (waba_id, hour)) STRICT;
  CREATE INDEX IF NOT EXISTS idx_outcomes_wamid ON outcomes(wamid) WHERE wamid <> '';
  -- T2 dar kontrol 2 ORTA-A: Meta'nın kabul ettiği ama eşzamanlı yanıtı alınamamış (Sonucu Belirsiz) denemenin wamid'i sonradan (imzalı durum kancası / geç kabul)
  -- öğrenilir; outcomes "ilk yazılan kalır" (belirsiz satırında wamid boş) → wamid'in hangi denemeye ait olduğu bu tabloya yazılır. Yalnız eklenir; ilk yazılan kalır.
  CREATE TABLE IF NOT EXISTS learned_wamids (job_id TEXT NOT NULL, attempt INTEGER NOT NULL, wamid TEXT NOT NULL, at TEXT NOT NULL, PRIMARY KEY (job_id, attempt)) STRICT;
  CREATE INDEX IF NOT EXISTS idx_learned_wamids_wamid ON learned_wamids(wamid);
  CREATE TRIGGER IF NOT EXISTS learned_wamids_no_update BEFORE UPDATE ON learned_wamids BEGIN SELECT RAISE(ABORT, 'gönderim defteri yalnız eklenir'); END;
  CREATE TRIGGER IF NOT EXISTS learned_wamids_no_delete BEFORE DELETE ON learned_wamids BEGIN SELECT RAISE(ABORT, 'gönderim defteri yalnız eklenir'); END;
  CREATE TRIGGER IF NOT EXISTS hook_events_no_update BEFORE UPDATE ON hook_events BEGIN SELECT RAISE(ABORT, 'gönderim defteri yalnız eklenir'); END;
  CREATE TRIGGER IF NOT EXISTS hook_events_no_delete BEFORE DELETE ON hook_events BEGIN SELECT RAISE(ABORT, 'gönderim defteri yalnız eklenir'); END;
  CREATE TRIGGER IF NOT EXISTS hook_seen_no_update BEFORE UPDATE ON hook_seen BEGIN SELECT RAISE(ABORT, 'gönderim defteri yalnız eklenir'); END;
  CREATE TRIGGER IF NOT EXISTS hook_seen_no_delete BEFORE DELETE ON hook_seen BEGIN SELECT RAISE(ABORT, 'gönderim defteri yalnız eklenir'); END;
  CREATE INDEX IF NOT EXISTS idx_deliveries_company ON deliveries(company_id, at);
  CREATE TRIGGER IF NOT EXISTS batch_events_no_update BEFORE UPDATE ON batch_events BEGIN SELECT RAISE(ABORT, 'gönderim defteri yalnız eklenir'); END;
  CREATE TRIGGER IF NOT EXISTS batch_events_no_delete BEFORE DELETE ON batch_events BEGIN SELECT RAISE(ABORT, 'gönderim defteri yalnız eklenir'); END;
  CREATE TRIGGER IF NOT EXISTS batch_log_no_update BEFORE UPDATE ON batch_log BEGIN SELECT RAISE(ABORT, 'gönderim defteri yalnız eklenir'); END;
  CREATE TRIGGER IF NOT EXISTS batch_log_no_delete BEFORE DELETE ON batch_log BEGIN SELECT RAISE(ABORT, 'gönderim defteri yalnız eklenir'); END;
  CREATE TRIGGER IF NOT EXISTS claims_no_update BEFORE UPDATE ON claims BEGIN SELECT RAISE(ABORT, 'gönderim defteri yalnız eklenir'); END;
  CREATE TRIGGER IF NOT EXISTS claims_no_delete BEFORE DELETE ON claims BEGIN SELECT RAISE(ABORT, 'gönderim defteri yalnız eklenir'); END;
  CREATE TRIGGER IF NOT EXISTS outcomes_no_update BEFORE UPDATE ON outcomes BEGIN SELECT RAISE(ABORT, 'gönderim defteri yalnız eklenir'); END;
  CREATE TRIGGER IF NOT EXISTS outcomes_no_delete BEFORE DELETE ON outcomes BEGIN SELECT RAISE(ABORT, 'gönderim defteri yalnız eklenir'); END;
  CREATE TRIGGER IF NOT EXISTS failures_no_update BEFORE UPDATE ON failures BEGIN SELECT RAISE(ABORT, 'gönderim defteri yalnız eklenir'); END;
  CREATE TRIGGER IF NOT EXISTS failures_no_delete BEFORE DELETE ON failures BEGIN SELECT RAISE(ABORT, 'gönderim defteri yalnız eklenir'); END;
  CREATE TRIGGER IF NOT EXISTS releases_no_update BEFORE UPDATE ON releases BEGIN SELECT RAISE(ABORT, 'gönderim defteri yalnız eklenir'); END;
  CREATE TRIGGER IF NOT EXISTS releases_no_delete BEFORE DELETE ON releases BEGIN SELECT RAISE(ABORT, 'gönderim defteri yalnız eklenir'); END;
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
    liveOf: db.prepare(`SELECT o.batch_id AS batchId FROM batch_events o WHERE o.company_id = ? AND o.event = 'open' AND (NOT EXISTS (SELECT 1 FROM batch_events s WHERE s.batch_id = o.batch_id AND s.event = 'stop')
      OR (SELECT l.event FROM batch_log l WHERE l.batch_id = o.batch_id ORDER BY l.seq DESC LIMIT 1) = 'reopen')`),
    liveCompanies: db.prepare(`SELECT DISTINCT o.company_id AS companyId FROM batch_events o WHERE o.event = 'open' AND (NOT EXISTS (SELECT 1 FROM batch_events s WHERE s.batch_id = o.batch_id AND s.event = 'stop')
      OR (SELECT l.event FROM batch_log l WHERE l.batch_id = o.batch_id ORDER BY l.seq DESC LIMIT 1) = 'reopen')`),
    logLast: db.prepare("SELECT event, reason, at FROM batch_log WHERE batch_id = ? ORDER BY seq DESC LIMIT 1"),
    logAdd: db.prepare("INSERT INTO batch_log (batch_id, company_id, event, reason, at) VALUES (?, ?, ?, ?, ?)"),
    attempts: db.prepare(`SELECT c.attempt, CASE WHEN f.job_id IS NOT NULL THEN 'failed' WHEN r.job_id IS NOT NULL THEN 'released' ELSE o.outcome END AS outcome, o.wamid FROM claims c
      LEFT JOIN outcomes o ON o.job_id = c.job_id AND o.attempt = c.attempt LEFT JOIN failures f ON f.job_id = c.job_id AND f.attempt = c.attempt
      LEFT JOIN releases r ON r.job_id = c.job_id AND r.attempt = c.attempt WHERE c.job_id = ? ORDER BY c.attempt`),
    claim: db.prepare("INSERT INTO claims (job_id, attempt, batch_id, company_id, waba_id, phone, account_id, kind, period_key, at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)"),
    outcome: db.prepare("INSERT OR IGNORE INTO outcomes (job_id, attempt, outcome, wamid, at) VALUES (?, ?, ?, ?, ?)"),
    accept: db.prepare("INSERT OR IGNORE INTO accepts (job_id, company_id, waba_id, at) VALUES (?, ?, ?, ?)"),
    failure: db.prepare("INSERT OR IGNORE INTO failures (job_id, attempt, at) VALUES (?, ?, ?)"),
    release: db.prepare("INSERT OR IGNORE INTO releases (job_id, attempt, at) VALUES (?, ?, ?)"),
    deliver: db.prepare("INSERT OR IGNORE INTO deliveries (job_id, company_id, waba_id, billable, at) VALUES (?, ?, ?, ?, ?)"),
    window: db.prepare(`SELECT c.phone, MIN(c.at) AS first FROM claims c LEFT JOIN outcomes o ON o.job_id = c.job_id AND o.attempt = c.attempt
      WHERE c.waba_id = ? AND c.at > ? AND (o.outcome IS NULL OR o.outcome <> 'failed')
      AND NOT EXISTS (SELECT 1 FROM failures f WHERE f.job_id = c.job_id AND f.attempt = c.attempt) GROUP BY c.phone`),
    // R3 (plan §7a revizyonu): bu cariye bu şablon + dönem Meta'ya KABUL ETTİRİLMİŞ mi (Meta Kabul Etti ve sonrası; sonradan teslim edilemedi diye düşen hariç —
    // Başarısız ve Süresi Doldu, kullanıcı kararı P3 = SAYILMAZ; teslim edilmişse — geç "delivered" dahil — sayılır).
    // Kabul her zaman işin son denemesindedir (kabulden / belirsizden sonra yeni deneme yok).
    // "after" (asıl işin "Yine de Gönder" sınırı, yerel saatle açılış anı) TALEP anıyla (claims.at, yerel saat, istekten hemen önce) karşılaştırılır, kabul anıyla
    // DEĞİL: geç kabulde accepts.at Meta'nın durum bildirimi saatinden gelir; Meta saati yerelden gerideyse asıl işten SONRA giden ileti "önce" sayılıp çift ekstre
    // gidiyordu (2.4.8 dar kontrol 6, test/whatsapp-dk6-saat-kaymasi-248.test.mjs).
    sentBefore: db.prepare(`SELECT c.account_id AS accountId, MAX(a.at) AS last FROM accepts a
      JOIN claims c ON c.job_id = a.job_id AND c.attempt = (SELECT MAX(c2.attempt) FROM claims c2 WHERE c2.job_id = a.job_id)
      WHERE c.company_id = ? AND c.kind = ? AND c.period_key = ? AND a.at >= ? AND c.at > ?
        AND (NOT EXISTS (SELECT 1 FROM failures f WHERE f.job_id = c.job_id AND f.attempt = c.attempt) OR EXISTS (SELECT 1 FROM deliveries d WHERE d.job_id = c.job_id))
      GROUP BY c.account_id`),
    // KULLANICI KARARI (31.10.2026 ~08:00 UTC "A"; dar kontrol 6 kapsam dışı gözlem): yalnız "Başarısızları Yeniden Dene"de — bu cariye bu şablon + dönem için SONUCU
    // BELLİ OLMAYAN deneme (işin son denemesi: kabul, teslim edilemedi, 131049 bırakıldı ya da "gitmedi" sonucu yok — Sonucu Belirsiz ya da sonucu yazılamamış) varsa
    // elenir. Kabul edilen R3'e (sentBefore), teslim edilemeyen ve gitmeyen yeniden denemeye kalır. Pencere ve dönem anahtarı R3 ile aynı (donem.mjs).
    unsettled: db.prepare(`SELECT DISTINCT c.account_id AS accountId FROM claims c
      WHERE c.company_id = ? AND c.kind = ? AND c.period_key = ? AND c.at >= ? AND c.attempt = (SELECT MAX(c2.attempt) FROM claims c2 WHERE c2.job_id = c.job_id)
        AND NOT EXISTS (SELECT 1 FROM accepts a WHERE a.job_id = c.job_id)
        AND NOT EXISTS (SELECT 1 FROM failures f WHERE f.job_id = c.job_id AND f.attempt = c.attempt)
        AND NOT EXISTS (SELECT 1 FROM releases r WHERE r.job_id = c.job_id AND r.attempt = c.attempt)
        AND NOT EXISTS (SELECT 1 FROM outcomes o WHERE o.job_id = c.job_id AND o.attempt = c.attempt AND o.outcome IN ('accepted', 'failed', 'released'))`),
    hold: db.prepare("INSERT INTO holds (waba_id, until, reason, at) VALUES (?, ?, ?, ?)"),
    holdOf: db.prepare("SELECT MAX(until) AS until FROM holds WHERE waba_id = ? AND until > ?"),
    accepted: db.prepare("SELECT COUNT(*) AS n FROM accepts WHERE company_id = ? AND at >= ? AND at < ?"),
    acceptedWaba: db.prepare("SELECT COUNT(*) AS n FROM accepts WHERE waba_id = ? AND at >= ? AND at < ?"),
    delivered: db.prepare("SELECT COUNT(*) AS n, COALESCE(SUM(billable), 0) AS billable FROM deliveries WHERE company_id = ? AND at >= ? AND at < ?"),
    deliveredWaba: db.prepare("SELECT COUNT(*) AS n, COALESCE(SUM(billable), 0) AS billable FROM deliveries WHERE waba_id = ? AND at >= ? AND at < ?"),
    // T2-3/4
    hookEvent: db.prepare("INSERT INTO hook_events (waba_id, path_hash, verify_hash, base, state, reason, error, at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)"),
    hookLast: db.prepare("SELECT * FROM hook_events WHERE waba_id = ? ORDER BY seq DESC LIMIT 1"),
    hookFirstOf: db.prepare("SELECT MIN(at) AS at FROM hook_events WHERE waba_id = ? AND path_hash = ?"),
    hookActiveOf: db.prepare("SELECT MAX(at) AS at FROM hook_events WHERE waba_id = ? AND path_hash = ? AND state = 'active'"),
    hookByPath: db.prepare("SELECT DISTINCT waba_id AS wabaId FROM hook_events WHERE path_hash = ?"),
    hookSeen: db.prepare("INSERT OR IGNORE INTO hook_seen (waba_id, hour, at) VALUES (?, ?, ?)"),
    hookSeenAt: db.prepare("SELECT MAX(at) AS at FROM hook_seen WHERE waba_id = ?"),
    companyOfWamid: db.prepare(`SELECT c.company_id AS companyId, c.waba_id AS wabaId FROM outcomes o JOIN claims c ON c.job_id = o.job_id AND c.attempt = o.attempt WHERE o.wamid = ?1
      UNION ALL SELECT c.company_id, c.waba_id FROM learned_wamids l JOIN claims c ON c.job_id = l.job_id AND c.attempt = l.attempt WHERE l.wamid = ?1 LIMIT 1`),
    companyOfJob: db.prepare("SELECT company_id AS companyId, waba_id AS wabaId FROM claims WHERE job_id = ? LIMIT 1"),
    attemptOfWamid: db.prepare(`SELECT job_id AS jobId, attempt FROM outcomes WHERE wamid = ?1 AND wamid <> ''
      UNION ALL SELECT job_id, attempt FROM learned_wamids WHERE wamid = ?1 AND wamid <> '' LIMIT 1`),
    learnWamid: db.prepare("INSERT OR IGNORE INTO learned_wamids (job_id, attempt, wamid, at) VALUES (?, ?, ?, ?)"),
  };
  const hookView = row => {
    if (!row) return null;
    return {
      wabaId: row.waba_id,
      pathHash: row.path_hash,
      verifyHash: row.verify_hash,
      base: row.base,
      state: row.state,
      reason: row.reason,
      error: row.error,
      at: row.at,
      requestedAt: q.hookFirstOf.get(row.waba_id, row.path_hash)?.at || row.at,
      registeredAt: q.hookActiveOf.get(row.waba_id, row.path_hash)?.at || null,
    };
  };
  return {
    file,
    id,
    // ---------- Toplu işler ----------
    openBatch(batchId, companyId, at) {
      guard("open", { batchId });
      q.open.run(String(batchId), String(companyId), String(at));
    },
    /** Toplu işi durdurur (bitti, iptal, geri yükleme, sıfırlama, taşınma). Zaten durmuşsa yazılmaz (ilk neden kalır); yeniden açılmışsa (131049) yeni durdurma günlüğe. */
    stopBatch(batchId, companyId, reason, at) {
      try {
        const state = this.batchState(batchId);
        if (state.opened && !state.live) return true;
        guard("stop", { batchId });
        if (state.reopened) q.logAdd.run(String(batchId), String(companyId), "stop", String(reason || ""), String(at));
        else q.stop.run(String(batchId), String(companyId), String(reason || ""), String(at));
        return true;
      } catch (error) {
        log.warn?.(`WhatsApp gönderim defteri: toplu iş ${batchId} durduruldu olarak yazılamadı (${error.message}).`);
        return false;
      }
    },
    /**
     * T2 dar kontrol ORTA-1: durmuş toplu işi yeniden açar (yalnız "done" — bütün işleri kabul edilmişken bir işine kancayla 131049 geldi; plan §7a 14). Başka nedenle
     * (iptal, geri yükleme, sıfırlama, taşınma) durmuş toplu iş açılmaz. Dönüş: açıldı mı (yazılamazsa false + günlük).
     */
    reopenBatch(batchId, companyId, at) {
      try {
        const state = this.batchState(batchId);
        // Dar kontrol 2 DÜŞÜK-1: zaten yeniden açık (önceki bildirimde açıldı, şirket dosyasına yazım düştü / telafi yazılamadı) → idempotent: açık sayılır.
        if (state.live && state.reopened) return true;
        if (!state.stopped || state.reason !== "done") return false;
        guard("reopen", { batchId });
        q.logAdd.run(String(batchId), String(companyId), "reopen", "", String(at));
        return true;
      } catch (error) {
        log.warn?.(`WhatsApp gönderim defteri: toplu iş ${batchId} yeniden açılamadı (${error.message}).`);
        return false;
      }
    },
    /** { live, opened, stopped, reason, reopened } — işçi yalnız live işleri yürütür. Günlükteki son olay ilk açılış / durdurmanın önüne geçer. */
    batchState(batchId) {
      const events = q.events.all(String(batchId));
      const open = events.find(item => item.event === "open");
      const stop = events.find(item => item.event === "stop");
      const last = stop ? q.logLast.get(String(batchId)) : null;
      if (last) return { live: Boolean(open) && last.event === "reopen", opened: Boolean(open), stopped: last.event === "stop", reason: last.event === "stop" ? last.reason : "", reopened: true };
      return { live: Boolean(open && !stop), opened: Boolean(open), stopped: Boolean(stop), reason: stop?.reason || "", reopened: false };
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
      // "failed" (gitmedi / teslim edilemedi) ve "released" (131049: Meta 24 saat sonra yeniden denenmesini istedi) yeni denemeyi engellemez.
      const open = item => item.outcome !== "failed" && item.outcome !== "released";
      const blocking = previous.find(open);
      if (blocking) return { ok: false, previous: blocking };
      guard("claim", row);
      db.exec("BEGIN IMMEDIATE");
      try {
        const again = q.attempts.all(String(row.jobId)).find(open);
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
        if (row.wamid && Number(row.attempt) > 0) q.learnWamid.run(String(row.jobId), Number(row.attempt), String(row.wamid), String(row.at));
        return true;
      } catch (error) {
        log.warn?.(`WhatsApp gönderim defteri: ${row.jobId} kabulü yazılamadı (${error.message}).`);
        return false;
      }
    },
    /**
     * Dar kontrol 2 ORTA-A: Sonucu Belirsiz denemenin wamid'i durum kancasından öğrenildi — (job_id, attempt, wamid) yalnız eklenir (ilk yazılan kalır). Şirket dosyasına
     * yazımdan ÖNCE çağrılır: dosya yazımı düşse de sonraki (yinelenen) bildirim doğru denemeye bağlanır. Hata fırlatmaz.
     */
    learnWamid(row) {
      try {
        if (!row.wamid || !(Number(row.attempt) > 0)) return false;
        guard("learn", row);
        q.learnWamid.run(String(row.jobId), Number(row.attempt), String(row.wamid), String(row.at));
        return true;
      } catch (error) {
        log.warn?.(`WhatsApp gönderim defteri: ${row.jobId} ileti kimliği yazılamadı (${error.message}).`);
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
    /** T1 B2: kabul edilmiş deneme 131049 ile döndü — iş 24 saat sonra BİR kez yeniden denenebilir; 24 saat sayacında kalır. Hata fırlatmaz. */
    released(row) {
      try {
        guard("release", row);
        q.release.run(String(row.jobId), Number(row.attempt), String(row.at));
        return true;
      } catch (error) {
        log.warn?.(`WhatsApp gönderim defteri: ${row.jobId} yeniden deneme izni yazılamadı (${error.message}).`);
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
    /**
     * R3: { companyId, kind, periodKey } → Map(cari kimliği → son kabul anı ISO). Geri yükleme bu bilgiyi silmez (makine defteri).
     * since: bu andan (dahil) sonraki kabuller ("Son 3 Ay" / "Tüm Hareketler" 7 gün penceresi). after: bu andan KESİNLİKLE sonraki kabuller — yeniden denemede asıl
     * işin "Yine de Gönder" kararı (açılış anı; açılıştan önceki kabuller o kararla kabul edilmişti; dar kontrol 5 ORTA-1, KULLANICI KARARI 31.10.2026 "a şıkkı").
     */
    sentBefore({ companyId, kind, periodKey, since = "", after = "" }) {
      return new Map(q.sentBefore.all(String(companyId), String(kind), String(periodKey), String(since || ""), String(after || "")).map(row => [row.accountId, row.last]));
    },
    /** Sonucu belli olmayan son denemesi olan cariler (yalnız "Başarısızları Yeniden Dene" eler; yukarıdaki unsettled). Dönüş: Set(accountId). */
    unsettledBefore({ companyId, kind, periodKey, since = "" }) {
      return new Set(q.unsettled.all(String(companyId), String(kind), String(periodKey), String(since || "")).map(row => row.accountId));
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
    // ---------- T2-3/4: durum bildirimi adresi (WABA başına) ve bildirimin şirketi ----------
    /** WABA'nın geçerli kanca kaydı (son olay) ya da null. */
    hookOf: wabaId => hookView(q.hookLast.get(String(wabaId))),
    /** Gizli yolun karması GEÇERLİ kayda aitse o kayıt (yenilenmiş / eski yol → null). */
    hookByPath(pathHash) {
      for (const row of q.hookByPath.all(String(pathHash))) {
        const current = hookView(q.hookLast.get(row.wabaId));
        if (current?.pathHash === String(pathHash)) return current;
      }
      return null;
    },
    /** Kanca kaydı olayı (yazılamazsa hata fırlatır — çağıran Meta'ya kayıt isteğini GÖNDERMEZ). */
    hookEvent(row) {
      guard("hook", row);
      q.hookEvent.run(String(row.wabaId), String(row.pathHash), String(row.verifyHash || ""), String(row.base || ""), String(row.state), String(row.reason || ""), String(row.error || "").slice(0, 500), String(row.at));
      return this.hookOf(row.wabaId);
    },
    /** Bu WABA'nın kancasına bildirim geldi (saat başına bir satır). Hata fırlatmaz. */
    hookSeen(wabaId, at) {
      try {
        guard("hookSeen", { wabaId });
        q.hookSeen.run(String(wabaId), String(at).slice(0, 13), String(at));
        return true;
      } catch (error) {
        log.warn?.(`WhatsApp gönderim defteri: kanca bildirimi işareti yazılamadı (${error.message}).`);
        return false;
      }
    },
    hookSeenAt: wabaId => q.hookSeenAt.get(String(wabaId))?.at || null,
    /** Durum bildiriminin şirketi: wamid'in (kabul edilmiş deneme) ya da iş kimliğinin (sonucu belirsiz deneme) talebini yazan şirket. */
    companyOfWamid: wamid => (wamid ? q.companyOfWamid.get(String(wamid)) || null : null),
    companyOfJob: jobId => (jobId ? q.companyOfJob.get(String(jobId)) || null : null),
    /**
     * T2 dar kontrol ORTA-2 / dar kontrol 2 ORTA-A: wamid'in ait olduğu deneme (Meta'nın kabul ettiği deneme; wamid her denemede yenidir) — eşzamanlı kabulden
     * (outcomes) ya da sonradan öğrenilenden (learned_wamids). Bildirim yalnız o denemeye yazılır.
     */
    attemptOfWamid: wamid => (wamid ? q.attemptOfWamid.get(String(wamid)) || null : null),
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
