// 2.5.1 Mİ tur 2 — görünen taksit numarası Tek Yükümlülük Kuyruğu'nun GİRDİSİNE girmez.
// BAŞ MİMAR KARARI 27.11 (1) (kullanıcıya gösterildi): tur 1'in taksit satırına eklediği görünen numara (no) tek borç sırasının girdisine sızıyordu
// (test/obligation-input-250 "hakemden farklı çıktı" — taksit kartı olan cari sınıfları). Hakem dosyası DEĞİŞMEZ; görünen numara girdiye GİRMEZ, girdi bayt bayt eskisiyle
// aynı kalır; numara yalnız gösterim / çıktı yollarında (lib/plan-item-no.mjs — tek kaynak).
// Bu sınama, hakemin kapsamadığı durumu (taksiti SİLİNMİŞ ve vadesi ÖNE ALINMIŞ kart — saklanan sıra ≠ görünen numara) ayrıca tutar:
//   girdi yolları — kartın kendi hesabı (allocate), cari kartının kart listesi (forAccount), carinin defter okuması (detail withRemaining: false), toplu defter (allLedgers),
//   kart haritası (ledgerPlansByAccount) — numara alanı TAŞIMAZ ve satır metni SAKLANAN sırayı yazar; kuyruğun çıktısı da numara alanı taşımaz;
//   gösterim yolları (cari kartı ekranı, allLedgers numbered) görünen numarayı yazar; kuyruğun ekrana verdiği sayılar (bakiye, gecikmiş) iki yolda AYNI.
// Tur 1 kodunda (t251-mi-tur1) KIRMIZI: allocate / forAccount taksit satırında `no` alanı var.
import assert from "node:assert/strict";
import { after, before, describe, it } from "node:test";
import { allocate } from "../server/lib/plans.mjs";
import { loginAdmin, startTestServer } from "./helpers.mjs";

const TODAY = "2026-10-20";
const NOW = `${TODAY}T12:00:00+03:00`;
const AUDIT = { id: "test", role: "admin", permissions: [] };
const unwrap = response => ({ ...response, data: response.data && typeof response.data === "object" && "ok" in response.data ? (response.data.ok ? response.data.data : response.data) : response.data });
// Map / Set içeren çıktının metni (kuyruk çıktısı Map taşır).
const text = value => JSON.stringify(value, (key, inner) => (inner instanceof Map ? { "[Map]": [...inner] } : inner instanceof Set ? { "[Set]": [...inner] } : typeof inner === "function" ? "[işlev]" : inner));
// Nesne ağacında "no" adlı anahtar var mı (yol listesi).
function noKeys(value, path = "", out = []) {
  if (value instanceof Map) {
    for (const [key, inner] of value) noKeys(inner, `${path}<${String(key).slice(0, 24)}>`, out);
    return out;
  }
  if (Array.isArray(value)) value.forEach((inner, index) => noKeys(inner, `${path}[${index}]`, out));
  else if (value && typeof value === "object") for (const [key, inner] of Object.entries(value)) (key === "no" ? out.push(`${path}.no`) : null, noKeys(inner, `${path}.${key}`, out));
  return out;
}

describe("Mİ tur 2 — görünen taksit numarası kuyruğun girdisine girmez (taksiti silinmiş / vadesi öne alınmış kart)", () => {
  let h;
  before(async () => {
    const server = await startTestServer({ now: { time: NOW, fixed: true }, env: { HUKUK_LICENSE_URL: "http://127.0.0.1:9" } });
    const client = await loginAdmin(server);
    const tick = () => server.clock.advance({ minutes: 1 });
    const api = { get: async url => unwrap(await client.get(url)), post: async (url, body) => unwrap(await client.post(url, body)), put: async (url, body) => unwrap(await client.put(url, body)), del: async url => unwrap(await client.del(url)) };
    const must = async (label, promise) => {
      const res = await promise;
      assert.equal(res.status, 200, `${label}: ${res.status} ${JSON.stringify(res.data).slice(0, 300)}`);
      tick();
      return res.data;
    };
    await api.post("/api/workspace/bank/setup/dismiss", {});
    const win = planId => must("kart penceresi", api.get(`/api/workspace/plans/${planId}`));
    const acc = await must("cari", api.post("/api/workspace/accounts", { name: "Mİ2 Girdi", type: "customer", registeredOn: "2025-09-01", phone: "0500 253 11 00" }));
    // Kart 1: 3 taksit, 2.'si silinir (saklanan 1, 3 → görünen 1, 2); 3.'ye bağlı tahsilat.
    const one = await must("kart 1", api.post("/api/workspace/plans", { name: "Mİ2 Girdi Kart 1", registeredOn: "2026-06-01", total: "3000", accountId: acc.id, mode: "auto", count: "3", firstDue: "2026-08-06", everyMonths: "1" }));
    const oneItems = (await win(one.id)).items;
    await must("2. taksiti sil", api.del(`/api/workspace/plans/${one.id}/items/${oneItems[1].id}`));
    await must("kart 1 tutarı", api.put(`/api/workspace/plans/${one.id}`, { ...(await win(one.id)), total: "2000" }));
    await must("3.'ye tahsilat", api.post(`/api/workspace/plans/${one.id}/entries`, { kind: "in", amount: "400", method: "cash", date: "2026-10-18", cashForce: true, similarOk: true, itemId: oneItems[2].id }));
    // Kart 2: 3 taksit, 3.'nün vadesi 1.'nin önüne alınır (saklanan 3 → görünen 1); 3.'ye bağlı tahsilat.
    const two = await must("kart 2", api.post("/api/workspace/plans", { name: "Mİ2 Girdi Kart 2", registeredOn: "2026-06-01", total: "3000", accountId: acc.id, mode: "auto", count: "3", firstDue: "2026-09-01", everyMonths: "1" }));
    const twoItems = (await win(two.id)).items;
    await must("vadesi öne", api.put(`/api/workspace/plans/${two.id}/items/${twoItems[2].id}`, { dueDate: "2026-08-15", amount: "1000" }));
    await must("öne alınana tahsilat", api.post(`/api/workspace/plans/${two.id}/entries`, { kind: "in", amount: "300", method: "cash", date: "2026-10-19", cashForce: true, similarOk: true, itemId: twoItems[2].id }));
    // Kart seçilmeden alınan cari tahsilatı (kuyrukta en eski açık taksiti kapatır).
    await must("cari tahsilatı", api.post(`/api/workspace/accounts/${acc.id}/entries`, { kind: "in", amount: "250", date: "2026-10-19", method: "cash", cashForce: true, similarOk: true }));
    h = { server, api, must, acc, one, two, ctx: server.app.context };
  });
  after(async () => h?.server.close());

  it("kartın kendi hesabı (allocate) ve cari kartının kart listesi (forAccount): taksit satırında ve sıradaki taksitte numara alanı YOK", () => {
    const ledger = allocate({ total: 3000 }, [{ id: "a", seq: 1, dueDate: "2026-08-06", amount: 1000 }, { id: "c", seq: 3, dueDate: "2026-10-06", amount: 1000 }], [], { today: TODAY });
    assert.deepEqual(noKeys(ledger), [], "allocate çıktısında 'no' yok");
    const list = h.ctx.plans.forAccount(h.acc.id, AUDIT);
    assert.equal(list.length, 2);
    assert.deepEqual(noKeys(list), [], `forAccount çıktısında 'no' yok: ${noKeys(list).slice(0, 5).join(" · ")}`);
    assert.deepEqual(list.flatMap(plan => plan.items.map(item => item.seq)).sort(), [1, 1, 2, 3, 3], "saklanan sıra aynen (1, 3 ve 1, 2, 3)");
  });

  it("carinin defter okuması (detail withRemaining: false — fatura kapaması / kuyruk) ve toplu defter (allLedgers): satır metni SAKLANAN sırayla, numara alanı yok", () => {
    const own = h.ctx.accounts.detail(h.acc.id, AUDIT, { withRemaining: false }).ledger;
    const labels = lines => lines.filter(line => line.kind === "plan-in").map(line => line.label).sort();
    assert.deepEqual(labels(own), ["Taksit Tahsilatı · 3. taksit", "Taksit Tahsilatı · 3. taksit"], "girdi: saklanan sıra (kart 1'in 3.'sü, kart 2'nin 3.'sü)");
    assert.deepEqual(noKeys(own), [], "defter satırlarında 'no' yok");
    const batch = h.ctx.accounts.allLedgers({}).lines.get(h.acc.id);
    assert.deepEqual(labels(batch), labels(own), "toplu defter (kuyruğun toplu girdisi) = tek cari defteri");
    assert.deepEqual(noKeys(h.ctx.plans.ledgerPlansByAccount().get(h.acc.id)), [], "kart haritasında 'no' yok");
  });

  it("gösterim yolları görünen numarayı yazar: cari kartı ekranı ve Tüm Cari Hareketleri'nin okuduğu numaralı defter", async () => {
    const screen = await h.must("cari kartı", h.api.get(`/api/workspace/accounts/${h.acc.id}`));
    const labels = lines => lines.filter(line => line.kind === "plan-in").map(line => line.label).sort();
    assert.deepEqual(labels(screen.ledger), ["Taksit Tahsilatı · 1. taksit", "Taksit Tahsilatı · 2. taksit"], "ekran: kart 2'nin öne alınan taksiti 1., kart 1'in kalan 3.'sü 2.");
    assert.deepEqual(labels(h.ctx.accounts.allLedgers({ numbered: true }).lines.get(h.acc.id)), labels(screen.ledger), "allLedgers numbered = ekran");
  });

  it("kuyruğun çıktısı numara alanı taşımaz; girdi ile ekranın okuduğu sayılar AYNI (bakiye, gecikmiş, taksit kalanları)", () => {
    const input = h.ctx.accounts.detail(h.acc.id, AUDIT, { withRemaining: false }).ledger;
    const queue = h.ctx.invoices.obligationsFor(h.acc.id, input);
    assert.deepEqual(noKeys(queue), [], `kuyruk çıktısında taksit numarası yok: ${noKeys(queue).slice(0, 5).join(" · ")}`);
    assert.equal(text(h.ctx.invoices.allObligations().get(h.acc.id)), text(queue), "toplu kuyruk = tek cari kuyruğu (aynı girdi)");
    const shown = h.ctx.accounts.detail(h.acc.id, AUDIT);
    const raw = h.ctx.accounts.detail(h.acc.id, AUDIT, { withRemaining: false });
    assert.equal(shown.totals.balance, raw.totals.balance, "bakiye iki yolda aynı");
    assert.equal(shown.totals.balance, 5000 - 400 - 300 - 250, "bakiye ELLE: 2.000 + 3.000 − 950");
    assert.deepEqual(shown.ledger.map(line => [line.id, line.debit, line.credit, line.date]), raw.ledger.map(line => [line.id, line.debit, line.credit, line.date]), "satırlar (kimlik / borç / alacak / tarih) iki yolda aynı; yalnız metin farklı");
  });
});
