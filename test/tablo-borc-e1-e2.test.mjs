// 2.4.4 31e dar kontrol tur 5 (aday 16) bulguları:
// E1 (dcb76c0 V1 gerilemesi): sağlaması tutmayan "Vergi No" sütununa "id" rolü verilince dosya no'suz 2.4.3 tablosu "Yerine koy" ile yeniden yüklendiğinde kayıt kimliği
//    kuralı legacy'den bu sütuna geçiyor, kayıt anahtarları değişiyor, kayıt tahsilatı (ve not / düzeltme / "Ödendi say" / kart bağı) kopuyordu. Kural: V1'in rolü kayıt
//    kimliği adayı DEĞİL ("number", kind "code"; tutar da değil) — 2.4.3 ile aynı kayıt anahtarları.
// E2 (T1 ailesi): KDV / Vergi Tutarı sütunlu fatura listesi Tablodaki Kişiler'den notsuz düşüyordu (iki tutar sütunu → borç yok). Kural: vergi sütunları (KDV, Vergi, Vergi
//    Tutarı, Stopaj, Tevkifat, ÖTV) borç adayı değil; Tutar + Genel Toplam birlikteyse borç Genel Toplam (öneri A; tek yerde, debt-column.mjs GRAND_TOTAL_WINS); borç sütunu
//    yine seçilemezse raporda görünür not.
// "Nasıl bozulur?" (not defteri e-nasil-bozulur.md): B1 V1 rolü kayıt kimliği adayı olur (E1) · B2 "Kimlik No" / "VKN" / "TC" 2.4.3'teki rolünü yitirir · B3 KDV borç sayılır ya da
// Tutar düşer · B4 Genel Toplam ve Tutar ikisi birden ya da hiçbiri · B5 seçilemeyen borç notsuz düşer · B6 "Toplam" + "Taksit Tutarı" (U2) etkilenir · B7 ödenen + KDV (T1) bozulur.
import "./fixtures/saat-dilimi-istanbul.mjs";
import assert from "node:assert/strict";
import { mkdtempSync, rmSync } from "node:fs";
import path from "node:path";
import { tmpdir } from "node:os";
import { after, before, describe, test } from "node:test";
import { analyzeColumns } from "../server/lib/insight/columns.mjs";
import { debtPlan, GRAND_TOTAL_WINS } from "../server/lib/insight/debt-column.mjs";
import { createClock } from "../server/lib/clock.mjs";
import { loginAdmin, startTestServer } from "./helpers.mjs";
import { CURRENT, bootVersion } from "./guvenilirlik/surumler.mjs";

const NOW = "2026-10-23T10:00:00+03:00";
const pad = value => String(value).padStart(2, "0");
const d = days => {
  const date = new Date(2026, 9, 23 + days, 12);
  return `${pad(date.getDate())}.${pad(date.getMonth() + 1)}.${date.getFullYear()}`;
};
const iso = days => {
  const date = new Date(2026, 9, 23 + days, 12);
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
};
const RANGE = "from=2000-01-01&to=2099-12-31";

describe("31e E1: 'Vergi No' (sağlamasız) kayıt kimliği adayı değil", () => {
  test("roller: Vergi No / Vergi Numarası / Vergi Kimlik No → number (kod); Kimlik No → id, VKN / TC → number (2.4.3 gibi); tutar değil (B1/B2)", () => {
    const roleOf = head => analyzeColumns([["Ali Veli", "1234567890"], ["Ayşe Kaya", "2345678901"], ["Can Er", "3456789012"]].map(([name, value]) => ({ "Ad Soyad": name, [head]: value, Tutar: "100" })), ["Ad Soyad", head, "Tutar"], { now: new Date(2026, 9, 23) }).find(item => item.column === head).role;
    assert.deepEqual(["Vergi No", "Vergi Numarası", "Vergi Kimlik No", "Kimlik No", "VKN", "TC"].map(roleOf), ["number", "number", "number", "id", "number", "number"]);
  });

  test("2.4.3'te yüklenmiş dosya no'suz tablo 'Yerine koy' ile yeniden yüklenince kayıt anahtarı ve 400 TL kayıt tahsilatı korunur (E1)", async () => {
    const root = mkdtempSync(path.join(tmpdir(), "r31e-e1-"));
    const dirs = { dataDir: path.join(root, "data"), backupDir: path.join(root, "backups"), env: { HUKUK_LICENSE_URL: "http://127.0.0.1:9" }, now: createClock({ time: new Date(2026, 9, 23, 10), fixed: true }) };
    const names = ["Ali Veli", "Ayşe Kaya", "Can Er", "Deniz Ak", "Ece Su", "Fırat Er"];
    const sheets = [{ name: "Müşteriler", matrix: [["Ad Soyad", "Vergi No", "Tutar", "Son Ödeme"], ...names.map((name, index) => [name, `${index + 1}234567890`.slice(0, 10), String(1000 * (index + 1)), d(-3 - index)])] }];
    const keysOf = server => server.app.store.all("SELECT case_key AS k FROM dataset_rows ORDER BY position").map(row => row.k);
    try {
      let server = await bootVersion("v2.4.3", dirs);
      let api = await server.login();
      await api.post("/api/workspace/bank/setup/dismiss", {});
      const first = await api.post("/api/workspace/dataset/stage", { kind: "excel", fileName: "m.xlsx", sheets });
      assert.equal((await api.post("/api/workspace/dataset/commit", { stageId: first.data.stageId, mode: "replace" })).status, 200);
      const before = keysOf(server);
      assert.equal((await api.post(`/api/workspace/cases/${encodeURIComponent(before[0])}/payments`, { amount: 400, date: iso(-1), method: "cash", cashForce: true, note: "Ali" })).status, 200);
      await server.close();
      server = await bootVersion(CURRENT, dirs);
      api = await server.login();
      const second = await api.post("/api/workspace/dataset/stage", { kind: "excel", fileName: "m.xlsx", sheets });
      assert.equal((await api.post("/api/workspace/dataset/commit", { stageId: second.data.stageId, mode: "replace" })).status, 200);
      const afterKeys = keysOf(server);
      const payKey = server.app.store.get("SELECT case_key AS k FROM payments")?.k;
      const report = (await api.get(`/api/workspace/reports/cari-ekstre?${RANGE}`)).data.report;
      const ali = report.groups.find(group => group.cari === "Ali Veli");
      await server.close();
      assert.deepEqual(afterKeys, before, `kayıt anahtarları değişmemeli: ${JSON.stringify([before.slice(0, 2), afterKeys.slice(0, 2)])}`);
      assert.ok(afterKeys.includes(payKey), `tahsilatın kaydı satırlarda: ${payKey}`);
      assert.deepEqual([ali?.debit, ali?.credit], [1000, 400], JSON.stringify(ali && [ali.debit, ali.credit]));
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });
});

describe("31e E2: borç düzeni (birim) — karar A kesin; Kalan / ödenen öncelikli", () => {
  test("Tutar + KDV + Genel Toplam → Genel Toplam; + Ödenen → Genel Toplam − Ödenen; + Kalan Borç → Kalan (Genel Toplam yalnız Kalan boşsa); Toplam + Taksit Tutarı (U2) borçsuz kalır (B4/B6/B7)", () => {
    assert.equal(debtPlan(["Tutar", "KDV", "Genel Toplam"]).column, "Genel Toplam");
    const withPaid = debtPlan(["Tutar", "KDV", "Genel Toplam", "Ödenen"]);
    assert.deepEqual([withPaid.net, withPaid.paid], ["Genel Toplam", "Ödenen"]);
    const withRemaining = debtPlan(["Tutar", "KDV", "Genel Toplam", "Kalan Borç"]);
    assert.deepEqual([withRemaining.remaining, withRemaining.total], ["Kalan Borç", "Genel Toplam"]);
    assert.equal(debtPlan(["Tutar", "Vergi Tutarı"]).column, "Tutar");
    assert.equal(debtPlan(["KDV Dahil Tutar", "Tutar"]).column, "KDV Dahil Tutar", "KDV dahil toplam vergi sayılıp dışlanmaz (B8)");
    assert.equal(debtPlan(["Toplam", "Taksit Tutarı"]).column, null, "U2: taksit tablosu borçsuz kalır");
    assert.equal(GRAND_TOTAL_WINS, true, "karar A (5 dk yetkisiyle kesin, 23.10.2026)");
  });
});

describe("31e E2: vergi sütunlu fatura / sipariş listesi Tablodaki Kişiler'de; borç seçilemezse not", () => {
  let server;
  let admin;
  const report = async kind => (await admin.get(`/api/workspace/reports/${kind}?${RANGE}`)).data.data.report;
  before(async () => {
    server = await startTestServer({ now: NOW });
    admin = await loginAdmin(server);
    await admin.post("/api/workspace/bank/setup/dismiss", {});
    const sheets = [
      { name: "Faturalar", matrix: [["Fatura No", "Müşteri", "Tutar", "KDV", "Genel Toplam", "Vade"], ["A-1", "Ece Su", "1.000", "200", "1.200", d(-2)], ["A-2", "Fırat Er", "2.000", "400", "2.400", d(-3)], ["A-3", "Gül Taş", "3.000", "600", "3.600", d(-4)]] },
      { name: "KDV", matrix: [["Fatura No", "Müşteri", "Tutar", "KDV", "Vade"], ["B-1", "Hakan Öz", "500", "100", d(-2)]] },
      { name: "Siparis", matrix: [["Sipariş No", "Müşteri", "Tutar", "Vergi Tutarı", "Vade"], ["C-1", "İpek Ay", "700", "140", d(-2)]] },
      { name: "Masraflar", matrix: [["Kayıt No", "Müşteri", "Tutar", "Masraf", "Vade"], ["D-1", "Kaan Uz", "800", "50", d(-2)]] },
    ];
    const staged = await admin.post("/api/workspace/dataset/stage", { kind: "excel", fileName: "f.xlsx", sheets });
    assert.equal(staged.status, 200, JSON.stringify(staged.data).slice(0, 300));
    assert.equal((await admin.post("/api/workspace/dataset/commit", { stageId: staged.data.data.stageId, mode: "replace" })).status, 200);
  });
  after(async () => {
    await server?.close();
  });

  test("Faturalar: borç Genel Toplam (KDV dahil; karar A) 1.200 / 2.400 / 3.600; KDV ve Vergi Tutarı sekmelerinde borç Tutar (500, 700) (B3/B4)", async () => {
    const rep = await report("cari-ekstre");
    const debit = Object.fromEntries(rep.groups.map(group => [group.cari, group.debit]));
    assert.deepEqual({ ece: debit["Ece Su"], firat: debit["Fırat Er"], gul: debit["Gül Taş"], hakan: debit["Hakan Öz"], ipek: debit["İpek Ay"] }, { ece: 1200, firat: 2400, gul: 3600, hakan: 500, ipek: 700 }, JSON.stringify(rep.groups.map(group => [group.cari, group.debit])));
  });

  test("Masraflar (Tutar + Masraf, borç sütunu seçilemedi): borç sayılmaz ama raporda görünür not (B5)", async () => {
    for (const kind of ["cari-ekstre", "vade-takip", "nakit-akis"]) {
      const notes = (await report(kind)).notes || [];
      assert.ok(notes.some(note => note.includes("“Masraflar” sekmesinde borç sütunu seçilemedi (Tutar, Masraf)")), `${kind} notu: ${JSON.stringify(notes)}`);
      assert.ok(!notes.some(note => note.includes("“Faturalar”")), `${kind}: Faturalar için not çıkmamalı`);
    }
  });
});
