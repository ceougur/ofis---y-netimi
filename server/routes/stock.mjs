// Stok (v2.0.6): Kasa mantığıyla çalışan basit stok. Ürün kartı (ad, kod, birim, kategori, kritik seviye, birim fiyat)
// ve giriş/çıkış hareketleri; mevcut miktar hareketlerden hesaplanır. Tutar = miktar × birim fiyat. Para isteğe bağlı:
//   giriş (alım)  : Kasa'dan ödendi → Kasa'ya gider (çıkış) · Cariye yazıldı → tedarikçi carisine alacak
//   çıkış (satış) : Kasa'ya tahsil edildi → Kasa'ya giriş · Cariye yazıldı → müşteri carisine borç
//   yok           : yalnız miktar (ofiste çay, şeker, yağ tüketimi)
// Kritik seviyenin altına düşen ürün sol menüde rozet ve listede uyarı olarak görünür.
import { randomUUID } from "node:crypto";
import { mapStockHeaders, parseQty, roundQty, stockLevel } from "../lib/accounts.mjs";
import { HttpError, limited, ok, readJson, sendBuffer, text } from "../lib/http.mjs";
import { parseAmount, roundMoney } from "../lib/money.mjs";
import { can } from "../lib/permissions.mjs";
import { dayText, isoDay } from "../lib/plans.mjs";
import { tablePdf, tl } from "../lib/report-pdf.mjs";
import { buildXlsx } from "../lib/xlsx-write.mjs";

const DATE = /^\d{4}-\d{2}-\d{2}$/;
const validDate = value => DATE.test(value) && !Number.isNaN(new Date(value).getTime());
const MAX_IMPORT = 20_000;
const MAX_QTY = 1e9;
const PAY = new Set(["none", "cash", "account"]);
const qtyText = value => new Intl.NumberFormat("tr-TR", { maximumFractionDigits: 3 }).format(Number(value) || 0);

export function registerStockRoutes(router, { store, auth, audit, events, trash, accounts = () => null }) {
  const now = () => new Date().toISOString();
  const today = () => isoDay(new Date());
  const newId = prefix => `${prefix}-${randomUUID()}`;
  const office = () => store.setting("office.name", "");
  const changed = (user, detail = {}) => events?.publish("workspace.changed", { kind: "stock", actorId: user.id, actorName: user.display_name, ...detail }, { except: user.id });
  const dateOf = (value, label = "Tarih", fallback = "") => {
    const date = text(value) || fallback;
    if (!validDate(date)) throw new HttpError(400, `${label} için geçerli bir tarih seçin.`);
    return date;
  };
  const qtyOf = (value, label = "Miktar") => {
    const qty = parseQty(value);
    if (!Number.isFinite(qty) || qty < 0 || qty > MAX_QTY) throw new HttpError(400, `${label} geçerli bir sayı olmalı.`);
    return roundQty(qty);
  };
  const priceOf = (value, label = "Birim fiyat") => {
    if (value === undefined || value === null || String(value).trim() === "") return 0;
    const price = parseAmount(value);
    if (!Number.isFinite(price) || price < 0 || price > 1e12) throw new HttpError(400, `${label} geçerli bir tutar olmalı.`);
    return Math.round(price * 10000) / 10000;
  };

  // ---------- Okuma ----------
  const ITEM_SQL = `SELECT i.id, i.code, i.name, i.unit, i.category, i.min_qty AS minQty, i.unit_price AS unitPrice, i.note, i.fields_json AS fieldsJson,
      i.created_by AS createdBy, i.created_at AS createdAt, i.updated_at AS updatedAt, COALESCE(u.display_name, '') AS actorName
    FROM stock_items i LEFT JOIN users u ON u.id = i.created_by`;
  const parseFields = json => {
    try {
      const value = JSON.parse(json || "[]");
      return Array.isArray(value) ? value.filter(item => item && typeof item.label === "string") : [];
    } catch {
      return [];
    }
  };
  const itemRow = id => {
    const row = store.get(`${ITEM_SQL} WHERE i.id = ? AND i.deleted_at IS NULL`, limited(id, 120, "Ürün"));
    if (!row) throw new HttpError(404, "Ürün bulunamadı. Silinmiş olabilir.");
    const { fieldsJson, ...rest } = row;
    return { ...rest, fields: parseFields(fieldsJson) };
  };
  const movesOf = itemId =>
    store.all(
      `SELECT m.id, m.kind, m.qty, m.unit_price AS unitPrice, m.amount, m.date, m.note, m.pay, m.account_id AS accountId, COALESCE(a.name, '') AS accountName,
              m.created_by AS createdBy, m.created_at AS createdAt, m.updated_at AS updatedAt, COALESCE(u.display_name, '') AS actorName
       FROM stock_moves m LEFT JOIN users u ON u.id = m.created_by LEFT JOIN accounts a ON a.id = m.account_id WHERE m.item_id = ? ORDER BY m.date, m.created_at, m.rowid`,
      itemId,
    );
  function detail(id, user) {
    const item = itemRow(id);
    const manage = can(user.role, "stock.manage");
    let running = 0;
    const moves = movesOf(item.id).map(move => {
      running = roundQty(running + (move.kind === "in" ? move.qty : -move.qty));
      return { ...move, balance: running, editable: manage || (move.createdBy === user.id && move.pay === "none") };
    });
    const level = stockLevel(item, moves);
    const sums = moves.reduce((acc, move) => ({ inAmount: acc.inAmount + (move.kind === "in" ? move.amount : 0), outAmount: acc.outAmount + (move.kind === "out" ? move.amount : 0) }), { inAmount: 0, outAmount: 0 });
    return { ...item, ...level, moves, inAmount: roundMoney(sums.inAmount), outAmount: roundMoney(sums.outAmount), canManage: manage, canMove: can(user.role, "stock.move") };
  }
  const listQuery = params => ({
    q: text(params.get("q")).slice(0, 120),
    category: text(params.get("category")).slice(0, 80),
    state: ["all", "low", "out"].includes(text(params.get("state"))) ? text(params.get("state")) : "all",
    sort: ["name", "code", "qty", "value", "category"].includes(text(params.get("sort"))) ? text(params.get("sort")) : "name",
  });
  function list(user, { q = "", category = "", state = "all", sort = "name" } = {}) {
    const items = store.all(`${ITEM_SQL} WHERE i.deleted_at IS NULL ORDER BY i.name COLLATE NOCASE`);
    const moves = new Map();
    for (const move of store.all("SELECT item_id AS itemId, kind, qty, date FROM stock_moves ORDER BY date, created_at")) {
      if (!moves.has(move.itemId)) moves.set(move.itemId, []);
      moves.get(move.itemId).push(move);
    }
    const needle = String(q || "").toLocaleLowerCase("tr-TR").trim();
    const totals = { count: 0, low: 0, out: 0, value: 0 };
    const categories = new Set();
    const out = [];
    for (const row of items) {
      if (row.category) categories.add(row.category);
      if (category && row.category !== category) continue;
      if (needle && !`${row.name} ${row.code} ${row.category} ${row.note}`.toLocaleLowerCase("tr-TR").includes(needle)) continue;
      const own = moves.get(row.id) || [];
      const level = stockLevel(row, own);
      if (state === "low" && !level.low) continue;
      if (state === "out" && level.qty > 0) continue;
      totals.count += 1;
      if (level.low) totals.low += 1;
      if (level.qty <= 0) totals.out += 1;
      totals.value = roundMoney(totals.value + level.value);
      out.push({ id: row.id, code: row.code, name: row.name, unit: row.unit, category: row.category, minQty: row.minQty, unitPrice: row.unitPrice, note: row.note, ...level, lastMove: own.at(-1)?.date || "" });
    }
    const compare = {
      name: (a, b) => a.name.localeCompare(b.name, "tr"),
      code: (a, b) => String(a.code).localeCompare(String(b.code), "tr", { numeric: true }) || a.name.localeCompare(b.name, "tr"),
      qty: (a, b) => a.qty - b.qty || a.name.localeCompare(b.name, "tr"),
      value: (a, b) => b.value - a.value || a.name.localeCompare(b.name, "tr"),
      category: (a, b) => String(a.category).localeCompare(String(b.category), "tr") || a.name.localeCompare(b.name, "tr"),
    }[sort];
    // Kritik ürünler her sıralamada önce (göz önünde olsun).
    out.sort((a, b) => Number(b.low) - Number(a.low) || compare(a, b));
    return { items: out, totals, categories: [...categories].sort((a, b) => a.localeCompare(b, "tr")), sort, canManage: can(user.role, "stock.manage"), canMove: can(user.role, "stock.move"), today: today() };
  }

  router.get("/api/workspace/stock", async ({ req, res, url }) => {
    const user = auth.requirePermission(req, "stock.view");
    ok(res, list(user, listQuery(url.searchParams)));
  });

  router.get("/api/workspace/stock/alerts", async ({ req, res }) => {
    auth.requirePermission(req, "stock.view");
    ok(res, alerts());
  });

  // ---------- Ürün kartı ----------
  const itemInput = (body, previous = null) => {
    const name = limited(body.name, 160, "Ürün adı");
    if (!name) throw new HttpError(400, "Ürünün adını yazın (ör. Çay, Şeker, Motor yağı).");
    return {
      name,
      code: limited(body.code, 60, "Kod"),
      unit: limited(body.unit, 20, "Birim") || previous?.unit || "adet",
      category: limited(body.category, 80, "Kategori"),
      minQty: qtyOf(body.minQty ?? 0, "Kritik seviye"),
      unitPrice: priceOf(body.unitPrice),
      note: limited(body.note, 1000, "Not"),
    };
  };
  function insertItem(user, input, fields = []) {
    const id = newId("stock");
    store.run(
      "INSERT INTO stock_items (id, code, name, unit, category, min_qty, unit_price, note, fields_json, created_by, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)",
      id, input.code, input.name, input.unit, input.category, input.minQty, input.unitPrice, input.note, JSON.stringify(fields), user.id, now(), now(),
    );
    return id;
  }
  router.post("/api/workspace/stock", async ({ req, res }) => {
    const user = auth.requirePermission(req, "stock.manage");
    const body = await readJson(req);
    const result = store.tx(() => {
      const input = itemInput(body);
      if (store.get("SELECT 1 AS found FROM stock_items WHERE deleted_at IS NULL AND name = ? COLLATE NOCASE AND unit = ? COLLATE NOCASE", input.name, input.unit)) throw new HttpError(409, `“${input.name}” (${input.unit}) zaten var. Aynı ürüne giriş yapın.`);
      const id = insertItem(user, input);
      // Açılış stoku: ürün açılırken elde olan miktar (para yazılmaz).
      const opening = qtyOf(body.openingQty ?? 0, "Açılış stoku");
      if (opening > 0) insertMove(user, id, { kind: "in", qty: opening, unitPrice: input.unitPrice, amount: 0, date: today(), note: "Açılış stoku", pay: "none", accountId: "" });
      audit(user, "stock.item.created", id, { name: input.name, unit: input.unit, opening });
      return detail(id, user);
    });
    changed(user, { itemId: result.id });
    ok(res, result);
  });
  router.get("/api/workspace/stock/liste.pdf", async ({ req, res, url }) => {
    const user = auth.requirePermission(req, "stock.view");
    const query = listQuery(url.searchParams);
    const data = list(user, query);
    const title = limited(url.searchParams.get("title"), 60, "Başlık") || "Stok";
    const pdf = tablePdf({
      title: `${title} durumu`,
      subtitle: [query.state === "low" ? "Kritik seviyede" : query.state === "out" ? "Tükenen" : "Tüm ürünler", query.category, query.q ? `“${query.q}”` : ""].filter(Boolean).join(" · "),
      headers: ["Kod", "Ürün", "Kategori", "Mevcut", "Birim", "Kritik seviye", "Birim fiyat", "Değer", "Son hareket", "Durum"],
      types: ["text", "text", "text", "text", "text", "text", "money", "money", "text", "text"],
      rows: data.items.map(item => [item.code, item.name, item.category, qtyText(item.qty), item.unit, item.minQty ? qtyText(item.minQty) : "", tl(item.unitPrice), tl(item.value), dayText(item.lastMove), item.qty <= 0 ? "Tükendi" : item.low ? "Kritik" : ""]),
      summary: [["Ürün", String(data.totals.count)], ["Kritik", String(data.totals.low)], ["Tükenen", String(data.totals.out)], ["Stok değeri", tl(data.totals.value)]],
      officeName: office(),
      userName: user.display_name || user.username || "",
      brand: office(),
    });
    audit(user, "stock.list.exported", "list", { ...query, count: data.totals.count });
    sendBuffer(res, pdf, { type: "application/pdf", name: `${title}-durumu ${dayText(today())}.pdf`, inline: url.searchParams.get("download") !== "1" });
  });
  router.get("/api/workspace/stock/export.xlsx", async ({ req, res, url }) => {
    const user = auth.requirePermission(req, "stock.view");
    const data = list(user, listQuery(url.searchParams));
    const title = limited(url.searchParams.get("title"), 60, "Başlık") || "Stok";
    const number = value => new Intl.NumberFormat("tr-TR", { maximumFractionDigits: 3 }).format(value || 0);
    const money = value => new Intl.NumberFormat("tr-TR", { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(value || 0);
    const columns = ["Kod", "Ürün", "Kategori", "Birim", "Mevcut", "Toplam giriş", "Toplam çıkış", "Kritik seviye", "Birim fiyat", "Değer", "Son hareket", "Not"];
    const rows = data.items.map(item => ({ Kod: item.code, Ürün: item.name, Kategori: item.category, Birim: item.unit, Mevcut: number(item.qty), "Toplam giriş": number(item.qtyIn), "Toplam çıkış": number(item.qtyOut), "Kritik seviye": number(item.minQty), "Birim fiyat": money(item.unitPrice), Değer: money(item.value), "Son hareket": dayText(item.lastMove), Not: item.note }));
    const buffer = buildXlsx([{ name: title.slice(0, 31), columns, rows }], { title: `${title} durumu` });
    audit(user, "stock.list.exported", "xlsx", { count: rows.length });
    sendBuffer(res, buffer, { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet", name: `${title}-durumu ${dayText(today())}.xlsx` });
  });
  router.get("/api/workspace/stock/:id", async ({ req, res, params }) => {
    const user = auth.requirePermission(req, "stock.view");
    ok(res, detail(params.id, user));
  });
  router.put("/api/workspace/stock/:id", async ({ req, res, params }) => {
    const user = auth.requirePermission(req, "stock.manage");
    const previous = itemRow(params.id);
    const body = await readJson(req);
    const result = store.tx(() => {
      const input = itemInput({ ...previous, ...body }, previous);
      if (store.get("SELECT 1 AS found FROM stock_items WHERE deleted_at IS NULL AND name = ? COLLATE NOCASE AND unit = ? COLLATE NOCASE AND id <> ?", input.name, input.unit, previous.id)) throw new HttpError(409, `“${input.name}” (${input.unit}) adlı başka bir ürün var.`);
      store.run("UPDATE stock_items SET code = ?, name = ?, unit = ?, category = ?, min_qty = ?, unit_price = ?, note = ?, updated_by = ?, updated_at = ? WHERE id = ?", input.code, input.name, input.unit, input.category, input.minQty, input.unitPrice, input.note, user.id, now(), previous.id);
      audit(user, "stock.item.updated", previous.id, { previous: { name: previous.name, minQty: previous.minQty, unitPrice: previous.unitPrice }, ...input });
      return detail(previous.id, user);
    });
    changed(user, { itemId: previous.id });
    ok(res, result);
  });
  router.delete("/api/workspace/stock/:id", async ({ req, res, params }) => {
    const user = auth.requirePermission(req, "stock.manage");
    const item = itemRow(params.id);
    store.tx(() => {
      // Yumuşak silme: hareketler durur. Ödenmiş para gerçektir; Kasa'daki ve carideki karşılıkları silinmez.
      store.run("UPDATE stock_items SET deleted_by = ?, deleted_at = ? WHERE id = ?", user.id, now(), item.id);
      audit(user, "stock.item.deleted", item.id, { name: item.name });
    });
    changed(user, { itemId: item.id });
    ok(res, { id: item.id });
  });

  // ---------- Hareketler ----------
  function insertMove(user, itemId, move) {
    const id = newId("smove");
    store.run(
      "INSERT INTO stock_moves (id, item_id, kind, qty, unit_price, amount, date, note, pay, account_id, created_by, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)",
      id, itemId, move.kind, move.qty, move.unitPrice, move.amount, move.date, move.note, move.pay, move.accountId, user.id, now(),
    );
    return id;
  }
  const moveInput = (body, user, item, previous = null) => {
    const kind = text(body.kind) || previous?.kind || "in";
    if (!["in", "out"].includes(kind)) throw new HttpError(400, "Hareket türü giriş ya da çıkış olmalı.");
    const qty = qtyOf(body.qty);
    if (!(qty > 0)) throw new HttpError(400, "Miktar sıfırdan büyük olmalı.");
    const pay = PAY.has(text(body.pay)) ? text(body.pay) : "none";
    const unitPrice = priceOf(body.unitPrice);
    const amount = roundMoney(qty * unitPrice);
    if (pay !== "none" && !(amount > 0)) throw new HttpError(400, "Kasa'ya ya da cariye yazmak için birim fiyat girin (tutar = miktar × birim fiyat).");
    // Para yazan hareket (Kasa ya da cari) yönetim yetkisidir; yalnız miktar hareketini herkes girer.
    if (pay !== "none" && !can(user.role, "stock.manage")) throw new HttpError(403, "Kasa'ya ya da cariye yazılan stok hareketi yönetici, uzman ve muhasebe yetkisidir. Yalnız miktarı girebilirsiniz.");
    const accountId = pay === "account" ? limited(body.accountId, 120, "Cari") : "";
    if (pay === "account" && !accountId) throw new HttpError(400, kind === "in" ? "Alımın yazılacağı tedarikçi carisini seçin." : "Satışın yazılacağı müşteri carisini seçin.");
    if (accountId && !accounts()?.exists(accountId)) throw new HttpError(400, "Seçilen cari bulunamadı; silinmiş olabilir.");
    return { kind, qty, unitPrice, amount, date: dateOf(body.date, "Tarih", today()), note: limited(body.note, 300, "Açıklama"), pay, accountId };
  };
  // Eksiye düşme kontrolü: çıkış mevcuttan fazlaysa sorulur (force ile kaydedilir; sayım farkı olabilir).
  function assertAvailable(item, move, previous, force) {
    if (move.kind !== "out" || force) return;
    const moves = movesOf(item.id).filter(row => row.id !== previous?.id);
    const available = stockLevel(item, moves).qty;
    if (move.qty > available + 1e-9) throw new HttpError(409, `Stokta ${qtyText(available)} ${item.unit} var; ${qtyText(move.qty)} ${item.unit} çıkış stoğu eksiye düşürür.`, { code: "stock-negative", available });
  }
  const accountNote = (item, move) => `Stok ${move.kind === "in" ? "alımı" : "satışı"}: ${item.name} ${qtyText(move.qty)} ${item.unit} × ${tl(move.unitPrice)}${move.note ? ` · ${move.note}` : ""}`;
  function syncAccount(user, item, moveId, move, previousAccountId = "") {
    const service = accounts();
    if (!service?.stockEntry) return [];
    const touched = new Set([previousAccountId].filter(Boolean));
    if (move.pay === "account") {
      service.stockEntry.upsert(user, moveId, { accountId: move.accountId, kind: move.kind === "in" ? "credit" : "debt", amount: move.amount, date: move.date, note: accountNote(item, move) });
      touched.add(move.accountId);
    } else service.stockEntry.remove(moveId);
    return [...touched];
  }
  const publishAccounts = (user, ids) => ids.forEach(id => events?.publish("workspace.changed", { kind: "accounts", accountId: id, actorId: user.id, actorName: user.display_name }, { except: user.id }));

  router.post("/api/workspace/stock/:id/moves", async ({ req, res, params }) => {
    const user = auth.requirePermission(req, "stock.move");
    const item = itemRow(params.id);
    const body = await readJson(req);
    const input = moveInput(body, user, item);
    assertAvailable(item, input, null, body.force === true);
    let touched = [];
    const id = store.tx(() => {
      const moveId = insertMove(user, item.id, input);
      touched = syncAccount(user, item, moveId, input);
      // Alımda birim fiyat verildiyse ürünün son birim fiyatı güncellenir (stok değeri güncel kalsın).
      if (input.kind === "in" && input.unitPrice > 0) store.run("UPDATE stock_items SET unit_price = ?, updated_at = ? WHERE id = ?", input.unitPrice, now(), item.id);
      audit(user, input.kind === "in" ? "stock.in" : "stock.out", moveId, { itemId: item.id, itemName: item.name, ...input });
      return moveId;
    });
    changed(user, { itemId: item.id });
    if (input.pay === "cash") changed(user, { kind: "cash" });
    publishAccounts(user, touched);
    ok(res, { ...detail(item.id, user), moveId: id });
  });
  const moveOf = (itemId, moveId) => {
    const move = store.get("SELECT id, kind, qty, unit_price AS unitPrice, amount, date, note, pay, account_id AS accountId, created_by AS createdBy, created_at AS createdAt FROM stock_moves WHERE item_id = ? AND id = ?", itemId, limited(moveId, 120, "Hareket"));
    if (!move) throw new HttpError(404, "Stok hareketi bulunamadı. Başka biri silmiş olabilir.");
    return move;
  };
  const requireMoveRight = (user, move) => {
    if (can(user.role, "stock.manage")) return;
    if (move.createdBy !== user.id || move.pay !== "none") throw new HttpError(403, "Bu hareketi yalnızca yönetici, uzman ve muhasebe değiştirebilir.");
  };
  router.put("/api/workspace/stock/:id/moves/:moveId", async ({ req, res, params }) => {
    const user = auth.requirePermission(req, "stock.move");
    const item = itemRow(params.id);
    const previous = moveOf(item.id, params.moveId);
    requireMoveRight(user, previous);
    const body = await readJson(req);
    const input = moveInput({ ...previous, ...body, kind: previous.kind }, user, item, previous);
    assertAvailable(item, input, previous, body.force === true);
    let touched = [];
    store.tx(() => {
      store.run("UPDATE stock_moves SET qty = ?, unit_price = ?, amount = ?, date = ?, note = ?, pay = ?, account_id = ?, updated_by = ?, updated_at = ? WHERE id = ?", input.qty, input.unitPrice, input.amount, input.date, input.note, input.pay, input.accountId, user.id, now(), previous.id);
      touched = syncAccount(user, item, previous.id, input, previous.accountId);
      audit(user, "stock.move.updated", previous.id, { itemId: item.id, previous, ...input });
    });
    changed(user, { itemId: item.id });
    changed(user, { kind: "cash" });
    publishAccounts(user, touched);
    ok(res, detail(item.id, user));
  });
  router.delete("/api/workspace/stock/:id/moves/:moveId", async ({ req, res, params }) => {
    const user = auth.requirePermission(req, "stock.move");
    const item = itemRow(params.id);
    const previous = moveOf(item.id, params.moveId);
    requireMoveRight(user, previous);
    let accountId = "";
    store.tx(() => {
      store.run("DELETE FROM stock_moves WHERE id = ?", previous.id);
      accountId = accounts()?.stockEntry ? accounts().stockEntry.remove(previous.id) : "";
      trash?.add({ kind: "stock-move", ref: previous.id, title: item.name, detail: `${previous.kind === "in" ? "Giriş" : "Çıkış"} ${qtyText(previous.qty)} ${item.unit}${previous.note ? ` · ${previous.note}` : ""}`, payload: { ...previous, itemId: item.id, itemName: item.name, unit: item.unit }, user });
      audit(user, "stock.move.deleted", previous.id, { itemId: item.id, ...previous });
    });
    changed(user, { itemId: item.id });
    if (previous.pay === "cash") changed(user, { kind: "cash" });
    publishAccounts(user, [accountId].filter(Boolean));
    ok(res, detail(item.id, user));
  });
  router.get("/api/workspace/stock/:id/hareketler.pdf", async ({ req, res, params, url }) => {
    const user = auth.requirePermission(req, "stock.view");
    const item = detail(params.id, user);
    const payText = move => (move.pay === "cash" ? (move.kind === "in" ? "Kasa'dan ödendi" : "Kasa'ya tahsil") : move.pay === "account" ? `Cari: ${move.accountName}` : "");
    const pdf = tablePdf({
      title: `Stok hareketleri · ${item.name}`,
      subtitle: [item.code ? `Kod ${item.code}` : "", item.category, `Birim: ${item.unit}`].filter(Boolean).join(" · "),
      headers: ["Tarih", "İşlem", "Açıklama", "Giriş", "Çıkış", "Kalan", "Birim fiyat", "Tutar", "Ödeme"],
      types: ["text", "text", "text", "text", "text", "text", "money", "money", "text"],
      rows: item.moves.map(move => [dayText(move.date), move.kind === "in" ? "Giriş" : "Çıkış", move.note || "", move.kind === "in" ? qtyText(move.qty) : "", move.kind === "out" ? qtyText(move.qty) : "", qtyText(move.balance), move.unitPrice ? tl(move.unitPrice) : "", move.amount ? tl(move.amount) : "", payText(move)]),
      summary: [["Mevcut", `${qtyText(item.qty)} ${item.unit}`], ["Toplam giriş", `${qtyText(item.qtyIn)} ${item.unit}`], ["Toplam çıkış", `${qtyText(item.qtyOut)} ${item.unit}`], ["Değer", tl(item.value)]],
      officeName: office(),
      userName: user.display_name || user.username || "",
      brand: office(),
    });
    sendBuffer(res, pdf, { type: "application/pdf", name: `Stok ${item.name}.pdf`, inline: url.searchParams.get("download") !== "1" });
  });

  // ---------- Excel'den toplu alım ----------
  // Bilinen kolonlar (ürün, kod, birim, kategori, miktar, fiyat, kritik seviye, not) alanlara; miktar "Açılış stoku"
  // girişi olur (para yazılmaz). Aynı ad + birim ile ürün varsa atlanır ya da (güncelle seçilirse) bilgileri yenilenir.
  router.post("/api/workspace/stock/import/preview", async ({ req, res }) => {
    auth.requirePermission(req, "stock.manage");
    const body = await readJson(req, { limit: 40_000_000 });
    const matrix = Array.isArray(body.matrix) ? body.matrix : [];
    const headerAt = matrix.findIndex(row => Array.isArray(row) && row.filter(cell => String(cell ?? "").trim()).length >= 2);
    if (headerAt < 0) throw new HttpError(400, "Sayfada başlık satırı bulunamadı.");
    const headers = matrix[headerAt].map(cell => String(cell ?? "").trim());
    ok(res, { headerAt, headers, roles: mapStockHeaders(headers), rows: matrix.length - headerAt - 1 });
  });
  router.post("/api/workspace/stock/import", async ({ req, res }) => {
    const user = auth.requirePermission(req, "stock.manage");
    const body = await readJson(req, { limit: 40_000_000 });
    const matrix = Array.isArray(body.matrix) ? body.matrix : [];
    const headerAt = Math.max(0, Math.trunc(Number(body.headerAt) || 0));
    const headers = (matrix[headerAt] || []).map(cell => String(cell ?? "").replace(/\s+/g, " ").trim());
    const roles = body.roles && typeof body.roles === "object" ? body.roles : {};
    const columnOf = role => {
      const found = Object.entries(roles).find(([, value]) => value === role);
      return found ? Number(found[0]) : -1;
    };
    const col = Object.fromEntries(["code", "name", "unit", "category", "qty", "price", "min", "note"].map(role => [role, columnOf(role)]));
    const extraColumns = Object.entries(roles).filter(([, value]) => value === "extra").map(([index]) => Number(index)).filter(index => headers[index]);
    if (col.name < 0) throw new HttpError(400, "Ürün adı kolonunu seçin.");
    const mode = body.mode === "update" ? "update" : "skip";
    const defaultUnit = limited(body.unit, 20, "Birim") || "adet";
    const cell = (row, index) => (index >= 0 ? String(row[index] ?? "").trim() : "");
    const number = (row, index) => {
      const value = parseQty(cell(row, index));
      return Number.isFinite(value) && value >= 0 && value <= MAX_QTY ? roundQty(value) : 0;
    };
    const money = (row, index) => {
      const value = parseAmount(cell(row, index));
      return Number.isFinite(value) && value >= 0 ? Math.round(value * 10000) / 10000 : 0;
    };
    const rows = matrix.slice(headerAt + 1, headerAt + 1 + MAX_IMPORT);
    const report = { created: 0, updated: 0, skipped: [], opening: 0 };
    const skip = (index, reason) => report.skipped.push({ row: headerAt + index + 2, reason });
    store.tx(() => {
      rows.forEach((row, index) => {
        if (!Array.isArray(row) || !row.some(value => String(value ?? "").trim())) return;
        const name = cell(row, col.name).replace(/\s+/g, " ").slice(0, 160);
        if (!name) return skip(index, "Ürün adı boş");
        const input = { name, code: cell(row, col.code).slice(0, 60), unit: (cell(row, col.unit) || defaultUnit).slice(0, 20), category: cell(row, col.category).slice(0, 80), minQty: number(row, col.min), unitPrice: money(row, col.price), note: cell(row, col.note).slice(0, 1000) };
        const fields = extraColumns.map(column => ({ label: headers[column].slice(0, 80), value: cell(row, column).slice(0, 1000) })).filter(field => field.value);
        // İki ayrı indeksli arama (kodla, sonra ad + birimle): binlerce satırda da hızlı.
        const existing = (input.code && store.get("SELECT id FROM stock_items WHERE deleted_at IS NULL AND code = ?", input.code)) || store.get("SELECT id FROM stock_items WHERE deleted_at IS NULL AND name = ? COLLATE NOCASE AND unit = ? COLLATE NOCASE", input.name, input.unit);
        if (existing && mode === "skip") return skip(index, "Bu ürün zaten var");
        if (existing) {
          store.run(
            "UPDATE stock_items SET code = CASE WHEN ? <> '' THEN ? ELSE code END, category = CASE WHEN ? <> '' THEN ? ELSE category END, min_qty = CASE WHEN ? > 0 THEN ? ELSE min_qty END, unit_price = CASE WHEN ? > 0 THEN ? ELSE unit_price END, note = CASE WHEN ? <> '' THEN ? ELSE note END, updated_by = ?, updated_at = ? WHERE id = ?",
            input.code, input.code, input.category, input.category, input.minQty, input.minQty, input.unitPrice, input.unitPrice, input.note, input.note, user.id, now(), existing.id,
          );
          report.updated += 1;
          return;
        }
        const id = insertItem(user, input, fields);
        const qty = number(row, col.qty);
        if (qty > 0) {
          insertMove(user, id, { kind: "in", qty, unitPrice: input.unitPrice, amount: 0, date: today(), note: "Açılış stoku (Excel)", pay: "none", accountId: "" });
          report.opening += 1;
        }
        report.created += 1;
      });
      audit(user, "stock.imported", "import", { created: report.created, updated: report.updated, skipped: report.skipped.length, file: limited(body.fileName, 200, "Dosya adı") });
    });
    changed(user, {});
    ok(res, report);
  });

  // ---------- Diğer modüller için ----------
  // Kasa: Kasa'dan ödenen alımlar (çıkış) ve Kasa'ya tahsil edilen satışlar (giriş). Ürün silinse de para gerçektir; kalır.
  const cashEntries = () =>
    store
      .all(
        `SELECT m.id, m.kind AS moveKind, m.qty, m.note, m.amount, m.date, m.item_id AS itemId, i.name AS itemName, i.unit,
                m.created_by AS actorId, COALESCE(u.display_name, '') AS actorName, m.created_at AS createdAt, m.updated_at AS updatedAt
         FROM stock_moves m JOIN stock_items i ON i.id = m.item_id LEFT JOIN users u ON u.id = m.created_by
         WHERE m.pay = 'cash' AND m.amount > 0`,
      )
      .map(({ moveKind, qty, note, unit, ...row }) => ({
        ...row,
        kind: moveKind === "in" ? "out" : "in",
        source: "stock",
        description: `${moveKind === "in" ? "Stok alımı" : "Stok satışı"} · ${row.itemName} ${qtyText(qty)} ${unit}${note ? ` · ${note}` : ""}`,
      }));
  // Sol menüdeki rozet: kritik seviyedeki ya da tükenen (kritik seviyesi tanımlı) ürün sayısı ve adları.
  function alerts() {
    const data = list({ role: "admin" }, { state: "low" });
    return data.items.map(item => ({ id: item.id, name: item.name, qty: item.qty, unit: item.unit, minQty: item.minQty }));
  }
  const deletedList = () =>
    store.all("SELECT i.id, i.name, i.unit, i.deleted_at AS deletedAt, COALESCE(u.display_name, '') AS actorName FROM stock_items i LEFT JOIN users u ON u.id = i.deleted_by WHERE i.deleted_at IS NOT NULL").map(item => ({
      id: `stock:${item.id}`,
      kind: "stock",
      title: item.name,
      detail: `Birim: ${item.unit}`,
      deletedAt: item.deletedAt,
      actorName: item.actorName,
      restorable: true,
      note: "Hareketleriyle Stok listesine geri döner.",
    }));
  function restoreDeleted(user, id) {
    const item = store.get("SELECT id, name, unit FROM stock_items WHERE id = ? AND deleted_at IS NOT NULL", id);
    if (!item) throw new HttpError(404, "Bu ürün zaten geri yüklenmiş.");
    if (store.get("SELECT 1 AS found FROM stock_items WHERE deleted_at IS NULL AND name = ? COLLATE NOCASE AND unit = ? COLLATE NOCASE", item.name, item.unit)) throw new HttpError(409, `“${item.name}” adıyla başka bir ürün açılmış; önce onun adını değiştirin.`);
    store.tx(() => {
      store.run("UPDATE stock_items SET deleted_at = NULL, deleted_by = NULL, updated_by = ?, updated_at = ? WHERE id = ?", user.id, now(), item.id);
      audit(user, "stock.item.restored", item.id, { name: item.name });
    });
    changed(user, { itemId: item.id });
    return `“${item.name}” ürünü geri geldi.`;
  }
  function restoreMove(user, entry, payload) {
    if (!["in", "out"].includes(payload.kind)) throw new HttpError(409, "Hareketin bilgisi eksik; geri yüklenemez.");
    const item = store.get("SELECT id, name, unit, deleted_at AS deletedAt FROM stock_items WHERE id = ?", payload.itemId);
    if (!item) throw new HttpError(409, "Hareketin ürünü artık yok; geri yüklenemez.");
    if (item.deletedAt) throw new HttpError(409, `“${payload.itemName}” ürünü silinmiş. Önce ürünü geri yükleyin.`);
    const pay = payload.pay === "account" && !accounts()?.exists(payload.accountId) ? "none" : PAY.has(payload.pay) ? payload.pay : "none";
    const move = { kind: payload.kind, qty: Number(payload.qty) || 0, unitPrice: Number(payload.unitPrice) || 0, amount: Number(payload.amount) || 0, date: payload.date, note: payload.note || "", pay, accountId: pay === "account" ? payload.accountId : "" };
    store.tx(() => {
      if (!store.get("SELECT 1 AS found FROM stock_moves WHERE id = ?", entry.ref)) {
        store.run(
          "INSERT INTO stock_moves (id, item_id, kind, qty, unit_price, amount, date, note, pay, account_id, created_by, created_at, updated_by, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)",
          entry.ref, item.id, move.kind, move.qty, move.unitPrice, move.amount, move.date, move.note, move.pay, move.accountId, payload.createdBy || user.id, payload.createdAt || now(), user.id, now(),
        );
        syncAccount(user, item, entry.ref, move);
      }
      trash.markRestored(entry.id, user);
      audit(user, "stock.move.restored", entry.ref, { itemId: item.id, kind: move.kind, qty: move.qty });
    });
    changed(user, { itemId: item.id });
    changed(user, { kind: "cash" });
    return `Stok hareketi geri eklendi${pay !== payload.pay ? " (carisi silindiği için yalnız miktar olarak)" : ""}.`;
  }
  const fingerprint = () => {
    const row = store.get("SELECT (SELECT COUNT(*) || '/' || COALESCE(MAX(COALESCE(updated_at, created_at)), '') FROM stock_moves) AS m, (SELECT COUNT(*) || '/' || COALESCE(MAX(updated_at), '') FROM stock_items) AS i");
    return `${row.m}|${row.i}`;
  };

  return { cashEntries, alerts, deletedList, restoreDeleted, restoreMove, fingerprint, list, detail };
}
