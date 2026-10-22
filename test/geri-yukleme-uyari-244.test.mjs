// 2.4.4 madde 30b (kullanıcı kararı 22.10.2026: "yedekten geri yükleyince aslında sık görülen bir durum değil, ilk önerin daha makul"). Bulgu (madde 30 göç
// ajanı, test/guvenilirlik/m30-yeniden-uret.mjs b2): bir şirketin yedeği geri yüklenince yedekten SONRA EDM'ye gönderilmiş e-Arşiv / e-Fatura / e-SMM numarası
// ve verilmiş kâğıt/fiş numarası programda yeniden verilir (EDM 11048 ile reddeder; 2.4.3'te de aynı). Numaralama DEĞİŞMEZ, EDM'den eşitleme YOK; iki güvence:
//   (a) geri yüklemeden sonra Fatura'da TEK SEFERLİK uyarı (yalnız geri yüklenen şirkette; kapatılınca bir daha çıkmaz),
//   (b) 11048 iletisi geri yükleme olasılığını da söyler (test ve canlı seri).
// İşaret geri yüklenen veri tabanında (settings "invoice.restoreNotice"), her geri yüklemede göçten sonra YENİDEN yazılır (lib/company-backups.mjs
// prepareRestoreFile); kapatma işareti siler (routes/invoices.mjs).
//
// "Nasıl bozulur?" (önce yazıldı; testler buradan — not defteri b2-uyari/nasil-bozulur.md):
//   N1 iki şirket: 002 geri yüklenince 001'de (ya da 001 geri yüklenince 002'de) uyarı görünür
//   N2 iki kez geri yükleme / yedeğin içindeki eski işaret: kapatıldıktan sonraki geri yükleme uyarıyı çıkarmaz; bekleyen işaretli yedek eski işaretle gelir
//   N3 eski sürümün yedeği (göç geri yüklemede koşar): göç işareti ezer
//   N4 Şirket Verisini Sıfırla geri yükleme sayılır (uyarı çıkar) ya da bekleyen uyarıyı siler
//   N5 kapatıldıktan sonra program yeniden açılınca uyarı geri gelir
//   N6 e-Belge kullanmayan şirkette EDM cümlesi
//   N7 yetkisiz kullanıcı: Fatura'yı görmeyen uyarıyı alır; Fatura Ayarları yetkisi olmayan kapatır
//   N8 iki oturum: ikinci kapatma hata verir; eski ekrandaki "Kapat" yeni geri yüklemenin uyarısını kapatır
//   N9 geri yükleme yarıda kalır (bozuk yedek, vazgeçilen / uygulanamayan 001 geri yüklemesi): uyarı yine yazılır
//   N10 001 geri yüklemesinde ortak katman aktarımı işareti ezer
// Sahte EDM (test/einvoice-mock.mjs); ağa çıkmaz; sahte saat (ders 13); ders 30 lisans adresi.
import assert from "node:assert/strict";
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { after, before, describe, test } from "node:test";
import { parseBackupName } from "../server/lib/backup.mjs";
import { createClock } from "../server/lib/clock.mjs";
import { resetEdmCaches } from "../server/lib/einvoice/edm.mjs";
import { OUR_VKN, startMockEdm } from "./einvoice-mock.mjs";
import { ADMIN_PASSWORD } from "./helpers.mjs";
import { CURRENT, bootVersion, tagsAvailable } from "./guvenilirlik/surumler.mjs";

const SELLER = { name: "Deneme Ofis Ltd.", taxNo: OUR_VKN, taxOffice: "Çankaya", address: "Atatürk Blv. 1", district: "Çankaya", city: "Ankara", email: "bilgi@deneme.com.tr" };
const PERSON = { name: "Ayşe Kaya", type: "customer", partyKind: "person", firstName: "Ayşe", familyName: "Kaya", taxNo: "10000000146", taxOffice: "Konak", address: "Kordon 1", district: "Konak", city: "İzmir", email: "ayse@example.com" };
const KEY = "invoice.restoreNotice";
const stampIso = name => parseBackupName(name).stamp.replace(/^(\d{4}-\d{2}-\d{2})T(\d{2})-(\d{2})-(\d{2})-(\d{3})Z$/, "$1T$2:$3:$4.$5Z");
const at = (days, hour = 10) => new Date(2026, 5, 17 + days, hour, 0, 0).getTime();
const must = async (label, promise, status = 200) => {
  const res = await promise;
  assert.equal(res.status, status, `${label}: ${res.status} ${JSON.stringify(res.data).slice(0, 400)}`);
  return res.data;
};
// Alan yoksa (eski kod) "uyarı yok" sayılır: kırmızı, uyarının BEKLENDİĞİ yerde düşer (ders 38); uyarı olmaması gereken yerler mutasyonla sınanır.
const noticeOf = async (api, q = "") => (await must("liste", api.get(`/api/workspace/invoices${q}`))).restoreNotice ?? null;

describe("Geri yüklemeden sonra Fatura'da tek seferlik numara uyarısı; 11048 iletisi geri yüklemeyi söyler", () => {
  const root = mkdtempSync(path.join(tmpdir(), "geri-yukleme-uyari-244-"));
  const clock = createClock({ time: at(0), fixed: true });
  let edm;
  let cur = null;
  const ids = {};
  const dirs = () => ({ dataDir: path.join(root, "data"), backupDir: path.join(root, "backups"), env: { HUKUK_LICENSE_URL: "http://127.0.0.1:9" }, edocEnabled: true, testSeriesStart: () => 1, edocStatusPollMs: [5, 5], now: clock });
  const boot = async () => {
    await cur?.close();
    cur = await bootVersion(CURRENT, dirs());
    return cur;
  };
  const q002 = () => `?hofCompany=${encodeURIComponent(ids.second)}`;
  const backupOf = async (api, companyId) => (await must("yedek", api.post("/api/admin/backups", { scope: "one", companyId }))).name;
  const restore002 = (api, name) => api.post("/api/admin/backups/restore", { name, company: ids.second, confirm: "002", password: ADMIN_PASSWORD });
  // 001: geri yükleme hazırlanır, sunucu yeniden açılırken uygulanır.
  const restore001 = async name => {
    const api = await cur.login();
    const staged = await must("001 geri yükle", api.post("/api/admin/backups/restore", { name, company: "sirket-001", confirm: "001", password: ADMIN_PASSWORD }));
    assert.equal(staged.staged, true);
    await boot();
    assert.equal(cur.app.stagedRestore?.ok, true, JSON.stringify(cur.app.stagedRestore));
    return cur.login();
  };

  before(async () => {
    resetEdmCaches();
    edm = await startMockEdm();
    await boot();
    const api = await cur.login();
    await api.post("/api/workspace/bank/setup/dismiss", {});
    await must("001 ayar", api.put("/api/workspace/invoices/settings", { seller: SELLER, efatura: true, earsiv: true, integrator: { env: "test", baseUrl: edm.url, username: "edmkullanici", password: "Gizli-Parola-1", senderAlias: "urn:mail:defaultgb@deneme.com.tr" } }));
    ids.person = (await must("cari", api.post("/api/workspace/accounts", PERSON))).id;
    // 002: e-Belge kullanmayan şirket (yalnız kâğıt belge / müşteri fişi).
    const second = await must("002", api.post("/api/companies", { name: "İkinci Büro", select: false }));
    ids.second = (second.company || second).id;
    await must("002 ayar", api.put(`/api/workspace/invoices/settings${q002()}`, { seller: { ...SELLER, name: "İkinci Büro Ltd." } }));
    ids.person2 = (await must("002 cari", api.post(`/api/workspace/accounts${q002()}`, PERSON))).id;
    for (const role of ["avukat", "personel"]) await must(`kullanıcı ${role}`, api.post("/api/admin/users", { username: `uyari-${role}`, name: `Uyarı ${role}`, role, password: "Uyari-Parola-2026!", mustChangePassword: false }));
  });
  after(async () => {
    await cur?.close();
    await edm?.close();
    rmSync(root, { recursive: true, force: true });
  });

  test("N1/N6 002 geri yüklenince uyarı yalnız 002'de; e-Belge kullanmayan şirkette edoc=false (yalnız kâğıt/fiş cümlesi); 001'de yok", async () => {
    const api = await cur.login();
    assert.equal(await noticeOf(api), null, "001 başta");
    assert.equal(await noticeOf(api, q002()), null, "002 başta");
    const name = await backupOf(api, ids.second);
    const result = await must("002 geri yükle", restore002(api, name));
    assert.equal(result.restored, true);
    const notice = await noticeOf(api, q002());
    assert.ok(notice, "002'de geri yüklemeden sonra uyarı var");
    assert.equal(notice.edoc, false, "002 e-Belge kullanmıyor");
    assert.equal(notice.test, false);
    assert.equal(notice.canDismiss, true, "yönetici kapatır");
    assert.equal(notice.backupAt, stampIso(name), "yedeğin tarihi");
    assert.equal(await noticeOf(api), null, "001'de uyarı yok");
  });

  test("N8 iki oturum: eski işaretle kapatma yeni uyarıyı kapatmaz; birinci kapatır, ikincinin kapatması hata vermez; liste yenilenince ikisinde de yok", async () => {
    const a = await cur.login();
    const b = await cur.login();
    const notice = await noticeOf(a, q002());
    const stale = await must("eski işaret", a.post(`/api/workspace/invoices/restore-notice/dismiss${q002()}`, { at: "2000-01-01T00:00:00.000Z" }));
    assert.equal(stale.dismissed, false, "ekrandaki uyarı başka geri yüklemenin");
    assert.equal(stale.restoreNotice?.at, notice.at, "uyarı kaldı");
    assert.equal((await must("A kapatır", a.post(`/api/workspace/invoices/restore-notice/dismiss${q002()}`, { at: notice.at }))).dismissed, true);
    const second = await must("B kapatır", b.post(`/api/workspace/invoices/restore-notice/dismiss${q002()}`, { at: notice.at }));
    assert.equal(second.dismissed, false);
    assert.equal(second.restoreNotice, null);
    assert.equal(await noticeOf(b, q002()), null);
    assert.equal(await noticeOf(a, q002()), null);
  });

  test("N5 kapatılan uyarı program yeniden açılınca geri gelmez", async () => {
    await boot();
    const api = await cur.login();
    assert.equal(await noticeOf(api, q002()), null);
    assert.equal(await noticeOf(api), null);
  });

  test("N1/N10 001 geri yüklenince (sunucu yeniden açılırken, ortak katman aktarılır) uyarı 001'de, edoc=true + Test Ortamı; 002'de yok", async () => {
    const api = await cur.login();
    ids.backup001 = await backupOf(api, "sirket-001");
    const after = await restore001(ids.backup001);
    const notice = await noticeOf(after);
    assert.ok(notice, "001'de uyarı var");
    assert.deepEqual([notice.edoc, notice.test, notice.canDismiss], [true, true, true]);
    assert.equal(notice.backupAt, stampIso(ids.backup001));
    assert.equal(await noticeOf(after, q002()), null, "002'de uyarı yok");
    ids.notice001 = notice;
  });

  test("N7 yetki: Fatura Ayarları yetkisi olmayan (avukat) uyarıyı görür ama kapatamaz (403); Fatura'yı görmeyen (personel) listeyi alamaz", async () => {
    const avukat = await cur.login("uyari-avukat", "Uyari-Parola-2026!");
    const seen = await noticeOf(avukat);
    assert.equal(seen?.at, ids.notice001.at);
    assert.equal(seen.canDismiss, false);
    await must("avukat kapatamaz", avukat.post("/api/workspace/invoices/restore-notice/dismiss", { at: seen.at }), 403);
    const personel = await cur.login("uyari-personel", "Uyari-Parola-2026!");
    await must("personel Fatura'yı görmez", personel.get("/api/workspace/invoices"), 403);
    await must("personel kapatamaz", personel.post("/api/workspace/invoices/restore-notice/dismiss", {}), 403);
    assert.equal((await noticeOf(await cur.login()))?.at, ids.notice001.at, "uyarı yerinde");
  });

  test("N2 uyarı beklerken alınan yedek (içinde eski işaret) geri yüklenince işaret YENİDEN yazılır; kapatıldıktan sonraki geri yükleme uyarıyı yeniden çıkarır", async () => {
    let api = await cur.login();
    const withFlag = await backupOf(api, "sirket-001");
    await must("kapat", api.post("/api/workspace/invoices/restore-notice/dismiss", { at: ids.notice001.at }));
    assert.equal(await noticeOf(api), null);
    clock.set(at(1));
    api = await restore001(withFlag);
    const notice = await noticeOf(api);
    assert.ok(notice, "kapatıldıktan sonraki geri yükleme uyarıyı yeniden çıkarır");
    assert.notEqual(notice.at, ids.notice001.at, "yedeğin içindeki eski işaret değil, bu geri yüklemenin işareti");
    assert.equal(notice.backupAt, stampIso(withFlag));
    ids.notice001 = notice;
  });

  test("N4 Şirket Verisini Sıfırla geri yükleme değildir: uyarı çıkarmaz (002) ve bekleyen uyarıyı silmez (001 Tümünü Sıfırla)", async () => {
    const api = await cur.login();
    await must("002 sıfırla", api.post(`/api/companies/${encodeURIComponent(ids.second)}/reset`, { mode: "movements", confirm: "002", password: ADMIN_PASSWORD }));
    assert.equal(await noticeOf(api, q002()), null, "sıfırlama uyarı yazmaz");
    await must("001 sıfırla", api.post("/api/companies/sirket-001/reset", { mode: "all", confirm: "001", password: ADMIN_PASSWORD }));
    assert.equal((await noticeOf(api))?.at, ids.notice001.at, "Tümünü Sıfırla bekleyen uyarıyı silmez (yeniden numara riski sürer)");
    await must("kapat", api.post("/api/workspace/invoices/restore-notice/dismiss", { at: ids.notice001.at }));
  });

  test("N9 yarıda kalan geri yükleme uyarı yazmaz: bozuk yedek (002), vazgeçilen 001, açılışta uygulanamayan 001", async () => {
    let api = await cur.login();
    const taken = (await must("yedek", api.post("/api/admin/backups", { scope: "one", companyId: ids.second }))).backups[0];
    const name002 = taken.name;
    writeFileSync(path.join(taken.folder, name002), "bozuk yedek");
    const bad = await restore002(api, name002);
    assert.notEqual(bad.status, 200, "bozuk yedek reddedilir");
    assert.equal(await noticeOf(api, q002()), null, "002'de uyarı yok");
    // 001: hazırlanıp vazgeçilen geri yükleme.
    const name001 = await backupOf(api, "sirket-001");
    await must("hazırla", api.post("/api/admin/backups/restore", { name: name001, company: "sirket-001", confirm: "001", password: ADMIN_PASSWORD }));
    assert.equal((await must("vazgeç", api.del("/api/admin/backups/restore"))).cancelled, true);
    await boot();
    assert.equal(cur.app.stagedRestore, null);
    api = await cur.login();
    assert.equal(await noticeOf(api), null, "vazgeçilen geri yükleme uyarı yazmaz");
    // 001: hazırlanan kopya kaybolur → açılışta uygulanamaz (sunucu mevcut veriyle açılır).
    await must("hazırla", api.post("/api/admin/backups/restore", { name: name001, company: "sirket-001", confirm: "001", password: ADMIN_PASSWORD }));
    rmSync(path.join(root, "data", "geri-yukleme"), { recursive: true, force: true });
    await boot();
    assert.equal(cur.app.stagedRestore?.ok, false, JSON.stringify(cur.app.stagedRestore));
    api = await cur.login();
    assert.equal(await noticeOf(api), null, "uygulanamayan geri yükleme uyarı yazmaz");
    assert.equal(cur.app.store.get("SELECT COUNT(*) AS n FROM settings WHERE key = ?", KEY).n, 0);
  });

  test("11048 (test serisi): ileti test hesabının ortaklığını VE yedekten geri yükleme olasılığını söyler; İptal Et yolu durur", async () => {
    const api = await cur.login();
    const person = (await must("cari", api.post("/api/workspace/accounts", PERSON))).id;
    const doc = await must("satış", api.post("/api/workspace/invoices", { scenario: "service_sale", accountId: person, lines: [{ name: "Danışmanlık", qty: 1, unitPrice: 500, vatRate: 20 }], payment: { rest: "open" }, eSend: "later" }));
    const next = (await must("ayar", api.get("/api/workspace/invoices/settings"))).testNumbers?.earsiv?.number;
    assert.match(String(next), /^TEA/);
    edm.state.usedIds.add(next);
    const sent = await api.post(`/api/workspace/invoices/${doc.id}/send`, {});
    assert.notEqual(sent.status, 200);
    const message = JSON.stringify(sent.data);
    assert.match(message, /11048/);
    assert.match(message, /ortak/);
    assert.match(message, /yedekten geri yükleme yaptıysanız bu numarayla yedekten sonra siz göndermiş olabilirsiniz/, message.slice(-400));
    assert.match(message, /İptal Et/);
  });
});

describe("11048 (canlı seri): ileti yedekten geri yükleme olasılığını söyler ve sıradaki numarayı EDM'deki son numaranın ilerisine aldırır", () => {
  const root = mkdtempSync(path.join(tmpdir(), "geri-yukleme-uyari-244-canli-"));
  let edm;
  let cur;
  before(async () => {
    resetEdmCaches();
    edm = await startMockEdm();
    const live = new URL("https://portal2.edmbilisim.com.tr");
    // Canlı EDM adresi sahte EDM'ye yönlenir; başka hiçbir adrese çıkılmaz.
    const fetchImpl = async (input, init) => {
      const url = new URL(String(typeof input === "string" || input instanceof URL ? input : input.url));
      if (url.host === live.host) return globalThis.fetch(`${edm.url.replace(/\/EFaturaEDM21ea\/EFaturaEDM\.svc$/, "")}${url.pathname}${url.search}`, init);
      if (url.hostname !== "127.0.0.1") throw new Error(`ağa çıkılmaz (test): ${url}`);
      return globalThis.fetch(input, init);
    };
    cur = await bootVersion(CURRENT, { dataDir: path.join(root, "data"), backupDir: path.join(root, "backups"), env: { HUKUK_LICENSE_URL: "http://127.0.0.1:9" }, edocEnabled: true, edocLive: true, fetchImpl, edocStatusPollMs: [5, 5], now: createClock({ time: at(0), fixed: true }) });
  });
  after(async () => {
    await cur?.close();
    await edm?.close();
    rmSync(root, { recursive: true, force: true });
  });
  test("canlı e-Arşiv numarası EDM'de kullanılmış → Hata + ileti", async () => {
    const api = await cur.login();
    await api.post("/api/workspace/bank/setup/dismiss", {});
    await must("ayar", api.put("/api/workspace/invoices/settings", { seller: SELLER, efatura: true, earsiv: true, integrator: { env: "live", baseUrl: "", username: "edmkullanici", password: "Gizli-Parola-1", senderAlias: "urn:mail:defaultgb@deneme.com.tr" } }));
    const person = (await must("cari", api.post("/api/workspace/accounts", PERSON))).id;
    const doc = await must("satış", api.post("/api/workspace/invoices", { scenario: "service_sale", accountId: person, lines: [{ name: "Danışmanlık", qty: 1, unitPrice: 500, vatRate: 20 }], payment: { rest: "open" }, eSend: "later" }));
    const next = (await must("ayar", api.get("/api/workspace/invoices/settings"))).nextNumbers.earsiv.number;
    assert.doesNotMatch(String(next), /^TE[FAS]/, "canlı seri");
    edm.state.usedIds.add(next);
    const sent = await api.post(`/api/workspace/invoices/${doc.id}/send`, {});
    assert.notEqual(sent.status, 200, JSON.stringify(sent.data).slice(0, 300));
    const message = JSON.stringify(sent.data);
    assert.match(message, /11048/);
    assert.match(message, /yedekten geri yükleme yaptıysanız bu numarayla yedekten sonra siz göndermiş olabilirsiniz/, message.slice(-400));
    assert.match(message, /Fatura Ayarları → Numaralar'dan sıradaki numarayı EDM'deki son numaranın ilerisine alın/);
    assert.doesNotMatch(message, /ortak/, "canlıda test hesabı cümlesi yok");
    assert.equal((await must("kart", api.get(`/api/workspace/invoices/${doc.id}`))).eStatus, "error");
  });
});

describe("N3 eski sürümün (v2.4.3) yedeği geri yüklenince göçten sonra uyarı yazılır", { skip: !tagsAvailable(["v2.4.3"]) && "v2.4.3 etiketi yok (git fetch --tags)" }, () => {
  const root = mkdtempSync(path.join(tmpdir(), "geri-yukleme-uyari-244-eski-"));
  const dirs = { dataDir: path.join(root, "data"), backupDir: path.join(root, "backups"), env: { HUKUK_LICENSE_URL: "http://127.0.0.1:9" } };
  let cur;
  let name;
  before(async () => {
    const old = await bootVersion("v2.4.3", { ...dirs, now: createClock({ time: at(0), fixed: true }) });
    try {
      const api = await old.login();
      await must("ayar", api.put("/api/workspace/invoices/settings", { seller: SELLER }));
      const person = (await must("cari", api.post("/api/workspace/accounts", PERSON))).id;
      const paper = await must("kâğıt fatura", api.post("/api/workspace/invoices", { scenario: "service_sale", accountId: person, lines: [{ name: "Danışmanlık", qty: 1, unitPrice: 500, vatRate: 20 }], payment: { rest: "open" } }));
      assert.match(paper.number, /^FIS2026/);
      name = (await must("yedek", api.post("/api/admin/backups", { scope: "one", companyId: "sirket-001" }))).name;
    } finally {
      await old.close();
    }
    cur = await bootVersion(CURRENT, { ...dirs, now: createClock({ time: at(1), fixed: true }) });
  });
  after(async () => {
    await cur?.close();
    rmSync(root, { recursive: true, force: true });
  });
  test("güncellemeden sonra uyarı yok; v2.4.3 yedeği geri yüklenince var (edoc=false)", async () => {
    let api = await cur.login();
    assert.equal(await noticeOf(api), null, "güncelleme geri yükleme değildir");
    await must("hazırla", api.post("/api/admin/backups/restore", { name, company: "sirket-001", confirm: "001", password: ADMIN_PASSWORD }));
    await cur.close();
    cur = await bootVersion(CURRENT, { ...dirs, now: createClock({ time: at(1), fixed: true }) });
    assert.equal(cur.app.stagedRestore?.ok, true, JSON.stringify(cur.app.stagedRestore));
    api = await cur.login();
    const notice = await noticeOf(api);
    assert.ok(notice, "uyarı var");
    assert.equal(notice.edoc, false);
    assert.equal(notice.backupAt, stampIso(name));
    assert.equal((await must("liste", api.get("/api/workspace/invoices"))).invoices.length, 1, "yedeğin faturası geldi");
  });
});
