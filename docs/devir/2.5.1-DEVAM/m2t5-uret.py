#!/usr/bin/env python3
# Değersiz sınırı TUR 5 (SK-64 = A + tur 4 dar kontrolünün ORTA-A / ORTA-B; S-251Y-1 = A) görev metni: m2t5-istem.txt. Kararlar iş listesinden AYNEN. Ana oturum, 28.11.2026.
src = open('/home/user/ofis---y-netimi/docs/devir/2.5.1-DEVAM/istem-uret.py').read().split('# ---------------------------------------------------------------- P-D')[0]
exec(src)
IS = open('/home/user/ofis---y-netimi/docs/2.5.1-IS-LISTESI.md', encoding='utf-8').read()

def satir(anahtar, metin=IS):
    i = metin.find(anahtar); assert i >= 0, anahtar
    assert metin.find(anahtar, i + 1) < 0, 'tekil değil: ' + anahtar
    b = metin.rfind('\n', 0, i) + 1; e = metin.find('\n', i)
    return metin[b:e].strip()

BM = satir('(DAR KONTROL DEĞERSİZ SINIRI TUR 4 raporu')
BM4 = satir('(DEĞERSİZ SINIRI TUR 4 raporu — ajan a75255d57a32bede8')
SK64 = satir('SK-64 (cari kâhini bakımı 34')
Y1 = satir('S-251Y-1 (yayın kapsamı')
Q = satir('S-DKM2T3-1 (Değersiz sınırı tur 2 + 3 dar kontrolü')
Q4 = satir('S-M2T2-1 (')
Q5 = satir('S-M2T2-2 (')
Q2 = satir('S-DKM2-2 (dar kontrol M2 ORTA-2')
K_M21 = satir('KULLANICI KARARI 27.11 07:32 UTC').split(' UYGULAMA (baş mimar')[0]
NEDEN = satir('KULLANICI KARARI 27.11 11:39 UTC (AYNEN: "devir yapılırken').split(' UYGULAMA SIRASI:')[0]
ZINCIR = satir('TEK BORÇ SIRASI ZİNCİRİ (BAŞ MİMAR KARARI')
TABAN = 't251-m2t5-taban'
DK = SP + '/dk-m2t4'
RK = SP + '/m2t4dkrk-cikti'

M2T5 = f"""Sen DestekOfis projesinde 2.5.1'in DEĞERSİZ ALACAK SINIRI TUR 5 kod ajanısın (PARA ÇEKİRDEĞİ: şüpheli alacak; eforun high). Tur 1–4 çalışma dalında; bağımsız dar kontrolü (tur 4 farkı) iki ORTA bulgu verdi, ana oturum ikisini de YENİDEN ÜRETTİ; ayrıca kullanıcı kararıyla (öneri) yeni bir para kuralı (SK-64 = A) kodlanacak. Bu tur 2.5.1'in SON Değersiz turudur (kullanıcı yayın kararı). Temiz bağlamla YALNIZ aşağıdaki işleri yaparsın (ders 46).

{hazirlik(taban=TABAN, taban_ne="çalışma dalı ucu — Değersiz sınırı tur 1–4, KDV Özeti küçük tur 1–5, D3 tur 6, Mİ tur 3 dahil")}
3. Sonra oku: `docs/devir/2.5.1-DEVAM/m2-kararlar.md` (kararlar AYNEN), şüpheli alacak modülü (`server/lib/bank/doubtful.mjs` — değişmez (i)'nin Silinenler taraması ve kuyruk kesiti, bakiye denetimi `writeOffBalanceGuard` ve iletileri), kapı ret iletileri (`server/lib/integrity.mjs`), cari hareketi düzeltme / silme rotası (`server/routes/accounts.mjs` — bugün denetim yalnız borç türünde kuruluyor), taksit kartı rotası (`server/routes/plans.mjs` — düzenleme / silme / Otomatik Dağıt), POS iadesi silme yolu (`server/routes/bank-pos.mjs` ve cari rotasındaki POS kaydı silme), fatura rotasındaki denetim çağrıları (YALNIZ ilgili yerler). Dar kontrolün betikleri ve ham çıktıları (izinli — senin girdin): `{DK}/` (c-ek.mjs — ORTA-A Otomatik Dağıt ve dönem kilidi sırası; b-yollar.mjs — ret yolları, 'ne yapmalı' izlemesi; h-olcum.mjs — ORTA-B, `SILME_ANI` ortam değişkeniyle; d-rastgele.mjs — eşdeğerlik ve rastgele dizi; a-gevseme.mjs); ana oturumun yeniden üretimi `{RK}/` (c-ek.txt, h-olcum.txt).

## DOSYA SINIRI
YAZABİLİRSİN: şüpheli alacak modülü ve rotası, kapı ret iletileri (yalnız Değersiz sınırı nedenleri), cari hareketi / taksit kartı / POS iadesi silme-düzenleme uçlarında ve fatura rotasında YALNIZ bu kararlar için çağrılacak denetim, Silinenler taraması için gerekirse bir ifade dizini (göç GEREKİRSE DUR — 'BAŞ MİMAR KARARI GEREKİYOR'; göç numarasını ana oturum verir), testler, ekran senaryosu adımı, kanıt, rapor. YAZAMAZSIN: tek borç sırası ve girdisi, defter rotası, şüpheli DEFTER türetmesi, KDV Özeti (`server/routes/tax.mjs` — KDV tur 6 çalışıyor), kâhin klasörleri (TEK BORÇ SIRASI ZİNCİRİ — aşağıda AYNEN). Gerekirse DUR → 'BAŞ MİMAR KARARI GEREKİYOR'.
{ZINCIR}

## Bulgular ve kararlar (AYNEN)
DAR KONTROLÜN BULGULARI VE BAŞ MİMAR KARARI (tur 4 dar kontrolü): {BM}
YENİ PARA KURALI (AYNEN): {SK64}
YAYIN KAPSAMI (AYNEN): {Y1}
TUR 4'ÜN BAŞ MİMAR KARARI (değişmez — senin tabanın): {BM4}
ÖNCEKİ KARARLAR (değişmez): {Q}
{K_M21}
{Q2}
{Q4}
{Q5}
DEVİR NEDEN DURDU İLETİ DÜZENİ (ret iletileri bu düzende — AYNEN): {NEDEN}
NOT: cari kâhininin S-M2T2-1 / S-DKM2T3-1 / SK-64'ü işleyen bakımları bu dalda YOK (sonraki sürüme aktarıldı) — kâhin karşılaştırması bu kuralları kapsamaz; kanıtın kalıcı testler + eski kod kırmızısı + mutasyondur.

## İşler
0. NASIL BOZULUR (koddan ÖNCE, commit): Değersiz satırlı caride Ödeme satırı silme / tutar artırma / tarih değişikliği / Borç'a çevirme / başka cariye taşıma; Alacak Yaz tutar artırma / yeni Alacak Yaz (BM-M2T4-3: kapsam DIŞI — yeniden ölç) / silme; POS iadesi silme; taksit kartı Otomatik Dağıt (toplam düşer / artar / aynı) × taksit sayısı; bakiyeyi tam 0'a götüren işlem; Değersiz satırı silinmiş cari; dönem kilidi; Silinenler'de 0 / 5.000 / 20.000 fatura × silme anı Değersiz'den önce / sonra × Değersiz satırlı 1 / 10 cari; iki şirket; yedek geri yükleme; iki saat dilimi; v2.5.0 gerçek verisi fikstürü.
1. SK-64 = A: Değersiz Alacak satırı olan caride Ödeme satırının silinmesi ya da Alacak Yaz tutarının artırılması (ve aynı sonucu veren her düzeltme yolu — Ödeme tutarı artırma, türünü / carisini değiştirme, POS iadesi silme: hangisi cariyi eksiye götürüyorsa) cariyi eksiye götürüyorsa S-M2T2-1 / S-DKM2T3-1 ile AYNI kuralla ve aynı dört alanlı iletiyle reddedilir; kararın örneği AYNEN kalıcı testte (bakiye −76,45 iken Ödeme silme → RET, bakiye −76,45 kalır; kabul olsaydı −576,45). İletideki sözcük işlemin kendi adıyla ('Ödeme hareketi silinemez' / 'Alacak hareketi düzeltilemez' gibi — 'Borç hareketi' DEĞİL); 'ne yapmalı' kısmının söylediği adım GERÇEKTEN işlemi kabul ettirmeli (testte izlenir — tur 4'ün düzeni). Eksiye götürmeyen işlem, Değersiz'siz cari ve Değersiz satırı silinmiş cari ETKİLENMEZ (testte). Kararın söylemediği bir yolda iki okuma çıkarsa KODLAMA — 'KULLANICIYA SORULMALI' (öneriyle).
2. ORTA-A: taksit kartının Otomatik Dağıt yolu kart toplamını değiştiriyorsa kart düzenlemesiyle AYNI denetimden geçer (dar kontrolün önerisi: yazımdan önce denetim kurulur, kalemler yazıldıktan sonra denetlenir — atomik; ret olursa hiçbir şey yazılmaz). Dar kontrolün vakası AYNEN kalıcı testte (taban T kart 3.400 → Otomatik Dağıt 100: 409, kart toplamı 3.400 ve bakiye 423,55 kalır); dönem kilidi iletisi önce gelir (değişmez); toplamı artıran / değiştirmeyen Otomatik Dağıt kabul. Taksit kartının toplamını değiştiren BAŞKA bir yol varsa (`git grep` ile tara) aynı kural; raporda yol listesi.
3. ORTA-B (HIZ — ders 47, 53 (a)): değişmez (i)'nin Silinenler taraması, Değersiz'den SONRA silinen faturalar dahil, Silinenler'deki fatura sayısıyla ve başka carilerin silinmiş faturalarıyla büyümez (dar kontrolün önerileri: Mutabakat'ta bütün cariler için tek geçiş, ya da silinen faturanın carisine göre süzme — yükteki cari alanına ifade dizini; göç gerekiyorsa DUR). EŞDEĞERLİK: eski (bugünkü) ↔ yeni sayım birebir (en az 40 tohum, iki TZ; silme anı Değersiz'den önce ve SONRA, Silinenler'de başka carilerin faturaları olan tohumlar dahil — dar kontrolün d-rastgele düzeni). ÖLÇÜM (h-olcum, aynı veriyle önce / sonra, iki silme anı): 5.000 + 10 cari Mutabakat bugün ~221 ms (silme Değersiz'den sonra) → ~15 ms düzeyine; ölçemiyorsan 'ÖLÇÜLMEDİ' (ana oturum özel kilitle ölçer).
4. Kalıcı testler: her iş için; tabanda (t251-m2t5-taban) beklenen nedenle kırmızı (NEDEN — ders 38), yenide yeşil iki TZ. Mutasyon: tur 2–4'ün mutantları AYNEN + bu turun en az dördü (Ödeme silme denetimi kalksın; Alacak Yaz artırma denetimi kalksın; Otomatik Dağıt denetimi kalksın; Silinenler taraması eski hâline — eşdeğerlik testi bunu YAKALAMAZ, hız / sorgu planı testi yakalamalı; ileti sözcüğü 'Borç hareketi'ne dönsün).
5. Komşular: tur 4'ün komşu listesi + cari hareketi, taksit kartı ve POS iadesi silme / düzenleme yolunun çağıranları (`git grep`) iki TZ; ekran senaryoları senaryo-degersiz-iptal-m2t2-251 ve senaryo-degersiz-siniri-m2-251 iki TZ (Ödeme silme reddi ve Otomatik Dağıt reddi için birer adım eklenebilir; adım eklersen ekran görüntüsüne BAK — uzun ileti okunuyor mu); şema kapısı ve geri yükleme testleri (dizin eklersen); `npm run test:kahin-cari` ve `npm run test:kahin-defter` iki TZ (kodunu okumadan; fark çıkarsa rapora — kâhin bu kuralları bilmiyor, beklenen fark listesi yaz).

## Kabul
A yeni testler tabanda beklenen nedenle kırmızı, yenide yeşil iki TZ; B SK-64 örneği AYNEN ve 'ne yapmalı' adımı işlemi kabul ettirir; C Otomatik Dağıt reddi atomik (veri tabanı değişmez); D eşdeğerlik (Silinenler taraması) iki TZ birebir, iki silme anında; E mutantlar yakalanır; F komşular + ekran senaryoları + kâhinler yeşil; G hız: Mutabakat ve tahsilat yazımı Silinenler'le büyümez (sayılar rapora; 'ÖLÇÜLMEDİ' ise ana oturum ölçer).

{KURALLAR_KULLANICI}
KULLANICI KURALI (27.11, AYNEN: "bir süre ekran başında olmayacağım. sorularına baş mimar önerilerini uygula"): senin kodlama iznin DEĞİLDİR — yeni para / kapama ayrışmasında KODLAMA, 'KULLANICIYA SORULMALI' (öneriyle).

{kurallar('m2t5', taban=TABAN)}

{rapor()}
"""
open('/home/user/ofis---y-netimi/docs/devir/2.5.1-DEVAM/m2t5-istem.txt', 'w', encoding='utf-8').write(M2T5)
print(len(M2T5))
