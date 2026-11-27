#!/usr/bin/env python3
# WK 22: kâhinin kendi testinden F (tam mutasyon) DIŞINDAKİ bölümleri koşar (geliştirme sırasında; tam mutasyon en sonda bir kez — görev metni).
# Kullanım: python3 -I <bu dosya> test/bagimsiz/whatsapp-248/kahin [ad önekleri, virgüllü; boş = F dışındaki hepsi]
import os
import sys

kok = os.path.abspath(sys.argv[1])
sys.path.insert(0, kok)
sys.argv = [os.path.join(kok, "kahin_test.py")]
import importlib.util  # noqa: E402
spec = importlib.util.spec_from_file_location("kahin_test", os.path.join(kok, "kahin_test.py"))
kt = importlib.util.module_from_spec(spec)
spec.loader.exec_module(kt)
onek = [x for x in (os.environ.get("PARCA", "")).split(",") if x]
kt.SONUCLAR[:] = [(a, f) for (a, f) in kt.SONUCLAR if not a.startswith("F ") and (not onek or any(a.startswith(o) for o in onek))]
sys.exit(kt.kos())
