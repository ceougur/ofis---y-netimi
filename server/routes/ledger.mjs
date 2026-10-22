// Ana Defter servisi (v2.0.13): alt defterleri, alt defterlerin kendi süzgeçleriyle okur (silinen cari/kart/evrak dışarıda;
// Kasa'dan düşen hareket ana defterde de yoktur), yevmiyeyi ve mizanı kurar, mutabakat kapısını çalıştırır.
//   GET /api/workspace/ledger?from=&to=  → mizan + mutabakat (Finans raporları yetkisi)
// Rapor merkezi "Hesap Planı Mizanı", "Yevmiye Defteri" ve "Defter Mutabakatı" raporlarını bu servisten üretir.
import { journal, moneyAccount, reconcile, trialBalance } from "../lib/general-ledger.mjs";
import { DOUBTFUL_GL } from "../lib/doubtful-gl.mjs";
import { doubtfulExpected, doubtfulRows, doubtfulUsed } from "../lib/bank/doubtful.mjs";
import { HttpError, ok, readJson, text } from "../lib/http.mjs";
import { roundMoney } from "../lib/money.mjs";

const DATE = /^\d{4}-\d{2}-\d{2}$/;
// Carisiz evrak satırlarının yazım sırası tabanı (MM8): cari satırlarının rowid'lerinden büyük (aynı gün aynı sınıfta onlardan sonra gelir).
const FREE_SEQ = 1e15;

export function registerLedgerRoutes(router, { store, auth, audit = () => {}, period = null, cash = () => null, accounts = () => null, integrity = () => null, money = null, pos = () => null }) {
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
    // Tablonun süzgeci: koşullardan (null olmayanlar) en az biri; filter var ama hiçbiri yoksa satır yok. Koşullar satır kimliği kümesine
    // çevrilir (alias.id IN (alt sorgu UNION alt sorgu …)): her alt sorgu kendi indeksini kullanır. Kolonlar arası OR (e.account_id IN …
    // OR e.id IN …) indekssiz tam taramaya düşüyordu (100.000 satırda fatura sorgusu ~60 ms). keys: [değer, alt sorgu ($ = liste)].
    const where = (alias, keys, glue = "WHERE") => {
      if (!filter) return "";
      const kept = keys.filter(([value]) => value).map(([value, sql]) => sql.replace("$", value));
      return ` ${glue} ${kept.length ? `${alias}.id IN (${kept.join(" UNION ")})` : "0"}`;
    };
    const own = name => `SELECT value FROM json_each(:${name})`;
    // Süzgeçte satır tablosu dış döngüdür (CROSS JOIN yalnız sırayı belirler; sonuç aynı iç birleşim): istatistiksiz planlayıcı aksi hâlde
    // görünürlük JOIN'inin indeksiyle (accounts.deleted_at) bütün tabloyu dolaşabilir. Süzgeçsiz sorgular 2.1.0 dilim 4'teki gibidir.
    const J = filter ? "CROSS JOIN" : "JOIN";
    // Aynı nedenle süzgeçte durum kolonlarının indeksi kapatılır (tekli +: değer aynı, yalnız indeks seçilmez): i.status = 'issued'
    // indeksi, kimlik kümesinin birincil anahtarından önce seçiliyordu (100.000 satırda ~55 ms).
    const X = filter ? "+" : "";
    // Yalnız sorguda geçen adlı parametreler verilir (node:sqlite bilinmeyen adı reddeder).
    const all = (sql, query = true) => (query ? store.all(sql, Object.fromEntries(Object.entries(params).filter(([name]) => sql.includes(`:${name})`)))) : []);
    const wanted = (...values) => !filter || values.some(Boolean);
    out.payments = all(`SELECT id, p.rowid AS seq, amount, date, note, method, ${refOf("payments", "p")} AS ref FROM payments p${where("p", [[set?.payments, own("m_payments")]])}`, wanted(set?.payments));
    // Kasa ↔ Banka transferinin nakit bacağı banka bacağının hesabını (ikiz satırın fin_ref'i) taşır: madde tek, banka tarafı onun hesabıdır.
    const cashRef = refOf("cash_entries", "c");
    // Yargıç Y2/Y3: Kasa açılışı işaretten (göç 22; v21 ve öncesi dosyada kolon yok: 0 — sıradan giriş).
    const cashOpening = store.all("PRAGMA table_info(cash_entries)").some(column => column.name === "is_opening") ? "c.is_opening" : "0";
    // 2.4.3 MM3 (göç 29): Kasa'dan vergi ödemesinin ayrıntısı (B 360 · B 689 / A 100). v28 ve öncesi dosyada kolon yok: ''.
    const cashTax = store.all("PRAGMA table_info(cash_entries)").some(column => column.name === "tax_json") ? "c.tax_json" : "''";
    out.cashEntries = all(
      `SELECT c.id, c.rowid AS seq, c.kind, c.amount, c.date, c.description, c.method, c.transfer_id AS transferId, ${cashOpening} AS isOpening, ${cashTax} AS taxJson, ${cashRef} AS ref,
              CASE WHEN c.transfer_id <> '' THEN COALESCE((SELECT ${cashRef === "''" ? "''" : "t.fin_ref"} FROM cash_entries t WHERE t.transfer_id = c.transfer_id AND t.id <> c.id LIMIT 1), '') ELSE '' END AS bankRef
       FROM cash_entries c${where("c", [[set?.cash, own("m_cash")]])}`,
      wanted(set?.cash),
    );
    // Bankaya Tahsile Ver (plan §3.14): tahsil kaydı tablosu varsa satır bayrakları (yevmiyede 101.01 ↔ 101.02; general-ledger journal()).
    const collections = has("cheque_collections");
    if (has("accounts")) {
      // bankReturned: bankada tahsildeyken karşılıksız dönen evrakın karşılıksız maddesi (carinin kendi borç satırı) — alacağı 101.02.
      const returned = collections
        ? "CASE WHEN e.source = 'cheque' AND e.kind = 'debt' AND c.direction = 'in' AND e.account_id = c.account_id AND EXISTS (SELECT 1 FROM cheque_collections k WHERE k.cheque_id = c.id AND k.status = 'returned') THEN 1 ELSE 0 END"
        : "0";
      out.accountEntries = all(
        `SELECT e.id, e.rowid AS seq, e.kind, e.amount, e.date, e.note, e.source, e.source_id AS sourceId, e.method, ${refOf("account_entries", "e")} AS ref, a.type AS accountType, e.account_id AS party,
                COALESCE(c.direction, '') AS chequeDirection, COALESCE(c.instrument, '') AS chequeInstrument, COALESCE(m.reason, '') AS moveReason, ${returned} AS bankReturned,
                e.invoice_id AS invoiceId, e.doubtful_skip AS doubtfulSkip
         FROM account_entries e ${J} accounts a ON a.id = e.account_id AND a.deleted_at IS NULL
           LEFT JOIN cheques c ON e.source = 'cheque' AND c.id = e.source_id
           LEFT JOIN stock_moves m ON e.source = 'stock' AND m.id = e.source_id${where("e", [[set?.parties, "SELECT id FROM account_entries WHERE account_id IN $"], [set?.entries, own("m_entries")], [set?.cheques, "SELECT id FROM account_entries WHERE source = 'cheque' AND source_id IN $"]])}`,
        wanted(set?.parties, set?.entries, set?.cheques),
      );
    }
    if (has("plans")) {
      // Kartın carisi silindiyse kart cari defterinde görünmez: ana defterde "carisiz kart" hesabında izlenir.
      out.plans = all(
        `SELECT p.id, p.rowid AS seq, p.total, p.status, p.covers_balance AS coversBalance, COALESCE(NULLIF(p.registered_on, ''), substr(p.created_at, 1, 10)) AS date, COALESCE(p.closed_at, substr(p.updated_at, 1, 10)) AS closedOn,
                COALESCE(a.type, '') AS accountType, COALESCE(a.id, '') AS party,
                COALESCE((SELECT SUM(CASE WHEN e.kind = 'in' THEN e.amount ELSE -e.amount END) FROM plan_entries e WHERE e.plan_id = p.id), 0) AS paid
         FROM plans p LEFT JOIN accounts a ON a.id = p.account_id AND a.deleted_at IS NULL WHERE ${X}p.deleted_at IS NULL${where("p", [[set?.parties, "SELECT id FROM plans WHERE account_id IN $"], [set?.plans, own("plans")]], "AND")}`,
        wanted(set?.parties, set?.plans),
      );
      // Doğrulama T11: taksite sayılmış evrakın karşılıksız ters kaydı (çekli 'out'); bankada tahsildeyken döndüyse alacağı 101.02 (satır bazında).
      const planReturned = collections
        ? "CASE WHEN e.kind = 'out' AND e.cheque_id <> '' AND EXISTS (SELECT 1 FROM cheque_collections k WHERE k.cheque_id = e.cheque_id AND k.status = 'returned') THEN 1 ELSE 0 END"
        : "0";
      // 2.2.0 İz 4.2 (plan §3.11a): taksite sayılan evrakın türü (senet 121, çek 101); evrak silinmiş olsa da türü okunur (satır deftere girer).
      const planInstrument = has("cheques") ? "CASE WHEN e.cheque_id <> '' THEN COALESCE((SELECT x.instrument FROM cheques x WHERE x.id = e.cheque_id), '') ELSE '' END" : "''";
      out.planEntries = all(
        `SELECT e.id, e.rowid AS seq, e.plan_id AS planId, e.kind, e.amount, e.date, e.note, e.method, ${refOf("plan_entries", "e")} AS ref, e.cheque_id AS chequeId, ${planInstrument} AS chequeInstrument, e.opening, COALESCE(a.type, '') AS accountType, COALESCE(a.id, '') AS party, ${planReturned} AS bankReturned,
                COALESCE(NULLIF(p.registered_on, ''), substr(p.created_at, 1, 10)) AS planDate, p.covers_balance AS planCovers
         FROM plan_entries e ${J} plans p ON p.id = e.plan_id AND p.deleted_at IS NULL LEFT JOIN accounts a ON a.id = p.account_id AND a.deleted_at IS NULL${where("e", [[set?.parties, "SELECT pe.id FROM plans pp JOIN plan_entries pe ON pe.plan_id = pp.id WHERE pp.account_id IN $"], [set?.plans, "SELECT id FROM plan_entries WHERE plan_id IN $"], [set?.planEntries, own("m_plan_entries")], [set?.cheques, "SELECT id FROM plan_entries WHERE cheque_id IN $"]])}`,
        wanted(set?.parties, set?.plans, set?.planEntries, set?.cheques),
      );
    }
    // Fatura (v2.0.15): yalnız kesilmiş olanlar (taslak ve iptal deftere girmez). Carisi silinmiş fatura olamaz (silme engelli).
    if (has("invoices")) {
      out.invoices = all(
        `SELECT i.id, i.rowid AS seq, i.kind, i.issue_date AS date, i.number, i.gl_json AS glJson, i.try_vat AS tryVat, i.try_withheld AS tryWithheld, i.try_stoppage AS tryStoppage,
                i.try_payable AS tryPayable, a.type AS accountType, a.id AS party
         FROM invoices i ${J} accounts a ON a.id = i.account_id AND a.deleted_at IS NULL WHERE ${X}i.status = 'issued'${where("i", [[set?.parties, "SELECT id FROM invoices WHERE account_id IN $"], [set?.invoices, own("invoices")]], "AND")}`,
        wanted(set?.parties, set?.invoices),
      );
    }
    if (has("stock_moves")) out.stockMoves = all(`SELECT m.id, m.rowid AS seq, m.kind, m.amount, m.date, m.note, m.pay, m.method, m.reason, ${refOf("stock_moves", "m")} AS ref FROM stock_moves m WHERE ${X}m.pay = 'cash' AND m.amount > 0${where("m", [[set?.moves, own("m_moves")]], "AND")}`, wanted(set?.moves));
    // MM4 (2.4.3, göç 29): açılış stoku — işaretli (is_opening) yalnız miktar girişi; değeri miktar × hareketin birim fiyatı (kuruşa yuvarlanır). Ürün
    // sonradan silinse de açılış deftere girer (aralıklı envanter: 153 = dönem başı + alışlar; peşin alım gibi). v28 ve öncesi dosyada kolon yok: satır yok.
    if (has("stock_moves") && store.all("PRAGMA table_info(stock_moves)").some(column => column.name === "is_opening")) {
      out.stockOpenings = all(
        `SELECT m.id, m.rowid AS seq, m.qty, m.unit_price AS unitPrice, m.date, m.note, COALESCE(i.name, '') AS itemName, COALESCE(i.unit, '') AS unit FROM stock_moves m LEFT JOIN stock_items i ON i.id = m.item_id
         WHERE ${X}m.is_opening = 1 AND m.kind = 'in' AND m.pay = 'none'${where("m", [[set?.moves, own("m_moves")]], "AND")}`,
        wanted(set?.moves),
      );
    }
    // Banka Fişi satırları (v2.1.0): THP kodu, alt hesap ve kuruş yazım anında saklanır.
    if (has("bank_lines") && has("fin_events")) {
      out.bankLines = all(`SELECT l.event_id AS eventId, e.rowid AS eventSeq, l.seq, l.gl, l.sub, l.side, l.try_minor AS tryMinor, e.date, e.no, e.description FROM bank_lines l ${J} fin_events e ON e.id = l.event_id${filter ? ` WHERE ${set?.events ? `l.event_id IN ${set.events}` : "0"}` : ""} ORDER BY e.date, l.event_id, l.seq`, wanted(set?.events));
    }
    if (has("cheques")) {
      const eventOf = refOf("cheque_events", "ev") === "''" ? "''" : "ev.event_id";
      // closesDeposit: bu tahsil olayı bankada tahsildeki evrakın kaydını kapattı (collected, close_event_id = olayın başlığı) — tahsil maddesinin
      // alacağı 101.02. Satır bazında: İşlem Kartı ve kapı yalnız bu satırla kurduğunda da aynı sonuç (doğrulama G1).
      const closes = collections && eventOf !== "''"
        ? "CASE WHEN ev.kind = 'collect' AND ev.event_id <> '' AND EXISTS (SELECT 1 FROM cheque_collections k WHERE k.cheque_id = ev.cheque_id AND k.status = 'collected' AND k.close_event_id = ev.event_id) THEN 1 ELSE 0 END"
        : "0";
      out.chequeEvents = all(`SELECT ev.id, ev.rowid AS seq, ev.kind, ev.amount, ev.date, ev.note, ev.method, ${refOf("cheque_events", "ev")} AS ref, ${eventOf} AS eventId, ${closes} AS closesDeposit, c.instrument AS instrument FROM cheque_events ev ${J} cheques c ON c.id = ev.cheque_id AND c.deleted_at IS NULL WHERE ${X}ev.kind IN ('collect', 'pay')${where("ev", [[set?.chequeEvents, own("m_cheque_events")], [set?.cheques, "SELECT id FROM cheque_events WHERE cheque_id IN $"]], "AND")}`, wanted(set?.chequeEvents, set?.cheques));
      // Cariye işlenmemiş evrak: carisi/kartı olmayan (ör. cari açılmamış bir kişiden alınan çek) ya da Excel'den
      // "carilere dokunmadan" alınan açılış portföyü. Cari etkisi yoktur; portföye girişi ve karşılıksız/iade çıkışı ana
      // defterde doğrudan gelir/gider karşılığıyla izlenir (portföy mutabakatı tutsun).
      for (const row of all(
        `SELECT c.id, c.rowid AS seq, c.direction, c.instrument, c.amount, c.issue_date AS date, c.status, c.serial_no AS serialNo,
                (SELECT ev.date FROM cheque_events ev WHERE ev.cheque_id = c.id AND ev.kind = 'bounce' ORDER BY ev.created_at DESC LIMIT 1) AS bouncedOn,
                ${collections ? "EXISTS (SELECT 1 FROM cheque_collections k WHERE k.cheque_id = c.id AND k.status = 'returned')" : "0"} AS bankReturned,
                EXISTS (SELECT 1 FROM account_entries e JOIN accounts a ON a.id = e.account_id AND a.deleted_at IS NULL
                        WHERE e.source = 'cheque' AND e.source_id = c.id AND e.account_id = c.account_id AND e.kind = 'debt') AS hasDebt
         FROM cheques c
         WHERE ${X}c.deleted_at IS NULL
           AND NOT EXISTS (SELECT 1 FROM plan_entries pe JOIN plans p ON p.id = pe.plan_id AND p.deleted_at IS NULL WHERE pe.cheque_id = c.id)
           AND NOT EXISTS (SELECT 1 FROM account_entries e JOIN accounts a ON a.id = e.account_id AND a.deleted_at IS NULL
                           WHERE e.source = 'cheque' AND e.source_id = c.id AND e.account_id = c.account_id
                             AND e.kind = CASE WHEN c.direction = 'in' THEN 'credit' ELSE 'debt' END)${where("c", [[set?.cheques, own("cheques")]], "AND")}`,
        wanted(set?.cheques),
      )) {
        const note = `Cariye işlenmemiş evrak${row.serialNo ? ` No ${row.serialNo}` : ""}`;
        // Yazım sırası (MM8): evrakın rowid'i cari satırlarınınkiyle karşılaştırılamaz (başka tablo) → aynı gün cari satırlarından SONRA, evrakların
        // yazım sırasıyla (general-ledger journalOrder).
        const seq = FREE_SEQ + Number(row.seq);
        if (row.direction === "in") {
          out.accountEntries.push({ id: `free-in:${row.id}`, seq, kind: "credit", amount: row.amount, date: row.date, note, source: "cheque", chequeDirection: "in", chequeInstrument: row.instrument, accountType: "", free: true });
          if (row.status === "bounced" && row.bouncedOn && !row.hasDebt) out.accountEntries.push({ id: `free-bounce:${row.id}`, seq, kind: "debt", amount: row.amount, date: row.bouncedOn, note: `${note} · karşılıksız`, source: "cheque", chequeDirection: "in", chequeInstrument: row.instrument, accountType: "", free: true, bankReturned: Number(row.bankReturned) ? 1 : 0 });
        } else out.accountEntries.push({ id: `free-out:${row.id}`, seq, kind: "debt", amount: row.amount, date: row.date, note, source: "cheque", chequeDirection: "out", chequeInstrument: row.instrument, accountType: "", free: true });
      }
    }
    // Bankaya Tahsile Ver (plan §3.14): tahsil kayıtları (101.01 ↔ 101.02). Silinmiş evrakın kaydı (tahsildeyken silinemez) deftere girmez.
    // closedByCollect: kayıt bu çekin tahsil olayıyla kapandı (o tahsilin maddesi A 101.02; ayrı kapanış maddesi yok). Değilse (açılış onarımının
    // "eski sürüm" kapanışı) kapanış tarihinde B 101.01 / A 101.02.
    if (collections && has("fin_events")) {
      out.chequeCollections = all(
        `SELECT k.id, k.rowid AS seq, k.status, k.given_date AS givenDate, k.closed_date AS closedDate, k.close_event_id AS closeEventId, c.serial_no AS serialNo, c.instrument AS instrument,
                COALESCE(NULLIF((SELECT f.try_minor FROM fin_events f WHERE f.id = k.event_id), 0), CAST(ROUND(c.amount * 100) AS INTEGER)) AS amountMinor,
                CASE WHEN k.status = 'collected' AND k.close_event_id <> '' AND EXISTS (SELECT 1 FROM cheque_events ev WHERE ev.cheque_id = k.cheque_id AND +ev.kind = 'collect' AND ev.event_id = k.close_event_id) THEN 1 ELSE 0 END AS closedByCollect
         FROM cheque_collections k ${J} cheques c ON c.id = k.cheque_id AND c.deleted_at IS NULL${filter ? ` WHERE ${set?.cheques ? `k.cheque_id IN ${set.cheques}` : "0"}` : ""}`,
        wanted(set?.cheques),
      );
    }
    // Şüpheli Ticari Alacaklar (2.3.0 İz 1; plan §3.11b; lib/bank/doubtful.mjs): kayıtlar ve karşılıklar — süzgeçte yalnız dokunulan carilerinki
    // (carinin bütün satırlarıyla; yalnız para satırı / evrak / fatura süzgecinde yüklenmez: ayırma carinin tam geçmişini ister, o denetimler
    // kontrol hesabına bakmaz).
    if (!filter || set?.parties) out.doubtful = doubtfulRows(store, { parties: filter ? filter.parties : null });
    // 2.4.3 MM3: KDV Mahsup Fişleri (etkin ve geri alınmış; geri alınanın ters kaydı aynı gün). Süzgeçli kurulumda (kapının dokunulan varlıkları)
    // yüklenmez: mahsup tablosuna yazım tam kapıya düşer (integrity-scope "kapsam dışı").
    if (!filter && has("vat_offsets")) out.vatOffsets = store.all("SELECT id, rowid AS seq, month, date, out_minor AS outMinor, in_minor AS inMinor, carry_in_minor AS carryInMinor, carry_out_minor AS carryOutMinor, payable_minor AS payableMinor, status FROM vat_offsets ORDER BY date, created_at, rowid");
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
    // Çek/senet alt defteri (2.2.0 İz 4.2, plan §3.11a): portföydeki alınan çek 101, senet 121; ödenecek verilen çek 103, senet 321. 121/321
    // satırı yalnız senet girilmişse (silinmiş olsa da) açılır: senet kullanmayan kurulumun Defter Mutabakatı ve Mutabakat Testi'nin denetim
    // listesi 2.1.0 ile aynı kalır (300/309 kuralı gibi). Senedi olmayan veride yevmiye 121/321'e satır yazmaz.
    if (has("cheques")) {
      const live = "deleted_at IS NULL";
      const sums = store.get(
        `SELECT COALESCE(SUM(CASE WHEN ${live} AND direction = 'in' AND status = 'portfolio' AND instrument <> 'note' THEN amount END), 0) AS c101,
                COALESCE(SUM(CASE WHEN ${live} AND direction = 'in' AND status = 'portfolio' AND instrument = 'note' THEN amount END), 0) AS c121,
                COALESCE(SUM(CASE WHEN ${live} AND direction = 'out' AND status = 'pending' AND instrument <> 'note' THEN amount END), 0) AS c103,
                COALESCE(SUM(CASE WHEN ${live} AND direction = 'out' AND status = 'pending' AND instrument = 'note' THEN amount END), 0) AS c321,
                COALESCE(MAX(instrument = 'note'), 0) AS notes
         FROM cheques`,
      );
      out[101] = roundMoney(sums.c101);
      out[103] = -roundMoney(sums.c103);
      if (Number(sums.notes)) {
        out[121] = roundMoney(sums.c121);
        out[321] = -roundMoney(sums.c321);
      }
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
    // 2.4.3 MM3 — Vergi Ödemesi ve KDV Mahsup Fişi (ikinci yükleyici: kendi tablolarından SQL; yevmiye general-ledger'ın kuralıyla). 360: bankadan
    // ödenen vergi (Banka Fişi satırı, ters kaydı dahil) + Kasa'dan ödenen vergi (cash_entries.tax_json) borç; etkin mahsubun ödenecek KDV'si alacak.
    // 391 / 191: etkin mahsubun ayı kapatan tutarları; 190 (yalnız mahsup kullanılmışsa satır açılır): yeni devreden − kullanılan devreden.
    if (has("bank_lines")) {
      const paid = store.get("SELECT COALESCE(SUM(CASE side WHEN 'D' THEN try_minor ELSE -try_minor END), 0) AS n FROM bank_lines WHERE gl = '360'").n;
      if (paid) out[360] = roundMoney((out[360] || 0) + paid / 100);
    }
    if (store.all("PRAGMA table_info(cash_entries)").some(column => column.name === "tax_json")) {
      const paid = store.get("SELECT COALESCE(SUM(CAST(json_extract(tax_json, '$.taxMinor') AS INTEGER)), 0) AS n FROM cash_entries WHERE tax_json <> '' AND kind = 'out' AND json_valid(tax_json)").n;
      if (paid) out[360] = roundMoney((out[360] || 0) + paid / 100);
    }
    if (has("vat_offsets") && store.get("SELECT 1 AS found FROM vat_offsets LIMIT 1")) {
      const v = store.get("SELECT COALESCE(SUM(out_minor), 0) AS o, COALESCE(SUM(in_minor), 0) AS i, COALESCE(SUM(carry_out_minor - carry_in_minor), 0) AS c, COALESCE(SUM(payable_minor), 0) AS p FROM vat_offsets WHERE status = 'active'");
      out[391] = roundMoney((out[391] || 0) + v.o / 100);
      out[191] = roundMoney((out[191] || 0) - v.i / 100);
      out[190] = roundMoney(v.c / 100);
      out[360] = roundMoney((out[360] || 0) - v.p / 100);
    }
    // Banka Fişi'nin stopaj satırı (faizden kesilen; §3.11): 193'e eklenir.
    if (has("bank_lines")) {
      const stoppage = store.get("SELECT COALESCE(SUM(CASE side WHEN 'D' THEN try_minor ELSE -try_minor END), 0) AS n FROM bank_lines WHERE gl = '193'").n;
      if (stoppage) out[193] = roundMoney((out[193] || 0) + stoppage / 100);
    }
    // Şüpheli Ticari Alacaklar (2.3.0 İz 1; plan §3.11b/4 "128 = Σ etkin şüpheli − kapananlar; 129 = Σ karşılık − çözülen"): ikinci yükleyici
    // (SQL alacak satırları + aynı ayırma kuralı; lib/bank/doubtful.mjs). Carinin kontrol hesabı (120/320/336) kalan şüpheli kadar düşer (cari
    // kartı bakiyesi değişmez: 120 + 128 = kart). 128/129 satırı yalnız şüpheli alacak kullanılmışsa açılır (300/309, 121/321 kuralı).
    if (doubtfulUsed(store)) {
      const d = doubtfulExpected(store);
      for (const [control, minor] of d.byControl) out[control] = roundMoney((out[control] || 0) - minor / 100);
      out[DOUBTFUL_GL.doubtful] = roundMoney(d.openMinor / 100);
      out[DOUBTFUL_GL.provision] = -roundMoney(d.provisionMinor / 100);
    }
    return out;
  }
  // Alt hesap beklenenleri (§3.11 bank:sub): tek kaynağın (yol, hesap) grupları yevmiyeyle aynı kuralla (moneyAccount) alt hesaba.
  function expectedSubs(groups = groupsOf(), refList = refs()) {
    const out = new Map();
    for (const group of groups) {
      if (!["bank", "card", "ccard", "loan"].includes(group.way)) continue;
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
    // 2.2.0 (plan §4.4/6): kilitlenecek döneme düşen vadesi gelmiş POS kalemleri önce bankaya aktarılır; hâlâ bekleyen varsa 409
    // bank-pending-before-lock + liste (uyarı; "Yine de Kilitle" = force).
    if (body?.lockedUntil) pos()?.beforeLock?.(String(body.lockedUntil), body.force === true);
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
  // Gözden geçirme B8 (Aşama 2): carinin yevmiyedeki kontrol hesabı (120/320/336) bakiyesi — partyBalances(journal(rows({ parties })))
  // ile AYNI kural, SQL toplamıyla (kuruş tamsayısı). Mutabakat kapısının süzgeci hareketi çok (binlerce satır) olan carilerde bunu
  // kullanır: carinin bütün satırlarının yevmiye maddesi kurulmadan (30.000 satırlı caride ~230 ms → ~10 ms). İki yolun eşitliği
  // test/banka-210-gg-cari.test.mjs'te (her cari, karışık veri) denetlenir. Yalnız silinmemiş cariler (yevmiye de onları okur).
  //   cari satırı: fatura kaynaklı borç/alacak satırı faturanın kendisinden gelir (0); çek ve stok kaynaklı: borç +, diğer −;
  //                elle: borç/ödeme +, alacak/tahsilat −
  //   taksit kartı: Mevcut Borcu taksitlendirmeyen kart + tutar; kapatılmış kart − vazgeçilen kalan; tahsilat −, iade +
  //   fatura (kesilmiş): satış/SMM/alıştan iade + ödenecek, satıştan iade/alış − ödenecek
  function partyTotals(ids) {
    const list = JSON.stringify([...ids]);
    const c = column => `CAST(ROUND(${column} * 100) AS INTEGER)`;
    const out = new Map();
    if (!has("accounts")) return out;
    const parts = [
      has("account_entries") ? `COALESCE((SELECT SUM(CASE
          WHEN e.source = 'invoice' AND e.kind IN ('debt', 'credit') THEN 0
          WHEN e.source IN ('cheque', 'stock') THEN CASE WHEN e.kind = 'debt' THEN ${c("e.amount")} ELSE -${c("e.amount")} END
          WHEN e.kind IN ('debt', 'out') THEN ${c("e.amount")}
          WHEN e.kind IN ('credit', 'in') THEN -${c("e.amount")}
          ELSE 0 END) FROM account_entries e WHERE e.account_id = a.id), 0)` : "0",
      has("plans") ? `COALESCE((SELECT SUM(CASE WHEN p.covers_balance THEN 0 ELSE ${c("p.total")} END
          - CASE WHEN p.status = 'closed' THEN MAX(0, ${c(`(p.total - COALESCE((SELECT SUM(CASE WHEN x.kind = 'in' THEN x.amount ELSE -x.amount END) FROM plan_entries x WHERE x.plan_id = p.id), 0))`)}) ELSE 0 END)
          FROM plans p WHERE p.account_id = a.id AND +p.deleted_at IS NULL), 0)` : "0",
      has("plans") && has("plan_entries") ? `COALESCE((SELECT SUM(CASE WHEN pe.kind = 'in' THEN -${c("pe.amount")} ELSE ${c("pe.amount")} END) FROM plans p CROSS JOIN plan_entries pe ON pe.plan_id = p.id WHERE p.account_id = a.id AND +p.deleted_at IS NULL), 0)` : "0",
      has("invoices") ? `COALESCE((SELECT SUM(CASE WHEN ${c("i.try_payable")} <= 0 THEN 0 WHEN i.kind IN ('sale', 'smm', 'purchase_return') THEN ${c("i.try_payable")} WHEN i.kind IN ('sale_return', 'purchase') THEN -${c("i.try_payable")} ELSE 0 END) FROM invoices i WHERE i.account_id = a.id AND +i.status = 'issued'), 0)` : "0",
    ];
    for (const row of store.all(`SELECT a.id, ${parts.join(" + ")} AS cents FROM json_each(?) j CROSS JOIN accounts a ON a.id = j.value WHERE +a.deleted_at IS NULL`, list)) out.set(row.id, Number(row.cents) || 0);
    return out;
  }
  /** Carinin yevmiyeye giren satır sayısı (cari satırı + fatura + taksit tahsilatı): süzgecin "çok hareketli cari" eşiği için. */
  function partyRowCounts(ids) {
    const list = JSON.stringify([...ids]);
    const parts = [has("account_entries") ? "(SELECT COUNT(*) FROM account_entries e WHERE e.account_id = j.value)" : "0", has("invoices") ? "(SELECT COUNT(*) FROM invoices i WHERE i.account_id = j.value)" : "0", has("plans") && has("plan_entries") ? "(SELECT COUNT(*) FROM plans p CROSS JOIN plan_entries pe ON pe.plan_id = p.id WHERE p.account_id = j.value)" : "0"];
    return new Map(store.all(`SELECT j.value AS id, ${parts.join(" + ")} AS n FROM json_each(?) j`, list).map(row => [row.id, Number(row.n) || 0]));
  }
  return { build, check, expected, expectedSubs, refs, partyTotals, partyRowCounts };
}
