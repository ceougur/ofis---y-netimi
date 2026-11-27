#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""Kâhin bakımı 7 (cari) — testin dişi (ders 7, 38): bakım 7'nin yeni / değişen elle tabloları ESKİ (bakım 6) kâhinde BEKLENEN NEDENLE kırmızı mı. Program AÇILMAZ.

  python3 -I kirmizi-eski.py --model <ESKİ cari klasörü> <senaryo.json>…

(1) Her dosya eski kâhinde koşulur; yeni adım türü (`stok_satis_taksit`) eski kâhinde YOKTUR → koşu hata verir: dosyanın bütün elle denetimleri kırmızı sayılır, neden (hata iletisi) yazılır.
(2) Yeni adım türü kullanan dosyadan ELLE yol satırları (yalnız `kart_ac` ile `stok_satis_hesap` / `stok_iade` / tahsilat / fatura / borç / kart tahsilatı kullanan cariler) ayrı bir senaryoya
    çıkarılır (adımlar ve o carilerin elle denetimleri aynen) ve eski kâhinde koşulur: G2 (b) reddi ve SK-18 susması eski kâhinde yok → kırmızılar, eski değerleriyle dökülür.
Son satırlar: kırmızı / toplam. Çıkış 0 yalnız en az bir kırmızı varsa ve (1)'in her hatası "stok_satis_taksit" adını taşıyorsa (beklenen neden)."""
import importlib.util
import json
import os
import sys

MODEL = os.path.abspath(sys.argv[sys.argv.index("--model") + 1])
dosyalar = [a for i, a in enumerate(sys.argv[1:], 1) if a.endswith(".json") and sys.argv[i - 1] != "--model"]
spec = importlib.util.spec_from_file_location("kahin_cari_kirmizi7", os.path.join(MODEL, "model.py"))
M = importlib.util.module_from_spec(spec)
spec.loader.exec_module(M)
kirmizi = toplam = 0
neden_tamam = True


def cari_of(k, sen):
    p = k.split(":")
    adim = {a["id"]: a for a in sen["adimlar"]}
    kc = {a["ad"]: a["cari"] for a in sen["adimlar"] if a["islem"] in ("kart_ac", "stok_satis_taksit")}
    if p[0] == "adim":
        a = adim.get(p[1], {})
        return a.get("cari") or kc.get(a.get("kayit"))
    if len(p) >= 4 and p[1] == "cari":
        return p[2]
    if len(p) >= 4 and p[1] == "kart":
        return kc.get(p[2])
    if len(p) >= 4 and p[1] == "hareket":
        return adim.get(p[2], {}).get("cari")
    if len(p) >= 4 and p[1] in ("takvim", "vadeTakip", "projeksiyon") and p[2] == "hareket":
        return adim.get(p[3], {}).get("cari")
    return None


def karsilastir(ad, sen):
    global kirmizi, toplam
    out, belirsiz = M.Model(json.loads(json.dumps(sen)), 0, "2.5.0").kos()["denetimler"], None
    belirsiz = M.Model(json.loads(json.dumps(sen)), 0, "2.5.0").kos()["belirsiz"]
    k0 = kirmizi
    for k, b in (sen.get("elleBeklenen") or {}).items():
        toplam += 1
        g = out.get(k, {}).get("b", "ANAHTAR YOK")
        if g != b:
            kirmizi += 1
            print("  ✗ %s %s: elle %s · ESKİ kâhin %s" % (ad, k, json.dumps(b, ensure_ascii=False), json.dumps(g, ensure_ascii=False)))
    for k in sen.get("elleYok") or []:
        toplam += 1
        if k in out:
            kirmizi += 1
            print("  ✗ %s %s: elle YOK · ESKİ kâhin %s" % (ad, k, json.dumps(out[k]["b"], ensure_ascii=False)))
    for parca in sen.get("elleBelirsiz") or []:
        toplam += 1
        parcalar = parca if isinstance(parca, list) else [parca]
        if not any(all(x in b for x in parcalar) for b in belirsiz):
            kirmizi += 1
            print("  ✗ %s belirsiz kaydı ESKİ kâhinde yok: %s" % (ad, " + ".join(parcalar)))
    print("%s: ESKİ kâhinde %d kırmızı" % (ad, kirmizi - k0))


for p in dosyalar:
    with open(p, encoding="utf-8") as f:
        sen = json.load(f)
    ad = os.path.basename(p)
    n = len(sen.get("elleBeklenen") or {}) + len(sen.get("elleYok") or []) + len(sen.get("elleBelirsiz") or [])
    try:
        karsilastir(ad, sen)
        continue
    except Exception as e:  # noqa: BLE001 — eski kâhinde yeni adım türü yok: koşu hatası beklenen kırmızıdır
        toplam += n
        kirmizi += n
        ok = "stok_satis_taksit" in str(e)
        neden_tamam = neden_tamam and ok
        print("  ✗ %s ESKİ kâhinde koşmadı (%s: %s) — %d elle denetimin hepsi kırmızı; neden %s" % (ad, type(e).__name__, e, n, "BEKLENEN (yeni adım türü yok)" if ok else "BEKLENMEYEN"))
    if not any(a["islem"] == "stok_satis_taksit" for a in sen["adimlar"]):
        continue
    yeni_adim_cari = {a["cari"] for a in sen["adimlar"] if a["islem"] == "stok_satis_taksit"}
    elle_cari = {a["cari"] for a in sen["adimlar"] if a["islem"] == "kart_ac"} - yeni_adim_cari
    if not elle_cari:
        continue
    alt = dict(sen, ad=sen["ad"] + "-elle-yol", adimlar=[a for a in sen["adimlar"] if a["islem"] == "kontrol" or (a.get("cari") or (a["ad"] if a["islem"] == "cari_ac" else None)
                                                                                                                        or next((b["cari"] for b in sen["adimlar"] if b["islem"] == "kart_ac" and b["ad"] == a.get("kayit")), None)) in elle_cari])
    alt["elleBeklenen"] = {k: v for k, v in (sen.get("elleBeklenen") or {}).items() if cari_of(k, sen) in elle_cari}
    alt["elleYok"] = [k for k in (sen.get("elleYok") or []) if cari_of(k, sen) in elle_cari]
    alt["elleBelirsiz"] = [x for x in (sen.get("elleBelirsiz") or []) if any(("adım k" + c.lower()) in " ".join(x) or ("cari %s " % c) in " ".join(x) for c in elle_cari)]
    print("  (%s'den elle yol satırları: cariler %s — %d adım, %d + %d + %d elle denetim)" % (ad, ", ".join(sorted(elle_cari)), len(alt["adimlar"]), len(alt["elleBeklenen"]), len(alt["elleYok"]),
                                                                                         len(alt["elleBelirsiz"])))
    karsilastir(alt["ad"], alt)
print("ESKİ KÂHİN KIRMIZISI: %d/%d elle denetim kırmızı (beklenen: kırmızı > 0; koşmayan dosyaların nedeni yeni adım türü)" % (kirmizi, toplam))
ok = kirmizi > 0 and neden_tamam
print("# tests 1")
print("# pass %d" % ok)
print("# fail %d" % (not ok))
print("%d/1 denetim geçti" % ok)
sys.exit(0 if ok else 1)
