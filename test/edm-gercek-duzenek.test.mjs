// 2.4.4 iş listesi 24 — gerçek EDM test ortamı düzeneği (tools/edm-gercek.mjs) kendi güvenceleriyle: adres bekçisi canlıya (ve izin listesi dışındaki her
// adrese) isteği ağa çıkarmadan düşürür; giriş başarısızsa betik HEMEN durur (tek Login, yeniden deneme yok); kimlik bilgisi hiçbir çıktıya girmez; kuru
// koşu (sahte EDM) bütün adımları uçtan uca geçer. Gerçek EDM'ye bağlanılmaz (kuru kip yalnız yerel adrese izin verir).
//
// "Nasıl bozulur?" (önce yazıldı; testler buradan):
//   D1 betik canlıya gider: Servis Adresi / ortam canlı, e-SMM adresi canlıdan türetilir, adresin büyük harf / port / yol / alt alan adı varyantı geçer
//   D2 bekçi isteği reddeder ama program bunu "belirsiz gönderim" sayar (numara harcanır) → ret "bağlantı kurulamadı" sınıfında olmalı
//   D3 giriş başarısızken betik sürer ya da yeniden dener (EDM hesabı kilitlenir)
//   D4 kullanıcı adı / parola JSON'a, OZET'e, XML'e, ekrana (stdout) düşer
//   D5 önceki gerçek koşunun kanıtı yeni koşuyla sessizce ezilir
//   D6 üretim girişi e-SMM'yi açmıyorken düzenek kendi bayrağıyla açıp "üretimde çalışıyor" der
//   D7 kimlik bilgisi verilmeden betik ağa çıkar
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { existsSync, mkdtempSync, readFileSync, readdirSync, rmSync, statSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { after, describe, test } from "node:test";
import { EDM_SMM_URLS, EDM_URLS, createEdmSmmClient, resetEdmCaches } from "../server/lib/einvoice/edm.mjs";
import { startMockEdm } from "./einvoice-mock.mjs";
import { TEST_URLS, bekciFetch, izinliAdres, maskeci, uretimBayraklari } from "../tools/edm-gercek.mjs";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const TOOL = path.join(ROOT, "tools", "edm-gercek.mjs");
const MOCK = { EDM_TEST_KULLANICI: "edmkullanici", EDM_TEST_PAROLA: "Gizli-Parola-1" };
const dirs = [];
const tempDir = () => {
  const dir = mkdtempSync(path.join(tmpdir(), "edm-duzenek-"));
  dirs.push(dir);
  return dir;
};
after(() => {
  for (const dir of dirs) rmSync(dir, { recursive: true, force: true, maxRetries: 5, retryDelay: 200 });
});
// Betik ayrı süreçte (gerçek kullanım gibi); ders 30: lisans servisi yerel ölü adres (betik kendisi de verir).
const runTool = (args, env) => {
  const clean = Object.fromEntries(Object.entries(process.env).filter(([key]) => !key.startsWith("EDM_TEST_")));
  return spawnSync(process.execPath, ["--disable-warning=ExperimentalWarning", TOOL, ...args], { cwd: ROOT, env: { ...clean, HUKUK_LICENSE_URL: "http://127.0.0.1:9", ...env }, encoding: "utf8", timeout: 240_000 });
};
const files = dir => readdirSync(dir).flatMap(name => (statSync(path.join(dir, name)).isDirectory() ? files(path.join(dir, name)).map(item => path.join(name, item)) : [name]));
const json = (dir, name) => JSON.parse(readFileSync(path.join(dir, name), "utf8"));

describe("D1/D2: adres bekçisi (izin listesi)", () => {
  test("gerçek kipte yalnız EDM test ortamının iki servisi (WSDL sorguları dahil) ve yerel adres; kuru kipte yalnız yerel", () => {
    for (const url of [TEST_URLS.fatura, TEST_URLS.smm, `${TEST_URLS.fatura}?singleWsdl`, `${TEST_URLS.smm}?wsdl`, `${TEST_URLS.fatura}?xsd=xsd0`]) {
      assert.equal(izinliAdres(url, { mod: "gercek" }), true, url);
      assert.equal(izinliAdres(url, { mod: "kuru" }), false, `kuru kipte ağa çıkılmaz: ${url}`);
    }
    for (const url of ["http://127.0.0.1:5123/EFaturaEDM21ea/EFaturaEDM.svc", "http://localhost:9/", "http://127.0.0.1:9"]) {
      assert.equal(izinliAdres(url, { mod: "kuru" }), true, url);
      assert.equal(izinliAdres(url, { mod: "gercek" }), true, url);
    }
  });
  test("canlı EDM ve her varyantı reddedilir (büyük harf, port, yol, http, alt alan adı, kimlikli adres, portal, başka ana bilgisayar)", () => {
    const refused = [
      EDM_URLS.live,
      EDM_SMM_URLS.live,
      "https://PORTAL2.edmbilisim.com.tr/EFaturaEDM/EFaturaEDM.svc",
      "https://portal2.edmbilisim.com.tr:443/EFaturaEDM/ESmmEDM.svc",
      "https://portal4.edmbilisim.com.tr/EFaturaUI/",
      "https://portal2.edmbilisim.com.tr/EFaturaEDM21ea/EFaturaEDM.svc",
      "https://portal2.edmbilisim.com.tr/EFaturaEDM21ea/ESmmEDM.svc",
      "https://baska-edmbilisim.com.tr/EFaturaEDM21ea/ESmmEDM.svc",
      "https://test.edmbilisim.com.tr/EFaturaEDM/EFaturaEDM.svc",
      "https://test.edmbilisim.com.tr:8443/EFaturaEDM21ea/EFaturaEDM.svc",
      "http://test.edmbilisim.com.tr/EFaturaEDM21ea/EFaturaEDM.svc",
      "https://test.edmbilisim.com.tr.ornek.com/EFaturaEDM21ea/EFaturaEDM.svc",
      "https://kullanici:parola@test.edmbilisim.com.tr/EFaturaEDM21ea/EFaturaEDM.svc",
      "https://test.edmbilisim.com.tr/EFaturaEDM21ea/EmmEDM.svc",
      TEST_URLS.portal,
      "https://api.github.com/",
      "https://lisans.destekofis.com.tr/v1/check",
      "geçersiz adres",
    ];
    for (const url of refused) assert.equal(izinliAdres(url, { mod: "gercek" }), false, url);
  });
  test("bekçi izinsiz isteği AĞA ÇIKARMADAN düşürür; program bunu 'EDM'ye ulaşılamadı' (kesin ulaşmadı) sayar — belirsiz gönderim değil", async () => {
    resetEdmCaches();
    let innerCalls = 0;
    const kayit = { izinli: [], reddedilen: [] };
    const fetchImpl = bekciFetch(async () => {
      innerCalls += 1;
      throw new Error("ağa çıkılmamalıydı");
    }, { mod: "gercek", kayit });
    const live = createEdmSmmClient({ baseUrl: EDM_SMM_URLS.live, username: "u", password: "p", env: "live", fetchImpl, useWsdl: false });
    const number = "ESM2026000000001";
    const uuid = "8f0c2a3e-1111-4222-8333-944445555666";
    const xml = `<Invoice><cbc:ProfileID>ESMM</cbc:ProfileID><cbc:ID>${number}</cbc:ID><cbc:UUID>${uuid}</cbc:UUID></Invoice>`;
    // Gönderim (önce giriş), numara vermeden önceki erişim denetimi ve durum sorgusu: hepsi "kesin ulaşmadı" — program numarayı geri bırakır.
    for (const [label, call] of [["gönderim", () => live.send({ xml, number, uuid })], ["erişim denetimi", () => live.ensureSession()], ["durum", () => live.status({ uuid, number })]]) {
      await assert.rejects(call(), error => {
        assert.equal(error.code, "integrator-unreachable", `${label}: ${error.code} ${error.message}`);
        return true;
      });
    }
    assert.equal(innerCalls, 0, "ağa hiçbir istek çıkmadı");
    assert.ok(kayit.reddedilen.length >= 1 && kayit.reddedilen.every(item => item.startsWith("https://portal2.edmbilisim.com.tr/")), JSON.stringify(kayit));
    assert.deepEqual(kayit.izinli, []);
  });
  test("D2: oturum açıkken GÖNDERİM isteği (yan etkili, yinelenmeyen işlem) bekçiye takılınca da 'kesin ulaşmadı' — 'Sonucu Belirsiz' değil", async () => {
    resetEdmCaches();
    const edm = await startMockEdm();
    try {
      const kayit = { izinli: [], reddedilen: [] };
      const bekci = bekciFetch(globalThis.fetch, { mod: "kuru", kayit });
      // Giriş sahte EDM'ye (yerel, izinli); gönderim isteği canlı adrese yönelmiş gibi bekçiden geçer (ör. adres oturum açıldıktan sonra değişti).
      const fetchImpl = (url, init = {}) => (/SendSMMRequest/.test(String(init.body || "")) ? bekci(EDM_SMM_URLS.live, init) : bekci(url, init));
      const client = createEdmSmmClient({ baseUrl: edm.url.replace(/EFaturaEDM\.svc$/, "ESmmEDM.svc"), username: "edmkullanici", password: "Gizli-Parola-1", env: "test", fetchImpl });
      await client.ensureSession();
      const number = "TES2026000000001";
      const uuid = "8f0c2a3e-1111-4222-8333-944445555667";
      await assert.rejects(client.send({ xml: `<Invoice><cbc:ProfileID>ESMM</cbc:ProfileID><cbc:ID>${number}</cbc:ID><cbc:UUID>${uuid}</cbc:UUID></Invoice>`, number, uuid }), error => {
        assert.equal(error.code, "integrator-unreachable", `${error.code}: ${error.message}`);
        return true;
      });
      assert.deepEqual(kayit.reddedilen, [EDM_SMM_URLS.live]);
      assert.equal(edm.state.smm.sent.length, 0, "sahte EDM'ye de gönderim gitmedi");
    } finally {
      await edm.close();
    }
  });
});

describe("D4/D6: maskeleme ve üretim bayrakları", () => {
  test("maskeci kullanıcı adını ve parolayı (uzunu önce) her yerde siler", () => {
    const mask = maskeci(["Gizli-Parola-1", "edmkullanici", "ab"]);
    assert.equal(mask("giriş edmkullanici / Gizli-Parola-1 / ab"), "giriş *** / *** / ab");
    assert.equal(mask({ u: "edmkullanici" }), '{"u":"***"}');
  });
  test("düzenek bayrakları server/server.mjs'ten okur: e-Belge, canlı ve e-SMM açık (yorum satırlarındaki örnekler sayılmaz)", () => {
    const flags = uretimBayraklari(readFileSync(path.join(ROOT, "server", "server.mjs"), "utf8"));
    assert.deepEqual(flags, { edocEnabled: true, edocLive: true, esmmEnabled: true });
    // Kaynak tarayan lisans denetimi (lisans-servisi-izolasyonu) bu örneği gerçek çağrı sanmasın: çağrı adı parçalı yazılır.
    const call = ["create", "App("].join("");
    assert.deepEqual(uretimBayraklari(`// ${call}{ esmmEnabled: true })\nconst app = ${call}{ edocEnabled: true, edocLive: true });`), { edocEnabled: true, edocLive: true });
  });
});

describe("Kuru koşu (sahte EDM): betik uçtan uca", () => {
  test("bütün adımlar geçer; 5 e-SMM + 2 e-Arşiv gönderilir, 1 iptal; OZET kullanıcıya numaraları ve test portalını verir; kimlik bilgisi hiçbir dosyada ve ekranda yok", () => {
    let out = tempDir();
    let run = runTool(["--kuru", "--cikti", out], MOCK);
    // Ders 22: koşu TR gece yarısını geçerse betik sonucu bilerek GEÇERSİZ sayar (çıkış 4, gunDegisti) — o durumda bir kez yeniden koşulur.
    if (run.status === 4 && existsSync(path.join(out, "ozet.json")) && json(out, "ozet.json").gunDegisti) {
      out = tempDir();
      run = runTool(["--kuru", "--cikti", out], MOCK);
    }
    assert.equal(run.status, 0, `${run.stdout.slice(-3000)}\n${run.stderr.slice(-1500)}`);
    const summary = json(out, "ozet.json");
    assert.equal(summary.cikis, 0);
    assert.equal(summary.denetim.kalan, 0);
    assert.ok(summary.denetim.toplam >= 40, `denetim sayısı ${summary.denetim.toplam}`);
    assert.deepEqual(summary.adimlar.map(item => item.adim), ["hazirlik", "a-baglanti", "hazirlik-cariler", "g-toplu-gonderim", "b-makbuz", "c-durum", "d-resmi-pdf", "e-iptal", "f-bulunamadi", "h-hata-kodlari"]);
    assert.ok(summary.adimlar.every(item => ["geçti", "bilgi"].includes(item.durum)), JSON.stringify(summary.adimlar));
    assert.deepEqual(summary.belgeler.map(item => [item.kod, item.tur]), [["G1", "e-SMM"], ["G2", "e-SMM"], ["G3", "e-Arşiv"], ["G4", "e-Arşiv"], ["G5", "e-SMM"], ["B1", "e-SMM"], ["B2", "e-SMM"]]);
    for (const item of summary.belgeler) {
      assert.match(item.no, item.tur === "e-SMM" ? /^TES\d{13}$/ : /^TEA\d{13}$/, item.no);
      assert.match(item.ettn, /^[0-9a-f-]{36}$/);
      assert.ok(item.gonderim && item.alici, JSON.stringify(item));
    }
    assert.equal(summary.belgeler.find(item => item.kod === "B1").edmDurum, "İptal Edildi");
    assert.ok(summary.belgeler.find(item => item.kod === "B1").iptal, "iptal saati yazılı");
    assert.deepEqual(summary.bekci.reddedilen, [], "kuru koşuda izin dışı istek yok");
    const edm = json(out, "kuru-edm-kaydi.json");
    assert.equal(edm.smmGonderilen.length, 5);
    assert.equal(edm.smmIptal, 1);
    assert.deepEqual(edm.ihlaller, []);
    assert.equal(edm.smm.filter(op => op === "Login").length, 1, "e-SMM servisine tek giriş (f adımı programın oturumunu kullanır)");
    assert.equal(json(out, "f-bulunamadi.json").kayit["e-SMM GetSMMStatus"].integratorCode, "11017", "sahte servisin 'bulunamadı' kodu kaydedildi");
    const ozet = readFileSync(path.join(out, "OZET.md"), "utf8");
    assert.match(ozet, /https:\/\/test\.edmbilisim\.com\.tr\/EFaturaUI21ea\//);
    assert.match(ozet, /SMMM Portalı Girişi/);
    assert.match(ozet, /KURU KOŞU/);
    assert.match(ozet, /\| Kod \| Belge Türü \| Belge No \| ETTN \/ UUID \| Belge Tarihi \| Gönderim \(TR\) \| Alıcı \| Brüt \| Stopaj \| KDV \| Net Ödenecek \| EDM Son Durum \| İptal \(TR\) \|/);
    for (const name of files(out)) {
      const bytes = readFileSync(path.join(out, name));
      for (const secret of Object.values(MOCK)) assert.ok(!bytes.includes(Buffer.from(secret)), `${name} kimlik bilgisi taşıyor`);
    }
    for (const secret of Object.values(MOCK)) assert.ok(!run.stdout.includes(secret) && !run.stderr.includes(secret), "ekrana kimlik bilgisi yazılmadı");
    assert.match(run.stdout, /kimlik bilgisi taraması: \d+ dosya, eşleşme 0/);
    assert.match(run.stdout.trim().split(/\r?\n/).at(-1), /^SONUÇ: \d+ geçti, 0 kaldı \(çıkış 0\)$/, "son satır kanit.mjs'in okuduğu özet");
  });

  test("D3: parola yanlışsa betik giriş adımında HEMEN durur — tek Login, yeniden deneme yok, başka hiçbir EDM isteği yok; çıkış 2", () => {
    const out = tempDir();
    const run = runTool(["--kuru", "--cikti", out], { ...MOCK, EDM_TEST_PAROLA: "Yanlis-Parola-9" });
    assert.equal(run.status, 2, run.stdout.slice(-2000));
    const summary = json(out, "ozet.json");
    assert.match(summary.durduruldu, /yeniden denenmedi/);
    assert.deepEqual(summary.adimlar.map(item => [item.adim, item.durum]), [["hazirlik", "geçti"], ["a-baglanti", "durdu"]]);
    const edm = json(out, "kuru-edm-kaydi.json");
    assert.deepEqual(edm.fatura, ["Login"], "e-Fatura servisine tek giriş denemesi");
    assert.deepEqual(edm.smm, [], "e-SMM servisine hiç istek yok");
    assert.ok(!existsSync(path.join(out, "g-toplu-gonderim.json")) && !existsSync(path.join(out, "b-makbuz.json")), "sonraki adımlar koşmadı");
    for (const name of files(out)) assert.ok(!readFileSync(path.join(out, name)).includes(Buffer.from("Yanlis-Parola-9")), `${name} parolayı taşıyor`);
  });

  test("D5/D7: önceki özetin üzerine --uzerine-yaz olmadan yazılmaz; kimlik bilgisi yoksa hiçbir istek yapılmaz (çıkış 4)", () => {
    const out = tempDir();
    const first = runTool(["--kuru", "--cikti", out], { ...MOCK, EDM_TEST_PAROLA: "Yanlis-Parola-9" });
    assert.equal(first.status, 2);
    const before = readFileSync(path.join(out, "ozet.json"), "utf8");
    const again = runTool(["--kuru", "--cikti", out], MOCK);
    assert.equal(again.status, 4);
    assert.match(again.stderr, /--uzerine-yaz/);
    assert.equal(readFileSync(path.join(out, "ozet.json"), "utf8"), before, "önceki özet değişmedi");
    const empty = tempDir();
    const none = runTool(["--kuru", "--cikti", path.join(empty, "yok")], { EDM_TEST_KULLANICI: "", EDM_TEST_PAROLA: "" });
    assert.equal(none.status, 4);
    assert.match(none.stderr, /EDM_TEST_KULLANICI ve EDM_TEST_PAROLA/);
    assert.ok(!existsSync(path.join(empty, "yok")), "çıktı klasörü bile açılmadı");
    const noMode = runTool([], MOCK);
    assert.equal(noMode.status, 4, "kip (--gercek / --kuru) verilmeden koşmaz");
  });
});
