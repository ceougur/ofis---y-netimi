// Ana Defter servisi (v2.0.13): alt defterleri, alt defterlerin kendi süzgeçleriyle okur (silinen cari/kart/evrak dışarıda;
// Kasa'dan düşen hareket ana defterde de yoktur), yevmiyeyi ve mizanı kurar, mutabakat kapısını çalıştırır.
//   GET /api/workspace/ledger?from=&to=  → mizan + mutabakat (Finans raporları yetkisi)
// Rapor merkezi "Hesap Planı Mizanı", "Yevmiye Defteri" ve "Defter Mutabakatı" raporlarını bu servisten üretir.
import { journal, moneyAccount, reconcile, trialBalance } from "../lib/general-ledger.mjs";
import { HttpError, ok, readJson, text } from "../lib/http.mjs";
import { roundMoney } from "../lib/money.mjs";

const DATE = /^\d{4}-\d{2}-\d{2}$/;

export function registerLedgerRoutes(router, { store, auth, audit = () => {}, period = null, cash = () => null, accounts = () => null, integrity = () => null, money = null }) {
  const has = table => Boolean(store.get("SELECT 1 AS found FROM sqlite_master WHERE type = 'table' AND name = ?", table));
  // v2.1.0 (§3.11): para satırının hesap bağı (fin_ref; '' = Hesabı Atanmamış). v19 dosyasında (araçlar) kolon yoktur: ''.
  const refOf = (table, alias) => (store.all(`PRAGMA table_info(${table})`).some(column => column.name === "fin_ref") ? `${alias}.fin_ref` : "''");
  // Banka hesabı ve POS kartları (alt hesap kodları): yevmiyede moneyAccount, beklenenlerde yolun alt hesabı.
  function refs() {
    const out = { accounts: {}, pos: {} };
    if (has("bank_accounts")) for (const row of store.all("SELECT id, kind, gl, gl_sub AS glSub FROM bank_accounts")) out.accounts[row.id] = { kind: row.kind, gl: row.gl, glSub: row.glSub };
    if (has("pos_terminals")) for (const row of store.all("SELECT id, gl_sub AS glSub FROM pos_terminals")) out.pos[row.id] = { glSub: row.glSub };
    return out;
  }
  // filter (v2.1.0, §3.11 mutabakat kapısı "dokunulan varlıklar"): yalnız bu varlıkların satırları — { parties, plans, cheques, invoices,
  // events, money: { tablo: kimlikler } }. Her tabloda verilen varlıklardan birine ait satırlar (VEYA); hiçbiri o tabloya uymuyorsa tablo
  // boş gelir. filter yoksa sorgular 2.0.26'dakiyle aynıdır (bütün satırlar).
  function rows(filter = null) {
    const out = { payments: [], cashEntries: [], accountEntries: [], plans: [], planEntries: [], stockMoves: [], chequeEvents: [], invoices: [], bankLines: [], refs: refs() };
    const params = {};
    const list = (name, values) => {
      if (!values || !values.length) return null;
      params[name] = JSON.stringify([...values]);
      return `(SELECT value FROM json_each(:${name}))`;
    };
    const set = filter ? {
      parties: list("parties", filter.parties), plans: list("plans", filter.plans), cheques: list("cheques", filter.cheques), invoices: list("invoices", filter.invoices), events: list("events", filter.events),
      payments: list("m_payments", filter.money?.payments), cash: list("m_cash", filter.money?.cash_entries), entries: list("m_entries", filter.money?.account_entries),
      planEntries: list("m_plan_entries", filter.money?.plan_entries), moves: list("m_moves", filter.money?.stock_moves), chequeEvents: list("m_cheque_events", filter.money?.cheque_events),
    } : null;
    // Tablonun süzgeci: koşullardan (null olmayanlar) en az biri; filter var ama hiçbiri yoksa satır yok.
    const where = (parts, glue = "WHERE") => {
      if (!filter) return "";
      const kept = parts.filter(([value]) => value).map(([value, sql]) => sql.replace("$", value));
      return ` ${glue} (${kept.length ? kept.join(" OR ") : "0"})`;
    };
    // Yalnız sorguda geçen adlı parametreler verilir (node:sqlite bilinmeyen adı reddeder).
    const all = (sql, query = true) => (query ? store.all(sql, Object.fromEntries(Object.entries(params).filter(([name]) => sql.includes(`:${name})`)))) : []);
    const wanted = (...values) => !filter || values.some(Boolean);
    out.payments = all(`SELECT id, amount, date, note, method, ${refOf("payments", "p")} AS ref FROM payments p${where([[set?.payments, "p.id IN $"]])}`, wanted(set?.payments));
    // Kasa ↔ Banka transferinin nakit bacağı banka bacağının hesabını (ikiz satırın fin_ref'i) taşır: madde tek, banka tarafı onun hesabıdır.
    const cashRef = refOf("cash_entries", "c");
    out.cashEntries = all(
      `SELECT c.id, c.kind, c.amount, c.date, c.description, c.method, c.transfer_id AS transferId, ${cashRef} AS ref,
              CASE WHEN c.transfer_id <> '' THEN COALESCE((SELECT ${cashRef === "''" ? "''" : "t.fin_ref"} FROM cash_entries t WHERE t.transfer_id = c.transfer_id AND t.id <> c.id LIMIT 1), '') ELSE '' END AS bankRef
       FROM cash_entries c${where([[set?.cash, "c.id IN $"]])}`,
      wanted(set?.cash),
    );
    if (has("accounts")) {
      out.accountEntries = all(
        `SELECT e.id, e.kind, e.amount, e.date, e.note, e.source, e.method, ${refOf("account_entries", "e")} AS ref, a.type AS accountType, e.account_id AS party,
                COALESCE(c.direction, '') AS chequeDirection, COALESCE(m.reason, '') AS moveReason
         FROM account_entries e JOIN accounts a ON a.id = e.account_id AND a.deleted_at IS NULL
           LEFT JOIN cheques c ON e.source = 'cheque' AND c.id = e.source_id
           LEFT JOIN stock_moves m ON e.source = 'stock' AND m.id = e.source_id${where([[set?.parties, "e.account_id IN $"], [set?.entries, "e.id IN $"], [set?.cheques, "(e.source = 'cheque' AND e.source_id IN $)"]])}`,
        wanted(set?.parties, set?.entries, set?.cheques),
      );
    }
    if (has("plans")) {
      // Kartın carisi silindiyse kart cari defterinde görünmez: ana defterde "carisiz kart" hesabında izlenir.
      out.plans = all(
        `SELECT p.id, p.total, p.status, p.covers_balance AS coversBalance, COALESCE(NULLIF(p.registered_on, ''), substr(p.created_at, 1, 10)) AS date, COALESCE(p.closed_at, substr(p.updated_at, 1, 10)) AS closedOn,
                COALESCE(a.type, '') AS accountType, COALESCE(a.id, '') AS party,
                COALESCE((SELECT SUM(CASE WHEN e.kind = 'in' THEN e.amount ELSE -e.amount END) FROM plan_entries e WHERE e.plan_id = p.id), 0) AS paid
         FROM plans p LEFT JOIN accounts a ON a.id = p.account_id AND a.deleted_at IS NULL WHERE p.deleted_at IS NULL${where([[set?.parties, "p.account_id IN $"], [set?.plans, "p.id IN $"]], "AND")}`,
        wanted(set?.parties, set?.plans),
      );
      out.planEntries = all(
        `SELECT e.id, e.plan_id AS planId, e.kind, e.amount, e.date, e.note, e.method, ${refOf("plan_entries", "e")} AS ref, e.cheque_id AS chequeId, e.opening, COALESCE(a.type, '') AS accountType, COALESCE(a.id, '') AS party
         FROM plan_entries e JOIN plans p ON p.id = e.plan_id AND p.deleted_at IS NULL LEFT JOIN accounts a ON a.id = p.account_id AND a.deleted_at IS NULL${where([[set?.parties, "p.account_id IN $"], [set?.plans, "e.plan_id IN $"], [set?.planEntries, "e.id IN $"], [set?.cheques, "e.cheque_id IN $"]])}`,
        wanted(set?.parties, set?.plans, set?.planEntries, set?.cheques),
      );
    }
    // Fatura (v2.0.15): yalnız kesilmiş olanlar (taslak ve iptal deftere girmez). Carisi silinmiş fatura olamaz (silme engelli).
    if (has("invoices")) {
      out.invoices = all(
        `SELECT i.id, i.kind, i.issue_date AS date, i.number, i.gl_json AS glJson, i.try_vat AS tryVat, i.try_withheld AS tryWithheld, i.try_stoppage AS tryStoppage,
                i.try_payable AS tryPayable, a.type AS accountType, a.id AS party
         FROM invoices i JOIN accounts a ON a.id = i.account_id AND a.deleted_at IS NULL WHERE i.status = 'issued'${where([[set?.parties, "i.account_id IN $"], [set?.invoices, "i.id IN $"]], "AND")}`,
        wanted(set?.parties, set?.invoices),
      );
    }
    if (has("stock_moves")) out.stockMoves = all(`SELECT m.id, m.kind, m.amount, m.date, m.note, m.pay, m.method, m.reason, ${refOf("stock_moves", "m")} AS ref FROM stock_moves m WHERE m.pay = 'cash' AND m.amount > 0${where([[set?.moves, "m.id IN $"]], "AND")}`, wanted(set?.moves));
    // Banka Fişi satırları (v2.1.0): THP kodu, alt hesap ve kuruş yazım anında saklanır.
    if (has("bank_lines") && has("fin_events")) {
      out.bankLines = all(`SELECT l.event_id AS eventId, l.seq, l.gl, l.sub, l.side, l.try_minor AS tryMinor, e.date, e.no, e.description FROM bank_lines l JOIN fin_events e ON e.id = l.event_id${where([[set?.events, "l.event_id IN $"]])} ORDER BY e.date, l.event_id, l.seq`, wanted(set?.events));
    }
    if (has("cheques")) {
      out.chequeEvents = all(`SELECT ev.id, ev.kind, ev.amount, ev.date, ev.note, ev.method, ${refOf("cheque_events", "ev")} AS ref FROM cheque_events ev JOIN cheques c ON c.id = ev.cheque_id AND c.deleted_at IS NULL WHERE ev.kind IN ('collect', 'pay')${where([[set?.chequeEvents, "ev.id IN $"], [set?.cheques, "ev.cheque_id IN $"]], "AND")}`, wanted(set?.chequeEvents, set?.cheques));
      // Cariye işlenmemiş evrak: carisi/kartı olmayan (ör. cari açılmamış bir kişiden alınan çek) ya da Excel'den
      // "carilere dokunmadan" alınan açılış portföyü. Cari etkisi yoktur; portföye girişi ve karşılıksız/iade çıkışı ana
      // defterde doğrudan gelir/gider karşılığıyla izlenir (portföy mutabakatı tutsun).
      for (const row of all(
        `SELECT c.id, c.direction, c.amount, c.issue_date AS date, c.status, c.serial_no AS serialNo,
                (SELECT ev.date FROM cheque_events ev WHERE ev.cheque_id = c.id AND ev.kind = 'bounce' ORDER BY ev.created_at DESC LIMIT 1) AS bouncedOn,
                EXISTS (SELECT 1 FROM account_entries e JOIN accounts a ON a.id = e.account_id AND a.deleted_at IS NULL
                        WHERE e.source = 'cheque' AND e.source_id = c.id AND e.account_id = c.account_id AND e.kind = 'debt') AS hasDebt
         FROM cheques c
         WHERE c.deleted_at IS NULL
           AND NOT EXISTS (SELECT 1 FROM plan_entries pe JOIN plans p ON p.id = pe.plan_id AND p.deleted_at IS NULL WHERE pe.cheque_id = c.id)
           AND NOT EXISTS (SELECT 1 FROM account_entries e JOIN accounts a ON a.id = e.account_id AND a.deleted_at IS NULL
                           WHERE e.source = 'cheque' AND e.source_id = c.id AND e.account_id = c.account_id
                             AND e.kind = CASE WHEN c.direction = 'in' THEN 'credit' ELSE 'debt' END)${where([[set?.cheques, "c.id IN $"]], "AND")}`,
        wanted(set?.cheques),
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
  function build(filter = null) {
    const source = rows(filter);
    const entries = journal(source);
    const free = new Set(source.accountEntries.filter(row => row.free).map(row => `account:${row.id}`));
    for (const entry of entries) {
      if (!free.has(entry.id)) continue;
      for (const line of entry.lines) if (["120", "320", "336"].includes(line.account)) line.account = line.debit ? "770" : "602";
    }
    return entries;
  }
  // Alt defterlerin kendi hesabı (beklenen bakiyeler): Kasa ve Banka yola göre, cariler türe göre, portföy durumuna göre.
  // accountList (v2.0.22): mutabakat denetimi aynı anda (aynı veriyle) cari listesini zaten hesapladıysa yeniden hesaplanmaz.
  // v2.1.0 (K5, §3.11): Kasa ve banka tarafı TEK KAYNAKTAN (lib/bank/money-lines.mjs) yol bazında: 100 = nakit, 102 = havale, 108 = POS,
  // 309 = kurumsal kart, 300 = kredi. 300/309 satırı yalnız kullanıldığında (kart/kredi hesabı tanımlı ya da hareketi var) açılır: banka
  // kullanmayan kurulumun Defter Mutabakatı ve Mutabakat Testi'nin denetim listesi 2.0.26 ile aynı kalır. Tanınmayan yol hiçbir beklenene
  // girmez (yevmiye onu 100'e yazar; fark 2.0.26'daki gibi görünür ve money:method yakalar).
  const groupsOf = () => (money ? money.groups() : []);
  function expected(accountList = null, groups = groupsOf()) {
    const way = name => groups.filter(group => group.way === name).reduce((sum, group) => sum + Number(group.cents), 0);
    const used = kind => has("bank_accounts") && Boolean(store.get("SELECT 1 AS found FROM bank_accounts WHERE kind = ? LIMIT 1", kind));
    const out = { 100: roundMoney(way("cash") / 100), 102: roundMoney(way("bank") / 100), 108: roundMoney(way("card") / 100), 120: 0, 320: 0, 336: 0 };
    if (used("card") || groups.some(group => group.way === "ccard")) out[309] = roundMoney(way("ccard") / 100);
    if (used("loan") || groups.some(group => group.way === "loan")) out[300] = roundMoney(way("loan") / 100);
    const list = accountList || (accounts()?.list ? accounts().list({ id: "ledger", role: "admin", permissions: [] }, { status: "all" }).accounts : []);
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
    // Vergi hesapları (v2.0.15) — fatura alt defterinin kendi toplamları: 191 İndirilecek KDV (alış − alıştan iade), 391
    // Hesaplanan KDV (satış − satıştan iade; tevkifat düşülmüş), 360 tevkifat ve stopaj (alıcı olarak kestiklerimiz),
    // 193 stopaj (müşterinin bizden kestiği). Borç bakiyesi artı.
    if (has("invoices")) {
      const sums = store.get(
        `SELECT COALESCE(SUM(CASE kind WHEN 'purchase' THEN CAST(ROUND(try_vat * 100) AS INTEGER) WHEN 'purchase_return' THEN -CAST(ROUND(try_vat * 100) AS INTEGER) END), 0) AS v191,
                COALESCE(SUM(CASE WHEN kind IN ('sale', 'smm') THEN -(CAST(ROUND(try_vat * 100) AS INTEGER) - CAST(ROUND(try_withheld * 100) AS INTEGER))
                                  WHEN kind = 'sale_return' THEN CAST(ROUND(try_vat * 100) AS INTEGER) - CAST(ROUND(try_withheld * 100) AS INTEGER) END), 0) AS v391,
                COALESCE(SUM(CASE kind WHEN 'purchase' THEN -(CAST(ROUND(try_withheld * 100) AS INTEGER) + CAST(ROUND(try_stoppage * 100) AS INTEGER))
                                       WHEN 'purchase_return' THEN CAST(ROUND(try_withheld * 100) AS INTEGER) + CAST(ROUND(try_stoppage * 100) AS INTEGER) END), 0) AS v360,
                COALESCE(SUM(CASE WHEN kind IN ('sale', 'smm') THEN CAST(ROUND(try_stoppage * 100) AS INTEGER) END), 0) AS v193
         FROM invoices i WHERE i.status = 'issued' AND EXISTS (SELECT 1 FROM accounts a WHERE a.id = i.account_id AND a.deleted_at IS NULL)`,
      );
      out[191] = roundMoney(sums.v191 / 100);
      out[391] = roundMoney(sums.v391 / 100);
      out[360] = roundMoney(sums.v360 / 100);
      out[193] = roundMoney(sums.v193 / 100);
    }
    // Banka Fişi'nin stopaj satırı (faizden kesilen; §3.11): 193'e eklenir.
    if (has("bank_lines")) {
      const stoppage = store.get("SELECT COALESCE(SUM(CASE side WHEN 'D' THEN try_minor ELSE -try_minor END), 0) AS n FROM bank_lines WHERE gl = '193'").n;
      if (stoppage) out[193] = roundMoney((out[193] || 0) + stoppage / 100);
    }
    return out;
  }
  // Alt hesap beklenenleri (§3.11 bank:sub): tek kaynağın (yol, hesap) grupları yevmiyeyle aynı kuralla (moneyAccount) alt hesaba.
  function expectedSubs(groups = groupsOf(), refList = refs()) {
    const out = new Map();
    for (const group of groups) {
      if (!["bank", "card", "ccard"].includes(group.way)) continue;
      const { sub } = moneyAccount(group.way === "ccard" ? "card" : group.way, group.ref, refList);
      if (sub) out.set(sub, (out.get(sub) || 0) + Number(group.cents));
    }
    return out;
  }
  function check({ from = "", to = "", accountList = null } = {}) {
    const entries = build();
    const trial = trialBalance(entries, { from, to });
    const groups = groupsOf();
    // Mutabakat tüm zamanlarla yapılır (alt defter bakiyeleri bugüne kadarki her şeyi içerir).
    const reconciliation = reconcile(from || to ? trialBalance(entries) : trial, expected(accountList, groups));
    return { entries, trial, reconciliation, groups };
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
    const user = auth.requirePermission(req, "system.manage");
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
    // v2.1.0 (§3.11): Mutabakat Testi tam taramadır — kapının görmediği yeni sapma integrity_log'a ("scan") ve zile yazılır.
    const result = service.scan ? service.scan().result : service.run();
    ok(res, { ...result, log: service.recent(50).map(row => ({ ...row, detail: JSON.parse(row.detail || "[]") })) });
  });
  return { build, check, expected, expectedSubs, refs };
}
