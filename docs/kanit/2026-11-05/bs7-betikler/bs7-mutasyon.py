"""BS-7 mutasyon sürücüsü: her mutasyon HEAD'in (01934148) ayrı kopyasında (ders 23, 25); kanıt kaydı worktree'nin docs/kanit'ine."""
import os
import subprocess
import sys

BASE = os.path.dirname(os.path.abspath(__file__))
TAR = os.path.join(BASE, "yeni-01934148.tar")
WT = "/home/user/ofis---y-netimi/.claude/worktrees/agent-a03e5f6803e8339cb"
UNIT = ["node", "--test", "test/sema-kapisi-bs7.test.mjs"]
UF = ["node", "--test", "--test-name-pattern", "BS-7", "test/update-flow.test.mjs"]
E2E = ["node", "--disable-warning=ExperimentalWarning", "test/e2e/sema-kapisi-bs7.mjs"]

MUTATIONS = [
    ("m1-kapi-yok", "server/app.mjs", "const schemaGate = isSchemaAhead(schemaVersionAtOpen) ?", "const schemaGate = false && isSchemaAhead(schemaVersionAtOpen) ?", UNIT),
    ("m2-goc-dalı-yok", "server/lib/migrations.mjs", "  if (isSchemaAhead(current)) {\n", "  if (false) {\n", UNIT),
    ("m3-geri-donus-yok", "server/lib/update-orchestrator.mjs", "controller.restoreCompanies?.(info.companies", "controller.restoreCompaniesYOK?.(info.companies", UF),
    ("m4-001-geri-yukleme-engeli", "server/lib/company-backups.mjs", "if (liveVersion < LATEST_VERSION) throw", "if (liveVersion !== LATEST_VERSION) throw", UNIT),
    ("m5-query-only-yok", "server/app.mjs", '  if (schemaGate && hub) db.exec("PRAGMA query_only = ON");\n', "", UNIT),
    ("m6-arka-plan-kapisi-yok", "server/app.mjs", "const canWriteInBackground = () => !schemaGate && writeLock.guard", "const canWriteInBackground = () => writeLock.guard", UNIT),
    ("m7-iz-yazimi-acik", "server/app.mjs", "const audit = createAudit(store, { now: config.now, canWrite: () => !schemaGate });", "const audit = createAudit(store, { now: config.now, canWrite: () => true });", UNIT),
    ("m8-http-kapisi-yok", "server/app.mjs", "if (!schemaGate || SCHEMA_GATE_ALLOWED.some", "if (true || SCHEMA_GATE_ALLOWED.some", UNIT),
    ("m9-oncesi-yedek-yok", "server/supervisor.mjs", "entry.backup = createBackup(db, target.backupDir, { label, keep: backupKeep, company: target.company }).name;", "entry.backup = null;", UF),
    ("m10-serit-yok", "client/assets/hof-license.js", "    if (!gate) return;\n    html.classList.add", "    return;\n    html.classList.add", E2E),
]

only = set(sys.argv[1:])
for name, rel, old, new, cmd in MUTATIONS:
    if only and name not in only:
        continue
    work = os.path.join(BASE, f"mutasyon-{name}")
    if not os.path.isdir(work):
        os.makedirs(work)
        subprocess.run(["tar", "-xf", TAR, "-C", work], check=True)
    path = os.path.join(work, rel)
    text = open(path, encoding="utf8").read()
    if text.count(new) == 0 or new == "":
        assert text.count(old) == 1, (name, text.count(old))
        text = text.replace(old, new)
        open(path, "w", encoding="utf8").write(text)
    if cmd is E2E and not os.path.isdir(os.path.join(work, "node_modules")):
        subprocess.run(["npm", "ci", "--no-audit", "--no-fund"], cwd=work, check=True, capture_output=True)
    env = dict(os.environ, HUKUK_LICENSE_URL="http://127.0.0.1:9", KANIT_DIR=os.path.join(WT, "docs", "kanit"))
    out = subprocess.run(["timeout", "900", "node", os.path.join(WT, "tools", "kanit.mjs"), "kos", f"bs7-mutasyon-{name}", "--", *cmd], cwd=work, env=env, capture_output=True, text=True)
    lines = [line for line in out.stdout.splitlines() + out.stderr.splitlines() if "[kanit]" in line or line.startswith("  ✖")]
    print(f"== {name} (çıkış {out.returncode})")
    print("\n".join(lines[-6:]))
