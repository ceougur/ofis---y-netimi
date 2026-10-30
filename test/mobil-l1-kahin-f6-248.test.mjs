// 2.4.8 L1 kâhin farkı F6 (L03, L05, L06, U10, U21, L04): telefonun özetindeki lisans uyarısı YÜKLEME anında donuyordu — hoşgörüde ya da yenilemeden sonra özet
// hâlâ "Lisansınız 3 gün sonra bitiyor." / "Deneme süreniz 1 gün sonra bitiyor." taşıyordu. KÖK NEDEN: program özetin oturum bölümüne /api/mobil/session yanıtını
// olduğu gibi koyuyordu (mobilHak.ileti yükleme anının metni); kapıcı okuma anında doğru uyarıyı başlıkta (x-do-mobil-ileti) veriyordu ama özetin içindeki eski
// metin de telefona gidiyordu. Düzeltme: iletinin metni özete konmaz (yalnız yedek durum); uyarı okuma anında kapıcının en yeni lisansıyla.
// GERÇEK program (sahte saat, zamanlayıcı yok) + yerel kapıcı + sahte lisans servisi (ders 30). Eski kodda (fd33d747) "özetin içinde donmuş uyarı" ile kırmızı.
import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { createClock } from "../server/lib/clock.mjs";
import { loginAdmin, startTestServer } from "./helpers.mjs";
import { lisansAnahtari } from "./kapi-ortak.mjs";
import { startKapi } from "./kapi-yerel.mjs";
import { createPhone } from "./mobil-uzak-ortak.mjs";

const GUN = 86_400_000;
const MACHINE = "0123456789abcdef0123456789abcdef";
const BITIS = Date.parse("2026-12-01T00:00:00+03:00");
const UYARI = /gün sonra bitiyor|sona erecek|sona erdi/;

/** Nesnenin içindeki (iç içe) bütün metinler. */
const metinler = (x, out = []) => {
  if (typeof x === "string") out.push(x);
  else if (x && typeof x === "object") for (const v of Object.values(x)) metinler(v, out);
  return out;
};

describe("2.4.8 L1 kâhin F6 — özetteki lisans uyarısı yükleme anında donmaz; telefon okuma anının uyarısını alır", () => {
  it("bitişe 3 gün kala yüklenen özet hoşgörüde okununca: başlıkta 'Lisansınız bitti; … sona erecek.', özetin içinde eski 'gün sonra bitiyor' metni yok", async () => {
    const clock = createClock({ time: new Date(BITIS - 10 * GUN).toISOString(), fixed: true });
    const lisans = lisansAnahtari();
    const durum = { kind: "license", status: "active", expiresAt: new Date(BITIS).toISOString(), licenseId: "LIS-F6-TEST" };
    const belirtec = () => lisans.belirtec({ at: clock.ms(), machine: MACHINE, ...durum });
    const kapi = await startKapi({ now: () => clock.ms(), trustedKeys: lisans.trusted, lisansFetch: async () => ({ json: async () => ({ ok: true, token: belirtec() }) }) });
    const server = await startTestServer({
      now: clock,
      remoteNow: clock,
      mobileKapiUrl: kapi.base,
      license: { enforce: true, trustedKeys: lisans.trusted, services: ["https://lisans.f6.test/api/lisans"], fetchImpl: async () => ({ status: 200, json: async () => ({ ok: true, token: belirtec() }) }), machineId: MACHINE, now: () => clock.ms(), firstCheckDelayMs: 3_600_000, autoTrial: false },
    });
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
      const tel = createPhone(kapi.base, { host: kapi.ofisHost(ofis.id) });
      assert.equal((await tel.pair(kod.data.data.code)).status, 200, "ön koşul: eşleme");
      await sync.idle();

      clock.set(BITIS - 3 * GUN);
      await server.app.license.check();
      await sync.idle();
      const yukle = await sync.uploadNow("elle");
      assert.equal(yukle.ok, true, `ön koşul: özet yüklendi (bitişe 3 gün kala): ${JSON.stringify(yukle)}`);

      clock.set(BITIS + 2 * GUN);
      const r = await tel.readSummary({ now: clock.ms(), headers: { host: kapi.ofisHost(ofis.id) } });
      assert.equal(r.status, 200, `hoşgörüde son özet açık: ${r.status} ${r.text?.slice?.(0, 200)}`);
      const donmus = metinler(r.veri).filter(m => UYARI.test(m));
      assert.deepEqual(donmus, [], `özetin içinde yükleme anında donmuş lisans uyarısı var (telefona eski metin gider): ${JSON.stringify(donmus)}`);
      const baslik = decodeURIComponent(r.headers?.["x-do-mobil-ileti"] || "");
      assert.equal(baslik, "Lisansınız bitti; mobil kullanım hakkınız 28 gün sonra sona erecek.", "okuma anının uyarısı kapıcıdan (başlık)");
    } finally {
      await server.close().catch(() => {});
      await kapi.close();
    }
  });
});
