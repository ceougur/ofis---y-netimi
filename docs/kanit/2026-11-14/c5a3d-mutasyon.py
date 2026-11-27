import subprocess, sys
ROOT = sys.argv[1]
OUT = sys.argv[2]
M = [
  ("M1 etiket payı okumadan (eski tanım)", "server/routes/accounts.mjs",
   "...normalOf(entry), editable:", "doubtfulNormal: hasDoubtful && doubtfulSkipOf(entry), editable:"),
  ("M2 kısmi tutar = pay (120 yerine 128)", "server/routes/accounts.mjs",
   "doubtfulNormalPart: roundMoney((amountMinor - shareMinor) / 100)", "doubtfulNormalPart: roundMoney(shareMinor / 100)"),
  ("M3 pay = tutar iken yine tam etiket", "server/routes/accounts.mjs",
   "if (shareMinor >= amountMinor) return { doubtfulNormal: false };", "if (shareMinor >= amountMinor) return { doubtfulNormal: true };"),
  ("M4 pay 0 iken etiket yok", "server/routes/accounts.mjs",
   "if (shareMinor <= 0) return { doubtfulNormal: true };", "if (shareMinor <= 0) return { doubtfulNormal: false };"),
  ("M5 bildirim tutarın tamamını söyler", "server/routes/invoices.mjs",
   "const normal = list.reduce((sum, entry) => sum + entry.normalMinor, 0) / 100;", "const normal = total;"),
  ("M6 tamamı 128'den düşen satır listede kalır", "server/routes/invoices.mjs",
   ".filter(row => row.normalMinor > 0);", ".filter(row => row.normalMinor >= 0);"),
  ("M7 bildirim payı görmez (eski metin)", "server/routes/invoices.mjs",
   "if (!list.some(entry => entry.shareMinor > 0)) {", "if (true) {"),
]
lines = []
for name, rel, old, new in M:
    p = f"{ROOT}/{rel}"
    src = open(p, encoding="utf-8").read()
    assert src.count(old) == 1, name
    open(p, "w", encoding="utf-8").write(src.replace(old, new))
    try:
        r = subprocess.run(["timeout", "600", "node", "--test", "test/supheli-etiket-pay-250.test.mjs"], cwd=ROOT, capture_output=True, text=True, env={**__import__("os").environ, "TZ": "UTC"})
        fails = [l for l in r.stdout.splitlines() if l.startswith("# fail")]
        killed = r.returncode != 0
        lines.append(f"{name}: çıkış {r.returncode} {fails[0] if fails else '?'} → {'ÖLDÜ' if killed else 'YAŞADI'}")
    finally:
        open(p, "w", encoding="utf-8").write(src)
open(OUT, "w", encoding="utf-8").write("\n".join(lines) + "\n")
print("\n".join(lines))
