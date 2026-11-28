"""M1 küçük tur 5 — T2 mutantının (zincirde S4 birikimi min(0, …) yerine düz toplanır) EŞDEĞERLİK yoklaması.
Sav: S-DKM1K-1 = A ile zincirin S4 birikimi (carriedBefore(table, done, ay)) HİÇBİR ayda artı olamaz. Tümevarım: C_0 = 0; zincirdeki (kept / reduced / mixed) fiş ayında katkı
bugünkü − saklı ≤ −carried (güncel değil sayılmadığı için step.input = bugünkü + carried ≤ saklı); 'güncel değil' ve zincir dışı ayda katkı tam −carried; carried = min(0, C) → C_k ≤
max(0, C_(k−1)) = 0. Yani zincirde min(0, C) = C ve T2 gözlenebilir davranışı değiştirmez. Taban (t251-m1k4: 'güncel değil' ay saklı İ'yle) bu savı BOZAR — bütün hatanın kaynağı buydu.
Ayrı kopyada vatView'a denetim eklenir (C > 0 ise hata fırlatır; rapor 500), mutant betiğinin test listesi + rastgele dosya koşulur. $3 = "taban" verilirse kopyaya önce T1 (taban satırı)
uygulanır — denetimin DİŞİ (kırmızı beklenir). Kullanım: python3 -I esdegerlik.py <kopya kökü> <TZ> [taban]."""
import os
import subprocess
import sys

root, tz = sys.argv[1], sys.argv[2]
base = len(sys.argv) > 3 and sys.argv[3] == "taban"
path = os.path.join(root, "server/routes/tax.mjs")
s = open(path, encoding="utf-8").read()
old = "        const step = monthPosition(table, done, month, carry);\n"
new = old + '        if (carriedBefore(table, done, month) > 0) throw new Error(`ESDEGERLIK BOZULDU ${month}: S4 birikimi ${carriedBefore(table, done, month)}`);\n'
assert s.count(old) == 1
s = s.replace(old, new)
if base:
    t1_old = 'done.push({ month, inMinor: kept && settled.offsetState !== "stale" ? Number(offset.inMinor) : step.input });'
    assert s.count(t1_old) == 1
    s = s.replace(t1_old, "done.push({ month, inMinor: kept ? Number(offset.inMinor) : step.input });")
backup = path + ".m1k5esd"
os.replace(path, backup)
try:
    open(path, "w", encoding="utf-8").write(s)
    TESTS = ["test/kdv-ozeti-yalniz391-251.test.mjs", "test/kdv-ozeti-karma-251.test.mjs", "test/kdv-ozeti-mahsup-sonrasi-251.test.mjs", "test/kdv-ozeti-zincir-251.test.mjs", "test/kdv-ozeti-devreden-251.test.mjs", "test/defter-243-ux24-toplam.test.mjs", "test/c7b-kdv-ozeti-donem-250.test.mjs", "test/c7b-kdv-s4-250.test.mjs", "test/kdv-ozeti-s4-guncel-degil-251.test.mjs", "test/kdv-ozeti-rastgele-251.test.mjs"]
    env = dict(os.environ, HUKUK_LICENSE_URL="http://127.0.0.1:9", TZ=tz)
    r = subprocess.run(["node", "--test", "--test-concurrency=2", "--test-reporter=tap", *TESTS], cwd=root, env=env, capture_output=True, text=True, timeout=3000)
    lines = r.stdout.splitlines()
    count = lambda key: next((l.split()[-1] for l in lines if l.startswith(f"# {key} ")), "?")
    print(f"{tz}{' (taban satırı — dişi)' if base else ''}: çıkış {r.returncode} · tests {count('tests')} · pass {count('pass')} · fail {count('fail')} · cancelled {count('cancelled')} · 500 yanıtı {r.stdout.count(': 500 ')} · 'ESDEGERLIK BOZULDU' {r.stdout.count('ESDEGERLIK BOZULDU') + r.stderr.count('ESDEGERLIK BOZULDU')}")
    for l in lines:
        if l.startswith("    not ok "):
            print("  ", l.strip()[:160])
finally:
    os.replace(backup, path)
