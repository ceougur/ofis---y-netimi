// 2.4.7 M3 program tarafı: şifreli özet üretici + kapıcıya yükleyici + kapıcı işareti (lib/mobile-sync.mjs, lib/mobile-ozet.mjs; docs/mobil/M3-TASARIM.md). Gerçek
// program (createApp) → YEREL kapıcı (bulut/kapi/kapi.mjs, sahte R2; test/kapi-yerel.mjs) → "telefon" (test/mobil-uzak-ortak.mjs; Node WebCrypto, kapıcıya Host
// başlığıyla). Lisans servisi sahte ve yerel (ders 30). Saat sahte ve SABİT (ders 13, 22): ay sonu + gece yarısı yakını; elle ilerletilir.
// Her denetim yeni davranışı iddia eder; eski kodda (M2) mobileSync / kapıcı yok → kırmızı, nedeni iletide (ders 7, 38).
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { after, before, describe, it } from "node:test";
import { createClock } from "../server/lib/clock.mjs";
import { loadConfig } from "../server/lib/config.mjs";
import { mesaj } from "../server/lib/kapi-protokol.mjs";
import { ozetCoz } from "../server/lib/mobile-ozet.mjs";
import { OZET_KURALLARI, yazmaTuru } from "../server/lib/mobile-sync.mjs";
import { ADMIN_PASSWORD, createUser, loginAdmin, startTestServer } from "./helpers.mjs";
import { lisansAnahtari } from "./kapi-ortak.mjs";
import { startKapi } from "./kapi-yerel.mjs";
import { createPhone, rawRequest } from "./mobil-uzak-ortak.mjs";

const T0 = "2026-11-30T23:30:00+03:00";
const MIN = 60_000;
const MACHINE = "0123456789abcdef0123456789abcdef";
const PASSWORD = "Personel-2026!";

async function kurulum() {
  const clock = createClock({ time: T0, fixed: true });
  const lisans = lisansAnahtari();
  const world = { online: true, kayit: {} };
  const belirtec = () => lisans.belirtec({ at: clock.ms(), machine: MACHINE, licenseId: "LIS-M3-TEST", ...world.kayit });
  const kapi = await startKapi({
    now: () => clock.ms(),
    trustedKeys: lisans.trusted,
    lisansFetch: async () => {
      if (!world.online) throw new TypeError("fetch failed");
      return { json: async () => ({ ok: true, token: belirtec() }) };
    },
  });
  const server = await startTestServer({
    now: clock,
    remoteNow: clock,
    mobileKapiUrl: kapi.base,
    license: {
      enforce: true,
      trustedKeys: lisans.trusted,
      services: ["https://lisans.m3.test/api/lisans"],
      fetchImpl: async () => {
        if (!world.online) throw Object.assign(new TypeError("fetch failed"), { cause: { code: "ENOTFOUND" } });
        return { status: 200, json: async () => ({ ok: true, token: belirtec() }) };
      },
      machineId: MACHINE,
      now: () => clock.ms(),
      firstCheckDelayMs: 3_600_000,
      autoTrial: false,
    },
  });
  await server.app.license.activateKey("DO-ABCDE-FGHJK-MNPQR-STVWX");
  const sync = server.app.mobileSync;
  // Kurulum yarıda kalırsa (eski kodda mobileSync yok) açılanlar kapanır; yoksa açık sunucu koşuyu asılı bırakır (kırmızının nedeni iletide görünür — ders 38).
  if (!sync) {
    await server.close().catch(() => {});
    await kapi.close();
    throw new Error("programda mobil özet yükleyicisi (app.mobileSync) yok");
  }
  const ofis = await sync.ofis();
  const ilkKayit = await sync.kayitGonder();
  const remote = await server.app.listenRemote(0, "127.0.0.1");
  const remoteBase = `http://127.0.0.1:${remote.port}`;
  kapi.tunel(ofis.id, remoteBase);
  const admin = await loginAdmin(server);
  const ids = async () => Object.fromEntries((await admin.get("/api/admin/users")).data.data.map(u => [u.username, u.id]));
  const companies = async () => Object.fromEntries((await admin.get("/api/companies")).data.data.companies.map(c => [c.code, c.id]));
  const ctx = {
    clock,
    world,
    kapi,
    server,
    sync,
    ofis,
    ilkKayit,
    admin,
    remoteBase,
    ids,
    companies,
    phone: options => createPhone(kapi.base, { host: kapi.ofisHost(ofis.id), ...options }),
    async paired(username, password) {
      const id = (await ids())[username];
      assert.equal((await admin.put(`/api/admin/mobile/access/${id}`, { remote: true })).status, 200);
      await sync.idle();
      const code = await admin.post("/api/admin/mobile/codes", { userId: id });
      assert.equal(code.status, 200, JSON.stringify(code.data));
      const phone = ctx.phone();
      const pair = await phone.pair(code.data.data.code);
      assert.equal(pair.status, 200, `kapıcı üzerinden eşleme: ${pair.text}`);
      await sync.idle();
      const login = await phone.login(username, password);
      assert.equal(login.status, 200, `kapıcı üzerinden uzak giriş: ${login.text}`);
      return phone;
    },
    read: phone => phone.readSummary({ now: clock.ms() }),
    ozetMetni: () => {
      const kayit = kapi.r2.nesneler.get(`ofis/${ofis.id}/ozet.json`);
      return kayit ? new TextDecoder().decode(kayit.veri) : "";
    },
    close: async () => {
      await server.close().catch(() => {});
      await kapi.close();
    },
  };
  return ctx;
}

describe("M3 program: ofis kimliği, eşlemede şifreleme anahtarı, telefon adresi", () => {
  let ctx;
  before(async () => {
    ctx = await kurulum();
  });
  after(() => ctx?.close());

  it("ofis kimliği DNS etiketi; açılışta kapıcıya kayıt; karekod ofisin telefon adresini taşır; kimlik geri yüklemede canlıdan kalan ayarda", async () => {
    assert.match(ctx.ofis.id, /^o[a-z2-7]{16}$/);
    assert.equal(ctx.ilkKayit.ok, true, `kapıcıya kayıt: ${JSON.stringify(ctx.ilkKayit)}`);
    assert.equal(ctx.kapi.meta(ctx.ofis.id)?.cihazlar.length, 0, "kapıcı ofisi tanımalı (eşli cihaz yok)");
    const id = (await ctx.ids()).admin;
    await ctx.admin.put(`/api/admin/mobile/access/${id}`, { remote: true });
    const code = await ctx.admin.post("/api/admin/mobile/codes", { userId: id });
    assert.ok(code.data.data.url.startsWith(`http://${ctx.ofis.id}.destekofis.test/mobil/#eslesme=`), `karekod adresi: ${code.data.data.url}`);
    const row = ctx.server.app.store.get("SELECT key FROM settings WHERE key = 'meta.mobile.office'");
    assert.ok(row, "ofis kaydı ortak katman ayarında (meta.% → geri yüklemede canlıdan kalır; company-backups COMMON_SETTINGS)");
    assert.ok(!/^meta\.(bank|schema)\./.test(row.key));
    const source = readFileSync(new URL("../server/lib/company-backups.mjs", import.meta.url), "utf8");
    assert.match(source, /key LIKE 'meta\.%' AND key NOT LIKE 'meta\.bank\.%'/, "COMMON_SETTINGS meta.% kuralı");
  });

  it("eşleme şifreleme anahtarını (ECDH) saklar ve yanıtta ofisin imza anahtarını verir; gizli bileşenli anahtar reddedilir", async () => {
    const phone = await ctx.paired("admin", ADMIN_PASSWORD);
    const row = ctx.server.app.store.get("SELECT enc_key FROM mobile_devices WHERE id = ?", phone.deviceId);
    assert.ok(row?.enc_key, "cihazın şifreleme anahtarı kaydedilmeli");
    assert.equal(JSON.parse(row.enc_key).crv, "P-256");
    assert.equal(phone.office?.kimlik, ctx.ofis.id, "eşleme yanıtı ofis kimliğini vermeli");
    assert.deepEqual(phone.office.anahtar, ctx.ofis.acik, "eşleme yanıtı ofisin özet imza anahtarını vermeli");
    assert.equal(ctx.kapi.meta(ctx.ofis.id).cihazlar.map(c => c.id).join(), phone.deviceId, "eşleme kapıcıya hemen bildirilmeli (güvenlik yüklemesi)");
    const id = (await ctx.ids()).admin;
    const code = await ctx.admin.post("/api/admin/mobile/codes", { userId: id });
    const bad = ctx.phone();
    const r = await bad.post("/api/mobil/eslesme", { kod: code.data.data.code, ad: "x", tur: "telefon", anahtar: bad.publicJwk(), sifre: { kty: "EC", crv: "P-256", x: phone.office.anahtar.x, y: phone.office.anahtar.y, d: "A".repeat(43) } });
    assert.equal(r.code, "remote-key", "gizli bileşen taşıyan şifreleme anahtarı reddedilmeli");
  });
});

describe("M3 program: özet kullanıcıya göre süzülür (K23), şifreli, cihaz silinince açılamaz", () => {
  let ctx;
  let adminPhone;
  let staffPhone;
  let ids;
  let codes;
  before(async () => {
    ctx = await kurulum();
    const created = await ctx.admin.post("/api/companies", { code: "002", name: "İkinci Şirket" });
    assert.equal(created.status, 200, JSON.stringify(created.data));
    codes = await ctx.companies();
    assert.equal((await ctx.admin.post(`/api/workspace/accounts?hofCompany=${codes["002"]}`, { name: "Gizli Cari Yüzİki", type: "customer" })).status, 200);
    assert.equal((await ctx.admin.post(`/api/workspace/accounts?hofCompany=${codes["001"]}`, { name: "Açık Cari Yüzbir", type: "customer" })).status, 200);
    await createUser(ctx.server, ctx.admin, { username: "saha", password: PASSWORD });
    ids = await ctx.ids();
    // Saha personeli: yalnız Cari Hesapları Görme; şirket kutusu işaretsiz → yalnız 001.
    const { permissionsFor, isGrantable } = await import("../server/lib/permissions.mjs");
    const remove = permissionsFor("personel").filter(p => p !== "accounts.view" && isGrantable(p));
    assert.equal((await ctx.admin.patch(`/api/admin/users/${ids.saha}`, { grants: { add: ["accounts.view"], remove } })).status, 200);
    adminPhone = await ctx.paired("admin", ADMIN_PASSWORD);
    staffPhone = await ctx.paired("saha", PASSWORD);
    const up = await ctx.sync.uploadNow();
    assert.equal(up.ok, true, JSON.stringify(up));
  });
  after(() => ctx?.close());

  it("yönetici: iki şirket, Anlık Durum dahil; saha personeli: yalnız 001'in Cari bölümü — 002 ve yetkisiz bölümler özete HİÇ girmez", async () => {
    const a = await ctx.read(adminPhone);
    assert.equal(a.status, 200, a.text.slice(0, 200));
    assert.deepEqual(Object.keys(a.veri.sirketler).sort(), [codes["001"], codes["002"]].sort(), "yönetici iki şirketi görür");
    assert.ok(a.veri.sirketler[codes["002"]]["/overview"], "Anlık Durum yalnız yöneticide");
    const s = await ctx.read(staffPhone);
    assert.equal(s.status, 200, s.text.slice(0, 200));
    assert.deepEqual(Object.keys(s.veri.sirketler), [codes["001"]], "saha yalnız 001");
    assert.deepEqual(Object.keys(s.veri.sirketler[codes["001"]]).filter(k => !k.startsWith("/accounts/")), ["/accounts"], "yalnız yetkili bölüm (Cari)");
    const metin = JSON.stringify(s.veri);
    assert.ok(!metin.includes("Gizli Cari"), "002'nin carisi sahanın özetinde olmamalı");
    assert.ok(metin.includes("Açık Cari Yüzbir"), "001'in carisi görünmeli");
    assert.deepEqual(s.veri.oturum.companies.map(c => c.id), [codes["001"]], "çevrimdışı şirket listesi de süzülü");
  });

  it("buluttaki nesne şifreli: cari adı, şirket adı, tutar düz metin olarak yok; sahanın cihazı yöneticinin bölümünü açamaz", async () => {
    const raw = ctx.ozetMetni();
    for (const word of ["Gizli Cari", "Açık Cari", "İkinci Şirket", "Ofis yöneticisi"]) assert.ok(!raw.includes(word), `kapıcıdaki nesnede düz metin: ${word}`);
    const zarf = JSON.parse(raw);
    const govde = JSON.parse(zarf.govde);
    assert.equal(Object.keys(govde.kullanicilar).length, 2, "kullanıcı başına ayrı veri anahtarı");
    assert.notEqual(govde.cihazlar[adminPhone.deviceId].u, govde.cihazlar[staffPhone.deviceId].u, "iki cihaz farklı kullanıcı bölümüne bağlı");
  });

  it("yetki değişikliği HEMEN yansır: 002 erişimi verilince özette 002 görünür, kaldırılınca bir sonraki (otomatik) özette yok", async () => {
    assert.equal((await ctx.admin.put(`/api/companies/access/${ids.saha}`, { companies: [codes["001"], codes["002"]] })).status, 200);
    await ctx.sync.idle();
    let s = await ctx.read(staffPhone);
    assert.ok(s.veri.sirketler[codes["002"]], "erişim verilince güvenlik yüklemesiyle hemen görünmeli");
    assert.equal(ctx.sync.status().son.neden, "guvenlik");
    assert.equal((await ctx.admin.put(`/api/companies/access/${ids.saha}`, { companies: [] })).status, 200);
    await ctx.sync.idle();
    s = await ctx.read(staffPhone);
    assert.deepEqual(Object.keys(s.veri.sirketler), [codes["001"]], "erişim kalkınca 002 hemen özetten çıkmalı");
  });

  it("silinen cihaz: kapıcı reddeder; elde kalan eski erişimle yeni özet indirilse bile çözülemez (anahtar yenilendi)", async () => {
    const before = JSON.parse(JSON.parse(ctx.ozetMetni()).govde).sira;
    assert.equal((await ctx.admin.del(`/api/admin/mobile/devices/${staffPhone.deviceId}`)).status, 200);
    await ctx.sync.idle();
    const r = await ctx.read(staffPhone);
    assert.equal(r.code, "kapi-cihaz", `silinen cihaz kapıcıda reddedilmeli (gelen ${r.status} ${r.code})`);
    const raw = ctx.ozetMetni();
    const govde = JSON.parse(JSON.parse(raw).govde);
    assert.ok(govde.sira > before, "silme yeni özet yüklemeli");
    assert.equal(govde.cihazlar[staffPhone.deviceId], undefined, "yeni özette silinen cihaza sarılmış anahtar olmamalı");
    const zorla = await ozetCoz(raw, { ofisAnahtari: ctx.ofis.acik, cihaz: staffPhone.deviceId, sifreGizli: null });
    assert.equal(zorla.veri, null, "silinen cihaz yeni özeti açamamalı");
    const a = await ctx.read(adminPhone);
    assert.equal(a.status, 200, "kalan cihaz okumayı sürdürmeli");
  });
});

describe("M3 program: yükleme tetikleri (Eylül: 15 dk / 10 dk hareketsizlik / günde 20; güvenlik hemen; kapanışta son hâl)", () => {
  it("yazma türleri: GET, giriş/çıkış ve karekod üretimi tetiklemez; kullanıcı/rol/şirket erişimi/mobil/lisans/eşleme güvenlik; öbürü veri", () => {
    assert.equal(yazmaTuru("GET", "/api/workspace/accounts"), null);
    assert.equal(yazmaTuru("POST", "/api/auth/login"), null);
    assert.equal(yazmaTuru("POST", "/api/mobil/session/login"), null);
    assert.equal(yazmaTuru("POST", "/api/admin/mobile/codes"), null, "karekod üretmek özeti değiştirmez (kâhin: karekod_uret yeniden üretmez)");
    for (const p of ["/api/admin/users/u1", "/api/admin/roles/r", "/api/admin/mobile/devices/d", "/api/companies/access/u1", "/api/companies", "/api/license/check", "/api/mobil/eslesme"]) assert.equal(yazmaTuru("POST", p), "guvenlik", p);
    for (const p of ["/api/workspace/accounts", "/api/workspace/cash", "/api/admin/backups/restore"]) assert.equal(yazmaTuru("POST", p), "veri", p);
  });

  it("veri: 10 dk hareketsizlikte yüklenir; sürekli değişiklikte en geç 15 dk; iki veri yüklemesi arası ≥ 15 dk; günde en çok 20, İstanbul gün dönümünde sıfırlanır", async () => {
    const ctx = await kurulum();
    try {
      await ctx.paired("admin", ADMIN_PASSWORD);
      const sira = () => JSON.parse(JSON.parse(ctx.ozetMetni()).govde).sira;
      const yaz = () => ctx.sync.noteWrite("POST", "/api/workspace/accounts");
      const tur = async () => {
        await ctx.sync.tick();
        await ctx.sync.idle();
      };
      const s0 = sira();
      yaz();
      ctx.clock.advance(9 * MIN);
      await tur();
      assert.equal(sira(), s0, "9 dk hareketsizlikte henüz yüklenmemeli");
      ctx.clock.advance(MIN);
      await tur();
      assert.equal(sira(), s0 + 1, "10 dk hareketsizlikte yüklenmeli");
      assert.equal(ctx.sync.status().son.neden, "veri");
      // Dakikada bir değişiklik (hiç hareketsizlik yok): ilk değişiklik +1 dk; 15 dk dolmadan (ilk değişiklikten 14 dk sonra) yüklenmez.
      for (let i = 0; i < 15; i += 1) {
        ctx.clock.advance(MIN);
        yaz();
        await tur();
      }
      assert.equal(sira(), s0 + 1, "ilk bekleyen değişiklikten 15 dk geçmeden (sürekli değişiklikte) yüklenmemeli");
      ctx.clock.advance(MIN);
      yaz();
      await tur();
      assert.equal(sira(), s0 + 2, "sürekli değişiklikte ilk değişiklikten 15 dk sonra yüklenmeli");
      await tur();
      assert.equal(sira(), s0 + 2, "değişiklik yoksa yüklenmemeli");
      // Günlük sınır: 27 dk arayla değişiklik + 11 dk hareketsizlik → her turda yükleme hakkı doğar (≥ 15 dk aralık). 54 saat: 1 Aralık TAM gün.
      const gun = () => new Date(ctx.clock.ms() + 3 * 3_600_000).toISOString().slice(0, 10);
      const sayim = new Map();
      for (let i = 0; i < 120; i += 1) {
        ctx.clock.advance(16 * MIN);
        yaz();
        ctx.clock.advance(11 * MIN);
        const once = sira();
        await tur();
        if (sira() > once) sayim.set(gun(), (sayim.get(gun()) || 0) + 1);
      }
      assert.equal(OZET_KURALLARI.gunlukVeri, 40, "günlük veri yükleme sınırı 40 (KARARLAR — M3 Q3, 29.10.2026)");
      assert.equal(sayim.get("2026-12-01"), OZET_KURALLARI.gunlukVeri, `1 Aralık (tam gün, 53 fırsat): tam 40 veri yüklemesi (${JSON.stringify([...sayim])})`);
      assert.ok((sayim.get("2026-12-02") || 0) > 0 && sayim.get("2026-12-02") <= OZET_KURALLARI.gunlukVeri, "İstanbul gün dönümünde sayaç sıfırlanır");
      assert.ok((sayim.get("2026-11-30") || 0) + 2 <= OZET_KURALLARI.gunlukVeri, "30 Kasım: en çok 40");
    } finally {
      await ctx.close();
    }
  });

  it("güvenlik değişikliği 20 sınırını beklemez; program kapanırken bekleyen değişiklik son hâl olarak yüklenir; sonra telefon canlıda 'ofis kapalı', özette son hâl", async () => {
    const ctx = await kurulum();
    try {
      const phone = await ctx.paired("admin", ADMIN_PASSWORD);
      const codes = await ctx.companies();
      assert.equal((await ctx.admin.post(`/api/workspace/accounts?hofCompany=${codes["001"]}`, { name: "Kapanışta Yazılan Cari", type: "customer" })).status, 200);
      const once = await ctx.read(phone);
      assert.ok(!JSON.stringify(once.veri).includes("Kapanışta Yazılan Cari"), "veri yüklemesi henüz zamanı gelmeden olmamalı");
      await ctx.server.close();
      const sonra = await ctx.read(phone);
      assert.equal(sonra.status, 200, "sunucu kapalıyken özet kapıcıdan okunmalı");
      assert.ok(JSON.stringify(sonra.veri).includes("Kapanışta Yazılan Cari"), "kapanışta son hâl yüklenmeli");
      assert.equal(ctx.sync.status().son.neden, "kapanis");
      const canli = await phone.get("/api/mobil/session");
      assert.deepEqual([canli.status, canli.code], [503, "kapi-ofis-kapali"], "canlı bağlantı ofis kapalı demeli");
    } finally {
      await ctx.close();
    }
  });
});

describe("M3 program: kapıcı açıkken uzak istek kapıcının işaretini taşımalı; lisans geçersizse yüklenmez", () => {
  let ctx;
  let phone;
  before(async () => {
    ctx = await kurulum();
    phone = await ctx.paired("admin", ADMIN_PASSWORD);
  });
  after(() => ctx?.close());

  it("tünele kapıcıyı atlatıp doğrudan gelen (işaretsiz ya da başka cihazın işaretli) istek reddedilir (remote-kapi)", async () => {
    const cookie = [...phone.jar].map(([k, v]) => `${k}=${v}`).join("; ");
    const direkt = await rawRequest(ctx.remoteBase, "GET", "/api/mobil/session", { headers: { cookie, host: ctx.kapi.ofisHost(ctx.ofis.id) } });
    assert.equal(direkt.code, "remote-kapi", `işaretsiz istek reddedilmeli (gelen ${direkt.status} ${direkt.code})`);
    const kapidan = await phone.get("/api/mobil/session");
    assert.equal(kapidan.status, 200, "kapıdan gelen kabul");
    const taklit = await rawRequest(ctx.remoteBase, "GET", "/api/mobil/session", { headers: { cookie, "x-do-kapi": `${ctx.clock.ms()}.-.x` } });
    assert.equal(taklit.code, "remote-kapi");
  });

  it("lisans engellenince program özet yüklemez; kapıcıya engelli belirteç bildirilir ve telefonun okuması hemen kapanır (K14)", async () => {
    assert.equal((await ctx.read(phone)).status === 200 || (await ctx.sync.uploadNow()).ok, true);
    ctx.world.kayit = { status: "blocked" };
    await ctx.server.app.license.check();
    const up = await ctx.sync.uploadNow();
    assert.equal(up.code, "kapi-lisans", `kapıcı engelli belirteci almalı ve reddetmeli (gelen ${JSON.stringify(up)})`);
    const r = await ctx.read(phone);
    assert.equal(r.code, "kapi-lisans", "okuma kapanmalı");
  });
});

describe("M3: yapılandırma ve kaynak uyumu", () => {
  it("kapıcı yalnız üretim girişiyle (mobileKapi) açılır; lisans servisi ortam değişkeniyle değiştirilmişse kapalı kalır (ders 30)", () => {
    const bos = { HUKUK_LICENSE_URL: undefined, HUKUK_KAPI_URL: undefined };
    assert.equal(loadConfig({ env: bos }).mobileKapiUrl, "", "createApp varsayılanı kapalı");
    assert.equal(loadConfig({ env: bos, mobileKapi: true }).mobileKapiUrl, "https://kapi.destekofis.net");
    assert.equal(loadConfig({ env: { HUKUK_LICENSE_URL: "http://127.0.0.1:9" }, mobileKapi: true }).mobileKapiUrl, "", "test (ölü lisans adresi) gerçek kapıcıya gitmez");
    assert.equal(loadConfig({ env: { HUKUK_LICENSE_URL: "http://127.0.0.1:9", HUKUK_KAPI_URL: "http://127.0.0.1:7/" }, mobileKapi: true }).mobileKapiUrl, "http://127.0.0.1:7");
    assert.equal(loadConfig({ env: bos, mobileKapi: true, licenseServices: "http://127.0.0.1:9" }).mobileKapiUrl, "");
  });

  it("telefon (client/mobil/ozet.js) imza ve şifreleme bağlam metinlerini protokolle aynı kurar", () => {
    const app = readFileSync(new URL("../client/mobil/ozet.js", import.meta.url), "utf8");
    const ornek = { cihaz: mesaj.cihaz("GET", "/kapi/ozet", "${keys.cihaz}", "${ms}"), tuz: mesaj.tuz("${g.ofis}", "${g.sira}"), sarma: mesaj.sarmaEk("${g.ofis}", "${g.sira}", "${cihaz}", "${e.u}"), veri: mesaj.veriEk("${g.ofis}", "${g.sira}", "${e.u}"), bilgi: mesaj.sarmaBilgi("${cihaz}") };
    assert.ok(app.includes(ornek.cihaz.replace(/\n/g, "\\n")), "cihaz imzası metni");
    for (const [ad, metin] of Object.entries(ornek).filter(([ad]) => ad !== "cihaz")) assert.ok(app.includes(metin), `${ad} bağlam metni: ${metin}`);
  });
});
