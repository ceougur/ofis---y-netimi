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
  const out = { mod: "", cikti: "", beklenen: "", uzerine: false };
  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    if (arg === "--gercek") out.mod = out.mod ? "çift" : "gercek";
    else if (arg === "--kuru") out.mod = out.mod ? "çift" : "kuru";
    else if (arg === "--cikti") out.cikti = argv[(i += 1)] || "";
    else if (arg === "--beklenen") out.beklenen = argv[(i += 1)] || "";
    else if (arg === "--uzerine-yaz") out.uzerine = true;
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
    console.error("kullanım: EDM_TEST_KULLANICI=… EDM_TEST_PAROLA=… node tools/edm-gercek.mjs --gercek | --kuru [--cikti <klasör>] [--beklenen <json>] [--uzerine-yaz]");
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
  const mask = maskeci([password, username, adminPassword]);
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
  const OUT = path.resolve(args.cikti || path.join(ROOT, "docs", "kanit", startDay, "244-edm", ...(args.mod === "kuru" ? ["kuru"] : [])));
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
  const { EDM_URLS, EDM_SMM_URLS, createEdmClient, createEdmSmmClient } = await import(pathToFileURL(path.join(ROOT, "server", "lib", "einvoice", "edm.mjs")).href);
  const { integratorSmmUrl, integratorUrl } = await import(pathToFileURL(path.join(ROOT, "server", "lib", "einvoice", "adapters.mjs")).href);
  const { cachedResolver, createProxyFetch } = await import(pathToFileURL(path.join(ROOT, "server", "lib", "net-proxy.mjs")).href);
  const { vkn } = await import(pathToFileURL(path.join(ROOT, "test", "einvoice-mock.mjs")).href);

  const bekci = { izinli: [], reddedilen: [] };
  const nativeFetch = globalThis.fetch;
  globalThis.fetch = bekciFetch(nativeFetch, { mod: args.mod, kayit: bekci });
  const root = mkdtempSync(path.join(tmpdir(), "edm-gercek-"));
  const dataDir = path.join(root, "data");
  // Programın üretimdeki dış istek yolu (vekil sunucu ayarı + ortam değişkenleri) bekçinin arkasında.
  const appFetch = bekciFetch(createProxyFetch({ resolve: cachedResolver({ file: path.join(dataDir, "ag-ayari.json"), env: process.env }), baseFetch: (...a) => nativeFetch(...a) }), { mod: args.mod, kayit: bekci });

  let mock = null;
  let app = null;
  let exitCode = 0;
  let stopped = "";
  const tracked = []; // EDM'ye gönderilen belgeler (OZET)
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
          const doc = store.get("SELECT number, ettn, issue_date AS issueDate, status, e_status AS eStatus, e_message AS eMessage, net_total AS brut, stoppage_total AS stopaj, vat_total AS kdv, payable_total AS odenecek, party_json AS party, cancelled_at AS cancelledAt FROM invoices WHERE id = ?", item.id) || {};
          const cancelAt = store.get("SELECT MIN(created_at) AS at FROM audit_events WHERE entity_id = ? AND type = 'invoice.e.cancelled'", item.id)?.at || "";
          let party = {};
          try {
            party = JSON.parse(doc.party || "{}");
          } catch {}
          return { kod: item.key, tur: item.type, no: doc.number || "", ettn: doc.ettn || "", tarih: doc.issueDate || "", gonderim: trTime(store.get("SELECT MIN(created_at) AS at FROM audit_events WHERE entity_id = ? AND type = 'invoice.e.sent'", item.id)?.at || ""), alici: party.name || "", brut: doc.brut, stopaj: item.type === "e-SMM" ? doc.stopaj : null, kdv: doc.kdv, odenecek: doc.odenecek, edmDurum: E_LABEL[doc.eStatus] || doc.eStatus || "", ileti: String(doc.eMessage || "").slice(0, 160), iptal: trTime(cancelAt) };
        })
      : [];
    const endedAt = new Date();
    const dayChanged = localDay(endedAt) !== startDay;
    if (dayChanged) exitCode = 4;
    const notes = steps.flatMap(item => (item.bilgiler || []).map(entry => `${item.adim}: ${entry.bilgi}`));
    const failed = steps.reduce((sum, item) => sum + item.denetimler.filter(entry => !entry.gecti).length, 0);
    const total = steps.reduce((sum, item) => sum + item.denetimler.length, 0);
    if (!exitCode && failed) exitCode = 1;
    const summary = { kip: args.mod, commit, baslangic: trTime(startedAt.toISOString()), bitis: trTime(endedAt.toISOString()), gunDegisti: dayChanged, durduruldu: stopped, denetim: { toplam: total, kalan: failed }, bilgi: notes, adimlar: steps.map(item => ({ adim: item.adim, durum: item.durum, kalan: item.denetimler.filter(entry => !entry.gecti).length })), belgeler: rows, bekci, cikis: exitCode };
    const lines = [
      `# EDM Test Ortamı — e-SMM uçtan uca (2.4.4 iş listesi 24)${args.mod === "kuru" ? " — KURU KOŞU" : ""}`,
      "",
      `**Test portalı:** ${TEST_URLS.portal} (Entegratör Ayarları'ndaki test kullanıcı adı ve parolasıyla) → ${PORTAL_NOTE}.`,
      args.mod === "kuru" ? "**KURU KOŞU:** sahte EDM (yerel, ağa çıkmadı) — aşağıdaki numaralar EDM'de YOKTUR; yalnız özetin biçimini gösterir." : "**Kip:** gerçek EDM test ortamı (yasal geçerliliği olmayan test belgeleri).",
      "",
      `Commit ${commit} · başlangıç ${summary.baslangic} · bitiş ${summary.bitis} (TR) · denetim ${total - failed}/${total} geçti · çıkış ${exitCode}${dayChanged ? " · GEÇERSİZ: koşu gece yarısını geçti (ders 22)" : ""}${stopped ? ` · DURDU: ${stopped}` : ""}`,
      "",
      `Adımlar: ${summary.adimlar.map(item => `${item.adim} ${item.durum}${item.kalan ? ` (${item.kalan} kalan)` : ""}`).join(" · ")}`,
      "",
      ...(notes.length ? ["Bilgi (denetim değil):", ...notes.map(item => `- ${item}`), ""] : []),
      "| Kod | Belge Türü | Belge No | ETTN / UUID | Belge Tarihi | Gönderim (TR) | Alıcı | Brüt | Stopaj | KDV | Net Ödenecek | EDM Son Durum | İptal (TR) |",
      "|---|---|---|---|---|---|---|---:|---:|---:|---:|---|---|",
      ...rows.map(item => `| ${item.kod} | ${item.tur} | ${item.no || "—"} | ${item.ettn || "—"} | ${item.tarih ? item.tarih.split("-").reverse().join(".") : "—"} | ${item.gonderim || "—"} | ${item.alici} | ${money(item.brut)} | ${item.stopaj === null ? "—" : money(item.stopaj)} | ${money(item.kdv)} | ${money(item.odenecek)} | ${item.edmDurum} | ${item.iptal || "—"} |`),
      "",
      "Brüt: e-SMM'de brüt ücret, e-Arşiv'de KDV hariç tutar. Net Ödenecek: e-SMM'de brüt − stopaj + KDV (tahsil edilecek), e-Arşiv'de KDV dahil toplam.",
      `Bekçi: izin verilen dış istek ${bekci.izinli.length}, reddedilen ${bekci.reddedilen.length}${bekci.reddedilen.length ? ` (${[...new Set(bekci.reddedilen)].join(", ")})` : ""}. Kimlik bilgisi bu dosyalarda yoktur.`,
      "",
    ];
    try {
      write("ozet.json", summary);
      writeFileSync(path.join(OUT, "OZET.md"), mask(lines.join("\n")));
      write("bekci.json", bekci);
      if (mock) write("kuru-edm-kaydi.json", { fatura: mock.state.calls.map(call => call.op), smm: mock.state.smm.calls.map(call => call.op), smmGonderilen: mock.state.smm.sent.map(item => item.id), smmIptal: mock.state.smm.cancelled.length, ihlaller: [...mock.state.violations, ...mock.state.smm.violations] });
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
      for (const [label, secret] of [["parola", password], ["kullanıcı adı", username]]) if (secret.length >= 3 && bytes.includes(Buffer.from(secret, "utf8"))) leaks.push(`${path.relative(OUT, file)} (${label})`);
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
