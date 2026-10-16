// EDM'nin GERÇEK test servis sözleşmesi (WSDL) kâhin olarak (16.10.2026; tools/ebelge/sema/edm, kaynak ve sha256 KAYNAK.md'de): programın EDM
// istemcisi her işlemin isteğini bu sözleşmeye göre kurabilmeli. Program sözleşmede olmayan alanı görünce isteği HİÇ göndermez
// (integrator-contract); bu yüzden sözleşmeye aykırı bir istek gerçek EDM'de o işlemin hiç çalışmaması demektir. Ağa çıkılmaz: WSDL dosyadan,
// yanıtlar sahte. Sahte EDM'nin (test/einvoice-mock.mjs) sözleşmesi programla aynı elden çıktığı için tek başına kâhin sayılmaz (ders 5).
// İkinci kâhin: EDM'nin kendi C# istemcisi (EFaturaEDMConnectorLibrary.cs, CheckUser_byIdentifier) yalnız USER/IDENTIFIER gönderir.
// Eski kodda (b5b45ad) kırmızı: CheckUser DOCUMENT_TYPE alanını USER'ın kardeşi olarak gönderiyordu (gerçekte USER içinde DOCUMENTTYPE) —
// docs/kanit/2026-10-16/edm-gercek-sozlesme-eski.
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, test } from "node:test";
import { createEdmClient, resetEdmCaches } from "../server/lib/einvoice/edm.mjs";
import { SEMA } from "../tools/ebelge/dogrula.mjs";

const WSDL = readFileSync(join(SEMA, "edm", "EFaturaEDM-test-singleWsdl.xml"), "utf8");
const NS = "http://tempuri.org/";
function harness(replies = {}) {
  const calls = [];
  const fetchImpl = async (url, { method = "GET", headers = {}, body } = {}) => {
    if (method === "GET") return new Response(WSDL, { status: 200, headers: { "content-type": "text/xml" } });
    const action = String(headers.SOAPAction ?? headers.soapaction ?? "").replace(/"/g, "");
    const op = action.replace(/Request$/, "");
    calls.push({ op, action, body: String(body) });
    const inner = replies[op] || (op === "Login" ? `<SESSION_ID>S-1</SESSION_ID>` : `<REQUEST_RETURN><RETURN_CODE>0</RETURN_CODE></REQUEST_RETURN>`);
    return new Response(`<?xml version="1.0"?><s:Envelope xmlns:s="http://schemas.xmlsoap.org/soap/envelope/"><s:Body><${op}Response xmlns="${NS}">${inner}</${op}Response></s:Body></s:Envelope>`, { status: 200, headers: { "content-type": "text/xml" } });
  };
  resetEdmCaches();
  return { calls, client: createEdmClient({ baseUrl: "https://test.edmbilisim.com.tr/EFaturaEDM21ea/EFaturaEDM.svc", username: "kullanici", password: "parola", fetchImpl }) };
}

describe("EDM gerçek test sözleşmesi (WSDL): program her işlemin isteğini sözleşmeye uygun kurar", () => {
  test("sözleşme dosyası okunur: SOAP 1.1, tempuri.org, programın kullandığı 8 işlem var", async () => {
    const { client, calls } = harness();
    const result = await client.test();
    assert.equal(result.ok, true, JSON.stringify(result));
    assert.equal(result.contract.source, "wsdl");
    assert.deepEqual(result.contract.missing, [], `eksik işlem: ${result.contract.missing}`);
    assert.equal(calls[0].action, "LoginRequest");
  });
  test("Mükellef Sorgula (CheckUser): yalnız USER/IDENTIFIER gider (EDM'nin C# istemcisi gibi); yanıttaki DOCUMENTTYPE ve ALIAS_REMOVAL_TIME okunur", async () => {
    const users = [
      ["urn:mail:defaultgb@alici.com", "GB", "INVOICE", ""],
      ["urn:mail:defaultpk@alici.com", "PK", "INVOICE", ""],
      ["urn:mail:eskipk@alici.com", "PK", "INVOICE", "2025-01-01T00:00:00"],
      ["urn:mail:irsaliyepk@alici.com", "PK", "DESPATCHADVICE", ""],
    ]
      .map(([alias, unit, type, removed]) => `<USER><IDENTIFIER>9876543210</IDENTIFIER><ALIAS>${alias}</ALIAS><TITLE>ALICI A.Ş.</TITLE><TYPE>OZEL</TYPE><UNIT>${unit}</UNIT>${removed ? `<ALIAS_REMOVAL_TIME>${removed}</ALIAS_REMOVAL_TIME>` : ""}<DOCUMENTTYPE>${type}</DOCUMENTTYPE></USER>`)
      .join("");
    const { client, calls } = harness({ CheckUser: users });
    const result = await client.checkUser("9876543210");
    const request = calls.find(call => call.op === "CheckUser");
    assert.ok(request, "CheckUser isteği gitti (sözleşmeye uygun)");
    assert.match(request.body, /<USER><IDENTIFIER>9876543210<\/IDENTIFIER><\/USER>/);
    assert.doesNotMatch(request.body, /DOCUMENT_TYPE/);
    assert.equal(result.registered, true);
    assert.deepEqual(result.aliases, ["urn:mail:defaultpk@alici.com"], "silinmiş ve irsaliye etiketi alınmaz");
    assert.deepEqual(result.senderAliases, ["urn:mail:defaultgb@alici.com"]);
  });
  test("e-Fatura ve e-Arşiv gönderimi, durum sorgusu, e-Arşiv iptali, gelen kutusu ve okundu işareti sözleşmeye uygun kurulur", async () => {
    const { client, calls } = harness();
    await client.send({ xml: "<Invoice/>", number: "EFT2026000000001", uuid: "00000000-0000-4000-8000-000000000001", senderVkn: "1234567890", senderAlias: "urn:mail:defaultgb@a.com", receiverVkn: "9876543210", receiverAlias: "urn:mail:defaultpk@b.com" });
    await client.send({ xml: "<Invoice/>", number: "EAR2026000000001", uuid: "00000000-0000-4000-8000-000000000002", earchive: true, senderVkn: "1234567890" });
    await client.status({ uuid: "00000000-0000-4000-8000-000000000001", number: "EFT2026000000001" });
    await client.cancelEArchive({ uuid: "00000000-0000-4000-8000-000000000002", number: "EAR2026000000001" });
    await client.inbox({ from: "2026-10-01", to: "2026-10-16" });
    await client.markRead(["00000000-0000-4000-8000-000000000003"]);
    assert.deepEqual([...new Set(calls.map(call => call.op))].filter(op => op !== "Login").sort(), ["CancelInvoice", "GetInvoice", "GetInvoiceStatus", "MarkInvoice", "SendInvoice"]);
    const earchive = calls.filter(call => call.op === "SendInvoice")[1];
    assert.match(earchive.body, /EARCHIVE/, "e-Arşiv işareti sözleşmede var ve gider");
  });
});
