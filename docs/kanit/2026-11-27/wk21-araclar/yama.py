#!/usr/bin/env python3
"""Basit yama aracı. Yama dosyası düz metin:
@@@ <dosya (whatsapp-248/ altına göre)>
<<<<
eski metin (satırlar)
====
yeni metin (satırlar)
>>>>
Her eski metin TAM bir kez geçmeli; hepsi geçerse yazılır (ya hep ya hiç)."""
import sys

KOK = "/home/user/ofis---y-netimi/.claude/worktrees/agent-a3cbae6158da1ba17/test/bagimsiz/whatsapp-248/"


def ayristir(metin):
    satirlar = metin.split("\n")
    i = 0
    dosya = None
    out = []
    while i < len(satirlar):
        s = satirlar[i]
        if s.startswith("@@@ "):
            dosya = s[4:].strip(); i += 1; continue
        if s == "<<<<":
            i += 1; eski = []
            while satirlar[i] != "====":
                eski.append(satirlar[i]); i += 1
            i += 1; yeni = []
            while satirlar[i] != ">>>>":
                yeni.append(satirlar[i]); i += 1
            i += 1
            out.append((dosya, "\n".join(eski) + "\n", "\n".join(yeni) + "\n" if yeni else ""))
            continue
        i += 1
    return out


def main(yol):
    degisiklikler = ayristir(open(yol, encoding="utf-8").read())
    metinler = {}
    for dosya, eski, yeni in degisiklikler:
        p = KOK + dosya
        if p not in metinler:
            metinler[p] = open(p, encoding="utf-8").read()
        n = metinler[p].count(eski)
        if n != 1:
            print(f"HATA {dosya}: eski metin {n} kez: {eski[:160]!r}")
            return 1
        metinler[p] = metinler[p].replace(eski, yeni)
    for p, s in metinler.items():
        open(p, "w", encoding="utf-8").write(s)
    print(f"tamam: {len(degisiklikler)} değişiklik, {len(metinler)} dosya")
    return 0


if __name__ == "__main__":
    sys.exit(main(sys.argv[1]))
