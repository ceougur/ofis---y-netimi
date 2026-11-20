# ANA OTURUM — S229 + S230 KÜÇÜK PROGRAM TURU görev metni üreteci (KISA, TEK İŞ: Mevcut Borç kartının içine aldığı faturanın açığının gösterimi).
# Kararlar iş listesinden ve CLAUDE.md'den AYNEN (C soruları devam satırlarıyla; D kayıtları başlığıyla).
# Çağrı: cd <depo>; python3 -I <bu> <çıktı> <taban dalı> <taban ucu> <gün YYYY-AA-GG> <eski kod dalı>
import sys, re
OUT, TABAN, UC, GUN, ESKI = sys.argv[1], sys.argv[2], sys.argv[3], sys.argv[4], sys.argv[5]
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


def karar(basla, icerir=''):
    h = [x for x in D.split('\n- ') if x.startswith(basla) and icerir in x[:200]]; assert len(h) == 1, (basla, len(h)); return '- ' + h[0].strip()


def madde(icerir, devam):
    # CLAUDE.md'den bir maddeyi devam satırlarıyla AYNEN alır; devam = devam satırının girinti deseni.
    h = [i for i, l in enumerate(cl) if icerir in l]; assert len(h) == 1, (icerir, len(h))
    s = h[0]; e = s + 1
    while e < len(cl) and re.match(devam, cl[e]) and not re.match(r'\s*(\d+\.|-) ', cl[e]): e += 1
    return ' '.join(x.strip() for x in cl[s:e])


S229 = blok('  S229 (')
S230 = blok('  S230 (')
S200 = blok('  S200 (')
S213 = blok('  S213 (')
S210 = blok('  S210 (')
S118 = blok('  S118 (') if any(l.startswith('  S118 (') for l in il) else ''
BM1947 = karar('BAŞ MİMAR KARARI 20.11 19:47 UTC')
SIKAYET1 = madde('1. "Onca test yaptım deyip', r'   +\S')
RAPOR = madde('Raporlar: her raporda alt TOPLAM', r'  +\S')
BIRAK = [l.strip() for l in cl if l.strip().startswith("2.5.1'E BIRAK")]; assert len(BIRAK) == 1
ONERI = [l.strip() for l in cl if l.strip().startswith('ÖNERİYİ UYGULA (kullanıcı 14.11 06:31')]; assert len(ONERI) == 1
assert 'TOPLAM' in RAPOR and 'mantık hatalarını' in SIKAYET1 and 'R-S200' in S229 and 'Taksitte' in S230

o = []; w = o.append
w("Sen DestekOfis projesinde S229 + S230 KÜÇÜK PROGRAM TURU KOD ajanısın (2.5.0 — 'Carinin Mevcut Borcu' (taksit) kartının içine aldığı faturanın AÇIĞININ GÖSTERİMİ: Açık Faturalar raporu, Anlık Durum'un fatura özeti, fatura kartı, Faturalar listesi; para formlarının ÖNERDİĞİ tutara dokunur → PARA ÇEKİRDEĞİNE YAKIN; eforun high). TEK İŞ: S229 = A + S230 = A. Yanıtın Türkçe. PUSH YOK. Her bitmiş adımı (kod + testi + kanıtı) HEMEN commit et; koşuları ≤ 40 dk parçalara böl, her parçanın kanıtını hemen 'Kanıt:' commit'iyle kaydet; rapor taslağını `docs/kanit/" + GUN + "/s229-rapor-taslak.md`'ye adım adım yaz (kapsayıcı yeniden başlayabilir). Zamanlanmış görev KURMA. Kendi arka plan işin sürerken rapor vermeden BİTİRME; bekleme için boş döngü kurma.")
w("")
w("## Hazırlık")
w(f"1. Worktree'de (kendi commit'in YOKKEN) `git reset --hard {TABAN}` (= {UC[:8]}). `git log --oneline -2` ile doğrula; değilse DUR. `ln -s /home/user/ofis---y-netimi/node_modules node_modules` (`npm ci` YOK); tarayıcı `PLAYWRIGHT_BROWSERS_PATH={SP}/pw-1194`. ESKİ KOD (kırmızı kanıtı ve hız tabanı; ders 23, 25, 51): `git -C /home/user/ofis---y-netimi archive {ESKI} | tar -x -C {SP}/s229-<kısa kimliğin>/eski` (benzersiz klasör; node_modules bağı tam yolla) — eski kopyaya YALNIZ yeni yardımcı dosya girer, düzeltmenin dokunduğu test dosyası eski hâliyle kalır.")
w("2. ÖNCE oku: `CLAUDE.md` (dersler; özellikle 3, 6, 7, 9, 10, 11, 12, 13, 28, 31, 34, 38, 39, 43, 44, 47, 51, 53, 54; 'Test kuralı', 'Kullanıcının tekrar eden şikâyetleri', 'Kalıcı ürün kararları', 'Yazım düzeni', 'Kullanım kılavuzu'); `docs/BAGIMSIZ-DOGRULAMA-PRENSIBI.md`; sürücü raporu `docs/devir/2.5.0-DEVAM/surucu5-rapor.md` içinde R-S200 bölümü ve iki en küçük örnek (`docs/kanit/2026-11-20/surucu5-en-kucuk/`). Kâhin MODEL dosyaları okunmaz, `test/bagimsiz/**` YAZILMAZ (sürücü dahil — sürücü bakımı ana oturumda).")
w("")
w("## Kararlar (AYNEN)")
w(S229)
w(S230)
w(S200)
w(S213)
w(S210)
if S118: w(S118)
w(BM1947)
w("ANAYASA (CLAUDE.md, kalıcı ürün kararı): " + RAPOR)
w("ANAYASA (CLAUDE.md, kullanıcının tekrar eden şikâyeti): " + SIKAYET1)
w("KULLANICI KURALI (CLAUDE.md'den AYNEN): " + ONERI[0])
w("KULLANICI KURALI (CLAUDE.md'den AYNEN): " + BIRAK[0])
w("")
w("## Koddan görülenler (ana oturum; eksiksiz liste DEĞİL — TARAMA'da doğrula)")
w("- `server/routes/invoices.mjs` `openItems(day, { net, returns, withoutDoubtful })`: Açık Faturalar raporu (`server/routes/report-center.mjs`, `openItems(day, { returns: true })`) ve Anlık Durum'un fatura özeti (`server/routes/overview.mjs`, `openItems(day)` — açık / vadesi geçen satış ve alış toplamı) NET İSTEMEZ → faturanın KENDİ açığı. `netInvoiceStates` öncesindeki yorum bunu yazıyor: 'v2.0.23 (Bulgu 2 D) … Açık Faturalar raporu ve fatura kartı faturanın kendi açığını gösterir (net istemez)'. Bu tur o kuralı S229 = A / S230 = A ile DEĞİŞTİRİR; yorum da güncellenir.")
w("- DİKKAT — birleşik listelerin `net: true` yolu (yaşlandırma, nakit akışı, Vade Takip, zil / takvim) YALNIZ kartın aldığı kısmı düşmez: TYK net kalanı ayrıca alış faturası / Alacak Yaz'ı satış borcuna NETLEŞTİRİR (Ç5-B karar (5)) ve `withoutDoubtful` ile şüpheli kuyruğunu çıkarır (M13). S229 = A bunları İSTEMEZ: Açık Faturalar'da alış faturası kendi tarafında, mahsup edilmemiş iade belgesi kendi satırında (v2.1.0 K1), şüpheliye alınmış fatura listede kalır (S213 = B). Yani Açık Faturalar / Anlık Durum / fatura kartı için düşülecek olan YALNIZ kart(lar)ın faturadan aldığı kısımdır — `net: true`'ya geçmek YANLIŞ olur (testle göster: Alacak Yaz'lı cari, şüpheli fatura, iade belgesi).")
w("- Faturanın durum hesabı (`paymentStates` → `server/lib/obligation-queue.mjs`, eski kapama düzeninde `server/lib/invoice-settle.mjs`) her fatura için `open` (kendi açığı), `covered` (kartların aldığı) ve `coveredBy` (kart kart) taşıyor; taksitli faturanın durumu 'Taksitte' (`installment`). Kartın aldığı kısmın S200 = A sırasıyla (önce elle borçlar, eksik kısım faturalardan vade sırasıyla) hesaplandığını ve iki saat diliminde aynı çıktığını testle göster; uyuşmazsa KODLAMA → 'BAŞ MİMAR KARARI GEREKİYOR'.")
w("- İstemcide `doc.open` fatura kartında Tahsilat Ekle'nin görünmesini ve önerdiği tutarı, Mahsup Et'in önerdiği tutarı, 'Açık: …' satırını, Faturalar listesindeki Kalan sütununu ve Açık Bakiye kutucuğunu, WhatsApp paylaşım metnindeki vade satırını belirliyor (`client/assets/hof-invoices.js`); cari kartının fatura sekmesi (`client/assets/hof-accounts.js`) de fatura listesi gösteriyor. Faturalar listesinin PDF / Excel çıktısı ve 'Ödeme Durumu' süzgeci sunucuda.")
w("")
w("## İş (sırayla; her biri ÖNCE bugünkü kodda örnek veriyle yeniden üretilir — ders 6)")
w("0. NASIL BOZULUR (rapor taslağının başına, koddan ÖNCE, commit): kart faturanın bir KISMINI / TAMAMINI alır; bir faturayı İKİ kart alır; kart elle borç + iki fatura alır (S200 sırası); kartın taksiti tahsil edilir (fatura açığı DEĞİŞMEZ — kartın kendi kalanı düşer, S118); faturaya doğrudan tahsilat (bugünkü kapama aynen; fazlası en eski açık borca); kart silinir / iptal edilir / Kartı Kapat 'Borçta Kalsın' (S205 / S220) → fatura açığı geri gelir mi (bugünkü kart kuralıyla tutarlı); fatura iptali (S210 = A: kart kapanır); iade faturası kartı küçültür (v2.0.24 coveredBy); alış faturası / Alacak Yaz'lı cari (karar (5) netleşmesi Açık Faturalar'a GİRMEZ); şüpheliye alınmış fatura (S213 = B: listede kalır); Değersiz yazılmış kısım (S227 = C: bugünkü kural); mahsup edilmemiş iade belgesi (K1); eski kapama düzeni (`legacyView`) açık şirket; kilitli dönem; iki şirket; gün dönümü ve iki TZ; boş dönem; ileri tarihli kart / fatura; yetkisiz kullanıcı (Muhasebe rolü).")
w("1. TARAMA (koddan ÖNCE; sonucu rapor taslağına tablo: yol, bugün ne gösteriyor, S229 / S230 kapsamında mı, ne yapıldı): faturanın açığını GÖSTEREN ya da ondan tutar ÖNEREN her yer — `git grep -n -E \"openItems\\(|\\.open\\b|payState|coveredBy|covered\" -- server client/assets` + mobil özet (R2) + PDF / Excel çıktıları + WhatsApp / e-posta paylaşım metinleri. KAPSAM: Açık Faturalar raporu (ekran + PDF + Excel + alt TOPLAM), Anlık Durum'un fatura özeti (baş mimar yorumu S230'da AYNEN), fatura kartı (açık satırı + 'Taksit Kartında' satırı + ödeme durumu + Tahsilat Ekle / Mahsup Et önerisi), Faturalar listesi (Kalan, Açık Bakiye, Ödeme Durumu süzgeci, PDF / Excel). Kapsam DIŞINDA (DEĞİŞMEZ; tabloda gerekçesiyle): kapama sırası, tahsilat / ödeme / mahsup SINIRLARI (sunucu doğrulaması), bakiye, defter, birleşik listelerin (`net: true`) hesabı, kartın kendi kalanı, mutabakat. Taramada kararın söylemediği bir gösterim yeri çıkarsa (ör. cari kartının fatura sekmesi, mobil) ve Açık Faturalar'la AYNI kalemi gösteriyorsa aynı kural; ayrı bir anlamı varsa KODLAMA → 'KULLANICIYA SORULMALI'.")
w("2. KOD (S229 = A + S230 = A): 'gösterilen açık = faturanın kendi açığı − kart(lar)ın aldığı kısım' TEK yerde (sunucuda, faturanın durum hesabının yanında; istemci hesap YAPMAZ) ve bütün kapsam yolları onu okur. Kart faturanın TAMAMINI aldıysa: Açık Faturalar'da satır YOK; Anlık Durum toplamına girmez; fatura kartı ve Faturalar listesi 'Taksitte' (taksitli faturalar gibi; Ödeme Durumu süzgecinde 'Açık' kümesinde, taksitli faturalar nasıl süzülüyorsa öyle); fatura kartında 'Taksit Kartında: <kart adı> · <tutar>' satırı her kart için (karta bağlantı, `data-open-plan`; yazım düzeni). Tahsilat Ekle / Mahsup Et formunun ÖNERDİĞİ tutar ve 'Açık tutar …' metni gösterilen açıktır; formun kabul ettiği SINIR ve sunucunun kapaması DEĞİŞMEZ (eski kodla aynı istek → aynı veri tabanı satırları; testle göster). Bakiye, defter, kart kalanı, birleşik listeler BİREBİR aynı. Göç / şema / yeni dizin YOK. HIZ (ders 47): fatura başına ek sorgu YOK — kartın aldığı kısım zaten toplu durum hesabında; liste ve rapor tek toplu okumayla.")
w("3. TESTLER (yeni dosya, `test/` altında): her kapsam yolu için API düzeyinde (Açık Faturalar satır + TOPLAM; Anlık Durum özeti; fatura ayrıntısı; Faturalar listesi süzgeç seçenekleriyle — ders 11; PDF / Excel toplamı) × kısmi / tam / iki kart / elle borç + iki fatura / Alacak Yaz'lı cari / şüpheli / iade belgesi / iptal / kart silme / Kartı Kapat 'Borçta Kalsın' / eski kapama düzeni; her biri tabanda BEKLENEN NEDENLE kırmızı (ileti okunur: '50.000 gösterildi, 20.000 beklendi', ders 38, 51), yenide yeşil; iki TZ (UTC, Europe/Istanbul); göreli tarih (ders 13). Para DEĞİŞMEZİ: aynı istek dizisi eski ve yeni kodda → cari / kart / Kasa / defter satırları ve bakiye BİREBİR (veri tabanından okunur — ders 3, 12).")
w("4. KILAVUZ: Açık Faturalar / fatura kartı anlatımı varsa tek cümleyle güncellenir ('taksit kartına aktarılan kısım faturada açık görünmez; o kısım kartın taksitlerinden tahsil edilir'); değiştirirsen `docs/kilavuz/pdf-uret.mjs` + `pdf-denetle.mjs` aynı turda (ders 42); teknik anlatım GİRMEZ.")
w("")
w("## Kabul koşulları (bu turun)")
w("A. `npm run test:kahin-defter` tabanda ve sonda (iki TZ) — Açık Faturalar'ın R-S200 farkı (varsa) kalkmalı; değişen öbür her denetim BULGU (kâhin DEĞİŞTİRİLMEZ).")
w("B. `npm run test:kahin-cari` önce / sonra (iki TZ); `KAHIN_YAPIM_ASAMASI=<kendi kopyan>` ile yapım aşaması listesi kendi yolunda yeniden üretilir — BOŞ kalmalı; yeni kayıt / fark varsa adıyla rapor (elle etiketleme YOK).")
w("C. Muhasebe sürücüsü (`test/bagimsiz/muhasebe-surucu`; README'sinden; DEĞİŞTİRME) önce / sonra iki TZ: R-S200-ACIK-FATURALAR-KART-PAYI satırları (s118 af1 / af3) AYNI'ya dönmeli; çıkan her yeni fark adıyla ve nedeniyle; sürücünün sınıflama kuralı kalkacaksa yalnız RAPORLA ('sürücü bakımına').")
w("D. ESKİ SÜRÜM (ders 17, 53 (b)): v2.4.9'un GERÇEK kodunda (etiketli kopya `git worktree add --detach`, ders 54) iki en küçük örnek → bugünkü gösterimin v2.4.9'da da olduğunu sayıyla göster; v2.4.9'un kendi API'siyle girilmiş veride (kartın içine aldığı faturalar) yeni kodla açılış → S229 / S230 = A gösterimi; sınıf listesi (yol × kısmi / tam / iki kart × eski / yeni kapama düzeni) KALICI testte, beklenenler elle.")
w(f"E. HIZ (ders 47, 53 (a)): değiştirdiğin her istek — Açık Faturalar (100 bin), Anlık Durum, Faturalar listesi (süzgeçsiz + 'Açık' süzgeci), fatura ayrıntısı, Faturalar PDF / Excel — temiz 100 bin `{SP}/ana-kabul/temiz-100k` (OKUNUR; KENDİ kopyanda) taban ↔ yeni; yanıt + olay döngüsü en çok; ÖZEL kilit `flock -x -w 1800 {SP}/olcum.lock` tek seferlik (alamazsan 'ÖLÇÜLEMEDİ'; ana oturum ayrıca ölçer); /proc/loadavg yazılır, yük > 2 ise 'GEÇERSİZ'. Ölçüt: en iyi VE ortanca tabanın %10'undan kötü değil; kötüleşen yol birleşmez.")
w("F. DEĞİŞMEZLER: Mutabakat Testi + Defter Mutabakatı temiz; bakiye / kart / Kasa / defter / birleşik listeler (yaşlandırma, nakit akışı, Vade Takip, zil) BİREBİR (eski ↔ yeni aynı istek dizisi).")
w("G. EKRAN (ders 11, 12, 28, 34, 39; yazım düzeni; şikâyet 1): cari aç → Borç Yaz + fatura → 'Carinin Mevcut Borcu' kartı (kısmi ve tam) → Açık Faturalar (her süzgeç) → fatura kartı ('Taksit Kartında' bağlantısı karta gider) → Faturalar listesi ('Açık' süzgeci) → Tahsilat Ekle önerisi → Anlık Durum; gerçek tıklama + insan hızı; ekran görüntüleri `docs/kanit/" + GUN + "/s229-ekran/`. Beklentisi değişen her ekran senaryosu KOŞULUR (ders 28; `git grep` ile Açık Faturalar / fatura kartı / Faturalar listesi okuyan e2e'ler). Yeni ekran senaryosu açabilirsin; ci.yml'ye EKLEME — raporda 'CI listesine eklenecek'.")
w("G2. KOMŞULAR (ders 10): `openItems` / `paymentStates` / fatura ayrıntısını ve Faturalar listesini kullanan her yola (yaşlandırma, nakit akışı, Vade Takip, zil / takvim, mobil özet, WhatsApp ekstre, e-Belge) dokunan testler `git grep` taramasıyla seçilir, iki TZ. MUTANTLAR DEĞERLE (en az: kart payını düşmeyi unut; `net: true`'ya geç (karar (5) netleşmesi sızar); tam alınan faturayı listede bırak; iki karttan yalnız birini düş; Tahsilat Ekle önerisinde eski açığı bırak; Anlık Durum'u eski hesapta bırak) — her biri en az bir testte kırmızı.")
w("")
w("## Kurallar")
w("- DOSYA SINIRI: yazabileceğin — `server/routes/invoices.mjs` (YALNIZ gösterilen açık / durum ve onu okuyan rapor işlevleri; kapama ve doğrulama DEĞİŞMEZ), `server/routes/report-center.mjs` (Açık Faturalar), `server/routes/overview.mjs` (fatura özeti), `server/lib/obligation-queue.mjs` ve `server/lib/invoice-settle.mjs` (YALNIZ durum çıktısına alan eklemek için; hesap DEĞİŞMEZ — gerekçesiyle), `client/assets/hof-invoices.js` ve `client/assets/hof-accounts.js` (gösterim), testler + `test/fixtures/**`, kılavuz HTML + PDF (gerekirse). Başka her dosya YASAK; özellikle `server/lib/migrations.mjs`, `server/lib/db.mjs`, `server/lib/ledger*.mjs`, `server/lib/bank/**`, `server/routes/plans.mjs`, `server/lib/whatsapp/**`, `server/lib/einvoice/**`, `.github/**`, package.json, tools/**, `test/bagimsiz/**`.")
w("- PARA KURALI AYRIŞMASI (ders 43): kararların söylemediği / iki okumaya açık bir durum çıkarsa KODLAMA — 'KULLANICIYA SORULMALI' (iki seçenek + öneri + her okumada ekranda hangi tutar; 'yaygın programlarda nasıl' satırı yalnız doğrulanmış kaynakla; uç durumsa üçüncü seçenek 'Uç durum böyle kalsın (BİLİNEN SINIR)'). Mimari seçimse 'BAŞ MİMAR KARARI GEREKİYOR' (seçenek + öneri + gerekçe). Önce iş listesi C / D'de aynı soru var mı ARA (iş listesi `docs/2.5.0-IS-LISTESI.md`).")
w("- KULLANICI KURALI (yukarıda AYNEN): programı ya da kullanıcıyı etkilemeyen ayrıntıyı (test düzeni, araç, ölçüm nüansı, doğrulanmamış kuşku) KOVALAMA; raporun 'SONRAKİ SÜRÜME (2.5.1)' başlığına yaz.")
w(f"- Koşular `HUKUK_LICENSE_URL=http://127.0.0.1:9 KANIT_DIR=<not defterin> node tools/kanit.mjs kos s229-<ad> -- <komut>`; BÜTÜN test koşuların (tek dosya dahil) `flock -s -w 3600 {SP}/olcum.lock` altında (tek seferlik bekleme; ana oturumun hız ölçümü kilidi ÖZEL tutuyor olabilir — beklerken okuma / tasarım / kod; kilit süresi dolarsa koşuyu bir kez yeniden başlat, döngü kurma); her arka plan koşusu `timeout -k 5 <sn>` (en çok 2 saat); önce `cat /proc/loadavg`, 4'ün üstündeyse tek seferlik bekle. GIT_DIR / GIT_WORK_TREE VERME (ders 54). `pkill` / joker `rm` YOK. Tam `npm test` YOK. Veri klasörleri /dev/shm'de kendi klasöründe; bitince tam yoluyla sil. Disk 5 GB'ın altına düşmez. Kanıt `docs/kanit/{GUN}/s229-*` (büyükse .gz; ayrı 'Kanıt:' commit'i). Commit'e yalnız kendi yolların (`git add <yol>`; ders 44).")
w("- Commit iletisi sonunda tam olarak (model adı YOK):")
w("  Co-Authored-By: Claude <noreply@anthropic.com>")
w("  Claude-Session: https://claude.ai/code/session_01EhegDvmPQ9hx2ibfitm6og")
w("")
w("## Rapor (SubagentHandback, Türkçe)")
w("EN BAŞTA değişen her gözlenebilir davranış (önce → sonra; ekran adıyla; iki en küçük örneğin sayılarıyla); değişen dosyalar; TARAMA tablosu; yeni / değişen testlerin kırmızı nedeni + yeşili (iki TZ); A–G + G2 sayıları; para değişmezi (eski ↔ yeni aynı istek dizisi); v2.4.9 karşılaştırması; mutant tablosu; hız tablosu (taban / yeni en iyi + ortanca, olay döngüsü en çok, yük); KULLANICIYA SORULMALI; BAŞ MİMAR KARARI GEREKİYOR; SONRAKİ SÜRÜME (2.5.1); DOĞRULANMADI; DENENMEYEN; 'CI listesine eklenecek'; commit listesi; dal ucu; ana oturumun yeniden koşacağı komutlar.")
open(OUT, 'w', encoding='utf-8').write('\n'.join(o) + '\n')
print('yazıldı', OUT, sum(len(x) + 1 for x in o))
