"""Uzun satırlı belgede anahtar geçen satırları yazar (grep takılıyor). Kullanım: satir.py <dosya> <genişlik> <anahtar> [anahtar...] — bütün anahtarlar aynı satırda."""
import sys

path, width, keys = sys.argv[1], int(sys.argv[2]), sys.argv[3:]
for no, line in enumerate(open(path, encoding="utf-8").read().split("\n"), 1):
    if all(key in line for key in keys):
        print(f"=== {no} ({len(line)})")
        print(line[:width])
