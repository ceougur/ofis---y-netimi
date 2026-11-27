// WhatsApp gönderim kayıtlarının SAKLAMA SÜRESİ ve KVKK SİLME TALEBİ — 2.5.0 W-3 (docs/erp/W3-SAKLAMA-TASARIM.md; plan docs/erp/WHATSAPP-PAKETI-2.5.0-PLANI.md §1 W-3).
// KULLANICI KARARI S-W3 (05.11.2026, "1 yıl + anonim iz"): iletinin içeriği, telefon ve PDF 1 takvim yılı sonra (son denemeden, yerel saat) ya da KVKK silme talebinde HEMEN
// silinir; tarih, dönem, cari kimliği, şablon adı, deneme sonucu ve sayaçlar anonim iz kalır (aynı kişiye aynı dönemde ikinci ileti gitmez). S32 / S38 (06.11): silme talepleri
// makinede kayıtlı kalır — YALNIZ şirket kimliği + cari kimliği + talep anı; şirket yedeğine girmez, geri yüklemeden sonra yeniden uygulanır, veri klasörüyle taşınır.
// Bu modül saf yardımcılar (süre, işaret, özet) ve talep dosyasıdır; uygulama lib/whatsapp/queue.mjs (şirket dosyası) ve lib/whatsapp/defter.mjs (makine defteri).
import { createHash } from "node:crypto";
import { mkdirSync } from "node:fs";
import path from "node:path";
import { openDatabase } from "../db.mjs";

export const ERASURE_FILE = "whatsapp-silme-talepleri.sqlite";
// Bekleyen işin "Atlandı" nedenleri (S35 + Y17-6) ve içeriği silinmiş Ekstre'nin yeniden gönderim elemesi (S31). Ad = ekranda görünen ad (Yazım düzeni).
export const SKIP_REQUEST = "Silme Talebi";
export const SKIP_RETENTION = "Saklama Süresi";
export const SKIP_ERASED = "İçeriği Silindi";
// İçeriği silinmiş işin params_json'ı: { icerikSilindi: "talep" | "sure", at } — normal içerik her zaman bir dizidir ("[" ile başlar); SQL ön süzgeci `params_json LIKE '{%'`.
export const ERASED_PREFIX = "{";
const ERASE_KINDS = new Set(["talep", "sure"]);
export const erasedMarker = (kind, at) => JSON.stringify({ icerikSilindi: ERASE_KINDS.has(kind) ? kind : "talep", at: String(at || "") });
/** İşin içeriği silinmiş mi; öyleyse { kind, at }, değilse null (bozuk / eski içerik de null). */
export function erasedOf(paramsJson) {
  const text = String(paramsJson || "");
  if (!text.startsWith(ERASED_PREFIX)) return null;
  try {
    const value = JSON.parse(text);
    return value && ERASE_KINDS.has(value.icerikSilindi) ? { kind: value.icerikSilindi, at: String(value.at || "") } : null;
  } catch {
    return null;
  }
}
// Meta'nın ileti kimliği (wamid) alıcının numarasını kodlanmış taşır (yaygın gözlem; Meta belgesinde açık yazmıyor — DOĞRULANMADI) → silinen işte SHA-256 özeti tutulur;
// geç durum bildirimi özetle eşleşir. Biçim "h:" + 64 onaltılık hane (defter tetikleri bu biçime izin verir).
export const WAMID_DIGEST_PREFIX = "h:";
export const isWamidDigest = value => typeof value === "string" && value.length === 66 && value.startsWith(WAMID_DIGEST_PREFIX);
export const wamidDigest = wamid => (isWamidDigest(wamid) ? wamid : `${WAMID_DIGEST_PREFIX}${createHash("sha256").update(String(wamid)).digest("hex")}`);
/** Gelen wamid'in olası saklanmış biçimleri (açık + özet) — arama `IN (?, ?)`. */
export const wamidForms = wamid => [String(wamid), wamidDigest(String(wamid))];
// Meta'nın hata metninde numara olabilir: 10+ haneli sayı dizileri (+ ve ayraçlarıyla; telefon numarası 10–13 hane) silinir; Meta hata kodları (en çok 7 hane) ve metnin
// geri kalanı (deneme sonucu) iz olarak kalır.
export const scrubDigits = text => String(text || "").replace(/\+?\d[\d\s().-]{8,}\d/g, match => (match.replace(/\D/g, "").length >= 10 ? "…" : match));

// ---------- Süre: 1 takvim yılı, YEREL saat (programın saat dilimi), an hassasiyeti; 29 Şubat → 28 Şubat ----------
const daysIn = (year, month) => new Date(year, month + 1, 0).getDate();
/** ms anının yerel takvimde bir yıl sonrası (ms). */
export function addYearLocal(ms) {
  const d = new Date(ms);
  const year = d.getFullYear() + 1;
  const month = d.getMonth();
  return new Date(year, month, Math.min(d.getDate(), daysIn(year, month)), d.getHours(), d.getMinutes(), d.getSeconds(), d.getMilliseconds()).getTime();
}
/** Başlangıcı `startIso` olan kaydın süresi `nowMs` anında dolmuş mu (sınır anı dahil — "sınırda ve SONRA silinir"). */
export function retentionDue(startIso, nowMs) {
  const start = Date.parse(String(startIso || ""));
  return Number.isFinite(start) && addYearLocal(start) <= nowMs;
}
// SQL ön süzgeci: takvim yılı en az 365 gündür (29 Şubat → 28 Şubat = 365; yaz saati ±1 sa) → başlangıcı şimdi − 364 günden yeni olan aday DEĞİLDİR. Aday satır retentionDue ile kesinleşir.
export const candidateBound = nowMs => new Date(nowMs - 364 * 86_400_000).toISOString();
/** Kayıt başlangıcı (S-W3 "son denemeden"): son gönderim denemesinin anı; denemesi yoksa toplu işin açılışı. */
export const retentionStartSql = alias => `COALESCE(${alias}.sending_at, ${alias}.created_at)`;

// ---------- Silme talepleri dosyası (makine düzeyi; yedek DIŞI) ----------
const SCHEMA = `
  CREATE TABLE IF NOT EXISTS requests (company_id TEXT NOT NULL, account_id TEXT NOT NULL, at TEXT NOT NULL, PRIMARY KEY (company_id, account_id)) STRICT;
`;
/**
 * Ana veri klasöründeki talep dosyası. Kayıt: şirket kimliği + cari kimliği + talep anı (ad, telefon, içerik YOK). Aynı kişinin sonraki talebi anı ilerletir (öncekini kapsar).
 * @param {{ dir: string }} options
 */
export function openErasureRequests({ dir }) {
  mkdirSync(dir, { recursive: true });
  const file = path.join(dir, ERASURE_FILE);
  const db = openDatabase(file);
  try {
    db.exec(SCHEMA);
    const q = {
      add: db.prepare("INSERT INTO requests (company_id, account_id, at) VALUES (?, ?, ?) ON CONFLICT(company_id, account_id) DO UPDATE SET at = MAX(at, excluded.at)"),
      of: db.prepare("SELECT account_id AS accountId, at FROM requests WHERE company_id = ? ORDER BY at, account_id"),
      one: db.prepare("SELECT at FROM requests WHERE company_id = ? AND account_id = ?"),
    };
    return {
      file,
      /** Talep yazılır (hata fırlatır — çağıran hiçbir şeyi silmez). Dönüş: kayıttaki an. */
      add(companyId, accountId, at) {
        q.add.run(String(companyId), String(accountId), String(at));
        return q.one.get(String(companyId), String(accountId))?.at || String(at);
      },
      /** Şirketin talepleri [{ accountId, at }]. */
      of: companyId => q.of.all(String(companyId)).map(row => ({ accountId: row.accountId, at: row.at })),
      close: () => db.close(),
    };
  } catch (error) {
    try {
      db.close();
    } catch {
      // kapatma hatası asıl hatayı ezmez (ders 21)
    }
    throw error;
  }
}

/**
 * KVKK artık denetimi: silmeden sonra serbest kalan hücreler ve taşma sayfaları sıfırlanır (secure_delete yalnız bu işlem boyunca açık; bağlantının önceki değeri geri
 * konur), sonra WAL boşaltılır (eski çerçeveler gider). fn senkron; dönüş fn'in dönüşü. Denetim noktası işlemin DIŞINDA (açık işlem varsa atlanır — sonraki çağrıda).
 */
export function withSecureDelete(db, fn) {
  const before = Number(db.prepare("PRAGMA secure_delete").get()?.secure_delete ?? 0);
  db.exec("PRAGMA secure_delete = ON");
  try {
    return fn();
  } finally {
    db.exec(`PRAGMA secure_delete = ${before === 1 ? "ON" : before === 2 ? "FAST" : "OFF"}`);
  }
}
// Dosya başka süreçte kilitliyken denetim noktası busy_timeout (10 sn) boyunca olay döngüsünü tutardı (İş N düzeni) → kısa bekleme süresiyle denenir, önceki süre geri konur;
// kilitliyse WAL bir sonraki silmede / süpürmede boşalır.
const CHECKPOINT_WAIT_MS = 200;
export function checkpoint(db) {
  if (db.isTransaction === true) return false;
  let before = null;
  try {
    before = Number(db.prepare("PRAGMA busy_timeout").get()?.timeout);
    db.exec(`PRAGMA busy_timeout = ${CHECKPOINT_WAIT_MS}`);
    const result = db.prepare("PRAGMA wal_checkpoint(TRUNCATE)").get();
    return Number(result?.busy) === 0;
  } catch {
    return false; // başka bağlantı okurken / kilitliyken: WAL sonraki denetim noktasında boşalır
  } finally {
    if (Number.isFinite(before)) {
      try {
        db.exec(`PRAGMA busy_timeout = ${before}`);
      } catch {
        // bağlantı kapanmış
      }
    }
  }
}
