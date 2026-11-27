// 2.5.0 birleşik tur 6 — dar kontrol DK-D2T3'ün YAŞAYAN MUTANTLARINA test (DÜŞÜK-2 / 3; KAYIT 11.11 02:21 "TEK DAR KONTROL BİTTİ"; yalnız test, ürün değişmez):
//   A1 — çok satırlı INSERT'te yalnız son rowid "eklendi" sayılır (lib/db.mjs afterScopedInsert; işlem kapsamı sözleşmesi: scope.inserted / scope.born bütün satırları taşır).
//   A16 — Kasa açılış denetiminin önceki hâl eşlemesi born yerine inserted okur (lib/cash-opening.mjs priorIndex): fatura Düzenle peşin satırını silip yeniden yazar; silinen
//     satır en büyük rowid'liyse yenisi AYNI rowid'i alır → eski sürümden gelen açılış öncesi faturanın yalnız tutar düzeltmesi (S26 = A) yanlışlıkla 409 olur.
//   A6 — Defter Mutabakatı (routes/report-center.mjs): eski sürümden kalan satır + Kasa açılış uyarısı birlikteyken "Eski Sürümden Kalan" yerine "yöneticiye bildirin".
// Her test bugünkü kodda yeşil, mutantta DEĞERLE kırmızı (ders 7, 38). Sahte saat (ders 13); iki TZ; lisans servisi yok (ders 30). Eski sürüm verisi v2.4.9'un GERÇEK
// koduyla (etiket; ders 17, 23).
import assert from "node:assert/strict";
import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { after, before, describe, it } from "node:test";
import { loginAdmin, removeTestDir, startTestServer } from "./helpers.mjs";
import { bootVersion, tagsAvailable } from "./guvenilirlik/surumler.mjs";

process.env.HUKUK_LICENSE_URL ||= "http://127.0.0.1:9";
const NOW = "2026-03-20T12:00:00";
const OPEN = "2026-03-10";
const BEFORE = "2026-03-09";
const AFTER = "2026-03-11";

const unwrap = r => ({ status: r.status, data: r.data && typeof r.data === "object" && r.data.ok === true ? r.data.data : r.data, code: r.data?.code, error: r.data?.error });
const apiOf = client => ({
  get: async url => unwrap(await client.get(url)),
  post: async (url, body) => unwrap(await client.post(url, body)),
  del: async url => unwrap(await client.del(url)),
});
const must = async (label, promise) => {
  const res = await promise;
  assert.equal(res.status, 200, `${label}: ${res.status} ${res.code || ""} ${JSON.stringify(res.data).slice(0, 400)}`);
  return res.data;
};
const idOf = data => data?.id || data?.account?.id || data?.invoice?.id || data?.entry?.id || "";
const attempt = (store, fn) => {
  try {
    store.tx(fn);
    return "KABUL";
  } catch (error) {
    return `RED ${error?.extra?.code || error?.code || String(error?.message).slice(0, 80)}`;
  }
};

describe("Birleşik tur 6 — A1: çok satırlı INSERT'in BÜTÜN satırları işlem kapsamında 'eklendi' ve düzeltilince 'doğmuş'", () => {
  let server;
  before(async () => {
    server = await startTestServer({ now: { time: NOW, fixed: true }, moneyStrict: false, gateVerify: false });
    const api = apiOf(await loginAdmin(server));
    await api.post("/api/workspace/bank/setup/dismiss", {});
    await must("Kasa açılışı", api.post("/api/workspace/cash/opening", { amount: "5.000", date: OPEN }));
  });
  after(() => server?.close());

  it("üç satırlı INSERT + düzeltme: scope.inserted ve scope.born üç rowid'in hepsi (KABUL); iki satırlıdan biri açılış öncesiyse → 409, ikisi de yazılmadı", () => {
    const store = server.app.store;
    const seen = { inserted: [], born: [] };
    const remove = store.addCommitGuard({
      check({ scope }) {
        seen.inserted = [...(scope?.inserted?.get("cash_entries") || [])].sort((a, b) => a - b);
        seen.born = [...(scope?.born?.get("cash_entries") || [])].sort((a, b) => a - b);
      },
    });
    const ids = ["b6-c1", "b6-c2", "b6-c3"];
    let outcome;
    try {
      outcome = attempt(store, () => {
        store.run(`INSERT INTO cash_entries (id, kind, amount, date, description, method, created_by, created_at) VALUES ${ids.map(() => "(?, 'in', 5, ?, 'çok', 'cash', 't', ?)").join(", ")}`, ...ids.flatMap(id => [id, AFTER, NOW]));
        store.run(`UPDATE cash_entries SET description = 'd' WHERE id IN (${ids.map(() => "?").join(", ")})`, ...ids);
      });
    } finally {
      remove();
    }
    const rowids = ids.map(id => store.get("SELECT rowid AS r FROM cash_entries WHERE id = ?", id)?.r).sort((a, b) => a - b);
    const red = attempt(store, () => {
      store.run("INSERT INTO cash_entries (id, kind, amount, date, description, method, created_by, created_at) VALUES ('b6-m1', 'in', 5, ?, 'çok', 'cash', 't', ?), ('b6-m2', 'in', 5, ?, 'çok', 'cash', 't', ?)", BEFORE, NOW, AFTER, NOW);
      store.run("UPDATE cash_entries SET description = 'd' WHERE id IN ('b6-m1', 'b6-m2')");
    });
    assert.deepEqual({ outcome, inserted: seen.inserted, born: seen.born, red, m: store.get("SELECT COUNT(*) AS n FROM cash_entries WHERE id IN ('b6-m1', 'b6-m2')").n }, { outcome: "KABUL", inserted: rowids, born: rowids, red: "RED cash-before-opening", m: 0 });
  });
});

describe("Birleşik tur 6 — A16: v2.4.9'dan gelen açılış öncesi peşin nakitli fatura (cari hareketlerinin SON satırı): Düzenle ile yalnız tutar → 200 (silinen peşinin rowid'ini yenisi alır)", { skip: !tagsAvailable(["v2.4.9"]) && "v2.4.9 etiketi bu depoda yok (git fetch --tags)" }, () => {
  const root = mkdtempSync(path.join(tmpdir(), "b6-fatura-"));
  const dataDir = path.join(root, "data");
  const backupDir = path.join(root, "backups");
  let server;
  after(async () => {
    await server?.close();
    removeTestDir(root);
  });

  it("Düzenle (300 → 350, tarih aynı — S26): 200; peşin satırı aynı rowid'de 350, tarih aynı; uyarı sürer (1 satır)", async () => {
    let invoiceId;
    let accountId;
    const old = await bootVersion("v2.4.9", { dataDir, backupDir, now: { time: NOW, fixed: true } });
    try {
      const v = await old.login();
      await v.post("/api/workspace/bank/setup/dismiss", {});
      await must("2.4.9 açılış", v.post("/api/workspace/cash/opening", { amount: "5.000", date: OPEN }));
      accountId = idOf(await must("2.4.9 cari", v.post("/api/workspace/accounts", { name: "Peşin Müşteri", type: "customer", registeredOn: "2026-01-01", similarOk: true, force: true })));
      invoiceId = idOf(await must("2.4.9 peşin faturası (açılıştan önce)", v.post("/api/workspace/invoices", { kind: "sale", accountId, issueDate: "2026-03-05", lines: [{ name: "Hizmet", qty: 1, unitPrice: "300,00", vatRate: 0 }], payment: { cash: [{ amount: "300,00", method: "cash", lineKey: "p1" }], rest: "open" }, force: true, cashForce: true, similarOk: true })));
    } finally {
      await old.close();
    }
    server = await startTestServer({ dataDir, backupDir, now: { time: NOW, fixed: true }, gateVerify: false });
    const api = apiOf(await loginAdmin(server));
    const pesin = () => server.app.store.all("SELECT rowid AS r, amount, date FROM account_entries WHERE source = 'invoice' AND source_id = ? AND kind = 'in'", invoiceId);
    const last = { ...server.app.store.get("SELECT source, source_id = ? AS bu FROM account_entries ORDER BY rowid DESC LIMIT 1", invoiceId) };
    const before_ = pesin();
    assert.deepEqual({ last, before: before_.map(row => [row.amount, row.date]) }, { last: { source: "invoice", bu: 1 }, before: [[300, "2026-03-05"]] }, "ön koşul: peşin satırı cari hareketlerinin SON satırı (en büyük rowid)");
    const body = amount => ({ kind: "sale", accountId, issueDate: "2026-03-05", lines: [{ name: "Hizmet", qty: 1, unitPrice: amount, vatRate: 0 }], payment: { cash: [{ amount, method: "cash", lineKey: "p1" }], rest: "open" }, force: true, cashForce: true, similarOk: true });
    const edit = await api.post(`/api/workspace/invoices/${invoiceId}/edit`, body("350,00"));
    const after_ = pesin();
    const notice = (await must("Mutabakat Testi", api.get("/api/workspace/ledger/integrity"))).checks.find(item => item.code === "cash:before-opening");
    assert.deepEqual(
      { duzenle: [edit.status, edit.code || ""], sonra: after_.map(row => [row.r, row.amount, row.date]), uyari: notice?.count },
      { duzenle: [200, ""], sonra: [[before_[0].r, 350, "2026-03-05"]], uyari: 1 },
      `Düzenle: ${String(edit.error || "").slice(0, 200)}`,
    );
  });
});

describe("Birleşik tur 6 — A6: Defter Mutabakatı, eski sürümden kalan satır + Kasa açılış uyarısı birlikte → 'Eski Sürümden Kalan' (yöneticiye bildirin DEĞİL)", () => {
  let server;
  let api;
  before(async () => {
    server = await startTestServer({ now: { time: NOW, fixed: true }, moneyStrict: false, gateVerify: false });
    api = apiOf(await loginAdmin(server));
    await api.post("/api/workspace/bank/setup/dismiss", {});
    const early = idOf(await must("Kasa Giriş (açılış yokken)", api.post("/api/workspace/cash", { kind: "in", amount: "100", date: "2026-03-05", description: "eski giriş", method: "cash" })));
    await must("sil", api.del(`/api/workspace/cash/${early}`));
    await must("Kasa açılışı", api.post("/api/workspace/cash/opening", { amount: "5.000", date: OPEN }));
    const listed = await must("Silinenler", api.get("/api/admin/trash"));
    const item = (Array.isArray(listed) ? listed : listed.items || []).find(row => row.ref === early);
    await must("geri yükle", api.post("/api/admin/trash/restore", { id: item?.id }));
    // Eski sürümden kalan satır (inceleme-226 G4 deseni): ileri tarihli kayıt tahsilatı, güncelleme sonrası açılışta taban.
    server.app.db.prepare("INSERT INTO payments (id, case_key, amount, date, note, method, created_by, created_at) VALUES ('b6-eski-ileri', 'ESKI', 500, '2026-04-30', 'Eski sürüm', 'cash', 'eski', ?)").run(new Date().toISOString());
    server.app.integrity.start();
  });
  after(() => server?.close());

  it("alt başlık 'Eski sürümden kalan satır var …' + uyarı cümlesi; 'yöneticiye bildirin' yok; satırlar 'Eski Sürümden Kalan' ve 'Uyarı'", async () => {
    const report = await must("Defter Mutabakatı", api.get("/api/workspace/report-center/defter-mutabakati"));
    const states = Object.fromEntries((report.rows || []).filter(row => row[0] === "Denetim" && row.at(-1) !== "Tutarlı").map(row => [row[1], row.at(-1)]));
    assert.ok(Object.values(states).includes("Eski Sürümden Kalan"), `ön koşul: eski sürümden kalan satır var — ${JSON.stringify(states)}`);
    assert.deepEqual(
      { basi: report.subtitle.startsWith("Eski sürümden kalan satır var (aşağıda “Eski Sürümden Kalan”). Yeni işlemler engellenmez ve bu satırları büyütemez."), yonetici: /yöneticiye bildirin/.test(report.subtitle), uyariCumlesi: /Uyarı \(yeni işlemleri engellemez\): Kasa Açılışından Önce Tarihli Hareket — 1 hareket/.test(report.subtitle), durumlar: states },
      { basi: true, yonetici: false, uyariCumlesi: true, durumlar: { ...Object.fromEntries(Object.keys(states).filter(name => name !== "Kasa Açılışından Önce Tarihli Hareket").map(name => [name, "Eski Sürümden Kalan"])), "Kasa Açılışından Önce Tarihli Hareket": "Uyarı" } },
      JSON.stringify({ subtitle: report.subtitle, states }),
    );
  });
});
