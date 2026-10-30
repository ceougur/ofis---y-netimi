// Cari kartı (açık) → Ayrıntılı Ekstre: alt başlık, kolonlar, İşlem "Satış", açıklama "Satış FIS…", Kalem Açıklaması, toplamlar, "Faturası" yok.
const TOP = ".hof-modal-backdrop.is-visible:nth-last-child(1 of .hof-modal-backdrop.is-visible)";
yaz("plan_entries", sql("SELECT kind, amount, method, item_id IS NOT NULL AS kalemli FROM plan_entries"));
await desk.click(`${TOP} [data-act=detailStatement]`);
await desk.waitForSelector(`${TOP} .hof-rc-table tbody tr.is-item`, { timeout: 20000 });
await bekle(800);
const view = await desk.evaluate(sel => {
  const node = document.querySelector(sel);
  const heads = [...node.querySelectorAll(".hof-rc-table thead th")].map(th => th.textContent.trim());
  const rows = [...node.querySelectorAll(".hof-rc-table tbody tr")].map(tr => [...tr.children].map(td => td.textContent.trim()).join(" | "));
  const totals = [...node.querySelectorAll(".hof-rc-table tfoot tr")].map(tr => [...tr.children].map(td => td.textContent.trim()).filter(Boolean).join(" | "));
  const box = node.querySelector(".hof-rc-table");
  return { title: node.querySelector("h2")?.textContent.trim(), scope: node.querySelector(".hof-rc-scope")?.textContent.trim(), heads, rows, totals, sutunlar: node.querySelector("[data-rc-cols] > summary")?.textContent.trim(), scroll: box.scrollWidth, client: box.clientWidth, faturasi: /Faturası/.test(node.querySelector(".hof-rc-table").textContent) };
}, TOP);
yaz(JSON.stringify(view, null, 0));
await desk.screenshot({ path: root + "/ekran/22a-ayrintili-ekstre.png" });
