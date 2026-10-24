#!/usr/bin/env python3
# 31e E1-Y / İNCELE-1 / İNCELE-3 mutasyon koşucusu: kopyada (r31e-e1-mutasyon) bir değişiklik uygular, testi koşar, dosyayı geri yükler. Kaynak /home/user/wt/r31e-e1.
import os, re, shutil, subprocess, sys, json
SRC = "/home/user/wt/r31e-e1"
BASE = "/tmp/claude-0/-home-user/456ebc12-8183-520e-989e-af270fef8a58/scratchpad/e1/r31e-e1"
M = BASE + "/r31e-e1-mutasyon"
OUT = BASE + "/mutasyon"
INV = "server/routes/invoices.mjs"
T = ["test/ebelge-244-gonderim-izi.test.mjs"]
MUTANTS = [
    ("MA-durum-sorgula-korumasiz", 'if (!store.tx(() => (eGuardOf(doc.id) === guard ? (write(), true) : false)))', 'if (!store.tx(() => (write(), true)))'),
    ("MB-koruma-gonderim-izine-bakmaz", 'return JSON.stringify([row.status || "", row.adapter || "", row.at || "", intent]);', 'return JSON.stringify([row.status || "", row.adapter || "", row.at || ""]);'),
    ("MC-11048-ettnsiz-yanit-gonderildi", 'if (remote && remoteUuid && remoteUuid === String(doc.ettn || "").toLowerCase()) {', 'if (remote && (!remoteUuid || remoteUuid === String(doc.ettn || "").toLowerCase())) {'),
    ("MD-iptal-reddi-izi-kapatmaz", 'if (CANCEL_DEFINITE_CODES.has(code) || NOT_SENT_CODES.has(code)) store.tx(', 'if (false) store.tx('),
    ("ME-iz-yalniz-varlik", 'const cancelTraced = id => store.get("SELECT type FROM audit_events WHERE entity_id = ? AND type IN (?, ?) ORDER BY rowid DESC LIMIT 1", id, CANCEL_INTENT, CANCEL_FAILED)?.type === CANCEL_INTENT;', 'const cancelTraced = id => Boolean(store.get("SELECT 1 AS found FROM audit_events WHERE entity_id = ? AND type = ? LIMIT 1", id, CANCEL_INTENT));'),
    ("MF-belirsiz-iptal-de-izi-kapatir", 'if (CANCEL_DEFINITE_CODES.has(code) || NOT_SENT_CODES.has(code)) store.tx(', 'if (true) store.tx('),
    ("MG-ilk-iptal-kaydina-bakar", 'type IN (?, ?) ORDER BY rowid DESC LIMIT 1", id, CANCEL_INTENT, CANCEL_FAILED)', 'type IN (?, ?) ORDER BY rowid ASC LIMIT 1", id, CANCEL_INTENT, CANCEL_FAILED)'),
]
os.makedirs(OUT, exist_ok=True)
summary = []
for name, old, new in MUTANTS:
    path = os.path.join(M, INV)
    shutil.copy(os.path.join(SRC, INV), path)
    shutil.copy(os.path.join(SRC, T[0]), os.path.join(M, T[0]))
    text = open(path, encoding="utf8").read()
    if text.count(old) != 1:
        summary.append({"mutant": name, "applied": False, "count": text.count(old)}); print(name, "UYGULANAMADI", flush=True); continue
    open(path, "w", encoding="utf8").write(text.replace(old, new))
    proc = subprocess.run(["node", "--test", "--test-reporter=spec", "--disable-warning=ExperimentalWarning", *T], cwd=M, env=dict(os.environ, HUKUK_LICENSE_URL="http://127.0.0.1:9"), capture_output=True, text=True, timeout=1200)
    log = proc.stdout + proc.stderr
    open(os.path.join(OUT, f"{name}.log"), "w", encoding="utf8").write(log)
    shutil.copy(os.path.join(SRC, INV), path)
    nums = {k: int(v) for k, v in re.findall(r"^ℹ (tests|pass|fail|cancelled|skipped) (\d+)", log, re.M)}
    failed = sorted(set(re.findall(r"^  ✖ ((?:K|R|U)\d+[^(\n]{0,40})", log, re.M)))
    reasons = sorted(set(re.findall(r"AssertionError \[ERR_ASSERTION\]: ([^\n]{0,120})", log)))[:4]
    killed = proc.returncode != 0 and nums.get("fail", 0) > 0
    summary.append({"mutant": name, "exit": proc.returncode, **nums, "killed": killed, "failed": failed, "reasons": reasons})
    print(name, "YAKALANDI" if killed else "HAYATTA KALDI", nums, failed[:3], flush=True)
json.dump(summary, open(os.path.join(OUT, "ozet.json"), "w", encoding="utf8"), ensure_ascii=False, indent=1)
