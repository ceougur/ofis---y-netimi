// Entegratör Adaptör Katmanı (v2.0.15). Fatura modülü e-Belgeyi tek bir arayüzle gönderir; entegratör değişince fatura
// kodu değişmez. Müşteri entegratörle (özel entegratör) kendisi sözleşir, kontörü kendisi alır ve entegratörün verdiği
// web servis kullanıcı bilgilerini Fatura Ayarları'na girer; program doğrudan entegratörle konuşur (aracı yok).
//
// Kullanıcı kararı (01.10.2026): entegratör şimdilik yalnız EDM Bilişim. Başka bir entegratörle anlaşılırsa aynı arayüzle
// eklenir (İzibiz istemcisi git geçmişinde: 167eefa server/lib/einvoice/izibiz.mjs).
//
// Ortak arayüz:
//   test()                                  → bağlantı, giriş ve servis sözleşmesi raporu
//   checkUser(taxNo)                        → { registered, title, aliases[] }  (GİB e-Fatura kullanıcı listesi)
//   send({ invoice, xml })                  → { status: 'sent', message, reference }
//   loadDraft({ invoice, xml }) / sendDraft({ invoice }) → portala taslak (EDM LoadInvoice) ve taslağı gönderme
//   status({ invoice })                     → { status: 'draft'|'processing'|'sent'|'accepted'|'rejected'|'error'|'cancelled', message }
//   cancel({ invoice })                     → e-Arşiv ve e-SMM iptali (e-Fatura entegratörden iptal edilmez)
//   inbox({ from, to })                     → gelen e-Faturalar [{ uuid, number, senderVkn, senderName, issueDate, payable, currency, xml }]
//   markRead(uuids)
//   testSmm()                               → e-SMM servisine (ESmmEDM.svc) bağlantı + giriş + sözleşme raporu
//
// e-SMM (2.4.4, iş listesi 20): ProfileID'si ESMM olan belgede send / status / cancel / officialPdf / ensureSession e-SMM istemcisine
// (ESmmEDM.svc) gider; adres Servis Adresi'nden türetilir (edm.mjs esmmUrlOf). e-SMM istemcisi ilk e-SMM işleminde kurulur: türetilemeyen adres
// e-Fatura işlemlerini bozmaz. e-SMM'de portala taslak (loadDraft/sendDraft) YOK (2.4.4 kapsamı) → açık hata, ağa çıkılmaz.
import { HttpError } from "../http.mjs";
import { EDM_PORTAL_URLS, EDM_URLS, createEdmClient, createEdmSmmClient, esmmUrlOf } from "./edm.mjs";
import { IntegratorError } from "./integrator-error.mjs";

export const ADAPTERS = Object.freeze({
  edm: { label: "EDM Bilişim", protocol: "soap", implemented: true, urls: EDM_URLS, portalUrls: EDM_PORTAL_URLS },
});
export const DEFAULT_ADAPTER = "edm";

export const adapterInfo = (id, adapter = ADAPTERS[id]) => ({
  id,
  label: adapter.label,
  protocol: adapter.protocol,
  implemented: adapter.implemented,
  urls: adapter.urls,
  note: "EDM Bilişim'in verdiği web servis kullanıcı adı ve parolasını girin; önce Test Ortamı'nda Bağlantıyı Test Et ile deneyin.",
});

const toHttp = error => {
  if (error instanceof IntegratorError) return new HttpError(error.status || 502, error.message, { code: error.code, detail: error.detail, integratorCode: error.integratorCode, ...(error.stage ? { stage: error.stage } : {}) });
  return error;
};

export const integratorUrl = integrator => String(integrator?.baseUrl || "").trim() || (integrator?.env === "live" ? EDM_URLS.live : EDM_URLS.test);
// Entegratörün web portalı (2.4.4 E7): ortamın adresi YALNIZ entegratörün sabit portal listesinden; bilinmeyen entegratör ya da ortam → "" (hiçbir
// adres açılmaz). Servis Adresi (baseUrl) portalı DEĞİŞTİRMEZ.
export const integratorPortalUrl = integrator => {
  const urls = ADAPTERS[integrator?.id]?.portalUrls;
  const env = integrator?.env;
  if (!urls || (env !== "test" && env !== "live")) return "";
  return Object.hasOwn(urls, env) ? urls[env] : "";
};
export const isPortalUrl = url => Object.values(ADAPTERS).some(adapter => Object.values(adapter.portalUrls || {}).includes(url));
// e-SMM servis adresi: Entegratör Ayarları'ndaki (ya da ortamın) e-Fatura adresinden türetilir; canlı kilidi ve ortam ↔ adres denetimi e-Fatura
// adresine uygulandığı için türetilen adres aynı ortamdadır (test → test, canlı → canlı).
export const integratorSmmUrl = integrator => esmmUrlOf(integratorUrl(integrator));
// Belge e-SMM servisinden mi gider?
export const isSmmDocument = invoice => invoice?.profile === "ESMM";
// Canlı kilidi açılmadan kullanılabilecek servis adresi (2.4.0 bitiş turu: yargıç Y1 / eleştirmen E1 — env "test" iken Servis Adresi'ne canlı adres
// yazılınca bütün istekler canlıya gidiyordu). İzin listesi: boş (ortamın adresi), entegratörün test adresi, yerel adres (testlerin sahte servisi).
// Kara liste değil: canlı adresin büyük harf / port / yol varyantları da reddedilir.
export const testOnlyUrl = url => {
  const value = String(url || "").trim();
  return !value || value === EDM_URLS.test || /^http:\/\/(127\.0\.0\.1|localhost)(:\d+)?(\/\S*)?$/i.test(value);
};

/**
 * @param {{ integrator: { id, env, baseUrl, username, password, senderAlias }, seller, fetchImpl }} options
 */
export function connect({ integrator, seller = {}, fetchImpl }) {
  const id = integrator?.id || DEFAULT_ADAPTER;
  const adapter = ADAPTERS[id];
  if (!adapter) throw new HttpError(400, "Entegratör tanınmadı. Fatura Ayarları'ndan seçin.", { code: "adapter-unknown" });
  const wrap = fn => async (...args) => {
    try {
      return await fn(...args);
    } catch (error) {
      throw toHttp(error);
    }
  };
  let client;
  try {
    client = createEdmClient({ baseUrl: integratorUrl(integrator), username: integrator?.username, password: integrator?.password, env: integrator?.env, fetchImpl });
  } catch (error) {
    throw toHttp(error);
  }
  const earchive = invoice => invoice.profile === "EARSIVFATURA";
  let smm = null;
  const smmClient = () => {
    smm ||= createEdmSmmClient({ baseUrl: integratorSmmUrl(integrator), username: integrator?.username, password: integrator?.password, env: integrator?.env, fetchImpl });
    return smm;
  };
  const noSmmDraft = () => {
    throw new IntegratorError("e-SMM portala taslak olarak yüklenmez; makbuzu Gönder ile gönderin.", { code: "einvoice-draft-unsupported", status: 409 });
  };
  // e-SMM'de e-posta: e-Arşiv'deki ayarla aynı ("PDF'i müşteriye e-postayla gönder" kapalıysa alıcıya e-posta verilmez → kâğıt teslim).
  const smmPayload = (invoice, xml) => ({ xml, number: invoice.number, uuid: invoice.ettn, issueDate: invoice.issueDate || "", senderVkn: seller.taxNo || "", senderAlias: integrator.senderAlias || "", receiverVkn: invoice.party?.taxNo || "", receiverEmail: integrator.earchiveEmail === false ? "" : invoice.party?.email || "" });
  return {
    id,
    label: adapter.label,
    contractReport: wrap(() => client.contractReport({ refresh: true })),
    test: wrap(() => client.test()),
    checkUser: wrap(taxNo => client.checkUser(taxNo)),
    testSmm: wrap(() => smmClient().test()),
    // Numara vermeden önceki erişim/giriş denetimi BELGENİN servisinde yapılır: e-SMM için ESmmEDM.svc (e-Fatura oturumu e-SMM için kanıt değil).
    ensureSession: wrap(({ invoice } = {}) => (isSmmDocument(invoice) ? smmClient().ensureSession() : client.ensureSession())),
    send: wrap(({ invoice, xml }) =>
      isSmmDocument(invoice) ? smmClient().send(smmPayload(invoice, xml)) : client.send({ xml, number: invoice.number, uuid: invoice.ettn, earchive: earchive(invoice), senderVkn: seller.taxNo || "", senderAlias: integrator.senderAlias || "", receiverVkn: invoice.party?.taxNo || "", receiverAlias: invoice.party?.eAlias || "" }),
    ),
    // Portala taslak (İz 7.3): yükle / aynı ETTN ile yenile; taslağı gönder (içerik EDM'deki taslaktır).
    loadDraft: wrap(({ invoice, xml }) =>
      isSmmDocument(invoice) ? noSmmDraft() : client.loadDraft({ xml, number: invoice.number, uuid: invoice.ettn, earchive: earchive(invoice), senderVkn: seller.taxNo || "", senderAlias: integrator.senderAlias || "", receiverVkn: invoice.party?.taxNo || "", receiverAlias: invoice.party?.eAlias || "" }),
    ),
    sendDraft: wrap(({ invoice }) =>
      isSmmDocument(invoice) ? noSmmDraft() : client.sendDraft({ number: invoice.number, uuid: invoice.ettn, earchive: earchive(invoice), senderVkn: seller.taxNo || "", senderAlias: integrator.senderAlias || "", receiverVkn: invoice.party?.taxNo || "", receiverAlias: invoice.party?.eAlias || "" }),
    ),
    status: wrap(({ invoice }) => (isSmmDocument(invoice) ? smmClient().status({ uuid: invoice.ettn, number: invoice.number }) : client.status({ uuid: invoice.ettn, number: invoice.number, earchive: earchive(invoice) }))),
    cancel: wrap(({ invoice }) => {
      if (isSmmDocument(invoice)) return smmClient().cancel({ uuid: invoice.ettn, number: invoice.number });
      if (!earchive(invoice)) throw new IntegratorError("e-Fatura entegratör üzerinden iptal edilmez: Ticari faturayı alıcı reddedebilir; Temel faturada iade faturası kesilir ya da GİB'in iptal yolu (e-Fatura portalı) kullanılır.", { code: "einvoice-cancel-unsupported", status: 409 });
      return client.cancelEArchive({ uuid: invoice.ettn, number: invoice.number });
    }),
    officialPdf: wrap(({ invoice }) => (isSmmDocument(invoice) ? smmClient() : client).officialPdf({ uuid: invoice.ettn, number: invoice.number })),
    inbox: wrap(range => client.inbox(range)),
    markRead: wrap(uuids => client.markRead(uuids)),
  };
}
