// Büyük okuma için sıkı satırlar (2.5.0 Ç3 tamamlama; ders 47; docs/erp/C3-DONDURMA-TASARIM.md §16).
//
// node:sqlite'ın StatementSync.all()'ı her satırı ayrı bir "sözlük kipli" nesne olarak kurar (v8::Object::New + ad sözlüğü): 18 kolonlu bir cari satırı yığında
// ~1,35 KB. Ana Defter türetmesi (routes/ledger.mjs rows, 2.4.9 kural kopyası) bütün geçmişi okur: 1.000.000 satırlık şirkette yalnız kaynak satırları varsayılan
// yığını (~2 GB) doldurur, program çöker (FATAL ERROR … StatementSync::All) ya da dondurma iş parçacığı "memory limit" ile düşer.
// Burada satırlar tek tek (iterate) okunur ve AYNI anahtarlar, AYNI sırayla, AYNI değerlerle hızlı kipli düz nesnelere kopyalanır; sık yinelenen kısa metinler
// (tarih, tür, yöntem, cari kimliği, hesap kodu) kolon başına tek kopyada tutulur. Anahtar, sıra ve değer aynıdır (eşdeğerlik test/lean-rows-250.test.mjs); tek fark
// nesnenin prototipidir (null değil Object.prototype) — türetme satırları yalnız okur.
const statements = new WeakMap();
/** Kolon başına en çok bu kadar farklı metin tek kopyada tutulur (aşan kolonda tutma bırakılır: benzersiz kimlikler); bu uzunluktan uzun metin tutulmaz. */
export const INTERN_LIMIT = 65_536;
const INTERN_MAX_LENGTH = 64;

function statementOf(db, sql) {
  let cache = statements.get(db);
  if (!cache) {
    cache = new Map();
    statements.set(db, cache);
  }
  let statement = cache.get(sql);
  if (!statement) {
    statement = db.prepare(sql);
    cache.set(sql, statement);
  }
  return statement;
}

/**
 * Sorgunun satırları birer birer, sıkı nesneler olarak (store.all ile aynı anahtar / sıra / değer). store.db yoksa (sahte depo) store.all'a düşer.
 * limit: kolon başına tutulacak farklı metin sayısı (yalnız test).
 */
export function* leanRows(store, sql, args = [], { limit = INTERN_LIMIT } = {}) {
  const db = store?.db;
  if (!db?.prepare) {
    yield* store.all(sql, ...args);
    return;
  }
  let keys = null;
  let pools = null;
  for (const row of statementOf(db, sql).iterate(...args)) {
    if (!keys) {
      keys = Object.keys(row);
      pools = keys.map(() => new Map());
    }
    const out = {};
    for (let index = 0; index < keys.length; index += 1) {
      const key = keys[index];
      let value = row[key];
      const pool = pools[index];
      if (pool && typeof value === "string" && value.length <= INTERN_MAX_LENGTH) {
        const kept = pool.get(value);
        if (kept !== undefined) value = kept;
        else if (pool.size < limit) pool.set(value, value);
        else pools[index] = null;
      }
      out[key] = value;
    }
    yield out;
  }
}

/**
 * Satırlar birer birer, KOPYALANMADAN (akışlı tüketici için: iz, toplam — satır hemen bırakılır, dizi kurulmaz). store.db yoksa store.all.
 * Okuma sürerken aynı sorgu yeniden başlatılmaz (tüketici eşzamanlı).
 */
export function* eachRow(store, sql, args = []) {
  const db = store?.db;
  if (!db?.prepare) {
    yield* store.all(sql, ...args);
    return;
  }
  yield* statementOf(db, sql).iterate(...args);
}

/** store.all'ın sıkı satırlı karşılığı (dizi). */
export const leanAll = (store, sql, ...args) => Array.from(leanRows(store, sql, args));

/** Türetmeye verilecek depo: all() sıkı satırlarla, gerisi (get, run, tx, db …) asıl depodan. 2.4.9 kural kopyası (değiştirilemez) bununla okur. */
export function leanStore(store) {
  const lean = Object.create(store);
  lean.all = (sql, ...args) => leanAll(store, sql, ...args);
  return lean;
}
