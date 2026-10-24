// 2.4.4 madde 5 (E8; kullanıcı kararı 21.10.2026: "orta tablodaki Excel'deki kayıttan taksit olmasın, cariye kaydedip oradan yapsın" + "önerilerin uygun"):
// zil ve Tahsilat Takvimi'ndeki "Tahsilat Gir" kaydın CARİSİNE (ya da taksit kartına) yazar, kayıttan Kasa'ya doğrudan yazmaz. Sunucu tarafı:
//   T1  Takvim kalemi (ödeme sözü) kayda bağlı carinin tahsilatıyla kapanır; kısmi tahsilat kalanı bekletir; hareket silinince kalem döner.
//   T2  Bağsız (aynı adlı) carinin tahsilatı kalemi kapatmaz; cari kayda bağlanınca kapanır, bağ kalkınca döner (önbellek bağ değişimini görür).
//   T3  Kartlı kişinin ödeme sözü "Taksite Yaz" (taksit kartı tahsilatı) ile kapanır.
//   T4  Tablodaki Vadeler (vade-takip) aynı kuralla; Tablodaki Kişiler (cari-ekstre) kayda bağlı carinin tahsilatını alacak yazar.
//   T5  Para: carinin tahsilatı payments'a (kayıt tahsilatı) yazılmaz, Kasa'ya bir kez girer (veri tabanından ve programın Kasa ucundan).
//   T6  Eski sürüm verisi (v2.4.3 etiketinin GERÇEK kodu, API'den): kayıt tahsilatı + kayıttan açılmış (kayda bağlı) taksit kartı + kart tahsilatı + kayda
//       bağlı cari tahsilatı → yeni kodla açılınca Kasa, cari bakiyeleri, kart kalanları, İşlem Geçmişi toplamları ve Kayıt Tahsilatları raporu AYNI;
//       eski kayıt tahsilatı ve eski kart düzeltilir/silinir; sunucu ucu (POST cases/:key/payments) durur.
// Beklenen sayılar programdan bağımsız: örnek tablodaki söz tutarları (test/fixtures/tahsilat-ornek.mjs) ve burada girilen tutarların elle toplamı.
// 2.4.5 madde 4 (uyarı kapısı): bu dosya tablo takvim motorunu zil / Tahsilat Takvimi / Vade Takip / Projeksiyon uçlarından sınar → 2.4.4 davranışı (legacyTableDues, yalnız testler).
import assert from "node:assert/strict";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { after, before, describe, test } from "node:test";
import { tahsilatWorkbook } from "./fixtures/tahsilat-ornek.mjs";
import { CURRENT, bootVersion, tagsAvailable } from "./guvenilirlik/surumler.mjs";

const pad = value => String(value).padStart(2, "0");
const day = offset => {
  const date = new Date();
  date.setDate(date.getDate() + offset);
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
};
const matrix = sheet => [sheet.columns, ...sheet.rows.map(row => sheet.columns.map(column => row[column] ?? ""))];
const must = async (label, promise) => {
  const res = await promise;
  assert.equal(res.status, 200, `${label}: ${res.status} ${JSON.stringify(res.data).slice(0, 300)}`);
  return res.data;
};
const stage = async api => {
  const book = tahsilatWorkbook(new Date());
  const staged = await must("tablo", api.post("/api/workspace/dataset/stage", { kind: "excel", fileName: "tahsilat.xlsx", sheets: book.map(sheet => ({ name: sheet.name, matrix: matrix(sheet) })) }));
  await must("tablo kaydet", api.post("/api/workspace/dataset/commit", { stageId: staged.stageId, mode: "replace" }));
};
const dues = async api => (await must("takvim", api.get("/api/workspace/dues"))).items;
const promiseOf = (items, person) => items.find(item => item.person === person && item.promise) || null;
const cashOf = async api => (await must("kasa", api.get("/api/workspace/cash"))).totals.balance;

describe("2.4.4 E8: kaydın tahsilatı cariden; takvim kalemi carinin ve taksitin tahsilatıyla kapanır", () => {
  const root = mkdtempSync(path.join(tmpdir(), "kayit-tahsilat-244-"));
  let server;
  let api;
  let db;
  const one = (sql, ...args) => db.get(sql, ...args);
  let keys = {};

  before(async () => {
    server = await bootVersion(CURRENT, { dataDir: path.join(root, "data"), backupDir: path.join(root, "backups"), legacyTableDues: true });
    api = await server.login();
    db = server.app.store;
    await must("kurulum geç", api.post("/api/workspace/bank/setup/dismiss", {}));
    await stage(api);
    const items = await dues(api);
    for (const person of ["Ali Veli", "Ayşe Kaya", "Zeynep Şahin"]) keys[person] = promiseOf(items, person)?.caseKey;
    assert.ok(keys["Ali Veli"] && keys["Ayşe Kaya"] && keys["Zeynep Şahin"], `örnek tablonun üç açık sözü takvimde: ${JSON.stringify(keys)}`);
  });
  after(async () => {
    await server?.close();
    rmSync(root, { recursive: true, force: true });
  });

  test("T1 + T5 kayda bağlı carinin tahsilatı sözü kapatır (tam / kısmi / silinince döner); Kasa'ya bir kez, kayıt tahsilatına hiç yazılmaz", async () => {
    const cashBefore = await cashOf(api);
    const ali = await must("Ali cari", api.post("/api/workspace/accounts", { name: "Ali Veli", phone: "0532 111 11 11", type: "customer", caseKey: keys["Ali Veli"], caseTitle: "Ali Veli" }));
    const before = promiseOf(await dues(api), "Ali Veli");
    assert.equal(before?.amount, 5000, "söz 5.000 açık (örnek tablo)");
    const paid = await must("Ali tahsilat", api.post(`/api/workspace/accounts/${ali.id}/entries`, { kind: "in", amount: "5.000", date: day(0), method: "cash", note: "Ödeme sözü" }));
    assert.equal(promiseOf(await dues(api), "Ali Veli"), null, "carinin 5.000 tahsilatı sözü kapattı");
    assert.equal(one("SELECT COUNT(*) AS n FROM payments").n, 0, "kayıt tahsilatı (payments) yazılmadı");
    assert.equal(one("SELECT COALESCE(SUM(amount), 0) AS s FROM account_entries WHERE account_id = ? AND kind = 'in'", ali.id).s, 5000, "tahsilat carinin defterinde");
    assert.equal(Math.round((await cashOf(api)) * 100), Math.round((cashBefore + 5000) * 100), "Kasa 5.000 arttı (bir kez)");

    const zeynep = await must("Zeynep cari", api.post("/api/workspace/accounts", { name: "Zeynep Şahin", phone: "0535 444 44 44", type: "customer", caseKey: keys["Zeynep Şahin"], caseTitle: "Zeynep Şahin" }));
    await must("Zeynep kısmi", api.post(`/api/workspace/accounts/${zeynep.id}/entries`, { kind: "in", amount: "2.500", date: day(0), method: "cash" }));
    const partial = promiseOf(await dues(api), "Zeynep Şahin");
    assert.equal(partial?.amount, 5000, `7.500 sözün 2.500'ü ödendi, 5.000 bekler: ${JSON.stringify(partial)}`);
    assert.equal(partial?.partial, true, "kısmen ödendi işareti");

    const entryId = paid.entryId || one("SELECT id FROM account_entries WHERE account_id = ? AND kind = 'in'", ali.id).id;
    await must("Ali tahsilat sil", api.del(`/api/workspace/accounts/${ali.id}/entries/${entryId}`));
    assert.equal(promiseOf(await dues(api), "Ali Veli")?.amount, 5000, "tahsilat silinince söz yeniden 5.000 açık");
    assert.equal(Math.round((await cashOf(api)) * 100), Math.round((cashBefore + 2500) * 100), "Kasa: yalnız Zeynep'in 2.500'ü kaldı");
  });

  test("T2 bağsız aynı adlı carinin tahsilatı sayılmaz; bağlanınca kapanır, bağ kalkınca döner", async () => {
    const twin = await must("Ayşe bağsız cari", api.post("/api/workspace/accounts", { name: "Ayşe Kaya", phone: "0532 999 99 99", type: "customer" }));
    await must("Ayşe tahsilat", api.post(`/api/workspace/accounts/${twin.id}/entries`, { kind: "in", amount: "3.000", date: day(0), method: "cash" }));
    assert.equal(promiseOf(await dues(api), "Ayşe Kaya")?.amount, 3000, "bağsız carinin tahsilatı kayda sayılmaz");
    const detail = await must("cari", api.get(`/api/workspace/accounts/${twin.id}`));
    const body = { name: detail.name, type: detail.type, phone: detail.phone, refNo: detail.refNo, registeredOn: detail.registeredOn, updatedAt: detail.updatedAt };
    await must("kayda bağla", api.put(`/api/workspace/accounts/${twin.id}`, { ...body, caseKey: keys["Ayşe Kaya"], caseTitle: "Ayşe Kaya" }));
    assert.equal(promiseOf(await dues(api), "Ayşe Kaya"), null, "cari kayda bağlanınca tahsilatı sözü kapattı");
    const linked = await must("cari", api.get(`/api/workspace/accounts/${twin.id}`));
    await must("bağı kaldır", api.put(`/api/workspace/accounts/${twin.id}`, { ...body, updatedAt: linked.updatedAt, caseKey: "", caseTitle: "" }));
    assert.equal(promiseOf(await dues(api), "Ayşe Kaya")?.amount, 3000, "bağ kalkınca söz yeniden açık");
  });

  test("T3 kartlı kişinin ödeme sözü taksit kartı tahsilatıyla (Taksite Yaz) kapanır", async () => {
    // Zeynep'in carisi (T1'de açıldı; tek başına koşulursa burada açılır) taksit kartı açar; kart kayda bağlanır, takvimde kartlı kişinin yalnız sözü kalır.
    const zeynep = one("SELECT id FROM accounts WHERE case_key = ? AND deleted_at IS NULL", keys["Zeynep Şahin"]) || (await must("Zeynep cari", api.post("/api/workspace/accounts", { name: "Zeynep Şahin", phone: "0535 444 44 44", type: "customer", caseKey: keys["Zeynep Şahin"], caseTitle: "Zeynep Şahin" })));
    const plan = await must("kart", api.post("/api/workspace/plans", { accountId: zeynep.id, name: "Zeynep Şahin", total: "10.000", registeredOn: day(-10), mode: "auto", count: 2, firstDue: day(5) }));
    assert.equal(one("SELECT case_key AS k FROM plans WHERE id = ?", plan.id).k, keys["Zeynep Şahin"], "kayda bağlı carinin kartı kayda bağlandı");
    const open = promiseOf(await dues(api), "Zeynep Şahin");
    assert.ok(open?.amount > 0, `kartlı kişide söz kalır: ${JSON.stringify(open)}`);
    await must("taksite yaz", api.post(`/api/workspace/plans/${plan.id}/entries`, { kind: "in", amount: String(open.amount), date: day(0), method: "cash" }));
    assert.equal(promiseOf(await dues(api), "Zeynep Şahin"), null, "taksit kartına yazılan kalan tutar sözü kapattı");
    assert.equal(one("SELECT COUNT(*) AS n FROM payments").n, 0, "kayıt tahsilatı yazılmadı");
  });

  test("T4 Tablodaki Vadeler aynı kuralla; Tablodaki Kişiler kayda bağlı carinin tahsilatını alacak yazar", async () => {
    const vade = await must("vade-takip", api.get(`/api/workspace/reports/vade-takip?from=${day(-30)}&to=${day(30)}`));
    const rows = vade.report.rows || [];
    assert.ok(rows.some(row => /Ali Veli/.test(row.cari) && row.label === "Ödeme sözü"), "Ali'nin sözü (tahsilatı silindi) raporda açık");
    assert.ok(!rows.some(row => /Zeynep Şahin/.test(row.cari) && row.label === "Ödeme sözü"), "Zeynep'in sözü (cari 2.500 + taksit 5.000) raporda kapalı");
    const ekstre = await must("cari-ekstre", api.get(`/api/workspace/reports/cari-ekstre?from=${day(-30)}&to=${day(1)}`));
    // 31a F4/F5 (bilerek güncellendi): kişi adıyla görünür (önceden çok sekmeli tabloda dosya no; "Borçlu" özel alan sanılıyordu) ve takvimle aynı küme
    // sayılır — carinin 2.500'ü VE kayda bağlı taksit kartının tahsilatı (T3), her biri BİR KEZ (5c; iki sekmede aynı dosya no).
    const card = one("SELECT COALESCE(SUM(e.amount), 0) AS s FROM plan_entries e JOIN plans p ON p.id = e.plan_id WHERE p.case_key = ? AND p.deleted_at IS NULL AND e.kind = 'in' AND COALESCE(e.opening, 0) = 0", keys["Zeynep Şahin"]).s;
    assert.ok(card > 0, "T3 taksit tahsilatı var");
    const zeynepLines = ekstre.report.table.rows.filter(row => row.cari === "Zeynep Şahin" && row.alacak > 0);
    assert.deepEqual(zeynepLines.map(row => row.alacak).sort((a, b) => a - b), [2500, card].sort((a, b) => a - b), `Tablodaki Kişiler: carinin 2.500'ü ve kartın ${card} tahsilatı bir kez: ${JSON.stringify(zeynepLines)}`);
    assert.ok(zeynepLines.every(row => /^Tahsilat/.test(row.description)));
  });
});

const OLD = "v2.4.3";
describe(`2.4.4 E8: eski sürüm verisi (${OLD} gerçek kodu) yeni kodla aynı sayılar; eski kayıt tahsilatı ve kayda bağlı kart düzeltilir / silinir`, { skip: tagsAvailable([OLD]) ? false : `${OLD} etiketi yok (git fetch --tags)` }, () => {
  const root = mkdtempSync(path.join(tmpdir(), "kayit-tahsilat-244-eski-"));
  const dirs = { dataDir: path.join(root, "data"), backupDir: path.join(root, "backups") };
  const snapshot = async (api, keys, ids) => {
    const accounts = (await must("cariler", api.get("/api/workspace/accounts"))).accounts.map(item => [item.name, item.balance]).sort((a, b) => a[0].localeCompare(b[0], "tr"));
    const plan = await must("kart", api.get(`/api/workspace/plans/${ids.plan}`));
    const activity = {};
    for (const [person, key] of Object.entries(keys)) activity[person] = (await must("geçmiş", api.get(`/api/workspace/cases/${encodeURIComponent(key)}/activity`))).paidTotal;
    const report = await must("rapor", api.get(`/api/workspace/report-center/kayit-tahsilatlari?from=${day(-60)}&to=${day(0)}`));
    return { cash: await cashOf(api), accounts, plan: { total: plan.totals.total, paid: plan.totals.paid, remaining: plan.totals.remaining, caseKey: plan.caseKey }, activity, reportRows: report.rows.length, reportTotal: JSON.stringify(report.totals ?? report.summary ?? report.total ?? null) };
  };
  let keys = {};
  const ids = {};
  let oldView = null;
  let oldDues = null;

  before(async () => {
    const old = await bootVersion(OLD, dirs);
    try {
      const api = await old.login();
      await must("kurulum geç", api.post("/api/workspace/bank/setup/dismiss", {}));
      await stage(api);
      const items = await dues(api);
      keys = { "Ali Veli": promiseOf(items, "Ali Veli").caseKey, "Zeynep Şahin": promiseOf(items, "Zeynep Şahin").caseKey, "Elif Aydın": items.find(item => item.person === "Elif Aydın").caseKey };
      // 1. eski kayıt tahsilatı (2.4.3 kayıt kartı "Tahsilat" / zil "Tahsil Et": kaydın kendi defterine, Kasa'ya).
      ids.payment = (await must("kayıt tahsilatı", api.post(`/api/workspace/cases/${encodeURIComponent(keys["Ali Veli"])}/payments`, { amount: "1.000", date: day(-1), method: "cash", note: "Söz kısmi", caseTitle: "Ali Veli" }))).id;
      // 2. kayıttan açılmış taksit kartı (2.4.3 "Taksit planı oluşturun" kısa yolunun gövdesi: kayıt bağı, carisiz → program cari açar).
      ids.plan = (await must("kayıttan kart", api.post("/api/workspace/plans", { caseKey: keys["Elif Aydın"], caseTitle: "M-201 · Elif Aydın", name: "Elif Aydın", phone: "0532 600 10 10", total: "9.000", registeredOn: day(-40), mode: "auto", count: 3, firstDue: day(-35) }))).id;
      ids.planEntry = (await must("kart tahsilatı", api.post(`/api/workspace/plans/${ids.plan}/entries`, { kind: "in", amount: "3.000", date: day(-2), method: "cash" }))).entryId;
      // 3. kayda bağlı cari ve tahsilatı (2.4.3 A2: kayıt kartından cariye).
      ids.zeynep = (await must("Zeynep cari", api.post("/api/workspace/accounts", { name: "Zeynep Şahin", phone: "0535 444 44 44", type: "customer", caseKey: keys["Zeynep Şahin"], caseTitle: "Zeynep Şahin" }))).id;
      await must("Zeynep tahsilat", api.post(`/api/workspace/accounts/${ids.zeynep}/entries`, { kind: "in", amount: "2.000", date: day(0), method: "cash" }));
      oldView = await snapshot(api, keys, ids);
      oldDues = await dues(api);
    } finally {
      await old.close();
    }
  });
  after(() => rmSync(root, { recursive: true, force: true }));

  test("T6 sayılar aynı; eski kayıt tahsilatı ve kart düzeltilir / silinir; sunucu ucu durur", async () => {
    const server = await bootVersion(CURRENT, { ...dirs, legacyTableDues: true });
    try {
      const api = await server.login();
      const db = server.app.store;
      // Elle kâhin: Kasa = 1.000 (kayıt) + 3.000 (kart) + 2.000 (cari) = 6.000; kartın kalanı 9.000 − 3.000 = 6.000.
      assert.equal(oldView.cash, 6000, `${OLD}: Kasa 6.000`);
      assert.deepEqual([oldView.plan.total, oldView.plan.paid, oldView.plan.remaining], [9000, 3000, 6000], `${OLD}: kart 9.000 / 3.000 / 6.000`);
      assert.equal(oldView.plan.caseKey, keys["Elif Aydın"], `${OLD}: kart kayda bağlı`);
      const now = await snapshot(api, keys, ids);
      assert.deepEqual(now, oldView, "yeni kodda Kasa, cari bakiyeleri, kart, İşlem Geçmişi toplamları ve Kayıt Tahsilatları raporu aynı");
      // Takvim: eski kayıt tahsilatı (1.000) sözü yine düşürür (5.000 → 4.000); kayda bağlı carinin 2.000'i artık sayılır (7.500 → 5.500; 2.4.3'te sayılmıyordu).
      assert.equal(promiseOf(oldDues, "Ali Veli").amount, 4000, `${OLD}: Ali sözü 4.000`);
      assert.equal(promiseOf(oldDues, "Zeynep Şahin").amount, 7500, `${OLD}: Zeynep sözü 7.500 (cari tahsilatı sayılmıyordu)`);
      const fresh = await dues(api);
      assert.equal(promiseOf(fresh, "Ali Veli").amount, 4000, "yeni kod: Ali sözü 4.000 (eski kayıt tahsilatı sayılır)");
      assert.equal(promiseOf(fresh, "Zeynep Şahin").amount, 5500, "yeni kod: Zeynep sözü 5.500 (kayda bağlı carinin 2.000'i sayılır)");
      // Eski kayıt tahsilatı düzeltilir ve silinir (yetki "Kayıt Tahsilatını Düzeltme"); Kasa izler.
      await must("eski tahsilatı düzelt", api.put(`/api/workspace/payments/${ids.payment}`, { amount: "1.500", date: day(-1), method: "cash", note: "Söz kısmi" }));
      assert.equal(await cashOf(api), 6500, "düzeltme Kasa'ya yansıdı (+500)");
      assert.equal(promiseOf(await dues(api), "Ali Veli").amount, 3500, "söz 3.500");
      await must("eski tahsilatı sil", api.del(`/api/workspace/payments/${ids.payment}`));
      assert.equal(await cashOf(api), 5000, "silme Kasa'dan düştü");
      assert.equal(db.get("SELECT COUNT(*) AS n FROM payments").n, 0);
      // Kayıttan açılmış eski kart: düzenlenir, tahsilatı düzeltilir ve silinir; kayıt bağı kalır.
      const plan = await must("kart", api.get(`/api/workspace/plans/${ids.plan}`));
      await must("kartı düzenle", api.put(`/api/workspace/plans/${ids.plan}`, { name: "Elif Aydın (Servis)", note: "eski kart" }));
      assert.equal(db.get("SELECT case_key AS k FROM plans WHERE id = ?", ids.plan).k, keys["Elif Aydın"], "kayıt bağı düzenlemede kalır");
      const entry = plan.entries.find(item => item.kind === "in");
      await must("kart tahsilatını düzelt", api.put(`/api/workspace/plans/${ids.plan}/entries/${entry.id}`, { kind: "in", amount: "2.000", date: day(-2), method: "cash" }));
      assert.equal((await must("kart", api.get(`/api/workspace/plans/${ids.plan}`))).totals.remaining, 7000, "kart kalanı 7.000");
      await must("kart tahsilatını sil", api.del(`/api/workspace/plans/${ids.plan}/entries/${entry.id}`));
      assert.equal((await must("kart", api.get(`/api/workspace/plans/${ids.plan}`))).totals.remaining, 9000, "kart kalanı 9.000");
      assert.equal(await cashOf(api), 2000, "Kasa: yalnız Zeynep carisinin 2.000'i");
      // Sunucu ucu (API) durur: kayıt tahsilatı yine yazılabilir, Kasa'ya girer (ekranda yolu yok).
      await must("sunucu ucu", api.post(`/api/workspace/cases/${encodeURIComponent(keys["Ali Veli"])}/payments`, { amount: "100", date: day(0), method: "cash" }));
      assert.equal(await cashOf(api), 2100);
    } finally {
      await server.close();
    }
  });
});

// 2.4.4 madde 5b: "önce cari açın" formundaki Açılış Bakiyesi takvim kaleminin "Kalan Borç"undan dolar. Tabloda hem "Alacak Tutarı" hem "Kalan" varsa
// Kalan Borç "Kalan" kolonudur (önceden ilk eşleşen "Alacak Tutarı" alınıyordu: toplam alacak kalan borç sayılıyordu); kalem kolon adını da taşır.
describe("2.4.4 5b: takvim kaleminin Kalan Borç'u 'Kalan' kolonundan, kolon adıyla", () => {
  test("Alacak Tutarı + Kalan + Son Ödeme: Kalan Borç = Kalan; tek vadeli kalemin beklenen tutarı da kalan", async () => {
    const { computeDues } = await import("../server/lib/insight/dues.mjs");
    const now = new Date();
    const due = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 3);
    const text = `${String(due.getDate()).padStart(2, "0")}.${String(due.getMonth() + 1).padStart(2, "0")}.${due.getFullYear()}`;
    const rows = ["Hasan Er", "Ece Ak", "Can Tan"].map((name, index) => ({ __hofKey: `2026/9${index}`, __sheet: "Alacaklar", "Dosya No": `2026/9${index}`, Borçlu: name, "Alacak Tutarı": `${20 + index}.000,00`, Kalan: `${12 + index}.000,00`, "Son Ödeme": text }));
    const { items } = computeDues({ rows, tabs: ["Alacaklar"], now });
    const hasan = items.find(item => item.person === "Hasan Er");
    assert.ok(hasan, JSON.stringify(items.map(item => item.person)));
    assert.equal(hasan.debt, 12000, `Kalan Borç: ${hasan.debt}`);
    assert.equal(hasan.debtColumn, "Kalan");
    assert.equal(hasan.amount, 12000, "tek vadeli kalemin beklenen tutarı kalan borç");
  });
});
