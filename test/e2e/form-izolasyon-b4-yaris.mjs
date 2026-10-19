// senaryo-form-izolasyon-243 adım B4 ("fare üstündeyken bildirim kapanmadı") CI #837 dd3fa08'de ara sıra kırmızı; aynı test #838 f1fcee0'da ve
// yerelde yeşil (18.10.2026). Ders 20 gereği yarışın ön koşulu ZORLA üretilir; ürün mü test mi ayrılır.
//
// MEKANİZMA: bildirim tıklamayı geçirir (pointer-events: none), mouseenter gelmez; hof-core.js fare üstünde mi sorusunu YALNIZ mousemove
// olayında bildirimin o anki kutusuyla yanıtlar. Bildirimler kutusu (#hof-toasts) sağ alttaki açılır bildirim (hof-alerts.js "hof-notice") açılınca/
// kapanınca body.hof-notice-open ile --hof-notice-space kadar (≈150 px) yukarı/aşağı kayar (0,24 sn geçiş); pencere arka planı açıkken üst ortaya
// geçer. Fare durduğu yerde bildirim kayınca mousemove olmaz, durum yeniden hesaplanmaz.
//
// MODE (her biri TRIALS deneme; CPU = Chromium CPU yavaşlatması, CDP Emulation.setCPUThrottlingRate):
//   eski-test   senaryonun 18.10.2026 öncesi sırası: bildirim → 300 ms → kutu ölçülür → (ZORLA: LEAD ms sonra açılır bildirim açılır, kutu kayar)
//               → fare ölçülen noktaya → 4,8 sn → bildirim duruyor mu. Ön koşul: fare vardığında bildirimin kutusunun DIŞINDA.
//   altina      ÜRÜN: fare durur; açılır bildirim kapanır, bildirim farenin ALTINA kayar (kullanıcı fareyi bildirime götürmüş, o sırada bildirim
//               kaymış). Ön koşul: kaymadan sonra fare bildirimin içinde. Beklenen: kapanmaz.
//   uzaklas     ÜRÜN: fare bildirimin üstünde (bekletiliyor); açılır bildirim açılır, bildirim fareden UZAKLAŞIR. Ön koşul: kaymadan sonra fare
//               dışarıda. Beklenen: kalan süre (en az 2 sn) sonunda kapanır (eski kod fare kıpırdayana dek sonsuza dek bekletiyordu).
//   yeni-test   senaryonun düzeltilmiş sırası (gerçek açılır bildirim döngüsü açıkken: gecikmiş görevler): açılır bildirimler kapatılır ve kapalı
//               tutulur (kullanıcı ayarı "Sağ altta açılır bildirim göster"), kutu durgunlaşana dek beklenir, fare konur, farenin bildirimin
//               içinde olduğu ölçülür. Ön koşul (yarış fırsatı): deneme başında ekranda açılır bildirim vardı.
//
//   node --disable-warning=ExperimentalWarning test/e2e/form-izolasyon-b4-yaris.mjs
//   MODE=eski-test|altina|uzaklas|yeni-test|hepsi (varsayılan hepsi)  TRIALS (varsayılan 10)  CPU (varsayılan 1)  LEAD (varsayılan 0 ms)
// Çıkış: her mod için "deneme / ön koşul oluştu / kırmızı"; beklenen dışı sonuç varsa çıkış kodu 1.
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { chromium } from "playwright";
import { CURRENT, bootVersion } from "../guvenilirlik/surumler.mjs";
import { ADMIN_PASSWORD } from "../helpers.mjs";

const TRIALS = Number(process.env.TRIALS || 10);
const CPU = Number(process.env.CPU || 1);
const LEAD = Number(process.env.LEAD || 0);
const MODES = (process.env.MODE || "hepsi") === "hepsi" ? ["eski-test", "altina", "uzaklas", "yeni-test"] : [process.env.MODE];
const sleep = ms => new Promise(resolve => setTimeout(resolve, ms));
const root = mkdtempSync(path.join(tmpdir(), "form-izolasyon-b4-yaris-"));
const iso = days => {
  const d = new Date();
  d.setDate(d.getDate() + days);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
};

const server = await bootVersion(CURRENT, { dataDir: path.join(root, "data"), backupDir: path.join(root, "backups"), logLevel: "warn" });
const admin = await server.login();
await admin.post("/api/workspace/bank/setup/dismiss", {});
// Gerçek açılır bildirim döngüsü (yeni-test): gecikmiş görevler.
for (let i = 0; i < 6; i += 1) await admin.post("/api/workspace/tasks", { title: `Gecikmiş Görev ${i + 1}`, dueDate: iso(-1 - i), priority: "high" });

const browser = await chromium.launch();
const results = [];
let unexpected = 0;
try {
  const context = await browser.newContext({ viewport: { width: 1600, height: 900 }, locale: "tr-TR" });
  await context.addInitScript(() => document.addEventListener("DOMContentLoaded", () => document.head.appendChild(Object.assign(document.createElement("style"), { textContent: "#hof-license-bar,.hof-license-notice{display:none!important}" }))));
  const page = await context.newPage();
  page.setDefaultTimeout(15000);
  await page.goto(`${server.base}/`);
  await page.fill("#hof-auth input[name=username]", "admin");
  await page.fill("#hof-auth input[name=password]", ADMIN_PASSWORD);
  await Promise.all([page.waitForEvent("load"), page.click('#hof-auth button[type="submit"]')]);
  await page.waitForFunction(() => Boolean(window.HOF?.toast && window.HOF?.alerts), null, { timeout: 30000 });
  if (CPU > 1) await (await page.context().newCDPSession(page)).send("Emulation.setCPUThrottlingRate", { rate: CPU });

  // Açılır bildirim kaymasını hof-alerts.js'in yaptığıyla AYNI yolla (sınıf + değişken) zorla üretir; gerçek bildirim düğümü olmadan.
  const shift = open => page.evaluate(on => {
    document.body.style.setProperty("--hof-notice-space", "152px");
    document.body.classList.toggle("hof-notice-open", on);
  }, open);
  const settle = () => page.waitForFunction(() => {
    const host = document.getElementById("hof-toasts");
    return !host || host.getAnimations({ subtree: true }).length === 0;
  }, null, { timeout: 5000 }).catch(() => null);
  const freshToast = async text => {
    await page.evaluate(t => {
      document.querySelectorAll(".hof-toast").forEach(node => node.remove());
      window.HOF.toast(t, { type: "info" });
    }, text);
  };
  const present = text => page.$$eval(".hof-toast-text", (nodes, t) => nodes.some(node => node.textContent === t), text);
  const inside = async ([x, y]) => page.evaluate(([px, py]) => {
    const box = document.querySelector(".hof-toast")?.getBoundingClientRect();
    return Boolean(box) && px >= box.left && px <= box.right && py >= box.top && py <= box.bottom;
  }, [x, y]);
  const quietAlerts = async on => {
    await page.evaluate(mute => {
      localStorage.setItem(`hof-notices-off:${window.HOF.user?.id || "?"}`, JSON.stringify(mute));
      if (mute) document.querySelectorAll("#hof-notices .hof-notice-close").forEach(button => button.click());
      else window.HOF.alerts.enqueue();
    }, on);
  };

  for (const mode of MODES) {
    const row = { mode, trials: 0, pre: 0, red: 0, redNoPre: 0, notes: [] };
    for (let trial = 0; trial < TRIALS; trial += 1) {
      row.trials += 1;
      const text = `Fare testi ${mode} ${trial}.`;
      await page.mouse.move(5, 5, { steps: 2 });
      await shift(false);
      await settle();
      let pre = false;
      let pass = false;
      if (mode === "eski-test") {
        await freshToast(text);
        await sleep(300);
        const box = await page.locator(".hof-toast").first().boundingBox();
        const point = [box.x + 30, box.y + box.height / 2];
        if (LEAD) await sleep(LEAD);
        await shift(true); // ZORLA: ölçümle fare hareketi arasında açılır bildirim açıldı
        await page.mouse.move(point[0], point[1], { steps: 4 });
        await settle();
        pre = !(await inside(point));
        await sleep(4800);
        pass = await present(text);
      } else if (mode === "altina") {
        await shift(true);
        await settle();
        await freshToast(text);
        await settle();
        const box = await page.locator(".hof-toast").first().boundingBox();
        // Kaymadan sonra bildirimin geleceği yer: kutu 152 px aşağı iner.
        const point = [box.x + 30, box.y + box.height / 2 + 152];
        await page.mouse.move(point[0], point[1], { steps: 4 });
        const before = await inside(point);
        await shift(false); // açılır bildirim kapandı; bildirim duran farenin altına kayar
        await settle();
        pre = !before && (await inside(point));
        await sleep(4800);
        pass = await present(text);
      } else if (mode === "uzaklas") {
        await freshToast(text);
        await settle();
        const box = await page.locator(".hof-toast").first().boundingBox();
        const point = [box.x + 30, box.y + box.height / 2];
        await page.mouse.move(point[0], point[1], { steps: 4 });
        await sleep(400);
        await shift(true); // açılır bildirim açıldı; bildirim duran fareden uzaklaşır
        await settle();
        pre = !(await inside(point));
        await sleep(4800); // kalan süre en az 2 sn; 3,6 sn'lik bildirimin süresi çoktan doldu
        pass = !(await present(text));
      } else {
        // yeni-test: gerçek döngü açıkken senaryonun düzeltilmiş adımı.
        // Ön koşul: ekranda gerçek açılır bildirim var (kapanınca / yenisi gelince bildirimler kutusu kayar). "Görüldü" kaydı silinir, döngü
        // yeniden başlatılır, bildirim çıkana dek beklenir; sonra rastgele bir an (0–1,5 sn) seçilir.
        await page.evaluate(() => localStorage.removeItem(`hof-notices:${window.HOF.user?.id || "?"}`));
        await quietAlerts(false);
        await page.waitForSelector("#hof-notices .hof-notice.is-visible", { timeout: 15000 }).catch(() => null);
        await sleep(Math.floor(Math.random() * 1500));
        pre = await page.evaluate(() => Boolean(document.querySelector("#hof-notices .hof-notice")) && document.body.classList.contains("hof-notice-open"));
        await quietAlerts(true);
        await page.waitForFunction(() => !document.querySelector("#hof-notices .hof-notice") && !document.body.classList.contains("hof-notice-open"), null, { timeout: 5000 }).catch(() => null);
        await settle();
        await freshToast(text);
        await settle();
        const box = await page.locator(".hof-toast").first().boundingBox();
        const point = [box.x + 30, box.y + box.height / 2];
        await page.mouse.move(point[0], point[1], { steps: 4 });
        const placed = await inside(point);
        await sleep(4800);
        pass = placed && (await present(text)) && (await inside(point));
        await page.mouse.move(5, 5, { steps: 2 });
        await quietAlerts(false);
      }
      if (pre) row.pre += 1;
      if (!pass) {
        if (pre) row.red += 1;
        else row.redNoPre += 1;
      }
      console.log(`  ${mode} #${trial + 1}: ön koşul ${pre ? "OLUŞTU" : "oluşmadı"} · ${pass ? "yeşil" : "KIRMIZI"}`);
      await page.evaluate(() => document.querySelectorAll(".hof-toast").forEach(node => node.remove()));
    }
    results.push(row);
  }
} finally {
  await browser.close().catch(() => null);
  await server.close().catch(() => null);
  rmSync(root, { recursive: true, force: true });
}

console.log(`\nCPU=${CPU} LEAD=${LEAD} TRIALS=${TRIALS}`);
for (const row of results) {
  console.log(`${row.mode}: ${row.trials} deneme · ön koşul oluştu ${row.pre} · ön koşullu kırmızı ${row.red} · ön koşulsuz kırmızı ${row.redNoPre}`);
  // Ön koşulsuz kırmızı her modda beklenmez; eski-test'te ön koşullu kırmızı TEST yarışının kanıtıdır (beklenen), öbürlerinde ürün hatası.
  if (row.redNoPre) unexpected += 1;
  if (row.mode !== "eski-test" && row.red) unexpected += 1;
}
process.exitCode = unexpected ? 1 : 0;
