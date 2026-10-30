// 2.4.7 bağımsız gözden geçirme B4 (ORTA) — kalıcı test (yeniden üretme betiği gg247-ana-tekrar/b4-alt-alan-cerez.test.mjs'ten).
// Bulgu: ofisler aynı kayıtlı alanın alt adlarında (<ofis>.destekofis.net; alan Public Suffix List'te değil). Bir ofisin kökeni (tüneli; deneme lisansıyla bile)
// Domain=<ana alan> çerezi koyabiliyordu, kapıcı kökenin Set-Cookie'sini olduğu gibi geçiriyordu; kurban telefon o sayfayı bir kez açınca kendi ofisine giden
// isteklerde İKİ cihaz çerezi taşıyordu: kapıcı ilkini, program sonuncusunu okuyordu → kurbanın mobil erişimi kesiliyordu (hizmet engelleme).
// BAŞ MİMAR KARARI: `__Host-` çerez adları (Secure; Path=/; Domain YOK — tarayıcı bu adı alt addan üst alana koydurmaz), kapıcı kökenin Domain='li Set-Cookie'sini
// düşürür, aynı adlı iki cihaz/oturum çerezi reddedilir (kapıcı 400 kapi-cerez, program 400 remote-cookie), kapıcı ve program çerezi TEK kuralla okur
// (server/lib/mobil-cerez.mjs). Gerçek program + yerel kapıcı + sahte lisans servisi (ders 30). Eski kodda (e73e9860) kırmızı.
// Bu test sunucu taraflarını sınar; "tarayıcı __Host- adını Domain'li kabul etmez" kuralı tarayıcınındır (RFC 6265bis §4.1.3.2) — test edilmez (DENENMEYEN).
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import http from "node:http";
import { after, before, describe, it } from "node:test";
import { DEVICE_COOKIE, REMOTE_SESSION_COOKIE } from "../server/lib/mobile-remote.mjs";
import { kapiIstemcisi } from "../server/lib/mobile-ozet.mjs";
import { ADMIN_PASSWORD, loginAdmin, startTestServer } from "./helpers.mjs";
import { ofisAnahtari } from "./kapi-ortak.mjs";
import { createPhone, rawRequest } from "./mobil-uzak-ortak.mjs";
import { kavanozBasligi, kurulum, setCookies } from "./kapi-gg247-ortak.mjs";

const SAHTE_CIHAZ = `dev-00000000-0000-0000-0000-000000000000.${"A".repeat(43)}`;

describe("B4 alt alanlar arası çerez: __Host- adlar, Domain'li Set-Cookie düşer, çakışan çerez reddedilir", () => {
  let ctx, saldirgan, saldirganOfis, phone;
  before(async () => {
    ctx = await kurulum();
    // Saldırganın ofisi: kendi anahtarı + KENDİ makinesinin DENEME belirteci (kurbanınkinden ayrı makine); tüneli kendi sunucusuna.
    saldirganOfis = await ofisAnahtari();
    const istemci = kapiIstemcisi({ url: ctx.kapi.base, fetchImpl: (...a) => fetch(...a), simdi: () => ctx.clock.ms() });
    const k = await istemci.kayit(saldirganOfis, { lisans: ctx.lisans.belirtec({ at: ctx.clock.ms(), machine: "fe".repeat(16), kind: "trial", licenseId: "DENEME-SALDIRGAN" }), cihazlar: [] });
    assert.equal(k.ok, true, JSON.stringify(k));
    saldirgan = http.createServer((req, res) => {
      res.writeHead(200, {
        "content-type": "text/html",
        "set-cookie": [
          `${DEVICE_COOKIE}=${SAHTE_CIHAZ}; Domain=destekofis.test; Path=/api/mobil/; Max-Age=34560000; Secure; SameSite=None`,
          `hof_device=${SAHTE_CIHAZ}; domain=.destekofis.test; Path=/; Secure`,
          "saldirgan_kendi=1; Path=/; Secure; HttpOnly",
        ],
      });
      res.end("<!doctype html><title>DestekOfis Mobil</title>");
    });
    await new Promise(r => saldirgan.listen(0, "127.0.0.1", r));
    ctx.kapi.tunel(saldirganOfis.id, `http://127.0.0.1:${saldirgan.address().port}`);
    phone = await ctx.paired("admin", ADMIN_PASSWORD);
  });
  after(async () => {
    await ctx?.close();
    await new Promise(r => (saldirgan ? saldirgan.close(() => r()) : r()));
  });

  it("kapıcı başka ofisin kökeninden gelen Domain'li Set-Cookie'leri düşürür (Domain'siz kendi çerezi geçer)", async () => {
    const r = await rawRequest(ctx.kapi.base, "GET", "/mobil/x", { headers: { host: ctx.kapi.ofisHost(saldirganOfis.id), accept: "text/html" } });
    assert.equal(r.status, 200);
    const cerezler = setCookies(r);
    assert.ok(!cerezler.some(c => /;\s*domain\s*=/i.test(c)), `kapıcı Domain= öznitelikli çerezi geçirmemeli: ${JSON.stringify(cerezler)}`);
    assert.ok(cerezler.some(c => c.startsWith("saldirgan_kendi=1")), "Domain'siz (yalnız o adrese ait) çerez geçer");
  });

  it("program cihaz ve oturum çerezini __Host- adla, Secure + Path=/ ve Domain'siz yazar (kapıcı üzerinden)", async () => {
    assert.ok(DEVICE_COOKIE.startsWith("__Host-") && REMOTE_SESSION_COOKIE.startsWith("__Host-"), `çerez adları __Host- önekli olmalı: ${DEVICE_COOKIE}, ${REMOTE_SESSION_COOKIE}`);
    const yeni = ctx.phone();
    const esle = await yeni.pair(await ctx.code("admin"));
    assert.equal(esle.status, 200, esle.text);
    const cerezler = setCookies(esle);
    assert.equal(cerezler.length, 2, JSON.stringify(cerezler));
    for (const satir of cerezler) {
      assert.match(satir, /^__Host-hof_(device|mobil)=/, satir);
      assert.match(satir, /;\s*Secure(;|$)/i, `Secure: ${satir}`);
      assert.match(satir, /;\s*Path=\/(;|$)/i, `Path=/: ${satir}`);
      assert.ok(!/;\s*domain\s*=/i.test(satir), `Domain yok: ${satir}`);
    }
    await ctx.sync.idle();
    assert.equal((await ctx.admin.del(`/api/admin/mobile/devices/${yeni.deviceId}`)).status, 200, "yer açılsın");
    await ctx.sync.idle();
  });

  it("kurbanın isteğine eski (öneksiz) ad ile atılmış çerez erişimi kesmez — başta da sonda da", async () => {
    const kendi = kavanozBasligi(phone);
    const atilan = `hof_device=${SAHTE_CIHAZ}; hof_mobil=${"B".repeat(43)}`;
    const sonda = await rawRequest(ctx.kapi.base, "GET", "/api/mobil/session", { headers: { host: phone.host, cookie: `${kendi}; ${atilan}` } });
    const basta = await rawRequest(ctx.kapi.base, "GET", "/api/mobil/session", { headers: { host: phone.host, cookie: `${atilan}; ${kendi}` } });
    assert.equal(sonda.status, 200, `kurbanın kendi oturumu bozuldu (sonda): ${sonda.text}`);
    assert.equal(basta.status, 200, `kurbanın kendi oturumu bozuldu (başta): ${basta.text}`);
  });

  it("aynı adlı iki cihaz ya da oturum çerezi kapıcıda 400 kapi-cerez (ilk/son seçilmez) — veri ucunda da sayfa yolunda da", async () => {
    const kendi = kavanozBasligi(phone);
    const host = phone.host;
    for (const [ad, cerez] of [
      ["cihaz sonda", `${kendi}; ${DEVICE_COOKIE}=${SAHTE_CIHAZ}`],
      ["cihaz başta", `${DEVICE_COOKIE}=${SAHTE_CIHAZ}; ${kendi}`],
      ["oturum ikinci", `${kendi}; ${REMOTE_SESSION_COOKIE}=${"B".repeat(43)}`],
    ]) {
      const r = await rawRequest(ctx.kapi.base, "GET", "/api/mobil/session", { headers: { host, cookie: cerez } });
      assert.deepEqual([r.status, r.code], [400, "kapi-cerez"], `${ad}: ${r.status} ${r.text.slice(0, 160)}`);
      const sayfa = await rawRequest(ctx.kapi.base, "GET", "/mobil/", { headers: { host, cookie: cerez } });
      assert.equal(sayfa.status, 400, `${ad} (sayfa yolu da): ${sayfa.status}`);
    }
    assert.equal((await phone.get("/api/mobil/session")).status, 200, "tek çerezle erişim sürer");
  });

  it("program da aynı kural: uzak dinleyiciye (kapıcısız) çakışan çerez 400 remote-cookie; tek çerez geçer", async () => {
    const server = await startTestServer({});
    try {
      const remote = await server.app.listenRemote(0, "127.0.0.1");
      const base = `http://127.0.0.1:${remote.port}`;
      const admin = await loginAdmin(server);
      const id = Object.fromEntries((await admin.get("/api/admin/users")).data.data.map(u => [u.username, u.id])).admin;
      assert.equal((await admin.put(`/api/admin/mobile/access/${id}`, { remote: true })).status, 200);
      const tel = createPhone(base);
      const kod = await admin.post("/api/admin/mobile/codes", { userId: id });
      assert.equal((await tel.pair(kod.data.data.code)).status, 200);
      assert.equal((await tel.login("admin", ADMIN_PASSWORD)).status, 200);
      const kendi = kavanozBasligi(tel);
      for (const cerez of [`${kendi}; ${DEVICE_COOKIE}=${SAHTE_CIHAZ}`, `${DEVICE_COOKIE}=${SAHTE_CIHAZ}; ${kendi}`, `${kendi}; ${REMOTE_SESSION_COOKIE}=${"B".repeat(43)}`]) {
        const r = await rawRequest(base, "GET", "/api/mobil/session", { headers: { cookie: cerez } });
        assert.deepEqual([r.status, r.code], [400, "remote-cookie"], `${cerez.slice(0, 60)}…: ${r.status} ${r.text.slice(0, 160)}`);
      }
      assert.equal((await tel.get("/api/mobil/session")).status, 200);
    } finally {
      await server.close();
    }
  });

  it("tek ayrıştırma: kapıcı ve program çerezi aynı modülle okur (lib/mobil-cerez.mjs); kapıcıda ayrı çerez çözücü yok", () => {
    const kapi = readFileSync(new URL("../bulut/kapi/kapi.mjs", import.meta.url), "utf8");
    const program = readFileSync(new URL("../server/lib/mobile-remote.mjs", import.meta.url), "utf8");
    assert.match(kapi, /from "\.\.\/\.\.\/server\/lib\/mobil-cerez\.mjs"/, "kapıcı ortak çerez modülünü içe aktarmalı");
    assert.match(program, /from "\.\/mobil-cerez\.mjs"/, "program ortak çerez modülünü içe aktarmalı");
    assert.ok(!/function\s+cerez\s*\(/.test(kapi), "kapıcıda kendi çerez çözücüsü (ilk eşleşeni alan) kalmamalı");
    assert.ok(!/parseCookies\(/.test(program), "program mobil çerezini son eşleşeni alan genel çözücüyle okumamalı");
  });
});
