"""WK 14: YENİ senaryoları (yeni senaryolar.json'daki girdi + elle beklenen) ESKİ kâhinde (taban 549359b0 kopyası) koşar.
Her yeni senaryo için: eski kâhin hata verdiyse iletisi, hesapladıysa elle beklenenle ilk fark. TAP: 'ok' = eski kâhinde BEKLENEN NEDENLE kırmızı
(ileti beklenen parçayı içeriyor), 'not ok' = aynı ya da başka nedenle kırmızı.
Kullanım: python3 -I eski_kahinle_yeni.py <eski kahin klasörü> <yeni senaryolar.json> <başlık> <beklenen hata parçası>"""
import json
import sys

eski_klasor, yeni_json, baslik, parca = sys.argv[1:5]
AYNI_BEKLE = len(sys.argv) > 5 and sys.argv[5] == "ayni"     # nötr kopya (bilgi): 'ok' = elle beklenenle AYNI
sys.dont_write_bytecode = True
sys.path.insert(0, eski_klasor)
import kahin  # noqa: E402  (ESKİ kâhin)

if not kahin.__file__.startswith(eski_klasor):
    print(f"Bail out! yanlış kâhin yüklendi: {kahin.__file__}")
    sys.exit(2)
print(f"# eski kâhin: {kahin.__file__}")
Y = json.load(open(yeni_json, encoding="utf-8"))
sen = [s for s in Y["senaryolar"] if s["baslik"] == baslik]


def d(o):
    return json.dumps(o, sort_keys=True, ensure_ascii=False)


gecen = 0
for i, s in enumerate(sen, 1):
    g = dict(s["girdi"])
    try:
        b = kahin.hesapla(g)
    except Exception as e:  # noqa: BLE001
        ileti = f"{type(e).__name__}: {e}"
        if parca in str(e):
            gecen += 1
            print(f"ok {i} - {s['ad']}: eski kâhinde KIRMIZI, BEKLENEN NEDEN — {ileti}")
        else:
            print(f"not ok {i} - {s['ad']}: eski kâhinde KIRMIZI ama BAŞKA NEDEN — {ileti}")
        continue
    farklar = []
    for e_ in s["elle"]:
        for yol, deger in e_["yollar"].items():
            m = kahin.yol_al(b[0]["sonuc"], yol)
            if d(m) != d(deger):
                farklar.append(f"{yol}: elle {d(deger)[:140]} ≠ eski {d(m)[:140]}")
    if farklar:
        print(f"not ok {i} - {s['ad']}: eski kâhinde DEĞERLE farklı (hata yok) — {farklar[0]}")
        for f in farklar[1:6]:
            print(f"  # {f}")
    elif AYNI_BEKLE:
        gecen += 1
        print(f"ok {i} - {s['ad']}: bu kopyada AYNI (elle beklenenin bütün yolları)")
    else:
        print(f"not ok {i} - {s['ad']}: eski kâhinde AYNI (kırmızı değil)")
n = len(sen)
print(f"1..{n}")
for ad, v in (("tests", n), ("pass", gecen), ("fail", n - gecen), ("cancelled", 0), ("skipped", 0), ("todo", 0)):
    print(f"# {ad} {v}")
sys.exit(0 if gecen == n and n > 0 else 1)
