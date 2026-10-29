// Borcun Kaynağı = Carinin Mevcut Borcu (varsayılan), Toplam 13.200 (ön dolu), Taksit Sayısı 3, İlk Vade 20.11.2026 → kaydet.
// Beklenen: kart 3 × 4.400; carinin defterine İKİNCİ borç yazılmaz (bakiye 13.200 kalır).
const TOP = ".hof-modal-backdrop.is-visible:nth-last-child(1 of .hof-modal-backdrop.is-visible)";
await desk.click(`${TOP} [name=count]`);
await typeSlow(desk, "3");
await desk.keyboard.press("Tab");
await desk.fill(`${TOP} [name=firstDue]`, "2026-11-20");
await desk.screenshot({ path: root + "/ekran/18a-taksit-form.png" });
const btns = await desk.$$eval(`${TOP} button:visible`, els => els.map(e => e.textContent.trim()).filter(Boolean));
yaz("düğmeler", btns);
const save = btns.find(b => /Kartı Aç|Kaydet|Oluştur/.test(b));
const resp = desk.waitForResponse(r => /\/api\/workspace\/plans(\?|$)/.test(r.url()) && r.request().method() === "POST", { timeout: 20000 });
await desk.click(`${TOP} button:text-is("${save}")`);
const r = await resp.catch(() => null);
yaz("POST plan", save, r ? r.status() : "yanıt yok");
await bekle(1800);
const planCols = sql("PRAGMA table_info(plans)").map(c => c.name);
yaz("plans kolonları", planCols.join(","));
yaz("DB plan", sql("SELECT * FROM plans").map(p => ({ name: p.name, total: p.total, account: Boolean(p.account_id), covers: p.covers_balance })));
const items = sql("SELECT name FROM sqlite_master WHERE type='table' AND name LIKE 'plan%'");
yaz("plan tabloları", items);
yaz("DB cari hareketleri", sql("SELECT kind, amount, date FROM account_entries"));
const card = await api("/api/workspace/accounts");
yaz("API cari listesi", JSON.stringify(card.data?.data?.accounts?.map(a => ({ name: a.name, balance: a.balance })) || card.data).slice(0, 300));
