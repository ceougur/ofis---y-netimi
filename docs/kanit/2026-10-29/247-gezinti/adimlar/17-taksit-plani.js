// Cari kartı → + Taksit Planı: formun alanları ve ön değerleri.
const TOP = ".hof-modal-backdrop.is-visible:nth-last-child(1 of .hof-modal-backdrop.is-visible)";
await desk.click(`${TOP} [data-act=newPlan]`);
await bekle(1200);
yaz("pencere", await desk.$eval(`${TOP} h2`, e => e.textContent.trim()));
yaz("alanlar", await desk.$$eval(`${TOP} input:visible, ${TOP} select:visible`, els => els.map(e => `${e.name || e.dataset.f || ""}:${e.type}:${e.type === "checkbox" || e.type === "radio" ? e.checked : e.value}:${e.closest("label")?.textContent.replace(/\s+/g, " ").trim().slice(0, 80) || ""}`)));
yaz("metin", await desk.$eval(TOP, e => e.textContent.replace(/\s+/g, " ").trim().slice(0, 900)));
