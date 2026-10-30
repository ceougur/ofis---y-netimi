// 36 ilk denemesi: Playwright route.fetch() isteği Node tarafından yeniden gönderir ve tarayıcının --host-resolver-rules eşlemesini KULLANMAZ → ofisin alt adı
// çözülemedi, istek askıda kaldı (test aracı sınırı, ürün değil). Durum: sunucuya bir şey yazıldı mı, telefon ne gösteriyor?
const p = phones.telefon1;
await bekle(3000);
yaz("plan_entries", sql("SELECT kind, amount, method FROM plan_entries ORDER BY rowid"));
yaz("account_entries", sql("SELECT kind, amount, method FROM account_entries ORDER BY rowid"));
yaz("telefon form/uyarı", await p.$eval(".yz-sheet", e => e.innerText.replace(/\s+/g, " ").trim().slice(-300)).catch(() => "form yok"));
yaz("olaylar", g.cfLog().length);
