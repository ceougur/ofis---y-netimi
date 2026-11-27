// 2.5.1 D3 TUR 2 — ön denetimin ve planın OLGULARI GERÇEK veri tabanından (okuyucunun SQL'i; tur 1 yalnız olgu düzeyinde sınamıştı — nasıl bozulur 14, 19, 22) ve DÖNEM KİLİDİ
// (tur 1 DOĞRULANMADI). Veri programın KENDİ API'sinden (e-Belge sahte EDM ile — ağa çıkmaz), beklenen sayılar ELLE. K = 31.12.2026.
//   e-Belge (sahte saat; GİB sıra kuralı yüzünden gönderilenler önce kesilir):
//     W4 e-Arşiv 30.12.2026 gönderildi, onaylandı (iletim 30.12) → 05.01.2027'de iptal süresi (8 gün) dolmadı (UYARIR 1); 10.02.2027'de dolmuş (0)
//     W3 e-Arşiv 31.12.2026, gönderim yanıtı kayboldu → programda "Sonucu Belirsiz" (e_status 'none' + entegratör izi) → sonucu belirsiz 1
//     W1 e-Arşiv "Kes, Sonra Gönder" 31.12.2026 → Gönderilecekler'de (Gönderilecek)
//     W6 e-Arşiv 31.12.2026, gönderim seçilmedi → Gönderilecekler'de (Gönderilmedi — numara almış) → bekleyen W1 + W6 = 2
//     W2 e-Arşiv "Kes, Sonra Gönder" 31.12.2026 → Listeden Sil (listeden silinen 1)
//     W5 "Kes, Sonra Gönder" 05.02.2027 (K'den SONRA) → sayılmaz
//     T1 taslak fatura 15.12.2026 → Taslak Fatura 1; T2 taslak 05.02.2027 → sayılmaz
//   Tekrarlayan fatura: R1 (10.12.2026 şablonu, etkin) → şablon listesinde; R2 (11.12.2026, Tekrarı Durdur) → YOK; R3 (06.02.2027 şablonu, etkin) → YOK (şablon K'den sonra).
//   Beklenen ön denetim (10.02.2027): DURDURUR e-belge-bekleyen 2, e-belge-listeden-silinen 1, e-belge-belirsiz 1, taslak-fatura 1; UYARIR tekrarlayan-sablon 1.
//   Dönem Kilidi (ayrı sunucu): kilit yok / K'den önce (30.06.2026) / K (31.12.2026) / K'yi aşan (15.01.2027) → plan (veri damgası hariç) bayt bayt AYNI; ön izleme kilidi ve kilit izini DEĞİŞTİRMEZ.
import assert from "node:assert/strict";
import { after, before, describe, it } from "node:test";
import { resetEdmCaches } from "../server/lib/einvoice/edm.mjs";
import { OUR_VKN, startMockEdm } from "./einvoice-mock.mjs";
import { apiOf, boot, must } from "./banka-210-ortak.mjs";
import { loginAdmin, startTestServer } from "./helpers.mjs";

const planModule = await import("../server/lib/devir/plan.mjs").catch(() => null);
const K = "2026-12-31";
const SELLER = { name: "Deneme Ofis Ltd.", taxNo: OUR_VKN, taxOffice: "Çankaya", address: "Atatürk Blv. 1", district: "Çankaya", city: "Ankara", email: "bilgi@deneme.com.tr" };
const PERSON = { name: "Ayşe Demir", type: "customer", partyKind: "person", firstName: "Ayşe", familyName: "Demir", taxNo: "10000000078", city: "İzmir", address: "Karşıyaka 9", district: "Karşıyaka", email: "ayse@example.com" };

async function waitPreview(api, body) {
  const started = await must("ön izleme", api.post("/api/admin/devir/preview", body));
  for (let i = 0; i < 600; i += 1) {
    const job = await must("ön izleme durumu", api.get(`/api/admin/devir/preview/${started.id}`));
    if (job.state !== "running") return job;
    await new Promise(resolve => setTimeout(resolve, 50));
  }
  throw new Error("ön izleme bitmedi");
}

describe("D3 tur 2 — e-Belge, taslak ve tekrarlayan fatura olguları gerçek veri tabanından", () => {
  let edm;
  let server;
  let api;
  let loseSend = false;
  const ids = {};
  const status = {};
  const fetchImpl = async (input, init) => {
    const url = String(typeof input === "string" || input instanceof URL ? input : input.url);
    if (!url.startsWith("http://127.0.0.1")) throw new Error(`ağa çıkılmaz (test): ${url}`);
    const response = await globalThis.fetch(input, init);
    if (loseSend && /SendInvoiceRequest/.test(String(init?.body || ""))) {
      loseSend = false;
      await response.text();
      throw Object.assign(new TypeError("fetch failed"), { cause: Object.assign(new Error("socket hang up"), { code: "ECONNRESET" }) });
    }
    return response;
  };
  const eStatusOf = id => server.app.store.get("SELECT status, e_status AS e FROM invoices WHERE id = ?", id);
  before(async () => {
    resetEdmCaches();
    edm = await startMockEdm();
    server = await startTestServer({ edocEnabled: true, fetchImpl, now: { time: "2026-12-10T10:00:00+03:00", fixed: true } });
    api = apiOf(await loginAdmin(server));
    await must("ayarlar", api.put("/api/workspace/invoices/settings", { seller: SELLER, efatura: true, earsiv: true, integrator: { env: "test", baseUrl: edm.url, username: "edmkullanici", password: "Gizli-Parola-1", senderAlias: "urn:mail:defaultgb@deneme.com.tr" } }));
    ids.p = (await must("kişi", api.post("/api/workspace/accounts", PERSON))).id;
    const sale = (label, issueDate, extra = {}) => must(label, api.post("/api/workspace/invoices", { scenario: "service_sale", accountId: ids.p, issueDate, lines: [{ name: "Danışmanlık", qty: 1, unitPrice: 1000, vatRate: 20 }], payment: { rest: "open" }, ...extra }));
    ids.r1 = (await sale("R1", "2026-12-10", { eSend: "later" })).id;
    await must("R1 gönder", api.post(`/api/workspace/invoices/${ids.r1}/send`, {}));
    server.clock.set("2026-12-11T10:00:00+03:00");
    ids.r2 = (await sale("R2", "2026-12-11", { eSend: "later" })).id;
    await must("R2 gönder", api.post(`/api/workspace/invoices/${ids.r2}/send`, {}));
    await must("R1 tekrar", api.post(`/api/workspace/invoices/${ids.r1}/repeat`, { everyMonths: 1, nextDate: "2027-01-10" }));
    await must("R2 tekrar", api.post(`/api/workspace/invoices/${ids.r2}/repeat`, { everyMonths: 1, nextDate: "2027-01-11" }));
    await must("R2 durdur", api.post(`/api/workspace/invoices/${ids.r2}/repeat-stop`, {}));
    server.clock.set("2026-12-15T10:00:00+03:00");
    ids.t1 = (await sale("T1", "2026-12-15", { status: "draft" })).id;
    // GİB sıra kuralı (daha eski tarihli gönderilmemiş belge varken yenisi gönderilmez): gönderilenler önce, bekleyenler sonra.
    server.clock.set("2026-12-30T10:00:00+03:00");
    ids.w4 = (await sale("W4", "2026-12-30", { eSend: "later" })).id;
    await must("W4 gönder", api.post(`/api/workspace/invoices/${ids.w4}/send`, {}));
    for (let i = 0; i < 4 && eStatusOf(ids.w4).e !== "sent"; i += 1) await api.post(`/api/workspace/invoices/${ids.w4}/e-refresh`, {});
    server.clock.set("2026-12-31T10:00:00+03:00");
    ids.w3 = (await sale("W3", "2026-12-31", { eSend: "later" })).id;
    loseSend = true;
    const lost = await api.post(`/api/workspace/invoices/${ids.w3}/send`, {});
    status.w3send = lost.status;
    ids.w1 = (await sale("W1", "2026-12-31", { eSend: "later" })).id;
    ids.w6 = (await sale("W6", "2026-12-31")).id;
    ids.w2 = (await sale("W2", "2026-12-31", { eSend: "later" })).id;
    await must("W2 listeden sil", api.post(`/api/workspace/invoices/${ids.w2}/withdraw`, {}));
    server.clock.set("2027-02-08T10:00:00+03:00");
    ids.w5 = (await sale("W5", "2027-02-05", { eSend: "later" })).id;
    ids.t2 = (await sale("T2", "2027-02-05", { status: "draft" })).id;
    ids.r3 = (await sale("R3", "2027-02-06", { eSend: "later" })).id;
    await must("R3 tekrar", api.post(`/api/workspace/invoices/${ids.r3}/repeat`, { everyMonths: 1, nextDate: "2027-03-06" }));
    for (const key of ["r1", "r2", "r3", "t1", "t2", "w1", "w2", "w3", "w4", "w5", "w6"]) status[key] = eStatusOf(ids[key]);
  });
  after(async () => {
    await server?.close();
    await edm?.close?.();
  });

  it("veri tabanındaki durumlar (önce bunlar — ders 3): W1 / W5 Gönderilecek, W2 Gönderilmeyecek, W3 'none' + entegratör izi (Sonucu Belirsiz; gönderim 502), W4 Gönderildi, W6 numaralı 'none', T1 / T2 taslak", () => {
    const adapter = id => Boolean(server.app.store.get("SELECT e_adapter AS a FROM invoices WHERE id = ?", id).a);
    assert.deepEqual([status.w1.e, status.w5.e, status.w2.e, status.w3.e, adapter(ids.w3), status.w3send, status.w4.e, status.w6.e, adapter(ids.w6), status.t1.status, status.t2.status], ["waiting", "waiting", "withdrawn", "none", true, 502, "sent", "none", false, "draft", "draft"]);
    assert.ok(server.app.store.get("SELECT number FROM invoices WHERE id = ?", ids.w6).number, "W6 numara almış");
  });

  it("ön denetim (10.02.2027; elle): DURDURUR bekleyen 2 (W1 + W6), listeden silinen 1, sonucu belirsiz 1, taslak 1; UYARIR şablon 1; K sonrası W5 / T2 / R3 sayılmaz", async () => {
    assert.ok(planModule, "D3 devir planı modülü yok (eski kod)");
    server.clock.set("2027-02-10T12:00:00+03:00");
    const job = await waitPreview(api, { company: "sirket-001", cutoff: K, option: "borc-alacak" });
    assert.equal(job.state, "done", JSON.stringify(job.error));
    const stop = Object.fromEntries(job.result.onDenetim.durdurur.map(row => [row.kod, row.adet]));
    assert.deepEqual(stop, { "e-belge-bekleyen": 2, "e-belge-listeden-silinen": 1, "e-belge-belirsiz": 1, "taslak-fatura": 1 });
    const warn = job.result.onDenetim.uyarir.map(row => row.kod);
    assert.ok(warn.includes("tekrarlayan-sablon") && !warn.includes("iptal-suresi"), warn.join(", "));
    assert.deepEqual(job.result.plan.newYear.sablonlar.map(row => row.sablon), [ids.r1], "yalnız etkin ve ≤K şablon (R2 durduruldu, R3 K'den sonra)");
    assert.equal(job.result.onDenetim.durdurur.find(row => row.kod === "e-belge-bekleyen").git.hedef, "invoices:waiting");
  });

  it("iptal süresi (05.01.2027): 30.12'de iletilen e-Arşiv için UYARIR 1; aynı belge 10.02.2027'de sayılmaz (yukarıda)", async () => {
    assert.ok(planModule, "D3 devir planı modülü yok (eski kod)");
    server.clock.set("2027-01-05T10:00:00+03:00");
    const job = await waitPreview(api, { company: "sirket-001", cutoff: K, option: "borc-alacak" });
    assert.equal(job.result.onDenetim.uyarir.find(row => row.kod === "iptal-suresi")?.adet, 1);
    server.clock.set("2027-02-10T12:00:00+03:00");
  });
});

describe("D3 tur 2 — Dönem Kilidi: kilit yok / K'den önce / K / K'yi aşan → aynı plan; ön izleme kilide dokunmaz", () => {
  let ctx;
  let api;
  const ids = {};
  const lockState = () => ({ lock: ctx.store.get("SELECT value FROM settings WHERE key = 'ledger.lockedUntil'")?.value || "", audit: ctx.store.all("SELECT type, payload_json AS p FROM audit_events WHERE entity_id = 'period' ORDER BY rowid") });
  // Kilidin KENDİ yazdığı satırlar (denetim izi, kilit ayarı, dondurulmuş defter ve değerleme kartları) hareket sayısını değiştirir — planın para kısmı değil. Karşılaştırmadan yalnız bunlar çıkar.
  const LOCK_TABLES = new Set(["audit_events", "ledger_snapshots", "ledger_snapshot_runs", "ledger_valuation_cards", "settings"]);
  const planWithoutStamp = job => {
    const plan = job.result.plan;
    return JSON.stringify({ ...plan, meta: { ...plan.meta, veriSurumu: "" }, newYear: { ...plan.newYear, budama: plan.newYear.budama.filter(row => !LOCK_TABLES.has(row.table)) }, sayilar: { ...plan.sayilar, hareket: null } });
  };
  before(async () => {
    ctx = await boot({ now: { time: "2027-02-10T12:00:00+03:00", fixed: true } });
    api = ctx.api;
    ids.c = (await must("C", api.post("/api/workspace/accounts", { name: "Kilit Müşterisi", type: "customer" }))).id;
    ids.s = (await must("S", api.post("/api/workspace/accounts", { name: "Kilit Tedarikçisi", type: "supplier" }))).id;
    const line = price => [{ name: "Hizmet", qty: 1, unitPrice: price, discountRate: 0, vatRate: 20 }];
    const pay = { cash: [], cheques: [], endorse: [], rest: "open" };
    await must("satış 1", api.post("/api/workspace/invoices", { kind: "sale", accountId: ids.c, issueDate: "2026-03-10", lines: line(1000), payment: { ...pay, dueDate: "2026-04-10" }, force: true }));
    await must("alış", api.post("/api/workspace/invoices", { kind: "purchase", accountId: ids.s, number: "AL-K1", issueDate: "2026-05-02", lines: line(400), payment: pay, force: true }));
    await must("tahsilat", api.post(`/api/workspace/accounts/${ids.c}/entries`, { kind: "in", amount: "500", date: "2026-08-01", note: "Kısmi" }));
    await must("satış 2", api.post("/api/workspace/invoices", { kind: "sale", accountId: ids.c, issueDate: "2026-11-20", lines: line(700), payment: { ...pay, dueDate: "2026-12-20" }, force: true }));
    await must("ödeme", api.post(`/api/workspace/accounts/${ids.s}/entries`, { kind: "out", amount: "200", date: "2026-12-05", note: "Ödeme", cashForce: true }));
    await must("ocak tahsilatı", api.post(`/api/workspace/accounts/${ids.c}/entries`, { kind: "in", amount: "300", date: "2027-01-10", note: "Ocak" }));
  });
  after(() => ctx?.server.close());

  it("dört kilit durumunda plan (veri damgası hariç) bayt bayt AYNI, değişmezler tutar; her ön izlemeden önce ve sonra kilit + kilit izi AYNI", async () => {
    assert.ok(planModule, "D3 devir planı modülü yok (eski kod)");
    const plans = {};
    for (const lock of ["", "2026-06-30", K, "2027-01-15"]) {
      if (lock) {
        await must(`kilit ${lock}`, api.put("/api/admin/period-lock", { lockedUntil: lock }));
        await ctx.app.ledger.snapshots.runPending();
      }
      const before = lockState();
      const job = await waitPreview(api, { company: "sirket-001", cutoff: K, option: "borc-alacak" });
      assert.equal(job.state, "done", JSON.stringify(job.error));
      assert.deepEqual(lockState(), before, `ön izleme kilide / kilit izine dokundu (${lock || "kilit yok"})`);
      assert.equal(before.lock, lock);
      assert.deepEqual(job.result.plan.sorunlar, [], lock);
      assert.deepEqual(job.result.plan.degismezler.filter(row => !row.ok), [], lock);
      assert.deepEqual(job.result.onDenetim.durdurur.map(row => row.kod), [], lock);
      plans[lock || "yok"] = planWithoutStamp(job);
    }
    const where = (a, b) => {
      let i = 0;
      while (i < a.length && a[i] === b[i]) i += 1;
      return i >= a.length && a.length === b.length ? "" : `ilk fark ${i}: …${a.slice(Math.max(0, i - 160), i + 80)} ↔ …${b.slice(Math.max(0, i - 160), i + 80)}`;
    };
    assert.equal(where(plans["2026-06-30"], plans.yok), "", "kilit K'den önce");
    assert.equal(where(plans[K], plans.yok), "", "kilit = K");
    assert.equal(where(plans["2027-01-15"], plans.yok), "", "kilit K'yi aşıyor");
    // Elle: C K bakiyesi 1.200 + 840 − 500 = 1.540,00 (KDV %20: 1.200 ve 840); açık kalemler S2 ile: 1. satış kalanı 700,00 (vade 10.04), 2. satış 840,00 (vade 20.12).
    const plan = JSON.parse(plans.yok);
    const c = plan.newYear.cariler.find(row => row.cari === ids.c);
    assert.deepEqual([c.kBakiyeMinor, c.satirlar.filter(row => row.tur === "acik-kalem").map(row => [row.tutarMinor, row.vade])], [154000, [[70000, "2026-04-10"], [84000, "2026-12-20"]]]);
  });
});

describe("D3 tur 2 — kilitli dönemde KURAL DEĞİŞİKLİĞİ: plan donmuş defteri (karma yevmiye) okur, canlı türetmeyi değil; Kural Farkı devri DURDURUR (S-3 = A)", () => {
  const rule = { on: false };
  // Kural değişikliği benzetimi (YALNIZ TEST kancası; test/c6h-bilanco-uc deseni): açıkken satış faturasının 600 / 120 satırlarına 100,00 eklenir.
  rule.fn = entries => (!rule.on ? entries : entries.map(entry => (!entry.lines.some(line => line.account === "600") ? entry : { ...entry, lines: entry.lines.map(line => (line.account === "600" ? { ...line, credit: line.credit + 10000 } : line.account === "120" ? { ...line, debit: line.debit + 10000 } : line)) })));
  let ctx;
  let api;
  let worker;
  before(async () => {
    worker = planModule ? await import("../server/lib/devir/plan-worker.mjs").catch(() => null) : null;
    ctx = await boot({ now: { time: "2027-02-10T12:00:00+03:00", fixed: true }, __testLedgerRule: rule });
    api = ctx.api;
    const c = (await must("C", api.post("/api/workspace/accounts", { name: "Kural Müşterisi", type: "customer" }))).id;
    await must("satış", api.post("/api/workspace/invoices", { kind: "sale", accountId: c, issueDate: "2026-03-10", lines: [{ name: "Hizmet", qty: 1, unitPrice: 1000, discountRate: 0, vatRate: 0 }], payment: { cash: [], cheques: [], endorse: [], rest: "open" }, force: true }));
    await must("kilit K", api.put("/api/admin/period-lock", { lockedUntil: K }));
    await ctx.app.ledger.snapshots.runPending();
    rule.on = true; // dondurmadan SONRA kural değişti: canlı türetme 600'ü 1.100,00 görür, donmuş defter 1.000,00
  });
  after(() => ctx?.server.close());

  it("elle: K kapanışında 600 = 1.000,00 (donmuş), 120 = 1.000,00; Dönem Net Kârı 1.000,00; ön denetim 'Kural Farkı Düzeltme Fişi'ni Yazın' DURDURUR", () => {
    assert.ok(worker, "D3 ön izleme yok (eski kod)");
    const out = worker.runPreview({ store: ctx.app.store, ledger: ctx.app.context.ledger, job: { K, today: "2027-02-10", option: "borc-alacak", company: null, isRoot: true } });
    const n04 = out.plan.archive.kapanisFisleri.find(row => row.kod === "N-04");
    assert.deepEqual(n04.lines.filter(line => line.account === "600").map(line => line.debit), [100000]);
    assert.equal(out.plan.archive.kapanisBakiyeleri.filter(row => row.hesap === "120").reduce((sum, row) => sum + row.minor, 0), 100000);
    assert.equal(out.plan.archive.donemSonucuMinor, 100000);
    // D3 tur 3 (S-KD-1 = A): farkın satırı 120'de (alt defter hesabı) → fişin düzeltemediği fark, madde "kural-farki-alt-defter" (çare Kilidi Aç → Yeniden Kilitle; tur 2'de "kural-farki").
    assert.ok(out.onDenetim.durdurur.some(row => row.kod === "kural-farki-alt-defter"), out.onDenetim.durdurur.map(row => row.kod).join(", "));
  });
});
