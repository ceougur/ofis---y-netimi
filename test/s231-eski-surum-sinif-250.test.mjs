// 2.5.0 S231 = A — kabul D (ders 17, 53 (b)): v2.4.9'un GERÇEK koduyla (surumler.mjs bootVersion) API'den girilmiş veri; hata v2.4.9'da da var (telefonsuz
// kişinin grubu büyük harfle yazılınca yeni grup + yeni cari + yeni kart: ÇİFT GRUP, ÇİFT CARİ, AYNI BORÇ İKİ KEZ), güncel kod aynı veride grup adını S228
// sırasıyla (önce NOCASE, bulamazsa Türkçe harf katlamalı TEK grup) buluyor. Var olan çift gruplar birleştirilmez.
// SINIF LİSTESİ (yol × varyant × aday; beklenenler ELLE, kararlardan):
//   v2.4.9 (saat 08.10.2026): taksit Excel 'Elif Su' (telefonsuz) / 'Işık Servisi' 1.000; sonra 'ELİF SU' / 'IŞIK SERVİSİ' 1.000 → v2.4.9'da YENİ grup +
//   YENİ cari + YENİ kart (eski hatanın sayıları: 2 grup, 2 cari, 2 kart, 120 = 2.000). Ayrıca 'Can Er' / 'Ilgaz Hattı' 400 ve 'Ece Naz' / 'Yıldız Sitesi' ›
//   'İç Blok' 200 (tek yazım).
//   Güncel kod (saat 12.10.2026), aynı veri:
//   G1 taksit × I/ı büyük harf × tek aday grup: 'CAN ER' / 'ILGAZ HATTI' 500 → 'Aynı adla açık kart var' (v2.4.9 kartı; yeni grup / cari / kart yok);
//      'Nur Ak' / 'ılgaz hattı' 300 → kart 'Ilgaz Hattı'na.
//   G2 taksit × çift grup (v2.4.9'un açtığı): 'Elif Su' / 'Işık Servisi' 1.000 → 'Aynı adla açık kart var' (bugünkü; birebir yazım); 'Ali Su' / 'IŞIK SERVİSİ'
//      100 → 'IŞIK SERVİSİ' grubu (birebir); 'Ela Su' / 'ışık servisi' 100 (iki grupla da NOCASE'te farklı; Türkçe katlamada iki aday) → bugünkü gibi YENİ grup.
//   G3 taksit × alt grup × tek aday: 'Ada Gül' / 'YILDIZ SİTESİ' › 'İÇ BLOK' 200 → 'Yıldız Sitesi' › 'İç Blok'.
//   G4 cari Excel × grup kolonu × tek aday: 'Okan Ilgaz' 0546 300 00 01 / 'ILGAZ HATTI' → cari 'Ilgaz Hattı' grubunda.
//   G5 taksit × yok aday: 'Su Ay' / 'Kuzey Hattı' 100 → yeni grup.
//   Defter 120: güncel yüklemelerin kartları 300 + 100 + 100 + 200 + 100 = 800 artar; Mutabakat Testi temiz (kural farkı dışında).
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
const PLAN = (rows, fileName) => ({
  matrix: [["Ad Soyad", "Telefon", "Grup", "Alt Grup", "Toplam Tutar", "Taksit Sayısı", "İlk Vade"], ...rows.map(([name, group, subgroup, total]) => [name, "", group, subgroup, total, "2", "01.11.2026"])],
  headerAt: 0,
  roles: { 0: "name", 1: "phone", 2: "group", 3: "subgroup", 4: "total", 5: "count", 6: "firstDue" },
  linkRecords: false,
  fileName,
});
const reasons = report => report.skipped.map(item => item.reason);

describe("S231 — kabul D: v2.4.9'un verisinde grup adı Türkçe harf katlamalı (sınıf listesi)", { skip }, () => {
  let root;
  let server;
  let api;
  let app;
  let old249;
  const groups = (name, parentId = "") => app.store.all("SELECT id FROM plan_groups WHERE name = ? AND COALESCE(parent_id, '') = ? ORDER BY rowid", name, parentId).map(row => row.id);
  const groupCount = () => app.store.get("SELECT COUNT(*) AS n FROM plan_groups").n;
  const card = name => app.store.get("SELECT group_id AS g, subgroup_id AS s, account_id AS a FROM plans WHERE deleted_at IS NULL AND name = ? ORDER BY rowid DESC", name);
  const live = () => app.store.get("SELECT COUNT(*) AS n FROM accounts WHERE deleted_at IS NULL").n;
  const gl120 = async () => Number((await must("mizan", api.get(`${W}/ledger`))).trial.accounts.find(item => item.code === "120")?.balance || 0);
  before(async () => {
    root = mkdtempSync(path.join(tmpdir(), "s231-eski-"));
    const dirs = { dataDir: path.join(root, "data"), backupDir: path.join(root, "backups") };
    const old = await bootVersion("v2.4.9", { ...dirs, now: { time: "2026-10-08T12:00:00+03:00", fixed: true } });
    try {
      const o = await old.login();
      await must("taksit 1 (v2.4.9)", o.post(`${W}/plans/import`, PLAN([["Elif Su", "Işık Servisi", "", "1.000"], ["Can Er", "Ilgaz Hattı", "", "400"], ["Ece Naz", "Yıldız Sitesi", "İç Blok", "200"]], "v249-1.xlsx")));
      const second = await must("taksit 2 (v2.4.9)", o.post(`${W}/plans/import`, PLAN([["ELİF SU", "IŞIK SERVİSİ", "", "1.000"]], "v249-2.xlsx")));
      const list = (await must("cariler (v2.4.9)", o.get(`${W}/accounts?status=all`))).accounts;
      const tree = await must("gruplar (v2.4.9)", o.get(`${W}/plans/groups`));
      const ledger = await must("mizan (v2.4.9)", o.get(`${W}/ledger`));
      old249 = {
        secondCreated: second.created,
        secondGroups: second.groups,
        isikGroups: tree.filter(item => ["Işık Servisi", "IŞIK SERVİSİ"].includes(item.name)).length,
        elif: list.filter(item => ["Elif Su", "ELİF SU"].includes(item.name)).length,
        gl120: Number(ledger.trial.accounts.find(item => item.code === "120")?.balance || 0),
      };
    } finally {
      await old.close();
    }
    server = await bootVersion(CURRENT, { ...dirs, now: { time: "2026-10-12T12:00:00+03:00", fixed: true }, integrityScan: false });
    app = server.app;
    await app.ledger.snapshots.runPending();
    api = await server.login();
  }, { timeout: 300_000 });
  after(async () => {
    await server?.close();
    if (root) rmSync(root, { recursive: true, force: true });
  });

  it("v2.4.9'da hata VAR (elle beklenen): 'ELİF SU' / 'IŞIK SERVİSİ' yeni grup + yeni cari + yeni kart (borç iki kez)", () => {
    assert.deepEqual(old249, { secondCreated: 1, secondGroups: 1, isikGroups: 2, elif: 2, gl120: 2600 });
  });

  it("G1–G3, G5 taksit Excel: tek aday grup büyük / küçük harfle bulunur; v2.4.9'un çift grubunda birebir yazım kendi grubuna, iki adaylı yazım yeni grup; alt grup; yok aday yeni grup", async () => {
    const [ilgaz] = groups("Ilgaz Hattı");
    const [lower] = groups("Işık Servisi");
    const [upper] = groups("IŞIK SERVİSİ");
    const [yildiz] = groups("Yıldız Sitesi");
    const [ic] = groups("İç Blok", yildiz);
    assert.ok(ilgaz && lower && upper && yildiz && ic, "v2.4.9'un grupları güncel veride");
    const before120 = await gl120();
    const beforeGroups = groupCount();
    const beforeAccounts = live();
    const report = await must("taksit Excel", api.post(`${W}/plans/import`, PLAN([
      ["CAN ER", "ILGAZ HATTI", "", "500"],
      ["Nur Ak", "ılgaz hattı", "", "300"],
      ["Elif Su", "Işık Servisi", "", "1.000"],
      ["Ali Su", "IŞIK SERVİSİ", "", "100"],
      ["Ela Su", "ışık servisi", "", "100"],
      ["Ada Gül", "YILDIZ SİTESİ", "İÇ BLOK", "200"],
      ["Su Ay", "Kuzey Hattı", "", "100"],
    ], "s231-d.xlsx")));
    assert.deepEqual(reasons(report), ["Aynı adla açık kart var", "Aynı adla açık kart var"], JSON.stringify(report.skipped));
    assert.equal(report.created, 5);
    assert.equal(report.groups, 2, "yalnız 'ışık servisi' (iki aday) ve 'Kuzey Hattı' (yok aday) yeni grup");
    assert.equal(groupCount(), beforeGroups + 2);
    assert.equal(card("Nur Ak").g, ilgaz);
    assert.equal(card("Ali Su").g, upper);
    assert.ok(![lower, upper].includes(card("Ela Su").g), "iki adaylı yazım ikisinden birine bağlanmaz");
    assert.deepEqual([card("Ada Gül").g, card("Ada Gül").s], [yildiz, ic]);
    assert.equal(live(), beforeAccounts + 5, "satır başına bir yeni cari (çift cari yok: CAN ER ve Elif Su atlandı)");
    assert.equal(await gl120(), before120 + 800);
    const scan = await must("Mutabakat Testi", api.get(`${W}/ledger/integrity`));
    assert.deepEqual((scan.failures || []).map(item => item.code).filter(code => code !== "ledger:rule-diff"), [], JSON.stringify(scan.failures || "").slice(0, 600));
  });

  it("G4 cari Excel'in grup kolonu: 'ILGAZ HATTI' → v2.4.9'un 'Ilgaz Hattı' grubu (yeni grup yok)", async () => {
    const [ilgaz] = groups("Ilgaz Hattı");
    const beforeGroups = groupCount();
    const report = await must("cari Excel", api.post(`${W}/accounts/import`, { matrix: [["Ad Soyad", "Telefon", "Grup"], ["Okan Ilgaz", "0546 300 00 01", "ILGAZ HATTI"]], headerAt: 0, roles: { 0: "name", 1: "phone", 2: "group" }, mode: "skip", fileName: "s231-d-cari.xlsx" }));
    assert.equal(report.created, 1);
    assert.equal(groupCount(), beforeGroups);
    assert.equal(app.store.get("SELECT group_id AS g FROM accounts WHERE deleted_at IS NULL AND name = 'Okan Ilgaz'").g, ilgaz);
  });
});
