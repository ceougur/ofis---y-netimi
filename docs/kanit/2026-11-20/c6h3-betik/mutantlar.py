# Ç6-HESAP tur 3 — mutantlar SON kodda (görev metni İş 5 + İş 2 "karşı mutantlar DEĞERLE"). Tur 1 (docs/kanit/2026-11-19/c6h1-betik/mutantlar.py) ve tur 2
# (docs/kanit/2026-11-20/c6h2-betik/mutantlar.py) listeleri AYNEN; hedef metni tur 3'te değişenler aynı anlamla yeni metne taşındı (adın sonunda "'"; satır sonunda not).
# Tur 3 (B-g (b)) mutantları E1–E13. Her mutant: (dosya, eski, yeni). Kullanım: python3 -I mutantlar.py <kopya kökü> <ad> | python3 -I mutantlar.py x --liste
import sys

FS = "server/lib/financial-statements.mjs"
SV = "server/lib/stock-valuation.mjs"
LS = "server/lib/ledger-snapshots.mjs"
M = {
    # ---- tur 1 ----
    "T1-M1-7A-yansitma-yok": (FS, "if (REFLECT[code]) {", "if (false && REFLECT[code]) {"),
    "T1-M2-iade-ters-isaret": (FS, "const sign = item.gelir ? -1 : 1;", "const sign = item.gelir || item.kod === \"B\" ? -1 : 1;"),
    "T1-M3-alis-iadesi-dusulmez": (SV, "const num = BigInt(prior.vMinor + acc.openV + acc.buyV - acc.retV);\n    const den = BigInt(q0 + acc.openQ + acc.buyQ - acc.retQ);",
                                   "const num = BigInt(prior.vMinor + acc.openV + acc.buyV);\n    const den = BigInt(q0 + acc.openQ + acc.buyQ);"),
    "T1-M4-KG9-eksi-deger": (SV, "if (qMilli > 0 && !deleted) {", "if (qMilli !== 0 && !deleted) {"),
    "T1-M5-donem-siniri-kayik": (FS, "if (entry.date < from || entry.date > to) continue;\n    count += 1;", "if (entry.date <= from || entry.date > to) continue;\n    count += 1;"),
    "T1-M6-kapanis-sinifi-dahil": (FS, "    if (entryClass(entry) === CLOSING_CLASS) continue;\n    for (const line of entry.lines) addLine(", "    for (const line of entry.lines) addLine("),
    "T1-M7-90-ana-satira'": (FS, "const source = isUnclassifiedSub(sub) ? sub : account;", "const source = account;"),  # tur 3: addLine (iki yolun ortağı)
    "T1-M8-kilitli-canli-okur'": (FS, "    frozen = part.years.get(Number(start.slice(0, 4))) || emptyFrozenYear(Number(start.slice(0, 4)), from);",
                                  "    entries = live;\n    frozen = null;"),  # tur 3: Gelir Tablosu ucu donmuş toplam yerine canlı türetme
    "T1-M9-DBS-onceki-yildan-alinmaz": (SV, "const prior = year - 1 < firstYear ? base : endOf(year - 1);", "const prior = base;"),
    "T1-M10-T-a1-yok'": (FS, "const tBefore = first ? 0 : T(dayBefore(from), atA);", "const tBefore = 0;"),  # tur 2'de satır biçimi değişmişti
    "T1-M11-G1-kesme": (SV, "const q = (2n * a + d) / (2n * d);", "const q = a / d;"),
    "T1-M12-KG10-kart-fiyati-yok": (SV, "else vMinor = Number(roundDiv(BigInt(qMilli) * BigInt(item.unitPriceE4), BigInt(QTY_SCALE * 100)));", "else vMinor = 0;"),
    "T1-M13-silinen-urun-sayilir": (SV, "const deleted = Boolean(item.deletedDay) && item.deletedDay <= day;", "const deleted = false;"),
    "T1-M14-N01-153-akisina": (FS, "if (cls === CLOSING_CLASS || cls === PERIOD_END_CLASS) continue;", "if (cls === CLOSING_CLASS) continue;"),
    "T1-M15-kural-farki-gorulmez": (FS, "    if (row.frozen === row.live) continue;\n    const [year, account] = key.split(\"|\");", "    continue;\n    const [year, account] = key.split(\"|\");"),
    # ---- tur 2 ----
    "T2-M1-netlestirme": (FS, "        const reversed = normalDebit(item) ? group.minor < 0 : group.minor > 0;\n        const [kalemKod", "        const reversed = false;\n        const [kalemKod"),
    "T2-M2-120-yerinde": (FS, "        const reversed = normalDebit(item) ? group.minor < 0 : group.minor > 0;\n        const [kalemKod",
                          "        const reversed = account !== \"120\" && (normalDebit(item) ? group.minor < 0 : group.minor > 0);\n        const [kalemKod"),
    "T2-M3-duzenleyici-isaret": (FS, "    const value = sideSign(kalem.taraf) * minor;", "    const value = sideSign(kalem.taraf) * minor * (balanceSheetItemOf(account)?.duzenleyici ? -1 : 1);"),
    "T2-M4a-dnk-ayri-formul": (FS, "tutarMinor: current.subtotals.donemNetKari, tahmini: current.smm.estimated };", "tutarMinor: current.subtotals.donemNetKari + current.smm.minor, tahmini: current.smm.estimated };"),
    "T2-M4b-dnk-bir-gun'": (FS, "from: `${year}-01-01`, to: date, bookType, ruleDiff, frozen: frozen?.years.get(year) || null })",
                            "from: `${year}-01-01`, to: date > `${year}-01-01` ? dayBefore(date) : date, bookType, ruleDiff, frozen: frozen?.years.get(year) || null })"),
    "T2-M5-kapanmis-yili-say": (FS, "for (let y = Math.max(closedYear + 1, Number.isFinite(firstYear) ? firstYear : year); y < year; y += 1) {", "for (let y = Number.isFinite(firstYear) ? firstYear : year; y < year; y += 1) {"),
    "T2-M6-153-defterden": (FS, "  const stockKesin = !currentOpen || current.smm.posted;", "  const stockKesin = true;"),
    "T2-M7a-borclu-360-dus": (FS, "        if (reversed && account === \"360\") debitTax = true;", ""),
    "T2-M7b-aktif-pasif-dus": (FS, "    balanceDiffMinor: farkMinor,", "    balanceDiffMinor: 0,"),
    "T2-M7c-mutabakat-dus": (FS, "reconciliation: checked.reconciliation, partyNames, frozen });", "reconciliation: undefined, partyNames, frozen });"),
    "T2-M7d-kapanmamis-yil-dus": (FS, "    openYears: priorYears.map(row => row.yil),", "    openYears: [],"),
    "T2-M8-ba-n01-ara-parcada'": (FS, "  const posted621 = to === yearEnd && (Boolean(frozen?.has621) || entries.some(", "  const posted621 = (Boolean(frozen?.has621) || entries.some("),
    "T2-M9-s209-kirpma-yok": (SV, "    if (den > 0n && num < 0n) {\n      clippedMinor = vMinor;", "    if (false) {\n      clippedMinor = vMinor;"),
    "T2-M10-kilitli-canli'": (FS, "  const frozen = cover ? frozenPartOf(frozenSums(store, { from: \"\", through })) : null;\n  const entries = !cover ? ledger.book({ to: date, live }) : date > cover ? ledger.book({ from: dayAfter(cover), to: date, live }) : [];",
                              "  const frozen = null;\n  const entries = live.filter(entry => entry.date <= date);"),  # tur 3: Bilanço donmuş toplam yerine canlı
    "T2-M11-ters-kayit-sayilmaz": (FS, "       AND NOT EXISTS (SELECT 1 FROM ledger_vouchers r WHERE r.reversal_of = v.id AND r.date <= ?1)`,", "       `,"),
    # ---- tur 3 (B-g (b)) ----
    "E1a-donmus-son-gun-dusar": (LS, "FROM ledger_snapshots WHERE date >= ?1 AND date <= ?2 GROUP BY 1, 2, 3, 4, account, sub, party`", "FROM ledger_snapshots WHERE date >= ?1 AND date < ?2 GROUP BY 1, 2, 3, 4, account, sub, party`"),
    "E1b-kapsam-bir-gun-geri": (FS, "  const through = cover ? (date < cover ? date : cover) : \"\";", "  const through = cover ? (date < cover ? date : dayBefore(cover)) : \"\";"),
    "E1c-gt-kapsam-bir-gun-ileri": (FS, "    const through = to < cover ? to : cover;\n    const part = frozenPartOf(", "    const through = to < cover ? to : dayAfter(cover);\n    const part = frozenPartOf("),
    "E3-alt-hesap-atla": (LS, "            account, sub, party, SUM(debit_minor - credit_minor) AS net,", "            account, '' AS sub, party, SUM(debit_minor - credit_minor) AS net,"),
    "E4-cari-atla": (LS, "            account, sub, party, SUM(debit_minor - credit_minor) AS net,", "            account, sub, '' AS party, SUM(debit_minor - credit_minor) AS net,"),
    "E5a-bilanco-kural-farki-dus": (FS, "  const ruleDiff = cover ? periodRuleDiff({ frozen: entries, frozenSums: frozen, live, from: \"\", to: through, accounts: () => true }) : null;", "  const ruleDiff = null;"),
    "E5b-gt-kural-farki-dus": (FS, "    ruleDiff = periodRuleDiff({ frozen: entries, frozenSums: part, live, from: start, to: through });", "    ruleDiff = null;"),
    "E5c-donmus-kural-tarafi-yok": (FS, "      for (const [account, net] of part.rule) {", "      for (const [account, net] of []) {"),
    "E6-sinif-kimlikten-degil": (FS, "    const cls = JOURNAL_CLASS[row.prefix] ?? 90;\n    const key = ", "    const cls = 90;\n    const key = "),
    "E7-fis-ayrimi-yok": (FS, "    if (!row.voucher) part.rule.set(", "    if (true) part.rule.set("),
    "E8-dengesiz-madde-sayilmaz": (FS, "      unbalanced += part.unbalanced;\n", ""),
    "E9-ilk-gorunus-sirasi-yok": (FS, "    for (const account of frozen.unclassifiedOrder) unclassified.set(account, 0); // ilk görünüş sırası (eski okumayla aynı ayrıntı sırası)\n", ""),
    "E10-153-donem-sonu-dahil": (FS, "    if (cls !== PERIOD_END_CLASS && row.account === \"153\") part.flow153", "    if (row.account === \"153\") part.flow153"),
    "E11-kapanis-gt-dahil": (FS, "      if (row.last > closingDay) closingDay = row.last;\n      continue;\n    }", "      if (row.last > closingDay) closingDay = row.last;\n    }"),
    "E12-gt-kisim-ayraci-yok": (FS, "frozenSums(store, { from: start, through, split: from })", "frozenSums(store, { from: start, through, split: start })"),
    "E13-kapsam-sonrasi-yok": (FS, "date > cover ? ledger.book({ from: dayAfter(cover), to: date, live }) : [];", "[];"),
    "E14-madde-sayisi-yok": (FS, "      frozenEntries += part.entries;\n", ""),
}

if __name__ == "__main__":
    root, name = sys.argv[1], sys.argv[2]
    if name == "--liste":
        for key in M:
            print(key)
        sys.exit(0)
    path, old, new = M[name]
    full = f"{root}/{path}"
    text = open(full, encoding="utf-8").read()
    if text.count(old) != 1:
        print(f"MUTANT UYGULANAMADI {name}: {text.count(old)} eşleşme")
        sys.exit(2)
    open(full, "w", encoding="utf-8").write(text.replace(old, new))
    print(f"uygulandı {name}")
