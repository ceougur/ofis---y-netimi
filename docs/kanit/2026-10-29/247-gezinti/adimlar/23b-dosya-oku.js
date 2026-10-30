// 23'te indirilen dosyalar geçerli PDF/XLSX; okuyucu Buffer bekliyor (araç hatası). Ayrıca indirilen dosya adı "download" — bağlantının Content-Disposition'ı okunur.
const TOP = ".hof-modal-backdrop.is-visible:nth-last-child(1 of .hof-modal-backdrop.is-visible)";
const { readFileSync } = await import("node:fs");
const { pdfText, xlsxRows } = await import(repo + "/test/fixtures/rapor-dosya-oku.mjs");
const links = await desk.$$eval(`${TOP} .hof-rep-out`, as => as.map(a => ({ href: a.getAttribute("href"), download: a.getAttribute("download"), target: a.target })));
yaz("bağlantılar", links);
for (const l of links) {
  const h = await desk.evaluate(async href => { const r = await fetch(href, { credentials: "same-origin" }); return { s: r.status, cd: r.headers.get("content-disposition"), ct: r.headers.get("content-type") }; }, l.href);
  yaz("başlık", JSON.stringify(h));
}
const t1 = pdfText(readFileSync(root + "/indirilen/23-ayrintili-ekstre.pdf")).replace(/\s+/g, " ");
yaz("PDF: Yol yok?", !/\bYol\b/.test(t1), "Birim kolonu yok?", !/\bBirim\b(?! Fiyat)/.test(t1), "Kalem Açıklaması var?", /Kalem Açıklaması/.test(t1), "açıklama metni?", /Banyo kapısı 90x190/.test(t1), "Satış FIS?", /Satış FIS2026000000001/.test(t1), "Faturası yok?", !/Faturası/.test(t1), "Fatura kalemleriyle yok?", !/Fatura kalemleriyle/i.test(t1), "B: borçlu yok?", !/B: borçlu/.test(t1), "STOKNOTU yok?", !/STOKNOTU247/.test(t1), "Genel Toplam 9.700?", /9\.700,00/.test(t1));
yaz("PDF baş", t1.slice(0, 300));
const rows = xlsxRows(readFileSync(root + "/indirilen/23-ayrintili-ekstre.xlsx"));
const headRow = rows.find(r => r.some(c => String(c).includes("Kalem Açıklaması"))) || [];
yaz("Excel başlık", headRow.join(" | "));
const flat = rows.map(r => r.join(" | ")).join("\n");
yaz("Excel: Yol yok?", !headRow.includes("Yol"), "Birim yok?", !headRow.includes("Birim"), "açıklama?", /Banyo kapısı 90x190/.test(flat), "Satış?", /\bSatış\b/.test(flat), "Faturası yok?", !/Faturası/.test(flat), "STOKNOTU yok?", !/STOKNOTU247/.test(flat));
yaz("Excel ilk 3", rows.slice(0, 3).map(r => r.filter(c => c !== "" && c != null).join(" | ")));
yaz("Excel son 2", rows.slice(-2).map(r => r.filter(c => c !== "" && c != null).join(" | ")));
