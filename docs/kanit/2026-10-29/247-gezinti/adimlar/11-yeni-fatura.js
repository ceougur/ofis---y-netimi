// + Yeni Fatura: formun alanları.
const TOP = ".hof-modal-backdrop.is-visible:nth-last-child(1 of .hof-modal-backdrop.is-visible)";
await desk.click(`${TOP} [data-act=new]`);
await bekle(1500);
yaz("pencere", await desk.$eval(`${TOP} h2`, e => e.textContent.trim()).catch(() => "?"));
yaz("alanlar", await desk.$$eval(`${TOP} input:visible, ${TOP} select:visible, ${TOP} textarea:visible`, els => els.map(e => `${e.tagName}:${e.name || e.dataset.f || e.dataset.field || ""}:${e.type}:${e.placeholder || ""}:${e.value}`)));
yaz("düğmeler", await desk.$$eval(`${TOP} button:visible`, els => els.map(e => `${e.textContent.trim()}|${e.dataset.act || ""}|${e.title || ""}`).filter(t => t.length > 2)));
