#!/usr/bin/env python3
# Bağımsız beklenen hesap — haftalık ekran testi (ekran-hafta.mjs). Programın kodunu KULLANMAZ: Excel'den model.py'nin
# çıkardığı işlemler (veri/islemler.json: tutar, KDV, matrah Excel satırından hesaplanmış) + haftanın ek işlemleri
# (veri/hafta-ekler.json) muhasebe kurallarıyla toplanır. Çıktı: raporlarda görünmesi gereken sayılar.
# Kurallar (yaygın muhasebe programlarındaki gibi):
#   - Cari defter: satış faturası borç, alış/gider faturası alacak; faturada peşin ödeme/çek ayrı satır (karşı yön);
#     tahsilat alacak, ödeme borç; maaş: tahakkuk alacak + ödeme borç; Taksit penceresinden "Yeni Borç" kart borç.
#   - Kasa yalnız nakit; havale/EFT banka, POS/kredi kartı kart. Stok kartının ilk miktarı "Kasa'ya yansıt" ise Kasa çıkışı.
#   - Fatura kapama: faturada ödenen kendi faturasını kapatır; cari kartından bağsız tahsilat/ödeme aynı yöndeki en eski
#     açık faturayı kapatır (FIFO); taksit tahsilatı taksit kartını kapatır (faturayı değil; taksitli faturada açık =
#     kartın kalanı).
#   - KDV: satır KDV'si kuruşa yuvarlanır; KDV dahil fiyatta matrah = brüt × 100 / (100 + oran).
# Kullanım: python3 model-hafta.py <islemler.json> <hafta-ekler.json> <başlangıç> <bitiş> <çıktı.json>
import collections, json, sys
from decimal import Decimal as D, ROUND_HALF_UP

src, extra_src, FROM, TO, out = sys.argv[1:6]
data = json.load(open(src))
extras = json.load(open(extra_src))["ops"]
c2 = lambda x: D(str(x)).quantize(D("0.01"), ROUND_HALF_UP)
s = lambda x: str(c2(x))

order = lambda op: op["date"] + op["no"]
week = sorted([op for op in data["ops"] if op["type"] != "cari" and FROM <= op["date"] <= TO], key=order)
parents = {op["sale"] for op in week if op["type"] == "installment"}
base = sorted([op for op in data["ops"] if op["no"] in parents or (op["type"] == "installment" and op["sale"] in parents and op["date"] < FROM)], key=order)
assert all(op["date"] < FROM for op in base), "başlangıç işlemi haftanın içinde"
ops = base + week + sorted(extras, key=order)

ledger = collections.defaultdict(list)          # cari → [(tarih, borç, alacak, no)]
money = collections.defaultdict(list)           # yol (cash/bank/card) → [(tarih, giriş, çıkış)]
stock = collections.defaultdict(lambda: D(0))
for p in data["products"]:
    stock[p["code"]] = D(0)
invoices = []                                   # {no, side, date, cari, net, vat, payable, paid, mode}
plans = {}                                      # anahtar → {total, paid, cari}
cheques = {"in": [D(0), 0], "out": [D(0), 0]}
unbound = collections.defaultdict(lambda: D(0))  # (cari, side) → FIFO ile kapatacak tutar
gider_net = []                                   # (tarih, matrah)
cari_name = {c["code"]: c["name"] for c in data["cari"]}
for code, name in data["personnel"]:
    cari_name[code] = name
for name in data["categories"]:
    cari_name[f"Gider: {name}"] = f"Gider: {name}"


def flow(method, date, inflow, amount):
    money[method].append((date, amount if inflow else D(0), D(0) if inflow else amount))


def line(qty, price, rate, included=False):
    base_amount = c2(D(str(qty)) * D(str(price)))
    if included:
        net = (base_amount * 100 / (100 + rate)).quantize(D("0.01"), ROUND_HALF_UP)
        return net, base_amount - net
    return base_amount, c2(base_amount * rate / 100)


for op in ops:
    t, day = op["type"], op["date"]
    if t in ("sale", "purchase") and "lines" not in op:
        sale = t == "sale"
        net, vat, payable = D(op["net"]), D(op["vat"]), D(op["payable"])
        inv = {"no": op["no"], "side": "sale" if sale else "purchase", "date": day, "cari": op["code"], "net": net, "vat": vat, "payable": payable, "paid": D(0), "mode": op["mode"]}
        stock[op["product"]] += D(str(op["qty"])) * (-1 if sale else 1)
        ledger[op["code"]].append((day, payable if sale else D(0), D(0) if sale else payable, op["no"]))
        if op["mode"] == "paid":
            flow(op["method"], day, sale, payable)
            inv["paid"] = payable
            ledger[op["code"]].append((day, D(0) if sale else payable, payable if sale else D(0), op["no"] + " ödeme"))
        elif op["mode"] == "cheque":
            cheques["in" if sale else "out"][0] += payable
            cheques["in" if sale else "out"][1] += 1
            inv["paid"] = payable
            ledger[op["code"]].append((day, D(0) if sale else payable, payable if sale else D(0), op["no"] + " evrak"))
        elif op["mode"] == "installments":
            plans[op["no"]] = {"total": payable, "paid": D(0), "cari": op["code"]}
        invoices.append(inv)
    elif t == "expense":
        cari = f"Gider: {op['category']}"
        gross, net, vat = D(op["gross"]), D(op["net"]), D(op["vat"])
        invoices.append({"no": op["no"], "side": "purchase", "date": day, "cari": cari, "net": net, "vat": vat, "payable": gross, "paid": gross, "mode": "paid"})
        gider_net.append((day, net))
        ledger[cari] += [(day, D(0), gross, op["no"]), (day, gross, D(0), op["no"] + " ödeme")]
        flow(op["method"], day, False, gross)
    elif t in ("collect", "pay"):
        inflow = t == "collect"
        amount = D(op["amount"])
        ledger[op["code"]].append((day, D(0) if inflow else amount, amount if inflow else D(0), op["no"]))
        if op.get("instrument"):
            cheques["in" if inflow else "out"][0] += amount
            cheques["in" if inflow else "out"][1] += 1
        else:
            flow(op["method"], day, inflow, amount)
        unbound[(op["code"], "sale" if inflow else "purchase")] += amount
    elif t == "installment":
        amount = D(op["amount"])
        ledger[op["code"]].append((day, D(0), amount, op["no"]))
        plans[op["sale"]]["paid"] += amount
        if op.get("instrument"):
            cheques["in"][0] += amount
            cheques["in"][1] += 1
        else:
            flow(op["method"], day, True, amount)
    elif t == "salary":
        amount = D(op["amount"])
        code = op.get("code") or op["ref"]
        ledger[code] += [(day, D(0), amount, op["no"] + " tahakkuk"), (day, amount, D(0), op["no"] + " ödeme")]
        flow(op["method"], day, False, amount)
    # ----- ek işlemler -----
    elif t == "newCari":
        cari_name[op["ref"]] = op["name"]
    elif t == "dupCari":
        pass
    elif t == "newItem":
        if op["kind"] == "product":
            stock[op["code"]] += D(str(op["openingQty"]))
            if op.get("openingCash"):
                flow("cash", day, False, c2(D(str(op["openingQty"])) * D(op["buy"])))
    elif t == "rent":
        gross = D(op["gross"])
        net, vat = line(1, gross, op["vatRate"], included=True)
        invoices.append({"no": op["no"], "side": "purchase", "date": day, "cari": op["ref"], "net": net, "vat": vat, "payable": gross, "paid": D(0), "mode": "open"})
        gider_net.append((day, net))
        ledger[op["ref"]].append((day, D(0), gross, op["no"]))
    elif t in ("stockIn", "stockOut"):
        incoming = t == "stockIn"
        stock[op["code"]] += D(str(op["qty"])) * (1 if incoming else -1)
        if op["method"] != "none":
            flow(op["method"], day, not incoming, c2(D(str(op["qty"])) * D(op["price"])))
    elif t in ("payEntry", "collectEntry"):
        inflow = t == "collectEntry"
        amount = D(op["amount"])
        ledger[op["ref"]].append((day, D(0) if inflow else amount, amount if inflow else D(0), op["no"]))
        flow(op["method"], day, inflow, amount)
        unbound[(op["ref"], "sale" if inflow else "purchase")] += amount
    elif t == "sale":
        net = vat = D(0)
        for ln in op["lines"]:
            n, v = line(ln["qty"], ln["price"], ln["vatRate"])
            net, vat = net + n, vat + v
            if ln["code"] == "YNI-U1":
                stock[ln["code"]] -= D(str(ln["qty"]))
        invoices.append({"no": op["no"], "side": "sale", "date": day, "cari": op["ref"], "net": net, "vat": vat, "payable": net + vat, "paid": D(0), "mode": "open"})
        ledger[op["ref"]].append((day, net + vat, D(0), op["no"]))
    elif t == "plan":
        plans[op["no"]] = {"total": D(op["total"]), "paid": D(0), "cari": op["ref"]}
        ledger[op["ref"]].append((day, D(op["total"]), D(0), op["no"]))
    elif t == "planCollect":
        amount = D(op["amount"])
        plans["EK-13"]["paid"] += amount
        ledger[op["ref"]].append((day, D(0), amount, op["no"]))
        flow(op["method"], day, True, amount)
    else:
        raise SystemExit(f"bilinmeyen tür {t}")

# FIFO: bağsız tahsilat/ödeme aynı yöndeki en eski açık faturayı kapatır; taksitli faturanın ödeneni = kartın ödeneni.
for inv in sorted(invoices, key=lambda i: (i["date"], i["no"])):
    if inv["mode"] == "installments":
        inv["paid"] = plans[inv["no"]]["paid"]
    elif inv["mode"] == "open":
        key = (inv["cari"], inv["side"])
        take = min(unbound[key], inv["payable"])
        inv["paid"] += take
        unbound[key] -= take
for inv in invoices:
    inv["open"] = inv["payable"] - inv["paid"]

period = lambda d: FROM <= d <= TO
expected = {"hafta": f"{FROM} – {TO}", "islem": {"baslangic": len(base), "hafta": len(week), "ek": len(extras)}}
expected["kasa"] = {}
for m in ("cash", "bank", "card"):
    rows = money[m]
    devir = sum((i - o for d, i, o in rows if d < FROM), D(0))
    expected["kasa"][m] = {"devir": s(devir), "giris": s(sum((i for d, i, o in rows if period(d)), D(0))), "cikis": s(sum((o for d, i, o in rows if period(d)), D(0))), "bakiye": s(sum((i - o for d, i, o in rows), D(0)))}
for side in ("sale", "purchase"):
    rows = [i for i in invoices if i["side"] == side and period(i["date"])]
    expected[f"fatura_{side}"] = {"adet": len(rows), "matrah": s(sum((i["net"] for i in rows), D(0))), "kdv": s(sum((i["vat"] for i in rows), D(0))), "odenecek": s(sum((i["payable"] for i in rows), D(0))), "kalan": s(sum((i["open"] for i in rows), D(0)))}
out_vat = sum((i["vat"] for i in invoices if i["side"] == "sale" and period(i["date"])), D(0))
in_vat = sum((i["vat"] for i in invoices if i["side"] == "purchase" and period(i["date"])), D(0))
expected["kdv"] = {"hesaplanan": s(out_vat), "indirilecek": s(in_vat), "sonuc": s(out_vat - in_vat)}
expected["gider"] = {"toplam": s(sum((n for d, n in gider_net if period(d)), D(0)))}
# Açık Faturalar raporu taksitli faturaları dışarıda bırakır (programın yazılı kuralı: "taksitli faturalar taksit kartında
# izlenir"); taksit kartlarının kalanı Taksit Kartları raporunda.
expected["acik_faturalar"] = {"alacak": s(sum((i["open"] for i in invoices if i["side"] == "sale" and i["mode"] != "installments"), D(0))), "borc": s(sum((i["open"] for i in invoices if i["side"] == "purchase" and i["mode"] != "installments"), D(0)))}
closing = {c: sum((b - a for d, b, a, n in rows), D(0)) for c, rows in ledger.items()}
expected["mizan"] = {
    "donem_borc": s(sum((b for rows in ledger.values() for d, b, a, n in rows if period(d)), D(0))),
    "donem_alacak": s(sum((a for rows in ledger.values() for d, b, a, n in rows if period(d)), D(0))),
    "borclular": s(sum((v for v in closing.values() if v > 0), D(0))),
    "alacaklilar": s(sum((-v for v in closing.values() if v < 0), D(0))),
}
expected["cari_listesi"] = {
    "toplam_borc": s(sum((b for rows in ledger.values() for d, b, a, n in rows), D(0))),
    "toplam_alacak": s(sum((a for rows in ledger.values() for d, b, a, n in rows), D(0))),
    "borclular": expected["mizan"]["borclular"],
    "alacaklilar": expected["mizan"]["alacaklilar"],
}
expected["cari_bakiye"] = {c: s(v) for c, v in sorted(closing.items())}
expected["taksit"] = {"kart": len(plans), "toplam": s(sum((p["total"] for p in plans.values()), D(0))), "odenen": s(sum((p["paid"] for p in plans.values()), D(0))), "kalan": s(sum((p["total"] - p["paid"] for p in plans.values()), D(0)))}
expected["cek"] = {"alinan": s(cheques["in"][0]), "alinan_adet": cheques["in"][1], "verilen": s(cheques["out"][0]), "verilen_adet": cheques["out"][1]}
expected["stok"] = {k: str(v.normalize()) if v == v.to_integral() else str(v) for k, v in sorted(stock.items())}
ext = [r for r in ledger["YNI-001"]]
expected["ekstre_YNI-001"] = {"hareket": len(ext), "borc": s(sum((b for d, b, a, n in ext), D(0))), "alacak": s(sum((a for d, b, a, n in ext), D(0))), "bakiye": s(closing["YNI-001"])}
expected["anlik"] = {
    "nakit_kasa": expected["kasa"]["cash"]["bakiye"],
    "banka_pos": s(D(expected["kasa"]["bank"]["bakiye"]) + D(expected["kasa"]["card"]["bakiye"])),
    "alacak_cari": expected["mizan"]["borclular"],
    "alacak_cek": expected["cek"]["alinan"],
    "borc_cari": expected["mizan"]["alacaklilar"],
    "borc_cek": expected["cek"]["verilen"],
}
expected["ek_faturalar"] = {i["no"]: {"odenecek": s(i["payable"]), "odenen": s(i["paid"]), "acik": s(i["open"])} for i in invoices if i["no"].startswith("EK-")}
json.dump(expected, open(out, "w"), ensure_ascii=False, indent=1)
print(json.dumps({k: v for k, v in expected.items() if k not in ("cari_bakiye", "stok")}, ensure_ascii=False, indent=1))
