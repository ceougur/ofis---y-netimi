# Ç6-HESAP tur 4 — DEĞER mutantları (görev metni İş 7): her mutant ayrı bir kopyada, tek değişiklik. Kullanım: python3 -I mutantlar.py <kopya kökü> <mutant adı>
import sys
root, name = sys.argv[1], sys.argv[2]
FS = "server/lib/financial-statements.mjs"
SV = "server/lib/stock-valuation.mjs"
LS = "server/lib/ledger-snapshots.mjs"
M = {
    # ORTA-1: alt hesabı anahtardan düşür
    "m1-alt-hesap-yok": (FS, "const keyOf = (year, account, sub, who) => `${year}|${account}|${sub || \"\"}${party ? `|${who || \"\"}` : \"\"}`;",
                         "const keyOf = (year, account, sub, who) => `${year}|${account}|${\"\"}${party ? `|${who || \"\"}` : \"\"}`;"),
    # ORTA-2: yazılmış fişi düşme (KALAN fişsiz hesaplanır)
    "m2-fis-dusulmez": (FS, "const plan = ruleDiffCorrectionPlan({ diff: { entries }, subledger, year: ruleDiffCorrectionYear({ lock, cover }), postedByYear: posted.byYear });",
                        "const plan = ruleDiffCorrectionPlan({ diff: { entries }, subledger, year: ruleDiffCorrectionYear({ lock, cover }), postedByYear: new Map() });"),
    # ORTA-2: KALAN'ı yanlış yılla düş (fişlerin yılı bir eksik)
    "m3-yanlis-yil": (FS, "    const year = Number(row.year);\n    if (!byYear.has(year)) byYear.set(year, new Map());",
                      "    const year = Number(row.year) - 1;\n    if (!byYear.has(year)) byYear.set(year, new Map());"),
    # ORTA-2: tarih süzgeci yok (t'den sonraki ters kayıt da sayılır)
    "m4-tarih-suzgeci-yok": (FS, "WHERE v.date <= ?1 AND (v.type = 'rule-diff-correction' OR (v.type = 'reversal' AND o.type = 'rule-diff-correction'))",
                             "WHERE ?1 = ?1 AND (v.type = 'rule-diff-correction' OR (v.type = 'reversal' AND o.type = 'rule-diff-correction'))"),
    # ORTA-2 eşdeğerlik dişi: hızlı yolun girdisi cari boyutunu kaybeder (alt defter dışlaması bozulur)
    "m5-hizli-yol-carisiz": (FS, "deltas: [{ year: row.year, account: row.account, sub: row.sub || \"\", party: row.party || \"\", minor: row.differenceMinor }] }));\n  const plan",
                             "deltas: [{ year: row.year, account: row.account, sub: row.sub || \"\", party: \"\", minor: row.differenceMinor }] })).filter(entry => !/^[67]/.test(entry.deltas[0].account));\n  const plan"),
    # S236: donmuş girdi yerine güncel kartı oku
    "m6-guncel-kart": (SV, "    if (!frozenCover || day > frozenCover) return item;", "    return item;"),
    # S236: kapsam sınırında bir gün kaydır (kapsam günü güncel kartla)
    "m7-sinir-kayik": (SV, "    if (!frozenCover || day > frozenCover) return item;", "    if (!frozenCover || day >= frozenCover) return item;"),
    # S236: çözülünce donmuşu okumaya devam et (kapsam yokken / geri çekilince de bütün tamamlanmış koşular)
    "m8-cozulunce-donmus": (LS, "  if (!cover) return { cover: \"\", runs: [] };\n  const runs = new Map();",
                            "  const runs = new Map();"),
}
M["m8-cozulunce-donmus"] = (LS, "  if (!cover) return { cover: \"\", runs: [] };\n  const runs = new Map();\n  for (const row of store.all(\n    `SELECT r.no, r.from_date AS fromDate, r.through, s.item_id AS itemId, s.kind, s.unit_price AS unitPrice, s.deleted_at AS deletedAt\n     FROM ledger_snapshot_runs r JOIN ledger_valuation_cards s ON s.run = r.no WHERE r.kind = 'freeze' AND r.state = 'done' AND r.from_date < ? ORDER BY r.no DESC`,\n    cover,\n  )) {",
                            "  const runs = new Map();\n  for (const row of store.all(\n    `SELECT r.no, r.from_date AS fromDate, r.through, s.item_id AS itemId, s.kind, s.unit_price AS unitPrice, s.deleted_at AS deletedAt\n     FROM ledger_snapshot_runs r JOIN ledger_valuation_cards s ON s.run = r.no WHERE r.kind = 'freeze' AND r.state = 'done' AND r.from_date < ? ORDER BY r.no DESC`,\n    '9999-12-31',\n  )) {")
# m8: kapsamı da sonsuz say (okuyucu kapsamı yok sayar)
M8_COVER = ("  return { cover, runs: [...runs.values()] };\n}", "  return { cover: '9999-12-31', runs: [...runs.values()] };\n}")
if name == "liste":
    print(" ".join(M))
    sys.exit(0)
rel, old, new = M[name]
p = f"{root}/{rel}"
s = open(p, encoding="utf-8").read()
assert s.count(old) == 1, (name, s.count(old))
s = s.replace(old, new)
if name == "m8-cozulunce-donmus":
    assert s.count(M8_COVER[0]) == 1
    s = s.replace(*M8_COVER)
open(p, "w", encoding="utf-8").write(s)
print("mutant", name)
