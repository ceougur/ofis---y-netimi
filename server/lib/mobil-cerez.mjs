// Mobil uzaktan erişimin çerezleri (2.4.7; bağımsız gözden geçirme B4 + B1 düzeltmesi, docs/2.4.7-IS-LISTESI.md "BAĞIMSIZ GÖZDEN GEÇİRME").
// Program (lib/mobile-remote.mjs) ve kapıcı (bulut/kapi/kapi.mjs, Cloudflare Worker) çerezi BU modülle, AYNI kuralla okur ve yazar. node: modülü YOK
// (Worker paketine olduğu gibi girer).
//
// Adlar `__Host-` önekli: tarayıcı bu adı yalnız Secure, Path=/ ve Domain'siz (yalnız o ad için) kabul eder → bir ofisin sayfası (<ofis>.destekofis.net)
// başka ofisin adresine ya da üst alana bu adla çerez koyamaz (alan Public Suffix List'te değil; RFC 6265bis §4.1.3.2). Önekli olmayan eski ad
// (hof_device) okunmaz. Chromium ve Firefox http://127.0.0.1 / localhost'u güvenli bağlam sayar: Secure çerez orada da tutulur (yerel testler, sınandı).
export const CIHAZ_CEREZI = "__Host-hof_device";
export const OTURUM_CEREZI = "__Host-hof_mobil";
export const MOBIL_CEREZLERI = Object.freeze([CIHAZ_CEREZI, OTURUM_CEREZI]);
const NITELIKLER = "Path=/; HttpOnly; SameSite=Strict; Secure";

/** Set-Cookie satırı (değer boşsa süresi geçmiş: silme). Domain YOK (__Host- kuralı). */
export const cerezSatiri = (ad, deger, saniye) => `${ad}=${deger ? encodeURIComponent(deger) : ""}; Max-Age=${deger ? saniye : 0}; ${NITELIKLER}`;
/** İki mobil çerezi silen satırlar. */
export const cerezSilSatirlari = () => MOBIL_CEREZLERI.map(ad => cerezSatiri(ad, "", 0));

const parcalar = baslik =>
  String(baslik ?? "")
    .split(";")
    .map(parca => {
      const i = parca.indexOf("=");
      return i < 1 ? null : { ad: parca.slice(0, i).trim(), ham: parca.slice(i + 1).trim() };
    })
    .filter(Boolean);
const coz = ham => {
  try {
    return decodeURIComponent(ham);
  } catch {
    return ham;
  }
};

/**
 * İstek Cookie başlığında bir çerez. Dönüş { sayi, deger }: sayi = o adla gelen çerez adedi; deger yalnız TEK geldiğinde (çözülmüş), yoksa "".
 * İki ya da daha çok aynı adlı çerez ÇAKIŞMADIR (hangisinin gerçek olduğu bilinemez): kapıcı ve program isteği reddeder (ilk/son seçilmez).
 */
export function cerezOku(baslik, ad) {
  const bulunan = parcalar(baslik).filter(p => p.ad === ad);
  return { sayi: bulunan.length, deger: bulunan.length === 1 ? coz(bulunan[0].ham) : "" };
}
/** Mobil çerezlerinden biri birden çok kez gelmiş mi (çakışma). */
export const cerezCakisiyor = baslik => MOBIL_CEREZLERI.some(ad => cerezOku(baslik, ad).sayi > 1);

/** Cookie başlığından verilen adları çıkarır (öbür çerezler aynen, sırası korunur). Boş kalırsa "". */
export function cerezCikar(baslik, adlar) {
  const atilan = new Set(adlar);
  return String(baslik ?? "")
    .split(";")
    .filter(parca => {
      const i = parca.indexOf("=");
      return !(i > 0 && atilan.has(parca.slice(0, i).trim()));
    })
    .map(parca => parca.trim())
    .filter(Boolean)
    .join("; ");
}

/** Set-Cookie satırının adı. */
export const setCookieAdi = satir => {
  const ilk = String(satir ?? "").split(";")[0];
  const i = ilk.indexOf("=");
  return i < 0 ? ilk.trim() : ilk.slice(0, i).trim();
};
/** Set-Cookie satırında Domain özniteliği var mı (büyük/küçük harf duyarsız). Program hiçbir çerezi Domain'li yazmaz. */
export const setCookieAlanli = satir =>
  String(satir ?? "")
    .split(";")
    .slice(1)
    .some(parca => /^domain$/i.test(parca.split("=")[0].trim()));
