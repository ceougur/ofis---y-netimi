// e-BELGE DAYANIKLILIK TESTİ — 4–5 SAAT, GERÇEK KULLANICI GİBİ (programın kendi ekranından, Playwright).
//  Temel: docs/kanit/2026-10-16/edm-yuk/adim13-yuk.mjs (iki şirket, 10 kullanıcı, ekrandan kesim, KURU kip) ve edm-stres/adim12-stres.mjs
//  (oturum ve ekran yardımcıları, cariyi ekrandan açma).
//  Şirket 001 DESTEK OFİS (hizmet: yazılım, danışmanlık, hukuk, emlak komisyonu, turizm/konaklama, eğitim, temizlik, yemek, arşiv)
//  Şirket 002 ATLAS YAPI (ticaret/stok: inşaat malzemesi, gıda %1, tekstil %10, elektronik %20 + hizmet satırları).
//  Şirket başına 5 kullanıcı (muhasebe/avukat karışık) ayrı tarayıcı oturumunda, AYNI ANDA, SURE_DK boyunca döngüde belge keser:
//  e-Fatura TEMEL / TİCARİ, e-Arşiv kişiye / mükellef olmayan firmaya; %0 (istisna kodlu) %1 %10 %20 tek ve karışık; satır iskontosu; 1–5 kalem;
//  farklı birimler (EDM kodu olmayan Çuval/Teneke dahil); KDV tevkifatı; tevkifat + istisna karışık. İnsan davranışları: Kaydet ve Gönder,
//  Kaydet, Sonra Gönder → karttan e-Belge Gönder, ara sıra e-Arşiv iptali ve Durum Sorgula; sayılar insan hızında yazılır.
//  Süre bitince: Durum Sorgula ile son durum, her belgenin UBL XML'i + EDM resmî PDF'i, denetimler (✓/✗), bağımsız kâhin (kahin.py).
//
//  Kullanım: node dayaniklilik.mjs <kimlik-dosyası> <çıktı-klasörü> <çalışma-klasörü>
//    KURU=1     sahte EDM (test/einvoice-mock.mjs); kimlik dosyası gerekmez ("-" verilir). Gerçek EDM'ye bağlanılmaz.
//    SURE_DK    kesim süresi (dk, varsayılan 270)            TEMPO_SN  kullanıcı başına iki belge arası ortalama bekleme (sn, ±%50; varsayılan 90)
//    TOHUM      plan tohumu (varsayılan 1; aynı tohum aynı planı verir — Math.random kullanılmaz)
//    SETTLE_DK  son durum bekleme sınırı (varsayılan gerçek 40, KURU 3)   ARA_RAPOR_DK ara rapor aralığı (varsayılan 15; KURU 2)
//    PROGRAM_PDF_ORAN programın kendi PDF'i (karekodu) her kaçıncı belgede indirilir (varsayılan gerçek 5, KURU 1)
//    ISCI       denetim işçisi sayısı (varsayılan min(4, çekirdek))   SERI_BASLANGIC seri başlangıcı (yoksa kriptografik rastgele)
//    IPTAL_YAS_DK iptal edilecek e-Arşiv en az kaç dk önce kesilmiş olmalı (varsayılan gerçek 5, KURU 0)
//  e-SMM döngüye girmez; başta bir kez denenir, sonucu BULGU: (a) 2.4.0 "e-SMM gönderilemiyor" ya da (b) 2.4.1 "e-SMM gizli (beklenen)".
//  Kimlik bilgisi yalnız verilen dosyadan; her günlük/dosya yazımında maskelenir. Sunucu üretim ayarıyla (edocEnabled + edocLive), Ortam = Test.
//  HUKUK_LICENSE_URL ölü adres (ders 30). Denetim işçisi kipi: node dayaniklilik.mjs --denetim-iscisi <girdi.json> <çıktı.json>
//  Karekod tek denetim kipi (diş kanıtı): node dayaniklilik.mjs --karekod <pdf> <no> <ettn> <satıcı-vkn> <ödenecek>
import { readFileSync, writeFileSync, appendFileSync, mkdirSync, rmSync, readdirSync, existsSync, statSync } from "node:fs";
import { execFileSync, spawn } from "node:child_process";
import { randomInt } from "node:crypto";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
const R = "/home/user/ofis---y-netimi";
const HERE = path.dirname(fileURLToPath(import.meta.url));
const SELF = fileURLToPath(import.meta.url);

// ======================================================================================================================================
// Karekod çözümü (programdan bağımsız: pdftoppm + jsQR). PDF'in ilk sayfası gri görüntüye çevrilir, jsQR ile okunur.
// ======================================================================================================================================
let qrCounter = 0;
async function decodeQr(pdfFile, workDir) {
  const jsQR = (await import(`${R}/node_modules/jsqr/dist/jsQR.js`)).default;
  mkdirSync(workDir, { recursive: true });
  for (const dpi of [150, 220]) {
    const base = path.join(workDir, `qr-${process.pid}-${(qrCounter += 1)}`);
    try {
      execFileSync("pdftoppm", ["-r", String(dpi), "-gray", "-f", "1", "-l", "1", "-singlefile", pdfFile, base], { stdio: ["ignore", "ignore", "pipe"] });
    } catch (error) {
      return { error: `pdftoppm: ${String(error.stderr || error.message).slice(0, 160)}` };
    }
    const file = readFileSync(`${base}.pgm`);
    rmSync(`${base}.pgm`, { force: true });
    const header = file.toString("latin1", 0, 64).split(/\s+/);
    const width = Number(header[1]), height = Number(header[2]);
    const start = file.length - width * height;
    const rgba = new Uint8ClampedArray(width * height * 4);
    for (let i = 0; i < width * height; i += 1) { const v = file[start + i]; rgba[i * 4] = rgba[i * 4 + 1] = rgba[i * 4 + 2] = v; rgba[i * 4 + 3] = 255; }
    const found = jsQR(rgba, width, height);
    if (found?.data) {
      try { return { json: JSON.parse(found.data), raw: found.data }; } catch { return { raw: found.data, error: "karekod JSON değil" }; }
    }
  }
  return { error: "KAREKOD OKUNAMADI" };
}
// Karekod ↔ belge: no, ettn, satıcı VKN, ödenecek (kuruş).
function qrMatches(qr, expected) {
  const j = qr?.json;
  if (!j) return { ok: false, why: qr?.error || "karekod yok" };
  const bad = [];
  if (j.no !== expected.no) bad.push(`no ${j.no} ≠ ${expected.no}`);
  if (String(j.ettn || "").toLowerCase() !== String(expected.ettn || "").toLowerCase()) bad.push(`ettn ${j.ettn} ≠ ${expected.ettn}`);
  if (j.vkntckn !== expected.vkn) bad.push(`vkntckn ${j.vkntckn} ≠ ${expected.vkn}`);
  if (Math.round(Number(j.odenecek) * 100) !== Math.round(Number(expected.odenecek) * 100)) bad.push(`odenecek ${j.odenecek} ≠ ${expected.odenecek}`);
  return { ok: !bad.length, why: bad.join("; ") };
}

// ======================================================================================================================================
// Denetim işçisi (ayrı süreç; ISCI kadar paralel): XSD + GİB şematronu, görünüm şablonu (renderView), karekod (resmî ve program PDF'i).
// ======================================================================================================================================
if (process.argv[2] === "--denetim-iscisi") {
  const input = JSON.parse(readFileSync(process.argv[3], "utf8"));
  const { validateInvoice, renderView } = await import(`${R}/tools/ebelge/dogrula.mjs`);
  const out = [];
  for (const item of input.items) {
    const r = { no: item.no };
    try {
      const xml = readFileSync(item.xml, "utf8");
      const v = await validateInvoice(xml, { type: item.type });
      r.xsd = v.xsd.slice(0, 5);
      r.schematron = v.schematron.slice(0, 5).map(e => e.text);
      try {
        const html = renderView(xml);
        r.view = {
          gib: /<img\b[^>]*\balt="GİB"/.test(html),
          kase: /Kaşe \/ İmza/.test(html),
          logo: /<img\b[^>]*\balt="(?:Logo|Firma Logosu|logo)[^"]*"/i.test(html) || (html.match(/<img\b[^>]*src="data:image\/(?:jpe?g|png)/g) || []).length >= 3,
          imgs: (html.match(/<img\b/g) || []).length,
          alts: [...html.matchAll(/<img\b[^>]*\balt="([^"]*)"/g)].map(m => m[1]),
        };
      } catch (error) { r.view = { error: String(error.message || error).slice(0, 200) }; }
    } catch (error) { r.error = String(error.message || error).slice(0, 300); }
    r.qr = {};
    for (const pdf of item.pdfs || []) {
      if (!existsSync(pdf.path)) { r.qr[pdf.kaynak] = { error: "PDF yok" }; continue; }
      const qr = await decodeQr(pdf.path, input.workDir);
      r.qr[pdf.kaynak] = { ...qr, match: qrMatches(qr, item.expected) };
    }
    out.push(r);
  }
  writeFileSync(process.argv[4], JSON.stringify(out));
  process.exit(0);
}
if (process.argv[2] === "--karekod") {
  const [pdf, no, ettn, vkn, odenecek] = process.argv.slice(3);
  const dir = path.join(os.tmpdir(), `dayaniklilik-karekod-${process.pid}`);
  const qr = await decodeQr(pdf, dir);
  rmSync(dir, { recursive: true, force: true });
  const m = qrMatches(qr, { no, ettn, vkn, odenecek });
  console.log(`  ${m.ok ? "✓" : "✗"} karekod ${path.basename(pdf)} ↔ ${no} ${m.ok ? "aynı" : `FARKLI: ${m.why}`}`);
  process.exit(m.ok ? 0 : 1);
}

// ======================================================================================================================================
// Ana koşu
// ======================================================================================================================================
const { DatabaseSync } = await import("node:sqlite");
const { chromium } = await import(`${R}/node_modules/playwright/index.mjs`);
const { createClient, ADMIN_PASSWORD } = await import(`${R}/test/helpers.mjs`);
const { createApp } = await import(`${R}/server/app.mjs`);
const { resolveDbPath } = await import(`${R}/server/lib/db-path.mjs`);
const { vkn: mockVkn, startMockEdm, OUR_VKN, BUYER_VKN } = await import(`${R}/test/einvoice-mock.mjs`);

const DRY = process.env.KURU === "1";
const SURE_DK = Number(process.env.SURE_DK || 270);
const TEMPO_SN = Number(process.env.TEMPO_SN || 90);
const TOHUM = Number(process.env.TOHUM || 1);
const SETTLE_DK = Number(process.env.SETTLE_DK || (DRY ? 3 : 40));
const ARA_RAPOR_DK = Number(process.env.ARA_RAPOR_DK || (DRY ? 2 : 15));
const PROGRAM_PDF_ORAN = Math.max(1, Number(process.env.PROGRAM_PDF_ORAN || (DRY ? 1 : 5)));
const IPTAL_YAS_DK = Number(process.env.IPTAL_YAS_DK || (DRY ? 0 : 5));
const ISCI = Math.max(1, Number(process.env.ISCI || Math.min(4, os.cpus().length)));
const [credFile, OUT, WORK] = process.argv.slice(2);
if (!OUT || !WORK || (!DRY && (!credFile || credFile === "-"))) {
  console.error("Kullanım: [KURU=1] node dayaniklilik.mjs <kimlik-dosyası|-> <çıktı-klasörü> <çalışma-klasörü>");
  process.exit(2);
}
const credText = DRY ? "" : readFileSync(credFile, "utf8");
const username = DRY ? "edmkullanici" : (credText.match(/kullan[ıi]c[ıi] ad[ıi]\s*:\s*(\S+)/i) || [])[1];
const password = DRY ? "Gizli-Parola-1" : (credText.match(/şifre\s*:\s*(\S+)/i) || [])[1];
if (!username || !password) { console.error("Kimlik dosyasında kullanıcı adı / şifre bulunamadı."); process.exit(2); }
rmSync(WORK, { recursive: true, force: true });
mkdirSync(OUT, { recursive: true });
for (const dir of ["xml", "pdf", "pdf-program", "ekran"]) mkdirSync(path.join(OUT, dir), { recursive: true });
for (const file of ["plan.jsonl", "belgeler.jsonl", "karekod.jsonl", "olaylar.jsonl"]) rmSync(path.join(OUT, file), { force: true });
const dataDir = path.join(WORK, "data");
const backupDir = path.join(WORK, "backups");
const mask = value => String(typeof value === "string" ? value : JSON.stringify(value ?? "")).split(password).join("***").split(username).join("<kullanıcı>");
const stamp = () => new Date().toISOString().slice(11, 19);
const log = (label, value = "") => console.log(`${stamp()} ${label}${value === "" ? "" : `: ${mask(value).slice(0, 700)}`}`);
const jsonl = (file, row) => appendFileSync(path.join(OUT, file), `${mask(JSON.stringify(row))}\n`);
let pass = 0, fail = 0;
const checks = [];
const check = (cond, what) => { cond ? (pass += 1) : (fail += 1); checks.push({ ok: Boolean(cond), what: mask(what) }); console.log(`  ${cond ? "✓" : "✗"} ${mask(what)}`); return Boolean(cond); };
const skip = what => { checks.push({ ok: null, what }); console.log(`  – ${what}`); };
const unwrap = r => ({ ...r, data: r.data && typeof r.data === "object" && "ok" in r.data ? (r.data.ok ? r.data.data : r.data) : r.data });
const sleep = ms => new Promise(r => setTimeout(r, ms));
const near = (a, b) => Math.abs(Number(a) - Number(b)) < 0.005;
const cents = v => Math.round(Number(v) * 100);

// ---------- Tohumlu rastgelelik (mulberry32): her kullanıcıya ayrı akış; aynı tohum → aynı plan ----------
const mulberry32 = seed => () => { seed |= 0; seed = (seed + 0x6d2b79f5) | 0; let t = Math.imul(seed ^ (seed >>> 15), 1 | seed); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
const makeRng = (...parts) => {
  let h = 2166136261;
  for (const ch of parts.join("|")) { h ^= ch.charCodeAt(0); h = Math.imul(h, 16777619); }
  const next = mulberry32(h >>> 0);
  const rng = {
    next,
    int: (a, b) => a + Math.floor(next() * (b - a + 1)),
    pick: list => list[Math.floor(next() * list.length)],
    chance: p => next() < p,
    weighted: pairs => { const total = pairs.reduce((s, [, w]) => s + w, 0); let x = next() * total; for (const [v, w] of pairs) { x -= w; if (x < 0) return v; } return pairs.at(-1)[0]; },
    money: (min, max) => { const v = min + next() * (max - min); return next() < 0.35 ? Math.round(v) : Math.round(v * 100) / 100; },
  };
  return rng;
};

// ---------- Sahte / gerçek EDM ----------
const mock = DRY ? await startMockEdm() : null;
const SELLER_VKN = DRY ? OUR_VKN : "3230512384";
const EF_VKN = DRY ? BUYER_VKN : "3230512384";
const GB = DRY ? "urn:mail:defaultgb@deneme.com.tr" : "urn:mail:defaultgb@edmbilisim.com.tr";
const PK = DRY ? "urn:mail:defaultpk@alici.com.tr" : "urn:mail:defaultpk@edmbilisim.com.tr";

// ---------- Sunucu: üretim ayarı (edocEnabled + edocLive); Ortam = Test ----------
const app = createApp({
  dataDir, backupDir, logLevel: "silent", scheduleBackups: false,
  env: { HUKUK_ADMIN_PASSWORD: ADMIN_PASSWORD, HUKUK_DATASET_AUTOSYNC: "0", HUKUK_LICENSE_URL: "http://127.0.0.1:9" },
  license: { enforce: false, machineId: "0123456789abcdef0123456789abcdef" }, startLicenseTimers: false,
  edocEnabled: true, edocLive: true, moneyStrict: true, gateVerify: true, reportWorker: false,
});
const address = await app.listen(0, "127.0.0.1");
const base = `http://127.0.0.1:${address.port}`;
const api = createClient(base);
await api.login("admin", ADMIN_PASSWORD);
const post = async (u, b) => unwrap(await api.post(u, b));
const put = async (u, b) => unwrap(await api.put(u, b));
const get = async u => unwrap(await api.get(u));
const selectCompany = async id => { const r = await post("/api/companies/select", { id }); if (r.status !== 200) throw new Error(`şirket seçilemedi ${JSON.stringify(r.data)}`); };
const dbFileOf = company => resolveDbPath(app.companies.dirsOf(company).dataDir);
const tckn = seed => { const d = [1 + (seed % 9), ...String(seed * 7919 + 12345678).padStart(8, "0").slice(-8).split("").map(Number)]; const odd = d[0] + d[2] + d[4] + d[6] + d[8]; const even = d[1] + d[3] + d[5] + d[7]; d.push((((odd * 7 - even) % 10) + 10) % 10); d.push(d.reduce((a, b) => a + b, 0) % 10); return d.join(""); };
const year = new Date().getFullYear();
const seq = Number(process.env.SERI_BASLANGIC || 100_000_000 + randomInt(780_000_000));
const jpeg = file => `data:image/jpeg;base64,${readFileSync(`${R}/docs/pazarlama/${file}`).toString("base64")}`;

// ---------- Katalog ----------
// Hizmet satırı: [ad, birim, fiyat aralığı, KDV, tevkifata uygun kod (yoksa ""), ondalık miktar?]
const SERVICE_SECTORS = {
  "Yazılım": [["Muhasebe Yazılımı Lisansı", "Adet", [1500, 4500], 20, ""], ["Kurulum ve Eğitim", "Saat", [500, 1200], 20, ""], ["Yazılım Bakım Aboneliği", "Ay", [300, 1500], 20, ""], ["Bulut Yedekleme Hizmeti", "Ay", [150, 600], 20, ""]],
  "Danışmanlık": [["Yönetim Danışmanlığı", "Saat", [800, 2500], 20, "602"], ["Mali Danışmanlık", "Gün", [3000, 9000], 20, "602"], ["Proje Fizibilite Etüdü", "Adet", [10000, 40000], 20, "602"]],
  "Hukuk": [["Hukuki Danışmanlık", "Saat", [1500, 5000], 20, "602"], ["Sözleşme İncelemesi", "Adet", [2000, 8000], 20, ""], ["Dava Takip Hizmeti", "Ay", [5000, 15000], 20, ""]],
  "Emlak": [["Emlak Komisyonu (Satış)", "Adet", [15000, 60000], 20, ""], ["Kiralama Komisyonu", "Adet", [5000, 20000], 20, ""], ["Ekspertiz Raporu", "Adet", [2500, 6000], 20, ""]],
  "Turizm": [["Otel Konaklama", "Gün", [1500, 6000], 10, ""], ["Kahvaltı Hizmeti", "Kişi", [250, 600], 10, ""], ["Havalimanı Transferi", "Sefer", [800, 2000], 20, ""]],
  "Eğitim": [["Mesleki Eğitim Kursu", "Kişi", [2000, 8000], 10, ""], ["Seminer Katılımı", "Kişi", [500, 2500], 20, ""], ["Eğitim Danışmanlığı", "Saat", [600, 1800], 20, "602"]],
  "Temizlik": [["Ofis Temizlik Hizmeti", "Ay", [8000, 25000], 20, "612"], ["Cam Temizliği", "M²", [15, 45], 20, "612", true]],
  "Yemek": [["Personel Yemek Servisi", "Kişi", [120, 250], 10, "604"]],
  "Personel": [["Geçici Personel Temini", "Ay", [25000, 45000], 20, "606"]],
  "Arşiv": [["Arşivleme Hizmeti", "Ay", [2000, 6000], 20, "616"], ["Belge Tarama", "Paket", [150, 500], 20, "616"]],
};
// Stok kartı: [ad, birim, satış fiyatı, alış fiyatı, KDV, sektör, ondalık miktar?]
const STOCK = [
  ["Portland Çimento 50 Kg", "Çuval", 285, 210, 20, "İnşaat"], ["İnşaat Demiri Q12", "Kg", 28.45, 22, 20, "İnşaat", true], ["İç Cephe Boyası 15 Lt", "Teneke", 1450, 1100, 20, "İnşaat"],
  ["Seramik Yer Karosu 60x60", "M²", 425.5, 300, 20, "İnşaat", true], ["Kırmızı Tuğla 13,5", "Adet", 6.75, 4.5, 20, "İnşaat"], ["Selülozik Tiner", "Lt", 95.9, 70, 20, "İnşaat", true],
  ["Buğday Unu Tip 550", "Kg", 18.75, 14, 1, "Gıda", true], ["Ekmek 350 Gr", "Adet", 10, 7, 1, "Gıda"], ["Makarna 500 Gr", "Paket", 22.9, 16, 1, "Gıda"], ["Ayçiçek Yağı", "Lt", 79.95, 62, 1, "Gıda", true],
  ["Pamuklu Gömlek", "Adet", 450, 280, 10, "Tekstil"], ["Döşemelik Kumaş", "Metre", 185.5, 120, 10, "Tekstil", true], ["Havlu Takımı", "Takım", 640, 410, 10, "Tekstil"],
  ["Dizüstü Bilgisayar", "Adet", 32500, 27000, 20, "Elektronik"], ["LED Ampul 10'lu", "Kutu", 349.9, 240, 20, "Elektronik"], ["Akıllı Telefon", "Adet", 24999.99, 21000, 20, "Elektronik"],
];
const GOODS_SERVICES = [["Nakliye Hizmeti", "Sefer", [800, 3000], 20, ""], ["Montaj ve Teknik Danışmanlık", "Saat", [600, 1800], 20, "602"], ["Depo Arşivleme Hizmeti", "Ay", [1500, 4000], 20, "616"]];
const KAHIN_TEVKIFAT = ["602", "604", "606", "612", "616"]; // kahin.py tablosundaki kodlar
const ISTENEN_ISTISNA = ["301", "302", "304", "350", "351"];
const OPENING_QTY = 1_000_000;
const COMPANIES = [
  { code: "001", name: "DESTEK OFİS", scenario: "service_sale", start: seq, login: "destek",
    seller: { name: "DESTEK OFİS", taxNo: SELLER_VKN, taxOffice: "Kadıköy", address: "Caferağa Mh. Moda Cd. 12", district: "Kadıköy", city: "İstanbul", postalCode: "34710", email: "bilgi@destekofis.com.tr", logo: jpeg("DestekOfis-Logo-Fatura-Yatay.jpg"), stamp: jpeg("DestekOfis-Logo-Fatura-Kare.jpg"), banks: [{ name: "Örnek Bankası A.Ş.", iban: "TR330006100519786457841326" }] },
    footer: "DESTEK OFİS — yazılım, danışmanlık ve hukuk hizmetleri. Dayanıklılık testi belgesidir.",
    efatura: [["Yıldız Hukuk Bürosu", "İstanbul"], ["Kuzey Emlak Danışmanlık Ltd. Şti.", "Bursa"], ["Marmara Gıda San. ve Tic. A.Ş.", "Kocaeli"], ["Anadolu Turizm Otelcilik A.Ş.", "Nevşehir"]],
    persons: [["Ayşe Yılmaz", "Ayşe", "Yılmaz", "10000000146", "İzmir"], ["Mehmet Kaya", "Mehmet", "Kaya", "10000000078", "Ankara"]],
    firm: ["Güneş Kafe Gıda Ltd. Şti.", "Antalya"] },
  { code: "002", name: "ATLAS YAPI MALZEMELERİ LTD. ŞTİ.", scenario: "goods_sale", start: seq + 500_000, login: "atlas",
    seller: { name: "ATLAS YAPI MALZEMELERİ LTD. ŞTİ.", taxNo: SELLER_VKN, taxOffice: "Ostim", address: "Ostim OSB 1234. Cd. No: 8", district: "Yenimahalle", city: "Ankara", postalCode: "06374", email: "satis@atlasyapi.com.tr", logo: jpeg("DestekOfis-Logo-Fatura-Yatay.jpg"), stamp: jpeg("DestekOfis-Logo-Fatura-Kare.jpg"), banks: [{ name: "Örnek Katılım Bankası A.Ş.", iban: "TR040020500009000012345678" }] },
    footer: "ATLAS YAPI — teslimde irsaliye ile kontrol ediniz. Dayanıklılık testi belgesidir.",
    efatura: [["Başkent İnşaat Taahhüt A.Ş.", "Ankara"], ["Ege Tekstil Konfeksiyon Ltd. Şti.", "Denizli"], ["Akdeniz Otelcilik ve Turizm A.Ş.", "Muğla"], ["Toros Elektronik Ticaret A.Ş.", "Mersin"]],
    persons: [["Can Öztürk", "Can", "Öztürk", "10000000146", "Eskişehir"], ["Elif Şahin", "Elif", "Şahin", "10000000078", "Kayseri"]],
    firm: ["Deniz Oto Servis Ltd. Şti.", "Konya"] },
];
const ROLES = ["muhasebe", "avukat", "muhasebe", "muhasebe", "avukat"];

// ---------- Tarayıcı ve ekran yardımcıları ----------
const browser = await chromium.launch();
const modal = ".hof-modal-backdrop.is-visible";
const last = `${modal}:last-of-type`;
const inv = `${modal} .hof-invoices-modal`;
const errors = [];
const session = async (tag, login, pass_, companyId) => {
  const context = await browser.newContext({ viewport: { width: 1360, height: 900 }, locale: "tr-TR" });
  await context.addInitScript(() => {
    window.__toasts = [];
    document.addEventListener("DOMContentLoaded", () => {
      document.head.appendChild(Object.assign(document.createElement("style"), { textContent: "#hof-license-bar,.hof-license-notice{display:none!important}" }));
      new MutationObserver(list => { for (const m of list) for (const n of m.addedNodes) if (n.nodeType === 1 && (n.matches?.(".hof-toast") || n.querySelector?.(".hof-toast"))) window.__toasts.push((n.matches(".hof-toast") ? n : n.querySelector(".hof-toast")).textContent.replace(/\s+/g, " ").trim()); }).observe(document.body, { childList: true, subtree: true });
    });
  });
  const page = await context.newPage();
  page.setDefaultTimeout(30000);
  page.on("pageerror", error => errors.push(`${tag}: ${error.message}`));
  const pause = ms => page.waitForTimeout(ms);
  const ui = {
    tag, page, pause, context,
    textOf: selector => page.$eval(selector, node => node.textContent.replace(/\s+/g, " ").trim()).catch(() => ""),
    toasts: () => page.evaluate(() => (window.__toasts || []).splice(0)).catch(() => []),
    shot: name => page.screenshot({ path: path.join(OUT, "ekran", `${tag}-${name}.png`) }),
    closeAll: async () => { for (let i = 0; i < 6 && (await page.$(modal)); i += 1) { await page.keyboard.press("Escape"); await pause(250); } },
    yesIfAsked: async (tries = 12) => { for (let i = 0; i < tries; i += 1) { await pause(400); const yes = await page.$(`${modal} [data-answer="yes"]`); if (yes) { await yes.click().catch(() => {}); return true; } } return false; },
    clickAct: async act => { await page.waitForSelector(`${inv} [data-act="${act}"]`, { timeout: 30000 }); await page.click(`${inv} [data-act="${act}"]`); },
    openDoc: async id => { await ui.closeAll(); await page.evaluate(docId => window.HOF.invoices.openDoc(docId), id); await page.waitForSelector(`${inv} .hof-inv-pills`, { timeout: 30000 }); await pause(400); },
    getJson: async url => { const r = await page.request.get(base + url); return { status: r.status(), data: await r.json().then(d => (d && "ok" in d ? (d.ok ? d.data : d) : d)).catch(() => null) }; },
    postJson: async (url, body = {}) => { const r = await page.request.post(base + url, { data: body, headers: { "content-type": "application/json" } }); return { status: r.status(), data: await r.json().then(d => (d && "ok" in d ? (d.ok ? d.data : d) : d)).catch(() => null) }; },
    getBuffer: async url => { const r = await page.request.get(base + url); return { status: r.status(), buffer: await r.body() }; },
  };
  await page.goto(`${base}/`);
  await page.fill("#hof-auth input[name=username]", login);
  await page.fill("#hof-auth input[name=password]", pass_);
  await Promise.all([page.waitForEvent("load"), page.click('#hof-auth button[type="submit"]')]);
  await page.waitForSelector("#hof-sidecard", { timeout: 60000 });
  const current = await page.evaluate(async () => (await (await fetch("/api/companies")).json()));
  const now = current?.data?.current || current?.current;
  if (companyId && now !== companyId) {
    await page.evaluate(async id => fetch("/api/companies/select", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ id }) }), companyId);
    await page.reload();
    await page.waitForSelector("#hof-sidecard", { timeout: 60000 });
  }
  await page.waitForFunction(() => Boolean(window.HOF?.invoices?.open), null, { timeout: 30000 });
  return ui;
};
const typeMoney = value => String(value).replace(".", ",");
// Kaydettikten sonra: belge kartı (durum rozetleri) açılır ya da formda program iletisi (ret) görünür.
const waitIssued = async ui => {
  const outcome = await Promise.race([
    ui.page.waitForSelector(`${inv} .hof-inv-pills`, { timeout: 60000 }).then(() => "card", () => "timeout"),
    ui.page.waitForFunction(sel => [...document.querySelectorAll(sel)].some(n => n.offsetParent && n.textContent.trim()), `${inv} .hof-form-error`, { timeout: 60000, polling: 500 }).then(() => "error", () => "timeout"),
  ]);
  if (outcome === "timeout") throw new Error("60 sn içinde belge kartı da program iletisi de görünmedi");
  if (outcome === "error") {
    await ui.pause(500);
    if (await ui.page.$(`${inv} .hof-inv-pills`)) return;
    throw new Error(`program reddetti: ${await ui.textOf(`${inv} .hof-form-error`)}`);
  }
};
// Yeni satış belgesi: ekrandan, insan hızında (adim13 newSale + stok satırında fiyat da yazılır).
const newSale = async (ui, scenario, account, lines, { profile = "" } = {}) => {
  const { page, pause } = ui;
  await ui.closeAll();
  await page.click("#hof-sidecard [data-action=invoices]");
  await page.waitForSelector(`${inv} [data-act="new"]`);
  await page.click(`${inv} [data-act="new"]`);
  await page.click(`${inv} [data-scenario="${scenario}"]`);
  await page.waitForSelector(`${inv} [data-lines]`);
  await page.click(`${inv} [data-acc-query]`);
  await page.keyboard.type(account.query, { delay: 25 });
  await page.waitForSelector(`${inv} .hof-acc-picker li[data-id="${account.id}"]`, { timeout: 20000 });
  await (await page.$(`${inv} .hof-acc-picker li[data-id="${account.id}"]`)).dispatchEvent("mousedown");
  await pause(700);
  for (const [index, line] of lines.entries()) {
    if (index > 0) { await page.click(`${inv} [data-act="add-line"]`); await pause(300); }
    const f = field => `${inv} [data-l="${index}"][data-f="${field}"]`;
    await page.click(f("name"));
    if (line.itemId) {
      await page.keyboard.type(line.ad, { delay: 20 });
      const hit = `${inv} li[data-item="${line.itemId}"]`;
      await page.waitForSelector(hit, { timeout: 20000 });
      await page.click(hit);
      await pause(500);
    } else {
      await page.keyboard.type(line.ad, { delay: 20 });
      await page.keyboard.press("Tab");
      await page.click(f("unit"), { clickCount: 3 });
      await page.keyboard.type(line.birim, { delay: 20 });
      await page.keyboard.press("Tab");
    }
    for (const [field, value] of [["qty", line.miktar], ["unitPrice", line.birim_fiyat]]) {
      await page.click(f(field), { clickCount: 3 });
      await page.keyboard.type(typeMoney(value), { delay: 20 });
      await page.keyboard.press("Tab");
    }
    await page.selectOption(f("vatRate"), String(line.kdv));
    await pause(250);
    if (line.iskonto) { await page.click(f("discountRate"), { clickCount: 3 }); await page.keyboard.type(typeMoney(line.iskonto), { delay: 20 }); await page.keyboard.press("Tab"); }
    if (line.tevkifat || line.istisna) {
      const hidden = await page.$eval(`${inv} tr[data-line="${index}"] + tr .hof-inv-line-more, ${inv} tr[data-line="${index}"] .hof-inv-line-more`, node => node.hidden).catch(() => true);
      if (hidden) { await page.click(`${inv} [data-act="line-more"][data-l="${index}"]`); await pause(300); }
      if (line.tevkifat) await page.selectOption(f("withholdingCode"), line.tevkifat);
      if (line.istisna) await page.selectOption(f("exemptionCode"), line.istisna);
      await pause(300);
    }
  }
  await pause(500);
  if (profile) {
    await page.waitForSelector(`${inv} [data-profile-field]:not([hidden]) select`, { timeout: 20000 });
    await page.selectOption(`${inv} [data-f="profile"]`, profile);
    await pause(400);
  }
};
// Cari kartı ekrandan (adim12 newAccount): VKN/TCKN yazılınca program mükellef sorgusu yapar; e-Fatura mükellefinde posta kutusu seçilir.
const newAccount = async (admin, db, { name, taxNo, partyKind = "", firstName = "", familyName = "", pk = "", city = "İstanbul", email = "" }) => {
  const { page } = admin;
  await admin.closeAll();
  await page.evaluate(() => window.HOF.accounts.newFor({}));
  await page.waitForSelector(`${modal} input[name="taxNo"]`);
  await page.click(`${modal} input[name="name"]`);
  await page.keyboard.type(name, { delay: 25 });
  if (partyKind) await page.selectOption(`${modal} select[name="partyKind"]`, partyKind);
  await page.click(`${modal} input[name="taxNo"]`);
  await page.keyboard.type(taxNo, { delay: 25 });
  await page.keyboard.press("Tab");
  if (pk) {
    const state = await Promise.race([
      page.waitForSelector(`${last} select[name="alias"]`, { timeout: 60000 }).then(() => "modal", () => "timeout"),
      page.waitForFunction(value => document.querySelector('input[name="eAlias"]')?.value === value, pk, { timeout: 60000 }).then(() => "filled", () => "timeout"),
    ]);
    if (state === "timeout") throw new Error(`cari ${name}: posta kutusu seçimi 60 sn'de gelmedi`);
    if (state === "modal") {
      await page.selectOption(`${last} select[name="alias"]`, pk);
      await page.click(`${last} .hof-form button[type="submit"]`);
      await page.waitForFunction(value => document.querySelector('input[name="eAlias"]')?.value === value, pk, { timeout: 15000 });
    }
  } else await admin.pause(3000);
  for (const [field, value] of [["firstName", firstName], ["familyName", familyName], ["taxOffice", "Merkez"], ["address", "Test Cd. 1"], ["district", "Merkez"], ["city", city], ["email", email]]) {
    const sel = `${modal} [name="${field}"]`;
    if (value && (await page.$(sel))) { await page.click(sel); await page.fill(sel, ""); await page.keyboard.type(value, { delay: 15 }); }
  }
  await page.click(`${modal} .hof-form button[type="submit"]`);
  await admin.yesIfAsked(5);
  for (let i = 0; i < 30 && !db.prepare("SELECT id FROM accounts WHERE name = ?").get(name); i += 1) await admin.pause(500);
  const row = db.prepare("SELECT id, name, tax_no AS taxNo, e_invoice AS eInvoice, e_alias AS eAlias FROM accounts WHERE name = ?").get(name);
  if (!row) { await admin.shot(`cari-${taxNo}`).catch(() => {}); throw new Error(`cari ekrandan açılamadı: ${name} — ${await admin.textOf(`${modal} .hof-form-error`)} ${JSON.stringify(await admin.toasts())}`); }
  log(`CARİ (ekrandan) ${name}`, row);
  return row;
};

const result = { mode: DRY ? "KURU (sahte EDM)" : "GERÇEK EDM TEST", tohum: TOHUM, sure_dk: SURE_DK, tempo_sn: TEMPO_SN, seri: seq, bulgular: [], kullanicilar: [], dagilim: {}, araRaporlar: [] };
const state = {};
const docs = []; // izlenen belgeler
const actions = []; // iptal / durum sorgula eylemleri
let uiErrors = 0;
let dbs = {};
let reportTimer = null;
let sessions = [];
try {
  // ---------- Şirketler, ayarlar, stok ----------
  const listed = await get("/api/companies");
  const c1 = listed.data.current;
  await put(`/api/companies/${c1}`, { name: COMPANIES[0].name });
  const created = await post("/api/companies", { code: "002", name: COMPANIES[1].name, select: false });
  if (created.status !== 200) throw new Error(`şirket 002: ${JSON.stringify(created.data)}`);
  COMPANIES[0].id = c1;
  COMPANIES[1].id = created.data.company.id;
  let meta = null;
  for (const company of COMPANIES) {
    await selectCompany(company.id);
    await post("/api/workspace/bank/setup/dismiss", {});
    const s = await put("/api/workspace/invoices/settings", {
      seller: company.seller, efatura: true, earsiv: true,
      start: { [`TEF${year}`]: company.start, [`TEA${year}`]: company.start },
      defaults: { footer: company.footer }, eView: { enabled: true, logo: true, banks: true, footer: true, stamp: true, stampEfatura: true },
      integrator: { env: "test", baseUrl: DRY ? mock.url : "", username, password, senderAlias: GB, mailboxAlias: PK, autoCheckUser: true },
    });
    check(s.status === 200, `${company.code} Fatura Ayarları (logo, kaşe e-Faturada da, banka, alt not, Ortam Test) (${s.status} ${s.status === 200 ? "" : JSON.stringify(s.data).slice(0, 200)})`);
    const t = await post("/api/workspace/invoices/integrator/test", {});
    check(t.status === 200, `${company.code} Bağlantıyı Test Et (${t.status} ${t.status === 200 ? "" : JSON.stringify(t.data).slice(0, 200)})`);
    meta = (await get("/api/workspace/invoices/meta")).data;
    const items = [];
    if (company.code === "002") {
      for (const [name, unit, salePrice, unitPrice, vat, sector, decimal] of STOCK) {
        const r = await post("/api/workspace/stock", { name, unit, kind: "goods", salePrice, unitPrice, vatRate: vat, openingQty: OPENING_QTY, openingPay: "none" });
        if (r.status !== 200) throw new Error(`stok ${name}: ${JSON.stringify(r.data)}`);
        items.push({ name, unit, salePrice, vat, sector, decimal: Boolean(decimal), id: r.data.id || r.data.item?.id });
      }
    }
    state[company.code] = { company, items };
  }
  const programWithholding = new Map((meta.withholding || []).map(w => [w.code, w]));
  const TEV = KAHIN_TEVKIFAT.filter(code => programWithholding.has(code));
  const IST = ISTENEN_ISTISNA.filter(code => (meta.exemptions || []).some(e => e.code === code));
  const smmScenario = Object.entries(meta.scenarios || {}).find(([, v]) => v.kind === "smm")?.[0] || "";
  result.programKodlari = { tevkifat: TEV.map(c => ({ code: c, num: programWithholding.get(c).num, den: programWithholding.get(c).den })), istisna: IST, tumIstisna: (meta.exemptions || []).map(e => e.code), smmScenario };
  log("PROGRAM KODLARI", result.programKodlari);
  check(TEV.length === KAHIN_TEVKIFAT.length, `tevkifat kodları programda var (${TEV.join(", ")}; eksik ${KAHIN_TEVKIFAT.filter(c => !TEV.includes(c)).join(", ") || "yok"})`);
  check(IST.length === ISTENEN_ISTISNA.length, `istisna kodları programda var (${IST.join(", ")}; eksik ${ISTENEN_ISTISNA.filter(c => !IST.includes(c)).join(", ") || "yok"})`);
  dbs = Object.fromEntries(COMPANIES.map(c => [c.code, new DatabaseSync(dbFileOf(app.companies.get(c.id)), { readOnly: true })]));

  // ---------- Cariler: EKRANDAN (yönetici oturumu) ----------
  for (const company of COMPANIES) {
    await selectCompany(company.id);
    const st = state[company.code];
    // Mükellef olmayan geçerli VKN (EDM'de sorgulanır).
    let firmVkn = "";
    for (let probe = company.code === "001" ? 11 : 51, tries = 0; tries < 10 && !firmVkn; tries += 1, probe += 1) {
      const candidate = mockVkn(300000000 + probe * 7777 + (company.code === "001" ? 0 : 99));
      const q = await post("/api/workspace/invoices/check-user", { taxNo: candidate });
      if (q.status === 200 && q.data?.registered === false) firmVkn = candidate;
    }
    if (!firmVkn) throw new Error(`${company.code}: mükellef olmayan VKN bulunamadı`);
    for (const [, , , id] of company.persons) {
      const q = await post("/api/workspace/invoices/check-user", { taxNo: id });
      check(q.status === 200 && q.data?.registered === false, `${company.code} TCKN ${id} e-Fatura mükellefi değil (e-Arşiv alıcısı) (${q.status} ${JSON.stringify(q.data).slice(0, 80)})`);
    }
    const admin = await session(`yonetici-${company.code}`, "admin", ADMIN_PASSWORD, company.id);
    const db = dbs[company.code];
    st.accounts = { efatura: [], person: [], firm: [] };
    for (const [name, city] of company.efatura) {
      const row = await newAccount(admin, db, { name, taxNo: EF_VKN, pk: PK, city });
      check(row.eInvoice === 1 && row.eAlias === PK, `${company.code} ${name}: e-Fatura mükellefi, posta kutusu ${row.eAlias}`);
      st.accounts.efatura.push({ ...row, query: name.split(" ")[0], taxId: EF_VKN });
    }
    for (const [name, firstName, familyName, id, city] of company.persons) {
      const row = await newAccount(admin, db, { name, taxNo: id, partyKind: "person", firstName, familyName, city, email: "alici@example.com" });
      check(row.eInvoice === 0, `${company.code} ${name} (TCKN): e-Arşiv alıcısı`);
      st.accounts.person.push({ ...row, query: firstName, taxId: id });
    }
    {
      const [name, city] = company.firm;
      const row = await newAccount(admin, db, { name, taxNo: firmVkn, city, email: "muhasebe@example.com" });
      check(row.eInvoice === 0, `${company.code} ${name} (VKN ${firmVkn}, mükellef değil): e-Arşiv alıcısı`);
      st.accounts.firm.push({ ...row, query: name.split(" ")[0], taxId: firmVkn });
    }
    await admin.context.close();
  }

  // ---------- Kullanıcılar: şirket başına 5 (yalnız kendi şirketi) ----------
  const users = [];
  for (const company of COMPANIES) {
    for (const [i, role] of ROLES.entries()) {
      const login = `${company.login}${i + 1}`;
      const pw = `Dayan!2026-${login}x`;
      const r = await post("/api/admin/users", { username: login, name: `${company.code === "001" ? "Destek" : "Atlas"} Kullanıcı ${i + 1}`, role, password: pw, mustChangePassword: false });
      if (r.status !== 200) throw new Error(`kullanıcı ${login}: ${JSON.stringify(r.data)}`);
      const id = app.store.get("SELECT id FROM users WHERE username = ?", login).id;
      const a = await put(`/api/companies/access/${id}`, { companies: [company.id] });
      if (a.status !== 200) throw new Error(`yetki ${login}: ${JSON.stringify(a.data)}`);
      users.push({ login, pw, role, id, company: company.code, companyId: company.id, ui: i, index: users.length });
    }
  }
  result.kullanicilar = users.map(({ login, role, company }) => ({ login, role, company }));
  sessions = await Promise.all(users.map(u => session(u.login, u.login, u.pw, u.companyId)));
  log("OTURUMLAR", sessions.map(s => s.tag));
  const rowOf = (code, id) => dbs[code].prepare("SELECT id, kind, number, ettn, profile, type_code AS typeCode, status, e_status AS eStatus, e_message AS eMessage, try_payable AS payable, account_id AS accountId FROM invoices WHERE id = ?").get(id);
  const lastCreatedBy = (code, actorId) => dbs[code].prepare("SELECT entity_id AS id FROM audit_events WHERE type = 'invoice.created' AND actor_id = ? ORDER BY created_at DESC, rowid DESC LIMIT 1").get(actorId)?.id || "";

  // ---------- e-SMM denemesi (bir kez; döngüye girmez; yönetici, ekrandan): sonucu BULGU ----------
  // İki davranış kabul edilir: (a) 2.4.0 — "e-SMM kullanıcısıyım" var, makbuz TES/ESMM, gönderim 409 → "e-SMM gönderilemiyor";
  // (b) 2.4.1 — e-SMM gizli: Entegratör Ayarları → Firma / Etiket Tanımları'nda input[data-i="esmm"] YOK, PUT {esmm:true} → 400
  // esmm-unavailable, makbuz kâğıt (SMM serisi, KAGIT) → "e-SMM gizli (beklenen)". Başka her şey "beklenmeyen".
  console.log("\n■ e-SMM denemesi (001, yönetici ekranından)");
  {
    const bulgu = { senaryo: smmScenario };
    let admin = null;
    try {
      await selectCompany(COMPANIES[0].id);
      // start haritası bütün olarak gönderilir (kısmi harita öbür serilerin başlangıcını sıfırlıyor — KURU koşu 2'de görüldü: TEF 000000001'den başladı).
      const enable = await put("/api/workspace/invoices/settings", { esmm: true, start: { [`TEF${year}`]: COMPANIES[0].start, [`TEA${year}`]: COMPANIES[0].start, [`TES${year}`]: COMPANIES[0].start } });
      const after = (await get("/api/workspace/invoices/settings")).data;
      const settingsData = after?.settings || after || {};
      bulgu.ayar = { putStatus: enable.status, putCode: enable.data?.code || enable.data?.error?.code || "", putIleti: String(enable.data?.error?.message || enable.data?.message || enable.data?.error || "").slice(0, 160), esmmAvailable: settingsData.esmmAvailable, esmm: settingsData.esmm };
      admin = await session("yonetici-esmm", "admin", ADMIN_PASSWORD, COMPANIES[0].id);
      const { page } = admin;
      await page.click("#hof-sidecard [data-action=invoices]");
      await page.waitForSelector(`${inv} [data-act="integrator"]`);
      await page.click(`${inv} [data-act="integrator"]`);
      await page.waitForSelector(`${modal} [data-integ-root] [data-integ-tab="firm"]`);
      await page.click(`${modal} [data-integ-root] [data-integ-tab="firm"]`);
      await admin.pause(800);
      bulgu.ekrandaIsaret = Boolean(await page.$(`${modal} [data-integ-root] input[data-i="esmm"]`));
      await admin.shot("esmm-firma-sekmesi");
      await admin.closeAll();
      const acc = await post("/api/workspace/accounts", { name: "Zeki Müvekkil", type: "customer", partyKind: "person", firstName: "Zeki", familyName: "Müvekkil", taxNo: tckn(424242), taxOffice: "Merkez", address: "Adliye Cd. 3", district: "Merkez", city: "İstanbul", email: "muvekkil@example.com" });
      state["001"].smmAccount = acc.data?.id || acc.data?.account?.id;
      if (!smmScenario) throw new Error("programda smm senaryosu yok");
      await newSale(admin, smmScenario, { id: state["001"].smmAccount, query: "Zeki" }, [{ ad: "Avukatlık Ücreti", birim: "Adet", miktar: 1, birim_fiyat: 5000, kdv: 20 }]);
      bulgu.formDugmeleri = await page.$$eval(`${inv} .hof-actions [data-act]`, nodes => nodes.map(n => `${n.dataset.act}:${n.textContent.trim()}`)).catch(() => []);
      await admin.shot("esmm-form");
      await admin.toasts();
      const adminId = app.store.get("SELECT id FROM users WHERE username = 'admin'").id;
      const before = lastCreatedBy("001", adminId);
      const act = (await page.$(`${inv} [data-act="issue-now"]`)) ? "issue-now" : "issue";
      bulgu.kaydetDugmesi = act;
      await page.click(`${inv} [data-act="${act}"]`);
      await admin.yesIfAsked();
      await waitIssued(admin).catch(error => { bulgu.kaydetHatasi = String(error.message).slice(0, 200); });
      await admin.pause(2500);
      const id = lastCreatedBy("001", adminId);
      const row1 = id && id !== before ? rowOf("001", id) : null;
      bulgu.kesim = { no: row1?.number, profil: row1?.profile, eStatus: row1?.eStatus, eMessage: row1?.eMessage, iletiler: await admin.toasts() };
      if (row1) {
        state["001"].smmDoc = row1.id;
        if (await page.$(`${inv} [data-act="e-send"]`)) {
          await page.click(`${inv} [data-act="e-send"]`);
          await admin.yesIfAsked(6);
          await admin.pause(3000);
          const row2 = rowOf("001", id);
          bulgu.kartGonder = { eStatus: row2.eStatus, eMessage: row2.eMessage, iletiler: await admin.toasts() };
        } else bulgu.kartGonder = { not: "kartta e-Belge Gönder düğmesi yok" };
        const r = await admin.postJson(`/api/workspace/invoices/${id}/send`, {});
        bulgu.gonderApi = { status: r.status, code: r.data?.code || r.data?.error?.code || "", ileti: String(r.data?.error?.message || r.data?.message || r.data?.error || JSON.stringify(r.data)).slice(0, 200) };
        bulgu.son = { eStatus: rowOf("001", id).eStatus };
      }
      await admin.shot("esmm-kart");
    } catch (error) { bulgu.hata = String(error?.message || error).slice(0, 300); }
    await admin?.context.close().catch(() => {});
    const no = String(bulgu.kesim?.no || "");
    const sentOk = ["sent", "accepted", "processing"].includes(bulgu.son?.eStatus);
    if (bulgu.ayar?.putStatus === 400 && bulgu.ayar?.putCode === "esmm-unavailable" && bulgu.ekrandaIsaret === false && bulgu.kesim?.profil === "KAGIT" && /^SMM/.test(no)) bulgu.sonuc = "(b) e-SMM gizli (beklenen, 2.4.1 davranışı): işaret yok, API 400 esmm-unavailable, makbuz kâğıt SMM serisi";
    else if (bulgu.ayar?.putStatus === 200 && (/^TES/.test(no) || bulgu.kesim?.profil === "ESMM") && !sentOk && bulgu.gonderApi?.status === 409) bulgu.sonuc = "(a) e-SMM gönderilemiyor (2.4.0 davranışı): makbuz TES/ESMM numarası aldı, gönderim 409";
    else if (sentOk) bulgu.sonuc = "BEKLENMEYEN: e-SMM EDM'ye gönderildi";
    else bulgu.sonuc = "BEKLENMEYEN: ne (a) ne (b) — ayrıntı bulguda";
    result.bulgular.push({ konu: "e-SMM", ...bulgu });
    log("BULGU e-SMM", bulgu);
  }

  // ---------- Plan üretimi (tohumlu; ekrana yazılacak girdiler) ----------
  const planDoc = (rng, user, n) => {
    const company = COMPANIES.find(c => c.code === user.company);
    const st = state[user.company];
    const turu = rng.weighted([["eF-Temel", 35], ["eF-Ticari", 20], ["eA-Kisi", 28], ["eA-Firma", 17]]);
    const account = turu.startsWith("eF") ? rng.pick(st.accounts.efatura) : turu === "eA-Kisi" ? rng.pick(st.accounts.person) : st.accounts.firm[0];
    const count = rng.weighted([[1, 35], [2, 30], [3, 20], [4, 10], [5, 5]]);
    const kalemler = [];
    let sektor;
    const qtyOf = (decimal, unit, price) => (decimal ? rng.pick([0.5, 1.25, 2.5, 3, 7.5, 12.75, 40, 125.5]) : price < 500 && rng.chance(0.4) ? rng.int(10, 200) : rng.int(1, price > 10000 ? 3 : 12));
    if (user.company === "001") {
      sektor = rng.pick(Object.keys(SERVICE_SECTORS));
      const pool = [...SERVICE_SECTORS[sektor]];
      for (let i = 0; i < count; i += 1) {
        // Sektörün kalemleri bitince başka sektörden (aynı ad iki kez yazılmaz).
        const rest = Object.values(SERVICE_SECTORS).flat().filter(t => !kalemler.some(k => k.ad === t[0]));
        const [ad, birim, [min, max], kdv, tev, decimal] = pool.length ? pool.splice(Math.floor(rng.next() * pool.length), 1)[0] : rng.pick(rest);
        const price = rng.money(min, max);
        kalemler.push({ ad, birim, miktar: qtyOf(decimal, birim, price), birim_fiyat: price, kdv, uygunTev: tev });
      }
    } else {
      sektor = rng.pick(["İnşaat", "Gıda", "Tekstil", "Elektronik"]);
      const pool = st.items.filter(it => it.sector === sektor || rng.chance(0.15));
      for (let i = 0; i < count; i += 1) {
        if (i > 0 && rng.chance(0.12)) {
          const [ad, birim, [min, max], kdv, tev] = rng.pick(GOODS_SERVICES);
          if (!kalemler.some(k => k.ad === ad)) { kalemler.push({ ad, birim, miktar: rng.int(1, 6), birim_fiyat: rng.money(min, max), kdv, uygunTev: tev }); continue; }
        }
        const free = pool.filter(it => !kalemler.some(k => k.itemId === it.id));
        if (!free.length) break;
        const it = rng.pick(free);
        const price = rng.chance(0.5) ? it.salePrice : Math.round(it.salePrice * (0.9 + rng.next() * 0.2) * 100) / 100;
        kalemler.push({ itemId: it.id, ad: it.name, birim: it.unit, miktar: qtyOf(it.decimal, it.unit, price), birim_fiyat: price, kdv: it.vat, uygunTev: "" });
      }
    }
    for (const k of kalemler) k.iskonto = rng.chance(0.25) ? rng.pick([2, 5, 7.5, 10, 12.5, 15]) : 0;
    const firmBuyer = turu !== "eA-Kisi";
    const wantTev = firmBuyer && rng.chance(0.18);
    const wantIst = firmBuyer && rng.chance(0.12);
    const mixed = firmBuyer && rng.chance(0.05);
    if (wantTev || mixed) {
      let eligible = kalemler.filter(k => k.uygunTev && TEV.includes(k.uygunTev));
      if (!eligible.length) {
        const pool = Object.values(SERVICE_SECTORS).flat().filter(t => t[4] && TEV.includes(t[4]));
        const [ad, birim, [min, max], kdv, tev] = rng.pick(pool);
        if (!kalemler.some(k => k.ad === ad)) kalemler.push({ ad, birim, miktar: rng.int(1, 5), birim_fiyat: rng.money(min, max), kdv, uygunTev: tev, iskonto: 0 });
        eligible = kalemler.filter(k => k.uygunTev && TEV.includes(k.uygunTev));
      }
      for (const k of eligible) if (k === eligible[0] || rng.chance(0.6)) k.tevkifat = k.uygunTev;
    }
    if (wantIst || mixed) {
      const candidates = kalemler.filter(k => !k.tevkifat);
      // GİB: tevkifatlı belgenin tipi TEVKIFAT; aynı belgede yalnız 351 (istisna olmayan diğer) olabilir (program da böyle reddeder).
      const istOf = () => (kalemler.some(x => x.tevkifat) ? "351" : rng.pick(IST));
      if (candidates.length) { const k = rng.pick(candidates); k.kdv = 0; k.istisna = istOf(); }
      else if (kalemler.length < 5) {
        const k = user.company === "002" ? (() => { const it = rng.pick(st.items.filter(x => !kalemler.some(y => y.itemId === x.id))); return { itemId: it.id, ad: it.name, birim: it.unit, miktar: qtyOf(it.decimal, it.unit, it.salePrice), birim_fiyat: it.salePrice, kdv: 0, iskonto: 0 }; })() : { ad: "Yurt Dışı Danışmanlık Hizmeti", birim: "Saat", miktar: rng.int(2, 20), birim_fiyat: rng.money(900, 2400), kdv: 0, iskonto: 0 };
        k.istisna = istOf();
        kalemler.push(k);
      }
    }
    const hasTev = kalemler.some(k => k.tevkifat);
    const hasIst = kalemler.some(k => k.istisna);
    const rates = [...new Set(kalemler.map(k => k.kdv))].sort((a, b) => a - b);
    const senaryo = [turu, sektor, hasTev && hasIst ? "Tevkifat+İstisna" : hasTev ? "Tevkifat" : hasIst ? "İstisna" : "", rates.length > 1 ? `KDV ${rates.map(r => `%${r}`).join("+")}` : `KDV %${rates[0]}`, kalemler.some(k => k.iskonto) ? "İskonto" : ""].filter(Boolean).join(" · ");
    const gonderim = rng.chance(0.7) ? "issue-now" : "issue-later";
    const sonra = rng.weighted([["", 87], ["durum", 8], ["iptal", 5.5]]);
    return {
      plan_id: `${user.login}-${String(n).padStart(4, "0")}`, tohum: TOHUM, kullanici: user.login, rol: user.role, sirket: user.company, sira: n, senaryo, sektor, belge_turu: turu,
      alici_turu: turu === "eA-Kisi" ? "kişi (TCKN)" : turu === "eA-Firma" ? "mükellef olmayan firma (VKN)" : "e-Fatura mükellefi (VKN)",
      cari: account.name, cariId: account.id, alici_kimlik: account.taxId, satici_vkn: SELLER_VKN, profil: turu === "eF-Ticari" ? "TICARIFATURA" : turu === "eF-Temel" ? "TEMELFATURA" : "EARSIVFATURA",
      gonderim, fiyat_kdv_dahil: false, sonra, bekleme_sn: Math.round(TEMPO_SN * (0.5 + rng.next()) * 10) / 10,
      kalemler: kalemler.map(k => ({ ad: k.ad, ...(k.itemId ? { itemId: k.itemId, stok: true } : {}), birim: k.birim, miktar: k.miktar, birim_fiyat: k.birim_fiyat, iskonto: k.iskonto || 0, kdv: k.kdv, tevkifat: k.tevkifat || "", istisna: k.istisna || "" })),
      _account: account,
    };
  };

  // ---------- Ara rapor (her ARA_RAPOR_DK dk; tek satır) ----------
  const started = Date.now();
  const deadline = started + SURE_DK * 60_000;
  const statusCounts = () => {
    const counts = {};
    for (const code of Object.keys(dbs)) for (const r of dbs[code].prepare("SELECT status, e_status AS e, COUNT(*) AS n FROM invoices WHERE number LIKE 'TEF%' OR number LIKE 'TEA%' GROUP BY status, e_status").all()) counts[`${r.status}/${r.e}`] = (counts[`${r.status}/${r.e}`] || 0) + r.n;
    return counts;
  };
  const araRapor = label => {
    const line = `${label} ${Math.round((Date.now() - started) / 60000)} dk — belge ${docs.length} (001: ${docs.filter(d => d.sirket === "001").length}, 002: ${docs.filter(d => d.sirket === "002").length}), durum ${JSON.stringify(statusCounts())}, ekran hatası ${uiErrors}, iptal ${actions.filter(a => a.tur === "iptal" && a.ok).length}, sayfa hatası ${errors.length}`;
    console.log(`${stamp()} ${line}`);
    result.araRaporlar.push(`${stamp()} ${line}`);
  };
  reportTimer = setInterval(() => araRapor("ARA RAPOR"), ARA_RAPOR_DK * 60_000);

  // ---------- Kesim döngüsü ----------
  const issueOne = async (ui, user, p) => {
    const t0 = Date.now();
    const before = lastCreatedBy(user.company, user.id);
    try {
      await newSale(ui, state[user.company].company.scenario, p._account, p.kalemler, { profile: p.profil === "TICARIFATURA" ? "TICARIFATURA" : "" });
      await ui.toasts();
      await ui.page.click(`${inv} [data-act="${p.gonderim}"]`);
      await ui.yesIfAsked();
      await waitIssued(ui);
      await ui.pause(1200);
      const id = lastCreatedBy(user.company, user.id);
      if (!id || id === before) throw new Error(`belge kaydı bulunamadı; ileti ${JSON.stringify(await ui.toasts())} ${await ui.textOf(`${inv} .hof-form-error`)}`);
      if (p.gonderim === "issue-later") {
        const r0 = rowOf(user.company, id);
        if (!(r0.eStatus === "waiting" && r0.number === "")) log(`${ui.tag} ${p.plan_id} BEKLENMEYEN (Sonra Gönder)`, r0);
        await ui.clickAct("e-send");
        await ui.yesIfAsked(6);
        for (let i = 0; i < 60 && ["waiting", "none"].includes(rowOf(user.company, id).eStatus); i += 1) await ui.pause(500);
      }
      const row = rowOf(user.company, id);
      const toasts = await ui.toasts();
      const d = { plan_id: p.plan_id, sirket: user.company, kullanici: user.login, id, no: row.number, ettn: row.ettn, profil: row.profile, tip: row.typeCode, durum: row.status, eDurum: row.eStatus, odenecek: row.payable, cariId: row.accountId, sn: Math.round((Date.now() - t0) / 100) / 10, ileti: toasts.slice(-1)[0] || "" };
      docs.push({ ...d, plan: p, user, at: Date.now() });
      jsonl("belgeler.jsonl", d);
      log(`${ui.tag} ${p.plan_id} ${p.senaryo} ${p.gonderim}`, { no: row.number || "(numarasız)", tip: row.typeCode, e: row.eStatus, tutar: row.payable, sn: d.sn });
      return true;
    } catch (error) {
      uiErrors += 1;
      await ui.shot(`hata-${p.plan_id}`).catch(() => {});
      const msg = String(error?.message || error).slice(0, 400);
      const id = lastCreatedBy(user.company, user.id);
      const row = id && id !== before ? rowOf(user.company, id) : null;
      log(`${ui.tag} ${p.plan_id} HATA${row ? ` (belge yine de kaydedildi: ${row.number || row.id})` : ""}`, msg);
      jsonl("olaylar.jsonl", { tur: "ekran-hatasi", plan_id: p.plan_id, kullanici: user.login, hata: msg, belge: row ? { id: row.id, no: row.number, eDurum: row.eStatus } : null, at: new Date().toISOString() });
      if (row) {
        const d = { plan_id: p.plan_id, sirket: user.company, kullanici: user.login, id: row.id, no: row.number, ettn: row.ettn, profil: row.profile, tip: row.typeCode, durum: row.status, eDurum: row.eStatus, odenecek: row.payable, cariId: row.accountId, ekranHatasi: msg };
        docs.push({ ...d, plan: p, user, at: Date.now() });
        jsonl("belgeler.jsonl", d);
      }
      await ui.closeAll().catch(() => {});
      return false;
    }
  };
  const afterAction = async (ui, user, p, rng) => {
    if (p.sonra === "durum") {
      const mine = docs.filter(d => d.kullanici === user.login && d.no);
      if (!mine.length) return;
      const d = mine[Math.floor(rng.next() * mine.length)];
      try {
        await ui.openDoc(d.id);
        await ui.toasts();
        if (await ui.page.$(`${inv} [data-act="e-refresh"]`)) {
          await ui.clickAct("e-refresh");
          await ui.pause(2500);
        }
        const a = { tur: "durum", kullanici: user.login, no: d.no, eDurum: rowOf(user.company, d.id).eStatus, ileti: (await ui.toasts()).slice(-1)[0] || "", ok: true };
        actions.push(a);
        jsonl("olaylar.jsonl", { ...a, at: new Date().toISOString() });
      } catch (error) { uiErrors += 1; actions.push({ tur: "durum", kullanici: user.login, no: d.no, ok: false, hata: String(error.message).slice(0, 200) }); log(`${ui.tag} Durum Sorgula HATA ${d.no}`, String(error.message).slice(0, 300)); }
      await ui.closeAll().catch(() => {});
    } else if (p.sonra === "iptal") {
      // İnsan davranışı: kendi kestiği, gönderilmiş (en az IPTAL_YAS_DK önce) bir e-Arşivi iptal eder. EDM "henüz işleniyor" derse (programın
      // doğru yanıtı) kullanıcı kartta Durum Sorgula'ya basar, biraz bekler, yeniden dener (en çok 3 deneme).
      const eligible = docs.filter(d => d.kullanici === user.login && d.plan.belge_turu.startsWith("eA") && !d.iptalIstendi && Date.now() - d.at >= IPTAL_YAS_DK * 60_000 && rowOf(user.company, d.id)?.status === "issued" && rowOf(user.company, d.id)?.eStatus === "sent");
      if (!eligible.length) { actions.push({ tur: "iptal", kullanici: user.login, ok: null, not: "uygun gönderilmiş e-Arşiv yok" }); return; }
      const d = eligible[Math.floor(rng.next() * eligible.length)];
      d.iptalIstendi = true;
      const a = { tur: "iptal", kullanici: user.login, no: d.no, denemeler: [] };
      try {
        // Kullanıcı iptalden önce belgenin XML'ini indirir ("XML İndir"): program iptal edilmiş belgenin UBL'ini vermiyor (409; KURU koşu 3).
        const pre = await ui.getBuffer(`/api/workspace/invoices/${d.id}/ubl.xml`).catch(() => ({ status: 0 }));
        if (pre.status === 200) { writeFileSync(path.join(OUT, "xml", `${d.no}.xml`), pre.buffer); d.xmlOnceden = true; }
        // Programın PDF'i de iptalden önce alınır: iptal edilmiş belgenin PDF'inde karekod yok ("İPTAL EDİLDİ" damgası; KURU koşu 4).
        const prePdf = await ui.getBuffer(`/api/workspace/invoices/${d.id}/fatura.pdf`).catch(() => ({ status: 0 }));
        if (prePdf.status === 200) { writeFileSync(path.join(OUT, "pdf-program", `${d.no}.pdf`), prePdf.buffer); d.programPdfOnceden = true; }
        // EDM resmî PDF'i de iptalden önce (gerçek koşu karekod denetimi iptal edilmemiş görüntüyle yapılır; iptal sonrası görüntü ayrıca saklanır).
        const preOfficial = await ui.getBuffer(`/api/workspace/invoices/${d.id}/resmi.pdf`).catch(() => ({ status: 0 }));
        if (preOfficial.status === 200 && preOfficial.buffer.subarray(0, 5).toString("latin1") === "%PDF-") { writeFileSync(path.join(OUT, "pdf", `${d.no}.pdf`), preOfficial.buffer); d.resmiOnceden = true; }
        for (let attempt = 1; attempt <= 3; attempt += 1) {
          await ui.openDoc(d.id);
          await ui.toasts();
          await ui.clickAct("cancel");
          await ui.page.waitForSelector(`${last} input[name="reason"]`);
          await ui.page.click(`${last} input[name="reason"]`);
          await ui.page.keyboard.type("Müşteri talebiyle iptal (dayanıklılık testi)", { delay: 20 });
          await ui.page.click(`${last} button[type="submit"]`);
          for (let i = 0; i < 40 && rowOf(user.company, d.id).status !== "cancelled" && !(await ui.textOf(`${last} .hof-form-error`)); i += 1) await ui.pause(500);
          const row = rowOf(user.company, d.id);
          const formHatasi = await ui.textOf(`${last} .hof-form-error`);
          a.denemeler.push({ durum: row.status, eDurum: row.eStatus, formHatasi, ileti: (await ui.toasts()).slice(-1)[0] || "" });
          if (row.status === "cancelled" || !/işleniyor/i.test(formHatasi)) break;
          await ui.closeAll();
          await ui.openDoc(d.id);
          if (await ui.page.$(`${inv} [data-act="e-refresh"]`)) await ui.clickAct("e-refresh");
          await ui.pause(DRY ? 2000 : 45_000);
        }
        const row = rowOf(user.company, d.id);
        Object.assign(a, { durum: row.status, eDurum: row.eStatus, ok: row.status === "cancelled" });
        actions.push(a);
        jsonl("olaylar.jsonl", { ...a, at: new Date().toISOString() });
        log(`${ui.tag} e-Arşiv İPTAL ${d.no}`, { durum: row.status, e: row.eStatus, deneme: a.denemeler.length, ileti: a.denemeler.map(x => x.formHatasi || x.ileti).join(" | ") });
        if (!a.ok) uiErrors += 1;
      } catch (error) { uiErrors += 1; actions.push({ ...a, ok: false, hata: String(error.message).slice(0, 200) }); log(`${ui.tag} İPTAL HATA ${d.no}`, String(error.message).slice(0, 300)); }
      await ui.closeAll().catch(() => {});
    }
  };
  const worker = async index => {
    const user = users[index];
    const rng = makeRng("dayaniklilik", TOHUM, user.login);
    let n = 0;
    let consecutive = 0;
    while (Date.now() < deadline) {
      n += 1;
      const p = planDoc(rng, user, n);
      const { _account, ...record } = p;
      jsonl("plan.jsonl", record);
      let ui = sessions[index];
      if (ui.page.isClosed()) { log(`${user.login} oturum kapanmış; yeniden giriş`); sessions[index] = ui = await session(user.login, user.login, user.pw, user.companyId); }
      const ok = await issueOne(ui, user, p);
      consecutive = ok ? 0 : consecutive + 1;
      if (ok) await afterAction(ui, user, p, rng);
      if (consecutive >= 3 || n % 25 === 0) { await ui.page.reload().catch(() => {}); await ui.page.waitForSelector("#hof-sidecard", { timeout: 60000 }).catch(() => {}); await ui.page.waitForFunction(() => Boolean(window.HOF?.invoices?.open), null, { timeout: 30000 }).catch(() => {}); }
      const wait = Math.min(p.bekleme_sn * 1000, Math.max(0, deadline - Date.now()));
      if (wait > 0) await sleep(wait);
    }
    return n;
  };
  console.log(`\n■ ${users.length} kullanıcı aynı anda başlıyor — süre ${SURE_DK} dk, tempo ${TEMPO_SN} sn (±%50), tohum ${TOHUM}, seri başı ${seq}`);
  araRapor("BAŞLANGIÇ");
  const planned = await Promise.all(users.map((_, i) => worker(i)));
  clearInterval(reportTimer);
  araRapor("KESİM BİTTİ");
  result.kesim = { sure_sn: Math.round((Date.now() - started) / 1000), planlanan: planned.reduce((a, b) => a + b, 0), kesilen: docs.length, ekranHatasi: uiErrors, ortalamaBelgeSn: Math.round(docs.filter(d => d.sn).reduce((s, d) => s + d.sn, 0) / Math.max(1, docs.filter(d => d.sn).length) * 10) / 10 };
  log("KESİM", result.kesim);

  // ---------- Son durum: Durum Sorgula (her kullanıcı kendi belgeleri; 10 paralel, EDM'yi zorlamadan) ----------
  console.log(`\n■ Durum Sorgula — ${docs.length} belge, son duruma kadar (en çok ${SETTLE_DK} dk)`);
  const settleEnd = Date.now() + SETTLE_DK * 60_000;
  const finalStates = new Set(["sent", "accepted", "rejected", "cancelled", "error"]);
  const srng = makeRng("bekleme", TOHUM);
  for (let round = 1; ; round += 1) {
    await Promise.all(users.map(async (user, i) => {
      for (const d of docs.filter(x => x.kullanici === user.login && x.no)) {
        const r = rowOf(user.company, d.id);
        if (round > 1 && finalStates.has(r.eStatus)) continue;
        if (r.status === "cancelled" && r.eStatus === "cancelled") continue;
        const st = await sessions[i].postJson(`/api/workspace/invoices/${d.id}/e-refresh`, {}).catch(error => ({ status: 0, data: String(error.message) }));
        if (st.status !== 200) jsonl("olaylar.jsonl", { tur: "durum-sorgula-hatasi", no: d.no, status: st.status, ileti: JSON.stringify(st.data).slice(0, 200), at: new Date().toISOString() });
      }
    }));
    const counts = statusCounts();
    const open = docs.filter(d => d.no && !finalStates.has(rowOf(d.sirket, d.id).eStatus)).length;
    log(`DURUM TURU ${round}`, { ...counts, acik: open });
    if (!open || Date.now() > settleEnd) break;
    await sleep(DRY ? 2000 : 40_000 + Math.floor(srng.next() * 20_000));
  }
  for (const d of docs) { const r = rowOf(d.sirket, d.id); Object.assign(d, { no: r.number, ettn: r.ettn, profil: r.profile, tip: r.typeCode, durum: r.status, eDurum: r.eStatus, eMesaj: r.eMessage, odenecek: r.payable, cariId: r.accountId }); }
  writeFileSync(path.join(OUT, "belgeler.jsonl"), docs.map(({ plan, user, iptalIstendi, ...d }) => mask(JSON.stringify(d))).join("\n") + (docs.length ? "\n" : ""));

  // ---------- XML + resmî PDF + program PDF (en çok 6 eşzamanlı) ----------
  console.log("\n■ XML ve PDF indiriliyor (en çok 6 eşzamanlı)");
  const queue = docs.filter(d => d.no).map((d, k) => ({ d, k }));
  const dl = { xml: 0, pdf: 0, programPdf: 0, hata: [], iptalSonrasiXml: [] };
  const sessionOf = d => sessions[d.user.index];
  await Promise.all(Array.from({ length: 6 }, async () => {
    for (let job = queue.shift(); job; job = queue.shift()) {
      const { d, k } = job;
      const ui = sessionOf(d);
      const x = await ui.getBuffer(`/api/workspace/invoices/${d.id}/ubl.xml`).catch(error => ({ status: 0, buffer: Buffer.from(String(error.message)) }));
      if (x.status === 200) { writeFileSync(path.join(OUT, "xml", `${d.no}.xml`), x.buffer); dl.xml += 1; }
      else if (d.durum === "cancelled" && d.xmlOnceden) { dl.xml += 1; dl.iptalSonrasiXml.push(`${d.no}: ${x.status} ${x.buffer.subarray(0, 160).toString("utf8")}`); }
      else dl.hata.push(`${d.no} xml ${x.status} ${x.buffer.subarray(0, 120).toString("utf8")}`);
      const p = await ui.getBuffer(`/api/workspace/invoices/${d.id}/resmi.pdf`).catch(error => ({ status: 0, buffer: Buffer.from(String(error.message)) }));
      if (p.status === 200 && p.buffer.subarray(0, 5).toString("latin1") === "%PDF-") { writeFileSync(path.join(OUT, "pdf", d.resmiOnceden ? `${d.no}-iptal-sonrasi.pdf` : `${d.no}.pdf`), p.buffer); dl.pdf += 1; }
      else if (d.resmiOnceden) { dl.pdf += 1; dl.hata.push(`${d.no} resmi.pdf (iptal sonrası, bilgi) ${p.status}`); } else dl.hata.push(`${d.no} resmi.pdf ${p.status} ${p.buffer.subarray(0, 120).toString("utf8")}`);
      if (d.durum === "cancelled" && d.programPdfOnceden) {
        d.programPdf = true;
        const q = await ui.getBuffer(`/api/workspace/invoices/${d.id}/fatura.pdf`).catch(() => ({ status: 0 }));
        if (q.status === 200) { writeFileSync(path.join(OUT, "pdf-program", `${d.no}-iptal-sonrasi.pdf`), q.buffer); d.programPdfIptal = true; }
      } else if (k % PROGRAM_PDF_ORAN === 0) {
        const q = await ui.getBuffer(`/api/workspace/invoices/${d.id}/fatura.pdf`).catch(error => ({ status: 0, buffer: Buffer.from(String(error.message)) }));
        if (q.status === 200) { writeFileSync(path.join(OUT, "pdf-program", `${d.no}.pdf`), q.buffer); dl.programPdf += 1; d.programPdf = true; } else dl.hata.push(`${d.no} fatura.pdf ${q.status}`);
      }
    }
  }));
  const withNo = docs.filter(d => d.no);
  check(dl.xml === withNo.length, `UBL XML indirildi ${dl.xml}/${withNo.length} (iptal edilenlerin XML'i iptalden önce indirildi: ${dl.iptalSonrasiXml.length})${dl.hata.filter(h => / xml /.test(h)).length ? ` — ${dl.hata.filter(h => / xml /.test(h)).slice(0, 3).join(" | ")}` : ""}`);
  if (dl.iptalSonrasiXml.length) { result.gozlemler = [...(result.gozlemler || []), `İptal edilmiş e-Arşivin UBL XML'i programdan indirilemiyor (resmî PDF iniyor): ${dl.iptalSonrasiXml[0]}`]; log("GÖZLEM iptal sonrası XML", dl.iptalSonrasiXml.slice(0, 3)); }
  check(dl.pdf === withNo.length, `EDM resmî PDF indirildi ${dl.pdf}/${withNo.length}${dl.hata.filter(h => /resmi\.pdf/.test(h)).length ? ` — ${dl.hata.filter(h => /resmi\.pdf/.test(h)).slice(0, 3).join(" | ")}` : ""}`);
  result.indirme = dl;

  // ---------- Denetim işçileri: XSD + şematron, görünüm, karekod ----------
  console.log(`\n■ XSD + GİB şematronu + görünüm şablonu + karekod (${ISCI} işçi)`);
  const items = withNo.filter(d => existsSync(path.join(OUT, "xml", `${d.no}.xml`))).map(d => ({
    no: d.no, xml: path.join(OUT, "xml", `${d.no}.xml`), type: d.profil === "EARSIVFATURA" ? "earsiv" : "efatura",
    pdfs: [...(DRY ? [] : [{ kaynak: "resmi", path: path.join(OUT, "pdf", `${d.no}.pdf`) }]), ...(d.programPdf ? [{ kaynak: "program", path: path.join(OUT, "pdf-program", `${d.no}.pdf`) }] : []), ...(d.programPdfIptal ? [{ kaynak: "program-iptal-sonrasi", path: path.join(OUT, "pdf-program", `${d.no}-iptal-sonrasi.pdf`) }] : []), ...(!DRY && existsSync(path.join(OUT, "pdf", `${d.no}-iptal-sonrasi.pdf`)) ? [{ kaynak: "resmi-iptal-sonrasi", path: path.join(OUT, "pdf", `${d.no}-iptal-sonrasi.pdf`) }] : [])],
    expected: { no: d.no, ettn: d.ettn, vkn: SELLER_VKN, odenecek: d.odenecek },
  }));
  const tAudit = Date.now();
  const chunks = Array.from({ length: ISCI }, (_, i) => items.filter((_, k) => k % ISCI === i)).filter(c => c.length);
  const audit = (await Promise.all(chunks.map((chunk, i) => new Promise((resolve, reject) => {
    const inFile = path.join(WORK, `isci-${i}-girdi.json`);
    const outFile = path.join(WORK, `isci-${i}-cikti.json`);
    writeFileSync(inFile, JSON.stringify({ workDir: path.join(WORK, `isci-${i}`), items: chunk }));
    // Görünüm şablonu derleme önbelleği (belge başına ~0,3 MB; karekod şablonda olduğu için her belgede ayrı) sistem /tmp yerine çalışma klasörüne.
    const tmp = path.join(WORK, "tmp");
    mkdirSync(tmp, { recursive: true });
    const child = spawn(process.execPath, [SELF, "--denetim-iscisi", inFile, outFile], { stdio: ["ignore", "inherit", "inherit"], env: { ...process.env, TMPDIR: tmp } });
    child.on("exit", code => (code === 0 ? resolve(JSON.parse(readFileSync(outFile, "utf8"))) : reject(new Error(`denetim işçisi ${i} çıkış ${code}`))));
  })))).flat();
  log("DENETİM SÜRESİ (sn)", Math.round((Date.now() - tAudit) / 1000));
  const byNo = new Map(audit.map(a => [a.no, a]));
  for (const a of audit) for (const [kaynak, qr] of Object.entries(a.qr || {})) if (!kaynak.endsWith("-iptal-sonrasi")) jsonl("karekod.jsonl", { no: a.no, kaynak, json: qr.json || null, hata: qr.error || "" });
  for (const kaynak of ["program-iptal-sonrasi", "resmi-iptal-sonrasi"]) {
    const afterCancel = audit.filter(a => a.qr?.[kaynak]);
    if (!afterCancel.length) continue;
    const noQr = afterCancel.filter(a => !a.qr[kaynak].json);
    result.gozlemler = [...(result.gozlemler || []), `İptal edilmiş belgenin ${kaynak.startsWith("program") ? "program" : "EDM resmî"} PDF'inde karekod: ${afterCancel.length - noQr.length}/${afterCancel.length} okundu (okunmayan ${noQr.map(a => a.no).slice(0, 5).join(", ") || "yok"}); karekod denetimi iptalden önce indirilen PDF ile yapıldı`];
    log(`GÖZLEM ${kaynak} karekodu`, `${afterCancel.length - noQr.length}/${afterCancel.length} okundu`);
  }
  const badXml = audit.filter(a => a.error || a.xsd?.length || a.schematron?.length);
  check(audit.length === withNo.length && !badXml.length, `XML: XSD + GİB şematronu temiz ${audit.length - badXml.length}/${withNo.length}${badXml.length ? ` — ${badXml.slice(0, 3).map(a => `${a.no}: ${a.error || [...(a.xsd || []), ...(a.schematron || [])][0]}`).join(" | ")}` : ""}`);
  const badView = audit.filter(a => !(a.view?.gib && a.view?.kase && a.view?.logo));
  check(audit.length && !badView.length, `görünüm şablonu: logo + GİB logosu + Kaşe / İmza ${audit.length - badView.length}/${audit.length}${badView.length ? ` — ${badView.slice(0, 3).map(a => `${a.no}: ${JSON.stringify(a.view)}`).join(" | ")}` : ""}`);
  if (DRY) skip("karekod (resmî PDF): atlandı (sahte EDM — resmî PDF'te karekod yok)");
  else {
    const qrBad = audit.filter(a => !a.qr?.resmi?.match?.ok);
    check(!qrBad.length, `karekod (EDM resmî PDF) çözüldü ve no/ettn/vkn/ödenecek belgeyle aynı ${audit.length - qrBad.length}/${audit.length}${qrBad.length ? ` — ${qrBad.slice(0, 3).map(a => `${a.no}: ${a.qr?.resmi?.match?.why}`).join(" | ")}` : ""}`);
  }
  const progQr = audit.filter(a => a.qr?.program);
  const progBad = progQr.filter(a => !a.qr.program.match?.ok);
  check(progQr.length > 0 && !progBad.length, `karekod (programın PDF'i, her ${PROGRAM_PDF_ORAN}. belge) aynı ${progQr.length - progBad.length}/${progQr.length}${progBad.length ? ` — ${progBad.slice(0, 3).map(a => `${a.no}: ${a.qr.program.match?.why}`).join(" | ")}` : ""}`);
  result.gorunumOrnek = audit[0]?.view;

  // ---------- Kesim denetimleri ----------
  console.log("\n■ Numara, ETTN, gönderim, son durum, tür");
  check(docs.length > 0, `ekrandan kesilen belge ${docs.length} (planlanan ${result.kesim.planlanan})`);
  check(uiErrors === 0, `ekran hatası yok (${uiErrors}; ayrıntı olaylar.jsonl)`);
  for (const company of COMPANIES) {
    const db = dbs[company.code];
    for (const prefix of [`TEF${year}`, `TEA${year}`]) {
      const nums = db.prepare("SELECT number FROM invoices WHERE number LIKE ? ORDER BY number").all(`${prefix}%`).map(r => r.number);
      const tracked = docs.filter(d => d.sirket === company.code && d.no?.startsWith(prefix)).length;
      const consecutive = nums.every((no, i) => Number(no.slice(7)) === company.start + i);
      check(new Set(nums).size === nums.length && consecutive && nums.length === tracked, `${company.code} ${prefix} benzersiz + boşluksuz ${nums[0] || "-"} … ${nums.at(-1) || "-"} (${nums.length}; izlenen ${tracked})`);
    }
    const untracked = db.prepare("SELECT id, number FROM invoices WHERE kind = 'sale' AND status IN ('issued','cancelled')").all().filter(r => !docs.some(d => d.id === r.id));
    check(!untracked.length, `${company.code} izlenmeyen satış belgesi yok (${untracked.map(r => r.number || r.id).slice(0, 5).join(", ") || "0"})`);
  }
  const ettns = withNo.map(d => d.ettn);
  check(new Set(ettns).size === ettns.length && ettns.every(Boolean), `ETTN'ler benzersiz (${ettns.length})`);
  const sendCount = d => dbs[d.sirket].prepare("SELECT COUNT(*) AS n, MAX(actor_id) AS actor FROM audit_events WHERE type = 'invoice.e.sent' AND entity_id = ?").get(d.id);
  const multi = withNo.filter(d => sendCount(d).n !== 1);
  check(!multi.length, `her belge EDM'ye BİR kez gönderildi (invoice.e.sent) ${withNo.length - multi.length}/${withNo.length}${multi.length ? ` — ${multi.slice(0, 5).map(d => `${d.no}:${sendCount(d).n}`).join(", ")}` : ""}`);
  const wrongActor = withNo.filter(d => sendCount(d).actor !== d.user.id);
  check(!wrongActor.length, `her belge kesen kullanıcının adıyla gönderildi (${wrongActor.length} aykırı)`);
  const cancelledDocs = withNo.filter(d => d.durum === "cancelled");
  const badFinal = withNo.filter(d => (d.durum === "cancelled" ? !(d.plan.belge_turu.startsWith("eA") && d.eDurum === "cancelled") : !["sent", "accepted"].includes(d.eDurum)));
  check(!badFinal.length, `son durumlar: ${withNo.length - cancelledDocs.length} Gönderildi/Kabul, ${cancelledDocs.length} e-Arşiv iptal${badFinal.length ? ` — AYKIRI ${badFinal.slice(0, 5).map(d => `${d.no}:${d.durum}/${d.eDurum} ${d.eMesaj || ""}`).join(" | ")}` : ""}`);
  const iptalIstek = actions.filter(a => a.tur === "iptal" && a.ok !== null);
  check(iptalIstek.every(a => a.ok), `ekrandan e-Arşiv iptali ${iptalIstek.filter(a => a.ok).length}/${iptalIstek.length} (belgelerin %${((cancelledDocs.length / Math.max(1, withNo.length)) * 100).toFixed(1)}'i)`);
  const durumIstek = actions.filter(a => a.tur === "durum");
  check(durumIstek.every(a => a.ok), `ekrandan Durum Sorgula ${durumIstek.filter(a => a.ok).length}/${durumIstek.length}`);
  const wrongProfile = withNo.filter(d => d.profil !== d.plan.profil);
  check(!wrongProfile.length, `profil plana uygun (TEMEL/TİCARİ/e-Arşiv) ${withNo.length - wrongProfile.length}/${withNo.length}${wrongProfile.length ? ` — ${wrongProfile.slice(0, 3).map(d => `${d.no}: ${d.profil} ≠ ${d.plan.profil}`).join(" | ")}` : ""}`);
  const wantType = d => { const t = d.plan.kalemler.some(k => k.tevkifat), i = d.plan.kalemler.some(k => k.istisna); return t && i ? null : t ? "TEVKIFAT" : i ? null : "SATIS"; };
  const wrongType = withNo.filter(d => wantType(d) && d.tip !== wantType(d));
  check(!wrongType.length, `fatura tipi: tevkifatlı → TEVKIFAT, düz → SATIS (istisnalı/karışık bilgi olarak) ${withNo.length - wrongType.length}/${withNo.length}${wrongType.length ? ` — ${wrongType.slice(0, 3).map(d => `${d.no}: ${d.tip} ≠ ${wantType(d)}`).join(" | ")}` : ""}`);
  const dist = (key) => withNo.reduce((acc, d) => { acc[key(d)] = (acc[key(d)] || 0) + 1; return acc; }, {});
  result.dagilim = {
    belgeTuru: dist(d => d.plan.belge_turu), sektor: dist(d => `${d.sirket} ${d.plan.sektor}`), tip: dist(d => d.tip), gonderim: dist(d => d.plan.gonderim),
    kdv: dist(d => [...new Set(d.plan.kalemler.map(k => k.kdv))].sort((a, b) => a - b).join("+")), kalemSayisi: dist(d => d.plan.kalemler.length),
    birim: withNo.flatMap(d => d.plan.kalemler.map(k => k.birim)).reduce((acc, u) => ((acc[u] = (acc[u] || 0) + 1), acc), {}),
    tevkifat: withNo.flatMap(d => d.plan.kalemler.map(k => k.tevkifat).filter(Boolean)).reduce((acc, u) => ((acc[u] = (acc[u] || 0) + 1), acc), {}),
    istisna: withNo.flatMap(d => d.plan.kalemler.map(k => k.istisna).filter(Boolean)).reduce((acc, u) => ((acc[u] = (acc[u] || 0) + 1), acc), {}),
    iskontolu: withNo.filter(d => d.plan.kalemler.some(k => k.iskonto)).length, karisikTevIst: withNo.filter(d => d.plan.kalemler.some(k => k.tevkifat) && d.plan.kalemler.some(k => k.istisna)).length,
  };
  log("DAĞILIM", result.dagilim);
  // Kapsam: kataloğun her öğesi koşuda en az bir kez (belge türleri en az 3 kez) çıktı mı?
  {
    const g = result.dagilim;
    const missing = [
      ...["eF-Temel", "eF-Ticari", "eA-Kisi", "eA-Firma"].filter(k => (g.belgeTuru[k] || 0) < 3).map(k => `belge türü ${k}`),
      ...TEV.filter(k => !g.tevkifat[k]).map(k => `tevkifat ${k}`), ...IST.filter(k => !g.istisna[k]).map(k => `istisna ${k}`),
      ...["Çuval", "Teneke", "Kg", "Lt", "M²", "Saat", "Gün", "Ay", "Paket", "Kutu", "Adet"].filter(u => !g.birim[u]).map(u => `birim ${u}`),
      ...["0", "1", "10", "20"].filter(r => !Object.keys(g.kdv).some(k => k.split("+").includes(r))).map(r => `KDV %${r}`),
      ...(Object.keys(g.kdv).some(k => k.includes("+")) ? [] : ["karışık KDV"]), ...(g.iskontolu ? [] : ["iskonto"]), ...(g.karisikTevIst ? [] : ["tevkifat + istisna"]),
      ...(g.gonderim["issue-later"] ? [] : ["Kaydet, Sonra Gönder"]), ...(actions.some(x => x.tur === "iptal" && x.ok) ? [] : ["e-Arşiv iptali"]), ...(actions.some(x => x.tur === "durum" && x.ok) ? [] : ["Durum Sorgula"]),
      ...[...Object.keys(SERVICE_SECTORS).map(k => `001 ${k}`), ...["İnşaat", "Gıda", "Tekstil", "Elektronik"].map(k => `002 ${k}`)].filter(k => !g.sektor[k]).map(k => `sektör ${k}`),
    ];
    check(!missing.length, `senaryo kapsamı: katalogdaki her tür/kod/birim/sektör/davranış koşuda çıktı${missing.length ? ` — ÇIKMAYAN: ${missing.join(", ")}` : ""}`);
  }

  // ---------- Bakiye, stok, defter, şirket ayrımı ----------
  console.log("\n■ Cari bakiyeleri, stok, defter bütünlüğü, şirket ayrımı");
  for (const company of COMPANIES) {
    await selectCompany(company.id);
    const st = state[company.code];
    for (const account of [...st.accounts.efatura, ...st.accounts.person, ...st.accounts.firm]) {
      const r = await get(`/api/workspace/accounts/${account.id}`);
      const balance = Number(r.data?.totals?.balance ?? NaN);
      const mine = withNo.filter(d => d.sirket === company.code && d.cariId === account.id && d.durum !== "cancelled");
      const expected = mine.reduce((s, d) => s + cents(d.odenecek), 0) / 100;
      check(near(balance, expected), `${company.code} ${account.name} bakiyesi ${balance} = gönderilmiş (iptal hariç) ${mine.length} belge ${expected.toFixed(2)}`);
    }
    if (company.code === "002") {
      const bad = [];
      for (const item of st.items) {
        const r = await get(`/api/workspace/stock/${item.id}`);
        const qty = Number(r.data?.item?.qty ?? r.data?.qty ?? NaN);
        const sold = withNo.filter(d => d.sirket === "002" && d.durum !== "cancelled").flatMap(d => d.plan.kalemler.filter(k => k.itemId === item.id)).reduce((s, k) => s + Math.round(Number(k.miktar) * 1000), 0) / 1000;
        if (Math.abs(OPENING_QTY - sold - qty) > 0.0005) bad.push(`${item.name}: ${qty} ≠ ${OPENING_QTY} − ${sold}`);
      }
      check(!bad.length, `002 stok miktarları = açılış − satılan (iptal hariç; plan miktarları) ${st.items.length - bad.length}/${st.items.length}${bad.length ? ` — ${bad.slice(0, 3).join(" | ")}` : ""}`);
    }
    const gate = await get("/api/workspace/ledger/integrity");
    check(gate.status === 200 && gate.data?.ok !== false && !(gate.data?.problems || []).length, `${company.code} defter bütünlüğü temiz (${gate.status} ${JSON.stringify(gate.data).slice(0, 120)})`);
  }
  {
    const [a, b] = COMPANIES;
    const leaked = withNo.filter(d => dbs[d.sirket === a.code ? b.code : a.code].prepare("SELECT 1 FROM invoices WHERE id = ? OR (number = ? AND number <> '')").get(d.id, d.no));
    const foreignAcc = [...a.efatura.map(x => x[0]), a.firm[0]].filter(name => dbs[b.code].prepare("SELECT 1 FROM accounts WHERE name = ?").get(name));
    check(!leaked.length && !foreignAcc.length, `iki şirketin verisi karışmadı (öbür şirkette görünen belge ${leaked.length}, cari ${foreignAcc.length})`);
    const other = withNo.find(d => d.sirket === b.code);
    if (other) {
      const cross = await sessions[0].getJson(`/api/workspace/invoices/${other.id}`);
      check(cross.status === 404 || cross.status === 403, `001 kullanıcısı 002'nin belgesini göremiyor (${cross.status})`);
    }
  }

  // ---------- Bağımsız kâhin + diş kanıtı ----------
  console.log("\n■ Kâhin (kahin.py, bağımsız)");
  const runKahin = extra => { try { return { code: 0, out: execFileSync("python3", ["-I", path.join(HERE, "kahin.py"), OUT, ...extra], { encoding: "utf8", maxBuffer: 64 * 1024 * 1024 }) }; } catch (error) { return { code: error.status ?? -1, out: String(error.stdout || "") + String(error.stderr || "") }; } };
  const kahin = runKahin([]);
  console.log(kahin.out.split("\n").slice(0, 40).join("\n"));
  check(kahin.code === 0, `kâhin (görev kuralı: KDV oran başına yuvarlama): bütün belgeler AYNI (çıkış ${kahin.code}; ${kahin.out.split("\n")[0]}; ayrıntı kahin-sonuc.txt)`);
  const kahinSatir = runKahin(["--kdv-kurali", "satir", "--cikis", path.join(OUT, "kahin-sonuc-satir.txt")]);
  console.log(kahinSatir.out.split("\n").slice(0, 20).join("\n"));
  check(kahinSatir.code === 0, `kâhin (KDV satır başına yuvarlama; kural kararı ana oturumda): bütün belgeler AYNI (çıkış ${kahinSatir.code}; ${kahinSatir.out.split("\n")[0]}; ayrıntı kahin-sonuc-satir.txt)`);
  result.kahin = { oranBasina: { cikis: kahin.code, ozet: kahin.out.split("\n").slice(0, 2).join(" ") }, satirBasina: { cikis: kahinSatir.code, ozet: kahinSatir.out.split("\n")[0] } };
  console.log("\n■ Diş kanıtı (dis-kaniti.mjs)");
  const dis = (() => { try { return { code: 0, out: execFileSync(process.execPath, [path.join(HERE, "dis-kaniti.mjs"), OUT, path.join(WORK, "dis")], { encoding: "utf8", maxBuffer: 16 * 1024 * 1024 }) }; } catch (error) { return { code: error.status ?? -1, out: String(error.stdout || "") + String(error.stderr || "") }; } })();
  console.log(dis.out.trim());
  check(dis.code === 0, `diş kanıtı: üç bozulma da kırmızı (çıkış ${dis.code})`);
  result.dis = { cikis: dis.code };

  result.belgeler = withNo.map(d => ({ no: d.no, sirket: d.sirket, kullanici: d.kullanici, senaryo: d.plan.senaryo, cari: d.plan.cari, tip: d.tip, profil: d.profil, durum: `${d.durum}/${d.eDurum}`, odenecek: d.odenecek }));
} catch (error) {
  log("HATA", String(error?.stack || error).slice(0, 1500));
  fail += 1;
  checks.push({ ok: false, what: `koşu yarıda kaldı: ${String(error?.message || error).slice(0, 200)}` });
} finally {
  if (reportTimer) clearInterval(reportTimer);
  log("SAYFA HATALARI", errors.length ? errors.slice(0, 20) : "yok");
  check(!errors.length, `kullanıcı sayfalarında hata yok (${errors.length})`);
  result.eylemler = actions;
  result.sayfaHatalari = errors;
  result.denetimler = checks;
  result.sonuc = { gecti: pass, kaldi: fail };
  writeFileSync(path.join(OUT, "sonuc.json"), mask(JSON.stringify(result, null, 1)));
  console.log(`SONUÇ: ${pass} geçti, ${fail} kaldı`);
  process.exitCode = fail ? 1 : 0;
  for (const db of Object.values(dbs)) { try { db.close(); } catch {} }
  await browser.close().catch(() => {});
  await app?.close().catch(() => {});
  await mock?.close();
}
