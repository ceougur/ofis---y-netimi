#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""Bağımsız CARİ / EVRAK kâhini (2.4.4 madde 31a, B1–B2) — temiz oda.

Programın kodunu GÖRMEDEN, yalnız KARARLAR.md'deki kurallarla (kaynakları: CLAUDE.md "Açık iş" kullanıcı kararları, docs/BANKA-MODULU-PLAN.md,
KURALLAR-244.md'deki ajan kural metinleri) bir senaryonun (dil "destekofis-cari/1") beklenen sonuçlarını hesaplar.

  python3 -I test/bagimsiz/cari/model.py <senaryo.json> [--mutasyon N] [--legacy] > beklenen.json
  (--legacy: 2.4.4 kural seti — anahtarlar açık sunucuda "2.4.5 kararıyla geçersiz" /1 /2 senaryoları; --gecersiz-mi: senaryo bu sınıfta mı)

Çıktı: {"ad", "denetimler": {anahtar: {"b": beklenen, "e": etiket, "k": kural}}, "belirsiz": [..]}. Anahtarlar koşucunun (kos.mjs) programdan
okuduğu anahtarlarla aynıdır (KARARLAR.md §4). Yalnız tamsayı kuruş; ağ, saat ve programın hiçbir dosyası kullanılmaz; aynı girdiye bayt bayt
aynı çıktı.
"""
import json
import sys
from collections import defaultdict

DIL = "destekofis-cari/3"
# /2 (2.4.4 31a tur 2, 23.10.2026; kodu görmeyen el): B3 Tablodaki Kişiler BORÇ (U2/E2/E3 — sütun önceliği, söz borç dışı, gün/adet tutar değil, Kalan boş →
# Toplam Borç, aynı dosya no bir kez), B4 Nakit Akışı Kasa giriş/çıkış = Kasa raporu (MM6), B5 Nihai Tüketici carisi (U1). /1 senaryoları değişmeden koşar.
# /3 (2.4.5 madde 0b, 24.10.2026; kodu görmeyen el — KARARLAR.md §3 "C — 2.4.5"): kayıt tahsilatı kapısı (madde 1, K1), Tablodan Aktar kapısı (madde 2), tablo uyarı
# kapısı (madde 4), cari borç vadesi + Beklenen Ödeme Tarihi + S1 FIFO Kalan + takvim/zil kalemi (madde 6, K6.1–K6.4). Kural seti "2.4.5" (varsayılan) ya da
# "2.4.4" (--legacy: anahtarlar açık sunucuda eski kurallar; yalnız "2.4.5 kararıyla geçersiz" /1 /2 senaryoları bu kipte koşar).
DILLER = ("destekofis-cari/1", "destekofis-cari/2", DIL)
BIRINCIL = {"KULLANICI", "PLAN", "GIB", "EDM", "BAŞ MİMAR"}
# 2.4.5 kararıyla geçersiz (/1 /2): tablo para yoluna bağlı işlem içeren senaryo (kayıt tahsilatı POST, Tablodan Aktar) varsayılan kipte koşulmaz (KARARLAR.md C0).
GECERSIZ_ISLEM = ("kayit_tahsilat", "aktar")
UFUK_GUN = 7  # K6.3: takvim/zil ufku faturayla aynı — geçmişin tamamı + bugünden 7 gün
TABLO_TARIH_HATIRLATMA = ("Duruşma Tarihi", "Sözleşme Bitiş", "İcra Son Tarihi")  # madde 4: tutarsız tablo tarihleri KALIR (kullanıcı: duruşma, sözleşme bitiş, icra son tarihi)
K1_ILETI = "Kayıt tahsilatı kapatıldı; tahsilat Cari'den girilir."


def gecersiz_245(senaryo):
    """/1 /2 senaryosu 2.4.5 kararıyla geçersiz mi (tablo para yolu: kayıt tahsilatı POST ya da Tablodan Aktar)."""
    return senaryo.get("dil") != DIL and any(a.get("islem") in GECERSIZ_ISLEM for a in senaryo.get("adimlar", []))

MUTASYONLAR = {
    1: "5a: sığmayan tahsilat bölünür (kartı doldurana kadar parçası taşınır)",
    2: "5a: sığmayan tahsilat atlanır, sonraki küçükler taşınmaya devam eder",
    3: "5b: carinin borcuna taşınan tahsilatlar geri eklenmez (D = bakiye)",
    4: "5b: borç kalandan azsa kişi aktarılmaz yerine yeni borç yazılır",
    5: "5c: aynı dosya no her sekmede ayrı sayılır (çift sayım)",
    6: "UX18: bağlı evrakın fazlası en eski açık faturaya gitmez (avans kalır)",
    7: "UX18: karşılıksız evrak faturayı yeniden açmaz",
    8: "UX18: fatura iptalinde evrakın bağı düşmez (evrak hiçbir faturayı kapatmaz)",
    9: "Otomatik kapama en YENİ faturadan başlar",
    10: "Geri al: taşınan tahsilatlar cariye dönmez",
    11: "5a: taşıma Kasa'yı azaltır",
    12: "Kart: tahsilat en yeni taksitten başlayarak sayılır",
    13: "Mizan: alınan senet 101'e yazılır (121 yerine)",
    # /2
    14: "K3: Kalan önceliği yok (toplam önce)",
    15: "K3: Ödeme Sözü tutarı borç sayılır",
    16: "K3: gün/adet sütunu tutar sayılır",
    17: "K3: Kalan hücresi boşsa borç 0 (toplama düşmez)",
    18: "K2 (04:09): farklı sekmede aynı dosya no tek kayıt — yalnız ilk borçlu sekme sayılır (03:12 kuralı)",
    19: "MM6: Nakit Akışı Kasa girişi yalnız cari tahsilatı sayar (evrak tahsili ve kayıt tahsilatı dışarıda)",
    20: "U1: Nihai Tüketici 11111111111'li en eski cariyi (adı belli olsa da) seçer",
    21: "U1: işaretli cari adı/kimliği değişse de kullanılır",
    22: "MM6: elle Kasa çıkışı Nakit Akışı'nda sayılmaz",
    23: "K1: aynı sekmede tekrar eden dosya no yalnız ilk satırla sayılır",
    24: "K3: Kalan'sız Tutar + Tahsil Edilen tablosunda ödenen düşülmez",
    25: "K3: toplam − ödenen negatifse 0'a çekilmez",
    26: "K2: 'birden çok sekmede; ayrı sayıldı' notu yok (rapor ve Tahsilat Takvimi)",
    27: "K5: Kasa'yı görme yetkisi olmayan kullanıcı Kasa giriş/çıkışını görür",
    # /2 C3 (23.10.2026 [KULLANICI] kişi gruplaması)
    28: "C3: aynı kimlik farklı adları birleştirir (kişi kimliğe göre)",
    29: "C3: aynı ad farklı kimlik tek kişi (yalnız ada göre)",
    30: "C3: kimliksiz satır aynı adın tek kimliğine katılmaz",
    31: "C3: aynı adı paylaşan kişilerin etiketinde kimlik yok",
    32: "C3 kimliksiz satır: çok kimlikli adın kimliksiz kaydı ilk kimliğe katılır (ayrı kalmaz)",
    33: "C3 kimlik sütunu: sağlama hanesi tutmayan değer de kimlik sayılır",
    34: "Kimlik sütunu: 'Vergi No' / 'Vergi Numarası' / 'Vergi Kimlik' tutar sayılır",
    # /2 VERGİ SÜTUNU BORÇ DEĞİLDİR ([KULLANICI] 23.10.2026 karar A, 5 dk yetkisiyle)
    35: "Vergi sütunu (KDV, Vergi, Vergi Tutarı, Stopaj, Tevkifat, ÖTV) tutar sayılır ve Genel Toplam ayrı sınıf değil (eski K3: borç belirlenemez)",
    36: "Tutar + Genel Toplam tablosunda borç Tutar (KDV hariç)",
    37: "Borç sütunu belirlenemeyen kişiler raporda notsuz kaybolur",
    # /2 KAYIT ANAHTARI SÜREKLİLİĞİ (baş mimar kararı 23.10.2026)
    38: "Yerine koy (aynı dosyayı yeniden yükle) kayda bağlı tahsilatı kayıttan koparır",
    39: "Sağlaması tutmayan Vergi No / TC değeri kayıt kimliğine girer (değer değişince tahsilat kopar)",
    # /2 TABLO BAĞ SÜREKLİLİĞİ (baş mimar kararı 23.10.2026)
    40: "Yerine koy güvenli eşleşmede de bağı koparır (satır içeriği anahtar)",
    41: "Güvenli eşleşme yokken uyarı ve onay yok (sessiz)",
    42: "N3 öncesi: aynı konum + aynı kişi eşleşmesi kişi değeri iki tabloda AYNI SAYIDA satırdayken de geçerli (bağ yanlış kişiye gidebilir)",
    43: "Devamı olarak ekle aynı kişi + aynı tutar satırını söylemez, onay istemez",
    # /2 NETLEŞTİRME (karar sahibi, 23.10.2026): içeriği tamamen aynı satır mevcut kaydın kendisidir
    44: "İçeriği aynı satır yer değişince (aynı adlı iki satırın yer değiştirmesi) eşleşmez — onay ister",
    45: "Devamı olarak ekle içeriği tamamen aynı satırı ikinci kez ekler ve onay ister",
    46: "Devamı olarak ekle güvenli eşleşen (aynı kişi, başka hücresi farklı) satırı güncellemez, ikinci kez ekler ve onay ister",
    47: "N4 öncesi: tablodaki TEK tutar kolonu vergi kolonuysa da borç sayılmaz",
    48: "N6 öncesi: tabloda artık olmayan kayda tahsilat yazımı kabul edilir",
    49: "N1 öncesi: Dosya No'lu tabloda dosya numarası değişen kaydın bağı kişi eşleşmesiyle yeni dosyaya taşınır",
    50: "N1: geri gelen dosya numarasının bağları yeniden görünmez",
    51: "Y1 öncesi: başlığında 'borç' geçen kişi özniteliği kolonu (Borçlu Telefon, Borçlu TC) tutar sayılır",
    52: "Y1: iki tutar kolonlu (Kalan/toplam yok) tabloda ilk tutar kolonu borç sayılır (not yerine)",
    53: "Y3 öncesi: Kalan hücresi boş, Toplam yok — tek tutar kolonu (Aidat) ana tutar sayılmaz (borç belirlenemez)",
    54: "Y3: Kalan hücresi boş, iki aday (Aidat + Gecikme Faizi) — ikisinin toplamı borç sayılır (not yerine)",
    55: "Y1: 'önce cari açın' Açılış Bakiyesi satırın ilk tutar hücresinden dolar (raporların borcundan değil)",
    56: "Y2 öncesi: aynı adlı iki satır telefonla ayırt edilse de güvenli eşleşme sayılmaz (kişi değeri yalnız ad + kimlik)",
    57: "TAKVİM KALEMİ öncesi: vade kaleminin tutarı satır borcudur (Kalan) — dönem / taksit tutarı kolonu yok sayılır",
    58: "TAKVİM KALEMİ: kalem tutarı dönem tutarıdır, Kalan Borç daha küçükse de (min alınmaz)",
    59: "TAKVİM KALEMİ: Tablodaki Kişiler de vade kaleminin tutarını (dönem tutarı) gösterir (satır borcu yerine)",
    60: "Z2 öncesi: Kalan Borç 0 ya da eksi satırın vade kalemi görünür (tutarı min(dönem tutarı, Kalan))",
    61: "Z3 öncesi: ödeme sözü kalemi söz tutarı değil, min(dönem tutarı, Kalan)",
    62: "SÖZ TUTARI öncesi: 'söz' ile başlayan her başlık söz sütunudur ('Sözleşme Tutarı', 'Sözleşme No' da söz)",
    63: "SÖZLEŞME TARİHİ öncesi: 'Sözleşme Tarihi' vade tarihi sayılır (vade kalemi açar)",
    64: "SÖZ TUTARI: yalnız 'Söz Tutarı' söz sütunu — 'Ödeme Sözü Tutarı', 'Taahhüt Tutarı' söz sayılmaz",
    65: "ÖDEME SÖZÜ başlıkları: taahhüt ailesi tam sözcük ('Taahhütname', 'Taahhütlü' söz değil)",
    66: "ÖDEME SÖZÜ başlıkları: söz tutarı sütunu yalnız 'tutar' sözcüğüyle ('Söz Miktarı', 'Taahhüt Miktarı' söz tutarı değil)",
    67: "5b + ÖDEME SÖZÜ: söz ailesi + dönem sözcüğü ('Taahhütlü Ücret') para kolonu sayılmaz (ücret borç / dönem tutarı olmaz)",
    68: "5b + ÖDEME SÖZÜ: 'Taahhütlü Ücret' söz tutarı sayılır (ücret borç değil, kalemi ödeme sözü)",
    69: "A1 + Z6: yalın sayı değerli 'Ödeme Sözü' / 'Söz' / 'Taahhüt' sütunu söz tutarıdır (söz kalemi bu sütundan tutar alır)",
    70: "A1 + Z6: yalın sayı değerli 'Ödeme Sözü' / 'Söz' / 'Taahhüt' sütunu tutar sayılır (borç olur)",
    71: "Y1/N4/K3 muafiyeti öncesi: borç/alacak/kalan/bakiye/toplam sözcüklü söz-ailesi başlığı ('Taahhüt Alacağı', 'Taahhüt Bakiyesi') yalın söz sayılır",
    72: "K3 gün/adet/ay: '(Ay)' söz-ailesi miktar sütunu ('Taahhüt Miktarı (Ay)') söz tutarı sayılır",
    # /3 (2.4.5; KARARLAR.md C)
    73: "S1: elle Borç/Alacak ve Açılış kuyruğa girmez (bağsız ödeme yalnız faturaları kapatır; elle kaydın Kalan'ı tutarı)",
    74: "S1: Açılış Bakiyesi kuyruğa girmez",
    75: "S1: kuyruk Vade Tarihi'ne göre dizilir (kayıt tarihi yerine)",
    76: "S1: aynı tarihte yazım sırası ters",
    77: "S1: bağlı ödeme (Kapatılacak Fatura) de en eskiden dağıtılır",
    78: "S1: silinen tahsilat Kalan'ı geri açmaz (kuyrukta kalır)",
    80: "K6.3: kalem tutarı kaydın tutarı (Kalan değil)",
    81: "K6.3: kalem tarihi Vade Tarihi (Beklenen Ödeme Tarihi'ne kaymaz)",
    82: "K6.3: Beklenen Ödeme Tarihi'nde etikete ' (Ödeme Sözü)' eklenmez",
    83: "K6.3: ufuk yok (bugünden 7 günden sonraki kalem de görünür)",
    84: "K6.3: Kalan'ı 0 olan kayıt da kalem",
    85: "K6.3: yalnız Vade Tarihi kalem açar (Beklenen Ödeme Tarihi tek başına açmaz)",
    86: "K6.3: cari görüntüleme yetkisi olmayan kullanıcı cari kalemlerini görür",
    87: "K6.3: 'Ödendi Say' (settle) cari kalemini kabul eder ve kapatır",
    88: "K6.1: Vade / Beklenen Ödeme Tarihi kaydın tarihinden önce olabilir (400 yok)",
    89: "K6.1: tahsilat (in) gönderilen Vade Tarihi'ni kaydeder",
    90: "K6.4: Düzenle (yalnız tutar/tarih) vade alanlarını siler",
    91: "K1: kayıt tahsilatı kapısı yok (POST 200, Kasa'ya girer)",
    92: "K1: eski kayıt tahsilatının silinmesi de kapalı (DELETE ret)",
    93: "K1: Silinenler'den geri yüklenen kayıt tahsilatı Kasa'ya dönmez",
    94: "Madde 2: Tablodan Aktar kapısı yok (POST 200, kart açılır)",
    95: "Madde 2: eski aktarımın Geri Al'ı da kapalı",
    96: "Madde 4: tablonun tutarlı kalemleri (ödeme günü, aidat, söz) Takvim'de kalır",
    97: "Madde 4: tablonun tutarsız tarih hatırlatmaları (duruşma, sözleşme bitiş, icra son tarihi) da kalkar",
    98: "Madde 4: Vade Takip'te tablo tutarlı kalemleri kalır",
    99: "K6.3: Nakit Akış Projeksiyonu cari vadesini katar",
    100: "K6.3: yön ters (carinin borcu 'out')",
    101: "S1 borç tarafı: elle Alacak / alacak yönlü Açılış ödemelerle kapanmaz (yalnız alış faturaları)",
    102: "K6.1: biçimsiz tarih kabul edilir",
    103: "K6.4: yedekten geri yüklemede vade alanları boş gelir",
    104: "K6.4: Silinenler'den geri yüklenen elle kayıt vade alanlarını yitirir",
    105: "K1: kayıt tahsilatı düzeltmesi (PUT /payments/:id) açık",
    109: "K6.5: Beklenen Ödeme Tarihi Vade Tarihi'nden önce → 400",
    114: "KS7: faturasız stok Satış İadesi bağsız kapatıcı değil (D1 eski hata sınıfı)",
    115: "KS7: Değersiz Alacak Yaz bağsız kapatıcı değil (D1 eski hata sınıfı)",
    116: "KS7: Şüpheli Alacağa Al da kapatıcı (bakiye değişmediği hâlde borçları kapatır)",
    118: "KS7.1: tedarikçiye nedensiz stok çıkışı ('Stok satışı') alış iadesi gibi bağsız ödeme sayılır",
    119: "§3.11b (a): tahsilat şüpheli kaydın kalanını düşürmez (değersiz sınırı alınan − değersiz)",
    120: "§3.11b / K3: kayıt tarihinden ÖNCE tarihli alacak satırı da şüpheliden düşer",
    121: "§3.11b (b): faturaya bağlı tahsilat da şüpheliden düşer",
    110: "K6.5: açılış satırı yokken açılış vadesi kabul edilir (opening-missing yok)",
    111: "K6.5: kapanmış dönemdeki kaydın vade alanları değiştirilebilir",
    112: "K6.5: Mevcut Borç kartlı caride kalem tutarı kart kapsamı düşülmeden Kalan",
    113: "K6.5: Mevcut Borç kartlı caride Kalan kart kapsamını içermez (Kalan − kapsam)",
    106: "KS5: ufkun sınır günü (bugün + 7) takvimde yok (hariç)",
    107: "KS4: Kasa sütunları Tablodaki Nakit Akışı'nda kalır (Kasa raporuyla aynı)",
    108: "KS4: Kasa yetkisi olmayan kullanıcıya Tablodaki Nakit Akışı'nda Kasa notu kalır",
}


def kurus(metin):
    s = str(metin).strip()
    if "," in s:
        tam, ond = s.split(",", 1)
        ond = (ond + "00")[:2]
    else:
        tam, ond = s, "00"
    return int(tam) * 100 + int(ond)


# ───────────────────────── /2 B3: Tablodaki Kişiler borcu — [KULLANICI] 23.10.2026 03:12 UTC (5 dk yetkisiyle) K1–K5 metni; ürün kodu okunmadı
# C3 (23.10.2026): kişi kimliği sütunu (TCKN/VKN). Başlık adları ORTAM bilgisidir — kara kutu yoklaması (aday 15, 23.10.2026: "TC Kimlik No", "TCKN", "VKN",
# "TCKN/VKN", "Kimlik No", "TC Kimlik No / VKN" başlıklı sütunda aynı ad farklı kimlik ayrı satır oldu; "Vergi No" başlıklı tabloda hiç satır görünmedi — İNCELE).
# VERGİ SÜTUNU BORÇ DEĞİLDİR ([KULLANICI] 23.10.2026 karar A): "KDV", "Vergi", "Vergi Tutarı", "Stopaj", "Tevkifat", "ÖTV" başlıklı sütunlar tutardır ama borç sayılmaz;
# Kalan/ödenen yoksa ve "Tutar" (KDV hariç) ile "Genel Toplam" (KDV dahil) varsa borç Genel Toplam.
VERGI_KELIME = {"kdv", "stopaj", "tevkifat", "ötv"}
VERGI_TAM_BASLIK = {"vergi", "vergi tutarı"}
KISI_KIMLIK_BASLIK = {"tc kimlik no", "tckn", "vkn", "tckn/vkn", "kimlik no", "tc kimlik no / vkn",
                      # KİMLİK SÜTUNU TUTAR DEĞİLDİR (baş mimar kararı, 23.10.2026): kimlik/numara bildiren başlık — sağlama hanesi tutmasa da tutar sayılmaz, borca girmez.
                      # "Vergi", "Vergi Tutarı", "KDV" başlıklı sütunlar tutardır (bu kümede değil).
                      "vergi no", "vergi numarası", "vergi kimlik"}
VERGI_KIMLIK_BASLIK = {"vergi no", "vergi numarası", "vergi kimlik"}  # mutant 34
KIMLIK_BASLIK = {"dosya no", "borçlu", "telefon", "müşteri no", "müşteri", "ad soyad", "fatura no"} | KISI_KIMLIK_BASLIK
# Y1 (karar sahibi 23.10.2026): borç kolonu YALNIZ para (tutar) kolonudur — telefon, TCKN/VKN/kimlik, tarih, kişi kolonları ve "Borçlu Telefon", "Borçlu TC",
# "Borçlu Adres" gibi kişi özniteliği başlıkları ASLA borç değildir (başlıkta "borç" geçse de). Kelime kümesi kararın saydığı sınıflardan; "tel/gsm/cep", "ad/soyad/unvan"
# yazımları [YAYGIN].
KISI_OZNITELIK_KELIME = {"telefon", "tel", "gsm", "cep", "tc", "tckn", "vkn", "kimlik", "adres", "adresi", "ad", "adı", "soyad", "soyadı", "unvan", "unvanı",
                         "tarih", "tarihi", "posta", "eposta", "mail", "email"}
# TAKVİM KALEMİ (baş mimar kararı 23.10.2026): satırın kendi dönem / taksit tutarı kolonu — "Taksit Tutarı", "Aidat", "Kira", "Aylık Ücret"… (kelime başı; "dönem",
# "abonelik" [YAYGIN]). Para kolonu olmalı (kişi özniteliği / tarih kolonu değil: "Sonraki Taksit Tarihi" dönem kolonu değildir).
DONEM_KELIME = ("taksit", "aidat", "kira", "ücret", "aylık", "dönem", "abonelik")
TUTAR_DISI = {"gün", "adet"}  # K3: gün/adet sütunu ("Kalan Gün", "Adet") tutar değildir
TUTAR_DISI_EK = {"sayı", "sayısı", "ay", "yıl", "oran", "oranı", "yüzde"}  # tutar sayılmaz [YAYGIN]; senaryolarda kullanılmaz (DENENMEZ)


def tckn_gecerli(v):
    """TCKN sağlama haneleri (NVİ): 11 hane, ilk hane 0 değil; 10. = ((1+3+5+7+9) × 7 − (2+4+6+8)) mod 10; 11. = ilk 10 hanenin toplamı mod 10."""
    if len(v) != 11 or not v.isdigit() or v[0] == "0":
        return False
    d = [int(c) for c in v]
    return d[9] == ((d[0] + d[2] + d[4] + d[6] + d[8]) * 7 - (d[1] + d[3] + d[5] + d[7])) % 10 and d[10] == sum(d[:10]) % 10


def vkn_gecerli(v):
    """VKN sağlama hanesi (GİB): 10 hane; i = 0..8 için t = (d_i + 9 − i) mod 10, p = t × 2^(9−i) mod 9 (t ≠ 0 ve p = 0 ise 9); 10. hane = (10 − Σp mod 10) mod 10."""
    if len(v) != 10 or not v.isdigit():
        return False
    s = 0
    for i in range(9):
        t = (int(v[i]) + 9 - i) % 10
        p = (t * 2 ** (9 - i)) % 9
        if t != 0 and p == 0:
            p = 9
        s += p
    return int(v[9]) == (10 - s % 10) % 10


def kimlik_gecerli(v):
    return tckn_gecerli(v) or vkn_gecerli(v)


def tr_kucuk(metin):
    return str(metin).replace("I", "ı").replace("İ", "i").lower()


def kelimeler(baslik):
    out, w = [], ""
    for ch in tr_kucuk(baslik):
        if ch.isalpha():
            w += ch
        else:
            if w:
                out.append(w)
            w = ""
    if w:
        out.append(w)
    return out


def tarih_mi(metin):
    t = str(metin or "").strip()
    return len(t) == 10 and ((t[2] == "." and t[5] == "." and t.replace(".", "").isdigit()) or (t[4] == "-" and t[7] == "-" and t.replace("-", "").isdigit()))


def soz_ailesi(baslik):
    """ÖDEME SÖZÜ başlıkları (karar sahibi 23.10.2026): söz ailesi TAM sözcük ("Söz", "Sözü", "Ödeme Sözü"); TAAHHÜT ailesi ÖNEK ("Taahhüt", "Taahhüdü", "Taahhütname",
    "Taahhütlü"); "Sözleşme…" söz değil. Mutantlar 62 (söz öneki), 64 (yalnız "söz"), 65 (taahhüt tam sözcük)."""
    w = kelimeler(baslik)
    if SOZ_DAR[0]:
        return "söz" in w
    if SOZ_ONEK[0]:
        return any(x.startswith(("söz", "taahhüt")) for x in w)
    return any(x in ("söz", "sözü", "sözün") for x in w) or any(
        (x in ("taahhüt", "taahhüdü")) if SOZ_TAM_TAAHHUT[0] else x.startswith(("taahhüt", "taahhüd")) for x in w)


def sutun_sinifi(baslik, hucreler=()):
    """K3 sütun sınıfı: None tutar değil (tarih değerli sütun [YAYGIN]; gün/adet — K3); "soz" Ödeme Sözü tutarı (borç değil — K3); "kalan" Kalan/Kalan Borç/
    Bakiye; "odenen" Tahsil Edilen/Ödenen/Ödenen Tutar; "toplam" Toplam Borç/Tutar/Ödenecek Tutar/Toplam (borç/alacak başlıklı da); "tutar" öbür tutar (Aidat, Ücret …)."""
    dolu = [h for h in hucreler if str(h or "").strip()]
    if dolu and all(tarih_mi(h) for h in dolu):
        return None
    if dolu and not any(_sayi_mi(h) for h in dolu):
        return None  # [YAYGIN] değerleri sayı olmayan metin sütunu ("Açıklama": "Ekim") tutar değildir
    w = kelimeler(baslik)
    if ("%" in str(baslik) or any(x in TUTAR_DISI or x in TUTAR_DISI_EK for x in w)) and not (SOZ_UCRET[0] == 72 and soz_ailesi(baslik)):
        return None  # K3 gün/adet (ve [YAYGIN] ay/sayı/oran): "Taahhüt Miktarı (Ay)" de söz tutarı değil (ana oturum 23.10.2026)
    if any(x in VERGI_KELIME for x in w) or " ".join(w) in VERGI_TAM_BASLIK:
        return "vergi"  # karar A: tutardır ama borç sayılmaz
    if w[:2] == ["genel", "toplam"]:
        return "genel"  # karar A: KDV dahil toplam
    # SÖZ TUTARI (karar sahibi 23.10.2026): söz sütunu YALNIZ ödeme sözü / taahhüt tutarıdır ("Söz Tutarı", "Ödeme Sözü Tutarı", "Taahhüt Tutarı"); "Sözleşme Tutarı",
    # "Sözleşme Bedeli", "Sözleşme No", "Sözleşme Tarihi" söz DEĞİLDİR (sözleşme bedeli dönem / taksit tutarı da değildir; borç Kalan'dan gelir). Mutant 62: eski önek kuralı.
    # ÖDEME SÖZÜ başlıkları (karar sahibi 23.10.2026): söz ailesi TAM sözcük ("Söz", "Sözü", "Ödeme Sözü"); TAAHHÜT ailesi ÖNEK ("Taahhüt", "Taahhüdü", "Taahhütname",
    # "Taahhütlü"); yalnız "Sözleşme…" söz değildir. Söz TUTARI sütunu söz/taahhüt sözcüğü + "tutar" YA DA "miktar" sözcüğü taşır ("Söz Tutarı", "Söz Miktarı", "Taahhüt
    # Miktarı"); tutar/miktar sözcüğü olmayan söz-ailesi sütunu para kolonu değildir [YAYGIN] (tarih değerliyse zaten tarih).
    if soz_ailesi(baslik):
        donem_sozcugu = any(x.startswith(DONEM_KELIME) for x in w)
        if SOZ_DAR[0] or SOZ_ONEK[0] or any(x.startswith("tutar") or (x.startswith("miktar") and not SOZ_YALNIZ_TUTAR[0]) for x in w) or (donem_sozcugu and SOZ_UCRET[0] == 68):
            return "soz"
        if SOZ_UCRET[0] == 67 and donem_sozcugu:
            return None
        if not donem_sozcugu:
            # MUAFİYET (ana oturum 23.10.2026; Y1 "borç kolonu yalnız para kolonudur", N4 "'Bakiye' ve 'Kalan Tutar' Kalan sayılır", K3 Kalan önceliği): borç / alacak / kalan /
            # bakiye / toplam ailesinden sözcük taşıyan söz-ailesi başlığı ("Taahhüt Alacağı", "Taahhüt Bakiyesi"; ekli biçimler dahil — YALNIZ bu muafiyette) yalın söz DEĞİLDİR:
            # kalan / bakiye → Kalan; borç / alacak / toplam → borç (toplam). Genel borç kalıpları genişletilmez.
            borc_ailesi = [x for x in w if x.startswith(("borç", "alacak", "alacağ", "kalan", "bakiye", "toplam"))]
            if borc_ailesi and SOZ_UCRET[0] != 71:
                return "kalan" if any(x.startswith(("kalan", "bakiye")) for x in borc_ailesi) else "toplam"
            # A1 + Z6 (ana oturum 23.10.2026, (a)/(c)): yalın söz-ailesi sütunu ("Ödeme Sözü", "Söz", "Taahhüt" — tutar/miktar/dönem sözcüğü yok) söz tutarı DEĞİL (söz kalemi
            # bundan tutar almaz) ve borç DEĞİL (A1: söz borç değil); sekmede söz bulunduğunu söyler (yalnız bu sütun varsa borç 0, not yok — "yalnız söz" gibi)
            if SOZ_UCRET[0] == 69 and dolu and all(_sayi_mi(h) for h in dolu):
                return "soz"
            if SOZ_UCRET[0] == 70 and dolu and all(_sayi_mi(h) for h in dolu):
                return "tutar"
            return "soz_yalin" if dolu and all(_sayi_mi(h) for h in dolu) else None
        # 5b + ÖDEME SÖZÜ (karar sahibi 23.10.2026): söz/taahhüt ailesi + dönem sözcüğü, tutar/miktar sözcüğü YOK ("Taahhütlü Ücret") söz tutarı DEĞİLDİR — ücret borç /
        # dönem tutarı olarak kalır (Kalan doluysa borç Kalan, boşsa ücret; kalem min(ücret, Kalan)); sınıflandırma aşağıda sürer
    if "kalan" in w or "bakiye" in w:
        return "kalan"
    if ("tahsil" in w and any(x.startswith("edil") for x in w)) or any(x.startswith("ödenen") for x in w):
        return "odenen"
    if any(x.startswith(("toplam", "tutar", "ödenecek", "borç", "alacak")) for x in w):
        return "toplam"
    return "tutar"


SOZ_ONEK = [False]  # mutant 62 (Model kurucusu ayarlar)
SOZ_DAR = [False]  # mutant 64
SOZ_TAM_TAAHHUT = [False]  # mutant 65
SOZ_YALNIZ_TUTAR = [False]  # mutant 66
SOZ_UCRET = [0]  # mutant 67 / 68


def _sayi_mi(metin):
    try:
        return hucre_kurus(metin) is not None
    except (ValueError, TypeError):
        return False


def hucre_kurus(metin):
    """Tablo hücresi ("6.000,00 ₺", "8000", "") → kuruş; boş → None."""
    t = str(metin if metin is not None else "").replace("₺", "").replace("TL", "").replace(" ", "").strip()
    if not t:
        return None
    t = t.replace(".", "")
    return kurus(t)


YOK = "yok"  # satırda borç tutarı sütunu yok, yalnız Ödeme Sözü (söz tutarı borç değil — K3) — borç kaynağı sayılmaz
NOT = "not"  # Y1/Y3: borç kolonu yok ya da ana tutar belirlenemiyor — borç YOK (bütün raporlarda 0) ve satır görünür ya da raporda görünür not


class Model:
    def __init__(self, senaryo, mut=0, kural="2.4.5"):
        if senaryo.get("dil") not in DILLER:
            raise SystemExit("senaryo dili %s değil" % "/".join(DILLER))
        self.s = senaryo
        self.mut = mut
        # /3: kural seti — "2.4.5" (varsayılan; kapılar anahtarla açılır) ya da "2.4.4" (--legacy: geçersiz /1 /2 senaryoları anahtarlar açık sunucuda eski kurallarla)
        self.kural = kural
        self.v3 = senaryo.get("dil") == DIL
        acik_hepsi = kural == "2.4.4"
        # K1 + K4.1 (BAŞ MİMAR 24.10.2026): config.legacyCasePayments / legacyTableTransfer / legacyTableDues — ürün varsayılanı KAPALI; --legacy'de üçü AÇIK
        self.anahtar = {"legacyCasePayments": acik_hepsi, "legacyTableTransfer": acik_hepsi, "legacyTableDues": acik_hepsi}
        if not acik_hepsi:
            self.anahtar.update({k: bool(v) for k, v in (senaryo.get("anahtar") or {}).items()})
        self.hareketler = {}       # /3: ad -> {cari, tur: acilis|borc|alacak|tahsilat|odeme, tutar, tarih, seq, vade, beklenen, aktif, gonderilen}
        self.odemeler = {}         # /3: adım id -> {cari, tutar, tarih, seq, fatura, aktif} (kind out)
        self.kayitOdeme = {}       # /3: kayıt tahsilatı adım id -> {kayit, tutar, tarih, aktif}
        self.yedekler = {}         # /3: yedek adı -> durum kopyası
        self.kapaticilar = {}      # /3 KS7: adım id -> {cari, tur: stok_iade|degersiz|alis_iade, tutar, tarih, seq, aktif} (bağsız kapatıcılar)
        self.supheliler = {}       # /3 KS7: şüpheli kaydı adı -> {cari, tutar, tarih, kalan}
        SOZ_ONEK[0] = mut == 62
        SOZ_DAR[0] = mut == 64
        SOZ_TAM_TAAHHUT[0] = mut == 65
        SOZ_YALNIZ_TUTAR[0] = mut == 66
        SOZ_UCRET[0] = mut if mut in (67, 68, 69, 70, 71, 72) else 0
        self.bugun = senaryo["bugun"]
        self.seq = 0
        self.cariler = {}          # takma ad -> {tur, isim, kayit, acilis}
        self.borclar = defaultdict(int)
        self.tahsilatlar = {}      # adım id -> {cari, tutar, tarih, seq, fatura, kart, aktif}
        self.faturalar = {}        # takma ad -> {cari, tutar, tarih, seq, tur, durum, taksitli, asil}
        self.evraklar = {}         # takma ad -> {cari, tur, tutar, tarih, seq, fatura, durum, ciroCari, kendi}
        self.kayitlar = {}         # kayıt no -> {sekmeler:[..], tur, isim, items:[(tarih, tutar)], kalan}
        self.kartlar = {}          # kayıt no -> {cari, toplam, mevcut, tasinan:[ids], aktar, aktif}
        self.aktarimlar = {}       # takma ad -> {kartlar:[no]}
        self.kayitTahsilat = defaultdict(int)
        self.kasa = 0
        self.kasa_hareket = []     # /2 B4: (tarih, giriş kuruş, çıkış kuruş) — yalnız NAKİT (MM6 "bütün kaynaklar")
        self.sekmeler = []         # /2 B3: yüklenen tablonun sekmeleri (sırasıyla) — satırlar (dosya no, hücreler) yazım sırasıyla (K1)
        self.kullanicilar = {}     # /2 B5b (K5): Kasa görme yetkisi kaldırılmış kullanıcılar
        self.nt_isaretli = None    # /2 B5: programın işaretli Nihai Tüketici carisi (takma ad)
        self.nt_sayac = 0
        self.mizanBilinir = True
        self.etiketCari = defaultdict(set)   # cari -> açık/kart denetiminin etiketini AJAN'a düşüren nedenler
        self.out = {}
        self.belirsiz = []
        self.belirsiz_adlar = set()
        self.bag_kopan_adlar = set()
        self.kayip_dosya = {}  # N1: tablodan kalkan Dosya No → kalan kayıt tahsilatı (dosya numarası geri gelirse bağ yeniden görünür)  # N3: bağı hiçbir yere taşınmayan kişiler — rapordaki tahsilatları (0 dahil) denetlenir  # bağ sürekliliği: eşleşmeyen bağlı verinin yeri kuralda yok → bu adlı kişilerin borç/alacak denetimi yapılmaz

    # ───────────────────────── yardımcılar
    def yeni_seq(self):
        self.seq += 1
        return self.seq

    def d(self, anahtar, deger, etiket, kural):
        self.out[anahtar] = {"b": deger, "e": etiket, "k": kural}

    def cari_bul_kayit(self, no):
        for ad, c in self.cariler.items():
            if c.get("kayit") == no and not c.get("silindi"):
                return ad
        return None

    def faturali(self, cari):
        return any(f["cari"] == cari and f["durum"] == "kesildi" for f in self.faturalar.values())

    def bakiye(self, cari):
        c = self.cariler[cari]
        b = c["acilis"] if c.get("acilisYon", "borc") == "borc" else -c["acilis"]
        for h in self.hareketler.values():  # /3: elle Borç (+) / Alacak (−); açılış yukarıda; tahsilat aşağıda (tahsilatlar)
            if h["cari"] == cari and h["aktif"]:
                b += h["tutar"] if h["tur"] == "borc" else -h["tutar"] if h["tur"] == "alacak" else 0
        for o in self.odemeler.values():  # /3: cariye ödeme (kind out) borç tarafını kapatır → bakiye artar
            if o["aktif"] and o["cari"] == cari:
                b += o["tutar"]
        for x in self.kapaticilar.values():  # /3 KS7: satış iadesi / değersiz alacak cari alacağı (−), alış iadesi cari borcu (+); şüpheliye alma bakiyeyi DEĞİŞTİRMEZ
            if x["aktif"] and x["cari"] == cari:
                b += x["tutar"] if x["tur"] in ("alis_iade", "stok_satis") else -x["tutar"]
        for f in self.faturalar.values():
            if f["cari"] != cari or f["durum"] != "kesildi":
                continue
            if f["tur"] == "satis":
                b += f["tutar"]
            elif f["tur"] in ("iade", "alis"):
                b -= f["tutar"]
        for k in self.kartlar.values():
            if k["aktif"] and k["cari"] == cari and not k["mevcut"]:
                b += k["toplam"]
        for t in self.tahsilatlar.values():
            if t["aktif"] and t["cari"] == cari:
                b -= t["tutar"]
        for e in self.evraklar.values():
            if e["durum"] == "silindi":
                continue
            if e["cari"] == cari:
                b -= e["tutar"]
                if e["durum"] == "karsiliksiz":
                    b += e["tutar"]
            if e["durum"] == "ciro" and e["ciroCari"] == cari:
                b += e["tutar"]
        return b

    def taksit_disi(self, cari):
        return [t for t in sorted(self.tahsilatlar.values(), key=lambda x: (x["tarih"], x["seq"]))
                if t["aktif"] and t["cari"] == cari and t["kart"] is None and t["fatura"] is None]

    # ───────────────────────── fatura açıkları (§7 + UX18) ve /3 S1 tek yükümlülük kuyruğu
    def _sira_anahtari(self, tarih, seq, vade=None):
        """S1: kayıt tarihine, aynı tarihte yazım sırasına göre (Vade / Beklenen Ödeme Tarihi sırayı DEĞİŞTİRMEZ). Mutant 75: vadeye göre; 76: yazım sırası ters."""
        t = (vade or tarih) if self.mut == 75 else tarih
        return (t, -seq if self.mut == 76 else seq)

    def kuyruk(self, cari):
        """S1 ([KULLANICI 5 dk yetkisi] + BAŞ MİMAR KARARI 24.10.2026; PLAN §8.10 "Otomatik (En Eski)", §4.3/2 "en eski yükümlülük"): carinin ALACAK tarafı
        (carinin borçları) tek kuyrukta — taksitsiz satış faturası, elle Borç, borç yönlü Açılış Bakiyesi — kayıt tarihine, aynı tarihte yazım sırasına göre. Bağlı ödemeler
        (faturaya bağlı tahsilat / evrak, faturanın kendi evrakı) yalnız kendi kalemini kapatır ([AJAN] fazlası havuza); bağsız ödemeler (tahsilat, çek/senet, iade artanı)
        en eskiden dağıtılır. Karşılıksız evrak hiçbir şeyi kapatmaz (B2.2). Elle kayıt yoksa sonuç /1–/2 kâhininin fatura açığıyla AYNI (faturaların bugünkü kapaması
        DEĞİŞMEZ). Dönüş: anahtar (fatura adı / iade adı / hareket adı) → kalan (kuruş)."""
        oge = [(self._sira_anahtari(f["tarih"], f["seq"]), ad, f["tutar"]) for ad, f in self.faturalar.items()
               if f["cari"] == cari and f["durum"] == "kesildi" and f["tur"] == "satis" and not f["taksitli"]]
        fatura_anahtar = {ad for _, ad, _ in oge}
        if self.mut != 73:
            for hn, h in self.hareketler.items():
                if h["cari"] != cari or not h["aktif"]:
                    continue
                if h["tur"] == "borc" or (h["tur"] == "acilis" and h["yon"] == "borc" and self.mut != 74):
                    oge.append((self._sira_anahtari(h["tarih"], h["seq"], h.get("vade") or None), hn, h["tutar"]))
        # KS7.1 [BAŞ MİMAR; 2.0.17 kuralı "SATIŞ faturası, elle Borç, stoktan satış ödeme değildir"]: stok formundan açık hesap çıkışı (iade nedeni yok, "Stok satışı") —
        # tedarikçiye de olsa — carinin YÜKÜMLÜLÜĞÜDÜR (alacak tarafı kuyruğunda); mutant 118: alış iadesi gibi bağsız ödeme sayılır
        for xn, x in self.kapaticilar.items():
            if x["aktif"] and x["cari"] == cari and x["tur"] == "stok_satis" and self.mut != 118:
                oge.append((self._sira_anahtari(x["tarih"], x["seq"]), xn, x["tutar"]))
        oge.sort()
        sira = [ad for _, ad, _ in oge]
        acik = {ad: t for _, ad, t in oge}
        bagli = defaultdict(int)
        havuz = 0
        for t in self.tahsilatlar.values():
            if t["cari"] != cari or t["kart"] is not None:
                continue
            if not t["aktif"] and not (self.mut == 78 and t.get("silindi")):
                continue
            if t["fatura"] and t["fatura"] in fatura_anahtar and self.mut != 77:
                bagli[t["fatura"]] += t["tutar"]
            else:
                havuz += t["tutar"]
        for ad, e in self.evraklar.items():
            if e["cari"] != cari or e["durum"] in ("silindi",):
                continue
            if e["durum"] == "karsiliksiz" and self.mut != 7:
                continue
            f = e["fatura"]
            if f and f in fatura_anahtar:
                bagli[f] += e["tutar"]
            elif f and f in self.faturalar and self.faturalar[f]["durum"] == "iptal" and self.mut == 8:
                continue
            else:
                havuz += e["tutar"]
        # KS7 [BAŞ MİMAR] (a) faturasız stok Satış İadesi ve (b) Değersiz Alacak Yaz = BAĞSIZ kapatıcı (en eskiden; faturalar dahil tek kuyruk — (d));
        # Şüpheli Alacağa Al kapatıcı DEĞİL (bakiye değişmez). Mutant 114: satış iadesi kapatmaz; 115: değersiz kapatmaz; 116: şüpheliye alma da kapatır.
        for x in self.kapaticilar.values():
            if x["aktif"] and x["cari"] == cari and x["tur"] in ("stok_iade", "degersiz"):
                if (x["tur"] == "stok_iade" and self.mut == 114) or (x["tur"] == "degersiz" and self.mut == 115):
                    continue
                havuz += x["tutar"]
        if self.mut == 116:
            havuz += sum(sp["tutar"] for sp in self.supheliler.values() if sp["cari"] == cari)
        for ad in sira:
            if ad not in fatura_anahtar:
                continue
            kapanan = min(acik[ad], bagli[ad])
            acik[ad] -= kapanan
            if self.mut != 6:
                havuz += bagli[ad] - kapanan
        # satıştan iade (§7 kural 5–6): asıl faturanın açığından düşer, artanı kuyruğun en eskisine
        iadeler = sorted([(f["tarih"], f["seq"], ad) for ad, f in self.faturalar.items()
                          if f["cari"] == cari and f["durum"] == "kesildi" and f["tur"] == "iade"])
        if self.mut == 9:
            sira = list(reversed(sira))
        for _, _, iad in iadeler:
            i = self.faturalar[iad]
            artan = i["tutar"]
            if i["asil"] in acik:
                d = min(acik[i["asil"]], artan)
                acik[i["asil"]] -= d
                artan -= d
            for ad in sira:
                d = min(acik[ad], artan)
                acik[ad] -= d
                artan -= d
            acik[iad] = artan
        for ad in sira:
            d = min(acik[ad], havuz)
            acik[ad] -= d
            havuz -= d
        for ad, f in self.faturalar.items():
            if f["cari"] == cari and f["durum"] == "kesildi" and f["tur"] == "satis" and f["taksitli"]:
                acik[ad] = f["tutar"]
        return acik

    def kuyruk_borc(self, cari):
        """S1 BORÇ tarafı (simetrik; carinin alacakları): alış faturası, elle Alacak, alacak yönlü Açılış Bakiyesi — aynı sıra. Bağlı ödeme (faturaya bağlı kind out)
        kendi faturasını, bağsız ödeme ve cariye ciro edilen evrak [YAYGIN] en eskiden kapatır. Mutant 101: elle Alacak / açılış kuyruğa girmez."""
        oge = [(self._sira_anahtari(f["tarih"], f["seq"]), ad, f["tutar"]) for ad, f in self.faturalar.items()
               if f["cari"] == cari and f["durum"] == "kesildi" and f["tur"] == "alis"]
        fatura_anahtar = {ad for _, ad, _ in oge}
        if self.mut not in (73, 101):
            for hn, h in self.hareketler.items():
                if h["cari"] != cari or not h["aktif"]:
                    continue
                if h["tur"] == "alacak" or (h["tur"] == "acilis" and h["yon"] == "alacak" and self.mut != 74):
                    oge.append((self._sira_anahtari(h["tarih"], h["seq"], h.get("vade") or None), hn, h["tutar"]))
        oge.sort()
        sira = [ad for _, ad, _ in oge]
        acik = {ad: t for _, ad, t in oge}
        bagli = defaultdict(int)
        havuz = 0
        for o in self.odemeler.values():
            if o["cari"] != cari or not o["aktif"]:
                continue
            if o["fatura"] and o["fatura"] in fatura_anahtar and self.mut != 77:
                bagli[o["fatura"]] += o["tutar"]
            else:
                havuz += o["tutar"]
        for e in self.evraklar.values():
            if e["durum"] == "ciro" and e["ciroCari"] == cari:
                havuz += e["tutar"]
        for x in self.kapaticilar.values():
            # KS7 simetriği: AÇIK alış iadesi nedenli ('preturn') stok çıkışı = bağsız ödeme (formda yolu yok — BİLİNEN SINIR, senaryoda yok); KS7.1: nedensiz "Stok satışı"
            # ödeme DEĞİL (yalnız mutant 118 dünyasında ödeme sayılır)
            if x["aktif"] and x["cari"] == cari and (x["tur"] == "alis_iade" or (x["tur"] == "stok_satis" and self.mut == 118)):
                havuz += x["tutar"]
        for ad in sira:
            if ad in fatura_anahtar:
                kapanan = min(acik[ad], bagli[ad])
                acik[ad] -= kapanan
                havuz += bagli[ad] - kapanan
        if self.mut == 9:
            sira = list(reversed(sira))
        for ad in sira:
            d = min(acik[ad], havuz)
            acik[ad] -= d
            havuz -= d
        return acik

    def aciklar(self, cari):
        """Satış faturası (ve iade) açıkları — /1–/2 kâhininin B2.1 sonucu; kuyruğun fatura anahtarları."""
        return {k: v for k, v in self.kuyruk(cari).items() if k in self.faturalar}

    def kalanlar(self, cari):
        """/3 K6.2: carinin elle Borç/Alacak ve Açılış kayıtlarının Kalan'ı (iki taraf). Mutant 73: dağıtım yok (Kalan = tutar)."""
        out = {}
        for taraf in (self.kuyruk(cari), self.kuyruk_borc(cari)):
            out.update({k: v for k, v in taraf.items() if k in self.hareketler})
        for hn, h in self.hareketler.items():
            if h["cari"] == cari and h["aktif"] and h["tur"] in ("acilis", "borc", "alacak") and hn not in out:
                out[hn] = h["tutar"]  # mutant 73/74/101: kuyruğa girmeyen kayıt kapanmaz
        return out

    def satir_borcu(self, sk, hucre):
        """K3 satırın borcu (kuruş), YOK (borç tutarı sütunu yok) ya da None (kural tanımsız — denetlenmez)."""
        sinif = []
        for h in sk["basliklar"]:
            if tr_kucuk(h) in KIMLIK_BASLIK and not (self.mut == 34 and tr_kucuk(h) in VERGI_KIMLIK_BASLIK):
                continue
            if self.mut != 51 and any(x in KISI_OZNITELIK_KELIME for x in kelimeler(h)):
                continue  # Y1: kişi özniteliği kolonu borç değil
            sutun = [c.get(h) for _, c in sk["satirlar"]]
            sinif.append((h, sutun_sinifi(h, sutun) if self.mut != 16 or kelimeler(h)[-1:] not in (["gün"], ["adet"]) else "tutar"))
        if self.mut == 35:  # eski K3: vergi sütunu tutar, Genel Toplam toplam sınıfı
            sinif = [(h, "tutar" if x == "vergi" else "toplam" if x == "genel" else x) for h, x in sinif]
        # N4 (karar sahibi 23.10.2026): vergi kolonu YALNIZ tabloda başka bir tutar kolonu varken borç dışıdır; tek tutar kolonu vergi kolonuysa ("Vergiler": Vergi Tutarı) o borçtur
        vergi_kol = [h for h, x in sinif if x == "vergi"]
        if len(vergi_kol) == 1 and not any(x in ("kalan", "toplam", "odenen", "tutar", "genel") for _, x in sinif) and self.mut != 47:
            sinif = [(h, "tutar" if x == "vergi" else x) for h, x in sinif]
        al = lambda c: [h for h, x in sinif if x == c]  # noqa: E731
        kalan, toplam, odenen, tutar, soz, genel = al("kalan"), al("toplam"), al("odenen"), al("tutar"), al("soz"), al("genel")
        soz_var = soz + al("soz_yalin")  # A1: yalın söz sütunu da sekmede söz olduğunu söyler (yalnız söz → borç değil, not yok)
        if len(genel) > 1:
            return None
        if self.mut == 15:
            tutar = tutar + soz
        if len(kalan) > 1 or len(toplam) > 1 or len(odenen) > 1:
            return None
        if kalan and self.mut != 14:
            v = hucre_kurus(hucre.get(kalan[0]))
            if v is not None:
                return v
            if self.mut == 17:
                return 0
            # Y3 (karar sahibi 23.10.2026, seyrek Kalan Borç): Kalan hücresi BOŞ satırda borç satırın ANA tutarıdır — Toplam / Genel Toplam (Genel Toplam önce: karar A
            # KDV dahil [YAYGIN — ikisi birden senaryoda yok]); yoksa tek tutar kolonu ("Aidat"); belirlenemiyorsa (iki aday) görünür not, borç yok.
            if genel and len(genel) == 1 and self.mut != 53:
                return hucre_kurus(hucre.get(genel[0]))
            if toplam:
                return hucre_kurus(hucre.get(toplam[0]))  # K3: Kalan hücresi boş → toplam
            if self.mut == 53:
                return None
            if len(tutar) == 1:
                return hucre_kurus(hucre.get(tutar[0]))
            if self.mut == 54 and tutar:
                return sum(hucre_kurus(hucre.get(h)) or 0 for h in tutar)
            return NOT
        if kalan and self.mut == 14 and toplam:
            return hucre_kurus(hucre.get(toplam[0]))
        if odenen and genel:
            toplam = genel  # karar A + K3 "Kalan yoksa toplam − ödenen": toplam KDV dahil Genel Toplam [YAYGIN — hangi toplam metinde yok]
        if odenen and toplam:
            t = hucre_kurus(hucre.get(toplam[0]))
            o = hucre_kurus(hucre.get(odenen[0]))
            if t is None or o is None:
                return None
            if self.mut == 24:
                return t
            return t - o if self.mut == 25 else max(0, t - o)  # K3: Kalan yoksa toplam − ödenen; negatifse 0
        if odenen:
            return None
        if genel:
            if self.mut == 36 and len(toplam) == 1:
                return hucre_kurus(hucre.get(toplam[0]))
            return hucre_kurus(hucre.get(genel[0]))  # karar A: Tutar (KDV hariç) + Genel Toplam (KDV dahil) → borç Genel Toplam
        para = toplam + tutar
        if len(para) == 1:
            return hucre_kurus(hucre.get(para[0]))  # K3: tek tutar sütunu (taksit, kira, aidat, ücret, "Ödenecek" dahil)
        if not para:
            # yalnız söz → borç değil (K3); Y1: söz de yoksa (telefon / tarih / kişi kolonları) borç kolonu yok → görünür not
            return YOK if soz_var else NOT
        if self.mut == 52:
            return hucre_kurus(hucre.get(para[0]))
        return NOT  # Y1: iki tutar kolonu, Kalan / toplam yok → borç yok + görünür not

    def kisiler(self):
        """C3 ([KULLANICI] 23.10.2026, 31e kontrol turu 3 bulgusu C3 + bağımsız dar kontrol D1): Tablodaki Kişiler'de carisi olmayan tablo kayıtlarının kişi
        gruplaması. Aynı ad + farklı TCKN/VKN = farklı kişi (ayrı satır, etikette kimlik); aynı ad + aynı kimlik = aynı kişi; FARKLI ad + AYNI kimlik = FARKLI kişiler
        (kimlik yalnız aynı adı ayırır, farklı adları birleştirmez). KİMLİKSİZ SATIR (baş mimar kararı, C3 tamamlayıcısı, 23.10.2026): adın tek kimliği varsa ona
        katılır; adın birden çok kimliği varsa AYNI Dosya No'yu taşıyan kimlikli satırın kişisine katılır; o da yoksa adın kimliksiz grubu olarak ayrı kişi kalır.
        KİMLİK SÜTUNU (aynı karar): sağlama hanesi tutmayan değer kimlik sayılmaz (ad kuralı geçer) — tablo_yukle yalnız geçerli TCKN/VKN'yi kimlik yazar.
        [YAYGIN] kimliği hiç olmayan aynı ad tek kişidir. TANIMSIZ (denetlenmez): bir kayıtta (dosya no) birden çok ad ya da birden çok kimlik.
        Dönüş: kayıt no → kişi anahtarı ya da None."""
        adaylar = [no for no, kay in self.kayitlar.items() if self.cari_bul_kayit(no) is None and kay["tur"] != "taksit"]
        ad_kimlik = defaultdict(set)
        bozuk = set()
        for no in adaylar:
            kay = self.kayitlar[no]
            if len(kay["adlar"]) > 1 or len(kay["kimlikler"]) > 1:
                bozuk.add(kay["isim"])
            ad_kimlik[kay["isim"]] |= kay["kimlikler"]
        out = {}
        for no in adaylar:
            kay = self.kayitlar[no]
            ad = kay["isim"]
            kim = next(iter(kay["kimlikler"])) if kay["kimlikler"] else None  # aynı dosya no'nun kimlikli satırı (kimliksiz satırları da bu kişiye)
            tek = next(iter(ad_kimlik[ad])) if len(ad_kimlik[ad]) == 1 else None
            if ad in bozuk:
                out[no] = None
                continue
            if self.mut == 28:
                kk = kim or tek
                out[no] = ("kimlik", kk) if kk else ("ad", ad)  # D1 davranışı: kimlik farklı adları birleştirir
            elif self.mut == 29:
                out[no] = ("ad", ad)
            elif kim:
                out[no] = ("ad", ad, kim)
            elif tek and self.mut != 30:
                out[no] = ("ad", ad, tek)  # adın tek kimliği
            elif len(ad_kimlik[ad]) > 1 and self.mut == 32:
                out[no] = ("ad", ad, sorted(ad_kimlik[ad])[0])
            else:
                tel = self.telefonla_ayrilan(no)
                # Y2 yorumu [YAYGIN]: kimliksiz aynı adlı satırlar dolu ve FARKLI telefonla ayırt ediliyorsa ayrı kişidir (Y2 telefonu geçerli TCKN/VKN gibi ayırt edici sayar;
                # C3 yalnız kimliği söyler) — bu kişilerin borç / grup / tahsilat denetimleri YAYGIN etiketlidir
                out[no] = ("ad", ad, None, tel) if tel and self.mut != 56 else ("ad", ad, None)  # adın kimliksiz grubu
        return out

    def telefonla_ayrilan(self, no):
        """Y2 yorumu: kaydın tek telefonu — yalnız adı paylaşan kimliksiz kayıtların HEPSİ dolu ve birbirinden farklı tek telefon taşıyorsa (yoksa None)."""
        kay = self.kayitlar[no]
        esler = [n for n, x in self.kayitlar.items() if x["isim"] == kay["isim"] and not x["kimlikler"] and self.cari_bul_kayit(n) is None and x["tur"] != "taksit"]
        if len(esler) < 2:
            return None
        tels = [self.kayitlar[n].get("telefonlar") or set() for n in esler]
        if any(len(t) != 1 for t in tels):
            return None
        duz = [next(iter(t)) for t in tels]
        return next(iter(kay["telefonlar"])) if len(set(duz)) == len(duz) else None

    def ad_cok_kimlikli(self, ad):
        """C3: adı paylaşan birden çok kimlikli kişi var mı (etikette kimlik beklenir)."""
        return len({k for no, kay in self.kayitlar.items() if kay["isim"] == ad and self.cari_bul_kayit(no) is None for k in kay["kimlikler"]}) > 1

    def donem_kolonlari(self, sk):
        """TAKVİM KALEMİ: sekmenin dönem / taksit tutarı kolonları (para kolonu + başlığında dönem kelimesi)."""
        out = []
        for h in sk["basliklar"] or []:
            if tr_kucuk(h) in KIMLIK_BASLIK or any(x in KISI_OZNITELIK_KELIME for x in kelimeler(h)):
                continue
            if sutun_sinifi(h, [c.get(h) for _, c in sk["satirlar"]]) not in ("tutar", "toplam"):
                continue
            if any(x.startswith(DONEM_KELIME) for x in kelimeler(h)):
                out.append(h)
        return out

    def kalem_tutari(self, sk, hucre):
        """TAKVİM KALEMİ (baş mimar kararı 23.10.2026): Tahsilat Takvimi / zil / Vade Takip / Nakit Akışı'ndaki vade kaleminin tutarı o vadede ödenmesi gereken tutardır:
        dönem / taksit tutarı kolonu varsa min(dönem tutarı, satırın Kalan Borç'u); Kalan boşsa (ya da Kalan kolonu yoksa) dönem tutarı; dönem kolonu yoksa satır borcu.
        Dönüş: kuruş, {"catal": [...]} ya da None (tanımsız: birden çok dönem kolonu)."""
        b = self.satir_borcu(sk, hucre)
        if b is None:
            return None
        if self.kalem_yok(sk, hucre) and self.mut != 60:
            return 0  # Z2: Kalan Borç 0 ya da eksi → vade kalemi YOK (Takvim / Vade Takip / Nakit Akışı'nda görünmez, gecikmiş sayılmaz)
        # Z3 (karar sahibi 23.10.2026): ödeme sözü kalemi SÖZ TUTARIdır (satırda Taksit Tutarı da olsa); söz tutarı hücresi boşsa önceki kural
        soz_kol = [h for h in sk["basliklar"] if tr_kucuk(h) not in KIMLIK_BASLIK and sutun_sinifi(h, [c.get(h) for _, c in sk["satirlar"]]) == "soz"]
        if len(soz_kol) == 1 and self.mut != 61:
            sv = hucre_kurus(hucre.get(soz_kol[0]))
            if sv is not None:
                return sv
        satir = 0 if b in (YOK, NOT) else b
        donem = self.donem_kolonlari(sk) if self.mut != 57 else []
        if not donem:
            return satir
        if len(donem) > 1:
            return None
        d = hucre_kurus(hucre.get(donem[0]))
        if d is None:
            return satir
        kalan_kol = [h for h in sk["basliklar"] if tr_kucuk(h) not in KIMLIK_BASLIK and sutun_sinifi(h, [c.get(h) for _, c in sk["satirlar"]]) == "kalan"]
        k = hucre_kurus(hucre.get(kalan_kol[0])) if len(kalan_kol) == 1 else None
        v = d if k is None or self.mut == 58 else min(d, k)
        # Karar sahibi (23.10.2026, çatal kararı): Y3'ün iki adaylı satırında (Aidat + Gecikme Faizi, Kalan boş) TAKVİM KALEMİ geçerli — kalem dönem tutarı (Aidat);
        # Y3'ün "ana tutar belirlenemez → not, borç yok" kuralı yalnız SATIR BORCU içindir (Tablodaki Kişiler, Açılış Bakiyesi)
        return v

    def vade_tarihli(self, sk, hucre):
        """SÖZLEŞME TARİHİ (karar sahibi 23.10.2026): satırın vade kalemi açan tarih hücresi dolu mu. Tarih kolonu = dolu değerlerinin hepsi tarih; "Sözleşme Tarihi" vade / son
        ödeme / söz tarihi DEĞİLDİR (sözleşmenin başlangıç tarihi) — vade kalemi açmaz (mutant 63: açar)."""
        for h in sk["basliklar"] or []:
            if "sözleşme" in kelimeler(h) and self.mut != 63:
                continue
            dolu = [str(c.get(h) or "").strip() for _, c in sk["satirlar"] if str(c.get(h) or "").strip()]
            if dolu and all(tarih_mi(x) for x in dolu) and str(hucre.get(h) or "").strip():
                return True
        return False

    def kalem_yok(self, sk, hucre):
        """Z2 (karar sahibi 23.10.2026): Kalan Borç hücresi SAYI ve 0 ya da eksi (fazla ödeme) olan satırda vade kalemi yoktur (min(dönem tutarı, Kalan) ≤ 0)."""
        kalan_kol = [h for h in sk["basliklar"] or [] if tr_kucuk(h) not in KIMLIK_BASLIK and sutun_sinifi(h, [c.get(h) for _, c in sk["satirlar"]]) == "kalan"]
        if len(kalan_kol) != 1:
            return False
        try:
            k = hucre_kurus(hucre.get(kalan_kol[0]))
        except (ValueError, TypeError):
            return False
        return k is not None and k <= 0

    def kalem_toplami(self):
        """K4 Takvim / Vade Takip / Nakit Akışı toplamı: tablodaki bütün satırların vade kalemi tutarları; ÇATAL'lı satırda olası toplamlar; tanımsız satır → None."""
        toplamlar = {0}
        for sk in self.sekmeler:
            if sk["basliklar"] is None:
                return None
            for no, c in sk["satirlar"]:
                if not self.vade_tarihli(sk, c):
                    continue  # vade tarihi olmayan satırın kalemi yok (Sözleşme Tarihi vade değil)
                v = self.kalem_tutari(sk, c)
                if v is None:
                    return None
                secenek = v["catal"] if isinstance(v, dict) else [v]
                toplamlar = {t + x for t in toplamlar for x in secenek}
        return sorted(toplamlar)

    def tablo_borcu(self, no):
        """/2 B3 (K1–K3): dosya no'nun Tablodaki Kişiler borcu (kuruş) ya da None (tanımsız → denetlenmez).
        K1 aynı sekmede aynı dosya no'lu satırlar ayrı borçtur (toplanır). K2 ([KULLANICI] 23.10.2026 04:09 UTC, 5 dk yetkisiyle; 03:12'deki "farklı sekmede tek
        kayıt, bir kez" kuralının YERİNE — dönem sekmelerinin vade kalemleri Takvim'de düşüyordu): FARKLI SEKMEDE aynı dosya no da AYRI borç ve ayrı vade kalemidir
        (2.4.3 gibi) → bütün sekmelerin satır borçları toplanır (yalnız sözü olan sekme borç katmaz). Tahsilat bir kez (5c) değişmez."""
        adaylar, notlu = [], False
        for sk in self.sekmeler:
            satirlar = [c for n, c in sk["satirlar"] if n == no]
            if not satirlar:
                continue
            if sk["basliklar"] is None:
                return None  # taksit sekmesi: kart/taksit sütunlarının borç kuralı bu kâhinde yok
            if self.mut == 23:
                satirlar = satirlar[:1]
            vs = [self.satir_borcu(sk, c) for c in satirlar]
            if any(v is None for v in vs):
                return None
            if all(v == YOK for v in vs):
                continue
            if all(v in (YOK, NOT) for v in vs):
                notlu = True
                continue
            if any(v == NOT for v in vs):
                return None  # aynı sekmede aynı dosya no'nun hem borçlu hem notlu satırı — kural tanımsız
            adaylar.append(sum(v for v in vs if v != YOK))
        if notlu:
            return NOT if not adaylar else None  # Y1/Y3: borçsuz + not; başka sekmede borcu da olan dosya no — kural tanımsız
        if not adaylar:
            return 0
        if self.mut == 18:
            return adaylar[0]
        return sum(adaylar)

    def cok_sekme_sayisi(self):
        """K2 notu ("N dosya no birden çok sekmede; ayrı sayıldı"): birden çok sekmede geçen dosya no sayısı — ÇATAL (bütün sekmeler / yalnız borç kaynağı
        sekmeler; yalnız sözü olan sekmenin sayılıp sayılmadığı metinde yok)."""
        hepsi, borclu = 0, 0
        for no in self.kayitlar:
            sek = [sk for sk in self.sekmeler if any(n == no for n, _ in sk["satirlar"])]
            if len(sek) > 1:
                hepsi += 1
            kaynak = [sk for sk in sek if sk["basliklar"] is None or any(self.satir_borcu(sk, c) not in (YOK, NOT) for n, c in sk["satirlar"] if n == no)]
            if len(kaynak) > 1:
                borclu += 1
        return sorted({hepsi, borclu})

    # ───────────────────────── işlemler
    def tablo_yukle(self, a):
        # KAYIT ANAHTARI SÜREKLİLİĞİ (baş mimar kararı 23.10.2026): "Yerine koy" ile yeniden yüklenen tabloda kayda bağlı tahsilat kayıttan kopmaz (kayitTahsilat
        # kayıt no'suyla kalır); sağlaması tutmayan Vergi No / TC değeri kayıt kimliği sayılmaz — değeri değişse ya da silinse de kayıt aynı kayıttır.
        if self.mut == 38:
            self.kayitTahsilat.clear()
        onceki_imza = {no: kay.get("ham_kimlik") for no, kay in getattr(self, "kayitlar", {}).items()}
        eski_satir = self.satir_listesi() if self.sekmeler else None
        eski_sekme, eski_kayit = list(self.sekmeler), dict(self.kayitlar)
        self.kayitlar = {}
        self.sekmeler = []
        for sk in a["sekmeler"]:
            # /2 B3: sekmenin başlıkları ve hücreleri (koşucunun tabloMatrisi ile aynı düzen; kâhin hücre metninden okur)
            if sk["tur"] == "icra":
                bas = ["Dosya No", "Borçlu", "Telefon", "Alacak Tutarı", "Kalan"]
                satirlar = [(r["no"], {"Alacak Tutarı": r["alacak"], "Kalan": r["kalan"]}) for r in sk["kayitlar"]]
            elif sk["tur"] == "soz":
                bas = ["Dosya No", "Borçlu", "Söz Tarihi", "Söz Tutarı"]
                satirlar = [(r["no"], {"Söz Tarihi": r["tarih"], "Söz Tutarı": r["tutar"]}) for r in sk["kayitlar"]]
            elif sk["tur"] == "serbest":
                bas = list(sk.get("ilk") or ["Dosya No", "Borçlu"]) + list(sk["basliklar"])  # `ilk`: Fatura No + Müşteri ya da Dosya No'suz (yalnız Müşteri)
                satirlar = [(r["no"], dict(r.get("hucreler", {}))) for r in sk["kayitlar"]]
            else:
                bas, satirlar = None, [(r["no"], None) for r in sk["kayitlar"]]
            self.sekmeler.append({"ad": sk["ad"], "tur": sk["tur"], "basliklar": bas, "satirlar": satirlar, "adlar": [r["isim"] for r in sk["kayitlar"]],
                                  "dosyalar": [None if (sk.get("ilk") and len(sk["ilk"]) == 1) else r.get("dosya", r["no"]) for r in sk["kayitlar"]],
                                  "telefon": [str((r.get("hucreler") or {}).get("Telefon") or r.get("tel") or "").strip() for r in sk["kayitlar"]]})
            kimlik_sutun = [h for h in (sk.get("basliklar") or []) if tr_kucuk(h) in KISI_KIMLIK_BASLIK] if sk["tur"] == "serbest" else []
            for r in sk["kayitlar"]:
                no = r["no"]
                k = self.kayitlar.setdefault(no, {"sekmeler": [], "tur": sk["tur"], "isim": r["isim"], "items": [], "kalan": 0, "kimlikler": set(), "adlar": set(),
                                                  "kimliksiz_satir": False})
                if sk["ad"] not in k["sekmeler"]:
                    k["sekmeler"].append(sk["ad"])
                k["adlar"].add(r["isim"])
                tel_r = str((r.get("hucreler") or {}).get("Telefon") or r.get("tel") or "").strip()
                if tel_r:
                    k.setdefault("telefonlar", set()).add(tel_r)
                satir_kimlik = False
                k.setdefault("ham_kimlik", set()).update(str((r.get("hucreler") or {}).get(h) or "").strip() for h in kimlik_sutun)
                for h in kimlik_sutun:  # C3: satırın kimliği (boş hücre kimliksiz)
                    v = str((r.get("hucreler") or {}).get(h) or "").strip()
                    if v and (kimlik_gecerli(v) or self.mut == 33):  # C3 kararı: sağlama hanesi tutmayan değer kimlik sayılmaz
                        k["kimlikler"].add(v)
                        satir_kimlik = True
                if not satir_kimlik:
                    k["kimliksiz_satir"] = True
                if sk["tur"] == "taksit":
                    k["items"] = [(t, kurus(v)) for t, v in r["taksitler"]]
                    k["kalan"] = sum(v for _, v in k["items"])
        if self.mut == 39:  # geçersiz değer anahtara girseydi: ham kimlik değerleri değişen kaydın tahsilatı kopardı
            for no, kay in self.kayitlar.items():
                if onceki_imza.get(no) is not None and onceki_imza[no] != kay.get("ham_kimlik"):
                    self.kayitTahsilat[no] = 0
        if eski_satir is not None:
            self.bag_surekliligi(a, eski_satir, eski_sekme, eski_kayit)

    def satir_listesi(self):
        """BAĞ SÜREKLİLİĞİ: yüklü tablonun satırları — sekme, sıra (konum), ref (kâhinin kayıt no'su), ad, kişi değeri (ad; varsa telefon ya da geçerli TCKN/VKN), borç."""
        out = []
        for sk in self.sekmeler:
            kim_sutun = [h for h in (sk.get("basliklar") or []) if tr_kucuk(h) in KISI_KIMLIK_BASLIK]
            for i, (no, c) in enumerate(sk["satirlar"]):
                ad = sk.get("adlar", [None] * (i + 1))[i]
                tel = (sk.get("telefon") or [""] * (i + 1))[i]
                kim = next((str((c or {}).get(h) or "").strip() for h in kim_sutun if kimlik_gecerli(str((c or {}).get(h) or "").strip())), "")
                b = self.satir_borcu(sk, c) if sk["tur"] == "serbest" and sk["basliklar"] is not None else None
                # NETLEŞTİRME (1): içerik = tabloya yazılan bütün hücreler (Dosya No, ad, öbür hücreler; boş hücre yok sayılır)
                dosya = (sk.get("dosyalar") or [None] * (i + 1))[i]
                icerik = (dosya, ad, tuple(sorted((k, str(v).strip()) for k, v in (c or {}).items() if str(v).strip())))
                out.append({"sekme": sk["ad"], "sira": i, "ref": no, "ad": ad, "kd": (ad, (kim if self.mut == 56 else tel or kim) or None), "borc": b, "icerik": icerik, "dosya": dosya, "kimlik": kim or None})
        return out

    def bag_surekliligi(self, a, eski, eski_sekme, eski_kayit):
        """TABLO BAĞ SÜREKLİLİĞİ (baş mimar kararı 23.10.2026): (1) Yerine koy / Devamı olarak ekle / Sheets eşitlemesi kayda bağlı veriyi (kayıt tahsilatı, not, düzeltme,
        "Ödendi say", cari bağı) SESSİZCE koparmaz. (2) Güvenli eşleşme varsa bağ yeni satıra taşınır: eski ve yeni satır aynı kişi değerini taşır ve o kişi değeri eski ve
        yeni tabloda TEK satırdadır — ya da AYNI KONUMDAKİ satır aynı kişi değerini taşır; tutar/vade değişse, kolon eklense, sıra değişse de bağ aynı kişide kalır. (3) Güvenli
        eşleşme yoksa önizlemede eşleşmeyen kayıtları ADIYLA söyleyen uyarı ve ONAY; eşleşmeyen bağlı veri silinmez (yeri kuralda yok → o adın denetimi yapılmaz). (4) Devamı
        olarak ekle mevcut kayıtlarla aynı kişi + aynı tutar görünen satırları önizlemede söyler ve onay ister. Denetimler `adim:<id>:onay`, `adim:<id>:uyariAdlari`."""
        if a.get("mod") == "devam":
            # NETLEŞTİRME 2 (karar sahibi 23.10.2026): Devamı olarak ekle'de (a) içeriği tamamen aynı satır mevcut kaydın KENDİSİdir; (b) GÜVENLİ EŞLEŞEN satır (aynı kişi
            # değeri + iki tabloda tek satır, ya da aynı konum + aynı kişi) mevcut kaydın GÜNCELLEMESİdir — ikinci kez eklenmez, bağları kendisinde, uyarı/onay yok; (c) "aynı
            # görünen satır" uyarısı + onay yalnız güvenli eşleşmeyen VE ikinci kez eklenecek (yeni kayıt açılacak) aynı kişi + aynı tutar satırı için; yeni kayıt açılır.
            yeni = self.satir_listesi()
            esles = {}  # yeni satırın ref'i → mevcut kaydın ref'i (aynı içerik ya da güncelleme)
            for y in yeni:
                if self.mut != 45 and any(e["icerik"] == y["icerik"] for e in eski):
                    esles[y["ref"]] = next(e for e in eski if e["icerik"] == y["icerik"])["ref"]
                    continue
                if self.mut == 46:
                    continue
                ae = [e for e in eski if e["kd"] == y["kd"]]
                ay = [z for z in yeni if z["kd"] == y["kd"]]
                if len(ae) == 1 and len(ay) == 1:
                    esles[y["ref"]] = ae[0]["ref"]
                    continue
                # Karar (Mete Er, 23.10.2026): "aynı konum + aynı kişi" YALNIZ o kişi değeri sekmede iki tabloda da AYNI SAYIDA satırdayken geçerli; eklenen dosyada (ya da
                # mevcut tabloda) sayı farklıysa eşleşme belirsiz → güvenli değil → yeni kayıt (+ aynı görünen uyarısı)
                konum = next((e for e in eski if e["sekme"] == y["sekme"] and e["sira"] == y["sira"]), None)
                if (self.mut == 42 and konum and konum["kd"] == y["kd"] and konum["ref"] not in esles.values()
                        and sum(1 for e in eski if e["sekme"] == y["sekme"] and e["kd"] == y["kd"]) == sum(1 for z in yeni if z["sekme"] == y["sekme"] and z["kd"] == y["kd"])):
                    esles[y["ref"]] = konum["ref"]  # N3: konum eşleşmesi tekil kişi değerinin içinde — ayrı kural yalnız mutant 42
            # güncelleme: mevcut kaydın satırı yeni satırın hücrelerini alır (borç yeni satırdan); yeni satır sekmeden çıkar, yeni kayıt açılmaz
            yeni_hucre = {}
            for sk in self.sekmeler:
                for no, c in sk["satirlar"]:
                    if no in esles:
                        yeni_hucre[esles[no]] = c
            for sk in eski_sekme:
                sk["satirlar"] = [(no, yeni_hucre.get(no, c)) for no, c in sk["satirlar"]]
            for sk in self.sekmeler:
                tut = [i for i, (no, _) in enumerate(sk["satirlar"]) if no not in esles]
                for alan in ("satirlar", "adlar", "telefon", "dosyalar"):
                    if alan in sk:
                        sk[alan] = [sk[alan][i] for i in tut]
            for no in esles:
                self.kayitlar.pop(no, None)
            eklenen = [y for y in yeni if y["ref"] not in esles]
            self.sekmeler = eski_sekme + self.sekmeler
            birlesik = dict(eski_kayit)
            for no, kay in self.kayitlar.items():
                if no in birlesik:
                    birlesik[no]["sekmeler"] = list(dict.fromkeys(birlesik[no]["sekmeler"] + kay["sekmeler"]))
                else:
                    birlesik[no] = kay
            self.kayitlar = birlesik
            cift = sorted({y["ad"] for y in eklenen if y["borc"] is not None and any(e["kd"] == y["kd"] and e["borc"] == y["borc"] for e in eski)})
            if self.mut == 43:
                cift = []
            self.d("adim:%s:onay" % a["id"], bool(cift), "KULLANICI", "bağ sürekliliği (4) + NETLEŞTİRME 2: yalnız ikinci kez eklenecek aynı kişi + aynı tutar satırında onay")
            self.d("adim:%s:uyariAdlari" % a["id"], cift, "KULLANICI", "bağ sürekliliği (4) + NETLEŞTİRME 2: önizleme ikinci kez eklenecek aynı görünen satırları adıyla söyler")
            return
        yeni = self.satir_listesi()
        dosyali_sekme = {y["sekme"] for y in yeni if y["dosya"] is not None}
        tutanlar = sorted({no for no, v in self.kayitTahsilat.items() if v} | {c["kayit"] for c in self.cariler.values() if c.get("kayit")})
        eslesmeyen = []
        for h in tutanlar:
            er = next((e for e in eski if e["ref"] == h), None)
            if er is None:
                continue  # tablo dışı kayıt (ör. taksit kartı anahtarı) — bu kuralın konusu değil
            hedef = None
            if er["dosya"] is not None and er["sekme"] in dosyali_sekme and self.mut != 49:
                # N1 (kullanıcı kararı A, 23.10.2026): Dosya No'lu tabloda her kayıt KENDİ dosya numarasıyla tanınır — bağ yalnız aynı dosya numarasında kalır; numarası
                # değişen kaydın bağı yeni dosyaya TAŞINMAZ, eski dosyada kalır (Yerine Koy onayı adıyla söyler). Kişi eşleşmesi yalnız Dosya No'suz tabloda. [YAYGIN yorum]
                # Dosya No kolonu yeni tabloda HİÇ yoksa eski kural (kişi eşleşmesi) — karar bu durumu söylemiyor.
                ayni_dosya = {y["ref"] for y in yeni if y["dosya"] == er["dosya"]}
                if len(ayni_dosya) == 1:
                    hedef = next(iter(ayni_dosya))
                if hedef is None:
                    eslesmeyen.append(er["ad"])
                    self.kayip_dosya[("dosya", er["dosya"])] = self.kayip_dosya.get(("dosya", er["dosya"]), 0) + self.kayitTahsilat.pop(h, 0)
                    for c in self.cariler.values():
                        if c.get("kayit") == h:
                            c["kayit"] = None
                    continue
                if hedef != h:
                    self.kayitTahsilat[hedef] += self.kayitTahsilat.pop(h, 0)
                for c in self.cariler.values():
                    if c.get("kayit") == h:
                        c["kayit"] = hedef
                continue
            ayni_icerik = [y for y in yeni if y["icerik"] == er["icerik"]] if self.mut not in (40, 44) else []
            if ayni_icerik:
                # NETLEŞTİRME (1): içeriği tamamen aynı satır mevcut kaydın kendisidir (yalnız yeri değişse de) — bağ yerinde, onay yok
                hedef = next((y for y in ayni_icerik if y["sekme"] == er["sekme"] and y["sira"] == er["sira"]), ayni_icerik[0])["ref"]
            elif self.mut != 40:
                ayni_eski = [e for e in eski if e["kd"] == er["kd"]]
                ayni_yeni = [y for y in yeni if y["kd"] == er["kd"]]
                if len(ayni_eski) == 1 and len(ayni_yeni) == 1:
                    hedef = ayni_yeni[0]["ref"]
                elif self.mut == 42:
                    # N3 (karar sahibi 23.10.2026): "aynı konum + aynı kişi" YALNIZ kişi değeri sekmede eski ve yeni tabloda TEK satırken geçerli — bu da tekil kişi değeri
                    # kuralının içindedir; aynı adlı iki kişi yer değiştirip ikisinin tutarı da değişirse bağ HİÇBİR YERE taşınmaz (uyarı + onay). Mutant 42: eski "aynı sayıda" kuralı.
                    konum = next((y for y in yeni if y["sekme"] == er["sekme"] and y["sira"] == er["sira"]), None)
                    ayni_sayi = (sum(1 for e in eski if e["sekme"] == er["sekme"] and e["kd"] == er["kd"])
                                 == sum(1 for y in yeni if y["sekme"] == er["sekme"] and y["kd"] == er["kd"]))
                    if konum and konum["kd"] == er["kd"] and ayni_sayi:
                        hedef = konum["ref"]
            if hedef is not None:
                if hedef != h:
                    self.kayitTahsilat[hedef] += self.kayitTahsilat.pop(h, 0)
                for c in self.cariler.values():
                    if c.get("kayit") == h:
                        c["kayit"] = hedef
                continue
            eslesmeyen.append(er["ad"])
            kalan = self.kayitTahsilat.pop(h, 0)  # N3: eşleşmeyen bağ HİÇBİR satıra taşınmaz (silinmez ama tabloda kimsenin değildir) — kişinin raporunda görünmez
            if er["kimlik"] and kalan:
                # N1 (kimlik kolonlu tablo): kayıt kendi geçerli kimliğiyle tanınır — kimliği değişen kaydın bağı eskide kalır, aynı kimlik geri gelirse yeniden görünür
                self.kayip_dosya[("kimlik", er["kimlik"])] = self.kayip_dosya.get(("kimlik", er["kimlik"]), 0) + kalan
            for c in self.cariler.values():
                if c.get("kayit") == h:
                    c["kayit"] = None
        # N1: tablodan kalkmış Dosya No (kimlik kolonlu tabloda geçerli kimlik) geri geldiyse bağı yeniden görünür (mutant 50: görünmez). Eski satırların bağları
        # yukarıda yerleştikten SONRA eklenir: geri dönen bağ yeni satırındır, eski tablonun o satırı gibi yeniden eşlenmez.
        for (tur, deger), tutar in list(self.kayip_dosya.items()):
            y = next((y for y in yeni if y[tur] == deger), None)
            if y is not None and self.mut != 50:
                self.kayitTahsilat[y["ref"]] += tutar
                del self.kayip_dosya[(tur, deger)]
        if self.mut == 40:
            eslesmeyen = []  # aday 16 davranışı: bağ sessizce kopar
        adlar = sorted(set(eslesmeyen))
        self.bag_kopan_adlar |= set(adlar)
        if self.mut == 41:
            adlar = []
        self.d("adim:%s:onay" % a["id"], bool(adlar), "KULLANICI", "bağ sürekliliği (3) güvenli eşleşme yoksa onay; hepsi güvenliyse onaysız")
        self.d("adim:%s:uyariAdlari" % a["id"], adlar, "KULLANICI", "bağ sürekliliği (3) önizleme eşleşmeyen kayıtları adıyla söyler")

    # ───────────────────────── /3 K6.1: Vade Tarihi / Beklenen Ödeme Tarihi doğrulaması
    @staticmethod
    def tarih_gecerli(v):
        """K6.1 biçim: YYYY-AA-GG ve gerçek bir gün."""
        import datetime
        import re
        if not isinstance(v, str) or not re.fullmatch(r"\d{4}-\d{2}-\d{2}", v):
            return False
        try:
            datetime.date.fromisoformat(v)
        except ValueError:
            return False
        return True

    def vade_hatasi(self, tarih, alanlar):
        """K6.1 [BAŞ MİMAR]: Vade Tarihi ya da Beklenen Ödeme Tarihi kaydın tarihinden ÖNCE olamaz → 400 (`field`); biçimsiz tarih → 400. Boş = yok.
        alanlar: [(değer, alan adı)]. Dönüş: hatalı alanın adı ya da None. Mutant 88: önce olabilir; 102: biçim denetlenmez."""
        for deger, alan in alanlar:
            if deger in (None, ""):
                continue
            if not self.tarih_gecerli(deger):
                if self.mut == 102:
                    continue
                return alan
            if deger < tarih and self.mut != 88:
                return alan
        # K6.5 [BAŞ MİMAR]: Beklenen Ödeme Tarihi Vade Tarihi'nden ÖNCE olabilir (erken ödeme sözü; Xero/Sage expected date serbest) — mutant 109: 400
        if self.mut == 109 and len(alanlar) == 2 and alanlar[0][0] and alanlar[1][0] and alanlar[1][0] < alanlar[0][0]:
            return alanlar[1][1]
        return None

    def _ret_400(self, a, alan, kod=None):
        self.d("adim:%s:http" % a["id"], 400, "BAŞ MİMAR", "K6.1 Vade / Beklenen Ödeme Tarihi kaydın tarihinden önce ya da biçimsiz → 400")
        if alan:
            self.d("adim:%s:alan" % a["id"], alan, "YAYGIN", "K6.1 400 yanıtının `field`'ı hatalı alanın adı (alanın değeri kararda yazılı değil — İNCELE)")
        if kod:
            self.d("adim:%s:kod" % a["id"], kod, "BAŞ MİMAR", "K6.5 açılış satırı yokken açılış vadesi → 400 opening-missing")
        return ("ret", "BAŞ MİMAR")

    def cari_ac(self, a):
        tarih = a.get("tarih", self.bugun)
        if self.v3 and a.get("acilis"):
            alan = self.vade_hatasi(tarih, [(a.get("acilisVade"), "openingDueDate"), (a.get("acilisBeklenen"), "openingExpectedDate")])
            if alan:
                return self._ret_400(a, alan)
        elif self.v3 and (a.get("acilisVade") or a.get("acilisBeklenen")) and self.mut != 110:
            return self._ret_400(a, None, kod="opening-missing")  # K6.5 [BAŞ MİMAR]: açılış satırı yoksa açılış vadesi → 400 opening-missing; cari açılmaz
        yon = a.get("acilisYon", "borc")
        self.cariler[a["ad"]] = {"tur": a.get("tur", "musteri"), "isim": a["isim"], "kayit": a.get("kayit"),
                                 "acilis": kurus(a["acilis"]) if a.get("acilis") else 0, "tckn": a.get("tckn"), "acilisYon": yon}
        if a.get("acilis"):
            self.hareketler["acilis:" + a["ad"]] = {"cari": a["ad"], "tur": "acilis", "yon": yon, "tutar": kurus(a["acilis"]), "tarih": tarih, "seq": self.yeni_seq(),
                                                     "vade": a.get("acilisVade") or "", "beklenen": a.get("acilisBeklenen") or "", "aktif": True}
            if yon == "alacak":
                self.mizanBilinir = False  # alacak yönlü açılışın TDHP karşılığı bu kâhinde yok
        return "ok"

    # ───────────────────────── /2 B5: Nihai Tüketici carisi (U1)
    NT_AD = "Nihai Tüketici"
    NT_KIMLIK = "11111111111"

    def nt_uygun(self, ad):
        c = self.cariler.get(ad)
        return bool(c) and not c.get("silindi") and c.get("tckn") == self.NT_KIMLIK and c["isim"] == self.NT_AD

    def nihai_tuketici(self, a):
        """U1 ([KULLANICI] 22.10 21:41 UTC (b): "kendi işaretli carisi, adı belli caride 11111111111 uyarısı"; [AJAN] U1 metni): yalnız programın işaretli
        carisi kullanılır — silinmemiş, TCKN 11111111111, adı "Nihai Tüketici". İşaretli yoksa (ya da koşulu yitirdiyse) bu koşulları taşıyan EN ESKİ cari
        benimsenir, o da yoksa yeni açılır. Adı belli 11111111111'li cari ASLA seçilmez."""
        et = "KULLANICI"
        if self.nt_isaretli and (self.nt_uygun(self.nt_isaretli) or self.mut == 21):
            secilen, yeni = self.nt_isaretli, False
        else:
            if self.nt_isaretli:
                et = "AJAN"  # işaretlinin koşulu yitirmesi (ad/kimlik değişti, silindi) — ayrıntı [AJAN]
            if self.mut == 20:
                aday = [ad for ad, c in self.cariler.items() if not c.get("silindi") and c.get("tckn") == self.NT_KIMLIK]
            else:
                aday = [ad for ad in self.cariler if self.nt_uygun(ad)]
            if aday:
                secilen, yeni = aday[0], False
                et = "AJAN"  # en eskiyi benimseme [AJAN]
            else:
                self.nt_sayac += 1
                secilen, yeni = "@nt%d" % self.nt_sayac, True
                self.cariler[secilen] = {"tur": "musteri", "isim": self.NT_AD, "kayit": None, "acilis": 0, "tckn": self.NT_KIMLIK, "nt": True}
        self.nt_isaretli = secilen
        self.d("adim:%s:secilen" % a["id"], secilen, et, "B5 U1 Nihai Tüketici yalnız işaretli/uygun cari")
        self.d("adim:%s:olusturuldu" % a["id"], yeni, et, "B5 U1 uygun cari yoksa yeni açılır")
        return "ok"

    def kullanici_ac(self, a):
        """/2 B5b: Kasa'yı görme yetkisi kaldırılmış kullanıcı (rol + kaldırılan yetkiler)."""
        self.kullanicilar[a["ad"]] = {"rol": a.get("rol", "avukat"), "kaldir": a.get("kaldir", ["cash.view"])}
        return "ok"

    def cari_sil(self, a):
        if a["cari"] not in self.cariler:
            return ("ret", "YAYGIN")  # (yalnız mutasyonlu dünyada: cari hiç açılmadı)
        self.cariler[a["cari"]]["silindi"] = True
        return "ok"

    def cari_adlandir(self, a):
        if a["cari"] not in self.cariler:
            return ("ret", "YAYGIN")
        self.cariler[a["cari"]]["isim"] = a["isim"]
        if "tckn" in a:
            self.cariler[a["cari"]]["tckn"] = a["tckn"]
        return "ok"

    def tahsilat(self, a):
        f = a.get("fatura")
        nakit = a.get("yol", "nakit") != "havale"
        self.tahsilatlar[a["id"]] = {"cari": a["cari"], "tutar": kurus(a["tutar"]), "tarih": a.get("tarih", self.bugun),
                                     "seq": self.yeni_seq(), "fatura": f, "kart": None, "aktif": True, "nakit": nakit}
        # /3: hareket kaydı (silme / geri yükleme; K6.1 tahsilat Vade alanı taşımaz — gönderilirse kaydedilmez)
        self.hareketler[a["id"]] = {"cari": a["cari"], "tur": "tahsilat", "ref": self.tahsilatlar[a["id"]], "aktif": True,
                                    "gonderilen": bool(a.get("vade") or a.get("beklenen"))}
        if not nakit:
            self.mizanBilinir = False  # havalenin karşı hesabı (banka alt hesabı) bu kâhinde yok
            return "ok"
        self.kasa += kurus(a["tutar"])
        self.kasa_hareket.append((a.get("tarih", self.bugun), kurus(a["tutar"]), 0, a["id"]))
        return "ok"

    def kasa_cikis(self, a):
        """/2 B4: carisiz elle Kasa çıkışı (Kasa gideri). [YAYGIN TDHP; defter kâhini ile aynı] B 770 / A 100."""
        x = kurus(a["tutar"])
        self.kasa -= x
        if self.mut != 22:
            self.kasa_hareket.append((a.get("tarih", self.bugun), 0, x, None))
        self.kasa_gider = getattr(self, "kasa_gider", 0) + x
        return "ok"

    def borc(self, a, tur="borc"):
        """Elle Borç (kind debt) / /3 elle Alacak (kind credit) — K6.1 Vade Tarihi (`vade`) ve Beklenen Ödeme Tarihi (`beklenen`), isteğe bağlı."""
        t = a.get("tarih", self.bugun)
        if self.v3:
            alan = self.vade_hatasi(t, [(a.get("vade"), "dueDate"), (a.get("beklenen"), "expectedDate")])
            if alan:
                return self._ret_400(a, alan)
        if tur == "borc":
            self.borclar[a["cari"]] += kurus(a["tutar"])
        self.hareketler[a["id"]] = {"cari": a["cari"], "tur": tur, "yon": tur, "tutar": kurus(a["tutar"]), "tarih": t, "seq": self.yeni_seq(),
                                    "vade": a.get("vade") or "", "beklenen": a.get("beklenen") or "", "aktif": True}
        self.mizanBilinir = False  # elle borç dekontunun karşı hesabı planda yok
        return "ok"

    def alacak(self, a):
        return self.borc(a, tur="alacak")

    def odeme(self, a):
        """/3: cariye ödeme (kind out, nakit) — borç tarafında bağlı (fatura) ya da bağsız (S1)."""
        x = kurus(a["tutar"])
        t = a.get("tarih", self.bugun)
        self.odemeler[a["id"]] = {"cari": a["cari"], "tutar": x, "tarih": t, "seq": self.yeni_seq(), "fatura": a.get("fatura"), "aktif": True}
        self.hareketler[a["id"]] = {"cari": a["cari"], "tur": "odeme", "ref": self.odemeler[a["id"]], "aktif": True, "gonderilen": bool(a.get("vade") or a.get("beklenen"))}
        self.kasa -= x
        self.kasa_hareket.append((t, 0, x, a["id"]))
        self.mizanBilinir = False  # ödemenin TDHP karşılığı (B 320 / A 100) bu kâhinde denetlenmez
        return "ok"

    def _hareket_ref(self, h):
        return h.get("ref")

    def hareket_sil(self, a):
        """/3: carideki hareketi sil (Silinenler'e gider). Tahsilat/ödeme Kasa'dan düşer; elle kayıt kuyruktan çıkar."""
        h = self.hareketler.get(a["hareket"])
        if h is None or not h["aktif"] or h["tur"] == "acilis":
            return ("ret", "YAYGIN")
        h["aktif"] = False
        r = self._hareket_ref(h)
        if r is not None:
            r["aktif"] = False
            r["silindi"] = True
            if h["tur"] == "tahsilat" and r.get("nakit", True):
                self.kasa -= r["tutar"]
            elif h["tur"] == "odeme":
                self.kasa += r["tutar"]
            self.kasa_hareket = [x for x in self.kasa_hareket if x[3] != a["hareket"]]
        return "ok"

    def hareket_geri_yukle(self, a):
        """/3: Silinenler'den geri yükle — aynı tutar, tarih ve (K6.4) aynı Vade / Beklenen Ödeme Tarihi; kimlik aynı kalır (ORTAM yoklama)."""
        h = self.hareketler.get(a["hareket"])
        if h is None or h["aktif"]:
            return ("ret", "YAYGIN")
        h["aktif"] = True
        if self.mut == 104 and h["tur"] in ("borc", "alacak"):
            h["vade"], h["beklenen"] = "", ""
        r = self._hareket_ref(h)
        if r is not None:
            r["aktif"] = True
            r.pop("silindi", None)
            if h["tur"] == "tahsilat" and r.get("nakit", True):
                self.kasa += r["tutar"]
                self.kasa_hareket.append((r["tarih"], r["tutar"], 0, a["hareket"]))
            elif h["tur"] == "odeme":
                self.kasa -= r["tutar"]
                self.kasa_hareket.append((r["tarih"], 0, r["tutar"], a["hareket"]))
        return "ok"

    def hareket_duzenle(self, a):
        """/3 Düzenle (K6.4 taşır): adımda verilen alanlar değişir (tutar, tarih, vade, beklenen); verilmeyenler AYNEN kalır. Doğrulama K6.1 (yeni durum üzerinden)."""
        h = self.hareketler.get(a["hareket"])
        if h is None or not h["aktif"] or h["tur"] not in ("borc", "alacak"):
            return ("ret", "YAYGIN")
        kilit = getattr(self, "kilit", "")
        if kilit and (h["tarih"] <= kilit or a.get("tarih", "9999") <= kilit) and self.mut != 111:
            return ("ret", "BAŞ MİMAR")  # K6.5 [BAŞ MİMAR]: kapanmış dönemdeki kaydın vade alanları kilitli (hareket düzeltmesi kuralı) — ret, alanlar aynı
        yeni = dict(h)
        if "tutar" in a:
            yeni["tutar"] = kurus(a["tutar"])
        if "tarih" in a:
            yeni["tarih"] = a["tarih"]
        for alan in ("vade", "beklenen"):
            if alan in a:
                yeni[alan] = a[alan] or ""
            elif self.mut == 90:
                yeni[alan] = ""
        hata = self.vade_hatasi(yeni["tarih"], [(yeni["vade"], "dueDate"), (yeni["beklenen"], "expectedDate")]) if any(k in a for k in ("tarih", "vade", "beklenen")) else None
        if hata:
            return self._ret_400(a, hata)
        h.update(yeni)
        if h["tur"] == "borc":
            self.borclar[h["cari"]] += 0
        return "ok"

    def donem_kilitle(self, a):
        """/3 K6.5: dönem kilidi (PUT /api/admin/period-lock {lockedUntil}); boş tarih kilidi açar."""
        self.kilit = a.get("tarih") or ""
        return "ok"

    # ───────────────────────── /3 KS7: bağsız kapatıcılar (faturasız stok iadesi, değersiz alacak) ve şüpheli alacak
    def _kapatici(self, a, tur):
        self.kapaticilar[a["id"]] = {"cari": a["cari"], "tur": tur, "tutar": kurus(a["tutar"]), "tarih": a.get("tarih", self.bugun), "seq": self.yeni_seq(), "aktif": True}
        self.etiketCari[a["cari"]].add("ks7")
        self.mizanBilinir = False  # stok iadesi / değersiz alacak yevmiyesi (610 / 153 / 659 / 128) bu kâhinde denetlenmez
        return "ok"

    def stok_iade(self, a):
        """KS7 (a): faturasız stok Satış İadesi (müşteri carisinde alacak satırı; ödeme şekli Cari Hesap) — bağsız kapatıcı."""
        return self._kapatici(a, "stok_iade")

    def alis_iade(self, a):
        """KS7 (a) simetriği: AÇIK alış iadesi nedenli ('preturn') faturasız stok çıkışı (tedarikçide borç satırı) — borç tarafında bağsız ödeme. KS7.1: formda yolu yok
        (BİLİNEN SINIR) — kural modelde, senaryoda kullanılmaz."""
        return self._kapatici(a, "alis_iade")

    def stok_satis_hesap(self, a):
        """KS7.1 [BAŞ MİMAR]: stok formundan açık hesap çıkışı, iade nedeni YOK ("Stok satışı") — tedarikçiye de olsa carinin yükümlülüğü (borçlanır), ödeme değildir."""
        return self._kapatici(a, "stok_satis")

    def supheli_durum(self, cari):
        """PLAN §3.11b/2 (a)–(c) + 2.3.0-SUPHELI-KABUL K3/K7 (kâhin belgesi, kod yazılmadan; ders 40): carinin şüpheli kayıtlarının KALANI. Kayıt tarihinden SONRA (aynı gün
        dahil) gelen alacak satırı — serbest tahsilat, alınan evrak, elle Alacak (Alacak Yaz), iade faturası, satış iadesi, taksit tahsilatı — ÖNCE şüpheli tutardan düşer (en eski
        kayıttan); faturaya bağlı tahsilat (Kapatılacak Fatura, (b)) KENDİLİĞİNDEN normal cari hesaba işlenir (düşmez); kayıt tarihinden ÖNCE tarihli satır düşmez. Aynı gün sırası:
        al → değersiz (kendi kaydından) → alacak satırı. Değersiz Alacak Yaz kendi kaydından düşer. Kalan = alınan − düşen tahsilatlar − değersiz. Mutant 119: tahsilat düşmez;
        120: kayıttan önce tarihli satır da düşer; 121: faturaya bağlı tahsilat da düşer. Dönüş: kayıt adı → kalan (kuruş)."""
        olay = []
        for ad, sp in self.supheliler.items():
            if sp["cari"] == cari:
                olay.append((sp["tarih"], 0, sp["seq"], "al", ad, sp["tutar"]))
        for x in self.kapaticilar.values():
            if x["aktif"] and x["cari"] == cari and x["tur"] == "degersiz":
                olay.append((x["tarih"], 2, x["seq"], "deg", x["supheli"], x["tutar"]))
        alacak = []
        for t in self.tahsilatlar.values():
            if t["aktif"] and t["cari"] == cari and not (t["fatura"] and self.mut != 121):
                alacak.append((t["tarih"], t["seq"], t["tutar"]))
        for e in self.evraklar.values():
            if e["cari"] == cari and e["durum"] not in ("silindi", "karsiliksiz"):
                alacak.append((e["tarih"], e["seq"], e["tutar"]))
        for h in self.hareketler.values():
            if h["cari"] == cari and h["aktif"] and h["tur"] == "alacak":
                alacak.append((h["tarih"], h["seq"], h["tutar"]))
        for f in self.faturalar.values():
            if f["cari"] == cari and f["durum"] == "kesildi" and f["tur"] == "iade":
                alacak.append((f["tarih"], f["seq"], f["tutar"]))
        for x in self.kapaticilar.values():
            if x["aktif"] and x["cari"] == cari and x["tur"] == "stok_iade":
                alacak.append((x["tarih"], x["seq"], x["tutar"]))
        if self.mut != 119:
            for tarih, seq, tutar in alacak:
                olay.append(("0000-00-00" if self.mut == 120 else tarih, 3, seq, "alacak", None, tutar))
        kalan, sira = {}, []
        for _tarih, _sinif, _seq, tur, ad, tutar in sorted(olay, key=lambda o: (o[0], o[1], o[2])):
            if tur == "al":
                kalan.setdefault(ad, tutar)
                sira.append(ad)
            elif tur == "deg":
                kalan[ad] -= tutar
            else:
                hedefler = list(sira) if self.mut != 120 else [n for n in self.supheliler if self.supheliler[n]["cari"] == cari]
                for n in hedefler:
                    kalan.setdefault(n, self.supheliler[n]["tutar"])
                    d = min(kalan[n], tutar)
                    kalan[n] -= d
                    tutar -= d
                    if not tutar:
                        break
        for n, sp in self.supheliler.items():
            if sp["cari"] == cari:
                kalan.setdefault(n, sp["tutar"])
        return kalan

    def supheli_al(self, a):
        """KS7 (b) + PLAN §3.11b/2 + K1: Şüpheli Alacağa Al (B 128 / A 120) — cari bakiyesi DEĞİŞMEZ, kapatıcı DEĞİL. Tutar en çok carinin borç bakiyesi − zaten şüphelide olan."""
        if a["cari"] not in self.cariler:
            return ("ret", "PLAN")  # cari açılmadıysa (ör. açılışı reddedildi) kayıt yok — program 404; mutant koşularında da çökmeden ret
        acik = sum(v for v in self.supheli_durum(a["cari"]).values() if v > 0)
        if kurus(a["tutar"]) > self.bakiye(a["cari"]) - acik:
            return ("ret", "PLAN")
        self.supheliler[a["ad"]] = {"cari": a["cari"], "tutar": kurus(a["tutar"]), "tarih": a.get("tarih", self.bugun), "seq": self.yeni_seq()}
        self.mizanBilinir = False
        return "ok"

    def supheli_kalan(self, ad):
        sp = self.supheliler.get(ad)
        return None if sp is None else self.supheli_durum(sp["cari"]).get(ad, 0)

    def degersiz(self, a):
        """KS7 (b) + PLAN §3.11b/3 + K7: Değersiz Alacak Yaz — "cari bakiyesi o tutar kadar kapanır"; bağsız kapatıcı (en eskiden). Tutar ≤ kaydın KALAN şüpheli tutarı (girildiği
        andaki kalan: düşen tahsilatlardan sonra) — aşarsa ret `doubtful-writeoff-exceeds`; kalan 0 (tamamı tahsil / değersiz) → ret `doubtful-closed`; tarih kayıttan önce olamaz."""
        sp = self.supheliler.get(a["supheli"])
        if sp is None or a.get("tarih", self.bugun) < sp["tarih"]:
            return ("ret", "PLAN")
        kalan = self.supheli_kalan(a["supheli"])
        if kalan <= 0 or kurus(a["tutar"]) > kalan:
            kod = "doubtful-closed" if kalan <= 0 else "doubtful-writeoff-exceeds"
            self.d("adim:%s:kod" % a["id"], kod, "PLAN", "§3.11b/3 + K7: değersiz tutarı ≤ kalan şüpheli (kalan = alınan − şüpheliden düşen tahsilatlar − değersiz); kalan 0 → kayıt kapalı")
            return ("ret", "PLAN")
        r = self._kapatici(dict(a, cari=sp["cari"]), "degersiz")
        self.kapaticilar[a["id"]]["supheli"] = a["supheli"]
        return r

    def cari_kalem_odendi(self, a):
        """K6.3 [BAŞ MİMAR]: cari kaleminde "Ödendi Say" YOK — settle yalnız `due|` kalemini tanır; cari kalemi para kaydıyla kapanır → ret, kalem durur. Mutant 87."""
        if self.mut == 87:
            h = self.hareketler.get(a["hareket"])
            if h:
                h["odendiSay"] = True
            return "ok"
        return ("ret", "BAŞ MİMAR")

    def sunucu_yeniden(self, a):
        """/3: program kapanıp aynı veriyle yeniden açılır; anahtarlar (config.legacyCasePayments / legacyTableTransfer) adımdakiler (verilmeyen KAPALI)."""
        if self.kural != "2.4.4":
            self.anahtar = {"legacyCasePayments": False, "legacyTableTransfer": False, "legacyTableDues": False}
            self.anahtar.update({k: bool(v) for k, v in (a.get("anahtar") or {}).items()})
        return "ok"

    def yedek_al(self, a):
        """/3 K6.4: yerel yedek — o anki bütün durum."""
        import copy
        self.yedekler[a["ad"]] = copy.deepcopy({k: v for k, v in self.__dict__.items() if k not in ("s", "out", "belirsiz", "yedekler", "mut", "kural", "v3", "anahtar", "seq", "kullanicilar")})
        return "ok"

    def yedek_geri_yukle(self, a):
        """/3 K6.4: yedekten geri yükleme — durum yedekteki gibi; Vade / Beklenen Ödeme Tarihi taşınır (mutant 103: boş gelir)."""
        import copy
        y = copy.deepcopy(self.yedekler[a["yedek"]])
        self.__dict__.update(y)
        if self.mut == 103:
            for h in self.hareketler.values():
                if h["tur"] in ("acilis", "borc", "alacak"):
                    h["vade"], h["beklenen"] = "", ""
        return "ok"

    def kart_tahsilat(self, a):
        kt = self.kartlar.get(a["kayit"])
        if not kt or not kt["aktif"]:
            return ("ret", "YAYGIN")  # kartı olmayan kayda kart tahsilatı girilemez
        tid = a["id"]
        self.tahsilatlar[tid] = {"cari": kt["cari"], "tutar": kurus(a["tutar"]), "tarih": a.get("tarih", self.bugun), "seq": self.yeni_seq(),
                                 "fatura": None, "kart": a["kayit"], "aktif": True, "dogrudanKart": True}
        kt["tasinan"].append(self.tahsilatlar[tid])
        self.kasa += kurus(a["tutar"])
        self.kasa_hareket.append((a.get("tarih", self.bugun), kurus(a["tutar"]), 0, None))
        return "ok"

    def _k1_kapali(self, a, kod="case-payments-closed", ileti=True):
        """K1 [BAŞ MİMAR] (madde 1; kullanıcı KARAR ~21:35 UTC (1) "kayıt tahsilatı yeni giriş/düzeltme kapalı"): 410 + kod (+ ileti). Veri değişmez."""
        self.d("adim:%s:http" % a["id"], 410, "BAŞ MİMAR", "K1 kapı yanıtı 410")
        self.d("adim:%s:kod" % a["id"], kod, "BAŞ MİMAR", "K1 gövde `code`")
        if ileti:
            self.d("adim:%s:ileti" % a["id"], K1_ILETI, "BAŞ MİMAR", "K1 gövde `error` (Türkçe ileti)")
        return ("ret", "BAŞ MİMAR")

    def kayit_tahsilat(self, a):
        if not self.anahtar["legacyCasePayments"] and self.mut != 91:
            return self._k1_kapali(a)
        if self.sekmeler and a["kayit"] not in self.kayitlar and self.mut != 48:
            # N6 (karar sahibi 23.10.2026): tabloda artık olmayan (eski karttaki) kayda yazım reddedilir (409), sessizce kaybolmaz
            return ("ret", "KULLANICI")
        n = len(self.kayitlar.get(a["kayit"], {}).get("sekmeler", [])) if self.mut == 5 else 1
        self.kayitTahsilat[a["kayit"]] += kurus(a["tutar"]) * max(1, n)
        self.kasa += kurus(a["tutar"])
        if self.mut != 19:
            self.kasa_hareket.append((a.get("tarih", self.bugun), kurus(a["tutar"]), 0, a["id"]))
        self.kayitOdeme[a["id"]] = {"kayit": a["kayit"], "tutar": kurus(a["tutar"]), "tarih": a.get("tarih", self.bugun), "aktif": True}
        if not self.v3:
            self.mizanBilinir = False  # /1–/2: karşı hesap o kâhinde yoktu; /3: B 100 / A 602 (madde 1 "defterde (A 602)")
        return "ok"

    def kayit_tahsilat_duzenle(self, a):
        """K1: eski kayıt tahsilatının düzeltmesi (PUT /api/workspace/payments/:id) KAPALI — kullanıcı "düzeltme kapalı" + K1 kodu. Mutant 105: açık."""
        o = self.kayitOdeme.get(a["odeme"])
        if not self.anahtar["legacyCasePayments"] and self.mut != 105:
            return self._k1_kapali(a)
        if o is None or not o["aktif"]:
            return ("ret", "YAYGIN")
        fark = kurus(a["tutar"]) - o["tutar"]
        o["tutar"] += fark
        self.kayitTahsilat[o["kayit"]] += fark
        self.kasa += fark
        self.kasa_hareket = [(t, (o["tutar"] if r == a["odeme"] else g), c, r) for t, g, c, r in self.kasa_hareket]
        return "ok"

    def kayit_tahsilat_put(self, a):
        """K1 metni "POST ve PUT /api/workspace/cases/:key/payments kapalı": bu yolda düzeltme yazılmaz. [YAYGIN] yol programda hiç yoksa 405 (yoklama 2.4.4: 405) — ikisi de ret."""
        self.d("adim:%s:http" % a["id"], {"catal": [404, 405, 410]}, "BAŞ MİMAR", "KS1: PUT /cases/:key/payments 2.4.4'te yok — 405/404 kalabilir (410 da kapalı) — veri değişmez")
        return ("ret", "BAŞ MİMAR")

    def kayit_tahsilat_sil(self, a):
        """K1: DELETE AÇIK (eski veri düzeltilebilsin) — Kasa'dan ve defterden düşer, kaydın tahsilatı azalır. Mutant 92: kapalı."""
        o = self.kayitOdeme.get(a["odeme"])
        if o is None or not o["aktif"]:
            return ("ret", "YAYGIN")
        if self.mut == 92:
            return ("ret", "BAŞ MİMAR")
        o["aktif"] = False
        self.kayitTahsilat[o["kayit"]] -= o["tutar"]
        self.kasa -= o["tutar"]
        self.kasa_hareket = [x for x in self.kasa_hareket if x[3] != a["odeme"]]
        return "ok"

    def kayit_tahsilat_geri_yukle(self, a):
        """K1: Silinenler'den geri yükleme AÇIK — Kasa'ya ve defterine (A 602) aynen döner. Mutant 93: Kasa'ya dönmez."""
        o = self.kayitOdeme.get(a["odeme"])
        if o is None or o["aktif"]:
            return ("ret", "YAYGIN")
        o["aktif"] = True
        self.kayitTahsilat[o["kayit"]] += o["tutar"]
        if self.mut != 93:
            self.kasa += o["tutar"]
            self.kasa_hareket.append((o["tarih"], o["tutar"], 0, a["odeme"]))
        return "ok"

    def aktar(self, a):
        if not self.anahtar["legacyTableTransfer"] and self.mut != 94:
            # Madde 2 [BAŞ MİMAR K1 "aynı düzen"]: Tablodan Aktar yazım ucu 410 + code "table-transfer-closed"; kart açılmaz, tahsilat taşınmaz
            if a.get("araya"):
                self.tahsilat(dict(a["araya"], id=a["id"] + "-araya"))
            self._k1_kapali(a, kod="table-transfer-closed", ileti=False)
            self.d("adim:%s:durum" % a["id"], "ret", "BAŞ MİMAR", "madde 2 Tablodan Aktar kapalı")
            return None
        hesap_ici = a.get("hesapIci", True)
        mevcut_borc = a.get("mevcutBorc", True)
        if a.get("araya"):
            # ön izlemeden sonra cariye tahsilat girildi: aktarım reddedilir, hiçbir kart açılmaz [AJAN A9]
            ara = dict(a["araya"], id=a["id"] + "-araya")
            self.tahsilat(ara)
            self.d("adim:%s:durum" % a["id"], "ret", "AJAN", "B1.9")
            return None
        sonuc = {"olusan": 0, "tasinanAdet": 0, "tasinanTutar": 0, "kapsanan": 0, "atlanan": 0}
        ak = {"kartlar": []}
        for no in a["kayitlar"]:
            k = self.kayitlar[no]
            if no in self.kartlar and self.kartlar[no]["aktif"]:
                continue  # zaten kartı var ("exists")
            cari = self.cari_bul_kayit(no)
            if cari is None:  # bağlı cari yoksa aktarım cariyi açar (2.4.3 yolu)
                cari = "@" + no
                self.cariler[cari] = {"tur": "musteri", "isim": k["isim"], "kayit": no, "acilis": 0, "ortuk": a["ad"]}
            K = k["kalan"]
            faturali = self.faturali(cari)
            # 5a: taksit dışı tahsilatlar, tarih sırasıyla, bütün olarak, kartın kalanı kadar; sığmayanda durulur
            tasinan, parca = [], 0
            if hesap_ici and not faturali:
                toplam = 0
                for t in self.taksit_disi(cari):
                    if toplam + t["tutar"] <= K:
                        tasinan.append(t)
                        toplam += t["tutar"]
                        continue
                    if self.mut == 1 and toplam < K:
                        parca = K - toplam
                        toplam = K
                    if self.mut == 2:
                        continue
                    if any(x["tutar"] + toplam <= K for x in self.taksit_disi(cari) if x not in tasinan and x is not t):
                        self.etiketCari[cari].add("5a-sonraki-kucuk")
                    break
            tas_tutar = sum(t["tutar"] for t in tasinan) + parca
            # 5b: carinin borcu (taşınan tahsilatlar geri eklenerek) kalanı karşılıyorsa mevcut borç; azsa aktarılmaz
            mevcut = False
            if mevcut_borc and not faturali:
                D = self.bakiye(cari) + (0 if self.mut == 3 else tas_tutar)
                if (self.bakiye(cari) >= K) != (D >= K) or (0 < self.bakiye(cari) < K) != (0 < D < K):
                    self.etiketCari[cari].add("5b-D-tanimi")
                if D >= K:
                    mevcut = True
                elif D > 0 and self.mut != 4:
                    sonuc["atlanan"] += 1
                    continue
                elif D <= 0:
                    self.etiketCari[cari].add("5b-borc-yok")
            for t in tasinan:
                t["kart"] = no
            if parca:
                self.tahsilatlar["@parca-" + no] = {"cari": cari, "tutar": parca, "tarih": self.bugun, "seq": self.yeni_seq(),
                                                    "fatura": None, "kart": no, "aktif": True, "parcaKaynak": True}
                # parçalanan tahsilatın kendisi parçası kadar küçülür
                for t in self.taksit_disi(cari):
                    t["tutar"] -= parca
                    self.tahsilatlar["@parca-" + no]["tutar"] = parca
                    break
            if self.mut == 11:
                self.kasa -= tas_tutar
            self.kartlar[no] = {"cari": cari, "toplam": K, "mevcut": mevcut, "tasinan": [t for t in tasinan], "aktif": True,
                                "parca": parca}
            ak["kartlar"].append(no)
            sonuc["olusan"] += 1
            sonuc["tasinanAdet"] += len(tasinan) + (1 if parca else 0)
            sonuc["tasinanTutar"] += tas_tutar
            sonuc["kapsanan"] += 1 if mevcut else 0
            self.mizanBilinir = False
        self.aktarimlar[a["ad"]] = ak
        return sonuc

    def geri_al(self, a):
        if self.mut == 95:
            return ("ret", "KULLANICI")
        if a["aktar"] not in self.aktarimlar:
            return ("ret", "YAYGIN")  # aktarım hiç olmadı (kapı kapalıydı)
        for ad in [c for c, v in self.cariler.items() if v.get("ortuk") == a["aktar"]]:
            self.cariler[ad]["silindi"] = True  # aktarımın açtığı cari geri almayla kalkar [YAYGIN]
        for no in self.aktarimlar[a["aktar"]]["kartlar"]:
            k = self.kartlar[no]
            k["aktif"] = False
            for t in k["tasinan"]:
                t["kart"] = None
                if self.mut == 10:
                    t["aktif"] = False
            if k.get("parca"):
                self.tahsilatlar["@parca-" + no]["kart"] = None
        return "ok"

    def fatura(self, a):
        tur = a.get("tur", "satis")
        taslak = a.get("taslak", False)
        self.faturalar[a["ad"]] = {"cari": a["cari"], "tutar": kurus(a["tutar"]), "tarih": a.get("tarih", self.bugun),
                                   "seq": self.yeni_seq(), "tur": tur, "durum": "taslak" if taslak else "kesildi",
                                   "taksitli": bool(a.get("taksit")), "asil": a.get("asil")}
        if a.get("evrak"):
            e = a["evrak"]
            self.evraklar[e["ad"]] = {"cari": a["cari"], "tur": e.get("tur", "cek"), "tutar": kurus(e["tutar"]),
                                      "tarih": a.get("tarih", self.bugun), "seq": self.yeni_seq(), "fatura": a["ad"],
                                      "durum": "portfoy", "ciroCari": None, "kendi": True}
        return "ok"

    def iade(self, a):
        asil = self.faturalar[a["fatura"]]
        self.faturalar[a["ad"]] = {"cari": asil["cari"], "tutar": asil["tutar"], "tarih": a.get("tarih", self.bugun),
                                   "seq": self.yeni_seq(), "tur": "iade", "durum": "kesildi", "taksitli": False, "asil": a["fatura"]}
        self.etiketCari[asil["cari"]].add("iade")
        return "ok"

    def evrak_ret(self, a):
        """UX18: bağ kurulamayan durumlar (ret ve kod) ya da None."""
        f = a.get("fatura")
        if not f:
            return None
        if not a.get("cari"):
            return ("ret", 400, "AJAN")           # carisiz evrak faturaya bağlanmaz
        F = self.faturalar[f]
        if F["cari"] != a["cari"]:
            return ("ret", 404, "KULLANICI")      # başka cari
        if F["durum"] == "taslak" or F["durum"] == "iptal":
            return ("ret", 409, "AJAN")
        if F["tur"] != "satis":
            return ("ret", 409, "KULLANICI")      # ters yön / iade belgesi
        if F["taksitli"]:
            return ("ret", 409, "KULLANICI")      # taksitli faturaya bağ yok
        return None

    def evrak(self, a):
        ret = self.evrak_ret(a)
        if ret:
            self.d("adim:%s:http" % a["id"], ret[1], "AJAN", "B2.4")
            return ("ret", ret[2])
        f = a.get("fatura")
        if f and self.faturalar[f]["tutar"] < kurus(a["tutar"]):
            self.etiketCari[a["cari"]].add("ux18-fazla")
        self.evraklar[a["ad"]] = {"cari": a["cari"], "tur": a.get("tur", "cek"), "tutar": kurus(a["tutar"]),
                                  "tarih": a.get("tarih", self.bugun), "seq": self.yeni_seq(), "fatura": f,
                                  "durum": "portfoy", "ciroCari": None, "kendi": False}
        return "ok"

    def karsiliksiz(self, a):
        e = self.evraklar[a["evrak"]]
        if e["durum"] != "portfoy":
            return ("ret", "PLAN")
        e["durum"] = "karsiliksiz"
        if not e["fatura"] or self.faturalar[e["fatura"]]["durum"] != "kesildi":
            # bağsız evrakın en eski kapamayla kapattığı faturaların yeniden açılması kullanıcı kararında açıkça yok (karar: bağlı,
            # kendi evrakı, faturayla ciro); kâhin değişmez Σ açık = cari bakiye [AJAN] ile açar → İNCELE
            self.etiketCari[e["cari"]].add("bagsiz-karsiliksiz")
        return "ok"

    def tahsil(self, a):
        e = self.evraklar[a["evrak"]]
        if e["durum"] != "portfoy":
            return ("ret", "PLAN")
        e["durum"] = "tahsil"
        self.kasa += e["tutar"]
        if self.mut != 19:
            self.kasa_hareket.append((a.get("tarih", self.bugun), e["tutar"], 0, None))
        return "ok"

    def ciro(self, a):
        e = self.evraklar[a["evrak"]]
        if e["durum"] != "portfoy":
            return ("ret", "PLAN")
        e["durum"] = "ciro"
        e["ciroCari"] = a["cari"]
        return "ok"

    def evrak_sil(self, a):
        e = self.evraklar[a["evrak"]]
        e["silinmedenOnce"] = e["durum"]
        e["durum"] = "silindi"
        return "ok"

    def evrak_geri_yukle(self, a):
        e = self.evraklar[a["evrak"]]
        e["durum"] = e.pop("silinmedenOnce")
        self.etiketCari[e["cari"]].add("geri-yukle")
        return "ok"

    def bag_degistir(self, a):
        e = self.evraklar[a["evrak"]]
        yeni = a.get("fatura") or None
        if e["kendi"]:
            return ("ret", "YAYGIN")  # faturanın kendi (peşin) evrakı faturanın parçasıdır; bağı değiştirilemez
        if yeni:
            ret = self.evrak_ret({"fatura": yeni, "cari": e["cari"]})
            if ret:
                self.d("adim:%s:http" % a["id"], ret[1], "AJAN", "B2.4")
                return ("ret", ret[2])
        e["fatura"] = yeni
        self.etiketCari[e["cari"]].add("bag-degisti")
        return "ok"

    def fatura_iptal(self, a):
        f = self.faturalar[a["fatura"]]
        kendi = [e for e in self.evraklar.values() if e["kendi"] and e["fatura"] == a["fatura"] and e["durum"] != "silindi"]
        if any(e["durum"] != "portfoy" for e in kendi):
            return ("ret", "YAYGIN")  # faturayla alınan evrak işlem görmüşse önce o geri alınır
        for e in kendi:
            e["durum"] = "silindi"  # faturanın kendi evrakı faturayla birlikte kalkar [YAYGIN]
            self.etiketCari[f["cari"]].add("kendi-evrak-iptal")
        f["durum"] = "iptal"
        if any(e["fatura"] == a["fatura"] and e["durum"] != "silindi" for e in self.evraklar.values()):
            self.etiketCari[f["cari"]].add("iptal-bag-duser")
        return "ok"

    # ───────────────────────── /3 kontrol yardımcıları
    def elle_kuyrukta(self, cari, taraf):
        """S1: carinin o tarafının kuyruğunda elle kayıt (Borç/Alacak) ya da Açılış var mı."""
        for h in self.hareketler.values():
            if h["cari"] != cari or not h["aktif"]:
                continue
            if taraf == "borc" and (h["tur"] == "borc" or (h["tur"] == "acilis" and h["yon"] == "borc")):
                return True
            if taraf == "alacak" and (h["tur"] == "alacak" or (h["tur"] == "acilis" and h["yon"] == "alacak")):
                return True
        return False

    @staticmethod
    def _gun(iso):
        import datetime
        return datetime.date.fromisoformat(iso)

    def _iso_hucre(self, metin):
        t = str(metin or "").strip()
        if len(t) == 10 and t[2] == "." and t[5] == ".":
            return "%s-%s-%s" % (t[6:], t[3:5], t[:2])
        return t if tarih_mi(t) else None

    def kontrol_v3(self, a, k):
        """/3 madde 6 (K6.1–K6.4 + S1) denetimleri ve fatura/evrak takvim kalemleri."""
        import datetime
        bugun = self._gun(self.bugun)
        ufuk = (bugun + datetime.timedelta(days=UFUK_GUN)).isoformat()
        vt_ufuk = (bugun + datetime.timedelta(days=UFUK_GUN - 1)).isoformat()  # Vade Takip "open": ufkun kesin içi (sınır günü denetlenmez)
        proj_son = (bugun + datetime.timedelta(days=30)).isoformat()
        ajan_neden = {"ux18-fazla", "iptal-bag-duser", "geri-yukle", "bag-degisti", "iade", "kendi-evrak-iptal", "bagsiz-karsiliksiz"}
        kalan_cache = {}
        kalem_say, sayim_kesin, proj_mut = 0, True, 0
        for hn, h in self.hareketler.items():
            c = self.cariler.get(h["cari"])
            if not c or c.get("silindi"):
                continue
            if h["tur"] in ("tahsilat", "odeme"):
                if h["aktif"] and h.get("gonderilen"):
                    # K6.1: tahsilat/ödeme alan taşımaz — gönderilirse kaydedilmez (alan boş ya da yanıtta hiç yok)
                    for alan in ("vade", "beklenen"):
                        self.d("%s:hareket:%s:%s" % (k, hn, alan), "gönderildi" if self.mut == 89 else {"catal": ["", "alan yok"]}, "BAŞ MİMAR",
                               "K6.1 tahsilat/ödeme Vade / Beklenen Ödeme Tarihi taşımaz (gönderilirse kaydedilmez)")
                continue
            self.d("%s:hareket:%s:var" % (k, hn), bool(h["aktif"]), "BAŞ MİMAR", "K6.4 Silinenler / geri yükleme (kayıt kimliği aynı)")
            if not h["aktif"]:
                self.d("%s:takvim:hareket:%s" % (k, hn), "yok", "BAŞ MİMAR", "K6.3 silinen kayıt kalem değildir")
                continue
            kartlar_c = [kt for kt in self.kartlar.values() if kt["aktif"] and kt["cari"] == h["cari"]]
            kapsam, kart_odemeli = 0, False
            if kartlar_c:
                # K6.5 [BAŞ MİMAR] "Carinin Mevcut Borcu" kartı: Kalan kapsanan kısmı İÇERİR (defter kalanı — kartın ödemeleri de kapamada [YAYGIN PLAN §4.3/2 1b]);
                # takvim / Vade Takip tutarı = Kalan − kartın açık kapsamı (kapsanan borç kartın taksitleriyle bir kez). Tanımlı yalnız: kartların hepsi mevcut borç kartı,
                # carinin tek etkin elle kaydı / açılışı (borç yönlü), faturasız — öbür durumlar tanımsız (denetlenmez).
                tek = [x for x, y in self.hareketler.items() if y["cari"] == h["cari"] and y["aktif"] and y["tur"] in ("acilis", "borc", "alacak")]
                faturali = any(f["cari"] == h["cari"] and f["durum"] == "kesildi" for f in self.faturalar.values())
                if not (all(kt["mevcut"] for kt in kartlar_c) and len(tek) == 1 and not faturali and h["yon"] == "borc"):
                    sayim_kesin = False
                    continue
                odenen = [sum(t["tutar"] for t in kt["tasinan"]) + kt.get("parca", 0) for kt in kartlar_c]
                kapsam = sum(max(0, kt["toplam"] - o) for kt, o in zip(kartlar_c, odenen))
                kart_odemeli = any(odenen)
                kalan = max(0, h["tutar"] - sum(t["tutar"] for t in self.tahsilatlar.values() if t["aktif"] and t["cari"] == h["cari"]))
                if self.mut == 113:
                    kalan = max(0, kalan - kapsam)
            else:
                if h["cari"] not in kalan_cache:
                    kalan_cache[h["cari"]] = self.kalanlar(h["cari"])
                kalan = kalan_cache[h["cari"]].get(hn, h["tutar"])
            etkin = kalan if (self.mut == 112 or not kartlar_c) else max(0, kalan - kapsam)  # takvim / Vade Takip tutarı
            capraz = self.elle_kuyrukta(h["cari"], "borc") and self.elle_kuyrukta(h["cari"], "alacak")
            et = "AJAN" if self.etiketCari[h["cari"]] & ajan_neden else ("YAYGIN" if kart_odemeli else "BAŞ MİMAR")
            self.d("%s:hareket:%s:kalan" % (k, hn), kalan, et, "S1 FIFO: Kalan = tutar − en eskiden dağıtılan bağsız ödemeler (tek kuyruk, kayıt tarihi + yazım sırası)"
                   + (" · KS2: aynı caride iki taraf — elle Alacak karşı taraf yükümlülüğü, mahsup yok" if capraz else ""))
            self.d("%s:hareket:%s:vade" % (k, hn), h["vade"], "BAŞ MİMAR", "K6.2 hareketlerde Vade Tarihi (boş = yok)")
            self.d("%s:hareket:%s:beklenen" % (k, hn), h["beklenen"], "BAŞ MİMAR", "K6.2 hareketlerde Beklenen Ödeme Tarihi (boş = yok)")
            # K6.3 takvim / zil kalemi
            if self.mut == 81:
                tarih = h["vade"] or h["beklenen"]
            elif self.mut == 85:
                tarih = h["vade"]
            else:
                tarih = h["beklenen"] or h["vade"]
            acik_mi = etkin > 0 or self.mut == 84
            if tarih and etkin > 0 and tarih <= proj_son:
                proj_mut += 1
            # KS5 [BAŞ MİMAR]: ufuk geçmişin tamamı + bugün + 7 gün DAHİL (days <= 7); mutant 106: bugün+7 hariç
            if acik_mi and tarih and (tarih <= ufuk or self.mut == 83) and not (self.mut == 106 and tarih == ufuk) and not h.get("odendiSay"):
                yon = "in" if h["yon"] == "borc" else "out"
                etiket = ("Tahsil Edilecek Borç" if yon == "in" else "Ödenecek Borç") + (" (Ödeme Sözü)" if h["beklenen"] and self.mut != 82 else "")
                if self.mut == 100:
                    yon = "out" if yon == "in" else "in"
                gun = (self._gun(tarih) - bugun).days if self.tarih_gecerli(tarih) else 0  # biçimsiz tarih yalnız mutant 102 dünyasında
                kalem = {"amount": h["tutar"] if self.mut == 80 else etkin, "dueDate": tarih, "direction": yon, "label": etiket,
                         "state": "overdue" if gun < 0 else "today" if gun == 0 else "upcoming", "days": gun, "cari": h["cari"], "person": c["isim"]}
                kalem_say += 1
            else:
                kalem = "yok"
            et_k = "BAŞ MİMAR" if kartlar_c and et == "YAYGIN" else et  # K6.5: kart kapsamı düşülmüş tutar kartın ödemelerinden bağımsız (Σ = bakiye)
            self.d("%s:takvim:hareket:%s" % (k, hn), kalem, et_k, "K6.3 Kalan > 0 ve Vade / Beklenen Ödeme Tarihi'li elle kayıt kalemdir; tarih = Beklenen varsa o; tutar = Kalan"
                   + (" − Mevcut Borç kartının açık kapsamı (K6.5)" if kartlar_c else "") + "; ufuk geçmiş + 7 gün")
            if kalem != "yok" and tarih <= vt_ufuk:
                self.d("%s:vadeTakip:hareket:%s" % (k, hn), {"amount": kalem["amount"], "date": tarih, "direction": kalem["direction"]}, et_k,
                       "K6.3 Vade Takip (Anlık Durum) aynı kalemleri gösterir")
            elif kalem == "yok" and not (acik_mi and tarih):
                self.d("%s:vadeTakip:hareket:%s" % (k, hn), "yok", et_k, "K6.3 kalem olmayan kayıt Vade Takip'te yok")
        if sayim_kesin:
            self.d("%s:takvim:cariKalemSayisi" % k, kalem_say, "BAŞ MİMAR", "K6.3 takvimdeki cari kalemlerinin sayısı")
        self.d("%s:projeksiyon:cari" % k, proj_mut if self.mut == 99 else 0, "BAŞ MİMAR", "K6.3 Nakit Akış Projeksiyonu cari vadesini KATMAZ (BİLİNEN SINIR 2.5.x)")
        for ad, u in self.kullanicilar.items():
            if "accounts.view" in u["kaldir"]:
                self.d("%s:yetkisizTakvim:%s:cariKalem" % (k, ad), kalem_say if self.mut == 86 else 0, "BAŞ MİMAR", "K6.3 cari kalemleri yalnız accounts.view yetkisi olana")
        # fatura kalemleri (aynen; [YAYGIN] vadesi gelen açık fatura kalemi açık tutarıdır, vade = belge tarihi (vade günü 0), ufuk aynı)
        for fad, f in self.faturalar.items():
            c = self.cariler.get(f["cari"])
            if not c or c.get("silindi") or f["tur"] not in ("satis", "alis") or f["taksitli"]:
                continue
            if any(kt["aktif"] and kt["cari"] == f["cari"] for kt in self.kartlar.values()):
                continue
            if f["tur"] == "alis" and f["durum"] == "kesildi":
                acik = self.kuyruk_borc(f["cari"]).get(fad, 0)
                s1 = self.elle_kuyrukta(f["cari"], "alacak")
                self.d("%s:fatura:%s:acik" % (k, fad), acik, "BAŞ MİMAR" if s1 or "ks7" in self.etiketCari[f["cari"]] else "PLAN",
                       "S1 borç tarafı: alış faturası açığı = tutar − bağlı ödeme − en eskiden dağıtılan bağsız ödeme")
            elif f["durum"] == "kesildi":
                acik = self.aciklar(f["cari"]).get(fad, 0)
            else:
                acik = 0
            if acik > 0 and f["tarih"] <= ufuk:
                v = {"amount": acik, "direction": "in" if f["tur"] == "satis" else "out"}
            else:
                v = "yok"
            self.d("%s:takvim:fatura:%s" % (k, fad), v, "YAYGIN", "madde 4 'fatura kalemleri aynen': açık > 0 fatura kalemi (tutar = açık)")
        if a.get("uyari"):
            for ead, e in self.evraklar.items():
                if e["cari"] is None:
                    continue
                v = {"amount": e["tutar"], "direction": "in"} if e["durum"] == "portfoy" and e["tarih"] <= ufuk else "yok"
                self.d("%s:takvim:cek:%s" % (k, ead), v, "YAYGIN", "madde 4 'çek kalemleri aynen': portföydeki alınan evrak vadesinde kalem")
        if a.get("mizanKarsilastir"):
            self.d("%s:mizanEsit" % k, True, "BAŞ MİMAR", "S1/K6: Yevmiye DEĞİŞMEZ (vade bilgi alanı) — mizan %s ile aynı" % a["mizanKarsilastir"])

    def kontrol_tablo_245(self, a, k):
        """2.4.5 madde 4 [KULLANICI KARAR ~21:35 UTC (4)]: zil / Tahsilat Takvimi / Vade Takip / Projeksiyon'da tablodan TUTARLI kalem (ödeme günü, aidat, ödeme sözü) YOK;
        tablonun TUTARSIZ tarih hatırlatmaları (duruşma, sözleşme bitiş, icra son tarihi) KALIR."""
        import datetime
        tarihli = [no for no in self.kayitlar if any(n == no and (sk["basliklar"] is None or self.vade_tarihli(sk, c)) for sk in self.sekmeler for n, c in sk["satirlar"])]
        self.d("%s:takvim:tabloTutarli" % k, len(tarihli) if self.mut == 96 else 0, "KULLANICI", "madde 4: Takvim'de tablodan tutarlı kalem yok")
        for no in self.kayitlar:
            self.d("%s:takvim:kalemTutar:%s" % (k, no), (1 if no in tarihli else 0) if self.mut == 96 else 0, "KULLANICI", "madde 4: kaydın Takvim'deki tablo tutarı 0")
        self.d("%s:vadeTakip:tablo" % k, len(tarihli) if self.mut == 98 else 0, "KULLANICI", "madde 4: Vade Takip'te tablodan tutarlı kalem yok")
        self.d("%s:projeksiyon:tablo" % k, 0, "KULLANICI", "madde 4: Nakit Akış Projeksiyonu tablo kalemi katmaz")
        self.d("%s:projeksiyon:tabloSecenek" % k, len(tarihli) if self.mut == 96 else 0, "KULLANICI", "madde 4: 'Tablo' seçeneği kalkar (table=1 de tablo kalemi yok)")
        if a.get("uyari"):
            bugun = self._gun(self.bugun)
            son = (bugun + datetime.timedelta(days=UFUK_GUN - 1)).isoformat()
            for no in self.kayitlar:
                lst = set()
                for sk in self.sekmeler:
                    if sk["tur"] != "serbest" or not sk["basliklar"]:
                        continue
                    for n, c in sk["satirlar"]:
                        if n != no:
                            continue
                        for h in TABLO_TARIH_HATIRLATMA:
                            t = self._iso_hucre((c or {}).get(h))
                            if h in sk["basliklar"] and t and self.bugun <= t <= son:
                                lst.add(h)
                v = [] if self.mut == 97 else sorted(lst)
                self.d("%s:takvim:deadline:%s" % (k, no), v, "KULLANICI", "madde 4 + KS6: tutarsız tarih hatırlatmaları KALIR (duruşma / sözleşme bitiş / icra son tarihi); ödeme tarihi sütunları (Son Ödeme, söz tarihi) deadlines'a DÜŞMEZ")
                self.d("%s:vadeTakip:deadline:%s" % (k, no), v, "KULLANICI", "madde 4: Vade Takip'te tutarsız tablo tarihleri KALIR")

    # ───────────────────────── kontrol
    def kontrol(self, a):
        k = a["id"]
        for ad, c in self.cariler.items():
            if c.get("ortuk"):
                self.d("%s:cari:%s:var" % (k, ad), not c.get("silindi"), "YAYGIN", "B1.6 aktarımın açtığı cari geri almayla kalkar")
                if c.get("silindi"):
                    continue
            elif c.get("silindi"):
                self.d("%s:cari:%s:var" % (k, ad), False, "PLAN", "silinen cari listede yok")
                continue
            self.d("%s:cari:%s:bakiye" % (k, ad), self.bakiye(ad), "YAYGIN" if "5b-borc-yok" in self.etiketCari[ad] else "PLAN",
                   "B1.1/B2.7 bakiye = borçlar − alacaklar")
            if c.get("kayit") is not None:
                self.d("%s:cari:%s:taksitDisi" % (k, ad), sum(t["tutar"] for t in self.taksit_disi(ad)),
                       "AJAN" if self.etiketCari[ad] & {"5a-sonraki-kucuk"} else "KULLANICI", "B1.2 taksit dışı kalan tahsilatlar")
            acik = self.aciklar(ad)
            ajan = self.etiketCari[ad] & {"ux18-fazla", "iptal-bag-duser", "geri-yukle", "bag-degisti", "iade", "kendi-evrak-iptal", "bagsiz-karsiliksiz"}
            s1 = self.v3 and (self.elle_kuyrukta(ad, "borc") or "ks7" in self.etiketCari[ad])  # KS7 (d): kapatıcılar faturaları da kapatır (tek kuyruk)
            for fad, v in acik.items():
                self.d("%s:fatura:%s:acik" % (k, fad), v, "AJAN" if ajan else ("BAŞ MİMAR" if s1 else "KULLANICI"),
                       "B2.1 açık = tutar − bağlı − en eski kapama" + (" · S1 elle kayıtla tek kuyruk" if s1 else "") + (" (ajan ayrıntısı: %s)" % ",".join(sorted(ajan)) if ajan else ""))
            for fad, f in self.faturalar.items():
                if f["cari"] == ad and f["durum"] == "iptal":
                    self.d("%s:fatura:%s:durum" % (k, fad), "iptal", "PLAN", "B2.5 iptal")
        for no, kt in self.kartlar.items():
            if not kt["aktif"]:
                self.d("%s:kart:%s:var" % (k, no), False, "KULLANICI", "B1.6 geri al kartı kaldırır")
                continue
            bay = self.etiketCari[kt["cari"]]
            et = "AJAN" if "5a-sonraki-kucuk" in bay else "KULLANICI"          # 5a (taşıma) denetimleri
            et_b = "YAYGIN" if "5b-borc-yok" in bay else ("AJAN" if "5b-D-tanimi" in bay else "KULLANICI")  # 5b (kart/borç)
            odenen = sum(t["tutar"] for t in kt["tasinan"]) + kt.get("parca", 0)
            self.d("%s:kart:%s:var" % (k, no), True, et_b, "B1.3 kart açıldı")
            self.d("%s:kart:%s:toplam" % (k, no), kt["toplam"], et_b, "B1.3 kart tutarı = tablodaki kalan")
            self.d("%s:kart:%s:odenen" % (k, no), odenen, et, "B1.2 taşınan tahsilatlar karta")
            self.d("%s:kart:%s:kalan" % (k, no), kt["toplam"] - odenen, et, "B1.2")
            self.d("%s:kart:%s:mevcutBorc" % (k, no), kt["mevcut"], et_b, "B1.4 mevcut borcu taksitlendir")
            items = self.kayitlar[no]["items"]
            kalan = odenen
            sirali = list(range(len(items)))
            if self.mut == 12:
                sirali = list(reversed(sirali))
            pay = [0] * len(items)
            for i in sirali:
                d = min(items[i][1], kalan)
                pay[i] = d
                kalan -= d
            for i, v in enumerate(pay):
                self.d("%s:kart:%s:taksit%d:odenen" % (k, no, i + 1), v, et, "B1.2 en eski açık taksitten başlayarak")
        self.d("%s:kasa" % k, self.kasa, "KULLANICI", "B1.2 Kasa değişmez / tahsilatlar Kasa'da")
        if self.mizanBilinir:
            m = defaultdict(int)
            for c in self.cariler.values():
                if c["acilis"]:
                    m["120" if c["tur"] == "musteri" else "320"] += c["acilis"]
                    m["500"] -= c["acilis"]  # açılış fişi karşı hesabı 500 Sermaye [YAYGIN TDHP; defter kâhini ile aynı]
            for f in self.faturalar.values():
                if f["durum"] != "kesildi":
                    continue
                if f["tur"] == "satis":
                    m["120"] += f["tutar"]
                    m["600"] -= f["tutar"]
                elif f["tur"] == "iade":
                    m["610"] += f["tutar"]
                    m["120"] -= f["tutar"]
                elif f["tur"] == "alis":
                    m["770"] += f["tutar"]
                    m["320"] -= f["tutar"]
            for t in self.tahsilatlar.values():
                if t["aktif"]:
                    m["100"] += t["tutar"]
                    m["120"] -= t["tutar"]
            if getattr(self, "kasa_gider", 0):
                m["770"] += self.kasa_gider
                m["100"] -= self.kasa_gider
            for o in self.kayitOdeme.values():  # /3 madde 1: eski kayıt tahsilatı Kasa'da ve defterde (A 602) aynen [BAŞ MİMAR]
                if o["aktif"]:
                    m["100"] += o["tutar"]
                    m["602"] -= o["tutar"]
            for e in self.evraklar.values():
                if e["durum"] == "silindi":
                    continue
                h = "121" if e["tur"] == "senet" and self.mut != 13 else "101"
                m[h] += e["tutar"]
                m["120"] -= e["tutar"]
                if e["durum"] == "karsiliksiz":
                    m["120"] += e["tutar"]
                    m[h] -= e["tutar"]
                elif e["durum"] == "tahsil":
                    m["100"] += e["tutar"]
                    m[h] -= e["tutar"]
                elif e["durum"] == "ciro":
                    m["320"] += e["tutar"]
                    m[h] -= e["tutar"]
            for kod in sorted(set(m) | {"100", "101", "120", "121", "320", "600"}):
                if kod == "602":
                    self.d("%s:mizan:%s" % (k, kod), m.get(kod, 0), "BAŞ MİMAR", "madde 1: kayıt tahsilatı B 100 / A 602 (eski satırlar defterde aynen)")
                    continue
                self.d("%s:mizan:%s" % (k, kod), m.get(kod, 0), "PLAN", "B2.6 §3.11a yevmiye")
        # 5c: Tablodaki Kişiler — bir dosya no'nun tahsilatı bir kez (kayıt tahsilatı + bağlı carinin bütün tahsilatları, kartta olanlar dahil)
        kisiler_a = self.kisiler()
        for no, kay in self.kayitlar.items():
            if kay["isim"] in self.belirsiz_adlar:
                continue  # bağ sürekliliği (3)/(4): eşleşmeyen bağlı verinin yeri kuralda yok
            cari = self.cari_bul_kayit(no)
            alacak = self.kayitTahsilat.get(no, 0)
            if cari is None and no in kisiler_a:
                if kisiler_a[no] is None:
                    continue  # C3 tanımsız kişi — denetlenmez
                alacak = sum(self.kayitTahsilat.get(n, 0) for n, x in kisiler_a.items() if x == kisiler_a[no])  # C3: rapor satırı kişidir
            dogrudan = False
            if cari:
                alacak += sum(t["tutar"] for t in self.tahsilatlar.values() if t["aktif"] and t["cari"] == cari)
                dogrudan = any(t.get("dogrudanKart") for t in self.tahsilatlar.values() if t["aktif"] and t["cari"] == cari)
            if alacak or len(kay["sekmeler"]) > 1 or kay["isim"] in self.bag_kopan_adlar or (self.v3 and any(x["kayit"] == no for x in self.kayitOdeme.values())):
                ayni_ad = sum(1 for x in self.kayitlar.values() if x["isim"] == kay["isim"]) > 1
                if ayni_ad and kay["kimlikler"] and self.ad_cok_kimlikli(kay["isim"]):
                    ayni_ad = False  # C3 [KULLANICI]: aynı ad farklı geçerli kimlik ayrı kişidir — kişinin tahsilatı ayrı satırda (Y2 senaryosu)
                if kay["isim"] in self.bag_kopan_adlar:
                    self.d("%s:rapor:%s:alacak" % (k, no), alacak, "KULLANICI", "B1.8 5c · N3 eşleşmeyen bağ hiçbir satıra taşınmaz (yanlış kişiye gitmez)")
                else:
                    self.d("%s:rapor:%s:alacak" % (k, no), alacak, "YAYGIN" if ayni_ad or dogrudan else "KULLANICI",
                           "B1.8 5c tahsilat bir kez" + (" (aynı adlı iki kişi ayrı satırda: YAYGIN)" if ayni_ad else ""))
        # /2 B3 (K1–K3 [KULLANICI] 23.10 03:12 UTC): Tablodaki Kişiler borcu — yalnız carisi ve kartı olmayan kayıt (bağlı carinin borç satırları bu kâhinde yok)
        k4_toplam, k4_tanimli, k4_negatif = 0, True, 0
        kisiler = self.kisiler()
        for no in self.kayitlar:
            if self.cari_bul_kayit(no) is not None or (no in self.kartlar and self.kartlar[no]["aktif"]):
                k4_tanimli = False
                continue
            if self.kayitlar[no]["isim"] in self.belirsiz_adlar:
                k4_tanimli = False
                continue
            b = self.tablo_borcu(no)
            if isinstance(b, int) and b < 0:
                # Z2: Kalan eksi (fazla ödeme) — Tablodaki Kişiler'deki borcu kararda yok (eksi ya da 0) → kişi denetlenmez, K4 Kişiler toplamı ÇATAL [YAYGIN]
                k4_negatif += b
                k4_toplam += b
                continue
            if b == NOT:
                # Y1/Y3 (karar sahibi 23.10.2026): borç kolonu yok ya da ana tutar belirlenemiyor → borç yok (bütün raporlarda 0) + satır görünür ya da görünür not
                self.d("%s:rapor:%s:gorunurVeyaNot" % (k, no), self.mut != 37, "KULLANICI", "Y1/Y3: borç kolonu yok / ana tutar belirlenemiyor — satır notsuz kaybolmaz")
                continue
            if b is None:
                k4_tanimli = False
                if self.kayitlar[no]["tur"] == "serbest":
                    # karar A: borç sütunu belirlenemiyorsa kişiler raporda notsuz kaybolmaz — satır görünür ya da raporda görünür not (sekme adı / "borç sütunu")
                    self.d("%s:rapor:%s:gorunurVeyaNot" % (k, no), self.mut != 37, "KULLANICI", "karar A: borç sütunu belirlenemeyen kişi notsuz kaybolmaz")
                continue
            # C3: rapor satırı KİŞİdir — dosya no'nun okunan borcu kişisinin (aynı kişiye düşen bütün dosya no'ların) toplamıdır
            kisi = kisiler.get(no)
            if kisi is None:
                k4_toplam += b
                continue
            uyeler = [n for n, x in kisiler.items() if x == kisi]
            bs = [self.tablo_borcu(n) for n in uyeler]
            if all(isinstance(v, int) for v in bs):
                yaygin = any(sk["basliklar"] and any(sutun_sinifi(h) == "genel" for h in sk["basliklar"]) and any(sutun_sinifi(h) == "odenen" for h in sk["basliklar"])
                             and any(n2 in uyeler for n2, _ in sk["satirlar"]) for sk in self.sekmeler)
                yaygin = yaygin or len(kisi) == 4  # Y2 yorumu: telefonla ayrılan kişi
                self.d("%s:rapor:%s:borc" % (k, no), sum(bs), "YAYGIN" if yaygin else "KULLANICI",
                       "B3 K1 satır başına (aynı sekme ayrı borç) · K2 (04:09) farklı sekme de ayrı borç · K3 satır borcu · C3 kişi toplamı"
                       + (" · karar A Genel Toplam − ödenen (hangi toplam: YAYGIN)" if yaygin else ""))
                if b > 0:
                    self.d("%s:rapor:%s:grup" % (k, no), sorted(n for n, v in zip(uyeler, bs) if v > 0), "YAYGIN" if len(kisi) == 4 else "KULLANICI",
                           "C3 kişi gruplaması: farklı ad aynı kimlik ayrı kişi; aynı ad farklı kimlik ayrı; kimliksiz aynı adın tek kimliğine katılır")
                    if self.ad_cok_kimlikli(self.kayitlar[no]["isim"]):
                        kay = self.kayitlar[no]
                        kim = next(iter(kay["kimlikler"])) if kay["kimlikler"] else ""  # kimliksiz grup: etikette kimlik yok
                        self.d("%s:rapor:%s:etiketKimlik" % (k, no), "" if self.mut == 31 else kim, "KULLANICI", "C3 aynı adı paylaşan kişinin etiketinde kimlik")
            k4_toplam += b
            if b > 0:
                sks = [sk for sk in self.sekmeler if any(n == no for n, _ in sk["satirlar"])]
                if len(sks) == 1 and sks[0]["basliklar"] and any(
                        sutun_sinifi(h, [c.get(h) for _, c in sks[0]["satirlar"]]) in ("soz", "soz_yalin") for h in sks[0]["basliklar"]):
                    # (b)/(c): söz sütunu borç sütununu belirsiz yapmaz — borcu belli satırda "borç sütunu belirlenemedi" notu YOK
                    self.d("%s:rapor:%s:notYok" % (k, no), True, "KULLANICI", "A1 + tek tutar sütunu borç: söz sütunlu sekmede borç belli — not yok")
        not_n = None
        if self.kayitlar:
            n = self.cok_sekme_sayisi()
            if self.mut == 26:
                n = [0]
            not_n = n[0] if len(n) == 1 else {"catal": n}
            self.d("%s:rapor:cokSekmeNotu" % k, not_n, "KULLANICI", "B3 K2 (04:09) Tablodaki Kişiler 'N dosya no birden çok sekmede; ayrı sayıldı' notu (0 = not yok)")
        # /2 B4b (K4 [KULLANICI]): Tablodaki Kişiler, Tahsilat Takvimi, Vade Takip, Nakit Akışı Beklenen aynı satır borcu, aynı toplam (kontrol adımında "raporlar")
        if a.get("raporlar"):
            # Y1 (karar sahibi 23.10.2026): "önce cari açın" formunun Açılış Bakiyesi raporlarla AYNI borcu kullanır. Kara kutu: form takvim kaleminin Kalan Borç'undan
            # dolar (ORTAM: kalem `debt`). Yalnız tek satırlı, carisiz, kartsız, vadesi (tarih hücresi) dolu serbest kayıt; borçsuz (not) kayıtta 0.
            for no, kay in self.kayitlar.items():
                if kay["tur"] != "serbest" or self.cari_bul_kayit(no) is not None or (no in self.kartlar and self.kartlar[no]["aktif"]) or kay["isim"] in self.belirsiz_adlar:
                    continue
                yer = [(sk, c) for sk in self.sekmeler for n, c in sk["satirlar"] if n == no]
                if len(yer) != 1:
                    continue
                sk, c = yer[0]
                tarihli = self.vade_tarihli(sk, c)
                b = self.tablo_borcu(no)
                if not tarihli and isinstance(b, int) and any("sözleşme" in kelimeler(h) for h in sk["basliklar"]):
                    # SÖZLEŞME TARİHİ: yalnız Sözleşme Tarihi dolu satırda vade kalemi YOK (Takvim'de görünmez); Açılış Bakiyesi kalemden dolduğundan denetlenmez
                    if self.kural == "2.4.4":
                        self.d("%s:kalemVar:%s" % (k, no), False, "KULLANICI", "SÖZLEŞME TARİHİ vade tarihi değildir — vade kalemi açmaz")
                    continue
                if self.kural != "2.4.4":
                    # 2.4.5 madde 3/4 + K4.1 (BAŞ MİMAR): /2'nin takvimden okuyan denetimleri (kalem / kalemVar / kalemSoz / acilis — "önce cari açın" Açılış Bakiyesi = takvim
                    # kaleminin Kalan Borç'u) 2.4.5 kararıyla GEÇERSİZ (C0); madde 4'ü kontrol_tablo_245 denetler. --legacy'de (legacyTableDues açık) eski kuralla koşar.
                    continue
                if not tarihli or not (isinstance(b, int) or b == NOT):
                    continue
                if self.kalem_yok(sk, c):
                    # Z2: Kalan 0 / eksi → vade kalemi yok (Takvim'de görünmez); Açılış Bakiyesi kararda yok (denetlenmez)
                    self.d("%s:kalemVar:%s" % (k, no), self.mut == 60, "KULLANICI", "Z2: Kalan Borç 0 ya da eksi satırda vade kalemi yoktur")
                    continue
                v = 0 if b == NOT else b
                if self.mut == 55:
                    ilk = next((hucre_kurus(c.get(h)) for h in sk["basliklar"] if h in c and _sayi_mi(c.get(h)) and hucre_kurus(c.get(h)) is not None), 0)
                    v = ilk
                # borç 0 / borçsuz satır: Açılış Bakiyesi 0 ya da boş (kalemde Kalan Borç yok) — ikisi de "borç yok"
                self.d("%s:acilis:%s" % (k, no), {"catal": [0, "boş"]} if v == 0 else v, "KULLANICI",
                       "Y1: 'önce cari açın' Açılış Bakiyesi = raporların satır borcu (borçsuz satırda 0 ya da boş)")
                kt = self.kalem_tutari(sk, c)
                if kt is not None:
                    self.d("%s:kalem:%s" % (k, no), kt, "KULLANICI", "TAKVİM KALEMİ: Tahsilat Takvimi kaleminin tutarı (min(dönem tutarı, Kalan); Kalan boşsa dönem tutarı)")
                soz_kol = [h for h in sk["basliklar"] if tr_kucuk(h) not in KIMLIK_BASLIK and sutun_sinifi(h, [x.get(h) for _, x in sk["satirlar"]]) == "soz"]
                if len(soz_kol) == 1 and hucre_kurus(c.get(soz_kol[0])) is not None and self.mut != 61:
                    self.d("%s:kalemSoz:%s" % (k, no), True, "KULLANICI", "Z3 + ÖDEME SÖZÜ başlıkları: söz tutarından gelen kalem ödeme sözü kalemidir")
                elif not soz_kol and any(soz_ailesi(h) for h in sk["basliklar"]) and not any(
                        soz_ailesi(h) and tarih_mi(c.get(h)) for h in sk["basliklar"]):
                    # 5b + ÖDEME SÖZÜ: söz ailesi başlığı söz tutarı değilse ("Taahhütlü Ücret") ve vade tarihi söz tarihi değilse kalem ödeme sözü DEĞİLDİR
                    ucret = any(soz_ailesi(h) and any(x.startswith(DONEM_KELIME) for x in kelimeler(h)) for h in sk["basliklar"])
                    self.d("%s:kalemSoz:%s" % (k, no), False, "KULLANICI" if ucret else "YAYGIN",
                           "5b + ÖDEME SÖZÜ: söz tutarı olmayan söz-ailesi başlığı ('Taahhütlü Ücret'; yalın 'Ödeme Sözü' [YAYGIN]) — söz tarihi yoksa kalem düz vade kalemi")
        if a.get("raporlar") and k4_tanimli:
            # TAKVİM KALEMİ (baş mimar kararı 23.10.2026): "dört rapor aynı borç" (K4) SATIR BORCU içindir — Tablodaki Kişiler satır borcunu (Kalan) gösterir; Takvim / Vade Takip /
            # Nakit Akışı vadesi gelen tutarı (kalem tutarı) toplar.
            kalem = self.kalem_toplami()
            if self.mut == 59 and kalem is not None:
                k4_toplam = kalem[0]
            self.d("%s:k4:kisiler" % k, {"catal": [k4_toplam, k4_toplam - k4_negatif]} if k4_negatif else k4_toplam, "KULLANICI",
                   "B4b K4 + TAKVİM KALEMİ: Tablodaki Kişiler satır borcunu gösterir" + (" (Z2 eksi Kalan: eksi ya da 0 — ÇATAL)" if k4_negatif else ""))
            # 2.4.5 (K4.1): k4:takvim (/2 B4b, takvim) GEÇERSİZ — Takvim'de tablo tutarı yok (madde 4: takvim:tabloTutarli / kalemTutar). Tablodaki Vadeler / Nakit Akışı
            # (tablo raporları — madde 5 yalnız etiket) TAKVİM KALEMİ toplamını gösterir.
            if kalem is not None:
                for anahtar in (("k4:takvim", "k4:vade", "k4:akis") if self.kural == "2.4.4" else ("k4:vade", "k4:akis")):
                    self.d("%s:%s" % (k, anahtar), kalem[0] if len(kalem) == 1 else {"catal": kalem}, "KULLANICI",
                           "TAKVİM KALEMİ: kalem tutarı = min(dönem tutarı, Kalan Borç); Kalan boşsa dönem tutarı; dönem kolonu yoksa satır borcu")
            if not_n is not None and self.kural == "2.4.4":
                # K2 (04:09): not Tahsilat Takvimi'nde de çıkar — yalnız bütün satırların vadesi takvim penceresindeyken (K4 koşulu) denetlenir. 2.4.5: Takvim'de tablo tutarı yok → GEÇERSİZ (C0)
                self.d("%s:takvim:cokSekmeNotu" % k, not_n, "KULLANICI", "B3 K2 (04:09) Tahsilat Takvimi 'N dosya no birden çok sekmede; ayrı sayıldı' notu (0 = not yok)")
        # /2 B5b (K5 [KULLANICI] Y1): Kasa'yı görme yetkisi olmayan kullanıcı Nakit Akışı'nda Kasa giriş/çıkışını görmez (boş/gizli + not)
        for ad in [u for u, v in self.kullanicilar.items() if "cash.view" in v["kaldir"]]:
            if self.kural == "2.4.4":
                self.d("%s:yetkisiz:%s:kasa" % (k, ad), "gorunur" if self.mut == 27 else "gizli", "KULLANICI", "B5b K5 Kasa giriş/çıkışı gizli")
                self.d("%s:yetkisiz:%s:not" % (k, ad), self.mut != 27, "KULLANICI", "B5b K5 gizlilik notu")
            else:
                # B5b (K5) 2.4.5 kararıyla GEÇERSİZ (K4.1; --legacy'de koşar). KS4 [BAŞ MİMAR]: gösterilecek Kasa sütunu yok → "Kasa yetkisi" notu da kalkar; mutant 108: not kalır
                self.d("%s:yetkisiz:%s:kasaNotu" % (k, ad), self.mut == 108, "BAŞ MİMAR", "KS4 madde 5: yetkisiz kullanıcıya Tablodaki Nakit Akışı'nda Kasa notu yok")
        # /2 B4 (MM6 [KULLANICI] 22.10 21:27 UTC "Nakit Akışı Kasa giriş bütün nakit hareketleri"): yıl başından bugüne Kasa giriş/çıkış
        bas = self.bugun[:4] + "-01-01"
        giris = sum(g for t, g, _, _r in self.kasa_hareket if bas <= t <= self.bugun)
        cikis = sum(c for t, _, c, _r in self.kasa_hareket if bas <= t <= self.bugun)
        for anahtar, v in (("nakit:kasaGiris", giris), ("nakit:kasaCikis", cikis), ("kasaRapor:giris", giris), ("kasaRapor:cikis", cikis)):
            if anahtar.startswith("nakit:") and self.kural != "2.4.4":
                continue  # B4 (MM6) Tablodaki Nakit Akışı Kasa sütunu 2.4.5 kararıyla GEÇERSİZ (K4.1; --legacy'de koşar) — KS4 aşağıda
            self.d("%s:%s" % (k, anahtar), v, "KULLANICI", "B4 MM6 Nakit Akışı Kasa = Kasa raporu (yalnız nakit, bütün kaynaklar)")
        if self.kural != "2.4.4":
            # KS4 [BAŞ MİMAR] (madde 5 öneri uygulanır): Kasa sütunları Tablodaki Nakit Akışı'ndan KALKAR (cashIn/cashOut yok); mutant 107: kalır
            self.d("%s:nakit:kasaSutunu" % k, "var" if self.mut == 107 else "yok", "BAŞ MİMAR", "KS4 madde 5: Tablodaki Nakit Akışı'nda Kasa sütunu yok")
        if self.v3:
            self.kontrol_v3(a, k)
        if self.kural != "2.4.4" and self.sekmeler and (self.v3 or a.get("raporlar")) and not self.anahtar.get("legacyTableDues"):
            self.kontrol_tablo_245(a, k)
        if self.kayitlar:
            self.d("%s:rapor:tutarli" % k, True, "KULLANICI", "B1.8 ders 11 toplam = satırlar")
            for no, kay in self.kayitlar.items():
                if ("%s:rapor:%s:alacak" % (k, no)) in self.out and self.out["%s:rapor:%s:alacak" % (k, no)]["b"] and not self.ad_cok_kimlikli(kay["isim"]):
                    self.d("%s:rapor:%s:ad" % (k, no), kay["isim"], "YAYGIN", "B1.8b Tablodaki Kişiler kişiyi adıyla gösterir")

    # ───────────────────────── sürücü
    def kos(self):
        for a in self.s["adimlar"]:
            islem = a["islem"]
            if islem == "kontrol":
                self.kontrol(a)
                continue
            fn = getattr(self, islem)
            sonuc = fn(a)
            if (islem == "tablo_yukle" or islem == "cari_ac") and not isinstance(sonuc, tuple):
                self.d("adim:%s:durum" % a["id"], "ok", "PLAN", "adım kabul edilir")
                continue
            if islem == "aktar":
                if sonuc is None:
                    continue
                self.d("adim:%s:durum" % a["id"], "ok", "KULLANICI", "B1 aktarım")
                cari_et = "AJAN" if any(self.etiketCari[c] & {"5a-sonraki-kucuk", "5b-D-tanimi"} for c in self.cariler) else "KULLANICI"
                for alan in ("olusan", "tasinanAdet", "tasinanTutar", "kapsanan", "atlanan"):
                    self.d("adim:%s:%s" % (a["id"], alan), sonuc[alan], cari_et, "B1 aktarım özeti")
                continue
            if isinstance(sonuc, tuple):
                self.d("adim:%s:durum" % a["id"], "ret", sonuc[1], "B2.4 bağ kurulamaz → ret, hiçbir satır yazılmaz")
            else:
                self.d("adim:%s:durum" % a["id"], "ok", "PLAN", "adım kabul edilir")
        return {"ad": self.s["ad"], "dil": DIL, "kural": self.kural, "denetimler": dict(sorted(self.out.items())), "belirsiz": self.belirsiz}


def _mutant_farkli(senaryo, n, kip, taban):
    """Mutant koşusu tabandan farklı mı. Mutant modeli çökertirse (ör. cari açılmadı, sonraki adım onu arıyor) davranış zaten değişmiştir — yakalandı sayılır;
    taban (mutasyonsuz) koşusu bu sarmalın DIŞINDA hesaplanır, onun çökmesi koşuyu durdurur."""
    try:
        return Model(senaryo, n, kip).kos()["denetimler"] != taban
    except Exception:
        return True


def main(argv):
    if len(argv) < 2:
        sys.stderr.write(__doc__)
        return 2
    mut = 0
    if "--mutasyon" in argv:
        mut = int(argv[argv.index("--mutasyon") + 1])
    if "--mutasyonlar" in argv:
        sys.stdout.write(json.dumps(MUTASYONLAR, ensure_ascii=False, indent=2) + "\n")
        return 0
    if "--mutasyon-tara" in argv:
        # Koşucunun mutasyon denetimi tek süreçte (kos.mjs): girdi [{"dosya", "kipler": ["2.4.5"|"2.4.4", …]}]; her mutant için ilk 3 yakalayan dosya (ve kip)
        with open(argv[argv.index("--mutasyon-tara") + 1], encoding="utf-8") as f:
            liste = json.load(f)
        senaryolar = {}
        for x in liste:
            with open(x["dosya"], encoding="utf-8") as g:
                senaryolar[x["dosya"]] = json.load(g)
        taban = {(x["dosya"], k): Model(senaryolar[x["dosya"]], 0, k).kos()["denetimler"] for x in liste for k in x["kipler"]}
        out = {}
        for n, ad in MUTASYONLAR.items():
            yak = []
            for x in liste:
                kip = next((k for k in x["kipler"] if _mutant_farkli(senaryolar[x["dosya"]], n, k, taban[(x["dosya"], k)])), None)
                if kip:
                    yak.append({"dosya": x["dosya"], "kip": kip})
                if len(yak) >= 3:
                    break
            out[str(n)] = {"ad": ad, "yakalayan": yak}
        sys.stdout.write(json.dumps(out, ensure_ascii=False) + "\n")
        return 0
    with open(argv[1], encoding="utf-8") as f:
        senaryo = json.load(f)
    if "--gecersiz-mi" in argv:
        sys.stdout.write(json.dumps(gecersiz_245(senaryo)) + "\n")
        return 0
    kural = "2.4.4" if "--legacy" in argv else "2.4.5"
    sys.stdout.write(json.dumps(Model(senaryo, mut, kural).kos(), ensure_ascii=False, indent=2, sort_keys=True) + "\n")
    return 0


if __name__ == "__main__":
    sys.exit(main(sys.argv))
