// 2.4.7 KAPICI — MAKİNE → OFİS TEK EŞLEMESİ ve kayıt/tünel hız sınırları (bağımsız gözden geçirme B3 YÜKSEK düzeltmesi; BAŞ MİMAR KARARI docs/2.4.7-IS-LISTESI.md
// "BAĞIMSIZ GÖZDEN GEÇİRME"). Sorun: kapıcı ofis kimliğini programın ürettiği anahtarla tanıyordu; tek lisans belirteciyle (aynı makine) istenen sayıda ofis
// kimliği kaydedilip her birine 3 cihaz, ayrı tünel ve DNS kaydı alınabiliyordu (K13 "kapıcıya doğrudan kayıt sınırı aşamaz" kararına aykırı).
//
// Kural: lisans belirtecindeki makine (machine) kapıcıda TEK ofise eşlenir — R2 `makine/<makine>.json` { ofis, bekleyen, sayaçlar }, etag'li koşullu yazım.
//   * Aynı makine YENİ bir ofis kimliğiyle kaydolursa yeni ofis kabul edilir, eskisi DEVRE DIŞI kalır: cihaz listesi boşalır (okumalar hemen kapanır),
//     özeti silinir, tüneli ve DNS kaydı Cloudflare API'den silinir (bulut/kapi/tunel.mjs ofisTuneliniSil). Silme olmazsa (Cloudflare yanıt vermedi)
//     `bekleyen`de kalır; makinenin sonraki kaydında / tünel başvurusunda yeniden denenir.
//   * Son kaydolan kazanır: makineyi geçerli imzalı kaydı olan her ofis devralır (yeni ofis kimliği de, yerini bırakmış / devre dışı ofis de — yeniden
//     kurulumdan sonra eski veri geri yüklenince asıl kurulum döner); her devralma günlük ofis değişimi sınırına sayılır (kontrol bulut/kapi/kapi.mjs kayit).
//   * Tünel ucu yalnız makinenin GÜNCEL ofisine tünel verir.
//   * Hız sınırları (adlı sabit KAPI_HIZ; kapi-protokol KAPI_KURALLARI'ndan ayrı): makine başına saatte kayıt ve tünel başvurusu, günde ofis değişimi;
//     kapıcı genelinde günde YENİ ofis. Aşılınca 429 kapi-hiz. Deneme belirteci (kind "trial") AYNI kurallarla.
// Eşzamanlı iki kayıt (aynı makine, iki ofis): makine nesnesi koşullu yazılır (biri kazanır; yalnız İLK yazım koşulsuz). Eşleme YETKİLİDİR: canlı kapı,
// özet okuma/yükleme ve tünel her istekte makinenin eşlemesine bakar (guncelMi) → aynı anda yalnız bir ofis geçer. Ayrıca her kayıt kendi ofis kaydını
// yazdıktan SONRA eşlemeyi yeniden okur, kendisi güncel değilse kendini kapatır (410); kapatılan her ofis temizlik için `bekleyen`e girer.
// Yalnız Web standartları; R2 bağlaması env.OZET (Workers'ta ve Node'daki sahte R2'de aynı).
import { trGunu } from "../../server/lib/kapi-protokol.mjs";

export const KAPI_HIZ = Object.freeze({
  // Makine başına saatte kayıt (her kayıt sayılır). Program her güvenlik değişikliğinde kaydı zorla yeniler ve başarısız kaydı 30 sn'de bir yineler
  // (lib/mobile-sync.mjs turMs → saatte 120); sınır bunun iki katı: olağan kullanım hiç takılmaz, sınırsız döngü kapanır.
  kayitSaatlik: 240,
  // Makine başına saatte tünel başvurusu (program açılışta bir kez ve hatada 30 sn → 10 dk geri çekilmeyle ister; saatte en çok ~10).
  tunelSaatlik: 30,
  // Makine başına günde ofis değişimi (ilk kayıt dahil: yeniden kurulum yeni ofis kimliği üretir). Her değişim eski tüneli ve DNS kaydını siler.
  ofisDegisimGunluk: 10,
  // Kapıcı genelinde günde YENİ ofis tüneli + DNS kaydı (2.4.8 K1 (c): kayıttan tünel açılışına taşındı; ücretsiz Cloudflare alanında 200 DNS kaydı sınırı).
  yeniOfisGunluk: 50,
  // Makine nesnesinde en çok kaç devre dışı ofis temizlik bekler; tek çağrıda en çok kaç tanesi işlenir.
  bekleyenAzami: 20,
  bekleyenTur: 3,
  // Ofis kaydında tutulan silinmiş cihaz kimliği (canlı kapıda eski çerezi tanıyıp silmek için; B1).
  silinenAzami: 100,
});

const SAAT = 3_600_000;
export const metaAnahtari = ofis => `ofis/${ofis}/meta.json`;
export const ozetAnahtari = ofis => `ofis/${ofis}/ozet.json`;
export const makineAnahtari = makine => `makine/${makine}.json`;
const yeniOfisAnahtari = gun => `sayac/yeni-ofis/${gun}.json`;

export class MakineHatasi extends Error {
  constructor(kod, ek = {}) {
    super(kod);
    this.kod = kod;
    this.ek = ek;
  }
}
const at = (kod, ek) => {
  throw new MakineHatasi(kod, ek);
};

async function oku(env, anahtar) {
  const nesne = await env.OZET.get(anahtar);
  if (!nesne) return null;
  return { veri: await nesne.json(), etag: nesne.etag };
}
// Var olan nesne etag'iyle koşullu; ilk yazım koşulsuz (kapi.mjs ofis kaydıyla aynı düzen; ilk yazım yarışını kayıt sonrası denetim çözer).
const yaz = (env, anahtar, veri, onceki) =>
  env.OZET.put(anahtar, JSON.stringify(veri), { httpMetadata: { contentType: "application/json" }, ...(onceki ? { onlyIf: { etagMatches: onceki.etag } } : {}) });

/** Makine nesnesini koşullu günceller (yarışta en çok 4 deneme). degistir(veri|null) → { yaz: boolean, veri, ... } (hata atabilir). */
async function makineGuncelle(env, makine, degistir) {
  for (let deneme = 0; deneme < 4; deneme += 1) {
    const mevcut = await oku(env, makineAnahtari(makine));
    const sonuc = await degistir(mevcut ? structuredClone(mevcut.veri) : null);
    if (!sonuc?.yaz) return sonuc || {};
    if (await yaz(env, makineAnahtari(makine), sonuc.veri, mevcut)) return sonuc;
  }
  return at("kapi-yaris");
}
export const makineOku = async (env, makine) => (await oku(env, makineAnahtari(makine)))?.veri || null;

/** Silinen cihaz kimliklerini birleştirir: en yenisi önde, tekil, güncel listede olanlar çıkar, en çok KAPI_HIZ.silinenAzami. */
export function silinenBirlestir(yeniler, eskiler = [], guncel = []) {
  const etkin = new Set(guncel);
  return [...new Set([...yeniler, ...(Array.isArray(eskiler) ? eskiler : [])])].filter(id => !etkin.has(id)).slice(0, KAPI_HIZ.silinenAzami);
}

/**
 * Kapıcı genelinde günlük YENİ ofis tüneli sayacı (2.4.8 K1 (c): tünel ucu yeni tünel + DNS kaydı açarken; kayıt sayılmaz). denetle: tavandaysa hiçbir şeyi
 * değiştirmeden 429 (tünel açılmadan ÖNCE); say: açılan tüneli sayar (açıldıktan SONRA; reddedilen başvuru tavanı tüketmez). Eşzamanlı başvurular tavanı birkaç
 * adet aşabilir (sayaç koşullu yazılır, denetim ayrı okumadır).
 */
export async function yeniOfisDenetle(env, simdi) {
  const n = Number((await oku(env, yeniOfisAnahtari(trGunu(simdi))))?.veri?.n || 0);
  if (n >= KAPI_HIZ.yeniOfisGunluk) at("kapi-hiz", { sinir: "yeni-ofis-gunluk" });
}
export async function yeniOfisSay(env, simdi) {
  const anahtar = yeniOfisAnahtari(trGunu(simdi));
  for (let deneme = 0; deneme < 4; deneme += 1) {
    const mevcut = await oku(env, anahtar);
    if (await yaz(env, anahtar, { n: Number(mevcut?.veri?.n || 0) + 1 }, mevcut)) return;
  }
}

/**
 * Kayıt: makinenin güncel ofisini `ofis` yapar ve sayaçları işler (ofis kaydı yazılmadan ÖNCE çağrılır). Dönüş { onceki } (değişimde önceki ofis).
 * Saatlik kayıt ve günlük ofis değişimi sınırı burada; aşan kayıt eşlemeyi değiştirmez.
 */
export function makineKaydi(env, { makine, ofis, simdi }) {
  const saat = Math.floor(simdi / SAAT);
  const gun = trGunu(simdi);
  return makineGuncelle(env, makine, veri => {
    const m = veri || { v: 1, makine, ofis: null, bekleyen: [] };
    const kayitN = m.kayit?.saat === saat ? Number(m.kayit.n || 0) : 0;
    if (kayitN >= KAPI_HIZ.kayitSaatlik) at("kapi-hiz", { sinir: "kayit-saatlik" });
    const degisim = m.ofis !== ofis;
    const degisimN = m.degisim?.gun === gun ? Number(m.degisim.n || 0) : 0;
    if (degisim && degisimN >= KAPI_HIZ.ofisDegisimGunluk) at("kapi-hiz", { sinir: "ofis-degisim-gunluk" });
    m.kayit = { saat, n: kayitN + 1 };
    let onceki = null;
    if (degisim) {
      onceki = m.ofis || null;
      m.degisim = { gun, n: degisimN + 1 };
      m.ofis = ofis;
      m.sonDegisim = simdi;
    }
    m.bekleyen = [...(onceki ? [onceki] : []), ...(Array.isArray(m.bekleyen) ? m.bekleyen : [])].filter((x, i, a) => x !== ofis && a.indexOf(x) === i).slice(0, KAPI_HIZ.bekleyenAzami);
    return { yaz: true, veri: m, onceki };
  });
}

/**
 * Bir ofisi devre dışı bırakır (yalnız hâlâ bu makineye bağlıysa ve makinenin güncel ofisi değilse): cihaz listesi boşalır (silinenlere geçer), devreDisi
 * işareti, özet silinir. Dönüş: "kapali" = bu makinenin devre dışı ofisi (tünel/DNS temizlenebilir), "atla" = kapatılacak bir şey yok (kayıt yok, ofis başka
 * makineye taşınmış ya da makinenin güncel ofisi — tüneline DOKUNULMAZ), false = yarış sürdü (sonra yeniden denenir).
 */
export async function ofisiKapat(env, ofis, makine, yerine, simdi) {
  for (let deneme = 0; deneme < 4; deneme += 1) {
    const meta = await oku(env, metaAnahtari(ofis));
    if (!meta || meta.veri.makine !== makine) return "atla";
    const m = await makineOku(env, makine);
    if (m?.ofis === ofis) return "atla";
    if (!meta.veri.devreDisi) {
      const cihazlar = Array.isArray(meta.veri.cihazlar) ? meta.veri.cihazlar : [];
      // Cihazlar SİLİNMİŞ sayılmaz (dar kontrol K1, bulgu 1–2): ofis dönerse (son kaydolan kazanır) aynı telefonlar yeniden eşlemesiz döner ve P5 gereği
      // "mevcut" sayılır; kapıcı devre dışı dönemde gelen çerezi reddeder ama silmez. Kimlikler devreDisi.cihazlar'da durur.
      const yeni = { ...meta.veri, cihazlar: [], devreDisi: { ms: simdi, yerine: yerine || m?.ofis || null, cihazlar: [...new Set([...(meta.veri.devreDisi?.cihazlar || []), ...cihazlar.map(c => c.id)])] } };
      if (!(await yaz(env, metaAnahtari(ofis), yeni, meta))) continue;
    }
    await env.OZET.delete(ozetAnahtari(ofis));
    // Tünel/DNS temizliği makinenin güncel ofisinin sonraki kaydında / tünel başvurusunda (yarışta kaybolan değişim de bekleyene girsin).
    if (m && !(m.bekleyen || []).includes(ofis)) await bekleyeneEkle(env, makine, ofis).catch(() => null);
    return "kapali";
  }
  return false;
}
function bekleyeneEkle(env, makine, ofis) {
  return makineGuncelle(env, makine, veri =>
    veri && veri.ofis !== ofis && !(veri.bekleyen || []).includes(ofis) ? { yaz: true, veri: { ...veri, bekleyen: [ofis, ...(veri.bekleyen || [])].slice(0, KAPI_HIZ.bekleyenAzami) } } : { yaz: false },
  );
}

/**
 * Ofis şu an makinesinin güncel ofisi mi (canlı kapı, özet okuma ve yükleme her istekte). Eşleme YETKİLİDİR: makine nesnesinin ilk yazımı koşulsuz olduğundan
 * aynı makinenin iki ilk kaydı yarışırsa ikisinin de ofis kaydı etkin görünebilir; eşleme yine tek ofisi gösterir → yalnız o geçer, öbürü burada kapatılır.
 * Makine nesnesi yoksa (eşlemeden önceki kayıt biçimi) ofis kaydı geçerlidir.
 */
export async function guncelMi(env, meta, simdi) {
  if (!meta || meta.devreDisi) return false;
  const m = await makineOku(env, meta.makine);
  if (m && m.ofis !== meta.ofis) {
    await ofisiKapat(env, meta.ofis, meta.makine, m.ofis, simdi).catch(() => false);
    return false;
  }
  return true;
}

/**
 * Kayıt sonrası (ofis kaydı yazıldıktan sonra): eşleme bu ofisi göstermiyorsa (eşzamanlı başka kayıt kazandı) kendini kapatır → 410; gösteriyorsa bekleyen
 * eski ofisleri kapatır ve Cloudflare temizliğini dener (temizle(ofis) → true; null = Cloudflare ayarı yok, yalnız kapatılır).
 */
export async function kayitSonrasi(env, { makine, ofis, simdi, temizle }) {
  const m = await makineOku(env, makine);
  if (m && m.ofis !== ofis) {
    await ofisiKapat(env, ofis, makine, m.ofis, simdi);
    at("kapi-ofis-degisti");
  }
  await bekleyenleriIsle(env, makine, { simdi, temizle });
}

/** Makinenin bekleyen (devre dışı) ofislerini kapatır ve tünel/DNS temizliğini dener; biten bekleyenden çıkar. Hatası kaydı/tüneli bozmaz. */
export async function bekleyenleriIsle(env, makine, { simdi, temizle = null }) {
  const m = await makineOku(env, makine);
  const bekleyen = Array.isArray(m?.bekleyen) ? m.bekleyen.slice(0, KAPI_HIZ.bekleyenTur) : [];
  if (!bekleyen.length) return { biten: [] };
  const biten = [];
  for (const x of bekleyen) {
    if (x === m.ofis) {
      biten.push(x);
      continue;
    }
    let kapandi = false;
    try {
      kapandi = await ofisiKapat(env, x, makine, m.ofis, simdi);
    } catch {
      kapandi = false;
    }
    // Ofis başka makineye taşınmışsa / kaydı yoksa tüneline dokunulmaz, yalnız bekleyenden çıkar.
    if (kapandi === "atla") {
      biten.push(x);
      continue;
    }
    if (kapandi !== "kapali" || !temizle) continue;
    // 2.4.8 K1 (a) (2.4.7 dar kontrol 2 BULGU 3): her Cloudflare silmesinden HEMEN önce makine eşlemesi yeniden okunur — temizlik sürerken x geri dönüp makineyi
    // devraldıysa (son kaydolan kazanır) etkin ofisin tüneli / DNS kaydı silinmez; x bekleyenden çıkar (artık güncel ofis).
    const devam = async () => (await makineOku(env, makine))?.ofis !== x;
    try {
      if (await temizle(x, devam)) biten.push(x);
      else if (!(await devam())) biten.push(x);
    } catch {
      // Cloudflare yanıt vermedi: bekleyende kalır, sonraki kayıt / tünel başvurusunda yeniden denenir.
    }
  }
  if (biten.length) {
    try {
      await makineGuncelle(env, makine, veri => (veri ? { yaz: true, veri: { ...veri, bekleyen: (veri.bekleyen || []).filter(x => !biten.includes(x)) } } : { yaz: false }));
    } catch {
      // yarışta kalırsa sonraki çağrı yeniden çıkarır (temizlik tekrarlanabilir)
    }
  }
  return { biten };
}

/**
 * Tünel başvurusu: yalnız makinenin GÜNCEL ofisi (değilse 410; kendini kapatır) ve saatlik sınır. Makine nesnesi yoksa (eşlemeden önceki kayıt biçimi) 404
 * kapi-ofis-yok: program (lib/tunnel/attach.mjs) bir kez kayıt yapıp yeniden başvurur — eşlemeyi yalnız kayıt yazar (koşulsuz ilk yazım tek yerde).
 */
export async function tunelMakine(env, { makine, ofis, simdi }) {
  const saat = Math.floor(simdi / SAAT);
  try {
    return await makineGuncelle(env, makine, veri => {
      if (!veri) at("kapi-ofis-yok");
      const m = veri;
      if (m.ofis !== ofis) at("kapi-ofis-degisti");
      const n = m.tunel?.saat === saat ? Number(m.tunel.n || 0) : 0;
      if (n >= KAPI_HIZ.tunelSaatlik) at("kapi-hiz", { sinir: "tunel-saatlik" });
      m.tunel = { saat, n: n + 1 };
      return { yaz: true, veri: m };
    });
  } catch (error) {
    if (error instanceof MakineHatasi && error.kod === "kapi-ofis-degisti") await ofisiKapat(env, ofis, makine, null, simdi).catch(() => false);
    throw error;
  }
}
