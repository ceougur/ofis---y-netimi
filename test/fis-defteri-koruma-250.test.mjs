// 2.5.0 Ç2 TUR 1 — fiş defterinin korumaları (dar kontrol 05.11 22:00 bulguları; docs/erp/C2-FIS-DEFTERI-TASARIM.md §11 "Tur 1"):
//   ORTA-1  alt defter hesabına (beklenen bakiyesi olan her hesap) yazan fiş, modül kullanılmış olsun olmasın reddedilir — boş kurulumda 121 / 128 / 129 / 190 / 321 fişi
//           kabul ediliyor, modül sonradan kullanılınca Mutabakat Testi kalıcı fark veriyordu (gl:121 fark 500).
//   DÜŞÜK-1 (sakınca süzgeciyle ORTA) eski sürüm sıfırlamasının açılış onarımı yalnız AYNI şirketin sıfırlama izinden ÖNCE yazılmış fişleri kaldırır (iki şirket, iz
//           fişten önce, geri yükleme, saat dilimi eki).
//   DÜŞÜK-2 "kapanmış fiş" tetikleyicisi her satırda COUNT(*) yapmaz (O(n²) → O(n)); 12 atlatma denemesi yine engelli.
//   DÜŞÜK-3 dar kontrolün yaşayan dört mutasyonu (MA bugün tarihli fiş, MB kilit yalnız ileri, MC istek kimliği içeriğinde sınıf, MG yevmiyede alt hesap).
//   madde 5 fişin açıklama / kaynak / not alanı nesne alırsa "[object Object]" KALICI saklanıyordu → 400.
//   madde 6 postAll lockThrough PUT period-lock'un ön adımından (POS kalemleri; 409 bank-pending-before-lock, force) geçer.
// Ç2 TUR 2 (dar kontrol 06.11 04:58 B1 / B2): onarımın "sıfırlamadan önce" kararı DUVAR SAATİYLE değil YAZIM SIRASIYLA (saat geri / ileri, iki şirket, geri yükleme, iki TZ);
//   çift kuralı İKİ YÖNLÜ (asıl fiş ve ters kaydı birlikte kalır / gider; kuşkuda ikisi de kalır); kaldırılmayan kuşkulu fiş Mutabakat Günlüğü'nde görünür (bir kez).
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

// ---- K5 (eski sürüm sıfırlamasının açılış onarımı) yardımcıları — tur 1 ve tur 2 ortak ----
// Her açılış kendi finally'sinde kapanır: adım düşse de sunucu açık kalmaz (mutasyon taraması bir adım düşünce dosyanın asılı kaldığını gösterdi).
const withServer = async (dirs, time, fn) => {
  const server = await startTestServer({ now: { time, fixed: true }, ...dirs, maxCompanies: 2 });
  try {
    return await fn(server);
  } finally {
    await server.close();
  }
};
const company = async (server, name) => {
  const created = await must("002", (await loginAdmin(server)).post("/api/companies", { name, select: false }));
  return created.company || created;
};
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
const dropTrace = (file, id) => raw(file, "DELETE FROM audit_events WHERE type = 'ledger.voucher.created' AND entity_id = ?", id);
// İşlem geçmişini SİLMEDEN eklenen sıfırlama izi (001'in dosyası ortak katmandır: 2.4.9'un rotası başka şirketin sıfırlamasını oraya da yazar).
const writeReset = (file, entity, at) => raw(file, "INSERT INTO audit_events (id, type, entity_id, actor_id, actor_name, payload_json, created_at) VALUES (?, 'company.reset', ?, 'user-admin', 'Yönetici', '{\"mode\":\"movements\"}', ?)", `event-eski-${entity}-${at}`, entity, at);
// 2.4.9'un resetData'sının fiş defterine dokunan kısmı (v2.4.9 server/app.mjs MOVEMENT_TABLES): işlem geçmişi ve Mutabakat Günlüğü BÜTÜNÜYLE silinir, aynı işlemde
// "company.reset" izi yazılır; fiş tabloları listede yok. `at` sıfırlamanın DUVAR SAATİ (saat geri alınmış senaryolarda fişlerin saatinden önce).
const legacyReset = (file, entity, at) => {
  const db = new DatabaseSync(file);
  try {
    db.exec("BEGIN IMMEDIATE; DELETE FROM audit_events; DELETE FROM integrity_log;");
    db.prepare("INSERT INTO audit_events (id, type, entity_id, actor_id, actor_name, payload_json, created_at) VALUES (?, 'company.reset', ?, 'user-admin', 'Yönetici', '{\"mode\":\"movements\"}', ?)").run(`event-eski-sifirlama-${entity}-${at}`, entity, at);
    db.exec("COMMIT");
  } finally {
    db.close();
  }
};
// Programın yolu dışında (ayrı bağlantı) yazılan iki satırlık fiş (590 / 519; ters kayıtta aynası); rowid verilirse o rowid'le (yazım sırası bozuk dosya), trace verilirse
// fişle aynı işlemde "ledger.voucher.created" izi de.
const rawVoucher = (file, { rowid, id, no, date, amount, at, reversalOf = "", trace = false }) => {
  const db = new DatabaseSync(file);
  try {
    db.exec("BEGIN IMMEDIATE");
    const cols = "id, year, no, date, type, journal_class, description, source, request_key, reversal_of, line_count, total_minor, created_by, created_at";
    const vals = [id, 2027, no, date, reversalOf ? "reversal" : "opening-match", "opening", "", "", `koruma-elle-${id}`, reversalOf || null, 2, amount, "elle", at];
    if (rowid === undefined) db.prepare(`INSERT INTO ledger_vouchers (${cols}) VALUES (${vals.map(() => "?").join(", ")})`).run(...vals);
    else db.prepare(`INSERT INTO ledger_vouchers (rowid, ${cols}) VALUES (?, ${vals.map(() => "?").join(", ")})`).run(rowid, ...vals);
    const [d590, c590] = reversalOf ? [0, amount] : [amount, 0];
    db.prepare("INSERT INTO ledger_voucher_lines (voucher_id, seq, account, debit_minor, credit_minor) VALUES (?, 1, '590', ?, ?), (?, 2, '519', ?, ?)").run(id, d590, c590, id, c590, d590);
    if (trace) db.prepare("INSERT INTO audit_events (id, type, entity_id, actor_id, actor_name, payload_json, created_at) VALUES (?, 'ledger.voucher.created', ?, 'elle', 'Elle', '{}', ?)").run(`event-elle-${id}`, id, at);
    db.exec("COMMIT");
  } finally {
    db.close();
  }
};
const idsOf = store => store.all("SELECT id FROM ledger_vouchers ORDER BY rowid").map(row => row.id);
const trialOf = (app, code) => Math.round((app.ledger.check().trial.accounts.find(row => row.code === code)?.balance || 0) * 100);
// Tur 2: kaldırılmayan (kuşkulu) izsiz fişin Mutabakat Günlüğü kaydı.
const keptLogs = store => store.all("SELECT summary, detail_json AS detail FROM integrity_log WHERE action = 'repair' AND tables = 'ledger_vouchers' AND summary LIKE 'Fiş defteri:%' ORDER BY rowid");

describe("Ç2 tur 1 — DÜŞÜK-1 (ORTA): eski sürüm sıfırlamasının onarımı yalnız AYNI şirketin sıfırlama izini sayar", () => {
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

  it("iki şirket (dar kontrol p5): 001'in izsiz fişi, 002 sıfırlanınca 001'in dosyasına düşen 'company.reset' (entity 002) yüzünden KALDIRILMAZ", async () => {
    const dirs = fresh();
    const { file, second, voucher } = await withServer(dirs, NOW, async server => ({
      file: server.app.config.dbPath,
      second: await company(server, "Koruma İkinci"),
      voucher: server.app.ledger.vouchers.post(USER, { type: "opening-match", date: "2027-01-02", requestKey: "koruma-k5-p5-001", lines: pair(9900) }),
    }));
    dropTraces(file);
    await withServer(dirs, NOW, async server => {
      assert.deepEqual(server.app.context.voucherRepair?.removed, 0, JSON.stringify(server.app.context.voucherRepair));
      const admin = await loginAdmin(server);
      await must("002 aç", admin.get(`/api/workspace/ledger?hofCompany=${encodeURIComponent(second.id)}`));
      await must("002 sıfırla", admin.post(`/api/companies/${second.id}/reset`, { mode: "movements", confirm: second.code, password: ADMIN_PASSWORD }));
    });
    await withServer(dirs, NOW, async server => {
      const repair = server.app.context.voucherRepair;
      assert.deepEqual(idsOf(server.app.store), [voucher.id], `başka şirketin sıfırlaması 001'in fişini kaldırmamalı: ${JSON.stringify(repair)}`);
      assert.equal(repair?.removed, 0);
      assert.deepEqual(repair?.kept, [voucher.id]);
    });
  });

  // G3 (Ç2 tur 2, dar kontrol B1): tur 1'in "zaman" ve "saat dilimi eki" testleri kaldırıldı — ikisi de fişin sıfırlamadan SONRA yazıldığını yalnız DUVAR SAATİYLE kuruyordu
  // (bütün izler düşürülüp sıfırlama izi fişlerden SONRA eklenmiş, created_at'i aralarına konmuştu). Kullanıcı / ana oturum KARARI (06.11 04:58): karar duvar saatinden
  // bağımsız, YAZIM SIRASIYLA — o dosyada yazım sırasıyla iki fiş de sıfırlama izinden ÖNCE (taban 1e68ad05 de ikisini kaldırıyordu). Aynı iddianın yazım sırasıyla kurulan
  // karşılıkları aşağıda (tur 2): "izi duran fişten sonra yazılan izsiz fiş kalır" ve "işlem geçmişini silmeyen sıfırlama izi fiş kaldırmaz"; saat dilimi iki TZ koşusuyla.

  it("geri yükleme: 002 sıfırlandıktan sonra alınan 001 yedeği (izsiz fiş + entity 002 sıfırlama izi) geri yüklenince 001'in fişi kalır; yedekten sonraki fiş gider", async () => {
    const dirs = fresh();
    const { file, second, kept } = await withServer(dirs, NOW, async server => ({
      file: server.app.config.dbPath,
      second: await company(server, "Koruma Geri Yükleme"),
      kept: server.app.ledger.vouchers.post(USER, { type: "opening-match", date: "2027-01-02", requestKey: "koruma-k5-gy-001", lines: pair(5100) }),
    }));
    dropTraces(file);
    await withServer(dirs, NOW, async server => {
      const admin = await loginAdmin(server);
      await must("002 aç", admin.get(`/api/workspace/ledger?hofCompany=${encodeURIComponent(second.id)}`));
      await must("002 sıfırla", admin.post(`/api/companies/${second.id}/reset`, { mode: "all", confirm: second.code, password: ADMIN_PASSWORD }));
      assert.ok(countOf(server.app.store, "audit_events", `type = 'company.reset' AND entity_id = '${second.id}'`) >= 1, "001'in dosyasında 002'nin sıfırlama izi");
      const backup = (await must("001 yedek", admin.post("/api/admin/backups", { scope: "one", companyId: "sirket-001" }))).backups[0].name;
      server.app.ledger.vouchers.post(USER, { type: "opening-match", date: "2027-01-03", requestKey: "koruma-k5-gy-sonra", lines: pair(6200) });
      await must("001 geri yükle", admin.post("/api/admin/backups/restore", { name: backup, company: "sirket-001", confirm: "001", password: ADMIN_PASSWORD }));
    });
    await withServer(dirs, NOW, async server => {
      assert.deepEqual(idsOf(server.app.store), [kept.id], `geri yüklenen 001'de yalnız yedekteki fiş: ${JSON.stringify(server.app.context.voucherRepair)}`);
      const scan = await must("Mutabakat Testi", (await loginAdmin(server)).get("/api/workspace/ledger/integrity"));
      assert.equal(scan.ok, true, JSON.stringify(scan.checks.filter(item => !item.ok)));
    });
  });
});

describe("Ç2 tur 2 — B1: eski sürüm sıfırlamasının onarımı YAZIM SIRASIYLA (duvar saatinden bağımsız); çift kuralı iki yönlü; kuşkulu fiş görünür kayıtta", () => {
  let root;
  before(() => {
    root = mkdtempSync(path.join(tmpdir(), "fis-koruma-t2-"));
  });
  after(() => removeTestDir(root));
  let n = 0;
  const fresh = () => {
    n += 1;
    return { dataDir: path.join(root, `v${n}`, "data"), backupDir: path.join(root, `v${n}`, "backups") };
  };
  const scanOk = async (server, query = "") => {
    const scan = await must("Mutabakat Testi", (await loginAdmin(server)).get(`/api/workspace/ledger/integrity${query}`));
    assert.equal(scan.ok, true, JSON.stringify(scan.checks.filter(item => !item.ok)));
    return scan;
  };

  it("saat geri (dar kontrol k5-saat-ters): asıl fiş 10:00, saat geri alınıp ters kaydı 08:00, eski sürüm 09:00'da sıfırlar → asıl fiş ve ters kaydı BİRLİKTE kaldırılır; asıl fiş etkin kalmaz", async () => {
    const dirs = fresh();
    const { file, o, r } = await withServer(dirs, "2027-01-10T10:00:00+03:00", async server => {
      const V = server.app.ledger.vouchers;
      const o = V.post(USER, { type: "opening-match", date: "2027-01-06", description: "Asıl", requestKey: "koruma-t2-ters-o", lines: pair(45600) });
      server.clock.set("2027-01-10T08:00:00+03:00");
      return { file: server.app.config.dbPath, o, r: V.reverse(USER, o.id, { requestKey: "koruma-t2-ters-r" }) };
    });
    assert.deepEqual([o.createdAt, r.createdAt], ["2027-01-10T07:00:00.000Z", "2027-01-10T05:00:00.000Z"], "ön koşul: ters kaydın duvar saati asıl fişten önce");
    legacyReset(file, "sirket-001", "2027-01-10T06:00:00.000Z");
    await withServer(dirs, "2027-01-10T12:00:00+03:00", async server => {
      const repair = server.app.context.voucherRepair;
      assert.deepEqual([repair?.removed, repair?.ids, repair?.kept], [2, [o.id, r.id], []], `saat geri alınmış olsa da sıfırlamadan artakalan asıl fiş + ters kaydı birlikte kaldırılır (taban 2): ${JSON.stringify(repair)}`);
      assert.deepEqual(idsOf(server.app.store), []);
      assert.deepEqual([trialOf(server.app, "590"), trialOf(server.app, "519")], [0, 0], "ters kaydı kaldırılan asıl fiş etkin kalmadı (mizan)");
      assert.match(server.app.store.get("SELECT summary FROM integrity_log WHERE action = 'repair' AND tables = 'ledger_vouchers'")?.summary || "", /artakalan 2 fiş kaldırıldı/);
      assert.deepEqual(keptLogs(server.app.store), [], "kuşkulu fiş yok");
      await scanOk(server);
    });
  });

  for (const [mode, resetAt] of [["geri", "2027-01-10T06:00:00.000Z"], ["ileri", "2027-01-10T08:00:00.000Z"]]) {
    it(`ikinci şirket (dar kontrol k5-002-v249), saat ${mode}: 002'nin fişleri (biri ters kayıtlı) 10:00'da, eski sürüm 002'yi ${mode === "geri" ? "09:00'da (saat geri)" : "11:00'de"} sıfırlar → 002'de 3 fiş kaldırılır; 001'in izli fişi kalır`, async () => {
      const dirs = fresh();
      const setup = await withServer(dirs, "2027-01-10T10:00:00+03:00", async server => {
        const admin = await loginAdmin(server);
        const second = await company(server, `Koruma Tur 2 ${mode}`);
        await must("002 aç", admin.get(`/api/workspace/ledger?hofCompany=${encodeURIComponent(second.id)}`));
        const child = server.app.openCompany(second.id);
        const V = child.ledger.vouchers;
        const a = V.post(USER, { type: "closing", date: "2027-01-06", requestKey: `koruma-t2-002-a-${mode}`, lines: pair(70000, "602", "690") });
        V.reverse(USER, a.id, { requestKey: `koruma-t2-002-ar-${mode}` });
        V.post(USER, { type: "opening-match", date: "2027-01-07", requestKey: `koruma-t2-002-b-${mode}`, lines: pair(12300) });
        const own = server.app.ledger.vouchers.post(USER, { type: "opening-match", date: "2027-01-07", requestKey: `koruma-t2-001-${mode}`, lines: pair(500) });
        return { second, own, file001: server.app.config.dbPath, file002: child.config.dbPath };
      });
      assert.notEqual(setup.file002, setup.file001);
      legacyReset(setup.file002, setup.second.id, resetAt);
      writeReset(setup.file001, setup.second.id, resetAt);
      await withServer(dirs, "2027-01-10T12:00:00+03:00", async server => {
        const admin = await loginAdmin(server);
        await must("002 aç", admin.get(`/api/workspace/ledger?hofCompany=${encodeURIComponent(setup.second.id)}`));
        const child = server.app.openCompany(setup.second.id);
        const repair = child.context.voucherRepair;
        assert.deepEqual([repair?.removed, repair?.kept], [3, []], `002, saat ${mode}: eski sürüm sıfırlamasından artakalan 3 fiş kaldırılır (taban 3): ${JSON.stringify(repair)}`);
        assert.equal(countOf(child.store, "ledger_vouchers"), 0);
        assert.deepEqual(child.ledger.build().filter(item => /voucher/.test(item.id)).map(item => item.id), [], "002'nin yevmiyesinde fiş maddesi yok");
        assert.equal(server.app.context.voucherRepair, null, "001'in fişi izli: onarıma girmez");
        assert.deepEqual(idsOf(server.app.store), [setup.own.id]);
        await scanOk(server, `?hofCompany=${encodeURIComponent(setup.second.id)}`);
      });
    });
  }

  it("yazım sırası: eski sürüm sıfırlamasından SONRA yazılan fiş (saat geri: duvar saati sıfırlamadan önce) izini başka nedenle yitirirse KALIR; Mutabakat Günlüğü'nde görünür kayıt, açılışta yinelenmez", async () => {
    const dirs = fresh();
    const { file, v0 } = await withServer(dirs, "2027-01-10T08:00:00+03:00", async server => ({
      file: server.app.config.dbPath,
      v0: server.app.ledger.vouchers.post(USER, { type: "opening-match", date: "2027-01-07", requestKey: "koruma-t2-sonra-0", lines: pair(1100) }),
    }));
    legacyReset(file, "sirket-001", "2027-01-10T06:00:00.000Z");
    const { v1, v2 } = await withServer(dirs, "2027-01-10T08:30:00+03:00", async server => {
      const repair = server.app.context.voucherRepair;
      assert.deepEqual([repair?.removed, repair?.ids], [1, [v0.id]], `sıfırlamadan önce yazılan fiş kaldırıldı: ${JSON.stringify(repair)}`);
      const V = server.app.ledger.vouchers;
      const v1 = V.post(USER, { type: "opening-match", date: "2027-01-08", requestKey: "koruma-t2-sonra-1", lines: pair(2200) });
      server.clock.set("2027-01-10T08:40:00+03:00");
      return { v1, v2: V.post(USER, { type: "opening-match", date: "2027-01-08", requestKey: "koruma-t2-sonra-2", lines: pair(3300) }) };
    });
    assert.ok(v2.createdAt < "2027-01-10T06:00:00.000Z", `ön koşul: fişin duvar saati sıfırlamadan önce (saat geri): ${v2.createdAt}`);
    dropTrace(file, v2.id);
    await withServer(dirs, NOW, async server => {
      const repair = server.app.context.voucherRepair;
      assert.deepEqual([repair?.removed, repair?.kept], [0, [v2.id]], `izi duran fişten sonra yazılan izsiz fiş kalmalı (yazım sırası, saat değil): ${JSON.stringify(repair)}`);
      assert.deepEqual(repair.doubts, { [v2.id]: "after-traced" });
      assert.deepEqual(idsOf(server.app.store), [v1.id, v2.id]);
      const logs = keptLogs(server.app.store);
      assert.equal(logs.length, 1, `kuşkulu fişin görünür kaydı: ${JSON.stringify(logs)}`);
      assert.match(logs[0].summary, /izi olmayan 1 fiş kaldırılmadı/);
      assert.match(logs[0].summary, /izi duran bir fişten sonra yazılmış/);
      assert.ok(logs[0].summary.includes(v2.noText), `kayıt fiş numarasını taşır (${v2.noText}): ${logs[0].summary}`);
      assert.deepEqual(JSON.parse(logs[0].detail).kept, [v2.id]);
      const scan = await scanOk(server);
      assert.ok(scan.log.some(row => row.summary === logs[0].summary), "kayıt Mutabakat Testi'nin günlüğünde görünür (sessiz değil)");
    });
    await withServer(dirs, NOW, async server => {
      assert.deepEqual(server.app.context.voucherRepair?.kept, [v2.id]);
      assert.equal(keptLogs(server.app.store).length, 1, "aynı kuşkulu fiş için kayıt her açılışta yinelenmez");
    });
  });

  it("yazım sırası: işlem geçmişini SİLMEYEN sıfırlama izi (izi duran fişten sonra eklenmiş; duvar saati fişten sonra) izsiz fişi kaldırmaz; görünür kayıt", async () => {
    const dirs = fresh();
    const { file, a, b } = await withServer(dirs, NOW, async server => {
      const V = server.app.ledger.vouchers;
      return {
        file: server.app.config.dbPath,
        a: V.post(USER, { type: "opening-match", date: "2027-01-07", requestKey: "koruma-t2-silmeyen-a", lines: pair(1700) }),
        b: V.post(USER, { type: "opening-match", date: "2027-01-07", requestKey: "koruma-t2-silmeyen-b", lines: pair(1800) }),
      };
    });
    dropTrace(file, a.id);
    writeReset(file, "sirket-001", "2027-01-10T08:00:00.000Z");
    await withServer(dirs, NOW, async server => {
      const repair = server.app.context.voucherRepair;
      assert.deepEqual([repair?.removed, repair?.kept], [0, [a.id]], `işlem geçmişini silmeyen sıfırlama izi fiş kaldırmamalı: ${JSON.stringify(repair)}`);
      assert.deepEqual(repair.doubts, { [a.id]: "reset-without-wipe" });
      assert.deepEqual(idsOf(server.app.store), [a.id, b.id]);
      assert.match(keptLogs(server.app.store)[0]?.summary || "", /sıfırlama izi işlem geçmişini silmemiş/);
      await scanOk(server);
    });
  });

  it("çift kuralı İKİ YÖNLÜ — asıl fiş kalıyorsa ters kaydı da kalır (yazım sırası bozuk dosya: ters kayıt izli fişten ÖNCE, asıl fiş SONRA görünüyor) → ikisi de kalır, asıl fiş tek başına etkin olmaz", async () => {
    const dirs = fresh();
    const { file } = await withServer(dirs, NOW, async server => ({
      file: server.app.config.dbPath,
      x: server.app.ledger.vouchers.post(USER, { type: "opening-match", date: "2027-01-05", requestKey: "koruma-t2-cift-x", lines: pair(100) }),
    }));
    legacyReset(file, "sirket-001", "2027-01-10T07:30:00.000Z");
    const t = await withServer(dirs, NOW, async server => {
      assert.equal(server.app.context.voucherRepair?.removed, 1, JSON.stringify(server.app.context.voucherRepair));
      return server.app.ledger.vouchers.post(USER, { type: "closing", date: "2027-01-06", requestKey: "koruma-t2-cift-t", lines: pair(900, "602", "690") });
    });
    rawVoucher(file, { rowid: 1000, id: "lv-koruma-asil", no: 900, date: "2027-01-08", amount: 7700, at: "2027-01-10T08:00:00.000Z" });
    rawVoucher(file, { rowid: -1, id: "lv-koruma-ters", no: 901, date: "2027-01-08", amount: 7700, reversalOf: "lv-koruma-asil", at: "2027-01-10T06:00:00.000Z" });
    await withServer(dirs, NOW, async server => {
      const repair = server.app.context.voucherRepair;
      assert.deepEqual([repair?.removed, repair?.kept], [0, ["lv-koruma-ters", "lv-koruma-asil"]], `asıl fiş kalıyorsa ters kaydı da kalır (kuşkuda ikisi de): ${JSON.stringify(repair)}`);
      assert.deepEqual(repair.doubts, { "lv-koruma-ters": "pair", "lv-koruma-asil": "after-traced" });
      assert.deepEqual(idsOf(server.app.store), ["lv-koruma-ters", t.id, "lv-koruma-asil"]);
      assert.equal(trialOf(server.app, "590"), 0, "asıl fiş tek başına etkin değil (590 net 0)");
      assert.match(keptLogs(server.app.store)[0]?.summary || "", /çift birlikte kalır/);
      await scanOk(server);
    });
  });

  it("çift kuralı (baş mimar kararı 5) — ters kaydı kalıyorsa asıl fiş de kalır: sıfırlamadan önce yazılmış asıl fişin izli ters kaydı sıfırlamadan sonra yazılmış (ör. onarım o açılışta çalışmadı) → asıl fiş kaldırılmaz", async () => {
    const dirs = fresh();
    const { file, o } = await withServer(dirs, NOW, async server => ({
      file: server.app.config.dbPath,
      o: server.app.ledger.vouchers.post(USER, { type: "opening-match", date: "2027-01-06", requestKey: "koruma-t2-k5-asil", lines: pair(4400) }),
    }));
    legacyReset(file, "sirket-001", "2027-01-10T07:30:00.000Z");
    rawVoucher(file, { id: "lv-koruma-ters-sonra", no: 50, date: "2027-01-06", amount: 4400, reversalOf: o.id, at: "2027-01-10T07:40:00.000Z", trace: true });
    await withServer(dirs, NOW, async server => {
      const repair = server.app.context.voucherRepair;
      assert.deepEqual([repair?.removed, repair?.kept], [0, [o.id]], `ters kaydı kalan asıl fiş kaldırılmaz: ${JSON.stringify(repair)}`);
      assert.deepEqual(idsOf(server.app.store), [o.id, "lv-koruma-ters-sonra"]);
      assert.equal(trialOf(server.app, "590"), 0);
      await scanOk(server);
      // Tur 2: neden ve görünür kayıt.
      assert.deepEqual(repair.doubts, { [o.id]: "pair" });
      assert.match(keptLogs(server.app.store)[0]?.summary || "", /çift birlikte kalır/);
    });
  });

  it("geri yükleme + saat geri: eski sürüm sıfırlaması (duvar saati fişlerden önce) → açılışta 3 fiş kaldırılır; sıfırlama öncesi yedek geri yüklenince fişler izleriyle döner, onarım yok", async () => {
    const dirs = fresh();
    const { file, backup, ids } = await withServer(dirs, NOW, async server => {
      const V = server.app.ledger.vouchers;
      const v1 = V.post(USER, { type: "opening-match", date: "2027-01-06", requestKey: "koruma-t2-gy-1", lines: pair(1500) });
      const r1 = V.reverse(USER, v1.id, { requestKey: "koruma-t2-gy-1r" });
      const v2 = V.post(USER, { type: "opening-match", date: "2027-01-07", requestKey: "koruma-t2-gy-2", lines: pair(2500) });
      const admin = await loginAdmin(server);
      const name = (await must("001 yedek", admin.post("/api/admin/backups", { scope: "one", companyId: "sirket-001" }))).backups[0].name;
      return { file: server.app.config.dbPath, backup: name, ids: [v1.id, r1.id, v2.id] };
    });
    legacyReset(file, "sirket-001", "2027-01-10T06:00:00.000Z");
    await withServer(dirs, "2027-01-10T12:00:00+03:00", async server => {
      const repair = server.app.context.voucherRepair;
      assert.deepEqual([repair?.removed, repair?.ids, repair?.kept], [3, ids, []], `saat geri alınmış olsa da artakalan 3 fiş kaldırılır: ${JSON.stringify(repair)}`);
      await must("001 geri yükle", (await loginAdmin(server)).post("/api/admin/backups/restore", { name: backup, company: "sirket-001", confirm: "001", password: ADMIN_PASSWORD }));
    });
    await withServer(dirs, "2027-01-10T12:30:00+03:00", async server => {
      assert.equal(server.app.context.voucherRepair, null, "yedekteki fişler izli: onarım yok");
      assert.deepEqual(idsOf(server.app.store), ids);
      assert.equal(trialOf(server.app, "590"), 2500);
      await scanOk(server);
    });
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
