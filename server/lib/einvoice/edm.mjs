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
//
// e-SMM (2.4.4, iş listesi 20): EDM e-Serbest Meslek Makbuzu'nu AYRI bir uç noktadan sunar (ESmmEDM.svc; e-Fatura ile aynı kullanıcı
// adı/parola, ayrı oturum). Adres Entegratör Ayarları'ndaki e-Fatura servis adresinden türetilir (…/EFaturaEDM.svc → …/ESmmEDM.svc; test ve
// canlı aynı düzen — kullanıcı kararı 21.10.2026 (6)). Sözleşme EDM'nin GERÇEK test WSDL'idir (tools/ebelge/sema/edm/ESmmEDM-test-singleWsdl.xml,
// 22.10.2026; ad alanı http://tempuri.org/, SOAP 1.1). e-Fatura'dan farkları: SMM öğesinde ID ve UUID NİTELİK DEĞİL, ÇOCUK ÖĞEDİR (SMM'nin tek
// niteliği TRXID); gönderim SendSMM ile, UBL (ProfileID ESMM) SMM/CONTENT'te ve SMM_CONTENT_TYPE "XML" ile gider — EDM'nin C# örneğindeki
// SendSMMPrepared bugünkü sözleşmede YOK (kılavuz v4.4.1 §5.4 da UBL'yi SendSMM'e koyar); numarayı program verir (ID dolu gönderilir,
// INVOICESERIAL_REQUESTED / "ABC2009123456789" seri talebi kullanılmaz) — kronoloji, kopma ve belirsiz gönderim güvenceleri e-Fatura ile tek yerde.
import { createHash, randomUUID } from "node:crypto";
import { hostname } from "node:os";
import { readZip } from "../zip.mjs";
import { IntegratorError } from "./integrator-error.mjs";
import { E, fieldPaths, readWsdl, renderTree, shape, soapRequest } from "./soap-contract.mjs";
import { children, deep, deepAll, find, parseXml, textOf } from "./xml-lite.mjs";

export const EDM_URLS = Object.freeze({
  test: "https://test.edmbilisim.com.tr/EFaturaEDM21ea/EFaturaEDM.svc",
  live: "https://portal2.edmbilisim.com.tr/EFaturaEDM/EFaturaEDM.svc",
});
// EDM web portalı (e-Fatura / e-Arşiv arayüzü; 2.4.4 E7 "e-Fatura Portalı" düğmesi). SABİT liste: düğme yalnız bu iki adresten ortamınkini açar;
// adres Servis Adresi'nden ya da istemciden alınmaz. Kaynak: test portalı kullanıcının verdiği adres (20.10.2026), canlı portal edmbilisim.com.tr →
// Müşteri Girişi → "E-Fatura Portal Girişi" (kullanıcı ekranı, 20.10.2026). Giriş web servis kullanıcısıyla (kullanıcı teyidi); program giriş
// yapmaz, parola istemciye çıkmaz, Turnstile'a dokunulmaz.
export const EDM_PORTAL_URLS = Object.freeze({
  test: "https://test.edmbilisim.com.tr/EFaturaUI21ea/",
  live: "https://portal4.edmbilisim.com.tr/EFaturaUI/",
});
export const EDM_DEFAULT_NS = "http://schemas.i2i.com/ei/wsdl";
export const EDM_OPERATIONS = Object.freeze(["Login", "SendInvoice", "LoadInvoice", "GetInvoiceStatus", "GetInvoice", "CheckUser", "CancelInvoice", "MarkInvoice"]);
const APP = "DestekOfis";
// Yan etkisiz EDM işlemleri: bağlantı koparsa bir kez yinelenebilir (aynı istek ikinci kez işlense de sonuç değişmez). SendInvoice, LoadInvoice ve
// CancelInvoice burada YOK.
const SAFE_OPERATIONS = new Set(["Login", "CheckUser", "GetInvoiceStatus", "GetInvoice", "MarkInvoice"]);
// e-SMM servisi (ESmmEDM.svc): gerçek WSDL'in ad alanı (sözleşme okunamazsa varsayılan) ve programın kullandığı işlemler.
export const EDM_SMM_DEFAULT_NS = "http://tempuri.org/";
export const EDM_SMM_OPERATIONS = Object.freeze(["Login", "SendSMM", "GetSMMStatus", "GetSMM", "CancelSMM"]);
// e-SMM'de yan etkisiz işlemler. SendSMM, LoadSMM ve CancelSMM burada YOK (yinelenmez; belge "Sonucu Belirsiz" yoluna düşer).
const SMM_SAFE_OPERATIONS = new Set(["Login", "CheckUser", "GetSMMStatus", "GetSMM", "MarkSMM", "CheckCounter", "GetSessionInfo"]);
// e-SMM servis adresi e-Fatura servis adresinden: …/EFaturaEDM.svc → …/ESmmEDM.svc (büyük/küçük harf duyarsız; sorgu ve sondaki "/" atılır).
// Başka biçimdeki adresten tahmin yürütülmez: açık hata (integrator-url), ağa çıkılmaz.
export function esmmUrlOf(url) {
  const base = String(url || "").trim().replace(/\?.*$/, "").replace(/\/+$/, "");
  const match = /^(.*\/)EFaturaEDM\.svc$/i.exec(base);
  if (!match) throw new IntegratorError("e-SMM servis adresi Servis Adresi'nden türetilemedi: adres EDM'nin e-Fatura adresi gibi …/EFaturaEDM.svc ile bitmeli (Entegratör Ayarları → Servis Adresi'ni boş bırakın ya da EDM'nin verdiği adresi yazın).", { code: "integrator-url", status: 400 });
  return `${match[1]}ESmmEDM.svc`;
}
export const EDM_SMM_URLS = Object.freeze({ test: esmmUrlOf(EDM_URLS.test), live: esmmUrlOf(EDM_URLS.live) });
// Kopan bağlantı sınıfı (Node fetch / undici): ECONNRESET, EPIPE, UND_ERR_SOCKET ("other side closed"), "socket hang up".
const connectionReset = error => /ECONNRESET|EPIPE|UND_ERR_SOCKET/.test(`${error?.cause?.code || ""} ${error?.code || ""}`) || /other side closed|socket hang up/i.test(`${error?.cause?.message || ""} ${error?.message || ""}`);
// Dar kontrol 2 (2.4.3, B2): bağlantı HİÇ KURULAMADI (istek EDM'ye kesin ulaşmadı) sınıfı — ad çözülemedi, bağlantı reddedildi, ağ/ana makine
// yok, bağlanma zaman aşımı, TLS kurulamadı. Yalnız bunlar (ve yan etkisiz işlemin yinelemeden sonra da düşmesi) "integrator-unreachable"dır;
// istek gönderildikten sonraki kopma / yanıt zaman aşımı "integrator-uncertain" (EDM işlemiş olabilir; belge belirsiz yoluyla işlenir, tur sürer).
const NOT_CONNECTED = /^(ECONNREFUSED|ENOTFOUND|EAI_AGAIN|EAI_NONAME|EAI_FAIL|EHOSTUNREACH|EHOSTDOWN|ENETUNREACH|ENETDOWN|EADDRNOTAVAIL|UND_ERR_CONNECT_TIMEOUT|EPROTO|ERR_TLS_\w+|ERR_SSL_\w+|CERT_\w+|UNABLE_TO_\w+|DEPTH_ZERO_SELF_SIGNED_CERT|SELF_SIGNED_CERT_IN_CHAIN|ERR_INVALID_URL)$/;
// Dar kontrol 3 (2.4.3, B-1): vekil sunucu hatası (lib/net-proxy.mjs ProxyError) — vekile bağlanılamadı (proxy-unreachable), vekil tüneli reddetti
// (proxy-refused) ya da kimlik istedi (proxy-auth, 407): tünel/istek EDM'ye HİÇ iletilmedi → "kesin ulaşmadı". (Önceden bu kodlar tanınmıyor, belge
// "belirsiz" sayılıp verilen numara geri bırakılmıyordu — kâhin K12.) proxy-request (tünel kurulduktan sonraki hata) ve proxy-redirects (yanıt geldi)
// bu sınıfta DEĞİL: istek EDM'ye ulaşmış olabilir.
const PROXY_NOT_CONNECTED = new Set(["proxy-unreachable", "proxy-refused", "proxy-auth"]);
const notConnected = error => {
  const codes = [error?.cause?.code, error?.code, error?.cause?.cause?.code].filter(Boolean).map(String);
  return codes.some(code => NOT_CONNECTED.test(code) || PROXY_NOT_CONNECTED.has(code));
};
const CONTRACT_TTL = 12 * 60 * 60 * 1000;
// Dar kontrol 2 (2.4.3, B6): WSDL okunamadıysa varsayılan sözleşme en çok 1 dk tutulur (ağ yoksa hiç tutulmaz); önceden 12 saat.
const CONTRACT_FAIL_TTL = 60 * 1000;
const SESSION_TTL = 20 * 60 * 1000;
const sessions = new Map();
// 2.4.4 (iş listesi 24b, N4 — gerçek EDM test ortamı 22.10.2026, docs/kanit/2026-10-22/244-edm-eszamanli): oturum önbelleği boşken 20 eşzamanlı gönderim 20 ayrı
// giriş yaptı (en çok 18 aynı anda) ve EDM birini "The caller was not authenticated by the service." ile reddetti — aynı kimlikle 19 giriş başarılıyken belge
// "kullanıcı adı/parola" iletisiyle Gönderilecekler'e düştü. TEK UÇUŞ: oturum anahtarı başına en çok bir giriş sürer; o sırada gelen her çağıran (oturum
// isteyen işlem, numara öncesi erişim denetimi, Bağlantıyı Test Et) aynı girişi bekler. Giriş bitince (başarılı ya da değil) kayıt silinir: başarısızlık bütün
// bekleyenlere aynı hatayla döner (numara ancak giriş başarılıysa verilir — B3), sonraki çağrı yeniden dener.
const logins = new Map();
const contracts = new Map();
// Dar kontrol 2.4.3 (kâhin BEKLENEN-AG): EDM'den son yanıt alınan an (oturum anahtarı başına). Önbellekteki oturum ağın hâlâ açık olduğunu
// göstermez; numara vermeden önceki denetim (ensureSession) son yanıt eskiyse EDM'ye gerçekten ulaşır.
// Dar kontrol 2 (2.4.3, B3): geçerli oturum + son 5 dk içinde EDM'den yanıt = erişim kanıtı; numara vermeden önce yeniden giriş yapılmaz. Bağlantı
// hatası (ulaşılamadı / koptu) kanıtı siler: sonraki denetim EDM'ye gerçekten ulaşır.
const contacts = new Map();
const CONTACT_FRESH_MS = 5 * 60 * 1000;

// EDM belge durumları (docs: e-Fatura / e-Arşiv Durumları) → program durumu + Türkçe açıklama.
const EDM_STATES = Object.freeze({
  "PACKAGE-PROCESSING": ["processing", "EDM'de paketleniyor."],
  "PACKAGE-FAIL": ["error", "Paketleme hatası: belgeyi düzeltip aynı numarayla yeniden gönderin."],
  "PACKAGE-FAILED": ["error", "Paketleme hatası: belgeyi düzeltip aynı numarayla yeniden gönderin."],
  "LOAD-SUCCEED": ["draft", "Taslak olarak EDM portalına yüklendi; gönderilmeyi bekliyor (EDM portalından ya da programdan Gönder)."],
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
// e-SMM durumları (EDM "e-SMM WebServis durum kodları ve açıklamaları" tablosu, kullanıcının yüklediği xlsx, 21.10.2026). e-Fatura'dan farkları:
// alıcının kabul/red yanıtı YOK (e-SMM e-Arşiv gibi; SEND-SUCCEED son durumdur); PACKAGE-FAIL'de EDM'nin yönergesi "SMM iptal edilir ve tekrar
// gönderilir" (e-Fatura'da "aynı numarayla yeniden gönder"); LOAD-FAIL "taslak yüklendi ama gönderime uygun değil".
const ESMM_STATES = Object.freeze({
  "LOAD-SUCCEED": ["draft", "Taslak olarak EDM'ye yüklendi; gönderilmeyi bekliyor."],
  "LOAD-FAIL": ["error", "Taslak yüklendi ancak makbuz gönderime uygun değil: makbuzu düzeltip yeniden gönderin."],
  "SEND-PROCESSING": ["processing", "Gönderiliyor; sonuç bekleniyor."],
  "SEND-WAIT_GIB_RESPONSE": ["processing", "GİB yanıtı bekleniyor."],
  "SEND-WAIT_SYSTEM_RESPONSE": ["processing", "EDM sisteminin yanıtı bekleniyor."],
  "UNKNOWN-UNKNOWN": ["processing", "Durum henüz belli değil; biraz sonra yeniden sorgulayın."],
  "SEND-FAILED": ["error", "Gönderim başarısız: makbuzu düzeltip aynı numarayla yeniden gönderin."],
  "SEND-SUCCEED": ["sent", "e-SMM oluşturuldu; alıcının e-posta adresi verildiyse e-postayla gönderildi."],
  "CANCELLED-SUCCEED": ["cancelled", "e-SMM EDM'de iptal edildi."],
  "CANCEL-SUCCEED": ["cancelled", "e-SMM EDM'de iptal edildi."],
  "PACKAGE-PROCESSING": ["processing", "EDM'de paketleniyor."],
  // Program numarayı kendiliğinden değiştirmez (e-Fatura / e-Arşiv'deki kural: "Hata"daki belge aynı numarayla yeniden gönderilir; yeni numara ancak
  // belge iptal edilip yeniden kesilince — iş listesi 22): EDM'nin yönergesi İptal Et + Kopyala ile uygulanır.
  "PACKAGE-FAIL": ["error", "Paketleme hatası: EDM'nin yönergesine göre makbuz iptal edilip yeniden gönderilir — İptal Et ile iptal edin, Kopyala ile yeniden kesin (yeni numara alır)."],
  "PACKAGE-FAILED": ["error", "Paketleme hatası: EDM'nin yönergesine göre makbuz iptal edilip yeniden gönderilir — İptal Et ile iptal edin, Kopyala ile yeniden kesin (yeni numara alır)."],
});
export function mapEdmStatus({ status = "", description = "", gibCode = "", gibDescription = "", responseCode = "", responseDescription = "", earchive = false, esmm = false }) {
  const normalized = String(status).replace(/\s+/g, "").toUpperCase();
  const extra = [description && description !== status ? description : "", gibDescription, responseDescription].filter(Boolean).join(" · ");
  // Gerçek EDM test ortamı (16.10.2026, docs/kanit/2026-10-16/edm-arayuz): alıcının posta kutusu da aynı hesaptaysa (kendine gönderim) EDM giden
  // belgenin durumunu alıcı tarafından da verebiliyor ("RECEIVE - WAIT_APPLICATION_RESPONSE"); program bunu "işleniyor"da bırakıyordu. Alıcı
  // tarafının durumu belgenin alıcıya ulaştığını gösterir: gönderen tarafın karşılığıyla aynı eşlenir.
  const table = esmm ? ESMM_STATES : EDM_STATES;
  const known = table[normalized] || (normalized.startsWith("RECEIVE-") ? table[`SEND-${normalized.slice(8)}`] : undefined);
  const response = `${responseCode} ${responseDescription}`.toLocaleUpperCase("tr-TR");
  const noun = esmm ? "Makbuz" : "Fatura";
  let state;
  let text;
  if (known) [state, text] = known;
  else if (/CANCEL/.test(normalized)) [state, text] = ["cancelled", `${noun} EDM'de iptal edildi.`];
  else if (/FAIL|ERROR/.test(normalized)) [state, text] = ["error", "Belge hata aldı."];
  else if (/SUCCEED/.test(normalized)) [state, text] = ["sent", "İşlem tamamlandı."];
  else [state, text] = ["processing", "EDM'de işleniyor."];
  // e-SMM'de alıcı yanıtı (kabul/red) yoktur: yanıt alanındaki metin durumu değiştirmez.
  if (!esmm && state === "sent" && /RED|REJECT/.test(response)) [state, text] = ["rejected", "Alıcı faturayı reddetti."];
  else if (!esmm && state === "sent" && /KABUL|ACCEPT/.test(response)) [state, text] = ["accepted", "Alıcı faturayı kabul etti."];
  if (earchive && normalized === "SEND-SUCCEED") text = "e-Arşiv fatura oluşturuldu; alıcının e-posta adresi varsa gönderildi.";
  return { status: state, message: [text, extra].filter(Boolean).join(" "), raw: String(status).trim(), gibCode: String(gibCode || "") };
}

// Belge türü ↔ gönderim kanalı (16.10.2026, gerçek EDM test ortamı): e-Arşiv profilli belge e-Fatura kanalından (posta kutusu etiketiyle)
// gönderilince EDM kabul edip GİB reddetti (SEND-FAILED). Uyuşmazlık isteğe dönüşmeden reddedilir.
function assertChannel(xml, earchive) {
  const profile = (String(xml || "").match(/<cbc:ProfileID>([^<]*)<\/cbc:ProfileID>/) || [])[1] || "";
  if (!profile) return;
  if (profile === "ESMM") throw new IntegratorError("e-SMM (ProfileID ESMM) e-Fatura servisinden gönderilmez; belge gönderilmedi.", { code: "integrator-channel", status: 400 });
  if ((profile === "EARSIVFATURA") !== Boolean(earchive)) throw new IntegratorError(`Belge türü (${profile}) ile gönderim kanalı (${earchive ? "e-Arşiv" : "e-Fatura"}) uyuşmuyor; belge gönderilmedi.`, { code: "integrator-channel", status: 400 });
}
// e-SMM servisine yalnız ProfileID'si ESMM olan, numarası ve ETTN'si zarftakiyle AYNI belge gider (zarfta ID/UUID ayrı öğe: içerikle ayrışırsa
// EDM'de bir numarayla kayıtlı, GİB'e başka numarayla raporlanan makbuz oluşabilirdi). Uyuşmazlık isteğe dönüşmeden reddedilir.
function assertSmmDocument(xml, { number, uuid }) {
  const text = String(xml || "");
  const read = name => (text.match(new RegExp(`<cbc:${name}>([^<]*)</cbc:${name}>`)) || [])[1] || "";
  const profile = read("ProfileID");
  if (profile !== "ESMM") throw new IntegratorError(`Belge türü (${profile || "yok"}) e-SMM değil; e-SMM servisine yalnız ProfileID ESMM olan makbuz gider. Belge gönderilmedi.`, { code: "integrator-channel", status: 400 });
  if (!number || !uuid || read("ID") !== number || read("UUID").toLowerCase() !== String(uuid).toLowerCase()) throw new IntegratorError("e-SMM belgesindeki numara ya da ETTN gönderim bilgisiyle uyuşmuyor; belge gönderilmedi.", { code: "integrator-channel", status: 400 });
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

// Ortak taşıma katmanı (2.4.4): HTTP + hata sınıflaması (B2/B3), sözleşme (WSDL) önbelleği, SOAP çağrısı, istek başlığı, giriş ve oturum. e-Fatura
// (EFaturaEDM.svc) ve e-SMM (ESmmEDM.svc) istemcileri aynı katmanı kullanır; farkları yalnız varsayılan ad alanı (WSDL okunamazsa) ve yinelenebilir
// (yan etkisiz) işlem listesidir. Oturum, sözleşme ve "son EDM yanıtı" kayıtları servis adresine göre ayrıdır: e-Fatura oturumu e-SMM için erişim
// kanıtı sayılmaz (ayrı uç nokta).
function edmTransport({ baseUrl, username, password, env = "", fetchImpl = (...args) => globalThis.fetch(...args), timeoutMs = 45_000, useWsdl = true, appName = APP, defaultNs = EDM_DEFAULT_NS, safeOperations = SAFE_OPERATIONS }) {
  const base = String(baseUrl || "").trim().replace(/\/+$/, "").replace(/\?.*$/, "");
  if (!/^https:\/\//i.test(base) && !/^http:\/\/(127\.0\.0\.1|localhost)(:\d+)?\//i.test(`${base}/`)) throw new IntegratorError("EDM servis adresi https:// ile başlamalı.", { code: "integrator-url", status: 400 });
  if (!username || !password) throw new IntegratorError("EDM web servis kullanıcı adı ve parolası girilmemiş (Fatura → Entegratör Ayarları).", { code: "integrator-credentials", status: 400 });
  // Aynı kimlik bilgisi: parola değişince eski oturum erişim kanıtı sayılmaz (anahtarda parolanın özeti; parola bellekte de açık tutulmaz).
  const sessionKey = `${base}|${username}|${createHash("sha256").update(String(password)).digest("hex").slice(0, 16)}`;

  async function http(url, { method = "GET", headers = {}, body } = {}, wait = timeoutMs, { retry = false } = {}) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), wait);
    try {
      let response;
      try {
        response = await fetchImpl(url, { method, headers, body, signal: controller.signal });
      } catch (error) {
        // 2.4.3 (hız testi H4): yükte "EDM'ye bağlanılamadı: UND_ERR_SOCKET" — istemci, karşı tarafın boşta kapattığı keep-alive bağlantısını yeniden
        // kullanmış (zorla üretme test/ebelge-243-baglanti.test.mjs). Yalnız YAN ETKİSİZ çağrı (giriş, sözleşme, mükellef sorgusu, durum, belge görüntüsü,
        // okundu işareti) yeni bağlantıyla bir kez hemen yinelenir. Gönderim / taslak yükleme / iptal YİNELENMEZ: istek karşıya ulaşmış olabilir, belge
        // "Sonucu Belirsiz" kalır ve önce durum sorulur (güncelleyicideki düzeltmenin aynı sınıfı: server/lib/updater.mjs request()).
        if (!retry || controller.signal.aborted || !connectionReset(error)) throw error;
        response = await fetchImpl(url, { method, headers, body, signal: controller.signal });
      }
      return { status: response.status, ok: response.ok, text: await response.text() };
    } catch (error) {
      contacts.delete(sessionKey);
      const timeout = error?.name === "AbortError";
      // B2: yan etkisiz işlem (retry) yinelemeden sonra da düştüyse EDM şu an kullanılamıyor (yan etkisi yok → ulaşılamadı). Yan etkili işlemde
      // (gönderim, taslak, iptal) yalnız bağlantının hiç kurulamadığı kesinse "ulaşılamadı"; değilse "belirsiz".
      const definite = retry || notConnected(error);
      // 2.4.3 (uzman UX14): kullanıcı iletisinde teknik kod (UND_ERR_SOCKET, ECONNREFUSED…) yazmaz; kod `detail`te kalır (yanıtta ve işlem
      // geçmişinde — invoice.e.send-failed kaydı) tanı için okunur.
      const detail = String(error?.cause?.code || error?.code || error?.message || error || "").slice(0, 200);
      // Vekil sunucu hatası programın kendi Türkçe iletisini taşır ("Vekil sunucuya bağlanılamadı (adres): KOD"); ileti korunur, sondaki kod atılır.
      const proxy = [error, error?.cause].find(item => PROXY_NOT_CONNECTED.has(item?.code));
      const proxyText = proxy ? String(proxy.message || "").replace(/:\s*[A-Z][A-Z0-9_]+$/, "").trim().replace(/\.+$/, "") : "";
      if (definite) throw new IntegratorError(timeout ? "EDM yanıt vermedi (zaman aşımı). İnternet bağlantısını ve servis adresini kontrol edin; birazdan yeniden deneyin." : proxyText ? `EDM'ye bağlanılamadı: ${proxyText}. Ağ ayarındaki vekil sunucu adresini kontrol edin.` : "EDM'ye bağlanılamadı. İnternet bağlantısını ve servis adresini kontrol edin; birazdan yeniden deneyin.", { code: "integrator-unreachable", detail });
      throw new IntegratorError(timeout ? "EDM yanıt vermedi (zaman aşımı); istek EDM'ye ulaşmış olabilir." : "EDM ile bağlantı istek gönderildikten sonra koptu; istek EDM'ye ulaşmış olabilir.", { code: "integrator-uncertain", detail });
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
      let response = await http(`${base}?singleWsdl`, {}, 20_000, { retry: true });
      if (!response.ok || !/definitions/.test(response.text)) response = await http(`${base}?wsdl`, {}, 20_000, { retry: true });
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
          const xsd = await http(url.href, {}, 20_000, { retry: true });
          if (xsd.ok) parts.push(xsd.text.replace(/<\?xml[^>]*\?>/, ""));
        }
        text = text.replace(/<((\w+:)?types)\s*>([\s\S]*?)<\/\1>/, (_, tag, __, inner) => `<${tag}>${inner}${parts.join("")}</${tag}>`);
      }
      entry = { contract: readWsdl(text), source: "wsdl", error: "", at: Date.now() };
    } catch (error) {
      entry = { contract: null, source: "default", error: error instanceof IntegratorError ? error.message : `WSDL okunamadı: ${error?.message || error}`, at: Date.now() - CONTRACT_TTL + CONTRACT_FAIL_TTL };
      // B6: bağlantı hatası (ağ yok) önbelleğe yazılmaz — ağ gelince ilk çağrı sözleşmeyi yeniden okur (önceden 12 saat varsayılan sözleşmeyle
      // gidiliyordu). WSDL adresi yanıt verip okunamadıysa (HTTP hatası, bozuk belge) 1 dk tutulur: her çağrıda yeniden istenmez.
      if (error instanceof IntegratorError && error.code === "integrator-unreachable") return entry;
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
    const shaped = shape(contract, operation, payload, { defaultNs });
    if (shaped.warnings.length) throw new IntegratorError(`EDM sözleşmesi programın gönderdiği alanla uyuşmuyor (${shaped.warnings.join(", ")}). İstek gönderilmedi. Entegratör Ayarları'nda Bağlantıyı Test Et'in sonucunu destek hattına iletin.`, { code: "integrator-contract", status: 409, detail: shaped.warnings.join(", ") });
    const action = contract?.operations?.[operation]?.action ?? "";
    const endpoint = endpointOf(contract);
    const request = soapRequest({ version: contract?.version || "1.1", action, body: renderTree(shaped.tree), addressing: contract?.addressing, to: endpoint });
    const response = await http(endpoint, { method: "POST", headers: request.headers, body: request.xml }, wait, { retry: safeOperations.has(operation) });
    contacts.set(sessionKey, Date.now());
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

  // 2.4.1: canlı adreste test hesabıyla giriş "Kullanıcı Bulunamadı! (EDM hata kodu 11010)" döner (docs/kanit/2026-10-16/canli-kart);
  // EDM'nin iletisi kalır, sonuna seçili ortamın hangi hesabı istediği eklenir.
  const LOGIN_HINT = { live: "Canlı Ortam'da EDM'nin canlı hesabının kullanıcı adı ve parolası girilir (test hesabı canlıda geçmez).", test: "Test Ortamı'nda EDM'nin test hesabının kullanıcı adı ve parolası girilir (canlı hesap testte geçmez)." }[env] || "";
  async function login() {
    let body;
    try {
      body = await call("Login", E("LoginRequest", [header("-1"), E("USER_NAME", username), E("PASSWORD", password)]));
    } catch (error) {
      if (LOGIN_HINT && error instanceof IntegratorError && error.code === "integrator-rejected") error.message = `${error.message}${/[.!?]$/.test(error.message) ? "" : "."} ${LOGIN_HINT}`;
      // Dar kontrol 2.4.3 (ek 1): hatanın giriş adımında olduğu işaretlenir — "EDM isteği reddetti" girişte ise belge değil hesap reddedilmiştir.
      if (error instanceof IntegratorError) error.stage = "login";
      throw error;
    }
    const session = textOf(deep(body, "SESSION_ID"));
    if (!session) throw Object.assign(new IntegratorError("EDM oturum anahtarı vermedi; kullanıcı adı ya da parola yanlış olabilir.", { code: "integrator-login" }), { stage: "login" });
    sessions.set(sessionKey, { id: session, at: Date.now() });
    return session;
  }
  // Tek uçuş giriş (N4): bu anahtarın süren girişi varsa onu bekler, yoksa başlatır.
  function sharedLogin() {
    const pending = logins.get(sessionKey);
    if (pending) return pending;
    const started = login().finally(() => {
      if (logins.get(sessionKey) === started) logins.delete(sessionKey);
    });
    logins.set(sessionKey, started);
    return started;
  }
  async function withSession(work) {
    const cached = sessions.get(sessionKey);
    let session = cached && Date.now() - cached.at < SESSION_TTL ? cached.id : await sharedLogin();
    try {
      return await work(session);
    } catch (error) {
      if (!error?.sessionExpired) throw error;
      // N4: önbellek YALNIZ hata veren oturumu tutuyorsa silinip yeniden girilir; başka çağıranın daha yeni geçerli oturumu varsa girişsiz o kullanılır (tek
      // oturumlu EDM'de eşzamanlı yeniden girişler birbirini düşürmesin). Süren giriş varsa onu bekler.
      const now = sessions.get(sessionKey);
      if (now && now.id !== session && Date.now() - now.at < SESSION_TTL) session = now.id;
      else {
        if (now?.id === session) sessions.delete(sessionKey);
        session = await sharedLogin();
      }
      return work(session);
    }
  }
  const touch = () => {
    const cached = sessions.get(sessionKey);
    if (cached) cached.at = Date.now();
  };
  // Dar kontrol 2.4.3 (ek 1): oturum (geçerli önbellekte yoksa giriş). Numara ancak giriş başarılıysa verilir.
  // Dar kontrol 2 (B3): önbellekteki oturum geçerli (aynı adres, kullanıcı adı ve parola) VE EDM'den son 5 dk içinde yanıt alındıysa (ve o
  // zamandan beri bağlantı hatası olmadıysa) ağa çıkılmaz; değilse yeniden giriş yapılır (erişim + hesap denetimi). Önceden her çağıran
  // `since: şimdi` veriyordu: her tekil gönderimde fazladan giriş.
  async function ensureSession() {
    const cached = sessions.get(sessionKey);
    if (cached && Date.now() - cached.at < SESSION_TTL && Date.now() - (contacts.get(sessionKey) || 0) < CONTACT_FRESH_MS) return;
    // N4: süren giriş varsa (erişim + hesap denetimini o yapıyor) beklenir; yoksa önbellek atılıp tek uçuş giriş.
    if (!logins.has(sessionKey)) sessions.delete(sessionKey);
    await sharedLogin();
  }
  // Sözleşme raporu: hangi işlemler var, hangileri eksik (operations: programın bu serviste kullandığı işlemler).
  async function contractReport({ refresh = false, operations = [] } = {}) {
    const entry = await loadContract({ refresh });
    const contract = entry.contract;
    return {
      entry,
      report: {
        source: entry.source,
        error: entry.error,
        namespace: contract ? Object.values(contract.operations).find(op => op.input)?.input.ns || contract.targetNamespace : defaultNs,
        soap: contract?.version || "1.1",
        endpoint: endpointOf(contract),
        operations: contract ? Object.keys(contract.operations).sort() : [],
        missing: contract ? operations.filter(name => !contract.operations[name]) : [],
      },
    };
  }
  // Bağlantı testi: sözleşme yeniden okunur, oturum önbelleği atılıp gerçek giriş yapılır.
  async function test(report, intro = "EDM'ye giriş yapıldı; bağlantı çalışıyor.") {
    // N4: o sırada süren giriş varsa (ör. aynı anda gönderim) gerçek giriştir, beklenir; ikinci giriş yapılmaz.
    if (!logins.has(sessionKey)) sessions.delete(sessionKey);
    await sharedLogin();
    const parts = [intro];
    parts.push(report.source === "wsdl" ? `Servis sözleşmesi (WSDL) okundu: SOAP ${report.soap}, ${report.operations.length} işlem.` : `Servis sözleşmesi okunamadı (${report.error}); varsayılan sözleşmeyle çalışılıyor.`);
    if (report.missing.length) parts.push(`Sözleşmede bulunmayan işlemler: ${report.missing.join(", ")}.`);
    return { ok: true, message: parts.join(" "), contract: report };
  }
  return { base, call, header, withSession, touch, ensureSession, contractReport, test };
}

/**
 * e-Fatura / e-Arşiv istemcisi (EFaturaEDM.svc).
 * @param {{ baseUrl: string, username: string, password: string, env?: "test"|"live", fetchImpl?: Function, timeoutMs?: number, useWsdl?: boolean, appName?: string }} options
 */
export function createEdmClient(options) {
  const { base, call, header, withSession, touch, ensureSession, contractReport: report, test } = edmTransport({ ...options, defaultNs: EDM_DEFAULT_NS, safeOperations: SAFE_OPERATIONS });

  // ---------- İşlemler ----------
  async function contractReport({ refresh = false } = {}) {
    const { entry, report: out } = await report({ refresh, operations: EDM_OPERATIONS });
    return { ...out, earchiveHeader: entry.contract ? fieldPaths(entry.contract, "SendInvoice").includes("INVOICE/HEADER/EARCHIVE") : false };
  }

  return {
    endpoint: base,
    contractReport,
    ensureSession,
    async test() {
      return test(await contractReport({ refresh: true }));
    },
    // GİB e-Fatura kullanıcısı mı? Posta kutusu (PK) etiketleri (alıcı olarak) döner.
    async checkUser(taxNo) {
      return withSession(async session => {
        // Gerçek EDM sözleşmesi (16.10.2026, tools/ebelge/sema/edm): CheckUserRequest yalnız USER (GIBUSER) taşır; belge türü USER içindeki
        // DOCUMENTTYPE'tır ve EDM'nin C# istemcisi onu da göndermez → yalnız IDENTIFIER (önceden sözleşmede olmayan DOCUMENT_TYPE kardeş alanı
        // gönderilmek istendiği için istek hiç yapılmıyordu). Fatura dışı etiketler yanıttaki DOCUMENTTYPE ile ayıklanır.
        const body = await call("CheckUser", E("CheckUserRequest", [header(session), E("USER", [E("IDENTIFIER", taxNo)])]), { session });
        touch();
        const users = deepAll(body, "USER").map(user => ({
          identifier: textOf(find(user, "IDENTIFIER")),
          alias: textOf(find(user, "ALIAS")),
          title: textOf(find(user, "TITLE")),
          type: textOf(find(user, "TYPE")),
          unit: textOf(find(user, "UNIT")).toUpperCase(),
          deleted: textOf(find(user, "DELETED")) || textOf(find(user, "ALIAS_REMOVAL_TIME")) || textOf(find(user, "ALIAS_DELETION_TIME")),
          documentType: (textOf(find(user, "DOCUMENTTYPE")) || textOf(find(user, "DOCUMENT_TYPE"))).toUpperCase(),
        }));
        // Yalnız urn:mail etiketleri (gerçek EDM test yanıtında GB listesinde "erreceipt" gibi etiket olmayan değer de geliyor).
        const active = users.filter(user => /^urn:mail:/i.test(user.alias) && !/^(Y|E|TRUE|1)$/i.test(user.deleted) && !(user.deleted && /\d{4}/.test(user.deleted)) && (!user.documentType || user.documentType === "INVOICE"));
        const inboxes = active.filter(user => user.unit ? user.unit === "PK" : !/defaultgb|:gb@|gb@/i.test(user.alias));
        // senderAliases: gönderici birim (GB) etiketleri — firmanın kendi VKN'si sorgulanınca Entegratör Ayarları'nda GB listesi olur.
        const senders = active.filter(user => (user.unit ? user.unit === "GB" : /defaultgb|:gb@|gb@/i.test(user.alias)));
        return { registered: inboxes.length > 0, title: inboxes[0]?.title || active[0]?.title || "", aliases: [...new Set(inboxes.map(user => user.alias))], senderAliases: [...new Set(senders.map(user => user.alias))], type: inboxes[0]?.type || "" };
      });
    },
    // e-Fatura ve e-Arşiv ikisi de SendInvoice ile gider; EDM belge türünü UBL'deki ProfileID'den anlar. Sözleşmede
    // INVOICE/HEADER/EARCHIVE alanı varsa e-Arşiv işareti de konur.
    async send({ xml, number, uuid, earchive = false, senderVkn = "", senderAlias = "", receiverVkn = "", receiverAlias = "" }) {
      assertChannel(xml, earchive);
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
    // Portala taslak (Wolvox karşılaştırması, kullanıcı kararı 16.10.2026, isteğe bağlı): LoadInvoice belgeyi gönderilmeden EDM'ye
    // taslak olarak yükler (EDM Web API v4.2.1 §5.3); numarayı program verir (GENERATEINVOICEIDONLOAD=false). Taslak sonra EDM
    // portalından ya da sendDraft ile (SendInvoice: CONTENT boş + UUID, §5.4) gönderilir.
    async loadDraft({ xml, number, uuid, earchive = false, senderVkn = "", senderAlias = "", receiverVkn = "", receiverAlias = "" }) {
      assertChannel(xml, earchive);
      if (!earchive && !receiverAlias) throw new IntegratorError("Alıcının e-Fatura posta kutusu etiketi bilinmiyor; cari kartında Mükellef Sorgula ile alın.", { code: "integrator-alias", status: 400 });
      return withSession(async session => {
        const invoice = E("INVOICE", [E("HEADER", earchive ? [E("EARCHIVE", "true", {}, { optional: true })] : [], {}, { optional: true }), E("CONTENT", base64Text(xml))], { ID: number, UUID: uuid });
        const request = E("LoadInvoiceRequest", [header(session), invoice, E("SENDER", "", { vkn: senderVkn, alias: senderAlias }), E("RECEIVER", "", { vkn: receiverVkn, alias: earchive ? "" : receiverAlias }), E("GENERATEINVOICEIDONLOAD", "false")]);
        const body = await call("LoadInvoice", request, { session, wait: 90_000 });
        touch();
        const loaded = deepAll(body, "INVOICE")[0];
        return {
          status: "draft",
          message: "Taslak olarak EDM portalına yüklendi; EDM portalından ya da programdan Taslağı Gönder ile gönderilir.",
          reference: loaded?.attrs?.ID || textOf(find(loaded, "ID")) || number,
          uuid: loaded?.attrs?.UUID || textOf(find(loaded, "UUID")) || uuid,
        };
      });
    },
    async sendDraft({ number, uuid, earchive = false, senderVkn = "", senderAlias = "", receiverVkn = "", receiverAlias = "" }) {
      return withSession(async session => {
        const invoice = E("INVOICE", [E("HEADER", earchive ? [E("EARCHIVE", "true", {}, { optional: true })] : [], {}, { optional: true })], { ID: number, UUID: uuid });
        const request = E("SendInvoiceRequest", [header(session), E("SENDER", "", { vkn: senderVkn, alias: senderAlias }), E("RECEIVER", "", { vkn: receiverVkn, alias: earchive ? "" : receiverAlias }), invoice]);
        const body = await call("SendInvoice", request, { session, wait: 90_000 });
        touch();
        const sent = deepAll(body, "INVOICE")[0];
        return {
          status: "sent",
          message: earchive ? "Taslak e-Arşiv fatura gönderildi; sonucu Durum Sorgula ile görün." : "Taslak e-Fatura gönderildi; GİB ve alıcı yanıtı Durum Sorgula ile alınır.",
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
        // 2.4.4 (31d E1): yanıttaki ETTN (INVOICE_STATUS, tns:INVOICE'tan türer: UUID niteliği) — 11048'de "bu belge mi" denetimi için; yoksa "".
        return { ...mapEdmStatus({ status: read("STATUS"), description: read("STATUS_DESCRIPTION"), gibCode: read("GIB_STATUS_CODE"), gibDescription: read("GIB_STATUS_DESCRIPTION"), responseCode: read("RESPONSE_CODE"), responseDescription: read("RESPONSE_DESCRIPTION"), earchive }), uuid: String(status?.attrs?.UUID || read("UUID") || "") };
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
    // Gönderilen belgenin RESMÎ görüntüsü (16.10.2026): entegratörün belgeden (gömülü görünüm şablonuyla) ürettiği PDF — alıcının ve GİB'in
    // gördüğü sayfa. GetInvoice, giden yön (DIRECTION=OUT), ETTN ile; içerik base64 PDF (ZIP'liyse içindeki .pdf).
    async officialPdf({ uuid, number = "" }) {
      return withSession(async session => {
        const key = E("INVOICE_SEARCH_KEY", [E("LIMIT", 1), E("UUID", uuid), E("DIRECTION", "OUT")]);
        const body = await call("GetInvoice", E("GetInvoiceRequest", [header(session), key, E("HEADER_ONLY", "N"), E("INVOICE_CONTENT_TYPE", "PDF")]), { session, wait: 120_000 });
        touch();
        const invoice = children(find(body, "GetInvoiceResponse") || deep(body, "GetInvoiceResponse") || body, "INVOICE").find(item => (item.attrs.UUID || textOf(find(item, "UUID"))).toLowerCase() === String(uuid).toLowerCase());
        if (!invoice) throw new IntegratorError(`${number || uuid} EDM'de bulunamadı (belge henüz işlenmemiş olabilir; birkaç dakika sonra yeniden deneyin).`, { code: "integrator-not-found", status: 404 });
        let data = Buffer.from(textOf(find(invoice, "CONTENT")).replace(/\s+/g, ""), "base64");
        if (data.length > 4 && data.readUInt32LE(0) === 0x04034b50) data = (readZip(data).find(item => !item.directory && /\.pdf$/i.test(item.name)) || {}).data || Buffer.alloc(0);
        if (data.subarray(0, 5).toString("latin1") !== "%PDF-") throw new IntegratorError(`EDM ${number || uuid} için PDF görüntüsü vermedi (görüntü henüz hazır olmayabilir; birkaç dakika sonra yeniden deneyin).`, { code: "integrator-no-pdf", status: 409 });
        return { data, mime: "application/pdf" };
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

/**
 * e-SMM istemcisi (ESmmEDM.svc; 2.4.4, iş listesi 20). baseUrl e-SMM servisinin adresidir (esmmUrlOf ile e-Fatura adresinden türetilir).
 * Gönderim yolu (EDM e-SMM Web API v4.4.1 §5.4 "GÖNDERİM YÖNTEMİ" + gerçek test WSDL'i 22.10.2026): UBL — SendSMM, SMM/CONTENT = base64 UBL
 * (ProfileID ESMM; içerik türü verilmezse EDM XML sayar, §3.4), SMM_CONTENT_TYPE = "XML" (zorunlu; "vermediğiniz takdirde çağrı olumsuz olacaktır").
 * NESNE yolu (SMM_LINE_ITEMS + EXCEL şablonu) kullanılmaz: belge, defterle aynı kuruş hesabından (invoice-math) programın ürettiği UBL'dir.
 * Numarayı program verir (SMM/ID dolu); EDM'nin seri üretimi (INVOICESERIAL_REQUESTED) istenmez.
 * Gönderici/alıcı (§5.4): istek düzeyinde SENDER/RECEIVER (vkn, alias) ve SMM/HEADER (SENDER, RECEIVER, FROM, TO) — ikisi verilince HEADER geçer;
 * EDM'nin C# örneği gibi ikisi de doldurulur: FROM = göndericinin GB etiketi, TO = alıcının e-posta adresi (yoksa boş: kâğıt teslim).
 * @param {{ baseUrl: string, username: string, password: string, env?: "test"|"live", fetchImpl?: Function, timeoutMs?: number, useWsdl?: boolean, appName?: string }} options
 */
export function createEdmSmmClient(options) {
  const { base, call, header, withSession, touch, ensureSession, contractReport: report, test } = edmTransport({ ...options, defaultNs: EDM_SMM_DEFAULT_NS, safeOperations: SMM_SAFE_OPERATIONS });
  // SMM nesnesi (gerçek WSDL tns:SMM): ID ve UUID ÇOCUK öğe; tek niteliği TRXID (use="required", xs:long) — EDM'nin örneklerinde ve C# istemcisinde
  // isteklerde "0" gider.
  const smmRef = (number, uuid) => E("SMM", [E("ID", number), E("UUID", uuid)], { TRXID: "0" });
  async function contractReport({ refresh = false } = {}) {
    return (await report({ refresh, operations: EDM_SMM_OPERATIONS })).report;
  }
  return {
    endpoint: base,
    contractReport,
    ensureSession,
    async test() {
      return test(await contractReport({ refresh: true }), "EDM e-SMM servisine giriş yapıldı; bağlantı çalışıyor.");
    },
    async send({ xml, number, uuid, issueDate = "", senderVkn = "", senderAlias = "", receiverVkn = "", receiverEmail = "" }) {
      assertSmmDocument(xml, { number, uuid });
      return withSession(async session => {
        const head = E("HEADER", [E("SENDER", senderVkn), E("RECEIVER", receiverVkn), E("SMM_DATE", issueDate), E("FROM", senderAlias), E("TO", receiverEmail)]);
        const smm = E("SMM", [E("ID", number), E("UUID", uuid), head, E("CONTENT", base64Text(xml))], { TRXID: "0" });
        const request = E("SendSMMRequest", [header(session), E("SENDER", "", { vkn: senderVkn, alias: senderAlias }), E("RECEIVER", "", { vkn: receiverVkn }), smm, E("SMM_CONTENT_TYPE", "XML")]);
        const body = await call("SendSMM", request, { session, wait: 90_000 });
        touch();
        const sent = deepAll(body, "SMM")[0];
        return {
          status: "sent",
          message: "e-SMM EDM'ye iletildi; sonucu Durum Sorgula ile görün.",
          // EDM'nin döndürdüğü numara (programın verdiğiyle aynı olmalı; farklıysa çağıran ayrımı görür).
          reference: textOf(find(sent, "ID")) || number,
          uuid: textOf(find(sent, "UUID")) || uuid,
          edmStatus: textOf(find(sent, "HEADER/STATUS")),
        };
      });
    },
    async status({ uuid, number = "" }) {
      return withSession(async session => {
        const body = await call("GetSMMStatus", E("GetSMMStatusRequest", [header(session), smmRef(number, uuid)]), { session });
        touch();
        // Yanıt SMM_STATUS (tns:SMM'den türer): STATUS, STATUS_DESCRIPTION, GIB_STATUS_* doğrudan çocuk (SMM/HEADER/STATUS değil).
        const status = deep(body, "SMM_STATUS");
        const read = name => textOf(find(status, name));
        // 2.4.4 (31d E1): yanıttaki ETTN (SMM_STATUS, tns:SMM'den türer: UUID öğesi) — 11048'de "bu belge mi" denetimi için; yoksa "".
        return { ...mapEdmStatus({ status: read("STATUS"), description: read("STATUS_DESCRIPTION"), gibCode: read("GIB_STATUS_CODE"), gibDescription: read("GIB_STATUS_DESCRIPTION"), esmm: true }), uuid: String(read("UUID") || status?.attrs?.UUID || "") };
      });
    },
    // e-SMM iptali (EDM §5.13: e-Arşiv senaryosundaki gibi; başarısız ve taslak SMM'ler de iptale çekilebilir). Süre kuralı çağıranın işidir
    // (iş listesi 23: 8 gün, iletimden).
    async cancel({ uuid, number = "" }) {
      return withSession(async session => {
        await call("CancelSMM", E("CancelSMMRequest", [header(session), smmRef(number, uuid)]), { session });
        touch();
        return { status: "cancelled", message: "e-SMM EDM'de iptal edildi; iptal GİB'e raporlanır." };
      });
    },
    // Resmî görüntü: GetSMM, giden yön, ETTN ile; SMM_CONTENT_TYPE PDF; içerik base64 PDF (ZIP'liyse içindeki .pdf).
    async officialPdf({ uuid, number = "" }) {
      return withSession(async session => {
        const key = E("SMM_SEARCH_KEY", [E("LIMIT", 1), E("UUID", uuid), E("DIRECTION", "OUT")]);
        const body = await call("GetSMM", E("GetSMMRequest", [header(session), key, E("HEADER_ONLY", "N"), E("SMM_CONTENT_TYPE", "PDF")]), { session, wait: 120_000 });
        touch();
        const smm = children(find(body, "GetSMMResponse") || deep(body, "GetSMMResponse") || body, "SMM").find(item => textOf(find(item, "UUID")).toLowerCase() === String(uuid).toLowerCase());
        if (!smm) throw new IntegratorError(`${number || uuid} EDM'de bulunamadı (makbuz henüz işlenmemiş olabilir; birkaç dakika sonra yeniden deneyin).`, { code: "integrator-not-found", status: 404 });
        let data = Buffer.from(textOf(find(smm, "CONTENT")).replace(/\s+/g, ""), "base64");
        if (data.length > 4 && data.readUInt32LE(0) === 0x04034b50) data = (readZip(data).find(item => !item.directory && /\.pdf$/i.test(item.name)) || {}).data || Buffer.alloc(0);
        if (data.subarray(0, 5).toString("latin1") !== "%PDF-") throw new IntegratorError(`EDM ${number || uuid} için PDF görüntüsü vermedi (görüntü henüz hazır olmayabilir; birkaç dakika sonra yeniden deneyin).`, { code: "integrator-no-pdf", status: 409 });
        return { data, mime: "application/pdf" };
      });
    },
  };
}

/** Testler için: bellekteki oturum ve sözleşme önbelleğini boşaltır. */
export function resetEdmCaches() {
  sessions.clear();
  logins.clear();
  contracts.clear();
  contacts.clear();
}
