// e-Belge KULLANIM SAYACI (2.4.7, EDM iş ortaklığı B1/B2). EDM, müşterinin kullandığı kontörün %30'unu ay sonunda iş ortağına hak ediş olarak öder;
// hesap REQUEST_HEADER/APPLICATION_NAME ("destekofis30", edm.mjs) ile yapılır. Program kendi tarafında EDM'nin KABUL ETTİĞİ gönderimleri sayar; sayılar
// lisans doğrulamasında (/v1/check, license.mjs) toplam olarak gider ve Operatör Merkezi'nde EDM'nin ay sonu raporuyla karşılaştırılır.
//
// KURAL (tek yer: bu dosya; routes/invoices.mjs setE yalnız çağırır). Kullanıcı kararları S1–S5 (27.10.2026, docs/2.4.7-IS-LISTESI.md "KARARLAR — EDM sayacı"):
//   - Sayılan: EDM'nin kabul ettiği gönderim — programdan gönderim / taslağın programdan gönderimi (invoice.e.sent) ya da sonucu BELİRSİZ kalmış gönderimin
//     sonradan kesin kabul olduğu görülmesi: Durum Sorgula / yeniden Gönder'in önce sorması (invoice.e.status) ya da yeniden gönderimde EDM'nin belgenin
//     KENDİ ETTN'iyle 11048 demesi (invoice.e.duplicate; S3). Kabul sayılan durumlar: İşleniyor, Gönderildi, Kabul Edildi, Reddedildi (alıcı/GİB reddi;
//     EDM belgeyi almıştı), İptal Edildi.
//   - Kesinleşme ancak ÖNCEDEN bir belirsiz gönderim izi (invoice.e.sending) varsa ve iz bu kurulumun sayacı başladıktan (edoc_usage_meta since, v37) SONRAysa
//     sayılır: izsiz / 2.4.6 ve öncesinde gönderilmiş belge eski APPLICATION_NAME ile gitmiştir (geriye dönük doldurma YOK).
//   - F2: "Hata"daki belgede sonradan EDM kabulü görülürse sayılır; ay "bulunamadı" ile kapanmamış ilk gönderim izinin ayı.
//   - Sayılmayan: portala taslak yükleme (GİB'e gitmedi), EDM'nin reddi (Hata), hiç gitmeyen istek, durum sorgusunun önceki durumu yinelemesi, iptal,
//     taslaktaki belgenin portaldan gönderildiğinin durum sorgusuyla görülmesi (EDM portalından kesilen belge iş ortaklığına girmez).
//   - Tekillik (S2): şirket + ETTN + ortam BİR kez. Şirket içinde şirket dosyasındaki iz tablosunun, kurulum düzeyinde kullanım defterinin
//     (kullanim-defteri.mjs) birincil anahtarı. Yeniden deneme, 11048, durum sorgusu sayıyı artırmaz.
//   - Ay (S1): GÖNDERİMİN ayı (sunucunun yerel günü). Doğrudan kabulde kabul anı; belirsiz gönderimin sonradan kesinleşmesinde EDM'nin isteği aldığı
//     gönderim izinin anı (attemptAtOf).
//   - Pencere (S5): içinde bulunulan ay + önceki 2 ay, ay başına ayrı satır (sıfırlar dahil).
//   - Yer (S4): sayılan satır şirket dosyasına İZ olarak, ayrıca kurulum düzeyindeki kullanım defterine yazılır; lisans özeti defterden okunur. Yedekten
//     Geri Yükle ve Şirket Verisini Sıfırla defteri etkilemez.
//   - Tür: e-Arşiv (EARSIVFATURA) → earsiv, e-SMM (ESMM) → esmm, öbür e-Fatura profilleri (TEMELFATURA, TICARIFATURA, IHRACAT, KAMU …) → efatura.
import { isoDay } from "../plans.mjs";
import { NOT_SENT_CODES, SEND_INTENT } from "./iptal-suresi.mjs";

export const USAGE_KINDS = Object.freeze(["efatura", "earsiv", "esmm"]);
export const USAGE_ENVS = Object.freeze(["test", "live"]);
// EDM'nin belgeyi aldığını gösteren durumlar (routes/invoices.mjs E_STATES anahtarları).
export const USAGE_ACCEPTED = Object.freeze(new Set(["processing", "sent", "accepted", "rejected", "cancelled"]));
export const USAGE_MONTHS = 3;
// Şirket dosyasında sayacın başladığı an (v37 göçü edoc_usage_meta'ya yazar; Şirket Verisini Sıfırla listelerinde yok, korunur). Okunamazsa "".
export function usageSinceOf(store) {
  try {
    return store.get("SELECT value FROM edoc_usage_meta WHERE key = 'since'")?.value || "";
  } catch {
    return "";
  }
}

export const usageKindOf = profile => {
  const value = String(profile || "").toUpperCase();
  if (!value || value === "KAGIT") return "";
  if (value === "EARSIVFATURA") return "earsiv";
  if (value === "ESMM") return "esmm";
  return "efatura";
};

export const monthOf = at => {
  const date = at instanceof Date ? at : new Date(at);
  return Number.isNaN(date.getTime()) ? "" : isoDay(date).slice(0, 7);
};

/**
 * Bir e-Belge durum yazımı (setE) hangi sınıfta? SAF işlev — veri tabanına bakmaz.
 * @param {{ action: string, previous: { eStatus?: string, eAdapter?: string }, status: string }} input
 *   action: İşlem Geçmişi türü (invoice.e.sent | invoice.e.status | invoice.e.duplicate | …); previous: yazımdan ÖNCEKİ e-Belge durumu ve entegratör izi;
 *   status: yazılan yeni durum.
 * @returns {"" | "sent" | "confirmed" | "confirmed-error"} "" sayılmaz; "sent" gönderimin kabulü; "confirmed" belirsiz gönderimin kabulü; "confirmed-error"
 *   "Hata"daki belgenin sonradan görülen kabulü (F2). İkisinde usageDecision izi arar.
 */
export function usageTransition({ action, previous = {}, status }) {
  const before = previous.eStatus || "none";
  const uncertain = before === "none" && Boolean(previous.eAdapter);
  // Y2 / S6 (kullanıcı kararı 27.10.2026): belirsiz gönderimde Durum Sorgula "EDM aldı, reddetti" (Hata) → EDM belgeyi aldı, kontör düştü → SAYILIR; ay gönderim izinin ayı.
  if (action === "invoice.e.status" && uncertain && status === "error") return "confirmed";
  if (!USAGE_ACCEPTED.has(status)) return "";
  if (action === "invoice.e.sent") return "sent";
  // F2 (kullanıcı kararı 27.10.2026): "Hata"ya düşmüş belgede sonradan EDM kabulü görülürse SAYILIR (EDM belgeyi bir istekte almıştı).
  if (action === "invoice.e.status" && before === "error") return "confirmed-error";
  if (action === "invoice.e.duplicate" || action === "invoice.e.status") return uncertain ? "confirmed" : "";
  return "";
}

/**
 * Belirsiz gönderimin kesinleştiği yazımda EDM'nin belgeyi ALDIĞI an: belgenin "EDM'de değil" olduğu son kesin bilgiden (EDM reddi / Hata, hiç gitmeyen
 * istek, "entegratörde bulunamadı", numaranın geri bırakılması, önceki kabul) SONRAKİ İLK gönderim izi (invoice.e.sending). SAF işlev.
 * duplicate (11048, S3): 11048'i alan yeniden gönderimin kendi izi sayılmaz (EDM onu reddetti; belgeyi daha önceki bir istekte almıştı) ve aradaki
 * 11048'den HEMEN önceki örtük "bulunamadı" sorgusu kapatmaz (11048 onu yalanlar: EDM'nin durum kaydı gecikmişti); daha önceki açık "bulunamadı" kapatır (Y3).
 * fromError (F2, kullanıcı kararı 27.10.2026): "Hata"daki belgenin sonradan görülen kabulünde ay, EDM "bulunamadı" ile KAPANMAMIŞ ilk gönderim izinin ayı —
 * EDM reddi (Hata) izi kapatmaz (ret yanıtına rağmen EDM belgeyi almış çıktı); "bulunamadı", hiç gitmeyen istek ve numaranın bırakılması kapatır.
 * (F1, kullanıcı kararı: belirsiz → "bulunamadı" → yeniden belirsiz → kesinleşmede ay ikinci gönderimin ayı — "bulunamadı" ilkini kapatır; kural değişmedi.)
 * @param {{ type: string, payload?: object, at: string }[]} events belgenin İşlem Geçmişi kayıtları, yazım sırasıyla
 * @returns {string} iz anı (ISO) ya da "" (önceden belirsiz gönderim yok)
 */
export function attemptAtOf(events = [], { duplicate = false, fromError = false } = {}) {
  let list = events;
  if (duplicate) {
    const last = events.map(event => event.type).lastIndexOf(SEND_INTENT);
    list = last >= 0 ? events.slice(0, last) : events;
    // Y3 (kullanıcı kararı, F1): yalnız 11048'den hemen önceki örtük "bulunamadı" sorgusu yok sayılır; daha önceki açık "bulunamadı" ilk izi kapatır.
    const tail = list[list.length - 1];
    if (tail && tail.type === "invoice.e.status" && (tail.payload || {}).missing === true) list = list.slice(0, -1);
  }
  let open = "";
  for (const event of list) {
    const payload = event.payload || {};
    if (event.type === SEND_INTENT) {
      if (!open) open = event.at || "";
      continue;
    }
    const closed =
      event.type === "invoice.e.sent" ||
      event.type === "invoice.unnumbered" ||
      (event.type === "invoice.e.status" && payload.missing === true) ||
      (event.type === "invoice.e.send-failed" && ((!fromError && payload.status === "error") || NOT_SENT_CODES.has(payload.code || "")));
    if (closed) open = "";
  }
  return open;
}
export const ATTEMPT_EVENTS = Object.freeze([SEND_INTENT, "invoice.e.sent", "invoice.unnumbered", "invoice.e.status", "invoice.e.send-failed"]);

/**
 * Yazım sayılır mı, hangi ana (ayına) yazılır? SAF işlev.
 * @param {{ action, previous, status, at: string, history?: object[], since?: string }} input at: yazımın anı (ISO); history: belgenin o ana kadarki İşlem
 *   Geçmişi (ATTEMPT_EVENTS türleri yeter); since: sayacın başladığı an (ISO; boşsa sınır yok)
 * @returns {{ count: boolean, at: string, reason: string }}
 */
export function usageDecision({ action, previous = {}, status, at, history = [], since = "" }) {
  const kind = usageTransition({ action, previous, status });
  if (!kind) return { count: false, at: "", reason: "not-accepted" };
  if (kind === "sent") return { count: true, at, reason: "sent" };
  const attempt = attemptAtOf(history, { duplicate: action === "invoice.e.duplicate", fromError: kind === "confirmed-error" });
  if (!attempt) return { count: false, at: "", reason: "orphan" };
  if (since && String(attempt) < String(since)) return { count: false, at: "", reason: "before-since" };
  return { count: true, at: attempt, reason: kind };
}

/**
 * Şirket dosyasına iz satırı ekler (varsa dokunmaz). store: createStore nesnesi; işlem İÇİNDE çağrılır (setE'nin store.tx'i).
 * @returns {object|null} yeni satır ({ ettn, env, kind, month, invoice_id, source, created_at }) ya da null
 */
export function recordUsage(store, { ettn, env, profile, at, invoiceId = "", source = "" }) {
  const kind = usageKindOf(profile);
  const uuid = String(ettn || "").trim().toLowerCase();
  const month = monthOf(at);
  if (!kind || !uuid || !USAGE_ENVS.includes(env) || !month) return null;
  const row = { ettn: uuid, env, kind, month, invoice_id: String(invoiceId || ""), source: String(source || ""), created_at: new Date(at).toISOString() };
  const result = store.run("INSERT OR IGNORE INTO edoc_usage (ettn, env, kind, month, invoice_id, source, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)", row.ettn, row.env, row.kind, row.month, row.invoice_id, row.source, row.created_at);
  return Number(result?.changes) > 0 ? row : null;
}

/** Şirket dosyasının bütün iz satırları (deftere aktarma). db: node:sqlite (prepare) ya da store (all). Tablo yoksa (göç öncesi dosya) []. */
export function journalRowsOf(db) {
  const sql = "SELECT ettn, env, kind, month, invoice_id, source, created_at FROM edoc_usage ORDER BY rowid";
  try {
    if (typeof db?.all === "function") return db.all(sql);
    return db.prepare(sql).all();
  } catch {
    return [];
  }
}

/** Pencerenin ayları (S5): `today`'in ayı dahil son `months` ay, eskiden yeniye. */
export function windowMonths(today, months = USAGE_MONTHS) {
  const [year, month] = String(today).slice(0, 7).split("-").map(Number);
  const out = [];
  for (let back = months - 1; back >= 0; back -= 1) {
    const index = year * 12 + (month - 1) - back;
    out.push(`${Math.floor(index / 12)}-${String((index % 12) + 1).padStart(2, "0")}`);
  }
  return out;
}
export const firstMonth = (today, months = USAGE_MONTHS) => windowMonths(today, months)[0];

/**
 * SAF toplayıcı: satırlar (her biri { month, env, kind, count? }) → ay × ortam sıralı liste [{ month, env, efatura, earsiv, esmm }].
 * months verilirse (S5 penceresi) yalnız o aylar ve HER ay × ortam satırı (sıfırlar dahil); verilmezse yalnız sıfırdan büyük satırlar.
 * Şirketlerin satırları aynı listeye verilerek toplanır.
 */
export function summarizeUsage(rows = [], { from = "", to = "", months = null } = {}) {
  const map = new Map();
  const entryOf = (month, env) => {
    const key = `${month}|${env}`;
    if (!map.has(key)) map.set(key, { month, env, efatura: 0, earsiv: 0, esmm: 0 });
    return map.get(key);
  };
  if (months) for (const month of months) for (const env of ["live", "test"]) entryOf(month, env);
  for (const row of rows) {
    const month = String(row?.month || "");
    if (!/^\d{4}-\d{2}$/.test(month) || (from && month < from) || (to && month > to) || (months && !months.includes(month))) continue;
    if (!USAGE_ENVS.includes(row.env) || !USAGE_KINDS.includes(row.kind)) continue;
    const count = row.count === undefined ? 1 : Number(row.count);
    if (!Number.isSafeInteger(count) || count <= 0) continue;
    entryOf(month, row.env)[row.kind] += count;
  }
  return [...map.values()].sort((a, b) => a.month.localeCompare(b.month) || (a.env === b.env ? 0 : a.env === "live" ? -1 : 1));
}

/**
 * KÂHİN KARŞILAŞTIRMASI İÇİN SAF UÇTAN UCA İŞLEV (veri tabanı yok): durum yazımları listesi → sayılan satırlar. Programın yolu ile aynı adımlar:
 * usageDecision → tür / ay → aynı şirket + ETTN + ortam ilk yazım kazanır.
 * @param {{ company: string, ettn: string, env: "test"|"live", profile: string, action: string, previous: { eStatus?: string, eAdapter?: string },
 *   status: string, at: string, history?: object[], since?: string }[]} transitions yazım sırasıyla
 * @returns {{ company: string, ettn: string, env: string, kind: string, month: string }[]}
 */
export function usageFromTransitions(transitions = []) {
  const seen = new Map();
  for (const item of transitions) {
    const decision = usageDecision(item);
    if (!decision.count) continue;
    const kind = usageKindOf(item.profile);
    const ettn = String(item.ettn || "").trim().toLowerCase();
    const month = monthOf(decision.at);
    if (!kind || !ettn || !USAGE_ENVS.includes(item.env) || !month) continue;
    const key = `${item.company || ""}|${ettn}|${item.env}`;
    if (!seen.has(key)) seen.set(key, { company: String(item.company || ""), ettn, env: item.env, kind, month });
  }
  return [...seen.values()];
}
