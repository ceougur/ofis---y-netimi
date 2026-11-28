"""§7 S-M1K3-1 seçenek A'nın sayıları: Y3 / Y4 mutantı (= seçenek A'nın kodu) ayrı kopyada uygulanır, karar dışı iki tablo satırı koşulur, iletideki gerçek sayılar dökülür.
Kullanım: python3 -I secenek-a-sayilar.py <kopya kökü> <mutant.py>. Dosya her durumda geri yüklenir."""
import sys, os, shutil, subprocess, re
root, script = sys.argv[1], sys.argv[2]
src = open(script, encoding="utf-8").read()
ns = {}
exec(src.split("TESTS = ")[0].replace("root, out, tz = sys.argv[1], sys.argv[2], sys.argv[3]", ""), ns)
pick = {m[0].split()[0]: m for m in ns["MUTANTS"]}
for key, pattern in (("Y3", "yön döndü \\(DEĞİŞMEZ, karar dışı\\)"), ("Y4", "İ arttı \\(S-M1-3 = C, karar dışı\\)")):
    name, rel, old, new = pick[key]
    path = os.path.join(root, rel)
    backup = path + ".secenekyedek"
    shutil.copyfile(path, backup)
    try:
        s = open(path, encoding="utf-8").read()
        assert s.count(old) == 1
        open(path, "w", encoding="utf-8").write(s.replace(old, new))
        env = dict(os.environ, HUKUK_LICENSE_URL="http://127.0.0.1:9", TZ="UTC")
        r = subprocess.run(["node", "--test", "--test-reporter=spec", f"--test-name-pattern={pattern}", "test/kdv-ozeti-yalniz391-251.test.mjs"], cwd=root, env=env, capture_output=True, text=True, timeout=600)
        print(f"== {name}")
        for line in r.stdout.splitlines():
            if re.search(r"(Mart|Nisan)\b.*\{|actual|expected|^\s+[+-]\s+\d|sapma|Önceki Dönemden|Zincirle", line):
                print("  ", line.strip()[:400])
    finally:
        shutil.copyfile(backup, path)
        os.remove(backup)
