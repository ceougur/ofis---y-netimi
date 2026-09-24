// Google Sheets okuma: sekme keşfi, CSV dışa aktarımı, Türkçe alan dönüşümü ve kısa süreli önbellek.

export function spreadsheetId(sheetUrl) {
  const match = String(sheetUrl || "").trim().match(/\/spreadsheets\/(?:u\/\d+\/)?d\/([^/?#]+)/i);
  if (!match) throw new Error("Geçerli bir Google Sheets bağlantısı girilmedi.");
  return match[1];
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

export function csvToRecords(csv, tabTitle = "") {
  const matrix = parseCsv(csv);
  const headers = matrix[0] || [];
  return matrix
    .slice(1)
    .map(values =>
      headers.reduce((record, header, index) => {
        if (header.trim()) record[header.trim()] = values[index]?.trim() || "";
        if (tabTitle) record.__sheet = tabTitle;
        return record;
      }, {}),
    )
    .filter(record => Object.entries(record).some(([key, value]) => key !== "__sheet" && Boolean(value)));
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
    const tabs = discoverTabs(await documentResponse.text());
    let fallbackGid = "0";
    try {
      fallbackGid = new URL(sourceUrl).searchParams.get("gid") || new URL(sourceUrl).hash.match(/gid=(\d+)/)?.[1] || "0";
    } catch {
      fallbackGid = "0";
    }
    const targets = tabs.length ? tabs : [{ gid: fallbackGid, title: "" }];
    const rows = [];
    for (const tab of targets) {
      const response = await fetchImpl(googleCsvUrl(sourceUrl, tab.gid), { headers: { Accept: "text/csv" }, signal: signal() });
      if (!response.ok) {
        return { connected: false, sourceUrl, syncedAt: null, rows: [], tabs, message: `"${tab.title || "Sheet"}" sekmesi okunamadı (${response.status}). Sheet'i görüntüleme izni olan kişilerle paylaşın.` };
      }
      rows.push(...csvToRecords(await response.text(), tab.title));
    }
    return { connected: true, sourceUrl, syncedAt: new Date().toISOString(), rows, tabs: targets, message: `${targets.length} sekmeden ${rows.length} kayıt okundu.` };
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
