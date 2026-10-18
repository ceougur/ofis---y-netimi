// 2.4.3 uzman UI / UX turu, A paketi (18.10.2026; docs/kanit/2026-10-18/uiux-a-243/): sunucu ve PDF tarafı. "Nasıl bozulur?" — her test bir bulgunun yolu:
//   UX1 (YÜKSEK) aynı cariyi iki kişi düzenler; ikinci kaydeden kendi eski formuyla ilkinin değişikliğini (telefon) sessizce siler.
//   UX5 / KÖ4   kullanıcı Mükellef Sorgula ile posta kutusunu seçer, işareti elle kaldırır; gönderimde sunucu mükellefiyeti geri koyarken seçilen
//               posta kutusunu (çok PK'li mükellef) siler.
//   UI3b        fatura PDF'inde Stok Kodu kolonu 62pt: 13 haneli barkod "8690123456…", "STK-2.0.26-0…" diye kesilir.
//   UI7 / UI9   Kasa Dökümü PDF'inde gösterge adları küçük harfle ("Devreden kasa", "Dönem toplamı", "Kasa dökümü") ve "1849 hareket" (binlik ayraçsız).
//   UI8         Vade Takip PDF'inde iki ayrı "  gecikmiş" kartı (hangisi tahsil, hangisi ödeme belli değil).
// Eski kodda (9d191a8) hepsi kırmızıdır: DEPO=<eski kopya> node --test test/uiux-a-243.test.mjs (kırmızı kanıt docs/kanit/2026-10-18/uiux-a-243/).
import assert from "node:assert/strict";
import path from "node:path";
import { after, before, describe, test } from "node:test";
import { fileURLToPath, pathToFileURL } from "node:url";

const ROOT = process.env.DEPO ? path.resolve(process.env.DEPO) : path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const load = file => import(pathToFileURL(path.join(ROOT, file)).href);
const { resetEdmCaches } = await load("server/lib/einvoice/edm.mjs");
const { MULTI_VKN, OUR_VKN, startMockEdm } = await import("./einvoice-mock.mjs");
const { ADMIN_PASSWORD, createUser, startTestServer } = await load("test/helpers.mjs");
const { PdfDocument } = await load("server/lib/pdf-write.mjs");
const { cashPdf } = await load("server/lib/cash-report.mjs");

const unwrap = response => ({ ...response, data: response.data && typeof response.data === "object" && "ok" in response.data ? (response.data.ok ? response.data.data : response.data) : response.data });
const SELLER = { name: "Deneme Ofis Ltd.", taxNo: OUR_VKN, taxOffice: "Çankaya", address: "Atatürk Blv. 1", district: "Çankaya", city: "Ankara", email: "bilgi@deneme.com.tr" };

// PDF'e yazılan her metin (sayfa.text çağrıları): bütün PdfDocument'ların addPage'i sarılır; sunucu aynı süreçte çalışır.
const written = [];
const originalAddPage = PdfDocument.prototype.addPage;
PdfDocument.prototype.addPage = function addPage(...args) {
  const page = originalAddPage.apply(this, args);
  const text = page.text;
  page.text = (...call) => {
    written.push(String(call[2] ?? ""));
    return text.apply(page, call);
  };
  return page;
};

describe("uzman UI / UX A paketi — sunucu ve PDF (sahte EDM; ağa çıkmaz)", () => {
  let edm;
  let server;
  let admin;
  let other;
  const fetchImpl = async (input, init) => {
    const url = String(typeof input === "string" || input instanceof URL ? input : input.url);
    if (!url.startsWith("http://127.0.0.1")) throw new Error(`ağa çıkılmaz (test): ${url}`);
    return globalThis.fetch(input, init);
  };
  const wrap = client => ({ get: async url => unwrap(await client.get(url)), post: async (url, body) => unwrap(await client.post(url, body)), put: async (url, body) => unwrap(await client.put(url, body)), raw: client.raw?.bind(client) });
  before(async () => {
    resetEdmCaches();
    edm = await startMockEdm();
    server = await startTestServer({ edocEnabled: true, fetchImpl, env: { HUKUK_LICENSE_URL: "http://127.0.0.1:9" } });
    const first = server.client();
    assert.equal((await first.login("admin", ADMIN_PASSWORD)).status, 200);
    admin = wrap(first);
    other = wrap(await createUser(server, first, { username: "ayse", password: "Ayse-Parola-2026!", role: "muhasebe", name: "Ayşe Muhasebe" }));
    const saved = await admin.put("/api/workspace/invoices/settings", { seller: SELLER, efatura: true, earsiv: true, integrator: { env: "test", baseUrl: edm.url, username: "edmkullanici", password: "Gizli-Parola-1", senderAlias: "urn:mail:defaultgb@deneme.com.tr" } });
    assert.equal(saved.status, 200, JSON.stringify(saved.data));
  });
  after(async () => {
    PdfDocument.prototype.addPage = originalAddPage;
    await server?.close();
    await edm?.close();
  });

  test("UX1: iki kişi aynı cariyi düzenler — ikinci kaydeden eski sürümle 409 alır, ilkinin telefonu silinmez", async () => {
    const created = await admin.post("/api/workspace/accounts", { name: "Zeynep Kaya", type: "customer" });
    assert.equal(created.status, 200, JSON.stringify(created.data));
    const id = created.data.id;
    // İkisi de formu aynı sürümle açar.
    const opened = (await admin.get(`/api/workspace/accounts/${id}`)).data;
    const openedByAyse = (await other.get(`/api/workspace/accounts/${id}`)).data;
    assert.ok(opened.updatedAt, "cari sürümü (updatedAt) okunur");
    // Yönetici telefonu yazıp kaydeder.
    const first = await admin.put(`/api/workspace/accounts/${id}`, { name: opened.name, type: opened.type, phone: "05551234567", email: "", updatedAt: opened.updatedAt });
    assert.equal(first.status, 200, JSON.stringify(first.data));
    // Ayşe kendi (eski) formunda yalnız e-postayı yazıp kaydeder: telefon alanı onun formunda boş.
    const second = await other.put(`/api/workspace/accounts/${id}`, { name: openedByAyse.name, type: openedByAyse.type, phone: "", email: "zeynep@ornek.com", updatedAt: openedByAyse.updatedAt });
    assert.equal(second.status, 409, `eski sürümle kayıt reddedilir (${second.status} ${JSON.stringify(second.data).slice(0, 200)})`);
    assert.equal(second.data.code, "account-stale");
    assert.match(second.data.error || second.data.message || "", /siz düzenlerken başka biri tarafından değiştirildi/);
    const row = server.app.store.get("SELECT phone, email FROM accounts WHERE id = ?", id);
    assert.deepEqual({ ...row }, { phone: "05551234567", email: "" }, "veri tabanında yöneticinin telefonu duruyor, Ayşe'nin e-postası yazılmadı");
    // Güncel sürümle (formu yenileyip) kaydedince geçer; telefon korunur.
    const fresh = (await other.get(`/api/workspace/accounts/${id}`)).data;
    const third = await other.put(`/api/workspace/accounts/${id}`, { name: fresh.name, type: fresh.type, phone: fresh.phone, email: "zeynep@ornek.com", updatedAt: fresh.updatedAt });
    assert.equal(third.status, 200, JSON.stringify(third.data));
    assert.deepEqual({ ...server.app.store.get("SELECT phone, email FROM accounts WHERE id = ?", id) }, { phone: "05551234567", email: "zeynep@ornek.com" });
    // Sürüm göndermeyen çağrı (Pasife Al / Aktif Et, eski istemci) eskisi gibi yazar.
    const passive = await admin.put(`/api/workspace/accounts/${id}`, { status: "passive" });
    assert.equal(passive.status, 200, JSON.stringify(passive.data));
    assert.equal(server.app.store.get("SELECT status FROM accounts WHERE id = ?", id).status, "passive");
  });

  test("UX5 / KÖ4: işaret elle kaldırılmış çok posta kutulu mükellef — gönderimde işaret geri konur, seçilen posta kutusu silinmez", async () => {
    const chosen = "urn:mail:defaultpk@coklu.com.tr";
    const created = await admin.post("/api/workspace/accounts", { name: "Çoklu A.Ş.", type: "customer", taxNo: MULTI_VKN, taxOffice: "Kavaklıdere", address: "Cinnah Cd. 1", district: "Çankaya", city: "Ankara", eInvoice: false, eAlias: chosen });
    assert.equal(created.status, 200, JSON.stringify(created.data));
    const id = created.data.id;
    assert.deepEqual({ ...server.app.store.get("SELECT e_invoice AS e, e_alias AS a FROM accounts WHERE id = ?", id) }, { e: 0, a: chosen }, "ön koşul: işaret kaldırılmış, etiket kayıtlı");
    const doc = await admin.post("/api/workspace/invoices", { scenario: "service_sale", accountId: id, lines: [{ name: "Danışmanlık", qty: 1, unitPrice: 1000, vatRate: 20 }], payment: { rest: "open" }, eSend: "later" });
    assert.equal(doc.status, 200, JSON.stringify(doc.data));
    assert.equal(doc.data.profile, "EARSIVFATURA", "ön koşul: işaretsiz cariye e-Arşiv");
    const sent = await admin.post(`/api/workspace/invoices/${doc.data.id}/send`, {});
    assert.equal(sent.status, 409, JSON.stringify(sent.data));
    assert.equal(sent.data.code, "buyer-is-efatura", "ön koşul: gönderim mükellefi yakalar");
    const row = server.app.store.get("SELECT e_invoice AS e, e_alias AS a FROM accounts WHERE id = ?", id);
    assert.deepEqual({ ...row }, { e: 1, a: chosen }, "işaret geri kondu, kullanıcının seçtiği posta kutusu korundu");
  });

  test("UI3b: fatura PDF'inde 13 haneli barkod ve uzun stok kodu kesilmez", async () => {
    const buyer = await admin.post("/api/workspace/accounts", { name: "Barkod Müşteri", type: "customer", partyKind: "person", taxNo: "10000000078", address: "Konak 1", district: "Konak", city: "İzmir" });
    const codes = ["8690123456789", "STK-2.0.26-001"];
    const doc = await admin.post("/api/workspace/invoices", { scenario: "service_sale", accountId: buyer.data.id, lines: codes.map((code, index) => ({ name: `Ürün ${index + 1}`, code, qty: 1, unitPrice: 100, vatRate: 20 })), payment: { rest: "open" }, eSend: "later" });
    assert.equal(doc.status, 200, JSON.stringify(doc.data));
    written.length = 0;
    const pdf = await admin.raw("GET", `/api/workspace/invoices/${doc.data.id}/fatura.pdf`);
    assert.equal(pdf.status, 200, `PDF indirildi (${pdf.status})`);
    assert.ok(written.length > 10, `PDF metinleri okundu (${written.length}); okunamayan veri boş sayılmaz`);
    for (const code of codes) assert.ok(written.includes(code), `“${code}” PDF'te tam yazılı (kesilen: ${JSON.stringify(written.filter(text => text.startsWith(code.slice(0, 6))))})`);
    assert.ok(!written.some(text => /^(8690123456|STK-2\.0\.26).*…$/.test(text)), "kod “…” ile kesilmedi");
  });

  test("UI7 / UI9: Kasa Dökümü PDF'inde göstergeler yazım düzeninde, hareket sayısı binlik ayraçlı", () => {
    const entries = Array.from({ length: 1849 }, (_, index) => ({ id: `e${index}`, date: "2026-03-05", kind: index % 2 ? "out" : "in", amount: 10, balance: index % 2 ? 0 : 10, description: "Deneme", source: "manual", method: "cash" }));
    written.length = 0;
    const pdf = cashPdf({ method: "cash", opening: 0, entries, period: { in: 9250, out: 9240, net: 10 } }, { from: "2026-03-01", to: "2026-03-31", officeName: "Deneme Ofis", now: new Date("2026-03-31T12:00:00") });
    assert.ok(pdf.length > 1000, "PDF üretildi");
    assert.ok(written.length > 100, `PDF metinleri okundu (${written.length})`);
    for (const label of ["Devreden Kasa", "Dönem Tahsilatı", "Dönem Ödemesi", "Dönem Sonu Kasa", "Dönem Toplamı"]) assert.ok(written.includes(label), `“${label}” yazılı`);
    for (const label of ["Devreden kasa", "Dönem tahsilatı", "Dönem ödemesi", "Dönem sonu kasa", "Dönem toplamı"]) assert.ok(!written.includes(label), `“${label}” (küçük harf) yok`);
    assert.ok(written.some(text => text.startsWith("1.849 hareket")), `hareket sayısı “1.849 hareket” (${JSON.stringify(written.filter(text => / hareket · /.test(text)))})`);
    assert.ok(written.some(text => text.includes("Kasa Dökümü ·")), "altbilgi “Kasa Dökümü”");
  });

  test("UI8: Vade Takip PDF'inde gecikmiş kartları “Gecikmiş Tahsilat” / “Gecikmiş Ödeme”", async () => {
    written.length = 0;
    const pdf = await admin.raw("GET", "/api/workspace/overview/vade-takip.pdf");
    assert.equal(pdf.status, 200, `PDF indirildi (${pdf.status})`);
    assert.ok(written.length > 5, `PDF metinleri okundu (${written.length})`);
    const joined = written.join("|");
    assert.ok(!written.some(text => text.trim() === "gecikmiş"), `küçük harfli “gecikmiş” kartı yok (${JSON.stringify(written.slice(0, 30))})`);
    assert.match(joined, /Gecikmiş[ |]Tahsilat/);
    assert.match(joined, /Gecikmiş[ |]Ödeme/);
  });
});
