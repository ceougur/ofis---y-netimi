// 2.5.0 Ç2 TUR 1 — fiş defterinin korumaları (dar kontrol 05.11 22:00 bulguları; docs/erp/C2-FIS-DEFTERI-TASARIM.md §11 "Tur 1"):
//   ORTA-1  alt defter hesabına (beklenen bakiyesi olan her hesap) yazan fiş, modül kullanılmış olsun olmasın reddedilir — boş kurulumda 121 / 128 / 129 / 190 / 321 fişi
//           kabul ediliyor, modül sonradan kullanılınca Mutabakat Testi kalıcı fark veriyordu (gl:121 fark 500).
//   DÜŞÜK-1 (sakınca süzgeciyle ORTA) eski sürüm sıfırlamasının açılış onarımı yalnız AYNI şirketin sıfırlama izinden ÖNCE yazılmış fişleri kaldırır (iki şirket, iz
//           fişten önce, geri yükleme, saat dilimi eki).
//   DÜŞÜK-2 "kapanmış fiş" tetikleyicisi her satırda COUNT(*) yapmaz (O(n²) → O(n)); 12 atlatma denemesi yine engelli.
//   DÜŞÜK-3 dar kontrolün yaşayan dört mutasyonu (MA bugün tarihli fiş, MB kilit yalnız ileri, MC istek kimliği içeriğinde sınıf, MG yevmiyede alt hesap).
//   madde 5 fişin açıklama / kaynak / not alanı nesne alırsa "[object Object]" KALICI saklanıyordu → 400.
//   madde 6 postAll lockThrough PUT period-lock'un ön adımından (POS kalemleri; 409 bank-pending-before-lock, force) geçer.
// Saat SAHTE ve sabit (ders 13, 22). İki saat diliminde koşulur (TZ=UTC, TZ=Europe/Istanbul). Gerçek dış servis yok (lisans adresi 127.0.0.1:9; ders 30).
// WINDOWS (ders 48): K5 testleri kapalı sunucunun dosyasını ayrı bağlantıyla değiştirir ve 001'i yedekten geri yükler (dosya takası) — Windows CI'de ayrıca görülür.
import assert from "node:assert/strict";
import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { performance } from "node:perf_hooks";
import { DatabaseSync } from "node:sqlite";
import { after, before, describe, it } from "node:test";
import { LEDGER_VOUCHERS_SCHEMA_V46, LEDGER_VOUCHER_TRIGGERS_V46 } from "../server/lib/migrations.mjs";
import { BANK, TODAY, bootBank, expectStatus, must as mustBank, openAcceptanceAccounts, openPos, ziraatPos } from "./banka-220-pos-ortak.mjs";
import { ADMIN_PASSWORD, loginAdmin, removeTestDir, startTestServer } from "./helpers.mjs";

const NOW = "2027-01-10T10:00:00+03:00";
const USER = { id: "fis-koruma", display_name: "Fiş Koruma" };
const pair = (amount, debit = "590", credit = "519") => [{ account: debit, debit: amount }, { account: credit, credit: amount }];
let seq = 0;
const key = tag => `fis-koruma-${tag}-${(seq += 1)}`;
const must = async (label, promise) => {
  const response = await promise;
  assert.equal(response.status, 200, `${label}: ${response.status} ${JSON.stringify(response.data).slice(0, 400)}`);
  return response.data.data;
};
const rejects = (fn, status, code, text = "") => {
  assert.throws(fn, error => {
    assert.equal(error?.status, status, `beklenen ${status}, gelen ${error?.status}: ${error?.message}`);
    if (code) assert.equal(error?.extra?.code, code, `beklenen kod ${code}, gelen ${error?.extra?.code}: ${error?.message}`);
    if (text) assert.match(error.message, text);
    return true;
  });
};
const countOf = (store, table, where = "") => store.get(`SELECT COUNT(*) AS n FROM ${table}${where ? ` WHERE ${where}` : ""}`).n;

// Bakiyesi bir alt defterden gelen hesaplar — KÂHİN: tasarım notu §10 K6'nın ÖNCEDEN yazılmış listesi (kodu türeten elden değil; 05.11). 153 bilerek yok: dönemsel envanterde
// stokun beklenen bakiyesi yoktur ve kural kitabı N-01 (dönem sonu stok değerlemesi) 153'e fişle yazar (BAŞ MİMAR KARARI önerisi, §11).
const SUBLEDGER = ["100", "101", "102", "103", "108", "120", "121", "127", "128", "129", "190", "191", "193", "300", "309", "320", "321", "336", "360", "391"];
const FREE = ["153", "500", "519", "570", "580", "590", "591", "600", "602", "621", "631", "690", "761", "770"];

describe("Ç2 tur 1 — ORTA-1: alt defter hesabına fiş yazılmaz (boş kurulum; modül kullanılmış olsun olmasın)", () => {
  let server;
  let admin;
  let V;
  before(async () => {
    // Üretim kipi (gateVerify kapalı): kalıcı fark bu kipte görülmüştü (dar kontrol p1b / p1c).
    server = await startTestServer({ now: { time: NOW, fixed: true }, gateVerify: false });
    admin = await loginAdmin(server);
    V = server.app.ledger.vouchers;
  });
  after(() => server?.close());

  it("boş kurulumda alt defterin 20 hesabının her birine (hesap ya da alt hesabıyla) yazan fiş 400 voucher-subledger-account; hiçbir fiş yazılmaz, numara tüketilmez", () => {
    const store = server.app.store;
    const accepted = [];
    const other = [];
    for (const account of SUBLEDGER) {
      for (const [side, lines] of [["borç", [{ account, debit: 1000 }, { account: "519", credit: 1000 }]], ["alacak", [{ account: "590", debit: 1000 }, { account, credit: 1000 }]]]) {
        try {
          const voucher = V.post(USER, { type: "opening-match", date: "2027-01-05", requestKey: key(`k6-${account}-${side === "borç" ? "b" : "a"}`), lines });
          accepted.push(`${account} ${side} (${voucher.noText})`);
        } catch (error) {
          if (error?.status !== 400 || error?.extra?.code !== "voucher-subledger-account" || !/fişle yazılmaz/.test(error.message)) other.push(`${account} ${side}: ${error?.status} ${error?.extra?.code || ""} ${String(error?.message).slice(0, 60)}`);
        }
      }
    }
    // Önce kabul edilenler (dar kontrol ORTA-1'in iddiası), sonra reddin biçimi (kapının 409'u değil, fiş denetiminin 400'ü).
    assert.deepEqual(accepted, [], `alt defter hesabına fiş KABUL edildi (K6 iddiası): ${accepted.join(", ")}`);
    assert.deepEqual(other, [], `alt defter hesabı fiş denetiminde değil başka yolla reddedildi: ${other.join(" | ")}`);
    rejects(() => V.post(USER, { type: "opening-match", date: "2027-01-05", requestKey: key("k6-alt"), lines: [{ account: "102", sub: "102.01", debit: 500 }, { account: "519", credit: 500 }] }), 400, "voucher-subledger-account");
    rejects(() => V.post(USER, { type: "closing", date: "2027-01-05", requestKey: key("k6-cari"), lines: [{ account: "120", party: "cari-yok", debit: 500 }, { account: "690", credit: 500 }] }), 400, "voucher-subledger-account");
    assert.equal(countOf(store, "ledger_vouchers"), 0);
    const first = V.post(USER, { type: "opening-match", date: "2027-01-05", requestKey: key("k6-ilk"), lines: pair(10) });
    assert.equal(first.no, 1, "reddedilen fişler numara tüketmedi");
  });

  it("alt defter dışındaki hesaplar (153 dahil: N-01 dönem sonu stok değerlemesi) fişle yazılır", () => {
    for (const account of FREE) {
      const lines = account === "519" ? pair(700, "590", "519") : [{ account, debit: 700 }, { account: "519", credit: 700 }];
      const voucher = V.post(USER, { type: "opening-match", date: "2027-01-06", requestKey: key(`serbest-${account}`), lines });
      V.reverse(USER, voucher.id, { requestKey: key(`serbest-${account}-r`) });
    }
  });

  it("dar kontrol p1b / p1c: boş kurulumda 121 fişi reddedilir → ilk senet girişi 200 → dönem kilidi 200 → Mutabakat Testi tutarlı (kalıcı fark yok)", async () => {
    rejects(() => V.post(USER, { type: "opening-match", date: "2027-01-05", requestKey: key("p1b-121"), lines: [{ account: "121", debit: 50000 }, { account: "519", credit: 50000 }] }), 400, "voucher-subledger-account");
    const note = await admin.post("/api/workspace/cheques", { direction: "in", instrument: "note", amount: "300", issueDate: "2027-01-06", dueDate: "2027-03-01", drawer: "Borçlu A", serialNo: "KORUMA-S1" });
    assert.equal(note.status, 200, JSON.stringify(note.data).slice(0, 300));
    assert.equal((await admin.put("/api/admin/period-lock", { lockedUntil: "2027-01-07" })).status, 200);
    const scan = await must("Mutabakat Testi", admin.get("/api/workspace/ledger/integrity"));
    assert.equal(scan.ok, true, JSON.stringify(scan.checks.filter(item => !item.ok)));
    assert.equal((await admin.put("/api/admin/period-lock", { lockedUntil: "" })).status, 200);
  });
});

describe("Ç2 tur 1 — DÜŞÜK-3: MA bugün tarihli fiş, MB kilit yalnız ileri, MC istek kimliğinde sınıf, MG yevmiyede alt hesap", () => {
  let server;
  let admin;
  let V;
  before(async () => {
    server = await startTestServer({ now: { time: NOW, fixed: true } });
    admin = await loginAdmin(server);
    V = server.app.ledger.vouchers;
  });
  after(() => server?.close());

  it("MA: bugün tarihli fiş yazılır (yalnız yarın ve sonrası 400)", () => {
    const today = server.app.period.today();
    assert.equal(today, "2027-01-10");
    const voucher = V.post(USER, { type: "opening-match", date: today, requestKey: key("ma-bugun"), lines: pair(100) });
    assert.equal(voucher.date, today);
    rejects(() => V.post(USER, { type: "opening-match", date: "2027-01-11", requestKey: key("ma-yarin"), lines: pair(100) }), 400, "date-future");
  });

  it("MB: yinelenen kapanış kilidi geri çekmez — kilit sonradan ileri alındıysa aynı kapanışın yinelenmesi kilidi ve izi değiştirmez", async () => {
    const closing = { type: "closing", date: "2026-12-31", description: "MB kapanış", requestKey: key("mb-kapanis"), lines: pair(900, "602", "690") };
    V.postAll(USER, [closing], { lockThrough: "2026-12-31" });
    assert.equal(server.app.period.lockedUntil(), "2026-12-31");
    assert.equal((await admin.put("/api/admin/period-lock", { lockedUntil: "2027-01-05" })).status, 200);
    const traces = () => countOf(server.app.store, "audit_events", "type = 'ledger.period.locked'");
    const before = traces();
    const replay = V.postAll(USER, [{ ...closing, lines: closing.lines.map(line => ({ ...line })) }], { lockThrough: "2026-12-31" });
    assert.deepEqual(replay.map(item => item.replayed), [true]);
    assert.equal(server.app.period.lockedUntil(), "2027-01-05", "kilit geri gitmedi");
    assert.equal(traces(), before, "yeni kilit izi yok");
    assert.equal((await admin.put("/api/admin/period-lock", { lockedUntil: "" })).status, 200);
  });

  it("MC: aynı istek kimliği, yalnız sınıfı farklı (closing ↔ period-end) → 409 request-id-reused (yeni fiş yok)", () => {
    const input = { type: "closing", date: "2027-01-04", description: "MC", requestKey: key("mc"), lines: pair(300, "621", "153") };
    const first = V.post(USER, input);
    assert.equal(first.cls, "closing");
    rejects(() => V.post(USER, { ...input, cls: "period-end" }), 409, "request-id-reused");
    assert.equal(countOf(server.app.store, "ledger_vouchers", `request_key = '${input.requestKey}'`), 1);
  });

  it("MG: fiş satırının alt hesabı yevmiyede (Ana Defter maddesi ve Yevmiye Defteri raporu) aynen görünür", async () => {
    const voucher = V.post(USER, { type: "opening-match", date: "2027-01-03", requestKey: key("mg"), lines: [{ account: "590", sub: "590.07", debit: 4200 }, { account: "519", credit: 4200 }] });
    const entry = server.app.ledger.build().find(item => item.id.endsWith(`:${voucher.id}`));
    assert.ok(entry, "fiş maddesi yevmiyede");
    assert.deepEqual(entry.lines.map(line => [line.account, line.sub || "", line.debit, line.credit]), [["590", "590.07", 4200, 0], ["519", "", 0, 4200]]);
    const report = await admin.get("/api/workspace/report-center/yevmiye?preset=all");
    assert.equal(report.status, 200);
    const rows = (report.data.data ?? report.data).rows;
    assert.ok(rows.some(row => row[3] === "590.07" && /Fiş 2027-/.test(row[2])), `alt hesap satırı Yevmiye Defteri'nde: ${JSON.stringify(rows.filter(row => /Fiş/.test(row[2])).slice(0, 4))}`);
  });
});

describe("Ç2 tur 1 — madde 5: fişin metin alanları nesne / dizi almaz ([object Object] kalıcı saklanmaz)", () => {
  let server;
  let admin;
  let V;
  before(async () => {
    server = await startTestServer({ now: { time: NOW, fixed: true } });
    admin = await loginAdmin(server);
    V = server.app.ledger.vouchers;
  });
  after(() => server?.close());

  it("ters kayıt ucu: açıklama nesne ya da dizi → 400 voucher-text, ters kayıt yazılmaz; metin açıklama saklanır", async () => {
    const voucher = V.post(USER, { type: "opening-match", date: "2027-01-05", requestKey: key("metin"), lines: pair(100) });
    for (const [tag, description] of [["nesne", { x: 1 }], ["dizi", ["a", "b"]], ["mantiksal", true]]) {
      const response = await admin.post(`/api/admin/ledger/vouchers/${voucher.id}/reverse`, { requestId: `fis-koruma-${tag}-0000000001`, description });
      assert.equal(response.status, 400, `${tag}: ${response.status} ${JSON.stringify(response.data)}`);
      assert.equal(response.data.code, "voucher-text", tag);
    }
    assert.equal(countOf(server.app.store, "ledger_vouchers", `reversal_of = '${voucher.id}'`), 0);
    const ok = await must("metin açıklama", admin.post(`/api/admin/ledger/vouchers/${voucher.id}/reverse`, { requestId: "fis-koruma-metin-00000001", description: "Yanlış tutar düzeltmesi" }));
    assert.equal(server.app.store.get("SELECT description FROM ledger_vouchers WHERE id = ?", ok.voucher.id).description, "Yanlış tutar düzeltmesi");
  });

  it("iç API: açıklama, kaynak ya da satır notu nesne → 400 voucher-text", () => {
    rejects(() => V.post(USER, { type: "opening-match", date: "2027-01-05", requestKey: key("ic-aciklama"), description: { a: 1 }, lines: pair(100) }), 400, "voucher-text");
    rejects(() => V.post(USER, { type: "opening-match", date: "2027-01-05", requestKey: key("ic-kaynak"), source: { a: 1 }, lines: pair(100) }), 400, "voucher-text");
    rejects(() => V.post(USER, { type: "opening-match", date: "2027-01-05", requestKey: key("ic-not"), lines: [{ account: "590", debit: 100, note: ["x"] }, { account: "519", credit: 100 }] }), 400, "voucher-text");
    assert.equal(countOf(server.app.store, "ledger_vouchers", "description LIKE '%[object%' OR source LIKE '%[object%'"), 0);
  });
});

describe("Ç2 tur 1 — DÜŞÜK-2: \"kapanmış fiş\" tetikleyicisi doğrusal; 12 atlatma denemesi yine engelli", () => {
  it("dar kontrolün 12 atlatma denemesi (programın dosyasında, ayrı bağlantı) engelli; fiş verisi değişmez; dış bağlantının yarım fişi yalnız eksik sırasıyla tamamlanır", async () => {
    const server = await startTestServer({ now: { time: NOW, fixed: true } });
    try {
      const v = server.app.ledger.vouchers.post(USER, { type: "closing", date: "2027-01-05", requestKey: "koruma-tetik-1", lines: [{ account: "602", debit: 1000 }, { account: "690", credit: 1000 }] });
      const db = new DatabaseSync(server.app.config.dbPath);
      try {
        db.exec("PRAGMA busy_timeout = 5000");
        const snap = () => JSON.stringify(db.prepare("SELECT v.id, v.no, v.type, v.line_count, v.total_minor, v.description, l.seq, l.account, l.debit_minor, l.credit_minor FROM ledger_vouchers v JOIN ledger_voucher_lines l ON l.voucher_id = v.id ORDER BY v.rowid, l.seq").all());
        const before = snap();
        const tries = [
          ["UPDATE başlık", `UPDATE ledger_vouchers SET total_minor = 2000 WHERE id = '${v.id}'`],
          ["UPDATE OR REPLACE başlık", `UPDATE OR REPLACE ledger_vouchers SET description = 'x' WHERE id = '${v.id}'`],
          ["UPDATE satır", `UPDATE ledger_voucher_lines SET debit_minor = 2000 WHERE voucher_id = '${v.id}' AND seq = 1`],
          ["DELETE başlık", `DELETE FROM ledger_vouchers WHERE id = '${v.id}'`],
          ["DELETE satır", `DELETE FROM ledger_voucher_lines WHERE voucher_id = '${v.id}'`],
          ["DELETE tüm tablo", "DELETE FROM ledger_voucher_lines"],
          ["REPLACE INTO başlık (aynı id)", `REPLACE INTO ledger_vouchers (id, year, no, date, type, journal_class, request_key, line_count, total_minor, created_by, created_at) VALUES ('${v.id}', 2027, 1, '2027-01-05', 'closing', 'closing', 'koruma-tetik-1', 2, 1000, 'x', 'x')`],
          ["INSERT OR REPLACE başlık (yeni id, aynı yıl + no)", "INSERT OR REPLACE INTO ledger_vouchers (id, year, no, date, type, journal_class, request_key, line_count, total_minor, created_by, created_at) VALUES ('yeni-1', 2027, 1, '2027-01-05', 'closing', 'closing', 'baska-anahtar-1', 2, 1000, 'x', 'x')"],
          ["INSERT OR REPLACE satır (aynı birincil anahtar)", `INSERT OR REPLACE INTO ledger_voucher_lines (voucher_id, seq, account, debit_minor, credit_minor) VALUES ('${v.id}', 1, '602', 5000, 0)`],
          ["UPSERT satır", `INSERT INTO ledger_voucher_lines (voucher_id, seq, account, debit_minor, credit_minor) VALUES ('${v.id}', 1, '602', 5000, 0) ON CONFLICT (voucher_id, seq) DO UPDATE SET debit_minor = excluded.debit_minor`],
          ["UPSERT başlık", `INSERT INTO ledger_vouchers (id, year, no, date, type, journal_class, request_key, line_count, total_minor, created_by, created_at) VALUES ('${v.id}', 2027, 9, '2027-01-05', 'closing', 'closing', 'k-9', 2, 1000, 'x', 'x') ON CONFLICT (id) DO UPDATE SET total_minor = 7777`],
          ["INSERT OR IGNORE satır (yeni sıra 3)", `INSERT OR IGNORE INTO ledger_voucher_lines (voucher_id, seq, account, debit_minor, credit_minor) VALUES ('${v.id}', 3, '602', 5000, 0)`],
        ];
        const passed = [];
        for (const [name, sql] of tries) {
          try {
            db.exec(sql);
            passed.push(name);
          } catch (error) {
            assert.match(error.message, /değiştirilemez|silinemez|ikinci kez|fiş kapalı/, `${name}: ${error.message}`);
          }
        }
        assert.deepEqual(passed, [], `atlatan deneme: ${passed.join(", ")}`);
        assert.equal(snap(), before, "fiş verisi değişmedi");
        // Dış bağlantının yarım fişi (başlık 3 satır, 2 satır yazılmış): eski kuralla aynı — eksik sıra (3) eklenir, sonra fiş kapanır (4. sıra ve aynı sıra reddedilir).
        db.exec("BEGIN; INSERT INTO ledger_vouchers (id, year, no, date, type, journal_class, request_key, line_count, total_minor, created_by, created_at) VALUES ('yarim-1', 2027, 50, '2027-01-06', 'closing', 'closing', 'yarim-anahtar-1', 3, 1000, 'x', 'x'); INSERT INTO ledger_voucher_lines (voucher_id, seq, account, debit_minor, credit_minor) VALUES ('yarim-1', 1, '602', 1000, 0); INSERT INTO ledger_voucher_lines (voucher_id, seq, account, debit_minor, credit_minor) VALUES ('yarim-1', 2, '690', 0, 600); COMMIT;");
        db.exec("INSERT INTO ledger_voucher_lines (voucher_id, seq, account, debit_minor, credit_minor) VALUES ('yarim-1', 3, '690', 0, 400)");
        assert.throws(() => db.exec("INSERT INTO ledger_voucher_lines (voucher_id, seq, account, debit_minor, credit_minor) VALUES ('yarim-1', 4, '690', 0, 1)"), /fiş kapalı/);
        assert.throws(() => db.exec("INSERT OR REPLACE INTO ledger_voucher_lines (voucher_id, seq, account, debit_minor, credit_minor) VALUES ('yarim-1', 3, '690', 0, 1)"), /fiş kapalı/);
        assert.throws(() => db.exec("INSERT INTO ledger_voucher_lines (voucher_id, seq, account, debit_minor, credit_minor) VALUES ('fis-yok', 1, '690', 0, 1)"), /fiş kapalı|FOREIGN KEY/);
      } finally {
        db.close();
      }
    } finally {
      await server.close();
    }
  });

  it("24.000 satırlık fişin satırları (yalnız tetikleyiciler, bellek içi) 2 sn'den kısa sürede yazılır — eski kural (her satırda COUNT(*)) O(n²): 16.000 satır ≈ 4 sn ölçüldü", () => {
    const n = 24_000;
    const db = new DatabaseSync(":memory:");
    try {
      db.exec(LEDGER_VOUCHERS_SCHEMA_V46);
      db.exec(LEDGER_VOUCHER_TRIGGERS_V46);
      db.exec("BEGIN");
      db.prepare("INSERT INTO ledger_vouchers (id, year, no, date, type, journal_class, request_key, line_count, total_minor, created_by, created_at) VALUES ('v', 2027, 1, '2027-01-05', 'opening-match', 'opening', 'k-00000001', ?, ?, 'x', 'x')").run(n, (n / 2) * 100);
      const insert = db.prepare("INSERT INTO ledger_voucher_lines (voucher_id, seq, account, debit_minor, credit_minor) VALUES ('v', ?, ?, ?, ?)");
      const started = performance.now();
      for (let i = 0; i < n; i += 1) insert.run(i + 1, i % 2 ? "519" : "590", i % 2 ? 0 : 100, i % 2 ? 100 : 0);
      const ms = performance.now() - started;
      db.exec("COMMIT");
      assert.equal(db.prepare("SELECT COUNT(*) AS n FROM ledger_voucher_lines").get().n, n);
      assert.ok(ms < 2000, `${n} satır ${Math.round(ms)} ms (≥ 2000 ms: tetikleyici satır başına fişin bütün satırlarını okuyor — O(n²))`);
      assert.throws(() => insert.run(n + 1, "590", 1, 0), /fiş kapalı/, "fiş dolunca satır eklenmez");
    } finally {
      db.close();
    }
  });
});

describe("Ç2 tur 1 — DÜŞÜK-1 (ORTA): eski sürüm sıfırlamasının onarımı yalnız AYNI şirketin sıfırlama izinden önce yazılmış fişi kaldırır", () => {
  let root;
  before(() => {
    root = mkdtempSync(path.join(tmpdir(), "fis-koruma-k5-"));
  });
  after(() => removeTestDir(root));
  let n = 0;
  const fresh = () => {
    n += 1;
    return { dataDir: path.join(root, `v${n}`, "data"), backupDir: path.join(root, `v${n}`, "backups") };
  };
  const open = (dirs, time = NOW, extra = {}) => startTestServer({ now: { time, fixed: true }, ...dirs, maxCompanies: 2, ...extra });
  // Kapalı sunucunun dosyasında (ayrı bağlantı): fiş izleri "bilinmeyen nedenle" düşer ve / ya da eski sürümün sıfırlaması gibi bir "company.reset" izi yazılır.
  const raw = (file, sql, ...args) => {
    const db = new DatabaseSync(file);
    try {
      db.prepare(sql).run(...args);
    } finally {
      db.close();
    }
  };
  const dropTraces = file => raw(file, "DELETE FROM audit_events WHERE type = 'ledger.voucher.created'");
  const writeReset = (file, entity, at) => raw(file, "INSERT INTO audit_events (id, type, entity_id, actor_id, actor_name, payload_json, created_at) VALUES (?, 'company.reset', ?, 'user-admin', 'Yönetici', '{\"mode\":\"movements\"}', ?)", `event-eski-${entity}-${at}`, entity, at);
  const idsOf = store => store.all("SELECT id FROM ledger_vouchers ORDER BY rowid").map(row => row.id);

  it("iki şirket (dar kontrol p5): 001'in izsiz fişi, 002 sıfırlanınca 001'in dosyasına düşen 'company.reset' (entity 002) yüzünden KALDIRILMAZ", async () => {
    const dirs = fresh();
    let server = await open(dirs);
    let admin = await loginAdmin(server);
    let second = await must("002", admin.post("/api/companies", { name: "Koruma İkinci", select: false }));
    second = second.company || second;
    const file = server.app.config.dbPath;
    const voucher = server.app.ledger.vouchers.post(USER, { type: "opening-match", date: "2027-01-02", requestKey: "koruma-k5-p5-001", lines: pair(9900) });
    await server.close();
    dropTraces(file);
    server = await open(dirs);
    try {
      assert.deepEqual(server.app.context.voucherRepair?.removed, 0, JSON.stringify(server.app.context.voucherRepair));
      admin = await loginAdmin(server);
      await must("002 aç", admin.get(`/api/workspace/ledger?hofCompany=${encodeURIComponent(second.id)}`));
      await must("002 sıfırla", admin.post(`/api/companies/${second.id}/reset`, { mode: "movements", confirm: second.code, password: ADMIN_PASSWORD }));
    } finally {
      await server.close();
    }
    server = await open(dirs);
    try {
      const repair = server.app.context.voucherRepair;
      assert.deepEqual(idsOf(server.app.store), [voucher.id], `başka şirketin sıfırlaması 001'in fişini kaldırmamalı: ${JSON.stringify(repair)}`);
      assert.equal(repair?.removed, 0);
      assert.deepEqual(repair?.kept, [voucher.id]);
    } finally {
      await server.close();
    }
  });

  it("zaman: sıfırlama izinden ÖNCE yazılan izsiz fiş kaldırılır, SONRA yazılan (izi başka nedenle düşmüş) fiş kalır; günlükte kalan sayısı", async () => {
    const dirs = fresh();
    let server = await open(dirs, "2027-01-08T10:00:00+03:00");
    const file = server.app.config.dbPath;
    const early = server.app.ledger.vouchers.post(USER, { type: "opening-match", date: "2027-01-07", requestKey: "koruma-k5-zaman-once", lines: pair(1100) });
    await server.close();
    server = await open(dirs);
    const late = server.app.ledger.vouchers.post(USER, { type: "opening-match", date: "2027-01-10", requestKey: "koruma-k5-zaman-sonra", lines: pair(2200) });
    await server.close();
    dropTraces(file);
    writeReset(file, "sirket-001", "2027-01-09T07:00:00.000Z");
    server = await open(dirs);
    try {
      const repair = server.app.context.voucherRepair;
      assert.deepEqual(idsOf(server.app.store), [late.id], `yalnız sıfırlamadan önceki fiş kaldırılmalı: ${JSON.stringify(repair)}`);
      assert.deepEqual([repair?.removed, repair?.ids, repair?.kept], [1, [early.id], [late.id]]);
      const log = server.app.store.get("SELECT summary, detail_json AS detail FROM integrity_log WHERE action = 'repair' AND tables = 'ledger_vouchers'");
      assert.match(log?.summary || "", /artakalan 1 fiş kaldırıldı/);
      assert.deepEqual(JSON.parse(log.detail).kept, [late.id]);
      const scan = await must("Mutabakat Testi", (await loginAdmin(server)).get("/api/workspace/ledger/integrity"));
      assert.equal(scan.ok, true, JSON.stringify(scan.checks.filter(item => !item.ok)));
    } finally {
      await server.close();
    }
  });

  it("saat dilimi eki: sıfırlama izi '+03:00' ekli (06:30Z) — 05:00Z'deki fiş kaldırılır, 07:00Z'deki kalır (an karşılaştırması; metin karşılaştırması 07:00Z'yi de silerdi)", async () => {
    const dirs = fresh();
    let server = await open(dirs, "2027-01-10T08:00:00+03:00");
    const file = server.app.config.dbPath;
    const early = server.app.ledger.vouchers.post(USER, { type: "opening-match", date: "2027-01-10", requestKey: "koruma-k5-tz-once", lines: pair(1300) });
    await server.close();
    server = await open(dirs);
    const late = server.app.ledger.vouchers.post(USER, { type: "opening-match", date: "2027-01-10", requestKey: "koruma-k5-tz-sonra", lines: pair(2400) });
    await server.close();
    assert.equal(early.createdAt, "2027-01-10T05:00:00.000Z");
    assert.equal(late.createdAt, "2027-01-10T07:00:00.000Z");
    dropTraces(file);
    writeReset(file, "sirket-001", "2027-01-10T09:30:00+03:00");
    server = await open(dirs);
    try {
      assert.deepEqual(idsOf(server.app.store), [late.id], JSON.stringify(server.app.context.voucherRepair));
    } finally {
      await server.close();
    }
  });

  it("geri yükleme: 002 sıfırlandıktan sonra alınan 001 yedeği (izsiz fiş + entity 002 sıfırlama izi) geri yüklenince 001'in fişi kalır; yedekten sonraki fiş gider", async () => {
    const dirs = fresh();
    let server = await open(dirs);
    let admin = await loginAdmin(server);
    let second = await must("002", admin.post("/api/companies", { name: "Koruma Geri Yükleme", select: false }));
    second = second.company || second;
    const file = server.app.config.dbPath;
    const kept = server.app.ledger.vouchers.post(USER, { type: "opening-match", date: "2027-01-02", requestKey: "koruma-k5-gy-001", lines: pair(5100) });
    await server.close();
    dropTraces(file);
    server = await open(dirs);
    let backup;
    try {
      admin = await loginAdmin(server);
      await must("002 aç", admin.get(`/api/workspace/ledger?hofCompany=${encodeURIComponent(second.id)}`));
      await must("002 sıfırla", admin.post(`/api/companies/${second.id}/reset`, { mode: "all", confirm: second.code, password: ADMIN_PASSWORD }));
      assert.ok(countOf(server.app.store, "audit_events", `type = 'company.reset' AND entity_id = '${second.id}'`) >= 1, "001'in dosyasında 002'nin sıfırlama izi");
      backup = (await must("001 yedek", admin.post("/api/admin/backups", { scope: "one", companyId: "sirket-001" }))).backups[0].name;
      server.app.ledger.vouchers.post(USER, { type: "opening-match", date: "2027-01-03", requestKey: "koruma-k5-gy-sonra", lines: pair(6200) });
      await must("001 geri yükle", admin.post("/api/admin/backups/restore", { name: backup, company: "sirket-001", confirm: "001", password: ADMIN_PASSWORD }));
    } finally {
      await server.close();
    }
    server = await open(dirs);
    try {
      assert.deepEqual(idsOf(server.app.store), [kept.id], `geri yüklenen 001'de yalnız yedekteki fiş: ${JSON.stringify(server.app.context.voucherRepair)}`);
      const scan = await must("Mutabakat Testi", (await loginAdmin(server)).get("/api/workspace/ledger/integrity"));
      assert.equal(scan.ok, true, JSON.stringify(scan.checks.filter(item => !item.ok)));
    } finally {
      await server.close();
    }
  });
});

describe("Ç2 tur 1 — madde 6: postAll lockThrough PUT period-lock'un ön adımından (POS) geçer", () => {
  const USERP = { id: "fis-koruma-pos", display_name: "Fiş Koruma POS" };
  async function world(settleMode) {
    const ctx = await bootBank();
    const acc = await openAcceptanceAccounts(ctx.api);
    const abc = await mustBank("ABC", ctx.api.post("/api/workspace/accounts", { name: "ABC Ltd.", type: "customer", registeredOn: "2026-10-01" }));
    const pos = await openPos(ctx.api, ziraatPos(acc.ziraat.id, { settleMode }));
    await mustBank("POS satışı", ctx.api.post(`/api/workspace/accounts/${abc.id}/entries`, { kind: "in", method: "card", date: TODAY, amount: "1.000" }));
    ctx.server.clock.set("2026-10-14T10:00:00+03:00");
    return { ctx, pos };
  }
  const settlements = ctx => ctx.store.all("SELECT date, value_date AS valueDate, description FROM fin_events WHERE type = 'pos_settlement' ORDER BY rowid");
  const closing = tag => ({ type: "closing", date: "2026-10-12", description: "Kapanış", requestKey: `fis-koruma-pos-${tag}`, lines: [{ account: "602", debit: 100 }, { account: "690", credit: 100 }] });

  it("Elle Onay kipi: valörü gelmiş bekleyen kalem varken 409 bank-pending-before-lock (fiş ve kilit yok); force → kilit konur, kalem kilit + 1'e Gecikmeli Aktarım (PUT 'Yine de Kilitle' ile aynı)", async () => {
    const w = await world("manual");
    try {
      const V = w.ctx.app.ledger.vouchers;
      rejects(() => V.postAll(USERP, [closing("elle-1")], { lockThrough: "2026-10-12" }), 409, "bank-pending-before-lock");
      assert.equal(countOf(w.ctx.store, "ledger_vouchers"), 0);
      assert.equal(w.ctx.app.period.lockedUntil(), "");
      const written = V.postAll(USERP, [closing("elle-2")], { lockThrough: "2026-10-12", force: true });
      assert.equal(written.length, 1);
      assert.equal(w.ctx.app.period.lockedUntil(), "2026-10-12");
      await mustBank("otomatik", w.ctx.api.put(`${BANK}/pos/${w.pos.id}`, { settleMode: "auto" }));
      await mustBank("Şimdi Aktar", w.ctx.api.post(`${BANK}/settle`, {}));
      const [row] = settlements(w.ctx);
      assert.deepEqual([row?.date, row?.valueDate], ["2026-10-13", "2026-10-12"]);
      assert.match(row.description, /Gecikmeli Aktarım/);
    } finally {
      await w.ctx.server.close();
    }
  });

  it("Otomatik kip: vadesi gelmiş kalem kilitten ÖNCE kendi valör gününe (12.10) aktarılır (PUT period-lock ile aynı), sonra fiş + kilit", async () => {
    const w = await world("auto");
    try {
      const response = await w.ctx.api.put("/api/admin/period-lock", { lockedUntil: "2026-10-11" });
      expectStatus(response, 200, undefined, "11.10 kilidi (kalem 12.10 valörlü: kapsam dışı)");
      assert.deepEqual(settlements(w.ctx), [], "kilitlenecek döneme düşmeyen kalem aktarılmadı");
      w.ctx.app.ledger.vouchers.postAll(USERP, [closing("oto")], { lockThrough: "2026-10-12" });
      assert.deepEqual(settlements(w.ctx).map(row => [row.date, row.valueDate]), [["2026-10-12", "2026-10-12"]], "kilitten önce kendi gününe aktarıldı");
      assert.equal(w.ctx.app.period.lockedUntil(), "2026-10-12");
      assert.equal(countOf(w.ctx.store, "pos_items", "status = 'pending' AND value_date <= '2026-10-12'"), 0);
      const scan = await mustBank("Mutabakat Testi", w.ctx.api.get("/api/workspace/ledger/integrity"));
      assert.equal(scan.ok, true, JSON.stringify(scan.checks?.filter(item => !item.ok)));
    } finally {
      await w.ctx.server.close();
    }
  });
});
