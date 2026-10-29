// DENEME SÜRESİ DOLMUŞ LİSANS: lisans servisi bu makine için süresi dolmuş DENEME belirteci döndürür (kind trial, expiresAt dün); program lisansı denetler
// (Yönetim'deki "Lisansı Denetle" ile aynı çağrı: license.check). Beklenen: lisans salt okunur; telefonda ↻ → "Lisans geçerli değil; uzaktan erişim kapalı…";
// yeni karekod 403 remote-license; tünel satırı "Kapalı — Lisans…"; eşli cihazlar SİLİNMEZ.
world.kind = "trial";
world.expiresAt = new Date(Date.now() - 86_400_000).toISOString();
const c = await app().license.check({ manual: true }).then(r => JSON.stringify(r).slice(0, 200)).catch(e => `hata ${e.message}`);
yaz("lisans denetimi", c);
yaz("lisans durumu", app().license.status().state, "yazılabilir", app().license.status().writable);
const p = phones.telefon1;
await p.click('[data-action="refresh"]');
await bekle(3000);
yaz("telefon1 ↻ sonrası", await p.$eval("body", e => e.innerText.replace(/\s+/g, " ").trim().slice(0, 400)));
await p.screenshot({ path: root + "/ekran/46a-tel-lisans-yok.png", fullPage: true });
const s = await p.evaluate(async () => { const r = await fetch("/api/mobil/session", { credentials: "same-origin" }); return { s: r.status, t: (await r.text()).slice(0, 200) }; });
yaz("telefon1 /api/mobil/session", JSON.stringify(s));
// Masaüstü: Yönetim → Mobil Cihazlar
await desk.goto(base() + "/");
await desk.waitForSelector("#hof-auth input[name=username], #hof-sidecard", { timeout: 30000 });
if (await desk.$("#hof-auth input[name=username]")) {
  await desk.click("#hof-auth input[name=username]"); await typeSlow(desk, "admin"); await desk.keyboard.press("Tab"); await typeSlow(desk, "Gezinti-Yonetici-2026!");
  await Promise.all([desk.waitForEvent("load"), desk.keyboard.press("Enter")]);
  await desk.waitForSelector("#hof-sidecard", { timeout: 60000 });
}
await desk.goto(base() + "/admin.html#mobile");
await desk.waitForSelector("[data-mobile-tunnel]", { timeout: 20000 });
await bekle(6000);
await desk.reload();
await desk.waitForSelector("[data-mobile-tunnel]", { timeout: 20000 });
await bekle(1500);
yaz("Yönetim mobil (lisans bitti)", await desk.$eval("#adm-mobile-users", e => e.closest("section, main")?.innerText.replace(/\s+/g, " ").trim().slice(0, 500)));
yaz("tünel satırı", await desk.$eval("[data-mobile-tunnel]", e => `${e.dataset.state}: ${e.innerText.replace(/\s+/g, " ").trim()}`));
yaz("durum kartı", await desk.$eval("#adm-mobile-status", e => e.innerText.replace(/\s+/g, " ").trim().slice(0, 400)).catch(() => "?"));
const kod = await api("/api/admin/mobile/codes", "POST", { userId: vars.adminId });
yaz("karekod isteği", kod.status, JSON.stringify(kod.data).slice(0, 200));
yaz("etkin eşli cihaz (silinmez)", hub("SELECT COUNT(*) AS n FROM mobile_devices WHERE revoked_at IS NULL")[0].n);
await desk.screenshot({ path: root + "/ekran/46b-yonetim-lisans-yok.png", fullPage: true });
