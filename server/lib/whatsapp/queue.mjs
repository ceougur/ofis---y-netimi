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
import { HttpError } from "../http.mjs";
import { roundMoney } from "../money.mjs";
import { dayText } from "../plans.mjs";
import { statementData, statementFileName, statementPdf } from "../statement-pdf.mjs";
import { e164Of, waPresetRange } from "./alici.mjs";
import { DAY_MS } from "./defter.mjs";
import { META_D0, MetaGraphError, classifyMetaCode, neverReachedMeta, tierInfo } from "./meta-graph.mjs";

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
// Kesin durum: medya Meta'dan silinir (S3 A). "Meta Bekletti" kesin değil (aynı medya yeniden kullanılır, §7a 14).
const FINAL = ["delivered", "read", "failed", "expired", "canceled", "skipped", "stopped"];
// Geçici hata: iş 30 sn → 2 dk → 15 dk (3 deneme), sonra Başarısız (§7a 15); toplu işte art arda 5 → duraklar.
const JOB_BACKOFF_MS = [30_000, 120_000, 900_000];
// R1: Meta'ya ulaşılamıyorken toplu işin yeniden deneme beklemesi (iş Başarısız sayılmaz; bağlantı dönünce sürer).
const OFFLINE_BACKOFF_MS = [30_000, 60_000, 120_000, 300_000];
export const OFFLINE_LABEL = "Bağlantı Bekleniyor";
const MAX_TROUBLES = 5;
const HOUR = 3_600_000;
const HOOK_ALIVE_MS = 7 * DAY_MS; // Meta 7 güne kadar yeniden dener (plan §3)
const MEDIA_REUSE_MS = 29 * DAY_MS; // medya kimliği 30 gün geçerli (plan §2.3)
// §7a 27 + R2 (plan §7a revizyonu): şablon kategorisi başlarken, sürerken HER 100 İLETİDE ve EN GEÇ 10 DAKİKADA bir okunur (Pazarlama ücretiyle giden ileti en çok ~100).
const TEMPLATE_CHECK_MS = 10 * 60_000;
const TEMPLATE_CHECK_EVERY = 100;
const TIER_CHECK_MS = 6 * HOUR;
const STALE_BATCH_MS = DAY_MS; // §7a 24: 24 saatten eski toplu iş açılışta sorulur (sınır nedeniyle bekleyen hariç)

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
// Dönem anahtarı (makine defteri; R3 "daha önce gönderildi"): ekstre = dönemin iki ucu; ödeme hatırlatma = gönderim GÜNÜ (BAŞ MİMAR KARARI: hatırlatmanın dönemi yok;
// aynı gün ikinci hatırlatma sorulur, ertesi gün yeni hatırlatma serbest).
const periodKeyOf = (kind, period, day = "") => (kind === "statement" ? `${period.from}|${period.to}` : `gun|${day}`);
// İletideki dönem metni ({{3}}; §7a 21): "01.10.2026 – 31.10.2026"; Tüm Hareketler: ilk hareketten dönem sonuna (bugün).
function periodText(period, lines) {
  if (period.from) return `${dayText(period.from)} – ${dayText(period.to)}`;
  const first = lines.find(line => !period.to || line.date <= period.to)?.date || period.to;
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
export function createWaQueue({ store, companyId, ledger, connection, accounts, now, audit = () => {}, log = console, license = null, header = () => ({}), events = null, kick = () => {}, fault = null, hookUrl = () => "" }) {
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
  function batchView(row, { jobs = false } = {}) {
    if (!row) return null;
    const c = counts(row.id);
    const total = Object.values(c).reduce((sum, n) => sum + n, 0);
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
      createdAt: row.created_at,
      createdByName: actor,
      finishedAt: row.finished_at,
      total,
      counts: c,
      ...(jobs ? { jobs: store.all("SELECT * FROM wa_jobs WHERE batch_id = ? ORDER BY rowid", row.id).map(jobView) } : {}),
    };
  }
  const list = ({ limit = 50 } = {}) => store.all("SELECT * FROM wa_batches ORDER BY created_at DESC, rowid DESC LIMIT ?", Math.min(200, Math.max(1, Number(limit) || 50))).map(row => batchView(row));
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
  function judgeTemplate(items, name) {
    const found = items.filter(item => item?.name === name);
    if (!found.length) return { ok: false, code: "template-missing", reason: `Şablon (${name}) bu WhatsApp Business hesabında yok; şablonlar bağlantıdan sonra program tarafından açılır.` };
    const approved = found.filter(item => String(item.status || "").toUpperCase() === "APPROVED");
    const pick = approved.find(item => item.language === "tr") || approved[0] || found.find(item => item.language === "tr") || found[0];
    const status = String(pick.status || "").toUpperCase();
    const category = String(pick.category || "").toUpperCase();
    const template = { name, language: String(pick.language || ""), status, category };
    if (status !== "APPROVED") {
      const reason = {
        PENDING: `Şablon (${name}) Meta onayını bekliyor; onaylanınca gönderim başlatılabilir.`,
        REJECTED: `Şablon (${name}) Meta tarafından reddedildi.`,
        PAUSED: `Şablon (${name}) düşük kalite nedeniyle Meta tarafından duraklatıldı.`,
        DISABLED: `Şablon (${name}) Meta tarafından kalıcı olarak kapatıldı; yeni şablon gerekir.`,
      }[status] || `Şablon (${name}) onaylı değil (Meta durumu: ${status || "bilinmiyor"}).`;
      return { ok: false, code: `template-${(status || "unknown").toLowerCase()}`, reason, template };
    }
    // Plan §2.4 KATEGORİ RİSKİ + §7a 27: yalnız UTILITY + APPROVED ile gönderilir; pazarlamaya alınmış şablonla gönderim başlamaz / süren iş durur.
    if (category === "MARKETING") return { ok: false, code: "template-marketing", reason: "Şablon Pazarlama'ya Alındı: Meta şablonu pazarlama kategorisine aldı; WhatsApp Yöneticisi'nden yeniden inceleme isteyin. Bu şablonla gönderim yapılmaz.", template };
    if (category !== "UTILITY") return { ok: false, code: "template-category", reason: `Şablonun Meta kategorisi bilgilendirme (Utility) değil (${category || "bilinmiyor"}); gönderim yapılmaz.`, template };
    return { ok: true, template };
  }
  async function checkTemplate(graph, wabaId, name, { force = false } = {}) {
    const key = `${wabaId}|${name}`;
    const cached = templateCache.get(key);
    if (!force && cached && nowMs() - cached.at < TEMPLATE_CHECK_MS && nowMs() >= cached.at && cached.sent < TEMPLATE_CHECK_EVERY) return cached.result;
    const listing = await graph.templates(wabaId);
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
  const metaHttp = error => {
    if (error instanceof HttpError) return error;
    return new HttpError(502, error.message, { code: error.reason === "meta" ? "whatsapp-meta" : "whatsapp-meta-unreachable", meta: error.toJSON?.() });
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
  const queued = (accountId, kind, period) =>
    store.get(`SELECT j.id FROM wa_jobs j JOIN wa_batches b ON b.id = j.batch_id WHERE j.account_id = ? AND b.kind = ? AND b.period_from = ? AND b.period_to = ? AND b.state IN ('running', 'paused') AND j.state IN (${OPEN_JOB.map(() => "?").join(",")}) LIMIT 1`, accountId, kind, period.from, period.to, ...OPEN_JOB);
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
  function plan(user, body) {
    const kind = body.kind === "reminder" ? "reminder" : body.kind === "statement" ? "statement" : null;
    if (!kind) fail(400, "Gönderim türünü seçin (Ekstre ya da Ödeme Hatırlatma).", "whatsapp-invalid", { field: "kind" });
    const period = kind === "statement" ? periodOf(body, today()) : { from: "", to: "", preset: "" };
    const ids = selection(user, body);
    const sent = ledger.sentBefore({ companyId, kind, periodKey: periodKeyOf(kind, period, today()) });
    const people = [];
    for (const id of ids) {
      let account;
      try {
        account = accounts().detail(id, user);
      } catch {
        people.push({ id, name: "", phone: "", skip: "Cari Silinmiş" });
        continue;
      }
      const check = eligibility(account, kind);
      const person = { id: account.id, name: account.name, phone: check.phone.e164, skip: check.skip };
      if (!person.skip && queued(account.id, kind, period)) person.skip = "Zaten Kuyrukta";
      // R3 (plan §7a revizyonu): bu cariye bu şablon + dönem daha önce Meta'ya kabul ettirildiyse açık "sendAgain" bayrağı olmadan elenir (W4 sorar: "Yine de
      // Gönder" / "Bunları Çıkar", varsayılan Bunları Çıkar). Bilgi makine defterinden (geri yükleme silmez).
      const last = sent.get(account.id);
      if (last) person.sentBefore = last;
      if (!person.skip && last && body.sendAgain !== true) person.skip = "Daha Önce Gönderildi";
      people.push(person);
    }
    return { kind, period, people };
  }

  // §7a 29: başlatma reddi sırası bağlı değil → yetki → lisans → onay → şablon (yetki rotada, bağlantıdan hemen sonra denetlenir: routes/whatsapp.mjs).
  function connected() {
    const record = connection.read();
    if (!record) fail(409, "WhatsApp Business API bağlantısı yok; önce Yönetim → WhatsApp'ta Elle Bağla ile bağlanın.", "whatsapp-not-configured");
    return record;
  }
  // Başlatmayı engelleyen (bağlantı ve lisanstan sonraki) ilk neden: onay → firma adı. Önizleme bunu YANITTA söyler (2.4.8 W4: önizleme onaydan önce görülür,
  // "Gönder" onay işaretlenene dek pasif kalır); toplu iş açma reddeder.
  function startBlock() {
    if (!ack()) return { code: "whatsapp-ack-required", message: `Gönderimden önce Yönetim → WhatsApp'ta "${ACK_TEXT}" onayını işaretleyin.` };
    if (!String(store.setting("office.name", "") || "").trim()) return { code: "whatsapp-office-missing", message: "Firma adı yazılmamış (iletide firmanızın adı geçer); Yönetim → Ofis Bilgileri'nde firma adını yazın." };
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
      template = await checkTemplate(graph, record.wabaId, TEMPLATE_NAMES[kind], { force: true });
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

  async function createBatch(user, body) {
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
      template = await checkTemplate(graph, record.wabaId, TEMPLATE_NAMES[kind], { force: true });
      if (template.ok) limitInfo = await dailyLimit(graph, record, { force: true });
    } catch (error) {
      if (error instanceof MetaGraphError) throw metaHttp(error);
      throw error;
    }
    if (!template.ok) fail(409, template.reason, `whatsapp-${template.code}`, { template: template.template || null });
    // Meta'ya giden okuma isteğinin arasında aynı istek kimliğiyle ikinci istek tamamlanmış olabilir (çift tık): yeniden bakılır.
    const again = requestKey ? store.get("SELECT * FROM wa_batches WHERE request_key = ?", requestKey) : null;
    if (again) return { batch: batchView(again), reused: true };
    preconditions();
    const plotted = plan(user, body);
    const summary = summarize(plotted, record, limitInfo, template);
    // §7a 31: bütün seçilenler elenince toplu iş kaydı OLUŞMAZ; nedenler yanıtta.
    if (!summary.sendable) fail(400, "Gönderilebilecek kişi yok (seçilenlerin hepsi elendi).", "whatsapp-nothing", { summary });
    const batchId = newId("wab");
    const at = iso();
    try {
      ledger.openBatch(batchId, companyId, at);
    } catch (error) {
      fail(503, `WhatsApp gönderim defterine yazılamadı (${error.code || error.message}); disk dolu olabilir. Gönderim başlatılmadı.`, "whatsapp-ledger");
    }
    store.tx(() => {
      store.run(
        "INSERT INTO wa_batches (id, kind, period_from, period_to, preset, template, lang, phone_number_id, waba_id, ledger_id, company_id, state, request_key, created_by, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'running', ?, ?, ?, ?)",
        batchId, kind, plotted.period.from, plotted.period.to, plotted.period.preset, TEMPLATE_NAMES[kind], template.template.language, record.phoneNumberId, record.wabaId, ledger.id, companyId, requestKey, user.id, at, at,
      );
      for (const person of plotted.people) {
        if (!person.id || store.get("SELECT 1 AS found FROM wa_jobs WHERE batch_id = ? AND account_id = ?", batchId, person.id)) continue;
        store.run(
          "INSERT INTO wa_jobs (id, batch_id, account_id, account_name, phone_e164, template, lang, period_from, period_to, state, skip_reason, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)",
          newId("waj"), batchId, person.id, person.name, person.phone, TEMPLATE_NAMES[kind], template.template.language, plotted.period.from, plotted.period.to, person.skip ? "skipped" : "pending", person.skip, at, at,
        );
      }
    });
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
  const sameBody = row => ({ kind: row.kind, ...(row.period_from || row.period_to ? { from: row.period_from, to: row.period_to } : { preset: row.preset || "all" }) });
  // Başarısızları Yeniden Dene: yalnız kesin Başarısız işlerin carileri YENİ toplu işle (eski işler kayıtta kalır). Kabul edilmiş iş girmez.
  async function retryFailed(user, id, body = {}) {
    const row = editable(id);
    const ids = store.all("SELECT account_id AS id FROM wa_jobs WHERE batch_id = ? AND state = 'failed' ORDER BY rowid", row.id).map(item => item.id);
    if (!ids.length) fail(400, "Bu gönderimde yeniden denenecek başarısız ileti yok.", "whatsapp-nothing");
    return createBatch(user, { ...sameBody(row), ids, requestId: body.requestId });
  }
  // Sonucu Belirsiz iş için "Yine de Gönder": kullanıcı çift gidebileceğini onaylar (confirm: true) → o cariye yeni iş.
  async function sendAnyway(user, jobId, body = {}) {
    const job = jobRow(String(jobId || "").slice(0, 80));
    if (!job) fail(404, "Gönderim bulunamadı.", "whatsapp-job-missing");
    if (job.state !== "uncertain") fail(409, "Yalnız sonucu belirsiz ileti yeniden gönderilir.", "whatsapp-job-state");
    if (body.confirm !== true) fail(409, "İletinin Meta'ya ulaşıp ulaşmadığı bilinmiyor; yeniden gönderilirse kişiye iki kez gidebilir. Onaylıyorsanız yeniden isteyin.", "whatsapp-confirm-required");
    const row = batchRow(job.batch_id);
    const result = await createBatch(user, { ...sameBody(row), ids: [job.account_id], requestId: body.requestId });
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
    store.tx(() => {
      holdJobs(row.id);
      updateBatch(row.id, { state: "paused", pause_code: code, pause_reason: reason });
    });
    audit(null, "whatsapp.batch.paused", row.id, { code, reason });
    log.warn?.(`WhatsApp toplu gönderim duraklatıldı (${row.id}): ${reason}`);
    notify(row.id);
  }
  // "5 kez art arda" (§7a 15): geçici hata, belirsiz sonuç ve medya yükleme hataları sayar; başarılı gönderim sıfırlar. Dönüş: duraklatıldı mı.
  function trouble(row, reason) {
    const troubles = (row.troubles || 0) + 1;
    updateBatch(row.id, { troubles });
    if (troubles < MAX_TROUBLES) return false;
    pauseBatch({ ...row, troubles }, "meta-unreachable", `Meta'ya art arda ${MAX_TROUBLES} kez ulaşılamadı ya da Meta geçici hata verdi (son: ${reason}). İnternet bağlantısını denetleyip Devam Et'e basın.`);
    return true;
  }
  // Sınır: bu WABA'nın bu şirketteki süren işlerinde, pencerede olmayan numaraya giden bekleyen işler pencere açılana dek bekler.
  function markLimited(wabaId, until, phones = null) {
    const rows = store.all("SELECT j.id, j.phone_e164 AS phone FROM wa_jobs j JOIN wa_batches b ON b.id = j.batch_id WHERE b.waba_id = ? AND b.state = 'running' AND j.state IN ('pending', 'limited')", wabaId);
    store.tx(() => {
      for (const row of rows) if (!phones?.has(row.phone)) updateJob(row.id, { state: "limited", next_at: until });
    });
  }

  /** Sıradaki iş (şimdi yürütülebilir) ya da beklenecek süre. Sıra: toplu iş açılış sırası, içinde seçim sırası (§7a 5). */
  function next() {
    const t = iso();
    const row = store.get(
      `SELECT j.id FROM wa_jobs j JOIN wa_batches b ON b.id = j.batch_id WHERE b.state = 'running' AND (b.retry_at IS NULL OR b.retry_at <= ?)
       AND j.state IN ('pending', 'limited', 'held') AND (j.next_at IS NULL OR j.next_at <= ?) ORDER BY b.created_at, b.rowid, j.rowid LIMIT 1`,
      t,
      t,
    );
    if (row) return { jobId: row.id };
    // En yakın uyanış: işin kendi beklemesi ya da toplu işin bağlantı beklemesi (hangisi geç ise).
    const soon = store.get(`SELECT MIN(MAX(COALESCE(j.next_at, ''), COALESCE(b.retry_at, ''))) AS at FROM wa_jobs j JOIN wa_batches b ON b.id = j.batch_id
      WHERE b.state = 'running' AND j.state IN ('pending', 'limited', 'held') AND (j.next_at IS NOT NULL OR b.retry_at IS NOT NULL)`)?.at;
    return { jobId: null, waitMs: soon ? Math.max(0, Date.parse(soon) - nowMs()) : null };
  }

  async function step() {
    const pick = next();
    if (!pick.jobId) return { did: false, waitMs: pick.waitMs };
    let job = jobRow(pick.jobId);
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
      pauseBatch(batch, "license", "Lisans Nedeniyle Durdu: program salt okunur çalışıyor; lisans yenilenince Devam Et'e basın.");
      return { did: true };
    }
    const record = connection.read();
    if (!record || record.wabaId !== batch.waba_id || record.phoneNumberId !== batch.phone_number_id) {
      pauseBatch(batch, "connection", "WhatsApp bağlantısı kaldırıldı ya da değişti; gönderim duraklatıldı.");
      return { did: true };
    }
    let graph;
    try {
      ({ graph } = connection.client());
    } catch (error) {
      pauseBatch(batch, "token", error.message);
      return { did: true };
    }
    // Şablon (saatte bir; §7a 27) ve sınır basamağı (6 saatte bir).
    let limitInfo;
    let language = batch.lang;
    try {
      const template = await checkTemplate(graph, batch.waba_id, batch.template);
      if (!template.ok) {
        pauseBatch(batch, template.code, template.reason);
        return { did: true };
      }
      language = template.template.language || batch.lang;
      limitInfo = await dailyLimit(graph, record);
    } catch (error) {
      if (!(error instanceof MetaGraphError)) throw error;
      handleFailure(batch, job, error, { stage: "check" });
      return { did: true };
    }
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
    try {
      prepared = await prepare(batch, job, graph, record, account, user);
    } catch (error) {
      updateJob(job.id, { state: "pending" });
      if (!(error instanceof MetaGraphError)) throw error;
      handleFailure(batch, jobRow(job.id), error, { stage: "media" });
      return { did: true };
    }
    if (prepared.skip) {
      updateJob(job.id, { state: "skipped", skip_reason: prepared.skip, closed_at: iso() });
      finishIfDone(batch.id);
      return { did: true };
    }
    // ---------- Gönderiliyor (istekten ÖNCE yazılır) ----------
    const attempt = (job.attempt || 0) + 1;
    updateJob(job.id, { state: "sending", attempt, sending_at: iso() });
    let claim;
    try {
      injected("ledger-claim", job);
      claim = ledger.claim({ jobId: job.id, attempt, batchId: batch.id, companyId, wabaId: batch.waba_id, phone, accountId: job.account_id, kind: batch.kind, periodKey: periodKeyOf(batch.kind, { from: batch.period_from, to: batch.period_to }, today()), at: iso() });
    } catch (error) {
      // Defter yazılamadı (disk dolu, kilit): istek GÖNDERİLMEZ, iş bekler.
      updateJob(job.id, { state: "pending", attempt: job.attempt || 0, sending_at: null, next_at: iso(nowMs() + JOB_BACKOFF_MS[0]) });
      trouble(batchRow(batch.id), `gönderim defteri yazılamadı (${error.code || error.message})`);
      log.warn?.(`WhatsApp gönderim defteri yazılamadı (${job.id}): ${error.message}`);
      return { did: true };
    }
    if (!claim.ok) {
      // Önceki deneme kabul edilmiş ya da sonucu belirsiz: ikinci kez gönderilmez.
      const accepted = claim.previous.outcome === "accepted";
      updateJob(job.id, accepted ? { state: "accepted", attempt: claim.previous.attempt, wamid: claim.previous.wamid || null, accepted_at: job.accepted_at || iso() } : { state: "uncertain", attempt: claim.previous.attempt, error_text: "Bu iletinin önceki gönderim denemesinin sonucu bilinmiyor; ikinci kez gönderilmedi." });
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
    });
    finishIfDone(batch.id);
    notify(batch.id);
    return { did: true, sent: true };
  }

  // Değişkenler ve PDF AYNI cari okumasından (metin = PDF; §7a 1). Medya geçerliyse (30 gün, silinmemiş) aynısı yeniden kullanılır (§7a 14–15).
  async function prepare(batch, job, graph, record, account, user) {
    const office = cleanParam(store.setting("office.name", "") || "");
    const name = cleanParam(account.name);
    let params;
    let document = null;
    if (batch.kind === "statement") {
      const range = { from: batch.period_from, to: batch.period_to };
      const data = statementData(account, range);
      params = [name, office, periodText(range, account.ledger || []), balanceText(data.closing)];
      // eslint-disable-next-line no-control-regex
      const filename = statementFileName(data, today()).replace(/[\\/:*?"<>|\u0000-\u001f]+/g, " ");
      let mediaId = job.media_id;
      if (!mediaId || !job.media_at || nowMs() - Date.parse(job.media_at) > MEDIA_REUSE_MS || job.media_deleted_at) {
        const pdf = statementPdf(data, { today: today(), now: now(), userName: user.display_name || user.username || "", header: header() });
        mediaId = await graph.uploadMedia(record.phoneNumberId, { data: pdf, filename, mime: "application/pdf" });
        updateJob(job.id, { media_id: mediaId, media_at: iso(), media_deleted_at: null, media_delete_tries: 0 });
      }
      document = { id: mediaId, filename };
      updateJob(job.id, { params_json: JSON.stringify(params), pdf_name: filename });
    } else {
      const overdue = overdueOf(account, today());
      if (!overdue) return { skip: "Gecikmiş Borç Yok" };
      params = [name, office, dayText(overdue.dueDate), moneyText(overdue.amount), balanceText(account.totals.balance)];
      updateJob(job.id, { params_json: JSON.stringify(params) });
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

  function handleFailure(batch, job, error, { stage, attempt = null }) {
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
      trouble(row, text);
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
  function settleSending(jobs) {
    const out = { sendingToPending: 0, sendingToAccepted: 0, sendingToUncertain: 0 };
    for (const job of jobs) {
      const attempt = ledger.attempts(job.id).find(item => item.attempt === job.attempt);
      if (!attempt) {
        updateJob(job.id, { state: "pending", attempt: Math.max(0, (job.attempt || 1) - 1), sending_at: null });
        out.sendingToPending += 1;
      } else if (attempt.outcome === "accepted") {
        updateJob(job.id, { state: "accepted", wamid: attempt.wamid || null, accepted_at: job.accepted_at || job.sending_at || iso(), error_code: null, error_text: "" });
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
    const { ttlHours } = settings();
    const out = { expired: 0, mediaDeleted: 0, mediaFailed: 0 };
    // Bildirim yolu çalışıyorsa (son 7 günde bu şirkete en az bir durum bildirimi geldi) teslim edilmeyen ileti TTL + 1 saatte "Süresi Doldu"; yoksa "Meta Kabul Etti"de kalır.
    const seen = Date.parse(store.setting(HOOK_SEEN_KEY, "") || "");
    if (Number.isFinite(seen) && nowMs() - seen <= HOOK_ALIVE_MS) {
      const ttlLimit = iso(nowMs() - (ttlHours + 1) * HOUR);
      for (const row of store.all("SELECT id FROM wa_jobs WHERE state IN ('accepted', 'sent') AND accepted_at IS NOT NULL AND accepted_at < ?", ttlLimit)) {
        updateJob(row.id, { state: "expired", closed_at: iso() });
        out.expired += 1;
      }
    }
    const doomed = store.all(
      `SELECT j.id, j.media_id, j.media_delete_tries, b.waba_id FROM wa_jobs j JOIN wa_batches b ON b.id = j.batch_id
       WHERE j.media_id IS NOT NULL AND j.media_deleted_at IS NULL AND j.media_delete_tries < 5 AND j.state IN (${FINAL.map(() => "?").join(",")}) LIMIT 50`,
      ...FINAL,
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
        try {
          await graph.deleteMedia(row.media_id);
          updateJob(row.id, { media_deleted_at: iso() });
          out.mediaDeleted += 1;
        } catch (error) {
          updateJob(row.id, { media_delete_tries: (row.media_delete_tries || 0) + 1 });
          out.mediaFailed += 1;
          log.warn?.(`WhatsApp: gönderilen PDF Meta'dan silinemedi (${row.id}; ${error.message}); sonra yeniden denenecek.`);
        }
      }
    }
    // Kabul yazımı düşmüş (disk dolu) ve 5 dakikadır "Gönderiliyor"da kalan iş (tek işçi; istek 15 sn'de biter): açılıştaki kuralla defterden çözülür.
    const stuck = store.all("SELECT * FROM wa_jobs WHERE state = 'sending' AND sending_at < ?", iso(nowMs() - 5 * 60_000));
    if (stuck.length) out.repaired = settleSending(stuck);
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

  // ---------- Durum bildirimleri (W9; lib/whatsapp/hook.mjs) ----------
  /**
   * statuses: Meta'nın statuses[] öğeleri (D0-15). phoneNumberId: bildirimin geldiği numara (metadata). signed: Meta imzası kapıcıda doğrulandı ve istek kapıcının
   * imzasıyla geldi (Yol 2). Yalnız bu şirketin kaydındaki wamid'ler güncellenir; Sonucu Belirsiz iş YALNIZ imzalı bildirim + iş kimliği (biz_opaque_callback_data)
   * eşleşince çözülür (§7a 3); bilinmeyen / imzasız eşleşmeyen olay düşer. Durum yalnız ileri gider (§7a 17–18); yinelenen bildirim etkisizdir.
   */
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
        out.unknown += 1;
        continue;
      }
      const batch = batchRow(job.batch_id);
      if (!batch || (phoneNumberId && batch.phone_number_id !== String(phoneNumberId))) {
        out.ignored += 1;
        continue;
      }
      const current = job.state;
      const fields = {};
      const resolving = ["uncertain", "sending"].includes(current);
      if (resolving && wamid) fields.wamid = wamid;
      if (value === "sent") {
        if (resolving || current === "accepted") Object.assign(fields, { state: "sent", sent_at: at });
      } else if (value === "delivered") {
        if (resolving || ["accepted", "sent", "expired"].includes(current)) Object.assign(fields, { state: "delivered", delivered_at: at, sent_at: job.sent_at || at, closed_at: iso() });
      } else if (value === "read") {
        if (resolving || ["accepted", "sent", "delivered", "expired"].includes(current)) Object.assign(fields, { state: "read", read_at: at, delivered_at: job.delivered_at || at, sent_at: job.sent_at || at, closed_at: iso() });
      } else if (value === "failed") {
        // §7a 18: delivered / read'den SONRA gelen failed yok sayılır.
        if (resolving || ["accepted", "sent", "expired"].includes(current)) {
          const first = Array.isArray(status.errors) ? status.errors[0] : null;
          const code = Number(first?.code);
          const known = Number.isFinite(code) ? classifyMetaCode(code) : null;
          const text = known?.title || String(first?.error_data?.details || first?.message || first?.title || "İleti teslim edilemedi.").slice(0, 300);
          Object.assign(fields, { state: "failed", failed_at: at, closed_at: iso(), error_code: Number.isFinite(code) ? code : null, error_text: Number.isFinite(code) ? `${text} (Meta hata kodu ${code})` : text });
        }
      }
      if (status?.pricing && typeof status.pricing === "object" && "billable" in status.pricing) fields.billable = status.pricing.billable === false ? 0 : 1;
      const changed = Boolean(fields.state) && fields.state !== current;
      if (!changed && !("billable" in fields && fields.billable !== job.billable)) {
        out.ignored += 1;
        continue;
      }
      try {
        updateJob(job.id, fields);
      } catch (error) {
        // wamid tekil dizini: aynı wamid başka işte (olmamalı) → olay düşer.
        log.warn?.(`WhatsApp durum bildirimi yazılamadı (${job.id}): ${error.message}`);
        out.ignored += 1;
        continue;
      }
      const wabaId = batch.waba_id;
      if (resolving && changed) ledger.lateAccept({ jobId: job.id, companyId, wabaId, at });
      if (["delivered", "read"].includes(fields.state)) ledger.delivered({ jobId: job.id, companyId, wabaId, billable: fields.billable === undefined ? job.billable !== 0 : fields.billable === 1, at: fields.delivered_at || at });
      if (fields.state === "failed") ledger.deliveryFailed({ jobId: job.id, attempt: job.attempt, at });
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

  return { connected, preview, createBatch, list, detail, pause, resume, cancel, retryFailed, sendAnyway, next, step, recover, maintain, applyStatuses, monthStats, historyOf, setAck, ackView, ack, setSending, settings, judgeTemplate };
}
