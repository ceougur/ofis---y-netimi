// Gözden geçirme 2.4.3 (bağımsız gözden geçirici, gg243) — e-Belge "Tümünü Gönder" çekirdeği. Sahte EDM; ağa çıkmaz; sahte saat (ders 13).
//   S2  YÜKSEK  "Tümünü Gönder" yalnız yüklü sayfanın (≤200) kimliklerini gönderiyordu; listede olmayan daha eski bekleyenler kronoloji engeline düşüp
//               kalıcı olarak gönderilemiyordu (203 bekleyen → 200 gitti, en eski 3 "waiting" + canSend=false). Artık istemci { all: true } der, sunucu
//               Gönderilecekler'in tamamını eskiden yeniye gönderir (bir turda en eski 200; kalan sayısı döner). Seçili kimliklerle gönderim de daha
//               eski numarasız bekleyenden önce yenisini numaralandırmaz.
//   S1  ORTA    (2.4.3 gerilemesi) kronoloji yüzünden KALICI olarak gönderilemeyen eski belge, aynı serideki gönderilebilir yeni belgeyi bekletiyordu.
//               Bekletme yalnız geçici / düzeltilebilir başarısızlıkta; B1 koruması (geçici hatada yeni belge eski numarasızın önüne geçmez) sürer.
//   S3  BİLGİ   iki kişi aynı anda Tümünü Gönder: ikinci kişiye "daha eski tarihli belge gönderilemedi" yerine doğru neden (başka oturumda gönderiliyor);
//               her belge EDM'ye bir kez.
//   5b  BİLGİ   canlı ortamda test serili (TEF/TEA/TES) numaralı gönderilmemiş belge: rozet "Gönderilmedi" (eUnsent) ama Gönderilecekler'de sayılmıyordu.
// Nasıl bozulur: 200'den fazla bekleyen; eski belgeler sayfa dışında; seride daha yeni numara verilmiş eski belge; bağlantı kopukken eski belge;
// iki istek aynı anda; canlı ortama geçişte test serili belge.
import assert from "node:assert/strict";
import { after, describe, test } from "node:test";
import { resetEdmCaches } from "../server/lib/einvoice/edm.mjs";
import { OUR_VKN, startMockEdm } from "./einvoice-mock.mjs";
import { ADMIN_PASSWORD, startTestServer } from "./helpers.mjs";

const unwrap = response => ({ ...response, data: response.data && typeof response.data === "object" && "ok" in response.data ? (response.data.ok ? response.data.data : response.data) : response.data });
const SELLER = { name: "Deneme Ofis Ltd.", taxNo: OUR_VKN, taxOffice: "Çankaya", address: "Atatürk Blv. 1", district: "Çankaya", city: "Ankara", email: "bilgi@deneme.com.tr" };
const person = (name, taxNo) => ({ name, type: "customer", partyKind: "person", firstName: name.split(" ")[0], familyName: name.split(" ").slice(1).join(" ") || "Kişi", taxNo, taxOffice: "Konak", address: "Kordon 1", district: "Konak", city: "İzmir" });
const LINES = [{ name: "Danışmanlık", qty: 1, unitPrice: 500, vatRate: 20 }];
const DEAD = "http://127.0.0.1:9/EFaturaEDM21ea/EFaturaEDM.svc";
const sleep = ms => new Promise(resolve => setTimeout(resolve, ms));

// Her senaryo kendi sunucusu ve sahte EDM'siyle (seri durumu birbirini etkilemesin).
async function setup({ sendDelayMs = 0, edocLive = false } = {}) {
  resetEdmCaches();
  const edm = await startMockEdm();
  const fetchImpl = async (input, init) => {
    const url = String(typeof input === "string" || input instanceof URL ? input : input.url);
    if (!url.startsWith("http://127.0.0.1")) throw new Error(`ağa çıkılmaz (test): ${url}`);
    // S3: mükellef sorgusu ve gönderim isteği yavaş (ön koşul: ikinci istek, birincinin tuttuğu ve henüz NUMARA ALMAMIŞ belgeye denk gelir).
    if (sendDelayMs && /CheckUserRequest|SendInvoiceRequest/.test(String(init?.body || ""))) await sleep(sendDelayMs);
    return globalThis.fetch(input, init);
  };
  const server = await startTestServer({ edocEnabled: true, ...(edocLive ? { edocLive: true } : {}), fetchImpl, now: "2026-06-17T09:00:00", edocStatusPollMs: [5, 5], env: { HUKUK_LICENSE_URL: "http://127.0.0.1:9" } });
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
  const close = async () => {
    await server.close();
    await edm.close();
  };
  return { edm, server, client, api, integrator, people, day, sale, card, pendingTab, sends, sentCount, close };
}
const seqOf = number => Number(String(number).slice(7));

describe("gg243: Tümünü Gönder — bütün Gönderilecekler, kalıcı engel, eşzamanlı gönderim, canlıda test serisi", () => {
  const open = [];
  after(async () => {
    for (const ctx of open) await ctx.close();
  });

  // Dar kontrol 2.4.3 (Y1 — beklenti BİLEREK değişti): bir istek en çok 20 belgeyi dener (ya da 10 sn bütçe); önceden 200'dü. İstemci kalan bitene dek
  // yineler (hof-invoices.js sendPending). Özellik aynı: en eskiler önce, kalan sayısı doğru, sonunda 203'ü de bir kez gider.
  test("S2: 203 bekleyen — Tümünü Gönder (all) hepsini eskiden yeniye gönderir; bir istekte en eski 20, kalan sayısı söylenir; numara tarih sırasında", async () => {
    const ctx = await setup();
    open.push(ctx);
    const older = [];
    for (let i = 0; i < 3; i += 1) older.push((await ctx.sale(ctx.people[i % 3], { issueDate: ctx.day(-6), eSend: "later" })).id);
    const newer = [];
    for (let i = 0; i < 200; i += 1) newer.push((await ctx.sale(ctx.people[i % 3], { issueDate: ctx.day(-5), eSend: "later" })).id);
    const page = await ctx.pendingTab();
    assert.equal(page.total, 203);
    assert.equal(page.invoices.length, 200, "ekrandaki sayfa 200 satır");
    assert.ok(older.every(id => !page.invoices.some(item => item.id === id)), "ön koşul: en eski 3 belge sayfada değil");
    assert.equal(page.tabCounts.pending, 203);
    assert.equal(page.pendingTotal, 203, "Tümünü Gönder düğmesinin sayısı = Gönderilecekler toplamı (sekme sayısı)");
    const first = await ctx.api.post("/api/workspace/invoices/send-pending", { all: true });
    assert.equal(first.status, 200, JSON.stringify(first.data));
    assert.equal(first.data.sent, 20, JSON.stringify(first.data).slice(0, 400));
    assert.equal(first.data.remaining, 183, "bir istekte en çok 20; kalan sayısı");
    for (const id of older) assert.equal((await ctx.card(id)).eStatus !== "waiting", true, "en eski belgeler ilk istekte gönderildi");
    let total = first.data.sent;
    let last = first.data;
    for (let turn = 0; turn < 20 && last.remaining; turn += 1) {
      last = (await ctx.api.post("/api/workspace/invoices/send-pending", { all: true })).data;
      assert.equal(last.remaining, Math.max(0, 203 - total - last.sent), "kalan sayısı her istekte doğru");
      total += last.sent;
    }
    assert.equal(total, 203);
    assert.equal(last.remaining, 0);
    assert.equal((await ctx.pendingTab()).tabCounts.pending, 0, "Gönderilecekler boşaldı");
    const docs = await Promise.all([...older, ...newer].map(ctx.card));
    for (const doc of docs) {
      assert.equal(doc.canSend, false, `${doc.number}`);
      assert.equal(ctx.sentCount(doc.ettn), 1, `${doc.number} EDM'ye bir kez`);
    }
    const oldMax = Math.max(...docs.slice(0, 3).map(doc => seqOf(doc.number)));
    const newMin = Math.min(...docs.slice(3).map(doc => seqOf(doc.number)));
    assert.ok(oldMax < newMin, `eski tarihli belgeler daha küçük numara aldı (${oldMax} < ${newMin})`);
  });

  test("S2 komşu: seçili kimliklerle gönderim, gönderime dahil olmayan daha eski numarasız bekleyenden önce yenisini numaralandırmaz", async () => {
    const ctx = await setup();
    open.push(ctx);
    const old = await ctx.sale(ctx.people[0], { issueDate: ctx.day(-3), eSend: "later" });
    const fresh = [await ctx.sale(ctx.people[1], { issueDate: ctx.day(-1), eSend: "later" }), await ctx.sale(ctx.people[2], { issueDate: ctx.day(0), eSend: "later" })];
    // Eski belge ile AYNI günlü belge sırayı bozmaz (kronoloji katı: daha yeni tarih) — o gönderilir.
    const sameDay = await ctx.sale(ctx.people[2], { issueDate: ctx.day(-3), eSend: "later" });
    const before = ctx.sends();
    const result = await ctx.api.post("/api/workspace/invoices/send-pending", { ids: [...fresh.map(doc => doc.id), sameDay.id] });
    assert.equal(result.status, 200, JSON.stringify(result.data));
    const byId = Object.fromEntries(result.data.results.map(item => [item.id, item]));
    assert.equal(byId[sameDay.id].ok, true, JSON.stringify(byId[sameDay.id]));
    for (const doc of fresh) {
      assert.equal(byId[doc.id].ok, false, JSON.stringify(byId[doc.id]));
      assert.equal(byId[doc.id].skipped, true);
      assert.match(byId[doc.id].message, /Gönderilecekler'de ve bu gönderime dahil değil/);
      assert.equal((await ctx.card(doc.id)).number, "", "yeni belge numara almadı");
    }
    assert.equal(ctx.sends() - before, 1, "yalnız aynı günlü belge gitti");
    assert.equal((await ctx.card(old.id)).canSend, true, "eski belge hâlâ gönderilebilir");
    const all = await ctx.api.post("/api/workspace/invoices/send-pending", { all: true });
    assert.equal(all.data.sent, 3, JSON.stringify(all.data.results));
  });

  test("S1: kalıcı kronoloji engelli eski belge, gönderilebilir yeni belgeyi bekletmez; iletisi Listeden Sil / İptal Et yolunu söyler", async () => {
    const ctx = await setup();
    open.push(ctx);
    const sent = await ctx.sale(ctx.people[0], { issueDate: ctx.day(0), eSend: "now" });
    assert.equal(sent.autoSend?.ok, true, JSON.stringify(sent.autoSend));
    // Dar kontrol 2 (B5): D-1 ile "Kes, Sonra Gönder" artık kayıtta reddedilir; kalıcı engelli eski belge eski sürüm verisindeki gibi kurulur.
    const old = await ctx.sale(ctx.people[1], { issueDate: ctx.day(0), eSend: "later" });
    ctx.server.app.store.run("UPDATE invoices SET issue_date = ? WHERE id = ?", ctx.day(-1), old.id);
    const fresh = await ctx.sale(ctx.people[2], { issueDate: ctx.day(0), eSend: "later" });
    const oldCard = await ctx.card(old.id);
    assert.equal(oldCard.canSend, false, "ön koşul: eski belge kalıcı engelli");
    assert.ok(oldCard.sendBlock, "ön koşul: kartta neden yazıyor");
    for (const body of [{ ids: [fresh.id, old.id] }, { all: true }]) {
      const before = ctx.sends();
      const result = await ctx.api.post("/api/workspace/invoices/send-pending", body);
      assert.equal(result.status, 200, JSON.stringify(result.data));
      const byId = Object.fromEntries(result.data.results.map(item => [item.id, item]));
      if (body.ids) {
        assert.equal(byId[fresh.id].ok, true, `yeni belge gönderildi: ${JSON.stringify(byId[fresh.id])}`);
        assert.equal(ctx.sends() - before, 1);
      }
      assert.equal(byId[old.id].ok, false);
      assert.ok(!byId[old.id].skipped, "kalıcı engelli belge 'bekletildi' sayılmaz");
      assert.match(byId[old.id].message, /Listeden Sil/);
      assert.match(byId[old.id].message, /İptal Et/);
    }
    assert.match((await ctx.card(fresh.id)).number, /^TEA2026/);
    assert.match(oldCard.sendBlock, /Listeden Sil/);
    assert.match(oldCard.sendBlock, /İptal Et/);
  });

  test("B1 korunur: eski belge GEÇİCİ nedenle (bağlantı) gönderilemezse aynı serideki yeni belge numara almaz; bağlantı düzelince ikisi de sırayla gider", async () => {
    const ctx = await setup();
    open.push(ctx);
    const old = await ctx.sale(ctx.people[0], { issueDate: ctx.day(-1), eSend: "later" });
    const fresh = await ctx.sale(ctx.people[1], { issueDate: ctx.day(0), eSend: "later" });
    assert.equal((await ctx.integrator(DEAD)).status, 200);
    let result;
    try {
      // Eski sürümle karşılaştırılabilsin diye kimliklerle (bu koruma 52bacd3'te de vardı; gerileme denetimi). { all: true } aynı yolu kullanır.
      result = await ctx.api.post("/api/workspace/invoices/send-pending", { ids: [fresh.id, old.id] });
    } finally {
      assert.equal((await ctx.integrator(ctx.edm.url)).status, 200);
    }
    assert.equal(result.status, 200, JSON.stringify(result.data));
    const byId = Object.fromEntries(result.data.results.map(item => [item.id, item]));
    assert.equal(byId[old.id].ok, false);
    assert.ok(!byId[old.id].skipped);
    assert.equal(byId[fresh.id].skipped, true, JSON.stringify(byId[fresh.id]));
    // Dar kontrol 2.4.3 (bilgi, r7 — beklenti BİLEREK değişti): bağlantı yokken tur ilk "EDM'ye ulaşılamadı"da durur; kalan belge "numara verilmedi"
    // diye listelenir (önceden "sırasını koruyarak" bekletiliyordu; ikisinde de numara almaz).
    assert.match(byId[fresh.id].message, /numara verilmedi.*EDM'ye ulaşılamadı/);
    assert.equal(result.data.stopped?.code, "integrator-unreachable");
    assert.equal((await ctx.card(fresh.id)).number, "", "yeni belge numara almadı");
    const again = await ctx.api.post("/api/workspace/invoices/send-pending", { ids: [fresh.id, old.id] });
    assert.equal(again.data.sent, 2, JSON.stringify(again.data.results));
    const [a, b] = [await ctx.card(old.id), await ctx.card(fresh.id)];
    assert.equal(seqOf(b.number), seqOf(a.number) + 1, `${a.number} → ${b.number}`);
  });

  test("B1 korunur ({ all: true }): geçici hatada yeni belge eski numarasızın önüne geçmez", async () => {
    const ctx = await setup();
    open.push(ctx);
    const old = await ctx.sale(ctx.people[0], { issueDate: ctx.day(-1), eSend: "later" });
    const fresh = await ctx.sale(ctx.people[1], { issueDate: ctx.day(0), eSend: "later" });
    assert.equal((await ctx.integrator(DEAD)).status, 200);
    let result;
    try {
      result = await ctx.api.post("/api/workspace/invoices/send-pending", { all: true });
    } finally {
      assert.equal((await ctx.integrator(ctx.edm.url)).status, 200);
    }
    const byId = Object.fromEntries(result.data.results.map(item => [item.id, item]));
    assert.equal(byId[old.id].ok, false);
    // Dar kontrol 2.4.3 (bilgi, r7 — beklenti BİLEREK değişti): tur durur; yeni belgeye hiç ulaşılmaz (kalan sayısında), numara almaz.
    assert.equal(byId[fresh.id], undefined, JSON.stringify(result.data));
    assert.equal(result.data.remaining, 1);
    assert.equal(result.data.stopped?.code, "integrator-unreachable");
    assert.equal((await ctx.card(fresh.id)).number, "");
    const again = await ctx.api.post("/api/workspace/invoices/send-pending", { all: true });
    assert.equal(again.data.sent, 2, JSON.stringify(again.data.results));
  });

  for (const mode of ["ids", "all"]) {
    test(`S3 (${mode}): iki kişi aynı anda Tümünü Gönder — her belge EDM'ye bir kez; ikinci kişiye 'başka oturumda gönderildi' (hata değil)`, async () => {
      await s3(mode);
    });
  }
  async function s3(mode) {
    const ctx = await setup({ sendDelayMs: 250 });
    open.push(ctx);
    const docs = [];
    for (let i = 0; i < 6; i += 1) docs.push(await ctx.sale(ctx.people[i % 3], { issueDate: ctx.day(-4 + (i % 3)), eSend: "later" }));
    const other = ctx.server.client();
    assert.equal((await other.login("admin", ADMIN_PASSWORD)).status, 200);
    const before = ctx.sends();
    const body = mode === "all" ? { all: true } : { ids: docs.map(doc => doc.id) };
    const [a, b] = await Promise.all([ctx.api.post("/api/workspace/invoices/send-pending", body), sleep(40).then(async () => unwrap(await other.post("/api/workspace/invoices/send-pending", body)))]);
    assert.equal(a.status, 200, JSON.stringify(a.data));
    assert.equal(b.status, 200, JSON.stringify(b.data));
    const cards = await Promise.all(docs.map(doc => ctx.card(doc.id)));
    assert.equal(ctx.sends() - before, 6, "EDM'ye toplam 6 gönderim");
    for (const doc of cards) assert.equal(ctx.sentCount(doc.ettn), 1, `${doc.number} bir kez`);
    assert.equal(a.data.sent + b.data.sent, 6);
    // Dar kontrol 2.4.3 (kâhin BASKA-ESZ — beklenti BİLEREK değişti): ikinci istek öbür oturumun gönderdiği belgede gönderimin bitmesini bekler;
    // belge gittiyse "başka oturumda gönderildi" (ok, done; gönderilen sayısına girmez), hiçbir belge hata ya da bekletme olarak dönmez.
    const others = b.data.results.filter(item => item.done);
    assert.ok(others.length > 0, `ön koşul: ikinci istek birincinin tuttuğu belgeye denk geldi (${JSON.stringify(b.data).slice(0, 300)})`);
    for (const item of others) {
      assert.equal(item.ok, true);
      assert.equal(item.message, "Bu belge başka oturumda gönderildi.");
    }
    for (const r of [a, b]) {
      assert.equal(r.data.failed, 0, JSON.stringify(r.data.results.filter(item => !item.ok)));
      assert.ok(r.data.results.every(item => item.ok), JSON.stringify(r.data.results.filter(item => !item.ok)));
    }
    const ordered = [...cards].sort((x, y) => x.issueDate.localeCompare(y.issueDate));
    for (let i = 1; i < ordered.length; i += 1) assert.ok(seqOf(ordered[i].number) > seqOf(ordered[i - 1].number) || ordered[i].issueDate === ordered[i - 1].issueDate, "numara tarih sırasında");
  }

  test("5b: canlı ortamda test serili numaralı gönderilmemiş belge — rozet ve Gönderilecekler tutarlı; 'Test serisi canlıda gönderilmez; İptal Edin'", async () => {
    const ctx = await setup({ edocLive: true });
    open.push(ctx);
    // Dar kontrol 2.4.3 (kâhin BEKLENEN-AG): ağ yokken Kaydet ve Gönder artık numara vermez; numaralı gönderilmemiş belge düz Kaydet ile oluşur.
    assert.equal((await ctx.integrator(DEAD)).status, 200);
    const doc = await ctx.sale(ctx.people[0], {});
    assert.match(doc.number, /^TEA2026/, "ön koşul: test serisinden numara aldı, gönderilemedi");
    const inTest = await ctx.card(doc.id);
    assert.equal(inTest.eUnsent, true, "test ortamında Gönderilmedi");
    assert.equal((await ctx.pendingTab()).tabCounts.pending, 1);
    assert.equal((await ctx.api.put("/api/workspace/invoices/settings", { integrator: { env: "live", baseUrl: "", username: "edmkullanici", password: "Gizli-Parola-1" } })).status, 200);
    const pending = await ctx.pendingTab();
    assert.equal(pending.tabCounts.pending, 0, "canlıda Gönderilecekler'de sayılmaz");
    const listed = (await ctx.api.get("/api/workspace/invoices?tab=all")).data.invoices.find(item => item.id === doc.id);
    const live = await ctx.card(doc.id);
    for (const view of [listed, live]) {
      assert.equal(view.eUnsent, false, "rozet 'Gönderilmedi' demez (Gönderilecekler ile tutarlı)");
      assert.equal(view.eTestLive, true);
      assert.equal(view.eStatusLabel, "Test Serisi");
    }
    assert.equal(live.canSend, false, "canlıda gönderilemez");
    assert.match(live.sendBlock, /canlı ortamda gönderilmez/);
    assert.match(live.sendBlock, /İptal Et/);
    const all = await ctx.api.post("/api/workspace/invoices/send-pending", { all: true });
    assert.equal(all.data.results.length, 0, "Tümünü Gönder bu belgeye dokunmaz");
  });
});
