// Maliyet Hesap Kartı (Duşakabin Üretimi): Stok → Maliyet Hesap Kartı.
// Beklenen (2.4.7 kararları): Cam kartlarında "KDV" ve "Maliyet" etiketi SAYISIZ, iki oran kutusu BOŞ; toplama satırı "Toplam"; Mika'da "Masraf%" ve "Maliyet",
// kutular BOŞ, önde "%"; Enter = kaydet + sağdaki kutu; dört sekmede PDF.
const MODAL = ".hof-modal-backdrop.is-visible";
const ROOT = `${MODAL} .hof-maliyet-modal [data-maliyet]`;
const { readFileSync } = await import("node:fs");
const { pdfText } = await import(repo + "/test/fixtures/rapor-dosya-oku.mjs");
for (let i = 0; i < 4 && (await desk.$(MODAL)); i += 1) { await desk.keyboard.press("Escape"); await bekle(350); }
await desk.click('#hof-sidecard [data-action="stock"]');
await desk.waitForSelector(`${MODAL} .hof-stock-modal [data-act="maliyet"]`);
await desk.click(`${MODAL} .hof-stock-modal [data-act="maliyet"]`);
await desk.waitForSelector(`${ROOT} [data-kart]`);
await bekle(500);
const sekmeler = await desk.$$eval(`${ROOT} [data-sekme]`, n => n.map(x => x.textContent.trim()));
yaz("sekmeler", sekmeler.join(" · "));
const kartOku = async () => desk.$$eval(`${ROOT} [data-kart]`, kartlar => kartlar.filter(k => k.offsetParent).map(k => ({
  kart: k.dataset.kart,
  adimlar: [...k.querySelectorAll("[data-adim]")].map(a => ({ adim: a.dataset.adim, etiket: (a.querySelector("[data-alan=etiket], .hof-maliyet-etiket, th, td")?.textContent || "").replace(/\s+/g, " ").trim().slice(0, 40), oran: a.querySelector("[data-alan=oran]")?.value ?? null, onEk: (a.querySelector("[data-alan=oran]")?.parentElement?.textContent || "").replace(/\s+/g, " ").trim().slice(0, 30) })),
})));
const cam = await kartOku();
yaz("Cam kartları", cam.length, JSON.stringify(cam.slice(0, 2)));
yaz("Cam: bütün oran kutuları boş?", cam.every(k => k.adimlar.filter(a => a.oran !== null).every(a => a.oran === "")));
await desk.screenshot({ path: root + "/ekran/25a-maliyet-cam.png" });
await desk.click(`${ROOT} [data-sekme="mika"]`);
await desk.waitForSelector(`${ROOT} [data-sekme-kartlar="mika"]`);
await bekle(400);
const mika = await kartOku();
yaz("Mika kartları", mika.length, JSON.stringify(mika.slice(0, 1)));
yaz("Mika: bütün oran kutuları boş?", mika.every(k => k.adimlar.filter(a => a.oran !== null).every(a => a.oran === "")));
await desk.screenshot({ path: root + "/ekran/25b-maliyet-mika.png" });
// Enter = sağa: Cam sekmesi, 2. kart (170 2S2Ç H:182) ilk satırın Miktar kutusuna 2 yaz → Enter
await desk.click(`${ROOT} [data-sekme="cam"]`);
await bekle(400);
const C2 = `${ROOT} [data-kart="cam/170-2s2c-h182"]`;
const odak = () => desk.evaluate(() => { const el = document.activeElement; return `${el?.closest("[data-satir]")?.dataset.satir || el?.closest("[data-adim]")?.dataset.adim || ""}.${el?.dataset?.alan || el?.tagName}`; });
await desk.click(`${C2} tbody tr[data-satir="s1"] [data-alan="miktar"]`, { clickCount: 3 });
await typeSlow(desk, "2");
await desk.keyboard.press("Enter");
await bekle(300);
yaz("Miktar'da Enter → odak", await odak());
// KDV oranına 20 yaz + Enter → Maliyet oranı; 20 yaz + Enter
await desk.click(`${C2} [data-adim="yuzde"] [data-alan="oran"]`);
await typeSlow(desk, "20");
await desk.keyboard.press("Enter");
await bekle(300);
yaz("KDV'de Enter → odak", await odak());
await typeSlow(desk, "20");
await desk.keyboard.press("Enter");
await bekle(300);
yaz("Maliyet'te Enter → odak", await odak());
yaz("kart 2 değerleri", await desk.$eval(C2, k => k.textContent.replace(/\s+/g, " ").trim().slice(0, 600)));
await desk.screenshot({ path: root + "/ekran/25c-maliyet-enter.png" });
// PDF: dört sekme
for (const kod of ["cam", "liste-1", "mika", "liste-2"]) {
  await desk.click(`${ROOT} [data-sekme="${kod}"]`);
  await desk.waitForSelector(`${ROOT} [data-sekme-kartlar="${kod}"]`);
  await bekle(250);
  const d = await indir(desk, () => desk.click(`${ROOT} [data-maliyet-pdf]`), `25-maliyet-${kod}.pdf`);
  const t = pdfText(readFileSync(d.file)).replace(/\s+/g, " ");
  yaz(`PDF ${kod}`, d.suggested, t.slice(0, 160));
}
yaz("DB taslak yazıldı mı (miktar dolu satır)", sql("SELECT COUNT(*) AS n FROM maliyet_satirlar WHERE kart = 'cam/170-2s2c-h182' AND miktar IS NOT NULL"));
