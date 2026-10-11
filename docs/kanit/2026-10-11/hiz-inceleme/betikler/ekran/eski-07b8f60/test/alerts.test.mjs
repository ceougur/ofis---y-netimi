// Olay tabanlı uyarı akışı (v2.0.2): gün dönümünde tüm ekranlara yenileme olayı.
import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { createAlertScheduler } from "../server/lib/alerts.mjs";

describe("uyarı zamanlayıcısı", () => {
  it("bir sonraki yerel gece yarısını hesaplar ve olayı gün bilgisiyle yayımlar", () => {
    const published = [];
    const timers = [];
    let now = new Date(2026, 8, 27, 23, 59, 30);
    const scheduler = createAlertScheduler({
      events: { publish: (type, data) => published.push([type, data]) },
      clock: () => now,
      setTimer: (fn, delay) => {
        timers.push({ fn, delay });
        return { unref() {} };
      },
      clearTimer: () => {},
    });
    assert.equal(scheduler.msUntilNextDay(new Date(2026, 8, 27, 23, 59, 30)), 32_000, "00:00:02'ye 32 sn");
    assert.equal(scheduler.msUntilNextDay(new Date(2026, 8, 27, 0, 0, 1)), 24 * 3_600_000 + 1_000);
    scheduler.start();
    assert.equal(timers.length, 1);
    assert.equal(timers[0].delay, 32_000);
    assert.equal(scheduler.stats().active, true);
    now = new Date(2026, 8, 28, 0, 0, 2);
    timers[0].fn();
    assert.deepEqual(published[0][0], "alerts.refresh");
    assert.deepEqual({ reason: published[0][1].reason, today: published[0][1].today }, { reason: "day", today: "2026-09-28" });
    assert.equal(timers.length, 2, "ertesi gün için yeniden kurulur");
    assert.ok(timers[1].delay > 23 * 3_600_000 && timers[1].delay <= 24 * 3_600_000 + 2_000);
    scheduler.stop();
    assert.equal(scheduler.stats().active, false);
    scheduler.fire("data");
    assert.equal(published[1][1].reason, "data");
  });

  it("yayımcı hata verirse zamanlayıcı düşmez; saat geri alınırsa en az bir dakika bekler", () => {
    const warnings = [];
    const scheduler = createAlertScheduler({ events: { publish: () => { throw new Error("kopuk"); } }, log: { warn: message => warnings.push(message) }, setTimer: () => ({ unref() {} }), clearTimer: () => {} });
    scheduler.fire("day");
    assert.equal(warnings.length, 1);
    assert.ok(scheduler.msUntilNextDay(new Date(2026, 8, 28, 0, 0, 1, 900)) >= 5_000);
  });
});
