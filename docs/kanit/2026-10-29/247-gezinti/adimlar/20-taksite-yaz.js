// "Taksite Yaz · Ayşe Demir" → form alanları.
const TOP = ".hof-modal-backdrop.is-visible:nth-last-child(1 of .hof-modal-backdrop.is-visible)";
await desk.click(`${TOP} button:has-text("Taksite Yaz")`);
await bekle(1200);
yaz("pencere", await desk.$eval(`${TOP} h2`, e => e.textContent.trim()));
yaz("alanlar", await desk.$$eval(`${TOP} input:visible, ${TOP} select:visible, ${TOP} textarea:visible`, els => els.map(e => `${e.name || e.dataset.f || ""}:${e.type}:${e.value}:${e.tagName === "SELECT" ? [...e.options].map(o => o.textContent.trim()).join("/") : ""}`)));
yaz("düğmeler", await desk.$$eval(`${TOP} button:visible`, els => els.map(e => e.textContent.trim()).filter(Boolean)));
