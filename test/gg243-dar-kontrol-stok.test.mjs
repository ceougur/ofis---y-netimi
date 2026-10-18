// Dar kontrol turu 2.4.3 (D3, DÜŞÜK; betik r10): Stok Excel'i İKİNCİ kez yüklenince KDV hücresi tanınmayan ama zaten var olan ürün satırı:
//   "atla" kipinde satır atlanıyor, bildirim onu AYRICA "KDV Oranı tanınmadı, boş bırakıldı" diye sayıyordu;
//   "güncelle" kipinde ürünün kayıtlı KDV oranı korunuyor (COALESCE) ama bildirim "boş bırakıldı" diyordu.
// Artık tanınmayan KDV yalnız AKTARILAN satırda sayılır; güncellenen üründe kayıtlı oran varsa "korundu", yoksa "boş bırakıldı".
// Nasıl bozulur: aynı dosya iki kez (atla / güncelle), KDV'si sonradan elle verilmiş ürün, KDV'si hiç olmayan ürün, yeni ürün.
import assert from "node:assert/strict";
import { after, before, describe, test } from "node:test";
import { ADMIN_PASSWORD, startTestServer } from "./helpers.mjs";

const unwrap = response => ({ ...response, data: response.data && typeof response.data === "object" && "ok" in response.data ? (response.data.ok ? response.data.data : response.data) : response.data });

describe("gg243 dar kontrol: Stok Excel — tanınmayan KDV yalnız aktarılan satırda sayılır, korunan oran 'boş bırakıldı' denmez", () => {
  let server;
  let api;
  const matrix = [["Ürün Adı", "Birim", "KDV"], ["Vida", "Adet", "%20"], ["Somun", "Adet", "yirmi"], ["Pul", "Adet", "on sekiz"]];
  const roles = { 0: "name", 1: "unit", 2: "vat" };
  const vatOf = async name => {
    const list = (await api.get("/api/workspace/stock?limit=50")).data;
    const rows = list.items || list.stock || list.rows || [];
    return rows.find(item => item.name === name);
  };
  before(async () => {
    server = await startTestServer({ now: "2026-06-17T09:00:00", env: { HUKUK_LICENSE_URL: "http://127.0.0.1:9" } });
    const raw = server.client();
    assert.equal((await raw.login("admin", ADMIN_PASSWORD)).status, 200);
    api = { get: async url => unwrap(await raw.get(url)), post: async (url, body) => unwrap(await raw.post(url, body)), put: async (url, body) => unwrap(await raw.put(url, body)) };
    await api.post("/api/workspace/bank/setup/dismiss", {});
    const first = await api.post("/api/workspace/stock/import", { matrix, headerAt: 0, roles, mode: "skip" });
    assert.equal(first.status, 200, JSON.stringify(first.data));
    assert.equal(first.data.created, 3);
    assert.equal(first.data.vatUnknown, 2, "ilk yüklemede iki yeni ürünün KDV'si boş bırakıldı (doğru)");
    // Somun'un KDV'si elle %10 yapılır; Pul'unki boş kalır.
    const somun = await vatOf("Somun");
    const saved = await api.put(`/api/workspace/stock/${somun.id}`, { ...somun, vatRate: 10 });
    assert.equal(saved.status, 200, JSON.stringify(saved.data).slice(0, 300));
    assert.equal((await vatOf("Somun")).vatRate, 10, "ön koşul: Somun %10");
    assert.equal((await vatOf("Pul")).vatRate ?? null, null, "ön koşul: Pul'un KDV'si boş");
  });
  after(async () => {
    await server?.close();
  });

  test("atla kipi: zaten var olan satırlar atlanır; 'KDV Oranı tanınmadı' sayılmaz", async () => {
    const r = await api.post("/api/workspace/stock/import", { matrix, headerAt: 0, roles, mode: "skip" });
    assert.equal(r.status, 200, JSON.stringify(r.data));
    assert.equal(r.data.skippedTotal, 3, "üç ürün de zaten var");
    assert.equal(r.data.vatUnknown, 0, `atlanan satır KDV sayımına girmez (${r.data.message})`);
    assert.equal(r.data.vatKept, 0);
    assert.doesNotMatch(r.data.message, /KDV Oranı tanınmadı/);
    assert.equal(r.data.message, "0 ürün açıldı. 3 satır atlandı (Bu ürün zaten var).");
  });

  test("güncelle kipi: kayıtlı KDV'si olan üründe 'korundu', olmayanda 'boş bırakıldı'; oranlar değişmez", async () => {
    const r = await api.post("/api/workspace/stock/import", { matrix, headerAt: 0, roles, mode: "update" });
    assert.equal(r.status, 200, JSON.stringify(r.data));
    assert.equal(r.data.updated, 3);
    assert.equal(r.data.vatKept, 1, `Somun: kayıtlı %10 korundu (${r.data.message})`);
    assert.equal(r.data.vatUnknown, 1, "Pul: kayıtlı oran yok, boş kaldı");
    assert.equal(r.data.message, "0 ürün açıldı, 3 ürün güncellendi. 1 satırda KDV Oranı tanınmadı, boş bırakıldı (faturada seçilir; %0, %1, %10, %20 olabilir). 1 satırda KDV Oranı tanınmadı; ürünün kayıtlı KDV Oranı korundu.");
    assert.equal((await vatOf("Somun")).vatRate, 10, "Somun'un oranı değişmedi");
    assert.equal((await vatOf("Pul")).vatRate ?? null, null);
    assert.equal((await vatOf("Vida")).vatRate, 20);
    const reasons = r.data.notes.map(note => note.reason);
    assert.ok(reasons.includes("KDV oranı “yirmi” tanınmadı (%0, %1, %10, %20); kayıtlı oran korundu"), JSON.stringify(reasons));
    assert.ok(reasons.includes("KDV oranı “on sekiz” tanınmadı (%0, %1, %10, %20); boş bırakıldı"), JSON.stringify(reasons));
  });
});
