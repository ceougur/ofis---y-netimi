// Ana Defter servisi (v2.0.13): alt defterleri, alt defterlerin kendi süzgeçleriyle okur (silinen cari/kart/evrak dışarıda;
// Kasa'dan düşen hareket ana defterde de yoktur), yevmiyeyi ve mizanı kurar, mutabakat kapısını çalıştırır.
//   GET /api/workspace/ledger?from=&to=  → mizan + mutabakat (Finans raporları yetkisi)
// Rapor merkezi "Hesap Planı Mizanı", "Yevmiye Defteri" ve "Defter Mutabakatı" raporlarını bu servisten üretir.
import { journal, reconcile, trialBalance } from "../lib/general-ledger.mjs";
import { HttpError, ok, readJson, text } from "../lib/http.mjs";
import { roundMoney } from "../lib/money.mjs";

const DATE = /^\d{4}-\d{2}-\d{2}$/;

export function registerLedgerRoutes(router, { store, auth, audit = () => {}, period = null, cash = () => null, accounts = () => null, integrity = () => null }) {
  const has = table => Boolean(store.get("SELECT 1 AS found FROM sqlite_master WHERE type = 'table' AND name = ?", table));
  function rows() {
    const out = { payments: [], cashEntries: [], accountEntries: [], plans: [], planEntries: [], stockMoves: [], chequeEvents: [] };
    out.payments = store.all("SELECT id, amount, date, note, method FROM payments");
    out.cashEntries = store.all("SELECT id, kind, amount, date, description, method FROM cash_entries");
    if (has("accounts")) {
      out.accountEntries = store.all(
        `SELECT e.id, e.kind, e.amount, e.date, e.note, e.source, e.method, a.type AS accountType, e.account_id AS party,
                COALESCE(c.direction, '') AS chequeDirection, COALESCE(m.reason, '') AS moveReason
         FROM account_entries e JOIN accounts a ON a.id = e.account_id AND a.deleted_at IS NULL
           LEFT JOIN cheques c ON e.source = 'cheque' AND c.id = e.source_id
           LEFT JOIN stock_moves m ON e.source = 'stock' AND m.id = e.source_id`,
      );
    }
    if (has("plans")) {
      // Kartın carisi silindiyse kart cari defterinde görünmez: ana defterde "carisiz kart" hesabında izlenir.
      out.plans = store.all(
        `SELECT p.id, p.total, p.status, p.covers_balance AS coversBalance, COALESCE(NULLIF(p.registered_on, ''), substr(p.created_at, 1, 10)) AS date, COALESCE(p.closed_at, substr(p.updated_at, 1, 10)) AS closedOn,
                COALESCE(a.type, '') AS accountType, COALESCE(a.id, '') AS party,
                COALESCE((SELECT SUM(CASE WHEN e.kind = 'in' THEN e.amount ELSE -e.amount END) FROM plan_entries e WHERE e.plan_id = p.id), 0) AS paid
         FROM plans p LEFT JOIN accounts a ON a.id = p.account_id AND a.deleted_at IS NULL WHERE p.deleted_at IS NULL`,
      );
      out.planEntries = store.all(
        `SELECT e.id, e.plan_id AS planId, e.kind, e.amount, e.date, e.note, e.method, e.cheque_id AS chequeId, e.opening, COALESCE(a.type, '') AS accountType, COALESCE(a.id, '') AS party
         FROM plan_entries e JOIN plans p ON p.id = e.plan_id AND p.deleted_at IS NULL LEFT JOIN accounts a ON a.id = p.account_id AND a.deleted_at IS NULL`,
      );
    }
    if (has("stock_moves")) out.stockMoves = store.all("SELECT id, kind, amount, date, note, pay, method, reason FROM stock_moves WHERE pay = 'cash' AND amount > 0");
    if (has("cheques")) {
      out.chequeEvents = store.all("SELECT ev.id, ev.kind, ev.amount, ev.date, ev.note, ev.method FROM cheque_events ev JOIN cheques c ON c.id = ev.cheque_id AND c.deleted_at IS NULL WHERE ev.kind IN ('collect', 'pay')");
      // Cariye işlenmemiş evrak: carisi/kartı olmayan (ör. cari açılmamış bir kişiden alınan çek) ya da Excel'den
      // "carilere dokunmadan" alınan açılış portföyü. Cari etkisi yoktur; portföye girişi ve karşılıksız/iade çıkışı ana
      // defterde doğrudan gelir/gider karşılığıyla izlenir (portföy mutabakatı tutsun).
      for (const row of store.all(
        `SELECT c.id, c.direction, c.amount, c.issue_date AS date, c.status, c.serial_no AS serialNo,
                (SELECT ev.date FROM cheque_events ev WHERE ev.cheque_id = c.id AND ev.kind = 'bounce' ORDER BY ev.created_at DESC LIMIT 1) AS bouncedOn,
                EXISTS (SELECT 1 FROM account_entries e JOIN accounts a ON a.id = e.account_id AND a.deleted_at IS NULL
                        WHERE e.source = 'cheque' AND e.source_id = c.id AND e.account_id = c.account_id AND e.kind = 'debt') AS hasDebt
         FROM cheques c
         WHERE c.deleted_at IS NULL
           AND NOT EXISTS (SELECT 1 FROM plan_entries pe JOIN plans p ON p.id = pe.plan_id AND p.deleted_at IS NULL WHERE pe.cheque_id = c.id)
           AND NOT EXISTS (SELECT 1 FROM account_entries e JOIN accounts a ON a.id = e.account_id AND a.deleted_at IS NULL
                           WHERE e.source = 'cheque' AND e.source_id = c.id AND e.account_id = c.account_id
                             AND e.kind = CASE WHEN c.direction = 'in' THEN 'credit' ELSE 'debt' END)`,
      )) {
        const note = `Cariye işlenmemiş evrak${row.serialNo ? ` No ${row.serialNo}` : ""}`;
        if (row.direction === "in") {
          out.accountEntries.push({ id: `free-in:${row.id}`, kind: "credit", amount: row.amount, date: row.date, note, source: "cheque", chequeDirection: "in", accountType: "", free: true });
          if (row.status === "bounced" && row.bouncedOn && !row.hasDebt) out.accountEntries.push({ id: `free-bounce:${row.id}`, kind: "debt", amount: row.amount, date: row.bouncedOn, note: `${note} · karşılıksız`, source: "cheque", chequeDirection: "in", accountType: "", free: true });
        } else out.accountEntries.push({ id: `free-out:${row.id}`, kind: "debt", amount: row.amount, date: row.date, note, source: "cheque", chequeDirection: "out", accountType: "", free: true });
      }
    }
    return out;
  }
  // Carisiz evrakın karşı hesabı gelir/gider (602 / 770): journal() cariyi kontrol hesabı sayar; burada düzeltilir.
  function build() {
    const source = rows();
    const entries = journal(source);
    const free = new Set(source.accountEntries.filter(row => row.free).map(row => `account:${row.id}`));
    for (const entry of entries) {
      if (!free.has(entry.id)) continue;
      for (const line of entry.lines) if (["120", "320", "336"].includes(line.account)) line.account = line.debit ? "770" : "602";
    }
    return entries;
  }
  // Alt defterlerin kendi hesabı (beklenen bakiyeler): Kasa ve Banka yola göre, cariler türe göre, portföy durumuna göre.
  function expected() {
    const by = cash()?.summary ? cash().summary("9999-12-31").byMethod || {} : {};
    const out = { 100: by.cash || 0, 102: by.bank || 0, 108: by.card || 0, 120: 0, 320: 0, 336: 0 };
    const list = accounts()?.list ? accounts().list({ id: "ledger", role: "admin", permissions: [] }, { status: "all" }).accounts : [];
    for (const account of list) {
      const code = { customer: "120", supplier: "320", other: "336" }[account.type] || "120";
      out[code] = roundMoney(out[code] + (Number(account.balance) || 0));
    }
    if (has("cheques")) {
      out[101] = roundMoney(store.get("SELECT COALESCE(SUM(amount), 0) AS n FROM cheques WHERE deleted_at IS NULL AND direction = 'in' AND status = 'portfolio'").n);
      out[103] = -roundMoney(store.get("SELECT COALESCE(SUM(amount), 0) AS n FROM cheques WHERE deleted_at IS NULL AND direction = 'out' AND status = 'pending'").n);
    }
    // Taksit alt defteri — carisiz (ya da carisi silinmiş) kartların kalan alacağı: kart tutarı − net tahsilat; kapatılan
    // kartın kalanı vazgeçilen alacaktır (sıfırlanır). Carili kartların alacağı cari bakiyesinin içindedir (120/320/336).
    if (has("plans")) {
      let open = 0;
      for (const plan of store.all(
        `SELECT p.total, p.status, p.covers_balance AS coversBalance,
                COALESCE((SELECT SUM(CASE WHEN e.kind = 'in' THEN e.amount ELSE -e.amount END) FROM plan_entries e WHERE e.plan_id = p.id), 0) AS paid
         FROM plans p LEFT JOIN accounts a ON a.id = p.account_id AND a.deleted_at IS NULL WHERE p.deleted_at IS NULL AND a.id IS NULL`,
      )) {
        const total = plan.coversBalance ? 0 : Number(plan.total) || 0;
        const left = roundMoney((Number(plan.total) || 0) - (Number(plan.paid) || 0));
        open = roundMoney(open + total - (Number(plan.paid) || 0) - (plan.status === "closed" ? Math.max(0, left) : 0));
      }
      out[127] = open;
    }
    return out;
  }
  function check({ from = "", to = "" } = {}) {
    const entries = build();
    const trial = trialBalance(entries, { from, to });
    // Mutabakat tüm zamanlarla yapılır (alt defter bakiyeleri bugüne kadarki her şeyi içerir).
    const reconciliation = reconcile(from || to ? trialBalance(entries) : trial, expected());
    return { entries, trial, reconciliation };
  }
  router.get("/api/workspace/ledger", async ({ req, res, url }) => {
    auth.requirePermission(req, "overview.view");
    const from = text(url.searchParams.get("from"));
    const to = text(url.searchParams.get("to"));
    if ((from && !DATE.test(from)) || (to && !DATE.test(to))) throw new HttpError(400, "Geçerli bir tarih aralığı seçin.");
    const { entries, trial, reconciliation } = check({ from, to });
    ok(res, { trial, reconciliation, entryCount: entries.length });
  });
  // Dönem kilidi (v2.0.13): kilitli tarih ve öncesine hareket eklenemez/düzeltilemez/silinemez. Yalnız yönetici değiştirir.
  router.get("/api/workspace/ledger/lock", async ({ req, res }) => {
    auth.requirePermission(req, "overview.view");
    ok(res, { lockedUntil: period?.lockedUntil() || "", today: period?.today() || "" });
  });
  router.put("/api/admin/period-lock", async ({ req, res }) => {
    const user = auth.requirePermission(req, "users.manage");
    if (!period) throw new HttpError(503, "Dönem kilidi hazır değil.");
    const body = await readJson(req);
    const previous = period.lockedUntil();
    const lockedUntil = period.setLock(body.lockedUntil);
    audit(user, lockedUntil ? "ledger.period.locked" : "ledger.period.unlocked", "period", { previous, lockedUntil });
    integrity()?.start?.();
    ok(res, { lockedUntil });
  });
  // Mutabakat testi (tüm denetimler) ve geri alınan işlemlerin günlüğü.
  router.get("/api/workspace/ledger/integrity", async ({ req, res }) => {
    auth.requirePermission(req, "overview.view");
    const service = integrity();
    if (!service) throw new HttpError(503, "Mutabakat katmanı hazır değil.");
    ok(res, { ...service.run(), log: service.recent(50).map(row => ({ ...row, detail: JSON.parse(row.detail || "[]") })) });
  });
  return { build, check, expected };
}
