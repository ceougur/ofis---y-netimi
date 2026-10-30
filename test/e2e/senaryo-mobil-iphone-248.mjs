// 2.4.8 M4/M5 EKRANDAN — iPhone eşleme akışı ve "Son Özeti Göster" (docs/2.4.8-IS-LISTESI.md "KARAR M4", "KARAR M5"; client/mobil/karekod.js, app.js, index.html).
// Kök neden (MOBİL BULGULAR B1): iOS'ta ana ekran simgesi Safari'den AYRI depoyla açılır; Safari'de yapılan eşleme simgeye geçmez → simgede "Cihaz Eşli Değil".
// Telefonlar programın UZAK dinleyicisine bağlanır (app.listenRemote; canlıda tünel). iPhone simgesi = navigator.standalone true (iOS ana ekran uygulamasının değeri) +
// AYRI tarayıcı bağlamı (ayrı depo). Kamera = Chromium'un sahte kamerası; görüntü dosyası programın KENDİ karekodundan (qr.mjs encodeQr) üretilen Y4M (kamera önüne
// tutulan ekran). Her karekod için ayrı tarayıcı açılır (sahte kamera dosyası tarayıcı başına).
//   I1 iPhone Safari (simge değil) karekodu açar → YALNIZ yönlendirme (Ana Ekrana Ekle → simge → Karekodu Okut, 5 dk), eşleme formu yok, düğme/seçenek yok, adres çubuğunda
//      kod kalmaz, /api/mobil/eslesme isteği YOK; programın veri tabanında kod hâlâ 'active', cihaz 0 (ders 3).
//   I2 simge (ayrı depo) açılır → "Cihaz Eşli Değil" + Karekodu Okut + yeni karekod notu → Karekodu Okut → kamera karekodu okur → Cihazı Eşleştir (ad "iPhone") →
//      Eşleştir → giriş (Tab, insan hızı) → Genel Bakış; veri tabanında AYNI kod 'used', cihaz 1 (Safari'nin açması kodu tüketmemişti).
//   I3 Safari sekmesi eşleme sonrası da eşli değildir (ayrı depo) → yönlendirme sayfası (eşleme sunmaz).
//   I4 kamera izni reddi → açık ileti, Cihaz Eşli Değil ekranında kalır.
//   I5 başka ofisin karekodu → "başka bir ofisin" iletisi, eşleme isteği YOK, kod 'active'; DestekOfis olmayan karekod → "eşleme karekodu değil".
//   I6 Android ve masaüstü tarayıcı: karekod sayfası bugünkü gibi Cihazı Eşleştir (Android eşlenir).
//   I7 M5: ofis sunucusuna ulaşılamıyor → "Son Özeti Göster" kullanıcı adı alanının ÜSTÜNDE, uyarıda "Son Özeti Göster'e basarak…" cümlesi; kendiliğinden açılmaz;
//      giriş denemesinin hata iletisi de cümleyi söyler.
// Çıkış: "N geçti, M kaldı" (kaldıysa 1). Ekran görüntüleri EKRAN_DIR (varsayılan test/e2e/artifacts/senaryo-mobil-iphone-248).
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { chromium } from "playwright";
import { encodeQr } from "../../server/lib/qr.mjs";
import { ADMIN_PASSWORD, createClient, startTestServer } from "../helpers.mjs";

const root = mkdtempSync(path.join(tmpdir(), "senaryo-mobil-iphone-248-"));
const shots = process.env.EKRAN_DIR || path.join(path.dirname(fileURLToPath(import.meta.url)), "artifacts", "senaryo-mobil-iphone-248");
mkdirSync(shots, { recursive: true });
const IPHONE = "Mozilla/5.0 (iPhone; CPU iPhone OS 17_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.5 Mobile/15E148 Safari/604.1";
const ANDROID = "Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0 Mobile Safari/537.36";
const USERS = [
  { username: "iphone-ali", name: "Ali iPhone", password: "Ali-iPhone-2026!" },
  { username: "android-veli", name: "Veli Android", password: "Veli-Android-2026!" },
  { username: "baska-ayse", name: "Ayşe Başka", password: "Ayse-Baska-2026!" },
  { username: "m5-deniz", name: "Deniz M5", password: "Deniz-M5-2026!" },
];
const HINT = "Son Özeti Göster'e basarak son yüklenen bilgileri görebilirsiniz";

const server = await startTestServer({ env: { HUKUK_LICENSE_URL: "http://127.0.0.1:9" } });
const address = await server.app.listenRemote(0, "127.0.0.1");
const remoteBase = `http://127.0.0.1:${address.port}`;
server.app.mobileRemote.setPublicUrl(remoteBase);
const adminApi = createClient(server.base);
await adminApi.login("admin", ADMIN_PASSWORD);
for (const user of USERS) {
  const created = await adminApi.post("/api/admin/users", { username: user.username, name: user.name, role: "personel", password: user.password, mustChangePassword: false });
  if (created.status !== 200) throw new Error(`kullanıcı açılamadı: ${JSON.stringify(created.data)}`);
}
const ids = Object.fromEntries((await adminApi.get("/api/admin/users")).data.data.map(user => [user.username, user.id]));
for (const user of USERS) {
  const r = await adminApi.put(`/api/admin/mobile/access/${ids[user.username]}`, { remote: true });
  if (r.status !== 200) throw new Error(`uzak izin: ${JSON.stringify(r.data)}`);
}
const newCode = async username => {
  const r = await adminApi.post("/api/admin/mobile/codes", { userId: ids[username] });
  if (r.status !== 200) throw new Error(`karekod: ${JSON.stringify(r.data)}`);
  return r.data.data;
};
// Programın veri tabanı (ders 3): kişinin karekod durumları ve etkin cihazları.
const db = username => ({
  codes: server.app.store.all("SELECT state FROM mobile_codes WHERE user_id = ? ORDER BY created_at", ids[username]).map(r => r.state),
  devices: server.app.store.all("SELECT name, kind FROM mobile_devices WHERE user_id = ? AND revoked_at IS NULL", ids[username]),
});

let passed = 0;
let failed = 0;
const ok = (cond, what) => {
  if (cond) passed += 1;
  else failed += 1;
  console.log(`  ${cond ? "✓" : "✗"} ${what}`);
  return Boolean(cond);
};
const pageErrors = [];
const shot = (name, target) => target?.screenshot({ path: path.join(shots, `iphone-248-${name}.png`), fullPage: true }).catch(() => null);
let current = null;
const step = async (title, fn) => {
  console.log(`\n■ ${title}`);
  try {
    await fn();
  } catch (error) {
    ok(false, `adım yarıda kaldı: ${String(error?.message || error).split("\n")[0]}`);
    await shot(`hata-${title.slice(0, 2).trim()}`, current);
  }
};
const typeSlow = async (target, text) => {
  for (const ch of text) await target.keyboard.type(ch, { delay: 40 });
};
const visible = (page, sel) => page.isVisible(sel).catch(() => false);

/** Karekodu kameranın gördüğü kareye çizer: 640×480 Y4M (beyaz zemin, ortada karekod), 2 kare (Chromium dosyayı döngüyle oynatır). */
function cameraFile(name, text) {
  const W = 640;
  const H = 480;
  const { size, modules } = encodeQr(text);
  const scale = Math.floor(Math.min(W, H) * 0.8 / (size + 8));
  const px = (size + 8) * scale;
  const ox = Math.floor((W - px) / 2);
  const oy = Math.floor((H - px) / 2);
  const y = Buffer.alloc(W * H, 235);
  for (let r = 0; r < size; r += 1)
    for (let c = 0; c < size; c += 1) {
      if (!modules[r][c]) continue;
      for (let dy = 0; dy < scale; dy += 1) y.fill(16, (oy + (r + 4) * scale + dy) * W + ox + (c + 4) * scale, (oy + (r + 4) * scale + dy) * W + ox + (c + 5) * scale);
    }
  const uv = Buffer.alloc((W / 2) * (H / 2) * 2, 128);
  const frame = Buffer.concat([Buffer.from("FRAME\n"), y, uv]);
  const file = path.join(root, `${name}.y4m`);
  writeFileSync(file, Buffer.concat([Buffer.from(`YUV4MPEG2 W${W} H${H} F10:1 Ip A1:1 C420jpeg\n`), frame, frame]));
  return file;
}
const launch = file => chromium.launch({ args: ["--use-fake-device-for-media-stream", "--use-fake-ui-for-media-stream", `--use-file-for-fake-video-capture=${file}`] });
const phoneContext = async (browser, { ua = IPHONE, simge = false, kameraYok = false } = {}) => {
  const context = await browser.newContext({ viewport: { width: 390, height: 844 }, userAgent: ua, isMobile: true, hasTouch: true, deviceScaleFactor: 2, locale: "tr-TR", serviceWorkers: "block" });
  await context.grantPermissions(["camera"], { origin: remoteBase });
  if (simge) await context.addInitScript(() => Object.defineProperty(Navigator.prototype, "standalone", { configurable: true, get: () => true }));
  else if (ua === IPHONE) await context.addInitScript(() => Object.defineProperty(Navigator.prototype, "standalone", { configurable: true, get: () => false }));
  if (kameraYok) await context.addInitScript(() => { navigator.mediaDevices.getUserMedia = () => Promise.reject(new DOMException("İzin verilmedi", "NotAllowedError")); });
  const page = await context.newPage();
  page.setDefaultTimeout(15000);
  page.on("pageerror", error => pageErrors.push(`${ua === IPHONE ? (simge ? "simge" : "safari") : "android"}: ${error.message}`));
  const pairPosts = [];
  page.on("request", req => {
    if (req.method() === "POST" && new URL(req.url()).pathname === "/api/mobil/eslesme") pairPosts.push(req.url());
  });
  current = page;
  return { context, page, pairPosts };
};

const ali = await newCode("iphone-ali");
const browserA = await launch(cameraFile("ali", ali.url));
let safari = null;
let simge = null;

await step("I1 iPhone Safari karekodu açar → yalnız yönlendirme; kod tüketilmez", async () => {
  safari = await phoneContext(browserA);
  await safari.page.goto(ali.url);
  await safari.page.waitForSelector("#ios-guide:not(.hidden)", { timeout: 8000 }).catch(() => null);
  ok(await visible(safari.page, "#ios-guide"), "yönlendirme sayfası görünür (Ana Ekrana Ekleyin)");
  ok(!(await visible(safari.page, "#pair-form")), "Cihazı Eşleştir formu görünmez (eşleme yapılmaz)");
  const text = ((await safari.page.textContent("#ios-guide").catch(() => "")) || "").replace(/\s+/g, " ");
  ok(text.includes("Paylaş düğmesine dokunun → Ana Ekrana Ekle") && text.includes("Ana ekrandaki DestekOfis simgesini açın") && text.includes("Karekodu Okut ile bilgisayardaki aynı karekodu okutun (karekod 5 dakika geçerli)"), `üç adım: ${text.slice(0, 260)}`);
  ok((await safari.page.locator("#ios-guide button, #ios-guide input, #ios-guide a").count()) === 0, "yönlendirmede seçenek / düğme yok");
  ok(!safari.page.url().includes("eslesme"), "kod adres çubuğundan silindi");
  await safari.page.waitForTimeout(600);
  ok(safari.pairPosts.length === 0, `eşleme isteği gönderilmedi (${safari.pairPosts.length})`);
  const d = db("iphone-ali");
  ok(d.codes.join() === "active" && d.devices.length === 0, `veri tabanı: kod ${d.codes.join() || "—"}, cihaz ${d.devices.length} (beklenen active, 0)`);
  await shot("01-safari-yonlendirme", safari.page);
});

await step("I2 simge (ayrı depo) → Karekodu Okut → kamera → Eşleştir → giriş → Genel Bakış; AYNI kod tüketilir", async () => {
  simge = await phoneContext(browserA, { simge: true });
  await simge.page.goto(`${remoteBase}/mobil/`);
  await simge.page.waitForSelector("#unpaired:not(.hidden)");
  ok(await visible(simge.page, "#scan-open"), "Cihaz Eşli Değil ekranında Karekodu Okut düğmesi");
  ok(((await simge.page.textContent("#scan-open")) || "").includes("Karekodu Okut"), "düğme adı Karekodu Okut");
  ok(await visible(simge.page, "#unpaired-icon-note") && /yöneticinizden yeni karekod isteyin/.test(await simge.page.textContent("#unpaired-icon-note")), "yeni karekod notu görünür");
  await shot("02-simge-karekodu-okut", simge.page);
  await simge.page.click("#scan-open");
  await simge.page.waitForSelector("#pair-form:not(.hidden)", { timeout: 20000 });
  ok(await visible(simge.page, "#pair-form"), "karekod okundu → Cihazı Eşleştir");
  ok((await simge.page.inputValue("#device-name")) === "iPhone", `cihaz adı önerisi: ${await simge.page.inputValue("#device-name")}`);
  ok(simge.pairPosts.length === 0, "okumadan sonra eşleme kendiliğinden gönderilmez (kullanıcı Eşleştir'e basar)");
  await shot("03-simge-eslestir", simge.page);
  await simge.page.click("#device-name", { clickCount: 3 });
  await typeSlow(simge.page, "Ali'nin iPhone'u");
  await simge.page.click("#pair-submit");
  await simge.page.waitForSelector("#login-form:not(.hidden)");
  ok(simge.pairPosts.length === 1 && simge.pairPosts[0].startsWith(remoteBase), `eşleme bu ofisin adresine bir kez gitti (${simge.pairPosts.join(" ")})`);
  const d = db("iphone-ali");
  ok(d.codes.join() === "used" && d.devices.length === 1 && d.devices[0].name === "Ali'nin iPhone'u" && d.devices[0].kind === "telefon", `veri tabanı: kod ${d.codes.join()}, cihaz ${JSON.stringify(d.devices)}`);
  await simge.page.click("#username");
  await typeSlow(simge.page, "iphone-ali");
  await simge.page.keyboard.press("Tab");
  await typeSlow(simge.page, "Ali-iPhone-2026!");
  await simge.page.click("#login-submit");
  await simge.page.waitForSelector("#app:not(.hidden) #content .summary-grid");
  ok(await visible(simge.page, "#app"), "simgede Genel Bakış açıldı");
  await shot("04-simge-genel-bakis", simge.page);
});

await step("I3 Safari sekmesi (ayrı depo) eşleme sonrası da yönlendirir; eşleme sunmaz", async () => {
  current = safari.page;
  await safari.page.goto(`${remoteBase}/mobil/`);
  await safari.page.waitForSelector("#ios-guide:not(.hidden)", { timeout: 8000 }).catch(() => null);
  ok(await visible(safari.page, "#ios-guide"), "Safari'de eşli olmayan sayfa → Ana Ekrana Ekleyin yönlendirmesi");
  ok(!(await visible(safari.page, "#scan-open")) && !(await visible(safari.page, "#pair-form")), "Safari'de Karekodu Okut / Eşleştir yok");
});

await step("I4 kamera izni reddi → açık ileti", async () => {
  const red = await phoneContext(browserA, { simge: true, kameraYok: true });
  await red.page.goto(`${remoteBase}/mobil/`);
  await red.page.waitForSelector("#scan-open:not(.hidden)");
  await red.page.click("#scan-open");
  await red.page.waitForSelector("#scan-error:not(.hidden)");
  const msg = await red.page.textContent("#scan-error");
  ok(/Kamera izni verilmedi/.test(msg) && (await visible(red.page, "#unpaired")), `ileti: ${msg}`);
  ok(red.pairPosts.length === 0, "eşleme isteği yok");
  await shot("05-kamera-izni-yok", red.page);
  await red.context.close();
});

await step("I7 M5 (simge, eşli) ofis sunucusuna ulaşılamıyor → Son Özeti Göster formun üstünde + uyarı cümlesi; kendiliğinden açılmaz", async () => {
  // Kendi simgesi (I2'den bağımsız): karekod adresi simgede doğrudan açılıp eşlenir (eski kodda da aynı form → M5'in kırmızısı yalnız düğmenin yeri / iletisi).
  const deniz = await newCode("m5-deniz");
  const m5 = await phoneContext(browserA, { simge: true });
  await m5.page.goto(deniz.url);
  await m5.page.waitForSelector("#pair-form:not(.hidden)");
  await m5.page.click("#pair-submit");
  await m5.page.waitForSelector("#login-form:not(.hidden)");
  ok(db("m5-deniz").devices.length === 1, "M5 simgesi eşlendi");
  // Bu programda kapıcı yok (eşleme yanıtında ofis kaydı gelmez) → "son özet açılabilir" koşulu için cihazın deposuna ofis kaydı yazılır. Özetin kendisinin
  // açılması (kapıcı + şifreli özet) senaryo-mobil-ozet-247'de; burada yalnız M5'in ekran düzeni ve iletisi. Yazım süreyle sınırlı (takılırsa adım düşer).
  const yazildi = await m5.page.evaluate(() => new Promise(resolve => {
    setTimeout(() => resolve("zaman aşımı"), 5000);
    try {
      const r = indexedDB.open("destekofis-mobil", 1);
      r.onupgradeneeded = () => r.result.createObjectStore("cihaz");
      r.onerror = () => resolve(String(r.error));
      r.onsuccess = () => {
        try {
          const tx = r.result.transaction("cihaz", "readwrite");
          tx.objectStore("cihaz").put({ kimlik: "ofis-e2e", anahtar: { kty: "EC", crv: "P-256", x: "x", y: "y" } }, "ofis");
          tx.oncomplete = () => { r.result.close(); resolve("tamam"); };
          tx.onerror = () => resolve(String(tx.error));
        } catch (error) {
          resolve(String(error));
        }
      };
    } catch (error) {
      resolve(String(error));
    }
  }));
  if (!ok(yazildi === "tamam", `ofis kaydı yazıldı (${yazildi})`)) return;
  await m5.page.route("**/api/mobil/**", route => route.abort("internetdisconnected"));
  await m5.page.reload();
  await m5.page.waitForSelector("#offline-note:not(.hidden)", { timeout: 15000 });
  const note = await m5.page.locator("#offline-note").boundingBox();
  const user = await m5.page.locator("#username").boundingBox();
  ok(note && user && note.y + note.height <= user.y, `Son Özeti Göster kullanıcı adının ÜSTÜNDE (not y=${note?.y}–${note && note.y + note.height}, alan y=${user?.y})`);
  ok(note && note.y + note.height <= 844, `düğme ilk ekranda, kaydırmadan görünür (alt ${note && note.y + note.height} ≤ 844)`);
  ok(((await m5.page.textContent("#offline-note")) || "").includes(HINT), `uyarıda Son Özeti Göster cümlesi: ${((await m5.page.textContent("#offline-note")) || "").trim()}`);
  ok(!(await visible(m5.page, "#app")), "son özet kendiliğinden açılmadı");
  await shot("06-m5-giris-ekrani", m5.page);
  await m5.page.click("#username");
  await typeSlow(m5.page, "m5-deniz");
  await m5.page.keyboard.press("Tab");
  await typeSlow(m5.page, "Deniz-M5-2026!");
  await m5.page.click("#login-submit");
  await m5.page.waitForFunction(h => (document.getElementById("login-error")?.textContent || "").includes(h), HINT, { timeout: 10000 }).catch(() => null);
  const err = (await m5.page.textContent("#login-error")) || "";
  ok(err.includes(HINT), `giriş hatası cümleyi söyler: ${err}`);
  await m5.context.close();
  // 3 cihaz sınırı: M5 simgesi silinir (Yönetim → Mobil Cihazlar → Sil ile aynı uç), sonraki adımlar karekod alabilsin.
  const dev = (await adminApi.get("/api/admin/mobile/devices")).data.data.devices.find(d => d.username === "m5-deniz");
  ok(dev && (await adminApi.del(`/api/admin/mobile/devices/${dev.id}`)).status === 200 && db("m5-deniz").devices.length === 0, "M5 simgesi silindi (sınır için)");
});

await step("I6 Android ve masaüstü tarayıcı: bugünkü akış (Cihazı Eşleştir)", async () => {
  const veli = await newCode("android-veli");
  const android = await phoneContext(browserA, { ua: ANDROID });
  await android.page.goto(veli.url);
  await android.page.waitForSelector("#pair-form:not(.hidden)", { timeout: 8000 }).catch(() => null);
  ok(await visible(android.page, "#pair-form") && !(await visible(android.page, "#ios-guide")), "Android: Cihazı Eşleştir (yönlendirme yok)");
  ok((await android.page.inputValue("#device-name").catch(() => "")) === "Android Telefon", "Android cihaz adı önerisi");
  await android.page.click("#pair-submit").catch(() => null);
  await android.page.waitForSelector("#login-form:not(.hidden)").catch(() => null);
  const d = db("android-veli");
  ok(d.codes.join() === "used" && d.devices.length === 1, `Android eşlendi: kod ${d.codes.join()}, cihaz ${d.devices.length}`);
  await android.context.close();
  const ayseDesk = await newCode("baska-ayse");
  const deskContext = await browserA.newContext({ viewport: { width: 1280, height: 800 }, serviceWorkers: "block" });
  const desk = await deskContext.newPage();
  await desk.goto(ayseDesk.url);
  await desk.waitForSelector("#pair-form:not(.hidden)", { timeout: 8000 }).catch(() => null);
  ok(await visible(desk, "#pair-form") && !(await visible(desk, "#ios-guide")), "masaüstü tarayıcı: Cihazı Eşleştir (yönlendirme yok)");
  ok(db("baska-ayse").codes.at(-1) === "active", "masaüstünde formu açmak kodu tüketmez");
  await deskContext.close();
});
await browserA.close();

await step("I5 başka ofisin karekodu ve DestekOfis olmayan karekod → açık ileti, eşleme yok", async () => {
  const ayse = await newCode("baska-ayse");
  // Aynı kişinin GEÇERLİ kodu, başka kökende (localhost ≠ 127.0.0.1): kabul edilseydi bu ofise eşlenirdi.
  const other = ayse.url.replace("http://127.0.0.1:", "http://localhost:");
  for (const [label, text, expect] of [["baska-ofis", other, /başka bir ofisin/], ["destekofis-degil", "https://ornek.com.tr/menu", /DestekOfis eşleme karekodu değil/]]) {
    const browser = await launch(cameraFile(label, text));
    try {
      const p = await phoneContext(browser, { simge: true });
      await p.page.goto(`${remoteBase}/mobil/`);
      await p.page.waitForSelector("#scan-open:not(.hidden)");
      await p.page.click("#scan-open");
      await p.page.waitForSelector("#scan-error:not(.hidden)", { timeout: 20000 });
      const msg = await p.page.textContent("#scan-error");
      ok(expect.test(msg) && (await visible(p.page, "#unpaired")) && !(await visible(p.page, "#pair-form")), `${label}: ${msg}`);
      ok(p.pairPosts.length === 0, `${label}: eşleme isteği yok`);
      if (label === "baska-ofis") await shot("07-baska-ofis-karekodu", p.page);
    } finally {
      await browser.close();
    }
  }
  const d = db("baska-ayse");
  ok(d.codes.at(-1) === "active" && d.devices.length === 0, `veri tabanı: son kod ${d.codes.at(-1)}, cihaz ${d.devices.length}`);
});

ok(pageErrors.length === 0, `sayfa hatası yok (${pageErrors.join(" | ") || "—"})`);
await server.close();
rmSync(root, { recursive: true, force: true });
console.log(`\n${passed} geçti, ${failed} kaldı`);
process.exit(failed ? 1 : 0);
