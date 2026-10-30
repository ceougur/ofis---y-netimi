#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""WhatsApp kâhininin KENDİ testi + MUTASYON testi (DestekOfis 2.4.8 K0). Çıktı TAP + `# tests/pass/fail/…` özet satırları;
çıkış 0 yalnız hepsi geçtiyse. Koşu (depo kökünden):
  node tools/kanit.mjs kos 248-k0-kahin -- python3 -I test/bagimsiz/whatsapp-248/kahin/kahin_test.py

Bölümler:
  A  senaryolar.json güncel mi (yeniden üretilen = dosya)
  B  her senaryo: ELLE yazılmış beklenen = model
  C  değişmezler (her senaryo, her zaman ucu): '+' ile numara, medya silme ≤ yükleme, kesin olmayan işte silme yok, metin bakiyesi = PDF bakiyesi,
     sayaçların toplamı, 'Bu Ay' teslim = Teslim + Okundu iş sayısı, yaklaşık ücret = teslim × 0,0009, kabul/teslim edilmiş işte hata kodu yok (§7a 32),
     iç denetim sayaçları 0
  D  §7a sabitlemesi: serbest seçim YOK; iki zaman ucu (0,5 sn / 5 sn adım) aynı sonucu verir
  E  girdi doğrulaması: §7a 12 sınıfsız kod reddedilmez (iş Başarısız); bilinmeyen olay / medya yanıtı sessizce geçmez
  H  beklenen şablon metinleri (kahin.SABLONLAR) = plan §7a 23 ve W5 metni (plan dosyasından okunur); R1–R3 kararı planda
  F  MUTASYON: modele bilerek hata; en az bir senaryonun elle beklenenine ya da iç denetim sayacına takılmalı (yakalanmayan = eksik senaryo)
  G  komut satırı (hesapla, karsilastir: 'biri', 'plan_susuyor', 'kisaltilabilir')
"""
import copy
import json
import os
import subprocess
import sys
import tempfile
import traceback
from decimal import Decimal

sys.dont_write_bytecode = True
_BURASI = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, _BURASI)
import kahin  # noqa: E402
import senaryolar  # noqa: E402

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
        except Exception:
            satirlar = ["istisna: " + s for s in traceback.format_exc().strip().splitlines()[-6:]]
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
        for s in bilgi[:80]:
            print(f"  # {s}")
    print(f"1..{gecen + kalan}")
    for ad, n in (("tests", gecen + kalan), ("pass", gecen), ("fail", kalan), ("cancelled", 0), ("skipped", 0), ("todo", 0)):
        print(f"# {ad} {n}")
    return 0 if kalan == 0 else 1


TUM = senaryolar.tum_senaryolar()
BEKLENEN = {}


def beklenen(s):
    if s["ad"] not in BEKLENEN:
        BEKLENEN[s["ad"]] = kahin.hesapla(senaryolar.girdi(s))
    return BEKLENEN[s["ad"]]


# ---- A -----------------------------------------------------------------------------------------------------------------------
@test("A senaryolar.json güncel (yeniden üretim = dosya)")
def _a():
    yol = os.path.join(_BURASI, "senaryolar.json")
    if not os.path.exists(yol):
        return ["senaryolar.json yok — python3 -I senaryolar.py ile üretin"]
    with open(yol, encoding="utf-8") as f:
        dosya = json.load(f)
    hata = []
    adlar = [s["ad"] for s in dosya["senaryolar"]]
    if adlar != [s["ad"] for s in TUM]:
        hata.append("senaryo listesi farklı")
    for kayit in dosya["senaryolar"]:
        s = next((x for x in TUM if x["ad"] == kayit["ad"]), None)
        if s is None:
            continue
        if not senaryolar._esit(kayit["beklenen"], beklenen(s)):
            hata.append(f"{s['ad']}: dosyadaki beklenen ≠ yeniden hesaplanan")
    if dosya.get("serbest_secimler") != {k: list(v) for k, v in kahin.SERBEST.items()}:
        hata.append("serbest seçim listesi farklı")
    if dosya.get("sablonlar") != kahin.SABLONLAR:
        hata.append("şablon metinleri farklı")
    return hata + [f"bilgi: {len(adlar)} senaryo"]


@test("A senaryo sayısı ≥ 40 ve plan §8 başlıklarının hepsi temsil ediliyor")
def _a2():
    basliklar = {s["baslik"] for s in TUM}
    gerekli = {"ÇİFT", "KAYIP", "YANLIŞ KİŞİ", "YANLIŞ İÇERİK", "HESAP / META", "GÜVENLİK", "TARİH", "ÖLÇEK"}
    hata = []
    if len(TUM) < 40:
        hata.append(f"yalnız {len(TUM)} senaryo")
    for g in sorted(gerekli - basliklar):
        hata.append(f"başlık yok: {g}")
    adlar = [s["ad"] for s in TUM]
    if len(set(adlar)) != len(adlar):
        hata.append("yinelenen senaryo adı")
    return hata


# ---- B -----------------------------------------------------------------------------------------------------------------------
def _b(s):
    def f():
        return senaryolar.elle_denetle(s, beklenen(s))
    return f


for _s in TUM:
    test(f"B elle = model: {_s['ad']}")(_b(_s))


# ---- C -----------------------------------------------------------------------------------------------------------------------
def yapraklar(o):
    """{"biri": [...]} ise seçenekleri, değilse değeri verir."""
    if isinstance(o, dict) and set(o) == {"biri"}:
        return o["biri"]
    return [o]


def degismez_denetle(ad, sonuc):
    h = []
    for k, v in sonuc["degismez"].items():
        for x in yapraklar(v):
            if x != 0:
                h.append(f"{ad}: iç denetim {k} = {x}")
    for anahtar, j in sonuc.get("isler", {}).items():
        for tel in yapraklar(j["telefon"]):
            if tel is not None and not str(tel).startswith("+"):
                h.append(f"{ad} {anahtar}: '+' olmayan numara {tel}")
        y, s_, d = j["medya_yukleme"], j["medya_silme"], j["durum"]
        if isinstance(y, int) and isinstance(s_, int) and s_ > y:      # "biri" yapraklarında çapraz karşılaştırma yapılmaz (C2 koşu başına denetler)
            h.append(f"{ad} {anahtar}: silme {s_} > yükleme {y}")
        if isinstance(d, str) and d in (kahin.KABUL, kahin.GONDERILDI, kahin.BELIRSIZ) and isinstance(s_, int) and s_ > 0:
            h.append(f"{ad} {anahtar}: kesin olmayan durumda ({d}) PDF silinmiş")
        if j["sablon"] == "destekofis_ekstre" and isinstance(j["pdf"], dict) and isinstance(j["degiskenler"], list):
            b = j["pdf"]["donem_sonu_bakiye"]
            if isinstance(b, str) and j["degiskenler"][3] != kahin.para(Decimal(b)):
                h.append(f"{ad} {anahtar}: metin bakiyesi {j['degiskenler'][3]} ≠ PDF {b}")
        if isinstance(d, str) and d in (kahin.KABUL, kahin.GONDERILDI, kahin.TESLIM, kahin.OKUNDU) and j["hata_kodu"] is not None:
            h.append(f"{ad} {anahtar}: başarılı işte ({d}) hata kodu kaldı: {j['hata_kodu']}")
        for k_, m_, p_ in [(j["kabul"], j["meta_ileti"], j["post"])]:
            if all(isinstance(x, int) for x in (k_, m_, p_)) and not (k_ <= m_ <= p_):
                h.append(f"{ad} {anahtar}: kabul_meta: kabul {k_} ≤ Meta'daki ileti {m_} ≤ POST {p_} bozuk")
    m = sonuc["meta"]
    if isinstance(m.get("post"), dict) and isinstance(m.get("toplam_post"), int):
        toplam = sum(v for v in m["post"].values() if isinstance(v, int))
        if all(isinstance(v, int) for v in m["post"].values()) and toplam != m["toplam_post"]:
            h.append(f"{ad}: Σ post {toplam} ≠ toplam_post {m['toplam_post']}")
    teslim_toplam = 0
    for kova in yapraklar(sonuc["bu_ay"]):
        if not isinstance(kova, dict):
            teslim_toplam = None
            continue
        for _w, aylar in kova.items():
            for _a, b in aylar.items():
                if isinstance(b, dict) and isinstance(b.get("teslim"), int):
                    if teslim_toplam is not None:
                        teslim_toplam += b["teslim"]
                    if b["yaklasik_usd"] != str((kahin.UCRET_USD * b["teslim"]).quantize(Decimal("0.0001"))):
                        h.append(f"{ad}: yaklaşık ücret {b['yaklasik_usd']} ≠ teslim {b['teslim']} × 0,0009")
                else:
                    teslim_toplam = None
    ds = sonuc.get("durum_sayilari")
    if teslim_toplam is not None and isinstance(ds, dict) and all(isinstance(v, int) for v in ds.values()):
        if teslim_toplam != ds.get(kahin.TESLIM, 0) + ds.get(kahin.OKUNDU, 0):
            h.append(f"{ad}: teslim_sayac: 'Bu Ay' teslim {teslim_toplam} ≠ Teslim + Okundu iş {ds.get(kahin.TESLIM, 0) + ds.get(kahin.OKUNDU, 0)}")
    if isinstance(ds, dict) and all(isinstance(v, int) for v in ds.values()) and "isler" in sonuc:
        if sum(ds.values()) != len(sonuc["isler"]):
            h.append(f"{ad}: durum sayıları toplamı ≠ iş sayısı")
    if "isler_post_dagilimi" in sonuc and isinstance(ds, dict) and all(isinstance(v, int) for v in ds.values()):
        if sum(v for v in sonuc["isler_post_dagilimi"].values() if isinstance(v, int)) != sum(ds.values()):
            h.append(f"{ad}: POST dağılımı toplamı ≠ iş sayısı")
    return h


@test("C değişmezler: her senaryo (birleşik sonuç)")
def _c():
    h = []
    for s in TUM:
        for g in beklenen(s):
            h += [x for x in degismez_denetle(s["ad"], g["sonuc"]) if not any(ihlal_bildirili(s, k, x) for k in g["secimler"])]
    return h


def ihlal_bildirili(s, kismi, satir):
    for tur, kosul in (s.get("bilinen_ihlal") or {}).items():
        if f": {tur}:" in satir and all(kismi.get(k) == v for k, v in kosul.items() if k != "neden"):
            return True
    return False


@test("C değişmezler: zaman uçlarının HER biri ayrı (birleştirmeden önce); bildirilmiş ihlal yalnız bildirildiği seçimde")
def _c2():
    h = []; bilgi = []
    for s in TUM:
        if s.get("ozet_cikti"):
            continue
        goruldu = set()
        for kismi in kahin.secim_birlesimleri(s.get("serbest", [])):
            for zaman in kahin.ZAMANLAR:
                r = kahin.Benzetim(senaryolar.girdi(s), kahin.tam_secim(kismi), zaman).calistir()
                for satir in degismez_denetle(f"{s['ad']}[{zaman}]", r):
                    if ihlal_bildirili(s, kismi, satir):
                        goruldu.add(satir.split(": ")[1])
                    else:
                        h.append(satir)
        for tur, kosul in (s.get("bilinen_ihlal") or {}).items():
            if tur not in goruldu:
                h.append(f"{s['ad']}: bildirilen ihlal '{tur}' hiç görülmedi")
            else:
                bilgi.append(f"bilgi: {s['ad']}: bildirilen ihlal '{tur}' görüldü — {kosul['neden']}")
    return h + bilgi


# ---- D -----------------------------------------------------------------------------------------------------------------------
@test("D §7a sabitlemesi: SERBEST boş, hiçbir senaryo serbest seçim bildirmiyor, beklenen tek grup")
def _d():
    h = []
    if kahin.SERBEST:
        h.append(f"SERBEST boş değil: {sorted(kahin.SERBEST)}")
    for s in TUM:
        if s.get("serbest"):
            h.append(f"{s['ad']}: serbest seçim bildiriyor {s['serbest']}")
        if any(k for k, _y in s["elle"]):
            h.append(f"{s['ad']}: elle beklenen seçime bağlı")
        if len(beklenen(s)) != 1:
            h.append(f"{s['ad']}: {len(beklenen(s))} grup")
    return h


def _biri_yollari(o, yol=""):
    if isinstance(o, dict):
        if set(o) == {"biri"}:
            return [yol]
        return [y for k, v in o.items() for y in _biri_yollari(v, f"{yol}.{k}" if yol else k)]
    return []


@test("D iki zaman ucu (adım 0,5 sn / 5 sn) her senaryoda aynı sonucu verir (beklenende 'biri' yaprağı yok)")
def _d2():
    h = []
    for s in TUM:
        yollar = _biri_yollari(beklenen(s)[0]["sonuc"])
        if yollar:
            h.append(f"{s['ad']}: zaman ucuna bağlı {len(yollar)} değer (ör. {yollar[0]})")
    return h


# ---- E -----------------------------------------------------------------------------------------------------------------------
@test("E §7a 12: sınıfsız / tanınmayan kod reddedilmez → o iş Başarısız (kodlu), toplu iş sürer; 131048 → bekler, sonra gider")
def _e1():
    h = []
    for kod in (100, 131053, 424242):
        s = copy.deepcopy(senaryolar.girdi(TUM[0]))
        s["meta_davranis"] = {"mesaj": {"A": {"hata": kod}}, "kanca": {"*": senaryolar.K_STD}}
        r = kahin.hesapla(s)[0]["sonuc"]
        if r["isler"]["T1/A"]["durum"] != kahin.BASARISIZ or r["isler"]["T1/A"]["hata_kodu"] != kod:
            h.append(f"{kod}: A {r['isler']['T1/A']['durum']} / {r['isler']['T1/A']['hata_kodu']}")
        if r["toplular"]["T1"]["durum"] != "aktif" or r["isler"]["T1/C"]["durum"] != kahin.TESLIM:
            h.append(f"{kod}: toplu iş sürmedi ({r['toplular']['T1']})")
    s = copy.deepcopy(senaryolar.girdi(TUM[0]))
    s["meta_davranis"] = {"mesaj": {"A": [{"hata": 131048}]}, "kanca": {"*": senaryolar.K_STD}}
    r = kahin.hesapla(s)[0]["sonuc"]
    if r["isler"]["T1/A"]["durum"] != kahin.TESLIM or r["meta"]["post"]["A"] != 2:
        h.append(f"131048: A {r['isler']['T1/A']['durum']}, POST {r['meta']['post']['A']}")
    return h


@test("E bilinmeyen olay türü ve modellenmemiş medya yanıtı reddedilir")
def _e2():
    h = []
    s = copy.deepcopy(senaryolar.girdi(TUM[0]))
    s["olaylar"].append({"t": "+1m", "tur": "uydurma"})
    try:
        kahin.hesapla(s)
        h.append("bilinmeyen olay kabul edildi")
    except ValueError:
        pass
    s = copy.deepcopy(senaryolar.girdi(TUM[0]))
    s["meta_davranis"] = {"medya": ["uydurma"]}
    try:
        kahin.hesapla(s)
        h.append("modellenmemiş medya yanıtı kabul edildi")
    except ValueError:
        pass
    return h


@test("E senaryo nesnesi koşudan sonra değişmez (aynı senaryo birçok kez koşar)")
def _e3():
    h = []
    for s in TUM:
        if s.get("ozet_cikti"):
            continue
        once = json.dumps(senaryolar.girdi(s), sort_keys=True, ensure_ascii=False)
        kahin.hesapla_tek(senaryolar.girdi(s), {})
        if json.dumps(senaryolar.girdi(s), sort_keys=True, ensure_ascii=False) != once:
            h.append(f"{s['ad']}: girdi değişti")
    return h


# ---- F -----------------------------------------------------------------------------------------------------------------------
# İPUCU: bir önceki tam taramada mutasyonu ilk yakalayan senaryo. YALNIZ tarama SIRASINI değiştirir (önce ipucu denenir); ölçüt aynı —
# ipucu artık yakalamıyorsa tarama bütün senaryolarla sürer. Boş bırakılırsa tam tarama (yavaş ama aynı sonuç).
MUTASYON_IPUCU = {
}


def mutasyon_yakalar(mut):
    """(yakalayan senaryo adı, neden) ya da None."""
    sirali = [s for s in TUM if not s.get("ozet_cikti")] + [s for s in TUM if s.get("ozet_cikti")]
    ipucu = MUTASYON_IPUCU.get(mut)
    if ipucu:
        sirali = [s for s in sirali if s["ad"] == ipucu] + [s for s in sirali if s["ad"] != ipucu]
    for s in sirali:
        try:
            b = kahin.hesapla(senaryolar.girdi(s), frozenset([mut]))
        except Exception as e:  # mutasyon modeli düşürürse de yakalanmış sayılır (neden yazılır)
            return s["ad"], f"istisna {type(e).__name__}"
        farklar = senaryolar.elle_denetle(s, b)
        if farklar:
            return s["ad"], farklar[0][:150]
        for g in b:
            d = [x for x in degismez_denetle(s["ad"], g["sonuc"]) if not any(ihlal_bildirili(s, k, x) for k in g["secimler"])]
            if d:
                return s["ad"], d[0][:150]
    return None


@test(f"F mutasyon: {len(kahin.MUTASYONLAR)} mutasyonun her biri en az bir senaryoda yakalanır")
def _f():
    h = []
    bilgi = []
    for mut, aciklama in kahin.MUTASYONLAR.items():
        r = mutasyon_yakalar(mut)
        if r is None:
            h.append(f"YAKALANMADI {mut}: {aciklama}")
        else:
            bilgi.append(f"bilgi: {mut} ({aciklama}) ← {r[0]}: {r[1]}")
    return h + bilgi


# ---- G -----------------------------------------------------------------------------------------------------------------------
@test("G komut satırı: hesapla + karsilastir (kendi tek koşusu 0 fark; bozulmuş çıktı fark verir)")
def _g():
    h = []
    s = next(x for x in TUM if x["ad"] == "CIFT-01-zaman-asimi-meta-aldi")
    with tempfile.TemporaryDirectory() as d:
        sen = os.path.join(d, "s.json"); bek = os.path.join(d, "b.json"); prog = os.path.join(d, "p.json")
        with open(sen, "w", encoding="utf-8") as f:
            json.dump(senaryolar.girdi(s), f, ensure_ascii=False)
        r = subprocess.run([sys.executable, "-I", os.path.join(_BURASI, "kahin.py"), "hesapla", sen], capture_output=True, text=True)
        if r.returncode != 0:
            return [f"hesapla çıkış {r.returncode}: {r.stderr[-300:]}"]
        with open(bek, "w", encoding="utf-8") as f:
            f.write(r.stdout)
        tek = kahin.Benzetim(senaryolar.girdi(s), kahin.tam_secim({}), "hizli").calistir()
        with open(prog, "w", encoding="utf-8") as f:
            json.dump(tek, f, ensure_ascii=False)
        r = subprocess.run([sys.executable, "-I", os.path.join(_BURASI, "kahin.py"), "karsilastir", bek, prog], capture_output=True, text=True)
        if r.returncode != 0 or "0 fark" not in r.stdout:
            h.append(f"kendi koşusu fark verdi: {r.stdout[-400:]}")
        tek["isler"]["T1/A"]["post"] = 2
        with open(prog, "w", encoding="utf-8") as f:
            json.dump(tek, f, ensure_ascii=False)
        r = subprocess.run([sys.executable, "-I", os.path.join(_BURASI, "kahin.py"), "karsilastir", bek, prog], capture_output=True, text=True)
        if r.returncode != 1 or "isler.T1/A.post" not in r.stdout:
            h.append(f"çift POST yakalanmadı: {r.stdout[-400:]}")
    return h


@test("G karsilastir: 'biri' (zaman serbestliği), 'plan_susuyor' (denetlenmez), 'kisaltilabilir' (önek)")
def _g2():
    h = []
    b = [{"secimler": [{}], "sonuc": {"x": {"biri": [1, 2]}, "y": {"plan_susuyor": "vade"}, "z": {"kisaltilabilir": "Uzun Ad Soyad"}, "w": "sabit"}}]
    if kahin.karsilastir(b, {"x": 2, "y": "her şey", "z": "Uzun Ad…", "w": "sabit"}, kahin.tam_secim({})):
        h.append("geçerli program çıktısı fark verdi")
    f = kahin.karsilastir(b, {"x": 3, "y": None, "z": "Başka", "w": "sabit"}, kahin.tam_secim({}))
    if len(f) != 2:
        h.append(f"iki fark bekleniyordu: {f}")
    return h


@test("G numara(): plan §2.2 '+' + ülke kodu; §7a 6 geçersiz = E.164'e çevrilemeyen; §7a 7 ayırıcılar; telefonsuz/geçersiz ayrımı")
def _g3():
    ornek = {"0532 111 22 33": ("+905321112233", "mobil"), "+90 (532) 111-22-33": ("+905321112233", "mobil"), "905321112233": ("+905321112233", "mobil"),
             "0212 555 11 22": ("+902125551122", "sabit"), "+49 151 2345 6789": ("+4915123456789", "yurtdisi"), "0532 111 22 33 / 0533 444 55 66": ("+905321112233", "mobil"),
             "0532 111 22 33\n0533 444 55 66": ("+905321112233", "mobil"), "0532 111 22 33;0533": ("+905321112233", "mobil"), "0532 111 22 33, 0533": ("+905321112233", "mobil"),
             "5321112233": ("+905321112233", "mobil"), "0090 532 111 22 33": ("+905321112233", "mobil"), "+90 532 111 22": (None, "gecersiz"),
             "-": (None, "telefonsuz"), None: (None, "telefonsuz"), "0532 111": (None, "gecersiz"), "123": (None, "gecersiz"), "+1 234": (None, "gecersiz")}
    return [f"{k!r}: {kahin.numara(k)} ≠ {v}" for k, v in ornek.items() if kahin.numara(k) != v]


@test("G para(): '1.250,00 TL' biçimi; §7a 22 eksi bakiye '1.234,56 TL (Alacaklı)', 2 ondalık; donem_metni() §7a 21")
def _g4():
    ornek = {"1250": "1.250,00 TL", "0": "0,00 TL", "0.5": "0,50 TL", "1234567.89": "1.234.567,89 TL", "-1234.56": "1.234,56 TL (Alacaklı)",
             "-0.5": "0,50 TL (Alacaklı)", "0.005": "0,01 TL", "-0.004": "0,00 TL"}
    h = [f"{k}: {kahin.para(Decimal(k))} ≠ {v}" for k, v in ornek.items() if kahin.para(Decimal(k)) != v]
    if kahin.donem_metni("2026-10-01", "2026-10-31") != "01.10.2026 \u2013 31.10.2026":
        h.append(f"dönem metni {kahin.donem_metni('2026-10-01', '2026-10-31')!r}")
    return h


# ---- H -----------------------------------------------------------------------------------------------------------------------
@test("H beklenen şablon metinleri = plan (§7a 23 ekstre gövdesi, W5 hatırlatma gövdesi, KVKK alt satırı ≤ 60)")
def _h():
    yol = os.path.normpath(os.path.join(_BURASI, "..", "..", "..", "..", "docs", "erp", "WHATSAPP-API-PLANI-2.4.8.md"))
    with open(yol, encoding="utf-8") as f:
        plan = " ".join(f.read().split())
    h = []
    for ad, s in kahin.SABLONLAR.items():
        for alan in ("govde", "alt_satir"):
            if s[alan] and s[alan] not in plan:
                h.append(f"{ad}.{alan} planda yok: {s[alan][:60]}")
        if s["alt_satir"] and len(s["alt_satir"]) > 60:
            h.append(f"{ad}: alt satır {len(s['alt_satir'])} > 60")
        if s["kategori"] != "UTILITY" or s["dil"] != "tr":
            h.append(f"{ad}: kategori/dil")
    if not kahin.SABLONLAR["destekofis_ekstre"]["govde"].endswith("İyi günler dileriz."):
        h.append("ekstre gövdesi cümleyle bitmiyor (§7a 23)")
    for parca in ("R1", "R2", "R3", "GEÇERLİ", "Bağlantı Bekleniyor", "HER 100 İLETİDE", "EN GEÇ 10 DAKİKADA", "Bunları Çıkar"):
        if parca not in plan:
            h.append(f"plan revizyon metninde yok: {parca}")
    if (kahin.SABLON_OKUMA_ILETI, kahin.SABLON_OKUMA_ARALIK) != (100, 10 * kahin.DK):
        h.append("R2 okuma sıklığı plandan farklı")
    return h


if __name__ == "__main__":
    sys.exit(kos())
