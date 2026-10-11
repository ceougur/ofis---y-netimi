// EDM Bilişim bağlantısı (v2.0.15): sahte bir EDM SOAP sunucusuyla uçtan uca.
// - Sözleşme (WSDL) okunur; SOAPAction, ad alanı, nitelikli alanlar ve alan sırası sunucunun WSDL'ine göre gider.
// - WSDL yoksa i2i varsayılanı (ad alanı http://schemas.i2i.com/ei/wsdl, SOAPAction "") kullanılır.
// - Sözleşmede olmayan alan gönderilmez (istek hiç yapılmaz).
// - Oturum düşerse (EDM 10011) yeniden giriş yapılıp istek bir kez tekrarlanır; program Logout çağırmaz.
// - Program uçları: ayarlar (parola şifreli, ekrana çıkmaz), Bağlantıyı Sına, Mükellef Sorgula, gönder, durum, e-Arşiv
//   iptali (önce programda deneme), gelen kutusu (çek, alış taslağı olarak al, yok say), e-Belge kapalıyken 404.
import assert from "node:assert/strict";
import { createServer } from "node:http";
import { after, before, describe, test } from "node:test";
import { createEdmClient, mapEdmStatus, resetEdmCaches } from "../server/lib/einvoice/edm.mjs";
import { E, readWsdl, renderTree, shape } from "../server/lib/einvoice/soap-contract.mjs";
import { child, deep, find, parseXml, textOf } from "../server/lib/einvoice/xml-lite.mjs";
import { classifyTaxId } from "../server/lib/tax-id.mjs";
import { ADMIN_PASSWORD, startTestServer } from "./helpers.mjs";

const NS = "urn:edm:test";
// Program yanıtı { ok, data } zarfındadır; testte gövde doğrudan okunur (hatada { ok: false, error, code }).
const unwrap = response => ({ ...response, data: response.data && typeof response.data === "object" && "ok" in response.data ? (response.data.ok ? response.data.data : response.data) : response.data });
const apiOf = client => ({
  login: (...args) => client.login(...args),
  get: async url => unwrap(await client.get(url)),
  post: async (url, body) => unwrap(await client.post(url, body)),
  put: async (url, body) => unwrap(await client.put(url, body)),
  del: async url => unwrap(await client.del(url)),
});
const ACTION = op => `http://tempuri.org/EFaturaEDMPort/${op}`;

// VKN denetim hanesi (GİB algoritması) ile geçerli VKN üretir.
function vkn(nine) {
  const digits = String(nine).padStart(9, "0").split("").map(Number);
  let sum = 0;
  digits.forEach((digit, index) => {
    const tmp = (digit + (9 - index)) % 10;
    let value = (tmp * 2 ** (9 - index)) % 9;
    if (tmp !== 0 && value === 0) value = 9;
    sum += value;
  });
  return `${digits.join("")}${(10 - (sum % 10)) % 10}`;
}
const OUR_VKN = vkn(123456789);
const BUYER_VKN = vkn(987654321);
const SUPPLIER_VKN = vkn(555444333);

// WCF singleWsdl benzeri sözleşme: alanlar nitelikli (elementFormDefault="qualified"), istekler REQUEST'ten türer,
// SOAP 1.1 ve 1.2 bağlamaları, işlem başına SOAPAction.
const OPS = ["Login", "Logout", "CheckUser", "SendInvoice", "GetInvoiceStatus", "GetInvoice", "CancelInvoice", "MarkInvoice"];
function wsdl({ statusInvoice = true } = {}) {
  const ext = (name, body) => `<xs:element name="${name}"><xs:complexType><xs:complexContent><xs:extension base="t:REQUEST"><xs:sequence>${body}</xs:sequence></xs:extension></xs:complexContent></xs:complexType></xs:element>`;
  const schema = `<xs:schema xmlns:xs="http://www.w3.org/2001/XMLSchema" xmlns:t="${NS}" targetNamespace="${NS}" elementFormDefault="qualified">
    <xs:complexType name="REQUEST_HEADERType"><xs:sequence>${["SESSION_ID", "CLIENT_TXN_ID", "ACTION_DATE", "REASON", "APPLICATION_NAME", "HOSTNAME", "CHANNEL_NAME", "COMPRESSED"].map(name => `<xs:element minOccurs="0" name="${name}" type="xs:string"/>`).join("")}</xs:sequence></xs:complexType>
    <xs:complexType name="REQUEST"><xs:sequence><xs:element name="REQUEST_HEADER" type="t:REQUEST_HEADERType"/></xs:sequence></xs:complexType>
    <xs:complexType name="INVOICE"><xs:sequence><xs:element minOccurs="0" name="HEADER"><xs:complexType><xs:sequence><xs:element minOccurs="0" name="SENDER" type="xs:string"/><xs:element minOccurs="0" name="RECEIVER" type="xs:string"/><xs:element minOccurs="0" name="EARCHIVE" type="xs:boolean"/></xs:sequence></xs:complexType></xs:element><xs:element minOccurs="0" name="CONTENT" type="xs:base64Binary"/></xs:sequence><xs:attribute name="ID" type="xs:string"/><xs:attribute name="UUID" type="xs:string"/></xs:complexType>
    <xs:complexType name="PARTY"><xs:attribute name="vkn" type="xs:string"/><xs:attribute name="alias" type="xs:string"/></xs:complexType>
    ${ext("LoginRequest", `<xs:element name="USER_NAME" type="xs:string"/><xs:element name="PASSWORD" type="xs:string"/>`)}
    ${ext("LogoutRequest", "")}
    ${ext("CheckUserRequest", `<xs:element name="USER"><xs:complexType><xs:sequence><xs:element name="IDENTIFIER" type="xs:string"/></xs:sequence></xs:complexType></xs:element><xs:element minOccurs="0" name="DOCUMENT_TYPE" type="xs:string"/>`)}
    ${ext("SendInvoiceRequest", `<xs:element minOccurs="0" name="SENDER" type="t:PARTY"/><xs:element minOccurs="0" name="RECEIVER" type="t:PARTY"/><xs:element maxOccurs="unbounded" name="INVOICE" type="t:INVOICE"/>`)}
    ${ext("GetInvoiceStatusRequest", statusInvoice ? `<xs:element name="INVOICE" type="t:INVOICE"/>` : `<xs:element name="UUID" type="xs:string"/>`)}
    ${ext("GetInvoiceRequest", `<xs:element name="INVOICE_SEARCH_KEY"><xs:complexType><xs:sequence>${["LIMIT", "ID", "UUID", "START_DATE", "END_DATE", "READ_INCLUDED", "DIRECTION"].map(name => `<xs:element minOccurs="0" name="${name}" type="xs:string"/>`).join("")}</xs:sequence></xs:complexType></xs:element><xs:element minOccurs="0" name="HEADER_ONLY" type="xs:string"/><xs:element minOccurs="0" name="INVOICE_CONTENT_TYPE" type="xs:string"/>`)}
    ${ext("CancelInvoiceRequest", `<xs:element maxOccurs="unbounded" name="INVOICE" type="t:INVOICE"/>`)}
    ${ext("MarkInvoiceRequest", `<xs:element name="MARK"><xs:complexType><xs:sequence><xs:element maxOccurs="unbounded" name="INVOICE" type="t:INVOICE"/></xs:sequence><xs:attribute name="value" type="xs:string"/></xs:complexType></xs:element>`)}
  </xs:schema>`;
  const messages = OPS.map(op => `<wsdl:message name="${op}In"><wsdl:part name="parameters" element="t:${op}Request"/></wsdl:message>`).join("");
  const portOps = OPS.map(op => `<wsdl:operation name="${op}"><wsdl:input message="tns:${op}In"/></wsdl:operation>`).join("");
  const binding = (name, prefix) => `<wsdl:binding name="${name}" type="tns:EFaturaEDMPort"><${prefix}:binding transport="http://schemas.xmlsoap.org/soap/http"/>${OPS.map(op => `<wsdl:operation name="${op}"><${prefix}:operation soapAction="${ACTION(op)}" style="document"/></wsdl:operation>`).join("")}</wsdl:binding>`;
  return `<?xml version="1.0" encoding="utf-8"?><wsdl:definitions name="EFaturaEDM" targetNamespace="http://tempuri.org/" xmlns:wsdl="http://schemas.xmlsoap.org/wsdl/" xmlns:soap="http://schemas.xmlsoap.org/wsdl/soap/" xmlns:soap12="http://schemas.xmlsoap.org/wsdl/soap12/" xmlns:tns="http://tempuri.org/" xmlns:t="${NS}">
    <wsdl:types>${schema}</wsdl:types>${messages}<wsdl:portType name="EFaturaEDMPort">${portOps}</wsdl:portType>
    ${binding("Soap12Binding", "soap12")}${binding("BasicBinding", "soap")}
    <wsdl:service name="EFaturaEDM"><wsdl:port name="P12" binding="tns:Soap12Binding"><soap12:address location="http://sunucu-ic/EFaturaEDM.svc/soap12"/></wsdl:port><wsdl:port name="P11" binding="tns:BasicBinding"><soap:address location="http://sunucu-ic/EFaturaEDM.svc"/></wsdl:port></wsdl:service>
  </wsdl:definitions>`;
}

const INCOMING_UUID = "6b1f6a8e-0c1e-4a8b-9d3c-1f2e3d4c5b6a";
const incomingUbl = () => `<?xml version="1.0" encoding="UTF-8"?><Invoice xmlns="urn:oasis:names:specification:ubl:schema:xsd:Invoice-2" xmlns:cac="urn:oasis:names:specification:ubl:schema:xsd:CommonAggregateComponents-2" xmlns:cbc="urn:oasis:names:specification:ubl:schema:xsd:CommonBasicComponents-2">
  <cbc:ProfileID>TEMELFATURA</cbc:ProfileID><cbc:ID>TDR2026000000042</cbc:ID><cbc:UUID>${INCOMING_UUID}</cbc:UUID><cbc:IssueDate>2026-09-20</cbc:IssueDate><cbc:IssueTime>10:15:00</cbc:IssueTime><cbc:InvoiceTypeCode>SATIS</cbc:InvoiceTypeCode><cbc:Note>Teslim depoya</cbc:Note><cbc:DocumentCurrencyCode>TRY</cbc:DocumentCurrencyCode>
  <cac:AccountingSupplierParty><cac:Party><cac:PartyIdentification><cbc:ID schemeID="VKN">${SUPPLIER_VKN}</cbc:ID></cac:PartyIdentification><cac:PartyName><cbc:Name>Toptan Kırtasiye A.Ş.</cbc:Name></cac:PartyName><cac:PostalAddress><cbc:StreetName>Sanayi Cd.</cbc:StreetName><cbc:BuildingNumber>5</cbc:BuildingNumber><cbc:CitySubdivisionName>Çankaya</cbc:CitySubdivisionName><cbc:CityName>Ankara</cbc:CityName><cac:Country><cbc:Name>Türkiye</cbc:Name></cac:Country></cac:PostalAddress><cac:PartyTaxScheme><cac:TaxScheme><cbc:Name>Kavaklıdere</cbc:Name></cac:TaxScheme></cac:PartyTaxScheme></cac:Party></cac:AccountingSupplierParty>
  <cac:AccountingCustomerParty><cac:Party><cac:PartyIdentification><cbc:ID schemeID="VKN">${OUR_VKN}</cbc:ID></cac:PartyIdentification><cac:PartyName><cbc:Name>Deneme Ofis Ltd.</cbc:Name></cac:PartyName></cac:Party></cac:AccountingCustomerParty>
  <cac:TaxTotal><cbc:TaxAmount currencyID="TRY">60.00</cbc:TaxAmount></cac:TaxTotal>
  <cac:LegalMonetaryTotal><cbc:LineExtensionAmount currencyID="TRY">300.00</cbc:LineExtensionAmount><cbc:TaxExclusiveAmount currencyID="TRY">300.00</cbc:TaxExclusiveAmount><cbc:TaxInclusiveAmount currencyID="TRY">360.00</cbc:TaxInclusiveAmount><cbc:PayableAmount currencyID="TRY">360.00</cbc:PayableAmount></cac:LegalMonetaryTotal>
  <cac:InvoiceLine><cbc:ID>1</cbc:ID><cbc:InvoicedQuantity unitCode="C62">10</cbc:InvoicedQuantity><cbc:LineExtensionAmount currencyID="TRY">200.00</cbc:LineExtensionAmount><cac:TaxTotal><cbc:TaxAmount currencyID="TRY">40.00</cbc:TaxAmount><cac:TaxSubtotal><cbc:TaxableAmount currencyID="TRY">200.00</cbc:TaxableAmount><cbc:TaxAmount currencyID="TRY">40.00</cbc:TaxAmount><cbc:Percent>20</cbc:Percent></cac:TaxSubtotal></cac:TaxTotal><cac:Item><cbc:Name>A4 Kağıt</cbc:Name><cac:SellersItemIdentification><cbc:ID>KG-A4</cbc:ID></cac:SellersItemIdentification></cac:Item><cac:Price><cbc:PriceAmount currencyID="TRY">20</cbc:PriceAmount></cac:Price></cac:InvoiceLine>
  <cac:InvoiceLine><cbc:ID>2</cbc:ID><cbc:InvoicedQuantity unitCode="HUR">2</cbc:InvoicedQuantity><cbc:LineExtensionAmount currencyID="TRY">100.00</cbc:LineExtensionAmount><cac:TaxTotal><cbc:TaxAmount currencyID="TRY">20.00</cbc:TaxAmount><cac:TaxSubtotal><cbc:TaxableAmount currencyID="TRY">100.00</cbc:TaxableAmount><cbc:TaxAmount currencyID="TRY">20.00</cbc:TaxAmount><cbc:Percent>20</cbc:Percent></cac:TaxSubtotal></cac:TaxTotal><cac:Item><cbc:Name>Kurulum Hizmeti</cbc:Name></cac:Item><cac:Price><cbc:PriceAmount currencyID="TRY">50</cbc:PriceAmount></cac:Price></cac:InvoiceLine>
</Invoice>`;

/** Sahte EDM: WSDL yayımlar (ya da yayımlamaz), istekleri sözleşmeye göre denetler, kayıt tutar. */
async function startMockEdm({ serveWsdl = true, contract = {} } = {}) {
  const state = { calls: [], sent: [], cancelled: [], marked: [], sessions: new Set(), counter: 0, expireNext: false, statuses: new Map(), wsdlHits: 0, violations: [] };
  const fault = (code, message) => `<s:Envelope xmlns:s="http://schemas.xmlsoap.org/soap/envelope/"><s:Body><s:Fault><faultcode>s:Client</faultcode><faultstring>${message}</faultstring><detail><RequestFault xmlns="${NS}"><ERROR_CODE>${code}</ERROR_CODE><ERROR_SHORT_DES>${message}</ERROR_SHORT_DES></RequestFault></detail></s:Fault></s:Body></s:Envelope>`;
  const okEnvelope = body => `<s:Envelope xmlns:s="http://schemas.xmlsoap.org/soap/envelope/"><s:Body>${body}</s:Body></s:Envelope>`;
  const server = createServer((req, res) => {
    let raw = "";
    req.on("data", chunk => (raw += chunk));
    req.on("end", () => {
      if (req.method === "GET") {
        state.wsdlHits += 1;
        if (!serveWsdl) {
          res.writeHead(404).end("yok");
          return;
        }
        res.writeHead(200, { "content-type": "text/xml" }).end(wsdl(contract));
        return;
      }
      const tree = parseXml(raw);
      const body = deep(tree, "Body");
      const request = body.children[0];
      const op = request.name.replace(/Request$/, "");
      const action = String(req.headers.soapaction || "").replace(/^"|"$/g, "");
      state.calls.push({ op, action, ns: request.ns, raw });
      const expectNs = serveWsdl ? NS : "http://schemas.i2i.com/ei/wsdl";
      if (request.ns !== expectNs) state.violations.push(`${op}: kök ad alanı ${request.ns}`);
      if (action !== (serveWsdl ? ACTION(op) : "")) state.violations.push(`${op}: SOAPAction ${action}`);
      const header = child(request, "REQUEST_HEADER");
      if (request.children[0] !== header) state.violations.push(`${op}: REQUEST_HEADER ilk sırada değil`);
      for (const item of request.children) if (item.ns !== (serveWsdl ? NS : "")) state.violations.push(`${op}: ${item.name} ad alanı ${item.ns}`);
      const session = textOf(child(header, "SESSION_ID"));
      const respond = xml => res.writeHead(200, { "content-type": "text/xml" }).end(okEnvelope(xml));
      if (op === "Login") {
        if (textOf(child(request, "USER_NAME")) !== "edmkullanici" || textOf(child(request, "PASSWORD")) !== "Gizli-Parola-1") {
          res.writeHead(500, { "content-type": "text/xml" }).end(fault(2001, "Kullanıcı adı veya şifre hatalı"));
          return;
        }
        state.counter += 1;
        const id = `S-${state.counter}`;
        state.sessions.add(id);
        respond(`<LoginResponse xmlns="${NS}"><REQUEST_RETURN><RETURN_CODE>0</RETURN_CODE></REQUEST_RETURN><SESSION_ID>${id}</SESSION_ID></LoginResponse>`);
        return;
      }
      if (op === "Logout") state.violations.push("Logout çağrıldı (başka oturumları kapatır)");
      if (!state.sessions.has(session) || state.expireNext) {
        state.expireNext = false;
        state.sessions.delete(session);
        res.writeHead(500, { "content-type": "text/xml" }).end(fault(10011, "Aktif Session bulunamadi"));
        return;
      }
      if (op === "CheckUser") {
        const id = textOf(find(request, "USER/IDENTIFIER"));
        const users = id === BUYER_VKN ? `<USER><IDENTIFIER>${id}</IDENTIFIER><ALIAS>urn:mail:defaultgb@alici.com.tr</ALIAS><TITLE>ALICI TİCARET A.Ş.</TITLE><TYPE>OZEL</TYPE><UNIT>GB</UNIT></USER><USER><IDENTIFIER>${id}</IDENTIFIER><ALIAS>urn:mail:defaultpk@alici.com.tr</ALIAS><TITLE>ALICI TİCARET A.Ş.</TITLE><TYPE>OZEL</TYPE><UNIT>PK</UNIT></USER>` : "";
        respond(`<CheckUserResponse xmlns="${NS}">${users}</CheckUserResponse>`);
        return;
      }
      if (op === "SendInvoice") {
        const invoice = child(request, "INVOICE");
        state.sent.push({ sender: child(request, "SENDER")?.attrs, receiver: child(request, "RECEIVER")?.attrs, id: invoice.attrs.ID, uuid: invoice.attrs.UUID, earchive: textOf(find(invoice, "HEADER/EARCHIVE")), order: invoice.children.map(item => item.name), xml: Buffer.from(textOf(child(invoice, "CONTENT")), "base64").toString("utf8") });
        state.statuses.set(invoice.attrs.UUID, ["SEND - WAIT_GIB_RESPONSE", "SEND - SUCCEED"]);
        respond(`<SendInvoiceResponse xmlns="${NS}"><REQUEST_RETURN><RETURN_CODE>0</RETURN_CODE></REQUEST_RETURN><INVOICE ID="${invoice.attrs.ID}" UUID="${invoice.attrs.UUID}"/></SendInvoiceResponse>`);
        return;
      }
      if (op === "GetInvoiceStatus") {
        const uuid = child(request, "INVOICE")?.attrs.UUID;
        const queue = state.statuses.get(uuid) || ["UNKNOWN - UNKNOWN"];
        const status = queue.length > 1 ? queue.shift() : queue[0];
        respond(`<GetInvoiceStatusResponse xmlns="${NS}"><INVOICE_STATUS ID="x" UUID="${uuid}"><STATUS>${status}</STATUS><STATUS_DESCRIPTION>${status}</STATUS_DESCRIPTION><GIB_STATUS_CODE>1300</GIB_STATUS_CODE><GIB_STATUS_DESCRIPTION>BASARIYLA TAMAMLANDI</GIB_STATUS_DESCRIPTION></INVOICE_STATUS></GetInvoiceStatusResponse>`);
        return;
      }
      if (op === "CancelInvoice") {
        state.cancelled.push(child(request, "INVOICE")?.attrs.UUID);
        respond(`<CancelInvoiceResponse xmlns="${NS}"><REQUEST_RETURN><RETURN_CODE>0</RETURN_CODE></REQUEST_RETURN></CancelInvoiceResponse>`);
        return;
      }
      if (op === "GetInvoice") {
        const key = child(request, "INVOICE_SEARCH_KEY");
        if (textOf(child(key, "DIRECTION")) !== "IN") state.violations.push("GetInvoice DIRECTION IN değil");
        const content = Buffer.from(incomingUbl(), "utf8").toString("base64");
        respond(`<GetInvoiceResponse xmlns="${NS}"><INVOICE ID="TDR2026000000042" UUID="${INCOMING_UUID}"><HEADER><SENDER>${SUPPLIER_VKN}</SENDER><RECEIVER>${OUR_VKN}</RECEIVER><SUPPLIER>Toptan Kırtasiye A.Ş.</SUPPLIER><ISSUE_DATE>2026-09-20</ISSUE_DATE><PAYABLE_AMOUNT currencyID="TRY">360.00</PAYABLE_AMOUNT><FROM>urn:mail:defaultgb@toptan.com.tr</FROM><PROFILEID>TEMELFATURA</PROFILEID><STATUS>RECEIVE - SUCCEED</STATUS></HEADER><CONTENT>${content}</CONTENT></INVOICE></GetInvoiceResponse>`);
        return;
      }
      if (op === "MarkInvoice") {
        for (const item of find(request, "MARK")?.children || []) state.marked.push(item.attrs.UUID);
        respond(`<MarkInvoiceResponse xmlns="${NS}"><REQUEST_RETURN><RETURN_CODE>0</RETURN_CODE></REQUEST_RETURN></MarkInvoiceResponse>`);
        return;
      }
      respond(`<Unknown/>`);
    });
  });
  await new Promise(resolve => server.listen(0, "127.0.0.1", resolve));
  const url = `http://127.0.0.1:${server.address().port}/EFaturaEDM21ea/EFaturaEDM.svc`;
  return { url, state, close: () => new Promise(resolve => server.close(resolve)) };
}

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
