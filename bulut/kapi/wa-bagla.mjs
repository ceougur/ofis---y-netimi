// 2.4.8 W7 — KAPICI: "WhatsApp'ı Bağla" (Meta Embedded Signup v5 + birlikte kullanım; plan docs/erp/WHATSAPP-API-PLANI-2.4.8.md §2.8, §4, §6 W7, §11 S4 A).
// Ürün sahibi kararı: düğme programda DÜZ AÇIK (gizli bayrak / "yakında" yok); DestekOfis Meta'da Tech Provider olana dek Meta bağlamayı tamamlamaz → açık
// Türkçe ileti ("Bu bağlantı DestekOfis'in Meta onayından sonra çalışır; şimdilik Elle Bağla."). Kod Tech Provider onayında değişmeden çalışır.
//
// Akış (kod değişimi SUNUCUDA — Meta App Secret YALNIZ kapıcı gizlisinde, WA_UYGULAMA_SIRRI; programa, sayfaya, yanıta, günlüğe girmez):
//   1. Program → POST /v1/ofis/<ofis>/wa/oturum (ofis anahtarıyla imzalı, M3 düzeni; gövdede programın GEÇİCİ açık anahtarı, ECDH P-256) → kapıcı 32 baytlık
//      oturum kimliği açar (R2 wa-oturum/<kimlik>.json, en çok 10 dk) → yanıt { oturum, adres: https://kapi.<alan>/wa/bagla#o=<kimlik>, sureSn }.
//   2. Yöneticinin tarayıcısı bağlama sayfasını açar (Meta'nın "Allowed domains" listesindeki sabit HTTPS alanı; programın yerel adresi olamaz). Sayfa Facebook
//      JS SDK ile FB.login({ config_id, response_type: "code", override_default_response_type: true, extras }) → Meta penceresi → WA_EMBEDDED_SIGNUP olayı
//      (waba_id, phone_number_id, olay türü) + değişim KODU (ömrü ~30 sn) → POST /wa/bagla/kod.
//   3. Kapıcı kodu HEMEN değiştirir: GET <graph>/<sürüm>/oauth/access_token?client_id&client_secret&code → işletme belirteci → programın geçici açık anahtarıyla
//      şifreler (kapi-protokol waSifrele) ve oturuma yazar (düz belirteç saklanmaz). Kod tek kullanımlık: oturum "isleniyor"a koşullu yazımla geçer, ikinci
//      gönderim 409.
//   4. Program → POST /v1/ofis/<ofis>/wa/oturum/<kimlik>/al (imzalı; yalnız oturumu açan ofis) → şifreli belirteç bir kez verilir ve oturum SİLİNİR.
//   Süresi geçen oturum her erişimde silinir; zamanlanmış tur da (temizlik.mjs) siler.
// env: WA_UYGULAMA_KIMLIGI (Meta App ID — gizli değil), WA_KURULUM_KIMLIGI (Embedded Signup yapılandırma kimliği, config_id — gizli değil), WA_UYGULAMA_SIRRI
// (gizli; W9 kanca imzasıyla aynı App Secret), isteğe bağlı WA_GRAPH_URL (yalnız test), WA_KURULUM_EKLERI (JSON; FB.login extras — D0).
import { KAPI_KURALLARI as K, OFIS_KIMLIGI, acikAnahtar, b64url, ecdsaDogrula, mesaj, sha256Hex, waBaglam, waSifrele } from "../../server/lib/kapi-protokol.mjs";
import { metaAnahtari } from "./makine.mjs";

export const WA_OTURUM = Object.freeze({ sureMs: 10 * 60_000, govdeAzami: 8 * 1024, kodAzami: 4096 });
// D0 (Tech Provider aşamasında Meta'nın "Embedded Signup Builder → Check a launch config" ile doğrulanır; tek yer): Graph sürümü ve FB.login ekleri.
export const WA_BAGLA_D0 = Object.freeze({ graphSurum: "v26.0", sdkAdresi: "https://connect.facebook.net/tr_TR/sdk.js", ekler: Object.freeze({ setup: {}, sessionInfoVersion: "3", version: "v5" }) });
const GRAPH_VARSAYILAN = "https://graph.facebook.com";
export const WA_ONAY_ILETISI = "Bu bağlantı DestekOfis'in Meta onayından sonra çalışır; şimdilik Elle Bağla.";
export const WA_OTURUM_YOLU = /^\/v1\/ofis\/([^/]+)\/wa\/oturum(?:\/([A-Za-z0-9_-]{43})\/al)?$/;
const OTURUM = /^[A-Za-z0-9_-]{43}$/;
const META_KIMLIK = /^[0-9]{5,30}$/;
const oturumAnahtari = id => `wa-oturum/${id}.json`;
const JSON_TURU = { httpMetadata: { contentType: "application/json" } };

const HATA = Object.freeze({
  "kapi-istek": [400, "İstek okunamadı."],
  "kapi-ofis-yok": [404, "Bu ofis kapıcıda kayıtlı değil. Ofisteki programın internete bağlı olduğunu denetleyin."],
  "kapi-imza": [401, "İmza doğrulanamadı."],
  "kapi-zaman": [401, "Cihazın saati sunucunun saatiyle uyuşmuyor."],
  "kapi-lisans": [403, "Lisans geçerli değil; WhatsApp bağlanamaz."],
  "kapi-lisans-dogrulanamadi": [503, "Lisans bir saattir doğrulanamadı; birkaç dakika sonra yeniden deneyin."],
  "kapi-ofis-degisti": [410, "Bu ofis kimliği kapandı: aynı lisans yeni bir kurulumla kaydoldu."],
  "kapi-wa-ayar": [409, WA_ONAY_ILETISI],
  "kapi-wa-oturum": [404, "Bağlama oturumu bulunamadı; programda WhatsApp'ı Bağla'yı yeniden açın."],
  "kapi-wa-sure": [410, "Bağlama oturumunun süresi doldu (10 dakika); programda WhatsApp'ı Bağla'yı yeniden açın."],
  "kapi-wa-kullanildi": [409, "Bu bağlama oturumu zaten kullanıldı; programda WhatsApp'ı Bağla'yı yeniden açın."],
  "kapi-wa-meta": [502, `Meta bağlantıyı tamamlamadı. ${WA_ONAY_ILETISI}`],
  "kapi-wa-koken": [403, "İstek bağlama sayfasından gelmedi."],
  "kapi-hiz": [429, "Çok sık istek; biraz sonra yeniden deneyin."],
});
class WaHatasi extends Error {
  constructor(kod, ek = {}) {
    super(kod);
    this.kod = kod;
    this.ek = ek;
  }
}
const at = (kod, ek) => {
  throw new WaHatasi(kod, ek);
};
const GUVENLIK = { "cache-control": "no-store", "x-content-type-options": "nosniff", "referrer-policy": "no-referrer" };
const json = (status, body) => new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json; charset=utf-8", ...GUVENLIK } });
const hataYaniti = error => {
  const [status, ileti] = HATA[error.kod] || [500, "Kapıcı isteği işleyemedi."];
  return json(status, { ok: false, code: error.kod, error: ileti, ...(error.ek?.zaman ? { zaman: error.ek.zaman } : {}), ...(error.ek?.metaIleti ? { metaIleti: error.ek.metaIleti } : {}) });
};
const ayarli = env => Boolean(META_KIMLIK.test(String(env.WA_UYGULAMA_KIMLIGI || "")) && String(env.WA_KURULUM_KIMLIGI || "").trim() && String(env.WA_UYGULAMA_SIRRI || ""));
const kacir = metinDegeri => String(metinDegeri).replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]);
// Meta'nın hata metni kullanıcıya gösterilmeden önce: tek satır, ≤ 200 karakter, verilen gizli değerler (App Secret, kod) çıkarılır.
const temizIleti = (deger, gizliler = []) => {
  let s = String(deger || "").replace(/[\u0000-\u001f\u007f]+/g, " ").trim();
  for (const g of gizliler) if (g && g.length >= 6) s = s.split(g).join("[gizli]");
  return s.slice(0, 200);
};

async function oku(env, anahtar) {
  const nesne = await env.OZET.get(anahtar);
  if (!nesne) return null;
  return { veri: await nesne.json(), etag: nesne.etag, uploaded: nesne.uploaded };
}
async function govdeMetni(request, azami) {
  if (Number(request.headers.get("content-length") || 0) > azami) at("kapi-istek");
  const metin = new TextDecoder().decode(await request.arrayBuffer());
  if (metin.length > azami) at("kapi-istek");
  return metin;
}
const ayristir = metin => {
  try {
    return JSON.parse(metin);
  } catch {
    return at("kapi-istek");
  }
};

/** Süresi geçen bağlama oturumlarını siler (zamanlanmış tur ve yeni oturum açılışı; en çok `azami` nesne). */
export async function waOturumTemizle(env, simdi, azami = 50) {
  const liste = await env.OZET.list({ prefix: "wa-oturum/", limit: azami });
  let silinen = 0;
  for (const nesne of liste.objects || []) {
    const kayit = await oku(env, nesne.key);
    if (!kayit || simdi - Number(kayit.veri?.ms || 0) >= WA_OTURUM.sureMs) {
      await env.OZET.delete(nesne.key);
      silinen += 1;
    }
  }
  return silinen;
}

/**
 * @param {object} o
 * @param {() => number} o.now
 * @param {Function} o.lisansGorunumu kapıcının P9 lisans görünümü (kapi.mjs)
 * @param {Function} o.gunceliIste (env, meta) → makinenin güncel ofisi değilse 410 (kapi.mjs)
 * @param {Function} o.hizDenetle (env, tür, anahtar, sınır)
 * @param {typeof fetch} [o.waFetch] Meta'ya (kod değişimi) istek — testte sahte
 */
export function createWaBagla({ now, lisansGorunumu, gunceliIste, hizDenetle, waFetch = (...a) => fetch(...a) }) {
  async function ofisIstegi(request, env, ofis, yol) {
    if (!OFIS_KIMLIGI.test(ofis)) at("kapi-istek");
    const kayit = await oku(env, metaAnahtari(ofis));
    if (!kayit) at("kapi-ofis-yok");
    const meta = kayit.veri;
    const metinDegeri = await govdeMetni(request, WA_OTURUM.govdeAzami);
    const ms = Number(request.headers.get("x-do-zaman"));
    if (!Number.isSafeInteger(ms) || Math.abs(now() - ms) > K.zamanPayiMs) at("kapi-zaman", { zaman: now() });
    if (!(await ecdsaDogrula(meta.anahtar, mesaj.ofis("POST", yol, ms, await sha256Hex(metinDegeri)), request.headers.get("x-do-imza") || ""))) at("kapi-imza");
    const govde = ayristir(metinDegeri);
    if (govde?.v !== 1 || govde.ofis !== ofis) at("kapi-istek");
    await gunceliIste(env, meta);
    return { meta, govde };
  }

  // 1. Oturum aç (program).
  async function oturumAc(request, env, ofis, yol) {
    const { meta, govde } = await ofisIstegi(request, env, ofis, yol);
    const anahtar = acikAnahtar(govde.anahtar);
    if (!anahtar) at("kapi-istek");
    // WhatsApp bağlama yazma işidir: yalnız geçerli lisans (hoşgörü değil).
    const gorunum = await lisansGorunumu(env, meta);
    if (gorunum.durum === "dogrulanamadi") at("kapi-lisans-dogrulanamadi");
    if (gorunum.durum !== "gecerli") at("kapi-lisans");
    if (!ayarli(env)) at("kapi-wa-ayar");
    await hizDenetle(env, "wa-oturum", ofis, 10);
    await waOturumTemizle(env, now(), 20).catch(() => 0);
    const id = b64url(globalThis.crypto.getRandomValues(new Uint8Array(32)));
    await env.OZET.put(oturumAnahtari(id), JSON.stringify({ v: 1, ofis, anahtar, ms: now(), durum: "bekliyor" }), JSON_TURU);
    const alan = String(env.OFIS_ALANI || "destekofis.net").toLowerCase();
    return json(200, { ok: true, data: { oturum: id, adres: `https://kapi.${alan}/wa/bagla#o=${id}`, sureSn: Math.round(WA_OTURUM.sureMs / 1000) } });
  }

  // 4. Belirteci al (program; yalnız oturumu açan ofis, bir kez).
  async function oturumAl(request, env, ofis, id, yol) {
    await ofisIstegi(request, env, ofis, yol);
    const kayit = await oku(env, oturumAnahtari(id));
    if (!kayit || kayit.veri.ofis !== ofis) at("kapi-wa-oturum");
    const o = kayit.veri;
    if (now() - Number(o.ms || 0) >= WA_OTURUM.sureMs) {
      await env.OZET.delete(oturumAnahtari(id));
      at("kapi-wa-sure");
    }
    if (o.durum === "bekliyor" || o.durum === "isleniyor") return json(200, { ok: true, data: { durum: "bekliyor" } });
    await env.OZET.delete(oturumAnahtari(id));
    if (o.durum === "hata") return json(200, { ok: true, data: { durum: "hata", ileti: o.ileti || WA_ONAY_ILETISI, ...(o.metaIleti ? { metaIleti: o.metaIleti } : {}) } });
    return json(200, { ok: true, data: { durum: "hazir", sifreli: o.sifreli, wabaId: o.wabaId, phoneNumberId: o.phoneNumberId, olay: o.olay } });
  }

  // 2. Bağlama sayfası (kapi.<alan>/wa/bagla). Oturum kimliği adresin # kısmında (sunucu günlüğüne, Referer'a düşmez); App Secret sayfaya GİRMEZ.
  function sayfa(env) {
    const nonce = b64url(globalThis.crypto.getRandomValues(new Uint8Array(16)));
    const hazir = ayarli(env);
    let ekler = WA_BAGLA_D0.ekler;
    try {
      if (env.WA_KURULUM_EKLERI) ekler = JSON.parse(env.WA_KURULUM_EKLERI);
    } catch {
      ekler = WA_BAGLA_D0.ekler;
    }
    // JSON veri bloğu: "<" kaçırılır (etiket kapatılamaz).
    const ayar = JSON.stringify(hazir ? { appId: String(env.WA_UYGULAMA_KIMLIGI), configId: String(env.WA_KURULUM_KIMLIGI), surum: WA_BAGLA_D0.graphSurum, ekler } : { kapali: true }).replace(/</g, "\\u003c");
    const stil = "font-family:system-ui,sans-serif;padding:24px;max-width:560px;margin:auto;color:#102a36;line-height:1.5";
    const govde = `<!doctype html><html lang="tr"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>WhatsApp'ı Bağla — DestekOfis</title>
<body style="${stil}"><h1 style="font-size:22px">WhatsApp'ı Bağla</h1>
<p>İşletmenizin WhatsApp Business numarasını DestekOfis'e bağlamak için Facebook hesabınızla giriş yapın; açılan Meta penceresinde işletmenizi ve numaranızı seçin. Numara WhatsApp Business uygulamasında da kullanılmaya devam eder.</p>
<p><button type="button" id="wa-bagla" disabled style="padding:10px 18px;border-radius:8px;border:0;background:#0f6a8b;color:#fff;font-size:16px">Facebook ile Devam Et</button></p>
<p id="wa-durum" role="status" style="font-weight:600">${hazir ? "Facebook bağlantısı yükleniyor…" : kacir(WA_ONAY_ILETISI)}</p>
<p style="font-size:12px;color:#5b6b73">Bu pencere DestekOfis kapıcısında açılır; işlem bitince kapatıp programa dönün. Bağlama 10 dakika içinde tamamlanmalıdır.</p>
<script type="application/json" id="wa-ayar">${ayar}</script>
<script nonce="${nonce}">
(()=>{const ayar=JSON.parse(document.getElementById('wa-ayar').textContent);const m=/(?:^#|&)o=([A-Za-z0-9_-]{43})/.exec(location.hash);const oturum=m?m[1]:'';history.replaceState(null,'',location.pathname);
const durum=t=>{document.getElementById('wa-durum').textContent=t};const dugme=document.getElementById('wa-bagla');
if(ayar.kapali)return;if(!oturum){durum('Bağlama oturumu bulunamadı; programda WhatsApp\\'ı Bağla\\'yı yeniden açın.');return}
const gonder=async veri=>{try{const r=await fetch('/wa/bagla/kod',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({oturum,...veri})});const g=await r.json().catch(()=>({}));return{ok:r.ok&&g.ok===true,ileti:[g.error,g.metaIleti?'Meta\\'nın yanıtı: '+g.metaIleti:''].filter(Boolean).join(' ')}}catch{return{ok:false,ileti:'Kapıcıya ulaşılamadı; internet bağlantınızı denetleyip yeniden deneyin.'}}};
let bilgi={};let bitti=false;
window.addEventListener('message',e=>{if(!/^https:\\/\\/([a-z0-9-]+\\.)*facebook\\.com$/.test(e.origin))return;let d;try{d=typeof e.data==='string'?JSON.parse(e.data):e.data}catch{return}if(!d||d.type!=='WA_EMBEDDED_SIGNUP')return;
if(/^FINISH/.test(String(d.event||'')))bilgi={wabaId:String(d.data?.waba_id||''),phoneNumberId:String(d.data?.phone_number_id||''),olay:String(d.event)};
else if(d.event==='CANCEL'&&!bitti){bitti=true;gonder({hata:'iptal',ileti:'Bağlama Meta penceresinde yarıda bırakıldı.'}).then(()=>durum('Bağlama yarıda bırakıldı. Programda WhatsApp\\'ı Bağla\\'yı yeniden açabilirsiniz.'))}
else if(d.event==='ERROR'&&!bitti){bitti=true;gonder({hata:'meta',ileti:String(d.data?.error_message||'')}).then(s=>durum(s.ileti||'Meta bağlantıyı tamamlamadı.'))}});
window.fbAsyncInit=()=>{FB.init({appId:ayar.appId,autoLogAppEvents:true,xfbml:false,version:ayar.surum});dugme.disabled=false;durum('Facebook ile Devam Et\\'e basın.')};
dugme.addEventListener('click',()=>{dugme.disabled=true;durum('Meta penceresi açıldı; adımları tamamlayın.');
FB.login(async yanit=>{const kod=yanit&&yanit.authResponse&&yanit.authResponse.code;if(bitti)return;bitti=true;
if(!kod){const s=await gonder({hata:'iptal',ileti:'Facebook girişi tamamlanmadı.'});durum(s.ileti||'Facebook girişi tamamlanmadı.');return}
for(let i=0;i<20&&!bilgi.wabaId;i+=1)await new Promise(r=>setTimeout(r,250));
durum('Bağlantı tamamlanıyor…');const s=await gonder({kod,...bilgi});durum(s.ok?'Bağlantı tamamlandı. Bu pencereyi kapatıp DestekOfis\\'e dönün.':s.ileti)},
{config_id:ayar.configId,response_type:'code',override_default_response_type:true,extras:ayar.ekler})});})();
</script>${hazir ? `<script async defer crossorigin="anonymous" nonce="${nonce}" src="${WA_BAGLA_D0.sdkAdresi}"></script>` : ""}</body></html>`;
    // CSP (D0: gerçek Meta akışında Tech Provider aşamasında doğrulanır): betik yalnız bu sayfanın nonce'u ve Facebook SDK; bağlantı / çerçeve yalnız Facebook.
    const csp = `default-src 'self'; script-src 'nonce-${nonce}' https://connect.facebook.net; connect-src 'self' https://*.facebook.com https://*.facebook.net; frame-src https://*.facebook.com https://*.facebook.net; img-src 'self' data: https://*.facebook.com https://*.fbcdn.net https://*.facebook.net; style-src 'self' 'unsafe-inline'; base-uri 'none'; form-action 'none'`;
    return new Response(govde, { status: 200, headers: { "content-type": "text/html; charset=utf-8", ...GUVENLIK, "content-security-policy": csp } });
  }

  // 3. Kod (bağlama sayfası). Kod tek kullanımlık; App Secret yalnız bu istekte, kapıcıdan Meta'ya.
  async function kodAl(request, env, url) {
    const koken = request.headers.get("origin");
    if (koken && koken !== `${url.protocol}//${url.host}`) at("kapi-wa-koken");
    await hizDenetle(env, "wa-kod", request.headers.get("cf-connecting-ip") || "?", 20);
    const govde = ayristir(await govdeMetni(request, WA_OTURUM.govdeAzami));
    const id = String(govde?.oturum || "");
    if (!OTURUM.test(id)) at("kapi-istek");
    const kayit = await oku(env, oturumAnahtari(id));
    if (!kayit) at("kapi-wa-oturum");
    const o = kayit.veri;
    if (now() - Number(o.ms || 0) >= WA_OTURUM.sureMs) {
      await env.OZET.delete(oturumAnahtari(id));
      at("kapi-wa-sure");
    }
    if (o.durum !== "bekliyor") at("kapi-wa-kullanildi");
    const yaz = (veri, etag) => env.OZET.put(oturumAnahtari(id), JSON.stringify(veri), { ...JSON_TURU, onlyIf: { etagMatches: etag } });
    // Kullanıcı Meta penceresini kapattı / Meta hata verdi: oturum "hata" olur, program iletiyi gösterir.
    if (govde.hata) {
      const metaIleti = temizIleti(govde.ileti, [String(env.WA_UYGULAMA_SIRRI || "")]);
      const iptal = govde.hata === "iptal";
      if (!(await yaz({ ...o, durum: "hata", ileti: iptal ? metaIleti || "Bağlama yarıda bırakıldı." : `Meta bağlantıyı tamamlamadı. ${WA_ONAY_ILETISI}`, ...(iptal ? {} : { metaIleti }) }, kayit.etag))) at("kapi-wa-kullanildi");
      return json(200, { ok: true, data: { durum: "hata" } });
    }
    const kod = String(govde.kod || "");
    if (!kod || kod.length > WA_OTURUM.kodAzami || /[\s\u0000-\u001f]/.test(kod)) at("kapi-istek");
    const wabaId = String(govde.wabaId || "");
    const phoneNumberId = String(govde.phoneNumberId || "");
    if (!META_KIMLIK.test(wabaId) || !META_KIMLIK.test(phoneNumberId)) at("kapi-istek");
    const olay = /^FINISH[A-Z_]*$/.test(String(govde.olay || "")) ? String(govde.olay) : "FINISH";
    // Tek kullanım: koşullu yazımla "isleniyor" (aynı kod iki kez gönderilirse ikincisi 409).
    const isleniyor = await yaz({ ...o, durum: "isleniyor" }, kayit.etag);
    if (!isleniyor) at("kapi-wa-kullanildi");
    const hataYaz = async metaIleti => {
      await env.OZET.put(oturumAnahtari(id), JSON.stringify({ ...o, durum: "hata", ileti: `Meta bağlantıyı tamamlamadı. ${WA_ONAY_ILETISI}`, metaIleti }), JSON_TURU);
      at("kapi-wa-meta", { metaIleti });
    };
    if (!ayarli(env)) await hataYaz("");
    const sir = String(env.WA_UYGULAMA_SIRRI);
    const taban = String(env.WA_GRAPH_URL || GRAPH_VARSAYILAN).replace(/\/+$/, "");
    const adres = new URL(`${taban}/${WA_BAGLA_D0.graphSurum}/oauth/access_token`);
    adres.searchParams.set("client_id", String(env.WA_UYGULAMA_KIMLIGI));
    adres.searchParams.set("client_secret", sir);
    adres.searchParams.set("code", kod);
    let veri = null;
    try {
      const yanit = await waFetch(adres.toString(), { method: "GET", headers: { accept: "application/json" }, redirect: "manual", signal: AbortSignal.timeout(15_000) });
      veri = await yanit.json().catch(() => null);
      if (!yanit.ok || typeof veri?.access_token !== "string" || !/^[\x21-\x7e]+$/.test(veri.access_token)) await hataYaz(temizIleti(veri?.error?.message || `HTTP ${yanit.status}`, [sir, kod]));
    } catch (error) {
      if (error instanceof WaHatasi) throw error;
      await hataYaz("Meta'ya ulaşılamadı.");
    }
    const sifreli = await waSifrele(o.anahtar, veri.access_token, waBaglam(o.ofis, id));
    await env.OZET.put(oturumAnahtari(id), JSON.stringify({ ...o, durum: "hazir", sifreli, wabaId, phoneNumberId, olay }), JSON_TURU);
    return json(200, { ok: true, data: { durum: "hazir" } });
  }

  /** kapi.mjs fetchHandler'ından. Dönüş Response ya da null (bu modülün yolu değil). */
  async function istek(request, env, url, { kapiHost }) {
    try {
      const oturumYolu = WA_OTURUM_YOLU.exec(url.pathname);
      if (oturumYolu) {
        if (request.method !== "POST") at("kapi-istek");
        const [, ofis, id] = oturumYolu;
        return id ? await oturumAl(request, env, ofis, id, url.pathname) : await oturumAc(request, env, ofis, url.pathname);
      }
      if (!kapiHost) return null;
      if (url.pathname === "/wa/bagla" && (request.method === "GET" || request.method === "HEAD")) return sayfa(env);
      if (url.pathname === "/wa/bagla/kod" && request.method === "POST") return await kodAl(request, env, url);
      return null;
    } catch (error) {
      if (error instanceof WaHatasi) return hataYaniti(error);
      if (error?.kod && HATA[error.kod]) return hataYaniti(error);
      return json(500, { ok: false, code: "kapi-hata", error: "Kapıcı isteği işleyemedi." });
    }
  }
  return { istek };
}
