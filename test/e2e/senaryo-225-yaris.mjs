// senaryo-225 C adımının ("2. sayfadaki kaydın uyarısı 1. sayfada sağ altta göründü") bir koşuda kırmızı olmasının (92d9e06,
// makine yüklüyken 39/40) yeniden üretimi ve düzeltmenin denetimi (10.10.2026). Ürün kodunu DEĞİŞTİRMEZ.
//
// Sağ alt bildirim kuralı (client/assets/hof-alerts.js): bir bildirim ekrana çıktığı anda (show → markSeen) kullanıcı başına
// localStorage "hof-notices:<kullanıcı>" içine yazılır ve 3 saat (REPEAT_MS) sağ altta YENİDEN GÖSTERİLMEZ (zil listesinde
// kalır). Sunucu takvimi (routes/dues.mjs) açık sayfanın kendi son tarihlerini 7 gün ileriye kadar verir; ÖBÜR sayfaların
// son tarihlerini (reports.calendar) ufuksuz ve "foreign" işaretiyle verir. 2. sayfa (Müşteriler Yeni) seçiliyken hedef kayıt
// ("Envar …", 10 gün sonra) takvimde YOKTUR; 1. sayfa seçilince öbür sayfa kalemi olarak gelir.
//
// KÖK NEDEN (TEST YARIŞI): senaryo kurulumunda 1. sayfa API ile seçilir (sayfa seçimi kullanıcı başına, sunucuda) ve 800 ms
// beklenip page.goto yapılır; bu sırada 2. sayfayı gösteren pencere AÇIK kalır. O pencere takvimi bu 800 ms içinde yeniden
// alırsa (canlı olay → HOF.dues.reloadSoon) artık 1. sayfanın gözünden alır, hedef uyarıyı gösterir ve "görüldü" yazar. Test
// sonra 1. sayfayı açıp uyarıyı bekler; 3 saat kuralı gereği gelmez → 30 sn sonra kırmızı (10.10.2026, 39/40). Uyarı
// kullanıcıya gösterilmiştir (ekrandaydı); ürün kuralı çalışıyor, beklenti testin kendi önceki penceresi yüzünden bozuluyor.
//
// Bu betik her denemede senaryonun kurulumunu AYNI sırayla koşar ve her sayfa yüklemesinde hedef uyarının ekrana çıkıp
// çıkmadığını kaydeder (init betiği → console). Ön koşul = hedef uyarı son (1. sayfa) yüklemeden ÖNCE gösterildi.
//   MODE=natural  senaryodaki sıra (ön koşul kendiliğinden oluşursa oluşur; ~1/3 deneme)
//   MODE=forced   seçimden hemen sonra açık pencere takvimi yeniden alır (HOF.dues.reload) ve hedef uyarı görünene kadar
//                 beklenir: ön koşul ZORLA kurulur
//   FIX=old       senaryonun 10.10.2026 öncesi hâli (seçim açık pencereyle, 800 ms bekle, 1. sayfayı aç)
//   FIX=new       senaryo-225.mjs'deki düzeltme: uygulama sayfasından çıkılır (aynı kökenli stil dosyası), seçim orada
//                 yapılır, kullanıcının "görüldü" kaydı silinir, sonra 1. sayfa açılır
//   TRIALS        deneme sayısı (varsayılan 5);  CPU  Chromium CPU yavaşlatması (varsayılan 1);  DEBUG=1 zaman çizelgesi
//   node --disable-warning=ExperimentalWarning test/e2e/senaryo-225-yaris.mjs
// Geçme ölçütü: FIX=new → her denemede 1. sayfada uyarı görünür; FIX=old → ön koşul oluştuysa uyarının GÖRÜNMEMESİ (yarışın
// kendisi, kırmızı kanıt), oluşmadıysa görünmesi. Çıkış kodu buna göre.
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { chromium } from "playwright";
import { createApp } from "../../server/app.mjs";

const TRIALS = Number(process.env.TRIALS || 5);
const CPU = Number(process.env.CPU || 1);
const MODE = process.env.MODE || "natural";
const FIX = process.env.FIX || "new";
const PASS = "Prova-Admin-2026!";
const TARGET = "Envar Turizm Taşımacılık";
const TARGET_NO = "202092758";
const dmy = days => {
  const date = new Date();
  date.setDate(date.getDate() + days);
  return `${String(date.getDate()).padStart(2, "0")}.${String(date.getMonth() + 1).padStart(2, "0")}.${date.getFullYear()}`;
};
console.log(`# senaryo-225 C yarışı: MODE=${MODE} FIX=${FIX} CPU=${CPU} TRIALS=${TRIALS}`);

let tests = 0;
let pass = 0;
let fail = 0;
let precondition = 0;
for (let trial = 1; trial <= TRIALS; trial += 1) {
  const root = mkdtempSync(path.join(tmpdir(), "destekofis-225-yaris-"));
  const app = createApp({ dataDir: path.join(root, "data"), backupDir: path.join(root, "backups"), logLevel: "error", scheduleBackups: false, env: { HUKUK_ADMIN_PASSWORD: PASS, HUKUK_DATASET_AUTOSYNC: "0" }, license: { enforce: false, machineId: "a1b2c3d4e5f60718293a4b5c6d7e8f25" } });
  const { port } = await app.listen(0, "127.0.0.1");
  const BASE = `http://127.0.0.1:${port}`;
  const browser = await chromium.launch();
  const context = await browser.newContext({ viewport: { width: 1440, height: 1000 }, locale: "tr-TR" });
  await context.addInitScript(() => {
    new MutationObserver(list => {
      for (const entry of list)
        for (const node of entry.addedNodes)
          if (node.nodeType === 1 && node.classList?.contains("hof-notice")) console.log(`NOTICE|${Math.round(performance.now())}|${node.querySelector(".hof-notice-title")?.textContent || ""}`);
    }).observe(document, { childList: true, subtree: true });
  });
  const page = await context.newPage();
  if (CPU > 1) await (await context.newCDPSession(page)).send("Emulation.setCPUThrottlingRate", { rate: CPU });
  // Yükleme sırası: her "load" bir numara alır; bildirim hangi yüklemede gösterildi kaydedilir.
  let loadNo = 0;
  let loadName = "giriş";
  const shows = [];
  const timeline = [];
  const t0 = Date.now();
  page.on("load", () => {
    loadNo += 1;
    timeline.push(`${Date.now() - t0}ms load ${loadNo} (${loadName}) ${page.url()}`);
  });
  if (process.env.DEBUG)
    page.on("response", async response => {
      if (!response.url().includes("/api/workspace/dues")) return;
      const body = await response.json().catch(() => null);
      const list = body?.data?.deadlines || [];
      timeline.push(`${Date.now() - t0}ms dues yanıtı (yükleme ${loadNo}): ${list.length} son tarih, hedef ${list.some(item => String(item.person || item.title || "").includes(TARGET)) ? "VAR" : "yok"}`);
    });
  page.on("console", message => {
    const text = message.text();
    if (text.startsWith("NOTICE|")) {
      const [, t, title] = text.split("|");
      shows.push({ load: loadNo, name: loadName, t: Number(t), title });
      timeline.push(`${Date.now() - t0}ms BİLDİRİM (yükleme ${loadNo}): ${title}`);
    }
  });
  const api = (url, body, method) =>
    page.evaluate(
      async ({ url, body, method }) => {
        const response = await fetch(url, { method: method || (body ? "POST" : "GET"), headers: body ? { "content-type": "application/json" } : {}, body: body ? JSON.stringify(body) : undefined });
        const json = await response.json().catch(() => ({}));
        return { status: response.status, data: json.ok ? json.data : json };
      },
      { url, body, method },
    );
  const goto = async name => {
    loadName = name;
    await page.goto(`${BASE}/`, { waitUntil: "load" });
  };
  try {
    // ----- senaryo-225 kurulumu (aynı sıra ve beklemeler) -----
    await page.goto(`${BASE}/`);
    await page.fill("#hof-auth input[name=username]", "admin");
    await page.fill("#hof-auth input[name=password]", PASS);
    await Promise.all([page.waitForEvent("load"), page.click('#hof-auth button[type="submit"]')]);
    await page.waitForTimeout(1500);
    const rehber = [["Öğrenci No", "Adı", "Soyadı", "Telefonu"]];
    for (let i = 0; i < 30; i += 1) rehber.push([String(22821911000 + i), ["Mehmet", "İrem", "Cihat", "Rahman"][i % 4], ["Türkoğlu", "Eroğlu", "Şenyurt", "Koyuncu"][i % 4], `0532${String(1000000 + i)}`]);
    const musteri = [["Vergi No", "Firma Adı", "Telefon", "Lisans Bitiş Tarihi"]];
    for (let i = 0; i < 60; i += 1) musteri.push(i === 44 ? [TARGET_NO, TARGET, "05321234567", dmy(10)] : [String(300000000 + i), `Firma ${i + 1} Ltd.`, `0533${String(2000000 + i)}`, dmy(200 + i)]);
    const arsiv = [["Vergi No", "Firma Adı", "Telefon", "Lisans Bitiş Tarihi"]];
    for (let i = 0; i < 5; i += 1) arsiv.push([String(400000000 + i), `Arşiv Firma ${i + 1}`, `0534${String(3000000 + i)}`, dmy(300 + i)]);
    const first = await api("/api/workspace/dataset/stage", { kind: "excel", fileName: "TÜM REHBER.xlsx", sheets: [{ name: "REHBER", matrix: rehber }] });
    await api("/api/workspace/dataset/commit", { stageId: first.data.stageId, mode: "replace" });
    await page.waitForTimeout(1500);
    await goto("1. sayfa yüklendikten sonra");
    await page.waitForTimeout(1000);
    const second = await api("/api/workspace/dataset/stage", { kind: "excel", fileName: "Müşteriler Yeni.xlsx", sheets: [{ name: "Müşteriler", matrix: musteri }, { name: "Arşiv", matrix: arsiv }] });
    await api("/api/workspace/dataset/commit", { stageId: second.data.stageId, mode: "session", name: "Müşteriler Yeni" });
    await page.waitForTimeout(1500);
    await goto("2. sayfa açıldıktan sonra");
    await page.waitForTimeout(1000);
    const pages = (await api("/api/workspace/sessions")).data.sessions;
    const p1 = pages.find(item => item.name !== "Müşteriler Yeni");
    // Senaryonun eski sırası: 1. sayfa API ile seçilir, bu sırada 2. sayfayı gösteren pencere AÇIK kalır. Seçim kullanıcı
    // başınadır; açık pencere takvimi yeniden alırsa (canlı olay → reloadSoon) artık 1. sayfanın gözünden alır ve 2. sayfanın
    // kalemleri "öbür sayfa" olarak gelir → hedef uyarı bu pencerede gösterilir ve "görüldü" yazılır.
    await api("/api/workspace/sessions/select", { key: p1.key });
    if (MODE === "forced") {
      // Ön koşulu zorla kur: açık pencere takvimi hemen yeniden alır (doğal koşuda yenileme 800 ms beklemenin içine düşerse).
      await page.evaluate(() => window.HOF.dues.reload());
      await page.waitForSelector(`#hof-notices .hof-notice:has-text("${TARGET}")`, { timeout: 30000 }).catch(() => null);
    }
    if (FIX === "old") await page.waitForTimeout(800);
    // Son yüklemeden önce "görüldü" kaydı: kaç kimlik var, hedefinki var mı (ekrana çıkan bildirim sayısıyla karşılaştırılır).
    const seenIds = await page.evaluate(() => Object.keys(localStorage).filter(key => key.startsWith("hof-notices:")).flatMap(key => Object.keys(JSON.parse(localStorage.getItem(key) || "{}").shown || {})));
    const targetSeen = seenIds.some(id => id.includes("Lisans Bitiş Tarihi") && id.endsWith(dmy(10).split(".").reverse().join("-")));
    let cleared = null;
    if (FIX === "new") {
      // senaryo-225.mjs düzeltmesi (C adımının ön koşulu her koşuda aynı): uygulama sayfasından çıkılır (aynı kökenden bir
      // stil dosyası; uygulama betiği çalışmaz, bildirim gösterilemez), sayfa seçimi orada yapılır, bu kullanıcının
      // "görüldü" kaydı silinir, sonra 1. sayfa açılır.
      loadName = "uygulama dışı (stil dosyası)";
      await page.goto(`${BASE}/assets/hof-ui.css`, { waitUntil: "load" });
      await api("/api/workspace/sessions/select", { key: p1.key });
      cleared = await page.evaluate(() => {
        const keys = Object.keys(localStorage).filter(key => key.startsWith("hof-notices:"));
        for (const key of keys) localStorage.removeItem(key);
        return keys;
      });
    }
    await goto("1. sayfa (C adımı)");
    const finalLoad = loadNo;
    await page.waitForSelector(".dynamic-table tbody tr", { timeout: 30000 });
    await page.waitForTimeout(800);
    const seen = await page.waitForSelector(`#hof-notices .hof-notice:has-text("${TARGET}")`, { timeout: 30000 }).then(() => true).catch(() => false);
    const earlier = shows.filter(item => item.load < finalLoad && item.title.includes(TARGET));
    const pre = earlier.length > 0;
    if (pre) precondition += 1;
    tests += 1;
    // FIX=old: ön koşul oluştuysa uyarının gelmemesi beklenen kırmızıdır (yarışın kendisi); FIX=new: her denemede gelmeli.
    const ok = FIX === "new" ? seen : pre ? !seen : seen;
    if (ok) pass += 1;
    else fail += 1;
    console.log(
      `${ok ? "ok" : "not ok"} ${trial} - ön koşul (uyarı önceki yüklemede gösterildi): ${pre ? "EVET" : "hayır"}${pre ? ` [${earlier.map(item => `yükleme ${item.load} "${item.name}" t=${item.t} ms`).join("; ")}]` : ""}; son yüklemeden önce "görüldü" kaydında ${seenIds.length} kimlik (hedef ${targetSeen ? "VAR" : "yok"}; önceki yüklemelerde ekrana çıkan bildirim ${shows.filter(item => item.load < finalLoad).length})${cleared ? `; silinen: ${cleared.join(",") || "-"}` : ""}; 1. sayfada uyarı: ${seen ? "GÖRÜNDÜ" : "30 sn'de GÖRÜNMEDİ"}`,
    );
    if (process.env.DEBUG) console.log(timeline.map(line => `#   ${line}`).join("\n"));
  } catch (error) {
    tests += 1;
    fail += 1;
    console.log(`not ok ${trial} - hata: ${error.message}`);
  } finally {
    await browser.close().catch(() => {});
    await app.close?.().catch?.(() => {});
    rmSync(root, { recursive: true, force: true });
  }
}
console.log(`# ön koşulun oluştuğu deneme: ${precondition}/${tests}`);
console.log(`# tests ${tests}`);
console.log(`# pass ${pass}`);
console.log(`# fail ${fail}`);
process.exit(fail ? 1 : 0);
