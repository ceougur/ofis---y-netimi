// 3 CİHAZ SINIRI: Yönetim → Mobil Cihazlar → Karekod Oluştur (her cihaz için yeni karekod, görüntüden çözülür) → tablet (820×1180) ve telefon3 eşlenir (2 → 3).
// 4. cihaz (telefon4): Karekod Oluştur → beklenen RET (karekod üretilmez ya da eşleme reddedilir) ve gerekçeli ileti; DB'de 3 cihaz, kapıcıda 3 cihaz.
const row = `[data-mobile-user="${vars.adminId}"]`;
await desk.goto(base() + "/admin.html#mobile");
await desk.waitForSelector(`${row} [data-mobile-code]`, { timeout: 20000 });
await bekle(800);
const esle = async (ad, boyut, cihazAdi) => {
  await desk.waitForFunction(sel => !document.querySelector(sel)?.disabled, `${row} [data-mobile-code]`, { timeout: 5000 }).catch(() => null);
  const codeResp = desk.waitForResponse(r => /\/api\/admin\/mobile\/codes/.test(r.url()), { timeout: 15000 });
  await desk.click(`${row} [data-mobile-code]`);
  const cr = await codeResp.catch(() => null);
  const crBody = cr ? await cr.text().catch(() => "") : "";
  yaz(`${ad}: karekod isteği`, cr ? cr.status() : "yanıt yok", crBody.replace(/"code":"[^"]+"/, '"code":"…"').replace(/eslesme=[^"]+/, "eslesme=…").slice(0, 220));
  await bekle(800);
  const url = await Promise.race([vars.karekodOku(desk), bekle(4000).then(() => "")]);
  const pencere = await desk.$eval(".hof-modal-backdrop.is-visible", e => e.innerText.replace(/\s+/g, " ").trim().slice(0, 300)).catch(() => "");
  const bildirim = await desk.$$eval(".hof-toast, [role=alert], [role=status]", t => t.map(x => x.textContent.trim()).filter(Boolean).join(" | ")).catch(() => "");
  if (pencere) await desk.keyboard.press("Escape");
  await bekle(400);
  if (!url) return { url: "", pencere, bildirim };
  const p = await newPhone(ad, boyut);
  await p.goto(url);
  await p.waitForSelector("#pair-form:not(.hidden)", { timeout: 20000 });
  await p.click("#device-name", { clickCount: 3 });
  await typeSlow(p, cihazAdi);
  await p.click("#pair-submit");
  await p.waitForSelector("#login-form:not(.hidden), #pair-error:not(.hidden), .error-box, [role=alert]", { timeout: 20000 }).catch(() => null);
  return { url, pencere, bildirim, ekran: await p.$eval("body", e => e.innerText.replace(/\s+/g, " ").trim().slice(0, 200)) };
};
const t2 = await esle("tablet", { width: 820, height: 1180 }, "Ofis Tableti");
yaz("tablet", JSON.stringify({ ...t2, url: t2.url.replace(/=.+/, "=…") }));
const t3 = await esle("telefon3", undefined, "Saha Telefonu");
yaz("telefon3", JSON.stringify({ ...t3, url: t3.url.replace(/=.+/, "=…") }));
yaz("DB cihaz sayısı (3 beklenir)", hub("SELECT COUNT(*) AS n FROM mobile_devices")[0].n, "kapıcı", (kapi.meta(ofisId())?.cihazlar || []).length);
await desk.reload();
await desk.waitForSelector(`${row} [data-mobile-code]`, { timeout: 20000 });
await bekle(1000);
yaz("Yönetim (3 cihaz)", await desk.$eval("#adm-mobile-users", e => e.closest("section, main")?.innerText.replace(/\s+/g, " ").trim().slice(0, 900)));
await desk.screenshot({ path: root + "/ekran/39a-yonetim-uc-cihaz.png", fullPage: true });
yaz("karekod düğmesi pasif mi", await desk.$eval(`${row} [data-mobile-code]`, b => `${b.disabled} ${b.title || ""}`));
const t4 = await esle("telefon4", undefined, "Dördüncü Telefon");
yaz("telefon4 (RET beklenir)", JSON.stringify({ ...t4, url: t4.url.replace(/=.+/, "=…") }));
await desk.screenshot({ path: root + "/ekran/39b-dorduncu-cihaz.png" });
// Doğrudan API ile de dene (karekod düğmesi pasif olsa bile sunucu kuralı):
const direct = await api("/api/admin/mobile/codes", "POST", { userId: vars.adminId });
yaz("API karekod (4. cihaz)", direct.status, JSON.stringify(direct.data).replace(/eslesme=[^"]+/, "eslesme=…").slice(0, 300));
if (direct.status === 200 && direct.data?.data?.url) {
  const p4 = phones.telefon4 || await newPhone("telefon4");
  await p4.goto(direct.data.data.url);
  await p4.waitForSelector("#pair-form:not(.hidden)", { timeout: 20000 });
  await p4.click("#device-name", { clickCount: 3 });
  await typeSlow(p4, "Dördüncü Telefon");
  const pr = p4.waitForResponse(r => /\/api\/mobil\/eslesme/.test(r.url()), { timeout: 15000 });
  await p4.click("#pair-submit");
  const r = await pr.catch(() => null);
  yaz("4. cihaz eşleme yanıtı", r ? r.status() : "yok", r ? (await r.text()).slice(0, 250) : "");
  await bekle(800);
  yaz("4. cihaz ekranı", await p4.$eval("body", e => e.innerText.replace(/\s+/g, " ").trim().slice(0, 300)));
  await p4.screenshot({ path: root + "/ekran/39c-dorduncu-ret.png", fullPage: true });
}
yaz("SON DB cihaz sayısı", hub("SELECT COUNT(*) AS n FROM mobile_devices")[0].n, hub("SELECT name FROM mobile_devices").map(d => d.name), "kapıcı", (kapi.meta(ofisId())?.cihazlar || []).length);
