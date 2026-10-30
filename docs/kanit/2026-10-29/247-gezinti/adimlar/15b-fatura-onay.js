// ONAY penceresi (beklenen, meşru soru — ders 34): "Ayşe Demir için FIS2026000000001 … ₺13.200,00" → Faturayı Kaydet.
const TOP = ".hof-modal-backdrop.is-visible:nth-last-child(1 of .hof-modal-backdrop.is-visible)";
const resp = desk.waitForResponse(r => /\/api\/workspace\/invoices(\?|$)/.test(r.url()) && r.request().method() === "POST", { timeout: 20000 });
await desk.click(`${TOP} button:text-is("Faturayı Kaydet")`);
const r = await resp.catch(() => null);
yaz("POST fatura", r ? r.status() : "yanıt yok");
await bekle(1800);
const cols = sql("PRAGMA table_info(invoices)").map(c => c.name);
yaz("invoices kolonları", cols.join(","));
yaz("DB fatura", sql("SELECT * FROM invoices").map(i => ({ number: i.number, kind: i.kind, status: i.status, total: i.total, issue_date: i.issue_date, due_date: i.due_date, open: i.open_amount })));
yaz("DB kalemler", sql("SELECT name, qty, unit_price, vat_rate, description FROM invoice_lines"));
yaz("DB cari hareket", sql("SELECT kind, amount, date, due_date, invoice_id IS NOT NULL AS faturali FROM account_entries"));
yaz("DB stok KK90", sql("SELECT * FROM stock_items WHERE code='KK90'").map(i => i.qty ?? i.quantity ?? JSON.stringify(i).slice(0, 200)));
