// 2.5.0 Ç3 — 2.4.9 türetme kuralının giriş noktası (docs/erp/C3-DONDURMA-TASARIM.md §5). Bu klasördeki öbür dosyalar v2.4.9'un (ccf0b0ca) AYNEN kopyasıdır
// (tools/kural-kopyasi-249.mjs üretir; test/donmus-defter-250.test.mjs sha256'larını sabitler). YALNIZ göçte (göç 47'nin bekleyen koşusu) ve eski sürümün ilerlettiği kilidin
// aradaki döneminde (GAP_RULE) kullanılır; günlük yevmiye lib/general-ledger.mjs'ten.
// Saklanan fişler (2.5.0 Ç2, ledger_vouchers) türetme kuralı DEĞİLDİR, 2.4.9 dosyasında da yoktur: varsa satırları yazıldığı gibi eklenir (güncel kodun yaptığı gibi) ve
// maddeler güncel sıra kuralıyla dizilir (2.4.9'un sınıf numaraları güncel tabloyla aynı; fişsiz veride sıra 2.4.9'unkidir).
import { VOUCHER_ENTRY, journalOrder } from "../general-ledger.mjs";
import { voucherJournalRows } from "../ledger-vouchers.mjs";
import { createRows249 } from "./ledger-rows.mjs";

export const RULE_249 = "2.4.9";

/** v2.4.9'un Ana Defter türetmesi (routes/ledger.mjs build(), süzgeçsiz) + saklanan fişler. */
export function buildRule249(store) {
  const entries = createRows249(store).build();
  const vouchers = voucherJournalRows(store);
  if (!vouchers.length) return entries;
  for (const voucher of vouchers) {
    const lines = voucher.lines
      .filter(line => line.debit > 0 || line.credit > 0)
      .map(line => ({ account: String(line.account), debit: Number(line.debit) || 0, credit: Number(line.credit) || 0, ...(line.sub ? { sub: String(line.sub) } : {}), ...(line.party ? { party: String(line.party) } : {}) }));
    if (lines.length) entries.push({ id: `${VOUCHER_ENTRY[voucher.cls] || VOUCHER_ENTRY.ordinary}:${voucher.id}`, date: voucher.date, source: voucher.label, text: voucher.text, lines, seq: voucher.seq });
  }
  return entries.sort(journalOrder);
}
