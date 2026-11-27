// 2.5.1 Mİ-2 — EKRAN: müşterinin iş akışı baştan sona — grup aç → cari → taksit → her yoldan tahsilat → Grup Özeti'nde sayılar → satıra tıkla → Liste → Excel.
// KULLANICI 27.11 (AYNEN): "gruba göre bugün ne kadar kasaya giriş olmuş onu istiyor, yani A grubundaki öğrenciler bugün ne kadar ödeme yapmış gibi …" ve "kasaya giriş
// derken tüm tahsilat yollarını kastettim. nakit, pos, havale, çek, senet". Tasarım: docs/devir/2.5.1-DEVAM/mi2-tasarim.md.
// Gerçek tıklama + klavye (Tab, Enter) + insan hızı (slowMo + harf harf yazma; ders 12); pencere seçicisi en üstteki görünür pencere (ders 39); tarihler koşu gününe göre
// (ders 13); lisans servisi yok (ders 30). Sayılar VERİ TABANINDAN okunup ekranla karşılaştırılır (ders 3); beklenenler ELLE (ders 5):
//   A Grubu › 1. Sınıf: Elif — ekrandan Nakit 100, POS 200, Havale / EFT 300 → A Grubu Tahsilat 600.
//   B Grubu: Can — çek 400 + senet 500 (evrak formu yerine programın kendi ucundan) → B Grubu 900.  Grupsuz: Deniz — tahsilat yok.
//   TOPLAM 1.500 = Nakit 100 + POS 200 + Havale / EFT 300 + Çek 400 + Senet 500.
// Çalıştırma: node test/e2e/senaryo-mi2-251.mjs   (eski kod: DEPO=<eski kök> node <bu dosya>)
import fs, { mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
const { chromium } = await import('/home/user/ofis---y-netimi/node_modules/playwright/index.mjs');

process.env.HUKUK_LICENSE_URL ||= "http://127.0.0.1:9";
const HERE = '<kod kökü>/test/e2e';
const ROOT = process.env.DEPO ? path.resolve(process.env.DEPO) : path.resolve(HERE, "..", "..");
const imp = rel => import(pathToFileURL(path.join(ROOT, rel)).href);
const { createApp } = await imp("server/app.mjs");
const { buildXlsx } = await imp("server/lib/xlsx-write.mjs");
const { escClose } = await import(pathToFileURL(path.join(HERE, "esc-kapat.mjs")).href);
const { xlsxRows } = await import(pathToFileURL(path.join(HERE, "..", "fixtures", "rapor-dosya-oku.mjs")).href);

const OUT = process.env.EKRAN_DIR || path.join(HERE, "artifacts", "senaryo-mi2-251");
fs.rmSync(OUT, { recursive: true, force: true });
fs.mkdirSync(OUT, { recursive: true });
const PASS = "Prova-Admin-2026!";
const root = mkdtempSync(path.join(tmpdir(), "destekofis-mi2-"));
const pad = n => String(n).padStart(2, "0");
const iso = (offset = 0) => {
  const d = new Date();
  d.setDate(d.getDate() + offset);
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
};
const TODAY = iso(0);
const startXlsx = path.join(root, "baslangic.xlsx");
writeFileSync(startXlsx, buildXlsx([{ name: "Kayıtlar", columns: ["Ad Soyad", "Telefon"], rows: [{ "Ad Soyad": "Örnek Kişi", Telefon: "0532 000 00 09" }] }], { title: "Kayıtlar" }));

const app = createApp({ dataDir: path.join(root, "data"), backupDir: path.join(root, "backups"), logLevel: "warn", scheduleBackups: false, env: { HUKUK_ADMIN_PASSWORD: PASS, HUKUK_DATASET_AUTOSYNC: "0" }, license: { enforce: false, machineId: "0123456789abcdef0123456789abcdef" }, startLicenseTimers: false });
const { port } = await app.listen(0, "127.0.0.1");
const BASE = `http://127.0.0.1:${port}`;
const browser = await chromium.launch({ slowMo: 40 });
const context = await browser.newContext({ viewport: { width: 1440, height: 1000 }, locale: "tr-TR", acceptDownloads: true });
await context.addInitScript(() => {
  document.addEventListener("DOMContentLoaded", () => document.head.appendChild(Object.assign(document.createElement("style"), { textContent: "#hof-license-bar,.hof-license-notice{display:none!important}" })));
});
const page = await context.newPage();
page.setDefaultTimeout(15000);
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
  await page.screenshot({ path: path.join(OUT, `${pad(shotNo)}-${name}.png`) });
};
const MODAL = ".hof-modal-backdrop.is-visible";
const TOP = `${MODAL}:nth-last-child(1 of ${MODAL})`;
const ACC = `${MODAL} [data-accounts]`;
// 2.5.1 Mİ tur 2 (BAŞ MİMAR KARARI 27.11 (4)): dönem seçicinin "Tahsilat Dönemi:" etiketi her durumda GÖRÜNÜR (önce yalnız "Yok" seçeneğinin metniydi; dönem seçilince
// kayboluyordu — ana oturumun ekran yürüyüşü). Görünürlük ekrandaki kutudan (genişlik / yükseklik > 0, gizli değil) okunur.
const periodLabel = () =>
  page.$eval(`${ACC} .hof-acc-period`, box => {
    const label = [...box.querySelectorAll("label, span")].find(node => /^Tahsilat Dönemi:?$/.test(node.textContent.trim()) || /^Tahsilat Dönemi:/.test(node.firstChild?.textContent?.trim() || ""));
    const shown = node => {
      if (!node) return false;
      const rect = node.getBoundingClientRect();
      const style = getComputedStyle(node);
      return rect.width > 0 && rect.height > 0 && style.visibility !== "hidden" && style.display !== "none";
    };
    const text = label ? (label.matches("span") ? label.textContent.trim() : label.firstChild?.textContent?.trim() || "") : "";
    return { text, visible: shown(label), selected: box.querySelector("select[data-period]")?.selectedOptions[0]?.textContent.trim() || "" };
  }).catch(() => ({ text: "", visible: false, selected: "" }));
const typeSlow = async text => {
  for (const ch of text) await page.keyboard.type(ch, { delay: 35 });
};
const api = (method, url, body) =>
  page.evaluate(
    async ([method, url, body]) => {
      const res = await fetch(url, { method, headers: { "content-type": "application/json" }, body: body ? JSON.stringify(body) : undefined });
      const json = await res.json().catch(() => null);
      return { status: res.status, data: json && "ok" in json ? json.data ?? json : json };
    },
    [method, url, body],
  );
const must = async (label, promise) => {
  const res = await promise;
  if (res.status !== 200) throw new Error(`${label}: ${res.status} ${JSON.stringify(res.data).slice(0, 300)}`);
  return res.data;
};
const closeAll = async () => {
  for (let i = 0; i < 6 && (await page.$(MODAL)); i += 1) {
    await escClose(page);
    await page.waitForTimeout(250);
  }
};
const one = (sql, ...args) => app.store.get(sql, ...args);
const money = text => Number(String(text || "").replace(/[^\d,-]/g, "").replace(",", ".")) || 0;
// Veri tabanından (ekrandan bağımsız): bugünkü tahsilat, yol yol — cari hareketi (in), taksit tahsilatı (in), alınan evrak (cariye alacak).
const dbToday = accountId => {
  const sumIn = method => one("SELECT COALESCE(SUM(amount), 0) AS s FROM account_entries WHERE account_id = ? AND kind = 'in' AND date = ? AND method = ?", accountId, TODAY, method).s + one("SELECT COALESCE(SUM(e.amount), 0) AS s FROM plan_entries e JOIN plans p ON p.id = e.plan_id WHERE p.account_id = ? AND e.kind = 'in' AND e.date = ? AND e.opening = 0 AND e.cheque_id = '' AND e.method = ?", accountId, TODAY, method).s;
  const evrak = instrument => one("SELECT COALESCE(SUM(e.amount), 0) AS s FROM account_entries e JOIN cheques c ON c.id = e.source_id WHERE e.account_id = ? AND e.source = 'cheque' AND e.kind = 'credit' AND e.date = ? AND c.instrument = ?", accountId, TODAY, instrument).s;
  const out = { cash: sumIn("cash"), card: sumIn("card"), bank: sumIn("bank"), cheque: evrak("cheque"), note: evrak("note") };
  return { ...out, total: out.cash + out.card + out.bank + out.cheque + out.note };
};
const groupTableRow = async name =>
  page.evaluate(
    ([sel, name]) => {
      const table = document.querySelector(`${sel} table[data-groups]`);
      if (!table) return null;
      const heads = [...table.querySelectorAll("thead th")].map(th => th.textContent.trim());
      const row = [...table.querySelectorAll("tbody tr, tfoot tr")].find(tr => tr.querySelector("td, th")?.textContent.replace(/[▸▾›]/g, "").trim() === name);
      if (!row) return null;
      const cells = [...row.children].map(cell => cell.querySelector("b, span")?.textContent.trim() || cell.textContent.trim());
      return Object.fromEntries(heads.map((head, index) => [head, cells[index]]));
    },
    [ACC, name],
  );

async function newAccount(name, phone, group, subgroup) {
  await page.click(`${ACC} [data-act="new"]`);
  await page.waitForSelector(`${TOP} input[name="name"]`);
  await page.click(`${TOP} input[name="name"]`);
  await typeSlow(name);
  await page.keyboard.press("Tab");
  const phoneInput = await page.$(`${TOP} input[name="phone"]`);
  if (phoneInput) {
    await phoneInput.click();
    await typeSlow(phone);
  }
  if (group) {
    const options = await page.$$eval(`${TOP} select[name="groupId"] option`, nodes => nodes.map(node => ({ value: node.value, text: node.textContent.trim() })));
    const existing = options.find(option => option.text === group);
    if (existing) await page.selectOption(`${TOP} select[name="groupId"]`, existing.value);
    else {
      await page.selectOption(`${TOP} select[name="groupId"]`, "\u0001yeni");
      await page.click(`${TOP} input[name="groupName"]`);
      await typeSlow(group);
    }
    if (subgroup) {
      await page.selectOption(`${TOP} select[name="subgroupId"]`, "\u0001yeni");
      await page.click(`${TOP} input[name="subgroupName"]`);
      await typeSlow(subgroup);
    }
  }
  await page.click(`${TOP} button[type="submit"]`);
  const asked = await page.waitForSelector(`${TOP} [data-answer="yes"]`, { timeout: 2500 }).then(() => true, () => false);
  if (asked) await page.click(`${TOP} [data-answer="yes"]`);
  await page.waitForFunction(n => [...document.querySelectorAll(".hof-modal-backdrop.is-visible [data-accounts]")].some(node => node.textContent.includes(n)), name, { timeout: 15000 });
  // Kayıttan sonra carinin kartı açılır; "← Liste"ye dönülür (sonraki "+ Yeni Cari" listede).
  if (await page.$(`${ACC} [data-act="back"]`)) {
    await page.click(`${ACC} [data-act="back"]`);
    await page.waitForSelector(`${ACC} [data-act="new"]`);
  }
  return one("SELECT a.id, COALESCE(g.name, '') AS groupName, COALESCE(s.name, '') AS subgroupName FROM accounts a LEFT JOIN plan_groups g ON g.id = a.group_id LEFT JOIN plan_groups s ON s.id = a.subgroup_id WHERE a.name = ? AND a.deleted_at IS NULL", name);
}
// Cari kartı → "+ Tahsilat": açık taksit kartı varken program sorar — "Taksite Yaz" (taksit tahsilatı) ya da "Taksit Dışı Tahsilat" (cari tahsilatı).
async function openCard(accountId) {
  await closeAll();
  await page.click('#hof-sidecard [data-action="accounts"]');
  await page.waitForSelector(`${ACC} tr[data-account="${accountId}"]`);
  await page.focus(`${ACC} tr[data-account="${accountId}"]`);
  await page.keyboard.press("Enter");
  await page.waitForSelector(`${ACC} [data-entry="in"]`);
}
async function collectFromCard(accountId, amount, method, { plan = false } = {}) {
  await openCard(accountId);
  await page.click(`${ACC} [data-entry="in"]`);
  const choice = await page.waitForSelector(`${TOP} .hof-acc-choice`, { timeout: 3000 }).then(() => true, () => false);
  if (choice) await page.click(plan ? `${TOP} .hof-acc-choice[data-plan]` : `${TOP} .hof-acc-choice[data-plain]`);
  await page.waitForSelector(`${TOP} input[name="amount"]`);
  await page.click(`${TOP} input[name="amount"]`);
  // Taksit formu sıradaki taksitin tutarını önerir: kullanıcı gibi hepsini seçip üstüne yazılır.
  await page.keyboard.press("Control+A");
  await typeSlow(String(amount));
  await page.selectOption(`${TOP} select[name="method"]`, method);
  await page.waitForTimeout(400);
  await page.click(`${TOP} button[type="submit"]`);
  const asked = await page.waitForSelector(`${TOP} [data-answer="yes"]`, { timeout: 2500 }).then(() => true, () => false);
  if (asked) await page.click(`${TOP} [data-answer="yes"]`);
  await page.waitForTimeout(1200);
}

try {
  console.log("\n■ Kurulum: yönetici girer, başlangıç tablosu yüklenir");
  await page.goto(`${BASE}/`);
  await page.fill("#hof-auth input[name=username]", "admin");
  await page.fill("#hof-auth input[name=password]", PASS);
  await Promise.all([page.waitForEvent("load"), page.click('#hof-auth button[type="submit"]')]);
  await page.waitForSelector("#hof-start .hof-drop");
  await (await page.$("#hof-start .hof-drop input[type=file]")).setInputFiles(startXlsx);
  await page.waitForSelector(`${MODAL} .hof-mapping`, { timeout: 30000 });
  await Promise.all([page.waitForEvent("load", { timeout: 30000 }), page.click(`${MODAL} [data-mode="replace"]`)]);
  await page.waitForSelector(".hof-analysis-result:not([hidden])", { timeout: 20000 });
  await page.click(".hof-analysis-result [data-apply], .hof-analysis-result [data-done]").catch(() => escClose(page));
  await page.goto(`${BASE}/`, { waitUntil: "load" });
  await page.waitForSelector(".dynamic-table tbody tr", { timeout: 20000 });
  await must("banka kurulumu geç", api("POST", "/api/workspace/bank/setup/dismiss", {}));

  console.log("\n■ 1. Grup aç + cari (ekrandan, + Yeni Cari formunda '+ Yeni Grup Yaz…')");
  await page.click('#hof-sidecard [data-action="accounts"]');
  await page.waitForSelector(`${ACC} [data-act="new"]`);
  const elif = await newAccount("Elif Öğrenci", "0532 251 40 01", "A Grubu", "1. Sınıf");
  ok(elif?.groupName === "A Grubu" && elif?.subgroupName === "1. Sınıf", `Elif: grup "${elif?.groupName}" › "${elif?.subgroupName}" (veri tabanı)`);
  const can = await newAccount("Can Öğrenci", "0532 251 40 02", "B Grubu");
  ok(can?.groupName === "B Grubu", `Can: grup "${can?.groupName}"`);
  const deniz = await newAccount("Deniz Grupsuz", "0532 251 40 03");
  ok(deniz && !deniz.groupName, "Deniz: grupsuz");
  await shot("liste-cariler");

  console.log("\n■ 2. Taksit (programın kendi ucu) + her yoldan tahsilat (Elif: ekrandan Nakit / POS / Havale; Can: çek + senet)");
  await must("Elif taksit kartı", api("POST", "/api/workspace/plans", { name: "Elif Öğrenci", registeredOn: iso(-60), total: "3000", accountId: elif.id, mode: "auto", count: "3", firstDue: iso(-40), everyMonths: "1" }));
  await must("Can çek", api("POST", "/api/workspace/cheques", { direction: "in", instrument: "cheque", serialNo: "MI2-C1", bank: "Akbank", drawer: "Can Öğrenci", accountId: can.id, amount: "400", issueDate: TODAY, dueDate: iso(60) }));
  await must("Can senet", api("POST", "/api/workspace/cheques", { direction: "in", instrument: "note", serialNo: "MI2-S1", bank: "", drawer: "Can Öğrenci", accountId: can.id, amount: "500", issueDate: TODAY, dueDate: iso(90) }));
  await collectFromCard(elif.id, 100, "cash", { plan: true }); // taksit tahsilatı (Taksite Yaz)
  await collectFromCard(elif.id, 200, "card"); // cari tahsilatı, POS
  await collectFromCard(elif.id, 300, "bank"); // cari tahsilatı, Havale / EFT
  await openCard(elif.id);
  const elifDb = dbToday(elif.id);
  const canDb = dbToday(can.id);
  const planCash = one("SELECT COALESCE(SUM(e.amount), 0) AS s FROM plan_entries e JOIN plans p ON p.id = e.plan_id WHERE p.account_id = ? AND e.kind = 'in' AND e.method = 'cash'", elif.id).s;
  ok(elifDb.cash === 100 && elifDb.card === 200 && elifDb.bank === 300 && planCash === 100, `veri tabanı Elif bugün: nakit ${elifDb.cash} (taksite ${planCash}), POS ${elifDb.card}, havale ${elifDb.bank} (beklenen 100 taksite / 200 / 300)`);
  ok(canDb.cheque === 400 && canDb.note === 500, `veri tabanı Can bugün: çek ${canDb.cheque}, senet ${canDb.note} (beklenen 400 / 500)`);
  await shot("elif-cari-karti");

  console.log("\n■ 3. Grup Özeti (gerçek tıklama): dönem kendiliğinden Bugün; satırlar ve TOPLAM");
  await page.click(`${ACC} [data-act="back"]`);
  await page.waitForSelector(`${ACC} [data-display="groups"]`);
  await page.click(`${ACC} [data-display="groups"]`);
  await page.waitForSelector(`${ACC} table[data-groups]`, { timeout: 15000 });
  const period = await page.$eval(`${ACC} select[data-period]`, node => node.value);
  ok(period === "today", `dönem "${period}" (beklenen today = Bugün)`);
  const groupsLabel = await periodLabel();
  ok(groupsLabel.visible && groupsLabel.text === "Tahsilat Dönemi:" && groupsLabel.selected === "Bugün", `Grup Özeti'nde (dönem Bugün) etiket görünür: ${JSON.stringify(groupsLabel)}`);
  const a = await groupTableRow("A Grubu");
  const b = await groupTableRow("B Grubu");
  const g = await groupTableRow("Grupsuz");
  const t = await groupTableRow("TOPLAM");
  await shot("grup-ozeti");
  ok(a && money(a.Tahsilat) === 600 && money(a.Nakit) === 100 && money(a.POS) === 200 && money(a["Havale / EFT"]) === 300 && a.Cari === "1", `A Grubu: ${JSON.stringify(a)} (beklenen Cari 1, Tahsilat 600 = 100 + 200 + 300)`);
  ok(b && money(b.Tahsilat) === 900 && money(b.Çek) === 400 && money(b.Senet) === 500, `B Grubu: ${JSON.stringify(b)} (beklenen 900 = çek 400 + senet 500)`);
  ok(g && g.Cari === "1" && money(g.Tahsilat) === 0, `Grupsuz: ${JSON.stringify(g)} (beklenen 1 cari, 0)`);
  ok(t && money(t.Tahsilat) === elifDb.total + canDb.total && money(t.Tahsilat) === 1500, `TOPLAM Tahsilat ${t?.Tahsilat} = veri tabanı ${elifDb.total + canDb.total} = 1.500`);
  ok(t && money(t["Gecikmiş Borç"]) > 0 && Number(t["Geciken Taksit"]) >= 1, `TOPLAM Gecikmiş Borç ${t?.["Gecikmiş Borç"]}, Geciken Taksit ${t?.["Geciken Taksit"]} (Elif'in taksiti gecikti)`);
  const kpi = await page.$eval(`${ACC} [data-collected-kpi]`, node => node.textContent.replace(/\s+/g, " ").trim()).catch(() => "");
  ok(/1\.500,00/.test(kpi) && /Bugün/.test(kpi), `Tahsilat kartı: "${kpi}"`);

  console.log("\n■ 4. ▸ alt grupları aç; B Grubu satırına odaklan + Enter → Liste B Grubu'na süzülür");
  await page.click(`${ACC} [data-group-toggle]`);
  await page.waitForTimeout(300);
  const sub = await groupTableRow("1. Sınıf");
  ok(sub && money(sub.Tahsilat) === 600, `alt grup "1. Sınıf" görünür: ${JSON.stringify(sub)}`);
  await shot("grup-ozeti-alt-grup");
  const bSelector = await page.evaluate(sel => {
    const row = [...document.querySelectorAll(`${sel} tr.hof-acc-grouprow`)].find(tr => tr.textContent.includes("B Grubu"));
    return row ? `tr.hof-acc-grouprow[data-group-row="${row.dataset.groupRow}"]` : "";
  }, ACC);
  await page.focus(`${ACC} ${bSelector}`);
  await page.keyboard.press("Enter");
  await page.waitForSelector(`${ACC} table.hof-acc-table`, { timeout: 15000 });
  await page.waitForTimeout(500);
  const names = await page.$$eval(`${ACC} tr[data-account] td:nth-child(3) > b:first-child`, nodes => nodes.map(node => node.textContent.trim()));
  const groupValue = await page.$eval(`${ACC} select[data-filter="group"]`, node => node.selectedOptions[0]?.textContent.trim());
  const listKpi = await page.$eval(`${ACC} [data-collected-kpi]`, node => node.textContent.replace(/\s+/g, " ").trim()).catch(() => "");
  const canCell = await page.$eval(`${ACC} tr[data-account="${can.id}"] td[data-collected]`, node => node.textContent.replace(/\s+/g, " ").trim()).catch(() => "");
  await shot("liste-b-grubu");
  ok(JSON.stringify(names) === JSON.stringify(["Can Öğrenci"]), `Liste yalnız B Grubu: ${JSON.stringify(names)}`);
  ok(/B Grubu/.test(groupValue || ""), `grup süzgeci "${groupValue}"`);
  ok(/900,00/.test(listKpi), `Liste Tahsilat kartı: "${listKpi}" (beklenen 900)`);
  ok(/900,00/.test(canCell) && /Çek/.test(canCell) && /Senet/.test(canCell), `Can'ın Tahsilat hücresi: "${canCell}"`);

  console.log("\n■ 5. Tüm Gruplar + 'Bu Dönemde Ödeme Yapanlar' (tıklama): Deniz düşer");
  await page.selectOption(`${ACC} select[data-filter="group"]`, "");
  await page.waitForTimeout(800);
  await page.click(`${ACC} input[data-paid]`);
  await page.waitForTimeout(900);
  const payers = await page.$$eval(`${ACC} tr[data-account] td:nth-child(3) > b:first-child`, nodes => nodes.map(node => node.textContent.trim()).sort());
  ok(JSON.stringify(payers) === JSON.stringify(["Can Öğrenci", "Elif Öğrenci"]), `ödeme yapanlar: ${JSON.stringify(payers)}`);
  const listLabel = await periodLabel();
  ok(listLabel.visible && listLabel.text === "Tahsilat Dönemi:" && listLabel.selected === "Bugün", `Liste'de dönem seçiliyken etiket görünür: ${JSON.stringify(listLabel)}`);
  const waAll = await page.$(`${ACC} [data-act="waStatement"]`);
  ok(!waAll, "bu süzgeçte 'Tümüne WhatsApp' düğmesi yok (yalnız işaretlenenlere)");
  await shot("liste-odeme-yapanlar");

  console.log("\n■ DK-PROBE: 'Ödeme Yapanlar' açıkken dönem 'Tarih Aralığı'na çevrilir (günler seçilmeden)");
  const waReqs = [];
  page.on("request", req => { if (/whatsapp/.test(req.url()) && req.method() !== "GET") waReqs.push(`${req.method()} ${req.url().replace(BASE, "")} ${req.postData() || ""}`); });
  await page.selectOption(`${ACC} select[data-period]`, "range");
  await page.waitForTimeout(900);
  const rowsAfter = await page.$$eval(`${ACC} tr[data-account] td:nth-child(3) > b:first-child`, nodes => nodes.map(node => node.textContent.trim()).sort());
  const paidBox = await page.$eval(`${ACC} input[data-paid]`, n => n.checked).catch(() => "yok");
  const waBtn = await page.$(`${ACC} [data-act="waStatement"]`);
  const waTitle = waBtn ? await waBtn.getAttribute("title") : null;
  const dbTotal = app.store.get("SELECT COUNT(*) AS n FROM accounts WHERE deleted_at IS NULL AND status = 'active'").n;
  console.log(`  DK: ekrandaki satırlar ${JSON.stringify(rowsAfter)} · 'Ödeme Yapanlar' kutusu ${paidBox} · Tümüne WhatsApp düğmesi ${waBtn ? "VAR" : "yok"} (title: ${waTitle}) · veri tabanında aktif cari ${dbTotal}`);
  await shot("dk-aralik-tumune-wa");
  if (waBtn) {
    await waBtn.click();
    await page.waitForTimeout(2500);
    const dialog = await page.$eval(TOP, n => n.textContent.replace(/\s+/g, " ").trim().slice(0, 600)).catch(() => "");
    console.log(`  DK: açılan pencere: ${dialog}`);
    console.log(`  DK: WhatsApp istekleri: ${JSON.stringify(waReqs)}`);
    await shot("dk-aralik-wa-pencere");
    await escClose(page);
  }
  await page.selectOption(`${ACC} select[data-period]`, "today");
  await page.waitForTimeout(900);

  console.log("\n■ 6. Grup Özeti → Excel (indirilen dosya): satırlar ve TOPLAM ekranla aynı");
  await page.click(`${ACC} [data-display="groups"]`);
  await page.waitForSelector(`${ACC} table[data-groups]`);
  const [download] = await Promise.all([page.waitForEvent("download", { timeout: 20000 }), page.click(`${ACC} [data-xlsx]`)]);
  const file = path.join(root, "grup-ozeti.xlsx");
  await download.saveAs(file);
  const rows = xlsxRows(readFileSync(file));
  const head = rows.findIndex(row => row[0] === "Grup");
  const total = rows.slice(head + 1).find(row => row[0] === "TOPLAM");
  const aRow = rows.slice(head + 1).find(row => row[0] === "A Grubu");
  ok(head >= 0 && total && money(total[rows[head].indexOf("Tahsilat")]) === 1500, `Excel TOPLAM Tahsilat ${total?.[rows[head]?.indexOf("Tahsilat")]} (beklenen 1.500)`);
  ok(aRow && money(aRow[rows[head].indexOf("Nakit")]) === 100 && money(aRow[rows[head].indexOf("POS")]) === 200, `Excel A Grubu: ${JSON.stringify(aRow)}`);

  console.log("\n■ 7. Liste'de dönem 'Tarih Aralığı' ve 'Yok' (klavye): etiket her durumda görünür");
  await page.click(`${ACC} [data-display="list"]`);
  await page.waitForSelector(`${ACC} table.hof-acc-table`, { timeout: 15000 });
  await page.focus(`${ACC} select[data-period]`);
  await page.selectOption(`${ACC} select[data-period]`, "range");
  await page.waitForSelector(`${ACC} input[data-period-from]`, { timeout: 15000 });
  const rangeLabel = await periodLabel();
  ok(rangeLabel.visible && rangeLabel.text === "Tahsilat Dönemi:" && rangeLabel.selected === "Tarih Aralığı", `Tarih Aralığı seçiliyken etiket görünür: ${JSON.stringify(rangeLabel)}`);
  await shot("donem-etiketi-tarih-araligi");
  await page.selectOption(`${ACC} select[data-period]`, "");
  await page.waitForTimeout(800);
  const noneLabel = await periodLabel();
  ok(noneLabel.visible && noneLabel.text === "Tahsilat Dönemi:" && noneLabel.selected === "Yok", `dönem Yok iken etiket görünür, seçenek "Yok": ${JSON.stringify(noneLabel)}`);
  await closeAll();

  const integrity = await api("GET", "/api/workspace/ledger/integrity");
  ok(integrity.data?.ok === true, `Mutabakat Testi tutarlı${integrity.data?.ok ? "" : `: ${JSON.stringify(integrity.data).slice(0, 300)}`}`);
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
console.log(`\nSenaryo Mİ-2 (cari grubuna göre görünümler): ${passed} geçti, ${failed} kaldı. Ekranlar: ${path.relative(process.cwd(), OUT)}`);
process.exit(failed ? 1 : 0);
