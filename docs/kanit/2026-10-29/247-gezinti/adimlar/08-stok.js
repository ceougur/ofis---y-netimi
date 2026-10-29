// Cari penceresini kapat → Stok → yeni ürün formu alanları ve düğmeler.
const TOP = ".hof-modal-backdrop.is-visible:nth-last-child(1 of .hof-modal-backdrop.is-visible)";
for (let i = 0; i < 4 && (await desk.$(".hof-modal-backdrop.is-visible")); i += 1) { await desk.keyboard.press("Escape"); await bekle(350); }
await desk.click('#hof-sidecard [data-action="stock"]');
await desk.waitForSelector(`${TOP} .hof-stock-modal`);
await bekle(800);
yaz("stok düğmeleri", await desk.$$eval(`${TOP} button`, els => els.map(e => `${e.textContent.trim()}|${e.dataset.act || ""}`).filter(t => t.length > 1)));
await desk.screenshot({ path: root + "/ekran/08a-stok-penceresi.png" });
await desk.click(`${TOP} button:has-text("Yeni")`);
await bekle(800);
yaz("form", await desk.$$eval(`${TOP} input:visible, ${TOP} select:visible, ${TOP} textarea:visible`, els => els.map(e => `${e.tagName}:${e.name}:${e.type}:${e.value}`)));
yaz("form düğmeleri", await desk.$$eval(`${TOP} button:visible`, els => els.map(e => e.textContent.trim()).filter(Boolean)));
