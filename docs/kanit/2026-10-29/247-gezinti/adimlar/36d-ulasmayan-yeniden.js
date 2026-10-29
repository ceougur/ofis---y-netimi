// 36'da sunucuya HİÇ ulaşmayan istek (300 TL taksit kartına, Havale) sayfa yeniden yüklenince "Sonucu Belirsiz İşlemler (1)" olarak duruyor (IndexedDB).
// Gerçek bir bağlantı kopması gibi: Yeniden Gönder → beklenen: TEK kayıt (300, bank) ve banka +300.
const p = phones.telefon1;
// İlk deneme: 36'nın route işleyicisi (route.fetch → ENOTFOUND) kaldırılmadan kalmıştı (adım hata verince unroute koşmadı) → Yeniden Gönder isteği de o
// işleyicide askıda kaldı (araç hatası). Bütün yönlendirmeler kaldırılır, sayfa yeniden yüklenir.
await p.unrouteAll({ behavior: "ignoreErrors" });
await p.reload();
await p.waitForSelector("#yz-pending [data-yz-resend]", { timeout: 20000 });
await bekle(800);
const bank0 = (await api("/api/workspace/bank/accounts")).data.data.accounts[0].balanceMinor / 100;
yaz("önce plan_entries", JSON.stringify(sql("SELECT COUNT(*) AS n, COALESCE(SUM(amount),0) AS t FROM plan_entries")[0]), "banka", bank0);
await p.click("#yz-pending [data-yz-resend]");
await p.waitForSelector(".toast", { timeout: 10000 });
yaz("bildirim", await p.$$eval(".toast", t => t.map(x => x.textContent.trim()).join(" | ")));
await bekle(1200);
yaz("sonra plan_entries", JSON.stringify(sql("SELECT kind, amount, method FROM plan_entries ORDER BY rowid")), "banka", (await api("/api/workspace/bank/accounts")).data.data.accounts[0].balanceMinor / 100);
yaz("bekleyen listesi kaldı mı", await p.isVisible("#yz-pending"));
yaz("cari", (await api("/api/workspace/accounts")).data.data.accounts.map(a => `${a.name} ${a.balance}`));
