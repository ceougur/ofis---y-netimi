#!/usr/bin/env python3
# Değersiz sınırı TUR 6 (tur 5 dar kontrolünün ORTA-1'i — Alış Faturası Düzenle'de peşin ödeme) görev metni: m2t6-istem.txt. Kararlar iş listesinden AYNEN. Ana oturum, 28.11.2026.
src = open('/home/user/ofis---y-netimi/docs/devir/2.5.1-DEVAM/istem-uret.py').read().split('# ---------------------------------------------------------------- P-D')[0]
exec(src)
IS = open('/home/user/ofis---y-netimi/docs/2.5.1-IS-LISTESI.md', encoding='utf-8').read()

def satir(anahtar, metin=IS):
    i = metin.find(anahtar); assert i >= 0, anahtar
    assert metin.find(anahtar, i + 1) < 0, 'tekil değil: ' + anahtar
    b = metin.rfind('\n', 0, i) + 1; e = metin.find('\n', i)
    return metin[b:e].strip()

BM = satir('(DAR KONTROL DEĞERSİZ SINIRI TUR 5 raporu')
BM5 = satir('(DEĞERSİZ SINIRI TUR 5 raporu — ajan a9a57b6814460a732')
SK64 = satir('SK-64 (cari kâhini bakımı 34')
Q = satir('S-DKM2T3-1 (Değersiz sınırı tur 2 + 3 dar kontrolü')
Q4 = satir('S-M2T2-1 (')
K51 = satir('S-M2T5-1 (Değersiz sınırı tur 5 raporu K-1')
K52 = satir('S-M2T5-2 (aynı kaynak K-2')
NEDEN = satir('KULLANICI KARARI 27.11 11:39 UTC (AYNEN: "devir yapılırken').split(' UYGULAMA SIRASI:')[0]
ZINCIR = satir('TEK BORÇ SIRASI ZİNCİRİ (BAŞ MİMAR KARARI')
TABAN = 't251-m2t6-taban'
DK = SP + '/dk-m2t5'
RK = SP + '/m2t5dkrk-cikti'

M2T6 = f"""Sen DestekOfis projesinde 2.5.1'in DEĞERSİZ ALACAK SINIRI TUR 6 kod ajanısın (PARA ÇEKİRDEĞİ: şüpheli alacak; eforun high). Tur 1–5 çalışma dalında; tur 5'in bağımsız dar kontrolü bir ORTA bulgu verdi, ana oturum iki TZ YENİDEN ÜRETTİ. Bu DAR bir turdur: temiz bağlamla YALNIZ bu bulguyu düzeltirsin (ders 46). Başka yolu (stok, çek / senet) KODLAMAZSIN — onlar baş mimar kararıyla sonraki sürüme.

{hazirlik(taban=TABAN, taban_ne="çalışma dalı ucu — Değersiz sınırı tur 1–5, KDV Özeti küçük tur 1–7 dahil")}
3. Sonra oku: fatura rotasında Alış Faturası Düzenle'nin Değersiz bakiye denetimi (`server/routes/invoices.mjs` — tur 5'in eklediği `existing.kind === "purchase" && decrease < -0.005` koşulu ve çevresi; peşin ödemenin cari kartına Ödeme satırı olarak yazılışı), şüpheli alacak modülündeki bakiye denetimi ve ileti sözcükleri (`server/lib/bank/doubtful.mjs` — `writeOffBalanceGuard`, `kind`), tur 5'in testi `test/supheli-degersiz-m2t5-251.test.mjs` (YALNIZ Alış Faturası bölümü ve yardımcılar). Dar kontrolün betikleri ve ham çıktıları (izinli — senin girdin): `{DK}/a-yollar.mjs` (A1 / A2 / A3 — bulgu; `node a-yollar.mjs <kök>`), `{DK}/b-ek.mjs` (B4 — net 0 durumu), çıktılar `a-utc.txt`, `b-ist.txt`; ana oturumun yeniden üretimi `{RK}/a-yollar.txt`, `{RK}/b-ek.txt`.

## DOSYA SINIRI
YAZABİLİRSİN: fatura rotasında YALNIZ Alış Faturası (ve aynı düzenleme yolundan geçen başka ALIŞ yönlü fatura türü varsa — gider / SMM alış — ölç, aynı sınıftaysa aynı kural) Düzenle'nin Değersiz bakiye denetimi, şüpheli alacak modülünde YALNIZ ileti sözcüğü, testler, kanıt, rapor. YAZAMAZSIN: stok modülü, çek / senet modülü, tek borç sırası, defter rotası, şüpheli defter türetmesi, göçler, KDV Özeti, kâhin klasörleri (TEK BORÇ SIRASI ZİNCİRİ — aşağıda AYNEN). Gerekirse DUR → 'BAŞ MİMAR KARARI GEREKİYOR'.
{ZINCIR}

## Bulgu ve kararlar (AYNEN)
DAR KONTROLÜN BULGUSU VE BAŞ MİMAR KARARI (karar (1) senin işin; (2) senin işin DEĞİL): {BM}
PARA KURALI (AYNEN): {SK64}
TUR 5'İN BAŞ MİMAR KARARI (değişmez — senin tabanın): {BM5}
ÖNCEKİ KARARLAR (değişmez): {Q}
{Q4}
{K51}
{K52}
DEVİR NEDEN DURDU İLETİ DÜZENİ (ret iletileri bu düzende — AYNEN): {NEDEN}

## İşler
0. NASIL BOZULUR (koddan ÖNCE, commit): Alış Faturası Düzenle × tutar aynı / artar / azalır × peşin ödeme aynı / düşer / kaldırılır / artar × net etki (bakiye düşer ve eksi / düşer ama eksi değil / tam 0 / artar) × cari değişir / değişmez × Değersiz satırı var / silinmiş / hiç yok × dönem kilidi; aynı yoldan geçen başka alış türleri; iki saat dilimi.
1. Kod: Alış Faturası Düzenle'de cari değişmiyorsa Değersiz bakiye denetimi tutar koşulsuz kurulur (dar kontrolün önerisi; denetim zaten yalnız 'bakiye düştü ve eksi' iken reddeder); iletinin sözü 'Alış faturası düzenlenemez' ve işlem açıklaması 'alış faturasının düzenlenmesi' (tutar artışında da doğru okunmalı). Cari DEĞİŞİYORSA bugünkü davranış (tur 5) AYNEN.
2. KALICI TESTLER: dar kontrolün vakaları AYNEN (taban T + alış 500 + peşin 500 + avans 1.000 → bakiye −576,45; peşin 500 → 100: 409, bakiye −576,45 kalır; peşin kaldırıldı: 409; ret atomik — fatura, cari satırları, Silinenler bayt bayt aynı); 'ne yapmalı' yolu izlenince kabul; YANLIŞ yere düşmüyor: net 0 (B4: 100 → 1.100 + peşin 1.000, bakiye 323,55 → 200), tutar artışı eksiye götürmüyorsa / peşin azaltma eksiye götürmüyorsa kabul, bakiyeyi tam 0'a getiren kabul, Değersiz'siz cari ve Değersiz satırı silinmiş cari kabul, alış faturası iptali kabul. Tabanda (t251-m2t6-taban) beklenen nedenle kırmızı (NEDEN — ders 38), yenide yeşil iki TZ.
3. Mutant: tur 2–5'in mutantları AYNEN (M17b bilinen yaşayan) + bu turun en az ikisi (tutar koşulu geri gelsin; ileti sözü 'tutarının artırılması'na dönsün) — her biri kırmızı iki TZ.
4. Komşular: fatura rotası Düzenle yolunun çağıranları ve alış faturası testleri (`git grep`), tur 5'in komşu listesi (260 dosya) iki TZ; ekran senaryoları senaryo-degersiz-iptal-m2t2-251 ve senaryo-degersiz-siniri-m2-251 iki TZ; `npm run test:kahin-cari` ve `npm run test:kahin-defter` iki TZ (kodunu okumadan; kâhin bu kuralı bilmiyor — fark çıkarsa sınıflandır).

## Kabul
A yeni testler tabanda beklenen nedenle kırmızı, yenide yeşil iki TZ; B dar kontrolün vakaları AYNEN ve ret atomik; C yanlış yere düşmüyor; D mutantlar yakalanır; E komşular + ekran senaryoları + kâhinler yeşil; F hız: yeni sorgu yok ya da yalnız Değersiz'li caride (ders 47) — ölçemiyorsan 'ÖLÇÜLMEDİ'.

{KURALLAR_KULLANICI}
KULLANICI KURALI (27.11, AYNEN: "bir süre ekran başında olmayacağım. sorularına baş mimar önerilerini uygula"): senin kodlama iznin DEĞİLDİR — yeni para / kapama ayrışmasında KODLAMA, 'KULLANICIYA SORULMALI' (öneriyle).

{kurallar('m2t6', taban=TABAN)}

{rapor()}
"""
open('/home/user/ofis---y-netimi/docs/devir/2.5.1-DEVAM/m2t6-istem.txt', 'w', encoding='utf-8').write(M2T6)
print(len(M2T6))
