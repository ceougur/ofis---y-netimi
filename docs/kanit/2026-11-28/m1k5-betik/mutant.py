"""M1 KÜÇÜK TUR 5 KOPYASI: küçük tur 4'ün mutant.py'si AYNEN (40 mutant; M3 yalnız metin olarak yeni done.push satırına uyarlandı — anlamı aynı: mahsupsuz ayın saklı İ'si = bugünkü
kendi İ'si) + bu turun T1–T5'i (T2b dahil). Testler: tur 4'ün 8 dosyası + bu turun kdv-ozeti-s4-guncel-degil-251; bu turun mutantlarında (T*) ayrıca kdv-ozeti-rastgele-251 (300 + 150 tohum).
Önceki başlık: M1 KÜÇÜK TUR 4 KOPYASI (aşağıda MUTANTS listesinde Y3 / Y4 yerine Y3b / Y4b / Y6; NEXT / ONLY satırları yeni koda uyarlandı).
M1 küçük tur 3 mutantları — küçük tur 2'nin 34 mutantı AYNEN (NEXT satırına dokunan Z2, Z7, K4 yalnız metin olarak yeni koda uyarlandı, anlamları aynı) + bu turun
Y1–Y5'i; testlere bu turun yeni dosyası (kdv-ozeti-yalniz391-251) eklendi.
M1 küçük tur 2 mutantları — küçük turun 28 mutantı AYNEN (m1k-betik/mutant.py kopyası; değişen satırlara dokunan Z2, Z7, N2, N3 yalnız metin olarak yeni koda uyarlandı,
anlamları aynı) + bu turun K1–K6'sı; testlere bu turun yeni dosyası eklendi.
M1 küçük tur mutantları (ayrı kopya; değerle): paketin mutantları (tur 1 D1–D10, tur 2 Z1–Z7 — yeni koda uyarlandı; dar kontrolün M3, M4, M7'si) + bu turun N1–N8'i.
Kullanım: python3 -I mutant.py <kopya kökü> <çıktı.json> <TZ>. Her mutant tek yerde metin değiştirir (tam olarak bir eşleşme), testler tek node --test çağrısında koşar, dosya geri yüklenir."""
import sys, os, shutil, subprocess, json
root, out, tz = sys.argv[1], sys.argv[2], sys.argv[3]
RC = "server/routes/report-center.mjs"
TX = "server/routes/tax.mjs"
STEP = "        const step = monthPosition(table, done, month, carry);"
KEPT = "        const kept = Boolean(offset) && Number(offset.carryInMinor) === carry && Math.min(0, carriedBefore(table, active, month)) === step.carried;"
NEXT = '        const next = !kept ? step.carryOut : recount ? settled.carryOutMinor : Number(offset.carryOutMinor);'
RECOUNT = '        const recount = kept && (settled.offsetState === "mixed" || settled.offsetState === "stale");'
SETNOTE = '        steps.set(month, { ...settled, carryAfterMinor: next });\n        if (offset && !kept) {'
STALE = '      if (step.input > storedIn || (step.out !== Number(offset.outMinor) && step.input === storedIn)) return { ...shape(month, step), offsetState: "stale" };\n'
MIXPOS = "        const position = step.out - storedIn - carryIn;"
DONE = 'done.push({ month, inMinor: kept && settled.offsetState !== "stale" ? Number(offset.inMinor) : step.input });'
OWNPOS = "    const carried = Math.min(0, carriedBefore(table, active, month));"
MUTANTS = [
    # Paket — tur 1.
    ("D1 devredeni sıfır al (rapor görünümü)", TX, STEP, "        const step = monthPosition(table, done, month, 0);"),
    ("D2 devredeni iki kez düş", TX, STEP,
     "        const s0 = monthPosition(table, done, month, carry);\n        const step = { ...s0, payable: Math.max(0, s0.position - carry), carryOut: Math.max(0, carry - s0.position) };"),
    ("D3 çok aylı aralıkta ilk ay yerine son ayın devredeni 'önceki dönem'", RC,
     "const startMinor = firstMonth ? view.position(firstMonth).carryInMinor : view.openingMinor;",
     "const startMinor = firstMonth ? view.position(lastMonth || firstMonth).carryInMinor : view.openingMinor;"),
    ("D4 mahsup formülü yerine eski dönem farkı (391 − 191)", RC,
     "              const payableMinor = positions.reduce((sum, item) => sum + item.payableMinor, 0);\n              const carryOutMinor = positions.length ? positions[positions.length - 1].carryOutMinor : startMinor;",
     "              const diff = positions.reduce((sum, item) => sum + item.outMinor - item.inMinor, 0);\n              const payableMinor = Math.max(0, diff);\n              const carryOutMinor = Math.max(0, -diff);"),
    ("D5 ödenecek ile devredeni ters yaz", RC,
     '[["Önceki Dönemden Devreden KDV", vat.startMinor], ["Ödenecek KDV", vat.payableMinor], ["Sonraki Döneme Devreden KDV", vat.carryOutMinor]]',
     '[["Önceki Dönemden Devreden KDV", vat.startMinor], ["Ödenecek KDV", vat.carryOutMinor], ["Sonraki Döneme Devreden KDV", vat.payableMinor]]'),
    ("D6 ödenecek yalnız son hareketli ay (toplam yerine)", RC,
     "const payableMinor = positions.reduce((sum, item) => sum + item.payableMinor, 0);",
     "const payableMinor = positions.length ? positions[positions.length - 1].payableMinor : 0;"),
    ("D7 sonraki döneme devreden = aralığın son ayının görünümü (hareketli ay yerine)", RC,
     "const carryOutMinor = positions.length ? positions[positions.length - 1].carryOutMinor : startMinor;",
     "const carryOutMinor = lastMonth ? view.position(lastMonth).carryOutMinor : startMinor;"),
    ("D8 'Mahsup Edilmemiş Ay' notu hiç yazılmaz", RC, "...(vat?.pending.length\n", "...(false && vat?.pending.length\n"),
    ("D9 ay satırlarında kullanılan devreden satırı yok", RC,
     'if (item.carryInMinor > 0) rows.push(vatLine(monthLabel(month), "Önceki Dönemden Devreden KDV", item.carryInMinor));', ''),
    ("D10 S4 taşıması zincirde unutulur (carried yok)", TX, STEP, "        const step = monthPosition(table, [], month, carry);"),
    # Paket — tur 2.
    ("Z1 mahsupsuz ayı zincirden atla (devredeni değiştirmez)", TX, "        carry = next;", "        carry = offset ? next : carry;"),
    ("Z2 ödenecek aydan sonra devredeni taşı", TX, NEXT, '        const next = !kept ? (step.payable > 0 ? carry : step.carryOut) : recount ? settled.carryOutMinor : Number(offset.carryOutMinor);'),
    ("Z3 zinciri aralığın ilk ayından başlat (öncesini unut)", RC,
     "const startMinor = firstMonth ? view.position(firstMonth).carryInMinor : view.openingMinor;",
     "const startMinor = firstMonth ? 0 : view.openingMinor;"),
    ("Z4 kopuk zincir notunu yazma", RC, "...(vat?.mismatches.length\n", "...(false && vat?.mismatches.length\n"),
    ("Z5 A ↔ B anahtarını ters çevir", TX, 'const VAT_CARRY_MODE = "chain";', 'const VAT_CARRY_MODE = "ledger";'),
    ("Z6 fişin devredeni zincirle karşılaştırılmaz (her fiş geçerli)", TX, KEPT, "        const kept = Boolean(offset);"),
    ("Z7 geçerli fişte fişin devredeni yerine hesaplanan taşınır", TX, NEXT, "        const next = step.carryOut;"),
    # Dar kontrolün yaşayan / ek mutantları.
    ("M3 zincirde S4 emilimi yok (mahsupsuz ayın saklı İ'si = bugünkü İ)", TX,
     DONE, DONE.replace(": step.input });", ": table.of(month).input });")),
    ("M4 aralığın sonraki devredeni = fişin devredeni (carryAfter)", RC,
     "const carryOutMinor = positions.length ? positions[positions.length - 1].carryOutMinor : startMinor;",
     "const carryOutMinor = positions.length ? positions[positions.length - 1].carryAfterMinor : startMinor;"),
    ("M7 Mahsup Edilmemiş Ay 6 sınırı 5", RC, "vat.pending.slice(0, 6).map(monthLabel)", "vat.pending.slice(0, 5).map(monthLabel)"),
    # Bu tur.
    ("N1 fiş zincirde sayılırken S4 emilimi karşılaştırılmaz (yalnız devreden)", TX, KEPT, "        const kept = Boolean(offset) && Number(offset.carryInMinor) === carry;"),
    ("N2 S-DKM1-1 yok: zincirdeki fişin ayı bugünkü kayıtlardan", TX,
     "        const settled = kept ? settle(month, step, offset) : shape(month, step);",
     "        const settled = shape(month, step);"),
    # N3 (yeni koda uyarlandı): güncel olmayan (ve karma) fişte de sonuç tümüyle fişten.
    ("N3 S-M1-3 yok: güncel olmayan fişte de sonuç fişten", TX, STALE,
     '      if (step.input > storedIn || step.out !== Number(offset.outMinor)) return { month, label: monthLabel(month), outMinor: Number(offset.outMinor), inMinor: storedIn, carryInMinor: Number(offset.carryInMinor), carriedInMinor: step.carried, payableMinor: Number(offset.payableMinor), carryOutMinor: Number(offset.carryOutMinor), offsetState: "kept" };\n'),
    ("N4 'reduced' notu ayın kendi İ'si yerine düzeltilmiş İ'den (önceki ayın azalması bu aya yazılır)", TX,
     'offsetState: table.of(month).input < Number(offset.inMinor) ? "reduced" : "kept",', 'offsetState: step.input < Number(offset.inMinor) ? "reduced" : "kept",'),
    ("N5 azalan ay notu yazılmaz", RC, '...(reduced.length ? [', '...(false && reduced.length ? ['),
    ("N6 yön farkı notta yazılmaz (S-M1-2)", RC, '${turned ? `; fiş ${offsetResult} yazmış, sırayla mahsupta ${chainResult} çıkar` : ""}', ""),
    ("N7 devredeni aynı uyuşmazlıkta da devreden cümlesi", RC, "          if (item.usedMinor !== item.chainMinor) {", "          if (true) {"),
    # Bu tur (küçük tur 2 — S-M1K-1 = A).
    ("K1 karma ayda İndirilecek KDV bugünkü kayıtlardan", TX, MIXPOS, "        const position = step.out - step.input - carryIn;"),
    ("K2 karma ayda 391 fişten", TX, MIXPOS, "        const position = Number(offset.outMinor) - storedIn - carryIn;"),
    ("K3 karma ayda not çıkmaz", RC, "                ...(mixed.length\n", "                ...(false && mixed.length\n"),
    ("K4 karma ayda sonraki aya fişin eski devredeni taşınır", TX, RECOUNT, '        const recount = kept && settled.offsetState === "stale";'),
    ("K5 yalnız 391 değişiminde de karma kuralı (S-M1-3 = C bozulur)", TX, STALE,
     '      if (step.input > storedIn) return { ...shape(month, step), offsetState: "stale" };\n'),
    ("K6 karma ay 'güncel değil' notunda ikinci kez yazılır", RC, "item.stale && !mixed.some(other => other.month === item.month)", "item.stale"),
    # Bu tur (küçük tur 3 — S-M1K2-1 = A; görev metninin istenen üçü Y1–Y3).
    # Küçük tur 4: Y1 anlamı aynı (hiçbir 'güncel değil' ayında bugünkü devreden taşınmaz = t251-m1k2 davranışı), yeni satıra uyarlandı.
    ("Y1 devreden yönde yalnız 391 ayında sonraki aya fişin eski devredeni taşınır", TX, RECOUNT, '        const recount = kept && settled.offsetState === "mixed";'),
    ("Y2 yalnız 391 (küçük tur 4: her 'güncel değil') ayından sonraki fişin uyuşmazlık notu çıkmaz", TX, SETNOTE,
     '        steps.set(month, { ...settled, carryAfterMinor: next, only: recount && settled.offsetState === "stale" });\n        if (offset && !kept && !(busy.indexOf(month) > 0 && steps.get(busy[busy.indexOf(month) - 1]).only)) {'),
    # Küçük tur 4 (S-M1K3-1 = A): tur 3'ün Y3 / Y4'ü artık DOĞRU davranış — yerine üç mutant.
    ("Y3b güncel değil ödenecek fişli ayda fişin devredeni taşınır (tur 3 sınırı)", TX, RECOUNT,
     '        const recount = kept && (settled.offsetState === "mixed" || (settled.offsetState === "stale" && Number(offset.carryOutMinor) > 0));'),
    ("Y4b İ artan güncel değil ayında fişin devredeni taşınır (İ artışı taşınmaz; tur 3 sınırı)", TX, RECOUNT,
     '        const recount = kept && (settled.offsetState === "mixed" || (settled.offsetState === "stale" && step.input === Number(offset.inMinor)));'),
    ("Y6 güncel (kept / reduced) ayda da bugünkü hesabın devredeni taşınır", TX, NEXT,
     '        const next = !kept ? step.carryOut : recount ? settled.carryOutMinor : step.carryOut;'),
    ("Y5 S4 karma: 'İ azaldı' ölçüsü ayın kendi İ'si (S4 taşıması sayılmaz)", TX, STALE,
     '      if (step.input > storedIn || (step.out !== Number(offset.outMinor) && table.of(month).input >= storedIn)) return { ...shape(month, step), offsetState: "stale" };\n'),
    ("N8 güncel değil notunun eski metni", RC, "(mahsup fişi güncel değil — mahsubu geri alıp yeniden mahsup edin)", "(mahsubu geri alıp yeniden yapın)"),
    # Küçük tur 5 (S-DKM1K-1 = A). İstenen ikisi T1 ve T2.
    ("T1 güncel değil ay S4 birikimine yine fişin saklı İ'siyle girer (taban davranışı)", TX, DONE, "done.push({ month, inMinor: kept ? Number(offset.inMinor) : step.input });"),
    ("T2 zincirde azalma birikimi min(0, …) yerine düz toplanır (artış da taşınır; ön izleme aynı)", TX, OWNPOS,
     "    const carried = carryIn === null ? Math.min(0, carriedBefore(table, active, month)) : carriedBefore(table, active, month);"),
    ("T2b azalma birikimi her yerde düz toplanır (ön izleme dahil)", TX, OWNPOS, "    const carried = carriedBefore(table, active, month);"),
    ("T3 güncel değil ay birikime kendi bugünkü İ'siyle (S4 taşıması düşülmeden) girer", TX, DONE,
     'done.push({ month, inMinor: kept && settled.offsetState !== "stale" ? Number(offset.inMinor) : kept ? table.of(month).input : step.input });'),
    ("T4 karma ay da birikime bugünkü İ'yle girer (S-M1K-1 azalması kaybolur)", TX, DONE,
     'done.push({ month, inMinor: kept && settled.offsetState !== "stale" && settled.offsetState !== "mixed" ? Number(offset.inMinor) : step.input });'),
    ("T5 azalan ay (reduced) da birikime bugünkü İ'yle girer (S-DKM1-1 azalması kaybolur)", TX, DONE,
     'done.push({ month, inMinor: kept && settled.offsetState === "kept" ? Number(offset.inMinor) : step.input });'),
]
TESTS = ["test/kdv-ozeti-yalniz391-251.test.mjs", "test/kdv-ozeti-karma-251.test.mjs", "test/kdv-ozeti-mahsup-sonrasi-251.test.mjs", "test/kdv-ozeti-zincir-251.test.mjs", "test/kdv-ozeti-devreden-251.test.mjs", "test/defter-243-ux24-toplam.test.mjs", "test/c7b-kdv-ozeti-donem-250.test.mjs", "test/c7b-kdv-s4-250.test.mjs", "test/kdv-ozeti-s4-guncel-degil-251.test.mjs"]
RANDOM = "test/kdv-ozeti-rastgele-251.test.mjs"
only = set(sys.argv[4].split(",")) if len(sys.argv) > 4 and sys.argv[4] else None
results = []
for name, rel, old, new in MUTANTS:
    if only and name.split()[0] not in only:
        continue
    path = os.path.join(root, rel)
    backup = path + ".m1k5yedek"
    shutil.copyfile(path, backup)
    try:
        s = open(path, encoding="utf-8").read()
        if s.count(old) != 1:
            results.append({"mutant": name, "uygulanamadi": s.count(old)})
            continue
        open(path, "w", encoding="utf-8").write(s.replace(old, new))
        env = dict(os.environ, HUKUK_LICENSE_URL="http://127.0.0.1:9", TZ=tz)
        r = subprocess.run(["node", "--test", "--test-reporter=tap", *TESTS, *([RANDOM] if name.startswith("T") else [])], cwd=root, env=env, capture_output=True, text=True, timeout=3000)
        lines = r.stdout.splitlines()
        count = lambda key: next((l.split()[-1] for l in lines if l.startswith(f"# {key} ")), "?")
        failed = [l.strip()[:160] for l in lines if l.startswith("    not ok ")]
        results.append({"mutant": name, "cikis": r.returncode, "tests": count("tests"), "fail": count("fail"), "cancelled": count("cancelled"), "basarisiz": failed, "oldu": r.returncode != 0})
    finally:
        shutil.copyfile(backup, path)
        os.remove(backup)
    print(results[-1]["mutant"], "→", "ÖLDÜ" if results[-1].get("oldu") else ("UYGULANAMADI" if "uygulanamadi" in results[-1] else "YAŞADI"), f"(başarısız {results[-1].get('fail', '-')}/{results[-1].get('tests', '-')})", flush=True)
json.dump({"tz": tz, "kok": root, "sonuclar": results}, open(out, "w", encoding="utf-8"), ensure_ascii=False, indent=1)
