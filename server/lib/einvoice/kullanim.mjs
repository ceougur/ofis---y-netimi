// e-Belge KULLANIM SAYACI (2.4.7, EDM iş ortaklığı B1/B2). EDM, müşterinin kullandığı kontörün %30'unu ay sonunda iş ortağına hak ediş olarak öder;
// hesap REQUEST_HEADER/APPLICATION_NAME ("destekofis30", edm.mjs) ile yapılır. Program kendi tarafında EDM'nin KABUL ETTİĞİ gönderimleri sayar; sayılar
// lisans doğrulamasında (/v1/check, license.mjs) TOPLAM olarak gider ve Operatör Merkezi'nde EDM'nin ay sonu raporuyla karşılaştırılır.
//
// KURAL (tek yer: bu dosya; routes/invoices.mjs setE yalnız çağırır):
//   - Sayılan: EDM'nin kabul ettiği gönderim — programdan gönderim / taslağın programdan gönderimi (invoice.e.sent) ya da sonucu BELİRSİZ kalmış gönderimin
//     sonradan kesin kabul olduğu görülmesi (Durum Sorgula / yeniden Gönder'in önce sorması: invoice.e.status; 11048'de belgenin KENDİ ETTN'iyle bulunması:
//     invoice.e.duplicate). Kabul sayılan durumlar: İşleniyor, Gönderildi, Kabul Edildi, Reddedildi (alıcı/GİB reddi; EDM belgeyi almıştı), İptal Edildi.
//   - Sayılmayan: portala taslak yükleme (GİB'e gitmedi), EDM'nin reddi (Hata), hiç gitmeyen istek, durum sorgusunun önceki durumu yinelemesi, iptal,
//     taslaktaki belgenin portaldan gönderildiğinin durum sorgusuyla görülmesi (gönderimi portal yaptı — EDM portalından kesilen belge iş ortaklığına girmez).
//   - Tekillik: aynı ETTN + ortam (test / live) BİR kez (tablo birincil anahtarı; INSERT OR IGNORE). Yeniden deneme, 11048, durum sorgusu sayıyı artırmaz.
//   - Ay: gönderimin ayı (sunucunun yerel günü). Belirsiz gönderimin sonradan kabulünde ay, gönderim izinin (invoice.e.sending) ayıdır — EDM belgeyi o anda
//     aldı; iz yoksa kabulün görüldüğü an.
//   - Tür: e-Arşiv (EARSIVFATURA) → earsiv, e-SMM (ESMM) → esmm, öbür e-Fatura profilleri (TEMELFATURA, TICARIFATURA, IHRACAT, KAMU …) → efatura.
//   - Geriye dönük doldurma YOK: kayıt 2.4.7 ile başlar (önceki sürümler APPLICATION_NAME "DestekOfis" gönderiyordu; o kullanım hak edişe girmez).
//   - Append-only: tablo yalnız eklenir (UPDATE/DELETE tetikleyiciyle reddedilir; Şirket Verisini Sıfırla da silmez). Her şirket kendi veri dosyasında
//     tutar; lisans doğrulamasında şirketlerin sayıları toplanır (app.mjs).
import { isoDay } from "../plans.mjs";
import { NOT_SENT_CODES, SEND_INTENT } from "./iptal-suresi.mjs";

export const USAGE_KINDS = Object.freeze(["efatura", "earsiv", "esmm"]);
export const USAGE_ENVS = Object.freeze(["test", "live"]);
// EDM'nin belgeyi aldığını gösteren durumlar (routes/invoices.mjs E_STATES anahtarları).
export const USAGE_ACCEPTED = Object.freeze(new Set(["processing", "sent", "accepted", "rejected", "cancelled"]));
export const USAGE_MONTHS = 3;

export const usageKindOf = profile => {
  const value = String(profile || "").toUpperCase();
  if (!value || value === "KAGIT") return "";
  if (value === "EARSIVFATURA") return "earsiv";
  if (value === "ESMM") return "esmm";
  return "efatura";
};

const monthOfLocal = at => {
  const date = at instanceof Date ? at : new Date(at);
  return Number.isNaN(date.getTime()) ? "" : isoDay(date).slice(0, 7);
};

/**
 * Bir e-Belge durum yazımı (setE) sayılır mı? SAF işlev — veri tabanına bakmaz.
 * @param {{ action: string, previous: { eStatus?: string, eAdapter?: string }, status: string }} input
 *   action: İşlem Geçmişi türü (invoice.e.sent | invoice.e.status | invoice.e.duplicate | …); previous: yazımdan ÖNCEKİ e-Belge durumu ve entegratör izi;
 *   status: yazılan yeni durum.
 * @returns {"" | "sent" | "confirmed"} "" sayılmaz; "sent" gönderimin kabulü (ay = şimdi); "confirmed" belirsiz gönderimin kabulü (ay = gönderim izi).
 */
export function usageTransition({ action, previous = {}, status }) {
  if (!USAGE_ACCEPTED.has(status)) return "";
  const before = previous.eStatus || "none";
  const uncertain = before === "none" && Boolean(previous.eAdapter);
  if (action === "invoice.e.sent") return "sent";
  if (action === "invoice.e.duplicate" || action === "invoice.e.status") return uncertain ? "confirmed" : "";
  return "";
}

/**
 * Belirsiz gönderimin kesinleştiği yazımda EDM'nin belgeyi ALDIĞI an: belgenin "EDM'de değil" olduğu son kesin bilgiden (EDM reddi / Hata, hiç gitmeyen
 * istek, "entegratörde bulunamadı", numaranın geri bırakılması, önceki kabul) SONRAKİ İLK gönderim izi (invoice.e.sending). SAF işlev.
 * @param {{ type: string, payload?: object, at: string }[]} events belgenin İşlem Geçmişi kayıtları, yazım sırasıyla
 * @returns {string} iz anı (ISO) ya da "" (iz yok: çağıran kabulün görüldüğü anı kullanır)
 */
export function attemptAtOf(events = []) {
  let open = "";
  for (const event of events) {
    const payload = event.payload || {};
    if (event.type === SEND_INTENT) {
      if (!open) open = event.at || "";
      continue;
    }
    const closed =
      event.type === "invoice.e.sent" ||
      event.type === "invoice.unnumbered" ||
      (event.type === "invoice.e.status" && payload.missing === true) ||
      (event.type === "invoice.e.send-failed" && (payload.status === "error" || NOT_SENT_CODES.has(payload.code || "")));
    if (closed) open = "";
  }
  return open;
}
export const ATTEMPT_EVENTS = Object.freeze([SEND_INTENT, "invoice.e.sent", "invoice.unnumbered", "invoice.e.status", "invoice.e.send-failed"]);

/**
 * Sayaca bir satır ekler (varsa dokunmaz). store: createStore nesnesi; işlem İÇİNDE çağrılır (setE'nin store.tx'i).
 * @returns {boolean} yeni satır eklendi mi
 */
export function recordUsage(store, { ettn, env, profile, at, invoiceId = "", source = "" }) {
  const kind = usageKindOf(profile);
  const uuid = String(ettn || "").trim().toLowerCase();
  const month = monthOfLocal(at);
  if (!kind || !uuid || !USAGE_ENVS.includes(env) || !month) return false;
  const result = store.run("INSERT OR IGNORE INTO edoc_usage (ettn, env, kind, month, invoice_id, source, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)", uuid, env, kind, month, String(invoiceId || ""), String(source || ""), new Date(at).toISOString());
  return Number(result?.changes) > 0;
}

/** Son `months` ayın (bu ay dahil, yerel takvim) ilk ayı "YYYY-MM". */
export function firstMonth(today, months = USAGE_MONTHS) {
  const [year, month] = String(today).slice(0, 7).split("-").map(Number);
  const index = year * 12 + (month - 1) - (months - 1);
  return `${Math.floor(index / 12)}-${String((index % 12) + 1).padStart(2, "0")}`;
}

/**
 * SAF toplayıcı: satırlar (her biri { month, env, kind, count? }) → ay × ortam sıralı liste
 * [{ month: "YYYY-MM", env: "live"|"test", efatura, earsiv, esmm }] (yalnız sıfırdan büyük toplamlı satırlar; ay artan, live önce).
 * Şirketlerin satırları aynı listeye verilerek toplanır.
 */
export function summarizeUsage(rows = [], { from = "", to = "" } = {}) {
  const map = new Map();
  for (const row of rows) {
    const month = String(row?.month || "");
    if (!/^\d{4}-\d{2}$/.test(month) || (from && month < from) || (to && month > to)) continue;
    if (!USAGE_ENVS.includes(row.env) || !USAGE_KINDS.includes(row.kind)) continue;
    const count = row.count === undefined ? 1 : Number(row.count);
    if (!Number.isSafeInteger(count) || count <= 0) continue;
    const key = `${month}|${row.env}`;
    const entry = map.get(key) || { month, env: row.env, efatura: 0, earsiv: 0, esmm: 0 };
    entry[row.kind] += count;
    map.set(key, entry);
  }
  return [...map.values()].sort((a, b) => a.month.localeCompare(b.month) || (a.env === b.env ? 0 : a.env === "live" ? -1 : 1));
}

/**
 * KÂHİN KARŞILAŞTIRMASI İÇİN SAF UÇTAN UCA İŞLEV (veri tabanı yok): durum yazımları listesi → ay × ortam × tür sayıları. Programın yolu ile aynı adımlar:
 * usageTransition → (confirmed ise) attemptAtOf(history) → tür / ay → aynı ETTN + ortam ilk yazım kazanır → summarizeUsage.
 * @param {{ ettn: string, env: "test"|"live", profile: string, action: string, previous: { eStatus?: string, eAdapter?: string }, status: string,
 *   at: string, history?: { type: string, payload?: object, at: string }[] }[]} transitions yazım sırasıyla (at: yazımın ISO anı; history: o ana kadarki
 *   belge İşlem Geçmişi, yalnız "confirmed" için okunur)
 * @returns {{ month: string, env: string, efatura: number, earsiv: number, esmm: number }[]}
 */
export function usageFromTransitions(transitions = [], { from = "", to = "" } = {}) {
  const seen = new Map();
  for (const item of transitions) {
    const kind = usageTransition(item);
    if (!kind) continue;
    const type = usageKindOf(item.profile);
    const uuid = String(item.ettn || "").trim().toLowerCase();
    const month = monthOfLocal((kind === "confirmed" && attemptAtOf(item.history || [])) || item.at);
    if (!type || !uuid || !USAGE_ENVS.includes(item.env) || !month) continue;
    const key = `${uuid}|${item.env}`;
    if (!seen.has(key)) seen.set(key, { month, env: item.env, kind: type });
  }
  return summarizeUsage([...seen.values()], { from, to });
}

/** Bir veri tabanının (şirketin) sayaç satırları, ay × ortam × tür toplamı. db: better-sqlite3 benzeri (prepare) ya da store (all). */
export function usageRowsOf(db, { from = "" } = {}) {
  const sql = "SELECT month, env, kind, COUNT(*) AS count FROM edoc_usage WHERE month >= ? GROUP BY month, env, kind";
  try {
    if (typeof db?.all === "function") return db.all(sql, from);
    return db.prepare(sql).all(from);
  } catch {
    return [];
  }
}
