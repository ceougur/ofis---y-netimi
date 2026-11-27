// 2.5.0 Ç5-A tur 1 — eski sürüm (≤ 2.4.9) mizanının 2.5.0-defter kuralındaki karşılığı (G3: docs/erp/C5-ACILIS-TASARIM.md §2.2 + §11; KG-1, M-01 … M-07, S47).
// YALNIZ açılışları 500'de olan ve Excel taksit kartı / açılış portföyü / carisiz evrak İÇERMEYEN eski veri için: 2.4.9'un 500'ü (Kasa, cari, banka, kart / kredi, stok
// açılışları ve "Açılış…" açıklamalı eski Borç / Alacak Yaz — göç 48'de aday, onaya kadar 519, S47) yeni kuralda AYNEN 519'dur; öbür hesaplar değişmez. Bu dönüşüm
// programın kodundan değil karar metninden (açılış karşı hesabı 519; 500 yalnız Açılış Eşleştirme Fişi). KG-5 / açılış evrakı / S49 içeren veride kullanılmaz (o farklar
// kural kimliğiyle ayrıca yazılır).
const NAME_519 = "Eşleştirilecek Açılış Bakiyeleri";

/**
 * KG-5 (KULLANICI KG-5 = A, H-06; C5-ACILIS-TASARIM §2.2): eski sürümde yüklenen (Excel / tablo) kartın defteri iki madde idi — B CH T / A 602 T (kart) + B 500 P / A CH P
 * (her "Excel'de ödenmiş (açılış)" satırı); 2.5.0-defter'de TEK madde B CH (T − P) / A 519, P maddesiz. Eski mizanı (GET ledger `trial`, TL) ve yevmiye madde sayısını yeni
 * kurala çevirir; kartların T / P değerleri veri tabanından (plans, plan_entries) — programın türetmesinden değil. Kart tarihi (yükleme günü) bütün zaman mizanını değiştirmez.
 */
export function trialKg5As250Defter(trial, entryCount, store) {
  const c = value => Math.round((Number(value) || 0) * 100);
  const rows = new Map(trial.accounts.map(row => [row.code, { ...row, opening: c(row.opening), debit: c(row.debit), credit: c(row.credit), balance: c(row.balance) }]));
  const row = code => rows.get(code) || rows.set(code, { code, name: code === "519" ? NAME_519 : code, opening: 0, debit: 0, credit: 0, balance: 0 }).get(code);
  const totals = { debit: c(trial.totals.debit), credit: c(trial.totals.credit) };
  let entries = entryCount;
  const cards = store.all(
    `SELECT p.total, a.type, (SELECT COUNT(*) FROM plan_entries e WHERE e.plan_id = p.id AND e.kind = 'in' AND e.opening = 1) AS n,
            COALESCE((SELECT SUM(e.amount) FROM plan_entries e WHERE e.plan_id = p.id AND e.kind = 'in' AND e.opening = 1), 0) AS paid
     FROM plans p LEFT JOIN accounts a ON a.id = p.account_id AND a.deleted_at IS NULL WHERE p.deleted_at IS NULL AND p.import_id <> '' AND NOT p.covers_balance`,
  );
  for (const card of cards) {
    const control = { customer: "120", supplier: "320", other: "336" }[card.type] || (card.type ? "120" : "127");
    const T = c(card.total);
    const P = c(card.paid);
    // eski: B CH T / A 602 T ; B 500 P / A CH P  →  yeni: B CH (T − P) / A 519 (T − P)
    row("602").credit -= T;
    row("602").balance += T;
    row("500").debit -= P;
    row("500").balance -= P;
    row(control).debit -= P;
    row(control).credit -= P;
    row("519").credit += T - P;
    row("519").balance -= T - P;
    totals.debit += T - P - T - P;
    totals.credit += T - P - T - P;
    entries -= Number(card.n) + (T - P > 0 ? 0 : 1);
  }
  const tl = value => Math.round(value) / 100;
  const accounts = [...rows.values()]
    .filter(item => item.debit || item.credit || item.opening || item.balance)
    .sort((a, b) => a.code.localeCompare(b.code))
    .map(item => ({ ...item, opening: tl(item.opening), debit: tl(item.debit), credit: tl(item.credit), balance: tl(item.balance) }));
  return { trial: { ...trial, accounts, totals: { ...trial.totals, debit: tl(totals.debit), credit: tl(totals.credit) } }, entryCount: entries };
}

/** trialBalance / GET ledger `trial` biçimi: { accounts: [{ code, name, opening, debit, credit, balance }], totals, balanced, unbalanced } → 500 satırı 519 olur. */
export function trialAs250Defter(trial) {
  if (!trial?.accounts) return trial;
  const accounts = trial.accounts.map(row => (row.code === "500" ? { ...row, code: "519", name: NAME_519 } : row)).sort((a, b) => a.code.localeCompare(b.code));
  return { ...trial, accounts };
}
