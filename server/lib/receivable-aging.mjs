// Alacak yaşlandırmanın cari bakiyesiyle uzlaşması (2.4.3, uzman mali müşavir MM5; kullanıcı kararı 18.10.2026).
//
// Sorun: Alacak Yaşlandırma yalnız kalemleri (açık taksit, açık vadeli satış faturası, portföydeki alınan evrak) topluyordu; faturasız cari borcu (devir /
// açılış, Borç Yaz, karşılıksız çekten doğan borç, veresiye stok satışı) hiçbir dilime girmiyordu (denetçi: rapor 840, gerçek açık alacak 7.840).
// Kural (yaygın muhasebe programlarının cari yaşlandırması — FIFO kapama):
//   - Her borçlu carinin bakiyesi (cari kartı; borç artı) yaşlandırılır. Kalemleri (taksit + fatura) bakiyeden düşülür.
//   - Kalan ARTI ise "Faturasız" kalemdir: carinin faturasız borç hareketlerine (fatura dışı borç / ödeme satırları) EN YENİSİNDEN geriye dağıtılır
//     (FIFO: tahsilatlar en eski borcu kapatır, açık kalan en yenilerdir) ve her parça kendi hareket tarihiyle yaşlanır.
//   - Kalan EKSİ ise (kaleme bağlanmamış tahsilat / alacak): kalemler EN ESKİSİNDEN düşülür; bakiye sıfır ya da alacaklıysa carinin kalemi kalmaz.
//   Sonuç: her carinin dilimlerinin toplamı = borç bakiyesi; raporun cari toplamı = borçlu carilerin bakiyeleri toplamı. Portföydeki alınan evrak cari
//   bakiyesinde değildir (alınınca cari alacaklanır); ayrı kalem olarak yaşlanır. Carisiz taksit kartları da bakiyeye bağlı değildir.
const cents = value => Math.round((Number(value) || 0) * 100);

/**
 * accounts: [{ id, name, balance }] (silinmemiş cariler; balance cari kartı bakiyesi, borç artı). items: [{ accountId, date, amount, … }] carinin
 * kalemleri (açık taksit, açık satış faturası; tutar TL). Dönüş: { items: düşülmüş kalemler (tutarı 0'a inen çıkar), unbilled: [{ accountId, name, date,
 * amount }] }. day: bugün (dağıtılacak hareket bulunamazsa faturasız kalemin tarihi). skip (2.4.6 madde 11; isteğe bağlı): kalanı kendi kalemi olan cari
 * hareketleri (Nakit Akış Projeksiyonu'nda vadeli borç kaydı) — faturasız kalemin tarih dayanağı olmaz; verilmezse davranış aynı (Alacak Yaşlandırma).
 */
export function reconcileReceivables(store, { accounts = [], items = [], day = "", skip = null } = {}) {
  const byAccount = new Map();
  for (const item of items) {
    if (!item.accountId) continue;
    if (!byAccount.has(item.accountId)) byAccount.set(item.accountId, []);
    byAccount.get(item.accountId).push(item);
  }
  const kept = new Map(items.map(item => [item, cents(item.amount)]));
  // Faturasız borç hareketleri (tarih yeniden eskiye): fatura satırı faturanın kalemidir; taksit kartının borcu taksit kalemlerindedir (cari satırı değil).
  const moves = new Map();
  const hasEntries = Boolean(store.get("SELECT 1 AS found FROM sqlite_master WHERE type = 'table' AND name = 'account_entries'"));
  if (hasEntries) {
    for (const row of store.all("SELECT id, account_id AS accountId, date, amount FROM account_entries WHERE kind IN ('debt', 'out') AND source <> 'invoice' AND amount > 0 ORDER BY date DESC, created_at DESC, rowid DESC")) {
      if (skip?.has(row.id)) continue;
      if (!moves.has(row.accountId)) moves.set(row.accountId, []);
      moves.get(row.accountId).push(row);
    }
  }
  const unbilled = [];
  for (const account of accounts) {
    const own = byAccount.get(account.id) || [];
    const balance = Math.max(0, cents(account.balance));
    let rest = balance - own.reduce((sum, item) => sum + kept.get(item), 0);
    if (rest < 0) {
      // Kaleme bağlanmamış alacak (tahsilat): en eski kalemden düşer.
      for (const item of own.slice().sort((a, b) => (a.date < b.date ? -1 : a.date > b.date ? 1 : 0))) {
        if (rest >= 0) break;
        const take = Math.min(kept.get(item), -rest);
        kept.set(item, kept.get(item) - take);
        rest += take;
      }
      continue;
    }
    if (rest === 0) continue;
    for (const move of moves.get(account.id) || []) {
      if (rest <= 0) break;
      const part = Math.min(cents(move.amount), rest);
      unbilled.push({ accountId: account.id, name: account.name, date: move.date, amount: part / 100 });
      rest -= part;
    }
    // Dağıtılacak faturasız hareket kalmadıysa (ör. taksit/fatura kalemi tahsilatla kapanmış ama cari satırı eksi değil): carinin en eski hareket günü.
    if (rest > 0) {
      const oldest = (moves.get(account.id) || []).at(-1)?.date || own.map(item => item.date).sort()[0] || day;
      unbilled.push({ accountId: account.id, name: account.name, date: oldest, amount: rest / 100 });
    }
  }
  return { items: items.filter(item => !item.accountId || kept.get(item) > 0).map(item => (item.accountId && kept.get(item) !== cents(item.amount) ? { ...item, amount: kept.get(item) / 100, partial: true } : item)), unbilled };
}
