// 2.2.0 — Bankaya Tahsile Ver / Bankadan Geri Al (docs/BANKA-MODULU-PLAN.md §3.14, §3.6, §3.7 #21, §3.11 cheque:collections, §5.5, §7, §10.6 h).
// Kullanıcı (12.10.2026): "konuştuğumuz müşteri taleplerindeki önerilerini de uygula" — Bankaya Tahsile Ver bu sürümde; SENET de bankaya tahsile
// verilir (plan "alınan çek" der; senede aynı kural, karar raporda).
//
// Sahte saat 08.10.2026 Perşembe. Ziraat Bankası · Ana TL Hesabı (açılış 01.10.2026, 100.000), Garanti BBVA · Ana TL Hesabı (50.000).
//
// ÇALIŞIYOR MU (sayılarla, bağımsız beklenen = planın yevmiyesi):
//   - Tahsile Ver: 101 toplamı değişmez; 101.02 = evrak, 101.01 = 0; banka bakiyesi değişmez; cheques.status "portfolio" kalır; cheque_events'e
//     satır yazılmaz; cheque_collections (pending) + fin_events (cheque_deposit, para satırı yok); kartta ve listede "Bankada Tahsilde · <banka> · <gün>"
//   - Tahsil Edildi: yol bank, hesap tahsil kaydının hesabı (ön seçili; başka hesap ve nakit 400); 102.x +tutar, 101.02 = 0; kayıt collected
//   - Geri Al (tahsil) → kayıt yeniden bekleyen; Bankadan Geri Al → 101.01'e döner; Karşılıksız (bankadan dönen) → kayıt returned, cari yeniden borçlu
//   - Senet aynı kural; taksite sayılmış çek (karşılıksızda taksit tahsilatı kalkar) 101.01/101.02 sıfır
//   - Nakit Akış ve Vade Takip: tahsildeki evrak vade + hesabın iş günü takvimiyle (Cumartesi vadeli → Pazartesi; 29 Ekim → 30 Ekim)
//   - Yevmiye ve Alt Hesap Mizanı: B 101.02 / A 101.01 (verilme), B 101.01 / A 101.02 (geri alma, karşılıksız), B 102.x / A 101.02 (tahsil)
//   - İstek kimliği: aynı kimlik aynı gövde → yeniden yazılmaz (replayed); farklı gövde 409 request-id-reused
// NASIL BOZARIM:
//   portföyde olmayan (tahsil edilmiş, ciro edilmiş, karşılıksız) · verilen çek · tahsildeyken ciro / sil / tutar / tarih / vade / cari değiştir ·
//   faturayla ciro · faturası iptal edilen tahsildeki evrak · tarih alıştan önce · ileri tarih · geçersiz tarih · kilitli dönem · başka hesaba tahsil ·
//   nakit tahsil · pasif hesap · vadeli/kart/kredi hesabı · döviz hesabı · hesap yok · çok hesapta seçimsiz · iki kez tahsile ver · aynı anda iki
//   istek · istek kimliği tekrarı · yetkisiz personel · ?hofCompany= başka şirket (403/404) · sil → geri yükle · tahsildeki çekin hesabını pasife
//   alma/silme/türünü değiştirme · Şirket Verisini Sıfırla · ham SQL ile bozulan kayıt (kapı yakalar) · eski sürüm verisi (gerçek 2.0.26 kodunun
//   fikstürü) · eski sürüme dönüp tahsildeki çeki ciro etme (gerçek v2.1.0 kodu → açılış onarımı h).
import assert from "node:assert/strict";
import { after, before, describe, it } from "node:test";
import { subBalances as journalSubs } from "../server/lib/general-ledger.mjs";
import { createUser } from "./helpers.mjs";
import { apiOf, integrityOf, integrityOk, rawRun } from "./banka-210-ortak.mjs";
import { BANK, TODAY, bootBank, expectStatus, lockPeriod, must, openAcceptanceAccounts, openAccount, trialBalances } from "./banka-210-hesap-ortak.mjs";
import { ADMIN_PASSWORD } from "./helpers.mjs";
import { fixtureExists, unpackFixture } from "./guvenilirlik/fikstur.mjs";
import { CURRENT, bootVersion, tagsAvailable } from "./guvenilirlik/surumler.mjs";

const CHEQUES = "/api/workspace/cheques";
const act = (api, id, body) => api.post(`${CHEQUES}/${id}/actions`, body);
const detailOf = (api, id) => must("çek kartı", api.get(`${CHEQUES}/${id}`));
const count = (store, table, where = "1") => Number(store.get(`SELECT COUNT(*) AS n FROM ${table} WHERE ${where}`).n);
const TABLES = ["cheques", "cheque_events", "cheque_collections", "fin_events", "account_entries", "plan_entries", "cash_entries", "audit_events"];
const snapshot = store => Object.fromEntries(TABLES.map(table => [table, count(store, table)]));
/** Yevmiyedeki 101 alt hesapları (kuruş): Ana Defter'in kendi kuralıyla (app.ledger.build). */
const chequeSubs = ctx => {
  const subs = journalSubs(ctx.app.ledger.build());
  return { portfolio: subs.get("101.01") || 0, bank: subs.get("101.02") || 0 };
};
const minorOf = async (api, account) => Number((await must("hesap", api.get(`${BANK}/accounts/${account.id}`))).balanceMinor);
const checkOf = (result, code) => result.checks.find(item => item.code === code);
const receive = (api, body) => must(`çek al ${body.serialNo || ""}`, api.post(CHEQUES, { direction: "in", instrument: "cheque", amount: "1.000", issueDate: "2026-10-05", dueDate: "2026-10-31", ...body }));

async function setup(options = {}) {
  const ctx = await bootBank(options);
  const acc = await openAcceptanceAccounts(ctx.api);
  const buyer = await must("müşteri", ctx.api.post("/api/workspace/accounts", { name: "ABC Ltd.", type: "customer", registeredOn: "2026-09-01" }));
  const seller = await must("tedarikçi", ctx.api.post("/api/workspace/accounts", { name: "XYZ Tedarik", type: "supplier", registeredOn: "2026-09-01" }));
  return { ctx, acc, buyer, seller };
}

describe("Bankaya Tahsile Ver — çalışıyor mu (sayılarla)", () => {
  let ctx;
  let acc;
  let buyer;
  let seller;
  let cheque;
  before(async () => {
    ({ ctx, acc, buyer, seller } = await setup());
    cheque = await receive(ctx.api, { serialNo: "TV-100", accountId: buyer.id, bank: "Akbank Kadıköy" });
  });
  after(() => ctx.server.close());

  it("Tahsile Ver: 101 değişmez, 101.02 = 1.000, 101.01 = 0; banka bakiyesi aynı; cheque_events'e satır yazılmaz; durum portföyde kalır", async () => {
    assert.equal((await trialBalances(ctx.api))["101"], 1000, "önce 101 = 1.000");
    assert.deepEqual(chequeSubs(ctx), { portfolio: 100000, bank: 0 }, "önce 101.01 = 1.000");
    const events = count(ctx.store, "cheque_events", `cheque_id = '${cheque.id}'`);
    const ziraat = await minorOf(ctx.api, acc.ziraat);
    const data = await must("tahsile ver", act(ctx.api, cheque.id, { action: "bank-deposit", date: "2026-10-08", bankAccountId: acc.ziraat.id, status: "portfolio" }));
    assert.equal(data.status, "portfolio", "cheques.status değişmez");
    assert.equal(data.deposited, true);
    assert.equal(data.statusLabel, "Bankada Tahsilde · Ziraat Bankası · 08.10.2026");
    assert.equal(data.collection?.bankAccountId, acc.ziraat.id);
    assert.equal(data.collection?.givenDate, "2026-10-08");
    assert.match(data.collection?.eventNo || "", /^BNK-2026-\d{6}$/);
    assert.deepEqual((data.bankActions || []).map(item => item.key), ["bank-withdraw"]);
    assert.ok(!data.actions.some(item => item.key === "endorse"), "tahsildeki çekte Ciro Et yok");
    assert.deepEqual(data.actions.map(item => item.key).sort(), ["bounce", "collect"]);
    assert.equal(data.canDelete, false);
    assert.equal(data.canEditCore, false);
    assert.equal(count(ctx.store, "cheque_events", `cheque_id = '${cheque.id}'`), events, "cheque_events'e satır yazılmaz");
    assert.equal(count(ctx.store, "cheque_collections", `cheque_id = '${cheque.id}' AND status = 'pending'`), 1);
    const event = ctx.store.get("SELECT * FROM fin_events WHERE type = 'cheque_deposit' AND cheque_id = ?", cheque.id);
    assert.ok(event, "fin_events cheque_deposit");
    assert.deepEqual([event.status, event.bank_ref, event.src_table, Number(event.try_minor), event.party_id], ["active", acc.ziraat.id, "cheque_collections", 100000, buyer.id]);
    assert.equal(count(ctx.store, "bank_lines", `event_id = '${event.id}'`), 0, "para satırı yok");
    assert.equal((await trialBalances(ctx.api))["101"], 1000, "101 toplamı değişmez");
    assert.deepEqual(chequeSubs(ctx), { portfolio: 0, bank: 100000 }, "101.02 = 1.000, 101.01 = 0");
    assert.equal(await minorOf(ctx.api, acc.ziraat), ziraat, "banka bakiyesi değişmez");
    const result = await integrityOk(ctx.api, "tahsile ver");
    assert.equal(checkOf(result, "cheque:collections")?.ok, true, "Mutabakat Testi'nde Tahsildeki Çekler denetimi");
    // Bankaya Tahsile Ver İşlem Kartı (İşlem No ile) açılır; Hareketler listesinde para hareketi olarak görünmez.
    const card = await must("İşlem Kartı", ctx.api.get(`${BANK}/events/${event.no}`));
    assert.equal(card.event?.type || card.type, "cheque_deposit");
  });

  it("liste: Bankada Tahsilde süzgeci ayrı; Portföyde süzgecinde yok; özet; Alt Hesap Mizanı 101.01 / 101.02", async () => {
    const other = await receive(ctx.api, { serialNo: "TV-101", accountId: buyer.id, amount: "400" });
    const list = async status => (await must(`liste ${status}`, ctx.api.get(`${CHEQUES}?status=${status}`))).cheques.map(row => row.id);
    assert.deepEqual(await list("deposited"), [cheque.id]);
    assert.deepEqual(await list("portfolio"), [other.id], "Portföyde süzgeci tahsildeki çeki içermez");
    assert.ok((await list("open")).includes(cheque.id) && (await list("open")).includes(other.id));
    const all = await must("liste", ctx.api.get(CHEQUES));
    const row = all.cheques.find(item => item.id === cheque.id);
    assert.equal(row.statusLabel, "Bankada Tahsilde · Ziraat Bankası · 08.10.2026");
    assert.equal(row.deposited, true);
    assert.deepEqual(all.summary.deposited, { count: 1, amount: 1000 });
    // Doğrulama tur 2 "ozet" (plan §3.14 "Portföyde ile Bankada Tahsilde ayrı"; bilerek güncellendi): "Portföyde (alınan)" tahsildekini içermez —
    // pencere, PDF ve Çek / Senet Portföyü raporu aynı; 101 toplamı = in.open + deposited.
    assert.deepEqual(all.summary.in.open, { count: 1, amount: 400 }, "Portföyde (alınan) tahsildekini saymaz");
    const subs = Object.fromEntries((await must("alt hesap", ctx.api.get(`${BANK}/sub-trial`))).rows.map(item => [item.sub, item]));
    assert.equal(subs["101.02"]?.balance, 1000);
    assert.equal(subs["101.01"]?.balance, 400);
    assert.match(subs["101.02"]?.name || "", /Tahsile/);
    // Ciroya açık portföy (alış faturası "Portföyden Ciro Et") tahsildekini göstermez.
    const portfolio = await must("ciro portföyü", ctx.api.get("/api/workspace/invoices/portfolio"));
    assert.ok(!portfolio.cheques.some(item => item.id === cheque.id) && portfolio.cheques.some(item => item.id === other.id));
    await must("sil", ctx.api.del(`${CHEQUES}/${other.id}`));
  });

  it("Nakit Akış ve Vade Takip: tahsildeki evrak vade + iş günü (31.10 Cumartesi → 02.11), portföydeki vadesinde (31.10)", async () => {
    const plain = await receive(ctx.api, { serialNo: "TV-102", accountId: buyer.id, amount: "250" });
    const flows = await must("nakit akış", ctx.api.get("/api/workspace/overview/nakit-akisi?from=2026-10-08&to=2026-11-30"));
    const at = id => flows.rows.filter(item => item.ref?.type === "cheque" && item.ref?.id === id).map(item => item.date);
    assert.deepEqual(at(cheque.id), ["2026-11-02"], "tahsildeki çek: Cumartesi vadesi → Pazartesi");
    assert.deepEqual(at(plain.id), ["2026-10-31"], "portföydeki çek vadesinde");
    assert.match(flows.rows.find(item => item.ref?.id === cheque.id).label, /Bankada Tahsilde · Ziraat Bankası/);
    const vade = await must("vade takip", ctx.api.get("/api/workspace/overview/vade-takip?from=2026-10-08&to=2026-11-30"));
    assert.deepEqual(vade.rows.filter(item => item.ref?.id === cheque.id).map(item => item.date), ["2026-11-02"]);
    await must("sil", ctx.api.del(`${CHEQUES}/${plain.id}`));
  });

  it("Tahsil Edildi: başka hesap ve nakit 400 (hiçbir şey yazılmaz); kayıtlı hesaba 102.01 +1.000, 101.02 = 0; Geri Al → yeniden tahsilde", async () => {
    const before_ = snapshot(ctx.store);
    expectStatus(await act(ctx.api, cheque.id, { action: "collect", date: TODAY, method: "bank", bankAccountId: acc.garanti.id }), 400, "cheque-deposited-account", "başka hesaba tahsil");
    expectStatus(await act(ctx.api, cheque.id, { action: "collect", date: TODAY, method: "cash" }), 400, "cheque-deposited-method", "nakit tahsil");
    expectStatus(await act(ctx.api, cheque.id, { action: "collect", date: "2026-10-07", method: "bank" }), 400, "date-before-deposit", "verilmeden önce tahsil");
    assert.deepEqual(snapshot(ctx.store), before_, "reddedilen istekler hiçbir şey yazmadı");
    const ziraat = await minorOf(ctx.api, acc.ziraat);
    const data = await must("tahsil", act(ctx.api, cheque.id, { action: "collect", date: TODAY }));
    assert.equal(data.status, "collected");
    assert.equal(data.deposited, false);
    assert.equal(await minorOf(ctx.api, acc.ziraat), ziraat + 100000, "Ziraat +1.000");
    const record = ctx.store.get("SELECT * FROM cheque_collections WHERE cheque_id = ? ORDER BY rowid DESC LIMIT 1", cheque.id);
    const collect = ctx.store.get("SELECT event_id, fin_ref, method FROM cheque_events WHERE cheque_id = ? AND kind = 'collect'", cheque.id);
    assert.deepEqual([record.status, record.closed_date, record.close_event_id], ["collected", TODAY, collect.event_id]);
    assert.deepEqual([collect.method, collect.fin_ref], ["bank", acc.ziraat.id]);
    assert.deepEqual(chequeSubs(ctx), { portfolio: 0, bank: 0 });
    assert.equal((await trialBalances(ctx.api))["101"], 0);
    const entry = ctx.app.ledger.build().find(item => item.id === `cheque:${ctx.store.get("SELECT id FROM cheque_events WHERE cheque_id = ? AND kind = 'collect'", cheque.id).id}`);
    assert.deepEqual(entry.lines.map(line => [line.account, line.sub || "", line.debit, line.credit]), [["102", acc.ziraat.glSub, 100000, 0], ["101", "101.02", 0, 100000]], "B 102.01 / A 101.02");
    await integrityOk(ctx.api, "tahsil");
    const undone = await must("geri al", ctx.api.post(`${CHEQUES}/${cheque.id}/undo`, {}));
    assert.equal(undone.deposited, true, "tahsil geri alınınca evrak yeniden bankada tahsilde");
    assert.deepEqual([...Object.values(ctx.store.get("SELECT status, closed_date, close_event_id FROM cheque_collections WHERE id = ?", record.id))], ["pending", "", ""]);
    assert.equal(await minorOf(ctx.api, acc.ziraat), ziraat);
    assert.deepEqual(chequeSubs(ctx), { portfolio: 0, bank: 100000 });
    await integrityOk(ctx.api, "tahsil geri al");
  });

  it("Bankadan Geri Al → 101.01; yeniden Garanti'ye; Karşılıksız (bankadan dönen) → kayıt returned, cari borçlu; Geri Al → yeniden tahsilde", async () => {
    expectStatus(await act(ctx.api, cheque.id, { action: "bank-withdraw", date: "2026-10-07" }), 400, "date-before-deposit", "verilmeden önce geri al");
    const data = await must("bankadan geri al", act(ctx.api, cheque.id, { action: "bank-withdraw", date: TODAY, note: "yanlış banka" }));
    assert.equal(data.deposited, false);
    assert.equal(data.statusLabel, "Portföyde");
    assert.deepEqual((data.bankActions || []).map(item => item.key), ["bank-deposit"]);
    assert.ok(data.actions.some(item => item.key === "endorse"), "geri alınınca ciro açılır");
    const withdraw = ctx.store.get("SELECT * FROM fin_events WHERE type = 'cheque_withdraw' AND cheque_id = ?", cheque.id);
    assert.ok(withdraw && withdraw.status === "active");
    assert.equal(ctx.store.get("SELECT status FROM cheque_collections WHERE close_event_id = ?", withdraw.id)?.status, "withdrawn");
    assert.deepEqual(chequeSubs(ctx), { portfolio: 100000, bank: 0 }, "101.01'e döner");
    expectStatus(await act(ctx.api, cheque.id, { action: "bank-withdraw", date: TODAY }), 409, "cheque-not-deposited", "tahsilde olmayanı geri al");
    const again = await must("Garanti'ye", act(ctx.api, cheque.id, { action: "bank-deposit", date: TODAY, bankAccountId: acc.garanti.id }));
    assert.equal(again.statusLabel, "Bankada Tahsilde · Garanti BBVA · 08.10.2026");
    assert.equal(count(ctx.store, "cheque_collections", `cheque_id = '${cheque.id}'`), 2, "her verme ayrı kayıt");
    const debt = Number((await must("cari", ctx.api.get(`/api/workspace/accounts/${buyer.id}`))).totals.balance);
    const bounced = await must("karşılıksız", act(ctx.api, cheque.id, { action: "bounce", date: TODAY, note: "banka iade etti" }));
    assert.equal(bounced.status, "bounced");
    assert.equal(bounced.deposited, false);
    const record = ctx.store.get("SELECT * FROM cheque_collections WHERE cheque_id = ? ORDER BY rowid DESC LIMIT 1", cheque.id);
    assert.equal(record.status, "returned");
    assert.equal(ctx.store.get("SELECT type FROM fin_events WHERE id = ?", record.close_event_id)?.type, "cheque_withdraw", "kapanış işlem başlığı");
    assert.equal(Number((await must("cari", ctx.api.get(`/api/workspace/accounts/${buyer.id}`))).totals.balance), debt + 1000, "müşteri yeniden borçlu");
    assert.deepEqual(chequeSubs(ctx), { portfolio: 0, bank: 0 });
    await integrityOk(ctx.api, "karşılıksız");
    const undone = await must("karşılıksızı geri al", ctx.api.post(`${CHEQUES}/${cheque.id}/undo`, {}));
    assert.equal(undone.deposited, true);
    assert.equal(ctx.store.get("SELECT status FROM cheque_collections WHERE id = ?", record.id).status, "pending");
    assert.equal(ctx.store.get("SELECT status FROM fin_events WHERE id = ?", record.close_event_id).status, "cancelled", "kapanış başlığı iptal");
    assert.deepEqual(chequeSubs(ctx), { portfolio: 0, bank: 100000 });
    await integrityOk(ctx.api, "karşılıksız geri al");
    await must("geri al", act(ctx.api, cheque.id, { action: "bank-withdraw", date: TODAY }));
  });

  it("Senet de bankaya tahsile verilir; taksite sayılmış çek karşılıksız olunca 101.01 / 101.02 sıfır", async () => {
    const note = await receive(ctx.api, { instrument: "note", serialNo: "SN-1", accountId: buyer.id, amount: "600" });
    const data = await must("senet tahsile", act(ctx.api, note.id, { action: "bank-deposit", date: TODAY, bankAccountId: acc.ziraat.id }));
    assert.equal(data.statusLabel, "Bankada Tahsilde · Ziraat Bankası · 08.10.2026");
    const ziraat = await minorOf(ctx.api, acc.ziraat);
    await must("senet tahsil", act(ctx.api, note.id, { action: "collect", date: TODAY }));
    assert.equal(await minorOf(ctx.api, acc.ziraat), ziraat + 60000);
    const plan = await must("taksit kartı", ctx.api.post("/api/workspace/plans", { name: "ABC Taksit", accountId: buyer.id, total: "900", mode: "auto", count: 1, firstDue: "2026-11-08", registeredOn: "2026-10-01" }));
    const planned = await receive(ctx.api, { serialNo: "TK-1", accountId: buyer.id, planId: plan.id, amount: "900" });
    await must("taksitli çek tahsile", act(ctx.api, planned.id, { action: "bank-deposit", date: TODAY, bankAccountId: acc.ziraat.id }));
    const subs = chequeSubs(ctx);
    assert.equal(subs.bank, 90000);
    await must("karşılıksız", act(ctx.api, planned.id, { action: "bounce", date: TODAY }));
    // Doğrulama T11 (bilerek güncellendi): taksite sayılan tahsilat SİLİNMEZ; karşılıksız günü çekli ters kayıt yazılır (alış günü maddesi değişmez).
    assert.deepEqual(ctx.store.all(`SELECT kind FROM plan_entries WHERE cheque_id = ? ORDER BY kind`, planned.id).map(row => row.kind), ["in", "out"], "tahsilat + karşılıksız ters kaydı");
    assert.deepEqual(chequeSubs(ctx), { portfolio: subs.portfolio, bank: 0 });
    await integrityOk(ctx.api, "taksitli çek karşılıksız");
  });

  it("istek kimliği: aynı kimlik ve gövde → yeniden yazılmaz (replayed); farklı gövde → 409 request-id-reused", async () => {
    const fresh = await receive(ctx.api, { serialNo: "TV-RQ", accountId: buyer.id, amount: "300" });
    const id = "tahsile-ver-istek-000001";
    const body = { action: "bank-deposit", date: TODAY, bankAccountId: acc.ziraat.id };
    const first = await ctx.api.client.post(`${CHEQUES}/${fresh.id}/actions`, body, { "x-hof-request": id });
    assert.equal(first.status, 200);
    const n = snapshot(ctx.store);
    const second = await ctx.api.client.post(`${CHEQUES}/${fresh.id}/actions`, body, { "x-hof-request": id });
    assert.equal(second.status, 200);
    assert.equal(second.data.data.replayed, true);
    assert.deepEqual(snapshot(ctx.store), n, "ikinci gönderim hiçbir şey yazmadı");
    const third = await ctx.api.client.post(`${CHEQUES}/${fresh.id}/actions`, { ...body, bankAccountId: acc.garanti.id }, { "x-hof-request": id });
    assert.equal(third.status, 409);
    assert.equal(third.data.code, "request-id-reused");
    assert.deepEqual(snapshot(ctx.store), n);
    await integrityOk(ctx.api, "istek kimliği");
    void seller;
  });
});

describe("Bankaya Tahsile Ver — nasıl bozarım", () => {
  let ctx;
  let acc;
  let buyer;
  let seller;
  before(async () => {
    ({ ctx, acc, buyer, seller } = await setup());
  });
  after(() => ctx.server.close());

  it("portföyde olmayan (tahsil edilmiş, ciro edilmiş, karşılıksız) ve verilen çek 409; hiçbir şey yazılmaz", async () => {
    const collected = await receive(ctx.api, { serialNo: "B-1", accountId: buyer.id });
    await must("tahsil", act(ctx.api, collected.id, { action: "collect", date: TODAY, method: "cash" }));
    const endorsed = await receive(ctx.api, { serialNo: "B-2", accountId: buyer.id });
    await must("ciro", act(ctx.api, endorsed.id, { action: "endorse", date: TODAY, accountId: seller.id }));
    const bounced = await receive(ctx.api, { serialNo: "B-3", accountId: buyer.id });
    await must("karşılıksız", act(ctx.api, bounced.id, { action: "bounce", date: TODAY }));
    const given = await must("verilen", ctx.api.post(CHEQUES, { direction: "out", instrument: "cheque", amount: "500", issueDate: "2026-10-05", dueDate: "2026-11-05", accountId: seller.id, serialNo: "V-1" }));
    const before_ = snapshot(ctx.store);
    for (const [cheque, label] of [[collected, "tahsil edilmiş"], [endorsed, "ciro edilmiş"], [bounced, "karşılıksız"], [given, "verilen çek"]]) {
      expectStatus(await act(ctx.api, cheque.id, { action: "bank-deposit", date: TODAY, bankAccountId: acc.ziraat.id }), 409, "cheque-not-in-portfolio", label);
    }
    expectStatus(await act(ctx.api, given.id, { action: "bank-withdraw", date: TODAY }), 409, "cheque-not-deposited", "verilen çeki geri al");
    assert.deepEqual(snapshot(ctx.store), before_);
  });

  it("tahsildeyken ciro / sil / tutar / tarih / vade / cari 409 cheque-deposited; açıklama ve seri no düzelir; iki kez tahsile ver 409", async () => {
    const cheque = await receive(ctx.api, { serialNo: "B-10", accountId: buyer.id });
    await must("tahsile", act(ctx.api, cheque.id, { action: "bank-deposit", date: TODAY, bankAccountId: acc.ziraat.id }));
    const before_ = snapshot(ctx.store);
    expectStatus(await act(ctx.api, cheque.id, { action: "endorse", date: TODAY, accountId: seller.id }), 409, "cheque-deposited", "ciro");
    expectStatus(await ctx.api.del(`${CHEQUES}/${cheque.id}`), 409, "cheque-deposited", "sil");
    expectStatus(await ctx.api.put(`${CHEQUES}/${cheque.id}`, { amount: "1.200" }), 409, "cheque-deposited", "tutar");
    expectStatus(await ctx.api.put(`${CHEQUES}/${cheque.id}`, { issueDate: "2026-10-04" }), 409, "cheque-deposited", "alış tarihi");
    expectStatus(await ctx.api.put(`${CHEQUES}/${cheque.id}`, { dueDate: "2026-11-15" }), 409, "cheque-deposited", "vade");
    expectStatus(await ctx.api.put(`${CHEQUES}/${cheque.id}`, { accountId: seller.id }), 409, "cheque-deposited", "cari");
    expectStatus(await act(ctx.api, cheque.id, { action: "bank-deposit", date: TODAY, bankAccountId: acc.garanti.id }), 409, "cheque-deposited", "iki kez");
    assert.deepEqual({ ...snapshot(ctx.store), audit_events: 0 }, { ...before_, audit_events: 0 });
    const edited = await must("açıklama", ctx.api.put(`${CHEQUES}/${cheque.id}`, { note: "bankada", serialNo: "B-10A", amount: "1.000", dueDate: "2026-10-31" }));
    assert.deepEqual([edited.note, edited.serialNo, edited.deposited], ["bankada", "B-10A", true]);
    // Faturayla ciro: alış faturasının ödemesinde tahsildeki çek → 409, fatura yazılmaz.
    const invoices = count(ctx.store, "invoices");
    const res = await ctx.api.post("/api/workspace/invoices", { kind: "purchase", accountId: seller.id, number: "A-1", issueDate: TODAY, pricesIncludeVat: true, lines: [{ name: "Malzeme", qty: 1, unitPrice: 1000, discountRate: 0, vatRate: 0 }], payment: { cash: [], cheques: [], endorse: [cheque.id], rest: "open" }, force: true });
    assert.ok(res.status === 409 && ["cheque-deposited", "cheque-not-in-portfolio"].includes(res.code), `faturayla ciro: ${res.status} ${res.code} ${res.error}`);
    assert.equal(count(ctx.store, "invoices"), invoices, "fatura yazılmadı");
    await integrityOk(ctx.api, "tahsildeki çeke dokunma");
  });

  it("faturayla alınan çek tahsildeyken fatura iptal edilemez (409 cheque-deposited); Bankadan Geri Al sonrası iptal olur", async () => {
    const doc = await must("satış", ctx.api.post("/api/workspace/invoices", { kind: "sale", accountId: buyer.id, issueDate: TODAY, pricesIncludeVat: true, lines: [{ name: "Hizmet", qty: 1, unitPrice: 2000, discountRate: 0, vatRate: 0 }], payment: { cash: [], cheques: [{ instrument: "cheque", amount: "2.000", dueDate: "2026-11-20", serialNo: "F-1", bank: "İş Bankası" }], endorse: [], rest: "open" }, force: true }));
    const chequeId = ctx.store.get("SELECT id FROM cheques WHERE invoice_id = ?", doc.id).id;
    await must("tahsile", act(ctx.api, chequeId, { action: "bank-deposit", date: TODAY, bankAccountId: acc.ziraat.id }));
    expectStatus(await ctx.api.post(`/api/workspace/invoices/${doc.id}/cancel`, { reason: "deneme" }), 409, "cheque-deposited", "iptal");
    assert.equal(ctx.store.get("SELECT status FROM invoices WHERE id = ?", doc.id).status, "issued");
    await must("geri al", act(ctx.api, chequeId, { action: "bank-withdraw", date: TODAY }));
    await must("iptal", ctx.api.post(`/api/workspace/invoices/${doc.id}/cancel`, { reason: "deneme" }));
    await integrityOk(ctx.api, "fatura iptali");
  });

  it("tarih: alıştan önce 400, ileri 400, geçersiz 400, kilitli dönem 409; kilitli ayda verilen çek açık ayda tahsil edilir, geri alınır", async () => {
    const cheque = await receive(ctx.api, { serialNo: "B-20", accountId: buyer.id, issueDate: "2026-10-02" });
    const before_ = snapshot(ctx.store);
    expectStatus(await act(ctx.api, cheque.id, { action: "bank-deposit", date: "2026-10-01", bankAccountId: acc.ziraat.id }), 400, "date-before-receive", "alıştan önce");
    expectStatus(await act(ctx.api, cheque.id, { action: "bank-deposit", date: "2026-10-09", bankAccountId: acc.ziraat.id }), 400, "date-future", "ileri tarih");
    expectStatus(await act(ctx.api, cheque.id, { action: "bank-deposit", date: "2026-02-30", bankAccountId: acc.ziraat.id }), 400, "date-invalid", "geçersiz");
    expectStatus(await act(ctx.api, cheque.id, { action: "bank-deposit", date: "", bankAccountId: acc.ziraat.id }), 400, "date-missing", "boş");
    assert.deepEqual(snapshot(ctx.store), before_);
    await must("tahsile (03.10)", act(ctx.api, cheque.id, { action: "bank-deposit", date: "2026-10-03", bankAccountId: acc.ziraat.id }));
    await lockPeriod(ctx.api, "2026-10-04");
    try {
      const other = await receive(ctx.api, { serialNo: "B-21", accountId: buyer.id, issueDate: "2026-10-06" });
      expectStatus(await act(ctx.api, other.id, { action: "bank-deposit", date: "2026-10-04", bankAccountId: acc.ziraat.id }), 409, "period-locked", "kilitli günde tahsile ver");
      const old = await receive(ctx.api, { serialNo: "B-22", accountId: buyer.id, issueDate: "2026-10-05" });
      await must("sil", ctx.api.del(`${CHEQUES}/${other.id}`));
      expectStatus(await act(ctx.api, cheque.id, { action: "bank-withdraw", date: "2026-10-04" }), 409, "period-locked", "kilitli günde geri al");
      // Kilitli ayda verilen çek açık ayda tahsil edilir (plan §3.14) ve tahsil geri alınabilir.
      await must("tahsil (açık gün)", act(ctx.api, cheque.id, { action: "collect", date: TODAY }));
      await must("geri al", ctx.api.post(`${CHEQUES}/${cheque.id}/undo`, {}));
      await must("bankadan geri al (açık gün)", act(ctx.api, cheque.id, { action: "bank-withdraw", date: TODAY }));
      expectStatus(await act(ctx.api, old.id, { action: "bank-deposit", date: "2026-10-04", bankAccountId: acc.ziraat.id }), 409, "period-locked", "kilitli güne tahsile ver");
      await integrityOk(ctx.api, "kilit");
    } finally {
      await lockPeriod(ctx.api, "");
    }
  });

  it("hesap: başka hesaba tahsil 400; pasif, vadeli, kart, kredi hesabı 400; hesap yok 404; çok hesapta seçimsiz 400; tek hesapta kendiliğinden", async () => {
    const cheque = await receive(ctx.api, { serialNo: "B-30", accountId: buyer.id });
    const time = await openAccount(ctx.api, { bankName: "Ziraat Bankası", name: "Vadeli", kind: "time", currency: "TRY", opening: { date: "2026-10-01", amount: "0", confirmed: true } });
    const card = await openAccount(ctx.api, { bankName: "Garanti BBVA", name: "Kart", kind: "card", currency: "TRY", creditLimit: "10.000", opening: { date: "2026-10-01", amount: "0", confirmed: true } });
    const loan = await openAccount(ctx.api, { bankName: "Garanti BBVA", name: "Kredi", kind: "loan", currency: "TRY", opening: { date: "2026-10-01", amount: "0", confirmed: true } });
    const passive = await openAccount(ctx.api, { bankName: "Akbank", name: "Pasif", kind: "commercial", currency: "TRY", opening: { date: "2026-10-01", amount: "0", confirmed: true } });
    await must("pasife al", ctx.api.post(`${BANK}/accounts/${passive.id}/status`, { status: "passive" }));
    const before_ = snapshot(ctx.store);
    for (const [account, label] of [[time, "vadeli"], [card, "kart"], [loan, "kredi"], [passive, "pasif"]]) expectStatus(await act(ctx.api, cheque.id, { action: "bank-deposit", date: TODAY, bankAccountId: account.id }), 400, "bank-account-invalid", label);
    expectStatus(await act(ctx.api, cheque.id, { action: "bank-deposit", date: TODAY, bankAccountId: "ba-yok" }), 404, "bank-account-missing", "olmayan hesap");
    expectStatus(await act(ctx.api, cheque.id, { action: "bank-deposit", date: TODAY }), 400, "bank-account-required", "iki uygun hesap, seçim yok");
    assert.deepEqual(snapshot(ctx.store), before_);
    const choices = await detailOf(ctx.api, cheque.id);
    assert.deepEqual(choices.depositAccounts.map(item => item.id).sort(), [acc.ziraat.id, acc.garanti.id].sort(), "yalnız etkin TL Vadesiz/Ticari/Diğer hesaplar");
    // Tek uygun hesap: kendiliğinden seçilir.
    await must("Garanti pasif", ctx.api.post(`${BANK}/accounts/${acc.garanti.id}/status`, { status: "passive" }));
    try {
      const data = await must("tek hesap", act(ctx.api, cheque.id, { action: "bank-deposit", date: TODAY }));
      assert.equal(data.collection.bankAccountId, acc.ziraat.id);
    } finally {
      await must("Garanti etkin", ctx.api.post(`${BANK}/accounts/${acc.garanti.id}/status`, { status: "active" }));
    }
    // Tahsildeki çekin hesabı pasife alınamaz, silinemez, türü değişmez (409 bank-cheques-pending).
    expectStatus(await ctx.api.post(`${BANK}/accounts/${acc.ziraat.id}/status`, { status: "passive" }), 409, "bank-cheques-pending", "pasife al");
    expectStatus(await ctx.api.put(`${BANK}/accounts/${acc.ziraat.id}`, { kind: "commercial" }), 409, null, "tür");
    const empty = await openAccount(ctx.api, { bankName: "Yapı Kredi", name: "Boş", kind: "demand", currency: "TRY", opening: { date: "2026-10-01", amount: "0", confirmed: true } });
    await must("boş hesaba tahsile", act(ctx.api, cheque.id, { action: "bank-withdraw", date: TODAY }));
    await must("boş hesaba tahsile", act(ctx.api, cheque.id, { action: "bank-deposit", date: TODAY, bankAccountId: empty.id }));
    expectStatus(await ctx.api.del(`${BANK}/accounts/${empty.id}`), 409, "bank-cheques-pending", "sil");
    expectStatus(await ctx.api.put(`${BANK}/accounts/${empty.id}`, { kind: "commercial" }), 409, "bank-cheques-pending", "tür (hareketsiz hesap)");
    await must("geri al", act(ctx.api, cheque.id, { action: "bank-withdraw", date: TODAY }));
    await must("boş hesap silinir", ctx.api.del(`${BANK}/accounts/${empty.id}`));
    await integrityOk(ctx.api, "hesap");
  });

  it("aynı anda iki istek: biri 200, öbürü 409; tek bekleyen kayıt", async () => {
    const cheque = await receive(ctx.api, { serialNo: "B-40", accountId: buyer.id });
    const results = await Promise.all([acc.ziraat, acc.garanti].map(account => act(ctx.api, cheque.id, { action: "bank-deposit", date: TODAY, bankAccountId: account.id })));
    assert.deepEqual(results.map(item => item.status).sort(), [200, 409], JSON.stringify(results.map(item => [item.status, item.code])));
    assert.equal(results.find(item => item.status === 409).code, "cheque-deposited");
    assert.equal(count(ctx.store, "cheque_collections", `cheque_id = '${cheque.id}' AND status = 'pending'`), 1);
    // Tahsile ver ile ciro aynı anda: biri geçer.
    const twin = await receive(ctx.api, { serialNo: "B-41", accountId: buyer.id });
    const race = await Promise.all([act(ctx.api, twin.id, { action: "bank-deposit", date: TODAY, bankAccountId: acc.ziraat.id }), act(ctx.api, twin.id, { action: "endorse", date: TODAY, accountId: seller.id })]);
    assert.deepEqual(race.map(item => item.status).sort(), [200, 409], JSON.stringify(race.map(item => [item.status, item.code])));
    await integrityOk(ctx.api, "yarış");
  });

  it("sil → geri yükle: geri alınmış (kapanmış) kaydı olan çek silinir, geri yüklenir, yeniden tahsile verilir", async () => {
    const cheque = await receive(ctx.api, { serialNo: "B-50", accountId: buyer.id });
    await must("tahsile", act(ctx.api, cheque.id, { action: "bank-deposit", date: TODAY, bankAccountId: acc.ziraat.id }));
    await must("geri al", act(ctx.api, cheque.id, { action: "bank-withdraw", date: TODAY }));
    await must("sil", ctx.api.del(`${CHEQUES}/${cheque.id}`));
    await integrityOk(ctx.api, "silindi");
    await must("geri yükle", ctx.api.post("/api/admin/trash/restore", { id: `cheque:${cheque.id}` }));
    await must("yeniden tahsile", act(ctx.api, cheque.id, { action: "bank-deposit", date: TODAY, bankAccountId: acc.garanti.id }));
    assert.deepEqual(chequeSubs(ctx).bank >= 100000, true);
    await integrityOk(ctx.api, "geri yüklendi");
  });

  it("ham SQL ile bozulan kayıt: Mutabakat Testi cheque:collections ile yakalar (kayıt kapatılır / başlık silinir / tutar değişir)", async () => {
    const cheque = await receive(ctx.api, { serialNo: "B-60", accountId: buyer.id, amount: "700" });
    await must("tahsile", act(ctx.api, cheque.id, { action: "bank-deposit", date: TODAY, bankAccountId: acc.ziraat.id }));
    const record = ctx.store.get("SELECT * FROM cheque_collections WHERE cheque_id = ? AND status = 'pending'", cheque.id);
    const failing = async label => {
      const result = await integrityOf(ctx.api);
      assert.equal(checkOf(result, "cheque:collections")?.ok, false, `${label}: ${JSON.stringify(checkOf(result, "cheque:collections"))}`);
    };
    rawRun(ctx.db, "UPDATE cheque_collections SET status = 'withdrawn', closed_date = ? WHERE id = ?", TODAY, record.id);
    await failing("başlıksız kapanış");
    rawRun(ctx.db, "UPDATE cheque_collections SET status = 'pending', closed_date = '' WHERE id = ?", record.id);
    await integrityOk(ctx.api, "düzeldi");
    rawRun(ctx.db, "UPDATE fin_events SET status = 'cancelled' WHERE id = ?", record.event_id);
    await failing("başlığı iptal edilmiş");
    rawRun(ctx.db, "UPDATE fin_events SET status = 'active' WHERE id = ?", record.event_id);
    rawRun(ctx.db, "UPDATE cheques SET amount = 750 WHERE id = ?", cheque.id);
    await failing("tutarı değişmiş tahsildeki çek");
    rawRun(ctx.db, "UPDATE cheques SET amount = 700 WHERE id = ?", cheque.id);
    rawRun(ctx.db, "UPDATE cheques SET status = 'collected' WHERE id = ?", cheque.id);
    await failing("durumu portföy olmayan tahsildeki çek");
    rawRun(ctx.db, "UPDATE cheques SET status = 'portfolio' WHERE id = ?", cheque.id);
    await integrityOk(ctx.api, "son");
  });
});

describe("Bankaya Tahsile Ver — yetki, şirket ayrımı, Şirket Verisini Sıfırla", () => {
  let ctx;
  let acc;
  let buyer;
  before(async () => {
    ({ ctx, acc, buyer } = await setup());
  });
  after(() => ctx.server.close());

  it("yetkisiz personel 403 (yazılmaz); muhasebe yapar; ?hofCompany= başka şirket: yetkisiz 403, başka şirketin hesabı 404", async () => {
    const cheque = await receive(ctx.api, { serialNo: "Y-1", accountId: buyer.id });
    const staff = apiOf(await createUser(ctx.server, ctx.api.client, { username: "personel1", role: "personel" }));
    const before_ = snapshot(ctx.store);
    expectStatus(await act(staff, cheque.id, { action: "bank-deposit", date: TODAY, bankAccountId: acc.ziraat.id }), 403, null, "personel");
    assert.deepEqual({ ...snapshot(ctx.store), audit_events: 0 }, { ...before_, audit_events: 0 });
    const clerk = apiOf(await createUser(ctx.server, ctx.api.client, { username: "muhasebe1", role: "muhasebe" }));
    await must("muhasebe tahsile", act(clerk, cheque.id, { action: "bank-deposit", date: TODAY, bankAccountId: acc.ziraat.id }));
    await must("muhasebe geri al", act(clerk, cheque.id, { action: "bank-withdraw", date: TODAY }));
    const second = await must("002", ctx.api.post("/api/companies", { name: "İkinci Şirket", select: false }));
    const id = second.id || second.company?.id;
    const q = `?hofCompany=${encodeURIComponent(id)}`;
    const users = await must("kullanıcılar", ctx.api.get("/api/admin/users"));
    assert.equal((await ctx.api.client.put(`/api/companies/access/${users.find(user => user.username === "muhasebe1").id}`, { companies: ["sirket-001"] })).status, 200);
    expectStatus(await clerk.post(`${CHEQUES}/${cheque.id}/actions${q}`, { action: "bank-deposit", date: TODAY, bankAccountId: acc.ziraat.id }), 403, null, "yetkisiz şirket");
    const party = await must("002 cari", ctx.api.post(`/api/workspace/accounts${q}`, { name: "002 Müşteri", type: "customer", registeredOn: "2026-09-01" }));
    const other = await must("002 çek", ctx.api.post(`${CHEQUES}${q}`, { direction: "in", instrument: "cheque", amount: "100", issueDate: "2026-10-05", dueDate: "2026-11-05", accountId: party.id, serialNo: "Y-002" }));
    const mine = snapshot(ctx.store);
    expectStatus(await ctx.api.post(`${CHEQUES}/${other.id}/actions${q}`, { action: "bank-deposit", date: TODAY, bankAccountId: acc.ziraat.id }), 404, "bank-account-missing", "002'de 001'in hesabı");
    expectStatus(await ctx.api.post(`${CHEQUES}/${other.id}/actions${q}`, { action: "bank-deposit", date: TODAY }), 400, "bank-account-required", "002'de hesap yok");
    expectStatus(await act(ctx.api, other.id, { action: "bank-deposit", date: TODAY, bankAccountId: acc.ziraat.id }), 404, null, "001'de 002'nin çeki");
    assert.deepEqual(snapshot(ctx.store), mine, "001'in veri tabanı değişmedi");
  });

  it("Şirket Verisini Sıfırla: tahsil kayıtları ve başlıkları silinir, mutabakat temiz, İşlem No geri gitmez", async () => {
    const cheque = await receive(ctx.api, { serialNo: "Y-2", accountId: buyer.id });
    const data = await must("tahsile", act(ctx.api, cheque.id, { action: "bank-deposit", date: TODAY, bankAccountId: acc.ziraat.id }));
    const no = data.collection.eventNo;
    await must("sıfırla", ctx.api.post("/api/companies/sirket-001/reset", { mode: "movements", confirm: "001", password: ADMIN_PASSWORD }));
    assert.equal(count(ctx.store, "cheque_collections"), 0);
    assert.equal(count(ctx.store, "cheques"), 0);
    assert.equal(count(ctx.store, "fin_events", "type IN ('cheque_deposit', 'cheque_withdraw')"), 0);
    await integrityOk(ctx.api, "sıfırlama");
    await must("açılış", ctx.api.post(`${BANK}/accounts/${acc.ziraat.id}/opening`, { date: "2026-10-01", amount: "100.000", confirmed: true }));
    const fresh = await receive(ctx.api, { serialNo: "Y-3", accountId: (await must("cari", ctx.api.post("/api/workspace/accounts", { name: "Yeni Müşteri", type: "customer", registeredOn: "2026-09-01" }))).id });
    const again = await must("yeniden tahsile", act(ctx.api, fresh.id, { action: "bank-deposit", date: TODAY, bankAccountId: acc.ziraat.id }));
    assert.ok(again.collection.eventNo > no, `İşlem No ${again.collection.eventNo} > ${no}`);
    await integrityOk(ctx.api, "sıfırlama sonrası");
  });
});

describe("Bankaya Tahsile Ver — eski sürüm verisi (gerçek 2.0.26 kodunun fikstürü) ve eski sürüme dönüş", () => {
  it("surum-2.0.26-turler: göç sonrası portföydeki eski çek tahsile verilir ve tahsil edilir; eski tahsil edilmiş çek 409; mutabakat temiz", { timeout: 300_000 }, async () => {
    assert.ok(fixtureExists("surum-2.0.26-turler"), "fikstür yok");
    const fixture = unpackFixture("surum-2.0.26-turler");
    const server = await bootVersion(CURRENT, { dataDir: fixture.dataDir, backupDir: fixture.backupDir, maxCompanies: 10, now: "2026-10-15T12:00:00+03:00" });
    try {
      // Ret kodu (res.code) ortak sarmalayıcıyla okunur (sürüm sarmalayıcısı hatayı yalnız data'da taşır).
      const api = apiOf((await server.login()).client);
      assert.equal((await api.post("/api/companies/select", { id: "sirket-001" })).status, 200);
      await integrityOk(api, "göç sonrası");
      const list = (await must("liste", api.get(CHEQUES))).cheques;
      const portfolio = list.find(item => item.direction === "in" && item.status === "portfolio");
      const collected = list.find(item => item.direction === "in" && item.status === "collected");
      assert.ok(portfolio && collected, "eski veride portföyde ve tahsil edilmiş çek");
      const account = await must("hesap", api.post(`${BANK}/accounts`, { bankName: "Ziraat Bankası", name: "Ana TL Hesabı", kind: "demand", currency: "TRY", opening: { date: "2026-10-14", amount: "10.000", confirmed: true } }));
      expectStatus(await api.post(`${CHEQUES}/${collected.id}/actions`, { action: "bank-deposit", date: "2026-10-15", bankAccountId: account.id }), 409, "cheque-not-in-portfolio", "eski tahsil edilmiş");
      const trial = Object.fromEntries((await must("mizan", api.get("/api/workspace/ledger"))).trial.accounts.map(row => [row.code, row.balance]));
      await must("tahsile", api.post(`${CHEQUES}/${portfolio.id}/actions`, { action: "bank-deposit", date: "2026-10-14", bankAccountId: account.id }));
      const after = Object.fromEntries((await must("mizan", api.get("/api/workspace/ledger"))).trial.accounts.map(row => [row.code, row.balance]));
      assert.equal(after["101"], trial["101"], "101 değişmez");
      const subs = Object.fromEntries((await must("alt hesap", api.get(`${BANK}/sub-trial`))).rows.map(row => [row.sub, row.balance]));
      assert.equal(subs["101.02"], portfolio.amount);
      assert.equal(Math.round((subs["101.01"] + subs["101.02"]) * 100), Math.round(after["101"] * 100), "Σ 101.* = 101");
      await integrityOk(api, "tahsile ver");
      await must("tahsil", api.post(`${CHEQUES}/${portfolio.id}/actions`, { action: "collect", date: "2026-10-15" }));
      assert.equal(Number((await must("hesap", api.get(`${BANK}/accounts/${account.id}`))).balanceMinor), 1_000_000 + Math.round(portfolio.amount * 100));
      await integrityOk(api, "tahsil");
    } finally {
      await server.close();
      fixture.cleanup();
    }
  });

  const version = "v2.1.0";
  const skip = tagsAvailable([version]) ? false : `${version} etiketi yok (git fetch --tags)`;
  it(`${version}'a dönülüp tahsildeki çek ciro edilir → bu dal açılınca kayıt kapanır (onarım h), 101.02 = 0, mutabakat temiz`, { skip, timeout: 300_000 }, async () => {
    const { mkdtempSync, rmSync } = await import("node:fs");
    const { tmpdir } = await import("node:os");
    const path = await import("node:path");
    const root = mkdtempSync(path.join(tmpdir(), "tahsile-ver-eski-"));
    const dataDir = path.join(root, "data");
    const backupDir = path.join(root, "backups");
    try {
      let ids;
      {
        const server = await bootVersion(CURRENT, { dataDir, backupDir, now: "2026-10-08T12:00:00+03:00" });
        try {
          const api = await server.login();
          const account = await must("hesap", api.post(`${BANK}/accounts`, { bankName: "Ziraat Bankası", name: "Ana TL Hesabı", kind: "demand", currency: "TRY", opening: { date: "2026-10-01", amount: "1.000", confirmed: true } }));
          const buyer = await must("müşteri", api.post("/api/workspace/accounts", { name: "Eski Müşteri", type: "customer", registeredOn: "2026-09-01" }));
          const seller = await must("tedarikçi", api.post("/api/workspace/accounts", { name: "Eski Tedarikçi", type: "supplier", registeredOn: "2026-09-01" }));
          const cheque = await must("çek", api.post(CHEQUES, { direction: "in", instrument: "cheque", amount: "800", issueDate: "2026-10-05", dueDate: "2026-11-05", accountId: buyer.id, serialNo: "ES-1" }));
          await must("tahsile", api.post(`${CHEQUES}/${cheque.id}/actions`, { action: "bank-deposit", date: "2026-10-06", bankAccountId: account.id }));
          ids = { cheque: cheque.id, seller: seller.id };
        } finally {
          await server.close();
        }
      }
      {
        const old = await bootVersion(version, { dataDir, backupDir, now: "2026-10-09T12:00:00+03:00" });
        try {
          const api = await old.login();
          await must("eski sürüm ciro", api.post(`${CHEQUES}/${ids.cheque}/actions`, { action: "endorse", date: "2026-10-09", accountId: ids.seller }));
        } finally {
          await old.close();
        }
      }
      const server = await bootVersion(CURRENT, { dataDir, backupDir, now: "2026-10-09T12:00:00+03:00" });
      try {
        const api = await server.login();
        const record = server.app.store.get("SELECT status, closed_date AS closed FROM cheque_collections WHERE cheque_id = ?", ids.cheque);
        assert.deepEqual({ ...record }, { status: "withdrawn", closed: "2026-10-09" });
        const subs = journalSubs(server.app.ledger.build());
        assert.equal(subs.get("101.02") || 0, 0);
        await integrityOk(api, "onarım sonrası");
      } finally {
        await server.close();
      }
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });
});
