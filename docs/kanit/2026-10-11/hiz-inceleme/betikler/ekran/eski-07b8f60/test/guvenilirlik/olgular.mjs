// Bir şirketin verisini sürümden bağımsız "olgular"la özetler: veri tabanındaki kayıt sayıları ve tutar toplamları (dosyadan)
// ve kullanıcının gördüğü cari listesi (API'den: her carinin bakiyesi). Eski sürümün ürettiği an ile güncel sürümün
// gösterdiği an bu olgularla karşılaştırılır: "hiçbir kayıt kaybolmadı, hiçbir kayıt başka şirketten gelmedi".
import { createHash } from "node:crypto";
import { copyFileSync, existsSync, mkdtempSync, readFileSync, readdirSync, rmSync, statSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { DatabaseSync } from "node:sqlite";

const cents = value => Math.round(Number(value || 0) * 100);
// Sorgu tablosu yoksa (eski şema) 0 sayılır; ama karşılaştırmada iki taraf aynı şemada okunur.
const SQL = {
  accounts: "SELECT COUNT(*) AS n FROM accounts WHERE deleted_at IS NULL",
  accountEntries: "SELECT COUNT(*) AS n FROM account_entries",
  accountNet: "SELECT COALESCE(SUM(CASE WHEN kind IN ('debt', 'out') THEN amount ELSE -amount END), 0) AS n FROM account_entries",
  cashEntries: "SELECT COUNT(*) AS n FROM cash_entries",
  cashNet: "SELECT COALESCE(SUM(CASE WHEN kind = 'in' THEN amount ELSE -amount END), 0) AS n FROM cash_entries",
  invoices: "SELECT COUNT(*) AS n FROM invoices WHERE status <> 'draft'",
  invoicePayable: "SELECT COALESCE(SUM(payable_total), 0) AS n FROM invoices WHERE status <> 'draft'",
  invoiceLines: "SELECT COUNT(*) AS n FROM invoice_lines",
  plans: "SELECT COUNT(*) AS n FROM plans",
  planTotal: "SELECT COALESCE(SUM(total), 0) AS n FROM plans",
  planEntries: "SELECT COUNT(*) AS n FROM plan_entries",
  planPaid: "SELECT COALESCE(SUM(CASE WHEN kind = 'in' THEN amount ELSE -amount END), 0) AS n FROM plan_entries",
  datasetRows: "SELECT COUNT(*) AS n FROM dataset_rows",
  records: "SELECT COUNT(*) AS n FROM records",
  tasks: "SELECT COUNT(*) AS n FROM tasks",
};
const MONEY = new Set(["accountNet", "cashNet", "invoicePayable", "planTotal", "planPaid"]);

/**
 * Beklenen olgularla karşılaştırma: yalnız beklenende bulunan ve o anda tablosu olan (null olmayan) anahtarlar. Eski
 * sürümün o anda olmayan tablosu (ör. v1.3.1'de cari) ya da fikstürden sonra eklenmiş yeni olgu anahtarı karşılaştırmayı
 * bozmaz; var olan her anahtar bire bir eşit olmalı.
 */
export const expectedFacts = expected => Object.fromEntries(Object.entries(expected || {}).filter(([, value]) => value !== null));
export const knownFacts = (actual, expected) => Object.fromEntries(Object.keys(expectedFacts(expected)).map(key => [key, actual?.[key] ?? null]));
export const sameFacts = (actual, expected) => JSON.stringify(knownFacts(actual, expected)) === JSON.stringify(expectedFacts(expected));

/**
 * Veri tabanı dosyasındaki olgular (WAL'deki işlenmiş kayıtlar dahil). Dosyanın KOPYASI okunur: kanıt olan yedek dosyasının
 * yanında SQLite'ın açarken bıraktığı -wal/-shm oluşmaz, canlı dosyaya hiç bağlanılmaz.
 */
export function dbFacts(file) {
  const dir = mkdtempSync(path.join(tmpdir(), "olgu-"));
  const copy = path.join(dir, "kopya.sqlite");
  copyFileSync(file, copy);
  if (existsSync(`${file}-wal`)) copyFileSync(`${file}-wal`, `${copy}-wal`);
  const db = new DatabaseSync(copy, { readOnly: true });
  try {
    const out = {};
    for (const [key, sql] of Object.entries(SQL)) {
      let value = 0;
      try {
        value = db.prepare(sql).get().n;
      } catch {
        value = null; // tablo yok
      }
      out[key] = value === null ? null : MONEY.has(key) ? cents(value) : value;
    }
    return out;
  } finally {
    db.close();
    rmSync(dir, { recursive: true, force: true });
  }
}

/** Cari listesinin (kimlik, ad, bakiye) özeti: sayı, bakiye toplamı ve sıralı içeriğin özeti. */
export function accountsDigest(accounts) {
  const lines = accounts.map(item => `${item.id}|${item.name}|${cents(item.balance)}`).sort();
  return { count: lines.length, balance: accounts.reduce((sum, item) => sum + cents(item.balance), 0), hash: createHash("sha256").update(lines.join("\n")).digest("hex").slice(0, 32) };
}

/** Seçili şirketin carileri (API, bütün durumlar, sayfa sayfa). */
export async function apiAccounts(api) {
  const out = [];
  for (let offset = 0; ; offset += 5000) {
    const page = await api.get(`/api/workspace/accounts?status=all&limit=5000&offset=${offset}`);
    if (page.status !== 200) throw new Error(`Cari listesi okunamadı (${page.status}): ${JSON.stringify(page.data).slice(0, 200)}`);
    out.push(...page.data.accounts);
    if (!page.data.hasMore) break;
  }
  return out;
}

/** Seçili şirketin kullanıcıya görünen olguları (API): cari özeti ve tablo satır sayısı. */
export async function apiFacts(api) {
  const accounts = accountsDigest(await apiAccounts(api));
  const dataset = await api.get("/api/workspace/dataset");
  return { accounts, datasetRows: dataset.data?.rowCount ?? 0 };
}

export const sha256File = file => createHash("sha256").update(readFileSync(file)).digest("hex");

/** Klasördeki bütün dosyalar (göreli yol → { sha, size }), alt klasörler dahil. */
export function treeHashes(root) {
  const out = {};
  const walk = dir => {
    if (!existsSync(dir)) return;
    for (const name of readdirSync(dir)) {
      const full = path.join(dir, name);
      const stats = statSync(full);
      if (stats.isDirectory()) walk(full);
      else out[path.relative(root, full).split(path.sep).join("/")] = { sha: sha256File(full), size: stats.size };
    }
  };
  walk(root);
  return out;
}
