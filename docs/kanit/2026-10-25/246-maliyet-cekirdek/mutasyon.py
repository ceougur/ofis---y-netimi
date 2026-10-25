# Kullanım: python3 mutasyon.py <kopya> <mutasyon>
import sys, pathlib, re
root = pathlib.Path(sys.argv[1]); m = sys.argv[2]
def rep(rel, old, new, count=1):
    p = root / rel; s = p.read_text(encoding="utf-8")
    assert s.count(old) == count, f"{m}: {rel} desen {s.count(old)} kez"
    p.write_text(s.replace(old, new), encoding="utf-8")
M = {
 "m1-sektor-kapisi-yok": lambda: rep("server/routes/maliyet.mjs", "if (!current.acik) throw", "if (false && !current.acik) throw"),
 "m2-surum-denetimi-yok": lambda: rep("server/lib/maliyet/depo.mjs", "if (is.degisti && Number(is.rev) !== is.kart.rev)", "if (false && is.degisti && Number(is.rev) !== is.kart.rev)"),
 "m3-k1-bolen-sifir-kabul": lambda: rep("server/lib/maliyet/girdi.mjs", "if (bolen === null || bolen === 0) throw", "if (false) throw"),
 "m4-excel-duzeltildi-130": lambda: rep("server/lib/maliyet/sablon.mjs", 'bolme: ["1S1Ç Kabin CM Maliyeti", 120] }),\n  // Tutarsızlık 4', 'bolme: ["1S1Ç Kabin CM Maliyeti", 130] }),\n  // Tutarsızlık 4'),
 "m5-eklenen-satir-araya-girmez": lambda: rep("server/lib/maliyet/hesap.mjs", "for (const satir of satirlar) ara += satir.tutar;", "for (const satir of satirlar) ara += /^s\\d+$/.test(satir.id) ? satir.tutar : 0;"),
 "m6-ara-deger-yuvarlanir": lambda: rep("server/lib/maliyet/hesap.mjs", "values.yuzde = (values.ara * num(adim.oran)) / 100;", "values.yuzde = Math.round(((values.ara * num(adim.oran)) / 100) * 100) / 100;"),
 "m7-bag-stok-okur": lambda: rep("server/lib/maliyet/depo.mjs", "  function hepsi() {\n", "  function hepsi() {\n    store.get(\"SELECT COUNT(*) AS n FROM stock_items\");\n"),
 "m8-bag-stok-maliyet-okur": lambda: (root / "server/routes/stock.mjs").write_text((root / "server/routes/stock.mjs").read_text(encoding="utf-8") + "\nexport const maliyetSay = store => store.get(\"SELECT COUNT(*) AS n FROM maliyet_kartlar\");\n", encoding="utf-8"),
 "m9-bag-cari-ice-alir": lambda: rep("server/routes/maliyet.mjs", 'import { systemClock } from "../lib/clock.mjs";', 'import { systemClock } from "../lib/clock.mjs";\nimport { accountBalance } from "../lib/accounts.mjs";'),
 "m11-sifirlama-listesinde-yok": lambda: rep("server/app.mjs", '    "maliyet_sekmeler", "maliyet_kartlar", "maliyet_satirlar", "maliyet_adimlar", "maliyet_hucreler", "maliyet_basliklar"];', '    ];'),
 "m12-yazim-kucuk-harf": lambda: rep("server/lib/maliyet/sablon.mjs", '"100X100 Oval Kabin", camSatirlari()', '"100X100 oval Kabin", camSatirlari()'),
 "m13-sablon-her-acilista-ezer": lambda: rep("server/lib/maliyet/depo.mjs", "    store.tx(() => {\n      MALIYET_SEKMELER.forEach", "    store.tx(() => {\n      for (const t of [\"maliyet_sekmeler\", \"maliyet_kartlar\", \"maliyet_satirlar\", \"maliyet_adimlar\", \"maliyet_hucreler\", \"maliyet_basliklar\"]) store.run(`DELETE FROM ${t}`);\n      MALIYET_SEKMELER.forEach"),
}
def crlf():
    for p in root.rglob("*.mjs"):
        if "node_modules" in p.parts: continue
        s = p.read_text(encoding="utf-8").replace("\r\n", "\n"); p.write_text(s.replace("\n", "\r\n"), encoding="utf-8", newline="")
if m == "m10-crlf":
    crlf()
elif m == "m10b-crlf-bag":
    M["m7-bag-stok-okur"](); crlf()
else:
    M[m]()
print("uygulandı", m)
