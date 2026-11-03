// 2.4.9 C1 — "hareketi olan cari silinemez" (docs/2.4.9-tasarim/C1-hareketli-cari.md §2–§3, §13). Kullanıcı kararları (03.11.2026):
//   KARAR ~11:45 A: hareketi olan cari silinmez, program "Pasife Al" önerir; hiç hareketi olmayan (yanlış açılmış) cari silinir; daha önce silinmiş
//   cariler Silinenler'den geri yüklenebilir kalır.
//   İLKE ~11:50: hareket = cariye bağlı HER PARASAL İŞLEM (tahsilat/ödeme, Borç/Alacak Yaz, açılış bakiyesi, stok hareketinin cari satırı, taksit kartı ve
//   tahsilatları, çek/senet, fatura — taslak/iptal dahil —, mahsup, iade); not, WhatsApp gönderim izi, değişiklik geçmişi hareket DEĞİL.
//   S1 A: Silinenler'deki (silinmiş) kayıt hareket sayılmaz — yalnız kalıcı silmede (includeDeleted) sayılır (§11 Y2).
//   S2 A: tutarı sıfır kayıt (kalemsiz taksit kartı, 0,00 TL'lik taslak) hareket sayılır.
// TEK TANIM: cari silme (routes/accounts.mjs deleteBlock — kart açılışı ve DELETE aynı) ve Taksit aktarımını Geri Al'ın kalıcı silmesi
// (routes/plan-transfer.mjs) bu fonksiyonu çağırır; ikinci bir "hareket" sorgusu yazılmaz (ders 10).
// Hız (ders 47): tek SQL, her alt sorgu indeksli (account_entries(account_id…), invoices(account_id…), invoice_offsets(account_id), plans(account_id),
// cheques(account_id) + endorse_account_id taraması (bugünkü sayımla aynı), doubtful_receivables(account_id…), fin_events(party_id…) + bank_lines(event_id) /
// pos_sales(event_id) — ikincisi yalnız carinin taraf olduğu modülsüz fiş varsa). Silinenler'in JSON taraması yalnız includeDeleted (nadir kalıcı silme)
// yolunda; toplu kalıcı silme openTrashAccounts ile bir kez tarar.

const TABLES = ["account_entries", "invoices", "invoice_offsets", "plans", "cheques", "doubtful_receivables", "fin_events", "bank_lines", "pos_sales", "trash"];
const TABLE_SQL = `SELECT name FROM sqlite_master WHERE type = 'table' AND name IN (${TABLES.map(() => "?").join(", ")})`;

// Ekranda gösterilen sıra (yalnız sıfırdan büyükler).
const PARTS = [
  ["entries", "cari hareketi"],
  ["stock", "stok hareketi"],
  ["invoices", "fatura / makbuz (taslak ve iptal dahil)"],
  ["offsets", "mahsup"],
  ["plans", "taksit kartı"],
  ["cheques", "çek / senet"],
  ["doubtful", "şüpheli alacak kaydı"],
  ["vouchers", "banka fişi"],
];

// H14 (İLKEYLE; not §2): carinin tarafı olduğu, modül satırı olmayan banka fişi (src_table '') — tutarı fiş satırında (bank_lines) ya da POS kaydında
// (pos_sales.event_id: POS İptal İadesi fişinin tutarı satırda değil iade kaydındadır — pos.mjs cancelRefund; fatura silinince carinin başka izi kalmaz).
// Satırsız ve POS kaydısız başlık (iptal edilmiş modül kopyası, KDV'li masraf fişinin başlığı — tutarı faturasında) tutar taşımaz → sayılmaz.
function vouchersSql(have) {
  if (!have.has("fin_events")) return "0";
  const carriers = [
    have.has("bank_lines") ? "EXISTS (SELECT 1 FROM bank_lines l WHERE l.event_id = e.id)" : "",
    have.has("pos_sales") ? "EXISTS (SELECT 1 FROM pos_sales s WHERE s.event_id = e.id)" : "",
  ].filter(Boolean);
  return carriers.length ? `(SELECT COUNT(*) FROM fin_events e WHERE e.party_id = ?1 AND +e.src_table = '' AND (${carriers.join(" OR ")}))` : "0";
}

// Açık Silinenler öğesinin taşıdığı cari: cari hareketi / stok hareketi / şüpheli alacak yükünde accountId, fatura yükünde invoice.account_id.
const TRASH_MATCH = "(json_extract(payload_json, '$.accountId') = ?1 OR json_extract(payload_json, '$.invoice.account_id') = ?1)";
/**
 * Toplu kalıcı silme için (ders 47: cari başına Silinenler'in JSON taraması yok): açık Silinenler öğelerinin carilere göre sayısı, TEK geçişte.
 * accountMovements(…, { includeDeleted: true, trashIndex }) ile verilir; kural TRASH_MATCH ile aynıdır (öğe bir cariye bir kez sayılır).
 */
export function openTrashAccounts(store) {
  const index = new Map();
  if (!store.get("SELECT 1 AS found FROM sqlite_master WHERE type = 'table' AND name = 'trash'")) return index;
  for (const row of store.all("SELECT json_extract(payload_json, '$.accountId') AS a, json_extract(payload_json, '$.invoice.account_id') AS b FROM trash WHERE restored_at IS NULL")) {
    for (const id of new Set([row.a, row.b].filter(value => typeof value === "string" && value))) index.set(id, (index.get(id) || 0) + 1);
  }
  return index;
}

/**
 * Carinin hareketleri. Dönüş: { total, counts: { entries, stock, invoices, offsets, plans, cheques, doubtful, vouchers }, deleted? }.
 * total > 0 → cari hareketlidir (silinmez). Tablo yoksa (göç öncesi test kurgusu) o sayaç 0.
 * entries: elle cari satırı (tahsilat/ödeme, Borç/Alacak Yaz, açılış) + banka kaynaklı satır + kaynağı bulunamayan (yetim) satır.
 * includeDeleted (yalnız kalıcı silme): silinmiş taksit kartı ve çek/senet, iptal edilmiş şüpheli kaydı ve bu cariyi taşıyan açık Silinenler öğesi
 * (cari hareketi, fatura, stok hareketi, şüpheli alacak) da sayılır — geri dönüşsüz silmede bağlı iz yetim kalmasın (§11 Y2). trashIndex: openTrashAccounts.
 */
export function accountMovements(store, accountId, { includeDeleted = false, trashIndex = null } = {}) {
  const id = String(accountId || "");
  const have = new Set(store.all(TABLE_SQL, ...TABLES).map(row => row.name));
  const zero = { entries: 0, stock: 0, invoices: 0, offsets: 0, plans: 0, cheques: 0, doubtful: 0, vouchers: 0 };
  if (!id) return { total: 0, counts: zero, ...(includeDeleted ? { deleted: { plans: 0, cheques: 0, doubtful: 0, trash: 0 } } : {}) };
  const count = (table, sql) => (have.has(table) ? `(${sql})` : "0");
  // Kaynağı başka sayaçta sayılan cari satırı (fatura, çek/senet, şüpheli alacak); kalanı (kaynağı yok) "cari hareketi"ne eklenir.
  const linked = [
    have.has("invoices") ? "(e.source = 'invoice' AND EXISTS (SELECT 1 FROM invoices i WHERE i.id = e.source_id AND i.account_id = ?1))" : "",
    have.has("cheques") ? "(e.source = 'cheque' AND EXISTS (SELECT 1 FROM cheques c WHERE c.id = e.source_id AND c.deleted_at IS NULL AND (c.account_id = ?1 OR c.endorse_account_id = ?1)))" : "",
    have.has("doubtful_receivables") ? "(e.source = 'doubtful' AND EXISTS (SELECT 1 FROM doubtful_receivables d WHERE d.id = e.source_id AND d.account_id = ?1 AND d.status <> 'cancelled'))" : "",
  ].filter(Boolean);
  const columns = [
    `${count("account_entries", "SELECT COUNT(*) FROM account_entries WHERE account_id = ?1")} AS allEntries`,
    `${count("account_entries", "SELECT COUNT(*) FROM account_entries WHERE account_id = ?1 AND source = 'stock'")} AS stock`,
    `${linked.length ? count("account_entries", `SELECT COUNT(*) FROM account_entries e WHERE e.account_id = ?1 AND (${linked.join(" OR ")})`) : "0"} AS linkedEntries`,
    `${count("invoices", "SELECT COUNT(*) FROM invoices WHERE account_id = ?1")} AS invoices`,
    `${count("invoice_offsets", "SELECT COUNT(*) FROM invoice_offsets WHERE account_id = ?1")} AS offsets`,
    `${count("plans", "SELECT COUNT(*) FROM plans WHERE account_id = ?1 AND deleted_at IS NULL")} AS plans`,
    `${count("cheques", "SELECT COUNT(*) FROM cheques WHERE deleted_at IS NULL AND (account_id = ?1 OR endorse_account_id = ?1)")} AS cheques`,
    `${count("doubtful_receivables", "SELECT COUNT(*) FROM doubtful_receivables WHERE account_id = ?1 AND status <> 'cancelled'")} AS doubtful`,
    `${vouchersSql(have)} AS vouchers`,
  ];
  if (includeDeleted) {
    columns.push(
      `${count("plans", "SELECT COUNT(*) FROM plans WHERE account_id = ?1 AND deleted_at IS NOT NULL")} AS deletedPlans`,
      `${count("cheques", "SELECT COUNT(*) FROM cheques WHERE deleted_at IS NOT NULL AND (account_id = ?1 OR endorse_account_id = ?1)")} AS deletedCheques`,
      `${count("doubtful_receivables", "SELECT COUNT(*) FROM doubtful_receivables WHERE account_id = ?1 AND status = 'cancelled'")} AS cancelledDoubtful`,
      `${trashIndex ? "0" : count("trash", `SELECT COUNT(*) FROM trash WHERE restored_at IS NULL AND ${TRASH_MATCH}`)} AS trashItems`,
    );
  }
  const row = store.get(`SELECT ${columns.join(", ")}`, id);
  const n = key => Number(row?.[key]) || 0;
  const allEntries = n("allEntries");
  const counts = {
    // Kaynağı olan fatura / çek / şüpheli satırı kendi sayacında; stok satırı ayrı; kalan her satır (elle, banka, yetim) cari hareketidir.
    entries: Math.max(0, allEntries - n("stock") - n("linkedEntries")),
    stock: n("stock"),
    invoices: n("invoices"),
    offsets: n("offsets"),
    plans: n("plans"),
    cheques: n("cheques"),
    doubtful: n("doubtful"),
    vouchers: n("vouchers"),
  };
  // total cari satırlarını bir kez sayar (allEntries): kaynağı sayılan satır fatura / çek / şüpheliyle birlikte gelse de en az bir hareket demektir.
  const live = allEntries + counts.invoices + counts.offsets + counts.plans + counts.cheques + counts.doubtful + counts.vouchers;
  if (!includeDeleted) return { total: live, counts };
  const deleted = { plans: n("deletedPlans"), cheques: n("deletedCheques"), doubtful: n("cancelledDoubtful"), trash: trashIndex ? Number(trashIndex.get(id)) || 0 : n("trashItems") };
  return { total: live + deleted.plans + deleted.cheques + deleted.doubtful + deleted.trash, counts, deleted };
}

/** Sayaçların ekrandaki parçası: "3 cari hareketi, 1 fatura / makbuz (taslak ve iptal dahil), 1 taksit kartı" (yalnız sıfırdan büyükler). */
export function movementText(counts = {}) {
  return PARTS.filter(([key]) => Number(counts[key]) > 0)
    .map(([key, label]) => `${Number(counts[key])} ${label}`)
    .join(", ");
}

/** Silme engelinin iletisi (cümle düzeni). passive: cari zaten pasif — Pasife Al önerisi yerine durum söylenir. */
export function movementBlockText(counts, { passive = false } = {}) {
  const list = movementText(counts) || "cari hareketi";
  return passive
    ? `Bu carinin hareketi var: ${list}. Hareketi olan cari silinmez; cari zaten pasif (hareketleri ve bakiyesi korunur).`
    : `Bu carinin hareketi var: ${list}. Hareketi olan cari silinmez; kullanmayacaksanız Pasife Al ile pasife alın (hareketleri ve bakiyesi korunur, cari listede Pasif altında durur).`;
}
