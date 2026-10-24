// 2.4.4 madde 19 — Personel Özlük (kullanıcı kararı 21.10.2026; CLAUDE.md "İSTEK → 2.4.4 (… Personel Raporu …)" + KARAR + EK).
// Kâhin (ders 5): beklenen değerler koddan değil kullanıcı kararından ve dış kaynaktan —
//   · geçerli TCKN 10000000146 (kamuya açık bilinen örnek; NVİ algoritması), geçersiz 10000000145 (son hane bir eksik);
//   · geçerli IBAN TR33 0006 1005 1978 6457 8413 26 (ISO 13616 / Wikipedia Türkiye örneği), son hanesi değiştirilmiş hâli geçersiz;
//     DE89 3704 0044 0532 0130 00 (geçerli Almanya IBAN'ı) TR olmadığı için reddedilir;
//   · yaş: sahte saat 22.10.2026 → 23.10.1990 doğumlu 35 (doğum günü yarın), 22.10.1990 doğumlu 36 (bugün doğum günü);
//   · Toplam Maaş = yalnız aktif çalışanların maaşı (Aktif Çalışan kartının anlamı; ayrılanın maaşı ödenmez).
// NASIL BOZULUR (önce yazıldı): ayrılış tarihi yazılır ama durum değişmez · tarih silinir, Ayrılanlar'da kalır · yaş elle kalır, eskir · aynı adlı iki çalışan
// birleşir ya da reddedilir · aynı TC iki kart · ayrılış girişten önce · yetkisiz kişi API'den okur · yetkisi kaldırılan hâlâ okur · değer işlem geçmişine
// düşer · 002'nin kartı 001'de görünür · yedekten dönünce kart kaybolur · "Tüm Hareketleri Sil" kartları siler · maaş Kasa/Banka/defterde iz bırakır.
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { after, before, describe, it } from "node:test";
import { ADMIN_PASSWORD, createUser, loginAdmin, startTestServer } from "./helpers.mjs";
import { ADMIN_ONLY, PERMISSION_GROUPS, can, isGrantable, resolvePermissions } from "../server/lib/permissions.mjs";
import { WRITE_PERMISSIONS } from "../server/lib/license.mjs";
import { staffStatus } from "../server/routes/staff.mjs";
import { DatabaseSync } from "node:sqlite";
import { createStore } from "../server/lib/db.mjs";
import { LATEST_VERSION, MIGRATIONS, runMigrations } from "../server/lib/migrations.mjs";

const NOW = { time: "2026-10-22T10:00:00+03:00", fixed: true };
const BASE = "/api/workspace/staff";
const PHOTO = "data:image/jpeg;base64,/9j/4AAQSkZJRgABAQEASABIAAD/2wBDAP//////////////////////////////////////////////////////////////////////////////////////wgALCAABAAEBAREA/8QAFBABAAAAAAAAAAAAAAAAAAAAAP/aAAgBAQABPxA=";
const TC_OK = "10000000146";
const IBAN_OK = "TR33 0006 1005 1978 6457 8413 26";
const data = response => {
  assert.equal(response.status, 200, `beklenen 200: ${response.status} ${JSON.stringify(response.data).slice(0, 300)}`);
  return response.data.data;
};
const FULL = {
  fullName: "Ayşe Yılmaz",
  birthDate: "1990-10-23",
  tcNo: TC_OK,
  address: "Atatürk Cad. No 5, Kadıköy / İstanbul",
  position: "Muhasebe Uzmanı",
  salary: "45.000,50",
  bankName: "Ziraat Bankası",
  iban: IBAN_OK,
  hireDate: "2020-03-01",
  leaveDate: "",
  usedLeaveDays: "6",
  email: "ayse.kisisel@ornek.com",
  phone: "0532 111 22 33",
  education: "Lisans",
  specialty: "Vergi Mevzuatı",
  photo: PHOTO,
};

describe("2.4.4 Personel Özlük: yetki kataloğu", () => {
  it("staff.view / staff.manage varsayılan yalnız yönetici; kişiye ve özel role verilebilir; havuzda Personel Özlük grubunda", () => {
    for (const role of ["avukat", "personel", "muhasebe"]) {
      assert.equal(can(role, "staff.view"), false, `${role} görmez`);
      assert.equal(can(role, "staff.manage"), false, `${role} düzenlemez`);
    }
    assert.ok(resolvePermissions({ role: "admin" }).includes("staff.view") && resolvePermissions({ role: "admin" }).includes("staff.manage"), "yönetici ikisine de sahip");
    assert.ok(isGrantable("staff.view") && isGrantable("staff.manage") && !ADMIN_ONLY.includes("staff.view"), "yönetici başkasına verebilir");
    assert.ok(resolvePermissions({ role: "muhasebe", grants_json: JSON.stringify({ add: ["staff.view"], remove: [] }) }).includes("staff.view"), "kişiye eklenen yetki");
    const group = PERMISSION_GROUPS.find(item => item.id === "staff");
    assert.deepEqual(group?.items.map(([key, label]) => [key, label]), [["staff.view", "Personel Özlük Görüntüleme"], ["staff.manage", "Personel Özlük Düzenleme"]]);
    assert.ok(WRITE_PERMISSIONS.includes("staff.manage") && !WRITE_PERMISSIONS.includes("staff.view"), "salt okunur lisansta düzenleme gizlenir, görüntüleme kalır");
  });
  it("istemci: Personel Raporu düğmesi reports.staff ile; CSS gizleme kuralı reports.view ya da staff.view (CRLF'ye dayanıklı)", () => {
    const css = readFileSync(new URL("../client/assets/hof-ui.css", import.meta.url), "utf8").split(/\r?\n/).join("\n");
    assert.match(css, /html:not\(\.hof-can-reports-view\):not\(\.hof-can-staff-view\) \[data-requires="reports\.staff"\]/);
    const workspace = readFileSync(new URL("../client/assets/hof-workspace.js", import.meta.url), "utf8");
    assert.match(workspace, /action: "reports",[^\n]*requires: "reports\.staff"/);
    const index = readFileSync(new URL("../client/index.html", import.meta.url), "utf8");
    assert.match(index, /<script defer src="\/assets\/hof-staff\.js"><\/script>/);
    // KVKK: rota günlüğe hiçbir şey yazmaz (değer günlüğe çıkamaz).
    const route = readFileSync(new URL("../server/routes/staff.mjs", import.meta.url), "utf8");
    assert.doesNotMatch(route, /\blog\.(info|warn|error|debug)\b|console\./);
  });
});

describe("2.4.4 Personel Özlük: API", () => {
  let server;
  let admin;
  before(async () => {
    server = await startTestServer({ now: NOW });
    admin = await loginAdmin(server);
  });
  after(async () => {
    await server?.close();
  });

  it("boş veri: liste boş, kartların hepsi sıfır", async () => {
    const list = data(await admin.get(BASE));
    assert.deepEqual(list.items, []);
    assert.deepEqual(list.totals, { registered: 0, active: 0, left: 0, salaryMinor: 0 });
    assert.equal(list.today, "2026-10-22");
  });

  it("bütün alanlarla ekle: yaş doğum tarihinden (yarın doğum günü → 35), maaş kuruş, IBAN boşluksuz; listede fotoğraf yok, kartta var", async () => {
    const created = data(await admin.post(BASE, FULL));
    assert.equal(created.age, 35);
    assert.equal(created.salaryMinor, 4_500_050);
    assert.equal(created.iban, "TR330006100519786457841326");
    assert.equal(created.status, "active");
    assert.equal(created.usedLeaveDays, 6);
    assert.equal(created.photo, PHOTO);
    const list = data(await admin.get(BASE));
    assert.equal(list.items.length, 1);
    assert.equal(list.items[0].photo, undefined, "liste fotoğrafı taşımaz");
    assert.equal(list.items[0].hasPhoto, true);
    assert.equal(data(await admin.get(`${BASE}/${created.id}`)).photo, PHOTO);
    const birthday = data(await admin.post(BASE, { fullName: "Bugün Doğan", birthDate: "1990-10-22" }));
    assert.equal(birthday.age, 36, "bugün doğum günü olan bir yaş büyür");
    assert.equal(data(await admin.del(`${BASE}/${birthday.id}`)).deleted, true);
  });

  it("doğrulama: TC, IBAN, tarih sırası, e-posta, öğrenim, izin günü — 400 ve hatalı alan; reddedilen istek kayıt yazmaz", async () => {
    const before = data(await admin.get(BASE)).items.length;
    const cases = [
      [{ tcNo: "10000000145" }, "tcNo"],
      [{ tcNo: "1000000014" }, "tcNo"],
      [{ tcNo: "00000000146" }, "tcNo"],
      [{ iban: "TR330006100519786457841327" }, "iban"],
      [{ iban: "DE89370400440532013000" }, "iban"],
      [{ hireDate: "2020-03-01", leaveDate: "2020-02-28" }, "leaveDate"],
      [{ birthDate: "2026-10-23" }, "birthDate"],
      [{ birthDate: "2000-01-01", hireDate: "1999-12-31" }, "hireDate"],
      [{ hireDate: "2026-02-30" }, "hireDate"],
      [{ email: "ayse@" }, "email"],
      [{ education: "Lise Mezunu" }, "education"],
      [{ usedLeaveDays: "-1" }, "usedLeaveDays"],
      [{ usedLeaveDays: "2,5" }, "usedLeaveDays"],
      [{ fullName: "   " }, "fullName"],
      [{ photo: "data:image/png;base64,iVBORw0KGgo=" }, "photo"],
    ];
    for (const [patch, field] of cases) {
      const response = await admin.post(BASE, { fullName: "Deneme Kişi", ...patch });
      assert.equal(response.status, 400, `${JSON.stringify(patch)} reddedilmeli: ${response.status}`);
      assert.equal(response.data.field, field, `${JSON.stringify(patch)} → alan ${field} (${response.data.error})`);
    }
    assert.equal(data(await admin.get(BASE)).items.length, before, "hiçbiri yazılmadı (veri tabanı sayısı)");
    assert.equal(server.app.store.get("SELECT COUNT(*) AS n FROM staff_members").n, before);
    const sameDay = await admin.post(BASE, { fullName: "Aynı Gün", hireDate: "2024-05-01", leaveDate: "2024-05-01" });
    assert.equal(sameDay.status, 200, "aynı gün giriş ve ayrılış geçerli (ayrılış ≥ giriş)");
    data(await admin.del(`${BASE}/${sameDay.data.data.id}`));
  });

  it("aynı adlı iki çalışan iki ayrı kart; aynı TC No ikinci kartta 409", async () => {
    const first = data(await admin.post(BASE, { fullName: "Mehmet Kaya", position: "Kurye" }));
    const second = data(await admin.post(BASE, { fullName: "Mehmet Kaya", position: "Satış" }));
    assert.notEqual(first.id, second.id);
    const names = data(await admin.get(BASE)).items.filter(item => item.fullName === "Mehmet Kaya").map(item => item.position).sort();
    assert.deepEqual(names, ["Kurye", "Satış"]);
    const duplicate = await admin.post(BASE, { fullName: "Başka Biri", tcNo: TC_OK });
    assert.equal(duplicate.status, 409);
    assert.equal(duplicate.data.field, "tcNo");
    const dupEdit = await admin.put(`${BASE}/${first.id}`, { tcNo: TC_OK });
    assert.equal(dupEdit.status, 409, "düzenlemede de aynı TC başka kartta olamaz");
  });

  it("İşten Ayrılış Tarihi yazılınca Ayrılanlar'a geçer, silinince döner; kartlar ve Toplam Maaş (yalnız aktif) sayılarla", async () => {
    const list0 = data(await admin.get(BASE));
    const ayse = list0.items.find(item => item.fullName === "Ayşe Yılmaz");
    const kaya = list0.items.find(item => item.fullName === "Mehmet Kaya" && item.position === "Kurye");
    data(await admin.put(`${BASE}/${kaya.id}`, { salary: "20.000" }));
    let list = data(await admin.get(BASE));
    assert.deepEqual(list.totals, { registered: 3, active: 3, left: 0, salaryMinor: 4_500_050 + 2_000_000 });
    const moved = data(await admin.put(`${BASE}/${ayse.id}`, { leaveDate: "2026-09-30" }));
    assert.equal(moved.status, "left");
    assert.equal(moved.moved, "left");
    assert.deepEqual(moved.changed, ["İşten Ayrılış Tarihi"]);
    list = data(await admin.get(BASE));
    assert.deepEqual(list.totals, { registered: 3, active: 2, left: 1, salaryMinor: 2_000_000 }, "ayrılanın maaşı Toplam Maaş'a girmez");
    assert.equal(list.items.find(item => item.id === ayse.id).status, "left");
    // Öbür alanlar değişmedi (gövdede olmayan alan korunur).
    const card = data(await admin.get(`${BASE}/${ayse.id}`));
    assert.equal(card.iban, "TR330006100519786457841326");
    assert.equal(card.salaryMinor, 4_500_050);
    assert.equal(card.photo, PHOTO);
    const back = data(await admin.put(`${BASE}/${ayse.id}`, { leaveDate: "" }));
    assert.equal(back.status, "active");
    assert.equal(back.moved, "active");
    assert.deepEqual(data(await admin.get(BASE)).totals, { registered: 3, active: 3, left: 0, salaryMinor: 6_500_050 });
    // Bütün alanlar düzeltilebilir (IBAN, maaş, adres, fotoğraf kaldırma).
    const edited = data(await admin.put(`${BASE}/${ayse.id}`, { iban: "", salary: "47.500", address: "Yeni Adres", photo: "" }));
    assert.equal(edited.iban, "");
    assert.equal(edited.salaryMinor, 4_750_000);
    assert.equal(edited.address, "Yeni Adres");
    assert.equal(edited.hasPhoto, false);
    assert.deepEqual([...edited.changed].sort(), ["Adres", "Fotoğraf", "IBAN", "Maaş"].sort());
  });

  it("KVKK: işlem geçmişine yalnız alan ADLARI yazılır; ad, TC, IBAN, maaş, adres, e-posta, telefon değeri yok", async () => {
    const rows = server.app.store.all("SELECT type, entity_id, payload_json FROM audit_events WHERE type LIKE 'staff.%'");
    assert.ok(rows.some(row => row.type === "staff.created") && rows.some(row => row.type === "staff.updated") && rows.some(row => row.type === "staff.deleted"));
    const all = rows.map(row => `${row.entity_id} ${row.payload_json}`).join("\n");
    for (const secret of ["Ayşe", "Yılmaz", "Mehmet", "Kaya", TC_OK, "TR33", "0006100519786457841326", "4500050", "45000", "47500", "Atatürk", "Yeni Adres", "ornek.com", "0532", "Vergi Mevzuatı", "Ziraat", "/9j/"]) {
      assert.ok(!all.includes(secret), `işlem geçmişinde değer var: ${secret}`);
    }
    const update = rows.filter(row => row.type === "staff.updated").map(row => JSON.parse(row.payload_json));
    assert.ok(update.every(payload => Object.keys(payload).join() === "fields" && payload.fields.every(name => typeof name === "string")), "yük yalnız { fields: [ad…] }");
    // Ekranın gösterdiği kayıt (Yönetim → Değişiklik Geçmişi) da yalnız alan adını taşır.
    const audit = data(await admin.get("/api/admin/audit?limit=50&type=staff."));
    assert.ok(audit.length >= 5 && audit.every(event => event.type.startsWith("staff.")));
  });

  it("maaş yalnız bilgi: Kasa, Banka, cari ve Ana Defter'de iz yok", async () => {
    const store = server.app.store;
    for (const table of ["cash_entries", "payments", "account_entries", "fin_events", "bank_lines"]) {
      const has = store.get("SELECT 1 AS found FROM sqlite_master WHERE type = 'table' AND name = ?", table);
      if (has) assert.equal(store.get(`SELECT COUNT(*) AS n FROM ${table}`).n, 0, `${table} boş kalır`);
    }
    const ledger = data(await admin.get("/api/workspace/ledger"));
    assert.ok(ledger.trial.accounts.every(row => !row.balance), "mizanda bakiye yok");
  });

  it("yetkisiz: personel ve muhasebe 403; görüntüleme verilince okur ama yazamaz; düzenleme de verilince yazar; kaldırılınca 403", async () => {
    const personel = await createUser(server, admin, { username: "per244" });
    const muhasebe = await createUser(server, admin, { username: "muh244", role: "muhasebe" });
    for (const client of [personel, muhasebe]) {
      assert.equal((await client.get(BASE)).status, 403);
      assert.equal((await client.post(BASE, { fullName: "Sızma" })).status, 403);
      const me = data(await client.get("/api/auth/me"));
      assert.ok(Array.isArray(me.permissions) && me.permissions.length > 0, "ekrana giden yetki listesi okundu");
      assert.ok(!me.permissions.includes("staff.view") && !me.permissions.includes("staff.manage"), "ekranda Personel Özlük yok");
    }
    const any = data(await admin.get(BASE)).items[0];
    assert.equal((await personel.get(`${BASE}/${any.id}`)).status, 403, "kart da kapalı");
    assert.equal((await personel.del(`${BASE}/${any.id}`)).status, 403);
    const users = data(await admin.get("/api/admin/users"));
    const target = (Array.isArray(users) ? users : users.users).find(user => user.username === "per244");
    assert.equal((await admin.patch(`/api/admin/users/${target.id}`, { grants: { add: ["staff.view"], remove: [] } })).status, 200);
    const read = data(await personel.get(BASE));
    assert.equal(read.canManage, false);
    assert.equal(read.items.length, 3);
    assert.equal((await personel.post(BASE, { fullName: "Yetkisiz Ekleme" })).status, 403, "görüntüleme yazma vermez");
    assert.equal((await personel.put(`${BASE}/${any.id}`, { position: "x" })).status, 403);
    assert.equal((await admin.patch(`/api/admin/users/${target.id}`, { grants: { add: ["staff.view", "staff.manage"], remove: [] } })).status, 200);
    const added = data(await personel.post(BASE, { fullName: "Yetkiyle Eklenen" }));
    assert.equal(data(await personel.get(BASE)).canManage, true);
    data(await personel.del(`${BASE}/${added.id}`));
    // Yalnız düzenleme (görüntülemesiz) yazamaz: rota ikisini de ister.
    assert.equal((await admin.patch(`/api/admin/users/${target.id}`, { grants: { add: ["staff.manage"], remove: [] } })).status, 200);
    assert.equal((await personel.post(BASE, { fullName: "Görmeden Yazan" })).status, 403);
    assert.equal((await admin.patch(`/api/admin/users/${target.id}`, { grants: { add: [], remove: [] } })).status, 200);
    assert.equal((await personel.get(BASE)).status, 403, "kaldırılınca kapanır");
    assert.equal(server.app.store.get("SELECT COUNT(*) AS n FROM staff_members").n, 3);
  });

  it("002 şirketi ayrı veri: 002'nin kartı 001'de görünmez, 001'inki 002'de görünmez", async () => {
    const second = data(await admin.post("/api/companies", { name: "İkinci Şirket" })).company;
    const q = `?hofCompany=${second.id}`;
    assert.deepEqual(data(await admin.get(`${BASE}${q}`)).items, [], "002 boş başlar");
    const other = data(await admin.post(`${BASE}${q}`, { fullName: "Zeynep Demir", tcNo: TC_OK, salary: "30.000" }));
    assert.equal(other.tcNo, TC_OK, "TC tekilliği şirket içindir (001'de aynı TC başka kişide değil, aynı kişi iki şirkette çalışabilir)");
    assert.deepEqual(data(await admin.get(`${BASE}${q}`)).items.map(item => item.fullName), ["Zeynep Demir"]);
    assert.ok(!data(await admin.get(`${BASE}?hofCompany=sirket-001`)).items.some(item => item.fullName === "Zeynep Demir"));
    assert.equal(data(await admin.get(`${BASE}?hofCompany=sirket-001`)).items.length, 3);
  });

  it("yedek tatbikatı (002): yedek → çalış → geri yükle → sayılar → yeniden çalış; Tüm Hareketleri Sil kartlara dokunmaz, Tümünü Sıfırla siler", async () => {
    const second = data(await admin.get("/api/companies")).all.find(item => item.code === "002");
    const q = `?hofCompany=${second.id}`;
    const snapshot = async () => data(await admin.get(`${BASE}${q}`)).items.map(({ id, fullName, salaryMinor, tcNo, leaveDate }) => ({ id, fullName, salaryMinor, tcNo, leaveDate }));
    const before = await snapshot();
    const backup = data(await admin.post("/api/admin/backups", { scope: "one", companyId: second.id })).backups[0].name;
    const zeynep = before[0];
    data(await admin.put(`${BASE}/${zeynep.id}${q}`, { leaveDate: "2026-10-01", salary: "31.000" }));
    data(await admin.post(`${BASE}${q}`, { fullName: "Yedekten Sonra Eklenen" }));
    assert.notDeepEqual(await snapshot(), before);
    data(await admin.post("/api/admin/backups/restore", { name: backup, company: second.id, confirm: second.code, password: ADMIN_PASSWORD }));
    assert.deepEqual(await snapshot(), before, "geri yüklenince kartlar yedek anındaki gibi");
    data(await admin.post(`${BASE}${q}`, { fullName: "Geri Yüklemeden Sonra" }));
    assert.equal((await snapshot()).length, 2, "geri yüklenen veride yeniden çalışılır");
    data(await admin.post(`/api/companies/${second.id}/reset`, { mode: "movements", confirm: second.code, password: ADMIN_PASSWORD }));
    assert.equal((await snapshot()).length, 2, "Tüm Hareketleri Sil personel kartlarına dokunmaz");
    data(await admin.post(`/api/companies/${second.id}/reset`, { mode: "all", confirm: second.code, password: ADMIN_PASSWORD }));
    assert.deepEqual(await snapshot(), [], "Tümünü Sıfırla kartları siler");
    assert.equal(data(await admin.get(`${BASE}?hofCompany=sirket-001`)).items.length, 3, "001 etkilenmez");
  });
});

describe("2.4.4 Personel Özlük: göç v31 (yalnız ekleyici)", () => {
  it("v30 veri dosyası v31'e geçer: staff_members STRICT olarak açılır, eski tablolar ve satırlar değişmez; ikinci açılış bir şey yapmaz", () => {
    const db = new DatabaseSync(":memory:");
    const store = createStore(db);
    const v30 = MIGRATIONS.filter(item => item.version <= 30);
    for (const migration of v30) store.tx(() => {
      migration.up(store, { company: null, now: () => new Date("2026-10-22T07:00:00Z") });
      store.exec(`PRAGMA user_version = ${migration.version}`);
    });
    assert.equal(store.get("PRAGMA user_version").user_version, 30);
    assert.equal(store.get("SELECT 1 AS found FROM sqlite_master WHERE name = 'staff_members'"), undefined, "v30'da tablo yok");
    const tables = store.all("SELECT name FROM sqlite_master WHERE type = 'table' ORDER BY name").map(row => row.name);
    const result = runMigrations(store, {});
    assert.deepEqual(result.applied, MIGRATIONS.filter(item => item.version > 30).map(item => item.version));
    assert.ok(LATEST_VERSION >= 31);
    assert.equal(db.prepare("SELECT strict FROM pragma_table_list WHERE name = 'staff_members'").get()?.strict, 1);
    const after = store.all("SELECT name FROM sqlite_master WHERE type = 'table' ORDER BY name").map(row => row.name);
    assert.deepEqual(after.filter(name => !tables.includes(name)), ["staff_members"], "yalnız yeni tablo eklendi");
    assert.throws(() => store.run("INSERT INTO staff_members (id, full_name, salary_minor, created_by, created_at) VALUES ('x', 'Eksi', -1, 'u', 'z')"), /CHECK/i, "eksi maaş veri tabanında da reddedilir");
    assert.deepEqual(runMigrations(store, {}).applied, [], "ikinci açılışta göç yok");
    db.close();
  });
});

// Kullanıcı kararı 22.10.2026 ("önerini uygula işten ayrılış tarihi ile alakalı olarak"): İLERİ tarihli İşten Ayrılış Tarihi'nde çalışan ayrılış gününe
// kadar Çalışanlar'da "Ayrılacak" kalır, Toplam Maaş ve Aktif Çalışan'da sayılır; bugün ≥ tarih olunca kendiliğinden Ayrılanlar'a geçer. Kâhin karar metni:
// dün ve bugün → Ayrılan; yarın ve ileri tarih → Aktif + Ayrılacak. Gün sahte saatle (config.now) ilerletilir (ders 13/22).
describe("2.4.4 Personel Özlük: ileri tarihli İşten Ayrılış Tarihi (Ayrılacak)", () => {
  it("kural tek yerde: dün / bugün → Ayrılanlar; yarın / ileri tarih → Çalışanlar + Ayrılacak; tarih yok → Çalışanlar", () => {
    const today = "2026-10-22";
    assert.deepEqual(staffStatus("", today), { status: "active", leaving: false });
    assert.deepEqual(staffStatus("2026-10-21", today), { status: "left", leaving: false });
    assert.deepEqual(staffStatus("2026-10-22", today), { status: "left", leaving: false }, "ayrılış günü gelince Ayrılanlar'a");
    assert.deepEqual(staffStatus("2026-10-23", today), { status: "active", leaving: true });
    assert.deepEqual(staffStatus("2027-01-01", "2026-12-31"), { status: "active", leaving: true }, "yıl dönümü");
    assert.deepEqual(staffStatus("2027-01-01", "2027-01-01"), { status: "left", leaving: false });
  });

  it("API + sahte saat: yarın ayrılacak çalışan bugün sayılır, gün ilerleyince kendiliğinden Ayrılanlar'a geçer", async () => {
    const server = await startTestServer({ now: NOW });
    try {
      const admin = await loginAdmin(server);
      const add = async (fullName, leaveDate, salary) => data(await admin.post(BASE, { fullName, hireDate: "2024-01-01", leaveDate, salary }));
      const dun = await add("Dün Ayrılan", "2026-10-21", "10.000");
      const bugun = await add("Bugün Ayrılan", "2026-10-22", "11.000");
      const yarin = await add("Yarın Ayrılacak", "2026-10-23", "12.000");
      const ileri = await add("Yılbaşı Ayrılacak", "2027-01-01", "13.000");
      const kalan = await add("Kalan Çalışan", "", "14.000");
      assert.deepEqual([dun, bugun, yarin, ileri, kalan].map(item => [item.status, item.leaving]), [["left", false], ["left", false], ["active", true], ["active", true], ["active", false]]);
      const byName = list => Object.fromEntries(list.items.map(item => [item.fullName, `${item.status}${item.leaving ? "+leaving" : ""}`]));
      let list = data(await admin.get(BASE));
      assert.deepEqual(list.totals, { registered: 5, active: 3, left: 2, salaryMinor: 1_200_000 + 1_300_000 + 1_400_000 }, "Ayrılacak çalışan Aktif Çalışan ve Toplam Maaş'ta");
      // Düzenlemede ileri tarih: "Ayrılacak olarak işaretlendi"; geçmiş tarihe çekilince Ayrılanlar'a geçer; silinince döner.
      const marked = data(await admin.put(`${BASE}/${kalan.id}`, { leaveDate: "2026-11-30" }));
      assert.equal(marked.moved, "leaving");
      assert.equal(marked.status, "active");
      assert.equal(data(await admin.put(`${BASE}/${kalan.id}`, { leaveDate: "2026-10-01" })).moved, "left");
      assert.equal(data(await admin.put(`${BASE}/${kalan.id}`, { leaveDate: "" })).moved, "active");
      // Gün ilerler (sunucunun bugünü 23.10): yarın ayrılacak olan kendiliğinden Ayrılanlar'da; yılbaşı ayrılacak olan hâlâ Çalışanlar'da.
      server.clock.set("2026-10-23T10:00:00+03:00");
      list = data(await admin.get(BASE));
      assert.equal(list.today, "2026-10-23");
      assert.deepEqual(byName(list), { "Dün Ayrılan": "left", "Bugün Ayrılan": "left", "Yarın Ayrılacak": "left", "Yılbaşı Ayrılacak": "active+leaving", "Kalan Çalışan": "active" });
      assert.deepEqual(list.totals, { registered: 5, active: 2, left: 3, salaryMinor: 1_300_000 + 1_400_000 });
      assert.equal(data(await admin.get(`${BASE}/${yarin.id}`)).status, "left", "kart da aynı kuralla");
      server.clock.set("2026-12-31T23:00:00+03:00");
      assert.equal(byName(data(await admin.get(BASE)))["Yılbaşı Ayrılacak"], "active+leaving", "yılın son günü hâlâ çalışıyor");
      server.clock.set("2027-01-01T10:00:00+03:00");
      list = data(await admin.get(BASE));
      assert.equal(byName(list)["Yılbaşı Ayrılacak"], "left", "yılbaşında Ayrılanlar'da");
      assert.deepEqual(list.totals, { registered: 5, active: 1, left: 4, salaryMinor: 1_400_000 });
      assert.equal(server.app.store.get("SELECT COUNT(*) AS n FROM staff_members WHERE leave_date = '2027-01-01'").n, 1, "veri değişmedi; durum tarihten türetilir");
    } finally {
      await server.close();
    }
  });
});

// 2.4.4 eleştirmen E5 (31d, yeniden üretildi: t10-personel-iki-kisi): iki kişi aynı kartı düzenler — B formu A'dan önce açmıştı; A maaşı kaydeder, B yalnız
// IBAN'ı değiştirip kaydeder. Beklenen (cari formundaki 2.4.3 UX1 "account-stale" kalıbı): B'ye 409 staff-stale, A'nın maaşı korunur; ileti ne yapılacağını
// söyler, alan DEĞERİ taşımaz (KVKK); reddedilen yazım işlem geçmişine düşmez; silinmiş karta yazım anlamlı ileti verir, kart yeniden doğmaz.
// NASIL BOZULUR (önce yazıldı): A'nın değişikliği sessizce geri alınır · saat donuk / aynı milisaniye / geri alınmış saatte sürüm değişmez · gövde okunurken gelen
// yazım görülmez · "değişiklik yok" kaydı sürümü ilerletip öbürünü boşa reddeder · silinmiş kart yeniden doğar · ileti/yanıt/işlem geçmişi değer taşır · 002 ayrı kalır.
describe("2.4.4 Personel Özlük: iki kişi aynı kartı düzenler (E5, staff-stale)", () => {
  let server;
  let a;
  let b;
  const form = item => ({ fullName: item.fullName, birthDate: item.birthDate, tcNo: item.tcNo, address: item.address, position: item.position, salary: String(item.salaryMinor / 100), bankName: item.bankName, iban: item.iban, hireDate: item.hireDate, leaveDate: item.leaveDate, usedLeaveDays: String(item.usedLeaveDays || ""), email: item.email, phone: item.phone, education: item.education, specialty: item.specialty, photo: item.photo || "" });
  const IBAN_B = "TR320010009999901234567890";
  const audits = id => server.app.store.get("SELECT COUNT(*) AS n FROM audit_events WHERE type = 'staff.updated' AND entity_id = ?", id).n;
  const noValues = (response, values) => {
    const text = JSON.stringify(response.data);
    for (const value of values) assert.ok(!text.includes(value), `yanıtta değer var: ${value}`);
  };
  before(async () => {
    server = await startTestServer({ now: NOW });
    a = await loginAdmin(server);
    const made = await a.post("/api/admin/users", { username: "ik2", name: "İK İki", role: "personel", password: "Personel-2026!x", mustChangePassword: false, grants: { add: ["staff.view", "staff.manage"], remove: [] } });
    assert.equal(made.status, 200, JSON.stringify(made.data));
    b = server.client();
    assert.equal((await b.login("ik2", "Personel-2026!x")).status, 200);
  });
  after(async () => {
    await server?.close();
  });

  it("donuk saatte: B (formu A'dan önce açtı) kaydedince 409 staff-stale; A'nın maaşı korunur; yeniden açınca B'nin kaydı geçer", async () => {
    const card = data(await a.post(BASE, { fullName: "Ali Veli", salary: "1000", iban: IBAN_OK, position: "Kâtip" }));
    const openA = data(await a.get(`${BASE}/${card.id}`));
    const openB = data(await b.get(`${BASE}/${card.id}`));
    const pa = data(await a.put(`${BASE}/${card.id}`, { ...form(openA), salary: "2000", updatedAt: openA.updatedAt }));
    assert.deepEqual(pa.changed, ["Maaş"]);
    const pb = await b.put(`${BASE}/${card.id}`, { ...form(openB), iban: IBAN_B, updatedAt: openB.updatedAt });
    assert.equal(pb.status, 409, `B'nin bayat kaydı reddedilmeli: ${pb.status} ${JSON.stringify(pb.data).slice(0, 200)}`);
    assert.equal(pb.data.code, "staff-stale");
    assert.notEqual(pa.updatedAt, openA.updatedAt, "saat donukken de sürüm ilerler");
    assert.match(pb.data.error, /siz açtıktan sonra başka biri değiştirdi; değişiklikleriniz kaydedilmedi\. Kartı yeniden açıp tekrar kaydedin\./);
    noValues(pb, ["Ali", "Veli", "1000", "2000", "200000", "TR33", "TR32", "0006100519786457841326", "Kâtip"]);
    let end = data(await a.get(`${BASE}/${card.id}`));
    assert.equal(end.salaryMinor, 200_000, "A'nın maaş değişikliği korunur");
    assert.equal(end.iban, "TR330006100519786457841326", "bayat kayıt hiçbir alanı yazmaz");
    assert.equal(audits(card.id), 1, "reddedilen yazım işlem geçmişine düşmez");
    // B kartı yeniden açar (güncel sürüm), IBAN'ı yeniden yazar: geçer, A'nın maaşı kalır.
    const again = data(await b.get(`${BASE}/${card.id}`));
    const ok2 = data(await b.put(`${BASE}/${card.id}`, { ...form(again), iban: IBAN_B, updatedAt: again.updatedAt }));
    assert.deepEqual(ok2.changed, ["IBAN"]);
    end = data(await a.get(`${BASE}/${card.id}`));
    assert.deepEqual([end.salaryMinor, end.iban], [200_000, IBAN_B]);
    // "Değişiklik yok" kaydı sürümü ilerletmez: öbür kişinin elindeki güncel form boşa reddedilmez.
    const same = data(await a.put(`${BASE}/${card.id}`, { ...form(end), updatedAt: end.updatedAt }));
    assert.deepEqual([same.changed, same.updatedAt], [[], end.updatedAt]);
    assert.equal((await b.put(`${BASE}/${card.id}`, { ...form(end), position: "Baş Kâtip", updatedAt: end.updatedAt })).status, 200);
    // Eski sürümle "değişiklik yok" kaydı da 409 (ne yazılacağı belirsiz; kullanıcı güncel kartı görür).
    assert.equal((await a.put(`${BASE}/${card.id}`, { ...form(end), updatedAt: end.updatedAt })).status, 409);
  });

  it("saat geri alınınca da sürüm ilerler: bayat kayıt yine 409", async () => {
    const card = data(await a.post(BASE, { fullName: "Saat Geri", salary: "5000" }));
    const openB = data(await b.get(`${BASE}/${card.id}`));
    server.clock.set("2026-10-22T09:00:00+03:00");
    try {
      const pa = data(await a.put(`${BASE}/${card.id}`, { salary: "6000", updatedAt: card.updatedAt }));
      const pb = await b.put(`${BASE}/${card.id}`, { ...form(openB), phone: "0555 000 00 00", updatedAt: openB.updatedAt });
      assert.equal(pb.status, 409, `saat geri alındıktan sonra bayat kayıt: ${pb.status}`);
      assert.ok(pa.updatedAt > card.updatedAt, `sürüm geriye gitmez: ${card.updatedAt} → ${pa.updatedAt}`);
      assert.equal(data(await a.get(`${BASE}/${card.id}`)).salaryMinor, 600_000);
    } finally {
      server.clock.set(NOW.time);
    }
  });

  it("gövde okunurken gelen yazım görülür: B'nin yavaş gövdesi A'nın kaydından sonra biterse 409", async () => {
    const card = data(await a.post(BASE, { fullName: "Yavaş Gövde", salary: "7000" }));
    const openB = data(await b.get(`${BASE}/${card.id}`));
    const payload = Buffer.from(JSON.stringify({ ...form(openB), iban: IBAN_B, updatedAt: openB.updatedAt }));
    const http = await import("node:http");
    let request;
    const slow = new Promise((resolve, reject) => {
      request = http.request(`${server.base}${BASE}/${card.id}`, { method: "PUT", headers: { cookie: b.cookie, "content-type": "application/json", "content-length": payload.length } }, response => {
        let raw = "";
        response.on("data", chunk => (raw += chunk));
        response.on("end", () => resolve({ status: response.statusCode, data: JSON.parse(raw || "{}") }));
      });
      request.on("error", reject);
      request.write(payload.subarray(0, 20));
    });
    await new Promise(resolve => setTimeout(resolve, 150));
    assert.equal((await a.put(`${BASE}/${card.id}`, { salary: "8000", updatedAt: openB.updatedAt })).status, 200, "A kaydeder (B'nin gövdesi yolda)");
    request.end(payload.subarray(20));
    const pb = await slow;
    assert.equal(pb.status, 409, `gövde okunurken gelen yazım görülmeli: ${pb.status} ${JSON.stringify(pb.data).slice(0, 200)}`);
    assert.equal(pb.data.code, "staff-stale");
    assert.equal(data(await a.get(`${BASE}/${card.id}`)).salaryMinor, 800_000);
  });

  it("silinmiş karta yazım: 404 staff-missing, ileti ne olduğunu ve ne yapılacağını söyler, kart yeniden doğmaz", async () => {
    const card = data(await a.post(BASE, { fullName: "Silinecek Kart", salary: "9000" }));
    const openB = data(await b.get(`${BASE}/${card.id}`));
    data(await a.del(`${BASE}/${card.id}`));
    const pb = await b.put(`${BASE}/${card.id}`, { ...form(openB), iban: IBAN_B, updatedAt: openB.updatedAt });
    assert.equal(pb.status, 404);
    assert.equal(pb.data.code, "staff-missing");
    assert.match(pb.data.error, /siz düzenlerken silinmiş; değişiklikler kaydedilmedi\. Pencereyi kapatın; kart gerekiyorsa Yeni Personel ile yeniden ekleyin\./);
    noValues(pb, ["Silinecek", "9000", "TR32"]);
    assert.equal(server.app.store.get("SELECT COUNT(*) AS n FROM staff_members WHERE id = ?", card.id).n, 0);
  });

  it("002 şirketinde aynı kural; sürüm göndermeyen kısmi çağrı yalnız gönderdiği alanı yazar", async () => {
    const second = data(await a.post("/api/companies", { name: "İkinci Şirket" })).company;
    const q = `?hofCompany=${second.id}`;
    const card = data(await a.post(`${BASE}${q}`, { fullName: "Zeynep Demir", salary: "3000" }));
    data(await a.put(`${BASE}/${card.id}${q}`, { salary: "3500", updatedAt: card.updatedAt }));
    const stale = await a.put(`${BASE}/${card.id}${q}`, { ...form(card), iban: IBAN_B, updatedAt: card.updatedAt });
    assert.equal(stale.status, 409);
    assert.equal(stale.data.code, "staff-stale");
    const partial = data(await a.put(`${BASE}/${card.id}${q}`, { phone: "0532 000 00 00" }));
    assert.deepEqual([partial.changed, partial.salaryMinor, partial.phone], [["Telefon"], 350_000, "0532 000 00 00"]);
  });
});
