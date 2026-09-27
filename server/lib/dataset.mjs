// Kalıcı çalışma verisi (v1.5.0). Excel veya Google Sheets'ten içeri alınan satırlar sunucunun veritabanında saklanır;
// ofisin sonradan yaptığı düzeltmeler, silmeler, yeni kayıtlar, notlar ve görevler bu verinin üstünde birikir. Veri,
// yönetici kaldırmadıkça korunur: dosyanın adı değişse, Sheet'e ulaşılamasa veya Sheet'ten satır silinse bile.
//
// İçeri alma iki adımlıdır: önce dosya okunur ve mevcut veriyle karşılaştırılır (önizleme), yönetici "devamı olarak
// ekle" ya da "yerine koy" der, sonra uygulanır. Bağlı bir Google Sheets varsa belirli aralıklarla "eşitleme" yapılır:
// yeni ve değişen satırlar eklenir/güncellenir; Sheet'te artık olmayan satırlar silinmez, "Sheet'te yok" olarak
// işaretlenip yöneticiye sunulur. Sheet'in yapısı toptan değişmiş görünüyorsa eşitleme kendiliğinden uygulanmaz,
// yönetici onayı beklenir.
import { randomUUID } from "node:crypto";
import { createBackup } from "./backup.mjs";
import { HttpError, parseJson } from "./http.mjs";
import { attachFormulas, sourceTagOf } from "./formula/bind.mjs";
import { computeFormulas } from "./formula/compute.mjs";
import { matrixToRecords } from "./sections.mjs";
import { currentScope, runScoped } from "./session-scope.mjs";
import { spreadsheetId } from "./sheets.mjs";
import { applyPatch } from "./sources.mjs";
import { LEGACY_IDENTITY, detectIdentity, legacyFits, rowHash, rowIdentities, sameIdentity } from "./dataset-identity.mjs";
import { columnOrder } from "./sources.mjs";

export const DATASET_KEY = "dataset://ofis";
// Veri oturumları (v2.0.1): farklı konudaki bir Excel/Sheets yeni bir oturumda açılır; her oturumun satırları,
// düzeltmeleri, silinenleri, yeni kayıtları ve ayarları ayrıdır. İlk (eski) veri "dataset://ofis" oturumudur.
// Her kullanıcı kendi seçtiği oturumda çalışır (istek kapsamı: session-scope.mjs).
export const SESSION_PREFIX = "dataset://oturum-";
export const MAX_ROWS = 200_000;
// Sekmeli veride hiçbir sekmeyle ortak alanı olmayan kayıtların sekmeleri (v1.7.0: "Tümü" sekmesi kaldırıldı).
export const APP_TAB = "Uygulamada eklenenler";
export const UNTABBED_TAB = "Sekmesiz kayıtlar";
const STAGE_TTL_MS = 30 * 60_000;
const MAX_STAGES = 3;
const SYSTEM_ACTOR = { id: "system", display_name: "Otomatik eşitleme", role: "admin" };

const S = {
  label: "dataset.label",
  linkedUrl: "dataset.linkedSheetUrl",
  lastSyncAt: "dataset.lastSyncAt",
  lastSyncOkAt: "dataset.lastSyncOkAt",
  lastSyncError: "dataset.lastSyncError",
  needsInitialSync: "dataset.needsInitialSync",
  syncHold: "dataset.syncHold",
  changedAt: "dataset.changedAt",
  identity: "dataset.identity",
};

const isSheetUrl = value => /^https:\/\/docs\.google\.com\/spreadsheets\//i.test(String(value || "").trim());

export function createDatasetService({ store, audit, readGoogleSheet, bumpClientState, events, log, backupDir, backupKeep = 30, autoSync = true, tickMs = 60_000, canWrite = () => true }) {
  const stages = new Map();
  const caches = new Map(); // oturum → { rows, byId } — veritabanındaki satırların ayrıştırılmış hâli
  const syncing = new Map(); // oturum → süren eşitleme
  let timer = null;
  let startTimer = null;

  const now = () => new Date().toISOString();
  const setting = (key, fallback = "") => store.setting(key, fallback) ?? fallback;

  // ---------- Oturumlar ----------
  const REG = { sessions: "dataset.sessions", fallback: "dataset.defaultSession", defaultName: "dataset.sessionName", user: id => `dataset.session.user.${id}` };
  const sessionList = () => {
    const list = parseJson(setting(REG.sessions, ""), []);
    return Array.isArray(list) ? list.filter(item => item && typeof item.key === "string" && item.key.startsWith(SESSION_PREFIX)) : [];
  };
  const knownKey = datasetKey => datasetKey === DATASET_KEY || sessionList().some(item => item.key === datasetKey);
  const defaultKey = () => {
    const value = setting(REG.fallback, "");
    return value && knownKey(value) ? value : DATASET_KEY;
  };
  const allKeys = () => [DATASET_KEY, ...sessionList().map(item => item.key)];
  // Bu isteğin oturumu: isteği yapan kullanıcının seçtiği oturum; seçmemişse ofisin varsayılanı. İstek dışında
  // (zamanlayıcı, açılış) varsayılan oturum ya da runScoped ile verilen oturum.
  function activeKey() {
    const scope = currentScope();
    if (!scope) return defaultKey();
    if (scope.datasetKey) return scope.datasetKey;
    let resolved = defaultKey();
    const user = typeof scope.user === "function" ? scope.user() : null;
    if (user) {
      const chosen = setting(REG.user(user.id), "");
      if (chosen && knownKey(chosen)) resolved = chosen;
    }
    scope.datasetKey = resolved;
    return resolved;
  }
  const withKey = (datasetKey, fn) => runScoped({ datasetKey }, fn);
  // Oturuma ait ayar adı: ilk oturum eski adları kullanır (geriye uyum), diğerleri "@<kimlik>" ekiyle.
  const suffixOf = datasetKey => (datasetKey === DATASET_KEY ? "" : `@${datasetKey.slice(SESSION_PREFIX.length)}`);
  const sk = (name, datasetKey = activeKey()) => `${name}${suffixOf(datasetKey)}`;
  const sget = (name, fallback = "") => setting(sk(name), fallback);
  const sset = (name, value, by) => store.setSetting(sk(name), value, by);
  const linkedUrl = () => sget(S.linkedUrl, "").trim();

  // ---------- Okuma ----------
  function loadRows() {
    const datasetKey = activeKey();
    if (caches.has(datasetKey)) return caches.get(datasetKey);
    const rows = store
      .all("SELECT row_id AS rowId, case_key AS caseKey, tab, position, values_json AS valuesJson, row_hash AS hash, origin, missing_since AS missingSince FROM dataset_rows WHERE dataset_key = ? ORDER BY position, created_at", activeKey())
      .map(({ valuesJson, ...row }) => ({ ...row, values: parseJson(valuesJson, {}) }));
    const loaded = { rows, byId: new Map(rows.map(row => [row.rowId, row])), columnsByTab: null };
    caches.set(datasetKey, loaded);
    return loaded;
  }
  // Sekme → o sekmenin kolonları (sekme sırasıyla). Yeni kayıtların hangi sekmede görüneceğine karar vermek için.
  function tabColumns() {
    const loaded = loadRows();
    if (loaded.columnsByTab) return loaded.columnsByTab;
    const map = new Map();
    for (const row of loaded.rows) {
      const tab = row.tab || row.values?.__sheet || "";
      if (!tab) continue;
      if (!map.has(tab)) map.set(tab, new Set());
      const set = map.get(tab);
      for (const key of Object.keys(row.values)) if (!key.startsWith("__")) set.add(key);
    }
    loaded.columnsByTab = map;
    return map;
  }
  // Uygulamada eklenen (ya da sekmesiz gelen) bir kaydın sekmesi: eklendiği sekme hâlâ varsa o; yoksa doldurulan
  // alanları en çok hangi sekmenin kolonlarında geçiyorsa o (eşitlikte kolonlarının daha büyük kısmını dolduran, sonra
  // ilk sekme); hiçbir sekmeyle ortak alanı yoksa ayrı bir sekme. Böylece "Tümü" olmadan her kayıt bir sekmede görünür.
  function placeRecord(values, fallback) {
    const tabs = tabColumns();
    if (!tabs.size) return "";
    const stored = String(values.__sheet || "").trim();
    if (stored && (tabs.has(stored) || stored === fallback)) return stored;
    let best = "";
    let bestScore = 0;
    let bestRatio = 0;
    const filled = Object.keys(values).filter(key => !key.startsWith("__") && String(values[key] ?? "").trim());
    for (const [tab, columns] of tabs) {
      let score = 0;
      for (const key of filled) if (columns.has(key)) score += 1;
      const ratio = columns.size ? score / columns.size : 0;
      if (score > bestScore || (score === bestScore && score > 0 && ratio > bestRatio)) {
        best = tab;
        bestScore = score;
        bestRatio = ratio;
      }
    }
    return bestScore > 0 ? best : fallback;
  }
  const invalidate = (datasetKey = activeKey()) => {
    caches.delete(datasetKey);
  };

  const recordCount = () => store.get("SELECT COUNT(*) AS count FROM records WHERE source_name = ?", activeKey()).count;
  const rowCount = () => store.get("SELECT COUNT(*) AS count FROM dataset_rows WHERE dataset_key = ?", activeKey()).count;
  const hasData = () => rowCount() > 0 || recordCount() > 0 || Boolean(linkedUrl());

  function tabsOf(rows) {
    const tabs = [];
    const seen = new Set();
    for (const row of rows) {
      const tab = row.tab || row.values?.__sheet || "";
      if (tab && !seen.has(tab)) {
        seen.add(tab);
        tabs.push(tab);
      }
    }
    return tabs;
  }

  function summary({ detailed = false } = {}) {
    const rows = loadRows().rows;
    const missing = rows.filter(row => row.missingSince);
    const base = {
      hasData: hasData(),
      label: sget(S.label, ""),
      rowCount: rows.length,
      recordCount: recordCount(),
      tabs: tabsOf(rows),
      linked: Boolean(linkedUrl()),
      lastSyncOkAt: sget(S.lastSyncOkAt, "") || null,
      changedAt: sget(S.changedAt, "") || null,
      missingCount: missing.length,
      missingKeys: missing.slice(0, 1000).map(row => row.caseKey),
    };
    if (!detailed) return base;
    return {
      ...base,
      linkedSheetUrl: linkedUrl(),
      lastSyncAt: sget(S.lastSyncAt, "") || null,
      lastSyncError: sget(S.lastSyncError, "") || null,
      syncHold: parseJson(sget(S.syncHold, ""), null),
      syncMinutes: Number(setting("client.syncMinutes", "5")) || 5,
      imports: store.all(
        `SELECT i.id, i.kind, i.mode, i.label, i.row_count AS rowCount, i.added, i.updated, i.unchanged, i.removed, i.missing, i.backup_name AS backupName,
                CASE WHEN i.created_by = 'system' THEN 'Otomatik eşitleme' ELSE COALESCE(u.display_name, '') END AS actorName, i.created_at AS createdAt
         FROM dataset_imports i LEFT JOIN users u ON u.id = i.created_by WHERE i.dataset_key = ? ORDER BY i.created_at DESC LIMIT 12`,
        activeKey(),
      ),
    };
  }

  // Arayüzün beklediği birleşik görünüm: yeni kayıtlar + içeri alınan satırlar, ofisin düzeltmeleri uygulanmış,
  // silinenler çıkarılmış. Her satır dosya kimliğini (__hofKey) taşır.
  async function view() {
    if (linkedUrl() && sget(S.needsInitialSync) === "1") await sync().catch(error => log?.warn?.("İlk eşitleme yapılamadı", error));
    const { rows } = loadRows();
    const overrides = new Map();
    for (const item of store.all("SELECT case_key, field, value FROM overrides WHERE source_name = ?", activeKey())) {
      if (String(item.field).startsWith("__")) continue; // iç alanlar (eski sürümlerde yazılmış olabilir) uygulanmaz
      if (!overrides.has(item.case_key)) overrides.set(item.case_key, {});
      overrides.get(item.case_key)[item.field] = item.value;
    }
    const deleted = new Set(store.all("SELECT case_key FROM deleted_records WHERE source_name = ?", activeKey()).map(item => item.case_key));
    const merged = [];
    const extraTabs = new Set();
    for (const record of store.all("SELECT id, case_key, values_json FROM records WHERE source_name = ? ORDER BY created_at DESC", activeKey())) {
      if (deleted.has(record.case_key)) continue;
      const values = parseJson(record.values_json, {});
      const tab = placeRecord(values, APP_TAB);
      if (tab === APP_TAB) extraTabs.add(APP_TAB);
      const { __sheet: ignored, ...rest } = values;
      merged.push({ ...rest, ...(overrides.get(record.case_key) || {}), ...(tab ? { __sheet: tab } : {}), __hofKey: record.case_key, __hofRecord: record.id });
    }
    const tabbed = tabColumns().size > 0;
    const changedFields = new WeakMap(); // formüllü satırlarda programda değiştirilen alanlar (v2.0.1)
    for (const row of rows) {
      if (deleted.has(row.caseKey)) continue;
      const patch = overrides.get(row.caseKey);
      const values = patch ? applyPatch(row.values, patch) : { ...row.values };
      if (patch && (row.values.__hofF || row.values.__hofAt)) {
        const fields = new Set();
        for (const key of Object.keys(values)) if (!key.startsWith("__") && values[key] !== row.values[key]) fields.add(key);
        if (fields.size) changedFields.set(values, fields);
      }
      // Sekmeli veride sekmesiz satır (eski sürümlerden kalmış olabilir) en uygun sekmeye yerleşir.
      if (tabbed) {
        const tab = String(values.__sheet || row.tab || "").trim();
        values.__sheet = tab || placeRecord(values, UNTABBED_TAB);
        if (values.__sheet === UNTABBED_TAB) extraTabs.add(UNTABBED_TAB);
      }
      values.__hofKey = row.caseKey;
      if (row.missingSince) values.__hofMissing = row.missingSince;
      merged.push(values);
    }
    // Formüller: girdisi programda değişenler yeniden hesaplanır; iç formül alanları istemciye gönderilmez.
    try {
      computeFormulas(merged, { changedFields });
    } catch (failure) {
      log?.warn?.("Formüller hesaplanamadı; kaynaktaki değerler gösteriliyor", failure);
      for (const row of merged) {
        delete row.__hofF;
        delete row.__hofAt;
      }
    }
    const label = sget(S.label, "") || "Çalışma verisi";
    const error = linkedUrl() ? sget(S.lastSyncError, "") : "";
    if (!merged.length && !rows.length) {
      return { connected: false, sourceUrl: activeKey(), syncedAt: null, rows: [], tabs: [], message: error || "Henüz veri yüklenmedi." };
    }
    return {
      connected: true,
      sourceUrl: activeKey(),
      syncedAt: sget(S.lastSyncOkAt, "") || sget(S.changedAt, "") || null,
      rows: merged,
      // Yalnızca görünen satırı olan sekmeler (tüm satırları silinmiş sekme listelenmez, varsayılan da olamaz).
      tabs: [...tabsOf(rows), ...extraTabs].filter(title => merged.some(row => row.__sheet === title)).map(title => ({ gid: "", title })),
      message: error ? `${label} · ${merged.length} kayıt · Google Sheets'e şu an ulaşılamıyor, son eşitlenen veri gösteriliyor.` : `${label} · ${merged.length} kayıt`,
    };
  }

  // ---------- İçeri alma: okuma ve önizleme ----------
  function purgeStages() {
    const limit = Date.now() - STAGE_TTL_MS;
    for (const [id, stage] of stages) if (stage.createdAt < limit) stages.delete(id);
    while (stages.size >= MAX_STAGES) stages.delete(stages.keys().next().value);
  }

  function toEntries(rows, identity) {
    const identities = rowIdentities(rows, identity);
    return rows.map((values, index) => ({ ...identities[index], values, hash: rowHash(values), position: index }));
  }

  // Kayıt kimliği kuralı (dataset-identity.mjs). Kayıtlı kural yoksa ve veri 1.6.0 öncesinden geliyorsa (satırlar ya da
  // göç 4'ün bıraktığı ilk Sheet eşitlemesi) eski kural geçerlidir; 1.6.0 öncesinden gelen kurulumlarda kural ayrıca
  // açılışta sabitlenir (pinLegacyIdentity). "Devamı olarak ekle" ve eşitleme mevcut kuralla eşleştirir; kural hiçbir
  // zaman kendiliğinden (otomatik eşitlemede) değişmez.
  function currentIdentity() {
    const stored = parseJson(sget(S.identity, ""), null);
    if (stored && (stored.mode === "legacy" || (stored.mode === "column" && stored.column))) return stored;
    return loadRows().rows.length || sget(S.needsInitialSync) === "1" ? LEGACY_IDENTITY : null;
  }
  function identitiesFor(rows) {
    const detected = detectIdentity(rows);
    const current = currentIdentity();
    if (!current) return { merge: detected, replace: detected };
    if (current.mode === "legacy") {
      // Notlar ve düzeltmeler dosya numarasına bağlı. "Yerine koy" ile gelen dosya da çoğunlukla dosya numaralıysa eski
      // kuralla eşleştirilir (aynı dosyayı yeniden yüklemek kayıtları koparmaz); değilse yeni veri kendi kuralını alır.
      return { merge: current, replace: legacyFits(rows) ? current : detected };
    }
    // Kimlik kolonu yeni veride de varsa korunur (notlar bağlı kalsın), yoksa yeni verinin kendi kuralı kullanılır.
    const usable = columnOrder(rows).includes(current.column);
    return { merge: usable ? current : detected, replace: usable ? current : detected };
  }
  // 1.6.0 öncesinden gelen ve kullanılmış kurulum: kayıtlar dosya numarasına bağlıdır; kural eski kurala sabitlenir.
  function pinLegacyIdentity() {
    withKey(DATASET_KEY, () => {
      if (!parseJson(sget(S.identity, ""), null)) sset(S.identity, JSON.stringify(LEGACY_IDENTITY));
    });
  }

  // Excel sayfaları → kayıtlar. v2.0.1: tarayıcı formülleri de gönderir (sayfa koordinatlarıyla); formüller
  // kayıtlara bağlanır ki programda değişen değerlerle yeniden hesaplanabilsin (formula/bind.mjs).
  function parseExcelSheets(sheets, fileName = "") {
    if (!Array.isArray(sheets)) throw new HttpError(400, "Tablo sayfaları okunamadı.");
    if (sheets.length > 200) throw new HttpError(400, "Dosyada en fazla 200 sayfa olabilir.");
    const rows = [];
    const tabs = [];
    const parsedSheets = [];
    let cells = 0;
    for (const sheet of sheets) {
      const name = String(sheet?.name ?? "").trim().slice(0, 200);
      const matrix = Array.isArray(sheet?.matrix) ? sheet.matrix.slice(0, MAX_ROWS + 1).map(line => (Array.isArray(line) ? line.slice(0, 500).map(cell => String(cell ?? "").slice(0, 20_000)) : [])) : [];
      cells += matrix.reduce((total, line) => total + line.length, 0);
      if (cells > 20_000_000) throw new HttpError(400, "Tablo çok büyük (en fazla 20 milyon hücre).");
      const formulas = cleanFormulas(sheet?.formulas);
      const start = { r: Math.max(0, Number(sheet?.start?.r) || 0), c: Math.max(0, Number(sheet?.start?.c) || 0) };
      const parsed = matrixToRecords(matrix, name, { layout: formulas.length > 0 });
      for (const row of parsed.rows) rows.push(row); // yayma (...) büyük sayfalarda çağrı yığınını taşırır
      for (const label of parsed.tabs) if (label && !tabs.includes(label)) tabs.push(label);
      if (formulas.length) parsedSheets.push({ name, matrix, start, formulas, layout: parsed.layout });
      else parsedSheets.push({ name, matrix, start, formulas: [], layout: [] });
    }
    if (parsedSheets.some(sheet => sheet.formulas.length)) {
      try {
        attachFormulas(parsedSheets, { sourceTag: sourceTagOf(`excel:${fileName}`) });
      } catch (error) {
        log?.warn?.("Excel formülleri bağlanamadı; değerler olduğu gibi alındı", error);
      }
    }
    return { rows, tabs };
  }
  const cleanFormulas = list =>
    Array.isArray(list)
      ? list
          .slice(0, 200_000)
          .filter(item => Array.isArray(item) && Number.isInteger(item[0]) && Number.isInteger(item[1]) && item[0] >= 0 && item[1] >= 0 && typeof item[2] === "string" && item[2].length <= 8_000)
          .map(([r, c, f]) => [r, c, f])
      : [];

  // Satırları temizler: yalnızca metin değerler, boş satırlar atılır, kolon ve değer uzunlukları sınırlanır.
  function cleanRows(rows) {
    const clean = [];
    for (const item of rows) {
      if (!item || typeof item !== "object" || Array.isArray(item)) continue;
      const row = {};
      for (const [key, value] of Object.entries(item).slice(0, 501)) {
        const name = String(key).trim().slice(0, 200);
        if (!name) continue;
        row[name] = String(value ?? "").slice(0, 20_000);
      }
      if (Object.entries(row).some(([key, value]) => key !== "__sheet" && value.trim())) clean.push(row);
    }
    if (clean.length > MAX_ROWS) throw new HttpError(400, "Tablo en fazla 200.000 satır içerebilir.");
    return clean;
  }

  function diff(entries) {
    const { rows, byId } = loadRows();
    const incoming = new Set();
    const counts = { added: 0, updated: 0, unchanged: 0 };
    const samples = { added: [], updated: [], removed: [] };
    const sample = (list, entry) => list.length < 5 && !list.includes(entry.caseKey) && list.push(entry.caseKey);
    for (const entry of entries) {
      incoming.add(entry.id);
      const current = byId.get(entry.id);
      if (!current) {
        counts.added += 1;
        if (!entry.caseKey.startsWith("satir:")) sample(samples.added, entry);
      } else if (current.hash !== entry.hash) {
        counts.updated += 1;
        if (!entry.caseKey.startsWith("satir:")) sample(samples.updated, entry);
      } else counts.unchanged += 1;
    }
    const others = rows.filter(row => !incoming.has(row.rowId));
    for (const row of others) if (!row.caseKey.startsWith("satir:")) sample(samples.removed, row);
    return { ...counts, others: others.length, samples };
  }

  async function stage(user, body) {
    purgeStages();
    let rows;
    let tabs;
    let label;
    let url = null;
    const kind = String(body?.kind || "");
    if (kind === "sheets") {
      url = String(body.url || "").trim();
      if (!isSheetUrl(url)) throw new HttpError(400, "Geçerli bir Google Sheets bağlantısı yapıştırın (https://docs.google.com/spreadsheets/…).");
      spreadsheetId(url);
      const result = await readGoogleSheet(url, { fresh: true });
      if (!result.connected) throw new HttpError(502, result.message || "Google Sheets okunamadı. Bağlantıyı ve paylaşım iznini kontrol edin.");
      rows = result.rows;
      tabs = result.tabs.map(tab => tab.title).filter(Boolean);
      label = String(result.title || "").trim().slice(0, 200) || "Google Sheets";
    } else if (kind === "excel") {
      const fileName = String(body.fileName || "").trim().replace(/[\\/]+/g, "_");
      if (!fileName) throw new HttpError(400, "Dosya adı gerekli.");
      if (fileName.length > 180) throw new HttpError(400, "Dosya adı çok uzun.");
      ({ rows, tabs } = parseExcelSheets(body.sheets, fileName));
      label = fileName;
    } else throw new HttpError(400, "Bilinmeyen içeri alma türü.");
    rows = cleanRows(rows);
    if (!rows.length) throw new HttpError(400, "Tabloda okunabilir kayıt bulunamadı. Tablonun kolon başlıklarıyla başladığından emin olun.");
    const identity = identitiesFor(rows);
    const entries = { merge: toEntries(rows, identity.merge) };
    entries.replace = sameIdentity(identity.merge, identity.replace) ? entries.merge : toEntries(rows, identity.replace);
    // Yeni oturum için: dosya kendi kimlik kuralıyla (mevcut veriden bağımsız) alınır.
    identity.session = detectIdentity(rows);
    entries.session = sameIdentity(identity.session, identity.replace) ? entries.replace : toEntries(rows, identity.session);
    // Konu benzerliği: yeni dosyanın kolonlarının mevcut veride de olma oranı. Düşükse (farklı konu) yeni oturum önerilir.
    const incoming = columnOrder(rows);
    const existing = new Set(columnOrder(loadRows().rows.map(row => row.values)));
    const shared = incoming.filter(column => existing.has(column)).length;
    const similarity = existing.size && incoming.length ? shared / Math.min(existing.size, incoming.length) : null;
    const id = `stage-${randomUUID()}`;
    stages.set(id, { id, userId: user.id, datasetKey: activeKey(), kind, label, url, entries, identity, tabs, createdAt: Date.now() });
    const mergeChanges = diff(entries.merge);
    const replaceChanges = entries.replace === entries.merge ? mergeChanges : diff(entries.replace);
    return {
      stageId: id,
      kind,
      label,
      url,
      rowCount: rows.length,
      tabs,
      hasData: loadRows().rows.length > 0,
      current: { rowCount: loadRows().rows.length, label: sget(S.label, ""), linked: Boolean(linkedUrl()) },
      identity: identity.replace,
      session: { current: sessions().find(item => item.current)?.name || "", count: sessionList().length + 1 },
      similarity,
      differentTopic: similarity !== null && similarity < 0.5,
      preview: {
        merge: { added: mergeChanges.added, updated: mergeChanges.updated, unchanged: mergeChanges.unchanged, kept: mergeChanges.others },
        replace: { added: replaceChanges.added, updated: replaceChanges.updated, unchanged: replaceChanges.unchanged, removed: replaceChanges.others },
        samples: entries.replace === entries.merge ? mergeChanges.samples : replaceChanges.samples,
      },
    };
  }

  // ---------- Uygulama ----------
  // mode: "merge" (devamı olarak ekle), "replace" (yerine koy), "sync" (bağlı Sheet eşitlemesi).
  function apply(entries, { mode, origin }) {
    const timestamp = now();
    const current = new Map(
      store.all("SELECT row_id AS rowId, row_hash AS hash, position, origin, missing_since AS missingSince FROM dataset_rows WHERE dataset_key = ?", activeKey()).map(row => [row.rowId, row]),
    );
    const counts = { added: 0, updated: 0, unchanged: 0, removed: 0, missing: 0 };
    const insert = (entry, position) =>
      store.run(
        "INSERT INTO dataset_rows (dataset_key, row_id, case_key, tab, position, values_json, row_hash, origin, created_at, updated_at, missing_since) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NULL)",
        activeKey(), entry.id, entry.caseKey, entry.tab, position, JSON.stringify(entry.values), entry.hash, origin, timestamp, timestamp,
      );
    const update = (entry, position) =>
      store.run(
        "UPDATE dataset_rows SET case_key = ?, tab = ?, position = ?, values_json = ?, row_hash = ?, origin = ?, updated_at = ?, missing_since = NULL WHERE dataset_key = ? AND row_id = ?",
        entry.caseKey, entry.tab, position, JSON.stringify(entry.values), entry.hash, origin, timestamp, activeKey(), entry.id,
      );
    const touch = (entry, row, position) => {
      if (row.position !== position || row.missingSince || row.origin !== origin) {
        store.run("UPDATE dataset_rows SET position = ?, origin = ?, missing_since = NULL WHERE dataset_key = ? AND row_id = ?", position, origin, activeKey(), entry.id);
      }
    };
    const incoming = new Set(entries.map(entry => entry.id));

    if (mode === "merge") {
      let next = -1;
      for (const row of current.values()) if (row.position > next) next = row.position;
      for (const entry of entries) {
        const row = current.get(entry.id);
        if (!row) {
          next += 1;
          insert(entry, next);
          counts.added += 1;
        } else if (row.hash !== entry.hash) {
          update(entry, row.position);
          counts.updated += 1;
        } else {
          touch(entry, row, row.position);
          counts.unchanged += 1;
        }
      }
      return counts;
    }

    // replace ve sync: gelen satırlar kaynaktaki sırayla en başa dizilir.
    entries.forEach((entry, index) => {
      const row = current.get(entry.id);
      if (!row) {
        insert(entry, index);
        counts.added += 1;
      } else if (row.hash !== entry.hash) {
        update(entry, index);
        counts.updated += 1;
      } else {
        touch(entry, row, index);
        counts.unchanged += 1;
      }
    });
    const rest = [...current.values()].filter(row => !incoming.has(row.rowId)).sort((a, b) => a.position - b.position);
    if (mode === "replace") {
      for (const row of rest) store.run("DELETE FROM dataset_rows WHERE dataset_key = ? AND row_id = ?", activeKey(), row.rowId);
      counts.removed = rest.length;
      return counts;
    }
    // sync: kaynakta olmayan satırlar silinmez; bağlı Sheet'ten gelmişse "Sheet'te yok" olarak işaretlenir.
    rest.forEach((row, offset) => {
      const position = entries.length + offset;
      const flag = row.origin === "sheets" && !row.missingSince;
      if (flag) counts.missing += 1;
      if (flag || row.position !== position) {
        store.run("UPDATE dataset_rows SET position = ?, missing_since = COALESCE(missing_since, ?) WHERE dataset_key = ? AND row_id = ?", position, flag ? timestamp : null, activeKey(), row.rowId);
      }
    });
    return counts;
  }

  function logImport(actor, { kind, mode, label, url, rowCount: total, counts, backupName }) {
    store.run(
      "INSERT INTO dataset_imports (id, dataset_key, kind, mode, label, source_url, row_count, added, updated, unchanged, removed, missing, backup_name, created_by, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)",
      `import-${randomUUID()}`, activeKey(), kind, mode, label || "", url || null, total, counts.added || 0, counts.updated || 0, counts.unchanged || 0, counts.removed || 0, counts.missing || 0, backupName || null, actor.id, now(),
    );
  }

  const changedSomething = counts => counts.added + counts.updated + counts.removed + counts.missing > 0;

  const listeners = new Set();
  function afterChange(actor, detail = {}) {
    invalidate();
    sset(S.changedAt, now(), actor.id === "system" ? null : actor.id);
    bumpClientState(actor.id === "system" ? null : actor.id);
    for (const listener of listeners) {
      try {
        listener({ actor, ...detail });
      } catch (error) {
        log?.warn?.("Veri değişikliği dinleyicisi hata verdi", error);
      }
    }
    // Tüm açık ekranlar tabloyu yeniler (işlemi yapan dahil; onun sayfası zaten yeniden yüklenir).
    events?.publish("workspace.changed", { kind: "records", actorId: actor.id, actorName: actor.display_name, dataset: true, datasetKey: activeKey() });
  }

  function backup(label) {
    if (!backupDir || !rowCount()) return null;
    try {
      return createBackup(store.db, backupDir, { label, keep: backupKeep }).name;
    } catch (error) {
      log?.error?.("Veri değişikliği öncesi yedek alınamadı", error);
      throw new HttpError(500, "Değişiklikten önce yedek alınamadı; işlem yapılmadı. Disk alanını kontrol edin.");
    }
  }

  // mode: "merge" | "replace" (önizlemenin yapıldığı oturuma) ya da "session" (yeni oturum açılır, v2.0.1).
  function commit(user, stageId, { mode, link = true, name = "" } = {}) {
    const staged = stages.get(String(stageId || ""));
    if (!staged) throw new HttpError(404, "İçeri alma süresi doldu veya bulunamadı. Dosyayı ya da bağlantıyı yeniden seçin.");
    if (mode === "session") return openSession(user, staged, { link, name });
    const target = staged.datasetKey && knownKey(staged.datasetKey) ? staged.datasetKey : activeKey();
    return withKey(target, () => commitInto(user, staged, { mode, link }));
  }

  // Yeni oturum: dosya yeni ve boş bir oturuma kendi kimlik kuralıyla alınır; mevcut oturumlara dokunulmaz.
  // Açan kişi yeni oturuma geçer; oturum seçmemiş kullanıcılar bulundukları oturumda sabitlenir (ekranları değişmez),
  // yeni kullanıcılar yeni oturumla başlar.
  function openSession(user, staged, { link, name }) {
    const datasetKey = `${SESSION_PREFIX}${randomUUID().replace(/-/g, "").slice(0, 12)}`;
    const title = String(name || staged.label || "Yeni oturum").replace(/\s+/g, " ").trim().slice(0, 80) || "Yeni oturum";
    store.tx(() => {
      const previous = defaultKey();
      for (const member of store.all("SELECT id FROM users")) if (!setting(REG.user(member.id), "")) store.setSetting(REG.user(member.id), previous);
      store.setSetting(REG.sessions, JSON.stringify([...sessionList(), { key: datasetKey, name: title, createdAt: now(), createdBy: user.id }]), user.id);
      store.setSetting(REG.fallback, datasetKey, user.id);
      store.setSetting(REG.user(user.id), datasetKey, user.id);
      audit(user, "dataset.session.created", datasetKey, { name: title, label: staged.label, kind: staged.kind });
    });
    const scope = currentScope();
    if (scope) scope.datasetKey = datasetKey;
    const session = { ...staged, entries: { merge: staged.entries.session, replace: staged.entries.session }, identity: { merge: staged.identity.session, replace: staged.identity.session } };
    const result = withKey(datasetKey, () => commitInto(user, session, { mode: "replace", link }));
    // Diğer ekranlardaki oturum seçici yeni oturumu listelesin (kendi oturumları değişmez).
    events?.publish("workspace.changed", { kind: "sessions", actorId: user.id, actorName: user.display_name, created: title });
    return { ...result, mode: "session", session: { key: datasetKey, name: title } };
  }

  function commitInto(user, staged, { mode, link = true } = {}) {
    const empty = loadRows().rows.length === 0;
    const effective = empty ? "replace" : mode;
    if (!["merge", "replace"].includes(effective)) throw new HttpError(400, "Devamı olarak ekle ya da yerine koy seçilmelidir.");
    const backupName = backup(effective === "merge" ? "veri-oncesi-ekleme" : "veri-oncesi-degistirme");
    const origin = staged.kind === "sheets" ? "sheets" : "excel";
    const entries = effective === "merge" ? staged.entries.merge : staged.entries.replace;
    const identity = effective === "merge" ? staged.identity.merge : staged.identity.replace;
    let counts;
    store.tx(() => {
      counts = apply(entries, { mode: effective, origin });
      sset(S.identity, JSON.stringify(identity), user.id);
      if (staged.kind === "sheets" && link) {
        sset(S.linkedUrl, staged.url, user.id);
        sset(S.lastSyncAt, now(), user.id);
        sset(S.lastSyncOkAt, now(), user.id);
        sset(S.lastSyncError, "", user.id);
      } else if (effective === "replace") {
        // Veri başka bir kaynakla değiştirildi: eski Sheet bağlantısı veriyi geri getirmesin.
        sset(S.linkedUrl, "", user.id);
      }
      sset(S.needsInitialSync, "0", user.id);
      sset(S.syncHold, "", user.id);
      if (effective === "replace" || empty || !sget(S.label, "")) sset(S.label, staged.label, user.id);
      logImport(user, { kind: staged.kind, mode: empty ? "initial" : effective, label: staged.label, url: staged.url, rowCount: entries.length, counts, backupName });
      audit(user, "dataset.imported", staged.id, { kind: staged.kind, mode: empty ? "initial" : effective, label: staged.label, rows: entries.length, ...counts, backupName });
    });
    stages.delete(staged.id);
    afterChange(user, { imported: true, mode: empty ? "initial" : effective });
    return { mode: empty ? "initial" : effective, counts, rowCount: loadRows().rows.length, label: sget(S.label, ""), sourceLabel: staged.label, linked: Boolean(linkedUrl()), backupName };
  }

  // ---------- Bağlı Google Sheets eşitlemesi ----------
  async function sync({ actor = SYSTEM_ACTOR, manual = false } = {}) {
    const url = linkedUrl();
    if (!url) return { ok: false, reason: "not-linked" };
    const datasetKey = activeKey();
    if (syncing.has(datasetKey)) return syncing.get(datasetKey);
    const running = (async () => {
      const started = now();
      const result = await readGoogleSheet(url, { fresh: true });
      sset(S.lastSyncAt, started);
      if (!result.connected) {
        sset(S.lastSyncError, result.message || "Google Sheets okunamadı.");
        return { ok: false, message: result.message };
      }
      const rows = cleanRows(result.rows);
      const identity = identitiesFor(rows).merge;
      const entries = toEntries(rows, identity);
      const { rows: currentRows, byId } = loadRows();
      // Formüller bu kez okunamadıysa (xlsx indirilemedi) kayıtlı formüller korunur; aksi hâlde her kesintide
      // formüller silinip geri gelirdi.
      if (result.formulasUnavailable) {
        for (const entry of entries) {
          const current = byId.get(entry.id)?.values;
          if (!current || (!current.__hofF && !current.__hofAt)) continue;
          if (current.__hofF && !entry.values.__hofF) entry.values.__hofF = current.__hofF;
          if (current.__hofAt && !entry.values.__hofAt) entry.values.__hofAt = current.__hofAt;
          entry.hash = rowHash(entry.values);
        }
      }
      const fromSheet = currentRows.filter(row => row.origin === "sheets" && !row.missingSince);
      const changes = diff(entries);
      const incomingIds = new Set(entries.map(entry => entry.id));
      const wouldMiss = fromSheet.filter(row => !incomingIds.has(row.rowId)).length;
      // Emniyet: Sheet boş döndüyse ya da satırların büyük kısmı birden "yeni" ve "kayıp" görünüyorsa (başlık satırı
      // değişmiş, sekme adı değişmiş gibi yapısal bir değişiklik) kendiliğinden uygulanmaz; yönetici karar verir.
      const structural = fromSheet.length >= 20 && changes.added >= fromSheet.length * 0.3 && wouldMiss >= fromSheet.length * 0.3;
      if ((!entries.length && fromSheet.length) || structural) {
        const hold = { at: started, added: changes.added, missing: wouldMiss, updated: changes.updated, rowCount: entries.length };
        sset(S.syncHold, JSON.stringify(hold));
        sset(S.lastSyncError, "");
        log?.warn?.("Sheet eşitlemesi yönetici onayına bırakıldı", hold);
        return { ok: false, held: true, hold };
      }
      let counts;
      store.tx(() => {
        counts = apply(entries, { mode: "sync", origin: "sheets" });
        sset(S.identity, JSON.stringify(identity));
        sset(S.lastSyncOkAt, started);
        sset(S.lastSyncError, "");
        sset(S.needsInitialSync, "0");
        sset(S.syncHold, "");
        const title = String(result.title || "").trim();
        if (title && (!sget(S.label, "") || sget(S.label, "") === "Google Sheets")) sset(S.label, title.slice(0, 200));
        if (changedSomething(counts)) logImport(actor, { kind: "sheets", mode: "sync", label: sget(S.label, ""), url, rowCount: entries.length, counts });
      });
      if (changedSomething(counts)) afterChange(actor);
      else invalidate();
      return { ok: true, counts, manual };
    })().finally(() => {
      syncing.delete(datasetKey);
    });
    syncing.set(datasetKey, running);
    return running;
  }

  function unlink(user) {
    if (!linkedUrl()) return summary({ detailed: true });
    store.tx(() => {
      sset(S.linkedUrl, "", user.id);
      sset(S.syncHold, "", user.id);
      sset(S.lastSyncError, "", user.id);
      audit(user, "dataset.unlinked", activeKey(), {});
    });
    afterChange(user);
    return summary({ detailed: true });
  }

  function remove(user) {
    const backupName = backup("veri-kaldirma-oncesi");
    let removed = 0;
    store.tx(() => {
      removed = store.run("DELETE FROM dataset_rows WHERE dataset_key = ?", activeKey()).changes;
      for (const name of [S.linkedUrl, S.label, S.syncHold, S.lastSyncError, S.lastSyncOkAt, S.identity]) sset(name, "", user.id);
      sset(S.needsInitialSync, "0", user.id);
      logImport(user, { kind: "remove", mode: "remove", label: "", rowCount: 0, counts: { removed }, backupName });
      audit(user, "dataset.removed", activeKey(), { removed, backupName });
    });
    afterChange(user);
    return { removed, backupName };
  }

  function missingRows(limit = 500) {
    return loadRows()
      .rows.filter(row => row.missingSince)
      .slice(0, limit)
      .map(row => ({ rowId: row.rowId, caseKey: row.caseKey, tab: row.tab, missingSince: row.missingSince, preview: Object.entries(row.values).filter(([key, value]) => !key.startsWith("__") && String(value).trim()).slice(0, 4).map(([key, value]) => `${key}: ${String(value).slice(0, 60)}`) }));
  }

  // action: "remove" (tablodan kaldır) | "keep" (tut; artık Sheet'e bağlı sayılmaz, işaretlenmez)
  function resolveMissing(user, action, rowIds) {
    if (!["remove", "keep"].includes(action)) throw new HttpError(400, "Geçersiz işlem.");
    const ids = Array.isArray(rowIds) ? rowIds.map(String).slice(0, 200_000) : [];
    if (!ids.length) throw new HttpError(400, "Kayıt seçilmedi.");
    const backupName = action === "remove" ? backup("sheette-olmayanlar-kaldirma-oncesi") : null;
    let changed = 0;
    store.tx(() => {
      for (const id of ids) {
        changed += action === "remove"
          ? store.run("DELETE FROM dataset_rows WHERE dataset_key = ? AND row_id = ? AND missing_since IS NOT NULL", activeKey(), id).changes
          : store.run("UPDATE dataset_rows SET origin = 'local', missing_since = NULL WHERE dataset_key = ? AND row_id = ? AND missing_since IS NOT NULL", activeKey(), id).changes;
      }
      logImport(user, { kind: "missing", mode: action, label: sget(S.label, ""), rowCount: changed, counts: action === "remove" ? { removed: changed } : { unchanged: changed }, backupName });
      audit(user, `dataset.missing.${action}`, activeKey(), { rows: changed, backupName });
    });
    afterChange(user);
    return { changed, backupName };
  }

  // v1.0.0 tarayıcısından gelen Sheet bağlantısı veya eski arayüzün "kaynak" yazması (uyumluluk).
  async function adoptLegacySheetUrl(user, value) {
    const url = String(value ?? "").trim();
    if (url === DATASET_KEY || url.startsWith(SESSION_PREFIX)) return { adopted: false };
    if (isSheetUrl(url) && !hasData()) {
      const staged = await stage(user, { kind: "sheets", url });
      commit(user, staged.stageId, { mode: "replace", link: true });
      return { adopted: true };
    }
    throw new HttpError(409, "Veri kaynağı artık Ayarlar → Veri bölümünden yönetilir. Sayfayı yenileyip oradan devam edin.");
  }

  function start() {
    if (!autoSync || timer) return;
    // Her oturumun bağlı Sheet'i kendi aralığıyla eşitlenir.
    const tick = () => {
      // Lisans salt okunurken (süre doldu, engellendi…) bağlı Sheet eşitlenmez: veri olduğu gibi kalır.
      if (!canWrite()) return;
      const minutes = Math.max(1, Number(setting("client.syncMinutes", "5")) || 5);
      for (const datasetKey of allKeys()) {
        withKey(datasetKey, () => {
          const url = linkedUrl();
          if (!url || syncing.has(datasetKey)) return;
          const last = Date.parse(sget(S.lastSyncAt, "")) || 0;
          if (sget(S.needsInitialSync) !== "1" && Date.now() - last < minutes * 60_000) return;
          sync().catch(error => log?.warn?.("Sheet eşitlemesi başarısız", error));
        });
      }
    };
    startTimer = setTimeout(tick, 5_000);
    startTimer.unref?.();
    timer = setInterval(tick, tickMs);
    timer.unref?.();
  }

  function stop() {
    clearTimeout(startTimer);
    clearInterval(timer);
    timer = null;
    stages.clear();
  }

  // İstemci ayarları için hafif özet (satırları okumaz).
  const info = () => ({ hasData: hasData(), label: sget(S.label, ""), linkedUrl: linkedUrl(), key: activeKey(), sessionCount: sessionList().length + 1 });

  // ---------- Oturum listesi, seçim, ad, silme ----------
  function sessions() {
    const current = activeKey();
    const extra = sessionList();
    const list = [{ key: DATASET_KEY, name: setting(REG.defaultName, ""), createdAt: null }, ...extra].map(item =>
      withKey(item.key, () => {
        const label = sget(S.label, "");
        return {
          key: item.key,
          name: item.name || label || (item.key === DATASET_KEY ? "İlk oturum" : "Oturum"),
          label,
          rowCount: rowCount(),
          recordCount: recordCount(),
          linked: Boolean(linkedUrl()),
          changedAt: sget(S.changedAt, "") || null,
          createdAt: item.createdAt || null,
          current: item.key === current,
        };
      }),
    );
    // Boş kalmış ilk oturum, başka oturum varken ve seçili değilken listelenmez.
    return list.filter(item => item.key !== DATASET_KEY || item.current || !extra.length || item.rowCount || item.recordCount);
  }

  function selectSession(user, datasetKey) {
    const target = String(datasetKey || "");
    if (!knownKey(target)) throw new HttpError(404, "Oturum bulunamadı. Silinmiş olabilir; listeyi yenileyin.");
    store.setSetting(REG.user(user.id), target, user.id);
    const scope = currentScope();
    if (scope) scope.datasetKey = target;
    return { current: target };
  }

  function renameSession(user, datasetKey, name) {
    const target = String(datasetKey || "");
    const title = String(name || "").replace(/\s+/g, " ").trim().slice(0, 80);
    if (!title) throw new HttpError(400, "Oturum adı gerekli.");
    if (!knownKey(target)) throw new HttpError(404, "Oturum bulunamadı.");
    store.tx(() => {
      if (target === DATASET_KEY) store.setSetting(REG.defaultName, title, user.id);
      else store.setSetting(REG.sessions, JSON.stringify(sessionList().map(item => (item.key === target ? { ...item, name: title } : item))), user.id);
      audit(user, "dataset.session.renamed", target, { name: title });
    });
    events?.publish("workspace.changed", { kind: "sessions", actorId: user.id, actorName: user.display_name });
    return { key: target, name: title };
  }

  // Oturum silme: oturumun satırları, düzeltmeleri, silinenleri, yeni kayıtları ve ayarları kalkar (önce yedek alınır).
  // İlk oturum silinmez; verisi Ayarlar → Veri → "Veriyi kaldır" ile boşaltılır.
  function deleteSession(user, datasetKey) {
    const target = String(datasetKey || "");
    if (target === DATASET_KEY) throw new HttpError(400, "İlk oturum silinemez; verisini Ayarlar → Veri → Veriyi kaldır ile boşaltabilirsiniz.");
    if (!sessionList().some(item => item.key === target)) throw new HttpError(404, "Oturum bulunamadı.");
    const backupName = backupDir ? (() => {
      try {
        return createBackup(store.db, backupDir, { label: "oturum-silme-oncesi", keep: backupKeep }).name;
      } catch (error) {
        log?.error?.("Oturum silmeden önce yedek alınamadı", error);
        throw new HttpError(500, "Silmeden önce yedek alınamadı; işlem yapılmadı. Disk alanını kontrol edin.");
      }
    })() : null;
    const suffix = suffixOf(target);
    let removed = 0;
    store.tx(() => {
      removed = store.run("DELETE FROM dataset_rows WHERE dataset_key = ?", target).changes;
      store.run("DELETE FROM dataset_imports WHERE dataset_key = ?", target);
      for (const table of ["overrides", "deleted_records", "records"]) store.run(`DELETE FROM ${table} WHERE source_name = ?`, target);
      store.run("DELETE FROM settings WHERE substr(key, -?) = ?", suffix.length, suffix);
      for (const row of store.all("SELECT key FROM settings WHERE key LIKE 'dataset.session.user.%' AND value = ?", target)) store.run("DELETE FROM settings WHERE key = ?", row.key);
      store.setSetting(REG.sessions, JSON.stringify(sessionList().filter(item => item.key !== target)), user.id);
      if (setting(REG.fallback, "") === target) store.setSetting(REG.fallback, sessionList().at(-1)?.key || DATASET_KEY, user.id);
      audit(user, "dataset.session.deleted", target, { rows: removed, backupName });
    });
    caches.delete(target);
    const scope = currentScope();
    if (scope?.datasetKey === target) scope.datasetKey = null;
    bumpClientState(user.id);
    events?.publish("workspace.changed", { kind: "sessions", actorId: user.id, actorName: user.display_name });
    return { removed, backupName };
  }
  const onChange = listener => {
    listeners.add(listener);
    return () => listeners.delete(listener);
  };
  const identity = () => currentIdentity();

  return {
    view, summary, info, stage, commit, sync, unlink, remove, missingRows, resolveMissing, adoptLegacySheetUrl, hasData, start, stop, invalidate, onChange, identity, pinLegacyIdentity,
    sessions, selectSession, renameSession, deleteSession, currentKey: activeKey, settingKey: name => sk(name), withKey,
  };
}
