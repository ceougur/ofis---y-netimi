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
//   status({ invoice })                     → { status: 'processing'|'sent'|'accepted'|'rejected'|'error'|'cancelled', message }
//   cancel({ invoice })                     → e-Arşiv iptali (e-Fatura entegratörden iptal edilmez)
//   inbox({ from, to })                     → gelen e-Faturalar [{ uuid, number, senderVkn, senderName, issueDate, payable, currency, xml }]
//   markRead(uuids)
import { HttpError } from "../http.mjs";
import { EDM_URLS, createEdmClient } from "./edm.mjs";
import { IntegratorError } from "./integrator-error.mjs";

export const ADAPTERS = Object.freeze({
  edm: { label: "EDM Bilişim", protocol: "soap", implemented: true, urls: EDM_URLS },
});
export const DEFAULT_ADAPTER = "edm";

export const adapterInfo = (id, adapter = ADAPTERS[id]) => ({
  id,
  label: adapter.label,
  protocol: adapter.protocol,
  implemented: adapter.implemented,
  urls: adapter.urls,
  note: "EDM Bilişim'in verdiği web servis kullanıcı adı ve parolasını girin; önce Test ortamında Bağlantıyı Sına ile deneyin.",
});

const toHttp = error => {
  if (error instanceof IntegratorError) return new HttpError(error.status || 502, error.message, { code: error.code, detail: error.detail, integratorCode: error.integratorCode });
  return error;
};

export const integratorUrl = integrator => String(integrator?.baseUrl || "").trim() || (integrator?.env === "live" ? EDM_URLS.live : EDM_URLS.test);

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
    client = createEdmClient({ baseUrl: integratorUrl(integrator), username: integrator?.username, password: integrator?.password, fetchImpl });
  } catch (error) {
    throw toHttp(error);
  }
  const earchive = invoice => invoice.profile === "EARSIVFATURA";
  return {
    id,
    label: adapter.label,
    contractReport: wrap(() => client.contractReport({ refresh: true })),
    test: wrap(() => client.test()),
    checkUser: wrap(taxNo => client.checkUser(taxNo)),
    send: wrap(({ invoice, xml }) =>
      client.send({ xml, number: invoice.number, uuid: invoice.ettn, earchive: earchive(invoice), senderVkn: seller.taxNo || "", senderAlias: integrator.senderAlias || "", receiverVkn: invoice.party?.taxNo || "", receiverAlias: invoice.party?.eAlias || "" }),
    ),
    status: wrap(({ invoice }) => client.status({ uuid: invoice.ettn, number: invoice.number, earchive: earchive(invoice) })),
    cancel: wrap(({ invoice }) => {
      if (!earchive(invoice)) throw new IntegratorError("e-Fatura entegratör üzerinden iptal edilmez: Ticari faturayı alıcı reddedebilir; Temel faturada iade faturası kesilir ya da GİB'in iptal yolu (e-Fatura portalı) kullanılır.", { code: "einvoice-cancel-unsupported", status: 409 });
      return client.cancelEArchive({ uuid: invoice.ettn, number: invoice.number });
    }),
    inbox: wrap(range => client.inbox(range)),
    markRead: wrap(uuids => client.markRead(uuids)),
  };
}
