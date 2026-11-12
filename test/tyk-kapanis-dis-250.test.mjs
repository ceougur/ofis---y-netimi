// 2.5.0 Ç5-B KAPANIŞ DÜZELTME TURU — DÜŞÜK-2: kapanış dar kontrolünde YAŞAYAN mutantların dişleri (K3, K8, K22, K28, K35; K1'in eşdeğerlik araması
// test/tyk-mutasyon-250.mjs'teki notta). Beklenenler kullanıcı kararlarının metninden ve örneklerinden ELLE — programın çıktısından DEĞİL (ders 5, 40):
//   K3  — S101 = A + karar (e) 11.11 03:15: "kısmen avansla kapanmış borçta kartın o kadarı ödenmiş sayılır (önceki kartların saydığı kısım düşülür); kalanı (para dışı
//         kapanış — iade, Alacak …) son taksitlerden kırpılır" → aynı para iki kartta "avansla ödenmiş" sayılamaz.
//   K8  — S135 = C (BİLİNEN SINIR, 12.11 18:21): S126'nın koşulunda başka taksitli faturanın açık taksitleri bugünkü gibi "bütün açık borca" sayılır (karar2 Ç2 sayıları sabit).
//   K22 — S110 / S120 = A: "Excel / Tablodan Aktar kartı kararların dışında (eski kural)" — kart ekranı (tek cari yolu) ile liste (bütün cariler yolu) aynı kartı aynı tanır.
//   K28 — S96 = A + S93 (10.11 13:20): "verilen, karşılığı gelmemiş avans takvim / zil / Vade Takip'te AYRI KALEM (ödeme gününde vadeli)"; banka kaynaklı (POS komisyon
//         tahsili) verilen avans da kalemdir.
//   K35 — S105 = A: gelen alacak yönlü yükümlülük kalemi önce açık ALIŞ İADESİ alacağını (stoktan Alış İadesi VE faturalı Alış İadesi) kapatır.
import assert from "node:assert/strict";
import { after, before, describe, it } from "node:test";
import { buildObligations } from "../server/lib/obligation-queue.mjs";
import { TODAY as POS_TODAY, bootBank, must as posMust, openAcceptanceAccounts, openPos, salesOf, settle, ziraatPos } from "./banka-220-pos-ortak.mjs";
import { loginAdmin, startTestServer } from "./helpers.mjs";

let seq = 0;
const at = date => `${date}T09:00:${String((seq += 1) % 60).padStart(2, "0")}.${String(seq).padStart(3, "0")}Z`;
const line = (id, origin, kind, date, debit, credit, extra = {}) => ({ id, origin, kind, date, at: at(date), debit, credit, ...extra });
const borc = (id, date, amount) => line(id, "account", "debt", date, amount, 0);
const alacak = (id, date, amount) => line(id, "account", "credit", date, 0, amount);
const tahsilat = (id, date, amount) => line(id, "account", "in", date, 0, amount);
const odeme = (id, date, amount) => line(id, "account", "out", date, amount, 0);
const kart = (planId, date, total, extra = {}) => line(`plan:${planId}`, "plan", "plan", date, 0, 0, { planId, covers: true, coverTotal: total, coverGross: total, ...extra });
const two = (planId, a, b = a) => [planId, [{ id: `${planId}1`, seq: 1, dueDate: "2026-04-10", amount: a }, { id: `${planId}2`, seq: 2, dueDate: "2026-05-10", amount: b }]];
const doc = (id, kind, date, amount, side) => {
  const when = at(date);
  return { inv: { id, kind, status: "issued", payable: amount, dueDate: "", planId: "", issuedAt: when }, line: { id: `l-${id}`, origin: "invoice", kind: side, sourceId: id, date, at: when, debit: side === "debt" ? amount : 0, credit: side === "credit" ? amount : 0 } };
};
const r2 = value => Math.round(value * 100) / 100;
const left = (r, lineId) => r.items.find(item => item.lineId === lineId)?.remaining ?? 0;
const sigma = r => r2(r.items.reduce((sum, item) => sum + (item.side === "receivable" ? item.remaining : -item.remaining), 0));
const balanceOf = lines => r2(lines.reduce((sum, l) => sum + l.debit - l.credit, 0));
const inst = (r, planId) => [...r.installments.get(planId).values()];

describe("Ç5-B kapanış — DÜŞÜK-2 saf kuyruk dişleri", () => {
  it("K3 dişi — S101: aynı para iki kartta 'avansla ödenmiş' sayılmaz (önceki kartın saydığı kısım düşülür); para dışı kapanan kısım kırpılır", () => {
    // X 1.000 → tahsilat 400 (X'i kapatır) → kart C1 1.000 (X'in açık 600'ünü taşır; 400'ü avansla ödenmiş). Y 300 → Alacak 200 (netleşme — para DEĞİL) → tahsilat 100 (Y'yi kapatır)
    // → kart C2 300: taşıyacak açık borç yok; taşıdığı borcun PARAYLA kapanmış kısmı yalnız Y'nin 100'ü (X'in 400'ünü C1 saydı) ⇒ C2'nin 100'ü ödenmiş, 200'ü kırpılır.
    const lines = [borc("X", "2026-03-01", 1000), tahsilat("P1", "2026-03-02", 400), kart("C1", "2026-03-05", 1000), borc("Y", "2026-03-10", 300), alacak("A", "2026-03-12", 200), tahsilat("P2", "2026-03-15", 100), kart("C2", "2026-03-20", 300)];
    const r = buildObligations({ lines, schedules: new Map([two("C1", 500), two("C2", 150)]), today: "2026-04-20" });
    assert.deepEqual([r.coverage.get("C1").advance, r.coverage.get("C1").trimmed], [400, 0], "C1: X'in tahsilatla kapanmış 400'ü avansla ödenmiş");
    assert.deepEqual([r.coverage.get("C2").advance, r.coverage.get("C2").trimmed], [100, 200], "C2: yalnız Y'nin PARAYLA kapanan 100'ü ödenmiş (X'in 400'ü C1'de sayıldı); Alacak'la kapanan 200 kırpılır");
    assert.equal(r2(inst(r, "C2").reduce((sum, row) => sum + row.collected, 0)), 100, "C2'nin 'Tahsil Edilen'i 100 (300 DEĞİL)");
    assert.deepEqual(inst(r, "C2").map(row => row.remaining), [0, 0]);
    assert.deepEqual(inst(r, "C1").map(row => row.remaining), [100, 500], "C1: 400 avansla ödenmiş → kalan 600");
    assert.equal(sigma(r), balanceOf(lines));
    assert.equal(sigma(r), 600);
  });

  it("K35 dişi — S105: tedarikçi — 01.03 Ödeme 300 · 05.03 FATURALI Alış İadesi 200 · 10.03 alış 250 ⇒ alış önce iade alacağını kapatır: iade 0, avans 250", () => {
    const docs = [doc("PR", "purchase_return", "2026-03-05", 200, "debt"), doc("A", "purchase", "2026-03-10", 250, "credit")];
    const lines = [odeme("O", "2026-03-01", 300), ...docs.map(d => d.line)];
    const r = buildObligations({ lines, invoices: docs.map(d => d.inv), today: "2026-03-20" });
    assert.deepEqual([left(r, "l-PR"), left(r, "O")], [0, 250], "faturalı Alış İadesi stoktan Alış İadesi gibi önceliklidir (vade sırası olsaydı: avans 50, iade 200)");
    assert.equal(sigma(r), balanceOf(lines));
  });
});

const TODAY = "2026-10-20";
const NOW = `${TODAY}T12:00:00+03:00`;
const day = offset => {
  const d = new Date(`${TODAY}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + offset);
  return d.toISOString().slice(0, 10);
};
const unwrap = response => ({ ...response, data: response.data && typeof response.data === "object" && "ok" in response.data ? (response.data.ok ? response.data.data : response.data) : response.data });

describe("Ç5-B kapanış — DÜŞÜK-2 gerçek program dişleri (K8, K22)", () => {
  let server;
  let api;
  let item;
  let store;
  let ctx;
  let n = 0;
  const must = async (label, promise) => {
    const res = unwrap(await promise);
    assert.equal(res.status, 200, `${label}: ${res.status} ${JSON.stringify(res.data).slice(0, 300)}`);
    return res.data;
  };
  const account = label => must(`cari ${label}`, api.post("/api/workspace/accounts", { name: `Diş ${label}`, type: "customer", registeredOn: day(-400), phone: `0500 258 10 ${String((n += 1)).padStart(2, "0")}` }));
  const sale = (acc, date, amount, payment) => must("fatura", api.post("/api/workspace/invoices", { scenario: "service_sale", accountId: acc.id, issueDate: date, lines: [{ itemId: item.id, qty: 1, unitPrice: String(amount), vatRate: 0 }], payment: payment || { rest: "open", dueDate: date }, cashForce: true, force: true }));
  const entry = (acc, body) => must(`hareket ${body.kind}`, api.post(`/api/workspace/accounts/${acc.id}/entries`, { method: "cash", cashForce: true, similarOk: true, ...body }));
  const card = acc => must("cari kartı", api.get(`/api/workspace/accounts/${acc.id}`));
  before(async () => {
    // Akan saat (ders 14): her kayıt anı farklı.
    let at = Date.parse(NOW);
    server = await startTestServer({ now: () => (at += 7), env: { HUKUK_LICENSE_URL: "http://127.0.0.1:9" } });
    const client = await loginAdmin(server);
    api = { get: url => client.get(url), post: (url, body) => client.post(url, body), put: (url, body) => client.put(url, body) };
    await api.post("/api/workspace/bank/setup/dismiss", {});
    store = server.app.store;
    ctx = server.app.context;
    item = await must("hizmet", api.post("/api/workspace/stock", { kind: "service", code: "HZM-DIS", name: "Hizmet", unit: "Adet", salePrice: "1000" }));
  });
  after(async () => {
    await server?.close();
  });

  it("K8 dişi — S135 = C: F 600 + elle X 300 + ayrıca TAKSİTLİ fatura B 300; Mevcut Borç kartı 900; karta 300 ⇒ başka kartın açık taksitleri 'bütün açık borca' sayılır: X Kalan 0, F açık 600", async () => {
    const a = await account("K8");
    const f = await sale(a, day(-50), 600);
    await entry(a, { kind: "debt", amount: "300", date: day(-49), note: "X" });
    const b = await sale(a, day(-45), 300, { cash: [], cheques: [], endorse: [], rest: "installments", installments: { count: 2, firstDue: day(20), everyMonths: 1 } });
    const plan = await must("kart", api.post("/api/workspace/plans", { name: a.name, registeredOn: day(-40), total: "900", accountId: a.id, mode: "auto", count: "3", firstDue: day(-10), everyMonths: "1", coversBalance: true }));
    await must("kart tahsilatı", api.post(`/api/workspace/plans/${plan.id}/entries`, { kind: "in", amount: "300", date: day(-5), method: "cash", cashForce: true, similarOk: true }));
    const view = await card(a);
    const x = view.entries.find(row => row.note === "X");
    assert.equal(view.totals.balance, 900);
    assert.equal(x.remaining, 0, "elle borç X kartın içinde (Kalan 0)");
    assert.equal((await must("fatura", api.get(`/api/workspace/invoices/${f.id}`))).open, 600, "F açık 600 (S126 okuması olsaydı: F 300, X 300)");
    assert.equal((await must("fatura B", api.get(`/api/workspace/invoices/${b.id}`))).open, 300, "taksitli fatura kendi kartında");
    assert.deepEqual((await must("taksit kartı", api.get(`/api/workspace/plans/${plan.id}`))).items.map(row => row.remaining), [0, 300, 300]);
  });

  it("K22 dişi — Tablodan Aktar'ın açtığı Mevcut Borç kartı (aktarım kimlikli) kararların dışında: kart ekranı (tek cari yolu) = liste (bütün cariler yolu) — eski kural (vade sırası)", async () => {
    // F 600 (vadesi geçmiş) + elle X 900 (vadesi ileride). Aktarım kartı 900: eski kural vade sırasıyla F 600 + X'in 300'ünü taşır ⇒ kart dışında yalnız X'in 600'ü (vadesi ileride):
    // Gecikmiş Borç 0. Kart elle kart gibi tanınsaydı (S110: tutarı karta eşit TEK elle borç X) F 600 kart dışında gecikmiş kalırdı.
    const a = await account("K22");
    await sale(a, day(-44), 600); // F; belge tarihi serinin son belgesinden (K8: −45) sonra
    await entry(a, { kind: "debt", amount: "900", date: day(-43), dueDate: day(30), note: "X" });
    const admin = store.get("SELECT id, username, role FROM users WHERE username = 'admin'");
    // Tablodan Aktar'ın "Carinin Mevcut Borcu" kararında çağırdığı servis (routes/plan-transfer.mjs → plans.createScheduled; aktarım kimliği + coversBalance).
    const created = store.tx(() => ctx.plans.createScheduled({ id: admin.id, username: admin.username, role: admin.role, permissions: [] }, { name: a.name, accountId: a.id, registeredOn: day(-40), note: "", phone: "" }, { importId: "import-dis-k22", items: [{ dueDate: day(10), amount: 300 }, { dueDate: day(40), amount: 300 }, { dueDate: day(70), amount: 300 }], coversBalance: true }));
    assert.ok(store.get("SELECT import_id AS importId, covers_balance AS covers FROM plans WHERE id = ?", created.id).importId && store.get("SELECT covers_balance AS covers FROM plans WHERE id = ?", created.id).covers === 1, "ön koşul: aktarım kimlikli Mevcut Borç kartı");
    // Tek cari yolu ÖNCE (bütün cariler belleği bayat: az önce yazıldı) — cari kartı kendi kuyruğunu kurar.
    const single = await card(a);
    const list = (await must("liste", api.get("/api/workspace/accounts?status=all&limit=500"))).accounts.find(row => row.id === a.id);
    assert.equal(single.totals.balance, 1500);
    assert.equal(single.totals.overdueDebt, 0, "cari kartı (tek cari yolu): Gecikmiş Borç 0 — F kartın içinde, X'in kart dışındaki 600'ünün vadesi ileride (elle kart gibi tanınsaydı F 600 gecikmiş kalırdı)");
    assert.equal(list.overdue, 0, "Cari Listesi (bütün cariler yolu): aynı sayı");
    const vade = await must("Vade Takip", api.get(`/api/workspace/overview/vade-takip?from=${day(-800)}&to=${day(800)}`));
    assert.deepEqual(vade.rows.filter(row => (row.accountId === a.id || row.party === a.name) && row.direction === "in").map(row => `${row.source}:${row.amount}@${row.date}`).sort(), [`account:600@${day(30)}`, `plan:300@${day(10)}`, `plan:300@${day(40)}`, `plan:300@${day(70)}`], "Vade Takip: kartın üç taksiti + X'in kart dışındaki 600'ü (kendi vadesinde); F ayrı kalem değil");
    // Liste yolu belleği tazeledikten sonra da aynı.
    assert.equal((await card(a)).totals.overdueDebt, 0);
  });
});

describe("Ç5-B kapanış — DÜŞÜK-2 K28 dişi (S96 = A): bankadan POS Komisyon Tahsili ile verilen avans takvimde / zilde / Vade Takip'te AYRI KALEM", () => {
  it("ödeme kuruluşu POS'u (komisyon %2,5 + KDV): satış 10.000 → valörden ÖNCE tam iade → 12.10'da komisyon (250 + KDV 50) bankadan tahsil edilir: sağlayıcı carisine verilen 300, komisyon faturası gelene kadar 'Tahsil Edilecek' kalemidir", async () => {
    const w = await bootBank();
    try {
      const acc = await openAcceptanceAccounts(w.api);
      const abc = await posMust("ABC", w.api.post("/api/workspace/accounts", { name: "ABC Ltd.", type: "customer", registeredOn: "2026-10-01" }));
      const provider = await posMust("sağlayıcı", w.api.post("/api/workspace/accounts", { name: "Örnek Ödeme Kuruluşu A.Ş.", type: "supplier", registeredOn: "2026-10-01" }));
      await openPos(w.api, ziraatPos(acc.ziraat.id, { name: "Ödeme Kuruluşu Sanal POS", kind: "virtual", providerKind: "payment_institution", tax: "vat_excl", providerAccountId: provider.id }));
      await posMust("satış", w.api.post(`/api/workspace/accounts/${abc.id}/entries`, { kind: "in", method: "card", date: POS_TODAY, amount: "10.000" }));
      const sold = (await salesOf(w.api))[0];
      w.server.clock.set("2026-10-09T10:00:00+03:00");
      await posMust("tam iade", w.api.post(`/api/workspace/accounts/${abc.id}/entries`, { kind: "out", method: "card", posRefund: true, amount: "10.000", date: "2026-10-09", posRefundOf: sold.id }));
      w.server.clock.set("2026-10-12T10:00:00+03:00");
      await settle(w.api);
      const fee = w.store.get("SELECT account_id AS accountId, kind, method, amount, date FROM account_entries WHERE source = 'bank' AND method = 'bank'");
      assert.deepEqual([fee?.accountId, fee?.kind, fee?.amount, fee?.date], [provider.id, "out", 300, "2026-10-12"], "ön koşul: POS Komisyon Tahsili sağlayıcı carisine 300 (bankadan) yazıldı");
      const providerCard = await posMust("sağlayıcı carisi", w.api.get(`/api/workspace/accounts/${provider.id}`));
      const dues = await posMust("zil / takvim", w.api.get("/api/workspace/dues"));
      const mine = dues.items.filter(row => row.accountId === fee.accountId);
      assert.deepEqual(mine.map(row => [row.source, row.amount, row.dueDate, row.direction]), [["account", 300, "2026-10-12", "in"]], "takvimde / zilde ayrı kalem: 300, ödeme gününde vadeli");
      const vade = await posMust("Vade Takip", w.api.get("/api/workspace/overview/vade-takip?from=2026-01-01&to=2027-12-31"));
      assert.deepEqual(vade.rows.filter(row => row.accountId === provider.id || row.party === provider.name).map(row => [row.amount, row.date, row.direction]), [[300, "2026-10-12", "in"]], "Vade Takip'te aynı kalem");
      assert.equal(providerCard.totals.balance, 300, "sağlayıcı carisi 300 borçlu (verilen avans)");
    } finally {
      await w.server.close();
    }
  });
});
