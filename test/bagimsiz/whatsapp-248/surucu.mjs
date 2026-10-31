// WhatsApp toplu gönderim kâhininin PROGRAM SÜRÜCÜSÜ — 2.4.8 SON ADAY T1 (docs/2.4.8-IS-LISTESI.md "SON ADAY TEST PLANI" T1; kâhin bu dosyayı okumaz).
//
// Kâhinden AYRI EL: kahin/senaryolar.json'daki her senaryoyu GERÇEK programda koşar (startTestServer; her koşu kendi veri klasörü), olay dilini programın
// uçlarına bağlar, programın gösterdiğini kâhinin sonuç yapısına çevirir ve kahin.py karsilastir ile karşılaştırır. Kâhine DOKUNMAZ (ders 40): kâhinin
// kuralı programla ayrışırsa fark olduğu gibi yazılır; aşağıdaki ÇEVİRİ TABLOSU yalnız ADLANDIRMA çevirisidir (programın aynı bilgiyi başka alanda tuttuğu yer),
// karşılaştırmadan ÖNCE yazıldı ve her çeviri çıktıda sayılır.
//
// Düzenek (gerçek ağ yok — ders 30; lisans servisi ölü yerel adres):
//   program ──Graph──► VEKİL (sürücü; ileti isteğinde saati işçi adımı kadar ilerletir, "Meta'ya ulaşılamıyor"da dinlemeyi kapatır, çökmeyi üretir) ──► SAHTE META
//   (sahte-meta/sunucu.mjs; kâhin paketinin, DEĞİŞTİRİLMEDİ) ──kanca──► ALICI (sürücü; kapıcının yerine: Meta imzasını uygulama sırrıyla doğrular → "wa1",
//   imzasız → "wa0"; program kapalı / tünel kapalıysa 503 → Meta kuyruğu) ──► programın uzak dinleyicisi /wa/kanca/<gizli yol> (lib/whatsapp/hook.mjs, GERÇEK).
//   Kanca adresini program KENDİSİ kaydeder (bakım turu ensureHook → subscribed_apps); ofisin uzak adresi http://ofis.localhost:<alıcı> (ad çözümü bu süreçte
//   127.0.0.1'e bağlanır). Kapıcı işareti doğrulaması (mobileSync.kancaIsareti) alıcının başlığını okuyacak biçimde bağlanır: kapıcı + tünel W9 testinde
//   gerçek kodla sınanır; burada yalnız imzalı/imzasız ayrımı taşınır.
// Saat: tek sahte, SABİT saat (config.now) + sahte Meta saati; işçi elle sürülür (whatsappWorker "manual", ders 20). İki zaman ucu (README §2): işçi adımı
// hızlı 0,5 sn / yavaş 5 sn — her ileti isteğinde saat bu kadar ilerler (kâhinde ts = t + adım). Programın süreç saat dilimi varsayılan Europe/Istanbul (kâhinin
// "bugün"ü +03:00); --tz <IANA> ile başka dilim (ör. UTC: Türkiye dışı ayarlı makine, ders 13/22) — kâhinin beklentisi DEĞİŞMEZ, yalnız programın yerel günü kayar.
// Kâhin güncellemesi 2 eşlemeleri (README §7.5, S-1..S-8): senaryonun "bitis" ufku; hazır dönem seçimi → programın preset'i; etiketli Başarısızları Yeniden Dene /
// Yine de Gönder yanıtı → sonuc.yeniden; yedek_al / geri_yukle {yedek}; liste → WhatsApp Gönderimleri ucu (30'ar, imleç, Başlangıç/Bitiş) → sonuc.listeler;
// "Sonucu Belirsiz" eleme nedeni. Sürücü elenme nedenini HESAPLAMAZ, yalnız programın yanıtından okur. S-8: --mutasyon-denetimi her eşlemeye bilerek hata enjekte eder
// (aynı süreçte, programa dokunmadan) ve kâhin karşılaştırmasının ayrıştığını denetler (ayrışmayan = dişsiz eşleme).
// Lisans: "lisans" olayı programın lisans nesnesinin writable/assertWritable yanıtını değiştirir (salt okunur lisansın dış koşulu; gerçek lisans servisi yok).
// Çökme ("cokme"): istek Meta'dayken veri klasörünün o anki kopyası alınır (SIGKILL'in bıraktığı disk), süreç atılır; "ac" o kopyadan açar (açılış toparlaması GERÇEK).
//
// Kullanım (depo kökünden):
//   node test/bagimsiz/whatsapp-248/surucu.mjs [--senaryo AD1,AD2|önek*] [--uc hizli|yavas|ikisi] [--kip imzali|yol1|yol2] [--tz <IANA>] [--cikti <klasör>]
//   node test/bagimsiz/whatsapp-248/surucu.mjs --mutasyon-denetimi [--cikti <klasör>]   (S-8; yalnız hızlı uç)
//   node tools/kanit.mjs kos 248-t1-kahin -- node test/bagimsiz/whatsapp-248/surucu.mjs --cikti docs/kanit/2026-10-30/248-t1-kahin
// --kip imzali (varsayılan): Elle Bağla (Yol 1) kurulumu, Meta kancası imzalı geçer (kâhinin varsayımı: "imza kapıcıda doğrulanır", §7a 3);
//       yol1: GERÇEKÇİ Yol 1 — kapıcı müşterinin uygulama sırrını bilmez, her kanca "wa0" (plan §3 C); yol2: WhatsApp'ı Bağla kipi (connection.saveEmbedded),
//       imzalı kanca "wa1", imzasız 401.
// Çıktı: <klasör>/karsilastirma.json (senaryo × uç: fark listesi, çeviriler, program sonucu), ekrana TAP + "# tests/pass/fail".
import dns from "node:dns";
import { createHash, createHmac, timingSafeEqual } from "node:crypto";
import { execFileSync } from "node:child_process";
import fs from "node:fs";
import http from "node:http";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { DatabaseSync } from "node:sqlite";

// Saat dilimi argümanı programı içe aktarmadan ÖNCE okunur (aynı süreç: program ve sürücü aynı dilimde).
const TZ_ARG = (() => {
  const i = process.argv.indexOf("--tz");
  return i >= 0 ? process.argv[i + 1] : null;
})();
process.env.TZ = TZ_ARG || "Europe/Istanbul";
// Ders 30: gerçek programın lisans servisi ölü yerel adres (aynı süreçte lisans uygulaması da kapalı: startTestServer license.enforce false).
process.env.HUKUK_LICENSE_URL = "http://127.0.0.1:9";
// Ofisin uzak adresi (*.localhost) bu süreçte yerel döngüye çözülür (sahte Meta'nın kanca istekleri alıcıya gelir).
const asilLookup = dns.lookup;
dns.lookup = function lookup(host, options, callback) {
  if (typeof options === "function") {
    callback = options;
    options = {};
  }
  if (/\.localhost$/i.test(String(host))) {
    if (options && options.all) return process.nextTick(callback, null, [{ address: "127.0.0.1", family: 4 }]);
    return process.nextTick(callback, null, "127.0.0.1", 4);
  }
  return asilLookup.call(dns, host, options, callback);
};

const { ADMIN_PASSWORD, createClient, startTestServer } = await import("../../helpers.mjs");
const { pdfText } = await import("../../banka-210-ortak.mjs");
const { sahteMetaBaslat } = await import("./sahte-meta/sunucu.mjs");
const { durumGovdesi } = await import("./sahte-meta/kanca.mjs");
const { HttpError } = await import("../../../server/lib/http.mjs");

const HERE = path.dirname(fileURLToPath(import.meta.url));
const KAHIN = path.join(HERE, "kahin", "kahin.py");
const SENARYOLAR = path.join(HERE, "kahin", "senaryolar.json");
const SN = 1000;
const DK = 60 * SN;
const SA = 60 * DK;
const GUN = 24 * SA;
const TOKEN = "SURUCU-T1-belirtec-0123456789-abcdefABCDEF";
const UYGULAMA = { id: "900000000000001", sir: "SURUCU-T1-uygulama-sirri-0123456789" };
const WABA_ID = { W1: "800000000000001", W2: "800000000000002", W3: "800000000000003" };
const PN_ID = { W1: "700000000000001", W2: "700000000000002", W3: "700000000000003" };
const BASAMAK_ADI = { 250: "TIER_250", 2000: "TIER_2K", 10000: "TIER_10K", 100000: "TIER_100K" };
const SORULUYOR = "PLAN-SUSUYOR:24-saatten-eski-devam-sorusu";
const ATLAMA = new Map([
  ["Cari Silinmiş", "silindi"],
  ["WhatsApp Mesajı İstemiyor", "istemiyor"],
  ["Pasif Cari", "pasif"],
  ["Telefon yok", "telefonsuz"],
  ["Numara eksik ya da fazla haneli", "gecersiz"],
  ["Numara biçimi tanınmadı", "gecersiz"],
  ["Gecikmiş Borç Yok", "gecikmis_borc_yok"],
  ["Zaten Kuyrukta", "zaten_kuyrukta"],
  ["Daha Önce Gönderildi", "daha_once_gonderildi"],
  // S-7 (kâhin güncellemesi 2, K6): Başarısızları Yeniden Dene'de önceki iletisi Sonucu Belirsiz kalan kişi; S-9 (güncelleme 3, D1): yeni toplu işin başlatma özetinde de.
  // "Zaten Kuyrukta" / "Daha Önce Gönderildi" yeniden deneme yanıtında da aynı adla (S-9, D5).
  ["Sonucu Belirsiz", "sonucu_belirsiz"],
]);
// S-8: sürücü eşlemelerine bilerek hata (yalnız --mutasyon / --mutasyon-denetimi; programa dokunmaz). null = mutasyon yok.
let MUTASYON = null;
const mut = ad => MUTASYON === ad;
// yer: "baslat" (başlatma özeti — S-9), "yeniden" (Başarısızları Yeniden Dene yanıtı — S-3, S-7, S-9), "yine" (işteki Yine de Gönder yanıtı — S-4, S-11),
// "is" (gönderimde atlanan iş).
// Tablo üç yerde AYNI; yer yalnız S-8 mutasyonlarının her yolu ayrı sınayabilmesi için.
const atlamaKodu = (metin, yer = "is") => {
  const m = String(metin || "");
  if (yer === "yeniden" && mut("S7-yeniden-belirsiz-eslemesi-yok") && m === "Sonucu Belirsiz") return `?${m}`;
  if (yer === "baslat" && mut("S9-baslatma-belirsiz-eslemesi-yok") && m === "Sonucu Belirsiz") return `?${m}`;
  if (yer === "yeniden" && mut("S9-yeniden-kuyrukta-eslemesi-yok") && m === "Zaten Kuyrukta") return `?${m}`;
  if (yer === "yeniden" && mut("S9-yeniden-daha-once-eslemesi-yok") && m === "Daha Önce Gönderildi") return `?${m}`;
  if (yer === "yine" && mut("S11-yine-kuyrukta-eslemesi-yok") && m === "Zaten Kuyrukta") return `?${m}`;
  return ATLAMA.get(m) || (metin ? `?${metin}` : null);
};
// S-2: kâhinin hazır dönem seçimi → programın hazır dönem değeri (istemcinin "Ekstre Dönemi" listesi: hof-whatsapp-api.js PRESETS; sunucu waPresetRange).
const HAZIR_DONEM = { bu_ay: "thisMonth", gecen_ay: "lastMonth", son_3_ay: "last3", tum: "all" };
// S-6: WhatsApp Gönderimleri ekranının sayfa boyu (istemci PAGE = 30; limit 31 istenir, 31. kayıt "Daha Fazla Göster"i açar).
const SAYFA = 30;

// ---------- komut satırı ----------
function argumanlar(argv) {
  const o = { senaryo: null, uc: "ikisi", kip: "imzali", cikti: null, ayrinti: false, tz: process.env.TZ, mutasyon: null, mutasyonDenetimi: false, dokum: null };
  for (let i = 0; i < argv.length; i += 1) {
    const a = argv[i];
    if (a === "--senaryo") o.senaryo = argv[++i];
    else if (a === "--uc") o.uc = argv[++i];
    else if (a === "--kip") o.kip = argv[++i];
    else if (a === "--cikti") o.cikti = argv[++i];
    else if (a === "--ayrinti") o.ayrinti = true;
    else if (a === "--tz") i += 1; // dosyanın başında okundu
    else if (a === "--mutasyon") o.mutasyon = argv[++i];
    else if (a === "--mutasyon-denetimi") o.mutasyonDenetimi = true;
    else if (a === "--dokum") o.dokum = argv[++i];
    else throw new Error(`bilinmeyen seçenek: ${a}`);
  }
  if (!["hizli", "yavas", "ikisi"].includes(o.uc)) throw new Error("--uc hizli|yavas|ikisi");
  if (!["imzali", "yol1", "yol2"].includes(o.kip)) throw new Error("--kip imzali|yol1|yol2");
  return o;
}

// ---------- zaman ----------
function zaman(metin, t0, cokme = null) {
  if (typeof metin === "number") return t0 + metin;
  const m = /^(cokme)?\+((?:\d+(?:\.\d+)?(?:ms|[dhms]))+)$/.exec(metin);
  if (m) {
    let taban = t0;
    if (m[1]) {
      if (cokme === null) return null;
      taban = cokme;
    }
    let toplam = 0;
    for (const [, sayi, birim] of m[2].matchAll(/(\d+(?:\.\d+)?)(ms|[dhms])/g)) toplam += Number(sayi) * { d: GUN, h: SA, m: DK, s: SN, ms: 1 }[birim];
    return taban + Math.trunc(toplam);
  }
  return Date.parse(metin);
}
const pad = n => String(n).padStart(2, "0");
/** Kâhinin iso(t, tz): "2026-10-30T11:00:00+03:00" (saniyeye kadar, +03:00). */
function trIso(ms) {
  const d = new Date(Math.floor(ms / 1000) * 1000 + 3 * SA);
  return `${d.getUTCFullYear()}-${pad(d.getUTCMonth() + 1)}-${pad(d.getUTCDate())}T${pad(d.getUTCHours())}:${pad(d.getUTCMinutes())}:${pad(d.getUTCSeconds())}+03:00`;
}
const trGun = ms => trIso(ms).slice(0, 10);
const trAy = ms => trIso(ms).slice(0, 7);
const tr = iso => (iso ? `${iso.slice(8, 10)}.${iso.slice(5, 7)}.${iso.slice(0, 4)}` : "");

// Kâhinin numara() kuralı YALNIZ sahte Meta kuralının hedefini (alıcı) bulmak için (kâhin "mesaj" davranışı cari başınadır, sahte sunucu alıcı numarasına göre).
function hedefRakam(ham) {
  if (ham === null || ham === undefined) return null;
  const ilk = String(ham).trim().split(/\s*(?:[/,;]|\r?\n)\s*/)[0];
  const r = ilk.replace(/\D/g, "");
  if (!r) return null;
  if (ilk.trim().startsWith("+")) return r;
  if (r.startsWith("00")) return r.slice(2);
  if (r.startsWith("0") && r.length === 11) return `90${r.slice(1)}`;
  if (r.startsWith("90") && r.length === 12) return r;
  if (r.length === 10 && r[0] !== "0") return `90${r}`;
  return r;
}

// ---------- küçük HTTP yardımcıları ----------
function dinle(server, port = 0) {
  return new Promise((resolve, reject) => {
    server.once("error", reject);
    server.listen(port, "127.0.0.1", () => {
      server.off("error", reject);
      resolve(server.address().port);
    });
  });
}
function kapatSunucu(server) {
  return new Promise(resolve => {
    server.closeAllConnections?.();
    server.close(() => resolve());
  });
}
function govdeOku(req) {
  return new Promise((resolve, reject) => {
    const parts = [];
    req.on("data", c => parts.push(c));
    req.on("end", () => resolve(Buffer.concat(parts)));
    req.on("error", reject);
  });
}
function ilet({ port, method, yol, headers, govde, beklemeyi = null }) {
  return new Promise(resolve => {
    const h = { ...headers };
    delete h.host;
    delete h.connection;
    if (govde) h["content-length"] = govde.length;
    const r = http.request({ host: "127.0.0.1", port, method, path: yol, headers: h, agent: false }, res => {
      const parts = [];
      res.on("data", c => parts.push(c));
      res.on("end", () => resolve({ ok: true, status: res.statusCode, headers: res.headers, body: Buffer.concat(parts) }));
      res.on("error", error => resolve({ ok: false, error }));
    });
    r.on("error", error => resolve({ ok: false, error }));
    if (beklemeyi) beklemeyi(r);
    if (govde) r.write(govde);
    r.end();
  });
}

// ---------- bir senaryonun bir uçta koşusu ----------
async function kos(sen, uc, secenek) {
  const g = sen.girdi;
  const adim = uc === "hizli" ? 500 : 5 * SN;
  const T0 = zaman(g.baslangic, 0);
  // S-1: senaryonun "bitis"i varsa ufuk odur (README §7.1 "bitis (ufuk)"); yoksa kâhinin varsayılanı başlangıç + 10 gün (README §2 "Ufuk").
  const ufuk = g.bitis && !mut("S1-bitis-yok-sayilir") ? zaman(g.bitis, T0) : T0 + 10 * GUN;
  if (g.bitis && !Number.isFinite(ufuk)) throw new Error(`sürücü bu bitişi çözemedi: ${g.bitis}`);
  const kok = fs.mkdtempSync(path.join(os.tmpdir(), "t1-248-surucu-"));
  const dataDir = path.join(kok, "data");
  const backupDir = path.join(kok, "backups");
  const notlar = [];
  const ceviriler = {};
  const cevir = ad => (ceviriler[ad] = (ceviriler[ad] || 0) + 1);
  const ayar = { bagli: true, onay: true, gunluk_ust_sinir: null, lisans_yazilabilir: true, ...(g.ayar || {}) };
  const kullanicilar = g.kullanicilar || { yonetici: { "whatsapp.send": true } };
  const firmalar = g.firmalar || { A: "Deneme Ticaret Ltd. Şti." };
  const wabalar = g.wabalar || { A: "W1" };
  const meta0 = g.meta || {};
  const davranis = g.meta_davranis || {};
  const sirketler = [...new Set(["A", ...Object.keys(firmalar), ...g.cariler.map(c => c.sirket || "A"), ...g.olaylar.filter(o => o.tur === "baslat").map(o => o.sirket || "A")])];
  const wabaEtiketleri = [...new Set(Object.values(wabalar))];
  const wabaEtiketi = Object.fromEntries(Object.entries(WABA_ID).map(([k, v]) => [v, k]));

  let simdi = T0;
  let program = null; // { server, admin, istemciler, uzakPort }
  let lisansYazilabilir = true; // kurulum yazılabilir lisansla; senaryonun lisans durumu kurulumdan sonra (aşağıda)
  let tunelAcik = true;
  let metaKapali = false;
  const sahteKurallar = [];
  const sablonDurum = {
    destekofis_ekstre: { durum: "APPROVED", kategori: "UTILITY" },
    destekofis_odeme_hatirlatma: { durum: "APPROVED", kategori: "UTILITY" },
    ...JSON.parse(JSON.stringify(meta0.sablonlar || {})),
  };

  // ---- sahte Meta ----
  const basamak = BASAMAK_ADI[meta0.basamak ?? 250] || "TIER_250";
  const sablonlarOf = wabaId => {
    const out = [];
    const ekle = (name, components) => {
      const st = sablonDurum[name] || {};
      if (!st.durum) return;
      out.push({ waba: wabaId, name, language: "tr", status: st.durum, category: st.kategori || "UTILITY", components });
    };
    ekle("destekofis_ekstre", [
      { type: "HEADER", format: "DOCUMENT" },
      { type: "BODY", text: "Sayın {{1}}, {{2}} firmasındaki cari hesabınızın {{3}} dönemine ait ekstresi ektedir. Dönem sonu bakiyesi: {{4}}. İyi günler dileriz." },
      { type: "FOOTER", text: "KVKK aydınlatma metni için firmamıza başvurabilirsiniz." },
    ]);
    ekle("destekofis_odeme_hatirlatma", [
      { type: "BODY", text: "Sayın {{1}}, {{2}} firmasındaki hesabınızda {{3}} vadeli {{4}} tutarında ödemeniz bulunmaktadır. Güncel bakiye: {{5}}. Ödeme yaptıysanız bu mesajı dikkate almayınız." },
    ]);
    return out;
  };
  const alici = http.createServer((req, res) => aliciIsle(req, res).catch(error => {
    notlar.push(`alıcı hatası: ${error.message}`);
    if (!res.headersSent) res.writeHead(500);
    res.end();
  }));
  const aliciPort = await dinle(alici);
  const ofisAdresi = `http://ofis.localhost:${aliciPort}`;
  const meta = await sahteMetaBaslat({
    senaryo: {
      uygulama: { id: UYGULAMA.id, sir: UYGULAMA.sir, ad: "Sürücü Mesaj", kancaAdresi: `${ofisAdresi}/varsayilan-kanca`, imzala: true },
      belirtecler: { [TOKEN]: { durum: "gecerli", izinler: ["business_management", "whatsapp_business_management", "whatsapp_business_messaging"], wabalar: ["*"] } },
      wabalar: Object.fromEntries(wabaEtiketleri.map(w => [WABA_ID[w], { ad: `Sürücü ${w}`, odemeYontemi: true, kisitli: null, pazarlamaKapali: false }])),
      numaralar: Object.fromEntries(wabaEtiketleri.map((w, i) => [PN_ID[w], { waba: WABA_ID[w], gorunen: `+90 212 555 00 0${i}`, ulkeKodu: "90", verified_name: `Sürücü ${w}`, kayitli: true, bakim: false, basamak, kalite: "GREEN", throughput: "STANDARD" }])),
      sablonlar: wabaEtiketleri.flatMap(w => sablonlarOf(WABA_ID[w])),
      hiz: { mps: 1e9 },
    },
  });
  meta.saat(simdi);
  // Kâhinin Meta davranışı → sahte sunucu kuralları (README §6 "Eşleme"): "mesaj" cari başına n. ileti isteği (deneme alıcı numarasına göre sayılır), "medya" genel sıra.
  const yanitOf = y => (y === "kabul" ? {} : y === "yanitsiz_kabul" ? { koptu: "sonra" } : y === "yanitsiz_red" ? { koptu: "once" } : y === "yanitsiz" ? { koptu: "sonra" } : y?.sinir ? { sinir: true } : y?.hata !== undefined ? { hata: y.hata } : null);
  const kuralEkle = k => {
    if (!k.yanit) throw new Error(`sürücü bu Meta yanıtını bilmiyor: ${JSON.stringify(k)}`);
    meta.kural(k);
    sahteKurallar.push(k);
  };
  {
    const mesaj = davranis.mesaj || {};
    const anahtarlar = [...Object.keys(mesaj).filter(k => k !== "*"), ...(mesaj["*"] !== undefined ? ["*"] : [])];
    for (const anahtar of anahtarlar) {
      const v = mesaj[anahtar];
      const c = g.cariler.find(x => x.id === anahtar);
      const hedef = anahtar === "*" ? {} : { to: hedefRakam(c?.telefon) };
      if (Array.isArray(v)) {
        v.forEach((y, i) => {
          if (y !== "kabul") kuralEkle({ yol: "messages", ...hedef, deneme: i + 1, yanit: yanitOf(y) });
        });
        // Kâhinde carinin kendi listesi "*"ı tümüyle geçersiz kılar (liste bitince kabul).
        if (anahtar !== "*" && mesaj["*"] !== undefined) kuralEkle({ yol: "messages", ...hedef, kez: "hep", yanit: {} });
      } else kuralEkle({ yol: "messages", ...hedef, kez: "hep", yanit: yanitOf(v) });
    }
    (davranis.medya || []).forEach((y, i) => {
      if (y !== "kabul") kuralEkle({ yol: "media", deneme: i + 1, yanit: yanitOf(y) });
    });
  }

  // ---- kâhin ↔ program eşlemesi ----
  const cariProgram = {}; // kâhin cari → { id, sirket }
  const programCari = {}; // program cari kimliği → kâhin cari
  const sirketKimligi = { A: "sirket-001" }; // kâhin şirket → program şirket kimliği
  const sirketSorgu = s => (s === "A" ? "" : `hofCompany=${encodeURIComponent(sirketKimligi[s])}`);
  const ekle = (url, s) => (sirketSorgu(s) ? `${url}${url.includes("?") ? "&" : "?"}${sirketSorgu(s)}` : url);
  const toplular = {}; // etiket → { sirket, batchIds: [], ilk }
  const batchEtiket = {}; // program toplu iş kimliği → etiket
  const sonuc = { baslamadi: {}, elenen: {}, olusmadi: [], ayni_istek: {}, onceki_uyari: {}, kontroller: {}, yeniden: {}, listeler: {} };
  const yedekler = {}; // S-5: kâhin yedek adı → programın yedek dosyası adı
  const listeDurum = {}; // S-6: kâhin liste adı → { ids (ekranda birikmiş, imleç için), from, to }
  const elenenToplu = {}; // etiket → Set(program cari kimliği) — başlatmada elenen (iş sayılmaz)
  const planlar = {}; // kâhin cari → [plan kimliği]
  const kancalar = []; // { t, olayT, wamid, durum, kod, tekrar, sira }
  let kancaSira = 0;
  const istekKimlikleri = {};
  const degismez = { silinmis_medyayla_gonderim: 0, kesin_oncesi_medya_silme: 0, artisiz_numaraya_gonderim: 0, lisanssiz_gonderim: 0, duraklatilmis_toplu_gonderim: 0 };
  const medyaIs = new Map(); // medya kimliği → program iş kimliği (programın bildiği medya)
  const iletilenKabul = []; // S-12: programa ulaşan Meta 200 + wamid yanıtları { wamid, is, t }
  const isMetaSayisi = new Map(); // kâhin iş anahtarı → Meta'daki ileti sayısı (kanca planı "1"/"2"/"*")
  const ttlAdaylari = [];
  let cokme = null; // { cari, toplu, istek_ulasti, oldu, t }
  const cokmeOlayi = g.olaylar.find(o => o.tur === "cokme") || null;
  if (cokmeOlayi) cokme = { ...cokmeOlayi, oldu: false, t: null };
  let cokmeKopyasi = null;
  let cokmeBekleyen = null;
  let kapanisOncesi = null; // program kapanmadan önce son hâli okur (kapalıyken kontrol için)

  // Program kapalıyken makine defterinin penceresi (dosyadan, yalnız okuma; sorgu programın windowUsage'ının aynısı — lib/whatsapp/defter.mjs).
  function defterPencere(wabaId, since) {
    const dosya = path.join(dataDir, "whatsapp-gonderim.sqlite");
    if (!fs.existsSync(dosya)) return 0;
    const d = new DatabaseSync(dosya, { readOnly: true });
    try {
      return d.prepare(`SELECT c.phone FROM claims c LEFT JOIN outcomes o ON o.job_id = c.job_id AND o.attempt = c.attempt
        WHERE c.waba_id = ? AND c.at > ? AND (o.outcome IS NULL OR o.outcome <> 'failed')
        AND NOT EXISTS (SELECT 1 FROM failures f WHERE f.job_id = c.job_id AND f.attempt = c.attempt) GROUP BY c.phone`).all(String(wabaId), String(since)).length;
    } finally {
      d.close();
    }
  }
  // ---- program şirket veri tabanı (yalnız okuma; medya ↔ iş eşlemesi ve kanca planı için) ----
  const dbYolu = {};
  const dbAcik = {};
  function db(s) {
    if (!program) return null;
    if (s === "A") return program.server.app.store;
    if (!dbAcik[s]) {
      const kayit = JSON.parse(fs.readFileSync(path.join(dataDir, "sirketler.json"), "utf8"));
      const sirket = (kayit.companies || []).find(item => item.id === sirketKimligi[s]);
      const klasor = path.join(dataDir, sirket.dir);
      const dosya = fs.readdirSync(klasor).find(name => /\.(sqlite|db)$/.test(name) && !/whatsapp/.test(name));
      dbYolu[s] = path.join(klasor, dosya);
      const d = new DatabaseSync(dbYolu[s], { readOnly: true });
      dbAcik[s] = { get: (sql, ...p) => d.prepare(sql).get(...p), all: (sql, ...p) => d.prepare(sql).all(...p), close: () => d.close() };
    }
    return dbAcik[s];
  }
  const dbKapat = () => {
    for (const [k, v] of Object.entries(dbAcik)) {
      try {
        v.close();
      } catch {
        // kapalı
      }
      delete dbAcik[k];
    }
  };
  function isBilgisi(isId) {
    for (const s of sirketler) {
      const d = db(s);
      if (!d) continue;
      const row = d.get("SELECT j.id, j.batch_id AS batchId, j.account_id AS accountId, b.state AS batchState FROM wa_jobs j JOIN wa_batches b ON b.id = j.batch_id WHERE j.id = ?", isId);
      if (row) return { ...row, sirket: s };
    }
    return null;
  }
  const isAnahtari = bilgi => (bilgi && batchEtiket[bilgi.batchId] ? `${batchEtiket[bilgi.batchId]}/${programCari[bilgi.accountId]}` : null);

  // ---- VEKİL (program → sahte Meta) ----
  const vekil = http.createServer((req, res) => vekilIsle(req, res).catch(error => {
    notlar.push(`vekil hatası: ${error.message}`);
    try {
      res.socket?.destroy();
    } catch {
      // yok
    }
  }));
  const sahtePort = Number(new URL(meta.url).port);
  let vekilPort = await dinle(vekil);
  const vekilAdresi = `http://127.0.0.1:${vekilPort}`;
  async function vekilIsle(req, res) {
    const govde = await govdeOku(req);
    const yol = req.url;
    const ileti = req.method === "POST" && /\/messages$/.test(new URL(yol, "http://x").pathname);
    if (ileti) {
      // İşçi adımı: kâhinde istek t + adım anında gider (README §2 "iki uç").
      simdi += adim;
      program?.server.clock.set(simdi);
      meta.saat(simdi);
      let json = null;
      try {
        json = JSON.parse(govde.toString("utf8"));
      } catch {
        json = null;
      }
      const isId = json?.biz_opaque_callback_data || null;
      const bilgi = isId ? isBilgisi(isId) : null;
      if (json && typeof json.to === "string" && !json.to.startsWith("+")) degismez.artisiz_numaraya_gonderim += 1;
      if (!lisansYazilabilir) degismez.lisanssiz_gonderim += 1;
      if (bilgi && bilgi.batchState !== "running") degismez.duraklatilmis_toplu_gonderim += 1;
      const belge = json?.template?.components?.find(c => String(c.type).toLowerCase() === "header")?.parameters?.[0]?.document;
      if (belge?.id && isId) medyaIs.set(String(belge.id), isId);
      // Çökme: "Gönderiliyor" anında süreç ölür (istek Meta'ya ulaştıysa işlenir, yanıt gitmez).
      if (cokme && !cokme.oldu && bilgi && programCari[bilgi.accountId] === cokme.cari && (!cokme.toplu || batchEtiket[bilgi.batchId] === cokme.toplu)) {
        cokme.oldu = true;
        cokme.t = simdi;
        const once = meta.meta.mesajlar.length;
        if (cokme.istek_ulasti !== false) await ilet({ port: sahtePort, method: req.method, yol, headers: req.headers, govde });
        kancaPlanla(once);
        // Diskin o anki hâli (SIGKILL): bekleyen yazım yok (işçi Meta yanıtını bekliyor).
        cokmeKopyasi = path.join(kok, "cokme-kopyasi");
        fs.cpSync(dataDir, cokmeKopyasi, { recursive: true });
        cokmeBekleyen = { res };
        return; // yanıt hiç gitmez; programın zaman aşımı eski (atılacak) klasöre yazar
      }
      const once = meta.meta.mesajlar.length;
      const yanit = await ilet({ port: sahtePort, method: req.method, yol, headers: req.headers, govde });
      kancaPlanla(once);
      if (!yanit.ok) return void res.socket?.destroy();
      res.writeHead(yanit.status, { "content-type": yanit.headers["content-type"] || "application/json" });
      // S-12: Meta'nın 200 + wamid yanıtı programa GERÇEKTEN ulaştı mı ("finish" = yanıt programın bağlantısına yazıldı; kopmuş/zaman aşımına düşmüş bağlantıda olmaz).
      let kabulWamid = null;
      try {
        kabulWamid = yanit.status === 200 ? JSON.parse(yanit.body.toString("utf8")).messages?.[0]?.id || null : null;
      } catch {
        kabulWamid = null;
      }
      if (kabulWamid) res.once("finish", () => iletilenKabul.push({ wamid: String(kabulWamid), is: isId, t: simdi }));
      return void res.end(yanit.body);
    }
    const medyaYukleme = req.method === "POST" && /\/media$/.test(new URL(yol, "http://x").pathname);
    const yanit = await ilet({ port: sahtePort, method: req.method, yol, headers: req.headers, govde });
    if (!yanit.ok) return void res.socket?.destroy();
    if (medyaYukleme && yanit.status === 200) {
      // Programın bildiği medya: yanıt programa ulaştı. İş = şu an "Hazırlanıyor" olan (tek işçi).
      try {
        const id = JSON.parse(yanit.body.toString("utf8")).id;
        for (const s of sirketler) {
          const row = db(s)?.get("SELECT id FROM wa_jobs WHERE state = 'preparing' LIMIT 1");
          if (row && id) {
            medyaIs.set(String(id), row.id);
            break;
          }
        }
      } catch {
        // gövde okunamadı
      }
    }
    if (req.method === "DELETE") {
      const medyaId = new URL(yol, "http://x").pathname.split("/").filter(Boolean).pop();
      const isId = medyaIs.get(String(medyaId));
      const st = isId ? programIsDurumu(isId) : null;
      // S-11 (README §9.3 P3 / §9.4): iç denetim yalnız kâhin işinin SON denemesinin PDF'ine bakar — önceki (ör. Başarısız) denemenin PDF'i silinirken iş başka
      // denemede "Meta Kabul Etti"de olabilir; o silme ihlal değildir.
      const son = isId && !mut("S11-medya-silme-son-deneme-yok") ? sonDenemeMi(isId) : true;
      if (mut("S11-medya-silme-durumsuz") ? Boolean(isId) : son && st && ["accepted", "sent", "uncertain"].includes(st)) degismez.kesin_oncesi_medya_silme += 1;
    }
    res.writeHead(yanit.status, { "content-type": yanit.headers["content-type"] || "application/json" });
    res.end(yanit.body);
  }
  // Program işinin, kâhin işinin (etiket/cari: asıl toplu iş + ona bağlı yeniden deneme / Yine de Gönder toplu işleri) EN SON denemesi olup olmadığı.
  // Kâhin işine bağlanamayan iş kendi başına son deneme sayılır.
  function sonDenemeMi(isId) {
    const bilgi = isBilgisi(isId);
    const etiket = bilgi ? batchEtiket[bilgi.batchId] : null;
    const tp = etiket ? toplular[etiket] : null;
    if (!bilgi || !tp) return true;
    for (const id of [...tp.batchIds].reverse()) {
      const row = db(tp.sirket)?.get("SELECT id FROM wa_jobs WHERE batch_id = ? AND account_id = ? ORDER BY rowid DESC LIMIT 1", id, bilgi.accountId);
      if (row) return row.id === isId;
    }
    return true;
  }
  function programIsDurumu(isId) {
    for (const s of sirketler) {
      const row = db(s)?.get("SELECT state FROM wa_jobs WHERE id = ?", isId);
      if (row) return row.state;
    }
    return null;
  }
  async function metaKapat(kapali) {
    if (kapali === metaKapali) return;
    metaKapali = kapali;
    // Kâhinde Meta'ya ulaşılamayan süre sanal dakikalardır; gerçek zamanda programın HTTP havuzundaki boştaki bağlantının kapandığını görmesine fırsat verilir
    // (gerçek kesintide yeniden deneme dakikalar sonra, havuzun 4 sn'lik boşta tutma süresi geçmiş olur → yeni bağlantı reddedilir).
    if (kapali) {
      await kapatSunucu(vekil);
      await new Promise(r => setTimeout(r, 100));
    } else vekilPort = await dinle(vekil, vekilPort);
  }

  // ---- kanca planı (kâhinin meta_davranis.kanca'sı; olay zamanı = Meta'nın kabul anı + öteleme) ----
  function kancaPlanla(onceSayi) {
    const yeni = meta.meta.mesajlar.slice(onceSayi);
    for (const m of yeni) {
      const bilgi = m.opaque ? isBilgisi(m.opaque) : null;
      const anahtar = isAnahtari(bilgi);
      if (!anahtar) {
        notlar.push(`Meta'daki ileti bir işe eşlenemedi (${m.opaque})`);
        continue;
      }
      const cari = anahtar.split("/")[1];
      const n = (isMetaSayisi.get(anahtar) || 0) + 1;
      isMetaSayisi.set(anahtar, n);
      const plan = davranis.kanca || {};
      let liste = plan[cari] ?? plan["*"] ?? [];
      if (!Array.isArray(liste)) liste = liste[String(n)] ?? liste["*"] ?? [];
      for (const k of liste) {
        const ek = k[2] || {};
        const olayT = zaman(k[1], m.kabulT);
        const varis = ek.varis ? zaman(ek.varis, m.kabulT) : olayT;
        kancalar.push({ t: varis, olayT, wamid: m.wamid, durum: k[0], kod: ek.kod ?? null, tekrar: Number(ek.tekrar || 1), sira: ++kancaSira });
      }
    }
    kancalar.sort((a, b) => a.t - b.t || a.sira - b.sira);
  }

  // ---- ALICI (kapıcının yerine) ----
  const imzaGecerli = (ham, baslik) => {
    if (typeof baslik !== "string" || !baslik.startsWith("sha256=")) return false;
    const beklenen = Buffer.from(`sha256=${createHmac("sha256", UYGULAMA.sir).update(ham).digest("hex")}`);
    const gelen = Buffer.from(baslik);
    return beklenen.length === gelen.length && timingSafeEqual(beklenen, gelen);
  };
  const kancaKaydi = [];
  async function aliciIsle(req, res) {
    const ham = await govdeOku(req);
    if (!req.url.startsWith("/wa/kanca/")) {
      kancaKaydi.push({ t: simdi, yol: req.url, http: 404, not: "kanca adresi programın kaydettiği adres değil" });
      res.writeHead(404);
      return void res.end();
    }
    if (!program || !tunelAcik) {
      // Kapıcı: ofisin tüneli yok → 503 (Meta 7 gün yeniden dener; plan §3 C).
      kancaKaydi.push({ t: simdi, http: 503, neden: !program ? "program kapalı" : "tünel kapalı" });
      res.writeHead(503);
      return void res.end();
    }
    const imzali = imzaGecerli(ham, req.headers["x-hub-signature-256"]);
    const isaret = secenek.kip === "yol1" ? "wa0" : imzali ? "wa1" : "wa0";
    const yanit = await ilet({ port: program.uzakPort, method: req.method, yol: req.url, headers: { "content-type": "application/json", "x-surucu-isaret": isaret }, govde: ham });
    let wamidler = [];
    try {
      wamidler = JSON.parse(ham.toString("utf8")).entry.flatMap(e => e.changes || []).flatMap(c => c.value?.statuses || []).filter(st => st.biz_opaque_callback_data).map(st => String(st.id));
    } catch {
      wamidler = [];
    }
    kancaKaydi.push({ t: simdi, http: yanit.ok ? yanit.status : 0, isaret, wamidler });
    res.writeHead(yanit.ok ? yanit.status : 502);
    res.end(yanit.ok ? yanit.body : undefined);
  }

  // ---- programı aç / kapat ----
  async function programAc() {
    const server = await startTestServer({
      dataDir,
      backupDir,
      now: { time: simdi, fixed: true },
      whatsappGraphUrl: vekilAdresi,
      whatsappTimeoutMs: 1500,
      whatsappGapMs: 0,
      mobileRemoteUrl: ofisAdresi,
      maxCompanies: 2,
      env: { HUKUK_LICENSE_URL: "http://127.0.0.1:9" },
    });
    const app = server.app;
    // Kapıcı işareti: alıcı (kapıcının yerine) başlıkla iletir; başlıksız (tüneli atlatan) istek reddedilir.
    app.mobileSync.kancaIsareti = req => {
      const v = req.headers["x-surucu-isaret"];
      delete req.headers["x-surucu-isaret"];
      if (v !== "wa0" && v !== "wa1") return { ok: false };
      return { ok: true, signed: v === "wa1" };
    };
    // Lisansın dış durumu (salt okunur / yazılabilir).
    const asilAssert = app.license.assertWritable.bind(app.license);
    app.license.writable = () => lisansYazilabilir;
    app.license.assertWritable = (method, pathname) => {
      if (lisansYazilabilir || method === "GET" || method === "HEAD" || /^\/api\/(auth|license)\//.test(String(pathname || ""))) return asilAssert(method, pathname);
      throw new HttpError(403, "Lisans geçerli değil. Program salt okunur çalışıyor; bu işlem yapılamaz.", { code: "LICENSE_READ_ONLY" });
    };
    const asilStatus = app.license.status.bind(app.license);
    app.license.status = () => ({ ...asilStatus(), writable: lisansYazilabilir });
    const uzak = await app.listenRemote(0, "127.0.0.1");
    const admin = createClient(server.base);
    const giris = await admin.login("admin", ADMIN_PASSWORD);
    if (giris.status !== 200) throw new Error(`yönetici girişi: ${giris.status}`);
    program = { server, admin, istemciler: { yonetici: admin }, uzakPort: uzak.port };
    for (const [ad, yetki] of Object.entries(kullanicilar)) {
      if (ad === "yonetici") continue;
      const c = createClient(server.base);
      const r = await c.login(ad, "Surucu-T1-2026!");
      if (r.status === 200) program.istemciler[ad] = c;
      else program.istemciler[ad] = null;
      void yetki;
    }
    return program;
  }
  async function programKapat() {
    if (!program) return;
    try {
      await kapanisOncesi?.();
    } catch (error) {
      notlar.push(`kapanış öncesi okuma: ${error.message}`);
    }
    dbKapat();
    const p = program;
    program = null;
    await p.server.close();
  }
  // Ayıklama dökümü (--dokum): olaylar başladıktan sonra sürücünün programa yaptığı her istek ve yanıtı (ham).
  let apiKaydi = null;
  const api = async (istemci, yontem, url, govde) => {
    const r = await (yontem === "GET" ? istemci.get(url) : yontem === "DELETE" ? istemci.del(url) : yontem === "PUT" ? istemci.put(url, govde) : istemci.post(url, govde));
    if (apiKaydi && !(yontem === "GET" && /\/whatsapp\/batches\/[^/?]+$/.test(url))) {
      apiKaydi.push({ t: trIso(simdi), yontem, url, govde: govde ?? null, status: r.status, yanit: JSON.stringify(r.data ?? null).slice(0, 4000) });
    }
    return r;
  };
  // S-12 (BAŞ MİMAR KARARI, test altyapısı; EŞLEME BELİRSİZ 1 kapandı): "kabul" (README §2: programın bildiği kabul) şirket dosyasından DEĞİL, telin iki ucundaki
  // bağımsız kayıttan sayılır: (A) Meta'nın 200 + wamid yanıtı programın bağlantısına GERÇEKTEN yazıldı (vekil; sahte Meta'nın kendi kaydı çökme anında da 200 yazar ama yanıt
  // programa gitmez — bu yüzden sahte Meta kaydı tek başına yetmez), (B) yanıtı programa ulaşmamış ama Meta'da bulunan iletinin İMZALI, iş kimliği taşıyan durum bildirimi
  // programa ulaştı ve program 200 dedi (alıcı kaydı; §7a 3 "yalnız imzalı olay + iş kimliğiyle çözülür"). İş kimliği isteğin / iletinin biz_opaque_callback_data'sı.
  // Sahte Meta dosyaları değişmedi (yalnız kayit() okunur).
  function kabulHaritasi(kayit) {
    const harita = new Map();
    let toplam = 0;
    const say = isId => {
      toplam += 1;
      if (isId) harita.set(isId, (harita.get(isId) || 0) + 1);
    };
    if (mut("S12-kabul-meta-iletisinden")) {
      for (const m of kayit.mesajlar) say(m.opaque);
      return { harita, toplam };
    }
    const yanitiGiden = new Set();
    for (const k of iletilenKabul) {
      yanitiGiden.add(k.wamid);
      say(k.is);
    }
    if (!mut("S12-kabul-kanca-cozumu-yok")) {
      const imzaliUlasan = new Set(kancaKaydi.filter(k => k.isaret === "wa1" && k.http === 200).flatMap(k => k.wamidler || []));
      for (const m of kayit.mesajlar) if (!yanitiGiden.has(String(m.wamid)) && imzaliUlasan.has(String(m.wamid))) say(m.opaque);
    }
    return { harita, toplam };
  }
  const sart = async (etiket, promise) => {
    const r = await promise;
    if (r.status !== 200) throw new Error(`${etiket}: ${r.status} ${JSON.stringify(r.data).slice(0, 400)}`);
    return r.data.data;
  };

  try {
    await programAc();
    const A = program.admin;
    // ---- şirketler ----
    for (const s of sirketler) {
      if (s === "A") continue;
      const c = await sart(`şirket ${s}`, api(A, "POST", "/api/companies", { name: firmalar[s] || `Şirket ${s}`, select: false }));
      sirketKimligi[s] = (c.company || c).id;
    }
    for (const s of sirketler) {
      await sart(`ofis ${s}`, api(A, "PUT", ekle("/api/admin/office", s), { name: firmalar[s] || "Deneme Ticaret Ltd. Şti." }));
      const w = wabalar[s] || "W1";
      if (ayar.bagli) {
        if (secenek.kip === "yol2" && s === "A") {
          const user = program.server.app.store.get("SELECT id, username, display_name, role FROM users WHERE username = 'admin'");
          program.server.app.context.whatsapp.connection.saveEmbedded(user, { token: TOKEN, wabaId: WABA_ID[w], phoneNumberId: PN_ID[w], olay: "FINISH", appId: UYGULAMA.id });
        } else await sart(`bağlantı ${s}`, api(A, "PUT", ekle("/api/workspace/whatsapp/connection", s), { phoneNumberId: PN_ID[w], wabaId: WABA_ID[w], appId: UYGULAMA.id, token: TOKEN }));
        await sart(`sına ${s}`, api(A, "POST", ekle("/api/workspace/whatsapp/connection/test", s), {}));
      }
      if (ayar.onay) {
        const r = await api(A, "PUT", ekle("/api/workspace/whatsapp/ack", s), { ack: true });
        if (r.status !== 200 && ayar.bagli) throw new Error(`onay ${s}: ${r.status} ${JSON.stringify(r.data)}`);
      }
      if (ayar.gunluk_ust_sinir) await sart(`sınır ${s}`, api(A, "PUT", ekle("/api/workspace/whatsapp/sending-settings", s), { dailyCap: ayar.gunluk_ust_sinir }));
    }
    // ---- kullanıcılar ----
    for (const [ad, yetki] of Object.entries(kullanicilar)) {
      if (ad === "yonetici") continue;
      const rol = ad === "muhasebe" ? "muhasebe" : "personel";
      await sart(`kullanıcı ${ad}`, api(A, "POST", "/api/admin/users", { username: ad, name: ad, role: rol, password: "Surucu-T1-2026!", mustChangePassword: false, grants: { add: yetki["whatsapp.send"] ? ["whatsapp.send"] : [], remove: [] } }));
      const c = createClient(program.server.base);
      const r = await c.login(ad, "Surucu-T1-2026!");
      if (r.status !== 200) throw new Error(`kullanıcı girişi ${ad}: ${r.status}`);
      program.istemciler[ad] = c;
    }
    // ---- cariler ----
    // Kurulumda "bugün" programın kendi yerel günüdür (süreç saat dilimi; programın ileri tarih denetimi bu günle yapılır). --tz Europe/Istanbul'da Türkiye
    // günüyle aynı; --tz UTC'de gece 00:00–03:00 (TR) arasında bir gün geride (sürücü düzeltmesi: önceki sürüm Türkiye gününü kullanıyordu, UTC'de ICERIK-03
    // kurulumu "İleri tarihli hareket girilemez" ile düşüyordu).
    const bugun = () => {
      const d = new Date(simdi);
      return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
    };
    async function hareketYaz(cid, h) {
      const p = cariProgram[cid];
      const tutar = Number(h.borc || 0) > 0 ? h.borc : h.alacak;
      const tur = Number(h.borc || 0) > 0 ? "debt" : "credit";
      if (!(Number(tutar) > 0)) return;
      let geri = null;
      if (h.tarih > bugun()) {
        // İleri tarihli hareket bugün girilemez (program kuralı): saat o güne alınıp girilir, sonra geri döner (eski kayıt gibi).
        geri = simdi;
        program.server.clock.set(Date.parse(`${h.tarih}T12:00:00+03:00`));
        notlar.push(`ileri tarihli hareket ${cid} ${h.tarih}: saat o güne alınarak girildi`);
      }
      try {
        // Tutar SAYI olarak (kâhin girdisi sayı ya da "0.005" gibi noktalı dizgi; dizgi gönderilirse program Türkçe binlik sanır: "0.005" → 5).
        await sart(`hareket ${cid}`, api(A, "POST", ekle(`/api/workspace/accounts/${p.id}/entries`, p.sirket), { kind: tur, amount: Number(tutar), date: h.tarih, note: "Sürücü" }));
      } finally {
        if (geri !== null) program.server.clock.set(geri);
      }
    }
    async function vadeleriKur(cid, vadeler) {
      const p = cariProgram[cid];
      for (const id of planlar[cid] || []) await sart(`kart sil ${cid}`, api(A, "DELETE", ekle(`/api/workspace/plans/${id}`, p.sirket)));
      planlar[cid] = [];
      const acik = (vadeler || []).filter(v => Number(v.kalan) > 0);
      if (!acik.length) return;
      const toplam = acik.reduce((s, v) => s + Number(v.kalan), 0);
      const kayit = [...acik.map(v => v.vade), bugun()].sort()[0];
      const plan = await sart(`kart ${cid}`, api(A, "POST", ekle("/api/workspace/plans", p.sirket), { accountId: p.id, name: p.ad.slice(0, 160), total: Number(toplam.toFixed(2)), coversBalance: true, registeredOn: kayit }));
      planlar[cid] = [plan.id];
      for (const v of acik) await sart(`taksit ${cid}`, api(A, "POST", ekle(`/api/workspace/plans/${plan.id}/items`, p.sirket), { dueDate: v.vade, amount: Number(v.kalan) }));
    }
    for (const c of g.cariler) {
      const s = c.sirket || "A";
      const govde = { name: c.ad, ...(c.telefon !== null && c.telefon !== undefined ? { phone: c.telefon } : {}) };
      let yanit = await api(A, "POST", ekle("/api/workspace/accounts", s), govde);
      if (yanit.status === 400 && String(c.ad).length > 160) {
        // Program cari adını 160 karakterle sınırlar (Ad / Unvan): kâhinin 305 karakterlik adı girilemez → GİRDİ UYARLAMASI (notta), ilk 160 karakterle sürer.
        notlar.push(`GİRDİ UYARLAMASI: ${c.id} adı ${String(c.ad).length} karakter, program 160'ta reddetti (${yanit.data?.error}); ilk 160 karakterle girildi`);
        yanit = await api(A, "POST", ekle("/api/workspace/accounts", s), { ...govde, name: String(c.ad).slice(0, 160) });
      }
      if (yanit.status !== 200) throw new Error(`cari ${c.id}: ${yanit.status} ${JSON.stringify(yanit.data).slice(0, 300)}`);
      const r = yanit.data.data;
      cariProgram[c.id] = { id: r.id, sirket: s, ad: c.ad };
      programCari[r.id] = c.id;
      for (const h of c.hareketler || []) await hareketYaz(c.id, h);
      if (c.vadeler?.length) await vadeleriKur(c.id, c.vadeler);
      if (c.istemiyor) await sart(`istemiyor ${c.id}`, api(A, "PUT", ekle(`/api/workspace/accounts/${r.id}`, s), { waOptOut: true }));
      if (c.pasif) await sart(`pasif ${c.id}`, api(A, "PUT", ekle(`/api/workspace/accounts/${r.id}`, s), { status: "passive" }));
      if (c.silindi) await sart(`sil ${c.id}`, api(A, "DELETE", ekle(`/api/workspace/accounts/${r.id}`, s)));
    }
    // Bakım turu: durum bildirimi adresi Meta'ya kaydedilir (program kendisi; plan §3 C).
    await program.server.app.whatsapp.scheduler.maintain();
    lisansYazilabilir = ayar.lisans_yazilabilir;
    for (const w of wabaEtiketleri) {
      const kanca = meta.meta.kancaAdresi(PN_ID[w]);
      if (!kanca || !kanca.includes("/wa/kanca/")) {
        notlar.push(`UYARI: ${w} için programın kanca kaydı Meta'da yok (${kanca})`);
        continue;
      }
      // Tanı: Meta'daki (WABA başına TEK) kanca adresinin gizli yolu hangi şirketin kaydı? Aynı WABA'yı kullanan öbür şirketin bildirimleri bu şirkete gider.
      const gizli = kanca.split("/wa/kanca/")[1];
      const karma = createHash("sha256").update(String(gizli)).digest("hex");
      const sahipler = [];
      for (const s of sirketler.filter(x => (wabalar[x] || "W1") === w)) {
        const row = db(s)?.get("SELECT value FROM settings WHERE key = 'whatsapp.meta'");
        let hook = null;
        try {
          hook = JSON.parse(row?.value || "null")?.hook || null;
        } catch {
          hook = null;
        }
        sahipler.push(`${s}:${hook?.pathHash === karma ? "SAHİP" : hook ? "başka yol" : "kayıt yok"}`);
      }
      // Programın sonraki sürümü kanca kaydını makine defterinde WABA başına tutar (ledger.hookOf); yalnız tanı.
      const defterKanca = program.server.app.whatsapp.ledger?.hookOf?.(WABA_ID[w]) || null;
      if (defterKanca) sahipler.push(`defter:${defterKanca.pathHash === karma ? "SAHİP" : "başka yol"} (${defterKanca.state})`);
      notlar.push(`KANCA ${w}: Meta'daki adres → ${sahipler.join(", ")}`);
    }

    // ---- olaylar ----
    if (secenek.dokum) apiKaydi = [];
    const olaylar = [];
    g.olaylar.forEach((o, i) => {
      if (o.tur === "cokme") return;
      olaylar.push({ t: zaman(o.t, T0), i, o });
    });
    const siradaki = () => olaylar.filter(x => x.t !== null).sort((a, b) => a.t - b.t || a.i - b.i);

    async function baslat(o) {
      const s = o.sirket || "A";
      const kul = o.kullanici || "yonetici";
      const istemci = program.istemciler[kul] || program.admin;
      const sablon = o.sablon || "ekstre";
      const ids = (o.secim || []).map(cid => cariProgram[cid]?.id).filter(Boolean);
      const govde = { kind: sablon === "hatirlatma" ? "reminder" : "statement", ids };
      if (sablon !== "hatirlatma") {
        if (!o.donem || o.donem === "tum") govde.preset = "all";
        else if (o.donem.secim !== undefined) {
          // S-2: hazır dönem seçimi programın preset'iyle (dönemi program çözer; sürücü tarih hesaplamaz).
          let secim = o.donem.secim;
          if (mut("S2-bu-ay-gecen-ay-takas")) secim = secim === "bu_ay" ? "gecen_ay" : secim === "gecen_ay" ? "bu_ay" : secim;
          if (mut("S2-son-3-ay-tum") && secim === "son_3_ay") secim = "tum";
          const preset = HAZIR_DONEM[secim];
          if (!preset) throw new Error(`sürücü bu hazır dönemi bilmiyor: ${JSON.stringify(o.donem)}`);
          if (o.donem.bas !== undefined || o.donem.son !== undefined) throw new Error(`EŞLEME BELİRSİZ: hazır seçim ile tarih aralığı birlikte (${JSON.stringify(o.donem)})`);
          govde.preset = preset;
          cevir(`dönem ${o.donem.secim}→${preset}`);
        } else Object.assign(govde, { from: o.donem.bas, to: o.donem.son });
      }
      if (o.istek !== undefined && o.istek !== null) govde.requestId = (istekKimlikleri[o.istek] ||= `istek-${String(o.istek).replace(/[^A-Za-z0-9_-]/g, "_")}-000`);
      if (o.onceki === "gonder") govde.sendAgain = true;
      const r = await api(istemci, "POST", ekle("/api/workspace/whatsapp/batches", s), govde);
      const ozet = r.data?.data?.summary || r.data?.summary || null;
      const elenenler = {};
      for (const kisi of ozet?.people || []) if (kisi.skip) elenenler[programCari[kisi.id] || kisi.id] = atlamaKodu(kisi.skip, "baslat");
      if (Object.keys(elenenler).length) sonuc.elenen[o.etiket] = elenenler;
      if (ozet?.alreadySent?.count) sonuc.onceki_uyari[o.etiket] = { sayi: ozet.alreadySent.count, son: ozet.alreadySent.last ? trGun(Date.parse(ozet.alreadySent.last)) : null };
      if (r.status === 200) {
        const batch = r.data.data.batch;
        if (r.data.data.reused) {
          sonuc.ayni_istek[o.etiket] = batchEtiket[batch.id] || batch.id;
          return;
        }
        batchEtiket[batch.id] = o.etiket;
        toplular[o.etiket] = { sirket: s, batchIds: [batch.id], ilk: batch.id };
        elenenToplu[o.etiket] = new Set((ozet?.people || []).filter(k => k.skip).map(k => k.id));
        return;
      }
      const kod = r.data?.code || "";
      if (kod === "whatsapp-nothing") return void sonuc.olusmadi.push(o.etiket);
      const neden = kod === "whatsapp-not-configured" ? "bagli_degil"
        : kod === "FORBIDDEN" ? "yetki_yok"
          : kod === "LICENSE_READ_ONLY" ? "lisans_salt_okunur"
            : kod === "whatsapp-ack-required" ? "onay_yok"
              : /^whatsapp-template-/.test(kod) ? "sablon_uygun_degil"
                : `?${r.status} ${kod}`;
      sonuc.baslamadi[o.etiket] = neden;
    }
    async function toplulariOku() {
      const out = {};
      for (const [etiket, tp] of Object.entries(toplular)) {
        const ayrinti = [];
        for (const id of tp.batchIds) {
          const d = await sart(`toplu ${etiket}`, api(program.admin, "GET", ekle(`/api/workspace/whatsapp/batches/${id}`, tp.sirket)));
          ayrinti.push(d);
        }
        out[etiket] = ayrinti;
      }
      return out;
    }
    // S-5: geri yüklemeden sonra yedekten SONRA açılmış toplu işler şirket dosyasında yoktur (programın ayrıntı ucu 404): izlenen listeden çıkarılır (adıyla notta).
    // Program 404 dışında bir yanıt verirse sürücü durur (okunamayan veri boş sayılmaz, ders 4).
    async function dosyadakiTopluIsler(neden) {
      for (const [etiket, tp] of Object.entries(toplular)) {
        const kalan = [];
        for (const id of tp.batchIds) {
          const r = await api(program.admin, "GET", ekle(`/api/workspace/whatsapp/batches/${id}`, tp.sirket));
          if (r.status === 200) kalan.push(id);
          else if (r.status === 404) notlar.push(`${neden}: ${etiket} toplu işi (${id}) şirket dosyasında yok`);
          else throw new Error(`${neden}: ${etiket} toplu işi okunamadı: ${r.status} ${JSON.stringify(r.data).slice(0, 200)}`);
        }
        if (kalan.length) tp.batchIds = kalan;
        else delete toplular[etiket];
      }
    }
    // S-3 / S-4: Başarısızları Yeniden Dene / Yine de Gönder yanıtı → kâhinin yeniden.<etiket> = { elenen: {cari: neden}, alinan: [cari], oneri }.
    // 200: yeni toplu işin özeti (kişiler ve eleme nedenleri); 400 "Gönderilebilecek kişi yok": hata gövdesindeki özet + İLETİ. Öneri = iletinin "sonucu belirsiz"
    // cümlesinde gösterilen yol (K6: işteki Yine de Gönder / yeni gönderim); iki yol birden yazılıysa ikisi "+" ile (kâhinin "yalnız" kuralı görünsün); 200'de ileti yok → null.
    // Alt çizgili alanlar (_http, _kod, _ileti) yalnız tanı içindir; kâhin karşılaştırıcısı beklenende olmayan alana bakmaz.
    function oneriOku(ileti) {
      const belirsiz = String(ileti || "").split(/(?<=[.!?])\s+/).filter(c => /sonucu belirsiz/i.test(c));
      const yollar = [];
      if (belirsiz.some(c => /işteki\s+"?Yine de Gönder/.test(c))) yollar.push("isteki_yine_de_gonder");
      if (belirsiz.some(c => /yeni gönderim başlatın/.test(c))) yollar.push("yeni_gonderim");
      if (mut("S3-oneri-takas")) return yollar.length ? yollar.map(y => (y === "yeni_gonderim" ? "isteki_yine_de_gonder" : "yeni_gonderim")).join("+") : null;
      return yollar.length ? yollar.join("+") : null;
    }
    function yenidenOku(r, yer = "yeniden") {
      const govde = r.data || {};
      const ozet = r.status === 200 ? govde.data?.summary || null : govde.summary || null;
      const elenen = {};
      const alinan = [];
      for (const kisi of ozet?.people || []) {
        const cid = programCari[kisi.id] || `?${kisi.id}`;
        if (kisi.skip && !mut("S3-alinan-elenenleri-de-sayar")) elenen[cid] = atlamaKodu(kisi.skip, yer);
        else alinan.push(cid);
      }
      const ileti = r.status === 200 ? "" : String(govde.error || "");
      return { elenen: mut("S3-elenen-okunmaz") ? {} : elenen, alinan, oneri: oneriOku(ileti), _http: r.status, _kod: govde.code || null, ...(ileti ? { _ileti: ileti } : {}), ...(ozet ? {} : { _ozet: "yanıtta özet yok" }) };
    }
    let sonOkuma = null; // program kapalıyken son okunan hâl
    kapanisOncesi = async () => {
      if (Object.keys(toplular).length) sonOkuma = await toplulariOku();
    };
    async function goruntu() {
      if (!program) return sonOkuma;
      sonOkuma = await toplulariOku();
      return sonOkuma;
    }
    const isDurumu = (job, batch) => {
      if (job.state === "paused" && batch.pauseCode === "license") return cevir("Duraklatıldı→Lisans Nedeniyle Durdu"), "Lisans Nedeniyle Durdu";
      if (job.state === "paused" && batch.pauseCode === "stale") return cevir(`Duraklatıldı→${SORULUYOR}`), SORULUYOR;
      if (job.state === "stopped" && batch.pauseCode === "moved") return cevir("Durduruldu→Taşınan Veri — Durduruldu"), "Taşınan Veri — Durduruldu";
      if (job.state === "stopped" && batch.pauseCode === "restored") return cevir("Durduruldu→Durduruldu (Geri Yükleme)"), "Durduruldu (Geri Yükleme)";
      return job.stateLabel;
    };
    // Kâhin anahtarı → [{ job, batch }] (Yine de Gönder / Başarısızları Yeniden Dene programda YENİ toplu iş açar; aynı cari aynı anahtara bağlanır).
    function isleriTopla(okuma) {
      const out = new Map();
      for (const [etiket, liste] of Object.entries(okuma || {})) {
        const elenen = elenenToplu[etiket] || new Set();
        liste.forEach((batch, bi) => {
          for (const job of batch.jobs) {
            if (bi === 0 && elenen.has(job.accountId)) continue; // başlatmada elendi: iş değil
            if (bi > 0 && job.state === "skipped" && !job.attempt && !job.params?.length && !job.acceptedAt) continue; // yeni toplu işte başlatmada elenen
            const anahtar = `${etiket}/${programCari[job.accountId] || job.accountId}`;
            if (!out.has(anahtar)) out.set(anahtar, []);
            out.get(anahtar).push({ job, batch });
          }
        });
      }
      return out;
    }
    function topluDurum(liste) {
      const ana = liste[0];
      const durumOf = b => (b.state === "running" && b.pauseCode === "offline" ? "baglanti_bekleniyor" : b.state === "running" || b.state === "done" ? "aktif" : b.state === "paused" ? "duraklatildi" : b.state === "canceled" ? "iptal" : b.state === "stopped" ? "durduruldu" : b.state);
      // Bağlı yeni toplu işlerden süreni/duranı öne alınır (kâhinde tek toplu iş).
      let secilen = ana;
      for (const b of liste.slice(1)) if (["paused", "running"].includes(b.state) && !(b.state === "running" && !b.pauseCode)) secilen = b;
      const durum = durumOf(secilen);
      let neden = null;
      if (durum === "duraklatildi" || durum === "baglanti_bekleniyor" || durum === "durduruldu") {
        const kod = secilen.pauseCode || "";
        if (kod === "user") neden = "kullanici";
        else if (kod === "template-marketing") neden = "Şablon Pazarlama'ya Alındı";
        else if (kod === "offline") neden = "Bağlantı Bekleniyor";
        else {
          const m = /#(\d+)|\(Meta hata kodu (\d+)\)|kod[uı]? (\d+)/.exec(secilen.pauseReason || "");
          const sonHata = [...secilen.jobs].filter(j => Number.isFinite(j.errorCode)).sort((a, b) => String(a.failedAt || "").localeCompare(String(b.failedAt || ""))).at(-1)?.errorCode;
          neden = m ? Number(m[1] || m[2] || m[3]) : Number.isFinite(sonHata) ? sonHata : kod || null;
          if (/^meta-unreachable$/.test(kod) && Number.isFinite(sonHata)) neden = sonHata;
          if (["license", "stale", "restored", "moved", "connection", "token"].includes(kod)) neden = kod;
        }
      }
      return { durum, neden };
    }
    async function kontrolYaz(o) {
      const okuma = await goruntu();
      const isler = isleriTopla(okuma);
      const durumlar = {};
      const isDurumlari = {};
      for (const [anahtar, liste] of isler) {
        const son = liste.at(-1);
        const d = isDurumu(son.job, son.batch);
        isDurumlari[anahtar] = d;
        durumlar[d] = (durumlar[d] || 0) + 1;
      }
      const kayit = meta.kayit();
      const pencere = {};
      for (const w of [...new Set(Object.values(wabalar))].sort()) {
        let n = 0;
        try {
          n = program ? program.server.app.whatsapp.ledger.windowUsage(WABA_ID[w], new Date(simdi - GUN).toISOString()).count : defterPencere(WABA_ID[w], new Date(simdi - GUN).toISOString());
        } catch {
          n = null;
        }
        pencere[w] = n;
      }
      const k = {
        t: trIso(simdi),
        durum_sayilari: Object.fromEntries(Object.entries(durumlar).sort(([a], [b]) => (a < b ? -1 : 1))),
        toplam_post: kayit.sayilar.toplamMesajIstegi,
        toplam_kabul: mut("S12-kabul-dosyadan") ? [...isler.values()].flat().filter(x => x.job.wamid).length : kabulHaritasi(kayit).toplam,
        pencere_farkli_alici: pencere,
        medya_silme: kayit.sayilar.medyaSilme,
        toplular: Object.fromEntries(Object.keys(okuma || {}).map(e => [e, topluDurum(okuma[e]).durum])),
        _toplu_neden: Object.fromEntries(Object.keys(okuma || {}).map(e => [e, topluDurum(okuma[e]).neden])),
      };
      if (!g.ozet_cikti) k.isler = Object.fromEntries([...Object.entries(isDurumlari)].sort(([a], [b]) => (a < b ? -1 : 1)));
      sonuc.kontroller[o.ad] = k;
    }
    function programIsi(etiket, cid) {
      const tp = toplular[etiket];
      if (!tp || !program) return null;
      for (const id of [...tp.batchIds].reverse()) {
        const row = db(tp.sirket)?.get("SELECT id, state, wamid FROM wa_jobs WHERE batch_id = ? AND account_id = ? ORDER BY rowid DESC LIMIT 1", id, cariProgram[cid]?.id);
        if (row) return row;
      }
      return null;
    }
    async function olayIsle(o) {
      const tur = o.tur;
      if (tur === "baslat") return baslat(o);
      if (tur === "kapat") return programKapat();
      if (tur === "ac") {
        if (cokmeKopyasi) {
          // Çökmeden sonra açılış: diskin çökme anındaki hâli.
          fs.rmSync(dataDir, { recursive: true, force: true });
          fs.renameSync(cokmeKopyasi, dataDir);
          cokmeKopyasi = null;
        }
        await programAc();
            return;
      }
      if (tur === "tunel") return void (tunelAcik = o.acik);
      if (tur === "kanca_kuyrugu") {
        meta.saat(simdi);
        await meta.kuyruguIsle({ hepsi: true });
        return;
      }
      if (tur === "lisans") return void (lisansYazilabilir = o.yazilabilir);
      if (tur === "meta_kapali") return metaKapat(o.kapali);
      if (tur === "meta_basamak") {
        for (const n of meta.meta.numaralar.values()) n.basamak = BASAMAK_ADI[o.basamak] || `TIER_${o.basamak}`;
        return;
      }
      if (tur === "meta_sablon") {
        sablonDurum[o.ad] = { ...(sablonDurum[o.ad] || {}), ...(o.durum !== undefined ? { durum: o.durum } : {}), ...(o.kategori !== undefined ? { kategori: o.kategori } : {}) };
        for (const s of meta.meta.sablonlar.filter(x => x.name === o.ad && !x.silindi)) {
          if (o.durum) s.status = o.durum;
          if (o.durum === null) s.silindi = true;
          if (o.kategori) s.category = o.kategori;
        }
        return;
      }
      if (tur === "cari") {
        const p = cariProgram[o.id];
        if (o.telefon !== undefined) await sart(`telefon ${o.id}`, api(program.admin, "PUT", ekle(`/api/workspace/accounts/${p.id}`, p.sirket), { phone: o.telefon ?? "" }));
        if (o.ad !== undefined) await sart(`ad ${o.id}`, api(program.admin, "PUT", ekle(`/api/workspace/accounts/${p.id}`, p.sirket), { name: o.ad }));
        if (o.istemiyor !== undefined) await sart(`istemiyor ${o.id}`, api(program.admin, "PUT", ekle(`/api/workspace/accounts/${p.id}`, p.sirket), { waOptOut: Boolean(o.istemiyor) }));
        if (o.pasif !== undefined) await sart(`pasif ${o.id}`, api(program.admin, "PUT", ekle(`/api/workspace/accounts/${p.id}`, p.sirket), { status: o.pasif ? "passive" : "active" }));
        if (o.silindi) await sart(`sil ${o.id}`, api(program.admin, "DELETE", ekle(`/api/workspace/accounts/${p.id}`, p.sirket)));
        if (o.hareket_ekle) await hareketYaz(o.id, o.hareket_ekle);
        if (o.vadeler !== undefined) await vadeleriKur(o.id, o.vadeler);
        return;
      }
      if (tur === "devam" || tur === "duraklat" || tur === "iptal") {
        const tp = toplular[o.toplu];
        const eylem = tur === "devam" ? "resume" : tur === "duraklat" ? "pause" : "cancel";
        for (const id of tp.batchIds) {
          const d = await sart("toplu", api(program.admin, "GET", ekle(`/api/workspace/whatsapp/batches/${id}`, tp.sirket)));
          const uygun = eylem === "resume" ? d.state === "paused" : ["running", "paused"].includes(d.state);
          if (!uygun) continue;
          const r = await api(program.admin, "POST", ekle(`/api/workspace/whatsapp/batches/${id}/${eylem}`, tp.sirket), {});
          if (r.status !== 200) notlar.push(`${tur} ${o.toplu}: ${r.status} ${r.data?.code || ""} ${r.data?.error || ""}`);
        }
        return;
      }
      if (tur === "basarisizlari_yeniden_dene") {
        const tp = toplular[o.toplu];
        if (!tp) throw new Error(`Başarısızları Yeniden Dene: ${o.toplu} toplu işi izlenmiyor`);
        // S-3: hedef "asil" → asıl (ilk) toplu iş; hedefsiz → son toplu iş (önceki eşleme; ekranda en son açılan gönderim).
        if (o.hedef !== undefined && o.hedef !== "asil") throw new Error(`sürücü bu yeniden deneme hedefini bilmiyor: ${o.hedef}`);
        const hedefId = o.hedef === "asil" && !mut("S3-hedef-yok-sayilir") ? tp.batchIds[0] : tp.batchIds.at(-1);
        const r = await api(program.admin, "POST", ekle(`/api/workspace/whatsapp/batches/${hedefId}/retry-failed`, tp.sirket), {});
        if (r.status === 200 && r.data.data.batch) {
          tp.batchIds.push(r.data.data.batch.id);
          batchEtiket[r.data.data.batch.id] = o.toplu;
        } else notlar.push(`Başarısızları Yeniden Dene ${o.etiket || ""}: ${r.status} ${r.data?.code || ""} ${r.data?.error || ""}`);
        if (o.etiket && !(mut("S3-ret-yaniti-okunmaz") && r.status !== 200)) sonuc.yeniden[o.etiket] = yenidenOku(r);
        return;
      }
      if (tur === "yine_de_gonder") {
        const tp = toplular[o.toplu];
        const is = tp ? programIsi(o.toplu, o.cari) : null;
        // Ekranda "Yine de Gönder" iki kez gidebilir onayından sonra confirm: true ile gider (hof-whatsapp-api.js sendAnyway).
        const r = is ? await api(program.admin, "POST", ekle(`/api/workspace/whatsapp/jobs/${is.id}/send-anyway`, tp.sirket), { confirm: !mut("S4-onaysiz-yine-de-gonder") }) : { status: 0, data: { code: "iş yok" } };
        if (r.status === 200 && r.data.data.batch) {
          tp.batchIds.push(r.data.data.batch.id);
          batchEtiket[r.data.data.batch.id] = o.toplu;
        } else notlar.push(`Yine de Gönder ${o.toplu}/${o.cari}: ${r.status} ${r.data?.code || ""} ${r.data?.error || ""}`);
        if (o.etiket) sonuc.yeniden[o.etiket] = r.status === 0 ? { elenen: {}, alinan: [], oneri: null, _http: 0, _kod: "iş yok" } : yenidenOku(r, "yine");
        return;
      }
      if (tur === "yedek_al") {
        // S-5: adlı yedek (Yönetim → Yedekler → bu şirketin yedeği); geri_yukle {yedek} bu dosyaya döner.
        const s = o.sirket || "A";
        const yedek = await sart(`yedek ${o.ad}`, api(program.admin, "POST", "/api/admin/backups", { scope: "one", companyId: sirketKimligi[s] }));
        yedekler[o.ad] = { ad: yedek.backups[0].name, sirket: s };
        return;
      }
      if (tur === "geri_yukle" || tur === "sifirla") {
        let ad;
        if (o.yedek !== undefined && !mut("S5-yedek-yok-sayilir")) {
          if (!yedekler[o.yedek]) throw new Error(`geri yükle: ${o.yedek} adlı yedek alınmamış`);
          if (yedekler[o.yedek].sirket !== "A") throw new Error("EŞLEME BELİRSİZ: A dışındaki şirketin yedeğine dönüş (sürücü yalnız 001'i geri yükler)");
          ad = yedekler[o.yedek].ad;
        } else {
          // Yedek adı yoksa (eski senaryolar): o an yedek alınıp hemen dönülür (önceki eşleme).
          const yedek = await sart("yedek", api(program.admin, "POST", "/api/admin/backups", { scope: "one", companyId: "sirket-001" }));
          ad = yedek.backups[0].name;
        }
        const r = await sart("geri yükle", api(program.admin, "POST", "/api/admin/backups/restore", { name: ad, company: "sirket-001", confirm: "001", password: ADMIN_PASSWORD }));
        if (r.staged) {
          await programKapat();
          await programAc();
        }
        await dosyadakiTopluIsler(`GERİ YÜKLEME (${o.yedek || "anlık yedek"})`);
        return;
      }
      if (tur === "liste") {
        // S-6: WhatsApp Gönderimleri (GET …/batches?limit=31&from&to&before). "devam" = o listenin Daha Fazla Göster'i: imleç ekrandaki son gönderim, süzgeç aynı.
        const onceki = o.devam !== undefined ? listeDurum[o.devam] : null;
        if (o.devam !== undefined && !onceki) throw new Error(`liste ${o.ad}: devam edilecek ${o.devam} listesi yok`);
        if (onceki && (o.bas !== undefined || o.son !== undefined)) throw new Error(`EŞLEME BELİRSİZ: liste ${o.ad} hem devam hem yeni süzgeç taşıyor`);
        const devral = onceki && !mut("S6-devam-suzgeci-devralmaz");
        const from = mut("S6-suzgec-gonderilmez") ? "" : devral ? onceki.from : o.bas || "";
        const to = mut("S6-suzgec-gonderilmez") ? "" : devral ? onceki.to : o.son || "";
        const boy = mut("S6-sayfa-31") ? SAYFA + 1 : SAYFA;
        const q = new URLSearchParams({ limit: String(boy + 1) });
        if (from) q.set("from", from);
        if (to) q.set("to", to);
        if (onceki?.ids.length && !mut("S6-imlec-gonderilmez")) q.set("before", onceki.ids.at(-1));
        const r = await api(program.admin, "GET", ekle(`/api/workspace/whatsapp/batches?${q}`, o.sirket || "A"));
        if (r.status === 200 && Array.isArray(r.data?.data)) {
          const gelen = r.data.data;
          const sayfa = gelen.slice(0, boy);
          listeDurum[o.ad] = { ids: [...(onceki?.ids || []), ...sayfa.map(b => b.id)], from, to };
          sonuc.listeler[o.ad] = { etiketler: sayfa.map(b => batchEtiket[b.id] || `?${b.id}`), daha_fazla: mut("S6-daha-fazla-hep-yok") ? false : gelen.length > boy };
        } else if (r.status === 400 && r.data?.field === "from" && /Bitiş tarihinden sonra olamaz/.test(String(r.data?.error || "")) && !mut("S6-ters-aralik-bos-liste")) {
          sonuc.listeler[o.ad] = { ret: "bas_son_ters", _ileti: r.data.error };
        } else if (mut("S6-ters-aralik-bos-liste") && r.status === 400) {
          sonuc.listeler[o.ad] = { etiketler: [], daha_fazla: false };
        } else sonuc.listeler[o.ad] = { ret: `?${r.status} ${r.data?.code || ""}`, _ileti: String(r.data?.error || "") };
        return;
      }
      if (tur === "tasindi") {
        // Veri başka bilgisayara taşındı: şirket verisi aynı, makine düzeyindeki gönderim defteri o bilgisayarda yok.
        await programKapat();
        for (const ad of fs.readdirSync(dataDir)) if (ad.startsWith("whatsapp-gonderim.sqlite")) fs.renameSync(path.join(dataDir, ad), path.join(kok, `eski-makine-${ad}`));
        await programAc();
            return;
      }
      if (tur === "sahte_kanca") {
        let wamid = o.wamid || "wamid.SAHTE";
        if (o.is) {
          const [etiket, cid] = o.is.split("/");
          wamid = programIsi(etiket, cid)?.wamid || wamid;
        }
        let opaque = o.opaque ?? null;
        if (opaque && opaque.includes("/")) {
          const [etiket, cid] = opaque.split("/");
          opaque = programIsi(etiket, cid)?.id || opaque;
        }
        const w = wabalar.A || "W1";
        const st = { id: wamid, status: o.durum, timestamp: String(Math.floor(simdi / 1000)), recipient_id: "905320000000" };
        if (opaque) st.biz_opaque_callback_data = opaque;
        if (o.durum === "failed") st.errors = [{ code: o.kod ?? 131000, title: "Sahte", message: "Sahte", error_data: { details: "Sahte" } }];
        const govde = durumGovdesi({ wabaId: WABA_ID[w], gorunenNumara: "902125550000", numaraKimligi: PN_ID[w], durumlar: [st] });
        meta.saat(simdi);
        await meta.meta.hamKancaGonder({ url: meta.meta.kancaAdresi(PN_ID[w]), govde, imzala: Boolean(o.imzali) });
        return;
      }
      throw new Error(`sürücü bu olayı bilmiyor: ${tur}`);
    }

    // ---- zaman döngüsü (kâhinin adim_isle sırası: olaylar → kancalar → bakım → işçi → kontroller) ----
    let bekleme = null; // programın bildirdiği bekleme (ms, mutlak)
    for (let tur = 0; tur < 5_000_000; tur += 1) {
      const ol = siradaki();
      for (const x of ol.filter(x => x.t <= simdi && x.o.tur !== "kontrol")) {
        olaylar.splice(olaylar.indexOf(x), 1);
        await olayIsle(x.o);
        if (cokme?.oldu && cokme.t !== null) for (const y of olaylar) if (y.t === null) y.t = zaman(y.o.t, T0, cokme.t);
      }
      while (kancalar.length && kancalar[0].t <= simdi) {
        const k = kancalar.shift();
        meta.saat(simdi);
        await meta.durumGonder({ wamid: k.wamid, durum: k.durum, hataKodu: k.kod ?? undefined, tekrar: k.tekrar, timestamp: Math.floor(k.olayT / 1000) });
      }
      let ilerledi = false;
      if (program) {
        program.server.clock.set(simdi);
        meta.saat(simdi);
        await program.server.app.whatsapp.scheduler.maintain();
        bekleme = null;
        for (let n = 0; n < 10_000; n += 1) {
          const once = simdi;
          let r;
          try {
            r = await program.server.app.whatsapp.scheduler.runOnce();
          } catch (error) {
            notlar.push(`işçi hatası: ${error.message}`);
            r = { did: false, waitMs: null };
          }
          if (cokme?.oldu && cokmeBekleyen) {
            // Çökme: süreç bu anda öldü sayılır (eski örnek atılır; disk kopyası "ac"ta açılır).
            cokmeBekleyen = null;
            const p = program;
            program = null;
            dbKapat();
            await p.server.close();
            for (const y of olaylar) if (y.t === null) y.t = zaman(y.o.t, T0, cokme.t);
            ilerledi = true;
            break;
          }
          if (simdi !== once) {
            ilerledi = true;
            break;
          }
          if (!r.did) {
            if (Number.isFinite(r.waitMs)) bekleme = simdi + Math.max(1, r.waitMs);
            break;
          }
        }
        if (program) {
          // Kabul edilen iletinin TTL anı (bakım turu "Süresi Doldu"yu bu anda yazabilsin).
          const ttlSaat = 72;
          for (const s of sirketler) {
            for (const row of db(s)?.all("SELECT accepted_at AS at FROM wa_jobs WHERE state IN ('accepted', 'sent') AND accepted_at IS NOT NULL") || []) {
              const t = Date.parse(row.at) + (ttlSaat + 1) * SA + 1;
              if (t > simdi && !ttlAdaylari.includes(t)) ttlAdaylari.push(t);
            }
          }
        }
      }
      for (const x of siradaki().filter(x => x.t <= simdi && x.o.tur === "kontrol")) {
        olaylar.splice(olaylar.indexOf(x), 1);
        await kontrolYaz(x.o);
      }
      if (ilerledi) continue;
      const adaylar = [];
      const ilkOlay = siradaki()[0];
      if (ilkOlay) adaylar.push(ilkOlay.t);
      if (kancalar.length) adaylar.push(kancalar[0].t);
      if (program && bekleme !== null) adaylar.push(bekleme);
      if (program) for (const t of ttlAdaylari) if (t > simdi) adaylar.push(t);
      const sonraki = adaylar.length ? Math.min(...adaylar) : null;
      if (sonraki === null || sonraki > ufuk) break;
      simdi = Math.max(simdi + 1, sonraki);
      if (program) program.server.clock.set(simdi);
      meta.saat(simdi);
    }

    // ---- son durum → kâhinin sonuç yapısı ----
    const okuma = await goruntu();
    const isler = isleriTopla(okuma);
    const kayit = meta.kayit();
    const istekIs = new Map(); // iş kimliği → ileti isteği sayısı
    for (const i of kayit.istekler.filter(x => x.islem === "messages")) {
      const id = i.govde?.biz_opaque_callback_data;
      if (id) istekIs.set(id, (istekIs.get(id) || 0) + 1);
    }
    const iletiIs = new Map();
    for (const m of kayit.mesajlar) if (m.opaque) iletiIs.set(m.opaque, (iletiIs.get(m.opaque) || 0) + 1);
    const kabulKaydi = kabulHaritasi(kayit);
    for (const m of kayit.mesajlar) if (m.medyaId && m.opaque) medyaIs.set(String(m.medyaId), m.opaque);
    for (const s of sirketler) for (const row of db(s)?.all("SELECT id, media_id FROM wa_jobs WHERE media_id IS NOT NULL") || []) medyaIs.set(String(row.media_id), row.id);
    const medyaYukleme = new Map();
    const medyaSilme = new Map();
    for (const m of kayit.medyalar) {
      const isId = medyaIs.get(String(m.id));
      if (!isId) continue;
      medyaYukleme.set(isId, (medyaYukleme.get(isId) || 0) + 1);
      if (m.silindi) medyaSilme.set(isId, (medyaSilme.get(isId) || 0) + 1);
    }
    degismez.silinmis_medyayla_gonderim = kayit.gecersizMedyaDenemeleri.length;
    const pdfOku = medyaId => {
      const m = meta.meta.medyalar.get(String(medyaId));
      if (!m) return null;
      return ekstreOku(pdfText(m.icerik));
    };
    const isSonucu = {};
    const toplam = { post: {}, kabul: {}, meta_ileti: {}, medya_yukleme: {}, medya_silme: {} };
    for (const [anahtar, liste] of [...isler].sort(([a], [b]) => (a < b ? -1 : 1))) {
      const son = liste.at(-1);
      const icerikli = [...liste].reverse().find(x => x.job.params?.length) || null;
      const say = harita => liste.reduce((s, x) => s + (harita.get(x.job.id) || 0), 0);
      const cari = anahtar.split("/")[1];
      const etiket = anahtar.split("/")[0];
      const sablon = son.batch.template;
      const sonMedya = [...liste].reverse().map(x => [...medyaIs].filter(([, j]) => j === x.job.id).map(([m]) => m).at(-1)).find(Boolean) || null;
      const durum = isDurumu(son.job, son.batch);
      const gonderimeGirdi = liste.some(x => x.job.attempt > 0 || ["limited", "held"].includes(x.job.state) || x.job.params?.length);
      const atlandiGonderimde = son.job.state === "skipped";
      const c = g.cariler.find(x => x.id === cari);
      let dosya = null;
      if (icerikli?.job.pdfName) {
        // Önek programın KAYITLI adından (160 karakter sınırında uyarlanmış girdi dahil), boşluklar teke indirilmiş (kâhinin temizle()'si gibi).
        const on = `Ekstre ${String(icerikli.job.accountName || c?.ad || "").replace(/\s+/g, " ").trim()} `;
        const ad = icerikli.job.pdfName;
        dosya = { on_ek: ad.startsWith(on) ? on : ad.replace(/\.pdf$/i, ""), son_ek: ad.slice(-4) };
      }
      isSonucu[anahtar] = {
        durum,
        telefon: gonderimeGirdi && !atlandiGonderimde ? son.job.phone || null : null,
        sablon,
        degiskenler: icerikli ? icerikli.job.params : null,
        pdf: sablon === "destekofis_ekstre" && sonMedya ? pdfOku(sonMedya) : null,
        dosya_adi: sablon === "destekofis_ekstre" ? dosya : null,
        hata_kodu: Number.isFinite(son.job.errorCode) ? son.job.errorCode : null,
        post: say(istekIs),
        kabul: mut("S12-kabul-dosyadan") ? liste.filter(x => x.job.wamid).length : say(kabulKaydi.harita),
        meta_ileti: say(iletiIs),
        medya_yukleme: say(medyaYukleme),
        medya_silme: say(medyaSilme),
        atlanma_nedeni: atlandiGonderimde ? atlamaKodu(son.job.reason) : null,
      };
      for (const k of Object.keys(toplam)) toplam[k][cari] = (toplam[k][cari] || 0) + isSonucu[anahtar][k];
      void etiket;
    }
    const durumSayilari = {};
    for (const v of Object.values(isSonucu)) durumSayilari[v.durum] = (durumSayilari[v.durum] || 0) + 1;
    // "Bu Ay": WABA başına ay (programın gösterdiği teslim sayısı); ay listesi senaryonun takvimi.
    const buAy = {};
    if (program) {
      const aylar = new Set();
      for (let t = T0 - 31 * GUN; t <= simdi + GUN; t += GUN) aylar.add(trAy(t));
      for (const w of [...new Set(Object.values(wabalar))]) {
        const s = Object.keys(wabalar).find(x => wabalar[x] === w) || "A";
        for (const ay of [...aylar].sort()) {
          const r = await api(program.admin, "GET", ekle(`/api/workspace/whatsapp/stats?month=${ay}`, s));
          const d = r.data?.data;
          if (r.status === 200 && d?.delivered) {
            (buAy[w] ||= {})[ay] = { teslim: d.delivered, yaklasik_usd: Number(d.approxUsd).toFixed(4) };
            if (d.billable !== d.delivered) notlar.push(`Bu Ay ${w} ${ay}: teslim ${d.delivered}, ücretli ${d.billable} (yaklaşık ücret ücretliden)`);
          }
        }
      }
    } else notlar.push("program kapalı bitti: Bu Ay okunamadı");
    const toplular_ = {};
    for (const [etiket, liste] of Object.entries(okuma || {})) {
      const { durum, neden } = topluDurum(liste);
      const elenen = elenenToplu[etiket] || new Set();
      toplular_[etiket] = { durum, neden, is_sayisi: liste[0].jobs.filter(j => !elenen.has(j.accountId)).length };
    }
    const cikti = {
      baslamadi: Object.fromEntries(Object.entries(sonuc.baslamadi).sort()),
      elenen: Object.fromEntries(Object.entries(sonuc.elenen).sort()),
      olusmadi: [...sonuc.olusmadi].sort(),
      ayni_istek: Object.fromEntries(Object.entries(sonuc.ayni_istek).sort()),
      onceki_uyari: Object.fromEntries(Object.entries(sonuc.onceki_uyari).sort()),
      toplular: toplular_,
      durum_sayilari: Object.fromEntries(Object.entries(durumSayilari).sort(([a], [b]) => (a < b ? -1 : 1))),
      meta: {
        ...Object.fromEntries(Object.entries(toplam).map(([k, v]) => [k, Object.fromEntries(Object.entries(v).sort())])),
        toplam_post: kayit.sayilar.toplamMesajIstegi,
        toplam_kabul_program: mut("S12-kabul-dosyadan") ? Object.values(isSonucu).reduce((s, v) => s + v.kabul, 0) : kabulKaydi.toplam,
        toplam_meta_ileti: kayit.sayilar.toplamKabul,
        toplam_medya_yukleme: kayit.sayilar.medyaYukleme,
      },
      kontroller: sonuc.kontroller,
      bu_ay: buAy,
      degismez,
      // Kâhin güncellemesi 2 alanları yalnız ilgili olay varsa (README §7.1: eski senaryolar etkilenmez).
      ...(g.olaylar.some(x => ["basarisizlari_yeniden_dene", "yine_de_gonder"].includes(x.tur) && x.etiket) ? { yeniden: Object.fromEntries(Object.entries(sonuc.yeniden).sort()) } : {}),
      ...(g.olaylar.some(x => x.tur === "liste") ? { listeler: Object.fromEntries(Object.entries(sonuc.listeler).sort()) } : {}),
    };
    if (g.ozet_cikti) {
      cikti.meta = Object.fromEntries(Object.entries(cikti.meta).filter(([k]) => k.startsWith("toplam")));
      cikti.isler_ornek = Object.fromEntries(Object.keys(isSonucu).sort().slice(0, 3).map(k => [k, isSonucu[k]]));
      const dag = {};
      for (const v of Object.values(isSonucu)) dag[String(v.post)] = (dag[String(v.post)] || 0) + 1;
      cikti.isler_post_dagilimi = Object.fromEntries(Object.entries(dag).sort());
    } else cikti.isler = isSonucu;
    if (secenek.dokum) {
      // Ayıklama dökümü (ders 6): programın HTTP yanıtları, toplu işlerin ham ayrıntısı (şirket dosyası), makine defteri, sahte Meta kaydı. Yalnız okuma.
      const defterDokum = {};
      const dosya = path.join(dataDir, "whatsapp-gonderim.sqlite");
      if (fs.existsSync(dosya)) {
        const d = new DatabaseSync(dosya, { readOnly: true });
        try {
          for (const { name } of d.prepare("SELECT name FROM sqlite_master WHERE type = 'table' AND name NOT LIKE 'sqlite_%' ORDER BY name").all()) {
            defterDokum[name] = d.prepare(`SELECT * FROM "${name}" ORDER BY rowid`).all().slice(0, 400);
          }
        } finally {
          d.close();
        }
      }
      const cariAdi = id => programCari[id] || id;
      const dokum = {
        senaryo: sen.ad, uc, tz: process.env.TZ, bitis: trIso(simdi), notlar,
        program_api: apiKaydi,
        toplular: Object.fromEntries(Object.entries(okuma || {}).map(([e, liste]) => [e, liste.map(b => ({ ...b, jobs: b.jobs.map(j => ({ cari: cariAdi(j.accountId), ...j })) }))])),
        cari_eslemesi: Object.fromEntries(Object.entries(cariProgram).map(([k, v]) => [k, v.id])),
        defter: defterDokum,
        sahte_meta: {
          istekler: kayit.istekler.filter(i => ["messages", "media"].includes(i.islem) || /DELETE/.test(i.yontem)).map(i => ({ sira: i.sira, t: trIso(i.t), yontem: i.yontem, islem: i.islem, hedef: i.hedef, deneme: i.deneme, http: i.http, sonuc: i.sonuc, is: i.govde?.biz_opaque_callback_data || null, yanit: i.yanit })),
          mesajlar: kayit.mesajlar.map(m => ({ wamid: m.wamid, to: m.to, kabul: trIso(m.kabulT), is: m.opaque || null, medya: m.medyaId || null })),
          kancalar: kayit.kancalar.map(k => ({ t: trIso(k.t), wamid: k.wamid, durum: k.durum, http: k.http, basarili: k.basarili, hata: k.hata || null, url: String(k.url || '').replace(/\/wa\/kanca\/.*/, '/wa/kanca/<gizli>') })),
          sayilar: kayit.sayilar,
        },
        alici_kanca_kaydi: kancaKaydi,
      };
      fs.mkdirSync(secenek.dokum, { recursive: true });
      fs.writeFileSync(path.join(secenek.dokum, `${sen.ad}-${uc}-${String(process.env.TZ).replace(/[^A-Za-z0-9]+/g, "-")}.json`), JSON.stringify(dokum, null, 1));
    }
    return { cikti, notlar, ceviriler, kancalar: kancaKaydi.length, bitis: trIso(simdi) };
  } finally {
    try {
      if (cokmeBekleyen?.res) cokmeBekleyen.res.socket?.destroy();
      await programKapat();
    } catch (error) {
      notlar.push(`kapanış: ${error.message}`);
    }
    await meta.kapat().catch(() => {});
    await kapatSunucu(alici).catch(() => {});
    if (!metaKapali) await kapatSunucu(vekil).catch(() => {});
    fs.rmSync(kok, { recursive: true, force: true });
  }
}

// ---------- ekstre PDF'inin metni → kâhinin pdf alanı ----------
const sayi = metin => {
  const m = /(-?)([\d.]+,\d{2})/.exec(String(metin || ""));
  if (!m) return null;
  return (m[1] ? -1 : 1) * Number(m[2].replace(/\./g, "").replace(",", "."));
};
const kurus = n => (n === null || n === undefined ? null : (Math.round(n * 100) / 100).toFixed(2));
// Programın Cari Ekstre PDF'i (lib/statement-pdf.mjs; W3): "Cari Ekstre · <ad>", "Cari No n · GG.AA.YYYY – GG.AA.YYYY · …", tabloda "Devir / Dönem başı bakiye
// <tutar> B|A", hareket satırları tarihle başlar, "TOPLAM" satırı, özette "Dönem Sonu Bakiye <tutar> Borçlu|Alacaklı|Kapalı". Okunamayan alan null (ders 4).
const isoGun = gun => {
  const m = /^(\d{2})\.(\d{2})\.(\d{4})$/.exec(gun || "");
  return m ? `${m[3]}-${m[2]}-${m[1]}` : null;
};
function ekstreOku(metin) {
  const s = String(metin).split("\n").map(x => x.trim()).filter(Boolean);
  const ad = s.find(x => x.startsWith("Cari Ekstre · "))?.slice("Cari Ekstre · ".length) ?? null;
  const donemSatiri = s.find(x => /^Cari No /.test(x)) || "";
  const aralik = /(\d{2}\.\d{2}\.\d{4})\s+–\s+(\d{2}\.\d{2}\.\d{4})/.exec(donemSatiri);
  const tum = /Tüm Hareketler/i.test(donemSatiri);
  const isaretli = metin2 => {
    const n = sayi(metin2);
    if (n === null) return null;
    return /\b(A|Alacaklı)$/.test(metin2) ? -n : n;
  };
  const dBas = s.indexOf("Dönem başı bakiye");
  const devir = dBas >= 0 ? isaretli(s[dBas + 1]) : null;
  const ozet = s.indexOf("Dönem Sonu Bakiye");
  const sonu = ozet >= 0 ? isaretli(s[ozet + 1]) : null;
  let hareket = 0;
  for (let i = dBas + 2; dBas >= 0 && i < s.length; i += 1) {
    if (!/^\d{2}\.\d{2}\.\d{4}$/.test(s[i])) continue;
    if (s[i + 1] === "TOPLAM" || s[i + 1] === "Devir") continue;
    hareket += 1;
  }
  return {
    cari_ad: ad,
    donem_bas: tum ? null : isoGun(aralik?.[1]),
    donem_son: tum ? null : isoGun(aralik?.[2]),
    devir: kurus(devir),
    hareket_sayisi: dBas >= 0 ? hareket : null,
    donem_sonu_bakiye: kurus(sonu),
    ...(tum || !aralik ? { _donem_satiri: donemSatiri } : {}),
  };
}

// ---------- karşılaştırma ----------
function karsilastir(beklenen, program) {
  const dizin = fs.mkdtempSync(path.join(os.tmpdir(), "t1-248-karsilastir-"));
  try {
    const b = path.join(dizin, "beklenen.json");
    const p = path.join(dizin, "program.json");
    fs.writeFileSync(b, JSON.stringify(beklenen));
    fs.writeFileSync(p, JSON.stringify(program));
    let cikti = "";
    try {
      cikti = execFileSync("python3", ["-I", KAHIN, "karsilastir", b, p], { encoding: "utf8" });
    } catch (error) {
      cikti = String(error.stdout || "");
    }
    return cikti.split("\n").filter(s => s.startsWith("FARK ")).map(s => s.slice(5));
  } finally {
    fs.rmSync(dizin, { recursive: true, force: true });
  }
}

// ---------- fark sınıfları (YALNIZ raporlama: programın çıktısı ve karşılaştırma değişmez; her sınıf ayrı sayılır) ----------
// Sırayla uygulanır; bir sınıfın kapattığı farklar o sınıfa yazılır, kalanlar "davranış farkı"dır (kök neden aranır, ders 6).
const BORCLU = " (Borçlu)";
const NORMALLESTIRMELER = [
  // G1 — artı bakiye metninin "(Borçlu)" eki (program balanceText; plan §7a 22 yalnız eksiyi "(Alacaklı)" diye tanımlar, §8 "1.250,00 TL"). Aynı tutar, ek farkı.
  ["G1-borclu-eki", p => {
    for (const v of Object.values(p.isler || p.isler_ornek || {})) if (Array.isArray(v.degiskenler)) v.degiskenler = v.degiskenler.map(x => (typeof x === "string" && x.endsWith(BORCLU) ? x.slice(0, -BORCLU.length) : x));
    return p;
  }],
  // G2 — toplu iş düzeyi gösterim: program geri yükleme/taşınmada toplu işi "Durduruldu", lisans/24 saat sorusunda "Duraklatıldı" yapar; kâhinde toplu iş "aktif"
  // kalır, durum İŞLERDE taşınır (çeviri tablosu iş adlarını zaten çevirdi). Anlam aynı mı: işler aynı durumda ise evet.
  ["G2-toplu-gosterim", p => {
    const sade = (d, neden) => (d === "durduruldu" || (d === "duraklatildi" && ["license", "stale"].includes(neden)) ? "aktif" : d);
    for (const t of Object.values(p.toplular || {})) {
      const yeni = sade(t.durum, t.neden);
      if (yeni !== t.durum) Object.assign(t, { durum: yeni, neden: null });
    }
    for (const k of Object.values(p.kontroller || {})) for (const [e, d] of Object.entries(k.toplular || {})) k.toplular[e] = sade(d, k._toplu_neden?.[e]);
    return p;
  }],
  // G4 — kâhinin karşılaştırıcısı LİSTEYİ bütün olarak karşılaştırır; liste içindeki {"plan_susuyor"} (denetlenmez) ve {"kisaltilabilir": tam} (önek kabul) yaprakları
  // README §2'deki anlamıyla öğe öğe uygulanır (kâhinin kendi kuralı; programın değeri yalnız bu iki yaprakta değiştirilir).
  ["G4-liste-icinde-ozel-yaprak", (p, b) => {
    const isler = p.isler || p.isler_ornek || {};
    const bek = b.isler || b.isler_ornek || {};
    for (const [k, v] of Object.entries(isler)) {
      const e = bek[k]?.degiskenler;
      if (!Array.isArray(e) || !Array.isArray(v.degiskenler)) continue;
      v.degiskenler = v.degiskenler.map((x, i) => {
        const y = e[i];
        if (y && typeof y === "object" && "plan_susuyor" in y) return y;
        if (y && typeof y === "object" && "kisaltilabilir" in y && typeof x === "string") {
          const on = x.replace(/…$/, "").trimEnd();
          return on && y.kisaltilabilir.startsWith(on) ? y : x;
        }
        return x;
      });
    }
    return p;
  }],
  // G3 — GÖNDERİLMEMİŞ işin içeriği: kâhin içeriği işçi işi ele aldığında (sınır denetiminden ÖNCE) okur; program içeriği yalnız gönderime hazırlarken üretir.
  // Kâhinde de programda da ileti isteği 0 olan işin telefon/değişken/PDF/dosya adı alanları karşılaştırmadan çıkar.
  ["G3-gonderilmeyen-icerik", (p, b) => {
    for (const [k, v] of Object.entries(p.isler || {})) {
      const e = b.isler?.[k];
      if (!e || v.post !== 0 || e.post !== 0) continue;
      for (const alan of ["telefon", "degiskenler", "pdf", "dosya_adi"]) v[alan] = e[alan];
    }
    return p;
  }],
];

// ---------- ana ----------
const secenek = argumanlar(process.argv.slice(2));
const veri = JSON.parse(fs.readFileSync(SENARYOLAR, "utf8"));
const secici = desen => {
  const istenen = desen.split(",").map(s => s.trim()).filter(Boolean);
  return veri.senaryolar.filter(s => istenen.some(x => (x.endsWith("*") ? s.ad.startsWith(x.slice(0, -1)) : s.ad === x)));
};
const tzAdi = String(process.env.TZ).replace(/[^A-Za-z0-9]+/g, "-");

async function kosVeKarsilastir(sen, uc) {
  const baslangic = Date.now();
  try {
    const r = await kos(sen, uc, secenek);
    const farklar = karsilastir(sen.beklenen, r.cikti);
    const siniflar = {};
    let kalanFark = farklar;
    if (farklar.length) {
      const beklenenSonuc = sen.beklenen[0].sonuc;
      let birikimli = r.cikti;
      for (const [ad, fn] of NORMALLESTIRMELER) {
        birikimli = fn(JSON.parse(JSON.stringify(birikimli)), beklenenSonuc);
        const sonra = karsilastir(sen.beklenen, birikimli);
        const kayan = kalanFark.filter(f => !sonra.includes(f));
        if (kayan.length) siniflar[ad] = kayan;
        kalanFark = sonra;
        if (!kalanFark.length) break;
      }
    }
    return { ad: sen.ad, uc, kip: secenek.kip, tz: process.env.TZ, mutasyon: MUTASYON, farklar, davranis_farki: kalanFark, siniflar, notlar: r.notlar, ceviriler: r.ceviriler, kanca_istegi: r.kancalar, bitis: r.bitis, sure_ms: Date.now() - baslangic, program: r.cikti };
  } catch (error) {
    return { ad: sen.ad, uc, kip: secenek.kip, tz: process.env.TZ, mutasyon: MUTASYON, hata: String(error.stack || error), farklar: ["SÜRÜCÜ HATASI"], sure_ms: Date.now() - baslangic };
  }
}

// S-8: sürücü eşlemelerinin dişi. Her satır: [mutasyon, hedef senaryolar (önek*), eşleme]. Hedef senaryo mutasyonsuz İKİ kez koşar (kararlılık: iki fark listesi aynı
// olmalı); mutasyonlu koşunun fark listesi tabandan FARKLIYSA yakalandı. Ayrışmayan = dişsiz eşleme (o eşlemeyi hiçbir hedef senaryo sınamıyor) — raporda adıyla.
const MUTASYONLAR = [
  ["S1-bitis-yok-sayilir", "K1-03*,K7-01*,K7-02*,K7-04*,D3-02*,D8-01*", "S-1 / S-10 bitis → ufuk"],
  ["S2-bu-ay-gecen-ay-takas", "K1-01*,K1-03*,K1-09*,D1-02*,D4-01*,D7-02*", "S-2 bu_ay/gecen_ay → thisMonth/lastMonth"],
  ["S2-son-3-ay-tum", "K1-05*,K4-03*,D1-03*,D3-01*", "S-2 son_3_ay → last3"],
  ["S3-hedef-yok-sayilir", "K6-01*,K6-02*,D5-01*,D5-02*", "S-3 hedef asil → asıl toplu iş"],
  ["S3-elenen-okunmaz", "K5-02*,K6-01*,K6-03*,D3-01*,D5-02*", "S-3 yanıttaki elenen + neden"],
  ["S3-alinan-elenenleri-de-sayar", "K5-02*,K6-03*,D5-01*", "S-3 yanıttaki alınan"],
  ["S3-oneri-takas", "K6-01*,K6-03*,D6-02*", "S-3 iletideki öneri"],
  ["S3-ret-yaniti-okunmaz", "K5-02*,K6-03*,D3-02*", "S-3 400 yanıtı okunur"],
  ["S4-onaysiz-yine-de-gonder", "K5-04*,D1-01*,D3-02*,D6-01*,F1-01*,F1-03*", "S-4 Yine de Gönder (onaylı) + yanıtı"],
  ["S5-yedek-yok-sayilir", "K6-03*,D7-01*,D7-02*", "S-5 geri_yukle {yedek} → adlı yedek"],
  ["S6-imlec-gonderilmez", "K8-01*", "S-6 imleç (before)"],
  ["S6-suzgec-gonderilmez", "K8-02*,K8-03*", "S-6 Başlangıç/Bitiş (from/to)"],
  ["S6-devam-suzgeci-devralmaz", "K8-03*", "S-6 devam süzgeci devralır"],
  ["S6-sayfa-31", "K8-01*,K8-03*", "S-6 sayfa boyu 30"],
  ["S6-daha-fazla-hep-yok", "K8-01*,K8-03*", "S-6 Daha Fazla Göster (31. kayıt)"],
  ["S6-ters-aralik-bos-liste", "K8-02*", "S-6 Başlangıç > Bitiş reddi"],
  ["S7-yeniden-belirsiz-eslemesi-yok", "K6-01*,K6-02*,K6-03*,D6-02*,F2-01*", "S-7 yeniden denemede Sonucu Belirsiz → sonucu_belirsiz"],
  ["S9-baslatma-belirsiz-eslemesi-yok", "D1-01*,D1-02*,D1-03*,D6-01*,D6-03*", "S-9 başlatmada Sonucu Belirsiz → sonucu_belirsiz"],
  ["S9-yeniden-kuyrukta-eslemesi-yok", "D5-02*", "S-9 yeniden denemede Zaten Kuyrukta → zaten_kuyrukta"],
  ["S9-yeniden-daha-once-eslemesi-yok", "K5-02*,D3-01*,D5-01*,F2-02*", "S-9 yeniden denemede Daha Önce Gönderildi → daha_once_gonderildi"],
  ["S11-yine-kuyrukta-eslemesi-yok", "E2-06*,F1-02*", "S-11 işteki Yine de Gönder'de Zaten Kuyrukta → zaten_kuyrukta"],
  ["S11-medya-silme-durumsuz", "TEMEL-01*,E4-01*,E4-02*", "S-11 iç denetim: yalnız kesinleşmemiş işin PDF silmesi sayılır"],
  ["S11-medya-silme-son-deneme-yok", "E4-01*,E4-02*,K4-01*,D5-01*", "S-11 iç denetim: yalnız SON denemenin PDF'i"],
  ["S12-kabul-dosyadan", "D7-01*,D7-02*,K7-01*,K3-02*,ALICI-131049-iki-kez", "S-12 kabul sahte Meta kaydından (dosyadaki wamid değil)"],
  ["S12-kabul-meta-iletisinden", "CIFT-03*", "S-12 kabul = programa ulaşan yanıt / imzalı çözüm (Meta'daki her ileti değil)"],
  ["S12-kabul-kanca-cozumu-yok", "CIFT-01*,CIFT-04*", "S-12 imzalı durum bildirimiyle çözülen belirsiz ileti kabul sayılır"],
];

const sonuclar = [];
let n = 0;
let gecen = 0;
let kalan = 0;
console.log("TAP version 13");
console.log(`# saat dilimi ${process.env.TZ}`);
if (secenek.mutasyonDenetimi) {
  const taban = new Map(); // senaryo → fark listesi (sıralı)
  const sirala = f => [...f].sort();
  const esit = (a, b) => a.length === b.length && a.every((x, i) => x === b[i]);
  const kararsiz = new Set();
  for (const [ad, desen, esleme] of MUTASYONLAR) {
    const hedefler = secici(desen);
    if (!hedefler.length) throw new Error(`mutasyon ${ad}: hedef senaryo yok (${desen})`);
    const ayrinti = [];
    for (const sen of hedefler) {
      if (!taban.has(sen.ad)) {
        MUTASYON = null;
        const a = await kosVeKarsilastir(sen, "hizli");
        const b = await kosVeKarsilastir(sen, "hizli");
        if (!esit(sirala(a.farklar), sirala(b.farklar))) kararsiz.add(sen.ad);
        taban.set(sen.ad, { farklar: sirala(a.farklar), hata: a.hata || b.hata || null });
        sonuclar.push({ ...a, rol: "taban-1" }, { ...b, rol: "taban-2" });
      }
      MUTASYON = ad;
      const m = await kosVeKarsilastir(sen, "hizli");
      MUTASYON = null;
      const t = taban.get(sen.ad);
      const yeni = sirala(m.farklar).filter(f => !t.farklar.includes(f));
      const kayan = t.farklar.filter(f => !m.farklar.includes(f));
      const yakaladi = !kararsiz.has(sen.ad) && !t.hata && !m.hata && (yeni.length > 0 || kayan.length > 0);
      ayrinti.push({ senaryo: sen.ad, yakaladi, yeni_fark: yeni.length, kaybolan_fark: kayan.length, ornek: yeni.slice(0, 3), kararsiz_taban: kararsiz.has(sen.ad), hata: m.hata || t.hata || null });
      sonuclar.push({ ...m, rol: "mutasyon" });
    }
    n += 1;
    const yakalayan = ayrinti.filter(x => x.yakaladi).map(x => x.senaryo);
    sonuclar.push({ rol: "ozet", mutasyon: ad, esleme, hedefler: hedefler.map(s => s.ad), yakalayan, ayrinti });
    if (yakalayan.length) {
      gecen += 1;
      console.log(`ok ${n} - mutasyon ${ad} (${esleme}) yakalandı: ${yakalayan.join(", ")}`);
    } else {
      kalan += 1;
      console.log(`not ok ${n} - mutasyon ${ad} (${esleme}) DİŞSİZ: hiçbir hedefte ayrışma yok`);
    }
    for (const x of ayrinti) console.log(`  # ${x.senaryo}: ${x.yakaladi ? "ayrıştı" : "ayrışmadı"} (yeni fark ${x.yeni_fark}, kaybolan ${x.kaybolan_fark}${x.kararsiz_taban ? ", TABAN KARARSIZ" : ""}${x.hata ? `, HATA ${String(x.hata).split("\n")[0]}` : ""})${x.ornek[0] ? ` örn. ${x.ornek[0].slice(0, 160)}` : ""}`);
  }
} else {
  MUTASYON = secenek.mutasyon;
  const liste = secenek.senaryo ? secici(secenek.senaryo) : veri.senaryolar;
  const uclar = secenek.uc === "ikisi" ? ["hizli", "yavas"] : [secenek.uc];
  for (const sen of liste) {
    for (const uc of uclar) {
      n += 1;
      const kayit = await kosVeKarsilastir(sen, uc);
      sonuclar.push(kayit);
      const siniflama = Object.entries(kayit.siniflar || {}).map(([k, v]) => `${k} ${v.length}`).join(", ");
      if (!kayit.farklar.length) {
        gecen += 1;
        console.log(`ok ${n} - ${sen.ad} [${uc}]`);
      } else {
        kalan += 1;
        const davranis = kayit.davranis_farki || kayit.farklar;
        console.log(`not ok ${n} - ${sen.ad} [${uc}] (${kayit.farklar.length} fark; davranış farkı ${davranis.length}${siniflama ? `; gösterim: ${siniflama}` : ""})`);
        for (const f of davranis.slice(0, secenek.ayrinti ? 1000 : 12)) console.log(`  # ${f}`);
        if (kayit.hata) console.log(`  # ${kayit.hata.split("\n").slice(0, 4).join(" | ")}`);
      }
      if (secenek.ayrinti && kayit.notlar?.length) for (const s of kayit.notlar) console.log(`  # not: ${s}`);
    }
  }
}
if (secenek.cikti) {
  fs.mkdirSync(secenek.cikti, { recursive: true });
  const dosya = secenek.mutasyonDenetimi ? `surucu-mutasyon-${tzAdi}.json` : `karsilastirma-${secenek.kip}-${secenek.uc}-${tzAdi}${MUTASYON ? `-mut-${MUTASYON}` : ""}.json`;
  fs.writeFileSync(path.join(secenek.cikti, dosya), JSON.stringify(sonuclar));
}
console.log(`1..${n}`);
console.log(`# tests ${n}`);
console.log(`# pass ${gecen}`);
console.log(`# fail ${kalan}`);
process.exitCode = kalan ? 1 : 0;
