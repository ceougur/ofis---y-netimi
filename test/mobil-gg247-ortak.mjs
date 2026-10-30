// 2.4.7 bağımsız gözden geçirme (B2, B2b, B5) kalıcı testlerinin ortak kurulumu: GERÇEK program + yerel kapıcı (gerçek createKapi) + sahte lisans servisi
// (ders 30: dış servise istek yok). Kapıcı ve lisans servisi "gerçek saat"te (sahte saat gercek), program ofis bilgisayarının saatinde (sahte saat ofisSaati);
// ikisi de sabit sahte saat (ders 13: gerçek tarihe bağlı değil). dateYok: kapıcı yanıtlarındaki HTTP Date başlığı programa ulaşmaz (B2b telafisi devre dışı —
// bugünkü/eski davranış ve "yalnız pay" durumu).
import assert from "node:assert/strict";
import { createClock } from "../server/lib/clock.mjs";
import { ADMIN_PASSWORD, loginAdmin, startTestServer } from "./helpers.mjs";
import { lisansAnahtari } from "./kapi-ortak.mjs";
import { startKapi } from "./kapi-yerel.mjs";
import { createPhone } from "./mobil-uzak-ortak.mjs";

export { ADMIN_PASSWORD };
export const T0 = "2026-11-18T10:00:00+03:00";
const MACHINE = "0123456789abcdef0123456789abcdef";

const dateSiz = async (...args) => {
  const yanit = await globalThis.fetch(...args);
  const basliklar = new Headers(yanit.headers);
  basliklar.delete("date");
  return new Response(await yanit.arrayBuffer(), { status: yanit.status, headers: basliklar });
};

export async function kurulum({ farkMs = 0, dateYok = false, licenseId = "LIS-GG247" } = {}) {
  const gercek = createClock({ time: T0, fixed: true });
  const ofisSaati = createClock({ time: Date.parse(T0) + farkMs, fixed: true });
  const lisans = lisansAnahtari();
  const belirtec = () => lisans.belirtec({ at: gercek.ms(), machine: MACHINE, licenseId });
  const kapi = await startKapi({ now: () => gercek.ms(), trustedKeys: lisans.trusted, lisansFetch: async () => ({ json: async () => ({ ok: true, token: belirtec() }) }) });
  const server = await startTestServer({
    now: ofisSaati,
    remoteNow: ofisSaati,
    mobileKapiUrl: kapi.base,
    ...(dateYok ? { mobileKapiFetch: dateSiz } : {}),
    license: {
      enforce: true,
      trustedKeys: lisans.trusted,
      services: ["https://lisans.gg.test/api/lisans"],
      fetchImpl: async () => ({ status: 200, json: async () => ({ ok: true, token: belirtec() }) }),
      machineId: MACHINE,
      now: () => ofisSaati.ms(),
      firstCheckDelayMs: 3_600_000,
      autoTrial: false,
    },
  });
  await server.app.license.activateKey("DO-ABCDE-FGHJK-MNPQR-STVWX");
  const sync = server.app.mobileSync;
  const ofis = await sync.ofis();
  const remote = await server.app.listenRemote(0, "127.0.0.1");
  kapi.tunel(ofis.id, `http://127.0.0.1:${remote.port}`);
  const admin = await loginAdmin(server);
  const ids = async () => Object.fromEntries((await admin.get("/api/admin/users")).data.data.map(u => [u.username, u.id]));
  const ctx = {
    gercek,
    ofisSaati,
    kapi,
    server,
    sync,
    ofis,
    admin,
    ids,
    sonKayitMs: () => JSON.parse(server.app.store.setting("meta.mobile.office", "{}")).sonKayitMs,
    phone: () => createPhone(kapi.base, { host: kapi.ofisHost(ofis.id) }),
    /** Yeni telefonu kapıcı üzerinden eşler ve uzak girişi dener. Dönüş: { pair, login } (durum kodları + metin; ders 3). */
    async yeniTelefon(username = "admin", password = ADMIN_PASSWORD) {
      const id = (await ids())[username];
      assert.equal((await admin.put(`/api/admin/mobile/access/${id}`, { remote: true })).status, 200);
      await sync.idle();
      const code = await admin.post("/api/admin/mobile/codes", { userId: id });
      assert.equal(code.status, 200, JSON.stringify(code.data));
      const phone = ctx.phone();
      const pair = await phone.pair(code.data.data.code);
      await sync.idle();
      const login = await phone.login(username, password);
      return { phone, pair, login };
    },
    async close() {
      await server.close().catch(() => {});
      await kapi.close();
    },
  };
  return ctx;
}
