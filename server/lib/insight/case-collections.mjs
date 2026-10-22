// Kaydın (ortadaki tablodaki kişinin) tahsilatları — 2.4.4 (E8; kullanıcı 21.10.2026: "orta tablodaki Excel'deki kayıttan taksit olmasın, cariye kaydedip
// oradan yapsın; kasa hareketlerini, fatura, rapor gibi kısımları bozar"). Zil ve Tahsilat Takvimi'ndeki "Tahsilat Gir" artık kayıttan Kasa'ya doğrudan
// yazmaz; tahsilat kaydın CARİSİNE (ya da carinin / kaydın taksit kartına) girilir. Kaydın tahsilatını okuyan yerler aynı kümeyi buradan alır:
//   1. kayıt tahsilatları (payments): eski sürümlerde kayıt kartından girilenler (sunucu ucu ve düzeltme/silme durur, veri olduğu gibi kalır);
//   2. kayda bağlı carinin tahsilatları (account_entries, kind 'in'): cari AYNI veri oturumunda bu kayda bağlı (2.4.3 A2 "Kayıt Kartından Tahsilatlar"
//      raporunun ve İşlem Geçmişi'nin kuralı; silinmiş cari sayılmaz);
//   3. plans: true ise (takvim) kayda bağlı ya da kayda bağlı carinin taksit kartlarının tahsilatları (plan_entries, kind 'in'; açılış — Excel'e göre önceden
//      ödenen, Kasa dışı — hariç; silinmiş kart sayılmaz). Takvimde kartlı kişinin yalnız ödeme sözü kalır (routes/dues.mjs); söz "Taksite Yaz" ile de kapanır.
// İade / ödeme (out) sayılmaz: takvim motoru (lib/insight/dues.mjs) yalnız gelen parayı kalemlere vade sırasıyla dağıtır; kayıt tahsilatında da iade yoktu.
// Her satır { caseKey, amount, date, note }; 2. ve 3. satırlar ayrıca session (bağın veri oturumu) taşır.

/** source: açık veri oturumunun anahtarı (dataset.currentKey()); boşsa yalnız kayıt tahsilatları. */
export function caseCollections(store, source, { plans = false } = {}) {
  const rows = store.all("SELECT case_key AS caseKey, amount, date, note FROM payments");
  if (!source) return rows;
  for (const row of store.all(
    `SELECT a.case_key AS caseKey, e.amount, e.date, e.note FROM accounts a CROSS JOIN account_entries e ON e.account_id = a.id
     WHERE e.kind = 'in' AND a.deleted_at IS NULL AND a.case_key <> '' AND a.case_source = ?`,
    source,
  ))
    rows.push({ ...row, session: source });
  if (!plans) return rows;
  // Kartın kendi kayıt bağı önce gelir; bağsız kartın tahsilatı, carisi bu kayda bağlıysa o kayda sayılır. Her hareket bir kez.
  for (const row of store.all(
    `SELECT CASE WHEN p.case_key <> '' AND p.case_source = ? THEN p.case_key ELSE a.case_key END AS caseKey, e.amount, e.date, e.note
     FROM plan_entries e JOIN plans p ON p.id = e.plan_id AND p.deleted_at IS NULL
     LEFT JOIN accounts a ON a.id = p.account_id AND a.deleted_at IS NULL AND a.case_key <> '' AND a.case_source = ?
     WHERE e.kind = 'in' AND COALESCE(e.opening, 0) = 0 AND ((p.case_key <> '' AND p.case_source = ?) OR a.id IS NOT NULL)`,
    source,
    source,
    source,
  ))
    rows.push({ ...row, session: source });
  return rows;
}

/**
 * Önbellek anahtarı için: carilerin kayıt bağı ve kayda bağlı carilerin tahsilatları (taksit hareketleri plans.fingerprint() ile ayrıca). Her takvim
 * isteğinde koşar: CROSS JOIN sırayı sabitler — yalnız kayda bağlı cariler taranır, hareketleri cari dizininden (idx_account_entries_account) okunur
 * (önceden plan bütün cari hareketlerini tarıyordu).
 */
export function caseCollectionsState(store) {
  const row = store.get(
    `SELECT (SELECT COUNT(*) || '/' || COALESCE(MAX(updated_at), '') || '/' || COUNT(deleted_at) FROM accounts) AS a,
            (SELECT COUNT(*) || '/' || COALESCE(MAX(COALESCE(e.updated_at, e.created_at)), '') || '/' || COALESCE(SUM(e.amount), 0)
               FROM accounts c CROSS JOIN account_entries e ON e.account_id = c.id WHERE c.case_key <> '' AND e.kind = 'in') AS e`,
  );
  return `${row.a}|${row.e}`;
}
