// GERÇEK EDM TEST ORTAMI DÜZENEĞİ — e-SMM uçtan uca (2.4.4 iş listesi 24). 2.4.3'ün düzeneğinin (docs/kanit/2026-10-19/edm-gercek-243/betik.mjs)
// genişletilmiş, kalıcı hâli: programın KENDİ API'siyle, üretim bayraklarıyla (server/server.mjs'ten okunur), sahte EDM'siz.
//
// Kullanım (kimlik bilgisi YALNIZ ortam değişkeninden; hiçbir dosyaya, günlüğe yazılmaz — çıktı maskelenir):
//   EDM_TEST_KULLANICI=… EDM_TEST_PAROLA=… node --disable-warning=ExperimentalWarning tools/edm-gercek.mjs --gercek [--cikti <klasör>] [--beklenen <json>] [--uzerine-yaz]
//   Kuru koşu (sahte EDM, ağa çıkmaz): EDM_TEST_KULLANICI=edmkullanici EDM_TEST_PAROLA=Gizli-Parola-1 node … tools/edm-gercek.mjs --kuru [--cikti <klasör>]
// Varsayılan çıktı: docs/kanit/<bugün>/244-edm/ (gerçek) · docs/kanit/<bugün>/244-edm/kuru/ (kuru). Her adım <adım>.json; özet ozet.json + OZET.md (kullanıcı
// EDM test portalında bakabilsin diye gönderilen her belgenin numarası, ETTN'si, tutarı, son durumu).
// Çıkış: 0 hepsi geçti · 1 denetim kaldı · 2 giriş başarısız (HEMEN durdu, yeniden denenmedi — hesap kilitlenmesin) · 3 çıktıda kimlik bilgisi bulundu ·
// 4 koşu geçersiz (gece yarısı geçti, ders 22) ya da kurulum hatası.
//
// Güvenceler:
//   - Adres SABİT: e-Fatura https://test.edmbilisim.com.tr/EFaturaEDM21ea/EFaturaEDM.svc, e-SMM …/ESmmEDM.svc (program bu adresleri ortamın "test" adresi olarak
//     verir; betik programın sabitleriyle karşılaştırır). Bekçi: programın ve betiğin BÜTÜN dış istekleri izin listesinden geçer — gerçek kipte yalnız bu iki uç
//     (+ yerel 127.0.0.1), kuru kipte yalnız yerel. Canlı (portal2 / portal4 / başka her adres) isteği ağa ÇIKMADAN "bağlantı kurulamadı" (ECONNREFUSED)
//     olarak düşer (program numarayı geri bırakır) ve bekci.json'a yazılır; Entegratör Ayarları her zaman Test Ortamı.
//   - Giriş (Bağlantıyı Test Et) başarısızsa betik başka hiçbir EDM isteği yapmadan durur.
//   - Lisans servisi yerel ölü adres (HUKUK_LICENSE_URL=http://127.0.0.1:9, ders 30); lisans uygulanmaz (enforce: false — yeni kurulum aksi hâlde salt okunur).
//   - Veri klasörü geçici (os.tmpdir), koşu sonunda silinir (mühürlü parola dahil). Çıktı klasöründeki her dosya bitişte kimlik bilgisi için taranır.
//   - Beklenen tutarlar (kâhin) bu betikte YAZILMAZ (ders 5): --beklenen ile kodu görmeyen elden gelen JSON verilirse karşılaştırılır, yoksa "kâhin verilmedi".
//
// Adımlar (her adımda yanıt kodu + gövdesi + veri tabanı okunur, ders 3). Sıra: kronoloji gereği eski tarihli belgeler önce (g), bugünküler sonra (b).
//   a  Bağlantıyı Test Et (e-Fatura + e-SMM) — giriş başarısızsa DUR
//   g  "Kes, Sonra Gönder" ile 3 e-SMM + 2 e-Arşiv (−2 / −1 gün) → Seçilenleri Gönder ön denetimi + eski tarihli seçilmemiş belge 409 → Seçilenleri Gönder →
//      Tümünü Gönder; TES ve TEA numaraları tarih sırasıyla ardışık
//   b  e-SMM Kaydet ve Gönder: tek kalem (1 × 1.000) ve çok kalem (2 × 100,03 — stopaj yuvarlama); UBL tutarları programın tutarlarıyla tutarlı mı
//   c  Durum Sorgula (son duruma kadar)
//   d  Resmî görüntü (GetSMM) PDF: tür, %PDF- başlığı, boyut, indirme adı; pdftotext varsa numara / ETTN
//   e  İptal (8 gün içinde): EDM'de ve programda; ardından EDM durumu
//   f  "Bulunamadı" kodu: EDM'de olmayan makbuzun durumu / iptali / görüntüsü (madde 22 MISSING_CODES için), e-Arşiv karşılığı
//   h  Görülen ret / hata kodları (PACKAGE-FAIL, SEND-FAILED, EDM hata kodu) tek listede
//
// --eszamanli (2.4.4 iş listesi 24b, kullanıcı 22.10.2026: "aynı anda 20-30 tane e-SMM kesip EDM'ye gönderip sonuçlarını kontrol eder misin"): g/b/e/f
// yerine eşzamanlılık adımları (a, cariler + kullanıcılar, sonra):
//   ya  AYNI ANDA 31 istek, 3 kullanıcı oturumundan (yönetici + fatura yetkili 2 kullanıcı): 20 e-SMM "Kaydet ve Gönder" (eSend now) + 10 e-SMM
//       "Kes, Sonra Gönder" (eSend later; gönderim sürerken kayıt — N10) + 1 yetkisiz kullanıcı (403 beklenir). Alıcılar karışık: VKN'li iki şirket
//       (stopaj %20, farklı adresler) ve TCKN'li kişi (stopajsız); tutarlar farklı, küsuratlı. Program EDM oturum önbelleği boş başlar (soğuk: sabah ilk
//       gönderim / program yeniden açıldı — eşzamanlı Login'in ön koşulu, ders 20); --sicak ile önbellek korunur.
//   yb  İki kullanıcı AYNI ANDA Tümünü Gönder (arayüzün döngüsüyle: imleç, kalan, durdu) + yönetici aynı anda A belgelerine Durum Sorgula; Gönderilecekler'de
//       kalan olursa arayüzün iletisindeki gibi en çok 2 kez yeniden basılır.
//   yc  Durum Sorgula (30 belge, son duruma kadar) · yd  3 resmî görüntü (VKN'li A, TCKN'li A, B)
//   ye  BAĞIMSIZ OKUYUCU: programın EDM istemcisinden ayrı, EDM'nin e-SMM Request-Response belgesindeki GetSMM örneğinden yazılmış istek (kendi Login'i,
//       koşunun EN SONUNDA): her ETTN EDM'de aranır, EDM'nin kaydındaki numara programınkiyle karşılaştırılır
//   yf  Değişmezler (KURALDAN, programın kodundan değil — ders 5): tam 30 belge, ETTN tekil, TES tekil + ardışık + seride boşluk yok, belge tarihi koşu
//       günü, her belgede tek gönderim olayı, 11048 yok, stopaj VKN → %20 / TCKN → 0 (talimat), bir VKN'li + bir TCKN'li UBL GİB UBL-TR 1.2.1 XSD'sine uygun.
//       BİLGİ: Login sayısı ve en çok eşzamanlı Login, en çok eşzamanlı SendSMM, istek süreleri (30 sn'yi aşan = arayüz zaman aşımı sınırı).
//   Belgeler İPTAL EDİLMEZ (kullanıcı EDM test portalında görecek). Çıktı: docs/kanit/<gün>/244-edm-eszamanli/{gercek|kuru}/.
//   Yalnız kuru kipte (sahte EDM): --zorla (sahte EDM SendSMM / Login yanıtlarını geciktirir; ön koşul denetimi: en çok eşzamanlı SendSMM ≥ 10) · --ariza
//   kayip|cift|durum|aski (testin dişi: düzenek KIRMIZI vermeli) | tek-oturum|es-giris (EDM davranışı: Login öbür oturumları düşürür / başka giriş sürerken
//   gelen giriş reddedilir — gerçek EDM'de görüldü; tek uçuş girişle (N4) program geçmeli) · --zaman-asimi <ms>.
//   N4 (22.10.2026): programın girişi tek uçuştur — ya'da denetim: aynı anda en çok 1 Login, soğuk başta tam 1.
//     EDM_TEST_KULLANICI=… EDM_TEST_PAROLA=… node --disable-warning=ExperimentalWarning tools/edm-gercek.mjs --gercek --eszamanli [--sicak] [--cikti <klasör>]
import { execFileSync } from "node:child_process";
import { randomBytes, randomUUID } from "node:crypto";
import { existsSync, mkdirSync, mkdtempSync, readFileSync, readdirSync, rmSync, statSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

// ---------- Sabitler ----------
export const TEST_URLS = Object.freeze({
  fatura: "https://test.edmbilisim.com.tr/EFaturaEDM21ea/EFaturaEDM.svc",
  smm: "https://test.edmbilisim.com.tr/EFaturaEDM21ea/ESmmEDM.svc",
  portal: "https://test.edmbilisim.com.tr/EFaturaUI21ea/",
});
export const DEAD_LICENSE_URL = "http://127.0.0.1:9";
const TEST_ORIGIN = "https://test.edmbilisim.com.tr";
const TEST_PATHS = new Set(["/EFaturaEDM21ea/EFaturaEDM.svc", "/EFaturaEDM21ea/ESmmEDM.svc"]);
// EDM test hesabının kendi VKN'si ve etiketleri (2.4.3 düzeneğiyle aynı; gönderen bu VKN olmak zorunda).
const SELLER = { name: "DENEME TICARET LTD. STI.", taxNo: "3230512384", taxOffice: "Kadıköy", address: "Test Cd. 1", district: "Kadıköy", city: "İstanbul", postalCode: "34000", email: "test@destekofis.com.tr" };
const GB = "urn:mail:defaultgb@edmbilisim.com.tr";
const PK = "urn:mail:defaultpk@edmbilisim.com.tr";
const PERSON = { name: "Ahmet Yılmaz", type: "customer", partyKind: "person", firstName: "Ahmet", familyName: "Yılmaz", taxNo: "10000000146", taxOffice: "Kadıköy", city: "İstanbul", address: "Deneme Sk. 2", district: "Kadıköy" };
// Serbest meslek makbuzunun alıcısı: stopaj yükümlüsü şirket (e-posta alanı ayrılmış örnek alan adında — EDM e-SMM'yi bu adrese iletmeye çalışırsa kimseye gitmez).
const FIRM = { name: "Deneme Müvekkil Danışmanlık A.Ş.", type: "customer", taxOffice: "Kadıköy", address: "Müvekkil Cd. 5", district: "Kadıköy", city: "İstanbul", email: "muhasebe@example.com" };
const PORTAL_NOTE = 'e-Arşiv belgeleri portalın e-Arşiv bölümünde; e-SMM için portalda sarı "SMMM Portalı Girişi" düğmesi';
// --eszamanli: ikinci şirket alıcı (başka il, başka adres) ve tutarlar (küsuratlı; bazıları iki kalem). A: 20 Kaydet ve Gönder, B: 10 Kes, Sonra Gönder.
const FIRM2 = { name: "Deneme Hukuk Danışmanlık Ltd. Şti.", type: "customer", taxOffice: "Çankaya", address: "Atatürk Bulvarı 77", district: "Çankaya", city: "Ankara", email: "fatura@example.org" };
const ESZ_A = [1000, 2500.5, 333.33, [100.03, 100.03], 1234.56, 750, 99.99, 4200.1, 15000, 812.47, [60.6, 39.4], 2999.99, 5000.05, 455.45, 120, 7777.77, 300.3, [640.01, 0.99], 18.18, 1999.95];
const ESZ_B = [450, 1250.75, 88.88, [500.5, 499.5], 3333.33, 66.67, 9999.99, 205.05, 710, 1.01e3];
export const ESZ_ARIZALAR = Object.freeze(["kayip", "cift", "durum", "aski", "tek-oturum", "es-giris"]);
const SEND_PENDING_URL = "/api/workspace/invoices/send-pending";

// ---------- Adres denetimi (bekçi) ----------
/**
 * Bu adrese istek gidebilir mi? Yerel (127.0.0.1 / localhost / ::1) her kipte; EDM test ortamının iki ucu yalnız gerçek kipte. Başka her adres (canlı EDM
 * portal2 / portal4, büyük harf / port / yol varyantları, başka ana bilgisayar) REDDEDİLİR. Kara liste değil izin listesi.
 */
export function izinliAdres(url, { mod = "kuru" } = {}) {
  let parsed;
  try {
    parsed = new URL(String(url));
  } catch {
    return false;
  }
  const host = parsed.hostname.replace(/^\[|\]$/g, "").toLowerCase();
  if (["127.0.0.1", "localhost", "::1"].includes(host) && parsed.protocol === "http:") return true;
  if (mod !== "gercek") return false;
  return parsed.protocol === "https:" && parsed.origin === TEST_ORIGIN && !parsed.port && !parsed.username && !parsed.password && TEST_PATHS.has(parsed.pathname);
}

/** fetch sarmalayıcısı: izinsiz adres ağa çıkmadan "bağlantı kurulamadı" (ECONNREFUSED) hatasıyla düşer; her istek kayda yazılır. */
export function bekciFetch(inner, { mod, kayit }) {
  return async function bekci(input, init) {
    const url = String(typeof input === "string" || input instanceof URL ? input : input.url);
    const where = (() => {
      try {
        const parsed = new URL(url);
        return `${parsed.protocol}//${parsed.host}${parsed.pathname}`;
      } catch {
        return "geçersiz adres";
      }
    })();
    if (!izinliAdres(url, { mod })) {
      kayit.reddedilen.push(where);
      throw Object.assign(new TypeError("fetch failed"), { cause: Object.assign(new Error(`bekçi: izin listesinde olmayan adres (${where}); istek ağa çıkmadı`), { code: "ECONNREFUSED" }) });
    }
    if (!/^http:\/\/(127\.0\.0\.1|localhost|\[::1\])[:/]/i.test(url)) kayit.izinli.push(where);
    return inner(input, init);
  };
}

/** Maskeleme: kimlik bilgisi ve yönetici parolası hiçbir çıktıya girmez. */
export function maskeci(secrets) {
  const list = secrets.filter(item => typeof item === "string" && item.length >= 3).sort((a, b) => b.length - a.length);
  return value => {
    let text = typeof value === "string" ? value : JSON.stringify(value);
    for (const secret of list) text = text.split(secret).join("***");
    return text;
  };
}

/**
 * Resmî PDF'te düzenleyenin unvanı denetim mi, bilgi mi? EDM Teknik Operasyon yanıtı (22.10.2026): tüzel kişide (VKN'li) unvan cac:PartyName'den alınır;
 * test ortamının e-SMM görüntüsü canlıdan farklıdır (VKN'li düzenleyende unvan basılmaz, karekod yalnız ETTN), canlıda GİB standardındadır. Bu yüzden
 * e-SMM'de VKN'li düzenleyende (test hesabı hep VKN'li) unvanın görünmemesi BİLGİ olarak kaydedilir, denetimi düşürmez; öbür durumlarda denetimdir.
 */
export function unvanDenetimi({ profile, taxNo }) {
  return profile === "ESMM" && String(taxNo || "").replace(/\s+/g, "").length === 10 ? "bilgi" : "denetim";
}

/** server/server.mjs'teki üretim bayrakları (uygulamayı kuran çağrıya verilen ad: true/false çiftleri). */
export function uretimBayraklari(source) {
  const stripped = source.replace(/\/\*[\s\S]*?\*\//g, "").split(/\r?\n/).map(line => line.replace(/^\s*\/\/.*$/, "")).join("\n");
  const match = /createApp\(\{([^}]*)\}\)/.exec(stripped);
  if (!match) throw new Error("server/server.mjs'te uygulamayı kuran çağrı (bayraklarıyla) bulunamadı");
  const flags = {};
  for (const [, key, value] of match[1].matchAll(/(\w+)\s*:\s*(true|false)/g)) flags[key] = value === "true";
  return flags;
}

// ---------- Eşzamanlılık yardımcıları (--eszamanli) ----------
/** SOAP isteğinin işlem adı (gövdedeki <…Request> öğesi; Envelope/Header/Body atlanır) ya da GET için "WSDL". */
export function soapIslemi(method, body) {
  if (String(method || "GET").toUpperCase() === "GET") return "WSDL";
  const text = String(body || "").replace(/<(?:\w+:)?(Envelope|Header|Body)[\s>]/g, "");
  return (/<(?:\w+:)?(\w+)Request[\s>]/.exec(text) || [])[1] || "?";
}

/**
 * İzleyici fetch: her dış isteği servis (e-Fatura / e-SMM) + işlem adıyla sayar; o anki ve en çok eşzamanlı istek sayısını, süreleri ve Login
 * başlangıç anlarını yazar. Davranışı değiştirmez (hata aynen yükselir).
 */
export function izleyiciFetch(inner, kayit) {
  kayit.islemler ||= {};
  return async function izle(input, init = {}) {
    const url = String(typeof input === "string" || input instanceof URL ? input : input.url);
    const service = /ESmmEDM\.svc/i.test(url) ? "smm" : /EFaturaEDM\.svc/i.test(url) ? "fatura" : "diger";
    const key = `${service}:${soapIslemi(init.method, init.body)}`;
    const item = (kayit.islemler[key] ||= { sayi: 0, hata: 0, anlik: 0, enCokEszamanli: 0, sureMs: [], baslangic: [] });
    item.sayi += 1;
    item.anlik += 1;
    item.enCokEszamanli = Math.max(item.enCokEszamanli, item.anlik);
    const started = Date.now();
    item.baslangic.push(started);
    try {
      return await inner(input, init);
    } catch (error) {
      item.hata += 1;
      throw error;
    } finally {
      item.anlik -= 1;
      item.sureMs.push(Date.now() - started);
    }
  };
}

/** Numara dizisi (seq) tekil ve ardışık mı? Boşluklar ve tekrarlar döner. */
export function ardisikNumara(seqs) {
  const sorted = [...seqs].map(Number).sort((a, b) => a - b);
  const tekrar = sorted.filter((value, i) => i > 0 && value === sorted[i - 1]);
  const bosluk = [];
  for (let i = 1; i < sorted.length; i += 1) for (let n = sorted[i - 1] + 1; n < sorted[i]; n += 1) bosluk.push(n);
  return { tamam: sorted.length > 0 && !tekrar.length && !bosluk.length, en: sorted[0], son: sorted.at(-1), tekrar, bosluk: bosluk.slice(0, 50), boslukSayisi: bosluk.length };
}

const xmlEsc = value => String(value ?? "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
const tagText = (xml, tag) => {
  const match = new RegExp(`<(?:\\w+:)?${tag}(?:\\s[^>]*)?>([\\s\\S]*?)</(?:\\w+:)?${tag}>`).exec(String(xml || ""));
  return match ? match[1].trim() : "";
};

/**
 * BAĞIMSIZ OKUYUCU (ye): programın EDM istemcisinden (server/lib/einvoice/edm.mjs) AYRI — istekler EDM'nin "e-SMM Web API v4 Request-Response"
 * belgesindeki Login / GetSMM örneklerinden yazıldı (ad alanı http://tempuri.org/, çocuk öğeler niteliksiz, SOAPAction "<işlem>Request"). Kendi oturumunu
 * açar (bir Login); GetSMM'i YALNIZ ETTN ile arar (numara verilmez) ve EDM'nin kaydındaki numarayı (SMM/ID) okur — programın numarası EDM'ye sorulmaz.
 * Önce HEADER_ONLY "Y" (içeriksiz) denenir; EDM reddederse programın gerçek EDM'de kanıtlanmış biçimi (HEADER_ONLY "N", PDF) bir kez.
 */
export function edmOkuyucu({ url, username, password, fetchImpl, waitMs = 60_000 }) {
  const NS = "http://tempuri.org/";
  let session = "";
  let headerOnly = "Y";
  const stamp = () => new Date().toISOString().slice(0, 19);
  const header = id => `<REQUEST_HEADER xmlns=""><SESSION_ID>${xmlEsc(id)}</SESSION_ID><CLIENT_TXN_ID>${randomUUID()}</CLIENT_TXN_ID><ACTION_DATE>${stamp()}</ACTION_DATE><REASON>e-SMM eszamanli denetim</REASON><APPLICATION_NAME>DestekOfis Duzenek</APPLICATION_NAME><HOSTNAME>duzenek</HOSTNAME><CHANNEL_NAME>DestekOfis</CHANNEL_NAME><COMPRESSED>N</COMPRESSED></REQUEST_HEADER>`;
  const post = async (op, inner) => {
    const body = `<?xml version="1.0" encoding="utf-8"?><s:Envelope xmlns:s="http://schemas.xmlsoap.org/soap/envelope/"><s:Body><tem:${op}Request xmlns:tem="${NS}">${inner}</tem:${op}Request></s:Body></s:Envelope>`;
    const response = await fetchImpl(url, { method: "POST", headers: { "content-type": "text/xml; charset=utf-8", soapaction: `"${op}Request"` }, body, signal: AbortSignal.timeout(waitMs) });
    const text = await response.text();
    const fault = /<(?:\w+:)?Fault[\s>]/.test(text) || (tagText(text, "ERROR_CODE") && tagText(text, "ERROR_CODE") !== "0");
    return { status: response.status, text, fault, code: tagText(text, "ERROR_CODE"), message: tagText(text, "ERROR_SHORT_DES") || tagText(text, "faultstring") };
  };
  async function login() {
    const r = await post("Login", `${header("-1")}<USER_NAME xmlns="">${xmlEsc(username)}</USER_NAME><PASSWORD xmlns="">${xmlEsc(password)}</PASSWORD>`);
    session = r.fault ? "" : tagText(r.text, "SESSION_ID");
    if (!session) throw Object.assign(new Error(`okuyucu girişi başarısız: HTTP ${r.status} ${r.code} ${r.message}`.trim()), { code: r.code, stage: "login" });
    return true;
  }
  async function lookup(uuid, { retried = false } = {}) {
    if (!session) await login();
    const r = await post("GetSMM", `${header(session)}<SMM_SEARCH_KEY xmlns=""><LIMIT>5</LIMIT><UUID>${xmlEsc(uuid)}</UUID><DIRECTION>OUT</DIRECTION></SMM_SEARCH_KEY><HEADER_ONLY xmlns="">${headerOnly}</HEADER_ONLY><SMM_CONTENT_TYPE xmlns="">PDF</SMM_CONTENT_TYPE>`);
    if (r.fault) {
      if (!retried && (r.code === "10011" || /session/i.test(r.message))) {
        session = "";
        return lookup(uuid, { retried: true });
      }
      if (!retried && headerOnly === "Y") {
        headerOnly = "N";
        return lookup(uuid, { retried: true });
      }
      return { okundu: false, hata: `HTTP ${r.status} ${r.code} ${r.message}`.trim(), kayitlar: [] };
    }
    const kayitlar = [...r.text.matchAll(/<(?:\w+:)?SMM\b[^>]*>([\s\S]*?)<\/(?:\w+:)?SMM>/g)].map(match => ({ id: tagText(match[1], "ID"), uuid: tagText(match[1], "UUID").toLowerCase(), durum: tagText(tagText(match[1], "HEADER"), "STATUS") })).filter(item => item.uuid === String(uuid).toLowerCase());
    return { okundu: true, kayitlar, headerOnly };
  }
  return { login, lookup, get headerOnly() {
    return headerOnly;
  } };
}

/** Arayüzün Tümünü Gönder döngüsü (client/assets/hof-invoices.js runSend): imleçle yinele; durdu, kalan yok ya da imleç ilerlemedi → bitir. */
export async function tumunuGonderDongusu(post, { maxTurns = 50 } = {}) {
  const istekler = [];
  const sonuclar = new Map();
  let cursor = null;
  let rerun = false;
  let stopped = null;
  for (let turn = 0; turn < maxTurns; turn += 1) {
    const r = await post(cursor ? { all: true, after: cursor } : { all: true });
    istekler.push({ status: r.status, sureMs: r.sureMs, askida: Boolean(r.askida), sent: r.data?.sent, failed: r.data?.failed, skipped: r.data?.skipped, done: r.data?.done, remaining: r.data?.remaining, stopped: r.data?.stopped || null, hata: r.status === 200 ? undefined : String(r.data?.error || r.hata || "").slice(0, 300) });
    if (r.status !== 200) break;
    for (const item of r.data.results || []) if (!sonuclar.has(item.id)) sonuclar.set(item.id, { ok: item.ok, done: Boolean(item.done), busy: Boolean(item.busy), skipped: Boolean(item.skipped), reason: item.reason || "", code: item.code || "", number: item.number || "", message: String(item.message || "").slice(0, 300) });
    stopped = r.data.stopped || null;
    rerun = rerun || Boolean(r.data.rerun);
    const moved = Boolean(r.data.cursor) && JSON.stringify(r.data.cursor) !== JSON.stringify(cursor);
    cursor = r.data.cursor || cursor;
    if (stopped || !r.data.remaining || !moved) break;
  }
  return { istekler, sonuclar: Object.fromEntries(sonuclar), rerun, stopped };
}

// ---------- Yardımcılar ----------
const pad = n => String(n).padStart(2, "0");
const localDay = (date = new Date()) => `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
const trTime = iso => {
  if (!iso) return "";
  const date = new Date(iso);
  return Number.isNaN(date.getTime()) ? String(iso) : new Intl.DateTimeFormat("tr-TR", { timeZone: "Europe/Istanbul", day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit", second: "2-digit" }).format(date);
};
const money = value => (value === null || value === undefined || value === "" ? "—" : Number(value).toLocaleString("tr-TR", { minimumFractionDigits: 2, maximumFractionDigits: 2 }));
const sleep = ms => new Promise(resolve => setTimeout(resolve, ms));
const unwrap = r => ({ ...r, data: r.data && typeof r.data === "object" && "ok" in r.data ? (r.data.ok ? r.data.data : r.data) : r.data });
const errOf = r => (r?.data && typeof r.data === "object" ? { status: r.status, code: r.data.code || "", integratorCode: r.data.integratorCode || "", stage: r.data.stage || "", error: String(r.data.error || "").slice(0, 600) } : { status: r?.status });
const xmlNum = (xml, tag, scope = "cac:LegalMonetaryTotal") => Number((new RegExp(`<${scope}>[\\s\\S]*?<cbc:${tag}[^>]*>([^<]+)<`).exec(xml) || [])[1]);
const E_LABEL = { sent: "Kabul (iletildi)", accepted: "Kabul", cancelled: "İptal Edildi", error: "Hata", processing: "İşleniyor", rejected: "Ret", draft: "Taslak", waiting: "Gönderilmedi", none: "Gönderilmedi" };

function argsOf(argv) {
  const out = { mod: "", cikti: "", beklenen: "", uzerine: false, eszamanli: false, sicak: false, zorla: false, ariza: "", zamanAsimi: 0 };
  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    if (arg === "--gercek") out.mod = out.mod ? "çift" : "gercek";
    else if (arg === "--kuru") out.mod = out.mod ? "çift" : "kuru";
    else if (arg === "--cikti") out.cikti = argv[(i += 1)] || "";
    else if (arg === "--beklenen") out.beklenen = argv[(i += 1)] || "";
    else if (arg === "--uzerine-yaz") out.uzerine = true;
    else if (arg === "--eszamanli") out.eszamanli = true;
    else if (arg === "--sicak") out.sicak = true;
    else if (arg === "--zorla") out.zorla = true;
    else if (arg === "--ariza") out.ariza = argv[(i += 1)] || "?";
    else if (arg === "--zaman-asimi") out.zamanAsimi = Number(argv[(i += 1)]) || -1;
    else throw new Error(`tanınmayan seçenek: ${arg}`);
  }
  return out;
}

function walkFiles(dir, out = []) {
  for (const name of readdirSync(dir)) {
    const full = path.join(dir, name);
    if (statSync(full).isDirectory()) walkFiles(full, out);
    else out.push(full);
  }
  return out;
}

// ---------- Ana akış ----------
export async function main(argv = process.argv.slice(2), env = process.env) {
  const args = argsOf(argv);
  if (!["gercek", "kuru"].includes(args.mod)) {
    console.error("kullanım: EDM_TEST_KULLANICI=… EDM_TEST_PAROLA=… node tools/edm-gercek.mjs --gercek | --kuru [--eszamanli [--sicak]] [--cikti <klasör>] [--beklenen <json>] [--uzerine-yaz]");
    return 4;
  }
  // Hata enjeksiyonu, zorla gecikme ve kısa zaman aşımı YALNIZ sahte EDM'de (kuru); gerçek EDM'ye hiçbir istek yapılmadan reddedilir.
  if ((args.zorla || args.ariza || args.zamanAsimi) && (args.mod !== "kuru" || !args.eszamanli)) {
    console.error("--zorla, --ariza ve --zaman-asimi yalnız --kuru --eszamanli ile kullanılır (gerçek EDM'ye hata enjekte edilmez); hiçbir istek yapılmadı.");
    return 4;
  }
  if ((args.sicak && !args.eszamanli) || (args.ariza && !ESZ_ARIZALAR.includes(args.ariza)) || args.zamanAsimi < 0) {
    console.error(`geçersiz seçenek: --sicak yalnız --eszamanli ile; --ariza ${ESZ_ARIZALAR.join(" | ")}; --zaman-asimi milisaniye. Hiçbir istek yapılmadı.`);
    return 4;
  }
  const username = String(env.EDM_TEST_KULLANICI || "");
  const password = String(env.EDM_TEST_PAROLA || "");
  if (!username || !password) {
    console.error("EDM_TEST_KULLANICI ve EDM_TEST_PAROLA ortam değişkenleri verilmedi; hiçbir istek yapılmadı.");
    return 4;
  }
  // Türkiye kurulumu gibi: "bugün" ve gönderim saatleri TR saatiyle.
  process.env.TZ = "Europe/Istanbul";
  const adminPassword = `Edm-${randomBytes(9).toString("hex")}!`;
  // --eszamanli: programın kendi kullanıcıları (fatura yetkili iki kullanıcı + yetkisiz bir kullanıcı); parolaları rastgele ve maskelenir.
  const userPasswords = { fatura1: `Fat1-${randomBytes(9).toString("hex")}!`, fatura2: `Fat2-${randomBytes(9).toString("hex")}!`, personel1: `Per1-${randomBytes(9).toString("hex")}!` };
  const mask = maskeci([password, username, adminPassword, ...Object.values(userPasswords)]);
  const outWrite = process.stdout.write.bind(process.stdout);
  const errWrite = process.stderr.write.bind(process.stderr);
  const masked = write => (chunk, ...rest) => write(typeof chunk === "string" || Buffer.isBuffer(chunk) ? mask(String(chunk)) : chunk, ...rest);
  process.stdout.write = masked(outWrite);
  process.stderr.write = masked(errWrite);
  const restoreStreams = () => {
    process.stdout.write = outWrite;
    process.stderr.write = errWrite;
  };

  const startedAt = new Date();
  const startDay = localDay(startedAt);
  const OUT = path.resolve(args.cikti || (args.eszamanli ? path.join(ROOT, "docs", "kanit", startDay, "244-edm-eszamanli", args.mod === "kuru" ? "kuru" : "gercek") : path.join(ROOT, "docs", "kanit", startDay, "244-edm", ...(args.mod === "kuru" ? ["kuru"] : []))));
  if (existsSync(path.join(OUT, "ozet.json")) && !args.uzerine) {
    console.error(`${OUT} içinde önceki koşunun özeti var; üzerine yazmak için --uzerine-yaz verin (gerçek kanıt yanlışlıkla silinmesin).`);
    restoreStreams();
    return 4;
  }
  mkdirSync(OUT, { recursive: true });
  const write = (name, value) => writeFileSync(path.join(OUT, name), `${mask(JSON.stringify(value, null, 1))}\n`);
  const log = (label, value) => console.log(`${new Date().toISOString().slice(11, 19)} ${label}${value === undefined ? "" : `: ${(typeof value === "string" ? value : JSON.stringify(value)).slice(0, 1400)}`}`);
  let commit = "okunamadı";
  try {
    commit = execFileSync("git", ["-C", ROOT, "rev-parse", "--short", "HEAD"], { encoding: "utf8" }).trim();
  } catch {}

  const steps = [];
  let current = null;
  const step = (key, title) => {
    current = { adim: key, baslik: title, durum: "sürüyor", denetimler: [], kayit: {} };
    steps.push(current);
    console.log(`\n■ ${key}) ${title}`);
    return current;
  };
  const check = (cond, what, data) => {
    const item = { gecti: Boolean(cond), denetim: what, ...(data === undefined ? {} : { veri: data }) };
    current.denetimler.push(item);
    console.log(`  ${cond ? "✓" : "✗"} ${what}`);
    return Boolean(cond);
  };
  // Bilgi: denetim sayılmaz (geçti/kaldı değil), adımın kaydında ve özette görünür.
  const note = (what, data) => {
    (current.bilgiler ||= []).push({ bilgi: what, ...(data === undefined ? {} : { veri: data }) });
    console.log(`  i BİLGİ: ${what}`);
  };
  const finish = (status = null) => {
    current.durum = status || (current.denetimler.every(item => item.gecti) ? "geçti" : "kaldı");
    write(`${current.adim}.json`, current);
  };
  const codes = []; // h: görülen ret / hata kodları
  const noteCode = (where, data) => {
    if (data && (data.integratorCode || /integrator|einvoice|edm/i.test(data.code || "") || data.eStatus === "error" || /FAIL/i.test(data.raw || ""))) codes.push({ yer: where, ...data });
  };

  // Programın kendi modülleri (üretim kodu) ve üretim bayrakları.
  const flags = uretimBayraklari(readFileSync(path.join(ROOT, "server", "server.mjs"), "utf8"));
  const { createApp } = await import(pathToFileURL(path.join(ROOT, "server", "app.mjs")).href);
  const { createClient } = await import(pathToFileURL(path.join(ROOT, "test", "helpers.mjs")).href);
  const { EDM_URLS, EDM_SMM_URLS, createEdmClient, createEdmSmmClient, resetEdmCaches } = await import(pathToFileURL(path.join(ROOT, "server", "lib", "einvoice", "edm.mjs")).href);
  const { integratorSmmUrl, integratorUrl } = await import(pathToFileURL(path.join(ROOT, "server", "lib", "einvoice", "adapters.mjs")).href);
  const { cachedResolver, createProxyFetch } = await import(pathToFileURL(path.join(ROOT, "server", "lib", "net-proxy.mjs")).href);
  const { vkn } = await import(pathToFileURL(path.join(ROOT, "test", "einvoice-mock.mjs")).href);

  const bekci = { izinli: [], reddedilen: [] };
  const nativeFetch = globalThis.fetch;
  globalThis.fetch = bekciFetch(nativeFetch, { mod: args.mod, kayit: bekci });
  const root = mkdtempSync(path.join(tmpdir(), "edm-gercek-"));
  const dataDir = path.join(root, "data");
  // Programın üretimdeki dış istek yolu (vekil sunucu ayarı + ortam değişkenleri) bekçinin arkasında.
  // İzleyici (--eszamanli BİLGİ: Login sayısı, en çok eşzamanlı istek, süreler) bekçinin önünde: reddedilen istek de sayılır.
  const izleme = { program: {}, okuyucu: {} };
  const appFetch = izleyiciFetch(bekciFetch(createProxyFetch({ resolve: cachedResolver({ file: path.join(dataDir, "ag-ayari.json"), env: process.env }), baseFetch: (...a) => nativeFetch(...a) }), { mod: args.mod, kayit: bekci }), izleme.program);

  let mock = null;
  let app = null;
  let exitCode = 0;
  let stopped = "";
  const tracked = []; // EDM'ye gönderilen belgeler (OZET)
  const esz = { marker: "", istekler: [], izleme: {}, edm: {} }; // --eszamanli kayıtları (OZET)

  // ---------- --eszamanli akışı (ya–yf) ----------
  const eszamanliAkis = async ({ api, store, port, account, firm, person, urls }) => {
    const { createClient } = await import(pathToFileURL(path.join(ROOT, "test", "helpers.mjs")).href);
    const { vkn } = await import(pathToFileURL(path.join(ROOT, "test", "einvoice-mock.mjs")).href);
    const base = `http://127.0.0.1:${port}`;
    const year = Number(startDay.slice(0, 4));
    const timeoutMs = args.zamanAsimi || (args.mod === "gercek" ? 200_000 : 20_000);
    const settleCap = args.mod === "gercek" ? 240_000 : 60_000;
    esz.marker = `ESZ-${randomBytes(4).toString("hex")}`;
    const underway = [];
    // Her istek düzenek zaman aşımıyla: yanıt gelmezse "askıda" (istek sürer; değişmezlerden önce bitmesi beklenir).
    const timed = promise => {
      const t0 = Date.now();
      underway.push(promise.catch(() => null));
      let timer;
      return Promise.race([
        promise.then(r => ({ ...r, sureMs: Date.now() - t0 }), error => ({ status: -1, hata: String(error?.message || error).slice(0, 300), sureMs: Date.now() - t0 })),
        new Promise(resolve => {
          timer = setTimeout(() => resolve({ status: 0, askida: true, sureMs: Date.now() - t0 }), timeoutMs);
        }),
      ]).finally(() => clearTimeout(timer));
    };
    const settle = async () => {
      const left = await Promise.race([Promise.allSettled(underway).then(() => 0), sleep(settleCap).then(() => 1)]);
      if (left) note(`${settleCap / 1000} sn sonra hâlâ yanıtı gelmeyen istek var (askı)`);
    };
    // İzleyici kesiti: adım boyunca işlem sayıları ve en çok eşzamanlı istek (adım başında sıfırlanır).
    const izKes = kayit => {
      const start = Object.fromEntries(Object.entries(kayit.islemler || {}).map(([key, item]) => [key, { sayi: item.sayi, hata: item.hata, sure: item.sureMs.length }]));
      for (const item of Object.values(kayit.islemler || {})) item.enCokEszamanli = item.anlik;
      return () =>
        Object.fromEntries(
          Object.entries(kayit.islemler || {})
            .map(([key, item]) => {
              const from = start[key] || { sayi: 0, hata: 0, sure: 0 };
              const durations = item.sureMs.slice(from.sure).sort((a, b) => a - b);
              return [key, { sayi: item.sayi - from.sayi, hata: item.hata - from.hata, enCokEszamanli: item.enCokEszamanli, sureMs: durations.length ? { en: durations[0], medyan: durations[Math.floor(durations.length / 2)], enCok: durations.at(-1) } : null }];
            })
            .filter(([, item]) => item.sayi > 0),
        );
    };
    const spread = values => {
      const sorted = values.filter(Number.isFinite).sort((a, b) => a - b);
      return sorted.length ? { en: sorted[0], medyan: sorted[Math.floor(sorted.length / 2)], enCok: sorted.at(-1) } : null;
    };
    const docRow = id => store.get("SELECT id, number, seq, series, year, ettn, issue_date AS issueDate, issue_time AS issueTime, status, profile, e_status AS eStatus, e_message AS eMessage, net_total AS brut, stoppage_total AS stopaj, vat_total AS kdv, payable_total AS odenecek, party_json AS party, note FROM invoices WHERE id = ?", id);
    const SENT = ["sent", "processing", "accepted"];
    const cents = value => Math.round(Number(value) * 100);

    // ── Kullanıcılar + ikinci şirket alıcı
    step("hazirlik-kullanicilar", "Kullanıcılar: fatura yetkili 2 kullanıcı (Muhasebe rolü) + yetkisiz 1 kullanıcı (Personel); ikinci şirket alıcı (Ankara)");
    const wrap = client => ({ get: async u => unwrap(await client.get(u)), post: async (u, b) => unwrap(await client.post(u, b)), raw: client.raw });
    const sessions = { yonetici: api };
    for (const [name, role, title] of [["fatura1", "muhasebe", "Fatura Bir"], ["fatura2", "muhasebe", "Fatura İki"], ["personel1", "personel", "Personel Bir"]]) {
      const created = await api.post("/api/admin/users", { username: name, name: title, role, password: userPasswords[name], mustChangePassword: false });
      const client = createClient(base);
      const login = created.status === 200 ? await client.login(name, userPasswords[name]) : { status: 0 };
      check(created.status === 200 && login.status === 200, `kullanıcı ${name} (${role}) açıldı, giriş yaptı (${created.status} / ${login.status})`, created.status === 200 ? undefined : errOf(created));
      sessions[name] = wrap(client);
    }
    let firm2Vkn = "";
    for (let i = 0; i < 10 && !firm2Vkn; i += 1) {
      const candidate = vkn(400000000 + Math.floor(Math.random() * 500_000_000));
      const q = await api.post("/api/workspace/invoices/check-user", { taxNo: candidate });
      current.kayit[`sorgu-${i + 1}`] = q.status === 200 ? { taxNo: candidate, registered: q.data.registered } : errOf(q);
      if (q.status === 200 && q.data.registered === false) firm2Vkn = candidate;
    }
    check(Boolean(firm2Vkn), `ikinci şirket alıcının VKN'si EDM'de mükellef değil (Mükellef Sorgula): ${firm2Vkn || "bulunamadı"}`);
    const firm2 = await account({ ...FIRM2, taxNo: firm2Vkn || vkn(422333444) });
    const alicilar = [
      { ad: "Şirket 1 (İstanbul)", id: firm, tur: "VKN" },
      { ad: "Şirket 2 (Ankara)", id: firm2, tur: "VKN" },
      { ad: "Kişi (İstanbul)", id: person, tur: "TCKN" },
    ];
    current.kayit.alicilar = alicilar.map(item => ({ ad: item.ad, tur: item.tur }));
    finish();
    if (current.denetimler.some(item => !item.gecti)) {
      stopped = "kullanıcı ya da alıcı hazırlığı kaldı; eşzamanlı gönderim yapılmadı";
      exitCode = 4;
      return;
    }

    // ── ya) 30 + 1 istek AYNI ANDA
    step("ya-eszamanli-kayit", `AYNI ANDA ${ESZ_A.length + ESZ_B.length + 1} istek, 3 oturumdan: ${ESZ_A.length} e-SMM Kaydet ve Gönder + ${ESZ_B.length} e-SMM Kes, Sonra Gönder + 1 yetkisiz (Personel)`);
    // Kuru kip: sahte EDM'nin gecikmesi (zorla araya girme) ve hata enjeksiyonu (testin dişi) — yalnız bu adımdan itibaren (k: bu adımdaki kaçıncı SendSMM).
    if (mock) {
      const smm = mock.state.smm;
      if (args.zorla) {
        let n = 0;
        smm.delay = op => (op === "SendSMM" ? 300 + ((n += 1) % 5) * 150 : op === "Login" ? 250 : op === "GetSMMStatus" ? 20 : 0);
      }
      const k = smm.sendCount + 5;
      if (args.ariza === "kayip") smm.dropSend = k;
      if (args.ariza === "cift") smm.misrecordSend = k;
      if (args.ariza === "durum") smm.statusAfterSend = { [k]: "PACKAGE - FAIL" };
      if (args.ariza === "aski") smm.holdSend = { k, ms: timeoutMs + 3000 };
      if (args.ariza === "tek-oturum") smm.singleSession = true;
      // es-giris: gerçek EDM'de görülen davranış (başka giriş sürerken gelen giriş WCF reddi); girişler çakışsın diye Login yanıtı gecikir.
      if (args.ariza === "es-giris") {
        smm.rejectConcurrentLogin = true;
        if (!args.zorla) smm.delay = op => (op === "Login" ? 250 : 0);
      }
      current.kayit.sahteEdm = { zorla: args.zorla, ariza: args.ariza || "yok", k };
    }
    const preMax = store.get("SELECT MAX(seq) AS n FROM invoices WHERE series = 'TES' AND year = ? AND seq > 0", year)?.n ?? null;
    const cold = !args.sicak;
    // Soğuk başlangıç (ders 20: eşzamanlı Login'in ön koşulu zorla): programın EDM oturum + sözleşme önbelleği boşaltılır (program yeniden açılmış gibi).
    if (cold) resetEdmCaches();
    note(cold ? "soğuk başlangıç: programın EDM oturum ve sözleşme önbelleği boşaltıldı (sabah ilk gönderim / program yeniden açıldı); her istek kendi girişini dener" : "sıcak başlangıç (--sicak): Bağlantıyı Test Et'in oturumu kullanılır");
    const izProgram = izKes(izleme.program);
    const lineOf = (amount, kod) => (Array.isArray(amount) ? amount : [amount]).map((price, i, all) => ({ name: all.length > 1 ? `Danışmanlık Ücreti (${kod}/${i + 1})` : `Danışmanlık Ücreti (${kod})`, qty: 1, unitPrice: price, vatRate: 20 }));
    const users = ["yonetici", "fatura1", "fatura2"];
    const planA = ESZ_A.map((amount, i) => ({ kod: `A${pad(i + 1)}`, asama: "A", eSend: "now", amount, oturum: users[i % 3], alici: alicilar[i % 3] }));
    const planB = ESZ_B.map((amount, i) => ({ kod: `B${pad(i + 1)}`, asama: "B", eSend: "later", amount, oturum: users[(i + 1) % 3], alici: alicilar[(i + 2) % 3] }));
    // Sıra karışık (2 A : 1 B): Kes, Sonra Gönder kayıtları Kaydet ve Gönder'lerin gönderimi sürerken gelir (N10).
    const order = [];
    for (let a = 0, b = 0; a < planA.length || b < planB.length; ) {
      if (a < planA.length) order.push(planA[a++]);
      if (a < planA.length) order.push(planA[a++]);
      if (b < planB.length) order.push(planB[b++]);
    }
    const bodyNote = kod => `Eşzamanlı deneme ${esz.marker} ${kod}`;
    const bodyOf = item => ({ scenario: "smm", accountId: item.alici.id, lines: lineOf(item.amount, item.kod), payment: { rest: "open" }, eSend: item.eSend, note: bodyNote(item.kod), requestId: randomUUID() });
    const burstStart = Date.now();
    const [answers, unauthorized] = await Promise.all([
      Promise.all(order.map(item => timed(sessions[item.oturum].post("/api/workspace/invoices", bodyOf(item))).then(r => ({ item, r })))),
      timed(sessions.personel1.post("/api/workspace/invoices", { ...bodyOf({ kod: "YETKISIZ", alici: alicilar[0], amount: 500, eSend: "now" }) })),
    ]);
    const burstMs = Date.now() - burstStart;
    await settle();
    const docs = [];
    for (const { item, r } of answers.sort((x, y) => x.item.kod.localeCompare(y.item.kod))) {
      // Yanıtı gelmeyen (askıda) ya da hata dönen istek belgeyi yine de açmış olabilir: işaretli notla veri tabanından bulunur (izlenir, özete girer;
      // isteğin denetimi yine kalır). Kayıp/çift belge de böyle görünür (yf: tam 30).
      const recovered = r.status === 200 && r.data?.id ? "" : store.get("SELECT id FROM invoices WHERE note = ?", bodyNote(item.kod))?.id || "";
      const id = r.status === 200 && r.data?.id ? r.data.id : recovered;
      const doc = id ? docRow(id) : null;
      const auto = r.data?.autoSend || null;
      const rec = { kod: item.kod, asama: item.asama, oturum: item.oturum, aliciTuru: item.alici.tur, alici: item.alici.ad, status: r.status, askida: Boolean(r.askida), sureMs: r.sureMs, id, ...(recovered ? { idKaynagi: "veri tabanı (yanıt gelmedi ya da hata döndü)" } : {}), numaraYanit: r.data?.number || "", autoSend: auto ? { ok: auto.ok, code: auto.code || "", message: String(auto.message || "").slice(0, 300) } : null, hata: r.status === 200 ? undefined : errOf(r) };
      esz.istekler.push(rec);
      if (auto && !auto.ok) noteCode(`ya ${item.kod} gönderim`, { code: auto.code, error: auto.message });
      if (r.status !== 200) noteCode(`ya ${item.kod} kayıt`, errOf(r));
      if (doc) {
        docs.push({ ...item, id, doc });
        tracked.push({ key: item.kod, label: "e-SMM", id, type: "e-SMM", asama: item.asama, oturum: item.oturum, aliciTuru: item.alici.tur });
      }
      const head = `${item.kod} (${item.oturum}, ${item.alici.tur}) ${r.askida ? `ASKIDA: ${timeoutMs / 1000} sn içinde yanıt yok` : `HTTP ${r.status}`} ${r.sureMs} ms`;
      if (item.asama === "A") check(r.status === 200 && !r.askida && auto?.ok === true && doc && /^TES\d{13}$/.test(doc.number || "") && doc.number === rec.numaraYanit && SENT.includes(doc.eStatus), `${head}: Kaydet ve Gönder → ${doc?.number || "numara yok"}, e-Belge durumu ${doc?.eStatus || "—"} (beklenen: EDM'ye iletildi${auto && !auto.ok ? `; ${auto.code} ${String(auto.message || "").slice(0, 160)}` : ""})`, r.status === 200 ? undefined : rec.hata);
      else check(r.status === 200 && !r.askida && doc && !doc.number && doc.eStatus === "waiting" && doc.profile === "ESMM", `${head}: Kes, Sonra Gönder → ${doc ? `numara ${doc.number || "yok"}, ${doc.eStatus}, ${doc.profile}` : "belge yok"} (beklenen: numarasız Gönderilecekler'de)`, r.status === 200 ? undefined : rec.hata);
    }
    const strangerRow = store.get("SELECT COUNT(*) AS n FROM invoices WHERE note = ?", bodyNote("YETKISIZ"))?.n;
    current.kayit.yetkisiz = { status: unauthorized.status, sureMs: unauthorized.sureMs, kod: unauthorized.data?.code || "", belge: strangerRow };
    check(unauthorized.status === 403 && strangerRow === 0, `yetkisiz kullanıcının (Personel) Kaydet ve Gönder'i ${unauthorized.status} ile reddedildi, belge açılmadı, numara harcanmadı (${strangerRow})`);
    const iz = izProgram();
    esz.izleme.ya = iz;
    const aTimes = answers.filter(x => x.item.asama === "A").map(x => x.r.sureMs);
    const bTimes = answers.filter(x => x.item.asama === "B").map(x => x.r.sureMs);
    current.kayit.sureler = { toplamMs: burstMs, kaydetVeGonder: spread(aTimes), kesSonraGonder: spread(bTimes), otuzSnUstu: aTimes.filter(ms => ms > 30_000).length };
    current.kayit.izleme = iz;
    current.kayit.istekler = esz.istekler;
    note(`EDM e-SMM servisine Login: ${iz["smm:Login"]?.sayi || 0} (en çok eşzamanlı ${iz["smm:Login"]?.enCokEszamanli || 0}); SendSMM ${iz["smm:SendSMM"]?.sayi || 0} (en çok eşzamanlı ${iz["smm:SendSMM"]?.enCokEszamanli || 0}); sözleşme (WSDL) okuma ${(iz["smm:WSDL"]?.sayi || 0) + (iz["fatura:WSDL"]?.sayi || 0)}`, { izleme: iz });
    // N4 (baş mimar kararı 22.10.2026, gerçek EDM'de eşzamanlı girişin biri reddedildi): giriş TEK UÇUŞ — aynı anda en çok bir Login; soğuk başta tam bir.
    const logins = iz["smm:Login"] || { sayi: 0, enCokEszamanli: 0 };
    check(logins.enCokEszamanli <= 1 && (!cold || logins.sayi === 1), `e-SMM servisine giriş tek uçuş (N4): ${cold ? "soğuk başta tam 1 Login" : "sıcak başta en çok 1 Login aynı anda"} — Login ${logins.sayi}, en çok eşzamanlı ${logins.enCokEszamanli}`);
    note(`süreler: Kaydet ve Gönder ${JSON.stringify(current.kayit.sureler.kaydetVeGonder)} ms, Kes, Sonra Gönder ${JSON.stringify(current.kayit.sureler.kesSonraGonder)} ms; 30 sn'yi aşan Kaydet ve Gönder ${current.kayit.sureler.otuzSnUstu} (arayüzün kayıt zaman aşımı 30 sn: aşanlarda ekran "sunucuda sürüyor olabilir" derdi)`);
    if (mock && args.zorla) {
      const max = mock.state.smm.maxInflight;
      current.kayit.sahteEdmEnCokEszamanli = { ...max };
      // Ders 20: yeşil yalnız ön koşul GERÇEKTEN oluşunca — sahte EDM'de en az 10 SendSMM aynı anda işlendi; soğuk başta en az 2 Login aynı anda.
      check((max.SendSMM || 0) >= 10, `ön koşul (zorla): sahte EDM'de aynı anda işlenen SendSMM en çok ${max.SendSMM || 0} ≥ 10`);
      // Soğuk başta 20 istek aynı anda oturum ister: ≥ 10 SendSMM aynı anda işlendiyse en az 10 çağıran aynı (tek) girişi paylaştı — N4'ün ön koşulu.
      if (cold) note(`ön koşul (zorla, soğuk): önbellek boşken aynı anda ${max.SendSMM || 0} SendSMM, sahte EDM'de en çok eşzamanlı Login ${max.Login || 0}`);
    }
    finish();
    // Güvence: eşzamanlı istekte giriş REDDEDİLDİYSE (kullanıcı adı/parola, hesap kilidi, hız sınırı) EDM'ye başka istek yapılmaz (hesap kilitlenmesin).
    const loginRefused = esz.istekler.filter(item => item.autoSend?.code === "integrator-login");
    if (loginRefused.length) {
      stopped = `eşzamanlı istekte ${loginRefused.length} belgede EDM girişi reddedildi (${loginRefused.map(item => item.kod).join(", ")}): betik durdu, Tümünü Gönder / Durum Sorgula yapılmadı (hesap kilitlenmesin)`;
      log("DUR", stopped);
      exitCode = 2;
      return;
    }

    // ── yb) İki oturum aynı anda Tümünü Gönder + aynı anda Durum Sorgula
    step("yb-tumunu-gonder", "İki kullanıcı (fatura1, fatura2) AYNI ANDA Tümünü Gönder + yönetici aynı anda A belgelerine Durum Sorgula");
    const izB = izKes(izleme.program);
    const pendingIds = async () => (await api.get("/api/workspace/invoices?tab=pending")).data?.invoices?.map(item => item.id) || [];
    const bDocs = docs.filter(item => item.asama === "B");
    const aDocs = docs.filter(item => item.asama === "A");
    const before = await pendingIds();
    check(bDocs.length === ESZ_B.length && bDocs.every(item => before.includes(item.id)), `Gönderilecekler'de B'nin ${bDocs.length} belgesi (liste ${before.length})`);
    const sendPost = s => body => timed(s.post(SEND_PENDING_URL, body));
    const refreshA = (async () => {
      const out = [];
      for (const item of aDocs) {
        const r = await timed(api.post(`/api/workspace/invoices/${item.id}/e-refresh`, {}));
        out.push({ kod: item.kod, status: r.status, askida: Boolean(r.askida), sureMs: r.sureMs, eStatus: r.data?.eStatus || "", hata: r.status === 200 ? undefined : errOf(r) });
      }
      return out;
    })();
    const [t1, t2, refreshed] = await Promise.all([tumunuGonderDongusu(sendPost(sessions.fatura1)), tumunuGonderDongusu(sendPost(sessions.fatura2)), refreshA]);
    const presses = [];
    for (let again = 0; again < 2; again += 1) {
      const left = (await pendingIds()).filter(id => bDocs.some(item => item.id === id));
      if (!left.length) break;
      presses.push({ kalan: left.length, tur: await tumunuGonderDongusu(sendPost(sessions.fatura1)) });
    }
    await settle();
    current.kayit = { fatura1: t1, fatura2: t2, durumSorgula: refreshed, yenidenBasis: presses };
    const allTurns = [...t1.istekler, ...t2.istekler, ...presses.flatMap(item => item.tur.istekler)];
    check(allTurns.length > 0 && allTurns.every(item => item.status === 200 && !item.askida), `Tümünü Gönder istekleri: ${allTurns.length}, hepsi HTTP 200, askı yok (${allTurns.map(item => (item.askida ? "askıda" : item.status)).join(" ")})`);
    check(refreshed.every(item => item.status === 200 && !item.askida), `gönderim sürerken Durum Sorgula (A, ${refreshed.length} belge): hepsi HTTP 200, askı yok (${[...new Set(refreshed.map(item => (item.askida ? "askıda" : item.status)))].join(" ")})`);
    const after = await pendingIds();
    for (const item of bDocs) {
      const doc = docRow(item.id);
      item.doc = doc;
      check(!after.includes(item.id) && /^TES\d{13}$/.test(doc.number || "") && SENT.includes(doc.eStatus), `${item.kod} (${item.alici.tur}): Tümünü Gönder → ${doc.number || "numara yok"}, e-Belge durumu ${doc.eStatus} (beklenen: iletildi${doc.eStatus === "waiting" || doc.eStatus === "none" ? `; ${String(doc.eMessage || "").slice(0, 160)}` : ""})`);
    }
    const reasonOf = result => (result.done ? "başka oturumda gönderildi" : result.busy ? "gönderiliyor (busy)" : result.skipped ? `atlandı: ${result.reason}` : result.ok ? "gönderdi" : `hata: ${result.code}`);
    const reasons = {};
    for (const [who, turn] of [["fatura1", t1], ["fatura2", t2]]) {
      for (const result of Object.values(turn.sonuclar)) {
        const key = `${who} ${reasonOf(result)}`;
        reasons[key] = (reasons[key] || 0) + 1;
      }
    }
    note(`iki oturumun sonuçları: ${JSON.stringify(reasons)}; yeniden basış ${presses.length} (arayüz iletisi "kalan belge olursa Tümünü Gönder'e yeniden basın")`);
    esz.izleme.yb = izB();
    note(`EDM: ${JSON.stringify(esz.izleme.yb)}`);
    finish();

    // ── yc) Durum Sorgula (son duruma kadar)
    step("yc-durum", `Durum Sorgula: ${docs.length} belge, son duruma kadar`);
    const open = new Set(docs.map(item => item.id));
    const rounds = args.mod === "gercek" ? 30 : 10;
    const wait = args.mod === "gercek" ? 30_000 : 50;
    const states = {};
    for (let round = 1; round <= rounds && open.size; round += 1) {
      for (const item of docs.filter(entry => open.has(entry.id))) {
        const r = await timed(api.post(`/api/workspace/invoices/${item.id}/e-refresh`, {}));
        states[item.kod] = r.status === 200 ? { eStatus: r.data.eStatus, raw: r.data.statusResult?.raw || "", message: String(r.data.statusResult?.message || r.data.eMessage || "").slice(0, 300) } : { eStatus: r.askida ? "askıda" : `HTTP ${r.status}`, ...errOf(r) };
        if (r.status !== 200 || r.data.eStatus !== "processing") open.delete(item.id);
      }
      log(`durum turu ${round}`, `${docs.length - open.size}/${docs.length} son durumda`);
      if (open.size) await sleep(wait);
    }
    for (const item of docs) {
      const state = states[item.kod] || {};
      noteCode(`yc ${item.kod} durum`, { eStatus: state.eStatus, raw: state.raw, error: state.message, integratorCode: state.integratorCode, code: state.code });
      check(["sent", "accepted"].includes(state.eStatus), `${item.kod} ${docRow(item.id).number}: EDM son durum ${state.eStatus || "sorulamadı"} ${state.raw ? `(${state.raw})` : ""}`);
    }
    current.kayit = states;
    finish();

    // ── yd) Resmî görüntü: VKN'li A, TCKN'li A, B
    step("yd-resmi-pdf", "Resmî görüntü (GetSMM PDF): VKN'li bir A, TCKN'li bir A, bir B");
    const pdfDocs = [aDocs.find(item => item.alici.tur === "VKN"), aDocs.find(item => item.alici.tur === "TCKN"), bDocs[0]].filter(Boolean);
    let pdftotext = false;
    try {
      execFileSync("pdftotext", ["-v"], { stdio: "ignore" });
      pdftotext = true;
    } catch {}
    for (const item of pdfDocs) {
      const doc = docRow(item.id);
      const r = await timed(api.raw("GET", `/api/workspace/invoices/${item.id}/resmi.pdf`));
      if (r.status !== 200) {
        noteCode(`yd ${item.kod} resmî görüntü`, { status: r.status, ...(r.data || {}) });
        check(false, `${item.kod} ${doc.number}: resmî görüntü ${r.askida ? "askıda" : r.status} ${r.data?.error || ""}`);
        continue;
      }
      const file = `${doc.number}-resmi.pdf`;
      writeFileSync(path.join(OUT, file), r.buffer);
      let text = "okunamadı (pdftotext yok)";
      if (pdftotext) {
        try {
          text = execFileSync("pdftotext", ["-layout", path.join(OUT, file), "-"], { encoding: "utf8", stdio: ["ignore", "pipe", "ignore"] });
        } catch (error) {
          text = `okunamadı (${String(error.message).split("\n")[0].slice(0, 120)})`;
        }
      }
      const readable = !/^okunamadı/.test(text);
      const minimum = args.mod === "gercek" ? 5000 : 10;
      current.kayit[item.kod] = { tur: r.headers.get("content-type"), bayt: r.buffer.length, ad: r.headers.get("content-disposition"), dosya: file, numaraMetinde: readable ? text.includes(doc.number) : "okunamadı" };
      check(/application\/pdf/.test(r.headers.get("content-type") || "") && r.buffer.subarray(0, 5).toString("latin1") === "%PDF-" && r.buffer.length >= minimum && String(r.headers.get("content-disposition") || "").includes(doc.number), `${item.kod} ${doc.number} (${item.alici.tur}): PDF ${r.buffer.length} bayt ≥ ${minimum}, indirme adı numarayı taşır`);
      if (args.mod === "gercek") check(readable && text.includes(doc.number), `${item.kod} ${doc.number}: PDF metninde belge numarası`);
    }
    finish();

    // ── ye) Bağımsız okuyucu (koşunun SONUNDA; kendi Login'i)
    step("ye-edm-okuyucu", "BAĞIMSIZ OKUYUCU: her ETTN EDM'de (GetSMM, yalnız ETTN ile) aranır; EDM'nin kaydındaki numara = programın numarası; numaralı ama EDM'de olmayan belge yok");
    const izO = izKes(izleme.okuyucu);
    const okuyucu = edmOkuyucu({ url: urls.smm, username, password, fetchImpl: izleyiciFetch(bekciFetch(nativeFetch, { mod: args.mod, kayit: bekci }), izleme.okuyucu) });
    let readerOk = true;
    try {
      await okuyucu.login();
    } catch (error) {
      readerOk = false;
      check(false, `okuyucu girişi: ${String(error.message).slice(0, 200)} — EDM kaydı OKUNAMADI (ders 4: bilinmiyor, boş değil)`);
    }
    const missing = [];
    if (readerOk) {
      for (const item of docs) {
        const doc = docRow(item.id);
        let res;
        try {
          res = await okuyucu.lookup(doc.ettn);
        } catch (error) {
          res = { okundu: false, hata: String(error?.message || error).slice(0, 200), kayitlar: [] };
        }
        item.edm = res;
        esz.edm[item.kod] = res;
        current.kayit[item.kod] = { numara: doc.number, ettn: doc.ettn, edm: res };
        if (res.okundu && !res.kayitlar.length && doc.number) missing.push({ kod: item.kod, number: doc.number, eStatus: doc.eStatus, eMessage: String(doc.eMessage || "").slice(0, 200) });
        check(res.okundu && res.kayitlar.length === 1 && res.kayitlar[0].id === doc.number, `${item.kod} ${doc.number}: EDM'de ${res.okundu ? `${res.kayitlar.length} kayıt` : `OKUNAMADI (${res.hata})`}${res.kayitlar.length ? `, EDM'deki numara ${res.kayitlar.map(entry => entry.id).join(", ")} (${res.kayitlar.map(entry => entry.durum).join(", ")})` : ""}`);
      }
      check(!missing.length, `numaralı ama EDM'de olmayan belge: ${missing.length}${missing.length ? ` — ${missing.map(item => `${item.kod} ${item.number} programda ${item.eStatus}`).join("; ")}` : ""}`, missing.length ? missing : undefined);
      note(`okuyucu GetSMM biçimi: HEADER_ONLY ${okuyucu.headerOnly}`);
    }
    esz.izleme.ye = izO();
    current.kayit.izleme = esz.izleme.ye;
    finish();

    // ── yf) Değişmezler (kuraldan)
    step("yf-degismezler", "Değişmezler: 30 belge, ETTN tekil, TES tekil + ardışık (seride boşluk yok), tarih, tek gönderim, 11048 yok, stopaj kuralı, UBL-TR XSD");
    const rows = store.all("SELECT id, number, seq, series, year, ettn, issue_date AS issueDate, issue_time AS issueTime, status, profile, e_status AS eStatus, net_total AS brut, stoppage_total AS stopaj, vat_total AS kdv, payable_total AS odenecek, party_json AS party FROM invoices WHERE note LIKE ? ORDER BY seq", `Eşzamanlı deneme ${esz.marker} %`);
    const ids = new Set(docs.map(item => item.id));
    check(rows.length === ESZ_A.length + ESZ_B.length && rows.every(item => ids.has(item.id)) && rows.every(item => item.status === "issued" && item.profile === "ESMM"), `veri tabanında işaretli notla TAM ${ESZ_A.length + ESZ_B.length} belge (bulunan ${rows.length}), hepsi yanıtlardaki kimliklerle aynı, kesilmiş e-SMM`);
    const ettns = rows.map(item => String(item.ettn || "").toLowerCase());
    check(new Set(ettns).size === rows.length && ettns.every(value => /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/.test(value)), `ETTN'ler tekil (${new Set(ettns).size}/${rows.length}) ve UUID biçiminde`);
    const seqs = ardisikNumara(rows.filter(item => item.seq > 0).map(item => item.seq));
    const postMax = store.get("SELECT MAX(seq) AS n FROM invoices WHERE series = 'TES' AND year = ? AND seq > 0", year)?.n ?? null;
    const inRange = seqs.en ? store.get("SELECT COUNT(*) AS n FROM invoices WHERE series = 'TES' AND year = ? AND seq BETWEEN ? AND ?", year, seqs.en, seqs.son)?.n : 0;
    current.kayit.numaralar = { ...seqs, oncekiEnBuyuk: preMax, sonrakiEnBuyuk: postMax, araliktakiBelge: inRange, numaralar: rows.map(item => item.number) };
    check(rows.every(item => item.series === "TES" && item.year === year && /^TES\d{13}$/.test(item.number || "")) && seqs.tamam && rows.length === ESZ_A.length + ESZ_B.length && (preMax === null || seqs.en === preMax + 1) && postMax === seqs.son && inRange === rows.length, `TES numaraları tekil ve ardışık: ${rows[0]?.number || "—"} … ${rows.at(-1)?.number || "—"} (tekrar ${seqs.tekrar.length}, boşluk ${seqs.boslukSayisi}; önceki en büyük ${preMax ?? "yok"}, sonra en büyük ${postMax}, aralıkta ${inRange} belge)`);
    const dated = rows.every((item, i) => i === 0 || item.issueDate >= rows[i - 1].issueDate);
    check(rows.every(item => item.issueDate === startDay) && dated, `belge tarihleri koşu günü (${startDay}) ve numara sırasıyla tarih sırası tutarlı`);
    const timeInversions = rows.filter((item, i) => i > 0 && item.issueDate === rows[i - 1].issueDate && String(item.issueTime || "") < String(rows[i - 1].issueTime || "")).length;
    note(`aynı gün içinde saat ↔ numara ters komşu çifti: ${timeInversions} (eşzamanlı kayıtta numara kayıt işleminin sırasıyla verilir, saat formun açıldığı/kaydın başladığı anı taşır; GİB sıra kuralı tarih düzeyindedir — denetim değil)`);
    const events = new Map(store.all(`SELECT entity_id AS id, type FROM audit_events WHERE entity_id IN (${rows.map(() => "?").join(", ") || "''"})`, ...rows.map(item => item.id)).reduce((map, item) => map.set(item.id, [...(map.get(item.id) || []), item.type]), new Map()));
    const sentTwice = rows.filter(item => (events.get(item.id) || []).filter(type => type === "invoice.e.sent").length !== 1);
    check(!sentTwice.length, `her belgede TAM bir gönderim kaydı (invoice.e.sent): uymayan ${sentTwice.length}${sentTwice.length ? ` (${sentTwice.map(item => `${item.number || item.id}: ${(events.get(item.id) || []).filter(type => type === "invoice.e.sent").length}`).join(", ")})` : ""}`);
    const dup = codes.filter(item => /11048/.test(`${item.integratorCode || ""} ${item.error || ""}`));
    check(!dup.length, `EDM "daha önce gönderdiğiniz SMM" (11048) görülmedi (${dup.length})`);
    const badStoppage = rows.filter(item => {
      const taxNo = String(JSON.parse(item.party || "{}").taxNo || "").replace(/\D/g, "");
      const want = taxNo.length === 10 ? Math.round(cents(item.brut) * 0.2) : 0;
      return cents(item.stopaj) !== want;
    });
    check(!badStoppage.length, `stopaj (talimat: VKN'li şirket %20, TCKN'li kişi stopajsız): uymayan ${badStoppage.length}${badStoppage.length ? ` (${badStoppage.map(item => `${item.number} brüt ${item.brut} stopaj ${item.stopaj}`).join("; ")})` : ""}`);
    let xsdErrors = null;
    try {
      ({ xsdErrors } = await import(pathToFileURL(path.join(ROOT, "tools", "ebelge", "dogrula.mjs")).href));
    } catch (error) {
      check(false, `UBL-TR XSD denetleyicisi yüklenemedi (${String(error.message).slice(0, 120)}): şema denetimi OKUNAMADI`);
    }
    if (xsdErrors) {
      for (const tur of ["VKN", "TCKN"]) {
        const item = docs.find(entry => entry.alici.tur === tur && entry.asama === "A") || docs.find(entry => entry.alici.tur === tur);
        if (!item) {
          check(false, `${tur}'li alıcıya belge yok; şema denetlenemedi`);
          continue;
        }
        const doc = docRow(item.id);
        const xml = String((await api.raw("GET", `/api/workspace/invoices/${item.id}/ubl.xml`)).buffer || "");
        writeFileSync(path.join(OUT, `${doc.number}.xml`), mask(xml));
        const problems = await xsdErrors(xml).catch(error => [`denetleyici hatası: ${error.message}`]);
        check(!problems.length, `${item.kod} ${doc.number} (${tur}'li alıcı) UBL'i OASIS UBL 2.1 + GİB UBL-TR 1.2.1 XSD'sine uygun${problems.length ? `: ${problems.slice(0, 3).join(" | ").slice(0, 400)}` : ""}`);
      }
    }
    if (mock) {
      const smm = mock.state.smm;
      const ids2 = smm.sent.map(item => item.id);
      check(!smm.violations.length, `sahte EDM sözleşme ihlali yok (${smm.violations.length}${smm.violations.length ? `: ${smm.violations.slice(0, 3).join(" | ")}` : ""})`);
      check(new Set(ids2).size === ids2.length, `sahte EDM'nin defterinde numaralar tekil (${new Set(ids2).size}/${ids2.length})`);
    }
    esz.izleme.toplam = Object.fromEntries(Object.entries(izleme.program.islemler || {}).map(([key, item]) => [key, { sayi: item.sayi, hata: item.hata }]));
    finish();

    step("h-hata-kodlari", "Görülen ret / hata kodları (PACKAGE-FAIL, SEND-FAILED, EDM hata kodu, 11048)");
    current.kayit = { kodlar: codes, paketHatasi: codes.some(item => /PACKAGE\s*-?\s*FAIL/i.test(item.raw || item.error || "")) ? "görüldü" : "görülmedi" };
    console.log(`  · ${codes.length} kayıt; PACKAGE-FAIL ${current.kayit.paketHatasi}`);
    finish("bilgi");
  };

  // Adımlar: erken çıkış (giriş başarısız) yalnız bu işlevden döner; özet, kapanış ve kimlik bilgisi taraması her durumda aşağıda (finally).
  const run = async () => {
    step("hazirlik", "Kurulum: üretim bayrakları, sabit test adresi, sunucu");
    check(flags.edocEnabled === true && flags.esmmEnabled === true, `üretim girişi (server/server.mjs) e-Belgeyi ve e-SMM'yi açar: ${JSON.stringify(flags)}`);
    check(EDM_URLS.test === TEST_URLS.fatura && EDM_SMM_URLS.test === TEST_URLS.smm, `programın test adresleri betiğin sabitleriyle aynı (${EDM_URLS.test} · ${EDM_SMM_URLS.test})`);
    check(!izinliAdres(EDM_URLS.live, { mod: "gercek" }) && !izinliAdres(EDM_SMM_URLS.live, { mod: "gercek" }), `canlı adresler bekçide reddedilir (${EDM_URLS.live} · ${EDM_SMM_URLS.live})`);
    let baseUrl = "";
    if (args.mod === "kuru") {
      const { startMockEdm } = await import(pathToFileURL(path.join(ROOT, "test", "einvoice-mock.mjs")).href);
      mock = await startMockEdm();
      baseUrl = mock.url;
    }
    app = createApp({ ...flags, dataDir, backupDir: path.join(root, "backups"), logLevel: "warn", scheduleBackups: false, fetchImpl: appFetch, env: { HUKUK_ADMIN_PASSWORD: adminPassword, HUKUK_DATASET_AUTOSYNC: "0", HUKUK_LICENSE_URL: DEAD_LICENSE_URL }, license: { enforce: false, machineId: randomBytes(16).toString("hex") }, startLicenseTimers: false });
    const { port } = await app.listen(0, "127.0.0.1");
    const http = createClient(`http://127.0.0.1:${port}`);
    const api = { get: async u => unwrap(await http.get(u)), post: async (u, b) => unwrap(await http.post(u, b)), put: async (u, b) => unwrap(await http.put(u, b)), raw: http.raw };
    const store = app.store;
    check((await http.login("admin", adminPassword)).status === 200, "yönetici girişi");
    current.kayit = { kip: args.mod, commit, bayraklar: flags, testAdresi: baseUrl ? "sahte EDM (yerel)" : TEST_URLS.fatura, gun: startDay };
    finish();
    const day = off => {
      const [y, m, d] = startDay.split("-").map(Number);
      return localDay(new Date(y, m - 1, d + off, 12));
    };
    const row = id => store.get("SELECT id, kind, status, profile, series, seq, number, ettn, issue_date AS issueDate, e_status AS eStatus, e_message AS eMessage, net_total AS netTotal, stoppage_total AS stoppageTotal, vat_total AS vatTotal, payable_total AS payableTotal, cancelled_at AS cancelledAt FROM invoices WHERE id = ?", id);
    const track = (key, label, id, type) => tracked.push({ key, label, id, type });

    // ── a) Bağlantıyı Test Et
    step("a-baglanti", "Entegratör Ayarları (Test Ortamı) + Bağlantıyı Test Et: e-Fatura ve e-SMM servisleri");
    const saved = await api.put("/api/workspace/invoices/settings", { seller: SELLER, efatura: true, earsiv: true, esmm: true, integrator: { env: "test", baseUrl, username, password, senderAlias: GB, mailboxAlias: PK } });
    check(saved.status === 200 && saved.data.esmm === true && saved.data.esmmAvailable === true, `ayarlar kaydedildi; e-SMM kullanıcısıyım işaretli (${saved.status})`, saved.status === 200 ? { testNumbers: saved.data.testNumbers } : errOf(saved));
    const stored = JSON.parse(store.setting("invoice.settings", "{}"));
    const urls = { fatura: integratorUrl(stored.integrator), smm: integratorSmmUrl(stored.integrator) };
    check(stored.integrator?.env === "test" && izinliAdres(urls.fatura, { mod: args.mod }) && izinliAdres(urls.smm, { mod: args.mod }) && (args.mod === "kuru" || (urls.fatura === TEST_URLS.fatura && urls.smm === TEST_URLS.smm)), `ortam Test, programın gideceği adresler izinli: ${urls.fatura} · ${urls.smm}`);
    if (current.denetimler.some(item => !item.gecti)) {
      stopped = "ayar ya da adres denetimi kaldı; EDM'ye hiç istek yapılmadı";
      finish("durdu");
      exitCode = 4;
      return;
    }
    const conn = await api.post("/api/workspace/invoices/integrator/test", {});
    current.kayit = { yanit: conn.status === 200 ? { ok: conn.data.ok, message: conn.data.message, smmContract: conn.data.smmContract ? { source: conn.data.smmContract.source, namespace: conn.data.smmContract.namespace, operations: conn.data.smmContract.operations?.length, missing: conn.data.smmContract.missing } : null } : errOf(conn), sonTest: JSON.parse(store.setting("invoice.settings", "{}")).integrator?.lastTest || null };
    noteCode("a Bağlantıyı Test Et", errOf(conn));
    if (!check(conn.status === 200 && conn.data.ok === true && /e-SMM/.test(conn.data.message || ""), `Bağlantıyı Test Et: ${conn.status} ${conn.status === 200 ? conn.data.message : conn.data?.error}`)) {
      stopped = `giriş / bağlantı başarısız (${conn.data?.stage === "login" ? "giriş adımında" : "bağlantı"}): betik HEMEN durdu, yeniden denenmedi (hesap kilitlenmesin)`;
      log("DUR", stopped);
      finish("durdu");
      exitCode = 2;
      return;
    }
    finish();

    // ── Cariler
    step("hazirlik-cariler", "Cariler: e-SMM alıcısı şirket (EDM'de e-Fatura mükellefi OLMADIĞI sorgulanmış VKN) + e-Arşiv alıcısı kişi");
    const account = async body => {
      const r = await api.post("/api/workspace/accounts", body);
      check(r.status === 200, `cari ${body.name}: ${r.status}`, r.status === 200 ? undefined : errOf(r));
      return r.data?.id || r.data?.account?.id;
    };
    let firmVkn = "";
    for (let i = 0; i < 10 && !firmVkn; i += 1) {
      const candidate = vkn(400000000 + Math.floor(Math.random() * 500_000_000));
      const q = await api.post("/api/workspace/invoices/check-user", { taxNo: candidate });
      current.kayit[`sorgu-${i + 1}`] = q.status === 200 ? { taxNo: candidate, registered: q.data.registered } : errOf(q);
      if (q.status === 200 && q.data.registered === false) firmVkn = candidate;
    }
    check(Boolean(firmVkn), `e-SMM alıcısı VKN'si EDM'de mükellef değil (Mükellef Sorgula): ${firmVkn || "bulunamadı"}`);
    const firm = await account({ ...FIRM, taxNo: firmVkn || vkn(411222333) });
    const person = await account(PERSON);
    finish();
    if (args.eszamanli) {
      await eszamanliAkis({ api, store, port, account, firm, person, urls });
      return;
    }

    // ── g) Seçilenleri Gönder + Tümünü Gönder (e-SMM + e-Arşiv, kronoloji)
    step("g-toplu-gonderim", "Kes, Sonra Gönder: 3 e-SMM + 2 e-Arşiv (−2 / −1 gün) → Seçilenleri Gönder (ön denetim, eski tarihli seçilmemiş belge) → Tümünü Gönder");
    const plan = [
      ["G1", "e-SMM", firm, -2, 500, "smm"],
      ["G2", "e-SMM", firm, -1, 600, "smm"],
      ["G3", "e-Arşiv", person, -2, 300, "service_sale"],
      ["G4", "e-Arşiv", person, -1, 400, "service_sale"],
      ["G5", "e-SMM", firm, -1, 700, "smm"],
    ];
    const g = {};
    for (const [key, label, accountId, off, price, scenario] of plan) {
      const r = await api.post("/api/workspace/invoices", { scenario, accountId, issueDate: day(off), lines: [{ name: scenario === "smm" ? `Danışmanlık Ücreti (${key})` : `Hizmet Bedeli (${key})`, qty: 1, unitPrice: price, vatRate: 20 }], payment: { rest: "open" }, eSend: "later" });
      const saved2 = r.status === 200 ? row(r.data.id) : null;
      check(r.status === 200 && saved2 && !saved2.number && saved2.eStatus === "waiting" && saved2.profile === (scenario === "smm" ? "ESMM" : "EARSIVFATURA"), `${key} ${label} ${day(off)} ${price} TL: kaydedildi, numarasız Gönderilecekler'de (${saved2?.profile || r.status})`, r.status === 200 ? undefined : errOf(r));
      if (r.status === 200) {
        g[key] = r.data.id;
        track(key, label, r.data.id, label);
      }
    }
    const pending = (await api.get("/api/workspace/invoices?tab=pending")).data?.invoices?.map(item => item.id) || [];
    check(Object.values(g).every(id => pending.includes(id)), `Gönderilecekler'de 5 belge (${pending.length})`);
    if (g.G1 && g.G2) {
      const pre = await api.post("/api/workspace/invoices/send-pending", { only: [g.G2], check: true });
      current.kayit.onDenetim = pre.status === 200 ? { count: pre.data.count, olderIds: pre.data.olderIds, sendable: pre.data.sendable } : errOf(pre);
      check(pre.status === 200 && pre.data.count >= 1 && pre.data.olderIds.includes(g.G1), `Seçilenleri Gönder ön denetimi: G2 seçiliyken daha eski G1 söylenir (sayı ${pre.data?.count})`);
      const refused = await api.post("/api/workspace/invoices/send-pending", { only: [g.G2] });
      current.kayit.eskiBekleyenRet = errOf(refused);
      check(refused.status === 409 && refused.data.code === "einvoice-selection-older" && !row(g.G2).number && row(g.G2).eStatus === "waiting", `yalnız G2 gönderilmek istenince 409 einvoice-selection-older; G2'ye numara verilmedi (${refused.status} ${refused.data?.code})`);
    }
    const turn = async body => {
      const results = [];
      let cursor = null;
      for (let round = 0; round < 20; round += 1) {
        const r = await api.post("/api/workspace/invoices/send-pending", { ...body, ...(cursor ? { after: cursor } : {}) });
        if (r.status !== 200) {
          results.push({ http: errOf(r) });
          noteCode(`g send-pending ${JSON.stringify(body).slice(0, 40)}`, errOf(r));
          break;
        }
        for (const item of r.data.results || []) {
          results.push({ ok: item.ok, code: item.code || "", number: item.number || "", message: String(item.message || "").slice(0, 300) });
          if (!item.ok) noteCode("g toplu gönderim", { code: item.code, error: item.message });
        }
        cursor = r.data.cursor;
        if (r.data.stopped || (!r.data.remaining && !r.data.rerun)) break;
      }
      return results;
    };
    const selected = [g.G1, g.G2, g.G3].filter(Boolean);
    current.kayit.secilenleriGonder = await turn({ only: selected });
    check(selected.every(id => row(id).number && ["sent", "processing", "accepted"].includes(row(id).eStatus)), `Seçilenleri Gönder (G1, G2, G3): üçü numara aldı ve EDM'ye iletildi`, selected.map(id => ({ number: row(id).number, eStatus: row(id).eStatus, eMessage: row(id).eMessage })));
    current.kayit.tumunuGonder = await turn({ all: true });
    const all = Object.entries(g).map(([key, id]) => ({ key, ...row(id) }));
    check(all.every(item => item.number && ["sent", "processing", "accepted"].includes(item.eStatus)), "Tümünü Gönder (G4, G5): bekleyen kalmadı, 5 belgenin hepsi iletildi", all.map(item => ({ key: item.key, number: item.number, eStatus: item.eStatus, eMessage: item.eMessage })));
    for (const series of ["TES", "TEA"]) {
      const list = all.filter(item => item.series === series).sort((x, y) => x.seq - y.seq);
      current.kayit[`seri${series}`] = list.map(item => ({ key: item.key, number: item.number, tarih: item.issueDate }));
      const consecutive = list.every((item, i) => i === 0 || item.seq === list[i - 1].seq + 1);
      const dated = list.every((item, i) => i === 0 || item.issueDate >= list[i - 1].issueDate);
      check(list.length === (series === "TES" ? 3 : 2) && consecutive && dated, `${series}: ${list.length} belge, numaralar ardışık ve tarih sırasıyla (${list.map(item => `${item.key} ${item.issueDate}`).join(", ")})`);
    }
    finish();

    // ── b) e-SMM Kaydet ve Gönder: tek kalem + çok kalem (2 × 100,03)
    step("b-makbuz", "e-SMM Kaydet ve Gönder: tek kalem (1 × 1.000 TL) ve çok kalem (2 × 100,03 TL), KDV %20, stopaj (alıcı şirket)");
    const receipts = [
      ["B1", "tek kalem", [{ name: "Avukatlık Ücreti", qty: 1, unitPrice: 1000, vatRate: 20 }]],
      ["B2", "çok kalem 2 × 100,03", [{ name: "Danışmanlık Ücreti (Ekim)", qty: 1, unitPrice: 100.03, vatRate: 20 }, { name: "Danışmanlık Ücreti (Kasım)", qty: 1, unitPrice: 100.03, vatRate: 20 }]],
    ];
    let expected = null;
    if (args.beklenen) {
      try {
        expected = JSON.parse(readFileSync(path.resolve(args.beklenen), "utf8"));
      } catch (error) {
        check(false, `--beklenen okunamadı (${error.message}); tutarlar karşılaştırılmadı`);
      }
    }
    const b = {};
    for (const [key, title, lines] of receipts) {
      const r = await api.post("/api/workspace/invoices", { scenario: "smm", accountId: firm, lines, payment: { rest: "open" }, eSend: "now" });
      if (r.status !== 200) noteCode(`b ${key} kayıt`, errOf(r));
      const doc = r.status === 200 ? row(r.data.id) : null;
      current.kayit[key] = r.status === 200 ? { number: doc.number, ettn: doc.ettn, profile: doc.profile, eStatus: doc.eStatus, eMessage: doc.eMessage, autoSend: r.data.autoSend, brut: doc.netTotal, stopaj: doc.stoppageTotal, kdv: doc.vatTotal, odenecek: doc.payableTotal } : errOf(r);
      if (r.data?.autoSend && !r.data.autoSend.ok) noteCode(`b ${key} gönderim`, { code: r.data.autoSend.code, error: r.data.autoSend.message });
      if (!check(r.status === 200 && doc.profile === "ESMM" && /^TES\d{13}$/.test(doc.number || "") && r.data.autoSend?.ok === true, `${key} (${title}): ${doc?.number || r.status} EDM'ye iletildi (${doc?.eStatus || errOf(r).error})`)) continue;
      b[key] = r.data.id;
      track(key, "e-SMM", r.data.id, "e-SMM");
      const xml = String((await api.raw("GET", `/api/workspace/invoices/${r.data.id}/ubl.xml`)).buffer || "");
      writeFileSync(path.join(OUT, `${doc.number}.xml`), mask(xml));
      // Stopaj (vergi kodu 0003) tutarları: belge düzeyi (ilk kalemden önceki TaxTotal) ve her kalem.
      const stoppageIn = part => [...part.matchAll(/<cac:TaxSubtotal>([\s\S]*?)<\/cac:TaxSubtotal>/g)].filter(m => /<cbc:TaxTypeCode>0003<\/cbc:TaxTypeCode>/.test(m[1])).map(m => Number((/<cbc:TaxAmount[^>]*>([^<]+)</.exec(m[1]) || [])[1]));
      const head = xml.includes("<cac:InvoiceLine>") ? xml.slice(0, xml.indexOf("<cac:InvoiceLine>")) : xml;
      const docStoppage = stoppageIn(head)[0];
      const lineStoppage = [...xml.matchAll(/<cac:InvoiceLine>[\s\S]*?<\/cac:InvoiceLine>/g)].map(m => stoppageIn(m[0])[0]);
      const ublAmounts = { lineExtension: xmlNum(xml, "LineExtensionAmount"), taxExclusive: xmlNum(xml, "TaxExclusiveAmount"), taxInclusive: xmlNum(xml, "TaxInclusiveAmount"), payable: xmlNum(xml, "PayableAmount"), stopajBelge: docStoppage, stopajSatirlar: lineStoppage };
      current.kayit[key].ubl = ublAmounts;
      const cents = value => Math.round(Number(value) * 100);
      check(new RegExp(`<cbc:ID>${doc.number}</cbc:ID>`).test(xml) && xml.toLowerCase().includes(`<cbc:uuid>${String(doc.ettn).toLowerCase()}</cbc:uuid>`) && /<cbc:ProfileID>ESMM<\/cbc:ProfileID>/.test(xml), `${key} UBL: numara, ETTN ve ProfileID ESMM belgeyle aynı`);
      check(cents(ublAmounts.lineExtension) === cents(doc.netTotal) && cents(docStoppage) === cents(doc.stoppageTotal) && cents(ublAmounts.payable) === cents(doc.payableTotal) && lineStoppage.length === lines.length && lineStoppage.reduce((sum, value) => sum + cents(value), 0) === cents(docStoppage), `${key} UBL tutarları programın tutarlarıyla tutarlı (brüt ${doc.netTotal}, stopaj ${doc.stoppageTotal} = satırlar ${lineStoppage.join(" + ")}, ödenecek ${doc.payableTotal})`);
      if (expected?.[key]) {
        const want = expected[key];
        const got = { brut: doc.netTotal, stopaj: doc.stoppageTotal, kdv: doc.vatTotal, odenecek: doc.payableTotal };
        check(Object.keys(want).every(field => cents(want[field]) === cents(got[field])), `${key} kâhin (--beklenen): ${JSON.stringify(want)} ↔ ${JSON.stringify(got)}`);
      }
    }
    current.kayit.kahin = expected ? "verildi (--beklenen)" : "kâhin verilmedi: tutarlar yalnız kaydedildi (beklenen sayılar kodu görmeyen elden gelir, ders 5)";
    finish();

    // ── c) Durum Sorgula
    step("c-durum", "Durum Sorgula: bütün gönderilen belgeler son duruma kadar");
    const open = new Set(tracked.map(item => item.id));
    const rounds = args.mod === "gercek" ? 30 : 10;
    const wait = args.mod === "gercek" ? 30_000 : 50;
    const states = {};
    for (let round = 1; round <= rounds && open.size; round += 1) {
      for (const item of tracked.filter(entry => open.has(entry.id))) {
        const r = await api.post(`/api/workspace/invoices/${item.id}/e-refresh`, {});
        states[item.key] = r.status === 200 ? { eStatus: r.data.eStatus, raw: r.data.statusResult?.raw || "", message: String(r.data.statusResult?.message || r.data.eMessage || "").slice(0, 300) } : { eStatus: `HTTP ${r.status}`, ...errOf(r) };
        if (r.status !== 200 || r.data.eStatus !== "processing") open.delete(item.id);
      }
      log(`durum turu ${round}`, tracked.map(item => `${item.key}=${states[item.key]?.eStatus}${states[item.key]?.raw ? ` (${states[item.key].raw})` : ""}`).join(" "));
      if (open.size) await sleep(wait);
    }
    for (const item of tracked) {
      const state = states[item.key] || {};
      noteCode(`c ${item.key} durum`, { eStatus: state.eStatus, raw: state.raw, error: state.message, integratorCode: state.integratorCode, code: state.code });
      check(["sent", "accepted"].includes(state.eStatus), `${item.key} ${item.label} ${row(item.id).number}: EDM son durum ${state.eStatus} ${state.raw ? `(${state.raw})` : ""}`);
    }
    current.kayit = states;
    finish();

    // ── d) Resmî görüntü (PDF)
    step("d-resmi-pdf", "Resmî görüntü: e-SMM GetSMM PDF (B1, B2, G1) ve karşılaştırma için e-Arşiv (G3)");
    let pdftotext = false;
    try {
      execFileSync("pdftotext", ["-v"], { stdio: "ignore" });
      pdftotext = true;
    } catch {}
    for (const key of ["B1", "B2", "G1", "G3"]) {
      const id = key.startsWith("B") ? b[key] : g[key];
      if (!id) {
        check(false, `${key}: belge gönderilemediği için resmî görüntü denenmedi`);
        continue;
      }
      const doc = row(id);
      const r = await api.raw("GET", `/api/workspace/invoices/${id}/resmi.pdf`);
      if (r.status !== 200) {
        noteCode(`d ${key} resmî görüntü`, { status: r.status, ...(r.data || {}) });
        check(false, `${key} ${doc.number}: resmî görüntü ${r.status} ${r.data?.error || ""}`);
        continue;
      }
      const file = `${doc.number}-resmi.pdf`;
      writeFileSync(path.join(OUT, file), r.buffer);
      let text = "okunamadı (pdftotext yok)";
      if (pdftotext) {
        try {
          text = execFileSync("pdftotext", ["-layout", path.join(OUT, file), "-"], { encoding: "utf8", stdio: ["ignore", "pipe", "ignore"] });
        } catch (error) {
          text = `okunamadı (${String(error.message).split("\n")[0].slice(0, 120)})`;
        }
      }
      const readable = !/^okunamadı/.test(text);
      const info = { status: r.status, tur: r.headers.get("content-type"), bayt: r.buffer.length, ad: r.headers.get("content-disposition"), dosya: file, metin: readable ? { numara: text.includes(doc.number), ettn: text.toLowerCase().includes(String(doc.ettn).toLowerCase()), tutarlar: [...new Set(text.match(/\d{1,3}(?:\.\d{3})*,\d{2}/g) || [])].slice(0, 40) } : text };
      current.kayit[key] = info;
      const minimum = args.mod === "gercek" ? 5000 : 10;
      check(/application\/pdf/.test(info.tur || "") && r.buffer.subarray(0, 5).toString("latin1") === "%PDF-" && r.buffer.length >= minimum && String(info.ad || "").includes(doc.number), `${key} ${doc.number}: PDF (${info.bayt} bayt ≥ ${minimum}), indirme adı numarayı taşır`);
      if (args.mod === "gercek") check(readable && info.metin.numara, `${key} ${doc.number}: PDF metninde belge numarası (ETTN ${readable && info.metin.ettn ? "var" : "yok/okunamadı"})`);
      if (args.mod === "gercek") {
        // Resmî görüntüde taraf adresleri birer kez (22.10.2026: e-SMM'de StreetName + BuildingName birlikte verilince EDM adresi iki kez bastı).
        const flat = readable ? text.replace(/\s+/g, " ") : "";
        const count = needle => flat.split(needle).length - 1;
        const buyer = doc.profile === "ESMM" ? FIRM : PERSON;
        check(readable && count(SELLER.address) === 1 && count(buyer.address) === 1, `${key} ${doc.number}: resmî PDF'te satıcı ve alıcı adresi birer kez (satıcı ${count(SELLER.address)}, alıcı ${count(buyer.address)})`);
        // Düzenleyenin unvanı resmî görüntüde. e-SMM'de VKN'li düzenleyende BİLGİ (unvanDenetimi: EDM yanıtı 22.10.2026 — test ortamının e-SMM şablonu
        // VKN'li düzenleyende unvanı basmaz; kural PartyName, canlıda GİB standardı); öbür belgelerde denetim.
        const title = `${key} ${doc.number}: resmî PDF'te düzenleyenin unvanı (${SELLER.name}) ${count(SELLER.name) >= 1 ? "var" : readable ? "YOK" : "okunamadı"}`;
        if (unvanDenetimi({ profile: doc.profile, taxNo: SELLER.taxNo }) === "bilgi") note(`${title} — e-SMM, VKN'li düzenleyen: EDM test ortamı şablonu unvanı basmaz (EDM yanıtı 22.10.2026); denetim değil`);
        else check(readable && count(SELLER.name) >= 1, title);
      }
    }
    finish();

    // ── e) İptal (8 gün içinde)
    step("e-iptal", "İptal (8 gün içinde): B1 önce EDM'de (CancelSMM) sonra programda; ardından EDM durumu");
    if (b.B1) {
      const card = (await api.get(`/api/workspace/invoices/${b.B1}`)).data;
      current.kayit.oncesi = { eStatus: card.eStatus, cancelWindow: card.cancelWindow || null, canCancel: card.canCancel };
      check(card.cancelWindow ? card.cancelWindow.late === false : true, `iptal süresi dolmadı (son gün ${card.cancelWindow?.lastDay || "—"})`);
      const r = await api.post(`/api/workspace/invoices/${b.B1}/cancel`, { reason: "EDM test ortamı iptal denemesi (2.4.4 madde 24)" });
      if (r.status !== 200) noteCode("e iptal", errOf(r));
      const after = row(b.B1);
      const audit = store.all("SELECT type, created_at AS at FROM audit_events WHERE entity_id = ? ORDER BY created_at", b.B1).map(item => item.type);
      current.kayit.iptal = r.status === 200 ? { status: r.data.status, eStatus: r.data.eStatus, eMessage: r.data.eMessage } : errOf(r);
      current.kayit.vt = { status: after.status, eStatus: after.eStatus, cancelledAt: after.cancelledAt, olaylar: audit };
      check(r.status === 200 && after.status === "cancelled" && after.eStatus === "cancelled" && audit.includes("invoice.e.cancelled"), `B1 ${after.number}: EDM'de ve programda iptal (${r.status} ${r.data?.code || ""}; vt ${after.status}/${after.eStatus})`);
      if (r.status === 200) {
        const st = await api.post(`/api/workspace/invoices/${b.B1}/e-refresh`, {});
        current.kayit.sonra = st.status === 200 ? { eStatus: st.data.eStatus, raw: st.data.statusResult?.raw || "", message: st.data.statusResult?.message || "" } : errOf(st);
        check(st.status === 200 && st.data.eStatus === "cancelled", `iptal sonrası EDM durumu: ${current.kayit.sonra.eStatus || st.status} ${current.kayit.sonra.raw || ""}`);
      }
    } else check(false, "B1 gönderilemediği için iptal denenmedi");
    finish();

    // ── f) "Bulunamadı" kodu
    step("f-bulunamadi", "EDM'de OLMAYAN makbuz: durum / iptal / görüntü — EDM'nin 'bulunamadı' kodu (madde 22 MISSING_CODES); e-Arşiv karşılığı");
    const smmDirect = createEdmSmmClient({ baseUrl: urls.smm, username, password, env: "test", fetchImpl: appFetch });
    const faturaDirect = createEdmClient({ baseUrl: urls.fatura, username, password, env: "test", fetchImpl: appFetch });
    const probe = async (label, fn) => {
      try {
        const result = await fn();
        current.kayit[label] = { sonuc: "HATA DÖNMEDİ", yanit: result && typeof result === "object" ? { ...result, data: undefined } : result };
        return null;
      } catch (error) {
        const info = { code: error.code || "", integratorCode: error.integratorCode || "", stage: error.stage || "", status: error.status || "", message: String(error.message || "").slice(0, 400), detail: String(error.detail || "").slice(0, 300) };
        current.kayit[label] = info;
        codes.push({ yer: `f ${label}`, ...info });
        return info;
      }
    };
    const missingUuid = randomUUID();
    const year = startDay.slice(0, 4);
    const smmStatus = await probe("e-SMM GetSMMStatus", () => smmDirect.status({ uuid: missingUuid, number: `TES${year}000000000` }));
    await probe("e-SMM CancelSMM", () => smmDirect.cancel({ uuid: randomUUID(), number: `TES${year}000000000` }));
    await probe("e-SMM GetSMM (PDF)", () => smmDirect.officialPdf({ uuid: randomUUID(), number: `TES${year}000000000` }));
    await probe("e-Arşiv GetInvoiceStatus (karşılaştırma)", () => faturaDirect.status({ uuid: randomUUID(), number: `TEA${year}000000000`, earchive: true }));
    check(Boolean(smmStatus?.integratorCode), `e-SMM 'bulunamadı' kodu okundu: ${smmStatus?.integratorCode || "yok"} — ${smmStatus?.message || ""}`);
    finish();

    // ── h) Ret / hata kodları
    step("h-hata-kodlari", "Görülen ret / hata kodları (PACKAGE-FAIL, SEND-FAILED, EDM hata kodu)");
    current.kayit = { kodlar: codes, paketHatasi: codes.some(item => /PACKAGE\s*-?\s*FAIL/i.test(item.raw || item.error || "")) ? "görüldü" : "görülmedi" };
    console.log(`  · ${codes.length} kayıt; PACKAGE-FAIL ${current.kayit.paketHatasi}`);
    finish("bilgi");
  };
  try {
    await run();
  } catch (error) {
    console.log(`HATA: ${String(error?.stack || error).slice(0, 1500)}`);
    if (current) {
      current.denetimler.push({ gecti: false, denetim: `adım yarıda kaldı: ${String(error?.message || error).slice(0, 300)}` });
      finish("yarıda kaldı");
    }
    exitCode = exitCode || 4;
  } finally {
    // ── Özet (OZET.md + ozet.json) — EDM'ye gönderilen her belge
    const store = app?.store;
    const rows = store
      ? tracked.map(item => {
          const doc = store.get("SELECT number, ettn, issue_date AS issueDate, issue_time AS issueTime, status, e_status AS eStatus, e_message AS eMessage, net_total AS brut, stoppage_total AS stopaj, vat_total AS kdv, payable_total AS odenecek, party_json AS party, cancelled_at AS cancelledAt FROM invoices WHERE id = ?", item.id) || {};
          const cancelAt = store.get("SELECT MIN(created_at) AS at FROM audit_events WHERE entity_id = ? AND type = 'invoice.e.cancelled'", item.id)?.at || "";
          let party = {};
          try {
            party = JSON.parse(doc.party || "{}");
          } catch {}
          return { kod: item.key, tur: item.type, no: doc.number || "", ettn: doc.ettn || "", tarih: doc.issueDate || "", gonderim: trTime(store.get("SELECT MIN(created_at) AS at FROM audit_events WHERE entity_id = ? AND type = 'invoice.e.sent'", item.id)?.at || ""), alici: party.name || "", brut: doc.brut, stopaj: item.type === "e-SMM" ? doc.stopaj : null, kdv: doc.kdv, odenecek: doc.odenecek, edmDurum: E_LABEL[doc.eStatus] || doc.eStatus || "", ileti: String(doc.eMessage || "").slice(0, 160), iptal: trTime(cancelAt), ...(args.eszamanli ? { saat: String(doc.issueTime || "").slice(0, 8), asama: item.asama === "A" ? "A Kaydet ve Gönder" : "B Kes, Sonra Gönder → Tümünü Gönder", oturum: item.oturum, aliciTuru: item.aliciTuru, edmNo: esz.edm[item.key] ? (esz.edm[item.key].okundu ? esz.edm[item.key].kayitlar.map(entry => entry.id).join(", ") || "EDM'de YOK" : "okunamadı") : "sorulmadı" } : {}) };
        })
      : [];
    const endedAt = new Date();
    const dayChanged = localDay(endedAt) !== startDay;
    if (dayChanged) exitCode = 4;
    const notes = steps.flatMap(item => (item.bilgiler || []).map(entry => `${item.adim}: ${entry.bilgi}`));
    const failed = steps.reduce((sum, item) => sum + item.denetimler.filter(entry => !entry.gecti).length, 0);
    const total = steps.reduce((sum, item) => sum + item.denetimler.length, 0);
    if (!exitCode && failed) exitCode = 1;
    const summary = { kip: args.mod, ...(args.eszamanli ? { eszamanli: { isaret: esz.marker, sicak: args.sicak, zorla: args.zorla, ariza: args.ariza || "yok", izleme: esz.izleme } } : {}), commit, baslangic: trTime(startedAt.toISOString()), bitis: trTime(endedAt.toISOString()), gunDegisti: dayChanged, durduruldu: stopped, denetim: { toplam: total, kalan: failed }, bilgi: notes, adimlar: steps.map(item => ({ adim: item.adim, durum: item.durum, kalan: item.denetimler.filter(entry => !entry.gecti).length })), belgeler: rows, bekci, cikis: exitCode };
    const iz = esz.izleme.ya || {};
    const table = args.eszamanli
      ? [
          `Eşzamanlılık: ${ESZ_A.length} Kaydet ve Gönder + ${ESZ_B.length} Kes, Sonra Gönder AYNI ANDA, 3 kullanıcı oturumundan (yönetici, fatura1, fatura2); B'yi fatura1 ve fatura2 AYNI ANDA Tümünü Gönder ile gönderdi. ${args.sicak ? "Sıcak başlangıç." : "Soğuk başlangıç (programın EDM oturum önbelleği boştu)."} e-SMM servisine Login ${iz["smm:Login"]?.sayi ?? "—"} (en çok eşzamanlı ${iz["smm:Login"]?.enCokEszamanli ?? "—"}), SendSMM en çok eşzamanlı ${iz["smm:SendSMM"]?.enCokEszamanli ?? "—"}.${args.mod === "kuru" ? ` Sahte EDM: zorla ${args.zorla ? "evet" : "hayır"}, arıza ${args.ariza || "yok"}.` : ""}`,
          "",
          `Belgeler İPTAL EDİLMEDİ. Portalda Not alanında "Eşzamanlı deneme ${esz.marker} <kod>" yazar. Alıcılar test alıcısıdır (VKN'li iki şirket, TCKN'li kişi 10000000146), gerçek kişi değildir.`,
          "",
          "| Kod | Aşama | Oturum | Belge No | ETTN / UUID | Belge Tarihi | Saat | Alıcı Türü | Alıcı | Brüt | Stopaj | KDV | Net Ödenecek | EDM Son Durum | EDM'deki No (Bağımsız Okuyucu) |",
          "|---|---|---|---|---|---|---|---|---|---:|---:|---:|---:|---|---|",
          ...rows.map(item => `| ${item.kod} | ${item.asama} | ${item.oturum} | ${item.no || "—"} | ${item.ettn || "—"} | ${item.tarih ? item.tarih.split("-").reverse().join(".") : "—"} | ${item.saat || "—"} | ${item.aliciTuru} | ${item.alici} | ${money(item.brut)} | ${money(item.stopaj)} | ${money(item.kdv)} | ${money(item.odenecek)} | ${item.edmDurum} | ${item.edmNo} |`),
        ]
      : [
          "| Kod | Belge Türü | Belge No | ETTN / UUID | Belge Tarihi | Gönderim (TR) | Alıcı | Brüt | Stopaj | KDV | Net Ödenecek | EDM Son Durum | İptal (TR) |",
          "|---|---|---|---|---|---|---|---:|---:|---:|---:|---|---|",
          ...rows.map(item => `| ${item.kod} | ${item.tur} | ${item.no || "—"} | ${item.ettn || "—"} | ${item.tarih ? item.tarih.split("-").reverse().join(".") : "—"} | ${item.gonderim || "—"} | ${item.alici} | ${money(item.brut)} | ${item.stopaj === null ? "—" : money(item.stopaj)} | ${money(item.kdv)} | ${money(item.odenecek)} | ${item.edmDurum} | ${item.iptal || "—"} |`),
        ];
    const lines = [
      args.eszamanli ? `# EDM Test Ortamı — eşzamanlı e-SMM (2.4.4 iş listesi 24b)${args.mod === "kuru" ? " — KURU KOŞU" : ""}` : `# EDM Test Ortamı — e-SMM uçtan uca (2.4.4 iş listesi 24)${args.mod === "kuru" ? " — KURU KOŞU" : ""}`,
      "",
      `**Test portalı:** ${TEST_URLS.portal} (Entegratör Ayarları'ndaki test kullanıcı adı ve parolasıyla) → ${PORTAL_NOTE}.`,
      args.mod === "kuru" ? "**KURU KOŞU:** sahte EDM (yerel, ağa çıkmadı) — aşağıdaki numaralar EDM'de YOKTUR; yalnız özetin biçimini gösterir." : "**Kip:** gerçek EDM test ortamı (yasal geçerliliği olmayan test belgeleri).",
      "",
      `Commit ${commit} · başlangıç ${summary.baslangic} · bitiş ${summary.bitis} (TR) · denetim ${total - failed}/${total} geçti · çıkış ${exitCode}${dayChanged ? " · GEÇERSİZ: koşu gece yarısını geçti (ders 22)" : ""}${stopped ? ` · DURDU: ${stopped}` : ""}`,
      "",
      `Adımlar: ${summary.adimlar.map(item => `${item.adim} ${item.durum}${item.kalan ? ` (${item.kalan} kalan)` : ""}`).join(" · ")}`,
      "",
      ...(notes.length ? ["Bilgi (denetim değil):", ...notes.map(item => `- ${item}`), ""] : []),
      ...table,
      "",
      "Brüt: e-SMM'de brüt ücret, e-Arşiv'de KDV hariç tutar. Net Ödenecek: e-SMM'de brüt − stopaj + KDV (tahsil edilecek), e-Arşiv'de KDV dahil toplam.",
      `Bekçi: izin verilen dış istek ${bekci.izinli.length}, reddedilen ${bekci.reddedilen.length}${bekci.reddedilen.length ? ` (${[...new Set(bekci.reddedilen)].join(", ")})` : ""}. Kimlik bilgisi bu dosyalarda yoktur.`,
      "",
    ];
    try {
      write("ozet.json", summary);
      writeFileSync(path.join(OUT, "OZET.md"), mask(lines.join("\n")));
      write("bekci.json", bekci);
      if (mock) write("kuru-edm-kaydi.json", { fatura: mock.state.calls.map(call => call.op), smm: mock.state.smm.calls.map(call => call.op), smmGonderilen: mock.state.smm.sent.map(item => item.id), smmIptal: mock.state.smm.cancelled.length, smmEnCokEszamanli: mock.state.smm.maxInflight, smmEszamanliGirisReddi: mock.state.smm.concurrentLoginRejected, ihlaller: [...mock.state.violations, ...mock.state.smm.violations] });
      console.log(`\n${lines.join("\n")}`);
    } catch (error) {
      console.log(`özet yazılamadı: ${error.message}`);
      exitCode = exitCode || 4;
    }
    await app?.close().catch(() => null);
    await mock?.close().catch(() => null);
    globalThis.fetch = nativeFetch;
    // Geçici veri klasörü (mühürlü parola dahil) silinir; silinemezse (Windows dosyayı bir an tutabilir) uyarı — temizlik hatası sonucu ezmez (ders 21).
    try {
      rmSync(root, { recursive: true, force: true, maxRetries: 10, retryDelay: 200 });
    } catch (error) {
      console.log(`UYARI: geçici veri klasörü silinemedi (${error.code || error.message}); elle silin: ${root}`);
    }
    // Kimlik bilgisi taraması: çıktı klasöründeki her dosyanın baytlarında kullanıcı adı ve parola aranır.
    const leaks = [];
    for (const file of walkFiles(OUT)) {
      const bytes = readFileSync(file);
      for (const [label, secret] of [["parola", password], ["kullanıcı adı", username], ["yönetici parolası", adminPassword], ...Object.entries(userPasswords).map(([name, value]) => [`${name} parolası`, value])]) if (secret.length >= 3 && bytes.includes(Buffer.from(secret, "utf8"))) leaks.push(`${path.relative(OUT, file)} (${label})`);
    }
    if (leaks.length) {
      console.log(`KİMLİK BİLGİSİ BULUNDU — dosyaları depoya almayın: ${leaks.join(", ")}`);
      exitCode = 3;
    } else console.log(`kimlik bilgisi taraması: ${walkFiles(OUT).length} dosya, eşleşme 0`);
    // Son satır (tools/kanit.mjs kos özeti okur): denetim sayıları; kimlik bilgisi bulunduysa ya da koşu geçersizse ayrıca bir "kaldı".
    console.log(`SONUÇ: ${total - failed} geçti, ${failed + (leaks.length || dayChanged || stopped ? 1 : 0)} kaldı (çıkış ${exitCode})`);
    restoreStreams();
  }
  return exitCode;
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  main().then(
    code => process.exit(code),
    error => {
      console.error(error);
      process.exit(4);
    },
  );
}
