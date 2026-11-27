import re, sys
A = "/tmp/claude-0/-home-user/de5e1cbf-7e68-5683-b7bb-f27655eaed4f/scratchpad/c6h4-ag"
pat = re.compile(r"^  (Bilanço 20[\d-]+|Gelir Tablosu [^:]+|Değerleme [\d-]+|Şirket 2 [^:]+): durum \S+ · ilk ([\d.]+) ms \(olay döngüsü ([\d.]+) ms\) · en iyi ([\d.]+) ms · ortanca ([\d.]+) ms · en kötü [\d.]+ ms · olay döngüsü en çok ([\d.]+) ms \(n=\d+\) · özet (\w+)", re.M)
for kip in sys.argv[1:] or ["kilitsiz", "kilitli"]:
    for kod in ["eski", "yeni"]:
        txt = open(f"{A}/hiz-{kip}-{kod}.log", encoding="utf-8").read()
        for blok in txt.split("=== ")[1:]:
            head = blok.splitlines()[0]
            sira = re.search(r"sıra (\d)", head).group(1)
            yuk = re.search(r"başta yük ([\d.]+)", head).group(1)
            son = re.search(r"sonda yük ([\d.]+)", blok)
            don = re.search(r"donma \(bekleyen koşu\): ([\d.]+)", blok)
            print(f"## {kip} {kod} sıra {sira} · yük başta {yuk} sonda {son.group(1) if son else '?'} · donma {don.group(1) if don else '—'} ms")
            for m in pat.finditer(blok):
                print(f"   {m.group(1)[:34]:34} en iyi {m.group(4):>7} · ortanca {m.group(5):>7} · döngü en çok {m.group(6):>6} · {m.group(7)}")
