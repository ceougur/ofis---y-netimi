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
// cari / stok / çekte atlanan ve uyarılı satır listeleri en çok 500'er; taksit raporunun atlanan listesi SINIRSIZ (20.000 satırda ~750 KB; dar kontrol I1
// DÜŞÜK-1 → sonraki sürüm); 30 günde budanır. Ayrı tablo / göç açılmadı.
// 409 (aynı kimlik, farklı içerik; dar kontrol I1 ORTA-1): ilk yükleme ÖNCEKİ seçeneklerle kaydedilmiştir. İleti bunu ilk yüklemenin sayılarıyla söyler ve
// dosyanın yeniden yüklenmesine YÖNLENDİRMEZ (yeni pencere yeni kimliktir; Cari No'suz / telefonsuz cari ve numarasız evrak ikinci kez açılırdı); 409
// gövdesinde yalnız ilk raporun özet sayıları (first) gider, satır listeleri gitmez.
import { HttpError } from "./http.mjs";
import { createIdempotency, streamBodyHash } from "./idempotency.mjs";

export const IMPORT_SCOPES = Object.freeze({ accounts: "account.import", stock: "stock.import", plans: "plan.import", cheques: "cheque.import" });

const text = value => (typeof value === "string" ? value.trim() : typeof value === "number" ? String(value) : "");
const n = value => (Number(value) || 0).toLocaleString("tr-TR");
// İlk yüklemenin özet sayıları (409 gövdesi ve iletisi) ve kapsama göre ileti: ne kaydedildi, nereden bakılır, yeniden yüklemenin sonucu, değişiklik nerede yapılır.
const FIRST_FIELDS = { "account.import": ["created", "updated", "balances", "skippedTotal"], "cheque.import": ["created", "linked", "posted", "skippedTotal"], "stock.import": ["created", "updated", "opening", "skippedTotal"], "plan.import": ["created", "importId"] };
const firstOf = (scope, report) => Object.fromEntries((FIRST_FIELDS[scope] || []).filter(field => report?.[field] !== undefined).map(field => [field, report[field]]));
const SUMMARY = {
  "account.import": r => [`${n(r.created)} cari açıldı`, r.updated ? `${n(r.updated)} cari güncellendi` : "", r.balances ? `${n(r.balances)} açılış bakiyesi yazıldı` : ""],
  "cheque.import": r => [`${n(r.created)} evrak portföye alındı`, r.posted ? `${n(r.posted)} cari hareketi yazıldı` : ""],
  "stock.import": r => [`${n(r.created)} ürün açıldı`, r.opening ? `${n(r.opening)} ürüne açılış stoku yazıldı` : "", r.updated ? `${n(r.updated)} ürün güncellendi` : ""],
  "plan.import": r => [`${n(r.created)} kart oluşturuldu`],
};
const ADVICE = {
  "account.import": "Cari listesini kontrol edin. Dosyayı yeniden yüklerseniz Cari No'suz ya da telefonsuz satırlar ikinci kez açılır; değişikliği cari kartlarında yapın.",
  "cheque.import": "Çek / Senet listesini kontrol edin. Dosyayı yeniden yüklerseniz numarasız evrak ikinci kez açılır (“Bağlanan carilere de işle” seçiliyse cari etkisi de); değişikliği evrak kartlarında yapın. Cariye işlenmeden açılan evrak sonradan cariye işlenmez; gerekiyorsa bu yüklemede açılan evrakı listeden silip dosyayı bu seçenek işaretli yeniden yükleyin.",
  "stock.import": "Ürün listesini kontrol edin. Dosyayı yeniden yüklerseniz birim ya da ad eşlemesi değiştiyse ürünler ve açılış stoku ikinci kez yazılır; değişikliği ürün kartlarında yapın.",
  "plan.import": "Taksitler listesini kontrol edin. Dosyayı başka seçenekle yeniden yüklerseniz kartlar ikinci kez açılabilir; değişikliği kartlarda yapın ya da önce Son Aktarımlar’dan geri alın.",
};
const reusedError = (scope, refId) => {
  let report = {};
  try {
    report = JSON.parse(refId) || {};
  } catch {
    report = {};
  }
  const summary = (SUMMARY[scope]?.(report) || []).filter(Boolean).join(", ");
  return new HttpError(409, `İlk yükleme (önceki seçeneklerle) kaydedildi${summary ? `: ${summary}` : ""}; ikinci kez yazılmadı. ${ADVICE[scope] || ""}`.trim(), { code: "request-id-reused", first: firstOf(scope, report) });
};
// remember'da çakışma: aynı kimlik bu işlem sürerken başka yazımla kaydedilmiş (denetim işlemin içinde olduğundan beklenmez; birincil anahtar son güvencedir).
const RACED = "Bu yükleme az önce kaydedildi; ikinci kez yazılmadı. Listeyi yenileyip sonucu görün.";
const isReused = error => error instanceof HttpError && error.extra?.code === "request-id-reused";

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
      return Object.freeze({ key, scope, hash: key ? streamBodyHash(body ?? {}) : "" });
    },
    /** Yüklemenin işleminin İÇİNDE, ilk yazımdan önce: daha önce işlenmişse ilk raporu (replayed: true) döndürür; içerik farklıysa 409; yoksa null. */
    replay(ticket) {
      if (!ticket?.key) return null;
      let hit;
      try {
        hit = requests.lookup(ticket.key, ticket.hash);
      } catch (error) {
        // idempotency'nin 409'u ilk kaydın ref_id'sini (burada ilk raporun tamamı) taşır; istemciye yalnız özet sayılar gider.
        throw isReused(error) ? reusedError(ticket.scope, error.extra?.refId) : error;
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
        throw isReused(error) ? new HttpError(409, RACED, { code: "request-id-reused" }) : error;
      }
    },
  };
}
