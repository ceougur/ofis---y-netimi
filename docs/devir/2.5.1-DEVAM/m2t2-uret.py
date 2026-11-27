#!/usr/bin/env python3
# Değersiz sınırı TUR 2 (dar kontrol M2'nin YÜKSEK-1 + ORTA-2 + ORTA-3) görev metni: m2t2-istem.txt. Ana oturum, 27.11.2026.
src = open('/home/user/ofis---y-netimi/docs/devir/2.5.1-DEVAM/istem-uret.py').read().split('# ---------------------------------------------------------------- P-D')[0]
exec(src)
IS = open('/home/user/ofis---y-netimi/docs/2.5.1-IS-LISTESI.md', encoding='utf-8').read()

def satir(anahtar, metin=IS):
    i = metin.find(anahtar); assert i >= 0, anahtar
    assert metin.find(anahtar, i + 1) < 0, 'tekil değil: ' + anahtar
    b = metin.rfind('\n', 0, i) + 1; e = metin.find('\n', i)
    return metin[b:e].strip()

BM = satir('(DAR KONTROL M2 raporu')
Q2 = satir('S-DKM2-2 (dar kontrol M2 ORTA-2')
Q3 = satir('S-DKM2-3 (dar kontrol M2 ORTA-3')
K_M21 = satir('KULLANICI KARARI 27.11 07:32 UTC').split(' UYGULAMA (baş mimar')[0]
ZINCIR = satir('TEK BORÇ SIRASI ZİNCİRİ (BAŞ MİMAR KARARI')
TABAN = 't251-m2t2-taban'

M2T2 = f"""Sen DestekOfis projesinde 2.5.1'in DEĞERSİZ ALACAK SINIRI TUR 2 kod ajanısın (PARA ÇEKİRDEĞİ: şüpheli alacak; eforun high). Tur 1 (S270 + S268, S-M2-1 = B) ana dala (çalışma dalı) girdi; bağımsız dar kontrolü bir YÜKSEK (hız gerilemesi — ana oturum YENİDEN ÜRETTİ) ve iki ORTA verdi. Temiz bağlamla YALNIZ aşağıdaki işleri yaparsın (ders 46). Kullanıcının gördüğü bir yol ÇOK yavaşladı — önceliğin bu.

{hazirlik(taban=TABAN, taban_ne="çalışma dalı — Değersiz sınırı tur 1 dahil")}
3. Sonra oku: `docs/devir/2.5.1-DEVAM/m2-kararlar.md` (kararlar AYNEN), şüpheli alacak modülü (`server/lib/bank/doubtful.mjs` — sınır hesabı, aday günler, değişmez (i) / (ii), silme / geri yükleme çakışma denetimi), rotası, cari istemcisindeki Değersiz formu ve kartın şüpheli listesini açılışta okuması, kapı ret iletileri (`server/lib/integrity.mjs` — S155 için var olan anlaşılır ileti deseni), fatura iptali ve iade yolları (YALNIZ ilgili yerler). Dar kontrolün betikleri ve ham çıktıları (izinli — senin girdin): `{SP}/dk-m2/betik/` (p1 gün taraması — eşdeğerlik için; p4 yollar; p5b v2.5.0 verisi; p6 liste hızı; p8 iade / iptal) ve `{SP}/dk-m2/cikti/`; ana oturumun yeniden üretimi `{SP}/dkm2-rk/p6-eski-60.txt`, `p6-yeni-60.txt`.

## DOSYA SINIRI
YAZABİLİRSİN: şüpheli alacak modülü ve rotası, cari istemcisinin şüpheli / Değersiz kısmı, kapı ret iletileri (yalnız Değersiz sınırı nedenleri), fatura iptali ve iade yollarında YALNIZ bu karar için çağrılacak denetim, testler, ekran senaryosu, kanıt, rapor. YAZAMAZSIN: tek borç sırası ve girdisi, defter rotası, şüpheli DEFTER türetmesi (TEK BORÇ SIRASI ZİNCİRİ — aşağıda AYNEN; kilit paketi şu an bu dosyalarda çalışıyor), göçler. Gerekirse DUR → 'BAŞ MİMAR KARARI GEREKİYOR'.
{ZINCIR}

## Bulgular ve kararlar (AYNEN)
DAR KONTROL BULGULARI VE BAŞ MİMAR KARARI: {BM}
ÖNCEKİ KULLANICI KARARI (değişmez): {K_M21}
ORTA-2'NİN SORUSU VE YANITI (AYNEN): {Q2}
ORTA-3'ÜN SORUSU VE YANITI (AYNEN): {Q3}

## İşler
0. NASIL BOZULUR (koddan ÖNCE, commit): bağlı tahsilat günü sayısı (0, 1, 60, 250), kayıt sayısı (1, 3), kilitli dönem, Değersiz'den sonra fatura iptali / iadesi / düzenlemesi / bağlı evrakın karşılıksız çıkması, başka kaydın silinmesi / geri yüklenmesi, v2.5.0 gerçek kodunun ürettiği veri, iki saat dilimi.
1. YÜKSEK-1 HIZ (ders 47, 53 (a)): şüpheli kayıt listesi ve formun sınır ucu, bağlı tahsilat günü sayısıyla büyümez. Dar kontrolün önerisi (listede yalnız ilk açık gün ve bugün; uçta yalnız istenen gün + ilk gün + bugün; denemeler tek ayırmanın sonucundan) bir öneridir — doğruluğunu KANITLA: F(S, D)'nin gün ilerledikçe artmadığı önermesi kararların her dalında doğru mu (bağsız tahsilat, Şüpheliden Çıkar, S155 bakiye sınırı, kilit); doğru değilse başka yol. EŞDEĞERLİK TESTİ (kalıcı): eski (tur 1) hesabın ve yeninin listesi / önerisi / sınırı / düğme görünürlüğü dar kontrolün p1 taraması gibi rastgele tohumlarda (en az 4 tohum × 6 cari × 12 adım) İKİ TZ'de BİREBİR. Ölçüm: aynı veri kopyasıyla önce / sonra — 60 ve 250 gün (p6); liste ≤ eski kodun (tur 1 öncesi) birkaç katı, olay döngüsü en çok da yazılır; ölçemiyorsan (yük) 'ÖLÇÜLMEDİ' — ana oturum özel kilitle ölçer.
2. ORTA-2 (S-DKM2-2 = A): Değersiz'den sonra faturanın İPTALİ de İADESİ de, sonuç cariyi Değersiz yüzünden eksiye düşürecekse reddedilir; ileti Türkçe ve ne yapılacağını söyler ('önce Değersiz Alacak satırını silin — bu fatura olmasaydı en çok N yazılabilirdi'; DEVİR NEDEN DURDU düzenindeki dört alan: ne oldu / neden / ne yapmalı / nereye). Değişmez (i)'de: bağlı olduğu fatura W'nin yazım anından sonra değişmiş / iptal edilmiş tahsilat da 'sonradan değişmiş' sayılır — v2.5.0 gerçek verisinde (p5b) Mutabakat YANLIŞ kırmızıya düşmez. Kapı reddinde writeoff-limit / writeoff-balance nedenlerinin anlaşılır Türkçe iletisi (S155 deseniyle). Kararın söylemediği bir yol (fatura TUTARININ düşürülmesi, bağlı evrakın karşılıksız / iade olması) aynı kök nedene giriyorsa ÖLÇ; aynı kuralla mı ele alınmalı, iki okuma çıkıyorsa KODLAMA — 'KULLANICIYA SORULMALI'.
3. ORTA-3 (S-DKM2-3 = C): başka bir şüpheli kaydın silinmesinin reddi KALIR (BİLİNEN SINIR); yalnız ileti düzelir: 'yazıldığı andaki sınırı aşardı' yerine 'bu kayıt silinirse bağsız tahsilat Değersiz yazılan kayda düşer — önce Değersiz Alacak satırını silin' anlamında, dört alanlı.
4. Kalıcı testler: dar kontrolün p4 / p5b / p6 / p8 senaryoları test düzenine; eski kodda (taban) beklenen nedenle kırmızı (NEDEN — ders 38), yenide yeşil iki TZ. Mutasyon: en az — aday günler geri gelsin; iade yolu denetimi kalksın; değişmez (i)'nin fatura değişikliği koşulu kalksın; ileti eski hâline dönsün.
5. Komşular: şüpheli alacak modülünü ve fatura iptali / iade yolunu kullanan HER yol (`git grep`; Değersiz sınırı tur 1 testleri, şüpheli alacak testleri, fatura iptal / iade testleri, Mutabakat / kapı testleri, şema kapısı + geri yükleme — ders 10); ekran senaryosu senaryo-degersiz-siniri-m2-251 iki TZ; `npm run test:kahin-cari` (kodunu okumadan) — iade / iptal reddi kâhinde henüz YOK: beklenen fark listesini rapora yaz (cari kâhininin sonraki bakımı aynı kararı işleyecek).

## Kabul
A yeni testler tabanda beklenen nedenle kırmızı, yenide yeşil iki TZ; B eşdeğerlik testi (hız düzeltmesi) iki TZ birebir; C hız: 250 günde liste ve uç eski koda yakın (sayılar rapora; 'ÖLÇÜLMEDİ' ise ana oturum ölçer); D mutantlar yakalanır; E komşular yeşil; F v2.5.0 verisinde Mutabakat tamam.

{KURALLAR_KULLANICI}
KULLANICI KURALI (27.11, AYNEN: "bir süre ekran başında olmayacağım. sorularına baş mimar önerilerini uygula"): senin kodlama iznin DEĞİLDİR — yeni para / kapama ayrışmasında KODLAMA, 'KULLANICIYA SORULMALI' (öneriyle).

{kurallar('m2t2', taban=TABAN)}

{rapor()}
"""
open('/home/user/ofis---y-netimi/docs/devir/2.5.1-DEVAM/m2t2-istem.txt', 'w', encoding='utf-8').write(M2T2)
print(len(M2T2))
