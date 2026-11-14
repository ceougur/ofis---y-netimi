#!/usr/bin/env python3
# Mutasyon dosyalarındaki dize desenlerinden taşınacak bloklara düşenleri listeler (kullanım: python3 -I desen-tara.py <kök> <blok-tanımı.json>)
import re, glob, json, sys, os
root = sys.argv[1]
spec = json.load(open(sys.argv[2], encoding='utf-8'))
def lines(f, a, b):
    L = open(os.path.join(root, f), encoding='utf-8').read().split('\n')
    return '\n'.join(L[a-1:b])
moved = {f: [lines(f, a, b) for a, b in ranges] for f, ranges in spec.items()}
files = set(glob.glob(os.path.join(root, 'test/**/*.mjs'), recursive=True)) | set(glob.glob(os.path.join(root, 'tools/**/*.mjs'), recursive=True))
lit = re.compile(r'"((?:[^"\\\n]|\\.)*)"|`((?:[^`\\]|\\.)*)`')
for f in sorted(files):
    if 'mutasyon' not in f and 'mutant' not in f:
        continue
    src = open(f, encoding='utf-8').read()
    for m in lit.finditer(src):
        s = m.group(1) if m.group(1) is not None else m.group(2)
        if len(s) < 12:
            continue
        if m.group(1) is not None:
            try:
                u = json.loads('"' + s + '"')
            except Exception:
                u = s
        else:
            u = s
        for tf, blocks in moved.items():
            if any(u in b for b in blocks):
                ln = src[:m.start()].count('\n') + 1
                print(os.path.relpath(f, root), ln, tf, repr(u[:90]))
                break
