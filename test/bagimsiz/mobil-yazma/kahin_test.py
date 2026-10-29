#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""M5 mobil yazma kâhininin kendi testi ve MUTASYON testi. Çıktı TAP + `# tests/pass/fail/...`; çıkış 0 yalnız hepsi geçtiyse.

  KANIT_DIR=test/bagimsiz/mobil-yazma/kanit node tools/kanit.mjs kos kahin-mobil-yazma -- python3 -I test/bagimsiz/mobil-yazma/kahin_test.py

Bölümler:
  A  kabul.json güncel (yeniden üretilen = dosya, bayt bayt) ve cari kâhini dosyası kabul üretildiğindeki ile aynı
  B  ELLE senaryolar: elle yazılmış beklenen = model (256 birleşimin hepsinde)
  C  RASTGELE senaryolar: üreticinin BAĞIMSIZ akış beklentisi (Akis) = model (10 birleşim) + büyük hacim (tohum 4, 5.000 olay; dosyaya yazılmaz)
  D  değişmez kurallar: belirlenimcilik, eşdeğerlik (masaüstü = mobil), reddedilen adım hiçbir şeyi değiştirmez, şirket yalıtımı, istek kimliği başına
     en çok bir kayıt, aynı tarihli sıra (ders 31), Kasa = Σ gün, kayıt sayısı azalmaz, göreli çiftler
  E  girdi doğrulaması (dil dışı senaryo sessizce koşmaz)
  F  MUTASYON: modele bilerek hata; modelden BAĞIMSIZ beklentiler (elle + akış) yakalamalı — yakalanmayan = eksik senaryo
  G  komut satırı (hesapla, karsilastir)
  H  mevcut cari kâhini değişmedi (yalnız içe aktarıldı)
"""
import copy
import importlib.util
import json
import os
import subprocess
import sys
import tempfile
import traceback

sys.dont_write_bytecode = True
_BURASI = os.path.dirname(os.path.abspath(__file__))


def _yukle(ad):
    spec = importlib.util.spec_from_file_location("mobil_test_" + ad, os.path.join(_BURASI, ad + ".py"))
    m = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(m)
    return m


kahin = _yukle("kahin")
S = _yukle("senaryolar")
SONUCLAR = []


def test(ad):
    def sar(f):
        SONUCLAR.append((ad, f))
        return f
    return sar


def kos():
    gecen = kalan = 0
    for i, (ad, f) in enumerate(SONUCLAR, 1):
        try:
            satirlar = f() or []
        except Exception:  # testin kendisi düşerse başarısız (yarıda kalan test geçmiş sayılmaz)
            satirlar = ["istisna: " + x for x in traceback.format_exc().strip().splitlines()[-6:]]
        bilgi = [s for s in satirlar if s.startswith("bilgi:")]
        hatalar = [s for s in satirlar if not s.startswith("bilgi:")]
        if hatalar:
            kalan += 1
            print("not ok %d - %s" % (i, ad))
            for s in hatalar[:15]:
                print("  # " + s[:600])
            if len(hatalar) > 15:
                print("  # … %d satır daha" % (len(hatalar) - 15))
        else:
            gecen += 1
            print("ok %d - %s" % (i, ad))
        for s in bilgi:
            print("  # " + s)
        sys.stdout.flush()
    print("1..%d" % (gecen + kalan))
    for ad, n in (("tests", gecen + kalan), ("pass", gecen), ("fail", kalan), ("cancelled", 0), ("skipped", 0), ("todo", 0)):
        print("# %s %d" % (ad, n))
    return 0 if kalan == 0 and gecen > 0 else 1


# ───────────────────────────────────────── ortak (bir kez hesaplanır)
_ON = {}


def uretilen():
    if "kabul" not in _ON:
        _ON["kabul"], _ON["hatalar"] = S.kabul_uret(yaz=False, gunluk=lambda *_: None)
    return _ON["kabul"], _ON["hatalar"]


def dosya_kabul():
    if "dosya" not in _ON:
        with open(S.KABUL_YOL, encoding="utf-8") as f:
            _ON["dosya_metin"] = f.read()
        _ON["dosya"] = json.loads(_ON["dosya_metin"])
    return _ON["dosya"]


def kos_model(senaryo, p=None, mut=0):
    return kahin.Kahin(senaryo, p or dict(kahin.ONERI), mut).kos()


def rastgele_senaryolari():
    return [s["senaryo"] for s in dosya_kabul()["senaryolar"] if s["tur"] == "rastgele"]


def kontrol_anahtarlari(cikti):
    return {k: v for k, v in cikti.items() if not k.startswith("adim:")}


# ═════════════════════════════════════════ A
@test("A1 kabul.json güncel: yeniden üretilen kabul kümesi dosyayla bayt bayt aynı (model ≠ elle / akış olsaydı üretilmezdi)")
def _a1():
    kabul, hatalar = uretilen()
    dosya_kabul()
    out = list(hatalar)
    if not hatalar and S.kabul_metni(kabul) != _ON["dosya_metin"]:
        out.append("kabul.json eski: python3 -I test/bagimsiz/mobil-yazma/senaryolar.py ile yeniden üretin ve farkı inceleyin")
    k = dosya_kabul()
    out.append("bilgi: %d senaryo (%d elle, %d rastgele), %d olay; %d göreli çift; %d parametre (%d birleşim)" % (
        len(k["senaryolar"]), sum(1 for s in k["senaryolar"] if s["tur"] == "uc"), sum(1 for s in k["senaryolar"] if s["tur"] == "rastgele"),
        sum(s["olay_sayisi"] for s in k["senaryolar"]), len(k["goreli_ciftler"]), len(k["parametreler"]), 2 ** len(k["parametreler"])))
    return out


@test("A2 cari kâhini (test/bagimsiz/cari/model.py) kabul üretildiğindeki dosyayla aynı (sha256)")
def _a2():
    return [] if S._sha256(kahin._CARI_YOL) == dosya_kabul()["cari_model_sha256"] else ["cari kâhini değişti: kabul.json yeniden üretilip elle beklentiler yeniden denetlenmeli"]


# ═════════════════════════════════════════ B
def _b(kayit):
    def f():
        farklar, sonuclar = S.elle_denetle(kayit)
        if farklar:
            return ["%d birleşimde model ≠ elle" % len(farklar)] + farklar[:5]
        ilgili = S.ilgili_parametreler(sonuclar)
        return ["bilgi: 256/256 birleşim; ilgili parametreler: %s" % (", ".join(ilgili) or "yok")]
    return f


for _k in S.ELLE:
    test("B %s: elle beklenen = model" % _k["ad"])(_b(_k))


# ═════════════════════════════════════════ C
def _c(t):
    def f():
        sen = next(s for s in rastgele_senaryolari() if s["ad"].startswith("R%d-" % t))
        out = []
        say = {}
        for p in S.rastgele_birlesimleri():
            m = S.model_kos(sen, p)
            fark = S.esit(m, S.akis_beklenen(sen, p))
            if fark:
                out.append("[%s] %d fark: %s" % (kahin.birlesim_adi(p), len(fark), " | ".join(fark[:4])))
            if p == kahin.ONERI:
                for k, v in m["beklenen"].items():
                    if k.endswith(":durum"):
                        say[v] = say.get(v, 0) + 1
                kismi = sum(1 for k, v in m["beklenen"].items() if ":fatura:" in k and v > 0)
                out.append("bilgi: %d adım; öneri birleşiminde durumlar %s; açık (> 0) fatura denetimi %d" % (len(sen["adimlar"]), json.dumps(say, sort_keys=True), kismi))
        return out
    return f


for _t in S.RASTGELE_TOHUM:
    test("C rastgele tohum %d: akış beklentisi = model (10 birleşim)" % _t)(_c(_t))


@test("C4 büyük hacim: tohum 4, 5.000 olay (dosyaya yazılmaz) — akış beklentisi = model (öneri + hepsi ters)")
def _c4():
    sen = S.rastgele(4, 5000)
    out = []
    for p in (S.rastgele_birlesimleri()[0], S.rastgele_birlesimleri()[-1]):
        f = S.esit(S.model_kos(sen, p), S.akis_beklenen(sen, p))
        if f:
            out.append("[%s] %d fark: %s" % (kahin.birlesim_adi(p), len(f), " | ".join(f[:4])))
    out.append("bilgi: %d adım" % len(sen["adimlar"]))
    return out


# ═════════════════════════════════════════ D
@test("D1 belirlenimcilik: aynı senaryo iki kez → bayt bayt aynı çıktı (bütün elle senaryolar + R1)")
def _d1():
    out = []
    for s in [k["senaryo"] for k in S.ELLE] + rastgele_senaryolari()[:1]:
        a = json.dumps(kos_model(s), sort_keys=True, ensure_ascii=False)
        b = json.dumps(kahin.Kahin(copy.deepcopy(s), dict(kahin.ONERI)).kos(), sort_keys=True, ensure_ascii=False)
        if a != b:
            out.append(s["ad"])
    return out


@test("D2 eşdeğerlik: aynı iş masaüstünden ve mobilden → aynı sonuç (masaüstü her birleşimde = mobil ESDEGER birleşiminde)")
def _d2():
    out = []
    ciftler = [k for k in S.ELLE if k["kanal"] == "mobil"]
    for k in ciftler:
        masa = next(x for x in S.ELLE if x["ad"] == k["cift"])
        mobil = S.model_kos(k["senaryo"], S.ESDEGER)
        for p in kahin.birlesimler():
            m2 = S.model_kos(masa["senaryo"], p)
            if m2 != mobil:
                out.append("%s ≠ %s [%s]" % (masa["ad"], k["ad"], kahin.birlesim_adi(p)))
                break
    out.append("bilgi: %d çift × 256 birleşim" % len(ciftler))
    return out


def _sonuc_durumu(cikti, i):
    return cikti.get("adim:%s:durum" % i), cikti.get("adim:%s:sunucu" % i)


def _silinebilir(senaryo, cikti):
    """Yazmamış adımlar (ret, ulaşılamadı, atıldı, belirsiz-ulaşmadı/ret): yeniden_gonder anmıyorsa ve eşzamanlı grupta değilse."""
    anilan = {a["adim"] for a in senaryo["adimlar"] if a["islem"] == "yeniden_gonder"}
    out = []
    for a in senaryo["adimlar"]:
        if a["islem"] not in ("tahsilat", "odeme", "stok", "yeniden_gonder") or a.get("ayniAnda") or a["id"] in anilan:
            continue
        d, sv = _sonuc_durumu(cikti, a["id"])
        if d in ("ret", "ulasilamadi", "atildi") or (d == "belirsiz" and sv in ("yok", "ret")):
            out.append(a["id"])
    return out


@test("D3 reddedilen / ulaşılamayan / atılan istek hiçbir şeyi değiştirmez: o adımlar silinince bütün kontrol sayıları aynı (ders 3)")
def _d3():
    out = []
    say = 0
    hedefler = [(k["senaryo"], p) for k in S.ELLE if not k["alternatifler"] for p in (S.ILK, kahin.ONERI)] + \
               [(s, kahin.ONERI) for s in rastgele_senaryolari()[:1]]
    for sen, p in hedefler:
        m = S.model_kos(sen, p)
        if m["alternatifler"]:
            continue
        sil = set(_silinebilir(sen, m["beklenen"]))
        if not sil:
            continue
        say += len(sil)
        s2 = dict(sen, adimlar=[a for a in sen["adimlar"] if a["id"] not in sil])
        m2 = S.model_kos(s2, p)
        if kontrol_anahtarlari(m["beklenen"]) != kontrol_anahtarlari(m2["beklenen"]):
            fark = [k for k in kontrol_anahtarlari(m["beklenen"]) if m["beklenen"].get(k) != m2["beklenen"].get(k)]
            out.append("%s [%s]: %s" % (sen["ad"], kahin.birlesim_adi(p), fark[:5]))
    out.append("bilgi: %d yazmamış adım silinerek denendi" % say)
    return out


def _sirket_sil(sen, kod):
    """Bir şirketin bütün adımlarını (ve onları anan yeniden gönderimleri) çıkarır."""
    sil = {a["id"] for a in sen["adimlar"] if a.get("sirket") == kod or (a["islem"] == "sirket_ac" and a.get("sirket") == kod)}
    sil |= {a["id"] for a in sen["adimlar"] if a["islem"] == "yeniden_gonder" and a["adim"] in sil}
    b = copy.deepcopy(sen["baslangic"])
    b["sirketler"] = {k: v for k, v in b["sirketler"].items() if k != kod}
    return dict(sen, baslangic=b, adimlar=[a for a in sen["adimlar"] if a["id"] not in sil])


@test("D4 şirket yalıtımı: 002'nin bütün adımları çıkarılınca 001'in bütün kontrol sayıları aynı (elle iki şirketli + R1–R3)")
def _d4():
    out = []
    n = 0
    for sen in [k["senaryo"] for k in S.ELLE if "002" in k["senaryo"]["baslangic"]["sirketler"]] + rastgele_senaryolari():
        for p in (kahin.ONERI, S.ESDEGER):
            m = S.model_kos(sen, p)["beklenen"]
            m2 = S.model_kos(_sirket_sil(sen, "002"), p)["beklenen"]
            a = {k: v for k, v in m.items() if ":001:" in k and not k.startswith("adim:")}
            b = {k: v for k, v in m2.items() if ":001:" in k and not k.startswith("adim:")}
            if a != b:
                out.append("%s [%s]: %s" % (sen["ad"], kahin.birlesim_adi(p), [k for k in a if a.get(k) != b.get(k)][:5]))
            n += 1
    out.append("bilgi: %d koşu" % n)
    return out


@test("D5 istek kimliği başına en çok bir kayıt (kullanıcı × şirket × kapsam × kimlik) — elle + R1–R3, iki birleşim")
def _d5():
    out = []
    for sen in [k["senaryo"] for k in S.ELLE if k["ad"] != "E24-kimlik-omru"] + rastgele_senaryolari():
        adim = {a["id"]: a for a in sen["adimlar"]}
        for p in (kahin.ONERI, S.ESDEGER):
            for w in kahin.Kahin(sen, p).kos_dunyalar():
                say = {}
                for kod, Sx in w["sirketler"].items():
                    for rid, kayit in Sx["kayitlar"].items():
                        a = adim[rid]
                        orj = adim[a["adim"]] if a["islem"] == "yeniden_gonder" else a
                        anahtar = (kod, kayit["kullanici"], orj["islem"] + (":kart" if orj.get("kart") else ""), orj["istekKimligi"])
                        say[anahtar] = say.get(anahtar, 0) + 1
                cok = [k for k, v in say.items() if v > 1]
                if cok:
                    out.append("%s [%s]: %s" % (sen["ad"], kahin.birlesim_adi(p), cok[:3]))
    return out


@test("D6 aynı tarihli kayıtların sırası (ders 31): E32a ve E32b aynı; R1'de ardışık değişmeli adım çiftleri yer değiştirince kontrol sayıları aynı")
def _d6():
    out = []
    a = S.model_kos(next(k for k in S.ELLE if k["ad"] == "E32a-ayni-gun-sira")["senaryo"], kahin.ONERI)["beklenen"]
    b = S.model_kos(next(k for k in S.ELLE if k["ad"] == "E32b-ayni-gun-sira")["senaryo"], kahin.ONERI)["beklenen"]
    if kontrol_anahtarlari(a) != kontrol_anahtarlari(b):
        out.append("E32a ≠ E32b")
    sen = copy.deepcopy(rastgele_senaryolari()[0])
    anilan = {x["adim"] for x in sen["adimlar"] if x["islem"] == "yeniden_gonder"}
    adimlar = sen["adimlar"]
    # her adımın günü (önceki saat adımından); aralarında yalnız 'saat' adımı olan, AYNI GÜNDEKİ iki değişmeli tahsilat yer değiştirir
    gunler, z = [], kahin.zaman(sen["baslangic"]["simdi"])
    for x in adimlar:
        if x["islem"] == "saat":
            z = kahin.zaman(x["simdi"])
        gunler.append(kahin.gun(z))

    def uygun(z):
        return (z["islem"] == "tahsilat" and z.get("yol") == "nakit" and not z.get("fatura") and not z.get("kart") and not z.get("kesinti")
                and not z.get("ayniAnda") and not z.get("tarih") and not z.get("formAcilis") and z["id"] not in anilan)
    takas = 0
    i = 0
    while i < len(adimlar):
        x = adimlar[i]
        j = i + 1
        while j < len(adimlar) and adimlar[j]["islem"] == "saat":
            j += 1
        if j < len(adimlar) and uygun(x) and uygun(adimlar[j]) and gunler[i] == gunler[j] and x["cari"] != adimlar[j]["cari"] \
                and x.get("sirket") == adimlar[j].get("sirket"):
            adimlar[i], adimlar[j] = adimlar[j], x
            takas += 1
            i = j + 1
            continue
        i += 1
    m1 = S.model_kos(rastgele_senaryolari()[0], kahin.ONERI)["beklenen"]
    m2 = S.model_kos(sen, kahin.ONERI)["beklenen"]
    if takas == 0:
        out.append("R1'de takas edilecek çift yok (test dişsiz)")
    if kontrol_anahtarlari(m1) != kontrol_anahtarlari(m2):
        out.append("R1 takaslı ≠ R1: %s" % [k for k in kontrol_anahtarlari(m1) if m1.get(k) != m2.get(k)][:5])
    out.append("bilgi: R1'de %d çift yer değiştirdi" % takas)
    return out


@test("D7 Kasa = Σ Kasa gün toplamları; kayıt (hareket) sayısı yedekten geri yükleme olmadan hiç azalmaz")
def _d7():
    out = []
    for sen in [k["senaryo"] for k in S.ELLE] + rastgele_senaryolari():
        geri = any(a["islem"] == "yedek_geri_yukle" for a in sen["adimlar"])
        m = S.model_kos(sen, kahin.ONERI)
        for alt in (m["alternatifler"] or [{}]):
            c = dict(m["beklenen"], **{k: v for k, v in alt.items() if v != "__yok__"})
            kontroller = [a["id"] for a in sen["adimlar"] if a["islem"] == "kontrol"]
            onceki = {}
            for k in kontroller:
                for kod in sen["baslangic"]["sirketler"]:
                    p = "%s:%s:" % (k, kod)
                    if p + "kasa" not in c:
                        continue
                    gunler = sum(v for kk, v in c.items() if kk.startswith(p + "kasaGun:"))
                    if gunler != c[p + "kasa"]:
                        out.append("%s %s: Kasa %s ≠ Σ gün %s" % (sen["ad"], p, c[p + "kasa"], gunler))
                    for kk, v in c.items():
                        if kk.startswith(p) and (kk.endswith(":hareketSayisi") or kk.endswith(":tahsilatSayisi")):
                            ad = kk[len(p):]
                            if not geri and ad in onceki and v < onceki[ad]:
                                out.append("%s %s: %s azaldı %s → %s" % (sen["ad"], k, ad, onceki[ad], v))
                            onceki[ad] = v
    return out


@test("D8 göreli çiftler (plan yetkiyi yazmıyor — B): iki yan yalnız kanalda ayrışır ve kâhin hesaplamaz (program iki kanalda AYNI vermeli)")
def _d8():
    out = []
    for g in S.GORELI:
        out.extend(S.goreli_denetle(g))
    out.append("bilgi: %d göreli çift: %s" % (len(S.GORELI), ", ".join(g["ad"] for g in S.GORELI)))
    return out


# ═════════════════════════════════════════ E
def _temel():
    return {"dil": kahin.DIL, "ad": "e", "baslangic": S.bas(), "adimlar": [S.cari("c1", "A"), S.tah("t1", "A", "100", S.ch("mobil")), S.kon("k1")]}


def _boz(f):
    s = _temel()
    f(s)
    return s


GECERSIZ = [
    ("dil yanlış", lambda s: s.update(dil="destekofis-cari/3")),
    ("bilinmeyen islem", lambda s: s["adimlar"].append({"id": "x1", "islem": "tahsilat_sil"})),
    ("tekrar eden adım id", lambda s: s["adimlar"].append(S.kon("k1"))),
    ("mobil adımda kullanici", lambda s: s["adimlar"][1].update(kullanici="Y")),
    ("mobil adımda cihaz yok", lambda s: s["adimlar"][1].pop("cihaz")),
    ("istekKimligi yok", lambda s: s["adimlar"][1].pop("istekKimligi")),
    ("kesinti geçersiz", lambda s: s["adimlar"][1].update(kesinti="yarim")),
    ("yeniden_gonder ileri/olmayan adımı anar", lambda s: s["adimlar"].insert(1, S.yen("y0", "t1"))),
    ("ayniAnda tek adım", lambda s: s["adimlar"][1].update(ayniAnda="g")),
    ("B hücresi: muhasebe nakit ödeme", lambda s: (s["baslangic"]["kullanicilar"].update(M={"rol": "muhasebe", "uzak": True}),
                                                   s["baslangic"]["cihazlar"].update(DM="M"),
                                                   s["adimlar"].insert(2, S.ode("o1", "A", "10", S.ch("mobil", "DM")))) and None),
    ("4. eşli cihaz (M2 konusu)", lambda s: s["baslangic"]["cihazlar"].update(D2="Y", D3="Y", D4="Y")),
    ("saat geri", lambda s: s["adimlar"].insert(1, S.saat("s1", "2026-10-19T10:00:00+03:00"))),
    ("formAcilis gönderimden sonra", lambda s: s["adimlar"][1].update(formAcilis="2026-10-20T11:00:00+03:00")),
    ("sunucu kapalıyken masaüstü işlemi", lambda s: s.update(adimlar=[s["adimlar"][0], S.ort("s1", "sunucu", durum="kapali"),
                                                                     S.tah("t1", "A", "100", S.ch("masaustu"))])),
    ("eski sürüm (kaynakSurum) adımı mobil", lambda s: s["baslangic"].update(kaynakSurum="2.4.6")),
    ("şirket kodu 003", lambda s: s["baslangic"]["sirketler"].update({"003": {}})),
    ("takma ad biçimi", lambda s: s["adimlar"][0].update(ad="a-1")),
    ("cari_sil hareketli cari", lambda s: s["adimlar"].insert(2, {"id": "cs", "islem": "cari_sil", "cari": "A"})),
]


def _e(ad, f):
    def g():
        try:
            kahin.Kahin(_boz(f), dict(kahin.ONERI)).kos()
        except kahin.SenaryoHatasi as e:
            return ["bilgi: reddedildi — %s" % e]
        return ["kabul edildi (sessizce koştu)"]
    return g


for _ad, _f in GECERSIZ:
    test("E %s → SenaryoHatasi" % _ad)(_e(_ad, _f))


@test("E geçerli temel senaryo kabul edilir")
def _e_gecerli():
    m = kahin.Kahin(_temel(), dict(kahin.ONERI)).kos()
    return [] if m["beklenen"].get("adim:t1:durum") == "ok" else ["temel senaryo koşmadı: %s" % m]


# ═════════════════════════════════════════ F
def _birlesim_sirasi():
    tek = []
    for k, v in S.P.items():
        for x in v:
            tek.append(dict(kahin.ONERI, **{k: x}))
            tek.append(dict(S.ILK, **{k: x}))
    oncelik = [S.ILK, dict(kahin.ONERI), S.ESDEGER] + tek
    gorulen = {kahin.birlesim_adi(p) for p in oncelik}
    return oncelik + [p for p in kahin.birlesimler() if kahin.birlesim_adi(p) not in gorulen]


SIRA = _birlesim_sirasi()
MUT_SONUC = {}


def _yakala(n):
    """Mutant n: elle beklentilerle (bağımsız) — önce önemli birleşimler, sonra hepsi; ilk yakalayan."""
    for tur in ("hizli", "tam"):
        lst = SIRA[: len(SIRA) if tur == "tam" else 35]
        for k in S.ELLE:
            for p in lst:
                try:
                    m = S.model_kos(k["senaryo"], p, n)
                    fark = S.esit(m, S.elle_beklenen(k, p))
                except kahin.SenaryoHatasi as e:
                    fark = ["mutant senaryoyu çökertti: %s" % e]
                if fark:
                    return "%s [%s]" % (k["ad"], kahin.birlesim_adi(p))
    # elle yakalamadıysa rastgele (akış beklentisi)
    for sen in rastgele_senaryolari():
        for p in S.rastgele_birlesimleri():
            if S.esit(S.model_kos(sen, p, n), S.akis_beklenen(sen, p)):
                return "%s [%s] (akış)" % (sen["ad"], kahin.birlesim_adi(p))
    return None


def _f(n, ad):
    def g():
        y = _yakala(n)
        MUT_SONUC[n] = y
        return ["bilgi: %s; yakalayan: %s" % (ad, y)] if y else ["YAKALANMADI: %s (eksik senaryo)" % ad]
    return g


for _n, _ad in kahin.MUTASYONLAR.items():
    test("F M%02d" % _n)(_f(_n, _ad))


@test("F özet: her mutasyon modelden BAĞIMSIZ beklentilerce (elle + akış) yakalandı (en az 30)")
def _f_ozet():
    yak = [n for n in kahin.MUTASYONLAR if MUT_SONUC.get(n)]
    out = ["bilgi: %d/%d mutasyon yakalandı" % (len(yak), len(kahin.MUTASYONLAR))]
    if len(yak) != len(kahin.MUTASYONLAR) or len(yak) < 30:
        out.append("yakalanmayan: %s" % [n for n in kahin.MUTASYONLAR if not MUT_SONUC.get(n)])
    return out


# ═════════════════════════════════════════ G
def _cli(*args):
    return subprocess.run([sys.executable, "-I", os.path.join(_BURASI, "kahin.py")] + list(args), capture_output=True, text=True, timeout=600)


@test("G1 'hesapla' komutu modelle aynı çıktıyı verir (E21, --param tarih=form_tarihi)")
def _g1():
    k = next(x for x in S.ELLE if x["ad"] == "E21-gece-yarisi")
    with tempfile.TemporaryDirectory() as d:
        yol = os.path.join(d, "s.json")
        with open(yol, "w", encoding="utf-8") as f:
            json.dump(k["senaryo"], f, ensure_ascii=False)
        r = _cli("hesapla", yol, "--param", "tarih=form_tarihi")
    if r.returncode != 0:
        return ["çıkış %d: %s" % (r.returncode, r.stderr[-400:])]
    beklenen = kahin.Kahin(k["senaryo"], dict(kahin.ONERI, tarih="form_tarihi")).kos()
    return [] if json.loads(r.stdout) == beklenen else ["CLI çıktısı modelden farklı"]


@test("G2 'karsilastir': kabul.json'un kendisiyle çıkış 0; bir sayı bozulunca, alternatif dışı değerde ve eksik senaryoda çıkış 1 (ders 4)")
def _g2():
    kabul = dosya_kabul()
    p = dict(kahin.ONERI, kapatilacak="secilir", tarih="form_tarihi")
    program = {}
    for s in kabul["senaryolar"]:
        g = kahin.beklenen_bul(s, p) if s["tur"] == "uc" else kahin.beklenen_bul(s, kahin.ONERI)
        c = dict(g["beklenen"])
        if g["alternatifler"]:
            c.update({k: v for k, v in g["alternatifler"][0].items() if v != "__yok__"})
        c = {k: (404 if v == [403, 404] or v == [400, 404] else 409 if v == "4xx" else v) for k, v in c.items()}
        program[s["ad"]] = c
    out = []
    with tempfile.TemporaryDirectory() as d:
        yk, yp = os.path.join(d, "kabul.json"), os.path.join(d, "program.json")
        kk = dict(kabul, senaryolar=[s for s in kabul["senaryolar"] if s["tur"] == "uc"])
        with open(yk, "w", encoding="utf-8") as f:
            json.dump(kk, f, ensure_ascii=False)

        def calis(prog, birlesim):
            with open(yp, "w", encoding="utf-8") as f:
                json.dump(prog, f, ensure_ascii=False)
            return _cli("karsilastir", yk, yp, "--birlesim", birlesim)

        b = kahin.birlesim_adi(p)
        r = calis(program, b)
        if r.returncode != 0 or "# fail 0" not in r.stdout:
            out.append("aynı çıktıda çıkış %d: %s" % (r.returncode, r.stdout[-600:]))
        bozuk = json.loads(json.dumps(program))
        bozuk["E01-es-nakit-fifo-mobil"]["k1:001:fatura:F2:acik"] += 1
        r = calis(bozuk, b)
        if r.returncode != 1 or "# fail 1" not in r.stdout:
            out.append("bozuk sayıda çıkış %d (beklenen 1, tek fark)" % r.returncode)
        alt = json.loads(json.dumps(program))
        alt["E18-k8-yaris"]["adim:t1:durum"] = "ok"
        alt["E18-k8-yaris"]["adim:t2:durum"] = "ok"
        r = calis(alt, b)
        if r.returncode != 1:
            out.append("iki adım birden 'ok' (hiçbir alternatif değil) kabul edildi")
        eksik = dict(program)
        eksik.pop("E01-es-nakit-fifo-mobil")
        r = calis(eksik, b)
        if r.returncode != 1:
            out.append("eksik senaryo boş sayıldı (ders 4)")
    return out


@test("G3 rastgele kayıtta öneri dışı birleşim farktan yeniden kurulur ve akış beklentisine eşittir (R2, 'hepsi ters')")
def _g3():
    kayit = next(s for s in dosya_kabul()["senaryolar"] if s["ad"].startswith("R2-"))
    p = S.rastgele_birlesimleri()[-1]
    g = kahin.beklenen_bul(kayit, p)
    f = S.esit({"beklenen": g["beklenen"], "alternatifler": []}, S.akis_beklenen(kayit["senaryo"], p))
    return f[:5]


# ═════════════════════════════════════════ H
@test("H mevcut cari kâhini bu işte DEĞİŞMEDİ (git: test/bagimsiz/cari/ çalışma ağacı = HEAD) ve kendi elle senaryoları koşar")
def _h():
    kok = os.path.normpath(os.path.join(_BURASI, "..", "..", ".."))
    out = []
    try:
        r = subprocess.run(["git", "-C", kok, "status", "--porcelain", "--", "test/bagimsiz/cari"], capture_output=True, text=True, timeout=60)
        if r.returncode != 0:
            out.append("bilgi: git okunamadı (%s) — sha256 denetimi A2'de" % r.stderr.strip()[:200])
        elif r.stdout.strip():
            out.append("test/bagimsiz/cari değişmiş: %s" % r.stdout.strip()[:400])
    except (OSError, subprocess.TimeoutExpired) as e:
        out.append("bilgi: git yok (%s) — sha256 denetimi A2'de" % e)
    klasor = os.path.join(kok, "test", "bagimsiz", "cari", "senaryolar")
    n = 0
    for ad in sorted(os.listdir(klasor)):
        if ad.endswith(".json"):
            with open(os.path.join(klasor, ad), encoding="utf-8") as f:
                s = json.load(f)
            kural = "2.4.4" if kahin.CARI.gecersiz_245(s) else kahin.CARI.VARSAYILAN_KURAL
            kahin.CARI.Model(s, 0, kural).kos()
            n += 1
    out.append("bilgi: cari kâhininin %d elle senaryosu içe aktarılan modelle koştu" % n)
    return out


@test("H2 mevcut cari kâhini model tek başına: kendi mutasyon taraması (model.py --mutasyon-tara, elle senaryoları) — yakalanmayan mutant 0")
def _h2():
    kok = os.path.normpath(os.path.join(_BURASI, "..", "..", ".."))
    klasor = os.path.join(kok, "test", "bagimsiz", "cari", "senaryolar")
    cm = kahin.CARI
    liste = []
    for ad in sorted(os.listdir(klasor)):
        if ad.endswith(".json"):
            yol = os.path.join(klasor, ad)
            with open(yol, encoding="utf-8") as f:
                s = json.load(f)
            # KARARLAR.md C0/C10: 2.4.5 kararıyla geçersizler 2.4.4 kipinde, öbür /1 /2 iki kipte, /3 varsayılan kipte
            kipler = ["2.4.4"] if cm.gecersiz_245(s) else ([cm.VARSAYILAN_KURAL, "2.4.4"] if s["dil"] != cm.DIL else [cm.VARSAYILAN_KURAL])
            liste.append({"dosya": yol, "kipler": kipler})
    with tempfile.TemporaryDirectory() as d:
        yl = os.path.join(d, "liste.json")
        with open(yl, "w", encoding="utf-8") as f:
            json.dump(liste, f)
        r = subprocess.run([sys.executable, "-I", kahin._CARI_YOL, "-", "--mutasyon-tara", yl], capture_output=True, text=True, timeout=3000)
    if r.returncode != 0:
        return ["mutasyon taraması çalışmadı (çıkış %d): %s" % (r.returncode, r.stderr[-400:])]
    sonuc = json.loads(r.stdout)
    yok = sorted((n for n, v in sonuc.items() if not v["yakalayan"]), key=int)
    out = ["bilgi: cari kâhini %d/%d mutant elle senaryolarıyla yakalandı (%d senaryo)" % (len(sonuc) - len(yok), len(sonuc), len(liste))]
    if yok:
        out.append("YAKALANMAYAN cari mutantları: %s" % yok)
    return out


if __name__ == "__main__":
    sys.exit(kos())
