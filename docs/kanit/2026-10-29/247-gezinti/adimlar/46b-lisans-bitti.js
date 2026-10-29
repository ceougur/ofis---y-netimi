// 46 ilk denemesi: sahte lisans servisi DENEME belirtecini başka lisans kimliğiyle (DEN-…) verdi → program "yanıt bu lisansa ait değil" diye REDDETTİ (doğru davranış;
// bu kurulum lisanslı). Bu kurulumda gerçekçi olan: AYNI lisansın süresi DOLMUŞ belirteci (kind license, expiresAt dün) — program aynı kapıdan (lisans yazılabilir mi)
// geçer; DENEME bitişi aynı kapıyı kullanır ve test/mobil-deneme-bitis-247.test.mjs'te (tam kapıda) sınanır.
world.kind = "license";
world.expiresAt = new Date(Date.now() - 86_400_000).toISOString();
const c = await app().license.check({ manual: true }).then(r => JSON.stringify(r).slice(0, 160)).catch(e => `hata ${e.message}`);
yaz("lisans denetimi", c);
yaz("lisans durumu", app().license.status().state, "yazılabilir", app().license.status().writable);
const p = phones.telefon1;
await p.click('[data-action="refresh"]');
await bekle(3500);
yaz("telefon1 ↻ sonrası", await p.$eval("body", e => e.innerText.replace(/\s+/g, " ").trim().slice(0, 400)));
await p.screenshot({ path: root + "/ekran/46c-tel-lisans-yok.png", fullPage: true });
const s = await p.evaluate(async () => { const r = await fetch("/api/mobil/session", { credentials: "same-origin" }); return { s: r.status, t: (await r.text()).slice(0, 220) }; });
yaz("telefon1 /api/mobil/session", JSON.stringify(s));
const t = phones.tablet;
await t.reload();
await bekle(3000);
yaz("tablet (yeniden açılış)", await t.$eval("body", e => e.innerText.replace(/\s+/g, " ").trim().slice(0, 300)));
await desk.reload();
await desk.waitForSelector("[data-mobile-tunnel]", { timeout: 20000 });
await bekle(7000);
await desk.reload();
await desk.waitForSelector("[data-mobile-tunnel]", { timeout: 20000 });
await bekle(1500);
yaz("tünel satırı", await desk.$eval("[data-mobile-tunnel]", e => `${e.dataset.state}: ${e.innerText.replace(/\s+/g, " ").trim()}`));
yaz("durum kartı", await desk.$eval("#adm-mobile-status", e => e.innerText.replace(/\s+/g, " ").trim().slice(0, 400)).catch(() => "?"));
// karekod: önce bir cihazı silmeden 409 (sınır) gelir; lisans reddini görmek için sınır dışı: saha kullanıcısına karekod iste (sınır yine dolu) → hangisi önce?
const kod = await api("/api/admin/mobile/codes", "POST", { userId: vars.adminId });
yaz("karekod isteği", kod.status, JSON.stringify(kod.data).slice(0, 200));
yaz("etkin eşli cihaz (silinmez)", hub("SELECT COUNT(*) AS n FROM mobile_devices WHERE revoked_at IS NULL")[0].n);
await desk.screenshot({ path: root + "/ekran/46d-yonetim-lisans-yok.png", fullPage: true });
// Kapıcı (sunucu açık): şifreli özet de kapalı mı? Program kapanınca telefon son özeti açabilir mi?
await stopProgram();
await bekle(1000);
await p.click('.bottom-nav [data-nav="home"]').catch(() => null);
await p.reload();
await bekle(4000);
yaz("program kapalı + lisans bitmiş: telefon", await p.$eval("body", e => e.innerText.replace(/\s+/g, " ").trim().slice(0, 300)));
await p.screenshot({ path: root + "/ekran/46e-tel-lisans-yok-kapali.png", fullPage: true });
