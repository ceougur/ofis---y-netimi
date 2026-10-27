// 2.4.7 E1/E2 (EDM iş ortaklığı): EDM hak edişi YALNIZ REQUEST_HEADER/APPLICATION_NAME'den hesaplanır → programın EDM'ye gönderdiği HER istekte
// (e-Fatura/e-Arşiv servisi ve e-SMM servisi, girişten iptale) APPLICATION_NAME = "destekofis30", CHANNEL_NAME = "DestekOfis" olmalı.
// Test, istemcinin ağ katmanını (fetchImpl) yakalar; istek gövdesi XML olarak çözülür ve REQUEST_HEADER okunur. Eski kodda (2.4.6) iki alan da
// "DestekOfis" idi: APPLICATION_NAME denetimi "destekofis30 bekleniyordu" iletisiyle kırmızı olur.
import assert from "node:assert/strict";
import test from "node:test";
import { createEdmClient, createEdmSmmClient, resetEdmCaches } from "../server/lib/einvoice/edm.mjs";
import { find, parseXml, textOf } from "../server/lib/einvoice/xml-lite.mjs";

const UUID = "11111111-2222-4333-8444-555555555555";
const NUMBER = "DST2026000000001";

function capture() {
  const seen = [];
  const fetchImpl = async (url, { method = "GET", body = "" } = {}) => {
    if (method !== "POST") return new Response("yok", { status: 404 });
    const tree = parseXml(String(body));
    const request = (find(tree, "Envelope/Body")?.children || [])[0];
    const op = String(request?.name || "").replace(/Request$/, "");
    const head = (request?.children || []).find(item => item.name === "REQUEST_HEADER");
    seen.push({ op, application: textOf(find(head, "APPLICATION_NAME")), channel: textOf(find(head, "CHANNEL_NAME")) });
    const inner = op === "Login" ? "<SESSION_ID>oturum-1</SESSION_ID>" : "";
    return new Response(`<?xml version="1.0"?><s:Envelope xmlns:s="http://schemas.xmlsoap.org/soap/envelope/"><s:Body><${op}Response>${inner}</${op}Response></s:Body></s:Envelope>`, { status: 200, headers: { "content-type": "text/xml" } });
  };
  return { seen, fetchImpl };
}
const swallow = promise => promise.then(() => {}, () => {});

const ubl = profile => `<Invoice><cbc:ProfileID>${profile}</cbc:ProfileID><cbc:ID>${NUMBER}</cbc:ID><cbc:UUID>${UUID}</cbc:UUID></Invoice>`;

test("2.4.7 E2: e-Fatura/e-Arşiv servisinin her işleminde APPLICATION_NAME destekofis30, CHANNEL_NAME DestekOfis", async () => {
  resetEdmCaches();
  const { seen, fetchImpl } = capture();
  const client = createEdmClient({ baseUrl: "https://edm.example.test/EFaturaEDM21ea/EFaturaEDM.svc", username: "u", password: "p", env: "test", fetchImpl, useWsdl: false });
  await swallow(client.checkUser("1234567890"));
  await swallow(client.send({ xml: ubl("TEMELFATURA"), number: NUMBER, uuid: UUID, receiverAlias: "urn:mail:pk@x" }));
  await swallow(client.send({ xml: ubl("EARSIVFATURA"), number: NUMBER, uuid: UUID, earchive: true }));
  await swallow(client.loadDraft({ xml: ubl("TICARIFATURA"), number: NUMBER, uuid: UUID, receiverAlias: "urn:mail:pk@x" }));
  await swallow(client.sendDraft({ number: NUMBER, uuid: UUID, receiverAlias: "urn:mail:pk@x" }));
  await swallow(client.status({ uuid: UUID, number: NUMBER }));
  await swallow(client.cancelEArchive({ uuid: UUID, number: NUMBER }));
  await swallow(client.inbox({}));
  await swallow(client.officialPdf({ uuid: UUID, number: NUMBER }));
  await swallow(client.markRead([UUID]));
  const ops = new Set(seen.map(item => item.op));
  for (const op of ["Login", "CheckUser", "SendInvoice", "LoadInvoice", "GetInvoiceStatus", "CancelInvoice", "GetInvoice", "MarkInvoice"]) assert.ok(ops.has(op), `${op} isteği gönderilmedi (görülen: ${[...ops].join(", ")})`);
  for (const item of seen) {
    assert.equal(item.application, "destekofis30", `${item.op}: APPLICATION_NAME destekofis30 bekleniyordu, ${item.application} geldi`);
    assert.equal(item.channel, "DestekOfis", `${item.op}: CHANNEL_NAME DestekOfis bekleniyordu, ${item.channel} geldi`);
  }
});

test("2.4.7 E2: e-SMM servisinin her işleminde APPLICATION_NAME destekofis30, CHANNEL_NAME DestekOfis", async () => {
  resetEdmCaches();
  const { seen, fetchImpl } = capture();
  const client = createEdmSmmClient({ baseUrl: "https://edm.example.test/EFaturaEDM21ea/ESmmEDM.svc", username: "u", password: "p", env: "test", fetchImpl, useWsdl: false });
  await swallow(client.send({ xml: ubl("ESMM"), number: NUMBER, uuid: UUID, senderVkn: "1234567890" }));
  await swallow(client.status({ uuid: UUID, number: NUMBER }));
  await swallow(client.cancel({ uuid: UUID, number: NUMBER }));
  await swallow(client.officialPdf({ uuid: UUID, number: NUMBER }));
  const ops = new Set(seen.map(item => item.op));
  for (const op of ["Login", "SendSMM", "GetSMMStatus", "CancelSMM", "GetSMM"]) assert.ok(ops.has(op), `${op} isteği gönderilmedi (görülen: ${[...ops].join(", ")})`);
  for (const item of seen) {
    assert.equal(item.application, "destekofis30", `${item.op}: APPLICATION_NAME destekofis30 bekleniyordu, ${item.application} geldi`);
    assert.equal(item.channel, "DestekOfis", `${item.op}: CHANNEL_NAME DestekOfis bekleniyordu, ${item.channel} geldi`);
  }
});

test("2.4.7 E1: uygulama adı seçenekle değiştirilemez (eski appName / applicationName yok sayılır); kanal adı channelName ile", async () => {
  resetEdmCaches();
  const { seen, fetchImpl } = capture();
  const client = createEdmClient({ baseUrl: "https://edm.example.test/EFaturaEDM21ea/EFaturaEDM.svc", username: "u", password: "p", env: "test", fetchImpl, useWsdl: false, appName: "Baska", applicationName: "Baska", channelName: "DestekOfis Mobil" });
  await swallow(client.checkUser("1234567890"));
  assert.ok(seen.length >= 2);
  for (const item of seen) {
    assert.equal(item.application, "destekofis30", `${item.op}: APPLICATION_NAME destekofis30 bekleniyordu, ${item.application} geldi`);
    assert.equal(item.channel, "DestekOfis Mobil");
  }
});
