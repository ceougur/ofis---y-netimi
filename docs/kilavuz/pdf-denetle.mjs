// Kullanım kılavuzu PDF'inin denetimi: sayfa sayısı, resim sayısı, Banka bölümünün PDF metninde görünmesi, kalkan anlatımların (Drive,
// "Kasa ve Banka", "bugünkü kasadan") olmaması; programın içindeki kopyanın (client/kilavuz) aynı dosya olması ve programın Yardım yolunun
// (sol menü → Kullanım Kılavuzu → /kilavuz/DestekOfis-Kullanim-Kilavuzu.pdf) bu dosyayı vermesi (gerçek sunucu + tarayıcı).
// Kullanım: node docs/kilavuz/pdf-denetle.mjs   (önce: node docs/kilavuz/pdf-uret.mjs docs/kilavuz DestekOfis-Kullanim-Kilavuzu
//           && cp docs/kilavuz/DestekOfis-Kullanim-Kilavuzu.pdf client/kilavuz/). Gerekenler: pdfinfo, pdftotext, pdfimages (poppler).
import { createHash } from "node:crypto";
import { execFileSync } from "node:child_process";
import { createRequire } from "node:module";
import { mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
const HERE = path.dirname(fileURLToPath(import.meta.url));
const R = path.resolve(HERE, "..", "..");
const { chromium } = createRequire(`${R}/`)("playwright");
const { createApp } = await import(`${R}/server/app.mjs`);
const DOC = path.join(HERE, "DestekOfis-Kullanim-Kilavuzu.pdf");
const APP = path.join(R, "client", "kilavuz", "DestekOfis-Kullanim-Kilavuzu.pdf");
const results = [];
const check = (cond, what) => { results.push(Boolean(cond)); console.log(cond ? "✓" : "✗", what); };
const sha = buffer => createHash("sha256").update(buffer).digest("hex");

const pages = Number(/Pages:\s+(\d+)/.exec(execFileSync("pdfinfo", [DOC], { encoding: "utf8" }))?.[1]);
check(pages > 0, `PDF sayfa sayısı: ${pages}`);
const text = execFileSync("pdftotext", ["-layout", DOC, "-"], { encoding: "utf8", maxBuffer: 64 << 20 }).replace(/\s+/g, " ");
const html = readFileSync(path.join(HERE, "DestekOfis-Kullanim-Kilavuzu.html"), "utf8");
const imgs = [...html.matchAll(/<img src="([^"]+)"/g)].map(m => m[1]);
const pdfImages = execFileSync("pdfimages", ["-list", DOC], { encoding: "utf8" }).split("\n").filter(line => /^\s*\d+\s+\d+\s+image/.test(line)).length;
check(pdfImages >= new Set(imgs).size, `PDF'teki resim sayısı ${pdfImages} ≥ kılavuzdaki farklı ekran ${new Set(imgs).size}`);
for (const phrase of ["8. Banka", "Kurulum Sihirbazı", "Hesabı Atanmamış Eski Hareketler", "Tarihi Gelince Atanabilir", "Seçilenleri Bu Hesaba Ata", "Kurumsal Kredi Kartı", "Kurumsal Kart", "Kart ve Kredi Borcu", "+ Kart Borcu Ödemesi", "Bankalar Arası Transfer", "Ters Kaydet", "Gerçek Banka", "Bugünkü Nakit ve Banka", "Banka Bakiye Raporu", "Alt Hesap Mizanı", "Banka ve POS", "Yine de Kaydet"]) check(text.includes(phrase), `PDF metninde: “${phrase}”`);
for (const phrase of ["Drive", "OneDrive", "Kasa ve Banka", "bugünkü kasadan", "Banka / POS"]) check(!text.includes(phrase), `PDF metninde YOK: “${phrase}”`);
const docBuf = readFileSync(DOC);
const appBuf = readFileSync(APP);
check(sha(docBuf) === sha(appBuf), `client/kilavuz kopyası aynı dosya (sha256 ${sha(appBuf)})`);

// Programın Yardım yolu: gerçek sunucu, sol menü → Kullanım Kılavuzu.
const root = mkdtempSync(path.join(tmpdir(), "kilavuz-pdf-"));
const PASS = "Kilavuz-Admin-2026";
const app = createApp({ dataDir: path.join(root, "data"), backupDir: path.join(root, "b"), logLevel: "warn", scheduleBackups: false, env: { HUKUK_ADMIN_PASSWORD: PASS, HUKUK_DATASET_AUTOSYNC: "0" }, license: { enforce: false, machineId: "7f3a91c24be05d6e8a1b2c3d4e5f6073" } });
const { port } = await app.listen(0, "127.0.0.1");
const base = `http://127.0.0.1:${port}`;
const browser = await chromium.launch();
try {
  const ctx = await browser.newContext({ locale: "tr-TR" });
  const page = await ctx.newPage();
  await page.goto(`${base}/`);
  const startLink = await page.$eval('a[href="/kilavuz/DestekOfis-Kullanim-Kilavuzu.pdf"]', node => node.textContent.trim()).catch(() => "");
  await page.waitForSelector("#hof-auth input[name=username]");
  await page.fill("#hof-auth input[name=username]", "admin");
  await page.fill("#hof-auth input[name=password]", PASS);
  await Promise.all([page.waitForEvent("load"), page.click('#hof-auth button[type="submit"]')]);
  // Veri yüklenmemişse açılış ekranındaki bağlantı; sol menü tablo yüklenince görünür.
  const start = await page.waitForSelector('#hof-start a[href="/kilavuz/DestekOfis-Kullanim-Kilavuzu.pdf"]', { timeout: 15000 }).then(() => true).catch(() => false);
  check(start || Boolean(startLink), "açılış ekranında “Resimli kullanım kılavuzunu açın” bağlantısı /kilavuz/DestekOfis-Kullanim-Kilavuzu.pdf");
  const served = await page.evaluate(async url => { const r = await fetch(url); const b = new Uint8Array(await r.arrayBuffer()); const h = await crypto.subtle.digest("SHA-256", b); return { status: r.status, type: r.headers.get("content-type"), sha: [...new Uint8Array(h)].map(x => x.toString(16).padStart(2, "0")).join("") }; }, "/kilavuz/DestekOfis-Kullanim-Kilavuzu.pdf");
  check(served.status === 200 && served.sha === sha(appBuf) && /pdf/.test(served.type || ""), `sunucunun verdiği kılavuz: ${served.status} ${served.type} sha256 ${served.sha}`);
  // Sol menüdeki "Kullanım Kılavuzu" düğmesi (tablo yüklü ekranda): window.open ile aynı adres.
  await (await page.$("#hof-start .hof-drop input[type=file]"))?.setInputFiles(path.join(HERE, "ornek", "okul-servisi.xlsx"));
  await page.waitForSelector(".hof-modal-backdrop.is-visible .hof-mapping", { timeout: 30000 }).catch(() => {});
  if (await page.$('.hof-modal-backdrop.is-visible [data-mode="replace"]')) await Promise.all([page.waitForEvent("load", { timeout: 30000 }), page.click('.hof-modal-backdrop.is-visible [data-mode="replace"]')]);
  await page.waitForSelector(".hof-analysis-result:not([hidden])", { timeout: 30000 });
  await page.click(".hof-analysis-result [data-apply]");
  await page.waitForFunction(() => !document.querySelector(".hof-modal-backdrop"), null, { timeout: 8000 });
  await page.waitForSelector('#hof-sidecard [data-action="guide"]', { timeout: 30000 });
  const label = (await page.$eval('#hof-sidecard [data-action="guide"]', node => node.textContent.replace(/\s+/g, " ").trim())).replace(/^\?\s*/, "");
  // Başsız tarayıcıda PDF sekmesi indirme gibi açılır (adres çubuğu boş kalabilir); yeni sekmenin istediği adres okunur.
  const requested = [];
  ctx.on("request", request => requested.push(request.url()));
  const [popup] = await Promise.all([ctx.waitForEvent("page", { timeout: 15000 }), page.click('#hof-sidecard [data-action="guide"]')]);
  await popup.waitForTimeout(2500).catch(() => {});
  const hit = requested.find(url => url.endsWith("/kilavuz/DestekOfis-Kullanim-Kilavuzu.pdf"));
  check(Boolean(hit), `sol menü “${label}” → yeni sekme ${hit ? hit.replace(base, "") : `(istenen: ${requested.map(url => url.replace(base, "")).join(", ") || "yok"})`}`);
} catch (error) {
  check(false, `tarayıcı adımı: ${error.message.split("\n")[0]}`);
} finally {
  await browser.close();
  await app.close();
  rmSync(root, { recursive: true, force: true });
}
const pass = results.filter(Boolean).length;
console.log(`# tests ${results.length}`);
console.log(`# pass ${pass}`);
console.log(`# fail ${results.length - pass}`);
if (pass !== results.length) process.exitCode = 1;
