// Veritabanı şema sürümleme. PRAGMA user_version = uygulanan son göç numarası.
// Kural: göçler mümkün olduğunca EKLEYİCİ olur (sütun/tablo/indeks ekleme, veri normalleştirme). Bir göç mevcut
// kayıtları yeniden anahtarlıyorsa (göç 4) geri dönüş, güncelleme öncesi alınan tam yedeğe dönülerek yapılır:
// güncelleme düzeni yeni sürüm açılamazsa şema sürümü değiştiği için veritabanını kendiliğinden yedekten geri yükler.
import { randomUUID } from "node:crypto";
import { createBackup } from "./backup.mjs";
import { DEFAULT_ADMIN_PASSWORD } from "./config.mjs";
import { rowHash, rowIdentities } from "./dataset-identity.mjs";
import { parseJson } from "./http.mjs";
import { isFullDate } from "./insight/validators.mjs";
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
          unit TEXT NOT NULL DEFAULT 'adet',
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
