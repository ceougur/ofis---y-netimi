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
import { matrixToRecords } from "./sections.mjs";
import { spreadsheetId } from "./sheets.mjs";
import { applyPatch } from "./sources.mjs";
import { rowHash, rowIdentities } from "./dataset-identity.mjs";

export const DATASET_KEY = "dataset://ofis";
export const MAX_ROWS = 200_000;
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
};

const isSheetUrl = value => /^https:\/\/docs\.google\.com\/spreadsheets\//i.test(String(value || "").trim());

export function createDatasetService({ store, audit, readGoogleSheet, bumpClientState, events, log, backupDir, backupKeep = 30, autoSync = true, tickMs = 60_000 }) {
  const stages = new Map();
  let cache = null; // { rows, byId } — veritabanındaki satırların ayrıştırılmış hâli
  let syncing = null;
  let timer = null;
  let startTimer = null;

  const now = () => new Date().toISOString();
  const setting = (key, fallback = "") => store.setting(key, fallback) ?? fallback;
  const linkedUrl = () => setting(S.linkedUrl, "").trim();

  // ---------- Okuma ----------
  function loadRows() {
    if (cache) return cache;
    const rows = store
      .all("SELECT row_id AS rowId, case_key AS caseKey, tab, position, values_json AS valuesJson, row_hash AS hash, origin, missing_since AS missingSince FROM dataset_rows WHERE dataset_key = ? ORDER BY position, created_at", DATASET_KEY)
      .map(({ valuesJson, ...row }) => ({ ...row, values: parseJson(valuesJson, {}) }));
    cache = { rows, byId: new Map(rows.map(row => [row.rowId, row])) };
    return cache;
  }
  const invalidate = () => {
    cache = null;
  };

  const recordCount = () => store.get("SELECT COUNT(*) AS count FROM records WHERE source_name = ?", DATASET_KEY).count;
  const rowCount = () => store.get("SELECT COUNT(*) AS count FROM dataset_rows WHERE dataset_key = ?", DATASET_KEY).count;
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
      label: setting(S.label, ""),
      rowCount: rows.length,
      recordCount: recordCount(),
      tabs: tabsOf(rows),
      linked: Boolean(linkedUrl()),
      lastSyncOkAt: setting(S.lastSyncOkAt, "") || null,
      changedAt: setting(S.changedAt, "") || null,
      missingCount: missing.length,
      missingKeys: missing.slice(0, 1000).map(row => row.caseKey),
    };
    if (!detailed) return base;
    return {
      ...base,
      linkedSheetUrl: linkedUrl(),
      lastSyncAt: setting(S.lastSyncAt, "") || null,
      lastSyncError: setting(S.lastSyncError, "") || null,
      syncHold: parseJson(setting(S.syncHold, ""), null),
      syncMinutes: Number(setting("client.syncMinutes", "5")) || 5,
      imports: store.all(
        `SELECT i.id, i.kind, i.mode, i.label, i.row_count AS rowCount, i.added, i.updated, i.unchanged, i.removed, i.missing, i.backup_name AS backupName,
                CASE WHEN i.created_by = 'system' THEN 'Otomatik eşitleme' ELSE COALESCE(u.display_name, '') END AS actorName, i.created_at AS createdAt
         FROM dataset_imports i LEFT JOIN users u ON u.id = i.created_by WHERE i.dataset_key = ? ORDER BY i.created_at DESC LIMIT 12`,
        DATASET_KEY,
      ),
    };
  }

  // Arayüzün beklediği birleşik görünüm: yeni kayıtlar + içeri alınan satırlar, ofisin düzeltmeleri uygulanmış,
  // silinenler çıkarılmış. Her satır dosya kimliğini (__hofKey) taşır.
  async function view() {
    if (linkedUrl() && setting(S.needsInitialSync) === "1") await sync().catch(error => log?.warn?.("İlk eşitleme yapılamadı", error));
    const { rows } = loadRows();
    const overrides = new Map();
    for (const item of store.all("SELECT case_key, field, value FROM overrides WHERE source_name = ?", DATASET_KEY)) {
      if (!overrides.has(item.case_key)) overrides.set(item.case_key, {});
      overrides.get(item.case_key)[item.field] = item.value;
    }
    const deleted = new Set(store.all("SELECT case_key FROM deleted_records WHERE source_name = ?", DATASET_KEY).map(item => item.case_key));
    const merged = [];
    for (const record of store.all("SELECT id, case_key, values_json FROM records WHERE source_name = ? ORDER BY created_at DESC", DATASET_KEY)) {
      if (deleted.has(record.case_key)) continue;
      merged.push({ ...parseJson(record.values_json), ...(overrides.get(record.case_key) || {}), __hofKey: record.case_key, __hofRecord: record.id });
    }
    for (const row of rows) {
      if (deleted.has(row.caseKey)) continue;
      const patch = overrides.get(row.caseKey);
      const values = patch ? applyPatch(row.values, patch) : { ...row.values };
      values.__hofKey = row.caseKey;
      if (row.missingSince) values.__hofMissing = row.missingSince;
      merged.push(values);
    }
    const label = setting(S.label, "") || "Çalışma verisi";
    const error = linkedUrl() ? setting(S.lastSyncError, "") : "";
    if (!merged.length && !rows.length) {
      return { connected: false, sourceUrl: DATASET_KEY, syncedAt: null, rows: [], tabs: [], message: error || "Henüz veri yüklenmedi." };
    }
    return {
      connected: true,
      sourceUrl: DATASET_KEY,
      syncedAt: setting(S.lastSyncOkAt, "") || setting(S.changedAt, "") || null,
      rows: merged,
      tabs: tabsOf(rows).map(title => ({ gid: "", title })),
      message: error ? `${label} · ${merged.length} kayıt · Google Sheets'e şu an ulaşılamıyor, son eşitlenen veri gösteriliyor.` : `${label} · ${merged.length} kayıt`,
    };
  }

  // ---------- İçeri alma: okuma ve önizleme ----------
  function purgeStages() {
    const limit = Date.now() - STAGE_TTL_MS;
    for (const [id, stage] of stages) if (stage.createdAt < limit) stages.delete(id);
    while (stages.size >= MAX_STAGES) stages.delete(stages.keys().next().value);
  }

  function toEntries(rows) {
    const identities = rowIdentities(rows);
    return rows.map((values, index) => ({ ...identities[index], values, hash: rowHash(values), position: index }));
  }

  function parseExcelSheets(sheets) {
    if (!Array.isArray(sheets)) throw new HttpError(400, "Tablo sayfaları okunamadı.");
    if (sheets.length > 200) throw new HttpError(400, "Dosyada en fazla 200 sayfa olabilir.");
    const rows = [];
    const tabs = [];
    let cells = 0;
    for (const sheet of sheets) {
      const name = String(sheet?.name ?? "").trim().slice(0, 200);
      const matrix = Array.isArray(sheet?.matrix) ? sheet.matrix.slice(0, MAX_ROWS + 1).map(line => (Array.isArray(line) ? line.slice(0, 500).map(cell => String(cell ?? "").slice(0, 20_000)) : [])) : [];
      cells += matrix.reduce((total, line) => total + line.length, 0);
      if (cells > 20_000_000) throw new HttpError(400, "Tablo çok büyük (en fazla 20 milyon hücre).");
      const parsed = matrixToRecords(matrix, name);
      for (const row of parsed.rows) rows.push(row); // yayma (...) büyük sayfalarda çağrı yığınını taşırır
      for (const label of parsed.tabs) if (label && !tabs.includes(label)) tabs.push(label);
    }
    return { rows, tabs };
  }

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
      ({ rows, tabs } = parseExcelSheets(body.sheets));
      label = fileName;
    } else throw new HttpError(400, "Bilinmeyen içeri alma türü.");
    rows = cleanRows(rows);
    if (!rows.length) throw new HttpError(400, "Tabloda okunabilir kayıt bulunamadı. Tablonun kolon başlıklarıyla başladığından emin olun.");
    const entries = toEntries(rows);
    const id = `stage-${randomUUID()}`;
    stages.set(id, { id, userId: user.id, kind, label, url, entries, tabs, createdAt: Date.now() });
    const changes = diff(entries);
    return {
      stageId: id,
      kind,
      label,
      url,
      rowCount: entries.length,
      tabs,
      hasData: loadRows().rows.length > 0,
      current: { rowCount: loadRows().rows.length, label: setting(S.label, ""), linked: Boolean(linkedUrl()) },
      preview: {
        merge: { added: changes.added, updated: changes.updated, unchanged: changes.unchanged, kept: changes.others },
        replace: { added: changes.added, updated: changes.updated, unchanged: changes.unchanged, removed: changes.others },
        samples: changes.samples,
      },
    };
  }

  // ---------- Uygulama ----------
  // mode: "merge" (devamı olarak ekle), "replace" (yerine koy), "sync" (bağlı Sheet eşitlemesi).
  function apply(entries, { mode, origin }) {
    const timestamp = now();
    const current = new Map(
      store.all("SELECT row_id AS rowId, row_hash AS hash, position, origin, missing_since AS missingSince FROM dataset_rows WHERE dataset_key = ?", DATASET_KEY).map(row => [row.rowId, row]),
    );
    const counts = { added: 0, updated: 0, unchanged: 0, removed: 0, missing: 0 };
    const insert = (entry, position) =>
      store.run(
        "INSERT INTO dataset_rows (dataset_key, row_id, case_key, tab, position, values_json, row_hash, origin, created_at, updated_at, missing_since) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NULL)",
        DATASET_KEY, entry.id, entry.caseKey, entry.tab, position, JSON.stringify(entry.values), entry.hash, origin, timestamp, timestamp,
      );
    const update = (entry, position) =>
      store.run(
        "UPDATE dataset_rows SET case_key = ?, tab = ?, position = ?, values_json = ?, row_hash = ?, origin = ?, updated_at = ?, missing_since = NULL WHERE dataset_key = ? AND row_id = ?",
        entry.caseKey, entry.tab, position, JSON.stringify(entry.values), entry.hash, origin, timestamp, DATASET_KEY, entry.id,
      );
    const touch = (entry, row, position) => {
      if (row.position !== position || row.missingSince || row.origin !== origin) {
        store.run("UPDATE dataset_rows SET position = ?, origin = ?, missing_since = NULL WHERE dataset_key = ? AND row_id = ?", position, origin, DATASET_KEY, entry.id);
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
      for (const row of rest) store.run("DELETE FROM dataset_rows WHERE dataset_key = ? AND row_id = ?", DATASET_KEY, row.rowId);
      counts.removed = rest.length;
      return counts;
    }
    // sync: kaynakta olmayan satırlar silinmez; bağlı Sheet'ten gelmişse "Sheet'te yok" olarak işaretlenir.
    rest.forEach((row, offset) => {
      const position = entries.length + offset;
      const flag = row.origin === "sheets" && !row.missingSince;
      if (flag) counts.missing += 1;
      if (flag || row.position !== position) {
        store.run("UPDATE dataset_rows SET position = ?, missing_since = COALESCE(missing_since, ?) WHERE dataset_key = ? AND row_id = ?", position, flag ? timestamp : null, DATASET_KEY, row.rowId);
      }
    });
    return counts;
  }

  function logImport(actor, { kind, mode, label, url, rowCount: total, counts, backupName }) {
    store.run(
      "INSERT INTO dataset_imports (id, dataset_key, kind, mode, label, source_url, row_count, added, updated, unchanged, removed, missing, backup_name, created_by, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)",
      `import-${randomUUID()}`, DATASET_KEY, kind, mode, label || "", url || null, total, counts.added || 0, counts.updated || 0, counts.unchanged || 0, counts.removed || 0, counts.missing || 0, backupName || null, actor.id, now(),
    );
  }

  const changedSomething = counts => counts.added + counts.updated + counts.removed + counts.missing > 0;

  function afterChange(actor) {
    invalidate();
    store.setSetting(S.changedAt, now(), actor.id === "system" ? null : actor.id);
    bumpClientState(actor.id === "system" ? null : actor.id);
    // Tüm açık ekranlar tabloyu yeniler (işlemi yapan dahil; onun sayfası zaten yeniden yüklenir).
    events?.publish("workspace.changed", { kind: "records", actorId: actor.id, actorName: actor.display_name, dataset: true });
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

  function commit(user, stageId, { mode, link = true } = {}) {
    const staged = stages.get(String(stageId || ""));
    if (!staged) throw new HttpError(404, "İçeri alma süresi doldu veya bulunamadı. Dosyayı ya da bağlantıyı yeniden seçin.");
    const empty = loadRows().rows.length === 0;
    const effective = empty ? "replace" : mode;
    if (!["merge", "replace"].includes(effective)) throw new HttpError(400, "Devamı olarak ekle ya da yerine koy seçilmelidir.");
    const backupName = backup(effective === "merge" ? "veri-oncesi-ekleme" : "veri-oncesi-degistirme");
    const origin = staged.kind === "sheets" ? "sheets" : "excel";
    let counts;
    store.tx(() => {
      counts = apply(staged.entries, { mode: effective, origin });
      if (staged.kind === "sheets" && link) {
        store.setSetting(S.linkedUrl, staged.url, user.id);
        store.setSetting(S.lastSyncAt, now(), user.id);
        store.setSetting(S.lastSyncOkAt, now(), user.id);
        store.setSetting(S.lastSyncError, "", user.id);
      } else if (effective === "replace") {
        // Veri başka bir kaynakla değiştirildi: eski Sheet bağlantısı veriyi geri getirmesin.
        store.setSetting(S.linkedUrl, "", user.id);
      }
      store.setSetting(S.needsInitialSync, "0", user.id);
      store.setSetting(S.syncHold, "", user.id);
      if (effective === "replace" || empty || !setting(S.label, "")) store.setSetting(S.label, staged.label, user.id);
      logImport(user, { kind: staged.kind, mode: empty ? "initial" : effective, label: staged.label, url: staged.url, rowCount: staged.entries.length, counts, backupName });
      audit(user, "dataset.imported", staged.id, { kind: staged.kind, mode: empty ? "initial" : effective, label: staged.label, rows: staged.entries.length, ...counts, backupName });
    });
    stages.delete(staged.id);
    afterChange(user);
    return { mode: empty ? "initial" : effective, counts, rowCount: loadRows().rows.length, label: setting(S.label, ""), sourceLabel: staged.label, linked: Boolean(linkedUrl()), backupName };
  }

  // ---------- Bağlı Google Sheets eşitlemesi ----------
  async function sync({ actor = SYSTEM_ACTOR, manual = false } = {}) {
    const url = linkedUrl();
    if (!url) return { ok: false, reason: "not-linked" };
    if (syncing) return syncing;
    syncing = (async () => {
      const started = now();
      const result = await readGoogleSheet(url, { fresh: true });
      store.setSetting(S.lastSyncAt, started);
      if (!result.connected) {
        store.setSetting(S.lastSyncError, result.message || "Google Sheets okunamadı.");
        return { ok: false, message: result.message };
      }
      const rows = cleanRows(result.rows);
      const entries = toEntries(rows);
      const { rows: currentRows } = loadRows();
      const fromSheet = currentRows.filter(row => row.origin === "sheets" && !row.missingSince);
      const changes = diff(entries);
      const incomingIds = new Set(entries.map(entry => entry.id));
      const wouldMiss = fromSheet.filter(row => !incomingIds.has(row.rowId)).length;
      // Emniyet: Sheet boş döndüyse ya da satırların büyük kısmı birden "yeni" ve "kayıp" görünüyorsa (başlık satırı
      // değişmiş, sekme adı değişmiş gibi yapısal bir değişiklik) kendiliğinden uygulanmaz; yönetici karar verir.
      const structural = fromSheet.length >= 20 && changes.added >= fromSheet.length * 0.3 && wouldMiss >= fromSheet.length * 0.3;
      if ((!entries.length && fromSheet.length) || structural) {
        const hold = { at: started, added: changes.added, missing: wouldMiss, updated: changes.updated, rowCount: entries.length };
        store.setSetting(S.syncHold, JSON.stringify(hold));
        store.setSetting(S.lastSyncError, "");
        log?.warn?.("Sheet eşitlemesi yönetici onayına bırakıldı", hold);
        return { ok: false, held: true, hold };
      }
      let counts;
      store.tx(() => {
        counts = apply(entries, { mode: "sync", origin: "sheets" });
        store.setSetting(S.lastSyncOkAt, started);
        store.setSetting(S.lastSyncError, "");
        store.setSetting(S.needsInitialSync, "0");
        store.setSetting(S.syncHold, "");
        const title = String(result.title || "").trim();
        if (title && (!setting(S.label, "") || setting(S.label, "") === "Google Sheets")) store.setSetting(S.label, title.slice(0, 200));
        if (changedSomething(counts)) logImport(actor, { kind: "sheets", mode: "sync", label: setting(S.label, ""), url, rowCount: entries.length, counts });
      });
      if (changedSomething(counts)) afterChange(actor);
      else invalidate();
      return { ok: true, counts, manual };
    })().finally(() => {
      syncing = null;
    });
    return syncing;
  }

  function unlink(user) {
    if (!linkedUrl()) return summary({ detailed: true });
    store.tx(() => {
      store.setSetting(S.linkedUrl, "", user.id);
      store.setSetting(S.syncHold, "", user.id);
      store.setSetting(S.lastSyncError, "", user.id);
      audit(user, "dataset.unlinked", DATASET_KEY, {});
    });
    afterChange(user);
    return summary({ detailed: true });
  }

  function remove(user) {
    const backupName = backup("veri-kaldirma-oncesi");
    let removed = 0;
    store.tx(() => {
      removed = store.run("DELETE FROM dataset_rows WHERE dataset_key = ?", DATASET_KEY).changes;
      for (const key of [S.linkedUrl, S.label, S.syncHold, S.lastSyncError, S.lastSyncOkAt]) store.setSetting(key, "", user.id);
      store.setSetting(S.needsInitialSync, "0", user.id);
      logImport(user, { kind: "remove", mode: "remove", label: "", rowCount: 0, counts: { removed }, backupName });
      audit(user, "dataset.removed", DATASET_KEY, { removed, backupName });
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
          ? store.run("DELETE FROM dataset_rows WHERE dataset_key = ? AND row_id = ? AND missing_since IS NOT NULL", DATASET_KEY, id).changes
          : store.run("UPDATE dataset_rows SET origin = 'local', missing_since = NULL WHERE dataset_key = ? AND row_id = ? AND missing_since IS NOT NULL", DATASET_KEY, id).changes;
      }
      logImport(user, { kind: "missing", mode: action, label: setting(S.label, ""), rowCount: changed, counts: action === "remove" ? { removed: changed } : { unchanged: changed }, backupName });
      audit(user, `dataset.missing.${action}`, DATASET_KEY, { rows: changed, backupName });
    });
    afterChange(user);
    return { changed, backupName };
  }

  // v1.0.0 tarayıcısından gelen Sheet bağlantısı veya eski arayüzün "kaynak" yazması (uyumluluk).
  async function adoptLegacySheetUrl(user, value) {
    const url = String(value ?? "").trim();
    if (url === DATASET_KEY) return { adopted: false };
    if (isSheetUrl(url) && !hasData()) {
      const staged = await stage(user, { kind: "sheets", url });
      commit(user, staged.stageId, { mode: "replace", link: true });
      return { adopted: true };
    }
    throw new HttpError(409, "Veri kaynağı artık Ayarlar → Veri bölümünden yönetilir. Sayfayı yenileyip oradan devam edin.");
  }

  function start() {
    if (!autoSync || timer) return;
    const tick = () => {
      const url = linkedUrl();
      if (!url || syncing) return;
      const minutes = Math.max(1, Number(setting("client.syncMinutes", "5")) || 5);
      const last = Date.parse(setting(S.lastSyncAt, "")) || 0;
      if (setting(S.needsInitialSync) !== "1" && Date.now() - last < minutes * 60_000) return;
      sync().catch(error => log?.warn?.("Sheet eşitlemesi başarısız", error));
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
  const info = () => ({ hasData: hasData(), label: setting(S.label, ""), linkedUrl: linkedUrl() });

  return { view, summary, info, stage, commit, sync, unlink, remove, missingRows, resolveMissing, adoptLegacySheetUrl, hasData, start, stop, invalidate };
}
