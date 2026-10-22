// 2.4.4 (karar 22.10.2026, numara tekil — test/numara-tekil-244.test.mjs) ESKİ SÜRÜM VERİSİYLE: 2.4.0–2.4.3'te bırakılıp e-Belge olarak gönderilen belgenin
// Müşteri Fişi numarası seriden ayrılınca hiçbir yere kaydedilmiyordu; güncellemeden sonra ilk bırakmada / kâğıt kayıtta yeniden verilirdi. Göç v32 bir kez tarar
// (lib/migrations.mjs scanPaperFloors): kâğıt serilerine ait, programın biçimindeki Kâğıt Fatura No değerleri ve işlem geçmişindeki bırakma numaraları, o seride
// DURMAYAN belgelerde → seri + yıl başına en büyük sıra numara tabanına (invoice.numberFloor); yalnız yükseltir; işaret veri tabanının şema sürümü.
// Veri v2.4.3'ün GERÇEK koduyla, API'sinden üretilir (test kuralı; ders 17). Sahte EDM; sahte saat (ders 13); ders 30 lisans adresi.
//
// "Nasıl bozulur?" (önce yazıldı; testler buradan):
//   S1 güncellemeden önce ayrılmış en büyük numara (FIS…003) kayıtlı değil → güncellemeden sonraki ilk bırakmada / kâğıt kayıtta yeniden verilir (asıl hata)
//   S2 elle yazılmış Kâğıt Fatura No tabanı yükseltir: biçim dışı ("FIS-12", 15 hane), başka seriye ait (e-Arşiv EAR / test TEA, firmanın olmayan KGT serisi),
//      ya da belge o seride DURUYORKEN yazılmış numara (FIS…970 — seride duran belgeyi MAX(seq) zaten sayar)
//   S3 Kâğıt Fatura No'su önceden dolu belgede fiş numarası yalnız işlem geçmişinde → taranmaz
//   S4 002 şirketi taranmaz ya da 001'in sonucunu alır
//   S5 güncellemeden SONRA geri yüklenen 2.4.3 yedeği taranmaz (işaret veri tabanı dışında ya da kurulum başına bir kez)
//   S6 iki kez açılış iki kez tarar ve sonucu değiştirir; tarama tabanı KÜÇÜLTÜR (yeni kodun kaydettiği daha büyük ayrılış varken)
//   S7 Şirket Verisini Sıfırla sonrası taranmış taban kalır (boş seri ileriden başlar)
import assert from "node:assert/strict";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { after, before, describe, test } from "node:test";
import { createClock } from "../server/lib/clock.mjs";
import { resetEdmCaches } from "../server/lib/einvoice/edm.mjs";
import { OUR_VKN, startMockEdm } from "./einvoice-mock.mjs";
import { ADMIN_PASSWORD } from "./helpers.mjs";
import { CURRENT, bootVersion, tagsAvailable } from "./guvenilirlik/surumler.mjs";

const SELLER = { name: "Deneme Ofis Ltd.", taxNo: OUR_VKN, taxOffice: "Çankaya", address: "Atatürk Blv. 1", district: "Çankaya", city: "Ankara", email: "bilgi@deneme.com.tr" };
const PERSON = { name: "Ayşe Kaya", type: "customer", partyKind: "person", firstName: "Ayşe", familyName: "Kaya", taxNo: "10000000146", taxOffice: "Konak", address: "Kordon 1", district: "Konak", city: "İzmir", email: "ayse@example.com" };
const fis = seq => `FIS2026${String(seq).padStart(9, "0")}`;
const at = (days, hour = 10) => new Date(2026, 5, 17 + days, hour, 0, 0).getTime();

describe("Numara tabanı göçü (v32): v2.4.3'te ayrılmış fiş numaraları güncellemeden sonra yeniden verilmez", { skip: !tagsAvailable(["v2.4.3"]) && "v2.4.3 etiketi yok (git fetch --tags)" }, () => {
  const root = mkdtempSync(path.join(tmpdir(), "goc-244-numara-"));
  const dirs = { dataDir: path.join(root, "data"), backupDir: path.join(root, "backups"), env: { HUKUK_LICENSE_URL: "http://127.0.0.1:9" }, edocEnabled: true, edocStatusPollMs: [10, 10] };
  const clock = createClock({ time: at(0), fixed: true });
  const ids = {};
  let edm;
  let cur = null;
  const ok = async (label, promise) => {
    const res = await promise;
    assert.equal(res.status, 200, `${label}: ${res.status} ${JSON.stringify(res.data).slice(0, 400)}`);
    return res.data;
  };
  const integrator = () => ({ env: "test", baseUrl: edm.url, username: "edmkullanici", password: "Gizli-Parola-1", senderAlias: "urn:mail:defaultgb@deneme.com.tr" });
  const sale = (api, q, accountId, extra = {}) => ok("satış", api.post(`/api/workspace/invoices${q}`, { scenario: "service_sale", accountId, lines: [{ name: "Danışmanlık", qty: 1, unitPrice: 500, vatRate: 20 }], payment: { rest: "open" }, eSend: "later", ...extra }));
  const withdraw = (api, q, id) => ok("bırak", api.post(`/api/workspace/invoices/${id}/withdraw${q}`, {}));
  const send = (api, q, id) => ok("gönder", api.post(`/api/workspace/invoices/${id}/send${q}`, {}));
  const nextPaper = async (api, q = "") => (await ok("ayar", api.get(`/api/workspace/invoices/settings${q}`))).nextNumbers.paper.number;
  const floorsOf = store => JSON.parse(store.get("SELECT value FROM settings WHERE key = 'invoice.numberFloor'")?.value || "{}");
  const q002 = () => `?hofCompany=${encodeURIComponent(ids.second)}`;

  before(async () => {
    resetEdmCaches();
    edm = await startMockEdm();
    const old = await bootVersion("v2.4.3", { ...dirs, now: clock });
    try {
      const api = await old.login();
      await api.post("/api/workspace/bank/setup/dismiss", {});
      await ok("ayar", api.put("/api/workspace/invoices/settings", { seller: SELLER, efatura: true, earsiv: true, integrator: integrator() }));
      ids.person = (await ok("cari", api.post("/api/workspace/accounts", PERSON))).id;
      // 001: A bırakıldı FIS…001 → gönderildi; B bırakıldı FIS…001 (2.4.3 numarayı yeniden verdi); K kâğıt fatura FIS…002 (Kâğıt Fatura No'su elle FIS…970 —
      // belge FIS serisinde duruyor); C bırakıldı FIS…003 → gönderildi. Seride B (001) ve K (002) duruyor; ayrılan en büyük numara C'nin FIS…003'ü.
      const a = await sale(api, "", ids.person);
      assert.equal((await withdraw(api, "", a.id)).number, fis(1));
      await send(api, "", a.id);
      const b = await sale(api, "", ids.person);
      assert.equal((await withdraw(api, "", b.id)).number, fis(1), "ön koşul: 2.4.3 aynı fiş numarasını yeniden verir");
      await ok("e-Arşiv kapalı", api.put("/api/workspace/invoices/settings", { earsiv: false }));
      const k = await sale(api, "", ids.person, { profile: "KAGIT", eSend: undefined, paperNo: fis(970) });
      assert.equal(k.number, fis(2));
      await ok("e-Arşiv açık", api.put("/api/workspace/invoices/settings", { earsiv: true }));
      const c = await sale(api, "", ids.person);
      assert.equal((await withdraw(api, "", c.id)).number, fis(3));
      assert.equal((await send(api, "", c.id)).paperNo, fis(3));
      // Elle yazılmış, sayılmaması gereken Kâğıt Fatura No'ları (belgeler iptal; Gönderilecekler'i bekletmesin).
      for (const paperNo of ["FIS-12", "FIS202600000099", "EAR2026000000900", "TEA2026000000950", "KGT2026000000960"]) {
        const noise = await sale(api, "", ids.person, { paperNo });
        await ok("iptal", api.post(`/api/workspace/invoices/${noise.id}/cancel`, { reason: "test: elle yazılmış Kâğıt Fatura No" }));
      }
      // 002: G'nin Kâğıt Fatura No'su önceden dolu ("EL-77") → bırakıldı FIS…001 → gönderildi: fiş numarası YALNIZ işlem geçmişinde.
      const second = await ok("002", api.post("/api/companies", { name: "İkinci Büro", select: false }));
      ids.second = (second.company || second).id;
      await ok("002 ayar", api.put(`/api/workspace/invoices/settings${q002()}`, { seller: { ...SELLER, name: "İkinci Büro Ltd." }, efatura: true, earsiv: true, integrator: integrator() }));
      ids.person2 = (await ok("002 cari", api.post(`/api/workspace/accounts${q002()}`, PERSON))).id;
      const g = await sale(api, q002(), ids.person2, { paperNo: "EL-77" });
      assert.equal((await withdraw(api, q002(), g.id)).number, fis(1));
      assert.equal((await send(api, q002(), g.id)).paperNo, "EL-77", "ön koşul: fiş numarası Kâğıt Fatura No'ya taşınmadı");
      const backup = await ok("002 yedek", api.post("/api/admin/backups", { scope: "one", companyId: ids.second }));
      ids.backup002 = backup.name;
    } finally {
      await old.close();
    }
    cur = await bootVersion(CURRENT, { ...dirs, now: clock });
  });
  after(async () => {
    await cur?.close();
    await edm?.close();
    rmSync(root, { recursive: true, force: true });
  });

  test("S1/S2 001: güncellemeden sonra sıradaki fiş FIS…004 (FIS…003 yeniden verilmez); elle yazılmış biçim dışı / başka seri / seride duran numara tabanı yükseltmez", async () => {
    const api = await cur.login();
    assert.equal(await nextPaper(api), fis(4), "Fatura Ayarları sıradaki fiş");
    const d = await sale(api, "", ids.person);
    assert.equal((await withdraw(api, "", d.id)).number, fis(4), "bırakma");
    await ok("e-Arşiv kapalı", api.put("/api/workspace/invoices/settings", { earsiv: false }));
    try {
      const paper = await sale(api, "", ids.person, { profile: "KAGIT", eSend: undefined });
      assert.equal(paper.number, fis(5), "kâğıt kayıt");
    } finally {
      await ok("e-Arşiv açık", api.put("/api/workspace/invoices/settings", { earsiv: true }));
    }
    const holders = cur.app.store.all("SELECT id FROM invoices WHERE number = ? OR paper_no = ?", fis(3), fis(3));
    assert.equal(holders.length, 1, "FIS…003 yalnız C'de (Kâğıt Fatura No)");
    assert.deepEqual(floorsOf(cur.app.store), { FIS2026: { seq: 3, number: fis(3), issueDate: "2026-06-17" } }, "taban yalnız FIS2026, en büyük ayrılan numara (C)");
  });

  test("S3/S4 002 ayrı taranır: fiş numarası yalnız işlem geçmişindeyken de sayılır; 001 ile karışmaz", async () => {
    const api = await cur.login();
    assert.equal(await nextPaper(api, q002()), fis(2), "002: FIS…001 (işlem geçmişinde) yeniden verilmez");
    const h = await sale(api, q002(), ids.person2);
    assert.equal((await withdraw(api, q002(), h.id)).number, fis(2));
    assert.equal(await nextPaper(api), fis(6), "001'in sırası 002'den etkilenmedi");
  });

  test("S6 iki kez açılış = bir kez tarama: taban aynı kalır; tarama yeniden koşsa da bir şey değiştirmez ve tabanı asla küçültmez", async () => {
    const before = floorsOf(cur.app.store);
    await cur.close();
    cur = await bootVersion(CURRENT, { ...dirs, now: clock });
    assert.deepEqual(floorsOf(cur.app.store), before, "ikinci açılış");
    const { LATEST_VERSION, scanPaperFloors } = await import("../server/lib/migrations.mjs");
    assert.equal(cur.app.store.get("PRAGMA user_version").user_version, LATEST_VERSION);
    assert.deepEqual(scanPaperFloors(cur.app.store).raised, [], "idempotent");
    // Yeni kodun kaydettiği daha büyük ayrılış (benzetim): tarama küçültmez.
    const bigger = { ...before, FIS2026: { seq: 50, number: fis(50), issueDate: "2026-06-17" } };
    cur.app.store.run("UPDATE settings SET value = ? WHERE key = 'invoice.numberFloor'", JSON.stringify(bigger));
    assert.deepEqual(scanPaperFloors(cur.app.store).raised, []);
    assert.deepEqual(floorsOf(cur.app.store), bigger);
    cur.app.store.run("UPDATE settings SET value = ? WHERE key = 'invoice.numberFloor'", JSON.stringify(before));
  });

  test("S5 güncellemeden sonra 002'ye 2.4.3 yedeği geri yüklenince tarama koşar: FIS…001 yine verilmez", async () => {
    const api = await cur.login();
    await ok("geri yükle", api.post("/api/admin/backups/restore", { name: ids.backup002, company: ids.second, confirm: "002", password: ADMIN_PASSWORD }));
    // Yedekte 2.4.4'te bırakılan H yok; ayrılan FIS…001 yalnız işlem geçmişinde.
    assert.equal(await nextPaper(api, q002()), fis(2));
    const again = await sale(api, q002(), ids.person2);
    assert.equal((await withdraw(api, q002(), again.id)).number, fis(2));
  });

  test("S7 Şirket Verisini Sıfırla: faturalarla birlikte taranmış taban da silinir; seri baştan (MAX(seq) gibi)", async () => {
    const api = await cur.login();
    await ok("sıfırla", api.post("/api/companies/sirket-001/reset", { mode: "movements", confirm: "001", password: ADMIN_PASSWORD }));
    assert.equal(cur.app.store.get("SELECT COUNT(*) AS n FROM invoices").n, 0);
    assert.deepEqual(floorsOf(cur.app.store), {});
    assert.equal(await nextPaper(api), fis(1));
  });

  test("S2 Kâğıt Fatura No kaynağı: taşınmış belgede programın biçiminde ve kâğıt serisinde elle yazılmış numara da kullanılmış sayılır; seride duran belgedeki sayılmaz", async () => {
    // Güncel programın kendi verisi (sıfırlanmış 001): e-Arşiv belgesi (seride değil) Kâğıt Fatura No FIS…040; kâğıt fatura (FIS serisinde) Kâğıt Fatura No FIS…070.
    const api = await cur.login();
    const moved = await sale(api, "", ids.person, { paperNo: fis(40) });
    await ok("iptal", api.post(`/api/workspace/invoices/${moved.id}/cancel`, { reason: "test" }));
    await ok("e-Arşiv kapalı", api.put("/api/workspace/invoices/settings", { earsiv: false }));
    try {
      assert.equal((await sale(api, "", ids.person, { profile: "KAGIT", eSend: undefined, paperNo: fis(70) })).number, fis(1));
    } finally {
      await ok("e-Arşiv açık", api.put("/api/workspace/invoices/settings", { earsiv: true }));
    }
    const { scanPaperFloors } = await import("../server/lib/migrations.mjs");
    assert.deepEqual(scanPaperFloors(cur.app.store).raised, ["FIS2026"]);
    assert.equal(floorsOf(cur.app.store).FIS2026.seq, 40, "FIS…070 (seride duran belgede) sayılmadı");
    assert.equal(await nextPaper(api), fis(41));
  });
});
