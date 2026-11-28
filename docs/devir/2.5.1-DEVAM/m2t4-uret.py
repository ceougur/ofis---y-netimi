#!/usr/bin/env python3
# Değersiz sınırı TUR 4 (tur 2 + 3 dar kontrolünün ORTA-1 / ORTA-2 / DÜŞÜK-1 / DÜŞÜK-2 + S-DKM2T3-1 = A) görev metni: m2t4-istem.txt. Ana oturum, 28.11.2026.
src = open('/home/user/ofis---y-netimi/docs/devir/2.5.1-DEVAM/istem-uret.py').read().split('# ---------------------------------------------------------------- P-D')[0]
exec(src)
IS = open('/home/user/ofis---y-netimi/docs/2.5.1-IS-LISTESI.md', encoding='utf-8').read()

def satir(anahtar, metin=IS):
    i = metin.find(anahtar); assert i >= 0, anahtar
    assert metin.find(anahtar, i + 1) < 0, 'tekil değil: ' + anahtar
    b = metin.rfind('\n', 0, i) + 1; e = metin.find('\n', i)
    return metin[b:e].strip()

BM = satir('(DAR KONTROL DEĞERSİZ SINIRI TUR 2 + 3 raporu')
Q = satir('S-DKM2T3-1 (Değersiz sınırı tur 2 + 3 dar kontrolü')
Q4 = satir('S-M2T2-1 (')
Q5 = satir('S-M2T2-2 (')
Q2 = satir('S-DKM2-2 (dar kontrol M2 ORTA-2')
K_M21 = satir('KULLANICI KARARI 27.11 07:32 UTC').split(' UYGULAMA (baş mimar')[0]
NEDEN = satir('KULLANICI KARARI 27.11 11:39 UTC (AYNEN: "devir yapılırken').split(' UYGULAMA SIRASI:')[0]
ZINCIR = satir('TEK BORÇ SIRASI ZİNCİRİ (BAŞ MİMAR KARARI')
TABAN = 't251-m2t4-taban'
DK = SP + '/dk-m2t3'
RK = SP + '/m2t4rk'

M2T4 = f"""Sen DestekOfis projesinde 2.5.1'in DEĞERSİZ ALACAK SINIRI TUR 4 kod ajanısın (PARA ÇEKİRDEĞİ: şüpheli alacak; eforun high). Tur 1–3 ana dalda (çalışma dalı); bağımsız dar kontrolü (tur 2 + 3 farkı) iki ORTA bulgu verdi, ana oturum ikisini de YENİDEN ÜRETTİ. Temiz bağlamla YALNIZ aşağıdaki işleri yaparsın (ders 46).

{hazirlik(taban=TABAN, taban_ne="çalışma dalı — Değersiz sınırı tur 1–3, D3 tur 6, Mİ tur 3 dahil")}
3. Sonra oku: `docs/devir/2.5.1-DEVAM/m2-kararlar.md` (kararlar AYNEN), şüpheli alacak modülü (`server/lib/bank/doubtful.mjs` — değişmez (i) / 'sonradan değişmiş' sayımı ve Silinenler taraması, sınır hesabı, formun denemesi, bakiye denetimi ve iletileri), rotası, kapı ret iletileri (`server/lib/integrity.mjs`), fatura rotasındaki denetim çağrıları, cari hareketinin (Borç Yaz) silme / düzenleme ucu ve taksit kartı silme ucu (YALNIZ ilgili yerler). Dar kontrolün betikleri ve ham çıktıları (izinli — senin girdin): `{DK}/` (h-olcum.mjs — ORTA-1; d-oneri-ret.mjs — ORTA-2; b-yollar.mjs — ret yolları ve Borç Yaz; e-m8.mjs + a-esdeger.mjs — M8 ve eşdeğerlik); ana oturumun yeniden üretimi `{RK}/ozet.txt`.

## DOSYA SINIRI
YAZABİLİRSİN: şüpheli alacak modülü ve rotası, kapı ret iletileri (yalnız Değersiz sınırı nedenleri), fatura rotasında ve cari hareketi / taksit kartı silme-düzenleme uçlarında YALNIZ bu kararlar için çağrılacak denetim, testler, ekran senaryosu, kanıt, rapor. YAZAMAZSIN: tek borç sırası ve girdisi, defter rotası, şüpheli DEFTER türetmesi, göçler (TEK BORÇ SIRASI ZİNCİRİ — aşağıda AYNEN). Gerekirse DUR → 'BAŞ MİMAR KARARI GEREKİYOR'.
{ZINCIR}

## Bulgular ve kararlar (AYNEN)
DAR KONTROLÜN BULGULARI VE BAŞ MİMAR KARARI: {BM}
YENİ SORU VE YANITI (AYNEN): {Q}
ÖNCEKİ KARARLAR (değişmez): {K_M21}
{Q2}
{Q4}
{Q5}
DEVİR NEDEN DURDU İLETİ DÜZENİ (ret iletileri bu düzende — AYNEN): {NEDEN}

## İşler
0. NASIL BOZULUR (koddan ÖNCE, commit): Silinenler'de 0 / 5.000 / 20.000 fatura × Değersiz satırlı 1 / 10 cari; silinme Değersiz yazımından önce / sonra; geri yüklenmiş / taslak silinmiş fatura; formun önerisi × aynı gün / farklı gün bağlı tahsilat × ikinci şüpheli kayıt; Borç Yaz silme / tutar düşürme / tarih değişikliği / Silinenler'den geri yükleme; taksit kartı silme; iki saat dilimi; v2.5.0 gerçek verisi.
1. ORTA-1 (HIZ — ders 47, 53 (a)): değişmez (i)'nin Silinenler taraması Silinenler'deki fatura sayısıyla büyümez (dar kontrolün önerisi: carinin en eski Değersiz satırının yazımından sonraki silmelere daralt — doğruluğunu KANITLA: daha eski silme 'sonradan değişmiş' sayımına etki eder mi; ya da tek geçiş). EŞDEĞERLİK: dar kontrolün a-esdeger düzeniyle eski (bugünkü) ↔ yeni sayım birebir (en az 40 tohum, iki TZ; Silinenler'de fatura olan tohumlar dahil). ÖLÇÜM (h-olcum, aynı veriyle önce / sonra): 5.000 + 10 cari Mutabakat bugün ~227 ms → tur 1 düzeyine (~20 ms); ölçemiyorsan 'ÖLÇÜLMEDİ' (ana oturum özel kilitle ölçer).
2. ORTA-2: 'ekranın önerdiği tutar ve tarih HER ZAMAN kabul edilir' — formun / listenin önerdiği Değersiz tutarı kapıda reddedilmez. Örnek AYNEN (d-oneri-ret): S2 için öneri 1.500 (19.09 ve 25.09) → bugün 409, gerçekte en çok 1.400 — düzeltmeden sonra öneri 1.400 ve kabul (ya da öneri 1.500 ve kabul — hangisinin doğru olduğu kararlardan çıkıyorsa onu yap; iki okuma çıkarsa KODLAMA — 'KULLANICIYA SORULMALI'). Kök nedeni BUL ve rapora yaz (dar kontrolün kuşkusu: formun denemesi değişmez (i)'nin dünyasını görmüyor). Eşdeğerlik taramasına 'önerinin yazımı kabul edilir' değişmezi eklenir (rastgele tohumlar; dar kontrolün tohum 37 / cari 2 vakası kalıcı testte).
3. S-DKM2T3-1 = A: Değersiz satırı olan caride Borç Yaz satırının silinmesi ya da tutarının düşürülmesi cariyi eksiye götürüyorsa fatura iptaliyle AYNI kuralla ve aynı dört alanlı iletiyle reddedilir; örnek AYNEN: taban T + Değersiz 3.000'den sonra Borç Yaz 3.400 silme → RET, bakiye 423,55 kalır; tutar 100'e düşürme → RET. Taksit kartı silme ÖLÇÜLÜR: aynı sınıftaysa aynı kuralla; kararın söylemediği bir ayrışma çıkarsa KODLAMA — 'KULLANICIYA SORULMALI'.
4. DÜŞÜK-1: sınırı 0 olan ('yazılamazdı') retlerde Değersiz satırı silinse de S155 yine reddediyorsa iletinin 'ne yapmalı' kısmı kullanıcıyı Değersiz satırını sildirmeye yönlendirmez — başka yolu söyler (ör. önce şüpheli kaydı / faturayı düzeltin); kullanıcının izleyeceği adım GERÇEKTEN işlemi kabul ettirmeli (testte izlenir).
5. DÜŞÜK-2 (yalnız test — prensip §4): M8 sınıfı ('aynı gün, kayıttan SONRA yazılmış bağlı tahsilat + S155') kalıcı testte — M8 mutantı yakalanmalı (e-m8 vakaları).
6. Kalıcı testler: her iş için; tabanda (t251-m2t4-taban) beklenen nedenle kırmızı (NEDEN — ders 38), yenide yeşil iki TZ. Mutasyon: tur 2–3'ün mutantları AYNEN + bu turun en az dördü (Silinenler taraması eski hâline; önerinin değişmezle doğrulanması kalksın; Borç Yaz silme denetimi kalksın; 'ne yapmalı' eski hâline).
7. Komşular: tur 3'ün 123 dosyalık listesi + cari hareketi ve taksit kartı silme / düzenleme yolunun çağıranları (`git grep`) iki TZ; ekran senaryoları senaryo-degersiz-iptal-m2t2-251 ve senaryo-degersiz-siniri-m2-251 iki TZ (Borç Yaz silme reddi için bir adım eklenebilir); `npm run test:kahin-cari` ve `npm run test:kahin-defter` (kodunu okumadan; beklenen fark listesi rapora — cari kâhininin sonraki bakımı S-DKM2T3-1'i işleyecek).

## Kabul
A yeni testler tabanda beklenen nedenle kırmızı, yenide yeşil iki TZ; B eşdeğerlik (Silinenler taraması) iki TZ birebir; C 'önerinin yazımı kabul' değişmezi rastgele tohumlarda bozulmaz; D mutantlar yakalanır (M8 dahil); E komşular yeşil; F hız: Mutabakat Silinenler'le büyümez (sayılar rapora; 'ÖLÇÜLMEDİ' ise ana oturum ölçer).

{KURALLAR_KULLANICI}
KULLANICI KURALI (27.11, AYNEN: "bir süre ekran başında olmayacağım. sorularına baş mimar önerilerini uygula"): senin kodlama iznin DEĞİLDİR — yeni para / kapama ayrışmasında KODLAMA, 'KULLANICIYA SORULMALI' (öneriyle).

{kurallar('m2t4', taban=TABAN)}

{rapor()}
"""
open('/home/user/ofis---y-netimi/docs/devir/2.5.1-DEVAM/m2t4-istem.txt', 'w', encoding='utf-8').write(M2T4)
print(len(M2T4))
