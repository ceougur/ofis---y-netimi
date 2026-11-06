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
     Sonucu Belirsiz artık Zaten Kuyrukta değil; güncelleme 4 (E1–E4, N6): karar izlenebilirliği; güncelleme 9 (J1–J9): BİLİNEN SINIR işaretleri ve kanca
     yanıt sayıları tutarlı
  C (güncelleme 9, J5): "Bu Ay" teslim = Teslim + Okundu İŞ sayısı yalnız her işin tek iletisi olan ve bütün iletileri dosyada olan senaryoda; öbüründe
     Teslim + Okundu ≤ Σ "Bu Ay" ≤ Meta'daki ileti (J5: "Bu Ay" teslim edilen DENEMEyi sayar)
  I8 (güncelleme 11, 2.5.0: SW1, SW2, SD1837, SD1915, SW4, S7): secenek_birlestir birim denetimi; yeniden bağlanmadan Devam Et'in üç okuması kime / kaç kez
     alanlarında (kabul, Meta'daki ileti, "Bu Ay", elenen, oluşmayan) AYNI; belirteç kodları (190, 0; 102 değil); n3 artık BİLİNEN SINIR işaretli değil;
     karar dışı durum (Süresi Doldu bağlantıda Yine de Gönder) kâhinde hata verir (kodlanmadı)
  I9 (güncelleme 12, 2.5.0: S7A, S7B): güncelleme 11'de hata veren S7-a / S7-b durumları artık hesaplanır ve A sonucunu verir; girdi tutarsızlığı (başlatmada etiketsiz cariye
     `supheli_elle`) hata verir; elle işaretli işte Yine de Gönder hesaplanır; Ekstre başlatmasında `supheli_elle` yok sayılır. Güncelleme 13: (c) eski S7-c girdisi (Yine de Gönder basıldığında
     kayıt açık) artık S16 ile hesaplanır — elle sayılır, şüphesiz tutarla gider (README §18.3)
  I10 (güncelleme 13, 2.5.0: S16, S17, NB5): S16 elemenin anının iki okumasında (`s16_an`) kime / kaç kez alanları AYNI; iki okumanın kime / kaç kez ayrıştığı durum hata verir
     (kodlanmadı); `supheli_etiketi` yalnız S16 ve (güncelleme 14) S22 senaryolarında; net eleme adı iki seçenekli. Güncelleme 14: S7-d denetimleri I11'e taşındı (tersine döndü)
  I11 (güncelleme 14, 2.5.0: S22): I10'un eski S7-d girdileri (duraklatma ve zincirdeki yeniden deneme yolu) artık hesaplanır — "Atlandı — Şüpheli Alacağı Var"; aynı girdide B seçeneği
     (M210) ayrışır; güncelleme 15: S7-e denetimi I12'ye taşındı (tersine döndü); S22 senaryolarında S23 tetiği yok
  I12 (güncelleme 15, 2.5.0: S23, SW3): eski S7-e girdisi S23 ile hesaplanır (elle, şüphesiz tutarla; B seçeneği M213 ayrışır); `s23_an` iki okumasında kime / kaç kez AYNI, okumaların
     ayrıştığı durum (S23-a) hata verir; S-W3: yil_sonra birim denetimi, bekleyen / belirsiz işte silme (S-W3-a) ve silinmiş Ekstre'nin yeniden gönderimi (S-W3-b) hata verir, silinmiş
     Ödeme Hatırlatma'nın yeniden gönderimi karttan hesaplanır; yeni alanlar (icerik_silindi, elle_sayilan, kontrol içerik) yalnız S23 / SW3 senaryolarında
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
            if isinstance(tel, dict) and "plan_susuyor" in tel:           # güncelleme 15 (S-W3-c): denetlenmez yaprak
                continue
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
        to = ds.get(kahin.TESLIM, 0) + ds.get(kahin.OKUNDU, 0)
        isler_ = sonuc.get("isler")
        tek = True
        if isler_ is not None:                                         # J5: deneme başına; tek iletili ve hepsi dosyada → iş sayısına eşit
            mi = [j["meta_ileti"] for j in isler_.values()]
            tek = (all(isinstance(x, int) and x <= 1 for x in mi) and sum(x for x in mi if isinstance(x, int)) == m.get("toplam_meta_ileti")
                   and not any(j.get("atlanma_nedeni") == kahin.DAHA_ONCE for j in isler_.values()))   # J10: eski iletisi teslim edilip Atlandı olan iş
        if tek and teslim_toplam != to:
            h.append(f"{ad}: teslim_sayac: 'Bu Ay' teslim {teslim_toplam} ≠ Teslim + Okundu iş {to}")
        elif not tek and not (to <= teslim_toplam <= (m.get("toplam_meta_ileti") or 0)):
            h.append(f"{ad}: teslim_sayac: Teslim + Okundu {to} ≤ 'Bu Ay' {teslim_toplam} ≤ Meta'daki ileti {m.get('toplam_meta_ileti')} bozuk")
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
    "M128": "G0-02-asil-isteki-belirsiz-deneme-yine-de-gonder", "M129": "G6-01-son-3-ay-ozel-aralik-7-gun", "M130": "G6-01-son-3-ay-ozel-aralik-7-gun",
    "M131": "H1-01-yine-de-gonder-teslim-daha-once", "M132": "H1-02-yine-de-gonder-basarisiz-belirsiz-surer", "M133": "H2-01-tasima-gonderiliyor-belirsiz",
    "M134": "H3-01-geri-yukleme-dosyasiz-gec-kabul", "M135": "H4-01-r3-son-gonderim-son-kabul-gece-yarisi", "M136": "H4-01-r3-son-gonderim-son-kabul-gece-yarisi",
    "M137": "J1-01-duraklatilmis-meta-bekletti-teslim-is-kapanir", "M138": "J1-03-silinmis-sirket-gec-bildirim", "M139": "J2-01-meta-bekletti-teslim-is-kapanir",
    "M140": "J3-01-geri-yukleme-sonrasi-gec-failed-yeniden-gonderilir", "M141": "J4-01-suresi-doldu-son-kabulden-meta-bekletti", "M142": "J5-01-bekletme-sonrasi-iki-teslim",
    "M143": "J6-01-yanit-beklenirken-taninmayan-503-yineleme", "M144": "J6-02-sirket-gecici-acilamaz-503", "M145": "J6-03-bildirim-kaydedilemez-503",
    "M146": "J1-03-silinmis-sirket-gec-bildirim", "M147": "J7-01-onarim-bekleyen-kabul-yeni-gonderim-baslamaz", "M148": "J8-01-tum-hareketler-bu-ay-ayni-gun",
    "M150": "J8-03-tum-hareketler-kanon-sonraki-gun-bu-ay",
    "M151": "J9-01-n3-iptal-sonrasi-ikinci-is-gec-teslim-iki-ileti", "M152": "J1-04-asilmis-belirsiz-gec-teslim-iki-deneme",
    "M153": "J3-04-eski-denemenin-failed-i-simdiki-kabulu-bozmaz",
    "M154": "J10-01-a-yine-de-gonder-sinirda-eski-teslim-gitmez", "M155": "J11-01-tum-hareketler-metni-acilis-gunu-sinirla-ertesi-gun",
    "M156": "J11-02-hareketsiz-cari-metni-ve-eslik", "M157": "J8-02-tum-hareketler-gecen-ay-ayni-gun", "M158": "J11-01-tum-hareketler-metni-acilis-gunu-sinirla-ertesi-gun",
    "M159": "J11-03-ertesi-gune-kayan-kisi-acilis-gunuyle-eslesir", "M160": "J10-04-c-duz-yeniden-deneme-eski-teslim-ikinci-kopya-gider",
    "M161": "J10-05-b-r3-yine-de-gonder-onceki-teslim-ikinci-kopya-gider", "M162": "ICERIK-08-tum-hareketler",
    "M163": "ICERIK-09-kuyrukta-bakiye-degisti", "M164": "J12-02-tum-hareketler-acilistan-sonra-tarihli-hareket-girmez",
    "M165": "J7-01-onarim-bekleyen-kabul-yeni-gonderim-baslamaz",
    "M7": "W1-01-varsayilan-30-gun-eski-72-sa-okunmaz", "M166": "W1-03-meta-bildirir-12-sa-sablon-basina", "M167": "W1-01-varsayilan-30-gun-eski-72-sa-okunmaz",
    "M168": "W1-01-varsayilan-30-gun-eski-72-sa-okunmaz", "M169": "W1-03-meta-bildirir-12-sa-sablon-basina", "M170": "W2-01-kabulde-bilinmiyor-sonra-12-sa",
    "M171": "W3-01-kabulde-12-sa-sonra-30-gun-uzar",
    "M172": "SD1915-01-ileti-isteginde-190-bekleyenlere-doner", "M173": "SW4-01-kod-0-ayni-sirketin-oburu-toplu-isi-de-duraklar",
    "M174": "SD1915-01-ileti-isteginde-190-bekleyenlere-doner", "M175": "SD1837-01-sure-dolunca-duraklar-yeniden-baglaninca-devam-yalniz-kalanlar",
    "M176": "SD1837-01-sure-dolunca-duraklar-yeniden-baglaninca-devam-yalniz-kalanlar", "M177": "SD1837-01-sure-dolunca-duraklar-yeniden-baglaninca-devam-yalniz-kalanlar",
    "M178": "SW2-01-suresi-doldu-pencerede-sayilmaz-yeni-is-gider", "M179": "SD1837-03-sure-dolunca-yeni-gonderim-baslamaz", "M180": "SW4-03-kod-102-bugunku-gibi",
    "M181": "S7-01-supheli-alacakli-otomatik-listeye-girmez", "M182": "S7-02-supheli-alacakli-elle-secilir-suphelisiz-tutar",
    "M183": "S7-02-supheli-alacakli-elle-secilir-suphelisiz-tutar", "M184": "SD1915-02-pdf-yuklemesinde-190-bekleyenlere-doner",
    "M185": "SD1915-01-ileti-isteginde-190-bekleyenlere-doner", "M186": "SD1915-03-meta-bekletti-ikinci-deneme-190-ilk-ileti-teslim-is-kapanir",
    "M187": "SW2-02-ayni-aliciya-sayilan-baska-kabul-varsa-sayilir", "M188": "SD1915-04-geri-yukleme-reddedilen-sayilmaz",
    "M189": "SD1837-01-sure-dolunca-duraklar-yeniden-baglaninca-devam-yalniz-kalanlar",
    "M190": "S7A-01-elle-supheli-suphesiz-gecikmis-yok-elenir", "M191": "S7A-02-elle-supheli-kuyrukta-suphesiz-kapanir-gonderimde-atlanir",
    "M192": "S7B-01-sinirda-supheli-acilan-atlanir-yeni-gonderimde-elle-gider", "M193": "S7B-02-duraklatmada-supheli-acilan-atlanir-elle-secilen-gider",
    "M194": "S7B-03-kuyrukta-acilan-kayit-kapanirsa-gider", "M195": "S7B-04-meta-bekletti-ikinci-denemede-supheli-atlanir",
    "M196": "S7B-01-sinirda-supheli-acilan-atlanir-yeni-gonderimde-elle-gider", "M197": "S7B-01-sinirda-supheli-acilan-atlanir-yeni-gonderimde-elle-gider",
    "M198": "S7A-03-gece-yarisi-suphesiz-vade-yerel-gun",
    "M199": "S16-01-yine-de-gonder-supheli-acik-elle-sayilir-suphesiz-tutarla-gider", "M200": "S16-02-yine-de-gonder-suphesiz-tutar-yok-elenir-ertesi-gun-gider",
    "M201": "S16-01-yine-de-gonder-supheli-acik-elle-sayilir-suphesiz-tutarla-gider", "M202": "S17-01-elle-supheli-suphesiz-net-borcla-sinirlanir",
    "M203": "S17-01-elle-supheli-suphesiz-net-borcla-sinirlanir", "M204": "NB5-01-net-borc-siniri-bize-alacakli-elenir",
    "M205": "NB5-01-net-borc-siniri-bize-alacakli-elenir", "M206": "NB5-02-gonderim-aninda-bize-alacakli-atlanir-tutar-yeniden",
    "M207": "NB5-01-net-borc-siniri-bize-alacakli-elenir", "M208": "S16-03-kayit-basmadan-once-kapanir-etiket-yok-butun-gecikmisle-gider",
    "M209": "S16-01-yine-de-gonder-supheli-acik-elle-sayilir-suphesiz-tutarla-gider",
    "M210": "S22-01-sinirda-bekleyen-yine-de-gonder-supheli-acilir-atlanir-yeniden-basma-gider",
    "M211": "S22-01-sinirda-bekleyen-yine-de-gonder-supheli-acilir-atlanir-yeniden-basma-gider",
    "M212": "S22-01-sinirda-bekleyen-yine-de-gonder-supheli-acilir-atlanir-yeniden-basma-gider",
    "M213": "S23-01-sinirda-bekleyen-yeniden-basma-elle-sayilir-pencere-acilinca-gider",
    "M214": "S23-01-sinirda-bekleyen-yeniden-basma-elle-sayilir-pencere-acilinca-gider",
    "M215": "SW3-01-bir-yil-siniri-iki-yani-sure-dolunca-ayni-donem-daha-once-gonderildi",
    "M216": "SW3-01-bir-yil-siniri-iki-yani-sure-dolunca-ayni-donem-daha-once-gonderildi",
    "M217": "SW3-01-bir-yil-siniri-iki-yani-sure-dolunca-ayni-donem-daha-once-gonderildi",
    "M218": "SW3-03-silme-talebi-ayni-donem-elenir-sonraki-donem-gider-silinen-telefon-kullanilmaz",
    "M219": "SW3-03-silme-talebi-ayni-donem-elenir-sonraki-donem-gider-silinen-telefon-kullanilmaz",
    "M220": "SW3-02-gece-yarisi-yerel-gun-utc-farkli-bir-yil-siniri",
    "M221": "SW3-03-silme-talebi-ayni-donem-elenir-sonraki-donem-gider-silinen-telefon-kullanilmaz",
    "M222": "SW3-04-geri-yukleme-bir-yildan-eski-icerik-donunce-silinir",
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


@test("I karar izlenebilirliği: K1–K8, D1–D8, E1–E4, N6 … J12, W1 metinleri KARARLAR'da, her karar ≥ 2 senaryoda (başlık ya da kaynak)")
def _i2():
    h = []
    for k in ("K1", "K2", "K3", "K4", "K5", "K6", "K7", "K8", "D1", "D2", "D3", "D4", "D5", "D6", "D7", "D8", "E1", "E2", "E3", "E4", "N6", "F1", "F2", "G0", "G1", "G2", "G3", "G4", "G5", "G6", "H1", "H2", "H3", "H4",
              "J1", "J2", "J3", "J4", "J5", "J6", "J7", "J8", "J9", "J10", "J11", "J12", "W1", "W2", "W3",
              "SW1", "SW2", "SD1837", "SD1915", "SW4", "S7", "S7A", "S7B", "S16", "S17", "NB5", "S22", "S23", "SW3"):
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
            if any(isinstance(y[k], dict) and "secenek" in y[k] for k in ("elenen", "alinan")):
                continue                                                   # güncelleme 13: okumalar arası seçenek — her okuma ayrı denetlenir (I10)
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
    eski = [s for s in TUM if not (len(s["baslik"]) in (2, 3) and s["baslik"][0] in "KDENFGHJW" and s["baslik"][1:].isdigit())
            and s["baslik"] not in senaryolar.YENI_250]                    # güncelleme 11 başlıkları (HESAP-0 eski kümede kalır; beklentisi değişti — README §16.6)
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
    # G6: Son 3 Ay / Tüm'ün o günkü tarihleri ↔ özel aralık (iki yön); 7 gün eslesir()'de
    son3 = (("secim", "son_3_ay"), None, None, (("2026-07-30", "2026-10-30"), ("2026-08-01", "2026-10-30")))
    ozel_eq = (("aralik", "2026-08-01", "2026-10-30"), ("2026-08-01", "2026-10-30"), None, (("2026-08-01", "2026-10-30"),))
    ozel_ne = (("aralik", "2026-08-02", "2026-10-30"), ("2026-08-02", "2026-10-30"), None, (("2026-08-02", "2026-10-30"),))
    if not (e(son3, ozel_eq) and e(ozel_eq, son3)) or e(son3, ozel_ne) or e(son3, ozel_eq, {"M129"}):
        h.append("G6 çapraz eşlik birim denetimi")
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


@test("I güncelleme 9 + 11: BİLİNEN SINIR işaretleri (J5 iki ileti; n3 artık KARAR SW1 — işaretsiz) ve kanca yanıt sayıları tutarlı")
def _i7():
    h = []; bilgi = []
    for s in TUM:
        bs = s.get("bilinen_sinir") or {}
        for k, neden in bs.items():
            if not neden:
                h.append(f"{s['ad']}: bilinen sınır {k} nedensiz")
            bilgi.append(f"bilgi: BİLİNEN SINIR {k}: {s['ad']}")
        if "n3" in bs:
            h.append(f"{s['ad']}: n3 hâlâ BİLİNEN SINIR işaretli (güncelleme 11: S-W1 KARARI)")
        if s["baslik"] == "J9" and "SW1" not in s["kaynak"]:
            h.append(f"{s['ad']}: J9 senaryosunun kaynağında SW1 kararı yok")
        r = beklenen(s)[0]["sonuc"]
        if s.get("kanca_yanit_cikti"):
            ky = r.get("kanca_yanitlari")
            if not isinstance(ky, dict) or set(ky) != {"200", "503"} or ky["200"] < 1:
                h.append(f"{s['ad']}: kanca_yanitlari biçimi {ky}")
        elif "kanca_yanitlari" in r:
            h.append(f"{s['ad']}: istenmediği hâlde kanca_yanitlari çıktıda (eski senaryolar değişmemeli)")
    if sum(1 for s in TUM if s["baslik"] in ("J9", "SW1")) < 4:
        h.append("n3 (J9 + SW1) senaryosu < 4")
    return h + bilgi


@test("I güncelleme 11: secenek_birlestir birim; yeniden bağlanmadan Devam Et'in üç okumasında kime / kaç kez AYNI; belirteç kodları; karar dışı durumlar hata verir")
def _i8():
    h = []; bilgi = []
    sb = kahin.secenek_birlestir
    if sb([1, 1, 1], "n") != 1 or sb([{"a": 1, "b": 2}, {"a": 1, "b": 3}], "n") != {"a": 1, "b": {"secenek": [2, 3], "susuyor": "n"}}:
        h.append("secenek_birlestir: aynı değer / sözlük içi")
    if sb([{"secenek": ["x", "y"], "susuyor": "e"}, "z", "x"], "n") != {"secenek": ["x", "y", "z"], "susuyor": "e + n"}:
        h.append(f"secenek_birlestir: iç seçenek düzleşmedi {sb([{'secenek': ['x', 'y'], 'susuyor': 'e'}, 'z', 'x'], 'n')}")
    if sb([{"plan_susuyor": "p"}, 3], "n") != {"plan_susuyor": "p"} or sb([[1, 2], [1, 3]], "n") != [1, {"secenek": [2, 3], "susuyor": "n"}]:
        h.append("secenek_birlestir: plan_susuyor / liste")
    b = kahin.Benzetim(senaryolar.girdi(TUM[0]))
    if not (b.belirtec_kodu(190) and b.belirtec_kodu(0)) or b.belirtec_kodu(102) or b.belirtec_kodu(10) or b.belirtec_kodu(None):
        h.append("belirteç kodları 190 / 0 (102 ve 10 değil)")
    if not kahin.Benzetim(senaryolar.girdi(TUM[0]), mut=frozenset(["M180"])).belirtec_kodu(102) or kahin.Benzetim(senaryolar.girdi(TUM[0]), mut=frozenset(["M173"])).belirtec_kodu(0):
        h.append("M180 / M173 birim düzeyinde etkisiz")
    # README §16.4: üç okuma kime / kaç kez alanlarında aynı (yalnız gösterim / istek sayısı ayrışır)
    n = 0
    for s in TUM:
        for zaman in kahin.ZAMANLAR:
            b0 = kahin.Benzetim(senaryolar.girdi(s), kahin.tam_secim({}), zaman)
            r0 = b0.calistir()
            if "devam_sd" not in b0.okuma_izi:
                continue
            n += 1
            for o in kahin.DEVAM_OKUMALARI[1:]:
                r = kahin.Benzetim(senaryolar.girdi(s), kahin.tam_secim({}), zaman, okuma={"devam_sd": o}).calistir()
                for alan in ("elenen", "olusmadi", "onceki_uyari", "bu_ay", "baslamadi"):
                    if not senaryolar._esit(r[alan], r0[alan]):
                        h.append(f"{s['ad']} [{zaman}] okuma {o}: {alan} ayrışıyor (kime / kaç kez)")
                for alan in ("kabul", "meta_ileti", "toplam_meta_ileti", "toplam_kabul_program"):
                    if not senaryolar._esit(r["meta"][alan], r0["meta"][alan]):
                        h.append(f"{s['ad']} [{zaman}] okuma {o}: meta.{alan} ayrışıyor (kime / kaç kez)")
    if n == 0:
        h.append("yeniden bağlanmadan Devam Et hiçbir senaryoda yok")
    # karar dışı / kodlanmamış durumlar sessizce geçmez (KÂHİN SUSUYOR — README §16.4; S7-a / S7-b güncelleme 12'de KAPANDI → I9)
    g = copy.deepcopy(senaryolar.girdi(next(x for x in TUM if x["ad"].startswith("SD1915-01"))))
    g["olaylar"].append({"t": "+40m", "tur": "basarisizlari_yeniden_dene", "toplu": "T1"})
    try:
        kahin.hesapla(g)
        h.append("bağlantı Süresi Doldu iken yeniden deneme sessizce hesaplandı")
    except ValueError as e:
        if "KÂHİN SUSUYOR" not in str(e):
            h.append(f"yeniden deneme: beklenmeyen hata {e}")
    return h + bilgi + [f"bilgi: üç okumalı koşu {n} (senaryo × zaman ucu)"]


@test("I güncelleme 12 (S7A, S7B): güncelleme 11'in S7-a / S7-b hata yolları A sonucunu verir; eski S7-c girdisi S16 ile hesaplanır (güncelleme 13); girdi tutarsızlığı hata verir; elle işaretli Yine de Gönder ve Ekstre'de supheli_elle hesaplanır")
def _i9():
    h = []
    s7 = next(x for x in TUM if x["ad"].startswith("S7-02"))
    # (a) güncelleme 11'in S7-a hata yolu: elle seçilen SA'nın bütün gecikmişi şüpheli → "Gecikmiş Borç Yok" (Y12-1)
    g = copy.deepcopy(senaryolar.girdi(s7))
    g["cariler"][1] = {**g["cariler"][1], "vadeler": [{"vade": "2026-10-05", "kalan": 300, "supheli": True}]}
    try:
        r = kahin.hesapla(g)[0]["sonuc"]
        if r["elenen"].get("T1", {}).get("SA") != "gecikmis_borc_yok" or "T1/SA" in r["isler"]:
            h.append(f"S7-a: SA 'Gecikmiş Borç Yok' ile elenmedi: {r['elenen']}")
    except ValueError as e:
        h.append(f"S7-a: hâlâ hata veriyor: {e}")
    # (b) güncelleme 11'in S7-b hata yolu: duraklatılmışken şüpheli kaydı açılan, elle seçilmemiş SA → Devam Et'te gönderim anında Atlandı (Y12-4/5)
    g = copy.deepcopy(senaryolar.girdi(s7))
    g["olaylar"][0] = {**g["olaylar"][0], "supheli_elle": []}
    g["cariler"][1] = {**g["cariler"][1], "vadeler": [{"vade": "2026-10-12", "kalan": 200}]}
    g["olaylar"].insert(1, {"t": "+0s", "tur": "duraklat", "toplu": "T1"})
    g["olaylar"].insert(2, {"t": "+1m", "tur": "cari", "id": "SA", "vadeler": [{"vade": "2026-10-05", "kalan": 300, "supheli": True}, {"vade": "2026-10-12", "kalan": 200}]})
    g["olaylar"].insert(3, {"t": "+2m", "tur": "devam", "toplu": "T1"})
    try:
        r = kahin.hesapla(g)[0]["sonuc"]
        j = r["isler"].get("T1/SA") or {}
        if j.get("durum") != kahin.ATLANDI or j.get("atlanma_nedeni") != kahin.SUPHELI or j.get("post") != 0:
            h.append(f"S7-b: SA atlanmadı: {j}")
    except ValueError as e:
        h.append(f"S7-b: hâlâ hata veriyor: {e}")
    # (c) S7-c (README §17.4): Sonucu Belirsiz işte Yine de Gönder + sonuç beklenirken açılan şüpheli kaydı, iş elle işaretsiz → KULLANICIYA SORULMALI (kodlanmadı)
    s5 = next(x for x in TUM if x["ad"].startswith("S7B-05"))

    def belirsiz_girdi(cid):
        g_ = copy.deepcopy(senaryolar.girdi(s5))
        g_["meta_davranis"] = {"mesaj": {cid: ["yanitsiz_kabul", "kabul"]}, "kanca": {cid: [], "*": [["sent", "+1s"], ["delivered", "+5s"]]}}
        g_["olaylar"] = [o for o in g_["olaylar"] if o["tur"] not in ("basarisizlari_yeniden_dene", "kontrol")]
        g_["olaylar"].append({"t": "+2h", "tur": "yine_de_gonder", "toplu": "T1", "cari": cid})
        return g_
    # güncelleme 13 (README §18.3): S7-c KAPANDI (S16 = A) — aynı girdi artık hesaplanır: basma anında kayıt açık → elle sayılır, şüphesiz tutarla
    # (19.10.2026, 80,00 TL = şüphesiz net borç 380 − 300) gider
    try:
        r = kahin.hesapla(belirsiz_girdi("R7"))[0]["sonuc"]
        j = r["isler"]["T1/R7"]
        if j["post"] != 2 or j["atlanma_nedeni"] is not None or j["degiskenler"][2:4] != ["19.10.2026", "80,00 TL"]:
            h.append(f"S16 (eski S7-c girdisi): R7 elle şüphesiz tutarla gitmedi: {j}")
    except ValueError as e:
        h.append(f"S16 (eski S7-c girdisi) hâlâ hata veriyor: {e}")
    # (d) elle işaretli işte Yine de Gönder elle kalır (Y12-8) → hesaplanır, ikinci POST gider
    try:
        r = kahin.hesapla(belirsiz_girdi("RE7"))[0]["sonuc"]
        if r["isler"]["T1/RE7"]["post"] != 2 or r["isler"]["T1/RE7"]["atlanma_nedeni"] is not None:
            h.append(f"elle işaretli Yine de Gönder: {r['isler']['T1/RE7']}")
    except ValueError as e:
        h.append(f"elle işaretli Yine de Gönder hata verdi: {e}")
    # (e) girdi tutarsızlığı (Y12-3): başlatmada etiketsiz cariye supheli_elle → hata
    g = copy.deepcopy(senaryolar.girdi(s7))
    g["olaylar"][0] = {**g["olaylar"][0], "supheli_elle": ["SA", "A"]}
    try:
        kahin.hesapla(g)
        h.append("etiketsiz cariye supheli_elle sessizce kabul edildi")
    except ValueError as e:
        if "girdi tutarsız" not in str(e):
            h.append(f"girdi tutarsızlığı: beklenmeyen hata {e}")
    # (f) Ekstre başlatmasında supheli_elle yok sayılır (Y12-9)
    g = copy.deepcopy(senaryolar.girdi(s7))
    g["olaylar"][1] = {**g["olaylar"][1], "supheli_elle": ["SA"]}
    try:
        if not senaryolar._esit(kahin.hesapla(g), beklenen(s7)):
            h.append("Ekstre başlatmasında supheli_elle sonucu değiştirdi")
    except ValueError as e:
        h.append(f"Ekstre başlatmasında supheli_elle hata verdi: {e}")
    return h


@test("I güncelleme 13 (S16, S17, NB5): s16_an iki okumasında kime / kaç kez AYNI; iki okumanın ayrışması hata verir; supheli_etiketi yalnız S16 / S22'de; net eleme adı iki seçenekli")
def _i10():
    h = []; bilgi = []
    # (a) README §18.4: S16 elemenin anı — iki okuma kime / kaç kez alanlarında aynı (yalnız gösterim / iş durumu ayrışır)
    n = 0
    for s in TUM:
        for zaman in kahin.ZAMANLAR:
            b0 = kahin.Benzetim(senaryolar.girdi(s), kahin.tam_secim({}), zaman)
            r0 = b0.calistir()
            if "s16_an" not in b0.okuma_izi:
                continue
            n += 1
            for o in kahin.S16_OKUMALARI[1:]:
                r = kahin.Benzetim(senaryolar.girdi(s), kahin.tam_secim({}), zaman, okuma={"s16_an": o}).calistir()
                for ad_, rr in ((kahin.S16_OKUMALARI[0], r0), (o, r)):           # I3'ün atladığı seçenekli yanıtlar okuma başına: elenen ∩ alınan = ∅
                    for e, y in (rr.get("yeniden") or {}).items():
                        if set(y["elenen"]) & set(y["alinan"]):
                            h.append(f"{s['ad']} [{zaman}] okuma {ad_} {e}: aynı kişi hem elendi hem alındı")
                for alan in ("elenen", "olusmadi", "onceki_uyari", "bu_ay", "baslamadi"):
                    if not senaryolar._esit(r[alan], r0[alan]):
                        h.append(f"{s['ad']} [{zaman}] okuma {o}: {alan} ayrışıyor (kime / kaç kez)")
                for alan in ("post", "kabul", "meta_ileti", "toplam_post", "toplam_meta_ileti", "toplam_kabul_program"):
                    if not senaryolar._esit(r["meta"][alan], r0["meta"][alan]):
                        h.append(f"{s['ad']} [{zaman}] okuma {o}: meta.{alan} ayrışıyor (kime / kaç kez)")
    if n == 0:
        h.append("S16 elemenin anı (s16_an) hiçbir senaryoda yok")
    bilgi.append(f"bilgi: s16_an iki okumalı koşu {n} (senaryo × zaman ucu)")

    def hata_bekle(g, parca, ad):
        try:
            kahin.hesapla(g)
            h.append(f"{ad}: sessizce hesaplandı")
        except ValueError as e:
            if parca not in str(e):
                h.append(f"{ad}: beklenmeyen hata {e}")
    # (b), (c) güncelleme 14: S7-d (duraklatma / zincirdeki yeniden deneme yolu) KAPANDI (S22 = A) → I11 (aynı girdiler artık hesaplanır)
    # (d) iki okumanın kime / kaç kez ayrıştığı durum: basma anında şüphesiz tutar yok; 'gonderim' okumasında iş alınıp hemen duraklatılır, ertesi gün Devam Et'te tutar
    # doğmuştur (30.10 kalemi gecikmiş) → basma okumasında ileti yok, gönderim okumasında var → hata (senaryosuz)
    s2 = next(x for x in TUM if x["ad"].startswith("S16-02"))
    g = copy.deepcopy(senaryolar.girdi(s2))
    g["olaylar"] = [o for o in g["olaylar"] if o.get("etiket") != "Y2" and o["tur"] != "kontrol"]
    g["olaylar"] += [{"t": "+2h", "tur": "duraklat", "toplu": "T1"}, {"t": "+24h", "tur": "devam", "toplu": "T1"}]
    hata_bekle(g, "S16 elemenin anı", "S16 iki okuma ayrışması")
    # (e) supheli_etiketi yalnız S16 senaryolarının (güncelleme 14: ve S22'nin yolu S16 ile yeniden basma — README §19 Y14-4) yanıtında (Y13-4; eski çıktılar değişmez)
    for s in TUM:
        for e, y in (beklenen(s)[0]["sonuc"].get("yeniden") or {}).items():
            if "supheli_etiketi" in y and s["baslik"] not in ("S16", "S22", "S23"):        # güncelleme 15: S23 onay penceresi (Y15-2)
                h.append(f"{s['ad']} {e}: S16 / S22 / S23 dışı yanıtta supheli_etiketi")
    # (f) net eleme adı iki seçenekli (Y13-7) ve en az bir senaryoda başlatmada + gönderim anında
    ne = kahin.Benzetim.NET_ENGEL
    if ne.get("secenek") != ["gecikmis_borc_yok", kahin.NET_BORC_YOK]:
        h.append(f"NET_ENGEL seçenekleri {ne}")
    bas = sum(1 for s in TUM for v in beklenen(s)[0]["sonuc"]["elenen"].values() for x in v.values() if x == ne)
    gon = sum(1 for s in TUM for j in beklenen(s)[0]["sonuc"].get("isler", {}).values() if j["atlanma_nedeni"] == ne)
    if not bas or not gon:
        h.append(f"net elemesi başlatmada {bas}, gönderim anında {gon} (ikisi de ≥ 1 olmalı)")
    return h + bilgi + [f"bilgi: net elemesi başlatmada {bas}, gönderim anında {gon}"]


@test("I güncelleme 14 (S22): eski S7-d girdileri 'Atlandı — Şüpheli Alacağı Var' ile hesaplanır; B seçeneği (M210) aynı girdide ayrışır; S22 senaryolarının yeniden basması Atlandı'dan sonra (S23 tetiği yok)")
def _i11():
    h = []

    def hata_bekle(g, parca, ad, mut=frozenset()):
        try:
            kahin.hesapla(g, mut)
            h.append(f"{ad}: sessizce hesaplandı")
        except ValueError as e:
            if parca not in str(e):
                h.append(f"{ad}: beklenmeyen hata {e}")
    s1 = next(x for x in TUM if x["ad"].startswith("S16-01"))

    def duraklatma_girdisi():                                              # I10'un eski (b) girdisi: basmada kayıt yok, duraklatılmışken açılır, Devam Et
        g = copy.deepcopy(senaryolar.girdi(s1))
        g["olaylar"] = [g["olaylar"][0], {"t": "+1h", "tur": "yine_de_gonder", "toplu": "T1", "cari": "U", "etiket": "Y1"}, {"t": "+1h", "tur": "duraklat", "toplu": "T1"},
                        {"t": "+2h", "tur": "cari", "id": "U", "vadeler": [{"vade": "2026-10-06", "kalan": 400, "supheli": True}, {"vade": "2026-10-14", "kalan": 300}]},
                        {"t": "+3h", "tur": "devam", "toplu": "T1"}]
        return g
    # (a) duraklatma yolu → gönderim anında Atlandı (supheli_alacak), POST 1 (yalnız belirsiz kalan 1. ileti); Yine de Gönder yanıtında etiket yok
    try:
        r = kahin.hesapla(duraklatma_girdisi())[0]["sonuc"]
        j = r["isler"]["T1/U"]
        if j["durum"] != kahin.ATLANDI or j["atlanma_nedeni"] != kahin.SUPHELI or j["post"] != 1 or r["yeniden"]["Y1"] != {"elenen": {}, "alinan": ["U"], "oneri": None}:
            h.append(f"S22 duraklatma yolu: {j} / {r.get('yeniden')}")
    except ValueError as e:
        h.append(f"S22 duraklatma yolu hâlâ hata veriyor: {e}")
    # (b) aynı girdi B seçeneğiyle (M210): elle sayılır, şüphesiz tutarla (14.10.2026, 300,00 TL = 700 − 400) gider — A ile B bu girdide ayrışır
    try:
        j = kahin.hesapla(duraklatma_girdisi(), frozenset(["M210"]))[0]["sonuc"]["isler"]["T1/U"]
        if j["durum"] != kahin.TESLIM or j["post"] != 2 or j["degiskenler"][2:4] != ["14.10.2026", "300,00 TL"]:
            h.append(f"M210 (B seçeneği) beklenen gibi değil: {j}")
    except ValueError as e:
        h.append(f"M210 hata verdi: {e}")
    # (c) zincirdeki yeniden deneme yolu (I10'un eski (c) girdisi): Yine de Gönder (kayıt yok) 131021 → kayıt açılır → 1. iletinin failed'ı → Başarısızları Yeniden Dene → Atlandı
    s4 = next(x for x in TUM if x["ad"].startswith("S16-04"))
    g = copy.deepcopy(senaryolar.girdi(s4))
    g["olaylar"] = [g["olaylar"][0], {"t": "+1h", "tur": "yine_de_gonder", "toplu": "T1", "cari": "ZR", "etiket": "Y1"},
                    {"t": "+2h", "tur": "cari", "id": "ZR", "vadeler": [{"vade": "2026-10-04", "kalan": 500, "supheli": True}, {"vade": "2026-10-16", "kalan": 400}]},
                    {"t": "+3h", "tur": "basarisizlari_yeniden_dene", "toplu": "T1", "etiket": "Y2"}]
    try:
        r = kahin.hesapla(g)[0]["sonuc"]
        j = r["isler"]["T1/ZR"]
        if j["durum"] != kahin.ATLANDI or j["atlanma_nedeni"] != kahin.SUPHELI or j["post"] != 2 or r["yeniden"]["Y2"]["alinan"] != ["ZR"]:
            h.append(f"S22 zincir yolu: {j} / {r.get('yeniden')}")
    except ValueError as e:
        h.append(f"S22 zincir yolu hâlâ hata veriyor: {e}")
    # (d) güncelleme 15: S7-e (README §19.4) KAPANDI (S23 = A) → I12 (aynı girdi artık hesaplanır: bekleyen iş elle sayılır)
    # (e) S22 senaryolarında en az bir denetimde iş Atlandı (gönderim anında); yeniden basma Atlandı'dan SONRA: hiçbir S22 yanıtında S23 tetiği (`elle_sayilan`) yok
    n = 0
    for s in TUM:
        if s["baslik"] != "S22":
            continue
        n += 1
        r = beklenen(s)[0]["sonuc"]
        atlanan = [k for k, v in r.get("kontroller", {}).items() if kahin.ATLANDI in v.get("isler", {}).values()]
        if not atlanan:
            h.append(f"{s['ad']}: hiçbir denetimde Atlandı yok")
        if any("elle_sayilan" in y for y in (r.get("yeniden") or {}).values()):
            h.append(f"{s['ad']}: S22 senaryosunda S23 tetiği (yeniden basma gönderim anından önce)")
    if n < 5:
        h.append(f"S22 senaryosu {n} < 5")
    return h


@test("I güncelleme 15 (S23, SW3): eski S7-e girdisi S23 ile hesaplanır, B (M213) ayrışır; s23_an iki okumada kime / kaç kez AYNI, S23-a hata verir; yil_sonra; S-W3-a / S-W3-b hata verir; yeni alanlar yalnız S23 / SW3'te")
def _i12():
    h = []; bilgi = []

    def hata_bekle(g, parca, ad, mut=frozenset()):
        try:
            kahin.hesapla(g, mut)
            h.append(f"{ad}: sessizce hesaplandı")
        except ValueError as e:
            if parca not in str(e):
                h.append(f"{ad}: beklenmeyen hata {e}")
    # (a) I11'in eski (d) girdisi (S7-e): basmada kayıt yok, duraklatılmışken açılır, kayıt açıkken asıl işte yeniden basma, Devam Et → elle, 14.10.2026 / 300,00 TL (= 700 − 400), POST 2
    s1 = next(x for x in TUM if x["ad"].startswith("S16-01"))
    g = copy.deepcopy(senaryolar.girdi(s1))
    g["olaylar"] = [g["olaylar"][0], {"t": "+1h", "tur": "yine_de_gonder", "toplu": "T1", "cari": "U", "etiket": "Y1"}, {"t": "+1h", "tur": "duraklat", "toplu": "T1"},
                    {"t": "+2h", "tur": "cari", "id": "U", "vadeler": [{"vade": "2026-10-06", "kalan": 400, "supheli": True}, {"vade": "2026-10-14", "kalan": 300}]},
                    {"t": "+2h30m", "tur": "yine_de_gonder", "toplu": "T1", "cari": "U", "etiket": "Y2", "hedef": "asil"},
                    {"t": "+3h", "tur": "devam", "toplu": "T1"}]
    try:
        r = kahin.hesapla(g)[0]["sonuc"]
        j = r["isler"]["T1/U"]
        if (j["durum"] != kahin.TESLIM or j["post"] != 2 or j["degiskenler"][2:4] != ["14.10.2026", "300,00 TL"]
                or r["yeniden"]["Y2"] != {"elenen": {}, "alinan": [], "oneri": None, "supheli_etiketi": ["U"], "elle_sayilan": ["U"]}):
            h.append(f"S23 (eski S7-e girdisi): {j} / {r.get('yeniden')}")
    except ValueError as e:
        h.append(f"S23 (eski S7-e girdisi) hâlâ hata veriyor: {e}")
    try:                                                                   # aynı girdi B seçeneğiyle (M213): Zaten Kuyrukta → gönderim anında S22 "Atlandı", POST 1 — A ↔ B ayrışır
        r = kahin.hesapla(g, frozenset(["M213"]))[0]["sonuc"]
        j = r["isler"]["T1/U"]
        if j["durum"] != kahin.ATLANDI or j["atlanma_nedeni"] != kahin.SUPHELI or j["post"] != 1 or r["yeniden"]["Y2"]["elenen"] != {"U": "zaten_kuyrukta"}:
            h.append(f"M213 (B seçeneği) beklenen gibi değil: {j} / {r['yeniden']['Y2']}")
    except ValueError as e:
        h.append(f"M213 hata verdi: {e}")
    # (b) s23_an iki okuması: kime / kaç kez alanları AYNI; okuma başına elle_sayilan ∩ (elenen ∪ alınan) = ∅
    n = 0
    for s in TUM:
        for zaman in kahin.ZAMANLAR:
            b0 = kahin.Benzetim(senaryolar.girdi(s), kahin.tam_secim({}), zaman)
            r0 = b0.calistir()
            if "s23_an" not in b0.okuma_izi:
                continue
            n += 1
            for o in kahin.S23_OKUMALARI[1:]:
                r = kahin.Benzetim(senaryolar.girdi(s), kahin.tam_secim({}), zaman, okuma={"s23_an": o}).calistir()
                for ad_, rr in ((kahin.S23_OKUMALARI[0], r0), (o, r)):
                    for e, y in (rr.get("yeniden") or {}).items():
                        if set(y.get("elle_sayilan", [])) & (set(y["elenen"]) | set(y["alinan"])) or set(y["elenen"]) & set(y["alinan"]):
                            h.append(f"{s['ad']} [{zaman}] okuma {ad_} {e}: aynı kişi iki kümede")
                for alan in ("elenen", "olusmadi", "onceki_uyari", "bu_ay", "baslamadi"):
                    if not senaryolar._esit(r[alan], r0[alan]):
                        h.append(f"{s['ad']} [{zaman}] okuma {o}: {alan} ayrışıyor (kime / kaç kez)")
                for alan in ("post", "kabul", "meta_ileti", "toplam_post", "toplam_meta_ileti", "toplam_kabul_program"):
                    if not senaryolar._esit(r["meta"][alan], r0["meta"][alan]):
                        h.append(f"{s['ad']} [{zaman}] okuma {o}: meta.{alan} ayrışıyor (kime / kaç kez)")
    if n == 0:
        h.append("S23 iki okuması (s23_an) hiçbir senaryoda yok")
    bilgi.append(f"bilgi: s23_an iki okumalı koşu {n} (senaryo × zaman ucu)")
    # (c) S23-a (README §20.5): yeniden basmada şüphesiz tutar yok, Devam Et ERTESİ GÜN (30.10 kalemi gecikmiş, kayıt açık) → okumalar ayrışır → hata (senaryosuz)
    s5 = next(x for x in TUM if x["ad"].startswith("S23-05"))
    g = copy.deepcopy(senaryolar.girdi(s5))
    g["olaylar"] = [o_ for o_ in g["olaylar"] if o_["tur"] not in ("devam", "kontrol")] + [{"t": "+24h", "tur": "devam", "toplu": "T1"}]
    hata_bekle(g, "KULLANICIYA SORULMALI S23-a", "S23-a (okumalar ayrışır)")
    # (d) yil_sonra birim denetimi (Y15-13): takvim yılı, yerel an; 29 Şubat → 28 Şubat; saat dilimi sabit kaymada aynı an
    ys = kahin.yil_sonra
    for bas, son, tz in (("2026-11-02T10:00:00+03:00", "2027-11-02T10:00:00+03:00", kahin.TR), ("2026-11-01T00:30:00+03:00", "2027-11-01T00:30:00+03:00", kahin.TR),
                         ("2028-02-29T12:00:00+03:00", "2029-02-28T12:00:00+03:00", kahin.TR), ("2026-10-31T21:30:00+00:00", "2027-10-31T21:30:00+00:00", kahin.timezone.utc)):
        if ys(_ms(bas), tz) != _ms(son):
            h.append(f"yil_sonra({bas}) ≠ {son}")
    if ys(_ms("2026-11-01T00:30:00+03:00"), kahin.TR) != ys(_ms("2026-11-01T00:30:00+03:00"), kahin.timezone.utc):
        h.append("yil_sonra: 29 Şubat'sız yılda yerel ↔ UTC aynı an vermiyor")
    # (e) S-W3-a: silme talebi bekleyen işte (Duraklatıldı) ve Sonucu Belirsiz işte; 1 yıl dolarken bekleyen iş → hata (kodlanmadı)
    s3 = next(x for x in TUM if x["ad"].startswith("SW3-03"))
    g = copy.deepcopy(senaryolar.girdi(s3))
    g["olaylar"] = [g["olaylar"][0], {"t": "+0s", "tur": "duraklat", "toplu": "T1"}, {"t": "+1h", "tur": "kvkk_sil", "id": "A"}]
    hata_bekle(g, "KULLANICIYA SORULMALI S-W3-a", "S-W3-a (bekleyen işte silme talebi)")
    g = copy.deepcopy(senaryolar.girdi(s3))
    g["meta_davranis"] = {"mesaj": {"A": "yanitsiz_kabul"}, "kanca": {"A": {"1": []}, "*": senaryolar.K_STD}}   # bildirimsiz → Sonucu Belirsiz kalır (§7a 3)
    g["olaylar"] = [g["olaylar"][0], {"t": "+1h", "tur": "kvkk_sil", "id": "A"}]
    hata_bekle(g, "KULLANICIYA SORULMALI S-W3-a", "S-W3-a (Sonucu Belirsiz işte silme talebi)")
    g = copy.deepcopy(senaryolar.girdi(s3))
    g["olaylar"] = [g["olaylar"][0], {"t": "+0s", "tur": "duraklat", "toplu": "T1"}, {"t": "+366d", "tur": "kontrol", "ad": "K1"}]
    g["bitis"] = "+367d"
    hata_bekle(g, "KULLANICIYA SORULMALI S-W3-a", "S-W3-a (1 yıl dolarken bekleyen iş)")
    # (f) S-W3-b: silinmiş Ekstre işinin Başarısızları Yeniden Dene'si → hata; Ödeme Hatırlatma'da karttan hesaplanır (Y15-21: yeni içerik, icerik_silindi kalkar)
    g = copy.deepcopy(senaryolar.girdi(s3))
    g["meta_davranis"] = {"mesaj": {"A": [{"hata": 131021}, "kabul"]}, "kanca": {"*": senaryolar.K_STD}}
    g["olaylar"] = [g["olaylar"][0], {"t": "+1h", "tur": "kvkk_sil", "id": "A"}, {"t": "+2h", "tur": "basarisizlari_yeniden_dene", "toplu": "T1", "etiket": "Y1"}]
    hata_bekle(g, "KULLANICIYA SORULMALI S-W3-b", "S-W3-b (silinmiş Ekstre'nin yeniden denemesi)")
    g = {"baslangic": "2026-10-30T10:00:00+03:00", "cariler": [senaryolar.A7()], "meta_davranis": {"mesaj": {"A": [{"hata": 131021}, "kabul"]}, "kanca": {"*": senaryolar.K_STD}},
         "olaylar": [{"t": "+0s", "tur": "baslat", "etiket": "T1", "secim": ["A"], "sablon": "hatirlatma"}, {"t": "+1h", "tur": "kvkk_sil", "id": "A"},
                     {"t": "+1h", "tur": "kontrol", "ad": "K1", "icerik": True}, {"t": "+2h", "tur": "basarisizlari_yeniden_dene", "toplu": "T1", "etiket": "Y1"}]}
    try:
        r = kahin.hesapla(g)[0]["sonuc"]
        j = r["isler"]["T1/A"]
        if (r["kontroller"]["K1"]["icerik"]["T1/A"] != senaryolar.SIL or j["durum"] != kahin.TESLIM or j["post"] != 2 or "icerik_silindi" in j
                or j["telefon"] != "+905321112233" or j["degiskenler"] != senaryolar.A_HAT):
            h.append(f"silinmiş Ödeme Hatırlatma'nın yeniden denemesi: {j} / {r['kontroller']['K1']}")
    except ValueError as e:
        h.append(f"silinmiş Ödeme Hatırlatma'nın yeniden denemesi hata verdi: {e}")
    # (g) yeni alanlar yalnız yeni başlıklarda (eski çıktılar değişmez — I4 ile birlikte)
    for s in TUM:
        r = beklenen(s)[0]["sonuc"]
        if s["baslik"] != "SW3" and (any("icerik_silindi" in j for j in r.get("isler", {}).values()) or any("icerik" in k for k in r.get("kontroller", {}).values())):
            h.append(f"{s['ad']}: SW3 dışında icerik_silindi / kontrol içerik")
        if s["baslik"] != "S23" and any("elle_sayilan" in y for y in (r.get("yeniden") or {}).values()):
            h.append(f"{s['ad']}: S23 dışında elle_sayilan")
    sw3 = [s for s in TUM if s["baslik"] == "SW3"]
    s23 = [s for s in TUM if s["baslik"] == "S23"]
    if len(sw3) < 5 or len(s23) < 5:
        h.append(f"SW3 senaryosu {len(sw3)}, S23 senaryosu {len(s23)} (< 5)")
    return h + bilgi


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
