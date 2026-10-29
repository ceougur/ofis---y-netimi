// Yeni Cari: Ad Soyad / Unvan "Ayşe Demir" → Tab ... Telefon → Kaydet. Sonra ikinci cari "Mehmet Kaya" (mobil adımlar için).
const M = ".hof-modal-backdrop.is-visible";
await desk.click(`${M} input[name=name]`);
await typeSlow(desk, "Ayşe Demir");
await desk.click(`${M} input[name=phone]`);
await typeSlow(desk, "0532 111 22 33");
await desk.keyboard.press("Tab");
await desk.screenshot({ path: root + "/ekran/07a-yeni-cari-form.png" });
const buttons = await desk.$$eval(`${M} button:visible`, els => els.map(e => e.textContent.trim()).filter(Boolean));
yaz("düğmeler", buttons);
const resp = desk.waitForResponse(r => /\/api\/workspace\/accounts(\?|$)/.test(r.url()) && r.request().method() === "POST", { timeout: 15000 });
await desk.click(`${M} button:has-text("Kaydet")`);
const r = await resp;
yaz("POST cari", r.status());
await bekle(1200);
yaz("DB cariler", sql("SELECT id, ref_no, name, phone, type FROM accounts"));
