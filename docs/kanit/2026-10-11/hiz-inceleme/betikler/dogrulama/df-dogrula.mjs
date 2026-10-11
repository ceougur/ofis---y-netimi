// Bağımsız doğrulama: Banka → Hareketler "Daha Fazla Göster" yarışları. Ürün kodu değişmez.
// Kip B: imleçli (Daha Fazla) yanıtı sabit GECİKMEYLE (tutma değil) geciktir; hemen başka oturum yazar → arka plan yenilemesi.
// Kip Y: bütün /movements yanıtlarına eşit gecikme (yüklü sunucu benzetimi), yazım ile Daha Fazla arasında rastgele aralık.
// Kip C: + Masraf kaydı → /summary yanıtı gecikmeli; form Esc ile kapanır, Daha Fazla tıklanır.
import { randomUUID } from "node:crypto";
import { writeFileSync } from "node:fs";
import path from "node:path";
import { pathToFileURL } from "node:url";
const ROOT = process.env.DEPO || "/home/user/ofis---y-netimi";
const TUR = Number(process.env.TUR || 4);
const { chromium } = await import(pathToFileURL(path.join(ROOT, "node_modules", "playwright", "index.mjs")).href);
const { startTestServer } = await import(pathToFileURL(path.join(ROOT, "test", "helpers.mjs")).href);
const PASS = "Dogrula-Admin-2026!";
const srv = await startTestServer({ adminPassword: PASS });
const w = srv.client();
const ok = async (p, l) => { const r = await p; if (r.status !== 200) throw new Error(`${l} ${r.status} ${JSON.stringify(r.data).slice(0, 300)}`); return r.data?.data ?? r.data; };
await ok(w.login("admin", PASS), "login");
const B = "/api/workspace/bank";
const d = new Date(); const TODAY = new Date(d - d.getTimezoneOffset() * 60000).toISOString().slice(0, 10);
const acc = await ok(w.post(`${B}/accounts`, { bankName: "Halkbank", name: "Vadesiz", kind: "demand", opening: { date: `${TODAY.slice(0, 8)}01`, amount: "500.000", confirmed: true } }), "hesap");
let k = 0;
const fee = (desc, amt) => ok(w.post(`${B}/vouchers`, { type: "fee", accountId: acc.id, date: TODAY, amount: amt || `${20 + (k += 1)}`, feeType: "eft", tax: "bsmv_incl", description: desc, similarOk: true, requestId: randomUUID() }), "fiş");
for (let i = 0; i < 140; i += 1) await fee(`ön ${i}`);
const browser = await chromium.launch();
const page = await (await browser.newContext({ viewport: { width: 1440, height: 900 }, locale: "tr-TR" })).newPage();
page.on("dialog", x => x.accept());
const errs = []; page.on("pageerror", e => errs.push(String(e)));
let delayCursor = 0, delayAll = 0, delaySummary = 0;
await page.route("**/api/workspace/bank/movements?*", async route => {
  const cur = new URL(route.request().url()).searchParams.has("cursor");
  const ms = (cur ? delayCursor : 0) + delayAll;
  if (!ms) return route.continue();
  const resp = await route.fetch();
  await new Promise(r => setTimeout(r, ms));
  return route.fulfill({ response: resp });
});
await page.route("**/api/workspace/bank/summary*", async route => {
  if (!delaySummary) return route.continue();
  const resp = await route.fetch();
  await new Promise(r => setTimeout(r, delaySummary));
  return route.fulfill({ response: resp });
});
await page.goto(srv.base);
await page.fill("#hof-auth input[name=username]", "admin");
await page.fill("#hof-auth input[name=password]", PASS);
await page.click('#hof-auth button[type="submit"]');
await page.waitForSelector('#hof-sidecard [data-action="bank"]', { timeout: 60000 });
const WIN = ".hof-bank-modal"; const ROWS = `${WIN} .hof-bank-moves tbody tr[data-event]`;
const openMoves = async () => {
  await page.click('#hof-sidecard [data-action="bank"]');
  await page.waitForSelector(`${WIN} [data-bank] .hof-bank-tabs`, { timeout: 60000 });
  await page.click(`${WIN} .hof-bank-tabs [data-tab="movements"]`);
  await page.waitForSelector(ROWS, { timeout: 60000 });
};
await openMoves();
const nos = () => page.$$eval(ROWS, l => l.map(r => r.dataset.no));
const reset = async () => {
  // Hareketler sekmesine yeniden gir → kullanıcı yüklemesi, 50 satır
  await page.click(`${WIN} .hof-bank-tabs [data-tab="accounts"]`).catch(() => null);
  await page.waitForTimeout(300);
  await page.click(`${WIN} .hof-bank-tabs [data-tab="movements"]`);
  await page.waitForFunction(s => document.querySelectorAll(s).length === 50, ROWS, { timeout: 15000 });
  await page.waitForTimeout(2500);
};
const truth = async n => (await ok(w.get(`${B}/movements?limit=${n}`), "gerçek")).rows.map(r => r.no);
const cmp = (s, t) => ({ eksik: t.filter(x => !s.includes(x)), fazla: s.filter(x => !t.includes(x)), cift: s.filter((x, i) => s.indexOf(x) !== i) });
const out = { B: [], Y: [], C: [], K: [] };
const MODES = (process.env.KIP || "B,Y,C,K").split(",");
for (let n = 1; n <= TUR; n += 1) {
  if (MODES.includes("B")) {
    await reset();
    delayCursor = 2500;
    await page.click(`${WIN} [data-act="mv-more"]`);
    await page.waitForTimeout(100);
    await fee(`B arka ${n}`);
    await page.waitForTimeout(4500);
    delayCursor = 0;
    const s = await nos(); const c = cmp(s, await truth(s.length));
    // olay olmadan 6 sn bekle: eksik kalıcı mı?
    await page.waitForTimeout(6000);
    const s2 = await nos(); const c2 = cmp(s2, await truth(s2.length));
    out.B.push({ n, satir: s.length, ...c, alti_sn_sonra: { satir: s2.length, ...c2 } });
    console.log("B", n, s.length, JSON.stringify(c), "6sn sonra", s2.length, JSON.stringify(c2.eksik));
  }
  if (MODES.includes("Y")) {
    await reset();
    delayAll = 700;
    const gap = 200 + Math.floor(Math.random() * 600);
    await fee(`Y arka ${n}`);
    await page.waitForTimeout(gap);
    await page.click(`${WIN} [data-act="mv-more"]`).catch(() => null);
    await page.waitForTimeout(5000);
    delayAll = 0;
    await page.waitForTimeout(1000);
    const s = await nos(); const c = cmp(s, await truth(s.length));
    out.Y.push({ n, gap, satir: s.length, ...c });
    console.log("Y", n, "gap", gap, s.length, JSON.stringify(c));
  }
  if (MODES.includes("C")) {
    await reset();
    delaySummary = 3000;
    await page.click(`${WIN} [data-act="v-fee"]`);
    await page.waitForSelector('form.hof-bank-voucher [name="amount"]', { timeout: 15000 });
    await page.selectOption('form.hof-bank-voucher [name="accountId"]', acc.id).catch(() => null);
    await page.selectOption('form.hof-bank-voucher [name="feeType"]', "eft").catch(() => null);
    await page.fill('form.hof-bank-voucher [name="amount"]', `${700 + n},11`);
    await page.fill('form.hof-bank-voucher [name="description"]', `C ${n}`);
    const posted = page.waitForResponse(r => r.url().includes("/bank/vouchers") && r.request().method() === "POST", { timeout: 15000 }).catch(() => null);
    await page.click('form.hof-bank-voucher button[type="submit"]');
    const pr = await posted;
    await page.waitForTimeout(300);
    const formOpen = Boolean(await page.$("form.hof-bank-voucher"));
    if (formOpen) await page.keyboard.press("Escape");
    await page.waitForTimeout(300);
    const before = (await nos()).length;
    await page.click(`${WIN} [data-act="mv-more"]`).catch(e => console.log("tıklanamadı", String(e).slice(0, 80)));
    await page.waitForTimeout(800);
    const after = (await nos()).length;
    await page.waitForTimeout(4000);
    delaySummary = 0;
    const s = await nos(); const c = cmp(s, await truth(s.length));
    out.C.push({ n, postStatus: pr?.status(), formAcikti: formOpen, once: before, dahaFazla: after, son: s.length, ...c });
    console.log("C", n, "post", pr?.status(), "form", formOpen, before, "->", after, "->", s.length, JSON.stringify(c));
  }
  if (MODES.includes("K")) {
    await reset();
    await page.click(`${WIN} [data-act="mv-more"]`);
    await page.waitForTimeout(2000);
    const s = await nos(); const c = cmp(s, await truth(s.length));
    out.K.push({ n, satir: s.length, ...c });
    console.log("K", n, s.length, JSON.stringify(c));
  }
}
out.sayfaHatalari = errs;
writeFileSync(process.env.CIKTI || "/dev/null", JSON.stringify(out, null, 1));
await browser.close(); await srv.close();
