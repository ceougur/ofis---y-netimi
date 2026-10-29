// Başlarken → Şirket Adını Yaz (insan hızında) → kaydet.
await desk.getByRole("button", { name: "Şirket Adını Yaz", exact: true }).click();
await bekle(800);
const inputs = await desk.$$eval("input:visible, select:visible", els => els.map(e => `${e.tagName}:${e.name || e.id}:${e.type}:${e.value}`));
yaz("alanlar", inputs);
const name = await desk.$(".hof-modal-backdrop.is-visible input[name=name], .hof-modal-backdrop.is-visible input[type=text]");
await name.click({ clickCount: 3 });
await typeSlow(desk, "Yıldız Duşakabin");
await desk.screenshot({ path: root + "/ekran/02a-sirket-adi-form.png" });
await desk.keyboard.press("Enter");
await bekle(1500);
yaz("şirketler", hub("SELECT code, name FROM companies"));
