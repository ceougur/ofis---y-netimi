// Sahte EDM e-SMM servisi (ESmmEDM.svc; 2.4.4 iş listesi 22). test/einvoice-mock.mjs'in sunucusu …/ESmmEDM.svc yoluna gelen istekleri buraya
// verir: program e-SMM adresini e-Fatura adresinden türetir (…/EFaturaEDM.svc → …/ESmmEDM.svc), ikisi aynı sahte sunucudadır.
// Sözleşme EDM'nin GERÇEK test WSDL'idir (tools/ebelge/sema/edm/ESmmEDM-test-singleWsdl.xml; ad alanı http://tempuri.org/, SOAPAction "<işlem>Request",
// çocuk öğeler niteliksiz). Yanıtlar EDM'nin e-SMM Request-Response belgesindeki biçimde (test/esmm-edm.test.mjs ile aynı). İstek sözleşmeye
// uymuyorsa (ad alanı, SOAPAction, sıra, SMM'de ID/UUID çocuk öğe + TRXID) state.smm.violations'a yazılır.
// e-SMM oturumu e-Fatura oturumundan AYRIDIR (ayrı uç nokta): e-Fatura servisinin verdiği oturumla gelen e-SMM isteği "Aktif Session bulunamadi"
// (10011) alır — program iki servisin oturumunu karıştırırsa test görür.
// "Bulunamadı" kodu: EDM'nin e-SMM'de hangi kodu verdiği DOĞRULANMADI (madde 24); sahte servis e-Fatura'daki 11017'yi verir — program e-SMM'de bu
// koda güvenmemelidir (test bunu sınar).
import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { child, find, textOf } from "../server/lib/einvoice/xml-lite.mjs";

export const SMM_NS = "http://tempuri.org/";
const WSDL_FILE = path.join(path.dirname(fileURLToPath(import.meta.url)), "..", "tools", "ebelge", "sema", "edm", "ESmmEDM-test-singleWsdl.xml");
let wsdlText = null;
export const smmWsdl = () => (wsdlText ||= readFileSync(WSDL_FILE, "utf8"));
export const isSmmPath = url => /\/ESmmEDM\.svc(\?|$)/i.test(String(url || ""));

export function smmState() {
  // sent: EDM'nin kabul ettiği makbuzlar ({ id, uuid, xml, head, sender, receiver }); statuses: UUID → durum sırası (son durum kalır).
  // renumber: (gönderilen ID) => EDM'nin yanıtta döndürdüğü ID (program farkı görmeli); cutAfter: işlem adları — istek İŞLENİR, sonra bağlantı
  // koparılır (EDM aldı, yanıt gelmedi); faults: işlem → [kod, ileti] (bir kez).
  // Eşzamanlılık düzeneği (tools/edm-gercek.mjs --eszamanli, 2.4.4 iş listesi 24b; varsayılanları davranışı DEĞİŞTİRMEZ):
  //   delay: (işlem adı) => ms — yanıt geciktirilir (zorla araya girme, ders 20); inflight / maxInflight: işlem başına o an / en çok eşzamanlı istek;
  //   sendCount: kaçıncı SendSMM; singleSession: Login öbür oturumları düşürür (EDM'nin bu davranışı DOĞRULANMADI — keşif);
  //   hata enjeksiyonu (testin dişi, ders 7) — k: kaçıncı SendSMM: dropSend (kabul edilir, KAYDA GEÇMEZ: sessiz kayıp), misrecordSend (yanıtta doğru
  //   numara, kayıtta bir önceki makbuzun numarası: çift kayıt), statusAfterSend ({ k: "PACKAGE - FAIL" }: yanlış son durum), holdSend ({ k, ms }:
  //   yanıt ms bekletilir: askı).
  return { calls: [], sent: [], cancelled: [], statuses: new Map(), sessions: new Set(), counter: 0, violations: [], usedIds: new Set(), pdfRequests: 0, renumber: null, cutAfter: new Set(), faults: new Map(), delay: null, inflight: {}, maxInflight: {}, sendCount: 0, singleSession: false, dropSend: 0, misrecordSend: 0, statusAfterSend: {}, holdSend: null };
}

const fault = (code, message) => `<s:Envelope xmlns:s="http://schemas.xmlsoap.org/soap/envelope/"><s:Body><s:Fault><faultcode>s:Client</faultcode><faultstring>${message}</faultstring><detail><RequestFault xmlns="${SMM_NS}"><INTL_TXN_ID xmlns="">0</INTL_TXN_ID><ERROR_CODE xmlns="">${code}</ERROR_CODE><ERROR_SHORT_DES xmlns="">${message}</ERROR_SHORT_DES></RequestFault></detail></s:Fault></s:Body></s:Envelope>`;
const envelope = (op, inner) => `<?xml version="1.0"?><s:Envelope xmlns:s="http://schemas.xmlsoap.org/soap/envelope/"><s:Body xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance"><${op}Response xmlns="${SMM_NS}">${inner}</${op}Response></s:Body></s:Envelope>`;
const RETURN = `<REQUEST_RETURN xmlns=""><INTL_TXN_ID>1</INTL_TXN_ID><RETURN_CODE>0</RETURN_CODE></REQUEST_RETURN>`;
const head = (status = "PACKAGE - PROCESSING") => `<HEADER><SMM_DATE>2026-06-17</SMM_DATE><STATUS>${status}</STATUS><EARCHIVE_REPORT_SENDDATE>0001-01-01</EARCHIVE_REPORT_SENDDATE><CANCEL_EARCHIVE_REPORT_SENDDATE>0001-01-01</CANCEL_EARCHIVE_REPORT_SENDDATE></HEADER>`;

/**
 * Bir e-SMM isteğini yanıtlar. tree: ayrıştırılmış SOAP zarfı; body: Body öğesi; action: SOAPAction (tırnaksız).
 * @returns {{ status: number, xml: string, cut?: boolean }}
 */
export function smmReply(state, { body, action, credentials }) {
  const request = body.children[0];
  const op = request.name.replace(/Request$/, "");
  state.calls.push({ op, action, ns: request.ns });
  if (request.ns !== SMM_NS) state.violations.push(`${op}: kök ad alanı ${request.ns}`);
  if (action !== `${op}Request`) state.violations.push(`${op}: SOAPAction ${action}`);
  const header = child(request, "REQUEST_HEADER");
  if (request.children[0] !== header) state.violations.push(`${op}: REQUEST_HEADER ilk sırada değil`);
  for (const item of request.children) if (item.ns !== "") state.violations.push(`${op}: ${item.name} ad alanı ${item.ns} (niteliksiz olmalı)`);
  const smmOf = node => {
    const smm = child(node, "SMM");
    if (!smm) return null;
    if (!("TRXID" in smm.attrs)) state.violations.push(`${op}: SMM'de TRXID niteliği yok`);
    if ("ID" in smm.attrs || "UUID" in smm.attrs) state.violations.push(`${op}: SMM'de ID/UUID nitelik (çocuk öğe olmalı)`);
    return { node: smm, id: textOf(child(smm, "ID")), uuid: textOf(child(smm, "UUID")).toLowerCase() };
  };
  const once = state.faults.get(op);
  if (once) {
    state.faults.delete(op);
    return { status: 500, xml: fault(once[0], once[1]) };
  }
  if (op === "Login") {
    if (textOf(child(request, "USER_NAME")) !== credentials.username || textOf(child(request, "PASSWORD")) !== credentials.password) return { status: 500, xml: fault(2001, "Kullanıcı adı veya şifre hatalı") };
    state.counter += 1;
    const id = `SMM-S-${state.counter}`;
    if (state.singleSession) state.sessions.clear();
    state.sessions.add(id);
    return { status: 200, xml: envelope(op, `${RETURN}<SESSION_ID xmlns="">${id}</SESSION_ID>`) };
  }
  if (op === "Logout") state.violations.push("Logout çağrıldı (başka oturumları kapatır)");
  if (!state.sessions.has(textOf(child(header, "SESSION_ID")))) return { status: 500, xml: fault(10011, "Aktif Session bulunamadi") };
  const cut = state.cutAfter.has(op);
  if (cut) state.cutAfter.delete(op);
  if (op === "SendSMM") {
    const smm = smmOf(request);
    if (textOf(child(request, "SMM_CONTENT_TYPE")) !== "XML") state.violations.push("SendSMM: SMM_CONTENT_TYPE XML değil");
    const xml = Buffer.from(textOf(child(smm.node, "CONTENT")), "base64").toString("utf8");
    if (!/<cbc:ProfileID>ESMM<\/cbc:ProfileID>/.test(xml)) state.violations.push("SendSMM: içerik ProfileID ESMM değil");
    if (state.usedIds.has(smm.id) || state.sent.some(item => item.id === smm.id)) return { status: 500, xml: fault(11048, `UUID=${smm.uuid} ID=${smm.id} için Daha önce gönderdiğiniz bir SMM'yi tekrar göndermeye çalıştınız`) };
    state.sendCount += 1;
    const k = state.sendCount;
    const fields = Object.fromEntries((child(smm.node, "HEADER")?.children || []).map(item => [item.name, textOf(item)]));
    // Hata enjeksiyonu (yalnız eşzamanlılık düzeneğinin dişi testinde): kayıp / çift kayıt / yanlış durum / askı.
    if (state.dropSend !== k) {
      const recordedId = state.misrecordSend === k && state.sent.length ? state.sent.at(-1).id : smm.id;
      state.sent.push({ id: recordedId, uuid: smm.uuid, xml, head: fields, sender: child(request, "SENDER")?.attrs, receiver: child(request, "RECEIVER")?.attrs });
      state.statuses.set(smm.uuid, state.statusAfterSend?.[k] ? [state.statusAfterSend[k]] : ["PACKAGE - PROCESSING", "SEND - SUCCEED"]);
    }
    const answered = state.renumber ? state.renumber(smm.id) : smm.id;
    return { status: 200, cut, hold: state.holdSend?.k === k ? state.holdSend.ms : 0, xml: envelope(op, `${RETURN}<SMM TRXID="8563409" xmlns=""><ID>${answered}</ID><UUID>${smm.uuid}</UUID>${head()}</SMM>`) };
  }
  if (op === "GetSMMStatus") {
    const smm = smmOf(request);
    const queue = state.statuses.get(smm?.uuid);
    if (!queue) return { status: 500, xml: fault(11017, "SMM bulunamadı") };
    const status = queue.length > 1 ? queue.shift() : queue[0];
    return { status: 200, cut, xml: envelope(op, `<SMM_STATUS TRXID="0" xmlns=""><ID>${smm.id}</ID><UUID>${smm.uuid}</UUID>${head()}<STATUS>${status}</STATUS><STATUS_DESCRIPTION>${status}</STATUS_DESCRIPTION><GIB_STATUS_CODE>1300</GIB_STATUS_CODE><GIB_STATUS_DESCRIPTION>BASARIYLA TAMAMLANDI</GIB_STATUS_DESCRIPTION></SMM_STATUS>`) };
  }
  if (op === "CancelSMM") {
    const smm = smmOf(request);
    if (!state.statuses.has(smm?.uuid)) return { status: 500, xml: fault(11017, "SMM bulunamadı") };
    state.cancelled.push(smm.uuid);
    state.statuses.set(smm.uuid, ["CANCELLED - SUCCEED"]);
    return { status: 200, cut, xml: envelope(op, RETURN) };
  }
  if (op === "GetSMM") {
    const key = child(request, "SMM_SEARCH_KEY");
    if (textOf(child(key, "DIRECTION")) !== "OUT") state.violations.push("GetSMM: DIRECTION OUT değil");
    if (textOf(child(request, "SMM_CONTENT_TYPE")) !== "PDF") state.violations.push("GetSMM: SMM_CONTENT_TYPE PDF değil");
    state.pdfRequests += 1;
    const uuid = textOf(child(key, "UUID")).toLowerCase();
    const sent = state.sent.find(item => item.uuid === uuid);
    if (!sent) return { status: 200, xml: envelope(op, "") };
    const pdf = Buffer.from(`%PDF-1.4\n% sahte EDM e-SMM resmi gorunum ${sent.id}\n%%EOF\n`, "latin1").toString("base64");
    return { status: 200, xml: envelope(op, `<SMM TRXID="0" xmlns=""><ID>${sent.id}</ID><UUID>${uuid}</UUID>${head("SEND - SUCCEED")}<CONTENT>${pdf}</CONTENT></SMM>`) };
  }
  state.violations.push(`${op}: sahte e-SMM servisinde tanımsız işlem`);
  return { status: 500, xml: fault(9999, `Tanımsız işlem ${op}`) };
}
// SOAP zarfının Body'si (find kökten "Envelope/Body").
export const bodyOf = tree => find(tree, "Envelope/Body") || tree;
