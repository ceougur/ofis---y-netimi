// 2.5.0 Ç7b — YB-1 (birleşik tur 3 dar kontrolünün yan bulgusu; docs/erp/C7B-FATURA-TASARIM.md §2.4, §4 (7)): Kartı Kapat onayı eskimiş "Kalan X" ile verilemez. İstemci onayladığı
// kalanı `closeRemaining` olarak gönderir; sunucu işlemin İÇİNDE kartın GÜNCEL kalanıyla (kart penceresinin gösterdiği totals.remaining) kuruşu kuruşuna karşılaştırır, farklıysa 409
// plan-close-stale + güncel kalan; kart AÇIK kalır (ders 3: veri tabanından okunur). Alan yoksa (eski istemci) bugünkü gibi. Kartı Kapat'ın defter / cari etkisi bu turda DEĞİŞMEZ
// (karar (6) / KG-23 → Ç7b tur 3).
// ÖRNEK (sahte saat 08.10.2026): Yeni Borç kartı 3.000 (3 taksit) · 01.10 tahsilat 1.000 → kalan 2.000. Onay penceresi "Kalan 2.000" iken tahsilat silinir → kalan 3.000:
//   closeRemaining 2.000 → 409 (remaining 3.000), kart active · closeRemaining 3.000 → 200, kart closed. Kalansız kart (3.000 ödendi, onay "kalan 0") tutarı 3.500'e çıkınca → 409.
//   Eski istemci (alan yok) → 200.
// NASIL BOZARIM: denetimi kaldırmak (eski onay kabul — 409 beklenen, 200 gelir); denetimi işlem dışında eski kartla yapmak; kalansız kartı (0) denetim dışı bırakmak; eski istemciyi reddetmek.
import assert from "node:assert/strict";
import { after, before, describe, it } from "node:test";
import { must } from "./banka-210-ortak.mjs";
import { BANK, bootBank } from "./banka-210-hesap-ortak.mjs";

describe("Ç7b YB-1 — eskimiş 'Kalan X' onayıyla Kartı Kapat reddedilir", () => {
  let ctx;
  let api;
  let account;
  const plan = async (name, total) => {
    const created = await must(name, api.post("/api/workspace/plans", { accountId: account, name, total, registeredOn: "2026-09-01", mode: "auto", count: 3, firstDue: "2026-10-01" }));
    return created.id || created.plan?.id;
  };
  const pay = async (id, amount) => {
    await must("tahsilat", api.post(`/api/workspace/plans/${id}/entries`, { kind: "in", amount, date: "2026-10-01", method: "cash" }));
    return ctx.store.get("SELECT id FROM plan_entries WHERE plan_id = ? ORDER BY rowid DESC LIMIT 1", id).id;
  };
  const remaining = async id => Number((await must("kart", api.get(`/api/workspace/plans/${id}`))).totals.remaining);
  const status = id => ctx.store.get("SELECT status FROM plans WHERE id = ?", id).status;
  before(async () => {
    ctx = await bootBank();
    api = ctx.api;
    await must("sihirbazı kapat", api.post(`${BANK}/setup/dismiss`, {}));
    account = (await must("cari", api.post("/api/workspace/accounts", { name: "Kart Müşterisi", type: "customer", registeredOn: "2026-09-01" }))).id;
  });
  after(() => ctx?.server.close());

  it("tahsilat silinince eski onay (Kalan 2.000) 409, güncel kalanla (3.000) kapanır", async () => {
    const id = await plan("Kart A", "3.000");
    const entry = await pay(id, "1.000");
    assert.equal(await remaining(id), 2000);
    await must("tahsilat sil", api.del(`/api/workspace/plans/${id}/entries/${entry}`));
    const stale = await api.put(`/api/workspace/plans/${id}`, { status: "closed", closeRemaining: 2000 });
    assert.equal(stale.status, 409, JSON.stringify(stale.data));
    assert.equal(stale.data?.code, "plan-close-stale");
    assert.equal(Number(stale.data?.remaining), 3000, "yanıt güncel kalanı söyler");
    assert.match(String(stale.data?.error || ""), /3\.000,00/);
    assert.equal(status(id), "active", "reddedilen istek kartı kapatmadı");
    await must("güncel onayla kapat", api.put(`/api/workspace/plans/${id}`, { status: "closed", closeRemaining: 3000 }));
    assert.equal(status(id), "closed");
  });

  it("kalansız kart: onay 'kalan 0' iken tutar büyüdü → 409; eski istemci (alan yok) bugünkü gibi kapatır", async () => {
    const id = await plan("Kart B", "3.000");
    await pay(id, "3.000");
    assert.equal(await remaining(id), 0);
    await must("tutar 3.500", api.put(`/api/workspace/plans/${id}`, { total: "3.500" }));
    const stale = await api.put(`/api/workspace/plans/${id}`, { status: "closed", closeRemaining: 0 });
    assert.equal(stale.status, 409, JSON.stringify(stale.data));
    assert.equal(stale.data?.code, "plan-close-stale");
    assert.equal(Number(stale.data?.remaining), 500);
    assert.equal(status(id), "active");
    const old = await plan("Kart C", "1.000");
    await must("eski istemci", api.put(`/api/workspace/plans/${old}`, { status: "closed" }));
    assert.equal(status(old), "closed");
  });
});
