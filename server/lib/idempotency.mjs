// İstek kimliği (v2.0.22, Excel denetimi bulgusu madde 5): aynı fatura isteği iki kez gelince iki fatura açılıyordu.
// Ekrandaki çift tıklama zaten engelli; asıl risk yük altında yanıt gecikince (istemci 30 sn bekler) kullanıcının yeniden
// "Kaydet"e basması ya da ağın isteği yinelemesi: sunucu ilkini kaydetmiştir, ikincisi ikinci belge açar.
// Kural (yaygın ödeme/muhasebe sistemlerindeki "idempotency key" gibi):
//  - kimlik formun açıldığı anda istemcide üretilir; aynı formun her gönderiminde aynı kimlik gider;
//  - sunucu kimliği kullanıcı + işlem adıyla saklar; aynı kimlik ikinci kez gelirse yeni belge açmaz, ilk sonucu döndürür;
//  - aynı kimlik FARKLI içerikle gelirse (ilk kayıttan sonra form değiştirildi) 409 — sessizce eskisi dönmez;
//  - yalnız BAŞARILI sonuç saklanır: reddedilen istek (ör. "Kasa eksiye düşecek" sorusu) aynı kimlikle yeniden gönderilir;
//  - kimliksiz istek ve kimliği farklı iki aynı içerikli fatura (gerçekten iki satış) eskisi gibi serbesttir.
// v2.1.0 (banka planı §3.10/1, §5.2): saklama şirketin VERİ TABANINDA (request_keys) ve yazımla AYNI işlemde — belge yazıldıysa
// kimlik de yazılmıştır, biri geri alınırsa ikisi birden; sunucu yeniden başlasa da hatırlanır. 30 günden eskiler unutulur ve
// budanır (en çok saatte bir). Depo verilmezse (kütüphane testleri) eski bellek kipi: 24 saat, en çok 5.000 kimlik.
import { createHash } from "node:crypto";
import { systemClock } from "./clock.mjs";
import { HttpError } from "./http.mjs";

const FORMAT = /^[A-Za-z0-9_-]{16,100}$/;
// Zorlama bayrakları (eksi stok / eksi Kasa onayı, v2.1.0: Benzer İşlem "Yine de Kaydet") içerik sayılmaz: onaydan sonraki yeniden gönderim
// aynı istektir (banka planı §3.10/2).
const VOLATILE = new Set(["force", "stockForce", "cashForce", "requestId", "similarOk"]);

const stable = value => {
  if (Array.isArray(value)) return `[${value.map(stable).join(",")}]`;
  if (value && typeof value === "object") {
    return `{${Object.keys(value)
      .filter(key => !VOLATILE.has(key))
      .sort()
      .map(key => `${JSON.stringify(key)}:${stable(value[key])}`)
      .join(",")}}`;
  }
  return JSON.stringify(value ?? null);
};
export const bodyHash = body => createHash("sha256").update(stable(body)).digest("hex");

const DAY_MS = 86_400_000;
const formatKey = (user, scope, requestId) => {
  const id = String(requestId || "").trim();
  if (!id) return "";
  if (!FORMAT.test(id)) throw new HttpError(400, "İstek kimliği geçerli değil.", { code: "request-id-invalid" });
  return `${user?.id || ""}|${scope}|${id}`;
};
const conflict = (message, refId) => new HttpError(409, typeof message === "function" ? message(refId) : message, { code: "request-id-reused", refId });

/**
 * Kalıcı istek kimliği (request_keys). now: iş saati (context.now; ms döndüren işlev de olur). Kimlik yazımı (remember) belge
 * yazımıyla aynı store.tx içinde yapılır; işlem dışında çağrılırsa kendi işlemini açar.
 */
function createStoredIdempotency({ store, ttlMs = 30 * DAY_MS, now = systemClock, pruneEveryMs = 3_600_000 }) {
  const ms = () => {
    const value = now();
    return value instanceof Date ? value.getTime() : Number(value);
  };
  const iso = value => new Date(value).toISOString();
  let prunedAt = Number.NEGATIVE_INFINITY;
  const prune = () => {
    const at = ms();
    if (at - prunedAt < pruneEveryMs) return;
    prunedAt = at;
    store.run("DELETE FROM request_keys WHERE created_at < ?", iso(at - ttlMs));
  };
  const live = key => store.get("SELECT body_hash AS hash, ref_id AS refId FROM request_keys WHERE key = ? AND created_at >= ?", key, iso(ms() - ttlMs));
  return {
    key: formatKey,
    /** Daha önce başarıyla işlenmişse { refId }; içerik farklıysa 409; yoksa (ya da 30 günden eskiyse) null. */
    lookup(key, hash, conflictMessage = "Bu istek daha önce farklı içerikle kaydedildi.") {
      if (!key) return null;
      const entry = live(key);
      if (!entry) return null;
      if (entry.hash !== hash) throw conflict(conflictMessage, entry.refId);
      return { refId: entry.refId };
    },
    /** Belgeyle aynı işlemde yazılır. Aynı anahtar etkin bir kayıtla zaten varsa (başka bir yazım önce davrandı) 409. */
    remember(key, hash, refId) {
      if (!key) return;
      const write = () => {
        const [userId, scope] = key.split("|");
        // Süresi dolmuş eski kayıt yerini yeniye bırakır; etkin kayıt varsa INSERT birincil anahtarda düşer.
        store.run("DELETE FROM request_keys WHERE key = ? AND created_at < ?", key, iso(ms() - ttlMs));
        const existing = live(key);
        if (existing) throw conflict(existing.hash === hash ? "Bu istek az önce kaydedildi; sayfayı yenileyip kayıtlı belgeyi açın." : "Bu istek daha önce farklı içerikle kaydedildi.", existing.refId);
        store.run("INSERT INTO request_keys (key, scope, user_id, body_hash, ref_id, created_at) VALUES (?, ?, ?, ?, ?, ?)", key, scope || "", userId || "", hash, String(refId), iso(ms()));
        prune();
      };
      return store.inTransaction ? write() : store.tx(write);
    },
    size: () => store.get("SELECT COUNT(*) AS n FROM request_keys WHERE created_at >= ?", iso(ms() - ttlMs)).n,
  };
}

export function createIdempotency({ store = null, ttlMs, max = 5000, now } = {}) {
  if (store) return createStoredIdempotency({ store, ...(ttlMs ? { ttlMs } : {}), ...(now ? { now } : {}) });
  return createMemoryIdempotency({ ttlMs: ttlMs ?? 24 * 3_600_000, max, now: now ?? (() => systemClock.ms()) });
}

function createMemoryIdempotency({ ttlMs, max, now }) {
  const done = new Map(); // anahtar → { at, hash, refId }
  const prune = () => {
    const limit = now() - ttlMs;
    for (const [key, entry] of done) {
      if (entry.at >= limit && done.size <= max) break;
      done.delete(key);
    }
  };
  return {
    /** Geçerli kimlikten anahtar (kullanıcı + işlem + kimlik); kimlik yok ya da biçimsizse "" (koruma uygulanmaz). */
    key: formatKey,
    /** Daha önce başarıyla işlenmişse { refId }; içerik farklıysa 409; yoksa null. */
    lookup(key, hash, conflictMessage = "Bu istek daha önce farklı içerikle kaydedildi.") {
      if (!key) return null;
      prune();
      const entry = done.get(key);
      if (!entry) return null;
      if (entry.hash !== hash) throw conflict(conflictMessage, entry.refId);
      return { refId: entry.refId };
    },
    remember(key, hash, refId) {
      if (!key) return;
      done.delete(key);
      done.set(key, { at: now(), hash, refId });
      prune();
    },
    size: () => done.size,
  };
}
