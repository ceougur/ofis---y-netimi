// 2.5.0 Ç5-A tur 3d — cari kartının "Normal Cariye İşlendi" etiketi ve fatura iptalinin şüpheli bildirimi, defterin ayırıcısının satıra verdiği şüpheli PAYINDAN
// (tasarım notu docs/erp/C5-ACILIS-TASARIM.md §19.8).
// KARARLAR (iş listesi D, AYNEN):
//   BAŞ MİMAR KARARI 14.11 09:00 (2): "Cari kartının 'Normal Cariye İşlendi' etiketi pay varken kısmen yanlış → TUR 3d'de etiket ayırıcının payından okunur (pay 0 → 'Normal Cariye
//     İşlendi'; tamamı şüpheliden düştüyse etiket yok; kısmi → 'Kısmen Normal Cariye İşlendi' ve 120'ye düşen tutar)." (3): "Fatura iptalinin bildirim metni pay varken kısmen yanlış → tur 3d."
//   S168 = B: "Fatura 1 1.000 → şüpheliye alma 1.000 → Fatura 2 500 (kayıttan sonra) → 400 nakit 'Normal Cari Hesaba İşle' → … kalem görünümünde şüpheli 1.000 = Fatura 1'in 600'ü +
//     Fatura 2'nin 400'ü … faturanın şüpheli sayılan kısmı önce şüpheliden (128) düşer, kalanı normalden"; görev metni (ana oturum): "Fatura 2'ye bağlı 500 → 400'ü 128'den, 100'ü 120'den".
// Beklenen sayılar karar metinlerinden (programdan türetilmedi — ders 5): F2'ye bağlı 300 → tamamı 128 (etiket yok); F2'ye bağlı 500 → 100 normal ("Kısmen", 100,00 TL); faturanın şüpheli
// payı yokken (normal işaretli tahsilat yok → F2'nin kuyrukta şüpheli payı 0) bağlı 200 → tamamı 120 ("Normal Cariye İşlendi"). Tarihler göreli, sahte saat sabit (ders 13).
import assert from "node:assert/strict";
import { after, before, describe, it } from "node:test";
import { loginAdmin, startTestServer } from "./helpers.mjs";

const TODAY = "2026-10-20";
const day = offset => {
  const d = new Date(`${TODAY}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + offset);
  return d.toISOString().slice(0, 10);
};
const unwrap = r => ({ status: r.status, data: r.data && typeof r.data === "object" && "ok" in r.data ? (r.data.ok ? r.data.data : r.data) : r.data });

describe("Ç5-A tur 3d: 'Normal Cariye İşlendi' etiketi ve fatura iptali bildirimi ayırıcının payından", () => {
  let server;
  let api;
  let n = 0;
  let base = -900;
  before(async () => {
    server = await startTestServer({ now: { time: `${TODAY}T12:00:00+03:00`, fixed: true }, env: { HUKUK_LICENSE_URL: "http://127.0.0.1:9" } });
    const client = await loginAdmin(server);
    api = { get: async u => unwrap(await client.get(u)), post: async (u, b) => unwrap(await client.post(u, b)) };
    await api.post("/api/workspace/bank/setup/dismiss", {});
  });
  after(async () => server?.close());
  const must = async (label, promise) => {
    const res = await promise;
    assert.equal(res.status, 200, `${label}: ${res.status} ${JSON.stringify(res.data).slice(0, 400)}`);
    return res.data;
  };
  const invoice = async (acc, date, amount) => (await must("fatura", api.post("/api/workspace/invoices", { scenario: "service_sale", accountId: acc.id, issueDate: date, lines: [{ name: "Hizmet", qty: 1, unitPrice: String(amount), vatRate: 0 }], payment: { rest: "open" } }))).id;
  const cash = (acc, date, amount, extra = {}) => api.post(`/api/workspace/accounts/${acc.id}/entries`, { kind: "in", amount: String(amount), date, method: "cash", cashForce: true, similarOk: true, ...extra });
  // Senaryo (S168): Fatura 1 1.000 (B−60) → Şüpheli Alacağa Al 1.000 (B−40) → Fatura 2 500 (B−30) → [elle borç `extra` (B−25)] → [Normal Cari Hesaba İşle `normal` (B−20)].
  const scenario = async (label, { normal = 400, extra = 0 } = {}) => {
    base += 30;
    const B = base;
    const acc = await must("cari", api.post("/api/workspace/accounts", { name: `Şüpheli Etiket ${label}`, type: "customer", registeredOn: day(-1200), phone: `0500 329 ${String(10 + Math.floor((n += 1) / 100)).padStart(2, "0")} ${String(n % 100).padStart(2, "0")}` }));
    await invoice(acc, day(B - 60), 1000);
    await must("şüpheliye al", api.post(`/api/workspace/accounts/${acc.id}/doubtful`, { amount: "1000", date: day(B - 40), reason: "lawsuit", note: "tur 3d" }));
    const f2 = await invoice(acc, day(B - 30), 500);
    // İptalin kapıdan geçebilmesi için (S155 = A: borç açık şüphelinin altına düşmez) F2'den sonra elle borç; kuyrukta F2'nin şüpheli payını değiştirmez (en eski önce).
    if (extra) await must("borç yaz", api.post(`/api/workspace/accounts/${acc.id}/entries`, { kind: "debt", amount: String(extra), date: day(B - 25), note: "Ek borç" }));
    const flagged = normal ? await must("Normal Cari Hesaba İşle", cash(acc, day(B - 20), normal, { doubtfulSkip: true })) : null;
    return { acc, f2, flagged, at: offset => day(B + offset) };
  };
  const entryOf = async (acc, entryId) => (await must("cari kartı", api.get(`/api/workspace/accounts/${acc.id}`))).entries.find(row => row.id === entryId);
  const label = entry => (entry.doubtfulNormal ? "tam" : entry.doubtfulNormalPart > 0 ? `kısmi ${entry.doubtfulNormalPart}` : "yok");

  it("pay = tutar: F2'ye bağlı 300 tamamı şüpheliden (128) → etiket YOK; işaretli 400 → 'Normal Cariye İşlendi'; iptal penceresinde bildirim yok", async () => {
    const s = await scenario("tam-pay");
    const linked = await must("F2'ye bağlı 300", cash(s.acc, s.at(-10), 300, { invoiceId: s.f2 }));
    assert.equal(label(await entryOf(s.acc, linked.entryId)), "yok", "tamamı 128'den düştü: etiket yok");
    assert.equal(label(await entryOf(s.acc, s.flagged.entryId)), "tam", "işaretli tahsilat: Normal Cariye İşlendi");
    const detail = await must("fatura detayı", api.get(`/api/workspace/invoices/${s.f2}`));
    assert.equal(detail.cancelNotice, "", "iptal bağlı tahsilatı normal cariden çıkarmaz → bildirim yok");
  });

  it("kısmi pay: F2'ye bağlı 500 → 400 128'den, 100 120'den → 'Kısmen Normal Cariye İşlendi' 100; iptal bildirimi 100'ü söyler", async () => {
    const s = await scenario("kismi-pay", { extra: 500 });
    const linked = await must("F2'ye bağlı 500", cash(s.acc, s.at(-10), 500, { invoiceId: s.f2 }));
    const entry = await entryOf(s.acc, linked.entryId);
    assert.equal(label(entry), "kısmi 100", "120'ye düşen 100");
    const detail = await must("fatura detayı", api.get(`/api/workspace/invoices/${s.f2}`));
    assert.match(detail.cancelNotice, /Bu faturaya bağlı 500,00 TL tahsilatın 100,00 TL'si şu an normal cari hesaba işli/, detail.cancelNotice);
    assert.doesNotMatch(detail.cancelNotice, /500,00 TL tahsilat şu an normal/, "tutarın tamamı normal cariye işli denmez");
    const cancelled = await must("iptal", api.post(`/api/workspace/invoices/${s.f2}/cancel`, { reason: "tur 3d" }));
    assert.equal(cancelled.notices.length, 1, JSON.stringify(cancelled.notices));
    assert.match(cancelled.notices[0], /500,00 TL tahsilatın 100,00 TL'si artık şüpheli alacaktan düşüyor/, cancelled.notices[0]);
  });

  it("pay 0: faturanın kuyrukta şüpheli payı yok (işaretli tahsilat yok) → bağlı 200 tamamı 120 → 'Normal Cariye İşlendi'; iptal bildirimi eski metin", async () => {
    const s = await scenario("sifir-pay", { normal: 0 });
    const linked = await must("F2'ye bağlı 200", cash(s.acc, s.at(-10), 200, { invoiceId: s.f2 }));
    assert.equal(label(await entryOf(s.acc, linked.entryId)), "tam", "pay 0: Normal Cariye İşlendi");
    const detail = await must("fatura detayı", api.get(`/api/workspace/invoices/${s.f2}`));
    assert.match(detail.cancelNotice, /Bu faturaya bağlı 200,00 TL tahsilat şu an normal cari hesaba işli/, detail.cancelNotice);
  });
});
