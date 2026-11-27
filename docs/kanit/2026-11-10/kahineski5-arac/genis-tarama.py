#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""Kâhin bakımı 5 (cari; bakım 4 aracının kopyası — saf_net artık bakım 5 okunuşu) — geniş rastgele tarama (program AÇILMAZ): uretici.py s1 tohum 1..N × işlem; HER kontrol kesiminde yeni kâhinin iki yönlü tek kuyruğu
(net250) oz-test.py'deki SAF simülasyonla (saf_net — model.py'den ayrı yazıldı) ve değişmezlerle karşılaştırılır:
  (a) model çökmeden koşar (2.5.0);  (b) okuma birliği olan yalın caride net kalanlar ve verilen avans satırları = saf_net (alanı: fatura / elle kayıt / Açılış / tahsilat / ödeme);
  (c) karşı yönlü kalemi olmayan yalın caride net = kendi tarafının kuyruğu (§13–§15 değişmedi);  (d) net kuyrukta (ii) Σ açık borç yönlü − Σ açık alacak yönlü = bakiye, tek yön açık;
  (e) gecikmiş yazıldıysa (i) 0 ≤ gecikmiş ≤ max(0, bakiye);  (f) net görünümü tanımsız caride ETKİN kaydın `hareket:*:kalan` / takvim kalemi YAZILMAMIŞ.

  python3 -I genis-tarama.py --model <cari klasörü> [--tohum 30] [--islem 120]
Son satır "N/M denetim geçti" (tools/kanit.mjs tanır)."""
import importlib.util
import json
import os
import subprocess
import sys
from collections import Counter


def arg(ad, vars_):
    return sys.argv[sys.argv.index(ad) + 1] if ad in sys.argv else vars_


K = os.path.abspath(arg("--model", "."))
TOHUM, ISLEM = int(arg("--tohum", "30")), int(arg("--islem", "120"))
spec = importlib.util.spec_from_file_location("kahin_cari_oz_genis", os.path.join(K, "oz-test.py"))
OZ = importlib.util.module_from_spec(spec)
spec.loader.exec_module(OZ)
M = OZ.M
gecen = kalan = 0
satirlar = []
say = Counter()


def denetle(ad, ok, ayrinti=""):
    global gecen, kalan
    if ok:
        gecen += 1
    else:
        kalan += 1
        if len(satirlar) < 60:
            satirlar.append("  ✗ %s %s" % (ad, ayrinti))


for t in range(1, TOHUM + 1):
    r = subprocess.run([sys.executable, "-I", os.path.join(K, "uretici.py"), "--tur", "s1", "--tohum", str(t), "--islem", str(ISLEM)], capture_output=True, check=True)
    sen = json.loads(r.stdout)
    ad = "rastgele-s1-%d" % t
    adimlar = sen["adimlar"]
    for kesim in [i + 1 for i, a in enumerate(adimlar) if a["islem"] == "kontrol"]:
        try:
            m, out = OZ.calistir(dict(sen, adimlar=adimlar[:kesim]))
        except Exception as e:  # noqa: BLE001
            denetle("%s@%d çökmeden koşar" % (ad, kesim), False, repr(e)[:200])
            continue
        say["kesim"] += 1
        k = adimlar[kesim - 1]["id"]
        for cari, c in m.cariler.items():
            if c.get("silindi"):
                continue
            nd = m.net_durum(cari)
            yalin = m._net_uygun(cari)[0]
            say["cari:" + nd[0]] += 1
            if nd[0] == "tanimsiz":
                say["tanimsiz:" + ("okuma ayrışıyor" if yalin else "tanım alanı dışı")] += 1
                # silinmiş kaydın "kalem değildir" ("yok") denetimi netleşmeden bağımsızdır (K6.3) — yalnız ETKİN kayıtlar aranır
                yazilan = [a for a in out if a.startswith(k + ":") and any(h["cari"] == cari and h["aktif"] and (a == "%s:hareket:%s:kalan" % (k, hn) or a == "%s:takvim:hareket:%s" % (k, hn))
                                                                          for hn, h in m.hareketler.items())]
                denetle("%s@%d %s tanımsız caride net görünüm yazılmamış" % (ad, kesim, cari), not yazilan, ",".join(yazilan[:3]))
            if yalin:
                N = m.net250(cari)
                if N["birlik"]:
                    b_acik = sum(x["kalan"] for x in N["satirlar"] if x["yon"] == "B")
                    a_acik = sum(x["kalan"] for x in N["satirlar"] if x["yon"] == "A")
                    say["(ii)"] += 1
                    denetle("%s@%d %s (ii)" % (ad, kesim, cari), b_acik - a_acik == m.bakiye(cari) and min(b_acik, a_acik) == 0, "B %s · A %s · bakiye %s" % (b_acik, a_acik, m.bakiye(cari)))
                    if OZ.yalin_saf(m, cari):
                        saf_kalan, saf_avans, saf_bakiye = OZ.saf_net(m, cari)
                        say["saf:" + nd[0]] += len(saf_kalan)
                        denetle("%s@%d %s saf net" % (ad, kesim, cari), all(N["kalan"].get(a) == v for a, v in saf_kalan.items()) and N["avans"] == saf_avans and saf_bakiye == m.bakiye(cari),
                                "saf %s %s · model %s %s" % (saf_kalan, saf_avans, N["kalan"], N["avans"]))
                    if nd[0] == "tek":
                        taraf = dict(m.kuyruk(cari))
                        taraf.update(m.kuyruk_borc(cari))
                        taraf.update({a: v for a, v in m.tyk250(cari)["kuyruk"].items() if a.startswith("kars:")})
                        say["tek=kendi tarafı"] += len(N["kalan"])
                        denetle("%s@%d %s tek yönde net = kendi tarafı" % (ad, kesim, cari), all(taraf.get(a) == v for a, v in N["kalan"].items()),
                                str({a: (taraf.get(a), v) for a, v in N["kalan"].items() if taraf.get(a) != v}))
            if not m.tyk250(cari)["neden"] and not any(sp["cari"] == cari for sp in m.supheliler.values()):
                g = m.gecikmis250(cari)
                if g is None:
                    say["gecikmiş tanımsız"] += 1
                else:
                    say["gecikmiş (i)"] += 1
                    denetle("%s@%d %s gecikmiş (i)" % (ad, kesim, cari), 0 <= g <= max(0, m.bakiye(cari)), "gecikmiş %s · bakiye %s" % (g, m.bakiye(cari)))
print("GENİŞ TARAMA (s1 tohum 1–%d × %d işlem): %s" % (TOHUM, ISLEM, " · ".join("%s %d" % kv for kv in sorted(say.items()))))
if satirlar:
    print("BAŞARISIZ:")
    print("\n".join(satirlar))
toplam = gecen + kalan
print("# tests %d" % toplam)
print("# pass %d" % gecen)
print("# fail %d" % kalan)
print("%d/%d denetim geçti" % (gecen, toplam))
sys.exit(0 if kalan == 0 else 1)
