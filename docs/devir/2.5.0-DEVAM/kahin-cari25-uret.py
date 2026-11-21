# ANA OTURUM — CARİ KÂHİNİ BAKIMI 25 (S238–S242 + kesilmiş belgenin Düzenle ucu + kart kapsam seçimi): karar girdisi + görev metni üreteci. Kararlar iş listesi C'den AYNEN; KAPSAM satırları baş mimarın.
# Ders 5: girdiye programın dosya adı, kod davranışı, sınama sayısı, programın ürettiği değer GİRMEZ. Yalnız API SÖZLEŞMESİ (alan anlamı) — kâhinin bağdaştırıcısı API'yi zaten okuyor.
# Çağrı: cd <depo>; python3 -I <bu> <girdi çıktısı> <görev metni çıktısı> <taban dalı> <taban ucu>
import sys, re
G_OUT, I_OUT, TABAN, UC = sys.argv[1:5]
SP = '/tmp/claude-0/-home-user/de5e1cbf-7e68-5683-b7bb-f27655eaed4f/scratchpad'
t = open('docs/2.5.0-IS-LISTESI.md', encoding='utf-8').read(); il = t.split('\n')
cl = open('CLAUDE.md', encoding='utf-8').read().split('\n')
def blok(b):
    h = [i for i, l in enumerate(il) if l.startswith(b)]; assert len(h) == 1, b
    s = h[0]; e = s + 1
    while e < len(il) and il[e].startswith('  ') and not re.match(r'  (S\d+[ =(]|\(\d+\) )', il[e]): e += 1
    return ' '.join(x.strip() for x in il[s:e])
ONERI = [l.strip() for l in cl if l.strip().startswith('ÖNERİYİ UYGULA (kullanıcı 14.11 06:31')]; BIRAK = [l.strip() for l in cl if l.strip().startswith("2.5.1'E BIRAK")]
assert len(ONERI) == 1 and len(BIRAK) == 1
g = []; w = g.append
w("# Cari kâhini bakımı 25 — karar girdisi (ana oturum yazdı; TEK girdi kaynağın)")
w("")
w("OKUMA KURALI: soru metinlerinde geçen 'program bugün', 'kod', 'tur', 'test' sözleri ve program gözlemleri KURAL KAYNAĞI DEĞİLDİR — kural yalnız KARAR satırları (seçilen seçeneğin metni ve kararın kendi örneği) ve KAPSAM satırlarıdır. Kararın söylemediği alt durumda kural UYDURULMAZ: SUS ve raporun 'KULLANICIYA SORULMALI' listesine yaz (ders 40, 43). Etiketler: 'KULLANICI KARARI', 'KULLANICI KURALIYLA ÖNERİ UYGULANDI', 'BAŞ MİMAR KARARI / YORUMU'. Bu bakımdaki S238–S242'nin hepsi 'KULLANICI KURALIYLA ÖNERİ UYGULANDI' (öneri A); kullanıcı değiştirebilir.")
w("Kullanıcının 14.11 06:31 kuralı (AYNEN): " + ONERI[0])
w("Kullanıcının 20.11 09:00 kuralı (AYNEN): " + BIRAK[0])
w("")
w("## 1. İade ve iade iptali (S238 = A, S239 = A, S240 = A)")
for n in ('S238', 'S239', 'S240'):
    w("SORU + KARAR %s (AYNEN; seçilen A): " % n + blok('  %s (' % n))
w("")
w("## 2. Kesilmiş faturanın Düzenle ile azaltılması / artırılması (S241 = A, S242 = A)")
for n in ('S241', 'S242'):
    w("SORU + KARAR %s (AYNEN; seçilen A): " % n + blok('  %s (' % n))
w("KAPSAM (baş mimar; S234 = A + önceki bakımın KAPSAM (e) 'azaltılan tutar iade gibi'): Düzenle ile azaltma kartı iade ile AYNI kuralla küçültür (açık kart, Borçta Kalsın ile kapanmış kart, kendi kartı); kartın açık kalanını aşan kısım carinin avansıdır (S241 = A) — kart, kartın kendi hesabı ve Tek Yükümlülük Kuyruğu görünümü AYNI sayıyı verir. Artırma kartı değiştirmez; artan tutar faturanın kendi vadesiyle ayrı açıktır (S242 = A).")
w("")
w("## 3. Carinin açık borcu kart tutarından FAZLAYKEN açılmış Mevcut Borç kartında kalem iptali / iadesi (BAŞ MİMAR YORUMU; kullanıcıya gösterildi, değiştirebilir)")
for n, onek in (('S110', '- KULLANICI KARARI 11.11 03:15 UTC'), ('S120', '- KULLANICI KARARI 11.11 06:35 UTC')):
    h = [l for l in il if l.startswith(onek)]; assert len(h) == 1, onek
    w("KULLANICI KARARI %s (iş listesi D'den AYNEN): " % n + h[0][2:])
w("BAŞ MİMAR YORUMU (kural VAR — S110 / S120 + karar (4); yeni kural DEĞİL): kart, açıldığı anda S110 / S120'ye göre içine aldığı kalemi taşır; o kalem iade / iptal / Düzenle ile azalırsa kart karar (4) ile küçülür; kartın içine ALMADIĞI bir kalemin iptali / iadesi kartı DEĞİŞTİRMEZ. Örnek (yalnız faturalar): A 600 (01.09), B 600 (02.09), sonra elle Mevcut Borç kartı 600 → kartın içinde S110 / S120'nin seçtiği kalem; seçilmeyen faturanın İptal Et'i kartı değiştirmez, seçilenin İptal Et'i kartı karar (4) / S206 ile küçültür / kapatır. Kararlar bu örnekte hangi faturanın seçildiğini AÇIKÇA söylemiyorsa SUS ve 'KULLANICIYA SORULMALI'ya yaz (uydurma).")
w("")
w("## 4. API SÖZLEŞMESİ (alan anlamları; beklenen değer DEĞİL — bağdaştırıcının okuması için)")
w("Önceki bakımların sözleşmesi aynen. YENİ — KESİLMİŞ (kaydedilmiş) belgenin Düzenle'si: `POST /api/workspace/invoices/:id/edit`, gövde `{ scenario, accountId, issueDate, lines[], payment: { cash[], cheques[], endorse[], rest, dueDate, installments }, force }` (faturanın ayrıntısından okunan değerlerle; yalnız değiştirilen alan farklı). Taslak belgede bu uç 409 `invoice-not-issued` döner. `PUT /api/workspace/invoices/:id` yalnız TASLAK içindir (kesilmiş belgede 409 `invoice-not-draft`) — önceki bakımın Düzenle yoklaması bu yüzden kesilmiş belgede hiç çalışmadı.")
open(G_OUT, 'w', encoding='utf-8').write('\n'.join(g) + '\n')
p = []; w = p.append
w(f"Sen DestekOfis projesinde CARİ KÂHİNİ BAKIMI 25 ajanısın (2.5.0; TOPLU BAKIM — S238–S242 + kesilmiş belgenin Düzenle ucu + kart kapsam seçimi). Programın KODUNU GÖRMEZSİN (`server/`, `client/`, programın `test/*.test.mjs` dosyaları ve `docs/erp/` tasarım notları OKUNMAZ); programı yalnız API'den, kâhinin kendi bağdaştırıcısıyla (`test/bagimsiz/cari/kos.mjs`) dışarıdan kullanırsın. Yanıtın Türkçe. Eforun high. KENDİ dalında commit edersin; PUSH YOK. Her bitmiş adımı HEMEN commit et (kapsayıcı yeniden başlayabilir); koşuları ≤ 40 dk parçalara böl, kanıtı 'Kanıt:' commit'iyle; rapor taslağı `docs/kanit/2026-11-21/kahin-cari25-rapor-taslak.md`. Zamanlanmış görev KURMA. Kendi arka plan işin sürerken rapor vermeden BİTİRME.")
w("")
w("## Hazırlık")
w(f"1. Worktree'de (kendi commit'in YOKKEN) `git reset --hard {TABAN}` (= {UC[:8]}). `git log --oneline -2` ile doğrula; değilse DUR. `ln -s /home/user/ofis---y-netimi/node_modules node_modules` (`npm ci` YOK).")
w(f"2. ÖNCE oku: `CLAUDE.md` (dersler; özellikle 5, 6, 7, 16, 31, 40, 43, 44, 54); `docs/BAGIMSIZ-DOGRULAMA-PRENSIBI.md`; kâhinin kendi `test/bagimsiz/cari/KARARLAR.md`'si (güncel kurallar dizini + kendi bakım bölümün); karar girdisi `/home/user/ofis---y-netimi/docs/devir/2.5.0-DEVAM/kahin-cari25-kararlar.md` (TEK karar kaynağın; iş listesinin hiçbir sürümü ve yapım aşaması listesinin içeriği kural kaynağı DEĞİL).")
w("")
w("## İş")
w("1. DÜZENLE EŞLEMESİ (girdi §4): bağdaştırıcı KESİLMİŞ belgenin Düzenle'sini yeni uçtan yapar; önceki bakımın Düzenle senaryoları (kapalı kart + Düzenle ile azaltma vb.) yeniden koşulur. Her senaryoda yanıt kodu + gövde okunur (ders 3); 409 / 4xx 'yapıldı' sayılmaz.")
w("2. YENİ KURALLAR (girdi §1, §2, §3): kâhinin modelinde (ayrı dilde, Python) — S239 (kısmen kart içindeki faturaya iade), S240 (çok kalemli kartta iade ve ödeme dağılımı), S238 (iade iptali aynı taksite; modelde zaten varsa yalnız senaryo), S241 (Düzenle ile kartın açık kalanından fazla azaltma → fazlası avans; kart, kartın kendi hesabı ve kuyruk görünümü aynı), S242 (Düzenle ile artırma kartı değiştirmez), §3 (iki faturalı caride elle kart; seçilmeyen faturanın iptali / iadesi kartı değiştirmez). Her kural için açık kart, Borçta Kalsın ile kapanmış kart, kendi kartı (taksitli fatura) kolları — kararın söylediği kadarıyla.")
w("3. Kâhinin öz testi + mutasyon (kendi araçları): her yeni kuralın dişi — kural başına en az bir mutant (ör. S241'de fazlayı kartta bırak; S242'de kartı büyüt; §3'te seçilmeyen faturanın iptalinde kartı küçült; Düzenle ucunu taslak ucuna geri çevir) yakalanmalı.")
w(f"4. PROGRAMLA KARŞILAŞTIRMA (taban dalındaki program): `npm run test:kahin-cari` iki TZ (UTC, Europe/Istanbul). Fark çıkarsa: en küçük örnek + hangisinin girdiye uymadığı (kâhin mi program mı) — kâhin programa UYDURULMAZ (ders 40); program şüphesi 'P' diye raporlanır. Programın henüz yapmadığı BİLİNEN kısım (girdi §2 S241'in azaltma kolu ve §3) fark verirse yapım aşaması listesine KAYIT olarak girer — paket etiketi 'Ç7b' (kâhinin tanıdığı etiketlerden; yeni etiket UYDURMA), gerekçesi kayıtta. Yapım aşaması listesi KENDİ kopyanda `--yapim-asamasi-yaz` (KAHIN_YAPIM_ASAMASI ile not defterine) — depodaki liste ancak kendi dalında, ayrı commit'le, öncesi / sonrası farkıyla (yeni / kapanan / değeri değişen) güncellenir. Önceki 38 Düzenle kaydının her biri için: kapandı mı, kaldıysa NEDENİ.")
w("5. ESKİ KÂHİN KIRMIZISI: her yeni kural, bakım öncesi kâhinle aynı programda farklı sonuç vermeli (ya da öncekinde senaryo yoktu); sayıyla göster.")
w("")
w("## Kurallar")
w("- YAZABİLECEĞİN: yalnız `test/bagimsiz/cari/**` ve `docs/kanit/2026-11-21/kahin-cari25-*`. Program kodu, öbür kâhinler, sürücü YASAK.")
w(f"- Koşular `HUKUK_LICENSE_URL=http://127.0.0.1:9 KANIT_DIR=<not defterin> node tools/kanit.mjs kos kahin-cari25-<ad> -- <komut>`; ölçüm DIŞI HER koşu (tek test dahil) `flock -s -w 3600 {SP}/olcum.lock timeout -k 5 <sn> <komut>` (süre sınırı flock'un İÇİNDE; ana oturumun özel kilitli ölçümü sürerken koşun bekler — bekle, kilitsiz koşma). Arka plan koşusu en çok 2 saat. Önce `cat /proc/loadavg`, 4'ün üstündeyse tek seferlik bekle. GIT_DIR / GIT_WORK_TREE VERME. `pkill` / joker `rm` YOK. Tam `npm test` YOK. Disk 5 GB'ın altına düşmez. Commit'e yalnız kendi yolların (`git add <yol>`; `-A` / `-u` / `commit -a` YOK).")
w("- 2.5.1'E BIRAK (kullanıcı kuralı yukarıda girdide AYNEN): kâhinin iç bakımı / test düzeni / belge türü husus bu bakımda KOVALANMAZ; raporun 'SONRAKİ SÜRÜME (2.5.1)' başlığına.")
w("- Commit iletisi sonunda tam olarak (model adı YOK):")
w("  Co-Authored-By: Claude <noreply@anthropic.com>")
w("  Claude-Session: https://claude.ai/code/session_01EhegDvmPQ9hx2ibfitm6og")
w("")
w("## Rapor (SubagentHandback, Türkçe; kısa cümle, madde, tablo)")
w("Özet; Düzenle eşlemesi (uç, 38 kaydın akıbeti); her yeni denetimin kuralı (girdinin hangi satırından); öz test + mutasyon sayıları; program ↔ kâhin iki TZ (taban); yapım aşaması listesi (önce / sonra; yeni / kapanan / değişen); eski kâhin kırmızısı; P (program şüphesi) listesi en küçük örnekle; KULLANICIYA SORULMALI (iki seçenek + öneri; uç durumsa 'Uç durum böyle kalsın (BİLİNEN SINIR)'; 'yaygın programlarda' satırı — doğrulanmış kaynak okunmadıysa 'okunmadı'); SONRAKİ SÜRÜME (2.5.1); DENENMEYEN; değişen yollar; commit listesi; dal ucu; ana oturumun yeniden koşacağı komutlar.")
open(I_OUT, 'w', encoding='utf-8').write('\n'.join(p) + '\n'); print('yazıldı', G_OUT, I_OUT)
