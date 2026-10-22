#!/usr/bin/env python3
# E1/E4 mutasyon koşucusu: kopyada (e1-mutasyon) bir değişiklik uygular, testleri koşar, dosyayı geri yükler. Kaynak: /home/user/wt/e1.
import os, re, shutil, subprocess, sys, json

SRC = "/home/user/wt/e1"
M = "/tmp/claude-0/-home-user/456ebc12-8183-520e-989e-af270fef8a58/scratchpad/e1/e1-mutasyon"
OUT = "/tmp/claude-0/-home-user/456ebc12-8183-520e-989e-af270fef8a58/scratchpad/e1/mutasyon"
INV = "server/routes/invoices.mjs"
IPT = "server/lib/einvoice/iptal-suresi.mjs"
NEW_TEST = ["test/ebelge-244-gonderim-izi.test.mjs"]
UNCERTAIN_TESTS = ["test/ebelge-244-gonderim-izi.test.mjs", "test/gg243-gonderim.test.mjs", "test/esmm-gonderim-244.test.mjs", "test/ebelge-240-bitis-turu.test.mjs"]

MUTANTS = [
    ("M1-iz-yazilmaz", INV, 'if (doc.eStatus !== "draft") markSending(user, doc, link.id, { draft });', '/* M1 */', NEW_TEST),
    ("M2a-iz-yoldayken-silinir", INV, 'audit(user, SEND_INTENT, doc.id, { adapter, number: doc.number, ettn: doc.ettn, from: doc.eStatus || "none", ...(draft ? { draft: true } : {}) });\n    });',
     'audit(user, SEND_INTENT, doc.id, { adapter, number: doc.number, ettn: doc.ettn, from: doc.eStatus || "none", ...(draft ? { draft: true } : {}) });\n    });\n    queueMicrotask(() => store.run("UPDATE invoices SET e_adapter = \'\' WHERE id = ?", doc.id));', NEW_TEST),
    ("M2b-her-hatada-iz-geri-alinir", INV, 'const notSent = NOT_SENT_CODES.has(code);', 'const notSent = NOT_SENT_CODES.has(code) || !rejected;', UNCERTAIN_TESTS),
    ("M3a-11048-hic-bu-belge-degil", INV, 'if (!uuid && !id) return false;', 'return false;', NEW_TEST),
    ("M3b-11048-ettn-karsilastirilmaz", INV, 'if (uuid && uuid.toLowerCase() !== String(doc?.ettn || "").toLowerCase()) return false;', '', NEW_TEST),
    ("M3c-11048-numara-karsilastirilmaz", INV, 'if (id && id.toUpperCase() !== String(doc?.number || "").toUpperCase()) return false;', '', NEW_TEST),
    ("M3d-11048-yanit-ettn-denetlenmez", INV, 'if (remote && !(remote.uuid && String(remote.uuid).toLowerCase() !== String(doc.ettn || "").toLowerCase())) {', 'if (remote) {', NEW_TEST),
    ("M3e-11048-her-zaman-bu-belge", INV, 'if (!uuid && !id) return false;', 'return true;', NEW_TEST + ["test/ebelge-242-test-seri.test.mjs", "test/geri-yukleme-uyari-244.test.mjs"]),
    ("M4-iptal-izi-yazilmaz", INV, 'store.tx(() => audit(user, CANCEL_INTENT, existing.id, { number: existing.number, adapter: existing.eAdapter || "", from: current?.status || existing.eStatus || "" }));', '/* M4 */', NEW_TEST),
    ("M5-edmde-iptal-yeniden-gonderilir", INV, 'if (current?.status === "cancelled") {', 'if (false) {', NEW_TEST),
    ("M6a-11048-iletim-sayilir", IPT, 'SEND_DUPLICATE, "invoice.unnumbered"]', '"invoice.unnumbered"]', NEW_TEST),
    ("M6b-iz-iletim-sayilmaz", IPT, '      open = event.at || "";\n      continue;', '      continue;', NEW_TEST),
    ("M7-gonderirken-durum-sorgulanir", INV, 'if (busy.get(doc.id) === "sending") throw new HttpError(409, BUSY_TEXT.sending[0], { code: BUSY_TEXT.sending[1] });', '/* M7 */', NEW_TEST),
    ("M8-hic-gitmeyende-iz-kalir", INV, 'setE(user, doc.id, { status: doc.eStatus || "none", adapter: doc.eAdapter || "", message: error?.message || String(error) }', 'setE(user, doc.id, { status: doc.eStatus || "none", message: error?.message || String(error) }', NEW_TEST),
    ("M9-numara-birakilinca-iz-kalir", INV, "e_status = 'waiting', e_adapter = ?, e_profile = ?, e_message = ? WHERE id = ?\", adapter, row.profile", "e_status = 'waiting', e_profile = ?, e_message = ? WHERE id = ?\", row.profile", NEW_TEST),
]

os.makedirs(OUT, exist_ok=True)
only = sys.argv[1:] or None
summary = []
for name, rel, old, new, tests in MUTANTS:
    if only and name not in only:
        continue
    path = os.path.join(M, rel)
    shutil.copy(os.path.join(SRC, rel), path)
    text = open(path, encoding="utf8").read()
    count = text.count(old)
    if count != 1:
        summary.append({"mutant": name, "applied": False, "count": count})
        print(name, "UYGULANAMADI", count, flush=True)
        continue
    open(path, "w", encoding="utf8").write(text.replace(old, new))
    env = dict(os.environ, HUKUK_LICENSE_URL="http://127.0.0.1:9")
    proc = subprocess.run(["node", "--test", "--test-reporter=spec", "--disable-warning=ExperimentalWarning", *tests], cwd=M, env=env, capture_output=True, text=True, timeout=1500)
    log = proc.stdout + proc.stderr
    open(os.path.join(OUT, f"{name}.log"), "w", encoding="utf8").write(log)
    shutil.copy(os.path.join(SRC, rel), path)
    nums = {k: int(v) for k, v in re.findall(r"^ℹ (tests|pass|fail|cancelled|skipped) (\d+)", log, re.M)}
    failed = sorted(set(re.findall(r"^✖ (K\d+|U\d+|[^\n(]{0,60})", log, re.M)))
    killed = proc.returncode != 0 and nums.get("fail", 0) > 0
    summary.append({"mutant": name, "applied": True, "exit": proc.returncode, **nums, "killed": killed, "failed": [f.strip()[:70] for f in failed][:12]})
    print(name, "YAKALANDI" if killed else "HAYATTA KALDI", proc.returncode, nums, flush=True)
json.dump(summary, open(os.path.join(OUT, "ozet.json"), "w", encoding="utf8"), ensure_ascii=False, indent=1)
