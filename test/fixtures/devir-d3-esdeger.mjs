// 2.5.1 D3 — "DEVİRSİZ EŞDEĞER" yardımcısı (docs/devir/D3-D4-TASARIM.md §3.12 (b); EK-1 §4 değişmez (4), EK-2 S27 / S28; BAŞ MİMAR KARARI 27.11 (2) "DEVİRLİ = DEVİRSİZ").
// Test dosyası DEĞİL. Aynı veride iki kuyruk kurar (lib/obligation-queue.mjs buildObligations — programın KENDİ tek borç sırası):
//   devirsiz(t): carinin BÜTÜN satırları (bugünkü program, devir yok);
//   devirli(t):  planın yeni yıla yazacağı satırlar (kuyruğa giren NET satır + açık kalemler — vade = planın vadesi, Ödeme Sözü = planın beklenen tarihi) + K'den sonraki gerçek satırlar.
// D4a'nın yazacağı kuralı (devir satırları kuyruğa girmeden netleşir; açık kalem kendi vadesiyle) BENZETİR; D4a kodu yokken planın sayılarının doğruluğunu sınar. Kapsam dışı (D4a):
// K sonrası satırın ≤K faturaya bağı, ≤K taksit kartının yeni yıldaki taksitleri, şüpheli kaydının yeni yıldaki ayırımı — senaryolar bunları içermez.
import { buildObligations } from "../../server/lib/obligation-queue.mjs";
import { createObligationInput } from "../../server/lib/obligation-input.mjs";

const toTl = minor => Math.round(minor) / 100;
const lineOf = (id, kind, date, minor) => ({ id, origin: "account", kind, date, at: "", label: "Devir", sourceId: "", invoiceId: "", doubtfulSkip: false, doubtfulNormal: false, method: "", note: "", receiptNo: null, debit: kind === "debt" ? toTl(minor) : 0, credit: kind === "credit" ? toTl(minor) : 0 });

export function createEquivalence(store) {
  const input = createObligationInput({ store });
  const ledgers = input.ledgerLines();
  const tables = input.settleTables();
  const extras = input.obligationExtras();
  /** Devirsiz kuyruk (t günü). */
  function devirsiz(party, day) {
    return buildObligations(input.withExtras(input.batchSettleInput(party, ledgers.get(party) || [], tables, day), extras, party));
  }
  /**
   * Devirli kuyruk (t günü): planın satırları + K sonrası gerçek satırlar. split: true → Borç Toplamı / Alacak Toplamı AYRI satır olarak kuyruğa (netleşme kuralı OLMADAN — tasarım §3.5 madde 4'ün
   * tehlikesini göstermek için); varsayılan net tek satır (kuyrugaGirenMinor).
   */
  function devirli(party, planRow, K, day, { split = false } = {}) {
    const after = (ledgers.get(party) || []).filter(line => line.date > K);
    const synthetic = [];
    const dueDates = new Map(extras.dueDates);
    const promises = new Map(extras.promises);
    const net = planRow.satirlar.reduce((sum, row) => sum + (row.kuyrugaGirenMinor || 0), 0);
    const totals = [];
    if (split) {
      for (const row of planRow.satirlar) if (row.tur === "borc-toplami" || row.tur === "alacak-toplami" || row.tur === "devir-bakiyesi") totals.push(lineOf(row.kimlik, row.yon, row.tarih, row.tutarMinor));
    } else if (net) synthetic.push(lineOf(`${planRow.cari}-net`, net > 0 ? "debt" : "credit", planRow.satirlar[0].tarih, Math.abs(net)));
    for (const row of planRow.satirlar) {
      if (row.tur !== "acik-kalem") continue;
      synthetic.push(lineOf(row.kimlik, row.yon, row.tarih, row.tutarMinor));
      dueDates.set(row.kimlik, row.vade);
      if (row.beklenenTarih) promises.set(row.kimlik, row.beklenenTarih);
    }
    // split (tehlikenin gösterimi): toplam satırları açık kalemlerden SONRA, bağsız alacak gibi (tasarım §3.5 madde 4: "Alacak Toplamı TYK'da bağsız alacak gibi işlenirse").
    synthetic.push(...totals);
    const base = input.batchSettleInput(party, [...synthetic, ...after], tables, day);
    const ids = new Set(after.filter(line => line.origin === "invoice").map(line => line.sourceId));
    base.invoices = base.invoices.filter(invoice => ids.has(invoice.id));
    base.offsets = base.offsets.filter(offset => offset.date > K);
    return buildObligations({ ...input.withExtras(base, { ...extras, dueDates, promises }, party), doubtfulRecords: [] });
  }
  /** Karşılaştırma: gecikmiş(t) ve borç tarafındaki açık kalemlerin (vade, kalan − şüpheli) çoklu kümesi. */
  const receivables = result => result.items.filter(item => item.side === "receivable" && item.remaining - item.doubtful > 0.005).map(item => `${item.vade}|${Math.round((item.remaining - item.doubtful) * 100)}`).sort();
  function compare(party, planRow, K, days, options = {}) {
    const out = [];
    for (const day of days) {
      const a = devirsiz(party, day);
      const b = devirli(party, planRow, K, day, options);
      out.push({ day, devirsiz: Math.round(a.overdue(day).amount * 100), devirli: Math.round(b.overdue(day).amount * 100), kalemDevirsiz: receivables(a), kalemDevirli: receivables(b), sinceDevirsiz: a.overdue(day).since, sinceDevirli: b.overdue(day).since });
    }
    return out;
  }
  return { devirsiz, devirli, compare, ledgers };
}
