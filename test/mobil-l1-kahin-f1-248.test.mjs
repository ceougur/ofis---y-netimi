// 2.4.8 L1 kâhin farkı F1 (L05): engellenen lisansın kapıcı kaydı engelden 30 gün + temizlikten sonra da SİLİNMİYORDU; engel kalkınca eski cihaz eşlemesiz
// çalışıyordu. KÖK NEDEN: kapıcı engelin başlangıcını (meta.engel) yalnız programın kaydı ya da temizlik turu geldiğinde yazar; program lisans durumu değişince
// kapıcıya bildirmiyordu (yalnız 30 sn'lik zamanlayıcı turu; tur yokken ya da program kapandıysa kapıcı engeli ilk temizlik turunda görüp 30 günü oradan
// sayıyordu). KARAR L1: "ENGELLENEN lisans → mobil hemen kapanır, kayıt 30 günde silinir". Düzeltme: lisans durumu değişince program kapıcıya HEMEN güvenlik
// yüklemesi yapar (lib/mobile-sync.mjs lisansDegisti; app.mjs "license.changed"). GERÇEK program (createApp, sahte saat, zamanlayıcı KAPALI — kâhin sürücüsü
// gibi) + yerel kapıcı (sahte R2) + sahte lisans servisi (işlev; ders 30). Eski kodda (fd33d747) "kapıcı engeli görmedi" ile kırmızı (ders 7, 38).
import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { createClock } from "../server/lib/clock.mjs";
import { loginAdmin, startTestServer } from "./helpers.mjs";
import { lisansAnahtari } from "./kapi-ortak.mjs";
import { startKapi } from "./kapi-yerel.mjs";
import { createPhone } from "./mobil-uzak-ortak.mjs";

const GUN = 86_400_000;
const SAAT = 3_600_000;
const MACHINE = "0123456789abcdef0123456789abcdef";
const T0 = Date.parse("2026-11-02T10:00:00+03:00");

async function kur() {
  const clock = createClock({ time: new Date(T0).toISOString(), fixed: true });
  const lisans = lisansAnahtari();
  const durum = { kind: "license", status: "active", expiresAt: null, licenseId: "LIS-F1-TEST" };
  const belirtec = () => lisans.belirtec({ at: clock.ms(), machine: MACHINE, ...durum });
  const kapi = await startKapi({ now: () => clock.ms(), trustedKeys: lisans.trusted, lisansFetch: async () => ({ json: async () => ({ ok: true, token: belirtec() }) }) });
  const server = await startTestServer({
    now: clock,
    remoteNow: clock,
    mobileKapiUrl: kapi.base,
    license: { enforce: true, trustedKeys: lisans.trusted, services: ["https://lisans.f1.test/api/lisans"], fetchImpl: async () => ({ status: 200, json: async () => ({ ok: true, token: belirtec() }) }), machineId: MACHINE, now: () => clock.ms(), firstCheckDelayMs: 3_600_000, autoTrial: false },
  });
  const close = async () => {
    await server.close().catch(() => {});
    await kapi.close();
  };
  try {
    await server.app.license.activateKey("DO-ABCDE-FGHJK-MNPQR-STVWX");
    const sync = server.app.mobileSync;
    const ofis = await sync.ofis();
    assert.equal((await sync.kayitGonder()).ok, true, "ön koşul: kapıcı kaydı");
    const remote = await server.app.listenRemote(0, "127.0.0.1");
    kapi.tunel(ofis.id, `http://127.0.0.1:${remote.port}`);
    const admin = await loginAdmin(server);
    const id = Object.fromEntries((await admin.get("/api/admin/users")).data.data.map(u => [u.username, u.id])).admin;
    assert.equal((await admin.put(`/api/admin/mobile/access/${id}`, { remote: true })).status, 200);
    await sync.idle();
    const kod = await admin.post("/api/admin/mobile/codes", { userId: id });
    assert.equal(kod.status, 200, JSON.stringify(kod.data));
    const tel = createPhone(kapi.base, { host: kapi.ofisHost(ofis.id) });
    assert.equal((await tel.pair(kod.data.data.code)).status, 200, "ön koşul: kapıcı üzerinden eşleme");
    await sync.idle();
    return { clock, durum, server, sync, kapi, ofis, tel, close };
  } catch (error) {
    await close();
    throw error;
  }
}

describe("2.4.8 L1 kâhin F1 — engellenen lisans: kapıcı engeli o an öğrenir, kayıt engelden 30 gün sonra silinir", () => {
  it("lisans denetimi engeli getirince program kapıcıya hemen bildirir (meta.engel = engel anı); 29. gün durur, 30. gün temizlikte silinir; engel kalkınca eski cihaz geçmez", async () => {
    const c = await kur();
    try {
      const engelAni = T0 + SAAT;
      c.clock.set(engelAni);
      c.durum.status = "blocked";
      await c.server.app.license.check();
      await c.sync.idle();
      assert.equal(c.kapi.meta(c.ofis.id)?.engel?.ms, engelAni, `kapıcı engeli görmedi: lisans denetimi engeli getirdi ama program kapıcıya bildirmedi (meta.engel ${JSON.stringify(c.kapi.meta(c.ofis.id)?.engel)})`);

      c.clock.set(engelAni + 29 * GUN);
      await c.kapi.kapi.temizlik(c.kapi.env);
      assert.ok(c.kapi.meta(c.ofis.id), "engelden 29 gün sonra kayıt durur");
      c.clock.set(engelAni + 30 * GUN + SAAT);
      const tur = await c.kapi.kapi.temizlik(c.kapi.env);
      assert.deepEqual(tur.silinen, [c.ofis.id], `engelden 30 gün sonra temizlikte silinir: ${JSON.stringify(tur)}`);

      // Engel kalktı: program yeniden kaydolur → kayıt cihazsız açılır ("silindi"), eski telefon geçmez.
      c.clock.set(engelAni + 31 * GUN);
      c.durum.status = "active";
      await c.server.app.license.check();
      await c.sync.idle();
      const r = await c.tel.get("/api/mobil/session");
      assert.equal(r.status, 401, `engel kalkınca eski cihaz eşlemesiz çalışmamalı: ${r.status} ${r.text}`);
    } finally {
      await c.close();
    }
  });
});
