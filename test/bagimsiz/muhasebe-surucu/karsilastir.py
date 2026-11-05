#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""2.5.0 MUHASEBE SÜRÜCÜSÜ — karşılaştırıcı (tek senaryo, tek koşu).

Programın okunan çıktısını (program.mjs → program.json) kodu görmeyen kâhinin modeliyle (test/bagimsiz/muhasebe/model.py) karşılaştırır.
Kâhinin klasörüne YAZMAZ, modeli DEĞİŞTİRMEZ (ders 5, 40): model yalnız içe aktarılır (bayt kodu yazılmaz) ve senaryonun "devirsiz eşdeğeri"
ile koşulur (kâhin README: "devir şirketin durumunu değiştirmez"; program 2.5.0'ın devrini henüz bilmez — D2–D4).

İki görünüm:
  KÂHİN   — kâhinin seçilen dalı (varsayılan "KG3=SORU": ürün sahibinin KG-3 kararı, ana oturum 05.11 iletisi; öbür maddeler A).
  BUGÜN   — aynı model, 2.5.0'da DEĞİŞECEĞİ BELGELİ kuralların bugünkü (2.4.9) karşılığıyla: KG-6=B ve KG-7=B dalları (kitap §9: bugünkü
            davranış B'dir) + aşağıdaki DEGISIM tablosundaki hesap değişimleri; her değişimin dayanağı plan / kitap / iş listesi metnidir.
            BUGÜN görünümü programdan TÜRETİLMEZ; programla tutmazsa fark programın ya da kâhinin ya da kuralın sorunudur (ders 6).
Sınıf: AYNI (program = kâhin) · U (program ≠ kâhin, program = BUGÜN: 2.5.0'da yazılacak işe bağlı fark, etiketiyle) · FARK (program ≠ BUGÜN:
siniflama.json'daki elle yazılmış sınıfı (P / K / R) ya da SINIFLANMADI).

Kullanım: python3 -I karsilastir.py --kok <depo> --senaryo <s.json> --program <program.json> --beklenen <beklenen.json> --cikti <fark.json>
          [--dal KG3=SORU] [--siniflama <siniflama.json>]
"""
import argparse
import json
import os
import sys
from collections import defaultdict

sys.dont_write_bytecode = True  # kâhinin klasörüne __pycache__ yazılmaz

ap = argparse.ArgumentParser()
ap.add_argument("--kok", required=True)
ap.add_argument("--senaryo", required=True)
ap.add_argument("--program", required=True)
ap.add_argument("--beklenen", required=True)
ap.add_argument("--cikti", required=True)
ap.add_argument("--dal", default="KG3=SORU")
ap.add_argument("--siniflama", default="")
A = ap.parse_args()
sys.path.insert(0, os.path.join(A.kok, "test", "bagimsiz", "muhasebe"))
import model as M  # noqa: E402

S = json.load(open(A.senaryo, encoding="utf-8"))
if A.program.endswith(".gz"):
    import gzip
    P = json.load(gzip.open(A.program, "rt", encoding="utf-8"))
else:
    P = json.load(open(A.program, encoding="utf-8"))
B = json.load(open(A.beklenen, encoding="utf-8"))
SIN = json.load(open(A.siniflama, encoding="utf-8")) if A.siniflama and os.path.exists(A.siniflama) else {"kurallar": []}

ALT_ANALAR = {"101", "102", "108", "121", "300", "309"}       # programın alt hesap mizanında olan ana hesaplar
CARI_HESAP = {"120", "320", "336", "128"}                     # cari kartı = CH + 128 (kâhin modul_defter, program Cari Mizanı)
ACILIS = {"kasa_acilis", "banka_acilis", "kart_acilis", "kredi_acilis", "stok_acilis", "cari_acilis"}

# ------------------------------------------------------------------------------------------------ 0. öz denetim: model = beklenen dosya
def oz_denetim():
    m = M.Model(S, M.Kurallar())
    r = m.kos()
    bek = B["dallar"]["A"]
    esit = json.loads(json.dumps(r["raporlar"], sort_keys=True)) == json.loads(json.dumps(bek["raporlar"], sort_keys=True))
    return {"raporlar_ayni": esit, "redler_ayni": r["redler"] == bek["redler"], "kahin_redler": r["redler"]}

OZ = oz_denetim()

# ------------------------------------------------------------------------------------------------ 1. bugünkü kural değişimleri (DEĞİŞİM tablosu)
# Her satır: etiket → (dayanak metni, iş). Dayanaklar AYNEN plan / kitap / iş listesinden; program kodundan değil.
ETIKET = {
    "C5-ACILIS-519": ("çekirdek planı §6 Ç5: 'Bütün modül açılışlarının karşı hesabı 500 yerine GEÇİCİ AÇILIŞ HESABI'; §1 bugün 500", "Ç5"),
    "C5-EVRAK-ACILIS": ("çekirdek planı §1: 'Cariye işlenmemiş evrak (Excel \"Açılış portföyü\") 602 / 770'e (gelir / gider) gider'; §6 'geçici hesaba'", "Ç5"),
    "C1-ALT-90": ("çekirdek planı §13 / kitap §2: '.90' alt hesapları (600.90, 610.90, 602.90, 770.90, 649.90) bugün yok; §1 'Alt hesap: banka 102.NN …'", "Ç1"),
    "KG2-H03": ("kitap H-03 / KG-2 A (ürün sahibi 05.11 'hepsi A'): taksit Yeni Borç 600.90; bugün CHART 602 'Taksitli Satış'", "KG-2 (D bölümü (2); iş kodu atanmamış)"),
    "KG3-KAYIT": ("iş listesi D (3): 'KG-3 kayıt (dosya) tahsilatı gelir değil → Sınıflandırılmamış Tahsilatlar'; bugün CHART 602 'Kayıt Tahsilatları'", "KG-3 (iş kodu atanmamış)"),
    "KG5-EXCEL": ("iş listesi D (4): 'KG-5 Excel'den yüklenen taksit kartı açılış alacağı (519 karşılıklı), gelir değil'; bugün kart toplamı 602, Ödenen 500 (çekirdek §1 'taksit … açılış 500')", "KG-5 / Ç5"),
    "KG6-POS-TARIH": ("iş listesi D (5): 'KG-6 POS komisyonu satış günü'; kitap KG-6 B = valör günü (D-01, bugünkü)", "KG-6 (iş kodu atanmamış; D 'ETKİ: banka modülü')"),
    "KG7-INDIRIM": ("iş listesi D (6): 'KG-7 alış faturasında KDV İndirim Dönemi'; kitap KG-7 B = hep belge ayı (bugünkü)", "KG-7 (iş kodu atanmamış; kesme çizgisinde 2.5.1'e kayabilir)"),
    "KG8-IADE-KDV": ("kitap KG-8 (K değil; 'baş mimar + mali müşavir A'): satıştan iade KDV'si B 191; B seçeneği 391", "KG-8 (iş kodu atanmamış)"),
    "KG16-ACIKLAMA": ("çekirdek planı §1: \"'Açılış bakiyesi' açıklamalı elle borç defterde hâlâ 500'e gider\"; KG-16 A 'Açılış Olabilir' listesi", "KG-16 / Ç5"),
    "KG24-IHRACAT": ("kitap KG-24 A (K değil): ihracat 601; B 600 (bugün CHART'ta 601 yok — çekirdek §1)", "Ç1 + türetme (iş kodu atanmamış)"),
    "F06-GIDER-TURU": ("kitap F-06: 'Gider türü → hesap eşlemesi Ç1'de yazılır (DOĞRULANMADI)' — finansman 780", "Ç1"),
    "KG19-YOLDAKI": ("kitap KG-19 A (K değil): valörlü transferde 108.90 Yoldaki Transferler; B 'çıkış günü doğrudan alıcı hesaba'", "KG-19 (iş kodu atanmamış)"),
    "KG15-DUZELTME": ("kitap KG-15 A / iş listesi D (10): Kural Farkı Düzeltme Fişi", "Ç3 / KG-15"),
    "C5-EVRAK-KARSILIKSIZ": ("çekirdek planı §1 'Cariye işlenmemiş evrak (Excel \"Açılış portföyü\") 602 / 770'e (gelir / gider) gider' + 30.10 (1) 'açılış çekleri gelir / gidere yazılmaz' (Ç5); kitap Ç-07 'Müşteri yeniden borçlanır' — bugün karşılıksız açılış çeki 770'e (cariye borç yazılmaz)", "Ç5 (planda karşılıksız tarafı AÇIK YAZMIYOR — Ç5 ajanına not)"),
    "C5-CARI-ACIKLAMA": ("çekirdek planı §1: 'CARİ AÇILIŞI ise AÇIKLAMADAN (/^açılış/i …)' — açılış işareti yalnız cari açılırken; önceden açık caride açılış Borç / Alacak Yaz satırıdır (açıklaması 'Açılış' değilse 602 / 770)", "Ç5"),
    "K14-HESAPSIZ": ("kitap K-14 / K-15: 'Hesapsız (Açılıştan Önce)' ve açılıştan önceki Kart Borcuna Aktar'da banka / kart tarafı yerine G; bugün BANKA-MODULU-PLAN K11 / §10: '102.00 ve 108.00 Hesabı Atanmamış Eski Hareketler'", "Ç5 kapsamına yakın (iş kodu atanmamış)"),
}


def degistir(m, k, d):
    """Kâhin maddesi → bugünkü (2.4.9) hesaplar. Dönüş: (satırlar, etiketler)."""
    tur = k.tur if k is not None else (m.tur or "")
    v = k.v if k is not None else {}
    et = set()
    out = []
    for s in m.satirlar:
        h = s["h"]
        n = h
        if tur == "evrak_karsiliksiz" and v.get("evrak") in EVRAK_ACILIS and s["c"] and M.ana(h) in ("120", "320", "336"):
            n = "770"
            et.add("C5-EVRAK-KARSILIKSIZ")
        elif h == M.G and tur == "cari_acilis" and k is not None and ACIKLAMA_YOLU.get(KAYNAK_NO.get(id(k))) and not M.acilis_aciklamasi(v.get("aciklama", "")):
            n = "770" if v.get("yon") == "alacak" else "602"
            et.add("C5-CARI-ACIKLAMA")
        elif h == M.G and tur == "hesapsiz_hareket":
            n = "102.00"
            et.add("K14-HESAPSIZ")
        elif h == M.G and tur == "kart_borcuna_aktar":
            n = "108.00"
            et.add("K14-HESAPSIZ")
        elif h == M.YOLDAKI and tur == "banka_transfer":
            n = "102." + v["alici"]
            et.add("KG19-YOLDAKI")
        elif h == M.G and (m.tur in ACILIS or tur in ACILIS or m.tur == "cari_acilis"):
            n, _ = "500", et.add("C5-ACILIS-519")
        elif h == M.G and tur == "evrak_acilis":
            n = "602" if v.get("yon") == "alinan" else "770"
            et.add("C5-EVRAK-ACILIS")
        elif tur == "taksit_karti" and h == M.BELGESIZ_GELIR:
            n = "602"
            et.add("KG2-H03")
        elif tur == "kayit_tahsilati" and h in (M.CARISIZ_PASIF, M.CARISIZ_GELIR):
            n = "602"
            et.add("KG3-KAYIT")
        elif tur in ("borc_yaz", "alacak_yaz") and h in (M.BORC_YAZ, M.ALACAK_YAZ, M.G) and M.acilis_aciklamasi(v.get("aciklama", "")):
            n = "500"
            et.add("KG16-ACIKLAMA")
        elif tur == "satis_iade_faturasi" and h == "191":
            n = "391"
            et.add("KG8-IADE-KDV")
        elif h == M.IHRACAT_GELIR:
            n = "600"
            et.add("KG24-IHRACAT")
        elif h == "780" and tur in ("alis_faturasi", "alis_iade_faturasi") and v.get("gider_turu") == "finansman":
            n = "770"
            et.add("F06-GIDER-TURU")
        elif h.endswith(".90") and h != M.YOLDAKI:
            n = M.ana(h)
            et.add("C1-ALT-90")
        out.append(dict(s, h=n))
    return out, et


def kg5_excel(m, k):
    """KG-5: bugün Excel kartı = B CH T / A 602 T (kart toplamı) + B 500 P / A CH P (Ödenen, 'Taksit açılışı (devir)')."""
    v = k.v
    c, T, Pd = v["cari"], v["toplam"], v.get("odenen", 0)
    ch = M.CH_HESAP[S["cariler"][c]["tur"]]
    return [M.L(ch, T, c), M.L("602", -T), M.L("500", Pd), M.L(ch, -Pd, c)]

# ------------------------------------------------------------------------------------------------ 2. izli model (olay → kaynak / fiş)
KAYNAK_NO = {}      # kâhin kaynak kimliği → senaryo olay no
EVRAK_ACILIS = {o["evrak"] for o in S["olaylar"] if o["tur"] == "evrak_acilis" and o.get("yon") == "alinan"}
ACIKLAMA_YOLU = {}  # olay no → program bu cari açılışını açıklamalı Borç / Alacak Yaz ile girdi (program.mjs aciklama_ile)


class Izli(M.Model):
    """Kâhin modeli; olayları DIŞARIDAN tek tek uygular (programın uyguladığı olaylarla aynı sıra). Devir olayları devirsiz eşdeğerle."""

    def kaynak(self, o, d):
        k = M.Model.kaynak(self, o, d)
        if k is not None:
            KAYNAK_NO[id(k)] = self.no
        return k

    def adim(self, o, no):
        if o["tur"] in ("devir", "devri_geri_al", "rapor"):
            return None
        self.no = no
        try:
            if o["tur"] == "devri_yenile":
                for x in o.get("duzeltmeler", []):
                    self.uygula(x, self.canli)
                return None
            self.uygula(o, self.canli)
        except M.Red as r:
            return {"kod": r.kod, "neden": r.neden}
        return None

    def kopya_bakiye(self):
        """Rapor anı: madde listesi + kaynaklar (sonraki olaylar değiştirmesin diye o andaki hâl)."""
        d = self.canli
        return Anlik(list(d.maddeler()), dict(d.kaynaklar))

    def bakiye(self, ufuk=None, bas=None, ceviri=False):
        return bakiye_hesapla(self.canli.maddeler(), self.canli.kaynaklar, ufuk, bas, ceviri)


class Anlik:
    def __init__(self, maddeler, kaynaklar):
        self.maddeler, self.kaynaklar = maddeler, kaynaklar

    def bakiye(self, ufuk=None, bas=None, ceviri=False):
        return bakiye_hesapla(self.maddeler, self.kaynaklar, ufuk, bas, ceviri)


def bakiye_hesapla(maddeler, kaynaklar, ufuk=None, bas=None, ceviri=False):
        """(hesap, cari) → [devir, borç, alacak] (kuruş); ufuk ≤, bas'tan önce devir. ceviri: bugünkü kural."""
        out = defaultdict(lambda: [0, 0, 0])
        etiketler = defaultdict(set)
        for m in maddeler:
            if ufuk is not None and m.tarih > ufuk:
                continue
            k = kaynaklar.get(m.kaynak)
            tarih = m.tarih
            if ceviri:
                if m.tur == "transfer_valor":   # KG-19 B (bugün): valörde ayrı madde yok, alıcı hesap işlem günü
                    for s in m.satirlar:
                        etiketler[M.ana(s["h"])].add("KG19-YOLDAKI")
                        etiketler[s["h"]].add("KG19-YOLDAKI")
                    continue
                if k is not None and k.tur == "taksit_excel" and m.tur == "taksit_excel":
                    satirlar, et = kg5_excel(m, k), {"KG5-EXCEL"}
                else:
                    satirlar, et = degistir(m, k, None)
            else:
                satirlar, et = m.satirlar, set()
            for s in satirlar:
                key = (s["h"], s["c"])
                if bas is not None and tarih < bas:
                    out[key][0] += s["b"] - s["a"]
                else:
                    out[key][1] += s["b"]
                    out[key][2] += s["a"]
                for e in et:
                    etiketler[M.ana(s["h"])].add(e)
                    if s["c"]:
                        etiketler["cari:" + s["c"]].add(e)
            if et:  # değişen maddenin ÖZGÜN hesapları da etiketlenir (ör. 519 → 500: iki anahtar)
                for s in m.satirlar:
                    for e in et:
                        etiketler[M.ana(s["h"])].add(e)
                        if s["h"] != M.ana(s["h"]):
                            etiketler[s["h"]].add(e)
        return out, etiketler


def gorunumler(bak):
    """(hesap, cari) bakiyeleri → {ana:{}, alt:{}, cari:{}} (bakiye = devir + borç − alacak)."""
    ana, alt, cari = defaultdict(int), defaultdict(int), defaultdict(int)
    for (h, c), (dv, b, a) in bak.items():
        x = dv + b - a
        ana[M.ana(h)] += x
        if "." in h and M.ana(h) in ALT_ANALAR:
            alt[h] += x
        if c and M.ana(h) in CARI_HESAP:
            cari[c] += x
    return {"ana": {k: v for k, v in ana.items() if v}, "alt": {k: v for k, v in alt.items() if v}, "cari": {k: v for k, v in cari.items() if v}}


def donem(bak):
    """6 / 7 sınıfı dönem hareketi (borç − alacak, devir hariç)."""
    out = defaultdict(int)
    for (h, c), (dv, b, a) in bak.items():
        if h[0] in "67":
            out[M.ana(h)] += b - a
    return {k: v for k, v in out.items() if v}


ALTMAP = P.get("alt_hesap", {})


def prog_gorunum(d):
    if not d:
        return None
    alt = {}
    for k, v in (d.get("alt") or {}).items():
        alt[ALTMAP.get(k, k)] = alt.get(ALTMAP.get(k, k), 0) + v
    return {"ana": dict(d.get("ana") or {}), "alt": alt, "cari": dict(d.get("cari") or {})}


def topla(a, b, isaret=1):
    out = {}
    for alan in ("ana", "alt", "cari"):
        x = dict(a.get(alan, {}))
        for k, v in (b or {}).get(alan, {}).items():
            x[k] = x.get(k, 0) + isaret * v
        out[alan] = {k: v for k, v in x.items() if v}
    return out


def fark(a, b):
    out = {}
    for alan in ("ana", "alt", "cari"):
        x = {}
        for k in set(a.get(alan, {})) | set(b.get(alan, {})):
            dd = a.get(alan, {}).get(k, 0) - b.get(alan, {}).get(k, 0)
            if dd:
                x[k] = dd
        if x:
            out[alan] = x
    return out

def bek_gorunum(model, ufuk, ceviri):
    b, et = model.bakiye(ufuk=ufuk, ceviri=ceviri)
    return gorunumler(b), et


# ------------------------------------------------------------------------------------------------ 3. adım adım koşu
DAL = M.Kurallar.etiketten(A.dal)
bugun_dal = dict(p.split("=") for p in A.dal.split(",") if "=" in p)
bugun_dal.update({"KG6": "B", "KG7": "B", "KG15": "B"})
BUGUN = M.Kurallar(**bugun_dal)
mk = Izli(S, DAL)        # KÂHİN
mb = Izli(S, BUGUN)      # BUGÜN
olaylar = S["olaylar"]
padim = {str(x["no"]): x for x in P["olaylar"]}
for x in P["olaylar"]:
    if x.get("aciklama_ile"):
        ACIKLAMA_YOLU[int(x["no"])] = True

# Programın faturanın formuna aldığı peşin ödemeler ("faturada"): kâhinde de fatura adımında uygulanır.
faturada = {}
for x in P["olaylar"]:
    if x.get("durum") == "faturada":
        o = olaylar[int(x["no"]) - 1]
        faturada.setdefault(o.get("fatura"), []).append(int(x["no"]))

adim_farklari = []
onceki_fark = {}
aciklanan = []   # (tarih, {alan: {anahtar: delta}}, sinif, kod) — sınıflanmış adım farkları


def adim_sinifi(adim):
    """Adım farkının kök neden sınıfı: siniflama.json "adim" kuralları farkın BÜTÜN anahtarlarını kapsamalı (yoksa None)."""
    import fnmatch
    adaylar = []
    for k in SIN.get("kurallar", []):
        if k.get("kapsam") != "adim":
            continue
        if k.get("senaryo") and k["senaryo"] != S["ad"]:
            continue
        if k.get("senaryo_onek") and not S["ad"].startswith(k["senaryo_onek"]):
            continue
        turler = k.get("olay_turu") or ["*"]
        if not any(fnmatch.fnmatch(adim["olay_turu"], t) for t in turler):
            continue
        if k.get("idler") and adim.get("id") not in k["idler"] and str(adim["no"]) not in k["idler"]:
            continue
        adaylar.append(k)
    kalan = {f"{alan}:{a}" for alan, x in adim["degisim"].items() for a in x}
    kullanilan = []
    for k in adaylar:
        uyan = {x for x in kalan if any(fnmatch.fnmatch(x, d) for d in k.get("anahtarlar", ["*"]))}
        if uyan:
            kullanilan.append(k)
            kalan -= uyan
    if kalan or not kullanilan:
        return None
    return kullanilan

prog_kum = prog_gorunum(P.get("baslangic")) or {"ana": {}, "alt": {}, "cari": {}}
raporlar = {}
rapor_sirasi = []


def uygula_ikisi(x, o, i):
    """Programın uyguladığı olayı iki modele de uygula (devri_yenile: yalnız programın yaptığı düzeltmeler; fatura: formdaki peşinler)."""
    if o["tur"] == "devri_yenile":
        alt = x.get("alt") or []
        for j, d in enumerate(o.get("duzeltmeler", [])):
            if j < len(alt) and alt[j].get("durum") == "yapildi":
                mk.adim(d, i)
                mb.adim(d, i)
        return
    mk.adim(o, i)
    mb.adim(o, i)
    for j in faturada.get(o.get("id"), []):
        mk.adim(olaylar[j - 1], j)
        mb.adim(olaylar[j - 1], j)


ufuk = P.get("ilk_tarih")
for x in P["olaylar"]:
    no = x["no"]
    if x["tur"] == "gun":
        ufuk = x["tarih"]
        prog_kum = topla(prog_kum, prog_gorunum(x.get("delta")) or {})
    elif x.get("durum") == "rapor":
        rapor_sirasi.append((x, mk.kopya_bakiye(), mb.kopya_bakiye(), list(aciklanan)))
        continue
    else:
        i = int(no)
        o = olaylar[i - 1]
        ufuk = x.get("saat") or ufuk
        if x.get("durum") == "yapildi" or (o["tur"] == "devri_yenile" and x.get("alt")):
            uygula_ikisi(x, o, i)
        if x.get("delta"):
            prog_kum = topla(prog_kum, prog_gorunum(x.get("delta")) or {})
    if not x.get("delta"):
        continue
    bb, _ = bek_gorunum(mb, ufuk, True)
    f_b = fark(prog_kum, bb)
    if f_b != onceki_fark:
        degisim = fark(topla(f_b, {}), onceki_fark)
        kok = olaylar[int(str(no).rstrip("g")) - 1]
        adim_tarihi = x.get("tarih") if x["tur"] == "gun" else (M.ay_sonu(kok["ay"]) if kok["tur"] in ("kdv_mahsup",) else kok.get("tarih") or ufuk)
        kayit = {"no": no, "tur": x["tur"], "olay_turu": ("gun→" + kok["tur"]) if x["tur"] == "gun" else x["tur"], "id": x.get("id", ""), "tarih": adim_tarihi, "degisim": degisim, "durum": x.get("durum")}
        kul = adim_sinifi(kayit)
        if kul:
            kayit["sinif"] = "/".join(sorted({k["sinif"] for k in kul}))
            kayit["kod"] = ",".join(k["kod"] for k in kul)
            aciklanan.append((kayit["tarih"], degisim, kayit["sinif"], kayit["kod"]))
        else:
            kayit["sinif"] = "SINIFLANMADI"
        adim_farklari.append(kayit)
        onceki_fark = f_b

# ------------------------------------------------------------------------------------------------ 4. kâhinin red kararları (tam, devirsiz)
tam = Izli(S, DAL)
tamb = Izli(S, BUGUN)
kred, bred = {}, {}
for i, o in enumerate(olaylar, start=1):
    r = tam.adim(o, i)
    if r:
        kred[i] = r
    r = tamb.adim(o, i)
    if r:
        bred[i] = r
redler = []
for i, o in enumerate(olaylar, start=1):
    x = padim.get(str(i), {})
    pr = x.get("durum") == "red"
    kr = i in kred
    if x.get("durum") in ("uygulanmadi", "api_yok"):
        continue
    if pr or kr:
        redler.append({"no": i, "tur": o["tur"], "id": o.get("id", ""), "kahin": kred.get(i), "program": {"status": x.get("status"), "kod": x.get("kod"), "ileti": (x.get("ileti") or "")[:240]} if pr else None,
                       "sonuc": "AYNI" if pr and kr else ("PROGRAM_REDDETTI" if pr else "KAHIN_REDDETTI"),
                       **({"sinif": "U", "aciklama": f"BUGÜN dalında ({BUGUN.etiket()}) de {'red' if i in bred else 'kabul'}: programla aynı"} if pr != kr and pr == (i in bred) else {})})

# ------------------------------------------------------------------------------------------------ 5. raporlar (rapor anındaki kâhin durumu: anlık kopya)
def prog_rapor_gorunum(r, donemsel=False):
    """Program raporu → {ana, alt, cari} bakiye (ya da 6/7 dönem hareketi)."""
    if donemsel:
        return {"ana": {x["hesap"]: x["borc"] - x["alacak"] for x in r.get("mizan", []) if x["hesap"][0] in "67" and (x["borc"] - x["alacak"])}}
    ana = {x["hesap"]: x["bakiye"] for x in r.get("mizan", []) if x["bakiye"]}
    alt = {}
    for x in r.get("alt", []):
        k = ALTMAP.get(x["alt"], x["alt"])
        if x["bakiye"]:
            alt[k] = alt.get(k, 0) + x["bakiye"]
    cari = {}
    cm = r.get("cari_mizani") or {}
    h = cm.get("headers") or []
    for row in cm.get("rows") or []:
        c = P.get("cari_no", {}).get(str(row[h.index("Cari No")])) if "Cari No" in h else None
        if c:
            v = para(row[h.index("Bakiye")])
            if v and "Durum" in h and "alacakl" in str(row[h.index("Durum")]).lower():
                v = -abs(v)
            if v:
                cari[c] = v
    return {"ana": ana, "alt": alt, "cari": cari}


def para(m):
    t = str(m or "").replace("₺", "").replace("TL", "").replace(" ", "").replace("−", "-")
    try:
        return round(float(t.replace(".", "").replace(",", ".")) * 100)
    except ValueError:
        return None


def sinifla(senaryo, rapor, alan, anahtar):
    """Elle sınıf (siniflama.json): kapsam 'red' / 'olay' kendi adıyla; rapor anahtarları kapsam 'rapor' kurallarıyla (adım kuralları burada kullanılmaz)."""
    kapsam = rapor if rapor in ("red", "olay") else "rapor"
    for k in SIN.get("kurallar", []):
        if k.get("kapsam") != kapsam:
            continue
        if k.get("senaryo") not in (None, "*", senaryo):
            continue
        if k.get("senaryo_onek") and not senaryo.startswith(k["senaryo_onek"]):
            continue
        if kapsam == "rapor" and k.get("rapor") not in (None, "*", rapor):
            continue
        if k.get("alan") not in (None, "*", alan):
            continue
        if k.get("anahtar") not in (None, "*", anahtar):
            continue
        return k
    return None


def olay_sinifi(x):
    """Uygulanamayan olayın sınıfı: 'uygulanmadi' (2.5.0'da yazılacak) U; api_yok siniflama.json'dan (yoksa SINIFLANMADI)."""
    if x.get("durum") == "uygulanmadi":
        return {"sinif": "U"}
    k = sinifla(S["ad"], "olay", x["tur"], str(x["no"]))
    return {"sinif": k["sinif"], "aciklama": k.get("aciklama", "")} if k else {"sinif": "SINIFLANMADI"}


def aciklanan_toplam(liste, son=None, bas=None, donemsel=False):
    """Sınıflanmış adım farklarının birikimi (son ≥ tarih; dönemselde bas ≤ tarih ≤ son ve yalnız 6/7) → (görünüm, sınıf→kodlar)."""
    out = {"ana": {}, "alt": {}, "cari": {}}
    siniflar = defaultdict(set)
    for tarih, d, sinif, kod in liste:
        if son and tarih > son:
            continue
        if donemsel and bas and tarih < bas:
            continue
        for alan, x in d.items():
            for k, v in x.items():
                if donemsel and (alan != "ana" or k[0] not in "67"):
                    continue
                out[alan][k] = out[alan].get(k, 0) + v
                siniflar[(alan, k)].add((sinif, kod))
    return out, siniflar


# BUGÜN dalı (KG-6 = B, KG-7 = B) kaynaklı U satırlarının etiketi: senaryoda POS komisyonu / KDV indirim dönemi var mı.
DAL_ETIKETI = sorted(({"KG6-POS-TARIH"} if any(o["tur"] == "tahsilat" and o.get("yol") == "pos" and o.get("komisyon") for o in S["olaylar"]) else set())
                     | ({"KG7-INDIRIM"} if any(o.get("indirim_ayi") for o in S["olaylar"]) or any(d.get("indirim_ayi") for o in S["olaylar"] for d in o.get("duzeltmeler", [])) else set())) or ["BUGUN-DALI"]


def karsilastir_gorunum(prg, kah, bug, et, rapor_adi, sadece=None, acik_toplam=None):
    satirlar = []
    acik = {}
    ekg, eks = acik_toplam if acik_toplam else ({"ana": {}, "alt": {}, "cari": {}}, {})
    for alan in ("ana", "alt", "cari"):
        anahtarlar = set(prg.get(alan, {})) | set(kah.get(alan, {})) | set(bug.get(alan, {}))
        for k in sorted(anahtarlar):
            if sadece and not sadece(alan, k):
                continue
            p, kk, bb = prg.get(alan, {}).get(k, 0), kah.get(alan, {}).get(k, 0), bug.get(alan, {}).get(k, 0)
            if alan == "alt" and k.endswith(".00") and p == 0 and kk == 0:
                continue
            if p == kk:
                sinif = "AYNI"
            elif p == bb:
                sinif = "U"
            elif ekg.get(alan, {}).get(k) and p == bb + ekg[alan][k]:
                sn = sorted(eks.get((alan, k), set()))
                sinif = "/".join(sorted({x[0] for x in sn}))
                acik[(alan, k)] = "kök neden (adım): " + ", ".join(sorted({x[1] for x in sn}))
            else:
                s = sinifla(S["ad"], rapor_adi, alan, k)
                sinif = s["sinif"] if s else "SINIFLANMADI"
                if s:
                    acik[(alan, k)] = s.get("aciklama", "")
            etk = sorted(et.get(k if alan != "cari" else "cari:" + k, set()) | (et.get(k.split(".")[0], set()) if alan == "alt" else set()))
            if sinif == "U" and not etk:
                etk = DAL_ETIKETI  # hesap değişimi yok: fark BUGÜN dalından (KG-6 / KG-7 B)
            if sinif != "AYNI" or kk != bb:
                satirlar.append({"alan": alan, "anahtar": k, "program": p, "kahin": kk, "bugun": bb, "sinif": sinif, **({"etiket": etk} if etk else {}), **({"aciklama": acik[(alan, k)]} if (alan, k) in acik else {})})
            else:
                satirlar.append({"alan": alan, "anahtar": k, "sinif": "AYNI"})
    return satirlar


UYGULANMADI_RAPOR = {
    "gelir_tablosu": "Gelir Tablosu (Ç6): kalemler, tahmini SMM, Kesin Değil yok — yalnız 6/7 hesap hareketleri karşılaştırıldı",
    "bilanco": "Bilanço (Ç6): kalemler, hesaplanmış Dönem Net Kârı, ters bakiye, Kesin Değil yok — yalnız 1–5 sınıfı hesap bakiyeleri karşılaştırıldı",
    "buyuk_defter": "Büyük Defter (Ç6) yok",
    "yevmiye": "Yevmiye karşılaştırması bu sürücüde yalnız bakiye düzeyinde (madde düzeyi Ç2/Ç6 sonrası)",
    "kural_farki": "Kural Farkı (Ç3/KG-15) yok",
    "degerleme": "Dönem sonu değerleme (§5) yok — yalnız stok MİKTARLARI karşılaştırıldı",
}
for x_r, a, b, acik_r in rapor_sirasi:
    rno = int(x_r["no"])
    o = olaylar[rno - 1]
    ad = o["ad"]
    r = P.get("raporlar", {}).get(ad)
    if r is None:
        continue
    out = {"tur": o["rapor"], "dosya": o.get("dosya", "canli"), "satirlar": []}
    if o["rapor"] in UYGULANMADI_RAPOR:
        out["uygulanmadi"] = UYGULANMADI_RAPOR[o["rapor"]]
    if o["rapor"] == "mizan":
        kb, _ = a.bakiye(ufuk=o["son"], bas=o["bas"])
        bb, et = b.bakiye(ufuk=o["son"], bas=o["bas"], ceviri=True)
        out["satirlar"] = karsilastir_gorunum(prog_rapor_gorunum(r), gorunumler(kb), gorunumler(bb), et, ad, acik_toplam=aciklanan_toplam(acik_r, son=o["son"]))
        # öz denetim: kâhinin KENDİ mizanı (beklenen dosya, dal A) — yalnız dal A ve devirsiz senaryoda birebir beklenir
        out["brut"] = {"program": r.get("mizan_toplam"), "kahin": {"borc": sum(x[1] for x in kb.values()), "alacak": sum(x[2] for x in kb.values())}}
        out["program_dengeli"] = r.get("dengeli")
        out["program_mutabakat"] = (r.get("mutabakat") or {}).get("ok")
    elif o["rapor"] in ("bilanco", "degerleme"):
        t = o["tarih"]
        kb, _ = a.bakiye(ufuk=t)
        bb, et = b.bakiye(ufuk=t, ceviri=True)
        out["satirlar"] = karsilastir_gorunum(prog_rapor_gorunum(r), gorunumler(kb), gorunumler(bb), et, ad, sadece=lambda alan, k: alan != "ana" or k[0] in "12345", acik_toplam=aciklanan_toplam(acik_r, son=t))
        out["program_dengeli"] = r.get("dengeli")
        if o["rapor"] == "degerleme":
            st = r.get("stok") or {}
            h = st.get("headers") or []
            kahin_deg = (B["dallar"].get("A", {}).get("raporlar", {}) or {}).get(ad, {})
            out["stok_miktar"] = {"program_basliklar": h, "program_satirlar": (st.get("rows") or [])[:20], "kahin_urunler": kahin_deg.get("urunler")}
    elif o["rapor"] == "gelir_tablosu":
        kb, _ = a.bakiye(ufuk=o["son"], bas=o["bas"])
        bb, et = b.bakiye(ufuk=o["son"], bas=o["bas"], ceviri=True)
        out["satirlar"] = karsilastir_gorunum(prog_rapor_gorunum(r, True), {"ana": donem(kb)}, {"ana": donem(bb)}, et, ad, acik_toplam=aciklanan_toplam(acik_r, son=o["son"], bas=o["bas"], donemsel=True))
    elif o["rapor"] in ("gecikmis", "acik_faturalar"):
        kah = (B["dallar"].get("A", {}).get("raporlar", {}) or {}).get(ad)
        out["uygulanmadi"] = "B1 gecikmiş (Ç5) ve açık kalem: EK-1 M1 (S1–S3) ile değişecek — kâhin bakımı bekleniyor (R)"
        out["kahin"] = kah
        out["program"] = {"cari_kart": r.get("cari_kart_ham"), "acik_faturalar": {"basliklar": (r.get("acik_faturalar") or {}).get("headers"), "satirlar": [row for row in (r.get("acik_faturalar") or {}).get("rows") or [] if S["cariler"].get(o.get("cari"), {}).get("ad") in row]}}
        out["satirlar"] = []
    out["ozet"] = {s: sum(1 for x in out["satirlar"] if (x["sinif"] == s if s in ("AYNI", "U", "SINIFLANMADI") else s in x["sinif"].split("/"))) for s in ("AYNI", "U", "P", "K", "R", "SINIFLANMADI")}
    raporlar[ad] = out

for r in redler:
    if r["sonuc"] != "AYNI":
        k = sinifla(S["ad"], "red", r["tur"], str(r["no"]))
        if k:
            r["sinif"], r["aciklama"] = k["sinif"], k.get("aciklama", "")

# ------------------------------------------------------------------------------------------------ 6. son durum (bütün olaylar) ve değişmezler
son_ufuk = P.get("saat")
kb, _ = mk.bakiye(ufuk=son_ufuk)
bb, et = mb.bakiye(ufuk=son_ufuk, ceviri=True)
son = karsilastir_gorunum(prog_gorunum(P.get("son")) or {}, gorunumler(kb), gorunumler(bb), et, "son", acik_toplam=aciklanan_toplam(aciklanan))
degismez = {
    "program_her_adimda_dengeli": all(x.get("dengeli", True) for x in P["olaylar"] if "dengeli" in x),
    "program_her_adimda_mutabakat": all(x.get("mutabakat", True) for x in P["olaylar"] if "mutabakat" in x),
    "program_mutabakat_testi": P.get("mutabakat_testi"),
    "program_mizan_toplam_sifir": sum((P.get("son_tum") or {}).get("ana", {}).values()) == 0,
    "kahin_mizan_toplam_sifir": sum(gorunumler(kb)["ana"].values()) == 0,
}
durumlar = defaultdict(int)
for x in P["olaylar"]:
    durumlar[x.get("durum") or "?"] += 1
tum = [x for r in raporlar.values() for x in r["satirlar"]] + son
ozet = {s: sum(1 for x in tum if (x["sinif"] == s if s in ("AYNI", "U", "SINIFLANMADI") else s in x["sinif"].split("/"))) for s in ("AYNI", "U", "P", "K", "R", "SINIFLANMADI")}
ozet["adim_sinifsiz"] = sum(1 for a in adim_farklari if a.get("sinif") == "SINIFLANMADI")
sonuc = {
    "senaryo": S["ad"], "tz": P.get("tz"), "dal": A.dal, "bugun_dal": BUGUN.etiket(), "oz_denetim": {k: v for k, v in OZ.items() if k != "kahin_redler"},
    "olay_durumlari": dict(durumlar),
    "uygulanamayan": [dict({"no": x["no"], "tur": x["tur"], "id": x.get("id", ""), "durum": x["durum"], "neden": x.get("neden") or x.get("ileti"), "is": x.get("is")},
                           **olay_sinifi(x)) for x in P["olaylar"] if x.get("durum") in ("api_yok", "uygulanmadi", "surucu_hatasi")],
    "uyarilar": [{"no": x["no"], "tur": x["tur"], "uyari": x.get("uyari") or x.get("eksik")} for x in P["olaylar"] if x.get("uyari") or x.get("eksik")],
    "redler": redler, "adim_farklari": adim_farklari, "raporlar": raporlar, "son": son, "degismezler": degismez, "ozet": ozet,
    "etiketler": {k: {"dayanak": v[0], "is": v[1]} for k, v in ETIKET.items()},
}
os.makedirs(os.path.dirname(os.path.abspath(A.cikti)), exist_ok=True)
with open(A.cikti, "w", encoding="utf-8") as f:
    json.dump(sonuc, f, ensure_ascii=False, indent=1, sort_keys=True)
red_fark = sum(1 for r in redler if r["sonuc"] != "AYNI" and not r.get("sinif"))
print(f"{S['ad']} [{P.get('tz')}] öz denetim {'TAMAM' if OZ['raporlar_ayni'] else 'BOZUK'} · AYNI {ozet['AYNI']} · U {ozet['U']} · P {ozet['P']} · K {ozet['K']} · R {ozet['R']} · SINIFLANMADI {ozet['SINIFLANMADI']} · red farkı {red_fark} · adım farkı {len(adim_farklari)} (sınıfsız {ozet['adim_sinifsiz']})")
