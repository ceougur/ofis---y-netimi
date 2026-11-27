// 2.5.1 D3 — "DEVİRSİZ EŞDEĞER" yardımcısı (docs/devir/D3-D4-TASARIM.md §3.12 (b); EK-1 §4 değişmez (4), EK-2 S27 / S28; BAŞ MİMAR KARARI 27.11 (2) "DEVİRLİ = DEVİRSİZ").
// Test dosyası DEĞİL. Aynı veride iki kuyruk kurar (lib/obligation-queue.mjs buildObligations — programın KENDİ tek borç sırası):
//   devirsiz(t): carinin BÜTÜN satırları (bugünkü program, devir yok);
//   devirli(t):  planın yeni yıla yazacağı satırlar (kuyruğa giren NET satır + açık kalemler — vade = planın vadesi, Ödeme Sözü = planın beklenen tarihi) + K'den sonraki gerçek satırlar.
// D4a'nın yazacağı kuralı (devir satırları kuyruğa girmeden netleşir; açık kalem kendi vadesiyle) BENZETİR; D4a kodu yokken planın sayılarının doğruluğunu sınar. Kapsam dışı (D4a):
// ≤K taksit kartının yeni yıldaki taksitleri, şüpheli kaydının yeni yıldaki ayırımı — senaryolar bunları içermez. K sonrası satırın ≤K faturaya bağı: tur 2'de `redirect` seçeneğiyle
// (açık fatura kalemi kuyruğa faturanın kendi satırı gibi girer; bağ devir kalemine yönelir — D4a şartı, test/devir-d3-bag.test.mjs).
import { buildObligations } from "../../server/lib/obligation-queue.mjs";
import { createObligationInput } from "../../server/lib/obligation-input.mjs";

const toTl = minor => Math.round(minor) / 100;
const DEBIT_KINDS = new Set(["debt", "out"]);
const lineOf = (id, kind, date, minor) => ({ id, origin: "account", kind, date, at: "", label: "Devir", sourceId: "", invoiceId: "", doubtfulSkip: false, doubtfulNormal: false, method: kind === "in" || kind === "out" ? "cash" : "", note: "", receiptNo: null, debit: DEBIT_KINDS.has(kind) ? toTl(minor) : 0, credit: DEBIT_KINDS.has(kind) ? 0 : toTl(minor) });
// D4a ŞARTININ benzetimi (plan.mjs `rol`): ödeme rolündeki devir kalemi yeni yılda ÖDEME satırıdır (müşteriye para iadesi / tedarikçiye ödeme: "out"; tahsilat: "in") ve kuyrukta vadesi
// asıl tarihidir. Bugünkü kuyruk ödeme satırının vadesini satır tarihinden alır; benzetim kuyruğun sonucundaki o kalemin vadesini planın vadesiyle değiştirir ve gecikmişi kuyruğun
// kendi tanımıyla (lib/obligation-queue.mjs overdue: borç tarafı, vade < t, kalan − şüpheli) yeniden sayar.
const overdueOf = (items, day) => {
  const list = items.filter(item => item.side === "receivable" && item.vade < day && item.remaining - item.doubtful > 0.005);
  return { amount: Math.round(list.reduce((sum, item) => sum + item.remaining - item.doubtful, 0) * 100) / 100, since: list.reduce((min, item) => (!min || item.vade < min ? item.vade : min), "") };
};

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
  function devirli(party, planRow, K, day, { split = false, roleless = false, redirect = false } = {}) {
    const after = (ledgers.get(party) || []).filter(line => line.date > K);
    const synthetic = [];
    // D3 tur 2 — BAĞ YÖNLENDİRMESİNİN benzetimi (D4a ŞARTI; plan `newYear.baglar` tur "acik-kalem"): K sonrası satırın ≤K faturaya bağı (Kapatılacak Fatura, evrak bağı, iade → asıl
    // fatura, Mahsup Et) yeni yılda faturanın DEVİR KALEMİNE yönelmeli. Bugünkü tek borç sırası bağı yalnız fatura kalemine (`inv:<fatura>`) kurar; benzetim açık fatura kalemini
    // (kalemSinifi "fatura") kuyruğa o faturanın KENDİ satırı gibi (K+1 tarihli, tutar = planın tutarı, vade = planın vadesi) koyar — K sonrası satırların bağları böylece devir kalemine
    // gider. redirect = false (tur 1 benzetimi): açık fatura kalemi Borç Yaz gibi yazılır, bağ hedefsiz kalır (bağsız gibi dağılır).
    const invoiceLines = new Map();
    if (redirect) for (const line of ledgers.get(party) || []) if (line.date <= K && line.origin === "invoice" && line.kind !== "in" && line.kind !== "out") invoiceLines.set(line.sourceId, line);
    const redirected = new Map();
    const dueDates = new Map(extras.dueDates);
    const promises = new Map(extras.promises);
    const net = planRow.satirlar.reduce((sum, row) => sum + (row.kuyrugaGirenMinor || 0), 0);
    const totals = [];
    if (split) {
      for (const row of planRow.satirlar) if (row.tur === "borc-toplami" || row.tur === "alacak-toplami" || row.tur === "devir-bakiyesi") totals.push(lineOf(row.kimlik, row.yon, row.tarih, row.tutarMinor));
    } else if (net) synthetic.push(lineOf(`${planRow.cari}-net`, net > 0 ? "debt" : "credit", planRow.satirlar[0].tarih, Math.abs(net)));
    const paymentVade = new Map();
    for (const row of planRow.satirlar) {
      if (row.tur !== "acik-kalem") continue;
      if (row.rol === "odeme" && !roleless) {
        synthetic.push(lineOf(row.kimlik, row.yon === "debt" ? "out" : "in", row.tarih, row.tutarMinor));
        paymentVade.set(row.kimlik, row.vade);
        continue;
      }
      const own = redirect && row.kalemSinifi === "fatura" ? invoiceLines.get(row.belge?.faturaId) : null;
      if (own) {
        const amount = toTl(row.tutarMinor);
        // Kayıt anı öbür devir satırlarıyla AYNI (D4a hepsini tek seferde, planın sırasıyla yazar — S2'de vade eşitse belge tarihi yerine yazım sırası = planın (vade, belge tarihi) sırası).
        // Asıl satırın kayıt anı taşınırsa eşit vadeli kalemlerde sıra ayrışır (tur 2 gerçek veri, UTC tohum 7 — benzetim hatası, plan değil).
        synthetic.push({ ...own, id: `${own.id}#devir`, date: row.tarih, at: "", debit: own.debit ? amount : 0, credit: own.debit ? 0 : amount });
        redirected.set(own.sourceId, { vade: row.vade, amount });
        continue;
      }
      // D3 tur 4 (S-T2-1 = B): Mahsup Et'in karşı belgesi ≤K Alacak Yaz / Borç Yaz satırı olabilir — redirect'te devir kalemi o satırın KİMLİĞİYLE kuyruğa girer (D4a mahsubun
      // counter_id'sini devir kalemine çevirir; benzetim kimliği aynı tutarak aynı bağı kurar).
      const id = redirect && row.kalemSinifi === "elle" && row.belge?.satirId ? row.belge.satirId : row.kimlik;
      synthetic.push(lineOf(id, row.yon, row.tarih, row.tutarMinor));
      dueDates.set(id, row.vade);
      if (row.beklenenTarih) promises.set(id, row.beklenenTarih);
    }
    // split (tehlikenin gösterimi): toplam satırları açık kalemlerden SONRA, bağsız alacak gibi (tasarım §3.5 madde 4: "Alacak Toplamı TYK'da bağsız alacak gibi işlenirse").
    synthetic.push(...totals);
    const base = input.batchSettleInput(party, [...synthetic, ...after], tables, day);
    const ids = new Set(after.filter(line => line.origin === "invoice").map(line => line.sourceId));
    base.invoices = base.invoices.filter(invoice => ids.has(invoice.id) || redirected.has(invoice.id)).map(invoice => (redirected.has(invoice.id) ? { ...invoice, dueDate: redirected.get(invoice.id).vade, payable: redirected.get(invoice.id).amount } : invoice));
    base.offsets = base.offsets.filter(offset => offset.date > K);
    // ≤K şüpheli kaydının yeni yıldaki ayırımı D4a'nın işi (kapsam dışı); K'den SONRA alınmış şüpheli kayıt yeni yılda kendi tarihiyle kalır — devirsizdeki gibi kuyruğa girer (tur 2:
    // gerçek veri UTC tohum 11 — 14.01.2027 Şüpheliye Al'ı benzetim dışarıda bırakıyordu).
    const later = (extras.doubtful?.get?.(party) || []).filter(record => record.date > K);
    const result = buildObligations({ ...input.withExtras(base, { ...extras, dueDates, promises }, party), doubtfulRecords: later });
    if (!paymentVade.size) return result;
    const items = result.items.map(item => (paymentVade.has(item.lineId) ? { ...item, vade: paymentVade.get(item.lineId) } : item));
    return { ...result, items, overdue: (t = day) => overdueOf(items, t) };
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
  return { devirsiz, devirli, compare, ledgers, kilitBagImzasi: (party, plan, outs) => kilitBagImzasi({ devirsiz, party, plan, outs }) };
}

/**
 * D3 tur 5 — S-T4-1 = A'nın "BEKLENEN FARK" sınıfı (KULLANICI 27.11.2026 18:1x UTC, AYNEN: "önerlerini uygula" — S-T4-1 = A: Dönem Kilidi'nden sonra kurulan bağ faturanın kilit anındaki
 * BAĞSIZ kapanışını KAYDIRMAZ; devir planı bugün zaten A'yı veriyor, programın tek borç sırasının düzeltmesi ayrı 'kilit paketi'nde). Devirli ≠ devirsiz farkı YALNIZ şu imzayla bu sınıfa
 * sayılır (ders 53 (b): karar numarasıyla açıklanmış fark), öbür her fark BAŞARISIZ kalır:
 *   (1) planın bağ listesinde bu carinin K sonrası bir bağı ARŞİV BAŞVURUSU (hedef ≤K fatura K'de kapanmış — A'ya göre bağ bağsız gibi dağılır);
 *   (2) DEVİRSİZ kuyrukta o bağın satırı aynı faturayı "Bağlı" kapatıyor (tutar T > 0) — kilitli dönemde kapanmış faturayı kilitten sonra kurulan bağ yeniden açmış (S-T4-1'in kendisi);
 *   (3) fark bu tutarla sınırlı: her günde |gecikmiş farkı| ≤ T, borç tarafı açık kalemlerin toplamı AYNI (bakiye aynı), kalem kalem mutlak farkların toplamı ≤ 2T.
 * Dönüş: { sinif: "S-T4-1", tutarMinor: T, baglar } ya da null. Kilit paketi girince (program A'ya geçince) (2) kendiliğinden düşer — sınıf boşalır.
 */
function kilitBagImzasi({ devirsiz, party, plan, outs }) {
  const archived = (plan?.newYear?.baglar || []).filter(link => link.tur === "arsiv-basvurusu" && link.eskiHedef && link.tarih > (plan.meta?.K || ""));
  if (!archived.length || !outs?.length) return null;
  const queue = devirsiz(party, outs[0].day);
  let shift = 0;
  const used = [];
  for (const link of archived) {
    const closers = queue.invoices.get(link.eskiHedef)?.closers || [];
    const minor = closers.filter(closer => closer.mode === "linked" && closer.id === link.satir).reduce((sum, closer) => sum + Math.round(Number(closer.amount) * 100), 0);
    if (minor > 0) {
      shift += minor;
      used.push(link.satir);
    }
  }
  if (!(shift > 0)) return null;
  const sum = list => list.reduce((total, item) => total + Number(item.split("|")[1]), 0);
  const bucket = list => {
    const map = new Map();
    for (const item of list) {
      const [vade, minor] = item.split("|");
      map.set(vade, (map.get(vade) || 0) + Number(minor));
    }
    return map;
  };
  for (const out of outs) {
    if (Math.abs(out.devirli - out.devirsiz) > shift) return null;
    if (sum(out.kalemDevirli) !== sum(out.kalemDevirsiz)) return null;
    const a = bucket(out.kalemDevirli);
    const b = bucket(out.kalemDevirsiz);
    let moved = 0;
    for (const vade of new Set([...a.keys(), ...b.keys()])) moved += Math.abs((a.get(vade) || 0) - (b.get(vade) || 0));
    if (moved > 2 * shift) return null;
  }
  return { sinif: "S-T4-1", tutarMinor: shift, baglar: used };
}
