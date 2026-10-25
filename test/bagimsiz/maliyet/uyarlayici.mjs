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
  return { app, request, close: () => app.close() };
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

async function runScenario(scenario) {
  const dataRoot = mkdtempSync(path.join(tmpdir(), "maliyet-uyarlayici-"));
  let program = null;
  const ctx = { kimlik: scenario.kimlik, window: null };
  const startFresh = async () => {
    program = await startProgram(dataRoot);
    ctx.window = createWindow(program);
  };
  ctx.restart = async () => {
    await program.close();
    await startFresh();
  };
  const adimlar = [];
  try {
    await startFresh();
    const sector = await program.request("POST", "/api/workspace/insight/sector", { sectorId: "dusakabin", source: "manual" });
    if (sector.status !== 200) throw new Error(`sektör seçilemedi: ${sector.status}`);
    for (const step of scenario.adimlar || []) {
      try {
        adimlar.push(await runStep(ctx, step));
      } catch (error) {
        log(`${scenario.kimlik} ${step.islem}: ${error.message}`);
        adimlar.push({ durum: "hata", neden: error.message });
      }
    }
  } catch (error) {
    log(`${scenario.kimlik}: ${error.stack || error.message}`);
    while (adimlar.length < (scenario.adimlar || []).length) adimlar.push({ durum: "hata", neden: error.message });
  } finally {
    try {
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
process.stdout.write(
  `${JSON.stringify({
    dil: "destekofis-maliyet/1",
    uyarlayici: { ad: "destekofis-api", program_surumu: version, commit },
    beyan: { katmanlar: ["api"], "K-BOLEN-0": "ret", "K-FARK": "hucre", bos_sifir_sayilir: false, gosterim_basamak: null },
    sonuclar,
  })}\n`,
);
