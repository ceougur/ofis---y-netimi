// Tablodan taksit kartına aktarma (v2.0.8). Birim: tablodaki ödeme planı biçimleri (ay kolonları — plan ve ödeme kipi,
// sıralı taksit kolonları, toplam + taksit sayısı + ilk vade), Excel'e göre ödenen, doğrulama bulguları.
// İş akışı (CLAUDE.md): boş veri; yükle → ön izle → aktar; Kasa değişmez; cari bakiyesi = Excel'deki kalan; takvimde çift
// kalem yok; kayıt tahsilatı karta taşınır; tekrar aktarım çift kart açmaz; bağsız kart bağlanır; aynı adlı iki kişi;
// yetkisiz kullanıcı; ön izlemeden sonra değişen tablo; geri alma; açılış kaydının makbuzu/silinmesi/geri yüklenmesi.
import assert from "node:assert/strict";
import { after, before, describe, it } from "node:test";
import { computeDues } from "../server/lib/insight/dues.mjs";
import { extractSchedules } from "../server/lib/insight/schedules.mjs";
import { createUser, loginAdmin, startTestServer } from "./helpers.mjs";

const NAMES = ["Ocak", "Şubat", "Mart", "Nisan", "Mayıs", "Haziran", "Temmuz", "Ağustos", "Eylül", "Ekim", "Kasım", "Aralık"];
const NOW = new Date();
// Bugüne göre ay: offset 0 = bu ay. Başlık "Eylül 2026 taksiti" gibi (yıl yazılı: test hangi gün koşarsa koşsun aynı).
const monthOf = offset => {
  const date = new Date(NOW.getFullYear(), NOW.getMonth() + offset, 1);
  return { name: NAMES[date.getMonth()], year: date.getFullYear(), month: date.getMonth() + 1 };
};
const header = (offset, suffix = " taksiti") => `${monthOf(offset).name} ${monthOf(offset).year}${suffix}`;
const iso = (offset, day = 1) => {
  const { year, month } = monthOf(offset);
  return `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
};
const rowsOf = (tab, list) => list.map((values, index) => ({ ...values, __sheet: tab, __hofKey: `${tab}-${index}`, __hofSheet: tab }));
const byName = (records, name) => records.find(record => record.name === name);
const codes = record => record.issues.map(issue => issue.code);

describe("tablodaki ödeme planı → taksit kartı taslağı (saf)", () => {
  it("ay kolonları, plan kipi: hücre taksit tutarıdır; Ödenen toplamı en eski taksitten düşülür", () => {
    const rows = rowsOf("Okul", [
      { "Ad Soyad": "Ali Veli", Telefon: "0532 111 22 33", [header(-1)]: "10.000", [header(0)]: "10.000", [header(1)]: "10.000", Toplam: "30.000", Ödenen: "12.000" },
      { "Ad Soyad": "Ayşe Kaya", Telefon: "0532 444 55 66", [header(-1)]: "10.000 ödendi", [header(0)]: "10.000", [header(1)]: "", Toplam: "20.000", Ödenen: "10.000" },
      { "Ad Soyad": "Can Tan", Telefon: "", [header(-1)]: "5.000", [header(0)]: "5.000", [header(1)]: "5.000", Toplam: "16.000", Ödenen: "" },
    ]);
    const { tabs, records } = extractSchedules({ rows, tabs: ["Okul"], now: NOW, dueDay: 5 });
    assert.equal(tabs.length, 1);
    assert.equal(tabs[0].shape, "months");
    assert.equal(tabs[0].monthMode, "plan");
    const ali = byName(records, "Ali Veli");
    assert.deepEqual(ali.items.map(item => [item.dueDate, item.amount, item.paid]), [[iso(-1, 5), 10000, 10000], [iso(0, 5), 10000, 2000], [iso(1, 5), 10000, 0]]);
    assert.equal(ali.total, 30000);
    assert.equal(ali.remaining, 18000);
    // "ödendi" yazan ay + Ödenen (toplam): aynı para iki kez sayılmaz (v2.0.8 düzeltmesi).
    const ayse = byName(records, "Ayşe Kaya");
    assert.deepEqual(ayse.items.map(item => [item.amount, item.paid]), [[10000, 10000], [10000, 0]], "boş ay planda taksit değildir");
    assert.equal(ayse.remaining, 10000);
    // Toplam kolonu taksitlerin toplamıyla tutmuyor: aktarılır ama uyarı.
    const can = byName(records, "Can Tan");
    assert.ok(codes(can).includes("total-mismatch"));
    assert.ok(!can.issues.some(issue => issue.level === "error"));
  });

  it("takvim de aynı kuralı kullanır: 'ödendi' yazan ay + Ödenen toplamı sonraki ayı kapatmaz", () => {
    const rows = rowsOf("Okul", [{ "Ad Soyad": "Ayşe Kaya", [header(-1)]: "10.000 ödendi", [header(0)]: "10.000", Toplam: "20.000", Ödenen: "10.000" }, { "Ad Soyad": "Ece Su", [header(-1)]: "10.000", [header(0)]: "10.000", Toplam: "20.000", Ödenen: "" }]);
    const { items } = computeDues({ rows, tabs: ["Okul"], now: NOW });
    const ayse = items.filter(item => item.person === "Ayşe Kaya");
    assert.equal(ayse.length, 1, "bu ayın taksiti hâlâ açık");
    assert.equal(ayse[0].amount, 10000);
  });

  it("ay kolonları, ödeme kipi: aylık ücret × dönem; hücre ödemedir; muaf ay taksit değildir; kısmi ve peşin ödeme", () => {
    const months = [-2, -1, 0, 1, 2];
    const values = cells => Object.fromEntries(months.map((offset, index) => [header(offset, ""), cells[index] ?? ""]));
    const rows = rowsOf("Servis", [
      { Öğrenci: "Deniz Ay", "Aylık ücret": "3.000", ...values(["3.000", "1.500", "", "3.000", ""]) },
      { Öğrenci: "Efe Kurt", "Aylık ücret": "2.000", ...values(["", "2.000", "muaf", "", ""]) },
    ]);
    const { tabs, records } = extractSchedules({ rows, tabs: ["Servis"], now: NOW, dueDay: 10 });
    assert.equal(tabs[0].monthMode, "payment");
    const deniz = byName(records, "Deniz Ay");
    assert.deepEqual(deniz.items.map(item => [item.dueDate, item.amount, item.paid]), [[iso(-2, 10), 3000, 3000], [iso(-1, 10), 3000, 1500], [iso(0, 10), 3000, 0], [iso(1, 10), 3000, 3000], [iso(2, 10), 3000, 0]]);
    assert.equal(deniz.total, 15000);
    assert.equal(deniz.paid, 7500);
    const efe = byName(records, "Efe Kurt");
    assert.equal(efe.items[0].dueDate, iso(-1, 10), "dönem ilk yazılı aydan başlar");
    assert.ok(!efe.items.some(item => item.dueDate === iso(0, 10)), "muaf ay taksit değildir");
    assert.equal(efe.items.length, 3);
  });

  it("ödeme kipi: son yazılı aydan sonra 3 ay boşsa 'ayrılmış olabilir' uyarısı ve dönem son yazılı ayda biter", () => {
    const months = [-6, -5, -4, -3, -2, -1, 0, 1];
    const rows = rowsOf("Servis", [
      { Öğrenci: "Gül Er", "Aylık ücret": "1.000", ...Object.fromEntries(months.map(offset => [header(offset, ""), offset <= -5 ? "1.000" : ""])) },
      { Öğrenci: "Ata Ek", "Aylık ücret": "1.000", ...Object.fromEntries(months.map(offset => [header(offset, ""), "1.000"])) },
    ]);
    const { records } = extractSchedules({ rows, tabs: ["Servis"], now: NOW });
    const gul = byName(records, "Gül Er");
    assert.ok(codes(gul).includes("dormant"));
    assert.equal(gul.items.length, 2);
    assert.equal(gul.remaining, 0);
    assert.equal(gul.closed, true, "ödenmiş plan kapalı sayılır");
  });

  it("sıralı taksit kolonları: tarih + tutar; tarihsiz 'ödendi' komşudan tahmin; Kalan kolonundan ödenen", () => {
    const rows = rowsOf("Senet", [
      { Borçlu: "Mehmet Öz", "1. Taksit Tarihi": iso(-2, 15).split("-").reverse().join("."), "1. Taksit Tutarı": "5.000", "2. Taksit Tarihi": iso(-1, 15).split("-").reverse().join("."), "2. Taksit Tutarı": "5.000", "3. Taksit Tarihi": iso(0, 15).split("-").reverse().join("."), "3. Taksit Tutarı": "5.000", Kalan: "10.000" },
      { Borçlu: "Zeynep Ak", "1. Taksit Tarihi": "ödendi", "1. Taksit Tutarı": "4.000", "2. Taksit Tarihi": iso(1, 20).split("-").reverse().join("."), "2. Taksit Tutarı": "4.000", "3. Taksit Tarihi": "", "3. Taksit Tutarı": "", Kalan: "4.000" },
    ]);
    const { tabs, records } = extractSchedules({ rows, tabs: ["Senet"], now: NOW });
    assert.equal(tabs[0].shape, "series");
    const mehmet = byName(records, "Mehmet Öz");
    assert.deepEqual(mehmet.items.map(item => [item.dueDate, item.amount, item.paid]), [[iso(-2, 15), 5000, 5000], [iso(-1, 15), 5000, 0], [iso(0, 15), 5000, 0]]);
    assert.ok(!codes(mehmet).includes("remaining-mismatch"), "Kalan kolonu ödenen olarak okundu");
    const zeynep = byName(records, "Zeynep Ak");
    assert.equal(zeynep.items.length, 2, "boş 3. taksit planda yok");
    assert.equal(zeynep.items[0].dueDate, iso(0, 20), "tarihsiz ödenmiş taksit bir ay önceye yazıldı");
    assert.ok(codes(zeynep).includes("guessed-date"));
    assert.equal(zeynep.remaining, 4000);
  });

  it("toplam + taksit sayısı + ilk vade (Taksitler'in Excel biçimi); ilk vadesi olmayan satır seçilen tarihle", () => {
    const rows = rowsOf("Kartlar", [
      { "S.N": "7", "Ad Soyad": "Hakan Arıkan", Telefon: "0541 222 33 44", "TOPLAM TAKSİT TUTARI": "12.000", "TOPLAM TAKSİT ADETİ": "4", "İLK TAKSİT TARİHİ": iso(-1, 1).split("-").reverse().join("."), Ödenen: "3.500" },
      { "S.N": "8", "Ad Soyad": "Hasan Doğan", Telefon: "", "TOPLAM TAKSİT TUTARI": "9.000", "TOPLAM TAKSİT ADETİ": "3", "İLK TAKSİT TARİHİ": "", Ödenen: "" },
    ]);
    const first = extractSchedules({ rows, tabs: ["Kartlar"], now: NOW });
    assert.equal(first.tabs[0].shape, "summary");
    const hakan = byName(first.records, "Hakan Arıkan");
    assert.deepEqual(hakan.items.map(item => [item.amount, item.paid]), [[3000, 3000], [3000, 500], [3000, 0], [3000, 0]]);
    assert.equal(hakan.refNo, "7");
    assert.ok(codes(byName(first.records, "Hasan Doğan")).includes("no-first-due"));
    const second = extractSchedules({ rows, tabs: ["Kartlar"], now: NOW, defaultFirstDue: iso(1, 1) });
    const hasan = byName(second.records, "Hasan Doğan");
    assert.equal(hasan.items[0].dueDate, iso(1, 1));
    assert.equal(hasan.items.length, 3);
  });

  it("plan olmayan tablolar aktarılmaz: tek vadeli alacak, ödeme sözü, 'her ayın 5'i' kira", () => {
    const rows = [
      ...rowsOf("İcra", [{ Borçlu: "X Ltd", "Son ödeme": iso(0, 20).split("-").reverse().join("."), Alacak: "50.000" }, { Borçlu: "Y Ltd", "Son ödeme": iso(1, 2).split("-").reverse().join("."), Alacak: "20.000" }]),
      ...rowsOf("Kira", [{ Kiracı: "Ahmet", "Kira günü": "5", Kira: "12.000" }, { Kiracı: "Burak", "Kira günü": "10", Kira: "9.000" }]),
    ];
    const { tabs, records } = extractSchedules({ rows, tabs: ["İcra", "Kira"], now: NOW });
    assert.equal(tabs.length, 0);
    assert.equal(records.length, 0);
  });

  it("doğrulama: tutarı okunamayan taksit ve ödenenin toplamı aşması hata; kapanmış ve ayrılmış satırlar işaretli", () => {
    const rows = rowsOf("Okul", [
      { "Ad Soyad": "Tutar Yok", [header(-1)]: "✓", [header(0)]: "10.000", Toplam: "20.000", Ödenen: "", Durum: "" },
      { "Ad Soyad": "Fazla Ödeme", [header(-1)]: "1.000", [header(0)]: "1.000", Toplam: "2.000", Ödenen: "5.000", Durum: "" },
      { "Ad Soyad": "Ayrılan", [header(-1)]: "1.000", [header(0)]: "1.000", Toplam: "2.000", Ödenen: "", Durum: "Ayrıldı" },
      { "Ad Soyad": "Kapanan", [header(-1)]: "1.000", [header(0)]: "1.000", Toplam: "2.000", Ödenen: "", Durum: "Ödendi" },
    ]);
    const { records } = extractSchedules({ rows, tabs: ["Okul"], now: NOW });
    assert.ok(byName(records, "Tutar Yok").issues.some(issue => issue.level === "error" && issue.code === "no-amount"));
    assert.ok(byName(records, "Fazla Ödeme").issues.some(issue => issue.level === "error" && issue.code === "overpaid"));
    assert.equal(byName(records, "Ayrılan").inactive, true);
    assert.equal(byName(records, "Kapanan").closed, true);
  });

  it("takvimde 'Ödendi say' denen ay ödenmiş, 'İptal' denen ay taksit değildir", () => {
    const rows = rowsOf("Okul", [{ "Ad Soyad": "Ali Veli", [header(-1)]: "1.000", [header(0)]: "1.000", [header(1)]: "1.000" }, { "Ad Soyad": "Ece Su", [header(-1)]: "1.000", [header(0)]: "1.000", [header(1)]: "1.000" }]);
    const monthStart = offset => Date.UTC(monthOf(offset).year, monthOf(offset).month - 1, 1);
    const id = offset => `due|Okul|Okul-0|${header(offset)}|${new Date(monthStart(offset)).toISOString().slice(0, 10)}`;
    const { records } = extractSchedules({ rows, tabs: ["Okul"], now: NOW, settled: { [id(-1)]: { reason: "paid" }, [id(1)]: { reason: "cancelled" } } });
    const ali = byName(records, "Ali Veli");
    assert.deepEqual(ali.items.map(item => item.paid), [1000, 0]);
    assert.ok(codes(ali).includes("cancelled"));
  });
});

describe("tablodan taksit kartına aktarma (iş akışı)", () => {
  let server;
  let admin;
  let staff;
  let rows = [];
  const get = async (url, client = admin) => {
    const response = await client.get(url);
    return { status: response.status, data: response.data?.data, error: response.data?.error };
  };
  const post = async (url, body, client = admin) => {
    const response = await client.post(url, body);
    return { status: response.status, data: response.data?.data, error: response.data?.error };
  };
  const del = async (url, client = admin) => {
    const response = await client.del(url);
    return { status: response.status, data: response.data?.data, error: response.data?.error };
  };
  const keyOf = (name, phone = null) => rows.find(row => row["Ad Soyad"] === name && (phone === null || row.Telefon === phone))?.__hofKey;
  const kasa = async () => (await get("/api/workspace/cash")).data.totals.balance;
  const accountOfCase = async key => (await get(`/api/workspace/cases/${encodeURIComponent(key)}/account`)).data.account;
  const planOfCase = async key => (await get(`/api/workspace/cases/${encodeURIComponent(key)}/plans`)).data.plans;
  const collections = async () => (await get("/api/workspace/reports")).data.report.find(item => item.userName === "Ofis yöneticisi" || item.role === "admin").collections;
  const preview = async (query = "") => (await get(`/api/workspace/plans/from-table${query}`)).data;

  before(async () => {
    server = await startTestServer();
    admin = await loginAdmin(server);
    staff = await createUser(server, admin, { username: "vezne", name: "Vezne", role: "personel" });
  });
  after(() => server.close());

  it("boş veride ön izleme ve 'aktarılsın mı' sorusu hatasız, boş döner", async () => {
    const empty = await get("/api/workspace/plans/from-table");
    assert.equal(empty.status, 200);
    assert.equal(empty.data.records.length, 0);
    const summary = await get("/api/workspace/plans/from-table/summary");
    assert.equal(summary.status, 200);
    assert.equal(summary.data.count, 0);
    assert.equal(summary.data.ask, false);
  });

  it("yükleme → ön izleme: her kişinin durumu, Excel'e göre ödenen, kayıt tahsilatı ve kalan", async () => {
    const matrix = [
      ["Ad Soyad", "Telefon", header(-2), header(-1), header(0), header(1), "Toplam", "Ödenen"],
      ["Ali Veli", "0532 111 22 33", "10.000", "10.000", "10.000", "10.000", "40.000", "12.000"],
      ["Ayşe Kaya", "0532 444 55 66", "5.000 ödendi", "5.000", "5.000", "5.000", "20.000", ""],
      ["Ali Veli", "0532 999 88 77", "3.000", "3.000", "3.000", "3.000", "12.000", "0"],
      ["Mehmet Öz", "", "2.000", "2.000", "2.000", "2.000", "8.000", "8.000"],
      ["Zeynep Ak", "", "1.000", "1.000", "1.000", "1.000", "5.000", "1.000"],
    ];
    const icra = [["Borçlu", "Son ödeme", "Alacak"], ["X Ltd", iso(0, 28).split("-").reverse().join("."), "50.000"], ["Y Ltd", iso(1, 3).split("-").reverse().join("."), "20.000"]];
    const staged = await post("/api/workspace/dataset/stage", { kind: "excel", fileName: "okul.xlsx", sheets: [{ name: "Okul", matrix }, { name: "İcra", matrix: icra }] });
    assert.equal(staged.status, 200, staged.error);
    assert.equal((await post("/api/workspace/dataset/commit", { stageId: staged.data.stageId, mode: "replace" })).status, 200);
    rows = (await admin.get(`/api/trpc/sheets.getRows?input=${encodeURIComponent(JSON.stringify({ json: {} }))}`)).data.result.data.json.rows;
    // Aktarımdan önce programda: Ayşe'ye kayıt kartından tahsilat (notunda geçen ayın adı), Zeynep'e Taksitler'den bağsız kart.
    const ayse = keyOf("Ayşe Kaya");
    assert.equal((await post(`/api/workspace/cases/${encodeURIComponent(ayse)}/payments`, { amount: "2.500", date: iso(-1, 12), note: `${monthOf(-1).name} taksiti`, caseTitle: "Ayşe Kaya" })).status, 200);
    const zeynepCard = await post("/api/workspace/plans", { name: "Zeynep Ak", total: "4.000", mode: "auto", count: 4, firstDue: iso(-2, 1), registeredOn: iso(-2, 1) });
    assert.equal(zeynepCard.status, 200, zeynepCard.error);

    const summary = await get("/api/workspace/plans/from-table/summary");
    assert.equal(summary.data.ask, true);
    assert.equal(summary.data.count, 4, "hazır + uyarılı + bağlanacak (kapanmış hariç)");
    const data = await preview();
    assert.equal(data.tabs.length, 1, "İcra sekmesi plan değildir");
    const record = name => data.records.find(item => item.name === name && (name !== "Ali Veli" || item.phone === "0532 111 22 33"));
    assert.equal(record("Ali Veli").status, "warning", "aynı adlı iki kayıt uyarısı");
    assert.equal(record("Ali Veli").remaining, 28000);
    assert.equal(record("Ayşe Kaya").status, "ready");
    assert.equal(record("Ayşe Kaya").paid, 5000, "Excel'de ödendi yazan ay");
    assert.equal(record("Ayşe Kaya").programPaid, 2500, "kayıt kartından girilen tahsilat");
    assert.equal(record("Ayşe Kaya").remaining, 12500);
    assert.equal(record("Mehmet Öz").status, "closed");
    assert.equal(record("Mehmet Öz").selected, false);
    assert.equal(record("Zeynep Ak").status, "link");
    assert.equal(record("Zeynep Ak").linkPlanId, zeynepCard.data.id);
    assert.equal(data.totals.selected, 4);
    // Aktarımdan önce bu kişilerin ayları takvimde ve vade takipte tablodan gelir (sonraki adımda çift sayılmadığı kanıtlanır).
    const duesBefore = (await get("/api/workspace/dues")).data.items.filter(item => item.tab === "Okul" && item.caseKey === ayse);
    assert.ok(duesBefore.length >= 1, "aktarımdan önce Ayşe'nin ayı takvimde tablodan");
    const vadeBefore = (await get("/api/workspace/reports/vade-takip")).data.report.rows.filter(row => row.tab === "Okul" && row.caseKey === ayse);
    assert.ok(vadeBefore.length >= 1, "aktarımdan önce vade takipte tablodan");
  });

  it("yetkisiz kullanıcı ön izleyemez ve aktaramaz; soru ona sorulmaz", async () => {
    assert.equal((await get("/api/workspace/plans/from-table", staff)).status, 403);
    assert.equal((await post("/api/workspace/plans/from-table", { keys: [keyOf("Ayşe Kaya")] }, staff)).status, 403);
    const summary = await get("/api/workspace/plans/from-table/summary", staff);
    assert.equal(summary.status, 200);
    assert.equal(summary.data.ask, false);
  });

  it("ön izlemeden sonra tablo/kart değişirse aktarım durur (409)", async () => {
    const data = await preview();
    await post("/api/workspace/plans", { name: "Araya Giren Kart", total: "100" });
    const stale = await post("/api/workspace/plans/from-table", { keys: [keyOf("Ayşe Kaya")], fingerprint: data.fingerprint });
    assert.equal(stale.status, 409);
    assert.equal(server.app.store.get("SELECT COUNT(*) AS n FROM plans WHERE import_id <> ''").n, 0, "hiçbir kart açılmadı");
  });

  let importId = "";
  let baseline = {};
  it("aktar: kartlar gerçek taksitlerle; Kasa değişmez; cari bakiyesi = Excel'deki kalan; kayıt tahsilatı karta taşınır", async () => {
    baseline = { kasa: await kasa(), collections: await collections() };
    const data = await preview();
    const keys = data.records.filter(item => item.selected).map(item => item.key);
    const result = await post("/api/workspace/plans/from-table", { keys, fingerprint: data.fingerprint });
    assert.equal(result.status, 200, result.error);
    importId = result.data.importId;
    assert.equal(result.data.created, 3);
    assert.equal(result.data.linked, 1);
    assert.equal(result.data.paymentsMoved, 1);
    assert.equal(result.data.accountsCreated, 3);
    assert.equal(result.data.accountsLinked, 1, "Zeynep'in kartının carisi kayda bağlandı");
    assert.equal(result.data.skipped.length, 0);
    assert.equal(await kasa(), baseline.kasa, "Kasa toplamı değişmedi (açılış Kasa dışı, tahsilat yalnız yer değiştirdi)");
    assert.equal(await collections(), baseline.collections, "personel raporundaki tahsilat değişmedi");
    // Ayşe: 4 taksit; açılış (Excel'de ödendi) + kayıt kartından taşınan tahsilat (notundaki aya bağlı).
    const [aysePlan] = await planOfCase(keyOf("Ayşe Kaya"));
    assert.ok(aysePlan, "kart kayda bağlı");
    assert.equal(aysePlan.items.length, 4);
    assert.deepEqual(aysePlan.items.map(item => item.dueDate), [iso(-2, 1), iso(-1, 1), iso(0, 1), iso(1, 1)]);
    const opening = aysePlan.entries.filter(entry => entry.opening);
    assert.equal(opening.length, 1);
    assert.equal(opening[0].amount, 5000);
    const moved = aysePlan.entries.find(entry => !entry.opening);
    assert.equal(moved.amount, 2500);
    assert.equal(moved.date, iso(-1, 12), "tahsilatın tarihi korunur");
    assert.equal(moved.itemId, aysePlan.items[1].id, "notundaki aya bağlandı");
    assert.equal(aysePlan.totals.paid, 7500);
    assert.equal(aysePlan.totals.remaining, 12500);
    assert.equal(server.app.store.get("SELECT COUNT(*) AS n FROM payments").n, 0, "kayıt tahsilatı kayıt defterinden çıktı");
    const ayseAccount = await accountOfCase(keyOf("Ayşe Kaya"));
    assert.equal(ayseAccount.id, aysePlan.accountId, "kart ve cari aynı kayda bağlı");
    assert.equal(ayseAccount.totals.balance, 12500, "cari bakiyesi = kalan");
    const ali = await accountOfCase(keyOf("Ali Veli", "0532 111 22 33"));
    const ali2 = await accountOfCase(keyOf("Ali Veli", "0532 999 88 77"));
    assert.notEqual(ali.id, ali2.id, "aynı adlı iki kişi iki ayrı cari");
    assert.equal(ali.totals.balance, 28000);
    assert.equal(ali2.totals.balance, 12000);
    // Zeynep: yeni kart açılmadı, Taksitler'deki kart kayda bağlandı.
    const zeynepPlans = await planOfCase(keyOf("Zeynep Ak"));
    assert.equal(zeynepPlans.length, 1);
    assert.equal(zeynepPlans[0].name, "Zeynep Ak");
    assert.equal(server.app.store.get("SELECT COUNT(*) AS n FROM plans WHERE name = 'Zeynep Ak'").n, 1);
  });

  it("takvimde çift kalem yok: kartı olan kişinin tablodaki ayları sayılmaz; kartın taksitleri ve diğer tablolar kalır", async () => {
    const dues = (await get("/api/workspace/dues")).data;
    const table = dues.items.filter(item => item.source !== "plan" && item.source !== "cheque" && item.tab === "Okul");
    const carded = new Set([keyOf("Ali Veli", "0532 111 22 33"), keyOf("Ali Veli", "0532 999 88 77"), keyOf("Ayşe Kaya"), keyOf("Zeynep Ak")]);
    assert.equal(table.filter(item => carded.has(item.caseKey)).length, 0, "tablodan ikinci kez gelmedi");
    const planItems = dues.items.filter(item => item.source === "plan" && item.caseKey === keyOf("Ayşe Kaya"));
    assert.ok(planItems.length >= 1, "kartın geciken/bu ayki taksiti takvimde");
    assert.ok(dues.items.some(item => item.tab === "İcra"), "plan olmayan tablonun kalemleri kalır");
    // Rapor merkezi ve eski raporlar da aynı kuralla.
    const vade = await get("/api/workspace/reports/vade-takip");
    assert.equal(vade.status, 200, vade.error);
    const vadeRows = vade.data.report.rows || [];
    assert.equal(vadeRows.filter(row => row.tab === "Okul" && carded.has(row.caseKey)).length, 0, "vade takipte de çift kalem yok");
    assert.ok(vadeRows.some(row => row.tab === "İcra"), "vade takip diğer tabloları göstermeye devam eder");
  });

  it("tekrar aktarım çift kart açmaz: kişiler 'kartı var' olur, aktarılmaz", async () => {
    const data = await preview();
    for (const name of ["Ayşe Kaya", "Zeynep Ak"]) assert.equal(data.records.find(item => item.name === name).status, "exists");
    const again = await post("/api/workspace/plans/from-table", { keys: [keyOf("Ayşe Kaya"), keyOf("Zeynep Ak")], fingerprint: data.fingerprint });
    assert.equal(again.status, 200);
    assert.equal(again.data.created, 0);
    assert.equal(again.data.skipped.length, 2);
    assert.equal(server.app.store.get("SELECT COUNT(*) AS n FROM plans WHERE deleted_at IS NULL AND case_key = ?", keyOf("Ayşe Kaya")).n, 1);
  });

  it("açılış kaydı: makbuzu olmaz; personel silemez; yönetici silip Silinenler'den geri alınca yine açılıştır (Kasa değişmez)", async () => {
    const [plan] = await planOfCase(keyOf("Ali Veli", "0532 111 22 33"));
    const opening = plan.entries.find(entry => entry.opening);
    assert.ok(opening);
    const receipt = await admin.get(`/api/workspace/plans/${plan.id}/entries/${opening.id}/makbuz.pdf`);
    assert.equal(receipt.status, 409);
    assert.equal((await del(`/api/workspace/plans/${plan.id}/entries/${opening.id}`, staff)).status, 403);
    const kasaBefore = await kasa();
    assert.equal((await del(`/api/workspace/plans/${plan.id}/entries/${opening.id}`)).status, 200);
    assert.equal(await kasa(), kasaBefore);
    const trash = (await get("/api/admin/trash")).data;
    const item = (trash.items || trash).find(entry => entry.kind === "plan-entry");
    assert.ok(item, "Silinenler'de");
    assert.equal((await post("/api/admin/trash/restore", { id: item.id })).status, 200);
    assert.equal(server.app.store.get("SELECT opening FROM plan_entries WHERE id = ?", opening.id).opening, 1);
    assert.equal(await kasa(), kasaBefore, "geri gelen açılış Kasa'ya girmedi");
  });

  it("rapor merkezi: açılış tahsilat toplamına girmez, ayrı satırda; mizan = cari listesi", async () => {
    const report = (await get("/api/workspace/report-center/taksit-tahsilatlari?preset=all")).data;
    const summary = Object.fromEntries(report.summary);
    assert.ok(summary["Açılış (devir, Kasa dışı)"], "açılış ayrı satırda");
    assert.ok(report.rows.some(row => row.includes("Açılış (devir)")));
    const accounts = (await get("/api/workspace/accounts?status=all")).data.accounts;
    const mizan = (await get(`/api/workspace/overview/mizan?from=2000-01-01&to=${iso(12, 28)}&idle=1`)).data;
    const sum = list => Math.round(list.reduce((total, value) => total + value, 0) * 100) / 100;
    assert.equal(sum((mizan.rows || []).map(row => row.balance ?? row.closing ?? 0)), sum(accounts.map(account => account.balance)));
    // Her carinin ekstresinin kapanışı cari listesindeki bakiyeyle aynı (açılış kaydı dahil).
    for (const account of accounts) {
      const statement = (await get(`/api/workspace/overview/ekstre?account=${account.id}&from=2000-01-01&to=${iso(12, 28)}`)).data;
      assert.ok(Math.abs((statement.closing ?? statement.totals?.closing) - account.balance) < 0.005, `${account.name} ekstresi`);
    }
  });

  it("geri alma: karta işlem yapıldıysa durur; işlem kaldırılınca her şey aktarım öncesine döner", async () => {
    const [plan] = await planOfCase(keyOf("Ali Veli", "0532 999 88 77"));
    const paid = await post(`/api/workspace/plans/${plan.id}/entries`, { kind: "in", amount: "1.000", date: iso(0, 1) }); // bu ayın 1'i: ileri tarih olmasın (v2.0.13)
    assert.equal(paid.status, 200);
    const blocked = await post(`/api/workspace/plans/imports/${importId}/undo`, {});
    assert.equal(blocked.status, 409);
    assert.match(blocked.error, /Ali Veli/);
    assert.equal((await del(`/api/workspace/plans/${plan.id}/entries/${paid.data.entryId}`)).status, 200);
    const kasaBefore = await kasa();
    const undone = await post(`/api/workspace/plans/imports/${importId}/undo`, {});
    assert.equal(undone.status, 200, undone.error);
    assert.equal(undone.data.plans, 3);
    assert.equal(undone.data.links, 1);
    assert.equal(undone.data.payments, 1);
    assert.equal(undone.data.accounts, 3);
    assert.equal(await kasa(), kasaBefore, "Kasa geri almada da değişmez");
    assert.equal(server.app.store.get("SELECT COUNT(*) AS n FROM plans WHERE import_id = ?", importId).n, 0);
    assert.equal(server.app.store.get("SELECT COUNT(*) AS n FROM payments WHERE case_key = ?", keyOf("Ayşe Kaya")).n, 1, "kayıt tahsilatı kayıt kartına döndü");
    assert.equal((await planOfCase(keyOf("Zeynep Ak"))).length, 0, "bağ kaldırıldı");
    assert.equal(server.app.store.get("SELECT COUNT(*) AS n FROM plans WHERE name = 'Zeynep Ak' AND deleted_at IS NULL").n, 1, "Zeynep'in önceden var olan kartı yerinde");
    assert.equal(await accountOfCase(keyOf("Ayşe Kaya")), null, "aktarımın açtığı cari kalktı");
    assert.equal(await collections(), baseline.collections);
    const again = await post(`/api/workspace/plans/imports/${importId}/undo`, {});
    assert.equal(again.status, 409);
    // Geri alındıktan sonra yeniden aktarılabilir.
    const data = await preview();
    assert.equal(data.records.find(item => item.name === "Ayşe Kaya").status, "ready");
  });

  it("kart bir kayda bağlıysa, başka kayda bağlı aynı ad + telefonlu cari kullanılmaz", async () => {
    const first = keyOf("Ali Veli", "0532 111 22 33");
    const linked = await post(`/api/workspace/cases/${encodeURIComponent(first)}/account`, { name: "Ali Veli", phone: "0532 111 22 33" });
    assert.equal(linked.status, 200);
    const other = keyOf("Mehmet Öz");
    const card = await post("/api/workspace/plans", { name: "Ali Veli", phone: "0532 111 22 33", total: "1.000", caseKey: other, caseTitle: "Mehmet Öz satırı" });
    assert.equal(card.status, 200, card.error);
    assert.notEqual(card.data.accountId, linked.data.id, "başka kaydın carisine yazılmadı");
  });
});

describe("Taksitler → Excel/Sheets'ten yükle (v2.0.8): gerçek vadeler, Ödenen/Kalan, tablo kaydına bağ, geri alma", () => {
  let server;
  let admin;
  const get = async (url) => {
    const response = await admin.get(url);
    return { status: response.status, data: response.data?.data, error: response.data?.error };
  };
  const post = async (url, body) => {
    const response = await admin.post(url, body);
    return { status: response.status, data: response.data?.data, error: response.data?.error };
  };
  const dmy = value => value.split("-").reverse().join(".");
  before(async () => {
    server = await startTestServer();
    admin = await loginAdmin(server);
  });
  after(() => server.close());

  it("ay kolonlu Excel: taksitler ay kolonlarından, 'ödendi' yazan ay açılış; ilk vade/taksit sayısı rolleri kapatılır", async () => {
    const matrix = [
      ["S.N", "Adı Soyadı", "Telefon", header(-1), header(0), header(1), "Toplam", "Ödenen"],
      ["1", "Ali Veli", "0532 111 22 33", "10.000", "10.000", "10.000", "30.000", "12.000"],
      ["2", "Ayşe Kaya", "0532 444 55 66", "5.000 ödendi", "5.000", "", "10.000", ""],
    ];
    const preview = await post("/api/workspace/plans/import/preview", { matrix });
    assert.equal(preview.status, 200, preview.error);
    assert.equal(preview.data.schedule?.shape, "months");
    assert.equal(preview.data.schedule.monthMode, "plan");
    assert.ok(!Object.values(preview.data.roles).some(role => ["firstDue", "count", "installment"].includes(role)), "ay kolonları varken ilk vade/taksit sayısı rolü yok");
    assert.equal(preview.data.roles[7], "paid");
    const result = await post("/api/workspace/plans/import", { matrix, headerAt: preview.data.headerAt, roles: preview.data.roles, dueDay: 5, fileName: "okul.xlsx" });
    assert.equal(result.status, 200, result.error);
    assert.equal(result.data.created, 2);
    assert.equal(result.data.shape, "months");
    assert.equal(result.data.opening, 17000, "12.000 + 5.000 açılış");
    assert.ok(result.data.importId);
    const list = (await get("/api/workspace/plans?status=all")).data.plans;
    const ali = list.find(plan => plan.name === "Ali Veli");
    const detail = (await get(`/api/workspace/plans/${ali.id}`)).data;
    assert.deepEqual(detail.items.map(item => [item.dueDate, item.amount, item.paid]), [[iso(-1, 5), 10000, 10000], [iso(0, 5), 10000, 2000], [iso(1, 5), 10000, 0]]);
    assert.equal(detail.totals.remaining, 18000);
    assert.equal(detail.entries.filter(entry => entry.opening).length, 2, "her ödenmiş taksit için bir açılış kaydı");
    assert.equal((await get("/api/workspace/cash")).data.totals.balance, 0, "açılış Kasa'ya girmedi");
    const ayse = list.find(plan => plan.name === "Ayşe Kaya");
    assert.equal(ayse.itemCount, 2, "boş ay taksit değildir");
    assert.equal(ayse.totals.remaining, 5000);
  });

  it("sıralı taksit kolonlu Excel ('1. Taksit Tarihi/Tutarı'): 'ilk vade' sanılmaz; gerçek vadeler; Kalan kolonundan ödenen", async () => {
    const matrix = [
      ["Borçlu", "1. Taksit Tarihi", "1. Taksit Tutarı", "2. Taksit Tarihi", "2. Taksit Tutarı", "3. Taksit Tarihi", "3. Taksit Tutarı", "Kalan"],
      ["Mehmet Öz", dmy(iso(-2, 15)), "5.000", dmy(iso(-1, 15)), "5.000", dmy(iso(0, 15)), "5.000", "10.000"],
      ["Hatalı Satır", "", "", "", "", "", "", "1.000"],
    ];
    const preview = (await post("/api/workspace/plans/import/preview", { matrix })).data;
    assert.equal(preview.schedule?.shape, "series");
    const result = (await post("/api/workspace/plans/import", { matrix, headerAt: preview.headerAt, roles: preview.roles, fileName: "senet.xlsx" })).data;
    assert.equal(result.created, 1);
    assert.equal(result.skipped.length, 1);
    const mehmet = (await get("/api/workspace/plans?status=all&q=Mehmet")).data.plans[0];
    const detail = (await get(`/api/workspace/plans/${mehmet.id}`)).data;
    assert.deepEqual(detail.items.map(item => [item.dueDate, item.amount, item.paid]), [[iso(-2, 15), 5000, 5000], [iso(-1, 15), 5000, 0], [iso(0, 15), 5000, 0]]);
    assert.equal(detail.totals.remaining, 10000);
  });

  it("toplam + taksit sayısı biçimi: Ödenen kolonu açılış olarak en eski taksitten düşülür; ödenen toplamı aşarsa satır atlanır", async () => {
    const matrix = [
      ["Ad Soyad", "Toplam Tutar", "Taksit Sayısı", "İlk Vade", "Ödenen"],
      ["Hakan Arıkan", "12.000", "4", dmy(iso(-1, 1)), "3.500"],
      ["Fazla Ödeyen", "1.000", "2", dmy(iso(-1, 1)), "5.000"],
    ];
    const preview = (await post("/api/workspace/plans/import/preview", { matrix })).data;
    assert.equal(preview.schedule, null);
    assert.equal(preview.roles[4], "paid");
    const result = (await post("/api/workspace/plans/import", { matrix, headerAt: preview.headerAt, roles: preview.roles, fileName: "kartlar.xlsx" })).data;
    assert.equal(result.created, 1);
    assert.match(result.skipped[0].reason, /fazla/);
    const hakan = (await get("/api/workspace/plans?status=all&q=Hakan")).data.plans[0];
    const detail = (await get(`/api/workspace/plans/${hakan.id}`)).data;
    assert.deepEqual(detail.items.map(item => item.paid), [3000, 500, 0, 0]);
    assert.equal(detail.totals.remaining, 8500);
  });

  it("açık tablodaki aynı kişiye bağlanır; kartı olan kayıt için ikinci kart açılmaz; kapatılınca bağlanmaz", async () => {
    const table = [["Ad Soyad", "Telefon", "Durum"], ["Zeynep Ak", "0541 000 00 01", "Aktif"], ["Deniz Ay", "", "Aktif"], ["Deniz Ay", "", "Aktif"], ["Ali Veli", "0532 111 22 33", "Aktif"]];
    const staged = await post("/api/workspace/dataset/stage", { kind: "excel", fileName: "liste.xlsx", sheets: [{ name: "Liste", matrix: table }] });
    assert.equal((await post("/api/workspace/dataset/commit", { stageId: staged.data.stageId, mode: "replace" })).status, 200);
    const rows = (await admin.get(`/api/trpc/sheets.getRows?input=${encodeURIComponent(JSON.stringify({ json: {} }))}`)).data.result.data.json.rows;
    const zeynepKey = rows.find(row => row["Ad Soyad"] === "Zeynep Ak").__hofKey;
    const matrix = [
      ["Ad Soyad", "Telefon", "Toplam Tutar", "Taksit Sayısı", "İlk Vade"],
      ["Zeynep Ak", "0541 000 00 01", "4.000", "4", dmy(iso(0, 1))],
      ["Deniz Ay", "", "2.000", "2", dmy(iso(0, 1))],
      ["Ali Veli", "0532 111 22 33", "9.000", "3", dmy(iso(0, 1))],
    ];
    const preview = (await post("/api/workspace/plans/import/preview", { matrix })).data;
    assert.equal(preview.hasTable, true);
    const result = (await post("/api/workspace/plans/import", { matrix, headerAt: preview.headerAt, roles: preview.roles, linkRecords: true, fileName: "taksit.xlsx" })).data;
    assert.equal(result.created, 2, JSON.stringify(result));
    assert.equal(result.records, 1, "Zeynep bağlandı; iki Deniz belirsiz; Ali'nin grubu farklı olsa da adı aynı olduğundan kart zaten var");
    assert.equal(result.skipped.length, 1);
    assert.match(result.skipped[0].reason, /Aynı adla açık kart var/);
    const zeynep = (await get(`/api/workspace/cases/${encodeURIComponent(zeynepKey)}/plans`)).data.plans;
    assert.equal(zeynep.length, 1);
    assert.equal(zeynep[0].name, "Zeynep Ak");
    const account = (await get(`/api/workspace/cases/${encodeURIComponent(zeynepKey)}/account`)).data.account;
    assert.ok(account, "cari de kayda bağlı");
    // Bağ kapalıyken bağlanmaz.
    const second = (await post("/api/workspace/plans/import", { matrix: [["Ad Soyad", "Toplam Tutar", "Taksit Sayısı", "İlk Vade"], ["Deniz Ay", "2.000", "2", dmy(iso(0, 1))]], headerAt: 0, roles: { 0: "name", 1: "total", 2: "count", 3: "firstDue" }, groupName: "B Grubu", linkRecords: false })).data;
    assert.equal(second.created, 1);
    assert.equal(second.records, 0);
    // Kartı olan kayda ikinci yükleme kart açmaz.
    const again = (await post("/api/workspace/plans/import", { matrix, headerAt: preview.headerAt, roles: preview.roles, groupName: "C Grubu", linkRecords: true })).data;
    assert.ok(again.skipped.some(item => /kartı zaten var/.test(item.reason)), JSON.stringify(again.skipped));
  });

  it("Excel yüklemesi Son aktarımlar'dan geri alınır: kartlar, açılışlar ve aktarımın açtığı cariler kalkar", async () => {
    const imports = (await get("/api/workspace/plans/imports")).data.imports;
    const excel = imports.find(item => item.kind === "excel" && item.title.includes("okul.xlsx"));
    assert.ok(excel);
    const before = server.app.store.get("SELECT COUNT(*) AS n FROM plans WHERE deleted_at IS NULL").n;
    const undone = await post(`/api/workspace/plans/imports/${excel.id}/undo`, {});
    assert.equal(undone.status, 200, undone.error);
    assert.equal(undone.data.plans, 2);
    assert.equal(server.app.store.get("SELECT COUNT(*) AS n FROM plans WHERE deleted_at IS NULL").n, before - 2);
    assert.equal(server.app.store.get("SELECT COUNT(*) AS n FROM plan_entries WHERE opening = 1 AND plan_id NOT IN (SELECT id FROM plans)").n, 0, "sahipsiz açılış kaydı kalmadı");
  });
});
