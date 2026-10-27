#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""EDM gönderim sayacı kâhininin kendi testi ve MUTASYON testi. Çıktı TAP + `# tests/pass/fail/...` özet satırları; çıkış 0 yalnız hepsi
geçtiyse. Koşu: node tools/kanit.mjs kos kahin-sayac -- python3 -I test/bagimsiz/edm-sayac/kahin_test.py

Bölümler:
  A  kabul.json güncel mi (yeniden üretilen = dosya)
  B  UÇ senaryolar: ELLE yazılmış beklenen = model (32 birleşim)
  C  RASTGELE senaryolar: üreticinin akıştan bildiği beklenen = model (32 birleşim) + büyük hacim (5.000 belge, dosyaya yazılmaz)
  D  değişmez kurallar (sıra, monotonluk, ortam ayrımı, şirket toplamı, gürültü, usage tutarlılığı …)
  E  girdi doğrulaması (hatalı girdi sessizce atlanmaz)
  F  MUTASYON: modele bilerek hata; uygulanabildiği HER birleşimde kabul.json ile ayrışmalı (yakalanmayan mutasyon = eksik senaryo).
     Ek bilgi: aynı mutasyonu modelden BAĞIMSIZ beklentiler (elle + üretici) de yakalıyor mu.
  G  komut satırı (hesapla, karsilastir)
"""
import importlib.util
import json
import os
import random
import subprocess
import sys
import tempfile
import traceback
from datetime import timedelta, timezone

sys.dont_write_bytecode = True
_BURASI = os.path.dirname(os.path.abspath(__file__))


def _yukle(ad):
    spec = importlib.util.spec_from_file_location(ad, os.path.join(_BURASI, f"{ad}.py"))
    modul = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(modul)
    return modul


kahin = _yukle("kahin")
senaryolar = _yukle("senaryolar")
Kahin = kahin.Kahin
BIRLESIMLER = list(kahin.birlesimler())

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
        except Exception:  # testin kendisi düşerse: başarısız (yarıda kalan test geçmiş sayılmaz)
            satirlar = ["istisna: " + line for line in traceback.format_exc().strip().splitlines()[-6:]]
        bilgi = [s for s in satirlar if s.startswith("bilgi:")]
        hatalar = [s for s in satirlar if not s.startswith("bilgi:")]
        if hatalar:
            kalan += 1
            print(f"not ok {i} - {ad}")
            for s in hatalar[:15]:
                print(f"  # {s}")
            if len(hatalar) > 15:
                print(f"  # … {len(hatalar) - 15} satır daha")
        else:
            gecen += 1
            print(f"ok {i} - {ad}")
        for s in bilgi:
            print(f"  # {s}")
        sys.stdout.flush()
    print(f"1..{gecen + kalan}")
    for ad, n in (("tests", gecen + kalan), ("pass", gecen), ("fail", kalan), ("cancelled", 0), ("skipped", 0), ("todo", 0)):
        print(f"# {ad} {n}")
    return 0 if kalan == 0 and gecen > 0 else 1


# ---- ortak veri --------------------------------------------------------------------------------------------------------
with open(senaryolar.KABUL_YOLU, encoding="utf-8") as f:
    KABUL = json.load(f)
TUM = senaryolar.tum_senaryolar()          # elle / üretici beklentileri taşıyan canlı nesneler
assert [s["ad"] for s in TUM] == [s["ad"] for s in KABUL["senaryolar"]], "kabul.json senaryo listesi güncel değil"
UC = [s for s in TUM if s["tur"] == "uc"]
RAST = [s for s in TUM if s["tur"] == "rastgele"]


def beklenen(i, p):
    return kahin.beklenen_bul(KABUL["senaryolar"][i], p)


# ---- A ---------------------------------------------------------------------------------------------------------------
@test("A1 kabul.json yeniden üretilen kümeyle aynı ve üretimde model ↔ elle/üretici beklentisi farkı yok")
def _a1():
    yeni, hatalar = senaryolar.kabul_uret()
    out = list(hatalar[:10])
    if json.loads(json.dumps(yeni, ensure_ascii=False)) != KABUL:
        out.append("kabul.json eski: python3 -I test/bagimsiz/edm-sayac/senaryolar.py ile yeniden üretin")
    n_olay = sum(len(s["olaylar"]) for s in KABUL["senaryolar"])
    out.append(f"bilgi: {len(KABUL['senaryolar'])} senaryo ({len(UC)} uç + {len(RAST)} rastgele), {n_olay} olay, {len(BIRLESIMLER)} birleşim")
    return out


@test("A2 her birleşim her senaryoda tam bir beklenen grubunda")
def _a2():
    out = []
    adlar = {kahin.birlesim_adi(p) for p in BIRLESIMLER}
    for s in KABUL["senaryolar"]:
        gorulen = []
        for g in s["beklenen"]:
            gorulen += sorted(adlar) if g["birlesimler"] == "hepsi" else g["birlesimler"]
        if sorted(gorulen) != sorted(adlar):
            out.append(f"{s['ad']}: birleşim kapsaması bozuk ({len(gorulen)} / {len(adlar)})")
    return out


# ---- B, C ------------------------------------------------------------------------------------------------------------
def _beklenen_test(s):
    def f():
        out = []
        for p in BIRLESIMLER:
            out += senaryolar.beklenen_denetle(s, p, Kahin(p).calistir(s["olaylar"], s["referanslar"], s["gecmis"]))
        return out
    return f


for _s in UC:
    test(f"B {_s['ad']}: elle yazılmış beklenen = model (32 birleşim)")(_beklenen_test(_s))
for _s in RAST:
    test(f"C {_s['ad']}: üreticinin akış beklentisi = model (32 birleşim, {len(_s['olaylar'])} olay)")(_beklenen_test(_s))


@test("C4 büyük hacim: tohum 4, 5.000 belge (dosyaya yazılmaz) — üretici = model (32 birleşim, yalnız sayılar)")
def _c4():
    s = senaryolar.rastgele_senaryo(4, 5000)
    out = []
    for p in BIRLESIMLER:
        out += senaryolar.beklenen_denetle(s, p, {"sayilar": Kahin(p).sayilar(s["olaylar"]), "usage": {}})
    toplam = sum(Kahin().sayilar(s["olaylar"]).values())
    out.append(f"bilgi: {len(s['olaylar'])} olay, varsayılan birleşimde {toplam} sayılan gönderim")
    return out


# ---- D değişmezler ---------------------------------------------------------------------------------------------------
def _ref_sonrasi(s):
    return s["referanslar"][-1]


@test("D1 sıra bağımsızlığı: olay listesi karıştırılınca / ters çevrilince sonuç aynı (rastgele + uç, 32 birleşim)")
def _d1():
    out = []
    rng = random.Random(20261027)
    for s in TUM:
        karisik = list(s["olaylar"])
        rng.shuffle(karisik)
        for p in BIRLESIMLER:
            k = Kahin(p)
            a = k.calistir(s["olaylar"], s["referanslar"])
            if k.calistir(karisik, s["referanslar"]) != a or k.calistir(list(reversed(s["olaylar"])), s["referanslar"]) != a:
                out.append(f"{s['ad']} [{kahin.birlesim_adi(p)}]: sıraya bağlı sonuç")
                break
    return out


@test("D2 monotonluk: referans ilerledikçe hiçbir (ay, ortam, tür) sayısı azalmaz (geri yükleme olmayan senaryolar)")
def _d2():
    out = []
    rng = random.Random(7)
    for s in RAST:
        anlar = sorted(kahin.zaman_coz(o["zaman"]) for o in s["olaylar"])
        refs = sorted(rng.sample(anlar, 12) + [anlar[0] - timedelta(days=1), anlar[-1] + timedelta(days=1)])
        refs = [r.astimezone(kahin.TR).isoformat() for r in refs]
        for p in BIRLESIMLER:
            k = Kahin(p)
            onceki = {}
            for r in refs:
                simdi = k.sayilar(s["olaylar"], r)
                dusen = [a for a, n in onceki.items() if simdi.get(a, 0) < n]
                if dusen:
                    out.append(f"{s['ad']} [{kahin.birlesim_adi(p)}] {r}: azalan {dusen[:3]}")
                    break
                onceki = simdi
    return out


@test("D3 ortam ayrımı: canlı sayılar yalnız canlı olaylardan, test sayıları yalnız test olaylarından aynen çıkar")
def _d3():
    out = []
    for s in RAST + UC:
        for p in BIRLESIMLER:
            k = Kahin(p)
            hepsi = k.sayilar(s["olaylar"])
            for ortam in kahin.ORTAMLAR:
                yalniz = k.sayilar([o for o in s["olaylar"] if o.get("ortam", ortam) == ortam and o["olay"] in kahin.BELGE_OLAYLARI]
                                   + [o for o in s["olaylar"] if o["olay"] in kahin.BAKIM_OLAYLARI])
                if {a: n for a, n in hepsi.items() if a.split("|")[1] == ortam} != yalniz:
                    out.append(f"{s['ad']} [{kahin.birlesim_adi(p)}]: {ortam} sayıları öbür ortamdan etkileniyor")
    return out


@test("D4 şirket toplamı: şirketli anahtarda şirket başına sayılar toplamı = genel; şirketsiz anahtarda genel ≤ toplam")
def _d4():
    out = []
    # Ön koşul: belirsiz → kesinleşme aynı şirkette. Yapay U35'te (001'de belirsiz, 002'de kesinleşme) şirketsiz anahtar ön koşulu
    # şirketler arasında taşır; genel 1, şirket başına 0 + 0 — S2'nin bir sonucu (README), değişmez orada geçerli değildir.
    for s in [x for x in RAST + UC if not x["yapay"]]:
        sirketler = sorted({o["sirket"] for o in s["olaylar"]})
        for p in BIRLESIMLER:
            if any(o["olay"] in kahin.BAKIM_OLAYLARI for o in s["olaylar"]):
                continue
            k = Kahin(p)
            hepsi = k.sayilar(s["olaylar"])
            toplam = {}
            for sk in sirketler:
                for a, n in k.sayilar([o for o in s["olaylar"] if o["sirket"] == sk]).items():
                    toplam[a] = toplam.get(a, 0) + n
            if p["anahtar"] == "sirket_ettn_ortam" and toplam != hepsi:
                out.append(f"{s['ad']} [{kahin.birlesim_adi(p)}]: şirket toplamı {sum(toplam.values())} ≠ genel {sum(hepsi.values())}")
            if p["anahtar"] == "ettn_ortam" and sum(hepsi.values()) > sum(toplam.values()):
                out.append(f"{s['ad']} [{kahin.birlesim_adi(p)}]: genel > şirket toplamı")
    return out


@test("D5 gürültü: kabul edilmiş belgelere durum sorgusu, iptal, silme, 11048 ve yeniden deneme kabulü eklemek sonucu değiştirmez")
def _d5():
    out = []
    rng = random.Random(11)
    for s in RAST:
        kabul_olaylari = [o for o in s["olaylar"] if o["olay"] == "gonder_kabul"]
        ek = []
        for o in kabul_olaylari:
            an = kahin.zaman_coz(o["zaman"])
            for olay in rng.sample(["durum_sorgusu", "iptal", "belge_silindi", "zaten_gonderilmis_11048", "yeniden_deneme_kabul"], 3):
                yeni = dict(o)
                yeni["olay"] = olay
                yeni["zaman"] = (an + timedelta(minutes=rng.randint(1, 90 * 24 * 60))).astimezone(kahin.TR).isoformat()
                ek.append(yeni)
        for p in BIRLESIMLER:
            k = Kahin(p)
            if k.sayilar(s["olaylar"]) != k.sayilar(s["olaylar"] + ek):
                out.append(f"{s['ad']} [{kahin.birlesim_adi(p)}]: gürültü sayıyı değiştirdi")
    return out


@test("D6 usage tutarlılığı: son referansta aylık = sayılar ∩ pencere, 3 ardışık ay, toplam = aylıkların toplamı")
def _d6():
    out = []
    for s in RAST + UC:
        if not s["referanslar"]:
            continue
        son_olay = max((kahin.zaman_coz(o["zaman"]) for o in s["olaylar"]), default=None)
        r = _ref_sonrasi(s)
        for p in BIRLESIMLER:
            sonuc = Kahin(p).calistir(s["olaylar"], [r])
            u = sonuc["usage"][r]
            yil_ay = [int(a[:4]) * 12 + int(a[5:]) for a in u["aylar"]]
            if len(yil_ay) != 3 or yil_ay != list(range(yil_ay[0], yil_ay[0] + 3)):
                out.append(f"{s['ad']}: pencere ardışık 3 ay değil {u['aylar']}")
            if son_olay is None or son_olay <= kahin.zaman_coz(r):
                beklenen_aylik = {a: n for a, n in sonuc["sayilar"].items() if a.split("|")[0] in u["aylar"]}
                if {a: n for a, n in u["aylik"].items() if n} != beklenen_aylik:
                    out.append(f"{s['ad']} [{kahin.birlesim_adi(p)}]: aylık ≠ sayılar ∩ pencere")
            if u["toplam"] != kahin.usage_toplami(u["aylik"]):
                out.append(f"{s['ad']}: toplam aylıkların toplamı değil")
            if len(u["aylik"]) != 3 * len(kahin.ORTAMLAR) * len(kahin.TURLER):
                out.append(f"{s['ad']}: aylık sıfırla doldurulmamış")
    return out


@test("D7 bakım olayı yoksa geri_yukleme seçeneği sonucu değiştirmez; geri yükleme sayıyı ancak azaltır")
def _d7():
    out = []
    for s in TUM:
        bakimli = any(o["olay"] in kahin.BAKIM_OLAYLARI for o in s["olaylar"])
        for p in BIRLESIMLER:
            if p["geri_yukleme"] != "etkilemez":
                continue
            q = dict(p, geri_yukleme="geri_alir")
            a = Kahin(p).calistir(s["olaylar"], s["referanslar"])
            b = Kahin(q).calistir(s["olaylar"], s["referanslar"])
            if not bakimli and a != b:
                out.append(f"{s['ad']}: bakım yokken geri_yukleme sonucu değiştirdi")
            if bakimli and any(b["sayilar"].get(x, 0) > n for x, n in a["sayilar"].items()) or set(b["sayilar"]) - set(a["sayilar"]):
                out.append(f"{s['ad']}: geri_alir etkilemez'den fazla saydı")
    return out


@test("D8 sayılan ≤ kabul türü olayı olan farklı belge sayısı; sayılan ≥ doğrudan kabul edilmiş farklı belge sayısı")
def _d8():
    out = []
    kabul_turu = {"gonder_kabul", "yeniden_deneme_kabul", "belirsiz_kesinlesti_kabul", "zaten_gonderilmis_11048"}
    for s in RAST:
        for p in BIRLESIMLER:
            k = Kahin(p)
            hazir = kahin.hazirla(s["olaylar"])
            ust = len({k.anahtar(o) for o in hazir if o["olay"] in kabul_turu})
            alt = len({k.anahtar(o) for o in hazir if o["olay"] in ("gonder_kabul", "yeniden_deneme_kabul")})
            n = sum(k.sayilar(s["olaylar"]).values())
            if not alt <= n <= ust:
                out.append(f"{s['ad']} [{kahin.birlesim_adi(p)}]: {alt} ≤ {n} ≤ {ust} bozuk")
    return out


# ---- E girdi doğrulaması --------------------------------------------------------------------------------------------
_IYI = {"sirket": "001", "ortam": "live", "tur": "efatura", "ettn": senaryolar.E(1), "olay": "gonder_kabul",
        "zaman": "2026-10-05T10:00:00+03:00"}


def _hatali(ad, olaylar=None, parametre=None, **degisen):
    def f():
        liste = olaylar if olaylar is not None else [dict(_IYI, **degisen)]
        if isinstance(liste, list):
            liste = [{a: v for a, v in o.items() if v is not None} for o in liste]
        try:
            Kahin(parametre).sayilar(liste)
        except ValueError as hata:
            return [f"bilgi: reddedildi — {hata}"]
        return ["hatalı girdi sessizce kabul edildi"]
    test(f"E {ad}")(f)


_hatali("bilinmeyen olay türü", olay="gonder_onay")
_hatali("ETTN eksik", ettn=None)
_hatali("ETTN boş", ettn="   ")
_hatali("geçersiz ortam ('canli')", ortam="canli")
_hatali("geçersiz tür ('efatura_temel')", tur="efatura_temel")
_hatali("profil e-Arşiv'de", tur="earsiv", profil="TEMEL")
_hatali("profil geçersiz ('IHRACAT')", profil="IHRACAT")
_hatali("zaman ISO değil ('05.10.2026 10:00')", zaman="05.10.2026 10:00")
_hatali("zaman 2017'den eski", zaman="2016-03-01T10:00:00+02:00")
_hatali("bilinmeyen alan ('tür' yazımı)", olaylar=[dict(_IYI, **{"tür": "efatura"})])
_hatali("aynı ETTN iki farklı türle", olaylar=[_IYI, dict(_IYI, tur="earsiv", zaman="2026-10-06T10:00:00+03:00")])
_hatali("geri yükleme yedek_zamani eksik", olaylar=[{"sirket": "001", "olay": "yedekten_geri_yuklendi", "zaman": "2026-10-06T10:00:00+03:00"}])
_hatali("yedek_zamani geri yüklemeden sonra",
        olaylar=[{"sirket": "001", "olay": "yedekten_geri_yuklendi", "zaman": "2026-10-06T10:00:00+03:00", "yedek_zamani": "2026-10-07T10:00:00+03:00"}])
_hatali("olay listesi dizi değil", olaylar={"olaylar": []})
_hatali("geçersiz parametre değeri", parametre={"ay": "fatura_tarihi"})


@test("E geçerli girdinin bütün alanları kabul edilir (profil, not, Z ve ofsetsiz saat)")
def _e_iyi():
    olaylar = [dict(_IYI, profil="TICARI", **{"not": "deneme"}), dict(_IYI, ettn=senaryolar.E(2), zaman="2026-10-05T07:00:00Z"),
               dict(_IYI, ettn=senaryolar.E(3), zaman="2026-10-05T10:00:00"),
               {"sirket": "002", "olay": "sirket_sifirlandi", "zaman": "2026-10-07T10:00:00+03:00", "not": "x"}]
    n = Kahin().sayilar(olaylar)
    return [] if n == {"2026-10|live|efatura": 3} else [f"beklenen 3, gelen {n}"]


# ---- F MUTASYONLAR --------------------------------------------------------------------------------------------------
MUTASYONLAR = []


def mutasyon(ad, aciklama, uygulanir=lambda p: True):
    def sar(cls):
        cls.ad, cls.aciklama, cls.uygulanir = ad, aciklama, staticmethod(uygulanir)
        MUTASYONLAR.append(cls)
        return cls
    return sar


def _ters(param):
    class Ters(Kahin):
        def __init__(self, p=None):
            super().__init__(p)
            a, b = kahin.PARAMETRELER[param]
            self.p[param] = b if self.p[param] == a else a
    return Ters


@mutasyon("M01-11048-sayilir", "11048 her zaman kabul sayılır (ilk olay olsa da)")
class M01(Kahin):
    def dogrudan_kabul(self, o):
        return super().dogrudan_kabul(o) or o["olay"] == "zaten_gonderilmis_11048"


@mutasyon("M02-iptal-sayilir", "iptal bir kabul gibi sayılır")
class M02(Kahin):
    def dogrudan_kabul(self, o):
        return super().dogrudan_kabul(o) or o["olay"] == "iptal"


@mutasyon("M03-iptal-dusurur", "iptal sayılmış belgeyi sayaçtan düşürür (append-only bozulur)")
class M03(Kahin):
    def islem(self, d, o):
        if o["olay"] == "iptal":
            d.kayitlar.pop(self.anahtar(o), None)
            return
        super().islem(d, o)


@mutasyon("M04-durum-sorgusu-sayilir", "durum sorgusu kabul sayılır")
class M04(Kahin):
    def dogrudan_kabul(self, o):
        return super().dogrudan_kabul(o) or o["olay"] == "durum_sorgusu"


@mutasyon("M05-red-sayilir", "EDM'nin reddettiği gönderim sayılır")
class M05(Kahin):
    def dogrudan_kabul(self, o):
        return super().dogrudan_kabul(o) or o["olay"] == "gonder_red"


@mutasyon("M06-belirsiz-hemen-sayilir", "sonucu belirsiz gönderim kesinleşmeden sayılır")
class M06(Kahin):
    def dogrudan_kabul(self, o):
        return super().dogrudan_kabul(o) or o["olay"] == "gonder_belirsiz"


@mutasyon("M07-kesinlesen-red-sayilir", "belirsiz → kesinleşti red sayılır")
class M07(Kahin):
    def dogrudan_kabul(self, o):
        return super().dogrudan_kabul(o) or o["olay"] == "belirsiz_kesinlesti_red"


@mutasyon("M08-kesinlesen-kabul-sayilmaz", "belirsiz → kesinleşti kabul hiç sayılmaz")
class M08(Kahin):
    def kesinlesme(self, o):
        return o["olay"] == "zaten_gonderilmis_11048" and self.p["e11048"] == "kesinlestirir"


@mutasyon("M09-tekilleme-yok", "aynı ETTN + ortam her kabulde yeniden sayılır")
class M09(Kahin):
    def kaydet(self, d, k, o, ay):
        super().kaydet(d, (k, len(d.kayitlar)), o, ay)


@mutasyon("M10-yeniden-deneme-ayrica-sayilir", "kabul edilen yeniden deneme her zaman ayrıca sayılır")
class M10(Kahin):
    def islem(self, d, o):
        if o["olay"] == "yeniden_deneme_kabul":
            self.kaydet(d, (self.anahtar(o), "yd", o["_sira"]), o, self.ay(o["_an"]))
            return
        super().islem(d, o)


@mutasyon("M11-ortam-anahtarda-yok", "tekilleme ortamı görmez (test ve canlı aynı ETTN tek sayılır)")
class M11(Kahin):
    def anahtar(self, o):
        return tuple(x for x in super().anahtar(o) if x not in kahin.ORTAMLAR)


@mutasyon("M12-ortam-ciktida-karisik", "test gönderimleri canlı sütununa yazılır")
class M12(Kahin):
    def cikti_ortami(self, kayit):
        return "live"


M13 = mutasyon("M13-anahtar-sirket-ters", "şirket anahtara (şirketsiz ↔ şirketli) ters girer")(_ters("anahtar"))


@mutasyon("M14-ay-utc", "ay UTC saatine göre alınır")
class M14(Kahin):
    def ay(self, an):
        y = an.astimezone(timezone.utc)
        return f"{y.year:04d}-{y.month:02d}"


@mutasyon("M15-gece-yarisi-onceki-aya", "ayın 1'i 00:00:00 önceki aya yazılır (≤ sınır hatası)")
class M15(Kahin):
    def ay(self, an):
        y = self.yerel(an)
        if (y.day, y.hour, y.minute, y.second, y.microsecond) == (1, 0, 0, 0, 0):
            y -= timedelta(microseconds=1)
        return f"{y.year:04d}-{y.month:02d}"


@mutasyon("M16-yil-bir-kez-okunur", "yıl ilk olaydan bir kez okunur (yıl dönümünde ay aynı yıla yazılır)")
class M16(Kahin):
    _yil = None

    def yeni_durum(self):
        self._yil = None
        return super().yeni_durum()

    def ay(self, an):
        y = self.yerel(an)
        if self._yil is None:
            self._yil = y.year
        return f"{self._yil:04d}-{y.month:02d}"


@mutasyon("M17-sira-girdi-sirasi", "olaylar zamana göre değil geliş sırasıyla işlenir")
class M17(Kahin):
    def sirala(self, olaylar):
        return sorted(olaylar, key=lambda o: o["_sira"])


@mutasyon("M18-yetim-kesinlesme-sayilir", "eski sürümde belirsiz kalan belgenin kesinleşmesi sayılır (geriye dönük)")
class M18(Kahin):
    def belirsiz_onkosulu(self, denemeler):
        return True


M19 = mutasyon("M19-ay-secimi-ters", "kesinleşme ayı ↔ gönderim ayı ters")(_ters("ay"))


@mutasyon("M20-gonderim-ani-red-sifirlamaz", "gönderim anı araya giren red'i görmez (ilk belirsiz alınır)", lambda p: p["ay"] == "gonderim")
class M20(Kahin):
    def gonderim_ani(self, denemeler, an):
        adaylar = [x for x, tip, _ in denemeler if tip == "belirsiz"]
        return adaylar[0] if adaylar else an


M21 = mutasyon("M21-11048-secimi-ters", "11048 kesinleştirir ↔ saymaz ters")(_ters("e11048"))


@mutasyon("M22-ticari-sayilmaz", "e-Fatura TİCARİ profili sayılmaz")
class M22(Kahin):
    def sayilir(self, o):
        return o.get("profil") != "TICARI"


@mutasyon("M23-earsiv-efatura-karisir", "e-Arşiv e-Fatura sütununa yazılır")
class M23(Kahin):
    def cikti_turu(self, kayit):
        return "efatura" if kayit["tur"] == "earsiv" else kayit["tur"]


@mutasyon("M24-sirketler-toplanmaz", "yalnız 001 şirketi sayılır")
class M24(Kahin):
    def sayilir(self, o):
        return o["sirket"] == "001"


@mutasyon("M25-pencere-2-ay", "usage son 3 yerine son 2 ay")
class M25(Kahin):
    def pencere_aylari(self, referans):
        return super().pencere_aylari(referans)[1:]


M26 = mutasyon("M26-pencere-secimi-ters", "içinde bulunulan ay dahil ↔ tamamlanan 3 ay ters")(_ters("pencere"))


@mutasyon("M27-usage-delta", "usage önceki referanstan bu yana artışı (delta) gönderir, TOPLAM değil")
class M27(Kahin):
    def calistir(self, olaylar, referanslar=(), gecmis=None):
        sonuc = super().calistir(olaylar, referanslar, gecmis)
        onceki = None
        for r in sorted(referanslar, key=kahin.zaman_coz):
            u = sonuc["usage"][r]
            simdi = dict(u["aylik"])
            if onceki is not None:
                u["aylik"] = {a: n - onceki.get(a, 0) for a, n in simdi.items()}
                u["toplam"] = kahin.usage_toplami(u["aylik"])
            onceki = simdi
        return sonuc


@mutasyon("M28-referans-sonrasi-dahil", "usage referans anından sonraki olayları da sayar",
          lambda p: not (p["pencere"] == "tamamlanan" and p["ay"] == "kesinlesme" and p["geri_yukleme"] == "etkilemez"))
class M28(Kahin):
    def _usage(self, hazir, referans):
        aylar = self.pencere_aylari(referans)
        sayilar = self._say([r for r in self._kayitlar(hazir, None) if self.usage_dahil(r, aylar, referans)])
        aylik = {f"{a}|{o}|{t}": sayilar.get(f"{a}|{o}|{t}", 0) for a in aylar for o in kahin.ORTAMLAR for t in kahin.TURLER}
        return {"aylar": aylar, "aylik": aylik, "toplam": kahin.usage_toplami(aylik)}


@mutasyon("M29-referans-ani-haric", "referans anındaki olay dahil edilmez (< yerine ≤ hatası)",
          lambda p: not (p["pencere"] == "tamamlanan" and p["ay"] == "kesinlesme" and p["geri_yukleme"] == "etkilemez"))
class M29(Kahin):
    def referansta(self, an, referans):
        return referans is None or an < referans


@mutasyon("M30-kayan-90-gun", "usage takvim ayı yerine son 90 gün")
class M30(Kahin):
    def usage_dahil(self, kayit, aylar, referans):
        return kayit["ay"] in aylar and referans - kayit["an"] <= timedelta(days=90)


M31 = mutasyon("M31-geri-yukleme-secimi-ters", "geri yükleme sayacı etkilemez ↔ geri alır ters")(_ters("geri_yukleme"))


@mutasyon("M32-geri-yukleme-butun-sirketler", "bir şirketin geri yüklemesi bütün şirketlerin sayacını geri alır",
          lambda p: p["geri_yukleme"] == "geri_alir")
class M32(Kahin):
    def geri_al(self, d, sirket, sinir):
        for s in {r["sirket"] for r in d.kayitlar.values()} | {x[2] for den in d.denemeler.values() for x in den}:
            super().geri_al(d, s, sinir)


@mutasyon("M33-silme-dusurur", "belge silinince sayaçtan düşer")
class M33(Kahin):
    def islem(self, d, o):
        if o["olay"] == "belge_silindi":
            d.kayitlar.pop(self.anahtar(o), None)
            return
        super().islem(d, o)


@mutasyon("M34-ettn-harf-duyarli", "ETTN büyük/küçük harf duyarlı karşılaştırılır (V7)")
class M34(Kahin):
    def ettn(self, o):
        return o["ettn"].strip()


@mutasyon("M35-geriye-donuk-doldurma", "2.4.7 öncesi kabul edilmiş belgeler sayaca doldurulur")
class M35(Kahin):
    def calistir(self, olaylar, referanslar=(), gecmis=None):
        eski = [{"sirket": g["sirket"], "ortam": g["ortam"], "tur": g["tur"], "ettn": g["ettn"],
                 "olay": "gonder_kabul" if g["durum"] == "kabul" else "gonder_belirsiz", "zaman": g["zaman"]} for g in (gecmis or [])]
        return super().calistir(eski + list(olaylar), referanslar)


@mutasyon("M36-ay-ilk-olaydan", "ay, kabul anından değil belgenin ilk olayından (ör. red) alınır")
class M36(Kahin):
    def yeni_durum(self):
        d = super().yeni_durum()
        d.ilk = {}
        return d

    def islem(self, d, o):
        if o["olay"] in kahin.BELGE_OLAYLARI:
            d.ilk.setdefault(self.anahtar(o), o["_an"])
        super().islem(d, o)

    def kaydet(self, d, k, o, ay):
        super().kaydet(d, k, o, self.ay(d.ilk.get(k, o["_an"])))


@mutasyon("M37-toplam-yalniz-son-ay", "usage toplamı yalnız son ayı toplar")
class M37(Kahin):
    def _usage(self, hazir, referans):
        u = super()._usage(hazir, referans)
        u["toplam"] = kahin.usage_toplami({a: n for a, n in u["aylik"].items() if a.startswith(u["aylar"][-1])})
        return u


@mutasyon("M38-gonderim-ani-son-belirsiz", "gönderim anı ilk değil son belirsiz deneme", lambda p: p["ay"] == "gonderim")
class M38(Kahin):
    def gonderim_ani(self, denemeler, an):
        adaylar = [x for x, tip, _ in denemeler if tip == "belirsiz"]
        return adaylar[-1] if adaylar else an


@mutasyon("M39-test-ortami-sayilmaz", "test ortamı gönderimleri hiç sayılmaz")
class M39(Kahin):
    def sayilir(self, o):
        return o["ortam"] == "live"


@mutasyon("M40-esmm-sayilmaz", "e-SMM sayılmaz")
class M40(Kahin):
    def sayilir(self, o):
        return o["tur"] != "esmm"


@mutasyon("M41-kesinlesme-onkosulu-ortamsiz", "kesinleşmenin belirsiz ön koşulu başka ortamın belirsizini de kabul eder")
class M41(Kahin):
    def islem(self, d, o):
        if self.kesinlesme(o) and o["olay"] in kahin.BELGE_OLAYLARI:
            k = self.anahtar(o)
            for diger in kahin.ORTAMLAR:
                kd = tuple(diger if x in kahin.ORTAMLAR else x for x in k)
                if kd != k and kd in d.denemeler:
                    d.denemeler.setdefault(k, []).extend(d.denemeler[kd])
        super().islem(d, o)


@mutasyon("M42-11048-kesinlesmesi-belirsizsiz", "'kesinlestirir' seçeneğinde 11048 belirsiz deneme olmadan da kesinleştirir",
          lambda p: p["e11048"] == "kesinlestirir")
class M42(Kahin):
    def belirsiz_onkosulu(self, denemeler):
        return True if self._olay == "zaten_gonderilmis_11048" else super().belirsiz_onkosulu(denemeler)

    def islem(self, d, o):
        self._olay = o["olay"]
        super().islem(d, o)


def _model_yakalar(cls, p):
    """Mutant bu birleşimde kabul.json'dan ayrışıyor mu? İlk ayrışan senaryonun adı ya da None."""
    for i, s in enumerate(TUM):
        try:
            gelen = cls(p).calistir(s["olaylar"], s["referanslar"], s["gecmis"])
        except Exception as hata:  # mutant düştü: ayrışma sayılır ama ayrıca yazılır
            return f"{s['ad']} (istisna: {type(hata).__name__})"
        if kahin.fark(beklenen(i, p), gelen):
            return s["ad"]
    return None


def _bagimsiz_yakalar(cls, p):
    """Aynı mutasyonu modelden BAĞIMSIZ beklentiler (elle yazılmış uç + üreticinin akış bilgisi) yakalıyor mu?"""
    for s in TUM:
        try:
            gelen = cls(p).calistir(s["olaylar"], s["referanslar"], s["gecmis"])
        except Exception:
            return s["ad"]
        if senaryolar.beklenen_denetle(s, p, gelen):
            return s["ad"]
    return None


BAGIMSIZ_OZET = {"yakalanan": 0, "toplam": 0, "kacan": []}


def _mutasyon_testi(cls):
    def f():
        uygun = [p for p in BIRLESIMLER if cls.uygulanir(p)]
        if not uygun:
            return ["uygulanabilir birleşim yok"]
        kacan, ilk, bagimsiz = [], {}, 0
        for p in uygun:
            ad = _model_yakalar(cls, p)
            if ad is None:
                kacan.append(kahin.birlesim_adi(p))
            else:
                ilk[ad] = ilk.get(ad, 0) + 1
            if _bagimsiz_yakalar(cls, p):
                bagimsiz += 1
        BAGIMSIZ_OZET["toplam"] += 1
        if bagimsiz == len(uygun):
            BAGIMSIZ_OZET["yakalanan"] += 1
        else:
            BAGIMSIZ_OZET["kacan"].append(f"{cls.ad} ({bagimsiz}/{len(uygun)})")
        out = [f"YAKALANMADI [{b}]" for b in kacan]
        yakalayan = ", ".join(f"{a}×{n}" for a, n in sorted(ilk.items(), key=lambda x: -x[1])[:3])
        out.append(f"bilgi: {cls.aciklama}; yakalandı {len(uygun) - len(kacan)}/{len(uygun)} birleşim "
                   f"(ilk yakalayan: {yakalayan or '-'}); bağımsız beklentiler {bagimsiz}/{len(uygun)}")
        return out
    return f


for _m in MUTASYONLAR:
    test(f"F {_m.ad}")(_mutasyon_testi(_m))


@test("F özet: her mutasyonu modelden bağımsız beklentiler (elle + üretici) de yakalıyor")
def _f_ozet():
    out = [f"bağımsız beklentilerin kaçırdığı: {k}" for k in BAGIMSIZ_OZET["kacan"]]
    out.append(f"bilgi: {BAGIMSIZ_OZET['yakalanan']}/{BAGIMSIZ_OZET['toplam']} mutasyon uygulanabildiği her birleşimde bağımsız beklentilerce de yakalandı")
    return out


# ---- G komut satırı -------------------------------------------------------------------------------------------------
def _cli(*argv):
    return subprocess.run([sys.executable, "-I", os.path.join(_BURASI, "kahin.py"), *argv], capture_output=True, text=True, encoding="utf-8")


@test("G1 'hesapla' komutu modelle aynı çıktıyı verir (U25, --param ile)")
def _g1():
    s = next(x for x in KABUL["senaryolar"] if x["ad"].startswith("U25"))
    with tempfile.TemporaryDirectory() as d:
        yol = os.path.join(d, "olaylar.json")
        with open(yol, "w", encoding="utf-8") as f:
            json.dump({"olaylar": s["olaylar"], "referanslar": s["referanslar"]}, f, ensure_ascii=False)
        r = _cli("hesapla", yol, "--param", "pencere=tamamlanan")
    if r.returncode != 0:
        return [f"çıkış {r.returncode}: {r.stderr.strip()[-300:]}"]
    gelen = json.loads(r.stdout)
    p = dict(kahin.VARSAYILAN, pencere="tamamlanan")
    beklenen_g = kahin.beklenen_bul(s, p)
    return kahin.fark(beklenen_g, gelen)


@test("G2 'karsilastir' komutu: kabul.json'un kendisi ile çıkış 0; bir sayı bozulunca ve bir senaryo eksikken çıkış 1")
def _g2():
    p = {"ay": "gonderim", "anahtar": "sirket_ettn_ortam", "e11048": "kesinlestirir", "pencere": "tamamlanan", "geri_yukleme": "geri_alir"}
    adi = kahin.birlesim_adi(p)
    program = {}
    for s in KABUL["senaryolar"]:
        g = kahin.beklenen_bul(s, p)
        program[s["ad"]] = {"sayilar": g["sayilar"], "usage": g["usage"]}
    out = []
    with tempfile.TemporaryDirectory() as d:
        yol_k, yol_p = os.path.join(d, "kabul.json"), os.path.join(d, "program.json")
        with open(yol_k, "w", encoding="utf-8") as f:
            json.dump(KABUL, f, ensure_ascii=False)

        def calis(prog):
            with open(yol_p, "w", encoding="utf-8") as f:
                json.dump(prog, f, ensure_ascii=False)
            return _cli("karsilastir", yol_k, yol_p, "--birlesim", adi)

        r = calis(program)
        if r.returncode != 0 or f"# fail 0" not in r.stdout:
            out.append(f"aynı çıktıda çıkış {r.returncode}")
        bozuk = json.loads(json.dumps(program))
        hedef = next(a for a, v in bozuk.items() if v["sayilar"])
        ilk = next(iter(bozuk[hedef]["sayilar"]))
        bozuk[hedef]["sayilar"][ilk] += 1
        r = calis(bozuk)
        if r.returncode != 1 or f"not ok" not in r.stdout or "# fail 1" not in r.stdout:
            out.append(f"bozuk sayıda çıkış {r.returncode} (beklenen 1, tek fark)")
        eksik = dict(program)
        eksik.pop(KABUL["senaryolar"][0]["ad"])
        r = calis(eksik)
        if r.returncode != 1:
            out.append("eksik senaryo boş sayıldı (ders 4: okunamayan veri boş değildir)")
    return out


if __name__ == "__main__":
    sys.exit(kos())
