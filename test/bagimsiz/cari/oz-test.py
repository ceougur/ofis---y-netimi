#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""Cari kâhininin programsız öz denetimi (2.5.0 Ç5 bakımı; KARARLAR.md §13). Program AÇILMAZ.

  python3 -I test/bagimsiz/cari/oz-test.py

1. Elle tablolar: senaryolar/*.json içindeki `elleBeklenen` (elle hesaplanmış beklenenler, kuruş) ↔ 2.5.0 kâhininin çıktısı; `elleCatal`: ÇATAL denetimlerin dalları.
   Bakım 2 (§14): hiçbir denetim SK-4 ÇATAL'ı taşımaz (S68 = A — ikinci dal yok). Bakım 3 (§15): hiçbir denetim SK-5 ÇATAL'ı taşımaz (S69 = A).
2. Mutantlar 200–223 (kâhinin dişi): her biri en az bir elle senaryoda 2.5.0 çıktısını DEĞERLE değiştirmeli (çökme de yakalandı sayılır — kos.mjs düzeni).
   Bakım 3 mutantları 219–223 (S69 B + sınır kaymaları) daha sıkı: çökmeden, bir `elleBeklenen` değerini değiştirerek yakalanmalı (elle tablo kırmızı).
3. Çapraz denetim: tek yükümlülük kuyruğu (C13.4 (2)(3)(4)) "saf" bir zaman çizelgesi simülasyonuyla — yalnız fatura / elle Borç / borçlu Açılış / tahsilat (bağlı ya da bağsız)
   olan carilerde (kart, iade, evrak, kapatıcı, ödeme, şüpheli YOK) — model.py'nin açık / Kalan değerleri bire bir aynı olmalı. Senaryolar: elle /3 dosyaları + uretici.py
   rastgele s1 ve ux18 (tohum 1–3 × 60).
4. 2.4.9 eşitliği: kartsız, vadesiz (vade alanı boş) carilerde 2.5.0 ve 2.4.9 açık / Kalan değerleri aynı olmalı (ANINDA = HAVUZ, tarih sıralı alanda; C13.4 (4)).
5. Bakım 4 (§16; S91 / S92 / S93): `elleBelirsiz` — kâhinin SUSTUĞU (net görünümü tanımsız) carinin `belirsiz` kaydı; mutantlar 224–233 DEĞERLE; iki yönlü tek kuyruğun (C16.2 / C16.3)
   "saf" (model.py'den ayrı yazılmış: tek aşama, gün içinde önce kalemler sonra ödemeler, karşı satırlar vade → belge → yazım) simülasyonuyla çapraz denetimi — yalnız fatura / elle
   kayıt / Açılış / tahsilat / ödeme olan carilerde, modelin okuma birliği bulduğu yerde net kalanlar ve verilen avans satırları bire bir aynı olmalı; karşı yönlü kalemi OLMAYAN caride
   iki yönlü kuyruk = kendi tarafının kuyruğu (§13–§15 değişmedi); gecikmiş için EK-1 §1 (i) 0 ≤ gecikmiş ≤ max(0, bakiye) ve net kuyrukta (ii) Σ açık borç − Σ açık alacak = bakiye.
6. Bakım 5 (§17; S95 / S96 / S97 / S98): saf simülasyon kararların birlikte okunuşuyla (Y5-1: gün içinde önce kalemler, bağsız ödeme önce kendi tarafını kapatır — önceki günlerin
   netleşmesi geri alınır, ödemenin günündeki kesin; verilen avans tek vade sırasında kalemdir); karşı yönlü kalemi olmayan caride iki yönlü kuyruk kendi tarafının kuyruğundan
   yalnız S98 yüzünden ayrışabilir (sayılır); mutantlar 234–240 DEĞERLE; `elleYok` / `elleBelirsiz` Y5-7 susmaları.
7. Bakım 6 (§18; S99 / S101 / S102–S105 + SK-13): saf simülasyon S102 A ile (önceki günlerin netleşmesi en yeniden geri alınır, açılan karşı kalem o gün yeniden uygulanır) ve taksitli
   faturanın taksitleriyle; faturanın belge durumu saf simülasyonun netleşmesiz koşusuyla (S99 A — SK-13); hiçbir senaryoda SK-9 … SK-13 susması kalmaz; mutantlar 241–250 DEĞERLE;
   `elleYok` / `elleBelirsiz` SK-14 … SK-17 susmaları.
8. Bakım 7 (§19; G1 / G2): bütün elle senaryolarda seriden numara alan belgeler (satış faturası — taslak dahil — ve iade) senaryo içinde tarih sırasıyla (Y7-1); elle Mevcut Borç kartının
   reddi (Y7-3) yalnız 2.5.0'da — 2.4.9'da aynı adım kabul; mutantlar 251–255 DEĞERLE; `elleYok` / `elleBelirsiz` SK-18 susması.
9. Bakım 8 (§20; S110): kart açılırken açık borç kart tutarından fazlaysa kart kendi borcunu taşır — d34 elle tablosu; mutantlar 256–260 DEĞERLE; `elleYok` / `elleBelirsiz` SK-19 susması.
10. Bakım 9 (§21; S120): elle kart tek bir elle borca denk gelmiyorsa yalnız elle borçları eskiden yeniye içine alır — d35 elle tablosu (d34 E11–E13 ve d8 A artık değerle); mutantlar 261–264
   DEĞERLE; `elleYok` / `elleBelirsiz` SK-20 … SK-23 susmaları.
11. Bakım 10 (§22; S122 A, S123 / S124 / S125 = C): birden çok elle borcu içine alan karta gelen ödeme elle borçların Kalan'ını içine alma sırasıyla, eskiden yeniye düşürür — d36 elle tablosu
   (d35 H10 / H11 artık değerle); mutantlar 265–269 DEĞERLE; `elleYok` / `elleBelirsiz` Y10-4 (S125 = C) ve SK-20 / SK-22 / SK-23 (BİLİNEN SINIR) susmaları.
Çıktı: TAP benzeri sayılar + son satır "N/M denetim geçti". Çıkış 0 yalnız hepsi geçerse.
"""
import importlib.util
import json
import os
import subprocess
import sys
from collections import defaultdict

BURASI = os.path.dirname(os.path.abspath(__file__))
_spec = importlib.util.spec_from_file_location("kahin_cari_model_oz", os.path.join(BURASI, "model.py"))
M = importlib.util.module_from_spec(_spec)
_spec.loader.exec_module(M)


def yukle(p):
    with open(p, encoding="utf-8") as f:
        return json.load(f)


def calistir(sen, mut=0, kural="2.5.0"):
    m = M.Model(sen, mut, kural)
    sonuc = m.kos()
    m.son_belirsiz = sonuc["belirsiz"]
    return m, sonuc["denetimler"]


def saf_tyk(m, cari):
    """C13.4'ün saf okuması (model.py'den bağımsız yazıldı): olay listesi tarih → (borç kalemleri önce) → yazım sırası; bağlı tahsilat önce kendi faturasını kapatır,
    fazlası kendi tarihinde bağsız; bağsız para o anda açık kalemlere vade → belge → yazım sırasıyla; artan avans sonra doğan kaleme. Dönüş {kalem: kalan}."""
    kalem = {}
    for ad, f in m.faturalar.items():
        if f["cari"] == cari and f["durum"] == "kesildi" and f["tur"] == "satis":
            kalem[ad] = [f["tarih"], f["tarih"], f["seq"], f["tutar"]]
    for hn, h in m.hareketler.items():
        if h["cari"] == cari and h["aktif"] and (h["tur"] == "borc" or (h["tur"] == "acilis" and h["yon"] == "borc")):
            kalem[hn] = [h["tarih"], h.get("vade") or h["tarih"], h["seq"], h["tutar"]]
    for en, e in m.evraklar.items():
        # bakım 2 C14.3 (S66 A + S1 A): carisiz evrakın karşılıksızında seçilen carinin ayrı borç kalemi — belge günü = vade = karşılıksız günü
        if e["durum"] == "karsiliksiz" and e.get("karsiliksizCari") == cari:
            kalem["kars:" + en] = [e["karsiliksizTarih"], e["karsiliksizTarih"], e["karsiliksizSeq"], e["tutar"]]
    para = []
    bagli = defaultdict(list)
    for tn, t in m.tahsilatlar.items():
        if t["cari"] != cari or not t["aktif"]:
            continue
        if t["fatura"] and t["fatura"] in kalem:
            bagli[t["fatura"]].append((t["tarih"], t["seq"], t["tutar"]))
        else:
            para.append((t["tarih"], t["seq"], t["tutar"]))
    for e in m.evraklar.values():
        if e["cari"] != cari or e["durum"] in ("silindi", "karsiliksiz"):
            continue  # karşılıksız evrak kapatıcı değil (S8 / B2.2)
        if e["fatura"] and e["fatura"] in kalem:
            bagli[e["fatura"]].append((e["tarih"], e["seq"], e["tutar"]))
        else:
            para.append((e["tarih"], e["seq"], e["tutar"]))
    for f, liste in bagli.items():
        for tarih, seq, tutar in sorted(liste):
            x = min(kalem[f][3], tutar)
            kalem[f][3] -= x
            if tutar > x:
                para.append((tarih, seq, tutar - x))
    olaylar = sorted([(v[0], 0, v[2], ad) for ad, v in kalem.items()] + [(p[0], 1, p[1], i) for i, p in enumerate(para)])
    acik, avans = [], 0
    for tarih, sinif, _seq, ref in olaylar:
        if sinif == 0:
            acik.append(ref)
        else:
            avans += para[ref][2]
        for ad in sorted(acik, key=lambda a: (kalem[a][1], kalem[a][0], kalem[a][2])):
            x = min(kalem[ad][3], avans)
            kalem[ad][3] -= x
            avans -= x
    return {ad: v[3] for ad, v in kalem.items()}


def _ay_sonra(iso, n):
    """Bakım 6 saf yardımcı (model.py'den ayrı): iso tarihin n ay sonrası, gün ay sonuna kırpılır."""
    y, a, g = (int(x) for x in iso.split("-"))
    a0 = a - 1 + n
    y, a = y + a0 // 12, a0 % 12 + 1
    son = [31, 29 if (y % 4 == 0 and (y % 100 != 0 or y % 400 == 0)) else 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31][a - 1]
    return "%04d-%02d-%02d" % (y, a, min(g, son))


def saf_net(m, cari, netles=True):
    """C16.2 / C16.3 + bakım 5 (§17 Y5-1) + bakım 6 (§18 Y6-1 / Y6-2 / Y6-3)'ün saf okuması (model.py'den bağımsız yazıldı). Bakım 6: S102 A — ödeme önceki GÜNLERİN netleşmesini
    en yeniden başlayarak geri alır, aynı günün netleşmesi kalır; açılan karşı kalem ödeme bitince o gün açık karşı satırlara uygulanır (bakım 5'in K1 "en sonda yeniden kur" okuması
    S102 B'dir — kaldırıldı); S103 A — verilen avansın kalemle kapanışı kesin (geri alınan yalnız iki kalemin netleşmesi); S104 A — tek vade sırası; S99 A — taksitli faturanın
    taksitleri borç yönlü kalem (vade = taksit tarihi; eşit tutar, artık sonda, ilk vadeden ayda bir). netles=False: iki yükümlülük kalemi netleşmez (faturanın belge görünümü — (5)).
    Satırlar TEK listede, iki yönde: yükümlülük kalemleri (satış / alış faturası, taksit, elle Borç / Alacak, Açılış, stok veresiye) ve ödeme satırları (tahsilat, Ödeme). Bağlı tahsilat /
    ödeme önce kendi faturasını kapatır (zamandan bağımsız), artanı kendi gününde bağsız. Olaylar gün → (önce o günün kalemleri, sonra ödemeleri — S97) → yazım sırası; gelen satır o anda
    açık KARŞI yönlü satırlara vade → belge günü → yazım sırasıyla (ödeme satırında vade = gün; S98) uygulanır. Dönüş ({kalem: kalan}, [(gün, kalan)] açık borç yönlü ödeme satırları,
    Σ açık borç yönlü − Σ açık alacak yönlü, {fatura: belge açığı (taksitli: taksitlerinin toplamı)})."""
    S = []  # [yön (+1 cari borçlanır / −1 alacaklanır), kalem mi, gün, vade, yazım sırası, kalan, ad, bağ hedefi, taksitin faturası]
    for ad, f in m.faturalar.items():
        if not (f["cari"] == cari and f["durum"] == "kesildi" and f["tur"] in ("satis", "alis")):
            continue
        if f["tur"] == "satis" and f["taksitli"]:
            plan = f.get("taksit") or {}
            n, ilk = int(plan.get("sayi", 1)), plan.get("ilkVade") or f["tarih"]
            for i in range(n):
                tutar = f["tutar"] // n + (f["tutar"] - (f["tutar"] // n) * n if i == n - 1 else 0)
                S.append([1, True, f["tarih"], _ay_sonra(ilk, i), (f["seq"], i + 1), tutar, "%s#%d" % (ad, i + 1), None, ad])
            continue
        S.append([1 if f["tur"] == "satis" else -1, True, f["tarih"], f["tarih"], (f["seq"], 0), f["tutar"], ad, None, None])
    for hn, h in m.hareketler.items():
        if h["cari"] == cari and h["aktif"] and h["tur"] in ("borc", "alacak", "acilis"):
            S.append([1 if h["yon"] == "borc" else -1, True, h["tarih"], h.get("vade") or h["tarih"], (h["seq"], 0), h["tutar"], hn, None, None])
    for xn, x in m.kapaticilar.items():
        if x["cari"] == cari and x["aktif"] and x["tur"] == "stok_satis":
            S.append([1, True, x["tarih"], x["tarih"], (x["seq"], 0), x["tutar"], xn, None, None])  # stok veresiye (KS7.1): borç yönlü yükümlülük kalemi
    for tn, t in m.tahsilatlar.items():
        if t["cari"] == cari and t["aktif"]:
            S.append([-1, False, t["tarih"], t["tarih"], (t["seq"], 0), t["tutar"], tn, t["fatura"], None])
    for on, o in m.odemeler.items():
        if o["cari"] == cari and o["aktif"]:
            S.append([1, False, o["tarih"], o["tarih"], (o["seq"], 0), o["tutar"], on, o["fatura"], None])
    kalem = {s[6]: s for s in S if s[1]}
    for s in sorted((x for x in S if not x[1] and x[7] in kalem), key=lambda x: (x[2], x[4])):
        hedef = kalem[s[7]]
        if hedef[0] == s[0] or s[7] not in m.faturalar:
            continue  # bağ yalnız karşı yönlü (taksitsiz) faturaya (tahsilat → satış, ödeme → alış)
        x = min(hedef[5], s[5])
        hedef[5] -= x
        s[5] -= x
    sira = sorted(range(len(S)), key=lambda i: (S[i][2], 0 if S[i][1] else 1, S[i][4]))
    r = {i: S[i][5] for i in range(len(S))}
    gelen, defter = [], []  # defter: [i, j, tutar, gün, iki kalem mi]

    def anahtar(j):
        return (S[j][3] if S[j][1] else S[j][2], S[j][2], S[j][4])

    def uygula(i, gun):
        for j in sorted((j for j in gelen if S[j][0] != S[i][0] and r[j] > 0), key=anahtar):
            if r[i] <= 0:
                return
            iki = S[i][1] and S[j][1]
            if iki and not netles:
                continue
            x = min(r[i], r[j])
            r[i] -= x
            r[j] -= x
            defter.append([i, j, x, gun, iki])

    for i in sira:
        if r[i] <= 0:
            gelen.append(i)
            continue
        gun = S[i][2]
        if S[i][1]:
            uygula(i, gun)
            gelen.append(i)
            continue
        acilan = []
        for j in sorted((j for j in gelen if S[j][0] != S[i][0]), key=anahtar):
            if r[i] <= 0:
                break
            geri = [e for e in defter if j in (e[0], e[1]) and e[4] and e[3] < gun and e[2] > 0]  # S95 + S97 + S102: yalnız ÖNCEKİ günlerin iki kalem netleşmesi
            al = min(r[i], r[j] + sum(e[2] for e in geri))
            if al <= 0:
                continue
            acik_kisim = min(al, r[j])
            r[j] -= acik_kisim
            kalan_al = al - acik_kisim
            for e in reversed(geri):  # en yeni netleşme önce geri alınır (S102: önceki günün karşı kalemi açılır)
                if kalan_al <= 0:
                    break
                u = min(kalan_al, e[2])
                e[2] -= u
                kalan_al -= u
                karsi = e[1] if e[0] == j else e[0]
                r[karsi] += u
                acilan.append(karsi)
            r[i] -= al
        gelen.append(i)
        for k in sorted(set(acilan), key=lambda k: (S[k][2], S[k][4])):
            if r[k] > 0:
                uygula(k, gun)
    belge = {}
    for i in range(len(S)):
        if S[i][1] and (S[i][6] in m.faturalar or S[i][8]):
            f = S[i][8] or S[i][6]
            belge[f] = belge.get(f, 0) + r[i]
    return ({S[i][6]: r[i] for i in range(len(S)) if S[i][1]}, sorted((S[i][2], r[i]) for i in range(len(S)) if not S[i][1] and S[i][0] == 1 and r[i] > 0),
            sum(S[i][0] * r[i] for i in range(len(S))), belge)


def yalin_saf(m, cari):
    """saf_net'in alanı: yalnız fatura (satış — bakım 6: taksitli dahil — / alış), elle kayıt, Açılış, stok veresiye, tahsilat, ödeme — kart, evrak, iade / değersiz kapatıcı, şüpheli, tablo bağı YOK."""
    if m.cariler[cari].get("kayit") is not None or any(kt["cari"] == cari for kt in m.kartlar.values()):
        return False
    if any(f["cari"] == cari and f["durum"] == "kesildi" and f["tur"] not in ("satis", "alis") for f in m.faturalar.values()):
        return False
    if any(e["cari"] == cari or e.get("ciroCari") == cari or e.get("karsiliksizCari") == cari for e in m.evraklar.values()):
        return False
    if any(x["cari"] == cari and x["tur"] != "stok_satis" for x in m.kapaticilar.values()) or any(sp["cari"] == cari for sp in m.supheliler.values()):
        return False
    return True


def basit(m, cari):
    if any(kt["cari"] == cari for kt in m.kartlar.values()):
        return False
    if any(f["cari"] == cari and f["durum"] == "kesildi" and (f["tur"] != "satis" or f["taksitli"]) for f in m.faturalar.values()):
        return False
    if any(e.get("ciroCari") == cari for e in m.evraklar.values()):
        return False
    if any(x["cari"] == cari for x in m.kapaticilar.values()) or any(sp["cari"] == cari for sp in m.supheliler.values()):
        return False
    if any(o["cari"] == cari for o in m.odemeler.values()):
        return False
    if any(h["cari"] == cari and h["aktif"] and (h["tur"] == "alacak" or (h["tur"] == "acilis" and h["yon"] == "alacak")) for h in m.hareketler.values()):
        return False
    return True


def main():
    gecen, kalan, satirlar = 0, 0, []

    def denetle(ad, ok, ayrinti=""):
        nonlocal gecen, kalan
        if ok:
            gecen += 1
        else:
            kalan += 1
            satirlar.append("  ✗ %s %s" % (ad, ayrinti))

    d = os.path.join(BURASI, "senaryolar")
    elle = [os.path.join(d, f) for f in sorted(os.listdir(d)) if f.endswith(".json")]
    v3 = [p for p in elle if yukle(p).get("dil") == M.DIL]
    # 1. elle tablolar
    tabanlar = {}
    for p in v3:
        sen = yukle(p)
        ad = os.path.basename(p)
        try:
            _m, out = calistir(sen)
        except SystemExit as e:
            denetle("%s çalıştı" % ad, False, str(e))
            continue
        tabanlar[p] = out
        for k, b in (sen.get("elleBeklenen") or {}).items():
            g = out.get(k, {}).get("b", "ANAHTAR YOK")
            denetle("%s %s" % (ad, k), g == b, "elle %s · kâhin %s" % (json.dumps(b, ensure_ascii=False), json.dumps(g, ensure_ascii=False)))
        for k in sen.get("elleYok") or []:
            denetle("%s %s yok (tanımsız — kâhin kurmaz)" % (ad, k), k not in out, json.dumps(out.get(k), ensure_ascii=False))
        for parca in sen.get("elleBelirsiz") or []:
            # bakım 4: kâhinin sustuğu durum `belirsiz`'e yazılmış olmalı (sessizce atlanmaz) — parça listesinin HEPSİ aynı kayıtta geçer
            parcalar = parca if isinstance(parca, list) else [parca]
            denetle("%s belirsiz: %s" % (ad, " + ".join(parcalar)), any(all(x in b for x in parcalar) for b in _m.son_belirsiz), json.dumps(_m.son_belirsiz, ensure_ascii=False)[:300])
        for k, alanlar in (sen.get("elleCatal") or {}).items():
            g = out.get(k, {}).get("b")
            dallar = g.get("catal") if isinstance(g, dict) else None
            ok = isinstance(dallar, list) and len(dallar) >= 2
            if ok:
                for alan, beklenen in alanlar.items():
                    degerler = [x.get(alan) for x in dallar]
                    ok = ok and (sorted(degerler) == sorted(beklenen) if isinstance(beklenen, list) else all(x == beklenen for x in degerler))
            denetle("%s %s ÇATAL" % (ad, k), ok, json.dumps(g, ensure_ascii=False)[:300])
        sk4 = [k for k, v in out.items() if "ÇATAL SK-4" in v.get("k", "")]
        denetle("%s SK-4 ÇATAL yok (S68 = A)" % ad, not sk4, ",".join(sk4[:5]))
        sk5 = [k for k, v in out.items() if "ÇATAL SK-5" in v.get("k", "")]
        denetle("%s SK-5 ÇATAL yok (S69 = A)" % ad, not sk5, ",".join(sk5[:5]))
        # bakım 6 (§18 Y6-1): S102–S105 = A — SK-9 … SK-12 okuma ayrışması ve SK-13 belge susması kalmadı (yalnız SK-14 … SK-17 ve Y5-7 / tanım alanı)
        eski_sk = [b for b in _m.son_belirsiz if "SK-9 … SK-12" in b or "(SK-13;" in b]
        denetle("%s SK-9 … SK-13 susması yok (S102–S105 A, S99 A)" % ad, not eski_sk, json.dumps(eski_sk[:2], ensure_ascii=False))
    # 2. mutantlar 200–223
    for n, ad in M.MUTASYONLAR.items():
        if n < 200:
            continue
        if n >= 219:
            # bakım 3: değerle — çökmeden, elle hesaplanmış bir beklenen kırmızıya döner
            degerle = []
            for p in v3:
                sen = yukle(p)
                if p not in tabanlar or not sen.get("elleBeklenen"):
                    continue
                try:
                    _m, out = calistir(sen, n)
                except Exception as e:  # noqa: BLE001 — çökme değerle yakalama sayılmaz
                    denetle("mutasyon %d çökmedi (%s)" % (n, os.path.basename(p)), False, repr(e)[:200])
                    continue
                kirmizi = [k for k, b in sen["elleBeklenen"].items() if out.get(k, {}).get("b", "ANAHTAR YOK") != b]
                if kirmizi:
                    degerle.append("%s:%s" % (os.path.basename(p), kirmizi[0]))
            denetle("mutasyon %d DEĞERLE yakalandı (elle tablo)" % n, bool(degerle), ad)
            print("  mutasyon %d (%s): %s" % (n, ad, ("DEĞERLE YAKALANDI (%d elle senaryo; ilk: %s)" % (len(degerle), degerle[0])) if degerle else "YAKALANMADI"))
            continue
        yakalayan = []
        for p in v3:
            if p not in tabanlar:
                continue
            try:
                _m, out = calistir(yukle(p), n)
                fark = {k: v["b"] for k, v in out.items()} != {k: v["b"] for k, v in tabanlar[p].items()}
            except Exception:
                fark = True
            if fark:
                yakalayan.append(os.path.basename(p))
            if len(yakalayan) >= 3:
                break
        denetle("mutasyon %d yakalandı" % n, bool(yakalayan), ad)
        print("  mutasyon %d (%s): %s" % (n, ad, ("YAKALANDI (%s)" % ", ".join(yakalayan)) if yakalayan else "YAKALANMADI"))
    # 3. + 4. çapraz denetim (saf simülasyon) ve tarih sıralı alanda 2.4.9 eşitliği
    rastgele = []
    for tur in ("s1", "ux18"):
        for t in (1, 2, 3):
            r = subprocess.run([sys.executable, "-I", os.path.join(BURASI, "uretici.py"), "--tur", tur, "--tohum", str(t), "--islem", "60"], capture_output=True, check=True)
            rastgele.append(("rastgele-%s-%d" % (tur, t), json.loads(r.stdout)))
    capraz, esit249 = 0, 0
    for ad, sen in [(os.path.basename(p), yukle(p)) for p in v3] + rastgele:
        if sen.get("dil") != M.DIL and not ad.startswith("rastgele-ux18"):
            continue
        try:
            m, _ = calistir(sen)
            m249, _ = calistir(sen, 0, "2.4.9")
        except SystemExit:
            continue
        for cari, c in m.cariler.items():
            if c.get("silindi") or not basit(m, cari):
                continue
            beklenen = saf_tyk(m, cari)
            model_acik = dict(m.aciklar(cari))
            model_acik.update(m.kalanlar(cari))
            model_acik.update({k_: v_ for k_, v_ in m.tyk250(cari)["kuyruk"].items() if k_.startswith("kars:")})  # bakım 2 C14.3 kalemi
            for kad, v in beklenen.items():
                capraz += 1
                denetle("%s %s %s saf TYK" % (ad, cari, kad), model_acik.get(kad) == v, "saf %s · model %s" % (v, model_acik.get(kad)))
            vadesiz = not any(h["cari"] == cari and h.get("vade") for h in m.hareketler.values()) \
                and not any(e.get("karsiliksizCari") == cari for e in m.evraklar.values())  # C14.3 yalnız 2.5.0'da (2.4.9'da yok)
            if vadesiz:
                a249 = dict(m249.aciklar(cari))
                a249.update(m249.kalanlar(cari))
                for kad, v in beklenen.items():
                    esit249 += 1
                    denetle("%s %s %s 2.4.9 = 2.5.0 (vadesiz)" % (ad, cari, kad), a249.get(kad) == model_acik.get(kad),
                            "2.4.9 %s · 2.5.0 %s" % (a249.get(kad), model_acik.get(kad)))
    print("  çapraz denetim (saf TYK): %d kalem · tarih sıralı alanda 2.4.9 = 2.5.0: %d kalem" % (capraz, esit249))
    # 5. bakım 4 (§16): iki yönlü tek kuyruk — saf simülasyon ↔ model (net250), tek yönde = kendi tarafının kuyruğu, gecikmiş değişmezleri
    rastgele4 = list(rastgele)
    for t in (4, 5, 6, 7, 8):
        r = subprocess.run([sys.executable, "-I", os.path.join(BURASI, "uretici.py"), "--tur", "s1", "--tohum", str(t), "--islem", "60"], capture_output=True, check=True)
        rastgele4.append(("rastgele-s1-%d" % t, json.loads(r.stdout)))
    say = {"net": 0, "tek": 0, "avans": 0, "gecikmis": 0, "ii": 0, "ayrisan": 0, "disarida": 0, "s98": 0, "taksit": 0, "belge": 0}
    for ad, sen in [(os.path.basename(p), yukle(p)) for p in v3] + rastgele4:
        if sen.get("dil") != M.DIL:
            continue
        # son durum + her kontrol anı: kontrol adımlarında modelin o andaki durumu denetlenir (zaman içinde değişen kuyruk)
        adimlar = sen["adimlar"]
        kesimler = [i + 1 for i, a in enumerate(adimlar) if a["islem"] == "kontrol"][-3:] or [len(adimlar)]
        for kesim in kesimler:
            try:
                m, _ = calistir(dict(sen, adimlar=adimlar[:kesim]))
            except SystemExit:
                continue
            for cari, c in m.cariler.items():
                if c.get("silindi"):
                    continue
                nd = m.net_durum(cari)
                yalin = m._net_uygun(cari)[0]
                if nd[0] == "tanimsiz":
                    say["ayrisan" if yalin else "disarida"] += 1
                if yalin:
                    N = m.net250(cari)
                    if N["birlik"]:
                        # (ii) net kuyrukta Σ açık borç yönlü − Σ açık alacak yönlü = bakiye; iki yön birlikte açık kalmaz
                        b_acik = sum(r["kalan"] for r in N["satirlar"] if r["yon"] == "B")
                        a_acik = sum(r["kalan"] for r in N["satirlar"] if r["yon"] == "A")
                        say["ii"] += 1
                        denetle("%s@%d %s net kuyruk (ii) Σ açık = bakiye, tek yön açık" % (ad, kesim, cari), b_acik - a_acik == m.bakiye(cari) and min(b_acik, a_acik) == 0,
                                "borç yönlü %s · alacak yönlü %s · bakiye %s" % (b_acik, a_acik, m.bakiye(cari)))
                    if N["birlik"] and yalin_saf(m, cari):
                        saf_kalan, saf_avans, saf_bakiye, _b = saf_net(m, cari)
                        denetle("%s@%d %s saf net bakiye" % (ad, kesim, cari), saf_bakiye == m.bakiye(cari), "saf %s · model %s" % (saf_bakiye, m.bakiye(cari)))
                        for kad, v in saf_kalan.items():
                            say["net" if nd[0] == "net" else "tek"] += 1
                            say["taksit"] += "#" in kad
                            denetle("%s@%d %s %s saf net (iki yönlü tek kuyruk)" % (ad, kesim, cari, kad), N["kalan"].get(kad) == v, "saf %s · model %s" % (v, N["kalan"].get(kad)))
                        say["avans"] += 1
                        denetle("%s@%d %s saf net verilen avans satırları" % (ad, kesim, cari), N["avans"] == saf_avans, "saf %s · model %s" % (saf_avans, N["avans"]))
                        if not m.belge_tanimsiz(cari):
                            # bakım 6 Y6-2 / Y6-3 [S99 A; SK-13]: faturanın belge durumu = verilen avansı kalem sayan tek kuyruk, iki kalem netleşmeden (taksitli: taksitlerinin toplamı)
                            _k, _a, _t, saf_belge = saf_net(m, cari, netles=False)
                            mb = m.belge250(cari)
                            for f, v in saf_belge.items():
                                say["belge"] += 1
                                denetle("%s@%d %s %s saf belge durumu (S99 A)" % (ad, kesim, cari, f), mb.get(f) == v, "saf %s · model %s" % (v, mb.get(f)))
                    if N["birlik"] and nd[0] == "net" and nd[1].get("kaynak") == "S98":
                        say["s98"] += 1  # bakım 5: karşı yönlü kalemsiz yalın caride S98 (verilen avans kalem) kendi tarafının kuyruğundan ayrıştı
                    if N["birlik"] and nd[0] == "tek":
                        # karşı yönlü kalemi olmayan yalın caride iki yönlü kuyruk = kendi tarafının kuyruğu (§13–§15 değişmedi)
                        taraf = dict(m.kuyruk(cari))
                        taraf.update(m.kuyruk_borc(cari))
                        taraf.update({k_: v_ for k_, v_ in m.tyk250(cari)["kuyruk"].items() if k_.startswith("kars:")})
                        # bakım 6 (S99 A): taksitli faturanın taksitleri kendi tarafının kuyruğunda da "<fatura>#<n>" adıyla
                        taraf.update({k_: v_ for k_, v_ in m.tyk250(cari)["kuyruk"].items() if k_.split("#")[0] in m.faturalar})
                        for kad, v in N["kalan"].items():
                            say["tek"] += 1
                            denetle("%s@%d %s %s tek yönde net = kendi tarafı" % (ad, kesim, cari, kad), taraf.get(kad) == v, "kendi tarafı %s · net %s" % (taraf.get(kad), v))
                if not m.tyk250(cari)["neden"] and not any(sp["cari"] == cari for sp in m.supheliler.values()):
                    g = m.gecikmis250(cari)
                    if g is not None:
                        say["gecikmis"] += 1
                        denetle("%s@%d %s gecikmiş (i) 0 ≤ gecikmiş ≤ max(0, bakiye)" % (ad, kesim, cari), 0 <= g <= max(0, m.bakiye(cari)), "gecikmiş %s · bakiye %s" % (g, m.bakiye(cari)))
    print("  bakım 4 + 5 + 6 çapraz denetim: saf net %d kalem (karşı yönlü kalemli caride) + %d kalem (tek yönde; %d taksit) · saf belge durumu %d fatura · avans %d cari · (ii) %d cari ·"
          " gecikmiş (i) %d cari · susulan: okuma ayrışan (SK-17) %d, tanım alanı dışı %d · S98 ile kendi tarafından ayrışan %d cari"
          % (say["net"], say["tek"], say["taksit"], say["belge"], say["avans"], say["ii"], say["gecikmis"], say["ayrisan"], say["disarida"], say["s98"]))
    denetle("bakım 4 çapraz denetim boş değil (karşı yönlü kalemli caride saf net kalemi var)", say["net"] > 0 and say["tek"] > 0 and say["gecikmis"] > 0, json.dumps(say))
    # 8. bakım 7 (§19 Y7-1, G1): elle senaryolarda seriden numara alan belgeler (satış faturası — taslak dahil — ve iade) senaryo içinde tarih sırasıyla (eşit / artan); tarih yoksa `bugun`
    seri_say = 0
    for p in elle:
        sen = yukle(p)
        en_buyuk, ihlal = None, []
        for a in sen["adimlar"]:
            if a["islem"] == "iade" or (a["islem"] == "fatura" and a.get("tur", "satis") != "alis"):
                t = a.get("tarih") or sen["bugun"]
                seri_say += 1
                if en_buyuk is not None and t < en_buyuk:
                    ihlal.append("%s %s < %s" % (a["id"], t, en_buyuk))
                en_buyuk = t if en_buyuk is None or t > en_buyuk else en_buyuk
        denetle("%s G1 seriden numara alan belgeler tarih sırasıyla" % os.path.basename(p), not ihlal, "; ".join(ihlal))
    print("  G1 (bakım 7): %d elle senaryo, %d seriden numara alan belge adımı tarih sırasıyla denetlendi" % (len(elle), seri_say))
    # 9. bakım 7 (§19 Y7-3): elle Mevcut Borç kartının reddi yalnız 2.5.0'da; 2.4.9'da aynı senaryo kartı kabul eder (≤ 2.4.9 AYNEN)
    for p in v3:
        sen = yukle(p)
        ret250 = [k for k, v in tabanlar.get(p, {}).items() if k.startswith("adim:") and k.endswith(":durum") and v["b"] == "ret" and v["e"] == "BAŞ MİMAR" and "C19 Y7-3" in v["k"]]
        if ret250:
            _m249, out249 = calistir(sen, 0, "2.4.9")
            denetle("%s Y7-3 reddi yalnız 2.5.0'da (2.4.9 kabul)" % os.path.basename(p), all(out249.get(k, {}).get("b") == "ok" for k in ret250), ",".join(ret250))
    toplam = gecen + kalan
    if satirlar:
        print("BAŞARISIZ:")
        print("\n".join(satirlar[:80]))
    print("# tests %d" % toplam)
    print("# pass %d" % gecen)
    print("# fail %d" % kalan)
    print("%d/%d denetim geçti" % (gecen, toplam))
    return 0 if kalan == 0 else 1


if __name__ == "__main__":
    sys.exit(main())
