// SOAP sözleşme denetimi NİTELİKLERİ de kapsar (2.4.4, iş listesi 20 — e-SMM). Kâhin: EDM'nin GERÇEK test sözleşmeleri (WSDL; kaynak ve sha256
// tools/ebelge/sema/KAYNAK.md): e-Fatura servisinde INVOICE'ın ID/UUID'si NİTELİKTİR, e-SMM servisinde (ESmmEDM.svc) SMM'nin ID/UUID'si ÇOCUK ÖĞEDİR
// ve SMM'nin tek niteliği TRXID'dir. Program e-Fatura kalıbını e-SMM'ye taşırsa (SMM ID="…" UUID="…") EDM numarayı/ETTN'yi görmez; istek
// "bulunamadı"/yanlış belge sonucuna gider. Sözleşmede olmayan nitelik de alan gibi raporlanmalı ve istek HİÇ gönderilmemeli (integrator-contract).
// Eski kodda (163dd5d) kırmızı: shape yalnız öğeleri denetliyordu, nitelikleri değil (docs/kanit/2026-10-22/244-esmm).
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, test } from "node:test";
import { E, readWsdl, shape } from "../server/lib/einvoice/soap-contract.mjs";
import { SEMA } from "../tools/ebelge/dogrula.mjs";

const contract = file => readWsdl(readFileSync(join(SEMA, "edm", file), "utf8"));
const SMM = contract("ESmmEDM-test-singleWsdl.xml");
const EFATURA = contract("EFaturaEDM-test-singleWsdl.xml");
const HEADER = E("REQUEST_HEADER", [E("SESSION_ID", "S-1"), E("CLIENT_TXN_ID", "c")]);
const warningsOf = (wsdl, operation, tree) => shape(wsdl, operation, tree, { defaultNs: "" }).warnings;

describe("Sözleşme denetimi nitelikleri de denetler (gerçek EDM WSDL'leri kâhin)", () => {
  test("e-SMM: SMM'ye e-Fatura kalıbıyla ID/UUID NİTELİĞİ verilirse uyarı → istek gönderilmez", () => {
    for (const operation of ["GetSMMStatus", "CancelSMM"]) {
      const tree = E(`${operation}Request`, [HEADER, E("SMM", null, { ID: "TES2026000000001", UUID: "00000000-0000-4000-8000-000000000001" })]);
      assert.deepEqual(warningsOf(SMM, operation, tree), [`${operation}Request/SMM/@ID`, `${operation}Request/SMM/@UUID`]);
    }
  });
  test("e-SMM: ID/UUID ÇOCUK ÖĞE ve TRXID niteliği sözleşmeye uyar", () => {
    const ref = E("SMM", [E("ID", "TES2026000000001"), E("UUID", "00000000-0000-4000-8000-000000000001")], { TRXID: "0" });
    assert.deepEqual(warningsOf(SMM, "GetSMMStatus", E("GetSMMStatusRequest", [HEADER, ref])), []);
    const send = E("SendSMMRequest", [HEADER, E("SENDER", "", { vkn: "1234567890", alias: "urn:mail:defaultgb@a.com" }), E("RECEIVER", "", { vkn: "9876543210" }), E("SMM", [E("ID", "TES2026000000001"), E("UUID", "u"), E("HEADER", [E("SENDER", "1234567890"), E("SMM_DATE", "2026-10-22")]), E("CONTENT", "PEludm9pY2UvPg==")], { TRXID: "0" }), E("SMM_CONTENT_TYPE", "XML")]);
    assert.deepEqual(warningsOf(SMM, "SendSMM", send), []);
  });
  test("e-SMM: istek düzeyindeki SENDER/RECEIVER'da yalnız vkn ve alias nitelikleri var", () => {
    const tree = E("SendSMMRequest", [HEADER, E("SENDER", "", { vkn: "1234567890", eposta: "x@y.com" }), E("SMM", [E("ID", "N")], { TRXID: "0" }), E("SMM_CONTENT_TYPE", "XML")]);
    assert.deepEqual(warningsOf(SMM, "SendSMM", tree), ["SendSMMRequest/SENDER/@eposta"]);
  });
  test("yerleşik basit türde (xs:token) nitelik olmaz", () => {
    const tree = E("GetSMMStatusRequest", [HEADER, E("SMM", [E("ID", "N", { tur: "x" })], { TRXID: "0" })]);
    assert.deepEqual(warningsOf(SMM, "GetSMMStatus", tree), ["GetSMMStatusRequest/SMM/ID/@tur"]);
  });
  test("e-Fatura (eski davranış korunur): INVOICE ID/UUID niteliği, SENDER vkn/alias ve MARK value geçer; tanımsız nitelik uyarılır", () => {
    const send = attrs => E("SendInvoiceRequest", [HEADER, E("SENDER", "", { vkn: "1234567890", alias: "a" }), E("RECEIVER", "", { vkn: "9876543210", alias: "b" }), E("INVOICE", [E("CONTENT", "x")], attrs)]);
    assert.deepEqual(warningsOf(EFATURA, "SendInvoice", send({ ID: "EFT2026000000001", UUID: "u" })), []);
    assert.deepEqual(warningsOf(EFATURA, "SendInvoice", send({ ID: "EFT2026000000001", SERI: "EFT" })), ["SendInvoiceRequest/INVOICE/@SERI"]);
    const mark = E("MarkInvoiceRequest", [HEADER, E("MARK", [E("INVOICE", null, { UUID: "u" })], { value: "READ" })]);
    assert.deepEqual(warningsOf(EFATURA, "MarkInvoice", mark), []);
  });
});
