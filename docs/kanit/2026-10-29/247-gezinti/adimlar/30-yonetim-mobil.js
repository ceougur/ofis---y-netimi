// MOBİL — Yönetim → Mobil Cihazlar: ilk görünüm (kimse uzaktan bağlanamaz, eşli cihaz yok).
await desk.goto(base() + "/admin.html#mobile");
await desk.waitForSelector("#adm-mobile-users [data-mobile-user]", { timeout: 20000 });
await bekle(1500);
yaz("bölüm metni", await desk.$eval("#adm-mobile-users", e => e.closest("section, .adm-panel, main")?.innerText.replace(/\s+/g, " ").trim().slice(0, 900)));
yaz("satırlar", await desk.$$eval("[data-mobile-user]", rs => rs.map(r => `${r.dataset.mobileUser}: ${r.innerText.replace(/\s+/g, " ").trim()}`)));
yaz("tünel satırı", await desk.$eval("[data-mobile-tunnel]", e => `${e.dataset.state}: ${e.innerText.replace(/\s+/g, " ").trim()}`).catch(() => "yok"));
yaz("özet satırı", await desk.$eval("[data-mobile-ozet]", e => e.innerText.replace(/\s+/g, " ").trim()).catch(() => "yok"));
yaz("kapıcı ofis kaydı (meta)", JSON.stringify(kapi.meta(ofisId()))?.slice(0, 300));
