// Sütunlar → "Yol" ve "Birim" işaretini kaldır (gerçek tıklama) → ekranda yok; PDF ve Excel indir → dosyalarda yok, Kalem Açıklaması VAR, "Satış", "Faturası" yok.
const TOP = ".hof-modal-backdrop.is-visible:nth-last-child(1 of .hof-modal-backdrop.is-visible)";
const { pdfText, xlsxRows } = await import(repo + "/test/fixtures/rapor-dosya-oku.mjs");
await desk.click(`${TOP} [data-rc-cols] > summary`);
await desk.waitForSelector(`${TOP} [data-rc-cols][open] input[data-col="Yol"]`, { state: "visible" });
for (const col of ["Yol", "Birim"]) {
  const r = desk.waitForResponse(res => res.url().includes("/report-center/cari-ekstre/columns") && res.request().method() === "PUT", { timeout: 15000 });
  await desk.click(`${TOP} [data-rc-cols] input[data-col="${col}"]`);
  yaz(`PUT sütun ${col}`, (await r).status());
  await bekle(900);
}
await desk.screenshot({ path: root + "/ekran/23a-sutunlar-acik.png" });
const heads = await desk.$$eval(`${TOP} .hof-rc-table thead th`, ths => ths.map(th => th.textContent.trim()));
yaz("ekran kolonları", heads.join(" | "));
await desk.click(`${TOP} [data-rc-cols] > summary`);
await bekle(400);
const pdf = await indir(desk, () => desk.click(`${TOP} .hof-rep-out.is-pdf`), "23-ayrintili-ekstre.pdf");
const xls = await indir(desk, () => desk.click(`${TOP} .hof-rep-out.is-xlsx`), "23-ayrintili-ekstre.xlsx");
yaz("indirilen", pdf.suggested, xls.suggested);
const text = await pdfText(pdf.file);
const t1 = text.replace(/\s+/g, " ");
yaz("PDF: Yol yok?", !/\bYol\b/.test(t1), "Birim yok?", !/\bBirim\b(?! Fiyat)/.test(t1), "Kalem Açıklaması var?", /Kalem Açıklaması/.test(t1), "açıklama metni?", /Banyo kapısı 90x190/.test(t1), "Satış FIS?", /Satış FIS2026000000001/.test(t1), "Faturası yok?", !/Faturası/.test(t1), "Fatura kalemleriyle yok?", !/Fatura kalemleriyle/i.test(t1), "STOKNOTU yok?", !/STOKNOTU247/.test(t1));
yaz("PDF baş", t1.slice(0, 260));
const rows = await xlsxRows(xls.file);
const headRow = rows.find(r => r.some(c => String(c).includes("Kalem Açıklaması"))) || [];
yaz("Excel başlık", headRow.join(" | "));
const flat = rows.map(r => r.join(" | ")).join("\n");
yaz("Excel: Yol yok?", !headRow.includes("Yol"), "Birim yok?", !headRow.includes("Birim"), "açıklama?", /Banyo kapısı 90x190/.test(flat), "Satış?", /\bSatış\b/.test(flat), "Faturası yok?", !/Faturası/.test(flat), "STOKNOTU yok?", !/STOKNOTU247/.test(flat));
yaz("Excel son satırlar", rows.slice(-3).map(r => r.filter(c => c !== "" && c != null).join(" | ")));
