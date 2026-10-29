// Başlarken → Banka Hesaplarını Aç: ne açılıyor?
await desk.getByRole("button", { name: "Banka Hesaplarını Aç", exact: true }).click();
await bekle(1200);
const btns = await desk.$$eval(".hof-modal-backdrop.is-visible button:visible", els => els.map(e => e.textContent.trim()).filter(Boolean));
yaz("düğmeler", btns.slice(0, 30));
