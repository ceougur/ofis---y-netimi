// Mutabakat testi ve doğrulama katmanı (v2.0.13).
//
// Ne yapar: para taşıyan tablolara (Kasa, cari, taksit, stok, çek/senet) yazan HER işlem, en dış COMMIT'ten hemen
// önce aynı veritabanı işleminin içinde şu denetimlerden geçer (store.addCommitGuard):
//   1. Çift yönlü kayıt: her yevmiye maddesinde borç = alacak; mizanda borç toplamı = alacak toplamı.
//   2. Alt defter ↔ ana defter: Nakit Kasa, Banka, Kredi Kartı (Kasa alt defteri, yola göre), müşteri / tedarikçi /
//      diğer cariler (cari alt defteri — taksit alacakları dahil), carisiz taksit kartları (taksit alt defteri),
//      portföydeki ve ödenecek çek/senet: ana defter bakiyesi alt defterin kendi hesabına kuruşu kuruşuna eşit.
//   3. Kuruş: hiçbir tutar kuruştan küçük küsurat taşımaz, eksi olmaz.
//   4. Stok ↔ cari / Kasa bağı: açık hesaba yazılan her stok hareketinin carideki karşılığı aynı tutarda var; karşılığı
//      olmayan (sızan) ya da hareketi silinmiş (yetim) cari satırı yok; miktar sıfırdan büyük.
//   5. Çek/senet ↔ cari bağı: evraktan gelen her cari satırı var olan bir evraka ve onun tutarına bağlı.
//   6. Fatura (v2.0.15): başlık = kalemler; TL karşılığı denk; cari, stok, çek/senet ve taksit bağları; iade ≤ satılan.
// Sapma bulunursa işlem ROLLBACK edilir (hiçbir satırı diske yazılmaz), kullanıcıya nedeni söylenir (409) ve
// integrity_log'a yazılır.
//
// Eski veri: güncellemeden önce oluşmuş bir sapma (ör. eski sürümde kalmış kuruş farkı) açılışta bulunur ve günlüğe
// "baseline" olarak yazılır; o sapma yüzünden ilgisiz işlemler engellenmez. Kural: hiçbir işlem YENİ bir sapma
// eklemez ve var olanı büyütemez (denetim her işlemde "işlem öncesi durum" ile karşılaştırır).
//
// v2.1.0 (docs/BANKA-MODULU-PLAN.md §3.11 kararı; ölçüm tools/kapi-olcum.mjs, docs/2.1.0-KANIT.md): yukarıdaki tam denetim veriyle doğrusal
// büyür (10.000 para satırında ~0,7 sn, 100.000'de ~8 sn / COMMIT). COMMIT'te önce "dokunulan varlıklar" süzgeci (lib/integrity-scope.mjs)
// çalışır: yalnız işlemin dokunduğu cari, kart, çek, fatura, ürün ve para satırları aynı kurallarla denetlenir. Süzgeç temizse tam
// denetim çalışmaz; bir şey görürse (sapma, açılış sapması olan alan, kilit izine giren satır, store dışı yazım, çözülemeyen yazım)
// karar tam denetimindir (aynı kural, aynı hata metni). Testlerde (config.gateVerify) ikisi de her işlemde çalışır: süzgeç "temiz" deyip
// tam denetim reddederse işlem 500 "gate-equivalence" ile kırılır. Tam tarama (açılış, Mutabakat Testi, 15 dakikada bir) değişmedi.
import { createHash } from "node:crypto";
import { HttpError } from "./http.mjs";
import { UNASSIGNED_SUBS, partyBalances, subBalances } from "./general-ledger.mjs";
import { byEntity, createBankChecks } from "./bank/checks.mjs";
import { createScopedGate, familyOf } from "./integrity-scope.mjs";
import { systemClock } from "./clock.mjs";
import { roundMoney, toCents } from "./money.mjs";

const AMOUNT_COLUMNS = [
  ["payments", "amount", ""],
  ["cash_entries", "amount", ""],
  ["account_entries", "amount", ""],
  ["plans", "total", "deleted_at IS NULL"],
  ["plan_items", "amount", ""],
  ["plan_entries", "amount", ""],
  ["stock_moves", "amount", ""],
  ["cheques", "amount", "deleted_at IS NULL"],
  ["cheque_events", "amount", ""],
  ["invoices", "try_payable", "status <> 'draft'"],
  ["invoices", "try_net", "status <> 'draft'"],
  ["invoices", "try_vat", "status <> 'draft'"],
  ["invoices", "try_withheld", "status <> 'draft'"],
  ["invoices", "try_stoppage", "status <> 'draft'"],
  ["invoices", "payable_total", ""],
  ["invoice_lines", "net", ""],
  ["invoice_lines", "vat", ""],
];
const money = value => `${new Intl.NumberFormat("tr-TR", { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(Number(value) || 0)} TL`;

/** Testlerde (gateVerify) dokunulan varlıklar yolu "temiz" dedi ama tam kapı reddetti: süzgeç eksik (eşdeğerlik ihlali). */
export class GateEquivalenceError extends HttpError {
  constructor(failures, decision) {
    super(500, `Kapı eşdeğerlik ihlali: dokunulan varlıklar yolu temiz dedi, tam kapı reddetti (${failures.map(item => item.code).join(", ")}).`, { code: "gate-equivalence", failures, decision });
  }
}

export class IntegrityError extends HttpError {
  constructor(failures) {
    const first = failures[0];
    super(409, `İşlem geri alındı: kayıt defterler arasında sapma oluşturacaktı (${first.name}${first.difference ? `: ${money(first.difference)} fark` : ""}). Hiçbir değişiklik yazılmadı; yöneticinize bildirin.`, { code: "ledger-integrity", failures });
    this.failures = failures;
  }
}

/**
 * @param {{ store, ledger: () => ({ check, expected }), log?, newId? }} options
 */
const AUDITOR = { id: "integrity", role: "admin", permissions: [] };
// v2.0.26 (B7): tanınmayan yol (nakit/havale/kart dışı) üç okuma yolunda üç ayrı biçimde sayılıyordu (Kasa özeti: bakiyede var, yol
// kırılımında yok; Kasa satırları: nakit; yevmiye: 100). Yeni işlem böyle satır yazamaz ("money:method"); açılışta bulunan eski satırlar
// kimlikleriyle tabandır (A13 kuralı). v2.1.0 (K5): denetim tek kaynaktan (moneyLines'ın yol türetmesi "unknown" veren para satırları;
// havale yolunun kurumsal kart / kredi hesabına bağlanması da).
// v2.0.26 (A6): çek/senet olayları da (alındı/verildi, tahsil, ciro, ödeme, karşılıksız) tarihli harekettir; eski veride kalan
// ileri tarihli olaylar A13 kuralıyla (açılıştaki kimlikler taban) yeni işlemleri engellemez.
// v2.1.0 (§5.5): fin_events (İşlem No'lu işlem başlığı) de tarihli harekettir. Denetim satırları Banka Fişi olayı (kaynak modül
// satırı olmayan, src_table '') yazılınca görünür: bugünkü modüllerin (Kasa, cari, fatura, taksit, stok, çek) her para satırı da
// olay alır (bank.post, Aşama 2) ama olayın tarihi satırın tarihinin kopyasıdır ve satırın kendi tarih denetimi zaten var; Banka
// modülü kullanılmayan kurulumda Mutabakat Testi'nin denetim listesi ve sayısı ("N denetim tamam") değişmez. Banka Fişi yazıldığı
// anda kapı tarihi denetler.
const DATED = ["payments", "cash_entries", "account_entries", "stock_moves", "plan_entries", "cheque_events", "fin_events"];
const DATED_WHEN_USED = new Map([["fin_events", "SELECT 1 AS found FROM fin_events WHERE src_table = '' LIMIT 1"]]);
// 2. gözden geçirme İ8: denetim adlarında tablo adı yerine kullanıcının bildiği ad (Yönetim'de, Defter Mutabakatı'nda, günlükte görünür).
const TABLE_LABEL = {
  payments: "Kayıt Tahsilatları",
  cash_entries: "Kasa Hareketleri",
  account_entries: "Cari Hareketleri",
  stock_moves: "Stok Hareketleri",
  plan_entries: "Taksit Tahsilatları",
  plan_items: "Taksitler",
  plans: "Taksit Kartları",
  cheque_events: "Çek/Senet Hareketleri",
  cheques: "Çek/Senet",
  invoices: "Faturalar",
  invoice_lines: "Fatura Kalemleri",
  fin_events: "Finansal İşlemler",
};
const labelOf = table => TABLE_LABEL[table] || table;
// Kapanmış dönemin parmak izi: kilit tarihi ve öncesindeki her para satırı (tutar, yön, yol, tarih, cari/kalem bağı) ve
// o dönemde cariye borç yazan kartlar. Kilit altındaki tek bir satır değişirse, silinirse ya da eklenirse iz değişir.
const LOCK_SQL = {
  payments: "SELECT id, amount, date, method FROM payments WHERE date <= ? ORDER BY id",
  cash_entries: "SELECT id, kind, amount, date, method FROM cash_entries WHERE date <= ? ORDER BY id",
  account_entries: "SELECT id, account_id, kind, amount, date, method FROM account_entries WHERE date <= ? ORDER BY id",
  stock_moves: "SELECT id, item_id, kind, qty, amount, date, pay, method, account_id FROM stock_moves WHERE date <= ? ORDER BY id",
  plan_entries: "SELECT id, plan_id, kind, amount, date, method FROM plan_entries WHERE date <= ? ORDER BY id",
  plans: "SELECT id, total, account_id, registered_on FROM plans WHERE deleted_at IS NULL AND covers_balance = 0 AND registered_on <> '' AND registered_on <= ? ORDER BY id",
  // v2.0.15: kapanmış dönemde kesilmiş fatura iptal edilemez, o döneme fatura eklenemez (taslak deftere girmez, sayılmaz).
  invoices: "SELECT id, kind, status, account_id, issue_date, try_payable, try_vat FROM invoices WHERE status <> 'draft' AND issue_date <= ? ORDER BY id",
  // v2.0.26: yukarıdaki 7 girdinin SQL'i ve sırası değişmez; yeni girdiler sona eklenir ve { requires, sql } biçimindedir
  // (anahtar tablo adı değildir). SQL'deki ?1 kilit tarihidir.
  // A3 — party_lock: kapanmış dönemde HERHANGİ bir hareketi (tahsilat/ödeme, Borç Yaz/Alacak Yaz, açılış; taksit kartı borcu
  // ya da tahsilatı) olan her cari, türü ve silinmemiş olduğu bilgisiyle. Silinmiş carinin bütün satırları yevmiyeden düşer
  // (routes/ledger.mjs rows), tür değişikliği 120/320/336 sınıfını kaydırır: ikisi de kilitli mizanı değiştirir.
  party_lock: {
    requires: ["accounts", "account_entries", "plans", "plan_entries"],
    sql: `SELECT a.id, a.type, a.deleted_at IS NULL AS live FROM accounts a
          WHERE EXISTS (SELECT 1 FROM account_entries e WHERE e.account_id = a.id AND e.date <= ?1)
             OR EXISTS (SELECT 1 FROM plans p WHERE p.account_id = a.id AND p.deleted_at IS NULL
                          AND ((p.covers_balance = 0 AND p.registered_on <> '' AND p.registered_on <= ?1)
                               OR EXISTS (SELECT 1 FROM plan_entries pe WHERE pe.plan_id = p.id AND pe.date <= ?1)))
          ORDER BY a.id`,
  },
  // A6 — çek/senet: kapanmış dönemdeki olaylar (alındı/verildi, tahsil, ciro, ödeme, karşılıksız) ve o dönemde alınmış/verilmiş
  // evrakın tutarı, tarihi ve silinmemiş olduğu. Evrakın durumu (status) girmez: kilitli ayda alınan çek bugün tahsil edilir.
  cheque_events_lock: { requires: ["cheque_events"], sql: "SELECT id, cheque_id, kind, amount, date, method FROM cheque_events WHERE date <= ?1 ORDER BY id" },
  cheques_lock: { requires: ["cheques"], sql: "SELECT id, direction, amount, issue_date, deleted_at IS NULL AS live FROM cheques WHERE issue_date <= ?1 ORDER BY id" },
  // Gözden geçirme G2 — kapanmış dönemde tahsilatı olan kartın carisi: tahsilat carinin hesabına (120/320/336) yazılır; kart başka
  // cariye taşınırsa (iki cari de party_lock'ta olsa bile) kilitli dönemin cari bakiyeleri kayar. Silinen kart da izden düşer.
  plans_party_lock: {
    requires: ["plans", "plan_entries"],
    sql: `SELECT p.id, p.account_id FROM plans p
          WHERE p.deleted_at IS NULL AND EXISTS (SELECT 1 FROM plan_entries pe WHERE pe.plan_id = p.id AND pe.date <= ?1)
          ORDER BY p.id`,
  },
  // Gözden geçirme G1 — kapanmış dönemde kapatılmış kart: vazgeçilen kalan (689) kapatıldığı gün yazılır (routes/ledger.mjs: closed_at,
  // 2.0.13 öncesi kapatılmışta son güncelleme günü; Kayıt Tarihi'nden önce değil — aynı ifade). Kartın yeniden açılması, silinmesi,
  // tutarı, carisi (ve carinin türü) ya da sonradan gelen tahsilatı kilitli mizanı değiştirir. Kart güncellenirken eski kartın
  // kapanış günü yazılır (plans.mjs FREEZE_CLOSE); gün aynı kaldığı için iz değişmez.
  plans_close_lock: {
    requires: ["plans", "plan_entries", "accounts"],
    sql: `SELECT * FROM (
            SELECT p.id, p.account_id, COALESCE(a.type, '') AS party, p.total,
                   MAX(COALESCE(p.closed_at, substr(p.updated_at, 1, 10)), COALESCE(NULLIF(p.registered_on, ''), substr(p.created_at, 1, 10))) AS closed_on,
                   ROUND(p.total - COALESCE((SELECT SUM(CASE WHEN e.kind = 'in' THEN e.amount ELSE -e.amount END) FROM plan_entries e WHERE e.plan_id = p.id), 0), 2) AS waived
            FROM plans p LEFT JOIN accounts a ON a.id = p.account_id AND a.deleted_at IS NULL
            WHERE p.deleted_at IS NULL AND p.status = 'closed')
          WHERE closed_on <= ?1 ORDER BY id`,
  },
  // v2.1.0 (v20, §5.5): banka girdileri. Eski veride satır üretmezler (yeni kolonlar boş, yeni tablolar boş): göçten sonra kilit izi
  // göç öncesiyle birebir aynıdır (K11). "tablo.kolon" gereksinimi kolonun varlığını da arar (v19 dosyasında atlanır).
  // money_refs: kapanmış dönemdeki para satırının hesap/POS bağı ve İşlem No'su — kilitli satıra "Bu Hesaba Ata" 409 alır.
  money_refs: {
    requires: ["payments.fin_ref", "cash_entries.fin_ref", "account_entries.fin_ref", "plan_entries.fin_ref", "stock_moves.fin_ref", "cheque_events.fin_ref"],
    sql: ["payments", "cash_entries", "account_entries", "plan_entries", "stock_moves", "cheque_events"]
      .map(table => `SELECT '${table}' AS t, id, fin_ref, event_id FROM ${table} WHERE date <= ?1 AND (fin_ref <> '' OR event_id <> '')`)
      .join(" UNION ALL ")
      .concat(" ORDER BY t, id"),
  },
  // fx_refs: döviz hesabına cari tahsilatı/ödemesi (13b) satırının döviz tutarı ve kuru.
  fx_refs: {
    requires: ["account_entries.fx_minor"],
    sql: "SELECT id, fx_currency, fx_minor, fx_rate_e6, fx_source FROM account_entries WHERE date <= ?1 AND (fx_currency <> '' OR fx_minor <> 0 OR fx_rate_e6 <> 0 OR fx_source <> '') ORDER BY id",
  },
  // İşlem başlığının değişmeyen alanları (durum ve ters kayıt bağı girmez: kilitli işlem bugün ters kaydedilebilir) ve fişi.
  fin_events_lock: { requires: ["fin_events"], sql: "SELECT id, type, date, reversal_of, bank_ref, counter_ref, amount_minor, try_minor FROM fin_events WHERE date <= ?1 ORDER BY id" },
  bank_lines_lock: {
    requires: ["bank_lines", "fin_events"],
    sql: "SELECT l.id, l.event_id, l.seq, l.role, l.gl, l.sub, l.ref, l.side, l.try_minor, l.currency, l.fx_minor, l.rate_e6 FROM bank_lines l JOIN fin_events e ON e.id = l.event_id WHERE e.date <= ?1 ORDER BY l.id",
  },
  // POS satışının değişmeyen alanları (durum, güncelleme ve sonradan değişebilen iade/bloke alanları girmez).
  pos_sales_lock: {
    requires: ["pos_sales"],
    sql: "SELECT id, event_id, pos_id, kind, src, origin_id, date, installments, rate_ppm, tax_kind, tax_mode, tax_ppm, fixed_minor, refund_commission, payout, block_days, bank_account_id, provider_account_id, gross_minor, commission_minor, tax_minor, net_minor, auth_code FROM pos_sales WHERE date <= ?1 ORDER BY id",
  },
  // Bankaya Tahsile Ver (§3.14): verilme ve kapanış ayrı (kilitli ayda verilen çek açık ayda tahsil edilebilir).
  cheque_collections_given: { requires: ["cheque_collections"], sql: "SELECT id, cheque_id, bank_account_id, given_date FROM cheque_collections WHERE given_date <= ?1 ORDER BY id" },
  cheque_collections_closed: { requires: ["cheque_collections"], sql: "SELECT id, status, closed_date, close_event_id FROM cheque_collections WHERE closed_date <> '' AND closed_date <= ?1 ORDER BY id" },
};

/**
 * Kapanmış dönemin parmak izi (sha256): LOCK_SQL'in her girdisi, kilit tarihi (ve öncesi) için. Gereksinim "tablo" ya da
 * "tablo.kolon"; karşılanmayan girdi atlanır (eski şema). Göç testleri ve araçlar da kullanır (v2.1.0; K11 ölçütü).
 */
export function lockDigestOf(store, lock) {
  if (!lock) return "";
  const tables = new Set(store.all("SELECT name FROM sqlite_master WHERE type = 'table'").map(row => row.name));
  const columns = new Map();
  const has = requirement => {
    const [table, column] = requirement.split(".");
    if (!tables.has(table)) return false;
    if (!column) return true;
    if (!columns.has(table)) columns.set(table, new Set(store.all(`PRAGMA table_info(${table})`).map(row => row.name)));
    return columns.get(table).has(column);
  };
  const hash = createHash("sha256");
  for (const [name, entry] of Object.entries(LOCK_SQL)) {
    const { requires, sql } = typeof entry === "string" ? { requires: [name], sql: entry } : entry;
    if (!requires.every(has)) continue;
    for (const row of store.all(sql, lock)) hash.update(`${name}|${Object.values(row).join("|")}\n`);
  }
  return hash.digest("hex");
}

export function createIntegrity({ store, ledger, accounts = () => null, stock = () => null, plans = () => null, period = () => null, money = () => null, events = null, strict = false, verify = false, log = null, newId = () => `int-${crypto.randomUUID()}`, now = systemClock }) {
  const has = table => Boolean(store.get("SELECT 1 AS found FROM sqlite_master WHERE type = 'table' AND name = ?", table));
  // v2.1.0 (§3.11): banka çekirdeğinin denetimleri (lib/bank/checks.mjs) — olay bazlı (COMMIT'te dokunulan olaylar) ve tam tarama.
  let bankChecks = null;
  const bank = () => (bankChecks ??= createBankChecks({ store, money: money() }));
  const hasColumn = (table, column) => has(table) && store.all(`PRAGMA table_info(${table})`).some(row => row.name === column);
  // İ8: eski sürümden kalan ileri tarihli satır için kullanıcının yapacağı (tablo adı yok). Çek/senet: 2.0.25'te ileri alış/veriliş
  // tarihi girilebiliyordu; Düzenle ile gerçek güne çekilir (işlem görmemiş evrakta), tahsil/ciro/ödeme tarihi ileriyse geri alınıp
  // doğru tarihle yeniden yapılır.
  function futureHint(table, rows, today) {
    if (table === "cheque_events") {
      const cheques = store.get("SELECT COUNT(DISTINCT cheque_id) AS n FROM cheque_events WHERE date > ?", today).n;
      return `Çek/Senet'te ${cheques} evrakta tarihi ileri hareket var (eski sürümden). Alış/Veriliş Tarihi ileriyse evrakın kartında Düzenle ile gerçek güne çekin; tahsil, ciro ya da ödeme tarihi ileriyse o işlemi geri alıp doğru tarihle yeniden yapın. Düzeltilmezse tarihi gelince kendiliğinden kalkar.`;
    }
    return `${labelOf(table)} içinde tarihi ileri ${rows.length} eski hareket var. Tarihi gelince kendiliğinden kalkar; tarih yanlışsa hareketi kendi kartında düzeltin.`;
  }

  /**
   * Tüm denetimler; her biri { code, name, ok, difference?, count?, sample? }.
   * scope.events: COMMIT'te dokunulan işlem başlıkları (olay bazlı denetimler yalnız bunlara; null = tam tarama). includeHidden: banka
   * kullanılmayan kurulumda gizlenen (tamam olan) banka denetimlerini de döndür (tanı ve testler için; API döndürmez).
   */
  function run({ events: touched = null, includeHidden = false } = {}) {
    const started = performance.now();
    // Bölüm süreleri (v2.1.0, §3.11 kapı ölçümü; tools/kapi-olcum.mjs): stats() ile okunur, sonuca ve API'ye girmez.
    const timings = {};
    let lapAt = started;
    const lap = name => {
      const at = performance.now();
      timings[name] = (timings[name] || 0) + at - lapAt;
      lapAt = at;
    };
    const checks = [];
    const bankItems = [];
    const service = ledger();
    let groups = null;
    if (service?.check) {
      // Cari listesi bir kez hesaplanır: Ana Defter'in beklenen bakiyeleri (120/320/336) ve cari bazında denetim aynı
      // listeyi kullanır (v2.0.22; önceden her yazmada iki kez hesaplanıyordu — aynı veri, aynı sonuç).
      const list = accounts()?.list ? accounts().list(AUDITOR, { status: "all" }).accounts : null;
      lap("accounts");
      const { reconciliation, entries, groups: moneyGroups } = service.check({ accountList: list });
      groups = moneyGroups || null;
      lap("ledger");
      checks.push({ code: "balance", name: "Çift yönlü kayıt (borç = alacak)", ok: reconciliation.balanced, difference: 0 });
      // v2.1.0 (§3.11 bank:sub, E1.16): alt hesap mutabakatı — yevmiyedeki alt hesap (102.01, 108.00 …) = tek kaynağın (yol, hesap) grubu.
      // Varlık bazında kod: bir hesaptaki sapma yalnız kendi kodunu (bank:sub:<alt hesap>) kilitler.
      if (service.expectedSubs && groups) {
        const fromLedger = subBalances(entries);
        const fromSource = service.expectedSubs(groups);
        const names = {};
        if (has("bank_accounts")) for (const row of store.all("SELECT gl_sub AS sub, code, name FROM bank_accounts")) names[row.sub] = `${row.code} · ${row.name}`;
        if (has("pos_terminals")) for (const row of store.all("SELECT gl_sub AS sub, code, name FROM pos_terminals")) names[row.sub] = `${row.code} · ${row.name}`;
        for (const sub of [...new Set([...fromLedger.keys(), ...fromSource.keys()])].sort()) {
          const got = fromLedger.get(sub) || 0;
          const want = fromSource.get(sub) || 0;
          bankItems.push({ code: `bank:sub:${sub}`, name: `Alt Hesap Mutabakatı (${sub}${names[sub] || UNASSIGNED_SUBS[sub] ? ` ${names[sub] || UNASSIGNED_SUBS[sub]}` : ""})`, ok: got === want, difference: roundMoney((got - want) / 100), ledger: roundMoney(got / 100), subledger: roundMoney(want / 100) });
        }
        lap("bank");
      }
      for (const item of reconciliation.checks) checks.push({ code: `gl:${item.code}`, name: `${item.code} ${item.name}`, ok: item.ok, difference: item.difference, ledger: item.ledger, subledger: item.subledger });
      // Cari bazında: her carinin ana defterdeki bakiyesi = cari kartındaki bakiye (toplamlar tutup kişiler arasında
      // kayma olmasın). Carisiz taksit kartları da kart bazında: kalan alacak = kart tutarı − net tahsilat.
      const parties = partyBalances(entries);
      if (list) {
        const wrong = [];
        let difference = 0;
        const seen = new Set();
        for (const account of list) {
          seen.add(account.id);
          const d = (parties.get(account.id) || 0) - toCents(account.balance);
          if (d) { wrong.push(`${account.refNo || account.id} ${account.name}: defter ${(parties.get(account.id) || 0) / 100} / kart ${account.balance}`); difference += d; }
        }
        for (const [party, value] of parties) if (!party.startsWith("plan:") && !seen.has(party) && value) { wrong.push(`${party}: listede yok, defterde ${value / 100}`); difference += value; }
        checks.push({ code: "party:accounts", name: "Cari bazında mutabakat (her cari ayrı)", ok: wrong.length === 0, count: wrong.length, difference: roundMoney(difference / 100), sample: wrong.slice(0, 5) });
      }
      if (has("plans")) {
        const wrong = [];
        for (const plan of store.all(
          `SELECT p.id, p.name, p.total, p.status, p.covers_balance AS coversBalance,
                  COALESCE((SELECT SUM(CASE WHEN e.kind = 'in' THEN e.amount ELSE -e.amount END) FROM plan_entries e WHERE e.plan_id = p.id), 0) AS paid
           FROM plans p LEFT JOIN accounts a ON a.id = p.account_id AND a.deleted_at IS NULL WHERE p.deleted_at IS NULL AND a.id IS NULL`,
        )) {
          const total = plan.coversBalance ? 0 : toCents(plan.total);
          const left = toCents(plan.total) - toCents(plan.paid);
          const want = total - toCents(plan.paid) - (plan.status === "closed" ? Math.max(0, left) : 0);
          const got = parties.get(`plan:${plan.id}`) || 0;
          if (got !== want) wrong.push(`${plan.name}: defter ${got / 100} / kart ${want / 100}`);
        }
        checks.push({ code: "party:plans", name: "Carisiz taksit kartları (kart bazında)", ok: wrong.length === 0, count: wrong.length, sample: wrong.slice(0, 5) });
      }
      lap("parties");
    }
    // Taksit alt defteri: Taksitler ekranının her kart için gösterdiği toplam ve tahsilat = kartın satırları.
    if (plans()?.list && has("plans")) {
      const raw = new Map(store.all(
        `SELECT p.id, p.total, COALESCE((SELECT SUM(CASE WHEN e.kind = 'in' THEN e.amount ELSE -e.amount END) FROM plan_entries e WHERE e.plan_id = p.id), 0) AS paid
         FROM plans p WHERE p.deleted_at IS NULL`,
      ).map(row => [row.id, row]));
      const wrong = [];
      for (const plan of plans().list(AUDITOR, { status: "all" }).plans || []) {
        const row = raw.get(plan.id);
        if (!row) continue;
        if (toCents(plan.totals.total) !== toCents(row.total) || toCents(plan.totals.paid) !== toCents(row.paid)) wrong.push(`${plan.refNo || plan.id} ${plan.name}: ekran ${plan.totals.total}/${plan.totals.paid} · satır ${row.total}/${row.paid}`);
        else if (plan.status !== "closed" && toCents(plan.totals.remaining) !== Math.max(0, toCents(row.total) - toCents(row.paid))) wrong.push(`${plan.refNo || plan.id} ${plan.name}: kalan ${plan.totals.remaining}`);
      }
      checks.push({ code: "plans:totals", name: "Taksit kartları (tutar, tahsilat, kalan)", ok: wrong.length === 0, count: wrong.length, sample: wrong.slice(0, 5) });
      lap("plans");
    }
    // Stok: ekrandaki mevcut = girişler − çıkışlar (hareketlerin kendisinden, bağımsız toplam).
    if (stock()?.list && has("stock_moves")) {
      const raw = new Map(store.all("SELECT item_id AS id, SUM(CASE WHEN kind = 'in' THEN qty ELSE -qty END) AS qty FROM stock_moves GROUP BY item_id").map(row => [row.id, row.qty]));
      const wrong = [];
      for (const item of stock().list(AUDITOR).items || []) {
        if (item.kind === "service" || item.service) continue;
        const want = Math.round((raw.get(item.id) || 0) * 1000);
        if (Math.round((Number(item.qty) || 0) * 1000) !== want) wrong.push(`${item.name}: ekran ${item.qty} / hareketler ${want / 1000}`);
      }
      checks.push({ code: "stock:qty", name: "Stok miktarı (girişler − çıkışlar)", ok: wrong.length === 0, count: wrong.length, sample: wrong.slice(0, 5) });
      lap("stock");
    }
    // Kuruş ve işaret: 12,345 TL ya da −5 TL gibi tutar yok.
    for (const [table, column, where] of AMOUNT_COLUMNS) {
      if (!hasColumn(table, column)) continue;
      const rows = store.all(`SELECT id, ${column} AS amount FROM ${table} WHERE (ABS(${column} * 100 - ROUND(${column} * 100)) > 0.0001 OR ${column} < 0)${where ? ` AND ${where}` : ""} LIMIT 5`);
      checks.push({ code: `cents:${table}`, name: `Kuruş ve işaret (${labelOf(table)})`, ok: rows.length === 0, count: rows.length, sample: rows.map(row => `${row.id}=${row.amount}`) });
    }
    lap("cents");
    if (has("stock_moves") && has("account_entries")) {
      // Açık hesaba yazılmış stok hareketi → carideki karşılığı aynı tutarda (sızıntı yok).
      const leaks = store.all(
        `SELECT m.id, m.amount, e.amount AS entryAmount FROM stock_moves m
           JOIN stock_items i ON i.id = m.item_id AND i.deleted_at IS NULL
           LEFT JOIN account_entries e ON e.source = 'stock' AND e.source_id = m.id
         WHERE m.pay = 'account' AND m.amount > 0 AND (e.id IS NULL OR ABS(e.amount - m.amount) > 0.004) LIMIT 5`,
      );
      checks.push({ code: "stock:account", name: "Stok ↔ cari bağı (açık hesap)", ok: leaks.length === 0, count: leaks.length, sample: leaks.map(row => `${row.id}: stok ${row.amount} / cari ${row.entryAmount ?? "yok"}`) });
      const orphans = store.all("SELECT e.id FROM account_entries e LEFT JOIN stock_moves m ON m.id = e.source_id WHERE e.source = 'stock' AND m.id IS NULL LIMIT 5");
      checks.push({ code: "stock:orphan", name: "Stok hareketi silinmiş cari satırı", ok: orphans.length === 0, count: orphans.length, sample: orphans.map(row => row.id) });
      const qty = store.all("SELECT id, qty FROM stock_moves WHERE NOT (qty > 0) LIMIT 5");
      checks.push({ code: "stock:qty", name: "Stok miktarı (sıfırdan büyük)", ok: qty.length === 0, count: qty.length, sample: qty.map(row => `${row.id}=${row.qty}`) });
    }
    if (has("cheques") && has("account_entries")) {
      const bad = store.all(
        `SELECT e.id, e.amount, c.amount AS chequeAmount FROM account_entries e LEFT JOIN cheques c ON c.id = e.source_id
         WHERE e.source = 'cheque' AND (c.id IS NULL OR ABS(c.amount - e.amount) > 0.004) LIMIT 5`,
      );
      checks.push({ code: "cheque:account", name: "Çek/senet ↔ cari bağı", ok: bad.length === 0, count: bad.length, sample: bad.map(row => `${row.id}: cari ${row.amount} / evrak ${row.chequeAmount ?? "yok"}`) });
    }
    // Fatura (v2.0.15): belge ↔ kalemler ↔ cari ↔ stok ↔ çek/senet ↔ taksit bağları.
    if (has("invoices") && has("invoice_lines")) {
      const c = column => `CAST(ROUND(${column} * 100) AS INTEGER)`;
      // 1. Başlık = kalemlerin toplamı (belgenin para biriminde).
      const head = store.all(
        // Takma adlar kolon adlarından ayrı (SQLite HAVING'de "net" önce kalemin net kolonunu bulur).
        `SELECT i.id, i.number, ${c("i.net_total")} AS hnet, ${c("i.vat_total")} AS hvat, ${c("i.withheld_total")} AS hwithheld, ${c("i.payable_total")} AS hpayable, ${c("i.stoppage_total")} AS hstoppage,
                COALESCE(SUM(${c("l.net")}), 0) AS lnet, COALESCE(SUM(${c("l.vat")}), 0) AS lvat, COALESCE(SUM(${c("l.withheld")}), 0) AS lwithheld, COALESCE(SUM(${c("l.payable")}), 0) AS lpayable, COUNT(l.id) AS lcount
         FROM invoices i LEFT JOIN invoice_lines l ON l.invoice_id = i.id GROUP BY i.id
         HAVING lcount = 0 OR hnet <> lnet OR hvat <> lvat OR hwithheld <> lwithheld OR hpayable <> lpayable - hstoppage LIMIT 5`,
      );
      checks.push({ code: "invoice:lines", name: "Fatura toplamı = kalemlerin toplamı", ok: head.length === 0, count: head.length, sample: head.map(row => `${row.number || row.id}: başlık ${row.hpayable / 100} (matrah ${row.hnet / 100}, KDV ${row.hvat / 100}) / kalemler ${(row.lpayable - row.hstoppage) / 100} (matrah ${row.lnet / 100}, KDV ${row.lvat / 100})`) });
      // 2. TL karşılığı: ödenecek = matrah + KDV − tevkifat − stopaj; hesap dağılımı (gl_json) matraha eşit.
      const money = store.all(`SELECT id, number, ${c("try_net")} AS net, ${c("try_vat")} AS vat, ${c("try_withheld")} AS withheld, ${c("try_stoppage")} AS stoppage, ${c("try_payable")} AS payable, gl_json AS gl FROM invoices WHERE status <> 'draft'`);
      const wrongTry = [];
      for (const row of money) {
        let gl = 0;
        try {
          gl = JSON.parse(row.gl || "[]").reduce((sum, item) => sum + Math.round(Number(item.net) || 0), 0);
        } catch {
          gl = Number.NaN;
        }
        if (row.payable !== row.net + row.vat - row.withheld - row.stoppage || gl !== row.net) wrongTry.push(`${row.number || row.id}: ödenecek ${row.payable / 100}, hesaplar ${gl / 100} / matrah ${row.net / 100}`);
      }
      checks.push({ code: "invoice:try", name: "Fatura TL karşılığı (matrah + KDV − tevkifat − stopaj)", ok: wrongTry.length === 0, count: wrongTry.length, sample: wrongTry.slice(0, 5) });
      // 3. Cari: kesilmiş faturanın cari satırı tek ve ödenecek tutar kadar; taslak/iptal faturanın cari satırı yok.
      if (has("account_entries")) {
        const party = store.all(
          `SELECT * FROM (
             SELECT i.id, i.number, i.status, i.kind, ${c("i.try_payable")} AS hpayable,
                    COALESCE((SELECT SUM(${c("e.amount")}) FROM account_entries e WHERE e.source = 'invoice' AND e.source_id = i.id AND e.kind IN ('debt', 'credit') AND e.account_id = i.account_id
                              AND e.kind = CASE WHEN i.kind IN ('sale', 'smm', 'purchase_return') THEN 'debt' ELSE 'credit' END), 0) AS posted,
                    (SELECT COUNT(*) FROM account_entries e WHERE e.source = 'invoice' AND e.source_id = i.id AND e.kind IN ('debt', 'credit')) AS postedRows,
                    (SELECT COUNT(*) FROM account_entries e WHERE e.source = 'invoice' AND e.source_id = i.id) AS anyRows
             FROM invoices i)
           WHERE (status = 'issued' AND (posted <> hpayable OR postedRows <> 1)) OR (status <> 'issued' AND anyRows > 0) LIMIT 5`,
        );
        checks.push({ code: "invoice:account", name: "Fatura ↔ cari bağı", ok: party.length === 0, count: party.length, sample: party.map(row => `${row.number || row.id} (${row.status}): fatura ${row.hpayable / 100} / cari ${row.posted / 100} (${row.postedRows} satır)`) });
        const orphans = store.all("SELECT e.id FROM account_entries e LEFT JOIN invoices i ON i.id = e.source_id WHERE e.source = 'invoice' AND i.id IS NULL LIMIT 5");
        checks.push({ code: "invoice:orphan", name: "Faturası olmayan cari satırı", ok: orphans.length === 0, count: orphans.length, sample: orphans.map(row => row.id) });
        // v2.0.17: fatura bağı ve mahsup fişi yalnız aynı carinin kesilmiş faturasına; mahsup toplamı faturayı aşmaz.
        if (has("invoice_offsets") && store.all("PRAGMA table_info(account_entries)").some(col => col.name === "invoice_id")) {
          const badLinks = store.all("SELECT e.id FROM account_entries e LEFT JOIN invoices i ON i.id = e.invoice_id WHERE e.invoice_id <> '' AND (i.id IS NULL OR i.status <> 'issued' OR i.account_id <> e.account_id) LIMIT 5");
          const badOffsets = store.all(
            `SELECT o.id FROM invoice_offsets o LEFT JOIN invoices i ON i.id = o.invoice_id
               LEFT JOIN invoices ci ON ci.id = o.counter_id AND o.counter_type = 'invoice' LEFT JOIN account_entries ce ON ce.id = o.counter_id AND o.counter_type = 'entry'
             WHERE i.id IS NULL OR i.status <> 'issued' OR i.account_id <> o.account_id OR (o.counter_type = 'invoice' AND (ci.id IS NULL OR ci.status <> 'issued' OR ci.account_id <> o.account_id))
                OR (o.counter_type = 'entry' AND (ce.id IS NULL OR ce.account_id <> o.account_id)) OR o.amount <= 0 LIMIT 5`,
          );
          const over = store.all(`SELECT i.number FROM invoices i WHERE i.status = 'issued' AND (SELECT COALESCE(SUM(${c("o.amount")}), 0) FROM invoice_offsets o WHERE o.invoice_id = i.id OR (o.counter_type = 'invoice' AND o.counter_id = i.id)) > ${c("i.try_payable")} LIMIT 5`);
          const bad = [...badLinks.map(row => `bağ ${row.id}`), ...badOffsets.map(row => `mahsup ${row.id}`), ...over.map(row => `mahsup toplamı faturayı aşıyor: ${row.number}`)];
          checks.push({ code: "invoice:offset", name: "Fatura kapama bağı ve mahsup fişleri", ok: bad.length === 0, count: bad.length, sample: bad.slice(0, 5) });
        }
      }
      // 4. Stok: kesilmiş faturanın stoklu kalemi kendi hareketine bağlı ve miktarı aynı; taslak/iptal faturanın hareketi yok.
      if (has("stock_moves")) {
        const moves = store.all(
          `SELECT l.id, i.number, l.qty, m.qty AS moved FROM invoice_lines l JOIN invoices i ON i.id = l.invoice_id AND i.status = 'issued'
             LEFT JOIN stock_moves m ON m.id = l.move_id AND m.invoice_id = i.id
           WHERE l.move_id <> '' AND (m.id IS NULL OR ABS(m.qty - l.qty) > 0.0005) LIMIT 5`,
        );
        const stray = store.all("SELECT m.id FROM stock_moves m LEFT JOIN invoices i ON i.id = m.invoice_id WHERE m.invoice_id <> '' AND (i.id IS NULL OR i.status <> 'issued') LIMIT 5");
        checks.push({ code: "invoice:stock", name: "Fatura ↔ stok bağı", ok: moves.length + stray.length === 0, count: moves.length + stray.length, sample: [...moves.map(row => `${row.number}: kalem ${row.qty} / hareket ${row.moved ?? "yok"}`), ...stray.map(row => `${row.id}: faturası kesilmiş değil`)] });
      }
      // 5. Çek/senet ve taksit: faturayla açılan evrak/kart yalnız kesilmiş faturada yaşar.
      if (has("cheques")) {
        const stray = store.all("SELECT c.id FROM cheques c LEFT JOIN invoices i ON i.id = c.invoice_id WHERE c.invoice_id <> '' AND c.deleted_at IS NULL AND (i.id IS NULL OR i.status <> 'issued') LIMIT 5");
        checks.push({ code: "invoice:cheque", name: "Fatura ↔ çek/senet bağı", ok: stray.length === 0, count: stray.length, sample: stray.map(row => row.id) });
      }
      if (hasColumn("plans", "invoice_id")) {
        const stray = store.all("SELECT p.id FROM plans p LEFT JOIN invoices i ON i.id = p.invoice_id WHERE p.invoice_id <> '' AND p.deleted_at IS NULL AND (i.id IS NULL OR i.status <> 'issued') LIMIT 5");
        checks.push({ code: "invoice:plan", name: "Fatura ↔ taksit kartı bağı", ok: stray.length === 0, count: stray.length, sample: stray.map(row => row.id) });
      }
      // 6. İade: bir kalemden iade edilen toplam miktar asıl miktarı aşmaz.
      const over = store.all(
        `SELECT o.id, i.number, o.qty, SUM(r.qty) AS returned FROM invoice_lines r JOIN invoices ri ON ri.id = r.invoice_id AND ri.status = 'issued'
           JOIN invoice_lines o ON o.id = r.origin_line_id JOIN invoices i ON i.id = o.invoice_id
         WHERE r.origin_line_id <> '' GROUP BY o.id HAVING SUM(r.qty) > o.qty + 0.0005 LIMIT 5`,
      );
      checks.push({ code: "invoice:returns", name: "İade miktarı ≤ faturadaki miktar", ok: over.length === 0, count: over.length, sample: over.map(row => `${row.number}: ${row.qty} satıldı / ${row.returned} iade`) });
    }
    lap("links");
    // Tarih: her para hareketinin tarihi dolu ve geçerli takvim günü; ileri tarihli hareket yok (eski sürümden kalanlar
    // taban sayılır, yenisi eklenemez); taksit vadesi kartın Kayıt Tarihi'nden önce değil.
    const today = period()?.today?.() || now.today();
    for (const table of DATED) {
      if (!hasColumn(table, "date")) continue;
      if (DATED_WHEN_USED.has(table) && !store.get(DATED_WHEN_USED.get(table))) continue;
      const bad = store.all(`SELECT id, date FROM ${table} WHERE date IS NULL OR trim(date) = '' OR date NOT GLOB '[0-9][0-9][0-9][0-9]-[01][0-9]-[0-3][0-9]' OR date(date) IS NULL OR date(date) <> date LIMIT 5`);
      checks.push({ code: `dates:format:${table}`, name: `Tarihsiz ya da geçersiz tarihli hareket (${labelOf(table)})`, ok: bad.length === 0, count: bad.length, sample: bad.map(row => `${row.id}=${row.date}`) });
      // v2.0.26 (A13): açılışta bulunan ileri tarihli satırlar (eski sürümden kalan) kimlikleriyle tabandır; kapının imzası yalnız
      // tabanda olmayan (yeni) ileri tarihli satırları sayar (gateCount). Önceden SAYI imzadaydı: gün geçip eski satır geçmişe
      // düştükçe sayı küçülüyor, imza tabanda olmuyor ve yeniden başlatmaya kadar bütün para işlemleri 409 alıyordu.
      // Gözden geçirme G4: eski satır denetim sonucundan gizlenmez (ok false, count hepsi, legacy eskiler): Mutabakat Testi, Defter
      // Mutabakatı ve Mutabakat Günlüğü'nde görünür; yalnız yeni işlemleri engellemez.
      const known = legacyFuture.get(table);
      const rows = store.all(`SELECT id FROM ${table} WHERE date > ?`, today);
      const fresh = known ? rows.filter(row => !known.has(row.id)).length : rows.length;
      // 2. gözden geçirme İ8: yalnız eski satır kaldıysa düzey uyarı (severity) ve ne yapılacağı (hint); ok yine false (G4: gizlenmez).
      const legacyOnly = rows.length > 0 && fresh === 0;
      checks.push({ code: `dates:future:${table}`, name: `İleri tarihli hareket (${labelOf(table)})`, ok: rows.length === 0, count: rows.length, gateCount: fresh, ...(rows.length > fresh ? { legacy: rows.length - fresh } : {}), ...(legacyOnly ? { severity: "warning", hint: futureHint(table, rows, today) } : {}) });
    }
    lap("dates");
    {
      const wrong = [];
      let legacy = 0;
      // Tek kaynağın grupları zaten hesaplandı (Ana Defter'in beklenenleri): tanınmayan yol yoksa satırlar ayrıca okunmaz.
      const unknown = groups ? groups.some(group => group.way === "unknown") : true;
      for (const item of unknown ? bank().unknownWays() : []) {
        if (legacyMethod.has(item.key)) legacy += 1;
        else wrong.push(item.sample);
      }
      // Gözden geçirme G4: eski sürümden kalan satırlar sonuçta görünür (legacy); kapı yalnız yenilere bakar (gateCount).
      const count = wrong.length + legacy;
      checks.push({ code: "money:method", name: "Tanınmayan ödeme yolu (nakit, havale/EFT, POS/kredi kartı dışında)", ok: count === 0, count, gateCount: wrong.length, ...(legacy ? { legacy } : {}), ...(legacy && !wrong.length ? { severity: "warning" } : {}), sample: wrong.slice(0, 5) });
      lap("bank");
    }
    if (hasColumn("plan_items", "due_date") && hasColumn("plans", "registered_on")) {
      const early = store.all("SELECT i.id, i.due_date AS due, p.registered_on AS start, p.name FROM plan_items i JOIN plans p ON p.id = i.plan_id AND p.deleted_at IS NULL WHERE p.registered_on <> '' AND i.due_date < p.registered_on LIMIT 5");
      const count = early.length ? store.get("SELECT COUNT(*) AS n FROM plan_items i JOIN plans p ON p.id = i.plan_id AND p.deleted_at IS NULL WHERE p.registered_on <> '' AND i.due_date < p.registered_on").n : 0;
      checks.push({ code: "dates:due-before-start", name: "Kayıt Tarihi'nden önceki taksit vadesi", ok: count === 0, count, sample: early.map(row => `${row.name}: vade ${row.due} < kayıt ${row.start}`) });
      lap("dates");
    }
    // v2.1.0 (§3.11): banka çekirdeğinin denetimleri. Olay bazlılar (bank:event, money:report) COMMIT'te yalnız dokunulan olaylara
    // (scoped: kapı tabanı değil, "eski olmayan her sapma engeller" kuralı); tam taramada (açılış, Mutabakat Testi, 15 dakikalık tarama)
    // bütün veriye uygulanır. money:event yalnız tam taramada (COMMIT'teki karşılığı store'daki K6 denetimi).
    if (bank().ready()) {
      const scoped = Boolean(touched);
      const scope = scoped ? { events: touched } : {};
      const broken = scoped && !touched.size ? [] : bank().brokenEvents(scope);
      const label = ref => store.get("SELECT code || ' · ' || name AS label FROM bank_accounts WHERE id = ?", ref)?.label || store.get("SELECT code || ' · ' || name AS label FROM pos_terminals WHERE id = ?", ref)?.label || ref;
      const eventItems = byEntity("bank:event", "İşlem Başlığı (kopya = satır)", broken, { legacy: legacyEvents, label });
      bankItems.push(...(eventItems.length ? eventItems.map(item => (scoped ? { ...item, scoped: true } : item)) : [{ code: "bank:event", name: "İşlem Başlığı (kopya = satır)", ok: true, count: 0 }]));
      const report = scoped && !touched.size ? [] : bank().reportMismatches(scope);
      bankItems.push({ code: "money:report", name: "Rapor = Özet (satır toplamı = özet, yol ve hesap bazında)", ok: report.length === 0, count: report.length, ...(scoped ? { scoped: true, gateCount: report.length } : {}), sample: report.slice(0, 5).map(item => `${item.key}: satırlar ${item.rows / 100} / özet ${item.summary / 100}`) });
      if (!scoped) {
        const eventless = bank().eventless();
        const fresh = eventless.filter(item => !legacyEventless.has(item.key));
        const old = eventless.length - fresh.length;
        bankItems.push({ code: "money:event", name: "İşlem Başlığı Olmayan Para Satırı (v20'den sonra)", ok: eventless.length === 0, count: eventless.length, gateCount: fresh.length, ...(old ? { legacy: old } : {}), ...(old && !fresh.length ? { severity: "warning", hint: "Eski sürümle girilmiş hareketler (Hesabı Belirsiz Yeni Hareketler). Banka modülünde hesaba atanabilir." } : {}), sample: eventless.slice(0, 5).map(item => item.key) });
      }
      // Görünürlük: banka kullanılmayan kurulumda Mutabakat Testi'nin denetim listesi ve sayısı 2.0.26 ile aynı kalır; banka denetimleri
      // hesap / POS / Banka Fişi tanımlanınca ya da sapma bulununca görünür.
      const visible = includeHidden || bank().inUse();
      for (const item of bankItems) if (visible || !item.ok) checks.push(item);
      lap("bank");
    }
    const failures = checks.filter(item => !item.ok);
    const total = performance.now() - started;
    lastRun = { scoped: Boolean(touched), ms: total, sections: timings };
    return { ok: failures.length === 0, checks, failures, durationMs: Math.round(total) };
  }
  let lastRun = null;
  let lastGate = null;
  // Süzgecin kararları (sayı): temiz | bulgu | tam denetim nedeni (ölçüm ve testler için).
  const gateTally = {};

  // Açılıştaki ileri tarihli satırların kimlikleri (tablo → Set); start() ölçer (A13).
  let legacyFuture = new Map();
  const measureLegacyFuture = () => {
    const today = period()?.today?.() || now.today();
    const out = new Map();
    for (const table of DATED) if (hasColumn(table, "date")) out.set(table, new Set(store.all(`SELECT id FROM ${table} WHERE date > ?`, today).map(row => row.id)));
    return out;
  };
  // Açılıştaki tanınmayan yollu eski satırlar ("tablo:id"); start() ölçer (B7).
  let legacyMethod = new Set();
  const measureLegacyMethod = () => new Set(bank().unknownWays().map(item => item.key));
  // v2.1.0: açılıştaki bozuk işlem başlıkları (eski sürümün yazdığı, onarımın düzeltemediği — kilitli dönem) ve olaysız para satırları.
  // A13 kuralı: kapı yalnız bunların dışındaki (yeni) sapmalara bakar.
  let legacyEvents = new Set();
  let legacyEventless = new Set();
  const measureLegacyBank = () => {
    if (!bank().ready()) return;
    legacyEvents = new Set(bank().brokenEvents().map(item => item.key));
    legacyEventless = new Set(bank().eventless().map(item => item.key));
  };
  // Dokunulan varlıklar yolu (v2.1.0, §3.11 kararı; lib/integrity-scope.mjs): COMMIT'te önce bu süzgeç; temizse tam kapı çalışmaz.
  let scopedGate = null;
  const gateOf = () =>
    (scopedGate ??= createScopedGate({
      store, ledger, accounts, plans, stock, money, period, now, has, hasColumn,
      amountColumns: AMOUNT_COLUMNS, dated: DATED, datedWhenUsed: DATED_WHEN_USED,
      legacy: { future: () => legacyFuture, method: () => legacyMethod, events: () => legacyEvents },
      bankChecks: bank,
    }));
  // Store dışı yazımı görmek için: kayıtlı yazımların sayısı ↔ total_changes(), data_version (start/after/rolledBack'te eşitlenir).
  let counters = null;
  const syncCounters = () => {
    try {
      counters = store.changeCounters ? store.changeCounters() : null;
    } catch {
      counters = null;
    }
  };
  // Taban sapması olan denetimlerin alanları: işlem bu alanlara dokunursa karar tam kapınındır.
  let baselineFamilies = new Set();
  const familiesOf = signatures => new Set([...signatures].map(signature => familyOf(signature.slice(0, signature.indexOf("|")))).filter(Boolean));
  // Sapmanın kimliği: hangi denetim, ne kadar/kaç satır. Aynı sapma sürüyorsa işlem engellenmez; yenisi ya da büyüyeni engellenir.
  // gateCount (G4): eski sürümden kalan satırları taşıyan denetimlerde kapının saydığı (yeni) satırlar; sonuçta count hepsidir.
  const signature = item => `${item.code}|${roundMoney(item.difference || 0)}|${item.gateCount ?? item.count ?? 0}`;
  let baseline = new Set();
  let pending = null;
  const write = (action, tables, failures) => {
    try {
      store.run(
        "INSERT INTO integrity_log (id, at, action, tables, summary, detail_json) VALUES (?, ?, ?, ?, ?, ?)",
        newId(), now().toISOString(), action, [...tables].join(","), failures.map(item => item.name).join("; ").slice(0, 500), JSON.stringify(failures).slice(0, 20000),
      );
    } catch {
      // Günlük yazılamasa da (eski şema) işlem kararı değişmez.
    }
  };

  const lockDigest = lock => lockDigestOf(store, lock);
  let lockState = { lock: "", digest: "" };
  let pendingLock = null;
  let stop = null;
  // Kapıyı kurar (yeniden çağrılırsa öncekini söküp taban durumu yeniden ölçer).
  function start() {
    stop?.();
    legacyFuture = measureLegacyFuture();
    legacyMethod = measureLegacyMethod();
    measureLegacyBank();
    const result = run();
    baseline = new Set(result.failures.map(signature));
    baselineFamilies = familiesOf(baseline);
    known = new Set(baseline);
    const lock = period()?.lockedUntil?.() || "";
    lockState = { lock, digest: lockDigest(lock) };
    syncCounters();
    if (result.failures.length) {
      log?.warn?.(`Mutabakat: güncelleme öncesinden kalan ${result.failures.length} sapma var (${result.failures.map(item => item.name).join("; ")}). Yeni işlemler bu sapmayı büyütemez.`);
      const last = has("integrity_log") ? store.get("SELECT detail_json AS detail FROM integrity_log WHERE action = 'baseline' ORDER BY at DESC LIMIT 1") : null;
      if (last?.detail !== JSON.stringify(result.failures).slice(0, 20000)) write("baseline", [], result.failures);
    }
    const remove = store.addCommitGuard({
      check({ tables, events: touched, scope: capture }) {
        const gateStarted = performance.now();
        const currentLock = period()?.lockedUntil?.() || "";
        // 1) Dokunulan varlıklar süzgeci. Temizse (sapma yok, taban alanına/kilide dokunulmuyor, store dışı yazım yok) tam kapı çalışmaz.
        let decision;
        try {
          const current = store.changeCounters ? store.changeCounters() : null;
          let full = "";
          if (!current || !counters) full = "sayaç yok";
          else if (current.version !== counters.version) full = "başka bağlantı yazdı";
          else if (current.total - counters.total !== current.tracked - counters.tracked) full = "store dışı yazım";
          else if (currentLock !== lockState.lock) full = "kilit değişti";
          if (full) decision = { full, findings: [], sections: {}, ms: 0 };
          else {
            const engine = gateOf();
            decision = engine.evaluate(engine.derive(capture), { lock: currentLock, baselineFamilies });
          }
        } catch (error) {
          if (verify) throw error;
          log?.warn?.(`Mutabakat: dokunulan varlıklar süzgeci çalışmadı (${error.message}); tam denetim.`);
          decision = { full: `süzgeç hatası: ${error.message}`, findings: [], sections: {}, ms: 0 };
        }
        const clean = !decision.full && !decision.findings.length;
        const tally = clean ? "temiz" : decision.full ? decision.full.replace(/ \(.*$/, "").replace(/:.*$/, "") : "bulgu";
        gateTally[tally] = (gateTally[tally] || 0) + 1;
        if (clean && !verify) {
          pending = null;
          pendingLock = null;
          lastGate = { path: "scoped", ms: performance.now() - gateStarted, runMs: 0, lockMs: 0, sections: { scoped: decision.ms, ...Object.fromEntries(Object.entries(decision.sections || {}).map(([key, value]) => [`s.${key}`, value])) }, events: touched?.size || 0, tables: [...tables], rejected: false, scope: decision.scope };
          return;
        }
        // 2) Tam kapı (2.0.26 kuralı): karar bunun.
        const result = run({ events: touched || new Set() });
        const runMs = performance.now() - gateStarted;
        // Olay bazlı (scoped) denetim tabana bakmaz: dokunulan olayda eski olmayan her sapma engeller.
        const fresh = result.failures.filter(item => (item.scoped ? (item.gateCount ?? item.count ?? 0) > 0 : !baseline.has(signature(item))));
        // Kapanmış dönem: kilit aynıyken kilit altındaki satırlar değişmiş olamaz.
        const lock = period()?.lockedUntil?.() || "";
        const lockStarted = performance.now();
        const digest = lock ? lockDigest(lock) : "";
        const lockMs = performance.now() - lockStarted;
        if (lock && lock === lockState.lock && digest !== lockState.digest) fresh.push({ code: "period-lock", name: `Kapanmış dönem (${lock} ve öncesi) değişemez`, ok: false, count: 1 });
        pendingLock = { lock, digest };
        lastGate = { path: "full", reason: decision.full || (decision.findings.length ? `bulgu: ${[...new Set(decision.findings.map(item => item.code))].join(", ")}` : "doğrulama"), ms: performance.now() - gateStarted, runMs, lockMs, sections: { ...(lastRun?.sections || {}), lock: lockMs, scoped: decision.ms || 0 }, events: touched?.size || 0, tables: [...tables], rejected: fresh.length > 0, scope: decision.scope };
        // Testler (gateVerify): süzgeç temiz dediyse tam kapı da kabul etmeli (yoksa süzgeç eksik: eşdeğerlik ihlali).
        if (verify && clean && fresh.length) {
          pending = null;
          throw new GateEquivalenceError(fresh, decision);
        }
        if (fresh.length) {
          pending = null;
          throw new IntegrityError(fresh.map(item => ({ ...item, tables: [...tables] })));
        }
        pending = result;
      },
      after() {
        if (pending) {
          baseline = new Set(pending.failures.map(signature));
          baselineFamilies = familiesOf(baseline);
        }
        if (pendingLock) lockState = pendingLock;
        pending = null;
        pendingLock = null;
        syncCounters();
      },
      rolledBack({ tables, error }) {
        pending = null;
        syncCounters();
        if (error instanceof IntegrityError) {
          write("rolled-back", tables, error.failures);
          log?.warn?.(`Mutabakat: işlem geri alındı (${error.failures.map(item => item.name).join("; ")}).`);
        }
      },
    });
    stop = remove;
    return { remove, baseline: result };
  }

  // ---------- Tam tarama (v2.1.0, §3.11 "Kapı ölçeği" 1) ----------
  // Açılışta (start), Mutabakat Testi'nde ve 15 dakikada bir arka planda SALT OKUMA olarak koşar. Kapının görmediği değişikliği (eski
  // sürüm, elle düzenleme, üretim kipinde K6'nın yalnız günlüğe yazdığı ham yazım) yakalar. Bulduğu yeni sapma geri alınamaz: integrity_log
  // ("scan") + zil olayı (integrity.alert, yöneticiler) + sunucu günlüğü; aynı sapma bir sonraki taramada yinelenmez. known: açılışta ve
  // önceki taramalarda görülen sapma imzaları (COMMIT tabanından bağımsız; olay bazlı denetimlerin taban olmaması tarama sonucunu değiştirmez).
  let known = new Set();
  let lastScan = null;
  function scan() {
    const result = run();
    const current = new Set(result.failures.map(signature));
    const findings = result.failures.filter(item => !known.has(signature(item)));
    known = current;
    if (findings.length) {
      write("scan", [], findings);
      const names = findings.map(item => item.name).join("; ");
      (strict ? log?.error : log?.warn)?.call(log, `Mutabakat taraması: kapının görmediği ${findings.length} yeni sapma (${names}).`);
      try {
        // Zil yalnız yöneticilere (sapmanın adı ve tutarı yönetim bilgisidir).
        const admins = has("users") ? store.all("SELECT id FROM users WHERE role = 'admin' AND active = 1").map(row => row.id) : [];
        events?.publish?.("integrity.alert", { at: now().toISOString(), findings: findings.map(item => ({ code: item.code, name: item.name, count: item.count ?? 0, difference: item.difference ?? 0 })) }, { users: admins });
      } catch {
        // zil yayımlanamasa da kayıt yazıldı
      }
    }
    lastScan = { at: now().toISOString(), findings: findings.map(item => item.code) };
    return { findings, result };
  }

  return {
    run,
    start,
    scan,
    get lastScan() {
      return lastScan;
    },
    /** Son çalışmanın ve son kapının süreleri (ms; bölüm bölüm). Ölçüm aracı (tools/kapi-olcum.mjs) ve testler okur. */
    stats: () => ({ run: lastRun, gate: lastGate, tally: { ...gateTally } }),
    /** Dokunulan varlıklar süzgeci (lib/integrity-scope.mjs; ölçüm aracı ve eşdeğerlik testleri). */
    scopedGate: () => gateOf(),
    recent: (limit = 200) => (has("integrity_log") ? store.all("SELECT id, at, action, tables, summary, detail_json AS detail FROM integrity_log ORDER BY at DESC LIMIT ?", limit) : []),
  };
}
