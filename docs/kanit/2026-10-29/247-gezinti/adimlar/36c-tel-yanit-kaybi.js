// YANIT KAYBI (tarayıcının kendi ağ yığınında; CDP Fetch, YANIT aşamasında durdur → bağlantı koptu): istek kapıcı + tünel üzerinden sunucuya ulaşır ve yazılır,
// yanıt telefona ulaşmaz. Beklenen: "Sonucu Belirsiz" → Yeniden Gönder → "zaten kaydedilmişti"; TEK kayıt; banka +300 bir kez. Sonra aynı istek 3. kez elle.
// (36'daki askıda istek nedeniyle telefon sayfası yeniden yüklendi.)
const p = phones.telefon1;
await p.reload();
await p.waitForSelector("#app:not(.hidden) #content .summary-grid, #login-form:not(.hidden)", { timeout: 20000 });
yaz("yeniden yüklemeden sonra", await p.isVisible("#login-form:not(.hidden)") ? "giriş ekranı" : "uygulama");
if (await p.isVisible("#login-form:not(.hidden)")) { await p.click("#username", { clickCount: 3 }); await typeSlow(p, "admin"); await p.keyboard.press("Tab"); await typeSlow(p, "Gezinti-Yonetici-2026!"); await p.click("#login-submit"); await p.waitForSelector("#app:not(.hidden) #content .summary-grid"); }
await p.click('.bottom-nav [data-nav="accounts"]');
await bekle(700);
await p.click('#content .list-item:has-text("Ayşe Demir")');
await p.waitForSelector("[data-yazma]", { timeout: 10000 });
const bank0 = (await api("/api/workspace/bank/accounts")).data.data.accounts[0].balanceMinor / 100;
const plan0 = sql("SELECT COUNT(*) AS n, COALESCE(SUM(amount),0) AS t FROM plan_entries")[0];
await p.click("[data-yazma=\"Tahsilat Gir\"]");
await p.waitForSelector(".yz-sheet", { state: "visible" });
const planVal = await p.$eval('.yz-sheet [name="target"] option:nth-child(2)', o => o.value);
await p.selectOption('.yz-sheet [name="target"]', planVal);
await p.click('.yz-sheet [name="amount"]');
await typeSlow(p, "300", 45);
await p.keyboard.press("Tab");
await p.selectOption('.yz-sheet [name="method"]', "bank");
await bekle(300);
const cdp = await p.context().newCDPSession(p);
let yakalanan = null;
let kesildi = 0;
cdp.on("Fetch.requestPaused", async ev => {
  if (ev.request.method === "POST" && ev.responseStatusCode && kesildi === 0) {
    kesildi += 1;
    yakalanan = { url: ev.request.url, headers: ev.request.headers, body: ev.request.postData };
    yaz("sunucu yanıtı (telefona ULAŞMAYACAK)", ev.responseStatusCode);
    await cdp.send("Fetch.failRequest", { requestId: ev.requestId, errorReason: "ConnectionReset" });
  } else await cdp.send("Fetch.continueRequest", { requestId: ev.requestId }).catch(() => cdp.send("Fetch.continueResponse", { requestId: ev.requestId }).catch(() => null));
});
await cdp.send("Fetch.enable", { patterns: [{ urlPattern: "*/api/mobil/*", requestStage: "Response" }] });
await p.click('.yz-sheet [data-yz="submit"]');
await p.waitForSelector(".yz-message.warn", { timeout: 15000 });
await cdp.send("Fetch.disable");
yaz("telefondaki uyarı", await p.$eval(".yz-message.warn", e => e.innerText.replace(/\s+/g, " ").trim()));
yaz("istek", yakalanan?.url?.replace(/^https:\/\/[^/]+/, ""), "gövde", yakalanan?.body, "istek kimliği başlığı", Object.entries(yakalanan?.headers || {}).filter(([k]) => /istek|idem|request-id|x-do/i.test(k)));
const plan1 = sql("SELECT COUNT(*) AS n, COALESCE(SUM(amount),0) AS t FROM plan_entries")[0];
yaz("sunucu yazdı mı: plan_entries önce", JSON.stringify(plan0), "sonra", JSON.stringify(plan1));
await p.screenshot({ path: root + "/ekran/36c-tel-sonucu-belirsiz.png", fullPage: true });
await p.click('.yz-sheet [data-yz="close"]');
await bekle(500);
yaz("bekleyen listesi", await p.$eval("#yz-pending", e => e.innerText.replace(/\s+/g, " ").trim().slice(0, 300)).catch(() => "yok"));
await p.click("#yz-pending [data-yz-resend]");
await p.waitForSelector(".toast", { timeout: 10000 });
yaz("yeniden gönderim bildirimi", await p.$$eval(".toast", t => t.map(x => x.textContent.trim()).join(" | ")));
await bekle(1000);
const plan2 = sql("SELECT COUNT(*) AS n, COALESCE(SUM(amount),0) AS t FROM plan_entries")[0];
yaz("SONUÇ plan_entries", JSON.stringify(plan2), "banka", bank0, "→", (await api("/api/workspace/bank/accounts")).data.data.accounts[0].balanceMinor / 100, "cari", (await api("/api/workspace/accounts")).data.data.accounts.map(a => `${a.name} ${a.balance}`));
await p.screenshot({ path: root + "/ekran/36d-tel-zaten-kaydedilmis.png", fullPage: true });
if (yakalanan) {
  const third = await p.evaluate(async y => { const h = {}; for (const [k, v] of Object.entries(y.headers)) if (!/^(host|content-length|cookie|origin|referer|user-agent|accept-encoding|connection|sec-|accept-language)$/i.test(k)) h[k] = v; const r = await fetch(y.url, { method: "POST", headers: h, body: y.body, credentials: "same-origin" }); return { s: r.status, t: (await r.text()).slice(0, 220) }; }, yakalanan);
  yaz("aynı istek 3. kez (aynı istek kimliği)", JSON.stringify(third));
  yaz("SONUÇ 3. gönderimden sonra plan_entries", JSON.stringify(sql("SELECT COUNT(*) AS n, COALESCE(SUM(amount),0) AS t FROM plan_entries")[0]), "banka", (await api("/api/workspace/bank/accounts")).data.data.accounts[0].balanceMinor / 100);
}
