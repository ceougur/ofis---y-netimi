// Ekran gecikmesi (insanın hissettiği): başka personel saniyede R kayıt yazarken açık Cari penceresinde
// (a) tuşa basma → harfin kutuda görünmesi süresi, (b) 10 sn'de sayfanın donduğu toplam süre (uzun görevler).
import fs from "node:fs"; import path from "node:path"; import { chromium } from "playwright";
import { HERE, STAFF_PASS, staff, startServer } from "./ortak.mjs";
const ROOT = path.join(process.env.SP, "canli"); const state = JSON.parse(fs.readFileSync(path.join(ROOT, "durum.json"), "utf8"));
const C1 = state.companies["001"];
const app = startServer(ROOT, { fresh: false }); const { port } = await app.listen(0, "127.0.0.1"); const BASE = `http://127.0.0.1:${port}`;
const b = await chromium.launch(); const p = await (await b.newContext({ viewport: { width: 1440, height: 900 } })).newPage();
await p.goto(`${BASE}/`); await p.fill("#hof-auth input[name=username]", "arayuz001"); await p.fill("#hof-auth input[name=password]", STAFF_PASS);
await p.click('#hof-auth button[type="submit"]'); await p.waitForSelector("#hof-sidecard [data-action=accounts]", { timeout: 60000 }); await p.waitForTimeout(2000);
await p.click("#hof-sidecard [data-action=accounts]"); await p.waitForSelector(".hof-modal-backdrop.is-visible input[data-filter=q]");
const w = staff(BASE, C1); await w.login("alis001", STAFF_PASS);
const accs = (await w.get("/api/workspace/accounts?limit=50")).data.accounts;
const out = [];
for (const rate of [0, 1, 5]) {
  let alive = true; let n = 0;
  const noise = (async () => { while (alive && rate) { const a = accs[n % accs.length]; n += 1; await w.put(`/api/workspace/accounts/${a.id}`, { name: a.name, type: a.type, refNo: a.refNo, note: `gecikme ${n}` }); await new Promise(r => setTimeout(r, 1000 / rate)); } })();
  await new Promise(r => setTimeout(r, 2000));
  const freeze = await p.evaluate(async () => { let total = 0; const obs = new PerformanceObserver(list => { for (const e of list.getEntries()) total += e.duration; }); obs.observe({ type: "longtask", buffered: false }); await new Promise(r => setTimeout(r, 10000)); obs.disconnect(); return Math.round(total); });
  const lags = [];
  for (const ch of "C0123") {
    await p.evaluate(() => { const i = document.querySelector(".hof-modal-backdrop.is-visible input[data-filter=q]"); i?.focus(); window.__k = performance.now(); window.__len = (i?.value || "").length; });
    await p.keyboard.press(ch === "C" ? "Shift+KeyC" : `Digit${ch}`);
    const ms = await p.evaluate(async () => { const t = window.__k; const want = window.__len + 1; while (performance.now() - t < 20000) { const i = document.querySelector(".hof-modal-backdrop.is-visible input[data-filter=q]"); if ((i?.value || "").length >= want) return Math.round(performance.now() - t); await new Promise(r => setTimeout(r, 10)); } return -1; });
    lags.push(ms);
  }
  const value = await p.$eval(".hof-modal-backdrop.is-visible input[data-filter=q]", i => i.value).catch(() => "?");
  await p.screenshot({ path: path.join(HERE, "cikti", "ekran", `gecikme-${rate}.png`) });
  await p.evaluate(() => { const i = document.querySelector(".hof-modal-backdrop.is-visible input[data-filter=q]"); if (i) { i.value = ""; i.dispatchEvent(new Event("input", { bubbles: true })); } });
  alive = false; await noise;
  const row = { "başka kayıt/sn": rate, "arka planda yazılan": n, "10 sn'de donma (ms)": freeze, "tuş → harf (ms)": lags.join(" / "), "kutuda": value };
  out.push(row); console.log(JSON.stringify(row));
  await new Promise(r => setTimeout(r, 3000));
}
fs.writeFileSync(path.join(HERE, "cikti", "ekran-gecikmesi.json"), JSON.stringify(out, null, 1));
await b.close(); await app.close();
