// 2.4.8 İş R2 (dar kontrol 12 DÜŞÜK, R1 ile aynı kök): işçinin bakım turu şirketlerin ANLIK listesini alır; bir şirketin bakımı beklerken öbür şirket silinir / geri
// yüklenir (kuyruk listeden çıkar, veri tabanı kapanır) ya da sınaması fırlatırsa BÜTÜN tur düşüyordu (öbür şirketin bekleyen işi o turda gitmiyordu). Şimdi yalnız o şirket
// atlanır. Düzenek: ortak işçi (lib/whatsapp/scheduler.mjs, elle sürülür) + sahte kuyruklar (aynı el — kâhin DEĞİL, ders 5); yarış kapıyla ZORLA kurulur (ders 20).
// Dosya TZ=UTC ve TZ=Europe/Istanbul ile koşulur.
import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { createWaScheduler } from "../server/lib/whatsapp/scheduler.mjs";

const closedError = () => Object.assign(new Error("database is not open"), { code: "ERR_INVALID_STATE" });
function fakeQueue(name, { canWrite = () => true, maintain = async () => ({}) } = {}) {
  const calls = { maintain: 0, step: 0 };
  return {
    calls,
    canWrite,
    markLocked() {},
    async maintain() {
      calls.maintain += 1;
      return maintain();
    },
    async step() {
      calls.step += 1;
      return calls.step === 1 ? { did: true } : { did: false, waitMs: null };
    },
    name,
  };
}
const quiet = { warn() {}, error() {} };

describe("2.4.8 İş R2 — kapanan / sınaması fırlatan şirket işçi turunu düşürmez", () => {
  it("bir şirketin sınaması fırlatır (kapalı veri tabanı) → tur reddedilmez, öbür şirketin bakımı ve işi yürür", async () => {
    const sch = createWaScheduler({ manual: true, maintainMs: 0, gapMs: 0, log: quiet });
    const broken = fakeQueue("002", { canWrite: () => { throw closedError(); } });
    const ok = fakeQueue("001");
    sch.register("002", broken);
    sch.register("001", ok);
    let result;
    await assert.doesNotReject(async () => (result = await sch.runOnce()), "tur reddedilmez");
    assert.equal(result?.did, true, "öbür şirketin işi yürüdü");
    assert.deepEqual([ok.calls.maintain, ok.calls.step], [1, 1], "001'in bakımı ve işi");
    assert.equal(broken.calls.step, 0, "002 atlandı");
  });

  it("001'in bakımı beklerken 002 kuyruktan çıkar (silinir) → 002 o turda hiç sınanmaz, 001'in işi aynı turda yürür", async () => {
    const sch = createWaScheduler({ manual: true, maintainMs: 0, gapMs: 0, log: quiet });
    let open;
    const gate = new Promise(resolve => (open = resolve));
    let probed002 = 0;
    const q1 = fakeQueue("001", { maintain: () => gate });
    const q2 = fakeQueue("002", {
      canWrite: () => {
        probed002 += 1;
        if (probed002 > 1) throw closedError(); // ilk sınama (kayıt anı) açık; silindikten sonra veri tabanı kapalı
        return true;
      },
    });
    sch.register("001", q1);
    sch.register("002", q2);
    probed002 = 1; // ön koşul: 002 açıkken bir kez sınandı sayılır; bundan sonraki sınama kapalı veri tabanında
    const turn = sch.runOnce();
    await new Promise(resolve => setImmediate(resolve));
    sch.unregister("002");
    open();
    let result;
    await assert.doesNotReject(async () => (result = await turn), "tur reddedilmez");
    assert.equal(result?.did, true, "001'in işi aynı turda yürüdü");
    assert.equal(q1.calls.step, 1, "001 işi");
    assert.equal(q2.calls.maintain + q2.calls.step, 0, "çıkmış 002'ye dokunulmadı");
  });
});
