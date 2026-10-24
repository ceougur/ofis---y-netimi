# G1 mutasyon koşucusu: her mutasyon kopyadaki invoices.mjs'e uygulanır, yeni test koşulur; testin KIRMIZI olması = yakalandı.
import subprocess, sys, pathlib
root = pathlib.Path(sys.argv[1])
src = root / "server/routes/invoices.mjs"
orig = src.read_text()
FIX = 'if (row.status !== "draft") period?.assertOpen(row.issue_date, `Bu ${label.toLocaleLowerCase("tr-TR")}`);'
assert orig.count(FIX) == 1
HOLDER = "    const holder = numberHolder(row);\n"
muts = {
  "M1 kilit denetimi kaldırıldı": orig.replace(FIX, "/* M1 */"),
  "M2 taslak istisnası kaldırıldı (taslak da reddedilir)": orig.replace(FIX, FIX.replace('if (row.status !== "draft") ', "")),
  "M3 yanlış tarih (belge tarihi yerine bugün)": orig.replace(FIX, FIX.replace("row.issue_date", "today()")),
  "M4 kilit, numara (kalıcı ret) denetiminden önce": orig.replace(FIX, "").replace(HOLDER, "    " + FIX + "\n" + HOLDER),
  "M5 yalnız 'issued' denetlenir (iptal edilmiş/silinmiş belge kaçar)": orig.replace(FIX, FIX.replace('row.status !== "draft"', 'row.status === "issued"')),
}
caught = 0
for name, text in muts.items():
    assert text != orig, name
    src.write_text(text)
    try:
        r = subprocess.run(["node", "--test", "test/silinenler-donem-kilidi-244.test.mjs"], cwd=root, capture_output=True, text=True, timeout=400)
    finally:
        src.write_text(orig)
    fails = [l for l in r.stdout.splitlines() if l.startswith("# fail")]
    ok = r.returncode != 0
    caught += ok
    first = next((l.strip() for l in r.stdout.splitlines() if l.strip().startswith("not ok")), "")
    print(f"{'YAKALANDI' if ok else 'KAÇTI'} · {name} · çıkış {r.returncode} · {fails[0] if fails else ''} · ilk kırmızı: {first[:160]}")
print(f"# tests {len(muts)}\n# pass {caught}\n# fail {len(muts) - caught}\n# cancelled 0\n# skipped 0\n# todo 0")
sys.exit(0 if caught == len(muts) else 1)
