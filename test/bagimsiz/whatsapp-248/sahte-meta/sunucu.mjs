// SAHTE META GRAPH SUNUCUSU — DestekOfis 2.4.8 K0 (bağımsız kâhin). Bağımlılıksız (node:http), yalnız 127.0.0.1.
//
// BAĞIMSIZLIK: programın kodu (server/, client/, bulut/) GÖRÜLMEDEN, yalnız Meta'nın resmî belgelerinden (30.10.2026 okunan .md
// sayfaları: messages/send-messages, messages/document-messages, business-phone-numbers/media, templates/template-media,
// templates/components, templates/template-management, templates/template-categorization, templates/template-quality,
// support/error-codes, webhooks/overview, webhooks/override, webhooks/reference/messages/status, messaging-limits, throughput,
// access-tokens, business-phone-numbers/registration, embedded-signup/onboarding-customers-as-a-tech-provider, embedded-signup/implementation)
// yazıldı. Belgede OLMAYAN her davranış "D0" diye işaretlidir (README → "D0 varsayımları"); program o davranışa yaslanmadan önce D0'da
// gerçek Meta'yla doğrulanır. GERÇEK META'YA HİÇBİR İSTEK GİTMEZ.
//
// KULLANIM (test içinden):
//   const meta = await sahteMetaBaslat();            // { url, durum, kur, kural, saat, kancaGonder, kayit, kapat, ... }
//   config.whatsappGraphUrl = meta.url;              // program sahte sunucuya gider
//   meta.kural({ yol: "messages", to: "+905321112233", deneme: 1, yanit: { hata: 131000 } });
//   const kayit = meta.kayit();                      // istekler, mesajlar, medyalar, kancalar, sayılar
// Ayrı süreçten: `node sunucu.mjs --port 0` → ilk satır JSON {url}; denetim uçları /__sahte/* (README).

import http from "node:http";
import crypto from "node:crypto";
import { pathToFileURL } from "node:url";
import { HATALAR, hataGovdesi, httpDurumu } from "./hatalar.mjs";
import { durumGovdesi, fiyatNesnesi, hataNesnesi, kancaGonder, kancaDogrulat, KancaKuyrugu } from "./kanca.mjs";

export const VARSAYILAN_SURUM = "v26.0"; // belgelerdeki güncel sürüm
const SANIYE = 1000;
const DAKIKA = 60 * SANIYE;
const SAAT = 60 * DAKIKA;
const GUN = 24 * SAAT;
const MB = 1024 * 1024;

// Belge: TIER_250 (messaging-limits örneği) ve TIER_UNLIMITED (throughput webhook). TIER_2K / TIER_10K / TIER_100K adları D0.
export const BASAMAKLAR = Object.freeze({ TIER_250: 250, TIER_2K: 2000, TIER_10K: 10000, TIER_100K: 100000, TIER_UNLIMITED: Infinity });

// Belge (media → Supported media types): tür → en büyük boyut.
export const DESTEKLENEN_MEDYA = new Map([
  ["audio/aac", 16 * MB], ["audio/amr", 16 * MB], ["audio/mpeg", 16 * MB], ["audio/mp4", 16 * MB], ["audio/ogg", 16 * MB],
  ["text/plain", 100 * MB], ["application/vnd.ms-excel", 100 * MB],
  ["application/vnd.openxmlformats-officedocument.spreadsheetml.sheet", 100 * MB], ["application/msword", 100 * MB],
  ["application/vnd.openxmlformats-officedocument.wordprocessingml.document", 100 * MB], ["application/vnd.ms-powerpoint", 100 * MB],
  ["application/vnd.openxmlformats-officedocument.presentationml.presentation", 100 * MB], ["application/pdf", 100 * MB],
  ["image/jpeg", 5 * MB], ["image/png", 5 * MB], ["image/webp", 500 * 1024], ["video/3gpp", 16 * MB], ["video/mp4", 16 * MB],
]);

// D0: supported-languages sayfası yerelde yok; plan "tr" der. Liste senaryoyla değiştirilebilir.
const DILLER_D0 = ["tr", "en", "en_US", "en_GB", "de", "fr", "es", "ar", "az", "ru"];
const SABLON_DURUMLARI = ["APPROVED", "PENDING", "REJECTED", "PAUSED", "DISABLED", "PENDING_DELETION", "IN_APPEAL", "ARCHIVED"];
const KATEGORILER = ["MARKETING", "UTILITY", "AUTHENTICATION"];
const IZIN_MESAJ = "whatsapp_business_messaging";
const IZIN_YONETIM = "whatsapp_business_management";

export function rakamlar(s) { return String(s ?? "").replace(/\D+/g, ""); }

/** Belge (send-messages → "WhatsApp user phone number formats"): `+` yoksa İŞLETME numarasının ülke kodu başa eklenir. */
export function teslimNumarasi(to, isletmeUlkeKodu) {
  const ham = String(to ?? "").trim();
  if (ham.startsWith("+")) return rakamlar(ham);
  return String(isletmeUlkeKodu) + rakamlar(ham);
}

/** Şablon gövdesindeki değişkenler: konumsal {{1}} ya da adlı {{ad}}. */
export function degiskenleri(metin) { return [...String(metin ?? "").matchAll(/\{\{\s*([A-Za-z0-9_]+)\s*\}\}/g)].map(m => m[1]); }

function yeniKimlik(on = "") { return on + String(crypto.randomInt(1e8, 9e8)) + String(crypto.randomInt(1e7, 9e7)); }
function yeniWamid() { return "wamid." + crypto.randomBytes(24).toString("base64").replace(/=+$/, ""); }

function multipartAyristir(buf, icerikTuru) {
  const m = /boundary=(?:"([^"]+)"|([^;\s]+))/i.exec(icerikTuru || "");
  if (!m) return null;
  const sinir = Buffer.from("--" + (m[1] || m[2]));
  const parcalar = [];
  let i = buf.indexOf(sinir);
  while (i !== -1) {
    let bas = i + sinir.length;
    if (buf.subarray(bas, bas + 2).toString() === "--") break;
    if (buf.subarray(bas, bas + 2).toString() === "\r\n") bas += 2;
    const basSon = buf.indexOf("\r\n\r\n", bas);
    if (basSon === -1) break;
    const basliklar = buf.subarray(bas, basSon).toString("utf8");
    const sonraki = buf.indexOf(sinir, basSon + 4);
    if (sonraki === -1) break;
    let son = sonraki;
    if (buf[son - 2] === 13 && buf[son - 1] === 10) son -= 2;
    const ad = /name="([^"]*)"/i.exec(basliklar)?.[1];
    const yildizli = /filename\*=UTF-8''([^;\r\n]+)/i.exec(basliklar)?.[1];
    const duz = /filename="([^"]*)"/i.exec(basliklar)?.[1];
    const tur = /content-type:\s*([^\r\n;]+)/i.exec(basliklar)?.[1]?.trim() ?? null;
    parcalar.push({ ad, dosyaAdi: yildizli ? decodeURIComponent(yildizli) : (duz ?? null), tur, icerik: buf.subarray(basSon + 4, son) });
    i = sonraki;
  }
  return parcalar;
}

function govdeyiAyristir(ham, icerikTuru) {
  const tur = String(icerikTuru || "").toLowerCase();
  if (!ham.length) return {};
  if (tur.includes("application/json")) { try { return JSON.parse(ham.toString("utf8")); } catch { return { __bozukJson: true }; } }
  if (tur.includes("application/x-www-form-urlencoded")) {
    const o = {};
    for (const [k, v] of new URLSearchParams(ham.toString("utf8"))) { try { o[k] = JSON.parse(v); } catch { o[k] = v; } }
    return o;
  }
  return null; // multipart vb. — işleyici kendisi okur
}

function bekle(ms) { return new Promise(r => setTimeout(r, ms)); }

export function varsayilanSenaryo() {
  return {
    uygulama: { id: "900000000000001", sir: "SAHTE-UYGULAMA-SIRRI", ad: "Sahte Mesaj", kancaAdresi: null, imzala: false },
    belirtecler: {
      "SAHTE-BELIRTEC-1": { durum: "gecerli", izinler: ["business_management", IZIN_YONETIM, IZIN_MESAJ], wabalar: ["*"] },
    },
    wabalar: {
      "800000000000001": { ad: "Sahte Messaging Hesabı", odemeYontemi: true, kisitli: null, pazarlamaKapali: false, abonelik: null },
    },
    numaralar: {
      "700000000000001": {
        waba: "800000000000001", gorunen: "+90 212 555 00 00", ulkeKodu: "90", verified_name: "Sahte Firma", kayitli: true, bakim: false,
        basamak: "TIER_250", kalite: "GREEN", throughput: "STANDARD", pin: null, birlikteKullanim: false, kanca: null,
      },
    },
    sablonlar: [], // { waba, name, language, category, status, components, quality? }
    alicilar: {},  // { "905321112233": { whatsapp: false, bicim: "kanca"|"senkron" } }
    hizmetPenceresi: [], // CSW açık alıcılar (yalnız şablonsuz ileti için)
    sinir: { etkin: false, kod: 131048, bicim: "senkron", disKullanim: [] }, // D0: sınır aşım kodu/biçimi belgede yok
    hiz: { mps: 80, ciftPencereMs: null, ciftEnFazla: null }, // belge: 80 mps; 131056 eşiği belgede yok (D0, kapalı)
    otoKanca: null, // { durumlar: ["sent","delivered"], fiyatHangisinde: "delivered" }
    fiyatHangisinde: "delivered", // D0: pricing sent'te mi delivered/read'de mi
    yeniSablonDurumu: "PENDING",
    kategoriKarari: {}, // { "<şablon adı>": "MARKETING" } — Meta'nın içerikten kategori kararı (belge: UTILITY → MARKETING onayı)
    diller: DILLER_D0,
    kaldirilmisSurumler: [],
    degiskenKurali: { satirSonu: true, sekme: true, enFazlaArdisikBosluk: 4, enFazlaUzunluk: null }, // D0
    medyaOmruMs: 30 * GUN, // belge: API medya kimliği 30 gün
    esKoduOmruMs: 30 * SANIYE, // belge: Embedded Signup kodu 30 sn
  };
}

export class SahteMeta {
  constructor(senaryo = {}) {
    this.taban = "";
    this.sahteSaat = null;
    this.sifirla(senaryo);
  }

  simdi() { return this.sahteSaat ?? Date.now(); }

  sifirla(senaryo = {}) {
    const v = varsayilanSenaryo();
    this.ayar = { ...v, ...senaryo, uygulama: { ...v.uygulama, ...(senaryo.uygulama || {}) }, sinir: { ...v.sinir, ...(senaryo.sinir || {}) },
      hiz: { ...v.hiz, ...(senaryo.hiz || {}) }, degiskenKurali: { ...v.degiskenKurali, ...(senaryo.degiskenKurali || {}) } };
    this.belirtecler = new Map(Object.entries(senaryo.belirtecler || v.belirtecler).map(([k, b]) => [k, { durum: "gecerli", izinler: [], wabalar: ["*"], ...b }]));
    this.wabalar = new Map(Object.entries(senaryo.wabalar || v.wabalar).map(([id, w]) => [id, { id, ...v.wabalar["800000000000001"], abonelik: null, ...w }]));
    this.numaralar = new Map(Object.entries(senaryo.numaralar || v.numaralar).map(([id, n]) => [id, { id, ...v.numaralar["700000000000001"], kayitDenemeleri: [], ...n }]));
    this.sablonlar = [];
    for (const s of this.ayar.sablonlar || []) this.sablonEkle(s);
    this.alicilar = new Map(Object.entries(this.ayar.alicilar || {}).map(([k, a]) => [rakamlar(k), a]));
    this.hizmetPenceresi = new Set((this.ayar.hizmetPenceresi || []).map(rakamlar));
    this.medyalar = new Map();
    this.mesajlar = [];
    this.istekler = [];
    this.kancalar = [];
    this.sizintilar = [];
    this.gecersizMedyaDenemeleri = [];
    this.kurallar = [];
    this.denemeSayaci = new Map();
    this.hizPenceresi = new Map();
    this.yuklemeOturumlari = new Map();
    this.tutamaklar = new Set();
    this.esKodlari = new Map();
    this.engelliAdlar = []; // { waba, name, sonT } — silinen onaylı şablon adı 30 gün (belge)
    this.kuyruk = new KancaKuyrugu();
    for (const k of senaryo.kurallar || []) this.kural(k);
  }

  sablonEkle(s) {
    const kayit = {
      id: s.id || yeniKimlik(), waba: s.waba || [...this.wabalar.keys()][0], name: s.name, language: s.language || "tr",
      category: s.category || "UTILITY", status: s.status || "APPROVED", components: s.components || [{ type: "BODY", text: s.body || "Merhaba {{1}}", example: { body_text: [["Ali"]] } }],
      parameter_format: s.parameter_format || "POSITIONAL", quality_score: { score: s.quality || "UNKNOWN", date: Math.floor(this.simdi() / 1000) },
      silindi: false, olusturmaT: this.simdi(), duzenlemeler: [], rejected_reason: s.rejected_reason,
    };
    this.sablonlar.push(kayit);
    return kayit;
  }

  /** Senaryo kuralı: { yol, to?, sablon?, deneme?, kez?(1; "hep"), yanit:{ hata, http, details } | { koptu:"once"|"sonra" } | { gecikmeMs } | { http:5xx, govde?, islendi? } | { bozuk:true } | { sinir:true } } */
  kural(k) { const r = { kez: 1, ...k, kullanilan: 0, kimlik: this.kurallar.length + 1 }; this.kurallar.push(r); return r.kimlik; }

  hata(kod, secenek = {}) { return { http: secenek.http ?? httpDurumu(kod), govde: hataGovdesi(kod, secenek) }; }

  // ---- yetki --------------------------------------------------------------------------------------------------------------
  belirtecBul(req, sorgu) {
    const a = String(req.headers.authorization || "");
    const m = /^(?:Bearer|OAuth)\s+(.+)$/i.exec(a);
    if (m) return { belirtec: m[1].trim(), yer: "baslik" };
    if (sorgu.get("access_token")) return { belirtec: sorgu.get("access_token"), yer: "sorgu" };
    return { belirtec: null, yer: null };
  }

  yetkiDenetle(req, sorgu, { izin, waba } = {}) {
    const { belirtec } = this.belirtecBul(req, sorgu);
    if (!belirtec) return req.method === "GET" ? this.hata(200, { details: "Provide valid app ID" }) : this.hata(190, { details: "SAHTE-META D0: belirteç yok" });
    const b = this.belirtecler.get(belirtec);
    if (!b) return this.hata(190, { details: "SAHTE-META D0: geçersiz belirteç" });
    if (b.durum === "suresi_dolmus") return this.hata(190);
    if (b.durum === "iptal") return this.hata(0);
    if (izin && !b.izinler.includes(izin)) return izin === IZIN_YONETIM ? this.hata(200) : this.hata(10);
    if (waba && !b.wabalar.includes("*") && !b.wabalar.includes(waba)) return this.hata(200); // belge: varlık erişimi yok → code 200
    return null;
  }

  // ---- yönlendirme --------------------------------------------------------------------------------------------------------
  async isle(req, res) {
    const t = this.simdi();
    const u = new URL(req.url, "http://127.0.0.1");
    const parcalar = u.pathname.split("/").filter(Boolean).map(p => decodeURIComponent(p));
    let surum = null;
    if (parcalar[0] && /^v\d+\.\d+$/.test(parcalar[0])) surum = parcalar.shift();
    const ham = await new Promise((resolve, reject) => {
      const p = []; let boyut = 0;
      req.on("data", c => { boyut += c.length; if (boyut <= 120 * MB) p.push(c); });
      req.on("end", () => resolve(Buffer.concat(p)));
      req.on("error", reject);
    });
    if (parcalar[0] === "__sahte") return this.denetim(req, res, parcalar.slice(1), u.searchParams, ham);

    const govde = govdeyiAyristir(ham, req.headers["content-type"]);
    const kayit = {
      sira: this.istekler.length + 1, t, yontem: req.method, yol: u.pathname, surum, sorgu: Object.fromEntries(u.searchParams),
      belirtecYeri: this.belirtecBul(req, u.searchParams).yer, icerikTuru: req.headers["content-type"] || null,
      govde: (govde && !govde.__bozukJson) ? govde : (ham.length ? { __ham: ham.length + " bayt" } : null),
      hedef: null, islem: null, http: null, yanit: null, sonuc: null, kural: null,
    };
    this.istekler.push(kayit);
    this.sizintiDenetle(req, u, ham, kayit);

    const yanitla = (http_, g, ek = {}) => {
      const metin = typeof g === "string" || Buffer.isBuffer(g) ? g : JSON.stringify(g);
      kayit.http = http_; kayit.yanit = typeof g === "string" || Buffer.isBuffer(g) ? String(g).slice(0, 200) : g; kayit.sonuc = kayit.sonuc ?? "yanit";
      res.writeHead(http_, { "content-type": ek.tur || "application/json; charset=utf-8", ...(ek.basliklar || {}) });
      res.end(metin);
    };
    const kopar = neden => { kayit.sonuc = neden; kayit.http = null; res.socket?.destroy(); };

    let yonlendirme;
    try { yonlendirme = this.yonlendir(req, parcalar, u.searchParams, govde, ham); } catch (e) { return yanitla(500, { error: { message: "SAHTE-META iç hata: " + e.message } }); }
    kayit.islem = yonlendirme.islem;
    kayit.hedef = yonlendirme.hedef ?? null;
    if (surum && this.ayar.kaldirilmisSurumler.includes(surum)) {
      const r = this.hata(100, { details: `SAHTE-META D0: ${surum} kaldırıldı` });
      return yanitla(r.http, r.govde);
    }

    // senaryo kuralı
    const anahtar = `${yonlendirme.islem}|${yonlendirme.hedef ?? ""}`;
    const deneme = (this.denemeSayaci.get(anahtar) || 0) + 1;
    this.denemeSayaci.set(anahtar, deneme);
    kayit.deneme = deneme;
    const kural = this.kurallar.find(k => (k.kez === "hep" || k.kullanilan < k.kez)
      && (k.yol === "*" || k.yol === yonlendirme.islem)
      && (k.to === undefined || rakamlar(k.to) === yonlendirme.hedef)
      && (k.sablon === undefined || k.sablon === yonlendirme.sablon)
      && (k.deneme === undefined || k.deneme === deneme));
    const y = kural?.yanit || {};
    if (kural) { kural.kullanilan += 1; kayit.kural = kural.kimlik; }
    if (y.koptu === "once") return kopar("koptu-once");
    if (y.gecikmeMs) await bekle(y.gecikmeMs);
    if (y.hata !== undefined) { const r = this.hata(y.hata, { http: y.http, details: y.details }); kayit.sonuc = "kural-hata"; return yanitla(r.http, r.govde); }
    if (y.sinir) { const r = this.hata(this.ayar.sinir.kod, { details: "SAHTE-META D0: gönderim sınırı (senaryo)" }); kayit.sonuc = "kural-sinir"; return yanitla(r.http, r.govde); }
    if (y.http && y.islendi === false) return yanitla(y.http, y.govde ?? "");

    let sonuc;
    try { sonuc = await yonlendirme.calistir(); } catch (e) { sonuc = { http: 500, govde: { error: { message: "SAHTE-META iç hata: " + e.message } } }; }
    if (y.koptu === "sonra") return kopar("koptu-sonra"); // istek İŞLENDİ (ileti kabul edildiyse kayıtta), yanıt gitmedi
    if (y.http) return yanitla(y.http, y.govde ?? "");      // gövdesiz 5xx (işlendi)
    if (y.bozuk) return yanitla(200, "<html>SAHTE-META bozuk yanıt</html>", { tur: "text/html" });
    return yanitla(sonuc.http, sonuc.govde, sonuc.ek);
  }

  sizintiDenetle(req, u, ham, kayit) {
    const metin = u.pathname + u.search + "\n" + ham.toString("utf8");
    for (const b of this.belirtecler.keys()) {
      if (b.length >= 8 && metin.includes(b)) this.sizintilar.push({ sira: kayit.sira, yer: u.search.includes(b) ? "sorgu" : (u.pathname.includes(b) ? "yol" : "govde"), yol: u.pathname });
    }
  }

  yonlendir(req, p, sorgu, govde, ham) {
    const M = req.method;
    const bulunamadi = () => ({ islem: "bilinmeyen", calistir: async () => this.hata(100, { details: "Unsupported request (SAHTE-META)" }) });
    if (p[0] === "oauth" && p[1] === "access_token" && M === "GET") return { islem: "oauth", calistir: async () => this.kodDegistir(sorgu) };
    if (p.length === 1 && p[0].startsWith("upload:")) return { islem: "surdurulebilir", calistir: async () => this.surdurulebilirParca(req, sorgu, p[0], ham) };
    const [kimlik, kenar] = p;
    if (!kimlik) return bulunamadi();
    const numara = this.numaralar.get(kimlik);
    const waba = this.wabalar.get(kimlik);
    const medya = this.medyalar.get(kimlik);
    const sablon = this.sablonlar.find(s => s.id === kimlik && !s.silindi);
    if (kenar === "messages" && M === "POST") {
      const hedef = govde && govde.to !== undefined ? teslimNumarasi(govde.to, numara?.ulkeKodu ?? "") : null;
      return { islem: "messages", hedef, sablon: govde?.template?.name, calistir: async () => numara ? this.mesajGonder(req, sorgu, numara, govde) : this.hata(100, { details: "Unsupported post request. Object does not exist (SAHTE-META D0)" }) };
    }
    if (kenar === "media" && M === "POST") return { islem: "media", calistir: async () => numara ? this.medyaYukle(req, sorgu, numara, ham) : this.hata(100) };
    if (kenar === "register" && M === "POST") return { islem: "register", calistir: async () => numara ? this.kaydet(req, sorgu, numara, govde) : this.hata(100) };
    if (kenar === "deregister" && M === "POST") return { islem: "deregister", calistir: async () => numara ? this.kayitSil(req, sorgu, numara) : this.hata(100) };
    if (kenar === "message_templates") {
      if (!waba) return { islem: "templates", calistir: async () => this.hata(100) };
      if (M === "GET") return { islem: "templates_get", calistir: async () => this.sablonListele(req, sorgu, waba) };
      if (M === "POST") return { islem: "templates_post", sablon: govde?.name, calistir: async () => this.sablonOlustur(req, sorgu, waba, govde) };
      if (M === "DELETE") return { islem: "templates_delete", sablon: sorgu.get("name") ?? undefined, calistir: async () => this.sablonSil(req, sorgu, waba) };
    }
    if (kenar === "subscribed_apps" && waba) return { islem: "subscribed_apps", calistir: async () => this.abonelik(req, sorgu, waba, govde) };
    if (kenar === "phone_numbers" && waba && M === "GET") return { islem: "phone_numbers", calistir: async () => this.numaraListesi(req, sorgu, waba) };
    if (kenar === "uploads" && M === "POST") return { islem: "surdurulebilir_baslat", calistir: async () => this.surdurulebilirBaslat(req, sorgu, kimlik) };
    if (kenar) return bulunamadi();
    if (numara && M === "GET") return { islem: "phone_get", calistir: async () => this.numaraOku(req, sorgu, numara) };
    if (numara && M === "POST") return { islem: "phone_post", calistir: async () => this.numaraAyarla(req, sorgu, numara, govde) };
    if (waba && M === "GET") return { islem: "waba_get", calistir: async () => this.wabaOku(req, sorgu, waba) };
    if (medya || (M !== "POST" && /^\d+$/.test(kimlik) && !sablon)) {
      if (M === "GET") return { islem: "media_get", calistir: async () => this.medyaOku(req, sorgu, kimlik) };
      if (M === "DELETE") return { islem: "media_delete", calistir: async () => this.medyaSil(req, sorgu, kimlik) };
    }
    if (sablon && M === "GET") return { islem: "template_get", calistir: async () => this.sablonOku(req, sorgu, sablon) };
    if (sablon && M === "POST") return { islem: "template_edit", sablon: sablon.name, calistir: async () => this.sablonDuzenle(req, sorgu, sablon, govde) };
    return bulunamadi();
  }

  // ---- ileti --------------------------------------------------------------------------------------------------------------
  async mesajGonder(req, sorgu, numara, govde) {
    const y = this.yetkiDenetle(req, sorgu, { izin: IZIN_MESAJ, waba: numara.waba }); if (y) return y;
    const waba = this.wabalar.get(numara.waba);
    if (!numara.kayitli) return this.hata(133010);
    if (numara.bakim) return this.hata(131057);
    if (waba.kisitli) return this.hata(waba.kisitli);
    if (!waba.odemeYontemi) return this.hata(131042); // D0: eşzamanlı mı kancada mı
    if (govde === null || govde.__bozukJson) return this.hata(100, { details: "SAHTE-META D0: JSON gövde bekleniyor" });
    if (govde.messaging_product !== "whatsapp") return this.hata(100, { details: "messaging_product must be 'whatsapp'" });
    if (govde.to === undefined || govde.to === "") return this.hata(131008, { details: "to is required" });
    if (!govde.type) return this.hata(131008, { details: "SAHTE-META D0: type is required" });
    const hedef = teslimNumarasi(govde.to, numara.ulkeKodu);
    if (hedef.length < 7) return this.hata(131009, { details: "SAHTE-META D0: alıcı numarası geçersiz" });
    if (hedef === rakamlar(numara.gorunen)) return this.hata(131021);

    // hız: numara başına mps (gerçek zaman, 1 sn pencere; ölçüm biçimi D0)
    const an = performance.now();
    const pencere = (this.hizPenceresi.get(numara.id) || []).filter(x => an - x < 1000);
    if (pencere.length >= this.ayar.hiz.mps) { this.hizPenceresi.set(numara.id, pencere); return this.hata(130429); }
    if (this.ayar.hiz.ciftPencereMs) {
      const son = this.mesajlar.filter(m => m.teslimNumarasi === hedef && this.simdi() - m.kabulT < this.ayar.hiz.ciftPencereMs).length;
      if (son >= this.ayar.hiz.ciftEnFazla) return this.hata(131056);
    }

    let sablon = null; let medyaId = null; let medyaLink = null; let dosyaAdi = null; const degiskenler = [];
    if (govde.type === "template") {
      const tpl = govde.template;
      if (!tpl?.name || !tpl?.language?.code) return this.hata(131008, { details: "template.name ve template.language.code gerekli" });
      sablon = this.sablonlar.find(s => s.waba === numara.waba && s.name === tpl.name && s.language === tpl.language.code && !s.silindi);
      if (!sablon) return this.hata(132001);
      if (sablon.status === "PAUSED") return this.hata(132015);
      if (sablon.status === "DISABLED") return this.hata(132016);
      if (sablon.status !== "APPROVED") return this.hata(132001);
      if (sablon.category === "MARKETING" && waba.pazarlamaKapali) return this.hata(131063);
      const bilesenler = Array.isArray(tpl.components) ? tpl.components : [];
      const tur = c => String(c?.type || "").toLowerCase();
      const govdeBileseni = sablon.components.find(c => tur(c) === "body");
      const basBileseni = sablon.components.find(c => tur(c) === "header");
      const beklenenGovde = degiskenleri(govdeBileseni?.text).length;
      const govdeParam = bilesenler.filter(c => tur(c) === "body").flatMap(c => c.parameters || []);
      if (govdeParam.length !== beklenenGovde) return this.hata(132000);
      const basParam = bilesenler.filter(c => tur(c) === "header").flatMap(c => c.parameters || []);
      const medyaBasligi = basBileseni && ["DOCUMENT", "IMAGE", "VIDEO", "GIF"].includes(String(basBileseni.format || "").toUpperCase());
      if (medyaBasligi) {
        const beklenenTur = String(basBileseni.format).toLowerCase() === "gif" ? "video" : String(basBileseni.format).toLowerCase();
        const p = basParam[0];
        if (basParam.length !== 1 || p.type !== beklenenTur || !p[beklenenTur]) return this.hata(132000, { details: "SAHTE-META D0: medya başlığı parametresi eksik/yanlış" });
        const nesne = p[beklenenTur];
        if (nesne.id) {
          const m = this.medyalar.get(String(nesne.id));
          if (!m || m.silindi || this.simdi() - m.yuklenmeT > this.ayar.medyaOmruMs) {
            this.gecersizMedyaDenemeleri.push({ t: this.simdi(), medyaId: String(nesne.id), hedef, neden: !m ? "yok" : m.silindi ? "silinmis" : "suresi-dolmus" });
            return this.hata(131053, { details: `SAHTE-META D0: medya kimliği ${!m ? "yok" : m.silindi ? "silinmiş" : "süresi dolmuş"} (${nesne.id})` });
          }
          medyaId = m.id;
        } else if (nesne.link) medyaLink = nesne.link;
        else return this.hata(131008, { details: "document.id ya da document.link gerekli" });
        dosyaAdi = nesne.filename ?? null;
      } else if (basParam.length) {
        degiskenler.push(...basParam.map(x => x.text ?? null));
      }
      const kural = this.ayar.degiskenKurali;
      for (const p of govdeParam) {
        if (p.type !== "text") { degiskenler.push(p); continue; }
        const v = String(p.text ?? "");
        // D0: değişken metninde satır sonu / sekme / 4'ten çok ardışık boşluk yasağı ve uzunluk sınırı yerel belgede yok. Kod 132018
        // template-management'ta "v23.0'dan beri gönderimdeki parametre sorunları 132018" cümlesinden.
        if ((kural.satirSonu && /[\r\n]/.test(v)) || (kural.sekme && /\t/.test(v)) || (kural.enFazlaArdisikBosluk && new RegExp(` {${kural.enFazlaArdisikBosluk + 1},}`).test(v))
          || (kural.enFazlaUzunluk && [...v].length > kural.enFazlaUzunluk) || v === "") {
          return this.hata(132018, { details: "SAHTE-META D0: değişken biçimi (satır sonu/sekme/boşluk/uzunluk/boş)" });
        }
        degiskenler.push(v);
      }
    } else if (!this.hizmetPenceresi.has(hedef)) {
      return this.hata(131047); // şablonsuz ileti yalnız müşteri hizmeti penceresinde
    }

    // gönderim sınırı (portföy, kayan 24 sa, FARKLI alıcı). Meta "teslim edilen" sayar; sahte sunucu KABUL sayar (D0).
    let sinirAsildi = false;
    if (this.ayar.sinir.etkin) {
      const t = this.simdi();
      const kume = new Set([
        ...this.mesajlar.filter(m => !m.sinirDisi && t - m.kabulT < GUN).map(m => m.teslimNumarasi),
        ...(this.ayar.sinir.disKullanim || []).filter(d => t - (d.t ?? t) < GUN).map(d => rakamlar(d.alici)),
      ]);
      const L = BASAMAKLAR[numara.basamak] ?? 250;
      if (!kume.has(hedef) && kume.size >= L) {
        if (this.ayar.sinir.bicim === "senkron") return this.hata(this.ayar.sinir.kod, { details: "SAHTE-META D0: gönderim sınırı aşıldı" });
        sinirAsildi = true;
      }
    }

    const alici = this.alicilar.get(hedef);
    if (alici && alici.whatsapp === false && alici.bicim === "senkron") return this.hata(131026); // D0: kimi teslim hataları eşzamanlı da dönebilir
    const wamid = yeniWamid();
    const mesaj = {
      wamid, numaraKimligi: numara.id, waba: numara.waba, to: govde.to, teslimNumarasi: hedef, kabulT: this.simdi(), tur: govde.type,
      sablon: sablon?.name ?? null, dil: sablon?.language ?? null, kategori: sablon?.category ?? null, degiskenler, medyaId, medyaLink, dosyaAdi,
      opaque: govde.biz_opaque_callback_data ?? null, govde, sinirDisi: sinirAsildi, durumlar: [], fiyatVerildi: false,
    };
    this.mesajlar.push(mesaj);
    pencere.push(an); this.hizPenceresi.set(numara.id, pencere);
    if (sinirAsildi || (alici && alici.whatsapp === false) || this.ayar.otoKanca) {
      setImmediate(() => this.otoKancalar(mesaj, { sinirAsildi, aliciYok: alici && alici.whatsapp === false }).catch(() => {}));
    }
    return { http: 200, govde: { messaging_product: "whatsapp", contacts: [{ input: String(govde.to), wa_id: hedef }], messages: [{ id: wamid }] } };
  }

  async otoKancalar(mesaj, { sinirAsildi, aliciYok }) {
    if (sinirAsildi) return this.durumGonder({ wamid: mesaj.wamid, durum: "failed", hataKodu: this.ayar.sinir.kod });
    if (aliciYok) return this.durumGonder({ wamid: mesaj.wamid, durum: "failed", hataKodu: 131026 });
    for (const d of this.ayar.otoKanca?.durumlar || []) {
      if (this.ayar.otoKanca.gecikmeMs) await bekle(this.ayar.otoKanca.gecikmeMs);
      await this.durumGonder({ wamid: mesaj.wamid, durum: d });
    }
  }

  // ---- medya --------------------------------------------------------------------------------------------------------------
  async medyaYukle(req, sorgu, numara, ham) {
    const y = this.yetkiDenetle(req, sorgu, { izin: IZIN_MESAJ, waba: numara.waba }); if (y) return y;
    const parcalar = multipartAyristir(ham, req.headers["content-type"]);
    if (!parcalar) return this.hata(100, { details: "SAHTE-META D0: multipart/form-data bekleniyor" });
    const alan = ad => parcalar.find(p => p.ad === ad);
    const mp = alan("messaging_product")?.icerik.toString("utf8").trim();
    if (mp !== "whatsapp") return this.hata(100, { details: "messaging_product must be 'whatsapp'" });
    const dosya = alan("file");
    if (!dosya || !dosya.icerik.length) return this.hata(131008, { details: "file is required" });
    const tur = alan("type")?.icerik.toString("utf8").trim() || null;
    if (!tur) return this.hata(131008, { details: "type is required" });
    const enCok = DESTEKLENEN_MEDYA.get(tur);
    if (!enCok) return this.hata(131053, { details: `Unsupported media type ${tur}` });
    if (dosya.tur && dosya.tur.toLowerCase() !== tur.toLowerCase()) return this.hata(131053, { details: `SAHTE-META D0: dosya türü ${dosya.tur} ≠ type ${tur}` });
    if (dosya.icerik.length > enCok) return this.hata(131053, { details: "SAHTE-META D0: boyut sınırı" });
    if (tur === "application/pdf" && !dosya.icerik.subarray(0, 5).equals(Buffer.from("%PDF-"))) return this.hata(131053, { details: "SAHTE-META: içerik PDF değil (MIME uyuşmazlığı)" });
    const id = yeniKimlik();
    this.medyalar.set(id, {
      id, numaraKimligi: numara.id, tur, dosyaAdi: dosya.dosyaAdi, boyut: dosya.icerik.length, sha256: crypto.createHash("sha256").update(dosya.icerik).digest("hex"),
      icerik: Buffer.from(dosya.icerik), yuklenmeT: this.simdi(), silindi: false, silinmeT: null,
    });
    return { http: 200, govde: { id } };
  }

  medyaKaydi(kimlik, sorgu) {
    const m = this.medyalar.get(kimlik);
    if (!m || m.silindi || this.simdi() - m.yuklenmeT > this.ayar.medyaOmruMs) return { hata: this.hata(100, { details: "SAHTE-META D0: medya yok/silinmiş/süresi dolmuş" }) };
    if (sorgu.get("phone_number_id") && sorgu.get("phone_number_id") !== m.numaraKimligi) return { hata: this.hata(100, { details: "SAHTE-META D0: phone_number_id uyuşmuyor" }) };
    return { m };
  }

  async medyaOku(req, sorgu, kimlik) {
    const y = this.yetkiDenetle(req, sorgu, { izin: IZIN_MESAJ }); if (y) return y;
    const { m, hata } = this.medyaKaydi(kimlik, sorgu); if (hata) return hata;
    return { http: 200, govde: { messaging_product: "whatsapp", url: `${this.taban}/__sahte/medya/${m.id}/indir`, mime_type: m.tur, sha256: m.sha256, file_size: String(m.boyut), id: m.id } };
  }

  async medyaSil(req, sorgu, kimlik) {
    const y = this.yetkiDenetle(req, sorgu, { izin: IZIN_MESAJ }); if (y) return y;
    const { m, hata } = this.medyaKaydi(kimlik, sorgu); if (hata) return hata;
    m.silindi = true; m.silinmeT = this.simdi();
    return { http: 200, govde: { success: true } };
  }

  // ---- Resumable Upload (TAMAMI D0: yerel belge yalnız "Resumable Upload API ile yükle, header_handle '4::aW…'" der) --------------
  async surdurulebilirBaslat(req, sorgu, uygulamaKimligi) {
    const y = this.yetkiDenetle(req, sorgu, {}); if (y) return y;
    if (uygulamaKimligi !== this.ayar.uygulama.id) return this.hata(100, { details: "SAHTE-META D0: uygulama kimliği (App ID) yanlış" });
    const uzunluk = Number(sorgu.get("file_length"));
    const tur = sorgu.get("file_type");
    if (!uzunluk || !tur) return this.hata(100, { details: "SAHTE-META D0: file_length ve file_type gerekli" });
    const oturum = "upload:" + crypto.randomBytes(12).toString("hex");
    this.yuklemeOturumlari.set(oturum, { uzunluk, tur, ad: sorgu.get("file_name"), parcalar: [], offset: 0, tutamak: null });
    return { http: 200, govde: { id: oturum } };
  }

  async surdurulebilirParca(req, sorgu, oturumKimligi, ham) {
    const y = this.yetkiDenetle(req, sorgu, {}); if (y) return y;
    const o = this.yuklemeOturumlari.get(oturumKimligi);
    if (!o) return this.hata(100, { details: "SAHTE-META D0: yükleme oturumu yok" });
    if (req.method === "GET") return { http: 200, govde: { id: oturumKimligi, file_offset: o.offset } };
    const offset = Number(req.headers.file_offset ?? 0);
    if (offset !== o.offset) return this.hata(100, { details: `SAHTE-META D0: file_offset ${offset} ≠ ${o.offset}` });
    o.parcalar.push(Buffer.from(ham)); o.offset += ham.length;
    if (o.offset < o.uzunluk) return { http: 200, govde: { id: oturumKimligi, file_offset: o.offset } };
    if (o.tur === "application/pdf" && !Buffer.concat(o.parcalar).subarray(0, 5).equals(Buffer.from("%PDF-"))) return this.hata(131053, { details: "SAHTE-META: örnek dosya PDF değil" });
    o.tutamak = "4::" + crypto.randomBytes(18).toString("base64");
    this.tutamaklar.add(o.tutamak);
    return { http: 200, govde: { h: o.tutamak } };
  }

  // ---- şablonlar ----------------------------------------------------------------------------------------------------------
  async sablonOlustur(req, sorgu, waba, govde) {
    const y = this.yetkiDenetle(req, sorgu, { izin: IZIN_YONETIM, waba: waba.id }); if (y) return y;
    if (!govde || govde.__bozukJson) return this.hata(100);
    const { name, language, category, components } = govde;
    if (typeof name !== "string" || !/^[a-z0-9_]+$/.test(name) || name.length > 512) return this.hata(100, { details: "Template name must match ^[a-z0-9_]+$ (≤ 512)" });
    if (!KATEGORILER.includes(category)) return this.hata(100, { details: "Invalid category" });
    if (!this.ayar.diller.includes(language)) return this.hata(100, { details: "Unsupported language" });
    if (this.sablonlar.some(s => s.waba === waba.id && s.name === name && s.language === language && !s.silindi)) {
      return this.hata(100, { subcode: 2388024, details: "Content in This Language Already Exists", mesaj: "(#100) Content in This Language Already Exists" });
    }
    if (this.engelliAdlar.some(e => e.waba === waba.id && e.name === name && this.simdi() < e.sonT)) return this.hata(100, { details: "SAHTE-META D0: silinen onaylı şablonun adı 30 gün kullanılamaz" });
    if (this.sablonlar.filter(s => s.waba === waba.id && !s.silindi).length >= 250) return this.hata(2388019);
    if (!Array.isArray(components)) return this.hata(100, { details: "components required" });
    const tur = c => String(c?.type || "").toUpperCase();
    const body = components.find(c => tur(c) === "BODY");
    if (!body || typeof body.text !== "string") return this.hata(100, { details: "SAHTE-META D0: BODY bileşeni gerekli" });
    for (const c of components) {
      const t = tur(c);
      if (t === "HEADER") {
        const bicim = String(c.format || "").toUpperCase();
        if (bicim === "TEXT" && [...String(c.text || "")].length > 60) return this.hata(2388040, { details: "Header text > 60" });
        if (["DOCUMENT", "IMAGE", "VIDEO", "GIF"].includes(bicim)) {
          const tutamak = c.example?.header_handle?.[0];
          if (!tutamak) return this.hata(100, { details: "SAHTE-META D0: medya başlığında example.header_handle gerekli" });
          if (!this.tutamaklar.has(tutamak)) return this.hata(100, { details: "SAHTE-META D0: header_handle Resumable Upload'tan değil" });
        }
      } else if (t === "BODY") {
        if ([...c.text].length > 1024) return this.hata(2388040, { details: "Body text > 1024" });
        const d = degiskenleri(c.text);
        if (d.length) {
          const ornek = c.example?.body_text?.[0] ?? c.example?.body_text_named_params;
          if (!Array.isArray(ornek) || ornek.length !== d.length) return this.hata(100, { details: "SAHTE-META D0: değişken örnekleri (example) eksik" });
          const kirpik = c.text.trim();
          // D0: "Variables cannot be at the start or end" — sondaki noktalama sonrası değişken sayılmaz varsayımı (README: plan şablonu "{{4}}." biter)
          if (/^\{\{\s*[A-Za-z0-9_]+\s*\}\}/.test(kirpik) || /\{\{\s*[A-Za-z0-9_]+\s*\}\}$/.test(kirpik)) return this.hata(2388299);
        }
      } else if (t === "FOOTER") {
        if ([...String(c.text || "")].length > 60) return this.hata(2388040, { details: "Footer text > 60" });
      }
    }
    const karar = this.ayar.kategoriKarari?.[name] ?? category;
    const kayit = this.sablonEkle({ waba: waba.id, name, language, category: karar, status: this.ayar.yeniSablonDurumu, components,
      parameter_format: body.example?.body_text_named_params ? "NAMED" : "POSITIONAL" });
    kayit.istenenKategori = category;
    return { http: 200, govde: { id: kayit.id, status: kayit.status, category: kayit.category } }; // D0: oluşturma yanıtının biçimi
  }

  sablonNesnesi(s, alanlar) {
    const tam = { name: s.name, parameter_format: s.parameter_format, components: s.components, language: s.language, status: s.status, category: s.category, id: s.id,
      quality_score: s.quality_score, rejected_reason: s.rejected_reason };
    if (!alanlar) { const { quality_score, rejected_reason, ...v } = tam; return v; }
    const o = {};
    for (const a of alanlar) if (a in tam && tam[a] !== undefined) o[a] = tam[a];
    o.id = s.id;
    return o;
  }

  async sablonListele(req, sorgu, waba) {
    const y = this.yetkiDenetle(req, sorgu, { izin: IZIN_YONETIM, waba: waba.id }); if (y) return y;
    const alanlar = sorgu.get("fields") ? sorgu.get("fields").split(",").map(s => s.trim()).filter(Boolean) : null;
    let liste = this.sablonlar.filter(s => s.waba === waba.id && !s.silindi);
    if (sorgu.get("status")) liste = liste.filter(s => s.status === sorgu.get("status").toUpperCase());
    if (sorgu.get("name")) liste = liste.filter(s => s.name === sorgu.get("name")); // D0
    const limit = Number(sorgu.get("limit") || 25); // D0 varsayılan
    const bas = sorgu.get("after") ? Number(Buffer.from(sorgu.get("after"), "base64").toString()) : 0;
    const dilim = liste.slice(bas, bas + limit);
    const paging = { cursors: { before: Buffer.from(String(bas)).toString("base64"), after: Buffer.from(String(bas + dilim.length)).toString("base64") } };
    if (bas + limit < liste.length) paging.next = `${this.taban}/${VARSAYILAN_SURUM}/${waba.id}/message_templates?after=${paging.cursors.after}&limit=${limit}`;
    return { http: 200, govde: { data: dilim.map(s => this.sablonNesnesi(s, alanlar)), paging } };
  }

  async sablonOku(req, sorgu, s) {
    const y = this.yetkiDenetle(req, sorgu, { izin: IZIN_YONETIM, waba: s.waba }); if (y) return y;
    const alanlar = sorgu.get("fields") ? sorgu.get("fields").split(",").map(x => x.trim()) : null;
    return { http: 200, govde: this.sablonNesnesi(s, alanlar) };
  }

  async sablonDuzenle(req, sorgu, s, govde) {
    const y = this.yetkiDenetle(req, sorgu, { izin: IZIN_YONETIM, waba: s.waba }); if (y) return y;
    if (!["APPROVED", "REJECTED", "PAUSED"].includes(s.status)) return this.hata(2388039);
    if (govde.category && s.status === "APPROVED" && govde.category !== s.category) return this.hata(100, { details: "SAHTE-META D0: onaylı şablonun kategorisi düzenlenemez" });
    if (s.status === "APPROVED") {
      const t = this.simdi();
      if (s.duzenlemeler.filter(x => t - x < GUN).length >= 1 || s.duzenlemeler.filter(x => t - x < 30 * GUN).length >= 10) return this.hata(100, { details: "SAHTE-META D0: düzenleme sınırı (24 saatte 1, 30 günde 10)" });
      s.duzenlemeler.push(t);
    }
    if (govde.components) s.components = govde.components;
    if (govde.category) s.category = govde.category;
    if (s.status === "REJECTED") s.status = "PENDING"; // D0
    return { http: 200, govde: { success: true } };
  }

  async sablonSil(req, sorgu, waba) {
    const y = this.yetkiDenetle(req, sorgu, { izin: IZIN_YONETIM, waba: waba.id }); if (y) return y;
    const ad = sorgu.get("name"); const tek = sorgu.get("hsm_id"); const coklu = sorgu.get("hsm_ids");
    if (coklu && (ad || tek)) return this.hata(100, { details: "hsm_ids cannot be combined with name or hsm_id" });
    let hedefler;
    if (coklu) {
      let kimlikler; try { kimlikler = JSON.parse(coklu).map(String); } catch { return this.hata(100); }
      if (kimlikler.length > 100) return this.hata(100);
      hedefler = kimlikler.map(k => this.sablonlar.find(s => s.waba === waba.id && s.id === k && !s.silindi));
      if (hedefler.some(h => !h)) return this.hata(100, { details: "SAHTE-META D0: geçersiz şablon kimliği; hiçbiri silinmedi" });
    } else {
      if (!ad) return this.hata(100, { details: "name gerekli" });
      hedefler = this.sablonlar.filter(s => s.waba === waba.id && s.name === ad && !s.silindi && (!tek || s.id === tek));
      if (!hedefler.length) return this.hata(100, { details: "SAHTE-META D0: bu adda şablon yok" });
    }
    if (hedefler.some(h => h.status === "DISABLED")) return this.hata(100, { details: "SAHTE-META D0: DISABLED şablon silinemez" });
    for (const h of hedefler) {
      h.silindi = true;
      if (h.status === "APPROVED") this.engelliAdlar.push({ waba: waba.id, name: h.name, sonT: this.simdi() + 30 * GUN });
    }
    return { http: 200, govde: { success: true } };
  }

  // ---- numara, hesap, abonelik --------------------------------------------------------------------------------------------
  async numaraOku(req, sorgu, n) {
    const y = this.yetkiDenetle(req, sorgu, { izin: IZIN_YONETIM, waba: n.waba }); if (y) return y;
    const waba = this.wabalar.get(n.waba);
    const tum = {
      id: n.id, display_phone_number: n.gorunen, verified_name: n.verified_name, quality_rating: n.kalite, // D0: alan adları genel Graph
      whatsapp_business_manager_messaging_limit: n.basamak, // belge
      throughput: { level: n.throughput }, // belge alanı var; biçimi D0
      code_verification_status: "VERIFIED", name_status: "APPROVED", // D0
      webhook_configuration: { ...(n.kanca?.override_callback_uri ? { phone_number: n.kanca.override_callback_uri } : {}),
        ...(waba.abonelik?.override_callback_uri ? { whatsapp_business_account: waba.abonelik.override_callback_uri } : {}), application: this.ayar.uygulama.kancaAdresi },
    };
    const alanlar = sorgu.get("fields") ? sorgu.get("fields").split(",").map(s => s.trim()).filter(Boolean) : ["verified_name", "code_verification_status", "display_phone_number", "quality_rating", "id"];
    if (alanlar.includes("messaging_limit_tier")) return this.hata(100, { details: "SAHTE-META D0: messaging_limit_tier kaldırıldı (belge: whatsapp_business_manager_messaging_limit kullanın)" });
    const bilinmeyen = alanlar.filter(a => !(a in tum));
    if (bilinmeyen.length) return this.hata(100, { details: `SAHTE-META D0: bilinmeyen alan ${bilinmeyen.join(",")}` });
    const o = {}; for (const a of alanlar) o[a] = tum[a]; o.id = n.id;
    return { http: 200, govde: o };
  }

  async numaraAyarla(req, sorgu, n, govde) {
    const y = this.yetkiDenetle(req, sorgu, { izin: IZIN_YONETIM, waba: n.waba }); if (y) return y;
    const wc = govde?.webhook_configuration;
    if (!wc) return this.hata(100);
    if (wc.override_callback_uri === "") { n.kanca = null; return { http: 200, govde: { success: true } }; }
    if (typeof wc.override_callback_uri !== "string" || wc.override_callback_uri.length > 200 || !wc.verify_token) return this.hata(100, { details: "override_callback_uri (≤ 200) ve verify_token gerekli" });
    n.kanca = { override_callback_uri: wc.override_callback_uri, verify_token: wc.verify_token };
    return { http: 200, govde: { success: true } };
  }

  async kaydet(req, sorgu, n, govde) {
    const y = this.yetkiDenetle(req, sorgu, { izin: IZIN_MESAJ, waba: n.waba }); if (y) return y;
    const t = this.simdi();
    n.kayitDenemeleri = n.kayitDenemeleri.filter(x => t - x < 72 * SAAT);
    if (n.kayitDenemeleri.length >= 10) return this.hata(133016); // belge: 72 saatte 10
    n.kayitDenemeleri.push(t);
    if (govde?.messaging_product !== "whatsapp") return this.hata(100);
    if (!/^\d{6}$/.test(String(govde?.pin ?? ""))) return this.hata(100, { details: "SAHTE-META D0: pin 6 haneli olmalı" });
    if (n.pin && n.pin !== String(govde.pin)) return this.hata(133005);
    n.pin = String(govde.pin); n.kayitli = true;
    return { http: 200, govde: { success: true } };
  }

  async kayitSil(req, sorgu, n) {
    const y = this.yetkiDenetle(req, sorgu, { izin: IZIN_MESAJ, waba: n.waba }); if (y) return y;
    if (n.birlikteKullanim) return this.hata(100, { details: "SAHTE-META D0: birlikte kullanımdaki numara kayıttan silinemez" });
    const t = this.simdi();
    n.kayitDenemeleri = n.kayitDenemeleri.filter(x => t - x < 72 * SAAT);
    if (n.kayitDenemeleri.length >= 10) return this.hata(133016);
    n.kayitDenemeleri.push(t); n.kayitli = false;
    return { http: 200, govde: { success: true } };
  }

  async wabaOku(req, sorgu, waba) {
    const y = this.yetkiDenetle(req, sorgu, { izin: IZIN_YONETIM, waba: waba.id }); if (y) return y;
    return { http: 200, govde: { id: waba.id, name: waba.ad } }; // D0
  }

  async numaraListesi(req, sorgu, waba) {
    const y = this.yetkiDenetle(req, sorgu, { izin: IZIN_YONETIM, waba: waba.id }); if (y) return y;
    const data = [...this.numaralar.values()].filter(n => n.waba === waba.id).map(n => ({ id: n.id, display_phone_number: n.gorunen, verified_name: n.verified_name, quality_rating: n.kalite }));
    return { http: 200, govde: { data } }; // D0
  }

  async abonelik(req, sorgu, waba, govde) {
    const y = this.yetkiDenetle(req, sorgu, { izin: IZIN_YONETIM, waba: waba.id }); if (y) return y;
    if (req.method === "GET") {
      if (!waba.abonelik) return { http: 200, govde: { data: [] } };
      const o = { whatsapp_business_api_data: { id: this.ayar.uygulama.id, link: `https://www.facebook.com/games/?app_id=${this.ayar.uygulama.id}`, name: this.ayar.uygulama.ad } };
      if (waba.abonelik.override_callback_uri) o.override_callback_uri = waba.abonelik.override_callback_uri;
      return { http: 200, govde: { data: [o] } };
    }
    if (req.method === "DELETE") { waba.abonelik = null; return { http: 200, govde: { success: true } }; } // D0
    if (req.method !== "POST") return this.hata(100);
    const uri = govde?.override_callback_uri;
    if (uri === undefined || uri === null) { waba.abonelik = { override_callback_uri: null, verify_token: null }; return { http: 200, govde: { success: true } }; }
    if (typeof uri !== "string" || uri.length > 200 || !govde.verify_token) return this.hata(100, { details: "override_callback_uri (≤ 200) ve verify_token gerekli" });
    waba.abonelik = { override_callback_uri: uri, verify_token: String(govde.verify_token) };
    return { http: 200, govde: { success: true } };
  }

  // ---- Embedded Signup kod değişimi ---------------------------------------------------------------------------------------
  async kodDegistir(sorgu) {
    if (sorgu.get("client_id") !== this.ayar.uygulama.id) return this.hata(100, { details: "SAHTE-META D0: client_id yanlış" });
    if (sorgu.get("client_secret") !== this.ayar.uygulama.sir) return this.hata(100, { details: "SAHTE-META D0: client_secret yanlış" });
    const kod = this.esKodlari.get(sorgu.get("code"));
    if (!kod) return this.hata(100, { details: "SAHTE-META D0: kod yok" });
    if (kod.kullanildi) return this.hata(100, { details: "SAHTE-META D0: kod daha önce kullanıldı" });
    if (this.simdi() - kod.t > this.ayar.esKoduOmruMs) return this.hata(100, { details: "SAHTE-META: kodun ömrü 30 sn (belge) doldu" });
    kod.kullanildi = true;
    const belirtec = "SAHTE-IS-BELIRTECI-" + crypto.randomBytes(16).toString("hex");
    this.belirtecler.set(belirtec, { durum: "gecerli", izinler: [IZIN_YONETIM, IZIN_MESAJ], wabalar: [kod.waba] });
    return { http: 200, govde: { access_token: belirtec, token_type: "bearer" } };
  }

  esKoduUret({ waba, numara }) {
    const code = "AQ" + crypto.randomBytes(24).toString("base64url");
    this.esKodlari.set(code, { t: this.simdi(), waba: String(waba ?? [...this.wabalar.keys()][0]), numara, kullanildi: false });
    return code;
  }

  // ---- durum kancası ------------------------------------------------------------------------------------------------------
  kancaAdresi(numaraKimligi) {
    const n = this.numaralar.get(numaraKimligi);
    const w = n && this.wabalar.get(n.waba);
    return n?.kanca?.override_callback_uri || w?.abonelik?.override_callback_uri || this.ayar.uygulama.kancaAdresi || null; // belge: numara → hesap → uygulama
  }

  /**
   * Bir iletinin durum kancasını şimdi gönderir. { wamid, durum, hataKodu?, tekrar?(1), timestamp?(sn), opaque? (null = gönderme), fiyat? (true/false/nesne),
   * url?, imzala?(uygulama.imzala), sahte?: { numaraKimligi, alici } (kayıtta olmayan wamid için) }. 200 dışı → Meta kuyruğu (7 gün).
   */
  async durumGonder(s) {
    const m = this.mesajlar.find(x => x.wamid === s.wamid);
    if (!m && !s.sahte) throw new Error(`SAHTE-META: wamid kayıtta yok (${s.wamid}); sahte olay için 'sahte' alanını verin`);
    const numaraKimligi = m?.numaraKimligi ?? s.sahte.numaraKimligi ?? [...this.numaralar.keys()][0];
    const n = this.numaralar.get(numaraKimligi);
    const st = { id: s.wamid, status: s.durum, timestamp: s.timestamp ?? Math.floor(this.simdi() / 1000), recipient_id: m?.teslimNumarasi ?? rakamlar(s.sahte?.alici) };
    const opaque = s.opaque === undefined ? m?.opaque : s.opaque;
    if (opaque !== null && opaque !== undefined) st.biz_opaque_callback_data = opaque;
    const kategori = String(m?.kategori || "UTILITY").toLowerCase();
    const fiyatAl = s.fiyat === undefined
      ? (m && !m.fiyatVerildi && (s.durum === this.ayar.fiyatHangisinde || (this.ayar.fiyatHangisinde === "delivered" && s.durum === "read")))
      : Boolean(s.fiyat);
    if (fiyatAl && s.durum !== "failed") { st.pricing = typeof s.fiyat === "object" ? s.fiyat : fiyatNesnesi(kategori); if (m) m.fiyatVerildi = true; }
    if (s.durum === "failed") st.errors = [hataNesnesi(s.hataKodu ?? 131000)];
    const govde = durumGovdesi({ wabaId: s.sahte?.waba ?? m?.waba ?? n?.waba, gorunenNumara: rakamlar(n?.gorunen), numaraKimligi, durumlar: [st] });
    const url = s.url || this.kancaAdresi(numaraKimligi);
    const sir = (s.imzala ?? this.ayar.uygulama.imzala) ? this.ayar.uygulama.sir : undefined;
    const sonuclar = [];
    if (m) m.durumlar.push({ durum: s.durum, t: this.simdi(), hataKodu: s.hataKodu ?? null });
    for (let i = 0; i < (s.tekrar ?? 1); i += 1) {
      if (!url) { sonuclar.push({ http: 0, basarili: false, hata: "kanca adresi yok" }); continue; }
      const r = await kancaGonder(url, govde, { sir });
      const kayit = { t: this.simdi(), url, wamid: s.wamid, durum: s.durum, http: r.http, basarili: r.basarili, deneme: 1, hata: r.hata, govde };
      this.kancalar.push(kayit);
      sonuclar.push(kayit);
      if (!r.basarili) this.kuyruk.ekle({ url, ham: r.ham, sir, ilkDenemeT: this.simdi(), simdi: this.simdi(), etiket: `${s.wamid}:${s.durum}` });
    }
    return sonuclar;
  }

  async hamKancaGonder({ url, govde, imzala }) {
    const hedef = url || this.ayar.uygulama.kancaAdresi;
    const sir = (imzala ?? this.ayar.uygulama.imzala) ? this.ayar.uygulama.sir : undefined;
    const r = await kancaGonder(hedef, govde, { sir });
    const kayit = { t: this.simdi(), url: hedef, wamid: null, durum: "ham", http: r.http, basarili: r.basarili, deneme: 1, hata: r.hata, govde };
    this.kancalar.push(kayit);
    return kayit;
  }

  async kuyruguIsle({ hepsi = false } = {}) {
    const r = await this.kuyruk.isle(this.simdi(), { hepsi });
    for (const x of r) this.kancalar.push({ t: this.simdi(), url: null, wamid: x.etiket, durum: "yeniden-deneme", http: x.http ?? null, basarili: x.durum === "teslim", deneme: x.deneme ?? null, dustu: x.durum === "dustu" });
    return r;
  }

  // ---- kayıt / sayılar ----------------------------------------------------------------------------------------------------
  kayit() {
    const mesajIstegi = {}; const kabul = {};
    for (const i of this.istekler.filter(x => x.islem === "messages")) mesajIstegi[i.hedef ?? "?"] = (mesajIstegi[i.hedef ?? "?"] || 0) + 1;
    for (const m of this.mesajlar) kabul[m.teslimNumarasi] = (kabul[m.teslimNumarasi] || 0) + 1;
    const medyalar = [...this.medyalar.values()].map(({ icerik, ...m }) => m);
    return {
      simdi: this.simdi(),
      istekler: this.istekler,
      mesajlar: this.mesajlar,
      gecersizMedyaDenemeleri: this.gecersizMedyaDenemeleri,
      medyalar,
      sablonlar: this.sablonlar.map(s => ({ ...s })),
      kancalar: this.kancalar,
      kancaKuyrugu: this.kuyruk.bekleyen.length,
      kancaDusen: this.kuyruk.dusen.length,
      sizintilar: this.sizintilar,
      sayilar: {
        mesajIstegi, kabul,
        toplamMesajIstegi: this.istekler.filter(x => x.islem === "messages").length,
        toplamKabul: this.mesajlar.length,
        medyaYukleme: this.istekler.filter(x => x.islem === "media").length,
        medyaKabul: this.medyalar.size,
        medyaSilme: medyalar.filter(m => m.silindi).length,
        koptu: this.istekler.filter(x => String(x.sonuc).startsWith("koptu")).length,
      },
    };
  }

  // ---- denetim uçları (/__sahte/*) ----------------------------------------------------------------------------------------
  async denetim(req, res, p, sorgu, ham) {
    const json = (kod, o) => { res.writeHead(kod, { "content-type": "application/json; charset=utf-8" }); res.end(JSON.stringify(o)); };
    let g = {};
    if (ham.length && !(p[0] === "medya")) { try { g = JSON.parse(ham.toString("utf8")); } catch { return json(400, { hata: "JSON bekleniyor" }); } }
    try {
      const [a, b, c] = p;
      if (a === "kayit" && req.method === "GET") return json(200, this.kayit());
      if (a === "sifirla") { this.sifirla(g); return json(200, { tamam: true }); }
      if (a === "kur") {
        const onceki = { sinir: this.ayar.sinir, hiz: this.ayar.hiz, degiskenKurali: this.ayar.degiskenKurali, uygulama: this.ayar.uygulama };
        Object.assign(this.ayar, g);
        for (const k of Object.keys(onceki)) if (g[k]) this.ayar[k] = { ...onceki[k], ...g[k] };
        if (g.alicilar) for (const [k, v] of Object.entries(g.alicilar)) this.alicilar.set(rakamlar(k), v);
        if (g.hizmetPenceresi) this.hizmetPenceresi = new Set(g.hizmetPenceresi.map(rakamlar));
        return json(200, { tamam: true });
      }
      if (a === "kural" && req.method === "POST") return json(200, { kimlik: this.kural(g) });
      if (a === "kural" && req.method === "DELETE") { this.kurallar = []; return json(200, { tamam: true }); }
      if (a === "saat") { if (g.ilerle) this.sahteSaat = this.simdi() + Number(g.ilerle); else this.sahteSaat = g.simdi === null ? null : (typeof g.simdi === "string" ? Date.parse(g.simdi) : Number(g.simdi)); return json(200, { simdi: this.simdi() }); }
      if (a === "sablon" && req.method === "POST") {
        const s = g.id ? this.sablonlar.find(x => x.id === g.id) : this.sablonlar.find(x => x.name === g.name && x.language === (g.language ?? "tr") && !x.silindi && (!g.waba || x.waba === g.waba));
        if (!s) { if (!g.olustur) return json(404, { hata: "şablon yok" }); return json(200, this.sablonEkle(g)); }
        if (g.status) { if (!SABLON_DURUMLARI.includes(g.status)) return json(400, { hata: "durum" }); s.status = g.status; }
        if (g.category) s.category = g.category;
        if (g.quality) s.quality_score = { score: g.quality, date: Math.floor(this.simdi() / 1000) };
        if (g.sil) s.silindi = true;
        return json(200, s);
      }
      if (a === "numara") { const n = this.numaralar.get(g.id) || [...this.numaralar.values()][0]; Object.assign(n, g, { id: n.id }); return json(200, n); }
      if (a === "waba") { const w = this.wabalar.get(g.id) || [...this.wabalar.values()][0]; Object.assign(w, g, { id: w.id }); return json(200, w); }
      if (a === "belirtec") { const v = this.belirtecler.get(g.belirtec) || { durum: "gecerli", izinler: [], wabalar: ["*"] }; this.belirtecler.set(g.belirtec, { ...v, ...g }); return json(200, { tamam: true }); }
      if (a === "alici") { this.alicilar.set(rakamlar(g.telefon), g); return json(200, { tamam: true }); }
      if (a === "kanca" && !b) return json(200, await this.durumGonder(g));
      if (a === "kanca" && b === "ham") return json(200, await this.hamKancaGonder(g));
      if (a === "kanca" && b === "kuyruk") return json(200, await this.kuyruguIsle(g));
      if (a === "kanca" && b === "dogrula") {
        const n = this.numaralar.get(g.numaraKimligi) || [...this.numaralar.values()][0];
        const w = this.wabalar.get(n.waba);
        const url = g.url || this.kancaAdresi(n.id);
        const belirtec = g.verifyToken ?? n.kanca?.verify_token ?? w.abonelik?.verify_token;
        return json(200, await kancaDogrulat(url, belirtec));
      }
      if (a === "es-kodu") return json(200, { code: this.esKoduUret(g) });
      if (a === "medya" && b) {
        const m = this.medyalar.get(b);
        if (!m) return json(404, { hata: "medya yok" });
        if (c === "indir") { // Media Download (belge: belirteçsiz istek başarısız)
          if (!/^Bearer\s+/i.test(String(req.headers.authorization || ""))) { res.writeHead(401); return res.end(); } // D0: durum kodu
          if (m.silindi) { res.writeHead(404); return res.end(); }
        }
        res.writeHead(200, { "content-type": m.tur }); return res.end(m.icerik);
      }
      return json(404, { hata: "bilinmeyen denetim ucu", p });
    } catch (e) {
      return json(500, { hata: e.message });
    }
  }
}

/** Sunucuyu 127.0.0.1'de açar. secenek: { port (0), senaryo } → { url, meta (SahteMeta), kapat(), ...kısayollar } */
export async function sahteMetaBaslat({ port = 0, senaryo = {} } = {}) {
  const meta = new SahteMeta(senaryo);
  const sunucu = http.createServer((req, res) => { meta.isle(req, res).catch(e => { try { res.writeHead(500); res.end(String(e)); } catch { /* yok */ } }); });
  sunucu.keepAliveTimeout = 1000;
  await new Promise((resolve, reject) => { sunucu.once("error", reject); sunucu.listen(port, "127.0.0.1", resolve); });
  const url = `http://127.0.0.1:${sunucu.address().port}`;
  meta.taban = url;
  return {
    url, meta,
    kural: k => meta.kural(k),
    saat: v => { meta.sahteSaat = v === null ? null : (typeof v === "string" ? Date.parse(v) : v); return meta.simdi(); },
    kayit: () => meta.kayit(),
    durumGonder: s => meta.durumGonder(s),
    kuyruguIsle: s => meta.kuyruguIsle(s),
    esKoduUret: s => meta.esKoduUret(s),
    kapat: () => new Promise(r => { sunucu.closeAllConnections?.(); sunucu.close(() => r()); }),
  };
}

if (import.meta.url === pathToFileURL(process.argv[1] || "").href) {
  const i = process.argv.indexOf("--port");
  const port = i > -1 ? Number(process.argv[i + 1]) : 0;
  const s = await sahteMetaBaslat({ port });
  process.stdout.write(JSON.stringify({ url: s.url }) + "\n");
}
