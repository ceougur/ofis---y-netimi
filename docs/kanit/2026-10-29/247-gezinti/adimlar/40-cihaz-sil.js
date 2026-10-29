// CİHAZ SİL: Yönetim → cihaz listesinde "Saha Telefonu" → Sil → onay sorusu (beklenen, meşru — ders 34; metni yazılır) → onayla.
// Beklenen: DB 2 cihaz, kapıcı 2; telefon3 (silinen) giriş yapmaya çalışınca REDDEDİLİR ("eşli değil"); satırda karekod yeniden açılır.
const devRow = await desk.$(`:is(#adm-mobile-devices, [data-mobile-devices]) :is(tr, li, div):has-text("Saha Telefonu"):has(button:text-is("Sil"))`);
const rows = await desk.$$(`:is(#adm-mobile-devices, [data-mobile-devices]) tr:has-text("Saha Telefonu")`);
const target = rows.at(-1) || devRow;
await target.$('button:text-is("Sil")').then(b => b.click());
await bekle(700);
const soru = await desk.$eval(".hof-modal-backdrop.is-visible:nth-last-child(1 of .hof-modal-backdrop.is-visible)", e => e.innerText.replace(/\s+/g, " ").trim().slice(0, 300)).catch(() => "soru yok");
yaz("SORU (ders 34; beklenen)", soru);
await desk.screenshot({ path: root + "/ekran/40a-cihaz-sil-soru.png" });
const del = desk.waitForResponse(r => /\/api\/admin\/mobile\/devices\//.test(r.url()) && r.request().method() === "DELETE", { timeout: 15000 });
const btns = await desk.$$eval(".hof-modal-backdrop.is-visible:nth-last-child(1 of .hof-modal-backdrop.is-visible) button", b => b.map(x => x.textContent.trim()).filter(Boolean));
yaz("soru düğmeleri", btns);
const onay = btns.find(b => /Sil|Kaldır|Evet/.test(b) && b !== "×");
await desk.click(`.hof-modal-backdrop.is-visible:nth-last-child(1 of .hof-modal-backdrop.is-visible) button:text-is("${onay}")`);
yaz("YANIT (ders 34): onaylandı —", onay, "→ DELETE", (await del).status());
await bekle(1500);
yaz("DB cihazlar", hub("SELECT name FROM mobile_devices").map(d => d.name), "kapıcı", (kapi.meta(ofisId())?.cihazlar || []).length);
yaz("satır", await desk.$eval(`[data-mobile-user="${vars.adminId}"]`, e => e.innerText.replace(/\s+/g, " ").trim()));
// Silinen telefon (telefon3): giriş dener
const p3 = phones.telefon3;
await p3.click("#username", { clickCount: 3 });
await typeSlow(p3, "admin");
await p3.keyboard.press("Tab");
await typeSlow(p3, "Gezinti-Yonetici-2026!");
const lr = p3.waitForResponse(r => /\/api\/mobil\/session/.test(r.url()), { timeout: 15000 });
await p3.click("#login-submit");
const r = await lr.catch(() => null);
yaz("silinen telefon giriş yanıtı", r ? `${new URL(r.url()).pathname} ${r.status()} ${(await r.text()).slice(0, 200)}` : "yok");
await bekle(1500);
yaz("silinen telefon ekranı", await p3.$eval("body", e => e.innerText.replace(/\s+/g, " ").trim().slice(0, 300)));
await p3.screenshot({ path: root + "/ekran/40b-silinen-telefon.png", fullPage: true });
