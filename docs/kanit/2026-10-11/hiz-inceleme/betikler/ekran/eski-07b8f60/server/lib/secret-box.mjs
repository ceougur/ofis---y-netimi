// Gizli değer kasası (v2.0.15): müşterinin kendi entegratör parolası gibi değerler veritabanında AÇIK METİN olarak
// tutulmaz. AES-256-GCM ile şifrelenir; anahtar veri klasöründe ayrı bir dosyadadır (secret.key, ilk kullanımda rastgele
// üretilir, yalnız sahibi okuyabilir). Veritabanı yedeği başka bir bilgisayara taşınırsa anahtar gelmez: parola yeniden
// girilir (bilinçli tercih — yedek dosyası tek başına parolayı açığa çıkarmaz).
import { createCipheriv, createDecipheriv, randomBytes } from "node:crypto";
import { chmodSync, existsSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";

const PREFIX = "sb1:";

export function createSecretBox(dataDir) {
  const file = path.join(dataDir, "secret.key");
  let key = null;
  const load = () => {
    if (key) return key;
    if (existsSync(file)) {
      const raw = readFileSync(file);
      if (raw.length === 32) key = raw;
    }
    if (!key) {
      key = randomBytes(32);
      writeFileSync(file, key, { mode: 0o600 });
      try {
        chmodSync(file, 0o600);
      } catch {
        // Windows'ta izin biti yok sayılır; dosya program klasöründe kalır.
      }
    }
    return key;
  };
  return {
    seal(value) {
      const text = String(value ?? "");
      if (!text) return "";
      const iv = randomBytes(12);
      const cipher = createCipheriv("aes-256-gcm", load(), iv);
      const body = Buffer.concat([cipher.update(text, "utf8"), cipher.final()]);
      return `${PREFIX}${Buffer.concat([iv, cipher.getAuthTag(), body]).toString("base64")}`;
    },
    open(sealed) {
      const text = String(sealed ?? "");
      if (!text.startsWith(PREFIX)) return "";
      try {
        const raw = Buffer.from(text.slice(PREFIX.length), "base64");
        const decipher = createDecipheriv("aes-256-gcm", load(), raw.subarray(0, 12));
        decipher.setAuthTag(raw.subarray(12, 28));
        return Buffer.concat([decipher.update(raw.subarray(28)), decipher.final()]).toString("utf8");
      } catch {
        // Anahtar değişmiş (yedek başka bilgisayara taşınmış) ya da değer bozuk: parola yeniden girilmeli.
        return "";
      }
    },
    isSealed: value => String(value ?? "").startsWith(PREFIX),
  };
}
