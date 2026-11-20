"""S229 / S230 mutantları: kopyada tek değişiklik → s229 testi koşulur → kırmızı olmalı. Kullanım: python3 -I mutant.py <kopya kökü> <çıktı>"""
import pathlib
import shutil
import subprocess
import sys

ROOT = pathlib.Path(sys.argv[1])
OUT = pathlib.Path(sys.argv[2])
INV = "server/routes/invoices.mjs"
RC = "server/routes/report-center.mjs"
OV = "server/routes/overview.mjs"
MUTANTS = {
    "M1-kart-payini-dusme": [(INV, "const covered = Number(state?.covered) || 0;", "const covered = 0;")],
    "M2-net-true": [
        (RC, "invoices().openItems(day, { returns: true })", "invoices().openItems(day, { returns: true, net: true })"),
        (OV, "const open = invoices().openItems(day);", "const open = invoices().openItems(day, { net: true });"),
    ],
    "M3a-tam-alinan-taksitte-degil": [(INV, 'const name = open <= 0.005 && ["open", "partial", "overdue"].includes(state.state) ? "installment" : state.state;', "const name = state.state;")],
    "M3b-tam-alinan-acik-faturalarda-kalir": [(INV, ".filter(({ state, open }) => state && open > 0.005)", ".filter(({ state, open }) => state && (open > 0.005 || state.inPlan > 0.005))")],
    "M4-iki-karttan-biri": [(INV, "const covered = Number(state?.covered) || 0;", "const covered = Number(Object.values(state?.coveredBy || {})[0]) || 0;")],
    "M5a-mahsup-onerisi-eski": [(INV, "suggest: shownState(row, state)?.open ?? row.tryPayable", "suggest: state?.open ?? row.tryPayable")],
    "M6-anlik-durum-eski": [(INV, "shown: state ? shownState(row, state) : null", "shown: state ? (returns ? shownState(row, state) : state) : null")],
}
lines = []
for name, edits in MUTANTS.items():
    saved = {}
    ok = True
    for rel, old, new in edits:
        path = ROOT / rel
        text = saved.get(rel) or path.read_text(encoding="utf-8")
        saved.setdefault(rel, text)
        current = path.read_text(encoding="utf-8")
        if current.count(old) != 1:
            ok = False
            lines.append(f"{name}: UYGULANAMADI ({rel}: {current.count(old)} eşleşme)")
            break
        path.write_text(current.replace(old, new), encoding="utf-8")
    if ok:
        run = subprocess.run(["node", "--test", "test/s229-acik-fatura-kart-payi-250.test.mjs"], cwd=ROOT, capture_output=True, text=True, timeout=900)
        fails = [l.strip() for l in run.stdout.splitlines() if l.startswith("    not ok")]
        summary = [l for l in run.stdout.splitlines() if l.startswith("# fail") or l.startswith("# pass")]
        lines.append(f"{name}: çıkış {run.returncode} {' '.join(summary)} → {'YAKALANDI' if run.returncode else 'YAKALANMADI'}; kırmızı: {'; '.join(f[:70] for f in fails)}")
    for rel, text in saved.items():
        (ROOT / rel).write_text(text, encoding="utf-8")
OUT.write_text("\n".join(lines) + "\n", encoding="utf-8")
print("\n".join(lines))
