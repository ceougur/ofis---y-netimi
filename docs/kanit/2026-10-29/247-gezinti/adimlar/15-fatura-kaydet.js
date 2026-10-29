// Açık Hesap (Vadeli) seçili (varsayılan?) → Vade Tarihi 20.11.2026 (tarih kutusu fill; 245 notu: Tab tarih parçalarında dolaşır) → Kaydet, Sonra Gönder.
const TOP = ".hof-modal-backdrop.is-visible:nth-last-child(1 of .hof-modal-backdrop.is-visible)";
const radios = await desk.$$eval(`${TOP} input[name=hof-inv-rest]`, els => els.map(e => `${e.closest("label")?.textContent.trim()}=${e.checked}`));
yaz("kalan seçenekleri", radios);
yaz("vade kutusu", await desk.locator(`${TOP} input[type=date]:visible`).last().inputValue());
const dates = await desk.$$eval(`${TOP} input[type=date]`, els => els.map(e => `${e.dataset.f || e.name || e.dataset.p || "?"}:${e.offsetParent ? "görünür" : "gizli"}`));
yaz("tarih kutuları", dates);
const resp = desk.waitForResponse(r => /\/api\/workspace\/invoices(\?|$)/.test(r.url()) && r.request().method() === "POST", { timeout: 20000 });
// 15 ilk denemede vade yazıldı (11/20/2026), kayıt düğmesi bu müşteride "Faturayı Kaydet" (e-Belge düğmeleri değil).
await desk.click(`${TOP} button:text-is("Faturayı Kaydet")`);
const r = await resp.catch(e => null);
yaz("POST fatura", r ? r.status() : "yanıt yok");
await bekle(1500);
// Olası soru penceresi
yaz("üst pencere", await desk.$eval(`${TOP}`, e => e.textContent.replace(/\s+/g, " ").trim().slice(0, 400)).catch(() => "-"));
yaz("DB fatura", sql("SELECT id, number, kind, doc_type, status, total, issue_date, due_date, account_id FROM invoices"));
yaz("DB kalemler", sql("SELECT name, qty, unit_price, vat_rate, description FROM invoice_lines"));
yaz("DB cari hareket", sql("SELECT kind, amount, date, due_date, invoice_id FROM account_entries"));
