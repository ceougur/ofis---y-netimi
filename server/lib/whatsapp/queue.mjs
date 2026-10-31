// WhatsApp Business API GÖNDERİM ÇEKİRDEĞİ — 2.4.8 W2 (docs/erp/WHATSAPP-API-PLANI-2.4.8.md §6 W2, §7a netleştirmeler 1–32, §8 "Nasıl bozulur?"). Şirket başına
// bir kuyruk (bu şirketin veri dosyasındaki wa_batches / wa_jobs, göç v40); işçi ortak katmanda TEK (lib/whatsapp/scheduler.mjs): bütün şirketler, iletiler
// arası ~1 sn.
//
// DURUM MAKİNESİ (iş): Bekliyor (pending) → Hazırlanıyor (preparing: cari GÖNDERİM ANINDA okunur — telefon, ad, bakiye, PDF aynı okumadan; §7a 1) →
// Gönderiliyor (sending: İSTEKTEN ÖNCE yazılır + makine defterine talep) → Meta Kabul Etti (accepted, wamid) → Gönderildi (sent) → Teslim Edildi (delivered) →
// Okundu (read). Yan dallar: Başarısız (failed; kod + Türkçe neden), Sonucu Belirsiz (uncertain; yanıtsız istek — KENDİLİĞİNDEN yeniden gönderilmez; yalnız
// Meta imzalı durum bildirimi + iş kimliğiyle çözülür, §7a 3), Sınır Nedeniyle Bekliyor (limited), Meta Bekletti (24 Saat Sonra Yeniden) (held; 131049),
// Duraklatıldı (paused; toplu iş duraklayınca bekleyenler), İptal (canceled), Süresi Doldu (expired; bildirim yolu çalışırken TTL + 1 sa teslim yok, §7a 16),
// Atlandı (skipped; numara geçersiz / WhatsApp Mesajı İstemiyor / pasif / silinmiş / Zaten Kuyrukta / Gecikmiş Borç Yok…), Durduruldu (stopped; geri yükleme,
// sıfırlama, taşınan veri). Durum bildirimi yalnız İLERİ götürür (§7a 17–18). "Durum Bilinmiyor" yok (§7a 16).
// Toplu iş: Sürüyor (running) / Duraklatıldı (paused; neden + kod) / Tamamlandı (done) / İptal Edildi (canceled) / Durduruldu (stopped).
//
// ÇİFT GÖNDERİM YOK: (1) her iletiden önce makine defterine talep (lib/whatsapp/defter.mjs claim) — önceki deneme kabul edilmiş / belirsiz / sonuçsuz ise
// istek GİTMEZ; (2) yanıtsız istek "Sonucu Belirsiz" olur, yeniden gönderilmez ("Yine de Gönder" ayrı, onaylı); (3) aynı istek kimliğiyle ikinci toplu iş
// açılmaz (çift tık, iki sekme); (4) aynı cari + aynı şablon + aynı dönem için bekleyen/gönderilmekte iş varken o cari yeni toplu işte "Zaten Kuyrukta"
// (iki kullanıcı / iki sekme; süre penceresi YOK — §7a 9); (5) geri yüklenen / taşınan veride defterde canlı olmayan toplu iş yürütülmez.
// GÜNLÜK SINIR: min(Meta basamağı, elle sınır); sayaç makine defterinde WABA kimliğine göre (kayan 24 saat, farklı kişi; geri yükleme azaltmaz).
import { randomUUID } from "node:crypto";
import { isLockError } from "../db.mjs";
import { HttpError } from "../http.mjs";
import { roundMoney } from "../money.mjs";
import { dayText } from "../plans.mjs";
import { statementData, statementFileName, statementPdf } from "../statement-pdf.mjs";
import { e164Of, waPresetRange } from "./alici.mjs";
import { allPeriodStartOf, localDayOf, periodKeyOf, periodKeysOf, queueKeysOf, rollingSinceOf, sameKeys, sentSinceOf } from "./donem.mjs";
import { DAY_MS } from "./defter.mjs";
import { META_D0, META_DEFAULT_TTL_SECONDS, MetaGraphError, classifyMetaCode, createMetaTemplates, neverReachedMeta, tierInfo } from "./meta-graph.mjs";
import { deliveryTtlSeconds, sendingVerdict } from "./templates.mjs";

export const TEMPLATE_NAMES = Object.freeze({ statement: "destekofis_ekstre", reminder: "destekofis_odeme_hatirlatma" });
export const KIND_LABELS = Object.freeze({ statement: "Ekstre", reminder: "Ödeme Hatırlatma" });
export const JOB_STATES = Object.freeze({
  pending: "Bekliyor", preparing: "Hazırlanıyor", sending: "Gönderiliyor", accepted: "Meta Kabul Etti", sent: "Gönderildi", delivered: "Teslim Edildi", read: "Okundu",
  failed: "Başarısız", uncertain: "Sonucu Belirsiz", limited: "Sınır Nedeniyle Bekliyor", held: "Meta Bekletti (24 Saat Sonra Yeniden)", paused: "Duraklatıldı",
  canceled: "İptal", expired: "Süresi Doldu", skipped: "Atlandı", stopped: "Durduruldu",
});
export const BATCH_STATES = Object.freeze({ running: "Sürüyor", paused: "Duraklatıldı", done: "Tamamlandı", canceled: "İptal Edildi", stopped: "Durduruldu" });
// Bir kez onay (plan §1 ürün kuralı; Ayarlar'da, şirket başına; toplu ve tekli gönderimde şart, Kendime Deneme Gönder hariç — §7a 28).
export const ACK_KEY = "whatsapp.ack";
export const ACK_TEXT = "Aydınlatma metnimi okudum, carilerime ulaştıracağım.";
export const ACK_VERSION = 1;
export const SENDING_KEY = "whatsapp.sending";
// Durum bildirimi yolunun son çalıştığı an (§7a 16): bu şirketin kancasına son bildirim.
export const HOOK_SEEN_KEY = "whatsapp.hookSeen";
// Türkiye utility ileti ücreti (Meta tarifesi 01.10.2026; plan §2.6) — yalnız "yaklaşık ücret" göstergesi; Meta faturası esastır.
export const UTILITY_USD = 0.0009;
export const MAX_RECIPIENTS = 5000;
// Ay sınırı Türkiye saatine göre (§7a 19; 2016'dan beri yaz saati yok, UTC+3).
const TR_OFFSET = "+03:00";
// Bekleyen / gönderilmekte (çift başlatma kuralı §7a 9 ve toplu işin bitişi). Sonucu Belirsiz bu kümede DEĞİL (bekler ama gönderilmez; "Yine de Gönder" onaylı).
const OPEN_JOB = ["pending", "preparing", "sending", "limited", "held", "paused"];
// KULLANICI KARARI (31.10.2026, ek soru 1/4 "a"): yeni toplu iş, iş şirket dosyasında OLMAYAN (yalnız makine defterinde kalan) Sonucu Belirsiz denemeyle ELEMEZ.
// Test: test/whatsapp-dk8-g-ek-248.test.mjs + test/whatsapp-dk7-belirsiz-ileti-248.test.mjs.
const NEW_BATCH_LEDGER_ONLY_UNSETTLED = false;
// İş P1 (c2): makine defterinin kilit işareti anahtarı (şirket kimliğinden ayrı).
const LEDGER_LOCK_KEY = "whatsapp-gonderim-defteri";
// İş P2 (kullanıcı metni): şirket dosyası kilitliyken süren toplu işin ekranındaki neden.
// İş R3 (dar kontrol 12; 5 dk yetkisiyle KARAR Y1): makine defteri (whatsapp-gonderim.sqlite) kilitliyken de neden; iki kilit birden → şirket cümlesi.
const LOCK_NOTES = Object.freeze({
  company: "Şirket dosyası başka bir program tarafından kullanılıyor; gönderim bekliyor.",
  ledger: "WhatsApp gönderim defteri başka bir program tarafından kullanılıyor; gönderim bekliyor.",
});
// Kesin durum: medya Meta'dan silinir (S3 A). "Meta Bekletti" kesin değil (aynı medya yeniden kullanılır, §7a 14).
const FINAL = ["delivered", "read", "failed", "expired", "canceled", "skipped", "stopped"];
// Geçici hata: iş 30 sn → 2 dk → 15 dk (3 deneme), sonra Başarısız (§7a 15); toplu işte art arda 5 → duraklar.
const JOB_BACKOFF_MS = [30_000, 120_000, 900_000];
// R1: Meta'ya ulaşılamıyorken toplu işin yeniden deneme beklemesi (iş Başarısız sayılmaz; bağlantı dönünce sürer).
const OFFLINE_BACKOFF_MS = [30_000, 60_000, 120_000, 300_000];
export const OFFLINE_LABEL = "Bağlantı Bekleniyor";
const MAX_TROUBLES = 5;
const PREPARING_STUCK_MS = 30_000; // T6-B1: bakım turunda "Hazırlanıyor"da takılı sayılma eşiği
const HOUR = 3_600_000;
const HOOK_ALIVE_MS = 7 * DAY_MS; // Meta 7 güne kadar yeniden dener (plan §3)
const MEDIA_REUSE_MS = 29 * DAY_MS; // medya kimliği 30 gün geçerli (plan §2.3)
// §7a 27 + R2 (plan §7a revizyonu): şablon kategorisi başlarken, sürerken HER 100 İLETİDE ve EN GEÇ 10 DAKİKADA bir okunur (Pazarlama ücretiyle giden ileti en çok ~100).
const TEMPLATE_CHECK_MS = 10 * 60_000;
const TEMPLATE_CHECK_EVERY = 100;
const TIER_CHECK_MS = 6 * HOUR;
const STALE_BATCH_MS = DAY_MS; // §7a 24: 24 saatten eski toplu iş açılışta sorulur (sınır nedeniyle bekleyen hariç)
const LICENSE_PAUSE = "Lisans Nedeniyle Durdu: program salt okunur çalışıyor; lisans yenilenince Devam Et'e basın.";

const fail = (status, message, code, extra = {}) => {
  throw new HttpError(status, message, { code, ...extra });
};
const parse = (value, fallback) => {
  try {
    const parsed = JSON.parse(value || "null");
    return parsed ?? fallback;
  } catch {
    return fallback;
  }
};
const moneyText = value => `${new Intl.NumberFormat("tr-TR", { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(Number(value) || 0)} TL`;
// D0-14: değişken tek satır, ardışık boşluk teke, en çok N karakter.
export const cleanParam = (value, max = META_D0.paramMax) => {
  // eslint-disable-next-line no-control-regex
  const text = String(value ?? "").replace(/[\r\n\t\u0000-\u001f\u007f]+/g, " ").replace(/\s{2,}/g, " ").trim();
  return text.length > max ? `${text.slice(0, max - 1)}…` : text;
};
// Bakiye metni (§7a 22): "1.234,56 TL (Borçlu)" / "1.234,56 TL (Alacaklı)" / "0,00 TL".
export const balanceText = value => `${moneyText(Math.abs(value))}${value > 0.005 ? " (Borçlu)" : value < -0.005 ? " (Alacaklı)" : ""}`;
const DATE = /^\d{4}-\d{2}-\d{2}$/;
const realDay = value => DATE.test(value) && new Date(`${value}T00:00:00Z`).toISOString().slice(0, 10) === value;

/** Toplu işin dönemi: preset (thisMonth / lastMonth / last3 / all — WhatsApp penceresiyle aynı) ya da from + to. */
export function periodOf(body, today) {
  const from = typeof body.from === "string" ? body.from.trim() : "";
  const to = typeof body.to === "string" ? body.to.trim() : "";
  if (from || to) {
    if (!realDay(from) || !realDay(to)) fail(400, "Dönemin başlangıç ve bitiş tarihini seçin.", "whatsapp-invalid", { field: "from" });
    if (from > to) fail(400, "Başlangıç tarihi bitiş tarihinden sonra olamaz.", "whatsapp-invalid", { field: "from" });
    return { from, to, preset: "" };
  }
  const preset = ["thisMonth", "lastMonth", "last3", "all"].includes(body.preset) ? body.preset : "thisMonth";
  return { ...waPresetRange(preset, today), preset };
}
// Dönem eşliği (R3 "daha önce gönderildi" anahtarı ve §7a 9 "Zaten Kuyrukta"): TEK YER lib/whatsapp/donem.mjs (T2-1 = A, kullanıcı kararı 31.10.2026).
// İletideki dönem metni ({{3}}; §7a 21): "01.10.2026 – 31.10.2026"; Tüm Hareketler: ilk hareketten dönem sonuna (bugün).
function periodText(period, lines) {
  if (period.from) return `${dayText(period.from)} – ${dayText(period.to)}`;
  // İş Q1: ilk hareket TEK KAYNAKTAN (donem.mjs allPeriodStartOf; Tüm Hareketler'in kişiye özel dönem anahtarı da buradan).
  const first = allPeriodStartOf(period, lines);
  return `${dayText(first)} – ${dayText(period.to)}`;
}
// Ödeme hatırlatması (§7a 20): {{3}} en eski gecikmiş vade tarihi (açık taksit kartlarının en eski ödenmemiş taksiti, vadesi bugünden önce), {{4}} vadesi geçmiş
// toplam (cari kartındaki "Geciken"), {{5}} güncel bakiye. Vadesi geçmiş borcu olmayan cari elenir.
function overdueOf(account, today) {
  const overdue = roundMoney(Number(account.totals?.overdue) || 0);
  if (!(overdue > 0.005)) return null;
  const dates = (account.plans || []).filter(plan => plan.status === "active" && plan.next && Number(plan.next.remaining) > 0.005 && plan.next.dueDate < today).map(plan => plan.next.dueDate).sort();
  return dates.length ? { dueDate: dates[0], amount: overdue } : null;
}

/**
 * @param {object} o
 * @param {object} o.store şirketin veri tabanı
 * @param {string} o.companyId
 * @param {object} o.ledger makine defteri (lib/whatsapp/defter.mjs; ortak katmandan)
 * @param {object} o.connection lib/whatsapp/connection.mjs (read, client)
 * @param {Function} o.accounts () => cari servisi (detail, list)
 * @param {Function} o.now iş saati (config.now)
 * @param {object} [o.license] status().writable
 * @param {Function} [o.header] () => rapor başlığı pdf() (lib/report-header.mjs)
 * @param {Function} [o.fault] testlerde kesinti: fault(nokta, iş) → true ise o noktada hata (ör. "db-accept": kabul yazımı düşer)
 */
export function createWaQueue({ store, companyId, ledger, connection, accounts, now, audit = () => {}, log = console, license = null, header = () => ({}), events = null, kick = () => {}, fault = null, hookUrl = () => "", writeLock = null }) {
  const iso = (ms = now().getTime()) => new Date(ms).toISOString();
  const nowMs = () => now().getTime();
  const today = () => now.today?.() || iso().slice(0, 10);
  const newId = prefix => `${prefix}-${randomUUID()}`;
  const writable = () => {
    try {
      return !license || Boolean(license.status?.().writable ?? license.writable?.());
    } catch {
      return false;
    }
  };
  const settings = () => {
    const raw = parse(store.setting(SENDING_KEY, ""), {}) || {};
    const ttl = Number(raw.ttlHours);
    const cap = Number(raw.dailyCap);
    return { ttlHours: Number.isInteger(ttl) && ttl >= 1 && ttl <= 720 ? ttl : META_D0.defaultTtlHours, dailyCap: Number.isInteger(cap) && cap > 0 ? cap : null };
  };
  const ack = () => {
    const raw = parse(store.setting(ACK_KEY, ""), null);
    return raw && raw.version === ACK_VERSION && raw.at ? raw : null;
  };
  const injected = (point, job) => {
    if (fault?.(point, job)) {
      const error = new Error(`test kesintisi: ${point}`);
      error.code = "ENOSPC";
      throw error;
    }
  };
  const notify = (batchId, extra = {}) => {
    try {
      events?.publish?.("whatsapp.changed", { batchId, ...extra });
    } catch {
      // bildirim yalnız ekranı tazeler
    }
  };
  const userFor = id => store.get("SELECT id, username, display_name, role FROM users WHERE id = ?", id) || { id, username: "", display_name: "", role: "admin" };

  // ---------- Okuma ----------
  const batchRow = id => store.get("SELECT * FROM wa_batches WHERE id = ?", id);
  const jobRow = id => store.get("SELECT * FROM wa_jobs WHERE id = ?", id);
  const updateJob = (id, fields) => {
    const keys = Object.keys(fields);
    store.run(`UPDATE wa_jobs SET ${keys.map(key => `${key} = ?`).join(", ")}, updated_at = ? WHERE id = ?`, ...keys.map(key => fields[key]), iso(), id);
  };
  const updateBatch = (id, fields) => {
    const keys = Object.keys(fields);
    store.run(`UPDATE wa_batches SET ${keys.map(key => `${key} = ?`).join(", ")}, updated_at = ? WHERE id = ?`, ...keys.map(key => fields[key]), iso(), id);
  };
  // T6-B1/B2 (son aday arıza testleri): Meta DIŞI hatada (şirket dosyasına yazım düştü — disk dolu, kilit — ya da beklenmeyen hata) işin beklemesi BELLEKTE de tutulur
  // (jobId → { tries, until }); dosyaya yazılamasa da işçi aynı işi beklemesiz yeniden seçmez. Program kapanınca gider: açılışta / bakım turunda iş yeniden değerlendirilir.
  const localDefer = new Map();
  let inFlight = null; // işçinin şu an yürüttüğü iş (bakım turu "Hazırlanıyor" toparlamasında ona dokunmaz)
  function counts(batchId) {
    const out = Object.fromEntries(Object.keys(JOB_STATES).map(state => [state, 0]));
    for (const row of store.all("SELECT state, COUNT(*) AS n FROM wa_jobs WHERE batch_id = ? GROUP BY state", batchId)) out[row.state] = row.n;
    return out;
  }
  const jobView = row => ({
    id: row.id,
    accountId: row.account_id,
    accountName: row.account_name,
    phone: row.phone_e164,
    state: row.state,
    stateLabel: JOB_STATES[row.state] || row.state,
    reason: row.skip_reason || row.error_text || "",
    errorCode: row.error_code,
    attempt: row.attempt,
    nextAt: row.next_at,
    pdfName: row.pdf_name,
    params: parse(row.params_json, []),
    wamid: row.wamid || "",
    acceptedAt: row.accepted_at,
    sentAt: row.sent_at,
    deliveredAt: row.delivered_at,
    readAt: row.read_at,
    failedAt: row.failed_at,
    billable: row.billable === null ? null : row.billable === 1,
    mediaDeleted: Boolean(row.media_deleted_at),
  });
  // İş P2: ekrandaki kilit nedeni — işçinin SON sınaması kilit gördüyse true; yalnız sonraki sınama (canWrite / markLocked) değiştirir. İşaret süresi (30 sn) dolup işçi
  // henüz yeniden sınamadıysa not sönüp yanmaz (kalıcı kilitte sürekli görünür); kilit kalkınca işçinin ilk turunda kalkar.
  let lockShown = null; // İş R3: null | "company" | "ledger"
  function batchView(row, { jobs = false } = {}) {
    if (!row) return null;
    const c = counts(row.id);
    const total = Object.values(c).reduce((sum, n) => sum + n, 0);
    // İş P2: arka plan işçisi şirket dosyasını kilitli gördü (İş P1 işareti) ve bu toplu işte gidecek ileti var → ekranda neden. Yalnız SÜREN toplu iş: duraklatılmış iş
    // kullanıcıyı bekler (gönderim kilidi beklemiyor), Devam Et'in kendi hatası görünür. İşaret kalkınca (≤ 30 sn) not da kalkar.
    const open = OPEN_JOB.reduce((sum, state) => sum + (c[state] || 0), 0);
    const lockNote = row.state === "running" && open > 0 && lockShown ? LOCK_NOTES[lockShown] : null;
    const actor = store.get("SELECT display_name AS name FROM users WHERE id = ?", row.created_by)?.name || "";
    return {
      id: row.id,
      kind: row.kind,
      kindLabel: KIND_LABELS[row.kind],
      template: row.template,
      period: { from: row.period_from, to: row.period_to, preset: row.preset },
      state: row.state,
      stateLabel: row.state === "running" && row.pause_code === "offline" ? OFFLINE_LABEL : BATCH_STATES[row.state],
      waitingUntil: row.state === "running" && row.pause_code === "offline" ? row.retry_at : null,
      pauseReason: row.pause_reason,
      pauseCode: row.pause_code,
      lockNote,
      createdAt: row.created_at,
      createdByName: actor,
      finishedAt: row.finished_at,
      total,
      counts: c,
      ...(jobs ? { jobs: store.all("SELECT * FROM wa_jobs WHERE batch_id = ? ORDER BY rowid", row.id).map(jobView) } : {}),
    };
  }
  // WhatsApp Gönderimleri listesi (kullanıcı isteği 31.10.2026 "şimdi yap"): en yeni önce; "Daha Fazla Göster" İMLEÇLİ sayfalama — before = ekrandaki son gönderimin
  // kimliği, ondan daha eskiler (created_at, rowid) sırasıyla; OFFSET yok (araya yeni gönderim girse de sayfa kaymaz). from / to: gönderimin başladığı YEREL gün
  // (lib/clock.mjs now.today ile aynı gün tanımı; iki uç dahil). Dış girdi doğrulanır; limit en çok 200.
  const DAY_RE = /^(\d{4})-(\d{2})-(\d{2})$/;
  const dayStart = (value, field, label) => {
    const match = DAY_RE.exec(value);
    const date = match ? new Date(Number(match[1]), Number(match[2]) - 1, Number(match[3]), 0, 0, 0, 0) : null;
    if (!date || date.getFullYear() !== Number(match[1]) || date.getMonth() !== Number(match[2]) - 1 || date.getDate() !== Number(match[3])) {
      fail(400, `${label} tarihi geçersiz.`, "whatsapp-invalid", { field });
    }
    return date;
  };
  const list = ({ limit = 50, before = "", from = "", to = "" } = {}) => {
    const text = value => (typeof value === "string" ? value.trim() : "");
    const where = [];
    const args = [];
    const fromDay = text(from);
    const toDay = text(to);
    const start = fromDay ? dayStart(fromDay, "from", "Başlangıç") : null;
    const end = toDay ? dayStart(toDay, "to", "Bitiş") : null;
    if (start && end && start > end) fail(400, "Başlangıç tarihi Bitiş tarihinden sonra olamaz.", "whatsapp-invalid", { field: "from" });
    if (start) {
      where.push("created_at >= ?");
      args.push(start.toISOString());
    }
    if (end) {
      where.push("created_at < ?");
      args.push(new Date(end.getFullYear(), end.getMonth(), end.getDate() + 1, 0, 0, 0, 0).toISOString());
    }
    const cursorId = text(before);
    if (cursorId) {
      const cursor = /^[A-Za-z0-9_-]{1,80}$/.test(cursorId) ? store.get("SELECT created_at, rowid FROM wa_batches WHERE id = ?", cursorId) : null;
      if (!cursor) fail(400, "Daha eski gönderimler yüklenemedi; listeyi yeniden açın.", "whatsapp-invalid", { field: "before" });
      where.push("(created_at < ? OR (created_at = ? AND rowid < ?))");
      args.push(cursor.created_at, cursor.created_at, cursor.rowid);
    }
    return store
      .all(`SELECT * FROM wa_batches${where.length ? ` WHERE ${where.join(" AND ")}` : ""} ORDER BY created_at DESC, rowid DESC LIMIT ?`, ...args, Math.min(200, Math.max(1, Number(limit) || 50)))
      .map(row => batchView(row));
  };
  const detail = id => {
    const row = batchRow(String(id || "").slice(0, 80));
    if (!row) fail(404, "Toplu gönderim bulunamadı.", "whatsapp-batch-missing");
    return batchView(row, { jobs: true });
  };
  // Cari kartı → Son Gönderimler (API yolu): son işler.
  const historyOf = accountId =>
    store.all("SELECT j.*, b.kind, COALESCE(u.display_name, '') AS actorName FROM wa_jobs j JOIN wa_batches b ON b.id = j.batch_id LEFT JOIN users u ON u.id = b.created_by WHERE j.account_id = ? ORDER BY j.created_at DESC LIMIT 20", accountId).map(row => ({
      ...jobView(row),
      channel: "api",
      kind: row.kind,
      at: row.accepted_at || row.created_at,
      actorName: row.actorName,
    }));

  // ---------- Meta denetimleri (şablon + sınır basamağı) ----------
  const templateCache = new Map(); // `${waba}|${name}` → { at, result }
  const tierCache = new Map(); // waba → { at, limit, tier }
  // T2-7: karar ekrandaki "Gönderime Hazır" ile AYNI kuralla, tek yerde (lib/whatsapp/templates.mjs sendingVerdict: durum, kategori VE içerik).
  const judgeTemplate = (items, name) => sendingVerdict(items, name);
  // Şablon listesi Şablonlar kartıyla AYNI okumayla (createMetaTemplates.details: içerik dahil ayrıntılı alanlar; alan reddinde temel alanlara bir kez düşer).
  async function checkTemplate(record, name, { force = false } = {}) {
    const key = `${record.wabaId}|${name}`;
    const cached = templateCache.get(key);
    if (!force && cached && nowMs() - cached.at < TEMPLATE_CHECK_MS && nowMs() >= cached.at && cached.sent < TEMPLATE_CHECK_EVERY) return cached.result;
    const listing = await createMetaTemplates(connection.metaOptions(record)).details(record.wabaId);
    const result = judgeTemplate(listing.items, name);
    templateCache.set(key, { at: nowMs(), result, sent: 0 });
    return result;
  }
  async function dailyLimit(graph, record, { force = false } = {}) {
    const cached = tierCache.get(record.wabaId);
    let info = cached && !force && nowMs() - cached.at < TIER_CHECK_MS && nowMs() >= cached.at ? cached : null;
    if (!info) {
      const tier = tierInfo(await graph.phoneLimit(record.phoneNumberId));
      info = { at: nowMs(), tier: tier.tier, limit: tier.limit };
      tierCache.set(record.wabaId, info);
    }
    // Basamak okunamadıysa (tanınmayan değer) en küçük basamak (250) varsayılır.
    const meta = info.limit === Infinity ? Infinity : Number.isFinite(info.limit) && info.limit > 0 ? info.limit : 250;
    const cap = settings().dailyCap;
    return { limit: cap ? Math.min(cap, meta) : meta, tier: info.tier, meta, cap };
  }
  // starting (T1 P2 A, 5 dk yetkisi): toplu iş BAŞLATILIRKEN Meta'ya ulaşılamadıysa meta-graph.mjs'in "…; sonuç bilinmiyor." metni yanıltıcıdır (hiçbir ileti
  // gönderilmedi, toplu iş açılmadı) → açık ileti.
  const START_UNREACHABLE = "Meta'ya ulaşılamıyor; gönderim başlatılmadı. Bağlantı gelince yeniden başlatın.";
  const metaHttp = (error, { starting = false } = {}) => {
    if (error instanceof HttpError) return error;
    const reached = error.reason === "meta";
    return new HttpError(502, !reached && starting ? START_UNREACHABLE : error.message, { code: reached ? "whatsapp-meta" : "whatsapp-meta-unreachable", meta: error.toJSON?.() });
  };
  const usage = wabaId => ledger.windowUsage(wabaId, iso(nowMs() - DAY_MS));

  // ---------- Toplu iş açma ----------
  function selection(user, body) {
    const service = accounts();
    if (!service?.list || !service?.detail) fail(503, "Cari modülü hazır değil.", "whatsapp-accounts");
    let ids;
    if (body.all === true) {
      const text = value => (typeof value === "string" ? value.trim() : "");
      ids = service.list(user, { q: text(body.q).slice(0, 120), group: text(body.group), subgroup: text(body.subgroup), type: text(body.type), status: ["active", "passive", "all"].includes(text(body.status)) ? text(body.status) : "active", balance: text(body.balance) || "all" }).accounts.map(item => item.id);
      const except = new Set(Array.isArray(body.except) ? body.except.map(value => String(value || "")) : []);
      ids = ids.filter(id => !except.has(id));
    } else ids = [...new Set((Array.isArray(body.ids) ? body.ids : []).map(value => String(value || "").slice(0, 120)).filter(Boolean))];
    if (!ids.length) fail(400, "Gönderilecek carileri seçin.", "whatsapp-invalid", { field: "ids" });
    if (ids.length > MAX_RECIPIENTS) fail(400, `Tek seferde en çok ${MAX_RECIPIENTS} cariye gönderilebilir; süzgeçle daraltın.`, "whatsapp-invalid", { field: "ids" });
    return ids;
  }
  // §7a 9: aynı cari + aynı şablon + aynı dönem için bekleyen / gönderilmekte iş (süren ya da duraklatılmış toplu işte) — iki kullanıcı, iki sekme.
  // Dönem eşliği donem.mjs queueKeysOf'tan (T2-1: tek yer). ★ soru 4 (özel aralık ↔ hazır seçim): yeni gönderimin kümesi BUGÜNE, süren işinki AÇILDIĞI GÜNE göre.
  // dates (İş Q1): carinin hareket tarihleri (cari ekstresinin sırası) — "Tüm Hareketler"in kişiye özel dönemi (ilk hareket – dönem sonu) iki yanda da.
  const queued = (accountId, kind, period, day = today(), dates = []) => {
    const want = queueKeysOf(kind, period, day, { first: firstOfAll(period, dates) });
    const rows = store.all(`SELECT j.id, b.period_from, b.period_to, b.preset, b.created_at, b.key_day FROM wa_jobs j JOIN wa_batches b ON b.id = j.batch_id WHERE j.account_id = ? AND b.kind = ? AND b.state IN ('running', 'paused') AND j.state IN (${OPEN_JOB.map(() => "?").join(",")})`, accountId, kind, ...OPEN_JOB);
    return rows.find(row => {
      const rowPeriod = { from: row.period_from, to: row.period_to, preset: row.preset };
      return sameKeys(want, queueKeysOf(kind, rowPeriod, keyDayOfBatch({ ...row, kind }), { first: firstOfAll(rowPeriod, dates) }));
    }) || null;
  };
  // İş Q1 + R6: "Tüm Hareketler" döneminde carinin dönem başı (ilk hareket, yoksa dönem sonu — iletideki dönem metniyle aynı kaynak), başka seçimde "".
  // İş R6: iletideki dönemle AYNI kaynak (donem.mjs allPeriodStartOf: ilk hareket, yoksa dönem sonu).
  const firstOfAll = (period, dates) => (period?.preset === "all" ? allPeriodStartOf(period, dates) : "");
  // Dar kontrol 9 ORTA-1 (★ soru 4 "o gün" = özel aralığın kullanıldığı gün = TOPLU İŞİN AÇILIŞ GÜNÜ; BAŞ MİMAR yorumu): bir toplu işin dönem anahtar kümesi hangi
  // gün gönderilirse gönderilsin (günlük sınırla ertesi güne kalan, Meta Bekletti'nin ertesi gün 2. denemesi) AÇILDIĞI yerel güne göre — talep (runJob), Zaten Kuyrukta
  // (queued) ve taşınan veri (movedSentBefore) aynı yerden okur. YALNIZ EKSTRE: Ödeme Hatırlatma'nın "aynı gün"ü gönderim / yeniden denemenin günüdür (ek 3/4, son 2/2).
  // KULLANICI KARARI (31.10.2026, dk9 soru 1/7 "a"): Başarısızları Yeniden Dene / işteki Yine de Gönder'in açtığı işte "o gün" ASIL işin açıldığı gündür (dönem gibi
  // taşınır: wa_batches.key_day, göç v43; boşsa işin kendi açılış günü).
  function keyDayOfBatch(batch) {
    if (batch?.kind !== "statement") return today();
    return batch.key_day || localDayOf(batch.created_at) || today();
  }
  // KULLANICI KARARI (31.10.2026 ~11:30 UTC "a"; ★ soru 8): başka bilgisayara TAŞINAN veride şirket dosyasında Meta Kabul Etti / Gönderildi / Teslim Edildi / Okundu duran
  // ileti, bu bilgisayarın defterinde yoksa R3'te sayılır. Yalnız bu defterde AÇILMAMIŞ toplu işler (ledger_id başka) taranır: bu bilgisayarda açılan toplu işin
  // (aynı bilgisayara geri yüklenmiş eski veri dahil) kararı defterindir (★ soru 7) — defter yalnız kendi ledger_id'li toplu işin talebini yazar (runJob), çift sayım
  // olmaz; aynı cari birden çok kaynaktan gelirse en son kabul anı alınır. Dönem eşliği, 7 gün penceresi (since) ve asıl işin "Yine de Gönder" sınırı (after)
  // defterdeki R3 ile aynı kural (anahtar kümesi keyDayOfBatch). Dönüş: Map(cari → son kabul anı ISO).
  // Dar kontrol 9 (ölçek): başka defterde açılmış bu türde toplu iş yoksa (taşınan veri yok — olağan kurulum) iş tablosu hiç taranmaz.
  // keysOf / datesOf (İş Q1): istenen dönemin cari başına anahtar kümesi ve carinin hareket tarihleri ("Tüm Hareketler" satırının kişiye özel dönemi için).
  function movedSentBefore(ids, kind, keysOf, since, after, datesOf) {
    const out = new Map();
    if (!store.get("SELECT 1 AS found FROM wa_batches WHERE kind = ? AND ledger_id <> ? LIMIT 1", kind, ledger.id)) return out;
    for (let i = 0; i < ids.length; i += 500) {
      const part = ids.slice(i, i + 500);
      const rows = store.all(
        `SELECT j.id, j.account_id AS accountId, COALESCE(j.accepted_at, j.sent_at, j.delivered_at, j.read_at, j.sending_at) AS acceptedAt, COALESCE(j.sending_at, j.accepted_at) AS sendingAt,
          b.kind, b.period_from, b.period_to, b.preset, b.created_at, b.key_day FROM wa_jobs j JOIN wa_batches b ON b.id = j.batch_id
         WHERE b.kind = ? AND b.ledger_id <> ? AND j.state IN ('accepted', 'sent', 'delivered', 'read') AND j.account_id IN (${part.map(() => "?").join(",")})`,
        kind, ledger.id, ...part,
      );
      for (const row of rows) {
        if (!row.acceptedAt || (since && row.acceptedAt < since) || (after && !(String(row.sendingAt || "") > after))) continue;
        if (["last3", "all"].includes(row.preset) && row.acceptedAt < rollingSinceOf(nowMs())) continue; // İş L5: seçimin 7 gün penceresi
        const rowPeriod = { from: row.period_from, to: row.period_to, preset: row.preset };
        const rowKeys = periodKeysOf(kind, rowPeriod, kind === "statement" ? keyDayOfBatch(row) : localDayOf(row.sendingAt || row.acceptedAt), { first: row.preset === "all" ? firstOfAll(rowPeriod, datesOf(row.accountId)) : "" });
        if (!sameKeys(keysOf(row.accountId), rowKeys)) continue;
        if (!out.has(row.accountId) || out.get(row.accountId) < row.acceptedAt) out.set(row.accountId, row.acceptedAt);
      }
    }
    return out;
  }
  // KULLANICI KARARI (31.10.2026, "KİME KAÇ KEZ" ilkesi, S2): taşınan veride şirket dosyasında "Sonucu Belirsiz" duran iş (bu defterde açılmamış toplu işte) yeni
  // toplu işte ve Başarısızları Yeniden Dene'de kişiyi "Sonucu Belirsiz" ile eler; işteki Yine de Gönder yolu açık (iş dosyada). Eşlik defterdeki elemeyle aynı (dönem
  // kümesi keyDayOfBatch, Son 3 Ay / Tüm'de 7 gün — gönderim anından). Dönüş: Map(cari → [iş kimliği]).
  function movedUnsettled(ids, kind, keysOf, since, datesOf) {
    const out = new Map();
    if (!store.get("SELECT 1 AS found FROM wa_batches WHERE kind = ? AND ledger_id <> ? LIMIT 1", kind, ledger.id)) return out;
    for (let i = 0; i < ids.length; i += 500) {
      const part = ids.slice(i, i + 500);
      const rows = store.all(
        `SELECT j.id, j.account_id AS accountId, COALESCE(j.sending_at, j.updated_at) AS sendingAt, b.kind, b.period_from, b.period_to, b.preset, b.created_at, b.key_day
         FROM wa_jobs j JOIN wa_batches b ON b.id = j.batch_id
         WHERE b.kind = ? AND b.ledger_id <> ? AND j.state = 'uncertain' AND j.account_id IN (${part.map(() => "?").join(",")})`,
        kind, ledger.id, ...part,
      );
      for (const row of rows) {
        if (since && String(row.sendingAt || "") < since) continue;
        if (["last3", "all"].includes(row.preset) && String(row.sendingAt || "") < rollingSinceOf(nowMs())) continue; // İş L5
        const rowPeriod = { from: row.period_from, to: row.period_to, preset: row.preset };
        const rowKeys = periodKeysOf(kind, rowPeriod, kind === "statement" ? keyDayOfBatch(row) : localDayOf(row.sendingAt), { first: row.preset === "all" ? firstOfAll(rowPeriod, datesOf(row.accountId)) : "" });
        if (!sameKeys(keysOf(row.accountId), rowKeys)) continue;
        if (!out.has(row.accountId)) out.set(row.accountId, []);
        out.get(row.accountId).push(row.id);
      }
    }
    return out;
  }
  // İş Q2 (KULLANICI KARARI A; ilke 4 + 5): şirket dosyasındaki "Yine de Gönder" bağı (wa_jobs.inherit_of, göç v44) — kaynağı olduğu iş (zincirde herhangi biri) Meta
  // Kabul Etti / Gönderildi / Teslim Edildi / Okundu ise kaynak belirsiz SAYILMAZ (defterdeki anyway_links ile aynı kural; taşınan veride ve defter bağı yazılamadıysa bu
  // yol). Bağı olan iş yoksa (olağan) tek sorgu.
  function dropSettledSources(unsettled) {
    if (!unsettled.size) return;
    const links = store.all("SELECT id, inherit_of AS source, state FROM wa_jobs WHERE inherit_of <> ''");
    if (!links.length) return;
    const parent = new Map(links.map(row => [row.id, row.source]));
    const settled = new Set();
    for (const row of links) {
      if (!["accepted", "sent", "delivered", "read"].includes(row.state)) continue;
      for (let source = row.source, guard = 0; source && !settled.has(source) && guard < 1000; source = parent.get(source), guard += 1) settled.add(source);
    }
    if (!settled.size) return;
    for (const [accountId, jobIds] of [...unsettled]) {
      const left = jobIds.filter(jobId => !settled.has(jobId));
      if (left.length) unsettled.set(accountId, left);
      else unsettled.delete(accountId);
    }
  }
  // Cari, gönderim için uygun mu (toplu iş açılırken ve GÖNDERİM ANINDA aynı kural — §7a 1, 2, 6, 20). Dönüş: neden (boş = uygun) + numara.
  function eligibility(account, kind) {
    const phone = e164Of(account.phone);
    if (account.deletedAt || account.deleted_at) return { skip: "Cari Silinmiş", phone };
    if (Number(account.waOptOut) === 1) return { skip: "WhatsApp Mesajı İstemiyor", phone };
    if (account.status === "passive") return { skip: "Pasif Cari", phone };
    if (!phone.valid) return { skip: phone.reason, phone };
    if (kind === "reminder" && !overdueOf(account, today())) return { skip: "Gecikmiş Borç Yok", phone };
    return { skip: "", phone };
  }

  /**
   * Kişi listesi ve eleme nedenleri (önizleme ve açma aynı kuralla). Dönüş: { kind, period, people: [{ id, name, phone, skip }] }. Sıra = seçim sırası (§7a 5).
   * İçerik (bakiye, PDF, telefon) burada SAKLANMAZ — gönderim anında aynı cari okumasından (§7a 1).
   */
  // fixed (yalnız iç çağrı; dar kontrol 4 ORTA-1): "Başarısızları Yeniden Dene" / "Yine de Gönder" asıl toplu işin KAYITLI dönemini { from, to, preset } taşır — dönem
  // gövdeden yeniden hesaplanmaz (preset kaybolup "Bu Ay" özel aralık sayılmasın, "Tüm Hareketler"in boş başlangıcı 400 vermesin). Rotalar bu bağımsız değişkeni vermez.
  // fixed.sendAgainAfter (dar kontrol 5 ORTA-1; KULLANICI KARARI 31.10.2026 "a şıkkı"): asıl işte kullanıcı R3 sorusunda "Yine de Gönder" dediyse asıl işin açılış anı.
  // O zaman R3 yalnız bu andan SONRAKİ kabulleri sayar: açılıştan önceki gönderim (R3'ü doğuran) o kararla kabul edilmişti; açılıştan sonra başka bir işle aynı kişiye
  // aynı dönem giden yine "Daha Önce Gönderildi" (çift ileti yok). Yeniden denemede gövdenin sendAgain'i okunmaz (karar yalnız asıl işin kaydından).
  // options.anyway (★ soru 1): "Yine de Gönder" (sendAnyway) — kullanıcı belirsiz işi onaylayarak yeniden gönderiyor; Sonucu Belirsiz elemesi uygulanmaz.
  function plan(user, body, fixed = null, { anyway = false } = {}) {
    const kind = body.kind === "reminder" ? "reminder" : body.kind === "statement" ? "statement" : null;
    if (!kind) fail(400, "Gönderim türünü seçin (Ekstre ya da Ödeme Hatırlatma).", "whatsapp-invalid", { field: "kind" });
    const period = kind === "statement" ? (fixed ? { from: fixed.from || "", to: fixed.to || "", preset: fixed.preset || "" } : periodOf(body, today())) : { from: "", to: "", preset: "" };
    const ids = selection(user, body);
    const sendAgain = fixed ? false : body.sendAgain === true;
    // dk9 soru 1/7 "a": yeniden denemede / Yine de Gönder'de "o gün" asıl işin günü (fixed.keyDay); yeni gönderimde bugün (yeni işin açılış günü).
    const keyDay = kind === "statement" && fixed?.keyDay ? fixed.keyDay : today();
    const keys = periodKeysOf(kind, period, keyDay);
    const since = sentSinceOf(kind, period, nowMs());
    const after = fixed?.sendAgainAfter || "";
    const rolling = rollingSinceOf(nowMs());
    // İş Q1 (dar kontrol 10 DÜŞÜK-1; ilke 3): "Tüm Hareketler"in dönemi kişiye özel (ilk hareket – dönem sonu) → anahtar kümesi CARİ BAŞINA. Cari okuması (detail) bir kez
    // yapılır; yalnız hareket TARİHLERİ tutulur (kişi döngüsü aynı okumayı kullanır). Başka seçimlerde bugünkü gibi tek küme ve tembel okuma.
    const loaded = new Map(); // cari → okunan cari (hareket satırları tutulmaz) ya da null (silinmiş)
    const datesCache = new Map(); // cari → hareket tarihleri
    const load = id => {
      if (!loaded.has(id)) {
        let account = null;
        try {
          account = accounts().detail(id, user);
        } catch {
          account = null;
        }
        datesCache.set(id, (account?.ledger || []).map(line => line.date));
        if (account) {
          const { ledger: _lines, ...rest } = account;
          loaded.set(id, rest);
        } else loaded.set(id, null);
      }
      return loaded.get(id);
    };
    const datesOf = id => {
      if (!datesCache.has(id)) load(id);
      return datesCache.get(id) || [];
    };
    const perPerson = kind === "statement" && period.preset === "all";
    const ownKeys = new Map();
    if (perPerson) {
      for (const id of ids) {
        const first = firstOfAll(period, datesOf(id));
        if (first) ownKeys.set(id, periodKeysOf(kind, period, keyDay, { first }).filter(key => !keys.includes(key)));
      }
    }
    const keysOf = id => (perPerson && ownKeys.has(id) ? [...keys, ...ownKeys.get(id)] : keys);
    const sent = ledger.sentBefore({ companyId, kind, periodKeys: keys, since, after, rolling, accountKeys: perPerson ? ownKeys : null });
    for (const [accountId, last] of movedSentBefore(ids, kind, keysOf, since, after, datesOf)) if (!sent.has(accountId) || sent.get(accountId) < last) sent.set(accountId, last);
    // KULLANICI KARARI (31.10.2026 ~08:00 UTC "A"): "Başarısızları Yeniden Dene"de aynı cariye aynı dönem iletisi Sonucu Belirsiz kalmışsa elenir (soru sorulmadan ikinci
    // ileti gitmez; göndermek için işteki "Yine de Gönder" — "iki kez gidebilir" onayıyla). KULLANICI KARARI (31.10.2026 ~10:55 UTC "b"; ★ soru 1): YENİ toplu işte de aynı
    // kural ve eşlik (aynı tür + dönem; Son 3 Ay / Tüm'de son 7 gün, gönderim anından). Yalnız "Yine de Gönder"in kendisi (anyway) elenmez.
    // asıl işin "Yine de Gönder" sınırı (sendAgainAfter) burada UYGULANMAZ: o karar yalnız Meta'nın KABUL ETTİĞİ önceki gönderimi kapsıyordu.
    const unsettled = anyway ? null : ledger.unsettledBefore({ companyId, kind, periodKeys: keys, since, rolling, accountKeys: perPerson ? ownKeys : null });
    if (unsettled) for (const [accountId, jobIds] of movedUnsettled(ids, kind, keysOf, since, datesOf)) unsettled.set(accountId, [...(unsettled.get(accountId) || []), ...jobIds]);
    if (unsettled) dropSettledSources(unsettled);
    const people = [];
    let uncertainOpen = 0;
    for (const id of ids) {
      const account = load(id);
      if (!account) {
        people.push({ id, name: "", phone: "", skip: "Cari Silinmiş" });
        continue;
      }
      const check = eligibility(account, kind);
      const person = { id: account.id, name: account.name, phone: check.phone.e164, skip: check.skip };
      // KULLANICI KARARI (31.10.2026, ek soru 2/4 "a"): birden çok eleme nedeninde TEK neden, sıra HER YERDE (yeni toplu iş, Başarısızları Yeniden Dene, işteki Yine de
      // Gönder'in açtığı iş): "Zaten Kuyrukta" → "Sonucu Belirsiz" → "Daha Önce Gönderildi". İlk ikisiyle elenen kişi R3 uyarısına (sayı / liste: sentBefore) GİRMEZ;
      // R3'te "Yine de Gönder" seçilse de ona gitmez (belirsizi göndermenin tek yolu işteki Yine de Gönder).
      if (!person.skip && queued(account.id, kind, period, keyDay, datesOf(id))) person.skip = "Zaten Kuyrukta";
      if (!person.skip && unsettled?.has(account.id)) {
        // Dar kontrol 7 DÜŞÜK-1: "Yine de Gönder" yalnız iş şirket dosyasında hâlâ Sonucu Belirsiz ise vardır (geri yüklemeden sonra iş dosyadan gider, defterde kalır).
        const open = unsettled.get(account.id).some(jobId => store.get("SELECT 1 AS found FROM wa_jobs WHERE id = ? AND state = 'uncertain'", jobId));
        // ★ soru 1: yeni toplu işte iş dosyadaysa (işteki "Yine de Gönder" var) elenir. KULLANICI KARARI (31.10.2026, ek soru 1/4 "a"): YALNIZ defterde kalan belirsiz
        // deneme (iş dosyada yok — geri yükleme sonrası) yeni toplu işte ELEMEZ (NEW_BATCH_LEDGER_ONLY_UNSETTLED = false). Başarısızları Yeniden Dene'de (08:00 "A") her
        // zaman elenir (ileti "yeni gönderim başlatın").
        if (fixed?.retry === true || open || NEW_BATCH_LEDGER_ONLY_UNSETTLED) {
          person.skip = "Sonucu Belirsiz";
          if (open) uncertainOpen += 1;
        }
      }
      // R3 (plan §7a revizyonu): bu cariye bu şablon + dönem daha önce Meta'ya kabul ettirildiyse açık "sendAgain" bayrağı olmadan elenir (W4 sorar: "Yine de
      // Gönder" / "Bunları Çıkar", varsayılan Bunları Çıkar). Bilgi makine defterinden (geri yükleme silmez).
      const last = sent.get(account.id);
      if (last && !["Zaten Kuyrukta", "Sonucu Belirsiz"].includes(person.skip)) person.sentBefore = last;
      if (!person.skip && last && !sendAgain) person.skip = "Daha Önce Gönderildi";
      people.push(person);
    }
    return { kind, period, people, uncertainOpen };
  }

  // §7a 29: başlatma reddi sırası bağlı değil → yetki → lisans → onay → şablon (yetki rotada, bağlantıdan hemen sonra denetlenir: routes/whatsapp.mjs).
  function connected() {
    const record = connection.read();
    if (!record) fail(409, "WhatsApp Business API bağlantısı yok; önce Yönetim → WhatsApp'ta Elle Bağla ile bağlanın.", "whatsapp-not-configured");
    return record;
  }
  // Başlatmayı engelleyen (bağlantı ve lisanstan sonraki) ilk neden: onay → firma adı. Önizleme bunu YANITTA söyler (2.4.8 W4: önizleme onaydan önce görülür,
  // "Gönder" onay işaretlenene dek pasif kalır); toplu iş açma reddeder.
  // T2-8: aynı engel süren toplu işte de geçerlidir — Devam Et reddedilir, işçi her adımda ve ileti isteğinden hemen önce denetler (pauseCode / pauseReason).
  function startBlock() {
    if (!ack()) {
      return {
        code: "whatsapp-ack-required",
        message: `Gönderimden önce Yönetim → WhatsApp'ta "${ACK_TEXT}" onayını işaretleyin.`,
        pauseCode: "ack",
        pauseReason: `Gönderim onayı kaldırıldı; onay olmadan ileti gönderilmez. Yönetim → WhatsApp'ta "${ACK_TEXT}" onayını yeniden işaretleyip Devam Et'e basın.`,
      };
    }
    if (!String(store.setting("office.name", "") || "").trim()) {
      return {
        code: "whatsapp-office-missing",
        message: "Firma adı yazılmamış (iletide firmanızın adı geçer); Yönetim → Ofis Bilgileri'nde firma adını yazın.",
        pauseCode: "office",
        pauseReason: "Firma adı silinmiş (iletide firmanızın adı geçer); Yönetim → Ofis Bilgileri'nde firma adını yazıp Devam Et'e basın.",
      };
    }
    return null;
  }
  function preconditions() {
    const record = connected();
    if (!writable()) fail(403, "Program salt okunur çalışıyor; WhatsApp gönderimi başlatılamaz.", "LICENSE_READ_ONLY");
    const block = startBlock();
    if (block) fail(409, block.message, block.code);
    return record;
  }

  /**
   * Önizleme: kişiler, eleme nedenleri, bugünkü sınırdan kalan, yarına kalacak (Meta'ya yalnız okuma istekleri). 2.4.8 W4: onay ve firma adı önizlemeyi
   * ENGELLEMEZ (ekran önce kaç kişiye gideceğini gösterir); başlatma engeli `startBlock` ile yanıtta, toplu iş açma (createBatch) yine reddeder.
   */
  async function preview(user, body) {
    const record = connected();
    if (!writable()) fail(403, "Program salt okunur çalışıyor; WhatsApp gönderimi başlatılamaz.", "LICENSE_READ_ONLY");
    const kind = body.kind === "reminder" ? "reminder" : "statement";
    const { graph } = connection.client();
    let limitInfo;
    let template;
    try {
      template = await checkTemplate(record, TEMPLATE_NAMES[kind], { force: true });
      limitInfo = await dailyLimit(graph, record, { force: true });
    } catch (error) {
      if (error instanceof MetaGraphError) throw metaHttp(error);
      throw error;
    }
    return { ...summarize(plan(user, body), record, limitInfo, template), startBlock: startBlock(), ack: ackView() };
  }
  function summarize(plotted, record, limitInfo, template) {
    const sendable = plotted.people.filter(person => !person.skip);
    const used = usage(record.wabaId);
    const hold = ledger.holdOf(record.wabaId, iso());
    const left = hold ? 0 : limitInfo.limit === Infinity ? Infinity : Math.max(0, limitInfo.limit - used.count);
    const fresh = [...new Set(sendable.map(person => person.phone))].filter(phone => !used.phones.has(phone)).length;
    const later = left === Infinity ? 0 : Math.max(0, fresh - left);
    const skipped = {};
    for (const person of plotted.people) if (person.skip) skipped[person.skip] = (skipped[person.skip] || 0) + 1;
    // R3: "N kişiye bu dönem daha önce gönderildi (son tarih)" — elenmiş de olsalar (sendAgain yokken) ya da gönderilecek de olsalar (sendAgain ile).
    const again = plotted.people.filter(person => person.sentBefore);
    const alreadySent = { count: again.length, last: again.reduce((max, person) => (person.sentBefore > max ? person.sentBefore : max), "") || null, included: again.filter(person => !person.skip).length };
    return {
      kind: plotted.kind,
      period: plotted.period,
      template,
      total: plotted.people.length,
      sendable: sendable.length,
      skipped,
      alreadySent,
      people: plotted.people,
      limit: { limit: limitInfo.limit === Infinity ? "unlimited" : limitInfo.limit, tier: limitInfo.tier, cap: limitInfo.cap, used: used.count, left: left === Infinity ? "unlimited" : left, later, holdUntil: hold },
      // Tahmini süre: iletiler arası ~1 sn (bugün gidebilenler).
      seconds: Math.max(0, sendable.length - later),
    };
  }

  // Bütün seçilenler elendiğinde ileti: nedenler sayılarıyla + "Daha Önce Gönderildi" için ne yapılacağı (cümle düzeni).
  function nothingMessage(summary, uncertainOpen = 0) {
    const reasons = Object.entries(summary.skipped || {}).map(([reason, n]) => `${reason}: ${n}`).join(", ");
    let text = `Gönderilebilecek kişi yok (seçilenlerin hepsi elendi${reasons ? ` — ${reasons}` : ""}).`;
    if (summary.skipped?.["Daha Önce Gönderildi"]) {
      text += summary.kind === "reminder"
        ? ` Bu kişilere bugün daha önce ödeme hatırlatması gönderildi; yeniden göndermek için yeni gönderimde "Yine de Gönder" seçin.`
        : ` Bu kişilere bu dönem daha önce gönderildi; yeniden göndermek için yeni gönderimde "Yine de Gönder" seçin.`;
    }
    // Dar kontrol 7 DÜŞÜK-1: işteki "Yine de Gönder" yalnız o iş şirket dosyasında Sonucu Belirsiz duruyorsa söylenir (uncertainOpen); yoksa (ör. geri yüklemeden sonra)
    // yalnız yeni gönderim. Yeni gönderim "iki kez gidebilir" diye sormaz → uyarı iletide.
    // KULLANICI KARARI (31.10.2026 ~11:45 UTC "A"): iş dosyada DURURKEN yalnız onaylı yol ("Yine de Gönder" iki kez gidebileceğini sorar) önerilir; onaysız "yeni gönderim
    // başlatın" yolu bu durumda söylenmez. İş dosyada yokken başka yol olmadığından "yeni gönderim başlatın" kalır.
    if (summary.skipped?.["Sonucu Belirsiz"]) {
      text += uncertainOpen > 0
        ? ` Bu kişilerin önceki iletisinin sonucu belirsiz (ileti iki kez gidebilir); göndermek için işteki "Yine de Gönder"i kullanın.`
        : ` Bu kişilerin önceki iletisinin sonucu belirsiz (ileti iki kez gidebilir); göndermek için yeni gönderim başlatın.`;
    }
    return text;
  }

  // options.inherit (T1 P6): "Yine de Gönder"in kaynağı olan Sonucu Belirsiz iş — yeni iş onun dondurulmuş içeriğini ve Meta'daki PDF'ini devralır (sendAnyway).
  // options.period (dar kontrol 4 ORTA-1): asıl toplu işin kayıtlı dönemi ve "Yine de Gönder" kararı { from, to, preset, sendAgainAfter } (retryFailed / sendAnyway);
  // yalnız iç çağrı — rota createBatch(user, body) ile çağırır, gövdedeki "period" / "sendAgainAfter" / "send_again_after" alanları okunmaz.
  async function createBatch(user, body, { inherit = null, period = null } = {}) {
    const record = preconditions();
    const requestId = typeof body.requestId === "string" && /^[A-Za-z0-9_-]{6,100}$/.test(body.requestId) ? body.requestId : "";
    const requestKey = requestId ? `${user.id}|${requestId}` : null;
    const existing = requestKey ? store.get("SELECT * FROM wa_batches WHERE request_key = ?", requestKey) : null;
    if (existing) return { batch: batchView(existing), reused: true };
    const kind = body.kind === "reminder" ? "reminder" : "statement";
    const { graph } = connection.client();
    let template;
    let limitInfo;
    try {
      template = await checkTemplate(record, TEMPLATE_NAMES[kind], { force: true });
      if (template.ok) limitInfo = await dailyLimit(graph, record, { force: true });
    } catch (error) {
      if (error instanceof MetaGraphError) throw metaHttp(error, { starting: true });
      throw error;
    }
    if (!template.ok) fail(409, template.reason, `whatsapp-${template.code}`, { template: template.template || null });
    // Meta'ya giden okuma isteğinin arasında aynı istek kimliğiyle ikinci istek tamamlanmış olabilir (çift tık): yeniden bakılır.
    const again = requestKey ? store.get("SELECT * FROM wa_batches WHERE request_key = ?", requestKey) : null;
    if (again) return { batch: batchView(again), reused: true };
    preconditions();
    const plotted = plan(user, body, period, { anyway: Boolean(inherit) });
    const summary = summarize(plotted, record, limitInfo, template);
    // §7a 31: bütün seçilenler elenince toplu iş kaydı OLUŞMAZ; nedenler yanıtta ve İLETİDE (dar kontrol 5 ORTA-1: istemci yalnız iletiyi gösterir).
    if (!summary.sendable) fail(400, nothingMessage(summary, plotted.uncertainOpen), "whatsapp-nothing", { summary });
    const batchId = newId("wab");
    const at = iso();
    // dar kontrol 5 ORTA-1: "Yine de Gönder" kararı — yeni işte gövdenin açık sendAgain'i (açılış anı), yeniden denemede asıl işin kayıtlı anı (zincirde kaymaz).
    const sendAgainAfter = period ? period.sendAgainAfter || "" : body.sendAgain === true ? at : "";
    try {
      ledger.openBatch(batchId, companyId, at);
    } catch (error) {
      fail(503, `WhatsApp gönderim defterine yazılamadı (${error.code || error.message}); disk dolu olabilir. Gönderim başlatılmadı.`, "whatsapp-ledger");
    }
    store.tx(() => {
      store.run(
        "INSERT INTO wa_batches (id, kind, period_from, period_to, preset, template, lang, phone_number_id, waba_id, ledger_id, company_id, state, request_key, send_again_after, key_day, created_by, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'running', ?, ?, ?, ?, ?, ?)",
        batchId, kind, plotted.period.from, plotted.period.to, plotted.period.preset, TEMPLATE_NAMES[kind], template.template.language, record.phoneNumberId, record.wabaId, ledger.id, companyId, requestKey, sendAgainAfter, kind === "statement" ? period?.keyDay || today() : "", user.id, at, at,
      );
      for (const person of plotted.people) {
        if (!person.id || store.get("SELECT 1 AS found FROM wa_jobs WHERE batch_id = ? AND account_id = ?", batchId, person.id)) continue;
        store.run(
          "INSERT INTO wa_jobs (id, batch_id, account_id, account_name, phone_e164, template, lang, period_from, period_to, state, skip_reason, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)",
          newId("waj"), batchId, person.id, person.name, person.phone, TEMPLATE_NAMES[kind], template.template.language, plotted.period.from, plotted.period.to, person.skip ? "skipped" : "pending", person.skip, at, at,
        );
      }
      if (inherit) {
        // İş Q2: kaynağın bağı şirket dosyasında da (taşınan veride aynı kural — ilke 5; göç v44).
        store.run("UPDATE wa_jobs SET inherit_of = ? WHERE batch_id = ? AND account_id = ? AND state = 'pending'", inherit.id, batchId, inherit.account_id);
        inheritContent(batchId, inherit.id, at);
      }
    });
    if (inherit) {
      const target = store.get("SELECT id FROM wa_jobs WHERE batch_id = ? AND inherit_of = ?", batchId, inherit.id);
      if (target) ledger.anywayLink({ jobId: target.id, sourceJobId: inherit.id, at });
    }
    audit(user, "whatsapp.batch.created", batchId, { kind, period: plotted.period, total: summary.total, sendable: summary.sendable, skipped: summary.skipped });
    notify(batchId);
    kick();
    return { batch: batchView(batchRow(batchId)), summary, reused: false };
  }

  // ---------- Toplu iş eylemleri ----------
  const editable = id => {
    const row = batchRow(String(id || "").slice(0, 80));
    if (!row) fail(404, "Toplu gönderim bulunamadı.", "whatsapp-batch-missing");
    return row;
  };
  // Duraklayan toplu işte bekleyenler "Duraklatıldı" (§7a 13); sürünce yeniden "Bekliyor" (sınır / 24 saat bekleme zamanları korunur).
  const holdJobs = batchId => store.run("UPDATE wa_jobs SET state = 'paused', updated_at = ? WHERE batch_id = ? AND state IN ('pending', 'limited')", iso(), batchId);
  const releaseJobs = batchId => store.run("UPDATE wa_jobs SET state = 'pending', updated_at = ? WHERE batch_id = ? AND state = 'paused'", iso(), batchId);
  function pause(user, id) {
    const row = editable(id);
    if (row.state !== "running") fail(409, "Yalnız süren gönderim duraklatılır.", "whatsapp-batch-state");
    store.tx(() => {
      holdJobs(row.id);
      updateBatch(row.id, { state: "paused", pause_code: "user", pause_reason: "Kullanıcı duraklattı." });
    });
    audit(user, "whatsapp.batch.paused", row.id, {});
    notify(row.id);
    return batchView(batchRow(row.id));
  }
  function resume(user, id) {
    const row = editable(id);
    if (row.state !== "paused") fail(409, "Yalnız duraklatılmış gönderim sürdürülür.", "whatsapp-batch-state");
    if (!writable()) fail(403, "Program salt okunur çalışıyor; WhatsApp gönderimi sürdürülemez.", "LICENSE_READ_ONLY");
    // T2-8 (plan §1 + §7a 28): onay (ve firma adı) yokken Devam Et de reddedilir — başlatmayla aynı engel.
    const block = startBlock();
    if (block) fail(409, block.message, block.code);
    const state = ledger.batchState(row.id);
    if (!state.live) {
      stopBatch(row, "Bu toplu gönderim bu bilgisayarın gönderim defterinde açık değil (veri yedekten geri yüklenmiş ya da başka bilgisayardan taşınmış olabilir); yeniden başlatılmaz. Gerekirse yeni gönderim başlatın.", state.opened ? "restored" : "moved");
      fail(409, "Bu toplu gönderim geri yüklenen ya da taşınan veriye ait; sürdürülemez. Gerekirse yeni gönderim başlatın.", "whatsapp-batch-moved");
    }
    const record = connection.read();
    if (!record || record.wabaId !== row.waba_id || record.phoneNumberId !== row.phone_number_id) fail(409, "WhatsApp bağlantısı bu gönderim başladıktan sonra değişti; bu gönderim sürdürülemez, yeni gönderim başlatın.", "whatsapp-batch-connection");
    store.tx(() => {
      releaseJobs(row.id);
      updateBatch(row.id, { state: "running", pause_code: "", pause_reason: "", troubles: 0, retry_at: null, offline_tries: 0 });
    });
    lockTroubles.delete(row.id); // İş O2: "art arda" sayacı sıfırlanan her yerde bellekteki kilit sayacı da
    templateCache.clear();
    audit(user, "whatsapp.batch.resumed", row.id, { from: row.pause_code });
    notify(row.id);
    kick();
    return batchView(batchRow(row.id));
  }
  function cancel(user, id) {
    const row = editable(id);
    if (!["running", "paused"].includes(row.state)) fail(409, "Bu gönderim zaten bitmiş.", "whatsapp-batch-state");
    store.tx(() => {
      store.run("UPDATE wa_jobs SET state = 'canceled', closed_at = ?, updated_at = ? WHERE batch_id = ? AND state IN ('pending', 'limited', 'preparing', 'paused', 'held')", iso(), iso(), row.id);
      updateBatch(row.id, { state: "canceled", finished_at: iso() });
    });
    ledger.stopBatch(row.id, companyId, "canceled", iso());
    audit(user, "whatsapp.batch.canceled", row.id, {});
    notify(row.id);
    kick();
    return batchView(batchRow(row.id));
  }
  // Yeniden deneme / Yine de Gönder AYNI toplu işin dönemindedir (KULLANICI KARARI T2-1 A + 31.10 "a"): kayıtlı dönem preset'iyle birlikte taşınır (dar kontrol 4 ORTA-1);
  // asıl işin "Yine de Gönder" kararı da (send_again_after; dar kontrol 5 ORTA-1, KULLANICI KARARI 31.10.2026 "a şıkkı").
  const periodOfRow = row => ({ from: row.period_from || "", to: row.period_to || "", preset: row.preset || "", sendAgainAfter: row.send_again_after || "", keyDay: row.kind === "statement" ? keyDayOfBatch(row) : "" });
  // Başarısızları Yeniden Dene: yalnız kesin Başarısız işlerin carileri YENİ toplu işle (eski işler kayıtta kalır). Kabul edilmiş iş girmez.
  async function retryFailed(user, id, body = {}) {
    const row = editable(id);
    const ids = store.all("SELECT account_id AS id FROM wa_jobs WHERE batch_id = ? AND state = 'failed' ORDER BY rowid", row.id).map(item => item.id);
    if (!ids.length) fail(400, "Bu gönderimde yeniden denenecek başarısız ileti yok.", "whatsapp-nothing");
    return createBatch(user, { kind: row.kind, ids, requestId: body.requestId }, { period: { ...periodOfRow(row), retry: true } });
  }
  // T1 P6 (S3 A + §7a 15; BAŞ MİMAR KARARI): "Yine de Gönder" AYNI iletiyi yeniden gönderir — yeni iş belirsiz işin dondurulmuş değişkenlerini ve (29 gün geçerliyse)
  // Meta'daki PDF'ini devralır: PDF yeniden yüklenmez, iki ileti de aynı içeriği taşır (ikisi birden ulaşsa da çelişmez). PDF'in TEK sahibi artık yeni iştir: belirsiz
  // işin medya kaydı boşaltılır, yeni iş kesinleşince bakım turu Meta'dan bir kez siler (belirsiz iş hiç kesinleşmeyebileceği için silme ona bağlanmaz).
  function inheritContent(batchId, sourceId, at) {
    const source = jobRow(sourceId);
    const target = source ? store.get("SELECT * FROM wa_jobs WHERE batch_id = ? AND account_id = ? AND state = 'pending'", batchId, source.account_id) : null;
    if (!source || !target || source.state !== "uncertain" || !source.prepared_at) return;
    const media = mediaUsable(source);
    store.run(
      "UPDATE wa_jobs SET prepared_at = ?, params_json = ?, pdf_name = ?, media_id = ?, media_at = ?, updated_at = ? WHERE id = ?",
      source.prepared_at, source.params_json, source.pdf_name, media ? source.media_id : null, media ? source.media_at : null, at, target.id,
    );
    if (media) store.run("UPDATE wa_jobs SET media_id = NULL, media_at = NULL, updated_at = ? WHERE id = ?", at, source.id);
  }
  // Sonucu Belirsiz iş için "Yine de Gönder": kullanıcı çift gidebileceğini onaylar (confirm: true) → o cariye yeni iş.
  async function sendAnyway(user, jobId, body = {}) {
    const job = jobRow(String(jobId || "").slice(0, 80));
    if (!job) fail(404, "Gönderim bulunamadı.", "whatsapp-job-missing");
    if (job.state !== "uncertain") fail(409, "Yalnız sonucu belirsiz ileti yeniden gönderilir.", "whatsapp-job-state");
    if (body.confirm !== true) fail(409, "İletinin Meta'ya ulaşıp ulaşmadığı bilinmiyor; yeniden gönderilirse kişiye iki kez gidebilir. Onaylıyorsanız yeniden isteyin.", "whatsapp-confirm-required");
    const row = batchRow(job.batch_id);
    const result = await createBatch(user, { kind: row.kind, ids: [job.account_id], requestId: body.requestId }, { inherit: job, period: periodOfRow(row) });
    audit(user, "whatsapp.job.send-anyway", job.id, { batchId: result.batch.id });
    return result;
  }

  // ---------- İşçi ----------
  function stopBatch(row, reason, code) {
    store.tx(() => {
      store.run("UPDATE wa_jobs SET state = 'stopped', skip_reason = ?, closed_at = ?, updated_at = ? WHERE batch_id = ? AND state IN ('pending', 'limited', 'preparing', 'paused', 'held')", reason, iso(), iso(), row.id);
      updateBatch(row.id, { state: "stopped", pause_code: code, pause_reason: reason, finished_at: iso() });
    });
    ledger.stopBatch(row.id, companyId, code, iso());
    log.warn?.(`WhatsApp toplu gönderim durduruldu (${row.id}): ${reason}`);
    notify(row.id);
  }
  function pauseBatch(row, code, reason) {
    // T2 dar kontrol D1: kullanıcının iptal ettiği ya da geri yüklemenin durdurduğu toplu iş (ör. istek sürerken İptal Et, sonra Meta 131031 / 190) yeniden
    // "Duraklatıldı" yapılmaz. "Tamamlandı" duraklatılabilir: tek işlik toplu işte hatayı alan iş Başarısız olunca toplu iş önce kapanır, neden yine görünmeli (§7a 13).
    if (["canceled", "stopped"].includes(batchRow(row.id)?.state)) return;
    store.tx(() => {
      holdJobs(row.id);
      updateBatch(row.id, { state: "paused", pause_code: code, pause_reason: reason });
    });
    audit(null, "whatsapp.batch.paused", row.id, { code, reason });
    log.warn?.(`WhatsApp toplu gönderim duraklatıldı (${row.id}): ${reason}`);
    notify(row.id);
  }
  // "5 kez art arda" (§7a 15): geçici hata, belirsiz sonuç ve medya yükleme hataları sayar; başarılı gönderim sıfırlar. Dönüş: duraklatıldı mı.
  function trouble(row, reason, { local = false } = {}) {
    const troubles = (row.troubles || 0) + 1;
    updateBatch(row.id, { troubles });
    if (troubles < MAX_TROUBLES) return false;
    if (local) pauseBatch({ ...row, troubles }, "local", `Gönderim art arda ${MAX_TROUBLES} kez bu bilgisayarda yürütülemedi (son: ${reason}). Diskte boş yer olduğunu denetleyip Devam Et'e basın.`);
    else pauseBatch({ ...row, troubles }, "meta-unreachable", `Meta'ya art arda ${MAX_TROUBLES} kez ulaşılamadı ya da Meta geçici hata verdi (son: ${reason}). İnternet bağlantısını denetleyip Devam Et'e basın.`);
    return true;
  }
  // T6-B1/B2: iş yürütülürken Meta DIŞI hata — ileti isteği GİTMEMİŞTİR (defter talebi "Gönderiliyor"dan sonra; o aşamadaki hatalar kendi yolunda). İş bellekte bekletilir
  // (30 sn → 2 dk → 15 dk, en çok) — yazım düşse de meşgul döngü / her turda yeni PDF yüklemesi olmaz; dosyaya da "Bekliyor" + bekleme yazılmaya çalışılır (yazılamazsa
  // "Hazırlanıyor"da kalan iş bakım turunda / açılışta Bekliyor'a döner); toplu işin "art arda" sayacı artar (5'te "Duraklatıldı").
  const DEFERRABLE = ["pending", "limited", "held", "preparing"];
  // İş N (T6 yeniden koşusu Ü2, ORTA gerileme): dosya KİLİTLİYKEN (SQLITE_BUSY / LOCKED) her yazım denemesi busy_timeout (10 sn) boyunca olay döngüsünü tutar; ilk yazım
  // kilitle düştüyse aynı turda başka yazım denenmez — bekleme bellekte (localDefer), toplu işin "art arda" sayacı bellekte artar (lockTroubles) ve kilit kalkınca ilk
  // yazılabilen sayaçla birlikte yazılır; işin başarılı yürütülmesi (troubles: 0) bellekteki sayacı da sıfırlar. Disk dolu ve öbür hatalar bugünkü gibi (T6-B1/B2).
  const lockTroubles = new Map(); // toplu iş → kilit yüzünden yazılamamış "art arda" sayısı
  const mediaDeletedPending = new Map(); // iş → Meta'da silinme anı (kayıt kilit yüzünden yazılamadı; İş O1)
  function deferLocal(batchId, jobId, error) {
    const tries = (localDefer.get(jobId)?.tries || 0) + 1;
    const waitMs = JOB_BACKOFF_MS[Math.min(tries, JOB_BACKOFF_MS.length) - 1];
    localDefer.set(jobId, { tries, until: nowMs() + waitMs });
    const reason = `şirket dosyasına yazılamadı ya da beklenmeyen hata: ${error?.code || error?.message || error}`;
    if (isLockError(error)) {
      writeLock?.mark(companyId); // İş P1: sonraki arka plan turları bu şirkete yazmayı denemez (işaret süresince)
      syncLockNote(); // İş P2: ekrandaki neden
      if (batchId) lockTroubles.set(batchId, (lockTroubles.get(batchId) || 0) + 1);
      log.warn?.(`WhatsApp işi yürütülemedi (${jobId}; şirket dosyası kilitli); ${Math.round(waitMs / 1000)} sn sonra yeniden denenecek.`);
      if (batchId) notify(batchId);
      return { did: true, deferred: true };
    }
    try {
      store.run(
        `UPDATE wa_jobs SET state = CASE WHEN state = 'preparing' THEN 'pending' ELSE state END, next_at = ?, sending_at = NULL, updated_at = ? WHERE id = ? AND state IN (${DEFERRABLE.map(() => "?").join(",")})`,
        iso(nowMs() + waitMs),
        iso(),
        jobId,
        ...DEFERRABLE,
      );
    } catch {
      // yazılamadı (disk dolu / kilit): bellekteki bekleme geçerli
    }
    try {
      const row = batchRow(batchId);
      if (row?.state === "running") {
        const pending = lockTroubles.get(batchId) || 0;
        trouble({ ...row, troubles: (row.troubles || 0) + pending }, reason, { local: true });
        lockTroubles.delete(batchId); // yazıldı (yazım düşerse yukarıdaki satır hata atar, sayaç bellekte kalır)
      }
    } catch {
      // sayaç yazılamadı
    }
    log.warn?.(`WhatsApp işi yürütülemedi (${jobId}; ${error?.message || error}); ${Math.round(waitMs / 1000)} sn sonra yeniden denenecek.`);
    if (batchId) notify(batchId);
    return { did: true, deferred: true };
  }
  // Sınır: bu WABA'nın bu şirketteki süren işlerinde, pencerede olmayan numaraya giden bekleyen işler pencere açılana dek bekler.
  // T2 dar kontrol D2: "Meta Bekletti" (held) iş de bekleme bitene dek ileri alınır (durumu korunur) — yoksa işçi aynı işi her turda yeniden seçerdi (boş döngü);
  // zaten aynı beklemedeki satır yeniden yazılmaz.
  function markLimited(wabaId, until, phones = null) {
    const rows = store.all("SELECT j.id, j.phone_e164 AS phone, j.state, j.next_at FROM wa_jobs j JOIN wa_batches b ON b.id = j.batch_id WHERE b.waba_id = ? AND b.state = 'running' AND j.state IN ('pending', 'limited', 'held')", wabaId);
    store.tx(() => {
      for (const row of rows) {
        if (phones?.has(row.phone)) continue;
        if (row.state === "held") {
          if (!row.next_at || row.next_at < until) updateJob(row.id, { next_at: until });
        } else if (!(row.state === "limited" && row.next_at === until)) updateJob(row.id, { state: "limited", next_at: until });
      }
    });
  }

  /** Sıradaki iş (şimdi yürütülebilir) ya da beklenecek süre. Sıra: toplu iş açılış sırası, içinde seçim sırası (§7a 5). */
  function next() {
    const t = iso();
    // T6-B1/B2: bellekteki beklemesi dolmamış iş seçilmez (dosyaya yazılamamış olsa da).
    const nowT = nowMs();
    const deferred = [...localDefer].filter(([, item]) => item.until > nowT).map(([id]) => id);
    const notDeferred = deferred.length ? ` AND j.id NOT IN (${deferred.map(() => "?").join(",")})` : "";
    const row = store.get(
      `SELECT j.id FROM wa_jobs j JOIN wa_batches b ON b.id = j.batch_id WHERE b.state = 'running' AND (b.retry_at IS NULL OR b.retry_at <= ?)
       AND j.state IN ('pending', 'limited', 'held') AND (j.next_at IS NULL OR j.next_at <= ?)${notDeferred} ORDER BY b.created_at, b.rowid, j.rowid LIMIT 1`,
      t,
      t,
      ...deferred,
    );
    if (row) return { jobId: row.id };
    // En yakın uyanış: işin kendi beklemesi ya da toplu işin bağlantı beklemesi (hangisi geç ise); bellekteki beklemeler de.
    const soon = store.get(
      `SELECT MIN(MAX(COALESCE(j.next_at, ''), COALESCE(b.retry_at, ''))) AS at FROM wa_jobs j JOIN wa_batches b ON b.id = j.batch_id
      WHERE b.state = 'running' AND j.state IN ('pending', 'limited', 'held') AND (j.next_at IS NOT NULL OR b.retry_at IS NOT NULL)${notDeferred}`,
      ...deferred,
    )?.at;
    const waits = deferred.map(id => localDefer.get(id).until - nowT);
    if (soon) waits.push(Math.max(0, Date.parse(soon) - nowT));
    return { jobId: null, waitMs: waits.length ? Math.min(...waits) : null };
  }

  // T2-2 (bağımsız gözden geçirme r1): bekleme noktasından (Meta okuması, PDF yükleme) sonra iş ve toplu iş YENİDEN okunur. Dönüş { job, batch } (toplu iş sürüyor,
  // iş beklenen durumda ve beklemesi dolmuş) ya da null — o zaman işe dokunulmaz: İptal Et / geri yükleme işi zaten kapatmıştır; Duraklat yalnız Bekliyor /
  // Sınır'dakileri tutar, "Hazırlanıyor"da kalan iş burada "Duraklatıldı"ya geçer (Devam Et onu yeniden Bekliyor yapar).
  function stillRunning(jobId, states) {
    const current = jobRow(jobId);
    const row = current ? batchRow(current.batch_id) : null;
    if (current && row?.state === "running" && states.includes(current.state) && !(current.next_at && current.next_at > iso())) return { job: current, batch: row };
    if (current && row?.state === "paused" && current.state === "preparing") updateJob(current.id, { state: "paused", next_at: null });
    if (row) notify(row.id);
    return null;
  }

  // T1 B3–B5 (kâhin karşılaştırması GUV-03/08, SINIR-02, SABLON-PAZARLAMA-ARADA, OLCEK-04): yürütülebilir iş yokken de SÜREN toplu işler denetlenir — sınırda /
  // 131049 beklemesinde / yeniden denemeyi bekleyen işi olanlar: lisans salt okunura düştüyse "Lisans Nedeniyle Durdu" (plan §4, §7a 25: kendiliğinden SÜRMEZ),
  // onay / firma adı / bağlantı (T2-8 ile aynı engeller), şablon kategorisi + içeriği R2 aralığıyla (her 100 iletide / en geç 10 dakikada; §7a 27), Meta sınır
  // basamağı 6 saatte bir (§6 W2) — basamak yükseldiyse sınırda bekleyenler erkenden bırakılır (yeni sınırı yine işçinin pencere denetimi uygular). "Bağlantı
  // Bekleniyor"daki toplu işte Meta okunmaz (R1). Okuma düşerse en erken 1 dk sonra yeniden. Dönüş: { acted, waitMs } (en yakın denetim anı).
  const WATCH_RETRY_MS = 60_000;
  const watchTried = new Map(); // `${waba}|${şablon}` / `tier|${waba}` → son deneme (ms)
  async function watch() {
    let acted = false;
    let soon = null;
    const consider = at => {
      if (Number.isFinite(at)) soon = soon === null ? at : Math.min(soon, at);
    };
    const due = (key, at, span) => (!Number.isFinite(at) || nowMs() < at || nowMs() - at >= span) && !(nowMs() - (watchTried.get(key) ?? -Infinity) < WATCH_RETRY_MS && nowMs() >= (watchTried.get(key) ?? 0));
    for (const batch of store.all("SELECT * FROM wa_batches WHERE state = 'running' ORDER BY created_at, rowid")) {
      const waiting = store.get("SELECT COUNT(*) AS n, COALESCE(SUM(CASE WHEN state = 'limited' THEN 1 ELSE 0 END), 0) AS limited FROM wa_jobs WHERE batch_id = ? AND state IN ('pending', 'limited', 'held')", batch.id);
      if (!waiting.n || !ledger.batchState(batch.id).live) continue;
      if (!writable()) {
        pauseBatch(batch, "license", LICENSE_PAUSE);
        acted = true;
        continue;
      }
      const block = startBlock();
      if (block) {
        pauseBatch(batch, block.pauseCode, block.pauseReason);
        acted = true;
        continue;
      }
      const record = connection.read();
      if (!record || record.wabaId !== batch.waba_id || record.phoneNumberId !== batch.phone_number_id) {
        pauseBatch(batch, "connection", "WhatsApp bağlantısı kaldırıldı ya da değişti; gönderim duraklatıldı.");
        acted = true;
        continue;
      }
      if (batch.pause_code === "offline") continue;
      const key = `${batch.waba_id}|${batch.template}`;
      const cached = templateCache.get(key);
      if (due(key, cached?.at, TEMPLATE_CHECK_MS) || (cached && cached.sent >= TEMPLATE_CHECK_EVERY)) {
        watchTried.set(key, nowMs());
        let result = null;
        try {
          result = await checkTemplate(record, batch.template, { force: true });
        } catch (error) {
          if (!(error instanceof MetaGraphError) && !(error instanceof HttpError)) throw error;
        }
        if (result && !result.ok) {
          pauseBatch(batch, result.code, result.reason);
          acted = true;
          continue;
        }
      }
      consider(Math.max((templateCache.get(key)?.at ?? -Infinity) + TEMPLATE_CHECK_MS, (watchTried.get(key) ?? -Infinity) + WATCH_RETRY_MS));
      if (waiting.limited) {
        const tierKey = `tier|${batch.waba_id}`;
        const tier = tierCache.get(batch.waba_id);
        if (due(tierKey, tier?.at, TIER_CHECK_MS)) {
          watchTried.set(tierKey, nowMs());
          const before = tier?.limit;
          try {
            await dailyLimit(connection.client().graph, record, { force: true });
          } catch (error) {
            if (!(error instanceof MetaGraphError) && !(error instanceof HttpError)) throw error;
          }
          const after = tierCache.get(batch.waba_id)?.limit;
          const raised = before !== undefined && after !== undefined && (after === Infinity ? before !== Infinity : Number.isFinite(before) && Number.isFinite(after) && after > before);
          if (raised) {
            store.run("UPDATE wa_jobs SET state = 'pending', next_at = NULL, updated_at = ? WHERE state = 'limited' AND batch_id IN (SELECT id FROM wa_batches WHERE waba_id = ? AND state = 'running')", iso(), batch.waba_id);
            log.info?.(`WhatsApp sınır basamağı yükseldi (${batch.waba_id}): sınırda bekleyen iletiler sürüyor.`);
            notify(batch.id);
            acted = true;
          }
        }
        consider(Math.max((tierCache.get(batch.waba_id)?.at ?? -Infinity) + TIER_CHECK_MS, (watchTried.get(tierKey) ?? -Infinity) + WATCH_RETRY_MS));
      }
    }
    return { acted, waitMs: soon === null ? null : Math.max(0, soon - nowMs()) };
  }

  async function step() {
    const pick = next();
    if (!pick.jobId) {
      const watched = await watch();
      if (watched.acted) return { did: true };
      const waits = [pick.waitMs, watched.waitMs].filter(Number.isFinite);
      return { did: false, waitMs: waits.length ? Math.min(...waits) : null };
    }
    inFlight = pick.jobId;
    try {
      return await runJob(pick.jobId);
    } catch (error) {
      // T6-B1/B2: Meta DIŞI hata (yazım, disk, kilit, beklenmeyen) — iş henüz ileti isteği aşamasına gelmediyse güvenli duruma döner ve BEKLEMELİ yeniden denenir.
      // "Gönderiliyor" / "Sonucu Belirsiz" (istek aşaması) kendi yolunda çözülür (defter; bakım turu 5 dk kuralı) — hata yukarı gider.
      let row = null;
      try {
        row = jobRow(pick.jobId);
      } catch {
        throw error;
      }
      if (!row || !DEFERRABLE.includes(row.state)) throw error;
      return deferLocal(row.batch_id, row.id, error);
    } finally {
      inFlight = null;
    }
  }

  async function runJob(jobId) {
    let job = jobRow(jobId);
    const batch = batchRow(job.batch_id);
    // (5) geri yüklenen / taşınan veri: defterde canlı olmayan toplu iş yürütülmez.
    const live = ledger.batchState(batch.id);
    if (!live.live || batch.ledger_id !== ledger.id || batch.company_id !== companyId) {
      const moved = !live.opened || batch.ledger_id !== ledger.id || batch.company_id !== companyId;
      stopBatch(batch, moved ? "Taşınan Veri — Durduruldu: bu toplu gönderim bu bilgisayarın gönderim defterinde yok; gönderilmemiş kişilere gönderilmedi." : "Durduruldu (Geri Yükleme): yedekten geri yükleme / Şirket Verisini Sıfırla sonrası eski gönderim yeniden başlatılmaz.", moved ? "moved" : "restored");
      return { did: true };
    }
    if (!writable()) {
      // §7a 25: lisans yeniden yazılabilir olunca kendiliğinden SÜRMEZ (Devam Et).
      pauseBatch(batch, "license", LICENSE_PAUSE);
      return { did: true };
    }
    const record = connection.read();
    if (!record || record.wabaId !== batch.waba_id || record.phoneNumberId !== batch.phone_number_id) {
      pauseBatch(batch, "connection", "WhatsApp bağlantısı kaldırıldı ya da değişti; gönderim duraklatıldı.");
      return { did: true };
    }
    // T2-8: Gönderim Onayı kaldırıldı / firma adı silindi → süren toplu iş duraklar (kendiliğinden SÜRMEZ; Devam Et).
    const block = startBlock();
    if (block) {
      pauseBatch(batch, block.pauseCode, block.pauseReason);
      return { did: true };
    }
    let graph;
    try {
      ({ graph } = connection.client());
    } catch (error) {
      pauseBatch(batch, "token", error.message);
      return { did: true };
    }
    // Şablon (R2: her 100 iletide / en geç 10 dk; §7a 27) ve sınır basamağı (6 saatte bir).
    let limitInfo;
    let language = batch.lang;
    let template = null;
    let checkError = null;
    try {
      template = await checkTemplate(record, batch.template);
      if (template.ok) limitInfo = await dailyLimit(graph, record);
    } catch (error) {
      if (!(error instanceof MetaGraphError)) throw error;
      checkError = error;
    }
    // T2-2: Meta okuması beklenirken kullanıcı İptal Et / Duraklat'a basmış olabilir — iş ve toplu iş YENİDEN okunur; artık yürütülemiyorsa dokunulmaz.
    const afterCheck = stillRunning(job.id, ["pending", "limited", "held"]);
    if (!afterCheck) return { did: true };
    job = afterCheck.job;
    if (checkError) {
      handleFailure(afterCheck.batch, job, checkError, { stage: "check" });
      return { did: true };
    }
    if (!template.ok) {
      pauseBatch(afterCheck.batch, template.code, template.reason);
      return { did: true };
    }
    language = template.template.language || batch.lang;
    // ---------- Hazırlanıyor: cari GÖNDERİM ANINDA okunur (§7a 1, 2) ----------
    const user = userFor(batch.created_by);
    let account = null;
    try {
      account = accounts().detail(job.account_id, user);
    } catch {
      account = null;
    }
    const check = account ? eligibility(account, batch.kind) : { skip: "Cari Silinmiş", phone: { e164: job.phone_e164 } };
    if (check.skip) {
      updateJob(job.id, { state: "skipped", skip_reason: check.skip, closed_at: iso(), next_at: null });
      finishIfDone(batch.id);
      return { did: true };
    }
    const phone = check.phone.e164;
    if (phone !== job.phone_e164 || account.name !== job.account_name) updateJob(job.id, { phone_e164: phone, account_name: account.name });
    job = jobRow(job.id);
    // GÜNLÜK SINIR (kayan 24 saat, farklı kişi; penceresinde zaten sayılmış alıcı GEÇER — §7a 4) ve Meta sınır beklemesi (aynı WABA'nın bütün işleri — §7a 30).
    const hold = ledger.holdOf(batch.waba_id, iso());
    if (hold) {
      markLimited(batch.waba_id, hold);
      notify(batch.id);
      return { did: true, limited: true };
    }
    const window = usage(batch.waba_id);
    if (limitInfo.limit !== Infinity && !window.phones.has(phone) && window.count >= limitInfo.limit) {
      const until = iso(Math.max(nowMs() + 1000, Date.parse(window.oldest || iso()) + DAY_MS + 1000));
      markLimited(batch.waba_id, until, window.phones);
      notify(batch.id);
      return { did: true, limited: true };
    }
    updateJob(job.id, { state: "preparing", next_at: null });
    let prepared;
    let prepareError = null;
    try {
      prepared = await prepare(batch, job, graph, record, account, user);
    } catch (error) {
      prepareError = error;
    }
    // T2-2: PDF yüklenirken İptal Et / Duraklat / geri yükleme olmuş olabilir — Meta'ya ileti isteğinden HEMEN ÖNCE iş ve toplu iş yeniden okunur (buradan
    // isteğe dek bekleme noktası yok: defter talebi ve durum yazımları eşzamanlı). İptal edilen işin yüklenmiş PDF'i işte kayıtlıdır; kesin durumda olduğu için
    // bakım turu Meta'dan siler (S3 A). Duraklatılan iş "Duraklatıldı"ya geçer; Devam Et'te aynı PDF yeniden kullanılır (§7a 15).
    const ready = stillRunning(job.id, ["preparing"]);
    if (!ready) {
      if (prepareError && !(prepareError instanceof MetaGraphError)) log.warn?.(`WhatsApp işi hazırlanamadı (${job.id}; iş artık yürütülmüyor): ${prepareError.message}`);
      return { did: true };
    }
    job = ready.job;
    // T2-8: onay PDF yüklenirken kaldırılmış olabilir — ileti isteğinden hemen önce yeniden denetlenir; iş Bekliyor'a döner, toplu iş duraklar.
    const lateBlock = startBlock();
    if (lateBlock) {
      updateJob(job.id, { state: "pending" });
      pauseBatch(ready.batch, lateBlock.pauseCode, lateBlock.pauseReason);
      return { did: true };
    }
    if (prepareError) {
      updateJob(job.id, { state: "pending" });
      if (!(prepareError instanceof MetaGraphError)) throw prepareError;
      handleFailure(ready.batch, jobRow(job.id), prepareError, { stage: "media" });
      return { did: true };
    }
    if (prepared.skip) {
      updateJob(job.id, { state: "skipped", skip_reason: prepared.skip, closed_at: iso() });
      finishIfDone(batch.id);
      return { did: true };
    }
    // ---------- Gönderiliyor (istekten ÖNCE yazılır) ----------
    const attempt = (job.attempt || 0) + 1;
    // T2 dar kontrol ORTA-2: önceki denemenin wamid'i işte kalmaz (eski denemenin bildirimi yeni denemeyle eşleşmesin; sonucu belirsiz yeni deneme imzalı kancayla çözülebilsin).
    updateJob(job.id, { state: "sending", attempt, sending_at: iso(), wamid: null });
    let claim;
    try {
      injected("ledger-claim", job);
      const batchPeriod = { from: batch.period_from, to: batch.period_to, preset: batch.preset };
      const keyDay = keyDayOfBatch(batch);
      // İş Q1: "Tüm Hareketler"de talebin anahtar kümesine kişinin dönemi (ilk hareket – dönem sonu; iletideki metinle aynı kaynak) girer.
      const first = firstOfAll(batchPeriod, account?.ledger || []);
      claim = ledger.claim({ jobId: job.id, attempt, batchId: batch.id, companyId, wabaId: batch.waba_id, phone, accountId: job.account_id, kind: batch.kind, periodKey: periodKeyOf(batch.kind, batchPeriod, keyDay), periodKeys: periodKeysOf(batch.kind, batchPeriod, keyDay, { first }), at: iso() });
    } catch (error) {
      // Defter yazılamadı (disk dolu, kilit): istek GÖNDERİLMEZ, iş bekler. Kilitse sonraki arka plan turları deftere yazmayı denemez (İş P1 işareti).
      if (isLockError(error)) {
        writeLock?.mark(LEDGER_LOCK_KEY);
        syncLockNote(); // İş R3: ekranda defter cümlesi
      }
      updateJob(job.id, { state: "pending", attempt: job.attempt || 0, sending_at: null, next_at: iso(nowMs() + JOB_BACKOFF_MS[0]) });
      trouble(batchRow(batch.id), `gönderim defteri yazılamadı (${error.code || error.message})`);
      log.warn?.(`WhatsApp gönderim defteri yazılamadı (${job.id}): ${error.message}`);
      return { did: true };
    }
    if (!claim.ok) {
      // Önceki deneme kabul edilmiş ya da sonucu belirsiz: ikinci kez gönderilmez.
      const accepted = claim.previous.outcome === "accepted";
      // İş R4: accepted_at = SON kabul edilen denemenin anı (defterdeki o denemenin kabulü; önceki denemenin eski değeri değil).
      updateJob(job.id, accepted ? { state: "accepted", attempt: claim.previous.attempt, wamid: claim.previous.wamid || null, accepted_at: claim.previous.at || iso() } : { state: "uncertain", attempt: claim.previous.attempt, error_text: "Bu iletinin önceki gönderim denemesinin sonucu bilinmiyor; ikinci kez gönderilmedi." });
      finishIfDone(batch.id);
      return { did: true };
    }
    let sent;
    try {
      sent = await graph.sendTemplate(batch.phone_number_id, { to: phone, name: batch.template, language, components: prepared.components, bizOpaque: job.id });
    } catch (error) {
      if (!(error instanceof MetaGraphError)) {
        ledger.outcome({ jobId: job.id, attempt, outcome: "uncertain", at: iso(), companyId, wabaId: batch.waba_id });
        updateJob(job.id, { state: "uncertain", error_text: "Gönderim sırasında beklenmeyen hata; iletinin gidip gitmediği bilinmiyor." });
        throw error;
      }
      handleFailure(batch, jobRow(job.id), error, { stage: "send", attempt });
      return { did: true };
    }
    // Önce makine defteri (kesinti olursa açılışta defterden kabul okunur), sonra şirket dosyası. Başarılı işin hata kodu temizlenir (§7a 32).
    ledger.outcome({ jobId: job.id, attempt, outcome: "accepted", wamid: sent.wamid, at: iso(), companyId, wabaId: batch.waba_id });
    const checked = templateCache.get(`${batch.waba_id}|${batch.template}`);
    if (checked) checked.sent += 1; // R2: her 100 iletide şablon yeniden okunur
    injected("db-accept", job);
    store.tx(() => {
      updateJob(job.id, { state: "accepted", wamid: sent.wamid, accepted_at: iso(), error_code: null, error_text: "", next_at: null });
      updateBatch(batch.id, { troubles: 0, ...connectionBack() });
      lockTroubles.delete(batch.id);
    });
    localDefer.delete(job.id);
    finishIfDone(batch.id);
    notify(batch.id);
    return { did: true, sent: true };
  }

  // Meta'daki PDF kopyası yeniden kullanılabilir mi (§7a 15): kimliği var, 29 günü dolmadı, silinmedi.
  const mediaUsable = job => Boolean(job.media_id && job.media_at && !job.media_deleted_at && nowMs() - Date.parse(job.media_at) <= MEDIA_REUSE_MS);
  // T2-6 (bağımsız gözden geçirme r3): değişkenler ve PDF İLK HAZIRLIKTA AYNI cari okumasından üretilir ve DONDURULUR (prepared_at, params_json, pdf_name,
  // pdf_blob — göç v41); her yeniden deneme (131056, geçici hata, Bağlantı Bekleniyor, 131049, Duraklat → Devam Et) aynı metni ve aynı PDF'i gönderir (metin = PDF,
  // §7a 1; aynı medya, §7a 14–15). Meta'daki kopya geçerliyse (29 gün, silinmemiş) aynısı, değilse dondurulmuş baytlar yeniden yüklenir. Uygunluk (İstemiyor, pasif,
  // silinmiş, telefon; hatırlatmada gecikmiş borç) her denemede GÜNCEL okunur (§7a 2): içerik donar, gönderilip gönderilmeyeceği donmaz.
  async function prepare(batch, job, graph, record, account, user) {
    if (batch.kind !== "statement" && !overdueOf(account, today())) return { skip: "Gecikmiş Borç Yok" };
    let params = job.prepared_at ? parse(job.params_json, null) : null;
    let pdf = job.prepared_at && job.pdf_blob ? Buffer.from(job.pdf_blob) : null;
    let filename = job.pdf_name || "";
    // Dondurulmuş PDF baytları iş Meta'ya kabul edilince silinir (bakım); 131049 / Yine de Gönder sonrası yeniden denemede Meta'daki kopya geçerliyse o yeter.
    const frozen = Array.isArray(params) && params.length > 0 && (batch.kind !== "statement" || Boolean(filename && (pdf?.length || mediaUsable(job))));
    if (!frozen) {
      const office = cleanParam(store.setting("office.name", "") || "");
      const name = cleanParam(account.name);
      if (batch.kind === "statement") {
        const range = { from: batch.period_from, to: batch.period_to };
        const data = statementData(account, range);
        params = [name, office, periodText(range, account.ledger || []), balanceText(data.closing)];
        // eslint-disable-next-line no-control-regex
        filename = statementFileName(data, today()).replace(/[\\/:*?"<>|\u0000-\u001f]+/g, " ");
        pdf = Buffer.from(statementPdf(data, { today: today(), now: now(), userName: user.display_name || user.username || "", header: header() }));
      } else {
        const overdue = overdueOf(account, today());
        params = [name, office, dayText(overdue.dueDate), moneyText(overdue.amount), balanceText(account.totals.balance)];
        filename = "";
        pdf = null;
      }
      // Yeni anlık görüntü: önceki bir denemenin Meta'daki kopyası (varsa) bu içeriğe ait sayılmaz → yeniden yüklenir.
      updateJob(job.id, { prepared_at: iso(), params_json: JSON.stringify(params), pdf_name: filename, pdf_blob: pdf, ...(job.media_id ? { media_id: null, media_at: null } : {}) });
      job = jobRow(job.id);
    }
    let document = null;
    if (batch.kind === "statement") {
      let mediaId = job.media_id;
      if (!mediaUsable(job)) {
        mediaId = await graph.uploadMedia(record.phoneNumberId, { data: pdf, filename, mime: "application/pdf" });
        try {
          updateJob(job.id, { media_id: mediaId, media_at: iso(), media_deleted_at: null, media_delete_tries: 0 });
        } catch (error) {
          // T6-B2 (S3 A): yüklenen PDF'in kimliği kaydedilemedi (disk dolu, kilit) — Meta'da sahipsiz kalmasın: bellekteki kimlikle HEMEN silinmeye çalışılır.
          try {
            await graph.deleteMedia(mediaId);
          } catch (deleteError) {
            log.warn?.(`WhatsApp: kaydedilemeyen PDF Meta'dan silinemedi (${job.id}; ${deleteError.message}); Meta 30 günde kendisi düşürür.`);
          }
          throw error;
        }
      }
      document = { id: mediaId, filename };
    }
    const components = [];
    if (document) components.push({ type: "header", parameters: [{ type: "document", document }] });
    components.push({ type: "body", parameters: params.map(text => ({ type: "text", text })) });
    return { components };
  }

  // Hata sınıfı → davranış (plan §6 W2 + §7a 10–15, 30; kod listeleri META_D0).
  function classOf(code) {
    if (!Number.isFinite(code)) return "job";
    if (META_D0.limitCodes.includes(code)) return "limit";
    if (code === META_D0.pairRateCode) return "pair";
    if (code === META_D0.ecosystemCode) return "ecosystem";
    if (META_D0.tempCodes.includes(code)) return "temporary";
    if (META_D0.pauseCodes.includes(code) || (code >= 200 && code <= 299)) return "pause";
    return "job"; // jobFailCodes ve TANINMAYAN kod: o iş Başarısız (kodlu), toplu iş sürer (§7a 12)
  }
  // R1: "Bağlantı Bekleniyor" — toplu iş SÜRER (Devam Et gerekmez) ama bekleme bitene dek bu toplu işin hiçbir işi denenmez (wa_batches.retry_at); bekleme 30 sn →
  // 1 dk → 2 dk → 5 dk (en çok). İşin deneme sayacı ve toplu işin "art arda 5" sayacı ARTMAZ (Meta yanıt vermedi; ileti gitmedi ya da yalnız okuma/yükleme düştü).
  function waitForConnection(row, job, text) {
    const tries = (row.offline_tries || 0) + 1;
    const waitMs = OFFLINE_BACKOFF_MS[Math.min(tries, OFFLINE_BACKOFF_MS.length) - 1];
    store.tx(() => {
      updateJob(job.id, { state: "pending", next_at: null, sending_at: null });
      updateBatch(row.id, { pause_code: "offline", pause_reason: `${OFFLINE_LABEL}: Meta'ya ulaşılamıyor (${text}). İnternet bağlantısı dönünce gönderim kendiliğinden sürer.`, retry_at: iso(nowMs() + waitMs), offline_tries: tries });
    });
    if (tries === 1) log.warn?.(`WhatsApp toplu gönderim bağlantı bekliyor (${row.id}): ${text}`);
    notify(row.id);
  }
  const connectionBack = () => ({ pause_code: "", pause_reason: "", retry_at: null, offline_tries: 0 });

  function handleFailure(batch, job, error, options) {
    applyFailure(batch, job, error, options);
    // T2-2: ileti isteği sürerken toplu iş iptal edildi / durduruldu: yeniden denemeye dönen iş (Bekliyor / Sınır / Meta Bekletti) kapanmış toplu işte asılı kalmaz.
    const row = batchRow(batch.id);
    if (row && ["canceled", "stopped"].includes(row.state)) {
      store.run("UPDATE wa_jobs SET state = ?, closed_at = ?, updated_at = ? WHERE id = ? AND state IN ('pending', 'limited', 'preparing', 'paused', 'held')", row.state, iso(), iso(), job.id);
    }
  }
  function applyFailure(batch, job, error, { stage, attempt = null }) {
    const row = batchRow(batch.id);
    const reachedMeta = error.reason === "meta";
    const record = outcome => {
      if (stage === "send" && attempt) ledger.outcome({ jobId: job.id, attempt, outcome, at: iso(), companyId, wabaId: batch.waba_id });
    };
    const failJob = (code, text) => {
      updateJob(job.id, { state: "failed", error_code: Number.isFinite(code) ? code : null, error_text: text, failed_at: iso(), closed_at: iso(), next_at: null });
      finishIfDone(batch.id);
    };
    // Geçici: iş 30 sn → 2 dk → 15 dk bekler, 3 denemeden sonra Başarısız (§7a 15).
    const retryLater = (code, text) => {
      const tries = (job.temp_tries || 0) + 1;
      if (tries > JOB_BACKOFF_MS.length) failJob(code, `${text} (${JOB_BACKOFF_MS.length} kez yeniden denendi)`);
      else updateJob(job.id, { state: "pending", temp_tries: tries, next_at: iso(nowMs() + JOB_BACKOFF_MS[tries - 1]), error_code: Number.isFinite(code) ? code : null, error_text: text });
      // T1 P4 (§7a 13): art arda 5. geçici hatada toplu iş duraklar — hatayı ALAN iş "Başarısız" (kodlu), bekleyenler "Duraklatıldı".
      if (trouble(row, text) && tries <= JOB_BACKOFF_MS.length) failJob(code, `${text} (art arda ${MAX_TROUBLES} geçici hata; toplu iş duraklatıldı)`);
    };
    // Okuma (şablon listesi, sınır basamağı) Meta'nın geçici hatasıyla yapılamadı: işin kendi deneme hakkı harcanmaz; iş bekler, toplu işin sayacı artar.
    const checkLater = text => {
      const troubles = (row.troubles || 0) + 1;
      updateJob(job.id, { state: "pending", next_at: iso(nowMs() + JOB_BACKOFF_MS[Math.min(troubles, JOB_BACKOFF_MS.length) - 1]) });
      trouble(row, text);
    };
    // Yanıtsız ileti isteği (zaman aşımı, bağlantı koptu, gövdesiz 5xx): SONUCU BELİRSİZ — kendiliğinden yeniden gönderilmez; toplu iş sürer (§7a 10).
    if (!reachedMeta && !neverReachedMeta(error) && stage === "send") {
      record("uncertain");
      updateJob(job.id, { state: "uncertain", error_code: null, error_text: error.message });
      trouble(row, error.message);
      finishIfDone(batch.id);
      return;
    }
    if (!reachedMeta) {
      if (stage === "send") {
        // İstek Meta'ya hiç ulaşmadı (ad çözülemedi, bağlantı reddedildi): ileti gitmedi; deneme defterde "gitmedi".
        record("failed");
        updateJob(job.id, { attempt });
      }
      if (["graph-off", "token"].includes(error.reason)) return pauseBatch(row, "token", error.message);
      // R1 (plan §7a revizyonu; §7a 11 + 15): Meta'ya ulaşılamıyor (internet yok) ya da okuma / PDF yükleme yanıtsız — iş Başarısız SAYILMAZ, deneme sayacı ARTMAZ:
      // toplu iş "Bağlantı Bekleniyor" diye bekler, bağlantı dönünce kendiliğinden sürer.
      return waitForConnection(row, job, error.message);
    }
    // Meta yanıt verdi: bağlantı var (Bağlantı Bekleniyor kalkar).
    if (row.pause_code === "offline") updateBatch(row.id, connectionBack());
    // Meta reddetti (ileti kabul edilmedi).
    record("failed");
    const code = Number(error.code);
    const known = classifyMetaCode(code);
    const kind = classOf(code);
    // Okuma (şablon, sınır) aşamasında alıcıya / bu iletiye özgü sınıf yoktur: geçici değilse toplu iş duraklar (iş bekler).
    if (stage === "check") {
      if (kind === "temporary") return checkLater(error.message);
      if (known?.kind === "template") templateCache.clear();
      return pauseBatch(row, known?.kind ? `meta-${known.kind}` : "meta", error.message);
    }
    if (kind === "limit") {
      // §7a 30: aynı WABA'nın BÜTÜN işleri (iki şirket de) 24 saat bekler.
      const until = iso(nowMs() + DAY_MS);
      ledger.holdWaba(batch.waba_id, until, `meta-${code}`, iso());
      updateJob(job.id, { state: "limited", next_at: until, error_code: code, error_text: error.message });
      markLimited(batch.waba_id, until);
      notify(batch.id);
      return;
    }
    if (kind === "pair") {
      updateJob(job.id, { state: "pending", next_at: iso(nowMs() + 60_000), error_code: code, error_text: error.message });
      return;
    }
    if (kind === "ecosystem") {
      // §7a 14: "Meta Bekletti (24 Saat Sonra Yeniden)", en çok bir kez; PDF silinmez, aynı medya yeniden kullanılır.
      if (job.retry_131049) return failJob(code, error.message);
      updateJob(job.id, { state: "held", next_at: iso(nowMs() + DAY_MS), retry_131049: 1, error_code: code, error_text: error.message });
      return;
    }
    if (kind === "temporary") return retryLater(code, error.message);
    if (kind === "pause") {
      // §7a 13: hatayı alan iş Başarısız (kodlu), bekleyenler Duraklatıldı.
      failJob(code, error.message);
      if (known?.kind === "template") templateCache.clear();
      pauseBatch(batchRow(batch.id), known?.kind ? `meta-${known.kind}` : "meta", error.message);
      return;
    }
    failJob(code, error.message);
  }

  function finishIfDone(batchId) {
    const row = batchRow(batchId);
    if (!row || row.state !== "running") return;
    const open = store.get(`SELECT COUNT(*) AS n FROM wa_jobs WHERE batch_id = ? AND state IN (${OPEN_JOB.map(() => "?").join(",")})`, batchId, ...OPEN_JOB).n;
    if (open) return;
    updateBatch(batchId, { state: "done", finished_at: iso() });
    ledger.stopBatch(batchId, companyId, "done", iso());
    notify(batchId, { done: true });
  }

  // ---------- Açılış (program yeniden açıldı) ----------
  // "Gönderiliyor"da kalmış işin sonucu makine defterinden: talep yok → istek gitmedi (Bekliyor); kabul → Meta Kabul Etti; talep var sonuç yok → Sonucu Belirsiz.
  // Toplu iş bu bilgisayarın defterinde AÇILMAMIŞ (recover'ın "Taşınan Veri" koşulu ile aynı).
  function movedHere(batchId) {
    const row = store.get("SELECT ledger_id, company_id FROM wa_batches WHERE id = ?", batchId);
    return !row || row.ledger_id !== ledger.id || row.company_id !== companyId || !ledger.batchState(batchId).opened;
  }
  function settleSending(jobs) {
    const out = { sendingToPending: 0, sendingToAccepted: 0, sendingToUncertain: 0 };
    for (const job of jobs) {
      const attempt = ledger.attempts(job.id).find(item => item.attempt === job.attempt);
      if (!attempt && movedHere(job.batch_id)) {
        // İş Q3 (dar kontrol 10 DÜŞÜK-3; ilke 2 + 5): toplu iş bu bilgisayarın defterinde açılmamış (veri başka bilgisayardan / defteri silinmiş kurulumdan geldi) →
        // talebin yokluğu "istek gitmedi" demek DEĞİL: ileti öbür bilgisayardan gitmiş olabilir. Sonucu Belirsiz (deneme numarası korunur); kendiliğinden yeniden
        // gönderilmez, yeni gönderim kişiyi "Sonucu Belirsiz" ile eler (taşınan veri yolu), göndermek için işteki Yine de Gönder. Test: whatsapp-q3-tasinan-gonderiliyor-248.
        updateJob(job.id, { state: "uncertain", error_text: "Gönderim başka bilgisayarda sürerken veri taşındı; iletinin Meta'ya ulaşıp ulaşmadığı bilinmiyor." });
        out.sendingToUncertain += 1;
      } else if (!attempt) {
        updateJob(job.id, { state: "pending", attempt: Math.max(0, (job.attempt || 1) - 1), sending_at: null });
        out.sendingToPending += 1;
      } else if (attempt.outcome === "accepted") {
        // İş R4: kabul anı defterdeki o denemenin kabulü (2. denemede 1. denemenin accepted_at'i kalmaz); yoksa denemenin gönderim anı.
        updateJob(job.id, { state: "accepted", wamid: attempt.wamid || null, accepted_at: attempt.at || job.sending_at || iso(), error_code: null, error_text: "" });
        out.sendingToAccepted += 1;
      } else if (attempt.outcome === "failed") {
        updateJob(job.id, { state: "pending" });
        out.sendingToPending += 1;
      } else {
        // Talep var, sonuç yok (istek sürerken program kapandı / elektrik gitti): Sonucu Belirsiz — kendiliğinden yeniden gönderilmez.
        if (!attempt.outcome) ledger.outcome({ jobId: job.id, attempt: job.attempt, outcome: "uncertain", at: iso(), companyId, wabaId: store.get("SELECT waba_id FROM wa_batches WHERE id = ?", job.batch_id)?.waba_id || "" });
        updateJob(job.id, { state: "uncertain", error_text: "Gönderim sırasında program kapandı; iletinin Meta'ya ulaşıp ulaşmadığı bilinmiyor." });
        out.sendingToUncertain += 1;
      }
    }
    return out;
  }
  function recover() {
    const out = { resetPreparing: 0, stopped: 0, stale: 0 };
    for (const job of store.all("SELECT id FROM wa_jobs WHERE state = 'preparing'")) {
      updateJob(job.id, { state: "pending" });
      out.resetPreparing += 1;
    }
    Object.assign(out, settleSending(store.all("SELECT * FROM wa_jobs WHERE state = 'sending'")));
    for (const row of store.all("SELECT * FROM wa_batches WHERE state IN ('running', 'paused')")) {
      const state = ledger.batchState(row.id);
      if (!state.opened || row.ledger_id !== ledger.id || row.company_id !== companyId) {
        // Bu bilgisayarın defteri bu toplu işi hiç görmedi: veri başka bilgisayardan (ya da defteri silinmiş kurulumdan) geldi.
        stopBatch(row, "Taşınan Veri — Durduruldu: bu toplu gönderim bu bilgisayarın gönderim defterinde yok (veri başka bilgisayardan taşınmış olabilir); gönderilmemiş kişilere gönderilmedi.", "moved");
        out.stopped += 1;
        continue;
      }
      if (state.stopped) {
        // §7a 26: defterde durmuş (geri yükleme, sıfırlama, bu bilgisayarda bitmiş/iptal edilmiş) ama dosyada sürüyor görünen iş: dosya ESKİ (yedekten geri yüklendi).
        const text = ["done", "canceled"].includes(state.reason)
          ? "Durduruldu (Geri Yükleme): bu toplu gönderim bu bilgisayarda zaten bitmişti; yedekteki eski işler yeniden başlatılmaz."
          : "Durduruldu (Geri Yükleme): yedekten geri yükleme / Şirket Verisini Sıfırla sonrası eski gönderim yeniden başlatılmaz.";
        stopBatch(row, text, "restored");
        out.stopped += 1;
        continue;
      }
      // §7a 24: 24 saatten eski toplu iş — yalnız SINIR nedeniyle bekleyen iş kendiliğinden sürer; başka nedenle (program kapalı kaldı) bekleyen iş varsa sorulur.
      const waiting = store.get("SELECT COUNT(*) AS n FROM wa_jobs WHERE batch_id = ? AND state IN ('pending', 'preparing')", row.id).n;
      if (row.state === "running" && waiting && nowMs() - Date.parse(row.created_at) > STALE_BATCH_MS) {
        pauseBatch(row, "stale", "24 saatten eski toplu gönderim program açılışında kendiliğinden sürdürülmedi; Devam Et ya da İptal Et.");
        out.stale += 1;
      }
    }
    return out;
  }

  // ---------- Bakım: süre dolumu (§7a 16), medya silme (S3 A), takılı "Gönderiliyor" ----------
  async function maintain() {
    const out = { expired: 0, mediaDeleted: 0, mediaFailed: 0 };
    // Bildirim yolu çalışıyorsa (son 7 günde bu şirkete en az bir durum bildirimi geldi) teslim edilmeyen ileti TTL + 1 saatte "Süresi Doldu"; yoksa "Meta Kabul Etti"de kalır.
    // T2-3/4: bildirim yolu WABA düzeyinde (makine defteri hook_seen; aynı WABA'yı kullanan şirketlerin hepsi için) ya da bu şirketin son bildirimi.
    const seenWaba = Date.parse(ledger.hookSeenAt?.(connection.read()?.wabaId || "") || "");
    const seenHere = Date.parse(store.setting(HOOK_SEEN_KEY, "") || "");
    const seen = Math.max(Number.isFinite(seenWaba) ? seenWaba : -Infinity, Number.isFinite(seenHere) ? seenHere : -Infinity);
    // T2-5 güvenli taraf: TTL = META'NIN KABUL ETTİĞİ ileti ömrü (lib/whatsapp/templates.mjs deliveryTtlSeconds; okunamazsa / reddedildiyse Meta'nın varsayılanı 30 gün) —
    // ayardaki değer değil: Meta'nın hâlâ teslim etmeye çalıştığı iletiyi "Süresi Doldu" saymaz, PDF'ini önceden silmez.
    const ttlOf = new Map();
    const ttlMs = (wabaId, name) => {
      const key = `${wabaId}|${name}`;
      if (!ttlOf.has(key)) ttlOf.set(key, deliveryTtlSeconds(store, wabaId, name) * 1000);
      return ttlOf.get(key);
    };
    if (Number.isFinite(seen) && nowMs() - seen <= HOOK_ALIVE_MS) {
      for (const row of store.all("SELECT j.id, j.attempt, j.accepted_at, b.waba_id, b.template FROM wa_jobs j JOIN wa_batches b ON b.id = j.batch_id WHERE j.state IN ('accepted', 'sent') AND j.accepted_at IS NOT NULL")) {
        if (Date.parse(row.accepted_at) + ttlMs(row.waba_id, row.template) + HOUR >= nowMs()) continue;
        updateJob(row.id, { state: "expired", closed_at: iso() });
        // KULLANICI KARARI P3 = SAYILMAZ (31.10.2026): Meta teslim edemedi → defterde "teslim edilemedi" (Başarısız gibi): "Daha Önce Gönderildi" (R3) saymaz, çift
        // gönderim kilidi çözülür. Meta sonradan "delivered" bildirirse R3 yine sayar (defter deliveries; lib/whatsapp/defter.mjs sentBefore).
        ledger.deliveryFailed({ jobId: row.id, attempt: row.attempt, at: iso() });
        out.expired += 1;
      }
    }
    // PDF Meta'dan yalnız kesin sonuçta silinir; bildirim yolu çalışmasa da Meta'nın en uzun ömrü (30 gün) + 1 saat geçen kabul edilmiş iletinin PDF'i (Meta artık
    // teslim etmeye çalışmaz; medya kimliği de 30 günde düşer) silinir.
    const doomed = store.all(
      `SELECT j.id, j.media_id, j.media_delete_tries, b.waba_id FROM wa_jobs j JOIN wa_batches b ON b.id = j.batch_id
       WHERE j.media_id IS NOT NULL AND j.media_deleted_at IS NULL AND j.media_delete_tries < 5
         AND (j.state IN (${FINAL.map(() => "?").join(",")}) OR (j.state IN ('accepted', 'sent') AND j.accepted_at IS NOT NULL AND j.accepted_at < ?)) LIMIT 50`,
      ...FINAL,
      iso(nowMs() - META_DEFAULT_TTL_SECONDS * 1000 - HOUR),
    );
    if (doomed.length) {
      const record = connection.read();
      let graph = null;
      try {
        graph = record ? connection.client().graph : null;
      } catch {
        graph = null;
      }
      for (const row of doomed) {
        if (!graph || record.wabaId !== row.waba_id) break;
        // İş O1: Meta'da silinmiş ama kaydı kilit yüzünden yazılamamış PDF — Meta'ya ikinci silme isteği GİTMEZ, yalnız kayıt yazılır.
        if (mediaDeletedPending.has(row.id)) {
          updateJob(row.id, { media_deleted_at: mediaDeletedPending.get(row.id) });
          mediaDeletedPending.delete(row.id);
          out.mediaDeleted += 1;
          continue;
        }
        let deletedAt = null;
        try {
          await graph.deleteMedia(row.media_id);
          deletedAt = iso();
          updateJob(row.id, { media_deleted_at: deletedAt });
          out.mediaDeleted += 1;
        } catch (error) {
          // İş O1 (dar kontrol 11 ORTA-1, İş N kalıbı): media_deleted_at yazımı dosya KİLİDİNE takıldıysa aynı turda ikinci yazım (media_delete_tries) denenmez — tur
          // bırakılır (scheduler bu şirketin işini o turda yürütmez); PDF Meta'da silindi, kayıt kilit kalkınca bir sonraki bakımda yazılır (mediaDeletedPending).
          if (isLockError(error)) {
            if (deletedAt) mediaDeletedPending.set(row.id, deletedAt);
            throw error;
          }
          updateJob(row.id, { media_delete_tries: (row.media_delete_tries || 0) + 1 });
          out.mediaFailed += 1;
          log.warn?.(`WhatsApp: gönderilen PDF Meta'dan silinemedi (${row.id}; ${error.message}); sonra yeniden denenecek.`);
        }
      }
    }
    // T2-6 + plan §5: dondurulmuş PDF (pdf_blob) yalnız iş açıkken (yeniden denenebilirken) tutulur; kabul edilen / kesinleşen işte silinir (değişkenler ve PDF adı kalır).
    store.run(`UPDATE wa_jobs SET pdf_blob = NULL WHERE pdf_blob IS NOT NULL AND state NOT IN (${OPEN_JOB.map(() => "?").join(",")})`, ...OPEN_JOB);
    // Kabul yazımı düşmüş (disk dolu) ve 5 dakikadır "Gönderiliyor"da kalan iş (tek işçi; istek 15 sn'de biter): açılıştaki kuralla defterden çözülür.
    const stuck = store.all("SELECT * FROM wa_jobs WHERE state = 'sending' AND sending_at < ?", iso(nowMs() - 5 * 60_000));
    if (stuck.length) out.repaired = settleSending(stuck);
    // T6-B1: "Hazırlanıyor"da kalan iş (hazırlık sonrası yazım disk dolu / kilit yüzünden düştü; ileti isteği gitmedi — defter talebi "Gönderiliyor"dan sonra) yalnız
    // açılışta değil bakım turunda da Bekliyor'a döner. Bakım işçi turunun içinde koşar (zamanlayıcı runOnce kilidi; aynı anda iş yürütülmez) → bu anda "Hazırlanıyor"daki
    // iş takılıdır; yine de işçinin şu anki işi ve son 30 sn'de yazılan iş hariç tutulur (yer açılınca en geç bir bakım aralığında — 60 sn — sürer).
    for (const row of store.all("SELECT id FROM wa_jobs WHERE state = 'preparing' AND updated_at < ?", iso(nowMs() - PREPARING_STUCK_MS))) {
      if (row.id === inFlight) continue;
      updateJob(row.id, { state: "pending" });
      out.resetPreparing = (out.resetPreparing || 0) + 1;
    }
    // Bellekteki beklemeler: kapanmış işlerinki silinir.
    for (const id of [...localDefer.keys()]) if (!OPEN_JOB.includes(jobRow(id)?.state)) localDefer.delete(id);
    for (const row of store.all("SELECT id FROM wa_batches WHERE state = 'running'")) finishIfDone(row.id);
    // W9 (plan §3 C): durum bildirimi adresi Meta'ya kayıtlı değilse / ofisin uzaktan adresi değiştiyse / kayıt düştüyse (saatte en çok bir kez) kaydedilir.
    // Salt okunur lisansta kaydedilmez (tünel de kapalı).
    if (writable()) {
      try {
        const hook = await connection.ensureHook?.(hookUrl());
        if (hook && !hook.skipped) out.hook = hook;
      } catch (error) {
        log.warn?.(`WhatsApp durum bildirimi adresi kaydedilemedi: ${error.message}`);
      }
    }
    return out;
  }

  // T1 ayıklaması İş M: taşınan veride (bu defterde açılmamış toplu iş) wamid'in işi — kancanın sahip araması için (lib/whatsapp/hook.mjs movedOwnerOf). Dönüş: { wabaId } | null.
  function movedOwnerOfWamid(wamid) {
    if (!wamid) return null;
    const row = store.get("SELECT b.waba_id AS wabaId FROM wa_jobs j JOIN wa_batches b ON b.id = j.batch_id WHERE j.wamid = ? AND b.ledger_id <> ? LIMIT 1", String(wamid), ledger.id);
    return row?.wabaId ? { wabaId: row.wabaId } : null;
  }
  // ---------- Durum bildirimleri (W9; lib/whatsapp/hook.mjs) ----------
  /**
   * statuses: Meta'nın statuses[] öğeleri (D0-15). phoneNumberId: bildirimin geldiği numara (metadata). signed: Meta imzası kapıcıda doğrulandı ve istek kapıcının
   * imzasıyla geldi (Yol 2). Yalnız bu şirketin kaydındaki wamid'ler güncellenir; Sonucu Belirsiz iş YALNIZ imzalı bildirim + iş kimliği (biz_opaque_callback_data)
   * eşleşince çözülür (§7a 3); bilinmeyen / imzasız eşleşmeyen olay düşer. Durum yalnız ileri gider (§7a 17–18); yinelenen bildirim etkisizdir.
   */
  /**
   * Dar kontrol 8 DÜŞÜK-1 (P3 "geç teslim sayılır"): Meta Bekletti (131049) ile BIRAKILMIŞ eski denemenin wamid'ine sonradan "delivered" / "read" gelir; iş o arada
   * 2. denemeye geçtiği için (wamid işten silinir) wamid'le bulunamaz. Deneme bu şirketin defterindeyse ve bırakılmışsa (releases) işin durumuna DOKUNULMADAN yalnız defter
   * teslimi (deliveries) yazılır: R3 kişiyi sayar, "Bu Ay" sayacı teslimi görür. Başka şirketin / bilinmeyen / bırakılmamış denemenin wamid'i düşer.
   */
  function lateDeliveryOfReleased(wamid, status, at, phoneNumberId) {
    const owner = ledger.attemptOfWamid?.(wamid);
    if (!owner) return false;
    if (ledger.companyOfWamid?.(wamid)?.companyId !== companyId) return false;
    const attempt = ledger.attempts(owner.jobId).find(item => item.attempt === owner.attempt);
    const row = jobRow(owner.jobId);
    // İş Q4: iş dosyada YOKKEN kabul edilmiş denemenin geç teslimi de yazılır (Bu Ay Gönderilen İleti Sayısı = teslim; R3 zaten kabulden sayar).
    if (attempt?.outcome !== "released" && !(attempt?.outcome === "accepted" && !row)) return false;
    // KULLANICI KARARI ("KİME KAÇ KEZ" ilkesi, S3): iş şirket dosyasında YOKSA (Şirket Verisini Sıfırla wa_jobs'u siler) geç teslim yine sayılır (kesin aldı) — WABA
    // defterdeki talepten; şirket denetimi yukarıda (companyOfWamid).
    if (!row) {
      const owned = ledger.companyOfWamid?.(wamid);
      const billable = status?.pricing && typeof status.pricing === "object" && "billable" in status.pricing ? status.pricing.billable !== false : true;
      return Boolean(owned?.wabaId) && ledger.delivered({ jobId: owner.jobId, companyId, wabaId: owned.wabaId, billable, at });
    }
    if (Number(row.attempt) <= Number(owner.attempt)) return false;
    const batch = batchRow(row.batch_id);
    if (!batch || (phoneNumberId && batch.phone_number_id !== String(phoneNumberId))) return false;
    const billable = status?.pricing && typeof status.pricing === "object" && "billable" in status.pricing ? status.pricing.billable !== false : row.billable !== 0;
    if (!ledger.delivered({ jobId: row.id, companyId, wabaId: batch.waba_id, billable, at })) return false;
    notify(row.batch_id);
    return true;
  }
  // İş Q4 (dar kontrol 10 DÜŞÜK-4; "KİME KAÇ KEZ" ilkesi 3): iş şirket dosyasında YOK (Şirket Verisini Sıfırla wa_jobs'u siler) ve defterdeki SON denemesinin sonucu
  // belli değil (Sonucu Belirsiz / sonuçsuz talep) → İMZALI bildirim (kanca gizli yolu + biz_opaque_callback_data = iş kimliği) o denemenin sonucunu defterde kapatır:
  // wamid o denemeye bağlanır (learnWamid) ve kabul yazılır (lateAccept); "delivered" / "read" → teslim (R3 "Daha Önce Gönderildi"), "failed" → teslim edilemedi
  // (yeniden gönderilebilir). Şirket dosyasına yazım YOK (iş yok). İmzasız bildirim bu yolu açmaz (P5 aynen: iş kimliği doğrulanmamış). Yalnız bu şirketin talebi
  // (claims.company_id). wamid başka denemeye / işe bağlıysa dokunulmaz. Test: test/whatsapp-q4-dosyasiz-imzali-248.test.mjs.
  function lateResultOfMissingJob(status, wamid, value, at) {
    const jobId = String(status?.biz_opaque_callback_data || "").slice(0, 120);
    if (!jobId || !wamid || !["sent", "delivered", "read", "failed"].includes(value) || jobRow(jobId)) return false;
    const owned = ledger.companyOfJob?.(jobId);
    if (!owned || owned.companyId !== companyId || !owned.wabaId) return false;
    const last = ledger.attempts(jobId).at(-1);
    if (!last || (last.outcome && last.outcome !== "uncertain")) return false;
    const bound = ledger.attemptOfWamid?.(wamid);
    if (bound && (bound.jobId !== jobId || bound.attempt !== last.attempt)) return false;
    let applied = false;
    if (!bound) {
      if (!ledger.learnWamid?.({ jobId, attempt: last.attempt, wamid, at })) return false;
      ledger.lateAccept({ jobId, attempt: last.attempt, wamid, companyId, wabaId: owned.wabaId, at });
      applied = true;
    }
    if (["delivered", "read"].includes(value)) {
      const billable = status?.pricing && typeof status.pricing === "object" && "billable" in status.pricing ? status.pricing.billable !== false : true;
      applied = ledger.delivered({ jobId, companyId, wabaId: owned.wabaId, billable, at }) || applied;
    } else if (value === "failed" && !ledger.deliveredJob?.(jobId)) {
      // §7a 18: teslimden SONRA gelen failed yok sayılır. Meta Bekletti (131049) de burada teslim edilemedi sayılır: iş dosyada yok, 24 saat sonraki deneme olmaz.
      applied = ledger.deliveryFailed({ jobId, attempt: last.attempt, at }) || applied;
    }
    return applied;
  }
  // İş R7 (dar kontrol 12 DÜŞÜK, Q4 komşusu; ilke 1 + KULLANICI KARARLARI 31.10 ~10:10 / ~11:00): iş şirket dosyasında YOK (Şirket Verisini Sıfırla) ve wamid defterde BU
  // şirketin işinin SON denemesine bağlı (eşzamanlı kabulün wamid'i ya da imzalı bildirimle öğrenilmiş) → teslimden önce gelen "failed" (131026, 131049 dahil — iş dosyada
  // olmadığından 24 saat sonraki deneme YOK) defterde "teslim edilemedi": kişi "Daha Önce Gönderildi" sayılmaz, yeni gönderim gider. İmzalı ve imzasız (wamid'in bağı
  // Meta'nın eşzamanlı yanıtından / imzalı bildirimden; lateDeliveryOfReleased ile aynı güven). Teslimden sonra gelen failed yok sayılır (§7a 18).
  // Test: test/whatsapp-q4-dosyasiz-imzali-248.test.mjs ("R7").
  function lateFailureOfMissingJob(wamid, value, at) {
    if (value !== "failed" || !wamid) return false;
    const owner = ledger.attemptOfWamid?.(wamid);
    if (!owner || jobRow(owner.jobId)) return false;
    if (ledger.companyOfWamid?.(wamid)?.companyId !== companyId) return false;
    const last = ledger.attempts(owner.jobId).at(-1);
    if (!last || last.attempt !== owner.attempt || ["failed", "released"].includes(last.outcome)) return false;
    if (ledger.deliveredJob?.(owner.jobId)) return false;
    return ledger.deliveryFailed({ jobId: owner.jobId, attempt: owner.attempt, at });
  }
  function applyStatuses(statuses = [], { phoneNumberId = "", signed = false } = {}) {
    const out = { applied: 0, ignored: 0, unknown: 0 };
    store.setSetting(HOOK_SEEN_KEY, iso());
    for (const status of Array.isArray(statuses) ? statuses : []) {
      const wamid = String(status?.id || "").slice(0, 200);
      const value = String(status?.status || "").toLowerCase();
      const at = Number.isFinite(Number(status?.timestamp)) && Number(status.timestamp) > 0 ? new Date(Number(status.timestamp) * 1000).toISOString() : iso();
      let job = wamid ? store.get("SELECT * FROM wa_jobs WHERE wamid = ?", wamid) : null;
      if (!job && signed) {
        const opaque = String(status?.biz_opaque_callback_data || "").slice(0, 120);
        const candidate = opaque ? jobRow(opaque) : null;
        if (candidate && ["uncertain", "sending"].includes(candidate.state) && !candidate.wamid) job = candidate;
      }
      if (!job) {
        if (wamid && ["delivered", "read"].includes(value) && lateDeliveryOfReleased(wamid, status, at, phoneNumberId)) out.applied += 1;
        else if (lateFailureOfMissingJob(wamid, value, at)) out.applied += 1;
        else if (signed && lateResultOfMissingJob(status, wamid, value, at)) out.applied += 1;
        else out.unknown += 1;
        continue;
      }
      // T2 dar kontrol ORTA-2: wamid'in AİT OLDUĞU deneme defterden okunur — işin şimdiki denemesi değilse (eski denemenin yinelenen bildirimi) işin durumu ve kilidi
      // DEĞİŞMEZ.
      const owner = wamid ? ledger.attemptOfWamid?.(wamid) : null;
      if (owner && (owner.jobId !== job.id || owner.attempt !== job.attempt)) {
        out.ignored += 1;
        continue;
      }
      const batch = batchRow(job.batch_id);
      if (!batch || (phoneNumberId && batch.phone_number_id !== String(phoneNumberId))) {
        out.ignored += 1;
        continue;
      }
      const current = job.state;
      const fields = {};
      let reopenedHere = false; // dar kontrol 2 DÜŞÜK-1: bu bildirim defterde toplu işi yeniden açtı mı (dosya yazımı düşerse telafi)
      const resolving = ["uncertain", "sending"].includes(current);
      if (resolving && wamid) fields.wamid = wamid;
      // İş 5 (KULLANICI KARARI 31.10.2026 "a"): Meta Bekletti'de (131049) iken İptal Et ile durdurulan işin kabul edilmiş iletisi sonradan teslim edildiyse geç
      // "delivered" / "read" uygulanır (P3'ün geç teslim kuralı; defter deliveries → R3 sayar). Yalnız bu işin KENDİ wamid'iyle (yukarıdaki sahip denetimi).
      // Dar kontrol 8 DÜŞÜK-5 (KULLANICI KARARI 31.10.2026 ~11:00 UTC "A"): yedekten geri yükleme / taşıma ile "Durduruldu" olan Meta Bekletti işi de (iptalden ÖNCEKİ
      // yedek geri yüklenince dosyadaki iş "stopped" olur) aynı kuralla.
      const lateAfterHold = ["canceled", "stopped"].includes(current) && job.retry_131049 === 1 && Boolean(job.wamid) && wamid === job.wamid;
      if (value === "sent") {
        if (resolving || current === "accepted") Object.assign(fields, { state: "sent", sent_at: at });
      } else if (value === "delivered") {
        if (resolving || lateAfterHold || ["accepted", "sent", "expired"].includes(current)) Object.assign(fields, { state: "delivered", delivered_at: at, sent_at: job.sent_at || at, closed_at: iso() });
      } else if (value === "read") {
        if (resolving || lateAfterHold || ["accepted", "sent", "delivered", "expired"].includes(current)) Object.assign(fields, { state: "read", read_at: at, delivered_at: job.delivered_at || at, sent_at: job.sent_at || at, closed_at: iso() });
      } else if (value === "failed") {
        // §7a 18: delivered / read'den SONRA gelen failed yok sayılır.
        if (resolving || ["accepted", "sent", "expired"].includes(current)) {
          const first = Array.isArray(status.errors) ? status.errors[0] : null;
          const code = Number(first?.code);
          const known = Number.isFinite(code) ? classifyMetaCode(code) : null;
          const text = known?.title || String(first?.error_data?.details || first?.message || first?.title || "İleti teslim edilemedi.").slice(0, 300);
          const errorText = Number.isFinite(code) ? `${text} (Meta hata kodu ${code})` : text;
          // T1 B2 (plan §6 W2 + §7a 14): 131049 kancayla da gelir (eşzamanlı yanıtla aynı kural) — ilk kez "Meta Bekletti (24 Saat Sonra Yeniden)": PDF silinmez,
          // 24 saat sonra BİR kez aynı medyayla yeniden; ikinci 131049 Başarısız.
          // Tamamlanmış toplu iş defterde yeniden açılır (ORTA-1: sonraki durdurma / iptal defterde doğru kaydedilir); açılamazsa (iptal / geri yükleme / yazılamadı) Başarısız.
          const heldBatch = batchRow(job.batch_id);
          const canHold =
            code === META_D0.ecosystemCode && !job.retry_131049 && (["running", "paused"].includes(heldBatch?.state) || (heldBatch?.state === "done" && (reopenedHere = ledger.reopenBatch(heldBatch.id, companyId, iso()))));
          if (canHold) Object.assign(fields, { state: "held", next_at: iso(nowMs() + DAY_MS), retry_131049: 1, error_code: code, error_text: errorText });
          else Object.assign(fields, { state: "failed", failed_at: at, closed_at: iso(), error_code: Number.isFinite(code) ? code : null, error_text: errorText });
        }
      }
      // İş R4 + R8 (dar kontrol 12): sonucu belirsiz deneme bildirimle kabul edilmiş çıkınca accepted_at O denemenin anı (bildirimin zamanı = defterde lateAccept /
      // learnWamid'e yazılan an; Q5 "son kabul anı"). Önce 1. denemenin değeri kalıyordu: taşınan veride R3 ayrışıyor, "Süresi Doldu" 1. denemeden ölçülüyordu.
      if (resolving && ["sent", "delivered", "read"].includes(fields.state)) fields.accepted_at = at;
      if (status?.pricing && typeof status.pricing === "object" && "billable" in status.pricing) fields.billable = status.pricing.billable === false ? 0 : 1;
      // Dar kontrol 2 ORTA-A: Sonucu Belirsiz denemenin wamid'i (imzalı kanca + iş kimliği) defterde O DENEMEYE bağlanır — şirket dosyasına yazımdan ÖNCE; böylece
      // aynı wamid'in yinelenen bildirimi sonraki denemeye (ör. 131049 sonrası yeniden deneme) yazılmaz.
      if (resolving && wamid) ledger.learnWamid?.({ jobId: job.id, attempt: job.attempt, wamid, at });
      const changed = Boolean(fields.state) && fields.state !== current;
      if (!changed && !("billable" in fields && fields.billable !== job.billable)) {
        out.ignored += 1;
        continue;
      }
      try {
        // Dar kontrol 2 DÜŞÜK-1: Meta Bekletti + "Tamamlandı" toplu işin yeniden "Sürüyor" olması şirket dosyasında TEK işlemde (biri yazılıp öbürü düşmez).
        if (fields.state === "held" && batchRow(job.batch_id)?.state === "done") {
          store.tx(() => {
            updateJob(job.id, fields);
            updateBatch(job.batch_id, { state: "running", finished_at: null });
          });
        } else updateJob(job.id, fields);
      } catch (error) {
        // wamid tekil dizini: aynı wamid başka işte (olmamalı) → olay düşer. Bu bildirim defterde toplu işi yeniden açtıysa telafi: defter dosyayla aynı ("Tamamlandı")
        // kalır; telafi de yazılamazsa sonraki (yinelenen) bildirimde yeniden açma idempotenttir.
        if (reopenedHere) ledger.stopBatch(job.batch_id, companyId, "done", iso());
        log.warn?.(`WhatsApp durum bildirimi yazılamadı (${job.id}): ${error.message}`);
        out.ignored += 1;
        continue;
      }
      const wabaId = batch.waba_id;
      if (resolving && changed) ledger.lateAccept({ jobId: job.id, attempt: job.attempt, wamid: fields.wamid || "", companyId, wabaId, at });
      if (["delivered", "read"].includes(fields.state)) ledger.delivered({ jobId: job.id, companyId, wabaId, billable: fields.billable === undefined ? job.billable !== 0 : fields.billable === 1, at: fields.delivered_at || at });
      if (fields.state === "failed") ledger.deliveryFailed({ jobId: job.id, attempt: job.attempt, at });
      // Bütün işleri kabul edilmiş (Tamamlandı) toplu iş yeniden SÜRER (yukarıda iş yazımıyla aynı işlemde): yalnız bu iş 24 saat sonra bir kez daha gider (çift gönderim
      // kilidi defterde).
      if (fields.state === "held") ledger.released({ jobId: job.id, attempt: job.attempt, at });
      out.applied += 1;
      notify(job.batch_id);
      if (fields.state && ["delivered", "read", "failed"].includes(fields.state)) finishIfDone(job.batch_id);
    }
    return out;
  }

  // ---------- "Bu Ay Gönderilen İleti Sayısı" (§7a 19) ----------
  // = TESLİM edilen (Teslim Edildi + Okundu), ay = teslim zamanı (Türkiye saati), kapsam WABA (makine defteri; geri yüklemede azalmaz). Kendime Deneme sayılmaz.
  function monthStats(month = "") {
    const trNow = new Date(nowMs() + 3 * HOUR).toISOString().slice(0, 7);
    const wanted = /^\d{4}-(0[1-9]|1[0-2])$/.test(String(month)) ? String(month) : trNow;
    const [y, m] = wanted.split("-").map(Number);
    const pad = value => String(value).padStart(2, "0");
    const from = new Date(`${y}-${pad(m)}-01T00:00:00${TR_OFFSET}`).toISOString();
    const to = new Date(`${m === 12 ? y + 1 : y}-${pad(m === 12 ? 1 : m + 1)}-01T00:00:00${TR_OFFSET}`).toISOString();
    const record = connection.read();
    if (!record) return { month: wanted, configured: false, delivered: 0, billable: 0, accepted: 0, approxUsd: 0, unitUsd: UTILITY_USD };
    const result = ledger.monthCounts({ companyId, wabaId: record.wabaId, from, to });
    const usd = value => Math.round(value * UTILITY_USD * 10_000) / 10_000;
    return {
      month: wanted,
      configured: true,
      wabaId: record.wabaId,
      delivered: result.waba.delivered,
      billable: result.waba.billable,
      accepted: result.waba.accepted,
      approxUsd: usd(result.waba.billable),
      unitUsd: UTILITY_USD,
      company: { delivered: result.company.delivered, billable: result.company.billable, accepted: result.company.accepted },
      note: "Teslim edilen ileti sayısıdır (ay: Türkiye saatiyle teslim zamanı; aynı WhatsApp hesabını kullanan bütün şirketler). Yaklaşık ücret ücretli teslim × 0,0009 USD; Meta faturası esastır.",
    };
  }

  // ---------- Ayarlar (bir kez onay, sınır, TTL) ----------
  function setAck(user, value) {
    if (value === true) store.setSetting(ACK_KEY, JSON.stringify({ version: ACK_VERSION, text: ACK_TEXT, at: iso(), by: user.id, byName: user.display_name || user.username || "" }), user.id);
    else store.run("DELETE FROM settings WHERE key = ?", ACK_KEY);
    audit(user, "whatsapp.ack", "whatsapp", { ack: value === true, version: ACK_VERSION });
    return ackView();
  }
  const ackView = () => {
    const current = ack();
    return { text: ACK_TEXT, version: ACK_VERSION, acknowledged: Boolean(current), at: current?.at || null, byName: current?.byName || "" };
  };
  function setSending(user, body = {}) {
    const next = { ...settings() };
    if (Object.hasOwn(body, "dailyCap")) {
      const cap = body.dailyCap === null || body.dailyCap === "" ? null : Number(body.dailyCap);
      if (cap !== null && (!Number.isInteger(cap) || cap < 1 || cap > 1_000_000)) fail(400, "Günlük sınır 1 ile 1.000.000 arasında tam sayı olmalı (boş = Meta'nın sınırı).", "whatsapp-invalid", { field: "dailyCap" });
      next.dailyCap = cap;
    }
    if (Object.hasOwn(body, "ttlHours")) {
      const ttl = Number(body.ttlHours);
      if (!Number.isInteger(ttl) || ttl < 1 || ttl > 720) fail(400, "Teslim süresi 1 ile 720 saat arasında olmalı.", "whatsapp-invalid", { field: "ttlHours" });
      next.ttlHours = ttl;
    }
    store.setSetting(SENDING_KEY, JSON.stringify(next), user.id);
    audit(user, "whatsapp.sending.saved", "whatsapp", next);
    return settings();
  }

  // İş P1: arka plan işçisi bu şirkete şimdi yazabilir mi (turun başında; scheduler.mjs) ve kilit işareti (bakım turunda kilit görülünce).
  // İş P2: işaretin konması ve kalkması ekrana canlı olayla bildirilir (liste ve toplu iş ekranı nedeni hemen gösterir / kaldırır). İşçi her turda canWrite'ı çağırır.
  const syncLockNote = () => {
    const kind = writeLock?.isMarked(companyId) ? "company" : writeLock?.isMarked(LEDGER_LOCK_KEY) ? "ledger" : null;
    if (kind === lockShown) return;
    lockShown = kind;
    notify(null, { lock: kind });
  };

  // İş P1 (c2): makine defteri (whatsapp-gonderim.sqlite) de başka süreçte kilitli olabilir — işçi her işte deftere yazar; aynı kısa sınama + işaret (anahtar defter).
  const canWrite = () => {
    const ok = writeLock ? writeLock.guard(companyId, store) && writeLock.guard(LEDGER_LOCK_KEY, ledger) : true;
    syncLockNote();
    return ok;
  };
  const markLocked = () => {
    writeLock?.mark(companyId);
    syncLockNote();
  };
  return { canWrite, markLocked, connected, preview, createBatch, list, detail, pause, resume, cancel, retryFailed, sendAnyway, next, step, recover, maintain, applyStatuses, movedOwnerOfWamid, monthStats, historyOf, setAck, ackView, ack, setSending, settings, judgeTemplate };
}
