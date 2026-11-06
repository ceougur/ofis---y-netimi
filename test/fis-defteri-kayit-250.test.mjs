// 2.5.0 Ç2 TUR 3 — Mutabakat Günlüğü kaydının ayrıntısı hiçbir zaman kesilmiş JSON olmaz (docs/erp/C2-FIS-DEFTERI-TASARIM.md §11d) + K5 onarımının test boşlukları.
//   YAN BULGU 1 (ORTA; Ç2 tur 2 dar kontrolü): fiş defteri onarımının "kaldırıldı" kaydı `JSON.stringify({ ids, resetAt, kept }).slice(0, 20000)` — 475+ fişte (kaldırılan + kaldırılmayan
//     toplamı da) geçersiz JSON; Mutabakat Testi (routes/ledger.mjs günlüğü JSON.parse eder) HTTP 500 → mutabakat sessizce görünmez. Yeni kural (lib/log-detail.mjs boundedDetail):
//     listeler ilk 50 kimlik + tam sayılar (removedCount, keptCount), her zaman geçerli JSON.
//   integrity.mjs:803 / :833 (aynı kalıp): açılışta bulunan sapmanın ("baseline") ayrıntısı 20.000'i aşınca (eski sürümden uzun bozuk tarih) aynı 500. Sığan kayıtta yeni ayrıntı eskisiyle BAYT
//     BAYT aynı (taban karşılaştırması her açılışta yeni satır yazmaz; v2.4.9'un yazdığı kayıtla da aynı).
//   TEST BOŞLUKLARI (dar kontrol DÜŞÜK-3; D3 sakınca süzgecinden geçemedi — veri kaybı korumasının dişi): D1 en son yerine en eski sıfırlama izi, D2 izli ilk yerine izli son fiş, D3 "işlem
//     geçmişi silinmemiş" denetimi ilk yerine son izle, D5 keptCount yazılmıyor, D6 50 sınırı kalkıyor, D8 kayıt kesiliyor — her birini öldüren test (mutasyon: test/fis-defteri-250-mutasyon.mjs 36–).
//   D7 (çift kuralında sabit nokta döngüsü tek geçişe iner) EŞDEĞER mutant: ters kaydın ters kaydı yapılamaz (409 voucher-reversal-of-reversal) → zincir tek halkalı, tek geçiş yeter. Test yok.
// Kural (hangi fiş kalır / gider) DEĞİŞMEDİ (S28 = A; kuşkuda fiş kalır); bu tur yalnız kaydın biçimi + testler.
// Saat SAHTE ve sabit (ders 13, 22); iki saat diliminde koşulur (TZ=UTC, TZ=Europe/Istanbul). Gerçek dış servis yok (lisans adresi 127.0.0.1:9; ders 30).
// WINDOWS (ders 48): K5 testleri kapalı sunucunun dosyasını ayrı bağlantıyla değiştirir (işlem geçmişi silme, elle fiş / iz ekleme, tarih bozma); v2.4.9 testi aynı klasörü iki sürümle açar.
import assert from "node:assert/strict";
import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { DatabaseSync } from "node:sqlite";
import { after, before, describe, it } from "node:test";
import { bootVersion, tagsAvailable } from "./guvenilirlik/surumler.mjs";
import { loginAdmin, removeTestDir, startTestServer } from "./helpers.mjs";

const NOW = "2027-01-10T10:00:00+03:00";
const USER = { id: "fis-kayit", display_name: "Fiş Kayıt" };
const pair = (amount, debit = "590", credit = "519") => [{ account: debit, debit: amount }, { account: credit, credit: amount }];
const must = async (label, promise) => {
  const response = await promise;
  assert.equal(response.status, 200, `${label}: ${response.status} ${JSON.stringify(response.data).slice(0, 400)}`);
  return response.data.data;
};
const parsed = (label, text) => {
  try {
    return JSON.parse(text);
  } catch (error) {
    assert.fail(`${label}: kayıt ayrıntısı geçerli JSON değil (${text.length} karakter, sonu ${JSON.stringify(text.slice(-40))}): ${error.message}`);
  }
};

describe("Ç2 tur 3 — boundedDetail: sınırlı, her zaman geçerli JSON (lib/log-detail.mjs)", () => {
  // Yardımcı yalnız bu bölümde yüklenir: eski kodda (yardımcı yok) yalnız bu bölüm "modül yok" nedeniyle düşer, öbür bölümler kendi nedenini gösterir (ders 38).
  let boundedDetail;
  before(async () => {
    ({ boundedDetail } = await import("../server/lib/log-detail.mjs"));
  });
  const ids = n => Array.from({ length: n }, (_, i) => `lv-${String(i).padStart(4, "0")}-0000-0000-0000-000000000000`);

  it("listeler ilk 50 öğe; kökün sayıları ve alanları aynen; çıktı her uzunlukta geçerli JSON", () => {
    for (const n of [0, 1, 49, 50, 51, 474, 475, 600, 5000]) {
      const list = ids(n);
      const text = boundedDetail({ ids: list, removedCount: n, resetAt: "2027-01-10T06:00:00.000Z", kept: list, keptCount: n }, { maxList: 50, maxChars: 20_000 });
      const value = parsed(`n=${n}`, text);
      assert.ok(text.length <= 20_000, `n=${n}: ${text.length} karakter`);
      assert.deepEqual(Object.keys(value), ["ids", "removedCount", "resetAt", "kept", "keptCount"], `n=${n}: kökün alanları ve sırası`);
      assert.deepEqual([value.ids, value.kept, value.removedCount, value.keptCount], [list.slice(0, 50), list.slice(0, 50), n, n], `n=${n}`);
    }
  });

  it("eşlem nesnesi (çok anahtarlı) liste gibi ilk 50 anahtar; az anahtarlı kayıt nesnesi kısaltılmaz", () => {
    const list = ids(120);
    const value = parsed("eşlem", boundedDetail({ kept: list, doubts: Object.fromEntries(list.map(id => [id, "no-reset"])), rows: [{ a: 1, b: 2, c: 3, d: 4, e: 5, f: 6, g: 7, h: 8, i: 9 }] }));
    assert.deepEqual(Object.keys(value.doubts), list.slice(0, 50));
    assert.deepEqual(value.rows, [{ a: 1, b: 2, c: 3, d: 4, e: 5, f: 6, g: 7, h: 8, i: 9 }]);
  });

  it("sınır içinde metin aşılırsa liste ÖNCE kısaltılır (öğeler bozulmaz), kayıt nesnesinin alanları ve kökün 20 alanı korunur; asla ortadan kesmez", () => {
    const long = Array.from({ length: 50 }, (_, i) => `${i}:${"x".repeat(1000)}`);
    const root = Object.fromEntries(Array.from({ length: 18 }, (_, i) => [`alan${i}`, i]));
    const text = boundedDetail({ ...root, pending: long.map(reason => ({ kind: "g", id: "ev", reason })), count: 50 }, { maxList: 50, maxChars: 20_000 });
    const value = parsed("uzun öğe", text);
    assert.ok(text.length <= 20_000, `${text.length}`);
    assert.equal(Object.keys(value).length, 20, `kökün 20 alanı (sayılar dahil) kısaltılmaz: ${Object.keys(value).join(",")}`);
    assert.ok(value.pending.length > 0 && value.pending.length < 50, `liste kısaldı: ${value.pending.length}`);
    for (const item of value.pending) assert.deepEqual(Object.keys(item), ["kind", "id", "reason"], "kayıt nesnesinin alanları kesilmez");
    assert.deepEqual(value.pending.map(item => item.reason), long.slice(0, value.pending.length), "öğeler (uzun metin) olduğu gibi — liste kısaltılır, metin değil");
    // Tek öğe bile sığmazsa metin kısaltılır; yine geçerli JSON.
    const huge = boundedDetail({ sample: ["y".repeat(50_000)], removedCount: 1 }, { maxChars: 20_000 });
    assert.ok(huge.length <= 20_000 && parsed("tek dev öğe", huge).removedCount === 1, `${huge.length}`);
    const tiny = boundedDetail({ ids: ids(10), removedCount: 10 }, { maxChars: 10 });
    assert.ok(tiny.length <= 64 && parsed("çok küçük sınır", tiny).removedCount === 10, tiny);
  });

  it("maxList Infinity: sığan değer JSON.stringify ile BAYT BAYT aynı (integrity.mjs eşdeğerliği; rastgele yapılar, uzun metin, 1.000 öğeli liste); aşan değer geçerli ve sınır içinde", () => {
    // mulberry32 (32 bit tamsayı işlemleri; tohumlu, tekrarlanabilir). Önceki LCG `seed * 1103515245` 2^53'ü aşıp kesinlik yitiriyordu: dizi bozuluyor, uzun metin hemen hiç
    // üretilmiyordu — "sığan değerde metin kısaltılır" mutantı (48) bu yüzden kaçtı.
    let seed = 20261106;
    const rand = () => {
      seed = (seed + 0x6d2b79f5) | 0;
      let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
    const pick = list => list[Math.floor(rand() * list.length)];
    // Düğüm bütçesi (örnek başına en çok ~3.000 düğüm): derin ve geniş yapılar bellek taşırmasın. Kapsama: örnekte 1.024'ten uzun metin / 50'den uzun liste var mı.
    let budget = 0;
    let longText = false;
    let longList = false;
    const make = depth => {
      budget -= 1;
      const leaf = depth > 3 || budget <= 0;
      const kind = leaf ? pick(["s", "n", "b", "z"]) : pick(["s", "n", "b", "z", "a", "o", "a", "o"]);
      if (kind === "s") {
        const text = pick(["", "ç ğ ı ö ş ü İ", "a\"b\\c\n", "x".repeat(Math.floor(rand() * 2000)), "😀"]);
        if (text.length > 1024) longText = true;
        return text;
      }
      if (kind === "n") return pick([0, -1.5, 1e21, Number.NaN, 12.345]);
      if (kind === "b") return rand() > 0.5;
      if (kind === "z") return pick([null, undefined]);
      if (kind === "a") {
        const length = Math.min(pick([0, 1, 5, 60, 1000]), Math.max(0, budget));
        if (length > 50) longList = true;
        return Array.from({ length }, () => make(depth + 1));
      }
      return Object.fromEntries(Array.from({ length: Math.min(pick([0, 3, 17, 70]), Math.max(0, budget)) }, (_, i) => [`k${i}`, make(depth + 1)]));
    };
    const seen = { same: 0, bounded: 0, sameLongText: 0, sameLongList: 0 };
    // Rastgele örneklere ek, sığan dalı kesin deneyen elle kurulmuş değerler: uzun liste (60–193 öğe), uzun metin (1.100–1.860 karakter, iç içe), çok anahtarlı (70) nesne.
    const crafted = [
      ...Array.from({ length: 20 }, (_, i) => () => {
        longList = true;
        return { ids: Array.from({ length: 60 + i * 7 }, (_, k) => `lv-${k}`), removedCount: 60 + i * 7 };
      }),
      ...Array.from({ length: 20 }, (_, i) => () => {
        longText = true;
        return { note: "x".repeat(1100 + i * 40), list: [i, { reason: "y".repeat(1500) }], n: i };
      }),
      ...Array.from({ length: 10 }, (_, i) => () => ({ doubts: Object.fromEntries(Array.from({ length: 70 }, (_, k) => [`lv-${i}-${k}`, "no-reset"])) })),
    ];
    for (let i = 0; i < 400 + crafted.length; i += 1) {
      budget = 3000;
      longText = false;
      longList = false;
      const value = i < 400 ? make(0) : crafted[i - 400]();
      const plain = JSON.stringify(value) ?? "null";
      const text = boundedDetail(value, { maxList: Infinity, maxChars: 20_000 });
      if (plain.length <= 20_000) {
        assert.equal(text, plain, `örnek ${i}: sığan değer birebir olmalı`);
        seen.same += 1;
        if (longText) seen.sameLongText += 1;
        if (longList) seen.sameLongList += 1;
      } else {
        assert.ok(text.length <= 20_000, `örnek ${i}: ${text.length}`);
        parsed(`örnek ${i}`, text);
        seen.bounded += 1;
      }
    }
    assert.ok(seen.same > 50 && seen.bounded > 20 && seen.sameLongText >= 10 && seen.sameLongList >= 10, `kapsama (birebir dalında uzun metin ve uzun liste de denendi): ${JSON.stringify(seen)}`);
  });

  it("ders 47: uzun listenin kesilen öğeleri hiç okunmaz (öğe başına stringify döngüsü yok)", () => {
    const backing = ids(100_000);
    let reads = 0;
    const list = new Proxy(backing, {
      get(target, key, receiver) {
        if (typeof key === "string" && /^\d+$/.test(key)) reads += 1;
        return Reflect.get(target, key, receiver);
      },
    });
    const value = parsed("vekil liste", boundedDetail({ ids: list, removedCount: backing.length }, { maxList: 50 }));
    assert.equal(value.ids.length, 50);
    assert.ok(reads <= 100, `100.000 öğeli listeden ${reads} öğe okundu (≤ 100 beklenir; listenin tamamı okunuyorsa öğe başına iş var)`);
  });
});

// ---- K5 yardımcıları (Ç2 tur 1-2 testleriyle aynı biçim; test/fis-defteri-koruma-250.test.mjs) ----
const withServer = async (dirs, time, fn) => {
  const server = await startTestServer({ now: { time, fixed: true }, ...dirs, maxCompanies: 2 });
  try {
    return await fn(server);
  } finally {
    await server.close();
  }
};
const raw = (file, sql, ...args) => {
  const db = new DatabaseSync(file);
  try {
    db.prepare(sql).run(...args);
  } finally {
    db.close();
  }
};
const dropTraces = file => raw(file, "DELETE FROM audit_events WHERE type = 'ledger.voucher.created'");
const dropTrace = (file, id) => raw(file, "DELETE FROM audit_events WHERE type = 'ledger.voucher.created' AND entity_id = ?", id);
// İşlem geçmişini SİLMEDEN eklenen sıfırlama izi.
const writeReset = (file, entity, at) => raw(file, "INSERT INTO audit_events (id, type, entity_id, actor_id, actor_name, payload_json, created_at) VALUES (?, 'company.reset', ?, 'user-admin', 'Yönetici', '{\"mode\":\"movements\"}', ?)", `event-kayit-${entity}-${at}`, entity, at);
// 2.4.9'un resetData'sının fiş defterine dokunan kısmı (v2.4.9 server/app.mjs MOVEMENT_TABLES): işlem geçmişi ve Mutabakat Günlüğü BÜTÜNÜYLE silinir, aynı işlemde "company.reset".
const legacyReset = (file, entity, at) => {
  const db = new DatabaseSync(file);
  try {
    db.exec("BEGIN IMMEDIATE; DELETE FROM audit_events; DELETE FROM integrity_log;");
    db.prepare("INSERT INTO audit_events (id, type, entity_id, actor_id, actor_name, payload_json, created_at) VALUES (?, 'company.reset', ?, 'user-admin', 'Yönetici', '{\"mode\":\"movements\"}', ?)").run(`event-kayit-sifirlama-${entity}-${at}`, entity, at);
    db.exec("COMMIT");
  } finally {
    db.close();
  }
};
// Programın yolu dışında (ayrı bağlantı, TEK işlemde, verilen sırayla) yazılan iki satırlık fişler (590 / 519); trace: true → fişle aynı işlemde "ledger.voucher.created" izi.
const rawVouchers = (file, items) => {
  const db = new DatabaseSync(file);
  try {
    db.exec("BEGIN IMMEDIATE");
    const head = db.prepare("INSERT INTO ledger_vouchers (id, year, no, date, type, journal_class, description, source, request_key, reversal_of, line_count, total_minor, created_by, created_at) VALUES (?, 2027, ?, ?, 'opening-match', 'opening', '', '', ?, NULL, 2, ?, 'elle', ?)");
    const lines = db.prepare("INSERT INTO ledger_voucher_lines (voucher_id, seq, account, debit_minor, credit_minor) VALUES (?, 1, '590', ?, 0), (?, 2, '519', 0, ?)");
    const trace = db.prepare("INSERT INTO audit_events (id, type, entity_id, actor_id, actor_name, payload_json, created_at) VALUES (?, 'ledger.voucher.created', ?, 'elle', 'Elle', '{}', ?)");
    for (const item of items) {
      head.run(item.id, item.no, item.date || "2027-01-08", `kayit-elle-${item.id}`, item.amount, item.at || "2027-01-10T07:00:00.000Z");
      lines.run(item.id, item.amount, item.id, item.amount);
      if (item.trace) trace.run(`event-elle-${item.id}`, item.id, item.at || "2027-01-10T07:00:00.000Z");
    }
    db.exec("COMMIT");
  } finally {
    db.close();
  }
};
const idsOf = store => store.all("SELECT id FROM ledger_vouchers ORDER BY rowid").map(row => row.id);
const removedLogs = store => store.all("SELECT summary, detail_json AS detail FROM integrity_log WHERE action = 'repair' AND tables = 'ledger_vouchers' AND summary LIKE 'Eski sürümde%' ORDER BY rowid");
const keptLogs = store => store.all("SELECT summary, detail_json AS detail FROM integrity_log WHERE action = 'repair' AND tables = 'ledger_vouchers' AND summary LIKE 'Fiş defteri:%' ORDER BY rowid");
const postMany = (server, tag, n, amount = 100) =>
  server.app.ledger.vouchers.postAll(USER, Array.from({ length: n }, (_, i) => ({ type: "opening-match", date: "2027-01-05", requestKey: `fis-kayit-${tag}-${i}`, lines: pair(amount + i) }))).map(item => item.id);
const scanOf = async server => {
  const scan = await must("Mutabakat Testi", (await loginAdmin(server)).get("/api/workspace/ledger/integrity"));
  assert.equal(scan.ok, true, JSON.stringify(scan.checks.filter(item => !item.ok)));
  return scan;
};

describe("Ç2 tur 3 — YAN BULGU 1: onarımın kaydı kesilmiş JSON olmaz (475+ fiş; kaldırılan + kaldırılmayan toplamı)", () => {
  let root;
  before(() => {
    root = mkdtempSync(path.join(tmpdir(), "fis-kayit-"));
  });
  after(() => removeTestDir(root));
  let n = 0;
  const fresh = () => {
    n += 1;
    return { dataDir: path.join(root, `v${n}`, "data"), backupDir: path.join(root, `v${n}`, "backups") };
  };

  it("600 fiş eski sürüm sıfırlamasından artakalır → hepsi kaldırılır; kayıt geçerli JSON (ilk 50 kimlik, removedCount 600); Mutabakat Testi 200 ve günlüğünde; Mutabakat Günlüğü raporu 200", async () => {
    const dirs = fresh();
    const { file, ids } = await withServer(dirs, NOW, async server => ({ file: server.app.config.dbPath, ids: postMany(server, "600", 600) }));
    legacyReset(file, "sirket-001", "2027-01-10T08:00:00.000Z");
    await withServer(dirs, "2027-01-10T12:00:00+03:00", async server => {
      const repair = server.app.context.voucherRepair;
      assert.deepEqual([repair?.removed, repair?.kept], [600, []], JSON.stringify(repair).slice(0, 300));
      assert.equal(server.app.store.get("SELECT COUNT(*) AS n FROM ledger_vouchers").n, 0);
      const [log, ...others] = removedLogs(server.app.store);
      assert.equal(others.length, 0, "tek kaldırma kaydı");
      assert.match(log.summary, /artakalan 600 fiş kaldırıldı/);
      assert.ok(log.detail.length <= 20_000, `${log.detail.length} karakter`);
      const detail = parsed("kaldırma kaydı (600)", log.detail);
      assert.deepEqual(detail, { ids: ids.slice(0, 50), removedCount: 600, resetAt: "2027-01-10T08:00:00.000Z", kept: [], keptCount: 0 }, "ilk 50 kimlik (yazım sırasıyla) + tam sayılar");
      const scan = await scanOf(server);
      const shown = scan.log.find(row => row.summary === log.summary);
      assert.equal(shown?.detail?.removedCount, 600, "kayıt Mutabakat Testi'nin günlüğünde ayrıştırılmış görünür");
      const report = await (await loginAdmin(server)).get("/api/workspace/report-center/mutabakat-gunlugu");
      assert.equal(report.status, 200);
    });
  });

  it("kaldırılan 300 + kaldırılmayan 300 (izi duran fişten sonra yazılmış): iki kayıt da geçerli JSON — ilk 50 kimlik + removedCount 300 / keptCount 300; kuşku kaydı yinelenmez", async () => {
    const dirs = fresh();
    const { file, removedIds } = await withServer(dirs, NOW, async server => ({ file: server.app.config.dbPath, removedIds: postMany(server, "yari", 300) }));
    legacyReset(file, "sirket-001", "2027-01-10T06:00:00.000Z");
    const keptIds = Array.from({ length: 300 }, (_, i) => `lv-kayit-sonra-${String(i).padStart(3, "0")}-00000000-0000-0000`);
    rawVouchers(file, [{ id: "lv-kayit-izli-0000-0000-0000-000000000000", no: 900, amount: 7000, trace: true }, ...keptIds.map((id, i) => ({ id, no: 1000 + i, amount: 100 + i }))]);
    await withServer(dirs, NOW, async server => {
      const repair = server.app.context.voucherRepair;
      assert.deepEqual([repair?.removed, repair?.kept?.length], [300, 300], JSON.stringify(repair).slice(0, 300));
      const removal = parsed("kaldırma kaydı (300 + 300)", removedLogs(server.app.store)[0]?.detail || "");
      assert.deepEqual(removal, { ids: removedIds.slice(0, 50), removedCount: 300, resetAt: "2027-01-10T06:00:00.000Z", kept: keptIds.slice(0, 50), keptCount: 300 });
      const logs = keptLogs(server.app.store);
      assert.equal(logs.length, 1);
      const kept = parsed("kuşku kaydı (300)", logs[0].detail);
      assert.deepEqual([kept.kept, kept.keptCount, Object.keys(kept.doubts).length, kept.doubts[keptIds[0]]], [keptIds.slice(0, 50), 300, 50, "after-traced"]);
      assert.match(logs[0].summary, /izi olmayan 300 fiş kaldırılmadı[\s\S]*ve 290 fiş daha/);
      await scanOf(server);
    });
    await withServer(dirs, NOW, async server => {
      assert.equal(server.app.context.voucherRepair?.kept?.length, 300);
      assert.equal(keptLogs(server.app.store).length, 1, "aynı kuşkulu küme için kayıt her açılışta yinelenmez");
      await scanOf(server);
    });
  });

  it("50'den fazla kuşkulu fiş (sıfırlama izi yok, 60 fiş): kuşku kaydında ilk 50 kimlik + 50 neden + keptCount 60 — biçim tur 2'yle BAYT BAYT aynı (D5, D6)", async () => {
    const dirs = fresh();
    const { file, ids } = await withServer(dirs, NOW, async server => ({ file: server.app.config.dbPath, ids: postMany(server, "60", 60) }));
    dropTraces(file);
    await withServer(dirs, NOW, async server => {
      const repair = server.app.context.voucherRepair;
      assert.deepEqual([repair?.removed, repair?.kept?.length], [0, 60]);
      const logs = keptLogs(server.app.store);
      assert.equal(logs.length, 1);
      const expected = JSON.stringify({ kept: ids.slice(0, 50), keptCount: 60, doubts: Object.fromEntries(ids.slice(0, 50).map(id => [id, "no-reset"])), resetAt: "" });
      assert.equal(logs[0].detail, expected, "kuşku kaydının ayrıntısı (Ç2 tur 2 biçimi): ilk 50 kimlik, 50 neden, keptCount 60");
      assert.match(logs[0].summary, /izi olmayan 60 fiş kaldırılmadı[\s\S]*bu şirketin sıfırlama izi yok[\s\S]*ve 50 fiş daha/);
      await scanOf(server);
    });
  });
});

describe("Ç2 tur 3 — K5 test boşlukları (dar kontrol D1, D2, D3): onarım yazım sırasının uçlarını doğru okur", () => {
  let root;
  before(() => {
    root = mkdtempSync(path.join(tmpdir(), "fis-kayit-k5-"));
  });
  after(() => removeTestDir(root));
  let n = 0;
  const fresh = () => {
    n += 1;
    return { dataDir: path.join(root, `v${n}`, "data"), backupDir: path.join(root, `v${n}`, "backups") };
  };

  it("D1: işlem geçmişini SİLMEYEN İKİNCİ sıfırlama izi — EN SON iz sayılır: eski sürüm sıfırlaması (1. iz) → izli fiş → silmeyen 2. iz ⇒ izsiz fiş KALIR (reset-without-wipe)", async () => {
    const dirs = fresh();
    const { file, a } = await withServer(dirs, NOW, async server => ({ file: server.app.config.dbPath, a: server.app.ledger.vouchers.post(USER, { type: "opening-match", date: "2027-01-05", requestKey: "fis-kayit-d1-a", lines: pair(1100) }) }));
    legacyReset(file, "sirket-001", "2027-01-10T06:00:00.000Z");
    rawVouchers(file, [{ id: "lv-kayit-d1-b", no: 50, amount: 2200, trace: true }]);
    writeReset(file, "sirket-001", "2027-01-10T08:00:00.000Z");
    await withServer(dirs, NOW, async server => {
      const repair = server.app.context.voucherRepair;
      assert.deepEqual([repair?.removed, repair?.kept, repair?.doubts], [0, [a.id], { [a.id]: "reset-without-wipe" }], `en son sıfırlama izi işlem geçmişini silmemiş: izsiz fiş kalmalı (en eski iz sayılırsa kaldırılır): ${JSON.stringify(repair)}`);
      assert.deepEqual(idsOf(server.app.store), [a.id, "lv-kayit-d1-b"]);
      assert.match(keptLogs(server.app.store)[0]?.summary || "", /sıfırlama izi işlem geçmişini silmemiş/);
      await scanOf(server);
    });
  });

  it("D2: iki izli fiş ARASINA düşen izsiz fiş — İZLİ İLK fiş sayılır: sıfırlamadan önceki fiş kaldırılır, aradaki izsiz fiş KALIR (after-traced)", async () => {
    const dirs = fresh();
    const { file, a } = await withServer(dirs, NOW, async server => ({ file: server.app.config.dbPath, a: server.app.ledger.vouchers.post(USER, { type: "opening-match", date: "2027-01-05", requestKey: "fis-kayit-d2-a", lines: pair(1300) }) }));
    legacyReset(file, "sirket-001", "2027-01-10T06:00:00.000Z");
    rawVouchers(file, [
      { id: "lv-kayit-d2-t1", no: 60, amount: 2300, trace: true },
      { id: "lv-kayit-d2-m", no: 61, amount: 3300 },
      { id: "lv-kayit-d2-t2", no: 62, amount: 4300, trace: true },
    ]);
    await withServer(dirs, NOW, async server => {
      const repair = server.app.context.voucherRepair;
      assert.deepEqual([repair?.removed, repair?.ids, repair?.kept, repair?.doubts], [1, [a.id], ["lv-kayit-d2-m"], { "lv-kayit-d2-m": "after-traced" }], `izli İLK fişten sonra yazılan izsiz fiş kalmalı (izli SON fiş sayılırsa kaldırılır): ${JSON.stringify(repair)}`);
      assert.deepEqual(idsOf(server.app.store), ["lv-kayit-d2-t1", "lv-kayit-d2-m", "lv-kayit-d2-t2"]);
      const removal = parsed("kaldırma kaydı (D2)", removedLogs(server.app.store)[0]?.detail || "");
      assert.deepEqual(removal, { ids: [a.id], removedCount: 1, resetAt: "2027-01-10T06:00:00.000Z", kept: ["lv-kayit-d2-m"], keptCount: 1 });
      await scanOf(server);
    });
  });

  it("D3: sıfırlama izinden ÖNCE ve SONRA iz — İLK iz sayılır: sıfırlama izi bir izden sonra yazılmışsa işlem geçmişini silmemiştir ⇒ izsiz fiş KALIR (son iz sıfırlamadan sonra olsa da)", async () => {
    const dirs = fresh();
    const { file, o, t1 } = await withServer(dirs, NOW, async server => {
      const V = server.app.ledger.vouchers;
      return {
        file: server.app.config.dbPath,
        o: V.post(USER, { type: "opening-match", date: "2027-01-05", requestKey: "fis-kayit-d3-o", lines: pair(1400) }),
        t1: V.post(USER, { type: "opening-match", date: "2027-01-06", requestKey: "fis-kayit-d3-t1", lines: pair(2400) }),
      };
    });
    dropTrace(file, o.id);
    writeReset(file, "sirket-001", "2027-01-10T08:00:00.000Z");
    rawVouchers(file, [{ id: "lv-kayit-d3-t2", no: 70, amount: 3400, trace: true, at: "2027-01-10T08:30:00.000Z" }]);
    await withServer(dirs, NOW, async server => {
      const repair = server.app.context.voucherRepair;
      assert.deepEqual([repair?.removed, repair?.kept, repair?.doubts], [0, [o.id], { [o.id]: "reset-without-wipe" }], `ilk iz sıfırlama izinden önce: iz işlem geçmişini silmemiş, fiş kalmalı (son iz sayılırsa kaldırılır): ${JSON.stringify(repair)}`);
      assert.deepEqual(idsOf(server.app.store), [o.id, t1.id, "lv-kayit-d3-t2"]);
      await scanOf(server);
    });
  });
});

describe("Ç2 tur 3 — integrity.mjs: açılışta bulunan sapmanın kaydı ('baseline') sınırlı, sığan kayıtta eskisiyle BAYT BAYT aynı; her açılışta yinelenmez", () => {
  let root;
  before(() => {
    root = mkdtempSync(path.join(tmpdir(), "fis-kayit-taban-"));
  });
  after(() => removeTestDir(root));
  let n = 0;
  const fresh = () => {
    n += 1;
    return { dataDir: path.join(root, `v${n}`, "data"), backupDir: path.join(root, `v${n}`, "backups") };
  };
  // Program 6 tahsilat yazar (güncel sürüm ya da v2.4.9 kendi API'siyle); kapalı sunucunun dosyasında 5 satırın tarihi uzun geçersiz metne çevrilir (eski sürümden bozuk veri
  // benzetimi) → açılışta "Tarihsiz ya da geçersiz tarihli hareket" + "İleri tarihli hareket" sapmaları (örnek 5 satır).
  const unwrap = response => (response.data && typeof response.data === "object" && "ok" in response.data ? response.data.data : response.data);
  const ok200 = async (label, promise) => {
    const response = await promise;
    assert.equal(response.status, 200, `${label}: ${response.status} ${JSON.stringify(response.data).slice(0, 300)}`);
    return unwrap(response);
  };
  const seed = async admin => {
    const account = await ok200("cari", admin.post("/api/workspace/accounts", { name: "Taban Cari", type: "customer", registeredOn: "2026-12-01" }));
    for (let i = 0; i < 6; i += 1) await ok200(`tahsilat ${i}`, admin.post(`/api/workspace/accounts/${account.id}/entries`, { kind: "in", amount: String(10 + i), date: "2027-01-05" }));
  };
  const corrupt = (file, length) => raw(file, "UPDATE account_entries SET date = ? || id WHERE id IN (SELECT id FROM account_entries ORDER BY rowid LIMIT 5)", "9".repeat(length));
  const baselines = store => store.all("SELECT detail_json AS detail FROM integrity_log WHERE action = 'baseline' ORDER BY rowid").map(row => row.detail);
  // Mutabakat Testi (bu veri bilerek sapmalı: ok false beklenir; HTTP 200 ve günlüğün ayrıştırılması denetlenir).
  const scanRaw = async server => must("Mutabakat Testi", (await loginAdmin(server)).get("/api/workspace/ledger/integrity"));

  it("20.000'i aşan taban (5 × 6.000 karakterlik bozuk tarih): kayıt geçerli JSON ve sınır içinde, her sapma alanlarıyla; Mutabakat Testi 200; ikinci açılışta yeni satır yok", async () => {
    const dirs = fresh();
    const file = await withServer(dirs, NOW, async server => {
      await seed(await loginAdmin(server));
      return server.app.config.dbPath;
    });
    corrupt(file, 6000);
    for (const turn of [1, 2]) {
      await withServer(dirs, NOW, async server => {
        const rows = baselines(server.app.store);
        assert.equal(rows.length, 1, `açılış ${turn}: tek taban kaydı (her açılışta yeni satır yazılmaz)`);
        const failures = server.app.context.integrity.run().failures;
        assert.ok(JSON.stringify(failures).length > 20_000, "ön koşul: sapmaların tam JSON'u 20.000'i aşıyor");
        assert.ok(rows[0].length <= 20_000, `${rows[0].length}`);
        const stored = parsed(`açılış ${turn}: taban kaydı`, rows[0]);
        assert.deepEqual(stored.map(item => [item.code, item.count]), failures.map(item => [item.code, item.count]), "her sapma kodu ve sayısıyla");
        assert.deepEqual(stored.map(item => Object.keys(item)), JSON.parse(JSON.stringify(failures)).map(item => Object.keys(item)), "kayıt nesnelerinin alanları kısaltılmaz (örnek listesi dahil)");
        const sample = stored.find(item => item.code === "dates:format:account_entries")?.sample || [];
        assert.ok(sample.length >= 1 && sample.length < 5 && sample.every(item => item.length > 6000), `örnek listesi kısaldı, öğeler bozulmadı: ${sample.map(item => item.length)}`);
        const scan = await scanRaw(server);
        assert.ok(scan.log.some(row => row.action === "baseline" && Array.isArray(row.detail)), "taban kaydı Mutabakat Testi'nin günlüğünde ayrıştırılmış");
      });
    }
  });

  it("sığan taban (5 × 100 karakter): kayıt JSON.stringify(sapmalar) ile BAYT BAYT aynı (eski formül `.slice(0, 20000)` ile de); ikinci açılışta yeni satır yok", async () => {
    const dirs = fresh();
    const file = await withServer(dirs, NOW, async server => {
      await seed(await loginAdmin(server));
      return server.app.config.dbPath;
    });
    corrupt(file, 100);
    for (const turn of [1, 2]) {
      await withServer(dirs, NOW, async server => {
        const rows = baselines(server.app.store);
        assert.equal(rows.length, 1, `açılış ${turn}: tek taban kaydı`);
        const plain = JSON.stringify(server.app.context.integrity.run().failures);
        assert.equal(rows[0], plain, "sığan kayıt birebir");
        assert.equal(rows[0], plain.slice(0, 20_000), "eski sürümün formülüyle de birebir (güncellemede taban satırı yinelenmez)");
      });
    }
  });

  const v249 = tagsAvailable(["v2.4.9"]) ? false : "v2.4.9 etiketi yok (git fetch --tags)";
  it("G6 v2.4.9 GERÇEK kodu: v2.4.9'un yazdığı sığan taban kaydı güncel sürümde aynen kalır (yeni satır yok); kesik (20.000'i aşan) kayıttan sonra bir kez geçerli yeni kayıt, sonra yinelenmez", { skip: v249, timeout: 180_000 }, async () => {
    for (const [length, expectRows] of [[100, [1, 1]], [6000, [2, 2]]]) {
      const dirs = fresh();
      const old = async fn => {
        const server = await bootVersion("v2.4.9", { ...dirs, now: { time: NOW, fixed: true } });
        try {
          return await fn(server);
        } finally {
          await server.close();
        }
      };
      const file = await old(async server => {
        await seed(await server.login());
        return server.app.config.dbPath;
      });
      corrupt(file, length);
      const written = await old(async server => server.app.store.all("SELECT detail_json AS detail FROM integrity_log WHERE action = 'baseline'").map(row => row.detail));
      assert.equal(written.length, 1, `uzunluk ${length}: v2.4.9 taban kaydı yazdı`);
      // Güncelleme v2.4.9'un açılışlarından SONRA (12:00, 12:30): taban kaydı `ORDER BY at DESC` ile seçilir (integrity.mjs; saat geri / aynı an BİLİNEN SINIR — §11d).
      for (const [turn, rowsAfter] of expectRows.entries()) {
        await withServer(dirs, turn === 0 ? "2027-01-10T12:00:00+03:00" : "2027-01-10T12:30:00+03:00", async server => {
          const rows = baselines(server.app.store);
          assert.equal(rows.length, rowsAfter, `uzunluk ${length}, güncel açılış ${turn + 1}: taban satırı ${rows.length} (beklenen ${rowsAfter})`);
          assert.equal(rows[0], written[0], "v2.4.9'un kaydı değişmedi");
          parsed(`uzunluk ${length}: son taban kaydı`, rows.at(-1));
          assert.ok(rows.at(-1).length <= 20_000);
        });
      }
    }
  });
});
