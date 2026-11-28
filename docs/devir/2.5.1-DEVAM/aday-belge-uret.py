#!/usr/bin/env python3
# 2.5.1 ADAY BELGE ve SÜRÜM görev metni: aday-belge-istem.txt. Ana oturum, 28.11.2026.
src = open('/home/user/ofis---y-netimi/docs/devir/2.5.1-DEVAM/istem-uret.py').read().split('# ---------------------------------------------------------------- P-D')[0]
exec(src)
TABAN = 't251-aday-belge-taban'
IST = f"""Sen DestekOfis projesinde 2.5.1 SON ADAYININ BELGE ve SÜRÜM ajanısın (eforun high). Kod davranışını DEĞİŞTİRMEZSİN; yalnız sürüm numarası, CHANGELOG, değişiklik belgesi, kullanım kılavuzu (HTML + PDF) ve onların testleri. Paralel bir dar kontrol aday kodunu inceliyor — sunucu / istemci koduna DOKUNMA.

{hazirlik(taban=TABAN, taban_ne="çalışma dalı ucu — 2.5.1'in bütün kod işleri birleşmiş")}
3. Sonra oku: CLAUDE.md'nin 'Kullanım kılavuzu', 'Yazım düzeni', 'Sürüm teslim düzeni' bölümleri ve kalıcı ürün kararlarındaki 'Sürüm notu KISA' maddesi; 2.5.0'ın aday hazırlığı commit'i e7934c5e (`git show --stat e7934c5e` ve CHANGELOG.md, package.json, kılavuz HTML, docs/2.5.0-DEGISIKLIKLER.md farkı — biçim ÖRNEĞİ); docs/2.5.0-DEGISIKLIKLER.md; iş listesi docs/2.5.1-IS-LISTESI.md — YALNIZ A tablosu, C'de S-251Y-1/2/3, S-MS251-1, S-MS251-2, S-M2T5-1, S-M2T5-2 satırları, D'de 'KILAVUZ ÖNERİSİ' / 'Kılavuz metni' / 'kılavuz önerisi' geçen satırlar (python ile satır satır; satırlar uzun) ve B'de 'BİLİNEN SINIR' geçen satırlar; müşteri istekleri raporlarının (docs/devir/2.5.1-DEVAM/mi*-rapor.md) yalnız 'Kılavuz' bölümleri.

## İşler
1. SÜRÜM 2.5.1: package.json ve package-lock.json (yalnız kök sürüm alanları — npm version KOŞMA; elle, 2.5.0 commit'indeki gibi); kılavuzdaki sürüm yazısı; sürüm NUMARASINI denetleyen testler varsa (git grep ile test/ ve tools/ içinde '2.5.0' — yalnız sürüm numarası denetimleri; eski sürüm göçü / fikstür adlarına DOKUNMA) gerekiyorsa güncelle ve rapora listele.
2. CHANGELOG.md: en üste '## 2.5.1 — <kısa başlık>' ve 2.5.0 biçiminde iki madde ('Yeni:' ve 'İyileştirmeler:'), KISA (kullanıcı kararı: sürüm notu kısa). İçerik — kullanıcının GÖRDÜĞÜ değişiklikler: müşteri istekleri (geciken taksitin numarası her yerde; cari grubuna göre görünümler), KDV Özeti (Önceki Dönemden Devreden KDV, sırayla mahsup, mahsuptan sonra değişen ay notları ve onarım, kayıtsız aylar ve İndirilecek KDV azalışı), Değersiz Alacak sınırı (form doğru sınırı önerir; değersiz yazılmış caride cariyi eksiye düşüren değişiklikler reddedilir — iletiler ne yapılacağını söyler), uzun hata iletileri, KDV kartları ve mahsup penceresi görünümü. Devir ekranı YOK (yazma).
3. docs/2.5.1-DEGISIKLIKLER.md (2.5.0 belgesinin düzeninde): ayrıntılı değişiklikler + BİLİNEN SINIRLAR (bu sürüme özgü, kullanıcıyı ilgilendiren: Değersiz'li caride açık hesap stok satışı / alışı ve verilen çek-senet yolları reddedilmez; S-MS251-1 aynı gün sıra uyarısı; değersiz alacağın KDV payı indirimi (KDVK 29/4) elle; KDV Özeti PDF'inde uzun notların kısalması; 'Güncel Olmayan Önceki Fiş' notunun uç durumu; devir sihirbazı yok; kilit paketi yok — POS iadesi 2.5.0 davranışında) — teknik ayrıntı / dosya adı YAZMA.
4. KILAVUZ (docs/kilavuz/DestekOfis-Kullanim-Kilavuzu.html): D'deki kılavuz önerilerini (yeni olan eskisinin YERİNE geçer — KDV tur 7'nin metni tur 6'nınkinin, Değersiz tur 6'nınki tur 5'inkinin) ilgili bölümlere kısa 'nasıl yapılır' cümleleriyle ekle; S-MS251-1 uyarısı ('aynı gün tahsilattan sonra şüpheliye alacaksanız şüpheliye alma tarihini ertesi gün girin') ve S-MS251-2 notu ('değersiz alacağın KDV payının indirimi (KDVK 29/4) program tarafından yapılmaz; mali müşaviriniz elle kaydeder'); müşteri istekleri raporlarındaki kılavuz önerileri. Kılavuz kuralı: yalnız kullanıcıyı ilgilendiren kısa bilgi; sürüm notu / teknik bilgi YOK; yazım düzeni.
5. PDF (ders 42): docs/kilavuz/pdf-uret.mjs ve docs/kilavuz/pdf-denetle.mjs — nasıl çağrıldıklarını dosyalardan ve 2.5.0 commit'inden ÖĞREN (argüman ister); tarayıcı PLAYWRIGHT_BROWSERS_PATH={SP}/pw-1194 ile (playwright install YOK); üretilen PDF'in yeri 2.5.0 commit'indeki gibi (client/kilavuz/).
6. TESTLER: kılavuzu / CHANGELOG'u / sürümü okuyan testler (git grep ile test/ içinde Kullanim-Kilavuzu, CHANGELOG, DEGISIKLIKLER) + test/yazim-duzeni.test.mjs + test/static.test.mjs ve 'npm run test:kilavuz-metin' (ekran senaryosu; PLAYWRIGHT_BROWSERS_PATH ile) — hepsi yeşil; her koşu tools/kanit.mjs kos ile, kanıt docs/kanit/2026-11-28/aday-belge-*.

## Kabul
A sürüm her yerde 2.5.1; B CHANGELOG kısa ve doğru; C DEĞİŞİKLİKLER + BİLİNEN SINIRLAR eksiksiz (iş listesindeki kaynak satırlarıyla eşleştir — rapora tablo); D kılavuz eklemeleri öneri metinleriyle eşleşir, PDF üretildi ve denetlendi; E ilgili testler yeşil.

{KURALLAR_KULLANICI}

{kurallar('aday-belge', taban=TABAN)}

{rapor()}
"""
open('/home/user/ofis---y-netimi/docs/devir/2.5.1-DEVAM/aday-belge-istem.txt', 'w', encoding='utf-8').write(IST)
print(len(IST))
