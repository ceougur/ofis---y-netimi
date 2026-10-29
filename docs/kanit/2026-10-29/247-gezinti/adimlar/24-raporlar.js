// (a) Pencereleri kapat, sayfayı YENİDEN YÜKLE → cari kartı → Ayrıntılı Ekstre: sütun seçimi hatırlandı mı (Yol, Birim yok)?
// (b) Cari kartı → "Cari Ekstre - PDF" indir: satırlar, bakiye 9.700.
// (c) Raporlar → Kasa Hareketleri: satırlar = 2.000 nakit, TOPLAM; PDF + Excel.
const TOP = ".hof-modal-backdrop.is-visible:nth-last-child(1 of .hof-modal-backdrop.is-visible)";
const { readFileSync } = await import("node:fs");
const { pdfText, xlsxRows } = await import(repo + "/test/fixtures/rapor-dosya-oku.mjs");
await desk.reload();
await desk.waitForSelector("#hof-sidecard", { timeout: 60000 });
await bekle(1000);
await desk.click('#hof-sidecard [data-action="accounts"]');
await desk.waitForSelector(`${TOP} :text("Ayşe Demir")`);
await desk.click(`${TOP} :text("Ayşe Demir")`);
await desk.waitForSelector(`${TOP} [data-act=detailStatement]`);
const cariPdf = await indir(desk, () => desk.click(`${TOP} button:has-text("Cari Ekstre - PDF"), ${TOP} a:has-text("Cari Ekstre - PDF")`), "24-cari-ekstre.pdf");
const ct = pdfText(readFileSync(cariPdf.file)).replace(/\s+/g, " ");
yaz("(b) Cari Ekstre PDF", ct.slice(0, 420));
yaz("(b) 9.700 var?", /9\.700,00/.test(ct), "Satış?", /Satış/.test(ct), "Faturası?", /Faturası/.test(ct));
await desk.click(`${TOP} [data-act=detailStatement]`);
await desk.waitForSelector(`${TOP} .hof-rc-table tbody tr`, { timeout: 20000 });
await bekle(800);
yaz("(a) yeniden açılışta kolonlar", (await desk.$$eval(`${TOP} .hof-rc-table thead th`, ths => ths.map(th => th.textContent.trim()))).join(" | "));
// (c) Kasa raporu: sol listeden "Kasa Hareketleri"
await desk.click(`${TOP} :text-is("Kasa Hareketleri")`);
await bekle(1500);
await desk.waitForSelector(`${TOP} .hof-rc-table tbody tr`, { timeout: 20000 }).catch(() => null);
const kasa = await desk.evaluate(sel => {
  const node = document.querySelector(sel);
  return { baslik: node.querySelector(".hof-rc-head h3, h3")?.textContent.trim(), scope: node.querySelector(".hof-rc-scope")?.textContent.trim(), heads: [...node.querySelectorAll(".hof-rc-table thead th")].map(t => t.textContent.trim()), rows: [...node.querySelectorAll(".hof-rc-table tbody tr")].map(tr => [...tr.children].map(td => td.textContent.trim()).join(" | ")), totals: [...node.querySelectorAll(".hof-rc-table tfoot tr")].map(tr => [...tr.children].map(td => td.textContent.trim()).filter(Boolean).join(" | ")) };
}, TOP);
yaz("(c) Kasa raporu", JSON.stringify(kasa));
await desk.screenshot({ path: root + "/ekran/24c-kasa-raporu.png" });
const kp = await indir(desk, () => desk.click(`${TOP} .hof-rep-out.is-pdf`), "24-kasa-hareketleri.pdf");
const kx = await indir(desk, () => desk.click(`${TOP} .hof-rep-out.is-xlsx`), "24-kasa-hareketleri.xlsx");
const kpt = pdfText(readFileSync(kp.file)).replace(/\s+/g, " ");
yaz("(c) Kasa PDF", kpt.slice(0, 400));
yaz("(c) Kasa Excel son", xlsxRows(readFileSync(kx.file)).slice(-3).map(r => r.filter(c => c !== "" && c != null).join(" | ")));
yaz("API Kasa", JSON.stringify((await api("/api/workspace/cash")).data.data.totals));
