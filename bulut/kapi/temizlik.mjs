// 2.4.8 L1 — KAPICININ ZAMANLANMIŞ TEMİZLİĞİ (Cloudflare Worker Cron; bulut/kapi/wrangler.toml [triggers], saatte bir). Ürün sahibi kararı "KARAR L1" (30.10.2026,
// docs/2.4.8-IS-LISTESI.md): denemesi biten kurulum 30 gün içinde lisans almazsa, ücretli lisansı biten kurulum 30 günlük hoşgörünün sonunda, engellenen lisans
// engelden 30 gün sonra → kapıcıdaki mobil kaydı (ofis kaydı, eşli cihaz listesi, R2 şifreli özeti, tünel ve DNS kaydı) KENDİLİĞİNDEN silinir (Cloudflare DNS
// kotası açılır; KVKK: saklama süresi kısalır). Kural tek yerde: server/lib/kapi-protokol.mjs mobilHakki + mobilSilmeAni (program aynı işlevleri kullanır).
//
// GÜVENLİ SİLME (BAŞ MİMAR KARARI; para kuralı değil):
//   * Karar YALNIZ taze ve doğrulanmış lisans belirteciyle (kapıcının P9 görünümü: en çok 1 saat eski, lisans servisinden yenilenir). Servise ulaşılamıyorsa
//     ya da belirteç doğrulanamıyorsa hiçbir şey silinmez (yenilenmiş lisansı görmeden silmek geri alınamaz). Eleme (hangi ofise bakılacağı) saklı belirtecin
//     imzasız okunmasıyla, karar imzalı ve taze belirteçle.
//   * Sıra: kayda "silme" işareti (koşullu yazım) → kayıt yeniden okunur (değiştiyse — program o arada yenilenen lisansla kaydoldu — bırakılır) → Cloudflare
//     (yalnız BU ofisin adları: tünel destekofis-<ofis>, DNS <ofis>.<alan>) → R2 özeti → silinen kaydın izi (silinen/<ofis>.json: ofis anahtarı + zaman + neden)
//     → kayıt yeniden okunur → ofis kaydı → makine eşlemesi (yalnız hâlâ bu ofisi gösteriyor ve ofisin kaydı yoksa). Her adım yinelenebilir: Cloudflare yanıt
//     vermezse işaret kalır, sonraki turda kaldığı yerden sürer. Başka ofisin kaydına, tüneline, DNS'ine dokunulmaz (K1 (a) ile aynı ilke).
//   * İz (mezar) silinen kaydın GERİ GELMEMESİ içindir: program aynı ofis kimliğiyle yeniden kaydolursa (lisans alındı) kayıt CİHAZSIZ açılır ve programa
//     "silindi" bildirilir (program eşlemeleri kaldırır; telefon karekodla yeniden eşlenir). İz ofisin açık anahtarını tutar: herkese açık ofis kimliğini
//     (DNS adı) başka anahtar alamaz.
//   * Engelin başlangıcı belirteçte yok: kapıcının engeli ilk gördüğü an kayda yazılır (meta.engel; kayıt ucu ve bu tur), silme ondan 30 gün sonra.
//   * Tur başına sınır: Workers ücretsiz planda çağrı başına dış istek sınırı (50) → tur başına en çok TEMIZLIK.disTur dış istek (lisans yenileme 1, ofis silme
//     ~6); kalan ofisler sonraki turda (imleç R2'de, sayac/temizlik.json). Her ofis günde bir lisans servisine sorulur (engel ve yenileme görülsün).
import { OFIS_KIMLIGI, b64Coz, metin, mobilHakki, mobilSilmeAni } from "../../server/lib/kapi-protokol.mjs";
import { makineAnahtari, metaAnahtari, ozetAnahtari } from "./makine.mjs";
import { ofisTuneliniSil } from "./tunel.mjs";

export const TEMIZLIK = Object.freeze({
  // 2.4.8 GG (D4, ihtiyat): Workers ücretsiz planında çağrı başına alt istek sınırı 50; R2 bağlama çağrılarının ve Cache API'nin sayılıp sayılmadığı
  // doğrulanamadı → güvenli taraf: tur başına R2 (okuma dahil) + Cache + lisans servisi + Cloudflare API çağrılarının TOPLAMI en çok `butce`.
  butce: 45,
  // Aynı zamanlanmış çağrıdaki WhatsApp bağlama oturumu temizliğinin payı (wa-bagla.mjs waOturumTemizle: liste 1 + oturum başına okuma + silme 2 → turda en çok
  // 2 oturum; oturumlar yalnız "WhatsApp'ı Bağla"da açılır); mobil temizlik bütçeden bunu ayırır (çağrının toplamı ≤ butce).
  waPay: 5,
  ofisTur: 40, // bir turda listelenen ofis (her ofis en az bir R2 okuması; bütçeye sığar)
  gorunumIslem: 3, // bir lisans görünümünün en kötü payı (önbellek okuma + lisans servisi + önbellek yazma)
  // Bir ofis silmenin en kötü payı: R2 16 (işaret 1, yeniden okumalar 9 [ofisiSil 3 + tünel/DNS silmesi öncesi 6], özet + iz + kayıt silme 3, makine 3) +
  // Cloudflare 5 (tünel ara / bağlantılar / sil 3, DNS ara / sil 2) + pay 1 (ikinci DNS kaydı).
  silmeIslem: 22,
  kontrolMs: 24 * 3_600_000, // her ofisin lisansı en çok günde bir kez servise sorulur
  // 2.4.8 GG (ORTA-1): lisans görünümü "doğrulanamadı" (servis ulaşılamıyor, zaman aşımı, 5xx, belirteç yok; S-L1a'nın 60 günü dolmamış "tanımıyor" da) ya da
  // istisna → deneme anı kayda yazılır, ofis bu süre aday sayılmaz (doğrulanamayan ofisler her turun bütçesini tüketip doğrulanabilenleri bekletmesin).
  dogrulanamayanMs: 24 * 3_600_000,
  // 2.4.8 KARAR S-L1a (30.10.2026 20:38 UTC; kullanıcı yanıt vermedi → 5 dk yetkisiyle uygulandı): lisans servisinin AÇIKÇA tanımadığı (LICENSE_NOT_FOUND) ofisin
  // kaydı, kapıcının o ofisi SON GÖRDÜĞÜ andan (meta.sonKayit: son yazılan kayıt) 60 gün sonra silinir. Servise ulaşılamazsa (ağ / 5xx / zaman aşımı) ya da
  // servis başka bir hata verirse "tanımıyor" sayılmaz, silinmez. Program arada kaydolursa sonKayit yenilenir (sayaç sıfırlanır). Silme yolu L1 ile aynı (ofisiSil).
  tanimayanMs: 60 * 24 * 3_600_000,
});
export const mezarAnahtari = ofis => `silinen/${ofis}.json`;
const IMLEC = "sayac/temizlik.json";
const JSON_TURU = { httpMetadata: { contentType: "application/json" } };

async function oku(env, anahtar) {
  const nesne = await env.OZET.get(anahtar);
  if (!nesne) return null;
  return { veri: await nesne.json(), etag: nesne.etag };
}
export const mezarOku = async (env, ofis) => (await oku(env, mezarAnahtari(ofis)))?.veri || null;

/** Saklı lisans belirtecinin iddiaları — İMZA DENETİMİ YAPILMADAN, yalnız eleme için (karar taze, doğrulanmış belirteçle). Okunamazsa null. */
export function onIddia(zarf) {
  try {
    const c = JSON.parse(metin(b64Coz(zarf.payload)));
    const zaman = value => (typeof value === "string" && Number.isFinite(Date.parse(value)) ? Date.parse(value) : null);
    return { kind: c.kind, status: c.status === "blocked" ? "blocked" : "active", expiresAt: zaman(c.expiresAt), issuedAt: zaman(c.issuedAt) || 0 };
  } catch {
    return null;
  }
}

/** Kayıt hâlâ verilen etag'de mi (silme sırasında program yeniden kaydoldu mu). */
async function ayniMi(env, ofis, etag) {
  const nesne = await env.OZET.head(metaAnahtari(ofis));
  return Boolean(nesne && nesne.etag === etag);
}

/**
 * Bir ofisin kapıcıdaki mobil kaydını siler (sıra dosya başında). Dönüş true = silindi, false = bırakıldı (yarış; sonraki tur yeniden karar verir). Cloudflare
 * hatası yukarı atılır (işaret kalır, sonraki tur sürer).
 */
export async function ofisiSil(env, kayit, { neden, simdi, cloudflare = null, alan = "destekofis.net" }) {
  const ofis = kayit.veri.ofis;
  if (!OFIS_KIMLIGI.test(String(ofis || ""))) return false;
  let isaretli = kayit;
  if (!kayit.veri.silme) {
    const yeni = { ...kayit.veri, silme: { ms: simdi, neden } };
    const yazildi = await env.OZET.put(metaAnahtari(ofis), JSON.stringify(yeni), { ...JSON_TURU, onlyIf: { etagMatches: kayit.etag } });
    if (!yazildi) return false;
    isaretli = { veri: yeni, etag: yazildi.etag };
  }
  if (!(await ayniMi(env, ofis, isaretli.etag))) return false;
  // Cloudflare ayarı yoksa bu kapıcı tünel / DNS açmamıştır (tünel ucu ayarsız 500 verir): yalnız R2 kaydı silinir.
  // K1 (a) ilkesi: her Cloudflare silmesinden hemen önce kayıt yeniden okunur (program yenilenen lisansla kaydolduysa durulur).
  if (cloudflare && !(await ofisTuneliniSil(cloudflare, ofis, alan, () => ayniMi(env, ofis, isaretli.etag)))) return false;
  // Cloudflare yanıtı beklenirken program yeniden kaydolduysa özet ve kayıt kalır (tünel yöneticisi bağlanamayınca kapıcıdan yeni tünel ister).
  if (!(await ayniMi(env, ofis, isaretli.etag))) return false;
  await env.OZET.delete(ozetAnahtari(ofis));
  await env.OZET.put(mezarAnahtari(ofis), JSON.stringify({ v: 1, ofis, anahtar: kayit.veri.anahtar, makine: kayit.veri.makine || null, ms: simdi, neden }), JSON_TURU);
  if (!(await ayniMi(env, ofis, isaretli.etag))) {
    await env.OZET.delete(mezarAnahtari(ofis));
    return false;
  }
  await env.OZET.delete(metaAnahtari(ofis));
  await makineBirak(env, kayit.veri.makine, ofis);
  return true;
}

/** Makine eşlemesi bu ofisi gösteriyorsa (ve ofisin kaydı artık yoksa) boşaltılır; bekleyen listesinden çıkar. Yarışta kaybedilirse dokunulmaz. */
async function makineBirak(env, makine, ofis) {
  if (!makine) return;
  const m = await oku(env, makineAnahtari(makine));
  if (!m) return;
  const bekleyen = (Array.isArray(m.veri.bekleyen) ? m.veri.bekleyen : []).filter(x => x !== ofis);
  const gosteriyor = m.veri.ofis === ofis;
  if (!gosteriyor && bekleyen.length === (m.veri.bekleyen || []).length) return;
  if (gosteriyor && (await env.OZET.head(metaAnahtari(ofis)))) return; // ofis o arada yeniden kaydoldu
  await env.OZET.put(makineAnahtari(makine), JSON.stringify({ ...m.veri, ofis: gosteriyor ? null : m.veri.ofis, bekleyen }), { ...JSON_TURU, onlyIf: { etagMatches: m.etag } });
}

/** Turun işlem sayacı (TEMIZLIK.butce): R2 bağlamasının her çağrısı sayılır; Cloudflare istemcisinin yöntemleri yaptıkları API isteği kadar. */
function sayacli(env, cloudflare) {
  const sayac = { n: 0 };
  const r2 = env.OZET;
  const OZET = {
    get: (...a) => ((sayac.n += 1), r2.get(...a)),
    head: (...a) => ((sayac.n += 1), r2.head(...a)),
    put: (...a) => ((sayac.n += 1), r2.put(...a)),
    delete: (...a) => ((sayac.n += 1), r2.delete(...a)),
    list: (...a) => ((sayac.n += 1), r2.list(...a)),
  };
  // findTunnel 1, deleteTunnel 2 (bağlantılar + tünel), deleteCname 2 (ara + sil; bir kayıt).
  const agirlik = { findTunnel: 1, deleteTunnel: 2, deleteCname: 2 };
  const cf = cloudflare
    ? Object.fromEntries(Object.entries(agirlik).map(([ad, n]) => [ad, (...a) => ((sayac.n += n), cloudflare[ad](...a))]))
    : null;
  return { env: { ...env, OZET }, cf, sayac };
}

/**
 * Bir tur. lisansGorunumu: kapıcının P9 görünümü (kapi.mjs; taze değilse servisten yeniler; { zorla: true } her durumda servise sorar). cloudflare: tünel/DNS
 * istemcisi ya da null. Dönüş (Worker günlüğü ve testler için): { taranan, denetlenen, silinen: [ofis], ertelenen, hata: [{ ofis, ileti }], imlec, islem }.
 * İMLEÇ (GG ORTA-1 + D4): son ele alınan ofis (sayac/temizlik.json → sonOfis); tur oradan sonrasını listeler (R2 list startAfter), bütçe biterse kalanlar
 * sonraki tura kalır (tur hep aynı başa dönmez). İmleç listeden HEMEN sonra sayfanın sonuna yazılır (tur ortasında istisna / sınır aşımında da sonraki tur
 * ilerler); bütçe sayfanın ortasında biterse tur sonunda son ele alınan ofise geri çekilir.
 */
export async function mobilTemizlik(ortamGercek, { now = () => Date.now(), lisansGorunumu, cloudflare = null, alan = "destekofis.net", log = console }) {
  const simdi = now();
  const { env, cf, sayac } = sayacli(ortamGercek, cloudflare);
  const yeter = n => sayac.n + n <= TEMIZLIK.butce - TEMIZLIK.waPay - 1; // 1: tur sonundaki imleç yazımı; waPay: aynı çağrıdaki WhatsApp oturum temizliği
  const imlecYaz = sonOfis => env.OZET.put(IMLEC, JSON.stringify({ sonOfis, son: simdi }), JSON_TURU);
  const onceki = (await oku(env, IMLEC))?.veri?.sonOfis || null;
  const liste = await env.OZET.list({ prefix: "ofis/", delimiter: "/", limit: TEMIZLIK.ofisTur, ...(onceki ? { startAfter: `ofis/${onceki}/\uffff` } : {}) });
  const ofisler = (liste.delimitedPrefixes || []).map(onek => onek.slice("ofis/".length).replace(/\/$/, "")).filter(id => OFIS_KIMLIGI.test(id));
  // Sayfa tamamsa sonraki tur sayfanın son ofisinden sonra; sayfa listenin sonuysa baştan.
  const sayfaSonu = liste.truncated && ofisler.length ? ofisler.at(-1) : null;
  await imlecYaz(sayfaSonu);
  const rapor = { taranan: 0, denetlenen: 0, silinen: [], ertelenen: 0, hata: [], bozuk: [], imlec: sayfaSonu, islem: 0 };
  let sonEle = onceki; // son ele alınan ofis (bütçe sayfa ortasında biterse imleç buraya)
  let durdu = false;
  const gorunumAl = async (meta, secenek) => {
    sayac.n += TEMIZLIK.gorunumIslem;
    return lisansGorunumu(ortamGercek, meta, secenek);
  };
  for (const ofis of ofisler) {
    if (!yeter(1)) {
      durdu = true;
      break;
    }
    // Son dar kontrol D4b: kayıt başına hata yalıtımı — R2 okuma hatası ya da bozuk JSON bütün turu düşürmez (imleç sayfa sonuna önceden yazıldığından
    // sayfadaki sonraki ofisler hep atlanırdı). Bozuk kayıt SİLİNMEZ (elle incelenir): atlanır, sayılır, günlüğe adıyla yazılır; tur sürer.
    let kayit;
    try {
      kayit = await oku(env, metaAnahtari(ofis));
      if (kayit && (!kayit.veri || typeof kayit.veri !== "object" || Array.isArray(kayit.veri))) throw new Error("ofis kaydı nesne değil");
    } catch (error) {
      rapor.bozuk.push(ofis);
      log.warn?.(`Kapıcı temizliği: ofis/${ofis}/meta.json okunamadı (${error?.message || error}); kayıt atlandı, silinmedi.`);
      sonEle = ofis;
      rapor.taranan += 1;
      continue;
    }
    if (!kayit) {
      sonEle = ofis;
      rapor.taranan += 1;
      continue;
    }
    const meta = kayit.veri;
    const on = meta.lisans ? onIddia(meta.lisans) : null;
    const onSilme = on ? mobilSilmeAni(on, { engelMs: meta.engel?.ms ?? null }) : null;
    const sonBilinen = Math.max(Number(meta.kontrol?.ms) || 0, on?.issuedAt || 0);
    // Doğrulanamayan ofis 24 saat beklenir; servisin açıkça tanımadığı ofiste bekleme S-L1a'nın 60. gününü geçmez (silme günü kaymasın).
    const deneme = Number(meta.dogrulanamadi?.ms) || 0;
    const tanimayanGunu = meta.dogrulanamadi?.tanimiyor && simdi - (Number(meta.sonKayit) || 0) >= TEMIZLIK.tanimayanMs;
    const bekliyor = deneme > 0 && simdi - deneme >= 0 && simdi - deneme < TEMIZLIK.dogrulanamayanMs && !tanimayanGunu;
    const aday = !bekliyor && (Boolean(meta.silme) || (on?.status === "blocked" && !meta.engel) || (onSilme !== null && simdi >= onSilme) || simdi - sonBilinen >= TEMIZLIK.kontrolMs);
    if (!aday) {
      sonEle = ofis;
      rapor.taranan += 1;
      continue;
    }
    // Aday: görünüm + kayıt yazımı sığmazsa bu ofis ve sonrası sonraki tura (okuma boşa gitti; bütçe yine aşılmaz).
    if (!yeter(TEMIZLIK.gorunumIslem + 1)) {
      durdu = true;
      break;
    }
    rapor.taranan += 1;
    rapor.denetlenen += 1;
    const yaz = yeni => env.OZET.put(metaAnahtari(ofis), JSON.stringify(yeni), { ...JSON_TURU, onlyIf: { etagMatches: kayit.etag } });
    // Doğrulanamadı / istisna: deneme anı yazılır, ofis TEMIZLIK.dogrulanamayanMs aday sayılmaz. Yarışta (program o anda kaydoldu) yazılmaz.
    const dogrulanamadi = (tanimiyor = false) => yaz({ ...meta, dogrulanamadi: { ms: simdi, ...(tanimiyor ? { tanimiyor: true } : {}) } });
    let gorunum;
    try {
      gorunum = await gorunumAl(meta);
    } catch {
      await dogrulanamadi();
      sonEle = ofis;
      continue;
    }
    // Silme (L1 ve S-L1a aynı yol). Bütçe yetmezse bu ofis sonraki tura (imleç bir önceki ofiste kalır).
    const sil = async neden => {
      if (!yeter(TEMIZLIK.silmeIslem)) return false;
      try {
        if (await ofisiSil(env, kayit, { neden, simdi, cloudflare: cf, alan })) rapor.silinen.push(ofis);
      } catch (error) {
        rapor.hata.push({ ofis, ileti: String(error?.kod || error?.message || error) });
      }
      return true;
    };
    // S-L1a: servis AÇIKÇA tanımıyor (bu çağrıda servisten) ve kapıcı ofisi 60 gündür görmedi → silinir.
    if (gorunum?.tanimiyor && simdi - (Number(meta.sonKayit) || 0) >= TEMIZLIK.tanimayanMs) {
      if (!(await sil("tanimiyor"))) {
        rapor.ertelenen += 1;
        durdu = true;
        break;
      }
      sonEle = ofis;
      continue;
    }
    // Taze, doğrulanmış lisans bilgisi yoksa karar verilmez (silinmez).
    if (!gorunum || gorunum.durum === "dogrulanamadi" || !gorunum.iddia) {
      await dogrulanamadi(Boolean(gorunum?.tanimiyor));
      sonEle = ofis;
      continue;
    }
    const kural = g => {
      const engel = g.iddia.status === "blocked" ? (meta.engel?.ms ? meta.engel : { ms: simdi }) : null;
      const hak = mobilHakki(g.iddia, simdi);
      const silmeAni = mobilSilmeAni(g.iddia, { engelMs: engel?.ms ?? null });
      return { engel, hak, sil: !hak.acik && silmeAni !== null && simdi >= silmeAni };
    };
    let karar = kural(gorunum);
    if (karar.sil && !gorunum.yenilendi) {
      // GG D1: silme kararından hemen önce lisans servisinden ZORUNLU yenileme (programın 0–30 dk'lık belirteci yetmez: müşteri son yarım saatte yenilemiş
      // olabilir). Yenileme başarısızsa silinmez (doğrulanamadı gibi beklenir).
      if (!yeter(TEMIZLIK.gorunumIslem + TEMIZLIK.silmeIslem)) {
        rapor.ertelenen += 1;
        durdu = true;
        break;
      }
      let taze = null;
      try {
        taze = await gorunumAl(meta, { zorla: true });
      } catch {
        taze = null;
      }
      if (!taze?.yenilendi || !taze.iddia || taze.durum === "dogrulanamadi") {
        await dogrulanamadi();
        sonEle = ofis;
        continue;
      }
      gorunum = taze;
      karar = kural(gorunum);
    }
    if (karar.sil) {
      if (!(await sil(karar.hak.durum))) {
        rapor.ertelenen += 1;
        durdu = true;
        break;
      }
      sonEle = ofis;
      continue;
    }
    // Karar yok: denetim anı + engelin ilk görülmesi (yenilenen lisansta silme işareti, engel ve doğrulanamadı izi kalkar). Yarışta yazılmaz.
    const yeni = { ...meta, kontrol: { ms: simdi } };
    delete yeni.dogrulanamadi;
    if (karar.engel) yeni.engel = karar.engel;
    else delete yeni.engel;
    if (karar.hak.acik) delete yeni.silme;
    await yaz(yeni);
    sonEle = ofis;
  }
  // Bütçe sayfanın ortasında bittiyse imleç son ele alınan ofise geri çekilir (kalanlar sonraki turun başında).
  if (durdu) {
    rapor.imlec = sonEle;
    await imlecYaz(sonEle);
  }
  rapor.islem = sayac.n;
  return rapor;
}
