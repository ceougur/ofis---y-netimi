import sys, os, shutil, subprocess, json
root = sys.argv[1]
out = sys.argv[2]
RC = "server/routes/report-center.mjs"
TX = "server/routes/tax.mjs"
MUTANTS = [
    ("D1 devredeni sıfır al (rapor görünümü)", TX,
     "        const { out, input, carry, carried, payable, carryOut } = monthPosition(table, active, month);\n        return { month, label: monthLabel(month), outMinor: out, inMinor: input, carryInMinor: carry,",
     "        const { out, input, carried } = monthPosition(table, active, month);\n        const carry = 0, payable = Math.max(0, out - input), carryOut = Math.max(0, input - out);\n        return { month, label: monthLabel(month), outMinor: out, inMinor: input, carryInMinor: carry,"),
    ("D2 devredeni iki kez düş", TX,
     "        const { out, input, carry, carried, payable, carryOut } = monthPosition(table, active, month);",
     "        const { out, input, carry, carried, position } = monthPosition(table, active, month);\n        const payable = Math.max(0, position - carry), carryOut = Math.max(0, carry - position);"),
    ("D3 çok aylı aralıkta ilk ay yerine son ayın devredeni 'önceki dönem'", RC,
     "const startMinor = firstMonth ? view.position(firstMonth).carryInMinor : 0;",
     "const startMinor = firstMonth ? view.position(lastMonth || firstMonth).carryInMinor : 0;"),
    ("D4 mahsup formülü yerine eski dönem farkı (391 − 191)", RC,
     "              const payableMinor = positions.reduce((sum, item) => sum + item.payableMinor, 0);\n              const carryOutMinor = positions.length ? positions[positions.length - 1].carryOutMinor : startMinor;",
     "              const diff = positions.reduce((sum, item) => sum + item.outMinor - item.inMinor, 0);\n              const payableMinor = Math.max(0, diff);\n              const carryOutMinor = Math.max(0, -diff);"),
    ("D5 ödenecek ile devredeni ters yaz", RC,
     '[["Önceki Dönemden Devreden KDV", vat.startMinor], ["Ödenecek KDV", vat.payableMinor], ["Sonraki Döneme Devreden KDV", vat.carryOutMinor]]',
     '[["Önceki Dönemden Devreden KDV", vat.startMinor], ["Ödenecek KDV", vat.carryOutMinor], ["Sonraki Döneme Devreden KDV", vat.payableMinor]]'),
    ("D6 ödenecek yalnız son hareketli ay (toplam yerine)", RC,
     "const payableMinor = positions.reduce((sum, item) => sum + item.payableMinor, 0);",
     "const payableMinor = positions.length ? positions[positions.length - 1].payableMinor : 0;"),
    ("D7 sonraki döneme devreden = aralığın son ayının ön izlemesi (hareketli ay yerine)", RC,
     "const carryOutMinor = positions.length ? positions[positions.length - 1].carryOutMinor : startMinor;",
     "const carryOutMinor = lastMonth ? view.position(lastMonth).carryOutMinor : startMinor;"),
    ("D8 'Mahsup Edilmemiş Ay' notu hiç yazılmaz", RC,
     "...(vat?.pending.length\n",
     "...(false && vat?.pending.length\n"),
    ("D9 ay satırlarında kullanılan devreden satırı yok", RC,
     'if (item.carryInMinor > 0) rows.push(vatLine(monthLabel(month), "Önceki Dönemden Devreden KDV", item.carryInMinor));',
     ''),
    ("D10 S4 taşıması rapor görünümünde unutulur (carried yok)", TX,
     "        const { out, input, carry, carried, payable, carryOut } = monthPosition(table, active, month);",
     "        const p0 = monthPosition(table, active, month);\n        const out = p0.out, carry = p0.carry, carried = 0, input = p0.input - p0.carried;\n        const payable = Math.max(0, out - input - carry), carryOut = Math.max(0, input + carry - out);"),
]
TESTS = ["test/kdv-ozeti-devreden-251.test.mjs"] if __import__("os").environ.get("M1_YALNIZ") else ["test/kdv-ozeti-devreden-251.test.mjs", "test/defter-243-ux24-toplam.test.mjs", "test/c7b-kdv-ozeti-donem-250.test.mjs", "test/c7b-kdv-s4-250.test.mjs"]
results = []
for name, rel, old, new in MUTANTS:
    path = os.path.join(root, rel)
    backup = path + ".m1yedek"
    shutil.copyfile(path, backup)
    try:
        s = open(path, encoding="utf-8").read()
        if s.count(old) != 1:
            results.append({"mutant": name, "uygulanamadi": s.count(old)})
            continue
        open(path, "w", encoding="utf-8").write(s.replace(old, new))
        env = dict(os.environ, HUKUK_LICENSE_URL="http://127.0.0.1:9")
        per = {}
        for t in TESTS:
            r = subprocess.run(["node", "--test", t], cwd=root, env=env, capture_output=True, text=True, timeout=900)
            fail = [l for l in r.stdout.splitlines() if l.startswith("# fail")]
            first = next((l.strip() for l in r.stdout.splitlines() if l.strip().startswith("error:")), "")
            per[t] = {"cikis": r.returncode, "fail": fail[0] if fail else "?", "ilk_hata": first[:200]}
        results.append({"mutant": name, "testler": per, "oldu": any(v["cikis"] != 0 for v in per.values())})
    finally:
        shutil.copyfile(backup, path)
        os.remove(backup)
json.dump(results, open(out, "w", encoding="utf-8"), ensure_ascii=False, indent=1)
for r in results:
    print(r["mutant"], "→", "ÖLDÜ" if r.get("oldu") else ("UYGULANAMADI" if "uygulanamadi" in r else "YAŞADI"), {k.split("/")[-1]: v["fail"] for k, v in r.get("testler", {}).items()})
