// Sahte EDM SOAP sunucusu (WCF tarzı WSDL, oturum, CheckUser, SendInvoice, durum, gelen kutusu) — test/einvoice-edm.test.mjs ve
// test/e2e/senaryo-entegrator-240.mjs ortak kullanır (16.10.2026'da e-Belge testinden taşındı; davranış aynı).
import { createServer } from "node:http";
import { child, deep, find, parseXml, textOf } from "../server/lib/einvoice/xml-lite.mjs";

export const NS = "urn:edm:test";
export const ACTION = op => `http://tempuri.org/EFaturaEDMPort/${op}`;

// VKN denetim hanesi (GİB algoritması) ile geçerli VKN üretir.
export function vkn(nine) {
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
export const OUR_VKN = vkn(123456789);
export const BUYER_VKN = vkn(987654321);
export const SUPPLIER_VKN = vkn(555444333);
// İki posta kutusu (PK) olan mükellef (gerçek EDM test yanıtında bir firmada 11 PK görüldü, 16.10.2026).
export const MULTI_VKN = vkn(222333444);

// WCF singleWsdl benzeri sözleşme: alanlar nitelikli (elementFormDefault="qualified"), istekler REQUEST'ten türer,
// SOAP 1.1 ve 1.2 bağlamaları, işlem başına SOAPAction.
export const OPS = ["Login", "Logout", "CheckUser", "SendInvoice", "GetInvoiceStatus", "GetInvoice", "CancelInvoice", "MarkInvoice"];
export function wsdl({ statusInvoice = true } = {}) {
  const ext = (name, body) => `<xs:element name="${name}"><xs:complexType><xs:complexContent><xs:extension base="t:REQUEST"><xs:sequence>${body}</xs:sequence></xs:extension></xs:complexContent></xs:complexType></xs:element>`;
  const schema = `<xs:schema xmlns:xs="http://www.w3.org/2001/XMLSchema" xmlns:t="${NS}" targetNamespace="${NS}" elementFormDefault="qualified">
    <xs:complexType name="REQUEST_HEADERType"><xs:sequence>${["SESSION_ID", "CLIENT_TXN_ID", "ACTION_DATE", "REASON", "APPLICATION_NAME", "HOSTNAME", "CHANNEL_NAME", "COMPRESSED"].map(name => `<xs:element minOccurs="0" name="${name}" type="xs:string"/>`).join("")}</xs:sequence></xs:complexType>
    <xs:complexType name="REQUEST"><xs:sequence><xs:element name="REQUEST_HEADER" type="t:REQUEST_HEADERType"/></xs:sequence></xs:complexType>
    <xs:complexType name="INVOICE"><xs:sequence><xs:element minOccurs="0" name="HEADER"><xs:complexType><xs:sequence><xs:element minOccurs="0" name="SENDER" type="xs:string"/><xs:element minOccurs="0" name="RECEIVER" type="xs:string"/><xs:element minOccurs="0" name="EARCHIVE" type="xs:boolean"/></xs:sequence></xs:complexType></xs:element><xs:element minOccurs="0" name="CONTENT" type="xs:base64Binary"/></xs:sequence><xs:attribute name="ID" type="xs:string"/><xs:attribute name="UUID" type="xs:string"/></xs:complexType>
    <xs:complexType name="PARTY"><xs:attribute name="vkn" type="xs:string"/><xs:attribute name="alias" type="xs:string"/></xs:complexType>
    ${ext("LoginRequest", `<xs:element name="USER_NAME" type="xs:string"/><xs:element name="PASSWORD" type="xs:string"/>`)}
    ${ext("LogoutRequest", "")}
    ${ext("CheckUserRequest", `<xs:element name="USER"><xs:complexType><xs:sequence><xs:element name="IDENTIFIER" type="xs:string"/></xs:sequence></xs:complexType></xs:element>`)}
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

export const INCOMING_UUID = "6b1f6a8e-0c1e-4a8b-9d3c-1f2e3d4c5b6a";
export const incomingUbl = () => `<?xml version="1.0" encoding="UTF-8"?><Invoice xmlns="urn:oasis:names:specification:ubl:schema:xsd:Invoice-2" xmlns:cac="urn:oasis:names:specification:ubl:schema:xsd:CommonAggregateComponents-2" xmlns:cbc="urn:oasis:names:specification:ubl:schema:xsd:CommonBasicComponents-2">
  <cbc:ProfileID>TEMELFATURA</cbc:ProfileID><cbc:ID>TDR2026000000042</cbc:ID><cbc:UUID>${INCOMING_UUID}</cbc:UUID><cbc:IssueDate>2026-09-20</cbc:IssueDate><cbc:IssueTime>10:15:00</cbc:IssueTime><cbc:InvoiceTypeCode>SATIS</cbc:InvoiceTypeCode><cbc:Note>Teslim depoya</cbc:Note><cbc:DocumentCurrencyCode>TRY</cbc:DocumentCurrencyCode>
  <cac:AccountingSupplierParty><cac:Party><cac:PartyIdentification><cbc:ID schemeID="VKN">${SUPPLIER_VKN}</cbc:ID></cac:PartyIdentification><cac:PartyName><cbc:Name>Toptan Kırtasiye A.Ş.</cbc:Name></cac:PartyName><cac:PostalAddress><cbc:StreetName>Sanayi Cd.</cbc:StreetName><cbc:BuildingNumber>5</cbc:BuildingNumber><cbc:CitySubdivisionName>Çankaya</cbc:CitySubdivisionName><cbc:CityName>Ankara</cbc:CityName><cac:Country><cbc:Name>Türkiye</cbc:Name></cac:Country></cac:PostalAddress><cac:PartyTaxScheme><cac:TaxScheme><cbc:Name>Kavaklıdere</cbc:Name></cac:TaxScheme></cac:PartyTaxScheme></cac:Party></cac:AccountingSupplierParty>
  <cac:AccountingCustomerParty><cac:Party><cac:PartyIdentification><cbc:ID schemeID="VKN">${OUR_VKN}</cbc:ID></cac:PartyIdentification><cac:PartyName><cbc:Name>Deneme Ofis Ltd.</cbc:Name></cac:PartyName></cac:Party></cac:AccountingCustomerParty>
  <cac:TaxTotal><cbc:TaxAmount currencyID="TRY">60.00</cbc:TaxAmount></cac:TaxTotal>
  <cac:LegalMonetaryTotal><cbc:LineExtensionAmount currencyID="TRY">300.00</cbc:LineExtensionAmount><cbc:TaxExclusiveAmount currencyID="TRY">300.00</cbc:TaxExclusiveAmount><cbc:TaxInclusiveAmount currencyID="TRY">360.00</cbc:TaxInclusiveAmount><cbc:PayableAmount currencyID="TRY">360.00</cbc:PayableAmount></cac:LegalMonetaryTotal>
  <cac:InvoiceLine><cbc:ID>1</cbc:ID><cbc:InvoicedQuantity unitCode="C62">10</cbc:InvoicedQuantity><cbc:LineExtensionAmount currencyID="TRY">200.00</cbc:LineExtensionAmount><cac:TaxTotal><cbc:TaxAmount currencyID="TRY">40.00</cbc:TaxAmount><cac:TaxSubtotal><cbc:TaxableAmount currencyID="TRY">200.00</cbc:TaxableAmount><cbc:TaxAmount currencyID="TRY">40.00</cbc:TaxAmount><cbc:Percent>20</cbc:Percent></cac:TaxSubtotal></cac:TaxTotal><cac:Item><cbc:Name>A4 Kağıt</cbc:Name><cac:SellersItemIdentification><cbc:ID>KG-A4</cbc:ID></cac:SellersItemIdentification></cac:Item><cac:Price><cbc:PriceAmount currencyID="TRY">20</cbc:PriceAmount></cac:Price></cac:InvoiceLine>
  <cac:InvoiceLine><cbc:ID>2</cbc:ID><cbc:InvoicedQuantity unitCode="HUR">2</cbc:InvoicedQuantity><cbc:LineExtensionAmount currencyID="TRY">100.00</cbc:LineExtensionAmount><cac:TaxTotal><cbc:TaxAmount currencyID="TRY">20.00</cbc:TaxAmount><cac:TaxSubtotal><cbc:TaxableAmount currencyID="TRY">100.00</cbc:TaxableAmount><cbc:TaxAmount currencyID="TRY">20.00</cbc:TaxAmount><cbc:Percent>20</cbc:Percent></cac:TaxSubtotal></cac:TaxTotal><cac:Item><cbc:Name>Kurulum Hizmeti</cbc:Name></cac:Item><cac:Price><cbc:PriceAmount currencyID="TRY">50</cbc:PriceAmount></cac:Price></cac:InvoiceLine>
</Invoice>`;

/** Sahte EDM: WSDL yayımlar (ya da yayımlamaz), istekleri sözleşmeye göre denetler, kayıt tutar. */
export async function startMockEdm({ serveWsdl = true, contract = {} } = {}) {
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
        // Firmanın kendi VKN'si (Entegratör Ayarları → Etiketleri Getir): GB + PK.
        const own = `<USER><IDENTIFIER>${id}</IDENTIFIER><ALIAS>urn:mail:defaultgb@deneme.com.tr</ALIAS><TITLE>DENEME OFİS LTD.</TITLE><TYPE>OZEL</TYPE><UNIT>GB</UNIT></USER><USER><IDENTIFIER>${id}</IDENTIFIER><ALIAS>urn:mail:defaultpk@deneme.com.tr</ALIAS><TITLE>DENEME OFİS LTD.</TITLE><TYPE>OZEL</TYPE><UNIT>PK</UNIT></USER>`;
        const multi = `<USER><IDENTIFIER>${id}</IDENTIFIER><ALIAS>urn:mail:muhasebepk@coklu.com.tr</ALIAS><TITLE>ÇOKLU A.Ş.</TITLE><TYPE>OZEL</TYPE><UNIT>PK</UNIT></USER><USER><IDENTIFIER>${id}</IDENTIFIER><ALIAS>urn:mail:defaultpk@coklu.com.tr</ALIAS><TITLE>ÇOKLU A.Ş.</TITLE><TYPE>OZEL</TYPE><UNIT>PK</UNIT></USER>`;
        const users = id === MULTI_VKN ? multi : id === OUR_VKN ? own : id === BUYER_VKN ? `<USER><IDENTIFIER>${id}</IDENTIFIER><ALIAS>urn:mail:defaultgb@alici.com.tr</ALIAS><TITLE>ALICI TİCARET A.Ş.</TITLE><TYPE>OZEL</TYPE><UNIT>GB</UNIT></USER><USER><IDENTIFIER>${id}</IDENTIFIER><ALIAS>urn:mail:defaultpk@alici.com.tr</ALIAS><TITLE>ALICI TİCARET A.Ş.</TITLE><TYPE>OZEL</TYPE><UNIT>PK</UNIT></USER>` : "";
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
        // Giden belgenin resmî görüntüsü (gerçek EDM test ortamında 16.10.2026 denendi: e-Fatura ve e-Arşiv için base64 PDF döner).
        if (textOf(child(key, "DIRECTION")) === "OUT") {
          const uuid = textOf(child(key, "UUID"));
          const type = textOf(child(request, "INVOICE_CONTENT_TYPE"));
          if (type !== "PDF") state.violations.push(`GetInvoice OUT içerik türü ${type}`);
          state.pdfRequests = (state.pdfRequests || 0) + 1;
          const sent = state.sent.find(item => item.uuid === uuid);
          if (!sent) return respond(`<GetInvoiceResponse xmlns="${NS}"/>`);
          const pdf = Buffer.from(`%PDF-1.4\n% sahte EDM resmi gorunum ${sent.id}\n%%EOF\n`, "latin1").toString("base64");
          return respond(`<GetInvoiceResponse xmlns="${NS}"><INVOICE ID="${sent.id}" UUID="${uuid}"><HEADER><STATUS>SEND - SUCCEED</STATUS></HEADER><CONTENT>${pdf}</CONTENT></INVOICE></GetInvoiceResponse>`);
        }
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
