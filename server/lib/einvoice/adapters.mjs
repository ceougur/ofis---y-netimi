// Entegratör Adaptör Katmanı (v2.0.15). Fatura modülü e-Belgeyi tek bir arayüzle gönderir:
//   send({ invoice, xml, settings }) → { status: 'exported' | 'sent' | 'accepted' | 'rejected' | 'error', message, reference? }
//   status(...) / cancel(...)        → entegratör bağlantısı kurulduğunda aynı biçimde.
// Her entegratör (özel entegratör, GİB portalı, PEPPOL erişim noktası) bu arayüzün bir uygulamasıdır; fatura kodu
// entegratöre göre değişmez. Bağlantı bilgileri (kullanıcı, parola, uç nokta) entegratörle yapılan sözleşmeyle gelir ve
// programın dosyalarına, paketine yazılmaz.
//
// Bu sürümde çalışan yol "Dosya": UBL-TR XML'i üretilir; kullanıcı GİB portalına ya da entegratörünün web portalına
// yükler, sonucu programda işler (Gönderildi / Kabul / Ret). Diğer adaptörler kayıtlıdır ama bağlantıları kurulmamıştır:
// gönderme denendiğinde ne yapılması gerektiğini söyleyen anlaşılır bir hata döner (uydurma bir API çağrısı yapılmaz).
import { HttpError } from "../http.mjs";

export const ADAPTERS = Object.freeze({
  file: { label: "Dosya (Portala ya da Entegratöre Elle Yükleme)", protocol: "file", connected: true, profiles: ["EARSIVFATURA", "TEMELFATURA", "TICARIFATURA"] },
  gib: { label: "GİB e-Arşiv / e-Fatura Portalı", protocol: "portal", connected: false, profiles: ["EARSIVFATURA", "TEMELFATURA", "TICARIFATURA"] },
  logo: { label: "Logo (eLogo)", protocol: "soap", connected: false, profiles: ["EARSIVFATURA", "TEMELFATURA", "TICARIFATURA"] },
  izibiz: { label: "İzibiz", protocol: "soap", connected: false, profiles: ["EARSIVFATURA", "TEMELFATURA", "TICARIFATURA"] },
  digitalplanet: { label: "Digital Planet", protocol: "soap", connected: false, profiles: ["EARSIVFATURA", "TEMELFATURA", "TICARIFATURA"] },
  qnb: { label: "QNB e-Finans", protocol: "soap", connected: false, profiles: ["EARSIVFATURA", "TEMELFATURA", "TICARIFATURA"] },
  peppol: { label: "PEPPOL Erişim Noktası (Yurt Dışı)", protocol: "as4", connected: false, profiles: ["EARSIVFATURA", "TEMELFATURA", "TICARIFATURA"] },
});

export const adapterInfo = (id, adapter = ADAPTERS[id]) => ({
  id,
  label: adapter.label,
  protocol: adapter.protocol,
  connected: adapter.connected,
  note: adapter.connected
    ? "XML'i indirip GİB portalına ya da entegratörünüzün web portalına yükleyin; sonucu faturada işleyin."
    : "Bağlantı, entegratörünüzle sözleşme yapıldığında verilen API bilgileriyle kurulur. O zamana kadar XML'i indirip portala yükleyin.",
});

const HANDLERS = {
  file: async ({ invoice }) => ({
    status: "exported",
    message: `${invoice.number} için UBL-TR XML hazır. İndirip ${invoice.profile === "EARSIVFATURA" ? "e-Arşiv" : "e-Fatura"} portalına ya da entegratörünüzün portalına yükleyin; sonucu "Gönderildi" olarak işleyin.`,
  }),
};

/** Seçili adaptörle gönderir. Bağlantısı kurulmamış adaptörde 501 (ne yapılacağını söyleyen mesaj). */
export async function sendWith(id, context) {
  const adapter = ADAPTERS[id];
  if (!adapter) throw new HttpError(400, "Entegratör tanınmadı. Fatura Ayarları'ndan seçin.");
  const handler = HANDLERS[id];
  if (!adapter.connected || !handler) {
    throw new HttpError(501, `${adapter.label} bağlantısı bu kurulumda etkin değil. Entegratörünüzün verdiği API bilgileriyle bağlantı kurulana kadar Fatura Ayarları'nda "Dosya" yolunu seçip XML'i portala yükleyin.`, { code: "adapter-not-connected", adapter: id });
  }
  return handler(context);
}
