# ANA OTURUM — S223 KÜÇÜK TURU görev metni üreteci (KISA, TEK İŞ: içe aktarmalarda Türkçe harf katlamalı ad karşılaştırması; S223 = A + S228).
# Kararlar iş listesinden ve CLAUDE.md'den AYNEN (C soruları devam satırlarıyla; D kayıtları başlığıyla).
# Çağrı: cd <depo>; python3 -I <bu> <çıktı> <taban dalı> <taban ucu> <gün YYYY-AA-GG>
import sys, re
OUT, TABAN, UC, GUN = sys.argv[1], sys.argv[2], sys.argv[3], sys.argv[4]
SP = '/tmp/claude-0/-home-user/de5e1cbf-7e68-5683-b7bb-f27655eaed4f/scratchpad'
t = open('docs/2.5.0-IS-LISTESI.md', encoding='utf-8').read()
il = t.split('\n')
D = t[t.find('\n## D'):]
cl = open('CLAUDE.md', encoding='utf-8').read().split('\n')


def blok(basla):
    h = [i for i, l in enumerate(il) if l.startswith(basla)]; assert len(h) == 1, (basla, len(h))
    s = h[0]; e = s + 1
    while e < len(il) and il[e].startswith('  ') and not re.match(r'  (S\d+[ =(]|\(\d+\) )', il[e]): e += 1
    return ' '.join(x.strip() for x in il[s:e])


def karar(basla):
    h = [x for x in D.split('\n- ') if x.startswith(basla)]; assert len(h) == 1, (basla, len(h)); return '- ' + h[0].strip()


def madde(icerir, devam):
    # CLAUDE.md'den bir maddeyi devam satırlarıyla AYNEN alır; devam = devam satırının girinti deseni.
    h = [i for i, l in enumerate(cl) if icerir in l]; assert len(h) == 1, (icerir, len(h))
    s = h[0]; e = s + 1
    while e < len(cl) and re.match(devam, cl[e]) and not re.match(r'\s*(\d+\.|-) ', cl[e]): e += 1
    return ' '.join(x.strip() for x in cl[s:e])


S223 = blok('  S223 (')
S228 = blok('  S228 (')
K1447 = karar('KULLANICI KARARI 20.11 14:47 UTC')
BM = [x for x in D.split('\n- ') if x.startswith('BAŞ MİMAR KARARI 20.11') and 'S223 KÜÇÜK TURU — GÖREV METNİ' in x[:140]]; assert len(BM) == 1
AYNI_AD = madde('"aynı adlı iki kişi" durumu denenir', r'   +\S')
SIKAYET3 = madde('3. "Kişi bir kez girilir"', r'   +\S')
CARI = madde('Cari yalnız "+ Yeni Cari"', r'  +\S')
BIRAK = [l.strip() for l in cl if l.strip().startswith("2.5.1'E BIRAK")]; assert len(BIRAK) == 1
assert '2.0.19' in CARI and 'Kişi bir kez girilir' in SIKAYET3 and 'aynı adlı iki kişi' in AYNI_AD

o = []; w = o.append
w("Sen DestekOfis projesinde S223 KÜÇÜK TURU KOD ajanısın (2.5.0 — içe aktarmalarda kişi adının Türkçe harf katlamalı karşılaştırılması; kişi eşleştirmesi hangi cariye borç / çek yazılacağını belirler → PARA ÇEKİRDEĞİNE YAKIN; eforun high). TEK İŞ: S223 = A (+ S228 = A). Yanıtın Türkçe. PUSH YOK. Her bitmiş adımı (kod + testi + kanıtı) HEMEN commit et (kapsayıcı 20.11'de dört kez yeniden başladı; commit'siz iş kaybolur). Koşuları ≤ 40 dk parçalara böl; rapor taslağını `docs/kanit/" + GUN + "/s223-rapor-taslak.md`'de adım adım tut. Zamanlanmış görev KURMA. Kendi arka plan işin sürerken rapor vermeden bitirme. Bağlamın daralırsa BİTMİŞ adımların commit'leriyle ARA RAPOR ver ve dur (ders 46).")
w("")
w("## Hazırlık")
w(f"1. Worktree'de (kendi commit'in YOKKEN) `git reset --hard {TABAN}` (= {UC[:8]}: çalışma dalı + Ç7b'nin bütün turları — Ç7b henüz çalışma dalında DEĞİL; senin birleşimin Ç7b'den SONRA). `git log --oneline -2` ile doğrula; değilse DUR. `ln -s /home/user/ofis---y-netimi/node_modules node_modules` (`npm ci` YOK); tarayıcı `PLAYWRIGHT_BROWSERS_PATH={SP}/pw-1194`. ESKİ KOD (taban kırmızısı) = `{TABAN}`: `git -C /home/user/ofis---y-netimi archive {TABAN} ':!docs/kanit' | tar -x -C <not defteri>/taban` + node_modules bağı. ESKİ SÜRÜM (madde D) = `v2.4.9` etiketi: `git -C /home/user/ofis---y-netimi worktree add --detach <not defteri>/v249 v2.4.9` (ders 54; iş bitince `git worktree remove` — ZORLAMADAN). Not defteri `{SP}/s223-<kısa>` (ders 25). Disk 5 GB'ın altına düşmez; biten kopyanı TAM yoluyla sil.")
w("2. ÖNCE oku: `CLAUDE.md` (dersler; özellikle 6, 7, 9, 10, 12, 13, 17, 28, 31, 38, 43, 44, 47, 51, 53, 54; 'Test kuralı', 'Kullanıcının tekrar eden şikâyetleri', 'Kalıcı ürün kararları', 'Kullanım kılavuzu'); `docs/BAGIMSIZ-DOGRULAMA-PRENSIBI.md`; `server/lib/names.mjs` (var olan Türkçe katlama yardımcısı). Kâhin MODEL dosyaları okunmaz, `test/bagimsiz/**` YAZILMAZ.")
w("")
w("## Kararlar (AYNEN)")
w("ANAYASA (CLAUDE.md, test kuralı): " + AYNI_AD)
w("ANAYASA (CLAUDE.md, kullanıcının tekrar eden şikâyeti): " + SIKAYET3)
w("KALICI ÜRÜN KARARI (CLAUDE.md'den AYNEN — 2.0.19 kuralı DEĞİŞMEZ): " + CARI)
w(S223)
w(K1447)
w(S228)
w('- ' + BM[0].strip())
w("KULLANICI KURALI (CLAUDE.md'den AYNEN): " + BIRAK[0])
w("")
w("## İş (sırayla; her biri ÖNCE bugünkü kodda örnek veriyle yeniden üretilir — ders 6)")
w("0. NASIL BOZULUR (rapor taslağının başına, koddan ÖNCE, commit): büyük / küçük harf ('AHMET YILMAZ' ↔ 'Ahmet Yılmaz'; I / ı, İ / i her konumda: 'İLKER IŞIK', 'ILGIN' ↔ 'Ilgın'); İngilizce olmayan harfler ('ŞÜKRÜ ÖZÇELİK' ↔ 'Şükrü Özçelik' — Ş Ğ Ü Ö Ç bugün hiç katlanmıyor); boşluk (çift boşluk, baş / son boşluk, sekme, bölünmez boşluk); Unicode yazım farkı (İ'nin ayrık noktalı yazımı); var olan ÇİFT cari (S228); aynı dosyada aynı kişi iki satır, biri büyük harfle (ilk satırın açtığı cari / kart ikinciye görünmeli); telefonlu satır + aynı adlı farklı telefonlu cari (FARKLI kişi kalır); Cari No + ad; tablodaki kayıt bağı; silinmiş cari; telefonsuz satır + aynı grupta tek / birden çok cari; aynı Excel ikinci kez (2.0.19 kuralı aynen); ön izleme ↔ yükleme aynı sonuç; Geri Al (yalnız kendi açtığı); kilitli dönem; iki şirket; İngilizce klavyeyle harf DEĞİŞİMİ ('IBRAHIM' ↔ 'İbrahim' — KAPSAM DIŞI, yalnız davranışı yaz).")
w("1. TARAMA (koddan ÖNCE; sonucu rapor taslağına tablo: yol, ne karşılaştırıyor, kapsamda mı, ne yapıldı): kişi / cari ADI karşılaştıran her yer — `git grep -n -i -E \"collate nocase|nocase|toLowerCase|toLocaleLowerCase|toUpperCase|toLocaleUpperCase\" -- server client/assets` ve ad eşitliği arayan sorgular. Bilinen başlangıç noktaları (ana oturum koddan gördü; eksiksiz liste DEĞİL): `server/routes/accounts.mjs` matchExisting (Cari No + ad, ad + telefon) ve matchPerson / planPerson / planDuplicate (taksit Excel ve Tablodan Aktar'ın ortak kişi kuralı); `server/routes/plans.mjs` Excel yüklemesinin yinelenen kart anahtarı (yalnız İngilizce harfleri katlıyor); `server/routes/cheques.mjs` içe aktarmanın cari bulması (önbellek anahtarı Türkçe, sorgu İngilizce katlamalı — aynı dosyada iki yazım ilkinin sonucunu paylaşıyor); `server/routes/plan-transfer.mjs` (Tablodan Aktar); istemcide ön izleme bir ad karşılaştırması yapıyorsa o da. KAPSAM: kararın saydığı yollar (cari Excel / Sheets, taksit Excel / Sheets, çek / senet içe aktarma, Tablodan Aktar). Kapsam DIŞINDA kalan ad karşılaştırmaları (liste sıralaması, arama, kullanıcı / rol adları, stok adı) DEĞİŞMEZ — taramada adıyla yazılır; programı / kullanıcıyı etkileyen bir hata görürsen 'BAŞ MİMAR KARARI GEREKİYOR'.")
w("2. KOD (S223 = A + S228 = A): kapsamdaki yollarda ad karşılaştırması TEK yardımcıdan (Türkçe büyük / küçük harf + boşluk + Unicode biçimi; `server/lib/names.mjs` içindeki var olan yardımcı yeniden kullanılır ya da YANINA yazılır — var olan işlevin davranışı DEĞİŞMEZ, onu kullanan rol / kullanıcı adı yolları komşudur, ders 10). S228 = A SIRASI: önce BUGÜNKÜ karşılaştırma (veri tabanının İngilizce katlaması) tek cari / kart buluyorsa o; bulamıyorsa Türkçe katlamalı; o da tek değilse bugünkü 'şüpheli' davranışı (kural değişmez) — bugün doğru bağlanan hiçbir satır DEĞİŞMEZ (bunu testle göster). Eşleştirmenin öbür kuralları (telefon 7+ hane, telefonsuz + aynı grup, kayıt bağı, Cari No + ad, 2.0.19 kuralı, P7 / S219 / S221 / S222) AYNEN. HIZ (ders 47): satır başına tam tablo taraması YOK — yükleme başına TEK toplu okuma (yalnız gereken alanlar, silinmemiş cariler) + bellekte harita; aynı yüklemede açılan cari / kart haritaya eklenir. Göç / şema / yeni dizin YOK. Var olan çift cariler BİRLEŞTİRİLMEZ.")
w("3. TESTLER (yeni dosya, `test/` altında): her yol için en az bir örnek (cari Excel ad + telefon ve Cari No + ad; taksit Excel; çek / senet içe aktarma; Tablodan Aktar) × harf varyantları (I / ı, İ / i, Ş Ğ Ü Ö Ç, boşluk); S228 (var olan çiftte bugünkü bağlantı korunur; tek Türkçe eşleşmede yeni cari AÇILMAZ); aynı dosyada iki yazım; telefonu farklı aynı ad → ayrı kişi; Geri Al; kilitli dönem; her biri tabanda BEKLENEN NEDENLE kırmızı (ileti okunur: 'yeni cari açıldı' / 'çift kart', ders 38, 51), yenide yeşil; iki TZ (UTC, Europe/Istanbul); göreli tarih (ders 13). Cari / kart / borç sayıları VERİ TABANINDAN okunur (ders 3, 12).")
w("4. KILAVUZ: davranış düzeltmesidir, kılavuz değişmez; değiştirirsen `docs/kilavuz/pdf-uret.mjs` + `pdf-denetle.mjs` aynı turda (ders 42), teknik anlatım GİRMEZ.")
w("")
w("## Kabul koşulları (bu turun)")
w("A. `npm run test:kahin-defter` tabanda ve sonda (iki TZ) — sayılar aynı; değişen her denetim BULGU (bu tur defter kuralına dokunmaz).")
w("B. `npm run test:kahin-cari` önce / sonra (iki TZ); `KAHIN_YAPIM_ASAMASI=<kendi kopyan>` ile yapım aşaması listesi kendi yolunda yeniden üretilir — BOŞ kalmalı; yeni kayıt / fark varsa adıyla rapor (elle etiketleme YOK).")
w("C. Muhasebe sürücüsü (`test/bagimsiz/muhasebe-surucu`; README'sinden; DEĞİŞTİRME — sürücü bakımı ana oturumda) önce / sonra: fark beklenmez; çıkan her fark adıyla ve nedeniyle.")
w("D. ESKİ SÜRÜM (ders 17, 53 (b)): v2.4.9'un GERÇEK kodunda aynı Excel'ler (cari, taksit, çek / senet) → hatanın 2.4.9'da da olduğunu göster (çift cari / çift kart sayısıyla); v2.4.9'un kendi API'siyle girilmiş veride (büyük harfle yüklenip çift açılmış cari dahil) yeni kodla yükleme → S228 = A davranışı; sınıf listesi (yol × varyant × tek / çift / yok aday) KALICI testte, beklenenler elle.")
w(f"E. HIZ (ders 47, 53 (a)): değiştirdiğin her yükleme yolu — cari Excel 2.000 satır, taksit Excel 2.000 satır, çek / senet içe aktarma 500 satır, Tablodan Aktar — temiz 100 bin `{SP}/ana-kabul/temiz-100k` (OKUNUR; KENDİ kopyanda) taban ↔ yeni; yanıt + olay döngüsü en çok; ÖZEL kilit `flock -x -w 1800 {SP}/olcum.lock` tek seferlik (alamazsan 'ÖLÇÜLEMEDİ'; ana oturum ayrıca ölçer); /proc/loadavg yazılır, yük > 2 ise 'GEÇERSİZ'. Ölçüt: en iyi VE ortanca tabanın %10'undan kötü değil; kötüleşen yol birleşmez.")
w("F. DEĞİŞMEZLER: Mutabakat Testi + Defter Mutabakatı her yüklemeden sonra temiz; cari / taksit / Kasa / çek bakiyeleri YALNIZ harf varyantı satırlarında değişir (her biri testte yazılı).")
w("G. EKRAN (ders 11, 12, 28, 34, 39; yazım düzeni): Cariler → Excel / Sheets'ten Yükle, Taksitler → Excel'den Yükle, Çek / Senet içe aktarma, Tablodan Aktar — büyük harfli adlarla gerçek tıklama + insan hızı; ön izleme ve sonuç raporu (eşleşen / açılan / atlanan, nedeni) doğru; beklentisi değişen her ekran senaryosu KOŞULUR. Yeni ekran senaryosu açabilirsin; ci.yml'ye EKLEME — raporda 'CI listesine eklenecek'.")
w("G2. KOMŞULAR (ders 10): içe aktarmalara, kişi eşleştirmeye ve dokunduğun yardımcıyı kullanan her yola (rol / kullanıcı adı çakışması dahil) dokunan testler `git grep` taramasıyla seçilir, iki TZ. MUTANTLAR DEĞERLE (en az: katlamayı İngilizceye geri döndür; Türkçe katlamayı tek yolda unut (çek / senet); S228 sırasını ters çevir; aynı yüklemede açılan cariyi haritaya ekleme; boşluk düzeltmesini kaldır; yinelenen kart anahtarını eski katlamada bırak) — her biri en az bir testte kırmızı.")
w("")
w("## Kurallar")
w("- DOSYA SINIRI: yazabileceğin — `server/routes/accounts.mjs`, `server/routes/plans.mjs`, `server/routes/cheques.mjs`, `server/routes/plan-transfer.mjs` (YALNIZ ad karşılaştırması ve onun toplu okuması; öbür davranış DEĞİŞMEZ), `server/lib/names.mjs` (yalnız YENİ işlev; var olanın davranışı aynen), istemcide ön izleme ad karşılaştırması (taramada görülürse, gerekçesiyle), testler + `test/fixtures/**`, kılavuz HTML + PDF (gerekirse). Başka her dosya YASAK; özellikle `server/lib/migrations.mjs`, `server/lib/db.mjs`, `server/lib/bank/**`, `server/lib/whatsapp/**`, `server/lib/einvoice/**`, `.github/**`, package.json, tools/**, `test/bagimsiz/**`.")
w("- PARA / KİŞİ EŞLEŞTİRME KURALI AYRIŞMASI (ders 43): kararların söylemediği / iki okumaya açık bir durum çıkarsa KODLAMA — 'KULLANICIYA SORULMALI' (iki seçenek + öneri + her okumada hangi cariye ne borç; 'yaygın programlarda nasıl' satırı yalnız doğrulanmış kaynakla; uç durumsa üçüncü seçenek 'Uç durum böyle kalsın (BİLİNEN SINIR)'). Mimari seçimse 'BAŞ MİMAR KARARI GEREKİYOR' (seçenek + öneri + gerekçe). Önce iş listesi C / D'de aynı soru var mı ARA (iş listesi `docs/2.5.0-IS-LISTESI.md`).")
w("- KULLANICI KURALI (yukarıda AYNEN): programı ya da kullanıcıyı etkilemeyen ayrıntıyı (test düzeni, araç, ölçüm nüansı, doğrulanmamış kuşku) KOVALAMA; raporun 'SONRAKİ SÜRÜME (2.5.1)' başlığına yaz.")
w(f"- Koşular `HUKUK_LICENSE_URL=http://127.0.0.1:9 KANIT_DIR=<not defterin> node tools/kanit.mjs kos s223-<ad> -- <komut>`; BÜTÜN test koşuların (tek dosya dahil) `flock -s -w 3600 {SP}/olcum.lock` altında (tek seferlik bekleme; başka işin hız ölçümü kilidi ÖZEL tutuyor olabilir — beklerken okuma / tasarım / kod); her arka plan koşusu `timeout -k 5 <sn>` (en çok 2 saat); önce `cat /proc/loadavg`, 4'ün üstündeyse tek seferlik bekle. GIT_DIR / GIT_WORK_TREE VERME (ders 54). `pkill` / joker `rm` YOK. Tam `npm test` YOK. Kanıt `docs/kanit/{GUN}/s223-*` (büyükse .gz; ayrı 'Kanıt:' commit'i). Commit'e yalnız kendi yolların (`git add <yol>`; ders 44).")
w("- Commit iletisi sonunda tam olarak (model adı YOK):")
w("  Co-Authored-By: Claude <noreply@anthropic.com>")
w("  Claude-Session: https://claude.ai/code/session_01EhegDvmPQ9hx2ibfitm6og")
w("")
w("## Rapor (SubagentHandback, Türkçe)")
w("EN BAŞTA değişen her gözlenebilir davranış (önce → sonra; ekran adıyla; örnek satırlarla: eşleşen / açılan / atlanan cari, kart, çek; hangi cariye ne borç); değişen dosyalar; TARAMA tablosu; yeni / değişen testlerin kırmızı nedeni + yeşili (iki TZ); A–G + G2 sayıları; S228 sınıf tablosu; v2.4.9 karşılaştırması; mutant tablosu; hız tablosu (taban / yeni en iyi + ortanca, olay döngüsü en çok, yük); KULLANICIYA SORULMALI; BAŞ MİMAR KARARI GEREKİYOR; SONRAKİ SÜRÜME (2.5.1); DOĞRULANMADI; DENENMEYEN; 'CI listesine eklenecek'; commit listesi; dal ucu; ana oturumun yeniden koşacağı komutlar.")
open(OUT, 'w', encoding='utf-8').write('\n'.join(o) + '\n')
print('yazıldı', OUT, sum(len(x) + 1 for x in o))
