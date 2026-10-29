// 170 2S2Ç kartı: s1 Birim Fiyat'a 100 yaz + Enter (miktar 2 önceki adımda Enter ile girildi). Beklenen: Ara 200, KDV %20 → 40, Toplam 240,
// Maliyet %20 → 288, ÷170 = 1,69. Sonra Çık → kaydedilmemiş değişiklik sorusu (beklenen, meşru — ders 34) → Kaydet → veri tabanı.
const MODAL = ".hof-modal-backdrop.is-visible";
const ROOT = `${MODAL} .hof-maliyet-modal [data-maliyet]`;
const C2 = `${ROOT} [data-kart="cam/170-2s2c-h182"]`;
// (ilk deneme: açık sekme Bayi Fiyat Listesi 2 idi — PDF döngüsünün sonu; önce Cam Maliyet sekmesine geç)
await desk.click(`${ROOT} [data-sekme="cam"]`);
await desk.waitForSelector(C2);
await bekle(300);
yaz("s1 miktar", await desk.inputValue(`${C2} tbody tr[data-satir="s1"] [data-alan="miktar"]`));
await desk.click(`${C2} tbody tr[data-satir="s1"] [data-alan="fiyat"]`, { clickCount: 3 });
await typeSlow(desk, "100");
await desk.keyboard.press("Enter");
await bekle(500);
const vals = await desk.$$eval(`${C2} [data-adim]`, as => as.map(a => `${a.dataset.adim}=${[...a.querySelectorAll("[data-alan=deger], .num, td:last-child, output")].map(x => x.textContent.trim()).filter(Boolean).join("/")}`));
yaz("kart 2 adımları", vals);
yaz("kart 2 metni", await desk.$eval(C2, k => k.innerText.replace(/\s+/g, " ").slice(-220)));
await desk.screenshot({ path: root + "/ekran/26a-maliyet-hesap.png" });
await desk.click(`${MODAL} .hof-maliyet-modal button:text-is("Çık")`);
await bekle(800);
const soru = await desk.$eval(`${MODAL}:nth-last-child(1 of ${MODAL})`, e => e.textContent.replace(/\s+/g, " ").trim().slice(0, 300)).catch(() => "-");
yaz("Çık sonrası üst pencere (soru)", soru);
await desk.screenshot({ path: root + "/ekran/26b-maliyet-soru.png" });
await desk.click(`${MODAL}:nth-last-child(1 of ${MODAL}) [data-answer=save]`);
await bekle(1500);
yaz("SORU YANITI (ders 34): 'Kaydet' — kaydedilmemiş değişiklik vardı (meşru soru)");
yaz("DB kart 2", sql("SELECT satir, miktar, fiyat FROM maliyet_satirlar WHERE kart = 'cam/170-2s2c-h182' AND (miktar IS NOT NULL OR fiyat IS NOT NULL)"));
yaz("DB oranlar", sql("SELECT name FROM sqlite_master WHERE name LIKE 'maliyet%'").map(r => r.name).join(","));
