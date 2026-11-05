// Kilitli dönemin donmuş defteri (2.5.0 Ç3; docs/erp/C3-DONDURMA-TASARIM.md, docs/erp/MUHASEBE-CEKIRDEGI-PLANI.md §4; kural kitabı KG-15, EK-1 M7).
//
// Ana Defter alt defterlerden her seferinde türetilir (lib/general-ledger.mjs). Dönem kilidi konunca o güne kadarki TÜRETİLMİŞ yevmiye satırları burada satır düzeyinde
// saklanır (ledger_snapshots); kilitli dönemin raporları bu kopyadan okunur, kural sonradan değişse de değişmez. Fark ("Kural Değişikliği Farkı") gösterilir, düzeltilmez —
// düzeltme fişi Ç5'in işi (ruleDiff tutarları).
//
// KAPSAM: state = 'done' olan son koşunun (freeze ya da thaw) "through"u. Okuyucular yalnız date <= kapsam satırları görür; kapsamın üstündeki satır bayattır (geri
// çekilmiş dönemin ya da yarım kalmış koşunun) ve parça parça silinir.
// DEĞİŞMEZLER (göç 47 tetikleyicileri): satır değiştirilemez; kapsam içindeki izli satır silinemez; satır yalnız en son bekleyen freeze koşusuna, aralığı içinde eklenir; koşu
// başlığı silinemez, yalnız pending → done | abandoned olur. Her an donmuş ≤ kapsam ≤ kilit; (kapsam, kilit] bekleyen koşunun kuralıyla canlı okunur.
// KİLİT KANCASI (lockChanged): PUT period-lock ve vouchers.postAll(lockThrough) aynı işlevi kilitle AYNI işlemde çağırır. İleri: bekleyen freeze koşusu (eşzamanlı kipte aynı
// işlemde dondurulur); geri: thaw koşusu. İş parçacığı kipinde türetme lib/ledger-freeze-worker.mjs'te (salt okunur bağlantı, WAL anlık görüntüsü), satırlar ana iş
// parçacığında küçük işlemlerle yazılır (olay döngüsü kilitlenmez; ders 47).
import { randomUUID } from "node:crypto";
import { Worker } from "node:worker_threads";
import { systemClock } from "./clock.mjs";
import { JOURNAL_CLASS, LEDGER_RULE_VERSION, journalOrder } from "./general-ledger.mjs";
import { HttpError } from "./http.mjs";
import { LOCK_SQL_VERSION, lockDigestOf } from "./integrity.mjs";
import { RULE_249, buildRule249 } from "./ledger-rule-249/index.mjs";
import { LEDGER_SNAPSHOT_TRIGGERS_V47, LEDGER_SNAPSHOT_TRIGGER_NAMES } from "./migrations.mjs";

/** Eski sürümün (≤ 2.4.9; BS-7 kapısını bilmez) ileri götürdüğü kilidin aradaki dönemini donduran kural (KULLANICIYA SORULMALI S1; öneri A = 2.4.9 kopyası). */
export const GAP_RULE = RULE_249;
export const FROZEN_TRACE = "ledger.snapshot.frozen";
export const THAWED_TRACE = "ledger.snapshot.thawed";
const ENTITY = no => `ledger-snapshot-run:${no}`;
// Ağırlık sağlaması (Σ hesap kodu × (borç − alacak), satır başına mod P): hesaplar arası para kaymasını sayı / toplam değişmeden de görür; SQL ve JS aynı (tamsayı, kesme).
const WEIGHT_MOD = 1_000_000_007;
const weightOf = (account, debit, credit) => (Number(account) * (debit - credit)) % WEIGHT_MOD;
const WEIGHT_SQL = `COALESCE(SUM((CAST(account AS INTEGER) * (debit_minor - credit_minor)) % ${WEIGHT_MOD}), 0)`;
const COVERAGE_SQL = "COALESCE((SELECT r.through FROM ledger_snapshot_runs r WHERE r.state = 'done' ORDER BY r.no DESC LIMIT 1), '')";
const INSERT_LINE = `INSERT INTO ledger_snapshots (run, run_seq, entry_id, line_no, date, cls, seq, account, sub, party, debit_minor, credit_minor, source, text, rule_version)
  VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`;
const dayText = iso => (iso ? `${iso.slice(8, 10)}.${iso.slice(5, 7)}.${iso.slice(0, 4)}` : "");
const has = (store, table) => Boolean(store.get("SELECT 1 AS found FROM sqlite_master WHERE type = 'table' AND name = ?", table));
const classOf = id => {
  const text = String(id);
  return JOURNAL_CLASS[text.slice(0, text.indexOf(":"))] ?? 90;
};
const yieldTick = () => new Promise(resolve => setImmediate(resolve));
class Cancelled extends Error {}

/**
 * Yevmiye maddelerinden (from, through] aralığının donmuş satırları (yevmiye sırasıyla): [entryId, lineNo, date, cls, seq, account, sub, party, debit, credit, source, text]
 * + toplamlar. İşlemin, iş parçacığının ve göçün ortak işlevi.
 */
export function snapshotRowsOf(entries, { from = "", through }) {
  const rows = [];
  const totals = { lines: 0, entries: 0, debit: 0, credit: 0, weight: 0 };
  for (const entry of entries) {
    if (!(entry.date > from && entry.date <= through)) continue;
    totals.entries += 1;
    const cls = classOf(entry.id);
    const seq = Number.isSafeInteger(entry.seq) ? entry.seq : null;
    entry.lines.forEach((line, index) => {
      const debit = Number(line.debit) || 0;
      const credit = Number(line.credit) || 0;
      rows.push([String(entry.id), index + 1, entry.date, cls, seq, String(line.account), line.sub ? String(line.sub) : "", line.party ? String(line.party) : "", debit, credit, index === 0 ? String(entry.source || "") : "", index === 0 ? String(entry.text || "") : ""]);
      totals.lines += 1;
      totals.debit += debit;
      totals.credit += credit;
      totals.weight += weightOf(line.account, debit, credit);
    });
  }
  return { rows, totals };
}

/** Maddenin karşılaştırılabilir içeriği: tarih + sıralı satırlar (hesap, alt hesap, cari, borç, alacak). Yazım sırası ve satır sırası karşılaştırılmaz. */
const contentOf = entry => `${entry.date}|${entry.lines.map(line => `${line.account}/${line.sub || ""}/${line.party || ""}/${line.debit}/${line.credit}`).sort().join(";")}`;

/**
 * Şirket Verisini Sıfırla (iki kip): donmuş satırlar ve koşular silinir; tetikleyiciler aynı işlemde kaldırılıp yeniden kurulur (DDL işlemsel). Dönüş: silinen sayılar.
 * Yalnız işlemin içinde (store.tx).
 */
export function clearSnapshots(store) {
  if (!has(store, "ledger_snapshot_runs")) return {};
  if (!store.inTransaction) throw new Error("Donmuş defter yalnız veri tabanı işleminin içinde silinir (store.tx).");
  const counts = { ledger_snapshots: store.get("SELECT COUNT(*) AS n FROM ledger_snapshots").n, ledger_snapshot_runs: store.get("SELECT COUNT(*) AS n FROM ledger_snapshot_runs").n };
  for (const name of LEDGER_SNAPSHOT_TRIGGER_NAMES) store.exec(`DROP TRIGGER IF EXISTS ${name}`);
  store.run("DELETE FROM ledger_snapshots");
  store.run("DELETE FROM ledger_snapshot_runs");
  store.exec(LEDGER_SNAPSHOT_TRIGGERS_V47);
  return counts;
}

const WORKER_ENTRY = new URL("./ledger-freeze-worker.mjs", import.meta.url);
/**
 * Dondurma iş parçacığı: { dbPath, run: { no, from, through, rule } | null, batchLines, time } → satırları parça parça gönderir (her parçadan sonra ana iş parçacığının
 * "next"ini bekler: bir olay döngüsü turunda en çok bir parça). run null → yalnız kilit izi. Dönüş: { promise, terminate }.
 */
function startFreezeWorker(data, { onBatch, timeoutMs = 30 * 60_000 }) {
  const worker = new Worker(WORKER_ENTRY, { workerData: data, name: "destekofis-defter-dondurma" });
  worker.unref();
  let settled = false;
  let timer = null;
  const promise = new Promise((resolve, reject) => {
    const finish = (error, value) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      worker.terminate().catch(() => {});
      if (error) reject(error);
      else resolve(value);
    };
    timer = setTimeout(() => finish(new Error(`dondurma ${Math.round(timeoutMs / 60_000)} dakikada bitmedi`)), timeoutMs);
    timer.unref?.();
    worker.on("message", async message => {
      if (settled) return;
      if (message?.type === "batch") {
        try {
          await onBatch(message.rows);
          if (!settled) worker.postMessage({ type: "next" });
        } catch (error) {
          finish(error);
        }
      } else if (message?.type === "done") finish(null, message);
      else finish(new Error(message?.error || "dondurma iş parçacığı başarısız"));
    });
    worker.once("error", error => finish(error instanceof Error ? error : new Error(String(error))));
    worker.once("exit", code => finish(new Error(`dondurma iş parçacığı kapandı (kod ${code})`)));
  });
  return { promise, terminate: () => worker.terminate().catch(() => {}) };
}

/**
 * İç API (routes/ledger.mjs kurar; context.ledger.snapshots). build: güncel kuralın türetmesi (yevmiye, bütün geçmiş). integrity: () => kapı (adoptLock). hook: YALNIZ TEST
 * kancası ({ fn(phase, info) }; "sync" | "batch" | "before-done"). dbPath yoksa (bellek içi, araçlar) iş parçacığı yerine aynı işlemde dondurulur.
 */
export function createLedgerSnapshots({ store, period = null, now = systemClock, build, integrity = () => null, events = null, log = null, dbPath = "", batchLines = 2000, hook = null, canWrite = () => true }) {
  const ready = () => has(store, "ledger_snapshot_runs") && has(store, "ledger_snapshots");
  const batch = Math.max(1, Math.floor(Number(batchLines) || 2000));
  const useWorker = Boolean(dbPath) && dbPath !== ":memory:";
  const lockNow = () => period?.lockedUntil?.() || "";
  const rules = { [LEDGER_RULE_VERSION]: () => build(), [RULE_249]: () => buildRule249(store) };
  const ruleKnown = rule => Object.hasOwn(rules, rule);
  const callHook = (phase, info) => hook?.fn?.(phase, info);
  let closed = false;
  let current = null;
  let activeHandle = null;
  let progress = { running: false, phase: "", done: 0, total: 0, run: 0, error: "" };

  const lastDone = () => store.get("SELECT * FROM ledger_snapshot_runs WHERE state = 'done' ORDER BY no DESC LIMIT 1");
  const pendingRun = () => store.get("SELECT * FROM ledger_snapshot_runs WHERE state = 'pending' ORDER BY no DESC LIMIT 1");
  const coverage = () => (ready() ? lastDone()?.through || "" : "");
  const userOf = user => ({ id: String(user?.id || "system"), name: String(user?.display_name || user?.name || "Sistem") });
  const trace = (type, no, user, payload) => {
    const actor = userOf(user);
    store.run("INSERT INTO audit_events (id, type, entity_id, actor_id, actor_name, payload_json, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)", `event-${randomUUID()}`, type, ENTITY(no), actor.id, actor.name, JSON.stringify(payload), now().toISOString());
  };
  const nextNo = () => Number(store.get("SELECT COALESCE(MAX(no), 0) AS n FROM ledger_snapshot_runs").n) + 1;

  function state() {
    if (!ready()) return { coverage: "", lock: lockNow(), pending: null, runs: 0 };
    const pending = pendingRun();
    return {
      coverage: coverage(),
      lock: lockNow(),
      pending: pending ? { no: pending.no, from: pending.from_date, through: pending.through, rule: pending.rule_version, reason: pending.reason } : null,
      runs: Number(store.get("SELECT COUNT(*) AS n FROM ledger_snapshot_runs").n),
    };
  }
  const status = () => ({ ...progress, coverage: coverage() });

  /** Donmuş maddeler (yevmiye biçimi, dondurma anındaki sıra): from ≤ tarih ≤ min(to, kapsam). */
  function entries({ from = "", to = "" } = {}) {
    const cover = coverage();
    if (!cover) return [];
    const upper = to && to < cover ? to : cover;
    const out = [];
    let entry = null;
    for (const row of store.all(
      "SELECT entry_id AS id, line_no AS lineNo, date, seq, account, sub, party, debit_minor AS debit, credit_minor AS credit, source, text FROM ledger_snapshots WHERE date <= ? AND date >= ? ORDER BY date, run, run_seq",
      upper,
      from || "",
    )) {
      if (!entry || row.lineNo === 1 || row.id !== entry.id) {
        entry = { id: row.id, date: row.date, source: row.source, text: row.text, lines: [] };
        if (row.seq !== null && row.seq !== undefined) entry.seq = Number(row.seq);
        out.push(entry);
      }
      const line = { account: row.account, debit: Number(row.debit), credit: Number(row.credit) };
      if (row.sub) line.sub = row.sub;
      if (row.party) line.party = row.party;
      entry.lines.push(line);
    }
    return out;
  }

  /**
   * Karma yevmiye: ≤ kapsam donmuş; (kapsam, bekleyen koşunun günü] bekleyen koşunun kuralıyla; sonrası güncel kuralla. live: aynı çağrıda kurulmuş güncel türetme (ikinci kez
   * kurulmaz). to ≤ kapsam ise canlı türetme yapılmaz.
   */
  function book({ to = "", live = null } = {}) {
    if (!ready()) return live || build();
    const cover = coverage();
    if (cover && to && to <= cover) return entries({ to });
    const fresh = live || build();
    const frozen = cover ? entries() : [];
    const pending = pendingRun();
    let middle = [];
    let tail = cover ? fresh.filter(entry => entry.date > cover) : fresh;
    if (pending && pending.rule_version !== LEDGER_RULE_VERSION && ruleKnown(pending.rule_version)) {
      middle = rules[pending.rule_version]().filter(entry => entry.date > cover && entry.date <= pending.through);
      tail = tail.filter(entry => entry.date > pending.through);
    }
    return [...frozen, ...middle, ...tail];
  }

  function insertRun({ kind, state: runState, from, through, rule = "", reason, user, totals = null }) {
    const no = nextNo();
    const actor = userOf(user);
    const t = totals || {};
    store.run(
      `INSERT INTO ledger_snapshot_runs (no, id, kind, state, from_date, through, rule_version, reason, state_lines, state_debit, state_credit, state_weight, created_by, created_at, finished_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      no, `lsr-${randomUUID()}`, kind, runState, from, through, rule, reason, t.lines || 0, t.debit || 0, t.credit || 0, t.weight || 0, actor.id, now().toISOString(), runState === "done" ? now().toISOString() : "",
    );
    return store.get("SELECT * FROM ledger_snapshot_runs WHERE no = ?", no);
  }
  const abandon = run => store.run("UPDATE ledger_snapshot_runs SET state = 'abandoned', finished_at = ? WHERE no = ? AND state = 'pending'", now().toISOString(), run.no);
  const staleExists = () => Boolean(store.get(`SELECT 1 AS found FROM ledger_snapshots WHERE date > ${COVERAGE_SQL} LIMIT 1`));
  const purgeStaleInTx = () => store.run(`DELETE FROM ledger_snapshots WHERE date > ${COVERAGE_SQL}`);
  /** Görünen donmuş satırların toplamları (kapsam içi). */
  const visibleTotals = (upper = coverage()) => {
    const row = store.get(`SELECT COUNT(*) AS lines, COALESCE(SUM(debit_minor), 0) AS debit, COALESCE(SUM(credit_minor), 0) AS credit, ${WEIGHT_SQL} AS weight FROM ledger_snapshots WHERE date <= ?`, upper);
    return { lines: Number(row.lines), debit: Number(row.debit), credit: Number(row.credit), weight: Number(row.weight) };
  };

  function thaw({ next, user, reason }) {
    const cover = coverage();
    const prev = lastDone();
    let totals = { lines: 0, debit: 0, credit: 0, weight: 0 };
    if (next) {
      const removed = store.get(`SELECT COUNT(*) AS lines, COALESCE(SUM(debit_minor), 0) AS debit, COALESCE(SUM(credit_minor), 0) AS credit, ${WEIGHT_SQL} AS weight FROM ledger_snapshots WHERE date > ? AND date <= ?`, next, cover);
      totals = { lines: Number(prev?.state_lines || 0) - Number(removed.lines), debit: Number(prev?.state_debit || 0) - Number(removed.debit), credit: Number(prev?.state_credit || 0) - Number(removed.credit), weight: Number(prev?.state_weight || 0) - Number(removed.weight) };
    }
    const run = insertRun({ kind: "thaw", state: "done", from: cover, through: next, reason, user, totals });
    trace(THAWED_TRACE, run.no, user, { from: cover, through: next, reason });
    return run;
  }

  /** Bekleyen koşuyu bu işlemin içinde dondurur (eşzamanlı kip): türet, yaz, tamamla. */
  function freezeInTx(run, user) {
    callHook("sync", { run: run.no });
    if (!ruleKnown(run.rule_version)) throw new Error(`Donmuş defter: ${run.rule_version} kuralı programda yok.`);
    const { rows, totals } = snapshotRowsOf(rules[run.rule_version](), { from: run.from_date, through: run.through });
    rows.forEach((row, index) => store.run(INSERT_LINE, run.no, index + 1, ...row, run.rule_version));
    complete(run, totals, lockDigestOf(store, run.through, { version: LOCK_SQL_VERSION }), user);
    return run;
  }

  function complete(run, totals, digest, user) {
    const prev = lastDone();
    const state = { lines: Number(prev?.state_lines || 0) + totals.lines, debit: Number(prev?.state_debit || 0) + totals.debit, credit: Number(prev?.state_credit || 0) + totals.credit, weight: Number(prev?.state_weight || 0) + totals.weight };
    const changed = store.run(
      `UPDATE ledger_snapshot_runs SET state = 'done', line_count = ?, entry_count = ?, debit_minor = ?, credit_minor = ?, state_lines = ?, state_debit = ?, state_credit = ?, state_weight = ?,
         source_digest = ?, digest_version = ?, finished_at = ? WHERE no = ? AND state = 'pending'`,
      totals.lines, totals.entries, totals.debit, totals.credit, state.lines, state.debit, state.credit, state.weight, digest, LOCK_SQL_VERSION, now().toISOString(), run.no,
    ).changes;
    if (!changed) throw new Cancelled("koşu artık bekleyen koşu değil");
    trace(FROZEN_TRACE, run.no, user, { from: run.from_date, through: run.through, rule: run.rule_version, reason: run.reason, lines: totals.lines, entries: totals.entries });
  }

  /**
   * Kilit kancası — kilidi değiştiren işlemin İÇİNDE çağrılır (PUT period-lock, vouchers.postAll lockThrough). sync: aynı işlemde dondur (bayat satırlar da aynı işlemde silinir).
   * Dönüş: { action: "none" | "freeze" | "thaw", run }.
   */
  function lockChanged({ next = "", user = null, reason = "lock", sync = false } = {}) {
    if (!ready()) return { action: "none" };
    if (!store.inTransaction) throw new Error("Donmuş defter kilit kancası yalnız kilidi değiştiren işlemin içinde çağrılır (store.tx).");
    const target = String(next || "");
    const pending = pendingRun();
    // Aynı güne yinelenen kilit: bekleyen koşu güncel kuralla aynı aralığı donduruyorsa sürer (iş kaldığı yerden).
    if (pending && pending.through === target && pending.rule_version === LEDGER_RULE_VERSION && !sync) return { action: "freeze", run: pending };
    if (pending) abandon(pending);
    const cover = coverage();
    if (target === cover) return { action: "none" };
    if (target > cover) {
      if (staleExists()) purgeStaleInTx();
      const run = insertRun({ kind: "freeze", state: "pending", from: cover, through: target, rule: LEDGER_RULE_VERSION, reason, user });
      if (sync) freezeInTx(run, user);
      return { action: "freeze", run };
    }
    const run = thaw({ next: target, user, reason });
    if (sync) purgeStaleInTx();
    return { action: "thaw", run };
  }

  /**
   * D4 (devir arşivi, Devri Yenile): kilit bu işlemde through'a konduktan SONRA, aynı işlemde (kapsam, through] dönemini verilen kuralla dondurur. Kapsam ≤ kilit
   * değişmezi: through kilidi aşamaz. Dönüş: koşu.
   */
  function freezeSync({ through, user = null, reason = "api", rule = LEDGER_RULE_VERSION } = {}) {
    if (!ready()) throw new Error("Donmuş defter tabloları yok (göç 47).");
    if (!store.inTransaction) throw new Error("freezeSync yalnız veri tabanı işleminin içinde çağrılır (store.tx).");
    if (!through || through > lockNow()) throw new Error(`Donmuş defter: ${through || "boş"} günü dönem kilidini (${lockNow() || "yok"}) aşıyor; önce kilit konur.`);
    if (!ruleKnown(rule)) throw new Error(`Donmuş defter: ${rule} kuralı programda yok.`);
    const pending = pendingRun();
    if (pending) abandon(pending);
    const cover = coverage();
    if (through <= cover) throw new Error(`Donmuş defter: ${through} zaten donmuş (kapsam ${cover}).`);
    if (staleExists()) purgeStaleInTx();
    return freezeInTx(insertRun({ kind: "freeze", state: "pending", from: cover, through, rule, reason, user }), user);
  }

  /** Bayat satırlar (kapsamın üstü: geri çekilmiş dönem, yarım koşu) parça parça silinir; her parça ayrı küçük işlem. */
  async function purgeStale() {
    if (!ready()) return 0;
    let removed = 0;
    for (;;) {
      if (closed) return removed;
      const n = store.tx(() => Number(store.run(`DELETE FROM ledger_snapshots WHERE (run, run_seq) IN (SELECT run, run_seq FROM ledger_snapshots WHERE date > ${COVERAGE_SQL} LIMIT ?)`, batch).changes) || 0);
      removed += n;
      if (n < batch) return removed;
      await yieldTick();
    }
  }

  const stillPending = no => {
    const run = pendingRun();
    return Boolean(run && run.no === no && run.no === Number(store.get("SELECT MAX(no) AS n FROM ledger_snapshot_runs").n));
  };

  async function freezeRun(run) {
    progress = { running: true, phase: "temizlik", done: 0, total: 0, run: run.no, error: "" };
    let handle = null;
    const publish = () => events?.publish?.("ledger.freeze", { run: run.no, phase: progress.phase, done: progress.done, total: progress.total, through: run.through });
    try {
      await purgeStale();
      if (closed || !stillPending(run.no)) throw new Cancelled("koşu değişti");
      if (!ruleKnown(run.rule_version)) {
        // Kuralı bu programda olmayan (eski bir sürümün açtığı) bekleyen koşu: bırakılır, aynı aralık güncel kuralla yeniden açılır.
        log?.warn?.(`Donmuş defter: ${run.rule_version} kuralı programda yok; ${run.through} güncel kuralla dondurulacak.`);
        store.tx(() => {
          abandon(run);
          if (staleExists()) purgeStaleInTx();
          insertRun({ kind: "freeze", state: "pending", from: coverage(), through: run.through, rule: LEDGER_RULE_VERSION, reason: run.reason });
        });
        throw new Cancelled("kural yeniden seçildi");
      }
      if (!useWorker) {
        progress.phase = "yazım";
        store.tx(() => {
          if (!stillPending(run.no)) throw new Cancelled("koşu değişti");
          freezeInTx(run, null);
        });
      } else {
        progress.phase = "türetme";
        publish();
        let seq = 0;
        const own = { lines: 0, entries: 0, debit: 0, credit: 0, weight: 0 };
        let lastEntry = null;
        handle = activeHandle = startFreezeWorker({ dbPath, time: now().toISOString(), batchLines: batch, run: { no: run.no, from: run.from_date, through: run.through, rule: run.rule_version } }, {
          onBatch: async rows => {
            if (closed) throw new Cancelled("program kapanıyor");
            progress.phase = "yazım";
            store.tx(() => {
              if (!stillPending(run.no)) throw new Cancelled("koşu değişti");
              for (const row of rows) {
                seq += 1;
                store.run(INSERT_LINE, run.no, seq, ...row, run.rule_version);
                if (row[1] === 1 || row[0] !== lastEntry) own.entries += 1;
                lastEntry = row[0];
                own.lines += 1;
                own.debit += row[8];
                own.credit += row[9];
                own.weight += weightOf(row[5], row[8], row[9]);
              }
            });
            progress.done = seq;
            publish();
            await callHook("batch", { run: run.no, done: seq });
            await yieldTick();
          },
        });
        const done = await handle.promise;
        progress.total = Number(done.lines) || 0;
        if (done.lines !== own.lines || done.debit !== own.debit || done.credit !== own.credit) throw new Error(`Donmuş defter: yazılan satırlar türetmeyle tutmuyor (${own.lines}/${done.lines})`);
        await callHook("before-done", { run: run.no });
        if (closed) throw new Cancelled("program kapanıyor");
        store.tx(() => {
          if (!stillPending(run.no)) throw new Cancelled("koşu değişti");
          complete(run, { ...own, entries: Number(done.entries) || own.entries }, done.digest, null);
        });
        // Kapının kilit izi: dondurmanın anlık görüntüsünden (kilit o günse).
        if (lockNow() === run.through) integrity()?.adoptLock?.({ lock: run.through, digest: done.digest });
      }
      progress.phase = "tamam";
      log?.info?.(`Donmuş defter: ${run.through} ve öncesi donduruldu (${run.rule_version}).`);
    } catch (error) {
      if (error instanceof Cancelled || closed) progress.phase = "durdu";
      else {
        progress.error = /full/i.test(String(error?.message)) ? `Disk dolu: ${error.message}` : String(error?.message || error);
        progress.phase = "hata";
        log?.warn?.(`Donmuş defter: ${run.through} dondurulamadı (${progress.error}); koşu bekliyor, sonraki denemede sürer.`);
      }
    } finally {
      progress.running = false;
      handle?.terminate();
      activeHandle = null;
      publish();
    }
  }

  /** Bekleyen koşuyu (varsa) dondurur; süren iş varsa onu bekler. Aynı çağrıda başarısız olan koşu yeniden denenmez (sonraki çağrı dener). */
  async function runPending() {
    const tried = new Set();
    for (let round = 0; round < 6; round += 1) {
      if (current) {
        await current;
        continue;
      }
      if (closed || !ready() || !canWrite()) break;
      const run = pendingRun();
      if (!run) {
        // Bekleyen koşu yok: geri çekilmiş dönemin bayat satırları (açılış onarımının thaw'ı dahil) temizlenir.
        await purgeStale();
        break;
      }
      if (tried.has(run.no)) break;
      tried.add(run.no);
      current = freezeRun(run).finally(() => {
        current = null;
      });
      await current;
    }
    return status();
  }

  /** Yalnız kilit izi (kilit geri çekilince; iş parçacığında, dosya yolu yoksa yerinde). */
  async function digestOf(lock) {
    if (!lock) return "";
    if (!useWorker) return lockDigestOf(store, lock, { version: LOCK_SQL_VERSION });
    const handle = startFreezeWorker({ dbPath, time: now().toISOString(), batchLines: batch, run: null, lock }, { onBatch: async () => {} });
    try {
      return (await handle.promise).digest;
    } finally {
      handle.terminate();
    }
  }

  /**
   * Açılış onarımı (göçlerden sonra, kapıdan önce; BS-7 yeni şemalı dosyada çağrılmaz): eski sürüm kilidi değiştirdiyse kapsam kilide getirilir (ileri: bekleyen koşu GAP_RULE
   * kuralıyla; geri: thaw), yarım / bayat koşu sürdürülmek üzere bırakılır. Dönüş: { action, pending } ya da null.
   */
  function repairOnOpen() {
    if (!ready() || !canWrite()) return null;
    return store.tx(() => {
      const lock = lockNow();
      let pending = pendingRun();
      const cover = coverage();
      let action = "none";
      if (pending && pending.through !== lock) {
        abandon(pending);
        pending = null;
      }
      if (!pending && lock > cover) {
        if (staleExists()) purgeStaleInTx();
        insertRun({ kind: "freeze", state: "pending", from: cover, through: lock, rule: GAP_RULE, reason: "repair" });
        action = "freeze";
        log?.warn?.(`Donmuş defter: kilit (${lock}) donmuş dönemin (${cover || "yok"}) ötesinde (eski sürüm); aradaki dönem ${GAP_RULE} kuralıyla dondurulacak.`);
      } else if (lock < cover) {
        thaw({ next: lock, user: null, reason: "repair" });
        action = "thaw";
        log?.warn?.(`Donmuş defter: kilit (${lock || "yok"}) donmuş dönemin (${cover}) gerisinde (eski sürüm); kapsam kilide indirildi.`);
      }
      return { action, pending: Boolean(pendingRun()) };
    });
  }

  /**
   * Kural Değişikliği Farkı: kapsam içindeki her madde donmuş ↔ güncel türetme (tarih + satırlar). Fiş maddeleri (voucher-*) saklanan satırdır, karşılaştırılmaz.
   * Dönüş: { through, count, sample, balances: [{ year, account, sub, party, frozenMinor, liveMinor, differenceMinor }] } — tutarlar fark doğuran maddelerindir.
   */
  function ruleDiff({ live = null } = {}) {
    const through = coverage();
    if (!through) return { through, count: 0, sample: [], balances: [] };
    const keyed = list => {
      const out = new Map();
      const seen = new Map();
      for (const entry of list) {
        if (entry.date > through || String(entry.id).startsWith("voucher")) continue;
        const n = (seen.get(entry.id) || 0) + 1;
        seen.set(entry.id, n);
        out.set(`${entry.id}#${n}`, entry);
      }
      return out;
    };
    const frozen = keyed(entries());
    const current = keyed(live || build());
    const sums = new Map();
    const add = (entry, sign, side) => {
      if (!entry) return;
      for (const line of entry.lines) {
        const key = `${entry.date.slice(0, 4)}|${line.account}|${line.sub || ""}|${line.party || ""}`;
        const row = sums.get(key) || { frozen: 0, live: 0 };
        row[side] += sign * ((Number(line.debit) || 0) - (Number(line.credit) || 0));
        sums.set(key, row);
      }
    };
    let count = 0;
    const sample = [];
    for (const key of new Set([...frozen.keys(), ...current.keys()])) {
      const a = frozen.get(key);
      const b = current.get(key);
      if (a && b && contentOf(a) === contentOf(b)) continue;
      count += 1;
      if (sample.length < 5) sample.push(`${(a || b).id} (${dayText((a || b).date)})${a ? "" : " · donmuş defterde yok"}${b ? "" : " · güncel türetmede yok"}`);
      add(a, 1, "frozen");
      add(b, 1, "live");
    }
    const balances = [];
    for (const [key, row] of sums) {
      if (row.frozen === row.live) continue;
      const [year, account, sub, party] = key.split("|");
      balances.push({ year: Number(year), account, sub, party, frozenMinor: row.frozen, liveMinor: row.live, differenceMinor: row.live - row.frozen });
    }
    balances.sort((x, y) => x.year - y.year || x.account.localeCompare(y.account) || x.sub.localeCompare(y.sub) || x.party.localeCompare(y.party));
    return { through, count, sample, balances };
  }

  /**
   * Mutabakat denetimleri (lib/integrity.mjs run; yalnız tam taramada): "ledger:snapshot" (yapı, kapsam = kilit, kaynak izi) ve "ledger:rule-diff" (uyarı düzeyi). Donmuş koşu
   * hiç yoksa ya da denetim tamamsa görünmez (includeHidden hariç): kilitsiz / sağlıklı şirketin denetim listesi 2.4.9 ile aynı kalır.
   */
  function checks({ entries: live = null, includeHidden = false } = {}) {
    if (!ready() || !store.get("SELECT 1 AS found FROM ledger_snapshot_runs LIMIT 1")) return [];
    const cover = coverage();
    const lock = lockNow();
    const pending = pendingRun();
    const problems = [];
    if (cover !== lock && !(pending && pending.through === lock)) problems.push(`Donmuş dönem (${dayText(cover) || "yok"}) dönem kilidiyle (${dayText(lock) || "yok"}) uyuşmuyor`);
    const last = lastDone();
    if (last) {
      const seen = visibleTotals(cover);
      if (seen.lines !== Number(last.state_lines) || seen.debit !== Number(last.state_debit) || seen.credit !== Number(last.state_credit) || seen.weight !== Number(last.state_weight)) {
        problems.push(`Donmuş satırlar eksik ya da değişmiş (görünen ${seen.lines} satır, borç ${seen.debit / 100}, alacak ${seen.credit / 100}; kayıtlı ${last.state_lines} satır)`);
      }
      if (last.kind === "freeze" && last.through === cover && last.source_digest && lockDigestOf(store, cover, { version: last.digest_version || LOCK_SQL_VERSION }) !== last.source_digest) {
        problems.push(`Donmuş Dönemin Kaynağı Değişti: ${dayText(cover)} ve öncesinin kaynak kayıtları dondurmadan sonra kapının görmediği bir yolla (eski sürüm, dış yazım) değişti; Kilidi Aç → Yeniden Kilitle ile güncel veri donar`);
      }
    }
    // Uyarı düzeyi: bu denetim kapıda (COMMIT) koşmaz, yeni işlemleri engellemez; çözümü kullanıcının elindedir (Kilidi Aç → Yeniden Kilitle).
    const items = [{
      code: "ledger:snapshot",
      name: `Donmuş Defter (${cover ? `${dayText(cover)} ve öncesi` : "yok"})${pending ? " · Dondurma Sürüyor" : ""}`,
      ok: problems.length === 0,
      count: problems.length,
      sample: problems.slice(0, 5),
      ...(problems.length ? { severity: "warning", hint: "Kilitli dönemin raporları donmuş defterden okunur. Kaynak kayıtlar kilitliyken değiştiyse (eski sürüm, dış yazım) yönetici kilidi açıp yeniden kilitleyince güncel veri donar." } : {}),
    }];
    if (cover) {
      const diff = ruleDiff({ live });
      const byAccount = new Map();
      for (const row of diff.balances) {
        const item = byAccount.get(row.account) || { account: row.account, frozenMinor: 0, liveMinor: 0, differenceMinor: 0 };
        item.frozenMinor += row.frozenMinor;
        item.liveMinor += row.liveMinor;
        item.differenceMinor += row.differenceMinor;
        byAccount.set(row.account, item);
      }
      items.push({
        code: "ledger:rule-diff",
        name: `Kural Değişikliği Farkı (Kilitli Dönem: ${dayText(cover)} ve öncesi)`,
        ok: diff.count === 0,
        count: diff.count,
        difference: [...byAccount.values()].reduce((sum, row) => sum + Math.abs(row.differenceMinor), 0) / 200,
        sample: diff.sample,
        breakdown: [...byAccount.values()].filter(row => row.differenceMinor),
        ...(diff.count ? { severity: "warning", hint: "Defter kuralı program sürümüyle değişti. Kilitli dönemin raporları donmuş defterden okunur, değişmez; fark Kural Farkı Düzeltme Fişi ile ilk açık güne alınır." } : {}),
      });
    }
    return items.filter(item => includeHidden || !item.ok);
  }

  /** Süren işi durdurur (sıfırlama, geri yükleme, kapanış): iş parçacığı sonlandırılır, sonraki işlem adımı yazmaz. */
  function cancel() {
    const running = current;
    if (running) closed = true;
    activeHandle?.terminate();
    return running ? running.finally(() => {
      closed = false;
    }) : Promise.resolve();
  }
  async function close() {
    closed = true;
    if (current) await current.catch(() => {});
  }

  return { state, status, entries, book, lockChanged, freezeSync, purgeStale, runPending, digestOf, repairOnOpen, ruleDiff, checks, cancel, close, coverage, journalOrder };
}

/** İç API hata biçimi (uçlar için). */
export const snapshotError = (status, message, code) => new HttpError(status, message, { code });
