// Dar kontrol 2 (2.4.3; bağımsız denetçi, betikler dar2-243 a…i) — e-Belge gönderim çekirdeği gerilemeleri. Sahte EDM; ağa çıkmaz; sahte saat (ders 13).
//   B1 ORTA    Reddedilen (EDM "Hata") numaralı belgeler kuyruğun başında her istekte yeniden deneniyor, 20'lik parçayı dolduruyor, sent = 0 → istemci
//              döngüsü duruyor; yeni belgeler hiç gitmiyordu. Karar: tur bir İMLEÇLE ilerler; bir turda her belge en çok bir kez denenir.
//   B2 ORTA    İstek gittikten sonra kopan bağlantı (UND_ERR_SOCKET) "ulaşılamadı" sayılıp turu DURDURUYORDU. Karar: tur yalnız istek EDM'ye kesin
//              ulaşmadığında durur; kopma "belirsiz"dir (belge belirsiz yoluyla işlenir), tur sürer.
//   B3 DÜŞÜK-ORTA  Her tekil e-Fatura gönderiminde fazladan Login. Karar: geçerli oturum + son 5 dk içinde EDM yanıtı = erişim kanıtı. Ağ yokken
//              numara verilmez kuralı (kâhin K12) korunur: kanıt önbellekten geldiyse ve bağlantı HİÇ kurulamadıysa bu istekte verilen numara geri
//              bırakılır (serinin son numarasıysa; boşluk kalmaz).
// Nasıl bozulur: kuyruğun başında kalıcı/tekrarlayan ret, parça sınırı (20), gönderim ortasında kopma, ağ numaradan hemen sonra gider, parola
// değişir, araya başka oturumun numarası girer (geri bırakma boşluk açmamalı).
import assert from "node:assert/strict";
import { after, describe, test } from "node:test";
import { resetEdmCaches } from "../server/lib/einvoice/edm.mjs";
import { BUYER_VKN, OUR_VKN, startMockEdm } from "./einvoice-mock.mjs";
import { ADMIN_PASSWORD, startTestServer } from "./helpers.mjs";

const unwrap = response => ({ ...response, data: response.data && typeof response.data === "object" && "ok" in response.data ? (response.data.ok ? response.data.data : response.data) : response.data });
const SELLER = { name: "Deneme Ofis Ltd.", taxNo: OUR_VKN, taxOffice: "Çankaya", address: "Atatürk Blv. 1", district: "Çankaya", city: "Ankara", email: "bilgi@deneme.com.tr" };
const person = (name, taxNo) => ({ name, type: "customer", partyKind: "person", firstName: name.split(" ")[0], familyName: name.split(" ").slice(1).join(" ") || "Kişi", taxNo, taxOffice: "Konak", address: "Kordon 1", district: "Konak", city: "İzmir" });
const LINES = [{ name: "Danışmanlık", qty: 1, unitPrice: 500, vatRate: 20 }];
const BAD = "11223344550"; // Zeynep: EDM bu alıcının belgesini belge düzeyinde reddeder (GİB doğrulama hatası)
const sleep = ms => new Promise(resolve => setTimeout(resolve, ms));
const seqOf = number => Number(String(number).slice(7));
const faultXml = (code, message) => `<s:Envelope xmlns:s="http://schemas.xmlsoap.org/soap/envelope/"><s:Body><s:Fault><faultcode>s:Client</faultcode><faultstring>${message}</faultstring><detail><RequestFault xmlns="urn:edm:test"><ERROR_CODE>${code}</ERROR_CODE><ERROR_SHORT_DES>${message}</ERROR_SHORT_DES></RequestFault></detail></s:Fault></s:Body></s:Envelope>`;
const opOf = raw => (/<(?:\w+:)?(\w+)Request[\s>]/.exec(raw.replace(/<(?:\w+:)?(Envelope|Header|Body)[\s>]/g, "")) || [])[1] || "GET";

async function setup({ hook = null } = {}) {
  resetEdmCaches();
  const edm = await startMockEdm();
  // net.down: ağ yok — bağlantı reddedildi (istek EDM'ye hiç ulaşmaz). ops: işlem başına çağrı sayısı (Login, SendInvoice …).
  const net = { down: false, ops: {} };
  const fetchImpl = async (input, init) => {
    const url = String(typeof input === "string" || input instanceof URL ? input : input.url);
    if (!url.startsWith("http://127.0.0.1")) throw new Error(`ağa çıkılmaz (test): ${url}`);
    if (net.down) throw Object.assign(new TypeError("fetch failed"), { cause: { code: "ECONNREFUSED" } });
    const raw = String(init?.body || "");
    const op = opOf(raw);
    net.ops[op] = (net.ops[op] || 0) + 1;
    if (hook) {
      const out = await hook(op, raw, net);
      if (out) return out;
    }
    return globalThis.fetch(input, init);
  };
  const server = await startTestServer({ edocEnabled: true, fetchImpl, now: "2026-06-17T09:00:00", edocStatusPollMs: [5, 5], env: { HUKUK_LICENSE_URL: "http://127.0.0.1:9" } });
  const client = server.client();
  const wrap = c => ({ get: async url => unwrap(await c.get(url)), post: async (url, body) => unwrap(await c.post(url, body)), put: async (url, body) => unwrap(await c.put(url, body)) });
  const api = wrap(client);
  assert.equal((await client.login("admin", ADMIN_PASSWORD)).status, 200);
  assert.equal((await api.put("/api/workspace/invoices/settings", { seller: SELLER, efatura: true, earsiv: true })).status, 200);
  const integrator = password => api.put("/api/workspace/invoices/settings", { integrator: { env: "test", baseUrl: edm.url, username: "edmkullanici", password, senderAlias: "urn:mail:defaultgb@deneme.com.tr" } });
  assert.equal((await integrator("Gizli-Parola-1")).status, 200);
  const today = (await api.get("/api/workspace/ledger/lock")).data.today;
  assert.equal(today, "2026-06-17");
  const people = [];
  for (const [name, taxNo] of [["Ayşe Kaya", "10000000146"], ["Mehmet Demir", "12345678950"], ["Zeynep Şahin", BAD]]) {
    const created = await api.post("/api/workspace/accounts", person(name, taxNo));
    assert.equal(created.status, 200, JSON.stringify(created.data));
    people.push(created.data.id);
  }
  const firm = (await api.post("/api/workspace/accounts", { name: "Alıcı Ticaret A.Ş.", type: "customer", partyKind: "company", taxNo: BUYER_VKN, taxOffice: "Kavaklıdere", address: "Cinnah Cd. 10", district: "Çankaya", city: "Ankara", eInvoice: true, eAlias: "urn:mail:defaultpk@alici.com.tr" })).data.id;
  const day = offset => {
    const [y, m, d] = today.split("-").map(Number);
    return new Date(Date.UTC(y, m - 1, d + offset)).toISOString().slice(0, 10);
  };
  const sale = async (accountId, extra = {}, who = api) => {
    const saved = await who.post("/api/workspace/invoices", { scenario: "service_sale", accountId, lines: LINES, payment: { rest: "open" }, ...extra });
    assert.equal(saved.status, 200, JSON.stringify(saved.data));
    return saved.data;
  };
  const card = async id => (await api.get(`/api/workspace/invoices/${id}`)).data;
  const pendingCount = async () => (await api.get("/api/workspace/invoices?tab=pending")).data.tabCounts.pending;
  const second = async () => {
    const c2 = server.client();
    assert.equal((await c2.login("admin", ADMIN_PASSWORD)).status, 200);
    return wrap(c2);
  };
  // İstemcinin Tümünü Gönder döngüsü (hof-invoices.js sendPending, B1): imleç sonraki isteğe verilir; döngü kalan bitene, tur durana ya da imleç
  // ilerlemeyene dek sürer. Eski sunucu imleç döndürmez → ilk istekten sonra durur (eski istemci de "gönderilen 0"da duruyordu).
  const press = async (limit = 200) => {
    const turns = [];
    let cursor = null;
    for (let i = 0; i < limit; i += 1) {
      const result = await api.post("/api/workspace/invoices/send-pending", cursor ? { all: true, after: cursor } : { all: true });
      assert.equal(result.status, 200, JSON.stringify(result.data).slice(0, 400));
      turns.push(result.data);
      const moved = Boolean(result.data.cursor) && JSON.stringify(result.data.cursor) !== JSON.stringify(cursor);
      cursor = result.data.cursor || cursor;
      if (result.data.stopped || !result.data.remaining || !moved) break;
    }
    return { turns, sent: turns.reduce((sum, t) => sum + t.sent, 0) };
  };
  const close = async () => {
    await server.close();
    await edm.close();
  };
  return { edm, net, server, api, integrator, people, firm, day, sale, card, pendingCount, second, press, close };
}

// EDM bu alıcının belgesini belge düzeyinde reddeder (numara harcanır, belge "Hata").
const rejectBad = async (op, raw) => {
  if (op !== "SendInvoice") return null;
  const xml = Buffer.from((/<(?:\w+:)?CONTENT>([^<]*)</.exec(raw) || [])[1] || "", "base64").toString("utf8");
  if (!xml.includes(BAD)) return null;
  return new Response(faultXml(10012, "Alici bilgisi GIB dogrulamasindan gecmedi"), { status: 500, headers: { "content-type": "text/xml" } });
};

describe("gg243 dar kontrol 2: Tümünü Gönder imleci (B1)", () => {
  const open = [];
  after(async () => {
    for (const ctx of open) await ctx.close();
  });

  test("B1: kuyruğun başında 20 reddedilen belge varken bir basışta 30 yeni belge gider; her belge turda en çok bir kez denenir", async () => {
    const ctx = await setup({ hook: rejectBad });
    open.push(ctx);
    for (let i = 0; i < 20; i += 1) await ctx.sale(ctx.people[2], { issueDate: ctx.day(-10), eSend: "later" });
    const good = [];
    for (let i = 0; i < 30; i += 1) good.push(await ctx.sale(ctx.people[i % 2], { issueDate: ctx.day(-9 + Math.floor(i / 5)), eSend: "later" }));
    // İlk basış: kötü belgeler numara alır ve "Hata"ya düşer; iyi belgeler aynı turda gider.
    const first = await ctx.press();
    assert.equal(first.sent, 30, `ilk basışta 30 yeni belge gönderildi (istekler: ${first.turns.map(t => `${t.sent}/${t.attempted}`).join(" ")})`);
    assert.equal(ctx.edm.state.sent.length, 30);
    const sendCalls = ctx.net.ops.SendInvoice;
    assert.equal(sendCalls, 50, `turda her belge bir kez: 20 reddedilen + 30 gönderilen SendInvoice (${sendCalls})`);
    assert.equal(await ctx.pendingCount(), 20, "yalnız reddedilen 20 belge Gönderilecekler'de");
    for (const doc of good) assert.equal((await ctx.card(doc.id)).eStatus, "sent");
    // İkinci basış yeni bir turdur: reddedilenler bir kez daha denenir (düzeltilip gönderilebilsin), döngü takılmadan biter.
    const again = await ctx.press();
    assert.equal(again.sent, 0);
    assert.equal(ctx.net.ops.SendInvoice - sendCalls, 20, "ikinci turda her reddedilen belge bir kez");
    assert.ok(again.turns.at(-1).remaining === 0, "tur sonunda kalan yok");
  });

  test("B1: imleçten önce gönderilemeyen numarasız eski belge, sonraki istekteki aynı serinin yeni belgelerini bekletir (bir kez denenir)", async () => {
    // Zeynep'in mükellef sorgusu belge düzeyinde düşer (geçici, numarasız) → aynı seride (TEA) daha yenisi numara almamalı.
    let checkBad = 0;
    const hook = async (op, raw) => {
      if (op === "CheckUser" && raw.includes(BAD)) {
        checkBad += 1;
        return new Response(faultXml(10099, "Gecici sorgu hatasi"), { status: 500, headers: { "content-type": "text/xml" } });
      }
      return null;
    };
    const ctx = await setup({ hook });
    open.push(ctx);
    // 19 e-Fatura (TEF) eski belge parçayı doldurur; 20. deneme Zeynep (TEA, numarasız, düşer) → parça biter. Sonraki istek imleçten sonra başlar.
    for (let i = 0; i < 19; i += 1) await ctx.sale(ctx.firm, { issueDate: ctx.day(-10), eSend: "later" });
    const blocker = await ctx.sale(ctx.people[2], { issueDate: ctx.day(-9), eSend: "later" });
    const newer = [];
    for (let i = 0; i < 3; i += 1) newer.push(await ctx.sale(ctx.people[i % 2], { issueDate: ctx.day(-8), eSend: "later" }));
    const { turns } = await ctx.press();
    assert.ok(turns.length >= 2, `en az iki istek (parça sınırı): ${turns.length}`);
    assert.equal(turns[0].attempted, 20, "ilk istek 20 deneme");
    assert.equal(checkBad, 1, "gönderilemeyen eski belge turda bir kez denendi");
    const blockerCard = await ctx.card(blocker.id);
    assert.equal(blockerCard.number, "", "eski belge numarasız");
    for (const doc of newer) {
      const c = await ctx.card(doc.id);
      assert.equal(c.number, "", `yeni belge (${doc.id}) numara almadı — sıra korunur`);
      assert.equal(c.eStatus, "waiting");
    }
    const last = turns.at(-1).results.filter(item => newer.some(doc => doc.id === item.id));
    assert.equal(last.length, 3, "yeni belgeler son istekte sonuçlandı");
    for (const item of last) {
      assert.equal(item.code, "einvoice-held", JSON.stringify(item));
      assert.match(item.message, /^Gönderilmedi, sırasını koruyarak bekliyor: aynı serideki daha eski tarihli belge \(Zeynep Şahin, 08\.06\.2026\) gönderilemedi\./);
    }
    assert.equal(ctx.edm.state.sent.length, 19);
  });

  test("B1: bozuk ya da eksik imleç turu baştan başlatır (hata değil)", async () => {
    const ctx = await setup();
    open.push(ctx);
    await ctx.sale(ctx.people[0], { issueDate: ctx.day(-2), eSend: "later" });
    for (const after of [{ issueDate: "bozuk", rn: 1 }, "metin", { issueDate: "2026-06-01" }]) {
      const r = await ctx.api.post("/api/workspace/invoices/send-pending", { all: true, after });
      assert.equal(r.status, 200);
    }
    assert.equal(ctx.edm.state.sent.length, 1, "ilk istekte gitti; sonrakiler boş kuyrukta");
  });
});

describe("gg243 dar kontrol 2: gönderim sonrası kopma belirsizdir, tur sürer (B2)", () => {
  const open = [];
  after(async () => {
    for (const ctx of open) await ctx.close();
  });

  test("B2: tek SendInvoice'ın bağlantısı istek gittikten sonra koparsa tur durmaz; o belge Sonucu Belirsiz, sonraki turda yinelemesiz gider", async () => {
    const ctx = await setup();
    open.push(ctx);
    const docs = [];
    for (let i = 0; i < 12; i += 1) docs.push(await ctx.sale(ctx.people[i % 3 === 2 ? 0 : i % 3], { issueDate: ctx.day(-12 + i), eSend: "later" }));
    // ısınma: keep-alive bağlantısı açık kalsın; sonra ilk SendInvoice bu bağlantıda koparılır (sahte EDM işlemeden kapatır).
    await ctx.api.post("/api/workspace/invoices/check-user", { taxNo: BUYER_VKN });
    ctx.edm.state.resetOps = new Set(["SendInvoice"]);
    ctx.edm.state.resetLimit = 1;
    const r = await ctx.api.post("/api/workspace/invoices/send-pending", { all: true });
    assert.equal(r.status, 200);
    assert.deepEqual(ctx.edm.state.resets, ["SendInvoice"], "bir gönderim koptu (ön koşul oluştu)");
    assert.equal(r.data.stopped, undefined, `tur durmadı: ${JSON.stringify(r.data.stopped)}`);
    assert.equal(r.data.sent, 11, "kalan 11 belge gitti");
    const broken = r.data.results.find(item => !item.ok);
    assert.equal(broken.code, "integrator-uncertain", JSON.stringify(broken));
    assert.match(broken.message, /istek gönderildikten sonra koptu .*istek EDM'ye ulaşmış olabilir\./);
    const c = await ctx.card(broken.id);
    assert.ok(c.number, "numara korunur (K14)");
    assert.equal(c.eStatusLabel, "Sonucu Belirsiz");
    // Sonraki tur: önce durum sorulur (EDM'de yok — istek işlenmemişti), sonra aynı numarayla gider; her ETTN EDM'de bir kez.
    const again = await ctx.press();
    assert.equal(again.sent, 1);
    assert.equal((await ctx.card(broken.id)).number, c.number, "numara değişmedi");
    const ettns = ctx.edm.state.sent.map(item => item.uuid || item.ettn || item.id);
    assert.equal(ctx.edm.state.sent.length, 12);
    assert.equal(new Set(ettns).size, 12, "her belge EDM'de bir kez");
  });

  test("B2: bağlantı hiç kurulamazsa (ECONNREFUSED) tur yine durur, kalanlara numara verilmez (K12)", async () => {
    const ctx = await setup();
    open.push(ctx);
    for (let i = 0; i < 4; i += 1) await ctx.sale(ctx.people[i % 2], { issueDate: ctx.day(-4 + i), eSend: "later" });
    ctx.net.down = true;
    const r = await ctx.api.post("/api/workspace/invoices/send-pending", { all: true });
    assert.equal(r.data.stopped?.code, "integrator-unreachable");
    assert.equal(r.data.sent, 0);
    const list = (await ctx.api.get("/api/workspace/invoices?tab=pending")).data.invoices;
    assert.ok(list.every(item => !item.number), "hiçbirine numara verilmedi");
  });
});

describe("gg243 dar kontrol 2: oturum önbelleği erişim kanıtıdır, numara ağ yokken verilmez (B3)", () => {
  const open = [];
  after(async () => {
    for (const ctx of open) await ctx.close();
  });

  test("B3: ısınmadan sonra 10 e-Fatura Kaydet ve Gönder, 10 kartta Gönder ve 45 belgelik Tümünü Gönder yeniden giriş yapmaz", async () => {
    const ctx = await setup();
    open.push(ctx);
    await ctx.sale(ctx.firm, { eSend: "now" });
    const before = ctx.net.ops.Login || 0;
    for (let i = 0; i < 10; i += 1) assert.equal((await ctx.sale(ctx.firm, { eSend: "now" })).autoSend?.ok, true);
    assert.equal((ctx.net.ops.Login || 0) - before, 0, "Kaydet ve Gönder ×10: giriş yok");
    const later = [];
    for (let i = 0; i < 10; i += 1) later.push(await ctx.sale(ctx.firm, { eSend: "later" }));
    for (const doc of later) assert.equal((await ctx.api.post(`/api/workspace/invoices/${doc.id}/send`, {})).status, 200);
    assert.equal((ctx.net.ops.Login || 0) - before, 0, "kartta Gönder ×10: giriş yok");
    for (let i = 0; i < 45; i += 1) await ctx.sale(ctx.firm, { eSend: "later" });
    const { sent } = await ctx.press();
    assert.equal(sent, 45);
    assert.equal((ctx.net.ops.Login || 0) - before, 0, "Tümünü Gönder 45: giriş yok");
    assert.equal(ctx.edm.state.sent.length, 66);
  });

  test("B3: parola değişince önbellekteki oturum kanıt sayılmaz — giriş numaradan önce; yanlış parolada numara harcanmaz", async () => {
    const ctx = await setup();
    open.push(ctx);
    await ctx.sale(ctx.firm, { eSend: "now" });
    assert.equal((await ctx.integrator("Yanlis-Parola-9")).status, 200);
    const loginBefore = ctx.net.ops.Login || 0;
    const sendBefore = ctx.net.ops.SendInvoice || 0;
    const saved = await ctx.sale(ctx.firm, { eSend: "now" });
    assert.equal(saved.number, "", "numara verilmedi");
    assert.equal(saved.autoSend?.code, "integrator-login", JSON.stringify(saved.autoSend));
    assert.equal((ctx.net.ops.Login || 0) - loginBefore, 1, "yeni parolayla giriş denendi");
    assert.equal((ctx.net.ops.SendInvoice || 0) - sendBefore, 0, "gönderim yapılmadı");
    assert.equal((await ctx.integrator("Gizli-Parola-1")).status, 200);
    const ok = await ctx.sale(ctx.firm, { eSend: "now" });
    assert.equal(ok.autoSend?.ok, true);
    assert.equal(seqOf(ok.number), 2, "seride boşluk yok");
  });

  test("B3 + K12: kanıt önbellekten gelirken ağ giderse Kaydet ve Gönder, kartta Gönder ve Tümünü Gönder numara vermez (verilen geri bırakılır)", async () => {
    const ctx = await setup();
    open.push(ctx);
    // warm: ağ var, EDM'den yanıt alınır (erişim kanıtı tazelenir), sonra ağ gider — sonraki gönderim girişsiz numara alır, bağlantı kuramaz.
    const warmThenDown = async () => {
      ctx.net.down = false;
      assert.equal((await ctx.api.post("/api/workspace/invoices/check-user", { taxNo: BUYER_VKN })).status, 200);
      ctx.net.down = true;
    };
    const first = await ctx.sale(ctx.firm, { eSend: "now" });
    assert.equal(seqOf(first.number), 1);
    const waiting = await ctx.sale(ctx.firm, { eSend: "later" });
    const RELEASED = /Belge EDM'ye ulaşmadı; numara verilmedi, Gönderilecekler'de bekliyor\.$/;
    // 1) kartta Gönder (numarasız bekleyen): numara gönderimde verilir, bağlantı kurulamaz → geri bırakılır.
    await warmThenDown();
    const loginBefore = ctx.net.ops.Login || 0;
    const viaCard = await ctx.api.post(`/api/workspace/invoices/${waiting.id}/send`, {});
    assert.equal(viaCard.status, 502);
    assert.match(viaCard.data.error, RELEASED);
    assert.equal((ctx.net.ops.Login || 0) - loginBefore, 0, "giriş yapılmadı (kanıt önbellekte) — geri bırakma yolu sınandı");
    const waitingCard = await ctx.card(waiting.id);
    assert.equal(waitingCard.number, "");
    assert.equal(waitingCard.eStatus, "waiting");
    assert.match(waitingCard.eMessage || "", RELEASED);
    // 2) Kaydet ve Gönder (e-Fatura: mükellef sorgusu yok) → numara kayıtta verilir, gönderim bağlantı kuramaz → geri bırakılır.
    await warmThenDown();
    const saved = await ctx.sale(ctx.firm, { eSend: "now" });
    assert.equal(saved.number, "", `numara verilmedi: ${saved.number}`);
    assert.equal(saved.eStatus, "waiting");
    assert.equal(saved.autoSend?.code, "integrator-unreachable");
    assert.equal(saved.autoSend?.message, "EDM'ye ulaşılamadı; belge numarasız Gönderilecekler'e eklendi, bağlantı gelince Tümünü Gönder ile gönderin.");
    // Cari hareketinin açıklaması yer tutucuya döndü (numara hiçbir yerde kalmadı).
    const notes = JSON.stringify((await ctx.api.get(`/api/workspace/accounts/${ctx.firm}`)).data);
    assert.ok(!notes.includes("TEF2026000000002"), "geri bırakılan numara cari hareketinde kalmadı");
    assert.ok(notes.includes("(gönderilecek)"), "açıklama yer tutucuya döndü");
    // 3) Tümünü Gönder → ilk belge numara alır, bağlantı kurulamaz → geri bırakılır, tur durur.
    await warmThenDown();
    const turn = await ctx.api.post("/api/workspace/invoices/send-pending", { all: true });
    assert.equal(turn.data.stopped?.code, "integrator-unreachable");
    assert.match(turn.data.results[0].message, RELEASED);
    for (const id of [saved.id, waiting.id]) assert.equal((await ctx.card(id)).number, "", "numarasız kaldı");
    // Ağ gelince: sıra eskiden yeniye, numara 2'den boşluksuz; her belge EDM'de bir kez.
    ctx.net.down = false;
    const { sent } = await ctx.press();
    assert.equal(sent, 2);
    const numbers = [(await ctx.card(waiting.id)).number, (await ctx.card(saved.id)).number].map(seqOf).sort();
    assert.deepEqual(numbers, [2, 3], "seride boşluk yok");
    assert.equal(ctx.edm.state.sent.length, 3);
  });

  test("B3 + K12: araya başka belgenin numarası girdiyse geri bırakılmaz (seride boşluk açılmaz); belge numaralı, gönderilmemiş kalır", async () => {
    let ctxRef = null;
    let armed = false;
    let other = null;
    const hook = async (op, raw, net) => {
      if (op !== "SendInvoice" || !armed) return null;
      armed = false;
      // Gönderim sırasında başka oturum aynı seride düz Kaydet yapar (numara kayıtta verilir), sonra ağ gider.
      const saved = await other.post("/api/workspace/invoices", { scenario: "service_sale", accountId: ctxRef.firm, lines: LINES, payment: { rest: "open" } });
      assert.equal(saved.status, 200, JSON.stringify(saved.data));
      ctxRef.between = saved.data;
      net.down = true;
      throw Object.assign(new TypeError("fetch failed"), { cause: { code: "ECONNREFUSED" } });
    };
    const ctx = await setup({ hook });
    ctxRef = ctx;
    open.push(ctx);
    other = await ctx.second();
    await ctx.sale(ctx.firm, { eSend: "now" });
    armed = true;
    const saved = await ctx.sale(ctx.firm, { eSend: "now" });
    assert.equal(seqOf(ctx.between.number), 3, "araya giren belge 3");
    assert.equal(seqOf(saved.number), 2, "numara korundu (serinin son numarası değildi)");
    assert.equal(saved.autoSend?.ok, false);
    ctx.net.down = false;
    const c = await ctx.card(saved.id);
    assert.equal(c.number, saved.number);
  });
});
