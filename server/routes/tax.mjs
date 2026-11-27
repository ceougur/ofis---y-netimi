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
   * devreden zincirinkine EŞİTSE fiş zincirdedir — sonraki aya FİŞİN devredeni taşınır, S4 fişin saklı İ'siyle (bütün aylar sırayla mahsupluysa zincir = defter = ön izleme,
   * S4 / "Güncel Değil" aylarında da); FARKLIYSA (önceki bir ay atlanıp bu ay mahsup edilmiş) ay zincirle hesaplanır, mismatches'e girer (fişin kullandığı / zincire göre).
   * Hareketsiz ay devredeni aynen taşır (adımı yok).
   *
   * 2.5.1 M1 küçük tur — S-DKM1-1 = A (kullanıcı 27.11 14:18 "önerilerini uygula açık sorulara"): zincirdeki fişin ayının kayıtları fişten SONRA İndirilecek KDV'yi AZALTTIYSA
   * ayın sonucu KESİLMİŞ FİŞTEN (azalma S4 kuralıyla sonraki mahsupta düşülür — bugünkü kayıtlardan hesaplanırsa aynı azalma iki kez sayılırdı). Fiş zincirde sayılmak için
   * devredeninden başka S4 emilimi de zincirinkine eşit olmalı (aynı azalmayı araya giren mahsupsuz ay zincirde zaten düşmüşse fiş kopuktur — dar kontrol L). S-M1-3 = C:
   * fişten sonra ARTIRAN değişiklik (391 değişti ya da İ arttı — programın "Güncel Değil"i) olan ayda sayılar bugünkü kayıtlardan kalır (BİLİNEN SINIR; rapor notu söyler).
   * offsetState: "kept" (fiş = bugünkü hesap), "reduced" (ayın kendi İ'si fişten sonra azaldı; sonuç fişten), "stale" (güncel değil; sonuç bugünkü kayıtlardan).
   */
  function vatView() {
    const entries = ledger()?.build ? ledger().build() : [];
    const table = figureTable(entries);
    const rows = offsetRows();
    const active = rows.filter(item => item.status === "active");
    const months = table.months().sort();
    const mahsup = new Set(active.map(item => item.month));
    const busy = [...new Set([...months, ...mahsup])].sort();
    const shape = (month, { out, input, carry, carried, payable, carryOut }) => ({ month, label: monthLabel(month), outMinor: out, inMinor: input, carryInMinor: carry, carriedInMinor: carried, payableMinor: payable, carryOutMinor: carryOut });
    /**
     * Fişi kullanılan (zincirdeki) ayın sonucu (S-DKM1-1 = A, S-M1-3 = C). step = bugünkü kayıtlarla aynı devredenle hesap. Güncel değilse (391 farklı ya da İ fişten büyük)
     * bugünkü hesap; değilse fişin sayıları — İ fişten küçükse (azaltan fark) sonuç yine fişten, fark sonraki mahsupta. "reduced" yalnız ayın KENDİ İ'si fişin saklı İ'sinden
     * küçükse (saklı İ = o anki İ + S4 taşıması ≤ o anki İ; bu yüzden kesin): önceki ayların azalması bu ayın kaydı değişmiş gibi yazılmaz.
     */
    const settle = (month, step, offset) => {
      if (step.out !== Number(offset.outMinor) || step.input > Number(offset.inMinor)) return { ...shape(month, step), offsetState: "stale" };
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
    const steps = new Map();
    const mismatches = [];
    const openingMinor = chain && busy.length ? table.of(busy[0]).carry : 0;
    const fis = new Map(active.map(item => [item.month, item]));
    if (chain) {
      const done = [];
      let carry = openingMinor;
      for (const month of busy) {
        const step = monthPosition(table, done, month, carry);
        const offset = fis.get(month);
        // Fiş zincirde: devredeni zincirinkine eşit VE S4 emilimi (fişin kesildiği defter sırasıyla = etkin fişlere göre) zincirinkine eşit.
        const kept = Boolean(offset) && Number(offset.carryInMinor) === carry && Math.min(0, carriedBefore(table, active, month)) === step.carried;
        const next = kept ? Number(offset.carryOutMinor) : step.carryOut;
        steps.set(month, { ...(kept ? settle(month, step, offset) : shape(month, step)), carryAfterMinor: next });
        if (offset && !kept) {
          mismatches.push({ month, label: monthLabel(month), usedMinor: Number(offset.carryInMinor), chainMinor: carry, offsetPayableMinor: Number(offset.payableMinor), offsetCarryOutMinor: Number(offset.carryOutMinor), payableMinor: step.payable, carryOutMinor: step.carryOut });
        }
        done.push({ month, inMinor: kept ? Number(offset.inMinor) : step.input });
        carry = next;
      }
    }
    /** Zincirde ayın başındaki devreden (hareketsiz ay / aralık başı): önceki KDV'li ayın taşıdığı; ilk KDV ayından önce defterdeki 190. */
    const carryAt = month => {
      const before = busy.filter(item => item < month);
      return before.length ? steps.get(before[before.length - 1]).carryAfterMinor : table.of(month).carry;
    };
    return {
      mode: chain ? "chain" : "ledger",
      position(month) {
        if (!chain) {
          // A kipi (tur 1): devreden defterdeki 190; fişi defterin devredeniyle kesilmiş ayda aynı S-DKM1-1 / S-M1-3 kuralı.
          const step = monthPosition(table, active, month);
          const offset = fis.get(month);
          return offset && Number(offset.carryInMinor) === step.carry ? settle(month, step, offset) : shape(month, step);
        }
        if (steps.has(month)) return steps.get(month);
        const carry = carryAt(month);
        return { month, label: monthLabel(month), outMinor: 0, inMinor: 0, carryInMinor: carry, carriedInMinor: 0, payableMinor: 0, carryOutMinor: carry, carryAfterMinor: carry };
      },
      /** Başı olmayan aralığın (Tüm Zamanlar) Önceki Dönemden Devreden'i: B'de ilk KDV ayından önceki 190 (açılış devredeni), A'da 0 (tur 1). */
      openingMinor,
      /**
       * Mahsup Edilmemiş Ay (aralık [first, last], YYYY-AA; boş = sınırsız). A (tur 1): aralıktan önceki ay (KDV'li ve mahsupsuzsa — ön izlemenin uyarısıyla aynı) + aralıkta son
       * KDV'li aydan önceki mahsupsuz aylar. B: aralığın sayılarını etkileyen BÜTÜN mahsupsuz KDV'li aylar — aralıktaki son KDV'li aydan (aralıkta yoksa aralığın başından) önce.
       */
      pending(first, last) {
        const inRange = busy.filter(month => (!first || month >= first) && (!last || month <= last));
        if (!chain) {
          const before = first ? previousMonth(first) : "";
          return [...(before && months.includes(before) && !mahsup.has(before) ? [before] : []), ...inRange.slice(0, -1).filter(month => !mahsup.has(month))];
        }
        const cutoff = inRange.length ? inRange[inRange.length - 1] : first;
        return cutoff ? busy.filter(month => month < cutoff && !mahsup.has(month)) : [];
      },
      /** B: zincirle uyuşmayan mahsup fişleri, aralığın sonuna kadar (aralığın sayılarını etkileyenler). A'da boş. */
      mismatchesUntil: last => mismatches.filter(item => !last || item.month <= last),
      months,
      mahsup,
      offsets: listOf(table, rows),
    };
  }

  return { balances, offsetList, vatView, monthLabel };
}
