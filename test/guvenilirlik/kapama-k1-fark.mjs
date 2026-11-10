// K1 (iade kapanışı, v2.1.0) eski veride: güncel kapama kuralıyla K1 öncesi kuralın (test/guvenilirlik/kapama-k1-oncesi.mjs, dondurulmuş kopya)
// aynı veride gösterdiği fatura ödeme durumları karşılaştırılır. Altın test ve göç zinciri 2.0.26 ile birebir karşılaştırmayı K1 öncesi kuralla
// yapar (göçün ve tek kaynağın etkisi); bu yardımcı K1'in etkisini ayrıca sınırlar ve denetler:
//   - durumu değişen her fatura, iadesi (kaydedilmiş satıştan ya da alıştan iade) olan bir carinindir (K1 iade olmayan cariye dokunmaz);
//   - durumu değişen taksitli faturanın açığı kendi kartının kalanına eşittir (K1: "taksitli faturanın açığı = kartın kalanı");
//   - iade belgesinin açığı eksi değil, ödenecek tutarını aşmaz; ödenen + açık = ödenecek (bütün belgelerde).
// (Bu dosya test değildir: adı ".test.mjs" ile bitmez.)
const cents = value => Math.round((Number(value) || 0) * 100);

/** Bu şirketin kaydedilmiş belgeleri: kimlik → { kind, accountId, planId, payState, paid, open, payable } (kuruş). */
export async function invoiceStates(api) {
  const list = [];
  for (let offset = 0; ; offset += 5000) {
    const response = await api.get(`/api/workspace/invoices?tab=all&limit=5000&offset=${offset}`);
    if (response.status !== 200) throw new Error(`fatura listesi: ${response.status}`);
    list.push(...(response.data.invoices || []));
    if (!response.data.hasMore) break;
  }
  const out = new Map();
  for (const doc of list) {
    if (doc.status !== "issued") continue;
    out.set(doc.id, { number: doc.number, kind: doc.kind, accountId: doc.accountId, planId: doc.planId || "", payState: doc.payState, paid: cents(doc.paid), open: cents(doc.open), payable: cents(doc.tryPayable) });
  }
  return out;
}

/**
 * before: K1 öncesi kuralla okunan durumlar (invoiceStates), api: güncel kuralla açılmış sunucu (aynı veri, aynı şirket seçili).
 * ledgerStates (2.5.0 Ç5-B): ekrandaki fatura durumu artık Tek Yükümlülük Kuyruğu görünümüdür (S2, karar (1), S50, M1e — iadesi olmayan caride de BİLEREK değişir);
 * K1'in sınırı KAPAMA DEFTERİ kuralında (lib/invoice-settle.mjs, Ç5-B'de değişmedi) denetlenir: verilirse (fatura kimlikleri → durum haritası, ör. sunucunun
 * invoices.repairScreen'i) güncel durum oradan okunur; ekran durumu ayrıca yalnız tutarlılık için (ödenen + açık = ödenecek, açık aralıkta) denetlenir.
 * Dönüş: { changed: [{ number, kind, before, after }], problems: [metin] }.
 */
export async function k1Check(before, api, { ledgerStates = null } = {}) {
  const screen = await invoiceStates(api);
  const after = new Map(screen);
  if (ledgerStates) {
    const states = ledgerStates([...screen.keys()]);
    for (const [id, doc] of screen) {
      const state = states.get(id);
      if (state) after.set(id, { ...doc, payState: state.state, paid: cents(state.paid), open: cents(state.open) });
    }
  }
  const problems = [];
  if (ledgerStates) {
    for (const doc of screen.values()) {
      if (doc.paid + doc.open !== doc.payable) problems.push(`${doc.number}: ekranda ödenen ${doc.paid} + açık ${doc.open} ≠ ${doc.payable} (kuruş)`);
      if (doc.open < 0 || doc.open > doc.payable) problems.push(`${doc.number}: ekranda açık ${doc.open} aralık dışı`);
    }
  }
  const changed = [];
  const withReturns = new Set([...after.values()].filter(doc => doc.kind === "sale_return" || doc.kind === "purchase_return").map(doc => doc.accountId));
  if (before.size !== after.size) problems.push(`kaydedilmiş belge sayısı ${before.size} ≠ ${after.size}`);
  for (const [id, doc] of after) {
    if (doc.paid + doc.open !== doc.payable) problems.push(`${doc.number}: ödenen ${doc.paid} + açık ${doc.open} ≠ ${doc.payable} (kuruş)`);
    if (doc.open < 0 || doc.open > doc.payable) problems.push(`${doc.number}: açık ${doc.open} aralık dışı`);
    const old = before.get(id);
    if (!old) {
      problems.push(`${doc.number}: K1 öncesi okumada yok`);
      continue;
    }
    if (old.payState === doc.payState && old.paid === doc.paid && old.open === doc.open) continue;
    changed.push({ number: doc.number, kind: doc.kind, before: [old.payState, old.paid, old.open], after: [doc.payState, doc.paid, doc.open] });
    if (!withReturns.has(doc.accountId)) problems.push(`${doc.number}: iadesi olmayan caride durum değişti ${JSON.stringify([old.payState, old.paid, old.open])} → ${JSON.stringify([doc.payState, doc.paid, doc.open])}`);
    if (doc.planId && doc.kind === "sale") {
      const plan = await api.get(`/api/workspace/plans/${doc.planId}`);
      if (plan.status === 200 && plan.data.status !== "closed" && cents(plan.data.totals?.remaining) !== doc.open) problems.push(`${doc.number}: taksitli faturanın açığı ${doc.open} ≠ kartın kalanı ${cents(plan.data.totals?.remaining)} (kuruş)`);
    }
  }
  return { changed, problems };
}
