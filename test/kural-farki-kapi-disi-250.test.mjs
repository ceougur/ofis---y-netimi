// 2.5.0 Ç5-A tur 1e — İş 1 (dar kontrol G-1, GERİLEME): kilitli dönemin KAPI DIŞI bozulması yeniden BULUNUR (docs/erp/C5-ACILIS-TASARIM.md §15).
// Önceden (c5a1e-taban): Ç5-A'nın açılışı işaretten tanıyan türetmesinin girdileri (Kasa / cari açılış işareti, KG-16 durumu, evrak işareti, kartın yükleme bağı) kilit izinde yoktu;
// tur 1d kural farkını (doğru olarak) sapma kümesinden çıkarınca, kilitli dönemde bu alanları ayrı bağlantıyla değiştiren yazım tarama bulgusu / Mutabakat Günlüğü / zil üretmiyordu —
// yalnız "Kural Değişikliği Farkı"nın sayısı ve tutarı değişiyordu (1→0'da o bile değil). Tur 2'nin Kural Farkı Düzeltme Fişi böyle bir bozulmayı "kural farkı" diye açık döneme yazardı.
// YOL (§15.2): dört işaret kilit izinde (LOCK_SQL since 2.5.0; satır kimlikleriyle) → period-lock + ledger:snapshot ("Donmuş Dönemin Kaynağı Değişti"); KG-16 durumu izde değil (K8-2),
// kapının yazdığı kopyası (opening_review_gate, göç 50) ile karşılaştırılır → "opening:review".
// NASIL BOZULUR (§15.3; testler buradan): [1] satır içi ve [2] arka plan tarama yolu (beş tür + yer değiştirme = sayı / tutar aynı, yalnız hesap dağılımı); [3] program kapalıyken yapılan
// yazım açılışta bulunur; [4] meşru olaylar sessiz (kilitli satırda KG-16 onayı / reddi, kilidin ilerletilmesi / kaldırılması / yeniden kilitleme, yeniden açılış); [5] yedekten geri yükleme
// ve Şirket Verisini Sıfırla sessiz; [6] göç 50 (gölge sütunu olmayan 2.5.0 öncesi şema) sessiz; [7] kapıdan geçen yazım kilitli işareti değiştiremez (süzgeç ↔ tam kapı eşdeğer).
// Veri: v2.4.9'un GERÇEK koduyla API'den üretilir (test/guvenilirlik/surumler.mjs; ders 17, 23), kilit v2.4.9'da konur; güncel kod açılışta 2.4.9 kuralıyla dondurur. Dondurmanın
// bitişi ürünün durumundan beklenir (runPending; SINIRLI bekleme — ders 20). Sahte saat (ders 13); iki TZ'de koşulur; lisans servisi yok (ders 30). Kapı dışı yazım ayrı bağlantıyla.
import assert from "node:assert/strict";
import { cpSync, mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { DatabaseSync } from "node:sqlite";
import { after, before, describe, it } from "node:test";
import { ADMIN_PASSWORD } from "./helpers.mjs";
import { CURRENT, bootVersion, tagsAvailable } from "./guvenilirlik/surumler.mjs";

process.env.HUKUK_LICENSE_URL ||= "http://127.0.0.1:9";
const NOW = { time: "2026-10-20T12:00:00+03:00", fixed: true };
const LOCK = "2026-10-10";
const WAIT_MS = 60_000;
const OLD = "v2.4.9";
const SKIP = !tagsAvailable([OLD]) ? `${OLD} etiketi yok` : false;

const within = (promise, label) => {
  let timer = null;
  const limit = new Promise((_, reject) => {
    timer = setTimeout(() => reject(new Error(`${label} ${WAIT_MS / 1000} sn'de olmadı`)), WAIT_MS);
    timer.unref?.();
  });
  return Promise.race([promise, limit]).finally(() => clearTimeout(timer));
};
const must = async (label, promise) => {
  const res = await promise;
  assert.equal(res.status, 200, `${label}: ${res.status} ${JSON.stringify(res.data).slice(0, 300)}`);
  return res.data;
};
const codesOf = list => (list || []).map(item => item.code);
const QUIET = { gunluk: 0, zil: [], sunucu: [] };

// ---------- v2.4.9 verisi (bir kez; her durum kendi kopyasında) ----------
let template = "";
const ids = {};
async function makeTemplate() {
  template = mkdtempSync(path.join(tmpdir(), "c5a1e-kd-tpl-"));
  const old = await bootVersion(OLD, { dataDir: path.join(template, "data"), backupDir: path.join(template, "backups"), now: NOW });
  try {
    const api = await old.login();
    await api.post("/api/workspace/bank/setup/dismiss", {});
    const a = await must("A", api.post("/api/workspace/accounts", { name: "Tur1e A", type: "customer", registeredOn: "2026-10-01", openingBalance: "800" }));
    await must("A ikinci açılış", api.post(`/api/workspace/accounts/${a.id}/entries`, { kind: "debt", amount: "300", date: "2026-10-02", note: "Açılış devri (ikinci)" }));
    const b = await must("B", api.post("/api/workspace/accounts", { name: "Tur1e B", type: "customer", registeredOn: "2026-10-01", openingBalance: "500" }));
    const c = await must("C", api.post("/api/workspace/accounts", { name: "Tur1e C", type: "customer", registeredOn: "2026-10-01" }));
    await must("C borç", api.post(`/api/workspace/accounts/${c.id}/entries`, { kind: "debt", amount: "500", date: "2026-10-04", note: "Satış" }));
    const d = await must("D", api.post("/api/workspace/accounts", { name: "Tur1e D", type: "customer", registeredOn: "2026-10-01" }));
    await must("D borç", api.post(`/api/workspace/accounts/${d.id}/entries`, { kind: "debt", amount: "120", date: "2026-10-03", note: "Hizmet" }));
    await must("Kasa", api.post("/api/workspace/cash", { kind: "in", amount: "150", date: "2026-10-03", description: "Olağan giriş" }));
    await must("carisiz çek", api.post("/api/workspace/cheques", { direction: "in", instrument: "cheque", serialNo: "T1E-1", bank: "Akbank", drawer: "Kemal Usta", amount: "400", issueDate: "2026-10-04", dueDate: "2026-12-01" }));
    await must("kart", api.post("/api/workspace/plans", { accountId: d.id, name: "Tur1e D", total: "900", mode: "auto", count: 3, firstDue: "2026-11-05", registeredOn: "2026-10-05" }));
    await must("kilit (v2.4.9)", api.put("/api/admin/period-lock", { lockedUntil: LOCK }));
    const store = old.app.store;
    const entry = (account, note) => store.get("SELECT id FROM account_entries WHERE account_id = ? AND note = ?", account, note).id;
    Object.assign(ids, {
      aOpening: entry(a.id, "Açılış bakiyesi"),
      candidate: entry(a.id, "Açılış devri (ikinci)"),
      bOpening: entry(b.id, "Açılış bakiyesi"),
      cDebt: entry(c.id, "Satış"),
      dDebt: entry(d.id, "Hizmet"),
      cash: store.get("SELECT id FROM cash_entries WHERE description = 'Olağan giriş'").id,
      cheque: store.get("SELECT id FROM cheques WHERE serial_no = 'T1E-1'").id,
      plan: store.get("SELECT id FROM plans WHERE account_id = ?", d.id).id,
    });
  } finally {
    await old.close();
  }
}
const copyOf = () => {
  const root = mkdtempSync(path.join(tmpdir(), "c5a1e-kd-"));
  cpSync(template, root, { recursive: true });
  return { root, dataDir: path.join(root, "data"), backupDir: path.join(root, "backups"), cleanup: () => rmSync(root, { recursive: true, force: true }) };
};

/** Açılış + gözlemci (Mutabakat Günlüğü, zil, sunucu günlüğünün Mutabakat satırları — her adımda YALNIZ yeniler). */
async function open(dirs) {
  const lines = [];
  const log = { debug() {}, info() {}, warn: (...a) => lines.push(`warn: ${a.join(" ")}`), error: (...a) => lines.push(`error: ${a.join(" ")}`) };
  const server = await bootVersion(CURRENT, { dataDir: dirs.dataDir, backupDir: dirs.backupDir, now: NOW, integrityScan: false, log });
  const alerts = [];
  server.app.events.tap((event, payload) => {
    if (event === "integrity.alert") alerts.push(codesOf(payload.findings));
  });
  const logRows = () => server.app.store.all("SELECT action, summary FROM integrity_log");
  const opened = { rows: logRows(), lines: lines.filter(line => /Mutabakat/.test(line)) };
  let marks = { rows: opened.rows.length, alerts: 0, lines: lines.length };
  const fresh = () => {
    const rows = logRows();
    const out = { gunluk: rows.length - marks.rows, zil: alerts.slice(marks.alerts), sunucu: lines.slice(marks.lines).filter(line => /Mutabakat taraması/.test(line)) };
    marks = { rows: rows.length, alerts: alerts.length, lines: lines.length };
    return out;
  };
  return { server, app: server.app, opened, fresh };
}
const freezeDone = async app => {
  await within(app.ledger.snapshots.runPending(), "bekleyen dondurmanın bitmesi");
  const state = app.ledger.snapshots.state();
  assert.equal(state.pending, null, `dondurma bitmeli: ${JSON.stringify(state)}`);
  assert.equal(state.coverage, state.lock, `kilitli dönem donmuş olmalı: ${JSON.stringify(state)}`);
  return state;
};
const background = async app => {
  const outcome = await app.integrity.scanInBackground();
  assert.ok(outcome.result, `arka plan taraması koşmalı: ${JSON.stringify(outcome).slice(0, 300)}`);
  assert.equal(app.integrity.lastScan.via, "worker");
  return outcome;
};
/** Ön koşul: göç + dondurmadan sonra bütün yollar sessiz (kural farkı uyarı; tur 1d). */
async function settled(ctx) {
  await freezeDone(ctx.app);
  const first = await background(ctx.app);
  assert.deepEqual(first.findings, [], `ön koşul: dondurmadan sonraki ilk arka plan taraması sessiz: ${JSON.stringify(codesOf(first.findings))}`);
  assert.deepEqual(ctx.app.integrity.scan().findings, [], "ön koşul: satır içi tarama sessiz");
  assert.deepEqual(ctx.fresh(), QUIET, "ön koşul: günlük / zil / sunucu iletisi yok");
}
function outside(app, sql, ...args) {
  const other = new DatabaseSync(app.store.get("PRAGMA database_list").file);
  try {
    other.exec("PRAGMA busy_timeout = 5000");
    return other.prepare(sql).run(...args).changes;
  } finally {
    other.close();
  }
}

// Kapı dışı yazımlar (dar kontrolün tablosu + yer değiştirme). want: taramanın bulması gereken kendi denetimleri.
const LOCKED_SOURCE = ["ledger:snapshot", "period-lock"];
const KINDS = [
  { name: "Kasa satırının açılış işareti 0→1", want: LOCKED_SOURCE, write: app => outside(app, "UPDATE cash_entries SET is_opening = 1 WHERE id = ?", ids.cash) },
  { name: "cari satırının açılış işareti 0→1", want: LOCKED_SOURCE, write: app => outside(app, "UPDATE account_entries SET is_opening = 1 WHERE id = ?", ids.dDebt) },
  { name: "cari satırının açılış işareti 1→0 (519 → 602)", want: LOCKED_SOURCE, write: app => outside(app, "UPDATE account_entries SET is_opening = 0 WHERE id = ?", ids.aOpening) },
  {
    name: "iki carinin işareti yer değiştirir (sayı ve tutar aynı, yalnız hesap dağılımı)",
    want: LOCKED_SOURCE,
    write: app => outside(app, "UPDATE account_entries SET is_opening = CASE id WHEN ? THEN 0 ELSE 1 END WHERE id IN (?, ?)", ids.bOpening, ids.bOpening, ids.cDebt),
  },
  { name: "KG-16 durumu (Açılış Olabilir onayı alanı)", want: ["opening:review"], write: app => outside(app, "UPDATE account_entries SET opening_review = 'rejected' WHERE id = ?", ids.candidate) },
  { name: "evrakın açılış işareti", want: LOCKED_SOURCE, write: app => outside(app, "UPDATE cheques SET is_opening = 1 WHERE id = ?", ids.cheque) },
  {
    name: "taksit kartının Excel yükleme bağı",
    want: LOCKED_SOURCE,
    write: app => {
      outside(app, "INSERT INTO plan_imports (id, kind, source, title, summary_json, undo_json, created_by, created_at) VALUES ('t1e-imp', 'excel', 'dış.xlsx', 'dış', '{}', '{}', 'x', ?)", `${LOCK}T08:00:00.000Z`);
      return outside(app, "UPDATE plans SET import_id = 't1e-imp' WHERE id = ?", ids.plan);
    },
  },
];
const assertFound = (outcome, kind, seen, label) => {
  const found = codesOf(outcome.findings);
  for (const code of kind.want) assert.ok(found.includes(code), `${label} — ${kind.name}: ${code} bulunmalı: ${JSON.stringify(found)}`);
  assert.ok(!found.includes("ledger:rule-diff"), `${label}: kural farkı yine bulgu değil (tur 1d)`);
  assert.equal(seen.gunluk, 1, `${label} — ${kind.name}: Mutabakat Günlüğü'ne bir "scan" satırı`);
  assert.equal(seen.zil.length, 1, `${label} — ${kind.name}: zil bir kez`);
  for (const code of kind.want) assert.ok(seen.zil[0].includes(code), `${label}: zilde ${code}: ${JSON.stringify(seen.zil)}`);
  for (const code of kind.want) assert.ok(codesOf(outcome.result.failures).includes(code), `${label}: Mutabakat Testi'nde sapma (${code})`);
};

describe("Ç5-A tur 1e — kilitli dönemin kapı dışı bozulması bulunur; meşru olaylar sessiz", { skip: SKIP }, () => {
  before(makeTemplate, { timeout: 180_000 });
  after(() => template && rmSync(template, { recursive: true, force: true }));

  for (const kind of KINDS) {
    it(`[1] satır içi tarama — ${kind.name}`, { timeout: 120_000 }, async () => {
      const dirs = copyOf();
      let ctx = null;
      try {
        ctx = await open(dirs);
        await settled(ctx);
        assert.ok(kind.write(ctx.app) >= 1, "ön koşul: kapı dışı yazım satır değiştirdi");
        const inline = ctx.app.integrity.scan();
        assertFound(inline, kind, ctx.fresh(), "satır içi");
        // Sapma sürer (Mutabakat Testi'nde kalır), yeniden bildirilmez.
        const again = ctx.app.integrity.scan();
        assert.deepEqual(again.findings, [], "aynı sapma ikinci taramada yeniden bildirilmez");
        for (const code of kind.want) assert.ok(codesOf(again.result.failures).includes(code), `ikinci taramada da Mutabakat Testi'nde sapma (${code})`);
        assert.deepEqual(ctx.fresh(), QUIET);
      } finally {
        await ctx?.server.close().catch(() => {});
        dirs.cleanup();
      }
    });
    it(`[2] arka plan taraması — ${kind.name}; [3] program kapalıyken yapılan aynı yazım açılışta bulunur`, { timeout: 180_000 }, async () => {
      const dirs = copyOf();
      let ctx = null;
      try {
        ctx = await open(dirs);
        await settled(ctx);
        assert.ok(kind.write(ctx.app) >= 1, "ön koşul: kapı dışı yazım satır değiştirdi");
        const outcome = await background(ctx.app);
        assertFound(outcome, kind, ctx.fresh(), "arka plan");
        await ctx.server.close();
        ctx = null;
      } finally {
        await ctx?.server.close().catch(() => {});
      }
      // [3] Aynı durum, yazım program KAPALIYKEN: yeni kopya, dondur + kapat, yaz, aç.
      const closed = copyOf();
      try {
        ctx = await open(closed);
        await settled(ctx);
        const file = ctx.app.store.get("PRAGMA database_list").file;
        await ctx.server.close();
        ctx = null;
        // Program kapalı: ayrı bağlantıyla yazım (dosya yolu kapanmadan önceki açılıştan).
        assert.ok(kind.write({ store: { get: () => ({ file }) } }) >= 1, "ön koşul: kapalıyken kapı dışı yazım");
        ctx = await open(closed);
        assert.equal(ctx.app.ledger.snapshots.state().pending, null, "ön koşul: yeniden açılışta bekleyen dondurma yok");
        const result = ctx.app.integrity.scan().result;
        const fail = codesOf(result.failures);
        const wantAtOpen = kind.want.filter(code => code !== "period-lock"); // kapının kilit izi açılışta yeniden ölçülür; donmuş defterin kaynak izi koşuda saklı.
        for (const code of wantAtOpen) assert.ok(fail.includes(code), `açılışta Mutabakat Testi'nde sapma (${code}): ${JSON.stringify(fail)}`);
        const base = ctx.opened.rows.filter(row => row.action === "baseline").map(row => row.summary).join(" | ");
        assert.match(base, kind.want.includes("opening:review") ? /Açılış Olabilir Kararları/ : /Donmuş Defter/, `açılış taban satırı sapmayı taşır: ${base}`);
        assert.ok(ctx.opened.lines.some(line => /güncelleme öncesinden kalan/.test(line)), `sunucu iletisi: ${JSON.stringify(ctx.opened.lines)}`);
      } finally {
        await ctx?.server.close().catch(() => {});
        dirs.cleanup();
        closed.cleanup();
      }
    });
  }

  it("[4] meşru olaylar sessiz: kilitli satırda KG-16 onayı ve reddi (K8-2), kilidin ilerletilmesi, kaldırılması ve yeniden kilitleme; yeniden açılış", { timeout: 240_000 }, async () => {
    const dirs = copyOf();
    let ctx = null;
    const quiet = async label => {
      const inline = ctx.app.integrity.scan();
      assert.deepEqual(inline.findings, [], `${label}: satır içi tarama sessiz: ${JSON.stringify(codesOf(inline.findings))}`);
      const bg = await background(ctx.app);
      assert.deepEqual(bg.findings, [], `${label}: arka plan taraması sessiz`);
      assert.deepEqual(ctx.fresh(), QUIET, `${label}: günlük / zil / sunucu iletisi yok`);
      for (const code of ["opening:review", "period-lock"]) assert.ok(!codesOf(bg.result.failures).includes(code), `${label}: ${code} sapması yok`);
      return bg.result;
    };
    try {
      ctx = await open(dirs);
      await settled(ctx);
      const api = await ctx.server.login();
      await must("onay (kilitli satır — K8-2)", api.post(`/api/workspace/opening-review/${ids.candidate}`, { decision: "confirm" }));
      await quiet("onaydan sonra");
      await must("ret (kilitli satır)", api.post(`/api/workspace/opening-review/${ids.candidate}`, { decision: "reject" }));
      const afterReject = await quiet("retten sonra");
      assert.ok(!codesOf(afterReject.failures).includes("ledger:snapshot"), "karar donmuş defterin kaynak izini değiştirmez");
      assert.equal(ctx.app.store.get("SELECT opening_review_gate AS g FROM account_entries WHERE id = ?", ids.candidate).g, "rejected", "karar kapının kopyasını aynı işlemde yazar");
      await ctx.server.close();
      ctx = await open(dirs);
      assert.ok(!ctx.opened.rows.some(row => /Açılış Olabilir|Donmuş Dönemin/.test(row.summary || "")), "yeniden açılış: taban satırında karar sapma değil");
      await quiet("karardan sonra yeniden açılış");
      const api2 = await ctx.server.login();
      await must("kilidi ilerlet", api2.put("/api/admin/period-lock", { lockedUntil: "2026-10-15" }));
      await freezeDone(ctx.app);
      await quiet("kilit ilerledikten sonra");
      await must("kilidi kaldır", api2.put("/api/admin/period-lock", { lockedUntil: "" }));
      await within(ctx.app.ledger.snapshots.runPending(), "kilit kaldırma");
      await quiet("kilit kaldırıldıktan sonra");
      await must("yeniden kilitle", api2.put("/api/admin/period-lock", { lockedUntil: LOCK }));
      await freezeDone(ctx.app);
      await quiet("yeniden kilitledikten sonra");
      // Yeniden kilitlenmiş dönemde de kapı dışı yazım bulunur (yeni koşunun kaynak izi işaretleri taşır).
      outside(ctx.app, "UPDATE cash_entries SET is_opening = 1 WHERE id = ?", ids.cash);
      assertFound(ctx.app.integrity.scan(), KINDS[0], ctx.fresh(), "yeniden kilitledikten sonra kapı dışı yazım");
    } finally {
      await ctx?.server.close().catch(() => {});
      dirs.cleanup();
    }
  });

  it("[5] yedekten geri yükleme ve Şirket Verisini Sıfırla sessiz", { timeout: 240_000 }, async () => {
    const dirs = copyOf();
    let ctx = null;
    try {
      ctx = await open(dirs);
      await settled(ctx);
      let api = await ctx.server.login();
      const backup = (await must("yedek", api.post("/api/admin/backups", { scope: "one", companyId: "sirket-001" }))).backups[0].name;
      await must("onay (yedekten sonra)", api.post(`/api/workspace/opening-review/${ids.candidate}`, { decision: "confirm" }));
      await must("yedeği geri yükle", api.post("/api/admin/backups/restore", { name: backup, company: "sirket-001", confirm: "001", password: ADMIN_PASSWORD }));
      await ctx.server.close();
      ctx = await open(dirs);
      assert.equal(ctx.app.store.get("SELECT opening_review AS r, opening_review_gate AS g FROM account_entries WHERE id = ?", ids.candidate).r, "candidate", "ön koşul: yedekteki durum döndü");
      await freezeDone(ctx.app);
      const restored = ctx.app.integrity.scan();
      assert.deepEqual(restored.findings, [], `geri yüklemeden sonra satır içi tarama sessiz: ${JSON.stringify(codesOf(restored.findings))}`);
      for (const code of ["opening:review", "period-lock", "ledger:snapshot"]) assert.ok(!codesOf(restored.result.failures).includes(code), `geri yüklemeden sonra ${code} sapması yok`);
      assert.deepEqual((await background(ctx.app)).findings, []);
      assert.ok(!ctx.opened.rows.some(row => /Açılış Olabilir|Donmuş Dönemin/.test(row.summary || "")), "geri yüklemeden sonra açılış tabanı temiz");
      ctx.fresh();
      api = await ctx.server.login();
      await must("sıfırla", api.post("/api/companies/sirket-001/reset", { mode: "movements", confirm: "001", password: ADMIN_PASSWORD }));
      await within(ctx.app.ledger.snapshots.runPending(), "sıfırlamadan sonra");
      const reset = ctx.app.integrity.scan();
      assert.deepEqual(reset.findings, [], `sıfırlamadan sonra sessiz: ${JSON.stringify(codesOf(reset.findings))}`);
      assert.deepEqual(ctx.fresh(), QUIET);
    } finally {
      await ctx?.server.close().catch(() => {});
      dirs.cleanup();
    }
  });

  it("[6] göç 50: gölge sütunu olmayan (göç 49'da kalmış) dosya açılınca gölge durumdan doldurulur — sessiz", { timeout: 180_000 }, async () => {
    const dirs = copyOf();
    let ctx = null;
    try {
      ctx = await open(dirs);
      await settled(ctx);
      const api = await ctx.server.login();
      await must("onay", api.post(`/api/workspace/opening-review/${ids.candidate}`, { decision: "confirm" }));
      const file = ctx.app.store.get("PRAGMA database_list").file;
      await ctx.server.close();
      ctx = null;
      const db = new DatabaseSync(file);
      try {
        db.exec("ALTER TABLE account_entries DROP COLUMN opening_review_gate");
        db.exec("PRAGMA user_version = 49");
      } finally {
        db.close();
      }
      ctx = await open(dirs);
      assert.equal(ctx.app.store.get("PRAGMA user_version").user_version, 50);
      assert.equal(ctx.app.store.get("SELECT opening_review_gate AS g FROM account_entries WHERE id = ?", ids.candidate).g, "confirmed", "göç 50 kararı kopyalar");
      const scan = ctx.app.integrity.scan();
      assert.deepEqual(scan.findings, []);
      assert.ok(!codesOf(scan.result.failures).includes("opening:review"));
    } finally {
      await ctx?.server.close().catch(() => {});
      dirs.cleanup();
    }
  });

  it("[7] kapıdan geçen (mağaza) yazım kilitli satırın açılış işaretini değiştiremez: süzgeç de 'kilitli dönem' der → tam kapı reddeder (eşdeğerlik ihlali yok)", { timeout: 120_000 }, async () => {
    const dirs = copyOf();
    let ctx = null;
    try {
      ctx = await open(dirs);
      await settled(ctx);
      const store = ctx.app.store;
      const tries = [
        ["Kasa", () => store.run("UPDATE cash_entries SET is_opening = 1 WHERE id = ?", ids.cash)],
        ["cari", () => store.run("UPDATE account_entries SET is_opening = 0 WHERE id = ?", ids.aOpening)],
        ["evrak", () => store.run("UPDATE cheques SET is_opening = 1 WHERE id = ?", ids.cheque)],
        ["kart", () => store.run("UPDATE plans SET import_id = 'yok-imp' WHERE id = ?", ids.plan)],
      ];
      for (const [label, write] of tries) {
        assert.throws(write, error => error?.status === 409 && /Kapanmış dönem/.test(error.message) && !/eşdeğerlik/.test(error.message), `${label}: kapı reddetmeli (409 Kapanmış dönem; eşdeğerlik ihlali değil)`);
      }
      assert.equal(store.get("SELECT is_opening AS v FROM cash_entries WHERE id = ?", ids.cash).v, 0, "yazım geri alındı");
      assert.equal(store.get("SELECT is_opening AS v FROM account_entries WHERE id = ?", ids.aOpening).v, 1);
      assert.deepEqual(ctx.app.integrity.scan().findings, [], "reddedilen yazımlardan sonra tarama sessiz");
    } finally {
      await ctx?.server.close().catch(() => {});
      dirs.cleanup();
    }
  });
});
