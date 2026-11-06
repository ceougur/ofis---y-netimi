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

/**
 * Eski sürümün (≤ 2.4.9; BS-7 kapısını bilmez) değiştirdiği dönemi donduran kural: kilidi ilerlettiyse aradaki dönem, dosyayı sıfırlayıp yeniden kilitlediyse (donmuş satırları
 * silindi) yeniden donan dönem. KULLANICI KARARI 06.11.2026 03:35 (S13 = A): 2.4.9 kopyası.
 */
export const GAP_RULE = RULE_249;
export const FROZEN_TRACE = "ledger.snapshot.frozen";
export const THAWED_TRACE = "ledger.snapshot.thawed";
/** Eski kurallı (göç / onarım) bekleyen koşu sürerken bu programın kilidi ilerlettiği gün (yük { through, reason }): koşu tamamlanınca kalan dönem o güne kadar güncel kuralla donar. */
export const EXTENDED_TRACE = "ledger.snapshot.extended";
/**
 * Defter kuralının sürüm geçmişi, eskiden yeniye (tasarım notu §5). Son öğe güncel kuraldır (LEDGER_RULE_VERSION). Kural yükselince önceki güncel kural silinmez: türetmesi
 * server/lib/ledger-rule-<sürüm, noktasız>/ klasörüne AYNEN kopyalanır, kayıt defterine (createLedgerSnapshots rules ve dondurma iş parçacığı) eklenir, bu listeye yenisi
 * eklenir — eski sürümde açılmış bekleyen koşu (göç, onarım) kendi kuralıyla donar. test/donmus-defter-tur1-250.test.mjs (kayıt defteri denetimi) eksiği yakalar.
 */
export const RULE_HISTORY = Object.freeze(["2.4.9", "2.5.0"]);
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
 * "Kural Değişikliği Farkı"nın açıklaması (Ç3 tur 1 K4): nedeni bilinmeyen ayrışma "kural değişti" diye adlandırılmaz — tarafsız; neden biliniyorsa (eksik / değişmiş donmuş satır,
 * kaynak izi) o söylenir.
 */
export function ruleDiffHint({ rowsBroken = false, sourceChanged = false } = {}) {
  const read = "Kilitli dönemin raporları donmuş defterden okunur, değişmez.";
  if (rowsBroken) return `Fark donmuş defterdeki eksik ya da değişmiş satırlardan (Donmuş Defter denetimi); kural değişikliği değildir. ${read} Program yeniden açılınca kilitli dönem yeniden donar.`;
  if (sourceChanged) return `Kilitli dönemin kaynak kayıtları dondurmadan sonra değişti (Donmuş Defter denetimi); fark bundan ya da defter kuralının değişmesinden olabilir. ${read} Yönetici kilidi açıp yeniden kilitleyince güncel veri donar.`;
  return `Kilitli dönemin donmuş defteri güncel türetmeden farklı: neden defter kuralının program sürümüyle değişmesi ya da kilitli dönemin kaynak verisinin kapının görmediği bir yolla değişmesi olabilir. ${read} Kural farkı Kural Farkı Düzeltme Fişi ile ilk açık güne alınır.`;
}

/** İki değer birebir mi (düz nesne / dizi / ilkel; anahtar kümesi ve sırası dahil değil, değerleri). Ara dilim önbelleğinin "iki kural aynı" sınaması (ders 47). */
function deepSame(a, b) {
  if (a === b) return true;
  if (typeof a !== "object" || typeof b !== "object" || a === null || b === null) return Number.isNaN(a) && Number.isNaN(b);
  if (Array.isArray(a) !== Array.isArray(b)) return false;
  const keys = Object.keys(a);
  if (keys.length !== Object.keys(b).length) return false;
  for (const key of keys) if (!Object.hasOwn(b, key) || !deepSame(a[key], b[key])) return false;
  return true;
}
export const sameEntries = (a, b) => a.length === b.length && a.every((entry, index) => deepSame(entry, b[index]));
/** Maddelerin parmak izi (FNV-1a, 32 bit; kimlik, tarih, işlem, açıklama, sıra, satırlar: hesap, alt hesap, cari, borç, alacak). Ara metin kurulmaz (1 M maddede ayırma yok). */
export function printOf(entries) {
  let hash = 0x811c9dc5;
  const text = value => {
    const s = value === undefined || value === null ? "" : typeof value === "string" ? value : String(value);
    for (let index = 0; index < s.length; index += 1) hash = Math.imul(hash ^ s.charCodeAt(index), 0x01000193) >>> 0;
    hash = Math.imul(hash ^ 0x1f, 0x01000193) >>> 0;
  };
  const num = value => {
    const n = Number(value) || 0;
    hash = Math.imul(hash ^ (n | 0), 0x01000193) >>> 0;
    hash = Math.imul(hash ^ (Math.floor(n / 4294967296) | 0), 0x01000193) >>> 0;
  };
  for (const entry of entries) {
    text(entry.id);
    text(entry.date);
    text(entry.source);
    text(entry.text);
    num(entry.seq ?? -1);
    for (const line of entry.lines) {
      text(line.account);
      text(line.sub);
      text(line.party);
      num(line.debit);
      num(line.credit);
    }
  }
  return `${entries.length}:${hash.toString(16)}`;
}

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
  // Bu nesnenin kendi yazımları (donmuş satırlar, koşular, izler): ara dilim önbelleğinin anahtarı (middleKey) yalnız BAŞKA yazımlarla değişir — dondurma parçaları yazılırken düşmez.
  let ownChanges = 0;
  const write = (sql, ...args) => {
    const result = store.run(sql, ...args);
    ownChanges += Number(result?.changes) || 0;
    return result;
  };

  const lastDone = () => store.get("SELECT * FROM ledger_snapshot_runs WHERE state = 'done' ORDER BY no DESC LIMIT 1");
  const pendingRun = () => store.get("SELECT * FROM ledger_snapshot_runs WHERE state = 'pending' ORDER BY no DESC LIMIT 1");
  const coverage = () => (ready() ? lastDone()?.through || "" : "");
  // Bekleyen koşu güncel kuraldan başka, programın bildiği bir kuralla mı (göç / onarım: 2.4.9) — kapsamın sonrası o koşunun gününe kadar onun kuralıyla okunur.
  const carriedPending = () => {
    const pending = ready() ? pendingRun() : null;
    return pending && pending.rule_version !== LEDGER_RULE_VERSION && ruleKnown(pending.rule_version) ? pending : null;
  };
  const userOf = user => ({ id: String(user?.id || "system"), name: String(user?.display_name || user?.name || "Sistem") });
  const trace = (type, no, user, payload) => {
    const actor = userOf(user);
    write("INSERT INTO audit_events (id, type, entity_id, actor_id, actor_name, payload_json, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)", `event-${randomUUID()}`, type, ENTITY(no), actor.id, actor.name, JSON.stringify(payload), now().toISOString());
  };
  /** Koşunun en son "kilit ilerletildi" izinin günü (yoksa ''). */
  const extendedOf = no => {
    const row = store.get("SELECT payload_json FROM audit_events WHERE entity_id = ? AND type = ? ORDER BY rowid DESC LIMIT 1", ENTITY(no), EXTENDED_TRACE);
    try {
      const payload = JSON.parse(row?.payload_json || "{}");
      return { through: String(payload.through || ""), reason: String(payload.reason || "lock") };
    } catch {
      return { through: "", reason: "lock" };
    }
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
   * kurulmaz). to ≤ kapsam ise canlı türetme yapılmaz; to bekleyen eski kurallı koşunun dönemindeyse yalnız o kuralla türetilir (güncel türetme kurulmaz). from verilirse
   * from'dan önceki maddeler eksik olabilir (donmuş satırlar from'dan okunur; ara dilim from'dan önce biterse okunmaz) — dönem raporu; mizan için trial().
   */
  function book({ from = "", to = "", live = null } = {}) {
    if (!ready()) return live || build();
    const cover = coverage();
    if (cover && to && to <= cover) return entries({ from, to });
    const frozen = cover ? entries({ from }) : [];
    // Göç / onarım penceresi (DÜŞÜK-3, ders 47): aralığın sonu bekleyen eski kurallı koşunun dönemindeyse ikinci tam türetme (güncel kural) yok.
    const carried = live ? null : carriedPending();
    if (carried && to && to <= carried.through) return [...frozen, ...rules[carried.rule_version]().filter(entry => entry.date > cover && entry.date <= carried.through)];
    return [...frozen, ...afterCoverage(cover, live || build(), { from })];
  }
  /** Kapsamın sonrası: (kapsam, bekleyen koşunun günü] bekleyen koşunun kuralıyla (2.4.9 göç / onarım koşusu; middleOf), sonrası güncel türetme. */
  function afterCoverage(cover, fresh, { from = "" } = {}) {
    const after = cover ? fresh.filter(entry => entry.date > cover) : fresh;
    const pending = carriedPending();
    if (!pending) return after;
    const tail = after.filter(entry => entry.date > pending.through);
    if (from && from > pending.through) return tail;
    return [...middleOf(pending, cover, after.filter(entry => entry.date <= pending.through)), ...tail];
  }
  // Ara dilim (göç / onarım penceresi; Ç3 tur 1 DÜŞÜK-3, ders 47): bekleyen eski kurallı koşunun dönemi o kuralla türetilir — rapor başına İKİNCİ tam türetme. Sonuç koşunun kimliği
  // ve veri sürümüyle (data_version + bu nesnenin DIŞINDAKİ yazımların total_changes'ı; dondurma parçalarının yazımı anahtarı değiştirmez) saklanır, işlemin içinde saklanmaz
  // (GG2). İki kural bu dönemde aynı maddeleri veriyorsa yalnız "aynı" bilgisi ve güncel dilimin parmak izi saklanır (bellek yok; isabette güncel dilim parmak iziyle yeniden
  // sınanır); farklıysa dilimin kendisi (en çok MIDDLE_LIMIT madde; üstü saklanmaz). Çıktı önbelleksiz yolla birebir (test/donmus-defter-tur1-250.test.mjs).
  const MIDDLE_LIMIT = 200_000;
  let middleCache = null;
  function middleKey(pending) {
    if (store.inTransaction) return "";
    try {
      const counters = store.changeCounters?.();
      return counters ? `${pending.id}|${counters.version}|${Number(counters.total) - ownChanges}` : "";
    } catch {
      return "";
    }
  }
  function middleOf(pending, cover, freshRange) {
    const key = middleKey(pending);
    if (key && middleCache?.key === key) {
      if (middleCache.middle) return middleCache.middle;
      if (middleCache.print === printOf(freshRange)) return freshRange;
    }
    callHook("middle", { run: pending.no, rule: pending.rule_version });
    const middle = rules[pending.rule_version]().filter(entry => entry.date > cover && entry.date <= pending.through);
    const equal = sameEntries(middle, freshRange);
    middleCache = !key ? null : equal ? { key, middle: null, print: printOf(freshRange) } : middle.length <= MIDDLE_LIMIT ? { key, middle, print: "" } : null;
    return equal ? freshRange : middle;
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
  // Donmuş dönemin mizan toplamları (100.000 satırda ~0,5 sn): donmuş satırlar değişmez — sonuç son TAMAMLANAN koşunun kimliği (rastgele; her dondurma, geri çekme ve Şirket
  // Verisini Sıfırla'dan sonraki her koşuda yenisi — Ç3 tur 1 ORTA-1: sıfırlamada koşu numarası 1'den başlar, aynı güne yeniden kilitte numara ve kapsam aynı kalıyordu) ve
  // bağlantının data_version'ıyla (başka bağlantının yazımı) anahtarlanıp saklanır. En çok 16 aralık.
  const trialCache = new Map();
  function frozenTrial(cover, from, upper) {
    let version = "";
    try {
      version = String(store.changeCounters?.().version ?? "");
    } catch {
      version = "";
    }
    const key = `${lastDone()?.id || ""}|${cover}|${version}|${from}|${upper}`;
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
    write(
      `INSERT INTO ledger_snapshot_runs (no, id, kind, state, from_date, through, rule_version, reason, state_lines, state_debit, state_credit, state_weight, created_by, created_at, finished_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      no, `lsr-${randomUUID()}`, kind, runState, from, through, rule, reason, t.lines || 0, t.debit || 0, t.credit || 0, t.weight || 0, actor.id, now().toISOString(), runState === "done" ? now().toISOString() : "",
    );
    return store.get("SELECT * FROM ledger_snapshot_runs WHERE no = ?", no);
  }
  const abandon = run => write("UPDATE ledger_snapshot_runs SET state = 'abandoned', finished_at = ? WHERE no = ? AND state = 'pending'", now().toISOString(), run.no);
  const staleExists = () => Boolean(store.get(`SELECT 1 AS found FROM ledger_snapshots WHERE date > ${COVERAGE_SQL} LIMIT 1`));
  const purgeStaleInTx = () => write(`DELETE FROM ledger_snapshots WHERE date > ${COVERAGE_SQL}`);
  /** Görünen donmuş satırların toplamları (kapsam içi). */
  const visibleTotals = (upper = coverage()) => {
    const row = store.get(`SELECT COUNT(*) AS lines, COALESCE(SUM(debit_minor), 0) AS debit, COALESCE(SUM(credit_minor), 0) AS credit, ${WEIGHT_SQL} AS weight FROM ledger_snapshots WHERE date <= ?`, upper);
    return { lines: Number(row.lines), debit: Number(row.debit), credit: Number(row.credit), weight: Number(row.weight) };
  };

  // known: geri çekilen günün görünen toplamları zaten ölçüldüyse (açılış onarımı: satırlar silinmişken "önceki − kaldırılan" yanlış olur).
  function thaw({ next, user, reason, known = null }) {
    const cover = coverage();
    const prev = lastDone();
    let totals = { lines: 0, debit: 0, credit: 0, weight: 0 };
    if (known) totals = known;
    else if (next) {
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
      for (const row of part) write(INSERT_LINE, run.no, (seq += 1), ...row, run.rule_version);
    }
    complete(run, totals, lockDigestOf(store, run.through, { version: LOCK_SQL_VERSION }), user);
    return run;
  }

  function complete(run, totals, digest, user) {
    const prev = lastDone();
    const state = { lines: Number(prev?.state_lines || 0) + totals.lines, debit: Number(prev?.state_debit || 0) + totals.debit, credit: Number(prev?.state_credit || 0) + totals.credit, weight: Number(prev?.state_weight || 0) + totals.weight };
    const changed = write(
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
    // Aynı güne yinelenen kilit: bekleyen koşu — KURALI NE OLURSA OLSUN (göçün / onarımın 2.4.9 koşusu, bu programın bilmediği kural dahil; Ç3 tur 1 ORTA-3, plan §4 "göçte
    // 2.4.9 KURALIYLA") — aynı aralığı donduruyorsa sürer (iş kaldığı yerden).
    if (pending && pending.through === target && !sync) return { action: "freeze", run: pending };
    const cover = coverage();
    // Eski kurallı bekleyen koşu (göç / onarım ya da bilinmeyen kural) kilit başka güne gidince de güncel kurala GEÇMEZ (aile; tasarım notu §4, §5).
    if (pending && pending.rule_version !== LEDGER_RULE_VERSION && target > cover) return carryLock(pending, { target, cover, user, reason, sync });
    if (pending) abandon(pending);
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
   * Eski kurallı bekleyen koşu (pending; kural ≠ güncel) varken kilit kapsamın üstünde başka bir güne gitti. Her dönem onu kilitleyenin kuralıyla donar:
   *  - kilit bekleyen dönemin İÇİNE çekildi (kapsam < hedef < koşunun günü): koşu bırakılır, (kapsam, hedef] AYNI kuralla yeni koşu;
   *  - kilit ilerletildi (hedef > koşunun günü): koşu sürer; iz (EXTENDED_TRACE) bu programın ilerlettiği günü kaydeder — koşu tamamlanınca (koşunun günü, hedef] güncel kuralla
   *    donar (continueAfter). Eşzamanlı kipte (postAll lockThrough) ikisi bu işlemde.
   * Kuralı bu programda olmayan koşu eşzamanlı dondurulamaz: işlem düşer (kilit + fişler yazılmaz; görünür hata).
   */
  function carryLock(pending, { target, cover, user, reason, sync }) {
    const rule = pending.rule_version;
    if (sync && !ruleKnown(rule)) throw new Error(`Donmuş defter: bekleyen dondurmanın kuralı (${rule}) bu programda yok; kilit bu işlemde dondurulamaz.`);
    if (target < pending.through) {
      abandon(pending);
      if (staleExists()) purgeStaleInTx();
      const run = insertRun({ kind: "freeze", state: "pending", from: cover, through: target, rule, reason: pending.reason, user });
      if (sync) freezeInTx(run, user);
      return { action: "freeze", run };
    }
    if (!sync) {
      trace(EXTENDED_TRACE, pending.no, user, { through: target, reason });
      return { action: "freeze", run: pending };
    }
    // Eşzamanlı: süren iş parçacığının yazdığı yarım satırlar (bayat) önce silinir; koşu kendi kuralıyla, kalan dönem güncel kuralla bu işlemde donar.
    if (staleExists()) purgeStaleInTx();
    freezeInTx(pending, user);
    if (target === pending.through) return { action: "freeze", run: pending };
    const run = insertRun({ kind: "freeze", state: "pending", from: pending.through, through: target, rule: LEDGER_RULE_VERSION, reason, user });
    freezeInTx(run, user);
    return { action: "freeze", run };
  }

  /**
   * Koşu tamamlandı ama kilit onun ötesinde (eski kurallı koşu sürerken kilit ilerletildi): kalan dönem için yeni bekleyen koşu, AYNI işlemde. Bu programın ilerlettiği güne kadar
   * güncel kural (EXTENDED_TRACE); ötesi (eski sürümün ilerlettiği) GAP_RULE. Dönüş: yeni koşu ya da null.
   */
  function continueAfter(run) {
    const lock = lockNow();
    if (!(lock > run.through)) return null;
    const extended = extendedOf(run.no);
    if (staleExists()) purgeStaleInTx();
    if (extended.through > run.through) return insertRun({ kind: "freeze", state: "pending", from: run.through, through: extended.through < lock ? extended.through : lock, rule: LEDGER_RULE_VERSION, reason: extended.reason });
    log?.warn?.(`Donmuş defter: kilit (${lock}) ${run.through} gününün ötesinde (eski sürüm); aradaki dönem ${GAP_RULE} kuralıyla dondurulacak.`);
    return insertRun({ kind: "freeze", state: "pending", from: run.through, through: lock, rule: GAP_RULE, reason: "repair" });
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
      const n = store.tx(() => Number(write(`DELETE FROM ledger_snapshots WHERE (run, run_seq) IN (SELECT run, run_seq FROM ledger_snapshots WHERE date > ${COVERAGE_SQL} LIMIT ?)`, batch).changes) || 0);
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
      // Kuralı bu programda olmayan bekleyen koşu (daha yeni bir sürümün açtığı; Ç3 tur 1 ORTA-3 ailesi): güncel kurala GEÇİRİLMEZ, yarım dondurulmaz — koşu bekler, neden
      // ilerlemede ve Mutabakat Testi'nde ("Donmuş Defter") görünür; dönem o kuralı bilen sürümle açılınca donar. O zamana kadar raporlar o dönemi güncel kuralla okur.
      if (!ruleKnown(run.rule_version)) throw new Error(`bekleyen dondurmanın kuralı (${run.rule_version}) bu programda yok; ${dayText(run.through)} ve öncesi bu kuralı bilen sürümle açılınca donar`);
      if (!useWorker) {
        progress.phase = "yazım";
        store.tx(() => {
          if (!stillPending(run.no)) throw new Cancelled("koşu değişti");
          freezeInTx(run, null);
          continueAfter(run);
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
                write(INSERT_LINE, run.no, seq, ...row, run.rule_version);
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
          continueAfter(run);
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

  const totalsMatch = (seen, run) => seen.lines === Number(run.state_lines) && seen.debit === Number(run.state_debit) && seen.credit === Number(run.state_credit) && seen.weight === Number(run.state_weight);
  /**
   * Görünen donmuş satırlar son tamamlanan koşunun kayıtlı toplamlarıyla (state_*) tutuyor mu (Ç3 tur 1 ORTA-2: 2.4.9'un Şirket Verisini Sıfırla'sı donmuş satırları siler, koşuları
   * bilmez). Tutuyorsa null. Tutmuyorsa satırların hâlâ sağlam olduğu en son gün (sağlama noktası): toplamları bugün de tutan, kendinden sonra hiçbir geri çekme gününün altına
   * inmediği tamamlanmış koşunun günü; hiçbiri yoksa '' (baştan).
   */
  function damagedFrom() {
    const done = store.all("SELECT no, kind, through, state_lines, state_debit, state_credit, state_weight FROM ledger_snapshot_runs WHERE state = 'done' ORDER BY no DESC");
    if (!done.length) return null;
    const [last] = done;
    const seen = visibleTotals(last.through);
    if (totalsMatch(seen, last)) return null;
    const found = { lines: seen.lines, expected: Number(last.state_lines) };
    // floor: kendinden sonraki geri çekmelerin en küçük günü — günü bunun üstündeki eski koşunun toplamları artık o güne kadarki satırları anlatmaz.
    let floor = last.kind === "thaw" ? last.through : null;
    for (const run of done.slice(1)) {
      if (run.through < last.through && (floor === null || run.through <= floor) && totalsMatch(visibleTotals(run.through), run)) return { ...found, through: run.through };
      if (run.kind === "thaw" && (floor === null || run.through < floor)) floor = run.through;
    }
    return { ...found, through: "" };
  }
  /**
   * Açılış onarımı (göçlerden sonra, kapıdan önce; BS-7 yeni şemalı dosyada çağrılmaz). Sıra:
   *  1) donmuş satırlar kayıtlı toplamlarla tutmuyorsa (eski sürümün sıfırlaması, dış silme) kapsam sağlam son güne iner (thaw, neden repair) — satırı eksik dönem boş donmuş
   *     defterden okunmaz; kilit varsa aşağıda yeniden donar (GAP_RULE; S13 = A);
   *  2) eski sürüm kilidi bekleyen koşunun gerisine çektiyse koşu bırakılır, (kapsam, kilit] AYNI kuralla yeniden açılır; ilerlettiyse koşu sürer, tamamlanınca kalan dönem
   *     donar (continueAfter: bu programın ilerlettiği güne kadar güncel kural, ötesi GAP_RULE);
   *  3) bekleyen koşu yoksa: kilit > kapsam → bekleyen koşu GAP_RULE kuralıyla; kilit < kapsam → thaw.
   * Dönüş: { action, pending, damaged } ya da null.
   */
  function repairOnOpen() {
    if (!ready() || !canWrite()) return null;
    return store.tx(() => {
      const lock = lockNow();
      let pending = pendingRun();
      let action = "none";
      const damaged = damagedFrom();
      if (damaged) {
        if (pending) abandon(pending);
        pending = null;
        thaw({ next: damaged.through, user: null, reason: "repair", known: visibleTotals(damaged.through) });
        action = "thaw";
        log?.warn?.(`Donmuş defter: görünen donmuş satırlar kayıtlı toplamlarla tutmuyor (${damaged.lines} / ${damaged.expected} satır; eski sürümün Şirket Verisini Sıfırla'sı ya da dış silme); kapsam ${damaged.through || "başa"} indirildi, kilitli dönem yeniden donacak.`);
      }
      const cover = coverage();
      // Eski kurallı koşu (göç / onarım ya da bilinmeyen kural) güncel kurala geçmez (ORTA-3 ailesi): kilit ötesindeyse koşu sürer (tamamlanınca kalan dönem continueAfter'la:
      // bu programın ilerlettiği güne kadar güncel kural, ötesi GAP_RULE); kilit gerisine çekildiyse (kapsam, kilit] AYNI kuralla yeniden açılır. Güncel kurallı koşu (bu programın
      // kilidi) önceki davranışla: bırakılır, (kapsam, kilit] aşağıda GAP_RULE ile.
      const carried = Boolean(pending && pending.rule_version !== LEDGER_RULE_VERSION);
      if (pending && pending.through !== lock && !(carried && pending.through < lock)) {
        abandon(pending);
        if (carried && lock > cover) {
          if (staleExists()) purgeStaleInTx();
          insertRun({ kind: "freeze", state: "pending", from: cover, through: lock, rule: pending.rule_version, reason: pending.reason });
          action = "freeze";
        }
      }
      if (!pendingRun() && lock > cover) {
        if (staleExists()) purgeStaleInTx();
        insertRun({ kind: "freeze", state: "pending", from: cover, through: lock, rule: GAP_RULE, reason: "repair" });
        action = "freeze";
        log?.warn?.(`Donmuş defter: kilit (${lock}) donmuş dönemin (${cover || "yok"}) ötesinde (eski sürüm); aradaki dönem ${GAP_RULE} kuralıyla dondurulacak.`);
      } else if (!pendingRun() && lock < cover) {
        thaw({ next: lock, user: null, reason: "repair" });
        action = "thaw";
        log?.warn?.(`Donmuş defter: kilit (${lock || "yok"}) donmuş dönemin (${cover}) gerisinde (eski sürüm); kapsam kilide indirildi.`);
      }
      return { action, pending: Boolean(pendingRun()), damaged: Boolean(damaged) };
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
    const unknownRule = Boolean(pending && !ruleKnown(pending.rule_version));
    const problems = [];
    if (unknownRule) {
      problems.push(`Bekleyen Dondurmanın Kuralı Bu Programda Yok: ${dayText(pending.through)} ve öncesi ${pending.rule_version} kuralıyla donacak; dönem bu kuralı bilen sürümle açılınca donar, o zamana kadar raporlar bu dönemi güncel kuralla okur`);
    } else if (cover !== lock && !(pending && pending.through > cover && pending.through <= lock)) {
      problems.push(`Donmuş dönem (${dayText(cover) || "yok"}) dönem kilidiyle (${dayText(lock) || "yok"}) uyuşmuyor`);
    }
    // Nedeni bilinen ayrışmalar (Ç3 tur 1 K4): eksik / değişmiş donmuş satır ve kaynak izi — "Kural Değişikliği Farkı" bunları kural değişikliği diye adlandırmaz.
    let rowsBroken = false;
    let sourceChanged = false;
    const last = lastDone();
    if (last) {
      const seen = visibleTotals(cover);
      if (!totalsMatch(seen, last)) {
        rowsBroken = true;
        const tl = minor => roundMoney(minor / 100);
        problems.push(seen.lines < Number(last.state_lines)
          ? `Donmuş Defterde Eksik Satır: ${dayText(cover) || "kilitli dönem"} ve öncesinde ${seen.lines} satır görünüyor, ${last.state_lines} satır donmuştu (eski sürümün Şirket Verisini Sıfırla'sı ya da dış silme); program yeniden açılınca kilitli dönem yeniden donar`
          : `Donmuş Defterin Satırları Değişmiş: ${dayText(cover) || "kilitli dönem"} ve öncesinde ${seen.lines} satır (borç ${tl(seen.debit)}, alacak ${tl(seen.credit)}) görünüyor, donan ${last.state_lines} satır (borç ${tl(Number(last.state_debit))}, alacak ${tl(Number(last.state_credit))}) (dış yazım); program yeniden açılınca kilitli dönem yeniden donar`);
      }
      if (last.kind === "freeze" && last.through === cover && last.source_digest && lockDigestOf(store, cover, { version: last.digest_version || LOCK_SQL_VERSION }) !== last.source_digest) {
        sourceChanged = true;
        problems.push(`Donmuş Dönemin Kaynağı Değişti: ${dayText(cover)} ve öncesinin kaynak kayıtları dondurmadan sonra kapının görmediği bir yolla (eski sürüm, dış yazım) değişti; Kilidi Aç → Yeniden Kilitle ile güncel veri donar`);
      }
    }
    // Uyarı düzeyi: bu denetim kapıda (COMMIT) koşmaz, yeni işlemleri engellemez; çözümü kullanıcının elindedir (Kilidi Aç → Yeniden Kilitle).
    const items = [{
      code: "ledger:snapshot",
      name: `Donmuş Defter (${cover ? `${dayText(cover)} ve Öncesi` : "Yok"})${pending ? (unknownRule ? " · Dondurma Bekliyor" : " · Dondurma Sürüyor") : ""}`,
      ok: problems.length === 0,
      count: problems.length,
      sample: problems.slice(0, 5),
      ...(problems.length
        ? {
            severity: "warning",
            hint: rowsBroken
              ? "Kilitli dönemin donmuş defterinde eksik ya da değişmiş satır var; o dönemin raporları eksik görünebilir. Program yeniden açılınca kilitli dönem yeniden donar; yönetici kilidi açıp yeniden kilitleyerek de dondurabilir."
              : "Kilitli dönemin raporları donmuş defterden okunur. Kaynak kayıtlar kilitliyken değiştiyse (eski sürüm, dış yazım) yönetici kilidi açıp yeniden kilitleyince güncel veri donar.",
          }
        : {}),
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
        name: `Kural Değişikliği Farkı (Kilitli Dönem: ${dayText(cover)} ve Öncesi)`,
        ok: diff.count === 0,
        count: diff.count,
        difference: [...byAccount.values()].reduce((sum, row) => sum + Math.abs(row.differenceMinor), 0) / 200,
        sample: diff.sample,
        breakdown: [...byAccount.values()].filter(row => row.differenceMinor),
        ...(diff.count ? { severity: "warning", hint: ruleDiffHint({ rowsBroken, sourceChanged }) } : {}),
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

  return { state, status, entries, book, trial, lockChanged, freezeSync, purgeStale, runPending, digestOf, repairOnOpen, ruleDiff, checks, cancel, close, coverage, journalOrder, ruleVersions: () => Object.keys(rules) };
}

/** İç API hata biçimi (uçlar için). */
export const snapshotError = (status, message, code) => new HttpError(status, message, { code });
