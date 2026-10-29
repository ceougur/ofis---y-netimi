# -*- coding: utf-8 -*-
"""Mobil erişim kâhini — senaryolar.

- Elle yazılmış uç senaryolar (U…): beklenen değerler ELLE, modelden değil (parametreye bağlıysa elle yazılmış kural).
- Tohumlu rastgele üretici (R1–R3): akış kalıplarından olay dizisi + akışın kendi beklentisi (modelden bağımsız).
- Model ≠ elle / üretici beklentisi → kabul.json YAZILMAZ, çıkış 1.

Koşu: python3 -I test/bagimsiz/mobil-erisim/senaryolar.py [--yazma]
"""
import importlib.util
import json
import os
import random
import sys

sys.dont_write_bytecode = True
BURASI = os.path.dirname(os.path.abspath(__file__))


def _yukle(ad):
    if ad in sys.modules:
        return sys.modules[ad]
    spec = importlib.util.spec_from_file_location(ad, os.path.join(BURASI, ad + ".py"))
    m = importlib.util.module_from_spec(spec)
    sys.modules[ad] = m
    spec.loader.exec_module(m)
    return m


K = _yukle("kahin")

SN, DK, SA, GUN = 1, 60, 3600, 86400


# ---------------------------------------------------------------------------------------------------------------
# Senaryo yazım dili
# ---------------------------------------------------------------------------------------------------------------
def kullanicilar_std():
    return {
        "yon": {"rol": "yonetici", "uzaktan": True},
        "yon2": {"rol": "yonetici", "uzaktan": True},
        "ayse": {"uzaktan": True, "sirketler": ["002"], "yetkiler": ["kasa", "cari"]},
        "mehmet": {"uzaktan": True, "sirketler": [], "yetkiler": ["stok", "rapor:cari-ekstre"]},
        "zeynep": {"uzaktan": True, "sirketler": ["001", "002"], "yetkiler": ["taksit"]},
        "ali": {"uzaktan": False, "sirketler": ["001"], "yetkiler": ["kasa"]},
        "muh": {"uzaktan": True, "sirketler": ["001"], "yetkiler": ["anlik_durum", "kasa", "rapor:kasa"]},
    }


def ofis(sirketler=("001", "002"), lisans=None, sunucu="acik", kullanicilar=None):
    o = {"sirketler": list(sirketler), "kullanicilar": kullanicilar or kullanicilar_std(), "sunucu": sunucu}
    if lisans is not None:
        o["lisans"] = lisans
    return o


class S:
    def __init__(self, ad, aciklama, bas="2026-11-02T10:00:00+03:00", ofisler=None, servis="var", kaynak=""):
        self.ad = ad
        self.aciklama = aciklama
        self.kaynak = kaynak
        self.bas = K.zaman(bas)
        self.baslangic = {"ofisler": ofisler or {"A": ofis()}, "lisans_servisi": servis}
        self.olaylar = []
        self.bek = {}
        self.grup_bek = {}
        self.no = 0
        self.programda_uretilemez = False

    def t(self, ofs):
        return K.iso(self.bas + int(ofs))

    def e(self, ofs, olay, bek=None, esli=None, dusen=None, gorunur=None, zaman=None, t=None, **alan):
        self.no += 1
        if "ofis" not in alan and olay not in ("lisans_servisi", "bekle"):
            alan["ofis"] = "A"
        ev = {"no": self.no, "t": t if t is not None else self.t(ofs), "olay": olay, **alan}
        self.olaylar.append(ev)
        spec = {}
        if bek is None and K.OLAY_SINIFI[olay] == 0:
            bek = "kabul"
        if bek is None:
            raise ValueError(f"{self.ad} olay {self.no}: elle beklenti yazılmadı")
        spec["sonuc"] = bek
        for ad_, deger in (("esli", esli), ("dusen", dusen), ("gorunur", gorunur), ("ozet_zamani", zaman)):
            if deger is not None:
                spec[ad_] = deger
        self.bek[self.no] = spec
        return self.no

    # sık kullanılan kısa yollar
    def kod(self, ofs, kullanici, kod, bek="kabul", yapan="yon", **k):
        return self.e(ofs, "karekod_uret", bek=bek, yapan=yapan, kullanici=kullanici, kod=kod, **k)

    def esle(self, ofs, kod, cihaz, bek="kabul", **k):
        return self.e(ofs, "esle", bek=bek, kod=kod, cihaz=cihaz, **k)

    def eslenmis(self, ofs, kullanici, cihaz, kod, yapan="yon", **k):
        """Karekod + 30 sn sonra eşleme; ikisi de kabul (çağıran bunun geçerli olduğunu bilir)."""
        self.kod(ofs, kullanici, kod, yapan=yapan)
        return self.esle(ofs + 30, kod, cihaz, **k)

    def giris(self, ofs, cihaz, kullanici, oturum, bek="kabul", parola="dogru", **k):
        return self.e(ofs, "giris", bek=bek, cihaz=cihaz, kullanici=kullanici, parola=parola, oturum=oturum, **k)

    def istek(self, ofs, cihaz, oturum, bek, yol="/api/mobil/rapor", **k):
        return self.e(ofs, "istek", bek=bek, cihaz=cihaz, oturum=oturum, yol=yol, **k)

    def senaryo(self):
        d = {"ad": self.ad, "aciklama": self.aciklama, "baslangic": self.baslangic, "olaylar": self.olaylar}
        if self.kaynak:
            d["kaynak"] = self.kaynak
        if self.programda_uretilemez:
            d["programda_uretilemez"] = True
        return d


# ---------------------------------------------------------------------------------------------------------------
# Elle beklenti ↔ model karşılaştırması (bütün yapraklarda; elle kural bir parametre okursa yaprak genişletilir)
# ---------------------------------------------------------------------------------------------------------------
def _kume(x):
    return set(x.split("|")) if isinstance(x, str) else set(x)


def _coz(spec, P):
    return spec(P) if callable(spec) else spec


def _olay_fark(no, spec, c, P):
    farklar = []
    m = c["olaylar"].get(str(no))
    if m is None:
        return [f"olay {no}: modelde yok"]
    bek = _coz(spec["sonuc"], P)
    if _kume(bek) != set(m["sonuc"]):
        farklar.append(f"olay {no}: sonuç elle={sorted(_kume(bek))} model={m['sonuc']}")
    if "esli" in spec:
        e = _coz(spec["esli"], P)
        e = e if isinstance(e, list) else [e]
        anahtarlar = set().union(*[set(x) for x in e])
        el_k = {json.dumps(x, sort_keys=True) for x in e}
        model_k = {json.dumps({k: v for k, v in x.items() if k in anahtarlar}, sort_keys=True) for x in m["esli"]}
        if el_k != model_k:
            farklar.append(f"olay {no}: eşli elle={e} model={m['esli']}")
    if "dusen" in spec:
        d = _coz(spec["dusen"], P)
        model_d = m.get("dusen", [])
        if (d is None and model_d) or (d is not None and model_d != [d]):
            farklar.append(f"olay {no}: düşen elle={d} model={model_d}")
    if "gorunur" in spec and _coz(spec["gorunur"], P) is not None:
        g = _coz(spec["gorunur"], P)
        mg = m.get("gorunur")
        if "en_az" in g:
            if mg != g:
                farklar.append(f"olay {no}: görünür elle={g} model={mg}")
        elif mg is None or mg["en_az"] != g or mg["en_cok"] != g:
            farklar.append(f"olay {no}: görünür elle={g} model={mg}")
    if "ozet_zamani" in spec and _coz(spec["ozet_zamani"], P) is not None:
        z = _coz(spec["ozet_zamani"], P)
        if sorted(K.zaman(x) for x in z) != sorted(K.zaman(x) for x in m.get("ozet_zamani", [])):
            farklar.append(f"olay {no}: özet zamanı elle={z} model={m.get('ozet_zamani')}")
    return farklar


def beklenti_farklari(bek, grup_bek, yapraklar):
    """bek: {no: spec}; grup_bek: {grup: callable|list}. Dönen: fark metinleri (boş = aynı)."""
    farklar = []
    for atama, c in yapraklar:
        yigin = [dict(atama)]
        while yigin:
            a = yigin.pop()
            P = K.Parametreler(a)
            try:
                f = []
                for no, spec in bek.items():
                    f.extend(_olay_fark(no, spec, c, P))
                for g, spec in grup_bek.items():
                    secenek = _coz(spec, P)
                    el = sorted(json.dumps({str(n): sorted(_kume(v)) for n, v in d.items()}, sort_keys=True)
                                for d in secenek)
                    model = sorted(json.dumps(d, sort_keys=True) for d in c["gruplar"].get(g, []))
                    if el != model:
                        f.append(f"grup {g}: elle={el} model={model}")
            except K.ParamGerekli as pg:
                for v in K.PARAMETRELER[pg.ad]["degerler"]:
                    yigin.append({**a, pg.ad: v})
                continue
            for x in f:
                farklar.append(f"[{K.birlesim_metni(a) or 'her birleşim'}] {x}")
    return farklar


# ---------------------------------------------------------------------------------------------------------------
# Elle beklenti kuralları (parametreye bağlı olanlar; modelden bağımsız, metinden elle)
# ---------------------------------------------------------------------------------------------------------------
def red_uretimde(p):
    """Üretimde sınır denetimi gerçekten uygulanıyor mu (yalnız 'reddet'te anlamlı, P4)."""
    return p["sinir_dolunca"] == "reddet" and p["uretimde_sinir"] == "denetler"


AYSE_G = {"002": ["cari", "kasa"]}
HEPSI = ["anlik_durum", "cari", "kasa", "stok", "taksit"]


def u01():
    s = S("U01", "Temel akış (Standart lisans; Pro kilidi yok): karekod → eşle → özet → giriş → yetkili istek → sayfa "
          "dosyası; cihaz özete yazamaz", ofisler={"A": ofis(lisans={"plan": "standart"})},
          kaynak="devir §3.1 ('PRO YOK … Mobil HERKESE'); PRO-UZAKTAN 'Yetki ve cihaz eşleme'")
    s.kod(0, "ayse", "K1", esli={"A": 0})
    s.esle(60, "K1", "tel1", esli={"A": 1}, cihaz_turu="telefon")
    s.e(120, "ozet_yukle", bek="kabul")
    s.e(180, "ozet_oku", bek="kabul", cihaz="tel1", gorunur=AYSE_G, zaman=[s.t(120)])
    s.giris(240, "tel1", "ayse", "o1")
    s.istek(300, "tel1", "o1", "kabul", sirket="002", yetki="kasa")
    s.istek(360, "tel1", "o1", "kabul", sirket="002", yetki="cari")
    s.istek(420, "tel1", "o1", "kabul", yol="/mobil/index.html")
    s.e(480, "ozet_yaz", bek="ret:yazma_yasak", cihaz="tel1")
    return s


def u02():
    s = S("U02", "Karekod süresi: 1,5 / 3 / 7 / 12 dk sonra eşleme (P1)", kaynak="PRO-UZAKTAN: 'birkaç dakika geçerli QR'")
    for k, kod in (("ayse", "K1"), ("mehmet", "K2"), ("zeynep", "K3"), ("yon2", "K4")):
        s.kod(0, k, kod)
    s.esle(90, "K1", "tel1", esli={"A": 1})
    s.esle(180, "K2", "tel2", bek=lambda p: "kabul" if p["kod_sure"] >= 5 else "ret:kod_gecersiz",
           esli=lambda p: {"A": 2 if p["kod_sure"] >= 5 else 1})
    s.esle(420, "K3", "tel3", bek=lambda p: "kabul" if p["kod_sure"] == 10 else "ret:kod_gecersiz",
           esli=lambda p: {"A": {2: 1, 5: 2, 10: 3}[p["kod_sure"]]})
    s.esle(720, "K4", "tel4", bek="ret:kod_gecersiz", esli=lambda p: {"A": {2: 1, 5: 2, 10: 3}[p["kod_sure"]]})
    return s


def u03():
    s = S("U03", "Karekod süresi tam sınırda (V3: süre dolduğu an geçersiz)", kaynak="V3")
    s.kod(0, "ayse", "K1")
    s.kod(0, "mehmet", "K2")
    s.kod(0, "zeynep", "K3")
    s.esle(300, "K1", "tel1", bek=lambda p: "kabul" if p["kod_sure"] == 10 else "ret:kod_gecersiz")
    s.esle(299, "K2", "tel2", bek=lambda p: "kabul" if p["kod_sure"] >= 5 else "ret:kod_gecersiz")
    s.esle(120, "K3", "tel3", bek=lambda p: "kabul" if p["kod_sure"] >= 5 else "ret:kod_gecersiz")
    return s


def u04():
    s = S("U04", "Aynı karekodun ikinci kullanımı (tek kullanımlık)", kaynak="PRO-UZAKTAN: 'tek kullanımlık'")
    s.kod(0, "ayse", "K1")
    s.esle(30, "K1", "tel1", esli={"A": 1})
    s.esle(60, "K1", "tab1", bek="ret:kod_gecersiz", esli={"A": 1})
    s.esle(90, "K1", "tel1x", bek="ret:kod_gecersiz", esli={"A": 1})
    return s


def u05():
    s = S("U05", "Aynı kullanıcıya ikinci karekod: ilki geçersiz olur mu (P2)")
    s.kod(0, "ayse", "K1")
    s.kod(10, "ayse", "K2")
    s.esle(20, "K1", "tel1", bek=lambda p: "kabul" if p["yeni_kod_eskiyi"] == "etmez" else "ret:kod_gecersiz")
    s.esle(30, "K2", "tel2", esli=lambda p: {"A": 2 if p["yeni_kod_eskiyi"] == "etmez" else 1})
    return s


def u06():
    s = S("U06", "4. cihaz (telefon + tablet + uzak tarayıcı hepsi sayılır); silinince yer açılır (P3, P4)",
          kaynak="KARAR 26.10 'tablet de mobil sayılsın, 3 tane uzaktan bağlantı cihazı'; 'Cihaz silinince yer açılır'")
    s.eslenmis(0, "ayse", "tel1", "K1", cihaz_turu="telefon", esli={"A": 1})
    s.eslenmis(60, "mehmet", "tab2", "K2", cihaz_turu="tablet", esli={"A": 2})
    s.eslenmis(120, "zeynep", "pc3", "K3", cihaz_turu="tarayici", esli={"A": 3})
    s.kod(180, "yon2", "K4", bek=lambda p: "ret:sinir_dolu" if red_uretimde(p) else "kabul")

    def b8(p):
        if p["sinir_dolunca"] == "en_eskiyi_dusur":
            return "kabul"
        return "ret:kod_gecersiz" if p["uretimde_sinir"] == "denetler" else "ret:sinir_dolu"
    s.esle(210, "K4", "tel4", bek=b8, esli={"A": 3}, cihaz_turu="telefon",
           dusen=lambda p: ["tel1"] if p["sinir_dolunca"] == "en_eskiyi_dusur" else None)
    s.e(240, "ozet_yukle", bek="kabul")
    s.e(250, "ozet_oku", cihaz="tel1",
        bek=lambda p: "ret:cihaz_yok" if p["sinir_dolunca"] == "en_eskiyi_dusur" else "kabul",
        gorunur=lambda p: None if p["sinir_dolunca"] == "en_eskiyi_dusur" else AYSE_G)
    s.e(300, "cihaz_sil", bek="kabul", yapan="yon", cihaz="tab2", esli={"A": 2})
    s.eslenmis(360, "mehmet", "tab5", "K5", esli={"A": 3})
    s.e(400, "ozet_oku", bek="ret:cihaz_yok", cihaz="tab2")
    return s


def u07():
    s = S("U07", "Sınır program başına: iki şirkete dağılmış ve aynı kullanıcının iki cihazı; iki ofis birbirini etkilemez",
          ofisler={"A": ofis(), "B": ofis()}, kaynak="KARAR 26.10 NETLEŞTİ: 'program başına (iki şirket birlikte)'")
    s.eslenmis(0, "ayse", "tel1", "K1", esli={"A": 1, "B": 0})          # yalnız 002
    s.eslenmis(60, "mehmet", "tel2", "K2", esli={"A": 2, "B": 0})       # yalnız 001
    s.eslenmis(120, "mehmet", "tab2", "K3", esli={"A": 3, "B": 0})      # aynı kullanıcının ikinci cihazı
    for i, (k, c) in enumerate((("ayse", "b1"), ("mehmet", "b2"), ("zeynep", "b3"))):
        s.kod(150 + i * 40, k, f"KB{i}", ofis="B")
        s.esle(160 + i * 40, f"KB{i}", c, ofis="B", esli={"A": 3, "B": i + 1})
    s.kod(300, "ayse", "K4", bek=lambda p: "ret:sinir_dolu" if red_uretimde(p) else "kabul")

    def b(p):
        if p["sinir_dolunca"] == "en_eskiyi_dusur":
            return "kabul"
        return "ret:kod_gecersiz" if p["uretimde_sinir"] == "denetler" else "ret:sinir_dolu"
    s.esle(330, "K4", "tab1", bek=b, esli={"A": 3, "B": 3},
           dusen=lambda p: ["tel1"] if p["sinir_dolunca"] == "en_eskiyi_dusur" else None)
    s.e(360, "cihaz_sil", bek="kabul", yapan="yon", cihaz="tel2", esli={"A": 2, "B": 3})
    s.eslenmis(400, "zeynep", "tel5", "K5", esli={"A": 3, "B": 3})
    return s


def u08():
    s = S("U08", "Silinen cihazın açık oturumu hemen kesilir; yeniden eşleme yeni kimlikle",
          kaynak="2.4.7 iş listesi 'Nasıl bozulur?': 'cihaz silinince açık oturum sürer'; M2 'cihaz silme → erişim kesilir'")
    s.eslenmis(0, "ayse", "tel1", "K1")
    s.e(60, "ozet_yukle", bek="kabul")
    s.giris(120, "tel1", "ayse", "o1")
    s.istek(180, "tel1", "o1", "kabul", sirket="002", yetki="kasa")
    s.e(240, "cihaz_sil", bek="kabul", yapan="yon", cihaz="tel1", esli={"A": 0})
    s.istek(241, "tel1", "o1", "ret:cihaz_yok", sirket="002", yetki="kasa")
    s.e(242, "ozet_oku", bek="ret:cihaz_yok", cihaz="tel1")
    s.giris(243, "tel1", "ayse", "o2", bek="ret:cihaz_yok")
    s.e(244, "ozet_yaz", bek="ret:cihaz_yok", cihaz="tel1")
    s.e(245, "cihaz_sil", bek="ret:cihaz_yok", yapan="yon", cihaz="tel1")
    s.eslenmis(300, "ayse", "tel1b", "K2", esli={"A": 1})
    s.giris(360, "tel1b", "ayse", "o3")
    s.istek(420, "tel1b", "o3", "kabul", sirket="002", yetki="kasa")
    s.istek(480, "tel1b", "o1", "ret:oturum_gecersiz", sirket="002", yetki="kasa")
    s.e(540, "ozet_oku", bek="kabul", cihaz="tel1b", gorunur=AYSE_G, zaman=[s.t(60), s.t(240), s.t(330)])
    return s


def u09():
    s = S("U09", "Başka ofisin karekodu ve cihazı; iki ofiste aynı adlı kullanıcılar",
          ofisler={"A": ofis(), "B": ofis()}, kaynak="PRO-UZAKTAN 6: 'iki ofisin verisi karışmaz, aynı adlı iki kişi'")
    s.kod(0, "ayse", "K1", ofis="A")
    s.esle(30, "K1", "tel1", ofis="B", bek="ret:kod_gecersiz", esli={"A": 0, "B": 0})
    s.esle(60, "K1", "tel1x", ofis="A", esli={"A": 1, "B": 0})
    s.e(90, "ozet_yukle", bek="kabul", ofis="A")
    s.e(91, "ozet_yukle", bek="kabul", ofis="B")
    s.e(120, "ozet_oku", bek="ret:cihaz_yok", ofis="B", cihaz="tel1x")
    s.giris(150, "tel1x", "ayse", "o1", ofis="B", bek="ret:cihaz_yok")
    s.giris(180, "tel1x", "ayse", "o2", ofis="A")
    s.istek(210, "tel1x", "o2", "ret:cihaz_yok", ofis="B", sirket="002", yetki="kasa")
    s.kod(240, "ayse", "K1", ofis="B")
    s.esle(270, "K1", "telB", ofis="B", esli={"A": 1, "B": 1})
    s.e(300, "ozet_oku", bek="kabul", ofis="B", cihaz="telB", gorunur=AYSE_G, zaman=[s.t(91), s.t(270)])
    s.e(330, "ozet_oku", bek="ret:cihaz_yok", ofis="A", cihaz="telB")
    s.e(331, "ozet_yaz", bek="ret:cihaz_yok", ofis="B", cihaz="tel1x")
    return s


def u10():
    s = S("U10", "Lisans biter → mobil durur; yenilenince eşleme geri gelir (yeniden eşleme yok); önbellek penceresi (P9)",
          ofisler={"A": ofis(lisans={"bitis": "2026-11-02T12:00:00+03:00"})},
          kaynak="PRO-UZAKTAN: 'Lisans süresi biter … Worker o ofisin dosyasını vermez'; 'yenilenince eşlemeler geri gelecek'")
    s.eslenmis(0, "ayse", "tel1", "K1")
    s.e(60, "ozet_yukle", bek="kabul")
    s.giris(120, "tel1", "ayse", "o1")
    s.e(2 * SA - 60, "ozet_oku", bek="kabul", cihaz="tel1", zaman=[s.t(60)])
    s.e(2 * SA + 60, "ozet_oku", bek="ret:lisans_gecersiz", cihaz="tel1")
    s.istek(2 * SA + 120, "tel1", "o1", "ret:lisans_gecersiz", sirket="002", yetki="kasa")
    s.giris(2 * SA + 180, "tel1", "ayse", "o2", bek="ret:lisans_gecersiz")
    s.e(2 * SA + 240, "ozet_yukle", bek="ret:lisans_gecersiz")
    s.kod(2 * SA + 300, "mehmet", "K2", bek="kabul|ret:lisans_gecersiz")
    s.esle(2 * SA + 330, "K2", "tel2", bek="ret:lisans_gecersiz", esli={"A": 1})
    y = 2 * SA + 600
    s.e(y, "lisans_degis", lisans={"bitis": "2027-11-02T12:00:00+03:00"})
    s.e(y + 30 * DK, "ozet_oku", bek="kabul|ret:lisans_gecersiz", cihaz="tel1")
    s.e(y + 2 * SA, "ozet_oku", cihaz="tel1",
        bek=lambda p: "kabul" if p["lisans_onbellek"] == 1 else "kabul|ret:lisans_gecersiz")
    s.e(y + 25 * SA, "ozet_oku", bek="kabul", cihaz="tel1", esli={"A": 1}, zaman=[s.t(60)], gorunur=AYSE_G)
    s.giris(y + 25 * SA + 60, "tel1", "ayse", "o3")
    s.istek(y + 25 * SA + 120, "tel1", "o3", "kabul", sirket="002", yetki="kasa")
    s.istek(y + 25 * SA + 180, "tel1", "o1", "ret:oturum_gecersiz", sirket="002", yetki="kasa")
    s.esle(y + 25 * SA + 240, "K2", "tel2b", bek="ret:kod_gecersiz", esli={"A": 1})
    return s


def u11():
    s = S("U11", "Lisans engellenir: kapıcı önbelleği en çok P9 kadar eski kabul eder; engel kalkınca erişim döner",
          kaynak="iş listesi 'Nasıl bozulur?': 'kapıcı lisansı eski önbellekten kabul eder'")
    s.eslenmis(0, "ayse", "tel1", "K1")
    s.e(60, "ozet_yukle", bek="kabul")
    s.e(SA, "lisans_degis", lisans={"durum": "engelli"})
    s.e(SA + 30 * DK, "ozet_oku", bek="kabul|ret:lisans_gecersiz", cihaz="tel1")
    s.e(SA + 61 * DK, "ozet_oku", cihaz="tel1",
        bek=lambda p: "ret:lisans_gecersiz" if p["lisans_onbellek"] == 1 else "kabul|ret:lisans_gecersiz")
    s.e(SA + 25 * SA, "ozet_oku", bek="ret:lisans_gecersiz", cihaz="tel1")
    s.e(27 * SA, "lisans_degis", lisans={"durum": "gecerli"})
    s.e(27 * SA + 25 * SA, "ozet_oku", bek="kabul", cihaz="tel1", esli={"A": 1})
    return s


def u12():
    s = S("U12", "Lisans servisine ulaşılamaz: kapıcı önbellek süresinden sonra kabul etmez (fail-closed)",
          kaynak="görev: 'kapıcı eski lisans önbelleğini sonsuza dek kabul etmez'")
    s.eslenmis(0, "ayse", "tel1", "K1")
    s.e(60, "ozet_yukle", bek="kabul")
    s.e(SA, "lisans_servisi", erisim="yok")
    s.kod(SA + 10 * DK, "mehmet", "K2")
    s.esle(SA + 11 * DK, "K2", "tel2", bek="kabul|ret:lisans_dogrulanamadi", esli=[{"A": 1}, {"A": 2}])
    s.e(SA + 30 * DK, "ozet_oku", bek="kabul|ret:lisans_dogrulanamadi", cihaz="tel1")
    s.e(3 * SA, "ozet_oku", cihaz="tel1",
        bek=lambda p: "ret:lisans_dogrulanamadi" if p["lisans_onbellek"] == 1 else "kabul|ret:lisans_dogrulanamadi")
    s.e(26 * SA, "ozet_oku", bek="ret:lisans_dogrulanamadi", cihaz="tel1")
    s.giris(26 * SA + 60, "tel1", "ayse", "o1", bek="ret:lisans_dogrulanamadi")
    s.e(27 * SA, "lisans_servisi", erisim="var")
    s.e(27 * SA + 60, "ozet_oku", bek="kabul", cihaz="tel1")
    return s


def u13():
    s = S("U13", "Sunucu kapalı: son hâl okunur, canlı okuma/yazma/giriş/eşleme reddedilir; yeniden açılınca oturum belirsiz",
          kaynak="devir §3.1: 'Sunucu kapalıyken telefonda son hâl görünür; yalnız tahsilat girilemez'")
    s.eslenmis(0, "ayse", "tel1", "K1")
    s.giris(60, "tel1", "ayse", "o1")
    s.e(120, "ozet_yukle", bek="kabul")
    s.kod(150, "mehmet", "K2")
    s.istek(180, "tel1", "o1", "kabul", sirket="002", yetki="kasa")
    s.e(200, "sunucu", durum="kapali")
    s.e(240, "ozet_oku", bek="kabul", cihaz="tel1", zaman=[s.t(120)], gorunur=AYSE_G)
    s.istek(260, "tel1", "o1", "ret:sunucu_kapali", sirket="002", yetki="kasa")
    s.istek(270, "tel1", "o1", "ret:sunucu_kapali", yol="/api/mobil/tahsilat", sirket="002", yetki="tahsilat",
            yazma=True)
    s.giris(280, "tel1", "ayse", "o2", bek="ret:sunucu_kapali")
    s.esle(290, "K2", "tel2", bek="ret:sunucu_kapali", esli={"A": 1})
    s.kod(300, "zeynep", "K3", bek="ret:sunucu_kapali")
    s.e(310, "cihaz_sil", bek="ret:sunucu_kapali", yapan="yon", cihaz="tel1", esli={"A": 1})
    s.e(320, "ozet_yaz", bek="ret:yazma_yasak", cihaz="tel1")
    s.istek(330, "tel1", "o1", "ret:sunucu_kapali", yol="/mobil/index.html")
    s.e(400, "sunucu", durum="acik")
    s.istek(460, "tel1", "o1", "kabul|ret:oturum_gecersiz", sirket="002", yetki="kasa")
    s.esle(470, "K2", "tel2b", bek=lambda p: "kabul" if p["kod_sure"] == 10 else "ret:kod_gecersiz",
           esli=lambda p: {"A": 2 if p["kod_sure"] == 10 else 1})
    s.giris(480, "tel1", "ayse", "o3")
    s.istek(490, "tel1", "o3", "kabul", sirket="002", yetki="kasa")
    return s


def u14():
    s = S("U14", "Sunucu günlerce kapalı, ay sonu geçer: özet yaşı sınırı (P10); açılınca yeni özet",
          bas="2026-11-15T09:00:00+03:00", kaynak="PRO-UZAKTAN: 'sunucu günlerce kapalı kalır' yeniden eşleme gerektirmez")
    s.eslenmis(0, "ayse", "tel1", "K1")
    s.e(60, "ozet_yukle", bek="kabul")
    s.e(120, "sunucu", durum="kapali")
    s.e(60 + 30 * GUN - 1, "ozet_oku", bek="kabul", cihaz="tel1", zaman=[s.t(60)])
    s.e(60 + 30 * GUN, "ozet_oku", cihaz="tel1",
        bek=lambda p: "ret:ozet_eski" if p["ozet_yas_siniri"] == 30 else "kabul")
    s.e(60 + 45 * GUN, "ozet_oku", cihaz="tel1",
        bek=lambda p: "ret:ozet_eski" if p["ozet_yas_siniri"] == 30 else "kabul")
    s.giris(60 + 45 * GUN + 60, "tel1", "ayse", "o1", bek="ret:sunucu_kapali")
    s.e(46 * GUN, "sunucu", durum="acik")
    s.e(46 * GUN + 60, "ozet_yukle", bek="kabul")
    s.e(46 * GUN + 120, "ozet_oku", bek="kabul", cihaz="tel1", zaman=[s.t(46 * GUN + 60)], esli={"A": 1})
    return s


YASAK_YOLLAR = [
    "/api/companies", "/api/auth/login", "/api/auth/me", "/", "/admin.html", "/api/report-center/cari-ekstre",
    "/api/mobilx/ozet", "/mobil-eski/index.html", "/API/MOBIL/ozet", "/api/mobil/../companies",
    "/api/mobil/%2e%2e/companies", "/mobil/..%2f..%2fapi/companies", "/api/mobil/%252e%252e/companies",
    "/api/mobil\\..\\companies", "//api/companies", "/api/bank/summary", "/api/auth/recovery/local-code",
]


def u15():
    s = S("U15", "Tünel yalnız /mobil/ ve /api/mobil/ geçirir (kodlanmış .., önek hilesi, büyük harf, ters bölü)",
          kaynak="iş listesi 'Mobil dalga 2 riskleri' 1")
    s.eslenmis(0, "ayse", "tel1", "K1")
    s.giris(60, "tel1", "ayse", "o1")
    for i, yol in enumerate(YASAK_YOLLAR):
        s.istek(120 + i * 10, "tel1", "o1", "ret:yol_yasak", yol=yol)
    b = 120 + len(YASAK_YOLLAR) * 10
    s.istek(b, "tel1", "o1", "kabul", yol="/api/mobil/ozet")
    s.istek(b + 10, "tel1", "o1", "kabul", yol="/mobil/index.html")
    s.istek(b + 20, "tel1", "o1", "kabul", yol="/mobil/app.js?v=1")
    s.e(b + 30, "istek", bek="ret:oturum_gecersiz", cihaz="tel1", yol="/api/mobil/ozet")
    s.e(b + 40, "istek", bek="kabul", cihaz="tel1", yol="/mobil/index.html")
    s.e(b + 50, "istek", bek="ret:cihaz_yok", cihaz="telX", yol="/api/companies")
    return s


TAKLIT = {"gorunen_adres": "127.0.0.1",
          "basliklar": {"X-Forwarded-For": "127.0.0.1", "X-Real-IP": "127.0.0.1", "Host": "127.0.0.1:3000"}}


def u16():
    s = S("U16", "Tünelden gelen istek 127.0.0.1 görünse de uzaktır: deneme sınırı uygulanır, kurtarma kodu kapalı",
          kaynak="iş listesi 'Mobil dalga 2 riskleri' 2")
    s.eslenmis(0, "ayse", "tel1", "K1")
    for i in range(5):
        s.giris(60 + i * 60, "tel1", "ayse", f"y{i}", parola="yanlis", bek="ret:parola_yanlis", **TAKLIT)
    s.giris(360, "tel1", "ayse", "o1", **TAKLIT,
            bek=lambda p: "ret:deneme_siniri" if p["deneme_siniri"] == 5 else "kabul")
    s.giris(300 + 16 * DK, "tel1", "ayse", "o2", **TAKLIT,
            bek=lambda p: "ret:deneme_siniri" if (p["deneme_siniri"] == 5 and p["kilit_dk"] == 30) else "kabul")
    s.giris(300 + 31 * DK, "tel1", "ayse", "o3", **TAKLIT)
    s.istek(300 + 32 * DK, "tel1", "o3", "ret:yol_yasak", yol="/api/auth/recovery/local-code", **TAKLIT)
    s.istek(300 + 33 * DK, "tel1", "o3", "ret:yol_yasak", yol="/api/mobil/../auth/recovery/local-code", **TAKLIT)
    s.istek(300 + 34 * DK, "tel1", "o3", "ret:yol_yasak", yol="/api/auth/recovery/local-code?yerel=1", **TAKLIT)
    s.istek(300 + 35 * DK, "tel1", "o3", "kabul", sirket="002", yetki="kasa", **TAKLIT)
    return s


def u17():
    s = S("U17", "Deneme sayacı: kullanıcı başına mı cihaz başına mı (P12); başarı sayacı sıfırlar")
    s.eslenmis(0, "ayse", "tel1", "K1")
    s.eslenmis(40, "ayse", "tab1", "K2")
    s.eslenmis(80, "mehmet", "tel2", "K3")
    for i, c in enumerate(("tel1", "tel1", "tel1", "tab1", "tab1")):
        s.giris(100 + i * 10, c, "ayse", f"ya{i}", parola="yanlis", bek="ret:parola_yanlis")
    s.giris(150, "tel1", "ayse", "o1",
            bek=lambda p: "ret:deneme_siniri" if (p["deneme_siniri"] == 5 and p["deneme_anahtari"] == "kullanici")
            else "kabul")
    for i in range(4):
        s.giris(200 + i * 10, "tel2", "mehmet", f"ym{i}", parola="yanlis", bek="ret:parola_yanlis")
    s.giris(240, "tel2", "mehmet", "o2")
    for i in range(5):
        s.giris(250 + i * 10, "tel2", "mehmet", f"yn{i}", parola="yanlis", bek="ret:parola_yanlis")
    s.giris(300, "tel2", "mehmet", "o3", bek=lambda p: "ret:deneme_siniri" if p["deneme_siniri"] == 5 else "kabul")
    return s


def u18():
    s = S("U18", "Yetkisiz şirket / rapor / kasa (canlı ve özet); yetki değişince hemen uygulanır",
          kaynak="mevcut ürün kuralı (görev metni); iş listesi 'Nasıl bozulur?': 'Muhasebe/kısıtlı kullanıcı …'")
    s.eslenmis(0, "ayse", "tel1", "K1")
    s.eslenmis(40, "mehmet", "tel2", "K2")
    s.eslenmis(80, "zeynep", "tel3", "K3")
    s.e(120, "ozet_yukle", bek="kabul")
    s.giris(130, "tel1", "ayse", "o1")
    s.giris(140, "tel2", "mehmet", "o2")
    s.giris(150, "tel3", "zeynep", "o3")
    t = [200]

    def r(c, o, sk, y, bek):
        t[0] += 5
        s.istek(t[0], c, o, bek, sirket=sk, yetki=y)
    r("tel1", "o1", "002", "kasa", "kabul")
    r("tel1", "o1", "001", "kasa", "ret:yetki_yok")
    r("tel1", "o1", "002", "stok", "ret:yetki_yok")
    r("tel1", "o1", "002", "anlik_durum", "ret:yetki_yok")
    r("tel1", "o1", "003", "kasa", "ret:sirket_yok")
    r("tel1", "o1", "002", "rapor:cari-ekstre", "ret:yetki_yok")
    r("tel1", "o1", "002", "cari", "kabul")
    r("tel2", "o2", "001", "stok", "kabul")
    r("tel2", "o2", "002", "stok", "ret:yetki_yok")
    r("tel2", "o2", "001", "rapor:cari-ekstre", "kabul")
    r("tel2", "o2", "001", "rapor:kasa", "ret:yetki_yok")
    r("tel2", "o2", "001", "kasa", "ret:yetki_yok")
    r("tel3", "o3", "001", "taksit", "kabul")
    r("tel3", "o3", "002", "taksit", "kabul")
    r("tel3", "o3", "002", "kasa", "ret:yetki_yok")
    s.e(300, "ozet_oku", bek="kabul", cihaz="tel1", gorunur=AYSE_G)
    s.e(301, "ozet_oku", bek="kabul", cihaz="tel2", gorunur={"001": ["stok"]})
    s.e(302, "ozet_oku", bek="kabul", cihaz="tel3", gorunur={"001": ["taksit"], "002": ["taksit"]})
    s.e(400, "kullanici_degis", bek="kabul", yapan="yon", kullanici="ayse", degisiklik={"sirketler": ["001", "002"]})
    s.istek(410, "tel1", "o1", "kabul", sirket="001", yetki="kasa")
    s.e(420, "ozet_oku", bek="kabul", cihaz="tel1",
        gorunur={"en_az": AYSE_G, "en_cok": {"001": ["cari", "kasa"], "002": ["cari", "kasa"]}})
    s.e(500, "kullanici_degis", bek="kabul", yapan="yon", kullanici="ayse", degisiklik={"sirketler": ["001"]})
    s.istek(510, "tel1", "o1", "ret:yetki_yok", sirket="002", yetki="kasa")
    s.istek(520, "tel1", "o1", "kabul", sirket="001", yetki="kasa")
    s.e(530, "ozet_oku", bek="kabul", cihaz="tel1", gorunur={"en_az": {}, "en_cok": {"001": ["cari", "kasa"]}})
    s.e(600, "kullanici_degis", bek="kabul", yapan="yon", kullanici="mehmet", degisiklik={"yetkiler": ["stok"]})
    s.istek(610, "tel2", "o2", "ret:yetki_yok", sirket="001", yetki="rapor:cari-ekstre")
    s.istek(620, "tel2", "o2", "kabul", sirket="001", yetki="stok")
    s.e(700, "kullanici_degis", bek="kabul", yapan="yon", kullanici="ayse", degisiklik={"sirketler": []})
    s.istek(710, "tel1", "o1", "kabul", sirket="001", yetki="kasa")
    s.istek(720, "tel1", "o1", "ret:yetki_yok", sirket="002", yetki="kasa")
    s.e(800, "ozet_yukle", bek="kabul")
    s.e(810, "ozet_oku", bek="kabul", cihaz="tel1", gorunur={"001": ["cari", "kasa"]}, zaman=[s.t(800)])
    return s


def u19():
    s = S("U19", "Yönetici her şirketi ve Anlık Durum'u görür; rolü düşürülünce hemen kısıtlanır")
    s.eslenmis(0, "yon", "tel1", "K1")
    s.e(60, "ozet_yukle", bek="kabul")
    s.giris(120, "tel1", "yon", "o1")
    s.istek(130, "tel1", "o1", "kabul", sirket="001", yetki="anlik_durum")
    s.istek(140, "tel1", "o1", "kabul", sirket="002", yetki="kasa")
    s.istek(150, "tel1", "o1", "kabul", sirket="002", yetki="rapor:kasa")
    s.istek(160, "tel1", "o1", "ret:sirket_yok", sirket="003", yetki="kasa")
    s.e(170, "ozet_oku", bek="kabul", cihaz="tel1", gorunur={"001": HEPSI, "002": HEPSI})
    s.e(200, "kullanici_degis", bek="kabul", yapan="yon2", kullanici="yon", degisiklik={"rol": "kullanici"})
    s.istek(210, "tel1", "o1", "ret:yetki_yok", sirket="002", yetki="kasa")
    s.istek(220, "tel1", "o1", "ret:yetki_yok", sirket="001", yetki="anlik_durum")
    s.istek(230, "tel1", "o1", "ret:yetki_yok", sirket="001", yetki="kasa")
    s.kod(240, "ayse", "K2", yapan="yon", bek="ret:yetki_yok")
    s.e(250, "cihaz_sil", bek="ret:yetki_yok", yapan="yon", cihaz="tel1")
    s.e(260, "ozet_oku", bek="kabul", cihaz="tel1", gorunur={"001": []})
    # Anlık Durum yalnız yönetici: yetki listesinde olsa da yönetici olmayan göremez (CLAUDE.md 2.4.3 kararı)
    s.eslenmis(300, "muh", "tel2", "K3", yapan="yon2")
    s.e(340, "ozet_yukle", bek="kabul")
    s.giris(350, "tel2", "muh", "o2")
    s.istek(360, "tel2", "o2", "ret:yetki_yok", sirket="001", yetki="anlik_durum")
    s.istek(370, "tel2", "o2", "kabul", sirket="001", yetki="kasa")
    s.istek(380, "tel2", "o2", "kabul", sirket="001", yetki="rapor:kasa")
    s.e(390, "ozet_oku", bek="kabul", cihaz="tel2", gorunur={"001": ["kasa"]}, zaman=[s.t(340)])
    return s


def u20():
    s = S("U20", "Gece yarısı ve ay sonu: karekod ve boşta kalma süresi takvim gününe bağlı değildir",
          bas="2026-11-30T23:50:00+03:00", kaynak="ders 13, 22")
    s.kod(510, "ayse", "K1")                       # 23:58:30
    s.esle(610, "K1", "tel1", esli={"A": 1})       # 00:00:10 (1 Aralık)
    s.giris(620, "tel1", "ayse", "o1")
    s.istek(620 + 14 * DK, "tel1", "o1", "kabul", sirket="002", yetki="kasa")
    s.istek(620 + 29 * DK, "tel1", "o1", sirket="002", yetki="kasa",
            bek=lambda p: "ret:oturum_gecersiz" if p["oturum_bosta"] == 15 else "kabul")
    s.giris(2400, "tel1", "ayse", "o2")
    s.istek(2400 + 29 * DK, "tel1", "o2", sirket="002", yetki="kasa",
            bek=lambda p: "ret:oturum_gecersiz" if p["oturum_bosta"] == 15 else "kabul")
    s.giris(4200, "tel1", "ayse", "o3")
    s.istek(4260, "tel1", "o3", "kabul", sirket="002", yetki="kasa")
    return s


def u21():
    s = S("U21", "Yıl sonu lisans bitişi, UTC ve ofsetsiz yazım", bas="2026-12-31T22:00:00+03:00",
          ofisler={"A": ofis(lisans={"bitis": "2026-12-31T21:00:00Z"})})
    s.eslenmis(0, "ayse", "tel1", "K1")
    s.e(60, "ozet_yukle", bek="kabul")
    s.e(0, "ozet_oku", bek="kabul", cihaz="tel1", t="2026-12-31T23:59:59+03:00")
    s.e(0, "ozet_oku", bek="ret:lisans_gecersiz", cihaz="tel1", t="2026-12-31T21:00:00Z")
    s.e(0, "ozet_oku", bek="ret:lisans_gecersiz", cihaz="tel1", t="2027-01-01T00:00:01")
    s.e(0, "lisans_degis", t="2027-01-01T00:10:00+03:00", lisans={"bitis": "2027-12-31T21:00:00Z"})
    s.e(0, "ozet_oku", bek="kabul", cihaz="tel1", t="2027-01-02T01:00:00+03:00")
    return s


def u22():
    s = S("U22", "İki cihaz aynı anda son yer için eşlenir (gerçek eşzamanlı; ikisi birden sınırı aşamaz)",
          kaynak="görev; ders 31")
    s.eslenmis(0, "ayse", "tel1", "K1")
    s.eslenmis(40, "mehmet", "tel2", "K2")
    s.kod(120, "zeynep", "K3")
    s.kod(130, "yon2", "K4")
    s.e(150, "ozet_yukle", bek="kabul")
    a = s.esle(200, "K3", "tel3", grup="g1", esli={"A": 3},
               bek=lambda p: "kabul|ret:sinir_dolu" if p["sinir_dolunca"] == "reddet" else "kabul")
    b = s.esle(200, "K4", "tel4", grup="g1", esli={"A": 3},
               bek=lambda p: "kabul|ret:sinir_dolu" if p["sinir_dolunca"] == "reddet" else "kabul")
    s.grup_bek["g1"] = lambda p: ([{a: "kabul", b: "ret:sinir_dolu"}, {a: "ret:sinir_dolu", b: "kabul"}]
                                  if p["sinir_dolunca"] == "reddet" else [{a: "kabul", b: "kabul"}])
    s.e(260, "ozet_oku", cihaz="tel1",
        bek=lambda p: "kabul" if p["sinir_dolunca"] == "reddet" else "ret:cihaz_yok",
        zaman=lambda p: [s.t(150), s.t(200)] if p["sinir_dolunca"] == "reddet" else None)
    return s


def u23():
    s = S("U23", "Aynı karekod iki cihazdan aynı anda: yalnız biri eşlenir")
    s.kod(0, "ayse", "K1")
    a = s.esle(60, "K1", "tel1", grup="g2", bek="kabul|ret:kod_gecersiz", esli={"A": 1})
    b = s.esle(60, "K1", "tab1", grup="g2", bek="kabul|ret:kod_gecersiz", esli={"A": 1})
    s.grup_bek["g2"] = [{a: "kabul", b: "ret:kod_gecersiz"}, {a: "ret:kod_gecersiz", b: "kabul"}]
    s.e(90, "ozet_yukle", bek="kabul")
    s.e(120, "ozet_oku", bek="kabul|ret:cihaz_yok", cihaz="tel1", zaman=[s.t(90)], gorunur=AYSE_G)
    return s


def u24():
    s = S("U24", "Uzak oturumun mutlak ömrü (14 dk aralıklı istekler boşta süresini aşmaz) (P8)",
          bas="2026-11-03T08:00:00+03:00")
    s.eslenmis(0, "ayse", "tel1", "K1")
    s.giris(60, "tel1", "ayse", "o1")
    for i in range(1, 54):
        gecen = 840 * i
        s.istek(60 + gecen, "tel1", "o1", sirket="002", yetki="kasa",
                bek=(lambda g: lambda p: "kabul" if g < p["oturum_mutlak"] * SA else "ret:oturum_gecersiz")(gecen))
    return s


def u25():
    s = S("U25", "Cihaz eşlendiği kullanıcıya mı bağlı (P6); oturum başka cihazdan kullanılamaz")
    s.eslenmis(0, "ayse", "tel1", "K1")
    s.eslenmis(40, "mehmet", "tel2", "K2")
    ofisin = (lambda p: p["cihaz_kullanici"] == "ofisin_kullanicilari")
    s.giris(100, "tel1", "mehmet", "o1", bek=lambda p: "kabul" if ofisin(p) else "ret:cihaz_baska_kullanici")
    s.giris(110, "tel1", "ali", "o2", bek=lambda p: "ret:uzaktan_izni_yok" if ofisin(p) else "ret:cihaz_baska_kullanici")
    s.giris(120, "tel1", "ayse", "o3")
    s.istek(130, "tel2", "o3", "ret:oturum_gecersiz", sirket="002", yetki="kasa")
    s.istek(140, "tel1", "o3", "kabul", sirket="002", yetki="kasa")
    s.istek(150, "tel1", "o1", sirket="001", yetki="stok",
            bek=lambda p: "kabul|ret:oturum_gecersiz" if ofisin(p) else "ret:oturum_gecersiz")
    return s


def u26():
    s = S("U26", "'Uzaktan Bağlanabilir' izni kaldırılınca cihazlar ve bekleyen kodlar düşer; yeniden verilince yeniden eşleme",
          kaynak="PRO-UZAKTAN: 'Yeniden eşleme gereken durumlar: … yönetici cihazı ya da izni kaldırır'")
    s.eslenmis(0, "ayse", "tel1", "K1")
    s.giris(60, "tel1", "ayse", "o1")
    s.kod(90, "ayse", "K2")
    s.e(120, "kullanici_degis", bek="kabul", yapan="yon", kullanici="ayse", degisiklik={"uzaktan": False},
        esli={"A": 0})
    s.istek(130, "tel1", "o1", "ret:cihaz_yok", sirket="002", yetki="kasa")
    s.esle(140, "K2", "tab1", bek="ret:kod_gecersiz")
    s.kod(150, "ayse", "K3", bek="ret:uzaktan_izni_yok")
    s.e(160, "kullanici_degis", bek="kabul", yapan="yon", kullanici="ayse", degisiklik={"uzaktan": True})
    s.istek(170, "tel1", "o1", "ret:cihaz_yok", sirket="002", yetki="kasa")
    s.eslenmis(180, "ayse", "tel1b", "K4", esli={"A": 1})
    return s


def u27():
    s = S("U27", "Karekodu yalnız yönetici, yalnız izinli kullanıcıya üretir; silme/izin değişikliği yönetici işidir",
          kaynak="PRO-UZAKTAN: 'Yönetici \"Cihaz ekle\"'; 'İşaretsiz olan için QR üretilemez'")
    s.kod(0, "ayse", "K1", yapan="mehmet", bek="ret:yetki_yok")
    s.kod(10, "ali", "K2", bek="ret:uzaktan_izni_yok")
    s.eslenmis(20, "ayse", "tel1", "K3")
    s.e(60, "cihaz_sil", bek="ret:yetki_yok", yapan="mehmet", cihaz="tel1", esli={"A": 1})
    s.e(70, "kullanici_degis", bek="ret:yetki_yok", yapan="ayse", kullanici="mehmet", degisiklik={"uzaktan": False})
    s.esle(80, "K1", "telx", bek="ret:kod_gecersiz")
    s.esle(90, "K2", "tely", bek="ret:kod_gecersiz", esli={"A": 1})
    return s


def u28():
    s = S("U28", "Kapıcı sınırı tek başına uygular (program atlatılırsa doğrudan kayıt)",
          kaynak="KARAR 26.10: 'Sınır programda VE kapıcıda (Worker) uygulanır'")
    s.eslenmis(0, "ayse", "tel1", "K1")
    s.eslenmis(40, "mehmet", "tel2", "K2")
    s.e(80, "kapici_dogrudan_kayit", bek="kabul", cihaz="tel3", kullanici="zeynep", esli={"A": 3})
    s.e(120, "kapici_dogrudan_kayit", cihaz="tel4", kullanici="ayse", esli={"A": 3},
        bek=lambda p: "ret:sinir_dolu" if p["sinir_dolunca"] == "reddet" else "kabul",
        dusen=lambda p: ["tel1"] if p["sinir_dolunca"] == "en_eskiyi_dusur" else None)
    s.e(160, "cihaz_sil", bek="kabul", yapan="yon", cihaz="tel2", esli={"A": 2})
    s.e(200, "kapici_dogrudan_kayit", bek="kabul", cihaz="tel5", kullanici="mehmet", esli={"A": 3})
    return s


def u29():
    s = S("U29", "Lisanstaki cihaz sayısı düşer / yükselir (P5); değişiklik önbellek süresinden sonra okunur",
          kaynak="KARAR 26.10: 'Lisansta sayı alanı (varsayılan 3)'")
    s.eslenmis(0, "ayse", "tel1", "K1")
    s.eslenmis(60, "mehmet", "tel2", "K2")
    s.eslenmis(120, "zeynep", "tel3", "K3", esli={"A": 3})
    s.e(200, "ozet_yukle", bek="kabul")
    s.e(300, "lisans_degis", lisans={"cihaz_siniri": 2})
    s.e(300, "program_lisans_denetle")
    T = 300 + 25 * SA
    durur = (lambda p: p["sinir_dusunce"] == "en_yeniler_durur")
    s.e(T, "ozet_oku", bek="kabul", cihaz="tel1")
    s.e(T + 10, "ozet_oku", bek="kabul", cihaz="tel2")
    s.e(T + 20, "ozet_oku", cihaz="tel3", bek=lambda p: "ret:sinir_asimi" if durur(p) else "kabul")
    s.kod(T + 30, "yon2", "K4", bek=lambda p: "ret:sinir_dolu" if red_uretimde(p) else "kabul")

    def b(p):
        if p["sinir_dolunca"] == "en_eskiyi_dusur":
            return "kabul"
        return "ret:kod_gecersiz" if p["uretimde_sinir"] == "denetler" else "ret:sinir_dolu"
    s.esle(T + 60, "K4", "tel4", bek=b,
           esli=lambda p: {"A": 2 if p["sinir_dolunca"] == "en_eskiyi_dusur" else 3},
           dusen=lambda p: ["tel1", "tel2"] if p["sinir_dolunca"] == "en_eskiyi_dusur" else None)
    s.e(T + 90, "ozet_oku", cihaz="tel3",
        bek=lambda p: "ret:sinir_asimi" if (p["sinir_dolunca"] == "reddet" and durur(p)) else "kabul")
    s.e(T + 120, "lisans_degis", lisans={"cihaz_siniri": 3})
    s.e(T + 120, "program_lisans_denetle")
    s.e(T + 120 + 25 * SA, "ozet_oku", bek="kabul", cihaz="tel3")
    return s


def u30():
    s = S("U30", "Boş veri: hiç özet yüklenmemiş ofiste eşleme ve okuma; eşlenmemiş cihaz")
    s.eslenmis(0, "ayse", "tel1", "K1")
    s.e(60, "ozet_oku", bek="kabul|ret:ozet_yok", cihaz="tel1", zaman=[s.t(30)],
        gorunur={"en_az": {}, "en_cok": AYSE_G})
    s.e(70, "ozet_oku", bek="ret:cihaz_yok", cihaz="telX")
    s.e(120, "ozet_yukle", bek="kabul")
    s.e(180, "ozet_oku", bek="kabul", cihaz="tel1", zaman=[s.t(120)], gorunur=AYSE_G)
    return s


def u31():
    s = S("U31", "Eşleme sunucu kapalıyken yapılamaz; açılınca aynı kod süresi içinde kullanılır")
    s.kod(0, "ayse", "K1")
    s.e(30, "sunucu", durum="kapali")
    s.esle(60, "K1", "tel1", bek="ret:sunucu_kapali", esli={"A": 0})
    s.e(90, "sunucu", durum="acik")
    s.esle(100, "K1", "tel1b", esli={"A": 1})
    return s


def u32():
    s = S("U32", "Aynı cihazda yeniden giriş: eski oturumun sürüp sürmediği belirsiz (V14), yenisi geçerli")
    s.eslenmis(0, "ayse", "tel1", "K1")
    s.giris(60, "tel1", "ayse", "o1")
    s.istek(70, "tel1", "o1", "kabul", sirket="002", yetki="kasa")
    s.giris(80, "tel1", "ayse", "o2")
    s.istek(90, "tel1", "o1", "kabul|ret:oturum_gecersiz", sirket="002", yetki="kasa")
    s.istek(100, "tel1", "o2", "kabul", sirket="002", yetki="kasa")
    return s


def u33():
    s = S("U33", "Aynı anda (aynı saniye) silme ve istek: sınıf sırası yönetim → istek (ders 31)")
    s.eslenmis(0, "ayse", "tel1", "K1")
    s.giris(60, "tel1", "ayse", "o1")
    s.istek(120, "tel1", "o1", "ret:cihaz_yok", sirket="002", yetki="kasa")
    s.e(120, "cihaz_sil", bek="kabul", yapan="yon", cihaz="tel1", esli={"A": 0})
    return s


EL_SENARYOLARI = [u01, u02, u03, u04, u05, u06, u07, u08, u09, u10, u11, u12, u13, u14, u15, u16, u17, u18, u19,
                  u20, u21, u22, u23, u24, u25, u26, u27, u28, u29, u30, u31, u32, u33]


# ===============================================================================================================
# TOHUMLU RASTGELE ÜRETİCİ. Her ofis bir "şerit"; şeritte akışlar sırayla, şeritler zamanda iç içe. Her akış kendi
# beklentisini kendi kapalı kuralıyla yazar (modelin kodunu kullanmaz; yetki kuralı ayrıca yeniden yazıldı).
# Akış sonunda şerit temizlenir (cihazlar silinir), bir sonraki akış temiz şeritte başlar.
# ===============================================================================================================
STD = kullanicilar_std()
BOLUMLER = ["anlik_durum", "cari", "kasa", "stok", "taksit"]


def g_etkin(u):
    k = STD[u]
    if k.get("rol") == "yonetici":
        return ["001", "002"]
    s = [x for x in k.get("sirketler", []) if x in ("001", "002")]
    return s if s else ["001"]


def g_istek(u, sirket, yetki):
    k = STD[u]
    if sirket == "003":
        return "ret:sirket_yok"
    if k.get("rol") == "yonetici":
        return "kabul"
    if sirket not in g_etkin(u):
        return "ret:yetki_yok"
    if yetki is None:
        return "kabul"
    if yetki == "anlik_durum":
        return "ret:yetki_yok"
    return "kabul" if yetki in k.get("yetkiler", []) else "ret:yetki_yok"


def g_gorunur(u):
    k = STD[u]
    yon = k.get("rol") == "yonetici"
    return {s: [b for b in BOLUMLER if yon or (b != "anlik_durum" and b in k.get("yetkiler", []))] for s in g_etkin(u)}


UZAK = ["ayse", "mehmet", "zeynep", "yon2", "yon", "muh"]
YETKI_SEC = ["kasa", "cari", "stok", "taksit", "anlik_durum", "rapor:cari-ekstre", "rapor:kasa", None]


class Uretici:
    def __init__(self, tohum):
        self.r = random.Random(tohum)
        self.tohum = tohum
        self.ofisler = [f"O{i}" for i in range(1, 7)]
        self.s = S(f"R{tohum}", f"Tohum {tohum}: 6 ofis, şerit başına 8–12 akış, ay sonu ve gece yarısı geçişli",
                   bas="2026-11-28T21:00:00+03:00", ofisler={o: ofis() for o in self.ofisler})
        self.n = 0

    def ad(self, on):
        self.n += 1
        return f"{on}{self.tohum}-{self.n}"

    def e(self, o, t, olay, **k):
        return self.s.e(t, olay, ofis=o, **k)

    def eslenmis(self, o, t, u):
        kod, c = self.ad("K"), self.ad(o + "c")
        self.e(o, t, "karekod_uret", bek="kabul", yapan="yon", kullanici=u, kod=kod)
        self.e(o, t + 20, "esle", bek="kabul", kod=kod, cihaz=c, cihaz_turu=self.r.choice(["telefon", "tablet", "tarayici"]))
        return c

    def sil(self, o, t, c, bek="kabul", esli=None):
        self.e(o, t, "cihaz_sil", bek=bek, yapan="yon", cihaz=c, esli=esli)

    # ---- akışlar: (o, t) alır, bitiş anını döndürür
    def f_sure(self, o, t):
        u = self.r.choice(UZAK)
        d = self.r.choice([30, 90, 150, 240, 299, 420, 590, 700])
        kod, c = self.ad("K"), self.ad(o + "c")
        self.e(o, t, "karekod_uret", bek="kabul", yapan="yon", kullanici=u, kod=kod)
        tamam = (lambda p, d=d: d < p["kod_sure"] * 60)
        self.e(o, t + d, "esle", kod=kod, cihaz=c, bek=lambda p: "kabul" if tamam(p) else "ret:kod_gecersiz",
               esli=lambda p: {o: 1 if tamam(p) else 0})
        self.sil(o, t + d + 30, c, bek=lambda p: "kabul" if tamam(p) else "ret:cihaz_yok", esli={o: 0})
        return t + d + 60

    def f_tekrar(self, o, t):
        u = self.r.choice(UZAK)
        kod, c1, c2 = self.ad("K"), self.ad(o + "c"), self.ad(o + "c")
        self.e(o, t, "karekod_uret", bek="kabul", yapan="yon", kullanici=u, kod=kod)
        self.e(o, t + 20, "esle", bek="kabul", kod=kod, cihaz=c1, esli={o: 1})
        self.e(o, t + 40, "esle", bek="ret:kod_gecersiz", kod=kod, cihaz=c2, esli={o: 1})
        self.e(o, t + 60, "ozet_yukle", bek="kabul")
        self.e(o, t + 70, "ozet_oku", bek="kabul", cihaz=c1, zaman=[self.s.t(t + 60)], gorunur=g_gorunur(u))
        self.sil(o, t + 80, c1, esli={o: 0})
        self.e(o, t + 90, "ozet_oku", bek="ret:cihaz_yok", cihaz=c1)
        return t + 100

    def f_yenikod(self, o, t):
        u = self.r.choice(UZAK)
        k1, k2, c1, c2 = self.ad("K"), self.ad("K"), self.ad(o + "c"), self.ad(o + "c")
        self.e(o, t, "karekod_uret", bek="kabul", yapan="yon", kullanici=u, kod=k1)
        self.e(o, t + 10, "karekod_uret", bek="kabul", yapan="yon", kullanici=u, kod=k2)
        etmez = (lambda p: p["yeni_kod_eskiyi"] == "etmez")
        self.e(o, t + 20, "esle", kod=k1, cihaz=c1, bek=lambda p: "kabul" if etmez(p) else "ret:kod_gecersiz")
        self.e(o, t + 30, "esle", bek="kabul", kod=k2, cihaz=c2, esli=lambda p: {o: 2 if etmez(p) else 1})
        self.sil(o, t + 40, c1, bek=lambda p: "kabul" if etmez(p) else "ret:cihaz_yok")
        self.sil(o, t + 50, c2, esli={o: 0})
        return t + 60

    def f_dolu(self, o, t):
        us = self.r.sample(UZAK, 4)
        cs = [self.eslenmis(o, t + 40 * i, us[i]) for i in range(3)]
        dus = (lambda p: p["sinir_dolunca"] == "en_eskiyi_dusur")
        c4 = self.ad(o + "c")
        if self.r.random() < 0.5:
            kod = self.ad("K")
            self.e(o, t + 120, "karekod_uret", yapan="yon", kullanici=us[3], kod=kod,
                   bek=lambda p: "ret:sinir_dolu" if red_uretimde(p) else "kabul")
            self.e(o, t + 140, "esle", kod=kod, cihaz=c4, esli={o: 3},
                   bek=lambda p: "kabul" if dus(p) else ("ret:kod_gecersiz" if p["uretimde_sinir"] == "denetler"
                                                         else "ret:sinir_dolu"),
                   dusen=lambda p: [cs[0]] if dus(p) else None)
        else:
            self.e(o, t + 140, "kapici_dogrudan_kayit", cihaz=c4, kullanici=us[3], esli={o: 3},
                   bek=lambda p: "kabul" if dus(p) else "ret:sinir_dolu",
                   dusen=lambda p: [cs[0]] if dus(p) else None)
        self.sil(o, t + 160, cs[0], bek=lambda p: "ret:cihaz_yok" if dus(p) else "kabul")
        self.sil(o, t + 170, cs[1])
        self.sil(o, t + 180, cs[2])
        self.sil(o, t + 190, c4, bek=lambda p: "kabul" if dus(p) else "ret:cihaz_yok", esli={o: 0})
        return t + 200

    def f_eszamanli(self, o, t):
        us = self.r.sample(UZAK, 4)
        c1 = self.eslenmis(o, t, us[0])
        c2 = self.eslenmis(o, t + 40, us[1])
        k3, k4, c3, c4 = self.ad("K"), self.ad("K"), self.ad(o + "c"), self.ad(o + "c")
        self.e(o, t + 80, "karekod_uret", bek="kabul", yapan="yon", kullanici=us[2], kod=k3)
        self.e(o, t + 90, "karekod_uret", bek="kabul", yapan="yon", kullanici=us[3], kod=k4)
        red = (lambda p: p["sinir_dolunca"] == "reddet")
        g = self.ad("g")
        b = (lambda p: "kabul|ret:sinir_dolu" if red(p) else "kabul")
        a1 = self.e(o, t + 120, "esle", kod=k3, cihaz=c3, grup=g, bek=b, esli={o: 3})
        a2 = self.e(o, t + 120, "esle", kod=k4, cihaz=c4, grup=g, bek=b, esli={o: 3})
        self.s.grup_bek[g] = (lambda p: [{a1: "kabul", a2: "ret:sinir_dolu"}, {a1: "ret:sinir_dolu", a2: "kabul"}]
                              if red(p) else [{a1: "kabul", a2: "kabul"}])
        self.sil(o, t + 150, c1, bek=lambda p: "kabul" if red(p) else "ret:cihaz_yok")
        self.sil(o, t + 160, c2)
        self.sil(o, t + 170, c3, bek=lambda p: "kabul|ret:cihaz_yok" if red(p) else "kabul")
        self.sil(o, t + 180, c4, bek=lambda p: "kabul|ret:cihaz_yok" if red(p) else "kabul", esli={o: 0})
        return t + 200

    def f_yetki(self, o, t):
        u = self.r.choice(UZAK)
        c = self.eslenmis(o, t, u)
        ot = self.ad(o + "o")
        self.e(o, t + 40, "giris", bek="kabul", cihaz=c, kullanici=u, parola="dogru", oturum=ot)
        self.e(o, t + 50, "ozet_yukle", bek="kabul")
        self.e(o, t + 60, "ozet_oku", bek="kabul", cihaz=c, gorunur=g_gorunur(u), zaman=[self.s.t(t + 50)])
        z = t + 60
        for _ in range(self.r.randint(6, 12)):
            z += 30
            sk = self.r.choice(["001", "002", "003"])
            y = self.r.choice(YETKI_SEC)
            self.e(o, z, "istek", bek=g_istek(u, sk, y), cihaz=c, oturum=ot, yol="/api/mobil/rapor", sirket=sk, yetki=y)
        self.sil(o, z + 30, c, esli={o: 0})
        return z + 40

    def f_yol(self, o, t):
        u = self.r.choice(UZAK)
        c = self.eslenmis(o, t, u)
        ot = self.ad(o + "o")
        self.e(o, t + 40, "giris", bek="kabul", cihaz=c, kullanici=u, parola="dogru", oturum=ot)
        z = t + 40
        for _ in range(self.r.randint(4, 8)):
            z += 20
            secim = self.r.random()
            if secim < 0.6:
                self.e(o, z, "istek", bek="ret:yol_yasak", cihaz=c, oturum=ot, yol=self.r.choice(YASAK_YOLLAR))
            elif secim < 0.8:
                self.e(o, z, "istek", bek="kabul", cihaz=c, oturum=ot, yol="/api/mobil/ozet")
            elif secim < 0.9:
                self.e(o, z, "istek", bek="kabul", cihaz=c, yol="/mobil/index.html")
            else:
                self.e(o, z, "istek", bek="ret:oturum_gecersiz", cihaz=c, yol="/api/mobil/ozet")
        self.sil(o, z + 20, c, esli={o: 0})
        return z + 30

    def f_izin(self, o, t):
        u = self.r.choice(["ayse", "mehmet", "zeynep"])
        c = self.eslenmis(o, t, u)
        ot = self.ad(o + "o")
        self.e(o, t + 40, "giris", bek="kabul", cihaz=c, kullanici=u, parola="dogru", oturum=ot)
        self.e(o, t + 60, "kullanici_degis", bek="kabul", yapan="yon", kullanici=u, degisiklik={"uzaktan": False},
               esli={o: 0})
        sk = g_etkin(u)[0]
        self.e(o, t + 70, "istek", bek="ret:cihaz_yok", cihaz=c, oturum=ot, yol="/api/mobil/rapor", sirket=sk)
        self.e(o, t + 80, "karekod_uret", bek="ret:uzaktan_izni_yok", yapan="yon", kullanici=u, kod=self.ad("K"))
        self.e(o, t + 90, "kullanici_degis", bek="kabul", yapan="yon", kullanici=u, degisiklik={"uzaktan": True})
        return t + 100

    def f_oturum(self, o, t):
        u = self.r.choice(UZAK)
        c = self.eslenmis(o, t, u)
        ot = self.ad(o + "o")
        self.e(o, t + 40, "giris", bek="kabul", cihaz=c, kullanici=u, parola="dogru", oturum=ot)
        izinli = [(s, y) for s in ("001", "002") for y in YETKI_SEC if g_istek(u, s, y) == "kabul"]
        araliklar = []
        z = t + 40
        for _ in range(self.r.randint(3, 8)):
            g = self.r.choice([5, 10, 14, 16, 20, 29, 31, 40])
            araliklar.append(g)
            z += g * DK
            sk, y = self.r.choice(izinli)
            gs = list(araliklar)
            self.e(o, z, "istek", cihaz=c, oturum=ot, yol="/api/mobil/rapor", sirket=sk, yetki=y,
                   bek=lambda p, gs=gs: "kabul" if all(x < p["oturum_bosta"] for x in gs) else "ret:oturum_gecersiz")
        self.sil(o, z + 30, c, esli={o: 0})
        return z + 40

    def f_deneme(self, o, t):
        u = self.r.choice(UZAK)
        c = self.eslenmis(o, t, u)
        k = self.r.randint(3, 12)
        taklit = TAKLIT if self.r.random() < 0.5 else {}
        b = t + 60
        for j in range(k):
            self.e(o, b + j * 60, "giris", cihaz=c, kullanici=u, parola="yanlis", oturum=self.ad(o + "y"), **taklit,
                   bek=lambda p, j=j: "ret:parola_yanlis" if j < p["deneme_siniri"] else "ret:deneme_siniri")
        kilitli = (lambda p, k=k: k >= p["deneme_siniri"])
        self.e(o, b + k * 60, "giris", cihaz=c, kullanici=u, parola="dogru", oturum=self.ad(o + "o"), **taklit,
               bek=lambda p: "ret:deneme_siniri" if kilitli(p) else "kabul")
        son = b + (k - 1) * 60
        self.e(o, son + 16 * DK, "giris", cihaz=c, kullanici=u, parola="dogru", oturum=self.ad(o + "o"), **taklit,
               bek=lambda p: "ret:deneme_siniri" if (kilitli(p) and p["kilit_dk"] == 30) else "kabul")
        self.e(o, son + 31 * DK, "giris", bek="kabul", cihaz=c, kullanici=u, parola="dogru", oturum=self.ad(o + "o"),
               **taklit)
        self.sil(o, son + 32 * DK, c, esli={o: 0})
        return son + 33 * DK

    def f_sunucu(self, o, t):
        u = self.r.choice(UZAK)
        c = self.eslenmis(o, t, u)
        ot = self.ad(o + "o")
        self.e(o, t + 40, "giris", bek="kabul", cihaz=c, kullanici=u, parola="dogru", oturum=ot)
        self.e(o, t + 60, "ozet_yukle", bek="kabul")
        self.e(o, t + 120, "sunucu", durum="kapali")
        x = self.r.choice([10 * DK, 2 * GUN, 29 * GUN, 31 * GUN, 40 * GUN])
        z = t + 120 + x
        yas = x + 60
        eski = (lambda p: yas >= 30 * GUN and p["ozet_yas_siniri"] == 30)
        self.e(o, z, "ozet_oku", cihaz=c, zaman=lambda p: None if eski(p) else [self.s.t(t + 60)],
               bek=lambda p: "ret:ozet_eski" if eski(p) else "kabul")
        sk = g_etkin(u)[0]
        self.e(o, z + 10, "istek", bek="ret:sunucu_kapali", cihaz=c, oturum=ot, yol="/api/mobil/rapor", sirket=sk)
        self.e(o, z + 20, "istek", bek="ret:sunucu_kapali", cihaz=c, oturum=ot, yol="/api/mobil/tahsilat", sirket=sk,
               yetki="tahsilat", yazma=True)
        self.e(o, z + 30, "ozet_yaz", bek="ret:yazma_yasak", cihaz=c)
        self.e(o, z + 40, "giris", bek="ret:sunucu_kapali", cihaz=c, kullanici=u, parola="dogru", oturum=self.ad(o + "o"))
        self.e(o, z + 60, "sunucu", durum="acik")
        o2 = self.ad(o + "o")
        self.e(o, z + 70, "giris", bek="kabul", cihaz=c, kullanici=u, parola="dogru", oturum=o2)
        self.e(o, z + 80, "istek", bek="kabul", cihaz=c, oturum=o2, yol="/api/mobil/rapor", sirket=sk)
        self.sil(o, z + 90, c, esli={o: 0})
        return z + 100

    def f_lisans(self, o, t):
        u = self.r.choice(UZAK)
        c = self.eslenmis(o, t, u)
        self.e(o, t + 60, "ozet_yukle", bek="kabul")
        T = t + 2 * SA
        bir = (lambda p: p["lisans_onbellek"] == 1)
        self.e(o, T, "lisans_degis", lisans={"durum": "engelli"})
        self.e(o, T, "program_lisans_denetle")
        self.e(o, T + 30 * DK, "ozet_oku", bek="kabul|ret:lisans_gecersiz", cihaz=c)
        self.e(o, T + 61 * DK, "ozet_oku", cihaz=c,
               bek=lambda p: "ret:lisans_gecersiz" if bir(p) else "kabul|ret:lisans_gecersiz")
        self.e(o, T + 25 * SA, "ozet_oku", bek="ret:lisans_gecersiz", cihaz=c, esli={o: 1})
        T2 = T + 26 * SA
        self.e(o, T2, "lisans_degis", lisans={"durum": "gecerli"})
        self.e(o, T2, "program_lisans_denetle")
        self.e(o, T2 + 30 * DK, "ozet_oku", bek="kabul|ret:lisans_gecersiz", cihaz=c)
        self.e(o, T2 + 61 * DK, "ozet_oku", cihaz=c, bek=lambda p: "kabul" if bir(p) else "kabul|ret:lisans_gecersiz")
        self.e(o, T2 + 25 * SA, "ozet_oku", bek="kabul", cihaz=c, zaman=[self.s.t(t + 60)], esli={o: 1})
        self.sil(o, T2 + 25 * SA + 60, c, esli={o: 0})
        return T2 + 25 * SA + 120

    AKISLAR = ["f_sure", "f_tekrar", "f_yenikod", "f_dolu", "f_eszamanli", "f_yetki", "f_yol", "f_izin", "f_oturum",
               "f_deneme", "f_sunucu", "f_lisans"]

    def kur(self):
        for o in self.ofisler:
            z = self.r.randint(0, 2 * SA)
            for _ in range(self.r.randint(8, 12)):
                akis = self.r.choice(self.AKISLAR)
                z = getattr(self, akis)(o, z)
                z += self.r.choice([60, 10 * DK, SA, 5 * SA, 26 * SA])
        return self.s


def uret(tohum):
    return Uretici(tohum).kur()


def tum_senaryolar(tohumlar=(1, 2, 3)):
    el = [f() for f in EL_SENARYOLARI]
    uretilen = [uret(t) for t in tohumlar] if "uret" in globals() else []
    return el + uretilen


def rastgele_birlesimler(tohum):
    """Rastgele senaryoların tam karar ağacı binlerce yaprak (dakikalar) — bunun yerine: öneri, her parametrenin tek tek
    öneri dışı değeri, bütün öneri dışı (karşıt) birleşimler ve tohumdan 8 rastgele tam birleşim."""
    oneri = K.oneri_birlesimi()
    liste = [dict(oneri)]
    for k, v in K.PARAMETRELER.items():
        for d in v["degerler"]:
            if d != v["oneri"]:
                liste.append({**oneri, k: d})
    for ks in [d for d in K.PARAMETRELER["kod_sure"]["degerler"] if d != oneri["kod_sure"]]:
        karsit = {k: next(d for d in v["degerler"] if d != v["oneri"]) for k, v in K.PARAMETRELER.items()}
        karsit["kod_sure"] = ks
        liste.append(karsit)
    r = random.Random(1000 + tohum)
    for _ in range(8):
        liste.append({k: r.choice(v["degerler"]) for k, v in K.PARAMETRELER.items()})
    tekil = []
    for a in liste:
        if a not in tekil:
            tekil.append(a)
    return tekil


def yapraklar(s, mut=None, sabit=None):
    if s.ad.startswith("R") and sabit is None:
        tohum = int(s.ad[1:])
        sonuc = []
        for a in rastgele_birlesimler(tohum):
            sonuc.extend(K.agac(s.senaryo(), mut=mut, sabit=a))
        return sonuc
    return K.agac(s.senaryo(), mut=mut, sabit=sabit)


def denetle(senaryolar, mut=None, sabit=None, ayrinti=True):
    """Her senaryoda model (karar ağacının her yaprağı) = elle/üretici beklentisi mi? Dönen: (sonuçlar, fark sayısı)."""
    sonuclar = []
    toplam_fark = 0
    for s in senaryolar:
        yap = yapraklar(s, mut=mut, sabit=sabit)
        f = beklenti_farklari(s.bek, s.grup_bek, yap)
        toplam_fark += len(f)
        sonuclar.append((s, yap, f))
        if ayrinti and f:
            print(f"# FARK {s.ad}: {len(f)}")
            for x in f[:12]:
                print("#   " + x)
    return sonuclar, toplam_fark


def kabul_json(sonuclar):
    ilgili = {}
    senaryolar = []
    for s, yap, _ in sonuclar:
        d = s.senaryo()
        if s.ad.startswith("R"):
            oneri = K.oneri_birlesimi()
            d["denetlenen_birlesimler"] = [K.birlesim_metni(a) for a, _ in yap]
            d["cikti_oneri"] = next(c for a, c in yap if a == oneri)
            birlesik = {}
            for _, c in yap:
                for no, o in c["olaylar"].items():
                    birlesik.setdefault(no, set()).update(o["sonuc"])
            d["sonuc_denetlenen_birlesimlerde"] = {no: sorted(v) for no, v in birlesik.items()}
        else:
            okunan = sorted({k for a, _ in yap for k in a}, key=K.PARAM_SIRASI.index)
            d["ilgili_parametreler"] = okunan
            d["yaprak_sayisi"] = len(yap)
            d["gruplar"] = K.gruplu(yap)
        senaryolar.append(d)
    return {
        "dil": K.DIL,
        "aciklama": "Mobil uzaktan erişim (2.4.7 M2 + M3/M4 erişim denetimi) temiz oda kâhini; README.md",
        "parametreler": K.PARAMETRELER,
        "oneri_birlesim": K.birlesim_metni(K.oneri_birlesimi()),
        "secilen_birlesim": None,
        "secilen_birlesim_notu": "AÇIK SORULAR kullanıcıya soruldu; yanıta kadar karşılaştırma öneri birleşimiyle yapılır",
        "senaryolar": senaryolar,
    }


def ana(argv):
    yazma = "--denetim" not in argv
    senaryolar = tum_senaryolar()
    sonuclar, fark = denetle(senaryolar)
    olay = sum(len(s.olaylar) for s in senaryolar)
    yaprak = sum(len(y) for _, y, _ in sonuclar)
    print(f"# senaryo {len(senaryolar)} · olay {olay} · yaprak {yaprak} · fark {fark}")
    if fark:
        print("# model ≠ elle/üretici beklentisi → kabul.json YAZILMADI")
        return 1
    if yazma:
        yol = os.path.join(BURASI, "kabul.json")
        with open(yol, "w", encoding="utf-8") as f:
            json.dump(kabul_json(sonuclar), f, ensure_ascii=False, sort_keys=True, separators=(",", ":"))
            f.write("\n")
        print(f"# yazıldı: {yol} ({os.path.getsize(yol)} bayt)")
    return 0


if __name__ == "__main__":
    sys.exit(ana(sys.argv))
