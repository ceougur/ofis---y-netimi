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
Kök sınıf kuralları (birincil_sinif, turev_sinif) farkların incelenmesinden sonra elle yazıldı; her kural farkın görünen biçimine (alan,
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
# Kurallar farkların incelenmesinden sonra elle yazıldı (fark-ozet.json). İki tür:
#  (1) BİRİNCİL: farkın kendisi kökü gösterir (ret kodu, fatura tutarı, açılış hesabı, kart hesabı …).
#  (2) TÜREV: cari/banka/Kasa/mizan gibi toplam alanlar. Her türev yaprağın (program − kâhin) farkı kontrol noktaları
#      boyunca izlenir; farkın DEĞİŞTİĞİ her pencere ("olay") o penceredeki bilinen-kök adımlarıyla ve büyüklükle
#      açıklanmaya çalışılır. Açıklanamayan olay "ACIKLANMAMIS" olur (gizlenmez, elle incelenir).
# Bu kurallar beklenen değer üretmez; yalnız farkın nereden geldiğini etiketler. Kanıt nötrleştirilmiş varyant koşusudur
# (uretici --notr: bilinen kökler kapatılınca fark kalmamalı).

SINIF_ACIKLAMALARI = {
    "KDV-DAHIL-ISKONTO": "KDV dahil fiyatlı iskontolu kalemde program iskontoyu KDV dahil brüte uygulayıp sonra matrahı "
                         "ayırıyor; dil §6.3 önce matrahı ayırıp iskontoyu matraha uyguluyor [YAYGIN] → ±1 kuruş "
                         "(matrah/KDV/toplam, peşin 'tamami', taksit kartı, cari, banka). Sınıf: İNCELE.",
    "KASA-ACILIS-649": "Kasa açılışı ('Açılış Bakiyesi' açıklamalı Kasa girişi) programda 649'a, kâhinlerde 500'e yazılıyor "
                       "(dil §4.8 [YAYGIN]; plan A8 'Açılış hesabını açıklama metni belirliyor'). Sınıf: İNCELE.",
    "KART-HESABI-BAGLANMIYOR": "Modül uçlarında (cari ödeme, alış faturası peşini) kurumsal kart yolu verilen hesabı "
                               "bağlamıyor ve denetlemiyor: satır 108.00'e (hesabı atanmamış) yazılıyor, 309.NN'ye değil; "
                               "kart yolunda 102 hesabı verilse de 400 yok. Dil §5.2 [PLAN §3.5, §3.11 moneyAccount "
                               "'card kurumsal kart → 309.NN']. Sınıf: BULGU.",
    "BANKA-EKSI-KODU": "Banka hesabında eksi bakiye 'Uyar' reddinin kodu programda bank-negative, dilde cash-negative "
                       "[ÇIKARIM §7: mevcut kodlara accountId eklenir]. Durum (409) aynı. Sınıf: İNCELE.",
    "KOSUCU-ALIS-YINELEME-NUMARA": "KOŞUCU: surucu.mjs alış faturasında belge numarası olarak takma adı (`number: step.ad`) "
                                   "gönderiyor; yinelemenin adı farklı olduğundan gövde farklı → program 409 "
                                   "request-id-reused (programın davranışı tutarlı; koşucu eşlemesi yanlış).",
    "KAHIN-K4-YINELENEN-AD": "KÂHİNLER AYRIŞIYOR: istek kimliğiyle yinelenen faturanın yeni takma adı çıktıya model_b'de "
                             "ve programda yazılıyor (K4), model_a'da yazılmıyor (K-4). Dil §5.4 'ad'ı önceki adımın "
                             "hareketini anar' iki yoruma açık → dil sürüm 2'de netleşmeli.",
    "IADE-KAPAMA": "İade belgesinin kapanışı: program iadeyi geri ödense de asıl faturanın açığından düşüyor (geri ödeme "
                   "ayrıca carinin öbür belgelerini kapatıyor) ve geri ödenmemiş iadede asıl kapalıysa iade belgesinin "
                   "açığını 0 gösteriyor. Dil §7 kural 2 ve 5 [YAYGIN]. Mini senaryolarda programın açıkları kendi cari "
                   "bakiyesini tutmuyor (Σ açık ≠ bakiye, avans yok) → Sınıf: BULGU.",
    "KASA-ISTEK-KIMLIGI": "Kasa elle hareketi (POST /api/workspace/cash) istek kimliğini (x-hof-request) dikkate almıyor: "
                          "aynı kimlik + aynı gövde ikinci kez yazılıyor, farklı gövde 409 yerine kabul ediliyor. "
                          "PLAN §7 'Yazan her uç x-hof-request alır'; §3.3 adım 1. Sınıf: BULGU.",
    "VADELI-HESAP-FIS": "Vadeli hesapta banka masrafı, diğer gelir/gider ve faiz gideri: program 400 bank-account-invalid "
                        "('Vadesiz, Ticari ya da Diğer TL hesap'), dil §4.20–4.23 '102 türü hesap' diyerek kabul ediyor. "
                        "PLAN §3.5 tablosu 'Vadeli … Hayır; yalnız transfer ve faiz' programı destekliyor (faiz gideri "
                        "de reddediliyor; 'faiz' faiz geliri mi ikisi mi açık değil) → DİL/KÂHİN eksiği, dil sürüm 2.",
    "ACILIS-EKSI-KMH": "Ticari ve Diğer türü hesapta eksi açılış bakiyesi (KMH) programda 400 amount-range ('Açılış "
                       "Bakiyesi eksi olamaz'); vadesizde kabul. PLAN §3.5 tablosunda 'KMH Limiti alanı' yalnız Vadesiz "
                       "satırında; dil §3.3/§4.4 vadesiz/ticari/diğer'e eksi açılış ve kmhLimiti veriyor → DİL/KÂHİN "
                       "geniş, program planla uyumlu (dil sürüm 2). Reddedilen hesaba bağlı sonraki adımlar programda "
                       "atlanır (zincir).",
    "KREDI-ANAPARA-ASIMI": "Kredi geri ödemesinde anapara kalan kredi borcunu aşınca program 409 bank-loan-exceeds; dilde "
                           "bu kural yok (kâhinler kabul edip kredi hesabını borçlu yapıyor). Program davranışı makul → "
                           "DİL eksiği (sürüm 2'ye kural) + üreteç gerçekçi tutar seçmeli.",
}

# Durum değiştirmeyen sınıflar (iki taraf da reddediyor ya da kâhin yinelemeyi etkisiz sayıyor, program 409 veriyor):
# türev olayları açıklamaz.
DURUMSUZ_SINIFLAR = {"BANKA-EKSI-KODU", "KOSUCU-ALIS-YINELEME-NUMARA"}

TUREV_AILELER = ("cariler.*", "bankaHesaplari.*", "kasa", "mizan.", "ozet.", "taksitKartlari.*.", "faturalar.*.acik",
                 "stok.*")


def _num(v):
    if isinstance(v, bool):
        return int(v)
    if isinstance(v, int):
        return v
    if isinstance(v, (tuple, list)) and len(v) == 2:
        return v[0] - v[1]
    if isinstance(v, dict) and "borc" in v:
        return v["borc"] - v["alacak"]
    return 0


def baglam(sen, a=None, b=None, p=None):
    adimlar = {x["id"]: x for x in sen["adimlar"]}
    sira = adim_haritasi(sen)
    fatura = {}
    for x in sen["adimlar"]:
        if x["islem"] in ("fatura", "iade") and "ad" in x:
            fatura[x["ad"]] = x
        if x["islem"] == "banka_masraf" and "fatura" in x:
            fatura[x["fatura"]] = x
    def dahil_isk_kalem(k):
        return k.get("kdvDahil") is True and k.get("iskontoOrani") not in (None, "0", "0,0", "0,00")
    dahil_isk = set()
    for ad, x in fatura.items():
        if x["islem"] == "fatura" and any(dahil_isk_kalem(k) for k in x["kalemler"]):
            dahil_isk.add(ad)
    for ad, x in fatura.items():
        if x["islem"] == "iade" and x["asilFatura"] in fatura:
            asil = fatura[x["asilFatura"]]
            for k in x["kalemler"]:
                n = k.get("kalem", 0)
                if 1 <= n <= len(asil.get("kalemler", [])) and dahil_isk_kalem(asil["kalemler"][n - 1]):
                    dahil_isk.add(ad)
    # yinelemeler: (kullanıcı, işlem, kimlik) ilk görülen = asıl
    ilk = {}
    yineleme = {}
    yineleme_ad = {}
    for x in sen["adimlar"]:
        if "istekKimligi" not in x:
            continue
        k = (x.get("kullanici", "Y"), x["islem"], x["istekKimligi"])
        if k in ilk:
            yineleme[x["id"]] = ilk[k]
            o = adimlar[ilk[k]]
            if "ad" in x and "ad" in o:
                yineleme_ad[x["ad"]] = o["ad"]
            ot = ((o.get("odeme") or {}).get("taksit") or {}).get("ad")
            yt = ((x.get("odeme") or {}).get("taksit") or {}).get("ad")
            if ot and yt:
                yineleme_ad[yt] = ot
        else:
            ilk[k] = x["id"]
    kart_hesaplari = {x["ad"] for x in sen["adimlar"] if x["islem"] == "hesap_ac" and x.get("tur") == "kurumsal_kart"}
    kart_adim = {}
    for x in sen["adimlar"]:
        if x["islem"] == "cari_odeme" and x.get("yol") == "kart":
            kart_adim[x["id"]] = x.get("tutar") or x.get("tutarHam")
        if x["islem"] == "fatura":
            for r in (x.get("odeme") or {}).get("pesin") or []:
                if r.get("yol") == "kart":
                    kart_adim[x["id"]] = r.get("tutar")
    # dahil+iskonto belgesine dokunan adımlar
    isk_kart = {((x.get("odeme") or {}).get("taksit") or {}).get("ad") for a_, x in fatura.items() if a_ in dahil_isk}
    isk_adim = set()
    for x in sen["adimlar"]:
        if x["islem"] in ("fatura", "iade") and x.get("ad") in dahil_isk:
            isk_adim.add(x["id"])
        if x.get("kapatilacakFatura") in dahil_isk:
            isk_adim.add(x["id"])
        if x["islem"] == "taksit_tahsilat" and x.get("kart") in isk_kart:
            isk_adim.add(x["id"])
        if x["islem"] == "sil" and x.get("hedef") is not None:
            pass
    # silinen hareketin adımı da (silme penceresinde etkisi geri döner)
    hareket_adim = {x["ad"]: x["id"] for x in sen["adimlar"] if "ad" in x}
    # Yayılma: dahil+iskonto belgesi olan carinin SONRAKİ her hareketi (FIFO/avans ile 1 kuruş başka belgeye geçebilir;
    # ör. tohum 5: kalanı kâhin değeriyle ödenen kart programda 1 kuruş fazla ödenir, artan başka faturayı kapatır).
    kart_cari = {}
    for x in sen["adimlar"]:
        t_ = ((x.get("odeme") or {}).get("taksit") or {}).get("ad")
        if t_:
            kart_cari[t_] = x.get("cari")
    def cari_of(x):
        if x["islem"] in ("fatura", "cari_tahsilat", "cari_odeme"):
            return x.get("cari")
        if x["islem"] == "iade":
            return (fatura.get(x.get("asilFatura")) or {}).get("cari")
        if x["islem"] == "taksit_tahsilat":
            return kart_cari.get(x.get("kart"))
        if x["islem"] == "banka_masraf":
            return x.get("saglayici")
        if x["islem"] in ("sil", "ters_kayit"):
            h = adimlar.get(hareket_adim.get(x.get("hedef")))
            return cari_of(h) if h and h["islem"] not in ("sil", "ters_kayit") else None
        return None
    isk_cari = set()
    isk_sayac = 0
    isk_sayisi = {}
    for x in sen["adimlar"]:
        c_ = cari_of(x)
        if x["id"] in isk_adim and c_:
            isk_cari.add(c_)
            if x["islem"] in ("fatura", "iade"):
                isk_sayac += 1
        elif c_ in isk_cari:
            isk_adim.add(x["id"])
        isk_sayisi[x["id"]] = isk_sayac
    for x in sen["adimlar"]:
        if x["islem"] in ("sil", "ters_kayit") and hareket_adim.get(x.get("hedef")) in isk_adim:
            isk_adim.add(x["id"])
        if x["islem"] in ("sil", "ters_kayit") and hareket_adim.get(x.get("hedef")) in kart_adim:
            kart_adim[x["id"]] = kart_adim[hareket_adim[x["hedef"]]]
    # iade: iade adımı + o carinin sonraki her hareketi (iade kapaması FIFO ile öbür belgelere yayılır)
    iade_adim = set()
    iade_cari = set()
    for x in sen["adimlar"]:
        c_ = cari_of(x)
        if x["islem"] == "iade" and c_:
            iade_cari.add(c_)
            iade_adim.add(x["id"])
        elif c_ in iade_cari:
            iade_adim.add(x["id"])
    # takma adı tanımlayan adım
    tanim = {}
    for x in sen["adimlar"]:
        for a_ in (x.get("ad"), ((x.get("odeme") or {}).get("taksit") or {}).get("ad"),
                   x.get("fatura") if x["islem"] == "banka_masraf" else None):
            if a_ and a_ not in tanim:
                tanim[a_] = x["id"]
    alis_yineleme = {i for i, o in yineleme.items() if adimlar[i]["islem"] == "fatura" and adimlar[i].get("tur") == "alis"}
    alis_yineleme_ad = set()
    for i in alis_yineleme:
        x = adimlar[i]
        alis_yineleme_ad.add(x.get("ad"))
    kontroller = [x["id"] for x in sen["adimlar"] if x["islem"] == "kontrol"]
    return {"adimlar": adimlar, "sira": sira, "sen": sen, "fatura": fatura, "dahil_isk": dahil_isk,
            "yineleme": yineleme, "yineleme_ad": yineleme_ad, "kart_hesaplari": kart_hesaplari, "kart_adim": kart_adim,
            "isk_adim": isk_adim, "alis_yineleme": alis_yineleme, "alis_yineleme_ad": alis_yineleme_ad,
            "kasa_acilis": [x["id"] for x in sen["adimlar"] if x["islem"] == "kasa_acilis"],
            "kontroller": kontroller, "isk_sayisi": isk_sayisi, "iade_adim": iade_adim, "tanim": tanim,
            "adim_sinifi": {}, "p_atlanan": set((p or {}).get("atlananlar") or []),
            "banka_hesaplari": {x["ad"] for x in sen["adimlar"] if x["islem"] == "hesap_ac"},
            "a": a, "b": b, "p": p}


def _taban(yol):
    return tuple(yol[2:]) if yol[0] == "araDurumlar" else tuple(yol)


def _ret_metni(v):
    return v if isinstance(v, str) else ret_ozeti(v)


def birincil_sinif(f, bag):
    yol = f["yol"]
    t = _taban(yol)
    desen = f["desen"]
    if yol[0] in ("eslenemeyen",):
        neden = str((f.get("program") or {}).get("neden", ""))
        if "Kart yolunda" in neden:
            return "KART-HESABI-BAGLANMIYOR"
        return None
    if t[0] == "atlananlar" or (t[0] == "retler" and t[1] in bag["p_atlanan"]):
        return _atlama_sinifi(bag, t[1])
    if t[0] in ("retler", "yinelenenler"):
        sid = t[1]
        x = bag["adimlar"].get(sid, {})
        if sid in bag["alis_yineleme"]:
            return "KOSUCU-ALIS-YINELEME-NUMARA"
        asil = bag["yineleme"].get(sid)
        if asil in bag["adim_sinifi"]:
            return bag["adim_sinifi"][asil]   # asıl istek programda reddedildi → yineleme yeni istek sayıldı
        if x.get("islem") == "kasa_hareket" and "istekKimligi" in x:
            return "KASA-ISTEK-KIMLIGI"
        if t[0] == "retler":
            av, bv, pv = (_ret_metni(f[k]) for k in ("a", "b", "program"))
            if "cash-negative" in av and "cash-negative" in bv and "bank-negative" in pv:
                return "BANKA-EKSI-KODU"
            if "cash-blocked" in av and "cash-blocked" in bv and "bank-blocked" in pv:
                return "BANKA-EKSI-KODU"
            if sid in bag["kart_adim"]:
                return "KART-HESABI-BAGLANMIYOR"
            if "bank-loan-exceeds" in pv:
                return "KREDI-ANAPARA-ASIMI"
            if x.get("islem") in ("hesap_ac", "acilis_duzelt") and str(x.get("acilisBakiyesi", "")).startswith("-") \
                    and "amount-range" in pv and av == "geçti":
                return "ACILIS-EKSI-KMH"
            if "bank-account-invalid" in pv and av == "geçti" and bv == "geçti":
                hd = bag["adimlar"].get(bag["tanim"].get(x.get("hesap")), {})
                if hd.get("tur") == "vadeli":
                    return "VADELI-HESAP-FIS"
            if "payment-exceeds" in pv and x.get("ad") in bag["dahil_isk"]:
                return "KDV-DAHIL-ISKONTO"
            if av == "geçti" and bv == "geçti" and any(k in pv for k in ZINCIR_KODLARI):
                z = _zincir_sinifi(bag, x, pv)
                if z:
                    return z
        return None
    if t[0] in ("faturalar", "taksitKartlari", "bankaHesaplari", "hesapKodlari", "eksiBakiyeDenetimi", "cariler",
                "stok") and len(t) >= 2 and (f["a"] == YOK or f["program"] == YOK or f["b"] == YOK):
        d = bag["tanim"].get(t[1])
        if d in bag["adim_sinifi"]:
            return bag["adim_sinifi"][d]
        if d in bag["p_atlanan"]:
            z = _atlama_sinifi(bag, d)
            if z:
                return z
    if t[0] == "hesapKodlari" and desen == "A=B≠P":
        # alt hesap numarası kayması: önce açılan aynı ana koddaki bir hesap programda reddedildi
        d0 = bag["tanim"].get(t[1])
        for ad_, d in bag["tanim"].items():
            x_ = bag["adimlar"].get(d, {})
            if x_.get("islem") == "hesap_ac" and d in bag["adim_sinifi"] and bag["sira"].get(d, 0) < bag["sira"].get(d0, 0):
                return bag["adim_sinifi"][d]
    if t[0] in ("faturalar", "taksitKartlari") and len(t) >= 2:
        ad = t[1]
        if ad in bag["alis_yineleme_ad"] or (ad in bag["yineleme_ad"] and bag["yineleme_ad"][ad] in bag["fatura"]
                                             and bag["fatura"][bag["yineleme_ad"][ad]].get("tur") == "alis"
                                             and desen == "B≠A=P"):
            return "KOSUCU-ALIS-YINELEME-NUMARA"
        if ad in bag["yineleme_ad"]:
            return "KAHIN-K4-YINELENEN-AD"
        if t[0] == "faturalar" and desen == "A=B≠P" and ad in bag["dahil_isk"] and t[2] in ("toplam", "matrah", "kdv"):
            if isinstance(f["a"], int) and isinstance(f["program"], int) and abs(f["a"] - f["program"]) <= 3:
                return "KDV-DAHIL-ISKONTO"
    if t[0] == "mizan" and t[1] in ("500", "649") and desen == "A=B≠P" and bag["kasa_acilis"]:
        return "KASA-ACILIS-649"
    if desen == "A=B≠P" and bag["kart_adim"] and bag["kart_hesaplari"]:
        if (t[0] == "mizan" and (t[1] == "108.00" or t[1].startswith("309."))) or \
                (t[0] == "ozet" and t[1] in ("hesabiAtanmamis", "kartVeKrediBorcu")) or \
                (t[0] == "bankaHesaplari" and t[1] in bag["kart_hesaplari"]):
            return "KART-HESABI-BAGLANMIYOR"
    return None


ZINCIR_KODLARI = ("cash-negative", "cash-blocked", "bank-negative", "bank-blocked", "stock-negative", "payment-exceeds")


def _atlama_sinifi(bag, sid):
    """Programda atlanan adım: andığı takma adı tanımlayan adımın sınıfı."""
    x = bag["adimlar"].get(sid, {})
    adlar = [x.get(a_) for a_ in ("hedef", "hesap", "cari", "kart", "asilFatura", "kapatilacakFatura", "kaynak",
                                   "kredi", "saglayici")]
    adlar += [r_.get("hesap") for r_ in (x.get("odeme") or {}).get("pesin") or []]
    adlar += [(x.get("geri") or {}).get("hesap")] + [k_.get("urun") for k_ in x.get("kalemler") or []]
    for ad_ in adlar:
        d = bag["tanim"].get(ad_)
        if d and d in bag["adim_sinifi"]:
            return bag["adim_sinifi"][d]
        if d and d in bag["p_atlanan"] and d != sid:
            z = _atlama_sinifi(bag, d)
            if z:
                return z
    return None


def _zincir_sinifi(bag, x, pv):
    """Programın bakiye/stok reddi kâhinlerde yoksa: o Kasa/banka/stok yaprağında adımdan ÖNCEKİ farkların kökü (zincir)."""
    yapraklar_ = []
    if "cash-" in pv:
        yapraklar_ = [("kasa",)]
    elif "bank-" in pv:
        yapraklar_ = [("bankaHesaplari", h) for h in bag["kart_hesaplari"] | bag["banka_hesaplari"]]
    elif "stock-" in pv:
        yapraklar_ = [("stok", k["urun"]) for k in x.get("kalemler", []) if "urun" in k]
    elif "payment-exceeds" in pv:
        yapraklar_ = [("faturalar", x.get("ad"), "toplam")]
    sinir = bag["sira"].get(x["id"], 0)
    kokler = set()
    for taban in yapraklar_:
        seri = _seri(bag, taban, "a", "p")
        once, once_k = 0, "baslangic"
        for k, d in seri:
            if k != "son" and bag["sira"].get(k, 0) > sinir:
                break
            if d != once:
                ac = _olay_acikla(bag, d - once, _pencere_adimlari(bag, once_k, k), "")
                if ac:
                    kokler.update(ac)
            once, once_k = d, k
    kokler -= DURUMSUZ_SINIFLAR
    return "+".join(sorted(kokler)) if len(kokler) == 1 else (("ZINCIR:" + "+".join(sorted(kokler))) if kokler else None)


def _seri(bag, taban, x_key, y_key):
    """Kontrol noktaları boyunca (y − x) farkı: [(kontrol id ya da 'son', fark)]."""
    out = []
    for k in bag["kontroller"]:
        vals = []
        for key in (x_key, y_key):
            c = bag[key]
            ara = (c.get("araDurumlar") or {}).get(k)
            vals.append(_num(durum_yapraklari(ara).get(taban, bos_deger(taban))) if ara is not None else 0)
        out.append((k, vals[1] - vals[0]))
    vals = [_num(durum_yapraklari(bag[key]).get(taban, bos_deger(taban))) for key in (x_key, y_key)]
    out.append(("son", vals[1] - vals[0]))
    return out


def _pencere_adimlari(bag, bas, son):
    sira, sen = bag["sira"], bag["sen"]["adimlar"]
    i0 = sira[bas] + 1 if bas in sira else 0
    i1 = sira[son] if son in sira else len(sen)
    return [x["id"] for x in sen[i0:i1]]


def _tutar_kurus(m):
    if not isinstance(m, str) or m == "tamami":
        return None
    m = m.lstrip("-")
    if "," in m:
        t, k = m.split(",", 1)
        k = (k + "000")[:3]
        return int(t) * 100 + (int(k) + 5) // 10
    return int(m) * 100


def _olay_acikla(bag, delta, adimlar, aile_=""):
    """Bir olayın (farkın bir penceredeki değişimi) bilinen köklerle açıklaması: liste ya da None."""
    # 1) sonucu (ret/yineleme/atlama) programda farklı çıkan adım: etkisi o adımın kök sınıfına aittir (tutardan bağımsız)
    ret = sorted({k for i in adimlar if i in bag["adim_sinifi"] for k in kok_ana(bag["adim_sinifi"][i])}
                 - DURUMSUZ_SINIFLAR)
    isk = [i for i in adimlar if i in bag["isk_adim"]]
    if ret:
        return ret + (["KDV-DAHIL-ISKONTO"] if isk and "KDV-DAHIL-ISKONTO" not in ret else [])
    # 2) iade kapaması yalnız açık alanlarını etkiler (bakiye değişmez)
    if aile_ in ("faturalar.*.acik",) and any(i in bag["iade_adim"] for i in adimlar):
        return ["IADE-KAPAMA"] + (["KDV-DAHIL-ISKONTO"] if isk else [])
    kart = [i for i in adimlar if i in bag["kart_adim"]]
    tol = max(2, 2 * max([bag["isk_sayisi"].get(i, 0) for i in adimlar] or [0])) if isk else 0
    nedenler = []
    if isk and abs(delta) <= tol:
        return ["KDV-DAHIL-ISKONTO"]
    if kart:
        tutarlar = [_tutar_kurus(bag["kart_adim"][i]) for i in kart]
        if any(t is None for t in tutarlar):
            nedenler = ["KART-HESABI-BAGLANMIYOR"] + (["KDV-DAHIL-ISKONTO"] if isk else [])
            return nedenler
        n = len(tutarlar)
        if n <= 14:
            for maske in range(1, 1 << n):
                top = sum(tutarlar[j] for j in range(n) if maske >> j & 1)
                if abs(abs(delta) - top) <= tol:
                    return ["KART-HESABI-BAGLANMIYOR"] + (["KDV-DAHIL-ISKONTO"] if isk and abs(delta) != top else [])
        else:
            return ["KART-HESABI-BAGLANMIYOR"] + (["KDV-DAHIL-ISKONTO"] if isk else [])
    return None


def turev_sinif(f, bag):
    """Türev yaprak için (sınıf, olaylar)."""
    if bag.get("a") is None:
        return None, []
    taban = _taban(f["yol"])
    desen = f["desen"]
    x_key, y_key = ("a", "p") if desen in ("A=B≠P", "A≠B≠P") else (("a", "b") if desen == "A≠B=P" else ("b", "a"))
    seri = _seri(bag, taban, x_key, y_key)
    olaylar = []
    once, once_k = 0, "baslangic"
    for k, d in seri:
        if d != once:
            adim = _pencere_adimlari(bag, once_k, k)
            ac = _olay_acikla(bag, d - once, adim, f["aile"])
            olaylar.append({"pencere": [once_k, k], "degisim": d - once, "neden": ac or "ACIKLANMAMIS"})
        once, once_k = d, k
    nedenler = set()
    for o in olaylar:
        if o["neden"] == "ACIKLANMAMIS":
            return "ACIKLANMAMIS:%s:%s" % (desen, f["aile"]), olaylar
        nedenler.update(o["neden"])
    if not nedenler:
        return None, olaylar
    return "TUREV:" + "+".join(sorted(nedenler)), olaylar


def adim_siniflari(farklar, bag):
    """Sonucu farklı çıkan adımlar (retler/yinelenenler) → birincil sınıf; türev olay açıklamasında kullanılır."""
    for _ in range(6):
        degisti = False
        for f in farklar:
            t = _taban(f["yol"])
            if t[0] in ("retler", "yinelenenler", "atlananlar") and t[1] not in bag["adim_sinifi"]:
                s_ = birincil_sinif(f, bag)
                if s_:
                    bag["adim_sinifi"][t[1]] = s_
                    degisti = True
        if not degisti:
            break


def tetik_adim(f, bag, sinif):
    """Sınıfın bu yaprakta görünmesine yol açan ilk adım (yeniden üretim öneki bu adıma kadar)."""
    t = _taban(f["yol"])
    if t[0] in ("retler", "yinelenenler", "atlananlar", "eslenemeyen"):
        return t[1]
    if t[0] in ("faturalar", "taksitKartlari") and len(t) >= 2 and sinif != "IADE-KAPAMA":
        return bag["tanim"].get(t[1])
    if sinif == "KASA-ACILIS-649" and bag["kasa_acilis"]:
        return bag["kasa_acilis"][0]
    for o in f.get("olaylar") or []:
        adim = _pencere_adimlari(bag, o["pencere"][0], o["pencere"][1])
        aday = []
        if sinif == "KART-HESABI-BAGLANMIYOR":
            aday = [i for i in adim if i in bag["kart_adim"]]
        elif sinif == "IADE-KAPAMA":
            aday = [i for i in adim if bag["adimlar"][i]["islem"] == "iade"] or [i for i in adim if i in bag["iade_adim"]]
        elif sinif == "KDV-DAHIL-ISKONTO":
            aday = [i for i in adim if i in bag["isk_adim"]]
        else:
            aday = [i for i in adim if bag["adim_sinifi"].get(i) == sinif]
        if aday:
            return aday[0]
    if sinif == "KART-HESABI-BAGLANMIYOR" and bag["kart_adim"]:
        return sorted(bag["kart_adim"], key=lambda i: bag["sira"][i])[0]
    return None


def kok_sinif(f, bag):
    s = birincil_sinif(f, bag)
    if s:
        if f["yol"][0] != "araDurumlar":
            f["tetik"] = tetik_adim(f, bag, s)
        return s
    if any(f["aile"].startswith(x) or f["aile"] == x for x in TUREV_AILELER):
        s, olay = turev_sinif(f, bag)
        if f["yol"][0] != "araDurumlar":
            f["olaylar"] = olay
        if s:
            if f["yol"][0] != "araDurumlar" and s.startswith("TUREV:"):
                f["tetik"] = {k: tetik_adim(f, bag, k) for k in kok_ana(s)}
            return s
    return "SINIFLANMAMIS:%s:%s" % (f["desen"], f["aile"])


def kok_ana(sinif):
    """Türev sınıfı ('TUREV:A+B') → kök sınıflar listesi; birincil → [kendisi]."""
    if sinif.startswith("TUREV:"):
        return sinif[6:].split("+")
    if sinif.startswith("ZINCIR:"):
        return sinif[7:].split("+")
    return sinif.split("+") if "+" in sinif and not sinif.startswith(("ACIKLANMAMIS", "SINIFLANMAMIS")) else [sinif]


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
    bag = baglam(sen, a, b, pv)
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
    adim_siniflari(farklar, bag)
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
                                               "aile": "eslenemeyen:" + str(e.get("islem")), "program": e,
                                               "a": None}, bag)})
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
    # kök sınıflar: birincil + türev üyelikleri (nötr koşular ayrı)
    kokler = {}
    aciklanmamis = []
    for d in dosyalar:
        with open(d, encoding="utf-8") as fh:
            r = json.load(fh)
        if r.get("durum") != "TAMAM":
            continue
        m = re.match(r"rastgele-(\d+)-(\d+)(-notr)?$", r.get("senaryo", ""))
        tohum = int(m.group(1)) if m else None
        notr = bool(m and m.group(3))
        sira = {}
        try:
            with open(os.path.join(KOK, r["senaryoDosyasi"]), encoding="utf-8") as fh:
                sira = adim_haritasi(json.load(fh))
        except OSError:
            pass
        for f in r["farklar"]:
            if f["yol"][0] == "araDurumlar":
                continue
            ks = f.get("kokSinif", "")
            if ks.startswith("ACIKLANMAMIS") or ks.startswith("SINIFLANMAMIS"):
                aciklanmamis.append({"senaryo": r["senaryo"], "alan": f["alan"], "a": f["a"], "b": f["b"],
                                     "program": f["program"], "sinif": ks})
                continue
            for k in kok_ana(ks) if not ks.startswith("PROGRAM-ICI") else [ks]:
                g = kokler.setdefault(k, {"aciklama": SINIF_ACIKLAMALARI.get(k, ""), "kosular": {}, "birincilYaprak": 0,
                                          "turevYaprak": 0, "notrKosuda": 0, "enKucukTohum": None})
                if notr:
                    g["notrKosuda"] += 1
                    continue
                g["kosular"].setdefault(r["senaryo"], 0)
                g["kosular"][r["senaryo"]] += 1
                if ks.startswith("TUREV:"):
                    g["turevYaprak"] += 1
                    tet = (f.get("tetik") or {}).get(k) if isinstance(f.get("tetik"), dict) else None
                else:
                    g["birincilYaprak"] += 1
                    tet = f.get("tetik")
                anahtar = [tohum if tohum is not None else -1, r.get("islemSayisi") or 0,
                           0 if not ks.startswith("TUREV:") else 1, sira.get(tet, 10 ** 9)]
                if g["enKucukTohum"] is None or anahtar < g["enKucukTohum"]["anahtar"]:
                    g["enKucukTohum"] = {"anahtar": anahtar, "senaryo": r["senaryo"], "tetikAdim": tet,
                                         "tetikSirasi": sira.get(tet), "pencere": f.get("pencere"),
                                         "ornek": {k2: f.get(k2) for k2 in ("alan", "a", "b", "program", "desen")}}
    for g in kokler.values():
        g["kosuSayisi"] = len(g["kosular"])
    out = {"kosular": kosular, "kokSiniflar": dict(sorted(kokler.items(), key=lambda kv: -kv[1].get("kosuSayisi", 0))),
           "kokSinifSayisi": len([k for k in kokler if not k.startswith("PROGRAM-ICI")]),
           "aciklanmamis": aciklanmamis, "aciklanmamisSayisi": len(aciklanmamis),
           "siniflar": dict(sorted(siniflar.items(), key=lambda kv: -kv[1]["kosuSayisi"])),
           "sinifSayisi": len(siniflar),
           "kuralAciklamalari": SINIF_ACIKLAMALARI}
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
                   help="cikti/fark-*.json'daki farkları kök sınıf kurallarıyla yeniden sınıfla (koşmadan)")
    ap.add_argument("--islem", type=int, default=500)
    ap.add_argument("--kontrol", type=int, default=25)
    ap.add_argument("--onek", type=int)
    ap.add_argument("--notr", default="", help="uretici nötrleştirme (virgülle): iskonto_dahil,kasa_acilis,kart,fatura_yineleme")
    ap.add_argument("--kucult")
    a = ap.parse_args(argv[1:])
    if a.ozet:
        o = ozet_yaz()
        sys.stdout.write("fark-ozet.json: %d koşu, %d kök sınıf, %d açıklanmamış yaprak\n" % (
            len(o["kosular"]), o["kokSinifSayisi"], o["aciklanmamisSayisi"]))
        return 0
    if a.yeniden_sinifla:
        return yeniden_sinifla()
    if a.tohum is not None:
        u = uretici_yukle()
        notr = [x for x in a.notr.split(",") if x]
        sen = u.uret(a.tohum, a.islem, a.kontrol, notr=notr)
        yol = os.path.join(CIKTI, "senaryolar", sen["ad"] + ".json")
        yaz_json(yol, sen)
        cikti_adi = "fark-%d%s.json" % (a.tohum, "-notr" if notr else "")
        onek_adi = str(a.tohum) + ("-notr" if notr else "")
    else:
        yol = os.path.abspath(a.senaryo)
        with open(yol, encoding="utf-8") as fh:
            ad = json.load(fh)["ad"]
        cikti_adi = ("mini/" if os.path.dirname(yol) == os.path.join(CIKTI, "mini") else "") + "fark-%s.json" % ad
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
    """Koşmadan: mevcut fark dosyalarındaki farklara güncel kök sınıf kurallarını uygula, sınıf özetini yeniden yaz."""
    for d in sorted(glob.glob(os.path.join(CIKTI, "fark-*.json"))):
        if d.endswith("fark-ozet.json"):
            continue
        with open(d, encoding="utf-8") as fh:
            r = json.load(fh)
        if r.get("durum") != "TAMAM":
            continue
        with open(os.path.join(KOK, r["senaryoDosyasi"]), encoding="utf-8") as fh:
            sen = json.load(fh)
        sira = adim_haritasi(sen)
        ham = os.path.join(CIKTI, "ham")
        def oku(e):
            with open(os.path.join(ham, "%s.%s.json" % (sen["ad"], e)), encoding="utf-8") as fh:
                return json.load(fh)
        pv = oku("program")
        av, _ = alternatif_sec(oku("a"), pv)
        bv, _ = alternatif_sec(oku("b"), pv)
        bag = baglam(sen, av, bv, pv)
        adim_siniflari([f for f in r["farklar"] if f["desen"] not in ("PROGRAM-ICI", "KOSUCU")], bag)
        siniflar = {}
        for f in r["farklar"]:
            if f["desen"] not in ("PROGRAM-ICI",):
                f.pop("olaylar", None)
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
