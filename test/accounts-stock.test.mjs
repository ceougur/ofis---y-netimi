// Cari ve Stok (v2.0.6): Excel'den toplu cari (taksit sorulmadan, tüm kolonlar), cari hareketleri → bakiye ve Kasa,
// taksit kartının cariye bağlanması, toplu taksitlendirme, karışmama kuralları, stok giriş/çıkış → Kasa ve cari,
// kritik seviye, Silinenler, yetkiler ve eski kartların cariye dönüştürülmesi.
import assert from "node:assert/strict";
import { after, before, describe, it } from "node:test";
import { accountLedger, mapAccountHeaders, mapStockHeaders, parseQty, stockLevel } from "../server/lib/accounts.mjs";
import { MIGRATIONS } from "../server/lib/migrations.mjs";
import { createUser, loginAdmin, startTestServer } from "./helpers.mjs";

describe("cari ve stok hesap kuralları (saf)", () => {
  it("Excel başlıkları rollerle eşlenir; bilinmeyen her kolon ek alan olur", () => {
    const roles = mapAccountHeaders(["S.N", "ADI SOYADI", "VELİ", "TELEFON", "ADRES", "KAYIT TARİHİ", "OKULU", "SERVİS ÜCRETİ", "Bilgi Notu"]);
    assert.equal(roles[0], "seq");
    assert.equal(roles[1], "name");
    assert.equal(roles[2], "extra", "veli adı kişi adı sayılmaz");
    assert.equal(roles[3], "phone");
    assert.equal(roles[4], "address");
    assert.equal(roles[5], "registered");
    assert.equal(roles[6], "group", "tek okul kolonu grup olur");
    assert.equal(roles[7], "extra");
    assert.equal(roles[8], "note");
    const stock = mapStockHeaders(["Ürün Kodu", "Ürün Adı", "Birim", "Kategori", "Miktar", "Birim Fiyat", "Kritik Seviye", "Tedarikçi"]);
    assert.deepEqual(Object.values(stock), ["code", "name", "unit", "category", "qty", "price", "min", "extra"]);
    assert.equal(parseQty("1.250,5"), 1250.5);
    assert.equal(parseQty("3 kg"), 3);
  });
  it("defter: borç − alacak; taksit planı borç, taksit tahsilatı alacak; kapatılan kartın kalanı düşülür", () => {
    const ledger = accountLedger(
      [
        { id: "a", kind: "debt", amount: 500, date: "2026-01-01" },
        { id: "b", kind: "in", amount: 200, date: "2026-01-05" },
        { id: "c", kind: "credit", amount: 50, date: "2026-01-06" },
        { id: "d", kind: "out", amount: 20, date: "2026-01-07" },
      ],
      [
        { id: "p1", name: "Servis", total: 3000, status: "active", registeredOn: "2026-01-02", totals: { paid: 1000, overdue: 1000, overdueCount: 1 }, entries: [{ id: "e1", kind: "in", amount: 1000, date: "2026-01-10", itemSeq: 1 }] },
        { id: "p2", name: "Eski", total: 900, status: "closed", registeredOn: "2025-01-01", updatedAt: "2025-06-01T00:00:00Z", totals: { paid: 300 }, entries: [{ id: "e2", kind: "in", amount: 300, date: "2025-02-01" }] },
      ],
    );
    // Borç: 500 + 20 + 3000 + 900 = 4420; Alacak: 200 + 50 + 1000 + 300 + 600 (kapatılan kalan) = 2150.
    assert.equal(ledger.totals.debit, 4420);
    assert.equal(ledger.totals.credit, 2150);
    assert.equal(ledger.totals.balance, 2270);
    assert.equal(ledger.totals.planRemaining, 2000);
    assert.equal(ledger.totals.overdueCount, 1);
    assert.equal(ledger.lines.at(-1).balance, 2270, "yürüyen bakiye");
    assert.ok(ledger.lines.some(line => line.kind === "plan-close" && line.credit === 600));
  });
  it("stok seviyesi hareketlerden: mevcut, kritik, tükendi", () => {
    assert.deepEqual(stockLevel({ minQty: 5, unitPrice: 10 }, [{ kind: "in", qty: 10 }, { kind: "out", qty: 6 }]).state, "low");
    assert.equal(stockLevel({ minQty: 5, unitPrice: 10 }, [{ kind: "in", qty: 10 }, { kind: "out", qty: 6 }]).value, 40);
    assert.equal(stockLevel({ minQty: 0, unitPrice: 0 }, [{ kind: "in", qty: 2 }, { kind: "out", qty: 2 }]).state, "out");
    assert.equal(stockLevel({ minQty: 0, unitPrice: 0 }, []).state, "empty");
  });
});

describe("Cari modülü (v2.0.6)", () => {
  let server;
  let admin;
  let staff;
  let accounts;
  const list = async (client, query = "") => (await client.get(`/api/workspace/accounts${query}`)).data.data;

  before(async () => {
    server = await startTestServer();
    admin = await loginAdmin(server);
    staff = await createUser(server, admin, { username: "selin", name: "Selin Kaya", role: "personel" });
  });
  after(() => server.close());

  it("Excel'den toplu alım: taksit sorulmaz; tüm kolonlar karta gelir; açılış bakiyesi borç olur; ikinci yüklemede atlanır", async () => {
    const matrix = [
      ["S.N", "ADI SOYADI", "VELİ", "TELEFON", "ADRES", "KAYIT TARİHİ", "OKULU", "SERVİS ÜCRETİ", "BAKİYE"],
      ["1", "Beyza Öykü İçer", "Hülya İçer", "0553 741 61 38", "Meram, Konya", "01.09.2026", "Akabe İlkokulu", "12.000", ""],
      ["2", "Ali Ak", "Murat Ak", "0532 221 10 40", "Selçuklu", "02.09.2026", "15 Temmuz Okulu", "9.000", "1.500"],
      ["3", "Ali Ak", "Sevgi Ak", "0505 118 22 05", "Karatay", "03.09.2026", "Akabe İlkokulu", "9.000", ""],
      ["", "", "", "", "", "", "", "", ""],
    ];
    const preview = (await admin.post("/api/workspace/accounts/import/preview", { matrix })).data.data;
    assert.equal(preview.roles[1], "name");
    assert.equal(preview.roles[8], "balance");
    const done = await admin.post("/api/workspace/accounts/import", { matrix, headerAt: preview.headerAt, roles: preview.roles, fileName: "servis.xlsx" });
    assert.equal(done.status, 200, JSON.stringify(done.data));
    assert.equal(done.data.data.created, 3, "aynı adlı iki farklı kişi ayrı cari (telefonları farklı)");
    assert.equal(done.data.data.balances, 1);
    assert.equal(server.app.store.get("SELECT COUNT(*) AS n FROM plans").n, 0, "taksit kartı açılmadı");
    accounts = (await list(admin, "?sort=no")).accounts;
    assert.deepEqual(accounts.map(item => item.refNo), ["1", "2", "3"]);
    const beyza = (await admin.get(`/api/workspace/accounts/${accounts[0].id}`)).data.data;
    assert.equal(beyza.phone, "0553 741 61 38");
    assert.equal(beyza.address, "Meram, Konya");
    assert.equal(beyza.registeredOn, "2026-09-01");
    assert.equal(beyza.groupName, "Akabe İlkokulu");
    assert.deepEqual(beyza.fields, [{ label: "VELİ", value: "Hülya İçer" }, { label: "SERVİS ÜCRETİ", value: "12.000" }]);
    assert.equal(accounts[1].balance, 1500, "açılış bakiyesi borç");
    const again = (await admin.post("/api/workspace/accounts/import", { matrix, headerAt: preview.headerAt, roles: preview.roles })).data.data;
    assert.equal(again.created, 0);
    assert.equal(again.skipped.length, 3, "ikinci yüklemede çift cari açılmaz");
  });

  it("arama: ad, telefonun rakamları, ek alanlar; süzgeç: bakiye", async () => {
    assert.equal((await list(admin, "?q=hülya")).accounts.length, 1, "ek alanda arama");
    assert.equal((await list(admin, "?q=741 61")).accounts[0].name, "Beyza Öykü İçer");
    assert.equal((await list(admin, "?balance=debtor")).accounts.length, 1);
    const search = (await admin.get("/api/workspace/accounts/search?q=ali")).data.data;
    assert.equal(search.length, 2);
  });

  it("hareketler: tahsilat Kasa'ya giriş, ödeme Kasa'dan çıkış; borç/alacak Kasa'ya girmez; makbuz ve ekstre PDF", async () => {
    const ali = accounts[1];
    const paid = await staff.post(`/api/workspace/accounts/${ali.id}/entries`, { kind: "in", amount: "500", date: "2026-09-10", note: "Elden" });
    assert.equal(paid.status, 200, JSON.stringify(paid.data));
    assert.equal(paid.data.data.totals.balance, 1000);
    assert.equal((await staff.post(`/api/workspace/accounts/${ali.id}/entries`, { kind: "debt", amount: "100" })).status, 403, "personel borç yazamaz");
    await admin.post(`/api/workspace/accounts/${ali.id}/entries`, { kind: "debt", amount: "250", date: "2026-09-11", note: "Ek hizmet" });
    await admin.post(`/api/workspace/accounts/${ali.id}/entries`, { kind: "out", amount: "40", date: "2026-09-12", note: "Para üstü iadesi" });
    const cash = (await admin.get("/api/workspace/cash")).data.data;
    const own = cash.entries.filter(entry => entry.source === "account");
    assert.deepEqual(own.map(entry => [entry.kind, entry.amount]), [["in", 500], ["out", 40]]);
    assert.equal(own[0].accountName, "Ali Ak");
    const detail = (await admin.get(`/api/workspace/accounts/${ali.id}`)).data.data;
    assert.equal(detail.totals.balance, 1290);
    const entry = detail.entries.find(item => item.kind === "in");
    assert.ok(entry.receiptNo >= 1);
    const receipt = await admin.raw("GET", `/api/workspace/accounts/${ali.id}/entries/${entry.id}/makbuz.pdf`);
    assert.equal(receipt.status, 200);
    assert.ok(receipt.buffer.toString("latin1").startsWith("%PDF"));
    assert.equal((await admin.raw("GET", `/api/workspace/accounts/${ali.id}/ekstre.pdf`)).status, 200);
    assert.equal((await admin.raw("GET", "/api/workspace/accounts/liste.pdf")).status, 200);
    const xlsx = await admin.raw("GET", "/api/workspace/accounts/export.xlsx");
    assert.equal(xlsx.status, 200);
    assert.equal(xlsx.buffer.subarray(0, 2).toString(), "PK");
  });

  it("taksit kartı cariye bağlanır; carinin defterinde plan borç, taksit tahsilatı alacak; Kasa'ya tek kayıt", async () => {
    const beyza = accounts[0];
    const plan = (await admin.post("/api/workspace/plans", { accountId: beyza.id, name: beyza.name, total: "12.000", mode: "auto", count: 6, firstDue: "2026-09-15" })).data.data;
    assert.equal(plan.accountId, beyza.id);
    await staff.post(`/api/workspace/plans/${plan.id}/entries`, { kind: "in", amount: "2.000", itemId: plan.items[0].id, date: "2026-09-15" });
    const detail = (await admin.get(`/api/workspace/accounts/${beyza.id}`)).data.data;
    assert.equal(detail.plans.length, 1);
    assert.equal(detail.totals.balance, 10000, "12.000 borç − 2.000 tahsilat");
    assert.equal(detail.totals.planRemaining, 10000);
    assert.ok(detail.ledger.some(line => line.kind === "plan-in" && line.label.includes("1. taksit")));
    const cash = (await admin.get("/api/workspace/cash")).data.data.entries.filter(entry => entry.amount === 2000);
    assert.equal(cash.length, 1, "taksit tahsilatı Kasa'da tek kayıt");
    assert.equal(cash[0].source, "plan");
    // Cari adı değişince kartın adı da değişir.
    await admin.put(`/api/workspace/accounts/${beyza.id}`, { name: "Beyza Ö. İçer" });
    assert.equal((await admin.get(`/api/workspace/plans/${plan.id}`)).data.data.name, "Beyza Ö. İçer");
    // Kartı olan cari silinmez.
    assert.equal((await admin.del(`/api/workspace/accounts/${beyza.id}`)).status, 409);
  });

  it("carisiz açılan taksit kartı kendi carisini alır; başka kişinin carisine yazılmaz", async () => {
    const before = (await list(admin, "?status=all")).accounts.length;
    const plan = (await admin.post("/api/workspace/plans", { name: "Ali Ak", total: "900" })).data.data;
    assert.ok(plan.accountId);
    assert.ok(![accounts[1].id, accounts[2].id].includes(plan.accountId), "aynı adlı iki cari varken tahmin edilmez; yeni cari");
    assert.equal((await list(admin, "?status=all")).accounts.length, before + 1);
    assert.equal((await admin.post("/api/workspace/plans", { name: "X", total: "1", accountId: "account-yok" })).status, 400);
  });

  it("toplu taksitlendirme: seçilenlere, tutar ek alandan; açık kartı olan atlanır; tutarı olmayan atlanır", async () => {
    const ids = accounts.map(item => item.id);
    const result = await admin.post("/api/workspace/accounts/bulk-plan", { ids, amountMode: "field", field: "SERVİS ÜCRETİ", count: 9, firstDue: "2026-09-15" });
    assert.equal(result.status, 200, JSON.stringify(result.data));
    assert.equal(result.data.data.created, 2, "Beyza'nın açık kartı var, atlandı");
    assert.equal(result.data.data.total, 18000);
    assert.equal(result.data.data.skipped[0].reason, "Açık taksit kartı var");
    const ali = (await admin.get(`/api/workspace/accounts/${accounts[1].id}`)).data.data;
    assert.equal(ali.plans.length, 1);
    assert.equal(ali.plans[0].itemCount, 9);
    assert.equal(ali.plans[0].totals.total, 9000);
    assert.equal((await staff.post("/api/workspace/accounts/bulk-plan", { ids, total: "1", count: 1, firstDue: "2026-10-01" })).status, 403);
    assert.equal((await admin.post("/api/workspace/accounts/bulk-plan", { ids, total: "1000", count: 0, firstDue: "2026-10-01" })).status, 400, "taksit sayısı gerekli");
  });

  it("açık tablodan cari alımı kayda bağlar; tabloda olmayan kayıt bağlanmaz; kişinin kartından cari özeti", async () => {
    const matrix = [["Dosya No", "Borçlu", "Telefon", "Tutar"], ["2026/1", "Veli Kaya", "0532 999 99 99", "4.500"]];
    const staged = await admin.post("/api/workspace/dataset/stage", { kind: "excel", fileName: "dosyalar.xlsx", sheets: [{ name: "Aktif", matrix }] });
    await admin.post("/api/workspace/dataset/commit", { stageId: staged.data.data.stageId, mode: "replace" });
    const rows = (await admin.get(`/api/trpc/sheets.getRows?input=${encodeURIComponent(JSON.stringify({ json: {} }))}`)).data.result.data.json.rows;
    const key = rows[0].__hofKey;
    const table = [["Dosya No", "Borçlu", "Telefon", "Tutar"], ["2026/1", "Veli Kaya", "0532 999 99 99", "4.500"], ["2026/999", "Hayalet", "", ""]];
    const preview = (await admin.post("/api/workspace/accounts/import/preview", { matrix: table })).data.data;
    const roles = { ...preview.roles, 1: "name" };
    const done = (await admin.post("/api/workspace/accounts/import", { matrix: table, headerAt: 0, roles, caseKeys: [key, "2026/999"], caseTitles: ["2026/1 · Veli Kaya", "x"] })).data.data;
    assert.equal(done.created, 2);
    assert.equal(done.linked, 1, "yalnız tabloda olan kayıt bağlandı");
    const linked = (await admin.get(`/api/workspace/cases/${encodeURIComponent(key)}/account`)).data.data;
    assert.equal(linked.account.name, "Veli Kaya");
    const hayalet = (await list(admin, "?q=hayalet")).accounts[0];
    assert.equal(hayalet.caseKey, "");
    assert.equal((await admin.get(`/api/workspace/cases/${encodeURIComponent("2026/999")}/account`)).data.data.account, null);
  });

  it("Silinenler: silinen cari ve cari hareketi geri gelir", async () => {
    const hayalet = (await list(admin, "?q=hayalet")).accounts[0];
    await admin.post(`/api/workspace/accounts/${hayalet.id}/entries`, { kind: "in", amount: "70", date: "2026-09-20" });
    const entry = (await admin.get(`/api/workspace/accounts/${hayalet.id}`)).data.data.entries[0];
    await admin.del(`/api/workspace/accounts/${hayalet.id}/entries/${entry.id}`);
    assert.equal((await admin.get(`/api/workspace/accounts/${hayalet.id}`)).data.data.entries.length, 0);
    await admin.del(`/api/workspace/accounts/${hayalet.id}`);
    assert.equal((await list(admin, "?q=hayalet")).accounts.length, 0);
    const trash = (await admin.get("/api/admin/trash")).data.data;
    const deletedEntry = trash.find(item => item.kind === "account-entry");
    assert.equal((await admin.post("/api/admin/trash/restore", { id: deletedEntry.id })).status, 409, "cari silinmişken hareketi geri gelmez");
    assert.equal((await admin.post("/api/admin/trash/restore", { id: trash.find(item => item.kind === "account").id })).status, 200);
    assert.equal((await admin.post("/api/admin/trash/restore", { id: deletedEntry.id })).status, 200);
    assert.equal((await admin.get(`/api/workspace/accounts/${hayalet.id}`)).data.data.totals.balance, -70);
  });
});

describe("Stok modülü (v2.0.6)", () => {
  let server;
  let admin;
  let staff;
  let supplier;
  before(async () => {
    server = await startTestServer();
    admin = await loginAdmin(server);
    staff = await createUser(server, admin, { username: "ayse", name: "Ayşe Demir", role: "personel" });
    supplier = (await admin.post("/api/workspace/accounts", { name: "Toptancı Ltd.", type: "supplier" })).data.data;
  });
  after(() => server.close());

  it("Excel'den toplu ürün: miktar açılış stoku olur (para yazılmaz); tekrar yüklemede atlanır", async () => {
    const matrix = [["Ürün Kodu", "Ürün Adı", "Birim", "Kategori", "Miktar", "Birim Fiyat", "Kritik Seviye"], ["C1", "Çay", "paket", "Mutfak", "10", "85", "3"], ["S1", "Şeker", "kg", "Mutfak", "2,5", "40", "2"], ["Y1", "Motor yağı", "lt", "Araç", "", "320", "4"]];
    const preview = (await admin.post("/api/workspace/stock/import/preview", { matrix })).data.data;
    const done = (await admin.post("/api/workspace/stock/import", { matrix, headerAt: preview.headerAt, roles: preview.roles })).data.data;
    assert.equal(done.created, 3);
    assert.equal(done.opening, 2);
    const data = (await admin.get("/api/workspace/stock")).data.data;
    const cay = data.items.find(item => item.name === "Çay");
    assert.equal(cay.qty, 10);
    assert.equal(cay.value, 850);
    assert.equal(data.items[0].name, "Motor yağı", "kritik/tükenen ürün önce");
    assert.equal((await admin.get("/api/workspace/cash")).data.data.entries.length, 0, "açılış stoku Kasa'ya yazılmaz");
    assert.equal((await admin.post("/api/workspace/stock/import", { matrix, headerAt: 0, roles: preview.roles })).data.data.skipped.length, 3);
  });

  it("giriş Kasa'dan ödenirse Kasa'ya gider (miktar × birim fiyat); çıkış yalnız miktar; kritik seviye uyarısı", async () => {
    const { items } = (await admin.get("/api/workspace/stock")).data.data;
    const cay = items.find(item => item.name === "Çay");
    const bought = await admin.post(`/api/workspace/stock/${cay.id}/moves`, { kind: "in", qty: "4", unitPrice: "90", pay: "cash", date: "2026-09-20", note: "Market" });
    assert.equal(bought.status, 200, JSON.stringify(bought.data));
    assert.equal(bought.data.data.qty, 14);
    assert.equal(bought.data.data.unitPrice, 90, "son alış fiyatı karta yazılır");
    const cash = (await admin.get("/api/workspace/cash")).data.data.entries;
    assert.deepEqual(cash.map(entry => [entry.source, entry.kind, entry.amount]), [["stock", "out", 360]]);
    assert.match(cash[0].description, /Stok alımı · Çay 4 paket/);
    const used = await staff.post(`/api/workspace/stock/${cay.id}/moves`, { kind: "out", qty: "12", note: "Ofis tüketimi" });
    assert.equal(used.status, 200);
    assert.equal(used.data.data.qty, 2);
    assert.equal(used.data.data.state, "low");
    const alerts = (await staff.get("/api/workspace/stock/alerts")).data.data;
    assert.ok(alerts.some(item => item.name === "Çay" && item.qty === 2));
    assert.equal((await staff.post(`/api/workspace/stock/${cay.id}/moves`, { kind: "in", qty: "1", unitPrice: "90", pay: "cash" })).status, 403, "personel para yazan hareket giremez");
    const negative = await staff.post(`/api/workspace/stock/${cay.id}/moves`, { kind: "out", qty: "5" });
    assert.equal(negative.status, 409);
    assert.equal(negative.data.code, "stock-negative");
    assert.equal((await staff.post(`/api/workspace/stock/${cay.id}/moves`, { kind: "out", qty: "5", force: true })).data.data.qty, -3, "onayla eksiye düşebilir (sayım farkı)");
  });

  it("cariye yazılan alım tedarikçiye alacak olur; düzeltme ve silme cari hareketini de düzeltir; Silinenler'den geri gelir", async () => {
    const { items } = (await admin.get("/api/workspace/stock")).data.data;
    const yag = items.find(item => item.name === "Motor yağı");
    const moved = (await admin.post(`/api/workspace/stock/${yag.id}/moves`, { kind: "in", qty: "10", unitPrice: "300", pay: "account", accountId: supplier.id })).data.data;
    let account = (await admin.get(`/api/workspace/accounts/${supplier.id}`)).data.data;
    assert.equal(account.totals.balance, -3000, "tedarikçiye 3.000 borçluyuz");
    assert.equal(account.entries[0].source, "stock");
    assert.equal((await admin.del(`/api/workspace/accounts/${supplier.id}/entries/${account.entries[0].id}`)).status, 409, "stoktan gelen hareket cariden silinmez");
    await admin.put(`/api/workspace/stock/${yag.id}/moves/${moved.moveId}`, { qty: "8" });
    account = (await admin.get(`/api/workspace/accounts/${supplier.id}`)).data.data;
    assert.equal(account.totals.balance, -2400);
    await admin.del(`/api/workspace/stock/${yag.id}/moves/${moved.moveId}`);
    account = (await admin.get(`/api/workspace/accounts/${supplier.id}`)).data.data;
    assert.equal(account.entries.length, 0);
    const trash = (await admin.get("/api/admin/trash")).data.data.find(item => item.kind === "stock-move");
    assert.equal((await admin.post("/api/admin/trash/restore", { id: trash.id })).status, 200);
    account = (await admin.get(`/api/workspace/accounts/${supplier.id}`)).data.data;
    assert.equal(account.totals.balance, -2400, "geri gelen hareket cariye de döner");
    // Tedarikçiye ödeme Kasa'dan çıkar ve borcu kapatır.
    await admin.post(`/api/workspace/accounts/${supplier.id}/entries`, { kind: "out", amount: "2400" });
    assert.equal((await admin.get(`/api/workspace/accounts/${supplier.id}`)).data.data.totals.balance, 0);
  });

  it("ürün silinse de ödenen para Kasa'da kalır; ürün Silinenler'den döner; PDF ve Excel döküm", async () => {
    const { items } = (await admin.get("/api/workspace/stock")).data.data;
    const cay = items.find(item => item.name === "Çay");
    assert.equal((await admin.del(`/api/workspace/stock/${cay.id}`)).status, 200);
    assert.ok((await admin.get("/api/workspace/cash")).data.data.entries.some(entry => entry.source === "stock" && entry.amount === 360));
    const trash = (await admin.get("/api/admin/trash")).data.data.find(item => item.kind === "stock");
    assert.equal((await admin.post("/api/admin/trash/restore", { id: trash.id })).status, 200);
    assert.equal((await admin.raw("GET", "/api/workspace/stock/liste.pdf")).status, 200);
    assert.equal((await admin.raw("GET", `/api/workspace/stock/${cay.id}/hareketler.pdf`)).status, 200);
    assert.equal((await admin.raw("GET", "/api/workspace/stock/export.xlsx")).buffer.subarray(0, 2).toString(), "PK");
  });
});

describe("göç 12: eski taksit kartları cariye dönüşür (karışmadan)", () => {
  it("aynı kayda bağlı kartlar ya da aynı ad + telefon tek cari; diğerleri ayrı", async () => {
    // Göç 11'deki gibi carisi olmayan kartlar eklenir, göç 12 yeniden koşturulur (göç tekrar koşmaya dayanıklıdır).
    const server = await startTestServer();
    try {
      const store = server.app.store;
      const insert = (id, name, phone, caseKey = "") =>
        store.run("INSERT INTO plans (id, account_id, ref_no, registered_on, case_key, case_source, case_title, name, note, phone, total, status, created_by, created_at, updated_at) VALUES (?, '', '1', '2026-01-01', ?, ?, '', ?, '', ?, 100, 'active', 'u', ?, ?)", id, caseKey, caseKey ? "dataset://ofis" : "", name, phone, `2026-01-0${id.slice(-1)}T00:00:00Z`, "2026-01-01T00:00:00Z");
      insert("p1", "Ali Veli", "0532 111 11 11");
      insert("p2", "ALİ VELİ", "05321111111");
      insert("p3", "Ali Veli", "");
      insert("p4", "Ayşe", "", "2026/5");
      insert("p5", "Ayşe Kaya", "", "2026/5");
      const migration = MIGRATIONS.find(item => item.version === 12);
      migration.up(store);
      const accountOf = id => store.get("SELECT account_id AS a FROM plans WHERE id = ?", id).a;
      assert.ok(accountOf("p1"));
      assert.notEqual(accountOf("p1"), accountOf("p3"), "telefonsuz aynı ad birleşmez");
      assert.equal(accountOf("p4"), accountOf("p5"), "aynı kayda bağlı kartlar tek cari");
      assert.notEqual(accountOf("p4"), accountOf("p1"));
      // Büyük/küçük harf farkı Türkçe katlamayla birleşir (aynı telefon).
      assert.equal(accountOf("p1"), accountOf("p2"));
      migration.up(store);
      assert.equal(store.get("SELECT COUNT(*) AS n FROM accounts").n, 3, "göç ikinci kez koşunca çift cari açmaz");
    } finally {
      await server.close();
    }
  });
});

describe("Google Sheets'ten ve binlerce satırlık toplu alım (v2.0.6)", () => {
  let server;
  let admin;
  const SHEET = "https://docs.google.com/spreadsheets/d/cari-sheet-123/edit#gid=0";
  // Sahte Google: belge sayfası iki sekme ("Cariler", "Stok") bildirir, her sekmenin CSV'si ayrı döner.
  const csv = { 0: 'CARİ KODU,ÜNVAN,TELEFON,İL,VERGİ NO\n120.01,"Yıldız Gıda Ltd.",0332 111 22 33,Konya,1234567890\n120.02,Ak Tarım,0532 444 55 66,Karaman,9876543210\n', 7: "Stok Kodu,Ürün Adı,Birim,Miktar,Birim Fiyat,Kritik\nY-01,Ayçiçek yağı 5 lt,adet,40,410,10\nS-02,Şeker 50 kg,çuval,3,1900,1\n" };
  const fetchImpl = async url => {
    const text = String(url);
    if (!text.includes("cari-sheet-123")) return new Response("Bulunamadı", { status: 404, headers: { "content-type": "text/html" } });
    if (text.includes("/edit")) return new Response('<html><head><title>Toptan Müşteriler - Google E-Tablolar</title></head><body>"gid":"0","name":"Cariler" "gid":"7","name":"Stok"</body></html>', { status: 200, headers: { "content-type": "text/html" } });
    const gid = /gid=(\d+)/.exec(text)?.[1];
    if (text.includes("export?format=csv") && csv[gid]) return new Response(csv[gid], { status: 200, headers: { "content-type": "text/csv" } });
    return new Response("yok", { status: 404 });
  };
  before(async () => {
    server = await startTestServer({ fetchImpl });
    admin = await loginAdmin(server);
  });
  after(() => server.close());

  it("Sheets bağlantısından sekmeler matris olarak gelir; cari ve stok aynı eşlemeyle yüklenir", async () => {
    const read = await admin.post("/api/workspace/import/google-sheet", { url: SHEET });
    assert.equal(read.status, 200, JSON.stringify(read.data));
    assert.equal(read.data.data.title, "Toptan Müşteriler");
    assert.deepEqual(read.data.data.sheets.map(sheet => sheet.name), ["Cariler", "Stok"]);
    const cariler = read.data.data.sheets[0].matrix;
    const preview = (await admin.post("/api/workspace/accounts/import/preview", { matrix: cariler })).data.data;
    assert.equal(preview.roles[0], "seq");
    assert.equal(preview.roles[1], "name");
    const done = (await admin.post("/api/workspace/accounts/import", { matrix: cariler, headerAt: preview.headerAt, roles: preview.roles, type: "customer", fileName: "Toptan Müşteriler" })).data.data;
    assert.equal(done.created, 2);
    const yildiz = (await admin.get("/api/workspace/accounts?q=yıldız")).data.data.accounts[0];
    assert.equal(yildiz.refNo, "120.01");
    assert.deepEqual(yildiz.extra, [{ label: "İL", value: "Konya" }, { label: "VERGİ NO", value: "1234567890" }]);
    const stok = read.data.data.sheets[1].matrix;
    const sp = (await admin.post("/api/workspace/stock/import/preview", { matrix: stok })).data.data;
    const stockDone = (await admin.post("/api/workspace/stock/import", { matrix: stok, headerAt: sp.headerAt, roles: sp.roles })).data.data;
    assert.equal(stockDone.created, 2);
    const yag = (await admin.get("/api/workspace/stock?q=yağ")).data.data.items[0];
    assert.equal(yag.qty, 40);
    assert.equal(yag.value, 16400);
  });

  it("paylaşılmamış ya da hatalı bağlantı anlaşılır hata verir; personel toplu yükleme yapamaz", async () => {
    const bad = await admin.post("/api/workspace/import/google-sheet", { url: "https://ornek.com/tablo" });
    assert.equal(bad.status, 400);
    assert.match(bad.data.error, /Google Sheets/);
    const missing = await admin.post("/api/workspace/import/google-sheet", { url: "https://docs.google.com/spreadsheets/d/baska-belge/edit#gid=99" });
    assert.equal(missing.status, 400);
    assert.match(missing.data.error, /paylaş/i);
    const staff = await createUser(server, admin, { username: "okur", role: "personel" });
    assert.equal((await staff.post("/api/workspace/import/google-sheet", { url: SHEET })).status, 403);
  });

  it("10 bin cari ve 10 bin ürün tek seferde yüklenir (numara çakışmaları taramasız çözülür); ikinci yükleme çift açmaz", async () => {
    const accounts = [["S.N", "Ad Soyad", "Telefon", "Adres", "Bölge", "Servis ücreti"]];
    for (let i = 1; i <= 10000; i += 1) accounts.push([String(i), `Müşteri ${i}`, `0532 ${String(1000000 + i).slice(-7)}`, `Mahalle ${i % 97}`, `Bölge ${i % 12}`, String(1000 + (i % 50) * 10)]);
    const preview = (await admin.post("/api/workspace/accounts/import/preview", { matrix: accounts })).data.data;
    let started = Date.now();
    const done = (await admin.post("/api/workspace/accounts/import", { matrix: accounts, headerAt: 0, roles: preview.roles })).data.data;
    const accountMs = Date.now() - started;
    assert.equal(done.created, 10000);
    assert.equal(done.renumbered, 0, "S.N 1…10000 önceki carilerin numaralarıyla (120.01, 120.02) çakışmaz");
    started = Date.now();
    const again = (await admin.post("/api/workspace/accounts/import", { matrix: accounts, headerAt: 0, roles: preview.roles })).data.data;
    const againMs = Date.now() - started;
    assert.equal(again.created, 0);
    assert.equal(again.skipped.length, 10000);
    started = Date.now();
    const list = (await admin.get("/api/workspace/accounts?q=Müşteri 9999")).data.data;
    const listMs = Date.now() - started;
    assert.equal(list.accounts.length, 1);
    const items = [["Kod", "Ürün", "Birim", "Miktar", "Fiyat", "Kritik"]];
    for (let i = 1; i <= 10000; i += 1) items.push([`K${i}`, `Ürün ${i}`, i % 2 ? "adet" : "kg", String(i % 40), String(10 + (i % 90)), "5"]);
    const sp = (await admin.post("/api/workspace/stock/import/preview", { matrix: items })).data.data;
    started = Date.now();
    const stock = (await admin.post("/api/workspace/stock/import", { matrix: items, headerAt: 0, roles: sp.roles })).data.data;
    const stockMs = Date.now() - started;
    assert.equal(stock.created, 10000);
    started = Date.now();
    const stockList = (await admin.get("/api/workspace/stock")).data.data;
    const stockListMs = Date.now() - started;
    assert.equal(stockList.totals.count, 10002);
    // Tüm liste ve süzülmüş liste PDF ve Excel olarak (10 bin satır).
    started = Date.now();
    const allPdf = await admin.raw("GET", "/api/workspace/accounts/liste.pdf?status=all");
    const allXlsx = await admin.raw("GET", "/api/workspace/accounts/export.xlsx?status=all");
    const stockPdf = await admin.raw("GET", "/api/workspace/stock/liste.pdf");
    const stockXlsx = await admin.raw("GET", "/api/workspace/stock/export.xlsx");
    const exportMs = Date.now() - started;
    assert.ok(allPdf.status === 200 && allPdf.buffer.subarray(0, 4).toString() === "%PDF", "tüm cari PDF");
    assert.ok(allXlsx.status === 200 && allXlsx.buffer.subarray(0, 2).toString() === "PK", "tüm cari Excel");
    assert.ok(stockPdf.status === 200 && stockXlsx.status === 200, "tüm stok PDF ve Excel");
    const filteredPdf = await admin.raw("GET", `/api/workspace/stock/liste.pdf?q=${encodeURIComponent("Ürün 99")}`);
    const filteredXlsx = await admin.raw("GET", `/api/workspace/stock/export.xlsx?q=${encodeURIComponent("Ürün 99")}`);
    assert.ok(filteredPdf.buffer.length < stockPdf.buffer.length / 20, "süzülen stok PDF'i yalnız süzülenler");
    assert.ok(filteredXlsx.buffer.length < stockXlsx.buffer.length / 5, "süzülen stok Excel'i yalnız süzülenler");
    console.log(`# döküm: 10 bin cari + 10 bin ürün PDF ve Excel ${exportMs} ms (cari PDF ${Math.round(allPdf.buffer.length / 1024)} KB, Excel ${Math.round(allXlsx.buffer.length / 1024)} KB)`);
    console.log(`# süre: 10 bin cari ${accountMs} ms, tekrar ${againMs} ms, arama ${listMs} ms; 10 bin ürün ${stockMs} ms, liste ${stockListMs} ms`);
    for (const ms of [accountMs, againMs, stockMs]) assert.ok(ms < 30000, `yükleme ${ms} ms`);
    assert.ok(listMs < 5000 && stockListMs < 5000, "liste birkaç saniyenin altında");
  });
});
