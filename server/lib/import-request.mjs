// 2.4.8 I1 — Excel / Google Sheets içe aktarmalarında kalıcı istek kimliği (cari, stok, taksit, çek / senet).
// BULGU (2.4.7 çek ajanı, kullanıcı kararı B → 2.4.8): içe aktarma uçları istek kimliği almıyordu. Yanıt zaman aşımına düşünce (büyük dosya, istemci
// 30 sn bekler) ya da bağlantı kopunca eşleme penceresi açık kalır; kullanıcı yeniden "Carileri Oluştur" / "Portföye Al"a basınca sunucuda zaten yazılmış
// yükleme İKİNCİ KEZ işlenir: Cari No'suz ve telefonsuz cariler, no'suz çek / senetler yeniden açılır, açılış bakiyesi ve ("Cariye işle" seçiliyse) evrakın
// cari etkisi ikinci kez yazılır (mizan ve yevmiye iki kat). Stok ve taksitte doğal anahtar (ad + birim, ad + grup) ikinci yazımı zaten atlatıyordu; ekran
// ise "0 açıldı, N satır atlandı" diyerek ilk yüklemeyi gizliyordu.
// KURAL (öbür para uçlarıyla AYNI düzen; lib/idempotency.mjs, banka planı §3.10/1 "bütün kapsamlar request_keys'e"):
//  - kimlik x-hof-request başlığında (ya da gövdede requestId); anahtar kullanıcı | kapsam | kimlik, şirketin veri tabanında (request_keys), 30 gün;
//  - denetim ve kayıt yüklemenin KENDİ işleminin içinde (store.tx, BEGIN IMMEDIATE): aynı anda gelen iki kopyadan biri yazar, öbürü onun sonucunu görür;
//    yükleme yarıda kesilirse (hata ya da süreç ölümü) satırlar, cari / yevmiye etkisi, işlem geçmişi ve kimlik kaydı birlikte geri alınır — yeniden
//    deneme baştan ve bir kez işler;
//  - aynı kimlik + aynı içerik → hiçbir şey yazılmaz, İLK yüklemenin raporu döner (replayed: true); aynı kimlik + farklı içerik (dosya, kolon eşlemesi ya
//    da seçenek değişti) → 409 request-id-reused; yalnız başarılı yükleme kimlik bırakır (400 / 409 ile reddedilen istek aynı kimlikle düzeltilip gönderilir);
//  - kimliksiz istek (eski istemci) bugünkü gibi işlenir — koruma yalnız kimlik gönderen istemcidedir; yeni pencere yeni kimliktir (aynı dosyayı bilerek
//    ikinci kez yüklemek bugünkü kurala bağlı kalır: 2.0.19 kararı, telefonsuz / no'suz satır yeni cari açar).
// BAŞ MİMAR KARARI (I1): request_keys.ref_id içe aktarmada tek bir belgeyi değil İLK yanıtın raporunu (JSON) taşır — yinelemede aynı sayılar gösterilir;
// rapor sınırlıdır (atlanan / uyarılı satır listeleri en çok 500'er), 30 günde budanır. Ayrı tablo / göç açılmadı.
import { HttpError } from "./http.mjs";
import { createIdempotency, streamBodyHash } from "./idempotency.mjs";

export const IMPORT_SCOPES = Object.freeze({ accounts: "account.import", stock: "stock.import", plans: "plan.import", cheques: "cheque.import" });

const REUSED = "Bu yükleme penceresinden farklı içerikle (dosya, kolon eşlemesi ya da seçenek değişmiş) bir yükleme zaten kaydedildi; ikinci kez yazılmadı. Yeniden yüklemek için pencereyi kapatıp dosyayı yeniden seçin.";
const text = value => (typeof value === "string" ? value.trim() : typeof value === "number" ? String(value) : "");
// remember'da çakışma: aynı kimlik bu işlem sürerken başka yazımla kaydedilmiş (denetim işlemin içinde olduğundan beklenmez; birincil anahtar son güvencedir).
const RACED = "Bu yükleme az önce kaydedildi; ikinci kez yazılmadı. Listeyi yenileyip sonucu görün.";
// idempotency'nin 409'u ilk kaydın ref_id'sini taşır; içe aktarmada o bir rapordur — istemciye 409 içinde gönderilmez.
const reused = (error, message) => (error instanceof HttpError && error.extra?.code === "request-id-reused" ? new HttpError(409, message, { code: "request-id-reused" }) : error);

/** now: iş saati (rotanın clock'u; Date döndüren işlev). */
export function createImportRequests({ store, now }) {
  const requests = createIdempotency({ store, ...(now ? { now } : {}) });
  return {
    /**
     * İsteğin bileti (gövde okunduktan hemen sonra, yetkiden sonra). Kimlik yoksa boş bilet: koruma yok, bugünkü gibi. Biçimsiz kimlik → 400
     * request-id-invalid (öbür uçlarla aynı). Özet ham gövdeden (VOLATILE alanlar hariç; bodyHash ile aynı).
     */
    ticket(req, body, user, scope) {
      if (!Object.values(IMPORT_SCOPES).includes(scope)) throw new TypeError(`içe aktarma kapsamı bilinmiyor: ${scope}`);
      const key = requests.key(user, scope, text(req?.headers?.["x-hof-request"]) || text(body?.requestId));
      return Object.freeze({ key, hash: key ? streamBodyHash(body ?? {}) : "" });
    },
    /** Yüklemenin işleminin İÇİNDE, ilk yazımdan önce: daha önce işlenmişse ilk raporu (replayed: true) döndürür; içerik farklıysa 409; yoksa null. */
    replay(ticket) {
      if (!ticket?.key) return null;
      let hit;
      try {
        hit = requests.lookup(ticket.key, ticket.hash);
      } catch (error) {
        throw reused(error, REUSED);
      }
      if (!hit) return null;
      let report = {};
      try {
        report = JSON.parse(hit.refId) || {};
      } catch {
        report = {};
      }
      return { ...report, replayed: true };
    },
    /** Yüklemenin işleminin İÇİNDE, son yazım olarak: kimlik ilk raporla saklanır (işlem geri alınırsa kimlik de gider). */
    remember(ticket, report) {
      if (!ticket?.key) return;
      try {
        requests.remember(ticket.key, ticket.hash, JSON.stringify(report ?? {}));
      } catch (error) {
        throw reused(error, RACED);
      }
    },
  };
}
