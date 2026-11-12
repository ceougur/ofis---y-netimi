# Ç5-A tur 1d İş F mutasyonu (ders 7): kopyada (c5a1d-f) her seferinde TEK hata; eşdeğerlik testleri koşulur; kırmızı + beklenen neden → YAKALANDI; kopya geri yazılır.
import pathlib, re, subprocess, sys, os
COPY = pathlib.Path(sys.argv[1])
OUT = []
L = COPY / "server/routes/ledger.mjs"
O = COPY / "server/lib/ledger-opening.mjs"
MUT = [
    (1, "süzgeçli yolda taksit satırlarının kartları kapsama girmez (yalnız out.plans)", L,
     "{ ids: [...out.plans.map(plan => plan.id), ...out.planEntries.map(entry => entry.planId)] }", "{ ids: [...out.plans.map(plan => plan.id)] }",
     r"taksit satırı .*süzgeçli türetmede olmalı|süzgeçli ↔ süzgeçsiz"),
    (2, "karar yalnız kart okununca sorulur (taksit satırı tek başına okununca sorulmaz)", L,
     "if (imported && (out.plans.length || out.planEntries.length)) {\n        const pinned", "if (imported && out.plans.length) {\n        const pinned",
     r"taksit satırı .*süzgeçli türetmede olmalı|süzgeçli ↔ süzgeçsiz"),
    (3, "kart süzgeci ters (ids DIŞINDAKİ kartlar)", O,
     'AND NOT p.covers_balance${scoped ? " AND p.id IN (SELECT value FROM json_each(?))" : ""}', 'AND NOT p.covers_balance${scoped ? " AND p.id NOT IN (SELECT value FROM json_each(?))" : ""}',
     r"tek başına|bütün kartlar birden|süzgeçli"),
    (4, "açılış satırları süzgeçte başka kartınkiler (openings kapsamı boş)", O,
     'AND NOT p.covers_balance${scoped ? " AND e.plan_id IN (SELECT value FROM json_each(?))" : ""}', 'AND NOT p.covers_balance${scoped ? " AND e.plan_id IN (SELECT value FROM json_each(?)) AND 0" : ""}',
     r"tek başına|bütün kartlar birden|süzgeçli"),
]
env = dict(os.environ, HUKUK_LICENSE_URL="http://127.0.0.1:9")
caught = 0
for no, name, f, a, b, reason in MUT:
    src = f.read_text()
    n = src.count(a)
    if n != 1:
        OUT.append(f"[mutant {no}] {name} · UYGULANAMADI (eşleşme {n})")
        continue
    f.write_text(src.replace(a, b))
    try:
        r = subprocess.run(["timeout", "-k", "5", "1200", "node", "--test", "--test-concurrency=1", "test/defter-hiz-esdegerlik-tur1d-250.test.mjs", "test/defter-hiz-esdegerlik-250.test.mjs"], cwd=COPY, env=env, capture_output=True, text=True)
        out = r.stdout + r.stderr
        fail = re.search(r"# fail (\d+)", out)
        ok = r.returncode != 0 and re.search(reason, out)
        why = " ‖ ".join([l.strip()[:200] for l in out.splitlines() if "error: " in l and "subtests failed" not in l][:2])
        OUT.append(f"[mutant {no}] {name} · {'YAKALANDI' if ok else ('KIRMIZI AMA NEDEN YOK' if r.returncode else 'YAŞADI')} · fail {fail.group(1) if fail else '?'} · {why}")
        caught += 1 if ok else 0
    finally:
        f.write_text(src)
OUT.append(f"[mutasyon özet] {caught}/{len(MUT)} yakalandı")
print("\n".join(OUT))
