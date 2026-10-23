// 2.4.4 31e (ana oturumun ek işi, 23.10.2026): içe alınan SAYI hücresi (JS number — API ile ya da ham okuyan istemciden gelen 12.125) metne String() ile
// çevrilip "12.125" oluyor, Türkçe binlik yazım sanılıp 12125 TL okunuyordu (2.4.3'te de; yeniden üretildi). Hesapla oluşan tutar (48,5 ÷ 4 = 12,125; faiz, KDV
// ayrıştırma) 1000 kat büyük içe alınabilirdi. Kural: SAYI türündeki hücre sayıdır — içe almada Türkçe ondalıkla, binlik ayraçsız metne çevrilir (tarayıcının Excel
// okuyucusu "Genel" biçimde aynısını üretir: "12,125"); tam sayı (telefon, kimlik, tarih seri no) değişmez; DİZGE hücre kullanıcının yazımıdır, Türkçe kural aynen
// ("12.125" dizgesi 12125, "1.500" 1500). Yollar (ders 9): Tablo (dataset stage), Excel'den cari, taksit, çek/senet, stok yüklemesi, serbest sayfa, Tablodan Aktar.
// Bu dosya içe alma YOLLARINI API ile dener (eski kodda da yüklenir — kırmızı kanıt); birim denetimler test/ice-alma-sayi-hucre.test.mjs.
// "Nasıl bozulur?": S1 sayı hücresi binlik sanılır · S2 dizge kuralı değişir ("1.500" 1,5 olur) · S3 tam sayı (telefon / kimlik) ondalığa döner · S4 0,005 gibi küçük
// sayı 5 olur · S5 bir yol (cari / taksit / çek / stok / serbest sayfa) eski davranışta kalır · S6 eksi ve çok ondalıklı sayı.
import "./fixtures/saat-dilimi-istanbul.mjs";
import assert from "node:assert/strict";
import { after, before, describe, test } from "node:test";
import { loginAdmin, startTestServer } from "./helpers.mjs";

const NOW = "2026-10-23T10:00:00+03:00";
const pad = value => String(value).padStart(2, "0");
const d = days => {
  const date = new Date(2026, 9, 23 + days, 12);
  return `${pad(date.getDate())}.${pad(date.getMonth() + 1)}.${date.getFullYear()}`;
};

describe("31e sayı hücresi: içe alma yolları (API)", () => {
  let server;
  let admin;
  const must = async (label, promise) => {
    const res = await promise;
    assert.equal(res.status, 200, `${label}: ${res.status} ${JSON.stringify(res.data).slice(0, 300)}`);
    return res.data.data;
  };
  before(async () => {
    server = await startTestServer({ now: NOW });
    admin = await loginAdmin(server);
    await must("kurulum geç", admin.post("/api/workspace/bank/setup/dismiss", {}));
  });
  after(async () => {
    await server?.close();
  });

  test("Tablo (dataset stage) → Tablodaki Kişiler satırı: 12.125 → 12,125; 0.005 → 0,005; 1500 → 1500; '1.500' → 1500; '12.125' dizgesi → 12125 (S1/S2/S4)", async () => {
    const sheets = [{ name: "Borçlar", matrix: [["Dosya No", "Ad Soyad", "Kalan Borç", "Son Ödeme"], ["S-1", "Sayı Hücre", 12.125, d(-3)], ["S-2", "Dizge Hücre", "12.125", d(-3)], ["S-3", "Binlik Dizge", "1.500", d(-3)], ["S-4", "Tam Sayı", 1500, d(-3)], ["S-5", "Küçük", 0.005, d(-3)]] }];
    const staged = await must("tablo", admin.post("/api/workspace/dataset/stage", { kind: "excel", fileName: "s.xlsx", sheets }));
    await must("tablo kaydet", admin.post("/api/workspace/dataset/commit", { stageId: staged.stageId, mode: "replace" }));
    const report = (await must("Tablodaki Kişiler", admin.get("/api/workspace/reports/cari-ekstre?from=2000-01-01&to=2099-12-31"))).report;
    const rows = Object.fromEntries(report.table.rows.filter(row => row.borc !== null && row.borc !== undefined).map(row => [row.cari, row.borc]));
    assert.deepEqual(rows, { "Binlik Dizge": 1500, "Dizge Hücre": 12125, "Küçük": 0.005, "Sayı Hücre": 12.125, "Tam Sayı": 1500 }, JSON.stringify(rows));
  });

  test("Tablodan Aktar: sayı hücreli Toplam Tutar 3000.125 → kalan 3.000,13 (3.000.125 değil) (S5)", async () => {
    const sheets = [{ name: "Taksitler", matrix: [["Dosya No", "Ad Soyad", "Toplam Tutar", "Ödenen", "Taksit Sayısı", "İlk Vade"], ["T-1", "Elif Aydın", 3000.125, 0, 3, d(5)]] }];
    const staged = await must("tablo", admin.post("/api/workspace/dataset/stage", { kind: "excel", fileName: "t.xlsx", sheets }));
    await must("tablo kaydet", admin.post("/api/workspace/dataset/commit", { stageId: staged.stageId, mode: "replace" }));
    const preview = await must("ön izleme", admin.get("/api/workspace/plans/from-table"));
    const record = preview.records.find(item => item.name === "Elif Aydın");
    assert.ok(record && record.remaining > 3000 && record.remaining < 3001, `kalan: ${JSON.stringify(record && { total: record.total, remaining: record.remaining, excel: record.excel })}`);
  });

  test("Excel'den cari: Bakiye 12.125 (sayı) → 12,13; '12.125' (dizge) → 12.125 TL (Türkçe kural) (S1/S2/S5)", async () => {
    const matrix = [["Ad Soyad", "Telefon", "Bakiye"], ["Cari Sayı", "0532 000 00 01", 12.125], ["Cari Dizge", "0532 000 00 02", "12.125"]];
    const preview = await must("ön izleme", admin.post("/api/workspace/accounts/import/preview", { matrix }));
    await must("yükle", admin.post("/api/workspace/accounts/import", { matrix, headerAt: preview.headerAt, roles: preview.roles }));
    const accounts = (await must("cariler", admin.get("/api/workspace/accounts"))).accounts;
    const balanceOf = name => accounts.find(item => item.name === name)?.balance;
    assert.deepEqual([balanceOf("Cari Sayı"), balanceOf("Cari Dizge")], [12.13, 12125]);
  });

  test("Excel'den taksit kartı: Toplam Tutar 1200.125 (sayı) → kart 1.200,13 (S5)", async () => {
    const matrix = [["Ad Soyad", "Toplam Tutar", "Taksit Sayısı", "İlk Vade"], ["Taksit Sayı", 1200.125, 3, d(10)]];
    const preview = await must("ön izleme", admin.post("/api/workspace/plans/import/preview", { matrix }));
    await must("yükle", admin.post("/api/workspace/plans/import", { matrix, headerAt: preview.headerAt, roles: preview.roles, fileName: "taksit.xlsx" }));
    const plans = await must("kartlar", admin.get("/api/workspace/plans"));
    const plan = (plans.plans || plans.items || []).find(item => /Taksit Sayı/.test(item.name || item.accountName || ""));
    assert.ok(plan, JSON.stringify((plans.plans || plans.items || []).map(item => item.name)));
    const total = plan.total ?? plan.totals?.total;
    assert.equal(total, 1200.13, JSON.stringify({ total, totals: plan.totals }));
  });

  test("Excel'den çek / senet: Tutar 2500.125 (sayı) → 2.500,13 (S5)", async () => {
    const matrix = [["Vade", "Tutar", "Keşideci", "Seri No"], [d(30), 2500.125, "Toplu Sayı", "TS-1"]];
    const result = await must("çek yükle", admin.post("/api/workspace/cheques/import", { matrix, headerAt: 0, roles: { 0: "due", 1: "amount", 2: "drawer", 3: "serial" } }));
    assert.equal(result.created, 1, JSON.stringify(result));
    const list = await must("çekler", admin.get("/api/workspace/cheques"));
    const cheque = (list.items || list.cheques || []).find(item => item.serialNo === "TS-1" || item.serial === "TS-1");
    assert.equal(cheque?.amount, 2500.13, JSON.stringify(cheque));
  });

  test("Excel'den stok: Birim Fiyat 12.125 (sayı) × 10 → değer 121,25 civarı (121.250 değil) (S5)", async () => {
    const matrix = [["Ürün Kodu", "Ürün Adı", "Birim", "Miktar", "Birim Fiyat"], ["SY-1", "Sayı Ürün", "Adet", 10, 12.125]];
    const preview = await must("ön izleme", admin.post("/api/workspace/stock/import/preview", { matrix }));
    await must("yükle", admin.post("/api/workspace/stock/import", { matrix, headerAt: preview.headerAt, roles: preview.roles }));
    const item = (await must("stok", admin.get("/api/workspace/stock"))).items.find(entry => entry.name === "Sayı Ürün");
    assert.ok(item && item.value > 120 && item.value < 122, JSON.stringify(item && { qty: item.qty, value: item.value }));
  });
});
