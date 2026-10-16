// EDM Bilişim bağlantısı (v2.0.15): sahte bir EDM SOAP sunucusuyla uçtan uca.
// - Sözleşme (WSDL) okunur; SOAPAction, ad alanı, nitelikli alanlar ve alan sırası sunucunun WSDL'ine göre gider.
// - WSDL yoksa i2i varsayılanı (ad alanı http://schemas.i2i.com/ei/wsdl, SOAPAction "") kullanılır.
// - Sözleşmede olmayan alan gönderilmez (istek hiç yapılmaz).
// - Oturum düşerse (EDM 10011) yeniden giriş yapılıp istek bir kez tekrarlanır; program Logout çağırmaz.
// - Program uçları: ayarlar (parola şifreli, ekrana çıkmaz), Bağlantıyı Sına, Mükellef Sorgula, gönder, durum, e-Arşiv
//   iptali (önce programda deneme), gelen kutusu (çek, alış taslağı olarak al, yok say), e-Belge kapalıyken 404.
import assert from "node:assert/strict";
import { after, before, describe, test } from "node:test";
import { createEdmClient, mapEdmStatus, resetEdmCaches } from "../server/lib/einvoice/edm.mjs";
import { E, readWsdl, renderTree, shape } from "../server/lib/einvoice/soap-contract.mjs";
import { child, deep, parseXml } from "../server/lib/einvoice/xml-lite.mjs";
import { classifyTaxId } from "../server/lib/tax-id.mjs";
import { ACTION, BUYER_VKN, INCOMING_UUID, NS, OPS, OUR_VKN, SUPPLIER_VKN, incomingUbl, startMockEdm, vkn, wsdl } from "./einvoice-mock.mjs";
import { ADMIN_PASSWORD, startTestServer } from "./helpers.mjs";

// Program yanıtı { ok, data } zarfındadır; testte gövde doğrudan okunur (hatada { ok: false, error, code }).
const unwrap = response => ({ ...response, data: response.data && typeof response.data === "object" && "ok" in response.data ? (response.data.ok ? response.data.data : response.data) : response.data });
const apiOf = client => ({
  login: (...args) => client.login(...args),
  get: async url => unwrap(await client.get(url)),
  post: async (url, body) => unwrap(await client.post(url, body)),
  put: async (url, body) => unwrap(await client.put(url, body)),
  del: async url => unwrap(await client.del(url)),
});

describe("EDM: sözleşme (WSDL) okuyucu", () => {
  test("WCF tarzı WSDL: SOAP 1.1 bağlaması seçilir, SOAPAction ve istek öğesi okunur", () => {
    const contract = readWsdl(wsdl());
    assert.equal(contract.version, "1.1");
    assert.equal(contract.operations.Login.action, ACTION("Login"));
    assert.deepEqual(contract.operations.SendInvoice.input, { ns: NS, name: "SendInvoiceRequest" });
    assert.equal(contract.location, "http://sunucu-ic/EFaturaEDM.svc");
  });
  test("İstek sözleşmeye göre sıralanır, nitelenir; sözleşmede olmayan alan raporlanır, opsiyonel olan sessizce düşer", () => {
    const contract = readWsdl(wsdl());
    const tree = E("SendInvoiceRequest", [E("INVOICE", [E("CONTENT", "QQ==")], { UUID: "u" }), E("SENDER", "", { vkn: "1" }), E("REQUEST_HEADER", [E("COMPRESSED", "N"), E("SESSION_ID", "s")]), E("BILINMEYEN", "x"), E("XSLT_NAME", "y", {}, { optional: true })]);
    const shaped = shape(contract, "SendInvoice", tree, { defaultNs: "urn:yok" });
    assert.deepEqual(shaped.warnings, ["SendInvoiceRequest/BILINMEYEN"]);
    const xml = renderTree(shaped.tree);
    const root = parseXml(xml).children[0];
    assert.equal(root.ns, NS);
    assert.deepEqual(root.children.map(item => item.name), ["REQUEST_HEADER", "SENDER", "INVOICE"]);
    assert.deepEqual(child(root, "REQUEST_HEADER").children.map(item => item.name), ["SESSION_ID", "COMPRESSED"]);
    assert.ok(root.children.every(item => item.ns === NS), "nitelikli alanlar ad alanında");
  });
  test("Sözleşme yoksa: kök i2i ad alanında, çocuklar niteliksiz, opsiyonel alan gönderilmez", () => {
    const shaped = shape(null, "GetInvoice", E("GetInvoiceRequest", [E("REQUEST_HEADER", [E("SESSION_ID", "s")]), E("INVOICE_CONTENT_TYPE", "XML", {}, { optional: true })]), { defaultNs: "http://schemas.i2i.com/ei/wsdl" });
    const root = parseXml(renderTree(shaped.tree)).children[0];
    assert.equal(root.ns, "http://schemas.i2i.com/ei/wsdl");
    assert.deepEqual(root.children.map(item => [item.name, item.ns]), [["REQUEST_HEADER", ""]]);
  });
  test("EDM durumları programın durumlarına doğru eşlenir", () => {
    assert.equal(mapEdmStatus({ status: "SEND - SUCCEED" }).status, "sent");
    assert.equal(mapEdmStatus({ status: "SEND - WAIT_GIB_RESPONSE" }).status, "processing");
    assert.equal(mapEdmStatus({ status: "SEND - WAIT_APPLICATION_RESPONSE" }).status, "sent");
    assert.equal(mapEdmStatus({ status: "ACCEPTED - SUCCEED" }).status, "accepted");
    assert.equal(mapEdmStatus({ status: "REJECTED - SUCCEED" }).status, "rejected");
    assert.equal(mapEdmStatus({ status: "SEND - FAILED" }).status, "error");
    assert.equal(mapEdmStatus({ status: "PACKAGE - FAIL" }).status, "error");
    assert.equal(mapEdmStatus({ status: "CANCELLED - SUCCEED" }).status, "cancelled");
    assert.equal(mapEdmStatus({ status: "LOAD - SUCCEED" }).status, "processing");
    assert.match(mapEdmStatus({ status: "SEND - SUCCEED", earchive: true }).message, /e-Arşiv/);
  });
});

describe("EDM istemcisi (sahte EDM sunucusu)", () => {
  let edm;
  before(async () => {
    resetEdmCaches();
    edm = await startMockEdm();
  });
  after(() => edm.close());
  const client = (extra = {}) => createEdmClient({ baseUrl: edm.url, username: "edmkullanici", password: "Gizli-Parola-1", ...extra });

  test("Bağlantıyı Sına: WSDL okunur, giriş yapılır, işlemler raporlanır; Logout çağrılmaz", async () => {
    const result = await client().test();
    assert.equal(result.ok, true);
    assert.equal(result.contract.source, "wsdl");
    assert.equal(result.contract.soap, "1.1");
    assert.deepEqual(result.contract.missing, []);
    assert.equal(result.contract.endpoint, edm.url, "iç ağ adresi değil ayarlardaki adres kullanılır");
    assert.deepEqual(edm.state.violations, []);
  });
  test("Yanlış parola: EDM'nin hata kodu ve iletisi kullanıcıya gider", async () => {
    resetEdmCaches();
    await assert.rejects(createEdmClient({ baseUrl: edm.url, username: "edmkullanici", password: "yanlis" }).test(), error => error.code === "integrator-rejected" && /hatalı/.test(error.message) && error.integratorCode === "2001");
  });
  test("Mükellef sorgusu: yalnız posta kutusu (PK) etiketi alıcı etiketi olur", async () => {
    const yes = await client().checkUser(BUYER_VKN);
    assert.equal(yes.registered, true);
    assert.deepEqual(yes.aliases, ["urn:mail:defaultpk@alici.com.tr"]);
    const no = await client().checkUser(SUPPLIER_VKN);
    assert.equal(no.registered, false);
  });
  test("e-Fatura gönderimi: gönderici/alıcı etiketleri, ETTN ve base64 UBL; e-Arşivde EARCHIVE işareti", async () => {
    const xml = "<Invoice><cbc:ID>EFT2026000000001</cbc:ID></Invoice>";
    const sent = await client().send({ xml, number: "EFT2026000000001", uuid: "u-1", senderVkn: OUR_VKN, senderAlias: "urn:mail:defaultgb@biz.com.tr", receiverVkn: BUYER_VKN, receiverAlias: "urn:mail:defaultpk@alici.com.tr" });
    assert.equal(sent.status, "sent");
    const last = edm.state.sent.at(-1);
    assert.deepEqual(last.sender, { vkn: OUR_VKN, alias: "urn:mail:defaultgb@biz.com.tr" });
    assert.deepEqual(last.receiver, { vkn: BUYER_VKN, alias: "urn:mail:defaultpk@alici.com.tr" });
    assert.equal(last.xml, xml);
    assert.equal(last.earchive, "");
    await client().send({ xml, number: "EAR2026000000001", uuid: "u-2", earchive: true, senderVkn: OUR_VKN, receiverVkn: "11111111111" });
    const archive = edm.state.sent.at(-1);
    assert.equal(archive.earchive, "true");
    assert.deepEqual(archive.order, ["HEADER", "CONTENT"]);
    assert.equal(archive.receiver.alias, undefined, "e-Arşivde alıcı etiketi gönderilmez");
    await assert.rejects(client().send({ xml, number: "X", uuid: "u-3", receiverVkn: BUYER_VKN }), error => error.code === "integrator-alias");
    assert.deepEqual(edm.state.violations, []);
  });
  test("Durum sorgusu: önce GİB yanıtı bekleniyor, sonra alıcıya ulaştı", async () => {
    assert.equal((await client().status({ uuid: "u-1" })).status, "processing");
    assert.equal((await client().status({ uuid: "u-1" })).status, "sent");
  });
  test("Oturum düşerse (10011) yeniden giriş yapılır ve istek bir kez tekrarlanır", async () => {
    const before = edm.state.counter;
    edm.state.expireNext = true;
    const result = await client().status({ uuid: "u-1" });
    assert.equal(result.status, "sent");
    assert.equal(edm.state.counter, before + 1, "bir kez yeniden giriş");
  });
  test("e-Arşiv iptali ve gelen kutusu (base64 UBL çözülür), okundu işareti", async () => {
    await client().cancelEArchive({ uuid: "u-2", number: "EAR2026000000001" });
    assert.deepEqual(edm.state.cancelled, ["u-2"]);
    const inbox = await client().inbox({ from: "2026-09-01", to: "2026-09-30" });
    assert.equal(inbox.length, 1);
    assert.equal(inbox[0].uuid, INCOMING_UUID);
    assert.equal(inbox[0].payable, 360);
    assert.match(inbox[0].xml, /Toptan Kırtasiye/);
    await client().markRead([INCOMING_UUID]);
    assert.deepEqual(edm.state.marked, [INCOMING_UUID]);
    assert.deepEqual(edm.state.violations, []);
  });
  test("Sözleşmede bulunmayan alan: istek hiç gönderilmez, alan adı söylenir", async () => {
    resetEdmCaches();
    const strict = await startMockEdm({ contract: { statusInvoice: false } });
    try {
      const c = createEdmClient({ baseUrl: strict.url, username: "edmkullanici", password: "Gizli-Parola-1" });
      await assert.rejects(c.status({ uuid: "u-9" }), error => error.code === "integrator-contract" && /GetInvoiceStatusRequest\/INVOICE/.test(error.message));
      assert.equal(strict.state.calls.filter(call => call.op === "GetInvoiceStatus").length, 0);
    } finally {
      await strict.close();
    }
  });
  test("WSDL alınamazsa i2i varsayılanıyla çalışılır (ad alanı ve boş SOAPAction)", async () => {
    resetEdmCaches();
    const bare = await startMockEdm({ serveWsdl: false });
    try {
      const c = createEdmClient({ baseUrl: bare.url, username: "edmkullanici", password: "Gizli-Parola-1" });
      const result = await c.test();
      assert.equal(result.contract.source, "default");
      assert.match(result.message, /varsayılan/);
      assert.equal((await c.checkUser(BUYER_VKN)).registered, true);
      assert.deepEqual(bare.state.violations, []);
    } finally {
      await bare.close();
    }
  });
});

describe("Fatura modülü ↔ EDM (program uçları)", () => {
  let server;
  let edm;
  let api;
  let buyerId;
  before(async () => {
    resetEdmCaches();
    edm = await startMockEdm();
    server = await startTestServer({ edocEnabled: true });
    api = apiOf(server.client());
    assert.equal((await api.login("admin", ADMIN_PASSWORD)).status, 200);
  });
  after(async () => {
    await server.close();
    await edm.close();
  });

  test("Ayarlar: parola şifreli saklanır, ekrana ve ayar kaydına açık metin çıkmaz", async () => {
    assert.ok(classifyTaxId(OUR_VKN).ok);
    const saved = await api.put("/api/workspace/invoices/settings", {
      seller: { name: "Deneme Ofis Ltd.", taxNo: OUR_VKN, taxOffice: "Çankaya", address: "Atatürk Blv. 1", district: "Çankaya", city: "Ankara", email: "bilgi@deneme.com.tr" },
      efatura: true,
      earsiv: true,
      integrator: { env: "test", baseUrl: edm.url, username: "edmkullanici", password: "Gizli-Parola-1", senderAlias: "urn:mail:defaultgb@deneme.com.tr" },
    });
    assert.equal(saved.status, 200, JSON.stringify(saved.data));
    assert.equal(saved.data.integrator.hasPassword, true);
    assert.equal(saved.data.integrator.password, undefined);
    assert.equal(saved.data.integrator.passwordSealed, undefined);
    const raw = server.app.store.setting("invoice.settings", "");
    assert.ok(!raw.includes("Gizli-Parola-1"), "parola açık metin değil");
    assert.match(raw, /sb1:/);
    const bad = await api.put("/api/workspace/invoices/settings", { integrator: { senderAlias: "defaultgb" } });
    assert.equal(bad.status, 400);
  });
  test("Bağlantıyı Sına ve Mükellef Sorgula: cari kartına e-Fatura ve PK etiketi yazılır", async () => {
    const tested = await api.post("/api/workspace/invoices/integrator/test", {});
    assert.equal(tested.status, 200, JSON.stringify(tested.data));
    assert.equal(tested.data.contract.source, "wsdl");
    const account = await api.post("/api/workspace/accounts", { name: "Alıcı Ticaret A.Ş.", type: "customer", taxNo: BUYER_VKN, taxOffice: "Kavaklıdere", address: "Cinnah Cd. 10", district: "Çankaya", city: "Ankara" });
    assert.equal(account.status, 200, JSON.stringify(account.data));
    buyerId = account.data.id || account.data.account?.id;
    const checked = await api.post("/api/workspace/invoices/check-user", { taxNo: BUYER_VKN, accountId: buyerId });
    assert.equal(checked.status, 200, JSON.stringify(checked.data));
    assert.equal(checked.data.registered, true);
    const row = server.app.store.get("SELECT e_invoice AS eInvoice, e_alias AS eAlias FROM accounts WHERE id = ?", buyerId);
    assert.deepEqual({ ...row }, { eInvoice: 1, eAlias: "urn:mail:defaultpk@alici.com.tr" });
  });
  test("e-Fatura kes → gönder → durum: ETTN ve numara EDM'ye gider; ikinci gönderim engellenir", async () => {
    const issued = await api.post("/api/workspace/invoices", { scenario: "service_sale", accountId: buyerId, lines: [{ name: "Danışmanlık", qty: 2, unitPrice: 500, vatRate: 20 }], payment: { rest: "open" } });
    assert.equal(issued.status, 200, JSON.stringify(issued.data));
    assert.equal(issued.data.profile, "TEMELFATURA");
    assert.equal(issued.data.canSend, true);
    const sent = await api.post(`/api/workspace/invoices/${issued.data.id}/send`, {});
    assert.equal(sent.status, 200, JSON.stringify(sent.data));
    assert.equal(sent.data.eStatus, "sent");
    const last = edm.state.sent.at(-1);
    assert.equal(last.id, issued.data.number);
    assert.equal(last.uuid, issued.data.ettn);
    assert.equal(last.receiver.alias, "urn:mail:defaultpk@alici.com.tr");
    assert.match(last.xml, /<cbc:ProfileID>TEMELFATURA<\/cbc:ProfileID>/);
    assert.match(last.xml, /<cac:Signature>/);
    const again = await api.post(`/api/workspace/invoices/${issued.data.id}/send`, {});
    assert.equal(again.status, 409);
    const refreshed = await api.post(`/api/workspace/invoices/${issued.data.id}/e-refresh`, {});
    assert.equal(refreshed.status, 200, JSON.stringify(refreshed.data));
    assert.equal(refreshed.data.eStatus, "processing");
    const refreshed2 = await api.post(`/api/workspace/invoices/${issued.data.id}/e-refresh`, {});
    assert.equal(refreshed2.data.eStatus, "sent");
    // Gönderilmiş e-Fatura onaysız iptal edilmez (GİB/alıcı tarafı önce).
    const cancel = await api.post(`/api/workspace/invoices/${issued.data.id}/cancel`, { reason: "deneme" });
    assert.equal(cancel.status, 409);
  });
  test("e-Arşiv kes → gönder → iptal: önce EDM'de, sonra programda iptal; defter etkisi geri alınır", async () => {
    const person = await api.post("/api/workspace/accounts", { name: "Ayşe Yılmaz", type: "customer", taxNo: "10000000146", city: "İzmir", email: "ayse@example.com" });
    const personId = person.data.id || person.data.account?.id;
    const issued = await api.post("/api/workspace/invoices", { scenario: "service_sale", accountId: personId, lines: [{ name: "Bakım", qty: 1, unitPrice: 300, vatRate: 20 }], payment: { rest: "open" } });
    assert.equal(issued.status, 200, JSON.stringify(issued.data));
    assert.equal(issued.data.profile, "EARSIVFATURA");
    const sent = await api.post(`/api/workspace/invoices/${issued.data.id}/send`, {});
    assert.equal(sent.status, 200, JSON.stringify(sent.data));
    const last = edm.state.sent.at(-1);
    assert.equal(last.earchive, "true");
    assert.match(last.xml, /<cbc:DocumentTypeCode>SendingType<\/cbc:DocumentTypeCode>/);
    assert.match(last.xml, /<cbc:ID>ELEKTRONIK<\/cbc:ID>/);
    const cancelled = await api.post(`/api/workspace/invoices/${issued.data.id}/cancel`, { reason: "Müşteri vazgeçti" });
    assert.equal(cancelled.status, 200, JSON.stringify(cancelled.data));
    assert.equal(cancelled.data.status, "cancelled");
    assert.equal(cancelled.data.eStatus, "cancelled");
    assert.ok(edm.state.cancelled.includes(issued.data.ettn));
    const balance = server.app.store.get("SELECT COUNT(*) AS n FROM account_entries WHERE source = 'invoice' AND source_id = ?", issued.data.id).n;
    assert.equal(balance, 0);
  });
  test("Kes, Sonra Gönder: etkiler hemen işlenir, numara gönderimde verilir; Gönderilecekler sekmesi; Kes ve Gönder", async () => {
    const before = (await api.get(`/api/workspace/accounts/${buyerId}`)).data.totals.balance;
    const later = await api.post("/api/workspace/invoices", { scenario: "service_sale", accountId: buyerId, lines: [{ name: "Eğitim", qty: 1, unitPrice: 1000, vatRate: 20 }], payment: { rest: "open" }, eSend: "later" });
    assert.equal(later.status, 200, JSON.stringify(later.data));
    assert.equal(later.data.status, "issued");
    assert.equal(later.data.eStatus, "waiting");
    assert.equal(later.data.number, "", "numara gönderimde verilir");
    assert.equal(later.data.displayNo, "Gönderilecek");
    assert.equal(later.data.canSend, true);
    assert.equal(later.data.canWithdraw, true);
    const after = (await api.get(`/api/workspace/accounts/${buyerId}`)).data.totals.balance;
    assert.equal(Math.round((after - before) * 100), 120000, "cari borcu kesimde işlendi (1.200)");
    const pending = await api.get("/api/workspace/invoices?tab=pending");
    assert.deepEqual(pending.data.invoices.map(x => x.id), [later.data.id]);
    assert.equal(pending.data.tabs?.pending ?? pending.data.counts?.pending ?? 1, 1);
    // İadesi gönderilmeden kesilmez.
    const ret = await api.post("/api/workspace/invoices", { kind: "sale_return", originalId: later.data.id, lines: [{ originLineId: later.data.lines[0].id, qty: 1 }], payment: {} });
    assert.equal(ret.status, 400);
    assert.equal(ret.data.code, "invoice-waiting");
    const sent = await api.post(`/api/workspace/invoices/${later.data.id}/send`, {});
    assert.equal(sent.status, 200, JSON.stringify(sent.data));
    assert.match(sent.data.number, /^[A-Z]{3}2026\d{9}$/);
    assert.equal(sent.data.eStatus, "sent");
    assert.equal(edm.state.sent.at(-1).id, sent.data.number, "EDM'ye verilen numarayla gitti");
    const note = server.app.store.get("SELECT note FROM account_entries WHERE source = 'invoice' AND source_id = ?", later.data.id).note;
    assert.ok(note.includes(sent.data.number) && !note.includes("gönderilecek"), `cari satırında numara: ${note}`);
    assert.equal((await api.get("/api/workspace/invoices?tab=pending")).data.invoices.length, 0);
    // Kes ve Gönder: tek adımda.
    const now = await api.post("/api/workspace/invoices", { scenario: "service_sale", accountId: buyerId, lines: [{ name: "Destek", qty: 1, unitPrice: 200, vatRate: 20 }], payment: { rest: "open" }, eSend: "now" });
    assert.equal(now.status, 200, JSON.stringify(now.data));
    assert.equal(now.data.autoSend?.ok, true, JSON.stringify(now.data.autoSend));
    assert.equal((await api.get(`/api/workspace/invoices/${now.data.id}`)).data.eStatus, "sent");
  });
  test("Gönderilecekler'den silme: etkiler kalır, Müşteri Fişi numarası alır; sonra yine e-Belge olarak gönderilebilir", async () => {
    const before = (await api.get(`/api/workspace/accounts/${buyerId}`)).data.totals.balance;
    const later = await api.post("/api/workspace/invoices", { scenario: "service_sale", accountId: buyerId, lines: [{ name: "Kurulum", qty: 1, unitPrice: 500, vatRate: 20 }], payment: { rest: "open" }, eSend: "later" });
    const withdrawn = await api.post(`/api/workspace/invoices/${later.data.id}/withdraw`, {});
    assert.equal(withdrawn.status, 200, JSON.stringify(withdrawn.data));
    assert.equal(withdrawn.data.status, "issued", "iptal edilmedi");
    assert.equal(withdrawn.data.eStatus, "withdrawn");
    assert.equal(withdrawn.data.profile, "KAGIT");
    assert.match(withdrawn.data.number, /^FIS2026\d{9}$/);
    const after = (await api.get(`/api/workspace/accounts/${buyerId}`)).data.totals.balance;
    assert.equal(Math.round((after - before) * 100), 60000, "etkiler yerinde (cari +600)");
    assert.equal((await api.get("/api/workspace/invoices?tab=pending")).data.invoices.length, 0);
    assert.equal(withdrawn.data.canSend, true, "sonra yine gönderilebilir");
    const sent = await api.post(`/api/workspace/invoices/${later.data.id}/send`, {});
    assert.equal(sent.status, 200, JSON.stringify(sent.data));
    assert.equal(sent.data.profile, "TEMELFATURA");
    assert.match(sent.data.number, /^[A-Z]{3}2026\d{9}$/);
    assert.equal(sent.data.paperNo, withdrawn.data.number, "fiş numarası izi kalır");
    assert.equal(sent.data.eStatus, "sent");
  });
  test("Sonra gönderilecek belge serideki son gönderilenden eski tarihliyse gönderilmez (tarih sırası); listeden silinebilir", async () => {
    const yesterday = new Date(Date.now() - 86_400_000);
    const day = `${yesterday.getFullYear()}-${String(yesterday.getMonth() + 1).padStart(2, "0")}-${String(yesterday.getDate()).padStart(2, "0")}`;
    if (day.slice(0, 4) !== String(new Date().getFullYear())) return; // yılbaşında seri yeniden başlar
    const old = await api.post("/api/workspace/invoices", { scenario: "service_sale", accountId: buyerId, issueDate: day, lines: [{ name: "Eski", qty: 1, unitPrice: 100, vatRate: 20 }], payment: { rest: "open" }, eSend: "later" });
    assert.equal(old.status, 200, JSON.stringify(old.data));
    assert.equal(old.data.canSend, false);
    assert.match(old.data.sendBlock, /daha eski tarihli/);
    const sent = await api.post(`/api/workspace/invoices/${old.data.id}/send`, {});
    assert.equal(sent.status, 409);
    assert.equal(sent.data.code, "chronology");
    assert.equal((await api.get(`/api/workspace/invoices/${old.data.id}`)).data.number, "", "numara yanmadı");
    assert.equal((await api.post(`/api/workspace/invoices/${old.data.id}/withdraw`, {})).status, 200);
    const integrity = await api.get("/api/workspace/ledger/integrity");
    assert.equal(integrity.data.ok, true, JSON.stringify(integrity.data.failures));
  });
  test("Gelen kutusu: çek → aynı belge ikinci kez gelmez → alış taslağı (satıcı VKN ile cari açılır) → taslak silinince yeniden Yeni", async () => {
    const fetched = await api.post("/api/workspace/invoices/inbox/fetch", { from: "2026-09-01", to: "2026-09-30" });
    assert.equal(fetched.status, 200, JSON.stringify(fetched.data));
    assert.equal(fetched.data.added, 1);
    assert.equal(fetched.data.marked, true);
    const again = await api.post("/api/workspace/invoices/inbox/fetch", { from: "2026-09-01", to: "2026-09-30" });
    assert.equal(again.data.added, 0);
    assert.equal(again.data.known, 1);
    const list = await api.get("/api/workspace/invoices/inbox");
    assert.equal(list.data.items.length, 1);
    const item = list.data.items[0];
    assert.equal(item.state, "new");
    const preview = await api.get(`/api/workspace/invoices/inbox/${item.id}`);
    assert.equal(preview.data.preview.parsed.supplier.taxNo, SUPPLIER_VKN);
    assert.equal(preview.data.preview.addressedToOther, false);
    const imported = await api.post(`/api/workspace/invoices/inbox/${item.id}/import`, {});
    assert.equal(imported.status, 200, JSON.stringify(imported.data));
    assert.equal(imported.data.accountCreated, true);
    assert.equal(imported.data.draft.status, "draft");
    assert.equal(imported.data.draft.kind, "purchase");
    assert.equal(imported.data.draft.number, "TDR2026000000042");
    assert.equal(imported.data.draft.payableTotal, 360);
    assert.equal(imported.data.difference, 0);
    assert.deepEqual(imported.data.unmatched, ["A4 Kağıt", "Kurulum Hizmeti"]);
    const supplier = server.app.store.get("SELECT name, tax_no AS taxNo, tax_office AS taxOffice, city FROM accounts WHERE tax_no = ?", SUPPLIER_VKN);
    assert.deepEqual({ ...supplier }, { name: "Toptan Kırtasiye A.Ş.", taxNo: SUPPLIER_VKN, taxOffice: "Kavaklıdere", city: "Ankara" });
    const twice = await api.post(`/api/workspace/invoices/inbox/${item.id}/import`, {});
    assert.equal(twice.status, 409);
    const ignored = await api.post(`/api/workspace/invoices/inbox/${item.id}/state`, { state: "ignored" });
    assert.equal(ignored.status, 409, "alınmış belge yok sayılamaz");
    assert.equal((await api.del(`/api/workspace/invoices/${imported.data.draft.id}`)).status, 200);
    const back = await api.get(`/api/workspace/invoices/inbox/${item.id}`);
    assert.equal(back.data.state, "new");
    const integrity = await api.get("/api/admin/integrity");
    if (integrity.status === 200) assert.equal(integrity.data.ok, true, JSON.stringify(integrity.data));
  });
});

describe("e-Belge kapalıyken (varsayılan) entegratör uçları çalışmaz", () => {
  let server;
  let api;
  before(async () => {
    server = await startTestServer();
    api = apiOf(server.client());
    await api.login("admin", ADMIN_PASSWORD);
  });
  after(() => server.close());
  test("Bağlantı, mükellef sorgusu, gelen kutusu 404; ayarlarda entegratör bilgisi kaydedilmez", async () => {
    for (const [method, url] of [["post", "/api/workspace/invoices/integrator/test"], ["post", "/api/workspace/invoices/check-user"], ["get", "/api/workspace/invoices/inbox"], ["post", "/api/workspace/invoices/inbox/fetch"]]) {
      const response = await api[method](url, {});
      assert.equal(response.status, 404, url);
      assert.equal(response.data.code, "edoc-disabled", url);
    }
    const saved = await api.put("/api/workspace/invoices/settings", { integrator: { username: "x", password: "y" } });
    assert.equal(saved.status, 404);
    const meta = await api.get("/api/workspace/invoices/meta");
    assert.equal(meta.data.edocEnabled, false);
    assert.deepEqual(meta.data.adapters, []);
    assert.equal(meta.data.settings.integrator, null);
  });
});

// Entegratör Ayarları kartı (kullanıcı taslağı + onaylanan düzeltmeler, 16.10.2026; docs/2.4.0-IS-LISTESI.md İz 2). Eski kodda (8bc680b) kırmızı:
// docs/kanit/2026-10-16/entegrator-ayarlari-eski.
describe("Entegratör Ayarları: canlı ortam kilidi, GB/PK etiketleri, durum satırı, tercihler, yetki", () => {
  let server;
  let edm;
  let api;
  let client;
  const SETTINGS = "/api/workspace/invoices/settings";
  before(async () => {
    resetEdmCaches();
    edm = await startMockEdm();
    server = await startTestServer({ edocEnabled: true });
    client = server.client();
    api = apiOf(client);
    assert.equal((await api.login("admin", ADMIN_PASSWORD)).status, 200);
  });
  after(async () => {
    await server.close();
    await edm.close();
  });

  test("varsayılanlar: Test Ortamı, otomatik gönderim kapalı, e-Arşiv e-postası açık, kendiliğinden sorgu kapalı; canlı ortam seçilemez", async () => {
    const s = (await api.get(SETTINGS)).data;
    assert.equal(s.integrator.env, "test");
    assert.equal(s.integrator.autoSend, false);
    assert.equal(s.integrator.earchiveEmail, true);
    assert.equal(s.integrator.autoCheckUser, false);
    assert.equal(s.integrator.liveAllowed, false);
    assert.equal(s.integrator.lastTest, null);
    const live = await api.put(SETTINGS, { integrator: { env: "live" } });
    assert.equal(live.status, 400, JSON.stringify(live.data));
    assert.equal(live.data.code, "integrator-live-locked");
    assert.match(live.data.error, /Canlı ortam, test ortamındaki kabulden sonra açılır/);
    assert.equal((await api.get(SETTINGS)).data.integrator.env, "test", "reddedilen istek ortamı değiştirmedi");
    assert.match(server.app.store.setting("invoice.settings", ""), /"env":"test"|^\{\}$|^$/);
  });

  test("Posta Kutusu (PK) etiketi biçim denetimi; tercihler kaydedilir ve geri okunur", async () => {
    const bad = await api.put(SETTINGS, { integrator: { mailboxAlias: "defaultpk" } });
    assert.equal(bad.status, 400);
    assert.match(bad.data.error, /Posta kutusu etiketi urn:mail/);
    const saved = await api.put(SETTINGS, {
      seller: { name: "Deneme Ofis Ltd.", taxNo: OUR_VKN, taxOffice: "Çankaya", address: "Atatürk Blv. 1", district: "Çankaya", city: "Ankara", email: "bilgi@deneme.com.tr" },
      efatura: true,
      earsiv: true,
      integrator: { env: "test", baseUrl: edm.url, username: "edmkullanici", password: "Gizli-Parola-1", mailboxAlias: "urn:mail:defaultpk@deneme.com.tr", earchiveEmail: false, autoCheckUser: true },
    });
    assert.equal(saved.status, 200, JSON.stringify(saved.data));
    assert.equal(saved.data.integrator.mailboxAlias, "urn:mail:defaultpk@deneme.com.tr");
    assert.equal(saved.data.integrator.earchiveEmail, false);
    assert.equal(saved.data.integrator.autoCheckUser, true);
    assert.equal(saved.data.integrator.autoSend, false, "dokunulmayan tercih korunur");
    const meta = (await api.get("/api/workspace/invoices/meta")).data;
    assert.equal(meta.settings.integrator.autoCheckUser, true, "cari formu için meta'da");
  });

  test("Bağlantıyı Test Et: sonuç Durum satırı için saklanır; kullanıcı adı değişince silinir; hata da saklanır", async () => {
    const tested = await api.post("/api/workspace/invoices/integrator/test", {});
    assert.equal(tested.status, 200, JSON.stringify(tested.data));
    let last = (await api.get(SETTINGS)).data.integrator.lastTest;
    assert.equal(last.ok, true);
    assert.match(last.message, /bağlantı çalışıyor/);
    assert.match(last.at, /^\d{4}-\d{2}-\d{2}T/);
    assert.equal((await api.put(SETTINGS, { integrator: { earchiveEmail: false } })).data.integrator.lastTest?.ok, true, "tercih değişince durum kalır");
    assert.equal((await api.put(SETTINGS, { integrator: { username: "baskakullanici" } })).data.integrator.lastTest, null, "kullanıcı adı değişince durum silinir");
    const failed = await api.post("/api/workspace/invoices/integrator/test", {});
    assert.notEqual(failed.status, 200, "yanlış kullanıcı adıyla bağlantı kurulmaz");
    last = (await api.get(SETTINGS)).data.integrator.lastTest;
    assert.equal(last.ok, false, "başarısız test de Durum satırına yazılır");
    assert.ok(last.message.length > 0);
    await api.put(SETTINGS, { integrator: { username: "edmkullanici" } });
  });

  test("Etiketleri Getir: firmanın kendi VKN'si sorgulanır; GB ve PK ayrı listelerde", async () => {
    const res = await api.post("/api/workspace/invoices/integrator/aliases", {});
    assert.equal(res.status, 200, JSON.stringify(res.data));
    assert.equal(res.data.taxNo, OUR_VKN);
    assert.deepEqual(res.data.senders, ["urn:mail:defaultgb@deneme.com.tr"]);
    assert.deepEqual(res.data.mailboxes, ["urn:mail:defaultpk@deneme.com.tr"]);
    const saved = await api.put(SETTINGS, { integrator: { senderAlias: res.data.senders[0], mailboxAlias: res.data.mailboxes[0] } });
    assert.equal(saved.data.integrator.senderAlias, "urn:mail:defaultgb@deneme.com.tr");
  });

  test("e-Arşiv e-postası kapalıyken e-postalı müşteriye bile KAGIT; açıkken ELEKTRONIK", async () => {
    const person = await api.post("/api/workspace/accounts", { name: "Ayşe Yılmaz", type: "customer", taxNo: "10000000146", city: "İzmir", address: "Alsancak 3", district: "Konak", email: "ayse@example.com" });
    const personId = person.data.id || person.data.account?.id;
    const issued = await api.post("/api/workspace/invoices", { scenario: "service_sale", accountId: personId, lines: [{ name: "Bakım", qty: 1, unitPrice: 300, vatRate: 20 }], payment: { rest: "open" } });
    assert.equal(issued.status, 200, JSON.stringify(issued.data));
    assert.equal(issued.data.profile, "EARSIVFATURA");
    const xmlOf = async () => {
      const response = await client.get(`/api/workspace/invoices/${issued.data.id}/ubl.xml`);
      return typeof response.data === "string" ? response.data : response.text;
    };
    await api.put(SETTINGS, { integrator: { earchiveEmail: false } });
    assert.match(await xmlOf(), /<cbc:ID>KAGIT<\/cbc:ID>/);
    await api.put(SETTINGS, { integrator: { earchiveEmail: true } });
    assert.match(await xmlOf(), /<cbc:ID>ELEKTRONIK<\/cbc:ID>/);
  });

  test("yetki: personel Entegratör Ayarları'nı kaydedemez, etiket getiremez, bağlantıyı test edemez", async () => {
    const created = await client.post("/api/admin/users", { username: "personel-entegrator", name: "Personel", role: "personel", password: "Personel-2026!", mustChangePassword: false });
    assert.equal(created.status, 200, JSON.stringify(created.data));
    const staff = server.client();
    assert.equal((await staff.login("personel-entegrator", "Personel-2026!")).status, 200);
    for (const [method, url, body] of [["put", SETTINGS, { integrator: { username: "x" } }], ["post", "/api/workspace/invoices/integrator/aliases", {}], ["post", "/api/workspace/invoices/integrator/test", {}]]) {
      const res = await staff[method](url, body);
      assert.equal(res.status, 403, `${method} ${url}: ${res.status}`);
    }
    assert.equal((await api.get(SETTINGS)).data.integrator.username, "edmkullanici", "personelin isteği hiçbir şey yazmadı");
  });
});

describe("Entegratör Ayarları: canlı kilit — veri tabanında kalmış 'live' kaydı bile ağa çıkmadan reddedilir", () => {
  let server;
  let edm;
  let api;
  before(async () => {
    resetEdmCaches();
    edm = await startMockEdm();
    server = await startTestServer({ edocEnabled: true });
    api = apiOf(server.client());
    assert.equal((await api.login("admin", ADMIN_PASSWORD)).status, 200);
    const ok = await api.put("/api/workspace/invoices/settings", { seller: { name: "Deneme Ofis Ltd.", taxNo: OUR_VKN, taxOffice: "Çankaya", address: "Atatürk Blv. 1", district: "Çankaya", city: "Ankara" }, efatura: true, integrator: { env: "test", baseUrl: edm.url, username: "edmkullanici", password: "Gizli-Parola-1" } });
    assert.equal(ok.status, 200, JSON.stringify(ok.data));
    // Eski bir kurulumdan kalmış gibi: ayar kaydında ortam "live" (ekrandan seçilemez; doğrudan yazılır). Adres sahte EDM — kilit bozulursa
    // istek gerçek canlıya değil sahte sunucuya gider ve aşağıdaki "hiç istek yok" denetimi düşer.
    const raw = JSON.parse(server.app.store.setting("invoice.settings", "{}"));
    raw.integrator.env = "live";
    server.app.store.setSetting("invoice.settings", JSON.stringify(raw));
  });
  after(async () => {
    await server.close();
    await edm.close();
  });
  test("Bağlantıyı Test Et, Etiketleri Getir ve Mükellef Sorgula 409 integrator-live-locked; sahte EDM'ye tek istek bile gitmez", async () => {
    const before = edm.state.calls.length + (edm.state.wsdlHits || 0);
    for (const [url, body] of [["/api/workspace/invoices/integrator/test", {}], ["/api/workspace/invoices/integrator/aliases", {}], ["/api/workspace/invoices/check-user", { taxNo: BUYER_VKN }]]) {
      const res = await api.post(url, body);
      assert.equal(res.status, 409, `${url}: ${res.status} ${JSON.stringify(res.data)}`);
      assert.equal(res.data.code, "integrator-live-locked");
    }
    assert.equal(edm.state.calls.length + (edm.state.wsdlHits || 0), before, "ağa çıkılmadı");
  });
});

describe("Entegratör Ayarları: canlı ortam yalnız ayrı kurulum bayrağıyla (edocLive) seçilir", () => {
  let server;
  let api;
  before(async () => {
    server = await startTestServer({ edocEnabled: true, edocLive: true });
    api = apiOf(server.client());
    assert.equal((await api.login("admin", ADMIN_PASSWORD)).status, 200);
  });
  after(() => server.close());
  test("edocLive açıkken Canlı Ortam kaydedilir ve canlı adres seçilir", async () => {
    const saved = await api.put("/api/workspace/invoices/settings", { integrator: { env: "live" } });
    assert.equal(saved.status, 200, JSON.stringify(saved.data));
    assert.equal(saved.data.integrator.liveAllowed, true);
    assert.equal(saved.data.integrator.env, "live");
    assert.match(saved.data.integrator.url, /portal2\.edmbilisim\.com\.tr/);
  });
});
