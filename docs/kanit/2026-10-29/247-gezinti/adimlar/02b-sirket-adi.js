// 02'de seçici yanlış alanı (Şirket Kodu) seçti; program "üç haneli olmalı" diye reddetti (doğru). Kodu 001'e geri yaz, Unvan alanına adı yaz, Kaydet.
const M = ".hof-modal-backdrop.is-visible";
await desk.click(`${M} input[name=code]`, { clickCount: 3 });
await typeSlow(desk, "001");
await desk.keyboard.press("Tab");
await desk.keyboard.press("Control+A");
await typeSlow(desk, "Yıldız Duşakabin");
await desk.click(`${M} button:has-text("Kaydet")`);
await bekle(1500);
const hubFile = app().config.dbPath;
yaz("şirketler (hub)", sqlFile(hubFile, "SELECT name FROM sqlite_master WHERE type='table' AND name LIKE '%compan%'"));
