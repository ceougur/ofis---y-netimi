# -*- coding: utf-8 -*-
"""Mobil erişim kâhininin kendi testi + mutasyon testi (TAP; sonda # tests/pass/fail).

A girdi doğrulama · B elle senaryolar (karar ağacının her yaprağı) · C rastgele senaryolar (25 birleşim) ·
D değişmezler · E komut satırı ve gözlemle süzme · F mutasyonlar (her biri en az bir beklentiyle yakalanmalı).

Kırmızı kanıt için: MOBIL_KAHIN_MUT=M06 python3 -I kahin_test.py  → A–E bozuk modelle koşar, kırmızı olmalı.
"""
import copy
import importlib.util
import json
import os
import random
import subprocess
import sys
import tempfile

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
S = _yukle("senaryolar")
BOZUK = os.environ.get("MOBIL_KAHIN_MUT") or None

MUTASYONLAR = {
    "M01": "karekod süresi denetlenmez",
    "M02": "karekod tek kullanımlık değil",
    "M03": "karekod süresi dolduğu an hâlâ geçerli",
    "M04": "başka ofisin karekodu kabul edilir",
    "M05": "yeni karekod eskiyi iptal (P2) ters",
    "M06": "cihaz sınırı yok",
    "M07": "sınır şirket başına sayılır",
    "M08": "sınır kullanıcı başına sayılır",
    "M09": "sınır dolunca davranışı (P3) ters",
    "M10": "silinen cihaz kapıcıdan geçer",
    "M11": "silinince oturum sürer ve kapıcı oturumu görünce cihazı denetlemez",
    "M12": "silinen cihaz yer tutar",
    "M13": "izin kaldırılınca cihazlar ve kodlar düşmez",
    "M14": "karekodu yönetici olmayan da üretir",
    "M15": "uzaktan izni olmayana karekod üretilir",
    "M16": "üretimde sınır denetimi (P4) ters",
    "M17": "kapıcı lisans önbelleği sonsuza dek",
    "M18": "lisans engeli görülmez",
    "M19": "lisans bitiş tarihi denetlenmez",
    "M20": "kapıcı en eski lisans kaydına takılır (yenileme görülmez)",
    "M21": "lisans servisine ulaşılamazken kabul (fail-open)",
    "M22": "yol öneki bölüm sınırında değil (/api/mobilx geçer)",
    "M23": "yol çözülmeden denetlenir (kodlanmış .. geçer)",
    "M24": "yöneticinin ayrıcalığı yok",
    "M25": "şirket kutusu işaretsiz kullanıcı bütün şirketleri görür",
    "M26": "Anlık Durum yönetici dışına açık",
    "M27": "127.0.0.1 görünen tünel isteği yerel sayılır (deneme sınırı yok)",
    "M28": "kurtarma kodu yolu tünelde açık",
    "M29": "başarılı giriş deneme sayacını sıfırlamaz",
    "M30": "kilitliyken doğru parola kabul",
    "M31": "deneme anahtarı (P12) ters",
    "M32": "oturum boşta süresi denetlenmez",
    "M33": "oturum mutlak ömrü denetlenmez",
    "M34": "oturum cihaza bağlı değil",
    "M35": "cihaz-kullanıcı bağı (P6) ters",
    "M36": "sunucu kapalıyken yazma kabul",
    "M37": "sunucu kapalıyken özet okunamaz",
    "M38": "özet yaş sınırı (P10) ters",
    "M39": "özet okumada lisans denetlenmez",
    "M40": "cihaz özete yazabilir",
    "M41": "yetki değişince eski görünüm görünür",
    "M42": "sınır düşünce davranışı (P5) ters",
    "M43": "lisans bitince eşlemeler silinir",
    "M44": "eşleme sunucu kapalıyken kabul",
    "M45": "aynı saniyede eşlenenler sayılmaz (yarış)",
    "M46": "kapıcı doğrudan kayıtta sınırı denetlemez",
    "M47": "olmayan şirket (003) denetlenmez",
    "M48": "kilit süresi (P13) ters",
    "M49": "ret önceliği: yol cihazdan önce",
    "M51": "lisans bitiş anı dahil geçerli",
    "M52": "boşta süresi dolduğu an hâlâ geçerli",
    "M53": "deneme kilidi hiç bitmez",
    "M54": "yeniden başlatmada oturum kesin düşer (belirsizlik daraltılır)",
    "M56": "özet görünümü cihazın kullanıcısı yerine yöneticinin",
    "M57": "Pro kilidi: Standart lisansta mobil kapalı (26.10 kararına aykırı)",
}

sonuclar = []


def tap(ad, ok, ayrinti=""):
    sonuclar.append(ok)
    n = len(sonuclar)
    print(f"{'ok' if ok else 'not ok'} {n} - {ad}")
    if not ok and ayrinti:
        for satir in str(ayrinti).splitlines()[:15]:
            print("  # " + satir)


EL = [f() for f in S.EL_SENARYOLARI]
RASTGELE = [S.uret(t) for t in (1, 2, 3)]


# ------------------------------------------------------------------------------------------------- A
def taban():
    return S.u01().senaryo()


def a_girdi():
    durumlar = []

    def bozuk(ad, f):
        s = copy.deepcopy(taban())
        f(s)
        durumlar.append((ad, s, True))
    bozuk("bilinmeyen olay", lambda s: s["olaylar"].append({"no": 99, "t": s["olaylar"][0]["t"], "olay": "uç"}))
    bozuk("bilinmeyen alan", lambda s: s["olaylar"][0].__setitem__("fazla", 1))
    bozuk("eksik alan", lambda s: s["olaylar"][1].pop("kod"))
    bozuk("geçersiz saat", lambda s: s["olaylar"][0].__setitem__("t", "29.10.2026 10:00"))
    bozuk("bilinmeyen ofis", lambda s: s["olaylar"][0].__setitem__("ofis", "Z"))
    bozuk("olay no tekrar", lambda s: s["olaylar"][1].__setitem__("no", 1))
    bozuk("karekod etiketi tekrar", lambda s: s["olaylar"].append({**s["olaylar"][0], "no": 98}))
    bozuk("cihaz kimliği tekrar", lambda s: s["olaylar"].append({**s["olaylar"][1], "no": 97}))
    bozuk("parola değeri", lambda s: s["olaylar"][4].__setitem__("parola", "belki"))
    bozuk("grup farklı anda", lambda s: (s["olaylar"][1].__setitem__("grup", "g"), s["olaylar"][3].__setitem__("grup", "g")))
    bozuk("bakım olayı grupta", lambda s: s["olaylar"].extend([
        {"no": 90, "t": "2026-11-02T11:00:00+03:00", "olay": "bekle", "grup": "h"},
        {"no": 91, "t": "2026-11-02T11:00:00+03:00", "olay": "ozet_oku", "ofis": "A", "cihaz": "tel1", "grup": "h"}]))
    bozuk("sunucu kapalıyken özet yükleme", lambda s: s["olaylar"].extend([
        {"no": 92, "t": "2026-11-02T11:00:00+03:00", "olay": "sunucu", "ofis": "A", "durum": "kapali"},
        {"no": 93, "t": "2026-11-02T11:01:00+03:00", "olay": "ozet_yukle", "ofis": "A"}]))
    bozuk("bilinmeyen kullanıcı", lambda s: s["olaylar"][0].__setitem__("kullanici", "hayalet"))
    bozuk("lisans alanı", lambda s: s["baslangic"]["ofisler"]["A"].__setitem__("lisans", {"sure": 3}))
    bozuk("ofis alanı", lambda s: s["baslangic"]["ofisler"]["A"].__setitem__("renk", "mavi"))
    bozuk("2020 öncesi saat", lambda s: s["olaylar"][0].__setitem__("t", "2019-01-01T00:00:00+03:00"))
    sb = S.S("A-sinir", "sınır 2 → 3; program denetlemeden eşleme", ofisler={"A": S.ofis(lisans={"cihaz_siniri": 2})})
    sb.eslenmis(0, "ayse", "tel1", "K1")
    sb.eslenmis(60, "mehmet", "tel2", "K2")
    sb.e(120, "lisans_degis", lisans={"cihaz_siniri": 3})
    sb.kod(120 + 25 * S.SA, "zeynep", "K3", bek="kabul")
    sb.esle(120 + 25 * S.SA + 30, "K3", "tel3", bek="kabul")
    durumlar.append(("sınır belirsiz (lisans değişti, program denetlemedi)", sb.senaryo(), True))
    durumlar.append(("geçerli taban", taban(), False))
    for ad, s, hata_bekleniyor in durumlar:
        try:
            K.agac(s, mut=BOZUK)
            olan = False
        except K.GirdiHatasi:
            olan = True
        tap(f"A girdi: {ad}", olan == hata_bekleniyor, f"hata bekleniyordu={hata_bekleniyor}, olan={olan}")


# ------------------------------------------------------------------------------------------------- B, C
def b_el():
    for s in EL:
        try:
            yap = S.yapraklar(s, mut=BOZUK)
        except K.GirdiHatasi as h:
            tap(f"B elle {s.ad}: model girdi hatası verdi", False, str(h))
            continue
        f = S.beklenti_farklari(s.bek, s.grup_bek, yap)
        tap(f"B elle {s.ad} ({len(s.olaylar)} olay, {len(yap)} yaprak)", not f, "\n".join(f))


def c_rastgele():
    for s in RASTGELE:
        try:
            yap = S.yapraklar(s, mut=BOZUK)
        except K.GirdiHatasi as h:
            tap(f"C üretici {s.ad}: model girdi hatası verdi", False, str(h))
            continue
        f = S.beklenti_farklari(s.bek, s.grup_bek, yap)
        tap(f"C üretici {s.ad} ({len(s.olaylar)} olay, {len(yap)} birleşim)", not f, "\n".join(f[:10]))


def korumali(ad, f):
    """Bir bölüm çökerse özet yine yazılır; çökme 'not ok' sayılır (ders 2: yarıda kalan koşu geçti sayılmaz)."""
    try:
        f()
    except Exception as h:  # noqa: BLE001 — her çökme kırmızıdır
        tap(f"{ad} bölümü çöktü", False, f"{type(h).__name__}: {h}")


# ------------------------------------------------------------------------------------------------- D
def _cikti(sen, a=None):
    return K.hesapla(sen, a, mut=BOZUK)


def d_degismezler():
    r = random.Random(7)
    hepsi = EL + RASTGELE
    # D1 girdi sırası
    fark = []
    for s in hepsi:
        sen = s.senaryo()
        karisik = copy.deepcopy(sen)
        r.shuffle(karisik["olaylar"])
        a, b = _cikti(sen), _cikti(karisik)
        if a["olaylar"] != b["olaylar"] or a["gruplar"] != b["gruplar"]:
            fark.append(s.ad)
    tap("D1 olay listesinin sırası sonucu değiştirmez (sıra: an → sınıf → no)", not fark, fark)
    # D2 görünen adres / başlıklar yok sayılır
    fark = []
    for s in hepsi:
        sen = s.senaryo()
        taklit = copy.deepcopy(sen)
        for e in taklit["olaylar"]:
            if e["olay"] in ("giris", "istek"):
                if "gorunen_adres" in e:
                    e.pop("gorunen_adres")
                    e.pop("basliklar", None)
                else:
                    e.update(copy.deepcopy(S.TAKLIT))
        if _cikti(sen)["olaylar"] != _cikti(taklit)["olaylar"]:
            fark.append(s.ad)
    tap("D2 tünel isteğinde görünen adres / X-Forwarded-For sonucu değiştirmez", not fark, fark)
    # D3 ofis yalıtımı: bir ofisi tümden çıkarmak öbürlerini değiştirmez
    fark = []
    for s in RASTGELE:
        sen = s.senaryo()
        azalt = copy.deepcopy(sen)
        azalt["baslangic"]["ofisler"].pop("O6")
        azalt["olaylar"] = [e for e in azalt["olaylar"] if e.get("ofis") != "O6"]
        a, b = _cikti(sen)["olaylar"], _cikti(azalt)["olaylar"]
        for no, o in b.items():
            x = a[no]
            esli_a = [{k: v for k, v in d.items() if k != "O6"} for d in x["esli"]]
            if o["sonuc"] != x["sonuc"] or sorted(map(json.dumps, esli_a)) != sorted(map(json.dumps, o["esli"])):
                fark.append(f"{s.ad}/{no}")
    tap("D3 iki ofisin verisi karışmaz (O6 çıkarılınca O1–O5 aynı)", not fark, fark[:10])
    # D4–D9 bütün yapraklarda
    d4, d5, d6, d7, d8, d9 = [], [], [], [], [], []
    for s in hepsi:
        sen = s.senaryo()
        olaylar = {e["no"]: e for e in sen["olaylar"]}
        for a, c in S.yapraklar(s, mut=BOZUK):
            for no, o in c["olaylar"].items():
                e = olaylar[int(no)]
                for d in o["esli"]:
                    if any(v > 3 for v in d.values()):
                        d4.append(f"{s.ad}/{no}")
                if "gorunur" in o:
                    g = o["gorunur"]
                    if any(sk not in g["en_cok"] or not set(b) <= set(g["en_cok"][sk]) for sk, b in g["en_az"].items()):
                        d5.append(f"{s.ad}/{no}")
            d6.extend(_lisans_degismezi(s, sen, c))
            d7.extend(_sunucu_degismezi(s, sen, c))
            for no, o in c["olaylar"].items():
                e = olaylar[int(no)]
                if e["olay"] == "istek" and "kabul" in o["sonuc"] and not K.yol_izinli(e["yol"]):
                    d8.append(f"{s.ad}/{no}")
            d9.extend(_silme_degismezi(s, sen, c))
    tap("D4 hiçbir anda program başına 3'ten fazla eşli cihaz yok", not d4, d4[:10])
    tap("D5 görünür alt sınır ⊆ üst sınır (yetkisiz şirket/bölüm üst sınırda yok)", not d5, d5[:10])
    tap("D6 lisans 24 saatten uzun süredir geçersizken hiçbir uzak istek kabul edilmez", not d6, d6[:10])
    tap("D7 sunucu kapalıyken canlı istek, giriş ve eşleme kabul edilmez", not d7, d7[:10])
    tap("D8 kabul edilen her tünel isteği /mobil/ ya da /api/mobil/ altında", not d8, d8[:10])
    tap("D9 silinen cihazın sonraki hiçbir isteği kabul edilmez", not d9, d9[:10])


CIHAZ_OLAYLARI = ("ozet_oku", "ozet_yaz", "istek", "giris", "esle", "kapici_dogrudan_kayit")


def _lisans_degismezi(s, sen, c):
    sorun = []
    gecmis = {o: [(K.EKSI_SONSUZ, K.lisans_kaydi(v.get("lisans")))] for o, v in sen["baslangic"]["ofisler"].items()}
    for e in sorted(sen["olaylar"], key=lambda e: K.zaman(e["t"])):
        if e["olay"] == "lisans_degis":
            gecmis[e["ofis"]].append((K.zaman(e["t"]), K.lisans_kaydi(e["lisans"], gecmis[e["ofis"]][-1][1])))
    for e in sen["olaylar"]:
        if e["olay"] not in CIHAZ_OLAYLARI:
            continue
        t = K.zaman(e["t"])
        kayitlar = [k for a, k in gecmis[e["ofis"]] if a <= t - 24 * 3600 - 1]
        sonraki = [k for a, k in gecmis[e["ofis"]] if t - 24 * 3600 - 1 < a <= t]
        hep_gecersiz = all(not K.lisans_gecerli(k, t) for k in kayitlar[-1:] + sonraki)
        if hep_gecersiz and "kabul" in c["olaylar"][str(e["no"])]["sonuc"]:
            sorun.append(f"{s.ad}/{e['no']}")
    return sorun


def _sunucu_degismezi(s, sen, c):
    sorun = []
    durum = {o: v.get("sunucu", "acik") for o, v in sen["baslangic"]["ofisler"].items()}
    sirali = sorted(sen["olaylar"], key=lambda e: (K.zaman(e["t"]), K.OLAY_SINIFI[e["olay"]], e["no"]))
    for e in sirali:
        if e["olay"] == "sunucu":
            durum[e["ofis"]] = e["durum"]
        elif e["olay"] in ("istek", "giris", "esle") and durum[e["ofis"]] == "kapali":
            if "kabul" in c["olaylar"][str(e["no"])]["sonuc"]:
                sorun.append(f"{s.ad}/{e['no']}")
    return sorun


def _silme_degismezi(s, sen, c):
    sorun = []
    silinen = {}
    sirali = sorted(sen["olaylar"], key=lambda e: (K.zaman(e["t"]), K.OLAY_SINIFI[e["olay"]], e["no"]))
    for e in sirali:
        o = c["olaylar"][str(e["no"])]
        anahtar = (e.get("ofis"), e.get("cihaz"))
        if e["olay"] == "cihaz_sil" and o["sonuc"] == ["kabul"]:
            silinen[anahtar] = True
        elif e["olay"] in CIHAZ_OLAYLARI and anahtar in silinen and "kabul" in o["sonuc"]:
            sorun.append(f"{s.ad}/{e['no']}")
    return sorun


# ------------------------------------------------------------------------------------------------- E
def _program_ciktisi(sen):
    """Öneri birleşimiyle belirlenimli senaryolardan 'program' çıktısı (her olayda tek sonuç)."""
    c = _cikti(sen)
    gz = {}
    for no, o in c["olaylar"].items():
        if len(o["sonuc"]) != 1 or len(o["esli"]) != 1:
            return None
        g = {"sonuc": o["sonuc"][0], "esli": o["esli"][0]}
        if "gorunur" in o and o["gorunur"]["en_az"] == o["gorunur"]["en_cok"]:
            g["gorunur"] = o["gorunur"]["en_cok"]
            if len(o["ozet_zamani"]) == 1:
                g["ozet_zamani"] = o["ozet_zamani"][0]
        gz[no] = g
    return gz


def e_komut():
    with tempfile.TemporaryDirectory(prefix="mobilkahin247-") as d:
        senaryo_yolu = os.path.join(d, "s.json")
        with open(senaryo_yolu, "w", encoding="utf-8") as f:
            json.dump(S.u01().senaryo(), f)
        r = subprocess.run([sys.executable, "-I", os.path.join(BURASI, "kahin.py"), "hesapla", senaryo_yolu],
                           capture_output=True, text=True)
        ok = r.returncode == 0 and json.loads(r.stdout)["olaylar"]["2"]["sonuc"] == ["kabul"]
        tap("E hesapla komutu", ok, r.stderr[-500:])
        secilen = [s for s in EL if _program_ciktisi(s.senaryo()) is not None]
        kabul = {"senaryolar": [s.senaryo() for s in secilen], "secilen_birlesim": None}
        program = {s.ad: _program_ciktisi(s.senaryo()) for s in secilen}
        kabul_yolu, program_yolu = os.path.join(d, "kabul.json"), os.path.join(d, "program.json")
        with open(kabul_yolu, "w", encoding="utf-8") as f:
            json.dump(kabul, f)
        with open(program_yolu, "w", encoding="utf-8") as f:
            json.dump(program, f)
        r = subprocess.run([sys.executable, "-I", os.path.join(BURASI, "kahin.py"), "karsilastir", kabul_yolu, program_yolu],
                           capture_output=True, text=True)
        tap(f"E karsilastir: modelin kendi çıktısı ({len(secilen)} senaryo) → çıkış 0", r.returncode == 0,
            r.stdout[-800:] + r.stderr[-300:])
        bozuk = copy.deepcopy(program)
        bozuk["U08"]["7"]["sonuc"] = "kabul"  # silinen cihazın isteği kabul edilmiş gibi
        with open(program_yolu, "w", encoding="utf-8") as f:
            json.dump(bozuk, f)
        r = subprocess.run([sys.executable, "-I", os.path.join(BURASI, "kahin.py"), "karsilastir", kabul_yolu, program_yolu],
                           capture_output=True, text=True)
        tap("E karsilastir: tek olay farkı → çıkış 1 ve FARK satırı", r.returncode == 1 and "FARK" in r.stdout, r.stdout[-500:])
        eksik = copy.deepcopy(program)
        eksik["U08"].pop("9")
        with open(program_yolu, "w", encoding="utf-8") as f:
            json.dump(eksik, f)
        r = subprocess.run([sys.executable, "-I", os.path.join(BURASI, "kahin.py"), "karsilastir", kabul_yolu, program_yolu],
                           capture_output=True, text=True)
        tap("E karsilastir: programın çıktısında olmayan olay FARK sayılır (ders 4)", r.returncode == 1, r.stdout[-500:])
    # gözlemle süzme: U23'te program tab1'i eşlediyse tel1 artık 'cihaz_yok' olmalı
    sen = S.u23().senaryo()
    oneri = K.Parametreler(K.oneri_birlesimi())
    gz_dogru = {"1": {"sonuc": "kabul"}, "2": {"sonuc": "ret:kod_gecersiz"}, "3": {"sonuc": "kabul"},
                "4": {"sonuc": "kabul"}, "5": {"sonuc": "ret:cihaz_yok"}}
    gz_yanlis = {**gz_dogru, "5": {"sonuc": "kabul"}}
    a = K.Model(sen, oneri, BOZUK).kos(gozlem=gz_dogru)["farklar"]
    b = K.Model(sen, K.Parametreler(K.oneri_birlesimi()), BOZUK).kos(gozlem=gz_yanlis)["farklar"]
    tap("E gözlemle süzme: tutarlı yol kabul, tutarsız yol (tab1 eşlendi ama tel1 okudu) FARK", not a and bool(b), f"{a} / {b}")


# ------------------------------------------------------------------------------------------------- F
def f_mutasyon():
    oneri = K.oneri_birlesimi()
    yakalanan = 0
    oneride = 0
    for m, aciklama in MUTASYONLAR.items():
        farklar, oneri_farki, coktu = 0, 0, []
        for s in EL + RASTGELE:
            try:
                yap = S.yapraklar(s, mut=m, sabit=oneri if s.ad.startswith("R") else None)
            except K.GirdiHatasi as h:
                coktu.append(f"{s.ad}: {h}")
                continue
            f = S.beklenti_farklari(s.bek, s.grup_bek, yap)
            farklar += len(f)
            uygun = [(a, c) for a, c in yap if all(oneri[k] == v for k, v in a.items())]
            oneri_farki += len(S.beklenti_farklari(s.bek, s.grup_bek, uygun))
        ok = farklar > 0
        yakalanan += ok
        oneride += oneri_farki > 0
        tap(f"F {m} {aciklama}: {farklar} fark (öneri birleşiminde {oneri_farki})"
            + (f"; ayrıca {len(coktu)} senaryo girdi hatası verdi" if coktu else ""), ok, "\n".join(coktu))
    print(f"# mutasyon {yakalanan}/{len(MUTASYONLAR)} yakalandı; öneri birleşiminde {oneride}/{len(MUTASYONLAR)}")


def main():
    print("TAP version 13")
    if BOZUK:
        print(f"# BİLEREK BOZUK MODEL: {BOZUK} ({MUTASYONLAR.get(BOZUK, '?')}) — kırmızı bekleniyor")
    korumali("A", a_girdi)
    korumali("B", b_el)
    korumali("C", c_rastgele)
    korumali("D", d_degismezler)
    korumali("E", e_komut)
    if not BOZUK:
        korumali("F", f_mutasyon)
    gecen = sum(sonuclar)
    print(f"1..{len(sonuclar)}")
    print(f"# tests {len(sonuclar)}")
    print(f"# pass {gecen}")
    print(f"# fail {len(sonuclar) - gecen}")
    return 0 if gecen == len(sonuclar) else 1


if __name__ == "__main__":
    sys.exit(main())
