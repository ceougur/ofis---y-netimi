// Mutabakat motoru: dört çekirdek (v2.0.13: Kasa, Stok, Cari, Taksit) + Fatura ve Çek/Senet (v2.0.15).
//
// v2.0.15 fatura ekseni (bağımsız fatura hesabı: fatura-model.mjs, programın invoice-math.mjs'ini kullanmaz):
//   · Satış / SMM / alış / satıştan ve alıştan iade; KDV dahil-hariç, satır ve genel iskonto, tevkifat, stopaj, döviz.
//   · Karışık ödeme: peşin (Nakit/Banka/Kart, iki yol), çek/senet (alınan, verilen), portföyden ciro, taksit kartı,
//     vadeli açık hesap — hepsi tek işlemde; cari ↔ Kasa ↔ stok ↔ çek ↔ taksit kartı çapraz denetlenir.
//   · İptal: bütün etkiler birebir geri; iadesi olan, tahsilatlı kartı olan, çeki hareket görmüş fatura iptal edilemez.
//   · Kasıtlı yarıda kalan işlem (ACID): 3. kalemde stok yetmez, Kasa çıkışı engellenir, çek seri numarası mükerrer
//     (stok/cari/Kasa satırları yazıldıktan sonra) → tamamı geri alınmalı; her tablo modelle aynı kalmalı (yetim yok).
//   · Saha hataları: ileri/geçersiz/boş tarih, vadesi fatura tarihinden önce taksit/açık hesap/çek, ödeme aşımı, iade
//     aşımı, asıl faturadan önce iade, kronoloji (seride eski tarih), mükerrer tedarikçi no, alışta taksit, iadede çek,
//     portföyde olmayan çeki ciro, ikinci iptal, kalemsiz fatura, geçersiz KDV; kapalı döneme fatura/iade/iptal.
//   · Faturadan gelen stok hareketi ve cari satırı kendi ekranından silinemez/düzeltilemez (invoice-linked).
//   · Sonda: kendi serilerimizde numara 1'den boşluksuz ve tarih sırasıyla uyumlu; ETTN tekil; mükerrer belge yok.
//   · Raporlar: Satış/Alış/İade Faturaları (sayı, matrah, KDV, ödenecek) ve KDV Özeti (391/191) = model.
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
//   · Eksiye düşürme: Nakit, Banka ve Kredi Kartı yol başına ayarla (Kontrol Yok / Uyar / Engelle): Uyar'da onaysız 409
//     cash-negative, Engelle'de onaylı da 409 cash-blocked (koşu ortasında ayar değişir), stok eksiye onaysız
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
// v2.1.0 banka ekseni (Aşama 3–4): iki vadesiz banka hesabı (açılış çizelgenin ilk günü) ve Banka Fişleri — Banka Masrafı (BSMV
//   Dahil / Hariç / Yok), Faiz Geliri (stopaj oranı ya da tutarı), Faiz Gideri (BSMV/KKDF), Diğer Gelir / Gider; Ters Kaydet (kilitli
//   günün fişi bugünün tarihiyle ters kaydedilir), Düzelt (ters + yeni fiş tek işlemde), Benzer İşlem (onaysız 409 bank-similar, "Yine
//   de Kaydet" ile ikinci kayıt), kilitli/ileri/boş tarih, sıfır/eksi/bozuk tutar, açılıştan önce tarih, ters kaydı ters kaydetme. Model
//   her fişin banka etkisini kendi hesaplar (BSMV ve stopaj tam sayı yarım-yukarı); Kasa/banka toplamı, 102 ve Banka ve POS Hareketleri
//   bu satırlarla karşılaştırılır.
// Belirli aralıklarla ve sonda: raporlar (Kasa Hareketleri, Stok Hareketleri, Cari Listesi, Taksit Kartları, Hesap Planı
// Mizanı, Yevmiye) veri varken boş dönmemeli, tutarları modelle aynı olmalı; veri olmayan aralıkta gerçekten boş dönmeli.

import { modelInvoice } from "./fatura-model.mjs";

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

// bank: banka ekseni (v2.1.0; banka hesabı ve Banka Fişi). Banka modülü olmayan eski sürüme karşı koşan testler (altın test: v2.0.26)
// false verir; o zaman rastgele sıra da eski motorla birebir aynıdır.
export async function runReconciliation({ client, seed = 1, operations = 500, verifyEvery = 1, reportEvery = 50, burst = 40, span = 120, bank = true, log = () => {} }) {
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
  const M = { kasa: { cash: 0, bank: 0, card: 0 }, cari: new Map(), stok: new Map(), plans: new Map(), cash: [], entries: [], moves: [], planEntries: [], invoices: new Map(), drafts: new Map(), cheques: new Map(), invCash: [], chqCash: [], bankLines: [] };
  const report = { seed, operations: 0, byKind: {}, rejectedAsExpected: 0, rejections: {}, mismatches: [], checks: 0, reportChecks: 0, integrityMs: [], timeline: { from: D0, to: T }, locks: [] };
  const count = kind => (report.byKind[kind] = (report.byKind[kind] || 0) + 1);
  const accounts = [];
  const items = [];
  let planSeq = 0;
  const cariAdd = (id, cents) => M.cari.set(id, (M.cari.get(id) || 0) + cents);
  const planLeft = p => Math.max(0, p.total - Math.max(0, p.paid));
  // v2.0.24: taksitli faturanın kendi kartı faturanın açığını izler (iade, iade iptali, kart tahsilatı/iadesi/silmesi sonrası).
  // Bağımsız hesap: açık = taksite kalan − kartın net tahsilatı − asıl faturaya kesilmiş iadeler (0'ın altına inmez);
  // kartın kalanı açığa eşit olacak biçimde toplam = ödenen + açık (büyürken taksite kalanı aşmaz).
  function syncOwn(p) {
    if (!p || !p.invoiceId || p.status !== "active") return;
    const inv = M.invoices.get(p.invoiceId);
    if (!inv || inv.status !== "issued") return;
    const rets = [...M.invoices.values()].filter(x => x.kind === "sale_return" && x.status === "issued" && x.originalId === inv.id);
    const returns = rets.reduce((sum, x) => sum + x.tryPayable, 0);
    // Parası geri verilen iade borcu düşürmez (geri ödeme satırı yeniden borçlandırır).
    const refunds = rets.reduce((sum, x) => sum + x.cashRows.filter(row => row.kind === "out").reduce((t, row) => t + row.amount, 0), 0);
    const open = Math.max(0, inv.rest - Math.max(0, p.paid) - returns) + refunds;
    if (planLeft(p) === open) return;
    p.total = Math.min(inv.rest, Math.max(0, p.paid) + open);
  }
  const uncovered = accountId => Math.max(0, (M.cari.get(accountId) || 0) - [...M.plans.values()].filter(p => p.accountId === accountId && p.covers && p.status === "active").reduce((s, p) => s + planLeft(p), 0));
  // Kasa'ya etkiler (tarihli): nakit eksi korumasının modeli ve işlem zinciri denetimi bunlardan hesaplanır.
  function cashEffects() {
    const out = [];
    for (const e of M.cash) out.push({ source: "manual", date: e.date, method: e.method, cents: e.kind === "in" ? e.amount : -e.amount });
    for (const e of M.entries) if (e.kind === "in" || e.kind === "out") out.push({ source: "account", date: e.date, method: e.method, cents: e.kind === "in" ? e.amount : -e.amount });
    for (const m of M.moves) if (m.pay === "cash" && m.amount > 0) out.push({ source: "stock", date: m.date, method: m.method, cents: m.kind === "out" ? m.amount : -m.amount });
    for (const e of M.planEntries) out.push({ source: "plan", date: e.date, method: e.method, cents: e.kind === "in" ? e.amount : -e.amount });
    for (const e of M.invCash) out.push({ source: "invoice", date: e.date, method: e.method, cents: e.kind === "in" ? e.amount : -e.amount });
    for (const e of M.chqCash) out.push({ source: "cheque", date: e.date, method: e.method, cents: e.kind === "in" ? e.amount : -e.amount });
    // v2.1.0: Banka Fişi para satırları (açılış, fiş, ters kayıt) — her biri tek banka satırı.
    // GG2: açılış (ve Devir Kapanışı, eski bakiye aktarımı) para hareketi değildir — raporda satır olarak görünür, dönem giriş/çıkışına
    // girmez ("Açılış ve Devir Düzeltmeleri"); bakiyeye girer.
    for (const e of M.bankLines) out.push({ source: "bankLine", date: e.date, method: "bank", cents: e.cents, adjust: e.type === "opening" });
    return out;
  }
  const balAt = (method, date) => cashEffects().filter(x => x.method === method && (!date || x.date <= date)).reduce((s, x) => s + x.cents, 0);
  // Eksi bakiye denetimi (yol başına: off / warn / block). Program: min(o tarihteki bakiye, son bakiye) − çıkış < 0 ise
  // warn'da onaysız 409 cash-negative, block'ta onaylı da 409 cash-blocked. Koşunun ortasında politika değişir.
  // v2.0.17: Banka modülü gelene kadar banka/POS denetimi kapalı; sunucu bank/card ayarını okumaz (her zaman off).
  const policy = { cash: "warn", bank: "off", card: "off" };
  const applyPolicy = next => Object.assign(policy, { cash: next.cash ?? policy.cash, bank: "off", card: "off" });
  const METHOD_ORDER = ["cash", "bank", "card"];
  const blocks = (outCents, date, method) => outCents > 0 && policy[method] !== "off" && Math.min(balAt(method, date), balAt(method, "")) - outCents < 0;
  // outs: [[yol, çıkış kuruşu, tarih]]; sunucunun sırasıyla (nakit, banka, kart) denetlenir. Ret beklenirse true.
  function negative(r, outs, force, kind) {
    for (const method of METHOD_ORDER) {
      for (const [m, out, date] of outs) {
        if (m !== method || !blocks(out, date, m)) continue;
        if (policy[m] === "block") return expectReject(r, "cash-blocked", kind), true;
        if (!force) return expectReject(r, "cash-negative", kind), true;
      }
    }
    return false;
  }
  // Düzeltme/silme: her yolun bakiyeye etkisi (giriş +, çıkış −) önce/sonra; azalan yollar çıkış sayılır.
  const changeOuts = (before, after, date) => METHOD_ORDER.map(m => [m, (before.method === m ? before.cents : 0) - (after?.method === m ? after.cents : 0), date]).filter(([, out]) => out > 0);

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
  // v2.1.0: iki vadesiz banka hesabı, açılış çizelgenin ilk günü (Bakiye Doğrulandı). Açılış 102.k borç / 500 alacak; banka etkisi modelde.
  const banks = [];
  for (const bankName of bank ? ["Ziraat Bankası", "Garanti BBVA"] : []) {
    const opening = R.int(20_000, 80_000) * 100 + R.int(0, 99);
    const r = await api("POST", "/api/workspace/bank/accounts", { bankName, name: `Ana TL Hesabı T${seed}`, kind: "demand", currency: "TRY", opening: { date: D0, amount: tl(opening), confirmed: true } });
    if (r.status !== 200) throw new Error(`banka hesabı açılamadı: ${r.status} ${r.text}`);
    banks.push({ id: r.data.id, name: bankName });
    M.kasa.bank += opening;
    if (!r.data.opening?.eventId || r.data.opening.date !== D0) throw new Error(`banka hesabının açılışı yazılmadı: ${r.text}`);
    M.bankLines.push({ id: r.data.opening.eventId, bankId: r.data.id, type: "opening", date: D0, cents: opening, status: "active" });
  }

  // ---------- Doğrulama ----------
  async function verify(where) {
    report.checks += 1;
    const problems = [];
    // v2.0.17: Kasa penceresi yalnız nakit; model bütün yolları izler → "all".
    const cash = (await api("GET", "/api/workspace/cash?method=all")).data;
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
    for (const source of ["manual", "account", "stock", "plan", "invoice", "cheque", "bankLine"]) {
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
      // v2.0.24: iade, asıl faturayı kapsayan Mevcut Borç kartını faturadaki payı kadar küçültür; model kapsamı (FIFO) tutmaz.
      // Bu kartta program değeri [model − bu karttaki iadeler, model] aralığında ve ödenenin altında değilse benimsenir.
      if ((m.slack || m.over) && centsOf(p.totals.paid) === m.paid) {
        const got = centsOf(p.totals.total);
        if (got <= m.total + (m.over || 0) && got >= m.total - (m.slack || 0) && got >= Math.max(0, m.paid)) {
          // Benimsenen fark en son iadeye yazılır (iade iptalinde geri büyüyecek tutar; programın coverCuts'ı gibi): program daha
          // çok kestiyse kesinti artar, modelin kestiğini program kesmediyse azalır.
          const cuts = m.slackBy?.coverCuts;
          if (cuts && got !== m.total) {
            const next = Math.max(0, (cuts.get(m) || 0) + m.total - got);
            if (next) cuts.set(m, next);
            else cuts.delete(m);
          }
          if (got < m.total) m.slack -= m.total - got;
          else m.over -= got - m.total;
          m.total = got;
        }
      }
      if (centsOf(p.totals.total) !== m.total || centsOf(p.totals.paid) !== m.paid) {
        // Teşhis için kartın taksitleri ve tahsilatları da yazılır (hangi satırın saptığı görünsün).
        const d = (await api("GET", `/api/workspace/plans/${p.id}`)).data || {};
        const items = (d.items || d.ledger?.items || []).map(i => `${i.dueDate}:${i.amount}/${i.paid ?? i.paidAmount ?? "-"}`).join(" ");
        const ents = (d.entries || []).map(e => `${e.date}:${e.amount}`).join(" ");
        const invId = d.invoiceId || m.invoiceId;
        const inv = invId ? (await api("GET", `/api/workspace/invoices/${invId}`)).data : null;
        if (inv) problems.push(`  fatura ${inv.number} ${inv.issueDate}: ödenecek ${inv.payable} açık ${inv.open} ödenen ${inv.paid} · kapatanlar ${(inv.closers || []).map(c => `${c.date}:${c.amount}:${c.mode}:${c.label}`).join(" | ")}`);
        problems.push(`Taksit kartı ${p.name} (${p.id}, fatura ${d.invoiceId || d.invoice?.number || "-"}, durum ${p.status}): program ${p.totals.total}/${p.totals.paid} · model ${tl(m.total)}/${tl(m.paid)} · taksitler [${items}] · tahsilatlar [${ents}]`);
      }
      if ((p.status === "closed") !== (m.status === "closed")) problems.push(`Taksit kartı ${p.name}: durum ${p.status} · model ${m.status}`);
      // Yukarı yönlü pay (over) yalnız iadenin ardından programın ilk gözlemine kadar geçerli; gözlendikten sonra kalkar.
      m.over = 0;
    }
    for (const [id, p] of M.plans) if (!seen.has(id)) problems.push(`Taksit kartı ${id}: programda yok (model ${tl(p.total)})`);
    // v2.0.24 değişmezi: taksitli faturanın açığı = kendi kartının kalanı (program içi; iade/iptal/düzenleme sonrası).
    for (const p of plans) {
      const m = M.plans.get(p.id);
      if (!m?.invoiceId || p.status === "closed") continue;
      const inv = (await api("GET", `/api/workspace/invoices/${m.invoiceId}`)).data;
      if (!inv || inv.status !== "issued") continue;
      const left = Math.max(0, centsOf(p.totals.total) - Math.max(0, centsOf(p.totals.paid)));
      // Parası geri verilen iade borcu düşürmez: kartın kalanı = açık + geri ödenen (taksite kalanı aşmadan).
      const mi = M.invoices.get(m.invoiceId);
      const refunds = [...M.invoices.values()].filter(x => x.kind === "sale_return" && x.status === "issued" && x.originalId === m.invoiceId).reduce((sum, x) => sum + x.cashRows.filter(row => row.kind === "out").reduce((t, row) => t + row.amount, 0), 0);
      const want = Math.min(centsOf(inv.open) + refunds, Math.max(0, (mi?.rest ?? Infinity) - Math.max(0, centsOf(p.totals.paid))));
      if (Math.abs(want - left) > 1) problems.push(`Taksitli fatura ${inv.number}: açık ${inv.open} (+ geri ödenen ${tl(refunds)}) ≠ kartın kalanı ${tl(left)} · kapatanlar ${(inv.closers || []).map(c => `${c.date}:${c.amount}:${c.label}`).join(" | ")}`);
    }
    // Fatura: her belge programda ve modelde aynı durumda, aynı TL ödenecekle; programda olup modelde olmayan (yetim) belge yok.
    const invs = (await api("GET", "/api/workspace/invoices?tab=all&limit=5000")).data.invoices || [];
    const invSeen = new Set();
    for (const x of invs) {
      const m = M.invoices.get(x.id) || (M.drafts.has(x.id) ? { status: "draft", tryPayable: M.drafts.get(x.id).calc.tryPayable } : null);
      if (!m) { problems.push(`Fatura ${x.number || x.id} (${x.kind}, ${x.status}): programda var, modelde yok (yetim kayıt)`); continue; }
      invSeen.add(x.id);
      if (x.status !== m.status) problems.push(`Fatura ${x.number}: durum ${x.status} · model ${m.status}`);
      if (centsOf(x.tryPayable) !== m.tryPayable) problems.push(`Fatura ${x.number}: ödenecek ${x.tryPayable} · model ${tl(m.tryPayable)}`);
    }
    for (const [id, m] of [...M.invoices, ...M.drafts]) if (!invSeen.has(id)) problems.push(`Fatura ${m.number || id}: modelde var, programda yok`);
    // Çek/senet: her evrak aynı durumda ve tutarda; iptal edilen faturanın evrakı listede yok.
    const chs = (await api("GET", "/api/workspace/cheques?limit=5000")).data.cheques || [];
    const chSeen = new Set();
    for (const c of chs) {
      const m = M.cheques.get(c.id);
      if (!m) { problems.push(`Çek/senet ${c.serialNo || c.id} (${c.status}): programda var, modelde yok`); continue; }
      chSeen.add(c.id);
      if (c.status !== m.status || centsOf(c.amount) !== m.amount) problems.push(`Çek/senet ${c.serialNo}: ${c.status} ${c.amount} · model ${m.status} ${tl(m.amount)}`);
    }
    for (const [id, m] of M.cheques) if (!chSeen.has(id)) problems.push(`Çek/senet ${m.serialNo}: modelde var, programda yok`);
    // v2.1.0: her banka hesabının bakiyesi = modeldeki banka satırlarının toplamı (açılış + fişler + ters kayıtlar).
    const bankList = bank ? (await api("GET", "/api/workspace/bank/accounts?status=all")).data.accounts || [] : [];
    for (const b of banks) {
      const got = bankList.find(x => x.id === b.id);
      const want = M.bankLines.filter(x => x.bankId === b.id).reduce((t, x) => t + x.cents, 0);
      if (!got || Number(got.balanceMinor) !== want) problems.push(`Banka hesabı ${b.name}: program ${got ? tl(Number(got.balanceMinor)) : "yok"} · model ${tl(want)}`);
    }
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
      // v2.0.17: Kasa Hareketleri yalnız nakit; havale/EFT + POS/kredi kartı "Banka ve POS Hareketleri" raporunda.
      const inRangeEffects = cashEffects().filter(x => x.date >= from && x.date <= to);
      for (const [id, label, pick] of [["kasa-hareketleri", "Kasa Hareketleri", x => x.method === "cash"], ["banka-pos-hareketleri", "Banka ve POS Hareketleri", x => x.method !== "cash"]]) {
        const effects = inRangeEffects.filter(pick);
        const rep = await rc(id, from, to);
        const rows = rep.total - 1; // ilk satır devir
        if (rows !== effects.length) problems.push(`${label} ${from}–${to}: rapor ${rows} satır · model ${effects.length}${effects.length && !rows ? " (VERİ VARKEN BOŞ)" : ""}`);
        const moving = effects.filter(x => !x.adjust);
        const inCents = moving.filter(x => x.cents > 0).reduce((s, x) => s + x.cents, 0), outCents = -moving.filter(x => x.cents < 0).reduce((s, x) => s + x.cents, 0);
        if (sum(rep, "Dönem Giriş") !== inCents || sum(rep, "Dönem Çıkış") !== outCents) problems.push(`${label} ${from}–${to}: giriş/çıkış ${tl(sum(rep, "Dönem Giriş"))}/${tl(sum(rep, "Dönem Çıkış"))} · model ${tl(inCents)}/${tl(outCents)}`);
        const adjustCents = effects.filter(x => x.adjust).reduce((s, x) => s + x.cents, 0);
        if (sum(rep, "Açılış ve Devir Düzeltmeleri") !== adjustCents) problems.push(`${label} ${from}–${to}: açılış ve devir düzeltmeleri ${tl(sum(rep, "Açılış ve Devir Düzeltmeleri"))} · model ${tl(adjustCents)}`);
      }
      const moves = M.moves.filter(m => m.date >= from && m.date <= to);
      const stok = await rc("stok-hareketleri", from, to);
      if (stok.total !== moves.length) problems.push(`Stok Hareketleri ${from}–${to}: rapor ${stok.total} · model ${moves.length}${moves.length && !stok.total ? " (VERİ VARKEN BOŞ)" : ""}`);
      const stockIn = moves.filter(m => m.kind === "in").reduce((s, m) => s + m.stored, 0), stockOut = moves.filter(m => m.kind === "out").reduce((s, m) => s + m.stored, 0);
      if (sum(stok, "Giriş Tutarı") !== stockIn || sum(stok, "Çıkış Tutarı") !== stockOut) problems.push(`Stok Hareketleri ${from}–${to}: tutar ${tl(sum(stok, "Giriş Tutarı"))}/${tl(sum(stok, "Çıkış Tutarı"))} · model ${tl(stockIn)}/${tl(stockOut)}`);
      // Fatura raporları: kesilen belge sayısı, matrah, KDV, ödenecek = model (iptal ve taslak hariç); KDV Özeti 391/191.
      const inRange = kinds => issuedInvoices(x => kinds.includes(x.kind) && x.date >= from && x.date <= to);
      for (const [id, kinds, label] of [["fatura-satis", ["sale", "smm"], "Satış"], ["fatura-alis", ["purchase"], "Alış"], ["fatura-iade", ["sale_return", "purchase_return"], "İade"]]) {
        const want = inRange(kinds);
        const rep = await rc(id, from, to);
        const n = Number(rep.summary.find(([k]) => k === `${label} Faturası`)?.[1] || 0);
        const sumOf = key => want.reduce((t, x) => t + x[key], 0);
        if (rep.total !== want.length || n !== want.length) problems.push(`${id} ${from}–${to}: rapor ${rep.total} satır · model ${want.length}${want.length && !rep.total ? " (VERİ VARKEN BOŞ)" : ""}`);
        else if (sum(rep, "Matrah") !== sumOf("tryNet") || sum(rep, "KDV") !== sumOf("tryVat") || sum(rep, "Ödenecek") !== sumOf("tryPayable")) problems.push(`${id} ${from}–${to}: matrah/KDV/ödenecek ${tl(sum(rep, "Matrah"))}/${tl(sum(rep, "KDV"))}/${tl(sum(rep, "Ödenecek"))} · model ${tl(sumOf("tryNet"))}/${tl(sumOf("tryVat"))}/${tl(sumOf("tryPayable"))}`);
      }
      const kdv = await rc("kdv-ozeti", from, to);
      const out391 = inRange(["sale", "smm"]).reduce((t, x) => t + x.tryVat - x.tryWithheld, 0) - inRange(["sale_return"]).reduce((t, x) => t + x.tryVat - x.tryWithheld, 0);
      const in191 = inRange(["purchase"]).reduce((t, x) => t + x.tryVat, 0) - inRange(["purchase_return"]).reduce((t, x) => t + x.tryVat, 0);
      if (centsOfText(kdv.summary.find(([k]) => k.startsWith("Hesaplanan"))?.[1]) !== out391) problems.push(`KDV Özeti ${from}–${to}: hesaplanan ${kdv.summary.find(([k]) => k.startsWith("Hesaplanan"))?.[1]} · model ${tl(out391)}`);
      if (centsOfText(kdv.summary.find(([k]) => k.startsWith("İndirilecek"))?.[1]) !== in191) problems.push(`KDV Özeti ${from}–${to}: indirilecek ${kdv.summary.find(([k]) => k.startsWith("İndirilecek"))?.[1]} · model ${tl(in191)}`);
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

  // Taksitlendirilmiş borç iadeden (alacaktan) sonra borçtan büyük kalmaz: en yeni karttan başlayarak kırpılır.
  // Dönüş: kart → kesilen tutar (iade faturası bunu saklar; iade iptal edilince kart aynı tutarda geri büyür — programın
  // payment_json.coverCuts kuralı, 2.0.24 G3).
  function trimCovers(accountId) {
    const cuts = new Map();
    const covering = [...M.plans.values()].filter(p => p.accountId === accountId && p.covers && !p.invoiceId && p.status === "active");
    let excess = covering.reduce((s, p) => s + planLeft(p), 0) - Math.max(0, M.cari.get(accountId));
    for (const p of covering.sort((a, b) => b.order - a.order)) {
      if (excess <= 0) break;
      const cut = Math.min(excess, planLeft(p), p.total);
      p.total -= cut;
      excess -= cut;
      if (cut > 0) cuts.set(p, (cuts.get(p) || 0) + cut);
    }
    return cuts;
  }

  // ---------- Fatura (v2.0.15): bağımsız model ----------
  // Her fatura modelde: tür, cari, tarih, kalemler (kuruş), TL ödenecek, cariye/Kasa'ya/stoğa/çeke/taksite etkileri.
  // İptalde bu etkiler birebir geri alınır; iade faturası asıl faturanın kalan miktarından kesilir.
  const WITHHOLD = { 612: [9, 10], 624: [2, 10], 616: [5, 10], 603: [7, 10] };
  const EXPENSE_GL = { rent: "770", utilities: "770", marketing: "760", asset: "255", other: "770", freight: "760" };
  const INFLOW = new Set(["sale", "smm", "purchase_return"]);
  const PARTY_SIGN = { sale: 1, smm: 1, purchase_return: 1, purchase: -1, sale_return: -1 };
  const counters = { purchase: 0, serial: 0, ret: 0 };
  const lastSeries = { paper: "", smm: "", internal: "" };
  const seriesOf = (kind, numbered) => (kind === "smm" ? "smm" : kind === "sale_return" ? (numbered ? "" : "internal") : kind === "purchase" ? "" : "paper");
  const issuedInvoices = (filter = () => true) => [...M.invoices.values()].filter(x => x.status === "issued" && filter(x));
  const linePayload = l => ({ itemId: l.itemId || "", name: l.name, qty: l.qty / 1000, unitPrice: l.price4 / 10000, discountRate: l.disc, vatRate: l.vat, withholdingCode: l.whCode || "", expenseCode: l.expenseCode || "" });
  const rateText = rate6 => rate6 / 1e6;
  function saleLines(n, { services = true } = {}) {
    const used = new Set();
    const out = [];
    for (let k = 0; k < n; k++) {
      if (services && R.chance(0.3)) {
        const vat = R.pick([0, 1, 10, 20, 20, 20]);
        const whCode = vat && R.chance(0.3) ? R.pick(Object.keys(WITHHOLD)) : "";
        out.push({ name: `Hizmet ${R.int(1, 40)}`, qty: R.pick([1000, 1000, 2000, 1500, 250]), price4: R.int(50_0000, 4000_0000), disc: R.pick([0, 0, 0, 5, 12]), vat, whCode, wh: whCode ? WITHHOLD[whCode] : null, account: "600", goods: false });
        continue;
      }
      const it = R.pick(items.filter(x => !used.has(x.id)));
      if (!it) break;
      used.add(it.id);
      out.push({ itemId: it.id, name: "", qty: it.kg ? R.int(100, 8000) : R.int(1, 6) * 1000, price4: it.sale4 + R.int(0, 999), disc: R.pick([0, 0, 0, 3, 10]), vat: R.pick([1, 10, 20, 20]), whCode: "", wh: null, account: "600", goods: true });
    }
    return out;
  }
  function purchaseLines(n) {
    const used = new Set();
    const out = [];
    for (let k = 0; k < n; k++) {
      if (R.chance(0.3)) {
        const expenseCode = R.pick(Object.keys(EXPENSE_GL));
        out.push({ name: `Gider ${expenseCode}`, expenseCode, qty: 1000, price4: R.int(20_0000, 9000_0000), disc: 0, vat: R.pick([0, 10, 20, 20]), whCode: "", wh: null, account: EXPENSE_GL[expenseCode], goods: false });
        continue;
      }
      const it = R.pick(items.filter(x => !used.has(x.id)));
      if (!it) break;
      used.add(it.id);
      out.push({ itemId: it.id, name: "", qty: it.kg ? R.int(500, 60000) : R.int(1, 40) * 1000, price4: Math.max(1, it.cost4 + R.int(-300, 300)), disc: R.pick([0, 0, 5]), vat: R.pick([1, 10, 20, 20]), whCode: "", wh: null, account: "153", goods: true });
    }
    return out;
  }
  const docOpts = () => ({ incl: R.chance(0.3), disc: R.chance(0.2) ? R.pick([2, 5, 10]) : 0, stop: 0, rate6: R.chance(0.12) ? R.pick([34_251_200, 36_100_000, 1_250_000]) : 1_000_000 });
  const currencyOf = rate6 => (rate6 === 1_000_000 ? "TRY" : rate6 === 34_251_200 ? "USD" : rate6 === 36_100_000 ? "EUR" : "GBP");
  // Ödeme planı (TL kuruş): peşin (Kasa), çek/senet, ciro, kalan (açık / taksit / iade mahsubu).
  function paymentFor(kind, P, day, accountId) {
    const pay = { cash: [], cheques: [], endorse: [], rest: "open", installments: null, dueDate: "" };
    let left = P;
    const take = max => Math.max(0, Math.min(left, max));
    const mode = R.pick(kind === "sale" || kind === "smm" ? ["cash", "open", "inst", "mix", "mix", "cheque"] : kind === "purchase" ? ["cash", "open", "mix", "cheque", "endorse"] : ["cash", "open", "mix"]);
    if (mode === "cash" || mode === "mix") {
      const methods = [...METHOD_ORDER].sort(() => R.next() - 0.5).slice(0, R.int(1, 2));
      for (const method of methods) {
        const amount = mode === "cash" && method === methods.at(-1) ? left : take(R.int(1, Math.max(1, Math.floor(left / 2))));
        if (amount > 0) { pay.cash.push({ amount, method }); left -= amount; }
      }
    }
    if ((mode === "cheque" || (mode === "mix" && R.chance(0.6))) && ["sale", "smm", "purchase"].includes(kind) && left > 0) {
      const n = R.int(1, 2);
      for (let k = 0; k < n && left > 0; k++) {
        const amount = mode === "cheque" && k === n - 1 ? left : take(R.int(1, Math.max(1, Math.floor(left / 2))));
        if (amount <= 0) continue;
        counters.serial += 1;
        pay.cheques.push({ instrument: R.chance(0.7) ? "cheque" : "note", amount, dueDate: addDays(day, R.int(0, 90)), serialNo: `S${seed}-${counters.serial}`, bank: R.pick(["Ziraat", "Garanti", "İş Bankası"]) });
        left -= amount;
      }
    }
    if ((mode === "endorse" || (mode === "mix" && kind === "purchase")) && kind === "purchase") {
      for (const c of [...M.cheques.values()].filter(c => c.direction === "in" && c.status === "portfolio" && c.accountId !== accountId && c.date <= day)) {
        if (c.amount <= left && R.chance(0.6)) { pay.endorse.push(c.id); left -= c.amount; }
        if (pay.endorse.length >= 2) break;
      }
    }
    if (left > 0) {
      if ((kind === "sale" || kind === "smm") && (mode === "inst" || (mode === "mix" && R.chance(0.5)))) pay.installments = { count: R.int(1, 6), firstDue: addDays(day, R.int(0, 40)) };
      else if (R.chance(0.5)) pay.dueDate = addDays(day, R.int(0, 60));
    }
    pay.rest = pay.installments ? "installments" : "open";
    pay.left = left;
    return pay;
  }
  const paymentPayload = pay => ({
    cash: pay.cash.map(c => ({ amount: c.amount / 100, method: c.method })),
    cheques: pay.cheques.map(c => ({ instrument: c.instrument, amount: c.amount / 100, dueDate: c.dueDate, serialNo: c.serialNo, bank: c.bank })),
    endorse: pay.endorse,
    rest: pay.rest,
    ...(pay.installments ? { installments: pay.installments } : {}),
    ...(pay.dueDate ? { dueDate: pay.dueDate } : {}),
  });
  // Fatura kesmenin beklenen retleri (programın işlem sırasıyla): dönem kilidi, kronoloji, mükerrer no, stok eksiye
  // (kalem sırası), Kasa eksiye (çıkışlar). null: kabul edilmeli.
  function invoiceRejection({ kind, day, lines, pay, force, cashForce, number, accountId, series }) {
    if (!open(day)) return ["period-locked"];
    if (series && lastSeries[series] && lastSeries[series] > day) return ["chronology"];
    if (number && issuedInvoices(x => x.kind === kind && x.accountId === accountId && x.number === number).length) return ["invoice-duplicate"];
    if (["sale", "purchase_return"].includes(kind) && !force) {
      const need = new Map();
      for (const l of lines.filter(l => l.goods)) {
        need.set(l.itemId, (need.get(l.itemId) || 0) + l.qty);
        if (M.stok.get(l.itemId) - need.get(l.itemId) < 0) return ["stock-negative"];
      }
    }
    if (!INFLOW.has(kind)) {
      const codes = new Set();
      for (const c of pay.cash) if (blocks(c.amount, day, c.method)) { if (policy[c.method] === "block") codes.add("cash-blocked"); else if (!cashForce) codes.add("cash-negative"); }
      if (codes.size) return [...codes];
    }
    return null;
  }
  // Kesilen faturanın etkilerini modele yazar (program yanıtındaki kalem, çek ve kart kimlikleriyle).
  function applyInvoice({ kind, day, accountId, lines, calc, pay, data, opts, number, series, originalId = "" }) {
    const inv = { id: data.id, kind, accountId, date: day, number: data.number || number || "", series, tryNet: calc.tryNet, tryVat: calc.tryVat, tryWithheld: calc.tryWithheld, tryPayable: calc.tryPayable, status: "issued", lines: [], opts, cariFx: [], cashRows: [], moves: [], chequesCreated: [], endorsed: [], planId: "", rest: pay.left, originalId, returned: new Map() };
    const fx = (acc, cents) => { if (!cents) return; cariAdd(acc, cents); inv.cariFx.push([acc, cents]); };
    fx(accountId, PARTY_SIGN[kind] * calc.tryPayable);
    const into = INFLOW.has(kind);
    for (const c of pay.cash) {
      fx(accountId, into ? -c.amount : c.amount);
      M.kasa[c.method] += into ? c.amount : -c.amount;
      const row = { invoiceId: inv.id, kind: into ? "in" : "out", amount: c.amount, method: c.method, date: day };
      M.invCash.push(row);
      inv.cashRows.push(row);
    }
    const serverCheques = data.cheques || [];
    for (const c of pay.cheques) {
      const sc = serverCheques.find(x => x.serialNo === c.serialNo && !x.endorsed);
      if (!sc) throw Object.assign(new Error(`fatura ${inv.number}: ${c.serialNo} çeki faturada görünmüyor (zincir koptu)`), { unexpected: true });
      const direction = kind === "purchase" ? "out" : "in";
      M.cheques.set(sc.id, { id: sc.id, direction, status: direction === "in" ? "portfolio" : "pending", amount: c.amount, accountId, date: day, invoiceId: inv.id, serialNo: c.serialNo, bank: c.bank, instrument: c.instrument, events: 1 });
      fx(accountId, direction === "in" ? -c.amount : c.amount);
      inv.chequesCreated.push(sc.id);
    }
    for (const id of pay.endorse) {
      const c = M.cheques.get(id);
      c.status = "endorsed";
      c.events += 1;
      c.endorseTo = accountId;
      fx(accountId, c.amount);
      inv.endorsed.push(id);
    }
    (data.lines || []).forEach((sl, index) => {
      const l = lines[index];
      const cl = calc.lines[index];
      inv.lines.push({ ...l, lineId: sl.id, tryNet: cl.tryNet });
      if (l.goods && l.itemId && (kind !== "smm")) {
        const dir = kind === "sale" || kind === "purchase_return" ? "out" : "in";
        M.stok.set(l.itemId, M.stok.get(l.itemId) + (dir === "in" ? l.qty : -l.qty));
        const move = { id: sl.moveId, itemId: l.itemId, kind: dir, qty: l.qty, price4: l.price4, pay: "none", method: "cash", accountId: "", amount: 0, stored: cl.tryNet, date: day, invoiceId: inv.id };
        M.moves.push(move);
        inv.moves.push(move);
        if (!sl.moveId) throw Object.assign(new Error(`fatura ${inv.number}: stoklu kalemin stok hareketi yok (zincir koptu)`), { unexpected: true });
      }
    });
    if (pay.installments) {
      if (!data.plan?.id) throw Object.assign(new Error(`fatura ${inv.number}: taksitli satışın taksit kartı açılmadı (zincir koptu)`), { unexpected: true });
      inv.planId = data.plan.id;
      M.plans.set(data.plan.id, { accountId, total: pay.left, paid: 0, covers: true, status: "active", order: ++planSeq, registeredOn: day, invoiceId: inv.id });
    }
    if (kind === "sale_return") {
      // v2.0.24: iade önce asıl faturanın kendi kartını küçültür (kartın kalanı = faturanın açığı); sonra genel kırpma.
      const own = originalId && M.invoices.get(originalId)?.planId ? M.plans.get(M.invoices.get(originalId).planId) : null;
      // İade modele aşağıda (M.invoices.set) yazılır; kendi kartı o zaman eşitlenir.
      for (const pl of M.plans.values()) if (pl !== own && pl.accountId === accountId && pl.covers && !pl.invoiceId && pl.status === "active") {
        pl.slack = (pl.slack || 0) + calc.tryPayable;
        pl.slackBy = inv;
      }
      inv.coverCuts = trimCovers(accountId);
      // Model kapsamı (FIFO) tutmaz: genel kırpmayı en yeni karttan yapar; program önce iadenin asıl faturasını kapsayan kartı küçültür.
      // Modelin kestiği kartı program kesmemiş olabilir → o kartta program değeri model + bu kesinti kadar yukarıda olabilir (over).
      for (const [pl, cut] of inv.coverCuts) pl.over = (pl.over || 0) + cut;
    }
    if (series) lastSeries[series] = day > lastSeries[series] ? day : lastSeries[series];
    M.invoices.set(inv.id, inv);
    if (kind === "sale_return" && originalId) syncOwn(M.plans.get(M.invoices.get(originalId)?.planId));
    return inv;
  }
  // Kesme isteği + beklenti + modele yazma. Dönüş: kesilen faturanın modeli ya da null (beklenen ret).
  async function issueInvoice({ kind, day, accountId, lines, opts, pay, force = R.chance(0.5), cashForce = R.chance(0.5), number = "", originalId = "", stop = 0, label, extra = {} }) {
    const calc = modelInvoice(lines, { ...opts, stop });
    const series = seriesOf(kind, Boolean(number));
    const body = { kind, accountId, issueDate: day, issueTime: `${String(R.int(8, 19)).padStart(2, "0")}:${String(R.int(0, 59)).padStart(2, "0")}`, currency: currencyOf(opts.rate6), rate: rateText(opts.rate6), pricesIncludeVat: opts.incl, discountRate: opts.disc, stoppageRate: stop, number, originalId, note: `Motor ${label}`, lines: lines.map(l => (l.originLineId ? { originLineId: l.originLineId, qty: l.qty / 1000 } : linePayload(l))), payment: paymentPayload(pay), force, cashForce, ...extra };
    const r = await api("POST", "/api/workspace/invoices", body);
    const want = invoiceRejection({ kind, day, lines, pay, force, cashForce, number, accountId, series });
    if (want) return expectReject(r, want, label), null;
    mustOk(r, label);
    if (centsOf(r.data.tryPayable) !== calc.tryPayable) throw Object.assign(new Error(`${label} ${r.data.number}: program ödenecek ${r.data.tryPayable} · model ${tl(calc.tryPayable)} (KDV ${tl(calc.tryVat)}, tevkifat ${tl(calc.tryWithheld)})`), { unexpected: true });
    return applyInvoice({ kind, day, accountId, lines, calc, pay, data: r.data, opts, number, series, originalId });
  }
  // İptal: beklenen ret sırası programdaki gibi (kilit, iade, kart tahsilatı, çek hareketi, Kasa eksiye, stok eksiye).
  function cancelRejection(inv, { force, cashForce }) {
    if (inv.status === "cancelled") return ["invoice-cancelled"];
    if (!open(inv.date)) return ["period-locked"];
    if (issuedInvoices(x => x.originalId === inv.id).length) return ["invoice-has-returns"];
    if (inv.planId && M.planEntries.some(e => e.planId === inv.planId)) return ["plan-has-payments"];
    for (const id of inv.endorsed) if (M.cheques.get(id).status !== "endorsed") return ["cheque-moved"];
    for (const id of inv.chequesCreated) if (M.cheques.get(id).events > 1) return ["cheque-moved"];
    const codes = new Set();
    for (const row of inv.cashRows.filter(x => x.kind === "in")) if (blocks(row.amount, row.date, row.method)) { if (policy[row.method] === "block") codes.add("cash-blocked"); else if (!cashForce) codes.add("cash-negative"); }
    if (codes.size) return [...codes];
    if (!force) {
      for (const m of inv.moves.filter(x => x.kind === "in")) {
        const after = M.stok.get(m.itemId) - inv.moves.filter(x => x.itemId === m.itemId).reduce((s, x) => s + (x.kind === "in" ? x.qty : -x.qty), 0);
        if (after < 0) return ["stock-negative"];
      }
    }
    return null;
  }
  function applyCancel(inv) {
    for (const [acc, cents] of inv.cariFx) cariAdd(acc, -cents);
    for (const row of inv.cashRows) { M.kasa[row.method] -= row.kind === "in" ? row.amount : -row.amount; M.invCash.splice(M.invCash.indexOf(row), 1); }
    for (const m of inv.moves) { M.stok.set(m.itemId, M.stok.get(m.itemId) - (m.kind === "in" ? m.qty : -m.qty)); M.moves.splice(M.moves.indexOf(m), 1); }
    for (const id of inv.chequesCreated) M.cheques.delete(id);
    for (const id of inv.endorsed) { const c = M.cheques.get(id); c.status = "portfolio"; c.events -= 1; c.endorseTo = ""; }
    if (inv.planId) M.plans.delete(inv.planId);
    // İade iptali: iadenin küçülttüğü Mevcut Borç kartları aynı tutarda geri büyür (kapatılmış ya da silinmiş kart değişmez).
    // Not (2.1.0 dilim 4): model bunu önceden yapmıyordu; banka işlemleri rastgele sırayı değiştirince tohum 2'de ortaya çıktı.
    if (inv.kind === "sale_return" && inv.coverCuts) {
      const live = new Set(M.plans.values());
      for (const [pl, cut] of inv.coverCuts) if (live.has(pl) && pl.status !== "closed") pl.total += cut;
    }
    if (inv.kind === "sale_return" && inv.originalId) {
      const orig = M.invoices.get(inv.originalId);
      for (const l of inv.lines) orig.returned.set(l.originLineId, (orig.returned.get(l.originLineId) || 0) - l.qty);
    }
    inv.status = "cancelled";
    if (inv.kind === "sale_return" && inv.originalId) syncOwn(M.plans.get(M.invoices.get(inv.originalId)?.planId));
  }
  // İade kalemleri: asıl faturanın iade edilebilir kalanından.
  function returnLines(orig, { exceed = false } = {}) {
    const out = [];
    for (const l of orig.lines.filter(l => l.goods || orig.kind === "sale")) {
      const left = l.qty - (orig.returned.get(l.lineId) || 0);
      if (left <= 0 || (!exceed && R.chance(0.35) && out.length)) continue;
      const qty = exceed ? left + 1000 : Math.max(1, Math.min(left, l.qty >= 2000 ? R.int(1, Math.floor(left / 1000) || 1) * 1000 : left));
      out.push({ ...l, originLineId: l.lineId, qty: Math.min(qty, exceed ? qty : left), account: orig.kind === "sale" ? "610" : l.account });
      if (exceed) break;
    }
    return out;
  }
  // ---------- v2.1.0 Banka Fişi: tam tanımlı gövde (sunucunun form ön değerlerine dayanmaz) + bağımsız banka etkisi ----------
  // Banka etkisi kuruş, giriş artı: masrafta BSMV Hariç ise tutar + yarım-yukarı BSMV, Dahil ise tutar; faiz gelirinde brüt − stopaj
  // (oranla yarım-yukarı ya da elle tutar); faiz giderinde tutar + BSMV/KKDF; diğer gelir/giderde tutar.
  let feeKeys = ["diger"];
  let incomeGl = ["649"];
  let expenseGl = ["659"];
  const BANK_TYPES = ["fee", "fee", "interest_in", "interest_out", "other_in", "other_out"];
  function voucherBody(type, b, amount, date) {
    const body = { type, accountId: b.id, date, amount: tl(amount), description: `Banka ${type} T${seed}` };
    let cents;
    if (type === "fee") {
      body.tax = R.pick(["bsmv_incl", "bsmv_incl", "bsmv_excl", "none"]);
      body.feeType = R.pick(feeKeys);
      if (body.tax !== "none") body.taxRate = R.pick(["5", "5", "10"]);
      const ppm = body.tax === "none" ? 0 : Number(body.taxRate) * 10_000;
      cents = -(body.tax === "bsmv_excl" ? amount + halfAway(amount * ppm, 1_000_000) : amount);
    } else if (type === "interest_in") {
      if (R.chance(0.25)) {
        const stoppage = R.int(0, amount - 1);
        body.stoppageAmount = tl(stoppage);
        cents = amount - stoppage;
      } else {
        body.stoppageRate = R.pick(["15", "15", "17,5", "0"]);
        cents = amount - halfAway(amount * Math.round(Number(body.stoppageRate.replace(",", ".")) * 10_000), 1_000_000);
      }
    } else if (type === "interest_out") {
      const tax = R.chance(0.4) ? R.int(1, Math.max(1, Math.floor(amount / 10))) : 0;
      body.taxAmount = tl(tax);
      cents = -(amount + tax);
    } else {
      body.gl = R.pick(type === "other_in" ? incomeGl : expenseGl);
      cents = type === "other_in" ? amount : -amount;
    }
    return { body, cents };
  }
  /** İşlem Kartı'ndaki banka satırlarının net etkisi (borç +, alacak −). */
  const bankSigned = card => (card?.lines || []).filter(line => line.role === "bank").reduce((t, line) => t + (line.side === "D" ? 1 : -1) * Number(line.tryMinor), 0);
  function bankAdd(row) {
    M.kasa.bank += row.cents;
    M.bankLines.push(row);
  }
  /** Ters kaydın tarihi: kilitli günün fişi bugünün tarihiyle, açık günün fişi kendi tarihiyle ters kaydedilir. */
  const reversalDate = e => (lock && e.date <= lock ? T : e.date);
  function rejectedWith(r, status, kind) {
    if (r.status !== status) throw Object.assign(new Error(`${kind}: ${status} beklenirken ${r.status} ${r.text}`), { unexpected: true });
    expectReject(r, [], kind);
  }

  async function op(kind) {
    count(kind);
    const acc = R.pick(accounts);
    const cust = R.pick(customers);
    const item = R.pick(items);
    const day = cur;
    switch (kind) {
      case "kasa": {
        const amount = moneyCents(1, 40000);
        const force = R.chance(0.5);
        // v2.0.17: Kasa ↔ Banka transferi (%30): nakit tarafı + banka tarafı tek işlemde, aynı transferId.
        if (R.chance(0.3)) {
          const direction = R.chance(0.5) ? "to-cash" : "to-bank";
          const r = await api("POST", "/api/workspace/cash/transfer", { direction, amount: tl(amount), date: day, description: `Transfer ${direction}`, cashForce: force });
          if (direction === "to-bank" && negative(r, [["cash", amount, day]], force, kind)) return;
          mustOk(r, kind);
          const cashKind = direction === "to-cash" ? "in" : "out";
          M.kasa.cash += cashKind === "in" ? amount : -amount;
          M.kasa.bank += cashKind === "in" ? -amount : amount;
          const cashRow = { id: r.data.id, kind: cashKind, amount, method: "cash", date: day, transferId: r.data.transferId };
          const bankRow = { id: r.data.bankId, kind: cashKind === "in" ? "out" : "in", amount, method: "bank", date: day, transferId: r.data.transferId };
          cashRow.twin = bankRow;
          bankRow.twin = cashRow;
          M.cash.push(cashRow, bankRow);
          return;
        }
        // v2.0.17: Kasa'ya yalnız nakit girilir; nakit dışı yol 400 cash-method.
        const k = R.chance(0.55) ? "in" : "out";
        if (R.chance(0.15)) {
          const r = await api("POST", "/api/workspace/cash", { kind: k, amount: tl(amount), method: R.pick(["bank", "card"]), description: `Kasa ${k}`, date: day, cashForce: force });
          return void expectReject(r, "cash-method", kind);
        }
        const method = "cash";
        const r = await api("POST", "/api/workspace/cash", { kind: k, amount: tl(amount), method, description: `Kasa ${k}`, date: day, cashForce: force });
        if (k === "out" && negative(r, [[method, amount, day]], force, kind)) return;
        mustOk(r, kind);
        M.kasa[method] += k === "in" ? amount : -amount;
        M.cash.push({ id: r.data.id, kind: k, amount, method, date: day });
        return;
      }
      case "kasa-duzelt": {
        const e = pickOpen(M.cash);
        if (!e) return;
        const amount = moneyCents(1, 40000);
        // v2.0.17: yol değiştirilmez (gönderilse de sunucu eskisini korur); transferde iki taraf birlikte güncellenir.
        const method = e.method;
        const eff = x => ({ method: x.method, cents: x.kind === "in" ? x.amount : -x.amount });
        const force = R.chance(0.5);
        const r = await api("PUT", `/api/workspace/cash/${e.id}`, { kind: e.kind, amount: tl(amount), method: methodPick(), description: "Düzeltildi", date: e.date, cashForce: force });
        const outs = changeOuts(eff(e), eff({ ...e, amount, method }), e.date);
        if (e.twin) outs.push(...changeOuts(eff(e.twin), eff({ ...e.twin, amount }), e.date));
        if (negative(r, outs, force, kind)) return;
        mustOk(r, kind);
        M.kasa[e.method] -= e.kind === "in" ? e.amount : -e.amount;
        M.kasa[method] += e.kind === "in" ? amount : -amount;
        Object.assign(e, { amount, method });
        if (e.twin) {
          M.kasa[e.twin.method] -= e.twin.kind === "in" ? e.twin.amount : -e.twin.amount;
          M.kasa[e.twin.method] += e.twin.kind === "in" ? amount : -amount;
          e.twin.amount = amount;
        }
        return;
      }
      case "kasa-sil": {
        const e = pickOpen(M.cash);
        if (!e) return;
        const force = R.chance(0.5);
        const r = await api("DELETE", `/api/workspace/cash/${e.id}${force ? "?cashForce=1" : ""}`);
        const outs = e.kind === "in" ? [[e.method, e.amount, e.date]] : [];
        if (e.twin && e.twin.kind === "in") outs.push([e.twin.method, e.twin.amount, e.twin.date]);
        if (outs.length && negative(r, outs, force, kind)) return;
        mustOk(r, kind);
        M.kasa[e.method] -= e.kind === "in" ? e.amount : -e.amount;
        M.cash.splice(M.cash.indexOf(e), 1);
        if (e.twin) {
          // Transferin öbür yarısı da silindi.
          M.kasa[e.twin.method] -= e.twin.kind === "in" ? e.twin.amount : -e.twin.amount;
          M.cash.splice(M.cash.indexOf(e.twin), 1);
        }
        return;
      }
      case "cari": {
        const k = R.pick(["debt", "credit", "in", "out"]);
        const method = methodPick();
        const amount = moneyCents(1, 60000);
        const force = R.chance(0.5);
        const r = await api("POST", `/api/workspace/accounts/${acc.id}/entries`, { kind: k, amount: tl(amount), method, note: `Cari ${k}`, date: day, cashForce: force });
        if (k === "out" && negative(r, [[method, amount, day]], force, kind)) return;
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
        const eff = x => ({ method: x.kind === "in" || x.kind === "out" ? x.method : "", cents: x.kind === "in" ? x.amount : -x.amount });
        const force = R.chance(0.5);
        const r = await api("PUT", `/api/workspace/accounts/${e.accountId}/entries/${e.id}`, { kind: flip, amount: tl(amount), method, note: "Düzeltildi", date: e.date, cashForce: force });
        if (negative(r, changeOuts(eff(e), eff(next), e.date), force, kind)) return;
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
        if (e.kind === "in" && negative(r, [[e.method, e.amount, e.date]], force, kind)) return;
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
        if (pay === "cash" && negative(r, [[method, amount, day]], force, kind)) return;
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
          if (created) M.plans.set(created.id, { accountId: cust.id, total: amount, paid: 0, covers: true, status: "active", order: ++planSeq, registeredOn: D0 });
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
        if (pay === "cash" && negative(r, [[method, amount, day]], force, kind)) return;
        mustOk(r, kind);
        M.stok.set(src.itemId, M.stok.get(src.itemId) + qty);
        if (pay === "cash") M.kasa[method] -= amount;
        else {
          cariAdd(src.accountId, -amount);
          trimCovers(src.accountId);
        }
        M.moves.push({ id: r.data.moveId, itemId: src.itemId, kind: "in", qty, price4: src.price4, pay, method, accountId: src.accountId, amount, stored: amount, reason: "return", date: day });
        return;
      }
      case "hareket-sil": {
        const m = pickOpen(M.moves.filter(x => !x.invoiceId && !(x.accountId && [...M.plans.values()].some(p => p.accountId === x.accountId && p.covers))));
        if (!m) return;
        const force = R.chance(0.5);
        const qtyAfter = M.stok.get(m.itemId) + (m.kind === "in" ? -m.qty : m.qty);
        const cashOut = m.pay === "cash" && m.kind === "out" ? m.amount : 0;
        const r = await api("DELETE", `/api/workspace/stock/${m.itemId}/moves/${m.id}${force ? "?cashForce=1" : ""}`);
        if (cashOut && negative(r, [[m.method, cashOut, m.date]], force, kind)) return;
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
        const eff = (x, a) => ({ method: x.pay === "cash" ? x.method : "", cents: x.kind === "out" ? a : -a });
        const force = R.chance(0.5);
        const r = await api("PUT", `/api/workspace/stock/${m.itemId}/moves/${m.id}`, { qty: qtyText(qty), unitPrice: priceText(price4), force: true, cashForce: force });
        if (amount === 0) return expectReject(r, null, kind);
        if (negative(r, changeOuts(eff(m, m.amount), eff(m, amount), m.date), force, kind)) return;
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
        M.plans.set(r.data.id, { accountId: cust.id, total, paid: 0, covers, status: "active", order: ++planSeq, registeredOn: day });
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
          if (negative(r, [[method, amount, day]], force, kind)) return;
          mustOk(r, kind);
          p.paid -= amount;
          syncOwn(p);
          cariAdd(p.accountId, amount);
          M.kasa[method] -= amount;
          M.planEntries.push({ id: r.data.entryId, planId: id, kind: "out", amount, method, date: day });
          return;
        }
        const amount = Math.max(1, Math.min(planLeft(p) || moneyCents(1, 2000), moneyCents(1, 12000)));
        const r = await api("POST", `/api/workspace/plans/${id}/entries`, { kind: "in", amount: tl(amount), method, date: day });
        mustOk(r, kind);
        p.paid += amount;
        syncOwn(p);
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
        if (e.kind === "in" && negative(r, [[e.method, e.amount, e.date]], force, kind)) return;
        mustOk(r, kind);
        p.paid += e.kind === "in" ? -e.amount : e.amount;
        syncOwn(p);
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
        const which = R.pick(["ekle-kasa", "ekle-cari", "ekle-stok", "duzelt-kasa", "sil-cari", "sil-stok", "sil-taksit", "kart", "fatura-kes", "fatura-iptal", "fatura-iade"]);
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
        if (which === "sil-stok") { const m = locked(M.moves.filter(x => !x.invoiceId)); if (!m) return; r = await api("DELETE", `/api/workspace/stock/${m.itemId}/moves/${m.id}?cashForce=1`); }
        if (which === "sil-taksit") { const e = locked(M.planEntries); if (!e) return; r = await api("DELETE", `/api/workspace/plans/${e.planId}/entries/${e.id}?cashForce=1`); }
        if (which === "fatura-kes") {
          const lines = saleLines(1);
          if (!lines.length) return;
          r = await api("POST", "/api/workspace/invoices", { kind: "sale", accountId: cust.id, issueDate: past, lines: lines.map(linePayload), payment: { rest: "open" }, force: true });
        }
        if (which === "fatura-iptal") { const inv = R.pick(issuedInvoices(x => !open(x.date))); if (!inv) return; r = await api("POST", `/api/workspace/invoices/${inv.id}/cancel`, { force: true, cashForce: true }); }
        if (which === "fatura-iade") {
          // Asıl fatura kapalı dönemden önce de olsa iade faturası kapalı döneme tarihlenemez.
          const orig = R.pick(issuedInvoices(x => x.kind === "sale" && x.date <= past && x.lines.some(l => l.qty - (x.returned.get(l.lineId) || 0) > 0)));
          if (!orig) return;
          r = await api("POST", "/api/workspace/invoices", { kind: "sale_return", originalId: orig.id, issueDate: past, lines: returnLines(orig).slice(0, 1).map(l => ({ originLineId: l.originLineId, qty: l.qty / 1000 })), payment: {} });
        }
        return expectReject(r, "period-locked", `${kind}/${which}`);
      }
      // ---------- Fatura ----------
      case "fatura-satis": {
        // Stoktan / hizmet satışı ya da SMM; peşin (Kasa), çek/senet, taksit, açık hesap karışık.
        const smm = R.chance(0.15);
        const lines = smm ? saleLines(R.int(1, 2), { services: true }).filter(l => !l.goods) : saleLines(R.int(1, 3));
        if (!lines.length) return;
        const opts = smm ? { incl: false, disc: 0, stop: 0, rate6: 1_000_000 } : docOpts();
        const stop = smm ? R.pick([0, 20]) : 0;
        const calc = modelInvoice(lines, { ...opts, stop });
        if (calc.tryPayable <= 0) return;
        const pay = paymentFor(smm ? "smm" : "sale", calc.tryPayable, day, cust.id);
        await issueInvoice({ kind: smm ? "smm" : "sale", day, accountId: cust.id, lines, opts, pay, stop, label: kind });
        return;
      }
      case "fatura-alis": {
        const sup = R.pick(suppliers);
        const lines = purchaseLines(R.int(1, 3));
        if (!lines.length) return;
        const opts = docOpts();
        const calc = modelInvoice(lines, opts);
        const pay = paymentFor("purchase", calc.tryPayable, day, sup.id);
        // Tedarikçinin fatura numarası: başka tedarikçinin numarası serbest; iptal edilmiş faturanın numarası yeniden kullanılabilir.
        let number;
        const reuseOther = issuedInvoices(x => x.kind === "purchase" && x.accountId !== sup.id && !issuedInvoices(y => y.kind === "purchase" && y.accountId === sup.id && y.number === x.number).length);
        const reuseCancelled = [...M.invoices.values()].filter(x => x.kind === "purchase" && x.status === "cancelled" && x.accountId === sup.id && !issuedInvoices(y => y.kind === "purchase" && y.accountId === sup.id && y.number === x.number).length);
        if (reuseCancelled.length && R.chance(0.3)) number = R.pick(reuseCancelled).number;
        else if (reuseOther.length && R.chance(0.15)) number = R.pick(reuseOther).number;
        else number = `A${seed}-${++counters.purchase}`;
        await issueInvoice({ kind: "purchase", day, accountId: sup.id, lines, opts, pay, number, label: kind });
        return;
      }
      case "fatura-iade": {
        // Satıştan iade (müşterinin numarasıyla ya da iç seri) / Alıştan iade; kalan miktar kadar, kısmi.
        const orig = R.pick(issuedInvoices(x => (x.kind === "sale" || x.kind === "purchase") && x.lines.some(l => (l.goods || x.kind === "sale") && l.qty - (x.returned.get(l.lineId) || 0) > 0)));
        if (!orig) return;
        const lines = returnLines(orig);
        if (!lines.length) return;
        const rk = orig.kind === "sale" ? "sale_return" : "purchase_return";
        const calc = modelInvoice(lines, orig.opts);
        const pay = paymentFor(rk, calc.tryPayable, day, orig.accountId);
        const number = rk === "sale_return" && R.chance(0.5) ? `IAD${seed}-${++counters.ret}` : "";
        const inv = await issueInvoice({ kind: rk, day, accountId: orig.accountId, lines, opts: orig.opts, pay, number, originalId: orig.id, label: kind });
        if (inv) for (const l of lines) orig.returned.set(l.originLineId, (orig.returned.get(l.originLineId) || 0) + l.qty);
        return;
      }
      case "fatura-iptal": {
        const inv = R.pick([...M.invoices.values()].filter(x => !(x.planId && M.plans.get(x.planId)?.status === "closed")));
        if (!inv) return;
        const force = R.chance(0.5), cashForce = R.chance(0.5);
        const r = await api("POST", `/api/workspace/invoices/${inv.id}/cancel`, { reason: "Motor iptal", force, cashForce });
        const want = cancelRejection(inv, { force, cashForce });
        if (want) return expectReject(r, want, `${kind}/${inv.kind}`);
        mustOk(r, kind);
        applyCancel(inv);
        return;
      }
      case "fatura-taslak": {
        // Taslak deftere yazmaz; günü gelince kesilir ya da silinir.
        const draft = R.pick([...M.drafts.values()]);
        if (draft && R.chance(0.6)) {
          M.drafts.delete(draft.id);
          if (R.chance(0.3)) { mustOk(await api("DELETE", `/api/workspace/invoices/${draft.id}`), kind); return; }
          const pay = { cash: [], cheques: [], endorse: [], rest: "open", installments: null, dueDate: "", left: draft.calc.tryPayable };
          const force = R.chance(0.5);
          const r = await api("POST", `/api/workspace/invoices/${draft.id}/issue`, { issueDate: day, payment: { rest: "open" }, force });
          const want = invoiceRejection({ kind: "sale", day, lines: draft.lines, pay, force, cashForce: false, accountId: draft.accountId, series: "paper" });
          if (want) { M.drafts.set(draft.id, draft); return expectReject(r, want, `${kind}/kes`); }
          mustOk(r, kind);
          if (centsOf(r.data.tryPayable) !== draft.calc.tryPayable) throw Object.assign(new Error(`taslaktan kesilen ${r.data.number}: program ${r.data.tryPayable} · model ${tl(draft.calc.tryPayable)}`), { unexpected: true });
          applyInvoice({ kind: "sale", day, accountId: draft.accountId, lines: draft.lines, calc: draft.calc, pay, data: r.data, opts: draft.opts, series: "paper" });
          return;
        }
        const lines = saleLines(R.int(1, 2));
        if (!lines.length) return;
        const opts = docOpts();
        const calc = modelInvoice(lines, opts);
        const r = await api("POST", "/api/workspace/invoices", { kind: "sale", status: "draft", accountId: cust.id, issueDate: day, currency: currencyOf(opts.rate6), rate: rateText(opts.rate6), pricesIncludeVat: opts.incl, discountRate: opts.disc, lines: lines.map(linePayload), payment: { rest: "open" } });
        mustOk(r, kind);
        M.drafts.set(r.data.id, { id: r.data.id, accountId: cust.id, lines, opts, calc });
        return;
      }
      case "cek-tahsil": {
        const c = R.pick([...M.cheques.values()].filter(x => x.direction === "in" && x.status === "portfolio"));
        if (!c) return;
        const method = R.pick(["bank", "bank", "cash"]);
        const r = await api("POST", `/api/workspace/cheques/${c.id}/actions`, { action: "collect", date: day, method });
        mustOk(r, kind);
        c.status = "collected";
        c.events += 1;
        M.kasa[method] += c.amount;
        M.chqCash.push({ chequeId: c.id, kind: "in", amount: c.amount, method, date: day });
        return;
      }
      case "cek-ode": {
        const c = R.pick([...M.cheques.values()].filter(x => x.direction === "out" && x.status === "pending"));
        if (!c) return;
        const method = R.pick(["bank", "bank", "cash"]);
        const force = R.chance(0.5);
        const r = await api("POST", `/api/workspace/cheques/${c.id}/actions`, { action: "pay", date: day, method, cashForce: force });
        if (negative(r, [[method, c.amount, day]], force, kind)) return;
        mustOk(r, kind);
        c.status = "paid";
        c.events += 1;
        M.kasa[method] -= c.amount;
        M.chqCash.push({ chequeId: c.id, kind: "out", amount: c.amount, method, date: day });
        return;
      }
      case "fatura-acid": {
        // Kasıtlı yarıda kalan işlem: önce stok/cari/Kasa satırları yazılır, sonra bir adım düşer → tamamı geri alınmalı
        // (yetim kayıt yok; model değişmez, doğrulama bunu her tablo için ölçer).
        const which = R.pick(["stok", "kasa", "cek"]);
        if (which === "stok") {
          const lines = saleLines(3, { services: false });
          if (lines.length < 2) return;
          const last = lines.at(-1);
          last.qty = Math.max(1000, M.stok.get(last.itemId) + R.int(1, 5) * 1000);
          const opts = docOpts();
          const calc = modelInvoice(lines, opts);
          const pay = paymentFor("sale", calc.tryPayable, day, cust.id);
          return void (await issueInvoice({ kind: "sale", day, accountId: cust.id, lines, opts, pay, force: false, label: `${kind}/stok` }));
        }
        if (which === "kasa") {
          const method = R.pick(METHOD_ORDER.filter(m => policy[m] !== "off")) || "cash";
          const need = Math.max(0, Math.min(balAt(method, day), balAt(method, ""))) + R.int(1, 5000) * 100;
          const it = R.pick(items);
          const lines = [{ itemId: it.id, name: "", qty: 1000, price4: need * 100, disc: 0, vat: 20, whCode: "", wh: null, account: "153", goods: true }];
          const opts = { incl: false, disc: 0, stop: 0, rate6: 1_000_000 };
          const calc = modelInvoice(lines, opts);
          const pay = { cash: [{ amount: need, method }], cheques: [], endorse: [], rest: "open", installments: null, dueDate: "", left: calc.tryPayable - need };
          return void (await issueInvoice({ kind: "purchase", day, accountId: R.pick(suppliers).id, lines, opts, pay, cashForce: false, number: `A${seed}-${++counters.purchase}`, label: `${kind}/kasa` }));
        }
        // Çek: aynı seri/banka/türde ikinci evrak işlemin en sonunda (stok, cari, Kasa yazıldıktan sonra) reddedilir.
        const twin = R.pick([...M.cheques.values()].filter(c => c.direction === "in"));
        if (!twin || !open(day)) return;
        const lines = saleLines(2);
        if (!lines.length) return;
        const opts = docOpts();
        const calc = modelInvoice(lines, opts);
        const cashPart = Math.floor(calc.tryPayable / 3);
        const chequePart = Math.max(1, Math.floor(calc.tryPayable / 3));
        if (cashPart + chequePart > calc.tryPayable) return;
        const pay = { cash: cashPart ? [{ amount: cashPart, method: "cash" }] : [], cheques: [{ instrument: twin.instrument, amount: chequePart, dueDate: addDays(day, 30), serialNo: twin.serialNo, bank: twin.bank }], endorse: [], rest: "installments", installments: { count: 3, firstDue: addDays(day, 10) }, dueDate: "", left: calc.tryPayable - cashPart - chequePart };
        const body = { kind: "sale", accountId: cust.id, issueDate: day, currency: currencyOf(opts.rate6), rate: rateText(opts.rate6), pricesIncludeVat: opts.incl, discountRate: opts.disc, lines: lines.map(linePayload), payment: paymentPayload(pay), force: true };
        const r = await api("POST", "/api/workspace/invoices", body);
        const want = invoiceRejection({ kind: "sale", day, lines, pay, force: true, cashForce: true, accountId: cust.id, series: "paper" });
        return expectReject(r, want || ["cheque-duplicate"], `${kind}/cek`);
      }
      case "fatura-bagli": {
        // Faturadan gelen stok hareketi ve cari satırı kendi ekranından silinmez/düzeltilmez (409 invoice-linked).
        const inv = R.pick(issuedInvoices(x => x.moves.length));
        if (!inv) return;
        const m = R.pick(inv.moves);
        const codes = open(inv.date) ? ["invoice-linked"] : ["period-locked", "invoice-linked"];
        expectReject(await api("DELETE", `/api/workspace/stock/${m.itemId}/moves/${m.id}?cashForce=1`), codes, `${kind}/stok-sil`);
        expectReject(await api("PUT", `/api/workspace/stock/${m.itemId}/moves/${m.id}`, { qty: "1", unitPrice: "1", force: true, cashForce: true }), codes, `${kind}/stok-duzelt`);
        const acc = (await api("GET", `/api/workspace/accounts/${inv.accountId}`)).data;
        const e = (acc.entries || []).find(x => x.source === "invoice" && x.sourceId === inv.id);
        if (!e) throw Object.assign(new Error(`fatura ${inv.number}: cari kartında fatura satırı yok`), { unexpected: true });
        expectReject(await api("DELETE", `/api/workspace/accounts/${inv.accountId}/entries/${e.id}?cashForce=1`), codes, `${kind}/cari-sil`);
        return;
      }
      case "fatura-hatasi": {
        // Saha hataları: her biri reddedilmeli ve hiçbir iz bırakmamalı (doğrulama her tabloyu modelle karşılaştırır).
        const which = R.pick(["tarih-ileri", "tarih-gecersiz", "tarih-bos", "taksit-vade", "acik-vade", "cek-vade", "odeme-asim", "iade-asim", "iade-once", "iade-iptal", "kronoloji", "mukerrer", "taksit-alis", "cek-iade", "ciro-yanlis", "iptal-iki-kez", "kalem-yok", "kdv-yanlis"]);
        const lines = saleLines(1, { services: false });
        if (!lines.length) return;
        const base = { kind: "sale", accountId: cust.id, issueDate: day, lines: lines.map(linePayload), payment: { rest: "open" }, force: true };
        const P = modelInvoice(lines, {}).tryPayable;
        const post = (body, codes) => api("POST", "/api/workspace/invoices", { ...base, ...body }).then(r => expectReject(r, codes, `${kind}/${which}`));
        if (which === "tarih-ileri") return post({ issueDate: addDays(T, R.int(1, 60)) }, ["date-future"]);
        if (which === "tarih-gecersiz") return post({ issueDate: R.pick(["2026-02-30", "2026-13-01", "31.12.2026", "abc"]) }, ["issueDate"]);
        if (which === "tarih-bos") return post({ issueDate: R.pick(["", "   "]) }, ["issueDate"]);
        if (which === "taksit-vade") return post({ payment: { rest: "installments", installments: { count: 3, firstDue: addDays(day, -R.int(1, 30)) } } }, ["due-before-start"]);
        if (which === "acik-vade") return post({ payment: { rest: "open", dueDate: addDays(day, -R.int(1, 30)) } }, ["due-before-start"]);
        if (which === "cek-vade") return post({ payment: { cheques: [{ amount: 1, dueDate: addDays(day, -R.int(1, 30)), serialNo: `X${seed}-${++counters.serial}`, bank: "Ziraat" }], rest: "open" } }, ["cheque-due-before-issue"]);
        if (which === "odeme-asim") return post({ payment: { cash: [{ amount: (P + R.int(1, 50000)) / 100, method: "cash" }], rest: "open" } }, ["payment-exceeds"]);
        if (which === "kalem-yok") return post({ lines: [] }, ["lines"]);
        if (which === "kdv-yanlis") return post({ lines: [{ ...linePayload(lines[0]), vatRate: R.pick([8, 18, 5, -1]) }] }, ["vatRate"]);
        if (which === "taksit-alis") return post({ kind: "purchase", accountId: R.pick(suppliers).id, number: `HATA-${seed}-${R.int(1, 1e6)}`, payment: { rest: "installments", installments: { count: 2, firstDue: day } } }, ["payment.rest", "Taksitlendirme"]);
        if (which === "mukerrer") {
          const twin = R.pick(issuedInvoices(x => x.kind === "purchase"));
          if (!twin || !open(day)) return;
          return post({ kind: "purchase", accountId: twin.accountId, number: twin.number, lines: purchaseLines(1).map(linePayload), payment: { rest: "open" } }, ["invoice-duplicate"]);
        }
        if (which === "kronoloji") {
          if (!lastSeries.paper) return;
          const d = addDays(lastSeries.paper, -R.int(1, 10));
          if (!open(d) || d < D0) return;
          return post({ issueDate: d }, ["chronology"]);
        }
        if (which === "iptal-iki-kez") {
          const inv = R.pick([...M.invoices.values()].filter(x => x.status === "cancelled"));
          if (!inv) return;
          return expectReject(await api("POST", `/api/workspace/invoices/${inv.id}/cancel`, { reason: "İkinci iptal", force: true, cashForce: true }), ["invoice-cancelled"], `${kind}/${which}`);
        }
        if (which === "ciro-yanlis") {
          const c = R.pick([...M.cheques.values()].filter(x => x.direction === "in" && x.status !== "portfolio"));
          if (!c) return;
          return post({ kind: "purchase", accountId: R.pick(suppliers).id, number: `HATA-${seed}-${R.int(1, 1e6)}`, lines: purchaseLines(1).map(l => linePayload({ ...l, price4: Math.max(l.price4, c.amount * 200) })), payment: { endorse: [c.id], rest: "open" } }, ["cheque-not-in-portfolio"]);
        }
        const orig = R.pick(issuedInvoices(x => x.kind === "sale" && x.lines.some(l => l.qty - (x.returned.get(l.lineId) || 0) > 0)));
        if (which === "iade-iptal") {
          const dead = R.pick([...M.invoices.values()].filter(x => x.kind === "sale" && x.status === "cancelled"));
          if (!dead) return;
          return post({ kind: "sale_return", originalId: dead.id, lines: dead.lines.slice(0, 1).map(l => ({ originLineId: l.lineId, qty: 0.001 })), payment: {} }, ["originalId"]);
        }
        if (!orig) return;
        if (which === "iade-asim") return post({ kind: "sale_return", originalId: orig.id, lines: returnLines(orig, { exceed: true }).map(l => ({ originLineId: l.originLineId, qty: l.qty / 1000 })), payment: {} }, ["return-exceeds"]);
        if (which === "iade-once") {
          if (orig.date <= D0) return;
          return post({ kind: "sale_return", originalId: orig.id, issueDate: addDays(orig.date, -R.int(1, 5)), lines: returnLines(orig).slice(0, 1).map(l => ({ originLineId: l.originLineId, qty: l.qty / 1000 })), payment: {} }, ["return-before-original"]);
        }
        if (which === "cek-iade") return post({ kind: "sale_return", originalId: orig.id, lines: returnLines(orig).slice(0, 1).map(l => ({ originLineId: l.originLineId, qty: l.qty / 1000 })), payment: { cheques: [{ amount: 1, dueDate: day, serialNo: "Z1", bank: "Ziraat" }] } }, ["payment.cheques", "çek/senet"]);
        return;
      }
      // ---------- v2.1.0 Banka Fişi (Aşama 4) ----------
      case "banka-fis": {
        const b = R.pick(banks);
        const type = R.pick(BANK_TYPES);
        const amount = moneyCents(1, 4000);
        const { body, cents } = voucherBody(type, b, amount, day);
        // Saha hataları (%25): kilitli gün, ileri/boş/bozuk tarih, açılıştan önce, sıfır/eksi/bozuk tutar, olmayan hesap, tanınmayan tür.
        if (R.chance(0.25)) {
          const which = R.pick(["kilit", "ileri", "bos", "bozuk", "acilis-once", "sifir", "eksi", "metin", "hesap", "tur"]);
          if (which === "kilit") {
            if (!lock) return;
            const back = Math.min(20, Math.round((Date.parse(lock) - Date.parse(D0)) / 864e5));
            return void expectReject(await api("POST", "/api/workspace/bank/vouchers", { ...body, date: addDays(lock, -R.int(0, back)) }), "period-locked", kind);
          }
          if (which === "ileri") return void expectReject(await api("POST", "/api/workspace/bank/vouchers", { ...body, date: addDays(T, R.int(1, 30)) }), "date-future", kind);
          if (which === "bos") return void expectReject(await api("POST", "/api/workspace/bank/vouchers", { ...body, date: "" }), "date-missing", kind);
          if (which === "bozuk") return void expectReject(await api("POST", "/api/workspace/bank/vouchers", { ...body, date: R.pick(["2026-13-40", "31.12.2026", "abc", "2026-02-30"]) }), "date-invalid", kind);
          if (which === "acilis-once") return void expectReject(await api("POST", "/api/workspace/bank/vouchers", { ...body, date: addDays(D0, -R.int(1, 10)) }), ["bank-before-opening", "period-locked"], kind);
          if (which === "sifir" || which === "eksi" || which === "metin") return void rejectedWith(await api("POST", "/api/workspace/bank/vouchers", { ...body, amount: which === "sifir" ? "0" : which === "eksi" ? "-5,00" : "on bin" }), 400, kind);
          if (which === "hesap") return void expectReject(await api("POST", "/api/workspace/bank/vouchers", { ...body, accountId: `yok-${R.int(1, 1e6)}` }), [], kind);
          return void rejectedWith(await api("POST", "/api/workspace/bank/vouchers", { ...body, type: R.pick(["transfer_x", "", "opening", "reversal"]) }), 400, kind);
        }
        const r = await api("POST", "/api/workspace/bank/vouchers", { ...body, similarOk: true });
        mustOk(r, kind);
        if (bankSigned(r.data) !== cents) throw Object.assign(new Error(`${kind} ${type} ${body.tax || ""}: İşlem Kartı banka etkisi ${tl(bankSigned(r.data))} · model ${tl(cents)}`), { unexpected: true });
        if (r.data.date !== day) throw Object.assign(new Error(`${kind}: fiş tarihi ${r.data.date} · istenen ${day}`), { unexpected: true });
        bankAdd({ id: r.data.id, bankId: b.id, type, date: day, cents, status: "active", voucher: true, body });
        return;
      }
      case "banka-ters": {
        // Saha hatası (%20): ters kaydı, ters kaydedilmişi ya da açılışı ters kaydetme → 409, hiçbir iz yok.
        if (R.chance(0.2)) {
          const wrong = R.pick(M.bankLines.filter(x => x.type === "reversal" || x.status === "reversed" || x.type === "opening"));
          if (!wrong) return;
          const code = wrong.type === "reversal" ? "bank-reversal-of-reversal" : wrong.type === "opening" ? "bank-event-opening" : "bank-already-reversed";
          return void expectReject(await api("POST", `/api/workspace/bank/events/${encodeURIComponent(wrong.id)}/reverse`, {}), code, kind);
        }
        const e = R.pick(M.bankLines.filter(x => x.status === "active" && x.voucher));
        if (!e) return;
        const r = await api("POST", `/api/workspace/bank/events/${encodeURIComponent(e.id)}/reverse`, { reason: `Motor T${seed}` });
        mustOk(r, kind);
        const date = reversalDate(e);
        if (r.data.reversal?.date !== date || bankSigned(r.data.reversal) !== -e.cents) throw Object.assign(new Error(`${kind}: ters kayıt ${r.data.reversal?.date} ${tl(bankSigned(r.data.reversal))} · model ${date} ${tl(-e.cents)} (kilit ${lock || "yok"})`), { unexpected: true });
        e.status = "reversed";
        bankAdd({ id: r.data.reversal.id, bankId: e.bankId, type: "reversal", date, cents: -e.cents, status: "active" });
        return;
      }
      case "banka-duzelt": {
        const e = R.pick(M.bankLines.filter(x => x.status === "active" && x.voucher));
        if (!e) return;
        const b = R.chance(0.3) ? R.pick(banks) : banks.find(x => x.id === e.bankId);
        const amount = moneyCents(1, 4000);
        const given = R.chance(0.3) ? cur : "";
        const { body, cents } = voucherBody(e.type, b, amount, given);
        if (!given) delete body.date;
        // Saha hatası (%15): yeni tarih kilitli güne → 409 period-locked; eski fiş etkin kalır.
        if (lock && R.chance(0.15)) return void expectReject(await api("POST", `/api/workspace/bank/events/${encodeURIComponent(e.id)}/correct`, { ...body, date: lock }), "period-locked", kind);
        // Saha hatası (%10): türü değiştirmek → 400 bank-correct-type.
        if (R.chance(0.1)) return void expectReject(await api("POST", `/api/workspace/bank/events/${encodeURIComponent(e.id)}/correct`, { ...body, type: e.type === "other_in" ? "other_out" : "other_in" }), "bank-correct-type", kind);
        const r = await api("POST", `/api/workspace/bank/events/${encodeURIComponent(e.id)}/correct`, body);
        mustOk(r, kind);
        const back = reversalDate(e);
        const date = given || back;
        if (r.data.reversal?.date !== back || bankSigned(r.data.reversal) !== -e.cents) throw Object.assign(new Error(`${kind}: ters kayıt ${r.data.reversal?.date} ${tl(bankSigned(r.data.reversal))} · model ${back} ${tl(-e.cents)}`), { unexpected: true });
        if (r.data.next?.date !== date || bankSigned(r.data.next) !== cents) throw Object.assign(new Error(`${kind} ${e.type} ${body.tax || ""}: yeni fiş ${r.data.next?.date} ${tl(bankSigned(r.data.next))} · model ${date} ${tl(cents)}`), { unexpected: true });
        e.status = "reversed";
        bankAdd({ id: r.data.reversal.id, bankId: e.bankId, type: "reversal", date: back, cents: -e.cents, status: "active" });
        bankAdd({ id: r.data.next.id, bankId: b.id, type: e.type, date, cents, status: "active", voucher: true, body: { ...body, date } });
        return;
      }
      case "banka-benzer": {
        // Aynı iş günü, aynı hesap, aynı tür ve tutar: onaysız 409 bank-similar (hiçbir şey yazılmaz); "Yine de Kaydet" ile ikinci kayıt.
        const e = R.pick(M.bankLines.filter(x => x.status === "active" && x.voucher && x.body && open(x.body.date)));
        if (!e) return;
        const r1 = await api("POST", "/api/workspace/bank/vouchers", e.body);
        expectReject(r1, "bank-similar", kind);
        if (R.chance(0.4)) return;
        const r2 = await api("POST", "/api/workspace/bank/vouchers", { ...e.body, similarOk: true });
        mustOk(r2, kind);
        if (bankSigned(r2.data) !== e.cents) throw Object.assign(new Error(`${kind}: ikinci kayıt ${tl(bankSigned(r2.data))} · model ${tl(e.cents)}`), { unexpected: true });
        bankAdd({ id: r2.data.id, bankId: e.bankId, type: e.type, date: e.body.date, cents: e.cents, status: "active", voucher: true, body: e.body });
        return;
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
    // Fatura (v2.0.15): kesme, iade, iptal, taslak, çek/senet; kasıtlı yarıda kalan işlemler ve saha hataları.
    ["fatura-satis", 14], ["fatura-alis", 9], ["fatura-iade", 6], ["fatura-iptal", 5], ["fatura-taslak", 3], ["cek-tahsil", 3], ["cek-ode", 3],
    ["fatura-acid", 4], ["fatura-hatasi", 9], ["fatura-bagli", 1],
    // Banka Fişi (v2.1.0 Aşama 4): fiş (+ saha hataları), Ters Kaydet, Düzelt, Benzer İşlem.
    ["banka-fis", 7], ["banka-ters", 2], ["banka-duzelt", 2], ["banka-benzer", 1],
  ].filter(([k]) => bank || !k.startsWith("banka-"));
  const bag = WEIGHTS.flatMap(([k, w]) => Array(w).fill(k));
  if (bank) {
    const meta = (await api("GET", "/api/workspace/bank/voucher-meta")).data || {};
    if (meta.feeTypes?.length) feeKeys = meta.feeTypes.map(x => x.key);
    if (meta.gl?.income?.length) incomeGl = meta.gl.income;
    if (meta.gl?.expense?.length) expenseGl = meta.gl.expense;
  }
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
    // Eksi bakiye denetimi: %50'de Banka Kontrol Yok + Kredi Kartı Engelle, %80'de Nakit Engelle (yönetici ayarı).
    for (const [at, next] of [[0.5, { cash: "warn", bank: "off", card: "block" }], [0.8, { cash: "block", bank: "warn", card: "warn" }]]) {
      if (i === Math.floor(operations * at)) {
        const r = await api("PUT", "/api/admin/negative-policy", next);
        if (r.status !== 200) report.mismatches.push({ at: `eksi bakiye ayarı`, problems: [`ayar kaydedilemedi: ${r.text}`] });
        else applyPolicy(next);
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
    // Yağmurdaki Kasa çıkışları onaylıdır; "Engelle" ayarında onaylı çıkış da reddedileceği için ayar Uyar'a alınır.
    const warnAll = { cash: "warn", bank: "warn", card: "warn" };
    if ((await api("PUT", "/api/admin/negative-policy", warnAll)).status === 200) applyPolicy(warnAll);
    const jobs = [];
    for (let i = 0; i < burst; i++) {
      const it = items[i % 3];
      const c = customers[i % 2];
      const amount = 1000 + i;
      if (i % 3 === 0) jobs.push(api("POST", `/api/workspace/stock/${it.id}/moves`, { kind: "out", qty: "1", unitPrice: priceText(it.sale4), pay: "account", accountId: c.id, date: T, force: true }).then(r => { mustOk(r, "eşzamanlı satış"); const a = lineCents(1000, it.sale4); M.stok.set(it.id, M.stok.get(it.id) - 1000); cariAdd(c.id, a); M.moves.push({ id: r.data.moveId, itemId: it.id, kind: "out", qty: 1000, price4: it.sale4, pay: "account", method: "cash", accountId: c.id, amount: a, stored: a, date: T }); }));
      else if (i % 3 === 1) jobs.push(api("POST", `/api/workspace/accounts/${c.id}/entries`, { kind: "in", amount: tl(amount), method: "bank", date: T }).then(r => { mustOk(r, "eşzamanlı tahsilat"); cariAdd(c.id, -amount); M.kasa.bank += amount; M.entries.push({ id: r.data.entryId, accountId: c.id, kind: "in", amount, method: "bank", date: T }); }));
      else jobs.push(api("POST", "/api/workspace/cash", { kind: "out", amount: tl(amount), method: "cash", description: "Eşzamanlı gider", date: T, cashForce: true }).then(r => { mustOk(r, "eşzamanlı kasa"); M.kasa.cash -= amount; M.cash.push({ id: r.data.id, kind: "out", amount, method: "cash", date: T }); }));
    }
    // Aynı anda fatura kesme: numara sırası boşluksuz ve tekil kalmalı (BEGIN IMMEDIATE sıraya sokar), stok/cari tutarlı.
    for (let i = 0; i < Math.min(12, Math.ceil(burst / 4)); i++) {
      const c = customers[i % 3];
      const lines = [{ itemId: items[i % 4].id, name: "", qty: 1000, price4: items[i % 4].sale4, disc: 0, vat: 20, whCode: "", wh: null, account: "600", goods: true }];
      const opts = { incl: false, disc: 0, stop: 0, rate6: 1_000_000 };
      const calc = modelInvoice(lines, opts);
      const pay = { cash: [{ amount: calc.tryPayable, method: "card" }], cheques: [], endorse: [], rest: "open", installments: null, dueDate: "", left: 0 };
      jobs.push(api("POST", "/api/workspace/invoices", { kind: "sale", accountId: c.id, issueDate: T, lines: lines.map(linePayload), payment: paymentPayload(pay), force: true }).then(r => {
        mustOk(r, "eşzamanlı fatura");
        if (centsOf(r.data.tryPayable) !== calc.tryPayable) throw new Error(`eşzamanlı fatura ${r.data.number}: ${r.data.tryPayable} · model ${tl(calc.tryPayable)}`);
        applyInvoice({ kind: "sale", day: T, accountId: c.id, lines, calc, pay, data: r.data, opts, series: "paper" });
      }));
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
  // Belge numaraları: kendi serilerimizde (kâğıt, SMM, iç iade) sıra 1'den boşluksuz ve tarih sırasıyla uyumlu (geri alınan
  // işlem numara yakmaz); ETTN her belgede tekil; aynı carinin aynı türde iki geçerli belgesi aynı numarayı taşımaz.
  if (!report.mismatches.length) {
    const problems = [];
    const all = (await api("GET", "/api/workspace/invoices?tab=all&limit=5000")).data.invoices || [];
    const bySeries = new Map();
    for (const x of all.filter(x => x.status !== "draft" && (["sale", "smm", "purchase_return"].includes(x.kind) || (x.kind === "sale_return" && M.invoices.get(x.id)?.series === "internal")))) {
      const key = x.number.slice(0, -9);
      if (!bySeries.has(key)) bySeries.set(key, []);
      bySeries.get(key).push(x);
    }
    for (const [key, list] of bySeries) {
      list.sort((a, b) => Number(a.number.slice(-9)) - Number(b.number.slice(-9)));
      list.forEach((x, i) => {
        if (Number(x.number.slice(-9)) !== i + 1) problems.push(`Seri ${key}: ${i + 1}. sırada ${x.number} (numara boşluğu ya da tekrar)`);
        if (i && list[i - 1].issueDate > x.issueDate) problems.push(`Seri ${key}: ${list[i - 1].number} (${list[i - 1].issueDate}) sonra ${x.number} (${x.issueDate}) — tarih sırası bozuk`);
      });
    }
    const ettn = new Map();
    for (const x of all.filter(x => x.ettn)) {
      if (ettn.has(x.ettn)) problems.push(`ETTN çakışması: ${ettn.get(x.ettn)} ve ${x.number}`);
      ettn.set(x.ettn, x.number);
    }
    const twins = new Map();
    for (const x of all.filter(x => x.status === "issued" && (x.kind === "purchase" || x.kind === "sale_return") && x.number)) {
      const key = `${x.accountId}|${x.kind}|${x.number}`;
      if (twins.has(key)) problems.push(`Mükerrer belge: ${x.number} (${x.kind}) aynı caride iki kez geçerli`);
      twins.set(key, x.id);
    }
    report.invoiceSeries = Object.fromEntries([...bySeries].map(([k, v]) => [k, v.length]));
    report.ettn = ettn.size;
    if (problems.length) report.mismatches.push({ at: "belge numaraları", problems });
  }
  const invList = [...M.invoices.values()];
  report.invoices = { kesilen: invList.filter(x => x.status === "issued").length, iptal: invList.filter(x => x.status === "cancelled").length, taslak: M.drafts.size, turler: invList.reduce((o, x) => ((o[x.kind] = (o[x.kind] || 0) + 1), o), {}), cek: M.cheques.size };
  report.model = { kasa: Object.fromEntries(MONEY.map(m => [m, tl(M.kasa[m])])), cariler: accounts.length, urunler: items.length, kartlar: M.plans.size, kasaHareketi: M.cash.length, bankaSatiri: M.bankLines.length, bankaTersKayit: M.bankLines.filter(x => x.type === "reversal").length, cariHareketi: M.entries.length, stokHareketi: M.moves.length, taksitHareketi: M.planEntries.length };
  // Deney sonrası kilidi kaldır (aynı veritabanında başka koşu olabilir).
  if (lock) await api("PUT", "/api/admin/period-lock", { lockedUntil: "" });
  await api("PUT", "/api/admin/negative-policy", { cash: "warn", bank: "warn", card: "warn" });
  return report;
}
