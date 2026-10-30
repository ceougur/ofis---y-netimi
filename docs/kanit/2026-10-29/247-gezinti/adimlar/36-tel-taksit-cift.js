// Telefon: Tahsilat Gir → Tahsilat Yeri = Taksit Kartı → 300, Havale / EFT (Ziraat) → Kaydet; istek kapıcı + tünelden sunucuya GİDER, yanıt telefona
// ULAŞMAZ (route.fetch + abort: bağlantı kopması). Beklenen: "Sonucu Belirsiz" → Yeniden Gönder → "zaten kaydedilmişti"; DB'de TEK kayıt; banka +300 bir kez.
const p = phones.telefon1;
const bank0 = (await api("/api/workspace/bank/accounts")).data.data.accounts[0].balanceMinor / 100;
const plan0 = sql("SELECT COUNT(*) AS n, COALESCE(SUM(amount),0) AS t FROM plan_entries")[0];
await p.click("[data-yazma=\"Tahsilat Gir\"]");
await p.waitForSelector(".yz-sheet", { state: "visible" });
const planVal = await p.$eval('.yz-sheet [name="target"] option:nth-child(2)', o => o.value);
await p.selectOption('.yz-sheet [name="target"]', planVal);
await bekle(300);
await p.click('.yz-sheet [name="amount"]');
await typeSlow(p, "300", 45);
await p.keyboard.press("Tab");
await p.selectOption('.yz-sheet [name="method"]', "bank");
await bekle(300);
yaz("form (taksit kartı)", await p.$eval(".yz-sheet", e => e.innerText.replace(/\s+/g, " ").trim().slice(0, 400)));
let yakalanan = null;
await p.route("**/api/mobil/**", async route => {
  if (route.request().method() !== "POST") return route.continue();
  yakalanan = { url: route.request().url(), headers: route.request().headers(), body: route.request().postData() };
  const r = await route.fetch(); // istek sunucuya gider ve yazılır
  yaz("sunucunun (telefona ulaşmayan) yanıtı", r.status(), (await r.text()).slice(0, 160));
  await route.abort("connectionreset"); // yanıt telefona ulaşmaz
});
await p.click('.yz-sheet [data-yz="submit"]');
await p.waitForSelector(".yz-message.warn", { timeout: 10000 });
await p.unroute("**/api/mobil/**");
yaz("telefondaki uyarı", await p.$eval(".yz-message.warn", e => e.innerText.replace(/\s+/g, " ").trim()));
yaz("istek kimliği başlığı", Object.entries(yakalanan?.headers || {}).filter(([k]) => /istek|idem|request/i.test(k)));
const plan1 = sql("SELECT COUNT(*) AS n, COALESCE(SUM(amount),0) AS t FROM plan_entries")[0];
yaz("sunucu yazdı mı (plan_entries önce/sonra)", JSON.stringify(plan0), JSON.stringify(plan1));
await p.screenshot({ path: root + "/ekran/36a-tel-sonucu-belirsiz.png", fullPage: true });
await p.click('.yz-sheet [data-yz="close"]');
await bekle(500);
yaz("bekleyen listesi", await p.$eval("#yz-pending", e => e.innerText.replace(/\s+/g, " ").trim().slice(0, 300)).catch(() => "yok"));
await p.click("#yz-pending [data-yz-resend]");
await p.waitForSelector(".toast", { timeout: 10000 });
yaz("yeniden gönderim bildirimi", await p.$$eval(".toast", t => t.map(x => x.textContent.trim()).join(" | ")));
await bekle(1000);
const plan2 = sql("SELECT COUNT(*) AS n, COALESCE(SUM(amount),0) AS t FROM plan_entries")[0];
const bank2 = (await api("/api/workspace/bank/accounts")).data.data.accounts[0].balanceMinor / 100;
yaz("SONUÇ plan_entries", JSON.stringify(plan2), "banka", bank0, "→", bank2, "cari", (await api("/api/workspace/accounts")).data.data.accounts.map(a => `${a.name} ${a.balance}`));
// Aynı isteği (aynı istek kimliğiyle) üçüncü kez elle gönder: telefonun oturumuyla, aynı gövde + başlıklar
const third = await p.evaluate(async y => { const h = {}; for (const [k, v] of Object.entries(y.headers)) if (!/^(host|content-length|cookie|origin|referer|user-agent|accept-encoding|connection|sec-|accept-language)/i.test(k)) h[k] = v; const r = await fetch(y.url, { method: "POST", headers: h, body: y.body, credentials: "same-origin" }); return { s: r.status, t: (await r.text()).slice(0, 200) }; }, yakalanan);
yaz("aynı istek 3. kez", JSON.stringify(third));
const plan3 = sql("SELECT COUNT(*) AS n, COALESCE(SUM(amount),0) AS t FROM plan_entries")[0];
yaz("SONUÇ (3. gönderimden sonra) plan_entries", JSON.stringify(plan3), "banka", (await api("/api/workspace/bank/accounts")).data.data.accounts[0].balanceMinor / 100);
await p.screenshot({ path: root + "/ekran/36b-tel-zaten-kaydedilmis.png", fullPage: true });
