// Senaryo 2.0.21 madde 1 — kullanıcı (03.10.2026): "bir şirketin verisinin başka şirkete yazılması tam bir fiyasko, çok
// endişeleniyorum". 2.0.17–2.0.19'da "kod değiştir (002 → 005) + eski kodla (002) yeni şirket aç" sırasını yaşamış kurulum
// sıfırdan kurulur (iki şirket aynı veri dosyası). Arayüzden: hata yeniden üretilir (birine girilen cari öbüründe görünür) →
// sol üstte uyarı → Yönetim → Şirketler'de kırmızı kutu ve "Ayır" → onay penceresi → ayrılınca kutu ve uyarı kalkar; bundan
// sonra girilen kayıt yalnız kendi şirketinde; ayırma öncesi yedek ayrılan şirketin klasöründe. Madde 8: aynı hesap iki
// pencerede; birinde şirket değişse de öbür pencerenin kaydı kendi ekranındaki şirkete yazılır.
// Çalıştırma: node --disable-warning=ExperimentalWarning test/e2e/senaryo-221.mjs
import fs, { existsSync, mkdirSync, mkdtempSync, readdirSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { chromium } from "playwright";
import { createApp } from "../../server/app.mjs";
import { titleCase } from "../../server/lib/text-case.mjs";

const OUT = path.join(path.dirname(fileURLToPath(import.meta.url)), "artifacts", "senaryo-221");
fs.rmSync(OUT, { recursive: true, force: true });
fs.mkdirSync(OUT, { recursive: true });
const PASS = "Prova-Admin-2026!";
const root = mkdtempSync(path.join(tmpdir(), "destekofis-221-"));
const dataDir = path.join(root, "data");
const backupRoot = path.join(root, "backups");
// 2.0.19'un bıraktığı kayıt defteri.
mkdirSync(path.join(dataDir, "sirketler", "002"), { recursive: true });
writeFileSync(
  path.join(dataDir, "sirketler.json"),
  JSON.stringify({
    companies: [
      { id: "sirket-001", code: "001", name: "Ana Şirket", dir: "", createdAt: "2026-09-01T08:00:00.000Z", createdBy: "" },
      { id: "sirket-eski", code: "005", name: "Resmî Şirket", dir: "sirketler/002", createdAt: "2026-10-01T08:00:00.000Z", createdBy: "" },
      { id: "sirket-yeni", code: "002", name: "Gayri Resmî", dir: "sirketler/002", createdAt: "2026-10-02T08:00:00.000Z", createdBy: "" },
    ],
  }),
);
const app = createApp({ dataDir, backupDir: backupRoot, logLevel: "error", scheduleBackups: false, env: { HUKUK_ADMIN_PASSWORD: PASS, HUKUK_DATASET_AUTOSYNC: "0" }, license: { enforce: false, machineId: "a1b2c3d4e5f60718293a4b5c6d7e8f96" } });
const { port } = await app.listen(0, "127.0.0.1");
const BASE = `http://127.0.0.1:${port}`;
const browser = await chromium.launch();
const context = await browser.newContext({ viewport: { width: 1440, height: 1000 }, locale: "tr-TR" });
const page = await context.newPage();
const errors = [];
page.on("pageerror", error => errors.push(`pageerror ${error.message}`));
page.on("console", message => {
  if (message.type() === "error" && !/api\/auth\/me|Failed to load resource/.test(`${message.location().url} ${message.text()}`)) errors.push(`${message.text()} @ ${message.location().url}`);
});

let passed = 0;
let failed = 0;
let shotNo = 0;
const ok = (cond, what) => {
  if (cond) passed += 1;
  else failed += 1;
  console.log(`  ${cond ? "✓" : "✗"} ${what}`);
  return Boolean(cond);
};
const shot = async (name, options = {}) => {
  shotNo += 1;
  await page.evaluate(() =>
    Promise.all(
      document
        .getAnimations()
        .filter(item => Number.isFinite(item.effect?.getComputedTiming().endTime))
        .map(item => item.finished.catch(() => null)),
    ),
  );
  await page.screenshot({ path: path.join(OUT, `${String(shotNo).padStart(2, "0")}-${name}.png`), ...options });
};
const modal = ".hof-modal-backdrop.is-visible";
// 2.0.21: sayfanın istekleri sayfanın şirketine gider; test "şirketi seç, sonra işlem yap" derken o şirketi açıkça ekler.
let focus = "";
const scopedUrl = url => (focus && url.startsWith("/api/") && !url.startsWith("/api/companies") ? `${url}${url.includes("?") ? "&" : "?"}hofCompany=${focus}` : url);
const api = async (url, body) => {
  const result = await rawApi(scopedUrl(url), body);
  if (url === "/api/companies/select" && result.status === 200) focus = body.id;
  return result;
};
const rawApi = (url, body) =>
  page.evaluate(
    async ({ url, body }) => {
      const response = await fetch(url, { method: body ? "POST" : "GET", headers: body ? { "content-type": "application/json" } : {}, body: body ? JSON.stringify(body) : undefined });
      const json = await response.json();
      return { status: response.status, data: json.ok ? json.data : json };
    },
    { url, body },
  );
const namesIn = async id => {
  await api("/api/companies/select", { id });
  return (await api("/api/workspace/accounts")).data.accounts.map(item => item.name).sort();
};
const waitToast = pattern => page.waitForFunction(re => new RegExp(re).test([...document.querySelectorAll(".hof-toast")].map(node => node.textContent).join(" ")), pattern.source, { timeout: 20000 }).then(() => true, () => false);

try {
  console.log("\n■ Kurulum: 2.0.19'dan kalma kayıt (005 ve 002 aynı veri klasöründe); hata yeniden üretilir");
  await page.goto(`${BASE}/`);
  await page.fill("#hof-auth input[name=username]", "admin");
  await page.fill("#hof-auth input[name=password]", PASS);
  await Promise.all([page.waitForEvent("load"), page.click('#hof-auth button[type="submit"]')]);
  await api("/api/companies/select", { id: "sirket-eski" });
  await api("/api/workspace/accounts", { name: "Resmî Müşteri", type: "customer" });
  ok(JSON.stringify(await namesIn("sirket-yeni")) === JSON.stringify(["Resmî Müşteri"]), "hata: 005'e girilen cari 002'de de görünüyor (ayırmadan önce)");

  console.log("\n■ Sol üstte uyarı (002 açıkken)");
  await page.goto(`${BASE}/`, { waitUntil: "load" });
  await page.waitForSelector("#hof-company-warn", { timeout: 15000 });
  const warn = (await page.textContent("#hof-company-warn")).trim();
  ok(/005 · Resmî Şirket ile aynı veri dosyasını kullanıyor/.test(warn) && /Şirketler'de Ayır/.test(warn), `uyarı: ${warn}`);
  const order = await page.evaluate(() => {
    const box = document.querySelector("#hof-company");
    return box?.nextElementSibling?.id || "";
  });
  ok(order === "hof-company-warn", "uyarı şirket kutusunun hemen altında");
  await shot("sol-ust-uyari", { clip: { x: 0, y: 0, width: 330, height: 330 } });

  console.log("\n■ Yönetim → Şirketler: kırmızı kutu ve Ayır");
  await page.goto(`${BASE}/admin.html#companies`, { waitUntil: "load" });
  await page.waitForSelector("#adm-company-conflicts:not([hidden]) [data-c-separate]", { timeout: 15000 });
  const card = (await page.textContent("#adm-company-conflicts")).replace(/\s+/g, " ").trim();
  ok(/005 · Resmî Şirket ve 002 · Gayri Resmî aynı veri dosyasını kullanıyor/.test(card) && /005 · Resmî Şirket dosyayı korur/.test(card), "kutu: iki şirket ve dosyayı koruyan şirket yazıyor");
  const buttons = await page.$$eval("#adm-company-conflicts [data-c-separate]", nodes => nodes.map(node => [node.dataset.cSeparate, node.textContent.trim()]));
  ok(JSON.stringify(buttons) === JSON.stringify([["sirket-yeni", "Ayır: 002 · Gayri Resmî"]]), `düğme yalnız ayrılacak şirkette: ${buttons.map(item => item[1]).join(", ")}`);
  const heading = (await page.textContent("#adm-company-conflicts h2")).trim();
  ok(titleCase(heading) === heading, `başlık yazım düzeninde: ${heading}`);
  await shot("sirketler-kirmizi-kutu");
  await page.click('#adm-company-conflicts [data-c-separate="sirket-yeni"]');
  await page.waitForSelector(`${modal} input[name="confirm"]`);
  const title = (await page.textContent(`${modal} h2, ${modal} .hof-modal-title`)).trim();
  ok(/Şirketi Ayır · 002 · Gayri Resmî/.test(title), `pencere: ${title}`);
  await page.fill(`${modal} input[name="confirm"]`, "002");
  await page.fill(`${modal} input[name="password"]`, PASS);
  await shot("ayir-penceresi");
  await page.click(`${modal} form [type="submit"]`);
  ok(await waitToast(/ayrıldı; artık kendi veri dosyasını kullanıyor/), "bildirim: ayrıldı");
  await page.waitForSelector("#adm-company-conflicts[hidden]", { state: "attached", timeout: 15000 });
  ok(await page.$eval("#adm-company-conflicts", node => node.hidden), "kırmızı kutu kalktı");
  await shot("ayrildi");

  console.log("\n■ Ayrıldıktan sonra: kayıtlar ayrı; ayırma öncesi yedek 002'nin klasöründe; sol üstte uyarı yok");
  await api("/api/companies/select", { id: "sirket-yeni" });
  await api("/api/workspace/accounts", { name: "Gayri Resmî Müşteri", type: "customer" });
  const yeni = await namesIn("sirket-yeni");
  const eski = await namesIn("sirket-eski");
  const ana = await namesIn("sirket-001");
  ok(JSON.stringify(yeni) === JSON.stringify(["Gayri Resmî Müşteri", "Resmî Müşteri"]), `002: ${yeni.join(", ")} (ayırma anındaki kayıt + yeni kayıt)`);
  ok(JSON.stringify(eski) === JSON.stringify(["Resmî Müşteri"]), `005: ${eski.join(", ")} (002'ye girilen görünmüyor)`);
  ok(ana.length === 0, "001 etkilenmedi");
  const folder = readdirSync(backupRoot).find(name => name.startsWith("002 - "));
  const files = folder ? readdirSync(path.join(backupRoot, folder)) : [];
  ok(files.some(name => /-ayirma-oncesi-002\.sqlite$/.test(name)), `ayırma öncesi yedek: ${folder}/${files.join(", ")}`);
  await api("/api/companies/select", { id: "sirket-yeni" });
  await page.goto(`${BASE}/`, { waitUntil: "load" });
  await page.waitForSelector("#hof-company", { timeout: 15000 });
  await page.waitForTimeout(500);
  ok(!(await page.$("#hof-company-warn")), "sol üstte uyarı yok");
  ok(existsSync(path.join(dataDir, "sirketler", "002", "destekofis.sqlite")), "005'in (dosyayı koruyan) veri dosyası yerinde");

  console.log("\n■ Aynı hesap iki pencerede (madde 8): B 002'ye geçer; A (001'i gösteriyor) yazmaya devam eder");
  await api("/api/companies/select", { id: "sirket-001" });
  const streams = [];
  page.on("request", request => request.url().includes("/api/events") && streams.push(request.url()));
  await page.goto(`${BASE}/`, { waitUntil: "load" });
  await page.waitForSelector("#hof-company", { timeout: 15000 });
  const other = await context.newPage();
  other.on("pageerror", error => errors.push(`pageerror(B) ${error.message}`));
  await other.goto(`${BASE}/`, { waitUntil: "load" });
  await other.waitForSelector("#hof-company", { timeout: 15000 });
  // B arayüzden şirket değiştirir (sayfa yenilenir).
  await other.click("#hof-company [data-toggle]");
  await other.waitForSelector('#hof-company [data-pick="sirket-yeni"]');
  await Promise.all([other.waitForEvent("load"), other.click('#hof-company [data-pick="sirket-yeni"]')]);
  await other.waitForSelector("#hof-company", { timeout: 15000 });
  ok(/002 · Gayri Resmî/.test(await other.textContent("#hof-company strong")), "B: 002 · Gayri Resmî açık");
  // A'nın ekranı hâlâ 001; A'nın istekleri (programın kendi API yolu ve tablo paketinin fetch'i) 001'e gider.
  ok(/001 · Ana Şirket/.test(await page.textContent("#hof-company strong")), "A: ekranda hâlâ 001 · Ana Şirket");
  await page.evaluate(() => window.HOF.api("/api/workspace/accounts", { method: "POST", body: { name: "A Penceresi Carisi", type: "customer" } }));
  const viaFetch = await page.evaluate(async () => (await (await fetch("/api/workspace/accounts")).json()).data.accounts.map(item => item.name).sort());
  ok(JSON.stringify(viaFetch) === JSON.stringify(["A Penceresi Carisi"]), `A'nın tablo paketi yolu (fetch) 001'i okur: ${viaFetch.join(", ")}`);
  await other.evaluate(() => window.HOF.api("/api/workspace/accounts", { method: "POST", body: { name: "B Penceresi Carisi", type: "customer" } }));
  const inB = await other.evaluate(async () => (await window.HOF.api("/api/workspace/accounts")).accounts.map(item => item.name).sort());
  ok(JSON.stringify(inB) === JSON.stringify(["B Penceresi Carisi", "Gayri Resmî Müşteri", "Resmî Müşteri"]), `B 002'ye yazar: ${inB.join(", ")}`);
  await page.waitForFunction(() => true, null, { timeout: 1000 });
  ok(streams.length > 0 && streams.every(url => /hofCompany=sirket-001/.test(url)), `A'nın canlı olay akışı 001'den (${streams.length} bağlantı)`);
  // A'nın indirme bağlantısı (PDF) da 001'den gelir.
  await page.evaluate(() => {
    const link = Object.assign(document.createElement("a"), { href: "/api/workspace/report-center/cari-listesi/xlsx", id: "a-test-link", textContent: "Excel İndir" });
    link.addEventListener("click", event => event.preventDefault());
    document.body.appendChild(link);
  });
  await page.evaluate(() => document.getElementById("a-test-link").click());
  ok(/hofCompany=sirket-001/.test(await page.getAttribute("#a-test-link", "href")), "A'nın indirme bağlantısı 001'e gider");
  await other.close();

  ok(!errors.length, `sayfada JavaScript hatası yok${errors.length ? `: ${errors.join(" ; ")}` : ""}`);
} catch (error) {
  failed += 1;
  console.log(`  ✗ beklenmeyen hata: ${error.stack || error.message}`);
  await shot("hata").catch(() => null);
} finally {
  await browser.close();
  await app.close();
  rmSync(root, { recursive: true, force: true });
}
console.log(`\nSenaryo 2.0.21: ${passed} geçti, ${failed} kaldı. Ekranlar: ${path.relative(process.cwd(), OUT)}`);
process.exit(failed ? 1 : 0);
