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

let ctx = await startWa({ dataDir, ack: false });
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
