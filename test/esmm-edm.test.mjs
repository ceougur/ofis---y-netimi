// EDM e-SMM bağdaştırıcısı (2.4.4, iş listesi 20): ESmmEDM.svc istemcisi + bağdaştırıcıda belge türüne göre servis seçimi. Ağa çıkılmaz: sözleşme
// EDM'nin GERÇEK test WSDL'idir (tools/ebelge/sema/edm/ESmmEDM-test-singleWsdl.xml, 22.10.2026, sha256 KAYNAK.md), yanıtlar EDM'nin e-SMM
// Request-Response belgesindeki biçimde sahte. Program sözleşmede olmayan alan/nitelik görünce isteği HİÇ göndermez (integrator-contract): bu
// testlerde istek gidiyorsa gerçek sözleşmeye uyuyordur.
// Kâhinler: gerçek WSDL (işlem adları, ad alanı, SMM ID/UUID çocuk öğe, TRXID niteliği, GetSMMStatusResponse/SMM_STATUS yapısı); EDM kılavuzu v4.4.1
// (§1.2 test adresi; §5.4 UBL gönderimi SendSMM + SMM_CONTENT_TYPE XML; §3.4 içerik türü verilmezse XML); EDM durum kodu tablosu (xlsx); canlı adres
// CLAUDE.md "BELGE OKUNDU" (19.10.2026, EDM Word belgesinden). Bu testler programla aynı elden yazıldı: kâhin değil, sözleşmeye uyum denetimidir.
// Eski kodda (163dd5d) kırmızı: e-SMM istemcisi ve servis seçimi yoktu (docs/kanit/2026-10-22/244-esmm).
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, test } from "node:test";
import { connect } from "../server/lib/einvoice/adapters.mjs";
import { EDM_SMM_URLS, EDM_URLS, createEdmClient, createEdmSmmClient, esmmUrlOf, mapEdmStatus, resetEdmCaches } from "../server/lib/einvoice/edm.mjs";
import { IntegratorError } from "../server/lib/einvoice/integrator-error.mjs";
import { child, find, parseXml, textOf } from "../server/lib/einvoice/xml-lite.mjs";
import { createZip } from "../server/lib/zip.mjs";
import { SEMA } from "../tools/ebelge/dogrula.mjs";

const WSDL = { smm: readFileSync(join(SEMA, "edm", "ESmmEDM-test-singleWsdl.xml"), "utf8"), efatura: readFileSync(join(SEMA, "edm", "EFaturaEDM-test-singleWsdl.xml"), "utf8") };
const NS = "http://tempuri.org/";
const FATURA_URL = "https://test.edmbilisim.com.tr/EFaturaEDM21ea/EFaturaEDM.svc";
const SMM_URL = "https://test.edmbilisim.com.tr/EFaturaEDM21ea/ESmmEDM.svc";
const NUMBER = "TES2026000000123";
const UUID = "0d6f2c34-8a1b-4c5d-9e7f-1a2b3c4d5e6f";
const ubl = ({ profile = "ESMM", number = NUMBER, uuid = UUID } = {}) =>
  `<?xml version="1.0" encoding="UTF-8"?>\n<Invoice xmlns="urn:oasis:names:specification:ubl:schema:xsd:Invoice-2" xmlns:cbc="urn:oasis:names:specification:ubl:schema:xsd:CommonBasicComponents-2"><cbc:UBLVersionID>2.1</cbc:UBLVersionID><cbc:CustomizationID>TR1.2</cbc:CustomizationID><cbc:ProfileID>${profile}</cbc:ProfileID><cbc:ID>${number}</cbc:ID><cbc:CopyIndicator>false</cbc:CopyIndicator><cbc:UUID>${uuid}</cbc:UUID></Invoice>\n`;
const PDF = Buffer.from("%PDF-1.4\n% e-SMM resmi gorunum\n", "latin1");
// EDM içeriği ZIP'leyebilir (edm.mjs içindeki .pdf'i açar).
const zipWith = (name, data) => createZip([{ name, data }]);

// Sahte EDM: GET → adresin servisine göre gerçek WSDL; POST → SOAPAction'a göre yanıt. resets: işlem → kaç kez bağlantı koparılsın.
function harness({ replies = {}, resets = {} } = {}) {
  const calls = [];
  const fetchImpl = async (url, { method = "GET", headers = {}, body } = {}) => {
    const service = /ESmmEDM\.svc/i.test(url) ? "smm" : "efatura";
    if (method === "GET") return new Response(WSDL[service], { status: 200, headers: { "content-type": "text/xml" } });
    const action = String(headers.SOAPAction ?? headers.soapaction ?? "").replace(/"/g, "");
    const op = action.replace(/Request$/, "");
    calls.push({ url: String(url), service, op, body: String(body) });
    if (resets[op] > 0) {
      resets[op] -= 1;
      throw Object.assign(new TypeError("fetch failed"), { cause: Object.assign(new Error("other side closed"), { code: "UND_ERR_SOCKET" }) });
    }
    const reply = replies[op];
    const inner = typeof reply === "function" ? reply(String(body)) : reply ?? (op === "Login" ? `<SESSION_ID xmlns="">S-${service}</SESSION_ID>` : `<REQUEST_RETURN xmlns=""><INTL_TXN_ID>1</INTL_TXN_ID><RETURN_CODE>0</RETURN_CODE></REQUEST_RETURN>`);
    return new Response(`<?xml version="1.0"?><s:Envelope xmlns:s="http://schemas.xmlsoap.org/soap/envelope/"><s:Body xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance"><${op}Response xmlns="${NS}">${inner}</${op}Response></s:Body></s:Envelope>`, { status: 200, headers: { "content-type": "text/xml" } });
  };
  resetEdmCaches();
  return { calls, fetchImpl };
}
const smmClient = fetchImpl => createEdmSmmClient({ baseUrl: SMM_URL, username: "kullanici", password: "parola", env: "test", fetchImpl });
const requestOf = call => {
  const body = find(parseXml(call.body), "Envelope/Body");
  return body.children[0];
};
const errorOf = async promise => {
  try {
    await promise;
  } catch (error) {
    return error;
  }
  assert.fail("hata bekleniyordu");
};
const SEND_REPLY = body => {
  const sent = requestOf({ body }).children.find(item => item.name === "SMM");
  return `<REQUEST_RETURN xmlns=""><INTL_TXN_ID>8563409</INTL_TXN_ID><RETURN_CODE>0</RETURN_CODE></REQUEST_RETURN><SMM TRXID="8563409" xmlns=""><ID>${textOf(child(sent, "ID"))}</ID><UUID>${textOf(child(sent, "UUID"))}</UUID><HEADER><SMM_DATE>2026-10-22</SMM_DATE><STATUS>PACKAGE - PROCESSING</STATUS><STATUS_DESCRIPTION>PROCESSING</STATUS_DESCRIPTION><EARCHIVE_REPORT_SENDDATE>0001-01-01</EARCHIVE_REPORT_SENDDATE><CANCEL_EARCHIVE_REPORT_SENDDATE>0001-01-01</CANCEL_EARCHIVE_REPORT_SENDDATE></HEADER></SMM>`;
};
const statusReply = (status, description = "") =>
  `<SMM_STATUS TRXID="0" xmlns=""><ID>${NUMBER}</ID><UUID>${UUID}</UUID><HEADER><SMM_DATE>2026-10-22</SMM_DATE><STATUS>PACKAGE - PROCESSING</STATUS><EARCHIVE_REPORT_SENDDATE>0001-01-01</EARCHIVE_REPORT_SENDDATE><CANCEL_EARCHIVE_REPORT_SENDDATE>0001-01-01</CANCEL_EARCHIVE_REPORT_SENDDATE></HEADER><STATUS>${status}</STATUS><STATUS_DESCRIPTION>${description}</STATUS_DESCRIPTION></SMM_STATUS>`;
const pdfReply = content => `<SMM TRXID="0" xmlns=""><ID>${NUMBER}</ID><UUID>${UUID.toUpperCase()}</UUID><HEADER><STATUS>SEND - SUCCEED</STATUS></HEADER><CONTENT a:contentType="application/pdf" xmlns:a="http://www.w3.org/2005/05/xmlmime">${content}</CONTENT></SMM>`;

describe("e-SMM servis adresi e-Fatura servis adresinden türetilir (kullanıcı kararı 21.10.2026 (6))", () => {
  test("test ve canlı adres EDM'nin verdiği e-SMM adresleriyle aynı; yerel sahte servis adresi de türetilir", () => {
    assert.equal(EDM_SMM_URLS.test, "https://test.edmbilisim.com.tr/EFaturaEDM21ea/ESmmEDM.svc", "EDM e-SMM kılavuzu §1.2 test uç noktası");
    assert.equal(EDM_SMM_URLS.live, "https://portal2.edmbilisim.com.tr/EFaturaEDM/ESmmEDM.svc", "EDM Word belgesi (CLAUDE.md BELGE OKUNDU 19.10.2026)");
    assert.equal(esmmUrlOf(`${FATURA_URL}/`), SMM_URL);
    assert.equal(esmmUrlOf(`${FATURA_URL}?singleWsdl`), SMM_URL);
    assert.equal(esmmUrlOf("http://127.0.0.1:5999/EFaturaEDM21ea/efaturaedm.svc"), "http://127.0.0.1:5999/EFaturaEDM21ea/ESmmEDM.svc");
  });
  test("…/EFaturaEDM.svc ile bitmeyen adresten tahmin yürütülmez: integrator-url", () => {
    for (const url of ["", "https://test.edmbilisim.com.tr/EFaturaEDM21ea/", "https://baska.ornek.com/fatura", "https://test.edmbilisim.com.tr/EFaturaEDM21ea/EFaturaEDM.svc/basic"]) {
      assert.throws(() => esmmUrlOf(url), error => error instanceof IntegratorError && error.code === "integrator-url" && error.status === 400, url);
    }
  });
});

describe("e-SMM istemcisi (ESmmEDM.svc) gerçek sözleşmeye uygun istek kurar", () => {
  test("bağlantı testi: sözleşme okunur (SOAP 1.1, tempuri.org), programın kullandığı 5 işlem var; giriş e-SMM adresine gider", async () => {
    const { calls, fetchImpl } = harness();
    const result = await smmClient(fetchImpl).test();
    assert.equal(result.ok, true, JSON.stringify(result));
    assert.match(result.message, /e-SMM servisine giriş yapıldı/);
    assert.equal(result.contract.source, "wsdl");
    assert.equal(result.contract.namespace, NS);
    assert.equal(result.contract.soap, "1.1");
    assert.deepEqual(result.contract.missing, []);
    // Karar kaydı: EDM'nin C# örneğindeki SendSMMPrepared bugünkü sözleşmede yok — UBL SendSMM ile gider.
    assert.ok(!result.contract.operations.includes("SendSMMPrepared"), "SendSMMPrepared sözleşmede yok");
    assert.ok(result.contract.operations.includes("SendSMM"));
    assert.deepEqual(calls.map(call => [call.op, call.url]), [["Login", SMM_URL]]);
  });
  test("gönderim: SendSMM — SMM'de ID/UUID ÇOCUK öğe + TRXID, CONTENT = UBL (base64), SMM_CONTENT_TYPE XML, gönderici/alıcı iki yerde", async () => {
    const { calls, fetchImpl } = harness({ replies: { SendSMM: SEND_REPLY } });
    const xml = ubl();
    const result = await smmClient(fetchImpl).send({ xml, number: NUMBER, uuid: UUID, issueDate: "2026-10-22", senderVkn: "1234567890", senderAlias: "urn:mail:defaultgb@ofis.com", receiverVkn: "9876543210", receiverEmail: "muvekkil@ornek.com" });
    assert.deepEqual(calls.map(call => call.op), ["Login", "SendSMM"]);
    const request = requestOf(calls[1]);
    assert.equal(request.name, "SendSMMRequest");
    assert.equal(request.ns, NS, "kök öğe tempuri.org");
    assert.deepEqual(request.children.map(item => item.name), ["REQUEST_HEADER", "SENDER", "RECEIVER", "SMM", "SMM_CONTENT_TYPE"], "sözleşmedeki sıra");
    assert.ok(request.children.every(item => item.ns === ""), "çocuklar niteliksiz (form=unqualified)");
    assert.deepEqual(child(request, "SENDER").attrs, { vkn: "1234567890", alias: "urn:mail:defaultgb@ofis.com" });
    assert.deepEqual(child(request, "RECEIVER").attrs, { vkn: "9876543210" }, "alıcı posta kutusu etiketi yok (e-SMM alıcısı mükellef olmayabilir)");
    const smm = child(request, "SMM");
    assert.deepEqual(smm.attrs, { TRXID: "0" }, "SMM'nin tek niteliği TRXID; ID/UUID nitelik değil");
    assert.deepEqual(smm.children.map(item => item.name), ["ID", "UUID", "HEADER", "CONTENT"]);
    assert.equal(textOf(child(smm, "ID")), NUMBER);
    assert.equal(textOf(child(smm, "UUID")), UUID);
    assert.deepEqual(child(smm, "HEADER").children.map(item => [item.name, textOf(item)]), [["SENDER", "1234567890"], ["RECEIVER", "9876543210"], ["SMM_DATE", "2026-10-22"], ["FROM", "urn:mail:defaultgb@ofis.com"], ["TO", "muvekkil@ornek.com"]]);
    assert.equal(Buffer.from(textOf(child(smm, "CONTENT")), "base64").toString("utf8"), xml, "içerik UBL'nin kendisi (UTF-8)");
    assert.equal(textOf(child(request, "SMM_CONTENT_TYPE")), "XML");
    assert.equal(result.status, "sent");
    assert.equal(result.reference, NUMBER, "EDM'nin döndürdüğü numara");
    assert.equal(result.uuid, UUID);
    assert.equal(result.edmStatus, "PACKAGE - PROCESSING");
  });
  test("alıcının e-postası yoksa TO gitmez (kâğıt teslim)", async () => {
    const { calls, fetchImpl } = harness({ replies: { SendSMM: SEND_REPLY } });
    await smmClient(fetchImpl).send({ xml: ubl(), number: NUMBER, uuid: UUID, issueDate: "2026-10-22", senderVkn: "1234567890", receiverVkn: "10000000146" });
    const head = child(child(requestOf(calls[1]), "SMM"), "HEADER");
    assert.deepEqual(head.children.map(item => item.name), ["SENDER", "RECEIVER", "SMM_DATE"]);
  });
  test("kanal: ProfileID ESMM değilse ya da numara/ETTN içerikle uyuşmazsa istek HİÇ gitmez", async () => {
    const { calls, fetchImpl } = harness();
    const client = smmClient(fetchImpl);
    const cases = [
      [ubl({ profile: "EARSIVFATURA" }), NUMBER, UUID],
      [ubl(), "TES2026000000124", UUID],
      [ubl(), NUMBER, "11111111-1111-4111-8111-111111111111"],
      [ubl(), "", UUID],
    ];
    for (const [xml, number, uuid] of cases) {
      const error = await errorOf(client.send({ xml, number, uuid, senderVkn: "1234567890", receiverVkn: "9876543210" }));
      assert.equal(error.code, "integrator-channel", `${number} ${uuid}: ${error.message}`);
    }
    assert.deepEqual(calls, [], "ağa çıkılmadı (giriş bile yok)");
    // e-Fatura servisi de e-SMM belgesini almaz.
    const fatura = createEdmClient({ baseUrl: FATURA_URL, username: "kullanici", password: "parola", fetchImpl });
    const error = await errorOf(fatura.send({ xml: ubl(), number: NUMBER, uuid: UUID, earchive: true }));
    assert.equal(error.code, "integrator-channel");
    assert.deepEqual(calls, []);
  });
  test("durum: GetSMMStatus SMM'de ID/UUID çocuk öğe; yanıtta SMM_STATUS'un KENDİ durumu okunur (HEADER/STATUS değil); e-SMM metinleri", async () => {
    const { calls, fetchImpl } = harness({ replies: { GetSMMStatus: statusReply("SEND - SUCCEED", "SUCCEED") } });
    const result = await smmClient(fetchImpl).status({ uuid: UUID, number: NUMBER });
    const smm = child(requestOf(calls[1]), "SMM");
    assert.deepEqual(smm.attrs, { TRXID: "0" });
    assert.deepEqual(smm.children.map(item => [item.name, textOf(item)]), [["ID", NUMBER], ["UUID", UUID]]);
    assert.equal(result.status, "sent");
    assert.match(result.message, /^e-SMM oluşturuldu/);
    assert.equal(result.raw, "SEND - SUCCEED");
  });
  test("durum eşlemesi EDM e-SMM tablosuna göre (xlsx): kabul/red yok, PACKAGE-FAIL iptal + yeniden gönderim yönergesi, LOAD-FAIL hata", () => {
    const map = (status, extra = {}) => mapEdmStatus({ status, esmm: true, ...extra });
    assert.equal(map("SEND - SUCCEED", { responseCode: "KABUL", responseDescription: "KABUL EDİLDİ" }).status, "sent", "e-SMM'de alıcı yanıtı durumu değiştirmez");
    assert.equal(map("SEND - SUCCEED", { responseDescription: "RED" }).status, "sent");
    const packageFail = map("PACKAGE - FAIL", { description: "Paket hatası" });
    assert.equal(packageFail.status, "error");
    assert.match(packageFail.message, /iptal edilip yeniden gönderilir/);
    assert.equal(map("LOAD - FAIL").status, "error");
    assert.equal(map("LOAD - SUCCEED").status, "draft");
    assert.equal(map("SEND - FAILED").status, "error");
    assert.match(map("SEND - FAILED").message, /aynı numarayla yeniden gönderin/);
    for (const status of ["SEND - PROCESSING", "SEND - WAIT_GIB_RESPONSE", "SEND - WAIT_SYSTEM_RESPONSE", "UNKNOWN - UNKNOWN", "PACKAGE - PROCESSING"]) assert.equal(map(status).status, "processing", status);
    assert.equal(map("CANCELLED - SUCCEED").status, "cancelled");
    assert.match(map("CANCELLED - SUCCEED").message, /e-SMM/);
    assert.equal(map("BILINMEYEN - CANCEL").message, "Makbuz EDM'de iptal edildi.");
    // e-Fatura eşlemesi değişmedi.
    assert.equal(mapEdmStatus({ status: "SEND - SUCCEED", responseCode: "KABUL" }).status, "accepted");
    assert.equal(mapEdmStatus({ status: "PACKAGE - FAIL" }).message, "Paketleme hatası: belgeyi düzeltip aynı numarayla yeniden gönderin.");
    assert.equal(mapEdmStatus({ status: "BILINMEYEN - CANCEL" }).message, "Fatura EDM'de iptal edildi.");
  });
  test("iptal: CancelSMM SMM'de ID/UUID çocuk öğe", async () => {
    const { calls, fetchImpl } = harness();
    const result = await smmClient(fetchImpl).cancel({ uuid: UUID, number: NUMBER });
    assert.deepEqual(calls.map(call => call.op), ["Login", "CancelSMM"]);
    const smm = child(requestOf(calls[1]), "SMM");
    assert.deepEqual(smm.children.map(item => [item.name, textOf(item)]), [["ID", NUMBER], ["UUID", UUID]]);
    assert.equal(result.status, "cancelled");
  });
  test("resmî PDF: GetSMM (UUID + giden yön + PDF); ZIP'li içerik açılır; PDF değilse integrator-no-pdf; makbuz yoksa integrator-not-found", async () => {
    let content = PDF.toString("base64");
    const { calls, fetchImpl } = harness({ replies: { GetSMM: () => (content === null ? "" : pdfReply(content)) } });
    const client = smmClient(fetchImpl);
    const plain = await client.officialPdf({ uuid: UUID, number: NUMBER });
    assert.equal(plain.data.subarray(0, 5).toString("latin1"), "%PDF-");
    const request = requestOf(calls[1]);
    assert.deepEqual(request.children.map(item => item.name), ["REQUEST_HEADER", "SMM_SEARCH_KEY", "HEADER_ONLY", "SMM_CONTENT_TYPE"]);
    assert.deepEqual(child(request, "SMM_SEARCH_KEY").children.map(item => [item.name, textOf(item)]), [["LIMIT", "1"], ["UUID", UUID], ["DIRECTION", "OUT"]]);
    assert.equal(textOf(child(request, "SMM_CONTENT_TYPE")), "PDF");
    content = zipWith("makbuz.pdf", PDF).toString("base64");
    assert.deepEqual((await client.officialPdf({ uuid: UUID, number: NUMBER })).data, PDF);
    content = Buffer.from("<html/>").toString("base64");
    assert.equal((await errorOf(client.officialPdf({ uuid: UUID, number: NUMBER }))).code, "integrator-no-pdf");
    content = null;
    assert.equal((await errorOf(client.officialPdf({ uuid: UUID, number: NUMBER }))).code, "integrator-not-found");
  });
  test("kopan bağlantı: yan etkisiz GetSMMStatus bir kez yinelenir; SendSMM ve CancelSMM YİNELENMEZ (sonuç belirsiz)", async () => {
    const statusCase = harness({ replies: { GetSMMStatus: statusReply("SEND - SUCCEED") }, resets: { GetSMMStatus: 1 } });
    assert.equal((await smmClient(statusCase.fetchImpl).status({ uuid: UUID, number: NUMBER })).status, "sent");
    assert.deepEqual(statusCase.calls.map(call => call.op), ["Login", "GetSMMStatus", "GetSMMStatus"]);
    for (const op of ["SendSMM", "CancelSMM"]) {
      const { calls, fetchImpl } = harness({ resets: { [op]: 1 } });
      const client = smmClient(fetchImpl);
      const error = await errorOf(op === "SendSMM" ? client.send({ xml: ubl(), number: NUMBER, uuid: UUID, senderVkn: "1234567890", receiverVkn: "9876543210" }) : client.cancel({ uuid: UUID, number: NUMBER }));
      assert.equal(error.code, "integrator-uncertain", `${op}: ${error.message}`);
      assert.deepEqual(calls.map(call => call.op), ["Login", op], `${op} bir kez gitti`);
    }
  });
  test("EDM hatası (RequestFault) e-SMM'de de reddedildi olarak gelir; EDM kodu korunur", async () => {
    const fault = `<s:Fault><faultcode>s:Client</faultcode><faultstring>Hata</faultstring><detail><RequestFault xmlns="${NS}"><INTL_TXN_ID xmlns="">0</INTL_TXN_ID><ERROR_CODE xmlns="">11099</ERROR_CODE><ERROR_SHORT_DES xmlns="">SMM bulunamadı</ERROR_SHORT_DES></RequestFault></detail></s:Fault>`;
    const { fetchImpl } = harness({ replies: { GetSMMStatus: fault } });
    const error = await errorOf(smmClient(fetchImpl).status({ uuid: UUID, number: NUMBER }));
    assert.equal(error.code, "integrator-rejected");
    assert.equal(error.integratorCode, "11099");
  });
});

describe("Bağdaştırıcı belge türüne göre servisi seçer (e-SMM → ESmmEDM.svc; e-Fatura/e-Arşiv → EFaturaEDM.svc)", () => {
  const integrator = (extra = {}) => ({ id: "edm", env: "test", baseUrl: FATURA_URL, username: "kullanici", password: "parola", senderAlias: "urn:mail:defaultgb@ofis.com", ...extra });
  const smmInvoice = { profile: "ESMM", number: NUMBER, ettn: UUID, issueDate: "2026-10-22", party: { taxNo: "9876543210", email: "muvekkil@ornek.com" } };
  test("ensureSession belgenin servisinde giriş yapar; e-Fatura oturumu e-SMM için erişim kanıtı sayılmaz; argümansız çağrı e-Fatura (eski davranış)", async () => {
    const { calls, fetchImpl } = harness();
    const link = connect({ integrator: integrator(), seller: { taxNo: "1234567890" }, fetchImpl });
    await link.ensureSession();
    await link.ensureSession({ invoice: { profile: "EARSIVFATURA" } });
    await link.ensureSession({ invoice: smmInvoice });
    await link.ensureSession({ invoice: smmInvoice });
    assert.deepEqual(calls.map(call => [call.op, call.url]), [["Login", FATURA_URL], ["Login", SMM_URL]], "her servise bir giriş; taze oturum yeniden giriş istemez");
  });
  test("e-SMM belgesinde gönder / durum / iptal / resmî PDF ESmmEDM.svc'ye gider; e-posta ayarı kapalıysa alıcıya e-posta verilmez", async () => {
    const { calls, fetchImpl } = harness({ replies: { SendSMM: SEND_REPLY, GetSMMStatus: statusReply("SEND - SUCCEED"), GetSMM: pdfReply(PDF.toString("base64")) } });
    const link = connect({ integrator: integrator(), seller: { taxNo: "1234567890" }, fetchImpl });
    await link.send({ invoice: smmInvoice, xml: ubl() });
    assert.equal((await link.status({ invoice: smmInvoice })).status, "sent");
    assert.equal((await link.cancel({ invoice: smmInvoice })).status, "cancelled");
    assert.equal((await link.officialPdf({ invoice: smmInvoice })).mime, "application/pdf");
    assert.deepEqual(calls.map(call => [call.op, call.service]), [["Login", "smm"], ["SendSMM", "smm"], ["GetSMMStatus", "smm"], ["CancelSMM", "smm"], ["GetSMM", "smm"]]);
    const head = child(child(requestOf(calls[1]), "SMM"), "HEADER");
    assert.equal(textOf(child(head, "TO")), "muvekkil@ornek.com");
    assert.equal(textOf(child(head, "FROM")), "urn:mail:defaultgb@ofis.com");
    const quiet = harness({ replies: { SendSMM: SEND_REPLY } });
    await connect({ integrator: integrator({ earchiveEmail: false }), seller: { taxNo: "1234567890" }, fetchImpl: quiet.fetchImpl }).send({ invoice: smmInvoice, xml: ubl() });
    assert.equal(child(child(child(requestOf(quiet.calls[1]), "SMM"), "HEADER"), "TO"), null, "e-posta gönderimi kapalı → TO yok");
  });
  test("e-Arşiv belgesi (eski davranış) e-Fatura servisinden gider", async () => {
    const { calls, fetchImpl } = harness();
    const link = connect({ integrator: integrator(), seller: { taxNo: "1234567890" }, fetchImpl });
    const invoice = { profile: "EARSIVFATURA", number: "TEA2026000000001", ettn: UUID, party: { taxNo: "10000000146" } };
    await link.send({ invoice, xml: ubl({ profile: "EARSIVFATURA", number: "TEA2026000000001" }) });
    await link.cancel({ invoice });
    assert.deepEqual(calls.map(call => [call.op, call.service]), [["Login", "efatura"], ["SendInvoice", "efatura"], ["CancelInvoice", "efatura"]]);
  });
  test("e-SMM'de portala taslak yok: 409 einvoice-draft-unsupported, ağa çıkılmaz", async () => {
    const { calls, fetchImpl } = harness();
    const link = connect({ integrator: integrator(), seller: { taxNo: "1234567890" }, fetchImpl });
    for (const work of [() => link.loadDraft({ invoice: smmInvoice, xml: ubl() }), () => link.sendDraft({ invoice: smmInvoice })]) {
      const error = await errorOf(work());
      assert.equal(error.status, 409);
      assert.equal(error.extra.code, "einvoice-draft-unsupported");
    }
    assert.deepEqual(calls, []);
  });
  test("e-SMM adresi türetilemezse yalnız e-SMM işlemi düşer (integrator-url, ağa çıkılmaz); e-Fatura bağlantısı bozulmaz", async () => {
    const { calls, fetchImpl } = harness();
    const link = connect({ integrator: integrator({ baseUrl: "http://127.0.0.1:9/baska/servis" }), seller: { taxNo: "1234567890" }, fetchImpl });
    const error = await errorOf(link.ensureSession({ invoice: smmInvoice }));
    assert.equal(error.status, 400);
    assert.equal(error.extra.code, "integrator-url");
    assert.deepEqual(calls, []);
    // Boş Servis Adresi → ortamın adresi: test ortamında e-SMM test adresi.
    const blank = harness();
    await connect({ integrator: integrator({ baseUrl: "" }), seller: { taxNo: "1234567890" }, fetchImpl: blank.fetchImpl }).ensureSession({ invoice: smmInvoice });
    assert.deepEqual(blank.calls.map(call => call.url), [EDM_SMM_URLS.test]);
    assert.equal(EDM_URLS.test, FATURA_URL);
  });
  test("testSmm: e-SMM servisine bağlantı testi (Entegratör Ayarları → Bağlantıyı Test Et için hazır)", async () => {
    const { calls, fetchImpl } = harness();
    const result = await connect({ integrator: integrator(), seller: { taxNo: "1234567890" }, fetchImpl }).testSmm();
    assert.equal(result.ok, true);
    assert.deepEqual(calls.map(call => [call.op, call.service]), [["Login", "smm"]]);
  });
});
