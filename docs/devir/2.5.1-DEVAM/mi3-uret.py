#!/usr/bin/env python3
# Müşteri istekleri TUR 3 (dar kontrol Mİ'nin ORTA-1'i + dişsiz test) görev metni: mi3-istem.txt. Ana oturum, 27.11.2026.
src = open('/home/user/ofis---y-netimi/docs/devir/2.5.1-DEVAM/istem-uret.py').read().split('# ---------------------------------------------------------------- P-D')[0]
exec(src)
IS = open('/home/user/ofis---y-netimi/docs/2.5.1-IS-LISTESI.md', encoding='utf-8').read()

def satir(anahtar, metin=IS):
    i = metin.find(anahtar); assert i >= 0, anahtar
    assert metin.find(anahtar, i + 1) < 0, 'tekil değil: ' + anahtar
    b = metin.rfind('\n', 0, i) + 1; e = metin.find('\n', i)
    return metin[b:e].strip()

BM = satir('(DAR KONTROL Mİ raporu')
BM758 = satir('BAŞ MİMAR KARARI 27.11 07:58 UTC (Mİ RAPORU')
TABAN = 't251-mi3-taban'

MI3 = f"""Sen DestekOfis projesinde 2.5.1'in MÜŞTERİ İSTEKLERİ TUR 3 kod ajanısın (eforun high). Tur 1 ve 2 ana dala (çalışma dalı) girdi; bağımsız dar kontrolü bir ORTA bulgu verdi, ana oturum çalışma dalının kodunda YENİDEN ÜRETTİ. Temiz bağlamla YALNIZ aşağıdaki işleri yaparsın (ders 46).

{hazirlik(taban=TABAN, taban_ne="çalışma dalı — müşteri istekleri tur 1–2 dahil")}
3. Sonra oku: `docs/devir/2.5.1-PLAN-TASLAK.md` §3 (Mİ-2), cari listesi istemcisi (`client/assets/hof-accounts.js` — dönem seçici, 'Bu Dönemde Ödeme Yapanlar' süzgeci, toplu WhatsApp, PDF / Excel bağlantıları), toplu WhatsApp hedef ucu (yalnız OKU), ana oturumun yeniden üretim betiği ve çıktısı `docs/kanit/2026-11-27/ana-dkmi/` (p5-wa-aralik.mjs — `<kod kökü>` yerine kendi ağacın; p5-cikti.txt).

## DOSYA SINIRI
YAZABİLİRSİN: cari listesi istemcisi, gerekiyorsa toplu WhatsApp hedef ucunun süzgeç ALMA kısmı (yalnız dönem / 'ödeme yapanlar' süzgecini taşımak için), testler, ekran senaryoları (`test/e2e/senaryo-mi2-251.mjs` genişletilebilir), kanıt, rapor. YAZAMAZSIN: tek borç sırası ve girdisi, defter rotası, şüpheli defter türetmesi (TEK BORÇ SIRASI ZİNCİRİ — kilit paketi bu dosyalarda çalışıyor), WhatsApp gönderim çekirdeği ('kime kaç kez' kuralları — DEĞİŞMEZ), Rapor Merkezi.

## Bulgu ve kararlar (AYNEN)
DAR KONTROL BULGUSU VE BAŞ MİMAR KARARI: {BM}
TUR 1'İN BAŞ MİMAR KARARLARI (AYNEN; (5) özellikle): {BM758}

## İşler
0. NASIL BOZULUR (koddan ÖNCE, commit): dönem seçicinin her seçeneği × 'ödeme yapanlar' süzgeci açık / kapalı × aralık günleri boş / yalnız biri / başlangıç bitişten sonra / geçerli; sayfa yenileme; sekme değiştirip dönme; toplu WhatsApp (ekstre / mesaj), PDF, Excel, Grup Özeti; klavye ile seçim (Tab — ders 12).
1. ORTA-1 düzeltmesi: 'Bu Dönemde Ödeme Yapanlar' açıkken dönem 'Tarih Aralığı'na çevrilip günler henüz geçerli değilse ekran ESKİ ödeyenleri göstermez (liste boşalır ya da son geçerli dönemle tutarlı kalır — seçimini gerekçesiyle rapora yaz), 'Tümüne WhatsApp' GİZLİ kalır (karar (5): süzgeçte görünmeyene ileti gitmesin); PDF / Excel / toplu düğmeler ekranın süzgeciyle AYNI koşula bağlanır (ekran = PDF = Excel — ders 11). Toplu WhatsApp isteği ekranda görünenden FAZLA kişiye gidemez — sunucuya giden istekte süzgeç / dönem taşınıyor mu, taşınmıyorsa düğme hiç görünmez (ikisinden hangisini seçtiğini rapora yaz).
2. Kalıcı test: ana oturumun yeniden üretim adımı (DK-PROBE) ekran senaryosuna kalıcı adım olarak girer — eski kodda (taban) beklenen nedenle kırmızı ('Tümüne WhatsApp düğmesi VAR', istekte süzgeç yok, pencerede 3 cari), yenide yeşil.
3. Dişsiz test (dar kontrolün SONRAKİ SÜRÜME maddesi; prensip §4 'yalnız teste dokunan DÜŞÜK aynı turda'): Grup Özeti testine POS Komisyon İadesi / Kredi Kartına İade ('Diğer') değeri girer — 'Diğer' sınıfı kapatılınca test kırmızı olmalı (mutantla göster).
4. Komşular: `git grep` ile değişen işlevlerin çağıranları; müşteri istekleri tur 1–2'nin testleri + iki ekran senaryosu (senaryo-mi1-251, senaryo-mi2-251) + WhatsApp toplu gönderim ekran senaryoları (CI listesinde olanlar) iki TZ / UTC yeşil.

## Kabul
A yeni / değişen test ve ekran adımı tabanda beklenen nedenle kırmızı (NEDEN — ders 38), yenide yeşil; B mutantlar (en az: koşul eski hâline dönsün; PDF bağlantısı dönemsiz kurulsun; 'Diğer' sınıfı kapansın) yakalanır; C komşular yeşil; D sayılar değişmez (yalnız görünüm / düğme / süzgeç taşıma) — Grup Özeti, Liste, rapor eşdeğerliği AYNEN; E hız: yeni sorgu yok (ders 47).

{KURALLAR_KULLANICI}

{kurallar('mi3', taban=TABAN)}

{rapor()}
"""
open('/home/user/ofis---y-netimi/docs/devir/2.5.1-DEVAM/mi3-istem.txt', 'w', encoding='utf-8').write(MI3)
print(len(MI3))
