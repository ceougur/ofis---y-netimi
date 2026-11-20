// 2.5.0 S223 = A + S228 = A (kullanıcı 20.11.2026 14:47 "önerilerini yap"; S228 öneri A görev metninde): kişi eşleştiren içe aktarmalarda (cari Excel /
// Sheets, taksit Excel / Sheets, çek / senet içe aktarma, Tablodan Aktar) cari adı Türkçe harf katlamalı TEK yardımcıyla (lib/names.mjs foldPersonName;
// büyük / küçük harf, boşluk, Unicode biçimi) karşılaştırılır. Önceden veri tabanının NOCASE katlaması (yalnız A–Z) kullanılıyordu: Excel'de ad BÜYÜK
// HARFLE yazılınca ('AHMET YILMAZ' ↔ 'Ahmet Yılmaz') aynı kişi farklı sayılıyor → yeni cari, yeni kart: ÇİFT CARİ ve ÇİFT BORÇ (v2.4.9'da da).
// S228 = A SIRASI: önce BUGÜNKÜ karşılaştırma (NOCASE) kesin cari / kart buluyorsa o (bugün bağlanan satır DEĞİŞMEZ); hiç bulamıyorsa Türkçe katlamalı;
// o da tek değilse bugünkü şüpheli davranış. Var olan çift cariler birleştirilmez.
// Sahte saat 08.10.2026 (config.now). Sayılar veri tabanından (cari / kart / çek satırı) ve mizandan (120) okunur.
// NASIL BOZARIM (mutantlar): katlamayı İngilizceye geri döndürmek; çek / senette Türkçe katlamayı unutmak; S228 sırasını ters çevirmek (Türkçe önce);
// aynı yüklemede açılan cariyi haritaya eklememek; boşluk düzeltmesini kaldırmak; yinelenen kart anahtarını eski katlamada bırakmak; geri alınmış
// iç işlemin carisini aday saymak.
import assert from "node:assert/strict";
import { after, before, describe, it } from "node:test";
import { boot, must } from "./banka-210-ortak.mjs";
import * as names from "../server/lib/names.mjs";

const NOW = "2026-10-08T12:00:00+03:00";
const EXISTS = "Bu cari zaten var";
const DUP_CARD = "Aynı adla açık kart var";
const AMBIGUOUS = "Aynı adlı birden çok kişi var; telefonunu ekleyip yeniden yükleyin";
const ACC_HEAD = ["Cari No", "Ad Soyad", "Telefon"];
const ACC_ROLES = { 0: "seq", 1: "name", 2: "phone" };
const PLAN_HEAD = ["Ad Soyad", "Telefon", "Grup", "Toplam Tutar", "Taksit Sayısı", "İlk Vade", "Kayıt Tarihi"];
const PLAN_ROLES = { 0: "name", 1: "phone", 2: "group", 3: "total", 4: "count", 5: "firstDue", 6: "registered" };
const planRow = (name, phone, total, { group = "", registered = "" } = {}) => [name, phone, group, total, "2", "01.11.2026", registered];
const CHQ_HEAD = ["Çek No", "Banka", "Keşideci", "Tutar", "Vade"];
const CHQ_ROLES = { 0: "serial", 1: "bank", 2: "drawer", 3: "amount", 4: "due" };

describe("S223 = A / S228 = A — içe aktarmalarda Türkçe harf katlamalı kişi adı", () => {
  let ctx;
  let api;
  const count = (sql, ...args) => ctx.store.get(sql, ...args).n;
  const accountsNamed = name => ctx.store.all("SELECT id, name, phone FROM accounts WHERE deleted_at IS NULL AND name = ? ORDER BY rowid", name);
  const liveAccounts = () => count("SELECT COUNT(*) AS n FROM accounts WHERE deleted_at IS NULL");
  const livePlans = () => count("SELECT COUNT(*) AS n FROM plans WHERE deleted_at IS NULL");
  const cards = accountId => ctx.store.all("SELECT id, total FROM plans WHERE deleted_at IS NULL AND account_id = ? ORDER BY rowid", accountId).map(item => item.total);
  const account = async (name, phone = "", extra = {}) => (await must(`cari ${name}`, api.post("/api/workspace/accounts", { name, phone, type: "customer", registeredOn: "2026-10-01", ...extra }))).id;
  const loadAccounts = async (rows, fileName, mode = "skip") => must(`cari yükle ${fileName}`, api.post("/api/workspace/accounts/import", { matrix: [ACC_HEAD, ...rows], headerAt: 0, roles: ACC_ROLES, mode, fileName }));
  const loadPlans = async (rows, fileName) => must(`taksit yükle ${fileName}`, api.post("/api/workspace/plans/import", { matrix: [PLAN_HEAD, ...rows], headerAt: 0, roles: PLAN_ROLES, linkRecords: false, fileName }));
  const loadCheques = async (rows, fileName) => must(`çek yükle ${fileName}`, api.post("/api/workspace/cheques/import", { matrix: [CHQ_HEAD, ...rows], headerAt: 0, roles: CHQ_ROLES, direction: "in", fileName }));
  const reasons = report => report.skipped.map(item => item.reason);
  const gl120 = async () => Number((await must("mizan", api.get("/api/workspace/ledger"))).trial.accounts.find(item => item.code === "120")?.balance || 0);
  const integrity = async label => {
    const result = await must("Mutabakat Testi", api.get("/api/workspace/ledger/integrity"));
    assert.equal(result.ok, true, `${label}: Mutabakat Testi bulgulu ${JSON.stringify(result.failures).slice(0, 600)}`);
  };
  before(async () => {
    ctx = await boot({ now: NOW, env: { HUKUK_LICENSE_URL: "http://127.0.0.1:9" } });
    api = ctx.api;
  });
  after(() => ctx?.server.close());

  it("(0) foldPersonName = foldName (bütün Unicode kod noktaları + I / İ / birleşen nokta bileşimleri); örnek katlamalar", () => {
    assert.equal(typeof names.foldPersonName, "function", "kişi adı katlama yardımcısı (lib/names.mjs foldPersonName) yok");
    const { foldName, foldPersonName } = names;
    let differences = 0;
    for (let code = 0; code <= 0x10ffff; code += 1) {
      if (code >= 0xd800 && code <= 0xdfff) continue;
      const char = String.fromCodePoint(code);
      for (const value of [char, `A${char}`, `${char}̇`, `I${char}`, `İ${char}`, ` ${char}  ${char}\t`]) if (foldName(value) !== foldPersonName(value)) differences += 1;
    }
    assert.equal(differences, 0, "hızlı katlama Türkçe yerel ayarlı katlamayla aynı olmalı");
    const same = (a, b) => assert.equal(foldPersonName(a), foldPersonName(b), `${JSON.stringify(a)} ↔ ${JSON.stringify(b)}`);
    same("AHMET YILMAZ", "Ahmet Yılmaz");
    same("İLKER IŞIK", "İlker Işık");
    same("ILGIN", "Ilgın");
    same("ŞÜKRÜ ÖZÇELİK", "Şükrü Özçelik");
    same("ĞÜLER ÇAĞ", "ğüler çağ");
    same("  Ahmet  \tYılmaz ", "Ahmet Yılmaz");
    same("İSMAİL", "İsmail");
    // KAPSAM DIŞI (İngilizce klavyeyle harf değişimi): Türkçe katlamada farklı ad kalır.
    assert.notEqual(foldPersonName("IBRAHIM"), foldPersonName("İbrahim"));
    assert.notEqual(foldPersonName("Yilmaz"), foldPersonName("Yılmaz"));
  });

  it("(1) cari Excel — ad + telefon: büyük harf / I-ı / İ-i / Ş Ğ Ü Ö Ç / boşluk / ayrık noktalı İ ile yazılan kişi VAR OLAN cari (yeni cari açılmaz); telefonu farklı aynı ad ayrı kişi", async () => {
    const people = [
      ["Ahmet Yılmaz", "0532 101 00 01", "AHMET YILMAZ"],
      ["İlker Işık", "0532 101 00 02", "İLKER IŞIK"],
      ["Ilgın Su", "0532 101 00 03", "ILGIN  SU"],
      ["Şükrü Özçelik", "0532 101 00 04", "ŞÜKRÜ ÖZÇELİK"],
      ["İsmail Tuna", "0532 101 00 05", "İSMAİL TUNA"],
      ["Gül Çağ", "0532 101 00 06", "  gül   çağ "],
    ];
    const ids = [];
    for (const [name, phone] of people) ids.push(await account(name, phone));
    const before = liveAccounts();
    const report = await loadAccounts([...people.map(([, phone, variant]) => ["", variant, phone]), ["", "AHMET YILMAZ", "0532 101 99 99"]], "buyuk-harf.xlsx");
    assert.equal(report.created, 1, `yalnız telefonu farklı 'AHMET YILMAZ' yeni cari (yeni cari açıldı: ${report.created}) ${JSON.stringify(report.skipped)}`);
    assert.deepEqual(reasons(report), people.map(() => EXISTS));
    assert.equal(liveAccounts(), before + 1, "veri tabanında yalnız bir yeni cari");
    assert.equal(accountsNamed("AHMET YILMAZ").length, 1);
    assert.equal(accountsNamed("AHMET YILMAZ")[0].phone, "0532 101 99 99", "farklı telefonlu kişi kendi carisini aldı");
    // Güncelle kipi: eşleşen cari güncellenir (adı satırdaki yazımla), yeni cari açılmaz.
    const update = await loadAccounts([["", "ŞÜKRÜ ÖZÇELİK", "0532 101 00 04"]], "guncelle.xlsx", "update");
    assert.equal(update.updated, 1);
    assert.equal(update.created, 0);
    assert.equal(ctx.store.get("SELECT name FROM accounts WHERE id = ?", ids[3]).name, "ŞÜKRÜ ÖZÇELİK");
    assert.equal(liveAccounts(), before + 1);
  });

  it("(2) cari Excel — Cari No + ad: aynı No + büyük harfli ad aynı cari; aynı ad başka No (telefonsuz) yeni cari (2.0.19 kuralı); aynı Excel ikinci kez de öyle", async () => {
    const id = await account("Çağrı Öğüt", "", { refNo: "C-77" });
    const before = liveAccounts();
    const report = await loadAccounts([["C-77", "ÇAĞRI ÖĞÜT", ""], ["C-78", "ÇAĞRI ÖĞÜT", ""]], "no-ad.xlsx");
    assert.deepEqual(reasons(report), [EXISTS], "C-77 + büyük harfli ad aynı cari");
    assert.equal(report.created, 1, "telefonsuz, No'su farklı satır yeni cari (2.0.19)");
    assert.equal(liveAccounts(), before + 1);
    const again = await loadAccounts([["C-77", "ÇAĞRI ÖĞÜT", ""]], "no-ad-yine.xlsx");
    assert.deepEqual(reasons(again), [EXISTS]);
    assert.equal(ctx.store.get("SELECT ref_no AS r FROM accounts WHERE id = ?", id).r, "C-77");
  });

  it("(3) cari Excel — aynı dosyada aynı kişi iki satır, biri büyük harfle: ilk satırın açtığı cari ikinciye görünür (yükleme içi harita)", async () => {
    const before = liveAccounts();
    const report = await loadAccounts([["", "Kemal Ünal", "0533 102 00 01"], ["", "KEMAL ÜNAL", "0533 102 00 01"], ["", "Kemal  Ünal", "0533 102 00 01"]], "ayni-dosya.xlsx");
    assert.equal(report.created, 1, `yeni cari açıldı: ${report.created}`);
    assert.deepEqual(reasons(report), [EXISTS, EXISTS]);
    assert.equal(liveAccounts(), before + 1);
  });

  it("(4) taksit Excel — büyük harfle yazılan kişi var olan carisine bağlanır (yeni cari yok); aynı Excel ikinci kez çift kart açmaz; borç doğru cariye", async () => {
    const ahmet = await account("Hasan Işık", "0534 103 00 01");
    const before120 = await gl120();
    const accountsBefore = liveAccounts();
    const report = await loadPlans([planRow("HASAN IŞIK", "0534 103 00 01", "3.000")], "taksit-buyuk.xlsx");
    assert.deepEqual(reasons(report), []);
    assert.equal(report.created, 1);
    assert.equal(report.linked, 1, "kart var olan cariye bağlandı");
    assert.equal(liveAccounts(), accountsBefore, `yeni cari açıldı: ${liveAccounts() - accountsBefore}`);
    assert.deepEqual(cards(ahmet), [3000]);
    assert.equal(await gl120(), before120 + 3000);
    const plansBefore = livePlans();
    const again = await loadPlans([planRow("Hasan Işık", "0534 103 00 01", "3.000"), planRow("HASAN IŞIK", "0534 103 00 01", "3.000")], "taksit-yine.xlsx");
    assert.equal(again.created, 0, `çift kart: ${again.created}`);
    assert.deepEqual(reasons(again), [DUP_CARD, DUP_CARD]);
    assert.equal(livePlans(), plansBefore);
    assert.equal(await gl120(), before120 + 3000);
    await integrity("(4)");
  });

  it("(5) taksit Excel — var olan kart başka yazımla (önce 'Şule Çakır' açılır, sonra 'ŞULE ÇAKIR'): yinelenen kart görülür, çift kart / borç yok (telefonsuz + aynı grup dahil)", async () => {
    const first = await loadPlans([planRow("Şule Çakır", "0535 104 00 01", "1.000"), planRow("Ilgaz Öz", "", "700", { group: "A Grubu" })], "sule-ilk.xlsx");
    assert.equal(first.created, 2);
    const sule = accountsNamed("Şule Çakır");
    const ilgaz = accountsNamed("Ilgaz Öz");
    assert.equal(sule.length, 1);
    assert.equal(ilgaz.length, 1);
    const before120 = await gl120();
    const accountsBefore = liveAccounts();
    const plansBefore = livePlans();
    const report = await loadPlans([planRow("ŞULE ÇAKIR", "0535 104 00 01", "1.000"), planRow("ILGAZ ÖZ", "", "700", { group: "A Grubu" })], "sule-buyuk.xlsx");
    assert.equal(report.created, 0, `çift kart: ${report.created}`);
    assert.deepEqual(reasons(report), [DUP_CARD, DUP_CARD]);
    assert.equal(livePlans(), plansBefore);
    assert.equal(liveAccounts(), accountsBefore, "yeni cari açılmadı");
    assert.equal(await gl120(), before120, "borç ikinci kez yazılmadı");
    // Telefonu farklı aynı ad (büyük harfle): ayrı kişi → kendi carisiyle kart açılır.
    const other = await loadPlans([planRow("ŞULE ÇAKIR", "0535 104 00 99", "500")], "sule-baska.xlsx");
    assert.deepEqual(reasons(other), []);
    assert.equal(other.created, 1);
    assert.equal(liveAccounts(), accountsBefore + 1);
    assert.deepEqual(cards(sule[0].id), [1000]);
    await integrity("(5)");
  });

  it("(6) S228 = A — var olan ÇİFT cari ('Zeynep Kılıç' + 'ZEYNEP KILIÇ', telefonsuz, aynı grup): bugünkü bağlantı korunur; ikisine de uymayan yazım bugünkü gibi şüpheli", async () => {
    const lower = await account("Zeynep Kılıç", "");
    const upper = await account("ZEYNEP KILIÇ", "");
    const before120 = await gl120();
    const accountsBefore = liveAccounts();
    const report = await loadPlans([planRow("ZEYNEP KILIÇ", "", "800"), planRow("Zeynep Kılıç", "", "600")], "zeynep.xlsx");
    assert.deepEqual(reasons(report), []);
    assert.equal(report.created, 2);
    assert.equal(report.linked, 2);
    assert.deepEqual(cards(upper), [800], "'ZEYNEP KILIÇ' satırı birebir yazımlı cariye (bugünkü gibi)");
    assert.deepEqual(cards(lower), [600], "'Zeynep Kılıç' satırı birebir yazımlı cariye (bugünkü gibi)");
    assert.equal(liveAccounts(), accountsBefore);
    assert.equal(await gl120(), before120 + 1400);
    // 'zeynep kılıç' NOCASE'te 'Zeynep Kılıç' ile aynı (bugün de) → o carinin kartı var → atlanır (bugünkü gibi).
    // 'ZEYNEP  KILIÇ' (çift boşluk): NOCASE ikisini de bulmaz; Türkçe katlamada iki aday (ikisinin de kartı var) → kişi kesin değil → atlanır (çift borç yok).
    const variants = await loadPlans([planRow("zeynep kılıç", "", "600"), planRow("ZEYNEP  KILIÇ", "", "900")], "zeynep-yazim.xlsx");
    assert.deepEqual(reasons(variants), [DUP_CARD, AMBIGUOUS]);
    assert.equal(liveAccounts(), accountsBefore);
    assert.equal(await gl120(), before120 + 1400);
    // Cari Excel'de aynı çift: telefonsuz satır yine yeni cari açar (2.0.19); telefonlu çiftte iki aday → yeni cari (bugünkü şüpheli davranış).
    const p1 = await account("Ece Güneş", "0536 105 00 01");
    const p2 = await account("ECE GÜNEŞ", "0536 105 00 01");
    const accBefore = liveAccounts();
    const acc = await loadAccounts([["", "ECE GÜNEŞ", "0536 105 00 01"], ["", "Ece Güneş", "0536 105 00 01"], ["", "ECE GÜNEş", "0536 105 00 01"]], "ece.xlsx");
    assert.deepEqual(reasons(acc), [EXISTS, EXISTS], "birebir yazımlar bugünkü carisini buldu");
    assert.equal(acc.created, 1, "iki adaylı yazım ('ECE GÜNEş') bugünkü gibi yeni cari");
    assert.equal(liveAccounts(), accBefore + 1);
    assert.ok(p1 && p2);
    await integrity("(6)");
  });

  it("(7) S228 = A — bugün NOCASE ile bağlanan satır değişmez: 'Irmak Yilmaz' (ASCII i) satırı 'IRMAK YILMAZ' carisine (Türkçe katlamada farklı ad; bugünkü bağ korunur)", async () => {
    const ascii = await account("IRMAK YILMAZ", "0537 106 00 01");
    const report = await loadPlans([planRow("Irmak Yilmaz", "0537 106 00 01", "400")], "ascii.xlsx");
    assert.deepEqual(reasons(report), []);
    assert.equal(report.linked, 1);
    assert.deepEqual(cards(ascii), [400]);
  });

  it("(8) taksit Excel — aynı dosyada aynı kişi iki yazımla (önce büyük harf): ilk satırın açtığı cari + kart ikinci satıra görünür", async () => {
    const accountsBefore = liveAccounts();
    const report = await loadPlans([planRow("ÖMER ÇİFTÇİ", "0538 107 00 01", "1.200"), planRow("Ömer Çiftçi", "0538 107 00 01", "1.200"), planRow(" Ömer\t Çiftçi ", "0538 107 00 01", "1.200")], "omer.xlsx");
    assert.equal(report.created, 1, `çift kart: ${report.created}`);
    assert.deepEqual(reasons(report), [DUP_CARD, DUP_CARD]);
    assert.equal(liveAccounts(), accountsBefore + 1);
  });

  it("(9) taksit Excel — kilitli dönemde geri alınan satırın carisi sonraki (başka yazımlı) satıra aday olmaz; Geri Al yalnız kendi açtığını siler", async () => {
    assert.equal((await api.put("/api/admin/period-lock", { lockedUntil: "2026-09-30" })).status, 200);
    let report;
    try {
      const accountsBefore = liveAccounts();
      report = await loadPlans([planRow("Nur Işıl", "0539 108 00 01", "2.000", { registered: "15.09.2026" }), planRow("NUR IŞIL", "0539 108 00 01", "2.000")], "kilit.xlsx");
      assert.equal(report.created, 1);
      assert.match(report.skipped[0]?.reason || "", /kapatılmış \(kilitli\) dönemde/);
      assert.equal(liveAccounts(), accountsBefore + 1, "yalnız kilitsiz satırın carisi");
      const card = ctx.store.get("SELECT account_id AS accountId FROM plans WHERE deleted_at IS NULL AND name = 'NUR IŞIL'");
      assert.ok(card?.accountId, "kart bir cariye bağlı");
      assert.equal(count("SELECT COUNT(*) AS n FROM accounts WHERE id = ? AND deleted_at IS NULL", card.accountId), 1, "kartın carisi var (geri alınmış cari değil)");
    } finally {
      assert.equal((await api.put("/api/admin/period-lock", { lockedUntil: "" })).status, 200);
    }
    // Geri Al: var olan cariye bağlanmış kart kalkar, cari kalır.
    const owner = await account("Oya Ünlü", "0540 109 00 01");
    const before120 = await gl120();
    const linked = await loadPlans([planRow("OYA ÜNLÜ", "0540 109 00 01", "900")], "oya.xlsx");
    assert.equal(linked.linked, 1);
    await must("geri al", api.post(`/api/workspace/plans/imports/${linked.importId}/undo`, {}));
    assert.deepEqual(cards(owner), []);
    assert.equal(ctx.store.get("SELECT deleted_at AS d FROM accounts WHERE id = ?", owner).d, null, "var olan cari silinmedi");
    assert.equal(await gl120(), before120);
  });

  it("(10) çek / senet içe aktarma — keşideci büyük harfle var olan tek cariye bağlanır; aynı dosyada iki yazım kendi sonucunu alır (önbellek); çift caride birebir yazım kendi carisine", async () => {
    const tek = await account("Ahu Öztürk", "0541 110 00 01");
    const dl = await account("Deniz Işık", "");
    const du = await account("DENİZ IŞIK", "");
    const report = await loadCheques(
      [
        ["S223-1", "Ziraat", "AHU ÖZTÜRK", "1.000", "01.12.2026"],
        ["S223-2", "Ziraat", "Ahu Öztürk", "1.000", "01.12.2026"],
        ["S223-3", "Ziraat", "DENİZ IŞIK", "500", "01.12.2026"],
        ["S223-4", "Ziraat", "Deniz Işık", "500", "01.12.2026"],
        ["S223-5", "Ziraat", "Deniz IŞIK", "500", "01.12.2026"],
        ["S223-6", "Ziraat", "Yeni Kişi", "500", "01.12.2026"],
      ],
      "cek.xlsx",
    );
    assert.equal(report.created, 6);
    const ownerOf = serial => ctx.store.get("SELECT account_id AS a FROM cheques WHERE deleted_at IS NULL AND serial_no = ?", serial).a;
    assert.deepEqual(
      ["S223-1", "S223-2", "S223-3", "S223-4", "S223-5", "S223-6"].map(ownerOf),
      [tek, tek, du, dl, "", ""],
      "büyük harfli keşideci tek cariye; çift caride birebir yazım kendi carisine; iki adaylı yazım ve tanınmayan ad bağlanmaz",
    );
    assert.equal(report.linked, 4);
  });

  it("(11) Tablodan Aktar — tablodaki 'AHMET KOÇ' var olan 'Ahmet Koç' (aynı telefon) carisine: ön izleme 'eşleşen cari' der, aktarım yeni cari açmaz; Geri Al cariyi silmez", async () => {
    const owner = await account("Ahmet Koç", "0542 111 00 01");
    const sheets = [{ name: "Taksitler", matrix: [["Dosya No", "Ad Soyad", "Telefon", "Toplam Tutar", "Ödenen", "Taksit Sayısı", "İlk Vade"], ["T-1", "AHMET KOÇ", "0542 111 00 01", 2400, 0, 2, "2026-11-01"]] }];
    const staged = await must("tablo", api.post("/api/workspace/dataset/stage", { kind: "excel", fileName: "t.xlsx", sheets }));
    await must("tablo kaydet", api.post("/api/workspace/dataset/commit", { stageId: staged.stageId, mode: "replace" }));
    const preview = await must("ön izleme", api.get("/api/workspace/plans/from-table"));
    const record = preview.records.find(item => item.name === "AHMET KOÇ");
    assert.ok(record, "kayıt ön izlemede");
    assert.equal(record.account, "match", `ön izleme: ${JSON.stringify({ account: record.account, accountName: record.accountName })}`);
    assert.equal(record.accountName, "Ahmet Koç");
    const accountsBefore = liveAccounts();
    const before120 = await gl120();
    const result = await must("aktar", api.post("/api/workspace/plans/from-table", { keys: [record.key], fingerprint: preview.fingerprint }));
    assert.equal(result.created, 1);
    assert.equal(result.accountsCreated, 0, `yeni cari açıldı: ${result.accountsCreated}`);
    assert.equal(liveAccounts(), accountsBefore);
    assert.deepEqual(cards(owner), [2400]);
    assert.equal(await gl120(), before120 + 2400);
    await must("geri al", api.post(`/api/workspace/plans/imports/${result.importId}/undo`, {}));
    assert.deepEqual(cards(owner), []);
    assert.equal(ctx.store.get("SELECT deleted_at AS d FROM accounts WHERE id = ?", owner).d, null);
    assert.equal(await gl120(), before120);
    await integrity("(11)");
  });

  it("(12) silinmiş cari aday olmaz: 'Bora Ünsal' silinince 'BORA ÜNSAL' satırı (taksit, cari Excel, çek) silinen cariye bağlanmaz", async () => {
    const gone = await account("Bora Ünsal", "0543 112 00 01");
    await must("cari sil", api.del(`/api/workspace/accounts/${gone}`));
    assert.notEqual(ctx.store.get("SELECT deleted_at AS d FROM accounts WHERE id = ?", gone).d, null);
    const plan = await loadPlans([planRow("BORA ÜNSAL", "0543 112 00 01", "500")], "bora.xlsx");
    assert.equal(plan.created, 1);
    assert.equal(plan.linked, 0, "silinen cariye bağlanmadı");
    assert.deepEqual(cards(gone), []);
    const acc = await loadAccounts([["", "BORA ÜNSAL", "0543 112 00 01"]], "bora-cari.xlsx");
    assert.deepEqual(reasons(acc), [EXISTS], "taksitle açılan yeni cari (silinen değil) var sayıldı");
    const chq = await loadCheques([["S223-12", "Ziraat", "bora ünsal", "300", "01.12.2026"]], "bora-cek.xlsx");
    assert.notEqual(ctx.store.get("SELECT account_id AS a FROM cheques WHERE serial_no = 'S223-12'").a, gone);
  });
});
