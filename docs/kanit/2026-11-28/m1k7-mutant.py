# m1k7 mutantları: her biri /dev/shm/m1k7-mut/yeni kopyasında (commit 1c97b8e2) tek tek uygulanır, testler İKİ saat diliminde koşulur, dosya özgün içeriğine geri yazılır.
# Tur 6'nın 6 mutantı (M1–M4; M2 / M2b bu turun koduna göre aynı anlamla yeniden hedeflendi) + bu turun mutantları (M7a–M9).
# python3 -I m1k7-mutant.py <çıktı klasörü>
import os, subprocess, sys, time

ROOT = "/dev/shm/m1k7-mut/yeni"
OUT = sys.argv[1]
TESTS = [
    "test/kdv-ozeti-uyusmazlik-yonu-251.test.mjs",
    "test/kdv-ozeti-s4-guncel-degil-251.test.mjs",
    "test/kdv-ozeti-mahsup-sonrasi-251.test.mjs",
    "test/kdv-ozeti-devreden-onarim-251.test.mjs",
    "test/kdv-ozeti-karma-251.test.mjs",
    "test/kdv-ozeti-yalniz391-251.test.mjs",
]
TAX = "server/routes/tax.mjs"
RC = "server/routes/report-center.mjs"
RESTART = 'const restart = absorbShort ? firstStale || month : carryGap ? firstStale : "";'
FIND = '[...steps.values()].find(item => item.offsetState === "stale" || item.offsetState === "mixed" || mismatches.some(other => other.month === item.month))?.month || ""'
MUT = [
    # Tur 6 AYNEN (anlam):
    ("M1-yon-ayrimi-yok", TAX, "const absorbShort = Number(offset.carryInMinor) === carry && step.carried < offsetCarried;", "const absorbShort = false;"),
    ("M1b-yon-hep-eksi", TAX, "const absorbShort = Number(offset.carryInMinor) === carry && step.carried < offsetCarried;", "const absorbShort = Number(offset.carryInMinor) === carry;"),
    ("M2-onarim-son-guncel-degil", TAX, "const firstStale = [...steps.values()].find(", "const firstStale = [...steps.values()].reverse().find("),
    ("M2b-onarim-bu-ay", TAX, RESTART, 'const restart = absorbShort ? month : carryGap ? firstStale : "";'),
    ("M3-kisa-not-hep", TAX, "return same ? [] : before;", "return before;"),
    ("M4-kisa-not-hic", TAX, "return same ? [] : before;", "return [];"),
    # Bu tur (devreden farkı kolu):
    ("M7a-devreden-bu-aydan", TAX, RESTART, 'const restart = absorbShort ? firstStale || month : carryGap ? month : "";'),
    ("M7b-devreden-eski-cumle", TAX, RESTART, 'const restart = absorbShort ? firstStale || month : carryGap ? "" : "";'),
    ("M7c-rapor-yalniz-eksi-yon", RC, "const restart = list.map(item => item.restartMonth).filter(Boolean).sort()[0];", "const restart = list.filter(item => item.absorbShort).map(item => item.restartMonth).filter(Boolean).sort()[0];"),
    ("M8-devreden-son-guncel-degil", TAX, RESTART, f'const lastStale = {FIND.replace("[...steps.values()].find(", "[...steps.values()].reverse().find(")}; const restart = absorbShort ? firstStale || month : carryGap ? lastStale : "";'),
    ("M9-oncesizde-de-bu-ay", TAX, RESTART, 'const restart = absorbShort ? firstStale || month : carryGap ? firstStale || month : "";'),
    ("M9b-yalniz-mismatch-sayilmaz", TAX, "const firstStale = [...steps.values()].find(item => item.offsetState === \"stale\" || item.offsetState === \"mixed\" || mismatches.some(other => other.month === item.month))", "const firstStale = [...steps.values()].find(item => item.offsetState === \"stale\" || item.offsetState === \"mixed\")"),
]
summary = []
for name, rel, old, new in MUT:
    path = os.path.join(ROOT, rel)
    orig = open(path, encoding="utf-8").read()
    assert orig.count(old) == 1, f"{name}: hedef {orig.count(old)} kez"
    open(path, "w", encoding="utf-8").write(orig.replace(old, new))
    try:
        parts = []
        for tz in ("UTC", "Europe/Istanbul"):
            env = dict(os.environ, HUKUK_LICENSE_URL="http://127.0.0.1:9", TZ=tz)
            t0 = time.time()
            r = subprocess.run(["node", "--disable-warning=ExperimentalWarning", "--test", "--test-concurrency=1", *TESTS], cwd=ROOT, env=env, capture_output=True, text=True, timeout=1500)
            text = r.stdout + r.stderr
            open(os.path.join(OUT, f"m1k7-mut-{name}-{tz.replace('/', '-')}.txt"), "w", encoding="utf-8").write(text)
            counts = {k: next((l.split()[-1] for l in text.splitlines() if l.startswith(f"# {k} ")), "?") for k in ("tests", "pass", "fail")}
            failed = [l.strip()[:160] for l in text.splitlines() if l.startswith("    not ok")]
            parts.append(f"{tz}: çıkış {r.returncode} · tests {counts['tests']} pass {counts['pass']} fail {counts['fail']} · {round(time.time() - t0)} sn · {'YAKALANDI' if r.returncode != 0 else 'YAŞADI'}")
            for f in failed[:4]:
                parts.append(f"    {f}")
    finally:
        open(path, "w", encoding="utf-8").write(orig)
    line = f"{name}:\n  " + "\n  ".join(parts)
    summary.append(line)
    print(line, flush=True)
open(os.path.join(OUT, "m1k7-mutant-ozet.txt"), "w", encoding="utf-8").write("\n".join(summary) + "\n")
print("BITTI", flush=True)
