// İzibiz özel entegratör bağlantısı (v2.0.15) — SOAP 1.1, document/literal. İstek ve yanıt yapıları İzibiz'in resmî
// örnek projesindeki WSDL/XSD'lerden alınmıştır (github.com/izibiz/ws-client-dotnet: AuthenticationWS, EFaturaOIB,
// EIArchiveWS/EFaturaArchive). Kök öğe hedef ad alanındadır; çocuk öğeler nitelenmemiştir (şemalarda elementFormDefault
// tanımlı değil → unqualified).
//
// Akış: Login (kullanıcı adı + parola → SESSION_ID) → işlem (REQUEST_HEADER.SESSION_ID) → Logout.
//   e-Fatura : SendInvoice (GB → PK etiketi, içerik ZIP + base64), GetInvoiceStatus, GetInvoice (gelen), MarkInvoice.
//   e-Arşiv  : WriteToArchiveExtended (ArchiveInvoiceExtendedRequest), GetEArchiveInvoiceStatus, CancelEArchiveInvoice.
//   Mükellef : CheckUser (VKN/TCKN → e-Fatura kullanıcısı mı, posta kutusu etiketleri).
// Belgeyi entegratör kendi mali mührüyle imzalar (özel entegrasyon); program imza anahtarı tutmaz.
import { createZip, readZip } from "../zip.mjs";
import { children, deep, deepAll, escapeXml, find, parseXml, textOf } from "./xml-lite.mjs";

export const IZIBIZ_URLS = Object.freeze({
  test: "https://efaturatest.izibiz.com.tr",
  live: "https://efatura.izibiz.com.tr",
});
const NS = { wsdl: "http://schemas.i2i.com/ei/wsdl", archive: "http://schemas.i2i.com/ei/wsdl/archive" };
const PATHS = { auth: "/AuthenticationWS", invoice: "/EFaturaOIB", archive: "/EIArchiveWS/EFaturaArchive" };
const APP = "DestekOfis";

export class IntegratorError extends Error {
  constructor(message, { code = "integrator-error", detail = "", status = 502 } = {}) {
    super(message);
    this.code = code;
    this.detail = detail;
    this.status = status;
  }
}

const tag = (name, value) => (value === undefined || value === null || value === "" ? "" : `<${name}>${escapeXml(value)}</${name}>`);
const header = (session, { compressed = "N" } = {}) => `<REQUEST_HEADER>${tag("SESSION_ID", session)}${tag("APPLICATION_NAME", APP)}${tag("COMPRESSED", compressed)}</REQUEST_HEADER>`;
const envelope = (prefix, ns, body) =>
  `<?xml version="1.0" encoding="UTF-8"?><soapenv:Envelope xmlns:soapenv="http://schemas.xmlsoap.org/soap/envelope/" xmlns:${prefix}="${ns}"><soapenv:Header/><soapenv:Body>${body}</soapenv:Body></soapenv:Envelope>`;
const zipBase64 = (name, xml) => createZip([{ name, data: Buffer.from(xml, "utf8") }]).toString("base64");
const unzipText = base64 => {
  const buffer = Buffer.from(String(base64 || "").replace(/\s+/g, ""), "base64");
  if (buffer.length > 4 && buffer.readUInt32LE(0) === 0x04034b50) {
    const entry = readZip(buffer).find(item => !item.directory);
    return entry ? entry.data.toString("utf8") : "";
  }
  return buffer.toString("utf8");
};
const errorOf = response => {
  const error = deep(response, "ERROR_TYPE");
  if (!error) return null;
  return { code: textOf(find(error, "ERROR_CODE")), message: textOf(find(error, "ERROR_SHORT_DES")) || textOf(find(error, "ERROR_LONG_DES")) || "Entegratör hata döndürdü." };
};
const returnCode = response => {
  const node = deep(response, "RETURN_CODE");
  return node ? Number(textOf(node)) : null;
};

/**
 * @param {{ baseUrl: string, username: string, password: string, fetchImpl?: Function, timeoutMs?: number }} config
 */
export function createIzibizClient({ baseUrl, username, password, fetchImpl = (...args) => globalThis.fetch(...args), timeoutMs = 30_000 }) {
  const base = String(baseUrl || "").replace(/\/+$/, "");
  if (!/^https:\/\//i.test(base) && !/^http:\/\/(127\.0\.0\.1|localhost)(:\d+)?$/i.test(base)) throw new IntegratorError("Entegratör adresi https:// ile başlamalı.", { code: "integrator-url", status: 400 });
  if (!username || !password) throw new IntegratorError("Entegratör kullanıcı adı ve parolası girilmemiş (Fatura Ayarları → Entegratör).", { code: "integrator-credentials", status: 400 });

  async function call(path, xml) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);
    let response;
    try {
      response = await fetchImpl(`${base}${path}`, { method: "POST", headers: { "content-type": "text/xml; charset=utf-8", SOAPAction: '""' }, body: xml, signal: controller.signal });
    } catch (error) {
      throw new IntegratorError(error?.name === "AbortError" ? "Entegratör yanıt vermedi (zaman aşımı). İnternet bağlantısını ve entegratör adresini kontrol edin." : `Entegratöre bağlanılamadı: ${error?.message || error}`, { code: "integrator-unreachable" });
    } finally {
      clearTimeout(timer);
    }
    const text = await response.text();
    let tree;
    try {
      tree = parseXml(text);
    } catch {
      throw new IntegratorError(`Entegratörden okunamayan yanıt geldi (HTTP ${response.status}).`, { detail: text.slice(0, 500) });
    }
    const fault = deep(tree, "Fault");
    if (fault) throw new IntegratorError(`Entegratör isteği reddetti: ${textOf(deep(fault, "faultstring")) || "SOAP hatası"}`, { code: "integrator-fault", detail: textOf(deep(fault, "detail")).slice(0, 500) });
    if (!response.ok) throw new IntegratorError(`Entegratör HTTP ${response.status} döndürdü.`, { detail: text.slice(0, 500) });
    return find(tree, "Envelope/Body") || tree;
  }
  const assertOk = (response, what) => {
    const error = errorOf(response);
    if (error) throw new IntegratorError(`${what}: ${error.message}${error.code ? ` (kod ${error.code})` : ""}`, { code: "integrator-rejected", detail: error.code });
    const code = returnCode(response);
    if (code !== null && code < 0) throw new IntegratorError(`${what}: entegratör işlemi kabul etmedi (dönüş kodu ${code}).`, { code: "integrator-rejected" });
  };

  async function login() {
    const body = await call(PATHS.auth, envelope("wsdl", NS.wsdl, `<wsdl:LoginRequest>${header("-1")}${tag("USER_NAME", username)}${tag("PASSWORD", password)}</wsdl:LoginRequest>`));
    assertOk(body, "Giriş");
    const session = textOf(deep(body, "SESSION_ID"));
    if (!session) throw new IntegratorError("Entegratör oturum anahtarı vermedi; kullanıcı adı ya da parola yanlış olabilir.", { code: "integrator-login" });
    return session;
  }
  async function logout(session) {
    try {
      await call(PATHS.auth, envelope("wsdl", NS.wsdl, `<wsdl:LogoutRequest>${header(session)}</wsdl:LogoutRequest>`));
    } catch {
      // Oturum kapatılamasa da entegratörde zaman aşımıyla kapanır.
    }
  }
  async function withSession(work) {
    const session = await login();
    try {
      return await work(session);
    } finally {
      await logout(session);
    }
  }

  return {
    async test() {
      return withSession(async () => ({ ok: true, message: "Entegratöre giriş yapıldı; bağlantı çalışıyor." }));
    },
    // GİB e-Fatura kullanıcısı mı? Posta kutusu (PK) etiketleri döner.
    async checkUser(taxNo) {
      return withSession(async session => {
        const body = await call(PATHS.auth, envelope("wsdl", NS.wsdl, `<wsdl:CheckUserRequest>${header(session)}<USER>${tag("IDENTIFIER", taxNo)}</USER>${tag("DOCUMENT_TYPE", "INVOICE")}</wsdl:CheckUserRequest>`));
        assertOk(body, "Mükellef sorgusu");
        const users = deepAll(body, "USER").map(user => ({ identifier: textOf(find(user, "IDENTIFIER")), alias: textOf(find(user, "ALIAS")), title: textOf(find(user, "TITLE")), type: textOf(find(user, "TYPE")), deleted: textOf(find(user, "DELETED")) }));
        const active = users.filter(user => user.alias && !/^(Y|true|1)$/i.test(user.deleted));
        return { registered: active.length > 0, title: active[0]?.title || "", aliases: active.map(user => user.alias) };
      });
    },
    async sendEInvoice({ xml, number, uuid, senderAlias = "", receiverAlias, senderVkn = "", receiverVkn = "" }) {
      if (!receiverAlias) throw new IntegratorError("Alıcının e-Fatura posta kutusu etiketi bilinmiyor; cari kartında Mükellef Sorgula ile alın.", { code: "integrator-alias", status: 400 });
      return withSession(async session => {
        const request = `<wsdl:SendInvoiceRequest>${header(session, { compressed: "Y" })}<SENDER vkn="${escapeXml(senderVkn)}" alias="${escapeXml(senderAlias)}"/><RECEIVER vkn="${escapeXml(receiverVkn)}" alias="${escapeXml(receiverAlias)}"/><INVOICE ID="${escapeXml(number)}" UUID="${escapeXml(uuid)}"><CONTENT>${zipBase64(`${number}.xml`, xml)}</CONTENT></INVOICE></wsdl:SendInvoiceRequest>`;
        const body = await call(PATHS.invoice, envelope("wsdl", NS.wsdl, request));
        assertOk(body, "e-Fatura gönderimi");
        return { status: "sent", message: "e-Fatura entegratöre teslim edildi; GİB yanıtı Durum Sorgula ile alınır.", reference: textOf(deep(body, "INVOICE_ID")) || number };
      });
    },
    async eInvoiceStatus(uuid) {
      return withSession(async session => {
        const body = await call(PATHS.invoice, envelope("wsdl", NS.wsdl, `<wsdl:GetInvoiceStatusRequest>${header(session)}<INVOICE UUID="${escapeXml(uuid)}"/></wsdl:GetInvoiceStatusRequest>`));
        assertOk(body, "Durum sorgusu");
        const status = deep(body, "INVOICE_STATUS");
        const read = name => textOf(find(status, name));
        return mapEInvoiceStatus({ status: read("STATUS"), description: read("STATUS_DESCRIPTION"), gibCode: read("GIB_STATUS_CODE"), gibDescription: read("GIB_STATUS_DESCRIPTION"), responseCode: read("RESPONSE_CODE"), responseDescription: read("RESPONSE_DESCRIPTION"), statusCode: read("STATUS_CODE") });
      });
    },
    async sendEArchive({ xml, number, email = "" }) {
      return withSession(async session => {
        const mail = email ? `${tag("EARSIV_EMAIL_FLAG", "Y")}${tag("EARSIV_EMAIL", email)}` : tag("EARSIV_EMAIL_FLAG", "N");
        const request = `<arc:ArchiveInvoiceExtendedRequest>${header(session, { compressed: "Y" })}<ArchiveInvoiceExtendedContent><INVOICE_PROPERTIES>${tag("EARSIV_FLAG", "Y")}<EARSIV_PROPERTIES>${tag("EARSIV_TYPE", "NORMAL")}${mail}${tag("SUB_STATUS", "NEW")}</EARSIV_PROPERTIES><INVOICE_CONTENT>${zipBase64(`${number}.xml`, xml)}</INVOICE_CONTENT></INVOICE_PROPERTIES></ArchiveInvoiceExtendedContent></arc:ArchiveInvoiceExtendedRequest>`;
        const body = await call(PATHS.archive, envelope("arc", NS.archive, request));
        assertOk(body, "e-Arşiv gönderimi");
        return { status: "sent", message: email ? `e-Arşiv fatura entegratöre iletildi; alıcıya ${email} adresine e-posta gönderilecek.` : "e-Arşiv fatura entegratöre iletildi.", reference: textOf(deep(body, "INVOICE_ID")) || number };
      });
    },
    async eArchiveStatus(uuid) {
      return withSession(async session => {
        const body = await call(PATHS.archive, envelope("arc", NS.archive, `<arc:GetEArchiveInvoiceStatusRequest>${header(session)}${tag("UUID", uuid)}</arc:GetEArchiveInvoiceStatusRequest>`));
        assertOk(body, "e-Arşiv durum sorgusu");
        const head = deep(deep(body, "INVOICE"), "HEADER");
        const status = textOf(find(head, "STATUS"));
        const description = textOf(find(head, "STATUS_DESC"));
        const text = `${status} ${description}`.toLocaleUpperCase("tr-TR");
        return { status: /İPTAL|IPTAL|CANCEL/.test(text) ? "cancelled" : /HATA|ERROR|FAIL/.test(text) ? "error" : status || description ? "sent" : "processing", message: [description || status, textOf(find(head, "EMAIL_STATUS_DESC"))].filter(Boolean).join(" · ") };
      });
    },
    async cancelEArchive({ uuid, number, date, total, note = "" }) {
      return withSession(async session => {
        const request = `<arc:CancelEArchiveInvoiceRequest>${header(session)}<CancelEArsivInvoiceContent>${tag("FATURA_UUID", uuid)}${tag("FATURA_ID", number)}${tag("IPTAL_TARIHI", date)}${tag("TOPLAM_TUTAR", Number(total || 0).toFixed(2))}${tag("IPTAL_NOTU", note)}</CancelEArsivInvoiceContent></arc:CancelEArchiveInvoiceRequest>`;
        const body = await call(PATHS.archive, envelope("arc", NS.archive, request));
        assertOk(body, "e-Arşiv iptali");
        return { status: "cancelled", message: "e-Arşiv fatura entegratörde iptal edildi." };
      });
    },
    // Gelen e-Faturalar (DIRECTION=IN). İçerik ZIP'li UBL-TR XML'dir.
    async inbox({ from, to, limit = 100, includeRead = false }) {
      return withSession(async session => {
        const key = `<INVOICE_SEARCH_KEY>${tag("LIMIT", limit)}${tag("START_DATE", from)}${tag("END_DATE", to)}${tag("READ_INCLUDED", includeRead ? "true" : "false")}${tag("DIRECTION", "IN")}</INVOICE_SEARCH_KEY>`;
        const body = await call(PATHS.invoice, envelope("wsdl", NS.wsdl, `<wsdl:GetInvoiceRequest>${header(session, { compressed: "Y" })}${key}${tag("HEADER_ONLY", "N")}</wsdl:GetInvoiceRequest>`));
        assertOk(body, "Gelen fatura listesi");
        return children(find(body, "GetInvoiceResponse") || body, "INVOICE").map(invoice => {
          const head = find(invoice, "HEADER");
          const read = name => textOf(find(head, name));
          const amount = find(head, "PAYABLE_AMOUNT");
          return {
            uuid: invoice.attrs.UUID || "",
            number: invoice.attrs.ID || "",
            senderVkn: read("SENDER"),
            senderName: read("SUPPLIER"),
            issueDate: read("ISSUE_DATE").slice(0, 10),
            payable: Number(textOf(amount)) || 0,
            currency: amount?.attrs?.currencyID || "TRY",
            profile: read("PROFILEID"),
            typeCode: read("INVOICE_TYPE_CODE"),
            status: read("STATUS_DESCRIPTION") || read("STATUS"),
            xml: textOf(find(invoice, "CONTENT")) ? unzipText(textOf(find(invoice, "CONTENT"))) : "",
          };
        });
      });
    },
    async markRead(uuids) {
      if (!uuids.length) return { ok: true };
      return withSession(async session => {
        const list = uuids.map(uuid => `<INVOICE UUID="${escapeXml(uuid)}"/>`).join("");
        const body = await call(PATHS.invoice, envelope("wsdl", NS.wsdl, `<wsdl:MarkInvoiceRequest>${header(session)}<MARK value="READ">${list}</MARK></wsdl:MarkInvoiceRequest>`));
        assertOk(body, "Okundu işareti");
        return { ok: true };
      });
    },
  };
}

// GİB/entegratör durum metni → program durumu. Entegratörün kendi açıklaması kullanıcıya olduğu gibi gösterilir.
export function mapEInvoiceStatus({ status = "", description = "", gibCode = "", gibDescription = "", responseCode = "", responseDescription = "", statusCode = "" }) {
  const text = `${status} ${description} ${gibDescription} ${responseCode} ${responseDescription} ${statusCode}`.toLocaleUpperCase("tr-TR");
  const message = [description || status, gibDescription, responseDescription].filter(Boolean).join(" · ");
  if (/RED|REJECT/.test(`${responseCode} ${responseDescription}`.toLocaleUpperCase("tr-TR"))) return { status: "rejected", message: message || "Alıcı faturayı reddetti." };
  if (/KABUL|ACCEPT/.test(`${responseCode} ${responseDescription}`.toLocaleUpperCase("tr-TR"))) return { status: "accepted", message: message || "Alıcı faturayı kabul etti." };
  if (/HATA|ERROR|FAIL|BAŞARISIZ|BASARISIZ/.test(text)) return { status: "error", message: message || "Belge GİB'de hata aldı." };
  if (String(gibCode) === "1300" || /BAŞARIYLA|BASARIYLA|SUCCEED|SUCCESS/.test(text)) return { status: "sent", message: message || "GİB'e başarıyla iletildi." };
  return { status: "processing", message: message || "Entegratörde işleniyor." };
}
