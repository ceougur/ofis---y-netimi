#!/usr/bin/env python3
# 31e tur 2 (A3, K45) mutasyonları: kopyada (a3-mutasyon) uygula, testi koş, geri yükle. Kaynak /home/user/wt/r31e-a3.
import os, re, shutil, subprocess, json
SRC = "/home/user/wt/r31e-a3"; B = "/tmp/claude-0/-home-user/456ebc12-8183-520e-989e-af270fef8a58/scratchpad/e1"; M = B + "/a3-mutasyon"; OUT = B + "/a3-mut"
INV = "server/routes/invoices.mjs"; T = ["test/ebelge-244-gonderim-izi.test.mjs"]
MUT = [
 ("N1-k45-iz-kapanmaz", 'if (current?.status && current.status !== "cancelled") store.tx(() => audit(user, CANCEL_FAILED', 'if (false) store.tx(() => audit(user, CANCEL_FAILED'),
 ("N2a-a3-hep-gonderim-iletisi", 'throw new HttpError(409, sending ? STATUS_STALE_TEXT : STATUS_REFRESHED_TEXT', 'throw new HttpError(409, STATUS_STALE_TEXT'),
 ("N2b-a3-hep-sorgu-iletisi", 'throw new HttpError(409, sending ? STATUS_STALE_TEXT : STATUS_REFRESHED_TEXT', 'throw new HttpError(409, STATUS_REFRESHED_TEXT'),
]
res = []
for name, old, new in MUT:
    p = os.path.join(M, INV); shutil.copy(os.path.join(SRC, INV), p); text = open(p, encoding="utf8").read()
    if text.count(old) != 1: res.append({"mutant": name, "applied": False}); print(name, "UYGULANAMADI"); continue
    open(p, "w", encoding="utf8").write(text.replace(old, new))
    pr = subprocess.run(["node", "--test", "--test-reporter=spec", "--disable-warning=ExperimentalWarning", *T], cwd=M, env=dict(os.environ, HUKUK_LICENSE_URL="http://127.0.0.1:9"), capture_output=True, text=True, timeout=1200)
    log = pr.stdout + pr.stderr; open(os.path.join(OUT, name + ".log"), "w", encoding="utf8").write(log); shutil.copy(os.path.join(SRC, INV), p)
    nums = {k: int(v) for k, v in re.findall(r"^ℹ (tests|pass|fail|cancelled|skipped) (\d+)", log, re.M)}
    failed = sorted(set(re.findall(r"^  ✖ ((?:K|R|U)\d+)", log, re.M))); reasons = sorted(set(re.findall(r"AssertionError \[ERR_ASSERTION\]: ([^\n]{0,100})", log)))[:3]
    killed = pr.returncode != 0 and nums.get("fail", 0) > 0
    res.append({"mutant": name, "exit": pr.returncode, **nums, "killed": killed, "failed": failed, "reasons": reasons}); print(name, "YAKALANDI" if killed else "HAYATTA KALDI", nums, failed, reasons)
json.dump(res, open(os.path.join(OUT, "ozet.json"), "w", encoding="utf8"), ensure_ascii=False, indent=1)
