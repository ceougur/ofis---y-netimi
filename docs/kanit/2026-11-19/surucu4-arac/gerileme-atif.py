"""Gerileme farklarının Ç7b kurallarına atfı (sürücü bakımı 4).
python3 -I gerileme-atif.py <eski kök> <yeni kök>
Her FARKLI koşuda: olay başına delta farkının hesap ailesi → kural; sınamada (yeni) senaryonun kâhinle sınıfı; eski kodda sınıfı.
AÇIKLANMAYAN = aileye girmeyen hesap / alan (bulgu adayı)."""
import gzip, json, os, re, sys, glob
from collections import defaultdict

ESKI, YENI = sys.argv[1:3]
import importlib.util
_s = importlib.util.spec_from_file_location("gerileme_norm", sys.argv[3])
G = importlib.util.module_from_spec(_s)
sys.argv = [sys.argv[0], ESKI, YENI]
import io, contextlib
with contextlib.redirect_stdout(io.StringIO()):
    try:
        _s.loader.exec_module(G)
    except SystemExit:
        pass
TZ = ["UTC", "Europe-Istanbul"]


def yukle(y):
    for p in (y, y + ".gz"):
        if os.path.exists(p):
            return json.load(gzip.open(p, "rt", encoding="utf-8") if p.endswith(".gz") else open(p, encoding="utf-8"))
    return None


def aile(ad, o_tur, hesaplar):
    h = set(hesaplar)
    out = set()
    if h & {"601"}:
        out.add("KG-24 ihracat 601")
    if h & {"336"} or ({"602"} & h and o_tur in ("kayit_tahsilati",)):
        out.add("KG-3 kayıt tahsilatı 336.90 (+ geçiş günü)")
    if "600" in h and ("602" in h or o_tur in ("taksit_karti", "gun")):
        out.add("KG-2 belgesiz 600.90 / 610.90 (taksit Yeni Borç 602 → 600)")
    if h & {"191", "391", "190", "360"} and o_tur in ("satis_iade_faturasi", "alis_iade_faturasi", "kdv_mahsup", "kdv_mahsup_geri_al", "gun", "alis_faturasi", "devri_yenile"):
        out.add("KG-8 / F-08 iade KDV'si + B-6 / KG-7 indirim dönemi")
    return out


SINIF = {}
for kok, et in ((ESKI, "eski"), (YENI, "yeni")):
    for tz in TZ:
        for f in glob.glob(os.path.join(kok, tz, "*.fark.json")):
            x = json.load(open(f, encoding="utf-8"))
            o = x["ozet"]
            SINIF[(et, os.path.basename(f)[:-10], tz)] = {k: o.get(k, 0) for k in ("AYNI", "SINIFLANMADI", "P", "K", "R")} | {"adim_sinifsiz": o.get("adim_sinifsiz", 0), "red_fark": sum(1 for r in x["redler"] if r["sonuc"] != "AYNI" and not r.get("sinif"))}

acik_yok = 0
for tz in TZ:
    for yol in sorted(glob.glob(os.path.join(YENI, tz, "*.program.json"))):
        ad = os.path.basename(yol).split(".program.json")[0]
        y, e = yukle(yol), yukle(os.path.join(ESKI, tz, ad + ".program.json"))
        if e is None:
            print(f"{ad} [{tz}] ESKİ ÇIKTI YOK")
            continue
        ey = {(str(x["no"]), x.get("gecis")): x for x in e["olaylar"]}
        kurallar, aciklanmayan, alan = set(), [], set()
        for x in y["olaylar"]:
            a = ey.get((str(x["no"]), x.get("gecis")))
            if a is None:
                aciklanmayan.append(f"olay {x['no']} eskide yok")
                continue
            if a.get("durum") != x.get("durum"):
                alan.add(f"olay {x['no']} {x['tur']} durum {a.get('durum')} → {x.get('durum')} ({(a.get('kod') or '')}{(x.get('kod') or '')})")
            da, dy = (a.get("delta") or {}).get("ana") or {}, (x.get("delta") or {}).get("ana") or {}
            fh = {k for k in set(da) | set(dy) if da.get(k, 0) != dy.get(k, 0)}
            if not fh:
                continue
            tur = x["tur"] if x["tur"] != "gun" else "gun"
            k = aile(ad, tur, fh)
            if not k:
                aciklanmayan.append(f"olay {x['no']} {x['tur']} {sorted(fh)}")
            kurallar |= k
        # rapor / alt hesap düzeyi farkları (ör. 649 → 649.90, 602 → 602.90)
        yr = json.dumps(G.norm(y.get("raporlar")), ensure_ascii=False, sort_keys=True)
        er = json.dumps(G.norm(e.get("raporlar")), ensure_ascii=False, sort_keys=True)
        if "649.90" in yr and "649.90" not in er:
            kurallar.add("649.90 carisiz Kasa girişi (BAŞ MİMAR KARARI 19.11)")
        if "602.90" in yr and "602.90" not in er:
            kurallar.add("KG-3 eski alt hesap 602.90 (geçiş günü öncesi)")
        if yr != er and not kurallar and not alan:
            aciklanmayan.append("rapor farkı (hesap ailesi yok)")
        if not (kurallar or alan or aciklanmayan):
            continue
        se, sy = SINIF.get(("eski", ad, tz), {}), SINIF.get(("yeni", ad, tz), {})
        print(f"{ad} [{tz}] kurallar: {', '.join(sorted(kurallar)) or '-'}{' · durum: ' + '; '.join(sorted(alan)) if alan else ''}"
              f" · eski kodda SINIFLANMADI {se.get('SINIFLANMADI')} / sınıfsız adım {se.get('adim_sinifsiz')} / red farkı {se.get('red_fark')} → yeni kodda {sy.get('SINIFLANMADI')} / {sy.get('adim_sinifsiz')} / {sy.get('red_fark')}"
              + (f" · AÇIKLANMAYAN: {aciklanmayan[:5]}" if aciklanmayan else ""))
        if aciklanmayan:
            acik_yok += 1
print(f"\nAÇIKLANMAYAN içeren koşu: {acik_yok}")
