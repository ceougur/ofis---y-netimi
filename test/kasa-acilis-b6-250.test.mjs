// 2.5.0 birleşik tur 6 — Kasa açılış denetiminin işlem izi (dar kontrol DK-D2T3 DÜŞÜK-1; docs/erp/C5K-KASA-TASARIM.md §10.2, docs/devir/D2-ALTYAPI-TASARIM.md §15).
//   BAŞ MİMAR 11.11 "DK-D2T3" (2), sakınca süzgeci: işlem İÇİNDE store dışından (aynı bağlantı, db.prepare) eklenip store ile düzeltilen açılış öncesi YENİ nakit satırı
//   KABUL ediliyordu (eklendiği hâli "işlem öncesi hâl" sanılıyordu: scope.inserted onu görmez). Karar: iz koşuluna "işlem başındaki en büyük satır numarasından büyük"
//   eklenir (lib/db.mjs readBefore → scope.born; işaret K6'nın BEGIN'deki money.marks'ı). Ürün yolundan ulaşılamaz (nakit tablolarına yazımlar store üzerinden; test kipinde
//   K6 ayrıca reddeder) ama yön yanlış para. Eski sürüm satırının düzeltmesi (S26 — meşru yol) ve S94 sınıfı (yedekten / eski sürümden gelen satır) DEĞİŞMEZ.
// Sahte saat (ders 13); iki TZ'de koşulur; lisans servisi yok (ders 30). Yaşayan mutantların testleri ayrı dosyada (test/kasa-acilis-mutant-b6-250.test.mjs).
import assert from "node:assert/strict";
import { DatabaseSync } from "node:sqlite";
import { after, before, describe, it } from "node:test";
import { loginAdmin, startTestServer } from "./helpers.mjs";

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
const INSERT = "INSERT INTO cash_entries (id, kind, amount, date, description, method, created_by, created_at) VALUES (?, 'in', 5, ?, 'iz', 'cash', 'test', ?)";
/** İşlemi dener: KABUL | RED <kod>. */
const attempt = (store, fn) => {
  try {
    store.tx(fn);
    return "KABUL";
  } catch (error) {
    return `RED ${error?.extra?.code || error?.code || String(error?.message).slice(0, 80)}`;
  }
};
/** İşlem kapsamını gözler (yalnız cash_entries): eklenen / doğan rowid'ler. */
function watchScope(store) {
  const seen = { inserted: [], born: [] };
  const remove = store.addCommitGuard({
    check({ scope }) {
      seen.inserted = [...(scope?.inserted?.get("cash_entries") || [])].sort((a, b) => a - b);
      seen.born = [...(scope?.born?.get("cash_entries") || [])].sort((a, b) => a - b);
    },
  });
  return { seen, remove };
}

describe("Birleşik tur 6 DÜŞÜK-1 — işlem içinde store dışından eklenip düzeltilen açılış öncesi YENİ satır: RED (önceden KABUL); eski satırın düzeltmesi KABUL", () => {
  let server;
  let store;
  before(async () => {
    // Üretim kipi (moneyStrict: false): K6 ham yazımı yalnız günlüğe yazar — ürünün kendi karar yolu sınanır.
    server = await startTestServer({ now: { time: NOW, fixed: true }, moneyStrict: false, gateVerify: false });
    const api = apiOf(await loginAdmin(server));
    await api.post("/api/workspace/bank/setup/dismiss", {});
    await must("Kasa açılışı", api.post("/api/workspace/cash/opening", { amount: "5.000", date: OPEN }));
    store = server.app.store;
    // İşlemden ÖNCE var olan açılış öncesi satır (yedekten / eski sürümden gelmiş gibi; başka bağlantı — S20 aynen).
    const other = new DatabaseSync(store.get("PRAGMA database_list").file);
    other.prepare(INSERT).run("b6-eski", BEFORE, NOW);
    other.close();
  });
  after(() => server?.close());

  it("store dışı ekleme + store düzeltmesi (açılış öncesi) → 409 cash-before-opening, satır yazılmadı; aynı işlemde eski satırın tutar düzeltmesi + store dışı ilgisiz (açılış sonrası) ekleme → KABUL, iz: yalnız yeni satır doğmuş", () => {
    const raw = id => server.app.db.prepare(INSERT).run(id, BEFORE, NOW);
    const rawAfter = id => server.app.db.prepare(INSERT).run(id, AFTER, NOW);
    const seen = {
      hamYeni: attempt(store, () => {
        raw("b6-ham");
        store.run("UPDATE cash_entries SET description = 'düzeltildi' WHERE id = 'b6-ham'");
      }),
    };
    seen.hamSatir = store.get("SELECT COUNT(*) AS n FROM cash_entries WHERE id = 'b6-ham'").n;
    const watch = watchScope(store);
    const rowid = id => store.get("SELECT rowid AS r FROM cash_entries WHERE id = ?", id)?.r;
    try {
      seen.eskiDuzeltme = attempt(store, () => {
        rawAfter("b6-ham-sonra");
        store.run("UPDATE cash_entries SET description = 'x' WHERE id = 'b6-ham-sonra'");
        store.run("UPDATE cash_entries SET amount = 7 WHERE id = 'b6-eski'");
      });
    } finally {
      watch.remove();
    }
    seen.iz = { born: watch.seen.born, yeni: rowid("b6-ham-sonra"), eski: rowid("b6-eski"), inserted: watch.seen.inserted };
    seen.eskiTutar = store.get("SELECT amount FROM cash_entries WHERE id = 'b6-eski'").amount;
    assert.deepEqual(seen, {
      hamYeni: "RED cash-before-opening",
      hamSatir: 0,
      eskiDuzeltme: "KABUL",
      // Store dışı eklenen satır inserted'da YOK (store görmedi) ama işlem başındaki en büyük rowid'den büyük → born; eski satır born değil.
      iz: { born: [seen.iz.yeni], yeni: seen.iz.yeni, eski: seen.iz.eski, inserted: [] },
      eskiTutar: 7,
    });
    assert.ok(seen.iz.yeni > seen.iz.eski);
  });
});
