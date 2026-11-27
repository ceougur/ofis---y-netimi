#!/usr/bin/env python3
# D3 TUR 6 (dar kontrol D3'ün ORTA-1'i) görev metni: d3t6-istem.txt. Ana oturum, 27.11.2026.
src = open('/home/user/ofis---y-netimi/docs/devir/2.5.1-DEVAM/istem-uret.py').read().split('# ---------------------------------------------------------------- P-D')[0]
exec(src)
IS = open('/home/user/ofis---y-netimi/docs/2.5.1-IS-LISTESI.md', encoding='utf-8').read()

def satir(anahtar, metin=IS):
    i = metin.find(anahtar); assert i >= 0, anahtar
    assert metin.find(anahtar, i + 1) < 0, 'tekil değil: ' + anahtar
    b = metin.rfind('\n', 0, i) + 1; e = metin.find('\n', i)
    return metin[b:e].strip()

BM = satir('(DAR KONTROL D3 TUR 1–5 raporu')
NEDEN = satir('KULLANICI KARARI 27.11 11:39 UTC (AYNEN: "devir yapılırken').split(' UYGULAMA SIRASI:')[0]
ZINCIR = satir('TEK BORÇ SIRASI ZİNCİRİ (BAŞ MİMAR KARARI')
TABAN = 't251-d3t6-taban'

D3T6 = f"""Sen DestekOfis projesinde 2.5.1'in D3 TUR 6 kod ajanısın (devir saf hesabı; PARA ÇEKİRDEĞİNE YAKIN; eforun high; DEVİR YERİ). D3 tur 1–5 ana dala (çalışma dalı) girdi; bağımsız dar kontrolü bir ORTA bulgu verdi, ana oturum iki saat diliminde YENİDEN ÜRETTİ. Temiz bağlamla YALNIZ bu bulguyu ve aynı kök nedenin komşularını düzeltirsin (ders 46). D3 hâlâ HİÇBİR ŞEY YAZMAZ (plan + ön izleme + ön denetim + Devir Raporu).

{hazirlik(taban=TABAN, taban_ne="çalışma dalı d183d780 — sınama ağacı 3 birleşimi, D3 tur 1–5 dahil")}
3. Sonra oku: `docs/devir/D3-D4-TASARIM.md` §3 (saf hesap), devir modülü `server/lib/devir/**` (özellikle plan okuyucu), programın taksit kartı kapanış günü tanımı (taksit kartı rotası ve defter türetmesi — YALNIZ OKU), göç 17 ve göç 53 (kapalı kart, `closed_at`, `close_rule`).

## DOSYA SINIRI
YAZABİLİRSİN: `server/lib/devir/**` (yalnız plan okuyucu ve gerekiyorsa plan hesabının kart kapanışını okuyan yeri), testler, test yardımcıları, kanıt, rapor. YAZAMAZSIN: tek borç sırası ve girdisi, defter rotası, şüpheli defter türetmesi (TEK BORÇ SIRASI ZİNCİRİ — aşağıda AYNEN; kilit paketi şu an bu dosyalarda çalışıyor), göçler, istemci. Gerekirse DUR → 'BAŞ MİMAR KARARI GEREKİYOR'.
{ZINCIR}

## Bulgu ve karar (AYNEN)
{BM}
DEVİR NEDEN DURDU (AYNEN — ileti eklersen bu düzenle): {NEDEN}

## İşler
0. NASIL BOZULUR (koddan ÖNCE, commit): kartın kapanış bilgisinin her biçimi — `closed_at` dolu / boş (2.0.13 öncesi) × `close_rule` (2.4.9 kalanı silinir / sonraki kural) × kapanış K öncesi / K günü / K sonrası × carili / carisiz kart × faturası iptal edilmiş kapalı kart × Borçta Kalsın ile kapanmış kart; v2.0.12, v2.4.9 ve v2.5.0 gerçek kodunun ürettiği veri.
1. ÖNCE ÖLÇ (kod değiştirmeden; kanıt): devir modülünde kart kapanış gününü okuyan HER yer (`git grep -n "closed_at" server/lib/devir`) ve her biri için programın kendi tanımıyla (`COALESCE(closed_at, substr(updated_at, 1, 10))` — programdaki yerleri rapora dosya:satır) uyumu.
2. Düzeltme: devir planı kart kapanış gününü programın TANIMIYLA okur (en küçük düzeltme: aynı COALESCE ifadesi); kartın kapalı / açık sayımı, kalanı, carinin devir satırı ve ön izleme sayıları devirsiz programla aynı. Dar kontrolün DOĞRULANMADI maddesi (carisiz kartın K'de kapalı sayılmaması → kalanın 127'ye 'cover' edilip sebepsiz 'Hesap Bakiyesi Modülle Tutmuyor' durdurması) düzeltmeden sonra ÖLÇÜLÜR (üretilebiliyorsa test; üretilemiyorsa nedeniyle DOĞRULANMADI).
3. KALICI TEST — v2.0.12'nin GERÇEK koduyla üretilmiş veri (`git worktree add --detach` kopyası; v2.0.12'nin kendi API'sinden: iki cari, her biri 1.000 TL / 2 taksitli kart + 300 TL tahsilat, biri kapatılmış): devirsiz program kapalı kartın carisinde bakiye 0, planRemaining 0; devir planı aynı kartı KAPALI, kalan 0, ön izleme `taksitKarti` 1 açık / 700,00 TL + 1 kapalı. Ana oturumun yeniden üretim betikleri ve çıktısı: `docs/kanit/2026-11-27/ana-dkd3/` (v2012-uret.mjs, v2012-devir.mjs; bugünkü kodda `taksitKarti {{"acik":2,"kalanMinor":140000,"kapali":0}}`) — betiği test düzenine çevirebilirsin. Eski kodda (taban) beklenen nedenle kırmızı (NEDENİ yazılır — ders 38), yenide yeşil iki TZ. Test sürüm etiketi isteyen kopyayı `git worktree add --detach` ile açar, iş bitince `git worktree remove` (zorlamasız); GIT_DIR / GIT_WORK_TREE YOK (ders 54).
4. Komşular: D3'ün bütün testleri + gerçek veri karşılaştırması (3 tohum × 2 TZ; S-T4-1 sınıfı ayrı sayaçta AYNEN) + `npm run test:kahin-defter` + `npm run test:kahin-cari` iki TZ + D3 mutasyon tabanı (tur 1–5'in 64'ü AYNEN) + bu turun en az iki mutantı (kapanış günü yalnız `closed_at`'tan okunsun; `updated_at` yedeği tarihsiz okunsun).

## Kabul
A yeni test taban kodda beklenen nedenle kırmızı, yenide yeşil iki TZ; B D3 testleri + gerçek veri + kâhinler + mutasyon (64 + yeni) iki TZ yeşil, açıklanmamış fark 0; C ileti kataloğu (D3'ün üreticisiyle) iç kod / İngilizce / tablo adı 0; D hız: öğe başına ağır okuma eklenmez (ders 47).

{KURALLAR_KULLANICI}

{kurallar('d3t6', taban=TABAN)}

{rapor()}
"""
open('/home/user/ofis---y-netimi/docs/devir/2.5.1-DEVAM/d3t6-istem.txt', 'w', encoding='utf-8').write(D3T6)
print(len(D3T6))
