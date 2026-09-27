// Formüllerin programda yeniden hesaplanması (v2.0.1).
// Tablo görünümü (dataset.view) oluşturulurken çalışır. Kural:
//   - Bir formülün girdilerinden biri programda değiştiyse (düzeltme, silinen kayıt) ya da formül günün tarihine
//     bağlıysa (TODAY/NOW), formül yeniden hesaplanır ve sonuç kolonun görünüşüyle yazılır ("14.000,00 ₺").
//   - Hiçbir girdi değişmediyse Excel/Sheets'ten gelen değer olduğu gibi gösterilir (aynı sonuç, sıfır risk).
//   - Formül hücresini kullanıcı elle değiştirdiyse onun yazdığı geçerlidir.
//   - Desteklenmeyen işlev içeren formül hesaplanmaz; son gelen değer kalır ve ekranda "hesaplanamıyor" diye belirtilir.
// Programda eklenen yeni kayıtlarda, o sekmedeki satırların çoğunda aynı olan (yalnızca kendi satırına bakan) kolon
// formülü uygulanır; böylece yeni kayıtta da "Kalan" kendiliğinden hesaplanır.
import { UnsupportedFormula, evaluate } from "./evaluate.mjs";
import { Cell, formatValue } from "./values.mjs";

const parsedCache = new Map();
function formulasOf(row) {
  const raw = row.__hofF;
  if (!raw || typeof raw !== "string") return null;
  if (parsedCache.has(raw)) return parsedCache.get(raw);
  let parsed = null;
  try {
    parsed = JSON.parse(raw);
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) parsed = null;
  } catch {
    parsed = null;
  }
  if (parsedCache.size > 50_000) parsedCache.clear();
  parsedCache.set(raw, parsed);
  return parsed;
}

// Yalnızca kendi satırına ve sabitlere bakan formül mü? (Yeni kayıtlara kolon formülü olarak uygulanabilir.)
function selfOnly(node) {
  if (!node || typeof node !== "object") return true;
  if (node.t === "x") return false;
  if (node.t === "fn" && (node.n === "TODAY" || node.n === "NOW")) return true;
  for (const value of Object.values(node)) {
    if (Array.isArray(value)) {
      for (const item of value) if (Array.isArray(item) ? !item.every(selfOnly) : !selfOnly(item)) return false;
    } else if (value && typeof value === "object" && !selfOnly(value)) return false;
  }
  return true;
}

/**
 * @param {Array<Record<string,string>>} rows   Birleşik görünüm satırları (düzeltmeler uygulanmış). Yerinde değişir.
 * @param {{ changedFields: WeakMap<object, Set<string>>, now?: Date }} options
 *   changedFields: içeri alınan satırda programda değiştirilmiş alanlar. Programda eklenen kayıtlar (__hofRecord)
 *   bütünüyle değişmiş sayılır.
 */
export function computeFormulas(rows, { changedFields = new WeakMap(), now = new Date() } = {}) {
  const index = new Map();
  let any = false;
  for (const row of rows) {
    if (row.__hofAt && !index.has(row.__hofAt)) index.set(row.__hofAt, row);
    if (row.__hofF) any = true;
  }
  if (!any) return strip(rows);

  // Sekme kolon formülleri (yeni kayıtlar için) ve biçim örnekleri.
  const templates = new Map();
  const samples = new Map();
  const counts = new Map();
  for (const row of rows) {
    const map = formulasOf(row);
    if (!map) continue;
    const tab = String(row.__sheet || "");
    for (const [field, entry] of Object.entries(map)) {
      if (!entry?.b || !selfOnly(entry.b)) continue;
      const signature = JSON.stringify(entry.b);
      const key = `${tab}\u0000${field}`;
      if (!counts.has(key)) counts.set(key, { total: 0, by: new Map() });
      const bucket = counts.get(key);
      bucket.total += 1;
      const item = bucket.by.get(signature) || { count: 0, entry };
      item.count += 1;
      bucket.by.set(signature, item);
      if (!samples.has(key) && String(row[field] ?? "").trim()) samples.set(key, row[field]);
    }
  }
  for (const [key, bucket] of counts) {
    let best = null;
    for (const item of bucket.by.values()) if (!best || item.count > best.count) best = item;
    if (best && best.count >= 2 && best.count >= bucket.total * 0.5) templates.set(key, best.entry);
  }
  const sampleFor = (row, field) => samples.get(`${String(row.__sheet || "")}\u0000${field}`) || "";

  const appRecord = row => Boolean(row.__hofRecord);
  const entriesOf = row => {
    const own = formulasOf(row);
    if (own) return own;
    if (!appRecord(row)) return null;
    // Programda eklenen kayıt: o sekmenin kolon formülleri, kullanıcının boş bıraktığı alanlara uygulanır.
    const tab = String(row.__sheet || "");
    let result = null;
    for (const [key, entry] of templates) {
      const [templateTab, field] = key.split("\u0000");
      if (templateTab !== tab || String(row[field] ?? "").trim()) continue;
      result ??= {};
      result[field] = entry;
    }
    row.__hofTemplate = result;
    return result;
  };
  const changed = (row, field) => appRecord(row) || Boolean(changedFields.get(row)?.has(field));

  const memo = new Map();
  function compute(row, field) {
    let rowMemo = memo.get(row);
    if (!rowMemo) memo.set(row, (rowMemo = new Map()));
    if (rowMemo.has(field)) return rowMemo.get(field);
    const entries = row.__hofTemplate !== undefined ? row.__hofTemplate : entriesOf(row);
    const entry = entries?.[field];
    let result;
    if (!entry || (changed(row, field) && !(appRecord(row) && row.__hofTemplate?.[field]))) {
      // Formülsüz alan ya da kullanıcının elle değiştirdiği formül hücresi: değeri olduğu gibi.
      result = { value: new Cell(row[field] ?? ""), dirty: changed(row, field), ok: true, manual: Boolean(entry) };
    } else if (entry.u || !entry.b) {
      result = { value: new Cell(row[field] ?? ""), dirty: false, ok: false };
    } else {
      result = evaluateEntry(row, field, entry);
    }
    rowMemo.set(field, result);
    return result;
  }

  const inProgress = new Set();
  function evaluateEntry(row, field, entry) {
    const marker = { row, field };
    for (const item of inProgress) if (item.row === row && item.field === field) return { value: new Cell(row[field] ?? ""), dirty: false, ok: false, circular: true };
    inProgress.add(marker);
    let dirty = false;
    const env = {
      now,
      onVolatile: () => {
        dirty = true;
      },
      cell(node) {
        if (node.t === "l") return new Cell(node.v);
        if (node.t === "f") {
          const result = compute(row, node.f);
          if (result.dirty) dirty = true;
          if (result.circular) throw new UnsupportedFormula("Döngüsel başvuru");
          return result.value;
        }
        const target = index.get(node.k);
        if (!target) {
          dirty = true; // kayıt silinmiş ya da artık yok: boş sayılır
          return null;
        }
        const result = compute(target, node.f);
        if (result.dirty) dirty = true;
        if (result.circular) throw new UnsupportedFormula("Döngüsel başvuru");
        return result.value;
      },
    };
    try {
      const value = evaluate(entry.b, env);
      return { value, dirty, ok: true };
    } catch (error) {
      if (error instanceof UnsupportedFormula || error instanceof RangeError) return { value: new Cell(row[field] ?? ""), dirty: false, ok: false };
      throw error;
    } finally {
      inProgress.delete(marker);
    }
  }

  const updates = [];
  for (const row of rows) {
    const entries = entriesOf(row);
    if (!entries) continue;
    const info = {};
    for (const [field, entry] of Object.entries(entries)) {
      const result = compute(row, field);
      let state = "source";
      if (result.manual) state = "manual";
      else if (!result.ok) state = entry.u ? "unsupported" : "stale";
      else if (result.dirty) {
        const sample = String(row[field] ?? "").trim() ? row[field] : sampleFor(row, field);
        updates.push([row, field, formatValue(result.value, sample)]);
        state = "calc";
      }
      info[field] = { d: String(entry.d || "").slice(0, 500), s: state };
    }
    row.__hofFx = JSON.stringify(info);
  }
  for (const [row, field, value] of updates) row[field] = value;
  return strip(rows);
}

// İç formül alanları istemciye gönderilmez (boyut); arayüz yalnızca __hofFx özetini kullanır.
function strip(rows) {
  for (const row of rows) {
    delete row.__hofF;
    delete row.__hofAt;
    delete row.__hofTemplate;
  }
  return rows;
}
