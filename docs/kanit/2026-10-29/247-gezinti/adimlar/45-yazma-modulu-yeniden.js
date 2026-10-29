// SAPMA YENİDEN ÜRETME (ders 6): 44'te sunucu dönünce telefon1 canlı ("Sunucu Bağlı") ama cari kartında Tahsilat Gir / Ödeme Gir YOK.
// Kök neden adayı: sayfa sunucu KAPALIYKEN açıldı → app.js import('./yazma.js') kapıcıdan 503 JSON aldı (sw.js ASSETS yazma.js / yazma.css içermiyor) → modül null kalır,
// yeniden denenmez. Sıra: (1) sayfayı CANLIYKEN yeniden yükle → düğmeler VAR mı; (2) program kapat → sayfayı yeniden aç → Son Özeti Göster; (3) program aç → ↻ →
// cari kartı → düğmeler YOK mu; (4) yeniden yükle → VAR mı.
const p = phones.telefon1;
const dugmeler = async etiket => {
  await p.click('.bottom-nav [data-nav="accounts"]');
  await bekle(1200);
  await p.click('#content .list-item:has-text("Ayşe Demir")');
  await p.waitForSelector("[data-detail-balance]", { timeout: 15000 });
  await bekle(2500);
  const d = await p.$$eval("#content [data-yazma]", n => n.map(x => x.dataset.yazma));
  yaz(etiket, "üst durum", (await p.textContent("#top-server-status")).trim(), "yazma düğmeleri", JSON.stringify(d));
  return d;
};
const girisGerekirse = async () => {
  await p.waitForFunction(() => { const v = el => el && el.offsetParent !== null; return v(document.querySelector("#login-form")) || v(document.querySelector("#content .summary-grid")) || v(document.querySelector("#offline-open")); }, null, { timeout: 20000 });
  if (await p.isVisible("#login-form") && !(await p.isVisible("#offline-open"))) { await p.click("#username", { clickCount: 3 }); await typeSlow(p, "admin"); await p.keyboard.press("Tab"); await typeSlow(p, "Gezinti-Yonetici-2026!"); await p.click("#login-submit"); await p.waitForSelector("#content .summary-grid", { timeout: 20000 }); }
};
await p.reload();
await girisGerekirse();
await dugmeler("(1) canlıyken yeniden yüklendi");
await stopProgram();
await bekle(1000);
await p.reload();
await p.waitForFunction(() => document.querySelector("#offline-open")?.offsetParent !== null, null, { timeout: 20000 });
await p.click("#offline-open");
await p.waitForSelector("#content .summary-grid", { timeout: 15000 });
yaz("(2) kapalıyken açıldı → Son Özeti Göster", (await p.textContent("#top-server-status")).trim());
await startProgram();
await bekle(6000);
await p.click('[data-action="refresh"]');
await bekle(3000);
await girisGerekirse().catch(() => null);
const d3 = await dugmeler("(3) sunucu döndü, ↻");
await p.screenshot({ path: root + "/ekran/45a-tel-dugmesiz-canli.png", fullPage: true });
await p.reload();
await girisGerekirse();
const d4 = await dugmeler("(4) yeniden yüklendi");
yaz("SONUÇ", d3.length === 0 && d4.length > 0 ? "YENİDEN ÜRETİLDİ: sunucu kapalıyken açılan sayfada sunucu dönünce yazma düğmeleri yok; yeniden yüklemeyle geliyor" : "üretilemedi");
