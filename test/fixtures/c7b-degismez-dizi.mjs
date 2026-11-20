// 2.5.0 Ç7b tur 2f — kabul F'nin rastgele (tohumlu, tekrarlanabilir) işlem dizisi: test/c7b-degismez-250.test.mjs ve eski kodla karşılaştırma (cari / Kasa / stok / taksit
// bakiyeleri Ç7b'den önce ve sonra AYNI — kural yalnız defter hesabını değiştirir). Dizi programın yalnız API'sini kullanır; modeli (beklenen alt hesap toplamları) testin kendi toplamıdır.
// Eylül–Kasım 2026; kilitsiz dosya (kural geçişi yok → bütün kayıt tahsilatları 336.90, iade KDV'leri yeni yönde).

/** Tohumlu sözde rastgele (mulberry32). */
export function rng(seed) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const MONTHS = ["2026-09", "2026-10", "2026-11"];
const AMOUNTS = [100, 150, 200, 250, 300, 400, 500, 750, 1000];

/**
 * Dizi: her ay için aynı torba (Kasa ±, Borç / Alacak Yaz, stok veresiye / peşin satış ve iadesi, taksit Yeni Borç / Mevcut Borç, kayıt tahsilatı, satış, ihracat, alış, iki iade), tohumla
 * karılır; iade, asıl faturası henüz yazılmadıysa sona ertelenir. Dönüş: [{ op, date, amount, ... }].
 */
export function sequence(seed, { perMonth = 1 } = {}) {
  const random = rng(seed);
  const pick = list => list[Math.floor(random() * list.length)];
  const day = () => String(2 + Math.floor(random() * 26)).padStart(2, "0");
  const ops = [];
  let n = 0;
  for (const m of MONTHS) {
    for (let k = 0; k < perMonth; k += 1) {
      for (const op of ["cashIn", "cashOut", "debt", "credit", "stockSale", "stockReturn", "cashSale", "cashReturn", "planNew", "planCovers", "casePayment", "export"]) ops.push({ op, date: `${m}-${day()}`, amount: pick(AMOUNTS), party: pick(["M1", "M2"]) });
      const s = `S${(n += 1)}`;
      const p = `P${n}`;
      const sd = `${m}-${day()}`;
      const pd = `${m}-${day()}`;
      ops.push({ op: "sale", key: s, date: sd, amount: pick(AMOUNTS), party: pick(["M1", "M2"]) });
      ops.push({ op: "purchase", key: p, date: pd, amount: pick(AMOUNTS) });
      // İade asıl belgeyle aynı gün ya da sonra, aynı ay içinde (iade kendi ayında).
      const later = d => `${m}-${String(Math.min(28, Number(d.slice(8)) + Math.floor(random() * 3))).padStart(2, "0")}`;
      ops.push({ op: "saleReturn", of: s, date: later(sd) });
      ops.push({ op: "purchaseReturn", of: p, date: later(pd) });
    }
  }
  for (let i = ops.length - 1; i > 0; i -= 1) {
    const j = Math.floor(random() * (i + 1));
    [ops[i], ops[j]] = [ops[j], ops[i]];
  }
  // Programın numaraladığı seri tarih sırası ister ("numara ve tarih sırası uyuşmalı" — bugünkü kural; satış, ihracat ve İKİ iade aynı seride): faturalar kendi yuvalarında tarihe göre
  // dizilir (öbür işlemlerle karışık sıra korunur; aynı gün asıl belge iadeden önce).
  const numbered = new Set(["sale", "export", "saleReturn", "purchase", "purchaseReturn"]);
  const isReturn = op => (op.of ? 1 : 0);
  const slots = ops.map((op, i) => (numbered.has(op.op) ? i : -1)).filter(i => i >= 0);
  const sorted = slots.map(i => ops[i]).sort((a, b) => a.date.localeCompare(b.date) || isReturn(a) - isReturn(b));
  slots.forEach((slot, k) => (ops[slot] = sorted[k]));
  const done = new Set();
  const out = [];
  const waiting = [];
  for (const op of ops) {
    if (op.of && !done.has(op.of)) waiting.push(op);
    else {
      out.push(op);
      if (op.key) done.add(op.key);
    }
  }
  return [...out, ...waiting];
}

/**
 * Diziyi programa uygular. ctx = { api, store, ids } (ids: M1, M2, T1, item — hazırlıkta açılır). Her işlemden sonra onStep({ op, model }) çağrılır.
 * model: { case: kayıt tahsilatları Σ, sale: belgesiz satış Σ (stok satışı + Yeni Borç), ret: belgesiz iade Σ } (TL).
 */
export async function apply(ctx, ops, onStep = async () => {}) {
  const { api, store, ids, must } = ctx;
  const model = { case: 0, sale: 0, ret: 0 };
  const docs = {};
  let n = 0;
  const card = id => must("fatura", api.get(`/api/workspace/invoices/${id}`));
  for (const item of ops) {
    const { op, date, amount } = item;
    const party = ids[item.party];
    const money = String(amount);
    switch (op) {
      case "cashIn":
      case "cashOut":
        await must(op, api.post("/api/workspace/cash", { kind: op === "cashIn" ? "in" : "out", amount: money, method: "cash", date, description: `Dizi ${op}` }));
        break;
      case "debt":
      case "credit":
        await must(op, api.post(`/api/workspace/accounts/${party}/entries`, { kind: op, amount: money, date, note: `Dizi ${op}` }));
        break;
      case "stockSale":
      case "cashSale":
        await must(op, api.post(`/api/workspace/stock/${ids.item}/moves`, { date, kind: "out", qty: "1", unitPrice: money, ...(op === "stockSale" ? { pay: "account", accountId: party } : { pay: "cash", method: "cash" }), note: `Dizi ${op}` }));
        model.sale += amount;
        break;
      case "stockReturn":
      case "cashReturn":
        await must(op, api.post(`/api/workspace/stock/${ids.item}/moves`, { date, kind: "in", qty: "1", unitPrice: money, reason: "return", ...(op === "stockReturn" ? { pay: "account", accountId: party } : { pay: "cash", method: "cash" }), note: `Dizi ${op}` }));
        model.ret += amount;
        break;
      case "planNew":
      case "planCovers":
        // Mevcut Borcu Taksitlendir taksitlenmemiş borç ister (bugünkü kural): aynı gün aynı tutarda Borç Yaz önce.
        if (op === "planCovers") await must("Borç Yaz (kart için)", api.post(`/api/workspace/accounts/${party}/entries`, { kind: "debt", amount: money, date, note: "Dizi kart borcu" }));
        await must(op, api.post("/api/workspace/plans", { accountId: party, name: `Dizi ${op} ${(n += 1)}`, total: money, registeredOn: date, mode: "auto", count: 2, firstDue: "2027-01-05", ...(op === "planCovers" ? { coversBalance: true } : {}) }));
        if (op === "planNew") model.sale += amount;
        break;
      case "casePayment":
        await must(op, api.post(`/api/workspace/cases/DIZI-${(n += 1)}/payments`, { amount: money, date, method: "cash", caseTitle: `Dizi ${n}` }));
        model.case += amount;
        break;
      case "export":
        await must(op, api.post("/api/workspace/invoices", { scenario: "service_sale", accountId: party, issueDate: date, lines: [{ name: "Yurt Dışı Hizmet", qty: 1, unitPrice: amount, vatRate: 0, exemptionCode: "301" }], payment: { rest: "open" } }));
        break;
      case "sale":
        docs[item.key] = (await must(op, api.post("/api/workspace/invoices", { scenario: "service_sale", accountId: party, issueDate: date, lines: [{ name: "Hizmet", qty: 2, unitPrice: amount, vatRate: 20 }], payment: { rest: "open" } }))).id;
        docs[`${item.key}:party`] = party;
        break;
      case "purchase":
        docs[item.key] = (await must(op, api.post("/api/workspace/invoices", { kind: "purchase", scenario: "expense_purchase", accountId: ids.T1, issueDate: date, number: `DZ-${(n += 1)}`, lines: [{ name: "Kırtasiye", qty: 2, unitPrice: amount, vatRate: 20, expenseCode: "office" }], payment: { rest: "open" } }))).id;
        break;
      case "saleReturn":
        await must(op, api.post("/api/workspace/invoices", { kind: "sale_return", accountId: docs[`${item.of}:party`], originalId: docs[item.of], issueDate: date, lines: [{ originLineId: (await card(docs[item.of])).lines[0].id, qty: 1 }], payment: { cash: [] }, force: true }));
        break;
      case "purchaseReturn":
        await must(op, api.post("/api/workspace/invoices", { kind: "purchase_return", accountId: ids.T1, originalId: docs[item.of], issueDate: date, number: `DZI-${(n += 1)}`, lines: [{ originLineId: (await card(docs[item.of])).lines[0].id, qty: 1 }], payment: { cash: [] }, force: true }));
        break;
      default:
        throw new Error(`bilinmeyen işlem ${op}`);
    }
    await onStep({ item, model, store });
  }
  return model;
}

/** Hazırlık: Kasa açılışı (eksi Kasa reddi çıkmasın; 519), iki müşteri, bir tedarikçi, bol stoklu ürün (eksi stok sorusu çıkmasın). */
export async function prepare({ api, must }) {
  const ids = {};
  await must("Kasa açılışı", api.post("/api/workspace/cash/opening", { amount: "100.000", date: "2026-09-01" }));
  for (const [key, name, type] of [["M1", "Dizi Müşteri Bir", "customer"], ["M2", "Dizi Müşteri İki", "customer"], ["T1", "Dizi Tedarikçi", "supplier"]]) ids[key] = (await must(name, api.post("/api/workspace/accounts", { name, type, registeredOn: "2026-08-01" }))).id;
  const item = await must("ürün", api.post("/api/workspace/stock", { name: "Dizi Ürün", unit: "Adet", kind: "product", code: "DZ-1", unitPrice: "100", vatRate: "20" }));
  ids.item = item.id || item.item?.id;
  await must("stok girişi", api.post(`/api/workspace/stock/${ids.item}/moves`, { date: "2026-09-01", kind: "in", qty: "1000", unitPrice: "50", pay: "account", accountId: ids.T1, note: "Açılış alımı" }));
  return ids;
}
