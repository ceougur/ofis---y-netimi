// 2.4.8 W7 — KAPICI: "WhatsApp'ı Bağla" (Meta Embedded Signup v5 + birlikte kullanım; plan docs/erp/WHATSAPP-API-PLANI-2.4.8.md §2.8, §4, §6 W7, §11 S4 A).
// Ürün sahibi kararı: düğme programda DÜZ AÇIK (gizli bayrak / "yakında" yok); DestekOfis Meta'da Tech Provider olana dek Meta bağlamayı tamamlamaz → açık
// Türkçe ileti ("Bu bağlantı DestekOfis'in Meta onayından sonra çalışır; şimdilik Elle Bağla."). Kod Tech Provider onayında değişmeden çalışır.
//
// Akış (kod değişimi SUNUCUDA — Meta App Secret YALNIZ kapıcı gizlisinde, WA_UYGULAMA_SIRRI; programa, sayfaya, yanıta, günlüğe girmez):
//   1. Program → POST /v1/ofis/<ofis>/wa/oturum (ofis anahtarıyla imzalı, M3 düzeni; gövdede programın GEÇİCİ açık anahtarı, ECDH P-256, tek kullanımlık
//      SIRRIN özeti (SHA-256) ve firma adı) → kapıcı 32 baytlık oturum kimliği açar (R2 wa-oturum/<kimlik>.json, en çok 10 dk) → yanıt
//      { oturum, adres: https://kapi.<alan>/wa/bagla#o=<kimlik>, sureSn }. SIR adreste YOK: programın ekranında kalır.
//   2. Programın ekranı bağlama sayfasını window.open ile açar ve sırrı YALNIZ postMessage ile o pencereye verir (hedef köken tam olarak kapıcı). Sayfa
//      sırrı yalnız pencereyi açandan (event.source === window.opener) ve YEREL / ÖZEL AĞ kökeninden (WA_YEREL_KOKEN) gelen iletiden kabul eder, sonra
//      POST /wa/bagla/dogrula ile kapıcıya denetletir ("Bağlanacak Program: <firma>") ve ancak o zaman Facebook JS SDK'yı yükler. Sırsız / başka kökenden /
//      pencereyi açanı olmayan sayfa Meta akışını BAŞLATMAZ (WA_YALNIZ_PROGRAM). Neden (bağımsız gözden geçirme, ORTA): sırsız bağlantı TAŞINABİLİRDİ —
//      saldırgan kendi kurulumuyla açtığı oturumun adresini kurbana "WhatsApp'ınızı bağlayın" diye yollar, kurban Embedded Signup'ı tamamlar, belirteç
//      saldırganın anahtarına şifrelenirdi. Sayfa (Meta'nın "Allowed domains" listesindeki sabit HTTPS alanı) Facebook JS SDK ile FB.login({ config_id,
//      response_type: "code", override_default_response_type: true, extras }) → Meta penceresi → WA_EMBEDDED_SIGNUP olayı (waba_id, phone_number_id, olay
//      türü) + değişim KODU (ömrü ~30 sn) → POST /wa/bagla/kod (sırla).
//   3. Kapıcı kodu HEMEN değiştirir: GET <graph>/<sürüm>/oauth/access_token?client_id&client_secret&code → işletme belirteci → programın geçici açık anahtarıyla
//      şifreler (kapi-protokol waSifrele) ve oturuma yazar (düz belirteç saklanmaz). Kod tek kullanımlık: oturum "isleniyor"a koşullu yazımla geçer, ikinci
//      gönderim 409.
//   4. Program → POST /v1/ofis/<ofis>/wa/oturum/<kimlik>/al (imzalı; yalnız oturumu açan ofis) → şifreli belirteç bir kez verilir ve oturum SİLİNİR.
//   Sır tek kullanımlık: oturum "bekliyor"dan çıkınca (kod / iptal) aynı sırla ikinci gönderim 409; kapıcı yalnız özeti saklar, sabit süreli karşılaştırır.
//   Süresi geçen oturum her erişimde silinir; zamanlanmış tur da (temizlik.mjs) siler.
//   Sayfa çerçeveye alınamaz (CSP frame-ancestors 'none' + X-Frame-Options DENY) ve Cross-Origin-Opener-Policy KOYMAZ (pencereyi açanla bağ gerekli).
// env: WA_UYGULAMA_KIMLIGI (Meta App ID — gizli değil), WA_KURULUM_KIMLIGI (Embedded Signup yapılandırma kimliği, config_id — gizli değil), WA_UYGULAMA_SIRRI
// (gizli; W9 kanca imzasıyla aynı App Secret), isteğe bağlı WA_GRAPH_URL (yalnız test), WA_KURULUM_EKLERI (JSON; FB.login extras — D0).
import { KAPI_KURALLARI as K, OFIS_KIMLIGI, acikAnahtar, b64url, ecdsaDogrula, esitMi, mesaj, sha256Hex, waBaglam, waSifrele } from "../../server/lib/kapi-protokol.mjs";
import { metaAnahtari } from "./makine.mjs";

export const WA_OTURUM = Object.freeze({ sureMs: 10 * 60_000, govdeAzami: 8 * 1024, kodAzami: 4096 });
// D0 (Tech Provider aşamasında Meta'nın "Embedded Signup Builder → Check a launch config" ile doğrulanır; tek yer): Graph sürümü ve FB.login ekleri.
export const WA_BAGLA_D0 = Object.freeze({ graphSurum: "v26.0", sdkAdresi: "https://connect.facebook.net/tr_TR/sdk.js", ekler: Object.freeze({ setup: {}, sessionInfoVersion: "3", version: "v5" }) });
const GRAPH_VARSAYILAN = "https://graph.facebook.com";
export const WA_ONAY_ILETISI = "Bu bağlantı DestekOfis'in Meta onayından sonra çalışır; şimdilik Elle Bağla.";
export const WA_YALNIZ_PROGRAM = "Bu bağlantı yalnız DestekOfis programından açılır. Bağlantıyı size başkası gönderdiyse pencereyi kapatın.";
export const WA_OTURUM_YOLU = /^\/v1\/ofis\/([^/]+)\/wa\/oturum(?:\/([A-Za-z0-9_-]{43})\/al)?$/;
const OTURUM = /^[A-Za-z0-9_-]{43}$/;
const SIR = /^[A-Za-z0-9_-]{43}$/; // 32 rastgele bayt, base64url
const SIR_OZETI = /^[0-9a-f]{64}$/; // SHA-256 (onaltılık) — kapıcı sırrın kendisini görmez, yalnız özetini saklar
const FIRMA_AZAMI = 120;
// Firma adı (programın Ofis Bilgileri'nden; sayfada textContent ile): denetim ve yön (bidi) karakterleri çıkarılır, tek satır, ≤ 120 karakter.
const firmaAdi = deger => String(deger ?? "").replace(/[\u0000-\u001f\u007f-\u009f\u200e\u200f\u202a-\u202e\u2066-\u2069]+/g, " ").replace(/\s+/g, " ").trim().slice(0, FIRMA_AZAMI);
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
  "kapi-wa-sir": [403, WA_YALNIZ_PROGRAM],
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

// Bağlama sayfasının iletileri (wa-ayar JSON bloğuyla sayfaya; betikte metin yok).
const SAYFA_ILETILERI = Object.freeze({
  bekleniyor: "DestekOfis programı bekleniyor…",
  yalniz: WA_YALNIZ_PROGRAM,
  oturumYok: "Bağlama oturumu bulunamadı; programda WhatsApp'ı Bağla'yı yeniden açın.",
  denetleniyor: "Bağlama oturumu denetleniyor…",
  yukleniyor: "Facebook bağlantısı yükleniyor…",
  sdkYok: "Facebook bağlantısı yüklenemedi; internet bağlantınızı denetleyip programda WhatsApp'ı Bağla'yı yeniden açın.",
  basin: "Facebook ile Devam Et'e basın.",
  pencere: "Meta penceresi açıldı; adımları tamamlayın.",
  tamamlaniyor: "Bağlantı tamamlanıyor…",
  tamam: "Bağlantı tamamlandı. Bu pencereyi kapatıp DestekOfis'e dönün.",
  yarida: "Bağlama yarıda bırakıldı. Programda WhatsApp'ı Bağla'yı yeniden açabilirsiniz.",
  iptalNeden: "Bağlama Meta penceresinde yarıda bırakıldı.",
  girisYok: "Facebook girişi tamamlanmadı.",
  metaRed: "Meta bağlantıyı tamamlamadı.",
  metaOnek: "Meta'nın yanıtı: ",
  ulasilamadi: "Kapıcıya ulaşılamadı; internet bağlantınızı denetleyip yeniden deneyin.",
  firmaYok: "(firma adı yazılmamış)",
});

// Bağlama sayfasının betiği (nonce'lu; String.raw, içinde ${…} YOK — değerler wa-ayar JSON bloğundan). El sıkışma:
//   sayfa → pencereyi açan: { tur: "destekofis-wa-hazir", oturum } (yalnız oturum kimliği — adreste zaten var; hedef "*")
//   pencereyi açan (program) → sayfa: { tur: "destekofis-wa-sir", oturum, sir } (program hedef kökeni TAM kapıcı verir)
//   sayfa: event.source === window.opener VE köken yerel / özel ağ (yerelKoken) değilse yok sayar; 15 sn'de sır gelmezse WA_YALNIZ_PROGRAM. Sırrı alınca
//   "destekofis-wa-alindi" der, window.opener'ı keser (Facebook betiği programın penceresine erişemesin), /wa/bagla/dogrula ile denetletir, ancak o zaman SDK'yı yükler.
// yerelKoken — WA_YEREL_KOKEN kuralı (program tarafında server/lib/whatsapp/embedded.mjs isLocalOrigin ve client/assets/hof-whatsapp-ayar.js isLocalOrigin AYNI kural;
// test/whatsapp-w7-tasinma-248.test.mjs üçünü tek tabloyla karşılaştırır). Kabul: http/https VE ad localhost | [::1] | *.local (mDNS, RFC 6762; genel DNS'te
// çözülmez) | IPv4 127.0.0.0/8 (geri döngü), 10.0.0.0/8, 172.16.0.0/12, 192.168.0.0/16 (RFC 1918 özel ağ). Program ofiste localhost'tan, ağdaki öbür
// bilgisayarlardan IP ile açılır (lib/discovery.mjs IP verir). BİLEREK DIŞARIDA: ofis tünel adresi (*.destekofis.net — saldırganın kendi programı da oradan
// sunulur), bütün genel adlar, tek etiketli ad (OFIS-PC — DNS arama son ekiyle dışarı çözülebilir), *.lan / *.home.arpa / *.internal, 100.64.0.0/10 (CGNAT),
// 169.254.0.0/16, IPv6 ULA, file: / data: / blob: ("null" köken). Bilinen sınır: aynı ofis ağındaki kötü niyetli bir cihaz özel ağ adresinden sayfa sunabilir.
const SAYFA_BETIGI = String.raw`(()=>{'use strict';
const ayar=JSON.parse(document.getElementById('wa-ayar').textContent);
const m=/(?:^#|&)o=([A-Za-z0-9_-]{43})/.exec(location.hash);const oturum=m?m[1]:'';history.replaceState(null,'',location.pathname);
const durum=t=>{document.getElementById('wa-durum').textContent=t};const dugme=document.getElementById('wa-bagla');
if(ayar.kapali)return;const L=ayar.ileti;
if(!oturum){durum(L.oturumYok);return}
function yerelKoken(k){let u;try{u=new URL(String(k))}catch(x){return false}if((u.protocol!=='http:'&&u.protocol!=='https:')||u.origin!==String(k))return false;const h=u.hostname;if(h==='localhost'||h==='[::1]'||/^([a-z0-9-]+\.)+local$/.test(h))return true;const p=/^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/.exec(h);if(!p)return false;const a=Number(p[1]),b=Number(p[2]);return a===127||a===10||(a===172&&b>=16&&b<=31)||(a===192&&b===168)}
const acan=window.opener;
if(!acan){durum(L.yalniz);return}
let sir='';let bitti=false;let bilgi={};let zil=0;let sure=0;
const gonder=async(yol,veri)=>{try{const r=await fetch(yol,{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify(Object.assign({oturum:oturum,sir:sir},veri))});const g=await r.json().catch(()=>({}));return{ok:r.ok&&g.ok===true,veri:g.data||{},ileti:[g.error,g.metaIleti?L.metaOnek+g.metaIleti:''].filter(Boolean).join(' ')}}catch(x){return{ok:false,veri:{},ileti:L.ulasilamadi}}};
const elSikis=e=>{if(sir||e.source!==acan||!yerelKoken(e.origin))return;const d=e.data;if(!d||typeof d!=='object'||d.tur!=='destekofis-wa-sir'||d.oturum!==oturum||!/^[A-Za-z0-9_-]{43}$/.test(String(d.sir||'')))return;
sir=d.sir;window.removeEventListener('message',elSikis);clearInterval(zil);clearTimeout(sure);
try{acan.postMessage({tur:'destekofis-wa-alindi',oturum:oturum},e.origin)}catch(x){}
try{window.opener=null}catch(x){}
hazirla()};
window.addEventListener('message',elSikis);
const hazirDe=()=>{try{acan.postMessage({tur:'destekofis-wa-hazir',oturum:oturum},'*')}catch(x){}};
zil=setInterval(hazirDe,500);sure=setTimeout(()=>{if(sir)return;clearInterval(zil);window.removeEventListener('message',elSikis);durum(L.yalniz)},15000);hazirDe();
async function hazirla(){durum(L.denetleniyor);const s=await gonder('/wa/bagla/dogrula',{});if(!s.ok){durum(s.ileti||L.yalniz);return}
document.getElementById('wa-firma').textContent=String(s.veri.firma||L.firmaYok);document.getElementById('wa-hedef').hidden=false;durum(L.yukleniyor);
window.fbAsyncInit=()=>{FB.init({appId:ayar.appId,autoLogAppEvents:true,xfbml:false,version:ayar.surum});dugme.disabled=false;durum(L.basin)};
const b=document.createElement('script');b.async=true;b.crossOrigin='anonymous';b.src=ayar.sdk;b.onerror=()=>durum(L.sdkYok);document.body.appendChild(b)}
window.addEventListener('message',e=>{if(!sir||!/^https:\/\/([a-z0-9-]+\.)*facebook\.com$/.test(e.origin))return;let d;try{d=typeof e.data==='string'?JSON.parse(e.data):e.data}catch(x){return}if(!d||d.type!=='WA_EMBEDDED_SIGNUP')return;
if(/^FINISH/.test(String(d.event||'')))bilgi={wabaId:String(d.data?.waba_id||''),phoneNumberId:String(d.data?.phone_number_id||''),olay:String(d.event)};
else if(d.event==='CANCEL'&&!bitti){bitti=true;gonder('/wa/bagla/kod',{hata:'iptal',ileti:L.iptalNeden}).then(()=>durum(L.yarida))}
else if(d.event==='ERROR'&&!bitti){bitti=true;gonder('/wa/bagla/kod',{hata:'meta',ileti:String(d.data?.error_message||'')}).then(s=>durum(s.ileti||L.metaRed))}});
dugme.addEventListener('click',()=>{if(!sir||bitti)return;dugme.disabled=true;durum(L.pencere);
FB.login(async yanit=>{const kod=yanit&&yanit.authResponse&&yanit.authResponse.code;if(bitti)return;bitti=true;
if(!kod){const s=await gonder('/wa/bagla/kod',{hata:'iptal',ileti:L.girisYok});durum(s.ileti||L.girisYok);return}
for(let i=0;i<20&&!bilgi.wabaId;i+=1)await new Promise(r=>setTimeout(r,250));
durum(L.tamamlaniyor);const s=await gonder('/wa/bagla/kod',Object.assign({kod:kod},bilgi));durum(s.ok?L.tamam:s.ileti)},
{config_id:ayar.configId,response_type:'code',override_default_response_type:true,extras:ayar.ekler})});
})();`;

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

  // 1. Oturum aç (program). Gövdede programın geçici açık anahtarı, tek kullanımlık sırrın ÖZETİ (sır kapıcıya gelmez) ve firma adı.
  async function oturumAc(request, env, ofis, yol) {
    const { meta, govde } = await ofisIstegi(request, env, ofis, yol);
    const anahtar = acikAnahtar(govde.anahtar);
    if (!anahtar) at("kapi-istek");
    const sirOzeti = String(govde.sirOzeti || "");
    if (!SIR_OZETI.test(sirOzeti)) at("kapi-istek");
    // WhatsApp bağlama yazma işidir: yalnız geçerli lisans (hoşgörü değil).
    const gorunum = await lisansGorunumu(env, meta);
    if (gorunum.durum === "dogrulanamadi") at("kapi-lisans-dogrulanamadi");
    if (gorunum.durum !== "gecerli") at("kapi-lisans");
    if (!ayarli(env)) at("kapi-wa-ayar");
    await hizDenetle(env, "wa-oturum", ofis, 10);
    await waOturumTemizle(env, now(), 20).catch(() => 0);
    const id = b64url(globalThis.crypto.getRandomValues(new Uint8Array(32)));
    await env.OZET.put(oturumAnahtari(id), JSON.stringify({ v: 1, ofis, anahtar, sirOzeti, firma: firmaAdi(govde.firma), ms: now(), durum: "bekliyor" }), JSON_TURU);
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
    // appId: belirtecin ait olduğu Meta uygulaması (DestekOfis'in, WA_UYGULAMA_KIMLIGI — gizli değil). Program ekstre şablonunun örnek PDF'ini Meta'ya bununla
    // yükler (Resumable Upload /<App ID>/uploads); vermezsek "WhatsApp'ı Bağla" ile bağlanan şirkette Ekstre şablonu hiç açılamaz.
    return json(200, { ok: true, data: { durum: "hazir", sifreli: o.sifreli, wabaId: o.wabaId, phoneNumberId: o.phoneNumberId, olay: o.olay, ...(META_KIMLIK.test(String(o.appId || "")) ? { appId: o.appId } : {}) } });
  }

  // 2. Bağlama sayfası (kapi.<alan>/wa/bagla). Oturum kimliği adresin # kısmında (sunucu günlüğüne, Referer'a düşmez); SIR adreste YOK (postMessage ile
  // pencereyi açandan gelir); App Secret sayfaya GİRMEZ. Facebook SDK'sı sayfada yazılı değil: sır kapıcıda doğrulanınca betik yükler.
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
    const ayar = JSON.stringify(hazir ? { appId: String(env.WA_UYGULAMA_KIMLIGI), configId: String(env.WA_KURULUM_KIMLIGI), surum: WA_BAGLA_D0.graphSurum, ekler, sdk: WA_BAGLA_D0.sdkAdresi, ileti: SAYFA_ILETILERI } : { kapali: true }).replace(/</g, "\\u003c");
    const stil = "font-family:system-ui,sans-serif;padding:24px;max-width:560px;margin:auto;color:#102a36;line-height:1.5";
    const govde = `<!doctype html><html lang="tr"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>WhatsApp'ı Bağla — DestekOfis</title>
<body style="${stil}"><h1 style="font-size:22px">WhatsApp'ı Bağla</h1>
<p>İşletmenizin WhatsApp Business numarasını DestekOfis'e bağlamak için Facebook hesabınızla giriş yapın; açılan Meta penceresinde işletmenizi ve numaranızı seçin. Numara WhatsApp Business uygulamasında da kullanılmaya devam eder.</p>
<p id="wa-hedef" hidden style="padding:10px 12px;border-radius:8px;background:#eef6f9;overflow-wrap:anywhere">Bağlanacak Program: <strong id="wa-firma"></strong></p>
<p><button type="button" id="wa-bagla" disabled style="padding:10px 18px;border-radius:8px;border:0;background:#0f6a8b;color:#fff;font-size:16px">Facebook ile Devam Et</button></p>
<p id="wa-durum" role="status" style="font-weight:600">${hazir ? kacir(SAYFA_ILETILERI.bekleniyor) : kacir(WA_ONAY_ILETISI)}</p>
<p style="font-size:12px;color:#5b6b73">Bu pencere yalnız DestekOfis programındaki WhatsApp'ı Bağla düğmesiyle açılır; işlem bitince kapatıp programa dönün. Bağlama 10 dakika içinde tamamlanmalıdır.</p>
<script type="application/json" id="wa-ayar">${ayar}</script>
<script nonce="${nonce}">${SAYFA_BETIGI}</script></body></html>`;
    // CSP (D0: gerçek Meta akışında Tech Provider aşamasında doğrulanır): betik yalnız bu sayfanın nonce'u ve Facebook SDK; bağlantı / çerçeve yalnız Facebook;
    // sayfa başka sitenin çerçevesine alınamaz (frame-ancestors 'none' + X-Frame-Options DENY). COOP YOK: sır pencereyi açandan postMessage ile gelir.
    const csp = `default-src 'self'; script-src 'nonce-${nonce}' https://connect.facebook.net; connect-src 'self' https://*.facebook.com https://*.facebook.net; frame-src https://*.facebook.com https://*.facebook.net; img-src 'self' data: https://*.facebook.com https://*.fbcdn.net https://*.facebook.net; style-src 'self' 'unsafe-inline'; base-uri 'none'; form-action 'none'; frame-ancestors 'none'`;
    return new Response(govde, { status: 200, headers: { "content-type": "text/html; charset=utf-8", ...GUVENLIK, "x-frame-options": "DENY", "content-security-policy": csp } });
  }

  // Sayfanın istekleri (dogrula, kod): köken, hız, oturum, süre ve SIR (sabit süreli, özetle). Sırsız / yanlış sırlı istek oturuma dokunmaz.
  async function sayfaOturumu(request, env, url) {
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
    const sir = String(govde.sir || "");
    // Özeti olmayan oturum (eski kayıt) da reddedilir: sır karşılaştırması atlanamaz.
    if (!SIR.test(sir) || !SIR_OZETI.test(String(o.sirOzeti || "")) || !esitMi(await sha256Hex(sir), o.sirOzeti)) at("kapi-wa-sir");
    if (o.durum !== "bekliyor") at("kapi-wa-kullanildi");
    return { id, kayit, o, govde };
  }

  // 2b. Sırrı denetle (sayfa; Meta akışından ÖNCE): firma adını verir. Sır burada TÜKETİLMEZ (tek kullanım kod / iptal gönderiminde).
  async function dogrula(request, env, url) {
    const { o } = await sayfaOturumu(request, env, url);
    return json(200, { ok: true, data: { firma: String(o.firma || ""), kalanSn: Math.max(0, Math.round((WA_OTURUM.sureMs - (now() - Number(o.ms || 0))) / 1000)) } });
  }

  // 3. Kod (bağlama sayfası). Kod ve sır tek kullanımlık; App Secret yalnız bu istekte, kapıcıdan Meta'ya.
  async function kodAl(request, env, url) {
    const { id, kayit, o, govde } = await sayfaOturumu(request, env, url);
    const yaz = (veri, etag) => env.OZET.put(oturumAnahtari(id), JSON.stringify(veri), { ...JSON_TURU, onlyIf: { etagMatches: etag } });
    // Kullanıcı Meta penceresini kapattı / Meta hata verdi: oturum "hata" olur, program iletiyi gösterir.
    if (govde.hata) {
      const metaIleti = temizIleti(govde.ileti, [String(env.WA_UYGULAMA_SIRRI || ""), String(govde.sir || "")]);
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
    // Tek kullanım: koşullu yazımla "isleniyor" (aynı kod / sır iki kez gönderilirse ikincisi 409).
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
      if (!yanit.ok || typeof veri?.access_token !== "string" || !/^[\x21-\x7e]+$/.test(veri.access_token)) await hataYaz(temizIleti(veri?.error?.message || `HTTP ${yanit.status}`, [sir, kod, String(govde.sir || "")]));
    } catch (error) {
      if (error instanceof WaHatasi) throw error;
      await hataYaz("Meta'ya ulaşılamadı.");
    }
    const sifreli = await waSifrele(o.anahtar, veri.access_token, waBaglam(o.ofis, id));
    await env.OZET.put(oturumAnahtari(id), JSON.stringify({ ...o, durum: "hazir", sifreli, wabaId, phoneNumberId, olay, appId: String(env.WA_UYGULAMA_KIMLIGI) }), JSON_TURU);
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
      if (url.pathname === "/wa/bagla/dogrula" && request.method === "POST") return await dogrula(request, env, url);
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
