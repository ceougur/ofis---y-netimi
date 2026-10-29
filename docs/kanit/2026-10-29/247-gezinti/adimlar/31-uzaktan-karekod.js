// Yönetim → Mobil Cihazlar: "Uzaktan Bağlanabilir" işaretle (gerçek tıklama) → Karekod Oluştur → karekodu GÖRÜNTÜDEN çöz (jsQR; telefonun kamerası gibi) →
// pencereyi kapat → Uzaktan Bağlantı satırı kendiliğinden "Bağlı" (programın tünel yöneticisi sahte cloudflared'i açar; kapıcının canlı yolu ona bağlanır).
const { default: jsQR } = await import(repo + "/node_modules/jsqr/dist/jsQR.js");
vars.karekodOku = async page => {
  await page.waitForSelector(".hof-modal-backdrop.is-visible [data-mobile-qr] svg");
  const qr = await page.evaluate(async () => {
    const svg = document.querySelector("[data-mobile-qr] svg");
    const img = new Image();
    img.src = `data:image/svg+xml;charset=utf-8,${encodeURIComponent(new XMLSerializer().serializeToString(svg))}`;
    await img.decode();
    const canvas = document.createElement("canvas");
    canvas.width = img.naturalWidth; canvas.height = img.naturalHeight;
    const ctx = canvas.getContext("2d"); ctx.drawImage(img, 0, 0);
    const d = ctx.getImageData(0, 0, canvas.width, canvas.height);
    return { width: d.width, height: d.height, data: Array.from(d.data) };
  });
  return jsQR(Uint8ClampedArray.from(qr.data), qr.width, qr.height)?.data || "";
};
const adminId = (await desk.$eval("[data-mobile-user]", r => r.dataset.mobileUser));
vars.adminId = adminId;
const row = `[data-mobile-user="${adminId}"]`;
const put = desk.waitForResponse(r => /\/api\/admin\/mobile\/access\//.test(r.url()), { timeout: 15000 });
await desk.click(`${row} [data-mobile-remote]`);
yaz("PUT uzaktan erişim", (await put).status());
await desk.waitForSelector("[data-tunnel-url]", { timeout: 15000 }).catch(() => null);
yaz("tünel satırı (işaretten sonra)", await desk.$eval("[data-mobile-tunnel]", e => `${e.dataset.state}: ${e.innerText.replace(/\s+/g, " ").trim()}`));
yaz("DB mobile_access", hub("SELECT * FROM sqlite_master WHERE name LIKE 'mobile%'").map(r => r.name).join(","));
await desk.waitForFunction(sel => !document.querySelector(sel)?.disabled, `${row} [data-mobile-code]`);
await desk.click(`${row} [data-mobile-code]`);
const url = await vars.karekodOku(desk);
vars.url1 = url;
yaz("karekod içeriği", url.replace(/=.+/, "=…"), "ofis alt adı mı?", url.startsWith(`https://${ofisId()}.destekofis.test/mobil/#eslesme=`));
await desk.screenshot({ path: root + "/ekran/31a-karekod.png" });
yaz("karekod penceresi metni", await desk.$eval(".hof-modal-backdrop.is-visible", e => e.innerText.replace(/\s+/g, " ").trim().slice(0, 400)));
await desk.keyboard.press("Escape");
await desk.waitForSelector('[data-mobile-tunnel][data-state="connected"]', { timeout: 20000 }).catch(() => null);
yaz("tünel satırı (karekoddan sonra)", await desk.$eval("[data-mobile-tunnel]", e => `${e.dataset.state}: ${e.innerText.replace(/\s+/g, " ").trim()}`));
yaz("kapıcıya başvuru", world.gateCalls, "sahte cloudflared günlüğü", cfLog().trim().split("\n").length, "satır");
