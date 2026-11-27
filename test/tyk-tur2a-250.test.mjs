// 2.5.0 Ç5-B tur 2a (dar kontrol DK-C5B) — GERÇEK program (API) üzerinden: Y-1 (Kayıt Tarihi borçtan önce olan kart), O-1 (kilitten sonra düzeltmeyle kurulan bağ), O-2 (taksit
// kartı yazım yanıtı = okuma), O-3 (taksitlere bölünmemiş kalan ve Taksit İadesi Vade Takip / zil / takvim / nakit akışında; her süzgeç seçeneği — ders 11), M13 zil (N08).
// Beklenenler ELLE (karar metinleri + v2.4.9'un gerçek kodu; yorumda hesap — ders 5, 40). Sahte saat (ders 13); kilit sınırı AKAN saatle (her adım +1 dk).
// Eski kodda (Ç5-B ilk hâli) kırmızı: Y-1 kart 'Bitti' / gecikmiş 1.000; O-1 gecikmiş 300; O-2 yanıt kartın kendi hesabı; O-3 Vade Takip / zil 0.
import assert from "node:assert/strict";
import { after, before, describe, it } from "node:test";
import { loginAdmin, startTestServer } from "./helpers.mjs";

const NOW = "2026-10-20T12:00:00+03:00";
const TODAY = "2026-10-20";
const day = offset => {
  const at = new Date(`${TODAY}T00:00:00Z`);
  at.setUTCDate(at.getUTCDate() + offset);
  return at.toISOString().slice(0, 10);
};
const unwrap = response => ({ ...response, data: response.data && typeof response.data === "object" && "ok" in response.data ? (response.data.ok ? response.data.data : response.data) : response.data });

describe("2.5.0 Ç5-B tur 2a (API): Y-1, O-1, O-2, O-3", () => {
  let server;
  let api;
  let n = 0;
  const tick = () => server.clock.advance({ minutes: 1 });
  before(async () => {
    server = await startTestServer({ now: { time: NOW, fixed: true }, env: { HUKUK_LICENSE_URL: "http://127.0.0.1:9" } });
    const client = await loginAdmin(server);
    api = { get: async url => unwrap(await client.get(url)), post: async (url, body) => unwrap(await client.post(url, body)), put: async (url, body) => unwrap(await client.put(url, body)), del: async url => unwrap(await client.del(url)) };
    await api.post("/api/workspace/bank/setup/dismiss", {});
  });
  after(async () => server?.close());
  const must = async (label, promise) => {
    const res = await promise;
    assert.equal(res.status, 200, `${label}: ${res.status} ${JSON.stringify(res.data).slice(0, 300)}`);
    return res.data;
  };
  const account = label => must(`cari ${label}`, api.post("/api/workspace/accounts", { name: `Tur2a ${label}`, type: "customer", registeredOn: day(-400), phone: `0500 252 10 ${String((n += 1)).padStart(2, "0")}` }));
  const card = acc => must("cari kartı", api.get(`/api/workspace/accounts/${acc.id}`));
  const plan = id => must("taksit kartı", api.get(`/api/workspace/plans/${id}`));
  const view = p => ({ items: p.items.map(i => [i.seq, i.remaining, i.accountPaid, i.state]), state: p.state, queue: p.totals.queueRemaining, own: p.totals.ownRemaining });
  const vade = async (acc, query = "") => (await must("Vade Takip", api.get(`/api/workspace/overview/vade-takip?from=${day(-500)}&to=${day(500)}${query}`))).rows.filter(r => r.party === acc.name || r.accountId === acc.id);
  const lateSum = rows => Math.round(rows.filter(r => r.date < TODAY && r.direction === "in").reduce((s, r) => s + (r.amount || 0), 0) * 100) / 100;
  const dues = async acc => (await must("zil", api.get("/api/workspace/dues"))).items.filter(r => r.accountId === acc.id);

  // ---- Y-1 ----
  // ELLE (v2.4.9'un gerçek kodu, dar kontrol betiği stok-kart): stoktan veresiye satış 1.000 (−20) + taksitlendir 2 taksit (−10, +20). Kartın Kayıt Tarihi carinin Kayıt Tarihi
  // (−400). Kart satışı tüketir: Gecikti [500, 500]; Vade Takip / zil iki taksit ("1. taksit 500" gecikmiş, "2. taksit 500"); gecikmiş 500.
  it("Y-1: stoktan veresiye satış → taksitlendir: kart Gecikti [500, 500], Vade Takip iki taksit, zil 1. taksit, Gecikmiş Borç 500", async () => {
    const goods = await must("ürün", api.post("/api/workspace/stock", { name: "Tur2a Ürün", code: "T2A-URN", unit: "Adet", unitPrice: "10", salePrice: "100" }));
    await must("alım", api.post(`/api/workspace/stock/${goods.id}/moves`, { kind: "in", qty: "100", unitPrice: "10", pay: "none", date: day(-100) }));
    const acc = await account("Stok Kartı");
    await must("satış + taksit", api.post(`/api/workspace/stock/${goods.id}/moves`, { kind: "out", qty: "10", unitPrice: "100", pay: "account", method: "cash", accountId: acc.id, date: day(-20), installments: { count: 2, firstDue: day(-10) } }));
    const planId = (await card(acc)).plans[0].id;
    const p = view(await plan(planId));
    assert.deepEqual([p.items.map(i => i[1]), p.state], [[500, 500], "overdue"]);
    assert.equal((await card(acc)).totals.overdueDebt, 500);
    assert.deepEqual((await vade(acc)).map(r => [r.source, r.label, r.amount]).sort(), [["plan", "1. taksit", 500], ["plan", "2. taksit", 500]]);
    assert.deepEqual((await dues(acc)).map(r => [r.source, r.amount, r.state]), [["plan", 500, "overdue"]]);
    const list = await must("Taksitler", api.get("/api/workspace/plans?status=overdue&limit=500"));
    assert.ok(list.plans.some(x => x.id === planId), "Taksitler 'Gecikmiş' sekmesinde");
  });

  // ---- O-1 ----
  // ELLE (karar (3); dar kontrol betiği k3-duzelt): F1 300 (−50) · P1 300 bağsız (−45; F1'i kapatır) · F2 300 (−40, vade +10) · F3 300 (−35, vade −35) · P2 300 bağsız (−5) ·
  // kilit −30 · P2 düzeltilip F1'e bağlanır (kilitten SONRA kurulan bağ) → F1 kilitli dönemde bağsız kapanmış, açılmaz; P2 bağsız gibi → F3 (vade −35) kapanır ("Bağsız (kilitli
  // dönemde kapanmıştı)"), F2 açık (vadesi gelmedi) → gecikmiş 0. Aynı bağ kilitten sonra YENİ kayıtla aynı sonuç.
  it("O-1: kilitten sonra DÜZELTMEYLE kurulan bağ = yeni kayıtla kurulan bağ (gecikmiş 0; F3 'kilitli dönemde kapanmıştı')", async () => {
    const item = await must("hizmet", api.post("/api/workspace/stock", { kind: "service", code: "T2A-HZM", name: "Hizmet", unit: "Adet", salePrice: "300" }));
    const sale = async (acc, date, due) => (await must("fatura", api.post("/api/workspace/invoices", { scenario: "service_sale", accountId: acc.id, issueDate: date, lines: [{ itemId: item.id, qty: 1, unitPrice: "300", vatRate: 0 }], payment: { rest: "open", dueDate: due } }))).id;
    const entry = async (acc, body) => {
      const before_ = new Set((await card(acc)).entries.map(e => e.id));
      return (await must("hareket", api.post(`/api/workspace/accounts/${acc.id}/entries`, { method: "cash", cashForce: true, ...body }))).entries.find(e => !before_.has(e.id));
    };
    const d = { a: await account("K3 Düzeltme") };
    const y = { a: await account("K3 Yeni") };
    for (const x of [d, y]) x.f1 = await sale(x.a, day(-50), day(-50));
    tick();
    for (const x of [d, y]) await entry(x.a, { kind: "in", amount: "300", date: day(-45) });
    tick();
    for (const x of [d, y]) x.f2 = await sale(x.a, day(-40), day(10));
    for (const x of [d, y]) x.f3 = await sale(x.a, day(-35), day(-35));
    tick();
    const p2 = await entry(d.a, { kind: "in", amount: "300", date: day(-5) });
    tick();
    await must("kilit", api.put("/api/admin/period-lock", { lockedUntil: day(-30) }));
    tick();
    try {
      await must("düzeltmeyle bağ", api.put(`/api/workspace/accounts/${d.a.id}/entries/${p2.id}`, { invoiceId: d.f1 }));
      tick();
      await entry(y.a, { kind: "in", amount: "300", date: day(-5), invoiceId: y.f1 });
      tick();
      for (const x of [d, y]) {
        assert.equal((await card(x.a)).totals.overdueDebt, 0, `${x.a.name}: gecikmiş 0`);
        const f3 = await must("F3", api.get(`/api/workspace/invoices/${x.f3}`));
        assert.deepEqual([f3.payState, f3.closers.map(c => c.modeLabel)], ["paid", ["Bağsız (kilitli dönemde kapanmıştı)"]], `${x.a.name}: F3`);
      }
    } finally {
      await must("kilidi kaldır", api.put("/api/admin/period-lock", { lockedUntil: "" }));
      tick();
    }
  });

  // ---- O-2 ----
  // ELLE (S50 = A, M1e, karar (2)): Yeni Borç kartı 600 (−8; 2 × 300: −5, +25) · bağsız cari tahsilatı 400 (−2) → 1. taksit 0 (cari 300), 2. taksit 200 (cari 100).
  // Kart tahsilatı 50 (bugün; kartın bağı, önce ayrılır — karar (2)) 1. taksiti kapatır → cari 250 1. taksitte, 150 2. taksitte → [0, 150]. Her yazım yanıtı = ardından okunan kart.
  it("O-2: kart tahsilatı / taksit ekle / taksit düzelt / tahsilat düzelt / tahsilat sil / Otomatik Dağıt / durum yanıtları okumayla AYNI görünüm", async () => {
    const acc = await account("Kart Yanıtı");
    const p = await must("kart", api.post("/api/workspace/plans", { name: acc.name, registeredOn: day(-8), total: "600", accountId: acc.id, mode: "auto", count: "2", firstDue: day(-5), everyMonths: "1" }));
    assert.deepEqual(view(p), view(await plan(p.id)), "açılış yanıtı");
    await must("cari tahsilatı", api.post(`/api/workspace/accounts/${acc.id}/entries`, { kind: "in", amount: "400", date: day(-2), method: "cash", cashForce: true }));
    const w = await must("kart tahsilatı", api.post(`/api/workspace/plans/${p.id}/entries`, { kind: "in", amount: "50", date: day(0), method: "cash", cashForce: true }));
    const g = await plan(p.id);
    assert.deepEqual(view(w), view(g), "tahsilat yanıtı = okuma");
    assert.deepEqual(g.items.map(i => [i.remaining, i.accountPaid]), [[0, 250], [150, 150]]);
    const steps = [
      ["taksit ekle", () => api.post(`/api/workspace/plans/${p.id}/items`, { dueDate: day(40), amount: "100" })],
      ["taksit düzelt", async () => { const it2 = (await plan(p.id)).items[1]; return api.put(`/api/workspace/plans/${p.id}/items/${it2.id}`, { dueDate: it2.dueDate, amount: "250", note: "düzeltildi" }); }],
      ["tahsilat düzelt", async () => { const e = (await plan(p.id)).entries.find(x => x.kind === "in"); return api.put(`/api/workspace/plans/${p.id}/entries/${e.id}`, { kind: "in", amount: "80", date: day(0), method: "cash", cashForce: true }); }],
      ["taksit sil", async () => { const it3 = (await plan(p.id)).items.at(-1); return api.del(`/api/workspace/plans/${p.id}/items/${it3.id}`); }],
      ["tahsilat sil", async () => { const e = (await plan(p.id)).entries.find(x => x.kind === "in"); return api.del(`/api/workspace/plans/${p.id}/entries/${e.id}?cashForce=1`); }],
      ["Otomatik Dağıt", () => api.post(`/api/workspace/plans/${p.id}/distribute`, { count: 3, firstDue: day(-5), everyMonths: 1 })],
      ["kartı kapat", () => api.put(`/api/workspace/plans/${p.id}`, { status: "closed" })],
      ["kartı aç", () => api.put(`/api/workspace/plans/${p.id}`, { status: "active" })],
    ];
    for (const [label, run] of steps) {
      const res = await run();
      assert.equal(res.status, 200, `${label}: ${res.status} ${JSON.stringify(res.data).slice(0, 200)}`);
      assert.deepEqual(view(res.data), view(await plan(p.id)), `${label}: yanıt = okuma`);
    }
  });

  // ---- O-3 ----
  // ELLE (S91 = A; C5 §2.10 madde 9 "Vade Takip gecikmiş tutarı = gecikmiş"): taksitsiz Yeni Borç kartı 1.000 (−20) → kalan tek kalem, vade kartın günü (−20) → gecikmiş 1.000;
  // Vade Takip ve zil "Taksitlendirilmemiş Kalan 1.000" (gecikmiş). 1.000'lik kartta 2 × 300 (−10, +20) → 1. taksit 300 gecikmiş + kalan 400 (vade −20) gecikmiş = 700.
  // Taksit İadesi: 600'lük kart (taksit +30), kart tahsilatı 100 (−6), iade 300 (−4) → kartın borcu 200, vade iade günü (−4) → gecikmiş 200; Vade Takip / zil "Taksit İadesi 200".
  it("O-3: taksitsiz / eksik taksitli kartın kalanı ve Taksit İadesi — gecikmiş = Vade Takip (her süzgeç) = zil = nakit akışı", async () => {
    const a = await account("Taksitsiz");
    const pa = await must("taksitsiz kart", api.post("/api/workspace/plans", { name: a.name, registeredOn: day(-20), total: "1000", accountId: a.id }));
    const b = await account("Eksik Taksitli");
    const pb = await must("kart", api.post("/api/workspace/plans", { name: b.name, registeredOn: day(-20), total: "1000", accountId: b.id }));
    await must("taksit", api.post(`/api/workspace/plans/${pb.id}/items`, { dueDate: day(-10), amount: "300" }));
    await must("taksit", api.post(`/api/workspace/plans/${pb.id}/items`, { dueDate: day(20), amount: "300" }));
    // Taksit İadesi kalemi (kartın net tahsilatı eksi) ekrandan / API'den doğmuyor: iade, tahsilat düzeltmesi ve silme net tahsilatı eksiye düşüremez (refund-exceeds) — kalem
    // saf testte (tyk-250 "O-3"); bu yolun program verisi DENENMEYEN (tur 2a raporu).
    const c = await account("Taksit İadesi");
    const pc = await must("kart", api.post("/api/workspace/plans", { name: c.name, registeredOn: day(-8), total: "600", accountId: c.id, mode: "auto", count: "1", firstDue: day(30), everyMonths: "1" }));
    const first = await must("kart tahsilatı", api.post(`/api/workspace/plans/${pc.id}/entries`, { kind: "in", amount: "300", date: day(-6), method: "cash", cashForce: true }));
    await must("taksit iadesi", api.post(`/api/workspace/plans/${pc.id}/entries`, { kind: "out", amount: "300", date: day(-4), method: "cash", cashForce: true }));
    const shrink = await api.put(`/api/workspace/plans/${pc.id}/entries/${first.entries.find(e => e.kind === "in").id}`, { kind: "in", amount: "100", date: day(-6), method: "cash", cashForce: true });
    assert.deepEqual([shrink.status, shrink.data?.code], [400, "refund-exceeds"], "net tahsilatı eksiye düşüren düzeltme reddedilir (ders 3: yanıt + kod)");
    const want = [[a, pa, 1000, [["plan", "Taksitlendirilmemiş Kalan", 1000]]], [b, pb, 700, [["plan", "1. taksit", 300], ["plan", "2. taksit", 300], ["plan", "Taksitlendirilmemiş Kalan", 400]]], [c, pc, 0, [["plan", "1. taksit", 600]]]];
    for (const [acc, p, late, rows] of want) {
      assert.equal((await card(acc)).totals.overdueDebt, late, `${acc.name}: cari kartı Gecikmiş Borç`);
      const all = await vade(acc);
      assert.deepEqual(all.map(r => [r.source, r.label, r.amount]).sort(), rows.sort(), `${acc.name}: Vade Takip kalemleri`);
      assert.equal(lateSum(all), late, `${acc.name}: Vade Takip gecikmiş = cari kartı`);
      // Her süzgeç seçeneği (ders 11): hazır aralıklar, yön, kaynak, arama — gecikmiş kalemleri içeren her seçenekte toplam aynı, "Ödenecek"te 0.
      for (const q of ["&preset=late", "&preset=open", "&preset=today", "&preset=next30", "&direction=in", "&sources=plan", `&q=${encodeURIComponent(acc.name)}`]) {
        const rows2 = (await must("Vade Takip süzgeç", api.get(`/api/workspace/overview/vade-takip?${q.slice(1)}`))).rows.filter(r => r.party === acc.name || r.accountId === acc.id);
        assert.equal(lateSum(rows2), late, `${acc.name}: Vade Takip ${q}`);
      }
      assert.equal(lateSum((await must("Vade Takip Ödenecek", api.get("/api/workspace/overview/vade-takip?preset=open&direction=out"))).rows.filter(r => r.party === acc.name)), 0, `${acc.name}: Ödenecek süzgecinde yok`);
      assert.equal((await must("Vade Takip Fatura", api.get("/api/workspace/overview/vade-takip?preset=open&sources=invoice"))).rows.filter(r => r.party === acc.name).length, 0, `${acc.name}: yalnız fatura kaynağında yok`);
      const z = await dues(acc);
      assert.equal(Math.round(z.filter(r => r.state === "overdue").reduce((s, r) => s + r.amount, 0) * 100) / 100, late, `${acc.name}: zil gecikmiş = cari kartı`);
      const flow = await must("nakit akışı", api.get(`/api/workspace/overview/nakit-akisi?from=${day(-400)}&to=${day(400)}&overdue=1&table=0`));
      const mine = [...(flow.rows || []), ...(flow.overdue || [])].filter(r => r.ref?.id === p.id);
      assert.equal(Math.round(mine.reduce((s, r) => s + r.amount, 0) * 100) / 100, Math.round(rows.reduce((s, r) => s + r[2], 0) * 100) / 100, `${acc.name}: nakit akışında kartın bütün kalemleri`);
    }
  });

  // ---- M13 zil (yaşayan mutant N08) ----
  // ELLE (M13, S3): Yeni Borç kartı 900 (−40; 3 × 300: −30, −20, −10) · şüpheli kayıt 400 (−5) → S2 sırasıyla 1. taksit 300 + 2. taksitten 100 şüpheli kuyruğunda →
  // zil: 2. taksit 200, 3. taksit 300 (1. taksit yok); gecikmiş 500.
  it("M13: zilde şüpheli kuyruğundaki taksit payı düşer (gecikmiş = zil)", async () => {
    const acc = await account("Şüpheli Taksit");
    const p = await must("kart", api.post("/api/workspace/plans", { name: acc.name, registeredOn: day(-40), total: "900", accountId: acc.id, mode: "auto", count: "3", firstDue: day(-30), everyMonths: "0" }));
    if (p.items.map(i => i.dueDate).join() !== [day(-30), day(-30), day(-30)].join()) {
      // her ay yerine elle vade (Otomatik Dağıt aylıktır) — taksitler −30 / −20 / −10
      for (const [i, it2] of p.items.entries()) await must("vade", api.put(`/api/workspace/plans/${p.id}/items/${it2.id}`, { dueDate: day(-30 + i * 10), amount: "300", note: "" }));
    }
    await must("şüpheliye al", api.post(`/api/workspace/accounts/${acc.id}/doubtful`, { amount: "400", date: day(-5), reason: "lawsuit", note: "dava" }));
    const z = (await dues(acc)).map(r => [r.label, r.amount]).sort();
    assert.deepEqual(z, [["2. taksit", 200], ["3. taksit", 300]]);
    assert.equal((await card(acc)).totals.overdueDebt, 500);
  });
});
