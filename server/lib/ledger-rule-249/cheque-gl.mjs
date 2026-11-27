// Çek ve senedin Tekdüzen hesapları (2.2.0 İz 4.2; docs/BANKA-MODULU-PLAN.md §3.11a — kullanıcı 12.10.2026: "muhasebe mantığı gereği ise onu da
// uygula"). 2.0.13'ten 2.2.0'a kadar çek ve senet birlikte izleniyordu (101 "Alınan Çekler ve Senetler", 103 "Verilen Çekler ve Senetler");
// Tekdüzen Hesap Planı'nda ayrı hesaplardadır. Kural evrak türüne (cheques.instrument) göre:
//
//   | Evrak | Yön     | Ana hesap                                      | Alt hesaplar                                                |
//   | Çek   | Alınan  | 101 Alınan Çekler                              | 101.01 Portföydeki Çekler · 101.02 Tahsile Verilen Çekler   |
//   | Senet | Alınan  | 121 Alacak Senetleri                           | 121.01 Portföydeki Senetler · 121.02 Tahsile Verilen Senetler |
//   | Çek   | Verilen | 103 Verilen Çekler ve Ödeme Emirleri (−)       | —                                                           |
//   | Senet | Verilen | 321 Borç Senetleri                             | —                                                           |
//
// Ana Defter türetilir, saklanmaz (lib/general-ledger.mjs): veri göçü yok; eski sürüm verisinde senetler yeni kuralla 121/321'de görünür (tutar
// değişmez, yalnız hesap). TEK KURAL: yevmiye (journal), beklenenler (routes/ledger.mjs expected), kapı (integrity.mjs, integrity-scope.mjs), Alt
// Hesap Mizanı (lib/bank/collections.mjs chequeSubTrial), İşlem Kartı ve raporlar bu tablodan okur; başka yerde ikinci eşleme yazılmaz.
// Tanınmayan tür (CHECK kısıtı yalnız 'cheque' | 'note' kabul eder; evrakı bulunamayan satır) çektir — 2.0.13'ten beri 101/103.

export const DOCUMENT_GL = Object.freeze({
  cheque: Object.freeze({ received: "101", given: "103", portfolio: "101.01", bank: "101.02" }),
  note: Object.freeze({ received: "121", given: "321", portfolio: "121.01", bank: "121.02" }),
});
/** Evrak türünün hesapları ({ received, given, portfolio, bank }). */
export const documentGl = instrument => (instrument === "note" ? DOCUMENT_GL.note : DOCUMENT_GL.cheque);
/** Alınan evrakın ana hesapları (alt hesaplı: .01 portföy, .02 bankaya tahsile verilen). */
export const RECEIVED_MAINS = Object.freeze(new Set([DOCUMENT_GL.cheque.received, DOCUMENT_GL.note.received]));
/** Evrakın bütün ana hesapları. */
export const DOCUMENT_MAINS = Object.freeze(new Set([...RECEIVED_MAINS, DOCUMENT_GL.cheque.given, DOCUMENT_GL.note.given]));
/** Alınan evrakın alt hesabının adı (Alt Hesap Mizanı, İşlem Kartı). */
export const DOCUMENT_SUB_NAMES = Object.freeze({
  "101.01": "Portföydeki Çekler",
  "101.02": "Tahsile Verilen Çekler",
  "121.01": "Portföydeki Senetler",
  "121.02": "Tahsile Verilen Senetler",
});
/** Bankaya tahsile verilen evrakın alt hesapları (101.02, 121.02). */
export const BANK_SUBS = Object.freeze(new Set([DOCUMENT_GL.cheque.bank, DOCUMENT_GL.note.bank]));
/** Alt hesabın ana hesabı (101.02 → 101): alt hesap kodu ana hesabın kodu + "." + iki hane. */
export const mainOfSub = sub => String(sub).split(".")[0];
/** SQL ifadesi: evrak türü kolonundan hesap (which: received | given | portfolio | bank). Tür boş/NULL ise çek. */
export const documentGlSql = (instrumentColumn, which) => `CASE WHEN ${instrumentColumn} = 'note' THEN '${DOCUMENT_GL.note[which]}' ELSE '${DOCUMENT_GL.cheque[which]}' END`;

/**
 * Alt defterin (çek/senet kartları ve tahsil kayıtları) beklediği evrak bakiyeleri (kuruş, borç artı) — Ana Defter'den BAĞIMSIZ, ham tablolardan.
 * Kapı (integrity.mjs tam, integrity-scope.mjs dokunulan evrak) yevmiyeyi bununla karşılaştırır:
 *   mains: 101 / 121 = silinmemiş, portföydeki alınan çek / senet; 103 / 321 = ödenecek (pending) verilen çek / senet (eksi)
 *   subs : 101.02 / 121.02 = bekleyen tahsil kaydı olan portföydeki alınan evrak (Bankaya Tahsile Ver; kayıt başına), 101.01 / 121.01 = kalanı
 * cheques: dokunulan evrakın kimlikleri (null: hepsi).
 */
export function documentWanted(store, cheques = null) {
  const mains = new Map([...DOCUMENT_MAINS].map(code => [code, 0]));
  const subs = new Map(Object.keys(DOCUMENT_SUB_NAMES).map(sub => [sub, 0]));
  const has = name => Boolean(store.get("SELECT 1 AS found FROM sqlite_master WHERE type = 'table' AND name = ?", name));
  if (!has("cheques")) return { mains, subs };
  const list = cheques ? JSON.stringify([...cheques]) : null;
  const args = list ? [list] : [];
  // Süzgeçte kimlik kümesi dış döngüdür (CROSS JOIN) ve durum kolonlarının indeksi kapatılır (+): planlayıcı birincil anahtarı kullanır.
  const x = list ? "+" : "";
  const cents = "CAST(ROUND(c.amount * 100) AS INTEGER)";
  const cards = store.all(
    `SELECT c.instrument AS instrument, c.direction AS direction, COALESCE(SUM(${cents}), 0) AS n
     FROM ${list ? "json_each(?) j CROSS JOIN cheques c ON c.id = j.value" : "cheques c"}
     WHERE ${x}c.deleted_at IS NULL AND ((${x}c.direction = 'in' AND ${x}c.status = 'portfolio') OR (${x}c.direction = 'out' AND ${x}c.status = 'pending'))
     GROUP BY c.instrument, c.direction`,
    ...args,
  );
  for (const row of cards) {
    const gl = documentGl(row.instrument);
    const value = Number(row.n) || 0;
    if (row.direction === "in") {
      mains.set(gl.received, mains.get(gl.received) + value);
      subs.set(gl.portfolio, subs.get(gl.portfolio) + value);
    } else mains.set(gl.given, mains.get(gl.given) - value);
  }
  if (has("cheque_collections")) {
    const deposited = store.all(
      `SELECT c.instrument AS instrument, COALESCE(SUM(${cents}), 0) AS n
       FROM ${list ? "json_each(?) j CROSS JOIN cheque_collections k ON k.cheque_id = j.value" : "cheque_collections k"} CROSS JOIN cheques c ON c.id = k.cheque_id
       WHERE ${x}k.status = 'pending' AND ${x}c.deleted_at IS NULL AND ${x}c.direction = 'in' AND ${x}c.status = 'portfolio'
       GROUP BY c.instrument`,
      ...args,
    );
    for (const row of deposited) {
      const gl = documentGl(row.instrument);
      const value = Number(row.n) || 0;
      subs.set(gl.bank, subs.get(gl.bank) + value);
      subs.set(gl.portfolio, subs.get(gl.portfolio) - value);
    }
  }
  return { mains, subs };
}
