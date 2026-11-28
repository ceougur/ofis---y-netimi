#!/usr/bin/env python3
# Değersiz sınırı tur 5 dar kontrol görev metni (YALNIZ tur 5 farkı): dk-m2t5-istem.txt. Kararlar iş listesinden AYNEN. Ana oturum, 28.11.2026.
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

YASAK = f"düzeltme ajanlarının görev metinleri ve raporları (`docs/devir/2.5.1-DEVAM/*-istem.txt`, `*-rapor.md` — özellikle `m2-*`, `m2t2-*` … `m2t5-*`), `docs/kanit/2026-11-28/m2t5-*` (düzeltme ajanının kanıtı ve araçları), ana oturumun not defterleri (`m2t5yk/`, `m2t4yk/`, `m2t4dkrk-cikti/`); kâhin klasörleri `test/bagimsiz/**` (yalnız `npm run test:kahin-*` komutuyla KOŞABİLİRSİN, kodunu okuma). İZİNLİ: önceki dar kontrollerin betikleri `{SP}/dk-m2t4/` ve `{SP}/dk-m2t3/` (kendi girdin olarak)."

DK = dar("dk-m2t5", "DEĞERSİZ SINIRI TUR 5", "t251-m2t5-taban..t251-m2t5",
 "şüpheli alacak modülünde bakiye denetimine işlem türü ve ileti sözcükleri, Silinenler taramasının yeniden düzeni (yalnız sonucu okuyabilecek satır varken ve en eskisinden; tek cari dizinli sorgu, çok cari tek geçiş); cari hareketi rotasında Ödeme / POS İadesi silme-düzeltme ve Alacak artırma denetimi; taksit kartı rotasında Otomatik Dağıt (yazımdan önce kurulan denetim, aynı işlem içinde) ve kart ödeme / iade hareketi; fatura rotasında Alış Faturası Düzenle tutar artışı; testler (eşdeğerlik tohumları dahil) ve ekran senaryosu senaryo-degersiz-iptal-m2t2-251'in adım 7'si.",
 "\n".join([
  "- 2.5.0'dan gelen kararlar (S270, S268): `docs/devir/2.5.1-DEVAM/m2-kararlar.md` (OKU, tamamı).",
  "- " + satir('KULLANICI KARARI 27.11 07:32 UTC').split(' UYGULAMA (baş mimar')[0],
  "- " + satir('S-M2T2-1 ('),
  "- " + satir('S-M2T2-2 ('),
  "- " + satir('S-DKM2T3-1 (Değersiz sınırı tur 2 + 3 dar kontrolü'),
  "- " + satir('SK-64 (cari kâhini bakımı 34'),
  "- " + satir('S-M2T5-1 (Değersiz sınırı tur 5 raporu K-1'),
  "- " + satir('S-M2T5-2 (aynı kaynak K-2'),
  "- " + satir('S-251Y-1 (yayın kapsamı'),
 ]),
 "\n".join([
  "- BU FARKIN KAYNAĞI (tur 4 dar kontrolü): " + satir('(DAR KONTROL DEĞERSİZ SINIRI TUR 4 raporu'),
  "- BU TURUN BAŞ MİMAR KARARLARI (DEĞERLENDİR — özellikle (2) stok satışı / verilen senet silme koruması SONRAKİ SÜRÜME: SK-64'ün 'tek kural' sözüyle bu bir ORTA eksik mi; (4) kart hareketi ve Alış Faturası tutar artışının kurala alınması doğru okuma mı; tahsilat artışının kural DIŞINDA kalması BM-M2T4-3 ile tutarlı mı): " + parca('(DEĞERSİZ SINIRI TUR 5 raporu', 'KARARLAR:', ' SIRA:'),
 ]),
 f"SK-64'ün HER yolu (Ödeme silme / düşürme / türünü ya da carisini değiştirme / tarih değişikliği, Alacak Yaz artırma / başka cariye taşıma, POS İadesi silme — POS İşlemleri ekranından ve cari kartından, taksit kartı ödeme / iade hareketi, Alış Faturası Düzenle, Silinenler'den geri yükleme, toplu / Excel yolu varsa) ya reddediliyor ya da kararın kapsamı dışında mı (S-M2T5-1 / 2 = A: taşınan Alacak ve Silinenler'den geri yükleme KABUL — bulgu sayma, ama tutarlılığını değerlendir); reddin YANLIŞ yere düşmediği (Değersiz satırı olmayan / silinmiş cari, bakiyeyi tam 0'a getiren işlem, tutar artışı yönündeki Ödeme, yeni Alacak Yaz, yeni tahsilat, tahsilat artışı); 'ne yapmalı' iletisinin söylediği yol GERÇEKTEN işlemi kabul ettiriyor mu ve iletinin sözcüğü işlemin kendi adı mı; Otomatik Dağıt reddinin atomikliği (kart, taksitler, Değişiklik Geçmişi, cari satırları bayt bayt) ve dönem kilidi iletisinin önce gelmesi; Silinenler taramasının yeni düzeninin kaçırdığı ihlal (Değersiz satırı silinip yeniden yazılmış, eski tarihli silme geri yüklenmiş, başka carinin faturası, iki şirket, yedek geri yükleme — eşdeğerlik iddiasını kendi üretecinle sına; 'tarama gerekmez' kısa yolunun doğruluğu); hız (Mutabakat ve tahsilat yazımı, Silinenler 5.000 / 20.000, silme anı Değersiz'den önce / sonra, en kötü sınıf — özel kilit `flock -x -w 1800 {SP}/olcum.lock`, alamazsan 'ÖLÇÜLEMEDİ'); kâhin cari / defter farkı (kâhin bu kuralları bilmiyor — fark çıkarsa sınıflandır); iki saat dilimi; tek borç sırası / defter rotası / şüpheli defter türetmesine DOKUNULMADIĞI.",
 YASAK)
open('/home/user/ofis---y-netimi/docs/devir/2.5.1-DEVAM/dk-m2t5-istem.txt', 'w', encoding='utf-8').write(DK)
print(len(DK))
