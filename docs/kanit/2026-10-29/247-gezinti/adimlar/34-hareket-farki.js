// SAPMA İNCELEMESİ (ders 6): telefonda cari kartı "Son Hareketler" yalnız faturayı gösterdi; iki taksit tahsilatı (2.000 nakit, 1.500 havale) yok, bakiye 9.700 doğru.
// Yeniden üret: telefonda kartı yeniden aç; API yanıtının anahtarları; masaüstü cari kartının "Tümü" sekmesi; telefondaki Cari Ekstre PDF.
const p = phones.telefon1;
const id = sql("SELECT id FROM accounts WHERE name='Ayşe Demir'")[0].id;
const d = await api(`/api/workspace/accounts/${id}`);
const data = d.data.data;
yaz("API anahtarları", Object.keys(data));
yaz("entries", (data.entries || []).map(e => `${e.kind} ${e.amount} ${e.label || e.description || ""}`));
for (const k of Object.keys(data)) if (Array.isArray(data[k])) yaz(`dizi ${k}`, data[k].length);
const mob = await p.evaluate(async id => { const r = await fetch(`/api/mobil/accounts/${id}`, { credentials: "same-origin" }); const j = await r.json(); return { s: r.status, keys: Object.keys(j.data || j), entries: (j.data?.entries || []).length }; }, id);
yaz("telefondan /api/mobil/accounts/:id", JSON.stringify(mob));
await p.click('.bottom-nav [data-nav="accounts"]');
await bekle(800);
await p.click('#content .list-item:has-text("Ayşe Demir")');
await p.waitForSelector("[data-detail-balance]");
await bekle(600);
yaz("telefon Son Hareketler (yeniden)", await p.$eval("#content", e => e.innerText.replace(/\s+/g, " ").trim().slice(-300)));
// Masaüstü cari kartı: Tümü sekmesi
const TOP = ".hof-modal-backdrop.is-visible:nth-last-child(1 of .hof-modal-backdrop.is-visible)";
await desk.goto(base() + "/");
await desk.waitForSelector("#hof-sidecard", { timeout: 60000 });
await bekle(800);
await desk.click('#hof-sidecard [data-action="accounts"]');
await desk.waitForSelector(`${TOP} :text("Ayşe Demir")`);
await desk.click(`${TOP} :text("Ayşe Demir")`);
await bekle(1200);
yaz("masaüstü kart sekmeleri", await desk.$$eval(`${TOP} button:visible`, els => els.map(e => e.textContent.trim()).filter(t => /^(Tümü|Borç|Alacak|Tahsilat|Taksit)/.test(t))));
yaz("masaüstü kart hareket tablosu", await desk.$eval(TOP, e => e.innerText.replace(/\s+/g, " ").trim().slice(-500)));
await desk.screenshot({ path: root + "/ekran/34a-masaustu-cari-kart.png" });
