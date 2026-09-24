// Merkezi veri kaynağı: Google Sheets veya sunucuya yüklenmiş Excel anlık görüntüsü.
// Sunucu, kaynak satırlarına ofisin düzeltmelerini (override), silmelerini ve yeni kayıtlarını
// uygulayarak TEK bir birleşik görünüm üretir; tüm bilgisayarlar aynı tabloyu görür.
import { createHash, randomUUID } from "node:crypto";
import { HttpError, parseJson } from "./http.mjs";
import { fold, matrixToRecords } from "./sections.mjs";

export const EXCEL_PREFIX = "excel://";
export const CASE_KEY_PATTERN = /\b(?:19|20)\d{2}\/\d+\b/;
const CASE_FIELD_NAMES = ["dosya no", "dosya numarası", "dosya numarasi", "dosya", "esas", "esas no"];

const normalize = value => String(value ?? "").trim().toLocaleLowerCase("tr-TR").replace(/[İI]/g, "i").replace(/ı/g, "i");

export function columnOrder(rows) {
  const seen = new Set();
  const order = [];
  for (const row of rows) {
    for (const key of Object.keys(row)) {
      if (key.startsWith("__") || !key.trim() || seen.has(key)) continue;
      seen.add(key);
      order.push(key);
    }
  }
  return order;
}

// v1.0.0 istemcisi dosya kimliğini satır metnindeki ilk "yyyy/sayı" kalıbından çıkarıyordu;
// aynı kural korunur ki eski düzeltmeler ve silmeler aynı satırlara bağlı kalsın.
export function canonicalCaseKey(row, columns) {
  for (const column of columns) {
    const value = row[column];
    if (!value) continue;
    const match = String(value).match(CASE_KEY_PATTERN);
    if (match) return match[0];
  }
  for (const column of columns) {
    if (CASE_FIELD_NAMES.includes(normalize(column))) {
      const value = String(row[column] ?? "").trim();
      if (value) return value;
    }
  }
  const fingerprint = JSON.stringify([row.__sheet || "", ...columns.map(column => String(row[column] ?? "").trim())]);
  return `satir:${createHash("sha1").update(fingerprint).digest("hex").slice(0, 16)}`;
}

// Kolon adı değiştiyse (ör. eski okuyucu üst başlıkla kolon başlığını birleştirip "GAYRİMENKUL … SIRA" diyordu,
// yeni okuyucu yalnızca "SIRA" diyor) ofisin o kolondaki düzeltmesi kaybolmasın: eski ad yeni adla bitiyorsa taşınır.
function applyPatch(row, patch) {
  const result = { ...row };
  let keys = null;
  for (const [field, value] of Object.entries(patch)) {
    if (field in row || field.startsWith("__")) {
      result[field] = value;
      continue;
    }
    keys ??= Object.keys(row).filter(key => !key.startsWith("__")).map(key => [key, fold(key)]);
    const folded = fold(field);
    const matches = keys.filter(([, name]) => name && (folded === name || folded.endsWith(` ${name}`)));
    result[matches.length === 1 ? matches[0][0] : field] = value;
  }
  return result;
}

export function mergeView(store, sourceName, rows) {
  const columns = columnOrder(rows);
  const overrides = new Map();
  for (const item of store.all("SELECT case_key, field, value FROM overrides WHERE source_name = ?", sourceName)) {
    if (!overrides.has(item.case_key)) overrides.set(item.case_key, {});
    overrides.get(item.case_key)[item.field] = item.value;
  }
  const deleted = new Set(store.all("SELECT case_key FROM deleted_records WHERE source_name = ?", sourceName).map(item => item.case_key));
  const merged = [];
  const records = store.all("SELECT id, case_key, values_json FROM records WHERE source_name = ? ORDER BY created_at DESC", sourceName);
  for (const record of records) {
    if (deleted.has(record.case_key)) continue;
    merged.push({ ...parseJson(record.values_json), ...(overrides.get(record.case_key) || {}), __hofKey: record.case_key, __hofRecord: record.id });
  }
  for (const row of rows) {
    const key = canonicalCaseKey(row, columns);
    if (deleted.has(key)) continue;
    const patch = overrides.get(key);
    merged.push(patch ? { ...applyPatch(row, patch), __hofKey: key } : { ...row, __hofKey: key });
  }
  return merged;
}

export function createSourceService({ store, audit, readGoogleSheet, bumpClientState }) {
  const parsedSnapshots = new Map();

  const snapshotRows = snapshot => {
    const cacheKey = `${snapshot.id}|${snapshot.uploaded_at}`;
    let parsed = parsedSnapshots.get(cacheKey);
    if (!parsed) {
      parsed = { rows: parseJson(snapshot.rows_json, []), tabs: parseJson(snapshot.tabs_json, []) };
      parsedSnapshots.clear();
      parsedSnapshots.set(cacheKey, parsed);
    }
    return parsed;
  };

  async function loadSource(sheetUrl) {
    const sourceUrl = String(sheetUrl || "").trim();
    if (!sourceUrl) return { connected: false, sourceUrl, syncedAt: null, rows: [], tabs: [], message: "Henüz bir veri kaynağı seçilmedi." };
    if (sourceUrl.startsWith(EXCEL_PREFIX)) {
      const snapshot = store.get("SELECT * FROM source_snapshots WHERE source_key = ?", sourceUrl);
      if (!snapshot) return { connected: false, sourceUrl, syncedAt: null, rows: [], tabs: [], message: "Bu Excel tablosu sunucuda bulunamadı. Dosyayı yeniden yükleyin." };
      const { rows, tabs } = snapshotRows(snapshot);
      return {
        connected: true,
        sourceUrl,
        syncedAt: snapshot.uploaded_at,
        rows,
        tabs: tabs.map(title => ({ gid: "", title })),
        message: `"${snapshot.file_name}" merkezi Excel tablosu · ${rows.length} kayıt`,
      };
    }
    return readGoogleSheet(sourceUrl);
  }

  async function view(sheetUrl) {
    const result = await loadSource(sheetUrl);
    if (!result.connected) return result;
    return { ...result, rows: mergeView(store, result.sourceUrl, result.rows) };
  }

  function saveExcel(user, body) {
    const fileName = String(body.fileName || "").trim().replace(/[\\/]+/g, "_");
    if (!fileName) throw new HttpError(400, "Dosya adı gerekli.");
    if (fileName.length > 180) throw new HttpError(400, "Dosya adı çok uzun.");
    // Yeni istemci sayfaları ham hücre matrisi olarak gönderir; sunucu alt tabloları (bölümleri) ayırır.
    // Eski istemci (güncelleme sırasında açık kalmış sayfa) satırları hazır gönderir; o da kabul edilir.
    let incoming = body.rows;
    let parsedTabs = null;
    if (Array.isArray(body.sheets)) {
      if (body.sheets.length > 200) throw new HttpError(400, "Dosyada en fazla 200 sayfa olabilir.");
      incoming = [];
      parsedTabs = [];
      let cells = 0;
      for (const sheet of body.sheets) {
        const name = String(sheet?.name ?? "").trim().slice(0, 200);
        const matrix = Array.isArray(sheet?.matrix) ? sheet.matrix.slice(0, 200_001).map(line => (Array.isArray(line) ? line.slice(0, 500).map(cell => String(cell ?? "").slice(0, 20_000)) : [])) : [];
        cells += matrix.reduce((total, line) => total + line.length, 0);
        if (cells > 20_000_000) throw new HttpError(400, "Tablo çok büyük (en fazla 20 milyon hücre).");
        const parsed = matrixToRecords(matrix, name);
        for (const row of parsed.rows) incoming.push(row); // yayma (...) büyük sayfalarda çağrı yığınını taşırır
        for (const label of parsed.tabs) if (label && !parsedTabs.includes(label)) parsedTabs.push(label);
      }
    }
    if (!Array.isArray(incoming)) throw new HttpError(400, "Tablo satırları okunamadı.");
    if (incoming.length > 200_000) throw new HttpError(400, "Tablo en fazla 200.000 satır içerebilir.");
    const rows = [];
    for (const item of incoming) {
      if (!item || typeof item !== "object" || Array.isArray(item)) continue;
      const entries = Object.entries(item).slice(0, 500);
      const row = {};
      for (const [key, value] of entries) {
        const name = String(key).trim().slice(0, 200);
        if (!name) continue;
        row[name] = String(value ?? "").slice(0, 20_000);
      }
      if (Object.entries(row).some(([key, value]) => key !== "__sheet" && value.trim())) rows.push(row);
    }
    const tabs = parsedTabs ?? (Array.isArray(body.tabs) ? body.tabs.map(item => String(item).slice(0, 200)).filter(Boolean).slice(0, 200) : []);
    const sourceKey = `${EXCEL_PREFIX}${fileName}`;
    const rowsJson = JSON.stringify(rows);
    const timestamp = new Date().toISOString();
    store.tx(() => {
      const existing = store.get("SELECT id FROM source_snapshots WHERE source_key = ?", sourceKey);
      const id = existing?.id || `snapshot-${randomUUID()}`;
      store.run(
        `INSERT INTO source_snapshots (id, source_key, file_name, tabs_json, rows_json, row_count, size_bytes, uploaded_by, uploaded_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
         ON CONFLICT(source_key) DO UPDATE SET file_name = excluded.file_name, tabs_json = excluded.tabs_json, rows_json = excluded.rows_json,
           row_count = excluded.row_count, size_bytes = excluded.size_bytes, uploaded_by = excluded.uploaded_by, uploaded_at = excluded.uploaded_at`,
        id, sourceKey, fileName, JSON.stringify(tabs), rowsJson, rows.length, Buffer.byteLength(rowsJson), user.id, timestamp,
      );
      store.setSetting("client.sheetUrl", sourceKey, user.id);
      store.setSetting("client.activeSourceLabel", fileName, user.id);
      bumpClientState(user.id);
      audit(user, "source.excel.uploaded", id, { sourceKey, fileName, rows: rows.length, replaced: Boolean(existing) });
    });
    return { sourceKey, fileName, rowCount: rows.length, tabs };
  }

  return { loadSource, view, saveExcel };
}
