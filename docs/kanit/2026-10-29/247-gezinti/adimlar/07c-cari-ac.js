// Yeni Cari formunun kayıt düğmesi "Cariyi Aç" (Kaydet değil). Tıkla, yanıt + DB.
const TOP = ".hof-modal-backdrop.is-visible:nth-last-child(1 of .hof-modal-backdrop.is-visible)";
const resp = desk.waitForResponse(r => /\/api\/workspace\/accounts(\?|$)/.test(r.url()) && r.request().method() === "POST", { timeout: 15000 });
await desk.click(`${TOP} button:text-is("Cariyi Aç")`);
const r = await resp;
yaz("POST cari", r.status());
await bekle(1500);
yaz("DB cariler", sql("SELECT id, ref_no, name, phone, type FROM accounts"));
