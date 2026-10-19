// Dar kontrol turu 2.4.3 (bağımsız denetçi; bulgular yeniden üretildi, betikler r1…r14) — e-Belge numara/gönderim çekirdeği. Sahte EDM; ağa çıkmaz;
// sahte saat (ders 13).
//   Y1  YÜKSEK  Tümünü Gönder bir istekte 200 belge gönderiyordu (gerçek EDM ~320/dk → ~37 sn+); tarayıcı 30 sn'de zaman aşımına düşüyordu. Artık bir
//               istek en çok 20 belgeyi dener ya da süre bütçesi (üretimde 10 sn) dolunca durur; kalan sayısı döner (istemci yineler).
//   O1  ORTA    Kaydet ve Gönder, düz Kaydet ve kartta e-Belge Gönder, aynı seride daha eski tarihli numarasız bekleyen varken yeni belgeye numara
//               veriyordu → eskiler kalıcı kronoloji engeline düşüyordu. Bütün numara yolları aynı kural: yeni belge numarasız Gönderilecekler'de kalır.
//   O2  ORTA    Tümünü Gönder sürerken Müşteri Fişi olarak bırakılan belge yine e-Belge olarak EDM'ye gidiyordu.
//   O3  ORTA    alıcısı e-Fatura mükellefi olan numarasız e-Arşiv (buyer-is-efatura) geçici sayılıp bütün seriyi her turda bekletiyordu; kartta canSend.
//   D2  DÜŞÜK   eşzamanlı gönderimde "zaten iletildi" hata sayılıyor, gönderilmiş belgenin iletisi eziliyordu.
//   D4  DÜŞÜK   numarasız bekleyenin tarihi Düzenle ile ileri alınamıyordu (seq = 0'da "sonraki belge" serinin ilk numaralısıydı).
//   BİLGİ       bağlantı yokken Tümünü Gönder her belgeye numara verip hiçbirini gönderemiyordu → ilk "EDM'ye ulaşılamadı"da tur durur.
// Nasıl bozulur: sıra (eski belge sonradan / yeni belge önce), iki oturum aynı anda, tur sürerken Müşteri Fişi Olarak Bırak / Düzenle, kalıcı ve geçici engel karışık,
// bağlantı kopuk, aynı gün, büyük kuyruk (istek başına sınır).
import assert from "node:assert/strict";
import { after, describe, test } from "node:test";
import { resetEdmCaches } from "../server/lib/einvoice/edm.mjs";
import { BUYER_VKN, MULTI_VKN, OUR_VKN, startMockEdm } from "./einvoice-mock.mjs";
import { ADMIN_PASSWORD, startTestServer } from "./helpers.mjs";

const unwrap = response => ({ ...response, data: response.data && typeof response.data === "object" && "ok" in response.data ? (response.data.ok ? response.data.data : response.data) : response.data });
const SELLER = { name: "Deneme Ofis Ltd.", taxNo: OUR_VKN, taxOffice: "Çankaya", address: "Atatürk Blv. 1", district: "Çankaya", city: "Ankara", email: "bilgi@deneme.com.tr" };
const person = (name, taxNo) => ({ name, type: "customer", partyKind: "person", firstName: name.split(" ")[0], familyName: name.split(" ").slice(1).join(" ") || "Kişi", taxNo, taxOffice: "Konak", address: "Kordon 1", district: "Konak", city: "İzmir" });
const retail = n => ({ name: `Perakende ${n}`, type: "customer", partyKind: "person", firstName: "Perakende", familyName: `${n}`, taxNo: "11111111111", address: "Kordon 1", district: "Konak", city: "İzmir" });
const LINES = [{ name: "Danışmanlık", qty: 1, unitPrice: 500, vatRate: 20 }];
const DEAD = "http://127.0.0.1:9/EFaturaEDM21ea/EFaturaEDM.svc";
const sleep = ms => new Promise(resolve => setTimeout(resolve, ms));
const seqOf = number => Number(String(number).slice(7));
const ORDER_RE = /^Bu seride daha eski tarihli gönderilmemiş (\d+) belge var; GİB sıra kuralı gereği önce onlar gönderilmeli\. Belge Gönderilecekler'(e eklendi|de bekliyor) — Tümünü Gönder ile eskiden yeniye gönderin\.$/;

async function setup({ sendDelayMs = 0, checkDelayMs = sendDelayMs, slowTaxNo = "", slowMs = 0, edocSendBudgetMs = 0 } = {}) {
  resetEdmCaches();
  const edm = await startMockEdm();
  // net.down: ağ yok (bağlantı reddedildi; istek EDM'ye hiç ulaşmaz) — oturum önbellekteyken de (kâhin hedefli-ag-yokken-numara).
  const net = { down: false };
  const fetchImpl = async (input, init) => {
    const url = String(typeof input === "string" || input instanceof URL ? input : input.url);
    if (!url.startsWith("http://127.0.0.1")) throw new Error(`ağa çıkılmaz (test): ${url}`);
    if (net.down) throw Object.assign(new TypeError("fetch failed"), { cause: { code: "ECONNREFUSED" } });
    const raw = String(init?.body || "");
    if (sendDelayMs && /SendInvoiceRequest/.test(raw)) await sleep(sendDelayMs);
    if (checkDelayMs && /CheckUserRequest/.test(raw)) await sleep(checkDelayMs);
    if (slowTaxNo && /CheckUserRequest/.test(raw) && raw.includes(slowTaxNo)) await sleep(slowMs);
    return globalThis.fetch(input, init);
  };
  const server = await startTestServer({ edocEnabled: true, fetchImpl, now: "2026-06-17T09:00:00", edocStatusPollMs: [5, 5], ...(edocSendBudgetMs ? { edocSendBudgetMs } : {}), env: { HUKUK_LICENSE_URL: "http://127.0.0.1:9" } });
  const client = server.client();
  const api = { get: async url => unwrap(await client.get(url)), post: async (url, body) => unwrap(await client.post(url, body)), put: async (url, body) => unwrap(await client.put(url, body)) };
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
  const sends = () => edm.state.calls.filter(call => call.op === "SendInvoice").length;
  const sentCount = ettn => edm.state.calls.filter(call => call.op === "SendInvoice" && call.raw.includes(ettn)).length;
  // İstemcinin Tümünü Gönder döngüsü (hof-invoices.js sendPending): kalan bitene ya da ilerleme durana dek.
  const sendAll = async (limit = 100) => {
    const turns = [];
    for (let i = 0; i < limit; i += 1) {
      const result = await api.post("/api/workspace/invoices/send-pending", { all: true });
      assert.equal(result.status, 200, JSON.stringify(result.data).slice(0, 400));
      turns.push(result.data);
      if (result.data.stopped || !result.data.remaining || !result.data.sent) break;
    }
    return turns;
  };
  // Seride numara sırası = tarih sırası, boşluksuz.
  const seriesOk = cards => {
    const numbered = cards.filter(c => /^TEA/.test(c.number)).sort((x, y) => seqOf(x.number) - seqOf(y.number));
    for (let i = 1; i < numbered.length; i += 1) {
      assert.ok(numbered[i].issueDate >= numbered[i - 1].issueDate, `numara sırası = tarih sırası: ${numbered[i - 1].number} ${numbered[i - 1].issueDate} → ${numbered[i].number} ${numbered[i].issueDate}`);
      assert.equal(seqOf(numbered[i].number), seqOf(numbered[i - 1].number) + 1, `boşluksuz: ${numbered[i - 1].number} → ${numbered[i].number}`);
    }
    return numbered;
  };
  const close = async () => {
    await server.close();
    await edm.close();
  };
  return { edm, net, server, client, api, integrator, people, day, sale, card, pendingTab, sends, sentCount, sendAll, seriesOk, close };
}

describe("gg243 dar kontrol: e-Belge numara ve Tümünü Gönder çekirdeği", () => {
  const open = [];
  after(async () => {
    for (const ctx of open) await ctx.close();
  });

  test("Y1: Tümünü Gönder bir istekte en çok 20 belgeyi dener; kalan sayısı döner, yinelenince hepsi eskiden yeniye gider", async () => {
    const ctx = await setup();
    open.push(ctx);
    const docs = [];
    for (let i = 0; i < 45; i += 1) docs.push(await ctx.sale(ctx.people[i % 3], { issueDate: ctx.day(-9 + Math.floor(i / 5)), eSend: "later" }));
    const first = await ctx.api.post("/api/workspace/invoices/send-pending", { all: true });
    assert.equal(first.status, 200);
    assert.equal(first.data.sent, 20, `bir istekte en çok 20 (gelen ${first.data.sent})`);
    assert.equal(first.data.remaining, 25, "kalan sayısı");
    const rest = await ctx.sendAll();
    assert.deepEqual(rest.map(turn => turn.sent), [20, 5]);
    assert.equal(rest.at(-1).remaining, 0);
    assert.equal((await ctx.pendingTab()).tabCounts.pending, 0, "Gönderilecekler boşaldı");
    const cards = await Promise.all(docs.map(doc => ctx.card(doc.id)));
    assert.equal(ctx.seriesOk(cards).length, 45);
    for (const c of cards) assert.equal(ctx.sentCount(c.ettn), 1, `${c.number} EDM'ye bir kez`);
  });

  test("Y1: süre bütçesi dolunca istek erken döner (en az bir belge); kalanlar sonraki isteklerde", async () => {
    const ctx = await setup({ sendDelayMs: 150, checkDelayMs: 0, edocSendBudgetMs: 400 });
    open.push(ctx);
    const docs = [];
    for (let i = 0; i < 12; i += 1) docs.push(await ctx.sale(ctx.people[i % 3], { issueDate: ctx.day(-12 + i), eSend: "later" }));
    const t0 = Date.now();
    const first = await ctx.api.post("/api/workspace/invoices/send-pending", { all: true });
    const took = Date.now() - t0;
    assert.ok(first.data.sent >= 1 && first.data.sent < 12, `bütçe dolunca durdu (gönderilen ${first.data.sent}, ${took} ms)`);
    assert.equal(first.data.remaining, 12 - first.data.sent);
    const turns = await ctx.sendAll();
    assert.equal(first.data.sent + turns.reduce((sum, turn) => sum + turn.sent, 0), 12);
    const cards = await Promise.all(docs.map(doc => ctx.card(doc.id)));
    assert.equal(ctx.seriesOk(cards).length, 12);
  });

  for (const path of ["kaydet-ve-gonder", "duz-kaydet", "kartta-gonder"]) {
    test(`O1 (${path}): seride daha eski tarihli numarasız bekleyen varken yeni belge numara almaz; Gönderilecekler'de kalır, eskiden yeniye gider`, async () => {
      const ctx = await setup();
      open.push(ctx);
      const old = await ctx.sale(ctx.people[0], { issueDate: ctx.day(-3), eSend: "later" });
      const before = ctx.sends();
      let fresh;
      if (path === "kaydet-ve-gonder") fresh = await ctx.sale(ctx.people[1], { issueDate: ctx.day(0), eSend: "now" });
      else if (path === "duz-kaydet") fresh = await ctx.sale(ctx.people[1], { issueDate: ctx.day(0) });
      else {
        fresh = await ctx.sale(ctx.people[1], { issueDate: ctx.day(0), eSend: "later" });
        const r = await ctx.api.post(`/api/workspace/invoices/${fresh.id}/send`, {});
        assert.equal(r.status, 409, JSON.stringify(r.data).slice(0, 300));
        assert.equal(r.data.code, "einvoice-order", JSON.stringify(r.data).slice(0, 300));
        assert.match(String(r.data.error), ORDER_RE);
        assert.equal(ORDER_RE.exec(r.data.error)[2], "de bekliyor");
      }
      if (path !== "kartta-gonder") {
        assert.equal(fresh.autoSend?.code, "einvoice-order", JSON.stringify(fresh.autoSend));
        assert.equal(fresh.autoSend.held, true);
        assert.equal(fresh.autoSend.message, "Bu seride daha eski tarihli gönderilmemiş 1 belge var; GİB sıra kuralı gereği önce onlar gönderilmeli. Belge Gönderilecekler'e eklendi — Tümünü Gönder ile eskiden yeniye gönderin.");
      }
      assert.equal(ctx.sends() - before, 0, "EDM'ye hiçbir şey gitmedi");
      const f = await ctx.card(fresh.id);
      assert.equal(f.number, "", "yeni belge numara almadı");
      assert.equal(f.eStatus, "waiting", "Gönderilecekler'de");
      const o = await ctx.card(old.id);
      assert.equal(o.canSend, true, `eski belge gönderilebilir (${o.sendBlock})`);
      const turns = await ctx.sendAll();
      assert.equal(turns.reduce((sum, turn) => sum + turn.sent, 0), 2, JSON.stringify(turns.map(turn => turn.results)));
      const [o2, f2] = [await ctx.card(old.id), await ctx.card(fresh.id)];
      assert.ok(seqOf(o2.number) < seqOf(f2.number), `eski tarihli küçük numara (${o2.number} < ${f2.number})`);
      ctx.seriesOk([o2, f2]);
    });
  }

  test("O1 (taslaktan Kaydet ve Gönder, Seçilenleri Kaydet — hemen gönderim açık): aynı kural; belge numarasız Gönderilecekler'de", async () => {
    const ctx = await setup();
    open.push(ctx);
    const old = await ctx.sale(ctx.people[0], { issueDate: ctx.day(-3), eSend: "later" });
    const d1 = await ctx.sale(ctx.people[1], { issueDate: ctx.day(0), status: "draft" });
    const d2 = await ctx.sale(ctx.people[2], { issueDate: ctx.day(0), status: "draft" });
    const issued = await ctx.api.post(`/api/workspace/invoices/${d1.id}/issue`, { eSend: "now" });
    assert.equal(issued.status, 200, JSON.stringify(issued.data).slice(0, 300));
    assert.equal(issued.data.autoSend?.code, "einvoice-order", JSON.stringify(issued.data.autoSend));
    assert.equal(issued.data.number, "");
    assert.equal((await ctx.api.put("/api/workspace/invoices/settings", { integrator: { autoSend: true } })).status, 200);
    const bulk = await ctx.api.post("/api/workspace/invoices/bulk-issue", { ids: [d2.id] });
    assert.equal(bulk.status, 200, JSON.stringify(bulk.data));
    assert.equal(bulk.data.issued, 1);
    assert.equal(bulk.data.results[0].autoSend?.code, "einvoice-order", JSON.stringify(bulk.data.results[0]));
    for (const id of [d1.id, d2.id]) {
      const c = await ctx.card(id);
      assert.deepEqual([c.status, c.number, c.eStatus], ["issued", "", "waiting"]);
    }
    assert.equal((await ctx.card(old.id)).canSend, true);
    await ctx.sendAll();
    const cards = await Promise.all([old.id, d1.id, d2.id].map(id => ctx.card(id)));
    assert.equal(ctx.seriesOk(cards).length, 3);
    assert.equal(seqOf(cards[0].number), Math.min(...cards.map(c => seqOf(c.number))), "eski tarihli önce");
  });

  test("O1 komşu: aynı günlü eski bekleyen ve KALICI engelli eski bekleyen numara vermeyi durdurmaz", async () => {
    const ctx = await setup();
    open.push(ctx);
    const sent = await ctx.sale(ctx.people[0], { issueDate: ctx.day(-1), eSend: "now" });
    assert.equal(sent.autoSend?.ok, true, JSON.stringify(sent.autoSend));
    // Seride D-1 numaralı → D-3 bekleyen kalıcı kronoloji engelli (sendBlock). Dar kontrol 2 (B5): böyle bir belge artık kayıtta reddedilir; durum
    // eski sürüm verisindeki gibi kurulur (D-1 ile kaydedilir, tarihi D-3'e çekilir).
    assert.equal((await ctx.api.post("/api/workspace/invoices", { scenario: "service_sale", accountId: ctx.people[1], lines: LINES, payment: { rest: "open" }, issueDate: ctx.day(-3), eSend: "later" })).data.code, "chronology");
    const stuck = await ctx.sale(ctx.people[1], { issueDate: ctx.day(-1), eSend: "later" });
    ctx.server.app.store.run("UPDATE invoices SET issue_date = ? WHERE id = ?", ctx.day(-3), stuck.id);
    assert.equal((await ctx.card(stuck.id)).canSend, false);
    const sameDay = await ctx.sale(ctx.people[2], { issueDate: ctx.day(0), eSend: "later" });
    const now = await ctx.sale(ctx.people[2], { issueDate: ctx.day(0), eSend: "now" });
    assert.equal(now.autoSend?.ok, true, `aynı gün ve kalıcı engelli eski belge bekletmez: ${JSON.stringify(now.autoSend)}`);
    assert.match(now.number, /^TEA/);
    assert.equal((await ctx.card(sameDay.id)).canSend, true, "aynı günlü bekleyen hâlâ gönderilebilir (kronoloji katı: tarih)");
  });

  for (const seed of [1, 2, 3]) {
    test(`O1 yarış (tohum ${seed}): Tümünü Gönder sürerken ikinci oturum seçili gönderim + geriye tarihli Sonra Gönder + bugünlü Kaydet ve Gönder — seri tutarlı, kalıcı engele düşen yok`, async () => {
      const ctx = await setup({ sendDelayMs: 60 + seed * 13, checkDelayMs: 30 });
      open.push(ctx);
      const docs = [];
      for (let i = 0; i < 12; i += 1) docs.push(await ctx.sale(ctx.people[i % 3], { issueDate: ctx.day(-11 + i), eSend: "later" }));
      const other = ctx.server.client();
      await other.login("admin", ADMIN_PASSWORD);
      const extra = [];
      await Promise.all([
        ctx.sendAll(),
        sleep(150 + seed * 20).then(async () => unwrap(await other.post("/api/workspace/invoices/send-pending", { ids: docs.slice(-3).map(d => d.id) }))),
        sleep(250 + seed * 30).then(async () => extra.push(unwrap(await other.post("/api/workspace/invoices", { scenario: "service_sale", accountId: ctx.people[1], lines: LINES, payment: { rest: "open" }, issueDate: ctx.day(-6), eSend: "later" })))),
        sleep(350 + seed * 10).then(async () => extra.push(unwrap(await other.post("/api/workspace/invoices", { scenario: "service_sale", accountId: ctx.people[2], lines: LINES, payment: { rest: "open" }, issueDate: ctx.day(0), eSend: "now" })))),
      ]);
      // Dar kontrol 2 (B5): geriye tarihli Sonra Gönder, tur o tarihten yeni belgeyi numaralandırdıysa kayıtta reddedilir (chronology) — yarışın iki
      // sonucu da doğrudur; reddedilen kayıt açmaz.
      for (const e of extra) assert.ok(e.status === 200 || (e.status === 400 && e.data.code === "chronology"), JSON.stringify(e.data).slice(0, 300));
      const kept = extra.filter(e => e.status === 200);
      await ctx.sendAll();
      const cards = await Promise.all([...docs.map(d => d.id), ...kept.map(e => e.data.id)].map(id => ctx.card(id)));
      ctx.seriesOk(cards);
      for (const c of cards) {
        assert.equal(c.sendBlock || "", "", `kalıcı engele düşen yok: ${c.issueDate} ${c.sendBlock}`);
        if (c.ettn) assert.ok(ctx.sentCount(c.ettn) <= 1, `${c.number} EDM'ye en çok bir kez`);
      }
      assert.equal((await ctx.pendingTab()).tabCounts.pending, 0, "hepsi gönderildi");
    });
  }

  test("O2: Tümünü Gönder sürerken Müşteri Fişi olarak bırakılan belge e-Belge olarak gönderilmez; Müşteri Fişi kalır (kartından yine gönderilebilir)", async () => {
    const ctx = await setup({ sendDelayMs: 150, checkDelayMs: 0 });
    open.push(ctx);
    const docs = [];
    for (let i = 0; i < 8; i += 1) docs.push(await ctx.sale(ctx.people[i % 3], { issueDate: ctx.day(-8 + i), eSend: "later" }));
    // En yeni belge: tur bittikten sonra seride ondan yeni numara olmaz, kartından gönderilebilir kalır.
    const target = docs[7];
    const other = ctx.server.client();
    await other.login("admin", ADMIN_PASSWORD);
    const turn = ctx.api.post("/api/workspace/invoices/send-pending", { all: true });
    await sleep(300);
    const w = unwrap(await other.post(`/api/workspace/invoices/${target.id}/withdraw`, {}));
    assert.equal(w.status, 200, JSON.stringify(w.data).slice(0, 300));
    assert.equal(w.data.eStatus, "withdrawn", "ön koşul: tur hedefe ulaşmadan Müşteri Fişi olarak bırakıldı");
    const r = await turn;
    const item = r.data.results.find(x => x.id === target.id);
    assert.equal(item?.ok, false, JSON.stringify(item));
    assert.equal(item.skipped, true);
    assert.equal(item.reason, "withdrawn");
    assert.equal(item.message, "Gönderilmedi: belge gönderim sürerken Müşteri Fişi olarak bırakıldı.");
    assert.equal(r.data.sent, 7, "öbür belgeler gitti (silinen seriyi bekletmez)");
    const c = await ctx.card(target.id);
    assert.equal(c.profile, "KAGIT");
    assert.equal(c.eStatus, "withdrawn");
    assert.equal(ctx.sentCount(c.ettn), 0, "EDM'ye gitmedi");
    // Kartındaki e-Belge Gönder (kullanıcının açık kararı) yine çalışır.
    const again = await ctx.api.post(`/api/workspace/invoices/${target.id}/send`, {});
    assert.equal(again.status, 200, JSON.stringify(again.data).slice(0, 300));
    assert.match(again.data.number, /^TEA/);
    assert.equal(ctx.sentCount(again.data.ettn), 1);
  });

  test("O3: alıcısı e-Fatura mükellefi olan numarasız e-Arşiv KALICI sayılır — seriyi bekletmez; kartta gönderilemez ve nedeni yazar", async () => {
    const ctx = await setup();
    open.push(ctx);
    const firm = await ctx.api.post("/api/workspace/accounts", { name: "Alıcı Firma A.Ş.", type: "customer", partyKind: "company", taxNo: BUYER_VKN, taxOffice: "Kadıköy", address: "Moda 1", district: "Kadıköy", city: "İstanbul" });
    assert.equal(firm.status, 200);
    const old = await ctx.sale(firm.data.id, { issueDate: ctx.day(-3), eSend: "later" });
    assert.equal((await ctx.card(old.id)).profile, "EARSIVFATURA", "ön koşul: e-Arşiv olarak bekliyor");
    // Aynı firmaya bugünlü ikinci numarasız e-Arşiv: tur sonunda seride ondan yeni numara olmaz (kronoloji engeli yok) — kartındaki neden okunur.
    const old2 = await ctx.sale(firm.data.id, { issueDate: ctx.day(0), eSend: "later" });
    const fresh = [];
    for (let i = 0; i < 3; i += 1) fresh.push(await ctx.sale(ctx.people[i], { issueDate: ctx.day(-2 + i), eSend: "later" }));
    const t1 = await ctx.api.post("/api/workspace/invoices/send-pending", { all: true });
    const o1 = t1.data.results.find(x => x.id === old.id);
    assert.equal(o1.code, "buyer-is-efatura", JSON.stringify(o1));
    assert.equal(o1.permanent, true, "kalıcı");
    assert.equal(t1.data.results.find(x => x.id === old2.id)?.permanent, true, "aynı alıcının öbür belgesi de kalıcı");
    for (const f of fresh) assert.equal(t1.data.results.find(x => x.id === f.id)?.ok, true, `ilk turda yeni belge gitti: ${JSON.stringify(t1.data.results.find(x => x.id === f.id))}`);
    const c = await ctx.card(old2.id);
    assert.equal(c.canSend, false, "kartta gönderilemez");
    assert.equal(c.sendBlock, "Alıcı e-Fatura mükellefi (cari kartında işaretli); bu belge e-Arşiv olarak gönderilemez (GİB). İptal Et ile iptal edip yeniden kesin: e-Fatura olarak kesilir. Mükellefiyet bilgisi yanlışsa cari kartında Mükellef Sorgula ile yenileyin.");
    const checks = ctx.edm.state.calls.filter(call => call.op === "CheckUser").length;
    const t2 = await ctx.api.post("/api/workspace/invoices/send-pending", { all: true });
    assert.equal(t2.data.results.find(x => x.id === old.id)?.permanent, true);
    assert.equal(ctx.edm.state.calls.filter(call => call.op === "CheckUser").length, checks, "ikinci turda entegratöre yeniden sorulmaz");
    // Kalıcı engelli eski belge varken bugünlü Kaydet ve Gönder bekletilmez.
    const now = await ctx.sale(ctx.people[0], { issueDate: ctx.day(0), eSend: "now" });
    assert.equal(now.autoSend?.ok, true, JSON.stringify(now.autoSend));
  });

  for (const mode of ["all", "ids"]) {
    test(`D2 (${mode}): eşzamanlı Tümünü Gönder — başka oturumda gönderilen belge hata sayılmaz, iletisi ezilmez`, async () => {
      const ctx = await setup({ sendDelayMs: 0, checkDelayMs: 0, slowTaxNo: "10000000146", slowMs: 800 });
      open.push(ctx);
      const docs = [await ctx.sale(ctx.people[0], { issueDate: ctx.day(-2), eSend: "later" })];
      for (let i = 0; i < 5; i += 1) docs.push(await ctx.sale(ctx.people[1 + (i % 2)], { issueDate: ctx.day(-2), eSend: "later" }));
      const other = ctx.server.client();
      await other.login("admin", ADMIN_PASSWORD);
      const body = mode === "all" ? { all: true } : { ids: docs.map(d => d.id) };
      const before = ctx.sends();
      const [a, b] = await Promise.all([ctx.api.post("/api/workspace/invoices/send-pending", body), sleep(100).then(async () => unwrap(await other.post("/api/workspace/invoices/send-pending", body)))]);
      const items = [...a.data.results, ...b.data.results];
      const raced = items.filter(item => item.code === "einvoice-already-sent");
      assert.ok(raced.length, `ön koşul: bir istek öbürünün gönderdiği belgeye denk geldi: ${JSON.stringify(items.map(x => x.code || (x.ok ? "OK" : "")))}`);
      for (const item of raced) {
        assert.equal(item.done, true, `hata değil, "başka oturumda gönderildi": ${JSON.stringify(item)}`);
        assert.equal(item.message, "Bu belge başka oturumda gönderildi.");
      }
      assert.equal(a.data.failed + b.data.failed, items.filter(x => !x.ok && !x.done).length);
      assert.ok(!items.some(x => !x.ok && !x.done && !x.busy && !x.skipped), `gerçek hata yok: ${JSON.stringify(items.filter(x => !x.ok && !x.done))}`);
      assert.equal(ctx.sends() - before, 6, "her belge EDM'ye bir kez");
      for (const c of await Promise.all(docs.map(d => ctx.card(d.id)))) {
        assert.equal(ctx.sentCount(c.ettn), 1);
        assert.doesNotMatch(c.eMessage || "", /zaten entegratöre iletildi|başka oturumda/, `gönderilmiş belgenin iletisi ezilmedi (${c.number}: ${c.eMessage})`);
      }
    });
  }

  test("D4: numarasız bekleyenin tarihi Düzenle ile serinin son numaralı belgesine kadar ileri alınır; ondan eskiye alınamaz", async () => {
    const ctx = await setup();
    open.push(ctx);
    for (const d of [-5, -3, 0]) assert.equal((await ctx.sale(ctx.people[1], { issueDate: ctx.day(d), eSend: "now" })).autoSend?.ok, true);
    // Dar kontrol 2 (B5): D-4 ile "Kes, Sonra Gönder" artık kayıtta reddedilir; kalıcı engelli bekleyen eski sürüm verisindeki gibi kurulur.
    const w = await ctx.sale(ctx.people[0], { issueDate: ctx.day(0), eSend: "later" });
    ctx.server.app.store.run("UPDATE invoices SET issue_date = ? WHERE id = ?", ctx.day(-4), w.id);
    const before = await ctx.card(w.id);
    assert.equal(before.canSend, false, "ön koşul: kalıcı kronoloji engelli");
    const edit = date => ctx.api.post(`/api/workspace/invoices/${w.id}/edit`, { scenario: "service_sale", accountId: ctx.people[0], lines: LINES, payment: { rest: "open" }, issueDate: date, number: "" });
    const back = await edit(ctx.day(-3));
    assert.equal(back.status, 400, "serinin son numaralısından (bugün) eski olamaz");
    assert.equal(back.data.code, "chronology");
    assert.match(String(back.data.error), /^TEA serisinde son gönderilen belge TEA\d+ .+ tarihli; numarası gönderimde verilecek bu belge ondan eski tarihli olamaz \(numara ve tarih sırası\)\.$/);
    const fwd = await edit(ctx.day(0));
    assert.equal(fwd.status, 200, JSON.stringify(fwd.data).slice(0, 300));
    assert.equal(fwd.data.canSend, true, `ileri alınınca gönderilebilir (${fwd.data.sendBlock})`);
    const sent = await ctx.api.post(`/api/workspace/invoices/${w.id}/send`, {});
    assert.equal(sent.status, 200, JSON.stringify(sent.data).slice(0, 300));
  });

  test("D4 yarışı (r12): tur sürerken öndeki numarasız belgenin tarihi ileri alınır — arkadaki eski bekleyenler kalıcı engele düşmez", async () => {
    const ctx = await setup({ sendDelayMs: 200, checkDelayMs: 0 });
    open.push(ctx);
    const docs = [];
    for (let i = 0; i < 8; i += 1) docs.push(await ctx.sale(ctx.people[i % 3], { issueDate: ctx.day(-9 + i), eSend: "later" }));
    const target = docs[3];
    const other = ctx.server.client();
    await other.login("admin", ADMIN_PASSWORD);
    const turn = ctx.api.post("/api/workspace/invoices/send-pending", { all: true });
    await sleep(250);
    const e = unwrap(await other.post(`/api/workspace/invoices/${target.id}/edit`, { scenario: "service_sale", accountId: ctx.people[0], lines: LINES, payment: { rest: "open" }, issueDate: ctx.day(0), number: "" }));
    assert.equal(e.status, 200, `ön koşul: tur sürerken tarih ileri alındı (${JSON.stringify(e.data).slice(0, 200)})`);
    await turn;
    await ctx.sendAll();
    const cards = await Promise.all(docs.map(d => ctx.card(d.id)));
    ctx.seriesOk(cards);
    for (const c of cards) assert.equal(c.sendBlock || "", "", `kalıcı engele düşen yok: ${c.issueDate} ${c.sendBlock}`);
    assert.equal((await ctx.pendingTab()).tabCounts.pending, 0, "hepsi gönderildi");
    const t = await ctx.card(target.id);
    assert.equal(seqOf(t.number), Math.max(...cards.map(c => seqOf(c.number))), "ileri alınan belge en son numarayı aldı");
  });

  // Dar kontrol 2.4.3 ek 1 (kullanıcı kararı: bütün bulgular 2.4.3'te): numara entegratör GİRİŞİNDEN SONRA verilir. Yanlış kullanıcı adı/parolada
  // EDM girişte "isteği reddetti" der (integrator-rejected); önceden tur durmuyor, numara girişten önce verildiği için her belge numara alıp düşüyordu.
  const wrongPassword = async ctx => {
    assert.equal((await ctx.api.put("/api/workspace/invoices/settings", { integrator: { env: "test", baseUrl: ctx.edm.url, username: "edmkullanici", password: "Yanlis-Parola-9", senderAlias: "urn:mail:defaultgb@deneme.com.tr" } })).status, 200);
    resetEdmCaches();
  };
  const LOGIN_TEXT = "Entegratör girişi reddedildi (kullanıcı adı/parola). Kalan belgelere numara verilmedi; Entegratör Ayarları'nı düzeltip yeniden deneyin.";
  test("Ek 1 (tur): yanlış parolada Tümünü Gönder ilk girişte durur; HİÇBİR belge numara almaz; parola düzelince hepsi sırayla gider", async () => {
    const ctx = await setup();
    open.push(ctx);
    const acc = [];
    for (let i = 0; i < 2; i += 1) acc.push((await ctx.api.post("/api/workspace/accounts", retail(i))).data.id);
    const docs = [];
    for (let i = 0; i < 4; i += 1) docs.push(await ctx.sale(i < 2 ? acc[i] : ctx.people[i - 2], { issueDate: ctx.day(-5 + i), eSend: "later" }));
    await wrongPassword(ctx);
    const r = await ctx.api.post("/api/workspace/invoices/send-pending", { all: true });
    assert.equal(r.status, 200, JSON.stringify(r.data).slice(0, 300));
    assert.deepEqual(r.data.stopped, { code: "integrator-login", message: LOGIN_TEXT });
    assert.equal(r.data.sent, 0);
    const cards = await Promise.all(docs.map(d => ctx.card(d.id)));
    assert.deepEqual(cards.map(c => c.number), ["", "", "", ""], "hiçbir belge numara almadı");
    assert.ok(cards.every(c => c.eStatus === "waiting"), "hepsi Gönderilecekler'de");
    assert.equal(ctx.sends(), 0);
    assert.equal(ctx.edm.state.calls.filter(call => call.op === "Login").length, 1, "tur ilk reddedilen girişte durdu (tek giriş denemesi; hesap kilitlenmesin)");
    assert.equal((await ctx.integrator(ctx.edm.url)).status, 200);
    await ctx.sendAll();
    const after = await Promise.all(docs.map(d => ctx.card(d.id)));
    assert.equal(ctx.seriesOk(after).length, 4);
    for (const c of after) assert.equal(ctx.sentCount(c.ettn), 1);
  });

  test("Ek 1 (kartta e-Belge Gönder ve Kaydet ve Gönder): yanlış parolada numara verilmez; iletiler girişin reddedildiğini söyler", async () => {
    const ctx = await setup();
    open.push(ctx);
    const acc = (await ctx.api.post("/api/workspace/accounts", retail(1))).data.id;
    const waiting = await ctx.sale(acc, { issueDate: ctx.day(-1), eSend: "later" });
    await wrongPassword(ctx);
    const r = await ctx.api.post(`/api/workspace/invoices/${waiting.id}/send`, {});
    assert.equal(r.status, 502, JSON.stringify(r.data).slice(0, 300));
    assert.equal(r.data.code, "integrator-login");
    assert.match(String(r.data.error), /^Entegratör girişi reddedildi \(kullanıcı adı\/parola\): .+ Belge numara verilmeden Gönderilecekler'de kaldı; Entegratör Ayarları'nı düzeltip yeniden deneyin\.$/);
    assert.equal((await ctx.card(waiting.id)).number, "", "kartta Gönder: numara verilmedi");
    // TCKN'li alıcı (mükellef sorgusu girişle başlar) da aynı neden.
    const person = await ctx.sale(ctx.people[1], { issueDate: ctx.day(-1), eSend: "later" });
    const p = await ctx.api.post(`/api/workspace/invoices/${person.id}/send`, {});
    assert.equal(p.data.code, "integrator-login", JSON.stringify(p.data).slice(0, 300));
    assert.equal((await ctx.card(person.id)).number, "");
    // Kaydet ve Gönder (bugün, eski bekleyen YOK sayılsın diye ayrı seri değil: bekleyenler aynı gün değil → O1 de erteler; sıra O1'den önce giriş).
    const now = await ctx.sale(acc, { issueDate: ctx.day(-1), eSend: "now" });
    assert.equal(now.autoSend?.code, "integrator-login", JSON.stringify(now.autoSend));
    assert.match(now.autoSend.message, /^Entegratör girişi reddedildi \(kullanıcı adı\/parola\): .+ Belge numara verilmeden Gönderilecekler'e eklendi; Entegratör Ayarları'nı düzeltip Tümünü Gönder ile gönderin\.$/);
    const c = await ctx.card(now.id);
    assert.deepEqual([c.number, c.eStatus], ["", "waiting"]);
    assert.equal(ctx.sends(), 0);
  });

  test("Ek 1 (Seçilenleri Kaydet, hemen gönderim açık): yanlış parolada aynı istekte YALNIZ BİR giriş denenir; taslaklar numarasız Gönderilecekler'de, tek ileti", async () => {
    const ctx = await setup();
    open.push(ctx);
    const acc = [];
    for (let i = 0; i < 2; i += 1) acc.push((await ctx.api.post("/api/workspace/accounts", retail(i))).data.id);
    const drafts = [];
    for (const [i, accountId] of [acc[0], ctx.people[0], acc[1], ctx.people[1]].entries()) drafts.push(await ctx.sale(accountId, { issueDate: ctx.day(-4 + i), status: "draft" }));
    assert.equal((await ctx.api.put("/api/workspace/invoices/settings", { integrator: { autoSend: true } })).status, 200);
    await wrongPassword(ctx);
    const logins = () => ctx.edm.state.calls.filter(call => call.op === "Login").length;
    const before = logins();
    const bulk = await ctx.api.post("/api/workspace/invoices/bulk-issue", { ids: drafts.map(d => d.id) });
    assert.equal(bulk.status, 200, JSON.stringify(bulk.data).slice(0, 300));
    assert.equal(bulk.data.issued, 4, JSON.stringify(bulk.data.results).slice(0, 400));
    assert.equal(logins() - before, 1, `aynı istekte tek giriş denemesi (hesap kilitlenmesin): ${logins() - before}`);
    assert.match(bulk.data.notice || "", /^Entegratör girişi reddedildi \(kullanıcı adı\/parola\): .+ Belgeler numara verilmeden Gönderilecekler'e eklendi; Entegratör Ayarları'nı düzeltip Tümünü Gönder ile gönderin\.$/);
    for (const d of drafts) {
      const c = await ctx.card(d.id);
      assert.deepEqual([c.status, c.number, c.eStatus], ["issued", "", "waiting"]);
    }
    assert.equal(ctx.sends(), 0);
    assert.equal((await ctx.integrator(ctx.edm.url)).status, 200);
    await ctx.sendAll();
    const cards = await Promise.all(drafts.map(d => ctx.card(d.id)));
    assert.equal(ctx.seriesOk(cards).length, 4);
  });

  test("Ek 2 (O3 kenar): belgedeki alıcı numarası carinin şimdiki numarasından farklı ve mükellef — kartta da kalıcı engel; yeni belgeyi bekletmez", async () => {
    const ctx = await setup();
    open.push(ctx);
    const firm = await ctx.api.post("/api/workspace/accounts", { name: "Numarası Değişen Firma", type: "customer", partyKind: "company", taxNo: BUYER_VKN, taxOffice: "Kadıköy", address: "Moda 1", district: "Kadıköy", city: "İstanbul" });
    assert.equal(firm.status, 200);
    const old = await ctx.sale(firm.data.id, { issueDate: ctx.day(-3), eSend: "later" });
    assert.equal((await ctx.card(old.id)).profile, "EARSIVFATURA");
    const changed = await ctx.api.put(`/api/workspace/accounts/${firm.data.id}`, { taxNo: "1234567890" });
    assert.equal(changed.status, 200, JSON.stringify(changed.data).slice(0, 300));
    const t1 = await ctx.api.post("/api/workspace/invoices/send-pending", { all: true });
    const o1 = t1.data.results.find(x => x.id === old.id);
    assert.equal(o1?.code, "buyer-is-efatura", JSON.stringify(o1));
    assert.equal(o1.permanent, true);
    const c = await ctx.card(old.id);
    assert.equal(c.canSend, false, "kartta gönderilemez (turda kalıcı sayılan engelle tutarlı)");
    assert.equal(c.sendBlock, `Belgedeki alıcı numarası (${BUYER_VKN}) e-Fatura mükellefine ait; bu belge e-Arşiv olarak gönderilemez (GİB). İptal Et ile iptal edin; alıcı firmanın carisini VKN'siyle açıp faturayı ona e-Fatura olarak kesin.`);
    const checks = ctx.edm.state.calls.filter(call => call.op === "CheckUser").length;
    const t2 = await ctx.api.post("/api/workspace/invoices/send-pending", { all: true });
    assert.equal(t2.data.results.find(x => x.id === old.id)?.permanent, true);
    assert.equal(ctx.edm.state.calls.filter(call => call.op === "CheckUser").length, checks, "ikinci turda yeniden sorulmaz");
    const now = await ctx.sale(ctx.people[1], { issueDate: ctx.day(0), eSend: "now" });
    assert.equal(now.autoSend?.ok, true, `yeni belge bekletilmez: ${JSON.stringify(now.autoSend)}`);
  });

  // Dar kontrol 2.4.3 ek 6–9 (bağımsız kâhin, kahin-243 senaryoları; ana oturum yeniden üretti).
  test("Ek 6 (kâhin hedefli-ag-yokken-numara): oturum önbellekteyken ağ kesilir — Kaydet ve Gönder numara vermez; ileti; bağlantı gelince sırayla gider", async () => {
    const ctx = await setup();
    open.push(ctx);
    const acc = (await ctx.api.post("/api/workspace/accounts", retail(1))).data.id;
    const first = await ctx.sale(acc, { issueDate: ctx.day(-2), eSend: "now" });
    assert.equal(first.autoSend?.ok, true, "ön koşul: ağ varken gönderildi (oturum önbellekte)");
    ctx.net.down = true;
    const archive = await ctx.sale(acc, { issueDate: ctx.day(-1), eSend: "now" });
    const person = await ctx.sale(ctx.people[1], { issueDate: ctx.day(-1), eSend: "now" });
    for (const saved of [archive, person]) {
      assert.equal(saved.number, "", `ağ yokken numara verilmedi (${saved.number})`);
      assert.equal(saved.autoSend?.code, "integrator-unreachable", JSON.stringify(saved.autoSend));
      assert.equal(saved.autoSend.message, "EDM'ye ulaşılamadı; belge numarasız Gönderilecekler'e eklendi, bağlantı gelince Tümünü Gönder ile gönderin.");
      assert.equal((await ctx.card(saved.id)).eStatus, "waiting");
    }
    // Tümünü Gönder ve kartta Gönder de ağ yokken numara vermez.
    const t = await ctx.api.post("/api/workspace/invoices/send-pending", { all: true });
    assert.equal(t.data.stopped?.code, "integrator-unreachable", JSON.stringify(t.data).slice(0, 300));
    const k = await ctx.api.post(`/api/workspace/invoices/${archive.id}/send`, {});
    assert.notEqual(k.status, 200);
    assert.deepEqual([(await ctx.card(archive.id)).number, (await ctx.card(person.id)).number], ["", ""]);
    ctx.net.down = false;
    await ctx.sendAll();
    const cards = await Promise.all([first, archive, person].map(d => ctx.card(d.id)));
    assert.equal(ctx.seriesOk(cards).length, 3);
    for (const c of cards) assert.equal(ctx.sentCount(c.ettn), 1);
  });

  test("Ek 7 (kâhin kucuk-esz-gonderiliyor-hata): iki oturum aynı anda Tümünü Gönder — öbür oturumda gönderilen belge ikinci yanıtta hata değil", async () => {
    const ctx = await setup({ sendDelayMs: 600, checkDelayMs: 0 });
    open.push(ctx);
    const acc = (await ctx.api.post("/api/workspace/accounts", retail(1))).data.id;
    const doc = await ctx.sale(acc, { issueDate: ctx.day(0), eSend: "later" });
    const other = ctx.server.client();
    await other.login("admin", ADMIN_PASSWORD);
    const [a, b] = await Promise.all([ctx.api.post("/api/workspace/invoices/send-pending", { all: true }), sleep(150).then(async () => unwrap(await other.post("/api/workspace/invoices/send-pending", { all: true })))]);
    const items = [...a.data.results, ...b.data.results].filter(item => item.id === doc.id);
    assert.equal(items.length, 2, `ön koşul: iki yanıt da belgeyi gördü (${JSON.stringify(items)})`);
    for (const item of items) assert.equal(item.ok, true, `hata değil: ${JSON.stringify(item)}`);
    const second = items.find(item => item.done);
    assert.ok(second, `ön koşul: ikinci oturum belgeyi gönderilirken gördü (${JSON.stringify(items)})`);
    assert.equal(second.message, "Bu belge başka oturumda gönderildi.");
    assert.equal(a.data.failed + b.data.failed, 0);
    assert.equal(a.data.sent + b.data.sent, 1, "gönderilen sayısı bir");
    assert.equal(ctx.sentCount((await ctx.card(doc.id)).ettn), 1);
  });

  test("Ek 8 (kâhin kucuk-fis-sira): Müşteri Fişi Olarak Bırak, FIS serisinin son fişinden eski tarihli belgeye fiş numarası vermez (reddeder); aynı/yeni tarih serbest", async () => {
    const ctx = await setup();
    open.push(ctx);
    const older = await ctx.sale(ctx.people[0], { issueDate: ctx.day(-3), eSend: "later" });
    const newer = await ctx.sale(ctx.people[1], { issueDate: ctx.day(-1), eSend: "later" });
    const w1 = await ctx.api.post(`/api/workspace/invoices/${newer.id}/withdraw`, {});
    assert.equal(w1.status, 200, JSON.stringify(w1.data).slice(0, 300));
    const fis = w1.data.number;
    assert.match(fis, /^FIS2026/);
    const w2 = await ctx.api.post(`/api/workspace/invoices/${older.id}/withdraw`, {});
    assert.equal(w2.status, 409, JSON.stringify(w2.data).slice(0, 300));
    assert.equal(w2.data.code, "chronology");
    assert.equal(w2.data.error, `FIS serisinde son belge ${fis} ${ctx.day(-1).split("-").reverse().join(".")} tarihli; bu belge (${ctx.day(-3).split("-").reverse().join(".")}) ondan eski. Belgenin tarihini düzeltin ya da İptal Edin.`);
    const c = await ctx.card(older.id);
    assert.deepEqual([c.eStatus, c.number], ["waiting", ""], "belge Gönderilecekler'de, numarasız kaldı");
    const sameDay = await ctx.sale(ctx.people[2], { issueDate: ctx.day(-1), eSend: "later" });
    assert.equal((await ctx.api.post(`/api/workspace/invoices/${sameDay.id}/withdraw`, {})).status, 200, "aynı tarih serbest");
    // FIS serisinde numara sırası = tarih sırası.
    const fisRows = ctx.server.app.store.all("SELECT number, issue_date AS d FROM invoices WHERE series = 'FIS' AND seq > 0 ORDER BY seq");
    for (let i = 1; i < fisRows.length; i += 1) assert.ok(fisRows[i].d >= fisRows[i - 1].d, JSON.stringify(fisRows));
  });

  test("Ek 9 (kâhin kucuk-o1-pk-yok-bekletir, I19): PK'sız eski e-Fatura yeni e-Faturayı bekletir (doğru) — her gönderilmeyen sonucun kodu ve iletisi dolu", async () => {
    const ctx = await setup();
    open.push(ctx);
    const multi = (await ctx.api.post("/api/workspace/accounts", { name: "Çok Kutulu Ticaret A.Ş.", type: "customer", partyKind: "company", taxNo: MULTI_VKN, taxOffice: "Kavaklıdere", address: "Cinnah Cd. 12", district: "Çankaya", city: "Ankara", eInvoice: true, eAlias: "" })).data;
    const firm = (await ctx.api.post("/api/workspace/accounts", { name: "Alıcı Ticaret A.Ş.", type: "customer", partyKind: "company", taxNo: BUYER_VKN, taxOffice: "Kavaklıdere", address: "Cinnah Cd. 10", district: "Çankaya", city: "Ankara", eInvoice: true, eAlias: "urn:mail:defaultpk@alici.com.tr" })).data;
    const old = await ctx.sale(multi.id, { issueDate: ctx.day(-2), eSend: "later" });
    const fresh = await ctx.sale(firm.id, { issueDate: ctx.day(-1), eSend: "later" });
    assert.deepEqual([old.profile, fresh.profile], ["TEMELFATURA", "TEMELFATURA"]);
    const r = await ctx.api.post("/api/workspace/invoices/send-pending", { all: true });
    const o = r.data.results.find(x => x.id === old.id);
    const f = r.data.results.find(x => x.id === fresh.id);
    assert.equal(o.code, "buyer-alias", JSON.stringify(o));
    assert.ok(!o.permanent, "geçici");
    assert.equal(f.ok, false);
    assert.equal(f.skipped, true);
    assert.equal(f.code, "einvoice-held", JSON.stringify(f));
    assert.match(f.message, /^Gönderilmedi, sırasını koruyarak bekliyor: daha eski tarihli belgenin \(.+, \d\d\.\d\d\.\d{4}\) posta kutusu seçilmeli \(Mükellef Sorgula \/ Posta Kutusu Seçin\)\. O belge gönderilince bu belge de gönderilir\.$/);
    for (const item of r.data.results.filter(x => !x.ok)) assert.ok(item.code && item.message, `kod ve ileti dolu: ${JSON.stringify(item)}`);
    assert.equal((await ctx.card(fresh.id)).number, "", "yeni belge numara almadı (GİB sırası)");
  });

  test("BİLGİ: bağlantı yokken Tümünü Gönder ilk 'EDM'ye ulaşılamadı'da durur, kalanlara numara verilmez; bağlantı gelince hepsi gider", async () => {
    const ctx = await setup();
    open.push(ctx);
    const acc = [];
    for (let i = 0; i < 2; i += 1) acc.push((await ctx.api.post("/api/workspace/accounts", retail(i))).data.id);
    const docs = [];
    for (let i = 0; i < 6; i += 1) docs.push(await ctx.sale(acc[i % 2], { issueDate: ctx.day(-6 + i), eSend: "later" }));
    await ctx.integrator(DEAD);
    const r1 = await ctx.api.post("/api/workspace/invoices/send-pending", { all: true });
    assert.equal(r1.status, 200);
    assert.deepEqual(r1.data.stopped, { code: "integrator-unreachable", message: "EDM'ye ulaşılamadı; bağlantı gelince yeniden deneyin." });
    assert.equal(r1.data.sent, 0);
    const c1 = await Promise.all(docs.map(d => ctx.card(d.id)));
    assert.ok(c1.filter(c => c.number).length <= 1, `en çok bir belge numara aldı (${c1.filter(c => c.number).length})`);
    assert.equal(r1.data.remaining, 5, "kalanlar sayıldı");
    await ctx.integrator(ctx.edm.url);
    await ctx.sendAll();
    const c2 = await Promise.all(docs.map(d => ctx.card(d.id)));
    ctx.seriesOk(c2);
    assert.equal(c2.filter(c => c.number).length, 6);
    for (const c of c2) assert.ok(ctx.sentCount(c.ettn) <= 1, `${c.number} çift gönderilmedi`);
  });
});
