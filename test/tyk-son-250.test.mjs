// 2.5.0 Ç5-B SON TUR — kullanıcı kararları S126 = A (11.11 11:16) ve S128 = A (11.11 13:29); iş listesi D AYNEN. Beklenenler karar metinlerinin KENDİ örneklerinden ELLE
// (programın çıktısından DEĞİL — ders 5, 40):
//   S126 = A: "Taksitler'den açılan kart carinin BÜTÜN açık borcuna eşitse ve içine fatura da girdiyse karta gelen ödeme kalemleri S122'deki kuralın aynısıyla, fatura DAHİL
//             kartın içine alma sırasıyla, ESKİDEN YENİYE düşürür. Örnek: fatura F 600 + elle borç X 300, kart 900; karta 300 ödeme ⇒ F açık 300, X Kalan 300 (bakiye, kart
//             kalanı, gecikmiş ve takvim değişmez)." İtirazsız okumalar: içindekilerin HEPSİ elle borçsa S122 (X 500 + Y 400, kart 900, ödeme 300 ⇒ X Kalan 200, Y 400);
//             içinde YALNIZ faturalar varsa da eskiden yeniye.
//   S128 = A: "… içine fatura / elle borç dışında bir kalem de girdiyse (stok veresiye satışı, karşılıksız kalemi, başka kartın ya da taksitli faturanın taksiti) karta gelen
//             ödeme kalemleri TÜRÜNE BAKILMADAN, kartın içine alma sırasıyla ESKİDEN YENİYE düşürür. Örnek: 01.03 stok veresiye satışı S 400 · 02.03 elle borç X 300 · 15.03
//             kart 700 · 10.04 karta 300 ödeme ⇒ S açığı 100, X Kalan 300 (bakiye 400, kart kalanı 400)."
//   S123 = S124 = S125 = C (BİLİNEN SINIR): kural YOK — bugünkü davranış sabitlenir (değişirse bilerek değişsin); "eskiden yeniye"de vade ↔ belge sırası ayrışırsa özel kural yok.
// "Karta gelen ödeme"nin iki yolu: kartın Taksit Tahsilatı ve karta pay düşen bağsız tahsilat (S50). Her örnekte bakiye, kart kalanı, gecikmiş ve takvim kalemleri karşı
// seçenekte (B) de AYNI kalmalı — kararın sözü; mutantlarla (test/tyk-mutasyon-250.mjs S126-* / S128-*) gösterilir: B yalnız "hangi kalem" sorusunu değiştirir.
// Saf kuyruk (buildObligations) + gerçek program (API). Sahte saat (ders 13). Taban kodda (c5b-son-taban) bu testler de YEŞİL: kararların sayısını tur 2b-2'nin kuyruğu zaten
// veriyordu (kartın içine alma sırası = vade → belge sırası; kapanan pay o sırayla düşülür) — bu dosya KORUMA testidir, dişi mutantlarla gösterilir (ders 7).
import assert from "node:assert/strict";
import { after, before, describe, it } from "node:test";
import { buildObligations } from "../server/lib/obligation-queue.mjs";
import { loginAdmin, startTestServer } from "./helpers.mjs";

let seq = 0;
const at = date => `${date}T09:00:${String((seq += 1) % 60).padStart(2, "0")}.${String(seq).padStart(3, "0")}Z`;
const sale = (id, date, amount, dueDate = date, extra = {}) => {
  const when = at(date);
  return { inv: { id, kind: "sale", status: "issued", payable: amount, dueDate, planId: "", issuedAt: when, ...extra }, line: { id: `l-${id}`, origin: "invoice", kind: "debt", sourceId: id, date, at: when, debit: amount, credit: 0 } };
};
const line = (id, origin, kind, date, debit, credit, extra = {}) => ({ id, origin, kind, date, at: at(date), debit, credit, ...extra });
const tahsilat = (id, date, amount) => line(id, "account", "in", date, 0, amount);
const borc = (id, date, amount) => line(id, "account", "debt", date, amount, 0);
const stokSatis = (id, date, amount) => line(id, "stock", "debt", date, amount, 0, { stockReason: "", sourceId: `m-${id}` });
const karsiliksiz = (id, date, amount) => line(id, "cheque", "debt", date, amount, 0);
const kart = (planId, date, total) => line(`plan:${planId}`, "plan", "plan", date, 0, 0, { planId, covers: true, coverTotal: total, coverGross: total });
const kartTahsilati = (id, planId, date, amount) => line(`plan-entry:${id}`, "plan", "plan-in", date, 0, amount, { planId });
const taksitler = (planId, total, count, first = "2026-04-01") => new Map([[planId, Array.from({ length: count }, (_, n) => ({ id: `${planId}${n + 1}`, seq: n + 1, dueDate: `2026-0${4 + n}-${first.slice(8)}`, amount: total / count }))]]);
const build = ({ docs = [], lines = [], ...rest }) => buildObligations({ lines: [...docs.map(d => d.line), ...lines], invoices: docs.map(d => d.inv), ...rest });
const r2 = value => Math.round(value * 100) / 100;
const sigma = r => r2(r.items.reduce((s, i) => s + (i.side === "receivable" ? i.remaining : -i.remaining), 0));
const balanceOf = (docs, lines) => r2([...docs.map(d => d.line), ...lines].reduce((s, l) => s + l.debit - l.credit, 0));
const kalan = (r, id) => r.entries.get(id)?.remaining;
const acik = (r, id) => r.invoices.get(id).open;
const inst = (r, planId) => [...r.installments.get(planId).values()].map(row => row.remaining);
const TODAY = "2026-04-15";
// Kararın "değişmez"leri: bakiye (Σ kalem), kart kalanı, gecikmiş, takvim kalemleri (taksitler).
const degismez = (r, planId) => ({ sigma: sigma(r), kart: r2(inst(r, planId).reduce((s, v) => s + v, 0)), taksit: inst(r, planId), gecikmis: r.overdue(TODAY).amount, kalemler: r.items.map(i => `${i.kind}:${i.vade}:${i.remaining}`) });

describe("Ç5-B son tur — S126 = A (açık borca eşit, içinde fatura da olan kart: ödeme fatura dahil eskiden yeniye)", () => {
  const F = () => [sale("F", "2026-03-01", 600)];
  const X = () => [borc("X", "2026-03-02", 300)];
  const K = () => kart("M", "2026-03-15", 900);
  const sched = taksitler("M", 900, 3);
  it("karar örneği: F 600 + X 300, kart 900; karta 300 ödeme (Taksit Tahsilatı) ⇒ F açık 300, X Kalan 300; bakiye 600, kart kalanı 600", () => {
    const docs = F();
    const base = [...X(), K()];
    const once = build({ docs, lines: base, schedules: sched, today: TODAY });
    assert.deepEqual([acik(once, "F"), kalan(once, "X"), sigma(once), inst(once, "M")], [600, 300, 900, [300, 300, 300]], "ödemeden önce: kart bütün borcu taşır");
    assert.equal(once.coverage.get("M").rule, "s2", "açık borç = kart tutarı: S110 / S120 seçimi yok");
    const lines = [...base, kartTahsilati("e1", "M", "2026-04-10", 300)];
    const r = build({ docs, lines, schedules: sched, today: TODAY });
    assert.deepEqual([acik(r, "F"), kalan(r, "X")], [300, 300], "F açık 300, X Kalan 300 (B olsaydı: X 0, F 600)");
    assert.deepEqual([sigma(r), balanceOf(docs, lines), inst(r, "M"), r.overdue(TODAY).amount], [600, 600, [0, 300, 300], 0]);
    assert.equal(r.invoices.get("F").state, "overdue", "F kısmen ödendi, vadesi geçmiş (fatura durumu)");
  });
  it("karta pay düşen BAĞSIZ tahsilat (kart seçilmeden; S50) da aynı sırayla: tahsilat 500 ⇒ F açık 100, X Kalan 300 (kâhin d37 L8 ile aynı sayılar)", () => {
    const docs = F();
    const lines = [...X(), K(), tahsilat("T", "2026-04-10", 500)];
    const r = build({ docs, lines, schedules: sched, today: TODAY });
    assert.deepEqual([acik(r, "F"), kalan(r, "X"), inst(r, "M"), sigma(r)], [100, 300, [0, 100, 300], 400]);
  });
  it("iki ödeme üst üste (300 + 400) ⇒ F 0, X Kalan 200; kartı tamamen kapatan ödeme ⇒ F Ödendi, X Kalan 0, kalem yok", () => {
    const docs = F();
    const two = [...X(), K(), kartTahsilati("e1", "M", "2026-04-05", 300), kartTahsilati("e2", "M", "2026-04-10", 400)];
    const r = build({ docs, lines: two, schedules: sched, today: TODAY });
    assert.deepEqual([acik(r, "F"), kalan(r, "X"), inst(r, "M"), sigma(r)], [0, 200, [0, 0, 200], 200]);
    const full = build({ docs, lines: [...two, tahsilat("T", "2026-04-12", 200)], schedules: sched, today: TODAY });
    assert.deepEqual([acik(full, "F"), full.invoices.get("F").state, kalan(full, "X"), full.items.length, sigma(full)], [0, "paid", 0, 0, 0]);
  });
  it("ödemenin silinmesi / geri yüklenmesi: ödemesiz hâl = silinmiş hâl; geri yüklenince yine F açık 300, X Kalan 300 (yazım sırası sonucu değiştirmez)", () => {
    const docs = F();
    const base = [...X(), K()];
    const pay = kartTahsilati("e1", "M", "2026-04-10", 300);
    const once = build({ docs, lines: base, schedules: sched, today: TODAY });
    const paid = build({ docs, lines: [...base, pay], schedules: sched, today: TODAY });
    const deleted = build({ docs, lines: base, schedules: sched, today: TODAY });
    const restored = build({ docs, lines: [pay, ...base], schedules: sched, today: TODAY });
    assert.deepEqual(degismez(deleted, "M"), degismez(once, "M"));
    assert.deepEqual([acik(restored, "F"), kalan(restored, "X"), degismez(restored, "M")], [300, 300, degismez(paid, "M")]);
  });
  it("elle borç faturadan ESKİ: X 300 (25.02) + F 600 (01.03), kart 900, karta 300 ⇒ X Kalan 0, F açık 600 (eskiden yeniye: önce X)", () => {
    const docs = F();
    const r = build({ docs, lines: [borc("X", "2026-02-25", 300), K(), kartTahsilati("e1", "M", "2026-04-10", 300)], schedules: sched, today: TODAY });
    assert.deepEqual([kalan(r, "X"), acik(r, "F"), sigma(r)], [0, 600, 600]);
  });
  it("itirazsız okuma (kâhin Y10-3): içindekilerin HEPSİ elle borç — X 500 + Y 400, kart 900, ödeme 300 ⇒ X Kalan 200, Y Kalan 400", () => {
    const r = build({ lines: [borc("X", "2026-03-01", 500), borc("Y", "2026-03-03", 400), K(), kartTahsilati("e1", "M", "2026-04-10", 300)], schedules: sched, today: TODAY });
    assert.deepEqual([kalan(r, "X"), kalan(r, "Y"), sigma(r)], [200, 400, 600]);
  });
  it("itirazsız okuma (kâhin Y11-7): içinde YALNIZ faturalar — F1 400 (01.03) + F2 500 (05.03), kart 900, ödeme 300 ⇒ F1 açık 100, F2 açık 500", () => {
    const docs = [sale("F1", "2026-03-01", 400), sale("F2", "2026-03-05", 500)];
    const r = build({ docs, lines: [K(), kartTahsilati("e1", "M", "2026-04-10", 300)], schedules: sched, today: TODAY });
    assert.deepEqual([acik(r, "F1"), acik(r, "F2"), sigma(r)], [100, 500, 600]);
  });
  it("değişmezler ödemenin her tutarında (1 … 900): Σ fatura açığı + Σ elle Kalan = bakiye = kart kalanı; kalemler yalnız taksitler", () => {
    for (const amount of [1, 299.99, 300, 300.01, 600, 600.01, 899.99, 900]) {
      const docs = F();
      const lines = [...X(), K(), kartTahsilati("e1", "M", "2026-04-10", amount)];
      const r = build({ docs, lines, schedules: sched, today: TODAY });
      const left = r2(900 - amount);
      assert.deepEqual([r2(acik(r, "F") + kalan(r, "X")), sigma(r), r2(inst(r, "M").reduce((s, v) => s + v, 0))], [left, left, left], `ödeme ${amount}`);
      assert.deepEqual([acik(r, "F"), kalan(r, "X")], [r2(Math.max(0, 600 - amount)), r2(300 - Math.max(0, amount - 600))], `ödeme ${amount}: önce F, sonra X`);
      assert.ok(r.items.every(i => i.kind === "installment"), "kuyrukta yalnız taksitler (alttaki borç kartın içinde)");
    }
  });
});

describe("Ç5-B son tur — BİLİNEN SINIRLAR (S123 = S124 = S125 = C: kural YOK; bugünkü davranış sabitlenir, değişmezler korunur)", () => {
  const two = (planId, total) => new Map([[planId, [{ id: `${planId}1`, seq: 1, dueDate: "2026-04-05", amount: total / 2 }, { id: `${planId}2`, seq: 2, dueDate: "2026-05-05", amount: total / 2 }]]]);
  const check = (r, docs, lines) => {
    assert.equal(sigma(r), balanceOf(docs, lines), "Σ kalem = bakiye");
    const late = r.overdue(TODAY).amount;
    assert.ok(late >= 0 && late <= sigma(r) + 0.005, `gecikmiş ${late}`);
  };
  it("S123 (açık elle borçlar kart tutarından az: F 600 + X 300, kart 500): bugün kartta X 300 + F'nin 200'ü; karta 250 ⇒ X Kalan 50, F açık 600", () => {
    const docs = [sale("F", "2026-02-20", 600)];
    const lines = [borc("X", "2026-03-01", 300), kart("M", "2026-03-10", 500), kartTahsilati("e1", "M", "2026-04-10", 250)];
    const r = build({ docs, lines, schedules: two("M", 500), today: TODAY });
    check(r, docs, lines);
    assert.deepEqual([kalan(r, "X"), acik(r, "F"), r.invoiceNet.get("F").remaining, r.coverage.get("M").rule], [50, 600, 400, "S120"], "BİLİNEN SINIR — bugünkü sayılar (kural değil)");
  });
  it("S124 (karta eşit birden çok elle borç + daha eski elle borç: Z 300 + X 900 + Y 900, kart 900): bugün kartta Z 300 + X'in 600'ü; karta 400 ⇒ Z 0, X Kalan 800", () => {
    const docs = [sale("F", "2026-02-15", 600)];
    const lines = [borc("Z", "2026-02-20", 300), borc("X", "2026-02-22", 900), borc("Y", "2026-02-25", 900), kart("M", "2026-03-10", 900), kartTahsilati("e1", "M", "2026-04-10", 400)];
    const r = build({ docs, lines, schedules: two("M", 900), today: TODAY });
    check(r, docs, lines);
    assert.deepEqual([kalan(r, "Z"), kalan(r, "X"), kalan(r, "Y"), acik(r, "F")], [0, 800, 900, 600], "BİLİNEN SINIR — bugünkü sayılar (kural değil)");
  });
  it("S125 (belge sırası ↔ vade sırası ters; S120 kolu: X 02.03 vade 30.03, Y 05.03 vade 10.03, F 600, kart 900): bugün vade sırası — kartta Y 700 + X'in 200'ü; karta 300 ⇒ Y Kalan 400, X 500", () => {
    const docs = [sale("F", "2026-03-04", 600)];
    const lines = [borc("X", "2026-03-02", 500), borc("Y", "2026-03-05", 700), kart("M", "2026-03-10", 900), kartTahsilati("e1", "M", "2026-04-10", 300)];
    const r = build({ docs, lines, schedules: two("M", 900), dueDates: new Map([["X", "2026-03-30"], ["Y", "2026-03-10"]]), today: TODAY });
    check(r, docs, lines);
    assert.deepEqual([kalan(r, "Y"), kalan(r, "X"), acik(r, "F")], [400, 500, 600], "BİLİNEN SINIR — bugünkü sayılar (kural değil)");
  });
  it("S125 × S126 (açık borca eşit kartta vade ↔ belge sırası ters: X 02.03 vade 30.03 · F 04.03 vadesiz, kart 900, karta 300): bugün vade sırası — F açık 300, X Kalan 300 (kâhin d37 L13: susar)", () => {
    const docs = [sale("F", "2026-03-04", 600)];
    const lines = [borc("X", "2026-03-02", 300), kart("M", "2026-03-10", 900), kartTahsilati("e1", "M", "2026-04-10", 300)];
    const r = build({ docs, lines, schedules: new Map([["M", [1, 2, 3].map(n => ({ id: `M${n}`, seq: n, dueDate: `2026-0${4 + n}-20`, amount: 300 }))]]), dueDates: new Map([["X", "2026-03-30"]]), today: TODAY });
    check(r, docs, lines);
    assert.deepEqual([acik(r, "F"), kalan(r, "X")], [300, 300], "BİLİNEN SINIR — bugünkü sayılar (belge sırası okuması X 0, F 600 verirdi)");
  });
});

// ---------------- Gerçek program (API) ----------------
const NOW = "2026-10-20T12:00:00+03:00";
const NOW_DAY = "2026-10-20";
const day = offset => {
  const d = new Date(`${NOW_DAY}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + offset);
  return d.toISOString().slice(0, 10);
};
const unwrap = response => ({ ...response, data: response.data && typeof response.data === "object" && "ok" in response.data ? (response.data.ok ? response.data.data : response.data) : response.data });
describe("Ç5-B son tur — gerçek program: S126 / S128 örnekleri ekranların okuduğu uçlardan (cari kartı, fatura kartı, taksit kartı, Vade Takip, zil)", () => {
  let server;
  let api;
  let n = 0;
  let item;
  let goods;
  const must = async (label, promise) => {
    const res = await promise;
    assert.equal(res.status, 200, `${label}: ${res.status} ${JSON.stringify(res.data).slice(0, 300)}`);
    return res.data;
  };
  const account = label => must(`cari ${label}`, api.post("/api/workspace/accounts", { name: `Son Tur ${label}`, type: "customer", registeredOn: day(-400), phone: `0500 256 ${String(10 + Math.floor((n += 1) / 100)).padStart(2, "0")} ${String(n % 100).padStart(2, "0")}` }));
  const entry = async (acc, body) => {
    const before = new Set((await must("cari kartı", api.get(`/api/workspace/accounts/${acc.id}`))).entries.map(row => row.id));
    const result = await must(`hareket ${body.kind}`, api.post(`/api/workspace/accounts/${acc.id}/entries`, { method: "cash", cashForce: true, similarOk: true, ...body }));
    return result.entries.find(row => !before.has(row.id));
  };
  const sale = async (acc, date, amount) => (await must("fatura", api.post("/api/workspace/invoices", { scenario: "service_sale", accountId: acc.id, issueDate: date, lines: [{ itemId: item.id, qty: 1, unitPrice: String(amount), vatRate: 0 }], payment: { rest: "open", dueDate: date }, cashForce: true }))).id;
  const cardOpen = (acc, total, count) => must("kart", api.post("/api/workspace/plans", { name: acc.name, registeredOn: day(-40), total: String(total), accountId: acc.id, mode: "auto", count: String(count), firstDue: day(-10), coversBalance: true }));
  const cardPay = (planId, amount, date = day(-5)) => must("kart tahsilatı", api.post(`/api/workspace/plans/${planId}/entries`, { kind: "in", amount: String(amount), date, method: "cash", cashForce: true, similarOk: true }));
  // Ekranların okuduğu sayılar: bakiye, kartın kendi / kuyruk kalanı, taksit kalanları, gecikmiş (cari kartı = liste), Vade Takip ve zil kalemleri, elle Kalan'lar, fatura açığı.
  const views = async (acc, planId, invoices = []) => {
    const card = await must("cari kartı", api.get(`/api/workspace/accounts/${acc.id}`));
    const plan = await must("taksit kartı", api.get(`/api/workspace/plans/${planId}`));
    const list = (await must("cari listesi", api.get("/api/workspace/accounts?status=all&limit=5000"))).accounts.find(row => row.id === acc.id);
    const vade = (await must("Vade Takip", api.get(`/api/workspace/overview/vade-takip?from=${day(-800)}&to=${day(800)}`))).rows.filter(r => r.accountId === acc.id || r.party === acc.name);
    const zil = (await must("zil", api.get("/api/workspace/dues"))).items.filter(r => r.accountId === acc.id);
    const open = [];
    for (const id of invoices) open.push((await must("fatura kartı", api.get(`/api/workspace/invoices/${id}`))).open);
    return {
      bakiye: card.totals.balance, kartKendi: plan.totals.remaining, kartKuyruk: plan.totals.queueRemaining, taksit: plan.items.map(i => i.remaining),
      gecikmis: card.totals.overdueDebt, gecikmisListe: list.overdue, vadeGecikmis: r2(vade.filter(r => r.date < NOW_DAY && r.direction === "in").reduce((s, r) => s + r.amount, 0)),
      vade: vade.map(r => `${r.source}:${r.amount}@${r.date}`).sort(), zil: zil.map(r => `${r.source}:${r.amount}:${r.state}`).sort(),
      kalan: Object.fromEntries(card.entries.filter(e => e.remaining !== undefined).map(e => [e.note, e.remaining])), acik: open,
    };
  };
  before(async () => {
    server = await startTestServer({ now: { time: NOW, fixed: false }, env: { HUKUK_LICENSE_URL: "http://127.0.0.1:9" } });
    const client = await loginAdmin(server);
    api = { get: async url => unwrap(await client.get(url)), post: async (url, body) => unwrap(await client.post(url, body)), del: async url => unwrap(await client.del(url)) };
    await api.post("/api/workspace/bank/setup/dismiss", {});
    item = await must("hizmet", api.post("/api/workspace/stock", { kind: "service", code: "HZM-SON", name: "Hizmet", unit: "Adet", salePrice: "1000" }));
    goods = await must("mal", api.post("/api/workspace/stock", { kind: "goods", code: "MAL-SON", name: "Son Tur Malı", unit: "Adet", openingQty: "1000", salePrice: "100" }));
  });
  after(async () => server?.close());
  it("S126 = A: F 600 + X 300, kart 900 (3 × 300) — Taksit Tahsilatı 300 ⇒ F açık 300, X Kalan 300; sonra bağsız tahsilat 400 ⇒ F 0, X Kalan 200; silinince geri döner", async () => {
    const acc = await account("S126");
    const f = await sale(acc, day(-50), 600);
    await entry(acc, { kind: "debt", amount: "300", date: day(-49), note: "X" });
    const plan = await cardOpen(acc, 900, 3);
    const once = await views(acc, plan.id, [f]);
    assert.deepEqual([once.bakiye, once.kartKendi, once.kartKuyruk, once.taksit, once.kalan, once.acik], [900, 900, 900, [300, 300, 300], { X: 300 }, [600]], "ödemeden önce");
    assert.deepEqual([once.gecikmis, once.gecikmisListe, once.vadeGecikmis, once.zil], [300, 300, 300, ["plan:300:overdue"]], "gecikmiş = 1. taksit (her ekranda aynı)");
    await cardPay(plan.id, 300);
    const paid = await views(acc, plan.id, [f]);
    assert.deepEqual([paid.acik, paid.kalan], [[300], { X: 300 }], "F açık 300, X Kalan 300");
    assert.deepEqual([paid.bakiye, paid.kartKendi, paid.kartKuyruk, paid.taksit, paid.gecikmis, paid.gecikmisListe, paid.vadeGecikmis, paid.zil], [600, 600, 600, [0, 300, 300], 0, 0, 0, []], "bakiye / kart kalanı / gecikmiş / takvim: yalnız ödenen taksit kadar düştü");
    const free = await entry(acc, { kind: "in", amount: "400", date: day(-4), note: "T400" });
    const two = await views(acc, plan.id, [f]);
    assert.deepEqual([two.acik, two.kalan, two.bakiye, two.kartKuyruk, two.taksit], [[0], { X: 200 }, 200, 200, [0, 0, 200]], "bağsız tahsilat (S50 payı) da eskiden yeniye: F kapandı, X Kalan 200");
    await must("tahsilatı sil", api.del(`/api/workspace/accounts/${acc.id}/entries/${free.id}?cashForce=1`));
    assert.deepEqual(await views(acc, plan.id, [f]), paid, "bağsız tahsilat silinince bir önceki hâl (bütün ekranlar)");
  });
});
