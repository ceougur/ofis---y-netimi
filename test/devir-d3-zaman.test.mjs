// 2.5.1 D3 — ön izleme ve zaman (ders 13, 22; DEVIR-PLANI §8 madde 9; tasarım §3.12 "iki TZ, sahte saat 31.12 23:59 / 01.01 00:00, Şubat'ta devir, 29 Şubat'lı yıl").
// Programın "bugün"ü sürecin yerel günüdür (lib/period.mjs today: getFullYear / getMonth / getDate) — beklenen, saatin O SÜREÇTEKİ yerel gününden hesaplanır (iki TZ'de koşulur:
// TZ=UTC ve TZ=Europe/Istanbul; 01.01 00:00 (+03:00) UTC'de hâlâ 31.12'dir → K = 31.12.2026 henüz geçmiş yıl değildir).
import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { boot, must } from "./banka-210-ortak.mjs";

const planModule = await import("../server/lib/devir/plan.mjs").catch(() => null);
const pad = value => String(value).padStart(2, "0");
const localDay = time => {
  const d = new Date(time);
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
};
async function preview(api, body) {
  const started = await api.post("/api/admin/devir/preview", body);
  if (started.status !== 200) return started;
  for (let i = 0; i < 600; i += 1) {
    const job = await api.get(`/api/admin/devir/preview/${started.data.id}`);
    if (job.data.state !== "running") return job;
    await new Promise(resolve => setTimeout(resolve, 50));
  }
  throw new Error("ön izleme bitmedi");
}

describe("D3 ön izleme ve zaman (sahte saat, iki saat dilimi)", () => {
  for (const time of ["2026-12-31T23:59:00+03:00", "2027-01-01T00:00:00+03:00", "2027-01-01T03:00:00+03:00"]) {
    it(`saat ${time}: K = 31.12.2026 yalnız yerel gün 2027 olunca kabul; K günündeki kayıt arşive, sonraki yeni yıla`, async () => {
      assert.ok(planModule, "D3 devir planı modülü yok (eski kod)");
      const today = localDay(time);
      const ctx = await boot({ now: { time, fixed: true } });
      try {
        await must("31.12 kasa", ctx.api.post("/api/workspace/cash", { kind: "in", amount: "100", description: "Yıl sonu", date: "2026-12-31" }));
        if (today >= "2027-01-01") await must("01.01 kasa", ctx.api.post("/api/workspace/cash", { kind: "in", amount: "7", description: "Yeni yıl", date: "2027-01-01" }));
        const job = await preview(ctx.api, { company: "sirket-001", cutoff: "2026-12-31" });
        if (today < "2027-01-01") {
          assert.equal(job.status, 400, `${today}: ${JSON.stringify(job.data)}`);
          assert.equal(job.code, "DEVIR_K_GELECEK");
          return;
        }
        assert.equal(job.data.state, "done", JSON.stringify(job.data.error));
        const plan = job.data.result.plan;
        assert.equal(plan.newYear.kasa.minor, 10000, "01.01 kaydı arşive girmez");
        const cash = plan.newYear.budama.find(row => row.table === "cash_entries");
        assert.deepEqual([cash.kOncesi, cash.kSonrasi], [1, 1]);
        assert.ok(job.data.result.onDenetim.uyarir.some(row => row.kod === "erken-devir"), "60 günden yakın: Aralık belgeleri uyarısı");
      } finally {
        ctx.server.close();
      }
    });
  }

  it("Şubat'ta devir (15.02.2027): ocak ve şubat kayıtları yeni yılda; Aralık uyarısı gün sayısıyla", async () => {
    assert.ok(planModule, "D3 devir planı modülü yok (eski kod)");
    const ctx = await boot({ now: { time: "2027-02-15T12:00:00+03:00", fixed: true } });
    try {
      for (const [date, amount] of [["2026-12-31", "100"], ["2027-01-31", "20"], ["2027-02-15", "3"]]) await must(date, ctx.api.post("/api/workspace/cash", { kind: "in", amount, description: date, date }));
      const job = await preview(ctx.api, { company: "sirket-001", cutoff: "2026-12-31" });
      assert.equal(job.data.state, "done", JSON.stringify(job.data.error));
      const plan = job.data.result.plan;
      assert.equal(plan.newYear.kasa.minor, 10000);
      const cash = plan.newYear.budama.find(row => row.table === "cash_entries");
      assert.deepEqual([cash.kOncesi, cash.kSonrasi, cash.toplam], [1, 2, 3], "arşiv ≤K + yeni yıl >K = devir öncesi");
      const gap = Math.round((Date.parse(`${localDay("2027-02-15T12:00:00+03:00")}T00:00:00Z`) - Date.parse("2026-12-31T00:00:00Z")) / 86_400_000);
      assert.match(job.data.result.onDenetim.uyarir.find(row => row.kod === "erken-devir").metin, new RegExp(`üzerinden ${gap} gün geçti`));
    } finally {
      ctx.server.close();
    }
  });

  it("29 Şubat'lı yıl (bugün 29.02.2028): K = 31.12.2027; 29.02 kaydı yeni yılda; iki yıl geride K = 31.12.2026 da hesaplanır", async () => {
    assert.ok(planModule, "D3 devir planı modülü yok (eski kod)");
    const ctx = await boot({ now: { time: "2028-02-29T12:00:00+03:00", fixed: true } });
    try {
      for (const [date, amount] of [["2026-06-30", "50"], ["2027-12-31", "100"], ["2028-02-29", "9"]]) await must(date, ctx.api.post("/api/workspace/cash", { kind: "in", amount, description: date, date }));
      const job = await preview(ctx.api, { company: "sirket-001", cutoff: "2027-12-31" });
      assert.equal(job.data.state, "done", JSON.stringify(job.data.error));
      const plan = job.data.result.plan;
      assert.equal(plan.meta.acilisGunu, "2028-01-01");
      assert.equal(plan.newYear.kasa.minor, 15000);
      // 2026 kapanmamış önceki yıl: Önceki Yıl Sonucu Fişi (2026) + 2027 kapanışı (649.90 kasa gelirleri).
      assert.deepEqual(plan.archive.kapanisFisleri.map(row => row.kod), ["onceki-yil-2026", "N-04", "N-06", "N-07"]);
      assert.deepEqual(plan.archive.oncekiYillar.map(row => [row.yil, row.tutarMinor]), [[2026, 5000]]);
      assert.equal(plan.archive.donemSonucuMinor, 10000);
      assert.deepEqual(plan.degismezler.filter(row => !row.ok), []);
      const old = await preview(ctx.api, { company: "sirket-001", cutoff: "2026-12-31" });
      assert.equal(old.data.state, "done", JSON.stringify(old.data.error));
      assert.equal(old.data.result.plan.newYear.kasa.minor, 5000);
      assert.deepEqual(old.data.result.plan.newYear.budama.find(row => row.table === "cash_entries").kSonrasi, 2);
    } finally {
      ctx.server.close();
    }
  });
});
