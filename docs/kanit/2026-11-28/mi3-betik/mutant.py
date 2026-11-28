#!/usr/bin/env python3
# Mİ tur 3 mutant koşucusu: her mutant /dev/shm/mi3-dk/mut kopyasında uygulanır, testi koşulur, dosya geri alınır.
import os, subprocess, sys, json, time
MUT = "/dev/shm/mi3-dk/mut"
OUT = "/tmp/claude-0/-home-user/de5e1cbf-7e68-5683-b7bb-f27655eaed4f/scratchpad/mi3-kanit/mutant"
os.makedirs(OUT, exist_ok=True)
ACC = "client/assets/hof-accounts.js"
COL = "server/lib/account-collections.mjs"
SCEN = ["node", "--disable-warning=ExperimentalWarning", "test/e2e/senaryo-mi2-251.mjs"]
UNIT = ["node", "--test", "test/mi2-grup-ozeti-251.test.mjs"]
MUTANTS = [
    ("M1-kosul-eski", ACC, "const explicitOnly = () => Boolean(view.paid) || applied.paid;", "const explicitOnly = () => Boolean(view.paid) && periodReady();", SCEN),
    ("M2-pdf-donemsiz", ACC,
     "const listPdfUrl = () => `/api/workspace/accounts/liste.pdf?${query()}&title=${encodeURIComponent(moduleName())}`;",
     "const listPdfUrl = () => `/api/workspace/accounts/liste.pdf?${new URLSearchParams({ q: view.q, type: view.type, group: view.group, subgroup: view.subgroup, status: view.status, balance: view.balance, sort: view.sort })}&title=${encodeURIComponent(moduleName())}`;", SCEN),
    ("M3-diger-kapali", COL, 'add(row.accountId, Number(row.odd) ? "other" : methodWay(row.method), row.minor);', 'add(row.accountId, methodWay(row.method), row.minor);', UNIT),
    ("M4-bekleme-yok", ACC, "    if (view.period && !periodReady()) return;\n    applied.period = view.period;", "    applied.period = view.period;", SCEN),
    ("M5-bekleyen-yazi-yok", ACC, 'const hint = periodPending() ? `<small class="hof-muted" data-period-pending>${esc(pendingWhy + pendingNow)}</small>` : "";', 'const hint = periodPending() ? `<small class="hof-muted" data-period-pending>${esc(pendingWhy)}</small>` : "";', SCEN),
]
only = set(sys.argv[1:])
res = []
for name, rel, old, new, cmd in MUTANTS:
    if only and name not in only:
        continue
    path = os.path.join(MUT, rel)
    src = open(path, encoding="utf-8").read()
    assert src.count(old) == 1, f"{name}: eşleşme {src.count(old)}"
    open(path, "w", encoding="utf-8").write(src.replace(old, new))
    try:
        env = dict(os.environ, HUKUK_LICENSE_URL="http://127.0.0.1:9", EKRAN_DIR=f"{OUT}/ekran-{name}", TZ="UTC")
        t0 = time.time()
        p = subprocess.run(["timeout", "-k", "5", "900"] + cmd, cwd=MUT, env=env, capture_output=True, text=True)
        out = p.stdout + p.stderr
        open(f"{OUT}/{name}.txt", "w", encoding="utf-8").write(out)
        fails = [l.strip() for l in out.splitlines() if l.strip().startswith(("✗", "not ok"))]
        res.append({"mutant": name, "cikis": p.returncode, "sure_sn": round(time.time() - t0), "kirmizi": fails[:8]})
    finally:
        open(path, "w", encoding="utf-8").write(src)
    print(json.dumps(res[-1], ensure_ascii=False), flush=True)
json.dump(res, open(f"{OUT}/ozet.json", "w", encoding="utf-8"), ensure_ascii=False, indent=1)
