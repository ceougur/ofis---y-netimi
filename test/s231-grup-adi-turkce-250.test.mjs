// 2.5.0 S231 = A (S223 küçük turunun KULLANICIYA SORULMALI 1'i; kullanıcının 14.11 06:31 kuralıyla öneri uygulandı): içe aktarmalarda (taksit Excel /
// Sheets, cari Excel / Sheets, Tablodan Aktar) GRUP / ALT GRUP adı da S228 sırasıyla bulunur — önce BUGÜNKÜ karşılaştırma (SQLite NOCASE; yalnız A–Z
// katlanır) tek grup buluyorsa o; bulamazsa Türkçe harf katlamalı (lib/names.mjs foldPersonName; I / ı, İ / i, Ş Ğ Ü Ö Ç, boşluk) TEK grup; o da tek
// değilse bugünkü gibi yeni grup açılır. Önceden telefonsuz kişi 'aynı grup'la eşleştiği için 'IŞIK SERVİSİ' yazımı yeni grup + yeni cari + yeni kart
// açıyordu: ÇİFT CARİ, AYNI BORÇ İKİ KEZ. Elle grup açma / yeniden adlandırma formu DEĞİŞMEZ; var olan çift gruplar birleştirilmez.
// Sahte saat 08.10.2026 (config.now). Sayılar veri tabanından (grup / cari / kart satırı) ve mizandan (120) okunur.
// NASIL BOZARIM (mutantlar): grup katlamasını kaldırmak; S228 sırasını ters çevirmek (Türkçe önce); elle grup formunu da katlamalı yapmak; aynı yüklemede
// açılan grubu haritaya eklememek; geri alınmış iç işlemin grubunu aday saymak; katlamayla bulunan var olan grubu Tablodan Aktar'ın Geri Al listesine koymak.
import assert from "node:assert/strict";
import { after, before, describe, it } from "node:test";
import { boot, must } from "./banka-210-ortak.mjs";

const NOW = "2026-10-08T12:00:00+03:00";
const DUP_CARD = "Aynı adla açık kart var";
const PLAN_HEAD = ["Ad Soyad", "Telefon", "Grup", "Alt Grup", "Toplam Tutar", "Taksit Sayısı", "İlk Vade", "Kayıt Tarihi"];
const PLAN_ROLES = { 0: "name", 1: "phone", 2: "group", 3: "subgroup", 4: "total", 5: "count", 6: "firstDue", 7: "registered" };
const planRow = (name, phone, total, group, { subgroup = "", registered = "" } = {}) => [name, phone, group, subgroup, total, "2", "01.11.2026", registered];
const ACC_HEAD = ["Ad Soyad", "Telefon", "Grup"];
const ACC_ROLES = { 0: "name", 1: "phone", 2: "group" };

describe("S231 = A — içe aktarmalarda grup / alt grup adı Türkçe harf katlamalı (S228 sırası)", () => {
  let ctx;
  let api;
  const count = (sql, ...args) => ctx.store.get(sql, ...args).n;
  const groupCount = () => count("SELECT COUNT(*) AS n FROM plan_groups");
  const groupsNamed = (name, parentId = "") => ctx.store.all("SELECT id FROM plan_groups WHERE name = ? AND COALESCE(parent_id, '') = ? ORDER BY rowid", name, parentId).map(row => row.id);
  const liveAccounts = () => count("SELECT COUNT(*) AS n FROM accounts WHERE deleted_at IS NULL");
  const cardOf = name => ctx.store.get("SELECT id, account_id AS accountId, group_id AS groupId, subgroup_id AS subgroupId, total FROM plans WHERE deleted_at IS NULL AND name = ? ORDER BY rowid DESC", name);
  const cards = accountId => ctx.store.all("SELECT total FROM plans WHERE deleted_at IS NULL AND account_id = ? ORDER BY rowid", accountId).map(item => item.total);
  const account = async (name, phone = "", extra = {}) => (await must(`cari ${name}`, api.post("/api/workspace/accounts", { name, phone, type: "customer", registeredOn: "2026-10-01", ...extra }))).id;
  const newGroup = async (name, parentId = "") => (await must(`grup ${name}`, api.post("/api/workspace/plans/groups", parentId ? { name, parentId } : { name }))).id;
  const loadPlans = async (rows, fileName) => must(`taksit yükle ${fileName}`, api.post("/api/workspace/plans/import", { matrix: [PLAN_HEAD, ...rows], headerAt: 0, roles: PLAN_ROLES, linkRecords: false, fileName }));
  const loadAccounts = async (rows, fileName) => must(`cari yükle ${fileName}`, api.post("/api/workspace/accounts/import", { matrix: [ACC_HEAD, ...rows], headerAt: 0, roles: ACC_ROLES, mode: "skip", fileName }));
  const reasons = report => report.skipped.map(item => item.reason);
  const gl120 = async () => Number((await must("mizan", api.get("/api/workspace/ledger"))).trial.accounts.find(item => item.code === "120")?.balance || 0);
  const integrity = async label => {
    const result = await must("Mutabakat Testi", api.get("/api/workspace/ledger/integrity"));
    assert.equal(result.ok, true, `${label}: Mutabakat Testi bulgulu ${JSON.stringify(result.failures).slice(0, 600)}`);
  };
  let isik; // 'Işık Servisi' grubunun kimliği (1'de açılır)
  before(async () => {
    ctx = await boot({ now: NOW, env: { HUKUK_LICENSE_URL: "http://127.0.0.1:9" } });
    api = ctx.api;
  });
  after(() => ctx?.server.close());

  it("(1) S231 örneği: önce 'Elif Su' / 'Işık Servisi', sonra 'ELİF SU' / 'IŞIK SERVİSİ' (ikisi de telefonsuz) → AYNI grup, AYNI cari, TEK borç", async () => {
    const before120 = await gl120();
    const first = await loadPlans([planRow("Elif Su", "", "1.000", "Işık Servisi")], "s231-1a.xlsx");
    assert.equal(first.created, 1);
    assert.equal(first.groups, 1);
    [isik] = groupsNamed("Işık Servisi");
    const elif = cardOf("Elif Su").accountId;
    const groupsBefore = groupCount();
    const accountsBefore = liveAccounts();
    const second = await loadPlans([planRow("ELİF SU", "", "1.000", "IŞIK SERVİSİ")], "s231-1b.xlsx");
    assert.equal(groupCount(), groupsBefore, `yeni grup açıldı (çift grup 'IŞIK SERVİSİ'): rapor groups=${second.groups}`);
    assert.equal(second.groups, 0);
    assert.deepEqual(reasons(second), [DUP_CARD], `ikinci satır: ${JSON.stringify(second.skipped)} created=${second.created}`);
    assert.equal(second.created, 0, "çift kart (aynı borç iki kez)");
    assert.equal(liveAccounts(), accountsBefore, "çift cari");
    assert.deepEqual(cards(elif), [1000]);
    assert.equal(await gl120(), before120 + 1000, "120'de borç bir kez");
    await integrity("(1)");
  });

  it("(2) grup adı varyantları (ı / I, İ / i, küçük harf, boşluk, karışık) var olan 'Işık Servisi' grubunu bulur; 'ŞUBE A' ↔ 'Şube A' bugün de aynı (denetim)", async () => {
    const groupsBefore = groupCount();
    const variants = ["ışık servisi", "IŞIK  SERVİSİ", " Işık Servisi ", "IşIK sErVİsİ", "IŞIK\tSERVİSİ"];
    const people = ["Aras Bilge", "Bora Cem", "Cansu Dal", "Doruk Eren", "Ekin Fer"];
    const report = await loadPlans(variants.map((group, i) => planRow(people[i], "", "100", group)), "s231-2.xlsx");
    assert.equal(report.created, variants.length);
    assert.equal(groupCount(), groupsBefore, `yeni grup açıldı: ${report.groups}`);
    for (const name of people) assert.equal(cardOf(name).groupId, isik, `${name}: kart 'Işık Servisi' grubunda değil`);
    const sube = await loadPlans([planRow("Fethi Gül", "", "100", "Şube A"), planRow("Gaye Hür", "", "100", "ŞUBE A")], "s231-2b.xlsx");
    assert.equal(sube.groups, 1, "NOCASE (A–Z) zaten aynı sayıyordu");
    assert.equal(cardOf("Fethi Gül").groupId, cardOf("Gaye Hür").groupId);
  });

  it("(3) telefonsuz kişi + aynı grup: büyük harfli grup yazımıyla var olan carisine bağlanır; aynı adlı iki kişi (iki ayrı grupta) kendi grubundaki carisine", async () => {
    const tuna = await account("Tuna Işıklı", "", { groupId: isik });
    const ilgaz = await newGroup("Ilgaz Hattı");
    const canA = await account("Can Er", "", { groupId: isik });
    const canB = await account("Can Er", "", { groupId: ilgaz });
    const accountsBefore = liveAccounts();
    const groupsBefore = groupCount();
    const before120 = await gl120();
    const report = await loadPlans([planRow("Tuna Işıklı", "", "300", "IŞIK SERVİSİ"), planRow("CAN ER", "", "400", "ILGAZ HATTI"), planRow("CAN ER", "", "500", "ışık servisi")], "s231-3.xlsx");
    assert.equal(groupCount(), groupsBefore, `yeni grup açıldı: ${report.groups}`);
    assert.equal(liveAccounts(), accountsBefore, "yeni (çift) cari açıldı");
    assert.equal(report.created, 3);
    assert.equal(report.linked, 3);
    assert.deepEqual(cards(tuna), [300]);
    assert.deepEqual(cards(canB), [400], "'ILGAZ HATTI' satırı 'Ilgaz Hattı'ndaki Can Er'e");
    assert.deepEqual(cards(canA), [500], "'ışık servisi' satırı 'Işık Servisi'ndeki Can Er'e");
    assert.equal(await gl120(), before120 + 1200);
    await integrity("(3)");
  });

  it("(4) telefonlu kişi: grup eşleşmesi kişi eşleşmesini değiştirmez (telefonla var olan cariye); kart var olan gruba", async () => {
    const burak = await account("Burak Ün", "0545 201 00 01");
    const groupsBefore = groupCount();
    const report = await loadPlans([planRow("BURAK ÜN", "0545 201 00 01", "700", "IŞIK SERVİSİ")], "s231-4.xlsx");
    assert.equal(report.linked, 1);
    assert.deepEqual(cards(burak), [700]);
    assert.equal(groupCount(), groupsBefore, `yeni grup açıldı: ${report.groups}`);
    assert.equal(cardOf("BURAK ÜN").groupId, isik);
  });

  it("(5) alt grup: 'YILDIZ SİTESİ' / 'İÇ BLOK' var olan 'Yıldız Sitesi' › 'İç Blok'u bulur; aynı adlı alt grup BAŞKA ana grupta ayrı kalır", async () => {
    const first = await loadPlans([planRow("Ece Naz", "", "100", "Yıldız Sitesi", { subgroup: "İç Blok" })], "s231-5a.xlsx");
    assert.equal(first.groups, 2);
    const [yildiz] = groupsNamed("Yıldız Sitesi");
    const [ic] = groupsNamed("İç Blok", yildiz);
    assert.ok(yildiz && ic);
    const groupsBefore = groupCount();
    const second = await loadPlans([planRow("Ada Gül", "", "100", "YILDIZ SİTESİ", { subgroup: "İÇ BLOK" }), planRow("Su Ay", "", "100", "yıldız sitesi", { subgroup: "iç blok" })], "s231-5b.xlsx");
    assert.equal(groupCount(), groupsBefore, `yeni grup / alt grup açıldı: ${second.groups}`);
    for (const name of ["Ada Gül", "Su Ay"]) {
      const card = cardOf(name);
      assert.deepEqual([card.groupId, card.subgroupId], [yildiz, ic], `${name}`);
    }
    const other = await loadPlans([planRow("Ela Naz", "", "100", "Kuzey Sitesi", { subgroup: "İÇ BLOK" })], "s231-5c.xlsx");
    assert.equal(other.groups, 2, "başka ana grubun alt grubu ayrı açılır");
    const [kuzey] = groupsNamed("Kuzey Sitesi");
    assert.deepEqual([cardOf("Ela Naz").groupId, cardOf("Ela Naz").subgroupId], [kuzey, groupsNamed("İÇ BLOK", kuzey)[0]]);
    assert.notEqual(groupsNamed("İÇ BLOK", kuzey)[0], ic);
  });

  it("(6) S228 sırası — var olan ÇİFT grup ('Çınar Durağı' + 'ÇINAR DURAĞI', elle açılmış): birebir yazım bugünkü grubuna; iki adaylı yazım bugünkü gibi yeni grup; elle grup formu katlamasız (DEĞİŞMEDİ)", async () => {
    const lower = await newGroup("Çınar Durağı");
    const upper = await newGroup("ÇINAR DURAĞI");
    assert.notEqual(upper, lower, "elle grup formu 'ÇINAR DURAĞI'yı yeni grup açmalı (bugünkü kural)");
    const groupsBefore = groupCount();
    const report = await loadPlans([planRow("Deniz Ak", "", "100", "ÇINAR DURAĞI"), planRow("Defne Ak", "", "100", "Çınar Durağı"), planRow("Derin Ak", "", "100", "çınar durağı")], "s231-6.xlsx");
    assert.equal(cardOf("Deniz Ak").groupId, upper, "birebir yazım 'ÇINAR DURAĞI' grubuna");
    assert.equal(cardOf("Defne Ak").groupId, lower, "birebir yazım 'Çınar Durağı' grubuna");
    assert.ok(![upper, lower].includes(cardOf("Derin Ak").groupId), "iki adaylı yazım ikisinden birine bağlanmamalı");
    assert.equal(groupCount(), groupsBefore + 1, "iki adaylı yazım bugünkü gibi yeni grup");
  });

  it("(7) aynı dosyada iki yazım: ilk satırın açtığı 'Ilıca Yolu' ikinci ve üçüncü satıra görünür (tek grup)", async () => {
    const groupsBefore = groupCount();
    const report = await loadPlans([planRow("Mert Can", "", "100", "Ilıca Yolu"), planRow("Selin Ak", "", "100", "ILICA YOLU"), planRow("Tan Ak", "", "100", "ılıca yolu")], "s231-7.xlsx");
    assert.equal(report.created, 3);
    assert.equal(groupCount(), groupsBefore + 1, `tek grup beklenirdi, açılan: ${report.groups}`);
    assert.equal(report.groups, 1);
    const [ilica] = groupsNamed("Ilıca Yolu");
    for (const name of ["Mert Can", "Selin Ak", "Tan Ak"]) assert.equal(cardOf(name).groupId, ilica, name);
  });

  it("(8) kilitli dönem: geri alınan satırın açtığı grup sonraki (başka yazımlı) satıra aday olmaz; kartın grubu var", async () => {
    assert.equal((await api.put("/api/admin/period-lock", { lockedUntil: "2026-09-30" })).status, 200);
    try {
      const groupsBefore = groupCount();
      const report = await loadPlans([planRow("Kaan Ilgın", "", "100", "Ihlamur Sokak", { registered: "15.09.2026" }), planRow("Lale Ilgın", "", "100", "IHLAMUR SOKAK")], "s231-8.xlsx");
      assert.equal(report.created, 1);
      assert.match(report.skipped[0]?.reason || "", /kapatılmış \(kilitli\) dönemde/);
      assert.equal(report.groups, 1);
      assert.equal(groupCount(), groupsBefore + 1);
      const card = cardOf("Lale Ilgın");
      assert.equal(count("SELECT COUNT(*) AS n FROM plan_groups WHERE id = ?", card.groupId), 1, "kartın grubu var (geri alınmış grup değil)");
      assert.deepEqual(groupsNamed("Ihlamur Sokak"), [], "geri alınan satırın grubu kalmadı");
    } finally {
      assert.equal((await api.put("/api/admin/period-lock", { lockedUntil: "" })).status, 200);
    }
  });

  it("(9) Tablodan Aktar: sayfa adı 'IŞIL KAFE' var olan 'Işıl Kafe' grubunu bulur — ön izleme 'eşleşen cari', aktarım yeni grup / cari açmaz; Geri Al var olan grubu SİLMEZ", async () => {
    const kafe = await newGroup("Işıl Kafe");
    const kerem = await account("Kerem Tan", "", { groupId: kafe });
    const sheets = [{ name: "IŞIL KAFE", matrix: [["Dosya No", "Ad Soyad", "Telefon", "Toplam Tutar", "Ödenen", "Taksit Sayısı", "İlk Vade"], ["T-1", "KEREM TAN", "", 2400, 0, 2, "2026-11-01"]] }];
    const staged = await must("tablo", api.post("/api/workspace/dataset/stage", { kind: "excel", fileName: "s231-t.xlsx", sheets }));
    await must("tablo kaydet", api.post("/api/workspace/dataset/commit", { stageId: staged.stageId, mode: "replace" }));
    const preview = await must("ön izleme", api.get("/api/workspace/plans/from-table"));
    const record = preview.records.find(item => item.name === "KEREM TAN");
    assert.ok(record, "kayıt ön izlemede");
    assert.equal(record.account, "match", `ön izleme: ${JSON.stringify({ account: record.account, accountName: record.accountName, groupName: record.groupName })}`);
    assert.equal(record.accountName, "Kerem Tan");
    const groupsBefore = groupCount();
    const accountsBefore = liveAccounts();
    const before120 = await gl120();
    const result = await must("aktar", api.post("/api/workspace/plans/from-table", { keys: [record.key], fingerprint: preview.fingerprint }));
    assert.equal(result.created, 1);
    assert.equal(groupCount(), groupsBefore, "aktarım yeni grup açtı");
    assert.equal(result.accountsCreated, 0, `yeni cari açıldı: ${result.accountsCreated}`);
    assert.equal(liveAccounts(), accountsBefore);
    assert.deepEqual(cards(kerem), [2400]);
    assert.equal(cardOf("KEREM TAN").groupId, kafe);
    assert.equal(await gl120(), before120 + 2400);
    await must("geri al", api.post(`/api/workspace/plans/imports/${result.importId}/undo`, {}));
    assert.deepEqual(cards(kerem), []);
    assert.equal(count("SELECT COUNT(*) AS n FROM plan_groups WHERE id = ?", kafe), 1, "Geri Al var olan 'Işıl Kafe' grubunu sildi");
    assert.equal(ctx.store.get("SELECT group_id AS g FROM accounts WHERE id = ?", kerem).g, kafe);
    assert.equal(await gl120(), before120);
    await integrity("(9)");
  });

  it("(10) cari Excel'in grup kolonu: 'IŞIL KAFE' yazımı var olan 'Işıl Kafe' grubuna (yeni grup açılmaz)", async () => {
    const [kafe] = groupsNamed("Işıl Kafe");
    const groupsBefore = groupCount();
    const report = await loadAccounts([["Nazlı Ilgaz", "0546 210 00 01", "IŞIL KAFE"], ["Okan Ilgaz", "0546 210 00 02", "Işıl Kafe"]], "s231-10.xlsx");
    assert.equal(report.created, 2);
    assert.equal(groupCount(), groupsBefore, `yeni grup açıldı: ${report.groups}`);
    assert.equal(report.groups, 0);
    for (const name of ["Nazlı Ilgaz", "Okan Ilgaz"]) assert.equal(ctx.store.get("SELECT group_id AS g FROM accounts WHERE deleted_at IS NULL AND name = ?", name).g, kafe, name);
  });

  it("(11) elle grup formu ve yeniden adlandırma DEĞİŞMEDİ: 'IŞIK SERVİSİ' elle yeni grup açar; 'ılgaz hattı' adına yeniden adlandırma çakışma saymaz; NOCASE çakışması bugünkü gibi reddedilir", async () => {
    const manual = await newGroup("IŞIK SERVİSİ");
    assert.notEqual(manual, isik, "elle form katlamalı olmamalı (bugünkü kural)");
    const spare = await newGroup("Geçici Grup");
    assert.equal((await api.put(`/api/workspace/plans/groups/${spare}`, { name: "ılgaz hattı" })).status, 200, "NOCASE'te farklı ad ('Ilgaz Hattı' ↔ 'ılgaz hattı'): yeniden adlandırma bugünkü gibi kabul");
    const clash = await api.put(`/api/workspace/plans/groups/${spare}`, { name: "iŞIK SERVİSİ" });
    assert.equal(clash.status, 400, "NOCASE'te aynı ad ('IŞIK SERVİSİ' ↔ 'iŞIK SERVİSİ'): bugünkü gibi çakışma");
    await integrity("(11)");
  });
});
