// İstek kimliği (v2.0.22, Excel denetimi bulgusu madde 5): aynı fatura isteği iki kez gelince iki fatura açılıyordu.
// Ekrandaki çift tıklama zaten engelli; asıl risk yük altında yanıt gecikince (istemci 30 sn bekler) kullanıcının yeniden
// "Kaydet"e basması ya da ağın isteği yinelemesi: sunucu ilkini kaydetmiştir, ikincisi ikinci belge açar.
// Kural (yaygın ödeme/muhasebe sistemlerindeki "idempotency key" gibi):
//  - kimlik formun açıldığı anda istemcide üretilir; aynı formun her gönderiminde aynı kimlik gider;
//  - sunucu kimliği kullanıcı + işlem adıyla saklar; aynı kimlik ikinci kez gelirse yeni belge açmaz, ilk sonucu döndürür;
//  - aynı kimlik FARKLI içerikle gelirse (ilk kayıttan sonra form değiştirildi) 409 — sessizce eskisi dönmez;
//  - yalnız BAŞARILI sonuç saklanır: reddedilen istek (ör. "Kasa eksiye düşecek" sorusu) aynı kimlikle yeniden gönderilir;
//  - kimliksiz istek ve kimliği farklı iki aynı içerikli fatura (gerçekten iki satış) eskisi gibi serbesttir.
// Saklama süreç belleğinde (24 saat, en çok 5.000 kimlik): sunucu yeniden başlarsa önceki kimlikler unutulur (bilinen sınır;
// yinelenen gönderim saniyeler içinde olur).
import { createHash } from "node:crypto";
import { HttpError } from "./http.mjs";

const FORMAT = /^[A-Za-z0-9_-]{16,100}$/;
// Zorlama bayrakları (eksi stok / eksi Kasa onayı) içerik sayılmaz: onaydan sonraki yeniden gönderim aynı istektir.
const VOLATILE = new Set(["force", "stockForce", "cashForce", "requestId"]);

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

export function createIdempotency({ ttlMs = 24 * 3_600_000, max = 5000, now = () => Date.now() } = {}) {
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
    key(user, scope, requestId) {
      const id = String(requestId || "").trim();
      if (!id) return "";
      if (!FORMAT.test(id)) throw new HttpError(400, "İstek kimliği geçerli değil.", { code: "request-id-invalid" });
      return `${user?.id || ""}|${scope}|${id}`;
    },
    /** Daha önce başarıyla işlenmişse { refId }; içerik farklıysa 409; yoksa null. */
    lookup(key, hash, conflictMessage = "Bu istek daha önce farklı içerikle kaydedildi.") {
      if (!key) return null;
      prune();
      const entry = done.get(key);
      if (!entry) return null;
      if (entry.hash !== hash) throw new HttpError(409, typeof conflictMessage === "function" ? conflictMessage(entry.refId) : conflictMessage, { code: "request-id-reused", refId: entry.refId });
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
