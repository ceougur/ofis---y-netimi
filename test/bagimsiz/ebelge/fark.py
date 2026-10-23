#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""e-Belge kâhini — fark: model.py (temiz oda) ↔ program (kosucu.mjs) + değişmezler + küçültme. Dil `destekofis-ebelge/3` (/1 ve /2 senaryoları da).

Kullanım (depo kökünden):
  python3 test/bagimsiz/ebelge/fark.py --tohum 1 --islem 100 [--kucult] [--butce 40] [--cikti <klasör>]
  python3 test/bagimsiz/ebelge/fark.py --senaryo <senaryo.json | klasör> [--kucult]   # ör. test/bagimsiz/ebelge/senaryolar
  python3 test/bagimsiz/ebelge/fark.py --tohumlar 1-5 --islem 300            # birden çok tohum (Uzun Doğrulama)
  … [--dil 1|2] (üreteç dili; varsayılan 2) [--ux15 acik|kapali] (K37 UX15 kuralları; varsayılan açık — tabanda UX15 yokken "kapali")

Ne yapar:
  1. Senaryoyu üretir (uretici.py; tohumlu) ya da okur.
  2. Programa uygular: node test/bagimsiz/ebelge/kosucu.mjs (gerçek HTTP API, sahte EDM + arıza vekili; ağa çıkmaz).
  3. DEĞİŞMEZLER (her adımdan sonra, YALNIZ programın gözlenen durumu + sahte EDM'nin kaydı üzerinde; modelden bağımsız):
       I1 seri+yıl numaraları 1..n boşluksuz · I2 numara sırası tarih sırasıyla monoton · I3 her ETTN EDM'de en çok bir kez kabul ·
       I4 EDM'nin kabul ettiği numara = programdaki numara · I5 e-Belge numarası bir kez verilince değişmez · I6 EDM'ye giden her denemenin
       kimliği geçerli seri+yıl+sıra, profil serisiyle uyumlu, belge tarihinin yılı · I7 mükellef alıcıya e-Arşiv gitmez · I8 iptal ya da
       listeden silinmiş belge (Tümünü Gönder turunda) gönderilmez · I9 gönderilmiş belge değişmez (tarih, tür, numara, cari) ·
       I10 program "gönderildi" diyorsa EDM kabul etmiştir · I11 e-Fatura alıcı posta kutusuyla gider · I12 numara yılı = belge yılı ·
       I13 numara benzersiz · I14 kişi carisi mükellef işaretlenmez · I15 eşzamanlı turda gönderilen belge için "hata" yanıtı yok ·
       I16 tur yanıtındaki "gönderildi" iddiası EDM'de var · I19 tur sonucunda gönderilmeyen belgenin kodu ve iletisi dolu · I18 sonda (ağ var + Tümünü Gönder sonrası) program ↔ EDM tutarlı ·
       I0 sahte EDM'nin kendi sözleşme ihlalleri.
       /2: I20 belge kendi servisinden gider (ESMM → e-SMM servisi, e-Fatura/e-Arşiv → e-Fatura servisi; K34) · I21 EDM'ye giden UBL'de alıcı ili dolu,
       e-Fatura VKN alıcısında vergi dairesi dolu, 30.000 TL üstü e-Arşivde 11111111111 yok (K36) · I22 EDM'de iptal yalnız iletimden (EDM'nin kabul günü)
       sonraki 8 gün içinde; e-Fatura EDM'de iptal edilmez (K22, K23) · I23 ön hesap (calc) engel/alıcı sorunu söylüyor ⇔ kayıt reddediyor, iletiler aynı
       (K37; --ux15 acik) · I24 Seçilenleri Gönder sorusu (409) gönderimden ÖNCE: o istekte EDM denemesi ve numara değişimi yok (K33).
       /3: I1/I2 seri GEÇMİŞİ üzerinden (bir kez görülmüş her numara — Silinenler'deki ve emekli dahil — K38) · I26 bir numara bir kez, tek belgeye verilir
       (başka belgede bir daha görünmez; E6, 22.10 kararı) · I25 Sonucu Belirsiz ve EDM'de olan belge için yeniden EDM'ye gönderim denemesi yok (E1 [AJAN]) ·
       I8 ek: Silinenler'deki belge EDM'ye gitmez (K39).
  4. MODEL FARKI (adım adım, "kilit adım"): model her adımdan önce programın gözlenen durumuna eşitlenir (numara, gönderim, iptal,
     liste, cari işareti, bekleyen arıza), adımı kendi kurallarıyla uygular; olası dünyalardan (çatal) gözleme en yakını seçilir ve kalan
     alan farkları yazılır: belge başına var / numara / edm / gonderildi / iptal / bekleyen + yanıt sınıfı (2xx/4xx). Böylece her fark
     tek bir adımın davranışıdır (zincirleme fark yok). Ayrıca eşitlemesiz "saf model" sonda tam durumla karşılaştırılır (sayı).
  5. Fark/ihlal varsa (--kucult) senaryoyu küçültür: ilk sorunun adımından sonrası atılır, sonra parça parça adım silinir (aynı sorun
     türü kalıyorsa); bütçe kadar koşu.
Çıktı: <cikti>/fark-<ad>.json (+ küçültülmüş senaryo) ve özet satırı. Çıkış: 0 fark/ihlal yok · 1 fark ya da ihlal var · 2 koşucu hatası.
Temiz oda: bu dosya programın kodunu okumaz; beklenen değeri yalnız model.py verir, değişmezler kuraldan yazıldı.
"""

import argparse
import hashlib
import json
import os
import subprocess
import sys
import time

BURASI = os.path.dirname(os.path.abspath(__file__))
KOK = os.path.abspath(os.path.join(BURASI, "..", "..", ".."))
sys.path.insert(0, BURASI)
import model as M  # noqa: E402
import uretici  # noqa: E402

SENT = {"sent", "processing", "cancelled", "delivered", "accepted", "approved", "rejected", "succeed"}
NOT_SENT = {"waiting", "error", "withdrawn", "none", "", "unsent", "draft"}
TUR_ISLEMLERI = {"tumunu_gonder", "esz_tumunu_gonder", "tur_sirasinda_sil"}
ALANLAR = ("var", "numara", "edm", "gonderildi", "iptal", "bekleyen", "edm_iptal", "cop")
E_SERILER = ("TEF", "TEA", "TES")


def mukellef_vkn():
    # Sahte EDM'nin VKN'lerini dosyadan değil, bilinen GİB denetim haneli değerlerden hesapla (einvoice-mock.mjs vkn()).
    def vkn(nine):
        d = [int(c) for c in str(nine).zfill(9)]
        s = 0
        for i, x in enumerate(d):
            t = (x + (9 - i)) % 10
            v = (t * 2 ** (9 - i)) % 9
            if t != 0 and v == 0:
                v = 9
            s += v
        return "".join(map(str, d)) + str((10 - s % 10) % 10)
    return {vkn(987654321), vkn(222333444)}


MUKELLEF_VKN = mukellef_vkn()
UX15 = [True]  # --ux15 (K37); küçültme de aynı ayarla koşar


# ---- program koşusu ------------------------------------------------------------------------------------------------
def kos_program(senaryo, klasor, sakla=True):
    os.makedirs(klasor, exist_ok=True)
    metin = json.dumps(senaryo, ensure_ascii=False, sort_keys=True)
    h = hashlib.sha256(metin.encode()).hexdigest()[:16]
    sp = os.path.join(klasor, f"senaryo-{h}.json")
    cp = os.path.join(klasor, f"program-{h}.json")
    with open(sp, "w", encoding="utf-8") as f:
        f.write(metin)
    r = subprocess.run(["node", os.path.join(BURASI, "kosucu.mjs"), sp, "--cikti", cp], cwd=KOK, capture_output=True, text=True, timeout=3600)
    if not os.path.exists(cp):
        return None, f"koşucu çıktı yazmadı (çıkış {r.returncode}): {r.stderr[-2000:]}"
    with open(cp, encoding="utf-8") as f:
        p = json.load(f)
    if not sakla and r.returncode == 0 and not p.get("hata"):
        for yol in (sp, cp):
            os.remove(yol)
    if r.returncode != 0 or p.get("hata"):
        return p, f"koşucu hatası (çıkış {r.returncode}): {p.get('hata') or r.stderr[-2000:]}"
    return p, None


# ---- gözlem → model görünümü ----------------------------------------------------------------------------------------
def gonderildi_mi(e):
    if e in SENT:
        return True
    if e in NOT_SENT:
        return False
    return M.B  # bilinmeyen durum: karşılaştırılmaz (ders 4)


def tur_bul(b):
    # Müşteri Fişi olarak bırakılan (withdrawn) belge KAGIT görünür ama e-Belge profiliyle (eProfil) sırada durur: tür ondan okunur
    # (dar kontrol 3, 2.4.3 — eşitleme hatasıydı; modelin kuralı değişmedi).
    p = (b.get("eProfil") or b.get("profil") or "") if b["eStatus"] == "withdrawn" else (b.get("profil") or "")
    if b["eStatus"] != "withdrawn" and b["numara"].startswith("FIS"):
        return "kagit"
    if p == "EARSIVFATURA":
        return "earsiv"
    if p == "ESMM":
        return "esmm"
    if p in ("TEMELFATURA", "TICARIFATURA") or p.endswith("FATURA"):
        return "efatura"
    return "kagit"


def gozlem_goruntu(adim_kaydi, edm_kabul, edm_iptal=frozenset()):
    g = {}
    for ad, b in adim_kaydi["gozlem"].items():
        g[ad] = {"var": True, "numara": b["numara"], "edm": b["ettn"] in edm_kabul, "gonderildi": gonderildi_mi(b["eStatus"]),
                 "iptal": b["durum"] == "cancelled", "bekleyen": b["bekleyen"], "tarih": b["tarih"], "tur": tur_bul(b), "edm_iptal": b["ettn"] in edm_iptal,
                 "cop": bool(b.get("cop"))}
    return g


def belirsiz_mi(b):
    """Sonucu Belirsiz (kara kutu: eStatus "none" + e-Belge numarası; kart etiketi "Sonucu Belirsiz", eUnsent true — KARARLAR.md /2 ortam bilgisi)."""
    return b["eStatus"] == "none" and b["numara"][:3] in E_SERILER and b["durum"] != "cancelled"


def yanit_sinifi(y):
    if not y or "status" not in y:
        return None
    s = y["status"]
    return "2xx" if 200 <= s < 300 else "4xx" if 400 <= s < 500 else f"{s // 100}xx"


def alan_farki(beklenen, gozlenen):
    fark = []
    for ad in sorted(set(beklenen) | set(gozlenen), key=lambda x: (len(x), x)):
        e = beklenen.get(ad, {"var": False})
        o = gozlenen.get(ad, {"var": False})
        for alan in ALANLAR:
            ev, ov = e.get(alan), o.get(alan)
            if alan != "var" and not (e.get("var") is True and o.get("var") is True):
                continue
            if ev is M.B or ov is M.B:
                continue
            if ev != ov:
                fark.append({"belge": ad, "alan": alan, "model": ev, "program": ov})
    return fark


def esitle(d, kayit, edm_kabul, senaryo_cari, edm_iptal=frozenset(), iletim_gun=None, deneme_gun=None, senaryo_tutar=None, emekli=None):
    """Model dünyasını programın gözlenen durumuna eşitler (kilit adım). /2: iletim günü (ETTN'i EDM'nin İLK kabul ettiği adımın günü), son gönderim
    girişimi günü (vekilin gördüğü son SendInvoice/SendSMM; EDM'nin açık reddi — geçici hata — sayılmaz), belirsizlik ve EDM'de iptal gözlemden."""
    iletim_gun = iletim_gun or {}
    deneme_gun = deneme_gun or {}
    for k, c in kayit["cariler"].items():
        d.cariler[k]["isaret"] = bool(c["eInvoice"])
        d.cariler[k]["pk"] = bool(c["eAlias"])
    d.ag = kayit["ag"] == "var"
    d.ariza = kayit["arizaBekliyor"] or None
    d.ariza_atla = 0
    d.bugun = kayit["bugun"]
    gor = set()
    for ad, b in kayit["gozlem"].items():
        gor.add(ad)
        x = d.belgeler.get(ad)
        if not x or x.get("var") is not True:
            d.sira += 1
            x = {"ad": ad, "cari": senaryo_cari[ad], "sira": d.sira, "tutar": M.TUTARLAR[(senaryo_tutar or {}).get(ad, "olagan")], "iletim": None, "deneme": None}
            d.belgeler[ad] = x
        prog = gonderildi_mi(b["eStatus"])
        x.update({"var": True, "numara": b["numara"], "tarih": b["tarih"], "tur": tur_bul(b), "edm": b["ettn"] in edm_kabul,
                  "prog": prog if prog is not M.B else True, "iptal": b["durum"] == "cancelled", "silindi": b["eStatus"] == "withdrawn",
                  "hata": b["eStatus"] == "error", "belirsiz": belirsiz_mi(b), "edm_iptal": b["ettn"] in edm_iptal,
                  "engel_bilinen": b["eBlocked"] if b.get("eBlocked") is not None else x.get("engel_bilinen", False), "cop": bool(b.get("cop"))})
        x["iletim"] = iletim_gun.get(b["ettn"])
        x["deneme"] = deneme_gun.get(b["ettn"])
    for ad, x in d.belgeler.items():
        if ad not in gor:
            d.belgeler[ad] = {"ad": ad, "var": False}
    # K38: verilmiş ama artık hiçbir belgede (Silinenler dahil) durmayan kâğıt numaraları — programın gözlenen GEÇMİŞİNDEN (Degismez.numara_gecmis).
    if emekli is not None:
        d.emekli = dict(emekli)


# ---- değişmezler ---------------------------------------------------------------------------------------------------
class Degismez:
    def __init__(self, ux15=True):
        self.ux15 = ux15
        self.kabul_gun = {}  # ettn → EDM'nin ilk kabul ettiği adımın günü (K22 iletim)
        self.okunamayan_ubl = 0  # ders 4: UBL'den alıcı okunamadıysa I21 "bilinmiyor" (sayı rapora)
        self.ilk_numara = {}  # ad → ilk görülen e-Belge numarası
        self.kabul_ani = {}  # ettn → (tarih, profil, numara, accountId) kabul edildiği adımdaki gözlem
        self.kabul_sayisi = {}  # ettn → EDM kabul sayısı
        self.kabul_id = {}  # ettn → EDM'ye kabul edilen kimlik
        self.iptal_edilmis = set()  # ad (önceki adımda iptal görülen ve gönderilmemiş)
        self.silinmis = set()  # ad (önceki adımda listeden silinmiş görülen)
        self.gorulen = {}
        self.fis_sira_bozuk = False
        self.numara_gecmis = {}  # /3 K38: numara → {"ad", "tarih"} (bir kez görülmüş her numara; tarih: numarayı taşıdığı son gözlem)
        self.onceki_belirsiz = set()  # /3 I25: önceki adımda Sonucu Belirsiz görülen belgelerin ETTN'leri
        self.onceki_cop = set()  # /3 I8: önceki adımda Silinenler'de görülen belgeler

    def emekli(self, kayit):
        """K38: geçmişte görülmüş, şimdi hiçbir belgede (Silinenler dahil) durmayan kâğıt numaraları → tarih."""
        simdi = {b["numara"] for b in kayit["gozlem"].values() if b["numara"]}
        return {n: v["tarih"] for n, v in self.numara_gecmis.items() if n not in simdi and n[:3] in M.KAGIT_SERILER}

    def denetle(self, adim, kayit, denemeler, cariler_tur):
        ihlal = []
        def ek(kod, ileti, **ayr):
            # Kalıcı ihlal her adımda yinelenir: ilk görüldüğü adım yazılır, sonrakiler sayılır.
            if (kod, ileti) in self.gorulen:
                self.gorulen[(kod, ileti)]["yineleme"] += 1
                return
            x = {"adim": adim["no"], "islem": adim["islem"], "kod": kod, "ileti": ileti, "yineleme": 0, **ayr}
            self.gorulen[(kod, ileti)] = x
            ihlal.append(x)
        g = kayit["gozlem"]
        ettn_ad = {b["ettn"]: ad for ad, b in g.items()}
        onceki_kabul = set(self.kabul_sayisi)  # I25: EDM'nin bu adımdan ÖNCE kabul ettikleri
        for k in kayit["edm"]["kabul"]:
            self.kabul_gun.setdefault(k["uuid"], kayit["bugun"])
            self.kabul_sayisi[k["uuid"]] = self.kabul_sayisi.get(k["uuid"], 0) + 1
            if self.kabul_sayisi[k["uuid"]] > 1:
                ek("I3", f"ETTN {k['uuid']} EDM'de ikinci kez kabul edildi ({k['id']})", belge=ettn_ad.get(k["uuid"]))
            self.kabul_id.setdefault(k["uuid"], k["id"])
            ad = ettn_ad.get(k["uuid"])
            if ad:
                b = g[ad]
                self.kabul_ani.setdefault(k["uuid"], {"tarih": b["tarih"], "profil": b["profil"], "numara": k["id"], "accountId": b["accountId"]})
            if k["earchive"] == "true" and k["vkn"] in MUKELLEF_VKN:
                ek("I7", f"mükellef alıcıya ({k['vkn']}) e-Arşiv gitti: {k['id']}", belge=ad)
            if k["earchive"] not in ("true", "smm") and not k["alias"]:
                ek("I11", f"e-Fatura posta kutusu olmadan gitti: {k['id']}", belge=ad)
            # I20 (K34): belge kendi servisinden kabul edildi
            if ad and (g[ad]["profil"] == "ESMM") != (k.get("servis") == "smm"):
                ek("I20", f"{ad}: {g[ad]['profil']} belgesi {k.get('servis')} servisinde kabul edildi ({k['id']})", belge=ad)
            # I21 (K36): EDM'ye giden UBL'de alıcı zorunlu alanları
            al = k.get("alici")
            if al is None:
                self.okunamayan_ubl += 1
            else:
                if not al.get("il"):
                    ek("I21", f"{ad or k['id']}: alıcı ili boş UBL EDM'ye gitti ({k['id']})", belge=ad)
                if k["earchive"] not in ("true", "smm") and al.get("kimlikTur") == "VKN" and not al.get("vd"):
                    ek("I21", f"{ad or k['id']}: e-Fatura VKN alıcısında vergi dairesi boş ({k['id']})", belge=ad)
                if k["earchive"] == "true" and al.get("kimlik") == "11111111111" and (al.get("odenecek") or 0) > M.NIHAI_SINIR:
                    ek("I21", f"{ad or k['id']}: {al.get('odenecek')} TL e-Arşiv 11111111111 alıcıyla gitti ({k['id']})", belge=ad)
        # I6 / I8: bu adımdaki EDM denemeleri
        for dn in denemeler:
            ad = ettn_ad.get(dn["uuid"])
            p = M.coz_numara(dn["id"])
            if not p:
                ek("I6", f"EDM'ye geçersiz/numarasız kimlikle gidildi: '{dn['id']}'", belge=ad)
            elif ad:
                b = g[ad]
                beklenen_seri = {"EARSIVFATURA": "TEA", "ESMM": "TES"}.get(b["profil"], "TEF" if b["profil"].endswith("FATURA") else "?")
                if (b["profil"] == "ESMM") != (dn.get("servis") == "smm"):
                    ek("I20", f"{ad}: {b['profil']} belgesi {dn.get('servis')} servisine gönderildi ({dn['id']})", belge=ad)
                if p[0] != beklenen_seri:
                    ek("I6", f"{ad}: {b['profil']} belgesi {p[0]} serisiyle gitti ({dn['id']})", belge=ad)
                if str(p[1]) != b["tarih"][:4]:
                    ek("I6", f"{ad}: {b['tarih']} tarihli belge {p[1]} yılı numarasıyla gitti ({dn['id']})", belge=ad)
            if ad in self.iptal_edilmis:
                ek("I8", f"{ad}: iptal edilmiş belge EDM'ye gönderildi ({dn['id']})", belge=ad)
            if ad in self.onceki_cop:
                ek("I8", f"{ad}: Silinenler'deki belge EDM'ye gönderildi ({dn['id']})", belge=ad)
            if dn["uuid"] in self.onceki_belirsiz and dn["uuid"] in onceki_kabul and not dn.get("ariza"):
                # I25 (E1 [AJAN] "yeniden Gönder önce EDM'ye sorar, ikinci kez göndermez"): Sonucu Belirsiz ve EDM'de zaten olan belge yeniden gönderildi.
                ek("I25", f"{ad}: Sonucu Belirsiz ve EDM'de olan belge yeniden EDM'ye gönderildi ({dn['id']})", belge=ad)
            if ad in self.silinmis and adim["islem"] in TUR_ISLEMLERI:
                ek("I8", f"{ad}: listeden silinmiş belge turda EDM'ye gönderildi ({dn['id']})", belge=ad)
        if adim["islem"] == "tur_sirasinda_sil" and adim.get("belge") in g:
            y = kayit.get("yanit") or {}
            b = g[adim["belge"]]
            if y.get("status", 0) // 100 == 2 and (b["ettn"] in self.kabul_sayisi):
                ek("I8", f"{adim['belge']}: tur sürerken Listeden Sil kabul edildi ama belge EDM'ye gitti", belge=adim["belge"])
        # I1 / I2 / I12 / I13 / I26 — /3: I1 ve I2 seri GEÇMİŞİ üzerinden (K38: silinen, emekli numara serbest kalmaz; boşluk değildir)
        gorulen = {}
        for ad, b in g.items():
            if not b["numara"]:
                continue
            p = M.coz_numara(b["numara"])
            if not p:
                ek("I12", f"{ad}: geçersiz numara biçimi {b['numara']}", belge=ad)
                continue
            if b["numara"] in gorulen:
                ek("I13", f"{b['numara']} iki belgede: {gorulen[b['numara']]}, {ad}", belge=ad)
            gorulen[b["numara"]] = ad
            if str(p[1]) != b["tarih"][:4]:
                ek("I12", f"{ad}: numara yılı {p[1]} ≠ belge tarihi {b['tarih']}", belge=ad)
            onceki = self.numara_gecmis.get(b["numara"])
            if onceki and onceki["ad"] != ad:
                # I26 (K38/E6; [KULLANICI] 22.10 "verilmiş kâğıt/fiş numarası bir daha kullanılmaz"): bir numara başka belgede yeniden görüldü.
                ek("I26", f"{b['numara']} önce {onceki['ad']} belgesindeydi, şimdi {ad} belgesinde (numara yeniden verildi)", belge=ad)
            else:
                self.numara_gecmis[b["numara"]] = {"ad": ad, "tarih": b["tarih"]}
        seriler = {}
        for no_, v in self.numara_gecmis.items():
            p = M.coz_numara(no_)
            seriler.setdefault((p[0], p[1]), []).append((p[2], v["tarih"], v["ad"]))
        for (seri, yil), xs in sorted(seriler.items()):
            xs.sort()
            siralar = [x[0] for x in xs]
            if siralar != list(range(1, len(xs) + 1)):
                eksik = sorted(set(range(1, max(siralar) + 1)) - set(siralar))
                ek("I1", f"{seri}{yil} boşluklu: eksik sıra {eksik[:5]} (toplam {len(xs)}, en büyük {max(siralar)})", seri=f"{seri}{yil}")
            for (s1, t1, a1), (s2, t2, a2) in zip(xs, xs[1:]):
                if t2 < t1:
                    ek("I2", f"{seri}{yil}: {s2} ({a2}, {t2}) önceki {s1} ({a1}, {t1}) belgesinden eski tarihli", seri=f"{seri}{yil}", belge=a2)
        # I4 / I5 / I9 / I10
        for ad, b in g.items():
            if b["numara"][:3] in E_SERILER:
                ilk = self.ilk_numara.setdefault(ad, b["numara"])
                if ilk != b["numara"]:
                    ek("I5", f"{ad}: e-Belge numarası değişti {ilk} → {b['numara']}", belge=ad)
            if b["ettn"] in self.kabul_id and b["numara"] != self.kabul_id[b["ettn"]]:
                ek("I4", f"{ad}: EDM {self.kabul_id[b['ettn']]} kabul etti, programda {b['numara'] or 'numarasız'}", belge=ad)
            ka = self.kabul_ani.get(b["ettn"])
            if ka:
                for alan in ("tarih", "profil", "accountId"):
                    if b[alan] != ka[alan]:
                        ek("I9", f"{ad}: gönderilmiş belgenin {alan} alanı değişti {ka[alan]} → {b[alan]}", belge=ad)
            if gonderildi_mi(b["eStatus"]) is True and b["ettn"] not in self.kabul_id:
                ek("I10", f"{ad}: programda '{b['eStatus']}' ama EDM'de yok", belge=ad)
        # I22 (K22 [GİB] §3 + [KULLANICI] (5); K23): EDM'de iptal yalnız iletimden 8 gün içinde; e-Fatura EDM'de iptal edilmez
        for u, servis in zip(kayit["edm"]["iptal"], kayit["edm"].get("iptalServis") or ["efatura"] * len(kayit["edm"]["iptal"])):
            ad = ettn_ad.get(u)
            ilk = self.kabul_gun.get(u)
            if ilk:
                from datetime import date
                gecen = (date.fromisoformat(kayit["bugun"]) - date.fromisoformat(ilk)).days
                if gecen > M.IPTAL_SURESI:
                    ek("I22", f"{ad or u}: iletimden {gecen}. gün EDM'de iptal edildi (iletim {ilk})", belge=ad)
            if ad and servis == "efatura" and g[ad]["profil"] not in ("EARSIVFATURA",):
                ek("I22", f"{ad}: {g[ad]['profil']} belgesi EDM'de iptal edildi (e-Fatura entegratörden iptal edilmez)", belge=ad)
        # I24 (K33): Seçilenleri Gönder sorusu gönderimden önce
        soru = (kayit.get("ek") or {}).get("soru") if adim.get("eski") is not None else None
        if soru and (soru.get("ilkIstekDeneme") or soru.get("ilkIstekNumaraDegisen")):
            ek("I24", f"Seçilenleri Gönder sorusu (409) geldi ama ilk istekte {soru.get('ilkIstekDeneme')} EDM denemesi, numarası değişen {soru.get('ilkIstekNumaraDegisen')}")
        # I23 (K36 alıcı; K37 kronoloji — --ux15 acik): ön hesap ⇔ kayıt, iletiler aynı
        oh = kayit.get("onHesap")
        y = kayit.get("yanit") or {}
        if oh and oh.get("status") == 200 and "status" in y:
            red = 400 <= y["status"] < 500
            kod = str(y.get("kod") or "")
            for tur_, liste, kodu, acik in (("alıcı", oh.get("partyProblems") or [], "einvoice-party", True), ("kronoloji", oh.get("blockers") or [], "chronology", self.ux15)):
                if not acik:
                    continue
                if liste and not red:
                    ek("I23", f"{adim.get('belge')}: ön hesap {tur_} sorunu dedi ({liste[0][:80]}), kayıt kabul etti", belge=adim.get("belge"))
                elif red and kod == kodu and not liste:
                    ek("I23", f"{adim.get('belge')}: kayıt {kodu} ile reddetti, ön hesap {tur_} sorunu söylemedi", belge=adim.get("belge"))
                elif red and kod == kodu and liste and not any(x[:60] in y.get("veri", "") for x in liste):
                    ek("I23", f"{adim.get('belge')}: ön hesap ile kayıt iletisi farklı ({liste[0][:60]} ↔ {y.get('veri', '')[:120]})", belge=adim.get("belge"))
        # I14
        for k, c in kayit["cariler"].items():
            if cariler_tur[k] in M.KISI_TURLERI and c["eInvoice"]:
                ek("I14", f"kişi carisi {k} mükellef işaretlendi")
        # I15 / I16
        ek_ = kayit.get("ek") or {}
        listeler = ek_.get("sonuclar") or []
        if listeler and isinstance(listeler[0], dict):
            listeler = [listeler]
        for sonuclar in listeler:
            for s in sonuclar:
                ad = s["ad"]
                if ad not in g:
                    continue
                if s.get("ok") and s.get("numara") and self.kabul_id.get(g[ad]["ettn"]) != s["numara"]:
                    ek("I16", f"{ad}: tur yanıtı {s['numara']} gönderildi diyor, EDM'de yok", belge=ad)
                if not s.get("ok") and (not s.get("kod") or not s.get("ileti", "x")):
                    # I19 (baş mimar kararı 18.10.2026): tur sonucunda gönderilmeyen belgenin kodu ve iletisi dolu (neden yazılır).
                    ek("I19", f"{ad}: tur sonucu ok:false ama kod/ileti boş (kod '{s.get('kod', '')}')", belge=ad)
                # Baş mimar kararı 18.10.2026 (K14 ile tutarlı): istek EDM'ye gittikten sonra kopan / zaman aşımına uğrayan belge "belirsiz"
                # (integrator-uncertain) döner — eşzamanlı turda hata sayılmaz (sonunda gönderilmiş ya da belirsiz kalması ikisi de geçerli).
                # Bu adımda kâhinin enjekte ettiği arızanın düştüğü belge: o oturumun aldığı hata gerçek EDM yanıtıdır (I15 dışı).
                arizali = {dn["uuid"] for dn in denemeler if dn.get("ariza")}
                if adim["islem"] == "esz_tumunu_gonder" and g[ad]["ettn"] not in arizali and s.get("kod") != "integrator-uncertain" and not s.get("ok") and g[ad]["ettn"] in self.kabul_id and gonderildi_mi(g[ad]["eStatus"]) is True:
                    ek("I15", f"{ad}: eşzamanlı turda gönderilen belge için hata yanıtı ({s.get('kod')})", belge=ad)
        # durum güncelle
        self.onceki_belirsiz = {b["ettn"] for b in g.values() if belirsiz_mi(b)}
        self.onceki_cop = {ad for ad, b in g.items() if b.get("cop")}
        for ad, b in g.items():
            if b["durum"] == "cancelled" and b["ettn"] not in self.kabul_id:
                self.iptal_edilmis.add(ad)
            if b["eStatus"] == "withdrawn":
                self.silinmis.add(ad)
            elif ad in self.silinmis and adim["islem"] == "kart_gonder" and adim.get("belge") == ad:
                self.silinmis.discard(ad)
        return ihlal

    def son(self, kayit):
        ihlal = []
        for ad, b in kayit["gozlem"].items():
            if b["durum"] == "cancelled" or b.get("cop"):
                continue
            prog = gonderildi_mi(b["eStatus"])
            edm = b["ettn"] in self.kabul_id
            if prog is not M.B and prog != edm:
                ihlal.append({"adim": "son", "islem": "son", "kod": "I18", "belge": ad,
                              "ileti": f"{ad}: sonda program {'gönderildi' if prog else 'gönderilmedi'}, EDM {'kabul etti' if edm else 'görmedi'} ({b['eStatus']}, {b['numara']})"})
        return ihlal


# ---- karşılaştırma ---------------------------------------------------------------------------------------------------
def program_k33(adim, kayit):
    """K33: programın ön sorusundaki 'önce gönderilmeli' belgeleri (adlar, sıralı); soru yoksa []. Adım atlandıysa None (karşılaştırılmaz)."""
    if adim.get("eski") is None or (kayit.get("yanit") or {}).get("atlandi"):
        return None
    soru = (kayit.get("ek") or {}).get("soru")
    return sorted(soru.get("eskiler") or []) if soru else []


def karsilastir(senaryo, p, ux15=True):
    adimlar = senaryo["adimlar"]
    senaryo_cari = {a["belge"]: a["cari"] for a in adimlar if a["islem"] in ("kaydet", "kagit_kaydet")}
    senaryo_tutar = {a["belge"]: a.get("tutar", "olagan") for a in adimlar if a["islem"] in ("kaydet", "kagit_kaydet")}
    cariler_tur = senaryo["cariler"]
    kilit = M.Model(senaryo, ux15=ux15)
    saf = M.Model(senaryo, ux15=ux15)
    dg = Degismez(ux15)
    edm_kabul = set()
    edm_iptal = set()
    iletim_gun, deneme_gun = {}, {}
    farklar, ihlaller, secimler = [], [], []
    ek_bilgi = {"incele": [], "ux15YokAdim": []}
    denemeler_adim = {}
    for dn in p.get("denemeler", []):
        denemeler_adim.setdefault(dn["adim"], []).append(dn)
    for adim, kayit in zip(adimlar, p["adimlar"]):
        assert kayit["no"] == adim["no"]
        for k in kayit["edm"]["kabul"]:
            edm_kabul.add(k["uuid"])
            iletim_gun.setdefault(k["uuid"], kayit["bugun"])
        edm_iptal.update(kayit["edm"].get("iptal") or [])
        for dn in denemeler_adim.get(adim["no"], []):
            if dn.get("ariza") != "gecici_hata":
                deneme_gun[dn["uuid"]] = kayit["bugun"]
        gz = gozlem_goruntu(kayit, edm_kabul, edm_iptal)
        ys = yanit_sinifi(kayit.get("yanit"))
        if kayit.get("yanit", {}) and kayit["yanit"].get("atlandi"):
            ys = None
        pk33 = program_k33(adim, kayit)

        def uzaklik(d):
            n = len(alan_farki(M.goruntu(d), gz))
            if d.yanit and ys and d.yanit != ys:
                n += 1
            if pk33 is not None and d.k33 is not None and sorted(d.k33) != pk33:
                n += 1
            return n
        # kilit adım
        once = kilit.dunyalar[0].kopya()
        kilit.adim(adim)
        d = kilit.sec(gz, uzaklik)
        d_notlar = list(d.notlar)
        f = alan_farki(M.goruntu(d), gz)
        if d.yanit and ys and d.yanit != ys:
            f.append({"belge": adim.get("belge", ""), "alan": "yanit", "model": d.yanit, "program": kayit["yanit"].get("status"), "kod": kayit["yanit"].get("kod")})
        if pk33 is not None and d.k33 is not None and sorted(d.k33) != pk33:
            f.append({"belge": ",".join(adim.get("belgeler", [])), "alan": "k33", "model": sorted(d.k33), "program": pk33})
        if d.incele:
            ek_bilgi["incele"].append({"adim": adim["no"], "islem": adim["islem"], "belge": adim.get("belge", ""), "isaret": sorted(set(d.incele)),
                                       "notlar": [n for n in d.notlar if any(t in n for t in ("güvenilmedi", "doğrulanmadı"))][:4]})
        for x in f:
            x.update({"adim": adim["no"], "islem": adim["islem"]})
            x["sinif"] = sinif_fark(once, d, x, kayit)
        sinif_belge = {}
        for x in f:
            if x["alan"] == "numara":
                sinif_belge[x["belge"]] = x["sinif"]
        for x in f:
            if x["alan"] != "numara" and x["sinif"] == "BASKA" and x["belge"] in sinif_belge:
                x["sinif"] = sinif_belge[x["belge"]]
        if f and ux15:
            # K37 UX15 kuralı olmadan (aynı adım öncesi durumdan) gözlem tam açıklanıyorsa fark yalnız UX15'ten gelir (tabanda UX15 yoksa beklenir).
            off = once.kopya()
            off.ux15, off.yanit, off.k33, off.incele = False, None, None, []
            if min(uzaklik(w) for w in M.uygula(off, adim)) == 0:
                for x in f:
                    x["sinif"] = "UX15-YOK (yalnız K37 UX15 kuralı bu farkı üretir; tabanda UX15 yoksa beklenir, son adayda BULGU)"
                ek_bilgi["ux15YokAdim"].append(adim["no"])
        if adim["islem"] == "iptal":
            for x in f:
                if x["sinif"] == "BASKA":
                    x["sinif"] = sinif_iptal(once, adim, x, kayit)
        if any(x["sinif"].startswith(("BEKLENEN-O1", "BEKLENEN-O3")) for x in f):
            for x in f:
                if x["sinif"] == "BASKA":
                    # Aynı turda model bekletilen belgeyi gönderdiği için arıza/numara başka belgeye düştü: O1/O3'ün ardılı.
                    x["sinif"] = "BEKLENEN-O1-ARDIL (aynı adımda O1/O3 farkı; tur sırası ondan kaydı)"
        farklar.extend(f)
        if len(kilit.adaylar) > 1:
            secimler.append({"adim": adim["no"], "aday": len(kilit.adaylar), "secilen": d.notlar[-3:]})
        yeni_ihlal = dg.denetle(adim, kayit, denemeler_adim.get(adim["no"], []), cariler_tur)
        for x in yeni_ihlal:
            x["sinif"] = siniflandir(senaryo, p, x)
            if x["kod"] == "I23" and ("kronoloji" in x["ileti"] or "chronology" in x["ileti"]):
                x["sinif"] = "UX15-YOK-I23 (ön hesap kronoloji çakışmasını söylemiyor; UX15 tabanda yoksa beklenir, son adayda BULGU)"
        ihlaller.extend(yeni_ihlal)
        # Tek atımlık arıza modelde ve programda farklı belgeye düştüyse (model başka belgeyi önce gönderdi), o adımdaki sınıfsız
        # farklar arızanın kaymasının sonucudur; kayan belge programda O1/O3 ile bekletildiyse O1 ardılıdır.
        prog_ariza = {g_ad for dn in denemeler_adim.get(adim["no"], []) if dn.get("ariza")
                      for g_ad, b in kayit["gozlem"].items() if b["ettn"] == dn["uuid"]}
        model_ariza = {n.split(":")[0] for n in d_notlar if any(t in n for t in ("geçici hata", "kopma_"))}
        if prog_ariza and model_ariza and prog_ariza != model_ariza:
            m_ad = sorted(model_ariza)[0]
            mb = once.belgeler.get(m_ad)
            o1 = bool(mb and mb.get("var") is True and _engelli_eski(once, mb))
            for x in f:
                if x["sinif"] == "BASKA":
                    x["sinif"] = (f"BEKLENEN-O1-ARDIL (arıza modelde {m_ad}, programda {sorted(prog_ariza)[0]} belgesine düştü; {m_ad} eski engelli bekleyen arkasında)"
                                  if o1 else f"ARDIL-ARIZA-KAYDI (arıza modelde {m_ad}, programda {sorted(prog_ariza)[0]} belgesine düştü)")
        if any(i["kod"] == "I2" and "FIS" in i["ileti"] for i in yeni_ihlal):
            dg.fis_sira_bozuk = True
            if adim["islem"] in ("listeden_sil", "tur_sirasinda_sil"):
                for x in f:
                    if x["sinif"] == "BASKA":
                        x["sinif"] = "BASKA-FIS-SIRA (Listeden Sil eski tarihli belgeye FIS numarası verdi; K31 reddi beklenir)"
        for x in f:
            if adim["islem"] == "kagit_kaydet" and x["alan"] == "var" and x["sinif"] == "BASKA" and dg.fis_sira_bozuk:
                x["sinif"] = "BASKA-FIS-SIRA-ARDIL (FIS serisi önceden sıra-tarih bozuk; kâğıt kaydı son numaranın tarihine göre denetleniyor)"
            if x["alan"] == "yanit" and x["sinif"] == "BASKA":
                if adim["islem"] == "tur_sirasinda_sil" and any(i["kod"] == "I8" for i in yeni_ihlal):
                    x["sinif"] = "BEKLENEN-O2 (tur sürerken Listeden Sil kabul edildi, belge yine gitti)"
                elif adim["islem"] == "kagit_kaydet" and dg.fis_sira_bozuk:
                    x["sinif"] = "BASKA-FIS-SIRA-ARDIL (FIS serisi önceden sıra-tarih bozuk; kâğıt kaydı son numaranın tarihine göre denetleniyor)"
                elif adim["islem"] == "duzenle_tarih" and x.get("kod") == "chronology" and x["model"] == "2xx":
                    x["sinif"] = "BASKA-DUZENLE-SIRA (numarasız bekleyenin tarihi sıra-tarihi bozmadan değiştirilemiyor)"
        esitle(d, kayit, edm_kabul, senaryo_cari, edm_iptal, iletim_gun, deneme_gun, senaryo_tutar, dg.emekli(kayit))
        d.notlar = []
        # saf model (eşitlemesiz; yalnız çatal seçimi gözleme göre)
        saf.adim(adim)
        saf.sec(gz, uzaklik)
    if p["adimlar"]:
        for x in dg.son(p["adimlar"][-1]):
            x["sinif"] = "BASKA"
            ihlaller.append(x)
    son_gz = gozlem_goruntu(p["adimlar"][-1], edm_kabul, edm_iptal) if p["adimlar"] else {}
    saf_fark = alan_farki(M.goruntu(saf.dunyalar[0]), son_gz)
    ihlaller.extend({"adim": "I0", "islem": "", "kod": "I0", "ileti": v, "sinif": "BASKA"} for v in p.get("ihlalEdm", []))
    ek_bilgi["okunamayanUbl"] = dg.okunamayan_ubl
    return farklar, ihlaller, secimler, saf_fark, ek_bilgi


def sinif_iptal(once, adim, fark, kayit):
    """K22 iptal farkının görünen biçiminden sınıf (beklenen değer üretmez): program süreyi neye göre sayıyor?"""
    b = once.belgeler.get(adim.get("belge"))
    if not b or b.get("var") is not True:
        return "BASKA"
    y = kayit.get("yanit") or {}
    program_kabul = 200 <= (y.get("status") or 0) < 300
    g_iletim, g_deneme, g_kesim = once.gun_farki(b, "iletim"), once.gun_farki(b, "deneme"), (M.gun(once.bugun) - M.gun(b["tarih"])).days
    if program_kabul and b.get("iletim") and g_iletim > M.IPTAL_SURESI:
        if b.get("deneme") and g_deneme <= M.IPTAL_SURESI:
            return f"BULGU-K22-SON-DENEME (GİB §3: iletim = EDM'nin aldığı gün {b['iletim']}; program sonraki girişimi {b['deneme']} saydı, {g_iletim}. günde iptal etti)"
        return f"BULGU-K22-SURE-ASIMI (iletimden {g_iletim}. günde iptal kabul edildi)"
    if not program_kabul and (b.get("prog") is True) and g_iletim <= M.IPTAL_SURESI:
        if g_kesim > M.IPTAL_SURESI:
            return f"BULGU-K22-KESIMDEN (iletimden {g_iletim}. gün, kesimden {g_kesim}. gün: program süreyi kesim tarihinden sayıyor)"
        if g_iletim == M.IPTAL_SURESI:
            return "BULGU-K22-8-GUN (8. gün dahil sayılmıyor)"
    return "BASKA"


# ---- sınıflama (farkın görünen biçimine ve modelin adım öncesi durumuna bakar; beklenen değer üretmez) ----------------------
def _engelli_eski(once, b):
    """b'den eski tarihli, aynı seri+yılda numarasız bekleyen ve KALICI ENGELLİ belgeler (O1/O3 adayı)."""
    xs = []
    for x in once.belgeler.values():
        if x is b or x.get("var") is not True or x["tur"] != b["tur"] or x["numara"] or x["iptal"] or x["silindi"] or x["prog"] or x.get("cop"):
            continue
        if once.seri_yil(x) != once.seri_yil(b) or x["tarih"] >= b["tarih"]:
            continue
        e = once.engel(x) or ("tarih-sirasi" if once.tarih_engeli(x) else None)
        if e == "pk-yok" and not once.tarih_engeli(x):
            continue  # K9 (18.10 kararı): PK'sız belge geçici engel — bekletmesi doğru
        if e:
            xs.append((x["ad"], e))
    return xs


def sinif_fark(once, sonra, fark, kayit):
    ad = fark.get("belge")
    b = once.belgeler.get(ad)
    if (not b or b.get("var") is not True) and sonra.belgeler.get(ad, {}).get("var") is True:
        # yeni kaydedilen belge: adım öncesi dünyaya numarasız olarak eklenip bakılır
        once = once.kopya()
        b = dict(sonra.belgeler[ad], numara="", prog=False, edm=False, iptal=False, silindi=False)
        once.belgeler[ad] = b
    if fark["alan"] == "yanit" or not b or b.get("var") is not True:
        return "BASKA"
    if fark["alan"] == "numara" and fark["model"] and not fark["program"]:
        eski = _engelli_eski(once, b)
        if any(e == "alici-efatura" for _, e in eski):
            return "BEKLENEN-O3 (alıcısı mükellef çıkan bekleyen e-Arşiv seriyi bekletiyor)"
        if eski:
            return "BEKLENEN-O1 (eski kalıcı engelli bekleyen seriyi bekletiyor: " + ",".join(f"{a}:{e}" for a, e in eski[:3]) + ")"
        if not once.ag and kayit.get("ag") == "var":
            return "BASKA"
    if fark["alan"] == "numara" and not fark["model"] and fark["program"]:
        if not once.ag:
            return "BEKLENEN-AG (ağ yokken numara verildi)"
        tutan = once.tutan(b)
        if tutan:
            t = once.belgeler[tutan]
            zincir = _engelli_eski(once, t)
            if zincir:
                return f"BEKLENEN-O1-ZINCIR (eski bekleyen {tutan} kendisi engelli {zincir[0][0]} arkasında; yeni belge numaralandı → {tutan} kalıcı tarih engeline düştü)"
            return f"TUTMA-YOK (eski gönderilebilir bekleyen {tutan} varken yeni belge numaralandı)"
    return "BASKA"


# ---- (eski) görünen biçimden sınıflama -----------------------------------------------------------------------------------
def siniflandir(senaryo, p, fark):
    """Fark/ihlali, dar kontrol turunun bilinen bulgularına (Y1, O1–O3, ağ yokken numara) görünen biçiminden eşler."""
    no = fark.get("adim")
    if not isinstance(no, int):
        return "BASKA"
    kayit = p["adimlar"][no - 1]
    onceki = p["adimlar"][no - 2] if no >= 2 else None
    y = json.dumps(kayit.get("yanit") or {}, ensure_ascii=False) + json.dumps(kayit.get("ek") or {}, ensure_ascii=False)
    if fark.get("kod") == "I8" and fark.get("islem") == "tur_sirasinda_sil":
        return "BEKLENEN-O2 (tur sürerken Listeden Sil)"
    if fark.get("kod") == "I2" and fark.get("islem") in ("listeden_sil", "tur_sirasinda_sil") and "FIS" in fark.get("ileti", ""):
        return "BASKA-FIS-SIRA (Listeden Sil eski tarihli belgeye FIS numarası verdi)"
    if fark.get("kod") == "I19":
        return "BEKLENEN-I19 (bekletilen/gönderilmeyen belgenin tur sonucu kodsuz ya da iletisiz)"
    if fark.get("kod") == "I15":
        return "BASKA-ESZ (eşzamanlı turda 'gönderiliyor' hata olarak döndü)"
    if fark.get("alan") == "numara" and fark.get("model") == "" and fark.get("program") and onceki and onceki.get("ag") == "yok" and kayit.get("ag") == "yok":
        return "BEKLENEN-AG (ağ yokken numara verildi)"
    if fark.get("alan") in ("numara", "edm", "gonderildi", "bekleyen") and fark.get("model") and not fark.get("program"):
        # model numara/gönderim bekliyor, program vermedi: bekleten eski belge var mı?
        if onceki:
            for ad, b in onceki["gozlem"].items():
                if b["bekleyen"] and not b["numara"] and b["tarih"] < (kayit["gozlem"].get(fark["belge"], {}).get("tarih") or "9"):
                    cari = senaryo["cariler"].get(next((a["cari"] for a in senaryo["adimlar"] if a.get("belge") == ad and a["islem"] == "kaydet"), ""), "")
                    if cari == "gizli_mukellef" or "buyer-is-efatura" in y:
                        return "BEKLENEN-O3 (alıcı e-Fatura mükellefi olan bekleyen e-Arşiv seriyi bekletiyor)"
                    if cari == "mukellef_pksiz" or "buyer-alias" in y or "chronology" in y or "permanent" in y:
                        return "BEKLENEN-O1 (eski kalıcı engelli bekleyen seriyi bekletiyor)"
    return "BASKA"


def imza(x):
    return (("ihlal:" + x["kod"]) if "kod" in x and "alan" not in x else ("fark:" + x["alan"]), x["sinif"].split(" (")[0])


def sorun_siniflari(farklar, ihlaller):
    """Her (imza, sınıf) için ilk görüldüğü adım."""
    ilk = {}
    for x in farklar + ihlaller:
        n = x["adim"] if isinstance(x["adim"], int) else 10 ** 9
        k = imza(x)
        if k not in ilk or n < ilk[k]:
            ilk[k] = n
    return ilk


def ilk_sorun(farklar, ihlaller):
    xs = [(f["adim"], "fark:" + f["alan"]) for f in farklar] + [(i["adim"], "ihlal:" + i["kod"]) for i in ihlaller if isinstance(i["adim"], int)]
    if not xs:
        son = [i for i in ihlaller if not isinstance(i["adim"], int)]
        return (10 ** 9, "ihlal:" + son[0]["kod"]) if son else None
    return min(xs)


def kucult(senaryo, imza_turu, klasor, butce, gunluk):
    """İlk sorunun türü (imza_turu) korunarak adım sil."""
    def dene(adimlar):
        s = dict(senaryo, adimlar=[dict(a, no=i + 1) for i, a in enumerate(adimlar)])
        p, hata = kos_program(s, klasor, sakla=False)
        if hata:
            gunluk(f"  küçültme adayı koşamadı: {hata[:300]}")
            return False, s
        f, ih, _, _, _ = karsilastir(s, p, UX15[0])
        return imza_turu in {imza(x) for x in f + ih}, s
    adimlar = list(senaryo["adimlar"])
    kosu = 0
    n = max(1, len(adimlar) // 2)
    while n >= 1 and kosu < butce:
        i = 0
        degisti = False
        while i < len(adimlar) and kosu < butce:
            aday = adimlar[:i] + adimlar[i + n:]
            if not aday:
                i += n
                continue
            kosu += 1
            tamam, _ = dene(aday)
            gunluk(f"  küçültme {kosu}/{butce}: {len(adimlar)} → {len(aday)} adım {'TUTTU' if tamam else '-'}")
            if tamam:
                adimlar = aday
                degisti = True
            else:
                i += n
        if not degisti:
            n //= 2
    s = dict(senaryo, adimlar=[dict(a, no=i + 1) for i, a in enumerate(adimlar)], ad=senaryo["ad"] + "-kucuk")
    return s, kosu


def calistir(senaryo, klasor, kucult_mu, butce):
    t0 = time.time()
    gunluk = lambda m: print(m, flush=True)  # noqa: E731
    p, hata = kos_program(senaryo, os.path.join(klasor, "ham"))
    if hata:
        gunluk(f"[{senaryo['ad']}] KOŞUCU HATASI: {hata}")
        return {"ad": senaryo["ad"], "hata": hata}, 2
    farklar, ihlaller, secimler, saf_fark, ek_bilgi = karsilastir(senaryo, p, UX15[0])
    rapor = {"ad": senaryo["ad"], "dil": senaryo.get("dil"), "ux15": UX15[0], "tohum": senaryo.get("tohum"), "islem": len(senaryo["adimlar"]), "bugun": senaryo["bugun"],
             "farkSayisi": len(farklar), "ihlalSayisi": len(ihlaller), "safModelSonFark": len(saf_fark), "farklar": farklar, "ihlaller": ihlaller,
             "catalSecimleri": secimler, "eStatusDegerleri": p.get("eStatusDegerleri"), "incele": ek_bilgi["incele"], "okunamayanUbl": ek_bilgi["okunamayanUbl"],
             "kucultulmus": None}
    if kucult_mu and (farklar or ihlaller):
        rapor["kucultulmus"] = []
        # Her sorun sınıfı için ayrı küçültme ("fark:numara" ile onun ardılı alanlar aynı belgede: yalnız numara/yanıt/ihlal imzaları).
        siniflar = {k: n for k, n in sorun_siniflari(farklar, ihlaller).items() if k[0] in ("fark:numara", "fark:yanit", "fark:gonderildi") or k[0].startswith("ihlal:")}
        gorulen_sinif = set()
        for (tur, sinif), no in sorted(siniflar.items(), key=lambda kv: kv[1]):
            if sinif in gorulen_sinif:
                continue
            gorulen_sinif.add(sinif)
            onek = senaryo["adimlar"][: no] if no < 10 ** 9 else senaryo["adimlar"]
            s0 = dict(senaryo, adimlar=onek, ad=f"{senaryo['ad']}-{len(gorulen_sinif)}")
            gunluk(f"[{senaryo['ad']}] {tur} / {sinif}: ilk adım {no}; küçültülüyor (bütçe {butce})")
            ks, kosu = kucult(s0, (tur, sinif), os.path.join(klasor, "ham"), butce, gunluk)
            kp, kh = kos_program(ks, os.path.join(klasor, "ham"))
            kf, ki, _, _, _ = karsilastir(ks, kp, UX15[0]) if not kh else ([], [], [], [], {})
            rapor["kucultulmus"].append({"imza": tur, "sinif": sinif, "kosu": kosu, "adimlar": ks["adimlar"],
                                         "sorunlar": [x for x in kf + ki if imza(x) == (tur, sinif)][:8]})
            with open(os.path.join(klasor, f"kucuk-{s0['ad']}.json"), "w", encoding="utf-8") as f:
                json.dump(ks, f, ensure_ascii=False, indent=1)
    rapor["sure"] = round(time.time() - t0, 1)
    with open(os.path.join(klasor, f"fark-{senaryo['ad']}.json"), "w", encoding="utf-8") as f:
        json.dump(rapor, f, ensure_ascii=False, indent=1, default=lambda o: "?")
    ozet = {}
    for x in farklar + ihlaller:
        k = (("fark:" + x["alan"]) if "alan" in x else x.get("kod", "?"), x["sinif"].split(" (")[0])
        ozet[k] = ozet.get(k, 0) + 1
    gunluk(f"[{senaryo['ad']}] adım {len(senaryo['adimlar'])} · fark {len(farklar)} · ihlal {len(ihlaller)} · saf model son fark {len(saf_fark)} · "
           f"çatal seçimi {len(secimler)} · İNCELE {len(ek_bilgi['incele'])} · okunamayan UBL {ek_bilgi['okunamayanUbl']} · {rapor['sure']} sn")
    # İNCELE (yalnız [AJAN] dayanaklı dünya seçildi; fark sayılmaz): işaret başına adım sayısı + ilk adım (tam liste fark-<ad>.json "incele")
    inc = {}
    for x in ek_bilgi["incele"]:
        for i in x["isaret"]:
            inc.setdefault(i, []).append(x["adim"])
    for i, adimlar in sorted(inc.items()):
        gunluk(f"    İNCELE {i:<28} {len(adimlar)} adım (ilk {adimlar[0]})")
    for (k, s), n in sorted(ozet.items(), key=str):
        gunluk(f"    {k:<16} {s:<40} {n}")
    for ku in rapor["kucultulmus"] or []:
        gunluk(f"    KÜÇÜLTÜLMÜŞ {ku['imza']} / {ku['sinif']} ({len(ku['adimlar'])} adım, {ku['kosu']} koşu):")
        for a in ku["adimlar"]:
            gunluk("      " + json.dumps({k: v for k, v in a.items()}, ensure_ascii=False))
        for x in ku["sorunlar"][:4]:
            gunluk("      → " + json.dumps(x, ensure_ascii=False, default=lambda o: "?"))
    return rapor, (1 if farklar or ihlaller else 0)


def main():
    a = argparse.ArgumentParser()
    a.add_argument("--tohum", type=int)
    a.add_argument("--tohumlar", help="ör. 1-5")
    a.add_argument("--islem", type=int, default=100)
    a.add_argument("--senaryo")
    a.add_argument("--kucult", action="store_true")
    a.add_argument("--butce", type=int, default=40)
    a.add_argument("--cikti", default=os.path.join(BURASI, "cikti"))
    a.add_argument("--dil", type=int, choices=(1, 2, 3), default=3, help="üreteç dili (tohumlu senaryolar)")
    a.add_argument("--ux15", choices=("acik", "kapali"), default="acik", help="K37 UX15 kuralları (madde 12); tabanda yokken kapali")
    x = a.parse_args()
    UX15[0] = x.ux15 == "acik"
    os.makedirs(x.cikti, exist_ok=True)
    senaryolar = []
    if x.senaryo:
        # Dosya ya da klasör (klasördeki bütün *.json — ör. test/bagimsiz/ebelge/senaryolar: küçültülmüş bulgu dizileri)
        yollar = sorted(os.path.join(x.senaryo, n) for n in os.listdir(x.senaryo) if n.endswith(".json")) if os.path.isdir(x.senaryo) else [x.senaryo]
        for yol in yollar:
            with open(yol, encoding="utf-8") as f:
                senaryolar.append(json.load(f))
    elif x.tohumlar:
        bas, _, son = x.tohumlar.partition("-")
        senaryolar = [uretici.uret(t, x.islem, dil=x.dil) for t in range(int(bas), int(son or bas) + 1)]
    elif x.tohum is not None:
        senaryolar.append(uretici.uret(x.tohum, x.islem, dil=x.dil))
    else:
        a.print_help()
        return 2
    kod = 0
    kodlar = []
    toplam = {"fark": 0, "ihlal": 0}
    for s in senaryolar:
        r, k = calistir(s, x.cikti, x.kucult, x.butce)
        kod = max(kod, k)
        kodlar.append(k)
        toplam["fark"] += r.get("farkSayisi", 0)
        toplam["ihlal"] += r.get("ihlalSayisi", 0)
    # kanit.mjs okuyabilsin diye TAP benzeri özet (node:test biçimi)
    print(f"# tests {len(senaryolar)}")
    print(f"# pass {kodlar.count(0)}")
    print(f"# fail {len(kodlar) - kodlar.count(0)}")
    print(f"# kahin fark {toplam['fark']} ihlal {toplam['ihlal']}")
    return kod


if __name__ == "__main__":
    sys.exit(main())
