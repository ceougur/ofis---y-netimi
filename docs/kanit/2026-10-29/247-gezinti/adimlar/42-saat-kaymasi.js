// BİLGİSAYAR SAATİ KAYMASI: programın saati (uzaktan erişim + lisans saati, config.remoteNow) +10 dk ileri alınır; kapıcı (Cloudflare) ve telefon gerçek saatte.
// Program kapıcıya bir sonraki kaydında farkı yanıtın Date başlığından ölçer (B2b). Beklenen: telefon canlı çalışır (yenile + Kasa okunur), tünel Bağlı,
// Yönetim'de saat uyarısı ("saati 10 dakika farklı"). Sonra −10 dk: aynı.
const p = phones.telefon1;
const deneme = async etiket => {
  // programın kendi açılış kaydıyla aynı yol (özet zamanlayıcısı da çağırır); farkı ölçer
  // İlk denemede kayitGonder() istek atmadan döndü (ölçüm eski kaldı) → özet turu (zamanlayıcının çağırdığı tick) + bekleme; ölçüm her kapıcı yanıtının Date'inden.
  await app().mobileSync.tick?.();
  await app().mobileSync.idle?.();
  await bekle(500);
  const k = await app().mobileSync.kayitGonder({ zorla: true }).then(r => JSON.stringify(r).slice(0, 120)).catch(e => `hata: ${e.message}`);
  yaz(`${etiket}: kapıcıya kayıt`, k, "ölçülen saat", JSON.stringify(app().mobileSync.status().saat), "kapiSaati−gerçek (sn)", ((app().mobileSync.kapiSaati() - Date.now()) / 1000).toFixed(1));
  // Saat SIÇRAMASI (gerçekte saat hep kaymıştır) uzak oturumu 15 dk boşta kuralıyla düşürebilir (ilk denemede 401) → gerekiyorsa yeniden giriş.
  await p.reload();
  // (virgüllü seçici ilk eşleşen gizli giriş formunda bekliyordu — araç hatası; görünürlük işlevle beklenir)
  await p.waitForFunction(() => { const v = el => el && el.offsetParent !== null; return v(document.querySelector("#login-form")) || v(document.querySelector("#content .summary-grid")); }, null, { timeout: 20000 });
  if (await p.isVisible("#login-form")) {
    yaz(`${etiket}: telefon giriş ekranında (oturum saat sıçramasıyla düştü) → yeniden giriş`);
    await p.click("#username", { clickCount: 3 }); await typeSlow(p, "admin"); await p.keyboard.press("Tab"); await typeSlow(p, "Gezinti-Yonetici-2026!");
    const lr = p.waitForResponse(r => /\/api\/mobil\/session\/login/.test(r.url()), { timeout: 15000 });
    await p.click("#login-submit");
    const r = await lr.catch(() => null);
    yaz(`${etiket}: giriş yanıtı`, r ? r.status() : "yok", r ? (await r.text()).slice(0, 160) : "");
    await p.waitForSelector("#app:not(.hidden) #content .summary-grid", { timeout: 20000 }).catch(() => null);
  }
  await bekle(1500);
  yaz(`${etiket}: telefon üst durum`, (await p.textContent("#top-server-status")).trim(), "kasa kartı", (await p.$eval("#content", e => e.innerText.replace(/\s+/g, " ").trim().slice(0, 160))));
  await p.click('.bottom-nav [data-nav="money"]');
  await bekle(1500);
  yaz(`${etiket}: telefon Finans`, await p.$eval("#content", e => e.innerText.replace(/\s+/g, " ").trim().slice(0, 160)));
  await p.click('.bottom-nav [data-nav="home"]');
  await bekle(800);
  await desk.reload();
  await desk.waitForSelector("[data-mobile-tunnel]", { timeout: 20000 });
  await bekle(1500);
  yaz(`${etiket}: Yönetim durum`, await desk.$eval("#adm-mobile-status, [data-mobile-ozet]", e => e.closest("section, .adm-card, div")?.innerText.replace(/\s+/g, " ").trim().slice(0, 500)).catch(() => "?"));
  yaz(`${etiket}: saat uyarısı`, await desk.$eval("[data-mobile-saat]", e => e.innerText.replace(/\s+/g, " ").trim()).catch(() => "YOK"));
  yaz(`${etiket}: tünel`, await desk.$eval("[data-mobile-tunnel]", e => `${e.dataset.state}: ${e.innerText.replace(/\s+/g, " ").trim()}`));
  yaz(`${etiket}: lisans`, app().license.status().state, app().license.status().writable);
};
// (ilk denemede +10 dk zaten uygulandı; bu koşuda saat +10'da)
yaz("program saati − gerçek (dk)", ((remoteNow.ms() - Date.now()) / 60000).toFixed(2));
await deneme("+10 dk");
await desk.screenshot({ path: root + "/ekran/42a-saat-uyari-arti10.png", fullPage: true });
await p.screenshot({ path: root + "/ekran/42b-tel-arti10.png" });
remoteNow.advance(-20 * 60_000);
yaz("program saati − gerçek (dk)", ((remoteNow.ms() - Date.now()) / 60000).toFixed(2));
await deneme("−10 dk");
await desk.screenshot({ path: root + "/ekran/42c-saat-uyari-eksi10.png", fullPage: true });
// Telefondan canlı bir yazma da (−10 dk iken): 50 TL nakit tahsilat
await p.click('.bottom-nav [data-nav="accounts"]');
await bekle(700);
await p.click('#content .list-item:has-text("Ayşe Demir")');
await p.waitForSelector("[data-yazma]", { timeout: 10000 });
await p.click("[data-yazma=\"Tahsilat Gir\"]");
await p.waitForSelector(".yz-sheet", { state: "visible" });
await p.click('.yz-sheet [name="amount"]');
await typeSlow(p, "50", 45);
await p.keyboard.press("Tab");
await p.click('.yz-sheet [data-yz="submit"]');
await p.waitForSelector(".toast, .yz-message", { timeout: 10000 });
yaz("−10 dk iken telefondan tahsilat", await p.$$eval(".toast, .yz-message", t => t.map(x => x.textContent.trim()).join(" | ")), "Kasa", (await api("/api/workspace/cash")).data.data.totals.balance);
remoteNow.advance(10 * 60_000);
yaz("saat geri düzeltildi; fark (dk)", ((remoteNow.ms() - Date.now()) / 60000).toFixed(2));
