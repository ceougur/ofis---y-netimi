"""Hız kabul tablosu (üç sütun): Ç5-B öncesi / bugün / benim kodum — en iyi / ortanca (n) + fark % (öncesine göre). Kullanım: kabul-tablo.py <çıktı klasörü>
Ayrıştırma ana oturumun tablosuyla (c5by-kabul-tablo.py) aynı düzenli ifadeler; yük > 2 görülen koşu 'GEÇERSİZ' diye işaretlenir."""
import glob, os, re, sys

S = sys.argv[1]
T, order, yuk, bad = {}, [], {}, []
for p in sorted(glob.glob(S + "/*-*.txt")):
    ad = os.path.basename(p).split("-")[0]
    for l in open(p, encoding="utf-8", errors="replace"):
        if "GEÇERSİZ" in l:
            bad.append(os.path.basename(p))
        m = re.match(r"açılış (\d+) ms", l)
        if m:
            k = "açılış"
            T.setdefault((k, ad), []).append(float(m.group(1)))
            (k in order) or order.append(k)
            continue
        m = re.match(r"tur \d · yük ([\d.]+)", l) or re.match(r"=== .* başta ([\d.]+)", l)
        if m:
            yuk.setdefault(ad, []).append(float(m.group(1)))
            continue
        m = re.match(r"\s*(.+?)(?: #\d)?(?: \((?:cari|en kalabalık).*?\))?: (?:durum )?(\d+) · (?:toplam )?([\d.]+) ms", l)
        if m:
            k = m.group(1).strip()[:34]
            if m.group(2) != "200":
                k += " [durum " + m.group(2) + "]"
            T.setdefault((k, ad), []).append(float(m.group(3)))
            (k in order) or order.append(k)
print("yük (en az–en çok):", {a: (min(v), max(v)) for a, v in yuk.items()}, "· GEÇERSİZ koşu:", sorted(set(bad)) or "yok")


def em(v):
    v = sorted(v)
    n = len(v)
    return (v[0], v[n // 2] if n % 2 else (v[n // 2 - 1] + v[n // 2]) / 2, n)


f = lambda x, y: (x / y - 1) * 100 if y else 0
print("yol | Ç5-B öncesi en iyi/ortanca (n) | bugün | benim | bugün fark % | BENİM fark % (öncesine göre; en iyi/ortanca)")
for k in order:
    a, b, c = T.get((k, "once")), T.get((k, "bugun")), T.get((k, "benim"))
    if not (a and b and c):
        print(f"{k:36} eksik {bool(a)} {bool(b)} {bool(c)}")
        continue
    A, B, C = em(a), em(b), em(c)
    flag = " <<< %10 ÜSTÜ" if (f(C[0], A[0]) > 10 and f(C[1], A[1]) > 10) else (" < tek ölçüde" if (f(C[0], A[0]) > 10 or f(C[1], A[1]) > 10) else "")
    print(f"{k:36} {A[0]:.0f}/{A[1]:.0f} ({A[2]}) | {B[0]:.0f}/{B[1]:.0f} ({B[2]}) | {C[0]:.0f}/{C[1]:.0f} ({C[2]}) | {f(B[0], A[0]):+.0f}/{f(B[1], A[1]):+.0f} | {f(C[0], A[0]):+.0f}/{f(C[1], A[1]):+.0f}{flag}")
