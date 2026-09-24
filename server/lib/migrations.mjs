// Veritabanı şema sürümleme. PRAGMA user_version = uygulanan son göç numarası.
// Kural: göçler mümkün olduğunca EKLEYİCİ olur (sütun/tablo/indeks ekleme, veri normalleştirme). Bir göç mevcut
// kayıtları yeniden anahtarlıyorsa (göç 4) geri dönüş, güncelleme öncesi alınan tam yedeğe dönülerek yapılır:
// güncelleme düzeni yeni sürüm açılamazsa şema sürümü değiştiği için veritabanını kendiliğinden yedekten geri yükler.
import { randomUUID } from "node:crypto";
import { createBackup } from "./backup.mjs";
import { DEFAULT_ADMIN_PASSWORD } from "./config.mjs";
import { rowHash, rowIdentities } from "./dataset-identity.mjs";
import { parseJson } from "./http.mjs";
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
  {
    version: 3,
    name: "v1.4.0 ofis içi sohbet",
    up(store) {
      store.exec(`
        CREATE TABLE IF NOT EXISTS chat_conversations (
          id TEXT PRIMARY KEY,
          kind TEXT NOT NULL CHECK (kind IN ('office', 'direct')),
          direct_key TEXT UNIQUE,
          title TEXT,
          created_at TEXT NOT NULL,
          last_message_at TEXT
        );
        CREATE TABLE IF NOT EXISTS chat_members (
          conversation_id TEXT NOT NULL,
          user_id TEXT NOT NULL,
          joined_at TEXT NOT NULL,
          last_read_at TEXT,
          PRIMARY KEY (conversation_id, user_id)
        );
        CREATE TABLE IF NOT EXISTS chat_messages (
          id TEXT PRIMARY KEY,
          conversation_id TEXT NOT NULL,
          sender_id TEXT NOT NULL,
          body TEXT NOT NULL,
          case_key TEXT,
          created_at TEXT NOT NULL
        );
        CREATE INDEX IF NOT EXISTS idx_chat_messages_conversation ON chat_messages(conversation_id, created_at);
        CREATE INDEX IF NOT EXISTS idx_chat_members_user ON chat_members(user_id);
      `);
      const timestamp = new Date().toISOString();
      store.run("INSERT OR IGNORE INTO chat_conversations (id, kind, title, created_at) VALUES ('conversation-office', 'office', 'Ofis geneli', ?)", timestamp);
      // Adla kişi bulma (bu göçe sabitlenmiş kopya): önce görünen ad (aktif hesaplar öncelikli), yoksa kullanıcı adı;
      // birden çok aday varsa (eski kurulumlarda aynı adlı iki hesap olabilir) kimse seçilmez.
      const fold = value => String(value ?? "").normalize("NFC").trim().replace(/\s+/g, " ").toLocaleLowerCase("tr-TR");
      const users = store.all("SELECT id, username, display_name, active FROM users");
      const resolve = value => {
        const wanted = fold(value);
        if (!wanted) return null;
        const single = list => (list.length === 1 ? list[0].id : null);
        const byName = users.filter(user => fold(user.display_name) === wanted);
        if (byName.length) return single(byName.filter(user => user.active).length ? byName.filter(user => user.active) : byName);
        return single(users.filter(user => fold(user.username) === wanted));
      };
      // Görevin kime atandığı artık kullanıcı kimliğiyle de tutulur: ad değişse de görev kişide kalır ve başkası
      // adını değiştirerek o görevi göremez. Kişiye bağlanamayan (serbest yazılmış) görevlerde ad eşleşmesi sürer.
      addColumn(store, "tasks", "assignee_id", "TEXT");
      for (const task of store.all("SELECT id, assignee FROM tasks WHERE assignee_id IS NULL")) {
        const assigneeId = resolve(task.assignee);
        if (assigneeId) store.run("UPDATE tasks SET assignee_id = ? WHERE id = ?", assigneeId, task.id);
      }
      store.exec("CREATE INDEX IF NOT EXISTS idx_tasks_assignee ON tasks(assignee_id)");
      // Eski "Mesajlar" kayıtları sohbete taşınır: alıcı adı tek bir kullanıcıya denk geliyorsa özel yazışmaya,
      // gelmiyorsa (veya belirsizse) "→ ad:" önekiyle ofis kanalına; eski ekranda da herkes görüyordu.
      // Eski tablo silinmez (geri dönüşte eski sürüm onu okur).
      const directs = new Map();
      for (const row of store.all("SELECT * FROM messages ORDER BY created_at")) {
        const target = resolve(row.recipient);
        let conversationId = "conversation-office";
        let body = row.message;
        if (target && target !== row.created_by) {
          const key = [row.created_by, target].sort().join("|");
          conversationId = directs.get(key) || store.get("SELECT id FROM chat_conversations WHERE direct_key = ?", key)?.id;
          if (!conversationId) {
            conversationId = `conversation-${randomUUID()}`;
            store.run("INSERT INTO chat_conversations (id, kind, direct_key, title, created_at) VALUES (?, 'direct', ?, NULL, ?)", conversationId, key, row.created_at);
            for (const member of [row.created_by, target]) store.run("INSERT OR IGNORE INTO chat_members (conversation_id, user_id, joined_at, last_read_at) VALUES (?, ?, ?, ?)", conversationId, member, row.created_at, timestamp);
          }
          directs.set(key, conversationId);
        } else if (!target && fold(row.recipient)) {
          body = `→ ${String(row.recipient).trim()}: ${row.message}`;
        }
        store.run("INSERT OR IGNORE INTO chat_messages (id, conversation_id, sender_id, body, case_key, created_at) VALUES (?, ?, ?, ?, ?, ?)", `chat-${row.id}`, conversationId, row.created_by, body, row.case_key || null, row.created_at);
        store.run("UPDATE chat_conversations SET last_message_at = ? WHERE id = ? AND (last_message_at IS NULL OR last_message_at < ?)", row.created_at, conversationId, row.created_at);
      }
      // Taşınan eski mesajlar okunmuş sayılır; güncellemeden sonra rozet patlaması olmaz.
      for (const user of users) store.run("INSERT OR IGNORE INTO chat_members (conversation_id, user_id, joined_at, last_read_at) VALUES ('conversation-office', ?, ?, ?)", user.id, timestamp, timestamp);
    },
  },
  {
    version: 4,
    name: "v1.5.0 kalıcı çalışma verisi",
    up(store) {
      store.exec(`
        CREATE TABLE IF NOT EXISTS dataset_rows (
          dataset_key TEXT NOT NULL,
          row_id TEXT NOT NULL,
          case_key TEXT NOT NULL,
          tab TEXT NOT NULL DEFAULT '',
          position INTEGER NOT NULL,
          values_json TEXT NOT NULL,
          row_hash TEXT NOT NULL,
          origin TEXT NOT NULL,
          created_at TEXT NOT NULL,
          updated_at TEXT NOT NULL,
          missing_since TEXT,
          PRIMARY KEY (dataset_key, row_id)
        );
        CREATE INDEX IF NOT EXISTS idx_dataset_rows_position ON dataset_rows(dataset_key, position);
        CREATE INDEX IF NOT EXISTS idx_dataset_rows_case ON dataset_rows(dataset_key, case_key);
        CREATE TABLE IF NOT EXISTS dataset_imports (
          id TEXT PRIMARY KEY,
          dataset_key TEXT NOT NULL,
          kind TEXT NOT NULL,
          mode TEXT NOT NULL,
          label TEXT NOT NULL DEFAULT '',
          source_url TEXT,
          row_count INTEGER NOT NULL DEFAULT 0,
          added INTEGER NOT NULL DEFAULT 0,
          updated INTEGER NOT NULL DEFAULT 0,
          unchanged INTEGER NOT NULL DEFAULT 0,
          removed INTEGER NOT NULL DEFAULT 0,
          missing INTEGER NOT NULL DEFAULT 0,
          backup_name TEXT,
          created_by TEXT NOT NULL,
          created_at TEXT NOT NULL
        );
        CREATE INDEX IF NOT EXISTS idx_dataset_imports_created ON dataset_imports(dataset_key, created_at);
      `);
      // Etkin kaynak (Excel dosyası veya Google Sheets bağlantısı) kalıcı çalışma verisine dönüşür. Ofisin o kaynaktaki
      // düzeltmeleri, silmeleri ve yeni kayıtları artık dosya adına/bağlantıya değil çalışma verisine bağlıdır.
      const key = "dataset://ofis";
      const active = String(store.get("SELECT value FROM settings WHERE key = 'client.sheetUrl'")?.value || "").trim();
      if (!active) return;
      const timestamp = new Date().toISOString();
      for (const table of ["overrides", "deleted_records", "records"]) store.run(`UPDATE ${table} SET source_name = ? WHERE source_name = ?`, key, active);
      const setSetting = (name, value) =>
        store.run("INSERT INTO settings (key, value, updated_at, updated_by) VALUES (?, ?, ?, NULL) ON CONFLICT(key) DO UPDATE SET value = excluded.value, updated_at = excluded.updated_at", name, String(value), timestamp);
      const logImport = (kind, label, url, rows, by) =>
        store.run(
          "INSERT INTO dataset_imports (id, dataset_key, kind, mode, label, source_url, row_count, added, created_by, created_at) VALUES (?, ?, ?, 'migration', ?, ?, ?, ?, ?, ?)",
          `import-${randomUUID()}`, key, kind, label, url, rows, rows, by || "system", timestamp,
        );
      if (active.startsWith("excel://")) {
        const snapshot = store.get("SELECT file_name, rows_json, uploaded_by, uploaded_at FROM source_snapshots WHERE source_key = ?", active);
        if (!snapshot) return;
        const rows = parseJson(snapshot.rows_json, []).filter(row => row && typeof row === "object" && !Array.isArray(row));
        const identities = rowIdentities(rows);
        rows.forEach((values, index) => {
          const identity = identities[index];
          store.run(
            "INSERT OR IGNORE INTO dataset_rows (dataset_key, row_id, case_key, tab, position, values_json, row_hash, origin, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, 'excel', ?, ?)",
            key, identity.id, identity.caseKey, identity.tab, index, JSON.stringify(values), rowHash(values), snapshot.uploaded_at || timestamp, timestamp,
          );
        });
        setSetting("dataset.label", snapshot.file_name);
        setSetting("dataset.changedAt", snapshot.uploaded_at || timestamp);
        logImport("excel", snapshot.file_name, null, rows.length, snapshot.uploaded_by);
      } else if (/^https?:\/\//i.test(active)) {
        // Sheet'in satırları göç sırasında okunamaz (internet gerekir); sunucu açılınca ilk eşitlemede kaydedilir.
        setSetting("dataset.linkedSheetUrl", active);
        setSetting("dataset.needsInitialSync", "1");
        setSetting("dataset.label", "Google Sheets");
        logImport("sheets", "Google Sheets", active, 0, "system");
      }
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
