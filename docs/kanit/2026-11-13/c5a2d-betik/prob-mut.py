#!/usr/bin/env python3
# prob-mut.py <sonda.mjs> <çıktı öneki> Y10,Y11,... — sondayı her mutantla prob kopyasında koşar (mutant hemen geri yazılır).
import os, subprocess, sys, runpy
Q = "/tmp/claude-0/-home-user/de5e1cbf-7e68-5683-b7bb-f27655eaed4f/scratchpad/c5a2d-q"
mod = runpy.run_path(Q + "/betik/mutant.py", run_name="kutuphane")
probe, onek, names = sys.argv[1], sys.argv[2], sys.argv[3].split(",")
for no in names:
    p, src = mod["apply"](no, Q + "/prob/")
    try:
        env = dict(os.environ, ROOT=Q + "/prob", ETIKET=no, HUKUK_LICENSE_URL="http://127.0.0.1:9")
        with open(f"{Q}/{onek}-{no}.jsonl", "w") as out, open(f"{Q}/{onek}-{no}.err", "w") as err:
            rc = subprocess.run(["timeout", "-k", "5", "900", "node", "--disable-warning=ExperimentalWarning", probe], cwd=Q, env=env, stdout=out, stderr=err).returncode
    finally:
        open(p, "w", encoding="utf-8").write(src)
    print(no, "rc", rc, flush=True)
