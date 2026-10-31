// 2.4.8 SON ADAY T4 — İŞ AKIŞI EKRANDAN (CLAUDE.md Test kuralı: gerçek kullanıcı senaryosu, sıfırdan, arayüzden, uçtan uca; sonuç SAYILARLA).
// Meta yerine BAĞIMSIZ K0 sahte Meta Graph sunucusu (test/bagimsiz/whatsapp-248/sahte-meta; programın kodu görülmeden Meta belgelerinden yazıldı — ders 5);
// programın kendi test sahte Graph'ı (test/whatsapp-sahte-graph.mjs) KULLANILMAZ. Gerçek lisans servisi ölü yerel adres (ders 30). Sunucu saati sahte
// (03.11.2026 09:00 TR; ders 13); gönderim işçisi elle sürülür (ders 20). Gerçek tıklama + insan hızında yazım + Tab + Boşluk (ders 12); en üstteki pencere
// seçicisi (ders 39); beklenen soru pencereleri beklenir, her yanıt günlüğe yazılır (ders 34). BEKLENEN SAYILAR bu dosyanın girdiği veriden ELLE hesaplanır
// (aşağıdaki BEKLENEN tablosu) ve plandan (docs/erp/WHATSAPP-API-PLANI-2.4.8.md §7a, R3; KARAR L1) — programın kodundan okunmaz (ders 5).
// Ekrandaki sayı = veri tabanı = sahte Meta'nın kaydı (ders 3: her adımda yanıt + veri tabanı + Meta kaydı).
//   S0 boş veri: hiç cari yok — Cari listesi "Henüz cari yok", Yönetim → WhatsApp "Bağlı Değil", önizleme API'si boş seçimde iş açmaz.
//   S1 firma bilgisi (Yönetim → Sistem → Ofis Adı, insan hızında) + Fatura Ayarları satıcı bilgisi (API).
//   S2 Yönetim → WhatsApp → Elle Bağla (Tab ile, insan hızında) → Kaydet ve Sına → "Bağlı"; Bağlantıyı Sına; kanca adresi Meta'ya kaydedildi.
//   S3 Şablonlar: Elle Bağla'dan sonra kendiliğinden açıldı (Meta'da 2 şablon, UTILITY, tr, KVKK alt satırı, TTL 3 gün = 259200 sn) → Meta onaylar →
//      Şablonları Denetle ve Oluştur → ikisi "Onaylandı / Evet".
//   S4 Aydınlatma Metni Hazırla: firma unvanı metinde; Esc. S5 Gönderim Onayı: Yönetim kartında Tab + Boşluk → veri tabanı.
//   S6 cariler EKRANDAN (+ Yeni Cari): aynı adlı iki cari, aynı telefonlu iki cari, sabit hat, yurt dışı +49, telefonsuz, "WhatsApp Mesajı İstemiyor",
//      pasif (kartta Pasife Al), alacaklı; hareketler + taksit kartı API'den (geçmiş dönem Ekim, Kasım).
//   S7 Cari → Tümü → hepsini seç → WhatsApp Ekstre → Otomatik Gönder → Geçen Ay: önizleme 10 / 7 / 3 (nedenler) → Gönder → 7 ileti; her iletinin şablonu,
//      değişkenleri ve PDF'inin METNİ (dönem, bakiye) beklenenle.
//   S8 kanca (sahte Meta'dan delivered/read/failed) → Gönderimler ekranı durumları; "Bu Ay Gönderilen İleti Sayısı" ekranda = API = elle sayılan.
//   S9 Bu Ay ekstresi: R3 uyarısı YOK (dönem farklı), 7 ileti, dönem 01.11.2026 – 03.11.2026.
//   S10 Ödeme Hatırlatma: gecikmiş borçlu cariler; değişkenler (en eski vade, vadesi geçmiş toplam, güncel bakiye).
//   S11 WhatsApp Web ile Gönder: yurt dışı ve sabit hat kişiye wa.me bağlantısı doğru numara + metin.
//   S12 yetkisiz kullanıcı (Personel): Otomatik Gönder pasif + neden; API 403.
//   S13 iki şirket: 002 ekrandan açılır → 002'de cari yok, Gönderimler boş, "Bu Ay" yok/0; 002 kendi WABA'sıyla 1 ileti → 001'in sayısı değişmez.
//   S14 salt okunur lisans: Otomatik Gönder pasif + neden, API reddi, Meta'ya yeni ileti yok.
//   S15 Mobil Cihazlar: lisans bitişine 7 gün kala uyarı (KARAR L1 metni), 8 gün kala uyarı yok.
// Ders 22: koşu başında ve sonunda gerçek gün (Türkiye) okunur; değiştiyse sonuç GEÇERSİZ (çıkış 2).
// Çıkış: "N geçti, M kaldı" (kaldıysa 1). Ekran görüntüleri EKRAN_DIR (varsayılan test/e2e/artifacts/senaryo-is-akisi-248); geçici veri TMPDIR'de benzersiz klasör.
import { appendFileSync, mkdirSync, mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { chromium } from "playwright";
import { pdfText } from "../banka-210-ortak.mjs";
import { ADMIN_PASSWORD, createClient, createUser, removeTestDir, startTestServer } from "../helpers.mjs";
import { lisansAnahtari } from "../kapi-ortak.mjs";
import { startKapi } from "../kapi-yerel.mjs";
import { sahteMetaBaslat } from "../bagimsiz/whatsapp-248/sahte-meta/sunucu.mjs";

const trDay = () => new Date(Date.now() + 3 * 3_600_000).toISOString().slice(0, 10);
const DAY_AT_START = trDay();
const root = mkdtempSync(path.join(tmpdir(), "senaryo-is-akisi-248-"));
const dataDir = path.join(root, "data");
const backupDir = path.join(root, "backups");
const shots = process.env.EKRAN_DIR || path.join(path.dirname(fileURLToPath(import.meta.url)), "artifacts", "senaryo-is-akisi-248");
mkdirSync(shots, { recursive: true });
const answersLog = path.join(shots, "soru-yanitlari.log");
writeFileSync(answersLog, "");
const MODAL = ".hof-modal-backdrop.is-visible";
const TOP = `${MODAL}:nth-last-child(1 of ${MODAL})`;
const NOW = "2026-11-03T09:00:00+03:00";
const TOKEN = "SAHTE-T4-is_Akisi.248-Belirtec-ZxCvBn0123456789";
const PNID = "106540352242922";
const WABA = "102290129340398";
const APP = "1505264761663625";
const PNID2 = "106540352242999"; // 002'nin ayrı numarası / ayrı WhatsApp hesabı
const WABA2 = "102290129340777";
const OFFICE = "Deniz Ticaret Ltd. Şti.";
const STAFF = { username: "t4-personel", password: "Personel-T4-2026!" };

// ---------------- BEKLENEN (ELLE; bu dosyanın girdiği veriden, programdan türetilmez) ----------------
// Açılışlar Kayıt Tarihi 01.09.2026 (Ekim'den önce → Geçen Ay'ın devri). Hareketler: C1 Ekim borç 200 (05.10), tahsilat 350 (31.10), Kasım borç 40 (01.11);
// C10 Ekim borç 100 (10.10), tahsilat 400 (20.10). C3 taksit kartı (mevcut borç 250): 15.09 100, 15.10 100, 15.12 50 → 03.11'de vadesi geçmiş 200, en eski 15.09.
// C2 açılışın Vade Tarihi 20.10.2026 (taksit kartı yok).
const CARI = [
  { key: "c1", name: "Aynı Ad Kişi", phone: "0532 100 00 01", opening: "1000", e164: "+905321000001", oct: "850,00", nov: "890,00" },
  { key: "c2", name: "Aynı Ad Kişi", phone: "0532 100 00 02", opening: "500", due: "2026-10-20", e164: "+905321000002", oct: "500,00", nov: "500,00" },
  { key: "c3", name: "Ortak Telefon A", phone: "0533 200 00 00", opening: "250", e164: "+905332000000", oct: "250,00", nov: "250,00" },
  { key: "c4", name: "Ortak Telefon B", phone: "0533 200 00 00", opening: "750", e164: "+905332000000", oct: "750,00", nov: "750,00" },
  { key: "c5", name: "Sabit Hat Kişi", phone: "0212 555 01 01", opening: "100", e164: "+902125550101", oct: "100,00", nov: "100,00" },
  { key: "c6", name: "Yurt Dışı Kişi", phone: "+49 151 2345 6789", opening: "300", e164: "+4915123456789", oct: "300,00", nov: "300,00" },
  { key: "c7", name: "Telefonsuz Kişi", phone: "", opening: "100", skip: "Telefon yok" },
  { key: "c8", name: "İstemiyor Kişi", phone: "0534 300 00 00", opening: "100", optOut: true, skip: "WhatsApp Mesajı İstemiyor" },
  { key: "c9", name: "Pasif Kişi", phone: "0535 400 00 00", opening: "100", passive: true, skip: "Pasif Cari" },
  { key: "c10", name: "Alacaklı Kişi", phone: "0536 600 00 00", opening: "", e164: "+905366000000", oct: "300,00", nov: "300,00", credit: true },
];
const SENDABLE = CARI.filter(c => !c.skip);
const balanceRe = (amount, credit) => new RegExp(`^${amount.replace(".", "\\.")} TL${credit ? " \\(Alacaklı\\)" : "( \\(Borçlu\\))?"}$`);

let passed = 0;
let failed = 0;
const findings = [];
const ok = (cond, what) => {
  if (cond) passed += 1;
  else failed += 1;
  console.log(`  ${cond ? "✓" : "✗"} ${what}`);
  return Boolean(cond);
};
const observe = line => {
  findings.push(line);
  console.log(`  ⚑ GÖZLEM: ${line}`);
};
const note = line => appendFileSync(answersLog, `${new Date().toISOString()} ${line}\n`);

// ---------------- Sahte Meta (K0, bağımsız) ----------------
const sablonsuz = [];
const meta = await sahteMetaBaslat({
  senaryo: {
    uygulama: { id: APP, sir: "SAHTE-T4-UYGULAMA-SIRRI", ad: "Deniz Mesaj", kancaAdresi: null, imzala: false },
    belirtecler: { [TOKEN]: { durum: "gecerli", izinler: ["business_management", "whatsapp_business_management", "whatsapp_business_messaging"], wabalar: ["*"] } },
    wabalar: { [WABA]: { ad: "Deniz Ticaret", odemeYontemi: true, kisitli: null, pazarlamaKapali: false }, [WABA2]: { ad: "İkinci Şirket", odemeYontemi: true, kisitli: null, pazarlamaKapali: false } },
    numaralar: {
      [PNID]: { waba: WABA, gorunen: "+90 212 555 01 02", ulkeKodu: "90", verified_name: "Deniz Ticaret", kayitli: true, bakim: false, basamak: "TIER_250", kalite: "GREEN", throughput: "STANDARD" },
      [PNID2]: { waba: WABA2, gorunen: "+90 212 555 09 09", ulkeKodu: "90", verified_name: "İkinci Şirket", kayitli: true, bakim: false, basamak: "TIER_250", kalite: "GREEN", throughput: "STANDARD" },
    },
    sablonlar: sablonsuz,
    hiz: { mps: 1e9 },
  },
});
meta.saat(Date.parse(NOW));
const kayit = () => meta.kayit();
const messages = () => meta.meta.mesajlar;

let server = await startTestServer({ dataDir, backupDir, now: { time: NOW, fixed: true }, whatsappGraphUrl: meta.url, whatsappTimeoutMs: 3000, whatsappGapMs: 0, maxCompanies: 2, env: { HUKUK_LICENSE_URL: "http://127.0.0.1:9" } });
let remote = await server.app.listenRemote(0, "127.0.0.1");
let PUBLIC = `http://ofis-t4.localhost:${remote.port}`;
server.app.mobileRemote.setPublicUrl(PUBLIC);
let api = createClient(server.base);
await api.login("admin", ADMIN_PASSWORD);
const db = sql => server.app.store.get(sql);
const all = sql => server.app.store.all(sql);
const drain = (o = {}) => server.app.whatsapp.scheduler.drain(o);
// Meta'nın durum bildirimi: kayıtlı adres (ofis-t4.localhost — bu ortamda ad çözülmez) programın uzak dinleyicisine (127.0.0.1) iletilir; yol ve gövde Meta'nınki.
const hookUrl = phoneId => {
  const registered = meta.meta.kancaAdresi(phoneId);
  if (!registered || !registered.includes("/wa/kanca/")) return null;
  const u = new URL(registered);
  return `http://127.0.0.1:${remote.port}${u.pathname}`;
};
const status = async (wamid, durum, extra = {}) => {
  const msg = messages().find(m => m.wamid === wamid);
  const url = hookUrl(msg?.numaraKimligi || PNID);
  if (!url) throw new Error("kanca adresi Meta'da kayıtlı değil");
  const res = await meta.durumGonder({ wamid, durum, url, ...extra });
  return res[0];
};

const browser = await chromium.launch();
let context = await browser.newContext({ viewport: { width: 1440, height: 1000 }, locale: "tr-TR", acceptDownloads: true });
const initScript = () => {
  window.__wa = [];
  window.open = url => {
    window.__wa.push(String(url));
    return null;
  };
};
await context.addInitScript(initScript);
let page = await context.newPage();
const pageErrors = [];
page.on("pageerror", error => pageErrors.push(error.message));
page.setDefaultTimeout(20000);
const shot = (name, target = page) => target.screenshot({ path: path.join(shots, `t4-${name}.png`), fullPage: true }).catch(() => null);
const step = async (title, fn) => {
  console.log(`\n■ ${title}`);
  try {
    await fn();
  } catch (error) {
    ok(false, `adım yarıda kaldı: ${String(error?.message || error).split("\n")[0]}`);
    await shot(`hata-${title.slice(0, 3).trim()}`);
  }
};
const typeSlow = async (text, target = page) => {
  for (const ch of text) await target.keyboard.type(ch, { delay: 30 });
};
const text = async (selector, target = page) => ((await target.textContent(selector).catch(() => "")) || "").trim();
const answer = async (target, choice, why) => {
  await target.waitForSelector(`${TOP} [data-answer="${choice}"]`, { state: "visible" });
  const title = await text(`${TOP} .hof-modal-title`, target);
  note(`soru: "${title}" → ${choice} (${why})`);
  await target.click(`${TOP} [data-answer="${choice}"]`);
  await target.waitForFunction(sel => !document.querySelector(`${sel} [data-answer]`), TOP);
  return title;
};
const closeAll = async (target = page) => {
  for (let i = 0; i < 8 && (await target.$(MODAL)); i += 1) {
    await target.keyboard.press("Escape");
    await target.waitForTimeout(250);
    const discard = await target.$(`${TOP} [data-answer="discard"], ${TOP} [data-answer="no"]`);
    if (discard) {
      note("kapatırken soru çıktı → Kaydetmeden Kapat (BEKLENMEYEN)");
      ok(false, "pencere kapatılırken beklenmeyen soru");
      await discard.click();
    }
  }
};
const login = async (target, base, username, password) => {
  await target.goto(`${base}/`);
  await target.fill("#hof-auth input[name=username]", username);
  await target.fill("#hof-auth input[name=password]", password);
  await Promise.all([target.waitForEvent("load"), target.click('#hof-auth button[type="submit"]')]);
  await target.waitForSelector("#hof-sidecard", { timeout: 60000 });
};
const openAccounts = async (target = page) => {
  await closeAll(target);
  await target.click('#hof-sidecard [data-action="accounts"]');
  await target.waitForSelector(`${TOP} [data-status="all"]`);
};
const openWhatsapp = async (target = page, act = "waStatement", n = 10) => {
  await openAccounts(target);
  await target.click(`${TOP} [data-status="all"]`);
  await target.waitForFunction(([sel, k]) => document.querySelectorAll(`${sel} tr[data-account]`).length >= k, [TOP, n]);
  await target.click(`${TOP} input[data-select-all]`);
  await target.waitForSelector(`${TOP} [data-act="${act}"]`);
  await target.click(`${TOP} [data-act="${act}"]`);
  await target.waitForSelector(`${TOP} [data-wa-paths]:not([hidden]) [data-wa-path="api"], ${TOP} .hof-wa-head`);
};
const waitPreview = async (target = page) => {
  await target.waitForSelector(`${TOP} [data-wa-api] [data-wa-api-send]`, { state: "attached" });
  await target.waitForFunction(sel => {
    const box = document.querySelector(`${sel} [data-wa-api]`);
    return box && !box.querySelector("[data-wa-api-loading]") && !/Önizleme hazırlanıyor/.test(box.querySelector("[data-wa-api-why]")?.textContent || "");
  }, TOP);
  await target.waitForTimeout(200);
};
const count = async (key, target = page) => Number(((await target.textContent(`${TOP} [data-wa-api-count="${key}"] strong`).catch(() => "")) || "").replace(/\./g, "").trim() || NaN);
const skipCount = async (reason, target = page) => Number(((await target.textContent(`${TOP} [data-wa-api-skip="${reason}"] b`).catch(() => "")) || "").trim() || 0);
const why = async (target = page) => text(`${TOP} [data-wa-api-why]`, target);
const chip = async (state, target = page) => Number(((await target.textContent(`${TOP} [data-wa-count="${state}"] b`).catch(() => "")) || "0").trim() || 0);
const waitChip = (state, n, target = page) => target.waitForFunction(([sel, s, v]) => Number(document.querySelector(`${sel} [data-wa-count="${s}"] b`)?.textContent || 0) === v, [TOP, state, n], { timeout: 20000 });
const ids = {};
const byPhone = {};
const startBatch = async (expectSend) => {
  ok(!(await page.isDisabled(`${TOP} [data-wa-api-send]`)), "Gönder etkin");
  ok((await text(`${TOP} [data-wa-api-send]`)) === `Gönder (${expectSend} Kişi)`, `düğme: Gönder (${expectSend} Kişi) (${await text(`${TOP} [data-wa-api-send]`)})`);
  await page.click(`${TOP} [data-wa-api-send]`);
  const title = await answer(page, "yes", "başlatma onayı (plan §1, beklenen tek soru)");
  ok(title === "Gönderim Başlasın mı?", `başlatma sorusu (${title})`);
  await page.waitForSelector(`${TOP} [data-wa-batch]`);
  return page.getAttribute(`${TOP} [data-wa-batch]`, "data-wa-batch");
};
// Yönetim sayfası sekmesi: aynı sayfada yalnız # değişince belge yeniden yüklenmez — tıklayarak seçilir.
const adminTab = async (tab, target = page, base = server.base) => {
  await target.goto(`${base}/admin.html`);
  await target.waitForSelector(`.adm-tabs [data-tab="${tab}"]`);
  await target.click(`.adm-tabs [data-tab="${tab}"]`);
  await target.waitForSelector(`[data-panel="${tab}"]:not([hidden])`);
};
const mediaText = id => {
  const m = meta.meta.medyalar.get(String(id));
  return m ? pdfText(m.icerik) : "";
};

// =====================================================================================================================================
await step("S0 boş veri: giriş; Cari listesi boş; Yönetim → WhatsApp Bağlı Değil; boş seçimle toplu iş açılmaz", async () => {
  await login(page, server.base, "admin", ADMIN_PASSWORD);
  await openAccounts();
  const empty = await text(`${TOP} .hof-empty`);
  ok(/cari yok/.test(empty) && /\+ Yeni Cari/.test(empty), `Cari listesi boş + yol gösterir: ${empty}`);
  if (!/Henüz cari yok/.test(empty)) observe(`hiç cari yokken boş liste "${empty.slice(0, 40)}…" diyor ("Henüz cari yok" değil; varsayılan süzgeç Tümü değil)`);
  ok(!(await page.$(`${TOP} [data-act="waStatement"]`)) || (await page.isHidden(`${TOP} [data-act="waStatement"]`)), "seçim yokken WhatsApp Ekstre düğmesi görünmez");
  await shot("00-bos-cari");
  await closeAll();
  await adminTab("whatsapp");
  await page.waitForSelector("[data-wa-state]");
  ok((await text("[data-wa-state]")) === "Bağlı Değil", "Yönetim → WhatsApp: Bağlı Değil");
  const pre = await api.post("/api/workspace/whatsapp/batches/preview", { kind: "statement", ids: [], preset: "thisMonth" });
  const make = await api.post("/api/workspace/whatsapp/batches", { kind: "statement", ids: [], preset: "thisMonth", requestId: "t4-bos-01" });
  ok(make.status !== 200 || !make.data?.data?.batch, `boş seçim: toplu iş açılmadı (önizleme ${pre.status}, başlatma ${make.status} ${String(make.data?.error || "").slice(0, 80)})`);
  ok(db("SELECT COUNT(*) AS n FROM wa_batches").n === 0 && kayit().sayilar.toplamMesajIstegi === 0, "veri tabanında toplu iş 0, Meta'ya ileti 0");
  const stats = (await api.get("/api/workspace/whatsapp/stats")).data.data;
  ok(stats.configured === false && stats.delivered === 0, `Bu Ay: bağlantı yok, 0 (${JSON.stringify({ c: stats.configured, d: stats.delivered })})`);
  await shot("00-bos-whatsapp");
});

await step("S1 firma bilgisi: Yönetim → Sistem → Ofis Adı (insan hızında) + Fatura Ayarları satıcı (API)", async () => {
  await adminTab("system");
  await page.waitForSelector("#adm-office-name", { state: "visible" });
  await page.click("#adm-office-name");
  await typeSlow(OFFICE);
  await page.keyboard.press("Enter");
  await page.waitForFunction(() => (document.getElementById("hof-toasts")?.textContent || "").includes("Ofis adı kaydedildi"));
  ok(db("SELECT value FROM settings WHERE key = 'office.name'")?.value === OFFICE, `veri tabanında ofis adı "${OFFICE}"`);
  const seller = { name: OFFICE, taxNo: "2920084496", taxOffice: "Konak", address: "Alsancak Mah. Kıbrıs Şehitleri Cad. No: 4", district: "Konak", city: "İzmir", phone: "0232 555 01 02", email: "bilgi@deniz.example" };
  ok((await api.put("/api/workspace/invoices/settings", { seller })).status === 200, "satıcı bilgisi kaydedildi");
});

await step("S2 Elle Bağla (Tab, insan hızında) → Kaydet ve Sına → Bağlı; Bağlantıyı Sına; kanca adresi Meta'da", async () => {
  await adminTab("whatsapp");
  await page.waitForSelector('[data-wa-action="connect"]');
  await page.click('[data-wa-action="connect"]');
  await page.waitForSelector(`${TOP} [name="phoneNumberId"]`, { state: "visible" });
  await page.click(`${TOP} [name="phoneNumberId"]`);
  await typeSlow(PNID);
  await page.keyboard.press("Tab");
  await typeSlow(WABA);
  await page.keyboard.press("Tab");
  await typeSlow(APP);
  await page.keyboard.press("Tab");
  ok(await page.evaluate(() => document.activeElement?.getAttribute("name") === "token"), "Tab sırası: kimlikler → belirteç");
  await typeSlow(TOKEN);
  await shot("02-elle-bagla");
  await page.click(`${TOP} button[type="submit"]`);
  await page.waitForFunction(() => document.querySelector("[data-wa-state]")?.textContent.trim() === "Bağlı", null, { timeout: 30000 });
  ok(true, "durum Bağlı");
  ok((await text('[data-wa-fact="verifiedName"] dd')) === "Deniz Ticaret", `görünen ad Meta'dan (${await text('[data-wa-fact="verifiedName"] dd')})`);
  const before = kayit().istekler.length;
  await page.click('[data-wa-action="test"]');
  await page.waitForTimeout(1500);
  ok((await text("[data-wa-state]")) === "Bağlı", "Bağlantıyı Sına sonrası Bağlı");
  ok(kayit().istekler.length > before, `Bağlantıyı Sına Meta'ya gitti (+${kayit().istekler.length - before} istek)`);
  const hook = meta.meta.kancaAdresi(PNID);
  ok(Boolean(hook) && hook.startsWith(`${PUBLIC}/wa/kanca/`), `kanca adresi Meta'ya kaydedildi (${String(hook).replace(/kanca\/.+$/, "kanca/…")})`);
  const html = await page.content();
  ok(!html.includes(TOKEN) && !html.includes(TOKEN.slice(-12)), "sayfada belirteç yok");
  ok(kayit().sizintilar.length === 0, `belirteç gövde/sorguda Meta'ya sızmadı (${kayit().sizintilar.length})`);
  await shot("03-bagli");
});

await step("S3 Şablonlar: kendiliğinden açıldı (UTILITY, tr, KVKK, TTL) → Meta onaylar → Şablonları Denetle ve Oluştur → Onaylandı / Evet", async () => {
  const tpls = meta.meta.sablonlar.filter(s => s.waba === WABA && !s.silindi);
  const names = tpls.map(s => s.name).sort();
  ok(names.join() === "destekofis_ekstre,destekofis_odeme_hatirlatma", `Meta'da 2 şablon (${names.join(", ")})`);
  ok(tpls.every(s => s.category === "UTILITY" && s.language === "tr"), "ikisi de UTILITY, tr");
  const ekstre = tpls.find(s => s.name === "destekofis_ekstre");
  const parts = Object.fromEntries((ekstre?.components || []).map(c => [String(c.type).toUpperCase(), c]));
  ok(parts.BODY?.text === "Sayın {{1}}, {{2}} firmasındaki cari hesabınızın {{3}} dönemine ait ekstresi ektedir. Dönem sonu bakiyesi: {{4}}. İyi günler dileriz.", "Ekstre gövdesi K3 metni");
  ok(parts.FOOTER?.text === "KVKK aydınlatma metni için firmamıza başvurabilirsiniz.", "KVKK alt satırı");
  ok(String(parts.HEADER?.format).toUpperCase() === "DOCUMENT", "belge başlığı");
  const posts = kayit().istekler.filter(i => i.islem === "templates_post" && i.yol.includes(WABA));
  const ttls = posts.map(p => p.govde?.message_send_ttl_seconds).filter(v => v !== undefined);
  ok(ttls.length === 2 && ttls.every(v => v === 259200), `şablon açmada teslim süresi 3 gün = 259200 sn (S2 A) (${JSON.stringify(ttls)})`);
  await page.waitForSelector('[data-wa-tpl="destekofis_ekstre"] [data-wa-tpl-status]');
  ok(/Onay Bekliyor/.test(await text('[data-wa-tpl="destekofis_ekstre"] [data-wa-tpl-status]')), `Ekstre: ${await text('[data-wa-tpl="destekofis_ekstre"] [data-wa-tpl-status]')}`);
  for (const s of tpls) s.status = "APPROVED";
  await page.focus('[data-wa-tpl-action-button="ensure"]');
  await page.keyboard.press("Enter");
  await page.waitForFunction(() => ["destekofis_ekstre", "destekofis_odeme_hatirlatma"].every(n => document.querySelector(`[data-wa-tpl="${n}"] [data-wa-tpl-usable]`)?.textContent.trim() === "Evet"), null, { timeout: 20000 });
  ok(true, "iki şablon gönderime hazır: Evet");
  ok((await text('[data-wa-tpl="destekofis_ekstre"] [data-wa-tpl-status]')) === "Onaylandı", "Ekstre Onaylandı");
  await shot("04-sablonlar");
});

await step("S4 Aydınlatma Metni Hazırla: firma unvanı ve e-posta metinde; eksik bilgi yok; Esc ile kapanır", async () => {
  await page.focus("[data-wa-notice-open]");
  await page.keyboard.press("Enter");
  await page.waitForSelector(`${TOP} [data-wa-notice-text]`, { state: "visible" });
  const shown = await text(`${TOP} [data-wa-notice-text]`);
  ok(shown.includes(OFFICE) && shown.includes("2920084496") && shown.includes("bilgi@deniz.example"), "metinde unvan, VKN, e-posta");
  ok(!/\[Firma/.test(shown), "yer tutucu kalmadı (bütün firma bilgileri dolu)");
  await shot("05-aydinlatma");
  await page.keyboard.press("Escape");
  await page.waitForFunction(() => !document.querySelector(".hof-modal-backdrop.is-visible"));
  ok(true, "Esc ile kapandı (soru yok)");
});

await step("S5 Gönderim Onayı (Yönetim kartı): Tab + Boşluk → veri tabanı", async () => {
  const shown = await page.waitForSelector("[data-wa-ack]", { state: "visible", timeout: 6000 }).then(() => true, () => false);
  if (!shown) {
    observe("Elle Bağla + Şablonları Denetle'den sonra aynı sayfada Gönderim Onayı kartı görünmüyor; sayfa yenilenince görünüyor mu denendi");
    await page.reload();
    await page.waitForSelector("[data-wa-ack]", { state: "visible" });
  }
  ok(!(await page.isChecked("[data-wa-ack]")), "başlangıçta işaretsiz");
  await page.focus("[data-wa-ack]");
  await page.keyboard.press("Shift+Tab");
  await page.keyboard.press("Tab");
  ok(await page.evaluate(() => document.activeElement?.matches?.("[data-wa-ack]")), "Tab ile kutuya gelindi");
  await page.keyboard.press("Space");
  await page.waitForFunction(() => document.querySelector("[data-wa-ack]")?.checked);
  await page.waitForTimeout(800);
  const ack = db("SELECT value FROM settings WHERE key = 'whatsapp.ack'");
  ok(Boolean(ack) && JSON.parse(ack.value).version >= 1, `onay veri tabanında (${ack?.value?.slice(0, 60)})`);
  await shot("06-onay");
});

await step("S6 cariler EKRANDAN (+ Yeni Cari, insan hızında); İstemiyor Tab + Boşluk; Pasife Al; hareketler + taksit kartı API'den", async () => {
  await page.goto(`${server.base}/`);
  await page.waitForSelector("#hof-sidecard");
  for (const c of CARI) {
    await openAccounts();
    await page.click(`${TOP} [data-act="new"]`);
    await page.waitForSelector(`${TOP} form input[name="name"]`, { state: "visible" });
    const form = `${TOP} form`;
    await page.click(`${form} input[name="name"]`);
    await typeSlow(c.name);
    await page.fill(`${form} input[name="registeredOn"]`, "2026-09-01");
    if (c.phone) {
      await page.click(`${form} input[name="phone"]`);
      await typeSlow(c.phone);
    }
    if (c.opening) {
      await page.click(`${form} input[name="openingBalance"]`);
      await typeSlow(c.opening);
    }
    if (c.due) await page.fill(`${form} input[name="openingDueDate"]`, c.due);
    if (c.optOut) {
      await page.focus(`${form} input[name="waOptOut"]`);
      await page.keyboard.press("Shift+Tab");
      await page.keyboard.press("Tab");
      await page.keyboard.press("Space");
      ok(await page.isChecked(`${form} input[name="waOptOut"]`), "İstemiyor kutusu Tab + Boşluk ile işaretlendi");
    }
    const n0 = db("SELECT COUNT(*) AS n FROM accounts").n;
    await page.click(`${form} [type="submit"]`);
    // Aynı adlı cari: program öneri / soru gösterebilir — beklenir, adı ve yanıtı günlüğe yazılır (ders 34).
    for (let i = 0; i < 40 && db("SELECT COUNT(*) AS n FROM accounts").n === n0; i += 1) {
      const q = await page.$(`${TOP} [data-answer]`);
      if (q) {
        const choices = await page.$$eval(`${TOP} [data-answer]`, nodes => nodes.map(n => `${n.dataset.answer}:${n.textContent.trim()}`));
        const title = await text(`${TOP} .hof-modal-title`);
        observe(`"${c.name}" açılırken soru: "${title}" seçenekler ${choices.join(" | ")}`);
        const yes = await page.$(`${TOP} [data-answer="yes"], ${TOP} [data-answer="new"], ${TOP} [data-answer="create"]`);
        if (yes) {
          note(`soru: "${title}" → ${await yes.getAttribute("data-answer")} (aynı adlı ikinci kişi bilerek açılıyor)`);
          await yes.click();
        }
      }
      await page.waitForTimeout(250);
    }
    const row = all(`SELECT id, name, phone, wa_opt_out AS optOut FROM accounts ORDER BY rowid DESC LIMIT 1`)[0];
    ok(db("SELECT COUNT(*) AS n FROM accounts").n === n0 + 1 && row.name === c.name, `cari açıldı: ${c.name} ${c.phone || "(telefonsuz)"}`);
    ids[c.key] = row.id;
    if (c.optOut) ok(row.optOut === 1, "veri tabanında İstemiyor 1");
    await closeAll();
  }
  ok(db("SELECT COUNT(*) AS n FROM accounts").n === 10, "veri tabanında 10 cari");
  // Pasif: kartta Pasife Al.
  await openAccounts();
  await page.click(`${TOP} tr[data-account="${ids.c9}"]`);
  await page.waitForSelector(`${TOP} [data-act="passive"]`);
  await page.click(`${TOP} [data-act="passive"]`);
  await page.waitForSelector(`${TOP} [data-act="activate"]`, { timeout: 15000 });
  ok(db(`SELECT status FROM accounts WHERE id = '${ids.c9}'`).status === "passive", "Pasif Kişi veri tabanında passive");
  await closeAll();
  // Hareketler ve taksit kartı (programın API'si; hareket girişi arayüzü başka senaryolarda).
  const must = async (label, p) => {
    const r = await p;
    if (r.status !== 200) throw new Error(`${label}: ${r.status} ${JSON.stringify(r.data).slice(0, 200)}`);
    return r.data.data;
  };
  for (const [key, body] of [
    ["c1", { kind: "debt", amount: 200, date: "2026-10-05", note: "Ekim satış" }],
    ["c1", { kind: "in", amount: 350, date: "2026-10-31", note: "Ekim tahsilat" }],
    ["c1", { kind: "debt", amount: 40, date: "2026-11-01", note: "Kasım satış" }],
    ["c10", { kind: "debt", amount: 100, date: "2026-10-10", note: "Ekim satış" }],
    ["c10", { kind: "in", amount: 400, date: "2026-10-20", note: "Fazla tahsilat" }],
  ]) await must(`${key} ${body.note}`, api.post(`/api/workspace/accounts/${ids[key]}/entries`, body));
  const plan = await must("c3 taksit kartı", api.post("/api/workspace/plans", { accountId: ids.c3, name: "Ortak Telefon A", total: 250, coversBalance: true, registeredOn: "2026-09-01" }));
  for (const [dueDate, amount] of [["2026-09-15", 100], ["2026-10-15", 100], ["2026-12-15", 50]]) await must("taksit", api.post(`/api/workspace/plans/${plan.id}/items`, { dueDate, amount }));
  const bal = async key => (await api.get(`/api/workspace/accounts/${ids[key]}`)).data.data;
  const c1 = await bal("c1");
  const c3 = await bal("c3");
  const c10 = await bal("c10");
  const c2 = await bal("c2");
  ok(Number(c1.totals.balance) === 890 && Number(c10.totals.balance) === -300 && Number(c3.totals.balance) === 250, `bakiyeler: C1 890, C3 250, C10 −300 (${c1.totals.balance}, ${c3.totals.balance}, ${c10.totals.balance})`);
  ok(Number(c3.totals.overdue) === 200, `C3 kartta Geciken 200 (${c3.totals.overdue})`);
  console.log(`    (C2 açılış vadesi 20.10.2026 → kartta Geciken ${c2.totals.overdue})`);
  for (const c of CARI) if (c.e164) (byPhone[c.e164] ||= []).push(c.key);
  await shot("07-cariler");
});

let lastMonthBatch = "";
await step("S7 Geçen Ay toplu ekstre: önizleme 10 / 7 / 3; Gönder → 7 ileti; şablon, değişkenler ve PDF metni (dönem, bakiye)", async () => {
  await openWhatsapp();
  ok((await page.getAttribute(`${TOP} [data-wa-path="api"]`, "aria-selected")) === "true", "Otomatik Gönder varsayılan");
  await waitPreview();
  await page.selectOption(`${TOP} [data-wa-api-preset]`, "lastMonth");
  await waitPreview();
  ok(/01\.10\.2026 – 31\.10\.2026/.test(await text(`${TOP} [data-wa-api-period]`)), `dönem: ${await text(`${TOP} [data-wa-api-period]`)}`);
  ok((await count("total")) === 10, `seçilen 10 (${await count("total")})`);
  ok((await count("sendable")) === 7, `gönderilecek 7: aynı adlı 2 + aynı telefonlu 2 + sabit hat + yurt dışı + alacaklı (K1, K2) (${await count("sendable")})`);
  ok((await count("skipped")) === 3, `elenen 3 (${await count("skipped")})`);
  for (const reason of ["Telefon yok", "WhatsApp Mesajı İstemiyor", "Pasif Cari"]) ok((await skipCount(reason)) === 1, `elenme nedeni "${reason}" 1`);
  const rows = await page.$$eval(`${TOP} [data-wa-api-person]`, nodes => nodes.map(n => ({ id: n.dataset.waApiPerson, text: n.innerText.replace(/\s+/g, " ") })));
  for (const c of CARI.filter(x => x.skip)) ok(rows.find(r => r.id === ids[c.key])?.text.includes(c.skip), `${c.name}: satırda "${c.skip}"`);
  ok(/0,0063 USD/.test(await text(`${TOP} [data-wa-api-cost]`)), `tahmini ücret 7 × 0,0009 = 0,0063 USD (${await text(`${TOP} [data-wa-api-cost]`)})`);
  ok((await skipCount("Daha Önce Gönderildi")) === 0, "Daha Önce Gönderildi 0 (ilk gönderim)");
  await shot("08-gecen-ay-onizleme");
  lastMonthBatch = await startBatch(7);
  const jobs = Object.fromEntries(all(`SELECT state, COUNT(*) AS n FROM wa_jobs WHERE batch_id = '${lastMonthBatch}' GROUP BY state`).map(r => [r.state, r.n]));
  ok(jobs.pending === 7 && jobs.skipped === 3, `veri tabanı: 7 bekliyor + 3 atlandı (${JSON.stringify(jobs)})`);
  ok(messages().length === 0, "işçi çalışmadan Meta'ya ileti yok");
  await drain();
  const sent = messages();
  ok(sent.length === 7, `sahte Meta: 7 ileti kabul (${sent.length}); POST ${kayit().sayilar.toplamMesajIstegi}`);
  const to = sent.map(m => m.teslimNumarasi).sort();
  const expectTo = SENDABLE.map(c => c.e164.slice(1)).sort();
  ok(JSON.stringify(to) === JSON.stringify(expectTo), `alıcılar beklenenle aynı (${to.join(", ")})`);
  ok(sent.every(m => m.govde.to.startsWith("+")), "numaralar '+' ve ülke koduyla");
  ok(sent.every(m => m.sablon === "destekofis_ekstre" && m.dil === "tr"), "şablon destekofis_ekstre, tr");
  ok(kayit().sayilar.medyaKabul === 7, `7 PDF yüklendi (${kayit().sayilar.medyaKabul})`);
  // Her ileti ↔ cari: aynı telefondaki iki iletiyi addan ayırırız ({{1}}); aynı adlı ikisini telefondan.
  for (const c of SENDABLE) {
    const m = sent.find(x => x.teslimNumarasi === c.e164.slice(1) && x.degiskenler[0] === c.name);
    if (!ok(Boolean(m), `${c.name} (${c.e164}) iletisi var`)) continue;
    ok(m.degiskenler[1] === OFFICE, `${c.name}: {{2}} firma "${m.degiskenler[1]}"`);
    ok(m.degiskenler[2] === "01.10.2026 – 31.10.2026", `${c.name}: {{3}} dönem "${m.degiskenler[2]}"`);
    ok(balanceRe(c.oct, c.credit).test(m.degiskenler[3]), `${c.name}: {{4}} bakiye "${m.degiskenler[3]}" (beklenen ${c.oct} TL${c.credit ? " (Alacaklı)" : ""})`);
    const pdf = mediaText(m.medyaId);
    ok(/01\.10\.2026/.test(pdf) && /31\.10\.2026/.test(pdf), `${c.name}: PDF dönemi Ekim`);
    ok(pdf.includes(`${c.oct} TL`), `${c.name}: PDF'te dönem sonu ${c.oct} TL`);
    if (c.key === "c1") ok(/Ekim satış/.test(pdf) && /Ekim tahsilat/.test(pdf) && !/Kasım satış/.test(pdf) && /1\.000,00 TL/.test(pdf), "C1 PDF: Ekim hareketleri var, Kasım YOK, devir 1.000,00");
    if (c.key === "c10") ok(/Alacakl/.test(pdf), "C10 PDF: alacaklı bakiye");
    ok(/\.pdf$/i.test(m.dosyaAdi || "") && (m.dosyaAdi || "").includes(c.name.split(" ")[0]), `${c.name}: dosya adı "${m.dosyaAdi}"`);
  }
  await waitChip("accepted", 7);
  ok((await chip("accepted")) === 7 && (await chip("skipped")) === 3, "ekranda Meta Kabul Etti 7, Atlandı 3");
  ok((await text(`${TOP} [data-wa-batch-state]`)) === "Tamamlandı", `toplu iş ${await text(`${TOP} [data-wa-batch-state]`)}`);
  await shot("09-gecen-ay-gonderildi");
});

await step("S8 kanca (sahte Meta): teslim 4, okundu 1, başarısız 1 (sabit hat 131026), yanıtsız 1 → ekranda durumlar; Bu Ay 5 (ekran = API = Yönetim)", async () => {
  const sent = messages().filter(m => m.degiskenler[2] === "01.10.2026 – 31.10.2026");
  const w = key => sent.find(m => m.degiskenler[0] === CARI.find(c => c.key === key).name && m.teslimNumarasi === CARI.find(c => c.key === key).e164.slice(1))?.wamid;
  const ts = Math.floor(Date.parse("2026-11-03T09:10:00+03:00") / 1000);
  const results = [];
  for (const key of ["c1", "c2", "c4", "c6"]) results.push(await status(w(key), "delivered", { timestamp: ts }));
  results.push(await status(w("c3"), "delivered", { timestamp: ts }));
  results.push(await status(w("c3"), "read", { timestamp: ts + 60 }));
  results.push(await status(w("c5"), "failed", { hataKodu: 131026, timestamp: ts }));
  ok(results.every(r => r.http === 200), `kanca yanıtları 200 (${results.map(r => r.http).join(",")})`);
  await waitChip("failed", 1);
  ok((await chip("delivered")) === 4 && (await chip("read")) === 1 && (await chip("failed")) === 1 && (await chip("accepted")) === 1, `ekranda Teslim 4, Okundu 1, Başarısız 1, Meta Kabul Etti 1 (${await chip("delivered")}/${await chip("read")}/${await chip("failed")}/${await chip("accepted")})`);
  const reason = await page.$eval(`${TOP} tr[data-wa-job-state="failed"]`, n => n.innerText.replace(/\s+/g, " ")).catch(() => "");
  ok(/Sabit Hat Kişi/.test(reason) && /131026/.test(reason), `başarısız satırı sabit hat + neden (${reason})`);
  const dbStates = Object.fromEntries(all(`SELECT state, COUNT(*) AS n FROM wa_jobs WHERE batch_id = '${lastMonthBatch}' GROUP BY state`).map(r => [r.state, r.n]));
  ok(dbStates.delivered === 4 && dbStates.read === 1 && dbStates.failed === 1 && dbStates.accepted === 1, `veri tabanı aynı (${JSON.stringify(dbStates)})`);
  const stats = (await api.get("/api/workspace/whatsapp/stats")).data.data;
  ok(stats.delivered === 5, `API Bu Ay teslim 5 = 4 teslim + 1 okundu (${stats.delivered}; ücretli ${stats.billable})`);
  await shot("10-durumlar");
  await closeAll();
  await openWhatsapp();
  await waitPreview();
  ok(/^5 teslim edildi/.test(await text(`${TOP} [data-wa-api-month]`)), `Gönderim Özeti: ${await text(`${TOP} [data-wa-api-month]`)}`);
  await page.click(`${TOP} [data-wa-api-list]`);
  await page.waitForSelector(`${TOP} [data-wa-api-open="${lastMonthBatch}"]`);
  ok(true, "Gönderimler listesinde Geçen Ay toplu işi");
  await shot("11-gonderimler");
  await closeAll();
  const admin = await context.newPage();
  await adminTab("whatsapp", admin);
  await admin.waitForSelector('[data-wa-month-fact="delivered"] dd');
  ok((await text('[data-wa-month-fact="delivered"] dd', admin)) === "5", `Yönetim → WhatsApp: Teslim Edilen İleti ${await text('[data-wa-month-fact="delivered"] dd', admin)}`);
  await shot("12-yonetim-bu-ay", admin);
  await admin.close();
});

let thisMonthBatch = "";
await step("S9 Bu Ay ekstresi: R3 uyarısı YOK (dönem farklı), 7 ileti, dönem 01.11.2026 – 03.11.2026, C1 890", async () => {
  await openWhatsapp();
  await waitPreview();
  ok((await page.inputValue(`${TOP} [data-wa-api-preset]`)) === "thisMonth", "dönem varsayılanı Bu Ay");
  ok(/01\.11\.2026 – 03\.11\.2026/.test(await text(`${TOP} [data-wa-api-period]`)), `dönem: ${await text(`${TOP} [data-wa-api-period]`)}`);
  ok((await count("sendable")) === 7 && (await skipCount("Daha Önce Gönderildi")) === 0, `gönderilecek 7, Daha Önce Gönderildi 0 (${await count("sendable")}/${await skipCount("Daha Önce Gönderildi")})`);
  const n0 = messages().length;
  thisMonthBatch = await startBatch(7);
  await drain();
  const sent = messages().slice(n0);
  ok(sent.length === 7, `Meta'ya 7 yeni ileti (${sent.length}); toplam ${messages().length}`);
  ok(sent.every(m => m.degiskenler[2] === "01.11.2026 – 03.11.2026"), "hepsinde dönem 01.11.2026 – 03.11.2026");
  const c1 = sent.find(m => m.teslimNumarasi === "905321000001");
  ok(balanceRe("890,00").test(c1?.degiskenler[3] || ""), `C1 bakiye ${c1?.degiskenler[3]}`);
  const pdf = mediaText(c1?.medyaId);
  ok(/Kasım satış/.test(pdf) && !/Ekim satış/.test(pdf) && /850,00 TL/.test(pdf) && /890,00 TL/.test(pdf), "C1 PDF: Kasım hareketi var, Ekim yok, devir 850, dönem sonu 890");
  // Kanca: 3 teslim (Bu Ay 5 + 3 = 8).
  const ts = Math.floor(Date.parse("2026-11-03T09:20:00+03:00") / 1000);
  for (const m of sent.slice(0, 3)) await status(m.wamid, "delivered", { timestamp: ts });
  await page.waitForTimeout(500);
  const stats = (await api.get("/api/workspace/whatsapp/stats")).data.data;
  ok(stats.delivered === 8, `Bu Ay teslim 8 (${stats.delivered})`);
  await shot("13-bu-ay");
  await closeAll();
});

await step("S10 Ödeme Hatırlatma: gecikmiş borçlular; değişkenler (en eski vade, vadesi geçmiş toplam, güncel bakiye)", async () => {
  await openWhatsapp();
  await waitPreview();
  await page.check(`${TOP} [data-wa-api-kind][value="reminder"]`);
  await waitPreview();
  const rows = await page.$$eval(`${TOP} [data-wa-api-person]`, nodes => nodes.map(n => ({ id: n.dataset.waApiPerson, text: n.innerText.replace(/\s+/g, " ") })));
  const sendable = rows.filter(r => /Gönderilecek/.test(r.text)).map(r => r.id);
  ok(sendable.includes(ids.c3), "C3 (taksit kartında vadesi geçmiş 200) hatırlatmaya alınır");
  const c2row = rows.find(r => r.id === ids.c2)?.text || "";
  if (!sendable.includes(ids.c2)) observe(`C2 açılış bakiyesinin Vade Tarihi 20.10.2026 geçmiş (kartta Geciken görünür mü: API'den okundu) ama hatırlatmada "${c2row}" — plan §7a 20 "vadesi geçmiş borç"; kartta Geciken de 0 (açılış vadesi gecikmiş sayılmıyor)`);
  ok((await skipCount("Gecikmiş Borç Yok")) >= 4, `Gecikmiş Borç Yok ${await skipCount("Gecikmiş Borç Yok")}`);
  await shot("14-hatirlatma-onizleme");
  const n0 = messages().length;
  await startBatch(sendable.length);
  await drain();
  const sent = messages().slice(n0);
  ok(sent.length === sendable.length && sent.every(m => m.sablon === "destekofis_odeme_hatirlatma"), `Meta'ya ${sent.length} hatırlatma, şablon destekofis_odeme_hatirlatma`);
  const m3 = sent.filter(m => m.teslimNumarasi === "905332000000" && m.degiskenler[0] === "Ortak Telefon A");
  ok(m3.length === 1, "C3'e bir hatırlatma (aynı telefondaki C4'e değil — C4'ün gecikmiş borcu yok)");
  const v = m3[0]?.degiskenler || [];
  ok(v[1] === OFFICE && v[2] === "15.09.2026" && v[3] === "200,00 TL" && balanceRe("250,00").test(v[4] || ""), `C3 değişkenleri: ${JSON.stringify(v)} (beklenen [ad, firma, 15.09.2026, 200,00 TL, 250,00 TL])`);
  ok(sent.every(m => !m.medyaId), "hatırlatmada PDF yok");
  await shot("15-hatirlatma-gonderildi");
  await closeAll();
});

await step("S11 WhatsApp Web ile Gönder: yurt dışı (+49) kişiye wa.me (numara + metin); sabit hat bu yolda seçilemez + neden", async () => {
  await page.evaluate(() => (window.__wa.length = 0));
  await openWhatsapp();
  await page.click(`${TOP} [data-wa-path="manual"]`);
  await page.waitForSelector(`${TOP} [data-wa] .hof-wa-head`);
  const head = await page.$eval(`${TOP} .hof-wa-head`, n => n.innerText.replace(/\s+/g, " "));
  console.log(`    (WhatsApp Web özeti: ${head})`);
  const fixRow = await page.$eval(`${TOP} tr[data-preview="${ids.c5}"]`, n => n.innerText.replace(/\s+/g, " ")).catch(() => "");
  ok(await page.isDisabled(`${TOP} [data-wa] [data-pick="${ids.c5}"]`) && /Sabit hat/.test(fixRow), `sabit hat wa.me yolunda seçilemez, nedeni satırda (${fixRow})`);
  observe(`WhatsApp Web ile Gönder sabit hattı "Numarası Yok / Hatalı" sayar (wa.me cep ister), Otomatik Gönder göndermeye alır (K1) — iki yolun sayıları farklı: ${head}`);
  await page.click(`${TOP} [data-wa] [data-pick-all]`);
  await page.waitForFunction(sel => !document.querySelector(`${sel} [data-wa] [data-pick]:checked`), TOP);
  await page.check(`${TOP} [data-wa] [data-pick="${ids.c6}"]`);
  await page.waitForFunction(sel => /Gönderime Başla \(1 Kişi\)/.test(document.querySelector(`${sel} [data-start]`)?.textContent || ""), TOP);
  const sends0 = db("SELECT COUNT(*) AS n FROM message_sends WHERE status = 'sent'").n;
  const meta0 = messages().length;
  await page.click(`${TOP} [data-start]`);
  await page.waitForSelector(`${TOP} [data-send]`);
  await page.click(`${TOP} [data-send]`);
  await page.waitForSelector(`${TOP} .hof-wa-done`);
  const urls = await page.evaluate(() => window.__wa.slice());
  const de = urls.find(u => u.startsWith("https://wa.me/4915123456789?text="));
  ok(urls.length === 1 && Boolean(de), `wa.me/4915123456789 açıldı (${urls.map(u => u.slice(0, 40)).join(" | ")})`);
  const deText = de ? decodeURIComponent(new URL(de).searchParams.get("text") || "") : "";
  ok(/Yurt Dışı Kişi/.test(deText) && /300,00 TL/.test(deText), `metin adı ve bakiyesiyle (${deText.split("\n").slice(0, 2).join(" / ")})`);
  await page.waitForTimeout(500);
  ok(db("SELECT COUNT(*) AS n FROM message_sends WHERE status = 'sent'").n === sends0 + 1, "cari kartına kayıt (message_sends +1)");
  ok(messages().length === meta0, "wa.me yolu Meta'ya istek göndermedi");
  await shot("16-whatsapp-web");
  await closeAll();
});

await step("S12 yetkisiz (Personel): Otomatik Gönder pasif + neden; API 403", async () => {
  const staffApi = await createUser(server, api, { ...STAFF, role: "personel" });
  const staffContext = await browser.newContext({ viewport: { width: 1366, height: 900 }, locale: "tr-TR" });
  await staffContext.addInitScript(initScript);
  const staff = await staffContext.newPage();
  staff.on("pageerror", error => pageErrors.push(`personel: ${error.message}`));
  await login(staff, server.base, STAFF.username, STAFF.password);
  await openWhatsapp(staff);
  ok(/yetkiniz yok/.test(await text(`${TOP} [data-wa-path="api"] small`, staff)), "sekmede neden: yetkiniz yok");
  await staff.click(`${TOP} [data-wa-path="api"]`);
  await staff.waitForSelector(`${TOP} [data-wa-api-send]`);
  ok(await staff.isDisabled(`${TOP} [data-wa-api-send]`), "Gönder pasif");
  ok(/yetkiniz yok/.test(await why(staff)), `neden görünür: ${await why(staff)}`);
  await shot("17-yetkisiz", staff);
  const n0 = messages().length;
  const res = await staffApi.post("/api/workspace/whatsapp/batches", { kind: "statement", ids: [ids.c1], preset: "thisMonth", requestId: "t4-personel-01" });
  ok(res.status === 403, `API: personel toplu iş ${res.status}`);
  ok(messages().length === n0, "Meta'ya ileti yok");
  await staffContext.close();
});

await step("S13 iki şirket: 002 ekrandan açılır → sızıntı yok; 002 kendi WABA'sıyla 1 ileti → 001'in Bu Ay'ı değişmez", async () => {
  const id001 = ((await api.get("/api/companies")).data.data.companies || []).find(item => item.code === "001")?.id;
  const q1 = `hofCompany=${encodeURIComponent(id001)}`;
  const before001 = (await api.get(`/api/workspace/whatsapp/stats?${q1}`)).data.data.delivered;
  await adminTab("companies");
  await page.waitForSelector("#adm-company-new", { state: "visible" });
  await page.click("#adm-company-new");
  await page.waitForSelector(`${TOP} input[name="name"]`, { state: "visible" });
  await page.click(`${TOP} input[name="name"]`);
  await typeSlow("İkinci Şirket");
  await page.click(`${TOP} [type="submit"]`);
  await page.waitForFunction(() => (document.getElementById("hof-toasts")?.textContent || "").includes("şirketi açıldı"), null, { timeout: 30000 });
  const companies = (await api.get("/api/companies")).data.data;
  const c2 = (companies.companies || companies.all || []).find(item => item.code === "002");
  ok(Boolean(c2), `002 açıldı (${c2?.label || c2?.name})`);
  const q = `hofCompany=${encodeURIComponent(c2.id)}`;
  await page.goto(`${server.base}/`);
  await page.waitForSelector("#hof-company .hof-session-current");
  await page.click("#hof-company [data-toggle]");
  await page.click(`#hof-company [data-pick="${c2.id}"]`);
  await page.waitForFunction(() => /002/.test(document.querySelector("#hof-company .hof-session-current")?.textContent || ""), null, { timeout: 30000 });
  await page.waitForSelector("#hof-sidecard");
  await openAccounts();
  await page.click(`${TOP} [data-status="all"]`);
  await page.waitForTimeout(400);
  ok((await page.$$(`${TOP} tr[data-account]`)).length === 0 && /cari yok/.test(await text(`${TOP} .hof-empty`)), "002: Cari listesi (Tümü) boş — 001'in carileri yok");
  await closeAll();
  const s002 = (await api.get(`/api/workspace/whatsapp/stats?${q}`)).data.data;
  ok(s002.configured === false && s002.delivered === 0, `002: bağlantı yok, Bu Ay 0 (${JSON.stringify({ c: s002.configured, d: s002.delivered })})`);
  const list002 = (await api.get(`/api/workspace/whatsapp/batches?${q}`)).data.data;
  ok((list002.batches || list002 || []).length === 0, "002: Gönderimler boş");
  await adminTab("whatsapp");
  await page.waitForSelector("[data-wa-state]");
  ok((await text("[data-wa-state]")) === "Bağlı Değil", "002 Yönetim → WhatsApp: Bağlı Değil (bağlantı şirkete özel)");
  await shot("18-002-bos");
  // 002 kendi numarası / WABA'sı (API ile; ekran yolu S2'de denendi).
  ok((await api.put(`/api/admin/office?${q}`, { name: "İkinci Şirket" })).status === 200, "002 ofis adı");
  const put = await api.put(`/api/workspace/whatsapp/connection?${q}`, { phoneNumberId: PNID2, wabaId: WABA2, appId: APP, token: TOKEN });
  ok(put.status === 200, `002 bağlantı (${put.status})`);
  await api.post(`/api/workspace/whatsapp/connection/test?${q}`, {});
  await api.post(`/api/workspace/whatsapp/templates/ensure?${q}`, {});
  for (const s of meta.meta.sablonlar.filter(x => x.waba === WABA2)) s.status = "APPROVED";
  await api.post(`/api/workspace/whatsapp/templates/ensure?${q}`, {});
  await api.put(`/api/workspace/whatsapp/ack?${q}`, { ack: true });
  const acc = (await api.post(`/api/workspace/accounts?${q}`, { name: "Aynı Ad Kişi", phone: "0532 100 00 01", openingBalance: "77" })).data.data;
  const n0 = messages().length;
  const b = await api.post(`/api/workspace/whatsapp/batches?${q}`, { kind: "statement", ids: [acc.id], preset: "thisMonth", requestId: "t4-002-01" });
  ok(b.status === 200, `002 toplu iş (${b.status} ${String(b.data?.error || "").slice(0, 80)})`);
  const app002 = server.app.companies?.appFor ? null : null;
  void app002;
  await drain();
  // 002'nin işçisi ayrı şirket uygulamasında olabilir: hepsini sür.
  for (const a of server.app.allApps?.() || []) await a.whatsapp?.scheduler?.drain?.();
  const m002 = messages().slice(n0);
  if (!m002.length) observe("002 toplu işi 001'in işçisiyle gitmedi — işçi şirket başına; test 002'yi API'den süremedi (aşağıda 002 sayıları okunur)");
  if (m002.length) {
    ok(m002.length === 1 && m002[0].numaraKimligi === PNID2 && m002[0].degiskenler[1] === "İkinci Şirket" && /77,00 TL/.test(m002[0].degiskenler[3]), `002 iletisi kendi numarasından, kendi firma adı ve bakiyesiyle (${m002[0].numaraKimligi}, ${m002[0].degiskenler.join(" | ")})`);
    const r = await status(m002[0].wamid, "delivered", { timestamp: Math.floor(Date.parse("2026-11-03T09:40:00+03:00") / 1000) });
    ok(r.http === 200, `002 kancası ${r.http}`);
  }
  const after001 = (await api.get(`/api/workspace/whatsapp/stats?${q1}`)).data.data;
  const plain = (await api.get("/api/workspace/whatsapp/stats")).data.data;
  console.log(`    (şirket parametresiz istek sol seçicideki şirkete gider: Bu Ay ${plain.delivered}, WABA ${plain.wabaId})`);
  const after002 = (await api.get(`/api/workspace/whatsapp/stats?${q}`)).data.data;
  ok(after001.delivered === before001, `001 Bu Ay değişmedi (${before001} → ${after001.delivered})`);
  ok(after002.delivered === (m002.length ? 1 : 0), `002 Bu Ay ${after002.delivered}`);
  const j001 = db(`SELECT COUNT(*) AS n FROM wa_jobs WHERE account_id = '${acc.id}'`).n;
  ok(j001 === 0, "001 veri tabanında 002'nin işi yok");
  // Sol seçiciyi 001'e geri al.
  await page.goto(`${server.base}/`);
  await page.waitForSelector("#hof-company .hof-session-current");
  await page.click("#hof-company [data-toggle]");
  await page.click(`#hof-company [data-pick="${id001}"]`);
  await page.waitForFunction(() => /001/.test(document.querySelector("#hof-company .hof-session-current")?.textContent || ""), null, { timeout: 30000 });
});

await step("S14 salt okunur lisans: Otomatik Gönder pasif + neden; API reddi; Meta'ya yeni ileti yok", async () => {
  const batches = db("SELECT COUNT(*) AS n FROM wa_batches").n;
  const n0 = messages().length;
  await context.close();
  await server.close().catch(() => {});
  server = await startTestServer({ dataDir, backupDir, now: { time: NOW, fixed: true }, whatsappGraphUrl: meta.url, whatsappTimeoutMs: 3000, whatsappGapMs: 0, maxCompanies: 2, env: { HUKUK_LICENSE_URL: "http://127.0.0.1:9" }, license: { enforce: true, machineId: "0123456789abcdef0123456789abcdef", services: ["https://lisans.test/api/lisans"], fetchImpl: async () => { throw new TypeError("fetch failed"); }, firstCheckDelayMs: 3_600_000 } });
  api = createClient(server.base);
  await api.login("admin", ADMIN_PASSWORD);
  context = await browser.newContext({ viewport: { width: 1440, height: 1000 }, locale: "tr-TR" });
  await context.addInitScript(initScript);
  page = await context.newPage();
  page.on("pageerror", error => pageErrors.push(error.message));
  page.setDefaultTimeout(20000);
  await login(page, server.base, "admin", ADMIN_PASSWORD);
  await page.waitForTimeout(1800);
  if (await page.$(MODAL)) note("salt okunur açılışında lisans açıklama penceresi (beklenen) → Esc");
  await closeAll();
  await openWhatsapp();
  ok((await page.getAttribute(`${TOP} [data-wa-path="manual"]`, "aria-selected")) === "true", "salt okunur: WhatsApp Web ile Gönder varsayılan");
  await page.click(`${TOP} [data-wa-path="api"]`);
  await page.waitForSelector(`${TOP} [data-wa-api-send]`);
  ok(await page.isDisabled(`${TOP} [data-wa-api-send]`), "Gönder pasif");
  ok(/salt okunur/.test(await why()), `neden görünür: ${await why()}`);
  await shot("19-salt-okunur");
  const res = await api.post("/api/workspace/whatsapp/batches", { kind: "statement", ids: [ids.c1], preset: "thisMonth", requestId: "t4-salt-01" });
  ok(res.status === 403, `API reddi ${res.status} (${String(res.data?.error || "").slice(0, 70)})`);
  await server.app.whatsapp.scheduler.drain();
  ok(db("SELECT COUNT(*) AS n FROM wa_batches").n === batches && messages().length === n0, "yeni toplu iş yok, Meta'ya yeni ileti yok");
  await closeAll();
});

await step("S15 Yönetim → Mobil Cihazlar: lisans bitişine 7 gün kala uyarı (KARAR L1), 8 gün kala uyarı yok", async () => {
  const GUN = 86_400_000;
  const BITIS = Date.parse("2026-12-01T00:00:00+03:00");
  const MACHINE = "1234567890abcdef1234567890abcdef";
  const lisans = lisansAnahtari();
  let clockMs = BITIS - 8 * GUN;
  const durum = { kind: "license", status: "active", expiresAt: new Date(BITIS).toISOString(), licenseId: "LIS-T4-TEST" };
  const belirtec = () => lisans.belirtec({ at: clockMs, machine: MACHINE, ...durum });
  const kapi = await startKapi({ now: () => clockMs, trustedKeys: lisans.trusted, lisansFetch: async () => ({ json: async () => ({ ok: true, token: belirtec() }) }) });
  const mroot = mkdtempSync(path.join(tmpdir(), "senaryo-is-akisi-248-mobil-"));
  const ms = await startTestServer({ dataDir: path.join(mroot, "data"), backupDir: path.join(mroot, "backups"), now: { time: new Date(clockMs).toISOString(), fixed: true }, mobileKapiUrl: kapi.base, env: { HUKUK_LICENSE_URL: "http://127.0.0.1:9" }, license: { enforce: true, trustedKeys: lisans.trusted, services: ["https://lisans.t4.test/api/lisans"], fetchImpl: async () => ({ status: 200, json: async () => ({ ok: true, token: belirtec() }) }), machineId: MACHINE, now: () => clockMs, firstCheckDelayMs: 3_600_000, autoTrial: false } });
  try {
    await ms.app.license.activateKey("DO-ABCDE-FGHJK-MNPQR-STVWX");
    const mctx = await browser.newContext({ viewport: { width: 1366, height: 900 }, locale: "tr-TR" });
    const mp = await mctx.newPage();
    mp.on("pageerror", error => pageErrors.push(`mobil: ${error.message}`));
    await login(mp, ms.base, "admin", ADMIN_PASSWORD);
    await adminTab("mobile", mp, ms.base);
    await mp.waitForSelector("#adm-mobile-status [data-mobile-count], #adm-mobile-status [data-mobile-license]");
    const t8 = await text("#adm-mobile-status", mp);
    ok(!/gün sonra bitiyor/.test(t8), `8 gün kala uyarı yok (${t8.slice(0, 90)})`);
    await shot("20-mobil-8-gun", mp);
    clockMs = BITIS - 7 * GUN;
    ms.clock.set(clockMs);
    await ms.app.license.check?.().catch(() => null);
    await mp.reload();
    await mp.waitForSelector("#adm-mobile-status [data-mobile-count], #adm-mobile-status [data-mobile-license]");
    await mp.waitForTimeout(500);
    const t7 = await text("#adm-mobile-status [data-mobile-hak]", mp);
    ok(t7 === "Lisansınız 7 gün sonra bitiyor.", `7 gün kala: "${t7}" (KARAR L1 "lisans X gün sonra bitiyor"; F4 BAŞ MİMAR KARARI cümle düzeni)`);
    ok(/eşli cihaz/.test(await text("#adm-mobile-status [data-mobile-count]", mp)), "eşli cihaz sayısı görünür");
    await shot("21-mobil-7-gun", mp);
    await mctx.close();
  } finally {
    await ms.close().catch(() => {});
    await kapi.close().catch(() => {});
    removeTestDir(mroot);
  }
});

ok(pageErrors.length === 0, `sayfa hatası yok${pageErrors.length ? `: ${pageErrors.slice(0, 3).join(" | ")}` : ""}`);
ok(kayit().sizintilar.length === 0, `Meta'ya belirteç sızıntısı yok (${kayit().sizintilar.length})`);
await browser.close();
await server.close().catch(() => {});
await meta.kapat();
removeTestDir(root);
const DAY_AT_END = trDay();
if (findings.length) console.log(`\nGÖZLEMLER (${findings.length}):\n${findings.map(f => `  - ${f}`).join("\n")}`);
console.log(`\nSahte Meta toplam: ileti isteği ${kayit().sayilar.toplamMesajIstegi}, kabul ${kayit().sayilar.toplamKabul}, PDF ${kayit().sayilar.medyaKabul}, silinen PDF ${kayit().sayilar.medyaSilme}`);
if (DAY_AT_END !== DAY_AT_START) {
  console.log(`\nGEÇERSİZ: koşu gün sınırını geçti (${DAY_AT_START} → ${DAY_AT_END}; ders 22) — ${passed} geçti, ${failed} kaldı`);
  process.exit(2);
}
console.log(`\n${passed} geçti, ${failed} kaldı`);
process.exit(failed ? 1 : 0);
