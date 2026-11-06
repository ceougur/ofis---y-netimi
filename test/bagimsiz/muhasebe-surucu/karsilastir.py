#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""2.5.0 MUHASEBE SÜRÜCÜSÜ — karşılaştırıcı (tek senaryo, tek koşu).

Programın okunan çıktısını (program.mjs → program.json) kodu görmeyen kâhinin modeliyle (test/bagimsiz/muhasebe/model.py) karşılaştırır.
Kâhinin klasörüne YAZMAZ, modeli DEĞİŞTİRMEZ (ders 5, 40): model yalnız içe aktarılır (bayt kodu yazılmaz) ve senaryonun "devirsiz eşdeğeri"
ile koşulur (kâhin README: "devir şirketin durumunu değiştirmez"; program 2.5.0'ın devrini henüz bilmez — D2–D4).

İki görünüm:
  KÂHİN   — kâhinin seçilen dalı (varsayılan "A": kâhin bakımı 1 – 2 ile KG-3 onaylanan metin A dalı oldu, eski "SORU" etiketi kalktı; bütün maddeler A).
  BUGÜN   — aynı model, 2.5.0'da DEĞİŞECEĞİ BELGELİ kuralların bugünkü (2.4.9) karşılığıyla: KG-6=B ve KG-7=B dalları (kitap §9: bugünkü
            davranış B'dir) + aşağıdaki DEGISIM tablosundaki hesap değişimleri; her değişimin dayanağı plan / kitap / iş listesi metnidir.
            BUGÜN görünümü programdan TÜRETİLMEZ; programla tutmazsa fark programın ya da kâhinin ya da kuralın sorunudur (ders 6).
Sınıf: AYNI (program = kâhin) · U (program ≠ kâhin, program = BUGÜN: 2.5.0'da yazılacak işe bağlı fark, etiketiyle) · FARK (program ≠ BUGÜN:
siniflama.json'daki elle yazılmış sınıfı (P / K / R) ya da SINIFLANMADI).

Kullanım: python3 -I karsilastir.py --kok <depo> --senaryo <s.json> --program <program.json> --beklenen <beklenen.json> --cikti <fark.json>
          [--dal A] [--siniflama <siniflama.json>]
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
ap.add_argument("--dal", default="A")
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
    "K14-HESAPSIZ": ("kitap K-14 / K-15: 'Hesapsız (Açılıştan Önce)' ve açılıştan önceki Kart Borcuna Aktar'da banka / kart tarafı yerine G; bugün BANKA-MODULU-PLAN K11 / §10: '102.00 ve 108.00 Hesabı Atanmamış Eski Hareketler'", "Ç7a (iş listesi A Ç7a: K-14 / K-15)"),
    "C7b6-KAPAT": ("kullanıcı kararı 05.11 21:30 (6) 'Kartı Kapat yalnız ödeme planını bitirir; kalan carinin borcunda kalır … BUGÜNKÜ DAVRANIŞ DEĞİŞİR (kalan 689'la borçtan düşüyordu)'; kâhin README R6 `eski` = 2.4.9 davranışı B 689 / A CH", "Ç7b (iş listesi D İŞ ATAMASI (4)(6) → Ç7b)"),
}

# G5 (iş listesi D, 05.11 21:48): HENÜZ KODA GİRMEMİŞ kurallardan gelen her fark KURAL KİMLİĞİYLE durur. Etiket → kimlik (iş listesi A satırlarındaki
# atamadan; Ç5: açılış düzeni + B1, Ç7a: banka türetmesi, Ç7b: fatura / KDV / taksit / kayıt türetmesi, D4: devir). Kimliksiz etiket = ATANMAMIŞ (rapora).
KIMLIK = {
    "C5-ACILIS-519": "Ç5-ACILIS-519",
    "C5-EVRAK-ACILIS": "Ç5-ACILIS-519",
    "C5-CARI-ACIKLAMA": "Ç5-ACILIS-519",
    "C5-EVRAK-KARSILIKSIZ": "Ç5-KARSILIKSIZ-ACILIS-CEKI",
    "KG5-EXCEL": "Ç5-KG5",
    "KG16-ACIKLAMA": "Ç5-KG16 (P1)",
    "KG15-DUZELTME": "Ç5-KG15",
    "BUGUN-DALI": "Ç5-KG15",
    "KG6-POS-TARIH": "Ç7a-KG6",
    "KG19-YOLDAKI": "Ç7a-KG19",
    "K14-HESAPSIZ": "Ç7a-K14-K15",
    "KG2-H03": "Ç7b-KG2",
    "KG3-KAYIT": "Ç7b-KG3",
    "KG7-INDIRIM": "Ç7b-KG7",
    "KG8-IADE-KDV": "Ç7b-KG8 (P2)",
    "KG24-IHRACAT": "Ç7b-KG24",
    "F06-GIDER-TURU": "Ç7b-F06",
    "C1-ALT-90": "ATANMAMIŞ-ALT-90 (KG-4 602.90 / 770.90, K-01 649.90, K-02 770.90, M14 770.90)",
    "C7b6-KAPAT": "Ç7b-(6)",
}
# Tek Yükümlülük Kuyruğu (gecikmiş / hatırlatma / kart / açık fatura) farklarının kimliği: senaryonun kâhin `kapsam`ındaki karar (kullanıcı 21:08 / 21:30)
# + kâhinin gecikmiş ayrıntısındaki kalem türü (bugünkü kural yalnız taksit kartını sayar — iş listesi C "bugün cari 'Geciken' yalnız taksit kartından").
KAPSAM_KIMLIK = {"karar (1)": "Ç5-(1)", "karar (2)": "Ç5-(2)", "karar (3)": "Ç5-(3)", "karar (5)": "Ç5-(5)", "karar (4)": "Ç7b-(4)", "karar (6)": "Ç7b-(6)",
                 "S8": "Ç5-S8", "S3": "Ç5-S7", "S7": "Ç5-S7", "M2": "D4-M2", "M9": "D4-M2", "M13": "Ç5-B1"}
KALEM_KIMLIK = {"kart_kalani": "Ç7b-(6)", "kart_kucult": "Ç7b-(4)"}   # öbür kalemler (fatura, açılış, borç, karşılıksız …): B1 / S1 / S2 ortak gecikmiş → Ç5-B1
SENARYO_KIMLIK = sorted({KAPSAM_KIMLIK[x] for x in S.get("kapsam", []) if x in KAPSAM_KIMLIK})


def kimlikleri(etiketler):
    return sorted({KIMLIK.get(e, "ATANMAMIŞ:" + e) for e in etiketler})


def degistir(m, k, d):
    """Kâhin maddesi → bugünkü (2.4.9) hesaplar. Dönüş: (satırlar, etiketler)."""
    tur = k.tur if k is not None else (m.tur or "")
    v = k.v if k is not None else {}
    et = set()
    out = []
    if tur == "taksit_kapat" and v.get("bugun_eski"):
        et.add("C7b6-KAPAT")        # BUGÜN modelinde Kartı Kapat 2.4.9 kuralıyla (kâhin `eski`): kalan 689 / CH — karar (6) "Borçta Kalsın" Ç7b'de
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

# ------------------------------------------------------------------------------------------------ 3a. Tek Yükümlülük Kuyruğu raporları (kâhin bakımı 1 – 2)
# KÂHİN: rapor anında, programa uygulanmış olaylarla kurulan devirsiz kâhin dosyasından (Izli; kâhinin kendi Dosya.gecikmis / hatirlatma / kartlar_raporu /
# acik_faturalar / acik_kalemler / kuyruk().notlar işlevleri — kâhine yazılmaz). BUGÜN: belgeli bugünkü kural (iş listesi C: "bugün cari 'Geciken' yalnız
# taksit kartından"; lib/whatsapp/queue.mjs yorumu "{{4}} vadesi geçmiş toplam (cari kartındaki 'Geciken')"): yalnız AÇIK taksit kartlarının vadesi geçmiş
# kalanı; kart taksiti yalnız kartın KENDİ tahsilatıyla (Excel'de Ödenen dahil) vade sırasıyla kapanır; kapatılan kart sayılmaz; iade / iptal kartı küçültmez
# (karar (4) Ç7b'de); şüpheli alacak etiketi yok (S7 Ç5'te). BUGÜN senaryonun olaylarından kurulur, programdan TÜRETİLMEZ.
TYK = {"gecikmis", "gecikmis_tumu", "hatirlatma", "acik_faturalar", "acik_kalemler", "kartlar", "kilit_bag_notu"}


def bugun_olay(o):
    """BUGÜN modeli için olay: Kartı Kapat bugün (2.4.9) kalanı 689'la borçtan düşer — kâhinin kendi `eski` dalı (README R6; karar (6) Ç7b'de değişir)."""
    if o.get("tur") == "taksit_kapat" and not o.get("eski"):
        return dict(o, eski=True, bugun_eski=True)
    return o


def tyk_kahin(d, o):
    r, t = o["rapor"], o.get("tarih")
    if r == "gecikmis":
        return d.gecikmis(o["cari"], t)
    if r == "gecikmis_tumu":
        return {c: d.gecikmis(c, t)["gecikmis"] for c in sorted(S["cariler"])}
    if r == "hatirlatma":
        return d.hatirlatma(t)
    if r == "acik_faturalar":
        return d.acik_faturalar(o["cari"], t)
    if r == "acik_kalemler":
        return [{"k": a["k"], "tur": a["tur"], "kalan": a["kalan"] if a["taraf"] == "b" else -a["kalan"], "vade": a["vade"], "tarih": a["tarih"]} for a in d.acik_kalemler(o["cari"], t)]
    if r == "kartlar":
        return d.kartlar_raporu(o["cari"], t)
    if r == "kilit_bag_notu":
        return [dict(n) for n in d.kuyruk(o["cari"], t).notlar]
    return None


def bugun_kartlar(rno):
    """Rapor olayından (rno) önce programa uygulanmış olaylardan açık / kapalı taksit kartları (BUGÜN kuralı; yukarıdaki not)."""
    kartlar, evrak_kart = {}, {}
    for x in P["olaylar"]:
        if x["tur"] == "gun":
            continue
        no = int(str(x["no"]).rstrip("g"))
        if no >= rno:
            break
        if x.get("durum") not in ("yapildi", "faturada"):
            continue
        o = olaylar[no - 1]
        tur = o["tur"]
        if tur in ("taksit_karti", "taksit_excel"):
            kartlar[o["id"]] = {"cari": o["cari"], "taksitler": [[t["vade"], t["tutar"]] for t in o.get("taksitler", [])], "odenen": o.get("odenen", 0) if tur == "taksit_excel" else 0,
                                "kapali": False, "fatura": o.get("fatura") if o.get("kaynak") == "fatura" else None}
        elif tur == "tahsilat" and o.get("taksit_karti") in kartlar:
            kartlar[o["taksit_karti"]]["odenen"] += o["tutar"]
            if o.get("yol") in ("cek", "senet") and o.get("evrak"):
                evrak_kart[o["evrak"]] = (o["taksit_karti"], o["tutar"])
        elif tur == "evrak_karsiliksiz" and o.get("evrak") in evrak_kart:
            k, t = evrak_kart.pop(o["evrak"])
            kartlar[k]["odenen"] -= t
        elif tur == "taksit_kapat" and o.get("kart") in kartlar:
            kartlar[o["kart"]]["kapali"] = True
        elif tur in ("sil", "iptal"):
            for k in [k for k, v in kartlar.items() if v["fatura"] and v["fatura"] == o.get("kaynak")]:
                del kartlar[k]                             # faturanın kendi kartı faturayla kalkar (silmede programda 404)
        elif tur == "satis_iade_faturasi" and not o.get("para_iadesi"):
            # Bugünkü kural (docs/2.1.0-KANIT.md CH2.4 shrinkPlan: "yalnız ödenmemiş kısım, son taksitten geriye; ödenmiş taksitlere dokunulmaz"): borçtan düşülen
            # iade faturası asıl faturanın KENDİ kartını küçültür. Karar (4) "vadesi en önce gelen açık taksitten" Ç7b'de.
            for v in kartlar.values():
                if v["fatura"] and v["fatura"] == o.get("asil_fatura"):
                    v.setdefault("kesinti", 0)
                    v["kesinti"] += (o.get("M") or 0) + (o.get("K") or 0)
    for v in kartlar.values():
        kalan = max(0, v["odenen"])
        out = []
        for vade, tutar in sorted(v["taksitler"], key=lambda z: z[0]):
            al = min(tutar, kalan)
            kalan -= al
            out.append({"vade": vade, "tutar": tutar, "kalan": tutar - al})
        kes = v.get("kesinti", 0)
        for x in reversed(out):
            if kes <= 0:
                break
            al = min(kes, x["kalan"])
            x["tutar"] -= al
            x["kalan"] -= al
            kes -= al
        v["liste"] = out
    return kartlar


def bugun_gecikmis(kartlar, c, t):
    return sum(x["kalan"] for v in kartlar.values() if v["cari"] == c and not v["kapali"] for x in v["liste"] if x["vade"] < t)


def kalem_kimligi(detay):
    out = set()
    for x in detay or []:
        tur = str(x.get("kalem", x.get("k", ""))).split(":", 1)[0]
        if tur in ("kart", "taksit", "excel_odenen"):
            continue
        out.add(KALEM_KIMLIK.get(tur, "Ç5-B1"))
    return out or {"Ç5-B1"}   # kâhinin kalemi yalnız kart taksiti (TYK kart ↔ alttaki borç / K3 — EK-2 30): ortak gecikmiş tanımı


tyk_anlik = {}   # rapor adı → {kahin, bugun_kartlar}

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
                mb.adim(bugun_olay(d), i)
        return
    mk.adim(o, i)
    mb.adim(bugun_olay(o), i)
    for j in faturada.get(o.get("id"), []):
        mk.adim(olaylar[j - 1], j)
        mb.adim(bugun_olay(olaylar[j - 1]), j)


ufuk = P.get("ilk_tarih")
for x in P["olaylar"]:
    no = x["no"]
    if x["tur"] == "gun":
        ufuk = x["tarih"]
        prog_kum = topla(prog_kum, prog_gorunum(x.get("delta")) or {})
    elif x.get("durum") == "rapor":
        ro = olaylar[int(no) - 1]
        if ro["rapor"] in TYK:
            tyk_anlik[ro["ad"]] = {"kahin": tyk_kahin(mk.canli, ro), "kartlar": bugun_kartlar(int(no))}
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
# BUGÜN dalı kaynaklı red farkının kimliği (KG-7 KDV İndirim Dönemi / KG-6 POS komisyon günü / KG-15): senaryoda hangisi var.
RED_DAL_KIMLIK = sorted(({"Ç7b-KG7"} if any(o.get("indirim_ayi") or any(d.get("indirim_ayi") for d in o.get("duzeltmeler", [])) for o in S["olaylar"]) else set())
                        | ({"Ç7a-KG6"} if any(o["tur"] == "tahsilat" and o.get("yol") == "pos" and o.get("komisyon") for o in S["olaylar"]) else set())) or ["Ç5-KG15"]
kred, bred = {}, {}
for i, o in enumerate(olaylar, start=1):
    r = tam.adim(o, i)
    if r:
        kred[i] = r
    r = tamb.adim(bugun_olay(o), i)
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
                       **({"sinif": "U", "kimlik": RED_DAL_KIMLIK, "aciklama": f"BUGÜN dalında ({BUGUN.etiket()}) de {'red' if i in bred else 'kabul'}: programla aynı"} if pr != kr and pr == (i in bred) else {})})

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
                satirlar.append({"alan": alan, "anahtar": k, "program": p, "kahin": kk, "bugun": bb, "sinif": sinif, **({"etiket": etk, "kimlik": kimlikleri(etk)} if etk else {}), **({"aciklama": acik[(alan, k)]} if (alan, k) in acik else {})})
            else:
                satirlar.append({"alan": alan, "anahtar": k, "sinif": "AYNI"})
    return satirlar


GECMIS_GUN = {}   # rapor adı → program o rapordan önce daha ileri günlü olay girmişti (kâhin yalnız ≤ t sayar; program as-of okumaz)


def tyk_satir(alan, anahtar, p, k, b, kimlik, rapor_adi, yok=False):
    """Tek satır: AYNI (program = kâhin) · U (program = BUGÜN; kimlikli — yok=True: programda bu görünüm yok, plan işi) · elle sınıf (siniflama.json kapsam
    'rapor') · geçmiş günlü raporda OLCULEMEDI (sürücü sınırı; ayrıca listelenir) · SINIFLANMADI."""
    satir = {"alan": alan, "anahtar": anahtar, "program": p, "kahin": k, "bugun": b}
    if p == k and not yok:
        satir["sinif"] = "AYNI"
        return satir
    if yok and not k:
        satir["sinif"] = "AYNI"
        return satir
    if yok or p == b:
        satir["sinif"] = "U"
        satir["kimlik"] = sorted(kimlik) or ["ATANMAMIŞ:" + alan]
        if yok:
            satir["aciklama"] = "programda bu görünüm yok (planlı iş)"
        return satir
    s_ = sinifla(S["ad"], rapor_adi, alan, anahtar)
    if s_:
        satir["sinif"] = s_["sinif"]
        satir["aciklama"] = s_.get("aciklama", "")
        if s_.get("kimlik"):
            satir["kimlik"] = s_["kimlik"] if isinstance(s_["kimlik"], list) else [s_["kimlik"]]
        return satir
    satir["sinif"] = "OLCULEMEDI" if GECMIS_GUN.get(rapor_adi) else "SINIFLANMADI"
    if GECMIS_GUN.get(rapor_adi):
        satir["aciklama"] = f"geçmiş günlü rapor: program {GECMIS_GUN[rapor_adi]} gününe kadar girilmiş kayıtları da görür (as-of gecikmiş okuması yok)"
    return satir


def kart_metni(kk):
    if kk is None:
        return None
    return ("Kapalı" if kk.get("kapali") else "Açık") + " " + "; ".join(f"{x['vade']} {x['tutar']}/{x['kalan']}" for x in kk.get("taksitler", []) if x["tutar"])


def tyk_karsilastir(o, r, an, rapor_adi):
    if r.get("gecmis_gunlu"):
        GECMIS_GUN[rapor_adi] = r["gecmis_gunlu"]
    kah, kartlar, t = an.get("kahin"), an.get("kartlar") or {}, o.get("tarih")
    rr = o["rapor"]
    if kah is None:
        return [{"alan": rr, "anahtar": "-", "sinif": "SINIFLANMADI", "aciklama": "kâhin değeri kurulamadı"}]
    if rr == "gecikmis":
        p = (r.get("cari_kart") or {}).get("gecikmis")
        kim = kalem_kimligi(kah.get("detay")) | set(SENARYO_KIMLIK)
        out = [tyk_satir("gecikmis", o["cari"], p, kah["gecikmis"], bugun_gecikmis(kartlar, o["cari"], t), kim, rapor_adi)]
        if kah.get("kahin_susuyor"):
            out.append({"alan": "kahin_susuyor", "anahtar": o["cari"], "kahin": kah["kahin_susuyor"], "sinif": "U", "kimlik": ["SORULDU-S11"], "aciklama": "kâhin susuyor (S8 ↔ kilit, kullanıcıya soruldu 22:57)"})
        return out
    if rr == "gecikmis_tumu":
        cariler = r.get("cariler") or {}
        return [tyk_satir("gecikmis", c, (cariler.get(c) or {}).get("gecikmis"), v, bugun_gecikmis(kartlar, c, t), {"Ç5-B1"} | set(SENARYO_KIMLIK), rapor_adi) for c, v in sorted(kah.items())]
    if rr == "hatirlatma":
        al = r.get("alicilar") or {}
        prg = {c: x["gecikmis"] for c, x in al.items() if isinstance(x, dict) and x.get("gecikmis", 0) > 0 and c in S["cariler"]}
        bug = {c: g for c in S["cariler"] for g in [bugun_gecikmis(kartlar, c, t)] if g > 0}
        out = []
        for c in sorted(set(prg) | set(kah["otomatik"]) | set(bug)):
            kim = {"Ç5-B1"} | set(SENARYO_KIMLIK) | ({"Ç5-S7"} if c in kah.get("supheli_etiketli", []) else set())
            out.append(tyk_satir("otomatik", c, prg.get(c, 0), kah["otomatik"].get(c, 0), bug.get(c, 0), kim, rapor_adi))
        out.append(tyk_satir("supheli_etiketli", "liste", [], sorted(kah.get("supheli_etiketli", [])), [], {"Ç5-S7"}, rapor_adi))
        out.append(tyk_satir("elle", "liste", {}, kah.get("elle", {}), {}, {"Ç5-S7"}, rapor_adi))
        return out
    if rr == "kartlar":
        prg = {k: v for k, v in (r.get("kartlar") or {}).items() if "yok" not in v}
        out = []
        for k in sorted(set(prg) | set(kah) | {k for k, v in kartlar.items() if v["cari"] == o["cari"]}):
            b = kartlar.get(k)
            bm = kart_metni({"kapali": b["kapali"], "taksitler": b["liste"]}) if b and b["cari"] == o["cari"] else None
            out.append(tyk_satir("kart", k, kart_metni(prg.get(k)), kart_metni(kah.get(k)), bm, set(SENARYO_KIMLIK) or {"Ç5-B1"}, rapor_adi))
        return out
    if rr == "acik_faturalar":
        prg = {}
        for x in r.get("acik_faturalar") or []:
            if not str(x["fatura"]).startswith("?"):
                f = next((y for y in olaylar if y.get("id") == x["fatura"]), None)
                if f and f.get("cari") == o["cari"]:
                    prg[x["fatura"]] = prg.get(x["fatura"], 0) + x["kalan"]
        kahd = {x["fatura"]: x["kalan"] for x in kah}
        return [tyk_satir("fatura", f, prg.get(f, 0), kahd.get(f, 0), None, set(SENARYO_KIMLIK) or {"Ç5-B1"}, rapor_adi) for f in sorted(set(prg) | set(kahd))]
    if rr == "acik_kalemler":
        return [tyk_satir("acik_kalem", o["cari"], None, json.dumps(kah, ensure_ascii=False, sort_keys=True) if kah else None, None, {"Ç5-B1 (ortak açık kalem görünümü)"} | set(SENARYO_KIMLIK), rapor_adi, yok=True)]
    if rr == "kilit_bag_notu":
        return [tyk_satir("kilit_bag_notu", o["cari"], None, json.dumps(kah, ensure_ascii=False, sort_keys=True) if kah else None, None, {"Ç5-(3)"}, rapor_adi, yok=True)]
    return []


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
    elif o["rapor"] in TYK:
        out["satirlar"] = tyk_karsilastir(o, r, tyk_anlik.get(ad) or {}, ad)
        out["kahin_oz"] = (B["dallar"].get("A", {}).get("raporlar", {}) or {}).get(ad) == json.loads(json.dumps((tyk_anlik.get(ad) or {}).get("kahin"), sort_keys=True))
        if r.get("gecmis_gunlu"):
            out["gecmis_gunlu"] = r["gecmis_gunlu"]
    elif o["rapor"] == "kaynak_durumu":
        kah = (B["dallar"].get("A", {}).get("raporlar", {}) or {}).get(ad)
        d = r.get("durum") or {}
        prg = ("silindi" if d.get("yok") else {"issued": "aktif", "draft": "aktif", "cancelled": "iptal"}.get(d.get("status"), d.get("status"))) if "status" in d or d.get("yok") else ("aktif" if d.get("satir_var") else "silindi" if "satir_var" in d else None)
        out["satirlar"] = [tyk_satir("durum", o["kaynak"], prg, kah, None, set(), ad)]
    elif o["rapor"] == "kural_farki":
        kah = (B["dallar"].get("A", {}).get("raporlar", {}) or {}).get(ad) or {}
        kah_ana = defaultdict(int)
        for k, v in kah.items():
            kah_ana[M.ana(k.split("|")[0])] += v
        prg = defaultdict(int)
        for d in r.get("denetimler") or []:
            if d.get("code") == "ledger:rule-diff":
                for b in d.get("breakdown") or []:
                    prg[b["account"]] += int(b.get("differenceMinor") or 0)
        out["satirlar"] = [tyk_satir("kural_farki", h, prg.get(h, 0), kah_ana.get(h, 0), 0, {"Ç5-KG15"}, ad)
                           for h in sorted(set(prg) | {h for h, v in kah_ana.items() if v})]
        out["program_denetimleri"] = r.get("denetimler")
    elif o["rapor"] == "acilis_fisleri":
        kah = (B["dallar"].get("A", {}).get("raporlar", {}) or {}).get(ad)
        out["satirlar"] = [tyk_satir("acilis_fisleri", o.get("tarih", ""), None, json.dumps(kah, ensure_ascii=False), None, {"D4-(7)"}, ad, yok=True)]
    out["ozet"] = {s: sum(1 for x in out["satirlar"] if (x["sinif"] == s if s in ("AYNI", "U", "SINIFLANMADI", "OLCULEMEDI") else s in x["sinif"].split("/"))) for s in ("AYNI", "U", "P", "K", "R", "SINIFLANMADI", "OLCULEMEDI")}
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
ozet = {s: sum(1 for x in tum if (x["sinif"] == s if s in ("AYNI", "U", "SINIFLANMADI", "OLCULEMEDI") else s in x["sinif"].split("/"))) for s in ("AYNI", "U", "P", "K", "R", "SINIFLANMADI", "OLCULEMEDI")}
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
print(f"{S['ad']} [{P.get('tz')}] öz denetim {'TAMAM' if OZ['raporlar_ayni'] else 'BOZUK'} · AYNI {ozet['AYNI']} · U {ozet['U']} · P {ozet['P']} · K {ozet['K']} · R {ozet['R']} · SINIFLANMADI {ozet['SINIFLANMADI']} · ÖLÇÜLEMEDİ {ozet['OLCULEMEDI']} · red farkı {red_fark} · adım farkı {len(adim_farklari)} (sınıfsız {ozet['adim_sinifsiz']})")
