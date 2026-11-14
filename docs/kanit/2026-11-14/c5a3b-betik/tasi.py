# Ç5-A tur 3b — taşıma: satır aralıkları tabandakiyle AYNEN yeni dosyaya; kaynakta yalnız tanım yerine örnek satırı ve iki çağrı.
# Kullanım: python3 -I tasi.py <ağaç kökü>
import sys, os
root = sys.argv[1]
P = os.path.join(root, "server/routes/plans.mjs")
A = os.path.join(root, "server/routes/accounts.mjs")
L = os.path.join(root, "server/lib/account-lines.mjs")
pl = open(P, encoding="utf-8").read().split("\n")
ac = open(A, encoding="utf-8").read().split("\n")
r = lambda lines, a, b: lines[a - 1:b]  # 1 tabanlı, iki uç dahil

# --- denetimler (taban satırları) ---
assert pl[1637].startswith("  // v2.0.24: iadelerin Mevcut Borç kartlarından"), pl[1637]
assert pl[1748] == "    return out;" and pl[1749] == "  }" and pl[1750].startswith("  function forAccount("), pl[1750]
assert pl[1721].startswith("  // Mizan (v2.0.7): tüm carilerin kartları")
assert ac[43].startswith("// 2.4.5 KS7 (a)") and ac[44].startswith("const STOCK_REASON_SQL = ")
assert ac[137].startswith("  const entriesOf = accountId =>") and ac[144] == "    );", ac[144]
assert ac[1747] == "    const entries = new Map();" and ac[1752] == "    }"
assert ac[1753].startswith("    const planMap = planMapIn ||")
assert ac[1754] == "    const lines = new Map();" and ac[1755].startswith("    for (const row of rows) lines.set(row.id, accountLedger(")

plansBlock = r(pl, 1638, 1750)
reasonBlock = r(ac, 44, 45)
entriesBlock = r(ac, 138, 145)
loopBlock = r(ac, 1748, 1753)
linesBlock = r(ac, 1755, 1756)

head = [
    "// 2.5.0 Ç5-A tur 3b (tasarım notu docs/erp/C5-ACILIS-TASARIM.md §18.11; BAŞ MİMAR KARARI 14.11 — §18.9 (4) (i)): carinin SATIRLARINI kuran zincir — yalnız store ile kurulur",
    "// (servis ağacı yok). Gövdeler AYNEN taşındı (girinti aynı; kapanış değişkeni yalnız store): routes/accounts.mjs'ten STOCK_REASON_SQL, entriesOf ve allLedgers'ın satır okuma /",
    "// accountLedger döngüleri (entriesByAccount, ledgerLinesOf); routes/plans.mjs'ten iade kesimleri (returnCuts / scanReturnCuts + bellek), satış kaynağı (saleSources + bellek) ve",
    "// kart haritası (ledgerPlansByAccount). Bellekler ÖRNEKTE (modül düzeyinde değil — iki şirket aynı süreçte): taksit servisi kayıt anında BİR örnek kurar (bellek ömrü aynı);",
    "// lib/obligation-input.mjs kendi örneğini gerekince kurar (kuyruğun kendi kendine kuran yolu). İçe aktarım yalnız lib/accounts.mjs ve lib/money.mjs (lib/bank/doubtful.mjs yok — döngü yok).",
    'import { accountLedger } from "./accounts.mjs";',
    'import { roundMoney } from "./money.mjs";',
    "",
]
lib = head + reasonBlock + ["", "export function createAccountLines({ store }) {"] + entriesBlock + [
    "  function entriesByAccount(scope, args) {"] + loopBlock + ["    return entries;", "  }",
    "  function ledgerLinesOf(rows, entries, planMap) {"] + linesBlock + ["    return lines;", "  }"] + plansBlock + [
    "  return { entriesOf, entriesByAccount, ledgerLinesOf, returnCuts, scanReturnCuts, saleSources, ledgerPlansByAccount };",
    "}",
    "",
]
open(L, "w", encoding="utf-8").write("\n".join(lib))

# --- plans.mjs: blok → tek örnek satırı; içe aktarım ---
pl2 = pl[:1637] + ["  const { returnCuts, saleSources, ledgerPlansByAccount } = createAccountLines({ store });"] + pl[1750:]
imp = 'import { allocate, dayText, daysUntil, distribute, isoDay, mapHeaders, parseDay } from "../lib/plans.mjs";'
i = pl2.index(imp)
pl2.insert(i + 1, 'import { createAccountLines } from "../lib/account-lines.mjs";')
open(P, "w", encoding="utf-8").write("\n".join(pl2))

# --- accounts.mjs (sondan başa: satır numaraları kaymasın) ---
ac2 = list(ac)
ac2[1754:1756] = ["    const lines = ledgerLinesOf(rows, entries, planMap);"]
ac2[1747:1753] = ["    const entries = entriesByAccount(scope, args);"]
ac2[137:145] = ["  const { entriesOf, entriesByAccount, ledgerLinesOf } = createAccountLines({ store });"]
del ac2[43:45]
imp = 'import { ACCOUNT_TYPES, TYPE_DEFAULT, accountLedger, accountTypeKey, balanceSide, classifyAccountType, isAccountType, mapAccountHeaders } from "../lib/accounts.mjs";'
i = ac2.index(imp)
ac2.insert(i + 1, 'import { createAccountLines } from "../lib/account-lines.mjs";')
open(A, "w", encoding="utf-8").write("\n".join(ac2))

# --- bayt bayt: taşınan her blok yeni dosyada ardışık ve aynen; kaynakta artık yok ---
new = open(L, encoding="utf-8").read()
for name, block in [("plans", plansBlock), ("reason", reasonBlock), ("entries", entriesBlock), ("loop", loopBlock), ("lines", linesBlock)]:
    t = "\n".join(block) + "\n"
    assert new.count(t) == 1, name
print("taşındı:", len(plansBlock) + len(reasonBlock) + len(entriesBlock) + len(loopBlock) + len(linesBlock), "satır;", "lib", len(lib), "satır")
