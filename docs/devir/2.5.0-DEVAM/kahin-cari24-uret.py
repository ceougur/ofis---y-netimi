# ANA OTURUM — CARİ KÂHİNİ BAKIMI 24 (S234 + S237 paketi): karar girdisi + görev metni üreteci. Kararlar iş listesi C'den AYNEN; KAPSAM satırları baş mimarın.
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
w("# Cari kâhini bakımı 24 — karar girdisi (ana oturum yazdı; TEK girdi kaynağın)")
w("")
w("OKUMA KURALI: soru metinlerinde geçen 'program bugün', 'kod', 'tur', 'test' sözleri ve program gözlemleri KURAL KAYNAĞI DEĞİLDİR — kural yalnız KARAR satırları (seçilen seçeneğin metni ve kararın kendi örneği) ve KAPSAM satırlarıdır. Kararın söylemediği alt durumda kural UYDURULMAZ: SUS ve raporun 'KULLANICIYA SORULMALI' listesine yaz (ders 40, 43). Etiketler: 'KULLANICI KARARI', 'KULLANICI KURALIYLA ÖNERİ UYGULANDI', 'BAŞ MİMAR KARARI / YORUMU'.")
w("Kullanıcının 14.11 06:31 kuralı (AYNEN): " + ONERI[0])
w("Kullanıcının 20.11 09:00 kuralı (AYNEN): " + BIRAK[0])
w("")
w("## 1. Borçta Kalsın ile KAPATILMIŞ Mevcut Borç kartının içine aldığı faturanın iadesi / azaltılması (S234 = A, S237 = A)")
w("SORU + KARAR S234 (AYNEN): " + blok('  S234 ('))
w("SORU + KARAR S237 (AYNEN; S234'ün alt durumu): " + blok('  S237 ('))
w("SORU + KARAR S205 (AYNEN; Borçta Kalsın kalanının gecikmişi): " + blok('  S205 ('))
w("KAPSAM (baş mimar; kullanıcıya gösterildi): (a) karar (4) (kartın içine aldığı borç iade ile — borçtan düşülünce — azalırsa kart küçülür) Borçta Kalsın ile kapatılmış karta da uygulanır: kart vadesi EN ÖNCE gelen açık taksitten küçülür; kartın Kalan'ı, Kartı Kapat / Yeniden Aç sonrasındaki onay tutarı küçülmüş kalanla; cari bakiyesi ve ertesi günden gecikmiş bugünkü kuralla (S205). (b) Kendi kartı olan (taksitli) faturada da aynı ilke. (c) İade iptal edilince kart aynı tutarda geri büyür (küçülmenin tersi). (d) Faturanın kendisinin İPTALİ (iade değil) kapalı kartı küçültmez — bugünkü kural (S226 = C) aynen. (e) S234'ün 'faturanın Düzenle ile azaltılması' kısmı da aynı ilkeyle (azaltılan tutar iade gibi). (f) Aynı caride iki Mevcut Borç kartı varsa her kart kendi aldığı borçla; gecikmiş, kartın kapsadığı fatura için ayrıca sayılmaz. Kararın söylemediği alt durumda SUS ve KULLANICIYA SORULMALI'ya yaz.")
w("")
w("## 2. API SÖZLEŞMESİ (alan anlamları; beklenen değer DEĞİL — bağdaştırıcının okuması için)")
w("Önceki bakımın sözleşmesi aynen (fatura `open` = gösterilen açık, `ownOpen` = kendi açık, `inPlan` = kartın aldığı). YENİ: kart kapalıyken (`status` 'closed') de kartın `remaining` / Kalan alanı kartın güncel kalanını taşır; fatura ayrıntısında `ownPayState` = faturanın KENDİ kapama durumu (yalnız `inPlan` varken).")
open(G_OUT, 'w', encoding='utf-8').write('\n'.join(g) + '\n')
p = []; w = p.append
w(f"Sen DestekOfis projesinde CARİ KÂHİNİ BAKIMI 24 ajanısın (2.5.0; S234 + S237 paketi). Programın KODUNU GÖRMEZSİN (`server/`, `client/`, programın `test/*.test.mjs` dosyaları OKUNMAZ); programı yalnız API'den, kâhinin kendi bağdaştırıcısıyla (`test/bagimsiz/cari/kos.mjs`) dışarıdan kullanırsın. Yanıtın Türkçe. Eforun high. KENDİ dalında commit edersin; PUSH YOK. Her bitmiş adımı HEMEN commit et; koşuları ≤ 40 dk parçalara böl, kanıtı 'Kanıt:' commit'iyle; rapor taslağı `docs/kanit/2026-11-21/kahin-cari24-rapor-taslak.md`. Zamanlanmış görev KURMA. Kendi arka plan işin sürerken rapor vermeden BİTİRME.")
w("")
w("## Hazırlık")
w(f"1. Worktree'de (kendi commit'in YOKKEN) `git reset --hard {TABAN}` (= {UC[:8]}). `git log --oneline -2` ile doğrula; değilse DUR. `ln -s /home/user/ofis---y-netimi/node_modules node_modules` (`npm ci` YOK).")
w(f"2. ÖNCE oku: `CLAUDE.md` (dersler; özellikle 5, 6, 7, 16, 31, 40, 43, 44, 54); `docs/BAGIMSIZ-DOGRULAMA-PRENSIBI.md`; kâhinin kendi `test/bagimsiz/cari/KARARLAR.md`'si (güncel kurallar dizini + kendi bakım bölümün); karar girdisi `/home/user/ofis---y-netimi/docs/devir/2.5.0-DEVAM/kahin-cari24-kararlar.md` (TEK karar kaynağın; iş listesinin hiçbir sürümü ve yapım aşaması listesinin içeriği kural kaynağı DEĞİL).")
w("")
w("## İş")
w("1. YENİ KURAL (girdi §1): kapalı (Borçta Kalsın) Mevcut Borç kartının içine aldığı faturanın iadesi / iade iptali / Düzenle ile azaltılması — kâhinin modelinde (ayrı dilde, Python) kart küçülmesi, Kalan, onay tutarı, gecikmiş (kapanış günü ve sonrası — S237 = A), kendi kartlı fatura, iki kart. Senaryolar en az: kapalı kart + iade; kapanıştan önce vadesi geçmiş taksitli kapalı kart + aynı gün iade (S237'nin örneği); iade iptali; Düzenle ile azaltma; kendi kartlı faturada iade; aynı caride iki kart, ilk faturaya iade; açık kartta aynı senaryolar (karar (4) bugünkü). Kâhinin dili bir parçayı taşımıyorsa SUS (girdi okuma kuralı).")
w("2. Kâhinin öz testi + mutasyon (kendi araçları): yeni kuralın dişi — en az üç mutant (kapalı kartı küçültme; küçülmeyi son taksitten yap; iade iptalinde büyütme) yakalanmalı.")
w(f"3. PROGRAMLA KARŞILAŞTIRMA (taban dalındaki program): `npm run test:kahin-cari` iki TZ (UTC, Europe/Istanbul), `flock -s -w 3600 {SP}/olcum.lock -c 'timeout -k 5 <sn> <komut>'` altında. Fark çıkarsa: en küçük örnek + hangisinin girdiye uymadığı (kâhin mi program mı) — kâhin programa UYDURULMAZ (ders 40); program şüphesi 'P' diye raporlanır; programın henüz yapmadığı bilinen kısım (girdi §1 (e) Düzenle ile azaltma; §1 (f) iki kart) fark verirse yapım aşaması listesine KAYIT olarak girer (ayrıştırılmış, gerekçeli). Yapım aşaması listesi kendi kopyanda yeniden üretilir (`KAHIN_YAPIM_ASAMASI=<kendi kopyan> node test/bagimsiz/cari/kos.mjs --yapim-asamasi-yaz`) ve depodaki `test/bagimsiz/cari/YAPIM-ASAMASI.json` aynı commit'te güncellenir; ESKİ listeyle farkı (yeni / kapanan / değişen) raporda.")
w("4. ESKİ KÂHİN KIRMIZISI: yeni kural, bakım öncesi kâhinle aynı programda farklı sonuç vermeli; sayıyla göster.")
w("")
w("## Kurallar")
w("- YAZABİLECEĞİN: yalnız `test/bagimsiz/cari/**` ve `docs/kanit/2026-11-21/kahin-cari24-*`. Program kodu, öbür kâhinler, sürücü YASAK.")
w(f"- Koşular `HUKUK_LICENSE_URL=http://127.0.0.1:9 KANIT_DIR=<not defterin> node tools/kanit.mjs kos kahin-cari24-<ad> -- <komut>`; BÜTÜN koşular `flock -s -w 3600 {SP}/olcum.lock` altında; her arka plan koşusu `timeout -k 5 <sn>` (en çok 2 saat); önce `cat /proc/loadavg`, 4'ün üstündeyse tek seferlik bekle. GIT_DIR / GIT_WORK_TREE VERME. `pkill` / joker `rm` YOK. Tam `npm test` YOK. Disk 5 GB'ın altına düşmez. Commit'e yalnız kendi yolların (`git add <yol>`).")
w("- Commit iletisi sonunda tam olarak (model adı YOK):")
w("  Co-Authored-By: Claude <noreply@anthropic.com>")
w("  Claude-Session: https://claude.ai/code/session_01EhegDvmPQ9hx2ibfitm6og")
w("")
w("## Rapor (SubagentHandback, Türkçe)")
w("Yapılan eşleme; yeni denetimin kuralı (girdinin hangi satırından); öz test + mutasyon sayıları; program ↔ kâhin iki TZ (taban ve son); yapım aşaması listesi (önce / sonra); eski kâhin kırmızısı; KULLANICIYA SORULMALI; SONRAKİ SÜRÜME (2.5.1); DENENMEYEN; değişen yollar; commit listesi; dal ucu; ana oturumun yeniden koşacağı komutlar.")
open(I_OUT, 'w', encoding='utf-8').write('\n'.join(p) + '\n'); print('yazıldı', G_OUT, I_OUT)
