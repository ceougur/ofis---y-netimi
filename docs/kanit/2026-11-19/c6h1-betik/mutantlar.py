"""Ç6-HESAP tur 1 mutantları: python3 -I mutantlar.py <kopya kökü> <mutant adı>  → dosyada TEK yer değiştirir (bulunmazsa / birden çoksa çıkış 2)."""
import sys

FS = "server/lib/financial-statements.mjs"
SV = "server/lib/stock-valuation.mjs"
MUTANTS = {
    "M1-7A-yansitma-yok": (FS, "if (REFLECT[code]) {", "if (false && REFLECT[code]) {"),
    "M2-iade-ters-isaret": (FS, "const sign = item.gelir ? -1 : 1;", "const sign = item.gelir || item.kod === \"B\" ? -1 : 1;"),
    "M3-alis-iadesi-dusulmez": (SV, "const num = BigInt(prior.vMinor + acc.openV + acc.buyV - acc.retV);\n    const den = BigInt(q0 + acc.openQ + acc.buyQ - acc.retQ);",
                                "const num = BigInt(prior.vMinor + acc.openV + acc.buyV);\n    const den = BigInt(q0 + acc.openQ + acc.buyQ);"),
    "M4-KG9-eksi-deger": (SV, "if (qMilli > 0 && !deleted) {", "if (qMilli !== 0 && !deleted) {"),
    "M5-donem-siniri-kayik": (FS, "if (entry.date < from || entry.date > to) continue;\n    count += 1;", "if (entry.date <= from || entry.date > to) continue;\n    count += 1;"),
    "M6-kapanis-sinifi-dahil": (FS, "    if (entryClass(entry) === CLOSING_CLASS) continue;\n", ""),
    "M7-90-ana-satira": (FS, "const source = isUnclassifiedSub(line.sub) ? line.sub : line.account;", "const source = line.account;"),
    "M8-kilitli-canli-okur": (FS, "entries = ledger.book({ from: start, to, live });", "entries = live;"),
    "M9-DBS-onceki-yildan-alinmaz": (SV, "const prior = year - 1 < firstYear ? base : endOf(year - 1);", "const prior = base;"),
    "M10-T-a1-yok": (FS, "- (first ? 0 : T(dayBefore(from), atA));", "- 0;"),
    "M11-G1-kesme": (SV, "const q = (2n * a + d) / (2n * d);", "const q = a / d;"),
    "M12-KG10-kart-fiyati-yok": (SV, "else vMinor = Number(roundDiv(BigInt(qMilli) * BigInt(item.unitPriceE4), BigInt(QTY_SCALE * 100)));", "else vMinor = 0;"),
    "M13-silinen-urun-sayilir": (SV, "const deleted = Boolean(item.deletedDay) && item.deletedDay <= day;", "const deleted = false;"),
    "M15-kural-farki-gorulmez": (FS, "    if (row.frozen === row.live) continue;\n    const [year, account] = key.split(\"|\");", "    continue;\n    const [year, account] = key.split(\"|\");"),
    "M14-N01-153-akisina": (FS, "if (cls === CLOSING_CLASS || cls === PERIOD_END_CLASS) continue;", "if (cls === CLOSING_CLASS) continue;"),
}
if __name__ == "__main__":
    if sys.argv[2] == "--liste":
        print(" ".join(MUTANTS))
        sys.exit(0)
    root, name = sys.argv[1], sys.argv[2]
    path, old, new = MUTANTS[name]
    full = f"{root}/{path}"
    text = open(full, encoding="utf-8").read()
    if text.count(old) != 1:
        print(f"{name}: hedef {text.count(old)} kez bulundu", file=sys.stderr)
        sys.exit(2)
    open(full, "w", encoding="utf-8").write(text.replace(old, new))
    print(f"{name}: uygulandı ({path})")
