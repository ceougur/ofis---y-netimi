#!/usr/bin/env python3
# Değersiz sınırı tur 2 + 3 TEK dar kontrol görev metni: dk-m2t3-istem.txt. Kararlar iş listesinden AYNEN. Ana oturum, 28.11.2026.
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

YASAK = "düzeltme ajanlarının görev metinleri ve raporları (`docs/devir/2.5.1-DEVAM/*-istem.txt`, `*-rapor.md` — özellikle `m2-*`, `m2k-*`, `m2t2-*`, `m2t3-*`), ana oturumun yeniden koşu not defterleri; kâhin klasörleri `test/bagimsiz/**` (yalnız `npm run test:kahin-*` komutuyla KOŞABİLİRSİN, kodunu okuma)"

DK = dar("dk-m2t3", "DEĞERSİZ SINIRI TUR 2 + 3", "t251-m2t2-taban..t251-m2t3",
 "Değersiz Alacak sınırının hız düzeltmesi (şüpheli kayıt listesi ve formun sınır ucu bağlı tahsilat günü sayısıyla büyümez — eşdeğerlik testi), Değersiz'den sonra fatura iptali / iadesi / Düzenle ile tutar düşürme / cari değişikliği cariyi eksiye götürecekse reddi (iki tur: önce 'Değersiz yüzünden', sonra her eksiye götüren), değişmez (i)'nin 'sonradan değişmiş' sayımı, kapı ret iletileri (writeoff-limit / writeoff-balance), başka şüpheli kaydın silinmesi reddinin iletisi; testler, v2.5.0 gerçek verisi fikstürü, bir ekran senaryosu (senaryo-degersiz-iptal-m2t2-251).",
 "\n".join([
  "- 2.5.0'dan gelen kararlar (S270, S268) ve kâhin girdisi: `docs/devir/2.5.1-DEVAM/m2-kararlar.md` (ana oturumun karar özeti — OKU, tamamı).",
  "- " + satir('KULLANICI KARARI 27.11 07:32 UTC').split(' UYGULAMA (baş mimar')[0],
  "- " + satir('S-DKM2-2 (dar kontrol M2 ORTA-2'),
  "- " + satir('S-DKM2-3 (dar kontrol M2 ORTA-3'),
  "- " + satir('S-M2T2-1 ('),
  "- " + satir('S-M2T2-2 ('),
 ]),
 "\n".join([
  "- DAR KONTROL M2'NİN BULGULARI VE BAŞ MİMAR KARARI (tur 2'nin kaynağı): " + satir('(DAR KONTROL M2 raporu'),
  "- TUR 2 İÇİN BAŞ MİMAR KARARLARI: " + parca('(DEĞERSİZ SINIRI TUR 2 raporu', 'KARARLAR:', None),
  "- TUR 3 İÇİN BAŞ MİMAR KARARLARI: " + parca('(DEĞERSİZ SINIRI TUR 3 raporu', 'KARARLAR:', ' SIRA:'),
  "- ANA OTURUM: tur 2 + 3 yeniden koşusu ajanla uyumlu; mutant M8 ('önceki gün kesiti aynı günü de alır') tur 2'den beri YAŞIYOR — eşdeğer mi, yoksa eksik test mi? DEĞERLENDİR (betikle). Hız kabul: liste / kart / form ucu / Değersiz Yaz / geri yükleme tur 1 öncesi ↔ tur 1 ↔ tur 3 aynı (Değersiz Yaz ve geri yükleme ~6 sn tur 1 öncesinde de).",
 ]),
 "hız düzeltmesinin doğruluğu (F(S, D)'nin gün ilerledikçe artmadığı önermesi kararların HER dalında — bağsız tahsilat, Şüpheliden Çıkar, S155 bakiye sınırı, dönem kilidi; eşdeğerlik testinin gerçekten eski tam hesabı mı karşılaştırdığı); reddin HER yolu (Fatura İptal Et, Sil, e-Belge iptali, Ters Kaydet, Satıştan İade yeni / Düzenle, satış faturası / SMM / alıştan iade Düzenle — tutar düşürme, cari değiştirme, kalem silme, KDV oranı değişikliği, taksitli fatura Düzenle'si; toplu / Excel yolu varsa; bağlı çekin karşılıksız çıkması) — ya reddediliyor ya da kararın kapsamı dışında mı (iki okuma çıkarsa KULLANICIYA SORULMALI); reddin YANLIŞ yere düşmediği (Değersiz satırı olmayan cari, tutar artışı, eksiye götürmeyen azalış, peşin tahsilat eklenen Düzenle, bakiyeyi düşürmeyen işlem); ret iletisinin dört alanı (ne oldu / neden / ne yapmalı / nereye — DEVİR NEDEN DURDU düzeni) ve iletideki 'en çok N yazılabilirdi' sayısının doğruluğu (Düzenle 2.900 → 100'de iki okuma: 200 / 0 — DOĞRULANMADI); Değersiz satırı silinince aynı işlemin kabulü ve Mutabakat; v2.5.0 gerçek verisinde (fikstür) Mutabakat yanlış kırmızı yok; dönem kilidi iletisinin önce gelmesi; iki şirket; yedek geri yükleme; iki saat dilimi; tek borç sırası / defter rotasına DOKUNULMADIĞI (TEK BORÇ SIRASI ZİNCİRİ); yeni sorgu / öğe başına okuma (ders 47).",
 YASAK)
open('/home/user/ofis---y-netimi/docs/devir/2.5.1-DEVAM/dk-m2t3-istem.txt', 'w', encoding='utf-8').write(DK)
print(len(DK))
