// 2.4.4 iş listesi 24b — N4: EDM girişi TEK UÇUŞ (server/lib/einvoice/edm.mjs edmTransport). Gerçek EDM test ortamı (22.10.2026, ana oturum,
// docs/kanit/2026-10-22/244-edm-eszamanli/gercek): oturum önbelleği boşken 20 eşzamanlı e-SMM gönderimi 20 giriş yaptı (en çok 18 aynı anda); EDM birini
// "The caller was not authenticated by the service." ile reddetti ve belge "kullanıcı adı/parola" iletisiyle Gönderilecekler'e düştü (19 giriş aynı kimlikle
// başarılıydı). Kural (baş mimar): oturum anahtarı başına en çok bir giriş sürer; withSession, ensureSession ve test aynı girişi bekler; giriş bitince kayıt
// silinir; başarısızlık bütün bekleyenlere aynı hatayla döner (B3: numara ancak giriş başarılıysa); sessionExpired'de önbellek yalnız hata veren oturumu
// tutuyorsa silinir, daha yeni geçerli oturum varsa girişsiz o kullanılır. e-Fatura ve e-SMM aynı taşıma katmanı.
//
// "Nasıl bozulur?" (önce yazıldı: docs/kanit/2026-10-22/244-edm-eszamanli/NOT.md → N4 düzeltmesi, T1–T10):
//   T1 soğuk önbellekte eşzamanlı çağrılar ayrı giriş yapar (gönderim, ensureSession, e-Fatura mükellef sorgusu)
//   T2 bekleyen giriş başarısız olunca kayıt kalır, sonraki çağrı hiç yeniden denemez · T3 başarısızlık bekleyenlerden birine ulaşmaz / başarı sayılır
//   T4 giriş sürerken parola değişir → yeni parolanın çağrısı eski parolanın girişini bekler · T5 giriş askıda kalır → bekleyenler sonsuza dek bekler
//   T6 tek oturumlu EDM'de eşzamanlı yeniden girişler birbirini düşürür · T7 sessionExpired'de daha yeni oturum koşulsuz silinir
//   T8 Bağlantıyı Test Et ile gönderim aynı anda iki giriş · T9 resetEdmCaches bekleyen girişi temizlemez
// T4 ve T9 KORUMA testidir (eski kodda da yeşil — eski kodda tek uçuş yoktu); dişleri mutasyonla gösterilir (anahtarsız tek uçuş, temizlenmeyen kayıt).
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { afterEach, beforeEach, describe, test } from "node:test";
import { createEdmClient, createEdmSmmClient, resetEdmCaches } from "../server/lib/einvoice/edm.mjs";
import { BUYER_VKN, startMockEdm } from "./einvoice-mock.mjs";

const USER = "edmkullanici";
const PASS = "Gizli-Parola-1";
const sleep = ms => new Promise(resolve => setTimeout(resolve, ms));
// Girişi yavaşlatan fetch (çağrılar çakışsın — ders 20: ön koşul zorla); girişleri sayar.
const slowLogin = (ms, counter = { n: 0 }) => {
  const fetchImpl = async (url, init = {}) => {
    if (/LoginRequest/.test(String(init.body || ""))) {
      counter.n += 1;
      await sleep(ms);
    }
    return fetch(url, init);
  };
  return Object.assign(fetchImpl, { counter });
};
const smmXml = (number, uuid) => `<Invoice><cbc:ProfileID>ESMM</cbc:ProfileID><cbc:ID>${number}</cbc:ID><cbc:UUID>${uuid}</cbc:UUID></Invoice>`;
const sendOne = (client, i) => {
  const number = `TES2026${String(100000000 + i).padStart(9, "0")}`;
  const uuid = randomUUID();
  return client.send({ xml: smmXml(number, uuid), number, uuid, issueDate: "2026-10-22", senderVkn: "3230512384", senderAlias: "urn:mail:defaultgb@edmbilisim.com.tr", receiverVkn: BUYER_VKN });
};

let edm;
let smmUrl;
const smmLogins = () => edm.state.smm.calls.filter(call => call.op === "Login").length;
const faturaLogins = () => edm.state.calls.filter(call => call.op === "Login").length;
const smmClient = (options = {}) => createEdmSmmClient({ baseUrl: smmUrl, username: USER, password: PASS, env: "test", ...options });
beforeEach(async () => {
  resetEdmCaches();
  edm = await startMockEdm();
  smmUrl = edm.url.replace(/EFaturaEDM\.svc$/, "ESmmEDM.svc");
});
afterEach(async () => {
  resetEdmCaches();
  await edm.close();
});

describe("N4 tek uçuş giriş: soğuk önbellek, eşzamanlı çağrılar", () => {
  test("T1 e-SMM: 20 eşzamanlı gönderim TEK giriş yapar, 20'si iletilir", async () => {
    const client = smmClient({ fetchImpl: slowLogin(150) });
    const results = await Promise.allSettled(Array.from({ length: 20 }, (_, i) => sendOne(client, i)));
    const rejected = results.filter(item => item.status === "rejected").map(item => item.reason?.message);
    assert.deepEqual(rejected, [], "bütün gönderimler iletildi");
    assert.equal(smmLogins(), 1, `e-SMM servisine Login sayısı ${smmLogins()}; beklenen 1 (tek uçuş)`);
    assert.equal(edm.state.smm.sent.length, 20);
    assert.deepEqual(edm.state.smm.violations, []);
  });
  test("T1 numara öncesi erişim denetimi (ensureSession) × 20 eşzamanlı: tek giriş, hepsi başarılı", async () => {
    const client = smmClient({ fetchImpl: slowLogin(150) });
    await Promise.all(Array.from({ length: 20 }, () => client.ensureSession()));
    assert.equal(smmLogins(), 1, `Login sayısı ${smmLogins()}; beklenen 1`);
  });
  test("T1 e-Fatura (aynı taşıma katmanı): 20 eşzamanlı mükellef sorgusu tek giriş yapar", async () => {
    const client = createEdmClient({ baseUrl: edm.url, username: USER, password: PASS, env: "test", fetchImpl: slowLogin(150) });
    const answers = await Promise.all(Array.from({ length: 20 }, () => client.checkUser(BUYER_VKN)));
    assert.ok(answers.every(item => item.registered === true));
    assert.equal(faturaLogins(), 1, `e-Fatura servisine Login sayısı ${faturaLogins()}; beklenen 1`);
  });
  test("T10 (gerçek EDM'de görülen): başka giriş sürerken gelen giriş reddedilir — tek uçuşla 20 gönderimin hiçbiri reddedilmez", async () => {
    edm.state.smm.rejectConcurrentLogin = true;
    // Sahte EDM'de giriş yanıtı gecikir: girişler EDM tarafında çakışabilsin (ön koşul zorla).
    edm.state.smm.delay = op => (op === "Login" ? 150 : 0);
    const client = smmClient();
    const results = await Promise.allSettled(Array.from({ length: 20 }, (_, i) => sendOne(client, i)));
    const rejected = results.filter(item => item.status === "rejected").map(item => item.reason?.message);
    assert.deepEqual(rejected, [], `reddedilen gönderim: ${rejected.length} (${rejected[0] || ""})`);
    assert.equal(edm.state.smm.concurrentLoginRejected, 0, "EDM'ye çakışan giriş gitmedi");
  });
});

describe("N4: başarısız, askıda ve farklı anahtarlı giriş", () => {
  test("T2/T3 giriş reddedilince 5 bekleyenin HEPSİ aynı hatayı alır (tek Login, stage login); kayıt silinir, SONRAKİ çağrı yeniden dener", async () => {
    const client = smmClient({ password: "Yanlis-Parola-9", fetchImpl: slowLogin(150) });
    const results = await Promise.allSettled(Array.from({ length: 5 }, () => client.ensureSession()));
    assert.ok(results.every(item => item.status === "rejected"), "hiçbiri başarı sayılmadı (B3)");
    assert.deepEqual([...new Set(results.map(item => `${item.reason.code}|${item.reason.stage}|${item.reason.integratorCode}`))], ["integrator-rejected|login|2001"]);
    assert.equal(smmLogins(), 1, `Login sayısı ${smmLogins()}; beklenen 1`);
    await assert.rejects(client.ensureSession(), error => error.stage === "login");
    assert.equal(smmLogins(), 2, "başarısız giriş kaydı silindi: sonraki çağrı yeniden giriş denedi");
  });
  test("T5 giriş askıda kalır: zaman aşımı BÜTÜN bekleyenlere döner (tek deneme), sonra yeni giriş başlar ve başarılı olur", async () => {
    let attempts = 0;
    let hang = true;
    const fetchImpl = (url, init = {}) => {
      if (/LoginRequest/.test(String(init.body || ""))) {
        attempts += 1;
        if (hang) return new Promise((resolve, reject) => init.signal.addEventListener("abort", () => reject(Object.assign(new Error("aborted"), { name: "AbortError" }))));
      }
      return fetch(url, init);
    };
    const client = smmClient({ fetchImpl, timeoutMs: 400 });
    const results = await Promise.allSettled(Array.from({ length: 5 }, () => client.ensureSession()));
    assert.ok(results.every(item => item.status === "rejected" && item.reason.code === "integrator-unreachable"), JSON.stringify(results.map(item => item.reason?.code)));
    assert.equal(attempts, 1, `askıdaki giriş denemesi ${attempts}; beklenen 1 (bekleyenler aynı girişi bekledi)`);
    hang = false;
    await client.ensureSession();
    assert.equal(attempts, 2, "askıdaki girişin kaydı silindi: yeni giriş başladı");
    assert.equal(smmLogins(), 1, "yeni giriş EDM'ye ulaştı");
  });
  test("T4 (koruma) giriş sürerken parola değişir: yeni parolanın çağrısı eskisinin girişini BEKLEMEZ — iki ayrı giriş, her biri kendi sonucu", async () => {
    const right = smmClient({ fetchImpl: slowLogin(150) });
    const wrong = smmClient({ password: "Yanlis-Parola-9", fetchImpl: slowLogin(150) });
    const [ok, bad] = await Promise.allSettled([right.ensureSession(), wrong.ensureSession()]);
    assert.equal(ok.status, "fulfilled");
    assert.equal(bad.status, "rejected");
    assert.equal(bad.reason.integratorCode, "2001");
    assert.equal(smmLogins(), 2);
  });
});

describe("N4: oturum düşünce yeniden giriş, Bağlantıyı Test Et, önbellek boşaltma", () => {
  test("T6/T7 tek oturumlu EDM, oturum EDM'de düştü: 20 eşzamanlı gönderim TEK yeniden giriş yapar (daha yeni oturum girişsiz kullanılır), 20'si iletilir", async () => {
    const client = smmClient({ fetchImpl: slowLogin(150) });
    await client.ensureSession();
    assert.equal(smmLogins(), 1);
    edm.state.smm.singleSession = true;
    edm.state.smm.sessions.clear(); // EDM oturumu düşürdü (ör. başka yerde giriş); programın önbelleği hâlâ eski oturumu tutuyor
    const results = await Promise.allSettled(Array.from({ length: 20 }, (_, i) => sendOne(client, i)));
    const rejected = results.filter(item => item.status === "rejected").map(item => item.reason?.message);
    assert.deepEqual(rejected, [], `düşen gönderim ${rejected.length}`);
    assert.equal(smmLogins() - 1, 1, `yeniden giriş sayısı ${smmLogins() - 1}; beklenen 1`);
    assert.equal(edm.state.smm.sent.length, 20);
  });
  test("T7 eski oturumla düşen istek, önbellekte DAHA YENİ geçerli oturum varken onu girişsiz kullanır (koşulsuz silip yeniden girmez)", async () => {
    // İstek eski oturumla (S1) yoldayken Bağlantıyı Test Et yeni oturum (S2) açar; tek oturumlu EDM S1'i düşürür; istek 10011 alır.
    let delaySend = true;
    const fetchImpl = async (url, init = {}) => {
      if (delaySend && /SendSMMRequest/.test(String(init.body || ""))) await sleep(300);
      return fetch(url, init);
    };
    const client = smmClient({ fetchImpl });
    await client.ensureSession();
    edm.state.smm.singleSession = true;
    const inFlight = sendOne(client, 7);
    await sleep(50);
    await client.test();
    const sent = await inFlight;
    delaySend = false;
    assert.equal(sent.status, "sent");
    assert.equal(smmLogins(), 2, `Login sayısı ${smmLogins()}; beklenen 2 (ilk giriş + Bağlantıyı Test Et; düşen istek yeni oturumu girişsiz kullandı)`);
  });
  test("T8 Bağlantıyı Test Et ile gönderim aynı anda (soğuk): tek giriş, ikisi de başarılı", async () => {
    const client = smmClient({ fetchImpl: slowLogin(300) });
    const [tested, sent] = await Promise.all([client.test(), sendOne(client, 1)]);
    assert.equal(tested.ok, true);
    assert.equal(sent.status, "sent");
    assert.equal(smmLogins(), 1, `Login sayısı ${smmLogins()}; beklenen 1`);
  });
  test("T9 (koruma) resetEdmCaches bekleyen girişi de temizler: sonraki çağrı askıdaki girişi beklemez", async () => {
    let hang = true;
    const fetchImpl = (url, init = {}) => (hang && /LoginRequest/.test(String(init.body || "")) ? new Promise((resolve, reject) => init.signal.addEventListener("abort", () => reject(Object.assign(new Error("aborted"), { name: "AbortError" })))) : fetch(url, init));
    const client = smmClient({ fetchImpl, timeoutMs: 3000 });
    const stuck = client.ensureSession().catch(error => error);
    await sleep(50);
    resetEdmCaches();
    hang = false;
    const started = Date.now();
    await client.ensureSession();
    assert.ok(Date.now() - started < 1500, `önbellek boşaltıldıktan sonraki giriş askıdakini bekledi (${Date.now() - started} ms)`);
    assert.equal((await stuck).code, "integrator-unreachable");
  });
});
