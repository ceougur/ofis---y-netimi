// 2.4.3 — e-Belge gönderim yolu (keşif B1, B3; fatura hız testi H1, H4, H7). Sahte EDM; ağa çıkmaz; sahte saat (ders 13).
//   B1  "Tümünü Gönder" kimlikleri istemcinin sırasıyla (yeniden eskiye) gönderiyordu: en yeni belge numarayı alınca eski tarihliler e-Belge olamıyordu.
//   B3  Toplu kesilen (Seçilenleri Kaydet) e-Arşiv taslağı numara alıp gönderilmiyor, Gönderilecekler'de görünmüyordu.
//   H1  "Kaydet ve Gönder"de entegratöre ulaşılamazsa belge numara alıp e-durumsuz kalıyor, Gönderilecekler'de görünmüyordu.
//   H4  Karşı tarafın boşta kapattığı keep-alive bağlantısı yeniden kullanılınca "EDM'ye bağlanılamadı: UND_ERR_SOCKET".
//   H7  Gönderilmiş e-Arşivi iptal etmek için önce elle Durum Sorgula gerekiyordu ("henüz işleniyor").
// Nasıl bozulur: belgeleri ters sırayla yaz; aynı serideki eski belge gönderilemesin; EDM kapalıyken Kaydet ve Gönder (e-Arşiv ve e-Fatura); bağlantı
// düzelince Tümünü Gönder iki kez; yeniden kullanılan bağlantıda yan etkili / yan etkisiz çağrı; iptal hemen ve uzun işlenme.
import assert from "node:assert/strict";
import { after, before, describe, test } from "node:test";
import { resetEdmCaches } from "../server/lib/einvoice/edm.mjs";
import { BUYER_VKN, MULTI_VKN, OUR_VKN, startMockEdm } from "./einvoice-mock.mjs";
import { ADMIN_PASSWORD, startTestServer } from "./helpers.mjs";

const unwrap = response => ({ ...response, data: response.data && typeof response.data === "object" && "ok" in response.data ? (response.data.ok ? response.data.data : response.data) : response.data });
const SELLER = { name: "Deneme Ofis Ltd.", taxNo: OUR_VKN, taxOffice: "Çankaya", address: "Atatürk Blv. 1", district: "Çankaya", city: "Ankara", email: "bilgi@deneme.com.tr" };
const person = (name, taxNo) => ({ name, type: "customer", partyKind: "person", firstName: name.split(" ")[0], familyName: name.split(" ").slice(1).join(" ") || "Kişi", taxNo, taxOffice: "Konak", address: "Kordon 1", district: "Konak", city: "İzmir" });
const LINES = [{ name: "Danışmanlık", qty: 1, unitPrice: 500, vatRate: 20 }];
const DEAD = "http://127.0.0.1:9/EFaturaEDM21ea/EFaturaEDM.svc";

describe("2.4.3: e-Belge gönderim sırası, bekleyen belgelerin görünürlüğü, kopan bağlantı, iptalde durum", () => {
  let edm;
  let server;
  let api;
  let people;
  let firmId;
  let today;
  const fetchImpl = async (input, init) => {
    const url = String(typeof input === "string" || input instanceof URL ? input : input.url);
    if (!url.startsWith("http://127.0.0.1")) throw new Error(`ağa çıkılmaz (test): ${url}`);
    return globalThis.fetch(input, init);
  };
  const day = offset => {
    const [y, m, d] = today.split("-").map(Number);
    return new Date(Date.UTC(y, m - 1, d + offset)).toISOString().slice(0, 10);
  };
  const card = async id => (await api.get(`/api/workspace/invoices/${id}`)).data;
  const sale = (accountId, extra = {}) => api.post("/api/workspace/invoices", { scenario: "service_sale", accountId, lines: LINES, payment: { rest: "open" }, ...extra });
  const pendingTab = async () => (await api.get("/api/workspace/invoices?tab=pending")).data;
  const integrator = baseUrl => api.put("/api/workspace/invoices/settings", { integrator: { env: "test", baseUrl, username: "edmkullanici", password: "Gizli-Parola-1", senderAlias: "urn:mail:defaultgb@deneme.com.tr" } });
  const sentCount = ettn => edm.state.calls.filter(call => call.op === "SendInvoice" && call.raw.includes(ettn)).length;
  before(async () => {
    resetEdmCaches();
    edm = await startMockEdm();
    // Sahte saat: ayın ortasında bir Çarşamba (ders 13); akar.
    server = await startTestServer({ edocEnabled: true, fetchImpl, now: "2026-06-17T09:00:00", edocStatusPollMs: [5, 5], env: { HUKUK_LICENSE_URL: "http://127.0.0.1:9" } });
    const client = server.client();
    api = { get: async url => unwrap(await client.get(url)), post: async (url, body) => unwrap(await client.post(url, body)), put: async (url, body) => unwrap(await client.put(url, body)) };
    assert.equal((await client.login("admin", ADMIN_PASSWORD)).status, 200);
    const saved = await api.put("/api/workspace/invoices/settings", { seller: SELLER, efatura: true, earsiv: true });
    assert.equal(saved.status, 200, JSON.stringify(saved.data));
    assert.equal((await integrator(edm.url)).status, 200);
    today = (await api.get("/api/workspace/ledger/lock")).data.today;
    assert.equal(today, "2026-06-17");
    people = [];
    for (const [name, taxNo] of [["Ayşe Kaya", "10000000146"], ["Mehmet Demir", "12345678950"], ["Zeynep Şahin", "11223344550"], ["Ali Yılmaz", "10987654370"]]) {
      const created = await api.post("/api/workspace/accounts", person(name, taxNo));
      assert.equal(created.status, 200, JSON.stringify(created.data));
      people.push(created.data.id);
    }
    const firm = await api.post("/api/workspace/accounts", { name: "Alıcı Ticaret A.Ş.", type: "customer", taxNo: BUYER_VKN, taxOffice: "Kavaklıdere", address: "Cinnah Cd. 10", district: "Çankaya", city: "Ankara", eInvoice: true, eAlias: "urn:mail:defaultpk@alici.com.tr" });
    assert.equal(firm.status, 200, JSON.stringify(firm.data));
    firmId = firm.data.id;
  });
  after(async () => {
    await server?.close();
    await edm?.close();
  });

  test("B1: Tümünü Gönder (liste sırası yeniden eskiye) belgeleri tarih + yazım sırasıyla numaralar; üçü de gönderilir", async () => {
    // Yazım sırası tarihle çakışmasın: önce en yeni, sonra en eski, sonra ortadaki.
    const newest = (await sale(people[0], { issueDate: day(0), eSend: "later" })).data;
    const oldest = (await sale(people[1], { issueDate: day(-2), eSend: "later" })).data;
    const middle = (await sale(people[2], { issueDate: day(-1), eSend: "later" })).data;
    for (const doc of [newest, oldest, middle]) assert.equal(doc.eStatus, "waiting", JSON.stringify(doc));
    const listed = (await pendingTab()).invoices.map(item => item.id);
    assert.deepEqual(listed.slice(0, 3), [newest.id, middle.id, oldest.id], "liste yeniden eskiye");
    const result = await api.post("/api/workspace/invoices/send-pending", { ids: listed.slice(0, 3) });
    assert.equal(result.status, 200, JSON.stringify(result.data));
    assert.equal(result.data.sent, 3, JSON.stringify(result.data.results));
    assert.equal(result.data.failed, 0);
    const numbers = await Promise.all([oldest, middle, newest].map(async doc => (await card(doc.id)).number));
    for (const number of numbers) assert.match(number, /^TEA2026\d{9}$/);
    const seqs = numbers.map(number => Number(number.slice(7)));
    assert.deepEqual(seqs, [seqs[0], seqs[0] + 1, seqs[0] + 2], `numara tarihle aynı sırada: ${numbers.join(", ")}`);
  });

  test("B1 komşu: aynı serideki eski belge gönderilemezse daha yeni numarasız belge bu turda numara almaz (kronoloji korunur)", async () => {
    // Dar kontrol 2.4.3 (O3, baş mimar kararı — beklenti BİLEREK değişti): önceki kurgu (cari işaretsiz e-Fatura mükellefine e-Arşiv; gönderimde
    // "buyer-is-efatura") artık KALICI engeldir, seriyi bekletmez (test/gg243-dar-kontrol-gonderim.test.mjs O3). B1 korumasını sınamak için GEÇİCİ,
    // düzeltilebilir bir neden: birden çok posta kutulu mükellefin kutusu seçilmemiş e-Faturası (buyer-alias; numara verilmeden durur). Kutu
    // seçilip belge Düzenle ile yeniden kaydedilince AYNI seride numara alır — yeni belge önüne geçmemeli.
    const multi = (await api.post("/api/workspace/accounts", { name: "Çok Kutulu Ticaret A.Ş.", type: "customer", taxNo: MULTI_VKN, taxOffice: "Kavaklıdere", address: "Cinnah Cd. 12", district: "Çankaya", city: "Ankara", eInvoice: true, eAlias: "" })).data;
    const old = (await sale(multi.id, { issueDate: day(-1), eSend: "later" })).data;
    const fresh = (await sale(firmId, { issueDate: day(0), eSend: "later" })).data;
    assert.equal(old.profile, "TEMELFATURA");
    assert.equal(fresh.profile, "TEMELFATURA");
    const before = edm.state.calls.filter(call => call.op === "SendInvoice").length;
    const result = await api.post("/api/workspace/invoices/send-pending", { ids: [fresh.id, old.id] });
    assert.equal(result.status, 200, JSON.stringify(result.data));
    const byId = Object.fromEntries(result.data.results.map(item => [item.id, item]));
    assert.equal(byId[old.id].ok, false);
    assert.equal(byId[old.id].code, "buyer-alias", JSON.stringify(byId[old.id]));
    assert.ok(!byId[old.id].permanent, "geçici (düzeltilebilir)");
    assert.equal(byId[fresh.id].ok, false);
    assert.equal(byId[fresh.id].skipped, true);
    assert.match(byId[fresh.id].message, /sırasını koruyarak/);
    assert.equal((await card(fresh.id)).number, "", "yeni belge numara almadı");
    assert.equal((await card(fresh.id)).eStatus, "waiting");
    assert.equal(edm.state.calls.filter(call => call.op === "SendInvoice").length, before, "EDM'ye gönderim yok");
    // Eski belge listeden silinince (Müşteri Fişi) yeni belge gönderilir.
    assert.equal((await api.post(`/api/workspace/invoices/${old.id}/withdraw`, {})).status, 200);
    const again = await api.post("/api/workspace/invoices/send-pending", { ids: [fresh.id] });
    assert.equal(again.data.sent, 1, JSON.stringify(again.data.results));
  });

  test("B3: Seçilenleri Kaydet (otomatik gönderim kapalı) e-Arşiv taslağını numarasız Gönderilecekler'e koyar; açıkken gönderir", async () => {
    const draft = (await sale(people[0], { status: "draft" })).data;
    const before = edm.state.calls.filter(call => call.op === "SendInvoice").length;
    const bulk = await api.post("/api/workspace/invoices/bulk-issue", { ids: [draft.id] });
    assert.equal(bulk.status, 200, JSON.stringify(bulk.data));
    assert.equal(bulk.data.issued, 1, JSON.stringify(bulk.data.results));
    const doc = await card(draft.id);
    assert.equal(doc.status, "issued");
    assert.equal(doc.eStatus, "waiting", "Kes, Sonra Gönder gibi bekler");
    assert.equal(doc.number, "", "numara gönderimde verilir");
    assert.ok((await pendingTab()).invoices.some(item => item.id === draft.id), "Gönderilecekler'de görünür");
    assert.equal(edm.state.calls.filter(call => call.op === "SendInvoice").length, before);
    // Ayar açıkken toplu kesim hemen gönderir.
    assert.equal((await api.put("/api/workspace/invoices/settings", { integrator: { autoSend: true } })).status, 200);
    try {
      const draft2 = (await sale(people[1], { status: "draft" })).data;
      const bulk2 = await api.post("/api/workspace/invoices/bulk-issue", { ids: [draft2.id] });
      assert.equal(bulk2.data.issued, 1, JSON.stringify(bulk2.data.results));
      const sent = await card(draft2.id);
      assert.match(sent.number, /^TEA/);
      assert.ok(["processing", "sent"].includes(sent.eStatus), sent.eStatus);
    } finally {
      assert.equal((await api.put("/api/workspace/invoices/settings", { integrator: { autoSend: false } })).status, 200);
    }
  });

  test("H1: EDM'ye ulaşılamazken Kaydet ve Gönder — numara verilir, neden belgede yazar, Gönderilecekler'de görünür; bağlantı düzelince bir kez gönderilir", async () => {
    assert.equal((await integrator(DEAD)).status, 200);
    let archive;
    let efatura;
    try {
      archive = await sale(people[2], { eSend: "now" });
      assert.equal(archive.status, 200, JSON.stringify(archive.data));
      efatura = await sale(firmId, { eSend: "now" });
      assert.equal(efatura.status, 200, JSON.stringify(efatura.data));
    } finally {
      assert.equal((await integrator(edm.url)).status, 200);
    }
    for (const saved of [archive.data, efatura.data]) {
      assert.match(saved.number, /^TE[AF]2026/, "kayıt numara aldı");
      assert.equal(saved.autoSend?.ok, false);
      assert.equal(saved.autoSend.pending, true);
      assert.match(saved.autoSend.message, new RegExp(`${saved.number} numarasıyla kaydedildi`));
      assert.match(saved.autoSend.message, /Gönderilecekler/);
      const doc = await card(saved.id);
      assert.ok(doc.eMessage, "neden belgede yazar");
      assert.equal(doc.eUnsent, true);
      assert.equal(doc.canSend, true);
    }
    const pending = await pendingTab();
    const ids = pending.invoices.map(item => item.id);
    assert.ok(ids.includes(archive.data.id) && ids.includes(efatura.data.id), "ikisi de Gönderilecekler'de");
    assert.equal(pending.tabCounts.pending, pending.invoices.length, "sekme sayısı = liste");
    const numbers = [archive.data.number, efatura.data.number];
    const first = await api.post("/api/workspace/invoices/send-pending", { ids });
    assert.equal(first.status, 200, JSON.stringify(first.data));
    for (const saved of [archive.data, efatura.data]) {
      const row = first.data.results.find(item => item.id === saved.id);
      assert.equal(row.ok, true, JSON.stringify(row));
    }
    const second = await api.post("/api/workspace/invoices/send-pending", { ids: [archive.data.id, efatura.data.id] });
    assert.equal(second.data.sent, 0, "ikinci kez gönderilmez");
    for (const saved of [archive.data, efatura.data]) {
      const doc = await card(saved.id);
      assert.ok(numbers.includes(doc.number), "numara değişmedi");
      assert.equal(sentCount(doc.ettn), 1, `${doc.number} EDM'ye bir kez gitti`);
      assert.equal(doc.eUnsent, false);
    }
    const left = (await pendingTab()).invoices.map(item => item.id);
    assert.ok(!left.includes(archive.data.id) && !left.includes(efatura.data.id), "gönderilince listeden çıkar");
  });

  test("H4: yeniden kullanılan bağlantı koparsa yan etkisiz çağrı (mükellef sorgusu, durum) bir kez yinelenir; gönderim yinelenmez, belirsiz kalır", async () => {
    // Her sorguda tam bir kopma (resetLimit 1): ilk deneme yeniden kullanılan bağlantıda koparılır, yineleme hangi bağlantıya düşerse düşsün işlenir.
    await api.post("/api/workspace/invoices/check-user", { taxNo: BUYER_VKN }); // havuzda boşta bağlantı olsun
    try {
      for (let i = 0; i < 4; i += 1) {
        const resets = edm.state.resets.length;
        edm.state.resetOps = new Set(["CheckUser"]);
        edm.state.resetLimit = 1;
        const checked = await api.post("/api/workspace/invoices/check-user", { taxNo: BUYER_VKN });
        assert.equal(edm.state.resets.length, resets + 1, `${i}. sorguda ön koşul oluşmadı: sahte EDM bağlantıyı koparmadı`);
        assert.equal(checked.status, 200, `${i}. sorgu: ${JSON.stringify(checked.data)}`);
        assert.equal(checked.data.registered, true);
      }
    } finally {
      edm.state.resetOps = new Set();
      edm.state.resetLimit = undefined;
    }
    // Yan etkili çağrı: SendInvoice koparsa yinelenmez (istek ulaşmış olabilir) → belge "Sonucu Belirsiz", Gönderilecekler'de.
    const doc = (await sale(people[3], { eSend: "later" })).data;
    await api.post("/api/workspace/invoices/check-user", { taxNo: BUYER_VKN }); // bağlantı kullanılmış olsun
    // Yalnız ilk gönderim isteği koparılır: program yinelerse ikinci istek işlenirdi (yan etkili çağrı yinelenmemeli — mutasyonla sınandı).
    edm.state.resetOps = new Set(["SendInvoice"]);
    edm.state.resetLimit = 1;
    let sent;
    try {
      sent = await api.post(`/api/workspace/invoices/${doc.id}/send`, {});
    } finally {
      edm.state.resetOps = new Set();
      edm.state.resetLimit = undefined;
    }
    assert.equal(sent.status, 502, JSON.stringify(sent.data));
    assert.ok(edm.state.resets.includes("SendInvoice"), "ön koşul: gönderim isteği koparıldı");
    const after = await card(doc.id);
    assert.equal(after.eStatusLabel, "Sonucu Belirsiz");
    assert.ok((await pendingTab()).invoices.some(item => item.id === doc.id));
    assert.equal(sentCount(after.ettn), 0, "sahte EDM isteği işlemedi");
    const retry = await api.post("/api/workspace/invoices/send-pending", { ids: [doc.id] });
    assert.equal(retry.data.sent, 1, JSON.stringify(retry.data.results));
    assert.equal(sentCount(after.ettn), 1, "önce durum soruldu (yok), sonra bir kez gönderildi");
  });

  test("H7: gönderilmiş e-Arşiv hemen İptal Et — durum kendiliğinden yeniden sorulur, iptal edilir; uzun işlenmede açık ileti, iptal gönderilmez", async () => {
    const quick = (await sale(people[0], { eSend: "now" })).data;
    assert.equal(quick.autoSend?.ok, true, JSON.stringify(quick.autoSend));
    const cancelled = await api.post(`/api/workspace/invoices/${quick.id}/cancel`, { reason: "Müşteri vazgeçti" });
    assert.equal(cancelled.status, 200, JSON.stringify(cancelled.data));
    assert.equal(cancelled.data.status, "cancelled");
    assert.equal(cancelled.data.eStatus, "cancelled");
    const slow = (await sale(people[1], { eSend: "now" })).data;
    edm.state.statuses.set(slow.ettn, Array(6).fill("SEND - WAIT_GIB_RESPONSE").concat("SEND - SUCCEED"));
    const cancels = edm.state.calls.filter(call => call.op === "CancelInvoice").length;
    const early = await api.post(`/api/workspace/invoices/${slow.id}/cancel`, { reason: "Müşteri vazgeçti" });
    assert.equal(early.status, 409, JSON.stringify(early.data));
    assert.equal(early.data.code, "einvoice-processing");
    assert.equal(edm.state.calls.filter(call => call.op === "CancelInvoice").length, cancels, "işlenirken iptal gönderilmedi");
    const doc = await card(slow.id);
    assert.equal(doc.status, "issued");
    assert.equal(doc.eStatus, "processing", "sorgulanan durum belgeye yazıldı");
  });

  test("defter temiz (Mutabakat Testi)", async () => {
    const integrity = await api.get("/api/workspace/ledger/integrity");
    assert.equal(integrity.status, 200);
    assert.deepEqual(integrity.data.failures, [], JSON.stringify(integrity.data.failures).slice(0, 500));
  });
});
