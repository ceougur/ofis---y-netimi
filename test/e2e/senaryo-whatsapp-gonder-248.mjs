// 2.4.8 W4 EKRANDAN — WhatsApp Business API ile toplu gönderim (docs/erp/WHATSAPP-API-PLANI-2.4.8.md §6 W4, §7a, R1–R3). İŞ AKIŞI (test kuralı): sıfırdan,
// arayüzden, uçtan uca; sayılar programın veri tabanından / API'sinden ve sahte Meta'nın kaydından okunur (ders 3). Meta yerine YEREL sahte Graph sunucusu
// (test/whatsapp-sahte-graph.mjs; ders 30), durum bildirimi (kanca) programın UZAK dinleyicisine HTTP ile (lib/whatsapp/hook.mjs; kapıcı bu kurulumda kapalı).
// Sunucu saati sahte (03.11.2026 09:00; ders 13); gönderim işçisi testte elle sürülür (zamanlayıcı yarışı yok — ders 20). Gerçek tıklama + Tab + Boşluk (ders 12);
// en üstteki pencere seçicisi (ders 39); soru pencereleri bekleyerek yanıtlanır, her yanıt günlüğe yazılır (ders 34). Beklenen sayılar PLANDAN ve girilen veriden
// (§7a 2, 6, 8, 9, 19, 20; R3) — programın kodundan okunmaz (ders 5).
//   G0 cariler: aynı adlı iki cari (farklı telefon), aynı telefonlu iki cari, telefonsuz, "WhatsApp Mesajı İstemiyor", pasif → 7 cari.
//   G1 Cari listesi → Tümü → hepsini seç → WhatsApp Ekstre: iki yol görünür, Otomatik Gönder seçili; önizleme 7 / 4 gönderilecek / 3 elenen (Telefon yok 1,
//      İstemiyor 1, Pasif Cari 1); aynı adlı iki satır ayrı telefonla; tahmini ücret 4 × 0,0009; onay işaretsiz → Gönder PASİF + nedeni görünür.
//   G2 Ödeme Hatırlatma ve dönem seçenekleri (ders 11): gecikmiş borcu olmayan herkes "Gecikmiş Borç Yok", Gönder pasif + neden; Geçen Ay önizlemesi.
//   G3 onay Tab + Boşluk ile → Gönder (4 Kişi) → onay sorusu → toplu iş ekranı; veri tabanında 1 toplu iş, 7 iş (4 bekliyor + 3 atlandı); Meta'ya henüz ileti yok.
//   G4 Duraklat → veri tabanında paused; Devam Et → running. İşçi → sahte Meta 4 ileti (aynı telefona iki ayrı PDF), ekranda "Meta Kabul Etti: 4".
//   G5 kanca (HTTP): teslim / okundu / teslim / başarısız(131026) → ekranda Teslim Edildi 2, Okundu 1, Başarısız 1 + neden; "Bu Ay" 3 (API) ve Yönetim kartında 3.
//   G6 sayfa yenilenir → pencere yeniden açılır: Gönderimler listesinden aynı toplu iş, durumlar sunucudan. İkinci sekme aynı anda: süren işte "Zaten Kuyrukta".
//   G7 R3: aynı dönem yeniden → "3 kişiye bu dönem daha önce gönderildi", varsayılan Bunları Çıkar (gönderilecek 1); Yine de Gönder → 4.
//   G8 Bağlantı Bekleniyor (Meta'ya ulaşılamıyor) ve Sınır Nedeniyle Bekliyor (elle günlük sınır) ekranda açıkça; bağlantı dönünce sürer.
//   G8d (İş P2) şirket dosyası başka programda kilitli: süren toplu işin ekranında "Şirket dosyası başka bir program tarafından kullanılıyor; gönderim bekliyor."
//       ve listede "Dosya Kullanımda" (canlı olayla); kilit kalkınca ikisi de kalkar, iş gider (tek ileti).
//   G8e (İş R3) makine defteri kilitli: süren gönderimde "WhatsApp gönderim defteri başka bir program tarafından kullanılıyor; gönderim bekliyor.", listede etiket.
//   G9 WhatsApp Web ile Gönder (bugünkü wa.me yolu) bağlantı varken de çalışır: Otomatik Sıra, wa.me adresi, cari kartına kayıt (message_sends).
//   G10 yetkisiz (Personel): Otomatik Gönder sekmesinde neden, Gönder pasif; API 403. G11 dar pencere (760 px) taşma yok. G12 salt okunur lisans: neden, pasif.
// Çıkış: "N geçti, M kaldı" (kaldıysa 1). Ekran görüntüleri EKRAN_DIR (varsayılan test/e2e/artifacts/senaryo-whatsapp-gonder-248).
import { appendFileSync, mkdirSync, mkdtempSync, writeFileSync } from "node:fs";
import http from "node:http";
import { tmpdir } from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { chromium } from "playwright";
import { ADMIN_PASSWORD, createUser, removeTestDir } from "../helpers.mjs";
import { PNID, URLS, WABA, startWa } from "../whatsapp-248-ortak.mjs";

const root = mkdtempSync(path.join(tmpdir(), "senaryo-whatsapp-gonder-248-"));
const dataDir = path.join(root, "data");
const shots = process.env.EKRAN_DIR || path.join(path.dirname(fileURLToPath(import.meta.url)), "artifacts", "senaryo-whatsapp-gonder-248");
mkdirSync(shots, { recursive: true });
const answersLog = path.join(shots, "soru-yanitlari.log");
writeFileSync(answersLog, "");
const MODAL = ".hof-modal-backdrop.is-visible";
const TOP = `${MODAL}:nth-last-child(1 of ${MODAL})`;
const STAFF = { username: "wa4-personel", password: "Personel-Wa4-2026!" };
const SAME = "Aynı Ad Kişi";

let passed = 0;
let failed = 0;
const ok = (cond, what) => {
  if (cond) passed += 1;
  else failed += 1;
  console.log(`  ${cond ? "✓" : "✗"} ${what}`);
  return Boolean(cond);
};

// İş P2 (G8d): yazım kilidi işareti 2 sn (üretimde 30 sn; yalnız test oluşturucu seçeneği) — kilit kalkınca notun kalkması beklenebilir sürede.
let ctx = await startWa({ dataDir, ack: false, __testWriteLockBackoffMs: 2_000 });
const setup = async () => {
  const test = await ctx.api.post(`${URLS.conn}/test`, {});
  if (test.status !== 200) throw new Error(`sınama: ${test.status} ${JSON.stringify(test.data)}`);
  const ensure = await ctx.api.post("/api/workspace/whatsapp/templates/ensure", {});
  if (ensure.status !== 200) throw new Error(`şablonlar: ${ensure.status} ${JSON.stringify(ensure.data)}`);
};
await setup();
// Durum bildirimi yolu: programın uzak dinleyicisi + kanca adresinin Meta'ya (sahte) kaydı → gizli yol sahte Meta'nın aboneliğinden okunur.
const remote = await ctx.server.app.listenRemote(0, "127.0.0.1");
const remoteBase = `http://127.0.0.1:${remote.port}`;
// Kayıtlı adres ofisin telefon adresi biçiminde (.test); Meta'nın isteği burada doğrudan uzak dinleyiciye gider (tünel/kapıcı W9 testlerinde).
const PUBLIC = "http://ofis-w4.destekofis.test";
ctx.server.app.mobileRemote.setPublicUrl(PUBLIC);
await ctx.server.app.context.whatsapp.connection.registerHook(null, PUBLIC);
const secret = () => new URL(ctx.fake.state.subscriptions.at(-1).override_callback_uri).pathname.split("/").pop();
const hookPost = body => new Promise((resolve, reject) => {
  const payload = Buffer.from(JSON.stringify(body));
  const req = http.request(`${remoteBase}/wa/kanca/${secret()}`, { method: "POST", headers: { "content-type": "application/json", "content-length": payload.length } }, res => {
    const parts = [];
    res.on("data", chunk => parts.push(chunk));
    res.on("end", () => resolve({ status: res.statusCode, text: Buffer.concat(parts).toString("utf8") }));
  });
  req.on("error", reject);
  req.end(payload);
});
const ts = String(Math.floor(Date.parse("2026-11-03T09:05:00+03:00") / 1000));
const statusEvent = statuses => ({ object: "whatsapp_business_account", entry: [{ id: WABA, changes: [{ field: "messages", value: { messaging_product: "whatsapp", metadata: { display_phone_number: "902125550102", phone_number_id: PNID }, statuses } }] }] });

// G0 — cariler programın kendi API'sinden.
const people = {};
for (const [key, name, phone, opening, extra] of [
  ["same1", SAME, "0532 100 00 01", 1000, {}],
  ["same2", SAME, "0532 100 00 02", 500, {}],
  ["shareA", "Ortak Telefon A", "0533 200 00 00", 250, {}],
  ["shareB", "Ortak Telefon B", "0533 200 00 00", 750, {}],
  ["nophone", "Telefonsuz Kişi", "", 100, {}],
  ["optout", "İstemiyor Kişi", "0534 300 00 00", 100, { waOptOut: true }],
  ["passive", "Pasif Kişi", "0535 400 00 00", 100, { status: "passive" }],
]) people[key] = await ctx.account(name, phone, opening, extra);
const db = sql => ctx.store.get(sql);
const all = sql => ctx.store.all(sql);

const browser = await chromium.launch();
let context = await browser.newContext({ viewport: { width: 1440, height: 1000 }, locale: "tr-TR" });
const initScript = () => {
  window.__wa = [];
  window.open = url => {
    window.__wa.push(String(url));
    return null;
  };
};
await context.addInitScript(initScript);
let page = await context.newPage();
const pageErrors = [];
page.on("pageerror", error => pageErrors.push(error.message));
page.setDefaultTimeout(20000);
const shot = (name, target = page) => target.screenshot({ path: path.join(shots, `gonder-248-${name}.png`), fullPage: true }).catch(() => null);
const step = async (title, fn) => {
  console.log(`\n■ ${title}`);
  try {
    await fn();
  } catch (error) {
    ok(false, `adım yarıda kaldı: ${String(error?.message || error).split("\n")[0]}`);
    await shot(`hata-${title.slice(0, 3).trim()}`);
  }
};
const note = line => appendFileSync(answersLog, `${new Date().toISOString()} ${line}\n`);
// Beklenen soru penceresi beklenir (if ile atlanmaz — ders 39) ve yanıt günlüğe yazılır (ders 34).
const answer = async (target, expectTitle, choice, why) => {
  await target.waitForSelector(`${TOP} [data-answer="${choice}"]`, { state: "visible" });
  const title = ((await target.textContent(`${TOP} .hof-modal-title`)) || "").trim();
  note(`soru: "${title}" → ${choice} (${why})`);
  ok(title === expectTitle, `soru penceresi "${expectTitle}" (görülen: ${title})`);
  await target.click(`${TOP} [data-answer="${choice}"]`);
  await target.waitForFunction(sel => !document.querySelector(`${sel} [data-answer]`), TOP);
};
const closeAll = async (target = page) => {
  for (let i = 0; i < 6 && (await target.$(MODAL)); i += 1) {
    await target.keyboard.press("Escape");
    await target.waitForTimeout(250);
    const discard = await target.$(`${TOP} [data-answer="discard"], ${TOP} [data-answer="no"]`);
    if (discard) {
      note("kapatırken soru çıktı → Vazgeç/Kaydetmeden Kapat (BEKLENMEYEN: bu pencerelerde kaydedilecek alan yok)");
      ok(false, "pencere kapatılırken beklenmeyen soru");
      await discard.click();
    }
  }
};
const login = async (target, username, password) => {
  await target.goto(`${ctx.server.base}/`);
  await target.fill("#hof-auth input[name=username]", username);
  await target.fill("#hof-auth input[name=password]", password);
  await Promise.all([target.waitForEvent("load"), target.click('#hof-auth button[type="submit"]')]);
  await target.waitForSelector("#hof-sidecard", { timeout: 60000 });
};
// Cari listesi → "Tümü" → başlıktaki kutu (süzgeçteki hepsi) → WhatsApp Ekstre / Mesaj.
const openWhatsapp = async (target = page, act = "waStatement") => {
  await closeAll(target);
  await target.click('#hof-sidecard [data-action="accounts"]');
  await target.waitForSelector(`${TOP} [data-status="all"]`);
  await target.click(`${TOP} [data-status="all"]`);
  await target.waitForFunction(sel => document.querySelectorAll(`${sel} tr[data-account]`).length >= 7, TOP);
  await target.click(`${TOP} input[data-select-all]`);
  await target.waitForSelector(`${TOP} [data-act="${act}"]`);
  await target.click(`${TOP} [data-act="${act}"]`);
  await target.waitForSelector(`${TOP} [data-wa-paths]:not([hidden]) [data-wa-path="api"], ${TOP} .hof-wa-head`);
};
const waitPreview = async (target = page) => {
  await target.waitForSelector(`${TOP} [data-wa-api] [data-wa-api-send]`, { state: "attached" });
  await target.waitForFunction(sel => {
    const box = document.querySelector(`${sel} [data-wa-api]`);
    return box && !box.querySelector("[data-wa-api-loading]") && !/Önizleme hazırlanıyor/.test(box.querySelector("[data-wa-api-why]")?.textContent || "");
  }, TOP);
  await target.waitForTimeout(150);
};
const count = async (key, target = page) => Number(((await target.textContent(`${TOP} [data-wa-api-count="${key}"] strong`)) || "").replace(/\./g, "").trim());
const skipCount = async (reason, target = page) => Number(((await target.textContent(`${TOP} [data-wa-api-skip="${reason}"] b`).catch(() => "")) || "").trim() || 0);
const why = async (target = page) => ((await target.textContent(`${TOP} [data-wa-api-why]`).catch(() => "")) || "").trim();
const sendDisabled = (target = page) => target.isDisabled(`${TOP} [data-wa-api-send]`);
const chip = async (state, target = page) => Number(((await target.textContent(`${TOP} [data-wa-count="${state}"] b`).catch(() => "")) || "0").trim() || 0);
const waitChip = (state, n, target = page) => target.waitForFunction(([sel, s, v]) => Number(document.querySelector(`${sel} [data-wa-count="${s}"] b`)?.textContent || 0) === v, [TOP, state, n], { timeout: 20000 });
const batchState = id => db(`SELECT state FROM wa_batches WHERE id = '${id}'`)?.state;

let batchId = "";
await step("Giriş", async () => {
  await login(page, "admin", ADMIN_PASSWORD);
  ok(true, "yönetici girdi");
});

await step("G1 Cari listesi → hepsini seç → WhatsApp Ekstre: iki yol, Otomatik Gönder seçili; önizleme sayıları; onaysız Gönder pasif + neden", async () => {
  await openWhatsapp();
  ok(await page.isVisible(`${TOP} [data-wa-path="api"]`) && await page.isVisible(`${TOP} [data-wa-path="manual"]`), "iki yol: Otomatik Gönder + WhatsApp Web ile Gönder");
  ok((await page.getAttribute(`${TOP} [data-wa-path="api"]`, "aria-selected")) === "true", "bağlı ve şablon hazır → Otomatik Gönder varsayılan");
  ok(((await page.textContent(`${TOP} .hof-modal-title`)) || "").trim() === "WhatsApp ile Otomatik Gönder", "pencere başlığı");
  await waitPreview();
  ok((await count("total")) === 7, `seçilen 7 (${await count("total")})`);
  ok((await count("sendable")) === 4, `gönderilecek 4: aynı adlı iki + aynı telefonlu iki (§7a 8) (${await count("sendable")})`);
  ok((await count("skipped")) === 3, `elenen 3 (${await count("skipped")})`);
  ok((await skipCount("Telefon yok")) === 1 && (await skipCount("WhatsApp Mesajı İstemiyor")) === 1 && (await skipCount("Pasif Cari")) === 1, "nedenler: Telefon yok 1, WhatsApp Mesajı İstemiyor 1, Pasif Cari 1");
  const sameRows = await page.$$eval(`${TOP} [data-wa-api-person]`, (rows, name) => rows.filter(row => row.cells[0].textContent.trim() === name).map(row => row.cells[1].textContent.trim()), SAME);
  ok(sameRows.length === 2 && sameRows.includes("…0001") && sameRows.includes("…0002"), `aynı adlı iki cari ayrı satırda, telefonun son haneleriyle (${sameRows.join(", ")})`);
  const cost = (await page.textContent(`${TOP} [data-wa-api-cost]`)) || "";
  ok(/0,0036 USD/.test(cost) && /4 ileti × 0,0009 USD/.test(cost), `tahmini ücret 4 × 0,0009 = 0,0036 USD (${cost.trim()})`);
  ok(/250 farklı kişi/.test((await page.textContent(`${TOP} [data-wa-api-limit]`)) || ""), "24 saatlik sınır 250 (TIER_250)");
  ok((await count("later")) === 0, "ertesi güne kalan 0");
  ok(await sendDisabled(), "onay işaretsiz: Gönder PASİF");
  ok(/onay kutusunu işaretleyin/.test(await why()) && /Aydınlatma metnimi okudum/.test(await why()), `nedeni görünür yazı: ${await why()}`);
  ok(await page.isVisible(`${TOP} [data-wa-api-notice]`), "Aydınlatma Metni bağlantısı (yönetici)");
  ok(db("SELECT COUNT(*) AS n FROM wa_batches").n === 0 && ctx.messages().length === 0, "önizleme: toplu iş yok, Meta'ya ileti yok");
  await shot("01-onizleme-onaysiz");
});

await step("G2 her seçenek: Ödeme Hatırlatma (gecikmiş borç yok → hepsi elenir, Gönder pasif + neden) ve Geçen Ay dönemi", async () => {
  await page.check(`${TOP} [data-wa-api-kind][value="reminder"]`);
  await waitPreview();
  ok((await count("sendable")) === 0, "Ödeme Hatırlatma: gönderilecek 0");
  ok((await skipCount("Gecikmiş Borç Yok")) === 4, `Gecikmiş Borç Yok 4 (${await skipCount("Gecikmiş Borç Yok")})`);
  ok(!(await page.$(`${TOP} [data-wa-api-preset]`)), "hatırlatmada dönem seçimi yok");
  ok(await sendDisabled(), "Gönder pasif");
  await shot("02-hatirlatma");
  await page.check(`${TOP} [data-wa-api-kind][value="statement"]`);
  await waitPreview();
  await page.selectOption(`${TOP} [data-wa-api-preset]`, "lastMonth");
  await waitPreview();
  ok(/01\.10\.2026 – 31\.10\.2026/.test((await page.textContent(`${TOP} [data-wa-api-period]`)) || ""), "Geçen Ay dönemi 01.10.2026 – 31.10.2026");
  ok((await count("sendable")) === 4, "Geçen Ay: gönderilecek 4");
  await page.selectOption(`${TOP} [data-wa-api-preset]`, "thisMonth");
  await waitPreview();
  ok(/01\.11\.2026 – 03\.11\.2026/.test((await page.textContent(`${TOP} [data-wa-api-period]`)) || ""), "Bu Ay dönemi 01.11.2026 – 03.11.2026");
});

await step("G3 onay Tab + Boşluk → Gönder (4 Kişi) → soru → toplu iş ekranı; veri tabanı 1 toplu iş, 7 iş", async () => {
  await page.focus(`${TOP} [data-wa-api-preset]`);
  let reached = false;
  for (let i = 0; i < 40 && !reached; i += 1) {
    await page.keyboard.press("Tab");
    await page.waitForTimeout(40);
    reached = await page.evaluate(() => document.activeElement?.matches?.("[data-wa-api-ack]"));
  }
  ok(reached, "onay kutusuna Tab ile gelindi");
  await page.keyboard.press("Space");
  await page.waitForFunction(sel => document.querySelector(`${sel} [data-wa-api-ack]`)?.checked && document.querySelector(`${sel} [data-wa-api-ack]`)?.disabled, TOP);
  await waitPreview();
  const ack = db("SELECT value FROM settings WHERE key = 'whatsapp.ack'");
  ok(Boolean(ack) && JSON.parse(ack.value).version === 1, "onay veri tabanında (whatsapp.ack)");
  ok(!(await sendDisabled()), "onaydan sonra Gönder etkin");
  ok(((await page.textContent(`${TOP} [data-wa-api-send]`)) || "").trim() === "Gönder (4 Kişi)", "düğme: Gönder (4 Kişi)");
  await shot("03-onayli");
  await page.click(`${TOP} [data-wa-api-send]`);
  await answer(page, "Gönderim Başlasın mı?", "yes", "beklenen tek başlatma onayı (plan §1)");
  await page.waitForSelector(`${TOP} [data-wa-batch]`);
  batchId = await page.getAttribute(`${TOP} [data-wa-batch]`, "data-wa-batch");
  ok(db("SELECT COUNT(*) AS n FROM wa_batches").n === 1, "veri tabanı: 1 toplu iş");
  const jobs = all(`SELECT state, COUNT(*) AS n FROM wa_jobs WHERE batch_id = '${batchId}' GROUP BY state`);
  const by = Object.fromEntries(jobs.map(row => [row.state, row.n]));
  ok(by.pending === 4 && by.skipped === 3, `veri tabanı: 4 bekliyor + 3 atlandı (${JSON.stringify(by)})`);
  ok((await chip("pending")) === 4 && (await chip("skipped")) === 3, "ekranda Bekliyor 4, Atlandı 3");
  ok(((await page.textContent(`${TOP} [data-wa-batch-state]`)) || "").trim() === "Sürüyor", "durum Sürüyor");
  ok(ctx.messages().length === 0, "işçi çalışmadan Meta'ya ileti yok");
  await shot("04-toplu-is-basladi");
});

await step("G4 Duraklat → Devam Et (veri tabanı); işçi → sahte Meta 4 ileti, ekranda Meta Kabul Etti 4", async () => {
  await page.click(`${TOP} [data-wa-api-act="pause"]`);
  await page.waitForFunction(sel => document.querySelector(`${sel} [data-wa-batch-state]`)?.textContent.trim() === "Duraklatıldı", TOP);
  ok(batchState(batchId) === "paused", "veri tabanı: paused");
  ok((await chip("paused")) === 4, "ekranda Duraklatıldı 4");
  await ctx.drain();
  ok(ctx.messages().length === 0, "duraklatılmış işten ileti gitmedi");
  await shot("05-duraklatildi");
  await page.click(`${TOP} [data-wa-api-act="resume"]`);
  await page.waitForFunction(sel => document.querySelector(`${sel} [data-wa-batch-state]`)?.textContent.trim() === "Sürüyor", TOP);
  ok(batchState(batchId) === "running", "veri tabanı: running");
  await ctx.drain();
  const sent = ctx.messages();
  ok(sent.length === 4, `sahte Meta: 4 ileti (${sent.length})`);
  const shared = sent.filter(item => item.to === "+905332000000");
  ok(shared.length === 2 && new Set(shared.map(item => item.document?.filename)).size === 2 && new Set(shared.map(item => item.document?.id)).size === 2, `aynı telefona iki ileti, iki ayrı PDF (${shared.map(item => item.document?.filename).join(" | ")})`);
  ok(sent.every(item => item.template === "destekofis_ekstre" && item.language === "tr"), "şablon destekofis_ekstre, dil tr");
  ok(!sent.some(item => ["+905343000000", "+905354000000"].includes(item.to)), "İstemiyor ve pasif cariye ileti yok");
  await waitChip("accepted", 4);
  ok((await chip("accepted")) === 4, "ekranda Meta Kabul Etti 4 (canlı olayla)");
  ok(((await page.textContent(`${TOP} [data-wa-batch-state]`)) || "").trim() === "Tamamlandı", "toplu iş Tamamlandı");
});

await step("G5 kanca (HTTP) → Teslim Edildi 2, Okundu 1, Başarısız 1 (neden); Bu Ay 3", async () => {
  const jobs = all(`SELECT account_id AS accountId, wamid FROM wa_jobs WHERE batch_id = '${batchId}' AND wamid IS NOT NULL AND wamid <> ''`);
  const wamid = key => jobs.find(job => job.accountId === people[key].id)?.wamid;
  const priced = { pricing: { billable: true, pricing_model: "PMP", category: "utility" } };
  const events = [
    { id: wamid("same1"), status: "delivered", timestamp: ts, ...priced },
    { id: wamid("same2"), status: "delivered", timestamp: ts, ...priced },
    { id: wamid("same2"), status: "read", timestamp: ts },
    { id: wamid("shareA"), status: "delivered", timestamp: ts, ...priced },
    { id: wamid("shareB"), status: "failed", timestamp: ts, errors: [{ code: 131026, title: "Message undeliverable" }] },
  ];
  const res = await hookPost(statusEvent(events));
  ok(res.status === 200, `kanca 200 (${res.status} ${res.text.slice(0, 80)})`);
  await waitChip("failed", 1);
  ok((await chip("delivered")) === 2 && (await chip("read")) === 1 && (await chip("failed")) === 1, `ekranda Teslim Edildi 2, Okundu 1, Başarısız 1`);
  const failedReason = await page.$eval(`${TOP} tr[data-wa-job-state="failed"] .hof-wa-api-reason`, node => node.textContent.trim());
  ok(/131026/.test(failedReason), `başarısızın nedeni satırda (${failedReason})`);
  ok(await page.isVisible(`${TOP} [data-wa-api-act="retry-failed"]`), "Başarısızları Yeniden Dene görünür");
  const stats = (await ctx.api.get(URLS.stats)).data.data;
  ok(stats.delivered === 3 && stats.billable === 3, `API: bu ay teslim 3, ücretli 3 (${stats.delivered}/${stats.billable})`);
  await shot("06-durumlar");
});

await step("G6 yenile → Gönderimler listesinden aynı toplu iş; ikinci sekmede süren işte 'Zaten Kuyrukta'", async () => {
  await page.reload();
  await page.waitForSelector("#hof-sidecard");
  await openWhatsapp();
  await waitPreview();
  ok(/3 teslim edildi/.test((await page.textContent(`${TOP} [data-wa-api-month]`)) || ""), "Gönderim Özeti: Bu Ay Gönderilen İleti Sayısı 3");
  await page.click(`${TOP} [data-wa-api-list]`);
  await page.waitForSelector(`${TOP} [data-wa-api-open="${batchId}"]`);
  ok(true, "Gönderimler listesinde toplu iş");
  await shot("07-gonderimler");
  await page.focus(`${TOP} [data-wa-api-open="${batchId}"]`);
  await page.keyboard.press("Enter");
  await page.waitForSelector(`${TOP} [data-wa-batch="${batchId}"]`);
  ok((await chip("delivered")) === 2 && (await chip("failed")) === 1, "yeniden açılınca durumlar sunucudan (Teslim 2, Başarısız 1)");
  await closeAll();
  // Yönetim → WhatsApp: Bu Ay kartı.
  const admin = await context.newPage();
  await admin.goto(`${ctx.server.base}/admin.html#whatsapp`);
  await admin.waitForSelector('[data-wa-month-fact="delivered"] dd');
  ok(((await admin.textContent('[data-wa-month-fact="delivered"] dd')) || "").trim() === "3", "Yönetim → WhatsApp: Teslim Edilen İleti 3");
  ok(/Meta faturası esastır/.test((await admin.textContent("[data-wa-month-note]")) || ""), "Meta faturasıyla karşılaştırma notu");
  ok(await admin.isChecked("[data-wa-ack]"), "Yönetim kartında onay işaretli");
  await shot("08-yonetim-bu-ay", admin);
  await admin.close();
});

let againBatch = "";
await step("G7 R3: aynı dönem yeniden → 3 kişiye daha önce gönderildi; varsayılan Bunları Çıkar (1); Yine de Gönder (4); iki sekme → Zaten Kuyrukta", async () => {
  await openWhatsapp();
  await waitPreview();
  const text = (await page.textContent(`${TOP} [data-wa-api-again]`)) || "";
  ok(/3 kişiye bu dönem daha önce gönderildi/.test(text), `R3 uyarısı (${text.trim().slice(0, 90)})`);
  ok(await page.isChecked(`${TOP} [data-wa-api-again-choice][value="skip"]`), "varsayılan Bunları Çıkar");
  ok((await count("sendable")) === 1 && (await skipCount("Daha Önce Gönderildi")) === 3, `gönderilecek 1 (başarısız olan), Daha Önce Gönderildi 3`);
  await shot("09-r3-uyari");
  await page.check(`${TOP} [data-wa-api-again-choice][value="send"]`);
  await waitPreview();
  ok((await count("sendable")) === 4, "Yine de Gönder → gönderilecek 4");
  await page.check(`${TOP} [data-wa-api-again-choice][value="skip"]`);
  await waitPreview();
  ok((await count("sendable")) === 1, "Bunları Çıkar'a dönünce 1");
  await page.click(`${TOP} [data-wa-api-send]`);
  await answer(page, "Gönderim Başlasın mı?", "yes", "R3 sonrası başlatma onayı");
  await page.waitForSelector(`${TOP} [data-wa-batch]`);
  againBatch = await page.getAttribute(`${TOP} [data-wa-batch]`, "data-wa-batch");
  ok(all(`SELECT account_id FROM wa_jobs WHERE batch_id = '${againBatch}' AND state = 'pending'`).map(row => row.account_id).join() === people.shareB.id, "yalnız başarısız olan (Ortak Telefon B) bekliyor");
  // İkinci sekme: bu iş sürerken aynı seçim → Ortak Telefon B "Zaten Kuyrukta" (§7a 9).
  const second = await context.newPage();
  await second.goto(`${ctx.server.base}/`);
  await second.waitForSelector("#hof-sidecard");
  await openWhatsapp(second);
  await waitPreview(second);
  ok((await skipCount("Zaten Kuyrukta", second)) === 1, `ikinci sekme: Zaten Kuyrukta 1 (${await skipCount("Zaten Kuyrukta", second)})`);
  ok((await count("sendable", second)) === 0, "ikinci sekme: gönderilecek 0, Gönder pasif");
  ok(await second.isVisible(`${TOP} [data-wa-api-active]`), "ikinci sekmede 'Süren gönderim var' notu");
  await shot("10-ikinci-sekme", second);
  await second.close();
  await ctx.drain();
  ok(ctx.messages().length === 5, `sahte Meta: toplam 5 ileti (${ctx.messages().length})`);
  await closeAll();
});

await step("G8 Bağlantı Bekleniyor (Meta'ya ulaşılamıyor) ve Sınır Nedeniyle Bekliyor ekranda açıkça", async () => {
  const fresh = [await ctx.account("Sınır Bir", "0536 500 00 01", 10), await ctx.account("Sınır İki", "0536 500 00 02", 10)];
  // Bağlantı Bekleniyor: toplu iş açıldıktan sonra Meta'ya hiç ulaşılamıyor (bağlantı reddi; açarken şablon Meta'dan okunur).
  const res = await ctx.batch({ kind: "statement", ids: [fresh[0].id], preset: "thisMonth", requestId: "w4-e2e-offline-01" });
  const offlineBatch = res.data.data?.batch?.id || "";
  ok(res.status === 200, `toplu iş açıldı (${res.status})`);
  ctx.fake.state.closeConnections = true;
  await ctx.fake.offline();
  try {
    await ctx.drain({ maintain: false });
  } finally {
    await ctx.fake.online();
  }
  await openWhatsapp();
  await waitPreview();
  await page.click(`${TOP} [data-wa-api-list]`);
  await page.click(`${TOP} [data-wa-api-open="${offlineBatch}"]`);
  await page.waitForSelector(`${TOP} [data-wa-batch="${offlineBatch}"]`);
  ok(((await page.textContent(`${TOP} [data-wa-batch-state]`)) || "").trim() === "Bağlantı Bekleniyor", "durum Bağlantı Bekleniyor");
  ok(/başarısız sayılmaz/.test((await page.textContent(`${TOP} [data-wa-api-offline]`)) || ""), "açıklama: iletiler başarısız sayılmaz, kendiliğinden sürer");
  ok(!(await page.$(`${TOP} [data-wa-api-act="resume"]`)), "Devam Et gerekmez (düğme yok)");
  await shot("11-baglanti-bekleniyor");
  ctx.clock.advance(5 * 60_000 + 1000);
  await ctx.drain();
  await waitChip("accepted", 1);
  ok(batchState(offlineBatch) === "done", "bağlantı dönünce gönderildi (done)");
  // Sınır Nedeniyle Bekliyor: elle günlük sınır, bu 24 saatte kullanılan farklı kişi sayısına eşit → yeni kişi bekler.
  const used = (await ctx.api.post(URLS.preview, { kind: "statement", ids: [fresh[1].id], preset: "thisMonth" })).data.data.limit.used;
  ok((await ctx.api.put(URLS.sending, { dailyCap: used })).status === 200, `elle günlük sınır ${used}`);
  const limited = (await ctx.batch({ kind: "statement", ids: [fresh[1].id], preset: "thisMonth", requestId: "w4-e2e-limit-01" })).data.data.batch.id;
  await ctx.drain();
  await page.click(`${TOP} [data-wa-api-list]`);
  await page.click(`${TOP} [data-wa-api-open="${limited}"]`);
  await page.waitForSelector(`${TOP} [data-wa-batch="${limited}"]`);
  await waitChip("limited", 1);
  ok(/Sınır Nedeniyle Bekliyor/.test((await page.textContent(`${TOP} [data-wa-api-limited]`)) || ""), "Sınır Nedeniyle Bekliyor açıklaması");
  await shot("12-sinir-bekliyor");
  await ctx.api.put(URLS.sending, { dailyCap: null });
  await closeAll();
});

// Kullanıcı isteği (31.10.2026 "şimdi yap"): Gönderimler listesi yalnız son 30'u gösteriyordu. Veri programın API'siyle üretilir; üç gönderim yerel 01.11'e (saat geri alınıp
// sonra eski yerine konur), kalanı bugüne açılır — toplam 30'u aşar.
await step("G8b Gönderimler: Daha Fazla Göster (klavye) satırı artırır, sonda düğme yok + neden; tarih süzgeci daraltır, boş gün ipucu, geçersiz aralıkta neden; Süzgeci Temizle", async () => {
  const rowsOf = () => page.$$eval(`${TOP} [data-wa-api-batches] tr[data-wa-api-open]`, rows => rows.length);
  const extra = await ctx.account("Liste Deneme", "0536 500 00 09", 10);
  const saved = ctx.clock();
  const open = async when => {
    if (when) ctx.clock.set(when);
    const res = await ctx.batch({ kind: "statement", ids: [extra.id], preset: "thisMonth", sendAgain: true });
    ok(res.status === 200, `toplu iş açıldı (${res.status})`);
    await ctx.drain();
  };
  try {
    for (let i = 0; i < 3; i += 1) await open(new Date(2026, 10, 1, 10, i, 0, 0));
  } finally {
    ctx.clock.set(saved);
  }
  const before = db("SELECT COUNT(*) AS n FROM wa_batches").n;
  for (let i = before; i < 36; i += 1) await open(null);
  const total = db("SELECT COUNT(*) AS n FROM wa_batches").n;
  ok(total >= 36 && total <= 60, `veri tabanı: ${total} gönderim (30'dan fazla)`);
  await openWhatsapp();
  await waitPreview();
  await page.click(`${TOP} [data-wa-api-list]`);
  await page.waitForFunction(sel => document.querySelectorAll(`${sel} [data-wa-api-batches] tr`).length > 0, TOP);
  ok((await rowsOf()) === 30, `ilk açılışta 30 satır (görülen ${await rowsOf()})`);
  ok(((await page.textContent(`${TOP} [data-wa-api-more]`)) || "").trim() === "Daha Fazla Göster", "Daha Fazla Göster düğmesi görünür");
  await shot("12b-liste-ilk-30");
  await page.focus(`${TOP} [data-wa-api-more]`);
  await page.keyboard.press("Enter");
  await page.waitForFunction(([sel, n]) => document.querySelectorAll(`${sel} [data-wa-api-batches] tr`).length === n, [TOP, total]);
  ok((await rowsOf()) === total, `Daha Fazla Göster (Enter) → ${total} satır`);
  ok(!(await page.$(`${TOP} [data-wa-api-more]`)), "daha eski yok → düğme görünmez");
  ok(((await page.textContent(`${TOP} [data-wa-api-list-end]`)) || "").trim() === "Bütün gönderimler gösteriliyor.", "düğmenin yokluğunun nedeni yazılı");
  // Dar kontrol 7 ORTA-2 (ders 12): Daha Fazla Göster'den sonra odak ilk YENİ satırda (31.) ve kutu ona kaymış; odak sayfaya düşmez.
  const focusInfo = () => page.evaluate(sel => {
    const a = document.activeElement;
    const rows = [...document.querySelectorAll(`${sel} [data-wa-api-batches] tr[data-wa-api-open]`)];
    const box = document.querySelector(`${sel} .hof-wa-list`);
    const r = a?.getBoundingClientRect?.();
    const b = box?.getBoundingClientRect();
    return { tag: a === document.body ? "BODY" : `${a?.tagName}${a?.getAttribute?.("name") ? `[name=${a.getAttribute("name")}]` : ""}`, row: rows.indexOf(a), value: a?.value ?? null, scroll: Math.round(box?.scrollTop || 0), visible: Boolean(r && b && r.top >= b.top - 1 && r.bottom <= b.bottom + 1) };
  }, TOP);
  const afterMore = await focusInfo();
  ok(afterMore.row === 30, `Daha Fazla Göster sonrası odak ilk yeni satırda (31.) (görülen ${JSON.stringify(afterMore)})`);
  ok(afterMore.scroll > 0 && afterMore.visible, `kutu ilk yeni satıra kaydı, satır görünür (görülen ${JSON.stringify(afterMore)})`);
  await page.keyboard.press("Tab");
  ok((await focusInfo()).row === 31, "Tab → sonraki satır (odak listede sürer)");
  // Canlı yenileme (arka planda yeni gönderim) kutu kaydırmasını ve odaktaki satırı korur.
  await page.$eval(`${TOP} .hof-wa-list`, el => { el.scrollTop = 200; });
  const focusedId = await page.evaluate(() => document.activeElement?.dataset?.waApiOpen || "");
  const liveList = page.waitForResponse(res => new URL(res.url()).pathname === "/api/workspace/whatsapp/batches" && res.request().method() === "GET", { timeout: 15000 });
  await open(null);
  await liveList;
  await page.waitForTimeout(400);
  const afterLive = await focusInfo();
  ok(afterLive.scroll === 200, `canlı yenileme kutu kaydırmasını korur (200 → ${afterLive.scroll})`);
  ok(await page.evaluate(id => document.activeElement?.dataset?.waApiOpen === id, focusedId), `canlı yenilemede odak aynı satırda kalır (görülen ${JSON.stringify(afterLive)})`);
  await shot("12b2-daha-fazla-odak");
  // Klavyeyle tarih yazımı insan hızında (ders 12): Chromium yılın her hanesinde "change" verir (0002, 0020 …); süzgeç yarım yılla uygulanmaz, odak alanda kalır.
  // Gün = ay seçilir (01.01.2026): alanın gün/ay sırası tarayıcı diline bağlı olsa da aynı değer çıkar.
  const listUrls = [];
  const onRequest = req => {
    const url = new URL(req.url());
    if (url.pathname === "/api/workspace/whatsapp/batches" && req.method() === "GET") listUrls.push(url.search);
  };
  page.on("request", onRequest);
  await page.focus(`${TOP} [data-wa-api-from]`);
  await page.keyboard.type("01012026", { delay: 120 });
  // Liste ya da (eski davranışta) neden gelene dek beklenir; denetim aşağıda.
  const settled = sel => document.querySelectorAll(`${sel} [data-wa-api-batches] tr`).length > 0 || Boolean(document.querySelector(`${sel} [data-wa-api-list-error]`));
  await page.waitForFunction(settled, TOP);
  await page.waitForTimeout(300);
  const typedFrom = await focusInfo();
  ok(typedFrom.tag === "INPUT[name=waListFrom]" && typedFrom.value === "2026-01-01", `Başlangıç'a klavyeyle 01.01.2026: değer tam, odak alanda (görülen ${JSON.stringify(typedFrom)})`);
  ok(listUrls.length > 0 && listUrls.every(q => /from=2026-01-01/.test(q)), `yarım yılla (0002 …) liste isteği gitmedi (istekler ${JSON.stringify(listUrls)})`);
  ok(!(await page.$(`${TOP} [data-wa-api-list-error]`)), "geçersiz tarih nedeni çıkmadı (süzgeç tam tarihle uygulandı)");
  // Süren gönderim sırasında (canlı yenilemeler) Bitiş'e insan hızında yazım: değer ve odak kaybolmaz.
  listUrls.length = 0;
  let pumping = true;
  const pumpErrors = [];
  const pump = (async () => {
    let n = 0;
    while (pumping) {
      // Sessiz açılış: geçen denetim sayısı koşudan koşuya değişmesin (yazım süresine bağlı); hatalar aşağıda tek denetimde.
      const res = await ctx.batch({ kind: "statement", ids: [extra.id], preset: "thisMonth", sendAgain: true });
      if (res.status !== 200) pumpErrors.push(res.status);
      await ctx.drain();
      n += 1;
      await new Promise(resolve => setTimeout(resolve, 500));
    }
    return n;
  })();
  await page.focus(`${TOP} [data-wa-api-to]`);
  await page.keyboard.type("12122026", { delay: 150 });
  await page.waitForTimeout(300);
  pumping = false;
  const pumped = await pump;
  ok(pumpErrors.length === 0, `arka plan gönderimleri açıldı (hatalar ${JSON.stringify(pumpErrors)})`);
  await page.waitForFunction(settled, TOP);
  const typedTo = await focusInfo();
  const liveWhileTyping = listUrls.filter(q => !/to=/.test(q)).length;
  ok(pumped >= 2 && liveWhileTyping >= 1, `ön koşul: yazım sırasında arka planda ${pumped} gönderim, ${liveWhileTyping} canlı yenileme (istekler ${JSON.stringify(listUrls)})`);
  ok(typedTo.tag === "INPUT[name=waListTo]" && typedTo.value === "2026-12-12", `süren gönderimde Bitiş'e klavyeyle 12.12.2026: değer tam, odak alanda (görülen ${JSON.stringify(typedTo)})`);
  ok(listUrls.some(q => /from=2026-01-01/.test(q) && /to=2026-12-12/.test(q)) && !listUrls.some(q => /to=0/.test(q)), "Bitiş yalnız tam tarihle uygulandı");
  page.off("request", onRequest);
  await shot("12b3-klavye-tarih");
  await page.fill(`${TOP} [data-wa-api-from]`, "2026-11-01");
  await page.waitForFunction(sel => document.querySelector(`${sel} [data-wa-api-from]`)?.value === "2026-11-01" && document.querySelectorAll(`${sel} [data-wa-api-batches] tr`).length > 0, TOP);
  await page.fill(`${TOP} [data-wa-api-to]`, "2026-11-01");
  await page.waitForFunction(sel => document.querySelectorAll(`${sel} [data-wa-api-batches] tr`).length === 3, TOP);
  ok((await rowsOf()) === 3, "Başlangıç = Bitiş = 01.11 → 3 satır (süzgeç daraltır)");
  ok(/Bu tarihlerdeki bütün gönderimler gösteriliyor\./.test((await page.textContent(`${TOP} [data-wa-api-list-end]`)) || ""), "süzgeçli sonda neden");
  await shot("12c-liste-tarih-suzgeci");
  await page.fill(`${TOP} [data-wa-api-from]`, "2026-11-02");
  await page.waitForSelector(`${TOP} [data-wa-api-list-error]`);
  ok(((await page.textContent(`${TOP} [data-wa-api-list-error]`)) || "").trim() === "Başlangıç tarihi Bitiş tarihinden sonra olamaz.", "geçersiz aralık: sunucunun nedeni listede");
  await page.fill(`${TOP} [data-wa-api-from]`, "2026-10-15");
  await page.fill(`${TOP} [data-wa-api-to]`, "2026-10-15");
  await page.waitForFunction(sel => /Bu tarihlerde gönderim yok\./.test(document.querySelector(`${sel} [data-wa-api-batches-empty]`)?.textContent || ""), TOP);
  ok(true, "gönderimsiz gün: \"Bu tarihlerde gönderim yok.\"");
  await page.click(`${TOP} [data-wa-api-filter-clear]`);
  await page.waitForFunction(sel => document.querySelectorAll(`${sel} [data-wa-api-batches] tr`).length === 30, TOP);
  ok((await rowsOf()) === 30 && (await page.inputValue(`${TOP} [data-wa-api-from]`)) === "", "Süzgeci Temizle → baştan 30 satır, alanlar boş");
  ok((await focusInfo()).tag === "INPUT[name=waListFrom]", "Süzgeci Temizle'den sonra odak Başlangıç'ta (düğme kalktı, odak sayfaya düşmez)");
  await closeAll();
});

// Dar kontrol 8 DÜŞÜK-2/3/4 (ders 12, 20): gerçek fare / klavye, insan hızında; ön koşullar (süren istek) yol üzerinde geciktirilip SAYILARAK oluşturulur.
//   (a) canlı yenileme isteği sürerken Daha Fazla Göster (Enter ve fare) yutulmaz; (b) Daha Fazla Göster yüklenirken düğme odakta kalır (aria-disabled, "Yükleniyor…"),
//   ikinci basış ikinci istek açmaz; (c) yarım tarihle Süzgeci Temizle'ye / bir satıra fareyle basış kaybolmaz; (d) yarım tarih Tab ile ve Enter ile uygulanır.
await step("G8c Gönderimler: süren yenilemede Daha Fazla Göster, yüklenirken odak ve çift basış, yarım tarihle Süzgeci Temizle / satır, Tab ve Enter", async () => {
  const rowsOf = () => page.$$eval(`${TOP} [data-wa-api-batches] tr[data-wa-api-open]`, rows => rows.length);
  const extra = db("SELECT id FROM accounts WHERE name = 'Liste Deneme'")?.id || (await ctx.account("Liste Deneme", "0536 500 00 09", 10)).id;
  const open = async () => {
    const res = await ctx.batch({ kind: "statement", ids: [extra], preset: "thisMonth", sendAgain: true });
    if (res.status !== 200) throw new Error(`toplu iş açılamadı: ${res.status} ${JSON.stringify(res.data)}`);
    await ctx.drain();
  };
  while (db("SELECT COUNT(*) AS n FROM wa_batches").n < 100) await open();
  ok(db("SELECT COUNT(*) AS n FROM wa_batches").n === 100, "veri tabanı: 100 gönderim (üç sayfadan fazla)");
  const focused = () => page.evaluate(sel => {
    const a = document.activeElement;
    const rows = [...document.querySelectorAll(`${sel} [data-wa-api-batches] tr[data-wa-api-open]`)];
    return { tag: a === document.body ? "BODY" : `${a?.tagName}${a?.getAttribute?.("name") ? `[name=${a.getAttribute("name")}]` : ""}`, row: rows.indexOf(a), aria: a?.getAttribute?.("aria-disabled") || "", text: (a?.textContent || "").trim().slice(0, 40), value: a?.value ?? null };
  }, TOP);
  const delay = { keep: 0, append: 0 };
  const inFlight = { keep: 0, append: 0 };
  const listReqs = [];
  let onKeep = null; // canlı yenileme isteği yol üzerinde bekletilmeye başladı
  const handler = async route => {
    if (route.request().method() !== "GET") return route.continue();
    const kind = new URL(route.request().url()).searchParams.has("before") ? "append" : "keep";
    listReqs.push({ kind, search: new URL(route.request().url()).search });
    inFlight[kind] += 1;
    if (kind === "keep") onKeep?.();
    try {
      if (delay[kind]) await page.waitForTimeout(delay[kind]);
      await route.continue();
    } finally {
      inFlight[kind] -= 1;
    }
  };
  const isList = url => url.pathname === "/api/workspace/whatsapp/batches";
  await page.route(isList, handler);
  try {
    await openWhatsapp();
    await waitPreview();
    await page.click(`${TOP} [data-wa-api-list]`);
    await page.waitForFunction(sel => document.querySelectorAll(`${sel} [data-wa-api-batches] tr`).length === 30, TOP);
    ok((await rowsOf()) === 30, "ilk açılışta 30 satır");
    // Satır sayısı n'ye ulaşıp düğme yüklemeden çıkana dek (en çok 10 sn); ulaşmazsa denetim aşağıda görülen sayıyla kırmızı.
    const settled = n => page.waitForFunction(([sel, want]) => document.querySelectorAll(`${sel} [data-wa-api-batches] tr`).length === want && !document.querySelector(`${sel} [data-wa-api-more][aria-disabled]`), [TOP, n], { timeout: 10000 });
    const liveStarted = () => Promise.race([new Promise(resolve => { onKeep = resolve; }), page.waitForTimeout(15000)]).finally(() => { onKeep = null; });
    // (a) Enter: canlı yenileme isteği 1,5 sn gecikir; o sürerken Daha Fazla Göster'de Enter.
    delay.keep = 1500;
    await page.focus(`${TOP} [data-wa-api-more]`);
    let started = liveStarted();
    await open();
    await started;
    ok(inFlight.keep === 1, `ön koşul: canlı yenileme isteği sürüyor (süren ${inFlight.keep})`);
    const appendsC1 = listReqs.filter(item => item.kind === "append").length;
    await page.keyboard.press("Enter");
    await page.waitForTimeout(150);
    const during = await focused();
    ok(during.text === "Yükleniyor…" && during.aria === "true", `yenileme sürerken basılan Daha Fazla Göster "Yükleniyor…" gösterir, odakta (görülen ${JSON.stringify(during)})`);
    // Yenileme hâlâ sürerken ikinci Enter (çift basış): yenileme bitince TEK sayfa eklenir.
    await page.keyboard.press("Enter");
    await settled(60).catch(() => null);
    ok((await rowsOf()) === 60, `canlı yenileme sürerken Enter yutulmadı → 60 satır (görülen ${await rowsOf()})`);
    const doubleC1 = listReqs.filter(item => item.kind === "append").length - appendsC1;
    ok(doubleC1 === 1, `yenileme sürerken iki Enter → tek Daha Fazla Göster isteği (görülen ${doubleC1})`);
    // (a) fare: aynı ön koşul, gerçek tıklama.
    started = liveStarted();
    await open();
    await started;
    ok(inFlight.keep === 1, `ön koşul: canlı yenileme isteği sürüyor (fare; süren ${inFlight.keep})`);
    await page.click(`${TOP} [data-wa-api-more]`);
    await settled(90).catch(() => null);
    ok((await rowsOf()) === 90, `canlı yenileme sürerken fareyle basış yutulmadı → 90 satır (görülen ${await rowsOf()})`);
    delay.keep = 0;
    // (b) Daha Fazla Göster'in kendi isteği 1,5 sn gecikir: odak düğmede (aria-disabled, "Yükleniyor…"), ikinci Enter ikinci istek açmaz.
    delay.append = 1500;
    const total = db("SELECT COUNT(*) AS n FROM wa_batches").n;
    const appendsBefore = listReqs.filter(item => item.kind === "append").length;
    await page.focus(`${TOP} [data-wa-api-more]`);
    await page.keyboard.press("Enter");
    await page.waitForTimeout(200);
    const loading = await focused();
    ok(inFlight.append === 1, `ön koşul: Daha Fazla Göster isteği sürüyor (süren ${inFlight.append})`);
    ok(loading.tag === "BUTTON[name=waListMore]" && loading.aria === "true" && loading.text === "Yükleniyor…", `yüklenirken odak düğmede, aria-disabled + "Yükleniyor…" (görülen ${JSON.stringify(loading)})`);
    await page.keyboard.press("Enter");
    await settled(total).catch(() => null);
    ok((await rowsOf()) === total, `sonda ${total} satır (görülen ${await rowsOf()})`);
    const appends = listReqs.filter(item => item.kind === "append").length - appendsBefore;
    ok(appends === 1, `yüklenirken ikinci Enter ikinci istek açmadı (Daha Fazla Göster isteği ${appends})`);
    ok((await focused()).row === 90, `yükleme bitince odak ilk yeni satırda (91.) (görülen ${JSON.stringify(await focused())})`);
    delay.append = 0;
    // (c) Süzgeci Temizle görünür olsun: Bitiş tam tarihle (31.12.2026) uygulanır.
    await page.fill(`${TOP} [data-wa-api-to]`, "2026-12-31");
    await page.waitForSelector(`${TOP} [data-wa-api-filter-clear]`);
    await page.waitForFunction(sel => document.querySelectorAll(`${sel} [data-wa-api-batches] tr`).length === 30, TOP);
    // Başlangıç'a insan hızında YARIM tarih (01.01.000 2 → yıl 0002), sonra fareyle Süzgeci Temizle.
    await page.focus(`${TOP} [data-wa-api-from]`);
    await page.keyboard.type("01012", { delay: 120 });
    await page.waitForTimeout(300);
    const half = await page.inputValue(`${TOP} [data-wa-api-from]`);
    ok(/^000\d-01-01$/.test(half), `ön koşul: Başlangıç'ta yarım yıl (görülen ${half})`);
    await page.click(`${TOP} [data-wa-api-filter-clear]`);
    await page.waitForTimeout(600);
    const cleared = { from: await page.inputValue(`${TOP} [data-wa-api-from]`), to: await page.inputValue(`${TOP} [data-wa-api-to]`), button: Boolean(await page.$(`${TOP} [data-wa-api-filter-clear]`)) };
    ok(cleared.from === "" && cleared.to === "" && !cleared.button, `yarım tarihle Süzgeci Temizle'ye fareyle basış kaybolmadı: alanlar boş, düğme kalktı (görülen ${JSON.stringify(cleared)})`);
    await page.waitForFunction(sel => document.querySelectorAll(`${sel} [data-wa-api-batches] tr`).length === 30, TOP).catch(() => null);
    ok((await rowsOf()) === 30, "Süzgeci Temizle → baştan 30 satır");
    // (d) Tab: Bitiş'e yarım tarih (01.01.0020) + Tab → yarım değer uygulanır (sunucu bu aralıkta gönderim bulmaz ya da nedenini söyler).
    const tabFrom = listReqs.length;
    await page.focus(`${TOP} [data-wa-api-to]`);
    await page.keyboard.type("010120", { delay: 120 });
    await page.waitForTimeout(300);
    ok(!listReqs.slice(tabFrom).some(item => /to=0/.test(item.search)), "ön koşul: yarım yılla yazarken istek gitmedi");
    // Chromium'da Tab önce tarih alanının kendi bölümlerinde ilerler; odak alandan çıkana dek (en çok 3).
    for (let i = 0; i < 3 && (await focused()).tag === "INPUT[name=waListTo]"; i += 1) await page.keyboard.press("Tab");
    await page.waitForTimeout(800);
    ok(listReqs.slice(tabFrom).some(item => /to=0020-01-01/.test(item.search)), `Tab ile alandan çıkınca yarım tarih uygulandı (istekler ${JSON.stringify(listReqs.slice(tabFrom).map(item => item.search))})`);
    ok((await rowsOf()) === 0, `Tab sonrası liste yarım tarihe göre (görülen ${await rowsOf()} satır)`);
    // (d) Enter: süzgeç temizlenir, aynı yarım tarih Enter ile.
    await page.click(`${TOP} [data-wa-api-filter-clear]`);
    await page.waitForFunction(sel => document.querySelectorAll(`${sel} [data-wa-api-batches] tr`).length === 30, TOP);
    const enterFrom = listReqs.length;
    await page.focus(`${TOP} [data-wa-api-to]`);
    await page.keyboard.type("010120", { delay: 120 });
    await page.waitForTimeout(300);
    await page.keyboard.press("Enter");
    await page.waitForTimeout(800);
    const enterFocus = await focused();
    ok(listReqs.slice(enterFrom).some(item => /to=0020-01-01/.test(item.search)) && (await rowsOf()) === 0, `Enter ile yarım tarih uygulandı (istekler ${JSON.stringify(listReqs.slice(enterFrom).map(item => item.search))}, ${await rowsOf()} satır)`);
    ok(enterFocus.tag === "INPUT[name=waListTo]", `Enter'dan sonra odak Bitiş'te (görülen ${JSON.stringify(enterFocus)})`);
    // (c) satır: süzgeç temizlenir, Başlangıç'a yarım tarih, fareyle ilk satıra basış → o gönderim açılır.
    await page.click(`${TOP} [data-wa-api-filter-clear]`);
    await page.waitForFunction(sel => document.querySelectorAll(`${sel} [data-wa-api-batches] tr`).length === 30, TOP);
    const firstId = await page.getAttribute(`${TOP} [data-wa-api-batches] tr[data-wa-api-open]`, "data-wa-api-open");
    await page.focus(`${TOP} [data-wa-api-from]`);
    await page.keyboard.type("01012", { delay: 120 });
    await page.waitForTimeout(300);
    await page.click(`${TOP} [data-wa-api-batches] tr[data-wa-api-open] td`);
    const opened = await page.waitForSelector(`${TOP} [data-wa-batch="${firstId}"]`, { timeout: 5000 }).then(() => true, () => false);
    ok(opened, `yarım tarihle satıra fareyle basış kaybolmadı: gönderim ${firstId} açıldı`);
    await shot("12d-liste-basislar");
  } finally {
    await page.unroute(isList, handler);
  }
  await closeAll();
});

await step("G8d şirket dosyası başka programda kilitli: süren gönderimde neden ve listede etiket; kilit kalkınca kalkar, iş gider", async () => {
  const person = await ctx.account("Kilit Kişi", "0536 600 00 01", 10);
  const created = await ctx.batch({ kind: "statement", ids: [person.id], preset: "thisMonth", requestId: "p2-e2e-kilit-01" });
  ok(created.status === 200, `toplu iş açıldı (${created.status})`);
  const lockedBatch = created.data.data?.batch?.id || "";
  const sentBefore = ctx.messages().length;
  await openWhatsapp();
  await waitPreview();
  await page.click(`${TOP} [data-wa-api-list]`);
  await page.click(`${TOP} [data-wa-api-open="${lockedBatch}"]`);
  await page.waitForSelector(`${TOP} [data-wa-batch="${lockedBatch}"]`);
  ok(!(await page.$(`${TOP} [data-wa-api-lock]`)), "kilitsizde not yok");
  const { DatabaseSync } = await import("node:sqlite");
  let lock = new DatabaseSync(ctx.server.app.config.dbPath);
  try {
    lock.exec("PRAGMA busy_timeout = 1000; BEGIN EXCLUSIVE");
    await ctx.wa.scheduler.runOnce();
    ok(ctx.messages().length === sentBefore, "kilitte ileti gitmedi");
    const shown = await page.waitForSelector(`${TOP} [data-wa-api-lock]`, { timeout: 15000 }).then(() => true, () => false);
    const text = ((await page.textContent(`${TOP} [data-wa-api-lock]`).catch(() => "")) || "").replace(/\s+/g, " ").trim();
    ok(shown && text === "Bekliyor: Şirket dosyası başka bir program tarafından kullanılıyor; gönderim bekliyor.", `ekranda neden (görülen: ${text})`);
    await shot("12e-kilit-bekliyor");
    await page.click(`${TOP} [data-wa-api-list]`);
    const tagged = await page.waitForSelector(`${TOP} tr[data-wa-api-open="${lockedBatch}"] [data-wa-api-lock-tag]`, { timeout: 15000 }).then(() => true, () => false);
    ok(tagged && ((await page.textContent(`${TOP} tr[data-wa-api-open="${lockedBatch}"] [data-wa-api-lock-tag]`)) || "").trim() === "Dosya Kullanımda", "listede Dosya Kullanımda etiketi");
    const others = await page.$$eval(`${TOP} [data-wa-api-lock-tag]`, nodes => nodes.length);
    ok(others === 1, `etiket yalnız süren gönderimde (${others})`);
    await shot("12f-kilit-liste");
    lock.exec("ROLLBACK");
    lock.close();
    lock = null;
    await page.waitForTimeout(2_200); // işaret süresi (2 sn) dolsun
    await ctx.wa.scheduler.runOnce();
    const gone = await page.waitForFunction(sel => !document.querySelector(`${sel} [data-wa-api-lock-tag]`), TOP, { timeout: 15000 }).then(() => true, () => false);
    ok(gone, "kilit kalkınca listedeki etiket kalktı (canlı olay)");
    await ctx.drain();
    ok(batchState(lockedBatch) === "done" && ctx.messages().length === sentBefore + 1, `kilit kalkınca iş gitti, tek ileti (${batchState(lockedBatch)}, ${ctx.messages().length - sentBefore})`);
    await page.click(`${TOP} [data-wa-api-open="${lockedBatch}"]`);
    await page.waitForSelector(`${TOP} [data-wa-batch="${lockedBatch}"]`);
    await waitChip("accepted", 1);
    ok(!(await page.$(`${TOP} [data-wa-api-lock]`)), "gönderim ekranında not yok");
  } finally {
    try {
      lock?.exec("ROLLBACK");
      lock?.close();
    } catch {
      // kilit zaten kalktı
    }
  }
  await closeAll();
});

await step("G8e makine defteri başka programda kilitli: süren gönderimde defter cümlesi ve listede etiket; kilit kalkınca kalkar", async () => {
  const person = await ctx.account("Defter Kilidi Kişi", "0536 600 00 02", 10);
  const created = await ctx.batch({ kind: "statement", ids: [person.id], preset: "thisMonth", requestId: "r3-e2e-defter-01" });
  ok(created.status === 200, `toplu iş açıldı (${created.status})`);
  const ledgerBatch = created.data.data?.batch?.id || "";
  const sentBefore = ctx.messages().length;
  await openWhatsapp();
  await waitPreview();
  await page.click(`${TOP} [data-wa-api-list]`);
  await page.click(`${TOP} [data-wa-api-open="${ledgerBatch}"]`);
  await page.waitForSelector(`${TOP} [data-wa-batch="${ledgerBatch}"]`);
  const { DatabaseSync } = await import("node:sqlite");
  let lock = new DatabaseSync(ctx.wa.ledger.file);
  try {
    lock.exec("PRAGMA busy_timeout = 1000; BEGIN EXCLUSIVE");
    await ctx.wa.scheduler.runOnce();
    ok(ctx.messages().length === sentBefore, "defter kilitliyken ileti gitmedi");
    const shown = await page.waitForSelector(`${TOP} [data-wa-api-lock]`, { timeout: 15000 }).then(() => true, () => false);
    const text = ((await page.textContent(`${TOP} [data-wa-api-lock]`).catch(() => "")) || "").replace(/\s+/g, " ").trim();
    ok(shown && text === "Bekliyor: WhatsApp gönderim defteri başka bir program tarafından kullanılıyor; gönderim bekliyor.", `ekranda defter cümlesi (görülen: ${text})`);
    await shot("12g-defter-kilidi");
    await page.click(`${TOP} [data-wa-api-list]`);
    const tagged = await page.waitForSelector(`${TOP} tr[data-wa-api-open="${ledgerBatch}"] [data-wa-api-lock-tag]`, { timeout: 15000 }).then(() => true, () => false);
    ok(tagged, "listede Dosya Kullanımda etiketi");
    lock.exec("ROLLBACK");
    lock.close();
    lock = null;
    await page.waitForTimeout(2_200);
    await ctx.wa.scheduler.runOnce();
    const gone = await page.waitForFunction(sel => !document.querySelector(`${sel} [data-wa-api-lock-tag]`), TOP, { timeout: 15000 }).then(() => true, () => false);
    ok(gone, "kilit kalkınca etiket kalktı");
    await ctx.drain();
    ok(ctx.messages().length === sentBefore + 1, `kilit kalkınca tek ileti (${ctx.messages().length - sentBefore})`);
  } finally {
    try {
      lock?.exec("ROLLBACK");
      lock?.close();
    } catch {
      // kilit zaten kalktı
    }
  }
  await closeAll();
});

await step("G9 WhatsApp Web ile Gönder (wa.me) bağlantı varken de çalışır", async () => {
  const before = db("SELECT COUNT(*) AS n FROM message_sends WHERE status = 'sent'").n;
  await openWhatsapp();
  await page.click(`${TOP} [data-wa-path="manual"]`);
  await page.waitForSelector(`${TOP} [data-wa] .hof-wa-head`);
  ok(((await page.textContent(`${TOP} .hof-modal-title`)) || "").trim() === "WhatsApp ile Ekstre Gönder", "başlık bugünkü (WhatsApp ile Ekstre Gönder)");
  ok(await page.isHidden(`${TOP} [data-wa-api]`), "otomatik panel gizli");
  await shot("13-whatsapp-web");
  // Yalnız bir kişi: hepsinin işaretini kaldır, ilk geçerli kişiyi seç.
  await page.click(`${TOP} [data-wa] [data-pick-all]`);
  await page.waitForFunction(sel => !document.querySelector(`${sel} [data-wa] [data-pick]:checked`), TOP);
  await page.check(`${TOP} [data-wa] [data-pick="${people.same1.id}"]`);
  await page.waitForFunction(sel => /Gönderime Başla \(1 Kişi\)/.test(document.querySelector(`${sel} [data-start]`)?.textContent || ""), TOP);
  await page.click(`${TOP} [data-start]`);
  await page.waitForSelector(`${TOP} [data-send]`);
  await page.click(`${TOP} [data-send]`);
  await page.waitForSelector(`${TOP} .hof-wa-done`);
  const urls = await page.evaluate(() => window.__wa);
  ok(urls.some(url => url.startsWith("https://wa.me/905321000001?text=")), "wa.me adresi açıldı (905321000001)");
  await page.waitForTimeout(400);
  ok(db("SELECT COUNT(*) AS n FROM message_sends WHERE status = 'sent'").n === before + 1, "cari kartına kayıt (message_sends +1)");
  await closeAll();
});

await step("G10 yetkisiz (Personel): Otomatik Gönder sekmesinde neden, Gönder pasif; API 403", async () => {
  const staffApi = await createUser(ctx.server, ctx.api, { ...STAFF, role: "personel" });
  const staffContext = await browser.newContext({ viewport: { width: 1366, height: 900 }, locale: "tr-TR" });
  await staffContext.addInitScript(initScript);
  const staff = await staffContext.newPage();
  await login(staff, STAFF.username, STAFF.password);
  await openWhatsapp(staff);
  ok((await staff.getAttribute(`${TOP} [data-wa-path="manual"]`, "aria-selected")) === "true", "yetkisiz: WhatsApp Web ile Gönder varsayılan");
  ok(/yetkiniz yok/.test((await staff.textContent(`${TOP} [data-wa-path="api"] small`)) || ""), "sekmede neden: yetkiniz yok");
  await staff.click(`${TOP} [data-wa-path="api"]`);
  await staff.waitForSelector(`${TOP} [data-wa-api-send]`);
  ok(await staff.isDisabled(`${TOP} [data-wa-api-send]`), "Gönder pasif");
  ok(/yetkiniz yok/.test(await why(staff)), `neden görünür: ${await why(staff)}`);
  await shot("14-yetkisiz", staff);
  const res = await staffApi.post(URLS.batches, { kind: "statement", ids: [people.same1.id], preset: "thisMonth" });
  ok(res.status === 403, `API: personel toplu iş 403 (${res.status})`);
  await staffContext.close();
});

await step("G11 dar pencere (760 px): yatay taşma yok", async () => {
  await page.setViewportSize({ width: 760, height: 900 });
  await openWhatsapp();
  await waitPreview();
  const overflow = await page.$eval(`${TOP} .hof-modal`, node => node.scrollWidth - node.clientWidth);
  ok(overflow <= 1, `pencerede yatay taşma yok (${overflow} px)`);
  await shot("15-dar-pencere");
  await closeAll();
  await page.setViewportSize({ width: 1440, height: 1000 });
});

await step("G12 salt okunur lisans: Otomatik Gönder'de neden, Gönder pasif; yeni toplu iş yok", async () => {
  const batches = db("SELECT COUNT(*) AS n FROM wa_batches").n;
  await context.close();
  await ctx.close().catch(() => {});
  ctx = await startWa({ dataDir, connect: false, ack: false, office: null, license: { enforce: true, machineId: "0123456789abcdef0123456789abcdef", services: ["https://lisans.test/api/lisans"], fetchImpl: async () => { throw new TypeError("fetch failed"); }, firstCheckDelayMs: 3_600_000 } });
  context = await browser.newContext({ viewport: { width: 1440, height: 1000 }, locale: "tr-TR" });
  await context.addInitScript(initScript);
  page = await context.newPage();
  page.on("pageerror", error => pageErrors.push(error.message));
  page.setDefaultTimeout(20000);
  await login(page, "admin", ADMIN_PASSWORD);
  // Lisans açıklaması açılışta kendiliğinden çıkar (hof-license.js, 1,2 sn): beklenen bilgi penceresi, kapatılır.
  await page.waitForTimeout(1800);
  if (await page.$(MODAL)) note("salt okunur açılışında lisans açıklama penceresi (beklenen) → Esc");
  await closeAll();
  await openWhatsapp();
  ok((await page.getAttribute(`${TOP} [data-wa-path="manual"]`, "aria-selected")) === "true", "salt okunur: WhatsApp Web ile Gönder varsayılan");
  await page.click(`${TOP} [data-wa-path="api"]`);
  await page.waitForSelector(`${TOP} [data-wa-api-send]`);
  ok(await page.isDisabled(`${TOP} [data-wa-api-send]`), "Gönder pasif");
  ok(/salt okunur/.test(await why()), `neden görünür: ${await why()}`);
  await shot("16-salt-okunur");
  ok(ctx.store.get("SELECT COUNT(*) AS n FROM wa_batches").n === batches, "yeni toplu iş yok");
  await closeAll();
});

ok(pageErrors.length === 0, `sayfa hatası yok${pageErrors.length ? `: ${pageErrors.slice(0, 3).join(" | ")}` : ""}`);
await browser.close();
await ctx.close().catch(() => {});
removeTestDir(root);
console.log(`\n${passed} geçti, ${failed} kaldı`);
process.exit(failed ? 1 : 0);
