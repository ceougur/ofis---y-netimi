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
import { CHART, JOURNAL_CLASS, LEDGER_RULE_VERSION, journalOrder } from "./general-ledger.mjs";
import { roundMoney } from "./money.mjs";
import { HttpError } from "./http.mjs";
import { LOCK_SQL_VERSION, lockDigestOf } from "./integrity.mjs";
import { RULE_249, buildRule249 } from "./ledger-rule-249/index.mjs";
import { leanRows, leanStore } from "./lean-rows.mjs";
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
 * Yevmiye maddelerinden (from, through] aralığının donmuş satırları, yevmiye sırasıyla ve parça parça (en çok `size` satırlık diziler): her satır [entryId, lineNo, date, cls,
 * seq, account, sub, party, debit, credit, source, text]. totals (verilen nesne) satırlar üretildikçe dolar; son parçadan sonra tamdır. İşlemin ve iş parçacığının ortak işlevi.
 * 2.5.0 Ç3 tamamlama (ders 47): bütün aralığın satırları tek dizide kurulmaz (1.000.000 satırlık şirkette yüz MB'larca ek yığın).
 */
export function* snapshotBatches(entries, { from = "", through, size = 2000, totals = { lines: 0, entries: 0, debit: 0, credit: 0, weight: 0 } }) {
  const limit = Math.max(1, Math.floor(Number(size) || 2000));
  let part = [];
  for (const entry of entries) {
    if (!(entry.date > from && entry.date <= through)) continue;
    totals.entries += 1;
    const cls = classOf(entry.id);
    const seq = Number.isSafeInteger(entry.seq) ? entry.seq : null;
    for (let index = 0; index < entry.lines.length; index += 1) {
      const line = entry.lines[index];
      const debit = Number(line.debit) || 0;
      const credit = Number(line.credit) || 0;
      part.push([String(entry.id), index + 1, entry.date, cls, seq, String(line.account), line.sub ? String(line.sub) : "", line.party ? String(line.party) : "", debit, credit, index === 0 ? String(entry.source || "") : "", index === 0 ? String(entry.text || "") : ""]);
      totals.lines += 1;
      totals.debit += debit;
      totals.credit += credit;
      totals.weight += weightOf(line.account, debit, credit);
      if (part.length >= limit) {
        yield part;
        part = [];
      }
    }
  }
  if (part.length) yield part;
}

/** Donmuş satırların tamamı tek dizide + toplamlar (küçük veri ve testler için; büyük yol snapshotBatches). */
export function snapshotRowsOf(entries, { from = "", through }) {
  const totals = { lines: 0, entries: 0, debit: 0, credit: 0, weight: 0 };
  const rows = [];
  for (const part of snapshotBatches(entries, { from, through, totals })) rows.push(...part);
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
  // 2.4.9 kopyası (değiştirilemez) sıkı satırlı depoyla okur (lib/lean-rows.mjs; ders 47) — çıktı aynı.
  const rules = { [LEDGER_RULE_VERSION]: () => build(), [RULE_249]: () => buildRule249(leanStore(store)) };
  const ruleKnown = rule => Object.hasOwn(rules, rule);
  const callHook = (phase, info) => hook?.fn?.(phase, info);
  // shut: kapanış (kalıcı); stopping: süren işin durdurulması (sıfırlama, başka güne kilit; iş bitince kalkar). İkisinden biri → yazım adımı atılmaz.
  let shut = false;
  let stopping = false;
  const halted = () => shut || stopping;
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

  /**
   * Donmuş maddeler birer birer (yevmiye biçimi, dondurma anındaki sıra): from ≤ tarih ≤ min(to, kapsam). Satırlar tek tek okunur (lib/lean-rows.mjs; ders 47 — store.all
   * 1.000.000 satırlık şirketin donmuş satırlarını sözlük kipli nesnelerle yığına yığıp programı çökertirdi). Yalnız eşzamanlı tüketilir (okuma arasında yazım yok).
   */
  function* frozenEntries({ from = "", to = "" } = {}) {
    const cover = coverage();
    if (!cover) return;
    const upper = to && to < cover ? to : cover;
    let entry = null;
    for (const row of leanRows(
      store,
      "SELECT entry_id AS id, line_no AS lineNo, date, seq, account, sub, party, debit_minor AS debit, credit_minor AS credit, source, text FROM ledger_snapshots WHERE date <= ? AND date >= ? ORDER BY date, run, run_seq",
      [upper, from || ""],
    )) {
      if (!entry || row.lineNo === 1 || row.id !== entry.id) {
        if (entry) yield entry;
        entry = { id: row.id, date: row.date, source: row.source, text: row.text, lines: [] };
        if (row.seq !== null && row.seq !== undefined) entry.seq = Number(row.seq);
      }
      const line = { account: row.account, debit: Number(row.debit), credit: Number(row.credit) };
      if (row.sub) line.sub = row.sub;
      if (row.party) line.party = row.party;
      entry.lines.push(line);
    }
    if (entry) yield entry;
  }
  /** Donmuş maddeler (dizi). */
  const entries = ({ from = "", to = "" } = {}) => Array.from(frozenEntries({ from, to }));

  /**
   * Karma yevmiye: ≤ kapsam donmuş; (kapsam, bekleyen koşunun günü] bekleyen koşunun kuralıyla; sonrası güncel kuralla. live: aynı çağrıda kurulmuş güncel türetme (ikinci kez
   * kurulmaz). to ≤ kapsam ise canlı türetme yapılmaz; from verilirse donmuş satırlar yalnız from'dan okunur (dönem raporu; mizan için trial()).
   */
  function book({ from = "", to = "", live = null } = {}) {
    if (!ready()) return live || build();
    const cover = coverage();
    if (cover && to && to <= cover) return entries({ from, to });
    const frozen = cover ? entries({ from }) : [];
    return [...frozen, ...afterCoverage(cover, live || build())];
  }
  /** Kapsamın sonrası: (kapsam, bekleyen koşunun günü] bekleyen koşunun kuralıyla (2.4.9 göç koşusu), sonrası güncel türetme. */
  function afterCoverage(cover, fresh) {
    const pending = pendingRun();
    let middle = [];
    let tail = cover ? fresh.filter(entry => entry.date > cover) : fresh;
    if (pending && pending.rule_version !== LEDGER_RULE_VERSION && ruleKnown(pending.rule_version)) {
      middle = rules[pending.rule_version]().filter(entry => entry.date > cover && entry.date <= pending.through);
      tail = tail.filter(entry => entry.date > pending.through);
    }
    return [...middle, ...tail];
  }

  /**
   * Karma mizan (lib/general-ledger.mjs trialBalance ile AYNI sonuç; test/donmus-defter-250.test.mjs denetler): donmuş dönem SQL toplamıyla (satırlar JS nesnesine çevrilmez;
   * ders 47), kapsamın sonrası karma yevmiyenin maddeleriyle. live: aynı çağrıda kurulmuş güncel türetme.
   */
  function trial({ from = "", to = "", live = null } = {}) {
    const cover = ready() ? coverage() : "";
    if (!cover) return trialOf([], 0, { from, to }, ready() ? afterCoverage("", live || build()) : live || build());
    const upper = to && to < cover ? to : cover;
    const { rows, unbalanced } = frozenTrial(cover, from || "", upper);
    const tail = cover && to && to <= cover ? [] : afterCoverage(cover, live || build());
    return trialOf(rows, unbalanced, { from, to }, tail);
  }
  // Donmuş dönemin mizan toplamları (100.000 satırda ~0,5 sn): donmuş satırlar değişmez — sonuç koşu durumu (son koşu, kapsam) ve bağlantının data_version'ıyla (başka bağlantının
  // yazımı) anahtarlanıp saklanır; kilit değişince ya da dış yazımda anahtar değişir. En çok 16 aralık.
  const trialCache = new Map();
  function frozenTrial(cover, from, upper) {
    let version = "";
    try {
      version = String(store.changeCounters?.().version ?? "");
    } catch {
      version = "";
    }
    const key = `${cover}|${store.get("SELECT COALESCE(MAX(no), 0) AS n FROM ledger_snapshot_runs").n}|${version}|${from}|${upper}`;
    if (version && trialCache.has(key)) return trialCache.get(key);
    const value = {
      rows: store.all(
        `SELECT account, SUM(CASE WHEN date < ?1 THEN debit_minor - credit_minor ELSE 0 END) AS opening, SUM(CASE WHEN date >= ?1 THEN debit_minor ELSE 0 END) AS debit,
                SUM(CASE WHEN date >= ?1 THEN credit_minor ELSE 0 END) AS credit
         FROM ledger_snapshots WHERE date <= ?2 GROUP BY account`,
        from, upper,
      ),
      // trialBalance maddeyi "dengesiz" sayar; donmuş maddenin satırları ardışıktır (aynı koşu, aynı madde).
      unbalanced: Number(store.get("SELECT COUNT(*) AS n FROM (SELECT 1 FROM ledger_snapshots WHERE date <= ? GROUP BY run, entry_id, date HAVING SUM(debit_minor - credit_minor) <> 0)", upper).n),
    };
    if (version) {
      if (trialCache.size >= 16) trialCache.delete(trialCache.keys().next().value);
      trialCache.set(key, value);
    }
    return value;
  }
  function trialOf(frozenRows, frozenUnbalanced, { from, to }, entriesAfter) {
    const accounts = new Map();
    let debit = 0;
    let credit = 0;
    let unbalanced = frozenUnbalanced;
    for (const row of frozenRows) {
      accounts.set(row.account, { code: row.account, name: CHART[row.account] || row.account, opening: Number(row.opening), debit: Number(row.debit), credit: Number(row.credit) });
      debit += Number(row.debit);
      credit += Number(row.credit);
    }
    for (const entry of entriesAfter) {
      if (to && entry.date > to) continue;
      const before = from && entry.date < from;
      let own = 0;
      for (const line of entry.lines) {
        own += line.debit - line.credit;
        const row = accounts.get(line.account) || { code: line.account, name: CHART[line.account] || line.account, opening: 0, debit: 0, credit: 0 };
        if (before) row.opening += line.debit - line.credit;
        else {
          row.debit += line.debit;
          row.credit += line.credit;
          debit += line.debit;
          credit += line.credit;
        }
        accounts.set(line.account, row);
      }
      if (own !== 0) unbalanced += 1;
    }
    const tl = value => roundMoney(value / 100);
    const list = [...accounts.values()].sort((a, b) => a.code.localeCompare(b.code)).map(row => ({ ...row, balance: row.opening + row.debit - row.credit }));
    return {
      accounts: list.map(row => ({ code: row.code, name: row.name, opening: tl(row.opening), debit: tl(row.debit), credit: tl(row.credit), balance: tl(row.balance) })),
      totals: { debit: tl(debit), credit: tl(credit), difference: tl(debit - credit) },
      balanced: debit === credit && unbalanced === 0,
      unbalanced,
    };
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
    const totals = { lines: 0, entries: 0, debit: 0, credit: 0, weight: 0 };
    let seq = 0;
    for (const part of snapshotBatches(rules[run.rule_version](), { from: run.from_date, through: run.through, size: batch, totals })) {
      for (const row of part) store.run(INSERT_LINE, run.no, (seq += 1), ...row, run.rule_version);
    }
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
      if (halted()) return removed;
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
      if (halted() || !stillPending(run.no)) throw new Cancelled("koşu değişti");
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
            if (halted()) throw new Cancelled("program kapanıyor");
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
        if (halted()) throw new Cancelled("program kapanıyor");
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
      if (error instanceof Cancelled || halted()) progress.phase = "durdu";
      else {
        // İş parçacığının yığını dolarsa (ERR_WORKER_OUT_OF_MEMORY) süreç ayakta kalır, koşu bekler; neden Türkçe (ders 47, tasarım notu §16).
        const memory = error?.code === "ERR_WORKER_OUT_OF_MEMORY" || /memory limit|heap out of memory/i.test(String(error?.message));
        progress.error = /full/i.test(String(error?.message)) ? `Disk dolu: ${error.message}` : memory ? `Bellek yetmedi: ${error.message}` : String(error?.message || error);
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
      if (halted() || !ready() || !canWrite()) break;
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
    // Madde anahtarı: kimlik + kimliğin kaçıncı geçişi (aynı kimlikli iki madde ayrı karşılaştırılır).
    const keyer = () => {
      const seen = new Map();
      return entry => {
        if (entry.date > through || String(entry.id).startsWith("voucher")) return null;
        const n = (seen.get(entry.id) || 0) + 1;
        seen.set(entry.id, n);
        return `${entry.id}#${n}`;
      };
    };
    const current = new Map();
    const currentKey = keyer();
    for (const entry of live || build()) {
      const key = currentKey(entry);
      if (key) current.set(key, entry);
    }
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
    const differ = (a, b) => {
      if (a && b && contentOf(a) === contentOf(b)) return;
      count += 1;
      if (sample.length < 5) sample.push(`${(a || b).id} (${dayText((a || b).date)})${a ? "" : " · donmuş defterde yok"}${b ? "" : " · güncel türetmede yok"}`);
      add(a, 1, "frozen");
      add(b, 1, "live");
    };
    // Donmuş maddeler birer birer (dizi kurulmaz; ders 47), dondurma sırasıyla; eşi bulunan güncel madde listeden düşer. Sonra yalnız güncel türetmede olanlar, türetme
    // sırasıyla — sıra (örnekler) önceki birleşik küme sırasıyla aynı: önce donmuş anahtarlar, sonra yalnız güncelde olanlar.
    const frozenKey = keyer();
    for (const a of frozenEntries()) {
      const key = frozenKey(a);
      if (!key) continue;
      const b = current.get(key);
      if (b) current.delete(key);
      differ(a, b);
    }
    for (const b of current.values()) differ(undefined, b);
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
    if (running) stopping = true;
    activeHandle?.terminate();
    return running ? running.finally(() => {
      stopping = false;
    }) : Promise.resolve();
  }
  async function close() {
    shut = true;
    if (current) await current.catch(() => {});
  }

  return { state, status, entries, book, trial, lockChanged, freezeSync, purgeStale, runPending, digestOf, repairOnOpen, ruleDiff, checks, cancel, close, coverage, journalOrder };
}

/** İç API hata biçimi (uçlar için). */
export const snapshotError = (status, message, code) => new HttpError(status, message, { code });
