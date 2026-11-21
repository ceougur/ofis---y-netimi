// 2.5.0 İzleyen tur 2 (docs/erp/C7B-FATURA-TASARIM.md §20.2; BAŞ MİMAR KARARI 21.11 18:28 (2)): Mevcut Borç kartının KAPSAM SEÇİMİ — TEK YARDIMCI.
// Kartın açıldığı anda carinin açık borcu kart tutarından FAZLAYSA hangi borcun karta gireceği KULLANICI KARARIDIR (S110 = A, S120 = A; S123 = C BİLİNEN SINIR):
//   - satışla açılan kart o satışı (S110 "stoktan satışta o satışı");
//   - elle kartta tutarı karta eşit TEK elle borç varsa o borç (S110 "elle kartta taksitlendirilen borcu");
//   - yoksa yalnız ELLE borçlar, eskiden yeniye (S120); elle borçlar kartı doldurmuyorsa artan kapasite öbür açık borçlara s2 sırasıyla (S123 = C — kural yok, tur 2b-2'den beri).
// Açık borç kart tutarını aşmıyorsa (ya da Excel / Tablodan Aktar kartında) eski kural: bütün açık borç s2 sırasıyla.
// Önceden bu seçim YALNIZ Tek Yükümlülük Kuyruğu'nda (lib/obligation-queue.mjs coverEvent) vardı; kapama defteri (lib/invoice-settle.mjs — iade, İptal Et, Düzenle, iptal
// penceresinin okuduğu kart payları) kartı en YENİ borçtan dolduruyordu (v2.0.23 newestFirst). İki hesap aynı faturayı farklı karta bağlıyordu (ekranda A 'Taksitte', B 'Gecikti';
// B'nin İptal Et'i kartı kapatıyor, A kartsız kalıyordu). Saf işlev — veri tabanına, saate dokunmaz; iki çağıran kendi kalemlerini aşağıdaki erişimcilerle verir.

// S2 anahtarı: vade ↑ → belge tarihi ↑ → kayıt anı ↑ → yazım sırası ↑ → alt sıra (taksit no). Kuyruk ve kapama defteri bu sırayı paylaşır.
export const s2 = (a, b) =>
  a.vade !== b.vade ? (a.vade < b.vade ? -1 : 1)
  : a.date !== b.date ? (a.date < b.date ? -1 : 1)
  : a.at !== b.at ? (a.at < b.at ? -1 : 1)
  : a.rank !== b.rank ? a.rank - b.rank
  : (a.sub || 0) - (b.sub || 0);

/**
 * Satışla açılan kartın KENDİ satışı (S110 "stoktan satışta o satışı"; Ç5-B kapanış düzeltmesi ORTA-1 + S133 = C).
 * @param {{ at: string, sale: string, gross: number }} card  kartın kayıt anı, açılış izindeki satış (stok hareketi kimliği), açıldığı andaki tutarı (kuruş)
 * @param {Array<object>} items  carinin bütün borç / alacak kalemleri (kapanmışlar dahil)
 * @param {{ stockSale(x): boolean, debt(x): boolean, sourceId(x): string, recorded(x): string, rank(x): number, amount(x): number }} get
 */
export function ownSaleOf(card, items, get) {
  if (card.sale) {
    const known = items.find(item => get.stockSale(item) && get.sourceId(item) === card.sale);
    if (known) return known;
  }
  let newest = null;
  for (const item of items) {
    if (!get.debt(item)) continue;
    const recorded = get.recorded(item);
    if (card.at && recorded && recorded > card.at) continue;
    if (!newest || recorded > get.recorded(newest) || (recorded === get.recorded(newest) && get.rank(item) > get.rank(newest))) newest = item;
  }
  // Satışla açılan kart aynı işlemde satıştan hemen sonra yazılır: en son kaydedilen borç stok satışıdır ve tutarı kartın açıldığı andaki tutara eşittir — kart sonradan
  // iadeyle küçülmüşse aynı kayıt anı da yeter.
  return newest && get.stockSale(newest) && (get.amount(newest) === card.gross || (card.at && get.recorded(newest) === card.at)) ? newest : null;
}

/**
 * Kartın tüketeceği kalemler ve sırası.
 * @param {object} o
 * @param {{ at: string, sale: string, gross: number, source: string }} o.card
 * @param {number} o.cap  kartın tüketebileceği (kuruş)
 * @param {number} o.openDebt  carinin o andaki açık borcu (kartın adayları + öbür kartların / taksitli faturaların açık taksitleri; kuruş)
 * @param {Array<object>} o.candidates  kartın tüketebileceği açık kalemler, s2 sırasıyla
 * @param {Array<object>} o.items  carinin bütün kalemleri (kendi satış taraması)
 * @param {{ left(x): number, elle(x): boolean } & Parameters<typeof ownSaleOf>[2]} o.get
 * @returns {{ rule: "s2" | "S110-satis" | "S110-elle" | "S120", chosen: Array<object>, own: object | null, elle: Array<object> }}
 */
export function chooseCover({ card, cap, openDebt, candidates, items, get }) {
  if (!(openDebt > cap) || card.source === "transfer") return { rule: "s2", chosen: candidates, own: null, elle: [] };
  const own = ownSaleOf(card, items, get);
  if (own) return { rule: "S110-satis", chosen: candidates.includes(own) ? [own] : [], own, elle: [] };
  const elle = candidates.filter(get.elle);
  const equal = elle.filter(target => get.left(target) === cap);
  if (equal.length === 1) return { rule: "S110-elle", chosen: equal, own: null, elle: equal };
  return { rule: "S120", chosen: [...elle, ...candidates.filter(target => !get.elle(target))], own: null, elle };
}

// ---------- S241 = A (2.5.0 İzleyen tur 2; tasarım §20.1): Düzenle ile azaltma İADEYLE AYNI ----------
// Kullanıcı kararı (AYNEN): "fazlası carinin avansı — iadeyle AYNI; Düzenle kesintisi iade kesintisi gibi kayda geçer, iki görünüm aynı sayıyı verir". Satış faturası Düzenle ile azaltılıp
// bir Mevcut Borç kartını kestiyse (routes/invoices.mjs editInvoice → shrinkCoversByEdit) azalış faturanın payment_json.editCuts listesine yazılır: [{ at, date, amount (TL; azalış),
// cuts: { kart: TL }, items: { kart: [kesilen taksitler] } }]. Kuyruk (lib/obligation-queue.mjs) ve kapama defteri (lib/invoice-settle.mjs) girdiyi okurken her kaydı o anda faturaya
// gelen bir İADE gibi görür: faturanın borç satırı kaydedildiği andaki tutarına (bugünkü + kayıtlı azalışlar) döner, her azalış kendi anında faturaya bağlı bir alacak notudur
// (iade belgesinin coverCuts'ı = kaydın cuts'ı). Böylece kartın kapsamı açıldığı andaki tutarla kurulur; azalışın kartın açık kalanını aşan kısmı carinin avansıdır (iade belgesinin
// açığı gibi) — P-2'nin (iade) ölçtüğü sayılar Düzenle'de de aynı. Bakiye, ekstre, defter DEĞİŞMEZ (girdinin içinde; veri tabanına yazılmaz). Yapay belgelerin kimliği
// EDIT_CUT_PREFIX ile başlar; iki hesap sonuçlarından siler.
export const EDIT_CUT_PREFIX = "edit-cut:";
const centsOf = value => Math.round((Number(value) || 0) * 100);
export function editCutsOf(value) {
  let list = value;
  if (typeof value === "string") {
    try {
      const parsed = JSON.parse(value);
      list = Array.isArray(parsed) ? parsed : parsed?.editCuts;
    } catch {
      list = null;
    }
  } else if (value && !Array.isArray(value) && typeof value === "object") list = value.editCuts;
  if (!Array.isArray(list)) return [];
  return list
    .filter(record => record && typeof record === "object")
    .map(record => ({ at: String(record.at || ""), date: String(record.date || String(record.at || "").slice(0, 10)), amount: Math.max(0, Number(record.amount) || 0), cuts: record.cuts && typeof record.cuts === "object" ? record.cuts : {}, items: record.items && typeof record.items === "object" ? record.items : {} }))
    .filter(record => /^\d{4}-\d{2}-\d{2}$/.test(record.date));
}
const fromCents = value => Math.round(value) / 100;
export function withEditCuts(input) {
  const invoices = input?.invoices || [];
  let marked = null;
  for (const invoice of invoices) if (invoice.editCuts && invoice.status === "issued" && (invoice.kind === "sale" || invoice.kind === "smm") && !invoice.planId) (marked ||= []).push(invoice);
  if (!marked) return input;
  const lines = [...(input.lines || [])];
  const extra = [];
  const ids = new Set();
  for (const invoice of marked) {
    const records = editCutsOf(invoice.editCuts);
    if (!records.length) continue;
    const index = lines.findIndex(line => line.origin === "invoice" && line.sourceId === invoice.id && line.kind !== "in" && line.kind !== "out" && centsOf(line.debit) > 0);
    if (index < 0) continue;
    const gross = records.reduce((sum, record) => sum + centsOf(record.amount), 0);
    lines[index] = { ...lines[index], debit: fromCents(centsOf(lines[index].debit) + gross) };
    records.forEach((record, n) => {
      const id = `${EDIT_CUT_PREFIX}${invoice.id}:${n}`;
      ids.add(id);
      extra.push({ id, kind: "sale_return", status: "issued", payable: record.amount, originalId: invoice.id, dueDate: "", planId: "", issuedAt: record.at, coverCuts: record.cuts, editCut: true });
      if (centsOf(record.amount) > 0) lines.push({ id: `${id}:line`, origin: "invoice", kind: "credit", sourceId: id, date: record.date, at: record.at, label: "Fatura Düzenlemesi", note: "", method: "", debit: 0, credit: fromCents(centsOf(record.amount)) });
    });
  }
  if (!ids.size) return input;
  return { ...input, lines, invoices: [...invoices, ...extra], editCutIds: ids };
}
