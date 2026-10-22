// 2.4.1 — e-SMM gönderimi hazır olana dek gizli (kullanıcı kararı 16.10.2026: "e-SMM gizli yaparak … teslim et"). Bulgu: 2.4.0'da "e-SMM kullanıcısıyım"
// işaretlenince serbest meslek makbuzu e-SMM serisinden numara alıyor (ProfileID ESMM) ama EDM'ye gönderilemiyor ("Bu belge gönderilemez.") — canlıda
// numara harcanır, belge GİB'e gitmez. EDM'de e-SMM ayrı servis/yetki; bağlanana kadar config.esmmEnabled kapalı.
// 2.4.4 (iş listesi 24): e-SMM bağlandı, üretim girişi (server/server.mjs) bayrağı AÇAR (test/edoc-uretim.test.mjs). Bu dosya iki kurulumu da korur:
// bayrağı vermeyen kurulum (testlerin varsayılanı; 2.4.1–2.4.3 üretimi) eski "gizli" davranışı, açık kurulum (2.4.4 üretimi) e-SMM'yi. Açık kurulumda
// e-SMM kullanıcısı olmayan firmanın değişmediği test/esmm-acik-244.test.mjs'te; gönderim test/esmm-gonderim-244.test.mjs'te.
// "Nasıl bozulur?": işaret ekrandan ya da API'den açılır; 2.4.0'da açılmış eski kayıt makbuzu yine e-SMM yapar; seri listelerinde e-SMM satırı kalır;
// bayrak açık kurulumda (ileride) eski davranış bozulur.
import assert from "node:assert/strict";
import { after, before, describe, test } from "node:test";
import { ADMIN_PASSWORD, startTestServer } from "./helpers.mjs";

const unwrap = response => ({ ...response, data: response.data && typeof response.data === "object" && "ok" in response.data ? (response.data.ok ? response.data.data : response.data) : response.data });
const SELLER = { name: "Av. Deneme Ali", partyKind: "person", firstName: "Ali", familyName: "Deneme", taxNo: "10000000146", taxOffice: "Kadıköy", address: "Moda Cd. 1", district: "Kadıköy", city: "İstanbul" };
const CLIENT = { name: "Müvekkil Ticaret A.Ş.", type: "customer", taxNo: "1234567890", taxOffice: "Çankaya", address: "Atatürk Blv. 1", district: "Çankaya", city: "Ankara" };

async function boot(options) {
  const server = await startTestServer({ edocEnabled: true, ...options });
  const client = server.client();
  assert.equal((await client.login("admin", ADMIN_PASSWORD)).status, 200);
  const api = { get: async url => unwrap(await client.get(url)), post: async (url, body) => unwrap(await client.post(url, body)), put: async (url, body) => unwrap(await client.put(url, body)) };
  const account = await api.post("/api/workspace/accounts", CLIENT);
  assert.equal(account.status, 200, JSON.stringify(account.data));
  return { server, api, accountId: account.data.id || account.data.account?.id };
}
const smm = (api, accountId) => api.post("/api/workspace/invoices", { scenario: "smm", accountId, lines: [{ name: "Avukatlık Ücreti", qty: 1, unitPrice: 1000, vatRate: 20 }], payment: { rest: "open" } });

describe("e-SMM kapalı kurulum (esmmEnabled verilmez — testlerin varsayılanı; 2.4.1–2.4.3 üretimi)", () => {
  let ctx;
  before(async () => {
    ctx = await boot({});
  });
  after(async () => {
    await ctx?.server.close();
  });
  test("işaret API'den açılamaz: 400 esmm-unavailable; ayar kaydı e-SMM'yi kapalı döndürür", async () => {
    const res = await ctx.api.put("/api/workspace/invoices/settings", { seller: SELLER, efatura: true, earsiv: true, esmm: true });
    assert.equal(res.status, 400, JSON.stringify(res.data));
    assert.equal(res.data.code, "esmm-unavailable");
    const ok = await ctx.api.put("/api/workspace/invoices/settings", { seller: SELLER, efatura: true, earsiv: true, esmm: false });
    assert.equal(ok.status, 200, JSON.stringify(ok.data));
    assert.equal(ok.data.esmm, false);
    assert.equal(ok.data.esmmAvailable, false);
    assert.ok(!("esmm" in (ok.data.nextNumbers || {})), "Numaralar listesinde e-SMM serisi yok");
    assert.ok(!("esmm" in (ok.data.testNumbers || {})), "test numaralarında e-SMM yok");
  });
  test("2.4.0'da açılmış eski kayıt (esmm: true) makbuzu e-SMM yapmaz: kâğıt SMM serisi, ayar e-SMM'yi kapalı gösterir", async () => {
    const stored = JSON.parse(ctx.server.app.store.setting("invoice.settings", "{}"));
    ctx.server.app.store.setSetting("invoice.settings", JSON.stringify({ ...stored, esmm: true }));
    const settings = await ctx.api.get("/api/workspace/invoices/settings");
    assert.equal(settings.status, 200);
    assert.equal(settings.data.esmm, false, "eski kayıt ekranda kapalı görünür");
    const doc = await smm(ctx.api, ctx.accountId);
    assert.equal(doc.status, 200, JSON.stringify(doc.data));
    assert.equal(doc.data.profile, "KAGIT");
    assert.match(doc.data.number, /^SMM\d{13}$/, `kâğıt makbuz serisi: ${doc.data.number}`);
  });
});

describe("e-SMM açık kurulum (2.4.4 üretimi: server/server.mjs esmmEnabled)", () => {
  let ctx;
  before(async () => {
    ctx = await boot({ esmmEnabled: true });
  });
  after(async () => {
    await ctx?.server.close();
  });
  test("işaret açılır, makbuz e-SMM (test serisi TES) olur; Numaralar listesinde e-SMM serisi var", async () => {
    const res = await ctx.api.put("/api/workspace/invoices/settings", { seller: SELLER, efatura: true, earsiv: true, esmm: true });
    assert.equal(res.status, 200, JSON.stringify(res.data));
    assert.equal(res.data.esmm, true);
    assert.equal(res.data.esmmAvailable, true);
    assert.ok("esmm" in (res.data.nextNumbers || {}), "Numaralar listesinde e-SMM serisi");
    assert.match(res.data.testNumbers?.esmm?.number || "", /^TES\d{13}$/, "test ortamında e-SMM serisi TES");
    const doc = await smm(ctx.api, ctx.accountId);
    assert.equal(doc.status, 200, JSON.stringify(doc.data));
    assert.equal(doc.data.profile, "ESMM");
    assert.match(doc.data.number, /^TES\d{13}$/);
  });
});
