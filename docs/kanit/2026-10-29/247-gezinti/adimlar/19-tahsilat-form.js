// Taksitler penceresini kapat → Cari kartı (Ayşe Demir) → + Tahsilat: form alanları.
const TOP = ".hof-modal-backdrop.is-visible:nth-last-child(1 of .hof-modal-backdrop.is-visible)";
for (let i = 0; i < 4 && (await desk.$(".hof-modal-backdrop.is-visible")); i += 1) { await desk.keyboard.press("Escape"); await bekle(350); }
await desk.click('#hof-sidecard [data-action="accounts"]');
await desk.waitForSelector(`${TOP} :text("Ayşe Demir")`);
await desk.click(`${TOP} :text("Ayşe Demir")`);
await desk.waitForSelector(`${TOP} button:text-is("+ Tahsilat")`);
await desk.click(`${TOP} button:text-is("+ Tahsilat")`);
await bekle(1200);
yaz("pencere", await desk.$eval(`${TOP} h2`, e => e.textContent.trim()));
yaz("alanlar", await desk.$$eval(`${TOP} input:visible, ${TOP} select:visible, ${TOP} textarea:visible`, els => els.map(e => `${e.name || e.dataset.f || ""}:${e.type}:${e.value}:${e.tagName === "SELECT" ? [...e.options].map(o => o.textContent.trim()).join("/") : ""}`)));
yaz("metin", await desk.$eval(TOP, e => e.textContent.replace(/\s+/g, " ").trim().slice(0, 700)));
