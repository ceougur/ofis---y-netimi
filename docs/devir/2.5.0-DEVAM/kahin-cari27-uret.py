# ANA OTURUM — CARİ KÂHİNİ BAKIMI 27 (KÜÇÜK: S249 = A kendi kartında Düzenle ile azaltma, S251 = A iadeli faturanın Düzenle'si reddedilir, S250 = C susma aynen): karar girdisi + görev metni üreteci. kahin-cari26-uret.py'den türetildi.
# Ders 5: girdiye programın davranışı / ürettiği değer GİRMEZ — S249 / S251 metinlerinden 'program bugün …' cümleleri ve hata kodu ÇIKARILIR; 'SORULACAK (…)' kuyruğu kesilir.
# Çağrı: cd <depo>; python3 -I <bu> <girdi çıktısı> <görev metni çıktısı> <taban dalı> <taban ucu>
import sys, re
G_OUT, I_OUT, TABAN, UC = sys.argv[1:5]
SP = '/tmp/claude-0/-home-user/de5e1cbf-7e68-5683-b7bb-f27655eaed4f/scratchpad'
GUN = '2026-11-22'
il = open('docs/2.5.0-IS-LISTESI.md', encoding='utf-8').read().split('\n')
cl = open('CLAUDE.md', encoding='utf-8').read().split('\n')
def blok(b):
    h = [i for i, l in enumerate(il) if l.startswith(b)]; assert len(h) == 1, b
    s = h[0]; e = s + 1
    while e < len(il) and il[e].startswith('  ') and not re.match(r'  (S\d+[ =(]|\(\d+\) )', il[e]): e += 1
    x = ' '.join(x.strip() for x in il[s:e]); k = x.find(' SORULACAK'); return (x[:k] if k >= 0 else x).rstrip()
def cikar(x, parca):
    assert x.count(parca) == 1, parca; return x.replace(parca, '')
ONERI = [l.strip() for l in cl if l.strip().startswith('ÖNERİYİ UYGULA (kullanıcı 14.11 06:31')]; BIRAK = [l.strip() for l in cl if l.strip().startswith("2.5.1'E BIRAK")]
assert len(ONERI) == 1 and len(BIRAK) == 1
s249 = cikar(blok('  S249 ('), " Program bugün A gibi davranıyor; kâhin B'yi önerdi (bakım 24'ün yazılı kapsam yorumuyla tutarlılık) — baş mimar A'yı öneriyor: kapsam yorumu (e) Mevcut Borç kartı için yazılmıştı, KENDİ kartında Düzenle için kullanıcı kararları S235 / S246 'yeni ödeme planı' diyor.")
s251 = cikar(blok('  S251 ('), " (programın bugünkü davranışı, `invoice-locked`; S250'nin iadeli kolunu da kapatır)")
s250 = blok('  S250 (')
g = []; w = g.append
w("# Cari kâhini bakımı 27 — karar girdisi (ana oturum yazdı; TEK girdi kaynağın)")
w("")
w("OKUMA KURALI: kural yalnız SEÇİLEN seçeneğin metni (kendi örneğiyle) ve KAPSAM / BAŞ MİMAR satırlarıdır. Kararın söylemediği alt durumda kural UYDURULMAZ: SUS ve raporun 'KULLANICIYA SORULMALI' listesine yaz (ders 40, 43). Bu girdideki kararlar 'KULLANICI KURALIYLA ÖNERİ UYGULANDI' (kullanıcı değiştirebilir).")
w("Kullanıcının 14.11 06:31 kuralı (AYNEN): " + ONERI[0])
w("Kullanıcının 20.11 09:00 kuralı (AYNEN): " + BIRAK[0])
w("")
w("## 1. Kendi kartında Düzenle ile AZALTMA (S249 = A) — bakım 26'nın SK-48 SUS'u KALKAR")
w("SORU + KARAR S249 (seçilen A — öneri uygulandı): " + s249)
w("KAPSAM (baş mimar): S249 = A, S235 = B ve S246 = B ile AYNI kural ailesidir — faturanın KENDİ taksit kartında Düzenle (artırma da azaltma da) kartı Düzenle'nin ödeme planıyla yeni tutarla yeniden kurar; karta yapılmış ödemeler yeni karta (tek kuyruk) uygulanır, yeni kart tutarını aşan kısım carinin avansıdır. Kollar: (a) ödemeli kart, (b) Borçta Kalsın ile kapanmış tahsilatsız kart (S235 = B: kart AÇIK kurulur), (c) açık tahsilatsız kart. Bakım 24'ün 'azaltılan tutar iade gibi' kapsam yorumu (e) YALNIZ faturayı İÇİNE ALAN Mevcut Borç kartında kalır (S241 = A); kendi kart için GEÇERSİZDİR — KARARLAR.md'ye S249 numarasıyla yazılır. Kararın söylemediği alt durum (ör. Düzenle'de taksit sayısı / ilk vade değişirse ödemelerin dağılımı) varsa SUS + KULLANICIYA SORULMALI.")
w("")
w("## 2. İadesi olan faturanın Düzenle'si (S251 = A) — bakım 26'nın SK-50 SUS'u KALKAR")
w("SORU + KARAR S251 (seçilen A — öneri uygulandı): " + s251)
w("KAPSAM (baş mimar): beklenti = Düzenle isteği REDDEDİLİR (4xx yanıt); belge, kart, cari bakiyesi ve iade DEĞİŞMEZ (ret = 'yapılmadı' — ders 3: yanıt kodu + gövde + sayılar okunur). İade iptal edildikten sonraki Düzenle olağan kurallarla (S241 / S242 / S246 / S249).")
w("")
w("## 3. S250 = C — SUS AYNEN")
w("SORU + KARAR S250 (seçilen C — öneri uygulandı): " + s250)
w("KAPSAM: bakım 26'nın SK-49 susması aynen; neden metnine karar numarası ('BİLİNEN SINIR — kullanıcı kararı S250 = C'). İadeli kolu S251 = A ile kendiliğinden kapanır (ret).")
open(G_OUT, 'w', encoding='utf-8').write('\n'.join(g) + '\n')
p = []; w = p.append
w(f"Sen DestekOfis projesinde CARİ KÂHİNİ BAKIMI 27 ajanısın (2.5.0; KÜÇÜK BAKIM — S249 = A, S251 = A, S250 = C). Programın KODUNU GÖRMEZSİN (`server/`, `client/`, programın `test/*.test.mjs` dosyaları, `docs/erp/` ve `docs/2.5.0-IS-LISTESI*` OKUNMAZ); programı yalnız API'den, kâhinin kendi bağdaştırıcısıyla (`test/bagimsiz/cari/kos.mjs`) dışarıdan kullanırsın. Yanıtın Türkçe. Eforun high. KENDİ dalında commit edersin; PUSH YOK. Her bitmiş adımı HEMEN commit et; koşuları ≤ 40 dk parçalara böl, kanıtı 'Kanıt:' commit'iyle; rapor taslağı `docs/kanit/{GUN}/kahin-cari27-rapor-taslak.md`. Zamanlanmış görev KURMA. Kendi arka plan işin sürerken rapor vermeden BİTİRME (turunu 'bekliyorum' diye kapatma; işi ön planda, süre sınırıyla koş).")
w("")
w("## Hazırlık")
w(f"1. Worktree'de (kendi commit'in YOKKEN) `git reset --hard {TABAN}` (= {UC[:8]}; bakım 26'nın dal ucu). `git log --oneline -2` ile doğrula; değilse DUR. `ln -s /home/user/ofis---y-netimi/node_modules node_modules` (`npm ci` YOK).")
w(f"2. ÖNCE oku: `CLAUDE.md` (dersler; özellikle 5, 6, 7, 16, 40, 43, 44, 52, 54); `docs/BAGIMSIZ-DOGRULAMA-PRENSIBI.md`; kâhinin kendi `test/bagimsiz/cari/KARARLAR.md`'si (güncel kurallar dizini + §38 bakım 26 bölümü — SK-48 / SK-49 / SK-50 ve Y26-5); karar girdisi `/home/user/ofis---y-netimi/docs/devir/2.5.0-DEVAM/kahin-cari27-kararlar.md` (TEK karar kaynağın). Bakım 26'nın araçları `docs/kanit/2026-11-22/kahin-cari26-arac/` (kos.sh, karsilastir.py, elle-*.py, uret-d58.py) — kendi bakımın için kopyala / uyarla (yeni dosyalar `docs/kanit/{GUN}/kahin-cari27-arac/`).")
w("")
w("## İş")
w("1. S249 = A (girdi §1): kendi kartında Düzenle ile azaltmanın üç kolu (a) / (b) / (c) değerle; bakım 26'nın SK-48 susması kalkar; d57 K3 ve d58 T1–T3 (ve benzeri) beklentileri karar metninden ELLE yeniden yazılır (kâhin koşulmadan, üreteçle); fazla tahsilat avans.")
w("2. S251 = A (girdi §2): iadeli faturanın Düzenle'si ret; SK-50'nin iki dünyalı karşılaştırması kalkar, tek beklenti: istek reddedilir, sayılar değişmez.")
w("3. S250 = C (girdi §3): susma aynen, neden metnine karar numarası.")
w("4. Öz test + mutasyon: S249 ve S251 için en az birer mutant (ör. S249'da kartı iade gibi küçült; S251'de Düzenle'yi kabul et) yakalanmalı; kalkan susmaların mutantları (bakım 26'nın 351 / 354'ü) yeni kurala göre güncellenir.")
w(f"5. PROGRAMLA KARŞILAŞTIRMA: `npm run test:kahin-cari` düzeninde iki TZ (UTC, Europe/Istanbul), taban dalındaki programla. Hedef 0 fark + yapım aşaması listesi BOŞ. Fark çıkarsa: en küçük örnek + hangisinin girdiye uymadığı — kâhin programa UYDURULMAZ (ders 40); program şüphesi 'P' diye raporlanır. Yapım listesi KENDİ kopyanda `--yapim-asamasi-yaz` (KAHIN_YAPIM_ASAMASI ile not defterine); depodaki liste ancak kendi dalında, ayrı commit'le, öncesi / sonrası farkıyla.")
w("6. G3 (eski kâhin = bakım 26 ↔ yeni) + ESKİ KÂHİN KIRMIZISI: değişen her denetimin nedeni S249 / S251 / S250; beklenmeyen değişiklik 0; yeni / değişen kural bakım 26 kâhininde farklı sonuç vermeli (sayıyla).")
w("")
w("## Kurallar")
w(f"- YAZABİLECEĞİN: yalnız `test/bagimsiz/cari/**` ve `docs/kanit/{GUN}/kahin-cari27-*`. Program kodu, öbür kâhinler, sürücü YASAK.")
w(f"- Koşular `HUKUK_LICENSE_URL=http://127.0.0.1:9 KANIT_DIR=<not defterin> node tools/kanit.mjs kos kahin-cari27-<ad> -- <komut>`; ölçüm DIŞI HER koşu — TEK python satırı, öz test, elle karşılaştırma DAHİL — `flock -s -w 3600 {SP}/olcum.lock timeout -k 5 <sn> <komut>` (süre sınırı flock'un İÇİNDE; ana oturumun özel kilitli ölçümü sürerken koşun bekler — bekle, kilitsiz koşma; bakım 26 bu kuralı bir kez çiğnedi). Not defterin BENZERSİZ: `{SP}/kc27-<ajan kimliğinin ilk 3 hanesi>/`. Arka plan koşusu en çok 2 saat. Önce `cat /proc/loadavg`, 4'ün üstündeyse tek seferlik bekle. GIT_DIR / GIT_WORK_TREE VERME. `pkill` / joker `rm` YOK. Tam `npm test` YOK. Disk 5 GB'ın altına düşmez. Commit'e yalnız kendi yolların (`git add <yol>`; `-A` / `-u` / `commit -a` YOK).")
w("- 2.5.1'E BIRAK (kullanıcı kuralı girdide AYNEN): kâhinin iç bakımı / test düzeni / belge türü husus KOVALANMAZ; raporun 'SONRAKİ SÜRÜME (2.5.1)' başlığına.")
w("- Commit iletisi sonunda tam olarak (model adı YOK):")
w("  Co-Authored-By: Claude <noreply@anthropic.com>")
w("  Claude-Session: https://claude.ai/code/session_01EhegDvmPQ9hx2ibfitm6og")
w("")
w("## Rapor (SubagentHandback, Türkçe; kısa cümle, madde, tablo)")
w("Özet; her değişen / kalkan susmanın kuralı (girdinin hangi satırından); öz test + mutasyon; G3; program ↔ kâhin iki TZ; yapım aşaması listesi (önce / sonra + nedenleri); eski kâhin kırmızısı; P listesi en küçük örnekle; KULLANICIYA SORULMALI (iki seçenek + öneri, sayılarla; uç durumsa 'Uç durum böyle kalsın (BİLİNEN SINIR)'; 'yaygın programlarda' satırı — doğrulanmış kaynak okunmadıysa 'okunmadı'); SONRAKİ SÜRÜME (2.5.1); DENENMEYEN; değişen yollar; commit listesi; dal ucu; ana oturumun yeniden koşacağı komutlar.")
open(I_OUT, 'w', encoding='utf-8').write('\n'.join(p) + '\n'); print('yazıldı', G_OUT, I_OUT)
