import assert from "node:assert/strict";
import { after, before, describe, it } from "node:test";
import { addMonths, allocate, distribute, mapHeaders, parseDay } from "../server/lib/plans.mjs";
import { amountInWords } from "../server/lib/plan-report.mjs";
import { createUser, loginAdmin, startTestServer } from "./helpers.mjs";

describe("taksit motoru (saf)", () => {
  it("toplamı eşit taksitlere böler; kuruş farkı son taksitte, her ay aynı gün", () => {
    const items = distribute({ total: 10000, count: 3, firstDue: "2026-01-31" });
    assert.deepEqual(items.map(item => item.amount), [3333.33, 3333.33, 3333.34]);
    assert.deepEqual(items.map(item => item.dueDate), ["2026-01-31", "2026-02-28", "2026-03-31"]);
    assert.equal(addMonths("2026-01-15", 13), "2027-02-15");
    assert.equal(distribute({ total: 1200, count: 4, firstDue: "2026-09-10", everyMonths: 3 }).at(-1).dueDate, "2027-06-10");
  });

  it("tahsilatlar en eski taksite sayılır; taksite bağlı tahsilat önce o taksite; iade en yeni taksitten düşer", () => {
    const plan = { total: 3000, status: "active" };
    const items = [
      { id: "a", seq: 1, dueDate: "2026-08-01", amount: 1000 },
      { id: "b", seq: 2, dueDate: "2026-09-01", amount: 1000 },
      { id: "c", seq: 3, dueDate: "2026-10-01", amount: 1000 },
    ];
    let ledger = allocate(plan, items, [{ id: "e1", kind: "in", amount: 1500, date: "2026-08-05" }], { today: "2026-09-15" });
    assert.deepEqual(ledger.items.map(item => [item.paid, item.state]), [[1000, "paid"], [500, "overdue"], [0, "open"]]);
    assert.equal(ledger.items[1].partial, true);
    assert.equal(ledger.totals.remaining, 1500);
    assert.equal(ledger.totals.overdue, 500);
    assert.equal(ledger.state, "overdue");
    assert.deepEqual(ledger.next, { id: "b", seq: 2, dueDate: "2026-09-01", remaining: 500, days: -14, state: "overdue" });

    // 3. taksite bağlı tahsilat: önce ona sayılır; 2. taksit hâlâ gecikmiş.
    ledger = allocate(plan, items, [{ id: "e1", kind: "in", amount: 1000, date: "2026-08-05" }, { id: "e2", kind: "in", amount: 1000, date: "2026-09-10", itemId: "c" }], { today: "2026-09-15" });
    assert.deepEqual(ledger.items.map(item => item.paid), [1000, 0, 1000]);
    // Bağlı taksitten artan havuza düşer: 1.200 verilince 200'ü 2. taksite gider.
    ledger = allocate(plan, items, [{ id: "e2", kind: "in", amount: 1200, date: "2026-09-10", itemId: "c" }], { today: "2026-09-15" });
    assert.deepEqual(ledger.items.map(item => item.paid), [200, 0, 1000]);
    // İade: en yeni ödenen taksitten geri alınır.
    ledger = allocate(plan, items, [{ id: "e1", kind: "in", amount: 2500, date: "2026-08-05" }, { id: "e3", kind: "out", amount: 700, date: "2026-09-12" }], { today: "2026-09-15" });
    assert.deepEqual(ledger.items.map(item => item.paid), [1000, 800, 0]);
    assert.equal(ledger.totals.paid, 1800);
    // Tamamı ödenince kart biter; fazla tahsilat "extra" olarak görünür.
    ledger = allocate(plan, items, [{ id: "e1", kind: "in", amount: 3100, date: "2026-08-05" }], { today: "2026-12-01" });
    assert.equal(ledger.state, "done");
    assert.equal(ledger.totals.extra, 100);
    assert.equal(ledger.totals.remaining, 0);
    // Yaklaşan (7 gün) ve bugün.
    ledger = allocate(plan, items, [], { today: "2026-09-01" });
    assert.deepEqual(ledger.items.map(item => item.state), ["overdue", "today", "open"]);
    assert.equal(allocate(plan, items, [], { today: "2026-08-26" }).items[1].state, "upcoming");
    // Kapalı kart uyarı vermez.
    assert.equal(allocate({ total: 3000, status: "closed" }, items, [], { today: "2026-12-01" }).state, "closed");
  });

  it("Excel başlıklarını ve tarihleri tanır", () => {
    assert.deepEqual(mapHeaders(["Grup", "Alt Grup", "Adı Soyadı", "Bilgi Notu", "Telefonu", "Toplam Tutar", "Taksit Sayısı", "İlk Vade"]), { 0: "group", 1: "subgroup", 2: "name", 3: "note", 4: "phone", 5: "total", 6: "count", 7: "firstDue" });
    assert.deepEqual(mapHeaders(["PLAKA", "GÜZERGAH", "ÖĞRENCİ", "VELİ TELEFONU", "ÜCRET", "TAKSİT"]), { 0: "group", 1: "subgroup", 2: "name", 3: "phone", 4: "total", 5: "count" });
    // Müşteri dosyası (Şahin Turizm): parantezli, noktalı ve çok kelimeli başlıklar (v2.0.5).
    assert.deepEqual(mapHeaders(["S.N", "ADI SOYADI", "GRUBU (Plaka)", "ARA GRUBU (Okulu)", "TELEFONU", "Bilgi Notu - Adres", "TOPLAM TAKSİT TUTARI", "TEK TAKSİT ÜCRETİ", "TOPLAM TAKSİT ADETİ"]), { 0: "seq", 1: "name", 2: "group", 3: "subgroup", 4: "phone", 5: "note", 6: "total", 7: "installment", 8: "count" });
    assert.deepEqual(mapHeaders(["Sıra No", "Okul", "Öğrenci Adı", "Taksit Tutarı", "İlk Taksit Tarihi", "Açıklama"]), { 0: "seq", 1: "group", 2: "name", 3: "installment", 4: "firstDue", 5: "note" }, "tek alt grup kolonu grup sayılır");
    assert.equal(mapHeaders(["Telefon No", "Ad"])[0], "phone", "telefon numarası sıra no sayılmaz");
    assert.equal(parseDay("15.09.2026"), "2026-09-15");
    assert.equal(parseDay("2026-09-15"), "2026-09-15");
    assert.equal(parseDay("1/9/2026"), "2026-09-01");
    assert.equal(parseDay("Eylül 2026"), "2026-09-01");
    assert.equal(parseDay("46000"), "2025-12-09");
    assert.equal(parseDay("yok"), "");
  });

  it("tutarı yazıyla yazar", () => {
    assert.equal(amountInWords(12500.5), "on iki bin beş yüz TL elli kuruş");
    assert.equal(amountInWords(1000), "bin TL");
    assert.equal(amountInWords(2000000), "iki milyon TL");
    assert.equal(amountInWords(0.05), "beş kuruş");
  });
});

describe("taksit modülü API (v2.0.4)", () => {
  let server;
  let admin;
  let personel;
  let plan;

  before(async () => {
    server = await startTestServer();
    admin = await loginAdmin(server);
    personel = await createUser(server, admin, { username: "selin", name: "Selin Kaya", role: "personel" });
  });
  after(() => server.close());

  it("gruplar: grup ve alt grup açılır, ad çakışması reddedilir, kart varken silinmez", async () => {
    const created = await admin.post("/api/workspace/plans/groups", { name: "42 C 1070" });
    assert.equal(created.status, 200, JSON.stringify(created.data));
    const groupId = created.data.data.id;
    const sub = await admin.post("/api/workspace/plans/groups", { name: "15 Temmuz", parentId: groupId });
    assert.equal(sub.status, 200);
    assert.equal((await admin.post("/api/workspace/plans/groups", { name: "42 c 1070" })).data.data.id, groupId, "aynı ad ikinci grup açmaz");
    assert.equal((await personel.post("/api/workspace/plans/groups", { name: "X" })).status, 403);
    const tree = (await personel.get("/api/workspace/plans/groups")).data.data;
    assert.equal(tree.length, 1);
    assert.equal(tree[0].subgroups[0].name, "15 Temmuz");
    assert.equal((await admin.put(`/api/workspace/plans/groups/${sub.data.data.id}`, { name: "Karatay" })).status, 200);
  });

  it("kart açılır (taksit sorulmadan), sonra otomatik dağıtılır; tahsilat kalanı düşürür ve Kasa'ya iner", async () => {
    const groups = (await admin.get("/api/workspace/plans/groups")).data.data;
    assert.equal((await personel.post("/api/workspace/plans", { name: "Ali Veli", total: "12.000" })).status, 403);
    const created = await admin.post("/api/workspace/plans", { name: "Ali Veli", phone: "0532 111 22 33", note: "Sabah servisi", total: "12.000", groupId: groups[0].id, subgroupId: groups[0].subgroups[0].id });
    assert.equal(created.status, 200, JSON.stringify(created.data));
    plan = created.data.data;
    assert.equal(plan.items.length, 0, "kayıt bitince taksit sorulmaz");
    assert.equal(plan.totals.unplanned, 12000);
    assert.equal(plan.state, "active");
    const spread = await admin.post(`/api/workspace/plans/${plan.id}/distribute`, { count: 4, firstDue: "2026-09-05" });
    assert.equal(spread.status, 200, JSON.stringify(spread.data));
    plan = spread.data.data;
    assert.deepEqual(plan.items.map(item => item.amount), [3000, 3000, 3000, 3000]);
    assert.equal(plan.items[3].dueDate, "2026-12-05");
    assert.ok(["overdue", "active"].includes(plan.state));
    // Personel tahsilat girebilir; makbuz numarası verilir.
    const paid = await personel.post(`/api/workspace/plans/${plan.id}/entries`, { amount: "3.000", date: "2026-09-06", note: "Elden" });
    assert.equal(paid.status, 200, JSON.stringify(paid.data));
    plan = paid.data.data;
    assert.equal(plan.items[0].state, "paid");
    assert.equal(plan.totals.remaining, 9000);
    assert.equal(plan.entries[0].receiptNo, 1);
    assert.equal(plan.entries[0].editable, true, "kendi girdiği hareketi düzeltebilir");
    const cash = (await admin.get("/api/workspace/cash")).data.data;
    const entry = cash.entries.find(item => item.source === "plan");
    assert.ok(entry, "kasada taksit tahsilatı");
    assert.equal(entry.planName, "Ali Veli");
    assert.equal(cash.totals.balance, 3000);
    // Personel ödeme/iade giremez; yönetici girer, kasadan düşer.
    assert.equal((await personel.post(`/api/workspace/plans/${plan.id}/entries`, { kind: "out", amount: "100" })).status, 403);
    assert.equal((await admin.post(`/api/workspace/plans/${plan.id}/entries`, { kind: "out", amount: "100", date: "2026-09-07", note: "Fazla alınan" })).status, 200);
    assert.equal((await admin.get("/api/workspace/cash")).data.data.totals.balance, 2900);
    // Taksite bağlı tahsilat ve elle taksit ekleme.
    const third = plan.items[2];
    const targeted = (await admin.post(`/api/workspace/plans/${plan.id}/entries`, { amount: "3000", date: "2026-09-08", itemId: third.id })).data.data;
    assert.equal(targeted.items.find(item => item.id === third.id).state, "paid");
    assert.equal(targeted.items[1].paid, 0, "bağlı tahsilat 2. taksite gitmez");
    const added = (await admin.post(`/api/workspace/plans/${plan.id}/items`, { dueDate: "2027-01-05", amount: "500", note: "Servis farkı" })).data.data;
    assert.equal(added.items.length, 5);
    assert.equal(added.totals.planned, 12500);
    assert.equal(added.totals.unplanned, -500);
    // Liste ve süzgeçler.
    const list = (await personel.get("/api/workspace/plans?status=all")).data.data;
    assert.equal(list.plans.length, 1);
    assert.equal(list.plans[0].groupName, "42 C 1070");
    assert.equal(list.canManage, false);
    assert.equal((await admin.get("/api/workspace/plans?q=0532111")).data.data.plans.length, 1, "telefonla arama");
    assert.equal((await admin.get("/api/workspace/plans?q=yok")).data.data.plans.length, 0);
    assert.equal((await admin.get(`/api/workspace/plans?group=${groups[0].id}&status=done`)).data.data.plans.length, 0);
  });

  it("gecikmiş taksit tahsilat takvimine ve bildirimlere düşer; kart kapatılınca düşmez", async () => {
    const dues = (await admin.get("/api/workspace/dues")).data.data;
    const mine = dues.items.filter(item => item.source === "plan");
    assert.ok(mine.length >= 1, "takvimde taksit kalemi");
    assert.equal(mine[0].person, "Ali Veli");
    assert.equal(mine[0].planId, plan.id);
    assert.match(mine[0].label, /taksit/);
    assert.equal((await admin.put(`/api/workspace/plans/${plan.id}`, { status: "closed" })).status, 200);
    assert.equal((await admin.get("/api/workspace/dues")).data.data.items.filter(item => item.source === "plan").length, 0);
    assert.equal((await admin.put(`/api/workspace/plans/${plan.id}`, { status: "active" })).status, 200);
  });

  it("ekstre ve makbuz PDF üretilir", async () => {
    const statement = await admin.raw("GET", `/api/workspace/plans/${plan.id}/ekstre.pdf?download=1`);
    assert.equal(statement.status, 200);
    assert.equal(statement.buffer.subarray(0, 5).toString("latin1"), "%PDF-");
    assert.match(statement.headers.get("content-disposition"), /Taksit-ekstresi/);
    const detail = (await admin.get(`/api/workspace/plans/${plan.id}`)).data.data;
    const entry = detail.entries.find(item => item.kind === "in");
    const receipt = await personel.raw("GET", `/api/workspace/plans/${plan.id}/entries/${entry.id}/makbuz.pdf`);
    assert.equal(receipt.status, 200);
    assert.equal(receipt.buffer.subarray(0, 5).toString("latin1"), "%PDF-");
  });

  it("hareket silinip geri yüklenir; kart silinip geri yüklenir; Kasa yeniden hesaplanır", async () => {
    let detail = (await admin.get(`/api/workspace/plans/${plan.id}`)).data.data;
    const entry = detail.entries.find(item => item.kind === "out");
    assert.equal((await personel.del(`/api/workspace/plans/${plan.id}/entries/${entry.id}`)).status, 403, "başkasının hareketini personel silemez");
    assert.equal((await admin.del(`/api/workspace/plans/${plan.id}/entries/${entry.id}`)).status, 200);
    let trash = (await admin.get("/api/admin/trash")).data.data;
    const removed = trash.find(item => item.kind === "plan-entry");
    assert.equal(removed.title, "Ali Veli");
    assert.equal((await admin.post("/api/admin/trash/restore", { id: removed.id })).status, 200);
    detail = (await admin.get(`/api/workspace/plans/${plan.id}`)).data.data;
    assert.ok(detail.entries.some(item => item.id === entry.id), "aynı kimlikle geri geldi");
    const before = (await admin.get("/api/workspace/cash")).data.data.totals.balance;
    assert.equal((await admin.del(`/api/workspace/plans/${plan.id}`)).status, 200);
    assert.equal((await admin.get(`/api/workspace/plans/${plan.id}`)).status, 404);
    assert.equal((await admin.get("/api/workspace/cash")).data.data.totals.balance, 0, "silinen kartın hareketleri kasadan düşer");
    trash = (await admin.get("/api/admin/trash")).data.data;
    const card = trash.find(item => item.kind === "plan");
    assert.equal(card.title, "Ali Veli");
    assert.equal((await admin.post("/api/admin/trash/restore", { id: card.id })).status, 200);
    assert.equal((await admin.get("/api/workspace/cash")).data.data.totals.balance, before);
  });

  it("Excel'den ilk yükleme: başlıklar eşlenir, gruplar tanımlanır, taksitler dağıtılır, çiftler atlanır", async () => {
    const matrix = [
      ["Servis Listesi 2026"],
      ["Plaka", "Güzergah", "Adı Soyadı", "Veli Telefonu", "Toplam Tutar", "Taksit Sayısı", "İlk Vade", "Not"],
      ["42 C 1070", "15 Temmuz", "Ayşe Kaya", "0533 444 55 66", "9.000", "3", "05.10.2026", "Sabah"],
      ["42 C 1070", "Karatay", "Can Er", "", "6.000", "", "", ""],
      ["42 AB 123", "", "Deniz Ak", "", "yok", "2", "", ""],
      ["42 C 1070", "Karatay", "Ali Veli", "", "1.000", "1", "", ""],
      [],
    ];
    const preview = await admin.post("/api/workspace/plans/import/preview", { matrix });
    assert.equal(preview.status, 200, JSON.stringify(preview.data));
    assert.equal(preview.data.data.headerAt, 1);
    assert.deepEqual(preview.data.data.roles, { 0: "group", 1: "subgroup", 2: "name", 3: "phone", 4: "total", 5: "count", 6: "firstDue", 7: "note" });
    assert.equal((await personel.post("/api/workspace/plans/import", { matrix, headerAt: 1, roles: preview.data.data.roles })).status, 403);
    const result = await admin.post("/api/workspace/plans/import", { matrix, headerAt: 1, roles: preview.data.data.roles, defaultCount: 4, defaultFirstDue: "2026-11-01", fileName: "servis.xlsx" });
    assert.equal(result.status, 200, JSON.stringify(result.data));
    assert.equal(result.data.data.created, 2);
    assert.deepEqual(result.data.data.skipped.map(item => item.reason), ["Toplam tutar okunamadı", "Aynı adla açık kart var"]);
    const list = (await admin.get("/api/workspace/plans?status=all")).data.data;
    const ayse = list.plans.find(item => item.name === "Ayşe Kaya");
    assert.equal(ayse.subgroupName, "15 Temmuz");
    assert.equal(ayse.itemCount, 3);
    assert.equal(ayse.next.dueDate, "2026-10-05");
    const can = list.plans.find(item => item.name === "Can Er");
    assert.equal(can.itemCount, 4, "taksit sayısı boşsa varsayılan");
    assert.equal(can.next.dueDate, "2026-11-01");
    const groups = (await admin.get("/api/workspace/plans/groups")).data.data;
    assert.deepEqual(groups.map(group => group.name).sort(), ["42 C 1070"]);
    // Sıra No: kolon yoksa mevcut en büyük numaradan devam eder; liste varsayılan olarak Sıra No'ya göre sıralanır.
    assert.ok(Number(ayse.refNo) > 0 && Number(can.refNo) === Number(ayse.refNo) + 1, `sıra no: ${ayse.refNo}, ${can.refNo}`);
  });

  it("Sıra No: Excel'deki S.N kolonu kartın numarası olur; liste numaraya göre sıralanır, numarayla aranır; PDF süzgeçle iner", async () => {
    const matrix = [
      ["S.N", "ADI SOYADI", "GRUBU (Plaka)", "ARA GRUBU (Okulu)", "TELEFONU", "Bilgi Notu - Adres", "TOPLAM TAKSİT TUTARI", "TEK TAKSİT ÜCRETİ", "TOPLAM TAKSİT ADETİ"],
      ["10", "Zeynep Ak", "42 C 0348", "Akabe İlk Okulu", "5537416138", "Süleyman Şah Siteleri", "9.000", "1.000", "9"],
      ["2", "Beyza Öykü İçer", "42 C 0348", "Akabe İlk Okulu", "5530000000", "", "", "1.500", "6"],
    ];
    const preview = (await admin.post("/api/workspace/plans/import/preview", { matrix })).data.data;
    assert.equal(preview.roles[0], "seq");
    const result = (await admin.post("/api/workspace/plans/import", { matrix, headerAt: preview.headerAt, roles: preview.roles, defaultFirstDue: "2026-10-01" })).data.data;
    assert.equal(result.created, 2, JSON.stringify(result));
    const list = (await admin.get("/api/workspace/plans?status=all")).data.data;
    const numbers = list.plans.map(plan => plan.refNo);
    assert.equal(list.sort, "no");
    assert.ok(numbers.indexOf("2") < numbers.indexOf("10"), `2, 10'dan önce: ${numbers.join(",")}`);
    const beyza = list.plans.find(plan => plan.name === "Beyza Öykü İçer");
    assert.equal(beyza.refNo, "2");
    assert.equal(beyza.totals.total, 9000, "toplam boşsa taksit ücreti × adet");
    assert.equal(beyza.itemCount, 6);
    assert.equal(beyza.subgroupName, "Akabe İlk Okulu");
    const zeynep = list.plans.find(plan => plan.name === "Zeynep Ak");
    assert.equal(zeynep.note, "Süleyman Şah Siteleri");
    assert.equal(zeynep.itemCount, 9);
    const group = (await admin.get("/api/workspace/plans/groups")).data.data.find(item => item.name === "42 C 0348");
    assert.deepEqual((await admin.get(`/api/workspace/plans?status=all&group=${group.id}&q=10`)).data.data.plans.map(plan => plan.name), ["Zeynep Ak"], "sıra numarasıyla arama");
    const byName = (await admin.get("/api/workspace/plans?status=all&sort=name")).data.data.plans.map(plan => plan.name);
    assert.deepEqual(byName, [...byName].sort((a, b) => a.localeCompare(b, "tr")));
    // Yeni kartın numarası: en büyük numaradan bir sonraki; elle verilen numara korunur ve düzeltilir.
    const created = (await admin.post("/api/workspace/plans", { name: "Yeni Öğrenci", total: "1.000" })).data.data;
    assert.equal(created.refNo, "11");
    const edited = (await admin.put(`/api/workspace/plans/${created.id}`, { refNo: "3A" })).data.data;
    assert.equal(edited.refNo, "3A");
    // Liste PDF'i ekrandaki süzgeçle (grup) hazırlanır.
    const pdf = await personel.raw("GET", `/api/workspace/plans/liste.pdf?status=all&group=${group.id}&title=Aidatlar`);
    assert.equal(pdf.status, 200);
    assert.equal(pdf.buffer.subarray(0, 5).toString("latin1"), "%PDF-");
    assert.match(pdf.headers.get("content-disposition"), /Aidatlar-listesi/);
    const statement = await admin.raw("GET", `/api/workspace/plans/${zeynep.id}/ekstre.pdf`);
    assert.equal(statement.status, 200);
  });
});
