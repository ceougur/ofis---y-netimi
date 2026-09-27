// Google Sheets okuma: sekme keşfi, CSV dışa aktarımı, alt tabloların (bölümlerin) ayrılması ve kısa süreli önbellek.
// v2.0.1: formüller de okunur (belgenin xlsx dışa aktarımından) ve kayıtlara bağlanır (formula/bind.mjs).
import { createHash } from "node:crypto";
import { attachFormulas, sourceTagOf } from "./formula/bind.mjs";
import { describeFormat, parseCellText } from "./formula/values.mjs";
import { readXlsxFormulas } from "./formula/xlsx.mjs";
import { fillMerges, listOnlySheets, readXlsxLists, resolveChoices } from "./choices.mjs";
import { matrixToRecords } from "./sections.mjs";

export function spreadsheetId(sheetUrl) {
  const match = String(sheetUrl || "").trim().match(/\/spreadsheets\/(?:u\/\d+\/)?d\/([^/?#]+)/i);
  if (!match) throw new Error("Geçerli bir Google Sheets bağlantısı girilmedi.");
  return match[1];
}

// gviz CSV'si kolon türünü tahmin eder ve türe uymayan hücreleri (ör. tarih kolonundaki "RPÇY", sayı kolonundaki alt
// tablo başlıkları) BOŞ döndürür, birden çok başlık satırını da birleştirir. Bu yüzden önce hücreleri ekranda
// göründüğü gibi veren "export" CSV'si denenir; alınamazsa gviz'e düşülür.
export function googleExportUrl(sheetUrl, gid = "0") {
  return `https://docs.google.com/spreadsheets/d/${spreadsheetId(sheetUrl)}/export?format=csv&gid=${encodeURIComponent(gid)}`;
}

export function googleCsvUrl(sheetUrl, gid = "0") {
  return `https://docs.google.com/spreadsheets/d/${spreadsheetId(sheetUrl)}/gviz/tq?tqx=out:csv&gid=${encodeURIComponent(gid)}`;
}

export function googleXlsxUrl(sheetUrl) {
  return `https://docs.google.com/spreadsheets/d/${spreadsheetId(sheetUrl)}/export?format=xlsx`;
}

// keepEmpty: boş satırlar da kalır (satır sırası = sayfadaki satır; formülleri eşlemek için).
export function parseCsv(csv, { keepEmpty = false } = {}) {
  const rows = [];
  let row = [];
  let cell = "";
  let quoted = false;
  for (let index = 0; index < csv.length; index += 1) {
    const char = csv[index];
    const next = csv[index + 1];
    if (char === '"' && quoted && next === '"') {
      cell += '"';
      index += 1;
    } else if (char === '"') quoted = !quoted;
    else if (char === "," && !quoted) {
      row.push(cell.trim());
      cell = "";
    } else if ((char === "\n" || char === "\r") && !quoted) {
      if (char === "\r" && next === "\n") index += 1;
      row.push(cell.trim());
      if (keepEmpty || row.some(value => value.length > 0)) rows.push(row);
      row = [];
      cell = "";
    } else cell += char;
  }
  if (cell.length > 0 || row.length > 0) {
    row.push(cell.trim());
    if (keepEmpty || row.some(value => value.length > 0)) rows.push(row);
  }
  if (keepEmpty) while (rows.length && !rows[rows.length - 1].some(value => value.length > 0)) rows.pop();
  return rows;
}

// Formül hücresinin xlsx'teki son değeri CSV'de görünenle aynı mı? (CSV ile xlsx'in aynı ızgarayı gösterdiğinin kanıtı.)
function sameShownValue(text, value) {
  const parsed = parseCellText(text);
  if (typeof parsed !== "number") return false;
  const format = describeFormat(text);
  const decimals = format?.decimals ?? 0;
  const percent = format?.kind === "percent";
  const tolerance = (percent ? 0.005 : 0.5) * 10 ** -decimals + 1e-9 * Math.max(1, Math.abs(value));
  return Math.abs(parsed - value) <= tolerance;
}

// Sekmelerin formüllerini kayıtlara bağlar. Yalnızca CSV'si xlsx'le hizalı görünen sekmeler (formül hücrelerinin
// çoğunun gösterilen değeri xlsx'teki son değerle aynı) bağlanır; emin olunamazsa formül alınmaz, değerler aynen kalır.
export function bindSheetFormulas(tabs, workbookFormulas, sourceTag) {
  const sheets = [];
  let bound = 0;
  for (const tab of tabs) {
    const found = workbookFormulas.get(tab.title) || null;
    let formulas = [];
    if (found?.formulas.length) {
      let checked = 0;
      let matched = 0;
      for (const [r, c] of found.formulas) {
        const value = found.values.get(`${r}:${c}`);
        const shown = tab.matrix[r]?.[c];
        if (value === undefined || shown === undefined || shown === "") continue;
        checked += 1;
        if (sameShownValue(shown, value)) matched += 1;
      }
      if (!checked || matched >= checked * 0.8) formulas = found.formulas;
    }
    bound += formulas.length;
    sheets.push({ name: tab.title, matrix: tab.matrix, start: { r: 0, c: 0 }, formulas, layout: tab.layout });
  }
  if (bound) attachFormulas(sheets, { sourceTag });
  return bound;
}

// CSV → kayıtlar. Sekmedeki alt tablolar ayrı bölümler olarak ayrılır (bkz. sections.mjs).
export function csvToRecords(csv, tabTitle = "") {
  return matrixToRecords(parseCsv(csv), tabTitle).rows;
}

export function discoverTabs(html) {
  const tabs = [];
  const patterns = [
    /\[(\d+),0,\\"(\d+)\\",\[\{\\"1\\":\[\[0,0,\\"([^"\\]+)\\"/g,
    /"gid"\s*:\s*"?(\d+)"?[^{}]{0,240}?"(?:name|title)"\s*:\s*"([^"\\]+)"/g,
    /"(?:name|title)"\s*:\s*"([^"\\]+)"[^{}]{0,240}?"gid"\s*:\s*"?(\d+)"?/g,
  ];
  for (const [index, pattern] of patterns.entries()) {
    let match;
    while ((match = pattern.exec(html))) {
      const gid = index === 0 ? match[2] : index === 1 ? match[1] : match[2];
      const title = index === 0 ? match[3] : index === 1 ? match[2] : match[1];
      if (gid && title && !tabs.some(tab => tab.gid === gid)) tabs.push({ gid, title });
    }
  }
  return tabs;
}

// Belgenin adı (<title>): "Önemli Dosyalar - Google E-Tablolar" → "Önemli Dosyalar".
const ENTITIES = { amp: "&", lt: "<", gt: ">", quot: '"', "#39": "'", apos: "'" };
export function documentTitle(html) {
  const raw = /<title[^>]*>([^<]*)<\/title>/i.exec(String(html || ""))?.[1] || "";
  return raw
    .replace(/&(amp|lt|gt|quot|#39|apos);/g, (_, name) => ENTITIES[name])
    .replace(/&#(\d+);/g, (_, code) => String.fromCodePoint(Number(code)))
    .replace(/\s+-\s+Google\s.*$/i, "")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 200);
}

export function createSheetsReader({ fetchImpl, cacheMs = 45_000, timeoutMs = 20_000, formulas = true }) {
  const cache = new Map();
  const inflight = new Map();
  // Belge kimliği → { hash (CSV'lerin özeti), byTab } : içerik değişmedikçe xlsx yeniden indirilmez.
  const formulaCache = new Map();

  // xlsx'ten formüller ve açılır listeler (v2.0.2) birlikte okunur.
  async function readFormulas(id, hash) {
    const hit = formulaCache.get(id);
    if (hit && hit.hash === hash) return hit;
    const response = await fetchImpl(`https://docs.google.com/spreadsheets/d/${id}/export?format=xlsx`, { signal: AbortSignal.timeout(Math.max(timeoutMs, 30_000)), redirect: "follow" });
    const type = response.headers.get("content-type") || "";
    if (!response.ok || type.includes("html")) throw new Error(`xlsx alınamadı (${response.status})`);
    const buffer = Buffer.from(await response.arrayBuffer());
    const workbook = readXlsxFormulas(buffer);
    let lists = null;
    try {
      lists = readXlsxLists(buffer);
    } catch {
      lists = null;
    }
    const entry = { hash, workbook, lists };
    formulaCache.set(id, entry);
    if (formulaCache.size > 20) formulaCache.delete(formulaCache.keys().next().value);
    return entry;
  }

  async function read(sheetUrl) {
    const sourceUrl = String(sheetUrl || "").trim();
    const id = spreadsheetId(sourceUrl);
    const signal = () => AbortSignal.timeout(timeoutMs);
    const documentResponse = await fetchImpl(`https://docs.google.com/spreadsheets/d/${id}/edit`, { headers: { Accept: "text/html" }, signal: signal() });
    if (!documentResponse.ok) {
      return { connected: false, sourceUrl, syncedAt: null, rows: [], tabs: [], message: `Google Sheets erişimi başarısız (${documentResponse.status}). Sheet paylaşım iznini kontrol edin.` };
    }
    const html = await documentResponse.text();
    const tabs = discoverTabs(html);
    const title = documentTitle(html);
    let fallbackGid = "0";
    try {
      fallbackGid = new URL(sourceUrl).searchParams.get("gid") || new URL(sourceUrl).hash.match(/gid=(\d+)/)?.[1] || "0";
    } catch {
      fallbackGid = "0";
    }
    const targets = tabs.length ? tabs : [{ gid: fallbackGid, title: "" }];
    const rows = [];
    const labels = [];
    const parsedTabs = [];
    const hash = createHash("sha1");
    let sectionCount = 0;
    const csvs = [];
    for (const tab of targets) {
      const csv = await readTabCsv(sourceUrl, tab.gid, signal);
      if (!csv.ok) {
        return { connected: false, sourceUrl, syncedAt: null, rows: [], tabs, message: `"${tab.title || "Sheet"}" sekmesi okunamadı (${csv.status}). Sheet'i görüntüleme izni olan kişilerle paylaşın.` };
      }
      hash.update(`${tab.title}\u0000${csv.text}\u0000`);
      csvs.push({ tab, csv });
    }
    // Formüller, açılır listeler ve birleştirilmiş hücreler xlsx kopyasından okunur (CSV'de yoktur). Birleştirilmiş
    // hücreler kayıtlar çıkarılmadan önce doldurulur; xlsx alınamazsa değerler yine gelir.
    let formulasUnavailable = false;
    let workbook = null;
    let lists = null;
    const digest = hash.digest("hex");
    if (formulas && csvs.some(item => item.csv.export && item.tab.title)) {
      try {
        ({ workbook, lists } = await readFormulas(id, digest));
      } catch {
        formulasUnavailable = true;
      }
    }
    for (const { tab, csv } of csvs) {
      // Export CSV'sinde satır sırası sayfadaki satırdır (boş satırlar korunur); gviz yedek yolunda bu garanti yoktur.
      const matrix = parseCsv(csv.text, { keepEmpty: csv.export });
      if (csv.export && lists?.merges?.has(tab.title)) fillMerges(matrix, lists.merges.get(tab.title));
      const parsed = matrixToRecords(matrix, tab.title, { layout: csv.export });
      for (const row of parsed.rows) rows.push(row); // yayma (...) büyük sekmelerde çağrı yığınını taşırır
      for (const label of parsed.tabs) labels.push({ gid: tab.gid, title: label });
      if (parsed.sections.length > 1) sectionCount += parsed.sections.length;
      if (csv.export && tab.title) parsedTabs.push({ title: tab.title, matrix, layout: parsed.layout, blocks: parsed.blocks });
    }
    let choices;
    let listSheets = [];
    if (workbook && parsedTabs.length) {
      try {
        bindSheetFormulas(parsedTabs, workbook, sourceTagOf(`sheets:${id}`));
        if (lists) {
          const sheets = parsedTabs.map(tab => ({ name: tab.title, matrix: tab.matrix, start: { r: 0, c: 0 }, rules: lists.sheets.get(tab.title) || [], blocks: tab.blocks || [], hidden: lists.hidden.has(tab.title) }));
          const sources = new Set();
          choices = resolveChoices(sheets, lists.names, sources);
          listSheets = listOnlySheets(sheets, sources);
        }
      } catch {
        // xlsx alınamadıysa değerler yine gelir; eşitleme, kayıtlı formülleri ve listeleri korur (dataset.sync).
        formulasUnavailable = true;
      }
    }
    const detail = sectionCount ? ` (alt tablolar ayrı bölümler olarak gösteriliyor)` : "";
    return { connected: true, sourceUrl, title, syncedAt: new Date().toISOString(), rows, tabs: labels.length ? labels : targets, formulasUnavailable, ...(choices ? { choices, listSheets } : {}), message: `${targets.length} sekmeden ${rows.length} kayıt okundu${detail}.` };
  }

  // Önce hücreleri göründüğü gibi veren export CSV'si, olmazsa gviz CSV'si.
  async function readTabCsv(sourceUrl, gid, signal) {
    try {
      const response = await fetchImpl(googleExportUrl(sourceUrl, gid), { headers: { Accept: "text/csv" }, signal: signal(), redirect: "follow" });
      const type = response.headers.get("content-type") || "";
      if (response.ok && !type.includes("html")) {
        const text = await response.text();
        if (!text.trimStart().startsWith("<")) return { ok: true, text, export: true };
      }
    } catch (error) {
      if (error?.name === "TimeoutError") throw error;
    }
    const response = await fetchImpl(googleCsvUrl(sourceUrl, gid), { headers: { Accept: "text/csv" }, signal: signal() });
    if (!response.ok) return { ok: false, status: response.status };
    return { ok: true, text: await response.text() };
  }

  // Aynı Sheet için eşzamanlı istekler tek istekte birleştirilir; sonuç kısa süre önbellekte tutulur.
  return async function readGoogleSheet(sheetUrl, { fresh = false } = {}) {
    const key = String(sheetUrl || "").trim();
    const hit = cache.get(key);
    if (!fresh && hit && Date.now() - hit.at < cacheMs) return hit.result;
    if (inflight.has(key)) return inflight.get(key);
    const promise = read(key)
      .then(result => {
        if (result.connected) cache.set(key, { at: Date.now(), result });
        if (cache.size > 20) cache.delete(cache.keys().next().value);
        return result;
      })
      .catch(error => {
        const message = error?.name === "TimeoutError" ? "Google Sheets zaman aşımına uğradı. İnternet bağlantısını kontrol edin." : error?.message || "Google Sheets okunamadı. Bağlantı ve paylaşım iznini kontrol edin.";
        return { connected: false, sourceUrl: key, syncedAt: null, rows: [], tabs: [], message };
      })
      .finally(() => inflight.delete(key));
    inflight.set(key, promise);
    return promise;
  };
}
