# ANA OTURUM — CARİ KÂHİNİ BAKIMI 26 (S246 = B kendi kart kolu, S243 = A, FK3 kesişimi SUS + soru, S244 / S245 / S247 / S248 = C SUS): karar girdisi + görev metni üreteci. kahin-cari25-uret.py'den türetildi.
# Ders 5: girdiye programın dosya adı, kod davranışı, sınama sayısı, programın ürettiği değer GİRMEZ. Karar metinlerinin 'SORULACAK (…)' kuyruğu (program / tur bilgisi taşır) KESİLİR; yerine uygulanan öneri yazılır.
# Çağrı: cd <depo>; python3 -I <bu> <girdi çıktısı> <görev metni çıktısı> <taban dalı> <taban ucu>
import sys, re
G_OUT, I_OUT, TABAN, UC = sys.argv[1:5]
SP = '/tmp/claude-0/-home-user/de5e1cbf-7e68-5683-b7bb-f27655eaed4f/scratchpad'
GUN = '2026-11-22'
t = open('docs/2.5.0-IS-LISTESI.md', encoding='utf-8').read(); il = t.split('\n')
cl = open('CLAUDE.md', encoding='utf-8').read().split('\n')
def blok(b):
    h = [i for i, l in enumerate(il) if l.startswith(b)]; assert len(h) == 1, b
    s = h[0]; e = s + 1
    while e < len(il) and il[e].startswith('  ') and not re.match(r'  (S\d+[ =(]|\(\d+\) )', il[e]): e += 1
    x = ' '.join(x.strip() for x in il[s:e])
    k = x.find(' SORULACAK'); k2 = x.find(' SORULDU')
    k = min([v for v in (k, k2) if v >= 0] or [len(x)])
    return x[:k].rstrip()
ONERI = [l.strip() for l in cl if l.strip().startswith('ÖNERİYİ UYGULA (kullanıcı 14.11 06:31')]; BIRAK = [l.strip() for l in cl if l.strip().startswith("2.5.1'E BIRAK")]
assert len(ONERI) == 1 and len(BIRAK) == 1
SEC = {'S235': 'B', 'S243': 'A', 'S244': 'C', 'S245': 'C', 'S246': 'B', 'S247': 'C', 'S248': 'C'}
g = []; w = g.append
w("# Cari kâhini bakımı 26 — karar girdisi (ana oturum yazdı; TEK girdi kaynağın)")
w("")
w("OKUMA KURALI: soru metinlerinde geçen 'bugün', 'bugünkü gibi', 'program', 'kod', 'tur' sözleri ve gözlemler KURAL KAYNAĞI DEĞİLDİR — kural yalnız SEÇİLEN seçeneğin metni (kendi örneğiyle) ve KAPSAM / BAŞ MİMAR satırlarıdır. Seçilen seçeneğin metni 'bugünkü gibi — …' diye başlıyorsa kural tire'den SONRA yazan davranıştır. Kararın söylemediği alt durumda kural UYDURULMAZ: SUS ve raporun 'KULLANICIYA SORULMALI' listesine yaz (ders 40, 43). Bu girdideki kararların hepsi 'KULLANICI KURALIYLA ÖNERİ UYGULANDI' (kullanıcı değiştirebilir).")
w("Kullanıcının 14.11 06:31 kuralı (AYNEN): " + ONERI[0])
w("Kullanıcının 20.11 09:00 kuralı (AYNEN): " + BIRAK[0])
w("")
w("## 1. Taksitli faturanın KENDİ kartı ve fatura Düzenle (S246 = B; dayanağı S235 = B)")
for n in ('S235', 'S246'):
    w("SORU + KARAR %s (AYNEN; seçilen %s — öneri uygulandı): " % (n, SEC[n]) + blok('  %s (' % n))
w("KAPSAM (baş mimar): S246 = B ile önceki bakımın S242 = A kuralı yalnız faturayı İÇİNE ALAN (Mevcut Borç) karta uygulanır; faturanın KENDİ taksit kartında Düzenle ile ARTIRMA kartı yeni tutarla yeniden kurar (Düzenle formundaki ödeme planıyla). Kâhinin S242'yi kendi karta da uygulayan kolu bu karara göre DEĞİŞİR; eski beklenti kaldırılırken kâhinin kendi KARARLAR.md'sine kararın numarası yazılır.")
w("")
w("## 2. Kendi kartında Düzenle ile AZALTMA (S241 ↔ S246 kesişimi) — KARAR YOK, SUS")
w("BAŞ MİMAR KARARI 22.11 (ders 43 — kesinleştirilmez): kendi taksit kartı olan faturanın tutarı, karta tahsilat yapılmışken Düzenle ile AZALTILIRSA (ör. fatura 900, kendi kartı 900, karta tahsilat 600; Düzenle 900 → 300) kararlar bu durumu AÇIKÇA söylemiyor: S241 = A'nın örneği faturayı içine alan Mevcut Borç kartıdır (fazlası avans), S246 = B kendi kartında ARTIRMAYI söyler (kart Düzenle'nin planıyla yeniden kurulur). Kâhin bu alt durumda SUSAR (beklenti yazmaz; mevcut beklentisi varsa susturur ve gerekçeyi KARARLAR.md'ye yazar) ve raporun 'KULLANICIYA SORULMALI' listesine iki seçenek + öneri yazar — her seçenekte kart toplamı, tahsil edilen, kalan, carinin bakiyesi ve avansı SAYIYLA (bakiye seçenekler arasında aynı mı farklı mı açıkça), uç durumsa 'Uç durum böyle kalsın (BİLİNEN SINIR)' seçeneği; 'yaygın programlarda' satırı (doğrulanmış kaynak okunmadıysa 'okunmadı').")
w("")
w("## 3. Elle açılan Mevcut Borç kartının hangi faturayı içine aldığı (S243 = A)")
w("SORU + KARAR S243 (AYNEN; seçilen A — öneri uygulandı): " + blok('  S243 ('))
w("KAPSAM (baş mimar): bakım 25'in girdi §3'ündeki 'kararlar hangi faturanın seçildiğini açıkça söylemiyorsa SUS' kolu bu kararla KALKAR — kâhin en eski faturayı (vade / tarih eskiden yeniye) karta alır; seçilmeyen faturanın İptal Et / iade / Düzenle'si kartı değiştirmez, seçilenin İptal Et / iadesi kartı küçültür / kapatır (bakım 25 §3 ile aynı kural).")
w("")
w("## 4. Uç durumlar — kâhin SUSAR (S244 = C, S245 = C, S247 = C, S248 = C; BİLİNEN SINIR)")
for n in ('S244', 'S245', 'S247', 'S248'):
    w("SORU + KARAR %s (AYNEN; seçilen C — öneri uygulandı): " % n + blok('  %s (' % n))
w("KAPSAM (baş mimar): seçilen C = 'Uç durum böyle kalsın (BİLİNEN SINIR)' → bu dört alt durumda kâhin beklenti YAZMAZ (varsa susturur; KARARLAR.md'ye karar numarasıyla 'BİLİNEN SINIR — kâhin susar'); bakiye / kart toplamı gibi kararın AÇIKÇA aynı dediği sayılar varsa yalnız onlar denetlenebilir (kararın metninde yazıyorsa).")
w("")
w("## 5. API SÖZLEŞMESİ")
w("Önceki bakımların sözleşmesi aynen (kesilmiş belgenin Düzenle'si `POST /api/workspace/invoices/:id/edit`; gövdenin `payment` bölümü ödeme planını taşır — kendi kartlı faturada ödeme 'Taksitli' ve taksit planı Düzenle formundaki gibi verilir).")
open(G_OUT, 'w', encoding='utf-8').write('\n'.join(g) + '\n')
p = []; w = p.append
w(f"Sen DestekOfis projesinde CARİ KÂHİNİ BAKIMI 26 ajanısın (2.5.0; TOPLU BAKIM — S246 = B kendi kart kolu, S243 = A, kendi kartında Düzenle ile azaltma SUS + soru, S244 / S245 / S247 / S248 SUS). Programın KODUNU GÖRMEZSİN (`server/`, `client/`, programın `test/*.test.mjs` dosyaları, `docs/erp/` tasarım notları ve `docs/2.5.0-IS-LISTESI*` OKUNMAZ); programı yalnız API'den, kâhinin kendi bağdaştırıcısıyla (`test/bagimsiz/cari/kos.mjs`) dışarıdan kullanırsın. Yanıtın Türkçe. Eforun high. KENDİ dalında commit edersin; PUSH YOK. Her bitmiş adımı HEMEN commit et (kapsayıcı yeniden başlayabilir); koşuları ≤ 40 dk parçalara böl, kanıtı 'Kanıt:' commit'iyle; rapor taslağı `docs/kanit/{GUN}/kahin-cari26-rapor-taslak.md`. Zamanlanmış görev KURMA. Kendi arka plan işin sürerken rapor vermeden BİTİRME (arka plan işin sürerken turunu 'bekliyorum' diye kapatma; işi ön planda, süre sınırıyla koş).")
w("")
w("## Hazırlık")
w(f"1. Worktree'de (kendi commit'in YOKKEN) `git reset --hard {TABAN}` (= {UC[:8]}). `git log --oneline -2` ile doğrula; değilse DUR. `ln -s /home/user/ofis---y-netimi/node_modules node_modules` (`npm ci` YOK).")
w(f"2. ÖNCE oku: `CLAUDE.md` (dersler; özellikle 5, 6, 7, 16, 31, 40, 43, 44, 54); `docs/BAGIMSIZ-DOGRULAMA-PRENSIBI.md`; kâhinin kendi `test/bagimsiz/cari/KARARLAR.md`'si (güncel kurallar dizini + kendi bakım bölümün); karar girdisi `/home/user/ofis---y-netimi/docs/devir/2.5.0-DEVAM/kahin-cari26-kararlar.md` (TEK karar kaynağın; iş listesinin hiçbir sürümü ve yapım aşaması listesinin içeriği kural kaynağı DEĞİL — liste yalnız `--yapim-asamasi-yaz` çıktısı olarak üretilir / karşılaştırılır).")
w("")
w("## İş")
w("1. S246 = B (girdi §1): kendi kartlı (taksitli) faturada Düzenle ile ARTIRMA — kart Düzenle'nin ödeme planıyla yeni tutarla kurulur; S242 = A yalnız Mevcut Borç kartında. Açık kart + Borçta Kalsın ile kapanmış kart kolları (S235 = B: kapanmış kart yeniden AÇIK kurulur) — kararın söylediği kadarıyla.")
w("2. Kendi kartında Düzenle ile AZALTMA (girdi §2): SUS + KULLANICIYA SORULMALI (iki seçenek + öneri, sayılarla). Kâhinin bu alt durumda bugün beklenti yazan kolu varsa susturulur.")
w("3. S243 = A (girdi §3): yalnız faturalar açıkken elle Mevcut Borç kartı en eski faturayı içine alır; seçilmeyen / seçilen faturanın iptal / iade kolları.")
w("4. S244 / S245 / S247 / S248 = C (girdi §4): kâhin susar; KARARLAR.md'ye karar numarasıyla.")
w("5. Kâhinin öz testi + mutasyon (kendi araçları): her yeni / değişen kuralın dişi — kural başına en az bir mutant (ör. S246'da kendi kartı eski tutarda bırak; S243'te en yeni faturayı seç) yakalanmalı; susturulan alt durumlarda susmanın kendisi bir öz testle (beklenti yazılmıyor) gösterilir.")
w(f"6. PROGRAMLA KARŞILAŞTIRMA (taban dalındaki program): `npm run test:kahin-cari` iki TZ (UTC, Europe/Istanbul). Fark çıkarsa: en küçük örnek + hangisinin girdiye uymadığı (kâhin mi program mı) — kâhin programa UYDURULMAZ (ders 40); program şüphesi 'P' diye raporlanır. Yapım aşaması listesi KENDİ kopyanda `--yapim-asamasi-yaz` (KAHIN_YAPIM_ASAMASI ile not defterine) — depodaki liste ancak kendi dalında, ayrı commit'le, öncesi / sonrası farkıyla (yeni / kapanan / değeri değişen; her kayıt için NEDENİ) güncellenir; yeni kayıt girerse paket etiketi 'Ç7b' (kâhinin tanıdığı etiketlerden; yeni etiket UYDURMA), gerekçesi kayıtta. Hedef: yayın adayında liste BOŞ — boşalmıyorsa her kalan kaydın nedeni.")
w("7. ESKİ KÂHİN KIRMIZISI: her yeni / değişen kural, bakım öncesi kâhinle aynı programda farklı sonuç vermeli (ya da öncekinde senaryo yoktu); sayıyla göster.")
w("")
w("## Kurallar")
w(f"- YAZABİLECEĞİN: yalnız `test/bagimsiz/cari/**` ve `docs/kanit/{GUN}/kahin-cari26-*`. Program kodu, öbür kâhinler, sürücü YASAK.")
w(f"- Koşular `HUKUK_LICENSE_URL=http://127.0.0.1:9 KANIT_DIR=<not defterin> node tools/kanit.mjs kos kahin-cari26-<ad> -- <komut>`; ölçüm DIŞI HER koşu (tek test dahil) `flock -s -w 3600 {SP}/olcum.lock timeout -k 5 <sn> <komut>` (süre sınırı flock'un İÇİNDE; ana oturumun özel kilitli ölçümü sürerken koşun bekler — bekle, kilitsiz koşma). Not defterin BENZERSİZ: `{SP}/kc26-<ajan kimliğinin ilk 3 hanesi>/`. Arka plan koşusu en çok 2 saat. Önce `cat /proc/loadavg`, 4'ün üstündeyse tek seferlik bekle. GIT_DIR / GIT_WORK_TREE VERME. `pkill` / joker `rm` YOK. Tam `npm test` YOK. Disk 5 GB'ın altına düşmez. Commit'e yalnız kendi yolların (`git add <yol>`; `-A` / `-u` / `commit -a` YOK).")
w("- 2.5.1'E BIRAK (kullanıcı kuralı girdide AYNEN): kâhinin iç bakımı / test düzeni / belge türü husus bu bakımda KOVALANMAZ; raporun 'SONRAKİ SÜRÜME (2.5.1)' başlığına.")
w("- Commit iletisi sonunda tam olarak (model adı YOK):")
w("  Co-Authored-By: Claude <noreply@anthropic.com>")
w("  Claude-Session: https://claude.ai/code/session_01EhegDvmPQ9hx2ibfitm6og")
w("")
w("## Rapor (SubagentHandback, Türkçe; kısa cümle, madde, tablo)")
w("Özet; her yeni / değişen / susturulan denetimin kuralı (girdinin hangi satırından); öz test + mutasyon sayıları; program ↔ kâhin iki TZ (taban); yapım aşaması listesi (önce / sonra; yeni / kapanan / değişen + nedenleri); eski kâhin kırmızısı; P (program şüphesi) listesi en küçük örnekle; KULLANICIYA SORULMALI (iki seçenek + öneri, sayılarla; uç durumsa 'Uç durum böyle kalsın (BİLİNEN SINIR)'; 'yaygın programlarda' satırı — doğrulanmış kaynak okunmadıysa 'okunmadı'); SONRAKİ SÜRÜME (2.5.1); DENENMEYEN; değişen yollar; commit listesi; dal ucu; ana oturumun yeniden koşacağı komutlar.")
open(I_OUT, 'w', encoding='utf-8').write('\n'.join(p) + '\n'); print('yazıldı', G_OUT, I_OUT)
