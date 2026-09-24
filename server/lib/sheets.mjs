// Google Sheets okuma: sekme keşfi, CSV dışa aktarımı, alt tabloların (bölümlerin) ayrılması ve kısa süreli önbellek.
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

export function parseCsv(csv) {
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
      if (row.some(value => value.length > 0)) rows.push(row);
      row = [];
      cell = "";
    } else cell += char;
  }
  if (cell.length > 0 || row.length > 0) {
    row.push(cell.trim());
    if (row.some(value => value.length > 0)) rows.push(row);
  }
  return rows;
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

export function createSheetsReader({ fetchImpl, cacheMs = 45_000, timeoutMs = 20_000 }) {
  const cache = new Map();
  const inflight = new Map();

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
    let sectionCount = 0;
    for (const tab of targets) {
      const csv = await readTabCsv(sourceUrl, tab.gid, signal);
      if (!csv.ok) {
        return { connected: false, sourceUrl, syncedAt: null, rows: [], tabs, message: `"${tab.title || "Sheet"}" sekmesi okunamadı (${csv.status}). Sheet'i görüntüleme izni olan kişilerle paylaşın.` };
      }
      const parsed = matrixToRecords(parseCsv(csv.text), tab.title);
      for (const row of parsed.rows) rows.push(row); // yayma (...) büyük sekmelerde çağrı yığınını taşırır
      for (const label of parsed.tabs) labels.push({ gid: tab.gid, title: label });
      if (parsed.sections.length > 1) sectionCount += parsed.sections.length;
    }
    const detail = sectionCount ? ` (alt tablolar ayrı bölümler olarak gösteriliyor)` : "";
    return { connected: true, sourceUrl, title, syncedAt: new Date().toISOString(), rows, tabs: labels.length ? labels : targets, message: `${targets.length} sekmeden ${rows.length} kayıt okundu${detail}.` };
  }

  // Önce hücreleri göründüğü gibi veren export CSV'si, olmazsa gviz CSV'si.
  async function readTabCsv(sourceUrl, gid, signal) {
    try {
      const response = await fetchImpl(googleExportUrl(sourceUrl, gid), { headers: { Accept: "text/csv" }, signal: signal(), redirect: "follow" });
      const type = response.headers.get("content-type") || "";
      if (response.ok && !type.includes("html")) {
        const text = await response.text();
        if (!text.trimStart().startsWith("<")) return { ok: true, text };
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
