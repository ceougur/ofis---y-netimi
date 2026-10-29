// 2.4.6 madde 4 EKRANDAN — Maliyet Hesap Kartı (docs/2.4.6-IS-LISTESI.md; kullanıcı kararları 24–25.10.2026). Sıfırdan, arayüzden, insan hızında:
//   M1 sektör "Genel" iken Stok penceresinde "Maliyet Hesap Kartı" girişi YOK (API durum acik=false).
//   M2 Ayarlar → Sektörü Değiştir → "Duşakabin Üretimi" → giriş VAR.
//   M3 kartı aç: üstte 4 sekme düğmesi (sunucu sırasıyla), kartlar, ipucu / yardım satırı yok, yazım düzeni (HOF.titleCase).
//   M4 miktar / fiyat insan hızında + Tab ("2,5", "1.250,75" — Türkçe sayı, binlik) → canlı hesap (kâhin: Excel kalıbı elle; ham değer data-deger) — henüz kaydedilmedi (veri tabanı).
//   M5 ✎ kart adı, ✎ malzeme adı; M6 satır ekle (ad, birim, miktar, fiyat) / satır sil.
//   M7 Kaydet → veri tabanında aynı değerler; M8 değişiklik yokken Esc → soru YOK; kapat / aç → değerler aynı.
//   M9 değiştir + Çık → soru VAR → "Kaydetmeden Kapat" (veri tabanı eski) / "Kaydet" (veri tabanı yeni); değeri geri alınca soru YOK.
//   M10 bölen 0 → "Bölen 0 olamaz." ileti, alan eski değere döner, hiçbir şey yazılmaz.
//   M11 iki kişi aynı anda: başka biri aynı kartı kaydetti → Kaydet 409, ileti kartın adını söyler, taslak ekranda durur; "Güncel Hâli Yükle".
//   M12 yetkisiz (Personel; maliyet.view yok) → giriş yok, API 403; görüntüleme verilince salt okunur (girdi, ✎, Kaydet yok).
//   M13 dar pencere (1366 px) + büyük tutar → kart taşmaz.
//   M14 başka sektöre geç → giriş kaybolur, veri durur (veri tabanı); Duşakabin'e dönünce aynen.
// 2.4.7 müşteri istekleri (28.10.2026): M3b oran kutuları boş, etiketler "KDV" / "Toplam" / "Maliyet" (Mika "Masraf%"), kutu önünde yalnız "%"; M4 oranları
//   kullanıcı yazar (18 / 20); M15 Enter → odak sağdaki kutuya / alt satırın ilkine / kartın sonunda yerinde, her Enter tek düzenleme; M16 dört sekmede "PDF"
//   (ekrandaki kaydedilmemiş değer PDF'te, veri tabanına yazılmaz).
// Pencere seçicisi ders 39; soru yanıtları ders 34 (escClose günlüğü ESC_KAPAT_GUNLUK, varsayılan ekran klasöründe). Çıkış: "N geçti, M kaldı" (kaldıysa 1).
import { appendFileSync, mkdirSync, mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { chromium } from "playwright";
import { CURRENT, bootVersion } from "../guvenilirlik/surumler.mjs";
import { ADMIN_PASSWORD } from "../helpers.mjs";
import { escClose } from "./esc-kapat.mjs";
import { pdfText } from "../pdf-metin.mjs";

const root = mkdtempSync(path.join(tmpdir(), "senaryo-maliyet-246-"));
const shots = process.env.EKRAN_DIR || path.join(path.dirname(fileURLToPath(import.meta.url)), "artifacts", "senaryo-maliyet-246");
mkdirSync(shots, { recursive: true });
if (!process.env.ESC_KAPAT_GUNLUK) process.env.ESC_KAPAT_GUNLUK = path.join(shots, "esc-kapat-gunluk.jsonl");
// Ders 34: Çık düğmesiyle çıkan soruya bu senaryonun verdiği her yanıt da günlüğe (escClose'un satırlarıyla aynı dosya); hepsi BEKLENEN soru.
const soruGunlugu = (adim, yanit) => appendFileSync(process.env.ESC_KAPAT_GUNLUK, `${JSON.stringify({ senaryo: "senaryo-maliyet-246.mjs", adim, yer: `senaryo-maliyet-246.mjs ${adim}`, beklenti: "soru-var", title: "Maliyet Hesap Kartı", yanit, neden: "cik-dugmesi: taslak kaydedilmemiş (ön izleme degisti=true)", at: new Date().toISOString() })}\n`);
const STAFF_PASS = "Personel-Maliyet-2026!";
const must = async (label, promise) => {
  const res = await promise;
  if (res.status !== 200) throw new Error(`${label}: ${res.status} ${JSON.stringify(res.data).slice(0, 300)}`);
  return res.data;
};
const server = await bootVersion(CURRENT, { dataDir: path.join(root, "data"), backupDir: path.join(root, "backups"), env: { HUKUK_LICENSE_URL: "http://127.0.0.1:9" } });
const api = await server.login();
const db = server.app.store;
const rows = kart => db.all("SELECT id, ad, birim, miktar, fiyat FROM maliyet_satirlar WHERE kart = ? ORDER BY sira", kart);
const cardRow = kart => db.get("SELECT ad, rev FROM maliyet_kartlar WHERE kod = ?", kart);
const stepRow = (kart, kod) => db.get("SELECT etiket, deger FROM maliyet_adimlar WHERE kart = ? AND kod = ?", kart, kod);

let passed = 0;
let failed = 0;
const ok = (cond, what) => {
  if (cond) passed += 1;
  else failed += 1;
  console.log(`  ${cond ? "✓" : "✗"} ${what}`);
  return Boolean(cond);
};
const near = (a, b) => typeof a === "number" && Math.abs(a - b) <= Math.max(1e-9 * Math.max(Math.abs(a), Math.abs(b)), 1e-12);
let page = null;
const shot = (name, target = page) => target?.screenshot({ path: path.join(shots, `maliyet-246-${name}.png`) }).catch(() => null);
const MODAL = ".hof-modal-backdrop.is-visible";
const TOP = `${MODAL}:nth-last-child(1 of ${MODAL})`;
const WIN = `${MODAL} .hof-maliyet-modal`;
const ROOT = `${WIN} [data-maliyet]`;
const OVAL = "cam/100x100-oval-kabin";
const CARD = `${ROOT} [data-kart="${OVAL}"]`;
const row = id => `${CARD} tbody tr[data-satir="${id}"]`;
const closeAll = async (target = page) => {
  for (let index = 0; index < 6 && (await target.$(MODAL)); index += 1) {
    await escClose(target, { step: "temizlik" });
    await target.waitForTimeout(250);
  }
};
const step = async (title, fn) => {
  console.log(`\n■ ${title}`);
  try {
    await fn();
  } catch (error) {
    ok(false, `adım yarıda kaldı: ${String(error?.message || error).split("\n")[0]}`);
    await shot(`hata-${title.slice(0, 3).trim()}`);
    await closeAll().catch(() => null);
  }
};
const typeSlow = async (text, target = page) => {
  for (const ch of text) await target.keyboard.type(ch, { delay: 45 });
};
// Alana tıkla, temizle, insan hızında yaz, Tab (ders 12).
const typeField = async (selector, text, target = page) => {
  await target.click(selector);
  await target.keyboard.press("Control+A");
  await target.keyboard.press("Backspace");
  await typeSlow(text, target);
  await target.keyboard.press("Tab");
};
const settle = (target = page) => target.waitForFunction(sel => document.querySelector(sel)?.dataset.bekleyen === "0", ROOT, { timeout: 15000 }).then(() => target.waitForTimeout(80));
const deger = (selector, target = page) => target.$eval(selector, node => JSON.parse(node.dataset.deger ?? "null")).catch(() => undefined);
const text = (selector, target = page) => target.$eval(selector, node => node.textContent.replace(/\s+/g, " ").trim()).catch(() => "");
const login = async (context, username, password) => {
  const target = await context.newPage();
  target.setDefaultTimeout(15000);
  target.on("pageerror", error => errors.push(`${username}: ${error.message}`));
  await target.goto(`${server.base}/`);
  await target.fill("#hof-auth input[name=username]", username);
  await target.fill("#hof-auth input[name=password]", password);
  await Promise.all([target.waitForEvent("load"), target.click('#hof-auth button[type="submit"]')]);
  await target.waitForSelector("#hof-sidecard", { timeout: 60000 });
  await target.waitForFunction(() => Boolean(window.HOF?.stock?.open), null, { timeout: 20000 });
  await target.evaluate(() => {
    localStorage.setItem(`hof-notices-off:${window.HOF.user.id}`, "1");
    document.querySelectorAll("#hof-notices .hof-notice").forEach(node => node.remove());
  });
  await target.waitForTimeout(500);
  return target;
};
const openStock = async (target = page) => {
  if (!(await target.$(`${MODAL} .hof-stock-modal`))) {
    await target.click('#hof-sidecard [data-action="stock"]');
    await target.waitForSelector(`${MODAL} .hof-stock-modal [data-stock] table, ${MODAL} .hof-stock-modal [data-stock] .hof-empty`);
  }
  // Giriş görünürlüğü durum isteğinden sonra çizilir; ders 39: is-visible + kısa bekleme.
  await target.waitForTimeout(700);
};
const entryVisible = (target = page) => target.$(`${MODAL} .hof-stock-modal [data-act="maliyet"]`).then(Boolean);
const openCard = async (target = page) => {
  await openStock(target);
  await target.click(`${MODAL} .hof-stock-modal [data-act="maliyet"]`);
  await target.waitForSelector(`${ROOT} [data-kart]`);
  await target.waitForTimeout(250);
};
const pickSector = async query => {
  await page.click("#hof-side-settings");
  await page.waitForSelector(`${TOP} [data-profile-pick]`);
  await page.waitForTimeout(200);
  await page.click(`${TOP} [data-profile-pick]`);
  await page.waitForSelector(`${TOP} .hof-picker input[type="search"]`);
  await page.waitForTimeout(200);
  await typeSlow(query);
  await page.waitForTimeout(250);
  await page.keyboard.press("Enter");
};
// Soru yanıtlanınca pencere 160 ms içinde DOM'dan kalkar; kalkmadan basılan Esc (escClose) kapanmakta olan soruyu "soru var" sanıyordu (ilk tam koşu, M14 temizlik).
const answer = async (which, adim) => {
  soruGunlugu(adim, which === "save" ? "Kaydet" : "Kaydetmeden Kapat");
  await page.click(`${TOP} [data-answer="${which}"]`);
  await page.waitForFunction(() => ![...document.querySelectorAll(".hof-modal-backdrop")].some(node => /Kaydedilmemiş Değişiklik/.test(node.textContent)), null, { timeout: 10000 });
};
// Çık düğmesi: soru çıkarsa ver, çıkmazsa false.
const clickExit = async () => {
  await page.click(`${ROOT} [data-cik]`);
  const state = await page
    .waitForFunction(sel => {
      if (!document.querySelector(sel)) return "kapandi";
      return [...document.querySelectorAll(".hof-modal-backdrop.is-visible")].some(node => node.querySelector("[data-answer='save']") && /Kaydedilmemiş Değişiklik/.test(node.textContent)) ? "soru" : false;
    }, ROOT, { timeout: 10000 })
    .then(handle => handle.jsonValue());
  return state === "soru";
};

const browser = await chromium.launch();
const errors = [];
try {
  await must("kurulum geç", api.post("/api/workspace/bank/setup/dismiss", {}));
  const context = await browser.newContext({ viewport: { width: 1440, height: 900 }, locale: "tr-TR" });
  await context.addInitScript(() => document.addEventListener("DOMContentLoaded", () => document.head.appendChild(Object.assign(document.createElement("style"), { textContent: "#hof-license-bar,.hof-license-notice{display:none!important}" }))));
  page = await login(context, "admin", ADMIN_PASSWORD);

  await step("M1 sektör Genel: Stok penceresinde Maliyet Hesap Kartı girişi yok", async () => {
    const durum = await must("durum", api.get("/api/maliyet/durum"));
    ok(durum.acik === false && durum.sektor.id !== "dusakabin", `API durum acik=false (sektör ${durum.sektor.id})`);
    await openStock();
    ok(!(await entryVisible()), "Stok penceresinde giriş YOK");
    ok((await api.get("/api/maliyet")).status === 403, "API 403 (maliyet-sector)");
    await shot("m1-stok-girissiz");
    await closeAll();
  });

  await step("M2 Ayarlar → Sektörü Değiştir → Duşakabin Üretimi → giriş var", async () => {
    await pickSector("duşakabin");
    await page.waitForFunction(() => document.documentElement.dataset.hofSector === "dusakabin", null, { timeout: 10000 });
    ok(JSON.parse(db.get("SELECT value FROM settings WHERE key LIKE '%insight.sector%'")?.value || "{}").id === "dusakabin", "veri tabanında sektör dusakabin");
    await closeAll();
    await openStock();
    ok(await entryVisible(), "Stok penceresinde “Maliyet Hesap Kartı” girişi VAR");
    await shot("m2-stok-girisli");
  });

  let sekmeler = [];
  await step("M3 kart açılır: 4 sekme (sunucu sırası), kartlar, ipucu satırı yok, yazım düzeni", async () => {
    await openCard();
    const server = await must("maliyet", api.get("/api/maliyet"));
    sekmeler = await page.$$eval(`${ROOT} [data-sekme]`, nodes => nodes.map(node => node.textContent.trim()));
    ok(JSON.stringify(sekmeler) === JSON.stringify(server.sekmeler.map(item => item.ad)) && sekmeler.join("|") === "Cam Maliyet|Bayi Fiyat Listesi 1|Mika Maliyet|Bayi Fiyat Listesi 2", `üstte 4 sekme: ${sekmeler.join(" · ")}`);
    const cards = await page.$$eval(`${ROOT} [data-kart]`, nodes => nodes.map(node => node.dataset.kart));
    ok(JSON.stringify(cards) === JSON.stringify(server.sekmeler[0].kartlar), `Cam Maliyet sekmesinde ${cards.length} kart (her bölüm ayrı kart)`);
    const help = await page.$$eval(`${WIN} .hof-edit-meta, ${WIN} .hof-modal-text, ${WIN} .hof-help, ${WIN} small`, nodes => nodes.length);
    ok(help === 0, `kartın içinde ipucu / yardım satırı yok (${help})`);
    const labels = await page.evaluate(sel => {
      const root = document.querySelector(sel);
      const fixed = [...root.querySelectorAll("thead th, .hof-maliyet-alt button, [data-satir-ekle]")].map(node => node.textContent.replace(/[✎]/g, "").replace(/\s+/g, " ").trim()).filter(Boolean);
      return fixed.filter(item => window.HOF.titleCase(item) !== item);
    }, ROOT);
    ok(labels.length === 0, `başlık ve düğmeler yazım düzeninde${labels.length ? `: ${labels.join(", ")}` : ""}`);
    const title = await text(`${WIN} .hof-modal-title`);
    ok(title === "Maliyet Hesap Kartı", `pencere başlığı “${title}”`);
    for (const kod of ["liste-1", "mika", "liste-2"]) {
      await page.click(`${ROOT} [data-sekme="${kod}"]`);
      await page.waitForTimeout(250);
      await shot(`m3-sekme-${kod}`);
    }
    const matris = await page.$$eval(`${ROOT} [data-tur="matris"] [data-hucre]`, nodes => ({ n: nodes.length, taban: nodes.filter(node => node.dataset.tur === "taban").length, satirEkle: document.querySelectorAll('[data-maliyet] [data-tur="matris"] [data-satir-ekle]').length }));
    ok(matris.n > 0 && matris.taban > 0 && matris.satirEkle === 0, `fiyat listesi matris tablo (${matris.n} hücre, ${matris.taban} taban); ölçü satırı ekle YOK (K3)`);
    await page.click(`${ROOT} [data-sekme="cam"]`);
    await page.waitForSelector(CARD);
    await shot("m3-cam");
  });

  // 2.4.7 (müşteri isteği 28.10.2026): oran kutuları BOŞ gelir, etiketlerde sayı yok; toplama adımı "Toplam" (Cam ve Mika).
  await step("M3b 2.4.7 yeni kart: iki oran kutusu boş, etiketler KDV / Toplam / Maliyet (Mika Masraf% / Toplam / Maliyet), kutu önünde yalnız %", async () => {
    const oku = async kart => page.$eval(`${ROOT} [data-kart="${kart}"]`, node => {
      const adim = kod => node.querySelector(`[data-adim="${kod}"]`);
      const etiket = kod => JSON.parse(adim(kod)?.querySelector('[data-alan="etiket"]')?.dataset.deger ?? "null");
      const kutu = kod => adim(kod)?.querySelector('input[data-alan="oran"]');
      const param = kod => adim(kod)?.querySelector(".hof-maliyet-param")?.textContent.trim();
      return { etiket: ["yuzde", "toplama", "yuzde_ekle"].map(etiket), kutu: ["yuzde", "yuzde_ekle"].map(kod => [kutu(kod)?.value, JSON.parse(kutu(kod)?.dataset.deger ?? '"yok"')]), param: ["yuzde", "yuzde_ekle"].map(param), toplamaYazi: adim("toplama")?.querySelector(".hof-maliyet-adim-ad")?.textContent.replace(/✎/g, "").trim(), sonuc: JSON.parse(node.dataset.sonuc) };
    });
    const cam = await oku("cam/170-2s2c-h182");
    ok(JSON.stringify(cam.etiket) === JSON.stringify(["KDV", "Toplam", "Maliyet"]) && cam.toplamaYazi === "Toplam", `Cam etiketleri ${JSON.stringify(cam.etiket)} (ekranda “${cam.toplamaYazi}”, “—” yok)`);
    ok(JSON.stringify(cam.kutu) === JSON.stringify([["", null], ["", null]]), `Cam iki oran kutusu boş ${JSON.stringify(cam.kutu)}`);
    ok(JSON.stringify(cam.param) === JSON.stringify(["%", "%"]) && cam.sonuc === 0, `kutunun önünde yalnız “%” ${JSON.stringify(cam.param)}; boş kartta sonuç 0`);
    await page.click(`${ROOT} [data-sekme="mika"]`);
    await page.waitForSelector(`${ROOT} [data-kart="mika/170-2s2c-h182"]`);
    await page.waitForTimeout(200);
    const mika = await oku("mika/170-2s2c-h182");
    ok(JSON.stringify(mika.etiket) === JSON.stringify(["Masraf%", "Toplam", "Maliyet"]) && JSON.stringify(mika.kutu) === JSON.stringify([["", null], ["", null]]) && JSON.stringify(mika.param) === JSON.stringify(["%", "%"]), `Mika: ${JSON.stringify(mika)}`);
    const sayili = await page.$$eval(`${ROOT} [data-adim="yuzde"] [data-alan="etiket"], ${ROOT} [data-adim="yuzde_ekle"] [data-alan="etiket"], ${ROOT} [data-adim="toplama"] [data-alan="etiket"]`, nodes => nodes.map(node => node.textContent.trim()).filter(text => /\d|^—$/.test(text)));
    ok(sayili.length === 0, `Mika'da hiçbir oran / toplama etiketinde sayı ya da “—” yok${sayili.length ? `: ${sayili.join(", ")}` : ""}`);
    await shot("m3b-mika-oranlar-bos");
    await page.click(`${ROOT} [data-sekme="cam"]`);
    await page.waitForSelector(CARD);
    await page.waitForTimeout(200);
    await shot("m3b-cam-oranlar-bos");
  });

  // Kâhin (Excel kalıbı, formül tablosu §2): tutar = miktar × fiyat; ARA = Σ; yüzde = (ARA × p) / 100; toplama = ARA + yüzde; yüzde ekle = ((T × q) / 100) + T; bölme = Y / k.
  const zincir = (satirlar, p, q, k) => {
    const ara = satirlar.reduce((sum, [m, f]) => sum + m * f, 0);
    const yuzde = (ara * p) / 100;
    const toplama = ara + yuzde;
    const ekle = (toplama * q) / 100 + toplama;
    return { ara, yuzde, toplama, ekle, bolme: ekle / k };
  };
  await step("M4 miktar / fiyat insan hızında + Tab → canlı hesap; veri tabanına yazılmadı", async () => {
    await typeField(`${row("s1")} input[data-alan="miktar"]`, "2,5");
    await typeSlow("1.250,75");
    await page.keyboard.press("Tab");
    await typeField(`${row("s2")} input[data-alan="miktar"]`, "3");
    await typeSlow("100");
    await page.keyboard.press("Tab");
    // 2.4.7: oranlar boş gelir; kullanıcı Excel'deki oranları kendisi yazar (girdi; beklenen hesap aynı).
    await typeField(`${CARD} [data-adim="yuzde"] input[data-alan="oran"]`, "18");
    await typeField(`${CARD} [data-adim="yuzde_ekle"] input[data-alan="oran"]`, "20");
    await settle();
    ok((await deger(`${CARD} [data-adim="yuzde"] [data-alan="oran"]`)) === 18 && (await deger(`${CARD} [data-adim="yuzde_ekle"] [data-alan="oran"]`)) === 20 && (await deger(`${CARD} [data-adim="yuzde"] [data-alan="etiket"]`)) === "KDV", "oranlar yazıldı (18 / 20); etiket değişmedi");
    ok((await deger(`${row("s1")} [data-alan="miktar"]`)) === 2.5 && (await deger(`${row("s1")} [data-alan="fiyat"]`)) === 1250.75, "“2,5” → 2,5 ve “1.250,75” → 1250,75 (Türkçe sayı, binlik)");
    const want = zincir([[2.5, 1250.75], [3, 100]], 18, 20, 200);
    const got = { tutar: await deger(`${row("s1")} [data-alan="tutar"]`), ara: await deger(`${CARD} [data-adim="ara"] [data-alan="deger"]`), yuzde: await deger(`${CARD} [data-adim="yuzde"] [data-alan="deger"]`), toplama: await deger(`${CARD} [data-adim="toplama"] [data-alan="deger"]`), ekle: await deger(`${CARD} [data-adim="yuzde_ekle"] [data-alan="deger"]`), bolme: await deger(`${CARD} [data-adim="bolme"] [data-alan="deger"]`) };
    ok(near(got.tutar, 2.5 * 1250.75) && near(got.ara, want.ara) && near(got.yuzde, want.yuzde) && near(got.toplama, want.toplama) && near(got.ekle, want.ekle) && near(got.bolme, want.bolme), `canlı hesap Excel kalıbıyla aynı: ${JSON.stringify(got)} (beklenen bölme ${want.bolme})`);
    ok((await text(`${row("s1")} [data-alan="tutar"]`)) === "3.126,88" && (await text(`${CARD} [data-adim="bolme"] [data-alan="deger"]`)) === "24,26", `gösterim kuruşla, binlik ayırıcılı (${await text(`${row("s1")} [data-alan="tutar"]`)} · ${await text(`${CARD} [data-adim="bolme"] [data-alan="deger"]`)})`);
    ok((await page.$eval(`${row("s1")} input[data-alan="fiyat"]`, node => node.value)) === "1.250,75", "fiyat alanı binlik ayırıcıyla gösterilir");
    ok(rows(OVAL)[0].miktar === null && cardRow(OVAL).rev === 1 && stepRow(OVAL, "yuzde").deger === null, "Kaydet'ten önce veri tabanı değişmedi (miktar ve oran boş, rev 1)");
    await shot("m4-canli-hesap");
  });

  const rename = async (buttonSel, value) => {
    await page.click(buttonSel);
    await page.waitForSelector(`${TOP} form input[name="ad"]`);
    await page.waitForTimeout(150);
    await page.click(`${TOP} form input[name="ad"]`);
    await page.keyboard.press("Control+A");
    await page.keyboard.press("Backspace");
    await typeSlow(value);
    await page.keyboard.press("Enter");
    await page.waitForFunction(() => !document.querySelector(".hof-modal-backdrop.is-visible form input[name='ad']"), null, { timeout: 10000 });
    await settle();
  };
  await step("M5 ✎ kart adı ve ✎ malzeme adı", async () => {
    await rename(`${CARD} .hof-maliyet-kart-bas [data-ad-degistir="kart"]`, "Oval Kabin Özel");
    ok((await deger(`${CARD} [data-alan="kart-ad"]`)) === "Oval Kabin Özel", "kart adı ekranda değişti");
    await rename(`${row("s3")} [data-ad-degistir="satir"]`, "Fitil Siyah");
    ok((await deger(`${row("s3")} [data-alan="ad"]`)) === "Fitil Siyah", "malzeme adı ekranda değişti");
    ok((await deger(`${row("s1")} [data-alan="tutar"]`)) === 2.5 * 1250.75, "ad değişince sayılar aynı (V8)");
    ok(cardRow(OVAL).ad === "100X100 Oval Kabin", "veri tabanında ad henüz değişmedi");
  });

  let newId = "";
  await step("M6 satır ekle (ad, birim, miktar, fiyat) ve satır sil", async () => {
    const before = await page.$$eval(`${CARD} tbody tr[data-satir]`, nodes => nodes.map(node => node.dataset.satir));
    await page.click(`${CARD} [data-satir-ekle]`);
    await page.waitForFunction(([sel, n]) => document.querySelectorAll(`${sel} tbody tr[data-satir]`).length === n + 1, [CARD, before.length]);
    await settle();
    newId = (await page.$$eval(`${CARD} tbody tr[data-satir]`, nodes => nodes.map(node => node.dataset.satir))).find(id => !before.includes(id));
    ok(Boolean(newId), `yeni satır eklendi (${newId})`);
    await rename(`${row(newId)} [data-ad-degistir="satir"]`, "Silikon");
    await typeField(`${row(newId)} input[data-alan="birim"]`, "Tüp");
    await typeSlow("4");
    await page.keyboard.press("Tab");
    await typeSlow("25");
    await page.keyboard.press("Tab");
    await settle();
    ok((await deger(`${row(newId)} [data-alan="tutar"]`)) === 100, "eklenen satır: 4 × 25 = 100");
    await page.click(`${row("s7")} [data-satir-sil]`);
    await page.waitForFunction(sel => !document.querySelector(sel), row("s7"));
    await settle();
    const want = zincir([[2.5, 1250.75], [3, 100], [4, 25]], 18, 20, 200);
    ok(near(await deger(`${CARD} [data-adim="ara"] [data-alan="deger"]`), want.ara) && near(await deger(`${CARD} [data-adim="bolme"] [data-alan="deger"]`), want.bolme), `eklenen satır ARA'ya girer, silinen çıkar (ARA ${want.ara})`);
    await shot("m6-satir-ekle-sil");
  });

  await step("M7 Kaydet → veri tabanında aynı değerler", async () => {
    await page.click(`${ROOT} [data-kaydet]`);
    await page.waitForFunction(sel => document.querySelector(sel)?.dataset.kayitSonuc === "tamam", ROOT, { timeout: 10000 });
    await settle();
    const saved = rows(OVAL);
    const card = cardRow(OVAL);
    ok(card.ad === "Oval Kabin Özel" && card.rev === 2, `kart adı ve sürüm (rev ${card.rev})`);
    ok(saved.length === 7 && saved[0].miktar === 2.5 && saved[0].fiyat === 1250.75 && saved[1].miktar === 3 && saved[1].fiyat === 100 && saved[2].ad === "Fitil Siyah", `şablon satırları (${saved.length} satır)`);
    const added = saved.find(item => item.id === newId);
    ok(added && added.ad === "Silikon" && added.birim === "Tüp" && added.miktar === 4 && added.fiyat === 25, "eklenen satır veri tabanında");
    ok(!saved.some(item => item.id === "s7"), "silinen satır veri tabanında yok");
    ok(stepRow(OVAL, "yuzde").deger === 18 && stepRow(OVAL, "yuzde_ekle").deger === 20 && stepRow(OVAL, "yuzde").etiket === "KDV", "yazılan oranlar veri tabanında (18 / 20), etiket KDV");
    ok(db.get("SELECT COUNT(*) AS n FROM maliyet_satirlar WHERE kart = 'cam/100x100-kose-kabin' AND miktar IS NOT NULL").n === 0, "öbür kart değişmedi (yalıtım)");
    ok((await page.$(`${WIN} [data-maliyet][data-kirli="0"]`)) !== null, "kaydedildikten sonra pencere temiz");
  });

  await step("M8 değişiklik yokken Esc → soru YOK; kapat / aç → değerler aynı", async () => {
    await escClose(page, { expect: "soru-yok", step: "M8 kaydedilmiş pencere" });
    await page.waitForFunction(sel => !document.querySelector(sel), ROOT);
    ok(true, "Esc sorusuz kapattı");
    await openCard();
    ok((await deger(`${CARD} [data-alan="kart-ad"]`)) === "Oval Kabin Özel" && (await deger(`${row("s1")} [data-alan="miktar"]`)) === 2.5 && (await deger(`${row(newId)} [data-alan="ad"]`)) === "Silikon" && !(await page.$(row("s7"))), "yeniden açınca kayıtlı değerler aynı");
    ok(await clickExit().then(asked => !asked), "değişiklik yokken Çık → soru YOK");
  });

  await step("M9 değiştir + Çık → soru → Kaydetmeden Kapat / Kaydet; geri alınca soru yok", async () => {
    await openCard();
    await typeField(`${row("s2")} input[data-alan="miktar"]`, "9");
    await settle();
    const asked = await clickExit();
    ok(asked, "değişiklik var → Çık “Kaydedilmemiş Değişiklik” sorar");
    await shot("m9-soru");
    await answer("yes", "M9a Çık → Kaydetmeden Kapat");
    await page.waitForFunction(sel => !document.querySelector(sel), ROOT);
    ok(rows(OVAL)[1].miktar === 3, "Kaydetmeden Kapat → veri tabanı eski (3)");
    await openCard();
    ok((await deger(`${row("s2")} [data-alan="miktar"]`)) === 3, "yeniden açınca eski değer");
    await typeField(`${row("s2")} input[data-alan="miktar"]`, "7");
    await settle();
    ok(await clickExit(), "yeniden değiştir → Çık yine sorar");
    await answer("save", "M9b Çık → Kaydet");
    await page.waitForFunction(sel => !document.querySelector(sel), ROOT, { timeout: 10000 });
    ok(rows(OVAL)[1].miktar === 7, "soruda Kaydet → veri tabanı yeni (7), pencere kapandı");
    await openCard();
    await typeField(`${row("s2")} input[data-alan="miktar"]`, "8");
    await settle();
    await typeField(`${row("s2")} input[data-alan="miktar"]`, "7");
    await settle();
    ok((await page.$(`${WIN} [data-maliyet][data-kirli="0"]`)) !== null, "değeri geri alınca pencere temiz (ön izleme degisti=false)");
    await escClose(page, { expect: "soru-yok", step: "M9c değer geri alındı" });
    ok(true, "geri alınan değişiklikte Esc sorusuz");
    await openCard();
    await rename(`${CARD} .hof-maliyet-kart-bas [data-ad-degistir="kart"]`, "Geçici Ad");
    await escClose(page, { expect: "soru-var", step: "M9d ✎ ad değişti, Esc" });
    await openCard();
    ok((await deger(`${CARD} [data-alan="kart-ad"]`)) === "Oval Kabin Özel" && cardRow(OVAL).ad === "Oval Kabin Özel", "kaydedilmeyen ✎ ad geri döner (V17)");
  });

  await step("M10 bölen 0 → ileti, alan eski değere döner, yazılmaz", async () => {
    await typeField(`${CARD} [data-adim="bolme"] input[data-alan="bolen"]`, "0");
    await settle();
    const message = await text(`${CARD} [data-kart-hata]`);
    ok(message === "Bölen 0 olamaz." || message.endsWith("Bölen 0 olamaz."), `ileti: “${message}”`);
    ok((await page.$eval(`${CARD} [data-adim="bolme"] input[data-alan="bolen"]`, node => node.value)) === "200" && (await deger(`${CARD} [data-adim="bolme"] [data-alan="bolen"]`)) === 200, "bölen alanı 200'e döndü");
    ok((await page.$(`${WIN} [data-maliyet][data-kirli="0"]`)) !== null && stepRow(OVAL, "bolme").deger === 200, "taslak ve veri tabanı değişmedi (bölen 200)");
    await shot("m10-bolen-sifir");
    await escClose(page, { expect: "soru-yok", step: "M10 reddedilen bölen" });
  });

  await step("M11 iki kişi aynı anda → 409; ileti kartın adını söyler; taslak durur; Güncel Hâli Yükle", async () => {
    await openCard();
    const other = await server.login();
    const now = await must("başkası okur", other.get("/api/maliyet"));
    await must("başkası kaydeder", other.put("/api/maliyet", { kartlar: [{ kod: OVAL, rev: now.kartlar[OVAL].rev, satirlar: now.kartlar[OVAL].satirlar.map(({ id, ad, birim, miktar, fiyat }) => ({ id, ad, birim, miktar: id === "s1" ? 11 : miktar, fiyat })) }] }));
    await typeField(`${row("s2")} input[data-alan="fiyat"]`, "150");
    await settle();
    await page.click(`${ROOT} [data-kaydet]`);
    await page.waitForSelector(`${ROOT} [data-bayat]`, { timeout: 10000 });
    const banner = await text(`${ROOT} [data-bayat] p`);
    ok(banner.includes("“Oval Kabin Özel”") && /başka biri kaydetti/.test(banner), `ileti kartın adını söyler: “${banner}”`);
    ok((await page.$eval(`${row("s2")} input[data-alan="fiyat"]`, node => node.value)) === "150" && (await deger(`${row("s2")} [data-alan="fiyat"]`)) === 150, "kullanıcının yazdığı değer ekranda duruyor (kaybolmadı)");
    ok(rows(OVAL)[0].miktar === 11 && rows(OVAL)[1].fiyat === 100, "veri tabanında başkasının değeri; benim değişikliğim yazılmadı");
    await shot("m11-409");
    await page.click(`${ROOT} [data-bayat-yukle]`);
    await page.waitForFunction(sel => !document.querySelector(`${sel} [data-bayat]`), ROOT);
    await settle();
    ok((await deger(`${row("s1")} [data-alan="miktar"]`)) === 11 && (await deger(`${row("s2")} [data-alan="fiyat"]`)) === 100, "Güncel Hâli Yükle → başkasının kaydı ekranda");
    await escClose(page, { expect: "soru-yok", step: "M11 güncel hâl yüklendi" });
  });

  await step("M12 yetkisiz (Personel) → giriş yok, API 403; görüntüleme verilince salt okunur", async () => {
    const created = await must("personel", api.post("/api/admin/users", { username: "per246", name: "Personel Maliyet", role: "personel", password: STAFF_PASS, mustChangePassword: false }));
    const id = created.id || created.user?.id || (await must("kullanıcılar", api.get("/api/admin/users"))).find(user => user.username === "per246").id;
    const staffApi = await server.login("per246", STAFF_PASS);
    ok((await staffApi.get("/api/maliyet/durum")).status === 403 && (await staffApi.get("/api/maliyet")).status === 403, "Personel: API 403 (maliyet.view yok)");
    const staffContext = await browser.newContext({ viewport: { width: 1440, height: 900 }, locale: "tr-TR" });
    const staff = await login(staffContext, "per246", STAFF_PASS);
    await openStock(staff);
    ok(!(await entryVisible(staff)), "Personel: Stok penceresinde giriş YOK");
    await shot("m12-personel-girissiz", staff);
    const grant = await api.client.raw("PATCH", `/api/admin/users/${id}`, { body: JSON.stringify({ grants: { add: ["maliyet.view"], remove: [] } }), headers: { "content-type": "application/json" } });
    ok(grant.status === 200, `yönetici kişiye “Maliyet Hesap Kartı Görüntüleme” verdi (${grant.status})`);
    await staff.reload();
    await staff.waitForSelector("#hof-sidecard", { timeout: 60000 });
    await staff.waitForFunction(() => Boolean(window.HOF?.stock?.open), null, { timeout: 20000 });
    await staff.waitForTimeout(500);
    await openCard(staff);
    const ro = await staff.evaluate(sel => {
      const root = document.querySelector(sel);
      return { inputs: root.querySelectorAll("input").length, pens: root.querySelectorAll("[data-ad-degistir]").length, save: root.querySelectorAll("[data-kaydet]").length, add: root.querySelectorAll("[data-satir-ekle], [data-satir-sil]").length, exit: root.querySelectorAll("[data-cik]").length };
    }, ROOT);
    ok(ro.inputs === 0 && ro.pens === 0 && ro.save === 0 && ro.add === 0 && ro.exit === 1, `salt okunur: girdi ${ro.inputs}, ✎ ${ro.pens}, Kaydet ${ro.save}, satır ekle/sil ${ro.add}; Çık var`);
    ok((await deger(`${CARD} [data-alan="miktar"]`, staff)) === 11 && (await deger(`${CARD} [data-alan="kart-ad"]`, staff)) === "Oval Kabin Özel", "salt okunur görünümde kayıtlı değerler");
    ok((await staffApi.put("/api/maliyet", { kartlar: [{ kod: OVAL, rev: cardRow(OVAL).rev, ad: "Yetkisiz" }] })).status === 403, "Personel Kaydet API 403 (maliyet.manage yok)");
    await shot("m12-salt-okunur", staff);
    await escClose(staff, { expect: "soru-yok", step: "M12 salt okunur pencere" });
    await staffContext.close();
  });

  await step("M13 dar pencere (1366 px) + büyük tutar → kart taşmaz", async () => {
    await page.setViewportSize({ width: 1366, height: 768 });
    await page.waitForTimeout(300);
    await openCard();
    await typeField(`${row("s1")} input[data-alan="miktar"]`, "999999999");
    await typeSlow("999.999.999.999");
    await page.keyboard.press("Tab");
    await settle();
    const fit = await page.evaluate(sel => {
      const out = [];
      for (const card of document.querySelectorAll(`${sel} [data-kart]`)) {
        const box = card.getBoundingClientRect();
        const bad = [...card.querySelectorAll("*")].filter(node => {
          const r = node.getBoundingClientRect();
          return r.width > 0 && (r.right > box.right + 1 || r.left < box.left - 1);
        }).length;
        if (card.scrollWidth > card.clientWidth + 1 || bad) out.push(`${card.dataset.kart}: scroll ${card.scrollWidth}/${card.clientWidth}, taşan ${bad}`);
      }
      const modal = document.querySelector(".hof-maliyet-modal").getBoundingClientRect();
      return { out, modal: [Math.round(modal.left), Math.round(modal.right)], page: document.documentElement.scrollWidth <= window.innerWidth };
    }, ROOT);
    ok(fit.out.length === 0, `1366 px'te büyük tutarla hiçbir kart taşmıyor${fit.out.length ? `: ${fit.out.join(" | ")}` : ""}`);
    ok(fit.modal[0] >= 0 && fit.modal[1] <= 1366 && fit.page, `pencere ekranda (${fit.modal.join("–")}), yatay sayfa kaydırması yok`);
    ok((await deger(`${row("s1")} [data-alan="tutar"]`)) === 999999999 * 999999999999, "büyük tutar ham değer");
    await shot("m13-dar-buyuk-tutar");
    await page.click(`${ROOT} [data-cik]`);
    await page.waitForSelector(`${TOP} [data-answer="yes"]`);
    await answer("yes", "M13 büyük tutar kaydedilmeden");
    await page.waitForFunction(sel => !document.querySelector(sel), ROOT);
    await page.setViewportSize({ width: 1440, height: 900 });
  });

  await step("M14 başka sektöre geç → giriş kaybolur, veri durur; geri dönünce aynen", async () => {
    const before = await must("kayıtlı", api.get("/api/maliyet"));
    const count = db.get("SELECT COUNT(*) AS n FROM maliyet_satirlar").n;
    await closeAll();
    await pickSector("fabrika");
    await page.waitForFunction(() => document.documentElement.dataset.hofSector === "uretim", null, { timeout: 10000 });
    await closeAll();
    await openStock();
    ok(!(await entryVisible()), "sektör Üretim ve fabrika → giriş YOK");
    ok((await api.get("/api/maliyet")).status === 403, "API 403");
    ok(db.get("SELECT COUNT(*) AS n FROM maliyet_satirlar").n === count && cardRow(OVAL).ad === "Oval Kabin Özel" && rows(OVAL)[0].miktar === 11, "veri tabanında veri duruyor");
    await shot("m14-baska-sektor");
    await closeAll();
    await pickSector("duşakabin");
    await page.waitForFunction(() => document.documentElement.dataset.hofSector === "dusakabin", null, { timeout: 10000 });
    await closeAll();
    const after = await must("geri", api.get("/api/maliyet"));
    ok(JSON.stringify(after.kartlar) === JSON.stringify(before.kartlar), "Duşakabin'e dönünce bütün kartlar aynen");
    await openStock();
    ok(await entryVisible(), "giriş yeniden VAR");
  });

  // 2.4.7 (müşteri isteği 28.10.2026: "Entera basınca sağa atlarsa iyi olur"): Enter alanı kaydeder ve odak aynı kartta sonraki kutuya geçer; satır
  // sonunda alt satırın ilk kutusu; kartın son kutusunda odak yerinde (BAŞ MİMAR KARARI). Gerçek klavye, insan hızı (ders 12); her Enter TEK düzenleme.
  const C2 = `${ROOT} [data-kart="cam/170-2s2c-h182"]`;
  const odak = () => page.evaluate(() => {
    const el = document.activeElement;
    return { kart: el?.closest("[data-kart]")?.dataset.kart || "", satir: el?.closest("[data-satir]")?.dataset.satir || "", adim: el?.closest("[data-adim]")?.dataset.adim || "", alan: el?.dataset?.alan || "", tag: el?.tagName || "" };
  });
  const duzenlemeSayisi = () => page.$eval(ROOT, node => Number(node.dataset.duzenleme || 0));
  const enter = async (yazi, beklenen, neden) => {
    if (yazi !== null) await typeSlow(yazi);
    const once = await duzenlemeSayisi();
    await page.keyboard.press("Enter");
    await settle();
    await page.waitForTimeout(150);
    await settle();
    const now = await odak();
    const sayi = (await duzenlemeSayisi()) - once;
    ok(Object.entries(beklenen).every(([key, value]) => now[key] === value) && sayi === 1, `${neden}: odak ${JSON.stringify(now)}; düzenleme ${sayi}`);
  };
  await step("M15 Enter: alanı kaydeder, odak sağdaki kutuya; satır sonunda alt satırın ilk kutusu; kartın son kutusunda yerinde", async () => {
    await closeAll();
    await openCard();
    await page.click(`${C2} tbody tr[data-satir="s1"] input[data-alan="miktar"]`);
    await page.keyboard.press("Control+A");
    await page.keyboard.press("Backspace");
    await enter("2", { kart: "cam/170-2s2c-h182", satir: "s1", alan: "fiyat" }, "Miktar'da Enter → aynı satırın Birim Fiyat'ı");
    ok((await deger(`${C2} tbody tr[data-satir="s1"] [data-alan="miktar"]`)) === 2, "Enter yazılanı kaydetti (miktar 2)");
    await enter("10", { kart: "cam/170-2s2c-h182", satir: "s2", alan: "birim" }, "satırın son kutusunda Enter → alt satırın ilk kutusu (Birim)");
    ok((await deger(`${C2} tbody tr[data-satir="s1"] [data-alan="tutar"]`)) === 20, "s1 tutar 2 × 10 = 20 (canlı hesap)");
    await enter(null, { kart: "cam/170-2s2c-h182", satir: "s2", alan: "miktar" }, "değişmemiş kutuda Enter → sağdaki (Miktar)");
    await page.click(`${C2} tbody tr[data-satir="s7"] input[data-alan="fiyat"]`);
    await enter("1", { kart: "cam/170-2s2c-h182", adim: "yuzde", alan: "oran" }, "son malzeme satırının son kutusunda Enter → KDV oranı");
    await enter("18", { kart: "cam/170-2s2c-h182", adim: "yuzde_ekle", alan: "oran" }, "KDV oranında Enter → Maliyet oranı");
    await enter("20", { kart: "cam/170-2s2c-h182", adim: "bolme", alan: "bolen" }, "Maliyet oranında Enter → Bölen");
    await enter(null, { kart: "cam/170-2s2c-h182", adim: "bolme", alan: "bolen" }, "kartın son kutusunda Enter → odak yerinde");
    const ara = 2 * 10;
    const toplama = ara + (ara * 18) / 100;
    ok(near(await deger(`${C2} [data-adim="bolme"] [data-alan="deger"]`), ((toplama * 20) / 100 + toplama) / 170), "oranlar Enter ile girildi, CM maliyeti Excel kalıbıyla");
    ok(db.get("SELECT COUNT(*) AS n FROM maliyet_satirlar WHERE kart = 'cam/170-2s2c-h182' AND miktar IS NOT NULL").n === 0, "Enter kaydetmez (yalnız taslak; veri tabanı boş)");
    await shot("m15-enter");
    await escClose(page, { expect: "soru-var", step: "M15 Enter ile girilen taslak" });
    await page.waitForFunction(sel => !document.querySelector(sel), ROOT);
  });

  // 2.4.7 (müşteri isteği 28.10.2026: "4 menüye de yazdır butonu isteriz PDF'ye aktarım yani"): her sekmede "PDF"; ekrandaki değerlerle (kaydedilmemiş dahil).
  await step("M16 dört sekmede PDF: başlık sekmenin adı, ekrandaki (kaydedilmemiş) değer; hiçbir şey yazılmaz", async () => {
    await openCard();
    await typeField(`${row("s2")} input[data-alan="fiyat"]`, "4.321,5");
    await settle();
    const dbOnce = JSON.stringify(rows(OVAL));
    const server = await must("maliyet", api.get("/api/maliyet"));
    const ad = Object.fromEntries(server.sekmeler.map(sekme => [sekme.kod, sekme.ad]));
    const beklenen = { cam: ["Oval Kabin Özel", "4.321,5", "KDV", "Toplam", "Maliyet"], "liste-1": ["Seri 2 Sabit 2 Açılır", "Katlanır Kapı Siyah Alüminyüm"], mika: ["Profil Ağırlıkları Net", "Masraf%", "80'lik Yan Panel"], "liste-2": ["Seri Yan Panel", "Montaj Satırları"] };
    for (const kod of ["cam", "liste-1", "mika", "liste-2"]) {
      await page.click(`${ROOT} [data-sekme="${kod}"]`);
      await page.waitForSelector(`${ROOT} [data-sekme-kartlar="${kod}"]`);
      await page.waitForTimeout(200);
      const dugme = await page.$eval(`${ROOT} [data-maliyet-pdf]`, node => ({ text: node.textContent.trim(), title: node.title, aria: node.getAttribute("aria-label"), ortak: node.matches(".hof-rep-out.is-pdf"), kod: node.dataset.maliyetPdf }));
      ok(dugme.text === "PDF" && dugme.ortak && dugme.kod === kod && dugme.aria === `${ad[kod]} - PDF` && dugme.title.startsWith(`${ad[kod]} sekmesini PDF olarak indir`), `${ad[kod]}: düğme “${dugme.text}” (ortak PDF düğmesi ${dugme.ortak}), erişilebilir ad “${dugme.aria}”, ipucu “${dugme.title}”`);
      const [download] = await Promise.all([page.waitForEvent("download", { timeout: 20000 }), page.click(`${ROOT} [data-maliyet-pdf]`)]);
      const buffer = readFileSync(await download.path());
      const metin = pdfText(buffer);
      const eksik = [ad[kod], ...beklenen[kod]].filter(parca => !metin.includes(parca));
      ok(buffer.subarray(0, 5).toString("latin1") === "%PDF-" && eksik.length === 0 && download.suggestedFilename().startsWith(ad[kod]), `${ad[kod]} PDF (${download.suggestedFilename()}, ${buffer.length} bayt)${eksik.length ? ` — eksik: ${eksik.join(", ")}` : ""}`);
    }
    ok(JSON.stringify(rows(OVAL)) === dbOnce && rows(OVAL)[1].fiyat === 100, "PDF hiçbir şey yazmadı (taslaktaki 4.321,5 veri tabanında yok)");
    await page.click(`${ROOT} [data-sekme="cam"]`);
    await page.waitForSelector(CARD);
    await shot("m16-pdf");
    await escClose(page, { expect: "soru-var", step: "M16 PDF'ten sonra kaydedilmemiş taslak" });
    await page.waitForFunction(sel => !document.querySelector(sel), ROOT);
  });

  ok(!errors.length, `sayfa hatası yok${errors.length ? `: ${errors.join(" | ")}` : ""}`);
} catch (error) {
  failed += 1;
  console.log(`  ✗ beklenmeyen hata: ${error.stack || error}`);
} finally {
  await browser.close();
  await server.close();
  rmSync(root, { recursive: true, force: true });
  console.log(`\nEkran görüntüleri: ${shots}\nSoru günlüğü: ${process.env.ESC_KAPAT_GUNLUK}`);
  console.log(`\n${passed} geçti, ${failed} kaldı`);
  process.exitCode = failed ? 1 : 0;
}
