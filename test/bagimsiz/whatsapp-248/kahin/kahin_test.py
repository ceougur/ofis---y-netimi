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
  G  komut satırı (hesapla, karsilastir: 'biri', 'plan_susuyor', 'kisaltilabilir', 'secenek')
  I  kâhin güncellemesi 2 (K1–K8, 31.10.2026): dönem çözümü birim denetimi (ay sonu, 31.12 → 01.01, şubat), karar izlenebilirliği (her karar ≥ 2 senaryo),
     yeniden deneme ve liste çıktılarının iç tutarlılığı, eski 145 senaryoda yeni yaprak türü yok; güncelleme 3 (D1–D8): D4'ün iki okuması beklentiyi değiştirmez,
     Sonucu Belirsiz artık Zaten Kuyrukta değil; güncelleme 4 (E1–E4, N6): karar izlenebilirliği
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
        for s in bilgi[:300]:
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
    if dosya.get("kararlar") != kahin.KARARLAR:
        hata.append("karar metinleri (K1–K8) farklı")
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
            h.append(f"{ad}: post_toplam: Σ post {toplam} ≠ toplam_post {m['toplam_post']}")
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
    "M68": "K1-01-ay-sonu-bu-ay-sonra-gecen-ay", "M69": "K1-03-yarim-ay-bu-ay-sonra-tam-ay-gecen-ay", "M70": "K1-05-son-3-ay-7-gun",
    "M71": "K1-05-son-3-ay-7-gun", "M72": "K2-01-son-3-ay-bekleyen-yasi-yok", "M73": "K1-07-hatirlatma-ayni-yerel-gun", "M74": "K1-07-hatirlatma-ayni-yerel-gun",
    "M75": "K1-05-son-3-ay-7-gun", "M76": "K3-02-meta-bekletti-ret-sonra-gec-teslim-sayilir", "M77": "K7-01-meta-bekletti-ikinci-deneme-reddi-sayilmaz",
    "M78": "K7-02-iptal-meta-bekletti-sayilmaz", "M79": "K7-04-geri-yukleme-meta-bekletti-sayilmaz", "M80": "K5-01-karar-yeniden-denemeye-tasinir",
    "M81": "K5-02-acilistan-sonra-baska-isle-giden-elenir", "M82": "K5-03-sonra-programin-saatine-gore", "M83": "K5-04-isteki-yine-de-gonder-karari-tasir",
    "M22": "K6-04-hic-basarisiz-olmamis-belirsiz-aday-degil", "M84": "K6-01-yeniden-denemesi-belirsiz-elenir", "M85": "K6-03-acilistan-once-belirsiz-geri-yukleme-sonrasi", "M86": "K6-03-acilistan-once-belirsiz-geri-yukleme-sonrasi",
    "M87": "K4-01-ay-sonu-yeniden-deneme-donemi-tasinir", "M88": "K4-03-son-3-ay-yeniden-deneme-secim-tasinir", "M89": "K8-01-sayfalama-imlec-kaymaz",
    "M90": "K8-01-sayfalama-imlec-kaymaz", "M91": "K8-01-sayfalama-imlec-kaymaz", "M92": "K8-02-tarih-suzgeci-yerel-gun", "M93": "K8-02-tarih-suzgeci-yerel-gun",
    "M94": "K8-02-tarih-suzgeci-yerel-gun", "M95": "K5-05-karar-yokken-onceki-gec-teslim-sayilir", "M96": "K1-09-bu-ay-gecen-ay-farkli-ay",
    "M97": "K6-02-asil-isin-karari-belirsizi-gecmez",
    "M98": "D3-01-yeniden-deneme-7-gun-yeni-gonderimden", "M99": "D5-01-sonraki-denemesi-kabul-daha-once", "M100": "D6-01-asilmis-belirsiz-yeni-toplu-iste-eler",
    "M101": "D1-01-belirsiz-yeni-toplu-iste-elenir", "M102": "D1-01-belirsiz-yeni-toplu-iste-elenir", "M103": "D7-01-geri-yukleme-sonrasi-defterdeki-kabul-sayilir",
    "M104": "D8-01-tasinan-veride-dosyadaki-ileti-sayilir", "M105": "D2-01-hatirlatma-dunden-bekleyen-bugunku-eler", "M106": "D4-01-ozel-aralik-ayni-gun-bu-ay",
    "M107": "D1-01-belirsiz-yeni-toplu-iste-elenir", "M108": "K6-03-acilistan-once-belirsiz-geri-yukleme-sonrasi",
    "M109": "E2-03-yeniden-denemede-kuyrukta-once-belirsiz", "M110": "E2-05-yeniden-denemede-belirsiz-once-r3", "M111": "E2-06-isteki-yine-de-gonder-zaten-kuyrukta",
    "M112": "E2-01-yeni-is-uclu-cakisma", "M113": "E2-01-yeni-is-uclu-cakisma", "M114": "E3-01-hatirlatma-belirsiz-ayni-yerel-gun",
    "M115": "E3-01-hatirlatma-belirsiz-ayni-yerel-gun", "M116": "E4-01-son-3-ay-sonraki-teslim-7-gun", "M117": "N6-01-yeniden-denemede-baska-iste-bekleyen",
    "M118": "F1-01-iki-belirsiz-is-isteki-yine-de-gonder-gider", "M119": "F2-01-hatirlatma-yeniden-deneme-ertesi-gun",
    "M120": "G2-01-bu-ay-0311-ozel-0511", "M121": "G2-02-iki-ozel-aralik-kendi-gunlerinde-bu-ay", "M122": "G1-01-ozel-aralik-sinirla-ertesi-gun-ayni-donem",
    "M123": "G2-03-gece-yarisi-bu-ay-yerel-gun", "M124": "G3-01-tasinan-belirsiz-yeni-iste-eler", "M125": "G4-01-sifirlama-meta-bekletti-sayilmaz",
    "M126": "G5-01-meta-bekletti-ikinci-deneme-belirsiz-elenir", "M127": "G0-01-sonraki-denemesi-teslimsiz-durdu-yeniden-gider",
    "M128": "G0-02-asil-isteki-belirsiz-deneme-yine-de-gonder",
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


@test("G karsilastir: 'secenek' yaprağı (karar susuyor: program seçeneklerden biri olmalı)")
def _g5():
    h = []
    b = [{"secimler": [{}], "sonuc": {"d": {"secenek": ["İptal", "Teslim Edildi"], "susuyor": "x"}, "s": {"secenek": [{"a": 1}, {"b": 1}], "susuyor": "y"}}}]
    if kahin.karsilastir(b, {"d": "Teslim Edildi", "s": {"b": 1}}, kahin.tam_secim({})):
        h.append("geçerli seçenek fark verdi")
    if len(kahin.karsilastir(b, {"d": "Başarısız", "s": {"a": 2}}, kahin.tam_secim({}))) != 2:
        h.append("geçersiz seçenekler iki fark vermedi")
    return h


# ---- I -----------------------------------------------------------------------------------------------------------------------
def _ms(iso_):
    return kahin.zaman_ayristir(iso_, 0)


@test("I dönem çözümü (K1): Bu Ay/Geçen Ay takvim ayı anahtarı; ay sonu → 1'i; 31.12 → 01.01; şubat kırpması; hatırlatma yerel gün")
def _i1():
    tz = kahin.TR
    h = []
    def c(donem, t, sablon="ekstre"):
        return kahin.donem_coz(donem, _ms(t), tz, sablon)
    ornek = [
        ({"secim": "bu_ay"}, "2026-10-31T10:00:00+03:00", ("ay", "2026-10"), [("2026-10-01", "2026-10-31")]),
        ({"secim": "gecen_ay"}, "2026-11-01T10:00:00+03:00", ("ay", "2026-10"), [("2026-10-01", "2026-10-31")]),
        ({"secim": "gecen_ay"}, "2027-01-01T00:30:00+03:00", ("ay", "2026-12"), [("2026-12-01", "2026-12-31")]),
        ({"secim": "bu_ay"}, "2026-10-15T10:00:00+03:00", ("ay", "2026-10"), [("2026-10-01", "2026-10-15"), ("2026-10-01", "2026-10-31")]),
        ({"secim": "gecen_ay"}, "2028-03-01T09:00:00+03:00", ("ay", "2028-02"), [("2028-02-01", "2028-02-29")]),
        ({"bas": "2026-10-01", "son": "2026-10-15"}, "2026-10-30T10:00:00+03:00", ("aralik", "2026-10-01", "2026-10-15"), [("2026-10-01", "2026-10-15")]),
        ("tum", "2026-10-30T10:00:00+03:00", ("secim", "tum"), [(None, None)]),
        ({"secim": "son_3_ay"}, "2026-10-30T10:00:00+03:00", ("secim", "son_3_ay"), None),
    ]
    for d, t, anahtar, okumalar in ornek:
        r = c(d, t)
        if r["anahtar"] != anahtar:
            h.append(f"{d} @ {t}: anahtar {r['anahtar']} ≠ {anahtar}")
        if okumalar is not None and r["okumalar"] != okumalar:
            h.append(f"{d} @ {t}: okumalar {r['okumalar']} ≠ {okumalar}")
    if kahin.ay_ekle(kahin.date(2026, 5, 31), -3) != kahin.date(2026, 2, 28) or kahin.ay_ekle(kahin.date(2028, 5, 31), -3) != kahin.date(2028, 2, 29):
        h.append("ay_ekle şubat kırpması")
    if kahin.ay_ekle(kahin.date(2027, 1, 15), -3) != kahin.date(2026, 10, 15):
        h.append("ay_ekle yıl geçişi")
    r = c(None, "2026-10-31T00:10:00+03:00", "hatirlatma")
    if r["anahtar"] != ("gun", "2026-10-31"):
        h.append(f"hatırlatma yerel gün {r['anahtar']} (UTC'de 30.10)")
    try:
        c({"secim": "uydurma"}, "2026-10-30T10:00:00+03:00")
        h.append("bilinmeyen seçim kabul edildi")
    except ValueError:
        pass
    return h


@test("I karar izlenebilirliği: K1–K8, D1–D8, E1–E4, N6 metinleri KARARLAR'da, her karar ≥ 2 senaryoda (başlık ya da kaynak)")
def _i2():
    h = []
    for k in ("K1", "K2", "K3", "K4", "K5", "K6", "K7", "K8", "D1", "D2", "D3", "D4", "D5", "D6", "D7", "D8", "E1", "E2", "E3", "E4", "N6", "F1", "F2", "G0", "G1", "G2", "G3", "G4", "G5"):
        if not kahin.KARARLAR.get(k, {}).get("metin"):
            h.append(f"{k}: karar metni yok")
        n = sum(1 for s in TUM if s["baslik"] == k or f"{k} " in s["kaynak"] or s["kaynak"].startswith(k) or f", {k}" in s["kaynak"] or f"+ {k}" in s["kaynak"])
        if n < 2:
            h.append(f"{k}: yalnız {n} senaryo")
        else:
            h.append(f"bilgi: {k}: {n} senaryo")
    return h


@test("I yeniden deneme ve liste çıktıları tutarlı (elenen ∩ alınan = ∅; sayfa ≤ 30, etiket tekil, kısa sayfada Daha Fazla yok)")
def _i3():
    h = []
    for s in TUM:
        r = beklenen(s)[0]["sonuc"]
        for e, y in (r.get("yeniden") or {}).items():
            if set(y["elenen"]) & set(y["alinan"]):
                h.append(f"{s['ad']} {e}: aynı kişi hem elendi hem alındı")
            if y["oneri"] and kahin.BELIRSIZ_NEDEN not in y["elenen"].values():
                h.append(f"{s['ad']} {e}: Sonucu Belirsiz elemesi yokken öneri var")
        for e, l_ in (r.get("listeler") or {}).items():
            if "ret" in l_:
                continue
            et = l_["etiketler"]
            if len(et) > kahin.SAYFA or len(set(et)) != len(et):
                h.append(f"{s['ad']} {e}: sayfa {len(et)} / tekil değil")
            if len(et) < kahin.SAYFA and l_["daha_fazla"] is not False:
                h.append(f"{s['ad']} {e}: kısa sayfada Daha Fazla Göster")
    return h


@test("I eski 145 senaryoda yeni yaprak türü ('secenek') ve yeni çıktı alanı (yeniden, listeler) YOK (beklentileri değişmedi)")
def _i4():
    h = []
    def gez(o, yol=""):
        if isinstance(o, dict):
            if "secenek" in o:
                return [yol]
            return [y for k, v in o.items() for y in gez(v, f"{yol}.{k}")]
        if isinstance(o, list):
            return [y for i, v in enumerate(o) for y in gez(v, f"{yol}[{i}]")]
        return []
    eski = [s for s in TUM if not (len(s["baslik"]) == 2 and s["baslik"][0] in "KDENFG" and s["baslik"][1].isdigit())]
    for s in eski:
        r = beklenen(s)[0]["sonuc"]
        if gez(r) or "yeniden" in r or "listeler" in r:
            h.append(f"{s['ad']}: yeni yaprak/alan")
    if len(eski) != 145:
        h.append(f"eski senaryo sayısı {len(eski)} ≠ 145")
    return h


@test("I G2 dönem eşliği birim denetimi: hazır seçimin o günkü tarihleri + kendi günlerinde Bu Ay'a eşit özel aralıklar BİRLİKTE (G0 3: şüphede aynı dönem)")
def _i5():
    e = kahin.donem_eslesir
    bu_ay_0311 = (("ay", "2026-11"), ("2026-11-01", "2026-11-03"), None)
    ozel_0103_gun05 = (("aralik", "2026-11-01", "2026-11-03"), ("2026-11-01", "2026-11-03"), None)
    ozel_0103_gun03 = (("aralik", "2026-11-01", "2026-11-03"), ("2026-11-01", "2026-11-03"), ("ay", "2026-11"))
    ozel_0105_gun05 = (("aralik", "2026-11-01", "2026-11-05"), ("2026-11-01", "2026-11-05"), ("ay", "2026-11"))
    ozel_0104_gun05 = (("aralik", "2026-11-01", "2026-11-04"), ("2026-11-01", "2026-11-04"), None)
    gecen_ay_ekim = (("ay", "2026-10"), ("2026-10-01", "2026-10-31"), None)
    ornek = [(bu_ay_0311, ozel_0103_gun05, True), (ozel_0103_gun03, ozel_0105_gun05, True), (ozel_0104_gun05, bu_ay_0311, False),
             (ozel_0105_gun05, gecen_ay_ekim, False), (ozel_0104_gun05, ozel_0105_gun05, False),
             ((("secim", "son_3_ay"), None, None), (("secim", "tum"), None, None), False)]
    h = [f"{a} ↔ {b}: {e(a, b)} ≠ {v}" for a, b, v in ornek if e(a, b) != v or e(b, a) != v]
    if e(bu_ay_0311, ozel_0103_gun05, {"M120"}) or e(ozel_0103_gun03, ozel_0105_gun05, {"M121"}):
        h.append("M120 / M121 birim düzeyinde etkisiz")
    return h


@test("I D1: hiçbir senaryoda Sonucu Belirsiz kişi 'Zaten Kuyrukta' ile elenmiyor (eski yorum 3 düştü); yeni toplu işte 'Sonucu Belirsiz' elemesi en az bir senaryoda")
def _i6():
    h = []
    n = 0
    for s in TUM:
        r = beklenen(s)[0]["sonuc"]
        n += sum(1 for v in r["elenen"].values() for x in v.values() if x == kahin.BELIRSIZ_NEDEN)
    if kahin.BELIRSIZ in kahin.KUYRUKTA:
        h.append("Sonucu Belirsiz hâlâ KUYRUKTA kümesinde")
    if n == 0:
        h.append("yeni toplu işte Sonucu Belirsiz elemesi hiç yok")
    return h + [f"bilgi: yeni toplu işte Sonucu Belirsiz elemesi {n} kez"]


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
