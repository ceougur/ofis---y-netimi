// (a) Tahsilat Gir (açık): Tutar 2.000 (üç kez tıkla + insan hızında), Yol Nakit → Tahsilatı Kaydet.
// (b) + Tahsilat → Taksite Yaz → 1.500, Yol Havale / EFT (banka hesabı) → kaydet.
// Beklenen: cari bakiye 13.200 − 3.500 = 9.700; Kasa 2.000; Ziraat 10.000 + 1.500 = 11.500; 1. taksit kalan 900.
const TOP = ".hof-modal-backdrop.is-visible:nth-last-child(1 of .hof-modal-backdrop.is-visible)";
const kaydet = async () => {
  const resp = desk.waitForResponse(r => r.request().method() === "POST" && /\/api\/workspace\//.test(r.url()), { timeout: 20000 });
  await desk.click(`${TOP} button:has-text("Kaydet")`);
  const r = await resp.catch(() => null);
  return r ? `${r.request().method()} ${r.url().replace(base(), "").split("?")[0]} ${r.status()}` : "yanıt yok";
};
await desk.click(`${TOP} [name=amount]`, { clickCount: 3 });
await typeSlow(desk, "2.000");
await desk.keyboard.press("Tab");
yaz("Tab sonrası odak", await desk.evaluate(() => document.activeElement?.name));
await desk.screenshot({ path: root + "/ekran/21a-tahsilat-nakit.png" });
yaz("(a)", await kaydet());
await bekle(1500);
yaz("DB hareketler (a)", sql("SELECT kind, amount, method, date FROM account_entries"));
await desk.click(`${TOP} button:text-is("+ Tahsilat")`);
await bekle(800);
await desk.click(`${TOP} button:has-text("Taksite Yaz")`);
await bekle(1000);
await desk.click(`${TOP} [name=amount]`, { clickCount: 3 });
await typeSlow(desk, "1.500");
await desk.keyboard.press("Tab");
await desk.selectOption(`${TOP} [name=method]`, { label: "Havale / EFT" });
await bekle(600);
yaz("havale alanları", await desk.$$eval(`${TOP} input:visible, ${TOP} select:visible`, els => els.map(e => `${e.name}:${e.value}:${e.tagName === "SELECT" ? [...e.options].map(o => o.textContent.trim()).join("/") : ""}`)));
await desk.screenshot({ path: root + "/ekran/21b-tahsilat-havale.png" });
yaz("(b)", await kaydet());
await bekle(1500);
yaz("DB hareketler (b)", sql("SELECT kind, amount, method, date FROM account_entries"));
const acc = await api("/api/workspace/accounts");
yaz("cari bakiye", acc.data.data.accounts.map(a => `${a.name} ${a.balance}`));
const cash = await api("/api/workspace/cash");
yaz("Kasa", JSON.stringify(cash.data.data.totals));
const bank = await api("/api/workspace/bank/accounts");
yaz("Banka", bank.data.data.accounts.map(a => `${a.label} ${a.balanceMinor / 100}`));
yaz("taksit kalan", sql("SELECT i.seq, i.amount, COALESCE((SELECT SUM(amount) FROM plan_entries e WHERE e.item_id = i.id), 0) AS odenen FROM plan_items i ORDER BY seq"));
