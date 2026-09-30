// Dört çekirdek mutabakat motoru (v2.0.13): Kasa, Stok, Cari ve Taksit.
//
// Programı gerçek HTTP API'si üzerinden (arayüzün kullandığı uçlar) rastgele ama tekrarlanabilir işlemlerle sürer ve
// yanında programdan HİÇ okumadan kendi defterini tutar (bağımsız model). Model tutarları kuruş, miktarları binde bir,
// birim fiyatları on binde bir TAMSAYI olarak tutar; satır tutarını BigInt ile tam yuvarlar (yarım kuruş sıfırdan uzağa).
//
// Senaryo ekseni:
//   · Kronoloji: işlemler 120 gün önceden bugüne sıralı ilerleyen bir zaman çizelgesinde tarihlenir (geri gitmez).
//   · Dönem kilidi: çizelgenin %35'inde ve %70'inde yönetici geçmiş dönemi kilitler; kilit altındaki hareket eklenemez,
//     düzeltilemez, silinemez (409 period-locked) — motor bunu bilinçli olarak dener.
//   · Hatalı tarih: boş, null, "2026-13-40", "31.12.2026", "2026-02-30", "abc", ileri tarih; vadesi işlem tarihinden
//     önce olan taksit/satış — hepsi 400 ile reddedilmeli ve hiçbir iz bırakmamalı.
//   · Eksiye düşürme: nakit kasayı eksiye düşürecek çıkış/düzeltme/silme onaysız 409 (cash-negative), stok eksiye onaysız
//     ret; taksit kartında tahsil edilenden fazla iade 400 (refund-exceeds).
//   · Eşzamanlılık: aynı ürün ve carilere aynı anda istek yağmuru.
//
// Her işlemden sonra (verifyEvery):
//   · Kasa ve Banka (nakit / havale / kredi kartı) = model
//   · her carinin bakiyesi, her ürünün miktarı, her taksit kartının tutarı ve net tahsilatı = model
//   · işlem zinciri: Kasa'daki satırlar kaynağına göre (elle, cari, stok, taksit) sayı ve tutar olarak = model
//     (satış Kasa'ya düştü mü, tahsilat Kasa'ya düştü mü; havada asılı ya da eksik kalan halka yok)
//   · programın mutabakat kapısı: çift yönlü denge, ana defter ↔ alt defterler (toplam ve cari bazında), tarih denetimleri
//   · ana defter kasa ve cari hesapları = model
// Belirli aralıklarla ve sonda: raporlar (Kasa Hareketleri, Stok Hareketleri, Cari Listesi, Taksit Kartları, Hesap Planı
// Mizanı, Yevmiye) veri varken boş dönmemeli, tutarları modelle aynı olmalı; veri olmayan aralıkta gerçekten boş dönmeli.

const MONEY = ["cash", "bank", "card"];

// ---------- Tekrarlanabilir rastgelelik ----------
export function rng(seed) {
  let s = seed >>> 0 || 1;
  const next = () => {
    s ^= s << 13; s >>>= 0;
    s ^= s >>> 17;
    s ^= s << 5; s >>>= 0;
    return s / 4294967296;
  };
  return { next, int: (a, b) => a + Math.floor(next() * (b - a + 1)), pick: list => list[Math.floor(next() * list.length)], chance: p => next() < p };
}

// ---------- Tam sayı aritmetiği ve tarih ----------
const halfAway = (num, den) => {
  const n = BigInt(num), d = BigInt(den);
  const sign = n < 0n ? -1n : 1n;
  const a = n < 0n ? -n : n;
  return Number(sign * ((2n * a + d) / (2n * d)));
};
export const lineCents = (qtyMilli, price4) => halfAway(BigInt(qtyMilli) * BigInt(price4), 100000n);
const tl = cents => `${cents < 0 ? "-" : ""}${Math.floor(Math.abs(cents) / 100)},${String(Math.abs(cents) % 100).padStart(2, "0")}`;
const qtyText = milli => `${Math.floor(milli / 1000)}${milli % 1000 ? `,${String(milli % 1000).padStart(3, "0").replace(/0+$/, "")}` : ""}`;
const priceText = p4 => `${Math.floor(p4 / 10000)},${String(p4 % 10000).padStart(4, "0")}`;
const centsOf = value => Math.round(Number(value) * 100);
const centsOfText = text => {
  const t = String(text || "").replace(/[^\d,-]/g, "");
  return t ? Math.round(Number(t.replace(",", ".")) * 100) : 0;
};
export const addDays = (iso, days) => {
  const [y, m, d] = iso.split("-").map(Number);
  const x = new Date(Date.UTC(y, m - 1, d + days));
  return `${x.getUTCFullYear()}-${String(x.getUTCMonth() + 1).padStart(2, "0")}-${String(x.getUTCDate()).padStart(2, "0")}`;
};

export async function runReconciliation({ client, seed = 1, operations = 500, verifyEvery = 1, reportEvery = 50, burst = 40, span = 120, log = () => {} }) {
  const R = rng(seed);
  const api = async (method, url, body) => {
    const response = await (method === "GET" ? client.get(url) : method === "DELETE" ? client.del(url) : method === "PUT" ? client.put(url, body) : client.post(url, body));
    const data = response.data?.data ?? response.data;
    return { status: response.status, data, code: response.data?.code || data?.code || "", text: JSON.stringify(response.data || "").slice(0, 400) };
  };
  const T = (await api("GET", "/api/workspace/ledger/lock")).data.today;
  const D0 = addDays(T, -span);
  let cur = D0;
  let lock = "";
  const open = date => !lock || date > lock;

  // ---------- Bağımsız model ----------
  const M = { kasa: { cash: 0, bank: 0, card: 0 }, cari: new Map(), stok: new Map(), plans: new Map(), cash: [], entries: [], moves: [], planEntries: [] };
  const report = { seed, operations: 0, byKind: {}, rejectedAsExpected: 0, rejections: {}, mismatches: [], checks: 0, reportChecks: 0, integrityMs: [], timeline: { from: D0, to: T }, locks: [] };
  const count = kind => (report.byKind[kind] = (report.byKind[kind] || 0) + 1);
  const accounts = [];
  const items = [];
  const cariAdd = (id, cents) => M.cari.set(id, (M.cari.get(id) || 0) + cents);
  const planLeft = p => Math.max(0, p.total - Math.max(0, p.paid));
  const uncovered = accountId => Math.max(0, (M.cari.get(accountId) || 0) - [...M.plans.values()].filter(p => p.accountId === accountId && p.covers && p.status === "active").reduce((s, p) => s + planLeft(p), 0));
  // Kasa'ya etkiler (tarihli): nakit eksi korumasının modeli ve işlem zinciri denetimi bunlardan hesaplanır.
  function cashEffects() {
    const out = [];
    for (const e of M.cash) out.push({ source: "manual", date: e.date, method: e.method, cents: e.kind === "in" ? e.amount : -e.amount });
    for (const e of M.entries) if (e.kind === "in" || e.kind === "out") out.push({ source: "account", date: e.date, method: e.method, cents: e.kind === "in" ? e.amount : -e.amount });
    for (const m of M.moves) if (m.pay === "cash" && m.amount > 0) out.push({ source: "stock", date: m.date, method: m.method, cents: m.kind === "out" ? m.amount : -m.amount });
    for (const e of M.planEntries) out.push({ source: "plan", date: e.date, method: e.method, cents: e.kind === "in" ? e.amount : -e.amount });
    return out;
  }
  const cashAt = date => cashEffects().filter(x => x.method === "cash" && (!date || x.date <= date)).reduce((s, x) => s + x.cents, 0);
  // Program: min(o tarihteki nakit, son nakit) − çıkış < 0 ise onaysız reddeder.
  const cashBlocks = (outCents, date) => outCents > 0 && Math.min(cashAt(date), cashAt("")) - outCents < 0;

  // ---------- Kurulum: cariler ve ürünler ----------
  for (let i = 0; i < 12; i++) {
    const type = i < 8 ? "customer" : i < 11 ? "supplier" : "other";
    // İki müşteri aynı adla: eşleşme addan değil kimlikten yapılmalı.
    const name = i === 1 || i === 2 ? `Aynı Ad Müşteri T${seed}` : `${type === "customer" ? "Müşteri" : type === "supplier" ? "Tedarikçi" : "Personel"} ${i + 1} T${seed}`;
    const r = await api("POST", "/api/workspace/accounts", { name, type, phone: `0532 ${String(seed % 1000).padStart(3, "0")} 00 ${String(10 + i)}`, registeredOn: D0 });
    if (r.status !== 200) throw new Error(`cari açılamadı: ${r.status} ${r.text}`);
    accounts.push({ id: r.data.id, type, name });
    M.cari.set(r.data.id, 0);
  }
  for (let i = 0; i < 10; i++) {
    const kg = i % 3 === 0;
    const cost4 = R.int(1_0000, 900_0000);
    const r = await api("POST", "/api/workspace/stock", { name: `Ürün ${i + 1} T${seed}`, unit: kg ? "Kg" : "Adet", unitPrice: priceText(cost4), salePrice: priceText(Math.round(cost4 * 1.3)) });
    if (r.status !== 200) throw new Error(`ürün açılamadı: ${r.status} ${r.text}`);
    items.push({ id: r.data.id, kg, cost4, sale4: Math.round(cost4 * 1.3) });
    M.stok.set(r.data.id, 0);
  }
  const customers = accounts.filter(a => a.type === "customer");
  const suppliers = accounts.filter(a => a.type === "supplier");

  // ---------- Doğrulama ----------
  async function verify(where) {
    report.checks += 1;
    const problems = [];
    const cash = (await api("GET", "/api/workspace/cash")).data;
    for (const m of MONEY) if (centsOf(cash.byMethod[m] || 0) !== M.kasa[m]) problems.push(`Kasa ${m}: program ${cash.byMethod[m]} · model ${tl(M.kasa[m])}`);
    // İşlem zinciri: Kasa satırları kaynağına göre sayı ve tutar (satış → Kasa, tahsilat → Kasa, taksit → Kasa).
    const want = new Map();
    for (const x of cashEffects()) {
      const k = want.get(x.source) || { n: 0, cents: 0 };
      k.n += 1; k.cents += x.cents;
      want.set(x.source, k);
    }
    const got = new Map();
    for (const e of cash.entries) {
      const k = got.get(e.source) || { n: 0, cents: 0 };
      k.n += 1; k.cents += e.kind === "in" ? centsOf(e.amount) : -centsOf(e.amount);
      got.set(e.source, k);
    }
    for (const source of ["manual", "account", "stock", "plan"]) {
      const a = got.get(source) || { n: 0, cents: 0 }, b = want.get(source) || { n: 0, cents: 0 };
      if (a.n !== b.n || a.cents !== b.cents) problems.push(`İşlem zinciri Kasa/${source}: program ${a.n} satır ${tl(a.cents)} · model ${b.n} satır ${tl(b.cents)}`);
    }
    const list = (await api("GET", "/api/workspace/accounts?status=all&limit=500")).data.accounts;
    for (const a of list) if (M.cari.has(a.id) && centsOf(a.balance) !== M.cari.get(a.id)) problems.push(`Cari ${a.name} (${a.refNo}): program ${a.balance} · model ${tl(M.cari.get(a.id))}`);
    const stock = (await api("GET", "/api/workspace/stock")).data.items;
    for (const s of stock) if (M.stok.has(s.id) && Math.round(s.qty * 1000) !== M.stok.get(s.id)) problems.push(`Stok ${s.name}: program ${s.qty} · model ${qtyText(M.stok.get(s.id))}`);
    const plans = (await api("GET", "/api/workspace/plans?status=all")).data.plans || [];
    const seen = new Set();
    for (const p of plans) {
      const m = M.plans.get(p.id);
      if (!m) continue;
      seen.add(p.id);
      if (centsOf(p.totals.total) !== m.total || centsOf(p.totals.paid) !== m.paid) problems.push(`Taksit kartı ${p.name}: program ${p.totals.total}/${p.totals.paid} · model ${tl(m.total)}/${tl(m.paid)}`);
      if ((p.status === "closed") !== (m.status === "closed")) problems.push(`Taksit kartı ${p.name}: durum ${p.status} · model ${m.status}`);
    }
    for (const [id, p] of M.plans) if (!seen.has(id)) problems.push(`Taksit kartı ${id}: programda yok (model ${tl(p.total)})`);
    const integrity = (await api("GET", "/api/workspace/ledger/integrity")).data;
    report.integrityMs.push(integrity.durationMs);
    if (!integrity.ok) problems.push(`Mutabakat kapısı: ${integrity.failures.map(f => `${f.name}${f.difference ? ` (${f.difference})` : ""}${f.sample?.length ? ` [${f.sample.join("; ")}]` : ""}`).join(" | ")}`);
    const ledger = (await api("GET", "/api/workspace/ledger")).data;
    if (!ledger.trial.balanced || ledger.trial.totals.difference !== 0) problems.push(`Mizan dengesiz: borç ${ledger.trial.totals.debit} alacak ${ledger.trial.totals.credit}`);
    const gl = code => centsOf(ledger.trial.accounts.find(a => a.code === code)?.balance || 0);
    if (gl("100") !== M.kasa.cash || gl("102") !== M.kasa.bank || gl("108") !== M.kasa.card) problems.push(`Ana defter kasa hesapları ≠ model: 100 ${gl("100") / 100}, 102 ${gl("102") / 100}, 108 ${gl("108") / 100}`);
    const byType = t => accounts.filter(a => a.type === t).reduce((s, a) => s + (M.cari.get(a.id) || 0), 0);
    if (gl("120") !== byType("customer") || gl("320") !== byType("supplier") || gl("336") !== byType("other")) problems.push(`Ana defter cari hesapları ≠ model: 120 ${gl("120") / 100}/${byType("customer") / 100}, 320 ${gl("320") / 100}/${byType("supplier") / 100}, 336 ${gl("336") / 100}/${byType("other") / 100}`);
    if (problems.length) report.mismatches.push({ at: where, problems });
    return problems;
  }
  // Raporlar: veri varken boş dönmesin, tutarlar modelle aynı olsun; veri olmayan aralık gerçekten boş dönsün.
  async function verifyReports(where) {
    report.reportChecks += 1;
    const problems = [];
    const rc = async (id, from, to, extra = "") => {
      const r = await api("GET", `/api/workspace/report-center/${id}?from=${from}&to=${to}${extra}`);
      if (r.status !== 200) problems.push(`Rapor ${id} (${from}–${to}) açılamadı: ${r.status} ${r.text}`);
      return r.status === 200 ? r.data : { rows: [], total: 0, summary: [] };
    };
    const sum = (rep, label) => centsOfText(rep.summary.find(([k]) => k === label)?.[1]);
    const ranges = [[D0, T], [D0, cur], [lock ? addDays(lock, 1) : addDays(D0, 30), T], [addDays(D0, -400), addDays(D0, -1)]].filter(([a, b]) => a <= b);
    for (const [from, to] of ranges) {
      const effects = cashEffects().filter(x => x.date >= from && x.date <= to);
      const kasa = await rc("kasa-hareketleri", from, to);
      const rows = kasa.total - 1; // ilk satır devir
      if (rows !== effects.length) problems.push(`Kasa Hareketleri ${from}–${to}: rapor ${rows} satır · model ${effects.length}${effects.length && !rows ? " (VERİ VARKEN BOŞ)" : ""}`);
      const inCents = effects.filter(x => x.cents > 0).reduce((s, x) => s + x.cents, 0), outCents = -effects.filter(x => x.cents < 0).reduce((s, x) => s + x.cents, 0);
      if (sum(kasa, "Dönem Giriş") !== inCents || sum(kasa, "Dönem Çıkış") !== outCents) problems.push(`Kasa Hareketleri ${from}–${to}: giriş/çıkış ${tl(sum(kasa, "Dönem Giriş"))}/${tl(sum(kasa, "Dönem Çıkış"))} · model ${tl(inCents)}/${tl(outCents)}`);
      const moves = M.moves.filter(m => m.date >= from && m.date <= to);
      const stok = await rc("stok-hareketleri", from, to);
      if (stok.total !== moves.length) problems.push(`Stok Hareketleri ${from}–${to}: rapor ${stok.total} · model ${moves.length}${moves.length && !stok.total ? " (VERİ VARKEN BOŞ)" : ""}`);
      const stockIn = moves.filter(m => m.kind === "in").reduce((s, m) => s + m.stored, 0), stockOut = moves.filter(m => m.kind === "out").reduce((s, m) => s + m.stored, 0);
      if (sum(stok, "Giriş Tutarı") !== stockIn || sum(stok, "Çıkış Tutarı") !== stockOut) problems.push(`Stok Hareketleri ${from}–${to}: tutar ${tl(sum(stok, "Giriş Tutarı"))}/${tl(sum(stok, "Çıkış Tutarı"))} · model ${tl(stockIn)}/${tl(stockOut)}`);
    }
    const cari = await rc("cari-listesi", "", "");
    if (cari.total < accounts.length) problems.push(`Cari Listesi: ${cari.total} satır · en az ${accounts.length} cari olmalı${!cari.total ? " (VERİ VARKEN BOŞ)" : ""}`);
    const kartlar = await rc("taksit-kartlari", "", "", "&planStatus=all");
    if (kartlar.total !== M.plans.size) problems.push(`Taksit Kartları (Tüm Kartlar): ${kartlar.total} satır · model ${M.plans.size}${M.plans.size && !kartlar.total ? " (VERİ VARKEN BOŞ)" : ""}`);
    const planTotal = [...M.plans.values()].reduce((s, p) => s + p.total, 0), planPaid = [...M.plans.values()].reduce((s, p) => s + p.paid, 0);
    if (sum(kartlar, "Toplam") !== planTotal || sum(kartlar, "Ödenen") !== planPaid) problems.push(`Taksit Kartları: toplam/ödenen ${tl(sum(kartlar, "Toplam"))}/${tl(sum(kartlar, "Ödenen"))} · model ${tl(planTotal)}/${tl(planPaid)}`);
    const mizan = await rc("hesap-mizani", D0, T);
    if (!mizan.total) problems.push("Hesap Planı Mizanı: veri varken boş");
    const yevmiye = await rc("yevmiye", D0, T);
    if (!yevmiye.total) problems.push("Yevmiye Defteri: veri varken boş");
    if (problems.length) report.mismatches.push({ at: where, problems });
    return problems;
  }

  // ---------- İşlemler ----------
  const methodPick = () => R.pick(["cash", "cash", "bank", "card"]);
  const moneyCents = (a, b) => R.int(a, b) * 100 + (R.chance(0.7) ? R.int(0, 99) : 0);
  const pickOpen = list => R.pick(list.filter(x => open(x.date)));
  function mustOk(r, kind) {
    if (r.status !== 200) throw Object.assign(new Error(`${kind}: beklenmeyen ret ${r.status} ${r.text}`), { unexpected: true });
  }
  function expectReject(r, codes, kind) {
    if (r.status === 200) throw Object.assign(new Error(`${kind}: reddedilmesi gerekirken kaydedildi (${[].concat(codes || "stok eksiye").join("/")})`), { unexpected: true });
    const list = [].concat(codes || []);
    if (list.length && !list.some(code => r.code === code || r.text.includes(code))) throw Object.assign(new Error(`${kind}: yanlış ret ${r.status} ${r.text}`), { unexpected: true });
    report.rejectedAsExpected += 1;
    const key = list[0] || String(r.status);
    report.rejections[key] = (report.rejections[key] || 0) + 1;
  }

  async function op(kind) {
    count(kind);
    const acc = R.pick(accounts);
    const cust = R.pick(customers);
    const item = R.pick(items);
    const day = cur;
    switch (kind) {
      case "kasa": {
        const k = R.chance(0.55) ? "in" : "out";
        const method = methodPick();
        const amount = moneyCents(1, 40000);
        const force = R.chance(0.5);
        const r = await api("POST", "/api/workspace/cash", { kind: k, amount: tl(amount), method, description: `Kasa ${k}`, date: day, cashForce: force });
        if (k === "out" && method === "cash" && !force && cashBlocks(amount, day)) return expectReject(r, "cash-negative", kind);
        mustOk(r, kind);
        M.kasa[method] += k === "in" ? amount : -amount;
        M.cash.push({ id: r.data.id, kind: k, amount, method, date: day });
        return;
      }
      case "kasa-duzelt": {
        const e = pickOpen(M.cash);
        if (!e) return;
        const amount = moneyCents(1, 40000);
        const method = methodPick();
        const eff = x => (x.method === "cash" ? (x.kind === "in" ? x.amount : -x.amount) : 0);
        const delta = eff({ ...e, amount, method }) - eff(e);
        const force = R.chance(0.5);
        const r = await api("PUT", `/api/workspace/cash/${e.id}`, { kind: e.kind, amount: tl(amount), method, description: "Düzeltildi", date: e.date, cashForce: force });
        if (!force && delta < 0 && cashBlocks(-delta, e.date)) return expectReject(r, "cash-negative", kind);
        mustOk(r, kind);
        M.kasa[e.method] -= e.kind === "in" ? e.amount : -e.amount;
        M.kasa[method] += e.kind === "in" ? amount : -amount;
        Object.assign(e, { amount, method });
        return;
      }
      case "kasa-sil": {
        const e = pickOpen(M.cash);
        if (!e) return;
        const force = R.chance(0.5);
        const r = await api("DELETE", `/api/workspace/cash/${e.id}${force ? "?cashForce=1" : ""}`);
        if (!force && e.method === "cash" && e.kind === "in" && cashBlocks(e.amount, e.date)) return expectReject(r, "cash-negative", kind);
        mustOk(r, kind);
        M.kasa[e.method] -= e.kind === "in" ? e.amount : -e.amount;
        M.cash.splice(M.cash.indexOf(e), 1);
        return;
      }
      case "cari": {
        const k = R.pick(["debt", "credit", "in", "out"]);
        const method = methodPick();
        const amount = moneyCents(1, 60000);
        const force = R.chance(0.5);
        const r = await api("POST", `/api/workspace/accounts/${acc.id}/entries`, { kind: k, amount: tl(amount), method, note: `Cari ${k}`, date: day, cashForce: force });
        if (k === "out" && method === "cash" && !force && cashBlocks(amount, day)) return expectReject(r, "cash-negative", kind);
        mustOk(r, kind);
        cariAdd(acc.id, k === "debt" || k === "out" ? amount : -amount);
        if (k === "in") M.kasa[method] += amount;
        if (k === "out") M.kasa[method] -= amount;
        M.entries.push({ id: r.data.entryId, accountId: acc.id, kind: k, amount, method, date: day });
        return;
      }
      case "cari-duzelt": {
        const e = pickOpen(M.entries);
        if (!e) return;
        const amount = moneyCents(1, 60000);
        const method = methodPick();
        const flip = (e.kind === "debt" || e.kind === "credit") && R.chance(0.3) ? (e.kind === "debt" ? "credit" : "debt") : e.kind;
        const next = { ...e, kind: flip, amount, method };
        const eff = x => ((x.kind === "in" || x.kind === "out") && x.method === "cash" ? (x.kind === "in" ? x.amount : -x.amount) : 0);
        const delta = eff(next) - eff(e);
        const force = R.chance(0.5);
        const r = await api("PUT", `/api/workspace/accounts/${e.accountId}/entries/${e.id}`, { kind: flip, amount: tl(amount), method, note: "Düzeltildi", date: e.date, cashForce: force });
        if (!force && delta < 0 && cashBlocks(-delta, e.date)) return expectReject(r, "cash-negative", kind);
        mustOk(r, kind);
        const sign = x => (x.kind === "debt" || x.kind === "out" ? x.amount : -x.amount);
        cariAdd(e.accountId, sign(next) - sign(e));
        if (e.kind === "in" || e.kind === "out") { M.kasa[e.method] -= e.kind === "in" ? e.amount : -e.amount; M.kasa[method] += e.kind === "in" ? amount : -amount; }
        Object.assign(e, next);
        return;
      }
      case "cari-sil": {
        const e = pickOpen(M.entries);
        if (!e) return;
        const force = R.chance(0.5);
        const r = await api("DELETE", `/api/workspace/accounts/${e.accountId}/entries/${e.id}${force ? "?cashForce=1" : ""}`);
        if (!force && e.kind === "in" && e.method === "cash" && cashBlocks(e.amount, e.date)) return expectReject(r, "cash-negative", kind);
        mustOk(r, kind);
        cariAdd(e.accountId, e.kind === "debt" || e.kind === "out" ? -e.amount : e.amount);
        if (e.kind === "in") M.kasa[e.method] -= e.amount;
        if (e.kind === "out") M.kasa[e.method] += e.amount;
        M.entries.splice(M.entries.indexOf(e), 1);
        return;
      }
      case "alim": {
        const qty = item.kg ? R.int(500, 90000) : R.int(1, 60) * 1000;
        const price4 = Math.max(1, item.cost4 + R.int(-300, 300));
        const pay = R.pick(["none", "cash", "account", "account"]);
        const method = methodPick();
        const sup = R.pick(suppliers);
        const amount = lineCents(qty, price4);
        const force = R.chance(0.5);
        const r = await api("POST", `/api/workspace/stock/${item.id}/moves`, { kind: "in", qty: qtyText(qty), unitPrice: priceText(price4), pay, method, accountId: pay === "account" ? sup.id : "", date: day, cashForce: force });
        if (pay !== "none" && amount === 0) return expectReject(r, null, kind);
        if (pay === "cash" && method === "cash" && !force && cashBlocks(amount, day)) return expectReject(r, "cash-negative", kind);
        mustOk(r, kind);
        M.stok.set(item.id, M.stok.get(item.id) + qty);
        if (pay === "cash") M.kasa[method] -= amount;
        if (pay === "account") cariAdd(sup.id, -amount);
        M.moves.push({ id: r.data.moveId, itemId: item.id, kind: "in", qty, price4, pay, method: pay === "cash" ? method : "cash", accountId: pay === "account" ? sup.id : "", amount: pay === "none" ? 0 : amount, stored: amount, date: day });
        return;
      }
      case "satis": {
        const qty = item.kg ? R.int(100, 12000) : R.int(1, 12) * 1000;
        const price4 = item.sale4 + R.int(0, 99);
        const pay = R.pick(["cash", "cash", "card", "bank", "account", "none"]);
        const method = pay === "card" ? "card" : pay === "bank" ? "bank" : "cash";
        const amount = lineCents(qty, price4);
        const force = R.chance(0.6);
        // Vade satış tarihinden sonra (0–45 gün); ileri tarihli vade serbesttir.
        const plan = pay === "account" && R.chance(0.3) ? { count: R.int(2, 6), firstDue: addDays(day, R.int(0, 45)) } : null;
        const r = await api("POST", `/api/workspace/stock/${item.id}/moves`, { kind: "out", qty: qtyText(qty), unitPrice: priceText(price4), pay: pay === "card" || pay === "bank" ? "cash" : pay, method, accountId: pay === "account" ? cust.id : "", date: day, force, ...(plan ? { installments: plan } : {}) });
        if (!force && M.stok.get(item.id) - qty < 0) return expectReject(r, null, kind);
        mustOk(r, kind);
        M.stok.set(item.id, M.stok.get(item.id) - qty);
        if (pay === "account") cariAdd(cust.id, amount);
        else if (pay !== "none") M.kasa[method] += amount;
        M.moves.push({ id: r.data.moveId, itemId: item.id, kind: "out", qty, price4, pay: pay === "card" || pay === "bank" ? "cash" : pay, method, accountId: pay === "account" ? cust.id : "", amount: pay === "none" ? 0 : amount, stored: amount, date: day });
        if (plan) {
          const plans = (await api("GET", `/api/workspace/accounts/${cust.id}`)).data.plans;
          const created = plans.find(p => !M.plans.has(p.id));
          if (created) M.plans.set(created.id, { accountId: cust.id, total: amount, paid: 0, covers: true, status: "active", order: M.plans.size, registeredOn: D0 });
          else throw Object.assign(new Error("satışı taksitlendir: kart açılmadı (zincir koptu)"), { unexpected: true });
        }
        return;
      }
      case "iade": {
        const src = R.pick(M.moves.filter(m => m.kind === "out" && m.pay !== "none"));
        if (!src) return;
        const qty = Math.min(src.qty, src.qty > 1000 ? R.int(1, Math.floor(src.qty / 1000)) * 1000 : src.qty);
        const pay = src.pay === "account" ? "account" : "cash";
        const method = src.method;
        const amount = lineCents(qty, src.price4);
        const force = R.chance(0.5);
        const r = await api("POST", `/api/workspace/stock/${src.itemId}/moves`, { kind: "in", reason: "return", qty: qtyText(qty), unitPrice: priceText(src.price4), pay, method, accountId: src.accountId, date: day, cashForce: force });
        if (amount === 0) return expectReject(r, null, kind);
        if (pay === "cash" && method === "cash" && !force && cashBlocks(amount, day)) return expectReject(r, "cash-negative", kind);
        mustOk(r, kind);
        M.stok.set(src.itemId, M.stok.get(src.itemId) + qty);
        if (pay === "cash") M.kasa[method] -= amount;
        else {
          cariAdd(src.accountId, -amount);
          // Taksitlendirilmiş borç iadeden sonra borçtan büyük kalmaz: en yeni karttan başlayarak kırpılır.
          const covering = [...M.plans.values()].filter(p => p.accountId === src.accountId && p.covers && p.status === "active");
          let excess = covering.reduce((s, p) => s + planLeft(p), 0) - Math.max(0, M.cari.get(src.accountId));
          for (const p of covering.sort((a, b) => b.order - a.order)) {
            if (excess <= 0) break;
            const cut = Math.min(excess, planLeft(p), p.total);
            p.total -= cut;
            excess -= cut;
          }
        }
        M.moves.push({ id: r.data.moveId, itemId: src.itemId, kind: "in", qty, price4: src.price4, pay, method, accountId: src.accountId, amount, stored: amount, reason: "return", date: day });
        return;
      }
      case "hareket-sil": {
        const m = pickOpen(M.moves.filter(x => !(x.accountId && [...M.plans.values()].some(p => p.accountId === x.accountId && p.covers))));
        if (!m) return;
        const force = R.chance(0.5);
        const qtyAfter = M.stok.get(m.itemId) + (m.kind === "in" ? -m.qty : m.qty);
        const cashOut = m.pay === "cash" && m.kind === "out" && m.method === "cash" ? m.amount : 0;
        const r = await api("DELETE", `/api/workspace/stock/${m.itemId}/moves/${m.id}${force ? "?cashForce=1" : ""}`);
        if (!force && cashOut && cashBlocks(cashOut, m.date)) return expectReject(r, "cash-negative", kind);
        mustOk(r, kind);
        M.stok.set(m.itemId, qtyAfter);
        if (m.pay === "cash") M.kasa[m.method] += m.kind === "out" ? -m.amount : m.amount;
        if (m.pay === "account") cariAdd(m.accountId, m.kind === "out" ? -m.amount : m.amount);
        M.moves.splice(M.moves.indexOf(m), 1);
        return;
      }
      case "hareket-duzelt": {
        const m = pickOpen(M.moves.filter(x => x.pay !== "none" && !(x.accountId && [...M.plans.values()].some(p => p.accountId === x.accountId && p.covers))));
        if (!m) return;
        const qty = m.qty + (m.kind === "in" ? R.int(0, 3) * 1000 : -Math.min(m.qty - 1, R.int(0, 2) * 1000));
        const price4 = Math.max(1, m.price4 + R.int(-50, 50));
        const amount = lineCents(qty, price4);
        const qtyAfter = M.stok.get(m.itemId) + (m.kind === "in" ? qty - m.qty : m.qty - qty);
        const eff = (x, a) => (x.pay === "cash" && x.method === "cash" ? (x.kind === "out" ? a : -a) : 0);
        const delta = eff(m, amount) - eff(m, m.amount);
        const force = R.chance(0.5);
        const r = await api("PUT", `/api/workspace/stock/${m.itemId}/moves/${m.id}`, { qty: qtyText(qty), unitPrice: priceText(price4), force: true, cashForce: force });
        if (amount === 0) return expectReject(r, null, kind);
        if (!force && delta < 0 && cashBlocks(-delta, m.date)) return expectReject(r, "cash-negative", kind);
        mustOk(r, kind);
        M.stok.set(m.itemId, qtyAfter);
        if (m.pay === "cash") M.kasa[m.method] += m.kind === "out" ? amount - m.amount : m.amount - amount;
        if (m.pay === "account") cariAdd(m.accountId, m.kind === "out" ? amount - m.amount : m.amount - amount);
        Object.assign(m, { qty, price4, amount, stored: amount });
        return;
      }
      case "kart": {
        // Yeni borç kartı ya da mevcut borcu taksitlendiren kart. Kayıt Tarihi bugünkü çizelge günü; ilk vade ondan sonra.
        const covers = R.chance(0.5);
        const free = uncovered(cust.id);
        const firstDue = addDays(day, R.int(0, 40));
        if (covers && free <= 0) {
          const r = await api("POST", "/api/workspace/plans", { name: cust.name, accountId: cust.id, total: "100", count: 2, firstDue, registeredOn: day, coversBalance: true });
          return expectReject(r, null, kind);
        }
        const total = covers ? Math.max(1, Math.min(free, moneyCents(1, 20000))) : moneyCents(100, 30000);
        const r = await api("POST", "/api/workspace/plans", { name: cust.name, accountId: cust.id, total: tl(total), count: R.int(1, 8), firstDue, registeredOn: day, coversBalance: covers });
        mustOk(r, kind);
        M.plans.set(r.data.id, { accountId: cust.id, total, paid: 0, covers, status: "active", order: M.plans.size, registeredOn: day });
        if (!covers) cariAdd(cust.id, total);
        return;
      }
      case "taksit-tahsil": {
        const [id, p] = R.pick([...M.plans.entries()].filter(([, x]) => x.status === "active")) || [];
        if (!id) return;
        const refund = R.chance(0.15);
        const method = methodPick();
        const force = R.chance(0.5);
        if (refund) {
          // İade tahsil edilen net tutarı aşamaz (bilinçli olarak bazen aşılır → 400 refund-exceeds).
          const over = R.chance(0.3);
          const amount = over ? p.paid + moneyCents(1, 500) : Math.max(1, Math.min(p.paid, moneyCents(1, 5000)));
          const r = await api("POST", `/api/workspace/plans/${id}/entries`, { kind: "out", amount: tl(amount), method, date: day, cashForce: force });
          if (amount > p.paid) return expectReject(r, "refund-exceeds", kind);
          if (method === "cash" && !force && cashBlocks(amount, day)) return expectReject(r, "cash-negative", kind);
          mustOk(r, kind);
          p.paid -= amount;
          cariAdd(p.accountId, amount);
          M.kasa[method] -= amount;
          M.planEntries.push({ id: r.data.entryId, planId: id, kind: "out", amount, method, date: day });
          return;
        }
        const amount = Math.max(1, Math.min(planLeft(p) || moneyCents(1, 2000), moneyCents(1, 12000)));
        const r = await api("POST", `/api/workspace/plans/${id}/entries`, { kind: "in", amount: tl(amount), method, date: day });
        mustOk(r, kind);
        p.paid += amount;
        cariAdd(p.accountId, -amount);
        M.kasa[method] += amount;
        M.planEntries.push({ id: r.data.entryId, planId: id, kind: "in", amount, method, date: day });
        return;
      }
      case "taksit-sil": {
        const e = pickOpen(M.planEntries.filter(x => M.plans.get(x.planId)?.status === "active"));
        if (!e) return;
        const p = M.plans.get(e.planId);
        const force = R.chance(0.5);
        const r = await api("DELETE", `/api/workspace/plans/${e.planId}/entries/${e.id}${force ? "?cashForce=1" : ""}`);
        if (e.kind === "in" && p.paid - e.amount < 0) return expectReject(r, "refund-exceeds", kind);
        if (!force && e.kind === "in" && e.method === "cash" && cashBlocks(e.amount, e.date)) return expectReject(r, "cash-negative", kind);
        mustOk(r, kind);
        p.paid += e.kind === "in" ? -e.amount : e.amount;
        cariAdd(p.accountId, e.kind === "in" ? e.amount : -e.amount);
        M.kasa[e.method] += e.kind === "in" ? -e.amount : e.amount;
        M.planEntries.splice(M.planEntries.indexOf(e), 1);
        return;
      }
      case "kart-kapat": {
        const [id, p] = R.pick([...M.plans.entries()].filter(([, x]) => x.status === "active")) || [];
        if (!id) return;
        const r = await api("PUT", `/api/workspace/plans/${id}`, { status: "closed" });
        mustOk(r, kind);
        p.status = "closed";
        cariAdd(p.accountId, -Math.max(0, p.total - p.paid));
        return;
      }
      case "tarih-hatasi": {
        // Boş, null, geçersiz biçim, var olmayan gün, ileri tarih: dört çekirdeğin hepsinde 400, hiçbir iz yok.
        const bad = R.pick([null, "", "   ", "2026-13-40", "31.12.2026", "2026-02-30", "abc", addDays(T, R.int(1, 400))]);
        const want = bad === null || String(bad).trim() === "" ? "date-missing" : bad === "2026-13-40" || bad === "2026-02-30" || !/^\d{4}-\d{2}-\d{2}$/.test(bad) ? "date-invalid" : "date-future";
        const target = R.pick(["kasa", "cari", "stok", "taksit"]);
        let r;
        if (target === "kasa") r = await api("POST", "/api/workspace/cash", { kind: "in", amount: "10", method: "cash", description: "Tarih denemesi", date: bad });
        if (target === "cari") r = await api("POST", `/api/workspace/accounts/${acc.id}/entries`, { kind: "debt", amount: "10", date: bad });
        if (target === "stok") r = await api("POST", `/api/workspace/stock/${item.id}/moves`, { kind: "in", qty: "1", unitPrice: "1", pay: "none", date: bad });
        if (target === "taksit") {
          const [id] = R.pick([...M.plans.entries()]) || [];
          if (!id) return;
          r = await api("POST", `/api/workspace/plans/${id}/entries`, { kind: "in", amount: "10", method: "bank", date: bad });
        }
        return expectReject(r, want, `${kind}/${target}`);
      }
      case "vade-hatasi": {
        // Vade işlem/satış tarihinden önce olamaz; kart Kayıt Tarihi ileri olamaz.
        const which = R.pick(["kart", "satis", "taksit-ekle", "kart-ileri"]);
        if (which === "kart") return expectReject(await api("POST", "/api/workspace/plans", { name: cust.name, accountId: cust.id, total: "500", count: 3, registeredOn: day, firstDue: addDays(day, -R.int(1, 60)) }), "due-before-start", `${kind}/${which}`);
        if (which === "kart-ileri") return expectReject(await api("POST", "/api/workspace/plans", { name: cust.name, accountId: cust.id, total: "500", count: 3, registeredOn: addDays(T, R.int(1, 30)), firstDue: addDays(T, 40) }), "date-future", `${kind}/${which}`);
        if (which === "satis") return expectReject(await api("POST", `/api/workspace/stock/${item.id}/moves`, { kind: "out", qty: "1", unitPrice: priceText(item.sale4), pay: "account", accountId: cust.id, date: day, force: true, installments: { count: 2, firstDue: addDays(day, -R.int(1, 30)) } }), "due-before-start", `${kind}/${which}`);
        const [id, p] = R.pick([...M.plans.entries()]) || [];
        if (!id) return;
        return expectReject(await api("POST", `/api/workspace/plans/${id}/items`, { dueDate: addDays(p.registeredOn, -R.int(1, 20)), amount: "1" }), "due-before-start", `${kind}/${which}`);
      }
      case "kilit-ihlali": {
        if (!lock) return;
        // Kapanmış döneme ekleme, oradaki hareketi düzeltme ya da silme, oraya kart açma: 409 period-locked.
        const which = R.pick(["ekle-kasa", "ekle-cari", "ekle-stok", "duzelt-kasa", "sil-cari", "sil-stok", "sil-taksit", "kart"]);
        const back = addDays(lock, -R.int(0, 10));
        const past = back < D0 ? D0 : back;
        const locked = list => R.pick(list.filter(x => !open(x.date)));
        let r = null;
        if (which === "ekle-kasa") r = await api("POST", "/api/workspace/cash", { kind: "in", amount: "10", method: "cash", description: "Kapalı dönem", date: past });
        if (which === "ekle-cari") r = await api("POST", `/api/workspace/accounts/${acc.id}/entries`, { kind: "debt", amount: "10", date: past });
        if (which === "ekle-stok") r = await api("POST", `/api/workspace/stock/${item.id}/moves`, { kind: "in", qty: "1", unitPrice: "1", pay: "none", date: past });
        if (which === "kart") r = await api("POST", "/api/workspace/plans", { name: cust.name, accountId: cust.id, total: "300", count: 1, registeredOn: past, firstDue: T });
        if (which === "duzelt-kasa") { const e = locked(M.cash); if (!e) return; r = await api("PUT", `/api/workspace/cash/${e.id}`, { kind: e.kind, amount: tl(e.amount + 100), method: e.method, description: "Kapalı dönem düzeltme", date: e.date, cashForce: true }); }
        if (which === "sil-cari") { const e = locked(M.entries); if (!e) return; r = await api("DELETE", `/api/workspace/accounts/${e.accountId}/entries/${e.id}?cashForce=1`); }
        if (which === "sil-stok") { const m = locked(M.moves); if (!m) return; r = await api("DELETE", `/api/workspace/stock/${m.itemId}/moves/${m.id}?cashForce=1`); }
        if (which === "sil-taksit") { const e = locked(M.planEntries); if (!e) return; r = await api("DELETE", `/api/workspace/plans/${e.planId}/entries/${e.id}?cashForce=1`); }
        return expectReject(r, "period-locked", `${kind}/${which}`);
      }
      default:
        throw new Error(kind);
    }
  }

  const WEIGHTS = [
    ["satis", 20], ["alim", 11], ["kasa", 9], ["cari", 11], ["taksit-tahsil", 11], ["kart", 6], ["iade", 5],
    ["kasa-duzelt", 3], ["kasa-sil", 2], ["cari-duzelt", 4], ["cari-sil", 2], ["hareket-duzelt", 3], ["hareket-sil", 2], ["taksit-sil", 3], ["kart-kapat", 2],
    // Saha hataları yüksek sıklıkta: her 100 işlemin ~17'si hatalı tarih, vade ya da kapalı dönem denemesi.
    ["tarih-hatasi", 8], ["vade-hatasi", 4], ["kilit-ihlali", 5],
  ];
  const bag = WEIGHTS.flatMap(([k, w]) => Array(w).fill(k));
  // Açılış (çizelgenin ilk günü): stok ve kasa dolsun.
  for (let i = 0; i < items.length; i++) await op("alim").catch(() => {});
  await op("kasa").catch(() => {});

  for (let i = 0; i < operations; i++) {
    // Kronoloji: çizelge geçmişten bugüne sıralı ilerler (geri gitmez).
    const next = addDays(D0, Math.floor(((i + 1) * span) / operations));
    if (next > cur) cur = next > T ? T : next;
    // Dönem kilidi: %35 ve %70'te geçmiş dönemi kilitle (yönetici ay kapanışı).
    for (const [at, back] of [[0.35, 7], [0.7, 3]]) {
      if (i === Math.floor(operations * at)) {
        const until = addDays(cur, -back) < D0 ? D0 : addDays(cur, -back);
        const r = await api("PUT", "/api/admin/period-lock", { lockedUntil: until });
        if (r.status !== 200) report.mismatches.push({ at: `kilit ${until}`, problems: [`dönem kilidi konamadı: ${r.text}`] });
        else { lock = until; report.locks.push(until); }
      }
    }
    const kind = R.pick(bag);
    report.operations += 1;
    try {
      await op(kind);
    } catch (error) {
      report.mismatches.push({ at: `işlem ${i + 1} (${kind}, ${cur})`, problems: [error.message] });
      log(`✗ işlem ${i + 1} ${kind}: ${error.message}`);
      if (!error.unexpected) throw error;
    }
    if ((i + 1) % verifyEvery === 0) {
      const p = await verify(`işlem ${i + 1} (${kind}, ${cur})`);
      if (p.length) { log(`✗ işlem ${i + 1} ${kind}:\n  ${p.join("\n  ")}`); break; }
    }
    if (reportEvery && (i + 1) % reportEvery === 0) {
      const p = await verifyReports(`raporlar, işlem ${i + 1} (${cur})`);
      if (p.length) { log(`✗ raporlar işlem ${i + 1}:\n  ${p.join("\n  ")}`); break; }
    }
  }
  // Eşzamanlı istek yağmuru: aynı ürünlere ve carilere aynı anda satış, tahsilat, kasa (onaylı; sıra bağımsız).
  if (burst && !report.mismatches.length) {
    const jobs = [];
    for (let i = 0; i < burst; i++) {
      const it = items[i % 3];
      const c = customers[i % 2];
      const amount = 1000 + i;
      if (i % 3 === 0) jobs.push(api("POST", `/api/workspace/stock/${it.id}/moves`, { kind: "out", qty: "1", unitPrice: priceText(it.sale4), pay: "account", accountId: c.id, date: T, force: true }).then(r => { mustOk(r, "eşzamanlı satış"); const a = lineCents(1000, it.sale4); M.stok.set(it.id, M.stok.get(it.id) - 1000); cariAdd(c.id, a); M.moves.push({ id: r.data.moveId, itemId: it.id, kind: "out", qty: 1000, price4: it.sale4, pay: "account", method: "cash", accountId: c.id, amount: a, stored: a, date: T }); }));
      else if (i % 3 === 1) jobs.push(api("POST", `/api/workspace/accounts/${c.id}/entries`, { kind: "in", amount: tl(amount), method: "bank", date: T }).then(r => { mustOk(r, "eşzamanlı tahsilat"); cariAdd(c.id, -amount); M.kasa.bank += amount; M.entries.push({ id: r.data.entryId, accountId: c.id, kind: "in", amount, method: "bank", date: T }); }));
      else jobs.push(api("POST", "/api/workspace/cash", { kind: "out", amount: tl(amount), method: "cash", description: "Eşzamanlı gider", date: T, cashForce: true }).then(r => { mustOk(r, "eşzamanlı kasa"); M.kasa.cash -= amount; M.cash.push({ id: r.data.id, kind: "out", amount, method: "cash", date: T }); }));
    }
    const results = await Promise.allSettled(jobs);
    const failed = results.filter(r => r.status === "rejected");
    if (failed.length) report.mismatches.push({ at: "eşzamanlı", problems: failed.map(f => f.reason.message) });
    report.burst = { requests: burst, failed: failed.length };
    await verify("eşzamanlı istek yağmurundan sonra");
  }
  if (!report.mismatches.length) {
    await verify("son durum");
    await verifyReports("son durum raporları");
  }
  report.model = { kasa: Object.fromEntries(MONEY.map(m => [m, tl(M.kasa[m])])), cariler: accounts.length, urunler: items.length, kartlar: M.plans.size, kasaHareketi: M.cash.length, cariHareketi: M.entries.length, stokHareketi: M.moves.length, taksitHareketi: M.planEntries.length };
  // Deney sonrası kilidi kaldır (aynı veritabanında başka koşu olabilir).
  if (lock) await api("PUT", "/api/admin/period-lock", { lockedUntil: "" });
  return report;
}
