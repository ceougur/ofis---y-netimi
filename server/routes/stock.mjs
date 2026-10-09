// Stok (v2.0.6): Kasa mantığıyla çalışan basit stok. Ürün kartı (ad, kod, birim, kategori, kritik seviye, birim fiyat)
// ve giriş/çıkış hareketleri; mevcut miktar hareketlerden hesaplanır. Tutar = miktar × birim fiyat. Para isteğe bağlı:
//   giriş (alım)  : Kasa'dan ödendi → Kasa'ya gider (çıkış) · Cariye yazıldı → tedarikçi carisine alacak
//   çıkış (satış) : Kasa'ya tahsil edildi → Kasa'ya giriş · Cariye yazıldı → müşteri carisine borç
//   yok           : yalnız miktar (ofiste çay, şeker, yağ tüketimi)
// Kritik seviyenin altına düşen ürün sol menüde rozet ve listede uyarı olarak görünür.
import { randomUUID } from "node:crypto";
import { mapStockHeaders, parseQty, roundQty, stockLevel } from "../lib/accounts.mjs";
import { inferRolesByValues, findHeaderRow, sanitizeCell, validateRows } from "../lib/import-gate.mjs";
import { HttpError, limited, ok, readJson, sendBuffer, text } from "../lib/http.mjs";
import { parseAmount, roundMoney } from "../lib/money.mjs";
import { bankForm } from "../lib/bank/module-ref.mjs";
import { canUser } from "../lib/permissions.mjs";
import { dayText, isoDay } from "../lib/plans.mjs";
import { methodInput } from "../lib/pay-method.mjs";
import { tablePdf, tl } from "../lib/report-pdf.mjs";
import { unitLabel } from "../lib/units.mjs";
import { buildXlsx } from "../lib/xlsx-write.mjs";
import { systemClock } from "../lib/clock.mjs";

const DATE = /^\d{4}-\d{2}-\d{2}$/;
const validDate = value => DATE.test(value) && !Number.isNaN(new Date(value).getTime());
const MAX_IMPORT = 250_000;
const MAX_QTY = 1e9;
const PAY = new Set(["none", "cash", "account"]);
const qtyFormat = new Intl.NumberFormat("tr-TR", { maximumFractionDigits: 3 });
const moneyFormat = new Intl.NumberFormat("tr-TR", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const qtyText = value => qtyFormat.format(Number(value) || 0);
// v2.0.17: eksi stok sorusu sonucu söyler ("Kayıttan sonra stok: −15 Adet olacak").
const afterText = (qty, unit) => `Kayıttan sonra stok: ${qtyText(qty)} ${unit} olacak.`;
const collator = new Intl.Collator("tr", { numeric: true, sensitivity: "base" });

export function registerStockRoutes(router, { store, bank, auth, audit, events, trash, cash = null, period = null, accounts = () => null, plans = () => null, bankModule = () => null, now: clock = systemClock }) {
  // İş saati (v2.1.0): context.now (config.now).
  const now = () => clock().toISOString();
  const today = () => isoDay(clock());
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
  // Boş bırakılabilen miktar alanları (kritik seviye, açılış stoku): boş = 0.
  const optionalQty = (value, label) => (value === undefined || value === null || String(value).trim() === "" ? 0 : qtyOf(value, label));
  const priceOf = (value, label = "Birim fiyat") => {
    if (value === undefined || value === null || String(value).trim() === "") return 0;
    const price = parseAmount(value);
    if (!Number.isFinite(price) || price < 0 || price > 1e12) throw new HttpError(400, `${label} geçerli bir tutar olmalı.`);
    return Math.round(price * 10000) / 10000;
  };

  // ---------- Okuma ----------
  const ITEM_SQL = `SELECT i.id, i.kind, i.code, i.name, i.unit, i.category, i.min_qty AS minQty, i.unit_price AS unitPrice, i.sale_price AS salePrice, i.note, i.fields_json AS fieldsJson,
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
      `SELECT m.id, m.kind, m.qty, m.unit_price AS unitPrice, m.amount, m.date, m.note, m.pay, m.reason, m.method, m.fin_ref AS finRef, m.account_id AS accountId, COALESCE(a.name, '') AS accountName,
              m.invoice_id AS invoiceId, COALESCE(inv.number, '') AS invoiceNumber, COALESCE(inv.kind, '') AS invoiceKind, COALESCE(ia.name, '') AS invoiceAccountName,
              m.created_by AS createdBy, m.created_at AS createdAt, m.updated_at AS updatedAt, COALESCE(u.display_name, '') AS actorName
       FROM stock_moves m LEFT JOIN users u ON u.id = m.created_by LEFT JOIN accounts a ON a.id = m.account_id
         LEFT JOIN invoices inv ON inv.id = m.invoice_id AND m.invoice_id <> '' LEFT JOIN accounts ia ON ia.id = inv.account_id
       WHERE m.item_id = ? ORDER BY m.date, m.created_at, m.rowid`,
      itemId,
    );
  function detail(id, user) {
    const item = itemRow(id);
    const manage = canUser(user, "stock.manage");
    let running = 0;
    const moves = movesOf(item.id).map(move => {
      running = roundQty(running + (move.kind === "in" ? move.qty : -move.qty));
      // Faturadan gelen hareket faturanın parçasıdır: yalnız faturadan (iptal / iade) değişir.
      return { ...move, balance: running, editable: !move.invoiceId && (manage || (move.createdBy === user.id && move.pay === "none")) };
    });
    const level = stockLevel(item, moves);
    const sums = moves.reduce((acc, move) => ({ inAmount: acc.inAmount + (move.kind === "in" ? move.amount : 0), outAmount: acc.outAmount + (move.kind === "out" ? move.amount : 0) }), { inAmount: 0, outAmount: 0 });
    return { ...item, ...level, moves, inAmount: roundMoney(sums.inAmount), outAmount: roundMoney(sums.outAmount), canManage: manage, canMove: canUser(user, "stock.move") };
  }
  const listQuery = params => ({
    q: text(params.get("q")).slice(0, 120),
    category: text(params.get("category")).slice(0, 80),
    state: ["all", "low", "out", "negative", "product", "service"].includes(text(params.get("state"))) ? text(params.get("state")) : "all",
    sort: ["name", "code", "qty", "value", "category"].includes(text(params.get("sort"))) ? text(params.get("sort")) : "name",
  });
  // ids (v2.1.0, §3.11): yalnız bu ürünler (mutabakat kapısı dokunulan ürünleri denetler); miktar hesabı aynıdır.
  function list(user, { q = "", category = "", state = "all", sort = "name", ids = null } = {}) {
    const only = ids ? JSON.stringify([...ids]) : null;
    // ids: tekli + deleted_at indeksini kapatır (birincil anahtar seçilir; değer aynı).
    const items = only ? store.all(`${ITEM_SQL} WHERE +i.deleted_at IS NULL AND i.id IN (SELECT value FROM json_each(?)) ORDER BY i.name COLLATE NOCASE`, only) : store.all(`${ITEM_SQL} WHERE i.deleted_at IS NULL ORDER BY i.name COLLATE NOCASE`);
    const moves = new Map();
    for (const move of only ? store.all("SELECT item_id AS itemId, kind, qty, date FROM stock_moves WHERE item_id IN (SELECT value FROM json_each(?)) ORDER BY date, created_at", only) : store.all("SELECT item_id AS itemId, kind, qty, date FROM stock_moves ORDER BY date, created_at")) {
      if (!moves.has(move.itemId)) moves.set(move.itemId, []);
      moves.get(move.itemId).push(move);
    }
    const needle = String(q || "").toLocaleLowerCase("tr-TR").trim();
    const totals = { count: 0, low: 0, out: 0, negative: 0, value: 0, services: 0 };
    const categories = new Set();
    const out = [];
    for (const row of items) {
      if (row.category) categories.add(row.category);
      if (category && row.category !== category) continue;
      if (needle && !`${row.name} ${row.code} ${row.category} ${row.note}`.toLocaleLowerCase("tr-TR").includes(needle)) continue;
      const own = moves.get(row.id) || [];
      const level = stockLevel(row, own);
      const service = row.kind === "service";
      if (state === "low" && !level.low) continue;
      if (state === "out" && (service || level.qty > 0)) continue;
      if (state === "negative" && (service || level.qty >= 0)) continue;
      if (state === "service" && !service) continue;
      if (state === "product" && service) continue;
      totals.count += 1;
      if (service) totals.services += 1;
      if (level.low) totals.low += 1;
      if (!service && level.qty <= 0) totals.out += 1;
      if (!service && level.qty < 0) totals.negative += 1;
      totals.value = roundMoney(totals.value + level.value);
      out.push({ id: row.id, kind: row.kind || "product", code: row.code, name: row.name, unit: unitLabel(row.unit), category: row.category, minQty: row.minQty, unitPrice: row.unitPrice, salePrice: row.salePrice || 0, note: row.note, ...level, lastMove: own.at(-1)?.date || "" });
    }
    const byName = (a, b) => collator.compare(a.name, b.name);
    const compare = {
      name: byName,
      code: (a, b) => collator.compare(String(a.code), String(b.code)) || byName(a, b),
      qty: (a, b) => a.qty - b.qty || byName(a, b),
      value: (a, b) => b.value - a.value || byName(a, b),
      category: (a, b) => collator.compare(String(a.category), String(b.category)) || byName(a, b),
    }[sort];
    // Kritik ürünler her sıralamada önce (göz önünde olsun).
    out.sort((a, b) => Number(b.low) - Number(a.low) || compare(a, b));
    return { items: out, totals, categories: [...categories].sort(collator.compare), sort, canManage: canUser(user, "stock.manage"), canMove: canUser(user, "stock.move"), canSell: canUser(user, "stock.sell") || canUser(user, "stock.manage"), today: today() };
  }

  // Liste sayfa sayfa (limit/offset); toplamlar ve kategori listesi tüm süzgeç için.
  router.get("/api/workspace/stock", async ({ req, res, url }) => {
    const user = auth.requirePermission(req, "stock.view");
    const data = list(user, listQuery(url.searchParams));
    const limit = Math.min(5000, Math.max(1, Math.trunc(Number(url.searchParams.get("limit")) || 300)));
    const offset = Math.max(0, Math.trunc(Number(url.searchParams.get("offset")) || 0));
    ok(res, { ...data, items: data.items.slice(offset, offset + limit), total: data.items.length, offset, limit, hasMore: offset + limit < data.items.length });
  });
  const PDF_ROWS = 20_000;

  router.get("/api/workspace/stock/alerts", async ({ req, res }) => {
    auth.requirePermission(req, "stock.view");
    ok(res, alerts());
  });

  // ---------- Ürün kartı ----------
  const itemInput = (body, previous = null) => {
    const name = limited(body.name, 160, "Ürün adı");
    if (!name) throw new HttpError(400, "Ürünün adını yazın (ör. Çay, Şeker, Motor yağı).");
    // Hizmet kalemi (v2.0.7): miktarı ve kritik seviyesi izlenmez; kritik stok sayısına girmez.
    const kind = body.kind === "service" ? "service" : body.kind === "product" ? "product" : previous?.kind || "product";
    return {
      kind,
      name,
      code: limited(body.code, 60, "Stok Kodu"),
      unit: unitLabel(limited(body.unit, 20, "Birim") || previous?.unit),
      category: limited(body.category, 80, "Kategori"),
      minQty: kind === "service" ? 0 : optionalQty(body.minQty, "Kritik seviye"),
      unitPrice: priceOf(body.unitPrice),
      // v2.0.13: satış fiyatı (raf/etiket). Birim fiyat alış/maliyettir; çıkış formu satış fiyatıyla açılır.
      salePrice: priceOf(body.salePrice),
      note: limited(body.note, 1000, "Not"),
    };
  };
  // v2.0.16 (müşteri): Stok Kodu (barkod) tektir — faturada kodla ya da barkod okuyucuyla seçilen ürün tek olmalı.
  const assertCodeFree = (code, exceptId = "") => {
    const value = String(code || "").trim();
    if (!value) return;
    const owner = store.get("SELECT name FROM stock_items WHERE deleted_at IS NULL AND code = ? COLLATE NOCASE AND id <> ?", value, exceptId);
    if (owner) throw new HttpError(409, `“${value}” Stok Kodu “${owner.name}” ürününde kullanılıyor; her ürünün kodu ayrı olmalı.`, { code: "stock-code-taken", field: "code" });
  };
  function insertItem(user, input, fields = []) {
    const id = newId("stock");
    store.run(
      "INSERT INTO stock_items (id, kind, code, name, unit, category, min_qty, unit_price, sale_price, note, fields_json, created_by, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)",
      id, input.kind || "product", input.code, input.name, input.unit, input.category, input.minQty, input.unitPrice, input.salePrice || 0, input.note, JSON.stringify(fields), user.id, now(), now(),
    );
    return id;
  }
  router.post("/api/workspace/stock", async ({ req, res }) => {
    const user = auth.requirePermission(req, "stock.manage");
    const body = await readJson(req);
    let openingMove = null;
    let touched = [];
    // v2.1.0 (bank.post): ilk alım peşinse (Kasa/banka/POS) para satırıdır ve İşlem No'lu işlem başlığı alır.
    const result = bank.post({ user, module: "stock", op: "create", write: () => {
      const input = itemInput(body);
      if (store.get("SELECT 1 AS found FROM stock_items WHERE deleted_at IS NULL AND name = ? COLLATE NOCASE AND unit = ? COLLATE NOCASE", input.name, input.unit)) throw new HttpError(409, `“${input.name}” (${input.unit}) zaten var. Aynı ürüne giriş yapın.`);
      assertCodeFree(input.code);
      const id = insertItem(user, input);
      // İlk miktar (v2.0.8): elde olan stok (açılış; para yazılmaz), ya da yeni alım — Kasa'dan ödendi (Kasa'ya "Stok
      // ödemesi" gideri: miktar × birim fiyat) veya tedarikçiye borç (cariye). Stok girişiyle aynı kural (moveInput).
      const opening = input.kind === "service" ? 0 : optionalQty(body.openingQty, "Açılış stoku");
      if (opening > 0) {
        const pay = PAY.has(text(body.openingPay)) ? text(body.openingPay) : "none";
        openingMove =
          pay === "none"
            ? { kind: "in", qty: opening, unitPrice: input.unitPrice, amount: 0, date: period ? period.movementDate(body, { field: "openingDate" }) : dateOf(body.openingDate, "Tarih", today()), note: "Açılış stoku", pay: "none", accountId: "" }
            : moveInput({ kind: "in", qty: opening, unitPrice: input.unitPrice, pay, accountId: body.openingAccountId, date: body.openingDate, note: limited(body.openingNote, 300, "Açıklama") || "İlk alım" }, user, { ...input, id });
        if (openingMove.pay === "cash") cash?.guardOut?.(openingMove.amount, openingMove.date, body.cashForce === true, openingMove.method);
        const moveId = insertMove(user, id, openingMove);
        touched = syncAccount(user, input, moveId, openingMove);
      }
      audit(user, "stock.item.created", id, { name: input.name, unit: input.unit, opening, openingPay: openingMove?.pay || "none", amount: openingMove?.amount || 0 });
      return detail(id, user);
    } });
    changed(user, { itemId: result.id });
    if (openingMove?.pay === "cash") changed(user, { kind: "cash" });
    publishAccounts(user, touched);
    ok(res, result);
  });
  router.get("/api/workspace/stock/liste.pdf", async ({ req, res, url }) => {
    const user = auth.requirePermission(req, "stock.view");
    const query = listQuery(url.searchParams);
    const data = list(user, query);
    const clipped = data.items.length > PDF_ROWS;
    if (clipped) data.items = data.items.slice(0, PDF_ROWS);
    const title = limited(url.searchParams.get("title"), 60, "Başlık") || "Stok";
    const pdf = tablePdf({
      now: clock(),
      title: `${title} durumu`,
      subtitle: [query.state === "low" ? "Kritik seviyede" : query.state === "out" ? "Tükenen" : query.state === "negative" ? "Eksi stoktakiler" : "Tüm ürünler", query.category, query.q ? `“${query.q}”` : "", clipped ? `ilk ${PDF_ROWS.toLocaleString("tr-TR")} satır (tamamı Excel'de)` : ""].filter(Boolean).join(" · "),
      headers: ["Stok Kodu", "Ürün", "Kategori", "Mevcut", "Birim", "Kritik Seviye", "Birim Fiyat", "Değer", "Son Hareket", "Durum"],
      types: ["text", "text", "text", "text", "text", "text", "money", "money", "text", "text"],
      rows: data.items.map(item => [item.code, item.name, item.category, qtyText(item.qty), item.unit, item.minQty ? qtyText(item.minQty) : "", tl(item.unitPrice), tl(item.value), dayText(item.lastMove), item.kind === "service" ? "Hizmet" : item.qty < 0 ? `Eksi (${qtyText(item.qty)} ${item.unit})` : item.qty <= 0 ? "Tükendi" : item.low ? "Kritik" : ""]),
      summary: [["Ürün", String(data.totals.count)], ["Kritik", String(data.totals.low)], ["Tükenen", String(data.totals.out)], ["Eksi Stok", String(data.totals.negative)], ["Stok Değeri", tl(data.totals.value)]],
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
    const number = value => qtyFormat.format(value || 0);
    const money = value => moneyFormat.format(value || 0);
    const columns = ["Stok Kodu", "Ürün", "Kategori", "Birim", "Mevcut", "Toplam Giriş", "Toplam Çıkış", "Kritik Seviye", "Birim Fiyat", "Değer", "Son Hareket", "Not"];
    const rows = data.items.map(item => ({ Kod: item.code, Ürün: item.name, Kategori: item.category, Birim: item.unit, Mevcut: number(item.qty), "Toplam Giriş": number(item.qtyIn), "Toplam Çıkış": number(item.qtyOut), "Kritik Seviye": number(item.minQty), "Birim Fiyat": money(item.unitPrice), Değer: money(item.value), "Son Hareket": dayText(item.lastMove), Not: item.note }));
    const buffer = buildXlsx([{ name: title.slice(0, 31), columns, rows }], { now: clock(), title: `${title} durumu` });
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
      if (String(input.code).toLocaleLowerCase("tr-TR") !== String(previous.code || "").toLocaleLowerCase("tr-TR")) assertCodeFree(input.code, previous.id);
      store.run("UPDATE stock_items SET kind = ?, code = ?, name = ?, unit = ?, category = ?, min_qty = ?, unit_price = ?, sale_price = ?, note = ?, updated_by = ?, updated_at = ? WHERE id = ?", input.kind, input.code, input.name, input.unit, input.category, input.minQty, input.unitPrice, input.salePrice, input.note, user.id, now(), previous.id);
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
      // v2.0.15: faturadan gelen hareketi olan ürün silinmez (fatura kalemi yasal belgedir; stok izi kopmaz). Önce fatura
      // iptal edilir ya da iade kesilir; fatura iptali hareketi zaten kaldırır.
      const linked = store.get("SELECT COUNT(*) AS n, MIN(inv.number) AS number FROM stock_moves m JOIN invoices inv ON inv.id = m.invoice_id WHERE m.item_id = ? AND m.invoice_id <> ''", item.id);
      if (linked?.n) throw new HttpError(409, `“${item.name}” ${linked.n} fatura kalemine bağlı (ör. ${linked.number || "taslak"}); fatura kalemi olan ürün silinmez. Önce faturayı iptal edin ya da iade kesin.`, { code: "invoice-linked", count: linked.n });
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
    const method = move.pay === "cash" ? methodInput(move.method) : "cash";
    // v2.1.0 (bank.post): peşin (Kasa/banka/POS) hareket para satırıdır ve İşlem No'lu işlem başlığı alır; yalnız miktar ya da açık
    // hesap hareketi para satırı değildir.
    const finRef = move.pay === "cash" ? move.finRef || "" : "";
    const eventId = bank.eventFor("stock_moves", { kind: move.kind, pay: move.pay, amount: move.amount, date: move.date, method, fin_ref: finRef });
    store.run(
      "INSERT INTO stock_moves (id, item_id, kind, qty, unit_price, amount, date, note, pay, reason, method, account_id, invoice_id, fin_ref, event_id, created_by, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)",
      id, itemId, move.kind, move.qty, move.unitPrice, move.amount, move.date, move.note, move.pay, move.reason || "", method, move.accountId || "", move.invoiceId || "", finRef, eventId, user.id, now(),
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
    if (pay !== "none" && !(amount > 0)) throw new HttpError(400, unitPrice > 0 ? "Tutar 0,00 TL çıkıyor (miktar × birim fiyat kuruşa yuvarlanınca). Miktarı ya da fiyatı kontrol edin." : "Kasa'ya ya da cariye yazmak için birim fiyat girin (tutar = miktar × birim fiyat).");
    // Para yazan hareket (Kasa ya da cari) yönetim yetkisidir; yalnız miktar hareketini herkes girer.
    // v2.0.13: "Satış Yapma" yetkisi (stock.sell) satış ve müşteri iadesinde para yazdırır; alım yönetim yetkisidir.
    const selling = kind === "out" || text(body.reason) === "return";
    if (pay !== "none" && !canUser(user, "stock.manage") && !(selling && canUser(user, "stock.sell"))) throw new HttpError(403, "Kasa'ya ya da cariye yazılan stok hareketi yönetim yetkisidir (satış ve iade için \"Satış Yapma\" yetkisi yeter). Yalnız miktarı girebilirsiniz.");
    const accountId = pay === "account" ? limited(body.accountId, 120, "Cari") : "";
    if (pay === "account" && !accountId) throw new HttpError(400, kind === "in" ? "Alımın yazılacağı tedarikçi carisini seçin." : "Satışın yazılacağı müşteri carisini seçin.");
    if (accountId && !accounts()?.exists(accountId)) throw new HttpError(400, "Seçilen cari bulunamadı; silinmiş olabilir.");
    // v2.0.13: müşteri iadesi — satıştan dönen mal (yalnız girişte). Kasa'da "Satış iadesi", caride alacak "Satış iadesi"
    // olarak görünür; alım sayılmaz (ürünün maliyet fiyatı değişmez).
    const reason = kind === "in" && text(body.reason) === "return" ? "return" : "";
    // v2.0.13: para Kasa'dan/Kasa'ya geçiyorsa yolu: nakit, havale/EFT ya da kredi kartı (POS).
    return { kind, qty, unitPrice, amount, date: period ? period.movementDate(body) : dateOf(body.date, "Tarih", today()), note: limited(body.note, 300, "Açıklama"), pay, reason, method: pay === "cash" ? methodInput(body.method) : "cash", accountId };
  };
  // Eksiye düşme kontrolü: çıkış mevcuttan fazlaysa sorulur (force ile kaydedilir; sayım farkı olabilir).
  function assertAvailable(item, move, previous, force) {
    if (move.kind !== "out" || force || item.kind === "service") return;
    const moves = movesOf(item.id).filter(row => row.id !== previous?.id);
    const available = stockLevel(item, moves).qty;
    if (move.qty > available + 1e-9) throw new HttpError(409, `Stokta ${qtyText(available)} ${item.unit} var; ${qtyText(move.qty)} ${item.unit} çıkış stoğu eksiye düşürür. ${afterText(roundQty(available - move.qty), item.unit)}`, { code: "stock-negative", available, after: roundQty(available - move.qty) });
  }
  const accountNote = (item, move) => `${move.reason === "return" ? "Satış iadesi" : `Stok ${move.kind === "in" ? "alımı" : "satışı"}`}: ${item.name} ${qtyText(move.qty)} ${item.unit} × ${tl(move.unitPrice)}${move.note ? ` · ${move.note}` : ""}`;
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

  // v2.1.0 Aşama 8 (plan §3.7 #8): peşin havale/EFT satış, alım ve iade banka hesabına bağlanır (fin_ref); istek kimliği, Benzer İşlem, K7
  // (alım ve iade bankadan çıkar), bankadan çıkış bank.move ister. Stok girişi (alım ya da müşteri iadesi) = bankadan çıkış.
  const banking = bankForm(bankModule);
  const bankOut = move => move.kind === "in";
  router.post("/api/workspace/stock/:id/moves", async ({ req, res, params }) => {
    const user = auth.requirePermission(req, "stock.move");
    const item = itemRow(params.id);
    const body = await readJson(req);
    const input = moveInput(body, user, item);
    assertAvailable(item, input, null, body.force === true);
    if (input.kind === "in" && input.pay === "cash") cash?.guardOut?.(input.amount, input.date, body.cashForce === true, input.method);
    input.finRef = input.pay === "cash" ? banking.ref({ method: input.method, value: body.bankAccountId, date: input.date }) : "";
    banking.requireOut(user, bankOut(input), input.finRef);
    const k7 = banking.negative([input.finRef], input.date, banking.forced(body));
    let touched = [];
    let trimmed = [];
    const posted = bank.post({ user, module: "stock", op: "create", requestId: banking.requestId(req, body), scope: "stock.move.create", body: { ...body, itemId: item.id }, similarOk: body.similarOk === true, guard: k7.guard, write: () => {
      k7.capture();
      const moveId = insertMove(user, item.id, input);
      touched = syncAccount(user, item, moveId, input);
      // Alımda birim fiyat verildiyse ürünün son birim fiyatı güncellenir (stok değeri güncel kalsın).
      if (input.kind === "in" && input.reason !== "return" && input.unitPrice > 0 && canUser(user, "stock.manage")) store.run("UPDATE stock_items SET unit_price = ?, updated_at = ? WHERE id = ?", input.unitPrice, now(), item.id);
      audit(user, input.kind === "in" ? (input.reason === "return" ? "stock.return" : "stock.in") : "stock.out", moveId, { itemId: item.id, itemName: item.name, ...input });
      // v2.0.13: veresiye satışı taksitlendir — satış carinin borcunu bir kez yazar; kart bu borcu vadelere böler
      // (mevcut borcu taksitlendiren kart, ikinci kez borç yazmaz).
      const plan = body.installments && typeof body.installments === "object" ? body.installments : null;
      if (plan && input.kind === "out" && input.pay === "account") {
        if (!canUser(user, "plans.manage")) throw new HttpError(403, "Satışı taksitlendirmek taksit yönetimi yetkisidir.");
        const account = accounts()?.detail ? accounts().detail(input.accountId, user) : null;
        const count = Math.trunc(Number(plan.count));
        // Vade satış tarihinden önce olamaz (v2.0.13).
        if (period) period.dueDate(text(plan.firstDue), { from: input.date, label: "İlk Vade" });
        const distribution = plans()?.validDistribution ? plans().validDistribution({ count, firstDue: plan.firstDue, everyMonths: plan.everyMonths }, input.amount) : null;
        if (account && distribution) plans().createForAccount(user, account, { total: input.amount, count, firstDue: text(plan.firstDue), everyMonths: Math.trunc(Number(plan.everyMonths) || 1), note: accountNote(item, input), coversBalance: true });
      }
      // Açık hesaba müşteri iadesi: borç azalır; taksitlendirilmiş borç kalandan büyük kalmasın (kart da küçülür).
      if (input.reason === "return" && input.pay === "account" && plans()?.trimCovers) trimmed = plans().trimCovers(input.accountId, user, accountNote(item, input));
      return { id: moveId };
    } });
    k7.prime(posted);
    const id = posted?.replayed ? posted.refId : posted.id;
    if (posted?.replayed) return ok(res, { ...detail(item.id, user), moveId: id, replayed: true, trimmedPlans: [] });
    changed(user, { itemId: item.id });
    if (input.pay === "cash") changed(user, { kind: "cash" });
    publishAccounts(user, touched);
    if (trimmed.length) changed(user, { kind: "plans" });
    ok(res, { ...detail(item.id, user), moveId: id, trimmedPlans: trimmed });
  });
  const moveOf = (itemId, moveId) => {
    const move = store.get("SELECT id, kind, qty, unit_price AS unitPrice, amount, date, note, pay, reason, method, account_id AS accountId, invoice_id AS invoiceId, event_id AS eventId, fin_ref AS finRef, created_by AS createdBy, created_at AS createdAt FROM stock_moves WHERE item_id = ? AND id = ?", itemId, limited(moveId, 120, "Hareket"));
    if (!move) throw new HttpError(404, "Stok hareketi bulunamadı. Başka biri silmiş olabilir.");
    return move;
  };
  // Kasa'ya etkisi: peşin satış Kasa'ya giriş, peşin alım ve nakit iade Kasa'dan çıkış (düzeltme/silme koruması için).
  const cashSide = move => (move && move.pay === "cash" && Number(move.amount) > 0 ? { kind: move.kind === "out" ? "in" : "out", amount: move.amount, method: move.method || "cash", date: move.date } : null);
  const requireMoveRight = (user, move) => {
    if (move.invoiceId) throw new HttpError(409, "Bu hareket bir faturadan geldi; Fatura ekranından iptal edin ya da iade faturası kesin.", { code: "invoice-linked", invoiceId: move.invoiceId });
    if (canUser(user, "stock.manage")) return;
    if (move.createdBy !== user.id || move.pay !== "none") throw new HttpError(403, "Bu hareketi yalnızca yönetici, uzman ve muhasebe değiştirebilir.");
  };
  router.put("/api/workspace/stock/:id/moves/:moveId", async ({ req, res, params }) => {
    const user = auth.requirePermission(req, "stock.move");
    const item = itemRow(params.id);
    const previous = moveOf(item.id, params.moveId);
    requireMoveRight(user, previous);
    period?.assertOpen(previous.date, "Bu stok hareketi");
    const body = await readJson(req);
    const input = moveInput({ ...previous, ...body, kind: previous.kind }, user, item, previous);
    assertAvailable(item, input, previous, body.force === true);
    cash?.guardChange?.(cashSide(previous), cashSide(input), body.cashForce === true);
    const before = { method: previous.pay === "cash" ? previous.method || "cash" : "", finRef: previous.finRef };
    const moved = previous.pay !== input.pay || (previous.method || "cash") !== (input.method || "cash") || Math.abs(Number(previous.amount) - input.amount) > 0.004 || previous.date !== input.date;
    const finRef = input.pay === "cash" ? banking.ref({ method: input.method, value: body.bankAccountId, date: input.date, previous: before, changed: moved }) : "";
    if (finRef !== (previous.finRef || "")) banking.requireOut(user, bankOut(previous), finRef);
    const k7 = banking.negative([previous.finRef, finRef], previous.date < input.date ? previous.date : input.date, banking.forced(body));
    let touched = [];
    const result = bank.post({
      user,
      module: "stock",
      op: "update",
      prev: previous,
      requestId: banking.requestId(req, body),
      scope: "stock.move.update",
      body: { ...body, moveId: previous.id },
      guard: k7.guard,
      write: () => {
        k7.capture();
        // Peşin ↔ açık hesap geçişi: para satırı olmaktan çıkan hareketin olayı iptal olur, yeniden peşin olan yeni olay alır.
        const eventId = bank.eventFor("stock_moves", { kind: previous.kind, pay: input.pay, amount: input.amount, date: input.date, method: input.method || "cash", fin_ref: finRef, event_id: previous.eventId });
        store.run("UPDATE stock_moves SET qty = ?, unit_price = ?, amount = ?, date = ?, note = ?, pay = ?, reason = ?, method = ?, account_id = ?, fin_ref = ?, event_id = ?, updated_by = ?, updated_at = ? WHERE id = ?", input.qty, input.unitPrice, input.amount, input.date, input.note, input.pay, input.reason || "", input.method || "cash", input.accountId, finRef, eventId, user.id, now(), previous.id);
        touched = syncAccount(user, item, previous.id, input, previous.accountId);
        audit(user, "stock.move.updated", previous.id, { itemId: item.id, previous, ...input, finRef });
        return { id: previous.id };
      },
    });
    k7.prime(result);
    changed(user, { itemId: item.id });
    changed(user, { kind: "cash" });
    publishAccounts(user, touched);
    ok(res, detail(item.id, user));
  });
  router.delete("/api/workspace/stock/:id/moves/:moveId", async ({ req, res, params, url }) => {
    const user = auth.requirePermission(req, "stock.move");
    const item = itemRow(params.id);
    const previous = moveOf(item.id, params.moveId);
    requireMoveRight(user, previous);
    period?.assertOpen(previous.date, "Bu stok hareketi");
    cash?.guardChange?.(cashSide(previous), null, url.searchParams.get("cashForce") === "1", "Bu stok hareketi silinince");
    let accountId = "";
    const k7 = banking.negative([previous.finRef], previous.date, banking.forced(null, url));
    const result = bank.post({
      user,
      module: "stock",
      op: "delete",
      prev: previous,
      guard: k7.guard,
      write: () => {
        k7.capture();
        store.run("DELETE FROM stock_moves WHERE id = ?", previous.id);
        accountId = accounts()?.stockEntry ? accounts().stockEntry.remove(previous.id) : "";
        trash?.add({ kind: "stock-move", ref: previous.id, title: item.name, detail: `${previous.kind === "in" ? "Giriş" : "Çıkış"} ${qtyText(previous.qty)} ${item.unit}${previous.note ? ` · ${previous.note}` : ""}`, payload: { ...previous, itemId: item.id, itemName: item.name, unit: item.unit }, user });
        audit(user, "stock.move.deleted", previous.id, { itemId: item.id, ...previous });
        return { id: previous.id };
      },
    });
    k7.prime(result);
    changed(user, { itemId: item.id });
    if (previous.pay === "cash") changed(user, { kind: "cash" });
    publishAccounts(user, [accountId].filter(Boolean));
    ok(res, detail(item.id, user));
  });
  router.get("/api/workspace/stock/:id/hareketler.pdf", async ({ req, res, params, url }) => {
    const user = auth.requirePermission(req, "stock.view");
    const item = detail(params.id, user);
    const payText = move => (move.pay === "cash" ? (move.kind === "in" ? (move.reason === "return" ? "Kasa'dan iade edildi" : "Kasa'dan ödendi") : "Kasa'ya tahsil") : move.pay === "account" ? `Cari: ${move.accountName}` : "");
    const pdf = tablePdf({
      now: clock(),
      title: `Stok Hareketleri · ${item.name}`,
      subtitle: [item.code ? `Kod ${item.code}` : "", item.category, `Birim: ${item.unit}`].filter(Boolean).join(" · "),
      headers: ["Tarih", "İşlem", "Açıklama", "Giriş", "Çıkış", "Kalan", "Birim Fiyat", "Tutar", "Ödeme"],
      types: ["text", "text", "text", "text", "text", "text", "money", "money", "text"],
      rows: item.moves.map(move => [dayText(move.date), move.reason === "return" ? "Satıştan İade" : move.reason === "preturn" ? "Alıştan İade" : move.kind === "in" ? "Giriş" : "Çıkış", move.note || "", move.kind === "in" ? qtyText(move.qty) : "", move.kind === "out" ? qtyText(move.qty) : "", qtyText(move.balance), move.unitPrice ? tl(move.unitPrice) : "", move.amount ? tl(move.amount) : "", payText(move)]),
      summary: [["Mevcut", `${qtyText(item.qty)} ${item.unit}`], ["Toplam Giriş", `${qtyText(item.qtyIn)} ${item.unit}`], ["Toplam Çıkış", `${qtyText(item.qtyOut)} ${item.unit}`], ["Değer", tl(item.value)]],
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
    const headerAt = findHeaderRow(matrix, { mapper: mapStockHeaders });
    if (headerAt < 0) throw new HttpError(400, "Sayfada başlık satırı bulunamadı.");
    const headers = matrix[headerAt].map(sanitizeCell);
    const rows = matrix.slice(headerAt + 1, headerAt + 1 + MAX_IMPORT);
    const roles = body.roles && typeof body.roles === "object" ? body.roles : inferRolesByValues(headers, rows, mapStockHeaders(headers), "stock");
    ok(res, { headerAt, headers, roles, rows: matrix.length - headerAt - 1, gate: validateRows(headers, rows, roles, "stock", { headerAt }) });
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
    const col = Object.fromEntries(["code", "name", "unit", "category", "qty", "price", "salePrice", "min", "note", "kind"].map(role => [role, columnOf(role)]));
    const extraColumns = Object.entries(roles).filter(([, value]) => value === "extra").map(([index]) => Number(index)).filter(index => headers[index]);
    if (col.name < 0) throw new HttpError(400, "Ürün adı kolonunu seçin.");
    const mode = body.mode === "update" ? "update" : "skip";
    const defaultUnit = unitLabel(limited(body.unit, 20, "Birim"));
    const cell = (row, index) => (index >= 0 ? sanitizeCell(row[index]) : "");
    const number = (row, index) => {
      const value = parseQty(cell(row, index));
      return Number.isFinite(value) && value >= 0 && value <= MAX_QTY ? roundQty(value) : 0;
    };
    const money = (row, index) => {
      const value = parseAmount(cell(row, index));
      return Number.isFinite(value) && value >= 0 ? Math.round(value * 10000) / 10000 : 0;
    };
    const rows = matrix.slice(headerAt + 1, headerAt + 1 + MAX_IMPORT);
    const report = { created: 0, updated: 0, skipped: [], opening: 0, truncated: Math.max(0, matrix.length - headerAt - 1 - MAX_IMPORT) };
    let skippedTotal = 0;
    const skip = (index, reason) => {
      skippedTotal += 1;
      if (report.skipped.length < 500) report.skipped.push({ row: headerAt + index + 2, reason });
      report.skippedTotal = skippedTotal;
    };
    store.tx(() => {
      rows.forEach((row, index) => {
        if (!Array.isArray(row) || !row.some(value => sanitizeCell(value))) return;
        const name = cell(row, col.name).slice(0, 160);
        if (!name) return skip(index, "Ürün adı boş");
        const kind = /^(hizmet|servis|işçilik|iscilik)/i.test(cell(row, col.kind)) ? "service" : "product";
        const input = { kind, name, code: cell(row, col.code).slice(0, 60), unit: unitLabel(cell(row, col.unit) || defaultUnit), category: cell(row, col.category).slice(0, 80), minQty: number(row, col.min), unitPrice: money(row, col.price), salePrice: money(row, col.salePrice), note: cell(row, col.note).slice(0, 1000) };
        const fields = extraColumns.map(column => ({ label: headers[column].slice(0, 80), value: cell(row, column).slice(0, 1000) })).filter(field => field.value);
        // İki ayrı indeksli arama (kodla, sonra ad + birimle): binlerce satırda da hızlı.
        // Kod tek başına kimlik sayılmaz (Excel'deki sıra numarası olabilir): aynı kod ancak ad da aynıysa aynı ürün.
        const existing = (input.code && store.get("SELECT id FROM stock_items WHERE deleted_at IS NULL AND code = ? AND name = ? COLLATE NOCASE", input.code, input.name)) || store.get("SELECT id FROM stock_items WHERE deleted_at IS NULL AND name = ? COLLATE NOCASE AND unit = ? COLLATE NOCASE", input.name, input.unit);
        if (existing && mode === "skip") return skip(index, "Bu ürün zaten var");
        // v2.0.16: Stok Kodu tektir; başka üründe kullanılan kod bu satıra yazılmaz (ürün yine aktarılır, rapora düşer).
        if (input.code && store.get("SELECT 1 AS found FROM stock_items WHERE deleted_at IS NULL AND code = ? COLLATE NOCASE AND id <> ?", input.code, existing?.id || "")) {
          report.codeCleared = (report.codeCleared || 0) + 1;
          if (report.skipped.length < 500) report.skipped.push({ row: headerAt + index + 2, reason: `Stok Kodu “${input.code}” başka üründe; kod boş bırakıldı` });
          input.code = "";
        }
        if (existing) {
          store.run(
            "UPDATE stock_items SET code = CASE WHEN ? <> '' THEN ? ELSE code END, category = CASE WHEN ? <> '' THEN ? ELSE category END, min_qty = CASE WHEN ? > 0 THEN ? ELSE min_qty END, unit_price = CASE WHEN ? > 0 THEN ? ELSE unit_price END, sale_price = CASE WHEN ? > 0 THEN ? ELSE sale_price END, note = CASE WHEN ? <> '' THEN ? ELSE note END, updated_by = ?, updated_at = ? WHERE id = ?",
            input.code, input.code, input.category, input.category, input.minQty, input.minQty, input.unitPrice, input.unitPrice, input.salePrice, input.salePrice, input.note, input.note, user.id, now(), existing.id,
          );
          report.updated += 1;
          return;
        }
        const id = insertItem(user, input, fields);
        const qty = kind === "service" ? 0 : number(row, col.qty);
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
  // Kasa (v2.1.0, K5): Kasa'dan ödenen alımlar (çıkış) ve Kasa'ya tahsil edilen satışlar (giriş) tek kaynaktan (lib/bank/money-lines.mjs,
  // kaynak 7) okunur. Ürün silinse de para gerçektir; kalır.
  // v2.0.15: faturanın stoklu kalemleri. Hareket faturaya bağlıdır (invoice_id); para faturadan yazılır (pay = 'none').
  // reason: '' (alış girişi / satış çıkışı), 'return' (satıştan iade: giriş), 'preturn' (alıştan iade: çıkış).
  // Alışta ürünün birim fiyatı (stok değeri ve maliyet) faturanın iskontolu TL birim maliyetiyle güncellenir.
  const invoiceStock = {
    itemFor(itemId) {
      const item = store.get(`${ITEM_SQL} WHERE i.id = ? AND i.deleted_at IS NULL`, String(itemId || ""));
      if (!item) throw new HttpError(400, "Faturadaki ürün stokta bulunamadı; silinmiş olabilir.", { code: "item-missing" });
      return item;
    },
    // v2.0.16 (müşteri): "Stoğa Mal Alışı"nda stokta olmayan ürün için kart, faturanın kaydıyla AYNI işlemde açılır.
    // Aynı ad ve birimde kart varsa o kullanılır (çift kart açılmaz).
    createFor(user, { name, unit, code = "", salePrice = 0, unitPrice = 0, invoiceId = "" }) {
      const input = itemInput({ name, unit, code, salePrice, unitPrice, kind: "product" });
      const existing = store.get("SELECT id FROM stock_items WHERE deleted_at IS NULL AND name = ? COLLATE NOCASE AND unit = ? COLLATE NOCASE", input.name, input.unit);
      if (existing) return { id: existing.id, created: false };
      assertCodeFree(input.code);
      const id = insertItem(user, input);
      audit(user, "stock.item.created", id, { name: input.name, unit: input.unit, code: input.code, opening: 0, from: "invoice", invoiceId });
      return { id, created: true };
    },
    codeOwner: code => (String(code || "").trim() ? store.get("SELECT id, name FROM stock_items WHERE deleted_at IS NULL AND code = ? COLLATE NOCASE", String(code).trim()) || null : null),
    available(itemId, exceptInvoiceId = "") {
      const item = this.itemFor(itemId);
      const moves = movesOf(item.id).filter(move => !exceptInvoiceId || move.invoiceId !== exceptInvoiceId);
      return stockLevel(item, moves).qty;
    },
    add(user, { itemId, kind, qty, unitPrice, amount, date, note, reason = "", invoiceId, force = false, unitCost = 0 }) {
      const item = this.itemFor(itemId);
      if (item.kind === "service") return "";
      const move = { kind, qty: roundQty(qty), unitPrice, amount: roundMoney(amount), date, note: String(note || "").slice(0, 300), pay: "none", reason, accountId: "", invoiceId };
      if (kind === "out" && !force) {
        const available = stockLevel(item, movesOf(item.id)).qty;
        if (move.qty > available + 1e-9) throw new HttpError(409, `“${item.name}” stokta ${qtyText(available)} ${item.unit} var; faturadaki ${qtyText(move.qty)} ${item.unit} stoğu eksiye düşürür. ${afterText(roundQty(available - move.qty), item.unit)}`, { code: "stock-negative", available, after: roundQty(available - move.qty), itemId: item.id, itemName: item.name });
      }
      const id = insertMove(user, item.id, move);
      if (kind === "in" && reason === "" && unitCost > 0) store.run("UPDATE stock_items SET unit_price = ?, updated_at = ? WHERE id = ?", Math.round(unitCost * 10000) / 10000, now(), item.id);
      return id;
    },
    // Fatura iptalinde: faturanın hareketleri silinir. Girişin silinmesi stoğu eksiye düşürecekse (mal satılmış) sorulur.
    removeFor(invoiceId, { force = false } = {}) {
      const moves = store.all("SELECT id, item_id AS itemId, kind, qty FROM stock_moves WHERE invoice_id = ?", invoiceId);
      if (!force) {
        for (const move of moves.filter(row => row.kind === "in")) {
          const item = store.get(`${ITEM_SQL} WHERE i.id = ?`, move.itemId);
          if (!item || item.kind === "service") continue;
          const left = stockLevel(item, movesOf(item.id).filter(row => row.invoiceId !== invoiceId)).qty;
          if (left < -1e-9) throw new HttpError(409, `“${item.name}” bu faturayla girdi ve bir kısmı çıktı; iptal stoğu ${qtyText(left)} ${item.unit} yapar. ${afterText(left, item.unit)}`, { code: "stock-negative", itemId: item.id, itemName: item.name, available: left, after: left });
        }
      }
      store.run("DELETE FROM stock_moves WHERE invoice_id = ?", invoiceId);
      return [...new Set(moves.map(move => move.itemId))];
    },
    publish: (user, itemIds) => itemIds.forEach(itemId => changed(user, { itemId })),
  };
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
    // v2.0.26 (A7, B7): kapanmış dönemdeki hareket geri yüklenmez; tutar kuruşa yuvarlanır; yol katı okunur (tanınmayan yol
    // 400 — önceden sessizce nakit sayılıyordu).
    period?.restoreDate(payload.date, "Bu stok hareketi");
    const pay = payload.pay === "account" && !accounts()?.exists(payload.accountId) ? "none" : PAY.has(payload.pay) ? payload.pay : "none";
    const move = { kind: payload.kind, qty: Number(payload.qty) || 0, unitPrice: Number(payload.unitPrice) || 0, amount: roundMoney(Number(payload.amount) || 0), date: payload.date, note: payload.note || "", pay, reason: payload.reason === "return" ? "return" : "", method: pay === "cash" ? methodInput(payload.method) : "cash", accountId: pay === "account" ? payload.accountId : "" };
    // GG2 (K13/7): peşin satış/alışın banka hesabı bağı da döner (hesap silinmişse bağsız; söylenir).
    const kept = pay === "cash" ? bank.keepRef(payload.finRef, { method: move.method, date: move.date }) : { ref: "", dropped: "" };
    bank.post({
      user,
      module: "stock",
      op: "restore",
      prev: payload,
      write: () => {
        if (!store.get("SELECT 1 AS found FROM stock_moves WHERE id = ?", entry.ref)) {
          store.run(
            "INSERT INTO stock_moves (id, item_id, kind, qty, unit_price, amount, date, note, pay, reason, method, account_id, fin_ref, event_id, created_by, created_at, updated_by, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)",
            entry.ref, item.id, move.kind, move.qty, move.unitPrice, move.amount, move.date, move.note, move.pay, move.reason, move.method, move.accountId, kept.ref,
            bank.eventFor("stock_moves", { kind: move.kind, pay: move.pay, amount: move.amount, date: move.date, method: move.method, event_id: payload.eventId || "" }), payload.createdBy || user.id, payload.createdAt || now(), user.id, now(),
          );
          syncAccount(user, item, entry.ref, move);
        }
        trash.markRestored(entry.id, user);
        audit(user, "stock.move.restored", entry.ref, { itemId: item.id, kind: move.kind, qty: move.qty });
      },
    });
    changed(user, { itemId: item.id });
    changed(user, { kind: "cash" });
    return `Stok hareketi geri eklendi${pay !== payload.pay ? " (carisi silindiği için yalnız miktar olarak)" : ""}.${kept.dropped ? ` ${bank.droppedText(kept.dropped)}` : ""}`;
  }
  const fingerprint = () => {
    const row = store.get("SELECT (SELECT COUNT(*) || '/' || COALESCE(MAX(COALESCE(updated_at, created_at)), '') FROM stock_moves) AS m, (SELECT COUNT(*) || '/' || COALESCE(MAX(updated_at), '') FROM stock_items) AS i");
    return `${row.m}|${row.i}`;
  };

  return { alerts, deletedList, restoreDeleted, restoreMove, fingerprint, list, detail, invoiceStock, itemRow };
}
