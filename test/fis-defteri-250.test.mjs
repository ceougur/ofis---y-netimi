// 2.5.0 Ç2 — saklanan fiş defteri (docs/erp/C2-FIS-DEFTERI-TASARIM.md §9 "Nasıl bozulur?" N1–N10, N12–N14, N20–N23; plan docs/erp/MUHASEBE-CEKIRDEGI-PLANI.md §3, §9 madde 4).
// Gerçek program (startTestServer; kapı ve K6 test kipinde açık) + iç API (server.app.ledger.vouchers) + HTTP uçları. Saat SAHTE ve sabit (2027-01-10 10:00 +03:00;
// ders 13, 22): yıl dönümü (31.12.2026 / 01.01.2027) bu güne göre. Eski kodda (fiş defteri yok) her test "fiş defteri yok" nedeniyle kırmızıdır (ders 7, 38).
// Yaşam döngüsü (iki şirket, yedek, sıfırlama, eski sürüm, göç, süreç öldürme, disk dolu, eşzamanlı iki süreç): test/fis-defteri-yasam-250.test.mjs.
import assert from "node:assert/strict";
import { after, before, describe, it } from "node:test";
import { journal, trialBalance } from "../server/lib/general-ledger.mjs";
import { createUser, loginAdmin, startTestServer } from "./helpers.mjs";

const NOW = "2027-01-10T10:00:00+03:00";
const USER = { id: "fis-test", display_name: "Fiş Testi" };
const pair = (amount, debit = "602", credit = "690") => [{ account: debit, debit: amount }, { account: credit, credit: amount }];
let seq = 0;
const key = tag => `fis-test-${tag}-${(seq += 1)}`;
const minorOf = (accounts, code) => {
  const row = accounts.find(item => item.code === code);
  return row ? { debit: Math.round(row.debit * 100), credit: Math.round(row.credit * 100), balance: Math.round(row.balance * 100) } : { debit: 0, credit: 0, balance: 0 };
};
const rejects = (fn, status, code, text = "") => {
  assert.throws(fn, error => {
    assert.equal(error?.status, status, `beklenen ${status}, gelen ${error?.status}: ${error?.message}`);
    if (code) assert.equal(error?.extra?.code, code, `beklenen kod ${code}, gelen ${error?.extra?.code}: ${error?.message}`);
    if (text) assert.match(error.message, text);
    return true;
  });
};

describe("2.5.0 Ç2 — saklanan fiş defteri", () => {
  let server;
  let admin;
  let V;
  let store;
  const count = table => store.get(`SELECT COUNT(*) AS n FROM ${table}`).n;
  const ledger = async (query = "") => {
    const response = await admin.get(`/api/workspace/ledger${query}`);
    assert.equal(response.status, 200, JSON.stringify(response.data));
    return response.data.data;
  };
  before(async () => {
    server = await startTestServer({ now: { time: NOW, fixed: true } });
    admin = await loginAdmin(server);
    store = server.app.store;
    V = server.app.ledger.vouchers;
    assert.ok(V?.post, "fiş defteri yok (server.app.ledger.vouchers)");
    assert.ok(store.get("SELECT 1 AS found FROM sqlite_master WHERE type = 'table' AND name = 'ledger_vouchers'"), "fiş defteri yok (ledger_vouchers tablosu)");
  });
  after(() => server?.close());

  it("N12 (tohum): fiş yokken Defter Mutabakatı'nda Fiş Defteri denetimi görünmez, yevmiyede fiş maddesi yok", async () => {
    assert.ok(V?.post, "fiş defteri yok");
    const report = await admin.get("/api/workspace/report-center/defter-mutabakati");
    assert.equal(report.status, 200);
    const rows = (report.data.data ?? report.data).rows;
    assert.equal(rows.some(row => /Fiş Defteri/.test(row[1])), false, "fişsiz veride denetim listesi 2.4.9 ile aynı");
    assert.equal(server.app.ledger.build().some(entry => entry.id.startsWith("voucher")), false);
  });

  it("N1–N3: dengesiz, sıfır, iki taraflı, eksi, kesirli satır; planda olmayan hesap, yabancı alt hesap, kontrol dışı cari → 400, hiçbir satır yazılmaz", () => {
    assert.ok(V?.post, "fiş defteri yok");
    const base = { type: "closing", date: "2027-01-05", description: "Denetim" };
    rejects(() => V.post(USER, { ...base, requestKey: key("n1"), lines: [{ account: "602", debit: 1000 }, { account: "690", credit: 999 }] }), 400, "voucher-unbalanced", /dengede değil/);
    // Dengeli fişte tek sıfır satır (API denetimi; tablo CHECK'i yedek — denetim düşerse 400 yerine veri tabanı hatası görünür).
    rejects(() => V.post(USER, { ...base, requestKey: key("n1"), lines: [{ account: "602", debit: 100 }, { account: "690", credit: 100 }, { account: "600", debit: 0, credit: 0 }] }), 400, "voucher-line", /sıfır tutarlı/);
    rejects(() => V.post(USER, { ...base, requestKey: key("n1"), lines: [{ account: "602", debit: 0 }, { account: "690", credit: 0 }] }), 400, "voucher-line", /sıfır tutarlı/);
    rejects(() => V.post(USER, { ...base, requestKey: key("n2"), lines: [{ account: "602", debit: 500, credit: 500 }, { account: "690", credit: 500 }, { account: "690", debit: 500 }] }), 400, "voucher-line");
    rejects(() => V.post(USER, { ...base, requestKey: key("n2"), lines: [{ account: "602", debit: -500 }, { account: "690", credit: -500 }] }), 400, "voucher-line");
    rejects(() => V.post(USER, { ...base, requestKey: key("n2"), lines: [{ account: "602", debit: 10.5 }, { account: "690", credit: 10.5 }] }), 400, "voucher-line");
    rejects(() => V.post(USER, { ...base, requestKey: key("n2"), lines: [{ account: "602", debit: 100 }] }), 400, "voucher-line");
    rejects(() => V.post(USER, { ...base, requestKey: key("n3"), lines: pair(100, "999", "690") }), 400, "voucher-account", /hesap planında yok/);
    rejects(() => V.post(USER, { ...base, requestKey: key("n3"), lines: [{ account: "602", sub: "770.90", debit: 100 }, { account: "690", credit: 100 }] }), 400, "voucher-account", /ait değil/);
    rejects(() => V.post(USER, { ...base, requestKey: key("n3"), lines: [{ account: "602", party: "cari-1", debit: 100 }, { account: "690", credit: 100 }] }), 400, "voucher-account", /cari yalnız/);
    rejects(() => V.post(USER, { ...base, type: "reversal", requestKey: key("n3"), lines: pair(100) }), 400, "voucher-type");
    rejects(() => V.post(USER, { ...base, type: "opening", cls: "closing", requestKey: key("n3"), lines: pair(100) }), 400, "voucher-type");
    rejects(() => V.post(USER, { ...base, requestKey: "kisa", lines: pair(100) }), 400, "request-id-invalid");
    assert.equal(count("ledger_vouchers"), 0);
    assert.equal(count("ledger_voucher_lines"), 0);
  });

  it("N4: aynı istek kimliği — aynı içerik aynı fişi döndürür (yeni fiş yok), farklı içerik 409; numara tüketilmez", () => {
    assert.ok(V?.post, "fiş defteri yok");
    const input = { type: "closing", date: "2027-01-05", description: "Yineleme", requestKey: key("n4"), lines: pair(12345) };
    const first = V.post(USER, input);
    assert.equal(first.replayed, false);
    const again = V.post(USER, { ...input, lines: input.lines.map(line => ({ ...line })) });
    assert.equal(again.replayed, true);
    assert.equal(again.id, first.id);
    rejects(() => V.post(USER, { ...input, lines: pair(12346) }), 409, "request-id-reused");
    rejects(() => V.post(USER, { ...input, description: "Başka" }), 409, "request-id-reused");
    assert.equal(store.get("SELECT COUNT(*) AS n FROM ledger_vouchers WHERE request_key = ?", input.requestKey).n, 1);
    const next = V.post(USER, { type: "closing", date: "2027-01-05", requestKey: key("n4"), lines: pair(1) });
    assert.equal(next.no, first.no + 1, "numara boşluksuz sürer");
  });

  it("N7 ileri tarih 400; N6 kilitli tarihe fiş 409 period-locked, hiçbir satır yazılmaz", async () => {
    assert.ok(V?.post, "fiş defteri yok");
    rejects(() => V.post(USER, { type: "closing", date: "2027-01-11", requestKey: key("n7"), lines: pair(100) }), 400, "date-future");
    rejects(() => V.post(USER, { type: "closing", date: "2027-02-30", requestKey: key("n7"), lines: pair(100) }), 400, "date-invalid");
    const before = count("ledger_vouchers");
    const lock = await admin.put("/api/admin/period-lock", { lockedUntil: "2026-12-15" });
    assert.equal(lock.status, 200);
    try {
      rejects(() => V.post(USER, { type: "closing", date: "2026-12-15", requestKey: key("n6"), lines: pair(100) }), 409, "period-locked");
      rejects(() => V.post(USER, { type: "opening", date: "2026-11-30", requestKey: key("n6"), lines: pair(100, "590", "519") }), 409, "period-locked");
      assert.equal(count("ledger_vouchers"), before);
      const open = V.post(USER, { type: "closing", date: "2026-12-16", requestKey: key("n6"), lines: pair(100) });
      assert.equal(open.date, "2026-12-16", "kilidin ertesi günü açık");
    } finally {
      assert.equal((await admin.put("/api/admin/period-lock", { lockedUntil: "" })).status, 200);
    }
  });

  it("N8: fiş ve satırı UPDATE / DELETE / INSERT OR REPLACE / UPSERT ile değişmez; kapanmış fişe satır eklenmez; fişsiz satır eklenmez", () => {
    assert.ok(V?.post, "fiş defteri yok");
    const voucher = V.post(USER, { type: "closing", date: "2027-01-06", description: "Değişmez", requestKey: key("n8"), lines: pair(7777) });
    const snapshot = JSON.stringify(V.get(voucher.id));
    const db = server.app.db;
    const attempts = [
      ["UPDATE başlık", `UPDATE ledger_vouchers SET description = 'x' WHERE id = '${voucher.id}'`, /değiştirilemez/],
      ["UPDATE satır tutarı", `UPDATE ledger_voucher_lines SET debit_minor = 1 WHERE voucher_id = '${voucher.id}' AND seq = 1`, /değiştirilemez/],
      ["DELETE satır", `DELETE FROM ledger_voucher_lines WHERE voucher_id = '${voucher.id}'`, /silinemez/],
      ["DELETE başlık", `DELETE FROM ledger_vouchers WHERE id = '${voucher.id}'`, /silinemez/],
      ["INSERT OR REPLACE başlık", `INSERT OR REPLACE INTO ledger_vouchers (id, year, no, date, type, journal_class, request_key, line_count, total_minor, created_by, created_at) VALUES ('${voucher.id}', 2027, 999, '2027-01-06', 'closing', 'closing', 'baska-kimlik-1', 2, 1, 'x', 'x')`, /ikinci kez/],
      ["INSERT OR REPLACE satır", `INSERT OR REPLACE INTO ledger_voucher_lines (voucher_id, seq, account, debit_minor, credit_minor) VALUES ('${voucher.id}', 1, '602', 1, 0)`, /fiş kapalı/],
      ["kapanmış fişe satır", `INSERT INTO ledger_voucher_lines (voucher_id, seq, account, debit_minor, credit_minor) VALUES ('${voucher.id}', 3, '602', 1, 0)`, /fiş kapalı/],
      ["fişsiz satır", "INSERT INTO ledger_voucher_lines (voucher_id, seq, account, debit_minor, credit_minor) VALUES ('yok', 1, '602', 1, 0)", /fiş kapalı|FOREIGN KEY/],
      ["UPSERT", `INSERT INTO ledger_voucher_lines (voucher_id, seq, account, debit_minor, credit_minor) VALUES ('${voucher.id}', 1, '602', 1, 0) ON CONFLICT(voucher_id, seq) DO UPDATE SET debit_minor = 1`, /fiş kapalı|değiştirilemez/],
    ];
    for (const [name, sql, reason] of attempts) assert.throws(() => db.exec(sql), reason, name);
    assert.equal(JSON.stringify(V.get(voucher.id)), snapshot, "fiş aynen duruyor");
  });

  it("N9–N10: ters kayıt aynalar, mizan sıfırlanır, iki madde de yevmiyede; ikinci ters kayıt, ters kaydın tersi ve asıldan önce tarih reddedilir; kilitli asıl tarihe ters kayıt 409", async () => {
    assert.ok(V?.post, "fiş defteri yok");
    const start = minorOf((await ledger()).trial.accounts, "631");
    const voucher = V.post(USER, { type: "closing", date: "2026-12-20", description: "Ters kayıt denemesi", requestKey: key("n9"), lines: [{ account: "631", debit: 25000 }, { account: "761", credit: 15000 }, { account: "690", credit: 10000 }] });
    let trial = (await ledger()).trial;
    assert.equal(minorOf(trial.accounts, "631").balance - start.balance, 25000);
    rejects(() => V.reverse(USER, voucher.id, { date: "2026-12-19", requestKey: key("n9") }), 400, "voucher-reverse-before");
    const lock = await admin.put("/api/admin/period-lock", { lockedUntil: "2026-12-20" });
    assert.equal(lock.status, 200);
    let reversal;
    try {
      rejects(() => V.reverse(USER, voucher.id, { requestKey: key("n9") }), 409, "period-locked");
      reversal = V.reverse(USER, voucher.id, { date: "2026-12-21", requestKey: key("n9") });
    } finally {
      assert.equal((await admin.put("/api/admin/period-lock", { lockedUntil: "" })).status, 200);
    }
    assert.equal(reversal.type, "reversal");
    assert.equal(reversal.reversalOf, voucher.id);
    assert.equal(reversal.cls, voucher.cls, "ters kayıt asıl fişin sınıfında");
    assert.deepEqual(reversal.lines.map(line => [line.account, line.debit, line.credit]), voucher.lines.map(line => [line.account, line.credit, line.debit]), "satırlar aynanın tersi");
    const data = await ledger();
    trial = data.trial;
    assert.equal(minorOf(trial.accounts, "631").balance, start.balance, "631 eski bakiyesine döndü");
    assert.equal(trial.balanced, true);
    assert.equal(data.reconciliation.ok, true);
    const ids = server.app.ledger.build().map(entry => entry.id);
    assert.ok(ids.includes(`voucher-close:${voucher.id}`) && ids.includes(`voucher-close:${reversal.id}`), "asıl ve ters madde yevmiyede");
    rejects(() => V.reverse(USER, voucher.id, { date: "2026-12-22", requestKey: key("n9") }), 409, "voucher-reversed");
    rejects(() => V.reverse(USER, reversal.id, { date: "2026-12-22", requestKey: key("n9") }), 409, "voucher-reversal-of-reversal");
    rejects(() => V.reverse(USER, "lv-yok", { requestKey: key("n9") }), 404, "voucher-missing");
  });

  it("N9 (HTTP): aynı istek kimliğiyle eşzamanlı iki ters kayıt → tek fiş (biri yinelenen); farklı kimlikle eşzamanlı iki ters kayıt → biri 200, biri 409", async () => {
    assert.ok(V?.post, "fiş defteri yok");
    const a = V.post(USER, { type: "opening-match", date: "2027-01-07", requestKey: key("http"), lines: pair(3000, "590", "519") });
    const same = { requestId: "fis-http-aynisi-0000001" };
    const [x, y] = await Promise.all([admin.post(`/api/admin/ledger/vouchers/${a.id}/reverse`, same), admin.post(`/api/admin/ledger/vouchers/${a.id}/reverse`, same)]);
    assert.deepEqual([x.status, y.status], [200, 200], JSON.stringify([x.data, y.data]));
    assert.equal(x.data.data.voucher.id, y.data.data.voucher.id, "aynı ters kayıt");
    assert.deepEqual([x.data.data.replayed, y.data.data.replayed].sort(), [false, true]);
    assert.equal(store.get("SELECT COUNT(*) AS n FROM ledger_vouchers WHERE reversal_of = ?", a.id).n, 1);
    const b = V.post(USER, { type: "opening-match", date: "2027-01-07", requestKey: key("http"), lines: pair(4000, "590", "519") });
    const [p, q] = await Promise.all([admin.post(`/api/admin/ledger/vouchers/${b.id}/reverse`, { requestId: "fis-http-birinci-000001" }), admin.post(`/api/admin/ledger/vouchers/${b.id}/reverse`, { requestId: "fis-http-ikinci-0000001" })]);
    assert.deepEqual([p.status, q.status].sort(), [200, 409], JSON.stringify([p.data, q.data]));
    assert.equal([p, q].find(item => item.status === 409).data.code, "voucher-reversed");
    assert.equal(store.get("SELECT COUNT(*) AS n FROM ledger_vouchers WHERE reversal_of = ?", b.id).n, 1);
    const missing = await admin.post(`/api/admin/ledger/vouchers/${b.id}/reverse`, {});
    assert.equal(missing.status, 400);
    assert.equal(missing.data.code, "request-id-invalid");
    const list = await admin.get("/api/admin/ledger/vouchers?type=opening-match");
    assert.equal(list.status, 200);
    assert.ok(list.data.data.vouchers.every(item => item.type === "opening-match" && item.reversedBy), "liste ters kayıt bağını gösterir");
  });

  it("N13: aynı gün sırası — açılış fişi günün en başında, olağan fiş Banka Fişi'nden sonra, dönem sonu KDV mahsubundan sonra, kapanış günün en sonunda; sınıf içinde yazım sırası", () => {
    const D = "2026-06-30";
    const voucher = (id, cls, seqNo, amount = 100) => ({ id, seq: seqNo, date: D, cls, label: "Fiş", text: id, lines: [{ account: "602", debit: amount, credit: 0 }, { account: "690", debit: 0, credit: amount }] });
    const rows = {
      cashEntries: [{ id: "k1", seq: 5, kind: "in", amount: 10, date: D, method: "cash", description: "Kasa giriş" }],
      bankLines: [{ eventId: "ev1", eventSeq: 7, seq: 1, gl: "102", sub: "102.01", side: "D", tryMinor: 500, date: D, no: "BNK", description: "Banka" }, { eventId: "ev1", eventSeq: 7, seq: 2, gl: "649", sub: "", side: "C", tryMinor: 500, date: D }],
      vatOffsets: [{ id: "m1", seq: 1, month: "2026-06", date: D, outMinor: 100, inMinor: 0, carryInMinor: 0, carryOutMinor: 0, payableMinor: 100, status: "active" }],
      vouchers: [voucher("kapanis-2", "closing", 9), voucher("acilis-2", "opening", 8), voucher("olagan", "ordinary", 3), voucher("kapanis-1", "closing", 2), voucher("donem-sonu", "period-end", 4), voucher("acilis-1", "opening", 1)],
    };
    const ids = journal(rows).filter(entry => entry.date === D).map(entry => entry.id);
    assert.deepEqual(ids, ["voucher-open:acilis-1", "voucher-open:acilis-2", "cash:k1", "bank:ev1", "voucher:olagan", "vat-offset:m1", "voucher-end:donem-sonu", "voucher-close:kapanis-1", "voucher-close:kapanis-2"], JSON.stringify(ids));
    const reversedRows = { ...rows, vouchers: rows.vouchers.slice().reverse() };
    assert.deepEqual(journal(reversedRows).filter(entry => entry.date === D).map(entry => entry.id), ids, "yükleme sırasından bağımsız (yazım sırası)");
    assert.deepEqual(trialBalance(journal(reversedRows)), trialBalance(journal(rows)));
  });

  it("N14: kapanış fişleri ve kilit AYNI işlemde (lockThrough); biri düşerse fiş de kilit de yazılmaz; yalnız kapanış türleri, fiş ≤ kilit", async () => {
    assert.ok(V?.postAll, "fiş defteri yok");
    assert.equal(server.app.period.lockedUntil(), "");
    const before = count("ledger_vouchers");
    // İkinci fiş işlemin İÇİNDE düşer (kilitli değil ama aynı istek kimliği farklı içerikle): ilki ve kilit geri alınır.
    const used = V.post(USER, { type: "closing", date: "2026-12-30", requestKey: key("n14-var"), lines: pair(50) });
    rejects(() => V.postAll(USER, [{ type: "closing", date: "2026-12-31", requestKey: key("n14"), lines: pair(100) }, { type: "closing", date: "2026-12-31", requestKey: used.requestKey, lines: pair(99) }], { lockThrough: "2026-12-31" }), 409, "request-id-reused");
    assert.equal(count("ledger_vouchers"), before + 1);
    assert.equal(server.app.period.lockedUntil(), "", "kilit konmadı");
    rejects(() => V.postAll(USER, [{ type: "opening", date: "2026-12-31", requestKey: key("n14"), lines: pair(100, "590", "519") }], { lockThrough: "2026-12-31" }), 400, "voucher-type");
    rejects(() => V.postAll(USER, [{ type: "closing", date: "2027-01-02", requestKey: key("n14"), lines: pair(100) }], { lockThrough: "2026-12-31" }), 400, "date-invalid");
    const written = V.postAll(USER, [
      { type: "prior-year-result", date: "2026-12-31", description: "Önceki yıl", requestKey: key("n14"), lines: [{ account: "602", debit: 300 }, { account: "570", credit: 300 }] },
      { type: "closing", cls: "period-end", date: "2026-12-31", description: "Dönem sonu stok", requestKey: key("n14"), lines: [{ account: "621", debit: 200 }, { account: "153", credit: 200 }] },
      { type: "closing", date: "2026-12-31", description: "Kapanış", requestKey: key("n14"), lines: pair(500) },
    ], { lockThrough: "2026-12-31" });
    assert.equal(written.length, 3);
    assert.equal(server.app.period.lockedUntil(), "2026-12-31", "kilit fişlerle aynı işlemde kondu");
    assert.equal(store.get("SELECT COUNT(*) AS n FROM audit_events WHERE type = 'ledger.period.locked' AND payload_json LIKE '%ledger.voucher.closing%'").n, 1);
    const day = server.app.ledger.build().filter(entry => entry.date === "2026-12-31").map(entry => entry.id.split(":")[0]);
    assert.deepEqual(day.slice(-3), ["voucher-end", "voucher-close", "voucher-close"], `31.12 sonu: ${day.join(", ")}`);
    rejects(() => V.post(USER, { type: "closing", date: "2026-12-31", requestKey: key("n14"), lines: pair(1) }), 409, "period-locked");
    // Yinelenen kapanış (aynı kimlikler): yeni fiş yok, kilit düşmez.
    const replay = V.postAll(USER, written.map(item => ({ type: item.type, cls: item.cls, date: item.date, description: item.description, requestKey: item.requestKey, lines: item.lines })), { lockThrough: "2026-12-31" });
    assert.deepEqual(replay.map(item => item.replayed), [true, true, true]);
    assert.equal((await admin.put("/api/admin/period-lock", { lockedUntil: "" })).status, 200);
  });

  it("N20: 31.12 ve 01.01 — numara yılı ayrı, 31.12 kapanışı yılın son maddesi, 01.01 açılışı yeni yılın ilk maddesi, mizan devri", async () => {
    assert.ok(V?.post, "fiş defteri yok");
    assert.equal((await admin.post("/api/workspace/cash", { kind: "in", amount: "40", date: "2026-12-31", description: "Yıl sonu kasa" })).status, 200);
    assert.equal((await admin.post("/api/workspace/cash", { kind: "in", amount: "60", date: "2027-01-01", description: "Yeni yıl kasa" })).status, 200);
    const closing = V.post(USER, { type: "closing", date: "2026-12-31", description: "Yıl sonu", requestKey: key("n20"), lines: pair(2600) });
    const opening = V.post(USER, { type: "opening", date: "2027-01-01", description: "Yeni yıl açılışı", requestKey: key("n20"), lines: pair(2700, "590", "519") });
    assert.match(closing.noText, /^Fiş 2026-\d{6}$/);
    assert.match(opening.noText, /^Fiş 2027-\d{6}$/);
    const firstOf2027 = store.get("SELECT MIN(no) AS n FROM ledger_vouchers WHERE year = 2027").n;
    assert.ok(firstOf2027 >= 1 && opening.year === 2027);
    const entries = server.app.ledger.build();
    const last2026 = entries.filter(entry => entry.date === "2026-12-31").at(-1);
    const first2027 = entries.filter(entry => entry.date === "2027-01-01")[0];
    assert.equal(last2026.id.startsWith("voucher-close:"), true, `31.12'nin son maddesi kapanış: ${last2026.id}`);
    assert.equal(first2027.id, `voucher-open:${opening.id}`, `01.01'in ilk maddesi açılış: ${first2027.id}`);
    const whole = (await ledger()).trial;
    const year = (await ledger("?from=2027-01-01&to=2027-12-31")).trial;
    assert.equal(minorOf(year.accounts, "602").balance, minorOf(whole.accounts, "602").balance, "02.01'den bakınca 31.12 fişi devirde");
    const opening602 = Math.round((year.accounts.find(item => item.code === "602")?.opening || 0) * 100);
    assert.ok(opening602 !== 0, "602'nin 2027 devri 31.12 kapanışını içerir");
  });

  it("N21: kontrol (alt defter) hesabına yazan fiş kapıda geri alınır (Defter Mutabakatı farkı); numara tüketilmez", () => {
    assert.ok(V?.post, "fiş defteri yok");
    const before = count("ledger_vouchers");
    const lastNo = store.get("SELECT MAX(no) AS n FROM ledger_vouchers WHERE year = 2027").n;
    rejects(() => V.post(USER, { type: "opening-match", date: "2027-01-08", requestKey: key("n21"), lines: [{ account: "100", debit: 500 }, { account: "519", credit: 500 }] }), 409, "", /geri alındı/);
    assert.equal(count("ledger_vouchers"), before);
    const next = V.post(USER, { type: "opening-match", date: "2027-01-08", requestKey: key("n21"), lines: pair(10, "590", "519") });
    assert.equal(next.no, lastNo + 1);
  });

  it("N23: uçlar yalnız system.manage — Muhasebe ve Personel 403", async () => {
    assert.ok(V?.post, "fiş defteri yok");
    const voucher = V.post(USER, { type: "opening-match", date: "2027-01-09", requestKey: key("n23"), lines: pair(20, "590", "519") });
    for (const role of ["muhasebe", "personel"]) {
      const client = await createUser(server, admin, { username: `fis-${role}`, role });
      assert.equal((await client.get("/api/admin/ledger/vouchers")).status, 403, `${role} liste`);
      assert.equal((await client.post(`/api/admin/ledger/vouchers/${voucher.id}/reverse`, { requestId: `fis-yetki-${role}-00000001` })).status, 403, `${role} ters kayıt`);
    }
    assert.equal(store.get("SELECT COUNT(*) AS n FROM ledger_vouchers WHERE reversal_of = ?", voucher.id).n, 0);
  });

  it("Fiş Defteri denetimi: fiş varken Defter Mutabakatı'nda tutarlı satır; yapısı bozulan fişi (store dışı) tam tarama yakalar", async () => {
    assert.ok(V?.post, "fiş defteri yok");
    let scan = (await admin.get("/api/workspace/ledger/integrity")).data.data;
    const check = () => scan.checks.find(item => item.code === "ledger:vouchers");
    assert.equal(check()?.ok, true, JSON.stringify(check()));
    const report = await admin.get("/api/workspace/report-center/defter-mutabakati");
    assert.ok((report.data.data ?? report.data).rows.some(row => /Fiş Defteri/.test(row[1]) && row[5] === "Tutarlı"));
    const voucher = V.post(USER, { type: "opening-match", date: "2027-01-09", requestKey: key("bozuk"), lines: pair(80, "590", "519") });
    // Store dışı (eski sürüm / elle) bozma: tetikleyici kaldırılır, satır tutarı değiştirilir.
    server.app.db.exec(`DROP TRIGGER ledger_voucher_lines_no_update; UPDATE ledger_voucher_lines SET debit_minor = 81 WHERE voucher_id = '${voucher.id}' AND seq = 1`);
    scan = (await admin.get("/api/workspace/ledger/integrity")).data.data;
    assert.equal(check()?.ok, false, "bozuk fiş yakalandı");
    assert.match(JSON.stringify(check().sample), /borç 0\.81, alacak 0\.8/);
  });
});

describe("2.5.0 Ç2 — N22: kilitli dönemdeki fiş store dışından silinirse tam tarama \"Kapanmış dönem\" der", () => {
  let server;
  before(async () => {
    server = await startTestServer({ now: { time: NOW, fixed: true } });
  });
  after(() => server?.close());
  it("kilit izi fiş satırlarını içerir", async () => {
    const admin = await loginAdmin(server);
    const V = server.app.ledger.vouchers;
    assert.ok(V?.post, "fiş defteri yok");
    V.post(USER, { type: "closing", date: "2026-12-31", requestKey: "fis-n22-kapanis-1", lines: pair(900) });
    assert.equal((await admin.put("/api/admin/period-lock", { lockedUntil: "2026-12-31" })).status, 200);
    assert.equal((await admin.get("/api/workspace/ledger/integrity")).data.data.ok, true);
    server.app.db.exec("DROP TRIGGER ledger_vouchers_no_delete; DROP TRIGGER ledger_voucher_lines_no_delete; DELETE FROM ledger_voucher_lines; DELETE FROM ledger_vouchers;");
    const scan = (await admin.get("/api/workspace/ledger/integrity")).data.data;
    const lock = scan.checks.find(item => item.code === "period-lock");
    assert.ok(lock && !lock.ok, `kapanmış dönem sapması: ${JSON.stringify(scan.checks.filter(item => !item.ok))}`);
  });
});
