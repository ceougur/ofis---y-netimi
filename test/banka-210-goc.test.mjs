// 2.1.0 — Aşama 2, Dilim 2: v20 göçü (docs/BANKA-MODULU-PLAN.md §5.2–§5.6, §9.1 K4, §10.2, §10.5 K11).
//
// ÇALIŞIYOR MU
//  - Yeni kurulum ve eski veri v20'ye geçer: §5.2'deki 16 tablo STRICT ve plandaki kolonlarla; §5.3'teki kolonlar (fin_ref,
//    event_id, döviz kolonları, rate_source) ve kısmi indeksler; meta.schema.v20At göç anının (iş saati) damgası.
//  - Göç HİÇBİR mevcut satırı değiştirmez (K11): 2.0.16 → … → 2.0.26 zincirinin her kesitinde (eski sürümlerin gerçek koduyla
//    üretilmiş), çakışmalı ve çok eski kurulumda her şirket dosyasının her tablosu göç öncesiyle satır satır aynı; kilit izi aynı;
//    izinli tek farklar meta.schema.v20At ve ortak katmanda yetki göçünün eklediği bank.* yetkileri.
//  - Yetki göçü (K4): bugün bankadan çıkış yapabilen (cari/fatura/stok/satış/çek/taksit yönetimi) her özel rol ve kişiye
//    bank.move + bank.cancel; cash.manage sahiplerine bank.transfer, bank.statement, bank.reconcile; cash.view sahiplerine
//    bank.view + bank.reports; kişiden cash.view kaldırılmışsa yalnız bank.view ve bank.reports kaldırılır. Yalnız ortak katmanda;
//    iki kez çalışınca aynı.
//  - Kapı listeleri (§5.5): yeni para tabloları kapıdan geçer, bilgi kolonları geçmez; fin_events tarihli hareket.
//  - Şirket sıfırlama (§5.6): yeni hareket tabloları silinir, kartlar kalır (Tümünü Sıfırla'da silinir), başvuru verisi (kur,
//    tatil) ve banka ayarları ile İşlem No sayacı kalır.
//
// NASIL BOZARIM
//  - Kesirli/metin/eksi kuruş, yanlış taraf (D/C dışı), sıfır tutar, 4 haneden farklı kart sonu, %100'ü aşan oran, 36'dan çok
//    taksit, sıfır kur → şema reddeder (STRICT + CHECK).
//  - Aynı İşlem No / aynı yıl-sıra, aynı origin_key iki etkin olayda, aynı IBAN iki etkin hesapta, aynı çek iki bekleyen tahsil
//    kaydında, aynı istek kimliği iki kez → tekil indeks reddeder; iptal/silinmiş satırda aynı değer serbest.
//  - İleri tarihli işlem başlığı (fin_events) → kapı geri alır. Kilitli dönemdeki eski satıra hesap/işlem bağı (fin_ref/event_id)
//    yazmak → kilit izi değişir, 409 period-lock.
//  - Göç ortasında SIGKILL → dosya v19'da sağlam kalır (yarım tablo/kolon yok), göç öncesi yedek tam; yeniden açılışta göç
//    tamamlanır, sayılar aynı; yedekten dönüş eski hâli verir.
//  - Personelin kişiye özel ayarındaki yetki kaldırması banka yazma yetkisine yansımaz (K4: yalnız görme); 002'nin kullanıcı kopyası
//    göçte değişmez (ortak katmandan aynalanır).
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { existsSync, mkdtempSync, readdirSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { after, before, describe, it } from "node:test";
import { DatabaseSync } from "node:sqlite";
import { fileURLToPath } from "node:url";
import { createStore } from "../server/lib/db.mjs";
import { LATEST_VERSION, MIGRATIONS, runMigrations } from "../server/lib/migrations.mjs";
import { ADMIN_PASSWORD, loginAdmin, startTestServer } from "./helpers.mjs";
import { compareSnapshots, fixtureDatabases, migrateTo, openCopy, snapshot } from "./guvenilirlik/goc-v20.mjs";
import { fixtureExists, unpackFixture } from "./guvenilirlik/fikstur.mjs";
import { dbFacts } from "./guvenilirlik/olgular.mjs";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const unwrap = r => (r.data && typeof r.data === "object" && "ok" in r.data ? (r.data.ok ? r.data.data : r.data) : r.data);
// Yeni modüller dinamik: eski kodda (2.0.26) yoksa testler hatayla değil, eksik denetimiyle kırmızı olur.
const optional = async (file, name) => {
  try {
    return (await import(path.join(ROOT, file)))[name];
  } catch {
    return undefined;
  }
};

// §5.2: tablo → kolonlar (sıra önemsiz). "+ zaman" = created_by, created_at, updated_by, updated_at.
const STAMP = ["created_by", "created_at", "updated_by", "updated_at"];
export const V20_TABLES = {
  fin_events: ["id", "year", "seq", "no", "type", "date", "value_date", "status", "reversal_of", "reversed_by", "origin", "origin_key", "channel", "src_table", "src_id", "bank_ref", "counter_ref", "pos_id", "direction", "amount_minor", "try_minor", "currency", "method", "party_id", "invoice_id", "plan_id", "cheque_id", "description", "reference", "external_id", "counter_name", "counter_iban", "request_key", ...STAMP],
  bank_lines: ["id", "event_id", "seq", "role", "gl", "sub", "ref", "side", "try_minor", "currency", "fx_minor", "rate_e6", "rate_source", "memo"],
  bank_accounts: ["id", "code", "gl", "gl_sub", "kind", "bank_name", "name", "currency", "iban", "account_no", "branch_name", "branch_code", "swift", "holder", "description", "opening_date", "balance_confirmed", "credit_limit_minor", "negative_policy", "statement_day", "due_day", "show_on_invoice", "statement_template_json", "integration", "status", "position", ...STAMP, "deleted_by", "deleted_at"],
  pos_terminals: ["id", "code", "gl_sub", "name", "bank_name", "bank_account_id", "kind", "provider_kind", "merchant_no", "terminal_no", "currency", "valor_rule", "valor_days", "provision_days", "block_days", "installment_payout", "tax_kind", "tax_mode", "tax_ppm", "provider_account_id", "refund_commission", "settle_mode", "fixed_fee_minor", "integration", "status", "description", ...STAMP, "deleted_by", "deleted_at"],
  pos_rates: ["id", "pos_id", "installments", "rate_ppm", "valor_days", "valid_from", "created_by", "created_at"],
  pos_sales: ["id", "event_id", "pos_id", "kind", "src", "origin_id", "date", "installments", "rate_ppm", "tax_kind", "tax_mode", "tax_ppm", "fixed_minor", "refund_commission", "payout", "block_days", "bank_account_id", "provider_account_id", "gross_minor", "commission_minor", "tax_minor", "net_minor", "commission_refund_minor", "blocked", "auth_code", "card_last4", "status", ...STAMP],
  pos_items: ["id", "sale_id", "pos_id", "seq", "role", "value_date", "blocked", "gross_minor", "commission_minor", "tax_minor", "fee_minor", "net_minor", "planned_net_minor", "status", "event_id", "settled_on", "late", "settle_error", ...STAMP],
  cheque_collections: ["id", "cheque_id", "bank_account_id", "given_date", "status", "closed_date", "event_id", "close_event_id", ...STAMP],
  bank_jobs: ["id", "kind", "due_date", "ref", "payload_json", "status", "done_ref", "error", ...STAMP],
  fx_rates: ["date", "currency", "kind", "rate_e6", "unit", "source", "fetched_at", "created_by"],
  bank_holidays: ["date", "kind", "name", "created_by", "created_at"],
  bank_statements: ["id", "bank_account_id", "source", "file_name", "file_sha256", "format", "period_from", "period_to", "opening_minor", "closing_minor", "line_count", "duplicate_count", "status", ...STAMP],
  bank_statement_lines: ["id", "statement_id", "bank_account_id", "line_no", "date", "value_date", "direction", "amount_minor", "balance_minor", "description", "reference", "counter_iban", "counter_name", "external_id", "fingerprint", "status", "score", "suggestion_json", ...STAMP],
  bank_matches: ["id", "line_id", "bank_account_id", "event_id", "amount_minor", "digest", "kind", "score", "created_by", "created_at", "undone_by", "undone_at", "undo_reason"],
  bank_plans: ["id", "kind", "bank_account_id", "to_account_id", "party_id", "amount_minor", "currency", "planned_date", "repeat", "description", "status", "done_event_id", ...STAMP],
  request_keys: ["key", "scope", "user_id", "body_hash", "ref_id", "created_at"],
};
const MONEY_TABLES = ["payments", "cash_entries", "account_entries", "plan_entries", "stock_moves", "cheque_events"];

// Satır şablonları (NOT NULL kolonlar): testler yalnız denedikleri alanı değiştirir.
const T0 = "2026-10-01T09:00:00.000Z";
const TEMPLATE = {
  fin_events: { id: "ev-1", year: 2026, seq: 1, no: "BNK-2026-000001", type: "bank_fee", date: "2026-10-01", created_by: "u", created_at: T0 },
  bank_lines: { id: "bl-1", event_id: "ev-1", seq: 1, role: "bank", gl: "102", side: "D", try_minor: 100 },
  // Bilerek güncellendi (Aşama 3, dilim 1): hesap türü plan §3.5'in sözlüğünden ("deposit" yer tutucuydu; kapı bank:opening türü ana/alt hesapla
  // karşılaştırır — Vadesiz → 102).
  bank_accounts: { id: "ba-1", code: "BNK-01", gl: "102", gl_sub: "102.01", kind: "demand", bank_name: "Ziraat", name: "Ana TL", opening_date: "2026-10-01", created_by: "u", created_at: T0 },
  pos_terminals: { id: "pos-1", code: "POS-01", gl_sub: "108.01", name: "Ziraat POS", bank_account_id: "ba-1", kind: "physical", created_by: "u", created_at: T0 },
  pos_rates: { id: "pr-1", pos_id: "pos-1", installments: 1, rate_ppm: 25000, valid_from: "2026-10-01", created_by: "u", created_at: T0 },
  pos_sales: { id: "ps-1", event_id: "ev-1", pos_id: "pos-1", kind: "sale", date: "2026-10-01", rate_ppm: 25000, tax_kind: "bsmv", tax_mode: "included", tax_ppm: 50000, refund_commission: "none", payout: "monthly", bank_account_id: "ba-1", gross_minor: 1000000, net_minor: 975000, created_by: "u", created_at: T0 },
  pos_items: { id: "pi-1", sale_id: "ps-1", pos_id: "pos-1", seq: 1, role: "sale", value_date: "2026-10-02", gross_minor: 1000000, net_minor: 975000, planned_net_minor: 975000, created_by: "u", created_at: T0 },
  cheque_collections: { id: "cc-1", cheque_id: "ch-1", bank_account_id: "ba-1", given_date: "2026-10-01", event_id: "ev-1", created_by: "u", created_at: T0 },
  bank_jobs: { id: "bj-1", kind: "reval-reverse", due_date: "2026-10-02", created_by: "u", created_at: T0 },
  fx_rates: { date: "2026-10-01", currency: "USD", kind: "buy", rate_e6: 34250000, source: "tcmb", fetched_at: T0 },
  bank_holidays: { date: "2026-10-29", kind: "holiday", created_by: "u", created_at: T0 },
  bank_statements: { id: "bs-1", bank_account_id: "ba-1", created_by: "u", created_at: T0 },
  bank_statement_lines: { id: "bsl-1", statement_id: "bs-1", bank_account_id: "ba-1", line_no: 1, date: "2026-10-01", direction: "in", amount_minor: 100, fingerprint: "f1", created_by: "u", created_at: T0 },
  bank_matches: { id: "bm-1", line_id: "bsl-1", bank_account_id: "ba-1", event_id: "ev-1", amount_minor: 100, digest: "d", kind: "manual", created_by: "u", created_at: T0 },
  bank_plans: { id: "bp-1", kind: "transfer", bank_account_id: "ba-1", amount_minor: 100, planned_date: "2026-10-05", created_by: "u", created_at: T0 },
  request_keys: { key: "u|invoice.create|k1", scope: "invoice.create", user_id: "u", body_hash: "h", ref_id: "inv-1", created_at: T0 },
};
const insert = (db, table, values = {}) => {
  const row = { ...TEMPLATE[table], ...values };
  const cols = Object.keys(row);
  return db.prepare(`INSERT INTO ${table} (${cols.join(", ")}) VALUES (${cols.map(() => "?").join(", ")})`).run(...cols.map(col => row[col]));
};
const rejects = (fn, what) => assert.throws(fn, /constraint|cannot store|CHECK|UNIQUE|NOT NULL|datatype/i, what);

describe("v20 şeması (yeni kurulum)", () => {
  let server;
  let db;
  before(async () => {
    server = await startTestServer({ now: "2026-10-08T12:00:00+03:00" });
    db = server.app.db;
  });
  after(async () => server?.close());

  it("göç numarası 20; §5.2'deki 16 tablo STRICT ve plandaki kolonlarla", () => {
    assert.equal(LATEST_VERSION, 20, "son göç v20");
    assert.ok(MIGRATIONS.some(item => item.version === 20), "v20 göçü tanımlı");
    assert.equal(db.prepare("PRAGMA user_version").get().user_version, 20);
    for (const [table, columns] of Object.entries(V20_TABLES)) {
      const info = db.prepare("SELECT strict FROM pragma_table_list WHERE name = ?").get(table);
      assert.ok(info, `${table} tablosu yok`);
      assert.equal(info.strict, 1, `${table} STRICT değil`);
      const actual = db.prepare(`PRAGMA table_info(${table})`).all().map(col => col.name).sort();
      assert.deepEqual(actual, [...columns].sort(), `${table} kolonları plandakiyle aynı değil`);
    }
  });

  it("§5.3: para tablolarına fin_ref ve event_id (kısmi indeksleriyle), cari satırına döviz kolonları, faturaya rate_source", () => {
    const column = (table, name) => db.prepare(`PRAGMA table_info(${table})`).all().find(col => col.name === name);
    for (const table of MONEY_TABLES) {
      for (const name of ["fin_ref", "event_id"]) {
        const col = column(table, name);
        assert.ok(col, `${table}.${name} yok`);
        assert.equal(col.type, "TEXT");
        assert.equal(col.notnull, 1);
        assert.equal(col.dflt_value, "''");
      }
      const partial = db.prepare(`PRAGMA index_list(${table})`).all().filter(index => index.partial === 1);
      const covers = name => partial.some(index => db.prepare(`PRAGMA index_info(${index.name})`).all()[0]?.name === name);
      assert.ok(covers("fin_ref"), `${table}: fin_ref kısmi indeksi yok`);
      assert.ok(covers("event_id"), `${table}: event_id kısmi indeksi yok`);
    }
    for (const [name, type, dflt] of [["fx_currency", "TEXT", "''"], ["fx_minor", "INTEGER", "0"], ["fx_rate_e6", "INTEGER", "0"], ["fx_source", "TEXT", "''"]]) {
      const col = column("account_entries", name);
      assert.ok(col, `account_entries.${name} yok`);
      assert.deepEqual([col.type, col.notnull, col.dflt_value], [type, 1, dflt], `account_entries.${name}`);
    }
    assert.ok(column("invoices", "rate_source"), "invoices.rate_source yok");
  });

  it("meta.schema.v20At: göç anının iş saati (sahte saat) damgası", () => {
    const stamp = server.app.store.setting("meta.schema.v20At", "");
    assert.ok(stamp, "damga yok");
    assert.equal(stamp.slice(0, 10), "2026-10-08", `damga iş saatinden değil: ${stamp}`);
  });

  it("STRICT ve CHECK: kesirli/metin/eksi kuruş, yanlış taraf, sıfır tutar, kart sonu, oran, taksit, kur reddedilir", () => {
    db.exec("BEGIN");
    try {
      rejects(() => insert(db, "fin_events", { amount_minor: 12.5 }), "kesirli kuruş");
      rejects(() => insert(db, "fin_events", { id: "ev-x", amount_minor: "on iki" }), "metin tutar");
      rejects(() => insert(db, "fin_events", { id: "ev-y", amount_minor: -1 }), "eksi tutar");
      rejects(() => insert(db, "bank_lines", { side: "X" }), "taraf D/C dışında");
      rejects(() => insert(db, "bank_lines", { id: "bl-0", try_minor: 0 }), "sıfır satır");
      rejects(() => insert(db, "bank_lines", { id: "bl-r", rate_e6: 0 }), "sıfır kur");
      rejects(() => insert(db, "pos_sales", { card_last4: "12a4" }), "kart sonu harfli");
      rejects(() => insert(db, "pos_sales", { id: "ps-5", card_last4: "12345" }), "kart sonu 5 hane");
      rejects(() => insert(db, "pos_sales", { id: "ps-0", gross_minor: 0 }), "sıfır satış");
      rejects(() => insert(db, "pos_rates", { installments: 37 }), "37 taksit");
      rejects(() => insert(db, "pos_rates", { id: "pr-x", rate_ppm: 1_000_001 }), "%100'ü aşan oran");
      rejects(() => insert(db, "pos_items", { role: "bonus" }), "kalem rolü");
      rejects(() => insert(db, "bank_accounts", { balance_confirmed: 2 }), "Bakiye Doğrulandı 0/1 dışı");
      rejects(() => insert(db, "bank_statement_lines", { direction: "sideways" }), "ekstre yönü");
      rejects(() => insert(db, "bank_statement_lines", { id: "bsl-0", amount_minor: 0 }), "ekstre sıfır tutar");
      rejects(() => insert(db, "fx_rates", { rate_e6: 0 }), "sıfır kur");
      rejects(() => insert(db, "pos_terminals", { fixed_fee_minor: -5 }), "eksi sabit ücret");
      insert(db, "pos_sales", { id: "ps-ok", card_last4: "1234" });
      insert(db, "fin_events", { id: "ev-ok", amount_minor: "1250" }); // metin ama kayıpsız tamsayı: STRICT tamsayıya çevirir
      assert.equal(typeof db.prepare("SELECT amount_minor FROM fin_events WHERE id = 'ev-ok'").get().amount_minor, "number");
    } finally {
      db.exec("ROLLBACK");
    }
  });

  it("tekil indeksler yalnız etkin satırda (iptal/silinmiş satırda aynı değer serbest)", () => {
    db.exec("BEGIN");
    try {
      insert(db, "fin_events", { id: "e1", seq: 1, no: "BNK-2026-000001", origin_key: "valor:1" });
      rejects(() => insert(db, "fin_events", { id: "e2", seq: 1, no: "BNK-2026-000002" }), "aynı yıl + sıra");
      rejects(() => insert(db, "fin_events", { id: "e3", seq: 3, no: "BNK-2026-000001" }), "aynı İşlem No");
      rejects(() => insert(db, "fin_events", { id: "e4", seq: 4, no: "BNK-2026-000004", origin_key: "valor:1" }), "aynı origin_key iki etkin olayda");
      insert(db, "fin_events", { id: "e5", seq: 5, no: "BNK-2026-000005", origin_key: "valor:1", status: "cancelled" });
      insert(db, "fin_events", { id: "e6", seq: 6, no: "BNK-2026-000006" });
      insert(db, "fin_events", { id: "e7", seq: 7, no: "BNK-2026-000007" }); // boş origin_key tekil değil
      insert(db, "bank_accounts", { id: "a1", code: "B1", gl_sub: "102.01", iban: "TR330006100519786457841326" });
      rejects(() => insert(db, "bank_accounts", { id: "a2", code: "B2", gl_sub: "102.01" }), "aynı alt hesap");
      rejects(() => insert(db, "bank_accounts", { id: "a3", code: "B1", gl_sub: "102.03" }), "aynı kod iki etkin hesapta");
      rejects(() => insert(db, "bank_accounts", { id: "a4", code: "B4", gl_sub: "102.04", iban: "TR330006100519786457841326" }), "aynı IBAN iki etkin hesapta");
      insert(db, "bank_accounts", { id: "a5", code: "B1", gl_sub: "102.05", iban: "TR330006100519786457841326", deleted_at: T0, deleted_by: "u" });
      insert(db, "cheque_collections", { id: "c1" });
      rejects(() => insert(db, "cheque_collections", { id: "c2" }), "aynı çek iki bekleyen tahsil kaydında");
      insert(db, "cheque_collections", { id: "c3", status: "withdrawn" });
      insert(db, "bank_jobs", { id: "j1", ref: "r" });
      rejects(() => insert(db, "bank_jobs", { id: "j2", ref: "r" }), "aynı bekleyen iş");
      insert(db, "bank_statements", { id: "s1", file_sha256: "abc" });
      rejects(() => insert(db, "bank_statements", { id: "s2", file_sha256: "abc" }), "aynı ekstre dosyası iki kez");
      insert(db, "bank_statements", { id: "s3", file_sha256: "abc", status: "deleted" });
      insert(db, "bank_statement_lines", { id: "l1", external_id: "X1" });
      rejects(() => insert(db, "bank_statement_lines", { id: "l2", external_id: "X1" }), "aynı banka satır kimliği");
      insert(db, "bank_statement_lines", { id: "l3", fingerprint: "f1" }); // parmak izi tekil değil ("Mükerrer Değil")
      insert(db, "pos_sales", { id: "p1", auth_code: "A1" });
      rejects(() => insert(db, "pos_sales", { id: "p2", event_id: "ev-2", auth_code: "A1" }), "aynı provizyon aynı gün aynı POS'ta");
      rejects(() => insert(db, "pos_sales", { id: "p3" }), "aynı olayda iki etkin satış");
      insert(db, "request_keys", {});
      rejects(() => insert(db, "request_keys", { ref_id: "inv-2" }), "aynı istek kimliği");
      insert(db, "fx_rates", {});
      rejects(() => insert(db, "fx_rates", { rate_e6: 1 }), "aynı gün/kur türü/kaynak");
      insert(db, "fx_rates", { source: "manual" }); // aynı gün, başka kaynak serbest
      insert(db, "bank_holidays", {});
      rejects(() => insert(db, "bank_holidays", { name: "İkinci" }), "aynı tatil günü");
    } finally {
      db.exec("ROLLBACK");
    }
  });

  it("kapı listeleri: yeni para tabloları kapıdan geçer, hesap kartının bilgi kolonu geçmez; fin_events tarihli (ileri tarih geri alınır)", () => {
    const store = server.app.store;
    const seen = [];
    const remove = store.addCommitGuard({ check: ({ tables }) => seen.push([...tables].sort().join(",")) });
    try {
      for (const table of ["fin_events", "bank_lines", "bank_accounts", "pos_terminals", "pos_sales", "pos_items", "cheque_collections"]) {
        seen.length = 0;
        // Gözden geçirme B1 (Aşama 2; bilerek güncellendi): para rolündeki banka fişi satırı (role 'bank') olayı bank.post'tan geçmeden
        // yazılamaz (K6 money-event; olay kayıtlı ve bu işlemde bank.post'tan geçmiş olmalı). Bu test yalnız kapı listesini sınar: satır
        // para dışı rolle (gider, 770) yazılır.
        const row = { ...TEMPLATE[table], ...(table === "bank_lines" ? { role: "expense", gl: "770" } : {}) };
        const cols = Object.keys(row);
        assert.throws(() => store.tx(() => {
          store.run(`INSERT INTO ${table} (${cols.join(", ")}) VALUES (${cols.map(() => "?").join(", ")})`, ...cols.map(col => row[col]));
          throw new Error("geri al");
        }), /geri al/);
        // Geri alındığı için kapı çalışmadı; kapıya giren tablo listesi bir sonraki gerçek yazımda görülür.
        store.tx(() => store.run(`INSERT INTO ${table} (${cols.join(", ")}) VALUES (${cols.map(() => "?").join(", ")})`, ...cols.map(col => row[col])));
        assert.ok(seen.some(list => list.split(",").includes(table)), `${table} yazımı mutabakat kapısından geçmedi`);
        // K6 (c, dilim 3): para tablosuna bank.post dışından ham DELETE yalnız store.raw kapsamında (test temizliği).
        store.raw("test: kapı listesi temizliği", () => store.tx(() => store.run(`DELETE FROM ${table}`)));
      }
      store.tx(() => store.run("INSERT INTO bank_accounts (id, code, gl, gl_sub, kind, bank_name, name, opening_date, created_by, created_at) VALUES ('ba-k', 'K1', '102', '102.09', 'demand', 'Ziraat', 'Kapı', '2026-10-01', 'u', ?)", T0));
      seen.length = 0;
      store.run("UPDATE bank_accounts SET name = ?, updated_at = ? WHERE id = ?", "Yeni Ad", T0, "ba-k");
      assert.deepEqual(seen, [], "hesap adı düzeltmesi kapıyı tetiklememeli (bilgi kolonu)");
      store.run("UPDATE bank_accounts SET balance_confirmed = ? WHERE id = ?", 1, "ba-k");
      assert.ok(seen.length === 1, "Bakiye Doğrulandı değişimi kapıdan geçmeli");
      store.tx(() => store.run("DELETE FROM bank_accounts"));
    } finally {
      remove();
    }
    // Boş tabloda fin_events tarih denetimi Mutabakat Testi'nde görünmez (bu aşamada ekran değişmez); satır olunca görünür.
    const codes = () => server.app.integrity.run().checks.map(check => check.code);
    assert.ok(!codes().includes("dates:future:fin_events"), "boş fin_events için denetim satırı görünmemeli");
    const insertEvent = (id, seq, date) => store.tx(() => store.run("INSERT INTO fin_events (id, year, seq, no, type, date, created_by, created_at) VALUES (?, 2026, ?, ?, 'bank_fee', ?, 'u', ?)", id, seq, `BNK-2026-${String(seq).padStart(6, "0")}`, date, T0));
    insertEvent("ev-past", 1, "2026-10-07");
    assert.ok(codes().includes("dates:future:fin_events") && codes().includes("dates:format:fin_events"), "fin_events tarih denetimleri");
    assert.throws(() => insertEvent("ev-future", 2, "2026-10-12"), error => error.status === 409 && error.extra?.code === "ledger-integrity" && error.failures.some(item => item.code === "dates:future:fin_events"));
    assert.throws(() => insertEvent("ev-bad", 3, "2026-02-30"), error => error.status === 409 && error.failures.some(item => item.code === "dates:format:fin_events"));
    assert.equal(store.get("SELECT COUNT(*) AS n FROM fin_events").n, 1, "geri alınan işlem başlığı yazılmadı");
    store.raw("test: olay temizliği", () => store.tx(() => store.run("DELETE FROM fin_events")));
  });

  it("kilit izi: kilitli dönemdeki eski satıra hesap/işlem bağı (fin_ref, event_id) yazmak 409 period-lock; açık dönemde serbest", async () => {
    const admin = await loginAdmin(server);
    const account = unwrap(await admin.post("/api/workspace/accounts", { name: "Kilit Carisi", type: "customer", registeredOn: "2026-09-01" }));
    const old = unwrap(await admin.post(`/api/workspace/accounts/${account.id}/entries`, { kind: "in", amount: "300", date: "2026-09-10", method: "bank", note: "Eski havale" }));
    const fresh = unwrap(await admin.post(`/api/workspace/accounts/${account.id}/entries`, { kind: "in", amount: "200", date: "2026-10-05", method: "bank", note: "Yeni havale" }));
    assert.equal((await admin.put("/api/admin/period-lock", { lockedUntil: "2026-09-30" })).status, 200);
    const store = server.app.store;
    for (const column of ["fin_ref", "event_id"]) {
      assert.throws(() => store.tx(() => store.run(`UPDATE account_entries SET ${column} = ? WHERE id = ?`, "ba-x", old.entryId)), error => error.status === 409 && error.failures?.some(item => item.code === "period-lock"), `kilitli satıra ${column}`);
    }
    // K6 (c, dilim 3): hesap/işlem bağı yazmak gerçek kodda bank.post (op 'assign'); test ham kapsamla yazar.
    store.raw("test: açık dönemde bağ", () => store.tx(() => store.run("UPDATE account_entries SET fin_ref = ?, event_id = ? WHERE id = ?", "ba-x", "ev-x", fresh.entryId)));
    assert.equal(store.get("SELECT fin_ref FROM account_entries WHERE id = ?", old.entryId).fin_ref, "", "kilitli satır değişmedi");
    assert.equal((await admin.put("/api/admin/period-lock", { lockedUntil: "" })).status, 200);
  });
});

describe("K11: v20 göçü hiçbir mevcut satırı değiştirmez (gerçek eski sürüm verisi)", () => {
  const FIXTURES = ["2.0.16", "2.0.17", "2.0.18", "2.0.19", "2.0.20", "2.0.21", "2.0.22", "2.0.23", "2.0.24", "2.0.25", "2.0.26"].map(version => `surum-${version}-zincir`).concat(["surum-2.0.19-cakisma", "surum-2.0.19-eski"]);
  for (const name of FIXTURES) {
    it(`${name}: her şirket dosyası satır satır aynı, kilit izi aynı, göç öncesi yedek tam`, async () => {
      assert.ok(fixtureExists(name), `${name} fikstürü yok`);
      const lockDigestOf = await optional("server/lib/integrity.mjs", "lockDigestOf");
      const digest = (store, lock) => (lockDigestOf ? lockDigestOf(store, lock) : null);
      const fixture = unpackFixture(name);
      try {
        for (const { file, companies } of fixtureDatabases(fixture.dataDir)) {
          const owner = companies[0];
          const hub = companies.some(item => item.id === "sirket-001");
          const copy = openCopy(file);
          const backupDir = mkdtempSync(path.join(tmpdir(), "goc-v20-yedek-"));
          try {
            assert.equal(migrateTo(copy.store, 19), 19, `${owner.code}: v19'a getirilemedi`);
            const lock = copy.store.setting("ledger.lockedUntil", "") || "";
            const beforeRows = snapshot(copy.db);
            const beforeLock = [digest(copy.store, "9999-12-31"), lock ? digest(copy.store, lock) : ""];
            const result = runMigrations(copy.store, { backupDir, company: owner, now: () => new Date("2026-10-08T09:00:00Z") });
            assert.deepEqual(result.applied, [20], `${owner.code}: yalnız v20 uygulanmalı`);
            assert.equal(copy.store.get("PRAGMA user_version").user_version, 20);
            const afterRows = snapshot(copy.db, beforeRows);
            assert.deepEqual(compareSnapshots(beforeRows, afterRows, { hub }), [], `${name} ${owner.code}: göç mevcut satırları değiştirdi`);
            for (const table of Object.keys(V20_TABLES)) assert.equal(copy.store.get(`SELECT COUNT(*) AS n FROM ${table}`).n, 0, `${owner.code}: ${table} eski veride boş olmalı`);
            assert.equal(typeof lockDigestOf, "function", "integrity.lockDigestOf yok");
            assert.deepEqual([digest(copy.store, "9999-12-31"), lock ? digest(copy.store, lock) : ""], beforeLock, `${owner.code}: kilit izi değişti`);
            assert.ok(copy.store.setting("meta.schema.v20At", ""), `${owner.code}: v20 damgası yok`);
            // Göç öncesi tam yedek: şirketin kimliğiyle, içeriği göç öncesiyle birebir.
            assert.ok(result.backup?.path && existsSync(result.backup.path), `${owner.code}: göç öncesi yedek alınmadı`);
            assert.match(result.backup.name, /pre-migration-v20/);
            const saved = new DatabaseSync(result.backup.path, { readOnly: true });
            try {
              assert.equal(saved.prepare("PRAGMA user_version").get().user_version, 19, "yedek v19");
              assert.deepEqual(compareSnapshots(beforeRows, snapshot(saved, beforeRows), { hub: false }), [], `${owner.code}: göç öncesi yedek göç öncesi veriyle aynı değil`);
            } finally {
              saved.close();
            }
          } finally {
            copy.close();
            rmSync(backupDir, { recursive: true, force: true });
          }
        }
      } finally {
        fixture.cleanup();
      }
    });
  }
});

// §9.1 tablosu (plan; Aşama 3'te yetki kataloğuna girer): yerleşik rollerin banka yetkileri.
const PLAN_MATRIX = {
  "bank.view": ["admin", "avukat", "muhasebe"],
  "bank.reports": ["admin", "avukat", "muhasebe"],
  "bank.accounts": ["admin", "muhasebe"],
  "bank.move": ["admin", "avukat", "muhasebe"],
  "bank.cancel": ["admin", "avukat", "muhasebe"],
  "bank.transfer": ["admin", "avukat", "muhasebe"],
  "bank.pos": ["admin", "muhasebe"],
  "bank.commission": ["admin", "muhasebe"],
  "bank.statement": ["admin", "avukat", "muhasebe"],
  "bank.reconcile": ["admin", "avukat", "muhasebe"],
  "bank.settings": ["admin", "muhasebe"],
};
const BANK = Object.keys(PLAN_MATRIX);
// Aşama 3'ten sonraki etkin banka yetkisi: rolün verdiği (yerleşik matris ya da özel rolün kaydı) + kişiye eklenen − kaldırılan.
function effectiveBank(user, roles) {
  const custom = user.role_key ? roles.find(role => role.id === user.role_key) : null;
  const base = custom ? JSON.parse(custom.permissions_json).filter(key => BANK.includes(key)) : BANK.filter(key => PLAN_MATRIX[key].includes(user.role));
  const grants = JSON.parse(user.grants_json || "{}");
  const set = new Set([...base, ...(grants.add || []).filter(key => BANK.includes(key))]);
  for (const key of grants.remove || []) set.delete(key);
  return BANK.filter(key => set.has(key));
}

describe("yetki göçü (K4, §9.1): 2.0.26 kurulumunun özel rolleri ve kişiye özel yetkileri", () => {
  let fixture;
  before(() => {
    fixture = unpackFixture("surum-2.0.26-zincir");
  });
  after(() => fixture?.cleanup());

  it("bankadan çıkış yapabilen herkes bank.move + bank.cancel; cash.manage → transfer/ekstre/mutabakat; cash.view kaldırılmışsa yalnız görme kalkar", () => {
    const root = fixtureDatabases(fixture.dataDir).find(item => item.companies.some(company => company.id === "sirket-001"));
    const copy = openCopy(root.file);
    try {
      migrateTo(copy.store, 19);
      runMigrations(copy.store, { backupDir: null, company: root.companies[0], now: () => new Date("2026-10-08T09:00:00Z") });
      const roles = copy.store.all("SELECT id, name, permissions_json FROM roles");
      const users = copy.store.all("SELECT username, role, role_key, grants_json FROM users WHERE deleted_at IS NULL");
      const of = username => effectiveBank(users.find(user => user.username === username), roles);
      // Fikstürdeki kişiler (test/guvenilirlik/uretici.mjs workPeople, gerçek v2.0.21 API'siyle açıldı):
      assert.deepEqual(of("ayse"), ["bank.move", "bank.cancel"], "personel + kişiye fatura yönetimi → bankadan çıkış");
      assert.deepEqual(of("mehmet"), BANK.filter(key => !["bank.view", "bank.reports"].includes(key)), "muhasebe, cash.view kaldırılmış → yalnız görme kalkar");
      assert.deepEqual(of("zeynep"), ["bank.view", "bank.reports", "bank.move", "bank.cancel"], "özel rol: cari yönetimi + Kasa görme");
      assert.deepEqual(of("ali"), [], "personel: banka yetkisi yok");
      assert.deepEqual(of("fatma"), ["bank.view", "bank.reports", "bank.move", "bank.cancel", "bank.transfer", "bank.statement", "bank.reconcile"], "avukat: kişiden yazma yetkileri kaldırılsa da banka yazma kaldırılmaz (K4)");
      assert.deepEqual(of("kasa1"), ["bank.view", "bank.reports", "bank.move", "bank.cancel", "bank.transfer", "bank.statement", "bank.reconcile"], "özel rol Kasa yönetimi + kişiye satış");
      const role = name => JSON.parse(roles.find(item => item.name === name).permissions_json).filter(key => BANK.includes(key)).sort();
      assert.deepEqual(role("Tahsilat Sorumlusu"), ["bank.cancel", "bank.move", "bank.reports", "bank.view"]);
      assert.deepEqual(role("Kasa Görevlisi"), ["bank.reconcile", "bank.reports", "bank.statement", "bank.transfer", "bank.view"]);
      assert.equal(JSON.parse(users.find(user => user.username === "admin").grants_json || "[]").add?.length || 0, 0, "yöneticiye kişiye özel kayıt yazılmaz");
    } finally {
      copy.close();
    }
  });

  it("yalnız ortak katmanda: 002'nin kullanıcı kopyası göçte değişmez; göç iki kez çalışınca aynı (idempotent)", async () => {
    const migrateBankGrants = await optional("server/lib/bank/grants.mjs", "migrateBankGrants");
    assert.equal(typeof migrateBankGrants, "function", "bank/grants.mjs migrateBankGrants yok");
    const child = fixtureDatabases(fixture.dataDir).find(item => item.companies.some(company => company.code === "002"));
    const copy = openCopy(child.file);
    try {
      migrateTo(copy.store, 19);
      const beforeRows = snapshot(copy.db);
      runMigrations(copy.store, { backupDir: null, company: child.companies[0], now: () => new Date("2026-10-08T09:00:00Z") });
      assert.deepEqual(compareSnapshots(beforeRows, snapshot(copy.db, beforeRows), { hub: false }), [], "002'de users/roles değişmemeli");
    } finally {
      copy.close();
    }
    const root = fixtureDatabases(fixture.dataDir).find(item => item.companies.some(company => company.id === "sirket-001"));
    const again = openCopy(root.file);
    try {
      migrateTo(again.store, 19);
      runMigrations(again.store, { backupDir: null, company: root.companies[0] });
      const once = snapshot(again.db);
      again.store.tx(() => migrateBankGrants(again.store));
      assert.deepEqual(snapshot(again.db).users, once.users, "ikinci çalıştırma kullanıcıları değiştirmemeli");
      assert.deepEqual(snapshot(again.db).roles, once.roles, "ikinci çalıştırma rolleri değiştirmemeli");
    } finally {
      again.close();
    }
  });
});

describe("şirket sıfırlama (§5.6)", () => {
  let server;
  let admin;
  const counts = () => Object.fromEntries(Object.keys(V20_TABLES).map(table => [table, server.app.store.get(`SELECT COUNT(*) AS n FROM ${table}`).n]));
  const seed = () => {
    const db = server.app.db;
    db.exec("BEGIN");
    for (const table of Object.keys(V20_TABLES)) insert(db, table, table === "bank_accounts" ? { balance_confirmed: 1 } : {});
    db.exec("COMMIT");
    server.app.store.setSetting("bank.settings", JSON.stringify({ similarCheck: false }));
    server.app.store.setSetting("meta.bank.seq.2026", "41");
  };
  before(async () => {
    server = await startTestServer({ now: "2026-10-08T12:00:00+03:00" });
    admin = await loginAdmin(server);
  });
  after(async () => server?.close());

  it("Tüm Hareketleri Sil: hareket tabloları silinir; hesap/POS kartları ve oranları kalır, Bakiye Doğrulandı sıfırlanır; kur ve tatil, banka ayarları ve İşlem No sayacı kalır", async () => {
    seed();
    const result = await admin.post("/api/companies/sirket-001/reset", { mode: "movements", confirm: "001", password: ADMIN_PASSWORD });
    assert.equal(result.status, 200, JSON.stringify(result.data).slice(0, 300));
    const left = counts();
    for (const table of ["fin_events", "bank_lines", "pos_sales", "pos_items", "cheque_collections", "bank_statements", "bank_statement_lines", "bank_matches", "bank_plans", "bank_jobs", "request_keys"]) assert.equal(left[table], 0, `${table} silinmeliydi`);
    for (const table of ["bank_accounts", "pos_terminals", "pos_rates", "fx_rates", "bank_holidays"]) assert.equal(left[table], 1, `${table} kalmalıydı`);
    assert.equal(server.app.store.get("SELECT balance_confirmed AS v FROM bank_accounts").v, 0, "açılışlar silindiği için Bakiye Doğrulandı sıfırlanır");
    assert.equal(server.app.store.setting("bank.settings", ""), JSON.stringify({ similarCheck: false }));
    assert.equal(server.app.store.setting("meta.bank.seq.2026", ""), "41", "İşlem No sayacı geri gitmez");
  });

  it("Tümünü Sıfırla: kartlar da silinir; kur ve tatil (başvuru verisi), banka ayarları ve İşlem No sayacı kalır", async () => {
    for (const table of Object.keys(V20_TABLES)) server.app.db.exec(`DELETE FROM ${table}`);
    seed();
    const result = await admin.post("/api/companies/sirket-001/reset", { mode: "all", confirm: "001", password: ADMIN_PASSWORD });
    assert.equal(result.status, 200, JSON.stringify(result.data).slice(0, 300));
    const left = counts();
    for (const table of Object.keys(V20_TABLES).filter(item => !["fx_rates", "bank_holidays"].includes(item))) assert.equal(left[table], 0, `${table} silinmeliydi`);
    assert.equal(left.fx_rates, 1);
    assert.equal(left.bank_holidays, 1);
    assert.equal(server.app.store.setting("bank.settings", ""), JSON.stringify({ similarCheck: false }));
    assert.equal(server.app.store.setting("meta.bank.seq.2026", ""), "41");
  });
});

describe("göç ortasında kesinti (SIGKILL)", () => {
  it("v20 yarıda kalırsa dosya v19'da sağlam, göç öncesi yedek tam; yeniden açılışta göç tamamlanır; yedekten dönüş eski hâli verir", async () => {
    const fixture = unpackFixture("surum-2.0.26-zincir");
    try {
      const root = fixtureDatabases(fixture.dataDir).find(item => item.companies.some(company => company.id === "sirket-001"));
      const factsBefore = dbFacts(root.file);
      const migrationBackups = mkdtempSync(path.join(tmpdir(), "goc-kesinti-yedek-"));
      const child = spawnSync(process.execPath, ["--disable-warning=ExperimentalWarning", path.join(ROOT, "test/guvenilirlik/goc-kesinti.mjs"), root.file, migrationBackups, JSON.stringify(root.companies[0]), "6"], { encoding: "utf8" });
      assert.equal(child.signal, "SIGKILL", `süreç göç ortasında ölmeliydi (${child.status} ${child.stderr || child.stdout})`);
      const db = new DatabaseSync(root.file);
      try {
        assert.equal(db.prepare("PRAGMA user_version").get().user_version, 19, "yarım göç işlenmedi");
        assert.equal(db.prepare("SELECT COUNT(*) AS n FROM sqlite_master WHERE name IN ('fin_events', 'request_keys', 'bank_accounts')").get().n, 0, "yarım tablo yok");
        assert.ok(!db.prepare("PRAGMA table_info(account_entries)").all().some(col => col.name === "fin_ref"), "yarım kolon yok");
      } finally {
        db.close();
      }
      assert.deepEqual(dbFacts(root.file), factsBefore, "veri kesintiden etkilenmedi");
      const saved = readdirSync(migrationBackups, { recursive: true }).map(String).find(item => /pre-migration-v20/.test(item));
      assert.ok(saved, "göç öncesi yedek kesintiden önce alınmıştı");
      assert.deepEqual(dbFacts(path.join(migrationBackups, saved)), factsBefore, "göç öncesi yedek tam");
      // Yeniden açılış: göç baştan ve tam uygulanır; sayılar aynı.
      const server = await startTestServer({ dataDir: fixture.dataDir, maxCompanies: 10, now: "2026-10-08T12:00:00+03:00" });
      try {
        assert.equal(server.app.store.get("PRAGMA user_version").user_version, 20);
        assert.equal(server.app.store.get("SELECT COUNT(*) AS n FROM sqlite_master WHERE name = 'fin_events'").n, 1);
      } finally {
        await server.close();
      }
      assert.deepEqual(dbFacts(root.file), factsBefore, "göç tamamlandıktan sonra sayılar aynı");
      // Yedekten dönüş (güncelleme geri dönüşü gibi): göç öncesi yedek dosyanın yerine konur → v19, sayılar aynı.
      const restored = new DatabaseSync(path.join(migrationBackups, saved), { readOnly: true });
      try {
        assert.equal(restored.prepare("PRAGMA user_version").get().user_version, 19);
      } finally {
        restored.close();
      }
      rmSync(migrationBackups, { recursive: true, force: true });
    } finally {
      fixture.cleanup();
    }
  });
});
