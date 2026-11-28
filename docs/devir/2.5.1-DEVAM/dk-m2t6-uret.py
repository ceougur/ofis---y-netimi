#!/usr/bin/env python3
# Değersiz sınırı tur 6 dar kontrol görev metni (YALNIZ tur 6 farkı): dk-m2t6-istem.txt. Kararlar iş listesinden AYNEN. Ana oturum, 28.11.2026.
src = open('/home/user/ofis---y-netimi/docs/devir/2.5.1-DEVAM/istem-uret.py').read().split('# ---------------------------------------------------------------- P-D')[0]
exec(src)
_t = open('/home/user/ofis---y-netimi/docs/devir/2.5.1-DEVAM/istem-uret.py').read()
_i = _t.find('def dar('); _j = _t.find('\nDK_D4ON', _i)
exec(_t[_i:_j])
IS = open('/home/user/ofis---y-netimi/docs/2.5.1-IS-LISTESI.md', encoding='utf-8').read()

def satir(anahtar, metin=IS, ilk=False):
    i = metin.find(anahtar); assert i >= 0, anahtar
    if not ilk: assert metin.find(anahtar, i + 1) < 0, 'tekil değil: ' + anahtar
    b = metin.rfind('\n', 0, i) + 1; e = metin.find('\n', i)
    return metin[b:e].strip()

def parca(anahtar, bas, son, metin=IS):
    s = satir(anahtar, metin); a = s.find(bas); assert a >= 0, bas
    b = s.find(son, a) if son else len(s); assert b > a, son
    return s[a:b].strip()

YASAK = f"düzeltme ajanlarının görev metinleri ve raporları (`docs/devir/2.5.1-DEVAM/*-istem.txt`, `*-rapor.md` — özellikle `m2t5-*`, `m2t6-*`), `docs/kanit/2026-11-28/m2t5-*` ve `m2t6-*` (düzeltme ajanlarının kanıtı ve araçları), ana oturumun not defterleri (`m2t6yk*`, `m2t5dkrk*`, `m2t5yk/`); kâhin klasörleri `test/bagimsiz/**` (yalnız `npm run test:kahin-*` komutuyla KOŞABİLİRSİN, kodunu okuma). İZİNLİ: önceki dar kontrollerin betikleri `{SP}/dk-m2t5/` ve `{SP}/dk-m2t4/` (kendi girdin olarak)."

DK = dar("dk-m2t6", "DEĞERSİZ SINIRI TUR 6", "t251-m2t6-taban..t251-m2t6",
 "fatura rotasında Alış Faturası Düzenle'nin Değersiz bakiye denetiminin koşulu (önce yalnız tutar artışında; şimdi cari değişmiyorsa her düzenlemede — peşin ödeme düşürme / kaldırma dahil) ve şüpheli alacak modülünde bu yolun ileti sözü; yeni birim test.",
 "\n".join([
  "- 2.5.0'dan gelen kararlar (S270, S268): `docs/devir/2.5.1-DEVAM/m2-kararlar.md` (OKU, §1).",
  "- " + satir('SK-64 (cari kâhini bakımı 34'),
  "- " + satir('S-DKM2T3-1 (Değersiz sınırı tur 2 + 3 dar kontrolü'),
  "- " + satir('S-M2T5-1 (Değersiz sınırı tur 5 raporu K-1'),
  "- " + satir('S-M2T5-2 (aynı kaynak K-2', ilk=True),
 ]),
 "\n".join([
  "- BU FARKIN KAYNAĞI (tur 5 dar kontrolü) VE KARARLARI: " + satir('(DAR KONTROL DEĞERSİZ SINIRI TUR 5 raporu'),
  "- TUR 5'İN BAŞ MİMAR KARARI (BM-M2T4-3 dahil — 'tahsilat artışı kapsam dışı'; değerlendir: Satış / SMM / Alıştan İade'de peşin tahsilat ARTIŞININ bakiyeyi düşürüp kabul edilmesi bu kararla tutarlı mı): " + parca('(DEĞERSİZ SINIRI TUR 5 raporu — ajan a9a57b6814460a732', 'DEĞİŞEN DAVRANIŞ:', ' AJANIN SAYILARI'),
 ]),
 f"Alış Faturası Düzenle'nin HER biçimi (tutar aynı / artar / azalır × peşin nakit / banka / kredi kartı / verilen çek × düşer / kaldırılır / artar × kalem ekleme / silme / KDV oranı × Hizmet ve Gider Alışı / Stoğa Mal Alışı × cari değişir / değişmez) — bakiye düşüp eksiye iniyorsa ret, değilse kabul mü; reddin atomikliği (fatura, kalemler, stok hareketi, cari satırları, Değişiklik Geçmişi, Silinenler bayt bayt); 'ne yapmalı' yolu gerçekten kabul ettiriyor mu; iletinin sözü doğru mu (tutar artışında da); YANLIŞ yere düşmüyor mu (net 0, tam 0, Değersiz'siz / silinmiş cari, dönem kilidi önce); cari değişiminde eski / yeni carinin bakiyesi; Değersiz'siz caride eklenen işin hızı (100 bin satırda alış faturası Düzenle — özel kilit `flock -x -w 1800 {SP}/olcum.lock`, alamazsan 'ÖLÇÜLEMEDİ'); iki saat dilimi; kâhin farkı; başka hiçbir yolun davranışının değişmediği.",
 YASAK)
open('/home/user/ofis---y-netimi/docs/devir/2.5.1-DEVAM/dk-m2t6-istem.txt', 'w', encoding='utf-8').write(DK)
print(len(DK))
