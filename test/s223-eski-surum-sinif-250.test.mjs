// 2.5.0 S223 = A + S228 = A — kabul D (ders 17, 53 (b)): v2.4.9'un GERÇEK koduyla (surumler.mjs bootVersion) API'den girilmiş veri; hata v2.4.9'da da var
// (büyük harfle yazılan kişi çift cari / çift kart açıyor, çek bağlanmıyor), güncel kod aynı veride S228 = A sırasıyla eşleştiriyor.
// SINIF LİSTESİ (yol × varyant × aday; beklenenler ELLE, kararlardan):
//   v2.4.9 (saat 08.10.2026): cariler Hasan Işık 0532 201 00 01, Şükrü Özçelik 0532 201 00 02, Zeynep Kılıç (telefonsuz), Ahu Öztürk 0532 201 00 03,
//   Ömer Çiftçi 0532 201 00 04. v2.4.9'da: cari Excel 'ŞÜKRÜ ÖZÇELİK' 0532 201 00 02 → YENİ cari (çift); taksit Excel 'ZEYNEP KILIÇ' (telefonsuz) 800 →
//   YENİ cari + kart (çift cari, borç 800 yeni cariye); çek 'AHU ÖZTÜRK' 1.000 → cariye BAĞLANMAZ. (Eski hatanın sayıları: ŞÜKRÜ 2 cari, ZEYNEP 2 cari, çek carisiz.)
//   Güncel kod (saat 12.10.2026), aynı veri:
//   C1 cari Excel × I/ı büyük harf × tek aday: 'HASAN IŞIK' 0532 201 00 01 → 'Bu cari zaten var' (yeni cari yok).
//   C2 cari Excel × Ş Ü Ö Ç × çift aday (v2.4.9'un açtığı çift): 'ŞÜKRÜ ÖZÇELİK' → zaten var (birebir yazım, bugünkü); 'Şükrü Özçelik' → zaten var;
//      'Şükrü ÖZÇELİK' (ikisine de NOCASE'te uymaz; Türkçe katlamada iki aday) → bugünkü gibi YENİ cari.
//   C3 cari Excel × yok aday: 'Nil Ünal' 0532 201 00 09 → yeni cari.
//   C4 taksit × I/ı × tek: 'HASAN IŞIK' 0532 201 00 01 600 → Hasan Işık'a bağlanır (borç 600 ona).
//   C5 taksit × çift (telefonsuz): 'Zeynep Kılıç' 500 → Zeynep Kılıç'a (bugünkü; borç 500 ona); 'ZEYNEP KILIÇ' 800 → 'Aynı adla açık kart var' (v2.4.9 kartı);
//      'ZEYNEP  KILIÇ' (çift boşluk) 900 → iki adayın da kartı var → 'Aynı adlı birden çok kişi var…' (çift borç yok).
//   C6 taksit × boşluk + Ç Ö × tek: ' ÖMER  ÇİFTÇİ ' 0532 201 00 04 700 → Ömer Çiftçi'ye.
//   C7 taksit × yok: 'Nur Işıl' 0532 201 00 08 300 → yeni cari + kart.
//   C8 çek × Ö Ü × tek: 'AHU ÖZTÜRK' 400 → Ahu Öztürk'e bağlı.
//   C9 çek × çift: 'ZEYNEP KILIÇ' → ZEYNEP KILIÇ; 'Zeynep Kılıç' → Zeynep Kılıç; 'ZEYNEP KILIç' → carisiz (iki aday).
//   C10 çek × yok: 'Bilinmeyen Kişi' → carisiz.
//   Defter 120: güncel yüklemelerin kartları 500 + 600 + 700 + 300 = 2.100 artar; Mutabakat Testi temiz (kural farkı dışında).
import assert from "node:assert/strict";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { after, before, describe, it } from "node:test";
import { CURRENT, bootVersion, tagsAvailable } from "./guvenilirlik/surumler.mjs";

process.env.HUKUK_LICENSE_URL ||= "http://127.0.0.1:9";
const W = "/api/workspace";
const skip = tagsAvailable(["v2.4.9"]) ? false : "v2.4.9 etiketi yok";
const must = async (label, promise) => {
  const res = await promise;
  assert.equal(res.status, 200, `${label}: ${res.status} ${JSON.stringify(res.data).slice(0, 400)}`);
  return res.data;
};
const ACC = (rows, fileName, mode = "skip") => ({ matrix: [["Ad Soyad", "Telefon"], ...rows], headerAt: 0, roles: { 0: "name", 1: "phone" }, mode, fileName });
const PLAN = (rows, fileName) => ({
  matrix: [["Ad Soyad", "Telefon", "Toplam Tutar", "Taksit Sayısı", "İlk Vade"], ...rows.map(([name, phone, total]) => [name, phone, total, "2", "01.11.2026"])],
  headerAt: 0,
  roles: { 0: "name", 1: "phone", 2: "total", 3: "count", 4: "firstDue" },
  linkRecords: false,
  fileName,
});
const CHQ = (rows, fileName) => ({ matrix: [["Çek No", "Banka", "Keşideci", "Tutar", "Vade"], ...rows.map(([serial, drawer, amount]) => [serial, "Ziraat", drawer, amount, "01.12.2026"])], headerAt: 0, roles: { 0: "serial", 1: "bank", 2: "drawer", 3: "amount", 4: "due" }, direction: "in", fileName });
const reasons = report => report.skipped.map(item => item.reason);

describe("S223 / S228 — kabul D: v2.4.9'un verisinde Türkçe harf katlamalı eşleşme (sınıf listesi)", { skip }, () => {
  let root;
  let server;
  let api;
  let app;
  const ids = {};
  let old249;
  const named = name => app.store.all("SELECT id FROM accounts WHERE deleted_at IS NULL AND name = ? ORDER BY rowid", name).map(row => row.id);
  const cardsOf = id => app.store.all("SELECT total FROM plans WHERE deleted_at IS NULL AND account_id = ? ORDER BY rowid", id).map(row => row.total);
  const live = () => app.store.get("SELECT COUNT(*) AS n FROM accounts WHERE deleted_at IS NULL").n;
  const gl120 = async () => Number((await must("mizan", api.get(`${W}/ledger`))).trial.accounts.find(item => item.code === "120")?.balance || 0);
  before(async () => {
    root = mkdtempSync(path.join(tmpdir(), "s223-eski-"));
    const dirs = { dataDir: path.join(root, "data"), backupDir: path.join(root, "backups") };
    const old = await bootVersion("v2.4.9", { ...dirs, now: { time: "2026-10-08T12:00:00+03:00", fixed: true } });
    try {
      const o = await old.login();
      const acc = async (name, phone = "") => (await must(`cari ${name}`, o.post(`${W}/accounts`, { name, phone, type: "customer", registeredOn: "2026-08-01" }))).id;
      ids.hasan = await acc("Hasan Işık", "0532 201 00 01");
      ids.sukru = await acc("Şükrü Özçelik", "0532 201 00 02");
      ids.zeynep = await acc("Zeynep Kılıç");
      ids.ahu = await acc("Ahu Öztürk", "0532 201 00 03");
      ids.omer = await acc("Ömer Çiftçi", "0532 201 00 04");
      const accounts = await must("cari Excel (v2.4.9)", o.post(`${W}/accounts/import`, ACC([["ŞÜKRÜ ÖZÇELİK", "0532 201 00 02"]], "v249-cari.xlsx")));
      const plans = await must("taksit Excel (v2.4.9)", o.post(`${W}/plans/import`, PLAN([["ZEYNEP KILIÇ", "", "800"]], "v249-taksit.xlsx")));
      const cheques = await must("çek (v2.4.9)", o.post(`${W}/cheques/import`, CHQ([["V249-1", "AHU ÖZTÜRK", "1.000"]], "v249-cek.xlsx")));
      const count = async () => (await must("cariler (v2.4.9)", o.get(`${W}/accounts?status=all`))).accounts;
      const list = await count();
      old249 = {
        accountsCreated: accounts.created,
        plansCreated: plans.created,
        chequeLinked: cheques.linked,
        sukru: list.filter(item => ["Şükrü Özçelik", "ŞÜKRÜ ÖZÇELİK"].includes(item.name)).length,
        zeynep: list.filter(item => ["Zeynep Kılıç", "ZEYNEP KILIÇ"].includes(item.name)).length,
      };
    } finally {
      await old.close();
    }
    server = await bootVersion(CURRENT, { ...dirs, now: { time: "2026-10-12T12:00:00+03:00", fixed: true }, integrityScan: false });
    app = server.app;
    await app.ledger.snapshots.runPending();
    api = await server.login();
    ids.sukruUpper = named("ŞÜKRÜ ÖZÇELİK")[0];
    ids.zeynepUpper = named("ZEYNEP KILIÇ")[0];
  }, { timeout: 300_000 });
  after(async () => {
    await server?.close();
    if (root) rmSync(root, { recursive: true, force: true });
  });

  it("v2.4.9'da hata VAR (elle beklenen): büyük harfli cari Excel çift cari, taksit Excel çift cari + kart, çek bağlanmaz", () => {
    assert.deepEqual(old249, { accountsCreated: 1, plansCreated: 1, chequeLinked: 0, sukru: 2, zeynep: 2 });
  });

  it("C1–C3 cari Excel: tek aday büyük harf → var; v2.4.9'un çiftinde birebir yazım bugünkü carisi, iki adaylı yazım yeni cari; yok aday yeni cari", async () => {
    assert.ok(ids.sukruUpper && ids.zeynepUpper, "v2.4.9'un açtığı çift cariler güncel veride");
    const before = live();
    const report = await must("cari Excel", api.post(`${W}/accounts/import`, ACC([["HASAN IŞIK", "0532 201 00 01"], ["ŞÜKRÜ ÖZÇELİK", "0532 201 00 02"], ["Şükrü Özçelik", "0532 201 00 02"], ["Şükrü ÖZÇELİK", "0532 201 00 02"], ["Nil Ünal", "0532 201 00 09"]], "s223-cari.xlsx")));
    assert.deepEqual(reasons(report), ["Bu cari zaten var", "Bu cari zaten var", "Bu cari zaten var"]);
    assert.equal(report.created, 2, "C2 iki adaylı yazım + C3 yok aday");
    assert.equal(live(), before + 2);
    assert.equal(named("Şükrü ÖZÇELİK").length, 1);
    assert.equal(named("Nil Ünal").length, 1);
  });

  it("C4–C7 taksit Excel: tek aday büyük harf / boşluk → var olan cari; çift caride bugünkü bağ; iki adaylı yazım atlanır; yok aday yeni cari", async () => {
    const before = live();
    const before120 = await gl120();
    const report = await must("taksit Excel", api.post(`${W}/plans/import`, PLAN([["HASAN IŞIK", "0532 201 00 01", "600"], ["Zeynep Kılıç", "", "500"], ["ZEYNEP KILIÇ", "", "800"], ["ZEYNEP  KILIÇ", "", "900"], [" ÖMER  ÇİFTÇİ ", "0532 201 00 04", "700"], ["Nur Işıl", "0532 201 00 08", "300"]], "s223-taksit.xlsx")));
    assert.deepEqual(reasons(report), ["Aynı adla açık kart var", "Aynı adlı birden çok kişi var; telefonunu ekleyip yeniden yükleyin"]);
    assert.equal(report.created, 4);
    assert.equal(report.linked, 3, "Hasan, Zeynep Kılıç, Ömer var olan carilerine");
    assert.equal(live(), before + 1, "yalnız Nur Işıl'a yeni cari");
    assert.deepEqual(cardsOf(ids.hasan), [600]);
    assert.deepEqual(cardsOf(ids.zeynep), [500]);
    assert.deepEqual(cardsOf(ids.zeynepUpper), [800], "v2.4.9'un kartı yerinde, ikinci kart yok");
    assert.deepEqual(cardsOf(ids.omer), [700]);
    assert.equal(await gl120(), before120 + 2100);
    const scan = await must("Mutabakat Testi", api.get(`${W}/ledger/integrity`));
    assert.deepEqual((scan.failures || []).map(item => item.code).filter(code => code !== "ledger:rule-diff"), [], JSON.stringify(scan.failures || "").slice(0, 600));
  });

  it("C8–C10 çek / senet: tek aday büyük harf bağlanır; çift caride birebir yazım kendi carisine; iki adaylı ve tanınmayan ad carisiz", async () => {
    const report = await must("çek", api.post(`${W}/cheques/import`, CHQ([["S223-D1", "AHU ÖZTÜRK", "400"], ["S223-D2", "ZEYNEP KILIÇ", "100"], ["S223-D3", "Zeynep Kılıç", "100"], ["S223-D4", "ZEYNEP KILIç", "100"], ["S223-D5", "Bilinmeyen Kişi", "100"]], "s223-cek.xlsx")));
    assert.equal(report.created, 5);
    const owner = serial => app.store.get("SELECT account_id AS a FROM cheques WHERE deleted_at IS NULL AND serial_no = ?", serial).a;
    assert.deepEqual(["S223-D1", "S223-D2", "S223-D3", "S223-D4", "S223-D5"].map(owner), [ids.ahu, ids.zeynepUpper, ids.zeynep, "", ""]);
    assert.equal(report.linked, 3);
  });
});
