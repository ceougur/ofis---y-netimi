// 2.4.7 bağımsız gözden geçirme (B1, B4) kalıcı testlerinin ortak kurulumu: GERÇEK program (createApp, sahte saat) + yerel kapıcı (bulut/kapi/kapi.mjs createKapi,
// sahte R2 — test/kapi-yerel.mjs) + sahte lisans servisi (işlev; ders 30: gerçek lisans servisine ve Cloudflare'e istek YOK). Kurulum gözden geçirmenin yeniden
// üretme betiğinin (not defteri gg247-ana-tekrar/ortak.mjs) aynısı; yalnız yollar depoya göre. Eski kodda da (e73e9860) çalışır: kırmızı kanıt bu kurulumla.
import assert from "node:assert/strict";
import { createClock } from "../server/lib/clock.mjs";
import { ADMIN_PASSWORD, loginAdmin, startTestServer } from "./helpers.mjs";
import { lisansAnahtari } from "./kapi-ortak.mjs";
import { startKapi } from "./kapi-yerel.mjs";
import { createPhone } from "./mobil-uzak-ortak.mjs";

export { ADMIN_PASSWORD };
export const MACHINE = "0123456789abcdef0123456789abcdef";

export async function kurulum({ T0 = "2026-11-18T10:00:00+03:00", fixed = true } = {}) {
  const clock = createClock({ time: T0, fixed });
  const lisans = lisansAnahtari();
  const belirtec = () => lisans.belirtec({ at: clock.ms(), machine: MACHINE, licenseId: "LIS-GG-TEST" });
  const kapi = await startKapi({
    now: () => clock.ms(),
    trustedKeys: lisans.trusted,
    lisansFetch: async () => ({ json: async () => ({ ok: true, token: belirtec() }) }),
  });
  const server = await startTestServer({
    now: clock,
    remoteNow: clock,
    mobileKapiUrl: kapi.base,
    license: {
      enforce: true,
      trustedKeys: lisans.trusted,
      services: ["https://lisans.gg.test/api/lisans"],
      fetchImpl: async () => ({ status: 200, json: async () => ({ ok: true, token: belirtec() }) }),
      machineId: MACHINE,
      now: () => clock.ms(),
      firstCheckDelayMs: 3_600_000,
      autoTrial: false,
    },
  });
  await server.app.license.activateKey("DO-ABCDE-FGHJK-MNPQR-STVWX");
  const sync = server.app.mobileSync;
  const ofis = await sync.ofis();
  const ilkKayit = await sync.kayitGonder();
  const remote = await server.app.listenRemote(0, "127.0.0.1");
  kapi.tunel(ofis.id, `http://127.0.0.1:${remote.port}`);
  const admin = await loginAdmin(server);
  const ids = async () => Object.fromEntries((await admin.get("/api/admin/users")).data.data.map(u => [u.username, u.id]));
  const ctx = {
    clock,
    kapi,
    server,
    sync,
    ofis,
    ilkKayit,
    admin,
    lisans,
    belirtec,
    ids,
    remoteBase: `http://127.0.0.1:${remote.port}`,
    phone: options => createPhone(kapi.base, { host: kapi.ofisHost(ofis.id), ...options }),
    async code(username) {
      const id = (await ids())[username];
      assert.equal((await admin.put(`/api/admin/mobile/access/${id}`, { remote: true })).status, 200);
      await sync.idle();
      const code = await admin.post("/api/admin/mobile/codes", { userId: id });
      assert.equal(code.status, 200, JSON.stringify(code.data));
      return code.data.data.code;
    },
    async paired(username, password, phone = ctx.phone()) {
      const pair = await phone.pair(await ctx.code(username));
      assert.equal(pair.status, 200, `kapıcı üzerinden eşleme: ${pair.text}`);
      await sync.idle();
      const login = await phone.login(username, password);
      assert.equal(login.status, 200, `kapıcı üzerinden uzak giriş: ${login.text}`);
      return phone;
    },
    close: async () => {
      await server.close().catch(() => {});
      await kapi.close();
    },
  };
  return ctx;
}

/** Çerez kavanozunun Cookie başlığı (kavanozu değiştirmeden aynı çerezlerle ham istek atmak için). */
export const kavanozBasligi = phone => [...phone.jar].map(([k, v]) => `${k}=${v}`).join("; ");
/** Yanıttaki Set-Cookie satırları. */
export const setCookies = response => [].concat(response.headers["set-cookie"] || []);
/** Yanıt verilen adlı çerezi siliyor mu (değer boş + Max-Age=0). */
export const siliyor = (response, ad) => setCookies(response).some(line => line.startsWith(`${ad}=;`) && /max-age=0/i.test(line));
