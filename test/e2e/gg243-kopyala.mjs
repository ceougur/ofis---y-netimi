// Kullanıcı kararı 18.10.2026 ("evet kopyala düğmesi ekle"): 2.4.3 çekirdeğinde bildirimler tıklamayı geçiriyor (pointer-events); bildirim metni
// fareyle seçilip kopyalanamıyordu. Hata (ve uyarı) bildiriminde "Kopyala" düğmesi: TAM metin (×N sayacı hariç) panoya; "Kopyalandı" geri bildirimi;
// klavyeyle erişilir (odak + Enter), aria-label "Bildirimi Kopyala". Pano API'si yoksa (personel bilgisayarı http://<ip>:5123 — güvenli bağlam
// değil) gizli metin kutusu + execCommand("copy"); o da olmazsa metin seçili bir kutuda gösterilir. GERÇEK tarayıcıda:
//  1. Sunucunun gerçek hata iletisi (fatura carisiz) iki kez → "×2"; Kopyala (fare) → panodaki metin = ileti (×2 yok); düğme "Kopyalandı".
//  2. Bildirimin metin alanı tıklamayı geçirmeye devam eder (altındaki öğe tıklanır).
//  3. Klavye: düğmeye odak + Enter → panoya yazılır.
//  4. navigator.clipboard yok (güvenli olmayan bağlam benzetimi) → yedek yol (execCommand) metni kopyalar.
//  5. execCommand da başarısız → metin seçili kutuda görünür.
//  6. Başarı bildiriminde Kopyala yok.
// Eski kodda (52bacd3) kırmızıdır (düğme yok); DEPO=<eski kopya> ile koşulur. Çıkış: "N geçti, M kaldı".
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { chromium } from "playwright";

const ROOT = process.env.DEPO ? path.resolve(process.env.DEPO) : path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..", "..");
const { createApp } = await import(pathToFileURL(path.join(ROOT, "server", "app.mjs")).href);
const { createClient, installPageClock } = await import(pathToFileURL(path.join(ROOT, "test", "helpers.mjs")).href);

const PASS = "Prova-Admin-2026!";
const NOW = "2026-10-08T12:00:00+03:00";
const root = mkdtempSync(path.join(tmpdir(), "destekofis-gg243-kopyala-"));
const app = createApp({ dataDir: path.join(root, "data"), backupDir: path.join(root, "backups"), logLevel: "warn", scheduleBackups: false, now: NOW, env: { HUKUK_ADMIN_PASSWORD: PASS, HUKUK_DATASET_AUTOSYNC: "0", HUKUK_LICENSE_URL: "http://127.0.0.1:9" }, license: { enforce: false, machineId: "a1b2c3d4e5f60718293a4b5c6d7e8f46" }, startLicenseTimers: false });
const { port } = await app.listen(0, "127.0.0.1");
const BASE = `http://127.0.0.1:${port}`;
const api = createClient(BASE);
await api.login("admin", PASS);
await api.post("/api/workspace/bank/setup/dismiss", {});

const browser = await chromium.launch();
const context = await browser.newContext({ viewport: { width: 1360, height: 900 }, locale: "tr-TR" });
await context.grantPermissions(["clipboard-read", "clipboard-write"], { origin: BASE });
await context.addInitScript(() => {
  document.addEventListener("DOMContentLoaded", () => document.head.appendChild(Object.assign(document.createElement("style"), { textContent: "#hof-license-bar,.hof-license-notice{display:none!important}" })));
  // Yedek yolda kopyalanan metin "copy" olayından da okunur (pano okunamazsa).
  window.__copied = [];
  document.addEventListener("copy", event => {
    const target = event.target;
    const text = target && "value" in target && typeof target.selectionStart === "number" ? target.value.slice(target.selectionStart, target.selectionEnd) : String(document.getSelection() || "");
    window.__copied.push(text);
  }, true);
  window.__realClipboard = navigator.clipboard;
});
const page = await context.newPage();
page.setDefaultTimeout(15000);
const errors = [];
page.on("pageerror", error => errors.push(error.message));
let passed = 0;
let failed = 0;
const ok = (cond, what) => {
  if (cond) passed += 1;
  else failed += 1;
  console.log(`  ${cond ? "✓" : "✗"} ${what}`);
  return Boolean(cond);
};
const sleep = ms => new Promise(resolve => setTimeout(resolve, ms));
const readClipboard = () => page.evaluate(() => window.__realClipboard.readText());
const writeClipboard = text => page.evaluate(value => window.__realClipboard.writeText(value), text);
// Gerçek sunucu hatası (fatura carisiz) ekranın kendi hata bildirimiyle gösterilir.
const raiseError = () => page.evaluate(async () => {
  try {
    await window.HOF.api("/api/workspace/invoices", { method: "POST", body: { scenario: "service_sale", lines: [{ name: "X", qty: 1, unitPrice: 1, vatRate: 20 }] } });
    return "";
  } catch (error) {
    window.HOF.toastError(error);
    return error.message;
  }
});
const toast = () => page.locator(".hof-toast.hof-toast-error").last();

try {
  await installPageClock(page, app.config.now);
  await page.goto(`${BASE}/`);
  await page.fill("#hof-auth input[name=username]", "admin");
  await page.fill("#hof-auth input[name=password]", PASS);
  await Promise.all([page.waitForEvent("load"), page.click('#hof-auth button[type="submit"]')]);
  await page.waitForSelector("#hof-sidecard", { timeout: 60000 });

  console.log("1) hata bildirimi iki kez (×2) → Kopyala (fare)");
  const message = await raiseError();
  ok(message.length > 0, `ön koşul: sunucu hata iletisi ("${message}")`);
  await raiseError();
  await toast().waitFor();
  ok(/×2/.test(await toast().innerText()), "ön koşul: aynı bildirim ×2");
  const copy = toast().locator(".hof-toast-copy");
  ok((await copy.count()) === 1, "hata bildiriminde Kopyala düğmesi var");
  ok((await copy.getAttribute("aria-label").catch(() => "")) === "Bildirimi Kopyala", "aria-label Bildirimi Kopyala");
  ok(((await copy.innerText().catch(() => "")) || "").trim() === "Kopyala", "düğme adı Kopyala");
  await writeClipboard("eski içerik");
  await copy.click({ timeout: 3000 }).catch(() => null);
  await sleep(300);
  ok((await readClipboard()) === message, `panodaki metin = bildirim metni (${JSON.stringify(await readClipboard())})`);
  ok(((await copy.innerText().catch(() => "")) || "").trim() === "Kopyalandı", "geri bildirim Kopyalandı");

  console.log("2) bildirim metni tıklamayı geçirmeye devam eder");
  const passThrough = await toast().locator(".hof-toast-text").evaluate(node => {
    const box = node.getBoundingClientRect();
    const hit = document.elementFromPoint(box.left + box.width / 2, box.top + box.height / 2);
    return !node.contains(hit) && !hit?.closest?.(".hof-toast");
  });
  ok(passThrough, "metin alanı tıklamayı geçirir");

  console.log("3) klavye: odak + Enter");
  await writeClipboard("eski içerik");
  await page.evaluate(() => document.querySelector(".hof-toast.hof-toast-error .hof-toast-copy")?.focus());
  ok(await page.evaluate(() => document.activeElement?.classList.contains("hof-toast-copy")), "düğme odak alabilir");
  await page.keyboard.press("Enter");
  await sleep(300);
  ok((await readClipboard()) === message, "Enter ile panoya yazıldı");

  // 23.10.2026 (ekran gezintisi, aday 14): uzun bildirimde "e-Belge" kısa çizgiden bölünüyordu ("belgenin e-" / "Belge durumu"). Dar genişlikler
  // taranır; her "e-X" adının satır kutuları (Range.getClientRects) TEK satırda olmalı. Metin (textContent) ve Kopyala'nın panoya yazdığı metin
  // sunucu metniyle bayt bayt aynı; görünmez karakter (U+00AD, U+200B, U+2011, U+2060, U+FEFF) eklenmez. Eski kodda kırmızı: bölünen genişlik > 0.
  console.log("3b) e-Belge / e-Fatura / e-Arşiv / e-SMM / e-Posta kısa çizgiden satıra bölünmez");
  const { readFileSync } = await import("node:fs");
  const routeSource = readFileSync(path.join(ROOT, "server", "routes", "invoices.mjs"), "utf8");
  const serverText = /const STATUS_STALE_TEXT = "([^"]+)"/.exec(routeSource)?.[1] || "";
  ok(/e-Belge/.test(serverText), `ön koşul: sunucu metni okundu (${serverText.length} karakter)`);
  const mixed = "E-Fatura mükellefi olmayan alıcıya e-Arşiv kesilir; serbest meslekte e-SMM düzenlenir, belge e-Posta ile gönderilir ve e-Belge'nin durumu kartta görünür.";
  for (const [label, text] of [["sunucu metni", serverText], ["karma metin", mixed]]) {
    await page.evaluate(() => document.querySelectorAll(".hof-toast").forEach(node => node.remove()));
    await page.evaluate(value => window.HOF.toast(value, { type: "error" }), text);
    await toast().waitFor();
    const result = await toast().locator(".hof-toast-text").evaluate(node => {
      const words = [];
      const full = node.textContent;
      for (const match of full.matchAll(/(^|[^\p{L}\p{N}])([eE]-\p{L}+)/gu)) words.push({ start: match.index + match[1].length, word: match[2] });
      // Metin düğümlerinde [start, end) aralığını kuran Range (ad birden çok düğüme yayılabilir).
      const rangeFor = (start, end) => {
        const walker = document.createTreeWalker(node, NodeFilter.SHOW_TEXT);
        const range = document.createRange();
        let offset = 0;
        let begun = false;
        for (let current = walker.nextNode(); current; current = walker.nextNode()) {
          const length = current.data.length;
          if (!begun && start < offset + length) {
            range.setStart(current, start - offset);
            begun = true;
          }
          if (begun && end <= offset + length) {
            range.setEnd(current, end - offset);
            return range;
          }
          offset += length;
        }
        return null;
      };
      const lines = rects => new Set([...rects].filter(rect => rect.width > 0).map(rect => Math.round(rect.top))).size;
      const broken = [];
      let multiLine = 0;
      const widths = [];
      for (let width = 150; width <= 460; width += 2) widths.push(width);
      for (const width of widths) {
        node.style.flex = `0 0 ${width}px`;
        node.style.width = `${width}px`;
        const all = document.createRange();
        all.selectNodeContents(node);
        if (lines(all.getClientRects()) > 1) multiLine += 1;
        for (const { start, word } of words) {
          const range = rangeFor(start, start + word.length);
          if (range && lines(range.getClientRects()) > 1) broken.push(`${width}px:${word}`);
        }
      }
      node.style.flex = "";
      node.style.width = "";
      return { text: full, words: words.map(item => item.word), widths: widths.length, multiLine, broken };
    });
    ok(result.words.length >= (label === "karma metin" ? 5 : 1), `${label}: e- adları bulundu (${result.words.join(", ")})`);
    ok(result.multiLine >= result.widths / 2, `${label}: ön koşul — metin dar genişlikte birden çok satır (${result.multiLine}/${result.widths} genişlik)`);
    ok(result.broken.length === 0, `${label}: hiçbir genişlikte e- adı satıra bölünmedi (${result.broken.length} bölünme${result.broken.length ? `: ${result.broken.slice(0, 6).join(" ")}` : ""})`);
    ok(result.text === text, `${label}: bildirim metni (textContent) sunucu metniyle aynı`);
    ok(!/[­​‑⁠﻿]/.test(result.text), `${label}: görünmez karakter yok`);
    await writeClipboard("eski içerik");
    await toast().locator(".hof-toast-copy").click({ timeout: 3000 }).catch(() => null);
    await sleep(300);
    const board = await readClipboard();
    ok(board === text && Buffer.from(board, "utf8").equals(Buffer.from(text, "utf8")), `${label}: Kopyala panoya bayt bayt aynı metni yazdı`);
  }

  console.log("4) navigator.clipboard yok (http://<ip> benzetimi) → yedek yol");
  await page.evaluate(() => {
    Object.defineProperty(navigator, "clipboard", { configurable: true, get: () => undefined });
    window.__copied.length = 0;
  });
  await writeClipboard("eski içerik");
  await page.evaluate(() => document.querySelectorAll(".hof-toast").forEach(node => node.remove()));
  await raiseError();
  await toast().locator(".hof-toast-copy").click({ timeout: 3000 }).catch(() => null);
  await sleep(300);
  const copied = await page.evaluate(() => window.__copied.slice());
  const board = await readClipboard();
  ok(copied.includes(message) || board === message, `yedek yol metni kopyaladı (olay: ${JSON.stringify(copied)}, pano: ${JSON.stringify(board)})`);
  ok(((await toast().locator(".hof-toast-copy").innerText().catch(() => "")) || "").trim() === "Kopyalandı", "yedek yolda da Kopyalandı");

  console.log("5) execCommand da olmazsa metin seçili kutuda");
  await page.evaluate(() => {
    document.execCommand = () => false;
    document.querySelectorAll(".hof-toast").forEach(node => node.remove());
  });
  await raiseError();
  await toast().locator(".hof-toast-copy").click({ timeout: 3000 }).catch(() => null);
  await sleep(300);
  const box = await page.evaluate(() => {
    const area = document.querySelector(".hof-toast-error .hof-toast-copybox");
    return area ? { value: area.value, selected: area.value.slice(area.selectionStart, area.selectionEnd), focused: document.activeElement === area } : null;
  });
  ok(box && box.value === message && box.selected === message && box.focused, `metin seçili kutuda (${JSON.stringify(box)})`);

  console.log("6) başarı bildiriminde Kopyala yok");
  await page.evaluate(() => window.HOF.toast("Kaydedildi.", { type: "success" }));
  await sleep(200);
  ok((await page.locator(".hof-toast.hof-toast-success .hof-toast-copy").count()) === 0, "başarı bildiriminde düğme yok");
} catch (error) {
  failed += 1;
  console.log(`✗ beklenmeyen hata: ${error.stack || error.message}`);
} finally {
  ok(errors.length === 0, `sayfa hatası yok${errors.length ? `: ${errors.slice(0, 5).join(" | ")}` : ""}`);
  console.log(`\n${failed ? "✗" : "✓"} gg243-kopyala: ${passed} geçti, ${failed} kaldı`);
  await browser.close();
  await app.close();
  rmSync(root, { recursive: true, force: true });
  process.exitCode = failed ? 1 : 0;
}
