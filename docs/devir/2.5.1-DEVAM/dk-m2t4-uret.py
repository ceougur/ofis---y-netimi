#!/usr/bin/env python3
# Değersiz sınırı tur 4 dar kontrol görev metni (YALNIZ tur 4 farkı): dk-m2t4-istem.txt. Kararlar iş listesinden AYNEN. Ana oturum, 28.11.2026.
src = open('/home/user/ofis---y-netimi/docs/devir/2.5.1-DEVAM/istem-uret.py').read().split('# ---------------------------------------------------------------- P-D')[0]
exec(src)
_t = open('/home/user/ofis---y-netimi/docs/devir/2.5.1-DEVAM/istem-uret.py').read()
_i = _t.find('def dar('); _j = _t.find('\nDK_D4ON', _i)
exec(_t[_i:_j])
IS = open('/home/user/ofis---y-netimi/docs/2.5.1-IS-LISTESI.md', encoding='utf-8').read()

def satir(anahtar, metin=IS):
    i = metin.find(anahtar); assert i >= 0, anahtar
    assert metin.find(anahtar, i + 1) < 0, 'tekil değil: ' + anahtar
    b = metin.rfind('\n', 0, i) + 1; e = metin.find('\n', i)
    return metin[b:e].strip()

def parca(anahtar, bas, son, metin=IS):
    s = satir(anahtar, metin); a = s.find(bas); assert a >= 0, bas
    b = s.find(son, a) if son else len(s); assert b > a, son
    return s[a:b].strip()

YASAK = f"düzeltme ajanlarının görev metinleri ve raporları (`docs/devir/2.5.1-DEVAM/*-istem.txt`, `*-rapor.md` — özellikle `m2-*`, `m2k-*`, `m2t2-*`, `m2t3-*`, `m2t4-*`), `docs/kanit/2026-11-28/m2t4-*` (düzeltme ajanının kanıtı), ana oturumun yeniden koşu not defterleri (`m2t4rk/`, `m2t4yk/`); kâhin klasörleri `test/bagimsiz/**` (yalnız `npm run test:kahin-*` komutuyla KOŞABİLİRSİN, kodunu okuma). İZİNLİ: önceki dar kontrolün betikleri `{SP}/dk-m2t3/` (kendi girdin olarak)."

DK = dar("dk-m2t4", "DEĞERSİZ SINIRI TUR 4", "t251-m2t4-taban..t251-m2t4",
 "şüpheli alacak modülünde değişmez (i)'nin dünyası (W'den SONRA yazılmış Değersiz satırlarının kuyruk kesitinden de çıkarılması — formun önerdiği tutarın kapıda kabulü), Silinenler taramasının dizinli ve en eski Değersiz satırından sonraki silmelerle sınırlanması (hız), S155'e takılan retlerde 'Değersiz Alacak satırını silmek yetmez' iletisi; cari hareketi (Borç Yaz) düzeltme / silme ve taksit kartı düzenleme / silme yollarında eksiye götürme denetimi; testler (40 tohumlu rastgele dahil) ve ekran senaryosu senaryo-degersiz-iptal-m2t2-251'in adım 4 / 6'sı.",
 "\n".join([
  "- 2.5.0'dan gelen kararlar (S270, S268) ve kâhin girdisi: `docs/devir/2.5.1-DEVAM/m2-kararlar.md` (ana oturumun karar özeti — OKU, tamamı).",
  "- " + satir('KULLANICI KARARI 27.11 07:32 UTC').split(' UYGULAMA (baş mimar')[0],
  "- " + satir('S-DKM2-2 (dar kontrol M2 ORTA-2'),
  "- " + satir('S-M2T2-1 ('),
  "- " + satir('S-M2T2-2 ('),
  "- " + satir('S-DKM2T3-1 (Değersiz sınırı tur 2 + 3 dar kontrolü'),
  "- " + satir('SK-64 (cari kâhini bakımı 34') + " — NOT: bu karar (Ödeme satırı silme / Alacak Yaz artırma reddi) bu farkta HENÜZ KODLANMADI (sonraki tura) — eksikliği bulgu sayma, ama kodlanırken çakışacak bir şey görürsen yaz.",
 ]),
 "\n".join([
  "- BU FARKIN KAYNAĞI (önceki dar kontrol): " + parca('(DAR KONTROL DEĞERSİZ SINIRI TUR 2 + 3 raporu', 'YÜKSEK YOK.', ' DOĞRULANAN:'),
  "- BU TURUN BAŞ MİMAR YORUMLARI (DEĞERLENDİR): " + parca('(DEĞERSİZ SINIRI TUR 4 raporu', '(2) BM-M2T4-1', ' (5) SIRA'),
  "- ANA OTURUMUN MUTANTI (değerlendir): S155 ileti yardımcısındaki 'sonradan yazılan Değersiz satırlarını kuyruktan çıkar' kopyası boşa çıkarılınca yeni test 0 kırmızı (YAŞIYOR) — yalnız iletinin cümle seçimi mi, yoksa yanlış 'ne yapmalı' iletisi üreten gerçek bir durum var mı? Betikle göster.",
 ]),
 "ORTA-2 düzeltmesinin (değişmezin gevşemesi) her yönü: gevşeyen değişmez HİÇBİR sırada S270'i bozan bir yazıma izin veriyor mu (iki Değersiz satırı × farklı şüpheli kayıtlar × bağlı / bağsız tahsilat × sonradan silme / geri yükleme / Şüpheliden Çıkar × aynı gün sırası); önerilen tutar her durumda kabul, sınır + 1 kuruş her durumda ret mi; Silinenler taramasının daraltılmasının (en eski Değersiz satırından sonraki silmeler) kaçırdığı ihlal var mı (Değersiz satırı silinip yeniden yazılmış, eski tarihli silme geri yüklenmiş, iki şirket, yedek geri yükleme) — eşdeğerlik iddiasını kendi üretecinle sına; Borç Yaz / taksit kartı denetiminin HER yolu (tek satır Düzenle / Sil, Silinenler'den geri yükleme, toplu işlem / Excel yolu varsa, kartın taksitlerinin tek tek silinmesi, kartın başka cariye taşınması, kart Yapılandır / Borçta Kalsın) ve YANLIŞ yere düşmemesi (Değersiz satırı olmayan cari, eksiye götürmeyen azalış, tutar artışı, tarih değişikliği, Değersiz satırı silindikten sonra); ret iletilerinin dört alanı ve iletideki sayıların doğruluğu ('silmek yetmez' iletisinin önerdiği yol GERÇEKTEN işlemi kabul ettiriyor mu); kâhin cari farkı; hız (Mutabakat ve tahsilat yazımı Silinenler doluyken — özel kilitle, alamazsan 'ÖLÇÜLEMEDİ'); dönem kilidi iletisinin önce gelmesi; iki saat dilimi; tek borç sırası / defter rotası / şüpheli defter türetmesine DOKUNULMADIĞI.",
 YASAK)
_eski = "(kendi ağacında `git log --oneline -1` ile `t251-m2t4` ucunun geçmişte olduğunu doğrula)"
assert DK.count(_eski) == 1
open('/home/user/ofis---y-netimi/docs/devir/2.5.1-DEVAM/dk-m2t4-istem.txt', 'w', encoding='utf-8').write(DK)
print(len(DK))
