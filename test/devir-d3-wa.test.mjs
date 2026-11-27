// 2.5.1 D3 TUR 3 — S-C5C-9 = A (KULLANICI 27.11.2026 12:01 UTC, AYNEN: "ÖNERİLERİNİ UYGULA"; docs/devir/C5C-ILKE-TASLAK.md §8.1: devir başlarken o şirketin süren ve
// duraklatılmış toplu (WhatsApp) işleri "Durduruldu (Devir)" olur — bunu devri UYGULAYAN paket yapar) + BAŞ MİMAR EKİ: devrin ön denetiminde UYARI (DURDURMAZ) "N kişilik gönderim
// durdurulacak" — kaç iş, kaç kişi; sayılar o şirketin gönderim kuyruğundan OKUNARAK (kuyruk DEĞİŞMEZ). Veri programın API'siyle (yerel sahte Meta Graph — gerçek Meta yok, ders 30).
// Beklenen (elle): 001'de iş 1 süren (A, B — 2 kişi bekliyor), iş 2 duraklatılmış (C — 1 kişi) → "2 toplu WhatsApp gönderimi bitmedi (1 süren ve 1 duraklatılmış); 3 kişiye ileti henüz
// gitmedi"; 002'de iş 1 süren (D) — 001'in uyarısına girmez, 002'nin uyarısı 1 iş / 1 kişi. İşler bitince / iptal edilince uyarı yok. Uyarı durdurur listesini değiştirmez.
import assert from "node:assert/strict";
import { after, before, describe, it } from "node:test";
import { PNID, TOKEN, URLS, WABA, startWa } from "./whatsapp-248-ortak.mjs";
import { katalogaYaz } from "./fixtures/devir-d3-ileti-katalog.mjs";

const iletiModule = await import("../server/lib/devir/iletiler.mjs").catch(() => null);
const K = "2026-12-31";

async function waitPreview(api, body) {
  const started = await api.post("/api/admin/devir/preview", body);
  assert.equal(started.status, 200, JSON.stringify(started.data));
  for (let i = 0; i < 600; i += 1) {
    const job = (await api.get(`/api/admin/devir/preview/${started.data.data.id}`)).data.data;
    if (job.state !== "running") return job;
    await new Promise(resolve => setTimeout(resolve, 50));
  }
  throw new Error("ön izleme bitmedi");
}
const waOf = job => job.result.onDenetim.uyarir.filter(row => row.kod === "whatsapp-gonderim");

describe("D3 tur 3 — S-C5C-9 eki: devirde durdurulacak WhatsApp gönderimi UYARIR (durdurmaz); sayılar şirketin kuyruğundan", () => {
  let ctx;
  let second;
  const batches = {};
  const q = () => `?hofCompany=${encodeURIComponent(second.id)}`;
  before(async () => {
    ctx = await startWa({ now: { time: "2027-01-20T09:00:00+03:00", fixed: true } });
    const a = await ctx.account("Ahmet Yılmaz", "0533 111 22 33", 800);
    const b = await ctx.account("Banu Kaya", "0533 222 33 44", 600);
    const c = await ctx.account("Cem Ak", "0533 333 44 55", 400);
    const first = await ctx.batch({ kind: "statement", ids: [a.id, b.id], preset: "thisMonth", sendAgain: true });
    assert.equal(first.status, 200, JSON.stringify(first.data));
    batches.running = first.data.data.batch.id;
    const other = await ctx.batch({ kind: "statement", ids: [c.id], preset: "thisMonth", sendAgain: true });
    assert.equal(other.status, 200, JSON.stringify(other.data));
    batches.paused = other.data.data.batch.id;
    const paused = await ctx.api.post(`${URLS.batches}/${batches.paused}/pause`, {});
    assert.equal(paused.status, 200, JSON.stringify(paused.data));
    // 002: kendi WhatsApp bağlantısı ve süren işi.
    const made = await ctx.api.post("/api/companies", { name: "İkinci Şirket", select: false });
    assert.equal(made.status, 200, JSON.stringify(made.data));
    second = made.data.data.company || made.data.data;
    for (const [url, body] of [[URLS.conn, { phoneNumberId: PNID, wabaId: WABA, token: TOKEN }], [URLS.ack, { ack: true }]]) {
      const res = await ctx.api.put(`${url}${q()}`, body);
      assert.equal(res.status, 200, `${url}: ${JSON.stringify(res.data)}`);
    }
    const d = await ctx.api.post(`/api/workspace/accounts${q()}`, { name: "Deniz Er", phone: "0533 444 55 66", openingBalance: "300" });
    assert.equal(d.status, 200, JSON.stringify(d.data));
    const third = await ctx.api.post(`${URLS.batches}${q()}`, { kind: "statement", ids: [d.data.data.id], preset: "thisMonth", sendAgain: true });
    assert.equal(third.status, 200, JSON.stringify(third.data));
  });
  after(async () => ctx?.close());

  it("veri tabanı (ders 3): 001'de iş 1 Sürüyor (2 iş bekliyor), iş 2 Duraklatıldı (1 iş)", () => {
    const state = id => ctx.store.get("SELECT state FROM wa_batches WHERE id = ?", id).state;
    assert.deepEqual([state(batches.running), state(batches.paused)], ["running", "paused"]);
    const open = ctx.store.get("SELECT COUNT(*) AS n FROM wa_jobs WHERE state IN ('pending', 'limited', 'preparing', 'paused', 'held')").n;
    assert.equal(open, 3);
  });

  it("001: UYARIR 'WhatsApp Gönderimi Durdurulacak' — 2 iş (1 süren, 1 duraklatılmış), 3 kişi; dört alan; kuyruk değişmedi; 002'nin işi sayılmadı", async () => {
    assert.ok(iletiModule, "D3 tur 3 yok (eski kod)");
    const before = JSON.stringify([ctx.store.all("SELECT id, state, updated_at FROM wa_batches ORDER BY id"), ctx.store.all("SELECT id, state, updated_at FROM wa_jobs ORDER BY id")]);
    const job = await waitPreview(ctx.api, { company: "sirket-001", cutoff: K });
    assert.equal(job.state, "done", JSON.stringify(job.error));
    const warn = waOf(job);
    assert.equal(warn.length, 1, job.result.onDenetim.uyarir.map(row => row.kod).join(", "));
    const row = warn[0];
    assert.equal(row.seviye, "uyarir");
    assert.equal(job.result.onDenetim.durdurur.some(item => item.kod === "whatsapp-gonderim"), false, "uyarı durdurur listesinde değil");
    assert.match(row.neOldu, /^2 toplu WhatsApp gönderimi bitmedi \(1 süren ve 1 duraklatılmış\); 3 kişiye ileti henüz gitmedi\.$/);
    assert.match(row.neden, /Durduruldu \(Devir\) olur ve kendiliğinden sürmez/);
    assert.deepEqual(iletiModule.iletiDenetimi(row), []);
    assert.equal(row.adet, 3);
    katalogaYaz("devir-d3-wa", "S-C5C-9 eki: 001'de 1 süren (2 kişi) + 1 duraklatılmış (1 kişi) toplu gönderim", row);
    assert.equal(JSON.stringify([ctx.store.all("SELECT id, state, updated_at FROM wa_batches ORDER BY id"), ctx.store.all("SELECT id, state, updated_at FROM wa_jobs ORDER BY id")]), before, "ön izleme kuyruğa dokunmaz");
  });

  it("002: yalnız kendi işi (1 iş, 1 kişi) — öbür şirketin işi sayılmaz", async () => {
    assert.ok(iletiModule, "D3 tur 3 yok (eski kod)");
    const job = await waitPreview(ctx.api, { company: second.id, cutoff: K });
    assert.equal(job.state, "done", JSON.stringify(job.error));
    assert.deepEqual(waOf(job).map(row => [row.ayrinti.isSayisi, row.ayrinti.suren, row.ayrinti.duraklatilmis, row.ayrinti.kisiSayisi]), [[1, 1, 0, 1]]);
  });

  it("işler bitince / iptal edilince uyarı YOK; durdurur listesi uyarıyla değişmemişti", async () => {
    assert.ok(iletiModule, "D3 tur 3 yok (eski kod)");
    const withWarning = await waitPreview(ctx.api, { company: "sirket-001", cutoff: K });
    await ctx.drain();
    const cancel = await ctx.api.post(`${URLS.batches}/${batches.paused}/cancel`, {});
    assert.equal(cancel.status, 200, JSON.stringify(cancel.data));
    const states = ctx.store.all("SELECT state FROM wa_batches ORDER BY created_at, rowid").map(row => row.state);
    assert.ok(states.every(state => !["running", "paused"].includes(state)), states.join(", "));
    const job = await waitPreview(ctx.api, { company: "sirket-001", cutoff: K });
    assert.deepEqual(waOf(job), []);
    assert.deepEqual(job.result.onDenetim.durdurur.map(row => row.kod), withWarning.result.onDenetim.durdurur.map(row => row.kod), "uyarı DURDURUR listesini değiştirmez");
    assert.equal(job.result.onDenetim.gecebilir, withWarning.result.onDenetim.gecebilir);
  });
});
