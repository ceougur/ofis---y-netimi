"""M1 küçük tur mutantları (ayrı kopya; değerle): paketin mutantları (tur 1 D1–D10, tur 2 Z1–Z7 — yeni koda uyarlandı; dar kontrolün M3, M4, M7'si) + bu turun N1–N8'i.
Kullanım: python3 -I mutant.py <kopya kökü> <çıktı.json> <TZ>. Her mutant tek yerde metin değiştirir (tam olarak bir eşleşme), testler tek node --test çağrısında koşar, dosya geri yüklenir."""
import sys, os, shutil, subprocess, json
root, out, tz = sys.argv[1], sys.argv[2], sys.argv[3]
RC = "server/routes/report-center.mjs"
TX = "server/routes/tax.mjs"
STEP = "        const step = monthPosition(table, done, month, carry);"
KEPT = "        const kept = Boolean(offset) && Number(offset.carryInMinor) === carry && Math.min(0, carriedBefore(table, active, month)) === step.carried;"
NEXT = "        const next = kept ? Number(offset.carryOutMinor) : step.carryOut;"
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
    ("Z2 ödenecek aydan sonra devredeni taşı", TX, NEXT, "        const next = kept ? Number(offset.carryOutMinor) : step.payable > 0 ? carry : step.carryOut;"),
    ("Z3 zinciri aralığın ilk ayından başlat (öncesini unut)", RC,
     "const startMinor = firstMonth ? view.position(firstMonth).carryInMinor : view.openingMinor;",
     "const startMinor = firstMonth ? 0 : view.openingMinor;"),
    ("Z4 kopuk zincir notunu yazma", RC, "...(vat?.mismatches.length\n", "...(false && vat?.mismatches.length\n"),
    ("Z5 A ↔ B anahtarını ters çevir", TX, 'const VAT_CARRY_MODE = "chain";', 'const VAT_CARRY_MODE = "ledger";'),
    ("Z6 fişin devredeni zincirle karşılaştırılmaz (her fiş geçerli)", TX, KEPT, "        const kept = Boolean(offset);"),
    ("Z7 geçerli fişte fişin devredeni yerine hesaplanan taşınır", TX, NEXT, "        const next = step.carryOut;"),
    # Dar kontrolün yaşayan / ek mutantları.
    ("M3 zincirde S4 emilimi yok (mahsupsuz ayın saklı İ'si = bugünkü İ)", TX,
     "done.push({ month, inMinor: kept ? Number(offset.inMinor) : step.input });", "done.push({ month, inMinor: kept ? Number(offset.inMinor) : table.of(month).input });"),
    ("M4 aralığın sonraki devredeni = fişin devredeni (carryAfter)", RC,
     "const carryOutMinor = positions.length ? positions[positions.length - 1].carryOutMinor : startMinor;",
     "const carryOutMinor = positions.length ? positions[positions.length - 1].carryAfterMinor : startMinor;"),
    ("M7 Mahsup Edilmemiş Ay 6 sınırı 5", RC, "vat.pending.slice(0, 6).map(monthLabel)", "vat.pending.slice(0, 5).map(monthLabel)"),
    # Bu tur.
    ("N1 fiş zincirde sayılırken S4 emilimi karşılaştırılmaz (yalnız devreden)", TX, KEPT, "        const kept = Boolean(offset) && Number(offset.carryInMinor) === carry;"),
    ("N2 S-DKM1-1 yok: zincirdeki fişin ayı bugünkü kayıtlardan", TX,
     "steps.set(month, { ...(kept ? settle(month, step, offset) : shape(month, step)), carryAfterMinor: next });",
     "steps.set(month, { ...shape(month, step), carryAfterMinor: next });"),
    ("N3 S-M1-3 yok: güncel olmayan fişte de sonuç fişten", TX,
     '      if (step.out !== Number(offset.outMinor) || step.input > Number(offset.inMinor)) return { ...shape(month, step), offsetState: "stale" };\n', ""),
    ("N4 'reduced' notu ayın kendi İ'si yerine düzeltilmiş İ'den (önceki ayın azalması bu aya yazılır)", TX,
     'offsetState: table.of(month).input < Number(offset.inMinor) ? "reduced" : "kept",', 'offsetState: step.input < Number(offset.inMinor) ? "reduced" : "kept",'),
    ("N5 azalan ay notu yazılmaz", RC, '...(reduced.length ? [', '...(false && reduced.length ? ['),
    ("N6 yön farkı notta yazılmaz (S-M1-2)", RC, '${turned ? `; fiş ${offsetResult} yazmış, sırayla mahsupta ${chainResult} çıkar` : ""}', ""),
    ("N7 devredeni aynı uyuşmazlıkta da devreden cümlesi", RC, "          if (item.usedMinor !== item.chainMinor) {", "          if (true) {"),
    ("N8 güncel değil notunun eski metni", RC, "(mahsup fişi güncel değil — mahsubu geri alıp yeniden mahsup edin)", "(mahsubu geri alıp yeniden yapın)"),
]
TESTS = ["test/kdv-ozeti-mahsup-sonrasi-251.test.mjs", "test/kdv-ozeti-zincir-251.test.mjs", "test/kdv-ozeti-devreden-251.test.mjs", "test/defter-243-ux24-toplam.test.mjs", "test/c7b-kdv-ozeti-donem-250.test.mjs", "test/c7b-kdv-s4-250.test.mjs"]
only = set(sys.argv[4].split(",")) if len(sys.argv) > 4 and sys.argv[4] else None
results = []
for name, rel, old, new in MUTANTS:
    if only and name.split()[0] not in only:
        continue
    path = os.path.join(root, rel)
    backup = path + ".m1kyedek"
    shutil.copyfile(path, backup)
    try:
        s = open(path, encoding="utf-8").read()
        if s.count(old) != 1:
            results.append({"mutant": name, "uygulanamadi": s.count(old)})
            continue
        open(path, "w", encoding="utf-8").write(s.replace(old, new))
        env = dict(os.environ, HUKUK_LICENSE_URL="http://127.0.0.1:9", TZ=tz)
        r = subprocess.run(["node", "--test", "--test-reporter=tap", *TESTS], cwd=root, env=env, capture_output=True, text=True, timeout=1500)
        lines = r.stdout.splitlines()
        count = lambda key: next((l.split()[-1] for l in lines if l.startswith(f"# {key} ")), "?")
        failed = [l.strip()[:160] for l in lines if l.startswith("    not ok ")]
        results.append({"mutant": name, "cikis": r.returncode, "tests": count("tests"), "fail": count("fail"), "cancelled": count("cancelled"), "basarisiz": failed, "oldu": r.returncode != 0})
    finally:
        shutil.copyfile(backup, path)
        os.remove(backup)
    print(results[-1]["mutant"], "→", "ÖLDÜ" if results[-1].get("oldu") else ("UYGULANAMADI" if "uygulanamadi" in results[-1] else "YAŞADI"), f"(başarısız {results[-1].get('fail', '-')}/{results[-1].get('tests', '-')})", flush=True)
json.dump({"tz": tz, "kok": root, "sonuclar": results}, open(out, "w", encoding="utf-8"), ensure_ascii=False, indent=1)
