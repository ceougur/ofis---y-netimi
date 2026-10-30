// 2.4.8 M2 — cloudflared çıktısının günlük dosyası (müşteri makinesinde tanı; CLAUDE.md "KULLANICI BULGUSU 2.4.7 CANLI": çıktı hiçbir yere yazılmıyordu).
//
// Dosya: <veri>/bilesenler/cloudflared/cloudflared.log (tünel yöneticisinin bileşen klasörü; şirket verisinin dışında, yedeğe girmez).
// Boyut sınırlı ve döndürmeli: dosya `maxBytes`'ı aşacaksa cloudflared.log.1'e taşınır (öncekinin üzerine), yenisi açılır → diskte en çok 2 × maxBytes, son
// satırlar her zaman cloudflared.log'da. Satır başına programın saati eklenir (cloudflared'in kendi saati de satırda kalır).
// GİZLİ BİLGİ YAZILMAZ: çalışma belirteci (TUNNEL_TOKEN; yalnız bellekte) ve belirteç biçimli değerler (base64 JSON "eyJ…") "[gizli]" olur; token= / secret= /
// password= / authorization: biçimli değerler de. Yazma hatası (disk dolu, kilitli dosya) tüneli ETKİLEMEZ — sessizce atlanır.
import { appendFileSync, renameSync, statSync } from "node:fs";

export const LOG_MAX_BYTES = 512 * 1024;
const LINE_MAX = 2_000;
const TOKEN_LIKE = /eyJ[A-Za-z0-9+/_-]{16,}={0,2}/g;
const KEY_VALUE = /\b(token|secret|password|passwd|authorization|credentials?|tunnel_?secret)(\s*[=:]\s*)("[^"]*"|\S+)/gi;

/** Satırdaki gizli değerleri siler (bilinen belirteçler + biçimler). */
export function redact(line, secrets = []) {
  let out = String(line);
  for (const secret of secrets) if (typeof secret === "string" && secret.length >= 8) out = out.split(secret).join("[gizli]");
  return out.replace(TOKEN_LIKE, "[gizli]").replace(KEY_VALUE, (_, key, sep) => `${key}${sep}[gizli]`);
}

/**
 * @param {object} o
 * @param {() => string} o.file günlük dosyası yolu (klasör tünel yöneticisince açılır)
 * @param {number} [o.maxBytes]
 * @param {() => string[]} [o.secrets] gizlenecek değerler (her satırda yeniden okunur)
 * @param {() => number} [o.now]
 */
export function createLineLog({ file, maxBytes = LOG_MAX_BYTES, secrets = () => [], now = () => Date.now() }) {
  let size = null;
  return {
    append(line) {
      try {
        const clean = redact(line, secrets()).replace(/[\r\n]+/g, " ").slice(0, LINE_MAX);
        const text = `${new Date(now()).toISOString()} ${clean}\n`;
        const bytes = Buffer.byteLength(text);
        const target = file();
        if (size === null) {
          try {
            size = statSync(target).size;
          } catch {
            size = 0;
          }
        }
        if (size > 0 && size + bytes > maxBytes) {
          renameSync(target, `${target}.1`);
          size = 0;
        }
        appendFileSync(target, text);
        size += bytes;
      } catch {
        size = null; // bir sonraki satırda boyut yeniden okunur
      }
    },
  };
}
