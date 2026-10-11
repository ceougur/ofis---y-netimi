// Arayüzde çift tıklama: "Faturayı Kaydet"e ve onaydaki "Evet"e çift tıklanır; kaç fatura kesildi?
import fs from "node:fs"; import path from "node:path"; import { chromium } from "playwright";
import { HERE, PASS, STAFF_PASS, staff, startServer } from "./ortak.mjs";
const ROOT = path.join(process.env.SP, "canli"); const state = JSON.parse(fs.readFileSync(path.join(ROOT, "durum.json"), "utf8"));
const C1 = state.companies["001"];
const app = startServer(ROOT, { fresh: false }); const { port } = await app.listen(0, "127.0.0.1"); const BASE = `http://127.0.0.1:${port}`;
const admin = staff(BASE, C1); await admin.login("admin", PASS);
const count = async () => (await admin.get("/api/workspace/invoices?tab=sale")).data.tabCounts.sale;
const b = await chromium.launch(); const p = await (await b.newContext({ viewport: { width: 1440, height: 900 } })).newPage();
await p.goto(`${BASE}/`); await p.fill("#hof-auth input[name=username]", "arayuz001"); await p.fill("#hof-auth input[name=password]", STAFF_PASS);
await p.click('#hof-auth button[type="submit"]'); await p.waitForSelector("#hof-sidecard [data-action=invoices]", { timeout: 60000 });
const modal = ".hof-modal-backdrop.is-visible"; const inv = `${modal} .hof-invoices-modal`;
const results = [];
for (const [label, how] of [["Faturayı Kaydet'e çift tıklama", "issue"], ["Onay penceresinde Evet'e çift tıklama", "yes"]]) {
  await p.click("#hof-sidecard [data-action=invoices]"); await p.click(`${inv} [data-act="new"]`); await p.click(`${inv} [data-scenario="goods_sale"]`); await p.waitForSelector(`${inv} [data-lines]`);
  const acc = (await admin.get("/api/workspace/accounts?limit=1&q=C0020")).data.accounts[0];
  await p.fill(`${inv} [data-acc-query]`, acc.name); await p.waitForSelector(`${inv} .hof-acc-picker li[data-id="${acc.id}"]`); await p.dispatchEvent(`${inv} .hof-acc-picker li[data-id="${acc.id}"]`, "mousedown");
  await p.click(`${inv} [data-l="0"][data-f="name"]`); await p.keyboard.type("LED Ampul"); await p.waitForSelector(`${inv} [data-hits="0"] li[data-item]`); await p.click(`${inv} [data-hits="0"] li[data-item]`);
  await p.fill(`${inv} [data-l="0"][data-f="qty"]`, "1"); await p.fill(`${inv} [data-l="0"][data-f="unitPrice"]`, "100"); await p.waitForTimeout(800);
  const before = await count();
  if (how === "issue") { await p.dblclick(`${inv} [data-act="issue"]`); await p.waitForSelector(`${modal} [data-answer="yes"]`); await p.click(`${modal} [data-answer="yes"]`); }
  else { await p.click(`${inv} [data-act="issue"]`); await p.waitForSelector(`${modal} [data-answer="yes"]`); await p.dblclick(`${modal} [data-answer="yes"]`); }
  for (let i = 0; i < 3; i += 1) { const y = await p.waitForSelector(`${modal} [data-answer="yes"]`, { timeout: 2500 }).catch(() => null); if (!y) break; await p.click(`${modal} [data-answer="yes"]`); }
  await p.waitForSelector(`${inv} .hof-inv-pills`, { timeout: 15000 }).catch(() => null);
  await p.waitForTimeout(1500);
  const after = await count();
  results.push({ deneme: label, "kesilen fatura": after - before, ok: after - before === 1 });
  console.log(`${after - before === 1 ? "✓" : "✗ BULGU"} ${label}: kesilen fatura sayısı ${after - before} (beklenen 1)`);
  for (let i = 0; i < 6 && (await p.$(modal)); i += 1) { await p.keyboard.press("Escape"); await p.waitForTimeout(300); }
}
fs.writeFileSync(path.join(HERE, "cikti", "cift-tiklama-sonucu.json"), JSON.stringify(results, null, 1));
await b.close(); await app.close();
