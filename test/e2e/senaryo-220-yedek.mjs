// Senaryo 2.0.20 madde 9 — kullanıcı (03.10.2026): "001 dolu ama yedek klasöründe 002 dolu yedeklemiş"; karar: "her
// şirketin yedeği kendi isminde klasör açılıp buna girmeli". Arayüzden, sıfırdan: iki şirket farklı veriyle → Yönetim →
// Yedekler: açıklama satırı, Şimdi Yedek Al (Tüm Şirketler / Yalnız), Şirket kolonu, diskte klasör ve içerik sayımı;
// 002'yi Geri Yükle (sayılar döner); yanlış şirketin yedeği reddedilir; Yönetim → Şirketler: Veri ve Yedek Klasörleri;
// ad değişince klasör de değişir.
// Çalıştırma: node --disable-warning=ExperimentalWarning test/e2e/senaryo-220-yedek.mjs
import fs, { copyFileSync, existsSync, mkdtempSync, readdirSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { DatabaseSync } from "node:sqlite";
import { fileURLToPath } from "node:url";
import { chromium } from "playwright";
import { createApp } from "../../server/app.mjs";
import { titleCase } from "../../server/lib/text-case.mjs";

const OUT = path.join(path.dirname(fileURLToPath(import.meta.url)), "artifacts", "senaryo-220-yedek");
fs.rmSync(OUT, { recursive: true, force: true });
fs.mkdirSync(OUT, { recursive: true });
const PASS = "Prova-Admin-2026!";
const root = mkdtempSync(path.join(tmpdir(), "destekofis-220-"));
const backupRoot = path.join(root, "backups");
const app = createApp({ dataDir: path.join(root, "data"), backupDir: backupRoot, logLevel: "warn", scheduleBackups: false, env: { HUKUK_ADMIN_PASSWORD: PASS, HUKUK_DATASET_AUTOSYNC: "0" }, license: { enforce: false, machineId: "a1b2c3d4e5f60718293a4b5c6d7e8f95" } });
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
const shot = async name => {
  shotNo += 1;
  // Pencere açılış geçişi bitmeden çekilen görüntü yarı saydam çıkar (kanıt görüntüsü için bekle).
  await page.evaluate(() =>
    Promise.all(
      document
        .getAnimations()
        .filter(item => Number.isFinite(item.effect?.getComputedTiming().endTime))
        .map(item => item.finished.catch(() => null)),
    ),
  );
  await page.screenshot({ path: path.join(OUT, `${String(shotNo).padStart(2, "0")}-${name}.png`), fullPage: true });
};
const modal = ".hof-modal-backdrop.is-visible";
// 2.0.21: sayfanın istekleri sayfanın şirketine gider; test "şirketi seç, sonra işlem yap" derken o şirketi açıkça ekler.
let focus = "";
const scopedUrl = url => (focus && url.startsWith("/api/") && !url.startsWith("/api/companies") && !url.startsWith("/api/admin/backups") ? `${url}${url.includes("?") ? "&" : "?"}hofCompany=${focus}` : url);
const api = async (url, body, method) => {
  const result = await rawApi(scopedUrl(url), body, method);
  if (url === "/api/companies/select" && result.status === 200) focus = body.id;
  if (url === "/api/companies" && body?.select && result.status === 200) focus = result.data.company.id;
  return result;
};
const rawApi = (url, body, method) =>
  page.evaluate(
    async ({ url, body, method }) => {
      const response = await fetch(url, { method: method || (body ? "POST" : "GET"), headers: body ? { "content-type": "application/json" } : {}, body: body ? JSON.stringify(body) : undefined });
      const json = await response.json();
      return { status: response.status, data: json.ok ? json.data : json };
    },
    { url, body, method },
  );
const toasts = () => page.evaluate(() => [...document.querySelectorAll(".hof-toast")].map(node => node.textContent).join(" | "));
const waitToast = pattern => page.waitForFunction(re => new RegExp(re).test([...document.querySelectorAll(".hof-toast")].map(node => node.textContent).join(" ")), pattern.source, { timeout: 20000 }).then(() => true, () => false);
const files = dir => (existsSync(dir) ? readdirSync(dir).filter(name => name.endsWith(".sqlite")) : []);
const countAccounts = file => {
  const db = new DatabaseSync(file, { readOnly: true });
  try {
    return db.prepare("SELECT COUNT(*) AS n FROM accounts WHERE deleted_at IS NULL").get().n;
  } finally {
    db.close();
  }
};
const accountsIn = async companyId => {
  await api("/api/companies/select", { id: companyId });
  return (await api("/api/workspace/accounts")).data.accounts.length;
};
const backupRows = () => page.$$eval("#adm-backups tr[data-backup]", rows => rows.map(row => [...row.cells].map(cell => cell.innerText.trim())));

try {
  console.log("\n■ Kurulum: yönetici girer; 001'de 3, 002'de 2 cari");
  await page.goto(`${BASE}/`);
  await page.fill("#hof-auth input[name=username]", "admin");
  await page.fill("#hof-auth input[name=password]", PASS);
  await Promise.all([page.waitForEvent("load"), page.click('#hof-auth button[type="submit"]')]);
  for (const name of ["Ali Veli", "Ayşe Kaya", "Mehmet Demir"]) await api("/api/workspace/accounts", { name, type: "customer" });
  const second = (await api("/api/companies", { name: "Şirket 2", select: true })).data.company;
  for (const name of ["Zeynep Ak", "Can Er"]) await api("/api/workspace/accounts", { name, type: "customer" });
  ok((await accountsIn("sirket-001")) === 3 && (await accountsIn(second.id)) === 2, "001: 3 cari, 002: 2 cari");
  await api("/api/companies/select", { id: "sirket-001" });

  console.log("\n■ Yönetim → Yedekler: açıklama satırı ve Şimdi Yedek Al (Tüm Şirketler)");
  await page.goto(`${BASE}/admin.html#backups`, { waitUntil: "load" });
  await page.waitForFunction(() => /Her şirketin yedeği kendi klasöründe/.test(document.querySelector("#adm-backup-where")?.textContent || ""), null, { timeout: 15000 });
  const where = await page.textContent("#adm-backup-where");
  ok(/backups.001 - Şirket 1/.test(where) && /backups.002 - Şirket 2/.test(where), `açıklama: ${where.trim()}`);
  const heads = await page.$$eval('.adm-panel[data-panel="backups"] thead th', nodes => nodes.map(node => node.textContent.trim()));
  ok(heads.join("|") === "Şirket|Yedek Dosyası|Tarih|Boyut|İşlemler" && heads.every(head => titleCase(head) === head), `kolonlar: ${heads.join(", ")}`);
  await page.click("#adm-backup-now");
  await page.waitForSelector(`${modal} select[name="scope"]`);
  const options = await page.$$eval(`${modal} select[name="scope"] option`, nodes => nodes.map(node => [node.value, node.textContent.trim(), node.selected]));
  ok(JSON.stringify(options) === JSON.stringify([["all", "Tüm Şirketler (2)", true], ["one", "Yalnız 001 · Şirket 1", false]]), `Yedek Al seçenekleri: ${options.map(item => item[1]).join(" / ")} (varsayılan Tüm Şirketler)`);
  await shot("yedek-al-penceresi");
  await page.click(`${modal} form [type="submit"]`);
  ok(await waitToast(/2 şirketin yedeği alındı/), `bildirim: ${await toasts()}`);
  await page.waitForFunction(() => document.querySelectorAll("#adm-backups tr[data-backup]").length === 2, null, { timeout: 15000 });
  let rows = await backupRows();
  ok(rows.map(row => row[0]).sort().join("|") === "001 · Şirket 1|002 · Şirket 2", `Şirket kolonu: ${rows.map(row => row[0]).join(", ")}`);
  ok(rows.every(row => /^destekofis-00[12]-.*-manuel\.sqlite$/.test(row[1]) && row[1].startsWith(`destekofis-${row[0].slice(0, 3)}-`)), "dosya adında kendi şirketinin kodu");
  const one = path.join(backupRoot, "001 - Şirket 1");
  const two = path.join(backupRoot, "002 - Şirket 2");
  ok(files(one).length === 1 && files(two).length === 1 && files(backupRoot).length === 0, `diskte: ${path.basename(one)} (${files(one).length}), ${path.basename(two)} (${files(two).length}), kökte ${files(backupRoot).length}`);
  ok(countAccounts(path.join(one, files(one)[0])) === 3 && countAccounts(path.join(two, files(two)[0])) === 2, "yedeklerin içi: 001 → 3 cari, 002 → 2 cari (karışma yok)");
  await shot("yedekler-iki-sirket");

  console.log("\n■ Şimdi Yedek Al → Yalnız 001 · Şirket 1");
  await page.click("#adm-backup-now");
  await page.waitForSelector(`${modal} select[name="scope"]`);
  await page.selectOption(`${modal} select[name="scope"]`, "one");
  await page.click(`${modal} form [type="submit"]`);
  await page.waitForFunction(() => document.querySelectorAll("#adm-backups tr[data-backup]").length === 3, null, { timeout: 15000 });
  ok(files(one).length === 2 && files(two).length === 1, `yalnız 001 yedeklendi (001: ${files(one).length}, 002: ${files(two).length})`);

  console.log("\n■ 002 yedekten geri yüklenir (onay kod + parola); 001 etkilenmez");
  await api("/api/companies/select", { id: second.id });
  await api("/api/workspace/accounts", { name: "Yedekten Sonra", type: "customer" });
  ok((await accountsIn(second.id)) === 3, "002'ye yedekten sonra bir cari eklendi (3)");
  await api("/api/companies/select", { id: "sirket-001" });
  await page.reload({ waitUntil: "load" });
  await page.waitForSelector("#adm-backups tr[data-backup]");
  rows = await backupRows();
  const index002 = rows.findIndex(row => row[0] === "002 · Şirket 2");
  await page.click(`#adm-backups tr[data-backup="${index002}"] [data-backup-restore]`);
  await page.waitForSelector(`${modal} input[name="confirm"]`);
  const intro = await page.textContent(`${modal} .hof-modal-text`);
  ok(/yalnız kendi şirketine \(002 · Şirket 2\)/.test(intro), "pencere: yedek yalnız kendi şirketine yüklenir");
  await shot("geri-yukle-penceresi");
  await page.fill(`${modal} input[name="confirm"]`, "002");
  await page.fill(`${modal} input[name="password"]`, PASS);
  await page.click(`${modal} form [type="submit"]`);
  ok(await waitToast(/yedekten geri yüklendi/), `bildirim: ${(await toasts()).split(" | ").at(-1)}`);
  ok((await accountsIn(second.id)) === 2, "002 yedekteki hâline döndü (2 cari)");
  ok((await accountsIn("sirket-001")) === 3, "001 aynı (3 cari)");
  ok(files(two).some(name => /geri-yukleme-oncesi-002/.test(name)), "geri yükleme öncesi yedek 002'nin klasöründe");

  console.log("\n■ Yanlış şirket: 002'nin yedeği elle 001'in klasörüne kopyalanmış → reddedilir");
  const stray = files(two).find(name => /-manuel\.sqlite$/.test(name));
  copyFileSync(path.join(two, stray), path.join(one, stray));
  await page.reload({ waitUntil: "load" });
  await page.waitForSelector("#adm-backups tr[data-backup]");
  rows = await backupRows();
  const strayIndex = rows.findIndex(row => row[0] === "001 · Şirket 1" && row[1] === stray);
  await page.click(`#adm-backups tr[data-backup="${strayIndex}"] [data-backup-restore]`);
  await page.waitForSelector(`${modal} input[name="confirm"]`);
  await page.fill(`${modal} input[name="confirm"]`, "001");
  await page.fill(`${modal} input[name="password"]`, PASS);
  await page.click(`${modal} form [type="submit"]`);
  await page.waitForFunction(() => /şirketine geri yüklenemez/.test(document.querySelector(".hof-modal-backdrop.is-visible .hof-form-error")?.textContent || ""), null, { timeout: 15000 }).catch(() => null);
  const refusal = await page.textContent(`${modal} .hof-form-error`).catch(() => "");
  ok(/“002 · Şirket 2” şirketine ait; “001 · Şirket 1” şirketine geri yüklenemez/.test(refusal), `ret: ${refusal}`);
  await shot("yanlis-sirket-reddi");
  await page.keyboard.press("Escape");
  rmSync(path.join(one, stray));
  ok(!existsSync(path.join(root, "data", "geri-yukleme.json")) && (await accountsIn("sirket-001")) === 3, "001'e hiçbir şey yüklenmedi");

  console.log("\n■ Yönetim → Şirketler: Veri ve Yedek Klasörleri; ad değişince klasör de değişir");
  await page.click('.adm-tabs [data-tab="companies"]');
  await page.waitForSelector("#adm-company-storage tr td code", { timeout: 15000 });
  const storage = await page.$$eval("#adm-company-storage tr", list => list.map(row => [...row.cells].map(cell => cell.innerText.trim())));
  ok(storage.length === 2, `iki şirket satırı (${storage.length})`);
  ok(/destekofis\.sqlite$/.test(storage[0][1]) && /sirketler.002.destekofis\.sqlite$/.test(storage[1][1]), `veri dosyaları: ${storage.map(row => row[1]).join(" · ")}`);
  ok(storage[0][3] === "3" && storage[1][3] === "2", `cari sayıları: ${storage.map(row => row[3]).join(", ")}`);
  ok(/001 - Şirket 1$/.test(storage[0][6]) && /002 - Şirket 2$/.test(storage[1][6]) && storage.every(row => /\d/.test(row[5])), "son yedek ve yedek klasörü yazıyor");
  const storageHeads = await page.$$eval(".adm-company-storage thead th", nodes => nodes.map(node => node.textContent.trim()));
  ok(storageHeads.every(head => titleCase(head) === head), `kolonlar: ${storageHeads.join(", ")}`);
  await shot("sirketler-veri-ve-yedek");
  await page.click(`#adm-companies tr[data-company="${second.id}"] [data-c-edit]`);
  await page.waitForSelector(`${modal} input[name="name"]`);
  await page.fill(`${modal} input[name="name"]`, "Gayri Resmi: Ş/Ç");
  await page.click(`${modal} form [type="submit"]`);
  await waitToast(/Şirket bilgisi güncellendi/);
  const renamed = path.join(backupRoot, "002 - Gayri Resmi Ş Ç");
  ok(existsSync(renamed) && !existsSync(two) && files(renamed).length === 2, `klasör yeniden adlandırıldı: ${path.basename(renamed)} (${files(renamed).length} yedek korundu: manuel + geri yükleme öncesi)`);
  await page.click('.adm-tabs [data-tab="backups"]');
  await page.waitForFunction(() => /002 - Gayri Resmi Ş Ç/.test(document.querySelector("#adm-backup-where")?.textContent || ""), null, { timeout: 15000 }).catch(() => null);
  ok(/002 - Gayri Resmi Ş Ç/.test(await page.textContent("#adm-backup-where")), "açıklama satırı yeni klasörü gösterir");
  await shot("yedekler-ad-degisti");

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
console.log(`\nSenaryo 2.0.20 (yedek): ${passed} geçti, ${failed} kaldı. Ekranlar: ${path.relative(process.cwd(), OUT)}`);
process.exit(failed ? 1 : 0);
