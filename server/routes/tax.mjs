// Vergi Ödemesi ve KDV Mahsup Fişi (2.4.3; uzman mali müşavir MM3, kullanıcı kararı 18.10.2026).
//
// Sorun: 360 Ödenecek Vergi ve Fonlar (tevkifat, stopaj) ve KDV hesapları (191 / 391) hiçbir işlemle kapanmıyordu; vergi ödemesi ancak "Diğer Gider"
// (659) olarak yazılabiliyordu — gider ikinci kez yazılıyor, 360 her ay büyüyordu. Plan §3.11 beyaz listesi (Diğer Gider satırına 360 / 391 yazılamaz)
// AYNEN kalır; bunlar AYRI işlemlerdir:
//   Vergi Ödemesi  (POST /api/workspace/tax/payments): bankadan B 360 · B 689 (gecikme zammı / faizi, KKEG) / A 102.k — Banka Fişi "tax_payment"
//                  (lib/bank/vouchers.mjs taxPayment); Kasa'dan nakit B 360 · B 689 / A 100 — Kasa satırı (cash_entries.tax_json). Vergi türü KDV,
//                  Muhtasar ve Stopaj ya da Diğer Vergi (360 alt hesabı açılmaz; tür satırın açıklamasında). Tutar ilgili 360 bakiyesini aşarsa UYARI
//                  (409 tax-exceeds; "Yine de Kaydet" = exceedOk), engel değil.
//   KDV Mahsup Fişi (GET/POST /api/workspace/tax/vat-offset): ay seçilir, ön izleme + onay. Ayın 391'i (hesaplanan) ve 191'i (indirilecek) kapanır,
//                  önceki aydan devreden 190 kullanılır; fark 360'a (ödenecek KDV) ya da 190'a (yeni devreden). Tevkifat 360'ı ayrı kalır (fatura).
//                  Aynı ay iki kez mahsup edilmez; mahsuptan sonra o aya KDV'li kayıt gelirse uyarı (geri al + yeniden yap); geri alma ters kayıttır
//                  (aynı gün); yalnız en son etkin mahsup geri alınır ve en son mahsuptan önceki aya yeni mahsup yapılmaz (190 zinciri bozulmasın);
//                  dönem kilidiyle uyumlu (ay sonu kilitliyse 409).
// Yetki: tax.manage (yönetici + muhasebe; personel değil). Bankadan ödemede ayrıca bank.move, Kasa'dan ödemede cash.manage.
import { HttpError, limited, ok, readJson, text } from "../lib/http.mjs";
import { canUser } from "../lib/permissions.mjs";
import { parseMinor } from "../lib/minor.mjs";
import { roundMoney } from "../lib/money.mjs";
import { TAX_TYPES } from "../lib/bank/voucher.mjs";
import { taxOf, vatOffsetLines } from "../lib/general-ledger.mjs";
import { systemClock } from "../lib/clock.mjs";

const BASE = "/api/workspace/tax";
const MONTH = /^\d{4}-(0[1-9]|1[0-2])$/;
const MONTHS = ["Ocak", "Şubat", "Mart", "Nisan", "Mayıs", "Haziran", "Temmuz", "Ağustos", "Eylül", "Ekim", "Kasım", "Aralık"];
const monthLabel = month => `${MONTHS[Number(month.slice(5, 7)) - 1]} ${month.slice(0, 4)}`;
const monthEnd = month => {
  const [y, m] = month.split("-").map(Number);
  return new Date(Date.UTC(y, m, 0)).toISOString().slice(0, 10);
};
const previousMonth = month => {
  const [y, m] = month.split("-").map(Number);
  return m === 1 ? `${y - 1}-12` : `${y}-${String(m - 1).padStart(2, "0")}`;
};
const dayText = iso => (iso ? `${iso.slice(8, 10)}.${iso.slice(5, 7)}.${iso.slice(0, 4)}` : "");
const tlText = minor => `${new Intl.NumberFormat("tr-TR", { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(minor / 100).replace("-", "−")} TL`;
const TYPE_OF_LABEL = new Map(Object.entries(TAX_TYPES).map(([key, label]) => [label, key]));
const bad = (status, message, code, extra = {}) => new HttpError(status, message, { code, ...extra });

export function registerTaxRoutes(router, { store, auth, audit, events, bank, period, ledger = () => null, cash = () => null, bankAccounts = () => null, now: clock = systemClock }) {
  const has = table => Boolean(store.get("SELECT 1 AS found FROM sqlite_master WHERE type = 'table' AND name = ?", table));
  const stamp = () => clock().toISOString();
  const today = () => period?.today?.() || clock().toISOString().slice(0, 10);
  const changed = (user, kind) => events?.publish("workspace.changed", { kind, actorId: user.id, actorName: user.display_name }, { except: user.id });
  const requestIdOf = (req, body) => text(req.headers["x-hof-request"]) || text(body?.requestId);
  const requireTax = req => {
    const user = auth.requirePermission(req, "tax.manage");
    return user;
  };

  // ---------- 360 bakiyesi (türe göre; uyarı için) ----------
  /**
   * Ödenecek vergi (kuruş, alacak artı): KDV = alıcı olarak kesilen tevkifat (2 No.lu) + etkin mahsupların ödenecek KDV'si − ödenen KDV; Muhtasar ve
   * Stopaj = alış faturalarındaki stopaj − ödenen; toplam = 360'ın alacak bakiyesi (Diğer Vergi bununla karşılaştırılır).
   */
  function balances() {
    const out = { kdv: 0, muhtasar: 0, other: 0, total: 0, paid: { kdv: 0, muhtasar: 0, other: 0 } };
    if (has("invoices")) {
      const c = column => `CAST(ROUND(${column} * 100) AS INTEGER)`;
      const row = store.get(
        `SELECT COALESCE(SUM(CASE kind WHEN 'purchase' THEN ${c("try_withheld")} WHEN 'purchase_return' THEN -${c("try_withheld")} END), 0) AS kdv,
                COALESCE(SUM(CASE kind WHEN 'purchase' THEN ${c("try_stoppage")} WHEN 'purchase_return' THEN -${c("try_stoppage")} END), 0) AS muhtasar
         FROM invoices i WHERE i.status = 'issued' AND EXISTS (SELECT 1 FROM accounts a WHERE a.id = i.account_id AND a.deleted_at IS NULL)`,
      );
      out.kdv += Number(row.kdv) || 0;
      out.muhtasar += Number(row.muhtasar) || 0;
    }
    if (has("vat_offsets")) out.kdv += Number(store.get("SELECT COALESCE(SUM(payable_minor), 0) AS n FROM vat_offsets WHERE status = 'active'").n) || 0;
    if (has("bank_lines")) {
      for (const row of store.all("SELECT memo, SUM(CASE side WHEN 'D' THEN try_minor ELSE -try_minor END) AS n FROM bank_lines WHERE gl = '360' AND role = 'tax_payable' GROUP BY memo")) {
        const type = TYPE_OF_LABEL.get(String(row.memo || "").replace(/^Ödenen Vergi · /, "")) || "other";
        out.paid[type] += Number(row.n) || 0;
      }
    }
    if (has("cash_entries") && store.all("PRAGMA table_info(cash_entries)").some(column => column.name === "tax_json")) {
      for (const row of store.all("SELECT tax_json AS taxJson FROM cash_entries WHERE tax_json <> '' AND kind = 'out'")) {
        const tax = taxOf(row);
        if (tax) out.paid[TAX_TYPES[tax.type] ? tax.type : "other"] += tax.taxMinor;
      }
    }
    const accrued = out.kdv + out.muhtasar;
    const paid = out.paid.kdv + out.paid.muhtasar + out.paid.other;
    out.total = accrued - paid;
    out.kdv -= out.paid.kdv;
    out.muhtasar -= out.paid.muhtasar;
    out.other = out.total;
    return out;
  }
  const exceedsCheck = (body, taxMinor, taxType) => {
    if (body?.exceedOk === true) return;
    const b = balances();
    const room = taxType === "other" ? b.total : b[taxType];
    if (taxMinor > room) {
      const label = TAX_TYPES[taxType];
      throw bad(409, `${label} için ödenecek vergi bakiyesi (360) ${tlText(Math.max(0, room))}; ödenen ${tlText(taxMinor)} bu bakiyeyi aşıyor. Tahakkuk programa girilmemiş olabilir (ör. beyanname tutarı). Yine de kaydedilsin mi?`, "tax-exceeds", { balanceMinor: room, amountMinor: taxMinor, taxType });
    }
  };

  // ---------- Vergi Ödemesi ----------
  router.get(BASE, async ({ req, res }) => {
    requireTax(req);
    const b = balances();
    ok(res, {
      types: Object.entries(TAX_TYPES).map(([key, label]) => ({ key, label, balanceMinor: key === "other" ? b.total : b[key] })),
      totalMinor: b.total,
      offsets: offsetList(),
      today: today(),
    });
  });
  router.post(`${BASE}/payments`, async ({ req, res }) => {
    const user = requireTax(req);
    const body = await readJson(req);
    const way = text(body?.way) || "bank";
    if (!["bank", "cash"].includes(way)) throw bad(400, "Ödeme yeri Banka ya da Kasa (Nakit) olmalı.", "tax-way", { field: "way" });
    const taxType = text(body?.taxType);
    if (!Object.hasOwn(TAX_TYPES, taxType)) throw bad(400, "Vergi türünü seçin: KDV, Muhtasar ve Stopaj ya da Diğer Vergi.", "tax-type", { field: "taxType" });
    const taxMinor = parseMinor(body?.amount, { label: "Vergi Tutarı" });
    const lateMinor = body?.lateAmount === undefined || body?.lateAmount === null || String(body.lateAmount).trim() === "" ? 0 : parseMinor(body.lateAmount, { label: "Gecikme Zammı / Faizi", allowZero: true });
    if (way === "bank") {
      auth.requirePermission(req, "bank.move");
      const service = bankAccounts();
      if (!service?.taxPayment) throw new HttpError(503, "Banka modülü hazır değil.");
      const card = service.taxPayment(user, body, { requestId: requestIdOf(req, body), check: spec => (body?.exceedOk === true ? null : exceedsCheck(body, spec.taxMinor, spec.taxType)) });
      changed(user, "bank");
      return ok(res, { way, card });
    }
    // Kasa'dan nakit: Kasa satırı (Kasa Çıkışı; İşlem No'lu başlık), yevmiye B 360 · B 689 / A 100.
    auth.requirePermission(req, "cash.manage");
    const date = period ? period.movementDate(body, { field: "date", label: "Ödeme Tarihi" }) : text(body?.date) || today();
    const description = limited(body?.description, 300, "Açıklama") || `Vergi Ödemesi · ${TAX_TYPES[taxType]}${lateMinor ? " (gecikme zammı dahil)" : ""}`;
    const amount = roundMoney((taxMinor + lateMinor) / 100);
    const id = auth.newId("cash");
    const taxJson = JSON.stringify({ type: taxType, taxMinor, lateMinor });
    const result = bank.post({
      user,
      module: "cash",
      op: "create",
      requestId: requestIdOf(req, body),
      scope: "tax.payment.cash",
      body,
      prepare: () => {
        exceedsCheck(body, taxMinor, taxType);
        cash()?.guardOut?.(amount, date, body?.cashForce === true, "cash");
      },
      write: () => {
        const eventId = bank.eventFor("cash_entries", { kind: "out", amount, date, method: "cash" });
        store.run("INSERT INTO cash_entries (id, kind, amount, date, description, method, event_id, tax_json, created_by, created_at) VALUES (?, 'out', ?, ?, ?, 'cash', ?, ?, ?, ?)", id, amount, date, description, eventId, taxJson, user.id, stamp());
        audit(user, "tax.payment.created", id, { way, taxType, date, taxMinor, lateMinor, description });
        return { id };
      },
    });
    changed(user, "cash");
    ok(res, { way, id: result?.replayed ? result.refId : id, ...(result?.replayed ? { replayed: true } : {}) });
  });

  // ---------- KDV Mahsup Fişi ----------
  function offsetRows() {
    return has("vat_offsets") ? store.all("SELECT id, month, date, out_minor AS outMinor, in_minor AS inMinor, carry_in_minor AS carryInMinor, carry_out_minor AS carryOutMinor, payable_minor AS payableMinor, status, created_at AS createdAt, reversed_at AS reversedAt FROM vat_offsets ORDER BY month, created_at, rowid") : [];
  }
  /** Ayın 391 / 191 hareketi (mahsup fişleri hariç) ve ayın başındaki 190 (kuruş): Ana Defter'in kendi yevmiyesinden. */
  function monthFigures(entries, month) {
    const from = `${month}-01`;
    const to = monthEnd(month);
    let out = 0;
    let input = 0;
    let carry = 0;
    for (const entry of entries) {
      const offset = entry.id.startsWith("vat-offset");
      for (const line of entry.lines) {
        if (line.account === "190" && entry.date < from) carry += line.debit - line.credit;
        if (offset || entry.date < from || entry.date > to) continue;
        if (line.account === "391") out += line.credit - line.debit;
        if (line.account === "191") input += line.debit - line.credit;
      }
    }
    return { out, input, carry: Math.max(0, carry) };
  }
  function linesView(row) {
    const names = { 391: "Hesaplanan KDV", 191: "İndirilecek KDV", 190: "Devreden KDV", 360: "Ödenecek Vergi ve Fonlar" };
    return vatOffsetLines(row).map(line => ({ account: line.account, name: names[line.account] || line.account, debitMinor: line.debit, creditMinor: line.credit }));
  }
  function offsetList() {
    const entries = ledger()?.build ? ledger().build() : [];
    return offsetRows().map(row => {
      const now = monthFigures(entries, row.month);
      const stale = row.status === "active" && (now.out !== Number(row.outMinor) || now.input !== Number(row.inMinor));
      return { ...row, label: monthLabel(row.month), lines: linesView(row), stale, ...(stale ? { nowOutMinor: now.out, nowInMinor: now.input } : {}) };
    });
  }
  /** Ön izleme: ayın tutarları, fişin satırları ve uyarılar (yazım yok). */
  function preview(month) {
    if (!MONTH.test(month)) throw bad(400, "Mahsup edilecek ayı seçin (Yıl-Ay).", "vat-month", { field: "month" });
    const date = monthEnd(month);
    const entries = ledger()?.build ? ledger().build() : [];
    const { out, input, carry } = monthFigures(entries, month);
    const position = out - input - carry;
    const row = { month, date, outMinor: out, inMinor: input, carryInMinor: carry, carryOutMinor: Math.max(0, -position), payableMinor: Math.max(0, position) };
    const offsets = offsetRows();
    const active = offsets.filter(item => item.status === "active");
    const blocks = [];
    const warnings = [];
    const lock = period?.lockedUntil?.() || "";
    if (active.some(item => item.month === month)) blocks.push(`${monthLabel(month)} zaten mahsup edildi. Yeniden yapmak için önce o mahsubu geri alın.`);
    const later = active.filter(item => item.month > month).map(item => monthLabel(item.month));
    if (later.length) blocks.push(`Sonraki ay(lar) mahsup edilmiş (${later.join(", ")}); önceki aya mahsup yapılamaz. Önce sonraki mahsupları (en yeniden başlayarak) geri alın.`);
    if (date > today()) blocks.push(`${monthLabel(month)} henüz bitmedi; mahsup ay sonundan (${dayText(date)}) sonra yapılır.`);
    if (lock && date <= lock) blocks.push(`${monthLabel(month)} kapanmış dönemde (${dayText(lock)} ve öncesi); mahsup fişi yazılamaz.`);
    if (!out && !input && !carry) blocks.push(`${monthLabel(month)} ayında KDV hareketi (391 / 191) ve devreden KDV yok; mahsup edilecek tutar yok.`);
    const prev = previousMonth(month);
    const prevFigures = monthFigures(entries, prev);
    if ((prevFigures.out || prevFigures.input) && !active.some(item => item.month === prev)) warnings.push(`${monthLabel(prev)} mahsup edilmedi; devreden KDV o ayın mahsubundan gelir. Önce ${monthLabel(prev)} ayını mahsup etmeniz önerilir.`);
    return {
      ...row,
      label: monthLabel(month),
      lines: linesView(row),
      result: position > 0 ? "payable" : position < 0 ? "carry" : "zero",
      blocks,
      warnings,
      allowed: blocks.length === 0,
    };
  }
  router.get(`${BASE}/vat-offset`, async ({ req, res, url }) => {
    requireTax(req);
    const month = text(url.searchParams.get("month"));
    ok(res, { ...(month ? { preview: preview(month) } : {}), offsets: offsetList() });
  });
  router.post(`${BASE}/vat-offset`, async ({ req, res }) => {
    const user = requireTax(req);
    const body = await readJson(req);
    const month = text(body?.month);
    let created = null;
    store.tx(() => {
      const view = preview(month);
      if (!view.allowed) throw bad(409, view.blocks[0], "vat-offset-blocked", { blocks: view.blocks });
      period?.assertOpen?.(view.date, "KDV mahsup fişi");
      const id = auth.newId("vat");
      store.run(
        "INSERT INTO vat_offsets (id, month, date, out_minor, in_minor, carry_in_minor, carry_out_minor, payable_minor, status, note, created_by, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'active', ?, ?, ?)",
        id, month, view.date, view.outMinor, view.inMinor, view.carryInMinor, view.carryOutMinor, view.payableMinor, limited(body?.note, 300, "Açıklama"), user.id, stamp(),
      );
      audit(user, "tax.vat-offset.created", id, { month, date: view.date, outMinor: view.outMinor, inMinor: view.inMinor, carryInMinor: view.carryInMinor, carryOutMinor: view.carryOutMinor, payableMinor: view.payableMinor });
      created = { id, ...view };
    });
    changed(user, "ledger");
    ok(res, { offset: created, offsets: offsetList() });
  });
  router.post(`${BASE}/vat-offset/:id/reverse`, async ({ req, res, params }) => {
    const user = requireTax(req);
    let done = null;
    store.tx(() => {
      const row = has("vat_offsets") ? store.get("SELECT id, month, date, status FROM vat_offsets WHERE id = ?", text(params.id)) : null;
      if (!row) throw bad(404, "KDV mahsup fişi bulunamadı.", "vat-offset-missing");
      if (row.status !== "active") throw bad(409, `${monthLabel(row.month)} mahsubu zaten geri alınmış.`, "vat-offset-reversed");
      const later = store.get("SELECT month FROM vat_offsets WHERE status = 'active' AND month > ? ORDER BY month DESC LIMIT 1", row.month);
      if (later) throw bad(409, `Önce sonraki ayın (${monthLabel(later.month)}) mahsubunu geri alın; devreden KDV o mahsupta kullanıldı.`, "vat-offset-later", { month: later.month });
      period?.assertOpen?.(row.date, "KDV mahsup fişi");
      store.run("UPDATE vat_offsets SET status = 'reversed', reversed_by = ?, reversed_at = ? WHERE id = ?", user.id, stamp(), row.id);
      audit(user, "tax.vat-offset.reversed", row.id, { month: row.month, date: row.date });
      done = row;
    });
    changed(user, "ledger");
    ok(res, { id: done.id, offsets: offsetList() });
  });

  return { balances, offsetList, monthLabel };
}
