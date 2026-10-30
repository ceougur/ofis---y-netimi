// DestekOfis mobil KAPICI — Cloudflare Worker (2.4.7 M3; tasarım docs/mobil/M3-TASARIM.md; kullanıcı kararları CLAUDE.md "KARAR (kullanıcı, 26.10.2026, mobil)" ×3,
// docs/2.4.7-IS-LISTESI.md "KARARLAR — M2" P1–P14; bağımsız kâhin test/bagimsiz/mobil-erisim/). Bağımlılıksız ES modül; R2 bağlaması ve ayarlar env üzerinden.
//
// Görevleri:
//   1. Ofis sunucusunun (program) yazma yetkisi: lisans servisinin imzaladığı lisans belirteci (Ed25519; programın mevcut düzeni) + ofisin kendi imza anahtarı
//      (ilk kayıtta bağlanır; sonra her yazma o anahtarla imzalı). Ofis başına TEK özet nesnesi (üzerine yazılır), boyut ve sıklık sınırı.
//   2. Cihazın okuma yetkisi: programın yüklediği cihaz listesi (M2 gatekeeperSnapshot) + cihazın dışa aktarılamaz anahtarıyla imzalı istek. Kapıcı özetin
//      İÇİNİ okuyamaz (zarf şifreleme; anahtar yalnız ofiste ve eşli cihazlarda).
//   3. Eşli cihaz sınırı kapıcıda da (K13): lisanstaki mobileDevices (yoksa 3); program atlatılsa da sınır aşılamaz. P5: sayı düşerse mevcutlar sürer.
//   4. P9: lisans bilgisi en çok 1 saat eski kabul edilir; lisans servisine ulaşılamazsa süre dolunca erişim kapanır (fail-closed).
//   5. Ofisin telefon adresi (<ofis>.<OFIS_ALANI>) önünde kapı: canlı bağlantıda her istek önce burada (cihaz → lisans → yol), sonra ofisin tüneline
//      (M4) gider; programa ofis başına sırla imzalı "x-do-kapi" işareti eklenir. Sunucu kapalıyken /kapi/ozet son özeti verir.
// Sıra (kâhin V16): cihaz → lisans → (sınır aşımı: P5 gereği yok) → yol → sunucu.
//   6. (bağımsız gözden geçirme B3) lisans belirtecindeki makine kapıcıda TEK ofise eşlenir (bulut/kapi/makine.mjs): aynı makine yeni ofis kimliğiyle
//      kaydolursa eskisi devre dışı (cihazları düşer, tüneli + DNS kaydı silinir); kayıt/tünel hız sınırları ve günlük yeni ofis tavanı.
//   7. (B1, B4) canlı kapıda çerezler programla AYNI kuralla (server/lib/mobil-cerez.mjs; `__Host-` adlar): aynı adlı iki çerez 400; listede olmayan cihaz
//      çerezi eşleme ve sayfa yollarında "cihazsız" sayılır (iletilmez), silinmiş cihazınki yanıtta silinir; kökenin Domain'li Set-Cookie'si düşürülür.
//
// env: OZET (R2 kovası), LISANS_ANAHTARLARI (JSON { keyId: SPKI base64 } — server/lib/license-keys.mjs ile aynı), OFIS_ALANI ("destekofis.net"),
//      LISANS_URL (lisans servisi tabanı; isteğe bağlı), KAPI_LISANS_ANAHTARI (gizli; lisans servisinin kapıcı ucu için), HIZ (isteğe bağlı rate limit bağlaması).
//      2.4.8 W9: WA_UYGULAMA_SIRRI (gizli; DestekOfis Meta uygulamasının App Secret'ı — Yol 2 kanca imzası), WA_META_DOGRULAMA (gizli; uygulama düzeyindeki
//      varsayılan kanca adresinin /wa/meta doğrulama belirteci). İkisi de yoksa kancalar imzasız ("wa0") geçer, /wa/meta reddeder.
// Gizli değer hiçbir dosyaya yazılmaz: `wrangler secret put KAPI_LISANS_ANAHTARI` (W9: `wrangler secret put WA_UYGULAMA_SIRRI`, `… WA_META_DOGRULAMA`).
//   8. (2.4.8 W9; plan §3 C, §6 W9, §11 S1 A) WhatsApp durum bildirimi: ofisin telefon adresinde YALNIZ GET|POST /wa/kanca/<43 karakter gizli yol> cihaz
//      denetimi OLMADAN ofisin tüneline geçer — gövde ≤ 3 MB, çerez ve başlık geçmez (yalnız içerik türü), SAKLANMAZ; Meta imzası (X-Hub-Signature-256) DestekOfis
//      uygulama sırrıyla doğrulanırsa işaretin cihazı "wa1", değilse "wa0" (program Yol 2'de imzasızı reddeder; Yol 1'de imza müşterinin sırrıyla atılır).
//      Lisans burada sorulmaz (programda "kanca kabulü sürer"; salt okunur lisansta tünel zaten kapalı → 503). Tünel yoksa 503 (Meta 7 gün yeniden dener).
//      kapi.<alan>/wa/meta: uygulamanın varsayılan kanca ucu (şablon / hesap kancaları; imza denetlenir, 200, saklanmaz).
import {
  CIHAZ_KIMLIGI,
  KAPI_KURALLARI as K,
  OFIS_KIMLIGI,
  acikAnahtar,
  ayniAnahtar,
  ecdsaDogrula,
  esitMi,
  hmac,
  lisansDogrula,
  mesaj,
  mobilHakIletisi,
  mobilHakki,
  sha256Hex,
  trGunu,
  yolSorunu,
} from "../../server/lib/kapi-protokol.mjs";
import { CIHAZ_CEREZI, MOBIL_CEREZLERI, OTURUM_CEREZI, cerezCakisiyor, cerezCikar, cerezOku, cerezSilSatirlari, setCookieAdi, setCookieAlanli } from "../../server/lib/mobil-cerez.mjs";
import { KAPI_HIZ, MakineHatasi, guncelMi, kayitSonrasi, makineKaydi, metaAnahtari, ozetAnahtari, silinenBirlestir } from "./makine.mjs";
import { TUNEL_YOLU, cloudflareVarsa, ofisTuneliniSil, tunelIstegi } from "./tunel.mjs"; // 2.4.7 M4: ofis tüneli (ayrı dosya)
import { mezarAnahtari, mezarOku, mobilTemizlik } from "./temizlik.mjs"; // 2.4.8 L1: mobil kaydın kendiliğinden silinmesi (zamanlanmış tur)
import { createWaBagla, waOturumTemizle } from "./wa-bagla.mjs"; // 2.4.8 W7: "WhatsApp'ı Bağla" (Embedded Signup; kod → belirteç değişimi yalnız burada)

export { KAPI_HIZ };

const HATA = Object.freeze({
  "kapi-istek": [400, "İstek okunamadı."],
  "kapi-buyuk": [413, "İstek çok büyük."],
  "kapi-ofis-yok": [404, "Bu ofis kapıcıda kayıtlı değil. Ofisteki programın internete bağlı olduğunu denetleyin."],
  "kapi-imza": [401, "İmza doğrulanamadı."],
  "kapi-zaman": [401, "Cihazın saati sunucunun saatiyle uyuşmuyor."],
  "kapi-cihaz": [401, "Bu cihaz eşli değil ya da eşlemesi kaldırıldı. Yöneticinizden Yönetim → Mobil Cihazlar'da yeni karekod isteyin."],
  "kapi-lisans": [403, "Lisans geçerli değil; uzaktan erişim kapalı."],
  "kapi-lisans-dogrulanamadi": [503, "Lisans bir saattir doğrulanamadı; uzaktan erişim geçici olarak kapalı."],
  "kapi-ozet-yok": [404, "Bu ofisin özeti henüz yüklenmedi."],
  "kapi-yazma": [403, "Özet yalnız ofis sunucusundan yazılır; telefondan yazılamaz."],
  "kapi-yol": [404, "Bu adres uzaktan erişime açık değil."],
  "kapi-ofis-kapali": [503, "Ofis sunucusuna ulaşılamıyor (kapalı ya da internete bağlı değil)."],
  "kapi-sinir": [409, "Eşli cihaz sınırı dolu. Yeni cihaz için önce birini silin."],
  "kapi-ofis-anahtari": [409, "Bu ofis kimliği başka bir anahtarla kayıtlı."],
  "kapi-sira": [409, "Bu yükleme daha yeni bir yüklemenin gerisinde (yeniden oynatma)."],
  "kapi-yaris": [409, "Eşzamanlı güncelleme; yeniden deneyin."],
  "kapi-hiz": [429, "Çok sık istek; biraz sonra yeniden deneyin."],
  "kapi-gunluk": [429, "Bu ofisin bugünkü yükleme sınırı doldu."],
  "kapi-cerez": [400, "Tarayıcıda bu adres için çakışan oturum bilgisi var. Tarayıcının bu siteye ait kayıtlı verilerini silip karekodu yeniden okutun."],
  "kapi-ofis-degisti": [410, "Bu ofis kimliği kapandı: aynı lisans yeni bir kurulumla kaydoldu. Yöneticinizden yeni karekod isteyin."],
  "kapi-kanca-dogrulama": [403, "Doğrulama belirteci geçersiz."],
});
const GUVENLIK = { "x-content-type-options": "nosniff", "cache-control": "no-store", "referrer-policy": "no-referrer" };
// 2.4.8 W9: WhatsApp durum bildirimi geçişi (madde 8).
const KANCA_YOLU = /^\/wa\/kanca\/[A-Za-z0-9_-]{43}$/;
const KANCA = Object.freeze({ azamiBayt: 3 * 1024 * 1024, dakikada: 600 });

// Başlık değeri dizi olabilir (birden çok Set-Cookie).
function basliklarKur(nesne) {
  const h = new Headers();
  for (const [ad, deger] of Object.entries(nesne)) for (const tek of [].concat(deger)) h.append(ad, String(tek));
  return h;
}
const json = (status, body, extra = {}) => new Response(JSON.stringify(body), { status, headers: basliklarKur({ "content-type": "application/json; charset=utf-8", ...GUVENLIK, ...extra }) });
const hata = (kod, ek = {}, basliklar = {}) => {
  const [status, error] = HATA[kod];
  return json(status, { ok: false, code: kod, error, ...ek }, basliklar);
};

// 2.4.8 M3 — TARAYICI gezintisine (adres çubuğu, karekod, bağlantı) hata ham JSON yerine Türkçe HTML sayfa olarak döner (CLAUDE.md "KULLANICI BULGUSU 2.4.7 CANLI":
// telefonda karekod → ham "kapi-ofis-kapali" JSON'u). Durum kodu, Set-Cookie (çerez silme) ve güvenlik başlıkları AYNEN; yalnız gövde ve içerik türü değişir.
// Mobil istemci (client/mobil/app.js fetch; x-requested-with, Sec-Fetch-Mode cors/same-origin, Accept */*) ve program uçları JSON almaya devam eder.
// Hizmet çalışanı (client/mobil/sw.js) gezintiyi kendisi iletir: yanıt başarısızsa (HTML de olsa) önbellekteki kabuğu açar — davranış değişmez.
const SAYFA_BASLIGI = Object.freeze({
  "kapi-ofis-kapali": "Ofis Sunucusuna Ulaşılamıyor",
  "kapi-ofis-yok": "Ofis Bulunamadı",
  "kapi-ofis-degisti": "Ofis Kimliği Değişti",
  "kapi-cihaz": "Cihaz Eşli Değil",
  "kapi-lisans": "Uzaktan Erişim Kapalı",
  "kapi-lisans-dogrulanamadi": "Uzaktan Erişim Geçici Olarak Kapalı",
  "kapi-yol": "Sayfa Bulunamadı",
  "kapi-hiz": "Çok Sık İstek",
  "kapi-cerez": "Tarayıcı Verisi Çakışıyor",
});
const SAYFA_IPUCU = Object.freeze({
  "kapi-ofis-kapali": [
    "Ofisteki bilgisayar kapalı, DestekOfis çalışmıyor ya da ofisin internet bağlantısı kesik olabilir.",
    // 2.4.8 M4/M5: iPhone'da eşleme ana ekran simgesinin içinde yapılır (Safari'deki eşleme simgeye geçmez); son özet giriş ekranındaki "Son Özeti Göster" ile açılır.
    "Birkaç dakika sonra sayfayı yenileyin. Cihazınız eşliyse DestekOfis'i eşlediğiniz yerden açın (iPhone'da ana ekrandaki DestekOfis simgesi) ve Son Özeti Göster'e basarak son yüklenen bilgileri görün.",
  ],
  "kapi-lisans-dogrulanamadi": ["Birkaç dakika sonra sayfayı yenileyin; sorun sürerse yöneticinize haber verin."],
  "kapi-hiz": ["Bir dakika bekleyip sayfayı yenileyin."],
});
const kacir = metin => String(metin).replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]);
/** İstek bir tarayıcı sayfa gezintisi mi (fetch/XHR değil)? Sec-Fetch-Mode varsa yalnız "navigate"; yoksa (eski tarayıcı) Accept text/html. */
function tarayiciGezintisi(request) {
  if (request.method !== "GET" && request.method !== "HEAD") return false;
  if (request.headers.get("x-requested-with")) return false;
  const mod = request.headers.get("sec-fetch-mode");
  if (mod) return mod === "navigate";
  return /\btext\/html\b/i.test(request.headers.get("accept") || "");
}
const SAYFA_STILI = "font-family:system-ui,sans-serif;padding:24px;max-width:520px;margin:auto;color:#102a36;line-height:1.5";
function hataSayfasi(request, status, kod, ileti, basliklar = {}) {
  const baslik = SAYFA_BASLIGI[kod] || "Sayfa Açılamadı";
  const ipuclari = (SAYFA_IPUCU[kod] || []).map(p => `<p>${kacir(p)}</p>`).join("");
  const govde = `<!doctype html><html lang="tr"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${kacir(baslik)} — DestekOfis Mobil</title><body style="${SAYFA_STILI}"><h1 style="font-size:22px">${kacir(baslik)}</h1><p>${kacir(ileti)}</p>${ipuclari}<p><a href="" style="display:inline-block;padding:10px 18px;border-radius:8px;background:#0f6a8b;color:#fff;text-decoration:none">Yeniden Dene</a></p><p style="font-size:12px;color:#5b6b73">Hata kodu: ${kacir(kod)}</p></body></html>`;
  return new Response(request.method === "HEAD" ? null : govde, {
    status,
    headers: basliklarKur({ "content-type": "text/html; charset=utf-8", ...GUVENLIK, "content-security-policy": "default-src 'none'; style-src 'unsafe-inline'", ...basliklar }),
  });
}
/** Hata yanıtı: tarayıcı gezintisine HTML sayfa, öbürlerine (mobil istemci, program) JSON. */
const hataYaniti = (request, kod, ek = {}, basliklar = {}) => {
  if (!tarayiciGezintisi(request)) return hata(kod, ek, basliklar);
  const [status, error] = HATA[kod];
  return hataSayfasi(request, status, kod, error, basliklar);
};

class KapiHatasi extends Error {
  constructor(kod, ek = {}, basliklar = {}) {
    super(kod);
    this.kod = kod;
    this.ek = ek;
    this.basliklar = basliklar;
  }
}
const at = (kod, ek, basliklar) => {
  throw new KapiHatasi(kod, ek, basliklar);
};

/**
 * Kökenin (ofisin tüneli) yanıtı: Domain öznitelikli Set-Cookie DÜŞÜRÜLÜR (bir ofisin sayfası üst alana / başka ofise çerez koyamasın; program hiçbir
 * çerezi Domain'li yazmaz — B4). sil: kapıcının ekleyeceği silme satırları; köken aynı adlı çerezi zaten yazıyorsa (ör. eşlemenin yeni cihaz çerezi) eklenmez.
 */
function kokenYaniti(yanit, sil = []) {
  const cerezler = yanit.headers.getSetCookie?.() || [];
  const kalan = cerezler.filter(satir => !setCookieAlanli(satir));
  const ekle = sil.filter(satir => !kalan.some(k => setCookieAdi(k) === setCookieAdi(satir)));
  if (kalan.length === cerezler.length && !ekle.length) return yanit;
  const h = new Headers(yanit.headers);
  h.delete("set-cookie");
  for (const satir of [...kalan, ...ekle]) h.append("set-cookie", satir);
  return new Response(yanit.body, { status: yanit.status, statusText: yanit.statusText, headers: h });
}

/**
 * Kapıcı örneği. Üretimde varsayılanlarla (export default); testlerde sahte saat, sahte lisans servisi, sahte köken (ofisin tüneli) ve önbellekle.
 * @param {object} [o]
 * @param {() => number} [o.now] saat (ms)
 * @param {(request: Request, ofis: string) => Promise<Response>} [o.fetchOrigin] ofisin tüneline iletim (üretimde rota kökeni: fetch(request))
 * @param {typeof fetch} [o.lisansFetch] lisans servisine istek
 * @param {{ match(req): Promise<Response|undefined>, put(req, res): Promise<void> }} [o.onbellek] lisans önbelleği (üretimde caches.default)
 * @param {object} [o.cloudflare] Cloudflare tünel/DNS istemcisi (testte sahte; yoksa env'deki ayarla, ayar yoksa kayıtta temizlik yapılmaz — B3)
 * @param {typeof fetch} [o.waFetch] 2.4.8 W7: Meta'ya kod → belirteç değişimi isteği (testte sahte Meta)
 */
export function createKapi({ now = () => Date.now(), fetchOrigin = request => fetch(request), lisansFetch = (...a) => fetch(...a), onbellek = null, cloudflare = null, waFetch = (...a) => fetch(...a) } = {}) {
  const pencere = new Map(); // hız sınırı (isolate içi; HIZ bağlaması yoksa)
  const yenileniyor = new Map(); // ofis → lisans yenileme sözü (aynı anda tek istek)
  const sonDeneme = new Map(); // ofis → son başarısız yenileme anı (servise yük bindirmesin)
  const cache = () => onbellek || globalThis.caches?.default || null;
  // B3: devre dışı ofisin tüneli + DNS kaydı (Cloudflare ayarı yoksa null → yalnız kapatılır, temizlik makine nesnesinde bekler).
  const temizleyici = env => {
    const cf = cloudflare || cloudflareVarsa(env);
    const alan = String(env.OFIS_ALANI || "destekofis.net").toLowerCase();
    return cf ? (eski, devam) => ofisTuneliniSil(cf, eski, alan, devam) : null;
  };

  const guvenilen = env => {
    try {
      return JSON.parse(env.LISANS_ANAHTARLARI || "{}");
    } catch {
      return {};
    }
  };

  async function hizDenetle(env, tur, anahtar, sinir) {
    if (env.HIZ?.limit) {
      const { success } = await env.HIZ.limit({ key: `${tur}|${anahtar}` });
      if (!success) at("kapi-hiz");
      return;
    }
    const dakika = Math.floor(now() / 60_000);
    const k = `${tur}|${anahtar}|${dakika}`;
    const n = (pencere.get(k) || 0) + 1;
    pencere.set(k, n);
    if (pencere.size > 5000) for (const key of pencere.keys()) if (!key.endsWith(`|${dakika}`)) pencere.delete(key);
    if (n > sinir) at("kapi-hiz");
  }

  async function metaOku(env, ofis) {
    const nesne = await env.OZET.get(metaAnahtari(ofis));
    if (!nesne) return null;
    return { veri: await nesne.json(), etag: nesne.etag };
  }

  // ---------- Lisans görünümü (P9) ----------
  const onbellekIstegi = ofis => new Request(`https://kapi.onbellek.invalid/lisans/${ofis}`);
  async function onbellektenLisans(ofis) {
    try {
      const yanit = await cache()?.match(onbellekIstegi(ofis));
      return yanit ? await yanit.json() : null;
    } catch {
      return null;
    }
  }
  async function onbellegeYaz(ofis, zarf) {
    try {
      await cache()?.put(onbellekIstegi(ofis), new Response(JSON.stringify(zarf), { headers: { "content-type": "application/json", "cache-control": "max-age=3600" } }));
    } catch {
      // önbellek yalnız hızlandırır; yazılamazsa sonraki istek servise sorar
    }
  }
  async function servistenYenile(env, meta) {
    if (!env.LISANS_URL || !meta.lisansKimligi) return null;
    const son = sonDeneme.get(meta.ofis) || 0;
    if (now() - son < 60_000) return null;
    if (!yenileniyor.has(meta.ofis)) {
      yenileniyor.set(
        meta.ofis,
        (async () => {
          try {
            const yanit = await lisansFetch(`${String(env.LISANS_URL).replace(/\/+$/, "")}/v1/kapi/durum`, {
              method: "POST",
              headers: { "content-type": "application/json", accept: "application/json", ...(env.KAPI_LISANS_ANAHTARI ? { authorization: `Bearer ${env.KAPI_LISANS_ANAHTARI}` } : {}) },
              body: JSON.stringify({ licenseId: meta.lisansKimligi, machine: meta.makine }),
            });
            const govde = await yanit.json().catch(() => null);
            // 2.4.8 S-L1a: servis bu lisansı / makineyi AÇIKÇA tanımıyor (LICENSE_NOT_FOUND; site kapi_durum_impl). Ağ hatası, 5xx, zaman aşımı, yetki (UNAUTHORIZED)
            // ya da biçim (BAD_REQUEST) hatası "tanımıyor" SAYILMAZ (yanlış ayarlı anahtar bütün ofisleri sildirmesin).
            if (govde?.ok === false && govde.code === "LICENSE_NOT_FOUND") {
              sonDeneme.set(meta.ofis, now());
              return { tanimiyor: true };
            }
            if (!govde?.ok || !govde.token) throw new Error("lisans servisi belirteç vermedi");
            const iddia = await lisansDogrula(govde.token, guvenilen(env));
            if (!iddia || iddia.machine !== meta.makine) throw new Error("belirteç bu ofise ait değil");
            await onbellegeYaz(meta.ofis, govde.token);
            sonDeneme.delete(meta.ofis);
            return { token: govde.token };
          } catch {
            sonDeneme.set(meta.ofis, now());
            return null;
          } finally {
            yenileniyor.delete(meta.ofis);
          }
        })(),
      );
    }
    return yenileniyor.get(meta.ofis);
  }
  /** Dönüş: { durum: "gecerli" | "gecersiz" | "dogrulanamadi", iddia, tanimiyor? }. Adaylar: kayıttaki belirteç, önbellek, gerekirse servisten yeni. Tazelik: imzalı
   * issuedAt. tanimiyor: true → belirteç bayat ve servis bu lisansı açıkça tanımadı (S-L1a; temizlik.mjs 60 gün kuralı). */
  async function lisansGorunumu(env, meta) {
    const keys = guvenilen(env);
    const adaylar = [];
    for (const zarf of [meta.lisans, await onbellektenLisans(meta.ofis)]) {
      const iddia = zarf ? await lisansDogrula(zarf, keys) : null;
      if (iddia && iddia.machine === meta.makine) adaylar.push(iddia);
    }
    let en = adaylar.sort((a, b) => b.issuedAt - a.issuedAt)[0] || null;
    let tanimiyor = false;
    if (!en || now() - en.issuedAt >= K.lisansYenileMs) {
      const yanit = await servistenYenile(env, meta);
      tanimiyor = Boolean(yanit?.tanimiyor);
      const iddia = yanit?.token ? await lisansDogrula(yanit.token, keys) : null;
      if (iddia && (!en || iddia.issuedAt >= en.issuedAt)) en = iddia;
    }
    if (!en || now() - en.issuedAt >= K.lisansTazeMs) return { durum: "dogrulanamadi", iddia: en, ...(tanimiyor ? { tanimiyor: true } : {}) };
    // 2.4.8 L1: mobil kullanım hakkı (kapi-protokol mobilHakki — programla AYNI kural): "hosgoru" = ücretli lisans bitti, 30 gün salt okunur (canlı + son özet
    // geçer; yeni cihaz eklenmez).
    const hak = mobilHakki(en, now());
    return { durum: hak.durum === "gecerli" ? "gecerli" : hak.acik ? "hosgoru" : "gecersiz", iddia: en, hak };
  }
  // Ret yanıtının iletisi hakkın durumuna göre (ör. "Mobil kullanım hakkınız sona erdi; lisansınızı yenileyin."); mobilHak telefonun ayırt etmesi için.
  const lisansEki = g => {
    const ileti = mobilHakIletisi(g?.hak);
    return ileti ? { error: ileti, mobilHak: g.hak.durum } : {};
  };
  // Erişim (canlı kapı, son özet, tünel): geçerli lisans ya da hoşgörü.
  async function lisansIste(env, meta) {
    const g = await lisansGorunumu(env, meta);
    if (g.durum === "dogrulanamadi") at("kapi-lisans-dogrulanamadi");
    if (g.durum !== "gecerli" && g.durum !== "hosgoru") at("kapi-lisans", lisansEki(g));
    return g;
  }
  // Telefona hakkın uyarısı (son 7 gün / hoşgörü): yanıt başlığında, cümle metni kodlanmış (başlık değeri ASCII olmalı). Uyarı yoksa başlık yok.
  const hakBasligi = g => {
    const ileti = mobilHakIletisi(g?.hak);
    return ileti ? { "x-do-mobil-ileti": encodeURIComponent(ileti) } : {};
  };

  // ---------- Program (ofis sunucusu) uçları ----------
  async function ofisImzasi(request, yol, govdeMetni, anahtar) {
    const ms = Number(request.headers.get("x-do-zaman"));
    if (!Number.isSafeInteger(ms) || Math.abs(now() - ms) > K.zamanPayiMs) at("kapi-zaman", { zaman: now() });
    const ozet = await sha256Hex(govdeMetni);
    if (!(await ecdsaDogrula(anahtar, mesaj.ofis(request.method, yol, ms, ozet), request.headers.get("x-do-imza") || ""))) at("kapi-imza");
    return ms;
  }
  async function govdeOku(request, azami) {
    const boy = Number(request.headers.get("content-length") || 0);
    if (boy > azami) at("kapi-buyuk");
    const tampon = await request.arrayBuffer();
    if (tampon.byteLength > azami) at("kapi-buyuk");
    return new TextDecoder().decode(tampon);
  }

  async function kayit(request, env, ofis, yol) {
    const metin = await govdeOku(request, K.kayitAzamiBayt);
    let govde;
    try {
      govde = JSON.parse(metin);
    } catch {
      at("kapi-istek");
    }
    if (!govde || govde.v !== 1 || govde.ofis !== ofis) at("kapi-istek");
    const mevcut = await metaOku(env, ofis);
    const yeniAnahtar = acikAnahtar(govde.anahtar);
    if (!yeniAnahtar) at("kapi-istek");
    if (mevcut && !ayniAnahtar(mevcut.veri.anahtar, yeniAnahtar)) at("kapi-ofis-anahtari");
    // 2.4.8 L1: kaydı silinmiş ofisin kimliği yalnız AYNI anahtarla yeniden açılır (silinen kaydın izi anahtarı tutar; ofis kimliği herkese açık DNS adıdır).
    const mezar = mevcut ? null : await mezarOku(env, ofis);
    if (mezar && !ayniAnahtar(mezar.anahtar, yeniAnahtar)) at("kapi-ofis-anahtari");
    const ms = await ofisImzasi(request, yol, metin, yeniAnahtar);
    if (govde.zaman !== ms) at("kapi-istek");
    // Eski bir kaydın yeniden oynatılması (silinmiş cihazı geri getirir) reddedilir: kayıt zamanı kesin artar.
    if (mevcut && ms <= mevcut.veri.sonKayit) at("kapi-sira");
    if (!/^[A-Za-z0-9_-]{43}$/.test(String(govde.sir || ""))) at("kapi-istek");
    const iddia = await lisansDogrula(govde.lisans, guvenilen(env));
    if (!iddia) at("kapi-lisans");
    // B3 + dar kontrol K1 (BAŞ MİMAR KARARI "son kaydolan kazanır", yaygın tek kullanımlık lisans düzeni): makineyi geçerli imzalı kaydı olan HER ofis
    // devralabilir — yeni ofis kimliği de, yerini bırakmış ya da devre dışı kalmış ofis de (yeniden kurulumdan sonra eski veri klasörü geri yüklendi, fazla
    // kurulum kaldırıldı; aksi hâlde asıl kurulumun mobili kalıcı kapanırdı ve programda çaresi yoktu). Her devralma makinenin günlük ofis değişimi
    // sınırına sayılır (makineKaydi); önceki ofis kayıttan sonra kapatılır (kayitSonrasi); aynı anda yine tek ofis geçer (guncelMi).
    const cihazlar = Array.isArray(govde.cihazlar) ? govde.cihazlar : at("kapi-istek");
    if (cihazlar.length > 100) at("kapi-istek");
    const temiz = [];
    const gorulen = new Set();
    for (const c of cihazlar) {
      const anahtar = acikAnahtar(c?.anahtar);
      if (!CIHAZ_KIMLIGI.test(String(c?.id || "")) || !anahtar || gorulen.has(c.id)) at("kapi-istek");
      gorulen.add(c.id);
      temiz.push({ id: c.id, anahtar });
    }
    const eski = mevcut?.veri || null;
    // Yeni belirteç ancak eskisinden yeniyse kayda geçer (eski belirteçle lisans geri alınamaz).
    let lisans = govde.lisans;
    if (eski?.lisans) {
      const onceki = await lisansDogrula(eski.lisans, guvenilen(env));
      if (onceki && onceki.machine === iddia.machine && onceki.issuedAt > iddia.issuedAt) lisans = eski.lisans;
    }
    const meta = { v: 1, ofis, anahtar: yeniAnahtar, makine: iddia.machine, lisansKimligi: iddia.licenseId, lisans, cihazlar: eski?.cihazlar || [], sir: govde.sir, sonKayit: ms, sira: eski?.sira || 0 };
    const gorunum = await lisansGorunumu(env, meta);
    // K13: kapıcı sınırı programdan bağımsız. Eklenen cihaz varsa toplam sınırı aşamaz; P5: sayı düşünce mevcutlar sürer (ekleme yoksa kabul).
    const sinir = gorunum.iddia?.mobileDevices ?? 3;
    // Devre dışı kalıp dönen ofisin o dönemdeki cihazları da "mevcut" (dar kontrol K1 bulgu 2: sınır düşmüşse P5 gereği sürer).
    const eskiKimlikler = new Set([...(eski?.cihazlar || []).map(c => c.id), ...(eski?.devreDisi?.cihazlar || [])]);
    const eklenen = temiz.filter(c => !eskiKimlikler.has(c.id));
    let cihazHatasi = null;
    if (gorunum.durum === "dogrulanamadi") cihazHatasi = "kapi-lisans-dogrulanamadi";
    // 2.4.8 L1: hoşgörüde (ücretli lisans bitti, 30 gün salt okunur) mevcut cihazlar sürer, yeni cihaz eklenmez.
    else if (gorunum.durum === "hosgoru") cihazHatasi = eklenen.length ? "kapi-lisans" : null;
    else if (gorunum.durum !== "gecerli") cihazHatasi = "kapi-lisans";
    else if (eklenen.length && temiz.length > sinir) cihazHatasi = "kapi-sinir";
    const silindi = mezar ? { ms: mezar.ms, neden: mezar.neden } : null;
    // 2.4.8 L1: lisansı geçersiz (bitmiş / engelli) YENİ ofis — kaydı silinmiş ofis dahil — kapıcıya yazılmaz; silinmekte olan ofisin kaydı da lisans geçersizken
    // yeniden yazılmaz (temizlik turu yarıda kesilmesin). Kayıtlı ofisin geçersiz lisansla kaydı önceki gibi yazılır (cihaz silme her durumda uygulanır).
    if (gorunum.durum === "gecersiz" && (!mevcut || eski?.silme)) at("kapi-lisans", { ...lisansEki(gorunum), ...(silindi ? { silindi } : {}) });
    // Cihaz EKLEME yalnız lisans geçerliyken ve sınır içinde; silme (listeden çıkan cihaz) her durumda uygulanır (güvenlik: silinen cihaz hemen düşer).
    // 2.4.8 L1: silinmiş kayıt geri GELMEZ — programın listesindeki cihazlar alınmaz (telefonlar karekodla yeniden eşlenir; eski çerezleri canlı kapıda silinir).
    meta.cihazlar = silindi ? [] : cihazHatasi ? temiz.filter(c => eskiKimlikler.has(c.id)) : temiz;
    // B1: listeden çıkan cihazların kimliği (canlı kapı eski çerezini tanıyıp siler; yeni eşlenip kaydı henüz gelmemiş cihazın çerezi silinmez).
    const guncel = meta.cihazlar.map(c => c.id);
    meta.silinen = silinenBirlestir([...eskiKimlikler, ...(silindi ? temiz.map(c => c.id) : [])].filter(id => !guncel.includes(id)), eski?.silinen, guncel);
    // 2.4.8 L1: engelin kapıcıca ilk görüldüğü an (kayıt silme süresi engelden 30 gün; temizlik.mjs). Engel kalkınca düşer.
    if (gorunum.iddia?.status === "blocked") meta.engel = eski?.engel?.ms ? eski.engel : { ms: now() };
    // B3: makine → ofis tek eşleme (makine başına saatlik kayıt ve günlük ofis değişimi sınırı) ofis kaydından ÖNCE; değişimde önceki ofis kayıttan sonra
    // kapatılır (kayitSonrasi). 2.4.8 K1 (c): kapıcı genelindeki günlük yeni ofis tavanı kayıttan TÜNEL/DNS AÇILIŞINA taşındı (bulut/kapi/tunel.mjs) — her
    // kurulum açılışta kaydolduğundan tavan "günlük yeni kurulum" sayıyor, imzalı deneme belirteçleriyle doldurulunca o günün kurulumlarının mobili kapanıyordu;
    // korunan kaynak DNS kotası (ücretsiz alanda 200 kayıt) ve yalnız tünel açılışında harcanır.
    await makineKaydi(env, { makine: iddia.machine, ofis, simdi: now() });
    const yazildi = await env.OZET.put(metaAnahtari(ofis), JSON.stringify(meta), {
      httpMetadata: { contentType: "application/json" },
      ...(mevcut ? { onlyIf: { etagMatches: mevcut.etag } } : {}),
    });
    if (!yazildi) at("kapi-yaris");
    await onbellegeYaz(ofis, lisans);
    if (mezar) await env.OZET.delete(mezarAnahtari(ofis));
    await kayitSonrasi(env, { makine: iddia.machine, ofis, simdi: now(), temizle: temizleyici(env) });
    if (cihazHatasi) at(cihazHatasi, { cihaz: meta.cihazlar.length, sinir, ...(cihazHatasi === "kapi-lisans" ? lisansEki(gorunum) : {}), ...(silindi ? { silindi } : {}) });
    // 2.4.8 K1 (b) (2.4.7 dar kontrol 2 KUŞKU): ofisin özeti kapıcıda var mı — makineyi geri alan (devralan) ofisin özeti kapatılırken silinmişti; program bunu
    // görünce özeti HEMEN yükler (bir sonraki veri değişikliğini beklemez).
    const ozetVar = Boolean(await env.OZET.head(ozetAnahtari(ofis)));
    return json(200, { ok: true, data: { ofis, cihaz: meta.cihazlar.length, sinir, ozet: ozetVar, ...(silindi ? { silindi } : {}) } });
  }

  // B3: ofis devre dışıysa ya da makinesinin eşlemesi başka ofisi gösteriyorsa (yarışta kapanmamış eski ofis) 410; ikinci durumda ofis kapatılır.
  async function gunceliIste(env, meta) {
    if (!(await guncelMi(env, meta, now()))) at("kapi-ofis-degisti");
  }

  async function ozetYukle(request, env, ofis, yol) {
    const mevcut = await metaOku(env, ofis);
    if (!mevcut) at("kapi-ofis-yok");
    const meta = mevcut.veri;
    const metin = await govdeOku(request, K.ozetAzamiBayt);
    await ofisImzasi(request, yol, metin, meta.anahtar);
    let zarf;
    let govde;
    try {
      zarf = JSON.parse(metin);
      govde = JSON.parse(zarf.govde);
    } catch {
      at("kapi-istek");
    }
    // Özetin kendi imzası (telefonun da doğruladığı): kapıcı içini okumaz, yalnız kimin yazdığını ve sırasını denetler.
    if (zarf?.v !== 1 || typeof zarf.govde !== "string" || !(await ecdsaDogrula(meta.anahtar, zarf.govde, zarf.imza || ""))) at("kapi-imza");
    if (govde?.ofis !== ofis || !Number.isSafeInteger(govde.sira)) at("kapi-istek");
    // B3: yalnız makinenin güncel ofisi özet yükler (devre dışı ya da eşlemesi başka ofise geçmiş → kapatılır, 410).
    await gunceliIste(env, meta);
    await lisansIste(env, meta);
    const onceki = await env.OZET.head(ozetAnahtari(ofis));
    const oncekiSira = Math.max(meta.sira || 0, Number(onceki?.customMetadata?.sira || 0));
    if (govde.sira <= oncekiSira) at("kapi-sira");
    const gun = trGunu(now());
    const sayac = onceki?.customMetadata?.gun === gun ? Number(onceki.customMetadata.sayac || 0) : 0;
    if (sayac >= K.gunlukYukleme) at("kapi-gunluk");
    await hizDenetle(env, "yukle", ofis, K.dakikadaYukleme);
    const yazildi = await env.OZET.put(ozetAnahtari(ofis), metin, {
      httpMetadata: { contentType: "application/json" },
      customMetadata: { sira: String(govde.sira), uretim: String(govde.uretim || ""), gun, sayac: String(sayac + 1), son: String(now()) },
      ...(onceki ? { onlyIf: { etagMatches: onceki.etag } } : {}),
    });
    if (!yazildi) at("kapi-yaris");
    return json(200, { ok: true, data: { sira: govde.sira, bayt: metin.length } });
  }

  async function ozetSil(request, env, ofis, yol, url) {
    const mevcut = await metaOku(env, ofis);
    if (!mevcut) return json(200, { ok: true, data: { silindi: false } });
    await ofisImzasi(request, `${yol}${url.search}`, "", mevcut.veri.anahtar);
    if (mevcut.veri.devreDisi) at("kapi-ofis-degisti");
    const sira = Number(url.searchParams.get("sira"));
    const onceki = await env.OZET.head(ozetAnahtari(ofis));
    const oncekiSira = Math.max(mevcut.veri.sira || 0, Number(onceki?.customMetadata?.sira || 0));
    if (!Number.isSafeInteger(sira) || sira <= oncekiSira) at("kapi-sira");
    // Sıra meta'ya yazılır: silinmiş özetin eski (imzalı) yüklemesi yeniden oynatılıp geri getirilemez.
    const yazildi = await env.OZET.put(metaAnahtari(ofis), JSON.stringify({ ...mevcut.veri, sira }), { httpMetadata: { contentType: "application/json" }, onlyIf: { etagMatches: mevcut.etag } });
    if (!yazildi) at("kapi-yaris");
    await env.OZET.delete(ozetAnahtari(ofis));
    return json(200, { ok: true, data: { silindi: Boolean(onceki) } });
  }

  // ---------- Cihaz uçları (ofisin telefon adresinde) ----------
  async function cihazIste(request, env, meta, yol) {
    const id = String(request.headers.get("x-do-cihaz") || "");
    const cihaz = CIHAZ_KIMLIGI.test(id) ? (meta?.cihazlar || []).find(c => c.id === id) : null;
    if (!cihaz) at("kapi-cihaz");
    const ms = Number(request.headers.get("x-do-zaman"));
    if (!Number.isSafeInteger(ms) || Math.abs(now() - ms) > K.zamanPayiMs) at("kapi-zaman", { zaman: now() });
    if (!(await ecdsaDogrula(cihaz.anahtar, mesaj.cihaz(request.method, yol, id, ms), request.headers.get("x-do-imza") || ""))) at("kapi-imza");
    return cihaz;
  }

  async function ozetOku(request, env, ofis) {
    const mevcut = await metaOku(env, ofis);
    // B3: makinesinin güncel ofisi değilse (devre dışı) cihaz listesi boş sayılır → kapi-cihaz (telefon "eşli değil" ekranına döner).
    const cihaz = await cihazIste(request, env, (await guncelMi(env, mevcut?.veri, now())) ? mevcut.veri : null, "/kapi/ozet");
    await hizDenetle(env, "ozet", `${ofis}|${cihaz.id}`, K.dakikadaOzet);
    const gorunum = await lisansIste(env, mevcut.veri);
    if (request.method !== "GET" && request.method !== "HEAD") at("kapi-yazma");
    const nesne = await env.OZET.get(ozetAnahtari(ofis));
    if (!nesne) at("kapi-ozet-yok");
    // 2.4.8 L1: son 7 gün / hoşgörü uyarısı telefona (sunucu kapalıyken de "Lisansınız bitti; mobil kullanım hakkınız N gün sonra sona erecek.").
    const basliklar = { etag: nesne.etag, "x-do-sira": String(nesne.customMetadata?.sira || ""), "x-do-uretim": String(nesne.customMetadata?.uretim || ""), ...hakBasligi(gorunum) };
    if ((request.headers.get("if-none-match") || "") === nesne.etag) return new Response(null, { status: 304, headers: { ...GUVENLIK, ...basliklar } });
    return new Response(request.method === "HEAD" ? null : nesne.body, { status: 200, headers: { "content-type": "application/json; charset=utf-8", ...GUVENLIK, ...basliklar } });
  }

  // ---------- 2.4.8 W9: WhatsApp durum bildirimi (madde 8) ----------
  async function govdeTampon(request, azami) {
    const boy = Number(request.headers.get("content-length") || 0);
    if (boy > azami) at("kapi-buyuk");
    const tampon = new Uint8Array(await request.arrayBuffer());
    if (tampon.byteLength > azami) at("kapi-buyuk");
    return tampon;
  }
  /** X-Hub-Signature-256 ("sha256=<onaltılık HMAC-SHA256(gövde, uygulama sırrı)>"; D0-16) DestekOfis uygulama sırrıyla doğru mu. Sır yoksa false. */
  async function metaImzasi(env, govde, baslik) {
    const sir = String(env.WA_UYGULAMA_SIRRI || "");
    const verilen = /^sha256=([0-9a-f]{64})$/i.exec(String(baslik || "").trim());
    if (!sir || !verilen) return false;
    const anahtar = await globalThis.crypto.subtle.importKey("raw", new TextEncoder().encode(sir), { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
    const imza = new Uint8Array(await globalThis.crypto.subtle.sign("HMAC", anahtar, govde));
    return esitMi([...imza].map(b => b.toString(16).padStart(2, "0")).join(""), verilen[1].toLowerCase());
  }
  async function waKanca(request, env, ofis, url) {
    const yontem = request.method === "HEAD" ? "GET" : request.method;
    if (!KANCA_YOLU.test(url.pathname) || (yontem !== "GET" && yontem !== "POST")) at("kapi-yol");
    const mevcut = await metaOku(env, ofis);
    const meta = mevcut?.veri || null;
    if (!meta) at("kapi-ofis-yok");
    if (!(await guncelMi(env, meta, now()))) at("kapi-ofis-degisti");
    await hizDenetle(env, "kanca", ofis, KANCA.dakikada);
    const govde = yontem === "POST" ? await govdeTampon(request, KANCA.azamiBayt) : null;
    const cihaz = govde && (await metaImzasi(env, govde, request.headers.get("x-hub-signature-256"))) ? "wa1" : "wa0";
    const yolSorgu = `${url.pathname}${url.search}`;
    const ms = now();
    // Meta'nın başlıkları (çerez, kimlik, imza) programa GEÇMEZ: yalnız içerik türü + kapıcı işareti.
    const basliklar = new Headers({ "x-do-kapi": `${ms}.${cihaz}.${await hmac(meta.sir, mesaj.vekil(yontem, yolSorgu, cihaz, ms))}` });
    if (govde) basliklar.set("content-type", request.headers.get("content-type") || "application/json");
    const iletilen = new Request(url.toString(), { method: yontem, headers: basliklar, body: govde || undefined, redirect: "manual" });
    let yanit;
    try {
      yanit = await fetchOrigin(iletilen, ofis);
    } catch {
      at("kapi-ofis-kapali");
    }
    const tur = String(yanit.headers.get("content-type") || "");
    if (yanit.status === 530 || ((yanit.status === 502 || yanit.status === 504) && !tur.includes("application/json"))) at("kapi-ofis-kapali");
    // Programın yanıtından yalnız durum ve gövde (çerez/başlık Meta'ya geçmez).
    const metin = await yanit.arrayBuffer();
    return new Response(yontem === "GET" && request.method === "HEAD" ? null : metin, { status: yanit.status, headers: basliklarKur({ "content-type": tur || "text/plain; charset=utf-8", ...GUVENLIK }) });
  }
  // Uygulamanın varsayılan kanca ucu (kapi.<alan>/wa/meta): doğrulama + imzalı olay 200 (saklanmaz; şablon/hesap olayları programın şablon okumasıyla da görülür).
  async function waMeta(request, env, url) {
    await hizDenetle(env, "wameta", request.headers.get("cf-connecting-ip") || "?", KANCA.dakikada);
    if (request.method === "GET") {
      const belirtec = String(env.WA_META_DOGRULAMA || "");
      if (url.searchParams.get("hub.mode") !== "subscribe" || !belirtec || !esitMi(String(url.searchParams.get("hub.verify_token") || ""), belirtec)) at("kapi-kanca-dogrulama");
      return new Response(String(url.searchParams.get("hub.challenge") || "").slice(0, 200), { status: 200, headers: basliklarKur({ "content-type": "text/plain; charset=utf-8", ...GUVENLIK }) });
    }
    if (request.method !== "POST") at("kapi-yol");
    const govde = await govdeTampon(request, KANCA.azamiBayt);
    if (!(await metaImzasi(env, govde, request.headers.get("x-hub-signature-256")))) at("kapi-imza");
    return json(200, { ok: true });
  }

  // Canlı bağlantı: ofisin tüneline (M4) kapıdan geçen istek. Cihaz kimliği programın HttpOnly cihaz çerezinin kimlik bölümünden (sırrı program doğrular).
  // Çerezler programla AYNI kuralla okunur (lib/mobil-cerez.mjs): aynı adlı iki cihaz/oturum çerezi → 400 kapi-cerez (B4; ilk ya da son seçilmez).
  // B1: listede olmayan cihaz çerezi eşleme ve sayfa yollarında "cihazsız" sayılır — iki mobil çerez iletilmez, işaret "-" ile; öbür yollarda 401 kapi-cihaz.
  // Kimliği bu ofisin silinmiş cihazlarındaysa (ya da biçimi bozuksa) çerez yanıtta silinir (Set-Cookie süresi geçmiş). Hiç görülmemiş kimlik (yeni eşlenip
  // kaydı kapıcıya henüz ulaşmamış cihaz olabilir) silinmez: silinseydi cihaz programda kayıtlı ama sırrını yitirmiş, yer tutan bir kayıt olarak kalırdı.
  async function vekil(request, env, ofis, url) {
    const mevcut = await metaOku(env, ofis);
    const meta = mevcut?.veri || null;
    const yontem = request.method === "HEAD" ? "GET" : request.method;
    const yolSorgu = `${url.pathname}${url.search}`;
    const cerezBasligi = request.headers.get("cookie") || "";
    if (cerezCakisiyor(cerezBasligi)) at("kapi-cerez");
    // B3: makinesinin güncel ofisi değilse (devre dışı) hiçbir cihaz geçmez; çerez YALNIZ programın sildiği cihazda silinir (dar kontrol K1 bulgu 1: ofis
    // dönerse aynı telefon yeniden eşlemesiz döner); cihazsız istek 410.
    const guncel = await guncelMi(env, meta, now());
    const etkinCihazlar = guncel ? meta.cihazlar || [] : [];
    const silinenler = meta?.silinen || [];
    // Cihazsız yalnız eşleme (karekod) ve sayfa dosyaları (eşleme ekranı; veri içermez — M2 BAŞ MİMAR KARARI 9).
    const eslesme = yontem === "POST" && url.pathname === "/api/mobil/eslesme";
    const sayfa = yontem === "GET" && url.pathname.startsWith("/mobil/");
    const ham = cerezOku(cerezBasligi, CIHAZ_CEREZI).deger;
    let cihaz = "-";
    let cihazsiz = false;
    let sil = [];
    if (ham) {
      const id = ham.split(".")[0];
      if (CIHAZ_KIMLIGI.test(id) && etkinCihazlar.some(c => c.id === id)) cihaz = id;
      else {
        if (!CIHAZ_KIMLIGI.test(id) || silinenler.includes(id)) sil = cerezSilSatirlari();
        if (!eslesme && !sayfa) at("kapi-cihaz", {}, sil.length ? { "set-cookie": sil } : {});
        cihazsiz = true;
      }
    } else if (cerezOku(cerezBasligi, OTURUM_CEREZI).deger) {
      // Cihaz çerezi olmadan oturum çerezi anlamsızdır (oturum cihaza bağlı); iletilmez.
      cihazsiz = true;
      if (!eslesme && !sayfa) at("kapi-cihaz");
    } else if (!eslesme && !sayfa) at("kapi-cihaz");
    try {
      if (!meta) at("kapi-ofis-yok");
      if (!guncel) at("kapi-ofis-degisti");
      await lisansIste(env, meta);
      if (yolSorunu(yolSorgu)) at("kapi-yol");
      await hizDenetle(env, "vekil", cihaz !== "-" ? `${ofis}|${cihaz}` : `${ofis}|${request.headers.get("cf-connecting-ip") || "?"}`, K.dakikadaVekil);
      const ms = now();
      const isaret = `${ms}.${cihaz}.${await hmac(meta.sir, mesaj.vekil(yontem, yolSorgu, cihaz, ms))}`;
      const basliklar = new Headers(request.headers);
      basliklar.delete("x-do-kapi");
      basliklar.set("x-do-kapi", isaret);
      if (cihazsiz) {
        const kalan = cerezCikar(cerezBasligi, MOBIL_CEREZLERI);
        if (kalan) basliklar.set("cookie", kalan);
        else basliklar.delete("cookie");
      }
      const iletilen = new Request(url.toString(), { method: request.method, headers: basliklar, body: yontem === "GET" ? undefined : request.body, redirect: "manual", ...(yontem === "GET" ? {} : { duplex: "half" }) });
      let yanit;
      try {
        yanit = await fetchOrigin(iletilen, ofis);
      } catch {
        at("kapi-ofis-kapali");
      }
      // Tünel kapalıyken Cloudflare 530 (1033) ya da HTML 502/504 verir: ofis kapalı sayılır. Programın kendi JSON yanıtı olduğu gibi geçer.
      const tur = String(yanit.headers.get("content-type") || "");
      if (yanit.status === 530 || ((yanit.status === 502 || yanit.status === 504) && !tur.includes("application/json"))) at("kapi-ofis-kapali");
      return kokenYaniti(yanit, sil);
    } catch (error) {
      if (error instanceof KapiHatasi && sil.length) error.basliklar = { ...error.basliklar, "set-cookie": sil };
      throw error;
    }
  }

  // 2.4.8 W7: "WhatsApp'ı Bağla" (bulut/kapi/wa-bagla.mjs): ofis imzası, lisans ve güncel ofis denetimi bu kapıcının işlevleriyle.
  const waBagla = createWaBagla({ now, lisansGorunumu, gunceliIste, hizDenetle, waFetch });

  const KARSILAMA = `<!doctype html><html lang="tr"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>DestekOfis Mobil</title><body style="font-family:system-ui,sans-serif;padding:24px;max-width:520px;margin:auto;color:#102a36"><h1 style="font-size:22px">DestekOfis Mobil</h1><p>Telefonunuzu ofisinizdeki DestekOfis'e bağlamak için yöneticinizin Yönetim → Mobil Cihazlar'da oluşturduğu karekodu okutun.</p><p>iPhone'da karekodla açılan sayfada Paylaş → Ana Ekrana Ekle'ye dokunun, sonra ana ekrandaki DestekOfis simgesini açıp Karekodu Okut ile aynı karekodu okutun. Android telefonda ve bilgisayarda karekodla açılan sayfada eşleyin.</p><p>Eşli cihazda DestekOfis'i eşlediğiniz yerden açın (iPhone'da ana ekrandaki simge).</p></body></html>`;

  async function fetchHandler(request, env) {
    const url = new URL(request.url);
    try {
      // 2.4.7 M4: tünel başvurusu (ofis imzası + lisans P9; Cloudflare hesap belirteci yalnız Worker gizlisinde).
      if (TUNEL_YOLU.test(url.pathname)) return await tunelIstegi(request, env, { now, lisansGorunumu, cloudflare });
      const alan = String(env.OFIS_ALANI || "destekofis.net").toLowerCase();
      const host = url.hostname.toLowerCase();
      // 2.4.8 W7: WhatsApp'ı Bağla — program uçları (imzalı, her adreste) ve bağlama sayfası (yalnız kapi.<alan>).
      const wa = await waBagla.istek(request, env, url, { kapiHost: host === `kapi.${alan}` });
      if (wa) return wa;
      // Program uçları (her adreste; imzalı).
      const program = /^\/v1\/ofis\/([^/]+)\/(kayit|ozet)$/.exec(url.pathname);
      if (program) {
        const [, ofis, uc] = program;
        if (!OFIS_KIMLIGI.test(ofis)) at("kapi-istek");
        if (uc === "kayit" && request.method === "POST") return await kayit(request, env, ofis, url.pathname);
        if (uc === "ozet" && request.method === "PUT") return await ozetYukle(request, env, ofis, url.pathname);
        if (uc === "ozet" && request.method === "DELETE") return await ozetSil(request, env, ofis, url.pathname, url);
        at("kapi-istek");
      }
      const ofis = host.endsWith(`.${alan}`) ? host.slice(0, -alan.length - 1) : "";
      // 2.4.8 W9: WhatsApp kancaları (madde 8).
      if (url.pathname === "/wa/meta" && !OFIS_KIMLIGI.test(ofis)) return await waMeta(request, env, url);
      if (url.pathname.startsWith("/wa/kanca/") && OFIS_KIMLIGI.test(ofis)) return await waKanca(request, env, ofis, url);
      if (!OFIS_KIMLIGI.test(ofis)) {
        return new Response(KARSILAMA, { status: 200, headers: { "content-type": "text/html; charset=utf-8", ...GUVENLIK, "content-security-policy": "default-src 'none'; style-src 'unsafe-inline'" } });
      }
      if (url.pathname === "/kapi/ozet") return await ozetOku(request, env, ofis);
      if (url.pathname.startsWith("/kapi/")) at("kapi-yol");
      return await vekil(request, env, ofis, url);
    } catch (error) {
      if (error instanceof KapiHatasi) return hataYaniti(request, error.kod, error.ek, error.basliklar);
      if (error instanceof MakineHatasi && HATA[error.kod]) return hataYaniti(request, error.kod, error.ek);
      if (tarayiciGezintisi(request)) return hataSayfasi(request, 500, "kapi-hata", "Kapıcı isteği işleyemedi. Birkaç dakika sonra yeniden deneyin.");
      return json(500, { ok: false, code: "kapi-hata", error: "Kapıcı isteği işleyemedi." });
    }
  }

  // 2.4.8 L1: zamanlanmış temizlik turu (Worker Cron → scheduled). Cloudflare ayarı yoksa yalnız R2 kayıtları silinir.
  const temizlik = async env => {
    const rapor = await mobilTemizlik(env, { now, lisansGorunumu, cloudflare: cloudflare || cloudflareVarsa(env), alan: String(env.OFIS_ALANI || "destekofis.net").toLowerCase() });
    // 2.4.8 W7: süresi geçen WhatsApp bağlama oturumları (şifreli; en çok 10 dk geçerli).
    rapor.waOturum = await waOturumTemizle(env, now()).catch(() => 0);
    return rapor;
  };

  return { fetch: fetchHandler, lisansGorunumu, esitMi, temizlik };
}

const varsayilan = createKapi();
export default {
  fetch: (request, env, ctx) => varsayilan.fetch(request, env, ctx),
  // wrangler.toml [triggers] crons: saatte bir (Worker günlüğüne tur özeti; gizli değer yazılmaz).
  scheduled: (_olay, env, ctx) =>
    ctx.waitUntil(
      varsayilan
        .temizlik(env)
        .then(rapor => console.log(`mobil temizlik: taranan ${rapor.taranan}, denetlenen ${rapor.denetlenen}, silinen ${rapor.silinen.length}, ertelenen ${rapor.ertelenen}, hata ${rapor.hata.length}`))
        .catch(error => console.error(`mobil temizlik durdu: ${error?.message || error}`)),
    ),
};
