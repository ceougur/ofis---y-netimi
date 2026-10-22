// 2.4.4 — E6 (müşteri isteği 19.10.2026): Fatura → Gönderilecekler seçim çubuğunda "Seçilenleri Gönder". Sunucu yolu: POST send-pending { only }.
// KURAL (CLAUDE.md "MÜŞTERİ İSTEKLERİ → 2.4.4" (1)): e-Belge numarası seri + yıl içinde tarih sırasıyla verilir; seçilmemiş DAHA ESKİ tarihli bekleyen belge
// varsa seçilen yenisi numara alamaz → bu gönderimden ÖNCE söylenir ("önce şu tarihli N belge gönderilmeli; onları da ekle / vazgeç"); sessiz atlama ya da
// yarım tur yok; Tümünü Gönder ile AYNI tur (parça + imleç, belge kilidi, sonucu belirsiz önce sorulur). Sahte EDM; ağa çıkmaz; sahte saat (ders 13).
// Nasıl bozulur (testler bu listeden): seçilmemiş eski bekleyen (aynı seri / başka seri / aynı gün / kalıcı engelli / numaralı-belirsiz); ön denetimden
// sonra tur sürerken eski belge kaydedilir; seçimde gönderilemeyen belge (gönderilmiş, iptal, kâğıt); 20'den fazla seçim (parça); iki oturum aynı anda
// (aynı seçim; biri eskiyi öbürü yeniyi); belirsiz gönderim; yetkisiz kullanıcı; boş / çok büyük seçim.
// Eski kodda (163dd5d) { only } bilinmez: istek { ids: [] } sayılır, 200 döner, hiçbir şey söylenmez → testler kırmızı (ders 7; kanıt docs/kanit/2026-10-22/).
import assert from "node:assert/strict";
import { after, describe, test } from "node:test";
import { resetEdmCaches } from "../server/lib/einvoice/edm.mjs";
import { BUYER_VKN, OUR_VKN, startMockEdm } from "./einvoice-mock.mjs";
import { ADMIN_PASSWORD, createUser, startTestServer } from "./helpers.mjs";

const unwrap = response => ({ ...response, data: response.data && typeof response.data === "object" && "ok" in response.data ? (response.data.ok ? response.data.data : response.data) : response.data });
const SELLER = { name: "Deneme Ofis Ltd.", taxNo: OUR_VKN, taxOffice: "Çankaya", address: "Atatürk Blv. 1", district: "Çankaya", city: "Ankara", email: "bilgi@deneme.com.tr" };
const person = (name, taxNo) => ({ name, type: "customer", partyKind: "person", firstName: name.split(" ")[0], familyName: name.split(" ").slice(1).join(" ") || "Kişi", taxNo, taxOffice: "Konak", address: "Kordon 1", district: "Konak", city: "İzmir" });
const LINES = [{ name: "Danışmanlık", qty: 1, unitPrice: 500, vatRate: 20 }];
const SEND = "/api/workspace/invoices/send-pending";
const sleep = ms => new Promise(resolve => setTimeout(resolve, ms));
const seqOf = number => Number(String(number).slice(7));

// Her senaryo kendi sunucusu ve sahte EDM'siyle (seri durumu birbirini etkilemesin).
async function setup({ sendDelayMs = 0 } = {}) {
  resetEdmCaches();
  const edm = await startMockEdm();
  // onSend: gönderim isteği EDM'ye çıkarken (belge numarasını almış, kilidi tutuyor) çağrılır — eşzamanlılık ön koşulunu zorla kurmak için (ders 20).
  const hooks = { onSend: null };
  const fetchImpl = async (input, init) => {
    const url = String(typeof input === "string" || input instanceof URL ? input : input.url);
    if (!url.startsWith("http://127.0.0.1")) throw new Error(`ağa çıkılmaz (test): ${url}`);
    if (/SendInvoiceRequest/.test(String(init?.body || ""))) {
      const hook = hooks.onSend;
      hooks.onSend = null;
      if (hook) await hook();
      if (sendDelayMs) await sleep(sendDelayMs);
    }
    return globalThis.fetch(input, init);
  };
  const server = await startTestServer({ edocEnabled: true, fetchImpl, now: "2026-06-17T09:00:00", edocStatusPollMs: [5, 5], env: { HUKUK_LICENSE_URL: "http://127.0.0.1:9" } });
  const client = server.client();
  const wrap = c => ({ client: c, get: async url => unwrap(await c.get(url)), post: async (url, body) => unwrap(await c.post(url, body)), put: async (url, body) => unwrap(await c.put(url, body)) });
  const api = wrap(client);
  assert.equal((await client.login("admin", ADMIN_PASSWORD)).status, 200);
  assert.equal((await api.put("/api/workspace/invoices/settings", { seller: SELLER, efatura: true, earsiv: true })).status, 200);
  const integrator = baseUrl => api.put("/api/workspace/invoices/settings", { integrator: { env: "test", baseUrl, username: "edmkullanici", password: "Gizli-Parola-1", senderAlias: "urn:mail:defaultgb@deneme.com.tr" } });
  assert.equal((await integrator(edm.url)).status, 200);
  const today = (await api.get("/api/workspace/ledger/lock")).data.today;
  assert.equal(today, "2026-06-17");
  const people = [];
  for (const [name, taxNo] of [["Ayşe Kaya", "10000000146"], ["Mehmet Demir", "12345678950"], ["Zeynep Şahin", "11223344550"]]) {
    const created = await api.post("/api/workspace/accounts", person(name, taxNo));
    assert.equal(created.status, 200, JSON.stringify(created.data));
    people.push(created.data.id);
  }
  const day = offset => {
    const [y, m, d] = today.split("-").map(Number);
    return new Date(Date.UTC(y, m - 1, d + offset)).toISOString().slice(0, 10);
  };
  const sale = async (accountId, extra = {}) => {
    const saved = await api.post("/api/workspace/invoices", { scenario: "service_sale", accountId, lines: LINES, payment: { rest: "open" }, ...extra });
    assert.equal(saved.status, 200, JSON.stringify(saved.data));
    return saved.data;
  };
  const card = async id => (await api.get(`/api/workspace/invoices/${id}`)).data;
  const pendingTab = async () => (await api.get("/api/workspace/invoices?tab=pending")).data;
  const calls = op => edm.state.calls.filter(call => call.op === op).length;
  const sends = () => calls("SendInvoice");
  const sentCount = ettn => edm.state.calls.filter(call => call.op === "SendInvoice" && call.raw.includes(ettn)).length;
  // İstemcinin döngüsü gibi: imleç ilerledikçe ve kalan oldukça yinele (hof-invoices.js runSend).
  const turn = async (body, who = api) => {
    const results = [];
    let last;
    let cursor = null;
    for (let i = 0; i < 100; i += 1) {
      last = await who.post(SEND, cursor ? { ...body, after: cursor } : body);
      if (last.status !== 200) return { ...last, results };
      results.push(...last.data.results);
      const moved = Boolean(last.data.cursor) && JSON.stringify(last.data.cursor) !== JSON.stringify(cursor);
      cursor = last.data.cursor || cursor;
      if (last.data.stopped || !last.data.remaining || !moved) break;
    }
    return { ...last, results };
  };
  const close = async () => {
    await server.close();
    await edm.close();
  };
  return { edm, hooks, server, client, api, wrap, integrator, people, day, sale, card, pendingTab, calls, sends, sentCount, turn, close };
}

describe("2.4.4 E6: Seçilenleri Gönder — ön denetim, aynı tur, kronoloji", () => {
  const open = [];
  after(async () => {
    for (const ctx of open) await ctx.close();
  });

  test("S1: seçilmemiş daha eski bekleyen varken seçilen yeni belge GÖNDERİLMEDEN sorulur (409); hiçbir belge numara almaz, EDM'ye gidilmez", async () => {
    const ctx = await setup();
    open.push(ctx);
    const old = await ctx.sale(ctx.people[0], { issueDate: ctx.day(-3), eSend: "later" });
    const fresh = await ctx.sale(ctx.people[1], { issueDate: ctx.day(0), eSend: "later" });
    const before = { send: ctx.sends(), check: ctx.calls("CheckUser"), login: ctx.calls("Login") };
    const result = await ctx.api.post(SEND, { only: [fresh.id] });
    assert.equal(result.status, 409, `gönderimden önce sorulmalı: ${JSON.stringify(result.data).slice(0, 400)}`);
    assert.equal(result.data.code, "einvoice-selection-older");
    assert.equal(result.data.count, 1);
    assert.deepEqual(result.data.olderIds, [old.id]);
    assert.equal(result.data.older[0].issueDate, ctx.day(-3));
    assert.equal(result.data.older[0].accountName, "Ayşe Kaya");
    assert.equal(result.data.older[0].series, "TEA");
    assert.match(result.data.error, /daha eski tarihli 1 belge Gönderilecekler'de bekliyor/);
    assert.match(result.data.error, /hiçbir belge gönderilmedi/);
    assert.deepEqual({ send: ctx.sends(), check: ctx.calls("CheckUser"), login: ctx.calls("Login") }, before, "entegratöre hiç gidilmedi");
    for (const doc of [old, fresh]) {
      const now = await ctx.card(doc.id);
      assert.equal(now.number, "", "numara verilmedi");
      assert.equal(now.eStatus, "waiting");
      assert.equal(now.eMessage || "", "", "belgeye gönderim hatası yazılmadı");
    }
  });

  test("S2: 'Onları da Ekle' — seçim eski belgelerle genişleyince ikisi de gider; numara sırası = tarih sırası", async () => {
    const ctx = await setup();
    open.push(ctx);
    const old = await ctx.sale(ctx.people[0], { issueDate: ctx.day(-3), eSend: "later" });
    const middle = await ctx.sale(ctx.people[2], { issueDate: ctx.day(-2), eSend: "later" });
    const fresh = await ctx.sale(ctx.people[1], { issueDate: ctx.day(0), eSend: "later" });
    const ask = await ctx.api.post(SEND, { only: [fresh.id] });
    assert.equal(ask.status, 409, JSON.stringify(ask.data).slice(0, 300));
    assert.deepEqual(ask.data.olderIds, [old.id, middle.id], "eskiden yeniye, ikisi de");
    const sent = await ctx.turn({ only: [fresh.id, ...ask.data.olderIds] });
    assert.equal(sent.status, 200, JSON.stringify(sent.data).slice(0, 400));
    assert.equal(sent.results.filter(item => item.ok).length, 3, JSON.stringify(sent.results));
    const cards = await Promise.all([old, middle, fresh].map(doc => ctx.card(doc.id)));
    assert.deepEqual(cards.map(doc => seqOf(doc.number)), [1, 2, 3], `numara tarih sırasında: ${cards.map(doc => doc.number).join(", ")}`);
    for (const doc of cards) assert.equal(ctx.sentCount(doc.ettn), 1, `${doc.number} EDM'ye bir kez`);
  });

  test("S3: ön denetim (check) gönderimsiz — numara yok, entegratöre gidilmez; sayılar: gönderilebilir / kalıcı engelli / Gönderilecekler'de değil (gönderilmiş, iptal, kâğıt, yok) / eski", async () => {
    const ctx = await setup();
    open.push(ctx);
    // Kalıcı engelli seçili belge (seride daha yeni numara verilmiş; eski sürüm verisindeki gibi kurulur — gg243 S1 düzeni).
    const sentToday = await ctx.sale(ctx.people[0], { issueDate: ctx.day(0), eSend: "now" });
    assert.equal(sentToday.autoSend?.ok, true, JSON.stringify(sentToday.autoSend));
    const blocked = await ctx.sale(ctx.people[1], { issueDate: ctx.day(0), eSend: "later" });
    ctx.server.app.store.run("UPDATE invoices SET issue_date = ? WHERE id = ?", ctx.day(-1), blocked.id);
    const fresh = await ctx.sale(ctx.people[2], { issueDate: ctx.day(0), eSend: "later" });
    // İptal edilmiş bekleyen ve kâğıt belge (e-dönüşüm kapalıyken kaydedilen Müşteri Fişi / kâğıt fatura) de seçimde: Gönderilecekler'de değiller.
    const cancelled = await ctx.sale(ctx.people[0], { issueDate: ctx.day(0), eSend: "later" });
    assert.equal((await ctx.api.post(`/api/workspace/invoices/${cancelled.id}/cancel`, { reason: "Deneme" })).status, 200);
    assert.equal((await ctx.api.put("/api/workspace/invoices/settings", { efatura: false, earsiv: false })).status, 200);
    const paper = await ctx.sale(ctx.people[1], { issueDate: ctx.day(0) });
    assert.equal((await ctx.api.put("/api/workspace/invoices/settings", { efatura: true, earsiv: true })).status, 200);
    assert.equal(paper.profile, "KAGIT", "ön koşul: kâğıt belge");
    const extra = [sentToday.id, cancelled.id, paper.id, "yok-boyle-bir-belge"];
    const before = { send: ctx.sends(), check: ctx.calls("CheckUser"), login: ctx.calls("Login"), status: ctx.calls("GetInvoiceStatus") };
    const result = await ctx.api.post(SEND, { only: [fresh.id, blocked.id, ...extra], check: true });
    assert.equal(result.status, 200, JSON.stringify(result.data));
    assert.equal(result.data.check, true);
    assert.equal(result.data.sendable, 1, "yalnız yeni belge gönderilebilir");
    assert.equal(result.data.permanent, 1, "kalıcı engelli seçili belge");
    assert.equal(result.data.notPending, 4, "gönderilmiş + iptal + kâğıt + bulunmayan");
    assert.equal(result.data.count, 0, "kalıcı engelli belge 'eski bekleyen' sayılmaz");
    assert.deepEqual({ send: ctx.sends(), check: ctx.calls("CheckUser"), login: ctx.calls("Login"), status: ctx.calls("GetInvoiceStatus") }, before, "entegratöre hiç gidilmedi");
    assert.equal((await ctx.card(fresh.id)).number, "", "ön denetim numara vermez");
    // Aynı seçim gönderilince: yeni belge gider; kalıcı engelli "bekletildi" sayılmaz; Gönderilecekler'de olmayanlar ayrı nedenle (başka oturumda gönderildi DENMEZ).
    const sent = await ctx.turn({ only: [fresh.id, blocked.id, ...extra] });
    assert.equal(sent.status, 200, JSON.stringify(sent.data));
    const byId = Object.fromEntries(sent.results.map(item => [item.id, item]));
    assert.equal(byId[fresh.id].ok, true, JSON.stringify(byId[fresh.id]));
    assert.equal(byId[blocked.id].permanent, true);
    assert.ok(!byId[blocked.id].skipped);
    for (const id of extra) {
      assert.equal(byId[id].ok, false, JSON.stringify(byId[id]));
      assert.equal(byId[id].code, "einvoice-not-pending");
      assert.equal(byId[id].reason, "not-pending");
      assert.doesNotMatch(byId[id].message, /başka oturumda gönderildi/);
    }
    assert.equal(ctx.sentCount((await ctx.card(sentToday.id)).ettn), 1, "gönderilmiş belge yeniden gitmedi");
    for (const doc of [cancelled, paper]) assert.equal(ctx.sentCount((await ctx.card(doc.id)).ettn), 0, "iptal / kâğıt belge EDM'ye gitmedi");
    assert.equal((await ctx.card(cancelled.id)).number, "", "iptal edilmiş bekleyen numara almadı");
  });

  test("S4: seçilmemiş eski belge yokken (aynı gün / daha yeni / başka seri / numaralı) soru yok; yalnız seçilenler gider", async () => {
    const ctx = await setup();
    open.push(ctx);
    const firm = await ctx.api.post("/api/workspace/accounts", { name: "Alıcı Ticaret A.Ş.", type: "customer", taxNo: BUYER_VKN, taxOffice: "Kavaklıdere", address: "Cinnah Cd. 10", district: "Çankaya", city: "Ankara", eInvoice: true, eAlias: "urn:mail:defaultpk@alici.com.tr" });
    assert.equal(firm.status, 200, JSON.stringify(firm.data));
    const otherSeries = await ctx.sale(firm.data.id, { issueDate: ctx.day(-5), eSend: "later" });
    assert.equal(otherSeries.profile, "TEMELFATURA", "ön koşul: e-Fatura (TEF) serisi");
    const sameDay = await ctx.sale(ctx.people[0], { issueDate: ctx.day(-2), eSend: "later" });
    const chosen = await ctx.sale(ctx.people[1], { issueDate: ctx.day(-2), eSend: "later" });
    const newer = await ctx.sale(ctx.people[2], { issueDate: ctx.day(0), eSend: "later" });
    const check = await ctx.api.post(SEND, { only: [chosen.id], check: true });
    assert.equal(check.data.count, 0, `aynı gün, daha yeni ve başka seri bekletmez: ${JSON.stringify(check.data)}`);
    const sent = await ctx.turn({ only: [chosen.id] });
    assert.equal(sent.status, 200, JSON.stringify(sent.data));
    assert.deepEqual(sent.results.map(item => [item.id, item.ok]), [[chosen.id, true]]);
    assert.match((await ctx.card(chosen.id)).number, /^TEA2026/);
    for (const doc of [otherSeries, sameDay, newer]) assert.equal((await ctx.card(doc.id)).eStatus, "waiting", "seçilmeyen gönderilmedi");
  });

  test("S5: numaralı ama gitmemiş (Sonucu Belirsiz) eski belge yeni belgeyi bekletmez; seçilince önce durumu sorulur, EDM'ye bir kez gider", async () => {
    const ctx = await setup();
    open.push(ctx);
    const old = await ctx.sale(ctx.people[0], { issueDate: ctx.day(-3), eSend: "later" });
    await ctx.api.post("/api/workspace/invoices/check-user", { taxNo: BUYER_VKN }); // havuzda boşta bağlantı olsun (yeniden kullanılan bağlantı koparılır)
    ctx.edm.state.resetOps = new Set(["SendInvoice"]);
    ctx.edm.state.resetLimit = 1;
    let cut;
    try {
      cut = await ctx.api.post(`/api/workspace/invoices/${old.id}/send`, {});
    } finally {
      ctx.edm.state.resetOps = new Set();
      ctx.edm.state.resetLimit = undefined;
    }
    assert.equal(cut.status, 502, JSON.stringify(cut.data));
    const uncertain = await ctx.card(old.id);
    assert.equal(uncertain.eStatusLabel, "Sonucu Belirsiz", "ön koşul: belirsiz gönderim");
    assert.equal(seqOf(uncertain.number), 1, "ön koşul: belirsiz belge numaralı");
    const fresh = await ctx.sale(ctx.people[1], { issueDate: ctx.day(0), eSend: "later" });
    const check = await ctx.api.post(SEND, { only: [fresh.id], check: true });
    assert.equal(check.data.count, 0, `numaralı belge 'eski bekleyen' sayılmaz: ${JSON.stringify(check.data)}`);
    const statusBefore = ctx.calls("GetInvoiceStatus");
    const sent = await ctx.turn({ only: [fresh.id, old.id] });
    assert.equal(sent.status, 200, JSON.stringify(sent.data));
    assert.ok(sent.results.every(item => item.ok), JSON.stringify(sent.results));
    assert.ok(ctx.calls("GetInvoiceStatus") > statusBefore, "belirsiz belgenin durumu önce soruldu");
    assert.equal(ctx.sentCount(uncertain.ettn), 1, "belirsiz belge EDM'ye bir kez gitti");
    const [a, b] = [await ctx.card(old.id), await ctx.card(fresh.id)];
    assert.equal(a.number, uncertain.number, "belirsiz belgenin numarası değişmedi");
    assert.equal(seqOf(b.number), 2);
  });

  test("S6: 25 seçili — Tümünü Gönder'in turu: istek başına 20, kalan + imleç; hepsi bir kez, numara = tarih sırası", async () => {
    const ctx = await setup();
    open.push(ctx);
    const docs = [];
    for (let i = 0; i < 25; i += 1) docs.push(await ctx.sale(ctx.people[i % 3], { issueDate: ctx.day(-6 + (i % 5)), eSend: "later" }));
    const unselected = await ctx.sale(ctx.people[0], { issueDate: ctx.day(0), eSend: "later" });
    const ids = [...docs].reverse().map(doc => doc.id); // ekranın sırası: yeniden eskiye
    const first = await ctx.api.post(SEND, { only: ids });
    assert.equal(first.status, 200, JSON.stringify(first.data).slice(0, 300));
    assert.equal(first.data.sent, 20, "bir istekte en çok 20");
    assert.equal(first.data.remaining, 5);
    assert.ok(first.data.cursor, "imleç döner");
    const rest = await ctx.api.post(SEND, { only: ids, after: first.data.cursor });
    assert.equal(rest.status, 200, JSON.stringify(rest.data).slice(0, 300));
    assert.equal(rest.data.sent, 5);
    assert.equal(rest.data.remaining, 0);
    const cards = await Promise.all(docs.map(doc => ctx.card(doc.id)));
    for (const doc of cards) assert.equal(ctx.sentCount(doc.ettn), 1, `${doc.number} bir kez`);
    const ordered = [...cards].sort((x, y) => seqOf(x.number) - seqOf(y.number));
    for (let i = 1; i < ordered.length; i += 1) assert.ok(ordered[i].issueDate >= ordered[i - 1].issueDate, `numara tarih sırasında: ${ordered[i - 1].number} ${ordered[i - 1].issueDate} → ${ordered[i].number} ${ordered[i].issueDate}`);
    assert.equal((await ctx.card(unselected.id)).eStatus, "waiting", "seçilmeyen gitmedi");
  });

  test("S7: ön denetimden sonra, tur sürerken daha eski belge kaydedilirse kalan yeni seçililer numara almaz ('dahil değil'); eski belge gönderilmez", async () => {
    const ctx = await setup();
    open.push(ctx);
    const early = [];
    for (let i = 0; i < 20; i += 1) early.push(await ctx.sale(ctx.people[i % 3], { issueDate: ctx.day(-5), eSend: "later" }));
    const late = [];
    for (let i = 0; i < 3; i += 1) late.push(await ctx.sale(ctx.people[i % 3], { issueDate: ctx.day(-1), eSend: "later" }));
    const ids = [...early, ...late].map(doc => doc.id);
    const first = await ctx.api.post(SEND, { only: ids });
    assert.equal(first.status, 200, JSON.stringify(first.data).slice(0, 300));
    assert.equal(first.data.sent, 20, "ön koşul: ilk parça d-5 belgeleri");
    // Başka kullanıcı arada d-3 tarihli belge kaydeder (son numaralı d-5'ten eski değil → kayıt kabul edilir).
    const between = await ctx.sale(ctx.people[0], { issueDate: ctx.day(-3), eSend: "later" });
    assert.equal(between.eStatus, "waiting", "ön koşul: arada kaydedilen belge Gönderilecekler'de");
    const before = ctx.sends();
    const rest = await ctx.api.post(SEND, { only: ids, after: first.data.cursor });
    assert.equal(rest.status, 200, JSON.stringify(rest.data).slice(0, 400));
    assert.equal(ctx.sends(), before, "kalan seçililer EDM'ye gitmedi");
    for (const doc of late) {
      const item = rest.data.results.find(row => row.id === doc.id);
      assert.equal(item?.skipped, true, JSON.stringify(item));
      assert.equal(item.reason, "outside");
      assert.match(item.message, /bu gönderime dahil değil/);
      assert.equal((await ctx.card(doc.id)).number, "", "yeni belge numara almadı");
    }
    assert.equal((await ctx.card(between.id)).eStatus, "waiting", "seçilmeyen eski belge gönderilmedi");
    // Yeni turun ilk isteği (imleçsiz) bunu ÖNCEDEN söyler.
    const again = await ctx.api.post(SEND, { only: late.map(doc => doc.id) });
    assert.equal(again.status, 409, JSON.stringify(again.data).slice(0, 300));
    assert.deepEqual(again.data.olderIds, [between.id]);
  });

  test("S8: iki oturum aynı seçimi aynı anda gönderir (ikincisi birincinin gönderdiği belgeye denk getirilir) — her belge EDM'ye bir kez, hata yok", async () => {
    const ctx = await setup({ sendDelayMs: 300 });
    open.push(ctx);
    const docs = [];
    for (let i = 0; i < 4; i += 1) docs.push(await ctx.sale(ctx.people[i % 3], { issueDate: ctx.day(-4 + (i % 2)), eSend: "later" }));
    const other = ctx.server.client();
    assert.equal((await other.login("admin", ADMIN_PASSWORD)).status, 200);
    const api2 = ctx.wrap(other);
    const ids = docs.map(doc => doc.id);
    let second;
    let fired = false;
    // Ön koşul (ders 20): birinci oturumun ilk belgesi numarasını aldı ve EDM'ye çıkarken ikinci oturum aynı seçimle başlar.
    ctx.hooks.onSend = () => {
      fired = true;
      second = ctx.turn({ only: ids }, api2);
    };
    const first = await ctx.turn({ only: ids });
    const b = await second;
    assert.ok(fired, "ön koşul: ikinci oturum birincinin gönderimi sürerken başladı");
    assert.equal(first.status, 200, JSON.stringify(first.data).slice(0, 300));
    assert.equal(b.status, 200, JSON.stringify(b.data).slice(0, 300));
    const cards = await Promise.all(ids.map(id => ctx.card(id)));
    for (const doc of cards) assert.equal(ctx.sentCount(doc.ettn), 1, `${doc.number} bir kez`);
    const sentA = first.results.filter(item => item.ok && !item.done).length;
    const sentB = b.results.filter(item => item.ok && !item.done).length;
    assert.equal(sentA + sentB, 4, `toplam 4 gönderim (${sentA} + ${sentB})`);
    assert.ok(b.results.some(item => item.done), `ön koşul: ikinci oturum birincinin tuttuğu belgeye denk geldi (${JSON.stringify(b.results).slice(0, 300)})`);
    for (const r of [first, b]) assert.ok(r.results.every(item => item.ok), JSON.stringify(r.results.filter(item => !item.ok)));
    const ordered = [...cards].sort((x, y) => seqOf(x.number) - seqOf(y.number));
    for (let i = 1; i < ordered.length; i += 1) assert.ok(ordered[i].issueDate >= ordered[i - 1].issueDate, "numara tarih sırasında");
  });

  test("S9: iki oturum aynı anda — biri eski belgeyi, öbürü yenisini seçer: eski numarasını aldıktan sonra başlayan yeni gönderim sorulmadan gider, sıra korunur", async () => {
    const ctx = await setup({ sendDelayMs: 300 });
    open.push(ctx);
    const old = await ctx.sale(ctx.people[0], { issueDate: ctx.day(-3), eSend: "later" });
    const fresh = await ctx.sale(ctx.people[1], { issueDate: ctx.day(0), eSend: "later" });
    const other = ctx.server.client();
    assert.equal((await other.login("admin", ADMIN_PASSWORD)).status, 200);
    const api2 = ctx.wrap(other);
    // Önce (eski belge daha numarasızken) ikinci oturumun yeni belgesi sorulur.
    assert.equal((await api2.post(SEND, { only: [fresh.id] })).status, 409, "eski belge numarasızken yenisi sorulur");
    let second;
    ctx.hooks.onSend = () => {
      second = ctx.turn({ only: [fresh.id] }, api2);
    };
    const first = await ctx.turn({ only: [old.id] });
    const b = await second;
    assert.equal(first.status, 200, JSON.stringify(first.data).slice(0, 300));
    assert.equal(b.status, 200, `eski belge numarasını aldı; yenisi sorulmadan gider: ${JSON.stringify(b.data).slice(0, 300)}`);
    const [a, n] = [await ctx.card(old.id), await ctx.card(fresh.id)];
    assert.deepEqual([seqOf(a.number), seqOf(n.number)], [1, 2], `${a.number} → ${n.number}`);
    assert.equal(ctx.sentCount(a.ettn), 1);
    assert.equal(ctx.sentCount(n.ettn), 1);
  });

  test("S10: yetkisiz kullanıcı (yalnız görüntüleme) 403; boş ve çok büyük seçim 400; hiçbiri numara vermez ya da gönderim yapmaz", async () => {
    const ctx = await setup();
    open.push(ctx);
    const doc = await ctx.sale(ctx.people[0], { issueDate: ctx.day(0), eSend: "later" });
    const role = await ctx.api.post("/api/admin/roles", { name: "Fatura Okuyucu 244", permissions: ["invoices.view", "overview.view"] });
    assert.equal(role.status, 200, JSON.stringify(role.data));
    const reader = ctx.wrap(await createUser(ctx.server, ctx.client, { username: "e6-okur", role: role.data.id }));
    const before = ctx.sends();
    for (const body of [{ only: [doc.id] }, { only: [doc.id], check: true }]) {
      const r = await reader.post(SEND, body);
      assert.equal(r.status, 403, `yetkisiz ${JSON.stringify(body)}: ${r.status} ${JSON.stringify(r.data)}`);
    }
    const empty = await ctx.api.post(SEND, { only: [] });
    assert.equal(empty.status, 400);
    assert.equal(empty.data.code, "einvoice-selection-empty");
    const blank = await ctx.api.post(SEND, { only: ["", "   "] });
    assert.equal(blank.status, 400, "boşluklu kimlikler de boş seçim");
    const huge = await ctx.api.post(SEND, { only: Array.from({ length: 5001 }, (_, i) => `x${i}`) });
    assert.equal(huge.status, 400);
    assert.equal(huge.data.code, "einvoice-selection-large");
    // { all: true, only } yalnız seçilenleri gönderir (fazlası gönderilmez).
    const extra = await ctx.sale(ctx.people[1], { issueDate: ctx.day(0), eSend: "later" });
    assert.equal(ctx.sends(), before, "yetkisiz / geçersiz istek gönderim yapmadı");
    const mixed = await ctx.turn({ all: true, only: [doc.id] });
    assert.equal(mixed.status, 200, JSON.stringify(mixed.data));
    assert.deepEqual(mixed.results.map(item => item.id), [doc.id]);
    assert.equal((await ctx.card(extra.id)).eStatus, "waiting", "seçilmeyen gönderilmedi");
    assert.equal((await ctx.card(doc.id)).number.slice(0, 3), "TEA");
  });

  test("S11: seçilmemiş KALICI engelli eski belge (seride daha yeni numara / alıcı e-Fatura mükellefi) soru doğurmaz; seçilen gönderilir", async () => {
    const ctx = await setup();
    open.push(ctx);
    const sentEarlier = await ctx.sale(ctx.people[0], { issueDate: ctx.day(-2), eSend: "now" });
    assert.equal(sentEarlier.autoSend?.ok, true, JSON.stringify(sentEarlier.autoSend));
    // Kronoloji engelli (eski sürüm verisi düzeni, gg243 S1): son numaralı belge d-2, bu belge d-3.
    const chrono = await ctx.sale(ctx.people[1], { issueDate: ctx.day(-2), eSend: "later" });
    ctx.server.app.store.run("UPDATE invoices SET issue_date = ? WHERE id = ?", ctx.day(-3), chrono.id);
    // Alıcısı e-Fatura mükellefi çıkan numarasız e-Arşiv (d-1; cari sonradan Mükellef Sorgula ile işaretlendi): kalıcı, seriyi bekletmez.
    const buyer = await ctx.sale(ctx.people[2], { issueDate: ctx.day(-1), eSend: "later" });
    ctx.server.app.store.run("UPDATE accounts SET e_invoice = 1 WHERE id = ?", ctx.people[2]);
    const cards = await Promise.all([chrono, buyer].map(doc => ctx.card(doc.id)));
    for (const doc of cards) assert.ok(doc.sendBlock && !doc.canSend, `ön koşul: kalıcı engelli (${doc.sendBlock})`);
    assert.match(cards[1].sendBlock, /e-Fatura mükellefi/, "ön koşul: alıcı engeli");
    const fresh = await ctx.sale(ctx.people[0], { issueDate: ctx.day(0), eSend: "later" });
    const check = await ctx.api.post(SEND, { only: [fresh.id], check: true });
    assert.equal(check.status, 200, JSON.stringify(check.data));
    assert.equal(check.data.count, 0, `kalıcı engelli eski belge 'eski bekleyen' sayılmaz: ${JSON.stringify(check.data)}`);
    const sent = await ctx.turn({ only: [fresh.id] });
    assert.equal(sent.status, 200, JSON.stringify(sent.data));
    assert.deepEqual(sent.results.map(item => [item.id, item.ok]), [[fresh.id, true]]);
  });
});
