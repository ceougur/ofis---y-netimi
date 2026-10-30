// Fatura'yı kapat → Cari → listede "Ayşe Demir" satırına tıkla → cari kartı: bakiye, düğmeler.
const TOP = ".hof-modal-backdrop.is-visible:nth-last-child(1 of .hof-modal-backdrop.is-visible)";
for (let i = 0; i < 4 && (await desk.$(".hof-modal-backdrop.is-visible")); i += 1) { await desk.keyboard.press("Escape"); await bekle(350); }
await desk.click('#hof-sidecard [data-action="accounts"]');
await desk.waitForSelector(`${TOP} :text("Ayşe Demir")`);
yaz("liste satırı", await desk.$eval(`${TOP} tr:has-text("Ayşe Demir")`, e => e.textContent.replace(/\s+/g, " ").trim()).catch(() => "?"));
await desk.click(`${TOP} :text("Ayşe Demir")`);
await bekle(1500);
yaz("kart düğmeleri", await desk.$$eval(`${TOP} button:visible`, els => els.map(e => `${e.textContent.trim()}|${e.dataset.act || ""}`).filter(t => t.length > 2)));
yaz("kart özeti", await desk.$eval(TOP, e => e.textContent.replace(/\s+/g, " ").trim().slice(0, 700)));
