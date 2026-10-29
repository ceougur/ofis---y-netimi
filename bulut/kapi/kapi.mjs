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
// Gizli değer hiçbir dosyaya yazılmaz: `wrangler secret put KAPI_LISANS_ANAHTARI`.
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
  lisansGecerli,
  mesaj,
  sha256Hex,
  trGunu,
  yolSorunu,
} from "../../server/lib/kapi-protokol.mjs";
import { CIHAZ_CEREZI, MOBIL_CEREZLERI, OTURUM_CEREZI, cerezCakisiyor, cerezCikar, cerezOku, cerezSilSatirlari, setCookieAdi, setCookieAlanli } from "../../server/lib/mobil-cerez.mjs";
import { KAPI_HIZ, MakineHatasi, guncelMi, kayitSonrasi, makineKaydi, makineOku, metaAnahtari, ofisiKapat, ozetAnahtari, silinenBirlestir, yeniOfisDenetle, yeniOfisSay } from "./makine.mjs";
import { TUNEL_YOLU, cloudflareVarsa, ofisTuneliniSil, tunelIstegi } from "./tunel.mjs"; // 2.4.7 M4: ofis tüneli (ayrı dosya)

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
});
const GUVENLIK = { "x-content-type-options": "nosniff", "cache-control": "no-store", "referrer-policy": "no-referrer" };

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
 */
export function createKapi({ now = () => Date.now(), fetchOrigin = request => fetch(request), lisansFetch = (...a) => fetch(...a), onbellek = null, cloudflare = null } = {}) {
  const pencere = new Map(); // hız sınırı (isolate içi; HIZ bağlaması yoksa)
  const yenileniyor = new Map(); // ofis → lisans yenileme sözü (aynı anda tek istek)
  const sonDeneme = new Map(); // ofis → son başarısız yenileme anı (servise yük bindirmesin)
  const cache = () => onbellek || globalThis.caches?.default || null;
  // B3: devre dışı ofisin tüneli + DNS kaydı (Cloudflare ayarı yoksa null → yalnız kapatılır, temizlik makine nesnesinde bekler).
  const temizleyici = env => {
    const cf = cloudflare || cloudflareVarsa(env);
    const alan = String(env.OFIS_ALANI || "destekofis.net").toLowerCase();
    return cf ? eski => ofisTuneliniSil(cf, eski, alan) : null;
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
            if (!govde?.ok || !govde.token) throw new Error("lisans servisi belirteç vermedi");
            const iddia = await lisansDogrula(govde.token, guvenilen(env));
            if (!iddia || iddia.machine !== meta.makine) throw new Error("belirteç bu ofise ait değil");
            await onbellegeYaz(meta.ofis, govde.token);
            sonDeneme.delete(meta.ofis);
            return govde.token;
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
  /** Dönüş: { durum: "gecerli" | "gecersiz" | "dogrulanamadi", iddia }. Adaylar: kayıttaki belirteç, önbellek, gerekirse servisten yeni. Tazelik: imzalı issuedAt. */
  async function lisansGorunumu(env, meta) {
    const keys = guvenilen(env);
    const adaylar = [];
    for (const zarf of [meta.lisans, await onbellektenLisans(meta.ofis)]) {
      const iddia = zarf ? await lisansDogrula(zarf, keys) : null;
      if (iddia && iddia.machine === meta.makine) adaylar.push(iddia);
    }
    let en = adaylar.sort((a, b) => b.issuedAt - a.issuedAt)[0] || null;
    if (!en || now() - en.issuedAt >= K.lisansYenileMs) {
      const zarf = await servistenYenile(env, meta);
      const iddia = zarf ? await lisansDogrula(zarf, keys) : null;
      if (iddia && (!en || iddia.issuedAt >= en.issuedAt)) en = iddia;
    }
    if (!en || now() - en.issuedAt >= K.lisansTazeMs) return { durum: "dogrulanamadi", iddia: en };
    return { durum: lisansGecerli(en, now()) ? "gecerli" : "gecersiz", iddia: en };
  }
  async function lisansIste(env, meta) {
    const g = await lisansGorunumu(env, meta);
    if (g.durum === "dogrulanamadi") at("kapi-lisans-dogrulanamadi");
    if (g.durum !== "gecerli") at("kapi-lisans");
    return g;
  }

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
    const ms = await ofisImzasi(request, yol, metin, yeniAnahtar);
    if (govde.zaman !== ms) at("kapi-istek");
    // Eski bir kaydın yeniden oynatılması (silinmiş cihazı geri getirir) reddedilir: kayıt zamanı kesin artar.
    if (mevcut && ms <= mevcut.veri.sonKayit) at("kapi-sira");
    if (!/^[A-Za-z0-9_-]{43}$/.test(String(govde.sir || ""))) at("kapi-istek");
    const iddia = await lisansDogrula(govde.lisans, guvenilen(env));
    if (!iddia) at("kapi-lisans");
    // B3: makineyi yalnız YENİ ofis kimliği devralır. Kaydı olan ofis, bu makinenin eşlemesi başka ofisi gösteriyorsa yerini bırakmıştır → 410 (kapatılır);
    // devre dışı ofis geri gelmez — yalnız eşleme hâlâ bu ofisi gösteriyorsa (yarışta kapanmışsa) onarılır. Ofis başka makineye taşınıyorsa (kayıttaki makine
    // farklı) o makineyi devralır.
    if (mevcut) {
      const esleme = await makineOku(env, iddia.machine);
      const onarim = esleme?.ofis === ofis;
      if (mevcut.veri.devreDisi && !onarim) at("kapi-ofis-degisti");
      if (esleme && !onarim && mevcut.veri.makine === iddia.machine) {
        await ofisiKapat(env, ofis, iddia.machine, esleme.ofis, now()).catch(() => false);
        at("kapi-ofis-degisti");
      }
    }
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
    const eskiKimlikler = new Set((eski?.cihazlar || []).map(c => c.id));
    const eklenen = temiz.filter(c => !eskiKimlikler.has(c.id));
    let cihazHatasi = null;
    if (gorunum.durum === "dogrulanamadi") cihazHatasi = "kapi-lisans-dogrulanamadi";
    else if (gorunum.durum !== "gecerli") cihazHatasi = "kapi-lisans";
    else if (eklenen.length && temiz.length > sinir) cihazHatasi = "kapi-sinir";
    // Cihaz EKLEME yalnız lisans geçerliyken ve sınır içinde; silme (listeden çıkan cihaz) her durumda uygulanır (güvenlik: silinen cihaz hemen düşer).
    meta.cihazlar = cihazHatasi ? temiz.filter(c => eskiKimlikler.has(c.id)) : temiz;
    // B1: listeden çıkan cihazların kimliği (canlı kapı eski çerezini tanıyıp siler; yeni eşlenip kaydı henüz gelmemiş cihazın çerezi silinmez).
    const guncel = meta.cihazlar.map(c => c.id);
    meta.silinen = silinenBirlestir([...eskiKimlikler].filter(id => !guncel.includes(id)), eski?.silinen, guncel);
    // B3: makine → ofis tek eşleme (yeni ofis günlük tavanı, makine başına saatlik kayıt ve günlük ofis değişimi sınırı) ofis kaydından ÖNCE; değişimde
    // önceki ofis kayıttan sonra kapatılır (kayitSonrasi).
    if (!mevcut) await yeniOfisDenetle(env, now());
    await makineKaydi(env, { makine: iddia.machine, ofis, simdi: now() });
    if (!mevcut) await yeniOfisSay(env, now());
    const yazildi = await env.OZET.put(metaAnahtari(ofis), JSON.stringify(meta), {
      httpMetadata: { contentType: "application/json" },
      ...(mevcut ? { onlyIf: { etagMatches: mevcut.etag } } : {}),
    });
    if (!yazildi) at("kapi-yaris");
    await onbellegeYaz(ofis, lisans);
    await kayitSonrasi(env, { makine: iddia.machine, ofis, simdi: now(), temizle: temizleyici(env) });
    if (cihazHatasi) at(cihazHatasi, { cihaz: meta.cihazlar.length, sinir });
    return json(200, { ok: true, data: { ofis, cihaz: meta.cihazlar.length, sinir } });
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
    await lisansIste(env, mevcut.veri);
    if (request.method !== "GET" && request.method !== "HEAD") at("kapi-yazma");
    const nesne = await env.OZET.get(ozetAnahtari(ofis));
    if (!nesne) at("kapi-ozet-yok");
    const basliklar = { etag: nesne.etag, "x-do-sira": String(nesne.customMetadata?.sira || ""), "x-do-uretim": String(nesne.customMetadata?.uretim || "") };
    if ((request.headers.get("if-none-match") || "") === nesne.etag) return new Response(null, { status: 304, headers: { ...GUVENLIK, ...basliklar } });
    return new Response(request.method === "HEAD" ? null : nesne.body, { status: 200, headers: { "content-type": "application/json; charset=utf-8", ...GUVENLIK, ...basliklar } });
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
    // B3: makinesinin güncel ofisi değilse (devre dışı) cihazları düşmüş sayılır (çerezleri silinir); cihazsız istek 410.
    const guncel = await guncelMi(env, meta, now());
    const etkinCihazlar = guncel ? meta.cihazlar || [] : [];
    const silinenler = [...(meta?.silinen || []), ...(guncel ? [] : (meta?.cihazlar || []).map(c => c.id))];
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
        if (!CIHAZ_KIMLIGI.test(id) || silinenler.includes(id) || meta?.devreDisi) sil = cerezSilSatirlari();
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

  const KARSILAMA = `<!doctype html><html lang="tr"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>DestekOfis Mobil</title><body style="font-family:system-ui,sans-serif;padding:24px;max-width:520px;margin:auto;color:#102a36"><h1 style="font-size:22px">DestekOfis Mobil</h1><p>Telefonunuzu ofisinizdeki DestekOfis'e bağlamak için yöneticinizin Yönetim → Mobil Cihazlar'da oluşturduğu karekodu okutun.</p><p>Eşlediğiniz cihazda ana ekrandaki DestekOfis simgesinden açın.</p></body></html>`;

  async function fetchHandler(request, env) {
    const url = new URL(request.url);
    try {
      // 2.4.7 M4: tünel başvurusu (ofis imzası + lisans P9; Cloudflare hesap belirteci yalnız Worker gizlisinde).
      if (TUNEL_YOLU.test(url.pathname)) return await tunelIstegi(request, env, { now, lisansGorunumu, cloudflare });
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
      const alan = String(env.OFIS_ALANI || "destekofis.net").toLowerCase();
      const host = url.hostname.toLowerCase();
      const ofis = host.endsWith(`.${alan}`) ? host.slice(0, -alan.length - 1) : "";
      if (!OFIS_KIMLIGI.test(ofis)) {
        return new Response(KARSILAMA, { status: 200, headers: { "content-type": "text/html; charset=utf-8", ...GUVENLIK, "content-security-policy": "default-src 'none'; style-src 'unsafe-inline'" } });
      }
      if (url.pathname === "/kapi/ozet") return await ozetOku(request, env, ofis);
      if (url.pathname.startsWith("/kapi/")) at("kapi-yol");
      return await vekil(request, env, ofis, url);
    } catch (error) {
      if (error instanceof KapiHatasi) return hata(error.kod, error.ek, error.basliklar);
      if (error instanceof MakineHatasi && HATA[error.kod]) return hata(error.kod, error.ek);
      return json(500, { ok: false, code: "kapi-hata", error: "Kapıcı isteği işleyemedi." });
    }
  }

  return { fetch: fetchHandler, lisansGorunumu, esitMi };
}

const varsayilan = createKapi();
export default { fetch: (request, env, ctx) => varsayilan.fetch(request, env, ctx) };
