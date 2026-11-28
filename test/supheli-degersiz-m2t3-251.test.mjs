// 2.5.1 M2 tur 3 — Değersiz Alacak'tan sonra iptal / iade / tutar düşürme (para çekirdeği; Değersiz sınırı tur 2'nin açtığı iki soru).
// KARARLAR (AYNEN; iş listesi C / D):
//   S-M2T2-1 = A (28.11 01:54 UTC — KULLANICI KARARIYLA ÖNERİ UYGULANDI, 20:26 yetkisi): "Değersiz Alacak yazıldıktan sonra fatura iptali ya da iadesi, cari Değersiz OLMADAN da eksi
//     kalacaksa? Örnek: 05.10'da avans 3.000 var, fatura 2.900 iptal ediliyor. A (ÖNERİ): reddedilsin — bakiye −2.576,45 kalır."
//   S-M2T2-2 = A (aynı karar anı): "Değersiz Alacak'tan sonra fatura TUTARI Düzenle ile düşürülürse (2.900 → 100)? A (ÖNERİ): iade gibi reddedilsin (S241 = A ile tutarlı) — bakiye 423,55 kalır."
//   S-DKM2-2 = A (tur 2; değişmez): "iptal de iade de reddedilsin — ileti 'önce Değersiz Alacak satırını silin …'".
// ELLE BEKLENEN SAYILAR (kurallardan; ders 5): taban T = Fatura 2.900 (10.09) + Borç 3.400 (12.09) · 17.09 bağlı tahsilat 2.876,45 · 17.09 Şüpheliye Al 3.000 · Değersiz 3.000 @17.09 (S264)
//   → bakiye 6.300 − 2.876,45 − 3.000 = 423,55. Avans 3.000 (05.10) → −2.576,45. İptal / tam iade olsaydı −2.900 → −5.476,45 (Değersiz olmasaydı −2.476,45).
//   Düzenle 2.900 → 100: −2.800 → 423,55 − 2.800 = −2.376,45 (Değersiz olmasaydı +623,55 → "Değersiz yüzünden"); iletideki "en çok" programın sınır işlevinden (tur 2 BAŞ MİMAR KARARI (1)):
//   Düzenle azalışı iade gibi sonradan gelen bağsız alacak (S241 = A; S270) — kaydın kalanı 3.000'den fazlası düşer → yazılamaz.
// Sahte saat 15.10.2026 (ders 13), akan saat.
import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { loginAdmin, startTestServer } from "./helpers.mjs";
import { apiOf, integrityOf, must } from "./banka-210-ortak.mjs";

const TODAY = "2026-10-15";
const ACC = "/api/workspace/accounts";
const INV = "/api/workspace/invoices";
const WHERE = "cari kartı → Şüpheli Alacak → kaydın Değersiz satırındaki × düğmesi";

async function boot() {
  const server = await startTestServer({ now: `${TODAY}T12:00:00+03:00`, env: { HUKUK_LICENSE_URL: "http://127.0.0.1:9" } });
  const api = apiOf(await loginAdmin(server));
  await api.post("/api/workspace/bank/setup/dismiss", {});
  return { server, api, store: server.app.store };
}
let phone = 0;
const saleBody = (accountId, price, { date = "2026-09-10", payment = { rest: "open" } } = {}) => ({ scenario: "service_sale", accountId, issueDate: date, lines: [{ name: "Hizmet", qty: 1, unitPrice: String(price), vatRate: 0 }], payment });
// Taban T; split: Değersiz iki satır (1.000 + 2.000 @17.09 — S269); writeOff false: Değersiz yok.
async function base(api, name, { extra = 0, advance = 0, split = false, writeOff = true } = {}) {
  phone += 1;
  const a = await must("cari", api.post(ACC, { name, type: "customer", registeredOn: "2026-09-01", phone: `0500 256 ${String(phone).padStart(2, "0")} 01` }));
  const inv = await must("fatura", api.post(INV, saleBody(a.id, 2900)));
  await must("borç", api.post(`${ACC}/${a.id}/entries`, { kind: "debt", amount: "3400", date: "2026-09-12", note: "Borç" }));
  if (extra) await must("ek borç", api.post(`${ACC}/${a.id}/entries`, { kind: "debt", amount: String(extra), date: "2026-09-12", note: "Ek borç" }));
  await must("bağlı", api.post(`${ACC}/${a.id}/entries`, { kind: "in", amount: "2876,45", date: "2026-09-17", method: "cash", cashForce: true, similarOk: true, note: "Bağlı", invoiceId: inv.id }));
  const s = (await must("şüpheli", api.post(`${ACC}/${a.id}/doubtful`, { amount: "3000", date: "2026-09-17", reason: "lawsuit" }))).record.id;
  if (writeOff && split) {
    await must("Değersiz 1.000", api.post(`${ACC}/${a.id}/doubtful/${s}/write-off`, { amount: "1000", date: "2026-09-17" }));
    await must("Değersiz 2.000", api.post(`${ACC}/${a.id}/doubtful/${s}/write-off`, { amount: "2000", date: "2026-09-17" }));
  } else if (writeOff) await must("Değersiz", api.post(`${ACC}/${a.id}/doubtful/${s}/write-off`, { amount: "3000", date: "2026-09-17" }));
  if (advance) await must("avans", api.post(`${ACC}/${a.id}/entries`, { kind: "in", amount: String(advance), date: "2026-10-05", method: "cash", cashForce: true, similarOk: true, note: "Avans" }));
  return { a, inv, s };
}
const balanceOf = async (api, party) => (await must("kart", api.get(`${ACC}/${party}`))).totals.balance;
const payableOf = (store, id) => Number(store.get("SELECT payable_total AS p FROM invoices WHERE id = ?", id).p);
const tail = (error, then) => {
  assert.ok(error.includes(`Ne yapmalı: önce Değersiz Alacak satırını silin (${WHERE}), sonra ${then}; gerekirse Değersiz Alacak'ı yeniden yazın (form yazılabilecek tutarı gösterir).`), error);
  assert.ok(error.endsWith("Hiçbir şey kaydedilmedi."), error);
};

describe("2.5.1 M2 tur 3 — S-M2T2-1 = A: Değersiz satırı olan caride eksiye götüren iptal / iade her durumda ret", () => {
  it("avanslı caride tam iade → 409 'İade faturası kaydedilemez' (Değersiz olmasaydı da 2.476,45 alacaklı); iade yazılmaz, bakiye −2.576,45", async () => {
    const { server, api, store } = await boot();
    try {
      const b = await base(api, "M2T3 Avanslı İade", { advance: 3000 });
      assert.equal(await balanceOf(api, b.a.id), -2576.45);
      const detail = await must("fatura ayrıntısı", api.get(`${INV}/${b.inv.id}`));
      const line = (detail.lines || detail.invoice?.lines || [])[0];
      const r = await api.post(INV, { kind: "sale_return", accountId: b.a.id, originalId: b.inv.id, issueDate: "2026-10-01", lines: [{ originLineId: line.id, qty: 1 }], payment: { cash: [], cheques: [], endorse: [], rest: "open" }, force: true });
      assert.equal(r.status, 409, JSON.stringify(r.data).slice(0, 400));
      assert.equal(r.code, "doubtful-writeoff-balance", r.error);
      assert.match(r.error, /^İade faturası kaydedilemez: bu caride 17\.09\.2026 tarihli 3\.000,00 TL Değersiz Alacak satırı var; iadeden sonra cari 5\.476,45 TL alacaklı \(eksi bakiye\) olurdu\. /, r.error);
      assert.ok(r.error.includes("Değersiz Alacak satırı olan caride iade cariyi alacaklıya (eksi bakiyeye) götüremez; Değersiz Alacak satırı olmasaydı da cari 2.476,45 TL alacaklı olurdu — bu iadeyle o kayda Değersiz Alacak yazılamazdı."), r.error);
      tail(r.error, "iadeyi kaydedin");
      assert.equal(Number(store.get("SELECT COUNT(*) AS n FROM invoices WHERE original_id = ?", b.inv.id).n), 0);
      assert.equal(r.data.balanceMinor, -547645);
      assert.equal(await balanceOf(api, b.a.id), -2576.45);
    } finally {
      server.close();
    }
  });
  it("iletideki 'ne yapmalı' işe yarar: Değersiz satırı silinince aynı iptal kabul, bakiye −2.476,45, Mutabakat tamam", async () => {
    const { server, api, store } = await boot();
    try {
      const b = await base(api, "M2T3 Sil Sonra İptal", { advance: 3000 });
      const record = (await must("liste", api.get(`${ACC}/${b.a.id}/doubtful`))).records.find(item => item.id === b.s);
      await must("Değersiz satırını sil", api.del(`${ACC}/${b.a.id}/doubtful/${b.s}/write-offs/${record.writeOffs[0].entryId}`));
      assert.equal(await balanceOf(api, b.a.id), 423.55);
      await must("iptal", api.post(`${INV}/${b.inv.id}/cancel`, { reason: "Hatalı" }));
      assert.equal(store.get("SELECT status FROM invoices WHERE id = ?", b.inv.id).status, "cancelled");
      assert.equal(await balanceOf(api, b.a.id), -2476.45);
      assert.equal((await integrityOf(api)).ok, true);
    } finally {
      server.close();
    }
  });
  it("iki Değersiz satırı (1.000 + 2.000 @17.09): avanslı iptal 409, ileti son satırı ve toplamı anlatır", async () => {
    const { server, api } = await boot();
    try {
      const b = await base(api, "M2T3 İki Satır", { advance: 3000, split: true });
      assert.equal(await balanceOf(api, b.a.id), -2576.45);
      const r = await api.post(`${INV}/${b.inv.id}/cancel`, { reason: "Hatalı" });
      assert.equal(r.status, 409, JSON.stringify(r.data).slice(0, 400));
      assert.equal(r.code, "doubtful-writeoff-balance", r.error);
      assert.match(r.error, /^Fatura iptal edilemez: bu caride 17\.09\.2026 tarihli 2\.000,00 TL Değersiz Alacak satırı var \(carinin 2 Değersiz Alacak satırı, toplam 3\.000,00 TL\); iptalden sonra cari 5\.476,45 TL alacaklı/, r.error);
      assert.ok(r.error.includes("Değersiz Alacak satırı olmasaydı da cari 2.476,45 TL alacaklı olurdu"), r.error);
      assert.equal(r.data.writeOffMinor, 300000);
      assert.equal(await balanceOf(api, b.a.id), -2576.45);
    } finally {
      server.close();
    }
  });
  it("Değersiz satırı OLMAYAN avanslı caride iptal kabul (denetim okumaz), bakiye −2.476,45", async () => {
    const { server, api } = await boot();
    try {
      const b = await base(api, "M2T3 Değersizsiz Avans", { advance: 3000, writeOff: false });
      assert.equal(await balanceOf(api, b.a.id), 423.55);
      await must("iptal", api.post(`${INV}/${b.inv.id}/cancel`, { reason: "Hatalı" }));
      assert.equal(await balanceOf(api, b.a.id), -2476.45);
      assert.equal((await integrityOf(api)).ok, true);
    } finally {
      server.close();
    }
  });
  it("bakiyeyi DÜŞÜRMEYEN işlem eksi caride de kabul: iadenin Düzenle'si iadeyi küçültünce (eksi bakiye azalır)", async () => {
    // Elle: T (+ ek borç 2.000) + Değersiz (2.423,55) − kısmi iade 0,5 adet = 1.450 (973,55) − avans 3.000 (05.10) = −2.026,45; iade Düzenle 0,5 → 0,25 adet (1.450 → 725): −2.026,45 + 725 = −1.301,45.
    const { server, api, store } = await boot();
    try {
      const b = await base(api, "M2T3 İade Küçült", { extra: 2000 });
      const detail = await must("fatura ayrıntısı", api.get(`${INV}/${b.inv.id}`));
      const line = (detail.lines || detail.invoice?.lines || [])[0];
      const body = qty => ({ kind: "sale_return", accountId: b.a.id, originalId: b.inv.id, issueDate: "2026-10-01", lines: [{ originLineId: line.id, qty }], payment: { cash: [], cheques: [], endorse: [], rest: "open" }, force: true });
      const half = await must("kısmi iade", api.post(INV, body(0.5)));
      assert.equal(await balanceOf(api, b.a.id), 973.55);
      await must("avans", api.post(`${ACC}/${b.a.id}/entries`, { kind: "in", amount: "3000", date: "2026-10-05", method: "cash", cashForce: true, similarOk: true, note: "Avans" }));
      assert.equal(await balanceOf(api, b.a.id), -2026.45);
      await must("iade küçülür", api.post(`${INV}/${half.id}/edit`, body(0.25)));
      assert.equal(payableOf(store, half.id), 725);
      assert.equal(await balanceOf(api, b.a.id), -1301.45);
    } finally {
      server.close();
    }
  });
  it("kilitli dönemde dönem kilidi iletisi önce gelir (Değersiz denetimi değil)", async () => {
    const { server, api } = await boot();
    try {
      const b = await base(api, "M2T3 Kilitli", { advance: 3000 });
      await must("kilit", api.put("/api/admin/period-lock", { lockedUntil: "2026-09-30" }));
      const r = await api.post(`${INV}/${b.inv.id}/cancel`, { reason: "Hatalı" });
      assert.equal(r.status, 409, JSON.stringify(r.data).slice(0, 400));
      assert.equal(r.code, "period-locked", r.error);
      const e = await api.post(`${INV}/${b.inv.id}/edit`, saleBody(b.a.id, 100));
      assert.equal(e.status, 409, JSON.stringify(e.data).slice(0, 400));
      assert.equal(e.code, "invoice-locked", e.error);
      assert.equal(await balanceOf(api, b.a.id), -2576.45);
    } finally {
      server.close();
    }
  });
});

describe("2.5.1 M2 tur 3 — S-M2T2-2 = A: Değersiz'den sonra fatura TUTARININ Düzenle ile düşürülmesi iade gibi reddedilir", () => {
  it("2.900 → 100 → 409 'Fatura düzenlenemez' (düzenlemeden sonra 2.376,45 alacaklı); fatura 2.900 kalır, bakiye 423,55", async () => {
    const { server, api, store } = await boot();
    try {
      const b = await base(api, "M2T3 Tutar Düşür");
      assert.equal(await balanceOf(api, b.a.id), 423.55);
      const r = await api.post(`${INV}/${b.inv.id}/edit`, saleBody(b.a.id, 100));
      assert.equal(r.status, 409, JSON.stringify(r.data).slice(0, 400));
      assert.equal(r.code, "doubtful-writeoff-balance", r.error);
      assert.match(r.error, /^Fatura düzenlenemez: bu caride 17\.09\.2026 tarihli 3\.000,00 TL Değersiz Alacak satırı var; düzenlemeden sonra cari 2\.376,45 TL alacaklı \(eksi bakiye\) olurdu\. /, r.error);
      assert.ok(r.error.includes("Değersiz Alacak yazımı cariyi alacaklıya düşüremez — bu düzenlemeyle o kayda Değersiz Alacak yazılamazdı."), r.error);
      tail(r.error, "faturayı düzenleyin");
      assert.equal(r.data.balanceMinor, -237645);
      assert.equal(payableOf(store, b.inv.id), 2900);
      assert.equal(await balanceOf(api, b.a.id), 423.55);
      assert.equal(Number(store.get("SELECT COUNT(*) AS n FROM account_entries WHERE invoice_id = ?", b.inv.id).n), 1, "bağ kopmadı");
      assert.equal((await integrityOf(api)).ok, true);
    } finally {
      server.close();
    }
  });
  it("avanslı caride 2.900 → 2.800 → 409 (eksiyi büyütür); bakiye −2.576,45", async () => {
    const { server, api, store } = await boot();
    try {
      const b = await base(api, "M2T3 Avanslı Düşür", { advance: 3000 });
      const r = await api.post(`${INV}/${b.inv.id}/edit`, saleBody(b.a.id, 2800));
      assert.equal(r.status, 409, JSON.stringify(r.data).slice(0, 400));
      assert.equal(r.code, "doubtful-writeoff-balance", r.error);
      assert.ok(r.error.includes("düzenlemeden sonra cari 2.676,45 TL alacaklı (eksi bakiye) olurdu"), r.error);
      assert.equal(payableOf(store, b.inv.id), 2900);
      assert.equal(await balanceOf(api, b.a.id), -2576.45);
    } finally {
      server.close();
    }
  });
  it("tutar artışı (2.900 → 3.000) ve eksiye düşürmeyen azalış (ek borçlu caride 2.900 → 2.000) kabul; Mutabakat tamam", async () => {
    const { server, api, store } = await boot();
    try {
      const up = await base(api, "M2T3 Tutar Artır");
      await must("artış", api.post(`${INV}/${up.inv.id}/edit`, saleBody(up.a.id, 3000)));
      assert.equal(payableOf(store, up.inv.id), 3000);
      assert.equal(await balanceOf(api, up.a.id), 523.55);
      const down = await base(api, "M2T3 Artıda Kalan Azalış", { extra: 2000 });
      assert.equal(await balanceOf(api, down.a.id), 2423.55);
      await must("azalış", api.post(`${INV}/${down.inv.id}/edit`, saleBody(down.a.id, 2000)));
      assert.equal(payableOf(store, down.inv.id), 2000);
      assert.equal(await balanceOf(api, down.a.id), 1523.55);
      assert.equal((await integrityOf(api)).ok, true);
    } finally {
      server.close();
    }
  });
  it("Düzenle'de cari değişirse (borç bu cariden çıkar) eski cari denetlenir: 409, eski carinin bakiyesi 223,55 kalır", async () => {
    // Elle: T + Değersiz (423,55) + avans 1.000 (−576,45) + bağsız ikinci fatura 800 @10.10 (223,55); ikinci fatura öbür cariye → eski cari −576,45 (Değersiz olmasaydı +2.423,55).
    const { server, api, store } = await boot();
    try {
      const b = await base(api, "M2T3 Cari Değiştir", { advance: 1000 });
      const second = await must("ikinci fatura", api.post(INV, saleBody(b.a.id, 800, { date: "2026-10-10" })));
      assert.equal(await balanceOf(api, b.a.id), 223.55);
      phone += 1;
      const other = await must("öbür cari", api.post(ACC, { name: "M2T3 Öbür Cari", type: "customer", registeredOn: "2026-09-01", phone: `0500 256 ${String(phone).padStart(2, "0")} 02` }));
      const r = await api.post(`${INV}/${second.id}/edit`, saleBody(other.id, 800, { date: "2026-10-10" }));
      assert.equal(r.status, 409, JSON.stringify(r.data).slice(0, 400));
      assert.equal(r.code, "doubtful-writeoff-balance", r.error);
      assert.ok(r.error.startsWith("Fatura düzenlenemez: bu caride 17.09.2026 tarihli 3.000,00 TL Değersiz Alacak satırı var; düzenlemeden sonra cari 576,45 TL alacaklı (eksi bakiye) olurdu."), r.error);
      assert.equal(store.get("SELECT account_id AS a FROM invoices WHERE id = ?", second.id).a, b.a.id);
      assert.equal(await balanceOf(api, b.a.id), 223.55);
      assert.equal(await balanceOf(api, other.id), 0);
    } finally {
      server.close();
    }
  });
  it("tutarı DEĞİŞMEYEN Düzenle'de peşin tahsilat eklenmesi denetlenmez (tahsilattır; tutar düşürmesi değil) — cari eksiye gitse de kabul", async () => {
    // Elle: T + Değersiz (423,55) + avans 1.000 (−576,45) + ikinci fatura 800 @10.10 açık (223,55); aynı tutarla Düzenle + peşin 800 → −576,45. Aynı tahsilat cari kartından da
    // yazılabilir (sıradan tahsilat Değersiz'den sonra reddedilmez) — Düzenle yolu farklı davranmaz.
    const { server, api, store } = await boot();
    try {
      const b = await base(api, "M2T3 Peşin Ekle", { advance: 1000 });
      const second = await must("ikinci fatura", api.post(INV, saleBody(b.a.id, 800, { date: "2026-10-10" })));
      assert.equal(await balanceOf(api, b.a.id), 223.55);
      await must("Düzenle + peşin", api.post(`${INV}/${second.id}/edit`, saleBody(b.a.id, 800, { date: "2026-10-10", payment: { cash: [{ amount: 800, method: "cash" }], cheques: [], endorse: [], rest: "open" } })));
      assert.equal(payableOf(store, second.id), 800);
      assert.equal(await balanceOf(api, b.a.id), -576.45);
    } finally {
      server.close();
    }
  });
});
