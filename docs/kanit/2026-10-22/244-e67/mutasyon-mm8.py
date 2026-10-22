#!/usr/bin/env python3
"""E6 / E7 mutasyonları: her biri mutasyon kopyasına (e67-mutasyon) uygulanır, testler koşulur, kopya geri alınır.
Kullanım: python3 -I mutasyon.py <mutasyon kopyası> <çıktı klasörü>"""
import json, os, subprocess, sys, pathlib

M = pathlib.Path(sys.argv[1])
OUT = pathlib.Path(sys.argv[2])
OUT.mkdir(parents=True, exist_ok=True)
INV = "server/routes/invoices.mjs"
MIG = "server/lib/migrations.mjs"
E6 = ["test/numara-silinen-244.test.mjs", "test/goc-244-silinen-numara.test.mjs"]
E7 = ["test/ebelge-244-yerel-iptal.test.mjs", "test/ebelge-240-kontrol3.test.mjs", "test/ebelge-244-iptal-suresi.test.mjs"]

GL = "server/lib/general-ledger.mjs"
LG = "server/routes/ledger.mjs"
MM8 = ["test/yevmiye-sira-244.test.mjs"]
MUT = [
    ("N1 kimliğe geri dön (eski sıralama)", GL, MM8,
     "  out.sort(journalOrder);\n", "  out.sort((a, b) => (a.date === b.date ? (a.id < b.id ? -1 : 1) : a.date < b.date ? -1 : 1));\n"),
    ("N2 sınıf yok (yalnız yazım sırası)", GL, MM8,
     "  const byClass = classOf(a.id) - classOf(b.id);\n", "  const byClass = 0;\n"),
    ("N3 yazım sırası yok (sınıf, sonra kimlik)", GL, MM8,
     "  if (sa !== sb) return sa < sb ? -1 : 1;\n", ""),
    ("N4 yükleyici cari satırının rowid'ini vermez", LG, MM8,
     "`SELECT e.id, e.rowid AS seq, e.kind, e.amount, e.date, e.note, e.source,", "`SELECT e.id, e.kind, e.amount, e.date, e.note, e.source,"),
    ("N5 ters kayıt asıl fişten önce (sınıf sırası)", GL, MM8,
     '  "vat-offset-reverse": 71,\n', '  "vat-offset-reverse": 69,\n'),
]
summary = []
for name, rel, tests, old, new in MUT:
    path = M / rel
    original = path.read_text(encoding="utf-8")
    if original.count(old) != 1:
        summary.append({"mutasyon": name, "durum": f"UYGULANAMADI ({original.count(old)} eşleşme)"})
        continue
    path.write_text(original.replace(old, new), encoding="utf-8")
    try:
        env = dict(os.environ, HUKUK_LICENSE_URL="http://127.0.0.1:9")
        proc = subprocess.run(["node", "--disable-warning=ExperimentalWarning", "--test", *tests], cwd=M, env=env, capture_output=True, text=True, timeout=1500)
        text = proc.stdout + proc.stderr
        slug = name.split(" ")[0]
        (OUT / f"{slug}.log").write_text(text, encoding="utf-8")
        counts = {k: next((line.split()[-1] for line in text.splitlines() if line.startswith(f"# {k} ")), "?") for k in ("tests", "pass", "fail", "cancelled")}
        failed = [line.strip()[7:160] for line in text.splitlines() if line.strip().startswith("not ok") and " - " in line][:4]
        summary.append({"mutasyon": name, "cikis": proc.returncode, **counts, "yakalandi": proc.returncode != 0 and counts["fail"] not in ("0", "?"), "kirmizi": failed})
    finally:
        path.write_text(original, encoding="utf-8")
(OUT / "OZET.json").write_text(json.dumps(summary, ensure_ascii=False, indent=1), encoding="utf-8")
for row in summary:
    print(json.dumps(row, ensure_ascii=False))
# kanit.mjs özet satırları: her mutasyon bir "test"; geçen = testlerin YAKALADIĞI mutasyon, başarısız = hayatta kalan (ya da uygulanamayan).
caught = sum(1 for row in summary if row.get("yakalandi"))
print(f"# tests {len(summary)}")
print(f"# pass {caught}")
print(f"# fail {len(summary) - caught}")
print("# cancelled 0")
print("# skipped 0")
print("# todo 0")
sys.exit(0 if caught == len(summary) else 1)
