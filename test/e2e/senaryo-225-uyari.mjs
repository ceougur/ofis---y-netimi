// Sağ alt bildirim ve takvim — iki hata (10.10.2026; senaryo-225 incelemesinde bulundu), arayüzden, gerçek tarayıcıyla:
//
//  1. GÖRMEDEN "GÖRÜLDÜ" (client/assets/hof-alerts.js enqueue): bir turda 5'ten çok bildirim varsa ilk 5'i tek tek, kalanı
//     "n bildirim daha var" özetiyle gelir. Kalanların kimlikleri özet EKRANA ÇIKMADAN (kuyruğa girerken) "görüldü" yazılıyordu;
//     özet sırası gelmeden sayfa yenilenir/kapanırsa bu bildirimler 3 saat sağ altta hiç gösterilmiyordu (yalnız zilde). Turda
//     özet zaten verilmişse sonradan gelen yeniler de hiç gösterilmeden "görüldü" yazılıyordu.
//     Beklenen: her bildirim ya tek başına ya da onu taşıyan özet ekrana çıktığında "görüldü" olur; ekrana çıkmayan kalmaz.
//  4. BAŞKA SAYFANIN DEĞİŞİKLİĞİ TAKVİME GELMİYOR (client/assets/hof-live.js): 2.0.17'den beri takvim/zil/sağ alt bildirimler
//     şirketin BÜTÜN sayfalarını kapsar (öbür sayfaların kalemleri "foreign"), ama canlı kanal başka sayfanın
//     "workspace.changed" olayını (v2.0.1 kuralı: "başka oturumun değişikliği bu ekranı ilgilendirmez") hiç iletmiyordu. Başka
//     bir sayfaya veri/sekme eklenince açık pencerenin takvimi (ve sayfa şeridindeki sayısı) sayfa seçimi değişene ya da 5 dk'lık
//     yedek yenilemeye kadar eski kalıyordu.
//
// Ön koşullar zorla kurulur ve ayrıca denetlenir (ders 20): bildirim sayısı > 5; özet ekrana çıkmadan sayfa yenilenir; turun özeti
// verildikten sonra yeni bir son tarih eklenir; izleyen pencere başka sayfada (HOF.datasetKey ≠ değişen sayfa) ve değişiklikten
// önce takviminde hedef YOK; sunucu aynı kullanıcıya hedefi veriyor (yalnız ekran eski).
// Çalıştırma: node --disable-warning=ExperimentalWarning test/e2e/senaryo-225-uyari.mjs
import fs, { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { chromium } from "playwright";
import { createApp } from "../../server/app.mjs";

const OUT = path.join(path.dirname(fileURLToPath(import.meta.url)), "artifacts", "senaryo-225-uyari");
fs.rmSync(OUT, { recursive: true, force: true });
fs.mkdirSync(OUT, { recursive: true });
const PASS = "Prova-Admin-2026!";
const STAFF_PASS = "Personel-2026!";
const root = mkdtempSync(path.join(tmpdir(), "destekofis-225-uyari-"));
const app = createApp({ dataDir: path.join(root, "data"), backupDir: path.join(root, "backups"), logLevel: "error", scheduleBackups: false, env: { HUKUK_ADMIN_PASSWORD: PASS, HUKUK_DATASET_AUTOSYNC: "0" }, license: { enforce: false, machineId: "a1b2c3d4e5f60718293a4b5c6d7e8f25" } });
const { port } = await app.listen(0, "127.0.0.1");
const BASE = `http://127.0.0.1:${port}`;
const browser = await chromium.launch();

let tests = 0;
let pass = 0;
let fail = 0;
const ok = (cond, what) => {
  tests += 1;
  if (cond) pass += 1;
  else fail += 1;
  console.log(`${cond ? "ok" : "not ok"} ${tests} - ${what}`);
  return Boolean(cond);
};
const dmy = days => {
  const date = new Date();
  date.setDate(date.getDate() + days);
  return `${String(date.getDate()).padStart(2, "0")}.${String(date.getMonth() + 1).padStart(2, "0")}.${date.getFullYear()}`;
};
// Ekrana çıkan her sağ alt bildirim (başlığı) pencerenin window.__notices listesine yazılır (yeniden yüklemede sessionStorage'da sürer).
async function newWindow() {
  const context = await browser.newContext({ viewport: { width: 1440, height: 1000 }, locale: "tr-TR" });
  await context.addInitScript(() => {
    const read = () => {
      try {
        return JSON.parse(sessionStorage.getItem("__notices") || "[]");
      } catch {
        return [];
      }
    };
    window.__notices = read();
    new MutationObserver(list => {
      for (const entry of list)
        for (const node of entry.addedNodes)
          if (node.nodeType === 1 && node.classList?.contains("hof-notice")) {
            window.__notices.push(node.querySelector(".hof-notice-title")?.textContent || "");
            sessionStorage.setItem("__notices", JSON.stringify(window.__notices));
          }
    }).observe(document, { childList: true, subtree: true });
  });
  const page = await context.newPage();
  page.on("pageerror", error => console.log(`# sayfa hatası: ${error.message}`));
  return page;
}
const api = (page, url, body, method) =>
  page.evaluate(
    async ({ url, body, method }) => {
      const response = await fetch(url, { method: method || (body ? "POST" : "GET"), headers: body ? { "content-type": "application/json" } : {}, body: body ? JSON.stringify(body) : undefined });
      const json = await response.json().catch(() => ({}));
      return { status: response.status, data: json.ok ? json.data : json };
    },
    { url, body, method },
  );
const login = async (page, username, password) => {
  await page.goto(`${BASE}/`);
  await page.fill("#hof-auth input[name=username]", username);
  await page.fill("#hof-auth input[name=password]", password);
  await Promise.all([page.waitForEvent("load"), page.click('#hof-auth button[type="submit"]')]);
  await page.waitForTimeout(1500);
};
const seenIds = page => page.evaluate(() => Object.keys(localStorage).filter(key => key.startsWith("hof-notices:")).flatMap(key => Object.keys(JSON.parse(localStorage.getItem(key) || "{}").shown || {})));
const shown = page => page.evaluate(() => window.__notices.slice());
const bellIds = page => page.evaluate(() => window.HOF.alerts.list().map(item => item.id));
const visibleNotice = page => page.waitForSelector("#hof-notices .hof-notice.is-visible", { timeout: 30000 }).catch(() => null);
// Ekrandaki bildirimi kapatır (×); sıradaki 10 sn boşluktan sonra gelir.
const closeNotice = async page => {
  const node = await visibleNotice(page);
  if (!node) return null;
  const title = await node.$eval(".hof-notice-title", item => item.textContent).catch(() => "");
  await node.$eval('[data-act="close"]', button => button.click()).catch(() => {});
  await page.waitForSelector("#hof-notices .hof-notice", { state: "detached", timeout: 5000 }).catch(() => {});
  return title;
};

try {
  // ---------------- Kurulum: 1. sayfada 8 son tarih (bugün … 7 gün sonra) ----------------
  const admin = await newWindow();
  await login(admin, "admin", PASS);
  const firms = [["Vergi No", "Firma Adı", "Telefon", "Lisans Bitiş Tarihi"]];
  for (let i = 0; i < 8; i += 1) firms.push([String(500000000 + i), `Uyarı Firma ${i + 1}`, `0535${String(4000000 + i)}`, dmy(i)]);
  const first = await api(admin, "/api/workspace/dataset/stage", { kind: "excel", fileName: "Firmalar.xlsx", sheets: [{ name: "Firmalar", matrix: firms }] });
  ok((await api(admin, "/api/workspace/dataset/commit", { stageId: first.data.stageId, mode: "replace" })).status === 200, "kurulum: 1. sayfa (8 firma, lisans bitişi bugün … 7 gün sonra) yüklendi");
  ok((await api(admin, "/api/admin/users", { username: "selin", name: "Selin Kaya", role: "personel", password: STAFF_PASS, mustChangePassword: false })).status === 200, "kurulum: personel Selin açıldı");
  await admin.waitForTimeout(1500);
  // Yükleme öncesi bildirimler (veri yokken) sayılmasın: kayıtlar ve sayaç baştan.
  await admin.goto(`${BASE}/assets/hof-ui.css`, { waitUntil: "load" });
  await admin.evaluate(() => {
    for (const key of Object.keys(localStorage)) if (key.startsWith("hof-notices:")) localStorage.removeItem(key);
    sessionStorage.removeItem("__notices");
  });
  await admin.goto(`${BASE}/`, { waitUntil: "load" });

  // ---------------- HATA 1a: özet ekrana çıkmadan "görüldü" ----------------
  console.log("# HATA 1a: 5'ten çok bildirim; özet sırası gelmeden sayfa yenilenir");
  const firstNotice = await visibleNotice(admin);
  ok(Boolean(firstNotice), "ilk sağ alt bildirim geldi");
  const all = await bellIds(admin);
  const firmIds = all.filter(id => id.startsWith("deadline|"));
  ok(firmIds.length === 8, `ön koşul: zilde 8 son tarih bildirimi var (> 5; ${firmIds.length})`);
  const seenAtFirst = await seenIds(admin);
  const shownAtFirst = await shown(admin);
  ok(seenAtFirst.length === shownAtFirst.length, `ilk bildirim ekrandayken "görüldü" kaydı yalnız ekrana çıkanlar: ${seenAtFirst.length} kimlik, ekrana çıkan ${shownAtFirst.length} (özetin taşıdıkları özet gösterilmeden yazılmaz)`);
  // Ön koşul: özet henüz gösterilmeden sayfa yenilenir (kullanıcı başka sayfaya geçti / pencereyi kapattı).
  ok(!shownAtFirst.some(title => /bildirim daha var/.test(title)), "ön koşul: özet bildirimi henüz ekrana çıkmadı");
  await admin.goto(`${BASE}/`, { waitUntil: "load" });
  // Yenilenen sayfada bildirimler kapatılarak sırayla geçilir; özet gelene kadar (en çok 8 bildirim).
  let summaryTitle = "";
  for (let step = 0; step < 8 && !summaryTitle; step += 1) {
    const title = await closeNotice(admin);
    if (title === null) break;
    if (/bildirim daha var/.test(title)) summaryTitle = title;
  }
  const titlesAfter = await shown(admin);
  const seenAfter = await seenIds(admin);
  ok(Boolean(summaryTitle), `yenilenen sayfada özet bildirimi ekrana çıktı (“${summaryTitle || "gelmedi"}”)`);
  const firmTitles = new Set(titlesAfter.filter(title => title.startsWith("Uyarı Firma")));
  const summaryCount = Number((summaryTitle.match(/(\d+) bildirim daha var/) || [])[1] || 0);
  ok(firmTitles.size + summaryCount === 8, `8 bildirimin hepsi ya tek başına (${firmTitles.size}) ya da ekrana çıkan özetle (${summaryCount}) gösterildi`);
  ok(firmIds.every(id => seenAfter.includes(id)), `özet ekrana çıkınca taşıdıkları da "görüldü" (8 kimliğin ${firmIds.filter(id => seenAfter.includes(id)).length}'i)`);

  // ---------------- HATA 1b: turun özeti verildikten sonra gelen yeni bildirim ----------------
  console.log("# HATA 1b: turun özeti gösterildikten sonra yeni son tarih eklenir");
  const staffWriter = await newWindow();
  await login(staffWriter, "selin", STAFF_PASS);
  const beforeNew = await seenIds(admin);
  const added = await api(staffWriter, "/api/workspace/records", { sourceName: "dataset://ofis", sheet: "Firmalar", values: { "Vergi No": "599999999", "Firma Adı": "Sonradan Gelen Firma", Telefon: "05359999999", "Lisans Bitiş Tarihi": dmy(2) } });
  ok(added.status === 200, `personel yeni kayıt ekledi (son tarihi 2 gün sonra; ${added.status})`);
  await staffWriter.context().close();
  await admin.waitForFunction(() => window.HOF.alerts.list().some(item => item.title.includes("Sonradan Gelen Firma")), null, { timeout: 30000 }).catch(() => {});
  const newId = (await admin.evaluate(() => window.HOF.alerts.list().find(item => item.title.includes("Sonradan Gelen Firma"))?.id)) || "";
  ok(Boolean(newId), "ön koşul: yeni son tarih yöneticinin zil listesine geldi (turda 5 bildirim ve özet zaten verildi)");
  const extra = await admin.waitForSelector('#hof-notices .hof-notice:has-text("bildirim daha var")', { timeout: 40000 }).catch(() => null);
  const extraTitle = extra ? await extra.$eval(".hof-notice-title", node => node.textContent).catch(() => "") : "";
  const seenNew = (await seenIds(admin)).includes(newId);
  ok(!seenNew || Boolean(extra), `yeni bildirim ekrana çıkmadan "görüldü" yazılmadı ("görüldü": ${seenNew ? "EVET" : "hayır"}; ekrana çıktı: ${extra ? "EVET" : "hayır"})`);
  ok(Boolean(extra), `yeni bildirim sağ altta yeni bir özetle gösterildi (“${extraTitle || "gelmedi"}”)`);
  ok(Boolean(extra) && seenNew, 'özet ekrana çıkınca yeni bildirim "görüldü"');
  ok(beforeNew.length === 8, `yeni kayıttan önce "görüldü" kaydında 8 kimlik (${beforeNew.length})`);
  await admin.screenshot({ path: path.join(OUT, "1-ozet.png") });

  // ---------------- HATA 4: başka sayfaya veri eklenince açık pencerenin takvimi ----------------
  console.log("# HATA 4: başka sayfaya sekme eklenince açık pencerenin takvimi");
  // 2. sayfa (son tarihsiz) yönetici tarafından açılır; yönetici o sayfada kalır (seçim kullanıcı başına).
  const plain = [["No", "Adı", "Telefonu"]];
  for (let i = 0; i < 5; i += 1) plain.push([String(7000 + i), `Kişi ${i + 1}`, `0536${String(5000000 + i)}`]);
  const second = await api(admin, "/api/workspace/dataset/stage", { kind: "excel", fileName: "Rehber.xlsx", sheets: [{ name: "Rehber", matrix: plain }] });
  ok((await api(admin, "/api/workspace/dataset/commit", { stageId: second.data.stageId, mode: "session", name: "Rehber" })).status === 200, "kurulum: 2. sayfa (Rehber, son tarihsiz) açıldı");
  // Yeni sayfa açılınca yöneticinin ekranı kendini yeniden açar (sonraki istekler yarıda kalmasın).
  await admin.waitForTimeout(1500);
  await admin.goto(`${BASE}/`, { waitUntil: "load" });
  await admin.waitForTimeout(1000);
  const pages = (await api(admin, "/api/workspace/sessions")).data.sessions;
  const p1 = pages.find(item => item.name !== "Rehber");
  const p2 = pages.find(item => item.name === "Rehber");
  // İzleyen pencere: personel 1. sayfada.
  const staff = await newWindow();
  await login(staff, "selin", STAFF_PASS);
  await api(staff, "/api/workspace/sessions/select", { key: p1.key });
  await staff.goto(`${BASE}/`, { waitUntil: "load" });
  await staff.waitForFunction(() => window.HOF?.dues?.data?.()?.generatedAt, null, { timeout: 30000 }).catch(() => {});
  await staff.waitForTimeout(3000);
  const staffKey = await staff.evaluate(() => window.HOF.datasetKey);
  ok(staffKey === p1.key && p2.key !== staffKey, `ön koşul: izleyen pencere 1. sayfada (${staffKey}), değişecek sayfa başka (${p2.key})`);
  const TARGET = "Yeni Sekme Firması";
  const hasTarget = page => page.evaluate(name => (window.HOF.dues.data().deadlines || []).some(item => String(item.person || item.title || "").includes(name)), TARGET);
  ok(!(await hasTarget(staff)), "ön koşul: değişiklikten önce izleyen pencerenin takviminde hedef yok");
  // Yönetici kendi sayfasına (2. sayfa) yeni bir sekme ekler: 3 gün sonra lisansı biten firma.
  const tab = [["Vergi No", "Firma Adı", "Telefon", "Lisans Bitiş Tarihi"], ["611111111", TARGET, "05361111111", dmy(3)]];
  const merge = await api(admin, "/api/workspace/dataset/stage", { kind: "excel", fileName: "Rehber.xlsx", sheets: [{ name: "Rehber", matrix: plain }, { name: "Lisanslar", matrix: tab }] });
  ok((await api(admin, "/api/workspace/dataset/commit", { stageId: merge.data.stageId, mode: "merge" })).status === 200, "yönetici 2. sayfaya “Lisanslar” sekmesini ekledi (devamı olarak)");
  const arrived = await staff.waitForFunction(name => (window.HOF.dues.data().deadlines || []).some(item => String(item.person || item.title || "").includes(name)), TARGET, { timeout: 20000 }).then(() => true).catch(() => false);
  const server = await api(staff, "/api/workspace/dues");
  const serverHas = (server.data.deadlines || []).some(item => String(item.person || item.title || "").includes(TARGET));
  ok(serverHas, "sunucu izleyen kullanıcıya hedefi veriyor (öbür sayfa kalemi)");
  ok(arrived, "açık pencerenin takvimi 20 sn içinde yenilendi: başka sayfanın yeni son tarihi geldi");
  const inBell = await staff.evaluate(name => window.HOF.alerts.list().some(item => item.title.includes(name)), TARGET);
  ok(inBell, "zil listesinde de var");
  // Aynı kök neden: sayfa şeridindeki öbür sayfanın kayıt sayısı (5 → 6).
  const pill = await staff.waitForFunction(key => /6 kayıt/.test(document.querySelector(`#hof-pages [data-pick="${CSS.escape(key)}"]`)?.textContent || ""), p2.key, { timeout: 10000 }).then(() => true).catch(() => false);
  const pillText = await staff.evaluate(key => document.querySelector(`#hof-pages [data-pick="${CSS.escape(key)}"]`)?.textContent || "", p2.key);
  ok(pill, `izleyen penceredeki sayfa şeridinde 2. sayfanın sayısı güncellendi (“${pillText.replace(/\s+/g, " ").trim()}”)`);
  await staff.screenshot({ path: path.join(OUT, "4-izleyen-pencere.png") });
} catch (error) {
  ok(false, `hata: ${error.stack || error.message}`);
} finally {
  await browser.close().catch(() => {});
  await app.close?.().catch?.(() => {});
  rmSync(root, { recursive: true, force: true });
}
console.log(`# tests ${tests}`);
console.log(`# pass ${pass}`);
console.log(`# fail ${fail}`);
process.exit(fail ? 1 : 0);
