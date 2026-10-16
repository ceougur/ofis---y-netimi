# Bağımsız kâhin (Python; programın kodunu kullanmaz): örnek JSON gövdelerinden beklenen matrah / KDV / tevkifat / ödenecek tutarı hesaplar ve programın
# ürettiği XML'deki LegalMonetaryTotal değerleriyle karşılaştırır. Kural: iskonto tutarları kuruşa yuvarlanır (satır iskontosu brütten; genel iskonto
# satır iskontosundan sonra kalandan), KDV ve tevkifat kuruşa. Kullanım: python3 -I docs/fatura/ornek/kahin.py docs/fatura/ornek/cikti
import json, re, sys
from decimal import Decimal, ROUND_HALF_UP
from pathlib import Path
q = lambda x: Decimal(x).quantize(Decimal("0.01"), ROUND_HALF_UP)
WH = {"602": (9, 10), "612": (9, 10), "616": (5, 10)}
out = Path(sys.argv[1]); bad = 0
for body_file in sorted(out.glob("[1-4]*.json")):
    body = json.loads(body_file.read_text(encoding="utf-8"))
    xml = body_file.with_suffix(".xml").read_text(encoding="utf-8")
    g = Decimal(str(body.get("discountRate", 0))) / 100
    net = vat = wh = Decimal(0)
    for l in body["lines"]:
        brut = q(Decimal(str(l["qty"])) * Decimal(str(l["unitPrice"])))
        d1 = q(brut * Decimal(str(l.get("discountRate", 0))) / 100)
        n = brut - d1 - q((brut - d1) * g)
        v = q(n * Decimal(str(l["vatRate"])) / 100)
        p, d = WH.get(l.get("withholdingCode", ""), (0, 1))
        net += n; vat += v; wh += q(v * p / d)
    total = re.search(r"<cac:LegalMonetaryTotal>([\s\S]*?)</cac:LegalMonetaryTotal>", xml).group(1)
    got = lambda t: Decimal(re.search(rf"<cbc:{t}[^>]*>([^<]+)<", total).group(1))
    ok = got("TaxExclusiveAmount") == net and got("PayableAmount") == net + vat - wh
    bad += not ok
    print(f"{'✓' if ok else '✗'} {body_file.stem}: matrah {net} KDV {vat} tevkifat {wh} ödenecek {net + vat - wh} ↔ XML {got('TaxExclusiveAmount')} / {got('PayableAmount')}")
print("fark:", bad); sys.exit(1 if bad else 0)
