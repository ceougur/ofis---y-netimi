# ANA OTURUM — CARİ KÂHİNİ BAKIMI 23 (S229 + S230 paketi): karar girdisi + görev metni üreteci. Kararlar iş listesi C'den AYNEN; KAPSAM satırları baş mimarın.
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
w("# Cari kâhini bakımı 23 — karar girdisi (ana oturum yazdı; TEK girdi kaynağın)")
w("")
w("OKUMA KURALI: soru metinlerinde geçen 'program bugün', 'kod', 'tur', 'test' sözleri ve program gözlemleri KURAL KAYNAĞI DEĞİLDİR — kural yalnız KARAR satırları (seçilen seçeneğin metni ve kararın kendi örneği) ve KAPSAM satırlarıdır. Kararın söylemediği alt durumda kural UYDURULMAZ: SUS ve raporun 'KULLANICIYA SORULMALI' listesine yaz (ders 40, 43). Etiketler: 'KULLANICI KARARI', 'KULLANICI KURALIYLA ÖNERİ UYGULANDI', 'BAŞ MİMAR KARARI / YORUMU'.")
w("Kullanıcının 14.11 06:31 kuralı (AYNEN): " + ONERI[0])
w("Kullanıcının 20.11 09:00 kuralı (AYNEN): " + BIRAK[0])
w("")
w("## 1. Mevcut Borç (taksit) kartının içine aldığı faturanın açığı — gösterim (S229 = A, S230 = A)")
w("SORU + KARAR S229 (AYNEN): " + blok('  S229 ('))
w("SORU + KARAR S230 (AYNEN): " + blok('  S230 ('))
w("SORU + KARAR S200 (AYNEN; kartın faturadan aldığı kısmın sırası): " + blok('  S200 ('))
w("KAPSAM (baş mimar): (a) kâhinin bugünkü 'faturanın açığı' beklentisi (faturanın KENDİ açığı — kapama kuralıyla) DEĞİŞMEZ; kapama kuralı bu kararlarla değişmedi. (b) YENİ beklenti: fatura kartında / fatura listesinde GÖSTERİLEN açık = faturanın kendi açığı − Mevcut Borç kart(lar)ının o faturadan aldığı kısım (S200 sırası); kart faturanın tamamını aldıysa gösterilen açık 0 ve durum 'Taksitte'. Açık fatura toplamının cari bakiyesiyle ilişkisi (kendi açıklar) bugünkü gibi; gösterilen açıkların toplamı + kartların aldığı = kendi açıkların toplamı. (c) Kâhinin dili kartın aldığı kısmı modellemiyorsa (b)'yi kurma — SUS ve raporda yaz.")
w("")
w("## 2. API SÖZLEŞMESİ (alan anlamları; beklenen değer DEĞİL — bağdaştırıcının okuması için)")
w("Fatura ayrıntısı ve fatura listesi yanıtında: `open` = GÖSTERİLEN açık (S229 / S230 = A; kartın aldığı kısım düşülmüş); `ownOpen` = faturanın KENDİ açığı (kapama kuralıyla; eskiden `open`'ın taşıdığı anlam); `inPlan` = kart(lar)ın faturadan aldığı kısım; kartın tamamını aldığı faturanın ödeme durumu `installment` ('Taksitte'). Eski program sürümlerinde `ownOpen` alanı YOKTUR — orada `open` kendi açıktır.")
open(G_OUT, 'w', encoding='utf-8').write('\n'.join(g) + '\n')
p = []; w = p.append
w(f"Sen DestekOfis projesinde CARİ KÂHİNİ BAKIMI 23 ajanısın (2.5.0; S229 + S230 paketi). Programın KODUNU GÖRMEZSİN (`server/`, `client/`, programın `test/*.test.mjs` dosyaları OKUNMAZ); programı yalnız API'den, kâhinin kendi bağdaştırıcısıyla (`test/bagimsiz/cari/kos.mjs`) dışarıdan kullanırsın. Yanıtın Türkçe. Eforun high. KENDİ dalında commit edersin; PUSH YOK. Her bitmiş adımı HEMEN commit et; koşuları ≤ 40 dk parçalara böl, kanıtı 'Kanıt:' commit'iyle; rapor taslağı `docs/kanit/2026-11-21/kahin-cari23-rapor-taslak.md`. Zamanlanmış görev KURMA. Kendi arka plan işin sürerken rapor vermeden BİTİRME.")
w("")
w("## Hazırlık")
w(f"1. Worktree'de (kendi commit'in YOKKEN) `git reset --hard {TABAN}` (= {UC[:8]}). `git log --oneline -2` ile doğrula; değilse DUR. `ln -s /home/user/ofis---y-netimi/node_modules node_modules` (`npm ci` YOK).")
w(f"2. ÖNCE oku: `CLAUDE.md` (dersler; özellikle 5, 6, 7, 16, 31, 40, 43, 44, 54); `docs/BAGIMSIZ-DOGRULAMA-PRENSIBI.md`; kâhinin kendi `test/bagimsiz/cari/KARARLAR.md`'si (güncel kurallar dizini + kendi bakım bölümün); karar girdisi `{SP}/kahin-cari23-kararlar.md` (TEK karar kaynağın; iş listesinin hiçbir sürümü ve yapım aşaması listesinin içeriği kural kaynağı DEĞİL).")
w("")
w("## İş")
w("1. BAĞDAŞTIRICI EŞLEMESİ (girdi §2): kâhinin 'faturanın açığı' okuması (fatura kartı / listesi) faturanın KENDİ açığını okur — `ownOpen`, yoksa `open` (eski sürüm). Beklenti DEĞİŞMEZ (girdi §1 (a)).")
w("2. YENİ DENETİM (girdi §1 (b)): gösterilen açık ve 'Taksitte' durumu — kâhinin modelinden (ayrı dilde, Python) beklenen; yeni anahtar adı kendi düzeninde; en az: kısmi alınan fatura, tamamı alınan fatura, iki kart, elle borç + fatura (S200 sırası), kartı olmayan fatura (gösterilen = kendi). Kâhinin dili kartın aldığı kısmı taşımıyorsa SUS (girdi §1 (c)).")
w("3. Kâhinin öz testi + mutasyon (kendi araçları): yeni denetimin dişi — en az iki mutant (kart payını düşmeyi unut; tam alınanı açık say) yakalanmalı.")
w(f"4. PROGRAMLA KARŞILAŞTIRMA (taban dalındaki program): `npm run test:kahin-cari` iki TZ (UTC, Europe/Istanbul), `flock -s -w 3600 {SP}/olcum.lock` altında — HEDEF: fark 0. Yapım aşaması listesi kendi kopyanda yeniden üretilir (`KAHIN_YAPIM_ASAMASI=<kendi kopyan> node test/bagimsiz/cari/kos.mjs --yapim-asamasi-yaz`) ve depodaki `test/bagimsiz/cari/YAPIM-ASAMASI.json` aynı commit'te güncellenir — BOŞ olmalı. Fark kalırsa: en küçük örnek + hangisinin girdiye uymadığı (kâhin mi program mı) — kâhin programa UYDURULMAZ (ders 40); program şüphesi 'P' diye raporlanır.")
w("5. ESKİ KÂHİN KIRMIZISI: yeni denetim, bakım öncesi kâhinle aynı programda farklı sonuç vermeli (eski bağdaştırıcı `open`'ı kendi açık sanıyordu → 46 fark); sayıyla göster.")
w("")
w("## Kurallar")
w("- YAZABİLECEĞİN: yalnız `test/bagimsiz/cari/**` ve `docs/kanit/2026-11-21/kahin-cari23-*`. Program kodu, öbür kâhinler, sürücü YASAK.")
w(f"- Koşular `HUKUK_LICENSE_URL=http://127.0.0.1:9 KANIT_DIR=<not defterin> node tools/kanit.mjs kos kahin-cari23-<ad> -- <komut>`; BÜTÜN koşular `flock -s -w 3600 {SP}/olcum.lock` altında; her arka plan koşusu `timeout -k 5 <sn>` (en çok 2 saat); önce `cat /proc/loadavg`, 4'ün üstündeyse tek seferlik bekle. GIT_DIR / GIT_WORK_TREE VERME. `pkill` / joker `rm` YOK. Tam `npm test` YOK. Disk 5 GB'ın altına düşmez. Commit'e yalnız kendi yolların (`git add <yol>`).")
w("- Commit iletisi sonunda tam olarak (model adı YOK):")
w("  Co-Authored-By: Claude <noreply@anthropic.com>")
w("  Claude-Session: https://claude.ai/code/session_01EhegDvmPQ9hx2ibfitm6og")
w("")
w("## Rapor (SubagentHandback, Türkçe)")
w("Yapılan eşleme; yeni denetimin kuralı (girdinin hangi satırından); öz test + mutasyon sayıları; program ↔ kâhin iki TZ (taban ve son); yapım aşaması listesi (önce / sonra); eski kâhin kırmızısı; KULLANICIYA SORULMALI; SONRAKİ SÜRÜME (2.5.1); DENENMEYEN; değişen yollar; commit listesi; dal ucu; ana oturumun yeniden koşacağı komutlar.")
open(I_OUT, 'w', encoding='utf-8').write('\n'.join(p) + '\n'); print('yazıldı', G_OUT, I_OUT)
