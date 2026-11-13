#!/usr/bin/env python3
# Ç5-A tur 2 İş 5 (S160) karşı mutantları: kendi worktree'mde tek tek açılır, S160 testi koşulur, dosya HEMEN geri yazılır.
import subprocess, os
W = "/home/user/ofis---y-netimi/.claude/worktrees/agent-a294d4187e1bf9872/"
N = "/tmp/claude-0/-home-user/de5e1cbf-7e68-5683-b7bb-f27655eaed4f/scratchpad/c5a2-k7"
F = "server/routes/invoices.mjs"
MUTS = [
 ("M1", "ret kaldırılır", 'const lock = period?.lockedUntil() || "";\n      if (lock) {', 'const lock = period?.lockedUntil() || "";\n      if (false) {'),
 ("M2", "kilit günü dahil değil (<)", "WHERE invoice_id = ?1 AND kind = 'in' AND date <= ?2", "WHERE invoice_id = ?1 AND kind = 'in' AND date < ?2"),
 ("M3", "evrak bağı sayılmaz", "AND ev.kind = 'receive' AND c.invoice_id <> ev.invoice_id", "AND ev.kind = 'receive' AND 0 AND c.invoice_id <> ev.invoice_id"),
 ("M4", "kural şüpheliye bağlanır", "WHERE invoice_id = ?1 AND kind = 'in' AND date <= ?2", "WHERE invoice_id = ?1 AND kind = 'in' AND date <= ?2 AND account_id IN (SELECT account_id FROM doubtful_receivables)"),
 ("M5", "tahsilat yerine ödeme", "WHERE invoice_id = ?1 AND kind = 'in' AND date <= ?2", "WHERE invoice_id = ?1 AND kind = 'out' AND date <= ?2"),
]
env = dict(os.environ, HUKUK_LICENSE_URL="http://127.0.0.1:9", TZ="UTC")
for no, name, a, b in MUTS:
    p = W + F
    src = open(p, encoding="utf-8").read()
    if src.count(a) != 1:
        print(no, "UYGULANAMADI", src.count(a), flush=True); continue
    open(p, "w", encoding="utf-8").write(src.replace(a, b))
    try:
        r = subprocess.run(["timeout", "-k", "5", "600", "node", "--test", "--test-reporter=spec", "test/s160-kilitli-tahsilat-bagi-250.test.mjs"], cwd=W, env=env, capture_output=True, text=True)
        out = r.stdout + r.stderr
    finally:
        open(p, "w", encoding="utf-8").write(src)
    open(f"{N}/kanit/c5a2-is5-mutant-{no}.out", "w").write(out)
    fails = [l.strip() for l in out.splitlines() if l.startswith("  ✖")]
    print(no, name, "çıkış", r.returncode, "kırmızı test:", len(fails), "|", " ; ".join(f[:90] for f in fails), flush=True)
