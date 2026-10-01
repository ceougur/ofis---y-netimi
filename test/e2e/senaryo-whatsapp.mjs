// Gerçek kullanıcı senaryosu (v2.0.13, müşteri talebi): WhatsApp ile TOPLU ekstre ve mesaj — ölçekli.
// 1.000 cari Excel'den arayüzle yüklenir (bir kısmı numarasız, bir kısmı sabit hatlı, bir kısmının bakiyesi sıfır); sonra:
//   A. Listeden 40 cari işaretlenir → WhatsApp Ekstre → sırayla hepsine gönderilir (kişiye özel metin, cari kartına kayıt)
//   B. 40 seçim sayfalar arasında: 20'si ilk sayfadan, 20'si "Daha Fazla Göster"den sonra — seçim kaybolmaz
//   C. Bir grup (şube) süzülür → Tümüne WhatsApp Mesaj → yalnız borçlular → şablon değişkenleriyle hepsine gönderilir
//   D. Hepsini Seç (1.000) → üç kişinin işareti kaldırılır → 997; o üç kişi alıcı listesinde yoktur
// Her adımda beklenen sayılar Excel'i üreten koddan bağımsız hesaplanır. Çalıştırma: npm run test:senaryo-whatsapp
import fs, { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { chromium } from "playwright";
import { createApp } from "../../server/app.mjs";
import { buildXlsx } from "../../server/lib/xlsx-write.mjs";

const OUT = path.join(path.dirname(fileURLToPath(import.meta.url)), "artifacts", "senaryo-whatsapp");
fs.rmSync(OUT, { recursive: true, force: true });
fs.mkdirSync(OUT, { recursive: true });
const PASS = "Prova-Admin-2026!";
const root = mkdtempSync(path.join(tmpdir(), "destekofis-wa-"));

// ---------- Veri: 1.000 müşteri ----------
const N = 1000;
const BRANCHES = ["Kadıköy Şube", "Üsküdar Şube", "Beşiktaş Şube", "Bakırköy Şube"];
const pad = (value, size = 2) => String(value).padStart(size, "0");
const people = Array.from({ length: N }, (_, index) => {
  const i = index + 1;
  const phone = i % 37 === 0 ? "" : i % 41 === 0 ? `0212 ${pad(i % 1000, 3)} ${pad(i % 100)} ${pad((i * 7) % 100)}` : `05${pad(30 + (i % 70))} ${pad(i % 1000, 3)} ${pad(i % 100)} ${pad((i * 3) % 100)}`;
  const balance = i % 5 === 0 ? 0 : 100 + ((i * 137) % 9000);
  return { i, name: `Müşteri ${pad(i, 4)} Yılmaz`, phone, branch: BRANCHES[i % BRANCHES.length], balance };
});
const validPhone = person => /^05\d{2} /.test(person.phone);
const byName = new Map(people.map(person => [person.name, person]));
const COLS = ["Ad Soyad", "Telefon", "Grup", "Açılış Bakiyesi"];
const accountsXlsx = path.join(root, "musteriler.xlsx");
writeFileSync(accountsXlsx, buildXlsx([{ name: "Müşteriler", columns: COLS, rows: people.map(p => ({ "Ad Soyad": p.name, Telefon: p.phone, Grup: p.branch, "Açılış Bakiyesi": p.balance ? p.balance.toLocaleString("tr-TR", { minimumFractionDigits: 2 }) : "" })) }], { title: "Müşteriler" }));
const startXlsx = path.join(root, "baslangic.xlsx");
writeFileSync(startXlsx, buildXlsx([{ name: "Kayıtlar", columns: ["Ad Soyad", "Telefon"], rows: [{ "Ad Soyad": "Örnek Kişi", Telefon: "0532 000 00 01" }] }], { title: "Kayıtlar" }));

const app = createApp({ dataDir: path.join(root, "data"), backupDir: path.join(root, "backups"), logLevel: "warn", scheduleBackups: false, env: { HUKUK_ADMIN_PASSWORD: PASS, HUKUK_DATASET_AUTOSYNC: "0" }, license: { enforce: false, machineId: "a1b2c3d4e5f60718293a4b5c6d7e8f94" } });
const { port } = await app.listen(0, "127.0.0.1");
const BASE = `http://127.0.0.1:${port}`;
const browser = await chromium.launch();
const errors = [];
const context = await browser.newContext({ viewport: { width: 1440, height: 1000 }, locale: "tr-TR", acceptDownloads: true });
await context.addInitScript(() => {
  document.addEventListener("DOMContentLoaded", () => document.head.appendChild(Object.assign(document.createElement("style"), { textContent: "#hof-license-bar,.hof-license-notice{display:none!important}" })));
  // WhatsApp'ın açılması yerine adresi kaydet (gerçek kullanıcıda WhatsApp sekmesi açılır, mesajı kullanıcı gönderir).
  window.__wa = [];
  window.open = url => {
    window.__wa.push(String(url));
    return null;
  };
});
const admin = await context.newPage();
admin.on("pageerror", error => errors.push(`pageerror ${error.message}`));
admin.on("console", message => {
  if (message.type() === "error" && !/api\/auth\/me|Failed to load resource/.test(`${message.location().url} ${message.text()}`)) errors.push(`${message.text()} @ ${message.location().url}`);
});

const results = [];
let shotNo = 0;
const shot = async name => {
  shotNo += 1;
  await admin.screenshot({ path: path.join(OUT, `${pad(shotNo)}-${name}.png`) });
};
const ok = (cond, msg) => {
  results.push({ ok: Boolean(cond), msg });
  console.log(`${cond ? "✓" : "✗"} ${msg}`);
  if (!cond) throw new Error(`BAŞARISIZ: ${msg}`);
};
const step = async (title, fn) => {
  console.log(`\n■ ${title}`);
  await fn();
};
const call = (url, body, method = body ? "POST" : "GET") =>
  admin.evaluate(
    async ([url, body, method]) => {
      const response = await fetch(url, { method, headers: { "content-type": "application/json" }, body: body ? JSON.stringify(body) : undefined });
      return { status: response.status, ...(await response.json().catch(() => ({}))) };
    },
    [url, body, method],
  );
const modal = ".hof-modal-backdrop.is-visible";
const top = `${modal}:last-of-type`;
const num = text => Number(String(text).replace(/\./g, ""));
const headText = () => admin.$eval(`${top} .hof-wa-head`, node => node.innerText.replace(/\s+/g, " "));
const headCount = (head, label) => num((head.match(new RegExp(`([\\d.]+) ${label}`)) || [])[1] ?? NaN);
const waSent = () => admin.evaluate(() => window.__wa.slice());
const closeAll = async () => {
  for (let i = 0; i < 6 && (await admin.$(modal)); i += 1) {
    await admin.keyboard.press("Escape");
    await admin.waitForTimeout(250);
  }
};
const openAccounts = async () => {
  await closeAll();
  await admin.click('#hof-sidecard [data-action="accounts"]');
  await admin.waitForSelector(`${top} [data-selbar]`);
  await admin.waitForSelector(`${top} tr[data-account]`, { timeout: 20000 });
  await admin.waitForTimeout(300);
};
const barText = () => admin.$eval(`${top} [data-selbar]`, node => node.innerText.replace(/\s+/g, " "));
const rowNames = selector => admin.$$eval(`${top} ${selector}`, rows => rows.map(row => row.querySelector("td:nth-child(3) b")?.textContent.trim() || ""));
// Gönderim sırasını sonuna kadar yürüt: her kişide "WhatsApp'ta Aç ve Sıradakine Geç" (gerçek kullanıcı gibi tek tek).
async function sendAll(expected) {
  await admin.click(`${top} [data-start]`);
  await admin.click(`${top} [data-answer="yes"]`);
  await admin.waitForSelector(`${top} [data-send]`);
  ok(new RegExp(`1 / ${expected}\\b`).test(await admin.$eval(top, node => node.innerText.replace(/\s+/g, " "))), `sıra 1 / ${expected} ile başlar`);
  const started = Date.now();
  for (let i = 0; i < expected; i += 1) {
    await admin.click(`${top} [data-send]`);
    if (i < expected - 1) await admin.waitForFunction(n => new RegExp(`\\b${n + 2} / `).test(document.querySelector(".hof-modal-backdrop.is-visible:last-of-type")?.innerText || ""), i, { timeout: 10000 });
  }
  await admin.waitForSelector(`${top} .hof-wa-done`, { timeout: 15000 });
  return (Date.now() - started) / expected;
}

let exitCode = 0;
const ids = new Map();
try {
  await step("Kurulum: yönetici girer; Cari → Excel / Sheets’ten Yükle ile 1.000 müşteri açılır", async () => {
    await admin.goto(`${BASE}/`);
    await admin.fill("#hof-auth input[name=username]", "admin");
    await admin.fill("#hof-auth input[name=password]", PASS);
    await Promise.all([admin.waitForEvent("load"), admin.click('#hof-auth button[type="submit"]')]);
    await admin.waitForSelector("#hof-start .hof-drop");
    await (await admin.$("#hof-start .hof-drop input[type=file]")).setInputFiles(startXlsx);
    await admin.waitForSelector(`${modal} .hof-mapping`, { timeout: 30000 });
    await Promise.all([admin.waitForEvent("load", { timeout: 30000 }), admin.click(`${modal} [data-mode="replace"]`)]);
    await admin.waitForSelector(".hof-analysis-result:not([hidden])", { timeout: 20000 });
    await admin.click(".hof-analysis-result [data-apply], .hof-analysis-result [data-done]").catch(() => admin.keyboard.press("Escape"));
    await admin.goto(`${BASE}/`, { waitUntil: "load" });
    await admin.waitForSelector(".dynamic-table tbody tr", { timeout: 20000 });
    await closeAll();
    await admin.click('#hof-sidecard [data-action="accounts"]');
    await admin.waitForSelector(`${top} [data-act="import"]`);
    await admin.click(`${top} [data-act="import"]`);
    await admin.waitForSelector(`${top} [data-src="excel"]`);
    const [chooser] = await Promise.all([admin.waitForEvent("filechooser"), admin.click(`${top} [data-src="excel"]`)]);
    await chooser.setFiles(accountsXlsx);
    await admin.waitForSelector(`${top} .hof-import-form`, { timeout: 30000 });
    const roles = await admin.$$eval(`${top} .hof-import-form select[name^="c"]`, nodes => nodes.map(node => node.value));
    ok(JSON.stringify(roles) === JSON.stringify(["name", "phone", "group", "balance"]), `kolonlar tanındı: ${roles.join(", ")}`);
    await admin.waitForFunction(() => /1\.000<\/b> satır hazır|1\.000 satır hazır/.test(document.querySelector(".hof-gate")?.innerHTML || document.querySelector(".hof-gate")?.innerText || ""), null, { timeout: 15000 });
    await shot("cari-excel-esleme");
    const started = Date.now();
    await admin.click(`${top} .hof-import-form button[type="submit"]`);
    await admin.waitForFunction(() => /1\.?000 cari açıldı/.test([...document.querySelectorAll(".hof-toast")].map(node => node.textContent).join(" ")), null, { timeout: 60000 });
    ok(true, `1.000 cari açıldı (${((Date.now() - started) / 1000).toFixed(1)} sn)`);
    const list = await call("/api/workspace/accounts?status=all&limit=5000");
    ok(list.data.total === N, `cari listesinde ${list.data.total} cari`);
    for (const item of list.data.accounts) ids.set(item.name, item.id);
    const sample = list.data.accounts.find(item => item.name === people[6].name);
    ok(sample && Math.abs(sample.balance - people[6].balance) < 0.005 && sample.phone === people[6].phone, `örnek cari: ${sample?.name} bakiye ${sample?.balance}, ${sample?.phone}`);
  });

  await step("A. Listeden 40 cari işaretlenir → WhatsApp Ekstre → sırayla hepsine gönderilir", async () => {
    await openAccounts();
    const boxes = await admin.$$(`${top} tr[data-account] input[data-select]`);
    ok(boxes.length === 300, `ilk sayfada ${boxes.length} cari (sayfa 300)`);
    for (const box of boxes.slice(0, 40)) await box.check();
    ok(/^40 cari seçildi/.test(await barText()), `seçim çubuğu: ${(await barText()).slice(0, 60)}`);
    const chosen = (await rowNames("tr[data-account]")).slice(0, 40).map(name => byName.get(name));
    const valid = chosen.filter(validPhone);
    await shot("40-cari-secildi");
    const started = Date.now();
    await admin.click(`${top} [data-act="waStatement"]`);
    await admin.waitForSelector(`${top} .hof-wa-head`, { timeout: 20000 });
    const head = await headText();
    ok(headCount(head, "Cari") === 40 && headCount(head, "Geçerli Numara") === valid.length && headCount(head, "Gönderilecek") === valid.length, `özet (${Date.now() - started} ms): ${head}`);
    await shot("40-cari-ekstre-hazirlik");
    const before = (await waSent()).length;
    const perPerson = await sendAll(valid.length);
    ok(new RegExp(`${valid.length} kişiye gönderildi`).test(await admin.$eval(top, node => node.innerText)), `tamamlandı: ${valid.length} kişiye gönderildi (kişi başı ${perPerson.toFixed(0)} ms)`);
    await shot("40-cari-tamam");
    const urls = (await waSent()).slice(before);
    ok(urls.length === valid.length && urls.every(url => /^https:\/\/wa\.me\/905\d{9}\?text=/.test(url)), `${urls.length} wa.me adresi, hepsi geçerli cep numarası`);
    const texts = urls.map(url => decodeURIComponent(url.split("text=")[1]));
    ok(valid.every(person => texts.some(text => text.includes(`Sayın ${person.name}`))), "her mesaj kendi kişisinin adıyla (kişiye özel ekstre)");
    ok(texts.every(text => /Güncel bakiye/.test(text)), "her mesajda güncel bakiye");
    const one = valid[3];
    const sent = (await call(`/api/workspace/whatsapp/history?accountId=${ids.get(one.name)}`)).data;
    ok(sent.length === 1 && sent[0].kind === "statement", `${one.name}: cari kartına ekstre gönderimi yazıldı`);
    const invalid = chosen.find(person => !validPhone(person));
    if (invalid) ok((await call(`/api/workspace/whatsapp/history?accountId=${ids.get(invalid.name)}`)).data.length === 0, `${invalid.name} (${invalid.phone || "numarasız"}): gönderilmedi`);
    await closeAll();
    await openAccounts();
    ok(!/cari seçildi/.test(await barText()), "gönderim bitince seçim temizlendi");
  });

  await step("B. Sayfalar arasında 40 seçim: 20 ilk sayfadan, 20 Daha Fazla Göster'den sonra", async () => {
    await openAccounts();
    let boxes = await admin.$$(`${top} tr[data-account] input[data-select]`);
    for (const box of boxes.slice(100, 120)) await box.check();
    await admin.click(`${top} [data-act="more"]`);
    await admin.waitForFunction(() => document.querySelectorAll(".hof-modal-backdrop.is-visible:last-of-type tr[data-account]").length === 600, null, { timeout: 15000 });
    ok(/^20 cari seçildi/.test(await barText()), "daha fazla yüklenince seçim korunur (20)");
    boxes = await admin.$$(`${top} tr[data-account] input[data-select]`);
    for (const box of boxes.slice(450, 470)) await box.check();
    ok(/^40 cari seçildi/.test(await barText()), `iki sayfadan 40: ${(await barText()).slice(0, 40)}`);
    const names = await rowNames("tr[data-account]");
    const chosen = [...names.slice(100, 120), ...names.slice(450, 470)].map(name => byName.get(name));
    await admin.click(`${top} [data-act="waMessage"]`);
    await admin.waitForSelector(`${top} .hof-wa-head`, { timeout: 20000 });
    const head = await headText();
    ok(headCount(head, "Cari") === 40 && headCount(head, "Geçerli Numara") === chosen.filter(validPhone).length, `özet: ${head}`);
    const listed = await admin.$$eval(`${top} tr[data-preview]`, rows => rows.map(row => row.dataset.preview));
    ok(chosen.every(person => listed.includes(ids.get(person.name))), "alıcı listesinde iki sayfadan seçilenlerin hepsi var");
    await closeAll();
  });

  await step("C. Kadıköy Şube süzülür → Tümüne WhatsApp Mesaj → yalnız borçlular → şablonla hepsine gönderilir", async () => {
    await openAccounts();
    await admin.click(`${top} [data-act="clearSel"]`).catch(() => {});
    const group = await admin.$eval(`${top} select[data-filter="group"]`, node => [...node.options].find(option => /Kadıköy Şube/.test(option.textContent))?.value || "");
    await admin.selectOption(`${top} select[data-filter="group"]`, group);
    const branch = people.filter(person => person.branch === "Kadıköy Şube");
    await admin.waitForFunction(n => new RegExp(`Süzgeçteki ${n} cari`).test(document.querySelector('.hof-modal-backdrop.is-visible:last-of-type [data-act="waMessage"]')?.title || ""), branch.length, { timeout: 15000 });
    ok(true, `şube süzgeci: ${branch.length} cari`);
    await admin.click(`${top} [data-act="waMessage"]`);
    await admin.waitForSelector(`${top} textarea[data-body]`, { timeout: 20000 });
    const head = await headText();
    ok(headCount(head, "Cari") === branch.length && headCount(head, "Geçerli Numara") === branch.filter(validPhone).length, `hepsi: ${head}`);
    await admin.check(`${top} input[data-debtors]`);
    const debtors = branch.filter(person => validPhone(person) && person.balance > 0);
    const filtered = await headText();
    ok(headCount(filtered, "Gönderilecek") === debtors.length, `yalnız borçlular: ${debtors.length} gönderilecek (${filtered})`);
    await admin.fill(`${top} textarea[data-body]`, "Sayın {Ad}, güncel {Borç Durumu} {Bakiye}. Şubemizde hafta sonu kampanyası başladı.");
    await shot("sube-toplu-mesaj-hazirlik");
    const before = (await waSent()).length;
    const perPerson = await sendAll(debtors.length);
    ok(new RegExp(`${debtors.length} kişiye gönderildi`).test(await admin.$eval(top, node => node.innerText)), `tamamlandı: ${debtors.length} kişiye gönderildi (kişi başı ${perPerson.toFixed(0)} ms)`);
    await shot("sube-toplu-mesaj-tamam");
    const texts = (await waSent()).slice(before).map(url => decodeURIComponent(url.split("text=")[1]));
    ok(texts.length === debtors.length, `${texts.length} mesaj açıldı`);
    const money = value => value.toLocaleString("tr-TR", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
    ok(debtors.every(person => texts.some(text => text.startsWith(`Sayın ${person.name}, güncel borcunuz`) && text.includes(money(person.balance)))), "her mesajda kendi adı ve kendi bakiyesi");
    ok(texts.every(text => !/[{}]/.test(text)), "doldurulmamış değişken kalmadı");
    const zero = branch.find(person => validPhone(person) && person.balance === 0);
    const zeroHistory = (await call(`/api/workspace/whatsapp/history?accountId=${ids.get(zero.name)}`)).data;
    ok(!zeroHistory.some(item => item.kind === "message"), `${zero.name} (borcu yok): kampanya mesajı gönderilmedi (geçmiş: ${zeroHistory.map(item => item.kind).join(", ") || "yok"})`);
    const debtor = debtors[0];
    ok((await call(`/api/workspace/whatsapp/history?accountId=${ids.get(debtor.name)}`)).data.some(item => item.kind === "message"), `${debtor.name}: mesaj gönderimi cari kartına yazıldı`);
  });

  await step("D. Hepsini Seç (1.000) → üç kişinin işareti kaldırılır → 997; o üçü alıcı listesinde yok", async () => {
    await closeAll();
    await admin.click('#hof-sidecard [data-action="accounts"]');
    await admin.waitForSelector(`${top} select[data-filter="group"]`);
    await admin.selectOption(`${top} select[data-filter="group"]`, "");
    await admin.waitForFunction(() => document.querySelectorAll(".hof-modal-backdrop.is-visible:last-of-type tr[data-account]").length >= 300, null, { timeout: 15000 });
    await admin.check(`${top} input[data-select-all]`);
    ok(/^1\.000 cari seçildi \(süzgeçteki hepsi\)/.test(await barText()), `hepsi: ${(await barText()).slice(0, 60)}`);
    const boxes = await admin.$$(`${top} tr[data-account] input[data-select]`);
    const names = await rowNames("tr[data-account]");
    for (const index of [1, 2, 3]) await boxes[index].uncheck();
    const bar = await barText();
    ok(/^997 cari seçildi \(süzgeçteki hepsi, 3 hariç\)/.test(bar), `işareti kaldırılan üç kişi hariç: ${bar.slice(0, 70)}`);
    const headBox = await admin.$eval(`${top} input[data-select-all]`, node => ({ checked: node.checked, indeterminate: node.indeterminate }));
    ok(!headBox.checked && headBox.indeterminate, "başlık kutusu kısmi (yarım) görünür");
    await shot("hepsi-uc-haric");
    const excluded = [1, 2, 3].map(index => ids.get(names[index]));
    const started = Date.now();
    await admin.click(`${top} [data-act="waStatement"]`);
    await admin.waitForSelector(`${top} .hof-wa-head`, { timeout: 30000 });
    const head = await headText();
    const valid = people.filter(validPhone).filter(person => !excluded.includes(ids.get(person.name)));
    ok(headCount(head, "Cari") === 997 && headCount(head, "Geçerli Numara") === valid.length, `özet (${Date.now() - started} ms): ${head}`);
    const listed = new Set(await admin.$$eval(`${top} tr[data-preview]`, rows => rows.map(row => row.dataset.preview)));
    ok(excluded.every(id => !listed.has(id)), "hariç tutulan üç kişi alıcı listesinde yok");
    await shot("1000-cari-ekstre-hazirlik");
    await closeAll();
  });

  await step("E. Otomatik Sıra (v2.0.14): WhatsApp'tan bu pencereye dönülünce sıradaki kişi kendiliğinden açılır; kapatılınca açılmaz", async () => {
    await closeAll();
    await admin.click('#hof-sidecard [data-action="accounts"]');
    await admin.waitForSelector(`${top} tr[data-account] input[data-select]`, { timeout: 20000 });
    await admin.waitForTimeout(400);
    // Numarası geçerli üç kişi seçilir.
    const names = await rowNames("tr[data-account]");
    const boxes = await admin.$$(`${top} tr[data-account] input[data-select]`);
    const chosen = [];
    for (let i = 0; i < names.length && chosen.length < 3; i += 1) {
      const person = people.find(item => item.name === names[i]);
      if (person && validPhone(person)) { await boxes[i].check(); chosen.push(person); }
    }
    ok(chosen.length === 3, `üç kişi seçildi: ${chosen.map(item => item.name).join(", ")}`);
    await admin.click(`${top} [data-act="waMessage"]`);
    await admin.waitForSelector(`${top} .hof-wa-head`, { timeout: 30000 });
    await admin.click(`${top} [data-start]`);
    await admin.click(`${top} [data-answer="yes"]`);
    await admin.waitForSelector(`${top} [data-send]`);
    ok(await admin.$eval(`${top} input[data-auto]`, node => node.checked), "Otomatik Sıra kutusu varsayılan açık");
    const before = (await waSent()).length;
    await admin.click(`${top} [data-send]`); // 1. kişi: kullanıcı tıklar
    await admin.waitForFunction(() => /2 \/ 3/.test(document.querySelector(".hof-modal-backdrop.is-visible:last-of-type")?.innerText || ""), null, { timeout: 8000 }).catch(async () => {
      console.log("  (ayrıntı) pencere metni:", (await admin.$eval(top, node => node.innerText.replace(/\s+/g, " "))).slice(0, 240), "| __wa:", (await waSent()).length);
      throw new Error("sıra 2 / 3'e geçmedi");
    });
    const hint = await admin.$eval(`${top} [data-wa-hint]`, node => node.innerText.replace(/\s+/g, " "));
    ok(/kendiliğinden açılacak/.test(hint) && (await admin.$eval(`${top} [data-send]`, node => node.textContent.trim())) === "Şimdi Aç", `2. kişi hazır, ipucu: ${hint.slice(0, 90)}`);
    await shot("otomatik-sira-bekliyor");
    // Kullanıcı WhatsApp'ta Gönder'e basıp programa döner (pencere odağı gelir) → 2. kişi kendiliğinden açılır.
    await admin.evaluate(() => window.dispatchEvent(new Event("focus")));
    await admin.waitForFunction(n => window.__wa.length === n + 2, before, { timeout: 5000 });
    ok(/3 \/ 3/.test(await admin.$eval(top, node => node.innerText)), "programa dönünce 2. kişi kendiliğinden açıldı; sıra 3 / 3");
    await admin.evaluate(() => window.dispatchEvent(new Event("focus")));
    await admin.waitForSelector(`${top} .hof-wa-done`, { timeout: 5000 });
    ok((await waSent()).length === before + 3 && /3 kişiye gönderildi/.test(await admin.$eval(top, node => node.innerText)), "3. kişi de kendiliğinden açıldı; 3 kişiye gönderildi");
    ok((await call(`/api/workspace/whatsapp/history?accountId=${ids.get(chosen[2].name)}`)).data.some(item => item.kind === "message"), `${chosen[2].name}: kendiliğinden açılan gönderim de cari kartına yazıldı`);
    await shot("otomatik-sira-tamam");
    // Tamamlandıktan sonra pencereye dönüşler bir şey açmaz.
    await admin.evaluate(() => window.dispatchEvent(new Event("focus")));
    await admin.waitForTimeout(900);
    ok((await waSent()).length === before + 3, "tamamlandıktan sonra odak dönüşü yeni sohbet açmaz");
    await closeAll();
    // Otomatik Sıra kapatılır: dönüşte sıradaki açılmaz; tercih hatırlanır.
    await admin.click('#hof-sidecard [data-action="accounts"]');
    await admin.waitForSelector(`${top} tr[data-account] input[data-select]`, { timeout: 20000 });
    await admin.waitForTimeout(400);
    const boxes2 = await admin.$$(`${top} tr[data-account] input[data-select]`);
    const names2 = await rowNames("tr[data-account]");
    let picked = 0;
    for (let i = 0; i < names2.length && picked < 2; i += 1) { const person = people.find(item => item.name === names2[i]); if (person && validPhone(person)) { await boxes2[i].check(); picked += 1; } }
    await admin.click(`${top} [data-act="waMessage"]`);
    await admin.waitForSelector(`${top} .hof-wa-head`, { timeout: 30000 });
    await admin.click(`${top} [data-start]`);
    await admin.click(`${top} [data-answer="yes"]`);
    await admin.waitForSelector(`${top} input[data-auto]`);
    await admin.uncheck(`${top} input[data-auto]`);
    const before2 = (await waSent()).length;
    await admin.click(`${top} [data-send]`);
    await admin.waitForFunction(() => /2 \/ 2/.test(document.querySelector(".hof-modal-backdrop.is-visible:last-of-type")?.innerText || ""));
    ok((await admin.$eval(`${top} [data-send]`, node => node.textContent.trim())) === "WhatsApp'ta Aç ve Sıradakine Geç", "Otomatik Sıra kapalı: düğme eski adıyla");
    await admin.evaluate(() => window.dispatchEvent(new Event("focus")));
    await admin.waitForTimeout(900);
    ok((await waSent()).length === before2 + 1, "Otomatik Sıra kapalıyken odak dönüşü sıradakini açmaz");
    ok(await admin.evaluate(() => localStorage.getItem("hof.whatsapp.auto") === "0"), "tercih hatırlanır (kapalı)");
    await closeAll();
    await admin.evaluate(() => localStorage.removeItem("hof.whatsapp.auto"));
  });
  await step("Tarayıcı hataları", async () => {
    ok(errors.length === 0, errors.length ? `tarayıcı hataları: ${errors.join(" | ")}` : "hiçbir ekranda tarayıcı hatası yok");
  });
  console.log(`\n${results.filter(item => item.ok).length} / ${results.length} kontrol geçti.`);
} catch (error) {
  exitCode = 1;
  console.error(error);
  await shot("hata").catch(() => {});
} finally {
  fs.writeFileSync(path.join(OUT, "sonuc.json"), JSON.stringify({ results, errors }, null, 2));
  await browser.close();
  await app.close();
  rmSync(root, { recursive: true, force: true });
  process.exit(exitCode);
}
