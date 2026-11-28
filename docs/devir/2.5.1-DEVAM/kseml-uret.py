#!/usr/bin/env python3
# CARİ SÜRÜCÜ EŞLEMESİ görev metni: kseml-istem.txt. Kâhin 33'ün üç yeni dil adımı programın var olan uçlarına eşlenir. Ana oturum, 28.11.2026.
src = open('/home/user/ofis---y-netimi/docs/devir/2.5.1-DEVAM/istem-uret.py').read().split('# ---------------------------------------------------------------- P-D')[0]
exec(src)
IS = open('/home/user/ofis---y-netimi/docs/2.5.1-IS-LISTESI.md', encoding='utf-8').read()
CL = open('/home/user/ofis---y-netimi/CLAUDE.md', encoding='utf-8').read()

def satir(anahtar, metin=IS):
    i = metin.find(anahtar); assert i >= 0, anahtar
    assert metin.find(anahtar, i + 1) < 0, 'tekil değil: ' + anahtar
    b = metin.rfind('\n', 0, i) + 1; e = metin.find('\n', i)
    return metin[b:e].strip()

BM = satir('(CARİ KÂHİNİ BAKIMI 33 raporu')
YAPIM = satir('YAPIM AŞAMASI LİSTESİ KURALI (sürer)', CL)
ZINCIR = satir('TEK BORÇ SIRASI ZİNCİRİ (BAŞ MİMAR KARARI')
TABAN = 't251-kseml-taban'

KS = f"""Sen DestekOfis projesinde 2.5.1'in CARİ SÜRÜCÜ EŞLEMESİ ajanısın (program tarafı — kodu GÖRÜRSÜN; eforun high). Cari kâhini (kodu görmeyen bağımsız model) bakım 33'te dile üç yeni adım ekledi; kâhinin programı koşturan sürücüsü bu adımları BİLMİYOR, bu yüzden kâhin 31–33 çalışma dalına giremiyor (CI'nin kâhin-cari adımı yeni senaryolarda düşer). Senin işin YALNIZ sürücüde bu üç adımı programın VAR OLAN uçlarına eşlemek ve yapım aşaması listesini yeniden üretmektir. Kâhinin beklentisine ve programın koduna DOKUNMAZSIN (bağımsız doğrulama prensibi).

{hazirlik(kod=False, taban=TABAN, taban_ne="cari kâhini 33 dal ucu 941c984c + çalışma dalı 8e0550aa birleşimi e602785d")}
3. Sonra oku: sürücü `test/bagimsiz/cari/kos.mjs` (TAMAMI — adım dağıtımı, yanıt / ret okuma, kimlik eşlemesi, `--yapim-asamasi-yaz`, paket etiketi); kâhinin dil eklerinin tanımı `test/bagimsiz/cari/KARARLAR.md` §45 (Y33-2 `degersiz_sil`, Y33-3 `supheli_sil`, Y33-5 `mahsup`; uzun satırlı — python ile oku) ve bu adımları kullanan senaryolar `test/bagimsiz/cari/senaryolar/d69-*.json`, `d70-*.json`, `d71-*.json` (adım biçimi ve beklenen ret / neden alanı); programda Değersiz Alacak satırının silinmesi, şüpheli kaydın silinmesi ve Mahsup Et uçları (`git grep` — şüpheli alacak rotası ve modülü, fatura kapama / Mahsup Et rotası, istemcinin bu düğmeleri çağırdığı yer: kullanıcının ekranda yaptığı istekle AYNI uç kullanılır).

## Baş mimar kararı (AYNEN)
{BM}

## DOSYA SINIRI
YAZABİLİRSİN: `test/bagimsiz/cari/kos.mjs` (yalnız üç adımın eşlemesi ve gerekiyorsa bunların yanıt / ret nedeni okuması), `test/bagimsiz/cari/YAPIM-ASAMASI.json` (yalnız `--yapim-asamasi-yaz` çıktısı + kuralın elle paket etiketi), kanıt, rapor. YAZAMAZSIN: kâhinin modeli, öz testi, kararları, senaryoları, üreticisi ve README'si (`model.py`, `oz-test.py`, `KARARLAR.md`, `senaryolar/**`, `uretici.py`, README) — kâhinin beklentisi DEĞİŞMEZ; programın kodu (`server/**`, `client/**`, göçler) — program bir adımı karşılayamıyorsa (uç yok) ya da adımın programdaki karşılığı iki okumalıysa (hangi kaydın silineceği, Mahsup Et'in yönü / tutarı belirsiz) DUR → 'BAŞ MİMAR KARARI GEREKİYOR' (sürücüde tahminle eşleme yapılmaz). Tek borç sırası zinciri (AYNEN; senin işin bu dosyalara dokunmaz): {ZINCIR}

## YAPIM AŞAMASI LİSTESİ KURALI (CLAUDE.md, AYNEN)
{YAPIM}

## İşler
0. NASIL BOZULUR (koddan ÖNCE, commit): adım yanlış kayda eşlenir (aynı caride iki Değersiz satırı / iki şüpheli kayıt; aynı adlı iki cari); program reddeder ama sürücü başarı sayar (ders 3 — yanıt kodu + gövde + veri tabanındaki sayı); ret nedeninin yanlış alandan okunması; Mahsup Et'in iki bağının yönü ve tutarı; kilitli dönemde adım; sunucu yeniden başlatma / yedek geri yükleme sonrası kimlik eşlemesi; iki saat dilimi.
1. KIRMIZI ÖNCE: tabanda `npm run test:kahin-cari` (UTC) koş — d69–d71'in 'bilinmeyen adım' (ya da eşdeğer) nedenle düştüğünü İLETİSİYLE kanıtla (ders 38).
2. EŞLEME: `degersiz_sil` (Değersiz Alacak satırının silinmesi), `supheli_sil` (şüpheli kaydın silinmesi), `mahsup` (Mahsup Et; kâhinde iki para dışı bağ) — her biri programın kullanıcı ekranından çağrılan AYNI ucuna; ret varsa kâhinin beklediği 'ret + neden anahtarı' biçimine (Y33-2) programın ret yanıtından çevrilir (hangi alandan okunduğu rapora; ileti metnine göre eşleme yapılıyorsa bunu açıkça yaz — kırılgan). Var olan adımların davranışı DEĞİŞMEZ.
3. KÂHİN ↔ PROGRAM: `npm run test:kahin-cari` iki TZ (TZ=UTC, TZ=Europe/Istanbul). Her fark sınıflanır: (a) sürücü hatası → düzelt; (b) programın bugünkü kodu kararı henüz uygulamıyor → bekleyen paket (ör. S-DKM2-2 / S-DKM2-3 / S-M2T2-1 / S-M2T2-2 → Değersiz sınırı tur 2–3; Mahsup Et bağının kilit sınırı, S-T4-1 → kilit paketi; SK-59 / SK-63 → kararın paketi — kararı iş listesinde göremiyorsan 'AYRIŞTIRILMADI' DEĞİL, raporda 'BAŞ MİMAR KARARI GEREKİYOR'); (c) açıklanmamış → ders 6: yeniden üret, kök neden yaz; programın kendi hatası görünüyorsa 'PROGRAM BULGUSU' (düzeltme YOK, örnek sayılarla).
4. YAPIM AŞAMASI LİSTESİ: kuraldaki gibi `--yapim-asamasi-yaz`; çalışma dalındaki (tabanın) listeyle fark dökümü (yeni / kapanan / değeri değişen) kanıta; her yeni kayıt paketine; liste yazıldıktan sonra `npm run test:kahin-cari` iki TZ YEŞİL (listede olmayan fark 0).
5. DİŞ: sürücüde en az üç mutant (geçici, commit'lenmez; kanıta çıktı): `degersiz_sil` hiçbir şey yapmasın; `supheli_sil` reddi başarı saysın; `mahsup` tek bağ kursun / yönü ters — her biri kâhin-cari'de (liste yazılmışken) kırmızı olmalı; yakalanmayan mutant = eksik eşleme / eksik senaryo (raporda, kâhine girdi olarak).
6. Komşular: kâhinin öz testi (`python3 -I test/bagimsiz/cari/oz-test.py` — yalnız koş) iki TZ; CI'nin kâhin-cari adımının komutu (ci.yml'yi OKU, değiştirme) yerelde aynen.

## Kabul
A tabanda d69–d71 bilinmeyen adım nedeniyle kırmızı (ileti), eşlemeden sonra sürücüde bilinmeyen adım 0; B kâhin-cari iki TZ yeşil, listede olmayan fark 0, her liste kaydı paketli; C mutantlar yakalanır; D `git diff {TABAN} -- server client` BOŞ; E `git diff {TABAN} -- test/bagimsiz/cari ':!test/bagimsiz/cari/kos.mjs' ':!test/bagimsiz/cari/YAPIM-ASAMASI.json'` BOŞ; F öz test iki TZ yeşil.

{KURALLAR_KULLANICI}
KULLANICI KURALI (27.11, AYNEN: "bir süre ekran başında olmayacağım. sorularına baş mimar önerilerini uygula"): senin kodlama iznin DEĞİLDİR — yeni para / kapama ayrışmasında KODLAMA, 'KULLANICIYA SORULMALI' (öneriyle).

{kurallar('kseml', taban=TABAN)}

{rapor()}
"""
open('/home/user/ofis---y-netimi/docs/devir/2.5.1-DEVAM/kseml-istem.txt', 'w', encoding='utf-8').write(KS)
print(len(KS))
