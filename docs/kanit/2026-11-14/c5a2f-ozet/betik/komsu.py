#!/usr/bin/env python3
# Tur 2f komşu taraması (ders 10): değişen üç sunucu dosyasını ADIYLA anan ya da Kural Farkı uçlarını / Mutabakat ipucunu okuyan bütün *.test.mjs + tur 2e listesi + yazım düzeni.
# Kullanım: python3 -I komsu.py <worktree> <çıktı>
import pathlib, re, sys
wt = pathlib.Path(sys.argv[1])
pat = re.compile(r"ledger-opening|ledger-snapshots|routes/ledger\.mjs|rule-diff|ruleDiff|Kural Farkı|ledger:rule-diff")
out = set()
for p in sorted((wt / "test").rglob("*.test.mjs")):
    if "e2e" in p.parts or "artifacts" in p.parts:
        continue
    if pat.search(p.read_text(encoding="utf-8", errors="replace")):
        out.add(str(p.relative_to(wt)))
for line in (wt / "docs/kanit/2026-11-14/c5a2e-ozet/komsu.txt").read_text(encoding="utf-8").split():
    if (wt / line).exists():
        out.add(line)
out.add("test/yazim-duzeni.test.mjs")
pathlib.Path(sys.argv[2]).write_text("\n".join(sorted(out)) + "\n", encoding="utf-8")
print(len(out))
