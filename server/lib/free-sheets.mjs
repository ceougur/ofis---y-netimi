// Serbest sayfalar (v2.0.1): kullanıcının sekme şeridindeki "+" ile açtığı, Excel gibi doldurduğu sayfalar.
// - Sayfa, veri oturumuna aittir; kolonları (sıralı, kalıcı kimlikli), satırları (sıralı, kalıcı kimlikli) ve hücreleri
//   ayrı tablolarda durur: iki kişi aynı anda farklı hücrelere yazsa da birbirinin değerini ezmez.
// - Hücrede kullanıcının yazdığı ham metin saklanır ("12,50 ₺", "=TOPLA(B1:B9)"); görünen değer her okumada
//   hesaplanır (formula/sheet.mjs). Kolon/satır ekleyip silince formüllerdeki başvurular Excel'deki gibi kayar.
// - Tablo görünümüne (dataset.view) en az bir dolu hücresi olan satırlar "serbest:<satır>" kimliğiyle girer; böylece
//   detay kartı, notlar, tahsilat, belgeler, görevler, arama, özet kartları, akıllı denetim ve Excel'e aktarma
//   diğer sekmelerdeki gibi çalışır. Detay kartından yapılan düzeltme doğrudan hücreye yazılır.
// - Silme, toplam ekleme, doldurma ve yapıştırma öncesi sayfanın anlık görüntüsü alınır; "Geri al" onu geri yükler.
import { randomUUID } from "node:crypto";
import { HttpError, parseJson } from "./http.mjs";
import { indexToCol } from "./formula/parse.mjs";
import { computeSheet, mapReferences, rewriteReferences, shiftReferences } from "./formula/sheet.mjs";
import { Cell } from "./formula/values.mjs";

export const FREE_PREFIX = "serbest:";
// v2.0.2: kolon sınırı 60 → 500 (Excel içeri almadaki sınırla aynı). Izgaranın akıcı kalması için toplam hücre
// 250.000'i geçmez (ör. 500 kolon × 500 satır ya da 125 kolon × 2000 satır).
export const FREE_LIMITS = Object.freeze({ sheets: 30, rows: 2000, columns: 500, cells: 250_000, raw: 5000, name: 60, history: 30 });
const tooManyColumns = () => new HttpError(400, `Bir sayfada en fazla ${FREE_LIMITS.columns} kolon olabilir.`);
const tooManyCells = (rows, columns) => new HttpError(400, `Sayfa çok büyük olur (${(rows * columns).toLocaleString("tr-TR")} hücre). Bir sayfada en fazla ${FREE_LIMITS.cells.toLocaleString("tr-TR")} hücre olabilir (ör. ${FREE_LIMITS.columns} kolon × ${Math.floor(FREE_LIMITS.cells / FREE_LIMITS.columns)} satır). Boş satırları silin ya da yeni bir sayfa açın.`);
// Satır × kolon sınırı; rows ve columns yeni (değişiklik sonrası) sayılardır.
const checkSize = (rows, columns) => {
  if (columns > FREE_LIMITS.columns) throw tooManyColumns();
  if (rows * columns > FREE_LIMITS.cells) throw tooManyCells(rows, columns);
};
const SEP = " › ";
const id = prefix => `${prefix}${randomUUID().replace(/-/g, "").slice(0, 14)}`;
const clean = (value, max) =>
  String(value ?? "")
    .replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]+/g, "")
    .slice(0, max);
const cleanName = (value, max) => clean(value, max * 2).replace(/\s+/g, " ").trim().slice(0, max);
// Kolon adı: kayıttaki alan adıdır; "__" ile başlayan adlar programın iç alanlarıyla (__hofKey, __sheet) çakışmasın.
const columnName = value => cleanName(value, FREE_LIMITS.name).replace(/^_+\s*/, "");
const isFormula = raw => String(raw ?? "").startsWith("=") && String(raw).length > 1;
const fold = value => String(value).toLocaleLowerCase("tr-TR");
const numericDisplay = text => typeof new Cell(text).value === "number";

export function createFreeSheets({ store, audit, dataset, trash = null }) {
  const now = () => new Date().toISOString();
  const current = () => dataset.currentKey();

  // ---------- Okuma ----------
  const sheetRow = sheetId => store.get("SELECT * FROM free_sheets WHERE id = ? AND dataset_key = ? AND deleted_at IS NULL", String(sheetId || ""), current());
  const requireSheet = sheetId => {
    const row = sheetRow(sheetId);
    if (!row) throw new HttpError(404, "Sayfa bulunamadı; silinmiş olabilir. Sayfayı yenileyin.");
    return row;
  };
  const columnsOf = sheet => {
    const list = parseJson(sheet.columns_json, []);
    return Array.isArray(list) ? list.filter(item => item && typeof item.id === "string") : [];
  };
  const rowsOf = sheetId => store.all("SELECT id, position, created_by, created_at FROM free_rows WHERE sheet_id = ? ORDER BY position, created_at, id", sheetId);
  const cellsOf = sheetId => {
    const map = new Map();
    for (const cell of store.all("SELECT row_id, col_id, raw FROM free_cells WHERE sheet_id = ?", sheetId)) map.set(`${cell.row_id}|${cell.col_id}`, cell.raw);
    return map;
  };
  // Kolonların görünen (ve kayıttaki alan) adları: boş başlık "Sütun B"; aynı ad ikinci kez "Ad (2)".
  const headersOf = columns => {
    const used = new Map();
    return columns.map((column, index) => {
      const base = columnName(column.name) || `Sütun ${indexToCol(index)}`;
      let name = base;
      for (let n = 2; used.has(fold(name)); n += 1) name = `${base} (${n})`;
      used.set(fold(name), true);
      return name;
    });
  };
  function load(sheet) {
    const columns = columnsOf(sheet);
    const rows = rowsOf(sheet.id);
    const cells = cellsOf(sheet.id);
    const grid = computeSheet({ columns, rows, raw: (r, c) => cells.get(`${rows[r].id}|${columns[c].id}`) ?? "" });
    return { sheet, columns, rows, cells, grid, headers: headersOf(columns) };
  }

  // Satırın kayıt sayılması için en az bir hücresine elle değer yazılmış olmalı: yalnızca (kolondan gelen) formül
  // taşıyan boş satırlar tabloda, özet kartlarında ve detayda kayıt olarak görünmez.
  const hasValue = (cells, row, columns) => columns.some(column => {
    const raw = cells.get(`${row.id}|${column.id}`) || "";
    return raw.trim() && !isFormula(raw);
  });

  function detail(sheetId) {
    const { sheet, columns, rows, cells, grid, headers } = load(requireSheet(sheetId));
    const editor = sheet.updated_by ? store.get("SELECT display_name AS name FROM users WHERE id = ?", sheet.updated_by) : null;
    return {
      id: sheet.id,
      name: sheet.name,
      updatedAt: sheet.updated_at,
      updatedByName: editor?.name || "",
      columns: columns.map((column, index) => ({ id: column.id, name: column.name || "", header: headers[index], letter: indexToCol(index) })),
      rows: rows.map((row, index) => ({ id: row.id, key: `${FREE_PREFIX}${row.id}`, number: index + 1, record: hasValue(cells, row, columns), cells: grid[index] })),
      limits: FREE_LIMITS,
      canUndo: Boolean(store.get("SELECT 1 AS x FROM free_history WHERE sheet_id = ? LIMIT 1", sheet.id)),
    };
  }

  const list = () => store.all("SELECT id, name, position FROM free_sheets WHERE dataset_key = ? AND deleted_at IS NULL ORDER BY position, created_at", current());

  // Tablo görünümüne girecek satırlar: en az bir dolu hücresi olanlar, sayfa ve satır sırasıyla.
  function viewRows() {
    const out = [];
    for (const summary of list()) {
      const { sheet, columns, rows, cells: raws, grid, headers } = load(requireSheet(summary.id));
      rows.forEach((row, r) => {
        const cells = grid[r];
        if (!hasValue(raws, row, columns)) return;
        const record = { __hofKey: `${FREE_PREFIX}${row.id}`, __sheet: sheet.name, __hofFree: sheet.id, __hofRow: String(r + 1) };
        const formulas = {};
        cells.forEach((cell, c) => {
          record[headers[c]] = cell.display;
          if (cell.formula) formulas[headers[c]] = { d: cell.raw, s: cell.error ? "stale" : "calc" };
        });
        if (Object.keys(formulas).length) record.__hofFx = JSON.stringify(formulas);
        out.push(record);
      });
    }
    return out;
  }
  const tabs = () => list().map(item => item.name);

  // ---------- Yazma yardımcıları ----------
  const touch = (sheet, user) => store.run("UPDATE free_sheets SET updated_at = ?, updated_by = ? WHERE id = ?", now(), user.id, sheet.id);
  const saveColumns = (sheet, columns, user) => store.run("UPDATE free_sheets SET columns_json = ?, updated_at = ?, updated_by = ? WHERE id = ?", JSON.stringify(columns), now(), user.id, sheet.id);
  const renumber = sheetId => rowsOf(sheetId).forEach((row, index) => store.run("UPDATE free_rows SET position = ? WHERE id = ?", index, row.id));
  // Yapı değişince sayfadaki tüm formüllerin başvuruları kaydırılır.
  const rewriteAll = (sheetId, change, user) => {
    for (const cell of store.all("SELECT row_id, col_id, raw FROM free_cells WHERE sheet_id = ? AND raw LIKE '=%'", sheetId)) {
      const next = rewriteReferences(cell.raw, change);
      if (next !== cell.raw) store.run("UPDATE free_cells SET raw = ?, updated_by = ?, updated_at = ? WHERE row_id = ? AND col_id = ?", next, user.id, now(), cell.row_id, cell.col_id);
    }
  };
  const setCell = (sheetId, rowId, colId, raw, user) => {
    const value = clean(raw, FREE_LIMITS.raw);
    if (!value.trim()) store.run("DELETE FROM free_cells WHERE row_id = ? AND col_id = ?", rowId, colId);
    else store.run("INSERT INTO free_cells (row_id, col_id, sheet_id, raw, updated_by, updated_at) VALUES (?, ?, ?, ?, ?, ?) ON CONFLICT(row_id, col_id) DO UPDATE SET raw = excluded.raw, updated_by = excluded.updated_by, updated_at = excluded.updated_at", rowId, colId, sheetId, value, user.id, now());
  };
  function snapshot(sheet, label, user) {
    const snapId = id("fh");
    const data = { name: sheet.name, columns: columnsOf(sheet), rows: rowsOf(sheet.id), cells: store.all("SELECT row_id, col_id, raw FROM free_cells WHERE sheet_id = ?", sheet.id).map(cell => [cell.row_id, cell.col_id, cell.raw]) };
    store.run("INSERT INTO free_history (id, sheet_id, label, snapshot_json, created_by, created_at) VALUES (?, ?, ?, ?, ?, ?)", snapId, sheet.id, label, JSON.stringify(data), user.id, now());
    const extra = store.all("SELECT id FROM free_history WHERE sheet_id = ? ORDER BY created_at DESC, id DESC LIMIT -1 OFFSET ?", sheet.id, FREE_LIMITS.history);
    for (const item of extra) store.run("DELETE FROM free_history WHERE id = ?", item.id);
    return snapId;
  }
  const addRowRecords = (sheet, index, count, user) => {
    const existing = rowsOf(sheet.id);
    if (existing.length + count > FREE_LIMITS.rows) throw new HttpError(400, `Bir sayfada en fazla ${FREE_LIMITS.rows} satır olabilir.`);
    checkSize(existing.length + count, columnsOf(sheet).length);
    const at = Math.max(0, Math.min(index ?? existing.length, existing.length));
    const created = [];
    for (let n = 0; n < count; n += 1) {
      const rowId = id("fr");
      // Geçici konum: "at"taki satırın hemen önüne, kendi aralarında sıralı (sonra 0,1,2… diye yeniden numaralanır).
      store.run("INSERT INTO free_rows (id, sheet_id, position, created_by, created_at) VALUES (?, ?, ?, ?, ?)", rowId, sheet.id, at - 1 + (n + 1) / (count + 1), user.id, now());
      created.push(rowId);
    }
    // Ortadan eklemede alttaki satırların formülleri kayar.
    if (at < existing.length) rewriteAll(sheet.id, { axis: "row", op: "insert", index: at, count }, user);
    renumber(sheet.id);
    return { created, at };
  };
  const nameTaken = (name, exceptId = "") => {
    const folded = fold(name);
    const dataTabs = dataset.dataTabs ? dataset.dataTabs() : [];
    return dataTabs.some(tab => fold(tab) === folded) || list().some(item => item.id !== exceptId && fold(item.name) === folded);
  };
  const validName = (value, exceptId = "") => {
    const name = cleanName(value, FREE_LIMITS.name);
    if (!name) throw new HttpError(400, "Sayfaya bir ad verin.");
    if (name.includes(SEP.trim())) throw new HttpError(400, "Sayfa adında “›” işareti kullanılamaz.");
    if (nameTaken(name, exceptId)) throw new HttpError(409, `“${name}” adında bir sekme zaten var. Farklı bir ad yazın.`);
    return name;
  };

  // ---------- Sayfa ----------
  function create(user, { name, columns = 4, rows = 10, names = [] } = {}) {
    const title = validName(name);
    if (list().length >= FREE_LIMITS.sheets) throw new HttpError(400, `En fazla ${FREE_LIMITS.sheets} serbest sayfa açılabilir.`);
    const given = (Array.isArray(names) ? names : []).slice(0, FREE_LIMITS.columns).map(columnName);
    const seen = new Set();
    for (const item of given) {
      if (!item) continue;
      if (seen.has(fold(item))) throw new HttpError(409, `“${item}” kolon adı iki kez yazılmış.`);
      seen.add(fold(item));
    }
    const columnCount = Math.max(1, given.length, Math.min(FREE_LIMITS.columns, Math.floor(Number(columns) || 4)));
    const rowCount = Math.max(1, Math.min(FREE_LIMITS.rows, Math.floor(Number(rows) || 10)));
    checkSize(rowCount, columnCount);
    const sheetId = id("fs");
    const position = (store.get("SELECT MAX(position) AS max FROM free_sheets WHERE dataset_key = ?", current()).max ?? -1) + 1;
    store.tx(() => {
      store.run(
        "INSERT INTO free_sheets (id, dataset_key, name, position, columns_json, created_by, created_at, updated_by, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)",
        sheetId, current(), title, position, JSON.stringify(Array.from({ length: columnCount }, (_, n) => ({ id: id("fc"), name: given[n] || "" }))), user.id, now(), user.id, now(),
      );
      for (let n = 0; n < rowCount; n += 1) store.run("INSERT INTO free_rows (id, sheet_id, position, created_by, created_at) VALUES (?, ?, ?, ?, ?)", id("fr"), sheetId, n, user.id, now());
      audit(user, "free.sheet.created", sheetId, { name: title, columns: columnCount, rows: rowCount });
    });
    return detail(sheetId);
  }

  // Excel / Google Sheets sayfasından yeni sayfa (v2.0.10; lib/free-import.mjs matrixToFree çıktısıyla). Tek işlem
  // bloğunda kurulur. Program hesaplayamadığı formülü (desteklenmeyen işlev) Excel'deki değeriyle bırakır.
  function importSheet(user, { name, names = [], rows = [], fallback = {}, source = "", foreign = 0, skippedAbove = 0 } = {}) {
    if (list().length >= FREE_LIMITS.sheets) throw new HttpError(400, `En fazla ${FREE_LIMITS.sheets} serbest sayfa açılabilir.`);
    const base = cleanName(name, FREE_LIMITS.name) || "Aktarılan sayfa";
    let title = base;
    for (let n = 2; nameTaken(title); n += 1) title = cleanName(`${base.slice(0, FREE_LIMITS.name - 6)} (${n})`, FREE_LIMITS.name);
    validName(title);
    const headers = (Array.isArray(names) ? names : []).map(columnName);
    const data = (Array.isArray(rows) ? rows : []).map(row => (Array.isArray(row) ? row.map(value => clean(value, FREE_LIMITS.raw)) : []));
    const columnCount = Math.max(1, headers.length, ...data.map(row => row.length));
    if (columnCount > FREE_LIMITS.columns) throw new HttpError(400, `Sayfada ${columnCount} kolon var; bir serbest sayfada en fazla ${FREE_LIMITS.columns} kolon olabilir. Excel'de kullanılmayan kolonları silip yeniden deneyin.`);
    if (data.length > FREE_LIMITS.rows) throw new HttpError(400, `Sayfada ${data.length.toLocaleString("tr-TR")} satır var; bir serbest sayfada en fazla ${FREE_LIMITS.rows.toLocaleString("tr-TR")} satır olabilir. Büyük tablolar için ana veri yüklemesini (Excel yükle) kullanın ya da sayfayı bölün.`);
    const rowCount = Math.max(1, data.length);
    checkSize(rowCount, columnCount);
    const sheetId = id("fs");
    const position = (store.get("SELECT MAX(position) AS max FROM free_sheets WHERE dataset_key = ?", current()).max ?? -1) + 1;
    const columnIds = Array.from({ length: columnCount }, () => id("fc"));
    const rowIds = Array.from({ length: rowCount }, () => id("fr"));
    let asValues = 0;
    let formulas = 0;
    store.tx(() => {
      store.run(
        "INSERT INTO free_sheets (id, dataset_key, name, position, columns_json, created_by, created_at, updated_by, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)",
        sheetId, current(), title, position, JSON.stringify(columnIds.map((columnId, n) => ({ id: columnId, name: headers[n] || "" }))), user.id, now(), user.id, now(),
      );
      rowIds.forEach((rowId, n) => store.run("INSERT INTO free_rows (id, sheet_id, position, created_by, created_at) VALUES (?, ?, ?, ?, ?)", rowId, sheetId, n, user.id, now()));
      data.forEach((row, r) =>
        row.forEach((raw, c) => {
          if (!raw.trim()) return;
          if (isFormula(raw)) formulas += 1;
          setCell(sheetId, rowIds[r], columnIds[c], raw, user);
        }),
      );
      // Hesaplanamayan formül (#AD? vb.) Excel'de hatasızsa değeriyle kalır.
      const { grid } = load(sheetRow(sheetId));
      for (const [key, value] of Object.entries(fallback || {})) {
        const [r, c] = key.split(",").map(Number);
        const cell = grid[r]?.[c];
        if (!cell?.formula || !cell.error || /^#/.test(String(value).trim())) continue;
        setCell(sheetId, rowIds[r], columnIds[c], String(value), user);
        asValues += 1;
      }
      audit(user, "free.sheet.imported", sheetId, { name: title, source, rows: rowCount, columns: columnCount, formulas: formulas - asValues, asValues: asValues + foreign });
    });
    return { ...detail(sheetId), imported: { rows: data.length, columns: columnCount, formulas: formulas - asValues, asValues: asValues + (Number(foreign) || 0), skippedAbove: Number(skippedAbove) || 0 } };
  }

  function rename(user, sheetId, name) {
    const sheet = requireSheet(sheetId);
    const title = validName(name, sheet.id);
    if (title === sheet.name) return detail(sheet.id);
    store.tx(() => {
      store.run("UPDATE free_sheets SET name = ?, updated_at = ?, updated_by = ? WHERE id = ?", title, now(), user.id, sheet.id);
      audit(user, "free.sheet.renamed", sheet.id, { name: title, previous: sheet.name });
    });
    return detail(sheet.id);
  }

  function remove(user, sheetId) {
    const sheet = requireSheet(sheetId);
    store.tx(() => {
      store.run("UPDATE free_sheets SET deleted_at = ?, deleted_by = ? WHERE id = ?", now(), user.id, sheet.id);
      audit(user, "free.sheet.deleted", sheet.id, { name: sheet.name });
    });
    return { id: sheet.id, name: sheet.name };
  }

  function restore(user, sheetId) {
    const sheet = store.get("SELECT * FROM free_sheets WHERE id = ? AND dataset_key = ? AND deleted_at IS NOT NULL", String(sheetId || ""), current());
    if (!sheet) throw new HttpError(404, "Geri alınacak sayfa bulunamadı.");
    if (nameTaken(sheet.name, sheet.id)) throw new HttpError(409, `“${sheet.name}” adında bir sekme var; sayfa geri alınamadı.`);
    store.tx(() => {
      store.run("UPDATE free_sheets SET deleted_at = NULL, deleted_by = NULL, updated_at = ?, updated_by = ? WHERE id = ?", now(), user.id, sheet.id);
      audit(user, "free.sheet.restored", sheet.id, { name: sheet.name });
    });
    return detail(sheet.id);
  }

  // ---------- Hücreler ----------
  // updates: [{ row: satırKimliği, col: kolonKimliği, raw }]. grow: yapıştırmada satır/kolon yetmezse eklenir
  // (updates bu durumda { r, c, raw } — 0 tabanlı konum — da olabilir).
  function setCells(user, sheetId, updates, { grow = false } = {}) {
    const sheet = requireSheet(sheetId);
    if (!Array.isArray(updates) || !updates.length) throw new HttpError(400, "Kaydedilecek hücre yok.");
    if (updates.length > 20_000) throw new HttpError(400, "Tek seferde en fazla 20.000 hücre kaydedilir.");
    let snapId = null;
    store.tx(() => {
      let columns = columnsOf(sheet);
      let rows = rowsOf(sheet.id);
      if (grow) {
        const needRows = Math.max(0, ...updates.map(item => (Number.isInteger(item.r) ? item.r + 1 : 0))) - rows.length;
        const needCols = Math.max(0, ...updates.map(item => (Number.isInteger(item.c) ? item.c + 1 : 0))) - columns.length;
        if (needCols > 0) {
          checkSize(Math.max(rows.length, rows.length + needRows), columns.length + needCols);
          snapId = snapshot(sheet, "yapıştırma", user);
          columns = [...columns, ...Array.from({ length: needCols }, () => ({ id: id("fc"), name: "" }))];
          saveColumns(sheet, columns, user);
        }
        if (needRows > 0) {
          if (needCols <= 0) snapId = snapshot(sheet, "yapıştırma", user);
          const { created, at } = addRowRecords(sheet, rows.length, needRows, user);
          rows = rowsOf(sheet.id);
          // Yapıştırmayla eklenen satırlarda hesaplanan kolonlar da dolar (yapıştırılan değer bunun üstüne yazılır).
          const cells = cellsOf(sheet.id);
          const skip = new Set(created);
          created.forEach((rowId, n) => {
            for (const [colId, formula] of templateFor(columns, rows, cells, at + n, skip)) setCell(sheet.id, rowId, colId, formula, user);
          });
        }
      }
      const rowIds = new Set(rows.map(row => row.id));
      const colIds = new Set(columns.map(column => column.id));
      for (const item of updates) {
        const rowId = Number.isInteger(item.r) ? rows[item.r]?.id : String(item.row || "");
        const colId = Number.isInteger(item.c) ? columns[item.c]?.id : String(item.col || "");
        if (!rowIds.has(rowId) || !colIds.has(colId)) throw new HttpError(409, "Hücre bulunamadı; satır ya da kolon başka bir bilgisayarda silinmiş olabilir. Sayfa yenilendi.");
        let raw = String(item.raw ?? "");
        // Programın içinden kopyalanıp yapıştırılan formülün göreli başvuruları yeni yerine göre kayar (Excel gibi).
        if (Array.isArray(item.shift) && isFormula(raw)) raw = shiftReferences(raw, Math.trunc(Number(item.shift[0]) || 0), Math.trunc(Number(item.shift[1]) || 0));
        setCell(sheet.id, rowId, colId, raw, user);
      }
      touch(sheet, user);
      audit(user, "free.cells.updated", sheet.id, { name: sheet.name, cells: updates.length });
    });
    return { ...detail(sheet.id), snapshot: snapId };
  }

  function renameColumn(user, sheetId, colId, name) {
    const sheet = requireSheet(sheetId);
    const columns = columnsOf(sheet);
    const column = columns.find(item => item.id === colId);
    if (!column) throw new HttpError(404, "Kolon bulunamadı.");
    const title = columnName(name);
    if (title && headersOf(columns).some((header, n) => columns[n].id !== colId && fold(header) === fold(title))) throw new HttpError(409, `“${title}” adında bir kolon zaten var.`);
    column.name = title;
    store.tx(() => {
      saveColumns(sheet, columns, user);
      audit(user, "free.column.renamed", sheet.id, { name: sheet.name, column: title });
    });
    return detail(sheet.id);
  }

  function addColumns(user, sheetId, { index, count = 1, names = [] } = {}) {
    const sheet = requireSheet(sheetId);
    const columns = columnsOf(sheet);
    const amount = Math.max(1, Math.min(100, Math.floor(Number(count) || 1)));
    checkSize(rowsOf(sheet.id).length, columns.length + amount);
    const at = Math.max(0, Math.min(Number.isInteger(index) ? index : columns.length, columns.length));
    const taken = new Set(headersOf(columns).map(fold));
    const fresh = Array.from({ length: amount }, (_, n) => {
      const name = columnName(names[n]);
      if (name && taken.has(fold(name))) throw new HttpError(409, `“${name}” adında bir kolon zaten var.`);
      if (name) taken.add(fold(name));
      return { id: id("fc"), name };
    });
    let snapId = null;
    store.tx(() => {
      if (at < columns.length) {
        snapId = snapshot(sheet, "kolon ekleme", user);
        rewriteAll(sheet.id, { axis: "col", op: "insert", index: at, count: amount }, user);
      }
      columns.splice(at, 0, ...fresh);
      saveColumns(sheet, columns, user);
      audit(user, "free.column.added", sheet.id, { name: sheet.name, count: amount });
    });
    return { ...detail(sheet.id), added: fresh.map(item => item.id), snapshot: snapId };
  }

  function deleteColumn(user, sheetId, colId) {
    const sheet = requireSheet(sheetId);
    const columns = columnsOf(sheet);
    const index = columns.findIndex(item => item.id === colId);
    if (index < 0) throw new HttpError(404, "Kolon bulunamadı.");
    if (columns.length === 1) throw new HttpError(400, "Sayfada en az bir kolon kalmalı.");
    const removedName = headersOf(columns)[index];
    // Silinenler (v2.0.2): kolonun hücreleri saklanır; yönetim panelinden eski sırasına geri eklenir.
    const removedCells = store.all("SELECT row_id, raw FROM free_cells WHERE sheet_id = ? AND col_id = ?", sheet.id, colId).map(cell => ({ row: cell.row_id, raw: cell.raw }));
    let snapId = null;
    store.tx(() => {
      snapId = snapshot(sheet, "kolon silme", user);
      if (trash && removedCells.length) {
        trash.add({ kind: "free-column", ref: colId, datasetKey: current(), title: `${sheet.name} · “${removedName}” kolonu`, detail: removedCells.slice(0, 3).map(cell => cell.raw).join(" · "), payload: { sheetId: sheet.id, sheetName: sheet.name, index, column: columns[index], header: removedName, cells: removedCells }, user });
      }
      store.run("DELETE FROM free_cells WHERE sheet_id = ? AND col_id = ?", sheet.id, colId);
      columns.splice(index, 1);
      saveColumns(sheet, columns, user);
      rewriteAll(sheet.id, { axis: "col", op: "delete", index, count: 1 }, user);
      audit(user, "free.column.deleted", sheet.id, { name: sheet.name, column: removedName });
    });
    return { ...detail(sheet.id), snapshot: snapId };
  }

  // Hesaplanan kolon (Excel'deki "veri aralığı biçim ve formüllerini genişlet" gibi): hedef satırın üstündeki son beş
  // dolu hücreden en az ikisi ve çoğunluğu aynı (satıra göre kayan) formülse o formül hedef satıra da uygulanır.
  // Toplam satırı ya da tek tük farklı formül bu kuralı bozmaz. Dönüş: kolon kimliği → hedef satır için formül.
  function templateFor(columns, rows, cells, target, skip = new Set()) {
    const out = new Map();
    for (const column of columns) {
      const above = [];
      for (let r = Math.min(target, rows.length) - 1; r >= 0 && above.length < 5; r -= 1) {
        if (skip.has(rows[r].id)) continue;
        const raw = cells.get(`${rows[r].id}|${column.id}`) || "";
        if (raw) above.push({ r, raw });
      }
      const counts = new Map();
      for (const item of above) {
        if (!item.raw.startsWith("=")) continue;
        const shifted = shiftReferences(item.raw, target - item.r, 0);
        if (shifted.includes("#REF!")) continue;
        const entry = counts.get(shifted) || { count: 0 };
        entry.count += 1;
        counts.set(shifted, entry);
      }
      let best = null;
      for (const [formula, entry] of counts) if (!best || entry.count > best.count) best = { formula, count: entry.count };
      if (best && best.count >= 2 && best.count * 2 > above.length) out.set(column.id, best.formula);
    }
    return out;
  }

  // Satır ekleme; hesaplanan kolonların formülü yeni satırlara da uygulanır.
  function addRows(user, sheetId, { index, count = 1 } = {}) {
    const sheet = requireSheet(sheetId);
    const amount = Math.max(1, Math.min(500, Math.floor(Number(count) || 1)));
    let result;
    store.tx(() => {
      const before = rowsOf(sheet.id);
      const snapId = Number.isInteger(index) && index < before.length ? snapshot(sheet, "satır ekleme", user) : null;
      const { created, at } = addRowRecords(sheet, Number.isInteger(index) ? index : before.length, amount, user);
      const rows = rowsOf(sheet.id);
      const columns = columnsOf(sheet);
      const cells = cellsOf(sheet.id);
      const skip = new Set(created);
      created.forEach((rowId, n) => {
        for (const [colId, formula] of templateFor(columns, rows, cells, at + n, skip)) setCell(sheet.id, rowId, colId, formula, user);
      });
      touch(sheet, user);
      audit(user, "free.row.added", sheet.id, { name: sheet.name, count: amount });
      result = { ...detail(sheet.id), added: created, snapshot: snapId };
    });
    return result;
  }

  function deleteRow(user, sheetId, rowId) {
    const sheet = requireSheet(sheetId);
    const rows = rowsOf(sheet.id);
    const index = rows.findIndex(row => row.id === rowId);
    if (index < 0) throw new HttpError(404, "Satır bulunamadı.");
    const columns = columnsOf(sheet);
    const headers = headersOf(columns);
    const cells = cellsOf(sheet.id);
    const removedCells = columns.map((column, c) => ({ col: column.id, header: headers[c], raw: cells.get(`${rowId}|${column.id}`) || "" })).filter(cell => cell.raw);
    let snapId = null;
    store.tx(() => {
      snapId = snapshot(sheet, "satır silme", user);
      if (trash && removedCells.length) {
        trash.add({ kind: "free-row", ref: rowId, datasetKey: current(), title: `${sheet.name} · ${index + 1}. satır`, detail: removedCells.filter(cell => !isFormula(cell.raw)).slice(0, 3).map(cell => cell.raw).join(" · "), payload: { sheetId: sheet.id, sheetName: sheet.name, index, cells: removedCells }, user });
      }
      store.run("DELETE FROM free_cells WHERE row_id = ?", rowId);
      store.run("DELETE FROM free_rows WHERE id = ?", rowId);
      renumber(sheet.id);
      rewriteAll(sheet.id, { axis: "row", op: "delete", index, count: 1 }, user);
      touch(sheet, user);
      audit(user, "free.row.deleted", sheet.id, { name: sheet.name, row: index + 1 });
    });
    return { ...detail(sheet.id), snapshot: snapId };
  }

  // ---------- Silinenlerden geri yükleme (v2.0.2) ----------
  // Satır eski sırasına ARAYA eklenir: o arada eklenen satırlar aşağı kayar, hiçbir hücrenin üzerine yazılmaz. Sayfa o
  // arada kısaldıysa sona eklenir. Kolonu silinmiş hücreler aynı adlı kolona, o da yoksa atlanır (lost).
  function restoreRow(user, payload) {
    const sheet = requireSheet(payload.sheetId);
    const rows = rowsOf(sheet.id);
    let result;
    store.tx(() => {
      const { created, at } = addRowRecords(sheet, Math.min(Number(payload.index) || 0, rows.length), 1, user);
      const columns = columnsOf(sheet);
      const headers = headersOf(columns);
      const lost = [];
      for (const item of payload.cells || []) {
        const column = columns.find(entry => entry.id === item.col) || columns[headers.findIndex(name => fold(name) === fold(item.header || ""))];
        if (column) setCell(sheet.id, created[0], column.id, item.raw, user);
        else lost.push(item.header);
      }
      touch(sheet, user);
      audit(user, "free.row.restored", sheet.id, { name: sheet.name, row: at + 1 });
      result = { sheet: sheet.name, position: at + 1, lost };
    });
    return result;
  }

  // Kolon eski sırasına araya eklenir (sağdakiler kayar). Adı o arada başka bir kolona verildiyse "(geri yüklendi)" eklenir.
  // Satırı silinmiş hücreler atlanır.
  function restoreColumn(user, payload) {
    const sheet = requireSheet(payload.sheetId);
    const columns = columnsOf(sheet);
    checkSize(rowsOf(sheet.id).length, columns.length + 1);
    const at = Math.max(0, Math.min(Number(payload.index) || 0, columns.length));
    const taken = new Set(headersOf(columns).map(fold));
    let name = columnName(payload.column?.name || "");
    if (name && taken.has(fold(name))) name = columnName(`${name} (geri yüklendi)`);
    const colId = columns.some(item => item.id === payload.column?.id) ? id("fc") : payload.column?.id || id("fc");
    const rowIds = new Set(rowsOf(sheet.id).map(row => row.id));
    let result;
    store.tx(() => {
      if (at < columns.length) rewriteAll(sheet.id, { axis: "col", op: "insert", index: at, count: 1 }, user);
      columns.splice(at, 0, { ...(payload.column || {}), id: colId, name });
      saveColumns(sheet, columns, user);
      let lost = 0;
      for (const item of payload.cells || []) {
        if (rowIds.has(item.row)) setCell(sheet.id, item.row, colId, item.raw, user);
        else lost += 1;
      }
      audit(user, "free.column.restored", sheet.id, { name: sheet.name, column: name || payload.header });
      result = { sheet: sheet.name, position: at + 1, column: name || payload.header, lost };
    });
    return result;
  }

  // Silinmiş sayfayı (başka oturumdan da) geri getirir; adı o arada başka bir sekmeye verildiyse "(geri yüklendi)" eklenir.
  function restoreSheet(user, sheetId) {
    const sheet = store.get("SELECT * FROM free_sheets WHERE id = ? AND dataset_key = ? AND deleted_at IS NOT NULL", String(sheetId || ""), current());
    if (!sheet) throw new HttpError(404, "Geri yüklenecek sayfa bulunamadı.");
    let name = sheet.name;
    for (let n = 1; nameTaken(name, sheet.id); n += 1) name = cleanName(`${sheet.name} (geri yüklendi${n > 1 ? ` ${n}` : ""})`, FREE_LIMITS.name);
    store.tx(() => {
      store.run("UPDATE free_sheets SET name = ?, deleted_at = NULL, deleted_by = NULL, updated_at = ?, updated_by = ? WHERE id = ?", name, now(), user.id, sheet.id);
      audit(user, "free.sheet.restored", sheet.id, { name, previous: sheet.name });
    });
    return { id: sheet.id, name, renamed: name !== sheet.name };
  }
  const deletedSheets = () => store.all("SELECT s.id, s.name, s.dataset_key AS datasetKey, s.deleted_at AS deletedAt, s.deleted_by AS deletedBy, COALESCE(u.display_name, '') AS actorName FROM free_sheets s LEFT JOIN users u ON u.id = s.deleted_by WHERE s.deleted_at IS NOT NULL ORDER BY s.deleted_at DESC");

  // Toplam satırı/kolonu: hücrelerinden biri kendi kolonunda (ya da satırında) birden çok hücreyi kapsayan bir aralığı
  // toplayan formül taşır (ör. D kolonunda =TOPLA(D1:D9)). Doldurma bunlara dokunmaz.
  const aggregates = (raw, axis, index) => {
    let found = false;
    if (!isFormula(raw)) return false;
    mapReferences(raw, ref => {
      if (ref.column) {
        if (axis === "row" && ref.c1 <= index && index <= ref.c2) found = true;
      } else if (axis === "row" ? ref.c1 <= index && index <= ref.c2 && ref.r2 > ref.r1 : ref.r1 <= index && index <= ref.r2 && ref.c2 > ref.c1) found = true;
      return undefined;
    });
    return found;
  };

  // Formülü doldurur: "down" → alttaki satırlara (değer taşıyan son satıra kadar), "right" → sağdaki kolonlara.
  // Elle yazılmış değerlere, toplam satırına/kolonuna ve boş satırlara dokunulmaz; aynı kolonda başka formül varsa
  // yerine yenisi yazılır (Excel'de doldurma gibi).
  function fill(user, sheetId, { row: rowId, col: colId, axis = "down" }) {
    const sheet = requireSheet(sheetId);
    const rows = rowsOf(sheet.id);
    const columns = columnsOf(sheet);
    const from = rows.findIndex(row => row.id === rowId);
    const fromCol = columns.findIndex(column => column.id === colId);
    const cells = cellsOf(sheet.id);
    const raw = cells.get(`${rowId}|${colId}`) || "";
    if (from < 0 || fromCol < 0 || !isFormula(raw)) throw new HttpError(400, "Doldurmak için formül içeren bir hücre seçin.");
    const rawAt = (r, c) => cells.get(`${rows[r].id}|${columns[c].id}`) || "";
    const targets = [];
    if (axis === "right") {
      // Satırın toplam kolonu (satırı aralıkla toplayan hücre) doldurulmaz.
      for (let c = fromCol + 1; c < columns.length; c += 1) {
        const current = rawAt(from, c);
        if (current.trim() && !isFormula(current)) continue;
        if (aggregates(current, "col", from)) continue;
        targets.push([from, c, shiftReferences(raw, 0, c - fromCol)]);
      }
    } else {
      let last = -1;
      rows.forEach((row, r) => {
        if (hasValue(cells, row, columns)) last = r;
      });
      for (let r = from + 1; r <= last; r += 1) {
        if (!hasValue(cells, rows[r], columns)) continue;
        // Toplam satırı: satırdaki bir hücre kendi kolonunu aralıkla topluyor.
        if (columns.some((_, c) => aggregates(rawAt(r, c), "row", c))) continue;
        const current = rawAt(r, fromCol);
        if (current.trim() && !isFormula(current)) continue;
        targets.push([r, fromCol, shiftReferences(raw, r - from, 0)]);
      }
    }
    const usable = targets.filter(([, , next]) => !next.includes("#REF!"));
    if (!usable.length) throw new HttpError(400, axis === "right" ? "Sağda doldurulacak hücre yok." : "Altta doldurulacak satır yok; formül, değer yazılmış satırlara uygulanır.");
    let snapId = null;
    store.tx(() => {
      snapId = snapshot(sheet, "doldurma", user);
      for (const [r, c, next] of usable) setCell(sheet.id, rows[r].id, columns[c].id, next, user);
      touch(sheet, user);
      audit(user, "free.fill", sheet.id, { name: sheet.name, cells: usable.length, axis: axis === "right" ? "right" : "down" });
    });
    return { ...detail(sheet.id), filled: usable.length, snapshot: snapId };
  }

  // Kolon türü (toplam için): "money" (₺/TL/$… işaretli sayı), "number", "date", "text" ya da "empty".
  const DATE_LIKE = /^(\d{1,2}[./-]\d{1,2}[./-]\d{2,4}|\d{4}-\d{2}-\d{2})/;
  const MONEY_LIKE = /[₺$€£]|\b(tl|try|usd|eur)\b/i;
  function columnKind(grid, c, lastRow, skipRow = -1) {
    const counts = { money: 0, number: 0, date: 0, text: 0 };
    let filled = 0;
    for (let r = 0; r <= lastRow; r += 1) {
      if (r === skipRow) continue;
      const cell = grid[r][c];
      const text = String(cell.display ?? "").trim();
      if (!String(cell.raw ?? "").trim() || cell.error) continue;
      filled += 1;
      if (DATE_LIKE.test(text)) counts.date += 1;
      else if (numericDisplay(text)) counts[MONEY_LIKE.test(text) ? "money" : "number"] += 1;
      else counts.text += 1;
    }
    if (!filled) return "empty";
    const numeric = counts.money + counts.number;
    if (numeric / filled >= 0.6) return counts.money ? "money" : "number";
    if (counts.date / filled >= 0.6) return "date";
    return "text";
  }

  // Σ Alt toplam (sona toplam satırı: sayısal kolonların toplamı; tarih kolonları toplanmaz) ve Σ Yan toplam (sona
  // "Toplam" kolonu). Yan toplam, verilen kolon aralığını (from..to, ekranda seçilen) ya da — aralık yoksa — para
  // kolonlarını, para kolonu yoksa sayı kolonlarını toplar (₺ ile gün sayısı gibi farklı birimler karışmaz).
  function totals(user, sheetId, kind, { from, to } = {}) {
    const sheet = requireSheet(sheetId);
    const { columns, rows, cells, grid, headers } = load(sheet);
    const lastData = (() => {
      for (let r = rows.length - 1; r >= 0; r -= 1) if (hasValue(cells, rows[r], columns)) return r;
      return -1;
    })();
    if (lastData < 0) throw new HttpError(400, "Toplanacak değer yok; önce birkaç hücre doldurun.");
    // Sayfada zaten toplam satırı varsa (başka bir kolonun aralık toplamı) tür hesabına katılmaz.
    const totalRow = rows.findIndex((_, r) => columns.some((__, c) => aggregates(grid[r][c].raw, "row", c)));
    const kinds = columns.map((_, c) => columnKind(grid, c, lastData, totalRow));
    let summed = [];
    let snapId = null;
    store.tx(() => {
      if (kind === "row") {
        const numericCols = kinds.map(item => item === "money" || item === "number");
        if (!numericCols.some(Boolean)) throw new HttpError(400, "Sayısal kolon bulunamadı; toplam eklenemedi.");
        snapId = snapshot(sheet, "alt toplam", user);
        // Son dolu satırın altındaki boş satır kullanılır, yoksa yeni satır eklenir.
        const target = lastData + 1 < rows.length && !hasValue(cells, rows[lastData + 1], columns) ? rows[lastData + 1].id : addRowRecords(sheet, lastData + 1, 1, user).created[0];
        const labelCol = [kinds.indexOf("text"), kinds.indexOf("empty"), numericCols.indexOf(false)].find(index => index >= 0) ?? -1;
        columns.forEach((column, c) => {
          if (numericCols[c]) {
            setCell(sheet.id, target, column.id, `=TOPLA(${indexToCol(c)}1:${indexToCol(c)}${lastData + 1})`, user);
            summed.push(headers[c]);
          } else if (c === labelCol) setCell(sheet.id, target, column.id, "Toplam", user);
          else setCell(sheet.id, target, column.id, "", user);
        });
      } else {
        checkSize(rowsOf(sheet.id).length, columns.length + 1);
        let picked;
        if (Number.isInteger(from) && Number.isInteger(to) && to > from) {
          picked = columns.map((_, c) => c).filter(c => c >= from && c <= to && (kinds[c] === "money" || kinds[c] === "number"));
        } else {
          const money = kinds.map((item, c) => (item === "money" ? c : -1)).filter(c => c >= 0);
          picked = money.length ? money : kinds.map((item, c) => (item === "number" ? c : -1)).filter(c => c >= 0);
        }
        if (!picked.length) throw new HttpError(400, "Toplanacak sayısal kolon bulunamadı. Toplamak istediğiniz kolonları seçip yeniden deneyin.");
        snapId = snapshot(sheet, "yan toplam", user);
        const used = new Set(headers.map(fold));
        const column = { id: id("fc"), name: ["Toplam", "Satır toplamı", "Satır toplamı (2)"].find(name => !used.has(fold(name))) || "" };
        saveColumns(sheet, [...columns, column], user);
        const contiguous = picked.every((c, n) => n === 0 || c === picked[n - 1] + 1);
        for (let r = 0; r <= lastData; r += 1) {
          if (!hasValue(cells, rows[r], columns)) continue;
          const refs = contiguous ? `${indexToCol(picked[0])}${r + 1}:${indexToCol(picked.at(-1))}${r + 1}` : picked.map(c => `${indexToCol(c)}${r + 1}`).join(";");
          setCell(sheet.id, rows[r].id, column.id, `=TOPLA(${refs})`, user);
        }
        summed = picked.map(c => headers[c]);
      }
      touch(sheet, user);
      audit(user, kind === "row" ? "free.total.row" : "free.total.column", sheet.id, { name: sheet.name, columns: summed });
    });
    return { ...detail(sheet.id), snapshot: snapId, summed };
  }

  // snapshot verilirse yalnızca o işlem geri alınır: ondan sonra sayfada başka bir yapı değişikliği ya da başka bir
  // kullanıcının hücre değişikliği varsa geri alma onları da sileceği için yapılmaz.
  function undo(user, sheetId, { snapshot: wanted = "" } = {}) {
    const sheet = requireSheet(sheetId);
    const last = store.get("SELECT * FROM free_history WHERE sheet_id = ? ORDER BY created_at DESC, id DESC LIMIT 1", sheet.id);
    if (!last) throw new HttpError(404, "Geri alınacak işlem yok.");
    if (wanted) {
      if (last.id !== wanted) throw new HttpError(409, "Bu işlemden sonra sayfada başka bir değişiklik (satır/kolon ekleme-silme, toplam, doldurma) yapıldı; geri alınamıyor.");
      const others = store.get("SELECT COUNT(*) AS count FROM free_cells WHERE sheet_id = ? AND updated_at > ? AND updated_by IS NOT ?", sheet.id, last.created_at, user.id).count;
      if (others) throw new HttpError(409, "Bu işlemden sonra başka bir kullanıcı sayfada değişiklik yaptı; geri alma onun değişikliğini de sileceği için yapılmadı.");
    }
    const data = parseJson(last.snapshot_json, null);
    if (!data || !Array.isArray(data.columns) || !Array.isArray(data.rows) || !Array.isArray(data.cells)) throw new HttpError(500, "Geri alma kaydı okunamadı.");
    store.tx(() => {
      store.run("DELETE FROM free_cells WHERE sheet_id = ?", sheet.id);
      store.run("DELETE FROM free_rows WHERE sheet_id = ?", sheet.id);
      for (const row of data.rows) store.run("INSERT INTO free_rows (id, sheet_id, position, created_by, created_at) VALUES (?, ?, ?, ?, ?)", row.id, sheet.id, row.position, row.created_by, row.created_at);
      for (const [rowId, colId, raw] of data.cells) store.run("INSERT INTO free_cells (row_id, col_id, sheet_id, raw, updated_by, updated_at) VALUES (?, ?, ?, ?, ?, ?)", rowId, colId, sheet.id, raw, user.id, now());
      saveColumns(sheet, data.columns, user);
      store.run("DELETE FROM free_history WHERE id = ?", last.id);
      audit(user, "free.undo", sheet.id, { name: sheet.name, label: last.label });
    });
    return { ...detail(sheet.id), undone: last.label };
  }

  // ---------- Diğer ekranlardan gelen yazmalar ----------
  const isFreeKey = key => String(key || "").startsWith(FREE_PREFIX);
  // Detay kartındaki düzeltme (alan = kolonun görünen adı) doğrudan hücreye yazılır.
  function setByField(user, key, field, value) {
    const rowId = String(key).slice(FREE_PREFIX.length);
    const row = store.get("SELECT r.id, r.sheet_id FROM free_rows r JOIN free_sheets s ON s.id = r.sheet_id WHERE r.id = ? AND s.dataset_key = ? AND s.deleted_at IS NULL", rowId, current());
    if (!row) throw new HttpError(404, "Kayıt bulunamadı; satır silinmiş olabilir.");
    const sheet = requireSheet(row.sheet_id);
    const columns = columnsOf(sheet);
    const index = headersOf(columns).indexOf(String(field));
    if (index < 0) throw new HttpError(404, `“${field}” kolonu bu sayfada yok.`);
    return setCells(user, sheet.id, [{ row: rowId, col: columns[index].id, raw: value }]);
  }
  // Detay kartında bir alan düzenlenirken hücrenin ham değeri (formül dahil) gösterilir.
  function rawByKey(key) {
    const rowId = String(key).slice(FREE_PREFIX.length);
    const row = store.get("SELECT r.id, r.sheet_id FROM free_rows r JOIN free_sheets s ON s.id = r.sheet_id WHERE r.id = ? AND s.dataset_key = ? AND s.deleted_at IS NULL", rowId, current());
    if (!row) return [];
    const sheet = requireSheet(row.sheet_id);
    const columns = columnsOf(sheet);
    const headers = headersOf(columns);
    const byCol = new Map(store.all("SELECT c.col_id, c.raw, c.updated_at, COALESCE(u.display_name, '') AS name FROM free_cells c LEFT JOIN users u ON u.id = c.updated_by WHERE c.row_id = ?", rowId).map(cell => [cell.col_id, cell]));
    return columns
      .map((column, index) => ({ column, index, cell: byCol.get(column.id) }))
      .filter(item => item.cell)
      .map(item => ({ id: `${rowId}|${item.column.id}`, caseKey: key, sourceName: "", field: headers[item.index], value: item.cell.raw, version: 0, actorName: item.cell.name, updatedAt: item.cell.updated_at, free: true }));
  }
  // Boş satır/kolon: elle yazılmış değeri yok (kolondan gelen formül taşıyabilir). Bunları ekleme yetkisi olan da siler.
  const valueCell = "trim(raw) <> '' AND substr(raw, 1, 1) <> '='";
  const rowIsEmpty = (sheetId, rowId) => {
    const sheet = requireSheet(sheetId);
    return !store.get(`SELECT 1 AS x FROM free_cells WHERE sheet_id = ? AND row_id = ? AND ${valueCell} LIMIT 1`, sheet.id, String(rowId || ""));
  };
  const columnIsEmpty = (sheetId, colId) => {
    const sheet = requireSheet(sheetId);
    return !store.get(`SELECT 1 AS x FROM free_cells WHERE sheet_id = ? AND col_id = ? AND ${valueCell} LIMIT 1`, sheet.id, String(colId || "")) && !columnName(columnsOf(sheet).find(column => column.id === colId)?.name);
  };
  const sheetByName = name => list().find(item => item.name === String(name || ""));
  // "Yeni kayıt" formu serbest sayfada: ilk boş satıra (yoksa sona yeni satıra) yazılır.
  function addRecord(user, name, values) {
    const summary = sheetByName(name);
    if (!summary) return null;
    const sheet = requireSheet(summary.id);
    const columns = columnsOf(sheet);
    const headers = headersOf(columns);
    const updates = Object.entries(values || {})
      .filter(([field, value]) => headers.includes(field) && String(value ?? "").trim())
      .map(([field, value]) => ({ col: columns[headers.indexOf(field)].id, raw: value }));
    if (!updates.length) throw new HttpError(400, "En az bir alan doldurun.");
    let targetId = "";
    store.tx(() => {
      const rows = rowsOf(sheet.id);
      const cells = cellsOf(sheet.id);
      const empty = rows.findIndex(row => !hasValue(cells, row, columns));
      if (empty < 0) {
        targetId = addRows(user, sheet.id, {}).added[0];
      } else {
        // Boş satır yeniden kullanılırken hesaplanan kolonlar da doldurulur (formda yazılmayanlar).
        targetId = rows[empty].id;
        const given = new Set(updates.map(item => item.col));
        for (const [colId, formula] of templateFor(columns, rows, cells, empty)) if (!given.has(colId) && !cells.get(`${targetId}|${colId}`)) setCell(sheet.id, targetId, colId, formula, user);
      }
      setCells(user, sheet.id, updates.map(item => ({ ...item, row: targetId })));
    });
    return { caseKey: `${FREE_PREFIX}${targetId}` };
  }
  const headersByName = name => {
    const summary = sheetByName(name);
    return summary ? headersOf(columnsOf(requireSheet(summary.id))) : null;
  };

  // Oturum silinince serbest sayfaları da silinir.
  function purgeSession(datasetKey) {
    const ids = store.all("SELECT id FROM free_sheets WHERE dataset_key = ?", datasetKey).map(item => item.id);
    for (const sheetId of ids) {
      store.run("DELETE FROM free_cells WHERE sheet_id = ?", sheetId);
      store.run("DELETE FROM free_rows WHERE sheet_id = ?", sheetId);
      store.run("DELETE FROM free_history WHERE sheet_id = ?", sheetId);
    }
    store.run("DELETE FROM free_sheets WHERE dataset_key = ?", datasetKey);
    return ids.length;
  }
  // Analiz önbelleğinin parmak izi için.
  const fingerprint = () => {
    const row = store.get(
      `SELECT (SELECT COUNT(*) || '/' || COALESCE(MAX(updated_at), '') FROM free_sheets WHERE dataset_key = ?) AS sheets,
              (SELECT COUNT(*) || '/' || COALESCE(MAX(c.updated_at), '') FROM free_cells c JOIN free_sheets s ON s.id = c.sheet_id WHERE s.dataset_key = ?) AS cells`,
      current(), current(),
    );
    return `${row.sheets}|${row.cells}`;
  };

  return { list, detail, viewRows, tabs, create, importSheet, rename, remove, restore, restoreRow, restoreColumn, restoreSheet, deletedSheets, setCells, renameColumn, addColumns, deleteColumn, addRows, deleteRow, fill, totals, undo, isFreeKey, setByField, addRecord, rawByKey, rowIsEmpty, columnIsEmpty, headersByName, purgeSession, fingerprint };
}
