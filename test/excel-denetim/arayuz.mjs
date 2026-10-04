// Arayüz testi (gerçek kullanıcı gibi, tarayıcıdan): 1) Yük altında ekran kullanılabilir mi? Aynı şirkette başka personel
// saniyede R kayıt yazarken (parasal etkisi olmayan cari not düzeltmesi) arayüz personeli klavyeyle cari arar ve
// "Yeni Fatura" ekranını açar; R = 0, 1, 5, 20. 2) Bugünün işleri iki şirkette AYNI ANDA iki arayüz personeliyle girilir:
// nakit / POS / çekle / taksitli satış, cari tahsilatı, taksit tahsilatı, ödeme; her işlemin cari, Kasa, banka/POS, stok ve
// taksit etkisi işlemden önce ve sonra okunarak doğrulanır.
// Kullanım: SP=<çalışma> node arayuz.mjs
import fs from "node:fs";
import path from "node:path";
import { chromium } from "playwright";
import { HERE, PASS, STAFF_PASS, staff, startServer } from "./ortak.mjs";

const SP = process.env.SP || path.join(HERE, "calisma");
const ROOT = path.join(SP, "canli");
const OUT = path.join(HERE, "cikti");
const SHOTS = path.join(OUT, "ekran");
const state = JSON.parse(fs.readFileSync(path.join(ROOT, "durum.json"), "utf8"));
const app = startServer(ROOT, { fresh: false });
const { port } = await app.listen(0, "127.0.0.1");
const BASE = `http://127.0.0.1:${port}`;
const browser = await chromium.launch();
const modal = ".hof-modal-backdrop.is-visible";
const top = `${modal}:last-of-type`;
const inv = `${modal} .hof-invoices-modal`;
const results = [];
let group = "";
const record = (name, expected, actual, ok, detail = "") => {
  results.push({ group, name, expected, actual, ok, detail });
  console.log(`${ok ? "✓" : "✗ BULGU"} [${group}] ${name}\n     beklenen: ${expected}\n     gerçek:   ${actual}${detail ? `\n     ayrıntı: ${detail}` : ""}`);
};
const pad = v => String(v).padStart(2, "0");
const d = new Date();
const TODAY = `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
const addDays = n => { const x = new Date(Date.now() + n * 86400000); return `${x.getFullYear()}-${pad(x.getMonth() + 1)}-${pad(x.getDate())}`; };
const tr = n => String(n).replace(".", ",");
let shotNo = 0;
const shot = async (page, name) => { shotNo += 1; await page.screenshot({ path: path.join(SHOTS, `arayuz-${String(shotNo).padStart(3, "0")}-${name}.png`) }).catch(() => null); };
const toasts = page => page.$$eval(".hof-toast", nodes => nodes.map(node => node.textContent.replace(/×$/, "").trim())).catch(() => []);
async function closeAll(page) { for (let i = 0; i < 8 && (await page.$(modal)); i += 1) { await page.keyboard.press("Escape"); await page.waitForTimeout(200); } }
async function uiLogin(username, companyId) {
  const page = await (await browser.newContext({ viewport: { width: 1440, height: 900 }, locale: "tr-TR" })).newPage();
  page.on("dialog", x => x.accept());
  await page.goto(`${BASE}/`);
  await page.fill("#hof-auth input[name=username]", username);
  await page.fill("#hof-auth input[name=password]", STAFF_PASS);
  const resp = page.waitForResponse(r => r.url().includes("/api/auth/login"), { timeout: 60000 });
  await page.click('#hof-auth button[type="submit"]');
  const status = (await resp).status();
  if (status !== 200) throw new Error(`${username} girişi HTTP ${status}`);
  await page.waitForSelector("#hof-company", { timeout: 60000 });
  const current = await page.evaluate(() => window.HOF?.companyId || "");
  if (current !== companyId) {
    await page.click("#hof-company [data-toggle]");
    await Promise.all([page.waitForEvent("load"), page.click(`#hof-company [data-pick="${companyId}"]`)]);
    await page.waitForSelector("#hof-company");
  }
  return page;
}
const adminApi = staff(BASE);
await adminApi.login("admin", PASS);

// ---------------------------------------------------------------- 1) Yük altında kullanılabilirlik
group = "Yük Altında Ekran";
const C1 = state.companies["001"];
const c1 = adminApi.withCompany(C1);
const accs = (await c1.get("/api/workspace/accounts?status=all&limit=400")).data.accounts.filter(a => /^C0/.test(a.refNo));
let stopNoise = null;
const noise = rate => {
  let alive = true;
  const colleague = staff(BASE, C1);
  const run = (async () => {
    await colleague.login("alis001", STAFF_PASS);
    let i = 0;
    while (alive && rate > 0) {
      const a = accs[i % accs.length];
      i += 1;
      await colleague.put(`/api/workspace/accounts/${a.id}`, { name: a.name, type: a.type, refNo: a.refNo, note: `yük testi ${i}` });
      await new Promise(r => setTimeout(r, 1000 / rate));
    }
    return i;
  })();
  return async () => { alive = false; return run; };
};
// A/B: aynı yazma yükünde açık (boşta duran) tarayıcı penceresi sayısı sunucunun hızını değiştiriyor mu?
async function throughput(label, seconds = 30) {
  const writer = staff(BASE, C1);
  await writer.login("alis001", STAFF_PASS);
  const end = Date.now() + seconds * 1000;
  let n = 0;
  const lat = [];
  const workers = [0, 1, 2, 3].map(async w => {
    while (Date.now() < end) {
      const a = accs[(n + w * 97) % accs.length];
      const t0 = performance.now();
      await writer.put(`/api/workspace/accounts/${a.id}`, { name: a.name, type: a.type, refNo: a.refNo, note: `hız ölçümü ${n}` });
      lat.push(performance.now() - t0);
      n += 1;
    }
  });
  await Promise.all(workers);
  lat.sort((x, y) => x - y);
  return { label, perSecond: +(n / seconds).toFixed(1), p50: Math.round(lat[Math.floor(lat.length / 2)]), p95: Math.round(lat[Math.floor(lat.length * 0.95)]) };
}
let ui1;
if (!process.env.SADECE) {
group = "Açık Pencere Sayısının Sunucu Hızına Etkisi";
const t0 = await throughput("0 açık pencere");
const idle = [await uiLogin("arayuz001", C1), await uiLogin("mudur", C1)];
await idle[0].waitForTimeout(2000);
const t2 = await throughput("2 açık pencere (boşta, ana ekranda)");
const idle2 = [await uiLogin("satis001", C1), await uiLogin("tahsilat001", C1), await uiLogin("stajyer001", C1)];
await idle2[0].waitForTimeout(2000);
const t5 = await throughput("5 açık pencere (boşta, ana ekranda)");
for (const p of [...idle2, idle[1]]) await p.context().close();
record("Aynı yazma yükü (4 eşzamanlı istek), açık pencere 0 / 2 / 5", "pencere sayısı hızı belirgin düşürmez", [t0, t2, t5].map(t => `${t.label}: saniyede ${t.perSecond} kayıt, yanıt p50 ${t.p50} ms / p95 ${t.p95} ms`).join(" · "), t5.perSecond > t0.perSecond * 0.5, "Her açık pencere, başkasının her kaydında ekranını yeniler (sunucuya ek sorgu).");
ui1 = idle[0];
for (const rate of [0, 1, 5, 20]) {
  stopNoise = noise(rate);
  await ui1.waitForTimeout(1500);
  try {
    // a) Cari penceresi: insan gibi — kutunun ekrandaki yerine fareyle tıkla, klavyeyle yaz.
    await closeAll(ui1);
    await ui1.click("#hof-sidecard [data-action=accounts]");
    await ui1.waitForSelector(`${top} input[data-filter="q"]`);
    // Arama kutusu 10 sn içinde kaç kez DOM'dan çıkarılıp yeniden çiziliyor?
    const redraws = await ui1.evaluate(async () => {
      let n = 0; let node = document.querySelector('.hof-modal-backdrop.is-visible:last-of-type input[data-filter="q"]');
      const t = setInterval(() => { const now = document.querySelector('.hof-modal-backdrop.is-visible:last-of-type input[data-filter="q"]'); if (now !== node) { n += 1; node = now; } }, 50);
      await new Promise(r => setTimeout(r, 10000)); clearInterval(t); return n;
    });
    const box = await ui1.$eval(`${top} input[data-filter="q"]`, n => { const r = n.getBoundingClientRect(); return { x: r.x + 40, y: r.y + r.height / 2 }; });
    await ui1.mouse.click(box.x, box.y);
    await ui1.keyboard.press("Control+A");
    const started = Date.now();
    await ui1.keyboard.type("C0123", { delay: 150 });
    await ui1.waitForTimeout(2500);
    const value = await ui1.$eval(`${top} input[data-filter="q"]`, n => n.value).catch(() => "?");
    const rows = await ui1.$$eval(`${top} tr[data-account]`, n => n.map(x => x.textContent.slice(0, 40))).catch(() => []);
    const found = rows.some(r => r.includes("C0123"));
    await shot(ui1, `yuk-${rate}-cari-arama`);
    record(`Saniyede ${rate} başka kayıt yazılırken Cari aramasına fare + klavyeyle "C0123" yazılır`, "kutuda C0123, listede o cari", `arama kutusu 10 sn'de ${redraws} kez yeniden çizildi; kutuda "${value}", ${rows.length} satır, bulundu: ${found ? "evet" : "hayır"} (${Date.now() - started} ms)`, value === "C0123" && found);
    // b) "+ Yeni Fatura" senaryo ekranı açık kalıyor mu
    await closeAll(ui1);
    await ui1.click("#hof-sidecard [data-action=invoices]");
    await ui1.waitForSelector(`${inv} [data-act="new"]`);
    const nb = await ui1.$eval(`${inv} [data-act="new"]`, n => { const r = n.getBoundingClientRect(); return { x: r.x + r.width / 2, y: r.y + r.height / 2 }; });
    await ui1.mouse.click(nb.x, nb.y);
    const opened = await ui1.waitForSelector(`${inv} [data-scenario="goods_sale"]`, { timeout: 8000 }).then(() => true, () => false);
    await ui1.waitForTimeout(4000);
    const stillOpen = Boolean(await ui1.$(`${inv} [data-scenario="goods_sale"]`));
    await shot(ui1, `yuk-${rate}-yeni-fatura`);
    record(`Saniyede ${rate} başka kayıt yazılırken "+ Yeni Fatura"ya fareyle basılır; senaryo ekranı açılır ve 4 sn sonra hâlâ açık`, "açık kalır", `açıldı: ${opened ? "evet" : "hayır"}, 4 sn sonra: ${stillOpen ? "açık" : "listeye döndü"}`, opened && stillOpen);
  } catch (error) {
    await shot(ui1, `yuk-${rate}-HATA`);
    record(`Saniyede ${rate} başka kayıt yazılırken ekran adımı`, "tamamlanır", `DURDU: ${error.message.split("\n")[0]}`, false);
  }
  const written = await (await stopNoise)();
  console.log(`     (arka plan ${written ?? 0} kayıt yazdı)`);
}
await closeAll(ui1);
} else ui1 = await uiLogin("arayuz001", C1);

// ---------------------------------------------------------------- 2) Bugünün işleri, iki şirkette aynı anda arayüzden
group = "Bugünün İşleri (Arayüzden, İki Şirket Aynı Anda)";
async function dayWork(code) {
  const companyId = state.companies[code];
  const page = code === "001" ? ui1 : await uiLogin(`arayuz${code}`, companyId);
  const api = async url => page.evaluate(async u => (await (await fetch(u)).json()).data, `${url}${url.includes("?") ? "&" : "?"}hofCompany=${companyId}`);
  const list = (await api("/api/workspace/accounts?status=all&limit=400")).accounts;
  const cust = list.find(a => a.refNo === "C0007");
  const cust2 = list.find(a => a.refNo === "C0003");
  const supp = list.find(a => a.refNo === "C0004");
  const item = (await api("/api/workspace/stock?limit=200")).items.find(i => i.code === "ELK-001");
  // Doğrulama yönetici hesabıyla, ayrı bağlantıdan okunur (Muhasebe rolü ANLIK DURUM'u göremez — programın kuralı).
  const ro = adminApi.withCompany(companyId);
  const rd = async url => (await ro.get(url)).data;
  const snap = async () => {
    const ov = await rd("/api/workspace/overview");
    return { cash: ov.cash.byMethod.cash, bank: ov.cash.byMethod.bank, card: ov.cash.byMethod.card, cust: (await rd(`/api/workspace/accounts/${cust.id}`)).totals.balance, cust2: (await rd(`/api/workspace/accounts/${cust2.id}`)).totals.balance, supp: (await rd(`/api/workspace/accounts/${supp.id}`)).totals.balance, stock: (await rd(`/api/workspace/stock/${item.id}`)).qty, cheques: (await rd("/api/workspace/cheques?status=all&limit=5000")).cheques.length };
  };
  const near = (a, b) => Math.abs(a - b) < 0.006;
  const sale = async (label, account, qty, price, pay) => {
    const before = await snap();
    await closeAll(page);
    await page.click("#hof-sidecard [data-action=invoices]");
    await page.waitForSelector(`${inv} [data-act="new"]`);
    await page.click(`${inv} [data-act="new"]`);
    await page.click(`${inv} [data-scenario="goods_sale"]`);
    await page.waitForSelector(`${inv} [data-lines]`);
    await page.fill(`${inv} [data-acc-query]`, account.name);
    await page.waitForSelector(`${inv} .hof-acc-picker li[data-id="${account.id}"]`);
    await page.dispatchEvent(`${inv} .hof-acc-picker li[data-id="${account.id}"]`, "mousedown");
    await page.click(`${inv} [data-l="0"][data-f="name"]`);
    await page.keyboard.type(item.name);
    await page.waitForSelector(`${inv} [data-hits="0"] li[data-item]`);
    await page.click(`${inv} [data-hits="0"] li[data-item]`);
    await page.fill(`${inv} [data-l="0"][data-f="qty"]`, String(qty));
    await page.fill(`${inv} [data-l="0"][data-f="unitPrice"]`, tr(price));
    await page.selectOption(`${inv} [data-l="0"][data-f="vatRate"]`, "20");
    await page.waitForTimeout(700);
    const gross = Math.round(qty * price * 1.2 * 100) / 100;
    if (pay.method) {
      await page.click(`${inv} [data-act="pay-add-cash"]`);
      await page.selectOption(`${inv} [data-pay="cash"][data-f="method"]`, pay.method);
      await page.fill(`${inv} [data-pay="cash"][data-i="0"][data-f="amount"]`, tr(gross));
    } else if (pay.cheque) {
      await page.click(`${inv} [data-act="pay-add-cheque"]`);
      // İnsan gibi: her alana tıkla, yaz, Tab ile çık, kısa bekle.
      const f = async (field, text, isDate = false) => {
        const sel = `${inv} [data-pay="cheques"][data-i="0"][data-f="${field}"]`;
        await page.click(sel);
        // Tarih kutusuna klavyeyle yazmak headless Chromium'da çalışmaz (tarayıcı sınırı); tarih seçiciden seçilmiş gibi verilir.
        if (isDate) await page.fill(sel, text);
        else { await page.keyboard.press("Control+A"); await page.keyboard.type(text, { delay: 60 }); }
        await page.keyboard.press("Tab");
        await page.waitForTimeout(700);
      };
      await f("amount", tr(gross));
      await f("dueDate", addDays(60), true);
      await f("serialNo", `UI-${code}-${Date.now() % 100000}`);
      await f("bank", "Ziraat");
      const kept = await page.$$eval(`${inv} [data-pay="cheques"][data-i="0"]`, nodes => Object.fromEntries(nodes.map(n => [n.dataset.f, n.value])));
      console.log(`     ${code} çek alanları Kaydet öncesi: ${JSON.stringify(kept)}`);
    } else if (pay.installments) {
      await page.click(`${inv} [data-rest="installments"]`);
      await page.fill(`${inv} [data-payf="installments.count"]`, String(pay.installments));
    }
    await page.waitForTimeout(700);
    await shot(page, `${code}-bugun-${label}-formu`);
    await page.click(`${inv} [data-act="issue"]`);
    for (let i = 0; i < 3; i += 1) {
      const yes = await page.waitForSelector(`${modal} [data-answer="yes"]`, { timeout: 4000 }).catch(() => null);
      if (!yes) break;
      await page.click(`${modal} [data-answer="yes"]`);
      await page.waitForTimeout(500);
      if (await page.$(`${inv} .hof-inv-pills`)) break;
    }
    await page.waitForSelector(`${inv} .hof-inv-pills`, { timeout: 15000 });
    const title = (await page.textContent(`${inv} .hof-plan-title h3`)).replace(/\s+/g, " ").trim();
    await shot(page, `${code}-bugun-${label}-karti`);
    const after = await snap();
    return { before, after, gross, title };
  };
  const out = [];
  try {
    let r = await sale("nakit-satis", cust, 3, 100, { method: "cash" });
    out.push([`${code} Nakit satış 3 × 100 + %20 = 360 (${r.title})`, "Kasa +360; cari değişmez; stok −3", `Kasa ${r.after.cash - r.before.cash}; cari ${r.after.cust - r.before.cust}; stok ${r.after.stock - r.before.stock}`, near(r.after.cash - r.before.cash, 360) && near(r.after.cust, r.before.cust) && r.after.stock - r.before.stock === -3]);
    r = await sale("pos-satis", cust, 2, 250, { method: "card" });
    out.push([`${code} POS'la satış 2 × 250 + %20 = 600`, "POS +600; Kasa değişmez", `POS ${r.after.card - r.before.card}; Kasa ${r.after.cash - r.before.cash}`, near(r.after.card - r.before.card, 600) && near(r.after.cash, r.before.cash)]);
    r = await sale("cekle-satis", cust, 5, 200, { cheque: true });
    out.push([`${code} Çekle satış 5 × 200 + %20 = 1.200`, "portföye 1 çek; cari net 0; Kasa/banka değişmez", `çek +${r.after.cheques - r.before.cheques}; cari ${r.after.cust - r.before.cust}; Kasa ${r.after.cash - r.before.cash}`, r.after.cheques - r.before.cheques === 1 && near(r.after.cust, r.before.cust) && near(r.after.cash, r.before.cash)]);
    r = await sale("taksitli-satis", cust2, 10, 300, { installments: 3 });
    out.push([`${code} Taksitli satış 10 × 300 + %20 = 3.600, 3 taksit`, "cari +3.600 (tek borç); taksit kartı 3 × 1.200", `cari ${r.after.cust2 - r.before.cust2}`, near(r.after.cust2 - r.before.cust2, 3600)]);
    // Taksit tahsilatı: cari kartı → + Tahsilat → Taksite Yaz
    const plan = (await api(`/api/workspace/accounts/${cust2.id}`)).plans.find(p => p.totals.remaining > 0 && Math.abs(p.totals.total - 3600) < 0.01);
    let b = await snap();
    await closeAll(page);
    await page.click("#hof-sidecard [data-action=accounts]");
    await page.waitForSelector(`${top} input[data-filter="q"]`);
    await page.fill(`${top} input[data-filter="q"]`, cust2.refNo);
    await page.waitForSelector(`${top} tr[data-account="${cust2.id}"]`);
    await page.click(`${top} tr[data-account="${cust2.id}"]`);
    await page.waitForSelector(`${top} [data-entry="in"]`);
    await page.click(`${top} [data-entry="in"]`);
    await page.waitForSelector(`${top} [data-plan="${plan.id}"]`);
    await shot(page, `${code}-bugun-taksite-yaz-secimi`);
    await page.click(`${top} [data-plan="${plan.id}"]`);
    await page.waitForSelector(`${top} form input[name=amount]`);
    await page.fill(`${top} form input[name=amount]`, "1200");
    if (await page.$(`${top} form select[name=method]`)) await page.selectOption(`${top} form select[name=method]`, "cash");
    await shot(page, `${code}-bugun-taksit-tahsilati-formu`);
    await page.click(`${top} form button[type=submit]`);
    await page.waitForFunction(() => [...document.querySelectorAll(".hof-toast")].some(n => /kaydedildi/i.test(n.textContent)), null, { timeout: 10000 });
    let a = await snap();
    const plan2 = (await api(`/api/workspace/plans/${plan.id}`));
    out.push([`${code} 1. taksit nakit tahsil (1.200)`, "Kasa +1.200; cari −1.200; kart ödenen 1.200", `Kasa ${a.cash - b.cash}; cari ${a.cust2 - b.cust2}; kart ödenen ${plan2.totals.paid}`, near(a.cash - b.cash, 1200) && near(a.cust2 - b.cust2, -1200) && near(plan2.totals.paid, 1200)]);
    // Cari tahsilatı (havale, taksit dışı) ve tedarikçiye ödeme (nakit)
    for (const [label, acc, entryKind, method, amount, key, sign] of [["cari-tahsilat-havale", cust, "in", "bank", 500, "bank", 1], ["tedarikci-odeme-nakit", supp, "out", "cash", 300, "cash", -1]]) {
      b = await snap();
      await closeAll(page);
      await page.click("#hof-sidecard [data-action=accounts]");
      await page.waitForSelector(`${top} input[data-filter="q"]`);
      await page.fill(`${top} input[data-filter="q"]`, acc.refNo);
      await page.waitForSelector(`${top} tr[data-account="${acc.id}"]`);
      await page.click(`${top} tr[data-account="${acc.id}"]`);
      await page.waitForSelector(`${top} [data-entry="${entryKind}"]`);
      await page.click(`${top} [data-entry="${entryKind}"]`);
      if (entryKind === "in" && (await page.waitForSelector(`${top} [data-plain]`, { timeout: 1500 }).catch(() => null))) await page.click(`${top} [data-plain]`);
      await page.waitForSelector(`${top} form input[name=amount]`);
      await page.fill(`${top} form input[name=amount]`, String(amount));
      await page.selectOption(`${top} form select[name=method]`, method);
      await shot(page, `${code}-bugun-${label}-formu`);
      await page.click(`${top} form button[type=submit]`);
      const yes = await page.waitForSelector(`${modal} [data-answer="yes"]`, { timeout: 2500 }).catch(() => null);
      if (yes) await page.click(`${modal} [data-answer="yes"]`);
      await page.waitForFunction(() => [...document.querySelectorAll(".hof-toast")].some(n => /kaydedildi/i.test(n.textContent)), null, { timeout: 10000 });
      a = await snap();
      const accKey = acc === supp ? "supp" : "cust";
      out.push([`${code} ${label} (${amount})`, `${key} ${sign > 0 ? "+" : "−"}${amount}; cari ${entryKind === "in" ? "−" : "+"}${amount}`, `${key} ${(a[key] - b[key]).toFixed(2)}; cari ${(a[accKey] - b[accKey]).toFixed(2)}`, near(a[key] - b[key], sign * amount) && near(a[accKey] - b[accKey], entryKind === "in" ? -amount : amount)]);
    }
  } catch (error) {
    await shot(page, `${code}-bugun-HATA`);
    out.push([`${code} arayüz akışı`, "tamamlanır", `DURDU: ${error.message.split("\n")[0]} · ${(await toasts(page)).join(" | ")}`, false]);
  }
  return out;
}
const both = await Promise.all([dayWork("001"), dayWork("002")]);
for (const list of both) for (const [name, expected, actual, ok] of list) record(name, expected, actual, ok);
fs.writeFileSync(path.join(OUT, "arayuz-sonucu.json"), JSON.stringify(results, null, 1));
console.log(`\nArayüz testi: ${results.length}; beklenene uymayan: ${results.filter(x => !x.ok).length}`);
await browser.close();
await app.close();
