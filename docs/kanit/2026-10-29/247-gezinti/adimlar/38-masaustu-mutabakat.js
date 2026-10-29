// Telefondaki yazmalardan sonra MASAÜSTÜ: cari kartı → Ayrıntılı Ekstre toplamları; Raporlar → Kasa Hareketleri; Banka hesabı.
// Beklenen (elle, adım adım): Borç 13.200 + 100 (ödeme) = 13.300; Alacak 2.000 + 1.500 + 500 + 300 + 200 = 4.500; Bakiye 8.800 B.
// Kasa 2.000 + 500 − 100 = 2.400 (3 satır); Banka 10.000 + 1.500 + 300 + 200 = 12.000.
const TOP = ".hof-modal-backdrop.is-visible:nth-last-child(1 of .hof-modal-backdrop.is-visible)";
for (let i = 0; i < 4 && (await desk.$(".hof-modal-backdrop.is-visible")); i += 1) { await desk.keyboard.press("Escape"); await bekle(350); }
await desk.click('#hof-sidecard [data-action="accounts"]');
await desk.waitForSelector(`${TOP} :text("Ayşe Demir")`);
await desk.click(`${TOP} :text("Ayşe Demir")`);
await desk.waitForSelector(`${TOP} [data-act=detailStatement]`);
await bekle(800);
yaz("cari kartı hareketleri", await desk.$eval(TOP, e => e.innerText.replace(/\s+/g, " ").trim().slice(-700)));
await desk.screenshot({ path: root + "/ekran/38a-masaustu-cari-sonra.png" });
await desk.click(`${TOP} [data-act=detailStatement]`);
await desk.waitForSelector(`${TOP} .hof-rc-table tbody tr`, { timeout: 20000 });
await bekle(800);
yaz("Ayrıntılı Ekstre satırları", await desk.$$eval(`${TOP} .hof-rc-table tbody tr`, trs => trs.map(tr => [...tr.children].map(td => td.textContent.trim()).filter(Boolean).join(" | "))));
yaz("Ayrıntılı Ekstre toplam", await desk.$$eval(`${TOP} .hof-rc-table tfoot tr`, trs => trs.map(tr => [...tr.children].map(td => td.textContent.trim()).filter(Boolean).join(" | "))));
await desk.screenshot({ path: root + "/ekran/38b-ayrintili-ekstre-sonra.png" });
await desk.click(`${TOP} :text-is("Kasa Hareketleri")`);
await bekle(1500);
yaz("Kasa Hareketleri", await desk.$$eval(`${TOP} .hof-rc-table tbody tr, ${TOP} .hof-rc-table tfoot tr`, trs => trs.map(tr => [...tr.children].map(td => td.textContent.trim()).filter(Boolean).join(" | "))));
yaz("API Kasa", JSON.stringify((await api("/api/workspace/cash")).data.data.totals), "Banka", (await api("/api/workspace/bank/accounts")).data.data.accounts.map(a => a.balanceMinor / 100));
