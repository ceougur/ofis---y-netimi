# İstemci mutasyonları (para etkili A1, A3, A7): kopyada bozulur, e2e senaryo-cari-243 koşar, geri yüklenir. Ortak e2e kilidiyle.
import subprocess, os, re
M = "/tmp/claude-0/-home-user/9cd0e60e-f0c5-5d7d-bc4f-899fff43162d/scratchpad/cari243-mut"
LOCK = "/tmp/claude-0/-home-user/9cd0e60e-f0c5-5d7d-bc4f-899fff43162d/scratchpad/e2e-243.lock"
MUTS = [
  ("MC1 A1 öneri yine kendiliğinden bağlar", "client/assets/hof-accounts.js",
   "              if (mine !== ticket || keyInput.value) return;\n",
   "              if (mine !== ticket || keyInput.value) return;\n              if (!owner) { keyInput.value = row.__hofKey; titleInput.value = HOF.plans.recordLabel(row); }\n"),
  ("MC2 A3 aynı ad onayı yok", "client/assets/hof-accounts.js",
   "            if (!go) return true;\n          }", "          }"),
  ("MC3 A7 hesapsız aktarım engeli yok", "client/assets/hof-workspace.js",
   "        if (modal?.dialog?.querySelector(\"form [data-bank-define-box]\")) throw",
   "        if (false) throw"),
]
for name, rel, old, new in MUTS:
    p = os.path.join(M, rel)
    src = open(p, encoding="utf8").read()
    if src.count(old) != 1:
        print(name, "UYGULANAMADI", src.count(old), flush=True); continue
    open(p, "w", encoding="utf8").write(src.replace(old, new))
    try:
        r = subprocess.run(["flock", LOCK, "node", "--disable-warning=ExperimentalWarning", "test/e2e/senaryo-cari-243.mjs"], cwd=M, capture_output=True, text=True, env={**os.environ, "HUKUK_LICENSE_URL": "http://127.0.0.1:9"}, timeout=1500)
        out = r.stdout
    finally:
        open(p, "w", encoding="utf8").write(src)
    red = [line.strip() for line in out.splitlines() if line.strip().startswith("✗")]
    tail = re.search(r"(\d+) geçti, (\d+) kaldı", out)
    print(f"{name}: çıkış {r.returncode}, {tail.group(0) if tail else '?'} -> {'YAKALANDI' if r.returncode != 0 else 'KAÇTI'}", flush=True)
    for line in red[:6]:
        print("    ", line[:170], flush=True)
