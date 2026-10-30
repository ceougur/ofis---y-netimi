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
  ofisTur: 200, // bir turda listelenen ofis (R2 list sayfası)
  disTur: 40, // bir turda en çok dış istek (lisans servisi + Cloudflare API); ücretsiz planın 50 sınırının altında
  silmeDis: 6, // bir ofis silmenin dış istek payı (lisans 1 + tünel ara/bağlantı/sil 3 + DNS ara/sil 2)
  kontrolMs: 24 * 3_600_000, // her ofisin lisansı en çok günde bir kez servise sorulur
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
  if (cloudflare) await ofisTuneliniSil(cloudflare, ofis, alan);
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

/**
 * Bir tur. lisansGorunumu: kapıcının P9 görünümü (kapi.mjs; taze değilse servisten yeniler). cloudflare: tünel/DNS istemcisi ya da null.
 * Dönüş (Worker günlüğü ve testler için): { taranan, denetlenen, silinen: [ofis], ertelenen, hata: [{ ofis, ileti }], imlec }.
 */
export async function mobilTemizlik(env, { now = () => Date.now(), lisansGorunumu, cloudflare = null, alan = "destekofis.net" }) {
  const simdi = now();
  const imlec = (await oku(env, IMLEC))?.veri?.imlec || null;
  const liste = await env.OZET.list({ prefix: "ofis/", delimiter: "/", limit: TEMIZLIK.ofisTur, ...(imlec ? { cursor: imlec } : {}) });
  const ofisler = (liste.delimitedPrefixes || []).map(onek => onek.slice("ofis/".length).replace(/\/$/, "")).filter(id => OFIS_KIMLIGI.test(id));
  const rapor = { taranan: 0, denetlenen: 0, silinen: [], ertelenen: 0, hata: [], imlec: null };
  let dis = 0;
  for (const ofis of ofisler) {
    rapor.taranan += 1;
    const kayit = await oku(env, metaAnahtari(ofis));
    if (!kayit) continue;
    const meta = kayit.veri;
    const on = meta.lisans ? onIddia(meta.lisans) : null;
    const onSilme = on ? mobilSilmeAni(on, { engelMs: meta.engel?.ms ?? null }) : null;
    const sonBilinen = Math.max(Number(meta.kontrol?.ms) || 0, on?.issuedAt || 0);
    const aday = Boolean(meta.silme) || (on?.status === "blocked" && !meta.engel) || (onSilme !== null && simdi >= onSilme) || simdi - sonBilinen >= TEMIZLIK.kontrolMs;
    if (!aday) continue;
    if (dis + 1 > TEMIZLIK.disTur) {
      rapor.ertelenen += 1;
      continue;
    }
    dis += 1;
    rapor.denetlenen += 1;
    let gorunum;
    try {
      gorunum = await lisansGorunumu(env, meta);
    } catch {
      continue;
    }
    // Taze, doğrulanmış lisans bilgisi yoksa karar verilmez (silinmez).
    if (!gorunum || gorunum.durum === "dogrulanamadi" || !gorunum.iddia) continue;
    const iddia = gorunum.iddia;
    const engel = iddia.status === "blocked" ? (meta.engel?.ms ? meta.engel : { ms: simdi }) : null;
    const hak = mobilHakki(iddia, simdi);
    const silmeAni = mobilSilmeAni(iddia, { engelMs: engel?.ms ?? null });
    if (!hak.acik && silmeAni !== null && simdi >= silmeAni) {
      if (dis + TEMIZLIK.silmeDis - 1 > TEMIZLIK.disTur) {
        rapor.ertelenen += 1;
        continue;
      }
      dis += TEMIZLIK.silmeDis - 1;
      try {
        if (await ofisiSil(env, kayit, { neden: hak.durum, simdi, cloudflare, alan })) rapor.silinen.push(ofis);
      } catch (error) {
        rapor.hata.push({ ofis, ileti: String(error?.kod || error?.message || error) });
      }
      continue;
    }
    // Karar yok: denetim anı + engelin ilk görülmesi (yenilenen lisansta silme işareti ve engel kalkar). Yarışta (program o anda kaydoldu) yazılmaz.
    const yeni = { ...meta, kontrol: { ms: simdi } };
    if (engel) yeni.engel = engel;
    else delete yeni.engel;
    if (hak.acik) delete yeni.silme;
    await env.OZET.put(metaAnahtari(ofis), JSON.stringify(yeni), { ...JSON_TURU, onlyIf: { etagMatches: kayit.etag } });
  }
  // Ertelenen ofis varsa imleç ilerlemez (aynı sayfa sonraki turda yeniden taranır; ertelenen bir sonraki saatte işlenir).
  rapor.imlec = rapor.ertelenen ? imlec : liste.truncated && liste.cursor ? liste.cursor : null;
  await env.OZET.put(IMLEC, JSON.stringify({ imlec: rapor.imlec, son: simdi }), JSON_TURU);
  return rapor;
}
