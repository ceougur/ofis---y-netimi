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
const nextMonth = month => {
  const [y, m] = month.split("-").map(Number);
  return m === 12 ? `${y + 1}-01` : `${y}-${String(m + 1).padStart(2, "0")}`;
};
const dayText = iso => (iso ? `${iso.slice(8, 10)}.${iso.slice(5, 7)}.${iso.slice(0, 4)}` : "");
const tlText = minor => `${new Intl.NumberFormat("tr-TR", { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(minor / 100).replace("-", "−")} TL`;
const TYPE_OF_LABEL = new Map(Object.entries(TAX_TYPES).map(([key, label]) => [label, key]));
const bad = (status, message, code, extra = {}) => new HttpError(status, message, { code, ...extra });
/**
 * 2.5.1 M1 tur 2 — S-M1-1 (kullanıcıya soruldu 27.11.2026; ÖNERİ B uygulanıyor, kullanıcı değiştirebilir): KDV Özeti'nde mahsup fişi kesilmemiş ayların "Önceki Dönemden
 * Devreden KDV"si. A ↔ B YALNIZ bu satırla değişir: "chain" = B (zincirli: her ay bir önceki ayın sonraki döneme devredenini alır; mahsupsuz ay sırayla mahsup edilmiş gibi),
 * "ledger" = A (tur 1: ay başına kadar defterdeki 190 — KDV Mahsup Fişi ön izlemesiyle aynı; mahsupsuz ayda zincir kopar). Ön izleme ve fiş her iki kipte AYNEN.
 */
const VAT_CARRY_MODE = "chain";

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
  /**
   * Ayların 391 / 191 hareketi (mahsup fişleri hariç) ve ay başındaki 190 (kuruş): Ana Defter'in kendi yevmiyesinden, TEK geçişte (2.5.0 Ç7b: liste ve ön izleme her ay için yevmiyeyi
   * yeniden dolaşmıyor — ders 47). of(month) eski monthFigures'ın aynı sonucu: { out, input, carry }.
   */
  // 2.5.0 Ç7b tur 2d (KG-7 = A, KDVK 29/3; EK-1 M8 (2): V-01 satırları dönem etiketine göre; docs/erp/C7B-FATURA-TASARIM.md §14.3): "KDV İndirim Dönemi" belge ayından farklı kesilmiş alış
  // faturaları — maddenin 191'i dönem ayının mahsubuna girer (defter maddesi DEĞİŞMEZ: 191 belge tarihinde). Tek toplu sorgu (ders 47); sütun yoksa (göç 52 öncesi şema) dönem yok.
  function vatPeriods() {
    if (!has("invoices") || !store.all("PRAGMA table_info(invoices)").some(column => column.name === "vat_period")) return new Map();
    return new Map(store.all("SELECT id, vat_period AS period FROM invoices WHERE kind = 'purchase' AND status = 'issued' AND vat_period <> '' AND vat_period <> substr(issue_date, 1, 7)").map(row => [`invoice:${row.id}`, row.period]));
  }
  function figureTable(entries) {
    const months = new Map();
    const carries = [];
    const periods = vatPeriods();
    for (const entry of entries) {
      const offset = entry.id.startsWith("vat-offset");
      const month = String(entry.date).slice(0, 7);
      const period = periods.get(entry.id) || month;
      for (const line of entry.lines) {
        if (line.account === "190") carries.push([entry.date, line.debit - line.credit]);
        if (offset || (line.account !== "391" && line.account !== "191")) continue;
        const key = line.account === "191" ? period : month;
        const row = months.get(key) || { out: 0, input: 0 };
        if (line.account === "391") row.out += line.credit - line.debit;
        else row.input += line.debit - line.credit;
        months.set(key, row);
      }
    }
    return {
      // 2.5.1 M1: 391 / 191 satırı olan aylar (mahsup fişleri hariç; "KDV İndirim Dönemi" ayıyla) — KDV Özeti'nin hareketli ayları.
      months: () => [...months.keys()],
      of(month) {
        const from = `${month}-01`;
        const row = months.get(month) || { out: 0, input: 0 };
        const carry = carries.reduce((sum, [date, minor]) => (date < from ? sum + minor : sum), 0);
        return { out: row.out, input: row.input, carry: Math.max(0, carry) };
      },
    };
  }
  /**
   * 2.5.0 Ç7b — S4 = A (EK-1 §5, kullanıcı 05.11 18:55: "KDV mahsubundan sonra girilen, indirilecek KDV'yi azaltan kayıt → girildiği ayın mahsubunda"; tasarım notu §2.3): ayın
   * ÖNCESİNDEKİ etkin mahsupların İndirilecek KDV'si için birikmiş fark C = Σ (bugünkü İ − saklı İ). Yalnız AZALTAN kısım (min(0, C)) sonraki mahsuba taşınır; geçmiş ayın saklı
   * mahsubu DEĞİŞMEZ. Artıran fark (geç gelen fatura) bugünkü gibi o ayın "Güncel Değil" uyarısıdır (Geri Al + yeniden). Çift sayım yok: M'nin mahsubu saklı(M) = şimdi(M) + min(0, C)
   * yazdığından M + 1'in birikimi C − min(0, C) = max(0, C) olur.
   */
  function carriedBefore(table, active, month) {
    return active.filter(item => item.month < month).reduce((sum, item) => sum + (table.of(item.month).input - Number(item.inMinor)), 0);
  }
  /**
   * Bir ayın mahsup hesabı — KDV Mahsup Fişi ön izlemesi ve KDV Özeti (2.5.1 M1) AYNI işlevi kullanır (ikinci formül yok): kullanılan devreden (190, ay başına kadar
   * defterden), S4 taşıması, fark o − i − p; artıysa ödenecek (360), eksiyse sonraki aya devreden (190).
   */
  // 2.5.1 M1 tur 2: carryIn verilirse kullanılan devreden odur (KDV Özeti'nin zinciri); verilmezse ay başına kadar defterdeki 190 (ön izleme — davranış AYNEN).
  function monthPosition(table, active, month, carryIn = null) {
    const own = table.of(month);
    // S4 (Ç7b): önceki ayların mahsubundan sonra girilen, indirilecek KDV'yi AZALTAN kayıtlar bu ayın İ'sinden düşer (carried ≤ 0).
    const carried = Math.min(0, carriedBefore(table, active, month));
    const { out } = own;
    const carry = carryIn === null ? own.carry : carryIn;
    const input = own.input + carried;
    const position = out - input - carry;
    return { out, input, carry, carried, position, payable: Math.max(0, position), carryOut: Math.max(0, -position) };
  }
  function monthFigures(entries, month) {
    return figureTable(entries).of(month);
  }
  function linesView(row) {
    const names = { 391: "Hesaplanan KDV", 191: "İndirilecek KDV", 190: "Devreden KDV", 360: "Ödenecek Vergi ve Fonlar" };
    return vatOffsetLines(row).map(line => ({ account: line.account, name: names[line.account] || line.account, debitMinor: line.debit, creditMinor: line.credit }));
  }
  function offsetList() {
    const entries = ledger()?.build ? ledger().build() : [];
    return listOf(figureTable(entries), offsetRows());
  }
  function listOf(table, rows) {
    const active = rows.filter(item => item.status === "active");
    return rows.map(row => {
      const now = table.of(row.month);
      // S4 (Ç7b): İ'nin AZALTAN farkı (önceki ayların taşınmayı bekleyen azalması dahil) uyarı değildir — sonraki mahsuba taşınır; yalnız ARTIRAN fark "Güncel Değil".
      const input = now.input + Math.min(0, carriedBefore(table, active, row.month));
      const stale = row.status === "active" && (now.out !== Number(row.outMinor) || input > Number(row.inMinor));
      return { ...row, label: monthLabel(row.month), lines: linesView(row), stale, ...(stale ? { nowOutMinor: now.out, nowInMinor: input } : {}) };
    });
  }
  /** Ön izleme: ayın tutarları, fişin satırları ve uyarılar (yazım yok). */
  function preview(month) {
    if (!MONTH.test(month)) throw bad(400, "Mahsup edilecek ayı seçin (Yıl-Ay).", "vat-month", { field: "month" });
    const date = monthEnd(month);
    const entries = ledger()?.build ? ledger().build() : [];
    const table = figureTable(entries);
    const offsets = offsetRows();
    const active = offsets.filter(item => item.status === "active");
    const { out, input, carry, carried, position, payable, carryOut } = monthPosition(table, active, month);
    const row = { month, date, outMinor: out, inMinor: input, carryInMinor: carry, carryOutMinor: carryOut, payableMinor: payable };
    const blocks = [];
    const warnings = [];
    const lock = period?.lockedUntil?.() || "";
    if (active.some(item => item.month === month)) blocks.push(`${monthLabel(month)} zaten mahsup edildi. Yeniden yapmak için önce o mahsubu geri alın.`);
    const later = active.filter(item => item.month > month).map(item => monthLabel(item.month));
    if (later.length) blocks.push(`Sonraki ay(lar) mahsup edilmiş (${later.join(", ")}); önceki aya mahsup yapılamaz. Önce sonraki mahsupları (en yeniden başlayarak) geri alın.`);
    if (date > today()) blocks.push(`${monthLabel(month)} henüz bitmedi; mahsup ay sonundan (${dayText(date)}) sonra yapılır.`);
    if (lock && date <= lock) blocks.push(`${monthLabel(month)} kapanmış dönemde (${dayText(lock)} ve öncesi); mahsup fişi yazılamaz.`);
    if (!out && !input && !carry) blocks.push(`${monthLabel(month)} ayında KDV hareketi (391 / 191) ve devreden KDV yok; mahsup edilecek tutar yok.`);
    if (carried < 0) warnings.push(`Önceki ayların mahsubundan sonra girilen, indirilecek KDV'yi azaltan kayıtlar (${tlText(-carried)}) bu ayın İndirilecek KDV'sinden düşüldü.`);
    const prev = previousMonth(month);
    const prevFigures = table.of(prev);
    if ((prevFigures.out || prevFigures.input) && !active.some(item => item.month === prev)) warnings.push(`${monthLabel(prev)} mahsup edilmedi; devreden KDV o ayın mahsubundan gelir. Önce ${monthLabel(prev)} ayını mahsup etmeniz önerilir.`);
    return {
      ...row,
      carriedInMinor: carried,
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

  /**
   * 2.5.1 M1 (S261; kullanıcı 22.11 "orta bulguyu 2.5.1 de düzeltelim"): KDV Özeti'nin okuduğu görünüm — Ana Defter TEK kez kurulur (eski offsetList çağrısı da bir kez
   * kuruyordu; ders 47). position(ay) ön izlemenin AYNI formülüdür (monthPosition); months = 391 / 191 satırı olan aylar; mahsup = etkin mahsup fişi olan aylar; offsets =
   * offsetList() ile aynı liste. Yazım yok, yetki denetimi rapordadır.
   *
   * 2.5.1 M1 tur 2 (S-M1-1 = B; VAT_CARRY_MODE; BAŞ MİMAR KARARLARI 27.11 (1)–(3)): KDV'li aylar (391 / 191 satırı ya da etkin mahsup fişi olan) takvim sırasıyla işlenir; ilk
   * KDV ayından önceki devreden = defterdeki 190'ın o andaki bakiyesi (190'a yalnız KDV Mahsup Fişi yazar — fiş defteri alt defter hesabını reddeder — yani bugün 0). Her ayın
   * farkı monthPosition ile (TEK formül), kullanılan devreden zincirin getirdiği. Mahsupsuz ay, o an sırayla mahsup edilseydi yazılacak sayıdır: devreden yöndeki sonuç sonraki
   * aya taşınır, ödenecek yöndeki taşınmaz; S4 için bu ay mahsup edilmiş sayılır (saklı İ = hesaplanan İ — ön izlemenin yazacağı). Mahsup fişi olan ay: fişin kullandığı
   * devreden zincirinkine EŞİTSE fiş zincirdedir — sonraki aya FİŞİN devredeni taşınır, S4 fişin saklı İ'siyle (bütün aylar sırayla mahsupluysa zincir = defter = ön izleme;
   * "Güncel Değil" ayının devredeni ve S4'ü küçük tur 3–5'te değişti — aşağıda); FARKLIYSA (önceki bir ay atlanıp bu ay mahsup edilmiş) ay zincirle hesaplanır, mismatches'e girer (fişin kullandığı / zincire göre).
   * Hareketsiz ay devredeni aynen taşır (adımı yok).
   *
   * 2.5.1 M1 küçük tur — S-DKM1-1 = A (kullanıcı 27.11 14:18 "önerilerini uygula açık sorulara"): zincirdeki fişin ayının kayıtları fişten SONRA İndirilecek KDV'yi AZALTTIYSA
   * ayın sonucu KESİLMİŞ FİŞTEN (azalma S4 kuralıyla sonraki mahsupta düşülür — bugünkü kayıtlardan hesaplanırsa aynı azalma iki kez sayılırdı). Fiş zincirde sayılmak için
   * devredeninden başka S4 emilimi de zincirinkine eşit olmalı (aynı azalmayı araya giren mahsupsuz ay zincirde zaten düşmüşse fiş kopuktur — dar kontrol L). S-M1-3 = C:
   * fişten sonra ARTIRAN değişiklik (391 değişti ya da İ arttı — programın "Güncel Değil"i) olan ayda sayılar bugünkü kayıtlardan kalır (BİLİNEN SINIR; rapor notu söyler).
   * offsetState: "kept" (fiş = bugünkü hesap), "reduced" (ayın kendi İ'si fişten sonra azaldı; sonuç fişten), "stale" (güncel değil; sonuç bugünkü kayıtlardan),
   * "mixed" (aşağıda).
   *
   * 2.5.1 M1 küçük tur 2 — S-M1K-1 = A (kullanıcı 27.11 16:16 "önerilerini uygula açık sorulara"): fişten sonra aynı ayda hem İndirilecek KDV AZALMIŞ hem satış KDV'si (391)
   * DEĞİŞMİŞSE ("mixed"): İndirilecek KDV FİŞTEN (azalma S4 kuralıyla sonraki mahsupta), 391 BUGÜNKÜ kayıtlardan, devreden fişin (zincirdeki fişte = zincirin) devredeni; her
   * değişiklik bir kez sayılır — bu yüzden sonraki aya bu hesabın devredeni taşınır (fişin eski devredeni taşınsaydı 391 değişimi aralık toplamında kaybolurdu; sonraki ayın
   * fişi eski devredenle kesildiyse o fiş zincirle uyuşmaz, not söyler). Yalnız 391 değişti (İ aynı) ya da İ arttı → S-M1-3 = C ("stale") AYNEN.
   *
   * 2.5.1 M1 küçük tur 3 — S-M1K2-1 = A (kullanıcı 27.11 19:5x "önerini uygula"): fiş DEVREDEN yönde kesilmiş (fişin sonraki döneme devredeni > 0) ve fişten sonra ayda YALNIZ
   * satış KDV'si (391) değişmişse ("stale", İ fişinkine eşit): ayın sayıları S-M1-3 = C gibi bugünkü kayıtlardan, sonraki aya da BU AYIN (bugünkü) devredeni taşınır (her değişiklik
   * bir kez; yön ödenecek yöne dönmüşse 0); sonraki ayın fişi eski devredenle kesildiyse zincirle uyuşmaz, not söyler. Ödenecek yönde kesilmiş fişte (devredeni 0) taşınan
   * devreden fişinki AYNEN (baş mimar okuması: ödenecek yönde davranış DEĞİŞMEZ); İ artan "güncel değil" ayında da fişinki AYNEN (karar yalnız satış KDV'si).
   *
   * 2.5.1 M1 küçük tur 4 — S-M1K3-1 = A (27.11 20:59 UTC; kullanıcının 20:26 yetkisiyle öneri uygulandı): yukarıdaki iki sınır KALKTI — HER "güncel değil" ayında (ödenecek
   * yönde kesilmiş fişte de, İndirilecek KDV'si artan ayda da) sonraki aya BU AYIN bugünkü devredeni taşınır; aralık toplamı her durumda 391 − 191. Ödenecek yönde kalan ayda
   * bugünkü devreden 0 = fişinki (sayılar değişmez).
   *
   * 2.5.1 M1 küçük tur 5 — S-DKM1K-1 = A (28.11 03:55 UTC; kullanıcının 20:26 yetkisiyle öneri uygulandı): "güncel değil" ay S4 birikimine fişin saklı İndirilecek KDV'siyle
   * DEĞİL, mahsupsuz ay gibi bu hesabın (bugünkü) İndirilecek KDV'siyle girer. Küçük tur 4'e kadar saklı İ'yle giriyordu: İ'si ARTMIŞ ayın artışı (bugünkü − saklı > 0) birikime
   * de girip sonraki ayların AZALMASINI götürüyordu — artış hem o ayın sonucunda hem birikimde, azalma hiçbir ayda sayılmıyordu (örnek: Şubat'a fişten sonra alış KDV +300, Mart'ın
   * 200'lük alışı İptal Et → Mart'ın azalması Nisan'da düşülmüyordu; Ocak–Nisan Ödenecek 1.400, 391 − 191 = 1.600). Artık artış bir kez (o ayın bugünkü sonucunda), azalma sonraki
   * ayda (S-DKM1-1 = A): Nisan 700, Ocak–Nisan 1.600. Yalnız 391'i değişen "güncel değil" ayda bugünkü İ = saklı İ (sayılar değişmez). Defter / ön izleme / fiş DEĞİŞMEZ —
   * ön izleme S4'ü etkin fişlerin saklı İ'siyle hesaplar; bu yüzden böyle bir aydan sonraki ayın raporu ön izlemesinden ayrılabilir (karar metni: "Nisan raporu Nisan ön izlemesinden
   * (500) ayrılır"); o ön izlemeyle kesilen fiş zincirle uyuşmaz (S4 emilimi farklı), not söyler.
   *
   * 2.5.1 M1 küçük tur 8 (mali müşavir S ORTA-1; BAŞ MİMAR KARARI 28.11 14:27 — S-DKM1-1 = A "azalma sonraki ayda", S-M1K3-1 = A "aralık toplamı 391 − 191"): zincir yalnız
   * KDV'li aylardan DEĞİL, ilk KDV ayından bugünkü aya kadar (bugünü aşmadan) KAYITSIZ (391 / 191 satırı ve mahsup fişi olmayan) ayları da dolaşır. Kayıtsız ayda S4 birikimi
   * (önceki fişlerden sonra girilen, İndirilecek KDV'yi azaltan kayıtlar) varsa ay zincirde mahsupsuz ay gibi bir adımdır — azalma orada düşülür (o ayın mahsup ön izlemesinin
   * yazacağı sayı); birikim yoksa ay eskisi gibi adımsızdır (devredeni aynen taşır — sayılar değişmez). Önceden kayıtsız ay zincire hiç girmediğinden sonraki fişler azalmadan ÖNCE
   * kesilmişse azalma raporun hiçbir ayında düşülmüyordu (Bu Yıl Ödenecek 1.500, 391 − 191 = 2.000) ve kayıtsız ayın raporu ön izlemesinden ayrılıyordu (0 / 0 / 0 ↔ 0 / 500 / 0).
   * Her adım ayrıca düştüğü azalışı (reducedMinor) ve azalışın geldiği ayları (reducedFrom; S4 birikimine giren azalışlar eski olandan başlayarak) taşır — rapor "Önceki Dönem
   * İndirilecek KDV Azalışı (…)" satırını ve notunu buradan yazar. Düşülen azalış = ayın bugünkü İ'si − zincirde kullanılan İ (fiş sonucu olan ayda fişin saklı İ'si: fiş azalmayı
   * düştüyse artı; zincir hesabı olan ayda −S4). Ön izleme / fiş / defter DEĞİŞMEZ.
   */
  function vatView() {
    const entries = ledger()?.build ? ledger().build() : [];
    const table = figureTable(entries);
    const rows = offsetRows();
    const active = rows.filter(item => item.status === "active");
    const months = table.months().sort();
    const mahsup = new Set(active.map(item => item.month));
    const busy = [...new Set([...months, ...mahsup])].sort();
    // Küçük tur 8: zincirin dolaştığı aylar — KDV'li aylar + ilk KDV ayından bugünkü aya kadar (bugünü aşmadan) kayıtsız aylar (adımları yalnız S4 birikimi varsa).
    const busySet = new Set(busy);
    const span = (() => {
      const nowMonth = today().slice(0, 7);
      if (!busy.length || busy[0] > nowMonth) return busy;
      const list = [];
      for (let month = busy[0]; month <= nowMonth; month = nextMonth(month)) list.push(month);
      return [...new Set([...list, ...busy])].sort();
    })();
    const shape = (month, { out, input, carry, carried, payable, carryOut }) => ({ month, label: monthLabel(month), outMinor: out, inMinor: input, carryInMinor: carry, carriedInMinor: carried, payableMinor: payable, carryOutMinor: carryOut });
    /**
     * Fişi kullanılan (zincirdeki) ayın sonucu (S-DKM1-1 = A, S-M1-3 = C). step = bugünkü kayıtlarla aynı devredenle hesap. Güncel değilse (391 farklı ya da İ fişten büyük)
     * bugünkü hesap; değilse fişin sayıları — İ fişten küçükse (azaltan fark) sonuç yine fişten, fark sonraki mahsupta. "reduced" yalnız ayın KENDİ İ'si fişin saklı İ'sinden
     * küçükse (saklı İ = o anki İ + S4 taşıması ≤ o anki İ; bu yüzden kesin): önceki ayların azalması bu ayın kaydı değişmiş gibi yazılmaz.
     */
    const settle = (month, step, offset) => {
      const storedIn = Number(offset.inMinor);
      if (step.input > storedIn || (step.out !== Number(offset.outMinor) && step.input === storedIn)) return { ...shape(month, step), offsetState: "stale" };
      if (step.out !== Number(offset.outMinor)) {
        // S-M1K-1 = A: İ fişten (azalan kısım sonraki mahsupta), 391 bugünkü kayıtlardan, devreden fişin (zincirdeki fişte = zincirin) devredeni.
        const carryIn = Number(offset.carryInMinor);
        const position = step.out - storedIn - carryIn;
        return { month, label: monthLabel(month), outMinor: step.out, inMinor: storedIn, carryInMinor: carryIn, carriedInMinor: step.carried, payableMinor: Math.max(0, position), carryOutMinor: Math.max(0, -position), offsetState: "mixed" };
      }
      return {
        month,
        label: monthLabel(month),
        outMinor: Number(offset.outMinor),
        inMinor: Number(offset.inMinor),
        carryInMinor: Number(offset.carryInMinor),
        carriedInMinor: step.carried,
        payableMinor: Number(offset.payableMinor),
        carryOutMinor: Number(offset.carryOutMinor),
        offsetState: table.of(month).input < Number(offset.inMinor) ? "reduced" : "kept",
      };
    };
    const chain = VAT_CARRY_MODE === "chain";
    const openingMinor = chain && busy.length ? table.of(busy[0]).carry : 0;
    const fis = new Map(active.map(item => [item.month, item]));
    /**
     * Zincir (B kipi). freeze (2.5.1 M1 küçük tur 6 — yalnız rapor notu için): verilen aylardaki fiş OLDUĞU GİBİ alınır (sayıları, devredeni ve saklı İ'si — mahsup ön izlemesinin
     * okuduğu); "Güncel Olmayan Önceki Fiş" notu aralığın sayısının bu karşı hesaptan ayrılıp ayrılmadığına bakar. freeze'siz zincir raporun sayılarıdır (DEĞİŞMEDİ).
     */
    const runChain = (freeze = null) => {
      const steps = new Map();
      const mismatches = [];
      const done = [];
      // Küçük tur 8: S4 birikimine giren azalışlar (ay, kuruş) — eski olandan başlayarak düşülür; adımın reducedFrom'u düşülen azalışların ayları.
      const owed = [];
      const absorb = (month, inMinor) => {
        const diff = table.of(month).input - inMinor;
        if (diff < 0) owed.push({ month, minor: -diff });
        const parts = [];
        let rest = Math.max(0, diff);
        while (rest > 0 && owed.length) {
          const take = Math.min(rest, owed[0].minor);
          const same = parts.find(part => part.month === owed[0].month);
          if (same) same.minor += take;
          else parts.push({ month: owed[0].month, minor: take });
          owed[0].minor -= take;
          rest -= take;
          if (!owed[0].minor) owed.shift();
        }
        done.push({ month, inMinor });
        return { reducedMinor: Math.max(0, diff), reducedFrom: parts.map(part => part.month), reducedParts: parts };
      };
      let carry = openingMinor;
      for (const month of span) {
        const step = monthPosition(table, done, month, carry);
        // Kayıtsız ay (küçük tur 8): S4 birikimi yoksa adımı yok (devreden aynen taşınır); varsa mahsupsuz ay gibi hesaplanır, azalma burada düşülür.
        if (!busySet.has(month) && step.carried >= 0) continue;
        const offset = fis.get(month);
        if (offset && freeze?.has(month)) {
          const outMinor = Number(offset.outMinor);
          const taken = absorb(month, Number(offset.inMinor));
          steps.set(month, { month, label: monthLabel(month), outMinor, inMinor: Number(offset.inMinor), carryInMinor: Number(offset.carryInMinor), carriedInMinor: step.carried, payableMinor: Number(offset.payableMinor), carryOutMinor: Number(offset.carryOutMinor), offsetState: "kept", carryAfterMinor: Number(offset.carryOutMinor), ...taken });
          carry = Number(offset.carryOutMinor);
          continue;
        }
        // Fiş zincirde: devredeni zincirinkine eşit VE S4 emilimi (fişin kesildiği defter sırasıyla = etkin fişlere göre) zincirinkine eşit.
        const offsetCarried = offset ? Math.min(0, carriedBefore(table, active, month)) : 0;
        const kept = Boolean(offset) && Number(offset.carryInMinor) === carry && offsetCarried === step.carried;
        const settled = kept ? settle(month, step, offset) : shape(month, step);
        // Zincirdeki fişin devredeni taşınır ("kept" / "reduced" — S-DKM1-1 = A); karma ayda (S-M1K-1 = A) ve HER "güncel değil" ayında (S-M1K2-1 = A, S-M1K3-1 = A) bu ayın
        // hesabının (bugünkü) devredeni — her değişiklik bir kez.
        const recount = kept && (settled.offsetState === "mixed" || settled.offsetState === "stale");
        const next = !kept ? step.carryOut : recount ? settled.carryOutMinor : Number(offset.carryOutMinor);
        if (offset && !kept) {
          // 2.5.1 M1 küçük tur 6 (KDV tur 5 dar kontrolü ORTA-1; baş mimar kararı 28.11 07:40 (1)(a)): uyuşmazlığın YÖNÜ. Devredeni aynı ve zincirin S4 emilimi fişinkinden EKSİYSE
          // (önceki "güncel değil" ay zincire bugünkü İ'siyle girdi — S-DKM1K-1 = A) fiş İndirilecek KDV'deki azalmayı düşmemiştir; onarım mahsup fişi güncel olmayan İLK aydan
          // ("güncel değil" / karma / zincirle uyuşmayan fiş; hiçbiri yoksa bu ay) başlar. Öbür yön (araya giren mahsupsuz ay azalmayı zincirde zaten düştü) AYNEN; devreden farkı aşağıda.
          // 2.5.1 M1 küçük tur 7 (tur 6 raporunun BAŞ MİMAR KARARI (1), 28.11 08:49): DEVREDEN FARKI kolunda da (fiş başka devredenle kesilmiş) önceki aylarda mahsup fişi güncel
          // olmayan ay varsa onarım o İLK aydan başlar — önceki ay devreden yönde güncel değilken yalnız bu ayı ve sonrakileri yeniden kesmek ön izlemeyi yine defterdeki eski
          // devredenle bırakır, not kalır. Önceki güncel olmayan fiş yoksa devreden farkında onarım ayı boş (notun cümlesi AYNEN). Öbür yön (dar kontrol L) AYNEN.
          const absorbShort = Number(offset.carryInMinor) === carry && step.carried < offsetCarried;
          const carryGap = Number(offset.carryInMinor) !== carry;
          const firstStale = [...steps.values()].find(item => item.offsetState === "stale" || item.offsetState === "mixed" || mismatches.some(other => other.month === item.month))?.month || "";
          const restart = absorbShort ? firstStale || month : carryGap ? firstStale : "";
          mismatches.push({ month, label: monthLabel(month), usedMinor: Number(offset.carryInMinor), chainMinor: carry, offsetPayableMinor: Number(offset.payableMinor), offsetCarryOutMinor: Number(offset.carryOutMinor), payableMinor: step.payable, carryOutMinor: step.carryOut, absorbShort, restartMonth: restart, restartLabel: restart ? monthLabel(restart) : "" });
        }
        // S4 birikimi: zincirdeki fişin saklı İ'si ("kept" / "reduced" / "mixed" — azalma sonraki mahsupta); "güncel değil" ay ve zincir dışı ay bugünkü hesabın İ'siyle
        // (S-DKM1K-1 = A — İ artışı birikime girip sonraki azalmayı götürmez; her değişiklik bir kez).
        const taken = absorb(month, kept && settled.offsetState !== "stale" ? Number(offset.inMinor) : step.input);
        steps.set(month, { ...settled, carryAfterMinor: next, ...taken });
        carry = next;
      }
      return { steps, mismatches };
    };
    const { steps, mismatches } = chain ? runChain() : { steps: new Map(), mismatches: [] };
    /** Zincirde ayın sonucu; hareketsiz ay / aralık başı: önceki adımın (KDV'li ay ya da azalış düşülen kayıtsız ay) taşıdığı devreden, ilk KDV ayından önce defterdeki 190. */
    const positionIn = (map, month) => {
      if (map.has(month)) return map.get(month);
      let previous = null;
      for (const [key, item] of map) {
        if (key >= month) break;
        previous = item;
      }
      const carry = previous ? previous.carryAfterMinor : table.of(month).carry;
      return { month, label: monthLabel(month), outMinor: 0, inMinor: 0, carryInMinor: carry, carriedInMinor: 0, payableMinor: 0, carryOutMinor: carry, carryAfterMinor: carry, reducedMinor: 0, reducedFrom: [], reducedParts: [] };
    };
    // Küçük tur 8: sonucu olan aylar (zincirde adımı olanlar — KDV'li aylar + azalış düşülen kayıtsız aylar; A kipinde KDV'li aylar).
    const resultMonths = chain ? [...steps.keys()] : busy;
    return {
      mode: chain ? "chain" : "ledger",
      position(month) {
        if (!chain) {
          // A kipi (tur 1): devreden defterdeki 190; fişi defterin devredeniyle kesilmiş ayda aynı S-DKM1-1 / S-M1-3 kuralı.
          const step = monthPosition(table, active, month);
          const offset = fis.get(month);
          return offset && Number(offset.carryInMinor) === step.carry ? settle(month, step, offset) : shape(month, step);
        }
        return positionIn(steps, month);
      },
      /** Başı olmayan aralığın (Tüm Zamanlar) Önceki Dönemden Devreden'i: B'de ilk KDV ayından önceki 190 (açılış devredeni), A'da 0 (tur 1). */
      openingMinor,
      /**
       * Mahsup Edilmemiş Ay (aralık [first, last], YYYY-AA; boş = sınırsız). A (tur 1): aralıktan önceki ay (KDV'li ve mahsupsuzsa — ön izlemenin uyarısıyla aynı) + aralıkta son
       * KDV'li aydan önceki mahsupsuz aylar. B: aralığın sayılarını etkileyen BÜTÜN mahsupsuz KDV'li aylar — aralıktaki son KDV'li aydan (aralıkta yoksa aralığın başından) önce.
       */
      pending(first, last) {
        const inRange = resultMonths.filter(month => (!first || month >= first) && (!last || month <= last));
        if (!chain) {
          const before = first ? previousMonth(first) : "";
          return [...(before && months.includes(before) && !mahsup.has(before) ? [before] : []), ...inRange.slice(0, -1).filter(month => !mahsup.has(month))];
        }
        const cutoff = inRange.length ? inRange[inRange.length - 1] : first;
        return cutoff ? resultMonths.filter(month => month < cutoff && !mahsup.has(month)) : [];
      },
      /** B: zincirle uyuşmayan mahsup fişleri, aralığın sonuna kadar (aralığın sayılarını etkileyenler). A'da boş. */
      mismatchesUntil: last => mismatches.filter(item => !last || item.month <= last),
      /**
       * 2.5.1 M1 küçük tur 6 (baş mimar kararı 28.11 07:40 (1)(b)): aralığın BAŞINDAN önceki "güncel değil" / karma fişler (aralıkta değiller, kendi notları raporda görünmez)
       * aralığın sayısını ETKİLİYORSA o ayların listesi. Karşı hesap: o fişler olduğu gibi alınsaydı (ön izlemenin okuduğu) aralığın başındaki devreden ve aralıktaki ayların Ödenecek /
       * Sonraki'si aynı mı; aynıysa boş (gereksiz not yok). Başı olmayan aralıkta (Tüm Zamanlar) ve A kipinde boş. Bellekte ikinci zincir; yeni sorgu yok (ders 47).
       */
      staleBefore(first, last) {
        if (!chain || !first) return [];
        const before = resultMonths.filter(month => month < first && (steps.get(month).offsetState === "stale" || steps.get(month).offsetState === "mixed"));
        if (!before.length) return [];
        const alt = runChain(new Set(before)).steps;
        const same = [first, ...resultMonths.filter(month => month >= first && (!last || month <= last))].every(month => {
          const now = positionIn(steps, month);
          const asIs = positionIn(alt, month);
          return now.carryInMinor === asIs.carryInMinor && now.payableMinor === asIs.payableMinor && now.carryOutMinor === asIs.carryOutMinor;
        });
        return same ? [] : before;
      },
      months,
      mahsup,
      resultMonths,
      offsets: listOf(table, rows),
    };
  }

  return { balances, offsetList, vatView, monthLabel };
}
