// 2.4.4 uzman UI/UX (31f) bulgusu U1 (YÜKSEK; 2.4.3'te de): faturadaki "Nihai Tüketici" düğmesi TCKN'si 11111111111 olan EN ESKİ cariyi seçiyordu.
// Adı belli bir kişiye (ör. "Ayşe Şahin") bu numara yazılmışsa anonim perakende satışlar onun carisine borç yazılıyor, e-Arşiv alıcı adı o kişi çıkıyordu.
// KARAR (kullanıcı adına 5 dk yetkisiyle, 22.10.2026): düğme YALNIZ programın kendi carisini kullanır (ayar anahtarında kimliği: invoice.retailAccountId);
// işaretli cari yoksa adı "Nihai Tüketici" ve TCKN'si 11111111111 olan en eski cari benimsenir, o da yoksa yeni açılır; adı belli cari ASLA seçilmez.
// Nasıl bozulur (önce yazıldı; docs/kanit/2026-10-22/244-u1/nasil-bozulur.md; mutasyonlar aynı klasörde mutasyon.py): N1 adı belli cari önce açılmış · N2 eski sürüm (v2.4.3) verisi · N3 eski veride birden çok
// aday · N4 aynı anda iki kullanıcı · N5 cari yeniden adlandırılır / kimliği değişir · N6 cari silinir / pasif / geri gelir · N7 iki şirket · N8 Tümünü Sıfırla ·
// N9 yetkisiz kullanıcı. Sahte saat (ders 13); ders 30 lisans adresi. Eski kodda (e195089) kırmızıdır: iletide seçilen carinin adı yazar (ders 38).
import assert from "node:assert/strict";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { after, describe, test } from "node:test";
import { ADMIN_PASSWORD, startTestServer } from "./helpers.mjs";
import { CURRENT, bootVersion, tagsAvailable } from "./guvenilirlik/surumler.mjs";

const ANON = "11111111111";
const KEY = "invoice.retailAccountId";
const LICENSE_ENV = { HUKUK_LICENSE_URL: "http://127.0.0.1:9" };
const unwrap = response => ({ ...response, data: response.data && typeof response.data === "object" && "ok" in response.data ? (response.data.ok ? response.data.data : response.data) : response.data });
const apiOf = client => ({
  get: async url => unwrap(await client.get(url)),
  post: async (url, body) => unwrap(await client.post(url, body)),
  put: async (url, body) => unwrap(await client.put(url, body)),
  del: async url => unwrap(await client.del(url)),
});
const must = async (label, promise) => {
  const r = await promise;
  assert.equal(r.status, 200, `${label}: ${r.status} ${JSON.stringify(r.data).slice(0, 400)}`);
  return r.data;
};
const RETAIL = "/api/workspace/invoices/retail-account";
const person = (name, taxNo, extra = {}) => ({ name, type: "customer", partyKind: "person", firstName: name.split(" ")[0], familyName: name.split(" ").slice(1).join(" ") || name, taxNo, city: "Ankara", district: "Çankaya", ...extra });
const sale = (accountId, amount = 1000, issueDate = "2026-10-22") => ({ kind: "sale", accountId, issueDate, profile: "KAGIT", lines: [{ name: "Perakende", qty: 1, unitPrice: amount, vatRate: 20 }], payment: { rest: "open" } });

const open = [];
after(async () => {
  for (const server of open.splice(0)) await server.close().catch(() => null);
});
async function setup(options = {}) {
  const server = await startTestServer({ now: "2026-10-22T10:00:00", env: LICENSE_ENV, ...options });
  open.push(server);
  const client = server.client();
  assert.equal((await client.login("admin", ADMIN_PASSWORD)).status, 200);
  const api = apiOf(client);
  await must("firma", api.put("/api/workspace/invoices/settings", { seller: { name: "Deneme Ofis Ltd.", taxNo: "1234567890", taxOffice: "Çankaya", address: "Atatürk Blv. 1", district: "Çankaya", city: "Ankara" } }));
  const db = (sql, ...args) => server.app.store.get(sql, ...args);
  const login = async (username, password) => {
    const other = server.client();
    assert.equal((await other.login(username, password)).status, 200);
    return apiOf(other);
  };
  const edit = async (id, change) => {
    const current = await must("cari oku", api.get(`/api/workspace/accounts/${id}`));
    return must("cari düzenle", api.put(`/api/workspace/accounts/${id}`, { name: current.name, type: current.type, taxNo: current.taxNo, partyKind: current.partyKind, firstName: current.firstName, familyName: current.familyName, city: current.city, district: current.district, status: current.status, updatedAt: current.updatedAt, ...change }));
  };
  const nameOf = id => db("SELECT name FROM accounts WHERE id = ?", id)?.name;
  return { server, api, db, login, edit, nameOf };
}

describe("U1: Nihai Tüketici düğmesi yalnız programın kendi carisini seçer; adı belli cari seçilmez", () => {
  test("N1: adı belli cari (11111111111) önce açılmış → ayrı \"Nihai Tüketici\" açılır; satış onun borcuna, Ayşe Şahin'e değil", async () => {
    const { api, db, nameOf } = await setup();
    const ayse = await must("Ayşe Şahin", api.post("/api/workspace/accounts", person("Ayşe Şahin", ANON)));
    const pick = await must("düğme", api.post(RETAIL, {}));
    assert.notEqual(pick.id, ayse.id, `düğme adı belli cariyi seçti: "${pick.name}"`);
    assert.equal(pick.name, "Nihai Tüketici");
    assert.equal(pick.created, true);
    assert.equal(db("SELECT value FROM settings WHERE key = ?", KEY)?.value, pick.id, "işaret ayarda");
    const invoice = await must("satış", api.post("/api/workspace/invoices", sale(pick.id, 1000)));
    assert.equal(db("SELECT account_id AS a FROM invoices WHERE id = ?", invoice.id).a, pick.id);
    const ayseCard = await must("Ayşe kartı", api.get(`/api/workspace/accounts/${ayse.id}`));
    const retailCard = await must("NT kartı", api.get(`/api/workspace/accounts/${pick.id}`));
    assert.equal(ayseCard.totals.balance, 0, "Ayşe Şahin'in bakiyesi değişmedi");
    assert.equal(retailCard.totals.balance, 1200, "satış (1.000 + %20 KDV) Nihai Tüketici'nin borcunda");
    const again = await must("ikinci", api.post(RETAIL, {}));
    assert.deepEqual([again.id, again.created], [pick.id, false], `ikinci basışta ${nameOf(again.id)}`);
    assert.equal(db("SELECT COUNT(*) AS n FROM accounts WHERE deleted_at IS NULL").n, 2, "çift cari açılmadı");
  });

  test("N4: iki kullanıcı aynı anda basar → tek cari, hepsi aynı kimlik", async () => {
    const { api, db, login } = await setup();
    await must("ikinci yönetici", api.post("/api/admin/users", { username: "muhasebe1", name: "Muhasebe Bir", role: "muhasebe", password: "Muhasebe-Bir-2026!", mustChangePassword: false }));
    const other = await login("muhasebe1", "Muhasebe-Bir-2026!");
    await must("adı belli", api.post("/api/workspace/accounts", person("Ayşe Şahin", ANON)));
    const results = await Promise.all([api.post(RETAIL, {}), other.post(RETAIL, {}), api.post(RETAIL, {}), other.post(RETAIL, {})]);
    for (const r of results) assert.equal(r.status, 200, JSON.stringify(r.data));
    assert.equal(new Set(results.map(r => r.data.id)).size, 1, `farklı cariler: ${results.map(r => r.data.name).join(", ")}`);
    assert.equal(results.filter(r => r.data.created).length, 1, "yalnız biri açtı");
    assert.equal(db("SELECT COUNT(*) AS n FROM accounts WHERE deleted_at IS NULL AND name = 'Nihai Tüketici'").n, 1);
  });

  test("N5: işaretli cari adı belli kişiye çevrilir ya da kimliği değişir → artık seçilmez; harf büyüklüğü/boşluk farkı rolü bozmaz", async () => {
    const { api, edit, nameOf } = await setup();
    const first = await must("ilk", api.post(RETAIL, {}));
    await edit(first.id, { name: "Ayşe Şahin", firstName: "Ayşe", familyName: "Şahin" });
    const second = await must("yeniden adlandırma sonrası", api.post(RETAIL, {}));
    assert.notEqual(second.id, first.id, `adı belli cari seçildi: "${nameOf(second.id)}"`);
    assert.deepEqual([second.name, second.created], ["Nihai Tüketici", true]);
    await edit(second.id, { name: "  nihai   TÜKETİCİ " });
    const same = await must("yazım farkı", api.post(RETAIL, {}));
    assert.equal(same.id, second.id, "aynı cari (ad kuralı harf/boşluk gözetmez)");
    await edit(second.id, { taxNo: "10000000146" });
    const third = await must("kimlik değişti", api.post(RETAIL, {}));
    assert.ok(![first.id, second.id].includes(third.id), `gerçek TCKN'li cari seçildi: "${nameOf(third.id)}"`);
    assert.equal(third.created, true);
  });

  test("N6: pasif cari kullanılmaya devam eder; silinince yeni açılır, Silinenler'den geri gelse de işaret yenide kalır", async () => {
    const { api, db, edit } = await setup();
    const first = await must("ilk", api.post(RETAIL, {}));
    await edit(first.id, { status: "passive" });
    assert.equal((await must("pasif", api.post(RETAIL, {}))).id, first.id, "pasif cari faturayı engellemez; aynı cari");
    await edit(first.id, { status: "active" });
    await must("sil", api.del(`/api/workspace/accounts/${first.id}`));
    const second = await must("silindikten sonra", api.post(RETAIL, {}));
    assert.notEqual(second.id, first.id, "silinmiş cari seçilmez");
    assert.equal(second.created, true);
    await must("geri yükle", api.post("/api/admin/trash/restore", { id: `account:${first.id}` }));
    assert.equal(db("SELECT deleted_at AS d FROM accounts WHERE id = ?", first.id).d, null, "ön koşul: geri geldi");
    assert.equal((await must("geri geldikten sonra", api.post(RETAIL, {}))).id, second.id, "işaret yenide (eskisi geri geldi diye değişmez)");
  });

  test("N3: eski veride işaretsiz birden çok aday → yalnız adı \"Nihai Tüketici\" olan, en eskisi (açılış zamanı, eşitse yazım sırası); işaret sonra kalıcı", async () => {
    // Saat durur: üç cari aynı anda açılır → eşitlikte yazım sırası (ders 31).
    const { api, db, server, nameOf } = await setup({ now: { time: "2026-10-22T10:00:00", fixed: true } });
    const named = await must("adı belli", api.post("/api/workspace/accounts", person("Perakende Müşteri", ANON)));
    const a = await must("NT a", api.post("/api/workspace/accounts", person("Nihai Tüketici", ANON)));
    const b = await must("NT b", api.post("/api/workspace/accounts", person("Nihai Tüketici", ANON)));
    assert.equal(db("SELECT COUNT(DISTINCT created_at) AS n FROM accounts WHERE id IN (?, ?, ?)", named.id, a.id, b.id).n, 1, "ön koşul: aynı açılış zamanı");
    const pick = await must("düğme", api.post(RETAIL, {}));
    assert.equal(pick.id, a.id, `beklenen ilk yazılan "Nihai Tüketici"; seçilen "${nameOf(pick.id)}"`);
    assert.equal(pick.created, false, "eski cari benimsendi, yeni açılmadı");
    // b daha eski görünse de işaretli cari değişmez (kalıcı işaret).
    server.app.store.run("UPDATE accounts SET created_at = '2020-01-01T00:00:00.000Z' WHERE id = ?", b.id);
    assert.equal((await must("işaretli", api.post(RETAIL, {}))).id, a.id);
    // İşaretsiz eski veri: açılış zamanı önce gelir.
    server.app.store.run("DELETE FROM settings WHERE key = ?", KEY);
    assert.equal((await must("işaretsiz", api.post(RETAIL, {}))).id, b.id, "en eski açılış zamanlı aday");
    assert.equal(db("SELECT COUNT(*) AS n FROM accounts WHERE deleted_at IS NULL").n, 3, "yeni cari açılmadı");
  });

  test("N7 + N8: iki şirket ayrı cari ve ayrı işaret; Tümünü Sıfırla'dan sonra (işaret kalır, cari yok) yeniden açılır", async () => {
    const { api, db } = await setup();
    const second = (await must("002", api.post("/api/companies", { code: "002", name: "İkinci Ltd." }))).company;
    const q = `?hofCompany=${encodeURIComponent(second.id)}`;
    await must("002 firma", api.put(`/api/workspace/invoices/settings${q}`, { seller: { name: "İkinci Ltd.", taxNo: "1234567890", taxOffice: "Konak", address: "Kordon 1", district: "Konak", city: "İzmir" } }));
    const p001 = await must("001", api.post(RETAIL, {}));
    const p002 = await must("002", api.post(`${RETAIL}${q}`, {}));
    assert.equal(p002.created, true, "002'de kendi carisi açıldı");
    const list002 = await must("002 cariler", api.get(`/api/workspace/accounts${q}`));
    const rows002 = list002.accounts.filter(item => item.taxNo === ANON);
    assert.deepEqual(rows002.map(item => item.id), [p002.id], "002'de tek Nihai Tüketici");
    assert.equal(rows002[0].city, "İzmir", "il 002'nin firma adresinden");
    assert.equal((await must("001 yine", api.post(RETAIL, {}))).id, p001.id, "001'in işareti değişmedi");
    assert.equal(db("SELECT COUNT(*) AS n FROM accounts WHERE tax_no = ?", ANON).n, 1, "001'e 002'nin carisi yazılmadı");
    await must("002 tümünü sıfırla", api.post(`/api/companies/${second.id}/reset`, { mode: "all", confirm: "002", password: ADMIN_PASSWORD }));
    const after = await must("sıfırlamadan sonra", api.post(`${RETAIL}${q}`, {}));
    assert.equal(after.created, true, "işaret silinmiş cariyi gösteriyordu; yeni açıldı");
    assert.equal(after.name, "Nihai Tüketici");
  });

  test("N9: fatura kesme yetkisi olmayan kullanıcı → 403, cari açılmaz", async () => {
    const { api, db, login } = await setup();
    await must("personel", api.post("/api/admin/users", { username: "personel1", name: "Personel Bir", role: "personel", password: "Personel-Bir-2026!", mustChangePassword: false }));
    const staff = await login("personel1", "Personel-Bir-2026!");
    const refused = await staff.post(RETAIL, {});
    assert.equal(refused.status, 403, JSON.stringify(refused.data));
    assert.equal(db("SELECT COUNT(*) AS n FROM accounts").n, 0);
    assert.equal(db("SELECT COUNT(*) AS n FROM settings WHERE key = ?", KEY).n, 0);
  });
});

// N2: eski sürüm verisi v2.4.3'ün GERÇEK koduyla, API'sinden üretilir (test kuralı; ders 17).
describe("U1 eski veri: v2.4.3'te düğmeyle açılmış Nihai Tüketici benimsenir; adı belli cari seçilmez (iki şirket)", { skip: !tagsAvailable(["v2.4.3"]) && "v2.4.3 etiketi yok (git fetch --tags)" }, () => {
  test("N2: 001'de Ayşe Şahin (sonradan 11111111111) daha eski + düğmenin carisi + elle açılmış ikinci Nihai Tüketici; 002'de düğmenin carisi", async () => {
    const root = mkdtempSync(path.join(tmpdir(), "nihai-tuketici-u1-244-"));
    const dirs = { dataDir: path.join(root, "data"), backupDir: path.join(root, "backups"), env: LICENSE_ENV };
    let server = null;
    try {
      server = await bootVersion("v2.4.3", { ...dirs, now: "2026-10-18T10:00:00" });
      let api = await server.login();
      await must("firma", api.put("/api/workspace/invoices/settings", { seller: { name: "Deneme Ofis Ltd.", taxNo: "1234567890", taxOffice: "Çankaya", address: "Atatürk Blv. 1", district: "Çankaya", city: "Ankara" } }));
      const ayse = await must("Ayşe (gerçek TCKN)", api.post("/api/workspace/accounts", person("Ayşe Şahin", "10000000146")));
      const nt1 = await must("2.4.3 düğmesi", api.post(RETAIL, {}));
      assert.equal(nt1.created, true, "ön koşul: 2.4.3 düğmesi kendi carisini açtı");
      const current = await must("Ayşe oku", api.get(`/api/workspace/accounts/${ayse.id}`));
      await must("Ayşe'ye 11111111111", api.put(`/api/workspace/accounts/${ayse.id}`, { name: current.name, type: current.type, partyKind: "person", firstName: "Ayşe", familyName: "Şahin", taxNo: ANON, city: "Ankara", district: "Çankaya", updatedAt: current.updatedAt }));
      const oldPick = await must("2.4.3 düğmesi yeniden", api.post(RETAIL, {}));
      assert.equal(oldPick.id, ayse.id, "ön koşul (U1 2.4.3'te de): eski kod en eski 11111111111'li cariyi, Ayşe Şahin'i seçiyor");
      await must("2.4.3'te yanlış cariye satış", api.post("/api/workspace/invoices", sale(oldPick.id, 500, "2026-10-18")));
      const nt2 = await must("elle ikinci NT", api.post("/api/workspace/accounts", person("Nihai Tüketici", ANON)));
      const second = (await must("002", api.post("/api/companies", { code: "002", name: "İkinci Ltd." }))).company;
      const q = `?hofCompany=${encodeURIComponent(second.id)}`;
      await must("002 firma", api.put(`/api/workspace/invoices/settings${q}`, { seller: { name: "İkinci Ltd.", taxNo: "1234567890", taxOffice: "Konak", address: "Kordon 1", district: "Konak", city: "İzmir" } }));
      const nt002 = await must("002 düğme", api.post(`${RETAIL}${q}`, {}));
      await server.close();
      server = null;

      server = await bootVersion(CURRENT, { ...dirs, now: "2026-10-22T10:00:00" });
      api = await server.login();
      const store = server.app.store;
      const countBefore = store.get("SELECT COUNT(*) AS n FROM accounts").n;
      const pick = await must("2.4.4 düğmesi", api.post(RETAIL, {}));
      const name = store.get("SELECT name FROM accounts WHERE id = ?", pick.id)?.name;
      assert.equal(pick.id, nt1.id, `beklenen 2.4.3 düğmesinin carisi; seçilen "${name}"`);
      assert.notEqual(pick.id, ayse.id);
      assert.notEqual(pick.id, nt2.id, "en eski aday");
      assert.equal(pick.created, false);
      assert.equal(store.get("SELECT COUNT(*) AS n FROM accounts").n, countBefore, "yeni cari açılmadı");
      assert.equal(store.setting(KEY, ""), nt1.id, "işaretlendi");
      // BİLİNEN SINIR: 2.4.3'te yanlış cariye yazılmış satış taşınmaz (kullanıcı görür; program kendiliğinden düzeltmez).
      assert.equal(store.get("SELECT COUNT(*) AS n FROM invoices WHERE account_id = ?", ayse.id).n, 1);
      const pick002 = await must("2.4.4 düğmesi 002", api.post(`${RETAIL}${q}`, {}));
      assert.deepEqual([pick002.id, pick002.created], [nt002.id, false], "002'de 2.4.3'ün carisi benimsendi");
    } finally {
      await server?.close().catch(() => null);
      rmSync(root, { recursive: true, force: true, maxRetries: 10, retryDelay: 200 });
    }
  });
});
