// Veritabanı şema sürümleme. PRAGMA user_version = uygulanan son göç numarası.
// Kural: göçler yalnızca EKLEYİCİ olur (sütun/tablo/indeks ekleme, veri normalleştirme);
// böylece bir güncelleme geri alınsa bile eski sürüm veritabanını okuyabilir.
import { createBackup } from "./backup.mjs";
import { DEFAULT_ADMIN_PASSWORD } from "./config.mjs";
import { verifyPassword } from "./passwords.mjs";

const columnExists = (store, table, column) => store.all(`PRAGMA table_info(${table})`).some(item => item.name === column);
const addColumn = (store, table, column, definition) => {
  if (!columnExists(store, table, column)) store.exec(`ALTER TABLE ${table} ADD COLUMN ${column} ${definition}`);
};

export const MIGRATIONS = [
  {
    version: 1,
    name: "v1.0.0 temel şema",
    up(store) {
      store.exec(`
        CREATE TABLE IF NOT EXISTS users (
          id TEXT PRIMARY KEY,
          username TEXT NOT NULL UNIQUE,
          display_name TEXT NOT NULL,
          role TEXT NOT NULL CHECK(role IN ('admin','avukat','personel','muhasebe')),
          password_hash TEXT NOT NULL,
          active INTEGER NOT NULL DEFAULT 1,
          created_at TEXT NOT NULL,
          updated_at TEXT NOT NULL
        );
        CREATE TABLE IF NOT EXISTS sessions (
          token_hash TEXT PRIMARY KEY,
          user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
          expires_at TEXT NOT NULL,
          created_at TEXT NOT NULL
        );
        CREATE TABLE IF NOT EXISTS settings (key TEXT PRIMARY KEY, value TEXT NOT NULL, updated_at TEXT NOT NULL);
        CREATE TABLE IF NOT EXISTS records (
          id TEXT PRIMARY KEY,
          source_name TEXT NOT NULL,
          case_key TEXT NOT NULL,
          values_json TEXT NOT NULL,
          version INTEGER NOT NULL DEFAULT 1,
          created_by TEXT NOT NULL,
          created_at TEXT NOT NULL,
          updated_at TEXT NOT NULL,
          UNIQUE(source_name, case_key)
        );
        CREATE TABLE IF NOT EXISTS overrides (
          id TEXT PRIMARY KEY,
          source_name TEXT NOT NULL,
          case_key TEXT NOT NULL,
          field TEXT NOT NULL,
          value TEXT NOT NULL,
          version INTEGER NOT NULL DEFAULT 1,
          updated_by TEXT NOT NULL,
          updated_at TEXT NOT NULL,
          UNIQUE(source_name, case_key, field)
        );
        CREATE TABLE IF NOT EXISTS deleted_records (
          id TEXT PRIMARY KEY,
          source_name TEXT NOT NULL,
          case_key TEXT NOT NULL,
          deleted_by TEXT NOT NULL,
          deleted_at TEXT NOT NULL,
          UNIQUE(source_name, case_key)
        );
        CREATE TABLE IF NOT EXISTS notes (id TEXT PRIMARY KEY, case_key TEXT NOT NULL, note TEXT NOT NULL, created_by TEXT NOT NULL, created_at TEXT NOT NULL);
        CREATE TABLE IF NOT EXISTS phones (id TEXT PRIMARY KEY, case_key TEXT NOT NULL, phone TEXT NOT NULL, label TEXT NOT NULL, created_by TEXT NOT NULL, created_at TEXT NOT NULL);
        CREATE TABLE IF NOT EXISTS payments (id TEXT PRIMARY KEY, case_key TEXT NOT NULL, amount REAL NOT NULL, date TEXT NOT NULL, note TEXT NOT NULL, created_by TEXT NOT NULL, created_at TEXT NOT NULL);
        CREATE TABLE IF NOT EXISTS liens (id TEXT PRIMARY KEY, case_key TEXT NOT NULL, title TEXT NOT NULL, placed_at TEXT NOT NULL, expires_at TEXT NOT NULL, status TEXT NOT NULL, created_by TEXT NOT NULL, created_at TEXT NOT NULL);
        CREATE TABLE IF NOT EXISTS tasks (id TEXT PRIMARY KEY, title TEXT NOT NULL, case_key TEXT NOT NULL, assignee TEXT NOT NULL, due_date TEXT NOT NULL, priority TEXT NOT NULL, status TEXT NOT NULL, created_by TEXT NOT NULL, created_at TEXT NOT NULL, completed_at TEXT, completed_by TEXT);
        CREATE TABLE IF NOT EXISTS messages (id TEXT PRIMARY KEY, recipient TEXT NOT NULL, message TEXT NOT NULL, case_key TEXT NOT NULL, created_by TEXT NOT NULL, created_at TEXT NOT NULL);
        CREATE TABLE IF NOT EXISTS audit_events (id TEXT PRIMARY KEY, type TEXT NOT NULL, entity_id TEXT NOT NULL, actor_id TEXT NOT NULL, actor_name TEXT NOT NULL, payload_json TEXT NOT NULL, created_at TEXT NOT NULL);
        CREATE INDEX IF NOT EXISTS idx_audit_created_at ON audit_events(created_at);
        CREATE INDEX IF NOT EXISTS idx_records_source ON records(source_name);
      `);
    },
  },
  {
    version: 2,
    name: "v1.1.0 güvenlik, merkezi notlar ve Excel kaynakları",
    up(store) {
      addColumn(store, "users", "must_change_password", "INTEGER NOT NULL DEFAULT 0");
      addColumn(store, "users", "last_login_at", "TEXT");
      addColumn(store, "users", "password_changed_at", "TEXT");
      addColumn(store, "settings", "updated_by", "TEXT");
      store.exec(`
        CREATE TABLE IF NOT EXISTS case_notes (
          case_key TEXT PRIMARY KEY,
          note TEXT NOT NULL,
          version INTEGER NOT NULL DEFAULT 1,
          updated_by TEXT NOT NULL,
          updated_at TEXT NOT NULL
        );
        CREATE TABLE IF NOT EXISTS source_snapshots (
          id TEXT PRIMARY KEY,
          source_key TEXT NOT NULL UNIQUE,
          file_name TEXT NOT NULL,
          tabs_json TEXT NOT NULL,
          rows_json TEXT NOT NULL,
          row_count INTEGER NOT NULL,
          size_bytes INTEGER NOT NULL,
          uploaded_by TEXT NOT NULL,
          uploaded_at TEXT NOT NULL
        );
        CREATE INDEX IF NOT EXISTS idx_case_notes_updated ON case_notes(updated_at);
        CREATE INDEX IF NOT EXISTS idx_notes_case ON notes(case_key);
        CREATE INDEX IF NOT EXISTS idx_phones_case ON phones(case_key);
        CREATE INDEX IF NOT EXISTS idx_payments_case ON payments(case_key);
        CREATE INDEX IF NOT EXISTS idx_liens_case ON liens(case_key);
        CREATE INDEX IF NOT EXISTS idx_liens_status_expires ON liens(status, expires_at);
        CREATE INDEX IF NOT EXISTS idx_tasks_status ON tasks(status);
        CREATE INDEX IF NOT EXISTS idx_overrides_source_case ON overrides(source_name, case_key);
        CREATE INDEX IF NOT EXISTS idx_deleted_source ON deleted_records(source_name);
        CREATE INDEX IF NOT EXISTS idx_messages_created ON messages(created_at);
        CREATE INDEX IF NOT EXISTS idx_audit_actor ON audit_events(actor_id);
        CREATE INDEX IF NOT EXISTS idx_sessions_user ON sessions(user_id);
        CREATE INDEX IF NOT EXISTS idx_sessions_expires ON sessions(expires_at);
      `);
      // Hâlâ varsayılan parolayı kullanan yöneticiler ilk girişte parola değiştirmek zorunda kalır.
      for (const user of store.all("SELECT id, password_hash FROM users WHERE role = 'admin'")) {
        if (verifyPassword(DEFAULT_ADMIN_PASSWORD, user.password_hash)) store.run("UPDATE users SET must_change_password = 1 WHERE id = ?", user.id);
      }
      // v1.0.0 tamamlanan görevlerde görünen adı saklıyordu; artık kullanıcı kimliği saklanır.
      store.exec(`
        UPDATE tasks SET completed_by = (SELECT u.id FROM users u WHERE u.display_name = tasks.completed_by LIMIT 1)
        WHERE completed_by IS NOT NULL AND completed_by NOT LIKE 'user-%'
          AND EXISTS (SELECT 1 FROM users u WHERE u.display_name = tasks.completed_by);
      `);
    },
  },
];

export const LATEST_VERSION = MIGRATIONS.at(-1).version;

export function runMigrations(store, { backupDir, keep = 30, log } = {}) {
  const current = store.get("PRAGMA user_version").user_version;
  const pending = MIGRATIONS.filter(item => item.version > current);
  if (!pending.length) return { from: current, to: current, applied: [], backup: null };
  const hasData = Boolean(store.get("SELECT 1 AS found FROM sqlite_master WHERE type = 'table' AND name = 'users'"));
  let backup = null;
  if (hasData && backupDir) {
    // Göçten önce mutlaka tam yedek: bir sorun olursa bu dosyaya dönülür.
    backup = createBackup(store.db, backupDir, { label: `pre-migration-v${pending.at(-1).version}`, keep });
    log?.info(`Göç öncesi yedek alındı: ${backup.name}`);
  }
  for (const migration of pending) {
    store.tx(() => {
      migration.up(store);
      store.exec(`PRAGMA user_version = ${migration.version}`);
    });
    log?.info(`Veritabanı göçü uygulandı: ${migration.version} (${migration.name})`);
  }
  return { from: current, to: LATEST_VERSION, applied: pending.map(item => item.version), backup };
}
