// 2.4.7 E4/E5 (EDM iş ortaklığı B1/B2): e-Belge KULLANIM SAYACI uçtan uca — sahte EDM (test/einvoice-mock.mjs, …/ESmmEDM.svc dahil), sahte iş saati
// (ders 13: ay sonu 30.06 23:5x → ayın 1'i), ağa çıkılmaz, lisans servisi yerel başvuru modeli (ders 30: gerçek servise ulaşılmaz).
// Kural (lib/einvoice/kullanim.mjs): EDM'nin KABUL ETTİĞİ gönderim ay × tür × ortam; aynı ETTN + ortam bir kez; yeniden deneme / 11048 / durum sorgusu /
// iptal sayıyı artırmaz; sonucu belirsiz gönderim sonradan kesin kabul olursa o zaman bir kez (ay = gönderimin ayı); portal taslağı ve portaldan gönderim
// sayılmaz; test ve canlı ayrı; şirketler lisans doğrulamasında toplanır; sıfırlama sayacı silmez.
// Nasıl bozulur (testler buradan): aynı belgeyi iki kez gönder / Durum Sorgula'yı iki kez çağır / EDM reddettikten sonra yeniden gönder / bağlantı
// istek işlendikten sonra kopsun (gece yarısından hemen önce) ve ertesi gün kesinleşsin / 11048 kendi ETTN'iyle / iptal et / portala taslak yükle ve
// portaldan gönder / ortamı canlıya çevir / ikinci şirket / Şirket Verisini Sıfırla / lisans gövdesinde ETTN-VKN sızıntısı / eski sunucu alanı reddetsin.
import assert from "node:assert/strict";
import { generateKeyPairSync } from "node:crypto";
import { after, before, describe, test } from "node:test";
import { createClock } from "../server/lib/clock.mjs";
import { resetEdmCaches } from "../server/lib/einvoice/edm.mjs";
import { createReferenceLicenseService, keyIdForLicense } from "../tools/lib/license-service.mjs";
import { BUYER_VKN, OUR_VKN, startMockEdm, vkn } from "./einvoice-mock.mjs";
import { ADMIN_PASSWORD, startTestServer } from "./helpers.mjs";

const unwrap = response => ({ ...response, data: response.data && typeof response.data === "object" && "ok" in response.data ? (response.data.ok ? response.data.data : response.data) : response.data });
const SELLER = { name: "Deneme Ofis Ltd.", taxNo: OUR_VKN, taxOffice: "Çankaya", address: "Atatürk Blv. 1", district: "Çankaya", city: "Ankara", email: "bilgi@deneme.com.tr" };
const PERSON = { name: "Ayşe Kaya", type: "customer", partyKind: "person", firstName: "Ayşe", familyName: "Kaya", taxNo: "10000000146", taxOffice: "Konak", address: "Kordon 1", district: "Konak", city: "İzmir", email: "ayse@example.com" };
const FIRM = { name: "Alıcı Ticaret A.Ş.", type: "customer", taxNo: BUYER_VKN, taxOffice: "Kavaklıdere", address: "Cinnah Cd. 10", district: "Çankaya", city: "Ankara", eInvoice: true, eAlias: "urn:mail:defaultpk@alici.com.tr" };
const CLIENT = { name: "Müvekkil Ticaret A.Ş.", type: "customer", taxNo: vkn(111222333), taxOffice: "Konak", address: "Kordon 5", district: "Konak", city: "İzmir", email: "muhasebe@muvekkil.com.tr" };
const LINES = [{ name: "Danışmanlık", qty: 1, unitPrice: 500, vatRate: 20 }];
const INTEGRATOR = url => ({ env: "test", baseUrl: url, username: "edmkullanici", password: "Gizli-Parola-1", senderAlias: "urn:mail:defaultgb@deneme.com.tr" });
const fetchFailed = code => Object.assign(new TypeError("fetch failed"), { cause: Object.assign(new Error("other side closed"), { code }) });
const soapFault = (code, message) => new Response(`<s:Envelope xmlns:s="http://schemas.xmlsoap.org/soap/envelope/"><s:Body><s:Fault><faultcode>s:Client</faultcode><faultstring>${message}</faultstring><detail><RequestFault xmlns="urn:edm:test"><ERROR_CODE>${code}</ERROR_CODE><ERROR_SHORT_DES>${message}</ERROR_SHORT_DES></RequestFault></detail></s:Fault></s:Body></s:Envelope>`, { status: 500, headers: { "content-type": "text/xml" } });
const zero = { efatura: 0, earsiv: 0, esmm: 0 };

describe("2.4.7 e-Belge kullanım sayacı (EDM'nin kabul ettiği gönderimler)", () => {
  const clock = createClock({ time: "2026-06-30T23:40:00" });
  const faults = [];
  const ledgerFault = { on: false };
  const licenseBodies = [];
  let reference;
  let edm;
  let server;
  let api;
  let personId;
  let firmId;
  let clientId;
  const fetchImpl = async (input, init = {}) => {
    const url = String(typeof input === "string" || input instanceof URL ? input : input.url);
    if (!url.startsWith("http://127.0.0.1")) throw new Error(`ağa çıkılmaz (test): ${url}`);
    const at = faults.findIndex(fault => String(init.body || "").includes(`${fault.op}Request`));
    if (at >= 0) {
      const [fault] = faults.splice(at, 1);
      // after: istek EDM'ye ULAŞTI ve işlendi, yanıt gelmeden bağlantı koptu (sonucu belirsiz). reject: EDM reddetti. missing: durum sorgusu "bulunamadı".
      if (fault.kind === "after") {
        await globalThis.fetch(input, init).then(response => response.text());
        throw fetchFailed("UND_ERR_SOCKET");
      }
      if (fault.kind === "reject") return soapFault(11999, "Geçici sistem hatası");
      if (fault.kind === "missing") return soapFault(11017, "Fatura bulunamadı");
    }
    return globalThis.fetch(input, init);
  };
  const usage = async (query = "") => (await api.get(`/api/workspace/invoices-usage${query ? `?${query}` : ""}`)).data.months;
  const cell = (rows, month, env) => {
    const row = rows.find(item => item.month === month && item.env === env);
    return row ? { efatura: row.efatura, earsiv: row.earsiv, esmm: row.esmm } : zero;
  };
  const sale = (accountId, extra = {}, query = "") => api.post(`/api/workspace/invoices${query}`, { scenario: "service_sale", accountId, lines: LINES, payment: { rest: "open" }, eSend: "later", ...extra });
  const send = (id, query = "") => api.post(`/api/workspace/invoices/${id}/send${query}`, {});
  const refresh = (id, query = "") => api.post(`/api/workspace/invoices/${id}/e-refresh${query}`, {});
  const card = async id => (await api.get(`/api/workspace/invoices/${id}`)).data;

  before(async () => {
    resetEdmCaches();
    edm = await startMockEdm();
    const { publicKey, privateKey } = generateKeyPairSync("ed25519");
    const pem = privateKey.export({ format: "pem", type: "pkcs8" });
    const trusted = { "test-lisans-1": publicKey.export({ format: "der", type: "spki" }).toString("base64") };
    reference = createReferenceLicenseService({ privateKeyPem: pem, keyId: keyIdForLicense(pem, trusted) });
    const licenseFetch = async (url, init) => {
      if (String(url).endsWith("/v1/check")) licenseBodies.push(JSON.parse(init.body));
      if (String(url).endsWith("/v1/check") && licenseFetch.rejectUsage && JSON.parse(init.body).usage) return new Response(JSON.stringify({ ok: false, code: "BAD_REQUEST", error: "Geçersiz istek." }), { status: 400, headers: { "content-type": "application/json" } });
      return reference.fetch(url, init);
    };
    server = await startTestServer({
      edocEnabled: true,
      edocLive: true,
      esmmEnabled: true,
      fetchImpl,
      now: clock,
      edocUsageFault: () => ledgerFault.on,
      edocStatusPollMs: [5, 5],
      env: { HUKUK_LICENSE_URL: "http://127.0.0.1:9" },
      license: { enforce: false, trustedKeys: trusted, services: ["https://lisans.test/api/lisans"], fetchImpl: licenseFetch, machineId: "0123456789abcdef0123456789abcdef", firstCheckDelayMs: 3_600_000, autoTrial: false },
    });
    server.licenseFetch = licenseFetch;
    const client = server.client();
    api = { get: async url => unwrap(await client.get(url)), post: async (url, body) => unwrap(await client.post(url, body)), put: async (url, body) => unwrap(await client.put(url, body)) };
    assert.equal((await client.login("admin", ADMIN_PASSWORD)).status, 200);
    const saved = await api.put("/api/workspace/invoices/settings", { seller: SELLER, efatura: true, earsiv: true, esmm: true, eOptions: { draftUpload: true }, integrator: INTEGRATOR(edm.url) });
    assert.equal(saved.status, 200, JSON.stringify(saved.data));
    for (const [body, set] of [[PERSON, id => (personId = id)], [FIRM, id => (firmId = id)], [CLIENT, id => (clientId = id)]]) {
      const created = await api.post("/api/workspace/accounts", body);
      assert.equal(created.status, 200, JSON.stringify(created.data));
      set(created.data.id || created.data.account?.id);
    }
  });
  after(async () => {
    await server?.close();
    await edm?.close();
  });

  test("boş veri: sayaç boş; e-Arşiv gönderimi 1 sayılır; Durum Sorgula (2 kez) ve aynı belgeyi yeniden Gönder sayıyı artırmaz", async () => {
    assert.deepEqual(await usage(), []);
    const doc = (await sale(personId)).data;
    assert.equal(doc.eStatus, "waiting", JSON.stringify(doc));
    const sent = await send(doc.id);
    assert.equal(sent.status, 200, JSON.stringify(sent.data));
    assert.equal(sent.data.profile, "EARSIVFATURA");
    assert.ok(["sent", "processing", "accepted"].includes(sent.data.eStatus), sent.data.eStatus);
    assert.deepEqual(cell(await usage(), "2026-06", "test"), { ...zero, earsiv: 1 });
    for (let i = 0; i < 2; i += 1) assert.equal((await refresh(doc.id)).status, 200);
    const again = await send(doc.id);
    assert.equal(again.status, 409, "iletilmiş belge yeniden gönderilmez");
    assert.deepEqual(cell(await usage(), "2026-06", "test"), { ...zero, earsiv: 1 });
  });

  test("EDM reddi (Hata) sayılmaz; düzeltip yeniden gönderilen e-Fatura bir kez sayılır", async () => {
    const doc = (await sale(firmId)).data;
    faults.push({ op: "SendInvoice", kind: "reject" });
    const rejected = await send(doc.id);
    assert.notEqual(rejected.status, 200);
    assert.equal((await card(doc.id)).eStatus, "error");
    assert.deepEqual(cell(await usage(), "2026-06", "test"), { ...zero, earsiv: 1 }, "ret sayılmadı");
    const retried = await send(doc.id);
    assert.equal(retried.status, 200, JSON.stringify(retried.data));
    assert.equal(retried.data.profile, "TEMELFATURA");
    assert.deepEqual(cell(await usage(), "2026-06", "test"), { efatura: 1, earsiv: 1, esmm: 0 });
  });

  test("ay sonu: istek EDM'ye 30.06 23:5x'te ulaşıp yanıt koptu (belirsiz, sayılmaz); 01.07'de Durum Sorgula kabulü görür → HAZİRAN'a bir kez", async () => {
    clock.set("2026-06-30T23:59:00");
    const doc = (await sale(personId)).data;
    faults.push({ op: "SendInvoice", kind: "after" });
    const cut = await send(doc.id);
    assert.notEqual(cut.status, 200, "kopan yanıt");
    const uncertain = await card(doc.id);
    assert.equal(uncertain.eStatusLabel, "Sonucu Belirsiz", JSON.stringify({ eStatus: uncertain.eStatus, label: uncertain.eStatusLabel }));
    assert.deepEqual(cell(await usage(), "2026-06", "test"), { efatura: 1, earsiv: 1, esmm: 0 }, "belirsiz sayılmaz");
    clock.set("2026-07-01T00:05:00");
    const checked = await refresh(doc.id);
    assert.equal(checked.status, 200, JSON.stringify(checked.data));
    assert.ok(["sent", "processing", "accepted"].includes(checked.data.eStatus), checked.data.eStatus);
    const rows = await usage();
    assert.deepEqual(cell(rows, "2026-06", "test"), { efatura: 1, earsiv: 2, esmm: 0 }, "gönderimin ayı (Haziran)");
    assert.deepEqual(cell(rows, "2026-07", "test"), zero, "kesinleştiği ay (Temmuz) değil");
    assert.equal((await refresh(doc.id)).status, 200);
    assert.deepEqual(cell(await usage(), "2026-06", "test"), { efatura: 1, earsiv: 2, esmm: 0 }, "ikinci sorgu artırmaz");
  });

  test("11048 kendi ETTN'iyle: belirsiz gönderim → durum 'bulunamadı' gelir → yeniden gönderim 11048 → belge EDM'de bulunur → bir kez sayılır", async () => {
    const doc = (await sale(personId)).data;
    faults.push({ op: "SendInvoice", kind: "after" });
    assert.notEqual((await send(doc.id)).status, 200);
    assert.deepEqual(cell(await usage(), "2026-07", "test"), zero);
    faults.push({ op: "GetInvoiceStatus", kind: "missing" });
    const resend = await send(doc.id);
    assert.equal(resend.status, 200, JSON.stringify(resend.data));
    assert.match(String(resend.data.sendResult?.message || ""), /./);
    assert.equal(edm.state.sent.filter(item => item.uuid === doc.ettn).length, 1, "EDM belgeyi bir kez aldı");
    assert.deepEqual(cell(await usage(), "2026-07", "test"), { ...zero, earsiv: 1 });
    assert.equal((await send(doc.id)).status, 409);
    assert.deepEqual(cell(await usage(), "2026-07", "test"), { ...zero, earsiv: 1 });
  });

  test("iptal sayıyı değiştirmez; portala taslak yükleme ve PORTALDAN gönderim sayılmaz; taslağın programdan gönderimi sayılır", async () => {
    const before = cell(await usage(), "2026-07", "test");
    const quick = (await sale(personId)).data;
    assert.equal((await send(quick.id)).status, 200);
    const afterSend = cell(await usage(), "2026-07", "test");
    assert.deepEqual(afterSend, { ...before, earsiv: before.earsiv + 1 });
    const cancelled = await api.post(`/api/workspace/invoices/${quick.id}/cancel`, { reason: "Müşteri vazgeçti" });
    assert.equal(cancelled.status, 200, JSON.stringify(cancelled.data));
    assert.deepEqual(cell(await usage(), "2026-07", "test"), afterSend, "iptal artırmaz, azaltmaz");

    const portal = (await sale(personId)).data;
    const drafted = await api.post(`/api/workspace/invoices/${portal.id}/e-draft`, {});
    assert.equal(drafted.status, 200, JSON.stringify(drafted.data));
    assert.equal((await card(portal.id)).eStatus, "draft");
    assert.deepEqual(cell(await usage(), "2026-07", "test"), afterSend, "taslak sayılmaz");
    edm.sendFromPortal((await card(portal.id)).ettn);
    assert.equal((await refresh(portal.id)).status, 200);
    assert.ok(["sent", "accepted"].includes((await card(portal.id)).eStatus));
    assert.deepEqual(cell(await usage(), "2026-07", "test"), afterSend, "portaldan gönderilen belge sayılmaz");

    const program = (await sale(personId)).data;
    assert.equal((await api.post(`/api/workspace/invoices/${program.id}/e-draft`, {})).status, 200);
    const fromProgram = await send(program.id);
    assert.equal(fromProgram.status, 200, JSON.stringify(fromProgram.data));
    assert.deepEqual(cell(await usage(), "2026-07", "test"), { ...afterSend, earsiv: afterSend.earsiv + 1 }, "taslağı programdan gönderim sayılır");
  });

  test("e-SMM esmm türünde sayılır", async () => {
    const before = cell(await usage(), "2026-07", "test");
    const smm = await api.post("/api/workspace/invoices", { scenario: "smm", accountId: clientId, lines: [{ name: "Avukatlık Ücreti", qty: 1, unitPrice: 1000, vatRate: 20 }], payment: { rest: "open" }, eSend: "now" });
    assert.equal(smm.status, 200, JSON.stringify(smm.data));
    assert.equal(smm.data.profile, "ESMM");
    assert.equal(smm.data.eStatus, "sent", smm.data.eMessage);
    assert.deepEqual(cell(await usage(), "2026-07", "test"), { ...before, esmm: before.esmm + 1 });
  });

  test("canlı ortam ayrı sayılır; test sayıları değişmez", async () => {
    const testBefore = await usage();
    const live = await api.put("/api/workspace/invoices/settings", { integrator: { ...INTEGRATOR(edm.url), env: "live" }, series: { earsiv: "DST", efatura: "DSF", esmm: "DSM" } });
    assert.equal(live.status, 200, JSON.stringify(live.data));
    const doc = (await sale(personId)).data;
    const sent = await send(doc.id);
    assert.equal(sent.status, 200, JSON.stringify(sent.data));
    assert.match(sent.data.number, /^DST2026/);
    const rows = await usage();
    assert.deepEqual(cell(rows, "2026-07", "live"), { ...zero, earsiv: 1 });
    assert.deepEqual(cell(rows, "2026-07", "test"), cell(testBefore, "2026-07", "test"));
    assert.deepEqual(cell(rows, "2026-06", "test"), cell(testBefore, "2026-06", "test"));
    assert.equal((await api.put("/api/workspace/invoices/settings", { integrator: INTEGRATOR(edm.url) })).status, 200);
  });

  test("ikinci şirket kendi sayacını tutar; lisans doğrulaması (/v1/check) iki şirketin TOPLAMINI gönderir; gövdede ETTN / VKN / belge no yok", async () => {
    const created = await api.post("/api/companies", { name: "İkinci Büro", select: false });
    assert.equal(created.status, 200, JSON.stringify(created.data));
    const second = created.data.company || created.data;
    const q = `?hofCompany=${encodeURIComponent(second.id)}`;
    const saved = await api.put(`/api/workspace/invoices/settings${q}`, { seller: { ...SELLER, name: "İkinci Büro Ltd." }, efatura: true, earsiv: true, start: { TEA2026: 500 }, integrator: { ...INTEGRATOR(edm.url), senderAlias: "urn:mail:defaultgb@ikinci.com.tr" } });
    assert.equal(saved.status, 200, JSON.stringify(saved.data));
    const person = await api.post(`/api/workspace/accounts${q}`, PERSON);
    assert.equal(person.status, 200, JSON.stringify(person.data));
    const doc = (await sale(person.data.id || person.data.account?.id, {}, q)).data;
    const sent = await send(doc.id, q);
    assert.equal(sent.status, 200, JSON.stringify(sent.data));
    const own = (await api.get(`/api/workspace/invoices-usage${q}`)).data.months;
    assert.deepEqual(cell(own, "2026-07", "test"), { ...zero, earsiv: 1 }, "002 yalnız kendisininkini görür");
    const first = await usage();

    assert.equal((await api.post("/api/license/trial", {})).status, 200);
    licenseBodies.length = 0;
    const checked = await api.post("/api/license/check", {});
    assert.equal(checked.status, 200, JSON.stringify(checked.data));
    assert.equal(licenseBodies.length, 1);
    const body = licenseBodies[0];
    // S5: içinde bulunulan ay (Temmuz) + önceki 2 ay, ay × ortam başına satır (sıfırlar dahil) = 6 satır.
    const expected = new Map();
    for (const month of ["2026-05", "2026-06", "2026-07"]) for (const env of ["live", "test"]) expected.set(`${month}|${env}`, { month, env, efatura: 0, earsiv: 0, esmm: 0 });
    for (const row of [...first, ...own]) {
      const key = `${row.month}|${row.env}`;
      const entry = expected.get(key) || { month: row.month, env: row.env, efatura: 0, earsiv: 0, esmm: 0 };
      for (const kind of ["efatura", "earsiv", "esmm"]) entry[kind] += row[kind];
      expected.set(key, entry);
    }
    const sorted = list => [...list].sort((a, b) => `${a.month}|${a.env}`.localeCompare(`${b.month}|${b.env}`));
    assert.deepEqual(sorted(body.usage.edoc), sorted([...expected.values()]), JSON.stringify(body.usage));
    assert.equal(body.usage.edoc.length, 6);
    assert.deepEqual(cell(body.usage.edoc, "2026-07", "test"), { ...zero, earsiv: cell(first, "2026-07", "test").earsiv + 1, esmm: cell(first, "2026-07", "test").esmm });
    assert.deepEqual(Object.keys(body.usage), ["edoc"]);
    for (const row of body.usage.edoc) assert.deepEqual(Object.keys(row).sort(), ["earsiv", "efatura", "env", "esmm", "month"]);
    // Gövdenin alanları: 2.4.6'nın gönderdikleri + usage (başka alan eklenmedi). instanceId kurulum kimliğidir (UUID; 2.4.6'da da gidiyordu).
    assert.deepEqual(Object.keys(body).sort(), ["instanceId", "kind", "licenseId", "machine", "product", "usage", "version"]);
    const ettns = [...edm.state.sent, ...(edm.state.smm.sent || [])].map(item => item.uuid).filter(Boolean);
    assert.ok(ettns.length >= 5);
    const text = JSON.stringify({ ...body, instanceId: "" });
    for (const ettn of ettns) assert.ok(!text.toLowerCase().includes(String(ettn).toLowerCase()), `ETTN ${ettn} gövdede`);
    assert.doesNotMatch(text, /[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/i, "ETTN yok");
    assert.doesNotMatch(text, /\b\d{10,11}\b/, "VKN / TCKN yok");
    assert.doesNotMatch(text, /\b(TEA|TEF|TES|DST)20\d{2}\d{9}\b/, "belge numarası yok");
    assert.doesNotMatch(text, /Ayşe|Alıcı|Müvekkil|Danışmanlık/, "alıcı / içerik yok");
  });

  test("eski / katı lisans sunucusu usage alanını BAD_REQUEST ile reddederse doğrulama özetsiz bir kez yinelenir ve başarılı olur", async () => {
    server.licenseFetch.rejectUsage = true;
    licenseBodies.length = 0;
    try {
      const checked = await api.post("/api/license/check", {});
      assert.equal(checked.status, 200, JSON.stringify(checked.data));
      assert.equal(licenseBodies.length, 2);
      assert.ok(licenseBodies[0].usage, "ilk istek özetli");
      assert.equal(licenseBodies[1].usage, undefined, "yineleme özetsiz");
    } finally {
      server.licenseFetch.rejectUsage = false;
    }
  });

  test("S4 kesinti: kullanım defterine yazım düşer (durum ve şirket izi yazıldı) → okumada izden bir kez tamamlanır; çift sayım yok", async () => {
    const before = cell(await usage(), "2026-07", "test");
    ledgerFault.on = true;
    let sent;
    try {
      const doc = (await sale(personId)).data;
      sent = await send(doc.id);
    } finally {
      ledgerFault.on = false;
    }
    assert.equal(sent.status, 200, "gönderim kullanıcı için başarılı");
    const read = (await api.get("/api/workspace/invoices-usage")).data;
    assert.equal(read.synced, 1, "eksik satır okumada izden tamamlandı");
    assert.deepEqual(cell(read.months, "2026-07", "test"), { ...before, earsiv: before.earsiv + 1 });
    assert.deepEqual(cell(read.journal, "2026-07", "test"), cell(read.months, "2026-07", "test"), "şirket izi = defter");
    const again = (await api.get("/api/workspace/invoices-usage")).data;
    assert.equal(again.synced, 0, "ikinci aktarma bir şey eklemez");
    assert.deepEqual(cell(again.months, "2026-07", "test"), { ...before, earsiv: before.earsiv + 1 });
  });

  test("S4 yedek tatbikatı (002): gönder → yedek → gönder → geri yükle → sayaç değişmedi; sıfırla → sayaç değişmedi; şirket izi geri gider, defter gitmez", async () => {
    const list = (await api.get("/api/companies")).data;
    const second = (list.companies || list).find(item => item.code === "002");
    const q = `?hofCompany=${encodeURIComponent(second.id)}`;
    const own = async () => (await api.get(`/api/workspace/invoices-usage${q}`)).data;
    const person = (await api.get(`/api/workspace/accounts${q}`)).data;
    const personOf = (person.accounts || person.items || person).find?.(item => item.name === PERSON.name)?.id;
    assert.ok(personOf, JSON.stringify(person).slice(0, 300));
    const start = cell((await own()).months, "2026-07", "test").earsiv;
    const a = (await sale(personOf, {}, q)).data;
    assert.equal((await send(a.id, q)).status, 200);
    assert.equal(cell((await own()).months, "2026-07", "test").earsiv, start + 1);
    const backup = await api.post("/api/admin/backups", { scope: "one", companyId: second.id });
    assert.equal(backup.status, 200, JSON.stringify(backup.data));
    const name = backup.data.backups.find(item => item.companyId === second.id).name;
    const b = (await sale(personOf, {}, q)).data;
    assert.equal((await send(b.id, q)).status, 200);
    assert.equal(cell((await own()).months, "2026-07", "test").earsiv, start + 2);
    const restored = await api.post("/api/admin/backups/restore", { name, company: second.id, confirm: second.code, password: ADMIN_PASSWORD });
    assert.equal(restored.status, 200, JSON.stringify(restored.data));
    assert.equal(restored.data.restored, true);
    const after = await own();
    assert.equal(cell(after.months, "2026-07", "test").earsiv, start + 2, "geri yükleme defteri geri almaz");
    assert.equal(cell(after.journal, "2026-07", "test").earsiv, start + 1, "şirket izi yedekle birlikte geri gitti (B'nin izi yok)");
    const reset = await api.post(`/api/companies/${second.id}/reset`, { mode: "movements", confirm: second.code, password: ADMIN_PASSWORD });
    assert.equal(reset.status, 200, JSON.stringify(reset.data));
    assert.equal(cell((await own()).months, "2026-07", "test").earsiv, start + 2, "sıfırlama defteri etkilemez");
  });

  test("F2: EDM reddiyle 'Hata'ya düşen belgede Durum Sorgula sonradan kabul görürse bir kez sayılır (ret anının ayına); ikinci sorgu artırmaz", async () => {
    const before = cell(await usage(), "2026-07", "test");
    const doc = (await sale(personId)).data;
    faults.push({ op: "SendInvoice", kind: "reject" });
    assert.notEqual((await send(doc.id)).status, 200);
    const failed = await card(doc.id);
    assert.equal(failed.eStatus, "error");
    assert.deepEqual(cell(await usage(), "2026-07", "test"), before, "ret sayılmaz");
    // EDM ret yanıtına rağmen belgeyi almış çıktı (durum kaydı kabul diyor).
    edm.state.statuses.set(failed.ettn, ["SEND - SUCCEED"]);
    const checked = await refresh(doc.id);
    assert.equal(checked.status, 200, JSON.stringify(checked.data));
    assert.ok(["sent", "accepted"].includes(checked.data.eStatus), checked.data.eStatus);
    assert.deepEqual(cell(await usage(), "2026-07", "test"), { ...before, earsiv: before.earsiv + 1 });
    assert.equal((await refresh(doc.id)).status, 200);
    assert.deepEqual(cell(await usage(), "2026-07", "test"), { ...before, earsiv: before.earsiv + 1 });
  });

  test("Şirket Verisini Sıfırla (Tümünü) sayacı silmez", async () => {
    const before = await usage();
    const list = (await api.get("/api/companies")).data;
    const company = (list.companies || list).find(item => item.code === "001");
    const reset = await api.post(`/api/companies/${company.id}/reset`, { mode: "all", confirm: company.code, password: ADMIN_PASSWORD });
    assert.equal(reset.status, 200, JSON.stringify(reset.data));
    assert.deepEqual(await usage(), before);
  });
});
