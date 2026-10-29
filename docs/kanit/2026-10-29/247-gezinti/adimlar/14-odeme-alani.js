// Ödeme / kalan alanı: vade nerede? Alt bölüme kaydır, alanları oku.
const TOP = ".hof-modal-backdrop.is-visible:nth-last-child(1 of .hof-modal-backdrop.is-visible)";
await desk.$eval(`${TOP} [data-act=pay-rest]`, e => e.scrollIntoView({ block: "center" }));
await bekle(400);
yaz("ödeme bölümü", await desk.$eval(`${TOP} [data-act=pay-rest]`, e => e.closest("section, fieldset, .hof-inv-pay, div")?.parentElement?.textContent.replace(/\s+/g, " ").trim().slice(0, 600)));
yaz("tüm alanlar", await desk.$$eval(`${TOP} input:visible, ${TOP} select:visible`, els => els.map(e => `${e.dataset.f || e.name || e.dataset.p || ""}:${e.type}:${e.value}`)));
