// 2.4.4 iş listesi 22 (E1) — e-SMM gönderim kapıları ROTA düzeyinde: kayıt → Gönderilecekler → gönderim → durum → resmî görüntü → iptal; numara, kronoloji,
// kopma, belirsiz gönderim ve "EDM başka numarayla kaydetti" e-SMM'de de e-Fatura / e-Arşiv'deki güvencelerle. Gerçek EDM'ye bağlanılmaz: sahte EDM sunucusu
// (test/einvoice-mock.mjs; …/ESmmEDM.svc yolu test/esmm-mock.mjs — sözleşme EDM'nin GERÇEK e-SMM test WSDL'i). Sahte saat (ders 13); ders 30 lisans adresi.
//
// "Nasıl bozulur?" (önce yazıldı; testler buradan):
//   N1  bayrak (config.esmmEnabled) KAPALIYKEN e-SMM gönderilir / Gönderilecekler'e düşer / kartta gönder düğmesi çıkar / toplu XML'e girer
//   N2  ESMM makbuzu e-Fatura servisine (EFaturaEDM.svc) gider — giriş (numara vermeden önceki erişim denetimi) ya da gönderim yanlış serviste
//   N3  e-Arşiv belgesi e-SMM servisine gider
//   N4  seri karışır (ESMM numarası e-Arşiv serisinden ya da tersi; "Kes, Sonra Gönder"de numara yanlış seriden)
//   N5  kronoloji: daha eski tarihli bekleyen makbuz varken yenisi numara alır; seride daha yeni numara varken eski makbuz gönderilir
//   N6  iki oturum aynı anda gönderir → EDM'ye iki kez gider
//   N7  belirsiz gönderim (EDM aldı, yanıt gelmedi) → yeniden gönderimde makbuz ikinci kez gider; e-SMM'de doğrulanmamış "bulunamadı" koduna güvenilip
//       belirsiz makbuz temizlenir / yeniden gönderilir
//   N8  kopma (bağlantı hiç kurulamadı) → numara harcanır (seride boşluk)
//   N9  EDM makbuzu başka numarayla kaydeder → program sessizce "gönderildi" der (defter ile resmî belge ayrışır)
//   N10 iptal: e-SMM iptali e-Fatura servisine gider ya da hiç gitmez; iletimden 8 gün sonra iptal edilir
//   N11 002 şirketi: e-SMM 001'in ayarıyla / servisiyle gider
//   N12 eski sürüm verisi: v2.4.3'ün kâğıt SMM'si ve v2.4.0'ın numaralı ESMM makbuzu (ayrı dosya: test/goc-244-esmm-gonderim.test.mjs)
//   N13 portala taslak ayarı açıkken e-SMM taslak yolu denenir → reddedilip belge "Sonucu Belirsiz"e düşer
//   N14 Müşteri Fişi Olarak Bırakılmış e-SMM yeniden gönderilince kâğıt / yanlış servis
//   N15 Entegratör Ayarları → Bağlantıyı Test Et e-SMM servisini denemez (e-Fatura girişi e-SMM'nin çalıştığını göstermez)
// Kâhin: gerçek WSDL (sözleşme) + sahte EDM'nin kaydı (hangi servise hangi istek gitti) + iş listesi 22 tasarım kuralı. Beklenen sayıların kaynağı GİB/EDM
// kuralıdır; bu dosya programla aynı elden yazıldı (ders 5): bağımsız kâhin model.py'ye "esmm" türü olarak AYRI elden eklenir.
import assert from "node:assert/strict";
import { after, before, describe, test } from "node:test";
import { resetEdmCaches } from "../server/lib/einvoice/edm.mjs";
import { OUR_VKN, startMockEdm, vkn } from "./einvoice-mock.mjs";
import { ADMIN_PASSWORD, startTestServer } from "./helpers.mjs";

const unwrap = response => ({ ...response, data: response.data && typeof response.data === "object" && "ok" in response.data ? (response.data.ok ? response.data.data : response.data) : response.data });
const SELLER = { name: "Deneme Hukuk Bürosu Ltd.", taxNo: OUR_VKN, taxOffice: "Çankaya", address: "Atatürk Blv. 1", district: "Çankaya", city: "Ankara", email: "bilgi@deneme.com.tr" };
const CLIENT_VKN = vkn(111222333);
const CLIENT = { name: "Müvekkil Ticaret A.Ş.", type: "customer", taxNo: CLIENT_VKN, taxOffice: "Konak", address: "Kordon 5", district: "Konak", city: "İzmir", email: "muhasebe@muvekkil.com.tr" };
const PERSON = { name: "Ayşe Kaya", type: "customer", partyKind: "person", firstName: "Ayşe", familyName: "Kaya", taxNo: "10000000146", taxOffice: "Konak", address: "Kordon 1", district: "Konak", city: "İzmir", email: "ayse@example.com" };
const TODAY = "2026-06-17";
const day = offset => {
  const [y, m, d] = TODAY.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, d + offset)).toISOString().slice(0, 10);
};
const fetchFailed = code => Object.assign(new TypeError("fetch failed"), { cause: Object.assign(new Error(code === "ECONNREFUSED" ? "connect ECONNREFUSED" : "other side closed"), { code }) });

// Sahte EDM + sunucu. fault: { op, code } — yerel ağ katmanında bir kez: ECONNREFUSED (bağlantı hiç kurulamadı, istek EDM'ye ulaşmaz) ya da UND_ERR_SOCKET
// (istek gönderildi, EDM işlemeden koptu).
async function boot({ esmmEnabled = true, esmm = true, now = `${TODAY}T10:00:00` } = {}) {
  resetEdmCaches();
  const edm = await startMockEdm();
  const faults = [];
  const fetchImpl = async (input, init = {}) => {
    const url = String(typeof input === "string" || input instanceof URL ? input : input.url);
    if (!url.startsWith("http://127.0.0.1")) throw new Error(`ağa çıkılmaz (test): ${url}`);
    const at = faults.findIndex(fault => String(init.body || "").includes(`${fault.op}Request`) && (!fault.smm || /ESmmEDM\.svc/i.test(url)));
    if (at >= 0) {
      const [fault] = faults.splice(at, 1);
      throw fetchFailed(fault.code);
    }
    return globalThis.fetch(input, init);
  };
  const server = await startTestServer({ edocEnabled: true, ...(esmmEnabled ? { esmmEnabled: true } : {}), fetchImpl, now, edocStatusPollMs: [5, 5], env: { HUKUK_LICENSE_URL: "http://127.0.0.1:9" } });
  const client = server.client();
  assert.equal((await client.login("admin", ADMIN_PASSWORD)).status, 200);
  const api = { get: async url => unwrap(await client.get(url)), post: async (url, body) => unwrap(await client.post(url, body)), put: async (url, body) => unwrap(await client.put(url, body)), raw: client.raw };
  const saved = await api.put("/api/workspace/invoices/settings", { seller: SELLER, efatura: true, earsiv: true, ...(esmmEnabled ? { esmm } : {}), integrator: { env: "test", baseUrl: edm.url, username: "edmkullanici", password: "Gizli-Parola-1", senderAlias: "urn:mail:defaultgb@deneme.com.tr" } });
  assert.equal(saved.status, 200, JSON.stringify(saved.data));
  const account = async body => {
    const created = await api.post("/api/workspace/accounts", body);
    assert.equal(created.status, 200, JSON.stringify(created.data));
    return created.data.id || created.data.account?.id;
  };
  const ctx = { edm, server, api, faults, clientId: await account(CLIENT), personId: await account(PERSON) };
  ctx.smm = (extra = {}, query = "") => api.post(`/api/workspace/invoices${query}`, { scenario: "smm", accountId: ctx.clientId, lines: [{ name: "Avukatlık Ücreti", qty: 1, unitPrice: 1000, vatRate: 20 }], payment: { rest: "open" }, ...extra });
  ctx.sale = (extra = {}) => api.post("/api/workspace/invoices", { scenario: "service_sale", accountId: ctx.personId, lines: [{ name: "Danışmanlık", qty: 1, unitPrice: 500, vatRate: 20 }], payment: { rest: "open" }, ...extra });
  ctx.card = async id => (await api.get(`/api/workspace/invoices/${id}`)).data;
  ctx.pending = async () => (await api.get("/api/workspace/invoices?tab=pending")).data.invoices.map(item => item.id);
  // Tümünü Gönder / Seçilenleri Gönder turu (ekranın yaptığı gibi imleçle, kalan bitene ya da tur durana dek).
  ctx.sendTurn = async (body = { all: true }) => {
    const results = [];
    let cursor;
    for (let round = 0; round < 30; round += 1) {
      const response = await api.post("/api/workspace/invoices/send-pending", { ...body, ...(cursor ? { after: cursor } : {}) });
      assert.equal(response.status, 200, JSON.stringify(response.data));
      results.push(...response.data.results);
      if (response.data.stopped || !response.data.remaining) return { results, last: response.data };
      cursor = response.data.cursor;
    }
    assert.fail("tur bitmedi");
  };
  // Sahte EDM'nin kaydı: e-Fatura servisi (state.calls) ve e-SMM servisi (state.smm.calls) ayrı.
  ctx.ops = () => ({ fatura: edm.state.calls.map(call => call.op), smm: edm.state.smm.calls.map(call => call.op) });
  ctx.close = async () => {
    await server.close();
    await edm.close();
  };
  return ctx;
}

describe("e-SMM açık: makbuz ESmmEDM.svc'den gider; e-Arşiv e-Fatura servisinden (N2, N3, N10, N13, N15)", () => {
  let ctx;
  before(async () => {
    ctx = await boot();
  });
  after(async () => {
    await ctx?.close();
  });

  test("N2: Kaydet ve Gönder — makbuz ESMM + TES numarası; giriş ve gönderim e-SMM servisine, e-Fatura servisine HİÇBİR istek yok; EDM'deki makbuz aynı numara/ETTN", async () => {
    const before = ctx.ops();
    const res = await ctx.smm({ eSend: "now" });
    assert.equal(res.status, 200, JSON.stringify(res.data));
    const doc = res.data;
    assert.equal(doc.profile, "ESMM");
    assert.match(doc.number, /^TES2026\d{9}$/, doc.number);
    assert.equal(doc.autoSend?.ok, true, JSON.stringify(doc.autoSend));
    assert.equal(doc.eStatus, "sent", doc.eMessage);
    const now = ctx.ops();
    assert.deepEqual(now.fatura.slice(before.fatura.length), [], "e-Fatura servisine istek yok (ne giriş ne gönderim)");
    assert.deepEqual(now.smm.slice(before.smm.length), ["Login", "SendSMM"], "e-SMM servisine giriş, sonra gönderim");
    const sent = ctx.edm.state.smm.sent.at(-1);
    assert.equal(sent.id, doc.number);
    assert.equal(sent.uuid, doc.ettn.toLowerCase());
    assert.match(sent.xml, new RegExp(`<cbc:ID>${doc.number}</cbc:ID>`));
    assert.equal(sent.head.TO, CLIENT.email, "e-Arşiv'in e-posta ayarı açık → alıcının e-postası");
    assert.equal(sent.receiver.vkn, CLIENT_VKN);
    assert.deepEqual(ctx.edm.state.smm.violations, [], "istekler gerçek e-SMM sözleşmesine uygun");
    assert.equal(doc.canDraft, false, "e-SMM'de portala taslak yok");
    assert.equal(doc.canRefresh, true);
    assert.equal(doc.canOfficial, true);
    // Gönderim kaydı (iptal süresinin başlangıcı; madde 23) e-SMM'de de yazılır.
    const trail = ctx.server.app.store.all("SELECT type FROM audit_events WHERE entity_id = ? AND type LIKE 'invoice.e.%' ORDER BY rowid", doc.id).map(row => row.type);
    assert.deepEqual(trail, ["invoice.e.sent"]);
    // Toplu XML (Seçilenleri XML İndir): e-SMM makbuzu e-Belgedir, girer.
    const zip = await ctx.api.raw("GET", `/api/workspace/invoices/ubl.zip?ids=${doc.id}`);
    assert.equal(zip.status, 200, zip.buffer.toString("utf8").slice(0, 300));
    assert.equal(zip.buffer.readUInt32LE(0), 0x04034b50, "ZIP");
    ctx.first = doc;
  });

  test("N2: e-SMM girişi reddedilirken (e-Fatura oturumu taze) numara VERİLMEZ — erişim/giriş denetimi belgenin servisinde (Kaydet ve Gönder ve Tümünü Gönder)", async () => {
    resetEdmCaches();
    // e-Fatura servisinin oturumu taze (mükellef sorgusu); e-SMM servisinde oturum yok.
    assert.equal((await ctx.api.post("/api/workspace/invoices/check-user", { taxNo: CLIENT_VKN })).status, 200);
    ctx.edm.state.smm.faults.set("Login", [2001, "Kullanıcı adı veya şifre hatalı"]);
    const res = (await ctx.smm({ eSend: "now" })).data;
    assert.equal(res.number, "", `numara verilmedi: ${JSON.stringify(res.autoSend)}`);
    assert.equal(res.eStatus, "waiting");
    assert.equal(res.autoSend?.code, "integrator-login", JSON.stringify(res.autoSend));
    ctx.edm.state.smm.faults.set("Login", [2001, "Kullanıcı adı veya şifre hatalı"]);
    const turn = await ctx.api.post("/api/workspace/invoices/send-pending", { only: [res.id] });
    assert.equal(turn.status, 200, JSON.stringify(turn.data));
    assert.equal(turn.data.stopped?.code, "integrator-login", JSON.stringify(turn.data));
    const card = await ctx.card(res.id);
    assert.equal(card.number, "", "Tümünü Gönder'de de numara verilmedi");
    assert.equal(card.eStatus, "waiting");
    assert.ok(!ctx.edm.state.smm.sent.some(item => item.uuid === card.ettn.toLowerCase()), "EDM'ye gitmedi");
    // Giriş düzelince aynı makbuz gider.
    const again = await ctx.api.post("/api/workspace/invoices/send-pending", { only: [res.id] });
    assert.equal(again.data.results.find(item => item.id === res.id)?.ok, true, JSON.stringify(again.data));
  });

  test("N10: Durum Sorgula, Resmî Görüntü ve İptal Et e-SMM servisinden (GetSMMStatus, GetSMM, CancelSMM); e-Fatura servisine istek yok; makbuz programda iptal", async () => {
    const doc = ctx.first;
    const before = ctx.ops();
    const refresh = await ctx.api.post(`/api/workspace/invoices/${doc.id}/e-refresh`, {});
    assert.equal(refresh.status, 200, JSON.stringify(refresh.data));
    assert.ok(["processing", "sent"].includes(refresh.data.eStatus), refresh.data.eStatus);
    const pdf = await ctx.api.raw("GET", `/api/workspace/invoices/${doc.id}/resmi.pdf`);
    assert.equal(pdf.status, 200, pdf.buffer.toString("utf8").slice(0, 300));
    assert.equal(pdf.buffer.subarray(0, 5).toString("latin1"), "%PDF-");
    assert.match(pdf.buffer.toString("latin1"), new RegExp(`e-SMM resmi gorunum ${doc.number}`), "görüntü e-SMM servisinden");
    const cancel = await ctx.api.post(`/api/workspace/invoices/${doc.id}/cancel`, { reason: "Müvekkil vazgeçti" });
    assert.equal(cancel.status, 200, JSON.stringify(cancel.data));
    assert.equal(cancel.data.status, "cancelled");
    assert.equal(cancel.data.eStatus, "cancelled");
    assert.deepEqual(ctx.edm.state.smm.cancelled, [doc.ettn.toLowerCase()]);
    const now = ctx.ops();
    assert.deepEqual(now.fatura.slice(before.fatura.length), [], "e-Fatura servisine istek yok");
    assert.ok(now.smm.slice(before.smm.length).includes("GetSMMStatus"));
    assert.ok(now.smm.slice(before.smm.length).includes("GetSMM"));
    assert.equal(now.smm.slice(before.smm.length).filter(op => op === "CancelSMM").length, 1);
    assert.deepEqual(ctx.edm.state.smm.violations, []);
  });

  test("N3: e-Arşiv belgesi e-Fatura servisinden gider; e-SMM servisine hiçbir istek gitmez; seriler ayrı (TEA ↔ TES)", async () => {
    const before = ctx.ops();
    const res = await ctx.sale({ eSend: "now" });
    assert.equal(res.status, 200, JSON.stringify(res.data));
    assert.equal(res.data.profile, "EARSIVFATURA");
    assert.match(res.data.number, /^TEA2026\d{9}$/);
    assert.equal(res.data.eStatus, "sent", res.data.eMessage);
    const now = ctx.ops();
    assert.deepEqual(now.smm.slice(before.smm.length), [], "e-SMM servisine istek yok");
    assert.ok(now.fatura.slice(before.fatura.length).includes("SendInvoice"));
    assert.ok(ctx.edm.state.sent.some(item => item.id === res.data.number && /<cbc:ProfileID>EARSIVFATURA</.test(item.xml)));
    assert.ok(!ctx.edm.state.sent.some(item => /<cbc:ProfileID>ESMM</.test(item.xml)), "e-Fatura servisine e-SMM makbuzu hiç gitmedi");
  });

  test("N13: portala taslak ayarı açıkken de makbuz doğrudan gönderilir (taslak yolu yok); /e-draft ağa çıkmadan reddedilir, belge belirsize düşmez", async () => {
    assert.equal((await ctx.api.put("/api/workspace/invoices/settings", { eOptions: { draftUpload: true } })).status, 200);
    try {
      const meta = (await ctx.api.get("/api/workspace/invoices/meta")).data;
      assert.equal(meta.kinds.smm.send, true, "meta: serbest meslek makbuzu e-SMM açıkken gönderilir");
      const res = await ctx.smm({ eSend: "now" });
      assert.equal(res.status, 200, JSON.stringify(res.data));
      assert.equal(res.data.eStatus, "sent", `taslak değil, gönderildi: ${res.data.eMessage}`);
      const later = (await ctx.smm({ eSend: "later" })).data;
      assert.equal(later.eStatus, "waiting");
      const shown = await ctx.card(later.id);
      assert.equal(shown.canDraft, false, "kartta Portala Taslak Yükle yok");
      assert.equal(shown.canSend, true, "e-Belge Gönder var");
      const before = ctx.ops();
      const draft = await ctx.api.post(`/api/workspace/invoices/${later.id}/e-draft`, {});
      assert.equal(draft.status, 409, JSON.stringify(draft.data));
      assert.equal(draft.data.code, "einvoice-draft-unsupported");
      const card = await ctx.card(later.id);
      assert.equal(card.eStatus, "waiting", "durum değişmedi (belirsiz değil)");
      assert.equal(card.number, "", "numara verilmedi");
      assert.equal(card.eAdapter || "", "");
      assert.deepEqual(ctx.ops().smm.slice(before.smm.length), [], "ağa çıkılmadı");
      ctx.waitingAfterDraft = later;
    } finally {
      assert.equal((await ctx.api.put("/api/workspace/invoices/settings", { eOptions: { draftUpload: false } })).status, 200);
    }
  });

  test("N15: Bağlantıyı Test Et e-SMM kullanıcısında e-SMM servisini de dener; e-SMM girişi düşerse sonuç başarısız ve nedeni söylenir", async () => {
    const before = ctx.ops();
    const ok = await ctx.api.post("/api/workspace/invoices/integrator/test", {});
    assert.equal(ok.status, 200, JSON.stringify(ok.data));
    assert.match(ok.data.message, /e-SMM servisine giriş yapıldı/);
    assert.deepEqual(ctx.ops().smm.slice(before.smm.length), ["Login"]);
    ctx.edm.state.smm.faults.set("Login", [2001, "Kullanıcı adı veya şifre hatalı"]);
    const failed = await ctx.api.post("/api/workspace/invoices/integrator/test", {});
    assert.ok(failed.status >= 400, JSON.stringify(failed.data));
    assert.match(failed.data.error || failed.data.message || "", /e-SMM servisi çalışmıyor/);
    const settings = (await ctx.api.get("/api/workspace/invoices/settings")).data;
    assert.equal(settings.integrator.lastTest.ok, false);
  });
});

describe("e-SMM: numara, seri ve kronoloji (N4, N5, N14)", () => {
  let ctx;
  before(async () => {
    ctx = await boot();
  });
  after(async () => {
    await ctx?.close();
  });

  test("N4/N5: Kes, Sonra Gönder → numarasız bekler; kayıtta O1 (daha eski bekleyen makbuz varken yenisi numara almaz); Tümünü Gönder tarih sırasıyla TES, e-Arşiv TEA ayrı sayar", async () => {
    const newest = (await ctx.smm({ issueDate: day(0), eSend: "later" })).data;
    const oldest = (await ctx.smm({ issueDate: day(-2), eSend: "later" })).data;
    const archive = (await ctx.sale({ issueDate: day(-1), eSend: "later" })).data;
    for (const doc of [newest, oldest, archive]) {
      assert.equal(doc.eStatus, "waiting", JSON.stringify(doc).slice(0, 300));
      assert.equal(doc.number, "");
    }
    assert.equal(newest.profile, "ESMM");
    // N5 ön koşulu: daha eski tarihli bekleyen makbuz Müşteri Fişi Olarak Bırakılır (bekleyen sayılmaz; serinin yenileri numara alınca e-Belge olarak
    // gönderilemez hâle gelir — sonraki test).
    const stale = (await ctx.smm({ issueDate: day(-3), eSend: "later" })).data;
    assert.equal((await ctx.api.post(`/api/workspace/invoices/${stale.id}/withdraw`, {})).status, 200);
    ctx.stale = stale;
    // Düz Kaydet (numara kayıtta): seride daha eski tarihli bekleyen makbuz var → numara verilmez, Gönderilecekler'e girer (O1).
    const held = (await ctx.smm({ issueDate: day(-1) })).data;
    assert.equal(held.number, "", JSON.stringify(held.autoSend));
    assert.equal(held.eStatus, "waiting");
    assert.equal(held.autoSend?.code, "einvoice-order");
    const pending = await ctx.pending();
    for (const doc of [newest, oldest, archive, held]) assert.ok(pending.includes(doc.id), "Gönderilecekler'de");
    const before = ctx.ops();
    const { results } = await ctx.sendTurn();
    assert.ok(results.every(item => item.ok), JSON.stringify(results));
    const numbers = await Promise.all([oldest, held, newest].map(async doc => (await ctx.card(doc.id)).number));
    for (const number of numbers) assert.match(number, /^TES2026\d{9}$/);
    const seqs = numbers.map(number => Number(number.slice(7)));
    assert.deepEqual(seqs, [seqs[0], seqs[0] + 1, seqs[0] + 2], `tarih sırasıyla ardışık: ${numbers.join(", ")}`);
    assert.match((await ctx.card(archive.id)).number, /^TEA2026\d{9}$/, "e-Arşiv kendi serisinden");
    // EDM'ye gönderim sırası = tarih sırası; makbuzlar e-SMM servisine, e-Arşiv e-Fatura servisine.
    assert.deepEqual(ctx.edm.state.smm.sent.map(item => item.id), numbers);
    const now = ctx.ops();
    assert.equal(now.smm.slice(before.smm.length).filter(op => op === "SendSMM").length, 3);
    assert.equal(now.fatura.slice(before.fatura.length).filter(op => op === "SendInvoice").length, 1);
    assert.deepEqual(ctx.edm.state.smm.violations, []);
    ctx.lastSent = numbers.at(-1);
  });

  test("N5: seride daha yeni numara verilmişken daha eski tarihli makbuz e-SMM olarak gönderilmez (kalıcı kronoloji engeli) ve daha eski tarihli yeni makbuz kaydedilmez; e-SMM servisine gönderim yok", async () => {
    // Müşteri Fişi Olarak Bırakılmış eski makbuz: yeniden e-Belge olarak gönderilemez (TES serisinde daha yeni numara var).
    const card = await ctx.card(ctx.stale.id);
    assert.equal(card.eStatus, "withdrawn");
    assert.equal(card.canSend, false);
    assert.match(card.sendBlock, /TES serisinde son gönderilen belge/);
    const before = ctx.ops();
    const send = await ctx.api.post(`/api/workspace/invoices/${ctx.stale.id}/send`, {});
    assert.equal(send.status, 409, JSON.stringify(send.data));
    assert.equal(send.data.code, "chronology");
    assert.equal((await ctx.card(ctx.stale.id)).profile, "KAGIT", "fiş olarak kaldı");
    // Seri sonundan eski tarihli yeni makbuz "Kes, Sonra Gönder" ile de kaydedilmez (numara ve tarih sırası).
    const count = ctx.server.app.store.get("SELECT COUNT(*) AS n FROM invoices").n;
    const old = await ctx.smm({ issueDate: day(-5), eSend: "later" });
    assert.equal(old.status, 400, JSON.stringify(old.data));
    assert.equal(old.data.code, "chronology");
    assert.equal(ctx.server.app.store.get("SELECT COUNT(*) AS n FROM invoices").n, count, "belge yazılmadı");
    assert.deepEqual(ctx.ops().smm.slice(before.smm.length), [], "e-SMM servisine istek yok");
  });

  test("N14: Müşteri Fişi Olarak Bırakılmış makbuz yeniden gönderilince e-SMM servisinden, TES serisinden numarayla gider (fiş numarası iz olarak kalır)", async () => {
    const doc = (await ctx.smm({ issueDate: day(0), eSend: "later" })).data;
    const withdrawn = (await ctx.api.post(`/api/workspace/invoices/${doc.id}/withdraw`, {})).data;
    assert.equal(withdrawn.profile, "KAGIT");
    assert.equal(withdrawn.eStatus, "withdrawn");
    assert.equal(withdrawn.canSend, true, "e-Belge olarak yine gönderilebilir");
    assert.equal(withdrawn.canDraft, false);
    const before = ctx.ops();
    const sent = await ctx.api.post(`/api/workspace/invoices/${doc.id}/send`, {});
    assert.equal(sent.status, 200, JSON.stringify(sent.data));
    assert.equal(sent.data.profile, "ESMM");
    assert.match(sent.data.number, /^TES2026\d{9}$/);
    assert.equal(Number(sent.data.number.slice(7)), Number(ctx.lastSent.slice(7)) + 1, "serinin sıradaki numarası");
    assert.equal(sent.data.paperNo, withdrawn.number, "fiş numarası Kâğıt Fatura No alanında");
    const now = ctx.ops();
    assert.deepEqual(now.fatura.slice(before.fatura.length), []);
    assert.deepEqual(now.smm.slice(before.smm.length).filter(op => op === "SendSMM"), ["SendSMM"]);
    assert.equal(ctx.edm.state.smm.sent.at(-1).id, sent.data.number);
  });
});

describe("e-SMM: kopma, belirsiz gönderim, başka numara, iki oturum, iptal süresi (N6, N7, N8, N9, N10)", () => {
  let ctx;
  before(async () => {
    ctx = await boot();
  });
  after(async () => {
    await ctx?.close();
  });

  test("N8: bağlantı hiç kurulamadı (gönderim isteği EDM'ye ulaşmadı) → kayıtta verilen numara geri bırakılır, makbuz numarasız Gönderilecekler'de; sonra aynı numarayla gider", async () => {
    const warm = (await ctx.smm({ eSend: "now" })).data;
    assert.equal(warm.eStatus, "sent", warm.eMessage);
    const top = Number(warm.number.slice(7));
    ctx.faults.push({ op: "SendSMM", code: "ECONNREFUSED", smm: true });
    const res = (await ctx.smm({ eSend: "now" })).data;
    assert.equal(res.autoSend?.ok, false, JSON.stringify(res.autoSend));
    const card = await ctx.card(res.id);
    assert.equal(card.number, "", "numara geri bırakıldı (seride boşluk yok)");
    assert.equal(card.eStatus, "waiting");
    assert.ok(ctx.server.app.store.get("SELECT 1 AS ok FROM audit_events WHERE entity_id = ? AND type = 'invoice.unnumbered'", res.id), "işlem geçmişinde");
    assert.ok((await ctx.pending()).includes(res.id));
    const { results } = await ctx.sendTurn({ only: [res.id] });
    assert.equal(results.find(item => item.id === res.id)?.ok, true, JSON.stringify(results));
    assert.equal(Number((await ctx.card(res.id)).number.slice(7)), top + 1, "aynı (sıradaki) numara");
  });

  test("N7: EDM makbuzu aldı, yanıt gelmeden bağlantı koptu → Sonucu Belirsiz (numara korunur, iptal kapalı); yeniden Gönder önce GetSMMStatus sorar, makbuz ikinci kez GİTMEZ", async () => {
    ctx.edm.state.smm.cutAfter.add("SendSMM");
    const res = (await ctx.smm({ eSend: "now" })).data;
    assert.equal(res.autoSend?.ok, false, JSON.stringify(res.autoSend));
    let card = await ctx.card(res.id);
    assert.match(card.number, /^TES2026\d{9}$/, "numara korundu (istek EDM'ye ulaşmış olabilir)");
    assert.equal(card.eStatusLabel, "Sonucu Belirsiz");
    assert.equal(card.canCancel, false);
    assert.equal(ctx.edm.state.smm.sent.filter(item => item.uuid === card.ettn.toLowerCase()).length, 1, "EDM aldı");
    const sendsBefore = ctx.edm.state.smm.calls.filter(call => call.op === "SendSMM").length;
    const again = await ctx.api.post(`/api/workspace/invoices/${res.id}/send`, {});
    assert.equal(again.status, 200, JSON.stringify(again.data));
    assert.match(again.data.sendResult.message, /önceki gönderimde entegratöre ulaşmış; yeniden gönderilmedi/);
    assert.equal(ctx.edm.state.smm.calls.filter(call => call.op === "SendSMM").length, sendsBefore, "SendSMM yinelenmedi");
    card = await ctx.card(res.id);
    assert.ok(["processing", "sent"].includes(card.eStatus), card.eStatus);
  });

  test("N7: belirsiz makbuz EDM'de YOKSA bile e-SMM'de doğrulanmamış 'bulunamadı' koduna güvenilmez — Durum Sorgula temizlemez, Gönder ikinci kez göndermez (madde 24'e dek)", async () => {
    ctx.faults.push({ op: "SendSMM", code: "UND_ERR_SOCKET", smm: true });
    const res = (await ctx.smm({ eSend: "now" })).data;
    let card = await ctx.card(res.id);
    assert.equal(card.eStatusLabel, "Sonucu Belirsiz", JSON.stringify(res.autoSend));
    assert.equal(ctx.edm.state.smm.sent.filter(item => item.uuid === card.ettn.toLowerCase()).length, 0, "EDM'ye ulaşmadı (ön koşul)");
    const refresh = await ctx.api.post(`/api/workspace/invoices/${res.id}/e-refresh`, {});
    assert.ok(refresh.status >= 400, `temizlenmedi: ${JSON.stringify(refresh.data)}`);
    card = await ctx.card(res.id);
    assert.equal(card.eStatusLabel, "Sonucu Belirsiz", "hâlâ belirsiz");
    const sendsBefore = ctx.edm.state.smm.calls.filter(call => call.op === "SendSMM").length;
    const again = await ctx.api.post(`/api/workspace/invoices/${res.id}/send`, {});
    assert.ok(again.status >= 400, JSON.stringify(again.data));
    assert.equal(ctx.edm.state.smm.calls.filter(call => call.op === "SendSMM").length, sendsBefore, "yeniden gönderilmedi");
    assert.equal((await ctx.card(res.id)).eStatusLabel, "Sonucu Belirsiz");
  });

  test("N9: EDM makbuzu başka numarayla kaydederse sessizce 'gönderildi' denmez — hata, ileti farkı söyler; durum yazılır (iptal açık); Tümünü Gönder durur, kalan makbuza numara verilmez", async () => {
    const first = (await ctx.smm({ eSend: "later" })).data;
    const second = (await ctx.smm({ eSend: "later" })).data;
    ctx.edm.state.smm.renumber = id => `${id.slice(0, 7)}999999999`;
    try {
      const { results, last } = await ctx.sendTurn({ only: [first.id, second.id] });
      const one = results.find(item => item.id === first.id);
      assert.equal(one?.ok, false, JSON.stringify(results));
      assert.equal(one.code, "integrator-reference");
      assert.match(one.message, /farklı numarayla \(TES2026999999999\)/);
      assert.equal(last.stopped?.code, "integrator-reference", JSON.stringify(last));
      const two = await ctx.card(second.id);
      assert.equal(two.number, "", "kalan makbuza numara verilmedi");
      const card = await ctx.card(first.id);
      assert.match(card.number, /^TES2026\d{9}$/);
      assert.notEqual(card.number, "TES2026999999999");
      assert.equal(card.eStatus, "sent", "EDM'ye ulaştı: izlenir");
      assert.match(card.eMessage, /farklı numarayla/);
      assert.equal(card.canCancel, true, "İptal Et açık (EDM'de ve programda)");
      // Kayıtta hemen gönderimde de: yanıt "gönderilmedi" demez.
      const now = (await ctx.smm({ eSend: "now" })).data;
      assert.equal(now.autoSend?.code, "integrator-reference", JSON.stringify(now.autoSend));
      assert.doesNotMatch(now.autoSend.message, /gönderilmedi/);
    } finally {
      ctx.edm.state.smm.renumber = null;
    }
  });

  test("N6: iki oturum aynı makbuzu aynı anda gönderir → EDM'ye bir kez gider", async () => {
    const doc = (await ctx.smm({ eSend: "later" })).data;
    const other = ctx.server.client();
    assert.equal((await other.login("admin", ADMIN_PASSWORD)).status, 200);
    const [a, b] = await Promise.all([ctx.api.post(`/api/workspace/invoices/${doc.id}/send`, {}), other.post(`/api/workspace/invoices/${doc.id}/send`, {}).then(unwrap)]);
    const statuses = [a.status, b.status].sort();
    assert.equal(statuses[0], 200, `${JSON.stringify(a.data).slice(0, 200)} | ${JSON.stringify(b.data).slice(0, 200)}`);
    assert.equal(statuses[1], 409, `${JSON.stringify(a.data).slice(0, 200)} | ${JSON.stringify(b.data).slice(0, 200)}`);
    const card = await ctx.card(doc.id);
    assert.equal(ctx.edm.state.smm.sent.filter(item => item.uuid === card.ettn.toLowerCase()).length, 1);
  });

  test("N10: iletimden 8 gün sonra (9. gün) gönderilmiş e-SMM iptal edilmez; EDM'ye iptal isteği gitmez", async () => {
    const doc = (await ctx.smm({ eSend: "now" })).data;
    assert.equal(doc.eStatus, "sent", doc.eMessage);
    const clock = ctx.server.clock;
    clock.set(`${day(9)}T10:00:00`);
    try {
      const before = ctx.edm.state.smm.calls.filter(call => call.op === "CancelSMM").length;
      const cancel = await ctx.api.post(`/api/workspace/invoices/${doc.id}/cancel`, { reason: "geç" });
      assert.equal(cancel.status, 409, JSON.stringify(cancel.data));
      assert.equal(cancel.data.code, "einvoice-cancel-late");
      assert.equal(ctx.edm.state.smm.calls.filter(call => call.op === "CancelSMM").length, before);
      assert.equal((await ctx.card(doc.id)).status, "issued");
    } finally {
      clock.set(`${TODAY}T10:00:00`);
    }
  });
});

describe("e-SMM: 002 şirketi kendi ayarıyla ve servisinden gönderir (N11)", () => {
  let ctx;
  before(async () => {
    ctx = await boot();
  });
  after(async () => {
    await ctx?.close();
  });
  test("002'nin makbuzu 002'nin entegratör ayarıyla e-SMM servisine gider; 001'in Gönderilecekler'i ve numarası etkilenmez", async () => {
    const created = await ctx.api.post("/api/companies", { name: "İkinci Büro", select: false });
    assert.equal(created.status, 200, JSON.stringify(created.data));
    const second = created.data.company || created.data;
    const q = `?hofCompany=${encodeURIComponent(second.id)}`;
    const saved = await ctx.api.put(`/api/workspace/invoices/settings${q}`, { seller: { ...SELLER, name: "İkinci Büro Ltd." }, efatura: true, earsiv: true, esmm: true, start: { TES2026: 500 }, integrator: { env: "test", baseUrl: ctx.edm.url, username: "edmkullanici", password: "Gizli-Parola-1", senderAlias: "urn:mail:defaultgb@ikinci.com.tr" } });
    assert.equal(saved.status, 200, JSON.stringify(saved.data));
    const account = await ctx.api.post(`/api/workspace/accounts${q}`, CLIENT);
    assert.equal(account.status, 200, JSON.stringify(account.data));
    const accountId = account.data.id || account.data.account?.id;
    const before = ctx.ops();
    const doc = await ctx.api.post(`/api/workspace/invoices${q}`, { scenario: "smm", accountId, lines: [{ name: "Danışmanlık Ücreti", qty: 1, unitPrice: 750, vatRate: 20 }], payment: { rest: "open" }, eSend: "now" });
    assert.equal(doc.status, 200, JSON.stringify(doc.data));
    assert.equal(doc.data.profile, "ESMM");
    assert.equal(doc.data.number, "TES2026000000500", "002'nin kendi test serisi başlangıcı");
    assert.equal(doc.data.eStatus, "sent", doc.data.eMessage);
    const now = ctx.ops();
    assert.deepEqual(now.fatura.slice(before.fatura.length), []);
    assert.deepEqual(now.smm.slice(before.smm.length).filter(op => op === "SendSMM"), ["SendSMM"]);
    const sent = ctx.edm.state.smm.sent.at(-1);
    assert.equal(sent.head.FROM, "urn:mail:defaultgb@ikinci.com.tr", "002'nin gönderici etiketi");
    assert.deepEqual(await ctx.pending(), [], "001'de bekleyen yok");
    assert.equal((await ctx.api.get(`/api/workspace/invoices/${doc.data.id}`)).status, 404, "002'nin belgesi 001'de görünmez");
  });
});

describe("e-SMM açık kurulumda e-SMM kullanıcısı OLMAYAN firma: kâğıt makbuz gönderilmez (N1, N4)", () => {
  let ctx;
  before(async () => {
    ctx = await boot({ esmmEnabled: true, esmm: false });
  });
  after(async () => {
    await ctx?.close();
  });
  test("\"e-SMM kullanıcısıyım\" işaretsiz: makbuz kâğıt (SMM serisi); Gönderilecekler'de değil, gönder düğmesi yok, Kaydet ve Gönder entegratöre gitmez", async () => {
    const before = ctx.ops();
    const doc = (await ctx.smm({ eSend: "now" })).data;
    assert.equal(doc.profile, "KAGIT");
    assert.match(doc.number, /^SMM2026\d{9}$/);
    const later = (await ctx.smm({ eSend: "later" })).data;
    assert.equal(later.profile, "KAGIT");
    assert.notEqual(later.eStatus, "waiting", "kâğıt makbuz Gönderilecekler'de beklemez");
    for (const id of [doc.id, later.id]) {
      const card = await ctx.card(id);
      for (const key of ["canSend", "canRefresh", "canDraft", "canOfficial", "eUnsent"]) assert.equal(Boolean(card[key]), false, `${id} ${key}`);
      assert.ok(!(await ctx.pending()).includes(id));
    }
    const zip = await ctx.api.raw("GET", `/api/workspace/invoices/ubl.zip?ids=${doc.id}`);
    assert.equal(zip.status, 400, "toplu XML'e girmez");
    const now = ctx.ops();
    assert.deepEqual(now.smm.slice(before.smm.length), []);
    assert.deepEqual(now.fatura.slice(before.fatura.length), []);
  });
});

describe("e-SMM KAPALI (üretim varsayılanı): makbuz hiçbir gönderim yoluna girmez (N1)", () => {
  let ctx;
  before(async () => {
    ctx = await boot({ esmmEnabled: false });
  });
  after(async () => {
    await ctx?.close();
  });
  test("kâğıt SMM: Gönderilecekler'de değil, kartta gönder / durum / resmî görüntü yok; Kaydet ve Gönder kâğıt makbuzu göndermez; meta smm.send false", async () => {
    const meta = (await ctx.api.get("/api/workspace/invoices/meta")).data;
    assert.equal(meta.kinds.smm.send, false);
    const before = ctx.ops();
    const doc = (await ctx.smm({ eSend: "now" })).data;
    assert.equal(doc.profile, "KAGIT");
    assert.match(doc.number, /^SMM2026\d{9}$/);
    assert.equal(doc.autoSend, undefined);
    const card = await ctx.card(doc.id);
    for (const key of ["canSend", "canRefresh", "canDraft", "canOfficial"]) assert.equal(card[key], false, key);
    assert.ok(!(await ctx.pending()).includes(doc.id));
    const send = await ctx.api.post(`/api/workspace/invoices/${doc.id}/send`, {});
    assert.equal(send.status, 409);
    const zip = await ctx.api.raw("GET", `/api/workspace/invoices/ubl.zip?ids=${doc.id}`);
    assert.equal(zip.status, 400, "toplu XML'e girmez");
    assert.deepEqual(ctx.ops().smm.slice(before.smm.length), [], "e-SMM servisine istek yok");
    assert.deepEqual(ctx.ops().fatura.slice(before.fatura.length), [], "e-Fatura servisine istek yok");
  });
  test("bayrak kapalıyken veri tabanında kalmış numaralı ESMM makbuzu (2.4.0 verisi gibi) Gönderilecekler'e girmez, gönderilemez, Tümünü Gönder'e girmez", async () => {
    const doc = (await ctx.smm()).data;
    // 2.4.0'ın yazdığı biçim (gerçek 2.4.0 verisi: test/goc-244-esmm-gonderim.test.mjs): profil ESMM, TES numarası, gönderilmemiş.
    ctx.server.app.store.run("UPDATE invoices SET profile = 'ESMM', series = 'TES', number = 'TES2026000000001', e_status = '' WHERE id = ?", doc.id);
    const card = await ctx.card(doc.id);
    assert.equal(card.profile, "ESMM");
    for (const key of ["canSend", "canRefresh", "canDraft", "canOfficial", "eUnsent"]) assert.equal(Boolean(card[key]), false, key);
    assert.ok(!(await ctx.pending()).includes(doc.id));
    const before = ctx.ops();
    const turn = await ctx.api.post("/api/workspace/invoices/send-pending", { all: true });
    assert.equal(turn.status, 200);
    assert.ok(!turn.data.results.some(item => item.id === doc.id), JSON.stringify(turn.data.results));
    const send = await ctx.api.post(`/api/workspace/invoices/${doc.id}/send`, {});
    assert.equal(send.status, 409, JSON.stringify(send.data));
    const zip = await ctx.api.raw("GET", `/api/workspace/invoices/ubl.zip?ids=${doc.id}`);
    assert.equal(zip.status, 400);
    assert.deepEqual(ctx.ops().smm.slice(before.smm.length), []);
  });
});
