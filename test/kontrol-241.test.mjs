// 2.4.1 bağımsız gözden geçirme (fark 652bdc7..fa01323) — yeniden üretilen bulgular:
//  G1 (ORTA): 2.4.0'da e-SMM serisinden numara almış makbuz ve e-SMM taslağı 2.4.1'de kaydedilemiyordu (400 profile-not-allowed; ileti artık gizli işareti
//      istiyordu). G2 (DÜŞÜK): düzenlemede tür KAGIT gelirse kâğıt makbuz TES numarasını taşıyordu.
//  G3 (ORTA, 2.4.0'dan): canlı açık kurulumda (edocLive) Test Ortamı seçiliyken Servis Adresi'ne canlı adres yazılabiliyordu → test serisi (TEF/TEA,
//      TEST şeridi) belge canlı EDM'ye gider; giriş iletisi de test hesabını isterdi. Tersi: Canlı Ortam + test adresi → yasal numaralı belge GİB'e gitmez.
//  Dar kontrol turu (fa01323..c5606d5): B1 e-SMM açık kurulumda işaret kaldırılınca TES numaralı makbuz kâğıda dönüyordu; B2 Canlı Ortam + test adresinin
//      yazım varyantı (sonda "/", büyük harf, :443) kabul ediliyordu; B3 Test Ortamı + aynı varyantlar yanlış reddediliyordu.
import assert from "node:assert/strict";
import { mkdtempSync, rmSync } from "node:fs";
import os from "node:os";
import path from "node:path";
import { after, before, describe, test } from "node:test";
import { EDM_URLS } from "../server/lib/einvoice/edm.mjs";
import { ADMIN_PASSWORD, startTestServer } from "./helpers.mjs";

const unwrap = response => ({ ...response, data: response.data && typeof response.data === "object" && "ok" in response.data ? (response.data.ok ? response.data.data : response.data) : response.data });
const SELLER = { name: "Av. Deneme Ali", partyKind: "person", firstName: "Ali", familyName: "Deneme", taxNo: "10000000146", taxOffice: "Kadıköy", address: "Moda Cd. 1", district: "Kadıköy", city: "İstanbul" };
const CLIENT = { name: "Müvekkil Ticaret A.Ş.", type: "customer", taxNo: "1234567890", taxOffice: "Çankaya", address: "Atatürk Blv. 1", district: "Çankaya", city: "Ankara" };
const LINES = [{ name: "Avukatlık Ücreti", qty: 1, unitPrice: 1000, vatRate: 20 }];

async function boot(options) {
  const server = await startTestServer({ edocEnabled: true, ...options });
  const client = server.client();
  assert.equal((await client.login("admin", ADMIN_PASSWORD)).status, 200);
  return { server, api: { get: async url => unwrap(await client.get(url)), post: async (url, body) => unwrap(await client.post(url, body)), put: async (url, body) => unwrap(await client.put(url, body)) } };
}

describe("G1/G2: 2.4.0'dan kalan e-SMM makbuzu ve taslağı 2.4.1'de", () => {
  const root = mkdtempSync(path.join(os.tmpdir(), "kontrol-241-"));
  const dataDir = path.join(root, "data");
  let ctx;
  let accountId;
  let issued;
  let draft;
  before(async () => {
    // 2.4.0: bayrak açık, "e-SMM kullanıcısıyım" işaretli → makbuz TES serisinden, taslak ESMM.
    const old = await boot({ esmmEnabled: true, dataDir });
    assert.equal((await old.api.put("/api/workspace/invoices/settings", { seller: SELLER, efatura: true, earsiv: true, esmm: true })).status, 200);
    const account = await old.api.post("/api/workspace/accounts", CLIENT);
    accountId = account.data.id || account.data.account?.id;
    issued = (await old.api.post("/api/workspace/invoices", { scenario: "smm", accountId, lines: LINES, payment: { rest: "open" } })).data;
    draft = (await old.api.post("/api/workspace/invoices", { scenario: "smm", accountId, lines: LINES, payment: { rest: "open" }, status: "draft" })).data;
    assert.equal(issued.profile, "ESMM");
    assert.match(issued.number, /^TES\d{13}$/);
    assert.equal(draft.profile, "ESMM");
    await old.server.close();
    ctx = await boot({ dataDir }); // 2.4.1 (esmmEnabled kapalı), aynı veri
  });
  after(async () => {
    await ctx?.server.close();
    rmSync(root, { recursive: true, force: true });
  });
  const editBody = profile => ({ kind: "smm", scenario: "smm", accountId, issueDate: issued.issueDate, issueTime: issued.issueTime, profile, currency: "TRY", lines: [{ ...LINES[0], unitPrice: 1100 }], payment: { rest: "open" } });

  test("Düzenle formunun hesaplaması (tür ESMM gelir) 400 vermez", async () => {
    const calc = await ctx.api.post("/api/workspace/invoices/calc", editBody("ESMM"));
    assert.equal(calc.status, 200, JSON.stringify(calc.data));
  });
  test("eski makbuz düzenlenir: türü ve TES numarası korunur (tür ESMM ya da KAGIT gelse de); kâğıt belgeye TES numarası geçmez", async () => {
    for (const profile of ["ESMM", "KAGIT"]) {
      const edited = await ctx.api.post(`/api/workspace/invoices/${issued.id}/edit`, editBody(profile));
      assert.equal(edited.status, 200, `${profile}: ${JSON.stringify(edited.data)}`);
      assert.equal(edited.data.number, issued.number, `${profile}: numara aynı`);
      assert.equal(edited.data.profile, "ESMM", `${profile}: TES numaralı belge kâğıt olmaz`);
    }
  });
  test("eski e-SMM taslağı formdan kaydedilir (tür ESMM gelir): kâğıt makbuz, SMM serisi", async () => {
    const calc = await ctx.api.post("/api/workspace/invoices/calc", { ...editBody("ESMM"), issueDate: draft.issueDate });
    assert.equal(calc.status, 200, JSON.stringify(calc.data));
    assert.equal(calc.data.profile, "KAGIT");
    const done = await ctx.api.post(`/api/workspace/invoices/${draft.id}/issue`, { profile: "ESMM" });
    assert.equal(done.status, 200, JSON.stringify(done.data));
    assert.equal(done.data.profile, "KAGIT");
    assert.match(done.data.number, /^SMM\d{13}$/);
  });
});

describe("B1: e-SMM açık kurulumda işaret kaldırılınca numaralı e-SMM makbuzu türünü korur", () => {
  let ctx;
  before(async () => {
    ctx = await boot({ esmmEnabled: true });
  });
  after(async () => {
    await ctx?.server.close();
  });
  test("TES numaralı makbuz düzenlenince ESMM kalır; işaretsiz taslak kâğıt olur", async () => {
    assert.equal((await ctx.api.put("/api/workspace/invoices/settings", { seller: SELLER, efatura: true, earsiv: true, esmm: true })).status, 200);
    const account = await ctx.api.post("/api/workspace/accounts", CLIENT);
    const accountId = account.data.id || account.data.account?.id;
    const issued = (await ctx.api.post("/api/workspace/invoices", { scenario: "smm", accountId, lines: LINES, payment: { rest: "open" } })).data;
    assert.match(issued.number, /^TES\d{13}$/);
    assert.equal((await ctx.api.put("/api/workspace/invoices/settings", { esmm: false })).status, 200);
    for (const profile of ["ESMM", "KAGIT"]) {
      const edited = await ctx.api.post(`/api/workspace/invoices/${issued.id}/edit`, { kind: "smm", scenario: "smm", accountId, issueDate: issued.issueDate, issueTime: issued.issueTime, profile, currency: "TRY", lines: [{ ...LINES[0], unitPrice: 1200 }], payment: { rest: "open" } });
      assert.equal(edited.status, 200, `${profile}: ${JSON.stringify(edited.data)}`);
      assert.equal(edited.data.profile, "ESMM", `${profile}: TES numaralı belge kâğıt olmaz`);
      assert.equal(edited.data.number, issued.number);
    }
  });
});

describe("G3: Servis Adresi ile Çalışma Ortamı uyumlu olmalı (canlı açık kurulum)", () => {
  let ctx;
  let calls = 0;
  before(async () => {
    ctx = await boot({ edocLive: true, fetchImpl: async () => { calls += 1; throw new Error("ağa çıkılmamalı"); } });
    assert.equal((await ctx.api.put("/api/workspace/invoices/settings", { seller: { name: "Deneme Ltd.", taxNo: "1234567890", taxOffice: "Çankaya", address: "A", district: "Çankaya", city: "Ankara" }, efatura: true, earsiv: true })).status, 200);
  });
  after(async () => {
    await ctx?.server.close();
  });
  test("Test Ortamı + canlı adres reddedilir; Canlı Ortam + test adresi reddedilir", async () => {
    const testLive = await ctx.api.put("/api/workspace/invoices/settings", { integrator: { env: "test", baseUrl: EDM_URLS.live, username: "u", password: "p" } });
    assert.equal(testLive.status, 400, JSON.stringify(testLive.data));
    assert.equal(testLive.data.code, "integrator-env-url");
    const liveTest = await ctx.api.put("/api/workspace/invoices/settings", { integrator: { env: "live", baseUrl: EDM_URLS.test, username: "u", password: "p" } });
    assert.equal(liveTest.status, 400, JSON.stringify(liveTest.data));
    assert.equal(liveTest.data.code, "integrator-env-url");
  });
  test("B2/B3: adresin yazım varyantları (sonda /, büyük harf, :443) ortamına göre aynı sayılır", async () => {
    const variants = url => [`${url}/`, url.replace("https://test.", "https://TEST.").replace("https://portal2.", "https://PORTAL2."), url.replace(".com.tr/", ".com.tr:443/")];
    for (const baseUrl of variants(EDM_URLS.test)) {
      const liveTest = await ctx.api.put("/api/workspace/invoices/settings", { integrator: { env: "live", baseUrl, username: "u", password: "p" } });
      assert.equal(liveTest.status, 400, `Canlı + ${baseUrl}: ${JSON.stringify(liveTest.data)}`);
      assert.equal(liveTest.data.code, "integrator-env-url");
      const testTest = await ctx.api.put("/api/workspace/invoices/settings", { integrator: { env: "test", baseUrl, username: "u", password: "p" } });
      assert.equal(testTest.status, 200, `Test + ${baseUrl}: ${JSON.stringify(testTest.data)}`);
    }
    for (const baseUrl of variants(EDM_URLS.live)) {
      const testLive = await ctx.api.put("/api/workspace/invoices/settings", { integrator: { env: "test", baseUrl, username: "u", password: "p" } });
      assert.equal(testLive.status, 400, `Test + ${baseUrl}: ${JSON.stringify(testLive.data)}`);
    }
    assert.equal((await ctx.api.put("/api/workspace/invoices/settings", { integrator: { env: "test", baseUrl: "" } })).status, 200);
  });
  test("uyumlu ayarlar kaydedilir (boş adres, ortamın kendi adresi)", async () => {
    for (const [env, baseUrl] of [["test", ""], ["test", EDM_URLS.test], ["live", ""], ["live", EDM_URLS.live]]) {
      const saved = await ctx.api.put("/api/workspace/invoices/settings", { integrator: { env, baseUrl, username: "u", password: "p" } });
      assert.equal(saved.status, 200, `${env} ${baseUrl}: ${JSON.stringify(saved.data)}`);
    }
  });
  test("veri tabanında kalmış uyumsuz kayıt (Test Ortamı + canlı adres) ağa çıkmadan reddedilir", async () => {
    calls = 0;
    const stored = JSON.parse(ctx.server.app.store.setting("invoice.settings", "{}"));
    ctx.server.app.store.setSetting("invoice.settings", JSON.stringify({ ...stored, integrator: { ...stored.integrator, env: "test", baseUrl: EDM_URLS.live } }));
    const tested = await ctx.api.post("/api/workspace/invoices/integrator/test", {});
    assert.equal(tested.status, 409, JSON.stringify(tested.data));
    assert.equal(tested.data.code, "integrator-env-url");
    assert.equal(calls, 0);
  });
});
