import sys
p = sys.argv[1]
s = open(p, encoding="utf-8").read()
a = 'const OI = "server/lib/obligation-input.mjs";\n'
assert s.count(a) == 1
s = s.replace(a, a + 'const AL = "server/lib/account-lines.mjs"; // 2.5.0 Ç5-A tur 3b: carinin satırlarını kuran zincir (§18.11)\n')
b = '''  [14, "toplu yolda mahsuplar okunmaz", [[OI, "    const offsets = (tables.offsetsOf.get(accountId) || [])", "    const offsets = ([])"]]],
];'''
assert s.count(b) == 1
new = r'''  [14, "toplu yolda mahsuplar okunmaz", [[OI, "    const offsets = (tables.offsetsOf.get(accountId) || [])", "    const offsets = ([])"]]],
  // Tur 3b — taşınan zincir (lib/account-lines.mjs) ve modülün satırları kendisi kuran yolu. Zincir mutantlarını servis de kullanır → değer iletisi hakemden ("hakemden farklı çıktı")
  // ya da iki ayrı yolun karşılaştırmasından ("allObligations = obligationsFor"). Yalnız modülün kendi kuran yoluna konan mutantta (M22, M26) servis değişmez → "modül … = servis" iletisi değerdir.
  [15, "kart haritasında bir kart atlanır (ilk kart)", [[AL, "    for (const plan of plans) {\n      const own = entries.get(plan.id) || [];", "    for (const plan of plans.slice(1)) {\n      const own = entries.get(plan.id) || [];"]]],
  [16, "silinmiş (Silinenler'deki) kart kart haritasına girer", [[AL, "FROM plans WHERE deleted_at IS NULL AND account_id <> ''", "FROM plans WHERE account_id <> ''"]]],
  [17, "iade kesimi kayar (tutarın yarısı)", [[AL, "(out.get(planId) || 0) + (Number(cut) || 0)));", "(out.get(planId) || 0) + (Number(cut) || 0) / 2));"]]],
  [18, "satış kaynağı boş verilir (satışla açılan kart tanınmaz)", [[AL, "        if (move) found.set(row.planId, move);", "        if (false) found.set(row.planId, move);"]]],
  [19, "cari kartının satır okuyucusunda Kapatılacak Fatura bağı düşer", [[AL, "e.invoice_id AS invoiceId, e.fin_ref AS finRef", "'' AS invoiceId, e.fin_ref AS finRef"]]],
  [20, "toplu satır okuyucuda Kapatılacak Fatura bağı düşer", [[AL, "e.invoice_id AS invoiceId, e.refund_of AS refundOf", "'' AS invoiceId, e.refund_of AS refundOf"]]],
  [21, "toplu defter satırları kart haritası olmadan kurulur", [[AL, "accountLedger(entries.get(row.id) || [], planMap.get(row.id) || [])", "accountLedger(entries.get(row.id) || [], [])"]]],
  [22, "modülün kendi kurduğu cari kümesine silinmiş cari girer", [[OI, "SELECT id FROM accounts WHERE deleted_at IS NULL${scope", "SELECT id FROM accounts WHERE 1 = 1${scope"]], /cari kümesi = (allLedgers|allObligations)'ın cari kümesi/],
  [23, "modül düzeyi TEKİL örnek — iki şirketin satırları karışır (ilk kurulan şirketin store'u)", [[AL, "export function createAccountLines({ store }) {\n", "let SHARED = null;\nexport function createAccountLines({ store: own }) {\n  const store = (SHARED ||= own);\n"]]],
  [24, "iade kesimi belleği bayat (anahtar sabit — iade sonrası eski kesinti)", [[AL, "    const stamp = `${counters.total}|${counters.version}`;", "    const stamp = \"sabit\";"]]],
  [25, "satış kaynağı belleğe boş yazılır (ilk okumadan sonra satışla açılan kart tanınmaz)", [[AL, "        if (!store.inTransaction) saleSourceCache.set(id, move);", "        if (!store.inTransaction) saleSourceCache.set(id, \"\");"]]],
  [26, "modülün tek cari yolu satırları kurmaz (satırsız girdi)", [[OI, "ledger || ledgerLines({ ids: [accountId] }).get(accountId) || []", "ledger || []"]], /modül \(yalnız store, satırları kendisi; tek cari\) = servis obligationsFor/],
];'''
s = s.replace(b, new)
open(p, "w", encoding="utf-8").write(s)
print("ok")
