// Pencereleri kapat (Esc) → yan menü Cari → + Yeni Cari: formun alanları.
// (Cari penceresi ilk denemede açıldı; düğme seçicisi Başlarken'deki gizli düğmeye takıldı → pencere içindeki düğme.)
await desk.click('.hof-modal-backdrop.is-visible button:has-text("Yeni Cari")');
await bekle(900);
const fields = await desk.$$eval(".hof-modal-backdrop.is-visible input:visible, .hof-modal-backdrop.is-visible select:visible, .hof-modal-backdrop.is-visible textarea:visible", els => els.map(e => `${e.tagName}:${e.name}:${e.type}:${e.placeholder || ""}:${e.value}`));
yaz("alanlar", fields);
