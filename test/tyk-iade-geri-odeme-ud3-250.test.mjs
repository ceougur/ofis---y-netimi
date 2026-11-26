// 2.5.0 UD düzeltme turu 3 — Tek Yükümlülük Kuyruğu: faturasız stok iadesinin GERİ ÖDEMESİ (KS8.1) para ↔ para eşleşmesiyle eksik ölçülmez.
// KARARLAR (AYNEN; kâhin cari KARARLAR.md ve programın kural notu lib/obligation-queue.mjs implicitRefunds):
//   KS8 (2.4.6 madde 9 / DB1): "faturasız stok Satış İadesi ya da fatura iadesi bedeli cari kartından 'Ödeme' ile müşteriye geri ödenince → 'iade geri ödemesi': geri ödeme iadeye
//   bağlanır". KS8.1 (BAŞ MİMAR, 2.4.6): "iadeye bağlanmamış para (a) karşı tarafın AÇIK iadesini kendi tarafının yükümlülükleriyle TEK sırada kapatır; (b) yükümlülüklerden ARTANI,
//   bir borcu kapatmış iadenin (en eski önce; üst sınır iadenin geri ödeme dışında kapattığı …) geri ödemesidir."
//   S96 = A (10.11 13:20): "verilen, karşılığı gelmemiş avans takvim / zil / Vade Takip / nakit akışında AYRI KALEM ('Tahsil Edilecek Borç', ödeme gününde vadeli)".
// HATA (kâhin cari rastgele s1-28 / s1-4 / s1-6 / s1-7; v2.4.9 ve kâhin tam geri ödeme): tur 2b-2'nin S98 fatura durumu kuralı (karşı tarafın netleşmemiş bağsız parası gelen bağsız paranın
// karşısında kalemdir) ölçüm geçişinde de çalışıyordu — müşteriye Ödeme müşterinin tahsilatıyla eşleşince "yükümlülüklerden artan" küçük ölçülüyor, iadenin geri ödemesi eksik kalıyor,
// artanı 'Tahsil Edilecek Borç' avansı olup açılması gereken borç kapalı görünüyordu. Bakiye ve "kalemler toplamı = bakiye" her iki kodda tutar; değişen yalnız dağılım (gecikmiş, Vade Takip).
// Beklenen sayılar karar metinlerinden elle (aşağıda her senaryoda) — v2.4.9'un gerçek kodu ve kodu görmeyen kâhin aynı sayıyı verdi (UD turu 3 not defteri m-s1-28 / m-s1-4); programdan
// türetilmedi (ders 5). Sahte saat sabit (ders 13).
import assert from "node:assert/strict";
import { after, before, describe, it } from "node:test";
import { loginAdmin, startTestServer } from "./helpers.mjs";

const TODAY = "2026-06-30";
const unwrap = r => ({ status: r.status, data: r.data && typeof r.data === "object" && "ok" in r.data ? (r.data.ok ? r.data.data : r.data) : r.data });

describe("TYK — faturasız stok iadesinin geri ödemesi (KS8.1) para ↔ para eşleşmesiyle eksik ölçülmez (UD turu 3)", () => {
  let server;
  let api;
  let n = 0;
  let mal = "";
  before(async () => {
    server = await startTestServer({ now: { time: `${TODAY}T12:00:00+03:00`, fixed: true }, env: { HUKUK_LICENSE_URL: "http://127.0.0.1:9" } });
    const client = await loginAdmin(server);
    api = { get: async u => unwrap(await client.get(u)), post: async (u, b) => unwrap(await client.post(u, b)) };
    await api.post("/api/workspace/bank/setup/dismiss", {});
    mal = (await must("mal", api.post("/api/workspace/stock", { kind: "goods", code: "UD3-MAL", name: "UD3 Malı", unit: "Adet", openingQty: "100000", salePrice: "100" }))).id;
  });
  after(async () => server?.close());
  async function must(label, promise) {
    const res = await promise;
    assert.equal(res.status, 200, `${label}: ${res.status} ${JSON.stringify(res.data).slice(0, 400)}`);
    return res.data;
  }
  const cari = async (opening, extra = {}) => must("cari", api.post("/api/workspace/accounts", { name: `UD3 Müşteri ${(n += 1)}`, type: "customer", phone: "", registeredOn: "2026-03-01", openingBalance: opening, openingSide: "auto", ...extra }));
  const iade = (acc, amount, date) => must("faturasız stok iadesi", api.post(`/api/workspace/stock/${mal}/moves`, { kind: "in", reason: "return", qty: "1", unitPrice: amount, pay: "account", accountId: acc.id, date }));
  const entry = async (acc, body) => (await must(body.kind, api.post(`/api/workspace/accounts/${acc.id}/entries`, { method: "cash", cashForce: true, similarOk: true, ...body }))).entryId;
  const detail = acc => must("cari kartı", api.get(`/api/workspace/accounts/${acc.id}`));
  const kalanOf = (d, pred) => d.entries.filter(pred).map(e => e.remaining);
  const duesOf = async acc => ((await must("takvim", api.get("/api/workspace/dues"))).items || []).filter(item => JSON.stringify(item).includes(acc.id));

  it("A (s1-4): Açılış 1.483,45 · 25.06 iade 1.914,34 · 26.06 tahsilat 564,84 · 30.06 Ödeme 2.385,23 ⇒ Açılış Kalan 918,61, Ödeme avansı 470,89, bakiye 1.389,50", async () => {
    // Elle (KS8.1): 25.06 iade Açılış'ı kapatır (1.483,45), açık kalanı 430,89. 30.06 Ödeme: (a) açık iade 430,89; (b) artan 1.954,34 → iadenin Açılış'ı kapatan kısmının geri
    // ödemesi (üst sınır 1.483,45) ⇒ Açılış yeniden açılır; 26.06 tahsilatı Açılış'tan düşer → 918,61; Ödemenin artanı 2.385,23 − 1.914,34 = 470,89 verilen avans (S96 kalemi).
    const acc = await cari("1483,45");
    await iade(acc, "1914,34", "2026-06-25");
    await entry(acc, { kind: "in", amount: "564,84", date: "2026-06-26" });
    const odeme = await entry(acc, { kind: "out", amount: "2385,23", date: "2026-06-30" });
    const d = await detail(acc);
    assert.equal(d.totals.balance, 1389.5, "bakiye");
    assert.deepEqual(kalanOf(d, e => "remaining" in e && Number(e.amount) === 1483.45), [918.61], "Açılış Bakiyesi Kalan");
    const dues = await duesOf(acc);
    const avans = dues.filter(item => JSON.stringify(item).includes(odeme));
    assert.deepEqual(avans.map(item => [item.label, item.dueDate, item.amount]), [["Tahsil Edilecek Borç", "2026-06-30", 470.89]], `takvimde Ödeme avansı: ${JSON.stringify(dues.map(x => [x.label, x.dueDate, x.amount]))}`);
  });

  it("B (s1-28): borç ödendikten sonra 16.04 iade 1.372,46 · 23.04 Ödeme 1.372,46 (iadenin tamamı geri ödenir) · sonra tahsilat ⇒ Ödeme avansı YOK, açılan fatura açık kalır", async () => {
    // Elle: Açılış 3.736,76 (01.03) + G4 3.000 (22.03) + G5 2.842,44 (25.03) + G7 2.466,53 (11.04) = 12.045,73 borç; 14.03 / 16.03 tahsilat 2.516,50 + 3.434,29; 16.04 iade 1.372,46
    // borçları kapatır (geri ödeme dışında kapattığı 1.372,46); 18.04 tahsilat 1.861,54; 23.04 Ödeme 1.372,46: yükümlülüğü yok, açık iade yok → artanın TAMAMI iadenin geri ödemesi
    // (üst sınır 1.372,46) ⇒ verilen avans 0; 26.05 iade 1.350,84; 04.06 tahsilat 1.721,17. Bakiye = 12.045,73 − 5.950,79 − 1.372,46 − 1.861,54 + 1.372,46 − 1.350,84 − 1.721,17 = 1.161,39
    // ⇒ en geç vadeli G7 1.161,39 açık (S2 vade sırası), öbür kalemler 0.
    const acc = await cari("3736,76", { openingExpectedDate: "2026-03-01" });
    await entry(acc, { kind: "in", amount: "2516,50", date: "2026-03-14" });
    await entry(acc, { kind: "in", amount: "3434,29", date: "2026-03-16" });
    const fatura = async (tutar, tarih) => (await must("fatura", api.post("/api/workspace/invoices", { scenario: "service_sale", accountId: acc.id, issueDate: tarih, lines: [{ name: "Hizmet", qty: 1, unitPrice: tutar, vatRate: 0 }], payment: { rest: "open" } }))).id;
    await fatura("3000", "2026-03-22");
    await fatura("2842,44", "2026-03-25");
    const g7 = await fatura("2466,53", "2026-04-11");
    await iade(acc, "1372,46", "2026-04-16");
    await entry(acc, { kind: "in", amount: "1861,54", date: "2026-04-18" });
    const odeme = await entry(acc, { kind: "out", amount: "1372,46", date: "2026-04-23" });
    await iade(acc, "1350,84", "2026-05-26");
    await entry(acc, { kind: "in", amount: "1721,17", date: "2026-06-04", dueDate: "2026-06-07" });
    const d = await detail(acc);
    assert.equal(d.totals.balance, 1161.39, "bakiye");
    const inv = await must("G7", api.get(`/api/workspace/invoices/${g7}`));
    assert.equal(Number(inv.open ?? inv.invoice?.open), 1161.39, `G7 açığı: ${JSON.stringify({ open: inv.open, status: inv.status }).slice(0, 200)}`);
    const dues = await duesOf(acc);
    assert.equal(dues.filter(item => JSON.stringify(item).includes(odeme)).length, 0, `Ödeme günlü 'Tahsil Edilecek Borç' kalemi yok: ${JSON.stringify(dues.map(x => [x.label, x.dueDate, x.amount]))}`);
  });
});
