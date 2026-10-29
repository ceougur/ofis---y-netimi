// SUNUCU YENİDEN AÇILIR (aynı veri; kullanıcı bilgisayarı açtı): program açılır, tünel kendiliğinden kurulur (sahte cloudflared yeni port → kapıcının canlı yolu).
// Telefon1 (sunucu kapalıyken sayfayı yeniden açıp "Son Özeti Göster" ile özetteydi): ↻ → canlıya dönmeli; cari kartında Tahsilat Gir / Ödeme Gir düğmeleri
// görünmeli (yazma modülü). Telefon2 (tablet, kapalıyken hiç dokunulmadı): ↻ → canlı.
await startProgram();
yaz("program açıldı", base(), "lisans", app().license.status().state);
for (let i = 0; i < 40 && !/açık/.test(g.cfLog() ? "" : ""); i += 1) await bekle(250);
await bekle(6000);
const p = phones.telefon1;
await p.click('[data-action="refresh"]');
await bekle(3000);
yaz("telefon1 ↻ sonrası üst durum", (await p.textContent("#top-server-status")).trim(), "şerit görünür mü", await p.isVisible("#offline-banner"));
yaz("telefon1 ekran", await p.$eval("body", e => e.innerText.replace(/\s+/g, " ").trim().slice(0, 200)));
if (await p.isVisible("#login-form")) {
  yaz("telefon1 giriş istedi (sunucu kapalıyken özetten açılmıştı) → giriş");
  await p.click("#username", { clickCount: 3 }); await typeSlow(p, "admin"); await p.keyboard.press("Tab"); await typeSlow(p, "Gezinti-Yonetici-2026!");
  await p.click("#login-submit");
  await bekle(3000);
}
await p.click('.bottom-nav [data-nav="accounts"]').catch(() => null);
await bekle(1200);
await p.click('#content .list-item:has-text("Ayşe Demir")').catch(() => null);
await p.waitForSelector("[data-detail-balance]", { timeout: 15000 }).catch(() => null);
await bekle(2500);
yaz("telefon1 cari kartı (canlı)", await p.$eval("#content", e => e.innerText.replace(/\s+/g, " ").trim().slice(0, 260)), "yazma düğmeleri", await p.$$eval("#content [data-yazma]", n => n.map(x => x.dataset.yazma)), "üst durum", (await p.textContent("#top-server-status")).trim());
await p.screenshot({ path: root + "/ekran/44a-tel1-sunucu-acildi.png", fullPage: true });
const t = phones.tablet;
await t.click('[data-action="refresh"]').catch(e => yaz("tablet ↻ yok", e.message.split("\n")[0]));
await bekle(3000);
yaz("tablet üst durum", await t.textContent("#top-server-status").then(s => s.trim()).catch(() => "?"), "ekran", await t.$eval("body", e => e.innerText.replace(/\s+/g, " ").trim().slice(0, 160)));
