// 2.4.7 M4 EKRANDAN — Yönetim → Mobil Cihazlar → "Uzaktan Bağlantı" durum satırı (docs/mobil/M4-TASARIM.md §7; lib/tunnel/manager.mjs, hof-mobile-tunnel.js).
// Sahte kapıcı (bellekte) + sahte cloudflared (test/fixtures/sahte-cloudflared.mjs); gerçek Cloudflare'e/kapıcıya/lisans servisine çağrı yok (ders 30).
// Gerçek tıklama ve insan hızında akış (ders 12); satır kendiliğinden yenilenir (sayfa yenilenmeden).
//   T1 kimse uzaktan bağlanamazken: "Uzaktan Bağlantı" kartı, "Kapalı — Eşli cihaz yok; …"; ofis adresi yok.
//   T2 Uzaktan Bağlanabilir işaretlenir → adres hazırlanır ("Ofis adresi: https://ofis-….destekofis.net"), durum yine Kapalı (süreç yok).
//   T3 Karekod Oluştur → karekodun içeriği tünel adresi (https://ofis-…/mobil/#eslesme=); pencere kapanınca satır "Bağlı" (yenilemeden).
//   T4 lisans salt okunur → satır "Kapalı — Lisans geçerli değil…"; lisans dönünce yeniden "Bağlı".
// Çıkış: "N geçti, M kaldı" (kaldıysa 1). Ekran görüntüleri EKRAN_DIR (varsayılan test/e2e/artifacts/senaryo-mobil-tunel-247).
import { mkdirSync, mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import jsQR from "jsqr";
import { chromium } from "playwright";
import { CURRENT, bootVersion } from "../guvenilirlik/surumler.mjs";
import { ADMIN_PASSWORD, createClient } from "../helpers.mjs";

const here = path.dirname(fileURLToPath(import.meta.url));
const FAKE = path.join(here, "..", "fixtures", "sahte-cloudflared.mjs");
const root = mkdtempSync(path.join(tmpdir(), "senaryo-mobil-tunel-247-"));
const shots = process.env.EKRAN_DIR || path.join(here, "artifacts", "senaryo-mobil-tunel-247");
mkdirSync(shots, { recursive: true });
const HOST = "ofis-0123456789abcdef.destekofis.net";
let gateCalls = 0;
const gate = { provision: async () => {
  gateCalls += 1;
  return { tunnelId: "12345678-1234-4234-8234-123456789abc", hostname: HOST, publicUrl: `https://${HOST}`, token: "calistirma-belirteci-sahte" };
} };

const server = await bootVersion(CURRENT, {
  dataDir: path.join(root, "data"),
  backupDir: path.join(root, "backups"),
  env: { HUKUK_LICENSE_URL: "http://127.0.0.1:9" },
  tunnel: { gate, runner: { command: process.execPath, argsPrefix: [FAKE, "--sahte-log", path.join(root, "cf.log"), "--sahte-mod", "bagli"], identity: FAKE }, tickMs: 200, firstTickMs: 50, root: path.join(root, "bilesen") },
});
const adminApi = createClient(server.base);
await adminApi.login("admin", ADMIN_PASSWORD);
await adminApi.post("/api/admin/users", { username: "tunel-ali", name: "Ali Tünel", role: "personel", password: "Ali-Tunel-2026!", mustChangePassword: false });
const aliId = (await adminApi.get("/api/admin/users")).data.data.find(user => user.username === "tunel-ali").id;

let passed = 0;
let failed = 0;
const ok = (cond, what) => {
  if (cond) passed += 1;
  else failed += 1;
  console.log(`  ${cond ? "✓" : "✗"} ${what}`);
  return Boolean(cond);
};
const pageErrors = [];
let desk = null;
const shot = name => desk?.screenshot({ path: path.join(shots, `tunel-247-${name}.png`), fullPage: true }).catch(() => null);
const step = async (title, fn) => {
  console.log(`\n■ ${title}`);
  try {
    await fn();
  } catch (error) {
    ok(false, `adım yarıda kaldı: ${String(error?.message || error).split("\n")[0]}`);
    await shot(`hata-${title.slice(0, 2).trim()}`);
  }
};
const line = async () => (await desk.textContent("[data-mobile-tunnel]"))?.replace(/\s+/g, " ").trim() || "";
const waitState = (state, ms = 15000) => desk.waitForSelector(`[data-mobile-tunnel][data-state="${state}"]`, { timeout: ms });
const row = `[data-mobile-user="${aliId}"]`;

const browser = await chromium.launch();
desk = await (await browser.newContext({ viewport: { width: 1366, height: 900 } })).newPage();
desk.on("pageerror", error => pageErrors.push(error.message));
desk.setDefaultTimeout(15000);

await step("T1 kimse uzaktan bağlanamazken: Uzaktan Bağlantı Kapalı, neden yazılı", async () => {
  await desk.goto(`${server.base}/`);
  await desk.fill("#hof-auth input[name=username]", "admin");
  await desk.fill("#hof-auth input[name=password]", ADMIN_PASSWORD);
  await Promise.all([desk.waitForEvent("load"), desk.click('#hof-auth button[type="submit"]')]);
  await desk.waitForSelector("#hof-sidecard", { timeout: 60000 });
  await desk.goto(`${server.base}/admin.html#mobile`);
  await desk.waitForSelector("#adm-mobile-users [data-mobile-user]");
  await desk.waitForSelector("[data-mobile-tunnel]");
  ok((await desk.textContent("#adm-mobile-tunnel h2")).trim() === "Uzaktan Bağlantı", "kart başlığı Uzaktan Bağlantı (yazım düzeni)");
  ok((await desk.textContent("[data-tunnel-label]")).trim() === "Kapalı", `durum Kapalı: ${await line()}`);
  ok(/Eşli cihaz yok; karekod oluşturulunca bağlantı kendiliğinden açılır\./.test(await line()), "neden görünür yazı");
  ok(!(await desk.$("[data-tunnel-url]")), "ofis adresi henüz yok");
  ok(gateCalls === 0, "kapıcıya başvurulmadı");
  const box = await desk.locator("#adm-mobile-tunnel").boundingBox();
  const status = await desk.locator("#adm-mobile-status").boundingBox();
  ok(box && status && box.y > status.y, "satır durum kartının altında");
  await shot("01-kapali");
});

await step("T2 Uzaktan Bağlanabilir işaretlenir → ofis adresi hazırlanır, durum yine Kapalı", async () => {
  await desk.click(`${row} [data-mobile-remote]`);
  await desk.waitForSelector("[data-tunnel-url]", { timeout: 15000 });
  ok((await desk.textContent("[data-tunnel-url]")).includes(`https://${HOST}`), `adres: ${(await desk.textContent("[data-tunnel-url]")).trim()}`);
  ok((await desk.textContent("[data-tunnel-label]")).trim() === "Kapalı", "süreç başlamadı (Kapalı)");
  ok(gateCalls === 1, `kapıcıya bir başvuru (${gateCalls})`);
  await shot("02-adres-hazir");
});

await step("T3 Karekod Oluştur → karekod tünel adresini taşır; satır kendiliğinden Bağlı", async () => {
  await desk.waitForFunction(selector => !document.querySelector(selector)?.disabled, `${row} [data-mobile-code]`);
  await desk.click(`${row} [data-mobile-code]`);
  await desk.waitForSelector(".hof-modal-backdrop.is-visible [data-mobile-qr] svg");
  const qr = await desk.evaluate(async () => {
    const svg = document.querySelector("[data-mobile-qr] svg");
    const img = new Image();
    img.src = `data:image/svg+xml;charset=utf-8,${encodeURIComponent(new XMLSerializer().serializeToString(svg))}`;
    await img.decode();
    const canvas = document.createElement("canvas");
    canvas.width = img.naturalWidth;
    canvas.height = img.naturalHeight;
    const ctx = canvas.getContext("2d");
    ctx.drawImage(img, 0, 0);
    const data = ctx.getImageData(0, 0, canvas.width, canvas.height);
    return { width: data.width, height: data.height, data: Array.from(data.data) };
  });
  const text = jsQR(Uint8ClampedArray.from(qr.data), qr.width, qr.height)?.data || "";
  ok(text.startsWith(`https://${HOST}/mobil/#eslesme=`), `karekod: ${text.replace(/=.*/, "=…")}`);
  await shot("03-karekod");
  await desk.keyboard.press("Escape");
  await waitState("connected");
  ok((await desk.textContent("[data-tunnel-label]")).trim() === "Bağlı", `durum Bağlı: ${await line()}`);
  ok(!/ — /.test(await line()), "bağlıyken neden yazısı yok");
  await shot("04-bagli");
});

await step("T4 lisans salt okunur → Kapalı (neden: lisans); dönünce Bağlı", async () => {
  const original = server.app.license.status;
  server.app.license.status = () => ({ ...original(), writable: false });
  try {
    await waitState("off");
    ok(/Lisans geçerli değil; uzaktan bağlantı kapalı\./.test(await line()), `neden: ${await line()}`);
    await shot("05-lisans");
  } finally {
    server.app.license.status = original;
  }
  await waitState("connected");
  ok((await desk.textContent("[data-tunnel-label]")).trim() === "Bağlı", "lisans dönünce Bağlı");
});

ok(pageErrors.length === 0, `sayfa hatası yok (${pageErrors.join(" | ") || "—"})`);
await browser.close();
await server.close();
rmSync(root, { recursive: true, force: true });
console.log(`\n${passed} geçti, ${failed} kaldı`);
process.exit(failed ? 1 : 0);
