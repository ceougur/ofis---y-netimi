#!/usr/bin/env python3
# D3 tur 6 dar kontrol görev metni: dk-d3t6-istem.txt. Kararlar iş listesinden AYNEN. Ana oturum, 28.11.2026.
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

NEDEN = satir('KULLANICI KARARI 27.11 11:39 UTC (AYNEN: "devir yapılırken').split(' UYGULAMA SIRASI:')[0]
YASAK = "düzeltme ajanlarının görev metinleri ve raporları (`docs/devir/2.5.1-DEVAM/*-istem.txt`, `*-rapor.md` — özellikle `d3*`; ileti kataloğunu KENDİN üret), ana oturumun yeniden koşu not defterleri; kâhin klasörleri `test/bagimsiz/**` (yalnız `npm run test:kahin-*` komutuyla KOŞABİLİRSİN, kodunu okuma)"

DK = dar("dk-d3t6", "D3 TUR 6 (devir saf hesabı — kart kapanış günü)", "t251-d3t6-taban..t251-d3-tur6",
 "devir plan okuyucusunun taksit kartı kapanış gününü programın kendi tanımıyla okuması (programın yardımcısı içe aktarıldı), kartın kapalı / açık sayımı, kalanı, carinin devir satırı ve ön izleme sayıları; v2.0.12'nin GERÇEK koduyla üretilmiş veriyi okuyan kalıcı test (eski sürüm kopyası `git worktree add --detach` ile), iki mutant; testler.",
 "- DEVİR NEDEN DURDU (AYNEN): " + NEDEN,
 "\n".join([
  "- DAR KONTROL D3 TUR 1–5'İN BULGUSU VE BAŞ MİMAR KARARI (bu farkın kaynağı; AYNEN): " + parca('(DAR KONTROL D3 TUR 1–5 raporu', 'ORTA-1', ' DÜŞÜK-1'),
  "- TUR 6 İÇİN BAŞ MİMAR KARARLARI (AYNEN): " + parca('(D3 TUR 6 raporu', 'KARARLAR:', ' ANA OTURUM YENİDEN KOŞUSU'),
 ]),
 "kart kapanış gününün HER biçimi (`closed_at` dolu / boş — 2.0.13 öncesi; `close_rule` 2.4.9 kalanı silinir / sonraki kural; kapanış K öncesi / K günü / K sonrası; carili / carisiz kart; faturası iptal edilmiş kapalı kart; Borçta Kalsın ile kapanmış kart; yeniden açılmış kart) — devirsiz program ile devir planı AYNI sonucu mu veriyor (kapalı / açık, kalan, carinin devir satırı, ön izleme `taksitKarti` sayısı, budama ölçütü); dar kontrolün DOĞRULANMADI maddesi (carisiz kartın K'de kapalı sayılmaması → kalanın 127'ye 'cover' edilip sebepsiz 'Hesap Bakiyesi Modülle Tutmuyor' durdurması) gerçekten kapandı mı; devir modülünde kart kapanışını okuyan BAŞKA yer kaldı mı (`git grep`); v2.0.12, v2.4.9 ve v2.5.0 gerçek kodunun ürettiği veri; kalıcı testin eski sürüm kopyasını açıp kapatması (Windows'ta dosya kilidi — ders 48; GIT_DIR / GIT_WORK_TREE yok — ders 54; kopya temizleniyor mu, ortak klasöre yazıyor mu, CI'de sürüm etiketi yoksa ne oluyor — sığ klon!); saat dilimi (TZ=UTC ve TZ=Europe/Istanbul — gün sınırında kapanış); öğe başına ağır okuma eklenmiş mi (ders 47); iki mutantın dişi.",
 YASAK)
_eski = "(kendi ağacında `git log --oneline -1` ile `t251-d3-tur6` ucunun geçmişte olduğunu doğrula)"
assert DK.count(_eski) == 1
DK = DK.replace(_eski, "(D3 tur 6 henüz ana dala GİRMEDİ: kendi ağacında, kendi commit'in YOKKEN `git reset --hard t251-d3-tur6`; `git log --oneline -1` ile aa6dfe29'u doğrula)")
open('/home/user/ofis---y-netimi/docs/devir/2.5.1-DEVAM/dk-d3t6-istem.txt', 'w', encoding='utf-8').write(DK)
print(len(DK))
