// EDM Bilişim özel entegratör bağlantısı (v2.0.15). EDM'nin web servisi Microsoft WCF tabanlıdır (SOAP 1.1 ve 1.2) ve
// tek uç noktadan (EFaturaEDM.svc) e-Fatura ile e-Arşiv'i birlikte sunar. İstek yapıları i2i e-Fatura sözleşme ailesinin
// aynısıdır: REQUEST_HEADER (SESSION_ID, CLIENT_TXN_ID, ACTION_DATE, REASON, APPLICATION_NAME, HOSTNAME, CHANNEL_NAME,
// COMPRESSED), LoginRequest (USER_NAME, PASSWORD → SESSION_ID), SendInvoiceRequest (SENDER/RECEIVER vkn+alias, INVOICE
// CONTENT = base64 UBL-TR), GetInvoiceRequest (INVOICE_SEARCH_KEY, HEADER_ONLY, INVOICE_CONTENT_TYPE),
// GetInvoiceStatusRequest (INVOICE ID/UUID), CheckUserRequest, CancelInvoiceRequest (e-Arşiv iptali), MarkInvoiceRequest.
//
// Kaynaklar: EDM Web API belgeleri (docs.edmbilisim.com.tr: Giriş, Servis Bağlantısı, Belge Durumları, Hata Kodları,
// sınıf referansı) ve EDM'nin WSDL'ini kullanan açık kaynak istemci (github.com/rebasesoftware/edm-efatura).
//
// Sözleşme: program ilk bağlantıda EDM sunucusundan WSDL'i (?singleWsdl) okur; SOAPAction, ad alanı, SOAP sürümü ve
// alan sırası oradan alınır (lib/einvoice/soap-contract.mjs). Sözleşmede bulunmayan zorunlu bir alan gönderilmez: istek
// hiç yapılmaz ve hangi alanın tutmadığı söylenir. WSDL alınamazsa i2i varsayılanıyla (ad alanı
// http://schemas.i2i.com/ei/wsdl, SOAPAction "") çalışılır.
//
// Oturum: EDM belgesine göre Logout, aynı kullanıcının başka yerlerdeki (EDM portalı, başka kurulum) oturumlarını da
// kapatır. Bu yüzden program çıkış yapmaz; oturumu bellekte tutar, "Aktif session bulunamadı" (10011) gelince yeniden
// giriş yapıp isteği bir kez tekrarlar.
import { randomUUID } from "node:crypto";
import { hostname } from "node:os";
import { readZip } from "../zip.mjs";
import { IntegratorError } from "./integrator-error.mjs";
import { E, fieldPaths, readWsdl, renderTree, shape, soapRequest } from "./soap-contract.mjs";
import { children, deep, deepAll, find, parseXml, textOf } from "./xml-lite.mjs";

export const EDM_URLS = Object.freeze({
  test: "https://test.edmbilisim.com.tr/EFaturaEDM21ea/EFaturaEDM.svc",
  live: "https://portal2.edmbilisim.com.tr/EFaturaEDM/EFaturaEDM.svc",
});
export const EDM_DEFAULT_NS = "http://schemas.i2i.com/ei/wsdl";
export const EDM_OPERATIONS = Object.freeze(["Login", "SendInvoice", "GetInvoiceStatus", "GetInvoice", "CheckUser", "CancelInvoice", "MarkInvoice"]);
const APP = "DestekOfis";
const CONTRACT_TTL = 12 * 60 * 60 * 1000;
const SESSION_TTL = 20 * 60 * 1000;
const sessions = new Map();
const contracts = new Map();

// EDM belge durumları (docs: e-Fatura / e-Arşiv Durumları) → program durumu + Türkçe açıklama.
const EDM_STATES = Object.freeze({
  "PACKAGE-PROCESSING": ["processing", "EDM'de paketleniyor."],
  "PACKAGE-FAIL": ["error", "Paketleme hatası: belgeyi düzeltip aynı numarayla yeniden gönderin."],
  "PACKAGE-FAILED": ["error", "Paketleme hatası: belgeyi düzeltip aynı numarayla yeniden gönderin."],
  "LOAD-SUCCEED": ["processing", "Taslak olarak EDM'ye yüklendi; gönderilmeyi bekliyor."],
  "SEND-PROCESSING": ["processing", "Gönderiliyor; sonuç bekleniyor."],
  "SEND-WAIT_GIB_RESPONSE": ["processing", "GİB yanıtı bekleniyor."],
  "SEND-WAIT_SYSTEM_RESPONSE": ["processing", "Alıcı sistemin yanıtı bekleniyor."],
  "SEND-WAIT_APPLICATION_RESPONSE": ["sent", "Alıcıya ulaştı; alıcının kabul ya da red yanıtı bekleniyor (Ticari Fatura)."],
  "SEND-SUCCEED": ["sent", "Alıcıya ulaştı."],
  "SEND-FAILED": ["error", "Gönderim başarısız: belgeyi düzeltip aynı numarayla yeniden gönderin."],
  "ACCEPTED-SUCCEED": ["accepted", "Alıcı faturayı kabul etti."],
  "REJECTED-SUCCEED": ["rejected", "Alıcı faturayı reddetti."],
  "CANCELLED-SUCCEED": ["cancelled", "Fatura EDM'de iptal edildi."],
  "CANCEL-SUCCEED": ["cancelled", "Fatura EDM'de iptal edildi."],
  "UNKNOWN-UNKNOWN": ["processing", "Durum henüz belli değil; biraz sonra yeniden sorgulayın."],
});
export function mapEdmStatus({ status = "", description = "", gibCode = "", gibDescription = "", responseCode = "", responseDescription = "", earchive = false }) {
  const normalized = String(status).replace(/\s+/g, "").toUpperCase();
  const extra = [description && description !== status ? description : "", gibDescription, responseDescription].filter(Boolean).join(" · ");
  const known = EDM_STATES[normalized];
  const response = `${responseCode} ${responseDescription}`.toLocaleUpperCase("tr-TR");
  let state;
  let text;
  if (known) [state, text] = known;
  else if (/CANCEL/.test(normalized)) [state, text] = ["cancelled", "Fatura EDM'de iptal edildi."];
  else if (/FAIL|ERROR/.test(normalized)) [state, text] = ["error", "Belge hata aldı."];
  else if (/SUCCEED/.test(normalized)) [state, text] = ["sent", "İşlem tamamlandı."];
  else [state, text] = ["processing", "EDM'de işleniyor."];
  if (state === "sent" && /RED|REJECT/.test(response)) [state, text] = ["rejected", "Alıcı faturayı reddetti."];
  else if (state === "sent" && /KABUL|ACCEPT/.test(response)) [state, text] = ["accepted", "Alıcı faturayı kabul etti."];
  if (earchive && normalized === "SEND-SUCCEED") text = "e-Arşiv fatura oluşturuldu; alıcının e-posta adresi varsa gönderildi.";
  return { status: state, message: [text, extra].filter(Boolean).join(" "), raw: String(status).trim(), gibCode: String(gibCode || "") };
}

const pad = value => String(value).padStart(2, "0");
const localStamp = (date = new Date()) => `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}:${pad(date.getSeconds())}`;
const base64Text = value => Buffer.from(String(value ?? ""), "utf8").toString("base64");
const decodeContent = base64 => {
  const buffer = Buffer.from(String(base64 || "").replace(/\s+/g, ""), "base64");
  if (buffer.length > 4 && buffer.readUInt32LE(0) === 0x04034b50) {
    const entry = readZip(buffer).find(item => !item.directory && /\.xml$/i.test(item.name)) || readZip(buffer).find(item => !item.directory);
    return entry ? entry.data.toString("utf8") : "";
  }
  const text = buffer.toString("utf8");
  return text.replace(/^﻿/, "");
};
const sessionError = (code, message) => String(code) === "10011" || /aktif\s*session|session\s*bulunamad|session.*(expired|not\s*found)|oturum.*(bulunamad|sona)/i.test(String(message || ""));

/**
 * @param {{ baseUrl: string, username: string, password: string, fetchImpl?: Function, timeoutMs?: number, useWsdl?: boolean, appName?: string }} options
 */
export function createEdmClient({ baseUrl, username, password, fetchImpl = (...args) => globalThis.fetch(...args), timeoutMs = 45_000, useWsdl = true, appName = APP }) {
  const base = String(baseUrl || "").trim().replace(/\/+$/, "").replace(/\?.*$/, "");
  if (!/^https:\/\//i.test(base) && !/^http:\/\/(127\.0\.0\.1|localhost)(:\d+)?\//i.test(`${base}/`)) throw new IntegratorError("EDM servis adresi https:// ile başlamalı.", { code: "integrator-url", status: 400 });
  if (!username || !password) throw new IntegratorError("EDM web servis kullanıcı adı ve parolası girilmemiş (Fatura Ayarları → e-Belge Bağlantısı).", { code: "integrator-credentials", status: 400 });
  const sessionKey = `${base}|${username}`;

  async function http(url, { method = "GET", headers = {}, body } = {}, wait = timeoutMs) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), wait);
    try {
      const response = await fetchImpl(url, { method, headers, body, signal: controller.signal });
      return { status: response.status, ok: response.ok, text: await response.text() };
    } catch (error) {
      throw new IntegratorError(error?.name === "AbortError" ? "EDM yanıt vermedi (zaman aşımı). İnternet bağlantısını ve servis adresini kontrol edin; birazdan yeniden deneyin." : `EDM'ye bağlanılamadı: ${error?.cause?.code || error?.message || error}`, { code: "integrator-unreachable" });
    } finally {
      clearTimeout(timer);
    }
  }

  // ---------- Sözleşme (WSDL) ----------
  async function loadContract({ refresh = false } = {}) {
    if (!useWsdl) return { contract: null, source: "default", error: "" };
    const cached = contracts.get(base);
    if (cached && !refresh && Date.now() - cached.at < CONTRACT_TTL) return cached;
    let entry;
    try {
      let response = await http(`${base}?singleWsdl`, {}, 20_000);
      if (!response.ok || !/definitions/.test(response.text)) response = await http(`${base}?wsdl`, {}, 20_000);
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      let text = response.text;
      // ?wsdl şemaları ayrı adreslerden çeker (xsd:import schemaLocation): aynı sunucudan alınıp tek belgeye eklenir.
      const imports = [...text.matchAll(/schemaLocation="([^"]+)"/g)].map(match => match[1].replace(/&amp;/g, "&")).slice(0, 12);
      if (imports.length && !/<(\w+:)?complexType/.test(text)) {
        const origin = new URL(base).origin;
        const parts = [];
        for (const location of imports) {
          const url = new URL(location, `${base}`);
          if (url.origin !== origin) continue;
          const xsd = await http(url.href, {}, 20_000);
          if (xsd.ok) parts.push(xsd.text.replace(/<\?xml[^>]*\?>/, ""));
        }
        text = text.replace(/<((\w+:)?types)\s*>([\s\S]*?)<\/\1>/, (_, tag, __, inner) => `<${tag}>${inner}${parts.join("")}</${tag}>`);
      }
      entry = { contract: readWsdl(text), source: "wsdl", error: "", at: Date.now() };
    } catch (error) {
      entry = { contract: null, source: "default", error: error instanceof IntegratorError ? error.message : `WSDL okunamadı: ${error?.message || error}`, at: Date.now() };
    }
    contracts.set(base, entry);
    return entry;
  }
  const endpointOf = contract => {
    // WCF, WSDL'de iç ağ adını (http://sunucu-01/…) yazabilir; adres her zaman ayarlardaki adrestir. Bağlama .svc'den
    // sonra ek yol isterse (…/EFaturaEDM.svc/basic) o ek yol alınır.
    const location = contract?.location || "";
    const at = location.toLowerCase().indexOf(".svc/");
    return at >= 0 ? `${base}${location.slice(at + 4)}` : base;
  };

  // ---------- Çağrı ----------
  async function call(operation, payload, { session = "", wait } = {}) {
    const { contract } = await loadContract();
    const shaped = shape(contract, operation, payload, { defaultNs: EDM_DEFAULT_NS });
    if (shaped.warnings.length) throw new IntegratorError(`EDM sözleşmesi programın gönderdiği alanla uyuşmuyor (${shaped.warnings.join(", ")}). İstek gönderilmedi. Fatura Ayarları'nda Bağlantıyı Sına'nın sonucunu destek hattına iletin.`, { code: "integrator-contract", status: 409, detail: shaped.warnings.join(", ") });
    const action = contract?.operations?.[operation]?.action ?? "";
    const endpoint = endpointOf(contract);
    const request = soapRequest({ version: contract?.version || "1.1", action, body: renderTree(shaped.tree), addressing: contract?.addressing, to: endpoint });
    const response = await http(endpoint, { method: "POST", headers: request.headers, body: request.xml }, wait);
    let tree;
    try {
      tree = parseXml(response.text);
    } catch {
      throw new IntegratorError(`EDM'den okunamayan yanıt geldi (HTTP ${response.status}).`, { detail: response.text.slice(0, 500) });
    }
    const fault = deep(tree, "Fault");
    const errorNode = deep(tree, "RequestFault") || deep(tree, "REQUEST_ERROR") || deep(tree, "ERROR_TYPE");
    const errorCode = textOf(find(errorNode, "ERROR_CODE"));
    if (fault || (errorNode && errorCode && errorCode !== "0")) {
      const message = textOf(find(errorNode, "ERROR_SHORT_DES")) || textOf(find(errorNode, "ERROR_LONG_DES")) || textOf(deep(fault, "faultstring")) || textOf(deep(deep(fault, "Reason"), "Text")) || "SOAP hatası";
      if (session && sessionError(errorCode, message)) throw Object.assign(new IntegratorError("EDM oturumu sona ermiş.", { code: "integrator-session" }), { sessionExpired: true });
      throw new IntegratorError(`EDM isteği reddetti: ${message}${errorCode ? ` (EDM hata kodu ${errorCode})` : ""}`, { code: "integrator-rejected", integratorCode: errorCode, detail: textOf(find(errorNode, "ERROR_LONG_DES")).slice(0, 500) });
    }
    if (!response.ok) throw new IntegratorError(`EDM HTTP ${response.status} döndürdü.`, { detail: response.text.slice(0, 500) });
    const body = find(tree, "Envelope/Body") || tree;
    const returnCode = textOf(deep(deep(body, "REQUEST_RETURN"), "RETURN_CODE"));
    if (returnCode && returnCode !== "0" && Number(returnCode) < 0) throw new IntegratorError(`EDM işlemi kabul etmedi (dönüş kodu ${returnCode}).`, { code: "integrator-rejected", integratorCode: returnCode });
    return body;
  }
  const header = session =>
    E("REQUEST_HEADER", [
      E("SESSION_ID", session),
      E("CLIENT_TXN_ID", randomUUID()),
      E("ACTION_DATE", localStamp()),
      E("REASON", "e-Belge"),
      E("APPLICATION_NAME", appName),
      E("HOSTNAME", hostname().slice(0, 60) || "DestekOfis"),
      E("CHANNEL_NAME", appName),
      E("COMPRESSED", "N"),
    ]);

  async function login() {
    const body = await call("Login", E("LoginRequest", [header("-1"), E("USER_NAME", username), E("PASSWORD", password)]));
    const session = textOf(deep(body, "SESSION_ID"));
    if (!session) throw new IntegratorError("EDM oturum anahtarı vermedi; kullanıcı adı ya da parola yanlış olabilir.", { code: "integrator-login" });
    sessions.set(sessionKey, { id: session, at: Date.now() });
    return session;
  }
  async function withSession(work) {
    const cached = sessions.get(sessionKey);
    let session = cached && Date.now() - cached.at < SESSION_TTL ? cached.id : await login();
    try {
      return await work(session);
    } catch (error) {
      if (!error?.sessionExpired) throw error;
      sessions.delete(sessionKey);
      session = await login();
      return work(session);
    }
  }
  const touch = () => {
    const cached = sessions.get(sessionKey);
    if (cached) cached.at = Date.now();
  };

  // ---------- İşlemler ----------
  async function contractReport({ refresh = false } = {}) {
    const entry = await loadContract({ refresh });
    const contract = entry.contract;
    return {
      source: entry.source,
      error: entry.error,
      namespace: contract ? Object.values(contract.operations).find(op => op.input)?.input.ns || contract.targetNamespace : EDM_DEFAULT_NS,
      soap: contract?.version || "1.1",
      endpoint: endpointOf(contract),
      operations: contract ? Object.keys(contract.operations).sort() : [],
      missing: contract ? EDM_OPERATIONS.filter(name => !contract.operations[name]) : [],
      earchiveHeader: contract ? fieldPaths(contract, "SendInvoice").includes("INVOICE/HEADER/EARCHIVE") : false,
    };
  }

  return {
    endpoint: base,
    contractReport,
    async test() {
      const report = await contractReport({ refresh: true });
      sessions.delete(sessionKey);
      await login();
      const parts = ["EDM'ye giriş yapıldı; bağlantı çalışıyor."];
      parts.push(report.source === "wsdl" ? `Servis sözleşmesi (WSDL) okundu: SOAP ${report.soap}, ${report.operations.length} işlem.` : `Servis sözleşmesi okunamadı (${report.error}); varsayılan sözleşmeyle çalışılıyor.`);
      if (report.missing.length) parts.push(`Sözleşmede bulunmayan işlemler: ${report.missing.join(", ")}.`);
      return { ok: true, message: parts.join(" "), contract: report };
    },
    // GİB e-Fatura kullanıcısı mı? Posta kutusu (PK) etiketleri (alıcı olarak) döner.
    async checkUser(taxNo) {
      return withSession(async session => {
        const body = await call("CheckUser", E("CheckUserRequest", [header(session), E("USER", [E("IDENTIFIER", taxNo)]), E("DOCUMENT_TYPE", "INVOICE")]), { session });
        touch();
        const users = deepAll(body, "USER").map(user => ({
          identifier: textOf(find(user, "IDENTIFIER")),
          alias: textOf(find(user, "ALIAS")),
          title: textOf(find(user, "TITLE")),
          type: textOf(find(user, "TYPE")),
          unit: textOf(find(user, "UNIT")).toUpperCase(),
          deleted: textOf(find(user, "DELETED")) || textOf(find(user, "ALIAS_DELETION_TIME")),
          documentType: textOf(find(user, "DOCUMENT_TYPE")).toUpperCase(),
        }));
        const active = users.filter(user => user.alias && !/^(Y|E|TRUE|1)$/i.test(user.deleted) && !(user.deleted && /\d{4}/.test(user.deleted)) && (!user.documentType || user.documentType === "INVOICE"));
        const inboxes = active.filter(user => user.unit ? user.unit === "PK" : !/defaultgb|:gb@|gb@/i.test(user.alias));
        return { registered: inboxes.length > 0, title: inboxes[0]?.title || active[0]?.title || "", aliases: [...new Set(inboxes.map(user => user.alias))], type: inboxes[0]?.type || "" };
      });
    },
    // e-Fatura ve e-Arşiv ikisi de SendInvoice ile gider; EDM belge türünü UBL'deki ProfileID'den anlar. Sözleşmede
    // INVOICE/HEADER/EARCHIVE alanı varsa e-Arşiv işareti de konur.
    async send({ xml, number, uuid, earchive = false, senderVkn = "", senderAlias = "", receiverVkn = "", receiverAlias = "" }) {
      if (!earchive && !receiverAlias) throw new IntegratorError("Alıcının e-Fatura posta kutusu etiketi bilinmiyor; cari kartında Mükellef Sorgula ile alın.", { code: "integrator-alias", status: 400 });
      return withSession(async session => {
        const invoice = E("INVOICE", [E("HEADER", earchive ? [E("EARCHIVE", "true", {}, { optional: true })] : [], {}, { optional: true }), E("CONTENT", base64Text(xml))], { ID: number, UUID: uuid });
        const request = E("SendInvoiceRequest", [header(session), E("SENDER", "", { vkn: senderVkn, alias: senderAlias }), E("RECEIVER", "", { vkn: receiverVkn, alias: earchive ? "" : receiverAlias }), invoice]);
        const body = await call("SendInvoice", request, { session, wait: 90_000 });
        touch();
        const sent = deepAll(body, "INVOICE")[0];
        return {
          status: "sent",
          message: earchive ? "e-Arşiv fatura EDM'ye iletildi; sonucu Durum Sorgula ile görün." : "e-Fatura EDM'ye iletildi; GİB ve alıcı yanıtı Durum Sorgula ile alınır.",
          reference: sent?.attrs?.ID || textOf(find(sent, "ID")) || number,
          uuid: sent?.attrs?.UUID || textOf(find(sent, "UUID")) || uuid,
        };
      });
    },
    async status({ uuid, number = "", earchive = false }) {
      return withSession(async session => {
        const body = await call("GetInvoiceStatus", E("GetInvoiceStatusRequest", [header(session), E("INVOICE", null, { ID: number, UUID: uuid })]), { session });
        touch();
        const status = deep(body, "INVOICE_STATUS");
        const read = name => textOf(find(status, name));
        return mapEdmStatus({ status: read("STATUS"), description: read("STATUS_DESCRIPTION"), gibCode: read("GIB_STATUS_CODE"), gibDescription: read("GIB_STATUS_DESCRIPTION"), responseCode: read("RESPONSE_CODE"), responseDescription: read("RESPONSE_DESCRIPTION"), earchive });
      });
    },
    // e-Arşiv iptali (EDM: taslak, hatalı ya da Send-Succeed durumundaki e-Arşiv fatura iptal edilebilir). e-Fatura
    // EDM üzerinden iptal edilmez.
    async cancelEArchive({ uuid, number = "" }) {
      return withSession(async session => {
        await call("CancelInvoice", E("CancelInvoiceRequest", [header(session), E("INVOICE", null, { ID: number, UUID: uuid })]), { session });
        touch();
        return { status: "cancelled", message: "e-Arşiv fatura EDM'de iptal edildi; iptal GİB'e raporlanır." };
      });
    },
    // Gelen e-Faturalar (DIRECTION=IN). İçerik base64 UBL-TR XML (sıkıştırılmışsa ZIP) olarak gelir.
    async inbox({ from = "", to = "", limit = 100, includeRead = false } = {}) {
      return withSession(async session => {
        const key = E("INVOICE_SEARCH_KEY", [E("LIMIT", limit), E("START_DATE", from), E("END_DATE", to), E("READ_INCLUDED", includeRead ? "true" : "false"), E("DIRECTION", "IN")]);
        const body = await call("GetInvoice", E("GetInvoiceRequest", [header(session), key, E("HEADER_ONLY", "N"), E("INVOICE_CONTENT_TYPE", "XML", {}, { optional: true })]), { session, wait: 120_000 });
        touch();
        const list = children(find(body, "GetInvoiceResponse") || deep(body, "GetInvoiceResponse") || body, "INVOICE");
        return list.map(invoice => {
          const head = find(invoice, "HEADER");
          const read = name => textOf(find(head, name));
          const amount = find(head, "PAYABLE_AMOUNT");
          const content = find(invoice, "CONTENT");
          return {
            uuid: invoice.attrs.UUID || textOf(find(invoice, "UUID")),
            number: invoice.attrs.ID || textOf(find(invoice, "ID")),
            senderVkn: read("SENDER"),
            senderName: read("SUPPLIER"),
            senderAlias: read("FROM"),
            issueDate: read("ISSUE_DATE").slice(0, 10),
            payable: Number(textOf(amount)) || 0,
            currency: amount?.attrs?.currencyID || "TRY",
            profile: read("PROFILEID"),
            typeCode: read("INVOICE_TYPE_CODE"),
            status: mapEdmStatus({ status: read("STATUS"), description: read("STATUS_DESCRIPTION") }).message,
            xml: textOf(content) ? decodeContent(textOf(content)) : "",
          };
        });
      });
    },
    async markRead(uuids) {
      if (!uuids.length) return { ok: true };
      return withSession(async session => {
        await call("MarkInvoice", E("MarkInvoiceRequest", [header(session), E("MARK", uuids.map(uuid => E("INVOICE", null, { UUID: uuid })), { value: "READ" })]), { session });
        touch();
        return { ok: true };
      });
    },
  };
}

/** Testler için: bellekteki oturum ve sözleşme önbelleğini boşaltır. */
export function resetEdmCaches() {
  sessions.clear();
  contracts.clear();
}
