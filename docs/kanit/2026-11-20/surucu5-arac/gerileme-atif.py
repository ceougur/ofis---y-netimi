"""Gerileme farklarının kural / karara atfı (sürücü bakımı 5; bakım 4'ün aracının genişletilmişi).
python3 -I gerileme-atif.py <eski kök (c7b2-taban)> <yeni kök (c7b-aday)> <gerileme.py>
Her FARKLI koşuda: olay başına durum / delta farkı ve rapor farkı → aile (Ç7b tur 2–2e hesap aileleri, Ç7b tur 3 / 3b / taksit küçük turu, S212); senaryonun yeni ve eski
koddaki kırmızı sayısı. AÇIKLANMAYAN = hiçbir aileye girmeyen fark (bulgu adayı)."""
import contextlib, glob, gzip, importlib.util, io, json, os, sys

ESKI, YENI = sys.argv[1:3]
_s = importlib.util.spec_from_file_location("gerileme_norm", sys.argv[3])
G = importlib.util.module_from_spec(_s)
sys.argv = [sys.argv[0], ESKI, YENI]
with contextlib.redirect_stdout(io.StringIO()):
    try:
        _s.loader.exec_module(G)
    except SystemExit:
        pass
TZ = ["UTC", "Europe-Istanbul"]
KOK = os.getcwd()   # depo kökünden çalıştırılır (senaryolar oradan okunur)


def yukle(y):
    for p in (y, y + ".gz"):
        if os.path.exists(p):
            return json.load(gzip.open(p, "rt", encoding="utf-8") if p.endswith(".gz") else open(p, encoding="utf-8"))
    return None


def hesap_ailesi(tur, h):
    out = set()
    if "689" in h and tur in ("taksit_kapat", "gun"):
        out.add("Ç7b tur 3b — Kartı Kapat 'Borçta Kalsın' (karar (6), KG-23, S205 / S220)")
    if tur == "taksit_excel" and h <= {"120", "519", "500", "602"}:
        out.add("Ç7b taksit küçük turu — P7 (S219 / S221 / S222 = A)")
    if h <= {"120", "128", "129", "644", "100", "102"} and h & {"128", "129", "644"} and tur in ("tahsilat", "gun"):
        out.add("S212 = A / B1 (tek aday düzeltme 9db9b69d / 0612d825 — bağlı tahsilatın kesiti bağın önceliğini taşır; şüpheli ayırıcısında aynı gün sırası)")
    if h & {"601"}:
        out.add("KG-24 ihracat 601")
    if h & {"336"} or ({"602"} & h and tur in ("kayit_tahsilati",)):
        out.add("KG-3 kayıt tahsilatı 336.90 (+ geçiş günü)")
    if "600" in h and ("602" in h or tur in ("taksit_karti", "gun")):
        out.add("KG-2 belgesiz 600.90 / 610.90 (taksit Yeni Borç 602 → 600)")
    if h & {"191", "391", "190", "360"} and tur in ("satis_iade_faturasi", "alis_iade_faturasi", "kdv_mahsup", "kdv_mahsup_geri_al", "gun", "alis_faturasi", "devri_yenile"):
        out.add("KG-8 / F-08 iade KDV'si + B-6 / KG-7 indirim dönemi")
    return out


SINIF = {}
for kok, et in ((ESKI, "eski"), (YENI, "yeni")):
    for tz in TZ:
        for f in glob.glob(os.path.join(kok, tz, "*.fark.json")):
            x = json.load(open(f, encoding="utf-8"))
            o = x["ozet"]
            SINIF[(et, os.path.basename(f)[:-10], tz)] = {k: o.get(k, 0) for k in ("SINIFLANMADI", "P", "K", "R")} | {
                "adim_sinifsiz": o.get("adim_sinifsiz", 0), "red_fark": sum(1 for r in x["redler"] if r["sonuc"] != "AYNI" and not r.get("sinif")),
                "uygulanamayan": sum(1 for u in x["uygulanamayan"] if u.get("sinif") not in ("U",))}

acik_yok = 0
farkli = 0
for tz in TZ:
    for yol in sorted(glob.glob(os.path.join(YENI, tz, "*.program.json"))):
        ad = os.path.basename(yol).split(".program.json")[0]
        y, e = yukle(yol), yukle(os.path.join(ESKI, tz, ad + ".program.json"))
        if e is None:
            print(f"{ad} [{tz}] ESKİ ÇIKTI YOK")
            continue
        if json.dumps(G.norm(y), sort_keys=True) == json.dumps(G.norm(e), sort_keys=True):
            continue
        farkli += 1
        sen = json.load(open(os.path.join(KOK, "test", "bagimsiz", "muhasebe", "senaryolar", ad + ".json"), encoding="utf-8"))
        turler = {o["tur"] for o in sen["olaylar"]}
        ey = {(str(x["no"]), x.get("gecis")): x for x in e["olaylar"]}
        kurallar, aciklanmayan, alan = set(), [], set()
        for x in y["olaylar"]:
            a = ey.get((str(x["no"]), x.get("gecis")))
            if a is None:
                aciklanmayan.append(f"olay {x['no']} eskide yok")
                continue
            if a.get("durum") != x.get("durum"):
                alan.add(f"olay {x['no']} {x['tur']} durum {a.get('durum')} → {x.get('durum')} ({(a.get('kod') or '')}{(x.get('kod') or '')})")
                if x["tur"] == "iptal" and a.get("durum") == "red":
                    kurallar.add("Ç7b tur 3 — S15 = A (tahsilatlı kartın faturası iptal edilebilir)")
                elif x["tur"] == "taksit_excel":
                    kurallar.add("Ç7b taksit küçük turu — P7 (S219 / S221 / S222 = A)")
                elif x["tur"] in ("alis_faturasi", "gelen_smm") and "vat-period" in str(a.get("kod")) + str(x.get("kod")):
                    kurallar.add("KG-7 KDV İndirim Dönemi (vat-period-range)")
                else:
                    aciklanmayan.append(f"durum: olay {x['no']} {x['tur']} {a.get('durum')} → {x.get('durum')}")
            da, dy = (a.get("delta") or {}).get("ana") or {}, (x.get("delta") or {}).get("ana") or {}
            fh = {k for k in set(da) | set(dy) if da.get(k, 0) != dy.get(k, 0)}
            if not fh:
                continue
            tur = x["tur"] if x["tur"] != "gun" else "gun"
            k = hesap_ailesi(tur, fh)
            if not k and tur == "gun" and "taksit_kapat" in turler and fh <= {"120", "689"}:
                k = {"Ç7b tur 3b — Kartı Kapat 'Borçta Kalsın' (karar (6), KG-23, S205 / S220)"}
            if not k:
                aciklanmayan.append(f"olay {x['no']} {x['tur']} {sorted(fh)}")
            kurallar |= k
        yr, er = G.norm(y.get("raporlar") or {}), G.norm(e.get("raporlar") or {})
        rfark = sorted(r for r in set(yr) | set(er) if json.dumps(yr.get(r), sort_keys=True) != json.dumps(er.get(r), sort_keys=True))
        tyk = [r for r in rfark if any(k in json.dumps(yr.get(r) or er.get(r) or {}) for k in ("cari_kart", "kartlar", "acik_faturalar", "alicilar"))]
        ys, es = json.dumps(yr, ensure_ascii=False), json.dumps(er, ensure_ascii=False)
        if "649.90" in ys and "649.90" not in es:
            kurallar.add("649.90 carisiz Kasa girişi (BAŞ MİMAR KARARI 19.11)")
        if "602.90" in ys and "602.90" not in es:
            kurallar.add("KG-3 eski alt hesap 602.90 (geçiş günü öncesi)")
        if tyk:
            if "taksit_kapat" in turler:
                kurallar.add("Ç7b tur 3b — Kartı Kapat 'Borçta Kalsın' (kuyruk / kart raporu)")
            if turler & {"iptal", "sil", "satis_iade_faturasi"} and turler & {"taksit_karti"}:
                kurallar.add("Ç7b tur 3 — karar (4) / S15 / S206 / S210 / S211 (kartlı faturanın iptali / iadesi; kuyruk / kart raporu)")
            if "taksit_excel" in turler:
                kurallar.add("Ç7b taksit küçük turu — P7 (kart raporu / gecikmiş)")
            if "supheliye_al" in turler and not (turler & {"taksit_kapat", "taksit_excel"}):
                kurallar.add("S212 = A / B1 (şüpheli ↔ bağlı tahsilat; kuyruk raporu)")
        if rfark and not kurallar and not alan:
            aciklanmayan.append("rapor farkı (aile yok): " + ", ".join(rfark[:6]))
        se, sy = SINIF.get(("eski", ad, tz), {}), SINIF.get(("yeni", ad, tz), {})
        kr = lambda d: sum(d.get(k, 0) for k in ("SINIFLANMADI", "P", "K", "R", "adim_sinifsiz", "red_fark", "uygulanamayan"))
        print(f"{ad} [{tz}] kurallar: {', '.join(sorted(kurallar)) or '-'}{' · durum: ' + '; '.join(sorted(alan)) if alan else ''}"
              f" · rapor farkı {len(rfark)} ({', '.join(rfark[:8])}) · eski kodda kırmızı {kr(se)} → yeni kodda {kr(sy)}"
              + (f" · AÇIKLANMAYAN: {aciklanmayan[:5]}" if aciklanmayan else ""))
        if aciklanmayan:
            acik_yok += 1
print(f"\nFARKLI koşu: {farkli} · AÇIKLANMAYAN içeren koşu: {acik_yok}")
