// Veritabanı şema sürümleme. PRAGMA user_version = uygulanan son göç numarası.
// Kural: göçler mümkün olduğunca EKLEYİCİ olur (sütun/tablo/indeks ekleme, veri normalleştirme). Bir göç mevcut
// kayıtları yeniden anahtarlıyorsa (göç 4) geri dönüş, güncelleme öncesi alınan tam yedeğe dönülerek yapılır:
// güncelleme düzeni yeni sürüm açılamazsa şema sürümü değiştiği için veritabanını kendiliğinden yedekten geri yükler.
import { randomUUID } from "node:crypto";
import { createBackup } from "./backup.mjs";
import { migrateBankGrants } from "./bank/grants.mjs";
import { systemClock } from "./clock.mjs";
import { DEFAULT_ADMIN_PASSWORD } from "./config.mjs";
import { rowHash, rowIdentities } from "./dataset-identity.mjs";
import { parseJson } from "./http.mjs";
import { isFullDate } from "./insight/validators.mjs";
import { verifyPassword } from "./passwords.mjs";
import { unitLabel } from "./units.mjs";

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
  {
    version: 5,
    name: "v2.0.1 kasa, tahsilat düzeltmeleri, dosya belgeleri ve serbest sayfalar",
    up(store) {
      // Yalnızca ekleyici: 2.0.0 bu şemayla da çalışır (yeni tabloyu ve kolonları kullanmaz).
      const columns = new Set(store.all("PRAGMA table_info(payments)").map(column => column.name));
      if (!columns.has("case_title")) store.exec("ALTER TABLE payments ADD COLUMN case_title TEXT NOT NULL DEFAULT ''");
      if (!columns.has("updated_by")) store.exec("ALTER TABLE payments ADD COLUMN updated_by TEXT");
      if (!columns.has("updated_at")) store.exec("ALTER TABLE payments ADD COLUMN updated_at TEXT");
      store.exec(`
        CREATE TABLE IF NOT EXISTS cash_entries (
          id TEXT PRIMARY KEY,
          kind TEXT NOT NULL CHECK (kind IN ('in', 'out')),
          amount REAL NOT NULL,
          date TEXT NOT NULL,
          description TEXT NOT NULL DEFAULT '',
          created_by TEXT NOT NULL,
          created_at TEXT NOT NULL,
          updated_by TEXT,
          updated_at TEXT
        );
        CREATE INDEX IF NOT EXISTS idx_cash_entries_date ON cash_entries(date, created_at);
        CREATE INDEX IF NOT EXISTS idx_payments_date ON payments(date, created_at);
        -- Kayda eklenen belgeler: dosyanın kendisi veri klasöründe (belgeler/), içerik özetiyle saklanır.
        CREATE TABLE IF NOT EXISTS case_documents (
          id TEXT PRIMARY KEY,
          case_key TEXT NOT NULL,
          case_title TEXT NOT NULL DEFAULT '',
          name TEXT NOT NULL,
          kind TEXT NOT NULL,
          mime TEXT NOT NULL,
          size INTEGER NOT NULL,
          sha256 TEXT NOT NULL,
          created_by TEXT NOT NULL,
          created_at TEXT NOT NULL,
          deleted_by TEXT,
          deleted_at TEXT
        );
        CREATE INDEX IF NOT EXISTS idx_case_documents_case ON case_documents(case_key, created_at);
        CREATE INDEX IF NOT EXISTS idx_case_documents_sha ON case_documents(sha256);
        -- Serbest sayfalar: kullanıcının programda kurduğu Excel benzeri sekmeler (veri oturumuna özel).
        CREATE TABLE IF NOT EXISTS free_sheets (
          id TEXT PRIMARY KEY,
          dataset_key TEXT NOT NULL,
          name TEXT NOT NULL,
          position INTEGER NOT NULL,
          columns_json TEXT NOT NULL,
          created_by TEXT NOT NULL,
          created_at TEXT NOT NULL,
          updated_by TEXT,
          updated_at TEXT NOT NULL,
          deleted_by TEXT,
          deleted_at TEXT
        );
        CREATE INDEX IF NOT EXISTS idx_free_sheets_key ON free_sheets(dataset_key, position);
        CREATE TABLE IF NOT EXISTS free_rows (
          id TEXT PRIMARY KEY,
          sheet_id TEXT NOT NULL,
          position INTEGER NOT NULL,
          created_by TEXT NOT NULL,
          created_at TEXT NOT NULL
        );
        CREATE INDEX IF NOT EXISTS idx_free_rows_sheet ON free_rows(sheet_id, position);
        CREATE TABLE IF NOT EXISTS free_cells (
          row_id TEXT NOT NULL,
          col_id TEXT NOT NULL,
          sheet_id TEXT NOT NULL,
          raw TEXT NOT NULL,
          updated_by TEXT NOT NULL,
          updated_at TEXT NOT NULL,
          PRIMARY KEY (row_id, col_id)
        );
        CREATE INDEX IF NOT EXISTS idx_free_cells_sheet ON free_cells(sheet_id);
        CREATE TABLE IF NOT EXISTS free_history (
          id TEXT PRIMARY KEY,
          sheet_id TEXT NOT NULL,
          label TEXT NOT NULL,
          snapshot_json TEXT NOT NULL,
          created_by TEXT NOT NULL,
          created_at TEXT NOT NULL
        );
        CREATE INDEX IF NOT EXISTS idx_free_history_sheet ON free_history(sheet_id, created_at);
      `);
    },
  },
  {
    version: 6,
    name: "v2.0.2 silinenler (geri yükleme)",
    up(store) {
      // Tamamen silinen verinin (tahsilat, kasa hareketi, serbest sayfa satırı/kolonu) geri yüklenebilmesi için silinirken
      // içeriği burada saklanır. Yumuşak silinenler (tablo satırı, belge, serbest sayfa) kendi tablolarından okunur.
      store.exec(`
        CREATE TABLE IF NOT EXISTS trash (
          id TEXT PRIMARY KEY,
          kind TEXT NOT NULL,
          ref TEXT NOT NULL,
          dataset_key TEXT NOT NULL DEFAULT '',
          title TEXT NOT NULL DEFAULT '',
          detail TEXT NOT NULL DEFAULT '',
          payload_json TEXT NOT NULL DEFAULT '{}',
          deleted_by TEXT NOT NULL DEFAULT '',
          deleted_at TEXT NOT NULL,
          restored_by TEXT,
          restored_at TEXT
        );
        CREATE INDEX IF NOT EXISTS idx_trash_open ON trash(restored_at, deleted_at);
      `);
      // 2.0.1'de silinmiş ve hâlâ yerine konmamış tahsilat ve kasa hareketleri değişiklik geçmişinden alınır.
      const events = store.all("SELECT id, type, entity_id, actor_id, payload_json, created_at FROM audit_events WHERE type IN ('case.payment.deleted', 'cash.entry.deleted') ORDER BY created_at");
      const seen = new Set();
      for (const event of events.reverse()) {
        if (seen.has(event.entity_id)) continue;
        seen.add(event.entity_id);
        let payload = {};
        try {
          payload = JSON.parse(event.payload_json) || {};
        } catch {
          continue;
        }
        const amount = Number(payload.amount);
        if (!Number.isFinite(amount) || amount <= 0 || !payload.date) continue;
        if (event.type === "case.payment.deleted") {
          if (store.get("SELECT 1 AS found FROM payments WHERE id = ?", event.entity_id)) continue;
          const data = { id: event.entity_id, caseKey: payload.caseKey || "", caseTitle: payload.caseTitle || "", amount, date: payload.date, note: payload.note || "", createdBy: payload.createdBy || event.actor_id, createdAt: payload.createdAt || event.created_at };
          store.run("INSERT INTO trash (id, kind, ref, title, detail, payload_json, deleted_by, deleted_at) VALUES (?, 'payment', ?, ?, ?, ?, ?, ?)", `trash-${event.id}`, event.entity_id, data.caseTitle || data.caseKey || "Tahsilat", data.note, JSON.stringify(data), event.actor_id, event.created_at);
        } else {
          if (store.get("SELECT 1 AS found FROM cash_entries WHERE id = ?", event.entity_id)) continue;
          if (!["in", "out"].includes(payload.kind)) continue;
          const data = { id: event.entity_id, kind: payload.kind, amount, date: payload.date, description: payload.description || "", createdBy: payload.createdBy || event.actor_id, createdAt: payload.createdAt || event.created_at };
          store.run("INSERT INTO trash (id, kind, ref, title, detail, payload_json, deleted_by, deleted_at) VALUES (?, 'cash', ?, ?, '', ?, ?, ?)", `trash-${event.id}`, event.entity_id, data.description || "Kasa hareketi", JSON.stringify(data), event.actor_id, event.created_at);
        }
      }
    },
  },
  {
    version: 7,
    name: "v2.0.4 taksit modülü",
    up(store) {
      // Yalnızca ekleyici: 2.0.3 bu şemayla da çalışır (yeni tabloları kullanmaz).
      // Gruplar tek tabloda: parent_id boş olan "grup" (ör. servis plakası "42 C 1070", site adı), dolu olan onun
      // "alt grubu" (güzergâh "15 Temmuz", blok "A Blok"). Taksit kartı ikisine de bağlanabilir.
      store.exec(`
        CREATE TABLE IF NOT EXISTS plan_groups (
          id TEXT PRIMARY KEY,
          parent_id TEXT,
          name TEXT NOT NULL,
          position INTEGER NOT NULL DEFAULT 0,
          created_by TEXT NOT NULL,
          created_at TEXT NOT NULL,
          updated_at TEXT NOT NULL
        );
        CREATE INDEX IF NOT EXISTS idx_plan_groups_parent ON plan_groups(parent_id, position);
        CREATE TABLE IF NOT EXISTS plans (
          id TEXT PRIMARY KEY,
          group_id TEXT,
          subgroup_id TEXT,
          name TEXT NOT NULL,
          note TEXT NOT NULL DEFAULT '',
          phone TEXT NOT NULL DEFAULT '',
          total REAL NOT NULL DEFAULT 0,
          status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'closed')),
          created_by TEXT NOT NULL,
          created_at TEXT NOT NULL,
          updated_by TEXT,
          updated_at TEXT NOT NULL,
          deleted_by TEXT,
          deleted_at TEXT
        );
        CREATE INDEX IF NOT EXISTS idx_plans_group ON plans(group_id, subgroup_id);
        CREATE INDEX IF NOT EXISTS idx_plans_deleted ON plans(deleted_at);
        -- Taksitler: vade ve tutar. Ödenen tutar saklanmaz; hareketlerden hesaplanır (tahsilat sil/düzelt bozmaz).
        CREATE TABLE IF NOT EXISTS plan_items (
          id TEXT PRIMARY KEY,
          plan_id TEXT NOT NULL,
          seq INTEGER NOT NULL,
          due_date TEXT NOT NULL,
          amount REAL NOT NULL,
          note TEXT NOT NULL DEFAULT '',
          created_at TEXT NOT NULL,
          updated_at TEXT NOT NULL
        );
        CREATE INDEX IF NOT EXISTS idx_plan_items_plan ON plan_items(plan_id, due_date, seq);
        -- Hareketler: tahsilat (in) ve ödeme/iade (out). item_id doluysa o taksite sayılır, boşsa en eski açık taksite.
        CREATE TABLE IF NOT EXISTS plan_entries (
          id TEXT PRIMARY KEY,
          plan_id TEXT NOT NULL,
          item_id TEXT,
          kind TEXT NOT NULL CHECK (kind IN ('in', 'out')),
          amount REAL NOT NULL,
          date TEXT NOT NULL,
          note TEXT NOT NULL DEFAULT '',
          receipt_no INTEGER,
          created_by TEXT NOT NULL,
          created_at TEXT NOT NULL,
          updated_by TEXT,
          updated_at TEXT
        );
        CREATE INDEX IF NOT EXISTS idx_plan_entries_plan ON plan_entries(plan_id, date, created_at);
        CREATE INDEX IF NOT EXISTS idx_plan_entries_date ON plan_entries(date, created_at);
      `);
    },
  },
  {
    version: 8,
    name: "v2.0.5 taksit kartında sıra no",
    up(store) {
      // Excel'deki "S.N / Sıra No" kolonu kartın sıra numarası olur; listede ilk kolon ve varsayılan sıralama.
      // Yalnızca ekleyici: 2.0.4 bu kolonu okumaz.
      addColumn(store, "plans", "ref_no", "TEXT NOT NULL DEFAULT ''");
      // Var olan kartlara açılış sırasıyla numara verilir (Excel'den yüklenenler dosyadaki sırayla açılmıştır).
      const plans = store.all("SELECT id FROM plans WHERE ref_no = '' ORDER BY created_at, rowid");
      plans.forEach((plan, index) => store.run("UPDATE plans SET ref_no = ? WHERE id = ?", String(index + 1), plan.id));
    },
  },
  {
    version: 9,
    name: "v2.0.6 taksit kartında kayıt tarihi",
    up(store) {
      // Kişinin kaydedildiği gün (Excel'deki "Kayıt tarihi" kolonu ya da programda kartın açıldığı gün). Yalnızca ekleyici.
      addColumn(store, "plans", "registered_on", "TEXT NOT NULL DEFAULT ''");
      store.exec("UPDATE plans SET registered_on = substr(created_at, 1, 10) WHERE registered_on = ''");
    },
  },
  {
    version: 10,
    name: "v2.0.6 kolon adına yazılmış tarihleri geri al",
    up(store) {
      // Detay kartında başlığın yanındaki kalem kolonun ADINI değiştirir; değer sanılıp oraya yazılan tarih ("30.09.2026")
      // başlığı bozar, hücre boş kalır. Böyle adlar asıl adına döner; yöneticiye bir kez gösterilir (ui.columns.fixed),
      // işlem geçmişine yazılır. Yalnızca görünen ad değişir: veri, düzeltmeler ve uyarılar kolonun asıl adıyla çalışır.
      const timestamp = new Date().toISOString();
      const upsert = (key, value) =>
        store.run("INSERT INTO settings (key, value, updated_at, updated_by) VALUES (?, ?, ?, NULL) ON CONFLICT(key) DO UPDATE SET value = excluded.value, updated_at = excluded.updated_at", key, value, timestamp);
      for (const row of store.all("SELECT key, value FROM settings WHERE key = 'ui.columns' OR key LIKE 'ui.columns@%'")) {
        const aliases = parseJson(row.value, {});
        if (!aliases || typeof aliases !== "object" || Array.isArray(aliases)) continue;
        const fixed = Object.entries(aliases).filter(([, alias]) => isFullDate(alias)).map(([column, value]) => ({ column, value, at: timestamp }));
        if (!fixed.length) continue;
        for (const item of fixed) delete aliases[item.column];
        upsert(row.key, JSON.stringify(aliases));
        const noticeKey = `ui.columns.fixed${row.key.slice("ui.columns".length)}`;
        const previous = parseJson(store.get("SELECT value FROM settings WHERE key = ?", noticeKey)?.value, []);
        upsert(noticeKey, JSON.stringify([...(Array.isArray(previous) ? previous : []), ...fixed].slice(-50)));
        for (const item of fixed) {
          store.run(
            "INSERT INTO audit_events (id, type, entity_id, actor_id, actor_name, payload_json, created_at) VALUES (?, 'profile.column', ?, 'system', 'Güncelleme', ?, ?)",
            `event-${randomUUID()}`, item.column, JSON.stringify({ column: item.column, value: "", previous: item.value, reason: "Tarih kolon adı olamaz; asıl adına döndürüldü." }), timestamp,
          );
        }
      }
    },
  },
  {
    version: 11,
    name: "v2.0.6 taksit kartı tablodaki kayda bağlanır",
    up(store) {
      // Kart, bir veri oturumundaki kayda (Excel satırı) bağlanabilir: kişinin kartında taksitler, tahsilat ve kalan görünür,
      // karttan girilen tahsilat taksitten düşer. Yalnızca ekleyici; bağsız kartlar olduğu gibi çalışır.
      addColumn(store, "plans", "case_key", "TEXT NOT NULL DEFAULT ''");
      addColumn(store, "plans", "case_source", "TEXT NOT NULL DEFAULT ''");
      addColumn(store, "plans", "case_title", "TEXT NOT NULL DEFAULT ''");
      store.exec("CREATE INDEX IF NOT EXISTS idx_plans_case ON plans(case_source, case_key)");
    },
  },
  {
    version: 12,
    name: "v2.0.6 cari ve stok modülleri",
    up(store) {
      // Cari (müşteri/tedarikçi) kartı merkezdedir: taksit kartları bir cariye bağlıdır (plans.account_id). Stok, Kasa
      // mantığıyla giriş/çıkış hareketleri tutar; parası Kasa'ya ya da cariye yazılabilir. Yalnızca ekleyici: 2.0.5
      // bu şemayla da açılır (yeni tabloları kullanmaz).
      store.exec(`
        CREATE TABLE IF NOT EXISTS accounts (
          id TEXT PRIMARY KEY,
          ref_no TEXT NOT NULL DEFAULT '',
          type TEXT NOT NULL DEFAULT 'customer' CHECK (type IN ('customer', 'supplier', 'other')),
          name TEXT NOT NULL,
          phone TEXT NOT NULL DEFAULT '',
          email TEXT NOT NULL DEFAULT '',
          address TEXT NOT NULL DEFAULT '',
          registered_on TEXT NOT NULL DEFAULT '',
          group_id TEXT,
          subgroup_id TEXT,
          note TEXT NOT NULL DEFAULT '',
          fields_json TEXT NOT NULL DEFAULT '[]',
          case_key TEXT NOT NULL DEFAULT '',
          case_source TEXT NOT NULL DEFAULT '',
          case_title TEXT NOT NULL DEFAULT '',
          status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'passive')),
          created_by TEXT NOT NULL,
          created_at TEXT NOT NULL,
          updated_by TEXT,
          updated_at TEXT NOT NULL,
          deleted_by TEXT,
          deleted_at TEXT
        );
        CREATE INDEX IF NOT EXISTS idx_accounts_deleted ON accounts(deleted_at);
        CREATE INDEX IF NOT EXISTS idx_accounts_case ON accounts(case_source, case_key);
        CREATE INDEX IF NOT EXISTS idx_accounts_group ON accounts(group_id, subgroup_id);
        -- Binlerce satırlık Excel/Sheets alımında eşleşme aramaları (ad, Cari No, ürün adı/kodu) indeksten okunur.
        CREATE INDEX IF NOT EXISTS idx_accounts_name ON accounts(name COLLATE NOCASE);
        CREATE INDEX IF NOT EXISTS idx_accounts_ref ON accounts(ref_no);
        -- Cari hareketleri: borç (debt), alacak (credit), tahsilat (in → Kasa'ya giriş), ödeme (out → Kasa'dan çıkış).
        -- source = 'stock' olan satır bir stok hareketinden gelir (source_id = stock_moves.id) ve oradan düzeltilir.
        CREATE TABLE IF NOT EXISTS account_entries (
          id TEXT PRIMARY KEY,
          account_id TEXT NOT NULL,
          kind TEXT NOT NULL CHECK (kind IN ('debt', 'credit', 'in', 'out')),
          amount REAL NOT NULL,
          date TEXT NOT NULL,
          note TEXT NOT NULL DEFAULT '',
          receipt_no INTEGER,
          source TEXT NOT NULL DEFAULT '',
          source_id TEXT NOT NULL DEFAULT '',
          created_by TEXT NOT NULL,
          created_at TEXT NOT NULL,
          updated_by TEXT,
          updated_at TEXT
        );
        CREATE INDEX IF NOT EXISTS idx_account_entries_account ON account_entries(account_id, date, created_at);
        CREATE INDEX IF NOT EXISTS idx_account_entries_source ON account_entries(source, source_id);
        CREATE TABLE IF NOT EXISTS stock_items (
          id TEXT PRIMARY KEY,
          code TEXT NOT NULL DEFAULT '',
          name TEXT NOT NULL,
          unit TEXT NOT NULL DEFAULT 'Adet',
          category TEXT NOT NULL DEFAULT '',
          min_qty REAL NOT NULL DEFAULT 0,
          unit_price REAL NOT NULL DEFAULT 0,
          note TEXT NOT NULL DEFAULT '',
          fields_json TEXT NOT NULL DEFAULT '[]',
          created_by TEXT NOT NULL,
          created_at TEXT NOT NULL,
          updated_by TEXT,
          updated_at TEXT NOT NULL,
          deleted_by TEXT,
          deleted_at TEXT
        );
        CREATE INDEX IF NOT EXISTS idx_stock_items_deleted ON stock_items(deleted_at);
        CREATE INDEX IF NOT EXISTS idx_stock_items_name ON stock_items(name COLLATE NOCASE, unit COLLATE NOCASE);
        CREATE INDEX IF NOT EXISTS idx_stock_items_code ON stock_items(code);
        -- Stok hareketleri: giriş (in) / çıkış (out). pay: 'none' (yalnız miktar), 'cash' (Kasa'dan ödendi / Kasa'ya
        -- tahsil edildi), 'account' (cariye yazıldı; account_entries.source_id bu hareketi gösterir).
        CREATE TABLE IF NOT EXISTS stock_moves (
          id TEXT PRIMARY KEY,
          item_id TEXT NOT NULL,
          kind TEXT NOT NULL CHECK (kind IN ('in', 'out')),
          qty REAL NOT NULL,
          unit_price REAL NOT NULL DEFAULT 0,
          amount REAL NOT NULL DEFAULT 0,
          date TEXT NOT NULL,
          note TEXT NOT NULL DEFAULT '',
          pay TEXT NOT NULL DEFAULT 'none' CHECK (pay IN ('none', 'cash', 'account')),
          account_id TEXT NOT NULL DEFAULT '',
          created_by TEXT NOT NULL,
          created_at TEXT NOT NULL,
          updated_by TEXT,
          updated_at TEXT
        );
        CREATE INDEX IF NOT EXISTS idx_stock_moves_item ON stock_moves(item_id, date, created_at);
        CREATE INDEX IF NOT EXISTS idx_stock_moves_date ON stock_moves(date, created_at);
      `);
      addColumn(store, "plans", "account_id", "TEXT NOT NULL DEFAULT ''");
      store.exec("CREATE INDEX IF NOT EXISTS idx_plans_account ON plans(account_id)");
      // Mevcut taksit kartları cariye dönüştürülür. Karışma olmasın diye yalnızca kesin eşleşmeler birleşir: aynı
      // tablodaki kayda bağlı kartlar ya da aynı ad + aynı telefon (en az 7 hane). Diğer her kart kendi carisini alır.
      const digits = value => String(value || "").replace(/\D/g, "");
      const fold = value => String(value || "").toLocaleLowerCase("tr-TR").replace(/\s+/g, " ").trim();
      const plans = store.all(
        "SELECT id, ref_no AS refNo, registered_on AS registeredOn, case_key AS caseKey, case_source AS caseSource, case_title AS caseTitle, group_id AS groupId, subgroup_id AS subgroupId, name, note, phone, created_by AS createdBy, created_at AS createdAt FROM plans WHERE account_id = '' ORDER BY created_at, rowid",
      );
      const byKey = new Map();
      let seq = (store.get("SELECT COUNT(*) AS n FROM accounts")?.n || 0);
      const timestamp = new Date().toISOString();
      for (const plan of plans) {
        const phone = digits(plan.phone);
        const key = plan.caseKey ? `case|${plan.caseSource}|${plan.caseKey}` : phone.length >= 7 ? `phone|${fold(plan.name)}|${phone}` : `plan|${plan.id}`;
        let accountId = byKey.get(key);
        if (!accountId) {
          accountId = `account-${randomUUID()}`;
          seq += 1;
          store.run(
            "INSERT INTO accounts (id, ref_no, type, name, phone, registered_on, group_id, subgroup_id, note, case_key, case_source, case_title, status, created_by, created_at, updated_at) VALUES (?, ?, 'customer', ?, ?, ?, ?, ?, ?, ?, ?, ?, 'active', ?, ?, ?)",
            accountId, String(seq), plan.name, plan.phone || "", plan.registeredOn || String(plan.createdAt || timestamp).slice(0, 10), plan.groupId, plan.subgroupId, plan.note || "", plan.caseKey || "", plan.caseSource || "", plan.caseTitle || "", plan.createdBy || "system", plan.createdAt || timestamp, timestamp,
          );
          byKey.set(key, accountId);
        }
        store.run("UPDATE plans SET account_id = ? WHERE id = ?", accountId, plan.id);
      }
    },
  },
  {
    version: 13,
    name: "v2.0.7 çek/senet portföyü, hizmet kalemi",
    up(store) {
      // Çek ve senet (v2.0.7). direction: 'in' = alınan (müşteriden, portföye girer), 'out' = verilen (kendi çekimiz/senedimiz).
      // Durum: alınan → portfolio (portföyde) → collected (tahsil edildi) | endorsed (ciro edildi) | bounced (karşılıksız);
      //        verilen → pending (ödenecek) → paid (ödendi).
      // Her durum değişikliği cheque_events'e bir satır yazar; satırın defter etkileri (cari hareketi, taksit tahsilatı)
      // aynı işlem bloğunda açılır ve effects_json'da tutulur. "Geri al" son olayın etkilerini birebir geri çevirir.
      // Kasa'ya yalnız tahsil (collect) ve ödeme (pay) olayları düşer; çek alınınca/verilince Kasa değişmez.
      store.exec(`
        CREATE TABLE IF NOT EXISTS cheques (
          id TEXT PRIMARY KEY,
          direction TEXT NOT NULL CHECK (direction IN ('in', 'out')),
          instrument TEXT NOT NULL CHECK (instrument IN ('cheque', 'note')),
          serial_no TEXT NOT NULL DEFAULT '',
          bank TEXT NOT NULL DEFAULT '',
          drawer TEXT NOT NULL DEFAULT '',
          account_id TEXT NOT NULL DEFAULT '',
          plan_id TEXT NOT NULL DEFAULT '',
          amount REAL NOT NULL CHECK (amount > 0),
          issue_date TEXT NOT NULL,
          due_date TEXT NOT NULL,
          status TEXT NOT NULL CHECK (status IN ('portfolio', 'endorsed', 'collected', 'bounced', 'pending', 'paid')),
          status_date TEXT NOT NULL DEFAULT '',
          endorse_account_id TEXT NOT NULL DEFAULT '',
          note TEXT NOT NULL DEFAULT '',
          fields_json TEXT NOT NULL DEFAULT '[]',
          created_by TEXT NOT NULL,
          created_at TEXT NOT NULL,
          updated_by TEXT,
          updated_at TEXT NOT NULL,
          deleted_by TEXT,
          deleted_at TEXT
        );
        -- Vade sorguları (nakit akışı, bugün/7 gün, gecikmiş) ve durum süzgeci indeksten okunur.
        CREATE INDEX IF NOT EXISTS idx_cheques_open ON cheques(deleted_at, status, due_date);
        CREATE INDEX IF NOT EXISTS idx_cheques_due ON cheques(due_date);
        CREATE INDEX IF NOT EXISTS idx_cheques_account ON cheques(account_id);
        CREATE INDEX IF NOT EXISTS idx_cheques_serial ON cheques(serial_no);
        CREATE TABLE IF NOT EXISTS cheque_events (
          id TEXT PRIMARY KEY,
          cheque_id TEXT NOT NULL,
          kind TEXT NOT NULL CHECK (kind IN ('receive', 'issue', 'collect', 'endorse', 'pay', 'bounce')),
          date TEXT NOT NULL,
          amount REAL NOT NULL,
          account_id TEXT NOT NULL DEFAULT '',
          from_status TEXT NOT NULL DEFAULT '',
          to_status TEXT NOT NULL,
          note TEXT NOT NULL DEFAULT '',
          effects_json TEXT NOT NULL DEFAULT '[]',
          created_by TEXT NOT NULL,
          created_at TEXT NOT NULL
        );
        CREATE INDEX IF NOT EXISTS idx_cheque_events_cheque ON cheque_events(cheque_id, created_at);
        CREATE INDEX IF NOT EXISTS idx_cheque_events_kind ON cheque_events(kind, date);
      `);
      // Taksite çekle yapılan tahsilat: kartta tahsilat olarak görünür, Kasa'ya çek tahsil edilince düşer (çift sayılmaz).
      addColumn(store, "plan_entries", "cheque_id", "TEXT NOT NULL DEFAULT ''");
      store.exec("CREATE INDEX IF NOT EXISTS idx_plan_entries_cheque ON plan_entries(cheque_id)");
      // Stok kartı türü: 'product' (stok tutulur) ya da 'service' (hizmet; miktar/kritik seviye izlenmez).
      addColumn(store, "stock_items", "kind", "TEXT NOT NULL DEFAULT 'product'");
      // Kişiye özel ek yetkiler (ör. ANLIK DURUM ve raporlar): yönetici her zaman görür, başkasına tek tek verir.
      addColumn(store, "users", "grants_json", "TEXT NOT NULL DEFAULT '[]'");
    },
  },
  {
    version: 14,
    name: "v2.0.8 tablodan taksit kartına aktarma, açılış bakiyesi",
    up(store) {
      // Yalnız ekleyici: mevcut hiçbir satır değişmez.
      // Açılış (devir) kaydı: Excel'de programa girmeden önce ödenmiş kısım. Taksiti kapatır, carinin bakiyesine sayılır;
      // Kasa'ya girmez (o para bu programın kasasından geçmedi), makbuzu olmaz.
      addColumn(store, "plan_entries", "opening", "INTEGER NOT NULL DEFAULT 0");
      // Kartı açan aktarım (tablodan ya da Excel'den): aktarım geri alınınca yalnız o aktarımın kartları kalkar.
      addColumn(store, "plans", "import_id", "TEXT NOT NULL DEFAULT ''");
      store.exec(`
        CREATE TABLE IF NOT EXISTS plan_imports (
          id TEXT PRIMARY KEY,
          kind TEXT NOT NULL CHECK (kind IN ('table', 'excel')),
          source TEXT NOT NULL DEFAULT '',
          title TEXT NOT NULL DEFAULT '',
          summary_json TEXT NOT NULL DEFAULT '{}',
          undo_json TEXT NOT NULL DEFAULT '{}',
          created_by TEXT NOT NULL,
          created_at TEXT NOT NULL,
          undone_by TEXT,
          undone_at TEXT
        );
        CREATE INDEX IF NOT EXISTS idx_plan_imports_created ON plan_imports(created_at);
        -- Kayda bağlı kartlar: takvim, kişinin kartı ve aktarma "bu kaydın kartı var mı?" diye sorar.
        CREATE INDEX IF NOT EXISTS idx_plans_case ON plans(case_key, case_source);
        CREATE INDEX IF NOT EXISTS idx_plans_import ON plans(import_id);
      `);
    },
  },
  {
    version: 15,
    name: "v2.0.10 özel roller, kişiye özel yetki, kullanıcı silme",
    up(store) {
      // Yalnız ekleyici. users.role sütununun CHECK kısıtı (4 yerleşik rol) tabloyu yeniden kurmamak için korunur:
      // özel rol atanan kullanıcıda role = 'personel' kalır, role_key rolün kimliğini taşır (lib/access.mjs).
      store.exec(`
        CREATE TABLE IF NOT EXISTS roles (
          id TEXT PRIMARY KEY,
          name TEXT NOT NULL,
          description TEXT NOT NULL DEFAULT '',
          permissions_json TEXT NOT NULL DEFAULT '[]',
          created_by TEXT NOT NULL DEFAULT '',
          created_at TEXT NOT NULL,
          updated_at TEXT NOT NULL
        );
      `);
      addColumn(store, "users", "role_key", "TEXT");
      // Kullanıcı silme (geçmiş korunur): satır kalır, giriş kapanır; kullanıcı adı ve görünen ad yeniden kullanılabilsin
      // diye silinen hesapta değiştirilir, asılları geri alma için saklanır.
      addColumn(store, "users", "deleted_at", "TEXT");
      addColumn(store, "users", "deleted_by", "TEXT");
      addColumn(store, "users", "deleted_username", "TEXT");
      addColumn(store, "users", "deleted_name", "TEXT");
      // Kişiye özel yetki: v2.0.7 dizisi ["overview.view"] → { add: [...], remove: [] }. "overview.view" artık yalnız
      // Raporlar penceresini açar; ANLIK DURUM kartı yalnız yöneticide (overview.card).
      for (const user of store.all("SELECT id, grants_json AS grantsJson FROM users")) {
        let value = [];
        try {
          value = JSON.parse(user.grantsJson || "[]");
        } catch {
          value = [];
        }
        if (!Array.isArray(value)) continue;
        store.run("UPDATE users SET grants_json = ? WHERE id = ?", JSON.stringify({ add: value.filter(item => typeof item === "string"), remove: [] }), user.id);
      }
    },
  },
  {
    version: 16,
    name: "v2.0.11 stok birimlerinin tek yazımı",
    up(store) {
      // "adet" / "ADET" / "Adet" aynı birimdir: hepsi "Adet" olur (liste, rapor, PDF ve Excel aynı yazar). Yalnız
      // birim sütunu değişir; ürün, hareket ve tutarlar olduğu gibi kalır.
      if (!store.get("SELECT 1 AS found FROM sqlite_master WHERE type = 'table' AND name = 'stock_items'")) return;
      for (const item of store.all("SELECT id, unit FROM stock_items")) {
        const next = unitLabel(item.unit);
        if (next !== item.unit) store.run("UPDATE stock_items SET unit = ? WHERE id = ?", next, item.id);
      }
    },
  },
  {
    version: 17,
    name: "v2.0.13 mevcut borcu taksitlendirme, satış iadesi, satış fiyatı, WhatsApp gönderim kaydı, mutabakat günlüğü",
    up(store) {
      // Yalnız ekleyici: mevcut hiçbir satır değişmez.
      // Mevcut borcu taksitlendiren kart: carinin borcu zaten yazılı (veresiye satış, açılış, borç yaz); kart yalnız
      // vadeleri tutar, carinin defterine ikinci kez borç yazmaz. Tahsilatları borçtan düşer.
      addColumn(store, "plans", "covers_balance", "INTEGER NOT NULL DEFAULT 0");
      // Kartın kapatıldığı gün: vazgeçilen kalan ana defterde bu tarihte yazılır (dönem kilidiyle uyumlu).
      addColumn(store, "plans", "closed_at", "TEXT");
      // Stok hareketinin nedeni: '' (alım / satış / kullanım) ya da 'return' (müşteri iadesi: satıştan dönen mal).
      addColumn(store, "stock_moves", "reason", "TEXT NOT NULL DEFAULT ''");
      // Ürünün satış fiyatı (birim fiyat = alış/maliyet). Çıkış formu satış fiyatıyla açılır; brüt kâr hesaplanır.
      addColumn(store, "stock_items", "sale_price", "REAL NOT NULL DEFAULT 0");
      // Ödeme / tahsilat yolu: nakit (Kasa), bank (havale/EFT), card (kredi kartı). Eski hareketler nakit sayılır.
      for (const table of ["payments", "cash_entries", "account_entries", "plan_entries", "stock_moves", "cheque_events"]) {
        if (store.get("SELECT 1 AS found FROM sqlite_master WHERE type = 'table' AND name = ?", table)) addColumn(store, table, "method", "TEXT NOT NULL DEFAULT 'cash'");
      }
      // WhatsApp gönderim kaydı: tek ya da toplu ekstre/mesaj; kime, ne zaman, kimin gönderdiği (cari kartında görünür).
      store.exec(`
        CREATE TABLE IF NOT EXISTS message_sends (
          id TEXT PRIMARY KEY,
          batch_id TEXT NOT NULL,
          account_id TEXT NOT NULL,
          kind TEXT NOT NULL CHECK (kind IN ('statement', 'message')),
          phone TEXT NOT NULL DEFAULT '',
          body TEXT NOT NULL DEFAULT '',
          status TEXT NOT NULL DEFAULT 'sent' CHECK (status IN ('sent', 'skipped')),
          created_by TEXT NOT NULL,
          created_at TEXT NOT NULL
        );
        CREATE INDEX IF NOT EXISTS idx_message_sends_account ON message_sends(account_id, created_at);
        CREATE INDEX IF NOT EXISTS idx_message_sends_batch ON message_sends(batch_id);
        -- Mutabakat günlüğü: alt defter ile ana defter arasında sapma yaratacağı için geri alınan (ROLLBACK) işlemler
        -- ve açılışta bulunan eski sapmalar. Kayıt silinmez; yönetici Raporlar > Ana Defter'den görür.
        CREATE TABLE IF NOT EXISTS integrity_log (
          id TEXT PRIMARY KEY,
          at TEXT NOT NULL,
          action TEXT NOT NULL CHECK (action IN ('rolled-back', 'baseline')),
          tables TEXT NOT NULL DEFAULT '',
          summary TEXT NOT NULL DEFAULT '',
          detail_json TEXT NOT NULL DEFAULT '[]'
        );
        CREATE INDEX IF NOT EXISTS idx_integrity_log_at ON integrity_log(at);
      `);
    },
  },
  {
    version: 18,
    name: "v2.0.15 fatura modülü (satış, alış, iadeler; e-Fatura / e-Arşiv / UBL-TR), carinin vergi kimliği ve adresi",
    up(store) {
      // Yalnız ekleyici: mevcut hiçbir satır değişmez; eski sürüm aynı veritabanıyla açılır (yeni tabloları okumaz).
      // Carinin fatura kimliği (UBL-TR Party): VKN (10) / TCKN (11), vergi dairesi, MERSİS, ticaret sicil no, tüzel/gerçek
      // kişi, gerçek kişide ad ve soyad (e-Belgede ayrı yazılır), adres (il, ilçe, posta kodu, ülke), web sitesi, IBAN,
      // varsayılan vade günü; GİB e-Fatura mükellefi mi (e-Fatura mı e-Arşiv mi kesileceğini belirler), posta kutusu
      // etiketi ve senaryosu (Temel / Ticari).
      for (const [column, definition] of [
        ["tax_no", "TEXT NOT NULL DEFAULT ''"],
        ["tax_office", "TEXT NOT NULL DEFAULT ''"],
        ["mersis_no", "TEXT NOT NULL DEFAULT ''"],
        ["trade_registry", "TEXT NOT NULL DEFAULT ''"],
        ["party_kind", "TEXT NOT NULL DEFAULT ''"],
        ["first_name", "TEXT NOT NULL DEFAULT ''"],
        ["family_name", "TEXT NOT NULL DEFAULT ''"],
        ["city", "TEXT NOT NULL DEFAULT ''"],
        ["district", "TEXT NOT NULL DEFAULT ''"],
        ["postal_code", "TEXT NOT NULL DEFAULT ''"],
        ["country", "TEXT NOT NULL DEFAULT ''"],
        ["website", "TEXT NOT NULL DEFAULT ''"],
        ["iban", "TEXT NOT NULL DEFAULT ''"],
        ["due_days", "INTEGER NOT NULL DEFAULT 0"],
        ["e_invoice", "INTEGER NOT NULL DEFAULT 0"],
        ["e_alias", "TEXT NOT NULL DEFAULT ''"],
        ["e_profile", "TEXT NOT NULL DEFAULT ''"],
      ]) addColumn(store, "accounts", column, definition);
      store.exec("CREATE INDEX IF NOT EXISTS idx_accounts_tax_no ON accounts(tax_no) WHERE tax_no <> ''");
      // Faturadan doğan alt defter satırları faturaya bağlıdır (iptal ve mutabakat bu bağla yapılır). Çek cirosu da bir
      // olaydır: faturayla ciro edilen çekin olayı faturaya bağlanır (iptalde yalnız o olay geri alınır).
      addColumn(store, "stock_moves", "invoice_id", "TEXT NOT NULL DEFAULT ''");
      addColumn(store, "cheques", "invoice_id", "TEXT NOT NULL DEFAULT ''");
      addColumn(store, "cheque_events", "invoice_id", "TEXT NOT NULL DEFAULT ''");
      addColumn(store, "plans", "invoice_id", "TEXT NOT NULL DEFAULT ''");
      store.exec(`
        -- Fatura başlığı. Tutarlar belgenin para biriminde kalemlerin toplamıdır (kuruşa yuvarlanmış); try_* deftere
        -- (cari, Kasa, Ana Defter) yazılan TL karşılıklarıdır. Mutabakat kapısı her işlemde başlık = kalemler ve
        -- defter = try_* eşitliğini denetler. party_json / seller_json: kesildiği andaki alıcı ve satıcı bilgisi (yasal
        -- belge sonradan cari kartı değişse de değişmez; e-Belge ve PDF bu bilgiden üretilir).
        -- Durum: draft (taslak / proforma: deftere dokunmaz, numarası yoktur), issued (kesildi), cancelled (iptal: numara
        -- korunur, defter etkileri geri alınmıştır).
        CREATE TABLE IF NOT EXISTS invoices (
          id TEXT PRIMARY KEY,
          kind TEXT NOT NULL CHECK (kind IN ('sale', 'purchase', 'sale_return', 'purchase_return', 'smm')),
          scenario TEXT NOT NULL DEFAULT '',
          status TEXT NOT NULL DEFAULT 'issued' CHECK (status IN ('draft', 'issued', 'cancelled')),
          series TEXT NOT NULL DEFAULT '',
          year INTEGER NOT NULL DEFAULT 0,
          seq INTEGER NOT NULL DEFAULT 0,
          number TEXT NOT NULL DEFAULT '',
          ettn TEXT NOT NULL,
          issue_date TEXT NOT NULL,
          issue_time TEXT NOT NULL DEFAULT '',
          account_id TEXT NOT NULL,
          party_json TEXT NOT NULL DEFAULT '{}',
          seller_json TEXT NOT NULL DEFAULT '{}',
          profile TEXT NOT NULL DEFAULT 'KAGIT' CHECK (profile IN ('KAGIT', 'TEMELFATURA', 'TICARIFATURA', 'EARSIVFATURA', 'ESMM')),
          type_code TEXT NOT NULL DEFAULT 'SATIS',
          currency TEXT NOT NULL DEFAULT 'TRY',
          rate REAL NOT NULL DEFAULT 1,
          prices_include_vat INTEGER NOT NULL DEFAULT 0,
          discount_rate REAL NOT NULL DEFAULT 0,
          stoppage_rate REAL NOT NULL DEFAULT 0,
          base_total REAL NOT NULL DEFAULT 0,
          discount_total REAL NOT NULL DEFAULT 0,
          net_total REAL NOT NULL DEFAULT 0,
          goods_net REAL NOT NULL DEFAULT 0,
          service_net REAL NOT NULL DEFAULT 0,
          vat_total REAL NOT NULL DEFAULT 0,
          withheld_total REAL NOT NULL DEFAULT 0,
          stoppage_total REAL NOT NULL DEFAULT 0,
          gross_total REAL NOT NULL DEFAULT 0,
          payable_total REAL NOT NULL DEFAULT 0,
          try_net REAL NOT NULL DEFAULT 0,
          try_vat REAL NOT NULL DEFAULT 0,
          try_withheld REAL NOT NULL DEFAULT 0,
          try_stoppage REAL NOT NULL DEFAULT 0,
          try_payable REAL NOT NULL DEFAULT 0,
          gl_json TEXT NOT NULL DEFAULT '[]',
          payment_json TEXT NOT NULL DEFAULT '{}',
          due_date TEXT NOT NULL DEFAULT '',
          plan_id TEXT NOT NULL DEFAULT '',
          original_id TEXT NOT NULL DEFAULT '',
          order_no TEXT NOT NULL DEFAULT '',
          order_date TEXT NOT NULL DEFAULT '',
          despatch_no TEXT NOT NULL DEFAULT '',
          despatch_date TEXT NOT NULL DEFAULT '',
          paper_no TEXT NOT NULL DEFAULT '',
          note TEXT NOT NULL DEFAULT '',
          e_status TEXT NOT NULL DEFAULT 'none',
          -- Sonra gönderilecek (waiting) ya da listeden silinen (withdrawn) belgenin gönderileceği e-Belge türü.
          e_profile TEXT NOT NULL DEFAULT '',
          e_adapter TEXT NOT NULL DEFAULT '',
          e_message TEXT NOT NULL DEFAULT '',
          e_at TEXT NOT NULL DEFAULT '',
          created_by TEXT NOT NULL,
          created_at TEXT NOT NULL,
          updated_by TEXT,
          updated_at TEXT NOT NULL,
          issued_by TEXT,
          issued_at TEXT,
          cancelled_by TEXT,
          cancelled_at TEXT,
          cancel_reason TEXT NOT NULL DEFAULT ''
        );
        CREATE INDEX IF NOT EXISTS idx_invoices_date ON invoices(issue_date, issue_time);
        CREATE INDEX IF NOT EXISTS idx_invoices_account ON invoices(account_id, issue_date);
        CREATE INDEX IF NOT EXISTS idx_invoices_original ON invoices(original_id);
        CREATE INDEX IF NOT EXISTS idx_invoices_status ON invoices(status, kind);
        CREATE UNIQUE INDEX IF NOT EXISTS idx_invoices_ettn ON invoices(ettn);
        -- Kendi verdiğimiz numara seri + yıl + sıra ile tektir (GİB: 3 karakter seri + 4 hane yıl + 9 hane sıra = 16);
        -- karşı tarafın belgesi (alış faturası, müşterinin kestiği iade faturası) aynı caride iki kez girilemez.
        CREATE UNIQUE INDEX IF NOT EXISTS idx_invoices_own_no ON invoices(series, year, seq) WHERE seq > 0;
        CREATE UNIQUE INDEX IF NOT EXISTS idx_invoices_party_no ON invoices(account_id, kind, number) WHERE seq = 0 AND status = 'issued' AND number <> '';
        -- Kalem. Tutarlar belgenin para biriminde (kuruşa yuvarlanmış). gl_account: kalemin ana defter hesabı (600 satış,
        -- 610 iade, 153 ticari mal, 770/760 gider, 255 demirbaş); expense_code: gider türü (alışta stoksuz kalem).
        -- origin_line_id: iade kaleminin asıl faturadaki kalemi (iade edilebilir miktar bununla sınırlanır).
        CREATE TABLE IF NOT EXISTS invoice_lines (
          id TEXT PRIMARY KEY,
          invoice_id TEXT NOT NULL,
          seq INTEGER NOT NULL,
          item_id TEXT NOT NULL DEFAULT '',
          goods INTEGER NOT NULL DEFAULT 0,
          code TEXT NOT NULL DEFAULT '',
          name TEXT NOT NULL,
          description TEXT NOT NULL DEFAULT '',
          unit TEXT NOT NULL DEFAULT 'Adet',
          qty REAL NOT NULL CHECK (qty > 0),
          unit_price REAL NOT NULL DEFAULT 0,
          discount_rate REAL NOT NULL DEFAULT 0,
          base REAL NOT NULL DEFAULT 0,
          discount REAL NOT NULL DEFAULT 0,
          net REAL NOT NULL DEFAULT 0,
          vat_rate REAL NOT NULL DEFAULT 0,
          vat REAL NOT NULL DEFAULT 0,
          withholding_code TEXT NOT NULL DEFAULT '',
          withholding_num INTEGER NOT NULL DEFAULT 0,
          withholding_den INTEGER NOT NULL DEFAULT 0,
          withheld REAL NOT NULL DEFAULT 0,
          exemption_code TEXT NOT NULL DEFAULT '',
          gross REAL NOT NULL DEFAULT 0,
          payable REAL NOT NULL DEFAULT 0,
          gl_account TEXT NOT NULL DEFAULT '600',
          expense_code TEXT NOT NULL DEFAULT '',
          unit_cost REAL NOT NULL DEFAULT 0,
          origin_line_id TEXT NOT NULL DEFAULT '',
          move_id TEXT NOT NULL DEFAULT ''
        );
        CREATE INDEX IF NOT EXISTS idx_invoice_lines_invoice ON invoice_lines(invoice_id, seq);
        CREATE INDEX IF NOT EXISTS idx_invoice_lines_item ON invoice_lines(item_id);
        CREATE INDEX IF NOT EXISTS idx_invoice_lines_origin ON invoice_lines(origin_line_id);
        CREATE INDEX IF NOT EXISTS idx_stock_moves_invoice ON stock_moves(invoice_id);
        -- Entegratörden gelen e-Faturalar (bize kesilenler). Alış faturası olarak alınınca invoice_id bağlanır; tek
        -- belge iki kez alınamaz (uuid tekil). e-Belge bağlantısı kapalıyken tablo boş kalır.
        CREATE TABLE IF NOT EXISTS einvoice_inbox (
          id TEXT PRIMARY KEY,
          uuid TEXT NOT NULL,
          number TEXT NOT NULL DEFAULT '',
          sender_vkn TEXT NOT NULL DEFAULT '',
          sender_name TEXT NOT NULL DEFAULT '',
          issue_date TEXT NOT NULL DEFAULT '',
          payable REAL NOT NULL DEFAULT 0,
          currency TEXT NOT NULL DEFAULT 'TRY',
          profile TEXT NOT NULL DEFAULT '',
          type_code TEXT NOT NULL DEFAULT '',
          status TEXT NOT NULL DEFAULT '',
          xml TEXT NOT NULL DEFAULT '',
          state TEXT NOT NULL DEFAULT 'new' CHECK (state IN ('new', 'imported', 'ignored')),
          invoice_id TEXT NOT NULL DEFAULT '',
          fetched_by TEXT,
          fetched_at TEXT NOT NULL,
          updated_at TEXT
        );
        CREATE UNIQUE INDEX IF NOT EXISTS idx_einvoice_inbox_uuid ON einvoice_inbox(uuid);
        CREATE INDEX IF NOT EXISTS idx_cheques_invoice ON cheques(invoice_id);
        CREATE INDEX IF NOT EXISTS idx_plans_invoice ON plans(invoice_id);
        CREATE INDEX IF NOT EXISTS idx_cheque_events_invoice ON cheque_events(invoice_id);
        -- Tekrarlayan fatura (abonelik, kira, aidat): şablon faturadan her N ayda bir TASLAK hazırlanır; kullanıcı
        -- kontrol edip keser (kendiliğinden deftere yazılmaz).
        CREATE TABLE IF NOT EXISTS invoice_repeats (
          id TEXT PRIMARY KEY,
          template_id TEXT NOT NULL,
          every_months INTEGER NOT NULL DEFAULT 1 CHECK (every_months BETWEEN 1 AND 12),
          next_date TEXT NOT NULL,
          until_date TEXT NOT NULL DEFAULT '',
          active INTEGER NOT NULL DEFAULT 1,
          made INTEGER NOT NULL DEFAULT 0,
          last_invoice_id TEXT NOT NULL DEFAULT '',
          created_by TEXT NOT NULL,
          created_at TEXT NOT NULL,
          updated_at TEXT
        );
        CREATE INDEX IF NOT EXISTS idx_invoice_repeats_template ON invoice_repeats(template_id);
      `);
    },
  },
  {
    version: 19,
    name: "v2.0.17 Kasa ↔ Banka transferi; fatura kapama bağı ve mahsup fişi",
    up(store) {
      // Yalnız ekleyici. Transfer: nakit tarafı (method = cash) ve banka tarafı (method = bank) aynı transfer_id'yi
      // taşır; biri düzeltilince/silinince öbürü de. Eski sürüm sütunu görmezden gelir.
      addColumn(store, "cash_entries", "transfer_id", "TEXT NOT NULL DEFAULT ''");
      store.exec("CREATE INDEX IF NOT EXISTS idx_cash_entries_transfer ON cash_entries(transfer_id)");
      // Cari kartından girilen tahsilat/ödeme "Kapatılacak Fatura" ile bağlanabilir (boş = otomatik, en eski açık fatura).
      addColumn(store, "account_entries", "invoice_id", "TEXT NOT NULL DEFAULT ''");
      store.exec("CREATE INDEX IF NOT EXISTS idx_account_entries_invoice ON account_entries(invoice_id)");
      // Mahsup fişi: bir faturayı aynı carinin karşı yöndeki faturasıyla ya da cari satırıyla (Alacak/Borç Yaz, açılış)
      // kapatır. Cari bakiyesini değiştirmez (bakiye zaten net); yalnız fatura kapamasını belirler.
      store.exec(`
        CREATE TABLE IF NOT EXISTS invoice_offsets (
          id TEXT PRIMARY KEY,
          account_id TEXT NOT NULL,
          invoice_id TEXT NOT NULL,
          counter_type TEXT NOT NULL CHECK (counter_type IN ('invoice', 'entry')),
          counter_id TEXT NOT NULL,
          amount REAL NOT NULL,
          date TEXT NOT NULL,
          note TEXT NOT NULL DEFAULT '',
          created_by TEXT NOT NULL,
          created_at TEXT NOT NULL
        );
        CREATE INDEX IF NOT EXISTS idx_invoice_offsets_account ON invoice_offsets(account_id);
        CREATE INDEX IF NOT EXISTS idx_invoice_offsets_invoice ON invoice_offsets(invoice_id);
        CREATE INDEX IF NOT EXISTS idx_invoice_offsets_counter ON invoice_offsets(counter_id);
      `);
    },
  },
  {
    version: 20,
    name: "v2.1.0 banka ve POS çekirdeği: işlem başlığı (İşlem No), banka fişi, hesap ve POS kartları, ekstre, kur, tatil, kalıcı istek kimliği; para satırlarına hesap ve işlem bağı; banka yetki göçü",
    up(store, { company = null, now = systemClock } = {}) {
      // docs/BANKA-MODULU-PLAN.md §5.2–§5.4, §9.1, §10.2. YALNIZ EKLEYİCİ (K11): hiçbir mevcut satır değişmez (yeni kolonların
      // varsayılanı boş/sıfır; eski satırlar "Hesabı Atanmamış" kovasında kalır). İzinli tek değişiklikler: meta.schema.v20At damgası
      // ve ortak katmanda (001) özel rollere/kişilere banka yetkisi EKLENMESİ. Eski sürüm (2.0.26) aynı dosyayı açar: yeni tabloları
      // ve kolonları okumaz (§10.6'daki açılış onarımı bunu ayrıca ele alır).
      store.raw("migration.v20", () => {
        store.exec(BANK_SCHEMA_V20);
        for (const table of ["payments", "cash_entries", "account_entries", "plan_entries", "stock_moves", "cheque_events"]) {
          if (!store.get("SELECT 1 AS found FROM sqlite_master WHERE type = 'table' AND name = ?", table)) continue;
          // fin_ref: banka hesabı / POS / kurumsal kart kimliği ('' = Hesabı Atanmamış); event_id: İşlem No'lu işlem başlığı.
          addColumn(store, table, "fin_ref", "TEXT NOT NULL DEFAULT ''");
          addColumn(store, table, "event_id", "TEXT NOT NULL DEFAULT ''");
          store.exec(`CREATE INDEX IF NOT EXISTS idx_${table}_fin_ref ON ${table}(fin_ref, date) WHERE fin_ref <> ''`);
          store.exec(`CREATE INDEX IF NOT EXISTS idx_${table}_event_id ON ${table}(event_id) WHERE event_id <> ''`);
        }
        // Döviz hesabına cari tahsilatı/ödemesi (13b): satırın döviz tutarı (sent), kuru (×10^6) ve kurun kaynağı. Tablo STRICT
        // değil; fx_minor'ın tamsayı olduğunu kapı (bank:refs) denetler.
        if (store.get("SELECT 1 AS found FROM sqlite_master WHERE type = 'table' AND name = 'account_entries'")) {
          addColumn(store, "account_entries", "fx_currency", "TEXT NOT NULL DEFAULT ''");
          addColumn(store, "account_entries", "fx_minor", "INTEGER NOT NULL DEFAULT 0");
          addColumn(store, "account_entries", "fx_rate_e6", "INTEGER NOT NULL DEFAULT 0");
          addColumn(store, "account_entries", "fx_source", "TEXT NOT NULL DEFAULT ''");
        }
        // Fatura kurunun kaynağı (TCMB / elle); boş = eski fatura.
        if (store.get("SELECT 1 AS found FROM sqlite_master WHERE type = 'table' AND name = 'invoices'")) addColumn(store, "invoices", "rate_source", "TEXT NOT NULL DEFAULT ''");
        // Yetki göçü yalnız ortak katmanda (001): şirketlerin kullanıcı tablosu ortak katmandan aynalanır. Şirketi bilinmeyen çağrı
        // (yedeğin geri yüklenmesi) ortak katman sayılır; şirket kopyasında da çalışsa zararsızdır (aynalama üstüne yazar).
        if (!company || company.id === "sirket-001") migrateBankGrants(store);
        if (!store.get("SELECT 1 AS found FROM settings WHERE key = 'meta.schema.v20At'")) {
          const at = now().toISOString();
          store.run("INSERT INTO settings (key, value, updated_at) VALUES ('meta.schema.v20At', ?, ?)", at, at);
        }
      });
    },
  },
];

// v20 (§5.2): hepsi STRICT (tutar INTEGER kuruş, oran INTEGER ppm, kur INTEGER ×10^6; kesirli ya da metin tutar yazılamaz);
// yabancı anahtar yok (bağlar mutabakat kapısında denetlenir); tür ve durum kolonlarında CHECK yok, CHECK yalnız değişmeyecek
// kurallarda (işaret, yön/taraf, kart son 4 hanesi, rol); tekil indeksler yalnız ETKİN satıra uygulanır (iptal/silinmiş satırda
// aynı değer serbest). Zaman kolonları: created_by, created_at, updated_by, updated_at.
const BANK_SCHEMA_V20 = `
  -- İşlem başlığı + kapının doğruladığı salt okuma kopyası (para kaynağı DEĞİL; sayfalama ve süzgeç dizini). İşlem No: BNK-yıl-sıra.
  CREATE TABLE IF NOT EXISTS fin_events (
    id TEXT PRIMARY KEY, year INTEGER NOT NULL, seq INTEGER NOT NULL, no TEXT NOT NULL,
    type TEXT NOT NULL,
    date TEXT NOT NULL, value_date TEXT NOT NULL DEFAULT '',
    status TEXT NOT NULL DEFAULT 'active',
    reversal_of TEXT NOT NULL DEFAULT '', reversed_by TEXT NOT NULL DEFAULT '',
    origin TEXT NOT NULL DEFAULT 'manual',
    origin_key TEXT NOT NULL DEFAULT '', channel TEXT NOT NULL DEFAULT '',
    src_table TEXT NOT NULL DEFAULT '', src_id TEXT NOT NULL DEFAULT '',
    bank_ref TEXT NOT NULL DEFAULT '', counter_ref TEXT NOT NULL DEFAULT '', pos_id TEXT NOT NULL DEFAULT '',
    direction TEXT NOT NULL DEFAULT '',
    amount_minor INTEGER NOT NULL DEFAULT 0 CHECK (amount_minor >= 0),
    try_minor INTEGER NOT NULL DEFAULT 0 CHECK (try_minor >= 0), currency TEXT NOT NULL DEFAULT 'TRY',
    method TEXT NOT NULL DEFAULT '', party_id TEXT NOT NULL DEFAULT '',
    invoice_id TEXT NOT NULL DEFAULT '', plan_id TEXT NOT NULL DEFAULT '', cheque_id TEXT NOT NULL DEFAULT '',
    description TEXT NOT NULL DEFAULT '', reference TEXT NOT NULL DEFAULT '', external_id TEXT NOT NULL DEFAULT '',
    counter_name TEXT NOT NULL DEFAULT '', counter_iban TEXT NOT NULL DEFAULT '', request_key TEXT NOT NULL DEFAULT '',
    created_by TEXT NOT NULL, created_at TEXT NOT NULL, updated_by TEXT, updated_at TEXT
  ) STRICT;
  CREATE UNIQUE INDEX IF NOT EXISTS idx_fin_events_year_seq ON fin_events(year, seq);
  CREATE UNIQUE INDEX IF NOT EXISTS idx_fin_events_no ON fin_events(no);
  CREATE UNIQUE INDEX IF NOT EXISTS idx_fin_events_origin_key ON fin_events(origin_key) WHERE origin_key <> '' AND status = 'active';
  CREATE INDEX IF NOT EXISTS idx_fin_events_bank ON fin_events(bank_ref, date, id);
  CREATE INDEX IF NOT EXISTS idx_fin_events_counter ON fin_events(counter_ref, date, id) WHERE counter_ref <> '';
  CREATE INDEX IF NOT EXISTS idx_fin_events_party ON fin_events(party_id, date);
  CREATE INDEX IF NOT EXISTS idx_fin_events_status ON fin_events(status, date);
  CREATE INDEX IF NOT EXISTS idx_fin_events_pos ON fin_events(pos_id, date) WHERE pos_id <> '';
  CREATE INDEX IF NOT EXISTS idx_fin_events_invoice ON fin_events(invoice_id) WHERE invoice_id <> '';
  CREATE INDEX IF NOT EXISTS idx_fin_events_plan ON fin_events(plan_id) WHERE plan_id <> '';
  CREATE INDEX IF NOT EXISTS idx_fin_events_cheque ON fin_events(cheque_id) WHERE cheque_id <> '';
  CREATE INDEX IF NOT EXISTS idx_fin_events_src ON fin_events(src_table, src_id);
  CREATE INDEX IF NOT EXISTS idx_fin_events_type ON fin_events(type, date);

  -- Banka Fişi satırı; THP kodu yazım anında çözülür ve saklanır.
  CREATE TABLE IF NOT EXISTS bank_lines (
    id TEXT PRIMARY KEY, event_id TEXT NOT NULL, seq INTEGER NOT NULL,
    role TEXT NOT NULL,
    gl TEXT NOT NULL, sub TEXT NOT NULL DEFAULT '', ref TEXT NOT NULL DEFAULT '',
    side TEXT NOT NULL CHECK (side IN ('D', 'C')), try_minor INTEGER NOT NULL CHECK (try_minor > 0),
    currency TEXT NOT NULL DEFAULT 'TRY', fx_minor INTEGER NOT NULL DEFAULT 0 CHECK (fx_minor >= 0),
    rate_e6 INTEGER NOT NULL DEFAULT 1000000 CHECK (rate_e6 > 0), rate_source TEXT NOT NULL DEFAULT '',
    memo TEXT NOT NULL DEFAULT ''
  ) STRICT;
  CREATE INDEX IF NOT EXISTS idx_bank_lines_event ON bank_lines(event_id);
  CREATE INDEX IF NOT EXISTS idx_bank_lines_ref ON bank_lines(ref, event_id);
  CREATE INDEX IF NOT EXISTS idx_bank_lines_gl ON bank_lines(gl, sub);

  CREATE TABLE IF NOT EXISTS bank_accounts (
    id TEXT PRIMARY KEY, code TEXT NOT NULL, gl TEXT NOT NULL, gl_sub TEXT NOT NULL,
    kind TEXT NOT NULL, bank_name TEXT NOT NULL, name TEXT NOT NULL, currency TEXT NOT NULL DEFAULT 'TRY',
    iban TEXT NOT NULL DEFAULT '', account_no TEXT NOT NULL DEFAULT '', branch_name TEXT NOT NULL DEFAULT '',
    branch_code TEXT NOT NULL DEFAULT '', swift TEXT NOT NULL DEFAULT '', holder TEXT NOT NULL DEFAULT '',
    description TEXT NOT NULL DEFAULT '', opening_date TEXT NOT NULL,
    balance_confirmed INTEGER NOT NULL DEFAULT 0 CHECK (balance_confirmed IN (0, 1)),
    credit_limit_minor INTEGER NOT NULL DEFAULT 0 CHECK (credit_limit_minor >= 0),
    negative_policy TEXT NOT NULL DEFAULT '', statement_day INTEGER NOT NULL DEFAULT 0, due_day INTEGER NOT NULL DEFAULT 0,
    show_on_invoice INTEGER NOT NULL DEFAULT 0, statement_template_json TEXT NOT NULL DEFAULT '{}',
    integration TEXT NOT NULL DEFAULT 'manual', status TEXT NOT NULL DEFAULT 'active', position INTEGER NOT NULL DEFAULT 0,
    created_by TEXT NOT NULL, created_at TEXT NOT NULL, updated_by TEXT, updated_at TEXT, deleted_by TEXT, deleted_at TEXT
  ) STRICT;
  CREATE UNIQUE INDEX IF NOT EXISTS idx_bank_accounts_gl_sub ON bank_accounts(gl_sub);
  CREATE UNIQUE INDEX IF NOT EXISTS idx_bank_accounts_code ON bank_accounts(code) WHERE deleted_at IS NULL;
  CREATE UNIQUE INDEX IF NOT EXISTS idx_bank_accounts_iban ON bank_accounts(iban) WHERE iban <> '' AND deleted_at IS NULL;

  CREATE TABLE IF NOT EXISTS pos_terminals (
    id TEXT PRIMARY KEY, code TEXT NOT NULL, gl_sub TEXT NOT NULL, name TEXT NOT NULL, bank_name TEXT NOT NULL DEFAULT '',
    bank_account_id TEXT NOT NULL, kind TEXT NOT NULL, provider_kind TEXT NOT NULL DEFAULT 'bank',
    merchant_no TEXT NOT NULL DEFAULT '', terminal_no TEXT NOT NULL DEFAULT '', currency TEXT NOT NULL DEFAULT 'TRY',
    valor_rule TEXT NOT NULL DEFAULT 'business', valor_days INTEGER NOT NULL DEFAULT 1,
    provision_days INTEGER NOT NULL DEFAULT 0, block_days INTEGER NOT NULL DEFAULT 0, installment_payout TEXT NOT NULL DEFAULT 'monthly',
    tax_kind TEXT NOT NULL DEFAULT 'bsmv', tax_mode TEXT NOT NULL DEFAULT 'included', tax_ppm INTEGER NOT NULL DEFAULT 50000,
    provider_account_id TEXT NOT NULL DEFAULT '', refund_commission TEXT NOT NULL DEFAULT 'none',
    settle_mode TEXT NOT NULL DEFAULT 'inherit', fixed_fee_minor INTEGER NOT NULL DEFAULT 0 CHECK (fixed_fee_minor >= 0),
    integration TEXT NOT NULL DEFAULT 'manual', status TEXT NOT NULL DEFAULT 'active', description TEXT NOT NULL DEFAULT '',
    created_by TEXT NOT NULL, created_at TEXT NOT NULL, updated_by TEXT, updated_at TEXT, deleted_by TEXT, deleted_at TEXT
  ) STRICT;
  CREATE UNIQUE INDEX IF NOT EXISTS idx_pos_terminals_gl_sub ON pos_terminals(gl_sub);

  CREATE TABLE IF NOT EXISTS pos_rates (
    id TEXT PRIMARY KEY, pos_id TEXT NOT NULL,
    installments INTEGER NOT NULL CHECK (installments BETWEEN 1 AND 36),
    rate_ppm INTEGER NOT NULL CHECK (rate_ppm BETWEEN 0 AND 1000000), valor_days INTEGER, valid_from TEXT NOT NULL,
    created_by TEXT NOT NULL, created_at TEXT NOT NULL
  ) STRICT;
  CREATE UNIQUE INDEX IF NOT EXISTS idx_pos_rates_key ON pos_rates(pos_id, installments, valid_from);

  CREATE TABLE IF NOT EXISTS pos_sales (
    id TEXT PRIMARY KEY, event_id TEXT NOT NULL, pos_id TEXT NOT NULL, kind TEXT NOT NULL,
    src TEXT NOT NULL DEFAULT 'module',
    origin_id TEXT NOT NULL DEFAULT '',
    date TEXT NOT NULL, installments INTEGER NOT NULL DEFAULT 1, rate_ppm INTEGER NOT NULL, tax_kind TEXT NOT NULL,
    tax_mode TEXT NOT NULL, tax_ppm INTEGER NOT NULL, fixed_minor INTEGER NOT NULL DEFAULT 0, refund_commission TEXT NOT NULL,
    payout TEXT NOT NULL, block_days INTEGER NOT NULL DEFAULT 0,
    bank_account_id TEXT NOT NULL, provider_account_id TEXT NOT NULL DEFAULT '',
    gross_minor INTEGER NOT NULL CHECK (gross_minor > 0), commission_minor INTEGER NOT NULL DEFAULT 0 CHECK (commission_minor >= 0),
    tax_minor INTEGER NOT NULL DEFAULT 0 CHECK (tax_minor >= 0), net_minor INTEGER NOT NULL CHECK (net_minor >= 0),
    commission_refund_minor INTEGER NOT NULL DEFAULT 0 CHECK (commission_refund_minor >= 0), blocked INTEGER NOT NULL DEFAULT 0,
    auth_code TEXT NOT NULL DEFAULT '',
    card_last4 TEXT NOT NULL DEFAULT '' CHECK (card_last4 = '' OR (length(card_last4) = 4 AND card_last4 GLOB '[0-9][0-9][0-9][0-9]')),
    status TEXT NOT NULL DEFAULT 'active',
    created_by TEXT NOT NULL, created_at TEXT NOT NULL, updated_by TEXT, updated_at TEXT
  ) STRICT;
  CREATE UNIQUE INDEX IF NOT EXISTS idx_pos_sales_event ON pos_sales(event_id) WHERE kind = 'sale' AND status = 'active';
  CREATE UNIQUE INDEX IF NOT EXISTS idx_pos_sales_auth ON pos_sales(pos_id, auth_code, date) WHERE auth_code <> '' AND status = 'active';
  CREATE INDEX IF NOT EXISTS idx_pos_sales_origin ON pos_sales(origin_id);

  CREATE TABLE IF NOT EXISTS pos_items (
    id TEXT PRIMARY KEY, sale_id TEXT NOT NULL, pos_id TEXT NOT NULL, seq INTEGER NOT NULL,
    role TEXT NOT NULL CHECK (role IN ('sale', 'refund', 'fee')), value_date TEXT NOT NULL, blocked INTEGER NOT NULL DEFAULT 0,
    gross_minor INTEGER NOT NULL CHECK (gross_minor >= 0), commission_minor INTEGER NOT NULL DEFAULT 0 CHECK (commission_minor >= 0),
    tax_minor INTEGER NOT NULL DEFAULT 0 CHECK (tax_minor >= 0), fee_minor INTEGER NOT NULL DEFAULT 0 CHECK (fee_minor >= 0),
    net_minor INTEGER NOT NULL CHECK (net_minor >= 0), planned_net_minor INTEGER NOT NULL,
    status TEXT NOT NULL DEFAULT 'pending', event_id TEXT NOT NULL DEFAULT '', settled_on TEXT NOT NULL DEFAULT '',
    late INTEGER NOT NULL DEFAULT 0, settle_error TEXT NOT NULL DEFAULT '',
    created_by TEXT NOT NULL, created_at TEXT NOT NULL, updated_by TEXT, updated_at TEXT
  ) STRICT;
  CREATE INDEX IF NOT EXISTS idx_pos_items_status ON pos_items(status, value_date);
  CREATE INDEX IF NOT EXISTS idx_pos_items_sale ON pos_items(sale_id);

  -- Bankaya Tahsile Ver / Bankadan Geri Al'ın tek izi (fin_events ile); cheque_events'e satır yazılmaz, cheques.status değişmez.
  CREATE TABLE IF NOT EXISTS cheque_collections (
    id TEXT PRIMARY KEY, cheque_id TEXT NOT NULL, bank_account_id TEXT NOT NULL,
    given_date TEXT NOT NULL, status TEXT NOT NULL DEFAULT 'pending',
    closed_date TEXT NOT NULL DEFAULT '', event_id TEXT NOT NULL, close_event_id TEXT NOT NULL DEFAULT '',
    created_by TEXT NOT NULL, created_at TEXT NOT NULL, updated_by TEXT, updated_at TEXT
  ) STRICT;
  CREATE UNIQUE INDEX IF NOT EXISTS idx_cheque_collections_pending ON cheque_collections(cheque_id) WHERE status = 'pending';
  CREATE INDEX IF NOT EXISTS idx_cheque_collections_cheque ON cheque_collections(cheque_id);

  CREATE TABLE IF NOT EXISTS bank_jobs (
    id TEXT PRIMARY KEY, kind TEXT NOT NULL,
    due_date TEXT NOT NULL, ref TEXT NOT NULL DEFAULT '', payload_json TEXT NOT NULL DEFAULT '{}',
    status TEXT NOT NULL DEFAULT 'pending', done_ref TEXT NOT NULL DEFAULT '', error TEXT NOT NULL DEFAULT '',
    created_by TEXT NOT NULL, created_at TEXT NOT NULL, updated_by TEXT, updated_at TEXT
  ) STRICT;
  CREATE UNIQUE INDEX IF NOT EXISTS idx_bank_jobs_pending ON bank_jobs(kind, ref) WHERE status = 'pending';
  CREATE INDEX IF NOT EXISTS idx_bank_jobs_due ON bank_jobs(status, due_date);

  CREATE TABLE IF NOT EXISTS fx_rates (
    date TEXT NOT NULL, currency TEXT NOT NULL, kind TEXT NOT NULL,
    rate_e6 INTEGER NOT NULL CHECK (rate_e6 > 0), unit INTEGER NOT NULL DEFAULT 1, source TEXT NOT NULL,
    fetched_at TEXT NOT NULL, created_by TEXT NOT NULL DEFAULT '',
    PRIMARY KEY (date, currency, kind, source)
  ) STRICT, WITHOUT ROWID;

  CREATE TABLE IF NOT EXISTS bank_holidays (
    date TEXT PRIMARY KEY, kind TEXT NOT NULL, name TEXT NOT NULL DEFAULT '',
    created_by TEXT NOT NULL, created_at TEXT NOT NULL
  ) STRICT, WITHOUT ROWID;

  CREATE TABLE IF NOT EXISTS bank_statements (
    id TEXT PRIMARY KEY, bank_account_id TEXT NOT NULL, source TEXT NOT NULL DEFAULT 'file',
    file_name TEXT NOT NULL DEFAULT '', file_sha256 TEXT NOT NULL DEFAULT '', format TEXT NOT NULL DEFAULT '',
    period_from TEXT NOT NULL DEFAULT '', period_to TEXT NOT NULL DEFAULT '',
    opening_minor INTEGER, closing_minor INTEGER, line_count INTEGER NOT NULL DEFAULT 0, duplicate_count INTEGER NOT NULL DEFAULT 0,
    status TEXT NOT NULL DEFAULT 'active',
    created_by TEXT NOT NULL, created_at TEXT NOT NULL, updated_by TEXT, updated_at TEXT
  ) STRICT;
  CREATE UNIQUE INDEX IF NOT EXISTS idx_bank_statements_file ON bank_statements(bank_account_id, file_sha256) WHERE file_sha256 <> '' AND status = 'active';

  CREATE TABLE IF NOT EXISTS bank_statement_lines (
    id TEXT PRIMARY KEY, statement_id TEXT NOT NULL, bank_account_id TEXT NOT NULL,
    line_no INTEGER NOT NULL, date TEXT NOT NULL, value_date TEXT NOT NULL DEFAULT '', direction TEXT NOT NULL CHECK (direction IN ('in', 'out')),
    amount_minor INTEGER NOT NULL CHECK (amount_minor > 0), balance_minor INTEGER, description TEXT NOT NULL DEFAULT '',
    reference TEXT NOT NULL DEFAULT '', counter_iban TEXT NOT NULL DEFAULT '', counter_name TEXT NOT NULL DEFAULT '',
    external_id TEXT NOT NULL DEFAULT '', fingerprint TEXT NOT NULL, status TEXT NOT NULL DEFAULT 'unmatched',
    score INTEGER NOT NULL DEFAULT 0, suggestion_json TEXT NOT NULL DEFAULT '[]',
    created_by TEXT NOT NULL, created_at TEXT NOT NULL, updated_by TEXT, updated_at TEXT
  ) STRICT;
  CREATE INDEX IF NOT EXISTS idx_bank_statement_lines_account ON bank_statement_lines(bank_account_id, status, date);
  -- Parmak izi tekil değil ("Mükerrer Değil" ile aynı gün aynı tutarda iki gerçek EFT girilebilir).
  CREATE INDEX IF NOT EXISTS idx_bank_statement_lines_fingerprint ON bank_statement_lines(bank_account_id, fingerprint);
  CREATE UNIQUE INDEX IF NOT EXISTS idx_bank_statement_lines_external ON bank_statement_lines(bank_account_id, external_id) WHERE external_id <> '';

  CREATE TABLE IF NOT EXISTS bank_matches (
    id TEXT PRIMARY KEY, line_id TEXT NOT NULL, bank_account_id TEXT NOT NULL,
    event_id TEXT NOT NULL, amount_minor INTEGER NOT NULL CHECK (amount_minor > 0), digest TEXT NOT NULL,
    kind TEXT NOT NULL, score INTEGER NOT NULL DEFAULT 0, created_by TEXT NOT NULL, created_at TEXT NOT NULL,
    undone_by TEXT, undone_at TEXT, undo_reason TEXT NOT NULL DEFAULT ''
  ) STRICT;
  CREATE INDEX IF NOT EXISTS idx_bank_matches_event ON bank_matches(event_id) WHERE undone_at IS NULL;
  CREATE INDEX IF NOT EXISTS idx_bank_matches_line ON bank_matches(line_id);

  CREATE TABLE IF NOT EXISTS bank_plans (
    id TEXT PRIMARY KEY, kind TEXT NOT NULL, bank_account_id TEXT NOT NULL,
    to_account_id TEXT NOT NULL DEFAULT '', party_id TEXT NOT NULL DEFAULT '', amount_minor INTEGER NOT NULL CHECK (amount_minor > 0),
    currency TEXT NOT NULL DEFAULT 'TRY', planned_date TEXT NOT NULL, repeat TEXT NOT NULL DEFAULT 'none',
    description TEXT NOT NULL DEFAULT '', status TEXT NOT NULL DEFAULT 'planned', done_event_id TEXT NOT NULL DEFAULT '',
    created_by TEXT NOT NULL, created_at TEXT NOT NULL, updated_by TEXT, updated_at TEXT
  ) STRICT;

  -- Kalıcı istek kimliği (§3.10/1): anahtar = kullanıcı|kapsam|kimlik; yazımla aynı işlemde; 30 günden eskiler budanır.
  CREATE TABLE IF NOT EXISTS request_keys (
    key TEXT PRIMARY KEY, scope TEXT NOT NULL, user_id TEXT NOT NULL,
    body_hash TEXT NOT NULL, ref_id TEXT NOT NULL, created_at TEXT NOT NULL
  ) STRICT;
  CREATE INDEX IF NOT EXISTS idx_request_keys_created ON request_keys(created_at);
`;

export const LATEST_VERSION = MIGRATIONS.at(-1).version;

// now: iş saati (config.now) — göç damgaları (meta.schema.v20At) sahte saatte de iş gününü taşır.
export function runMigrations(store, { backupDir, keep = 30, log, company = null, now = systemClock } = {}) {
  const current = store.get("PRAGMA user_version").user_version;
  const pending = MIGRATIONS.filter(item => item.version > current);
  if (!pending.length) return { from: current, to: current, applied: [], backup: null };
  const hasData = Boolean(store.get("SELECT 1 AS found FROM sqlite_master WHERE type = 'table' AND name = 'users'"));
  let backup = null;
  if (hasData && backupDir) {
    // Göçten önce mutlaka tam yedek: bir sorun olursa bu dosyaya dönülür. (v2.0.20: şirketin klasörüne, kodlu adla.)
    backup = createBackup(store.db, backupDir, { label: `pre-migration-v${pending.at(-1).version}`, keep, company });
    log?.info(`Göç öncesi yedek alındı: ${backup.name}`);
  }
  for (const migration of pending) {
    store.tx(() => {
      migration.up(store, { company, now });
      store.exec(`PRAGMA user_version = ${migration.version}`);
    });
    log?.info(`Veritabanı göçü uygulandı: ${migration.version} (${migration.name})`);
  }
  return { from: current, to: LATEST_VERSION, applied: pending.map(item => item.version), backup };
}
