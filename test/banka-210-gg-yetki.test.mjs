// 2.1.0 — Aşama 2, bağımsız gözden geçirme D5: yetki göçünün (K4) verdiği banka yetkileri eski sürüme dönüşte kaybolmasın
// (docs/2.1.0-KANIT.md "Aşama 2 — Bağımsız Gözden Geçirme").
//
// Kök neden: banka yetkileri (bank.*) Aşama 3'e kadar yetki kataloğunda değil. Göç (v20) onları rol ve kişi kaydına BİR KEZ yazıyordu.
// Eski sürüm (2.0.25/2.0.26) — ve güncel sürümün kendi rol/kişi kaydı da — yalnız katalogdaki yetkileri yazar: rolün açıklaması ya da
// kişinin adı düzeltilince banka yetkileri sessizce düşüyor, göç bir daha çalışmadığı için geri gelmiyordu. Aşama 3'te Banka penceresi
// açıldığında "dün 200 dönen para işlemi bugün de 200" (K4) bozulurdu.
// Düzeltme: göç her role ve kişiye "verildi" işareti (bank.granted) yazar; işareti olmayan rol/kişi ortak katmanın her açılışında ve
// güncel sürümdeki rol/kişi kaydından hemen sonra bugünkü yetkilerinden yeniden değerlendirilir (yalnız EKLER). İşaret katalogda
// olmadığı için hiçbir yetki vermez ve ekranda görünmez.
//
// NASIL BOZARIM: gerçek 2.0.26 koduyla aynı dosyada rolün açıklamasını ve kişinin adını düzelt → güncel kodu aç; güncel sürümde rolü
// düzelt (yeniden başlatmadan); rolden bankadan çıkış yetkisini kaldır (türetilen bank.move kalmamalı); iki kez aç (aynı sonuç);
// işaret ekranda / yetki listesinde görünüyor mu?
import assert from "node:assert/strict";
import { DatabaseSync } from "node:sqlite";
import path from "node:path";
import { describe, it } from "node:test";
import { CURRENT, bootVersion, tagsAvailable } from "./guvenilirlik/surumler.mjs";
import { unpackFixture } from "./guvenilirlik/fikstur.mjs";

const PEOPLE = ["ayse", "mehmet", "zeynep", "ali", "fatma", "kasa1"];
const MARK = "bank.granted";

// Ortak katmandaki (001) ham yetki kaydı: rol adı → banka anahtarları (+ işaret), kişi → { add, remove } banka anahtarları (+ işaret).
function rawBank(dataDir) {
  const db = new DatabaseSync(path.join(dataDir, "destekofis.sqlite"), { readOnly: true });
  try {
    const bankOnly = list => (Array.isArray(list) ? list.filter(key => typeof key === "string" && key.startsWith("bank.")).sort() : []);
    const roles = Object.fromEntries(db.prepare("SELECT name, permissions_json AS p FROM roles ORDER BY name").all().map(row => [row.name, bankOnly(JSON.parse(row.p || "[]"))]));
    const users = Object.fromEntries(
      db.prepare(`SELECT username, grants_json AS g FROM users WHERE username IN (${PEOPLE.map(() => "?").join(",")}) ORDER BY username`).all(...PEOPLE).map(row => {
        const raw = JSON.parse(row.g || "{}");
        const grants = Array.isArray(raw) ? { add: raw, remove: [] } : raw;
        return [row.username, { add: bankOnly(grants.add), remove: bankOnly(grants.remove) }];
      }),
    );
    return { roles, users };
  } finally {
    db.close();
  }
}
const withoutMark = state => JSON.parse(JSON.stringify(state, (key, value) => (Array.isArray(value) ? value.filter(item => item !== MARK) : value)));

describe("D5 — banka yetkileri eski sürümün rol/kişi kaydında kaybolmaz", { skip: !tagsAvailable(["v2.0.26"]) && "v2.0.26 etiketi yok (git fetch --tags)" }, () => {
  it("2.0.26'da rol açıklaması ve kişi adı düzeltilir → güncel kod açılınca banka yetkileri aynen geri gelir; işaret görünmez", async () => {
    const fixture = unpackFixture("surum-2.0.26-zincir");
    let server = null;
    try {
      server = await bootVersion(CURRENT, { dataDir: fixture.dataDir, backupDir: fixture.backupDir, maxCompanies: 10, moneyStrict: false, gateVerify: false });
      let api = await server.login();
      const roles = (await api.get("/api/admin/roles")).data;
      const roleIds = Object.fromEntries(roles.custom.map(role => [role.label, role.key]));
      await server.close();
      server = null;
      const migrated = rawBank(fixture.dataDir);
      // Göçün verdiği (K4): Tahsilat Sorumlusu cash.view + accounts.manage; Kasa Görevlisi cash.view + cash.manage; kasa1'e stock.sell.
      assert.deepEqual(withoutMark(migrated).roles["Tahsilat Sorumlusu"], ["bank.cancel", "bank.move", "bank.reports", "bank.view"]);
      assert.deepEqual(withoutMark(migrated).roles["Kasa Görevlisi"], ["bank.reconcile", "bank.reports", "bank.statement", "bank.transfer", "bank.view"]);
      assert.deepEqual(withoutMark(migrated).users.kasa1.add, ["bank.cancel", "bank.move"]);

      // Eski sürüm: ekrandaki yetkilerle rol açıklaması ve kişi adı düzeltilir (yetkiye dokunulmadan).
      server = await bootVersion("v2.0.26", { dataDir: fixture.dataDir, backupDir: fixture.backupDir, maxCompanies: 10 });
      api = await server.login();
      for (const name of ["Tahsilat Sorumlusu", "Kasa Görevlisi"]) assert.equal((await api.client.patch(`/api/admin/roles/${roleIds[name]}`, { description: "açıklama düzeltildi" })).status, 200);
      const listed = (await api.get("/api/admin/users")).data;
      const users = Array.isArray(listed) ? listed : listed.users;
      for (const username of ["ayse", "kasa1", "mehmet"]) {
        const user = users.find(item => item.username === username);
        const response = await api.client.patch(`/api/admin/users/${user.id}`, { name: `${user.name} (düz)`, grants: user.grants });
        assert.equal(response.status, 200, `${username}: ${JSON.stringify(response.body)}`);
      }
      await server.close();
      server = null;
      const stripped = rawBank(fixture.dataDir);
      assert.deepEqual(stripped.roles["Tahsilat Sorumlusu"], [], "ön koşul: eski sürüm rolün banka yetkilerini siler");
      assert.ok(!stripped.users.kasa1.add.includes("bank.move"), "ön koşul: eski sürüm kişinin banka yetkilerini siler");

      // Güncel kod yeniden: banka yetkileri göçteki gibi.
      server = await bootVersion(CURRENT, { dataDir: fixture.dataDir, backupDir: fixture.backupDir, maxCompanies: 10, moneyStrict: false, gateVerify: false });
      api = await server.login();
      const back = rawBank(fixture.dataDir);
      assert.deepEqual(withoutMark(back), withoutMark(migrated), "eski sürümün sildiği banka yetkileri geri gelmeli");
      assert.deepEqual(back, migrated, "işaretler de geri gelir");
      assert.ok(back.roles["Tahsilat Sorumlusu"].includes(MARK) && back.users.ayse.add.includes(MARK), "rol ve kişi işaretli");

      // Bilerek güncellendi (Aşama 3, dilim 1): "Banka ve POS" yetki grubu artık katalogda — rol listesinde banka anahtarları göçün verdiği
      // gibi GÖRÜNÜR (yönetici görür ve değiştirebilir); işaret (bank.granted) hiçbir yerde görünmez. Personel rolüne banka yetkisi verilmez.
      const rolesAfter = (await api.get("/api/admin/roles")).data;
      for (const role of rolesAfter.custom) {
        assert.ok(!role.permissions.includes(MARK), `${role.label}: işaret görünmemeli`);
        const expected = withoutMark(migrated).roles[role.label];
        if (expected) assert.deepEqual(role.permissions.filter(key => key.startsWith("bank.")).sort(), expected, `${role.label}: göçün verdiği banka yetkileri ekranda`);
      }
      const zeynep = await server.login("zeynep", "Personel-2026!");
      const me = (await zeynep.get("/api/auth/me")).data;
      const perms = me.permissions || me.user?.permissions || [];
      assert.ok(perms.length > 0, JSON.stringify(me).slice(0, 300));
      assert.ok(!perms.includes(MARK), JSON.stringify(perms));
      assert.ok(!perms.some(key => ["bank.accounts", "bank.settings", "bank.pos", "bank.commission"].includes(key)), `personel: banka yönetim yetkisi yok ${JSON.stringify(perms)}`);
      await server.close();
      server = null;

      // İki kez açılış aynı sonucu verir.
      server = await bootVersion(CURRENT, { dataDir: fixture.dataDir, backupDir: fixture.backupDir, maxCompanies: 10, moneyStrict: false, gateVerify: false });
      await server.close();
      server = null;
      assert.deepEqual(rawBank(fixture.dataDir), migrated, "ikinci açılış değiştirmez");
    } finally {
      await server?.close().catch(() => {});
      fixture.cleanup();
    }
  });

  it("güncel sürümde rol düzeltilir → banka yetkileri yeniden başlatmadan kalır; bankadan çıkış yetkisi kaldırılınca türetilen bank.move düşer", async () => {
    const fixture = unpackFixture("surum-2.0.26-zincir");
    let server = null;
    try {
      server = await bootVersion(CURRENT, { dataDir: fixture.dataDir, backupDir: fixture.backupDir, maxCompanies: 10, moneyStrict: false, gateVerify: false });
      const api = await server.login();
      const roles = (await api.get("/api/admin/roles")).data;
      const role = roles.custom.find(item => item.label === "Tahsilat Sorumlusu");
      const before = rawBank(fixture.dataDir);
      assert.equal((await api.client.patch(`/api/admin/roles/${role.key}`, { description: "güncel sürümde düzeltildi" })).status, 200);
      assert.deepEqual(withoutMark(rawBank(fixture.dataDir)).roles, withoutMark(before).roles, "yalnız açıklama düzeltmesi banka yetkilerini değiştirmez");
      // Bilerek güncellendi (Aşama 3, dilim 1): banka yetkileri artık rol ekranında görünür ve açıkça seçilir. Rolden bankadan çıkış yetkisi
      // (accounts.manage) kalkınca ekranda seçili duran bank.move/bank.cancel KALIR (yöneticinin seçimi; türetme yalnız göçte ve işaretsiz
      // kayıtta); yönetici onları da kaldırırsa düşer ve yeniden başlatmada geri gelmez.
      assert.deepEqual(role.permissions.filter(key => key.startsWith("bank.")).sort(), ["bank.cancel", "bank.move", "bank.reports", "bank.view"], "rol ekranında banka yetkileri görünür");
      const next = role.permissions.filter(key => key !== "accounts.manage");
      assert.equal((await api.client.patch(`/api/admin/roles/${role.key}`, { permissions: next })).status, 200);
      assert.deepEqual(withoutMark(rawBank(fixture.dataDir)).roles["Tahsilat Sorumlusu"], ["bank.cancel", "bank.move", "bank.reports", "bank.view"], "ekranda seçili banka yetkileri kalır");
      const withoutExit = next.filter(key => !["bank.move", "bank.cancel"].includes(key));
      assert.equal((await api.client.patch(`/api/admin/roles/${role.key}`, { permissions: withoutExit })).status, 200);
      assert.deepEqual(withoutMark(rawBank(fixture.dataDir)).roles["Tahsilat Sorumlusu"], ["bank.reports", "bank.view"]);
      // Kişi düzeltmesi (güncel sürüm): kasa1'in kişiye eklenen bankadan çıkışı yeniden başlatmadan kalır.
      const listed = (await api.get("/api/admin/users")).data;
      const kasa1 = (Array.isArray(listed) ? listed : listed.users).find(item => item.username === "kasa1");
      assert.equal((await api.client.patch(`/api/admin/users/${kasa1.id}`, { name: "Kasa Bir (düz)", grants: kasa1.grants })).status, 200);
      assert.deepEqual(withoutMark(rawBank(fixture.dataDir)).users.kasa1.add, ["bank.cancel", "bank.move"]);
      // Yeni rol de işaretlenir (ortak katmanın sonraki açılışında yeniden yazılmaz). Bilerek güncellendi (Aşama 3, dilim 1): banka yetkileri
      // katalogda olduğundan yeni rolün banka yetkileri yöneticinin ekranda seçtikleridir (türetilmez); burada hiçbiri seçilmedi.
      const created = (await api.post("/api/admin/roles", { name: "Yeni Satış", description: "", permissions: ["stock.view", "stock.sell", "cash.view"] })).data;
      assert.ok(created?.id, JSON.stringify(created));
      const fresh = rawBank(fixture.dataDir).roles["Yeni Satış"];
      assert.deepEqual(fresh, ["bank.granted"]);
    } finally {
      await server?.close().catch(() => {});
      fixture.cleanup();
    }
  });
});
