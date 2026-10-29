// TELEFON 1 (390×844, dokunmatik, iPhone imzası): karekoddaki adresi aç (ofisin alt adı → kapıcı → tünel → programın uzak dinleyicisi) → cihaz adı yaz →
// Eşleştir → kullanıcı adı, Tab, parola (insan hızı) → Giriş → Genel Bakış.
const p = await newPhone("telefon1");
vars.goNet = [];
p.on("response", r => { if (/\/api\/|\/kapi\//.test(r.url())) vars.goNet.push(`${r.request().method()} ${new URL(r.url()).pathname} ${r.status()}`); });
await p.goto(vars.url1);
await p.waitForSelector("#pair-form:not(.hidden)", { timeout: 20000 });
await p.screenshot({ path: root + "/ekran/32a-tel-esleme.png" });
yaz("eşleme ekranı", await p.$eval("#pair-form", e => e.innerText.replace(/\s+/g, " ").trim().slice(0, 300)));
await p.click("#device-name", { clickCount: 3 });
await typeSlow(p, "Ayşe Hanımın iPhone'u");
await p.click("#pair-submit");
await p.waitForSelector("#login-form:not(.hidden)", { timeout: 20000 });
await p.click("#username");
await typeSlow(p, "admin");
await p.keyboard.press("Tab");
await typeSlow(p, "Gezinti-Yonetici-2026!");
await p.screenshot({ path: root + "/ekran/32b-tel-giris.png" });
await p.click("#login-submit");
await p.waitForSelector("#app:not(.hidden) #content .summary-grid", { timeout: 20000 });
await bekle(1500);
yaz("telefon adresi", p.url().replace(/#.*/, ""));
yaz("üst durum", await p.textContent("#top-server-status").catch(() => "?"));
yaz("Genel Bakış", await p.$eval("#content", e => e.innerText.replace(/\s+/g, " ").trim().slice(0, 600)));
yaz("ağ (telefon)", vars.goNet.slice(0, 20));
yaz("DB cihazlar", hub("SELECT id, user_id, name FROM mobile_devices").map(d => d.name));
yaz("kapıcı cihazları", (kapi.meta(ofisId())?.cihazlar || []).length);
