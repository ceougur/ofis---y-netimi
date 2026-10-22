// 2.4.4 E6 (eleştirmen 31d; karar 22.10.2026: silinen kâğıt / fiş belgenin numarası kullanılmış sayılır — test/numara-silinen-244.test.mjs) ESKİ SÜRÜM
// VERİSİYLE. v2.4.3'te silinen belge satırı veri tabanından kalkar (içeriği Silinenler'de), seri MAX(seq) ile geri gelir: son numara silindiyse sıradaki
// belgeye yeniden verilir. Göç v32 (lib/migrations.mjs scanPaperFloors) Silinenler'de DURAN (geri yüklenmemiş) belgenin kâğıt / fiş / iç seri numarasını da
// tabana yazar → güncellemeden sonra o numara verilmez, belge geri yüklenince kendi numarasıyla döner. 2.4.3'te zaten yeniden verilmiş numara olduğu gibi
// kalır; o belgenin geri yüklenmesi reddedilir (iki belge aynı numarayı taşımaz), belge Silinenler'de kalır.
// Veri v2.4.3'ün GERÇEK koduyla, API'sinden üretilir (test kuralı; ders 17). Sahte EDM; sahte saat (ders 13); ders 30 lisans adresi.
//
// "Nasıl bozulur?" (önce yazıldı — not defteri e67/NASIL-BOZULUR.md N8; testler buradan):
//   G1 2.4.3'te silinmiş SON fiş (FIS…003, Silinenler'de) güncellemeden sonraki ilk bırakmada yeniden verilir; geri yüklenince iki belgede FIS…003
//   G2 2.4.3'te silinip numarası 2.4.3'te yeniden verilmiş fiş (FIS…002) geri yüklenince iki belgede FIS…002
//   G3 kâğıt makbuz (SMM) serisi taranmaz
//   G4 002 şirketi taranmaz ya da 001'in sonucunu alır
import assert from "node:assert/strict";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { after, before, describe, test } from "node:test";
import { createClock } from "../server/lib/clock.mjs";
import { resetEdmCaches } from "../server/lib/einvoice/edm.mjs";
import { OUR_VKN, startMockEdm, vkn } from "./einvoice-mock.mjs";
import { CURRENT, bootVersion, tagsAvailable } from "./guvenilirlik/surumler.mjs";

const SELLER = { name: "Deneme Ofis Ltd.", taxNo: OUR_VKN, taxOffice: "Çankaya", address: "Atatürk Blv. 1", district: "Çankaya", city: "Ankara", email: "bilgi@deneme.com.tr" };
const PERSON = { name: "Ayşe Kaya", type: "customer", partyKind: "person", firstName: "Ayşe", familyName: "Kaya", taxNo: "10000000146", taxOffice: "Konak", address: "Kordon 1", district: "Konak", city: "İzmir", email: "ayse@example.com" };
const CLIENT = { name: "Müvekkil Ticaret A.Ş.", type: "customer", taxNo: vkn(111222333), taxOffice: "Konak", address: "Kordon 5", district: "Konak", city: "İzmir", email: "muhasebe@muvekkil.com.tr" };
const fis = seq => `FIS2026${String(seq).padStart(9, "0")}`;
const smm = seq => `SMM2026${String(seq).padStart(9, "0")}`;
const at = (days, hour = 10) => new Date(2026, 5, 17 + days, hour, 0, 0).getTime();

describe("Silinen numara göçü (v32 E6): v2.4.3'te silinip Silinenler'de duran belgenin numarası güncellemeden sonra verilmez", { skip: !tagsAvailable(["v2.4.3"]) && "v2.4.3 etiketi yok (git fetch --tags)" }, () => {
  const root = mkdtempSync(path.join(tmpdir(), "goc-244-silinen-"));
  const dirs = { dataDir: path.join(root, "data"), backupDir: path.join(root, "backups"), env: { HUKUK_LICENSE_URL: "http://127.0.0.1:9" }, edocEnabled: true, edocStatusPollMs: [10, 10] };
  const clock = createClock({ time: at(0), fixed: true });
  const ids = {};
  let edm;
  let cur = null;
  let api = null;
  const ok = async (label, promise) => {
    const res = await promise;
    assert.equal(res.status, 200, `${label}: ${res.status} ${JSON.stringify(res.data).slice(0, 400)}`);
    return res.data;
  };
  const integrator = () => ({ env: "test", baseUrl: edm.url, username: "edmkullanici", password: "Gizli-Parola-1", senderAlias: "urn:mail:defaultgb@deneme.com.tr" });
  const sale = (a, q, accountId, extra = {}) => ok("satış", a.post(`/api/workspace/invoices${q}`, { scenario: "service_sale", accountId, lines: [{ name: "Danışmanlık", qty: 1, unitPrice: 500, vatRate: 20 }], payment: { rest: "open" }, eSend: "later", ...extra }));
  const slip = async (a, q, accountId) => {
    const doc = await sale(a, q, accountId);
    return { id: doc.id, number: (await ok("bırak", a.post(`/api/workspace/invoices/${doc.id}/withdraw${q}`, {}))).number };
  };
  const remove = (a, q, id) => ok("sil", a.del(`/api/workspace/invoices/${id}${q ? `${q}&` : "?"}reason=${encodeURIComponent("test: 2.4.3'te sil")}`));
  const floorsOf = store => JSON.parse(store.get("SELECT value FROM settings WHERE key = 'invoice.numberFloor'")?.value || "{}");
  const q002 = () => `?hofCompany=${encodeURIComponent(ids.second)}`;
  const trashOf = async (invoiceId, q = "") => (await ok("Silinenler", api.get(`/api/admin/trash${q}`))).find(item => item.kind === "invoice" && item.ref === invoiceId);
  const restore = async (invoiceId, q = "") => {
    const item = await trashOf(invoiceId, q);
    assert.ok(item, `Silinenler'de yok: ${invoiceId}`);
    return api.post(`/api/admin/trash/restore${q}`, { id: item.id });
  };
  const nextOf = async (key, q = "") => (await ok("ayar", api.get(`/api/workspace/invoices/settings${q}`))).nextNumbers[key].number;
  const storeOf = () => cur.app.store;

  before(async () => {
    resetEdmCaches();
    edm = await startMockEdm();
    const old = await bootVersion("v2.4.3", { ...dirs, now: clock });
    try {
      const a = await old.login();
      await a.post("/api/workspace/bank/setup/dismiss", {});
      await ok("ayar", a.put("/api/workspace/invoices/settings", { seller: SELLER, efatura: true, earsiv: true, integrator: integrator() }));
      ids.person = (await ok("cari", a.post("/api/workspace/accounts", PERSON))).id;
      ids.client = (await ok("cari 2", a.post("/api/workspace/accounts", CLIENT))).id;
      // 001: A FIS…001 (durur); E FIS…002 → silindi; F FIS…002 (2.4.3 numarayı yeniden verdi; durur); G FIS…003 → silindi (güncellemede serinin SON numarası).
      ids.a = await slip(a, "", ids.person);
      assert.equal(ids.a.number, fis(1));
      ids.e = await slip(a, "", ids.person);
      assert.equal(ids.e.number, fis(2));
      await remove(a, "", ids.e.id);
      ids.f = await slip(a, "", ids.person);
      assert.equal(ids.f.number, fis(2), "ön koşul: 2.4.3 silinen son numarayı yeniden verir");
      ids.g = await slip(a, "", ids.person);
      assert.equal(ids.g.number, fis(3));
      await remove(a, "", ids.g.id);
      // Kâğıt makbuz (2.4.3: e-SMM kapalı → makbuz kâğıt, SMM serisi) SMM…001 → silindi.
      const makbuz = await ok("makbuz", a.post("/api/workspace/invoices", { scenario: "smm", accountId: ids.client, lines: [{ name: "Avukatlık Ücreti", qty: 1, unitPrice: 1000, vatRate: 20 }], payment: { rest: "open" } }));
      assert.equal(makbuz.number, smm(1), `ön koşul: 2.4.3 makbuzu ${makbuz.number}`);
      ids.makbuz = makbuz.id;
      await remove(a, "", makbuz.id);
      // 002: fiş FIS…001 → silindi.
      const second = await ok("002", a.post("/api/companies", { name: "İkinci Büro", select: false }));
      ids.second = (second.company || second).id;
      await ok("002 ayar", a.put(`/api/workspace/invoices/settings${q002()}`, { seller: { ...SELLER, name: "İkinci Büro Ltd." }, efatura: true, earsiv: true, integrator: integrator() }));
      ids.person2 = (await ok("002 cari", a.post(`/api/workspace/accounts${q002()}`, PERSON))).id;
      ids.k = await slip(a, q002(), ids.person2);
      assert.equal(ids.k.number, fis(1));
      await remove(a, q002(), ids.k.id);
    } finally {
      await old.close();
    }
    cur = await bootVersion(CURRENT, { ...dirs, now: clock });
    api = await cur.login();
  });
  after(async () => {
    await cur?.close();
    await edm?.close();
    rmSync(root, { recursive: true, force: true });
  });

  test("G1/G3 001: tarama Silinenler'deki son fişi (FIS…003) ve makbuzu (SMM…001) kullanılmış sayar; sıradaki FIS…004 / SMM…002", async () => {
    const floors = floorsOf(storeOf());
    assert.deepEqual({ ...floors.FIS2026 }, { seq: 3, number: fis(3), issueDate: "2026-06-17", deleted: true }, JSON.stringify(floors));
    assert.equal(floors.SMM2026?.seq, 1, JSON.stringify(floors));
    assert.equal(await nextOf("paper"), fis(4));
    assert.equal(await nextOf("smm"), smm(2));
    const h = await slip(api, "", ids.person);
    assert.equal(h.number, fis(4), `güncellemeden sonraki ilk fiş: ${h.number} — silinmiş ${fis(3)} yeniden verilmemeli`);
  });

  test("G1 Silinenler'deki G (FIS…003) geri yüklenince kendi numarasıyla döner; numara tek belgede", async () => {
    const back = await restore(ids.g.id);
    assert.equal(back.status, 200, JSON.stringify(back.data));
    const row = storeOf().get("SELECT number, seq, status FROM invoices WHERE id = ?", ids.g.id);
    assert.deepEqual({ ...row }, { number: fis(3), seq: 3, status: "cancelled" });
    assert.equal(storeOf().get("SELECT COUNT(*) AS n FROM invoices WHERE number = ? OR paper_no = ?", fis(3), fis(3)).n, 1);
    const makbuz = await restore(ids.makbuz);
    assert.equal(makbuz.status, 200, JSON.stringify(makbuz.data));
    assert.equal(storeOf().get("SELECT number FROM invoices WHERE id = ?", ids.makbuz).number, smm(1));
  });

  test("G2 2.4.3'te numarası yeniden verilmiş E (FIS…002, şimdi F'de) geri yüklenmez: 409, belge Silinenler'de kalır, FIS…002 tek belgede", async () => {
    const refused = await restore(ids.e.id);
    assert.equal(refused.status, 409, JSON.stringify(refused.data));
    assert.equal(refused.data.code, "invoice-number-taken");
    assert.equal(refused.data.holderId, ids.f.id);
    assert.match(refused.data.error, /FIS2026000000002 geri yüklenmez: bu numara belge silindikten sonra başka bir belgeye verildi \(17\.06\.2026 tarihli, Ayşe Kaya\)\. Aynı numara iki belgede olamaz; belge Silinenler'de kalır\./);
    assert.ok(await trashOf(ids.e.id), "Silinenler'de");
    assert.equal(storeOf().get("SELECT COUNT(*) AS n FROM invoices WHERE number = ?", fis(2)).n, 1);
  });

  test("G4 002 ayrı taranır: 002'de silinmiş FIS…001 verilmez (FIS…002), 001'in tabanı 002'ye geçmez", async () => {
    assert.equal(await nextOf("paper", q002()), fis(2));
    const n = await slip(api, q002(), ids.person2);
    assert.equal(n.number, fis(2));
    const back = await restore(ids.k.id, q002());
    assert.equal(back.status, 200, JSON.stringify(back.data));
    assert.equal(await nextOf("paper"), fis(5), "001'in sırası 002'den etkilenmedi (G1'deki H FIS…004'ten sonra)");
  });
});
