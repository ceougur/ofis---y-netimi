// Ayarlar (yan çubuk) → Sektörü Değiştir → "duşakabin" yaz → Enter. Önce Stok penceresinde Maliyet girişi YOK, sonra VAR.
const MODAL = ".hof-modal-backdrop.is-visible";
const durum0 = await api("/api/maliyet/durum");
yaz("önce /api/maliyet/durum", durum0.status, JSON.stringify(durum0.data).slice(0, 160));
await desk.click("#hof-side-settings");
await desk.waitForSelector(`${MODAL} [data-profile-pick]`);
await bekle(300);
await desk.screenshot({ path: root + "/ekran/03a-veri-ayarlari.png" });
await desk.click(`${MODAL} [data-profile-pick]`);
await desk.waitForSelector(`${MODAL} .hof-picker input[type="search"]`);
await bekle(250);
await typeSlow(desk, "duşakabin");
await bekle(300);
await desk.keyboard.press("Enter");
await desk.waitForFunction(() => document.documentElement.dataset.hofSector === "dusakabin", null, { timeout: 10000 });
const durum1 = await api("/api/maliyet/durum");
yaz("sonra /api/maliyet/durum", durum1.status, JSON.stringify(durum1.data).slice(0, 200));
yaz("DB sektör", sql("SELECT key, value FROM settings WHERE key LIKE '%insight.sector%'"));
for (let i = 0; i < 4 && (await desk.$(MODAL)); i += 1) { await desk.keyboard.press("Escape"); await bekle(300); }
