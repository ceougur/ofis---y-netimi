#!/usr/bin/env python3
"""Senaryo JSON'larını depodaki düzende yazar (üst düzey girinti 1; sözlük öğesi / adım başına bir satır; dizgi listesi tek satır).
Kullanım: python3 -I bicim.py <dosya>... (yerinde yeniden biçimler) — ya da içe aktarılıp yaz(yol, sözlük)."""
import json
import sys


def c(x):
    return json.dumps(x, ensure_ascii=False)


def metin(s):
    satir = ["{"]
    ogeler = list(s.items())
    for n, (k, v) in enumerate(ogeler):
        son = "" if n == len(ogeler) - 1 else ","
        if isinstance(v, dict) and v:
            satir.append(" %s: {" % c(k))
            ic = list(v.items())
            for m, (k2, v2) in enumerate(ic):
                satir.append("  %s: %s%s" % (c(k2), c(v2), "" if m == len(ic) - 1 else ","))
            satir.append(" }" + son)
        elif isinstance(v, list) and v and not all(isinstance(x, str) for x in v):
            satir.append(" %s: [" % c(k))
            for m, x in enumerate(v):
                satir.append("  %s%s" % (c(x), "" if m == len(v) - 1 else ","))
            satir.append(" ]" + son)
        else:
            satir.append(" %s: %s%s" % (c(k), c(v), son))
    satir.append("}")
    return "\n".join(satir) + "\n"


def yaz(yol, s):
    with open(yol, "w", encoding="utf-8") as f:
        f.write(metin(s))


if __name__ == "__main__":
    for p in sys.argv[1:]:
        with open(p, encoding="utf-8") as f:
            s = json.load(f)
        yaz(p, s)
