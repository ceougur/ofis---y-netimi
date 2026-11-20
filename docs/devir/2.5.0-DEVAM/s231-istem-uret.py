# ANA OTURUM — S231 KÜÇÜK TURU görev metni üreteci (S223'ün ardılı: grup adının Türkçe katlamalı bulunması + çek eşleme penceresi metni + çek / senet yüklemesinin hızı).
# Kararlar iş listesinden ve CLAUDE.md'den AYNEN. Çağrı: cd <depo>; python3 -I <bu> <çıktı> <taban dalı> <taban ucu> <gün> <hız tabanı dalı>
import sys, re
OUT, TABAN, UC, GUN, HIZT = sys.argv[1:6]
SP = '/tmp/claude-0/-home-user/de5e1cbf-7e68-5683-b7bb-f27655eaed4f/scratchpad'
t = open('docs/2.5.0-IS-LISTESI.md', encoding='utf-8').read(); il = t.split('\n'); D = t[t.find('\n## D'):]
cl = open('CLAUDE.md', encoding='utf-8').read().split('\n')
def blok(b):
    h = [i for i, l in enumerate(il) if l.startswith(b)]; assert len(h) == 1, b
    s = h[0]; e = s + 1
    while e < len(il) and il[e].startswith('  ') and not re.match(r'  (S\d+[ =(]|\(\d+\) )', il[e]): e += 1
    return ' '.join(x.strip() for x in il[s:e])
def karar(b, ic=''):
    h = [x for x in D.split('\n- ') if x.startswith(b) and ic in x[:200]]; assert len(h) == 1, (b, len(h)); return '- ' + h[0].strip()
def madde(ic, dv):
    h = [i for i, l in enumerate(cl) if ic in l]; assert len(h) == 1, ic
    s = h[0]; e = s + 1
    while e < len(cl) and re.match(dv, cl[e]) and not re.match(r'\s*(\d+\.|-) ', cl[e]): e += 1
    return ' '.join(x.strip() for x in cl[s:e])
S231, S232, S223, S228 = blok('  S231 ('), blok('  S232 ('), blok('  S223 ('), blok('  S228 (')
K1447 = karar('KULLANICI KARARI 20.11 14:47 UTC')
BMR = karar('BAŞ MİMAR KARARI 20.11', 'S223 KÜÇÜK TURU — RAPOR')
BMH = karar('BAŞ MİMAR KARARI 20.11', 'S223 KÜÇÜK TURU — HIZ HÜKMÜ')
AYNI_AD = madde('"aynı adlı iki kişi" durumu denenir', r'   +\S'); SIKAYET3 = madde('3. "Kişi bir kez girilir"', r'   +\S'); CARI = madde('Cari yalnız "+ Yeni Cari"', r'  +\S')
BIRAK = [l.strip() for l in cl if l.strip().startswith("2.5.1'E BIRAK")]; ONERI = [l.strip() for l in cl if l.strip().startswith('ÖNERİYİ UYGULA (kullanıcı 14.11 06:31')]
assert len(BIRAK) == 1 and len(ONERI) == 1
o = []; w = o.append
w(f"Sen DestekOfis projesinde S231 KÜÇÜK TURU KOD ajanısın (2.5.0 — S223'ün ardılı; içe aktarmalarda kişi eşleştirmesi hangi cariye borç yazılacağını belirler → PARA ÇEKİRDEĞİNE YAKIN; eforun high). ÜÇ İŞ: (1) S231 = A — içe aktarmalarda GRUP adı da S228 sırasıyla Türkçe harf katlamalı bulunur; (2) Çek / Senet eşleme penceresinin metni; (3) Çek / Senet portföy yüklemesinin HIZI (ana oturumun hız hükmünde S223 kodu +%12 / +%21 KÖTÜ). Yanıtın Türkçe. PUSH YOK. Her bitmiş adımı (kod + testi + kanıtı) HEMEN commit et; koşuları ≤ 40 dk parçalara böl, her parçanın kanıtını hemen 'Kanıt:' commit'iyle kaydet; rapor taslağını `docs/kanit/{GUN}/s231-rapor-taslak.md`'ye adım adım yaz. Zamanlanmış görev KURMA. Kendi arka plan işin sürerken rapor vermeden BİTİRME; bekleme için boş döngü kurma.")
w("")
w("## Hazırlık")
w(f"1. Worktree'de (kendi commit'in YOKKEN) `git reset --hard {TABAN}` (= {UC[:8]}: S223 küçük turunun ucu; onun tabanı Ç7b aday dalı — Ç7b henüz çalışma dalında DEĞİL, birleşim ana oturumda). `git log --oneline -2` ile doğrula; değilse DUR. `ln -s /home/user/ofis---y-netimi/node_modules node_modules` (`npm ci` YOK); tarayıcı `PLAYWRIGHT_BROWSERS_PATH={SP}/pw-1194`. ESKİ KOD (kırmızı kanıtı): taban {TABAN} kendisi (`git worktree add --detach /dev/shm/s231-<kısa>/eski {TABAN}`; ders 23, 25, 51, 54 — eski kopyaya YALNIZ yeni test dosyaları; değiştirdiğin test dosyası eski hâliyle kalır). HIZ TABANI: {HIZT} (S223'ten önceki kod) VE {TABAN} — ikisiyle de karşılaştır.")
w("2. ÖNCE oku: `CLAUDE.md` (dersler; özellikle 6, 7, 9, 10, 12, 17, 28, 38, 43, 44, 47, 51, 53, 54; 'Test kuralı', 'Kullanıcının tekrar eden şikâyetleri', 'Kalıcı ürün kararları', 'Yazım düzeni'); `docs/BAGIMSIZ-DOGRULAMA-PRENSIBI.md`; S223 raporu `docs/devir/2.5.0-DEVAM/s223-rapor.md` (TARAMA, S228 sırası, KULLANICIYA SORULMALI 1 — grup adı örneği, HIZ); S223'ün testleri (`test/s223-*.test.mjs`, `test/e2e/senaryo-s223-250.mjs`) ve hız düzeneği `docs/kanit/2026-11-20/s223-hiz/`. Kâhin MODEL dosyaları okunmaz, `test/bagimsiz/**` YAZILMAZ.")
w("")
w("## Kararlar (AYNEN)")
for x in ("ANAYASA (test kuralı): " + AYNI_AD, "ANAYASA (kullanıcının tekrar eden şikâyeti): " + SIKAYET3, "KALICI ÜRÜN KARARI (2.0.19 kuralı DEĞİŞMEZ): " + CARI, S223, K1447, S228, S231, S232, BMR, BMH, "KULLANICI KURALI: " + ONERI[0], "KULLANICI KURALI: " + BIRAK[0]): w(x)
w("")
w("## İş (sırayla; her biri ÖNCE bugünkü kodda örnek veriyle yeniden üretilir — ders 6)")
w("0. NASIL BOZULUR (rapor taslağının başına, koddan ÖNCE, commit): grup adı I / ı, İ / i, Ş Ğ Ü Ö Ç ve boşluk varyantları ('Işık Servisi' ↔ 'IŞIK SERVİSİ' ↔ 'ışık servisi'); alt grup (güzergâh / blok) da aynı; var olan ÇİFT grup (iki yazımla iki grup — S228 gibi: önce bugünkü karşılaştırma); aynı dosyada iki yazım (ilkinin açtığı grup ikinciye görünmeli); telefonsuz kişi + aynı grup (S223'ün kişi kuralı); telefonlu kişi (grup eşleşmeyi DEĞİŞTİRMEZ); Tablodan Aktar ön izleme ↔ aktarım aynı sonuç; Geri Al; kilitli dönem; iki şirket; elle grup açma / yeniden adlandırma formu (DEĞİŞMEZ — 'aynı adlı grup var' kuralı bugünkü gibi).")
w("1. TARAMA (koddan ÖNCE; tablo: yol, ne karşılaştırıyor, kapsamda mı, ne yapıldı): grup / alt grup adını bulan her yer — `git grep -n -E \"plan_groups|ensureGroup|groupExisting|groupId\" -- server client/assets`. Bilinen başlangıç noktaları (eksiksiz DEĞİL): `server/routes/plans.mjs` ensureGroup (Excel yüklemesi ve elle grup açma ORTAK — elle yol DEĞİŞMEZ: içe aktarmaya ayrı bulucu ya da isteğe bağlı parametre), grup yeniden adlandırma çakışma denetimi (DEĞİŞMEZ); `server/routes/plan-transfer.mjs` groupExisting (ön izleme) ve aktarımın grup bulması. KAPSAM: yalnız içe aktarma yolları (taksit Excel / Sheets, Tablodan Aktar; cari Excel'in grup sütunu varsa o da).")
w("2. KOD (S231 = A): içe aktarmada grup / alt grup adı S228 sırasıyla: önce BUGÜNKÜ karşılaştırma (NOCASE) tek grup buluyorsa o; bulamazsa Türkçe katlamalı (`server/lib/names.mjs` foldPersonName ya da yanına yazılan grup katlaması — var olan işlevlerin davranışı DEĞİŞMEZ); o da tek değilse bugünkü davranış (yeni grup açılır). Bugün doğru bulunan hiçbir grup DEĞİŞMEZ (testle göster). Yükleme başına TEK toplu okuma (ders 47). Göç / şema / dizin YOK; var olan çift gruplar BİRLEŞTİRİLMEZ.")
w("3. ÇEK PENCERESİ METNİ (`client/assets/hof-cheques.js`; 'Keşideci adı birebir aynı olan tek cari varsa evrak o cariye bağlanır.'): 'Keşideci adı aynı olan (büyük / küçük harf ve boşluk farkı sayılmaz) tek cari varsa evrak o cariye bağlanır.' — cümle düzeni; kılavuzda aynı anlatım varsa o da (PDF yeniden üretimi + pdf-denetle; ders 42).")
w(f"4. ÇEK HIZI (ders 47, 53 (a)): ana oturumun ölçümünde (temiz 100 bin, 500 satır, hepsi yeni ad) {HIZT} 71 / 71 ms (en iyi / ortanca) → S223 kodu 79 / 86 ms. Nedeni ÖLÇEREK bul (profil / ara zaman; tahmin yazma): ad haritasının kurulması, satır başına ek sorgu ya da katlama. Davranış AYNEN (S223'ün bütün testleri yeşil kalır), çek yolu {HIZT}'nin %10'u içine döner. Aynı düzeltme cari Excel / taksit Excel / Tablodan Aktar'ın ortak yardımcısındaysa onları da ölç.")
w("5. TESTLER (yeni dosya, `test/` altında): grup varyantları × taksit Excel + Tablodan Aktar (ön izleme + aktarım) × telefonsuz kişi; S231 örneği (önce 'Elif Su' / 'Işık Servisi', sonra 'ELİF SU' / 'IŞIK SERVİSİ' → AYNI grup, AYNI cari, tek borç); var olan çift grup; aynı dosyada iki yazım; elle grup formu DEĞİŞMEDİ; her biri tabanda BEKLENEN NEDENLE kırmızı (ileti okunur, ders 38, 51), yenide yeşil; iki TZ; göreli tarih. Sayılar VERİ TABANINDAN (ders 3, 12). Çek metni için ekran senaryosu ya da kaynak denetimi.")
w("")
w("## Kabul koşulları")
w("A. `npm run test:kahin-defter` ve `npm run test:kahin-cari` tabanda ve sonda (iki TZ) — sayılar aynı; yapım aşaması listesi kendi yolunda (`KAHIN_YAPIM_ASAMASI=<kendi kopyan>`) BOŞ.")
w("B. Muhasebe sürücüsü (`test/bagimsiz/muhasebe-surucu`; DEĞİŞTİRME) taban ↔ son: gerileme.py BİREBİR beklenir; çıkan her fark adıyla.")
w("C. S223'ün bütün testleri + ekran senaryosu `senaryo-s223-250` yeşil (iki TZ); c7bt aynı adlı Excel testi yeşil.")
w(f"D. ESKİ SÜRÜM (ders 17, 53 (b)): v2.4.9'un gerçek kodunda S231 örneği → çift grup / çift cari sayısıyla; v2.4.9 verisinde yeni kodla yükleme → tek grup; sınıf listesi KALICI testte (S223'ün kabul D dosyasının yanına ya da ona ek).")
w(f"E. HIZ: değiştirdiğin her yükleme yolu + çek 500 — temiz 100 bin `{SP}/ana-kabul/temiz-100k` (OKUNUR; KENDİ kopyanda) {HIZT} ↔ {TABAN} ↔ yeni, dönüşümlü en az 3 tur; ÖZEL kilit `flock -x -w 1800 {SP}/olcum.lock` tek seferlik (alamazsan 'ÖLÇÜLEMEDİ'); her koşu başında /proc/loadavg; yük > 2 ise 'GEÇERSİZ'. Ölçüt: {HIZT}'ye göre en iyi VE ortanca %10'dan kötü değil.")
w("F. DEĞİŞMEZLER: Mutabakat Testi + Defter Mutabakatı her yüklemeden sonra temiz; bakiyeler yalnız grup varyantı satırlarında değişir (her biri testte yazılı).")
w("G. EKRAN (ders 11, 12, 28, 34, 39): Taksitler → Excel'den Yükle büyük harfli grup adlarıyla (gerçek tıklama, insan hızı; ön izleme + sonuç); Çek / Senet içe aktarma penceresinin yeni metni; ekran görüntüleri `docs/kanit/" + GUN + "/s231-ekran/`. Beklentisi değişen her ekran senaryosu KOŞULUR. Yeni ekran senaryosu açabilirsin; ci.yml'ye EKLEME — raporda 'CI listesine eklenecek'.")
w("G2. KOMŞULAR (ders 10): grup bulmaya / plan_groups'a / içe aktarmalara dokunan testler `git grep` taramasıyla, iki TZ. MUTANTLAR DEĞERLE (en az: grup katlamasını kaldır; S228 sırasını ters çevir; elle grup formunu da katlamalı yap (DEĞİŞMEMELİ — test yakalamalı); aynı yüklemede açılan grubu haritaya ekleme; çek hız düzeltmesinin önbelleğini yanlış anahtarla tut) — her biri en az bir testte kırmızı.")
w("")
w("## Kurallar")
w("- DOSYA SINIRI: `server/routes/plans.mjs` ve `server/routes/plan-transfer.mjs` (YALNIZ içe aktarmanın grup bulması), `server/routes/cheques.mjs` ve `server/routes/accounts.mjs` (YALNIZ çek eşlemesinin hızı / S223'ün ad eşleme yardımcıları; davranış aynen), `server/lib/names.mjs` (yalnız YENİ işlev), `client/assets/hof-cheques.js` (YALNIZ pencere metni), testler + `test/fixtures/**`, kılavuz HTML + PDF (gerekirse). Başka her dosya YASAK; özellikle migrations / db / ledger / bank / whatsapp / einvoice, `.github/**`, package.json, tools/**, `test/bagimsiz/**`.")
w("- PARA / KİŞİ EŞLEŞTİRME KURALI AYRIŞMASI (ders 43): kararların söylemediği durum çıkarsa KODLAMA — 'KULLANICIYA SORULMALI' (iki seçenek + öneri + her okumada hangi cariye ne borç; uç durumsa üçüncü seçenek 'Uç durum böyle kalsın (BİLİNEN SINIR)'). Mimari seçimse 'BAŞ MİMAR KARARI GEREKİYOR'. Önce iş listesi C / D'de ARA (`docs/2.5.0-IS-LISTESI.md`).")
w("- KULLANICI KURALI (yukarıda AYNEN): programı ya da kullanıcıyı etkilemeyen ayrıntıyı KOVALAMA; raporun 'SONRAKİ SÜRÜME (2.5.1)' başlığına.")
w(f"- Koşular `HUKUK_LICENSE_URL=http://127.0.0.1:9 KANIT_DIR=<not defterin> node tools/kanit.mjs kos s231-<ad> -- <komut>`; BÜTÜN test koşuların `flock -s -w 3600 {SP}/olcum.lock` altında (tek seferlik bekleme; kilit süresi dolarsa bir kez yeniden başlat, döngü kurma); her arka plan koşusu `timeout -k 5 <sn>` (en çok 2 saat); önce `cat /proc/loadavg`, 4'ün üstündeyse tek seferlik bekle. GIT_DIR / GIT_WORK_TREE VERME (ders 54). `pkill` / joker `rm` YOK. Tam `npm test` YOK. Veri / kod kopyaları /dev/shm'de kendi klasöründe; bitince tam yoluyla sil (git worktree'yi zorlamadan kaldır). Disk 5 GB'ın altına düşmez. Kanıt `docs/kanit/{GUN}/s231-*` (ayrı 'Kanıt:' commit'i). Commit'e yalnız kendi yolların (`git add <yol>`; ders 44).")
w("- Commit iletisi sonunda tam olarak (model adı YOK):")
w("  Co-Authored-By: Claude <noreply@anthropic.com>")
w("  Claude-Session: https://claude.ai/code/session_01EhegDvmPQ9hx2ibfitm6og")
w("")
w("## Rapor (SubagentHandback, Türkçe)")
w("EN BAŞTA değişen her gözlenebilir davranış (önce → sonra; ekran adıyla; S231 örneğinin sayılarıyla); değişen dosyalar; TARAMA tablosu; çek hızının ÖLÇÜLMÜŞ nedeni ve düzeltmesi; yeni / değişen testlerin kırmızı nedeni + yeşili (iki TZ); A–G + G2 sayıları; v2.4.9 karşılaştırması; mutant tablosu; hız tablosu (üç kod; en iyi + ortanca, olay döngüsü en çok, yük); KULLANICIYA SORULMALI; BAŞ MİMAR KARARI GEREKİYOR; SONRAKİ SÜRÜME (2.5.1); DOĞRULANMADI; DENENMEYEN; 'CI listesine eklenecek'; commit listesi; dal ucu; ana oturumun yeniden koşacağı komutlar.")
open(OUT, 'w', encoding='utf-8').write('\n'.join(o) + '\n'); print('yazıldı', OUT, sum(len(x) + 1 for x in o))
