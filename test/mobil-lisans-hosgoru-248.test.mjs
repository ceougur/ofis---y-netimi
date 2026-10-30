// 2.4.8 L1 — lisans kapısı GERÇEK programla (createApp, sahte saat) + yerel kapıcı (bulut/kapi/kapi.mjs, sahte R2) + sahte lisans servisi (işlev; ders 30: gerçek
// lisans servisine ve Cloudflare'e istek YOK). Ürün sahibi kararı "KARAR L1" (30.10.2026): ücretli lisans bitince masaüstü salt okunur, MOBİL 30 GÜN salt okunur
// sürer (program + kapıcı + tünel aynı kural), uyarılar telefonda ve Yönetim → Mobil Cihazlar'da; deneme bitişte mobil hemen kapanır; kapıcı kaydı silinince
// telefon karekodla yeniden eşlenir (program eşlemeleri kaldırır, ekranda açık ileti). Eski kodda (8ef48138) hoşgörü ve uyarılar yok → beklenen nedenle kırmızı.
import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { createClock } from "../server/lib/clock.mjs";
import * as lisansModulu from "../server/lib/license.mjs";
import { ADMIN_PASSWORD, loginAdmin, startTestServer } from "./helpers.mjs";
import { lisansAnahtari } from "./kapi-ortak.mjs";
import { startKapi } from "./kapi-yerel.mjs";
import { createPhone } from "./mobil-uzak-ortak.mjs";

const GUN = 86_400_000;
const MACHINE = "0123456789abcdef0123456789abcdef";
const BITIS = Date.parse("2026-12-01T00:00:00+03:00");

async function kur({ kind = "license" } = {}) {
  const clock = createClock({ time: new Date(BITIS - 20 * GUN).toISOString(), fixed: true });
  const lisans = lisansAnahtari();
  const durum = { kind, status: "active", expiresAt: new Date(BITIS).toISOString(), licenseId: kind === "trial" ? "DEN-L1-TEST" : "LIS-L1-TEST" };
  const belirtec = () => lisans.belirtec({ at: clock.ms(), machine: MACHINE, ...durum });
  const kapi = await startKapi({ now: () => clock.ms(), trustedKeys: lisans.trusted, lisansFetch: async () => ({ json: async () => ({ ok: true, token: belirtec() }) }) });
  const server = await startTestServer({
    now: clock,
    remoteNow: clock,
    mobileKapiUrl: kapi.base,
    license: { enforce: true, trustedKeys: lisans.trusted, services: ["https://lisans.l1.test/api/lisans"], fetchImpl: async () => ({ status: 200, json: async () => ({ ok: true, token: belirtec() }) }), machineId: MACHINE, now: () => clock.ms(), firstCheckDelayMs: 3_600_000, autoTrial: false },
  });
  if (kind === "trial") await server.app.license.startTrial({});
  else await server.app.license.activateKey("DO-ABCDE-FGHJK-MNPQR-STVWX");
  const sync = server.app.mobileSync;
  const ofis = await sync.ofis();
  assert.equal((await sync.kayitGonder()).ok, true, "ön koşul: kapıcı kaydı");
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
    admin,
    durum,
    phone: () => createPhone(kapi.base, { host: kapi.ofisHost(ofis.id) }),
    async eslenmis() {
      const id = (await ids()).admin;
      assert.equal((await admin.put(`/api/admin/mobile/access/${id}`, { remote: true })).status, 200);
      await sync.idle();
      const kod = await admin.post("/api/admin/mobile/codes", { userId: id });
      assert.equal(kod.status, 200, JSON.stringify(kod.data));
      const tel = ctx.phone();
      assert.equal((await tel.pair(kod.data.data.code)).status, 200, "ön koşul: kapıcı üzerinden eşleme");
      await sync.idle();
      return tel;
    },
    giris: tel => tel.login("admin", ADMIN_PASSWORD),
    async oturum(tel) {
      const r = await tel.get("/api/mobil/session");
      return { status: r.status, code: r.code, error: r.data?.error || "", hak: r.data?.data?.mobilHak || null, yazma: r.data?.data?.writesEnabled, sirket: r.data?.data?.company || "" };
    },
    async yonetim() {
      const r = await admin.get("/api/admin/mobile/devices");
      return r.data.data;
    },
    saat: async ms => {
      clock.set(ms);
      await server.app.license.check?.().catch(() => null);
      await sync.idle(); // 2.4.8 L1 kâhin F1: lisans değişince program kapıcıya kayıt gönderir (arka planda; sonraki adımla yarışmasın)
    },
    close: async () => {
      await server.close().catch(() => {});
      await kapi.close();
    },
  };
  return ctx;
}

describe("2.4.8 L1 — program: ücretli lisans bitince mobil 30 gün salt okunur, uyarılar, sonunda kapanır", () => {
  it("7 gün kala telefonda ve Yönetim → Mobil Cihazlar'da uyarı; bitişte masaüstü salt okunur ama telefon girer (salt okunur), 30. günün sonunda kapanır", async () => {
    assert.equal(typeof lisansModulu.mobileRightOf, "function", "lib/license.mjs mobileRightOf yok (2.4.8 L1)");
    const c = await kur();
    try {
      const tel = await c.eslenmis();
      await c.saat(BITIS - 7 * 86_400_000);
      assert.equal((await c.giris(tel)).status, 200);
      const yedi = await c.oturum(tel);
      assert.equal(yedi.hak?.ileti, "Lisansınız 7 gün sonra bitiyor.", `telefon uyarısı (7 gün kala): ${JSON.stringify(yedi)}`);
      assert.equal((await c.yonetim()).mobileRight?.ileti, "Lisansınız 7 gün sonra bitiyor.", "Yönetim → Mobil Cihazlar uyarısı");

      await c.saat(BITIS + 1000);
      assert.equal(c.server.app.license.status().writable, false, "ön koşul: masaüstü salt okunur");
      const giris = await c.giris(tel);
      assert.equal(giris.status, 200, `hoşgörüde telefon girer (canlı, kapıcı + tünel üzerinden): ${giris.text}`);
      const hos = await c.oturum(tel);
      assert.deepEqual([hos.status, hos.hak?.durum, hos.hak?.ileti, hos.yazma], [200, "hosgoru", "Lisansınız bitti; mobil kullanım hakkınız 30 gün sonra sona erecek.", false], `hoşgörü oturumu: ${JSON.stringify(hos)}`);
      const yaz = await tel.post(`/api/mobil/accounts/acc-yok/tahsilat?company=${encodeURIComponent(hos.sirket)}`, { amount: 10, method: "cash" }, { headers: { "x-hof-request": "l1-hosgoru-yazma-0001" } });
      assert.deepEqual([yaz.status, yaz.code], [403, "LICENSE_READ_ONLY"], `hoşgörüde telefondan yazma programın salt okunur kuralıyla kapalı: ${yaz.status} ${yaz.text}`);
      const kod = await c.admin.post("/api/admin/mobile/codes", { userId: (await c.yonetim()).users.find(u => u.username === "admin").id });
      assert.equal(kod.status, 403, "hoşgörüde yeni karekod yok (yeni cihaz eşlenmez)");
      const y = await c.yonetim();
      assert.deepEqual([y.licenseOk, y.mobileRight?.durum, y.mobileRight?.ileti], [false, "hosgoru", "Lisansınız bitti; mobil kullanım hakkınız 30 gün sonra sona erecek."], "Yönetim → Mobil Cihazlar hoşgörüde");

      await c.saat(BITIS + 29 * GUN);
      assert.equal((await c.giris(tel)).status, 200, "29. gün girer");
      assert.equal((await c.oturum(tel)).hak?.ileti, "Lisansınız bitti; mobil kullanım hakkınız 1 gün sonra sona erecek.");

      await c.saat(BITIS + 30 * GUN);
      const son = await c.oturum(tel);
      // 2.4.8 L1 kâhin F2: 30. günün sonundaki ilk istekte kapıcı kaydı HEMEN siler → telefon eşli değil (KARAR L1).
      assert.deepEqual([son.status, son.code, son.error], [401, "kapi-cihaz", "Mobil kullanım hakkınız sona erdi; lisansınızı yenileyin."], `30. günün sonunda kapanır, kayıt silinir, ileti kapıcıdan (F3): ${JSON.stringify(son)}`);
      assert.equal((await c.yonetim()).mobileRight?.durum, "bitti");
      assert.equal(lisansModulu.mobileRightOf(c.server.app.license.status()).acik, false, "tünel kuralı da kapalı (aynı işlev)");
    } finally {
      await c.close();
    }
  });

  it("deneme: bitiş anında telefon kapanır (ileti 'Deneme süreniz bitti'); kapıcı kaydı silinince program eşlemeleri kaldırır, lisansla yeniden eşleme açık iletiyle", async () => {
    const c = await kur({ kind: "trial" });
    try {
      const tel = await c.eslenmis();
      assert.equal((await c.giris(tel)).status, 200);
      await c.saat(BITIS);
      const r = await c.oturum(tel);
      assert.deepEqual([r.status, r.code, r.error], [403, "kapi-lisans", "Deneme süreniz bitti; mobil kullanım kapalı. Lisans alınca yeniden açılır."], `deneme bitti: ${JSON.stringify(r)}`);
      assert.equal(lisansModulu.mobileRightOf(c.server.app.license.status()).durum, "deneme-bitti");

      // Bitişten 30 gün sonra kapıcının zamanlanmış turu kaydı siler.
      c.clock.set(BITIS + 30 * GUN);
      const tur = await c.kapi.kapi.temizlik(c.kapi.env);
      assert.deepEqual(tur.silinen, [c.ofis.id], `kapıcı turu silmeli: ${JSON.stringify(tur)}`);
      // Lisans alındı: program kaydı yeniler (lisans etkinleştirme güvenlik değişikliği) → kapıcı "silindi" der → eşlemeler programda da kalkar.
      c.durum.kind = "license";
      c.durum.licenseId = "LIS-L1-YENI";
      c.durum.expiresAt = new Date(BITIS + 400 * GUN).toISOString();
      await c.server.app.license.activateKey("DO-ABCDE-FGHJK-MNPQR-STVWX");
      const kayit = await c.sync.kayitGonder({ zorla: true });
      assert.deepEqual([kayit.ok, kayit.data?.cihaz, Boolean(kayit.data?.silindi)], [true, 0, true], `kayıt cihazsız açıldı: ${JSON.stringify(kayit)}`);
      assert.equal(c.server.app.store.get("SELECT COUNT(*) AS n FROM mobile_devices WHERE revoked_at IS NULL").n, 0, "programdaki eşlemeler kaldırıldı (silinmiş kayıt geri gelmez)");
      const y = await c.yonetim();
      assert.ok(y.kapiSilindi?.at, `Yönetim → Mobil Cihazlar 'mobil kaydınız silindi' bilgisini taşır: ${JSON.stringify(y.kapiSilindi)}`);
      const eski = await c.oturum(tel);
      assert.equal(eski.status, 401, `eski telefon eşli değil: ${JSON.stringify(eski)}`);
      const yeni = await c.eslenmis();
      assert.equal((await c.giris(yeni)).status, 200, "karekodla yeniden eşlenen telefon girer");
      assert.equal((await c.yonetim()).kapiSilindi, null, "yeniden eşlemeden sonra uyarı kalkar");
    } finally {
      await c.close();
    }
  });
});
