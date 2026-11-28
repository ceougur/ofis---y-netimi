# m1k6 mutantları: her biri /dev/shm/m1k6-mut/yeni kopyasında tek tek uygulanır, testler koşulur, dosya özgün içeriğine geri yazılır.
# python3 -I mutant.py <çıktı klasörü>
import os, subprocess, sys, time

ROOT = "/dev/shm/m1k6-mut/yeni"
OUT = sys.argv[1]
TESTS = ["test/kdv-ozeti-uyusmazlik-yonu-251.test.mjs", "test/kdv-ozeti-s4-guncel-degil-251.test.mjs", "test/kdv-ozeti-mahsup-sonrasi-251.test.mjs"]
TAX = "server/routes/tax.mjs"
MUT = [
    ("M1-yon-ayrimi-yok", TAX, "const absorbShort = Number(offset.carryInMinor) === carry && step.carried < offsetCarried;", "const absorbShort = false;"),
    ("M1b-yon-hep-eksi", TAX, "const absorbShort = Number(offset.carryInMinor) === carry && step.carried < offsetCarried;", "const absorbShort = Number(offset.carryInMinor) === carry;"),
    ("M2-onarim-son-guncel-degil", TAX, "const restart = absorbShort ? [...steps.values()].find(", "const restart = absorbShort ? [...steps.values()].reverse().find("),
    ("M2b-onarim-bu-ay", TAX, "?.month || month : \"\";", "?.month && month : \"\";"),
    ("M3-kisa-not-hep", TAX, "return same ? [] : before;", "return before;"),
    ("M4-kisa-not-hic", TAX, "return same ? [] : before;", "return [];"),
]
env = dict(os.environ, HUKUK_LICENSE_URL="http://127.0.0.1:9", TZ="UTC")
summary = []
for name, rel, old, new in MUT:
    path = os.path.join(ROOT, rel)
    orig = open(path, encoding="utf-8").read()
    assert orig.count(old) == 1, f"{name}: hedef {orig.count(old)} kez"
    open(path, "w", encoding="utf-8").write(orig.replace(old, new))
    t0 = time.time()
    try:
        r = subprocess.run(["node", "--test", *TESTS], cwd=ROOT, env=env, capture_output=True, text=True, timeout=1500)
        text = r.stdout + r.stderr
        code = r.returncode
    finally:
        open(path, "w", encoding="utf-8").write(orig)
    open(os.path.join(OUT, f"mut-{name}.txt"), "w", encoding="utf-8").write(text)
    counts = {k: next((l.split()[-1] for l in text.splitlines() if l.startswith(f"# {k} ")), "?") for k in ("tests", "pass", "fail")}
    failed = [l.strip() for l in text.splitlines() if l.strip().startswith("not ok") and " - " in l and l.startswith("    ")]
    line = f"{name}: çıkış {code} · tests {counts['tests']} pass {counts['pass']} fail {counts['fail']} · {round(time.time() - t0)} sn · {'YAKALANDI' if code != 0 else 'YAŞADI'}"
    summary.append(line)
    print(line, flush=True)
    for f in failed[:6]:
        print("   ", f[:200], flush=True)
open(os.path.join(OUT, "mutant-ozet.txt"), "w", encoding="utf-8").write("\n".join(summary) + "\n")
