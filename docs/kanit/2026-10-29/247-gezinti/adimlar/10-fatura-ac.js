// Stok'u kapat → Fatura → yeni satış belgesi: ekran.
const TOP = ".hof-modal-backdrop.is-visible:nth-last-child(1 of .hof-modal-backdrop.is-visible)";
for (let i = 0; i < 4 && (await desk.$(".hof-modal-backdrop.is-visible")); i += 1) { await desk.keyboard.press("Escape"); await bekle(350); }
await desk.click('#hof-sidecard [data-action="invoices"]');
await bekle(1500);
yaz("düğmeler", await desk.$$eval(`${TOP} button:visible`, els => els.map(e => `${e.textContent.trim()}|${e.dataset.act || e.dataset.action || ""}`).filter(t => t.length > 1).slice(0, 40)));
