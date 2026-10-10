#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""Üç taraflı fark: model_a ↔ model_b ↔ program (koşucu) — dil `destekofis-senaryo/1` (SENARYO-DILI.md §9).

Kullanım (depo kökünden):
  python3 test/bagimsiz/fark.py --tohum 7 [--islem 500] [--kontrol 25]     # uretici.py ile üretir, üçünü koşar
  python3 test/bagimsiz/fark.py --senaryo test/bagimsiz/senaryolar/kabul-1-16.json
  python3 test/bagimsiz/fark.py --tohum 7 --onek 120                       # senaryonun ilk 120 adımı (küçültme)
  python3 test/bagimsiz/fark.py --tohum 7 --kucult 'cariler\\.'              # farkı doğuran en kısa öneki ara (ikiye bölme)
  python3 test/bagimsiz/fark.py --ozet                                     # cikti/fark-*.json → cikti/fark-ozet.json

Ne yapar:
  1. Senaryoyu (gerekirse) üretir: cikti/senaryolar/<ad>.json (uretici.py, belirlenimli).
  2. Üç tarafı ayrı süreçte koşar ve ham çıktılarını saklar (cikti/ham/<ad>.{a,b,program}.json):
       model_a: python3 -I test/bagimsiz/model_a/model.py <senaryo>
       model_b: python3 -I test/bagimsiz/model_b/model.py <senaryo>
       program: node test/bagimsiz/surucu.mjs <senaryo> --cikti <dosya>   (programın gerçek HTTP API'si)
  3. Üç çıktıyı alan alan karşılaştırır (§9): mizan (eksik anahtar = {0,0}), bankaHesaplari, kasa, cariler, stok, faturalar,
     taksitKartlari, hesapKodlari, eksiBakiyeDenetimi, ozet, retler (kâhin "4xx" → 400–499; kod yalnız kâhin kodu varsa),
     yinelenenler, atlananlar ve araDurumlar. Kâhinlerden birinin `belirsizler`indeki yollar atlanır (sayılır).
     Alternatifli (ayniAnda) çıktıda her kâhin için programa en yakın alternatif seçilir; seçim çıktıda yazılır.
  4. Her farkı (alan, a, b, program) + desen (A=B≠P, A≠B=P, B≠A=P, A≠B≠P) + aile + kök sınıf olarak
     cikti/fark-<tohum>.json'a (ya da fark-<ad>.json) yazar. Programın kendi iki ekranı arasındaki farklar (kaynakFarklari),
     okuma hataları ve eşlenemeyen adımlar da ayrı başlıklarda.

Temiz oda: bu dosya beklenen değer HESAPLAMAZ ve programın kodunu okumaz; yalnız üç sürecin çıktı dosyalarını karşılaştırır.
Kök sınıf kuralları (KOK_SINIFLARI) farkların incelenmesinden sonra elle yazıldı; her kural farkın görünen biçimine (alan,
işlem, değerler) bakar, beklenen değer üretmez. Sınıflanamayan fark "SINIFLANMAMIS" olarak kalır (gizlenmez).

Çıkış kodu: 0 koşu tamam (fark olsa da) · 1 bir taraf koşamadı (çıktı yok/okuma hatası) · 2 kullanım hatası.
"""

import argparse
import glob
import importlib.util
import json
import os
import re
import subprocess
import sys
import time

BURASI = os.path.dirname(os.path.abspath(__file__))
KOK = os.path.abspath(os.path.join(BURASI, "..", ".."))
CIKTI = os.path.join(BURASI, "cikti")
DURUM_ALANLARI = ["mizan", "bankaHesaplari", "kasa", "cariler", "stok", "faturalar", "taksitKartlari", "hesapKodlari",
                  "eksiBakiyeDenetimi", "ozet"]
YOK = "<yok>"


# ───────────────────────────────────────────────────────────── koşturma

def uretici_yukle():
    spec = importlib.util.spec_from_file_location("uretici", os.path.join(BURASI, "uretici.py"))
    m = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(m)
    return m


def yaz_json(yol, veri):
    os.makedirs(os.path.dirname(yol), exist_ok=True)
    with open(yol, "w", encoding="utf-8") as fh:
        json.dump(veri, fh, ensure_ascii=False, indent=2, sort_keys=True)
        fh.write("\n")


def kos(komut, zaman_asimi=None):
    t0 = time.time()
    p = subprocess.run(komut, cwd=KOK, capture_output=True, text=True, timeout=zaman_asimi)
    return p.returncode, p.stdout, p.stderr, round(time.time() - t0, 2)


def model_kos(ad, senaryo):
    rc, out, err, sure = kos(["python3", "-I", os.path.join(BURASI, ad, "model.py"), senaryo])
    veri = None
    if rc == 0:
        try:
            veri = json.loads(out)
        except ValueError as e:
            err += "\nJSON okunamadı: %s" % e
            rc = 99
    return {"cikis": rc, "sure": sure, "stderr": err.strip()[-2000:], "veri": veri, "stdout": out if rc == 0 else ""}


def program_kos(senaryo, cikti_yolu):
    rc, out, err, sure = kos(["node", os.path.join(BURASI, "surucu.mjs"), senaryo, "--cikti", cikti_yolu])
    veri = None
    if os.path.exists(cikti_yolu) and rc in (0, 1):
        with open(cikti_yolu, encoding="utf-8") as fh:
            veri = json.load(fh)
    err = "\n".join(l for l in err.splitlines() if "ExperimentalWarning" not in l and "trace-warnings" not in l)
    return {"cikis": rc, "sure": sure, "stderr": err.strip()[-3000:], "stdout": out.strip()[-1000:], "veri": veri}


# ───────────────────────────────────────────────────────────── yapraklar

def yol_coz(metin):
    """belirsiz yol metni → demet ("mizan.102.01" anahtarı bölünmez)."""
    p = metin.split(".")
    out = []
    i = 0
    if p and p[0] == "araDurumlar" and len(p) >= 2:
        out += p[:2]
        i = 2
    if i < len(p) and p[i] == "mizan":
        out += ["mizan", ".".join(p[i + 1:])] if i + 1 < len(p) else ["mizan"]
        return tuple(out)
    if i < len(p) and p[i] == "retler":
        return tuple(out + ["retler", ".".join(p[i + 1:])])
    return tuple(out + p[i:])


def durum_yapraklari(d, onek=()):
    """§8 durum alanları → {yol demeti: değer}. Eksik harita anahtarı YOK, eksik mizan hesabı (0,0)."""
    y = {}
    if d is None:
        return y
    miz = d.get("mizan") or {}
    for k, v in miz.items():
        y[onek + ("mizan", k)] = (v.get("borc", 0), v.get("alacak", 0))
    if "kasa" in d:
        y[onek + ("kasa",)] = d["kasa"]
    for alan in ("bankaHesaplari", "cariler", "stok", "hesapKodlari", "eksiBakiyeDenetimi"):
        for k, v in (d.get(alan) or {}).items():
            y[onek + (alan, k)] = v
    for alan in ("faturalar", "taksitKartlari"):
        for k, v in (d.get(alan) or {}).items():
            if isinstance(v, dict):
                for kk, vv in v.items():
                    y[onek + (alan, k, kk)] = vv
            else:
                y[onek + (alan, k)] = v
    for k, v in (d.get("ozet") or {}).items():
        y[onek + ("ozet", k)] = v
    return y


def yapraklar(cikti):
    y = durum_yapraklari(cikti)
    for kid, ara in (cikti.get("araDurumlar") or {}).items():
        y.update(durum_yapraklari(ara, ("araDurumlar", kid)))
    for r in cikti.get("retler") or []:
        y[("retler", r["adim"])] = {"durum": r.get("durum"), "kod": r.get("kod")}
    for i in cikti.get("yinelenenler") or []:
        y[("yinelenenler", i)] = True
    for i in cikti.get("atlananlar") or []:
        y[("atlananlar", i)] = True
    return y


def bos_deger(yol):
    if "mizan" in yol and yol[-2] == "mizan":
        return (0, 0)
    if yol[0] in ("yinelenenler", "atlananlar"):
        return False
    return YOK


def ret_esit_model_program(m, p):
    if m == YOK and p == YOK:
        return True
    if m == YOK or p == YOK:
        return False
    md, pd = m["durum"], p["durum"]
    if md == "4xx":
        if not (isinstance(pd, int) and 400 <= pd <= 499):
            return False
    elif md != pd:
        return False
    if m.get("kod") is not None and m["kod"] != p.get("kod"):
        return False
    return True


def esit(yol, x, y, model_program=False):
    if yol[0] == "retler" and model_program:
        return ret_esit_model_program(x, y)
    return x == y


def belirsiz_mi(yol, belirsizler):
    for b in belirsizler:
        if yol[:len(b)] == b:
            return True
    return False


def karsilastir(a, b, p):
    """Dönüş: (farklar, karşılaştırılan yaprak sayısı, atlanan yaprak sayısı)."""
    ya, yb, yp = yapraklar(a), yapraklar(b), yapraklar(p)
    bel = set()
    for c in (a, b):
        for x in c.get("belirsizler") or []:
            bel.add(yol_coz(x["alan"]))
    tum = set(ya) | set(yb) | set(yp)
    farklar, sayi, atla = [], 0, 0
    for yol in sorted(tum, key=lambda t: tuple(str(s) for s in t)):
        if belirsiz_mi(yol, bel):
            atla += 1
            continue
        sayi += 1
        va, vb, vp = (yp_.get(yol, bos_deger(yol)) for yp_ in (ya, yb, yp))
        ab = esit(yol, va, vb)
        ap = esit(yol, va, vp, True)
        bp = esit(yol, vb, vp, True)
        if ab and ap and bp:
            continue
        if ab and not ap:
            desen = "A=B≠P"
        elif ap and not bp:
            desen = "B≠A=P"
        elif bp and not ap:
            desen = "A≠B=P"
        else:
            desen = "A≠B≠P"
        farklar.append({"yol": list(yol), "alan": yol_metni(yol), "a": jsonlanabilir(va), "b": jsonlanabilir(vb),
                        "program": jsonlanabilir(vp), "desen": desen})
    return farklar, sayi, atla


def duz_yapraklar(d, onek=()):
    """İç içe sözlüğün yaprakları (mizan anahtarı tek parça)."""
    for k, v in d.items():
        if isinstance(v, dict):
            yield from duz_yapraklar(v, onek + (k,))
        else:
            yield onek + (k,), v


def yol_metni(yol):
    return ".".join(str(s) for s in yol)


def jsonlanabilir(v):
    if isinstance(v, tuple):
        return {"borc": v[0], "alacak": v[1]}
    return v


def alternatif_sec(model_cikti, program_cikti):
    """Alternatifli kâhin çıktısında programa en yakın alternatif (fark sayısı en az)."""
    if not model_cikti or "alternatifler" not in model_cikti:
        return model_cikti, None
    alts = model_cikti["alternatifler"]
    yp = yapraklar(program_cikti) if program_cikti else {}
    en, en_i, en_f = None, None, None
    for i, alt in enumerate(alts):
        ya = yapraklar(alt)
        f = 0
        for yol in set(ya) | set(yp):
            if not esit(yol, ya.get(yol, bos_deger(yol)), yp.get(yol, bos_deger(yol)), True):
                f += 1
        if en_f is None or f < en_f:
            en, en_i, en_f = alt, i, f
    sec = dict(en)
    ust_bel = model_cikti.get("belirsizler") or []
    sec["belirsizler"] = list({json.dumps(x, sort_keys=True): x for x in (sec.get("belirsizler") or []) + ust_bel}.values())
    return sec, {"secilen": en_i, "toplam": len(alts), "programlaFark": en_f}


# ───────────────────────────────────────────────────────────── adım bağlamı ve aile

def adim_haritasi(senaryo):
    sira = {}
    for i, a in enumerate(senaryo["adimlar"]):
        sira[a["id"]] = i
    return sira


def aile(f, adimlar_by_id):
    yol = f["yol"]
    if yol[0] == "araDurumlar":
        yol = yol[2:]
    bas = yol[0]
    if bas == "mizan":
        kod = yol[1]
        if re.match(r"^(102|108|300|309)\.\d\d$", kod):
            kod = kod[:3] + (".00" if kod.endswith(".00") else ".NN")
        return "mizan." + kod
    if bas in ("faturalar", "taksitKartlari") and len(yol) == 3:
        return "%s.*.%s" % (bas, yol[2])
    if bas in ("bankaHesaplari", "cariler", "stok", "hesapKodlari", "eksiBakiyeDenetimi"):
        return bas + ".*"
    if bas == "ozet":
        return "ozet." + yol[1]
    if bas in ("retler", "yinelenenler", "atlananlar"):
        a = adimlar_by_id.get(yol[1], {})
        return "%s:%s" % (bas, a.get("islem", "?"))
    return bas


def ret_ozeti(v):
    if v in (YOK, None, False):
        return "geçti"
    if isinstance(v, dict):
        return "%s %s" % (v.get("durum"), v.get("kod") or "-")
    return str(v)


# ───────────────────────────────────────────────────────────── kök sınıflar
# Her kural: (ad, açıklama, yüklem(fark, bağlam) → bool). İlk tutan kural sınıfı verir. Kurallar farkların incelenmesinden
# sonra yazıldı (fark-ozet.json "siniflar"); yeni bir fark türü çıkarsa SINIFLANMAMIS kalır ve elle incelenir.

def _adim(f, bag):
    yol = f["yol"]
    if yol[0] in ("retler", "yinelenenler", "atlananlar"):
        return bag["adimlar"].get(yol[1], {})
    return {}


def _ret(v):
    return v if isinstance(v, dict) else None


KOK_SINIFLARI = []


def kural(ad, aciklama):
    def sar(fn):
        KOK_SINIFLARI.append((ad, aciklama, fn))
        return fn
    return sar


def kok_sinif(f, bag):
    for ad, _ac, fn in KOK_SINIFLARI:
        try:
            if fn(f, bag):
                return ad
        except Exception:  # sınıflayıcı hatası farkı gizlemez
            continue
    return "SINIFLANMAMIS:%s:%s" % (f["desen"], f["aile"])


# ───────────────────────────────────────────────────────────── tek koşu

def tek_kosu(senaryo_yolu, cikti_adi, kucuk_rapor=False):
    with open(senaryo_yolu, encoding="utf-8") as fh:
        sen = json.load(fh)
    ad = sen["ad"]
    ham = os.path.join(CIKTI, "ham")
    os.makedirs(ham, exist_ok=True)
    A = model_kos("model_a", senaryo_yolu)
    B = model_kos("model_b", senaryo_yolu)
    P = program_kos(senaryo_yolu, os.path.join(ham, ad + ".program.json"))
    for etiket, r in (("a", A), ("b", B)):
        if r["cikis"] == 0:
            with open(os.path.join(ham, "%s.%s.json" % (ad, etiket)), "w", encoding="utf-8") as fh:
                fh.write(r["stdout"])
    adimlar = {a["id"]: a for a in sen["adimlar"]}
    sira = adim_haritasi(sen)
    kontroller = [a["id"] for a in sen["adimlar"] if a["islem"] == "kontrol"]
    sayac = {}
    for a in sen["adimlar"]:
        sayac[a["islem"]] = sayac.get(a["islem"], 0) + 1
    rapor = {
        "senaryo": ad,
        "senaryoDosyasi": os.path.relpath(senaryo_yolu, KOK),
        "adimSayisi": len(sen["adimlar"]),
        "islemSayisi": sum(1 for a in sen["adimlar"] if a["islem"] not in ("kontrol", "saat")),
        "islemTurleri": dict(sorted(sayac.items())),
        "komutlar": {
            "model_a": "python3 -I test/bagimsiz/model_a/model.py %s" % os.path.relpath(senaryo_yolu, KOK),
            "model_b": "python3 -I test/bagimsiz/model_b/model.py %s" % os.path.relpath(senaryo_yolu, KOK),
            "program": "node test/bagimsiz/surucu.mjs %s --cikti %s" % (
                os.path.relpath(senaryo_yolu, KOK), os.path.relpath(os.path.join(ham, ad + ".program.json"), KOK)),
        },
        "cikisKodlari": {"a": A["cikis"], "b": B["cikis"], "program": P["cikis"]},
        "sureler": {"a": A["sure"], "b": B["sure"], "program": P["sure"]},
    }
    if A["cikis"] != 0:
        rapor["a_stderr"] = A["stderr"]
    if B["cikis"] != 0:
        rapor["b_stderr"] = B["stderr"]
    if P["cikis"] not in (0,):
        rapor["program_stderr"] = P["stderr"]
    pv = P["veri"]
    if pv:
        rapor["programEk"] = {
            "programSurumu": pv.get("programSurumu"), "commit": pv.get("commit"),
            "calismaAgaciDegisikDosya": pv.get("calismaAgaciDegisikDosya"),
            "okumaHatalari": pv.get("okumaHatalari") or [],
            "eslenemeyenler": pv.get("eslenemeyenler") or [],
            "kaynakFarklari": pv.get("kaynakFarklari") or [],
            "programMutabakatTesti": (pv.get("ekBilgi") or {}).get("programMutabakatTesti"),
        }
    if A["veri"] is None or B["veri"] is None or pv is None:
        rapor["durum"] = "EKSIK: en az bir taraf çıktı üretmedi; karşılaştırma yapılmadı"
        rapor["farklar"] = []
        yaz_json(os.path.join(CIKTI, cikti_adi), rapor)
        return rapor, 1
    a, asec = alternatif_sec(A["veri"], pv)
    b, bsec = alternatif_sec(B["veri"], pv)
    if asec or bsec:
        rapor["alternatifSecimi"] = {"a": asec, "b": bsec}
        ka = sorted(json.dumps(x, sort_keys=True) for x in A["veri"].get("alternatifler", []))
        kb = sorted(json.dumps(x, sort_keys=True) for x in B["veri"].get("alternatifler", []))
        rapor["alternatifSecimi"]["kumelerAyni"] = (
            [json.loads(x).get("retler") for x in ka] == [json.loads(x).get("retler") for x in kb])
    farklar, sayi, atla = karsilastir(a, b, pv)
    # plan denetimi (§9/1): kontrol adımlarındaki planBeklenen yaprakları (kısmi nesne; her yaprak ayrı)
    plan = []
    for adim in sen["adimlar"]:
        if adim["islem"] != "kontrol" or "planBeklenen" not in adim:
            continue
        for yol, v in duz_yapraklar(adim["planBeklenen"]):
            def al(c):
                ara = (c.get("araDurumlar") or {}).get(adim["id"])
                if ara is None:
                    return YOK
                x = ara
                for s_ in yol:
                    if not isinstance(x, dict) or s_ not in x:
                        return 0 if yol[0] == "mizan" else YOK
                    x = x[s_]
                return x
            pa, pb, pp = al(a), al(b), al(pv)
            plan.append({"kontrol": adim["id"], "alan": yol_metni(yol), "plan": v, "a": pa, "b": pb, "program": pp,
                         "tuttu": {"a": pa == v, "b": pb == v, "program": pp == v}})
    if plan:
        rapor["planDenetimi"] = {"yaprak": len(plan),
                                 "tutmayan": [x for x in plan if not all(x["tuttu"].values())]}
    # bağlam: aile, pencere (fark ilk hangi kontrolde görüldü), adım
    bag = {"adimlar": adimlar, "sira": sira, "sen": sen}
    ilk_kontrol = {}
    for f in farklar:
        yol = f["yol"]
        f["aile"] = aile(f, adimlar)
        if yol[0] == "araDurumlar":
            taban = yol_metni(yol[2:])
            k = yol[1]
            if taban not in ilk_kontrol or sira[k] < sira[ilk_kontrol[taban]]:
                ilk_kontrol[taban] = k
    for f in farklar:
        yol = f["yol"]
        if yol[0] in ("retler", "yinelenenler", "atlananlar"):
            st = adimlar.get(yol[1], {})
            f["adim"] = {k: v for k, v in st.items() if k not in ("kalemler",)}
            f["pencere"] = [yol[1], yol[1]]
            f["a"], f["b"], f["program"] = (ret_ozeti(f["a"]), ret_ozeti(f["b"]), ret_ozeti(f["program"])) \
                if yol[0] == "retler" else (f["a"], f["b"], f["program"])
            if yol[0] == "retler" and pv:
                ay = [x for x in pv.get("retAyrinti") or [] if x.get("adim") == yol[1]]
                if ay:
                    f["programIletisi"] = ay[0].get("mesaj")
            continue
        taban = yol_metni(yol[2:]) if yol[0] == "araDurumlar" else yol_metni(yol)
        k = ilk_kontrol.get(taban)
        if k is None:
            son = kontroller[-1] if kontroller else None
            f["pencere"] = [son or "baslangic", "son"]
        else:
            i = kontroller.index(k)
            f["pencere"] = [kontroller[i - 1] if i > 0 else "baslangic", k]
    for f in farklar:
        f["kokSinif"] = kok_sinif(f, bag)
    # program içi farklar (iki ekran aynı alanı farklı gösteriyor) — ayrı sınıf
    for kf in (pv.get("kaynakFarklari") or []):
        farklar.append({"yol": ["programIci", kf.get("alan")], "alan": "programIci." + str(kf.get("alan")),
                        "a": None, "b": None, "program": kf, "desen": "PROGRAM-ICI", "aile": "programIci",
                        "pencere": [kf.get("okuma"), kf.get("okuma")], "kokSinif": "PROGRAM-ICI:%s" % kf.get("alan")})
    for e in (pv.get("eslenemeyenler") or []):
        farklar.append({"yol": ["eslenemeyen", e.get("adim")], "alan": "eslenemeyen." + str(e.get("adim")),
                        "a": None, "b": None, "program": e, "desen": "KOSUCU", "aile": "eslenemeyen:" + str(e.get("islem")),
                        "pencere": [e.get("adim"), e.get("adim")],
                        "kokSinif": kok_sinif({"yol": ["eslenemeyen", e.get("adim")], "desen": "KOSUCU",
                                               "aile": "eslenemeyen:" + str(e.get("islem")), "program": e}, bag)})
    # sınıf özeti (yalnız son durum + retler sayılır; araDurumlar aynı kökün tekrarıdır ama pencereyi daraltır)
    siniflar = {}
    for f in farklar:
        s = siniflar.setdefault(f["kokSinif"], {"yaprak": 0, "sonDurumYaprak": 0, "araDurumYaprak": 0, "desenler": {},
                                                 "aileler": {}, "ornekler": [], "enErkenPencere": None})
        s["yaprak"] += 1
        if f["yol"][0] == "araDurumlar":
            s["araDurumYaprak"] += 1
        else:
            s["sonDurumYaprak"] += 1
        s["desenler"][f["desen"]] = s["desenler"].get(f["desen"], 0) + 1
        s["aileler"][f["aile"]] = s["aileler"].get(f["aile"], 0) + 1
        if len(s["ornekler"]) < 4 and f["yol"][0] != "araDurumlar":
            s["ornekler"].append({k: f[k] for k in ("alan", "a", "b", "program", "desen", "pencere") if k in f})
        pen = f.get("pencere")
        if pen and pen[1] in sira:
            if s["enErkenPencere"] is None or sira[pen[1]] < sira.get(s["enErkenPencere"][1], 10 ** 9):
                s["enErkenPencere"] = pen
    for s in siniflar.values():
        if not s["ornekler"]:
            s["ornekler"] = [{k: f[k] for k in ("alan", "a", "b", "program", "desen", "pencere") if k in f}
                             for f in farklar if f["kokSinif"] in siniflar and siniflar[f["kokSinif"]] is s][:3]
    rapor.update({
        "durum": "TAMAM",
        "karsilastirilanYaprak": sayi,
        "atlananBelirsizYaprak": atla,
        "farkSayisi": len(farklar),
        "desenSayilari": {d: sum(1 for f in farklar if f["desen"] == d) for d in sorted({f["desen"] for f in farklar})},
        "siniflar": dict(sorted(siniflar.items())),
        "belirsizSayisi": {"a": len(a.get("belirsizler") or []), "b": len(b.get("belirsizler") or [])},
        "ucTarafSayilari": uc_taraf_sayilari(a, b, pv),
        "farklar": farklar if not kucuk_rapor else [f for f in farklar if f["yol"][0] != "araDurumlar"],
    })
    yaz_json(os.path.join(CIKTI, cikti_adi), rapor)
    return rapor, 0


def uc_taraf_sayilari(a, b, p):
    """Üç tarafın son durumdan kısa sayıları (rapor okunurken bağlam için; karşılaştırma değil)."""
    def ozet(c):
        miz = c.get("mizan") or {}
        return {
            "retSayisi": len(c.get("retler") or []),
            "yinelenenSayisi": len(c.get("yinelenenler") or []),
            "atlananSayisi": len(c.get("atlananlar") or []),
            "kasa": c.get("kasa"),
            "bankaToplam": sum(v for v in (c.get("bankaHesaplari") or {}).values() if isinstance(v, int)),
            "cariToplam": sum(v for v in (c.get("cariler") or {}).values() if isinstance(v, int)),
            "faturaSayisi": len(c.get("faturalar") or {}),
            "acikFaturaToplam": sum((v or {}).get("acik", 0) for v in (c.get("faturalar") or {}).values()
                                    if isinstance(v, dict)),
            "taksitKalanToplam": sum((v or {}).get("kalan", 0) for v in (c.get("taksitKartlari") or {}).values()
                                     if isinstance(v, dict)),
            "mizanBorcToplam": sum(v.get("borc", 0) for v in miz.values()),
            "mizanAlacakToplam": sum(v.get("alacak", 0) for v in miz.values()),
            "ozet": c.get("ozet"),
        }
    return {"a": ozet(a), "b": ozet(b), "program": ozet(p)}


# ───────────────────────────────────────────────────────────── önek ve küçültme

def onek_senaryo(senaryo_yolu, n):
    with open(senaryo_yolu, encoding="utf-8") as fh:
        sen = json.load(fh)
    s2 = dict(sen)
    s2["adimlar"] = sen["adimlar"][:n]
    # eşzamanlı grup yarıda kesilmesin
    while s2["adimlar"] and n < len(sen["adimlar"]) and s2["adimlar"][-1].get("ayniAnda") is not None \
            and sen["adimlar"][n].get("ayniAnda") == s2["adimlar"][-1].get("ayniAnda"):
        s2["adimlar"] = s2["adimlar"][:-1]
    s2["ad"] = "%s-o%d" % (sen["ad"], n)
    yol = os.path.join(CIKTI, "onek", s2["ad"] + ".json")
    yaz_json(yol, s2)
    return yol


def kucult(senaryo_yolu, desen, onek_adi):
    """Final durum/retlerde `desen` (alan ya da kökSınıf regex'i) ile eşleşen farkı doğuran en kısa önek (ikiye bölme)."""
    with open(senaryo_yolu, encoding="utf-8") as fh:
        sen = json.load(fh)
    rx = re.compile(desen)

    def var_mi(n):
        y = onek_senaryo(senaryo_yolu, n)
        r, _ = tek_kosu(y, "onek/fark-%s-o%d.json" % (onek_adi, n), kucuk_rapor=True)
        es = [f for f in r.get("farklar", []) if f["yol"][0] != "araDurumlar"
              and (rx.search(f["alan"]) or rx.search(f.get("kokSinif", "")))]
        return es
    lo, hi = 0, len(sen["adimlar"])
    son = var_mi(hi)
    if not son:
        return {"bulunamadi": True}
    while hi - lo > 1:
        mid = (lo + hi) // 2
        es = var_mi(mid)
        sys.stderr.write("  önek %d: %s\n" % (mid, "VAR" if es else "yok"))
        if es:
            hi, son = mid, es
        else:
            lo = mid
    return {"enKisaOnek": hi, "sonAdim": sen["adimlar"][hi - 1], "farklar": son[:5]}


# ───────────────────────────────────────────────────────────── özet

def ozet_yaz():
    dosyalar = sorted(glob.glob(os.path.join(CIKTI, "fark-*.json")))
    dosyalar = [d for d in dosyalar if not d.endswith("fark-ozet.json")]
    siniflar = {}
    kosular = []
    for d in dosyalar:
        with open(d, encoding="utf-8") as fh:
            r = json.load(fh)
        m = re.match(r"rastgele-(\d+)-(\d+)$", r.get("senaryo", ""))
        tohum = int(m.group(1)) if m else None
        kosular.append({"dosya": os.path.basename(d), "senaryo": r.get("senaryo"), "tohum": tohum,
                        "islem": r.get("islemSayisi"), "durum": r.get("durum"), "cikis": r.get("cikisKodlari"),
                        "karsilastirilan": r.get("karsilastirilanYaprak"), "atlanan": r.get("atlananBelirsizYaprak"),
                        "fark": r.get("farkSayisi"), "desenler": r.get("desenSayilari"), "sure": r.get("sureler"),
                        "okumaHatasi": len(((r.get("programEk") or {}).get("okumaHatalari")) or []),
                        "programMutabakatTesti": (r.get("programEk") or {}).get("programMutabakatTesti")})
        for ad, s in (r.get("siniflar") or {}).items():
            g = siniflar.setdefault(ad, {"kosuSayisi": 0, "toplamYaprak": 0, "sonDurumYaprak": 0, "kosular": [],
                                         "desenler": {}, "ornek": None, "enKucukTohum": None})
            g["kosuSayisi"] += 1
            g["toplamYaprak"] += s["yaprak"]
            g["sonDurumYaprak"] += s["sonDurumYaprak"]
            g["kosular"].append({"senaryo": r["senaryo"], "yaprak": s["yaprak"], "pencere": s.get("enErkenPencere")})
            for k, v in s["desenler"].items():
                g["desenler"][k] = g["desenler"].get(k, 0) + v
            anahtar = (tohum if tohum is not None else -1, r.get("islemSayisi") or 0)
            if g["enKucukTohum"] is None or anahtar < tuple(g["enKucukTohum"]["anahtar"]):
                g["enKucukTohum"] = {"anahtar": list(anahtar), "senaryo": r["senaryo"],
                                     "pencere": s.get("enErkenPencere"), "ornekler": s.get("ornekler")}
    out = {"kosular": kosular, "siniflar": dict(sorted(siniflar.items(), key=lambda kv: -kv[1]["kosuSayisi"])),
           "sinifSayisi": len(siniflar),
           "kuralAciklamalari": {ad: ac for ad, ac, _ in KOK_SINIFLARI}}
    yaz_json(os.path.join(CIKTI, "fark-ozet.json"), out)
    return out


# ───────────────────────────────────────────────────────────── ana

def main(argv):
    ap = argparse.ArgumentParser(description="model_a ↔ model_b ↔ program farkı")
    g = ap.add_mutually_exclusive_group(required=True)
    g.add_argument("--tohum", type=int)
    g.add_argument("--senaryo")
    g.add_argument("--ozet", action="store_true")
    g.add_argument("--yeniden-sinifla", action="store_true",
                   help="cikti/fark-*.json'daki farkları KOK_SINIFLARI ile yeniden sınıfla (koşmadan)")
    ap.add_argument("--islem", type=int, default=500)
    ap.add_argument("--kontrol", type=int, default=25)
    ap.add_argument("--onek", type=int)
    ap.add_argument("--kucult")
    a = ap.parse_args(argv[1:])
    if a.ozet:
        o = ozet_yaz()
        sys.stdout.write("fark-ozet.json: %d koşu, %d sınıf\n" % (len(o["kosular"]), o["sinifSayisi"]))
        return 0
    if a.yeniden_sinifla:
        return yeniden_sinifla()
    if a.tohum is not None:
        u = uretici_yukle()
        sen = u.uret(a.tohum, a.islem, a.kontrol)
        yol = os.path.join(CIKTI, "senaryolar", sen["ad"] + ".json")
        yaz_json(yol, sen)
        cikti_adi = "fark-%d.json" % a.tohum
        onek_adi = str(a.tohum)
    else:
        yol = os.path.abspath(a.senaryo)
        with open(yol, encoding="utf-8") as fh:
            ad = json.load(fh)["ad"]
        cikti_adi = "fark-%s.json" % ad
        onek_adi = ad
    if a.kucult:
        r = kucult(yol, a.kucult, onek_adi)
        yaz_json(os.path.join(CIKTI, "onek", "kucult-%s-%s.json" % (onek_adi, re.sub(r"[^A-Za-z0-9]+", "_", a.kucult))), r)
        sys.stdout.write(json.dumps(r, ensure_ascii=False, indent=2)[:4000] + "\n")
        return 0
    if a.onek:
        yol = onek_senaryo(yol, a.onek)
        cikti_adi = "onek/fark-%s-o%d.json" % (onek_adi, a.onek)
    r, kod = tek_kosu(yol, cikti_adi)
    sys.stdout.write("%s: çıkış a=%s b=%s program=%s · karşılaştırılan %s · atlanan %s · fark %s %s\n" % (
        r["senaryo"], r["cikisKodlari"]["a"], r["cikisKodlari"]["b"], r["cikisKodlari"]["program"],
        r.get("karsilastirilanYaprak"), r.get("atlananBelirsizYaprak"), r.get("farkSayisi"), r.get("desenSayilari")))
    for ad, s in (r.get("siniflar") or {}).items():
        sys.stdout.write("  %-60s %4d yaprak  %s\n" % (ad[:60], s["yaprak"], s["desenler"]))
    return kod


def yeniden_sinifla():
    """Koşmadan: mevcut fark dosyalarındaki farklara güncel KOK_SINIFLARI'nı uygula, sınıf özetini yeniden yaz."""
    for d in sorted(glob.glob(os.path.join(CIKTI, "fark-*.json"))):
        if d.endswith("fark-ozet.json"):
            continue
        with open(d, encoding="utf-8") as fh:
            r = json.load(fh)
        if r.get("durum") != "TAMAM":
            continue
        with open(os.path.join(KOK, r["senaryoDosyasi"]), encoding="utf-8") as fh:
            sen = json.load(fh)
        adimlar = {x["id"]: x for x in sen["adimlar"]}
        sira = adim_haritasi(sen)
        bag = {"adimlar": adimlar, "sira": sira, "sen": sen}
        siniflar = {}
        for f in r["farklar"]:
            if f["desen"] not in ("PROGRAM-ICI",):
                f["kokSinif"] = kok_sinif(f, bag)
            s = siniflar.setdefault(f["kokSinif"], {"yaprak": 0, "sonDurumYaprak": 0, "araDurumYaprak": 0,
                                                     "desenler": {}, "aileler": {}, "ornekler": [],
                                                     "enErkenPencere": None})
            s["yaprak"] += 1
            if f["yol"][0] == "araDurumlar":
                s["araDurumYaprak"] += 1
            else:
                s["sonDurumYaprak"] += 1
            s["desenler"][f["desen"]] = s["desenler"].get(f["desen"], 0) + 1
            s["aileler"][f["aile"]] = s["aileler"].get(f["aile"], 0) + 1
            if len(s["ornekler"]) < 4 and f["yol"][0] != "araDurumlar":
                s["ornekler"].append({k: f[k] for k in ("alan", "a", "b", "program", "desen", "pencere") if k in f})
            pen = f.get("pencere")
            if pen and pen[1] in sira:
                if s["enErkenPencere"] is None or sira[pen[1]] < sira.get(s["enErkenPencere"][1], 10 ** 9):
                    s["enErkenPencere"] = pen
        r["siniflar"] = dict(sorted(siniflar.items()))
        yaz_json(d, r)
    ozet_yaz()
    return 0


if __name__ == "__main__":
    sys.exit(main(sys.argv))
