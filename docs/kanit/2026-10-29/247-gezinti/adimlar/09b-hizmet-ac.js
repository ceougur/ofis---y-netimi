// Ürün kaydedilince ürün kartı açıldı (10 Adet, not görünür). Listeye Dön → + Yeni Ürün → Tür Hizmet "Montaj" Satış 1.000 KDV %20.
const TOP = ".hof-modal-backdrop.is-visible:nth-last-child(1 of .hof-modal-backdrop.is-visible)";
const field = async (name, value) => { await desk.click(`${TOP} [name=${name}]`); await typeSlow(desk, value); await desk.keyboard.press("Tab"); };
await desk.click(`${TOP} button:has-text("Listeye Dön")`);
await bekle(800);
await desk.click(`${TOP} [data-act=new]`);
await bekle(800);
await desk.selectOption(`${TOP} [name=kind]`, "service");
await bekle(300);
await field("code", "MNT");
await field("name", "Montaj");
await field("salePrice", "1.000");
await desk.selectOption(`${TOP} [name=vatRate]`, "20").catch(e => yaz("KDV seçilemedi", e.message.split("\n")[0]));
const btn = await desk.$$eval(`${TOP} button:visible`, els => els.map(e => e.textContent.trim()).filter(Boolean));
yaz("hizmet düğmeleri", btn);
await desk.click(`${TOP} button:visible >> nth=-1`);
await bekle(1500);
yaz("DB stok", sql("SELECT code, name, kind, unit, sale_price, unit_price, vat_rate, note FROM stock_items"));
