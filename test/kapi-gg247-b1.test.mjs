// 2.4.7 bağımsız gözden geçirme B1 (ORTA) — kalıcı test (yeniden üretme betiği gg247-ana-tekrar/b1-silinen-cihaz-yeniden-esleme.test.mjs'ten).
// Bulgu: Yönetim → Mobil Cihazlar'da silinen cihazın tarayıcısı kapıcı üzerinden YENİDEN EŞLENEMİYORDU: kapıcı listede olmayan cihaz çerezini eşleme ucunda ve
// /mobil/ sayfa dosyalarında da 401 kapi-cihaz ile reddediyor, program çerezi temizleyemiyordu (istek programa hiç ulaşmıyordu).
// BAŞ MİMAR KARARI: listede olmayan cihaz çerezi eşleme ve sayfa yollarında "cihazsız" sayılır ve silinir; öbür API yollarında 401 kapi-cihaz kalır ama
// çerezi siler. Uygulama notu (bulut/kapi/kapi.mjs vekil): yanıtta silinen, bu ofisin SİLİNMİŞ cihazlarından birinin (ya da biçimi bozuk) çerezidir; kapıcının
// hiç görmediği kimlik (yeni eşlenmiş, kaydı kapıcıya henüz ulaşmamış cihaz olabilir) silinmez — silinseydi cihaz programda yer tutan ama sırrı yitmiş bir kayıt
// olarak kalırdı. Gerçek program + yerel kapıcı + sahte lisans servisi (ders 30). Eski kodda (e73e9860) kırmızı: sayfa / eşleme 401 kapi-cihaz, çerez silinmez.
import assert from "node:assert/strict";
import { after, before, describe, it } from "node:test";
import { DEVICE_COOKIE } from "../server/lib/mobile-remote.mjs";
import { rawRequest } from "./mobil-uzak-ortak.mjs";
import { ADMIN_PASSWORD, kavanozBasligi, kurulum, siliyor } from "./kapi-gg247-ortak.mjs";

describe("B1 silinen cihazın tarayıcısı kapıcı üzerinden yeniden eşlenir; eski çerez silinir", () => {
  let ctx;
  before(async () => {
    ctx = await kurulum();
  });
  after(() => ctx?.close());

  it("silinen cihazın eski çerezi: sayfa 200 (cihazsız) + çerez silinir; veri ucu 401 kapi-cihaz + çerez silinir; yeni karekodla eşleme 200, giriş 200", async () => {
    const phone = await ctx.paired("admin", ADMIN_PASSWORD);
    const eski = phone.deviceId;
    assert.equal((await phone.get("/api/mobil/session")).status, 200, "ön koşul: eşli cihaz oturumla geçer");
    assert.equal((await ctx.admin.del(`/api/admin/mobile/devices/${eski}`)).status, 200);
    await ctx.sync.idle();
    assert.equal(ctx.kapi.meta(ctx.ofis.id).cihazlar.some(c => c.id === eski), false, "ön koşul: kapıcı silmeyi aldı");
    // Telefon bu arada hiç istek yapmadı (gerçek kullanımda tipik): kavanozda eski cihaz + oturum çerezi duruyor.
    const eskiCerezler = kavanozBasligi(phone);
    assert.ok(eskiCerezler.includes(`${DEVICE_COOKIE}=${eski}.`), `ön koşul: eski cihaz çerezi duruyor (${eskiCerezler.slice(0, 80)})`);
    const host = ctx.kapi.ofisHost(ctx.ofis.id);

    const sayfa = await rawRequest(ctx.kapi.base, "GET", "/mobil/", { headers: { host, cookie: eskiCerezler, accept: "text/html" } });
    assert.equal(sayfa.status, 200, `eşleme sayfası açılmalı (cihazsız); gelen ${sayfa.status} ${sayfa.text.slice(0, 120)}`);
    assert.ok(siliyor(sayfa, DEVICE_COOKIE), `sayfa yanıtı silinmiş cihazın çerezini silmeli; Set-Cookie: ${JSON.stringify(sayfa.headers["set-cookie"] || null)}`);

    const veri = await rawRequest(ctx.kapi.base, "GET", "/api/mobil/session", { headers: { host, cookie: eskiCerezler } });
    assert.deepEqual([veri.status, veri.code], [401, "kapi-cihaz"], "veri ucu silinmiş cihazla kapıcıda reddedilir");
    assert.ok(siliyor(veri, DEVICE_COOKIE), `401 yanıtı da çerezi silmeli; Set-Cookie: ${JSON.stringify(veri.headers["set-cookie"] || null)}`);

    // Kullanıcı yöneticiden yeni karekod alır, AYNI telefonda okutur (kavanozda hâlâ eski çerez).
    const kod = await ctx.code("admin");
    const esle = await phone.pair(kod);
    assert.equal(esle.status, 200, `yeni karekodla eşleme kabul edilmeli; gelen ${esle.status} ${esle.text}`);
    assert.notEqual(phone.deviceId, eski, "yeni cihaz kimliği");
    assert.ok(!kavanozBasligi(phone).includes(`${eski}.`), "eşlemenin yeni çerezi eskisinin yerini aldı");
    await ctx.sync.idle();
    const giris = await phone.login("admin", ADMIN_PASSWORD);
    assert.equal(giris.status, 200, `yeni eşlemeyle uzak giriş: ${giris.text}`);
    assert.equal((await phone.get("/api/mobil/session")).status, 200, "yeni cihazla oturum geçer");
  });

  it("eşleme ucu silinmiş cihazın çereziyle doğrudan gelirse de (sayfa açılmadan) 200; çerez yeni cihazınkiyle değişir", async () => {
    const phone = await ctx.paired("admin", ADMIN_PASSWORD);
    const eski = phone.deviceId;
    assert.equal((await ctx.admin.del(`/api/admin/mobile/devices/${eski}`)).status, 200);
    await ctx.sync.idle();
    const kod = await ctx.code("admin");
    const esle = await phone.pair(kod);
    assert.equal(esle.status, 200, `eşleme: ${esle.status} ${esle.text}`);
    const cerezler = [].concat(esle.headers["set-cookie"] || []);
    assert.ok(cerezler.some(line => line.startsWith(`${DEVICE_COOKIE}=${phone.deviceId}.`)), `yeni cihaz çerezi yazıldı: ${JSON.stringify(cerezler)}`);
    assert.equal(cerezler.filter(line => line.startsWith(`${DEVICE_COOKIE}=`)).length, 1, "kapıcı programın yeni cihaz çerezinin üstüne silme satırı eklemez");
    await ctx.sync.idle();
    assert.equal((await phone.login("admin", ADMIN_PASSWORD)).status, 200);
    assert.equal((await ctx.admin.del(`/api/admin/mobile/devices/${phone.deviceId}`)).status, 200, "yer açılsın (sınır 3)");
    await ctx.sync.idle();
  });

  it("korunan davranış: kapıcının hiç görmediği (yeni eşlenmiş olabilecek) cihaz kimliği veri ucunda 401 kapi-cihaz alır ama çerezi SİLİNMEZ; eşli cihaz etkilenmez", async () => {
    const host = ctx.kapi.ofisHost(ctx.ofis.id);
    const bilinmeyen = `${DEVICE_COOKIE}=dev-${"7".repeat(8)}-7777-7777-7777-${"7".repeat(12)}.${"s".repeat(43)}`;
    const r = await rawRequest(ctx.kapi.base, "GET", "/api/mobil/session", { headers: { host, cookie: bilinmeyen } });
    assert.deepEqual([r.status, r.code], [401, "kapi-cihaz"]);
    assert.equal(siliyor(r, DEVICE_COOKIE), false, "görülmemiş kimliğin çerezi silinmemeli");
    const bozuk = await rawRequest(ctx.kapi.base, "GET", "/api/mobil/session", { headers: { host, cookie: `${DEVICE_COOKIE}=bozuk` } });
    assert.deepEqual([bozuk.status, bozuk.code], [401, "kapi-cihaz"]);
    const phone = await ctx.paired("admin", ADMIN_PASSWORD);
    const ok = await phone.get("/api/mobil/session");
    assert.equal(ok.status, 200, ok.text);
    assert.equal(siliyor(ok, DEVICE_COOKIE), false, "eşli cihazın çerezine dokunulmaz");
  });
});
