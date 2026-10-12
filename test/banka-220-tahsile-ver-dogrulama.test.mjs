// 2.2.0 — Bankaya Tahsile Ver: bağımsız doğrulama bulgularının (docs/kanit/2026-10-12/tahsile-ver/dogrulayici) düzeltme testleri.
// Plan: docs/BANKA-MODULU-PLAN.md §3.11 (kapı, 101.01/101.02), §3.14, §8.9, §8.10, §10.6 h. Her bulgu önce düzeltme öncesi kodun ayrı kopyasında
// kırmızı görüldü (kanıt: docs/kanit/2026-10-12/tahsile-ver/duzeltme/).
//
// Sahte saat 08.10.2026 Perşembe. Ziraat Bankası · Ana TL Hesabı ve Garanti BBVA · Ana TL Hesabı (açılış 01.10.2026).
// Bağımsız beklenen: planın yevmiyesi ve takvim (testin kendi hesabı; programın fonksiyonu çağrılmaz).
//
// ÇALIŞIYOR MU
//   T1/D6  Tahsile Ver, Bankadan Geri Al, tahsildeki evrakın Tahsil Edildi / Karşılıksız'ı ve karşılıksızın Geri Al'ı kapının DOKUNULAN VARLIKLAR
//          yolundan geçer (üretim ayarı; plan §3.11 cheque:collections "Her COMMIT"); süzgeç yolunda büyük tablo baştan sona dolaşılmaz.
//   T2     Tahsildeki evrak karşılıksız dönünce o gün TEK madde: B 120 / A 101.02 (cari) ya da B 770 / A 101.02 (carisiz); 101.01 hareketsiz.
//   T3     Yevmiye Defteri alt hesabı yazar (101.02 / 101.01, 102.01).
//   T4     Hiç tahsile verilmemiş şirkette Alt Hesap Mizanı'nda 101.01 ve 101 ana hesabı (portföy).
//   T5/T6  Zil/Takvim (dues) tahsildeki çeki Vade Takip ile aynı günde (iş günü) ve "Bankada Tahsilde" adıyla gösterir; Nakit Akış kaynak
//          özetinde ve PDF/Excel'de "Tahsildeki Çek ve Senet" ayrı kaynaktır.
//   T7     Çek / Senet Portföyü: "deposited" süzgeci çalışır; "Portföyde (alınan)" özeti tahsildekini içermez, "Bankada Tahsilde" ayrı satır.
//   T9     Çek / Senet Hareketleri tahsile verme ve geri almayı gösterir; Tahsildeki Çek ve Senetler raporu (TOPLAM = 101.02).
//   G1     İşlem Kartı: Tahsile Ver başlığında B 101.02 / A 101.01 satırları; tahsildeki evrakın tahsilinde A 101.02 (Ana Defter ile aynı), adlarıyla.
// NASIL BOZARIM
//   T8/D5  Hesabın açılışından önceki güne tahsile verme → 409 bank-before-opening; açılışı ilk tahsile verme gününden sonraya alma → 409.
//   D3     Karşılıksızdan sonra hesabı pasife al / türünü Vadeli yap → karşılıksızı Geri Al reddedilir (kayıt kapalı kalır); hesap etkinleşince olur.
//   D4     Tahsil kaydı geri alınmış evrakın alış tarihini veriliş gününden sonraya alma → 409 date-after-deposit.
//   Kapı   Tahsil kaydını kapı dışından bozma (store yazımı, aynı işlemde): geri alınmış kaydı yeniden "bekleyen" yapma, verilme tarihini alıştan önceye
//          alma, verilme başlığını iptal etme → süzgeç yakalar (IntegrityError; tam kapıyla eşdeğerlik ihlali DEĞİL).
//   D1/D2  GERÇEK v2.1.0 koduna dönüp tahsildeki evrakı veriliş gününden önceki tarihle ciro etme / silme / tutarını değiştirme / alış tarihini sonraya
//          alma; bu dal açılınca açılış onarımı (h) sonrası Mutabakat Testi tamam ve yazım sürer.
import assert from "node:assert/strict";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { after, before, describe, it } from "node:test";
import { GateEquivalenceError, IntegrityError } from "../server/lib/integrity.mjs";
import { subBalances as journalSubs } from "../server/lib/general-ledger.mjs";
import { apiOf, integrityOf, integrityOk, xlsxSheets } from "./banka-210-ortak.mjs";
import { BANK, bootBank, expectStatus, must, openAcceptanceAccounts, openAccount } from "./banka-210-hesap-ortak.mjs";
import { CURRENT, bootVersion, tagsAvailable } from "./guvenilirlik/surumler.mjs";

const CHEQUES = "/api/workspace/cheques";
const act = (api, id, body) => api.post(`${CHEQUES}/${id}/actions`, body);
const receive = (api, body) => must(`çek al ${body.serialNo || ""}`, api.post(CHEQUES, { direction: "in", instrument: "cheque", amount: "1.000", issueDate: "2026-10-05", dueDate: "2026-10-31", ...body }));
const report = (api, id, query = "") => must(`rapor ${id}`, api.get(`/api/workspace/report-center/${id}${query}`));
const money = text => Number(String(text || "0").replace(/[^\d,-]/g, "").replace(/\./g, "").replace(",", ".")) || 0;
/** Alt Hesap Mizanı (dönem): alt hesap → [borç, alacak]. */
const subPeriod = async (api, from, to) => Object.fromEntries((await must("alt hesap", api.get(`${BANK}/sub-trial?from=${from}&to=${to}`))).rows.map(row => [row.sub, [row.debit, row.credit]]));
/** Yevmiye satırları (gün): [hesap, borç, alacak]. */
const journalOf = async (api, day) => (await report(api, "yevmiye", `?from=${day}&to=${day}`)).rows.map(row => [row[3], money(row[4]), money(row[5])]);

async function setup(options = {}) {
  const ctx = await bootBank(options);
  const acc = await openAcceptanceAccounts(ctx.api);
  const buyer = await must("müşteri", ctx.api.post("/api/workspace/accounts", { name: "ABC Ltd.", type: "customer", registeredOn: "2026-09-01" }));
  const seller = await must("tedarikçi", ctx.api.post("/api/workspace/accounts", { name: "XYZ Tedarik", type: "supplier", registeredOn: "2026-09-01" }));
  return { ctx, acc, buyer, seller };
}

describe("T1/D6 — tahsil kaydı yazımları kapının dokunulan varlıklar yolundan geçer (üretim ayarı)", () => {
  let t;
  before(async () => {
    t = await setup({ gateVerify: false, moneyStrict: false });
  });
  after(() => t.ctx.server.close());
  const gate = () => t.ctx.app.integrity.stats().gate;
  const scoped = async (label, promise) => {
    await must(label, promise);
    const g = gate();
    assert.equal(g.path, "scoped", `${label}: kapı yolu ${g.path} (${g.reason || ""})`);
  };

  it("Tahsile Ver, Bankadan Geri Al, tahsildeki evrakın tahsili, karşılıksızı ve karşılıksızın Geri Al'ı: süzgeç yolu; Mutabakat tamam", async () => {
    const { api } = t.ctx;
    const a = await receive(api, { serialNo: "K-1", accountId: t.buyer.id });
    await scoped("tahsile ver", act(api, a.id, { action: "bank-deposit", date: "2026-10-06", bankAccountId: t.acc.ziraat.id }));
    await scoped("bankadan geri al", act(api, a.id, { action: "bank-withdraw", date: "2026-10-07" }));
    await scoped("yeniden tahsile ver", act(api, a.id, { action: "bank-deposit", date: "2026-10-07", bankAccountId: t.acc.garanti.id }));
    await scoped("tahsil edildi (tahsildeki)", act(api, a.id, { action: "collect", date: "2026-10-08" }));
    const b = await receive(api, { serialNo: "K-2", accountId: t.buyer.id, amount: "500" });
    await scoped("tahsile ver 2", act(api, b.id, { action: "bank-deposit", date: "2026-10-06", bankAccountId: t.acc.ziraat.id }));
    await scoped("karşılıksız (tahsildeki)", act(api, b.id, { action: "bounce", date: "2026-10-08" }));
    await scoped("karşılıksızı geri al", api.post(`${CHEQUES}/${b.id}/undo`, {}));
    assert.equal(t.ctx.store.get("SELECT status FROM cheque_collections WHERE cheque_id = ?", b.id).status, "pending");
    await integrityOk(api, "kapı yolu sonrası");
  });
});

describe("Kapı — tahsil kaydını kapı dışından bozma: dokunulan varlıklar yolu yakalar (eşdeğerlik ihlali değil)", () => {
  let t;
  let withdrawn;
  let pending;
  let pendingCheque;
  before(async () => {
    t = await setup();
    const { api } = t.ctx;
    const a = await receive(api, { serialNo: "B-1", accountId: t.buyer.id });
    await must("ver", act(api, a.id, { action: "bank-deposit", date: "2026-10-06", bankAccountId: t.acc.ziraat.id }));
    await must("geri al", act(api, a.id, { action: "bank-withdraw", date: "2026-10-07" }));
    withdrawn = t.ctx.store.get("SELECT id FROM cheque_collections WHERE cheque_id = ?", a.id).id;
    pendingCheque = await receive(api, { serialNo: "B-2", accountId: t.buyer.id, amount: "700" });
    await must("ver 2", act(api, pendingCheque.id, { action: "bank-deposit", date: "2026-10-06", bankAccountId: t.acc.ziraat.id }));
    pending = t.ctx.store.get("SELECT id, event_id AS eventId FROM cheque_collections WHERE cheque_id = ?", pendingCheque.id);
  });
  after(() => t.ctx.server.close());
  const tampered = (label, sql, ...args) => {
    let caught = null;
    try {
      t.ctx.store.tx(() => t.ctx.store.run(sql, ...args));
    } catch (error) {
      caught = error;
    }
    assert.ok(caught, `${label}: kapı reddetmedi`);
    assert.ok(!(caught instanceof GateEquivalenceError), `${label}: süzgeç temiz dedi, tam kapı reddetti (eşdeğerlik ihlali)`);
    assert.ok(caught instanceof IntegrityError, `${label}: ${caught.message}`);
  };

  it("geri alınmış kayıt yeniden bekleyen; verilme tarihi alıştan önce; verilme başlığı iptal; tahsildeki evrakın tutarı", async () => {
    tampered("geri alınan kayıt yeniden bekleyen", "UPDATE cheque_collections SET status = 'pending', closed_date = '', close_event_id = '' WHERE id = ?", withdrawn);
    tampered("verilme tarihi alıştan önce", "UPDATE cheque_collections SET given_date = '2026-10-01' WHERE id = ?", pending.id);
    tampered("verilme başlığı iptal", "UPDATE fin_events SET status = 'cancelled' WHERE id = ?", pending.eventId);
    tampered("tahsildeki evrakın tutarı", "UPDATE cheques SET amount = 750 WHERE id = ?", pendingCheque.id);
    await integrityOk(t.ctx.api, "bozma denemeleri geri alındı");
  });
});

describe("T2 — tahsildeki evrak karşılıksız: tek madde, alacak 101.02", () => {
  let t;
  before(async () => {
    t = await setup();
  });
  after(() => t.ctx.server.close());

  it("carili senet: 08.10'da B 120 / A 101.02 tek madde; Alt Hesap Mizanı 101.01 hareketsiz, 101.02 alacak 3.000", async () => {
    const { api } = t.ctx;
    const note = await must("senet", api.post(CHEQUES, { direction: "in", instrument: "note", amount: "3.000", issueDate: "2026-10-03", dueDate: "2026-11-16", accountId: t.buyer.id, serialNo: "N1" }));
    await must("ver", act(api, note.id, { action: "bank-deposit", date: "2026-10-06", bankAccountId: t.acc.ziraat.id }));
    await must("karşılıksız", act(api, note.id, { action: "bounce", date: "2026-10-08" }));
    assert.deepEqual(await journalOf(api, "2026-10-08"), [["120", 3000, 0], ["101.02", 0, 3000]], "08.10 yevmiyesi tek madde");
    const subs = await subPeriod(api, "2026-10-08", "2026-10-08");
    assert.deepEqual(subs["101.01"], [0, 0], "101.01 o gün hareketsiz");
    assert.deepEqual(subs["101.02"], [0, 3000], "101.02 alacak 3.000");
    await integrityOk(api, "karşılıksız");
    // Geri Al: kayıt yeniden tahsilde; karşılıksız maddesi kalkar.
    await must("geri al", api.post(`${CHEQUES}/${note.id}/undo`, {}));
    assert.deepEqual(await journalOf(api, "2026-10-08"), [], "karşılıksız geri alındı: 08.10 maddesi yok");
    assert.equal(journalSubs(t.ctx.app.ledger.build()).get("101.02"), 300000);
    await integrityOk(api, "karşılıksız geri alındı");
  });

  it("carisiz çek ve taksite sayılmış çek: karşılıksız maddesi A 101.02; 101.01 / 101.02 sıfır; Mutabakat tamam", async () => {
    const { api } = t.ctx;
    const free = await must("carisiz çek", api.post(CHEQUES, { direction: "in", instrument: "cheque", amount: "1.500", issueDate: "2026-10-02", dueDate: "2026-11-02", drawer: "Ahmet Yılmaz", serialNo: "F-1" }));
    await must("ver", act(api, free.id, { action: "bank-deposit", date: "2026-10-05", bankAccountId: t.acc.garanti.id }));
    await must("karşılıksız", act(api, free.id, { action: "bounce", date: "2026-10-07" }));
    assert.deepEqual(await journalOf(api, "2026-10-07"), [["770", 1500, 0], ["101.02", 0, 1500]], "carisiz: B 770 / A 101.02 tek madde");
    const plan = await must("taksit kartı", api.post("/api/workspace/plans", { name: "ABC Taksit", accountId: t.buyer.id, total: "900", mode: "auto", count: 1, firstDue: "2026-11-08", registeredOn: "2026-10-01" }));
    const planned = await receive(api, { serialNo: "TK-1", accountId: t.buyer.id, planId: plan.id, amount: "900", issueDate: "2026-10-04" });
    await must("ver", act(api, planned.id, { action: "bank-deposit", date: "2026-10-05", bankAccountId: t.acc.ziraat.id }));
    await must("karşılıksız", act(api, planned.id, { action: "bounce", date: "2026-10-07" }));
    const subs = journalSubs(t.ctx.app.ledger.build());
    assert.equal(subs.get("101.02") || 0, 300000, "101.02 = yalnız tahsildeki N1 (3.000); karşılıksız dönen ikisi 0");
    await integrityOk(api, "carisiz ve taksitli karşılıksız");
  });
});

describe("T3, T4, G1 — Yevmiye ve İşlem Kartı alt hesapları; Alt Hesap Mizanı'nda 101", () => {
  let t;
  let cheque;
  before(async () => {
    t = await setup();
    cheque = await receive(t.ctx.api, { serialNo: "Y-1", accountId: t.buyer.id, amount: "2.000", issueDate: "2026-10-02" });
  });
  after(() => t.ctx.server.close());

  it("T4: hiç tahsile verilmemiş şirkette 101.01 = 2.000 ve 101 ana hesabı", async () => {
    const data = await must("alt hesap", t.ctx.api.get(`${BANK}/sub-trial`));
    const row = data.rows.find(item => item.sub === "101.01");
    assert.equal(row?.balance, 2000, `101.01: ${JSON.stringify(data.rows.map(item => item.sub))}`);
    assert.ok(data.mains.some(item => item.account === "101" && item.balance === 2000 && item.ok), `ana hesaplar: ${JSON.stringify(data.mains)}`);
  });

  it("T3: Tahsile Ver maddesi Yevmiye'de 101.02 borç / 101.01 alacak; tahsil maddesi 102.01 borç / 101.02 alacak", async () => {
    const { api } = t.ctx;
    await must("ver", act(api, cheque.id, { action: "bank-deposit", date: "2026-10-05", bankAccountId: t.acc.ziraat.id }));
    assert.deepEqual(await journalOf(api, "2026-10-05"), [["101.02", 2000, 0], ["101.01", 0, 2000]]);
    await must("tahsil", act(api, cheque.id, { action: "collect", date: "2026-10-07" }));
    assert.deepEqual(await journalOf(api, "2026-10-07"), [[t.acc.ziraat.glSub, 2000, 0], ["101.02", 0, 2000]]);
  });

  it("G1: İşlem Kartı — Tahsile Ver başlığında 101.02 / 101.01 satırları; tahsil olayında A 101.02 (adlarıyla)", async () => {
    const { api, store } = t.ctx;
    const deposit = store.get("SELECT no FROM fin_events WHERE type = 'cheque_deposit' AND cheque_id = ?", cheque.id);
    const card = await must("İşlem Kartı", api.get(`${BANK}/events/${deposit.no}`));
    const lines = (card.lines || []).map(line => [line.sub, line.side, line.tryMinor]);
    assert.deepEqual(lines, [["101.02", "D", 200000], ["101.01", "C", 200000]], `Tahsile Ver kartı: ${JSON.stringify(card.lines)}`);
    assert.ok(card.lines.every(line => line.subName), "alt hesap adları dolu");
    const collect = store.get("SELECT e.no FROM cheque_events ev JOIN fin_events e ON e.id = ev.event_id WHERE ev.cheque_id = ? AND ev.kind = 'collect'", cheque.id);
    const collectCard = await must("tahsil kartı", api.get(`${BANK}/events/${collect.no}`));
    const credit = collectCard.lines.find(line => line.side === "C");
    assert.deepEqual([credit?.gl, credit?.sub], ["101", "101.02"], `tahsil kartı: ${JSON.stringify(collectCard.lines)}`);
    assert.match(credit.subName, /Tahsile/);
  });
});

describe("T5, T6 — tahsildeki çekin beklenen günü: zil/takvim, Vade Takip, Nakit Akış (kaynak)", () => {
  let t;
  before(async () => {
    t = await setup();
    const { api } = t.ctx;
    // Vade 10.10.2026 Cumartesi → bankadan beklenen gün 12.10.2026 Pazartesi.
    const dep = await receive(api, { serialNo: "D-1", accountId: t.buyer.id, amount: "1.000", issueDate: "2026-10-02", dueDate: "2026-10-10" });
    await receive(api, { serialNo: "D-2", accountId: t.buyer.id, amount: "300", issueDate: "2026-10-02", dueDate: "2026-10-10" });
    await must("ver", act(api, dep.id, { action: "bank-deposit", date: "2026-10-08", bankAccountId: t.acc.ziraat.id }));
  });
  after(() => t.ctx.server.close());

  it("zil/takvim (dues): D-1 12.10 'Bankada Tahsilde', D-2 10.10 'Tahsil Edilecek' — Vade Takip ile aynı günler", async () => {
    const dues = await must("dues", t.ctx.api.get("/api/workspace/dues"));
    const rows = dues.items.filter(item => item.source === "cheque").map(item => [item.label.match(/No (D-\d)/)?.[1], item.dueDate, item.days, /^Bankada Tahsilde/.test(item.label)]).sort();
    assert.deepEqual(rows, [["D-1", "2026-10-12", 4, true], ["D-2", "2026-10-10", 2, false]]);
    const vade = await must("Vade Takip", t.ctx.api.get("/api/workspace/overview/vade-takip?preset=open&sources=cheque"));
    assert.deepEqual(vade.rows.filter(row => row.ref?.type === "cheque").map(row => [row.label.match(/No (D-\d)/)?.[1], row.date]).sort(), [["D-1", "2026-10-12"], ["D-2", "2026-10-10"]]);
  });

  it("Nakit Akış: kaynak özetinde tahsildeki 1.000 ve portföydeki 300 ayrı; Excel'de Kaynak 'Tahsildeki Çek ve Senet'", async () => {
    const q = "from=2026-10-08&to=2026-10-31&table=0";
    const data = await must("Nakit Akış", t.ctx.api.get(`/api/workspace/overview/nakit-akisi?${q}`));
    assert.equal(data.bySource["deposit:in"], 1000, JSON.stringify(data.bySource));
    assert.equal(data.bySource["cheque:in"], 300, JSON.stringify(data.bySource));
    const xlsx = await t.ctx.api.raw("GET", `/api/workspace/overview/nakit-akisi.xlsx?${q}`);
    assert.equal(xlsx.status, 200);
    const cells = Object.values(xlsxSheets(xlsx.buffer)).flat(2).map(String);
    assert.ok(cells.includes("Tahsildeki Çek ve Senet"), "Excel kaynak kolonu");
  });
});

describe("T7, T9 — Çek / Senet raporları ve Tahsildeki Çek ve Senetler", () => {
  let t;
  before(async () => {
    t = await setup();
    const { api } = t.ctx;
    const c1 = await receive(api, { serialNo: "R-1", accountId: t.buyer.id, amount: "750,25" });
    const c2 = await receive(api, { serialNo: "R-2", accountId: t.buyer.id, amount: "6.000,50" });
    const c3 = await receive(api, { serialNo: "R-3", accountId: t.buyer.id, amount: "500" });
    await must("ver 2", act(api, c2.id, { action: "bank-deposit", date: "2026-10-06", bankAccountId: t.acc.ziraat.id }));
    await must("ver 3", act(api, c3.id, { action: "bank-deposit", date: "2026-10-06", bankAccountId: t.acc.garanti.id }));
    await must("geri al 3", act(api, c3.id, { action: "bank-withdraw", date: "2026-10-07" }));
    void c1;
  });
  after(() => t.ctx.server.close());

  it("T7: status=deposited yalnız tahsildeki; status=portfolio satır toplamı = özet 'Portföyde (alınan)'; 'Bankada Tahsilde' ayrı", async () => {
    const { api } = t.ctx;
    const dep = await report(api, "cek-portfoy", "?status=deposited");
    assert.deepEqual(dep.rows.map(row => row[3]), ["R-2"]);
    assert.match(dep.subtitle, /Bankada Tahsilde/);
    const port = await report(api, "cek-portfoy", "?status=portfolio");
    const listed = port.rows.reduce((sum, row) => sum + money(row.at(-1)), 0);
    const summary = Object.fromEntries(port.summary);
    assert.equal(Math.round(listed * 100), 125025, "portföy satırları R-1 + R-3");
    assert.equal(money(summary["Portföyde (alınan)"]), 1250.25, JSON.stringify(port.summary));
    assert.equal(money(summary["Bankada Tahsilde"]), 6000.5);
  });

  it("T9: Çek / Senet Hareketleri'nde Bankaya Tahsile Verildi ve Bankadan Geri Alındı; Tahsildeki Çek ve Senetler raporu = 101.02", async () => {
    const { api } = t.ctx;
    const moves = await report(api, "cek-hareketleri", "?from=2026-10-01&to=2026-10-15");
    const kinds = moves.rows.map(row => [row[2], row[4]]);
    assert.deepEqual(kinds.filter(([, kind]) => kind !== "Alındı"), [["R-2", "Bankaya Tahsile Verildi"], ["R-3", "Bankaya Tahsile Verildi"], ["R-3", "Bankadan Geri Alındı"]]);
    const held = await report(api, "tahsildeki-cekler");
    assert.deepEqual(held.rows.map(row => [row[0], row[1], row[3], row.at(-1)]), [["06.10.2026", "Ziraat Bankası · Ana TL Hesabı", "R-2", held.rows[0].at(-1)]]);
    assert.equal(money(held.rows[0].at(-1)), 6000.5);
    assert.equal(journalSubs(t.ctx.app.ledger.build()).get("101.02"), 600050, "101.02 = rapor toplamı");
    const catalog = await must("katalog", api.get("/api/workspace/report-center"));
    assert.ok(catalog.reports.some(item => item.id === "tahsildeki-cekler" && item.group === "Banka"));
  });
});

describe("T8/D5, D3, D4 — geçiş kuralları", () => {
  let t;
  before(async () => {
    t = await setup();
  });
  after(() => t.ctx.server.close());

  it("T8/D5: hesabın açılışından önce tahsile verme 409; açılış günü 200; açılışı ilk tahsile vermeden sonraya alma 409", async () => {
    const { api } = t.ctx;
    const a = await receive(api, { serialNo: "O-1", accountId: t.buyer.id, amount: "2.000", issueDate: "2026-09-20" });
    expectStatus(await act(api, a.id, { action: "bank-deposit", date: "2026-09-25", bankAccountId: t.acc.ziraat.id }), 409, "bank-before-opening", "açılıştan önce tahsile ver");
    assert.equal(t.ctx.store.get("SELECT COUNT(*) AS n FROM cheque_collections WHERE cheque_id = ?", a.id).n, 0, "kayıt yazılmadı");
    await must("açılış günü", act(api, a.id, { action: "bank-deposit", date: "2026-10-01", bankAccountId: t.acc.ziraat.id }));
    const fresh = await openAccount(api, { bankName: "Akbank", name: "Tahsil Hesabı", kind: "demand", currency: "TRY", opening: { date: "2026-10-01", amount: "0", confirmed: true } });
    const b = await receive(api, { serialNo: "O-2", accountId: t.buyer.id, amount: "100", issueDate: "2026-10-02" });
    await must("ver", act(api, b.id, { action: "bank-deposit", date: "2026-10-03", bankAccountId: fresh.id }));
    expectStatus(await api.post(`${BANK}/accounts/${fresh.id}/opening`, { date: "2026-10-05", amount: "0", confirmed: true }), 409, "bank-opening-after-first", "açılışı tahsile vermeden sonraya");
    await integrityOk(api, "açılış kuralları");
  });

  it("D3: karşılıksızdan sonra hesap pasif ya da Vadeli → karşılıksızı Geri Al reddedilir; hesap etkinleşince yeniden tahsilde", async () => {
    const { api, store } = t.ctx;
    const z = await openAccount(api, { bankName: "Halkbank", name: "D3 Hesabı", kind: "demand", currency: "TRY", opening: { date: "2026-10-01", amount: "0", confirmed: true } });
    const a = await receive(api, { serialNo: "D3-A", accountId: t.buyer.id, amount: "400" });
    await must("ver", act(api, a.id, { action: "bank-deposit", date: "2026-10-06", bankAccountId: z.id }));
    await must("karşılıksız", act(api, a.id, { action: "bounce", date: "2026-10-07" }));
    await must("pasife al", api.post(`${BANK}/accounts/${z.id}/status`, { status: "passive" }));
    const undo = await api.post(`${CHEQUES}/${a.id}/undo`, {});
    expectStatus(undo, 400, "bank-account-invalid", "pasif hesapta karşılıksızı geri al");
    assert.equal(store.get("SELECT status FROM cheque_collections WHERE cheque_id = ?", a.id).status, "returned", "kayıt kapalı kalır");
    await must("etkinleştir", api.post(`${BANK}/accounts/${z.id}/status`, { status: "active" }));
    await must("geri al", api.post(`${CHEQUES}/${a.id}/undo`, {}));
    assert.equal(store.get("SELECT status FROM cheque_collections WHERE cheque_id = ?", a.id).status, "pending");
    // Vadeli: karşılıksız → tür Vadeli → Geri Al 400.
    const v = await openAccount(api, { bankName: "Vakıf", name: "D3 Vadeli Olacak", kind: "demand", currency: "TRY" });
    const b = await receive(api, { serialNo: "D3-B", accountId: t.buyer.id, amount: "250" });
    await must("ver", act(api, b.id, { action: "bank-deposit", date: "2026-10-08", bankAccountId: v.id }));
    await must("karşılıksız", act(api, b.id, { action: "bounce", date: "2026-10-08" }));
    await must("tür Vadeli", api.put(`${BANK}/accounts/${v.id}`, { kind: "time" }));
    expectStatus(await api.post(`${CHEQUES}/${b.id}/undo`, {}), 400, "bank-account-invalid", "Vadeli hesapta karşılıksızı geri al");
    await integrityOk(api, "D3");
  });

  it("D4: tahsil kaydı geri alınmış evrakın alış tarihi veriliş gününden sonraya alınamaz (409); veriliş günü olur", async () => {
    const { api } = t.ctx;
    const a = await receive(api, { serialNo: "D4-1", accountId: t.buyer.id, amount: "1.000", issueDate: "2026-10-05" });
    await must("ver", act(api, a.id, { action: "bank-deposit", date: "2026-10-06", bankAccountId: t.acc.ziraat.id }));
    await must("geri al", act(api, a.id, { action: "bank-withdraw", date: "2026-10-07" }));
    expectStatus(await api.put(`${CHEQUES}/${a.id}`, { issueDate: "2026-10-08" }), 409, "date-after-deposit", "alış tarihi tahsile vermeden sonra");
    await must("alış tarihi veriliş günü", api.put(`${CHEQUES}/${a.id}`, { issueDate: "2026-10-06" }));
    await must("tutar değişir", api.put(`${CHEQUES}/${a.id}`, { amount: "1.500" }));
    const subs = await must("alt hesap", api.get(`${BANK}/sub-trial?to=2026-10-06`));
    const at = Object.fromEntries(subs.rows.map(row => [row.sub, row.balance]));
    assert.ok((at["101.01"] ?? 0) >= 0, `06.10'da 101.01 eksi değil: ${JSON.stringify(at)}`);
    await integrityOk(api, "D4");
  });
});

// D1/D2 — gerçek v2.1.0 koduna dönüş (git etiketi; sığ klonda atlanır). Kurulum bu dalda: alış 03.10, Ziraat'e tahsile verme 06.10; eski sürümde
// bir işlem; bu dal yeniden açılınca açılış onarımı (h).
const OLD = "v2.1.0";
async function oldVersion(name, oldStep) {
  const root = mkdtempSync(path.join(tmpdir(), `tahsile-dogrulama-${name}-`));
  const dataDir = path.join(root, "data");
  const backupDir = path.join(root, "backups");
  try {
    let ids;
    {
      const server = await bootVersion(CURRENT, { dataDir, backupDir, now: "2026-10-08T12:00:00+03:00" });
      try {
        const api = apiOf((await server.login()).client);
        const account = await must("hesap", api.post(`${BANK}/accounts`, { bankName: "Ziraat Bankası", name: "Ana TL Hesabı", kind: "demand", currency: "TRY", opening: { date: "2026-10-01", amount: "1.000", confirmed: true } }));
        const buyer = await must("müşteri", api.post("/api/workspace/accounts", { name: "Eski Müşteri", type: "customer", registeredOn: "2026-09-01" }));
        const seller = await must("tedarikçi", api.post("/api/workspace/accounts", { name: "Eski Tedarikçi", type: "supplier", registeredOn: "2026-09-01" }));
        const cheque = await must("çek", api.post(CHEQUES, { direction: "in", instrument: "cheque", amount: "800", issueDate: "2026-10-03", dueDate: "2026-11-05", accountId: buyer.id, serialNo: `ES-${name}` }));
        await must("tahsile", act(api, cheque.id, { action: "bank-deposit", date: "2026-10-06", bankAccountId: account.id }));
        ids = { cheque: cheque.id, seller: seller.id, account: account.id, buyer: buyer.id };
      } finally {
        await server.close();
      }
    }
    {
      const old = await bootVersion(OLD, { dataDir, backupDir, now: "2026-10-09T12:00:00+03:00" });
      try {
        const res = await oldStep(apiOf((await old.login()).client), ids);
        assert.equal(res.status, 200, `eski sürüm adımı: ${res.status} ${JSON.stringify(res.data).slice(0, 300)}`);
      } finally {
        await old.close();
      }
    }
    const server = await bootVersion(CURRENT, { dataDir, backupDir, now: "2026-10-09T12:00:00+03:00" });
    try {
      const api = apiOf((await server.login()).client);
      const record = server.app.store.get("SELECT status, given_date AS given, closed_date AS closed FROM cheque_collections WHERE cheque_id = ?", ids.cheque);
      const result = await integrityOf(api);
      assert.equal(result.ok, true, `${name}: onarım sonrası Mutabakat ${JSON.stringify(result.checks.filter(item => !item.ok).map(item => [item.code, item.sample]))}`);
      if (record.closed) assert.ok(record.closed >= record.given, `${name}: kapanış ${record.closed} ≥ veriliş ${record.given}`);
      // Kullanıcı çalışmayı sürdürür: yeni çek → tahsile ver → tahsil; Mutabakat yine tamam.
      const cheque = await must("yeni çek", api.post(CHEQUES, { direction: "in", instrument: "cheque", amount: "300", issueDate: "2026-10-09", dueDate: "2026-11-09", accountId: ids.buyer, serialNo: `YENI-${name}` }));
      await must("yeni tahsile", act(api, cheque.id, { action: "bank-deposit", date: "2026-10-09", bankAccountId: ids.account }));
      await must("yeni tahsil", act(api, cheque.id, { action: "collect", date: "2026-10-09" }));
      await integrityOk(api, `${name}: sonra yazım`);
      return { record };
    } finally {
      await server.close();
    }
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
}
describe(`D1/D2 — ${OLD}'a dönüp tahsildeki evraka dokunma; bu dalda açılış onarımı (h)`, { skip: tagsAvailable([OLD]) ? false : `${OLD} etiketi yok` }, () => {
  it("D1 silme (statusDate alış günü 03.10 < veriliş 06.10): kapanış veriliş gününe; Mutabakat tamam", { timeout: 300_000 }, async () => {
    const { record } = await oldVersion("sil", (api, ids) => api.del(`${CHEQUES}/${ids.cheque}`));
    assert.deepEqual([record.status, record.closed], ["withdrawn", "2026-10-06"]);
  });
  it("D1 veriliş gününden önceki tarihle ciro ve tahsil: kapanış veriliş gününe; Mutabakat tamam", { timeout: 300_000 }, async () => {
    const endorsed = await oldVersion("ciro", (api, ids) => act(api, ids.cheque, { action: "endorse", date: "2026-10-05", accountId: ids.seller }));
    assert.deepEqual([endorsed.record.status, endorsed.record.closed], ["withdrawn", "2026-10-06"]);
    const collected = await oldVersion("tahsil", (api, ids) => act(api, ids.cheque, { action: "collect", date: "2026-10-05", method: "bank", bankAccountId: ids.account }));
    assert.deepEqual([collected.record.status, collected.record.closed], ["collected", "2026-10-06"]);
  });
  it("D2 tahsildeki evrakın tutarı 800 → 950 ve alış tarihi 08.10'a: verilme başlığı onarılır; Mutabakat tamam", { timeout: 300_000 }, async () => {
    const amount = await oldVersion("tutar", (api, ids) => api.put(`${CHEQUES}/${ids.cheque}`, { amount: "950" }));
    assert.equal(amount.record.status, "pending");
    const dated = await oldVersion("tarih", (api, ids) => api.put(`${CHEQUES}/${ids.cheque}`, { issueDate: "2026-10-08" }));
    assert.deepEqual([dated.record.status, dated.record.given], ["pending", "2026-10-08"]);
  });
});
