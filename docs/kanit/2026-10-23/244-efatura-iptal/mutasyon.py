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

INV = "server/routes/invoices.mjs"
SUR = "server/lib/einvoice/iptal-suresi.mjs"
T = ["test/ebelge-244-efatura-belirsiz-iptal.test.mjs", "test/ebelge-244-iptal-suresi.test.mjs"]
MUT = [
    ("G1 sorguyu atla (e-Faturada eski sınır)", INV, T,
     "const limit = edocEnabled ? uncertainWindow({", "const limit = edocEnabled && !EINVOICE_PROFILES.has(row.profile) ? uncertainWindow({"),
    ("G2 8 gün yerine 7 (yalnız belirsiz kapı)", SUR, T,
     "  const lastDay = addDays(start, CANCEL_WINDOW_DAYS);\n", "  const lastDay = addDays(start, label === \"e-Fatura\" ? CANCEL_WINDOW_DAYS - 1 : CANCEL_WINDOW_DAYS);\n"),
    ("G3 8 gün yerine 7 (ortak sabit)", SUR, T,
     "export const CANCEL_WINDOW_DAYS = 8;", "export const CANCEL_WINDOW_DAYS = 7;"),
    ("G4 EDM'de var → e-Fatura iletisi yok (genel ileti)", INV, T,
     "    if (EINVOICE_PROFILES.has(row.profile) && TRANSMITTED.has(remote.status)) throw", "    if (false) throw"),
    ("G5 bitiş iletisi e-Fatura dilinde değil", INV, T,
     "    if (!EINVOICE_PROFILES.has(row.profile)) return \"Yalnız programda iptal edildi (entegratöre iptal gönderilmedi). Entegratörde belge varsa orada ayrıca iptal edin.\";",
     "    return \"Yalnız programda iptal edildi (entegratöre iptal gönderilmedi). Entegratörde belge varsa orada ayrıca iptal edin.\";"),
    ("G6 bulunamadı da reddedilir", INV, T,
     "      if (remoteMissing(error, row.profile)) return true;", "      if (remoteMissing(error, row.profile) && !EINVOICE_PROFILES.has(row.profile)) return true;"),
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
