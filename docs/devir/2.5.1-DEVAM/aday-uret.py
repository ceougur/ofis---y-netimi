#!/usr/bin/env python3
# 2.5.1 ADAY KAPISI — mali müşavir S (yalnız KDV Özeti + Değersiz Alacak; kodu görmez) ve UI/UX tek tur görev metinleri + mali müşavirin karar özeti (kararlar iş listesinden AYNEN; program kodu / dosya adı YOK). S-251Y-3 = A. Ana oturum, 28.11.2026.
IS = open('/home/user/ofis---y-netimi/docs/2.5.1-IS-LISTESI.md', encoding='utf-8').read()
SP = '/tmp/claude-0/-home-user/de5e1cbf-7e68-5683-b7bb-f27655eaed4f/scratchpad'
D = '/home/user/ofis---y-netimi/docs/devir/2.5.1-DEVAM/'

def satir(anahtar, metin=IS, ilk=False):
    i = metin.find(anahtar); assert i >= 0, anahtar
    if not ilk: assert metin.find(anahtar, i + 1) < 0, 'tekil değil: ' + anahtar
    b = metin.rfind('\n', 0, i) + 1; e = metin.find('\n', i)
    return metin[b:e].strip()

def k(anahtar):
    return satir(anahtar).split(' UYGULAMA (baş mimar')[0]

KDV = [satir('S-M1-1 (M1 tur 1 raporu'), satir('S-M1-3 (27.11 08:35 UTC; M1 tur 2 raporu'), k('KULLANICI KARARI 27.11 14:18 UTC'), k('KULLANICI KARARI 27.11 16:16 UTC'),
       k('KULLANICI KARARI 27.11 19:44 UTC'), satir('S-M1K3-1 (KDV Özeti küçük tur 3 raporu'), satir('S-DKM1K-1 (KDV Özeti tek dar kontrolü ORTA-1')]
DEG = [satir('S-M2-1 (27.11 07:22 UTC'), k('KULLANICI KARARI 27.11 07:32 UTC'), satir('S-DKM2-2 (dar kontrol M2 ORTA-2'), satir('S-M2T2-1 ('), satir('S-M2T2-2 ('),
       satir('S-DKM2T3-1 ('), satir('SK-64 (cari kâhini bakımı 34'), satir('S-M2T5-1 ('), satir('S-M2T5-2 (aynı kaynak K-2', ilk=True)]
BIL = ("BİLİNEN SINIRLAR (baş mimar kararları; bulgu SAYMA, ama mevzuat / uygulama açısından ciddiyetini değerlendir): (1) Değersiz Alacak'lı caride açık hesap stok satışının tutarını düşürmek / silmek, "
       "açık hesap stok alışının tutarını artırmak ve verilen çek / senedi silmek cariyi eksiye götürebilir — program reddetmez (sonraki sürüm). (2) KDV Özeti'nde 'Güncel Olmayan Önceki Fiş' notu, "
       "rapor ön izlemeye eşitken de 'ön izlemesinden ayrılır' diyebilir (uç durum; yanında doğru onarımı söyleyen not durur). (3) KDV Özeti PDF özet kartı uzun notu '…' ile kısaltır (ekran ve Excel tam).")
open(D + 'ms-kararlar.md', 'w', encoding='utf-8').write(
 "# 2.5.1 — Mali müşavir S için karar özeti (ana oturum, 28.11.2026; kararlar iş listesinden AYNEN)\n\n"
 "Bu dosyada programın kodu, dosya / alan adı yoktur ya da yalnız karar metninde geçer — kod OKUMA, karar metnini mevzuat ve yaygın uygulamaya göre değerlendir. "
 "Kararların çoğu kullanıcının 'bir süre ekran başında olmayacağım. sorularına baş mimar önerilerini uygula' yetkisiyle uygulanmış önerilerdir; kullanıcı değiştirebilir.\n\n"
 "## 1. KDV Özeti (Beyanname Hazırlığı) — Önceki Dönemden Devreden KDV, sırayla mahsup, mahsuptan sonra değişen ay notları\n\n" + "\n\n".join('- ' + x for x in KDV) +
 "\n\n## 2. Değersiz Alacak (şüpheli alacak — 128 / 129, VUK 322 / 323) sınırı\n\nÖnceki kararlar (S264, S268, S269, S270): `docs/devir/2.5.1-DEVAM/m2-kararlar.md` §1 (OKU).\n\n" + "\n\n".join('- ' + x for x in DEG) +
 "\n\n## 3. " + BIL + "\n")

MS = f"""Sen DestekOfis projesinde 2.5.1 SON ADAYININ MALİ MÜŞAVİR S (son aday denetimi) ajanısın. Tanımın: `docs/erp/MALI-MUSAVIR-AJANI.md` ve `.claude/agents/mali-musavir.md` — TAMAMINI oku ve AYNEN uygula (kodu GÖRMEZSİN: `server/`, `client/`, `test/`, `tools/`, `docs/kanit/`, git geçmişi / fark, kâhin kodu, başka ajanların raporları YASAK). Yanıtın ve raporun Türkçe.

KAPSAM (kullanıcı kararı S-251Y-3 = A, AYNEN: "UI/UX ajanı tek tur + mali müşavir S YALNIZ değişen iki alanda (KDV Özeti, Değersiz Alacak)"): YALNIZ
(1) KDV Özeti (Beyanname Hazırlığı) — Hesaplanan / İndirilecek KDV, Önceki Dönemden Devreden KDV, Ödenecek / Sonraki Döneme Devreden KDV, KDV Mahsup Fişi (ön izleme ve fiş), mahsuptan sonra kayıt değişince çıkan notlar ve önerdikleri onarım; ekran = PDF = Excel; her dönem seçeneği;
(2) Değersiz Alacak — Şüpheliye Al, Değersiz Alacak Yaz (formun gösterdiği sınır), değersiz yazılmış caride cariyi eksiye götüren değişikliklerin reddi ve ret iletileri, yevmiye / mizan etkisi (128 / 129 / 659 ya da programın kullandığı hesaplar), cari ekstresi.
Başka modülü denetleme (devir yok — bu sürümde ekransız; kilit paketi yok).

KARARLAR: `docs/devir/2.5.1-DEVAM/ms-kararlar.md` (TAMAMI) ve oradan verilen `docs/devir/2.5.1-DEVAM/m2-kararlar.md` §1. Bu kararları mevzuata (KDV Kanunu md. 29 indirim ve devreden; KDV Genel Uygulama Tebliği; VUK 322 / 323 şüpheli ve değersiz alacak; Tek Düzen Hesap Planı) ve yaygın uygulamaya göre DEĞERLENDİR: bir karar mevzuatla çelişiyorsa ya da kullanıcıyı (mali müşaviri) yanıltacak bir çıktı üretiyorsa bulgudur.

ORTAM: programı kendi benzersiz not defteri klasöründe (`{SP}/ms251/`) çalışma dalının bugünkü ucundan aç — `git worktree add --detach {SP}/ms251/kod claude/epic-thompson-w0lc2l` (YALNIZ çalıştırmak için; kod dosyalarını açma, okuma), `ln -s /home/user/ofis---y-netimi/node_modules {SP}/ms251/kod/node_modules`; `HUKUK_LICENSE_URL=http://127.0.0.1:9`; sahte saat; tarayıcı `PLAYWRIGHT_BROWSERS_PATH={SP}/pw-1194` (`playwright install` YOK); programı nasıl başlatacağını kullanım kılavuzundan (`docs/kilavuz/`) ve `package.json`'daki `start` betiğinden öğren. Test verisini programın kendisine kullanıcı gibi gir (ekrandan; yalnız hız için programın açık API'si kara kutu); müşteri verisi YOK. Ekran görüntülerine BAK. Bitince kopyayı zorlamasız kaldır (önce node_modules bağını tam yolla sil, sonra `git worktree remove`). `pkill` / joker `rm` YOK. Kod değiştirme, commit / push YOK. Tam `npm test` YOK. Yük > 4 ya da boş bellek < 2 GB iken yeni ağır iş başlatma; disk ≥ 5 GB.

NE ARA: KDV Özeti'nin her dönem seçeneğinde Ödenecek − Sonraki + Önceki = Hesaplanan − İndirilecek (aralık için) ve ay ay sırayla mahsup mantığının KDV beyannamesindeki devreden KDV ile uyumu; mahsup fişinin (360 / 190 / 191 / 391) doğru hesaplara ve doğru tutarla yazılması; mahsuptan sonra kayıt değişince notun söylediği onarımın (geri al + sırayla yeniden mahsup) mali müşavirin yapacağı işle uyumu ve gerçekten sonuç vermesi; Değersiz Alacak'ın VUK 323'e göre ne zaman ve hangi tutarla yazılabileceği, formun gösterdiği sınırın doğruluğu, değersiz yazılmış caride cariyi alacaklıya düşüren değişikliklerin reddinin muhasebe açısından yerindeliği ve ret iletisinin bir mali müşavire anlaşılır olması (ne oldu / neden / ne yapmalı / nereye), yevmiye ve mizanda 128 / 129 / gider hesabı etkisi; yazım düzeni (her sözcüğün ilk harfi büyük adlar), Türkçe terim doğruluğu.

RAPOR (Türkçe): her bulgu için sınıf (YÜKSEK / ORTA / DÜŞÜK), adım adım yeniden üretim (ekran yolu + girilen veri + görülen sayı + beklenen sayı ve dayanağı: mevzuat maddesi + bağlantı + erişim tarihi, ya da en az iki yaygın programın belgesi — yoksa 'GÖRÜŞ'), ekran görüntüsü yolu; para / kapama kuralı gerekiyorsa 'KULLANICIYA SORULMALI' (iki seçenek + öneri; uç durumsa 'Uç durum böyle kalsın' seçeneği). Sonra DOĞRULANMADI, DENENMEYEN, okuduğun dosyaların listesi (bağımsızlık denetimi). Bulgu yoksa açıkça 'YÜKSEK / ORTA YOK'. Kendi arka plan işin sürerken rapor vermeden bitirme.
"""
open(D + 'ms251-istem.txt', 'w', encoding='utf-8').write(MS)

UX = f"""Sen DestekOfis projesinde 2.5.1 SON ADAYININ UI/UX (arayüz ve kullanılabilirlik) incelemecisisin; TEK TUR (kullanıcı kararı S-251Y-3 = A). Yalnız HATA ve kullanılabilirlik sorunu ararsın; kod değiştirmez, commit / push yapmazsın. Yanıtın ve raporun Türkçe.

ÖNCE oku: `CLAUDE.md` (anayasa, kalite çıtası, yazım düzeni, kılavuz kuralı, dersler — özellikle 11, 12, 39), `docs/BAGIMSIZ-DOGRULAMA-PRENSIBI.md`.

KAPSAM — 2.5.1'de KULLANICININ GÖRDÜĞÜ değişiklikler (yalnız bunlar; devir ekransız, kilit paketi yok):
(1) Müşteri istekleri: geciken taksitin numarası (taksit kartı / listeler / müşteriye giden çıktılar — boşluksuz sıra numarası) ve cari grubuna göre görünümler (cari listesi, özetler; grup süzgeci).
(2) KDV Özeti (Beyanname Hazırlığı): Önceki Dönemden Devreden KDV, sırayla mahsup, notlar ('Mahsuptan Sonra Değişen Ay', 'Zincirle Uyuşmayan Mahsup Fişi', 'Güncel Olmayan Önceki Fiş', 'Mahsup Edilmemiş Ay') — notların okunurluğu, ekranda tam görünmesi, önerilen onarımın ekrandan yapılabilirliği (KDV Mahsup Fişi penceresinde Geri Al / Mahsup Fişini Oluştur), ekran = PDF = Excel.
(3) Değersiz Alacak: Şüpheliye Al, Değersiz Alacak Yaz formu (gösterilen sınır), değersiz yazılmış caride reddedilen işlemlerin iletileri (Ödeme / POS İadesi silme ve düşürme, Alacak artırma, alış faturası düzenleme, taksit kartı ödeme / iade hareketi, Otomatik Dağıt, Borç Yaz silme / düşürme, fatura iptali) — ileti uzun: okunuyor mu, 'Kopyala' çalışıyor mu, birden çok bildirim üst üste binince ne oluyor, 'ne yapmalı' adımını kullanıcı ekranda bulabiliyor mu (yazan yol gerçekten var mı).
Her alanda: günlük iş akışını kullanıcı gibi baştan sona yürü (kişi → cari → fatura / taksit → tahsilat → rapor), boş veri, tek kayıt, geçmiş / ileri tarih, yetkisiz kullanıcı (Muhasebe rolü), dar ekran (telefon genişliği), klavye ile (Tab, Enter, Esc) ve insan hızında; yazım düzeni (program adlarında her sözcüğün ilk harfi büyük; cümleler cümle düzeninde).

ORTAM: kendi benzersiz not defteri klasörün `{SP}/uiux251/`; çalışma dalının ucundan `git worktree add --detach {SP}/uiux251/kod claude/epic-thompson-w0lc2l`, `ln -s /home/user/ofis---y-netimi/node_modules {SP}/uiux251/kod/node_modules`; `HUKUK_LICENSE_URL=http://127.0.0.1:9`; sahte saat; tarayıcı `PLAYWRIGHT_BROWSERS_PATH={SP}/pw-1194` (`playwright install` YOK); pencere seçicisi ders 39'a göre. Kodu okuyabilirsin (ekranı bulmak için). Ekran görüntülerine BAK, rapora yollarını yaz. Bitince kopyayı zorlamasız kaldır (önce node_modules bağını tam yolla sil). `pkill` / joker `rm` YOK. Tam `npm test` YOK. Yük > 4 ya da boş bellek < 2 GB iken yeni ağır iş başlatma; disk ≥ 5 GB.

BİLİNEN (bulgu sayma): {BIL} Önceki bildirimlerin ekranda üst üste kalması bilinen bir sonraki sürüm maddesidir — yalnız işlemi ENGELLİYORSA bulgu.

RAPOR (Türkçe): her bulgu için sınıf (YÜKSEK / ORTA / DÜŞÜK), ekran yolu, adımlar, ekran görüntüsü yolu, beklenen / görülen, en küçük düzeltme önerisi; programın davranışı ya da sayısı değişmesi gereken bir şey çıkarsa (para / kapama) 'KULLANICIYA SORULMALI' (iki seçenek + öneri). DÜŞÜK'leri ayrı başlıkta topla (sonraki sürüme gidecek). Sonra DOĞRULANMADI ve DENENMEYEN. Bulgu yoksa açıkça 'YÜKSEK / ORTA YOK'. Kendi arka plan işin sürerken rapor vermeden bitirme.
"""
open(D + 'uiux251-istem.txt', 'w', encoding='utf-8').write(UX)
print(len(MS), len(UX))
