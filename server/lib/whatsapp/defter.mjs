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
import { openDatabase, probeWritableDb } from "../db.mjs";

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
  -- KULLANICI KARARI (31.10.2026 ~11:10 UTC "b"; ★ soru 4; lib/whatsapp/donem.mjs periodKeysOf): talebin EK dönem anahtarları — özel aralık o günün "Bu Ay" / "Geçen Ay"
  -- tarihlerine birebir eşitse "ay|YYYY-AA". R3 ve Sonucu Belirsiz elemesi claims.period_key YA DA bu anahtarlardan biri isteğin kümesindeyse eşleşir. Yalnız eklenir.
  CREATE TABLE IF NOT EXISTS claim_keys (job_id TEXT NOT NULL, attempt INTEGER NOT NULL, period_key TEXT NOT NULL, PRIMARY KEY (job_id, attempt, period_key)) STRICT;
  CREATE INDEX IF NOT EXISTS idx_claim_keys_key ON claim_keys(period_key);
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
  -- 2.4.8 İş Q2: işteki "Yine de Gönder"in açtığı iş (job_id) → kaynağı olan Sonucu Belirsiz iş (source_job_id). Kabul / teslim edilen iş zincirinin kaynakları
  -- "Sonucu Belirsiz" elemesi yapmaz (unsettled).
  CREATE TABLE IF NOT EXISTS anyway_links (job_id TEXT PRIMARY KEY, source_job_id TEXT NOT NULL, at TEXT NOT NULL) STRICT;
  CREATE TABLE IF NOT EXISTS learned_wamids (job_id TEXT NOT NULL, attempt INTEGER NOT NULL, wamid TEXT NOT NULL, at TEXT NOT NULL, PRIMARY KEY (job_id, attempt)) STRICT;
  CREATE INDEX IF NOT EXISTS idx_learned_wamids_wamid ON learned_wamids(wamid);
  CREATE TRIGGER IF NOT EXISTS learned_wamids_no_update BEFORE UPDATE ON learned_wamids BEGIN SELECT RAISE(ABORT, 'gönderim defteri yalnız eklenir'); END;
  CREATE TRIGGER IF NOT EXISTS learned_wamids_no_delete BEFORE DELETE ON learned_wamids BEGIN SELECT RAISE(ABORT, 'gönderim defteri yalnız eklenir'); END;
  CREATE TRIGGER IF NOT EXISTS hook_events_no_update BEFORE UPDATE ON hook_events BEGIN SELECT RAISE(ABORT, 'gönderim defteri yalnız eklenir'); END;
  CREATE TRIGGER IF NOT EXISTS hook_events_no_delete BEFORE DELETE ON hook_events BEGIN SELECT RAISE(ABORT, 'gönderim defteri yalnız eklenir'); END;
  CREATE TRIGGER IF NOT EXISTS hook_seen_no_update BEFORE UPDATE ON hook_seen BEGIN SELECT RAISE(ABORT, 'gönderim defteri yalnız eklenir'); END;
  CREATE TRIGGER IF NOT EXISTS hook_seen_no_delete BEFORE DELETE ON hook_seen BEGIN SELECT RAISE(ABORT, 'gönderim defteri yalnız eklenir'); END;
  CREATE INDEX IF NOT EXISTS idx_deliveries_company ON deliveries(company_id, at);
  -- 2.4.8 İş U5 (dar kontrol 15 b7; §7a 19 "Bu Ay" = TESLİM EDİLEN ileti, Meta her teslimi ücretlendirir): deneme başına teslim. deliveries iş başına kalır (R3 / unsettled
  -- "kişi aldı mı"); Bu Ay bu tablodan + bu tabloda satırı OLMAYAN eski deliveries satırlarından sayılır (göç yok: tablo açılışta eklenir, eski satırlar dönüştürülmez).
  CREATE TABLE IF NOT EXISTS attempt_deliveries (job_id TEXT NOT NULL, attempt INTEGER NOT NULL, company_id TEXT NOT NULL, waba_id TEXT NOT NULL, billable INTEGER NOT NULL DEFAULT 1, at TEXT NOT NULL, PRIMARY KEY (job_id, attempt)) STRICT;
  CREATE INDEX IF NOT EXISTS idx_attempt_deliveries_company ON attempt_deliveries(company_id, at);
  CREATE INDEX IF NOT EXISTS idx_attempt_deliveries_waba ON attempt_deliveries(waba_id, at);
  CREATE TRIGGER IF NOT EXISTS attempt_deliveries_no_update BEFORE UPDATE ON attempt_deliveries BEGIN SELECT RAISE(ABORT, 'gönderim defteri yalnız eklenir'); END;
  CREATE TRIGGER IF NOT EXISTS attempt_deliveries_no_delete BEFORE DELETE ON attempt_deliveries BEGIN SELECT RAISE(ABORT, 'gönderim defteri yalnız eklenir'); END;
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
  CREATE TRIGGER IF NOT EXISTS claim_keys_no_update BEFORE UPDATE ON claim_keys BEGIN SELECT RAISE(ABORT, 'gönderim defteri yalnız eklenir'); END;
  CREATE TRIGGER IF NOT EXISTS claim_keys_no_delete BEFORE DELETE ON claim_keys BEGIN SELECT RAISE(ABORT, 'gönderim defteri yalnız eklenir'); END;
  CREATE TRIGGER IF NOT EXISTS releases_no_delete BEFORE DELETE ON releases BEGIN SELECT RAISE(ABORT, 'gönderim defteri yalnız eklenir'); END;
  CREATE TRIGGER IF NOT EXISTS accepts_no_update BEFORE UPDATE ON accepts BEGIN SELECT RAISE(ABORT, 'gönderim defteri yalnız eklenir'); END;
  CREATE TRIGGER IF NOT EXISTS accepts_no_delete BEFORE DELETE ON accepts BEGIN SELECT RAISE(ABORT, 'gönderim defteri yalnız eklenir'); END;
  CREATE TRIGGER IF NOT EXISTS anyway_links_no_update BEFORE UPDATE ON anyway_links BEGIN SELECT RAISE(ABORT, 'gönderim defteri yalnız eklenir'); END;
  CREATE TRIGGER IF NOT EXISTS anyway_links_no_delete BEFORE DELETE ON anyway_links BEGIN SELECT RAISE(ABORT, 'gönderim defteri yalnız eklenir'); END;
  CREATE TRIGGER IF NOT EXISTS deliveries_no_update BEFORE UPDATE ON deliveries BEGIN SELECT RAISE(ABORT, 'gönderim defteri yalnız eklenir'); END;
  CREATE TRIGGER IF NOT EXISTS deliveries_no_delete BEFORE DELETE ON deliveries BEGIN SELECT RAISE(ABORT, 'gönderim defteri yalnız eklenir'); END;
`;
// R3 sorgusu (aşağıdaki q.sentBefore açıklaması). outer / tail: gruplanmış (cari → son an) ya da İş Q1'in satır satır biçimi (eşleşen anahtarlarla).
const SENT_BEFORE_SQL = (outer, tail) => `${outer} FROM (SELECT c.account_id AS accountId, c.batch_id AS batch_id, c.job_id AS job_id, c.attempt AS attempt, c.period_key AS period_key, c.at AS claim_at,
        (SELECT group_concat(k2.period_key, char(31)) FROM claim_keys k2 WHERE k2.job_id = c.job_id AND k2.attempt = c.attempt) AS extra_keys,
        COALESCE((SELECT o.at FROM outcomes o WHERE o.job_id = c.job_id AND o.attempt = c.attempt AND o.outcome = 'accepted'),
          (SELECT l.at FROM learned_wamids l WHERE l.job_id = c.job_id AND l.attempt = c.attempt), a.at) AS at
      FROM accepts a JOIN claims c ON c.job_id = a.job_id AND c.attempt = (SELECT MAX(c2.attempt) FROM claims c2 WHERE c2.job_id = a.job_id)
      WHERE c.company_id = ? AND c.kind = ? AND (c.period_key IN (SELECT value FROM json_each(?)) OR EXISTS (SELECT 1 FROM claim_keys k WHERE k.job_id = c.job_id AND k.attempt = c.attempt AND k.period_key IN (SELECT value FROM json_each(?))))) c
      WHERE c.at >= ? AND c.claim_at > ?
        AND (c.period_key NOT IN ('secim|last3', 'secim|all') OR c.at >= ?)
        AND ((NOT EXISTS (SELECT 1 FROM failures f WHERE f.job_id = c.job_id AND f.attempt = c.attempt)
              AND NOT EXISTS (SELECT 1 FROM outcomes o WHERE o.job_id = c.job_id AND o.attempt = c.attempt AND o.outcome = 'failed')
              AND (EXISTS (SELECT 1 FROM outcomes o WHERE o.job_id = c.job_id AND o.attempt = c.attempt AND o.outcome = 'accepted')
                OR EXISTS (SELECT 1 FROM learned_wamids l WHERE l.job_id = c.job_id AND l.attempt = c.attempt))
              AND NOT (EXISTS (SELECT 1 FROM releases r WHERE r.job_id = c.job_id AND r.attempt = c.attempt)
                AND COALESCE((SELECT l.event || ':' || l.reason FROM batch_log l WHERE l.batch_id = c.batch_id ORDER BY l.seq DESC LIMIT 1),
                  (SELECT 'stop:' || s.reason FROM batch_events s WHERE s.batch_id = c.batch_id AND s.event = 'stop'), '') IN ('stop:canceled', 'stop:restored', 'stop:moved', 'stop:reset')))
          OR EXISTS (SELECT 1 FROM deliveries d WHERE d.job_id = c.job_id))
      ${tail}`;
// "Sonucu Belirsiz" sorgusu (aşağıdaki q.unsettled açıklaması). extra: İş Q1'in eşleşen anahtar sütunları.
const UNSETTLED_SQL = extra => `WITH RECURSIVE settled_up(job) AS (
        SELECT al.source_job_id FROM anyway_links al WHERE EXISTS (SELECT 1 FROM deliveries d WHERE d.job_id = al.job_id)
          OR EXISTS (SELECT 1 FROM claims c3 WHERE c3.job_id = al.job_id AND c3.attempt = (SELECT MAX(c4.attempt) FROM claims c4 WHERE c4.job_id = al.job_id)
            AND (EXISTS (SELECT 1 FROM outcomes o WHERE o.job_id = c3.job_id AND o.attempt = c3.attempt AND o.outcome = 'accepted')
              OR EXISTS (SELECT 1 FROM learned_wamids l WHERE l.job_id = c3.job_id AND l.attempt = c3.attempt))
            AND NOT EXISTS (SELECT 1 FROM failures f WHERE f.job_id = c3.job_id AND f.attempt = c3.attempt)
            AND NOT EXISTS (SELECT 1 FROM releases r WHERE r.job_id = c3.job_id AND r.attempt = c3.attempt))
        UNION SELECT al.source_job_id FROM anyway_links al JOIN settled_up s ON al.job_id = s.job)
      SELECT DISTINCT c.account_id AS accountId, c.job_id AS jobId${extra} FROM claims c
      WHERE c.job_id NOT IN (SELECT job FROM settled_up) AND c.company_id = ? AND c.kind = ? AND (c.period_key IN (SELECT value FROM json_each(?)) OR EXISTS (SELECT 1 FROM claim_keys k WHERE k.job_id = c.job_id AND k.attempt = c.attempt AND k.period_key IN (SELECT value FROM json_each(?)))) AND c.at >= ? AND c.attempt = (SELECT MAX(c2.attempt) FROM claims c2 WHERE c2.job_id = c.job_id)
        AND (c.period_key NOT IN ('secim|last3', 'secim|all') OR c.at >= ?)
        AND NOT EXISTS (SELECT 1 FROM learned_wamids l WHERE l.job_id = c.job_id AND l.attempt = c.attempt)
        AND NOT EXISTS (SELECT 1 FROM deliveries d WHERE d.job_id = c.job_id)
        AND NOT EXISTS (SELECT 1 FROM failures f WHERE f.job_id = c.job_id AND f.attempt = c.attempt)
        AND NOT EXISTS (SELECT 1 FROM releases r WHERE r.job_id = c.job_id AND r.attempt = c.attempt)
        AND NOT EXISTS (SELECT 1 FROM outcomes o WHERE o.job_id = c.job_id AND o.attempt = c.attempt AND o.outcome IN ('accepted', 'failed', 'released'))`;
// İş Q1: kişiye ait anahtarların birleşimi (JSON; yoksa null) ve eşleşen talebin anahtarlarından biri o cariye ait mi.
const ownKeysJson = accountKeys => {
  if (!accountKeys?.size) return null;
  const all = new Set();
  for (const list of accountKeys.values()) for (const key of list || []) all.add(String(key));
  return all.size ? JSON.stringify([...all]) : null;
};
const keyedMatch = (accountKeys, row) => {
  const mine = accountKeys.get(row.accountId);
  if (!mine?.length) return false;
  const theirs = [row.ownKey, ...String(row.extraKeys || "").split("\u001f")].filter(Boolean);
  return mine.some(key => theirs.includes(key));
};
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
    attempts: db.prepare(`SELECT c.attempt, CASE WHEN f.job_id IS NOT NULL THEN 'failed' WHEN r.job_id IS NOT NULL THEN 'released' ELSE o.outcome END AS outcome, o.wamid, o.at FROM claims c
      LEFT JOIN outcomes o ON o.job_id = c.job_id AND o.attempt = c.attempt LEFT JOIN failures f ON f.job_id = c.job_id AND f.attempt = c.attempt
      LEFT JOIN releases r ON r.job_id = c.job_id AND r.attempt = c.attempt WHERE c.job_id = ? ORDER BY c.attempt`),
    claim: db.prepare("INSERT INTO claims (job_id, attempt, batch_id, company_id, waba_id, phone, account_id, kind, period_key, at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)"),
    claimKey: db.prepare("INSERT OR IGNORE INTO claim_keys (job_id, attempt, period_key) VALUES (?, ?, ?)"),
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
    // Kabul satırı (accepts, iş başına tek) işin İLK kabul edilen denemesinden kalır; sonuç ise işin SON denemesinden okunur: 131049 (Meta Bekletti) kabul edilmiş
    // denemeyi bırakır ve iş 24 saat sonra bir kez daha denenir. O son deneme Meta'ca eşzamanlı reddedildiyse (outcomes 'failed') ya da kabul edilip teslim
    // edilemediyse (failures) ve hiç teslim (deliveries) yoksa kişi SAYILMAZ (P3; 2.4.8 dar kontrol 7 ORTA-1, test/whatsapp-dk7-bekletti-ikinci-deneme-248.test.mjs).
    // KULLANICI KARARI (31.10.2026 ~10:10 UTC "a"): son deneme 131049 ile bırakılmış (releases; teslim edilmedi) ve toplu işin defterdeki SON durumu "İptal Et" ise
    // (batch_events durdurma nedeni ya da — 131049 "Tamamlandı" işi yeniden açtıysa — batch_log'un son satırı 'stop:canceled'; bir daha denenmeyecek) kişi SAYILMAZ;
    // iş Meta Bekletti'de beklerken sayılır (yeni gönderimi ayrıca "Zaten Kuyrukta" eler). Geç "delivered" / "read" gelirse (deliveries) sayılır. Test:
    // test/whatsapp-dk7-bekletti-iptal-248.test.mjs.
    // KULLANICI KARARI (31.10.2026 ~11:00 UTC "A"): yedekten GERİ YÜKLEME ('stop:restored') ya da TAŞIMA ('stop:moved') ile durmuş Meta Bekletti de (bir daha
    // denenmeyecek) aynı kuralla SAYILMAZ; geç teslim sayılır. Başka bilgisayara taşınan veride yeni bilgisayarın defterinde o işin talebi (claims) yoktur, kişi zaten
    // sayılmaz; 'stop:moved' bu defterde açılmış bir toplu işe ancak veri başka şirkete geri yüklenince yazılır. KULLANICI KARARI ("KİME KAÇ KEZ" ilkesi, S3): Şirket
    // Verisini Sıfırla ('stop:reset'; "Yalnız Hareketler" carileri bırakır) ile duran da sayılmaz. Testler: test/whatsapp-dk8-bekletti-geri-yukleme-248.test.mjs,
    // test/whatsapp-dk9-ilke-248.test.mjs.
    // KULLANICI KARARI ("KİME KAÇ KEZ" ilkesi, S4): kabul SON DENEME bazında — son deneme Meta'ca kabul edilmiş (eşzamanlı ya da sonradan öğrenilen wamid) olmalı; Meta
    // Bekletti'den sonra 2. deneme Sonucu Belirsiz / sonuçsuzsa 1. denemenin kabulü kişiyi "aldı" saymaz (almış olabilir → unsettled; işteki Yine de Gönder çıkmazsız).
    // "after" (asıl işin "Yine de Gönder" sınırı, yerel saatle açılış anı) TALEP anıyla (claims.at, yerel saat, istekten hemen önce) karşılaştırılır, kabul anıyla
    // DEĞİL: geç kabulde accepts.at Meta'nın durum bildirimi saatinden gelir; Meta saati yerelden gerideyse asıl işten SONRA giden ileti "önce" sayılıp çift ekstre
    // gidiyordu (2.4.8 dar kontrol 6, test/whatsapp-dk6-saat-kaymasi-248.test.mjs).
    // İş Q5 (T1 G5-02): "son gönderim" anı ve pencereler (since, Son 3 Ay / Tüm Hareketler) SON denemenin kabul anından okunur (eşzamanlı kabul outcomes, sonradan
    // öğrenilen wamid learned_wamids; yoksa — yalnız teslimle sayılan iş — işin kabul satırı). accepts iş başına tek satırdır ve İLK kabul edilen denemeden kalır:
    // 131049 sonrası 24 saat sonraki 2. deneme kabul edilince tarih 1. denemeyi gösteriyordu. Test: test/whatsapp-q5-son-kabul-248.test.mjs.
    sentBefore: db.prepare(SENT_BEFORE_SQL("SELECT accountId, MAX(at) AS last", "GROUP BY accountId")),
    // İş Q1: kişiye özel anahtarlar ("Tüm Hareketler"in "<ilk hareket> – <dönem sonu>"u) — eşleşen talebin anahtarları da döner, kişiye ait mi JS'te süzülür.
    sentBeforeKeyed: db.prepare(SENT_BEFORE_SQL("SELECT accountId, at, period_key AS ownKey, extra_keys AS extraKeys", "")),
    // KULLANICI KARARI (31.10.2026 ~08:00 UTC "A"; dar kontrol 6 kapsam dışı gözlem): yalnız "Başarısızları Yeniden Dene"de — bu cariye bu şablon + dönem için SONUCU
    // BELLİ OLMAYAN deneme (işin son denemesi: kabul, teslim edilemedi, 131049 bırakıldı ya da "gitmedi" sonucu yok — Sonucu Belirsiz ya da sonucu yazılamamış) varsa
    // elenir. Kabul edilen R3'e (sentBefore), teslim edilemeyen ve gitmeyen yeniden denemeye kalır. Pencere ve dönem anahtarı R3 ile aynı (donem.mjs).
    // KULLANICI KARARI ("KİME KAÇ KEZ" ilkesi, S4; dar kontrol 9 DÜŞÜK-1): kabul DENEME bazında (outcomes accepted / sonradan öğrenilen wamid) — Meta Bekletti'den sonra
    // 2. deneme belirsiz kalınca 1. denemenin kabulü onu gizlemez. İşin teslimi (deliveries; geç teslim dahil) varsa kişi kesin ALDI → R3 (soru 7/K7), belirsiz sayılmaz.
    // İş Q2 (KULLANICI KARARI A): kaynağı olduğu "Yine de Gönder" işi (zincirde herhangi biri) SON denemesinde kabul edilmiş (eşzamanlı / öğrenilen wamid; sonradan
    // teslim edilemedi ya da 131049 ile bırakıldı değil) ya da teslim edilmişse kaynak belirsiz SAYILMAZ. Yine de Gönder işi Başarısız / Belirsiz / Meta Bekletti ise
    // kaynak sayılmaya devam eder.
    unsettled: db.prepare(UNSETTLED_SQL("")),
    unsettledKeyed: db.prepare(UNSETTLED_SQL(", c.period_key AS ownKey, (SELECT group_concat(k2.period_key, char(31)) FROM claim_keys k2 WHERE k2.job_id = c.job_id AND k2.attempt = c.attempt) AS extraKeys")),
    hold: db.prepare("INSERT INTO holds (waba_id, until, reason, at) VALUES (?, ?, ?, ?)"),
    holdOf: db.prepare("SELECT MAX(until) AS until FROM holds WHERE waba_id = ? AND until > ?"),
    accepted: db.prepare("SELECT COUNT(*) AS n FROM accepts WHERE company_id = ? AND at >= ? AND at < ?"),
    acceptedWaba: db.prepare("SELECT COUNT(*) AS n FROM accepts WHERE waba_id = ? AND at >= ? AND at < ?"),
    // İş U5: deneme başına teslim + deneme satırı olmayan eski (iş başına) teslimler — aynı teslim iki kez sayılmaz: deliveries satırı ile o teslimin deneme satırı
    // aynı çağrıda AYNI anla (at) yazılır; eşleşen deneme satırı olan deliveries satırı sayılmaz.
    delivered: db.prepare(`SELECT COUNT(*) AS n, COALESCE(SUM(billable), 0) AS billable FROM (
      SELECT billable FROM attempt_deliveries WHERE company_id = ?1 AND at >= ?2 AND at < ?3
      UNION ALL SELECT d.billable FROM deliveries d WHERE d.company_id = ?1 AND d.at >= ?2 AND d.at < ?3 AND NOT EXISTS (SELECT 1 FROM attempt_deliveries a WHERE a.job_id = d.job_id AND a.at = d.at))`),
    deliveredWaba: db.prepare(`SELECT COUNT(*) AS n, COALESCE(SUM(billable), 0) AS billable FROM (
      SELECT billable FROM attempt_deliveries WHERE waba_id = ?1 AND at >= ?2 AND at < ?3
      UNION ALL SELECT d.billable FROM deliveries d WHERE d.waba_id = ?1 AND d.at >= ?2 AND d.at < ?3 AND NOT EXISTS (SELECT 1 FROM attempt_deliveries a WHERE a.job_id = d.job_id AND a.at = d.at))`),
    deliverAttempt: db.prepare("INSERT OR IGNORE INTO attempt_deliveries (job_id, attempt, company_id, waba_id, billable, at) VALUES (?, ?, ?, ?, ?, ?)"),
    deliveredAttempt: db.prepare("SELECT 1 AS x FROM attempt_deliveries WHERE job_id = ? AND attempt = ?"),
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
    deliveredJob: db.prepare("SELECT 1 AS x FROM deliveries WHERE job_id = ?"),
    attemptOfWamid: db.prepare(`SELECT job_id AS jobId, attempt FROM outcomes WHERE wamid = ?1 AND wamid <> ''
      UNION ALL SELECT job_id, attempt FROM learned_wamids WHERE wamid = ?1 AND wamid <> '' LIMIT 1`),
    learnWamid: db.prepare("INSERT OR IGNORE INTO learned_wamids (job_id, attempt, wamid, at) VALUES (?, ?, ?, ?)"),
    outcomeOf: db.prepare("SELECT outcome FROM outcomes WHERE job_id = ? AND attempt = ?"),
    pendingClaim: db.prepare(`SELECT COUNT(*) AS n FROM claims c WHERE c.waba_id = ? AND c.at >= ?
      AND NOT EXISTS (SELECT 1 FROM outcomes o WHERE o.job_id = c.job_id AND o.attempt = c.attempt)
      AND NOT EXISTS (SELECT 1 FROM learned_wamids l WHERE l.job_id = c.job_id AND l.attempt = c.attempt)`),
    acceptanceAt: db.prepare(`SELECT COALESCE((SELECT o.at FROM outcomes o WHERE o.job_id = ?1 AND o.attempt = ?2 AND o.outcome = 'accepted'),
      (SELECT l.at FROM learned_wamids l WHERE l.job_id = ?1 AND l.attempt = ?2)) AS at`),
    acceptedWamid: db.prepare(`SELECT COALESCE((SELECT o.wamid FROM outcomes o WHERE o.job_id = ?1 AND o.attempt = ?2 AND o.outcome = 'accepted' AND o.wamid <> ''),
      (SELECT l.wamid FROM learned_wamids l WHERE l.job_id = ?1 AND l.attempt = ?2)) AS wamid`),
    anywayLink: db.prepare("INSERT OR IGNORE INTO anyway_links (job_id, source_job_id, at) VALUES (?, ?, ?)"),
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
    attempts: jobId => q.attempts.all(String(jobId)).map(row => ({ attempt: row.attempt, outcome: row.outcome || null, wamid: row.wamid || "", at: row.at || "" })),
    /**
     * Yeni deneme talebi. Önceki bir deneme kabul edilmiş / belirsiz / sonuçsuz ise talep YAZILMAZ: { ok: false, previous }. Yazım düşerse hata fırlatır
     * (çağıran isteği GÖNDERMEZ).
     */
    claim(row) {
      const previous = q.attempts.all(String(row.jobId)).map(item => ({ attempt: item.attempt, outcome: item.outcome || null, wamid: item.wamid || "", at: item.at || "" }));
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
          return { ok: false, previous: { attempt: again.attempt, outcome: again.outcome || null, wamid: again.wamid || "", at: again.at || "" } };
        }
        q.claim.run(String(row.jobId), Number(row.attempt), String(row.batchId), String(row.companyId), String(row.wabaId), String(row.phone), String(row.accountId || ""), String(row.kind || ""), String(row.periodKey || ""), String(row.at));
        for (const key of Array.isArray(row.periodKeys) ? row.periodKeys : []) if (key && key !== row.periodKey) q.claimKey.run(String(row.jobId), Number(row.attempt), String(key));
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
        if (row.outcome === "accepted") {
          q.accept.run(String(row.jobId), String(row.companyId), String(row.wabaId), String(row.at));
          // İş T A7 (K8): istek Meta'dayken açılış toparlaması (geri yükleme / yeniden açılış) bu denemeye "uncertain" yazdıysa sonradan gelen eşzamanlı KABUL kaybolmaz —
          // wamid o denemeye öğrenilmiş olarak bağlanır (deneme "aldı" sayılır; durum bildirimleri bu denemeye uygulanır).
          if (row.wamid && q.outcomeOf.get(String(row.jobId), Number(row.attempt))?.outcome === "uncertain") q.learnWamid.run(String(row.jobId), Number(row.attempt), String(row.wamid), String(row.at));
        }
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
    /** İş Q2: işteki "Yine de Gönder"in açtığı iş ↔ kaynağı (yalnız eklenir). Hata fırlatmaz: yazılamazsa kaynak belirsiz kalır (güvenli yön: eler). */
    anywayLink(row) {
      try {
        guard("link", row);
        q.anywayLink.run(String(row.jobId), String(row.sourceJobId), String(row.at));
        return true;
      } catch (error) {
        log.warn?.(`WhatsApp gönderim defteri: ${row.jobId} Yine de Gönder bağı yazılamadı (${error.message}).`);
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
        // İş U5: deneme başına (Bu Ay). Ayrı yazım; düşerse false → çağıran 503 (ledgerMust), yineleme tamamlar (ikisi de INSERT OR IGNORE).
        if (Number.isInteger(Number(row.attempt)) && Number(row.attempt) > 0) q.deliverAttempt.run(String(row.jobId), Number(row.attempt), String(row.companyId), String(row.wabaId), row.billable === false ? 0 : 1, String(row.at));
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
    // rolling (İş L5): kendi anahtarı "Son 3 Ay" / "Tüm Hareketler" olan gönderim yalnız bu andan sonraysa eşleşir (seçimin 7 gün penceresi; boş = sınır yok).
    // accountKeys (İş Q1): Map(cari → yalnız o cariye ait ek anahtarlar; "Tüm Hareketler"in "aralik|<ilk hareket>|<dönem sonu>"u). Ortak anahtarlarla eşleşme bugünkü gibi;
    // kişiye ait anahtarlar BİRLEŞİMLE sorgulanır, eşleşen talebin anahtarı o cariye ait değilse sayılmaz (başka carinin aynı tarihli aralığı karışmaz).
    sentBefore({ companyId, kind, periodKey = "", periodKeys = null, since = "", after = "", rolling = "", accountKeys = null }) {
      const keys = JSON.stringify((periodKeys || [periodKey]).map(String));
      const out = new Map(q.sentBefore.all(String(companyId), String(kind), keys, keys, String(since || ""), String(after || ""), String(rolling || "")).map(row => [row.accountId, row.last]));
      const own = ownKeysJson(accountKeys);
      if (own) {
        for (const row of q.sentBeforeKeyed.all(String(companyId), String(kind), own, own, String(since || ""), String(after || ""), String(rolling || ""))) {
          if (!keyedMatch(accountKeys, row)) continue;
          if (!out.has(row.accountId) || out.get(row.accountId) < row.at) out.set(row.accountId, row.at);
        }
      }
      return out;
    },
    /**
     * Sonucu belli olmayan son denemesi olan cariler (yalnız "Başarısızları Yeniden Dene" eler; yukarıdaki unsettled). Dönüş: Map(accountId → [jobId]) — iş kimlikleri
     * elenme iletisinde "Yine de Gönder"in gerçekten var olup olmadığını (iş şirket dosyasında hâlâ Sonucu Belirsiz mi) bilmek için (dar kontrol 7 DÜŞÜK-1).
     */
    unsettledBefore({ companyId, kind, periodKey = "", periodKeys = null, since = "", rolling = "", accountKeys = null }) {
      const out = new Map();
      const add = row => {
        if (!out.has(row.accountId)) out.set(row.accountId, []);
        if (!out.get(row.accountId).includes(row.jobId)) out.get(row.accountId).push(row.jobId);
      };
      const keys = JSON.stringify((periodKeys || [periodKey]).map(String));
      for (const row of q.unsettled.all(String(companyId), String(kind), keys, keys, String(since || ""), String(rolling || ""))) add(row);
      const own = ownKeysJson(accountKeys); // İş Q1 (sentBefore ile aynı)
      if (own) for (const row of q.unsettledKeyed.all(String(companyId), String(kind), own, own, String(since || ""), String(rolling || ""))) if (keyedMatch(accountKeys, row)) add(row);
      return out;
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
    /** 2.4.8 İş P1 (c2): defter dosyası şimdi yazılabilir mi — kısa senkron sınama (lib/db.mjs probeWritableDb); başka süreç kilitliyken arka plan işi ve durum kancası
     * 10 sn beklemez. Dönüş: true | false | null. */
    probeWritable: (ms = 150) => probeWritableDb(db, ms),
    /** İş Q4: işin teslimi defterde var mı (teslimden sonra gelen "failed" yok sayılır). */
    deliveredJob: jobId => Boolean(jobId && q.deliveredJob.get(String(jobId))),
    /** İş U5: bu DENEMENİN teslimi defterde var mı (aynı denemenin yinelenen teslimi etkisiz; başka denemenin teslimi ayrı sayılır). */
    deliveredAttempt: (jobId, attempt) => Boolean(jobId && q.deliveredAttempt.get(String(jobId), Number(attempt))),
    /** İş U6: denemenin outcomes satırı (failures / releases değil — yalnız eşzamanlı / toparlama sonucu); yoksa null. */
    outcomeOf: (jobId, attempt) => q.outcomeOf.get(String(jobId), Number(attempt))?.outcome || null,
    /**
     * T2 dar kontrol ORTA-2 / dar kontrol 2 ORTA-A: wamid'in ait olduğu deneme (Meta'nın kabul ettiği deneme; wamid her denemede yenidir) — eşzamanlı kabulden
     * (outcomes) ya da sonradan öğrenilenden (learned_wamids). Bildirim yalnız o denemeye yazılır.
     */
    attemptOfWamid: wamid => (wamid ? q.attemptOfWamid.get(String(wamid)) || null : null),
    /** İş T A6 (K5 istisnası): bu WABA'da `since`'ten beri talebi olup sonucu henüz yazılmamış (istek Meta'da / yanıt işlenmedi) deneme sayısı. */
    pendingClaims: (wabaId, since) => Number(q.pendingClaim.get(String(wabaId), String(since))?.n || 0),
    /** İş T K6 (R4/Q5): denemenin defterdeki kabul anı — eşzamanlı kabul (outcomes accepted), yoksa öğrenilen wamid'in anı; yoksa null. */
    acceptanceAt: (jobId, attempt) => q.acceptanceAt.get(String(jobId), Number(attempt))?.at || null,
    /** İş U4: denemenin Meta'nın kabul ettiği wamid'i (eşzamanlı kabul ya da sonradan öğrenilen); yoksa null. */
    acceptedWamid: (jobId, attempt) => q.acceptedWamid.get(String(jobId), Number(attempt))?.wamid || null,
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
