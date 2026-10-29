#!/usr/bin/env node
// Maliyet kâhininin PROGRAM ucu (README §6 arayüz sözleşmesi, "destekofis-maliyet/1"). kos.py bu dosyayı `node` ile açar, standart girdiye senaryoları verir,
// standart çıktıdan programın sonuçlarını okur. Bu dosya BEKLENEN DEĞER HESAPLAMAZ: her sayı programın GERÇEK HTTP API'sinden (server/app.mjs createApp,
// /api/maliyet uçları) okunur. Yazılış: 2.4.6 madde 1–2 çekirdek ajanı; kâhinin kendi dosyaları (kahin.py, uretici.py, kabul.json, test_kahin.py) OKUNMADAN,
// yalnız README §2 (kodlar) ve §6 (sözleşme) ile.
//
// Katman "api" (§6.6): pencere = programın API'si. Açık pencerenin taslağı uyarlayıcıda tutulur; her düzenleme adımı programın ön izleme ucuna
// (POST /api/maliyet/onizle) gönderilir — program reddederse (ör. K1 "Bölen 0 olamaz") adım "ret" olur ve taslağa girmez (ekran da girdiyi kabul etmez).
// Kaydet = PUT /api/maliyet. Pencere açıkken `oku` taslağın program hesabını (ön izleme), kapalıyken kayıtlı hâli (GET) okur. Çık'taki soru, programın
// ön izlemede verdiği "degisti" işaretinden okunur.
//
// Katman "arayuz" (§6.6; 2.4.6 madde 4 ekran ajanı): pencere = GERÇEK EKRAN (Playwright + Chromium). Stok penceresinden "Maliyet Hesap Kartı" düğmesiyle
// açılır; her düzenleme insan gibi yapılır (alana tıkla, Ctrl+A, harf harf yaz, Tab; ✎ → "Adı Değiştir" penceresi → Enter; "+ Satır Ekle", ×, Kaydet,
// Çık). Sayı Türkçe yazılır ("12,5"). Okuma ekrandaki ham değerdir (data-deger; gösterimdeki iki basamak değil); pencere kapalıyken kayıtlı hâl API'den
// okunur. Çık sorusu ekranda görülen "Kaydedilmemiş Değişiklik" penceresidir; yanıtsız senaryoda "Kaydetmeden Kapat" denir ve nedeni standart hataya
// yazılır (ders 34). Bekleme: pencere kökünün data-bekleyen / data-duzenleme / data-kayit işaretleri (uyarlayıcı beklenen değer hesaplamaz).
//
// Her senaryo boş şablonlu temiz şirkette (ayrı geçici veri klasörü, sektör "Duşakabin Üretimi") başlar; `yeniden_baslat` aynı veri klasörüyle
// programı kapatıp açar. Ders 30: HUKUK_LICENSE_URL=http://127.0.0.1:9 (lisans servisine ulaşılmaz). Günlük standart hataya.
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { execFileSync } from "node:child_process";
import { fileURLToPath, pathToFileURL } from "node:url";

process.env.HUKUK_LICENSE_URL = "http://127.0.0.1:9";
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../../..");
const { createApp } = await import(pathToFileURL(path.join(ROOT, "server/app.mjs")).href);
const PASSWORD = "Maliyet-Uyarlayici-2026!";
const log = message => process.stderr.write(`[uyarlayici] ${message}\n`);

// ---------- Program ----------
async function startProgram(dataRoot) {
  const app = createApp({
    dataDir: path.join(dataRoot, "data"),
    backupDir: path.join(dataRoot, "backups"),
    logLevel: "silent",
    scheduleBackups: false,
    env: { HUKUK_ADMIN_PASSWORD: PASSWORD, HUKUK_DATASET_AUTOSYNC: "0", HUKUK_LICENSE_URL: "http://127.0.0.1:9" },
    license: { enforce: false, machineId: "0123456789abcdef0123456789abcdef" },
    startLicenseTimers: false,
    alertScheduler: false,
    chatArchive: false,
    integrityScan: false,
    posQueue: false,
    analysisWorker: false,
  });
  const address = await app.listen(0, "127.0.0.1");
  const base = `http://127.0.0.1:${address.port}`;
  let cookie = "";
  const request = async (method, url, body) => {
    const headers = { origin: base };
    if (cookie) headers.cookie = cookie;
    if (body !== undefined) headers["content-type"] = "application/json";
    const response = await fetch(base + url, { method, headers, body: body === undefined ? undefined : JSON.stringify(body) });
    const setCookie = response.headers.get("set-cookie");
    if (setCookie) cookie = setCookie.split(";")[0];
    const data = (response.headers.get("content-type") || "").includes("json") ? await response.json() : await response.text();
    return { status: response.status, data };
  };
  const login = await request("POST", "/api/auth/login", { username: "admin", password: PASSWORD });
  if (login.status !== 200) throw new Error(`giriş başarısız: ${login.status} ${JSON.stringify(login.data)}`);
  return { app, base, request, close: () => app.close() };
}

// ---------- Görünüm dönüşümü (program → §6.4 / §6.5) ----------
const fromProgramId = id => (id.startsWith("y-") ? id.slice(2) : id);
const toProgramId = id => (/^s\d+$/.test(id) || /^b\d+$/.test(id) ? id : `y-${id}`);

function viewOf(kart) {
  if (kart.tur === "zincir") {
    const adimlar = {};
    for (const adim of kart.adimlar) {
      const item = { etiket: adim.etiket };
      if (adim.kod === "yuzde" || adim.kod === "yuzde_ekle") item.oran = adim.oran;
      if (adim.kod === "bolme") item.bolen = adim.bolen;
      item.deger = adim.deger;
      if (adim.kod === "bolme") item.hata = adim.hata ?? null;
      adimlar[adim.kod] = item;
    }
    return {
      ad: kart.ad,
      satirlar: Object.fromEntries(kart.satirlar.map(satir => [fromProgramId(satir.id), { ad: satir.ad, birim: satir.birim, miktar: satir.miktar, fiyat: satir.fiyat, tutar: satir.tutar }])),
      adimlar,
      sonuc: kart.sonuc,
    };
  }
  if (kart.tur === "gramaj") {
    return {
      ad: kart.ad,
      satirlar: Object.fromEntries(kart.satirlar.map(satir => [fromProgramId(satir.id), { parca: satir.parca, cins: satir.cins, giden_mt: satir.giden_mt, boy: satir.boy, br_gramaj: satir.br_gramaj, giden_kg: satir.giden_kg, alis_ft: satir.alis_ft, satir_top: satir.satir_top }])),
      toplam: { giden_kg: kart.toplam.giden_kg, satir_top: kart.toplam.satir_top },
    };
  }
  if (kart.tur === "matris") {
    return {
      ad: kart.ad,
      sutunlar: Object.fromEntries(kart.sutunlar.map(sutun => [sutun.kod, sutun.ad])),
      olculer: Object.fromEntries(kart.olculer.map(olcu => [olcu.kod, olcu.ad])),
      hucreler: Object.fromEntries(Object.entries(kart.hucreler).map(([hucre, item]) => [hucre, item.tur === "taban" ? { taban: item.taban, deger: item.deger } : { fark: item.fark, deger: item.deger }])),
    };
  }
  return { ad: kart.ad, satirlar: Object.fromEntries(kart.satirlar.map(satir => [satir.id, { ad: satir.ad, degerler: satir.degerler }])) };
}

function sablonOf(state) {
  const sekmeler = Object.fromEntries(state.sekmeler.map(sekme => [sekme.kod, { ad: sekme.ad, kartlar: sekme.kartlar }]));
  const kartlar = {};
  for (const [kod, kart] of Object.entries(state.kartlar)) {
    if (kart.tur === "zincir") {
      const oranlar = {};
      let bolen = null;
      const elle = [];
      for (const adim of kart.adimlar) {
        if (adim.kod === "yuzde" || adim.kod === "yuzde_ekle") oranlar[adim.kod] = adim.oran;
        if (adim.kod === "bolme") bolen = adim.bolen;
        if (adim.islem === "elle") elle.push(adim.kod);
      }
      kartlar[kod] = { ad: kart.ad, tur: "zincir", satirlar: kart.satirlar.map(satir => fromProgramId(satir.id)), adim_sirasi: kart.adimlar.map(adim => adim.kod), adim_islem: Object.fromEntries(kart.adimlar.map(adim => [adim.kod, adim.islem])), oranlar, bolen, elle };
    } else if (kart.tur === "gramaj") {
      kartlar[kod] = { ad: kart.ad, tur: "gramaj", satirlar: kart.satirlar.map(satir => fromProgramId(satir.id)), elle_kg: kart.satirlar.filter(satir => satir.elle_kg).map(satir => fromProgramId(satir.id)) };
    } else if (kart.tur === "matris") {
      kartlar[kod] = { ad: kart.ad, tur: "matris", satirlar: kart.olculer.map(olcu => olcu.kod), sutunlar: kart.sutunlar.map(sutun => sutun.kod), hucreler: Object.fromEntries(Object.entries(kart.hucreler).map(([hucre, item]) => [hucre, item.tur === "taban" ? "taban" : item.kaynak])) };
    } else {
      kartlar[kod] = { ad: kart.ad, tur: "bilgi", satirlar: kart.satirlar.map(satir => satir.id) };
    }
  }
  return { sekmeler, kartlar };
}

// ---------- Pencere (taslak) ----------
// Taslak: kart kodu → programa gönderilecek kart gövdesi (son görünümden türetilmiş, değişiklikler uygulanmış). Sekme adları ayrı.
function createWindow(program) {
  let saved = null; // son GET
  let open = false;
  let draft = new Map();
  let tabDraft = new Map();
  let lastPreview = null;
  const okBody = response => {
    if (response.status !== 200) throw Object.assign(new Error(`program ${response.status}: ${JSON.stringify(response.data).slice(0, 300)}`), { response });
    return response.data.data;
  };
  const reload = async () => {
    saved = okBody(await program.request("GET", "/api/maliyet"));
    return saved;
  };
  const bodyOf = (cards = draft, tabs = tabDraft) => ({
    kartlar: [...cards.values()],
    sekmeler: [...tabs.entries()].map(([kod, ad]) => ({ kod, ad, rev: saved.sekmeler.find(sekme => sekme.kod === kod)?.rev })),
  });
  // Kart gövdesinin başlangıcı: kayıtlı görünümden programın kabul ettiği biçim (değişmeyen kart sürüm denetimine girmez).
  const cardBody = kod => {
    if (draft.has(kod)) return structuredClone(draft.get(kod));
    const kart = saved.kartlar[kod];
    if (!kart) throw Object.assign(new Error(`kart yok: ${kod}`), { notFound: true });
    if (kart.tur === "zincir") return { kod, rev: kart.rev, ad: kart.ad, satirlar: kart.satirlar.map(({ id, ad, birim, miktar, fiyat }) => ({ id, ad, birim, miktar, fiyat })), adimlar: kart.adimlar.map(adim => ({ kod: adim.kod, etiket: adim.etiket, ...(adim.oran !== undefined ? { oran: adim.oran } : {}), ...(adim.kod === "cm_elle" ? { deger: adim.deger } : {}) })) };
    if (kart.tur === "gramaj") return { kod, rev: kart.rev, ad: kart.ad, satirlar: kart.satirlar.map(({ id, parca, cins, giden_mt, boy, br_gramaj, giden_kg_girdi, alis_ft, elle_kg }) => ({ id, parca, cins, giden_mt, boy, br_gramaj, alis_ft, ...(elle_kg ? { giden_kg: giden_kg_girdi } : {}) })) };
    if (kart.tur === "matris") return { kod, rev: kart.rev, ad: kart.ad, sutunlar: {}, olculer: {}, hucreler: {} };
    return { kod, rev: kart.rev, ad: kart.ad, satirlar: kart.satirlar.map(({ id, ad, degerler }) => ({ id, ad, degerler: [...degerler] })) };
  };
  // Bir düzenleme: taslağa uygula, programa ön izlet; reddedilirse taslak değişmez.
  const edit = async (kod, mutate) => {
    const body = cardBody(kod);
    mutate(body, saved.kartlar[kod]);
    const cards = new Map(draft);
    cards.set(kod, body);
    const response = await program.request("POST", "/api/maliyet/onizle", bodyOf(cards));
    if (response.status === 400) return { durum: "ret", neden: response.data?.error || "" };
    const data = okBody(response);
    draft = cards;
    lastPreview = data;
    return { durum: "tamam" };
  };
  const editTab = async (kod, ad) => {
    tabDraft.set(kod, ad);
    return { durum: "tamam" };
  };
  const dirty = async () => {
    if (tabDraft.size && [...tabDraft.entries()].some(([kod, ad]) => saved.sekmeler.find(sekme => sekme.kod === kod)?.ad !== ad)) return true;
    if (!draft.size) return false;
    return Boolean(okBody(await program.request("POST", "/api/maliyet/onizle", bodyOf())).degisti);
  };
  const save = async () => {
    const response = await program.request("PUT", "/api/maliyet", bodyOf());
    if (response.status === 400 || response.status === 409) return { durum: "ret", neden: response.data?.error || "" };
    saved = okBody(response);
    draft = new Map();
    tabDraft = new Map();
    lastPreview = null;
    return { durum: "tamam" };
  };
  const read = async kodlar => {
    const current = open ? saved : await reload();
    let preview = null;
    if (open && draft.size) preview = okBody(await program.request("POST", "/api/maliyet/onizle", bodyOf())).kartlar;
    const kartlar = {};
    for (const kod of kodlar) {
      const kart = preview?.[kod] || current.kartlar[kod];
      if (!kart) continue;
      const view = viewOf(kart);
      kartlar[kod] = view;
    }
    return kartlar;
  };
  return {
    get saved() {
      return saved;
    },
    async open() {
      await reload();
      open = true;
      draft = new Map();
      tabDraft = new Map();
    },
    close() {
      open = false;
      draft = new Map();
      tabDraft = new Map();
    },
    reload,
    edit,
    editTab,
    dirty,
    save,
    read,
    isOpen: () => open,
    lastPreview: () => lastPreview,
  };
}

// ---------- Adımlar ----------
const findRow = (list, id) => {
  const programId = toProgramId(id);
  const row = list.find(item => item.id === programId);
  if (!row) throw Object.assign(new Error(`satır yok: ${id}`), { notFound: true });
  return row;
};

async function runStep(ctx, step) {
  const w = ctx.window;
  const ensureOpen = async () => {
    if (!w.isOpen()) await w.open();
  };
  switch (step.islem) {
    case "ac":
      await w.open();
      return { durum: "tamam" };
    case "kaydet":
      await ensureOpen();
      return w.save();
    case "cik": {
      if (!w.isOpen()) return { durum: "tamam", soru: false };
      const soru = await w.dirty();
      let result = { durum: "tamam", soru };
      if (soru) {
        const yanit = step.yanit || "";
        if (yanit === "kaydet") {
          result = { ...(await w.save()), soru };
        } else if (yanit !== "kaydetme") {
          log(`beklenmeyen soru (Çık): senaryo ${ctx.kimlik} yanıt vermiyor → "Kaydetmeden Çık" denildi`);
        }
      }
      w.close();
      return result;
    }
    case "yeniden_ac":
      w.close();
      await w.open();
      return { durum: "tamam" };
    case "yeniden_baslat":
      w.close();
      await ctx.restart();
      return { durum: "tamam" };
    case "oku":
      return { durum: "tamam", kartlar: await w.read(step.kartlar || []) };
    case "sablon_oku":
      return { durum: "tamam", sablon: sablonOf(w.isOpen() ? w.saved : await w.reload()) };
    default:
      break;
  }
  await ensureOpen();
  const kart = step.kart;
  switch (step.islem) {
    case "satir_yaz":
      return w.edit(kart, (body, view) => {
        const row = findRow(body.satirlar, step.satir);
        for (const [key, value] of Object.entries(step.alanlar || {})) {
          if (view.tur === "gramaj" && key === "giden_kg") row.giden_kg = value;
          else row[key] = value;
        }
      });
    case "satir_ekle":
      return w.edit(kart, body => {
        body.satirlar.push({ id: toProgramId(step.satir), ...(step.alanlar || {}) });
      });
    case "satir_sil":
      return w.edit(kart, body => {
        const row = findRow(body.satirlar, step.satir);
        body.satirlar = body.satirlar.filter(item => item !== row);
      });
    case "ad_degistir": {
      if (step.hedef === "kart" && !String(kart).includes("/")) return w.editTab(kart, step.ad);
      return w.edit(kart, (body, view) => {
        if (step.hedef === "kart") body.ad = step.ad;
        else if (step.hedef === "satir") {
          const row = findRow(body.satirlar, step.kimlik);
          if (view.tur === "gramaj") row.parca = step.ad;
          else row.ad = step.ad;
        } else if (step.hedef === "adim") {
          const adim = body.adimlar.find(item => item.kod === step.kimlik);
          if (!adim) throw Object.assign(new Error(`adım yok: ${step.kimlik}`), { notFound: true });
          adim.etiket = step.ad;
        } else if (step.hedef === "sutun") {
          body.sutunlar = { ...(body.sutunlar || {}), [step.kimlik]: step.ad };
        } else if (step.hedef === "olcu") {
          body.olculer = { ...(body.olculer || {}), [step.kimlik]: step.ad };
        } else throw new Error(`bilinmeyen ad hedefi: ${step.hedef}`);
      });
    }
    case "oran_degistir":
      return w.edit(kart, body => {
        const adim = body.adimlar.find(item => item.kod === step.adim);
        if (!adim) throw Object.assign(new Error(`adım yok: ${step.adim}`), { notFound: true });
        adim.oran = step.oran;
      });
    case "bolen_degistir":
      return w.edit(kart, body => {
        const adim = body.adimlar.find(item => item.kod === "bolme");
        if (!adim) throw Object.assign(new Error("bu kartta bölme adımı yok"), { notFound: true });
        adim.bolen = step.bolen;
      });
    case "elle_yaz":
      return w.edit(kart, body => {
        const adim = body.adimlar.find(item => item.kod === (step.adim || "cm_elle"));
        if (!adim) throw Object.assign(new Error(`adım yok: ${step.adim}`), { notFound: true });
        adim.deger = step.deger;
      });
    case "taban_yaz":
      return w.edit(kart, body => {
        body.hucreler = { ...(body.hucreler || {}), [step.hucre]: { taban: step.deger } };
      });
    case "fark_yaz":
      return w.edit(kart, body => {
        body.hucreler = { ...(body.hucreler || {}), [step.hucre]: { fark: step.deger } };
      });
    case "bilgi_yaz":
      return w.edit(kart, body => {
        const row = findRow(body.satirlar, step.satir);
        // `sira` 0'dan başlar (degerler dizisinin sırası; ilk koşudaki farklar 1'den sayınca bir kaydığını gösterdi — uyarlayıcının yorum hatasıydı).
        const index = Number(step.sira);
        const degerler = [...row.degerler];
        degerler[index] = step.deger;
        row.degerler = degerler;
      });
    default:
      return { durum: "hata", neden: `uyarlayıcı bu işlemi bilmiyor: ${step.islem}` };
  }
}

// ---------- Arayüz katmanı (gerçek ekran) ----------
let browserPromise = null;
const browser = () => {
  if (!browserPromise) browserPromise = import(pathToFileURL(path.join(ROOT, "node_modules/playwright/index.mjs")).href).then(pw => pw.chromium.launch());
  return browserPromise;
};
const MODAL = ".hof-modal-backdrop.is-visible";
const TOP = `${MODAL}:nth-last-child(1 of ${MODAL})`;
const WIN = `${MODAL} .hof-maliyet-modal`;
const ROOT_SEL = `${WIN} [data-maliyet]`;
// Sayının insanın yazacağı Türkçe biçimi (üslü gösterim yok; "." → ","). Metin olduğu gibi yazılır.
const sayiYazisi = value => {
  if (value === null || value === undefined) return "";
  if (typeof value !== "number") return String(value);
  const text = /e/i.test(String(value)) ? value.toLocaleString("en-US", { useGrouping: false, maximumSignificantDigits: 21 }) : String(value);
  return text.replace(".", ",");
};

function createScreen(program, kimlik) {
  let context = null;
  let page = null;
  let base = "";
  const idMap = new Map(); // `${kart}|${senaryo kimliği}` → ekrandaki satır kimliği
  const errors = [];
  const rowId = (kart, id) => idMap.get(`${kart}|${id}`) || id;
  const fromScreenId = (kart, id) => {
    for (const [key, value] of idMap) if (value === id && key.startsWith(`${kart}|`)) return key.slice(kart.length + 1);
    return id;
  };
  const isOpen = async () => Boolean(page && (await page.$(ROOT_SEL)));
  const rootData = () => page.$eval(ROOT_SEL, node => ({ ...node.dataset }));
  const settle = async () => {
    await page.waitForFunction(sel => {
      const node = document.querySelector(sel);
      return !node || node.dataset.bekleyen === "0";
    }, ROOT_SEL, { timeout: 20000 });
  };
  async function login() {
    context = await (await browser()).newContext({ viewport: { width: 1366, height: 900 }, locale: "tr-TR" });
    await context.addInitScript(() => document.addEventListener("DOMContentLoaded", () => document.head.appendChild(Object.assign(document.createElement("style"), { textContent: "#hof-license-bar,.hof-license-notice{display:none!important}" }))));
    page = await context.newPage();
    page.setDefaultTimeout(20000);
    page.on("pageerror", error => errors.push(error.message));
    base = program.base;
    await page.goto(`${base}/`);
    await page.fill("#hof-auth input[name=username]", "admin");
    await page.fill("#hof-auth input[name=password]", PASSWORD);
    await Promise.all([page.waitForEvent("load"), page.click('#hof-auth button[type="submit"]')]);
    await page.waitForSelector("#hof-sidecard", { timeout: 60000 });
    await page.waitForFunction(() => Boolean(window.HOF?.stock?.open && window.HOF?.maliyet), null, { timeout: 20000 });
    await page.evaluate(() => {
      localStorage.setItem(`hof-notices-off:${window.HOF.user.id}`, "1");
      document.querySelectorAll("#hof-notices .hof-notice").forEach(node => node.remove());
    });
  }
  async function closeOtherModals() {
    for (let index = 0; index < 5; index += 1) {
      const open = await page.$$(MODAL);
      if (!open.length) return;
      const top = await page.$(TOP);
      if ((await top.$(".hof-maliyet-modal")) || (await top.$(".hof-stock-modal"))) return;
      await page.keyboard.press("Escape");
      await page.waitForTimeout(200);
    }
  }
  async function open() {
    if (await isOpen()) await cik({ yanit: "kaydetme", sebep: "ac: açık pencere kapatılıyor" });
    await closeOtherModals();
    if (!(await page.$(`${MODAL} .hof-stock-modal`))) {
      await page.click('#hof-sidecard [data-action="stock"]');
      await page.waitForSelector(`${MODAL} .hof-stock-modal`);
    }
    await page.waitForSelector(`${MODAL} .hof-stock-modal [data-act="maliyet"]`, { timeout: 20000 });
    await page.click(`${MODAL} .hof-stock-modal [data-act="maliyet"]`);
    await page.waitForSelector(`${ROOT_SEL} [data-kart]`);
    await page.waitForTimeout(150);
  }
  const sekmeOf = kart => String(kart).split("/")[0];
  async function showCard(kart) {
    const sel = `${ROOT_SEL} [data-kart="${kart}"]`;
    if (await page.$(sel)) return sel;
    const tab = `${ROOT_SEL} [data-sekme="${sekmeOf(kart)}"]`;
    if (!(await page.$(tab))) throw Object.assign(new Error(`sekme yok: ${sekmeOf(kart)}`), { notFound: true });
    await page.click(tab);
    await page.waitForSelector(sel);
    return sel;
  }
  // Bir alana insan gibi yaz: tıkla, Ctrl+A, sil, harf harf yaz, Tab. Sonuç pencerenin düzenleme işaretinden okunur.
  async function typeInto(selector, value) {
    const input = await page.$(selector);
    if (!input) return { durum: "ret", neden: `ekranda bu alan yok (${selector.split(" ").slice(-1)[0]})` };
    const text = sayiYazisi(value);
    const before = Number((await rootData()).duzenleme || 0);
    const old = await input.inputValue();
    await input.click();
    await page.keyboard.press("Control+A");
    await page.keyboard.press("Backspace");
    if (text) await page.keyboard.type(text, { delay: 8 });
    await page.keyboard.press("Tab");
    if (text === old) {
      await settle();
      return { durum: "tamam" };
    }
    await page.waitForFunction(([sel, n]) => Number(document.querySelector(sel)?.dataset.duzenleme || 0) > n, [ROOT_SEL, before], { timeout: 20000 });
    await settle();
    const data = await rootData();
    return data.duzenlemeSonuc === "ret" ? { durum: "ret", neden: data.duzenlemeNeden || "" } : { durum: "tamam" };
  }
  // ✎ → "Adı Değiştir" penceresi → Enter. Ret: pencerenin hata satırı; pencere Vazgeç ile kapanır.
  async function rename(buttonSel, ad) {
    const button = await page.$(buttonSel);
    if (!button) return { durum: "ret", neden: "ekranda bu ad için ✎ yok" };
    await button.click();
    const form = `${TOP} form input[name="ad"]`;
    await page.waitForSelector(form);
    await page.waitForTimeout(100);
    await page.click(form);
    await page.keyboard.press("Control+A");
    await page.keyboard.press("Backspace");
    if (ad) await page.keyboard.type(String(ad), { delay: 8 });
    await page.keyboard.press("Enter");
    const outcome = await page.waitForFunction(() => {
      const forms = [...document.querySelectorAll(".hof-modal-backdrop.is-visible form input[name='ad']")];
      if (!forms.length) return "tamam";
      const error = forms.at(-1).closest("form").querySelector(".hof-form-error")?.textContent.trim();
      return error ? `ret:${error}` : false;
    }, null, { timeout: 20000 }).then(handle => handle.jsonValue());
    await settle();
    if (outcome === "tamam") return { durum: "tamam" };
    await page.click(`${TOP} [data-cancel]`);
    await page.waitForTimeout(200);
    return { durum: "ret", neden: outcome.slice(4) };
  }
  async function cik({ yanit = "", sebep = "" } = {}) {
    if (!(await isOpen())) return { durum: "tamam", soru: false };
    await page.click(`${ROOT_SEL} [data-cik]`);
    const state = await page.waitForFunction(sel => {
      if (!document.querySelector(sel)) return "kapandi";
      const asked = [...document.querySelectorAll(".hof-modal-backdrop.is-visible")].some(node => node.querySelector("[data-answer='save']") && /Kaydedilmemiş Değişiklik/.test(node.textContent));
      return asked ? "soru" : false;
    }, ROOT_SEL, { timeout: 20000 }).then(handle => handle.jsonValue());
    if (state === "kapandi") return { durum: "tamam", soru: false };
    const answer = yanit === "kaydet" ? "save" : "yes";
    if (yanit !== "kaydet" && yanit !== "kaydetme") log(`beklenmeyen soru (Çık): senaryo ${kimlik} yanıt vermiyor → "Kaydetmeden Kapat" denildi${sebep ? ` (${sebep})` : ""}`);
    else log(`Çık sorusu: senaryo ${kimlik} → ${answer === "save" ? "Kaydet" : "Kaydetmeden Kapat"}${sebep ? ` (${sebep})` : ""}`);
    const before = Number((await rootData()).kayit || 0);
    await page.click(`${TOP} [data-answer="${answer}"]`);
    if (answer === "save") {
      const result = await page.waitForFunction(([sel, n]) => {
        const node = document.querySelector(sel);
        if (!node) return "tamam";
        return Number(node.dataset.kayit || 0) > n ? (node.dataset.kayitSonuc === "ret" ? `ret:${node.dataset.kayitNeden || ""}` : "bekle") : false;
      }, [ROOT_SEL, before], { timeout: 20000 }).then(handle => handle.jsonValue());
      if (result.startsWith("ret:")) return { durum: "ret", neden: result.slice(4), soru: true };
    }
    await page.waitForFunction(sel => !document.querySelector(sel), ROOT_SEL, { timeout: 20000 });
    return { durum: "tamam", soru: true };
  }
  async function kaydet() {
    const before = Number((await rootData()).kayit || 0);
    await page.click(`${ROOT_SEL} [data-kaydet]`);
    await page.waitForFunction(([sel, n]) => Number(document.querySelector(sel)?.dataset.kayit || 0) > n, [ROOT_SEL, before], { timeout: 20000 });
    await settle();
    const data = await rootData();
    return data.kayitSonuc === "ret" ? { durum: "ret", neden: data.kayitNeden || "" } : { durum: "tamam" };
  }
  // Ekrandaki kartın §6.4 görüntüsü (ham değer data-deger'den).
  async function readCard(kart) {
    const sel = await showCard(kart);
    const raw = await page.$eval(sel, node => {
      const val = el => (el ? JSON.parse(el.dataset.deger ?? "null") : undefined);
      const q = (root, s) => root.querySelector(s);
      const tur = node.dataset.tur;
      const out = { tur, ad: val(q(node, '[data-alan="kart-ad"]')) };
      if (tur === "zincir") {
        out.satirlar = [...node.querySelectorAll("tbody tr[data-satir]")].map(tr => [tr.dataset.satir, { ad: val(q(tr, '[data-alan="ad"]')), birim: val(q(tr, '[data-alan="birim"]')), miktar: val(q(tr, '[data-alan="miktar"]')), fiyat: val(q(tr, '[data-alan="fiyat"]')), tutar: val(q(tr, '[data-alan="tutar"]')) }]);
        out.adimlar = [...node.querySelectorAll("[data-adim]")].map(row => {
          const kod = row.dataset.adim;
          const item = { etiket: val(q(row, '[data-alan="etiket"]')) };
          if (kod === "yuzde" || kod === "yuzde_ekle") item.oran = val(q(row, '[data-alan="oran"]'));
          if (kod === "bolme") item.bolen = val(q(row, '[data-alan="bolen"]'));
          item.deger = val(q(row, '[data-alan="deger"]'));
          if (kod === "bolme") item.hata = JSON.parse(row.dataset.hata || "null");
          return [kod, item];
        });
        out.sonuc = JSON.parse(node.dataset.sonuc || "null");
      } else if (tur === "gramaj") {
        out.satirlar = [...node.querySelectorAll("tbody tr[data-satir]")].map(tr => {
          const elle = tr.dataset.elleKg === "1";
          return [tr.dataset.satir, { parca: val(q(tr, '[data-alan="parca"]')), cins: val(q(tr, '[data-alan="cins"]')), giden_mt: val(q(tr, '[data-alan="giden_mt"]')), boy: val(q(tr, '[data-alan="boy"]')), br_gramaj: val(q(tr, '[data-alan="br_gramaj"]')), giden_kg: val(q(tr, elle ? '[data-alan="giden_kg_hesap"]' : '[data-alan="giden_kg"]')), alis_ft: val(q(tr, '[data-alan="alis_ft"]')), satir_top: val(q(tr, '[data-alan="satir_top"]')) }];
        });
        out.toplam = { giden_kg: val(q(node, '[data-alan="toplam_giden_kg"]')), satir_top: val(q(node, '[data-alan="toplam_satir_top"]')) };
      } else if (tur === "matris") {
        out.sutunlar = Object.fromEntries([...node.querySelectorAll("thead th[data-sutun]")].map(th => [th.dataset.sutun, val(q(th, '[data-alan="sutun"]'))]));
        out.olculer = Object.fromEntries([...node.querySelectorAll("tbody tr[data-olcu]")].map(tr => [tr.dataset.olcu, val(q(tr, '[data-alan="olcu"]'))]));
        out.hucreler = Object.fromEntries([...node.querySelectorAll("[data-hucre]")].map(td => [td.dataset.hucre, td.dataset.tur === "taban" ? { taban: val(q(td, '[data-alan="taban"]')), deger: val(q(td, '[data-alan="deger"]')) } : { fark: val(q(td, '[data-alan="fark"]')), deger: val(q(td, '[data-alan="deger"]')) }]));
      } else {
        out.satirlar = [...node.querySelectorAll("tbody tr[data-satir]")].map(tr => [tr.dataset.satir, { ad: val(q(tr, '[data-alan="ad"]')), degerler: [...tr.querySelectorAll('[data-alan="bilgi"]')].map(val) }]);
      }
      return out;
    });
    const view = { ad: raw.ad };
    if (raw.tur === "zincir") {
      view.satirlar = Object.fromEntries(raw.satirlar.map(([id, item]) => [fromScreenId(kart, id), item]));
      view.adimlar = Object.fromEntries(raw.adimlar);
      view.sonuc = raw.sonuc;
    } else if (raw.tur === "gramaj") {
      view.satirlar = Object.fromEntries(raw.satirlar.map(([id, item]) => [fromScreenId(kart, id), item]));
      view.toplam = raw.toplam;
    } else if (raw.tur === "matris") {
      Object.assign(view, { sutunlar: raw.sutunlar, olculer: raw.olculer, hucreler: raw.hucreler });
    } else view.satirlar = Object.fromEntries(raw.satirlar);
    return view;
  }
  const rowSel = (kart, id) => `${ROOT_SEL} [data-kart="${kart}"] tbody tr[data-satir="${rowId(kart, id)}"]`;
  async function writeFields(kart, id, alanlar = {}) {
    let result = { durum: "tamam" };
    const tur = await page.$eval(`${ROOT_SEL} [data-kart="${kart}"]`, node => node.dataset.tur);
    for (const [key, value] of Object.entries(alanlar)) {
      const one = (tur === "zincir" && key === "ad") || (tur === "gramaj" && key === "parca") ? await rename(`${rowSel(kart, id)} [data-ad-degistir="satir"]`, value) : await typeInto(`${rowSel(kart, id)} input[data-alan="${key}"]`, value);
      if (one.durum !== "tamam" && result.durum === "tamam") result = one;
    }
    return result;
  }
  async function step(s) {
    switch (s.islem) {
      case "ac":
        await open();
        return { durum: "tamam" };
      case "kaydet":
        if (!(await isOpen())) await open();
        return kaydet();
      case "cik":
        return cik({ yanit: s.yanit || "" });
      case "yeniden_ac":
        if (await isOpen()) await cik({ yanit: "kaydetme", sebep: "yeniden_ac: kaydedilmemiş taslak bırakılıyor" });
        await open();
        return { durum: "tamam" };
      case "oku": {
        if (!(await isOpen())) {
          const saved = okBody(await program.request("GET", "/api/maliyet"));
          return { durum: "tamam", kartlar: Object.fromEntries((s.kartlar || []).filter(kod => saved.kartlar[kod]).map(kod => [kod, viewOf(saved.kartlar[kod])])) };
        }
        const kartlar = {};
        for (const kod of s.kartlar || []) kartlar[kod] = await readCard(kod);
        return { durum: "tamam", kartlar };
      }
      case "sablon_oku":
        return { durum: "tamam", sablon: sablonOf(okBody(await program.request("GET", "/api/maliyet"))) };
      default:
        break;
    }
    if (!(await isOpen())) await open();
    const kart = s.kart;
    if (!(s.islem === "ad_degistir" && s.hedef === "kart" && !String(kart).includes("/"))) await showCard(kart);
    const card = `${ROOT_SEL} [data-kart="${kart}"]`;
    switch (s.islem) {
      case "satir_yaz":
        return writeFields(kart, s.satir, s.alanlar);
      case "satir_ekle": {
        const before = await page.$$eval(`${card} tbody tr[data-satir]`, rows => rows.map(row => row.dataset.satir));
        const n = Number((await rootData()).duzenleme || 0);
        await page.click(`${card} [data-satir-ekle]`);
        await page.waitForFunction(([sel, k]) => Number(document.querySelector(sel)?.dataset.duzenleme || 0) > k, [ROOT_SEL, n]);
        await settle();
        if ((await rootData()).duzenlemeSonuc === "ret") return { durum: "ret", neden: (await rootData()).duzenlemeNeden || "" };
        const after = await page.$$eval(`${card} tbody tr[data-satir]`, rows => rows.map(row => row.dataset.satir));
        const added = after.filter(id => !before.includes(id));
        if (added.length !== 1) throw new Error(`eklenen satır bulunamadı (${added.length})`);
        idMap.set(`${kart}|${s.satir}`, added[0]);
        return writeFields(kart, s.satir, s.alanlar || {});
      }
      case "satir_sil": {
        const sel = `${rowSel(kart, s.satir)} [data-satir-sil]`;
        if (!(await page.$(sel))) throw Object.assign(new Error(`satır yok: ${s.satir}`), { notFound: true });
        const n = Number((await rootData()).duzenleme || 0);
        await page.click(sel);
        await page.waitForFunction(([root, k]) => Number(document.querySelector(root)?.dataset.duzenleme || 0) > k, [ROOT_SEL, n]);
        await settle();
        const data = await rootData();
        return data.duzenlemeSonuc === "ret" ? { durum: "ret", neden: data.duzenlemeNeden || "" } : { durum: "tamam" };
      }
      case "ad_degistir": {
        if (s.hedef === "kart" && !String(kart).includes("/")) return rename(`${ROOT_SEL} [data-ad-degistir="sekme"][data-kimlik="${kart}"]`, s.ad);
        if (s.hedef === "kart") return rename(`${card} .hof-maliyet-kart-bas [data-ad-degistir="kart"]`, s.ad);
        if (s.hedef === "satir") return rename(`${rowSel(kart, s.kimlik)} [data-ad-degistir="satir"]`, s.ad);
        if (s.hedef === "adim") return rename(`${card} [data-adim="${s.kimlik}"] [data-ad-degistir="adim"]`, s.ad);
        if (s.hedef === "sutun") return rename(`${card} [data-sutun="${s.kimlik}"] [data-ad-degistir="sutun"]`, s.ad);
        if (s.hedef === "olcu") return rename(`${card} tr[data-olcu="${s.kimlik}"] [data-ad-degistir="olcu"]`, s.ad);
        return { durum: "hata", neden: `bilinmeyen ad hedefi: ${s.hedef}` };
      }
      case "oran_degistir":
        return typeInto(`${card} [data-adim="${s.adim}"] input[data-alan="oran"]`, s.oran);
      case "bolen_degistir":
        return typeInto(`${card} [data-adim="bolme"] input[data-alan="bolen"]`, s.bolen);
      case "elle_yaz":
        return typeInto(`${card} [data-adim="${s.adim || "cm_elle"}"] input[data-alan="deger"]`, s.deger);
      case "taban_yaz":
        return typeInto(`${card} [data-hucre="${s.hucre}"] input[data-alan="taban"]`, s.deger);
      case "fark_yaz":
        return typeInto(`${card} [data-hucre="${s.hucre}"] input[data-alan="fark"]`, s.deger);
      case "bilgi_yaz":
        return typeInto(`${rowSel(kart, s.satir)} input[data-alan="bilgi"][data-sira="${Number(s.sira)}"]`, s.deger);
      default:
        return { durum: "hata", neden: `uyarlayıcı bu işlemi bilmiyor: ${s.islem}` };
    }
  }
  return {
    login,
    step,
    errors,
    async close() {
      await context?.close().catch(() => null);
      context = null;
      page = null;
    },
  };
}
const okBody = response => {
  if (response.status !== 200) throw new Error(`program ${response.status}: ${JSON.stringify(response.data).slice(0, 300)}`);
  return response.data.data;
};

// 2.4.7 (müşteri isteği 28.10.2026): programın şablonunda oranlar BOŞ gelir (kullanıcı yazar). Kâhinin şablonu Excel'in oranlarını (README §2 tablosu)
// taşır; kâhin DEĞİŞTİRİLMEDİ (ders 40). Bu yüzden her senaryonun temiz şirketinde, senaryodan ÖNCE, kullanıcının Excel'deki oranları yazıp kaydettiği
// hâl kurulur — yalnız GİRDİ (programın kendi Kaydet ucu; beklenen değer hesaplanmaz). Bedeli: `sablon` senaryosunun oran karşılaştırması artık şablonun
// boş varsayılanını değil bu girdiyi okur; boş varsayılanın kendisi test/maliyet-247.test.mjs'te denetlenir.
const EXCEL_ORANLARI = {
  "cam/100x100-oval-kabin": [18, 20], "cam/100x100-kose-kabin": [18, 20], "cam/170-2s2c-h182": [18, 20], "cam/130-1s1c-h182-kabin": [18, 20], "cam/130-1s2c-h182-kabin": [18, 20],
  "mika/100x100-oval-kabin": [11, 15], "mika/100x100-kose-kabin": [11, 15], "mika/170-2s2c-h182": [13, 15], "mika/150-1s1c-h182-kabin": [17, 15], "mika/120-1s2c-h182-kabin": [16, 15],
  "mika/80-lik-yan-panel": [15, 15],
};
async function oranlariYaz(program) {
  const state = (await program.request("GET", "/api/maliyet")).data?.data;
  if (!state?.kartlar) throw new Error("oran girdisi: kartlar okunamadı");
  const kartlar = Object.entries(EXCEL_ORANLARI).map(([kod, [yuzde, ekle]]) => {
    if (!state.kartlar[kod]) throw new Error(`oran girdisi: ${kod} yok`);
    return { kod, rev: state.kartlar[kod].rev, adimlar: [{ kod: "yuzde", oran: yuzde }, { kod: "yuzde_ekle", oran: ekle }] };
  });
  const saved = await program.request("PUT", "/api/maliyet", { kartlar });
  if (saved.status !== 200) throw new Error(`oran girdisi kaydedilemedi: ${saved.status} ${JSON.stringify(saved.data).slice(0, 200)}`);
}

async function runScenario(scenario) {
  const dataRoot = mkdtempSync(path.join(tmpdir(), "maliyet-uyarlayici-"));
  let program = null;
  let screen = null;
  const ekran = scenario.katman === "arayuz";
  const ctx = { kimlik: scenario.kimlik, window: null };
  const startFresh = async () => {
    program = await startProgram(dataRoot);
    ctx.window = createWindow(program);
    if (ekran) {
      screen = createScreen(program, scenario.kimlik);
      await screen.login();
    }
  };
  ctx.restart = async () => {
    await screen?.close();
    await program.close();
    await startFresh();
  };
  const adimlar = [];
  try {
    program = await startProgram(dataRoot);
    const sector = await program.request("POST", "/api/workspace/insight/sector", { sectorId: "dusakabin", source: "manual" });
    if (sector.status !== 200) throw new Error(`sektör seçilemedi: ${sector.status}`);
    await program.request("POST", "/api/workspace/bank/setup/dismiss", {});
    await oranlariYaz(program);
    ctx.window = createWindow(program);
    if (ekran) {
      screen = createScreen(program, scenario.kimlik);
      await screen.login();
    }
    for (const step of scenario.adimlar || []) {
      try {
        if (ekran && step.islem === "yeniden_baslat") {
          await ctx.restart();
          adimlar.push({ durum: "tamam" });
        } else adimlar.push(ekran ? await screen.step(step) : await runStep(ctx, step));
      } catch (error) {
        log(`${scenario.kimlik} ${step.islem}: ${error.message.split("\n")[0]}`);
        adimlar.push({ durum: "hata", neden: error.message.split("\n")[0] });
      }
    }
    if (screen?.errors.length) log(`${scenario.kimlik}: sayfa hatası ${screen.errors.join(" | ")}`);
  } catch (error) {
    log(`${scenario.kimlik}: ${error.stack || error.message}`);
    while (adimlar.length < (scenario.adimlar || []).length) adimlar.push({ durum: "hata", neden: error.message });
  } finally {
    try {
      await screen?.close();
      await program?.close();
    } catch (error) {
      log(`${scenario.kimlik}: kapanış hatası ${error.message}`);
    }
    rmSync(dataRoot, { recursive: true, force: true, maxRetries: 5, retryDelay: 100 });
  }
  return { kimlik: scenario.kimlik, adimlar };
}

const readStdin = async () => {
  const chunks = [];
  for await (const chunk of process.stdin) chunks.push(chunk);
  return Buffer.concat(chunks).toString("utf8");
};

const input = JSON.parse(await readStdin());
if (input.dil !== "destekofis-maliyet/1") throw new Error(`bilinmeyen dil: ${input.dil}`);
let commit = "";
try {
  commit = execFileSync("git", ["rev-parse", "HEAD"], { cwd: ROOT, encoding: "utf8" }).trim();
} catch {
  commit = "okunamadı";
}
const { readFileSync } = await import("node:fs");
const version = JSON.parse(readFileSync(path.join(ROOT, "package.json"), "utf8")).version;
const sonuclar = [];
for (const scenario of input.senaryolar || []) sonuclar.push(await runScenario(scenario));
if (browserPromise) await (await browserPromise).close().catch(() => null);
process.stdout.write(
  `${JSON.stringify({
    dil: "destekofis-maliyet/1",
    uyarlayici: { ad: "destekofis-api-ekran", program_surumu: version, commit },
    beyan: { katmanlar: ["api", "arayuz"], "K-BOLEN-0": "ret", "K-FARK": "hucre", bos_sifir_sayilir: false, gosterim_basamak: null },
    sonuclar,
  })}\n`,
);
