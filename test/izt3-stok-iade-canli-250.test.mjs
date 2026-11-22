// 2.5.0 İzleyen tur 3 — İş 2 (görev metni docs/devir/2.5.0-DEVAM/izt3-istem.txt; tasarım docs/erp/C7B-FATURA-TASARIM.md §21.2): faturasız stok iadesinde kartın canlı yenilenmesi.
// KARAR (görev metninden AYNEN): BAŞ MİMAR KARARI 22.11 01:02 (3) — "'stok hareketi düzeltme / silmesinde kart ekranı canlı yenilenmiyor' KULLANICININ GÖRDÜĞÜNÜ değiştirir (açık ekranda bayat kart)";
// görev: "Kart değiştiren öbür yollar nasıl bildiriyorsa öyle bildir" (fatura yolu: değişen her kart için { kind: 'plans', planId }).
// BEKLENENLER: yeni stok iadesi bugün 'plans' yayımlıyor (taban); düzeltme / silme / Silinenler'den geri yükleme kartı değiştirdiğinde (900 → 600 → 300 / 900 / 300) öbür ekrana değişen kartın 'plans'
// olayı (planId'li) gider, geri yüklemede iadenin carisi için 'accounts' da. Tabanda (3b420085) düzeltme ve silme 'plans' yayımlamıyor, geri yükleme ne 'plans' ne 'accounts' (yoklama izt3-kos/olay.mjs).
// Kart değişmeyen (iadesiz, kartsız) stok hareketinde 'plans' olayı YOK (bugünkü gibi — bekçi).
// NASIL BOZARIM: plans yayını kaldırılır → S1–S3 kırmızı; kart değişmeden de yayımlanır → S4 kırmızı.
import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { createUser, loginAdmin, startTestServer } from "./helpers.mjs";

const W = "/api/workspace";
const data = r => (r.data && typeof r.data === "object" && "ok" in r.data ? r.data.data : r.data);
const wait = ms => new Promise(resolve => setTimeout(resolve, ms));

async function world(fn) {
  const server = await startTestServer({ now: { time: "2026-11-10T12:00:00+03:00", fixed: true } });
  const controller = new AbortController();
  try {
    const admin = await loginAdmin(server);
    // Başka personelin ekranı (işlemi yapana "workspace.changed" gitmez — events except).
    const watcher = await createUser(server, admin, { username: "izleyici-izt3", role: "personel" });
    const must = async (label, p) => {
      const r = await p;
      assert.equal(r.status, 200, `${label}: ${r.status} ${JSON.stringify(r.data).slice(0, 300)}`);
      return data(r);
    };
    const A = (await must("cari", admin.post(`${W}/accounts`, { name: "Canlı Cari", type: "customer", registeredOn: "2026-08-01" }))).id;
    const mal = (await must("mal", admin.post(`${W}/stock`, { kind: "goods", code: "IZT3-MAL", name: "İzt3 Malı", unit: "Adet", openingQty: "100", salePrice: "300" }))).id;
    await must("borç", admin.post(`${W}/accounts/${A}/entries`, { kind: "debt", amount: "900", date: "2026-09-01", note: "elle" }));
    const K = (await must("kart", admin.post(`${W}/plans`, { accountId: A, name: "Kart", total: "900", registeredOn: "2026-09-02", mode: "auto", count: 3, firstDue: "2026-10-05", coversBalance: true }))).id;
    const response = await fetch(`${server.base}/api/events`, { headers: { cookie: watcher.cookie, accept: "text/event-stream" }, signal: controller.signal });
    const reader = response.body.getReader();
    let stream = "";
    (async () => {
      try {
        for (;;) {
          const { value, done } = await reader.read();
          if (done) break;
          stream += new TextDecoder().decode(value);
        }
      } catch {
        // akış kapatıldı
      }
    })();
    const deadline = Date.now() + 4000;
    while (!/event: hello/.test(stream) && Date.now() < deadline) await wait(40);
    assert.match(stream, /event: hello/, "olay akışı açıldı");
    await wait(700); // kurulum yazımlarının birleşen olayları geçsin
    // Bir işlemden sonra öbür ekrana giden workspace.changed olayları: "tür" / "tür:K" (bu kartın planId'si) / "tür@A" (bu carinin).
    const after = async call => {
      stream = "";
      const r = await call();
      assert.equal(r.status, 200, `${r.status} ${JSON.stringify(r.data).slice(0, 300)}`);
      await wait(900);
      return [...stream.matchAll(/event: ([\w.]+)\ndata: (.*)\n/g)]
        .map(([, name, json]) => ({ name, ...JSON.parse(json) }))
        .filter(e => e.name === "workspace.changed")
        .map(e => `${e.kind}${e.planId ? `:${e.planId === K ? "K" : "başka"}` : ""}${e.accountId ? `@${e.accountId === A ? "A" : "başka"}` : ""}`);
    };
    const total = () => Number(server.app.store.get("SELECT total FROM plans WHERE id = ?", K).total);
    return await fn({ server, admin, A, mal, K, after, total, must });
  } finally {
    controller.abort();
    await server.close();
  }
}
const newReturn = h => h.after(() => h.admin.post(`${W}/stock/${h.mal}/moves`, { kind: "in", reason: "return", qty: "1", unitPrice: "300", pay: "account", accountId: h.A, date: "2026-11-10" }));
const lastReturn = h => h.server.app.store.get("SELECT id FROM stock_moves WHERE item_id = ? AND reason = 'return' ORDER BY rowid DESC LIMIT 1", h.mal).id;

describe("İzleyen tur 3 — İş 2: faturasız stok iadesi kartı değiştirince öbür ekrana 'plans' olayı (planId'li)", () => {
  it("S0 (taban bekçisi): yeni stok iadesi kartı 900 → 600 küçültür ve 'plans' yayımlar", () =>
    world(async h => {
      const events = await newReturn(h);
      assert.equal(h.total(), 600);
      assert.ok(events.some(e => e.startsWith("plans")), `olaylar: ${events.join(" ")}`);
    }));
  it("S1: iade düzeltmesi 1 → 2 kartı 600 → 300 küçültür → öbür ekrana 'plans:K' (tabanda yok)", () =>
    world(async h => {
      await newReturn(h);
      const events = await h.after(() => h.admin.put(`${W}/stock/${h.mal}/moves/${lastReturn(h)}`, { qty: "2", unitPrice: "300" }));
      assert.equal(h.total(), 300, "kart (veri tabanı)");
      assert.ok(events.includes("plans:K"), `olaylar: ${events.join(" ")}`);
      assert.ok(events.includes("accounts@A"), "cari olayı bugünkü gibi");
    }));
  it("S2: iade silinince kart 600 → 900 geri büyür → öbür ekrana 'plans:K' (tabanda yok)", () =>
    world(async h => {
      await newReturn(h);
      const events = await h.after(() => h.admin.del(`${W}/stock/${h.mal}/moves/${lastReturn(h)}`));
      assert.equal(h.total(), 900, "kart (veri tabanı)");
      assert.ok(events.includes("plans:K"), `olaylar: ${events.join(" ")}`);
    }));
  it("S3: silinen iade Silinenler'den geri yüklenince kart 900 → 600 yeniden küçülür → öbür ekrana 'plans:K' ve 'accounts@A' (tabanda ikisi de yok)", () =>
    world(async h => {
      await newReturn(h);
      const id = lastReturn(h);
      assert.equal((await h.admin.del(`${W}/stock/${h.mal}/moves/${id}`)).status, 200);
      const row = (await h.must("Silinenler", h.admin.get("/api/admin/trash"))).find(x => x.kind === "stock-move" && x.ref === id);
      assert.ok(row, "Silinenler'de");
      const events = await h.after(() => h.admin.post("/api/admin/trash/restore", { id: row.id }));
      assert.equal(h.total(), 600, "kart (veri tabanı)");
      assert.ok(events.includes("plans:K"), `olaylar: ${events.join(" ")}`);
      assert.ok(events.includes("accounts@A"), `olaylar: ${events.join(" ")}`);
    }));
  it("S4 (bekçi): kartı değiştirmeyen stok hareketi (peşin satış) düzeltilip silinince 'plans' olayı YOK (bugünkü gibi)", () =>
    world(async h => {
      const r = await h.must("satış", h.admin.post(`${W}/stock/${h.mal}/moves`, { kind: "out", qty: "1", unitPrice: "300", pay: "cash", date: "2026-11-10" }));
      const id = r.moveId || h.server.app.store.get("SELECT id FROM stock_moves WHERE item_id = ? ORDER BY rowid DESC LIMIT 1", h.mal).id;
      const edited = await h.after(() => h.admin.put(`${W}/stock/${h.mal}/moves/${id}`, { qty: "2", unitPrice: "300" }));
      const removed = await h.after(() => h.admin.del(`${W}/stock/${h.mal}/moves/${id}`));
      assert.equal(h.total(), 900, "kart değişmedi");
      assert.ok(!edited.some(e => e.startsWith("plans")) && !removed.some(e => e.startsWith("plans")), `olaylar: ${edited.join(" ")} | ${removed.join(" ")}`);
    }));
});
