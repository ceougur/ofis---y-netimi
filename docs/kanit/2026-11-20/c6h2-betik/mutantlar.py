# Ç6-HESAP tur 2 — karşı mutantlar (görev metni "Kanıt" — DEĞERLE). Her mutant: (ad, dosya, eski, yeni, koşulacak testler). Kullanım: python3 -I mutantlar.py <kopya kökü> <ad>  → uygular.
import sys

FS = "server/lib/financial-statements.mjs"
SV = "server/lib/stock-valuation.mjs"
SAF = "test/c6h-bilanco.test.mjs test/c6h-ba.test.mjs test/c6h-s209.test.mjs test/c6h-gelir-tablosu.test.mjs test/c6h-degerleme.test.mjs"
UC = "test/c6h-bilanco-uc.test.mjs"
M = {
    "M1-netlestirme": (FS, "        const reversed = normalDebit(item) ? group.minor < 0 : group.minor > 0;\n        const [kalemKod",
                       "        const reversed = false;\n        const [kalemKod", SAF),
    "M2-120-yerinde": (FS, "        const reversed = normalDebit(item) ? group.minor < 0 : group.minor > 0;\n        const [kalemKod",
                       "        const reversed = account !== \"120\" && (normalDebit(item) ? group.minor < 0 : group.minor > 0);\n        const [kalemKod", SAF),
    "M3-duzenleyici-isaret": (FS, "    const value = sideSign(kalem.taraf) * minor;",
                              "    const value = sideSign(kalem.taraf) * minor * (balanceSheetItemOf(account)?.duzenleyici ? -1 : 1);", SAF),
    "M4a-dnk-ayri-formul": (FS, "tutarMinor: current.subtotals.donemNetKari, tahmini: current.smm.estimated };",
                            "tutarMinor: current.subtotals.donemNetKari + current.smm.minor, tahmini: current.smm.estimated };", SAF),
    "M4b-dnk-bir-gun": (FS, "incomeStatement({ entries: byYear.get(year) || [], valuation, from: `${year}-01-01`, to: date, bookType, ruleDiff })",
                        "incomeStatement({ entries: byYear.get(year) || [], valuation, from: `${year}-01-01`, to: date > `${year}-01-01` ? dayBefore(date) : date, bookType, ruleDiff })", SAF),
    "M5-kapanmis-yili-say": (FS, "for (let y = Math.max(closedYear + 1, Number.isFinite(firstYear) ? firstYear : year); y < year; y += 1) {",
                             "for (let y = Number.isFinite(firstYear) ? firstYear : year; y < year; y += 1) {", SAF),
    "M6-153-defterden": (FS, "  const stockKesin = !currentOpen || current.smm.posted;", "  const stockKesin = true;", SAF),
    "M7a-borclu-360-dus": (FS, "        if (reversed && account === \"360\") debitTax = true;", "", SAF),
    "M7b-aktif-pasif-dus": (FS, "    balanceDiffMinor: farkMinor,", "    balanceDiffMinor: 0,", SAF),
    "M7c-mutabakat-dus": (FS, "reconciliation: checked.reconciliation, partyNames });", "reconciliation: undefined, partyNames });", UC),
    "M7d-kapanmamis-yil-dus": (FS, "    openYears: priorYears.map(row => row.yil),", "    openYears: [],", SAF),
    "M8-ba-n01-ara-parcada": (FS, "  const posted621 = to === yearEnd && entries.some(", "  const posted621 = entries.some(", SAF),
    "M9-s209-kirpma-yok": (SV, "    if (den > 0n && num < 0n) {\n      clippedMinor = vMinor;", "    if (false) {\n      clippedMinor = vMinor;", SAF),
    "M10-kilitli-canli": (FS, "  const entries = ledger.book({ to: date, live });\n  // Kural", "  const entries = live.filter(entry => entry.date <= date);\n  // Kural", UC),
    "M11-ters-kayit-sayilmaz": (FS, "       AND NOT EXISTS (SELECT 1 FROM ledger_vouchers r WHERE r.reversal_of = v.id AND r.date <= ?1)`,", "       `,", UC),
}

if __name__ == "__main__":
    root, name = sys.argv[1], sys.argv[2]
    if name == "--liste":
        for key, value in M.items():
            print(key, value[3])
        sys.exit(0)
    path, old, new, _ = M[name]
    full = f"{root}/{path}"
    text = open(full, encoding="utf-8").read()
    if text.count(old) != 1:
        print(f"MUTANT UYGULANAMADI {name}: {text.count(old)} eşleşme")
        sys.exit(2)
    open(full, "w", encoding="utf-8").write(text.replace(old, new))
    print(f"uygulandı {name}")
