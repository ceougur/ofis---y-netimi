# ANA OTURUM — CARİ KÂHİNİ BAKIMI 28 (KÜÇÜK: S255 = A kartın içine aldığı faturaya BAĞLI ödemenin kapama sırası; S254 = C susma): karar girdisi + görev metni üreteci. kahin-cari27-uret.py'den türetildi.
# Ders 5: girdiye programın davranışı / ürettiği değer GİRMEZ — S255'ten 'BUGÜN:' cümlesi, C seçeneği ve başlıktaki yeniden üretim notu ÇIKARILIR; S254'ten 'bugünkü gibi' seçeneği (A — program davranışı) ÇIKARILIR; 'SORULDU (…)' kuyruğu kesilir.
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
    x = ' '.join(x.strip() for x in il[s:e]); k = x.find(' SORULDU ('); return (x[:k] if k >= 0 else x).rstrip()
def cikar(x, parca):
    assert x.count(parca) == 1, parca; return x.replace(parca, '')
ONERI = [l.strip() for l in cl if l.strip().startswith('ÖNERİYİ UYGULA (kullanıcı 14.11 06:31')]; BIRAK = [l.strip() for l in cl if l.strip().startswith("2.5.1'E BIRAK")]
assert len(ONERI) == 1 and len(BIRAK) == 1
def kes_arasi(x, bas, son):
    i = x.find(bas); j = x.find(son, i); assert i >= 0 and j > i, (bas, son); return x[:i] + x[j:]
s255 = blok('  S255 (')
s255 = cikar(s255, " ana oturum iki TZ'de BİREBİR yeniden üretti (scratchpad/ana-dktek);")
s255 = cikar(s255, " — rapor dk-tek-rapor.md;")
s255 = kes_arasi(s255, " BUGÜN:", " A (ÖNERİ):")
s255 = kes_arasi(s255, " C: bugünkü kalsın", " Yaygın programlarda")
assert 'BUGÜN' not in s255 and 'bugünkü kalsın' not in s255 and 'rapor' not in s255.lower()[:200]
s254 = blok('  S254 (')
s254 = cikar(s254, " — rapor docs/devir/2.5.0-DEVAM/dk-tek-rapor.md;")
s254 = kes_arasi(s254, " A: bugünkü gibi", " B: ")
s230 = blok('  S230 (')
s230 = s230[:s230.find(' BAŞ MİMAR YORUMU')] if ' BAŞ MİMAR YORUMU' in s230 else s230
g = []; w = g.append
w("# Cari kâhini bakımı 28 — karar girdisi (ana oturum yazdı; TEK girdi kaynağın)")
w("")
w("OKUMA KURALI: kural yalnız SEÇİLEN seçeneğin metni (kendi örneğiyle) ve KAPSAM / BAŞ MİMAR satırlarıdır. Kararın söylemediği alt durumda kural UYDURULMAZ: SUS ve raporun 'KULLANICIYA SORULMALI' listesine yaz (ders 40, 43). Bu girdideki kararlar 'KULLANICI KURALIYLA ÖNERİ UYGULANDI' (kullanıcı değiştirebilir).")
w("Kullanıcının 14.11 06:31 kuralı (AYNEN): " + ONERI[0])
w("Kullanıcının 20.11 09:00 kuralı (AYNEN): " + BIRAK[0])
w("")
w("## 1. Kartın içine aldığı faturaya BAĞLI ödeme (S255 = A)")
w("SORU + KARAR S255 (seçilen A — öneri uygulandı): " + s255)
w("İLGİLİ ÖNCEKİ KARAR S230 (seçilen A — kullanıcı): " + s230)
w("KAPSAM (baş mimar): kâhinin C6 S1 kuralı ('bağlı ödemeler yalnız kendi kalemini kapatır, fazlası havuza') bir faturanın bir kısmını ya da tamamını Mevcut Borç kartı İÇİNE ALMIŞSA şöyle okunur: faturanın 'kendi kalemi' = GÖSTERİLEN açığı (kartın / kartların almadığı kısım; S230 = A); fazlası havuza (tek kuyruk — kartın taksitleri dahil, S230 = A'nın 'carinin vadesi en önce gelen açık borcuna' sözü). Faturanın tamamı kartta ise bağlı ödemenin TAMAMI havuza. Beklenen: kart Tahsil / Kalan / gecikmiş, carinin bakiyesi ve avansı, faturanın gösterilen açığı ve durumu, Açık Faturalar — S255 A örneğinin sayıları (bağlı 600 / 900 / 1.200) ve bağsız 900 karşılaştırması. Bağlı ödeme türleri: Kapatılacak Fatura'lı cari tahsilatı ve faturanın Tahsilat Ekle'si; çek / senet ve Mahsup Et bu girdide AÇIKÇA geçmiyor → SUS + KULLANICIYA SORULMALI (yalnız kâhinin bağdaştırıcısının desteklediği yollar). Bu kural için taksit kartlı caride 'Kalan tanımsız (denetlenmez)' istisnası bu senaryolarda KALKAR (kart ve fatura sayıları denetlenir). KARARLAR.md'ye S255 numarasıyla.")
w("")
w("## 2. Aynı caride iki Mevcut Borç kartı + faturasız stok iadesi (S254 = C) — SUS")
w("SORU + KARAR S254 (seçilen C — öneri uygulandı): " + s254)
w("KAPSAM: hangi kartın küçüleceği denetlenmez; neden metnine karar numarası ('BİLİNEN SINIR — kullanıcı kararı S254 = C'); bakiye denetlenir.")
open(G_OUT, 'w', encoding='utf-8').write('\n'.join(g) + '\n')
p = []; w = p.append
w(f"Sen DestekOfis projesinde CARİ KÂHİNİ BAKIMI 28 ajanısın (2.5.0; KÜÇÜK BAKIM — S255 = A, S254 = C). Programın KODUNU GÖRMEZSİN (`server/`, `client/`, programın `test/*.test.mjs` dosyaları, `docs/erp/`, `docs/2.5.0-IS-LISTESI*` ve `docs/devir/2.5.0-DEVAM/` altındaki *-rapor.md / *-istem.txt (bu görevin karar girdisi HARİÇ) OKUNMAZ); programı yalnız API'den, kâhinin kendi bağdaştırıcısıyla (`test/bagimsiz/cari/kos.mjs`) dışarıdan kullanırsın. Yanıtın Türkçe. Eforun high. KENDİ dalında commit edersin; PUSH YOK. Her bitmiş adımı HEMEN commit et; koşuları ≤ 40 dk parçalara böl, kanıtı 'Kanıt:' commit'iyle; rapor taslağı `docs/kanit/{GUN}/kahin-cari28-rapor-taslak.md`. Zamanlanmış görev KURMA. Kendi arka plan işin sürerken rapor vermeden BİTİRME (turunu 'bekliyorum' diye kapatma; işi ön planda, süre sınırıyla koş).")
w("")
w("## Hazırlık")
w(f"1. Worktree'de (kendi commit'in YOKKEN) `git reset --hard {TABAN}` (= {UC[:8]}; çalışma dalı — bakım 27 dahil). `git log --oneline -2` ile doğrula; değilse DUR. `ln -s /home/user/ofis---y-netimi/node_modules node_modules` (`npm ci` YOK).")
w(f"2. ÖNCE oku: `CLAUDE.md` (dersler; özellikle 5, 6, 7, 16, 40, 43, 44, 52, 54); `docs/BAGIMSIZ-DOGRULAMA-PRENSIBI.md`; kâhinin kendi `test/bagimsiz/cari/KARARLAR.md`'si (güncel kurallar dizini + C6 S1 + son bakım bölümleri §38–§39); karar girdisi `/home/user/ofis---y-netimi/docs/devir/2.5.0-DEVAM/kahin-cari28-kararlar.md` (TEK karar kaynağın). Bakım 27'nin araçları `docs/kanit/2026-11-22/kahin-cari28-arac/` (kos.sh, karsilastir.py, elle-*.py) — kendi bakımın için kopyala / uyarla (yeni dosyalar `docs/kanit/{GUN}/kahin-cari28-arac/`).")
w("")
w("## İş")
w("1. S255 = A (girdi §1): kartın içine aldığı faturaya BAĞLI ödemenin kapama sırası — yeni senaryo(lar) (ör. d60): F 900 + elle Mevcut Borç kartı 600 (F'nin 600'ü), 20.10'da bağlı 300 / 600 / 900 / 1.200 ve bağsız 900; faturanın tamamı kartta; iade / iade iptalinden sonra bağlı ödeme; ödemenin silinip geri yüklenmesi. Beklentiler karar metninden ELLE (kâhin koşulmadan, üreteçle). C6 S1'in bu okuması KARARLAR.md'ye.")
w("2. S254 = C (girdi §2): iki kart + faturasız stok iadesi — hangi kartın küçüleceği SUS (bilinen sınır, karar numarasıyla), bakiye denetlenir.")
w("3. Öz test + mutasyon: S255 için en az iki mutant (ör. bağlı ödeme faturanın tamamını kapatsın — fazlası karta gitmesin; fazlası kartın EN SON taksitine gitsin) yakalanmalı.")
w(f"4. PROGRAMLA KARŞILAŞTIRMA: `npm run test:kahin-cari` düzeninde iki TZ (UTC, Europe/Istanbul), taban dalındaki programla. Bu kural programda HENÜZ YOK (ayrı bir kod turu yapıyor): yeni senaryolardaki farklar BEKLENİR — her farkı en küçük örnekle 'P' (program şüphesi) diye raporla; ESKİ senaryolarda fark 0 olmalı. Kâhin programa UYDURULMAZ (ders 40). Yapım listesi KENDİ kopyanda `--yapim-asamasi-yaz` (KAHIN_YAPIM_ASAMASI ile not defterine); yeni senaryoların kayıtları paket 'S255 izleyen tur 4' diye — depodaki listeyi kendi dalında AYRI commit'le güncelle (öncesi / sonrası farkıyla).")
w("5. G3 (eski kâhin = taban ↔ yeni) + ESKİ KÂHİN KIRMIZISI: değişen her denetimin nedeni S255 / S254; beklenmeyen değişiklik 0.")
w("")
w("## Kurallar")
w(f"- YAZABİLECEĞİN: yalnız `test/bagimsiz/cari/**` ve `docs/kanit/{GUN}/kahin-cari28-*`. Program kodu, öbür kâhinler, sürücü YASAK.")
w(f"- Koşular `HUKUK_LICENSE_URL=http://127.0.0.1:9 KANIT_DIR=<not defterin> node tools/kanit.mjs kos kahin-cari28-<ad> -- <komut>`; ölçüm DIŞI HER koşu — TEK python satırı, öz test, elle karşılaştırma DAHİL — `flock -s -w 3600 {SP}/olcum.lock timeout -k 5 <sn> <komut>` (süre sınırı flock'un İÇİNDE; ana oturumun özel kilitli ölçümü sürerken koşun bekler — bekle, kilitsiz koşma; bakım 26 ve 27 bu kuralı kısa koşularda çiğnedi — YAPMA). Not defterin BENZERSİZ: `{SP}/kc28-<ajan kimliğinin ilk 3 hanesi>/`. Arka plan koşusu en çok 2 saat. Önce `cat /proc/loadavg`, 4'ün üstündeyse tek seferlik bekle. GIT_DIR / GIT_WORK_TREE VERME. `pkill` / joker `rm` YOK. Tam `npm test` YOK. Disk 5 GB'ın altına düşmez. Commit'e yalnız kendi yolların (`git add <yol>`; `-A` / `-u` / `commit -a` YOK).")
w("- 2.5.1'E BIRAK (kullanıcı kuralı girdide AYNEN): kâhinin iç bakımı / test düzeni / belge türü husus KOVALANMAZ; raporun 'SONRAKİ SÜRÜME (2.5.1)' başlığına.")
w("- Commit iletisi sonunda tam olarak (model adı YOK):")
w("  Co-Authored-By: Claude <noreply@anthropic.com>")
w("  Claude-Session: https://claude.ai/code/session_01EhegDvmPQ9hx2ibfitm6og")
w("")
w("## Rapor (SubagentHandback, Türkçe; kısa cümle, madde, tablo)")
w("Özet; her değişen / kalkan susmanın kuralı (girdinin hangi satırından); öz test + mutasyon; G3; program ↔ kâhin iki TZ; yapım aşaması listesi (önce / sonra + nedenleri); eski kâhin kırmızısı; P listesi en küçük örnekle; KULLANICIYA SORULMALI (iki seçenek + öneri, sayılarla; uç durumsa 'Uç durum böyle kalsın (BİLİNEN SINIR)'; 'yaygın programlarda' satırı — doğrulanmış kaynak okunmadıysa 'okunmadı'); SONRAKİ SÜRÜME (2.5.1); DENENMEYEN; değişen yollar; commit listesi; dal ucu; ana oturumun yeniden koşacağı komutlar.")
open(I_OUT, 'w', encoding='utf-8').write('\n'.join(p) + '\n'); print('yazıldı', G_OUT, I_OUT)
