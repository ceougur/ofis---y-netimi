// Kayda eklenen belgeler (v2.0.1): PDF, resim ve ekran görüntüsü, Word/Excel/PowerPoint, UYAP (.udf), metin.
// Dosyalar veri klasöründe (belgeler/) içerik özetiyle (SHA-256) saklanır: aynı dosya iki kez yer kaplamaz ve bir
// dosyanın üzerine asla yazılmaz. Veritabanı yedeği yalnızca belge kayıtlarını içerir; dosyalar yerinde kalır.
// Silinen belgenin dosyası 30 gün tutulur (yedekten geri dönülürse belge açılabilsin), sonra temizlenir.
// Güvenlik: tür yalnızca uzantıdan değil dosyanın ilk baytlarından da doğrulanır; tarayıcıda yalnızca PDF ve
// resimler açılır, diğerleri indirilir. HTML, SVG, betik ve çalıştırılabilir dosyalar kabul edilmez.
import { createHash } from "node:crypto";
import { existsSync, mkdirSync, readdirSync, readFileSync, renameSync, rmSync, statSync, writeFileSync } from "node:fs";
import path from "node:path";

export const MAX_DOCUMENT_BYTES = 25 * 1024 * 1024;
const KEEP_DELETED_DAYS = 30;

const starts = (buffer, bytes, offset = 0) => bytes.every((byte, index) => buffer[offset + index] === byte);
const ascii = (buffer, text, offset = 0) => buffer.subarray(offset, offset + text.length).toString("latin1") === text;
const ZIP = buffer => starts(buffer, [0x50, 0x4b, 0x03, 0x04]);
const OLE = buffer => starts(buffer, [0xd0, 0xcf, 0x11, 0xe0, 0xa1, 0xb1, 0x1a, 0xe1]);
// Metin: ilk 64 KB'ta NUL baytı yok (UTF-8 ya da Türkçe Windows kodlaması).
const TEXT = buffer => !buffer.subarray(0, 65_536).includes(0);

// kind: arayüzdeki simge ve davranış; viewable: tarayıcıda açılır (PDF görüntüleyici / resim).
const TYPES = {
  pdf: { kind: "pdf", mime: "application/pdf", viewable: true, check: buffer => ascii(buffer, "%PDF-") },
  jpg: { kind: "image", mime: "image/jpeg", viewable: true, check: buffer => starts(buffer, [0xff, 0xd8, 0xff]) },
  png: { kind: "image", mime: "image/png", viewable: true, check: buffer => starts(buffer, [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]) },
  gif: { kind: "image", mime: "image/gif", viewable: true, check: buffer => ascii(buffer, "GIF87a") || ascii(buffer, "GIF89a") },
  webp: { kind: "image", mime: "image/webp", viewable: true, check: buffer => ascii(buffer, "RIFF") && ascii(buffer, "WEBP", 8) },
  tif: { kind: "image", mime: "image/tiff", viewable: false, check: buffer => starts(buffer, [0x49, 0x49, 0x2a, 0x00]) || starts(buffer, [0x4d, 0x4d, 0x00, 0x2a]) },
  doc: { kind: "doc", mime: "application/msword", viewable: false, check: OLE },
  docx: { kind: "doc", mime: "application/vnd.openxmlformats-officedocument.wordprocessingml.document", viewable: false, check: ZIP },
  odt: { kind: "doc", mime: "application/vnd.oasis.opendocument.text", viewable: false, check: ZIP },
  rtf: { kind: "doc", mime: "application/rtf", viewable: false, check: buffer => ascii(buffer, "{\\rtf") },
  xls: { kind: "sheet", mime: "application/vnd.ms-excel", viewable: false, check: OLE },
  xlsx: { kind: "sheet", mime: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet", viewable: false, check: ZIP },
  ods: { kind: "sheet", mime: "application/vnd.oasis.opendocument.spreadsheet", viewable: false, check: ZIP },
  csv: { kind: "sheet", mime: "text/csv", viewable: false, check: TEXT },
  ppt: { kind: "slide", mime: "application/vnd.ms-powerpoint", viewable: false, check: OLE },
  pptx: { kind: "slide", mime: "application/vnd.openxmlformats-officedocument.presentationml.presentation", viewable: false, check: ZIP },
  udf: { kind: "udf", mime: "application/octet-stream", viewable: false, check: ZIP },
  txt: { kind: "text", mime: "text/plain", viewable: false, check: TEXT },
};
const ALIASES = { jpeg: "jpg", jfif: "jpg", tiff: "tif" };
export const ACCEPTED_EXTENSIONS = Object.freeze([...Object.keys(TYPES), ...Object.keys(ALIASES)]);

// Görünen ad: yol parçaları ve denetim karakterleri atılır, uzantı korunur.
export function cleanDocumentName(value, fallback = "belge") {
  const base = String(value || "").split(/[\\/]/).pop().replace(/[\u0000-\u001f\u007f<>:"|?*]+/g, " ").replace(/\s+/g, " ").trim();
  const name = base.replace(/^\.+/, "") || fallback;
  if (name.length <= 180) return name;
  const dot = name.lastIndexOf(".");
  const ext = dot > 0 && name.length - dot <= 6 ? name.slice(dot) : "";
  return `${name.slice(0, 180 - ext.length).trim()}${ext}`;
}

export function detectDocumentType(name, buffer) {
  const raw = String(name || "").toLowerCase().split(".").pop() || "";
  const ext = ALIASES[raw] || raw;
  const type = TYPES[ext];
  if (!type) return { error: `Bu dosya türü eklenemez (.${raw || "?"}). PDF, resim (JPG, PNG), Word, Excel, PowerPoint, UYAP (.udf) veya metin dosyası seçin.` };
  if (!buffer.length) return { error: "Dosya boş." };
  if (!type.check(buffer)) return { error: `Dosyanın içeriği .${raw} dosyası gibi görünmüyor. Dosyayı kendi programında açıp yeniden kaydedin.` };
  return { ext, ...type };
}

export function createDocumentStore({ dir, log } = {}) {
  const fileOf = sha => path.join(dir, sha.slice(0, 2), sha);
  const valid = sha => /^[0-9a-f]{64}$/.test(String(sha || ""));

  function save(buffer) {
    const sha = createHash("sha256").update(buffer).digest("hex");
    const target = fileOf(sha);
    if (!existsSync(target)) {
      mkdirSync(path.dirname(target), { recursive: true });
      const temp = `${target}.${process.pid}.${Date.now()}.tmp`;
      writeFileSync(temp, buffer);
      renameSync(temp, target);
    }
    return sha;
  }

  function read(sha) {
    if (!valid(sha)) return null;
    try {
      return readFileSync(fileOf(sha));
    } catch {
      return null;
    }
  }

  // Silineli 30 günü geçen kayıtlar kalkar; hiçbir kaydın göstermediği ve 30 günden eski dosyalar silinir.
  // (Yeni dosyalara dokunulmaz: yedekten geri dönülüp yeniden ileri alınırsa belgeler kaybolmasın.)
  function purge(store, now = Date.now()) {
    const cutoff = new Date(now - KEEP_DELETED_DAYS * 86_400_000).toISOString();
    let rows = 0;
    let files = 0;
    try {
      rows = store.run("DELETE FROM case_documents WHERE deleted_at IS NOT NULL AND deleted_at < ?", cutoff).changes;
      if (!existsSync(dir)) return { rows, files };
      const used = new Set(store.all("SELECT DISTINCT sha256 FROM case_documents").map(row => row.sha256));
      for (const bucket of readdirSync(dir)) {
        const folder = path.join(dir, bucket);
        if (!/^[0-9a-f]{2}$/.test(bucket) || !statSync(folder).isDirectory()) continue;
        for (const name of readdirSync(folder)) {
          const file = path.join(folder, name);
          const old = statSync(file).mtimeMs < now - KEEP_DELETED_DAYS * 86_400_000;
          if (name.endsWith(".tmp") ? old : valid(name) && !used.has(name) && old) {
            rmSync(file, { force: true });
            files += 1;
          }
        }
      }
    } catch (error) {
      log?.warn?.("Belge temizliği yapılamadı", error);
    }
    return { rows, files };
  }

  return { save, read, purge, dir };
}
