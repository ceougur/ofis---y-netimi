# ANA OTURUM — TEK ADAY DÜZELTME TURU (G1 + B1 + S212 + DÜŞÜK'ler + G1 hızı) DAR KONTROL görev metni üreteci (prensip §9 iskeleti).
# Kararlar iş listesinden / CLAUDE.md'den AYNEN; bulgular önceki dar kontrolün raporundan AYNEN (incelemecinin kendi bulgusu — düzeltme
# ajanının raporu DEĞİL). Düzeltme ajanının raporu / görev metinleri / KAYIT kayıtları VERİLMEZ (prensip §3).
# Çağrı: cd <depo>; python3 -I <bu> <çıktı -istem.txt> <birleşim commit'i>
import sys
OUT, M = sys.argv[1], sys.argv[2]
SP = '/tmp/claude-0/-home-user/de5e1cbf-7e68-5683-b7bb-f27655eaed4f/scratchpad'
t = open('docs/2.5.0-IS-LISTESI.md', encoding='utf-8').read()
il = t.split('\n')
D = t[t.find('\n## D'):]
dent = D.split('\n- ')[1:]
cl = open('CLAUDE.md', encoding='utf-8').read().split('\n')
rp = open('docs/devir/2.5.0-DEVAM/dk-t3c7a-rapor.md', encoding='utf-8').read()


def tek(lines, basla):
    hit = [l for l in lines if l.startswith(basla)]
    assert len(hit) == 1, (basla, len(hit))
    return hit[0].strip()


def dkayit(onek):
    x = [e for e in dent if e.startswith(onek)]
    assert len(x) == 1, (onek, len(x))
    return x[0]


def kes(metin, bas, son):
    i = metin.find(bas); assert i >= 0, bas
    j = metin.find(son, i); assert j >= 0, son
    return metin[i:j + len(son)].strip()


def soru(n):
    return tek(il, f'  S{n} (')


D31 = tek(cl, '31. ')
SUREC = [l.strip() for l in cl if l.strip().startswith('Ç5-A DAR KONTROL SÜREÇ KURALI')]
assert len(SUREC) == 1
BIRAK = [l.strip() for l in cl if l.strip().startswith("2.5.1'E BIRAK")]
assert len(BIRAK) == 1
d0006 = dkayit('BAŞ MİMAR KARARI 20.11 00:06')
K1 = kes(d0006, '(2) B1 — aynı sınıf içinde YAZIM SIRASI', 'kullanıcıya soru değil);')
K2 = kes(d0006, '(3) S212 = A', '— aynı ayırıcı;')
K3 = kes(d0006, "(4) DÜŞÜK'ler BİRLEŞİK TURDA", 'S181 çek yolu iletisi.')
K4 = kes(d0006, 'K2 UYMUYOR → S214 = A', 'açıkça kabul).')
G1 = kes(rp, '**G1 — ORTA.**', '`markCounted` uygulanır.')
B1 = kes(rp, '**B1 — ORTA', 'kural ders 31\'de yazılı.')
DU = kes(rp, '**DÜŞÜK** (sakınca süzgeci', '"Tutarı 500\'e indirin / bağı kaldırın" önerisini vermiyor.')
TUR3 = [136, 137, 138, 141, 155, 160, 161, 167, 168, 181]
C7A = [175, 177, 178, 179, 182, 183, 184, 187, 188, 189, 190, 191, 192]
YENI = [212, 214, 215]

p = []; w = p.append
w("Sen DestekOfis projesinde bağımsız DAR KONTROL incelemecisisin (2.5.0 — TEK ADAY DÜZELTME TURU: önceki dar kontrolün iki ORTA bulgusu G1 / B1, S212, DÜŞÜK'ler ve G1 düzeltmesinin hızı). Yalnız HATA ararsın. Düzeltme, commit ve push YAPMAZSIN. PARA ÇEKİRDEĞİ (defter / şüpheli alacak ayırıcısı) — eforun high. Yanıtın Türkçe. Zamanlanmış görev KURMA.")
w("")
w("## Hazırlık")
w(f"1. Worktree'de ÖNCE `git reset --hard {M}` (incelenecek birleşim; ilk ebeveyni birleşim öncesi kod = DÜZELTME ÖNCESİ). Kendi commit'in olmayacak.")
w(f"2. `ln -s /home/user/ofis---y-netimi/node_modules node_modules` (`npm ci` YOK). Tarayıcı: `PLAYWRIGHT_BROWSERS_PATH={SP}/pw-1194`.")
w("3. ÖNCE oku: `CLAUDE.md` (anayasa + dersler 1–54); `docs/BAGIMSIZ-DOGRULAMA-PRENSIBI.md` (tamamı; §3 senin kuralların); muhasebeleştirme kural kitabında K-14, K-15, KG-6 ve şüpheli (128 / 129) satırları (python ile ara); `docs/erp/C5-ACILIS-TASARIM.md` §2–§4 ve §17'nin KURAL cümleleri (§17.x 'ajan yaptı' anlatımları kanıt DEĞİL — kodla karşılaştır).")
w("   OKUNMAZ (prensip §3 bağımsızlık): `docs/devir/2.5.0-DEVAM/` altındaki *-rapor.md, *-istem.txt, *-ek.txt dosyaları (düzeltme ajanlarının raporları ve görev metinleri; önceki dar kontrolün bulguları aşağıda AYNEN verildi), `docs/2.5.0-IS-LISTESI-KAYIT.md`, `docs/kanit/2026-11-*/` altındaki ajan ve ana oturum çıktıları. Kodu ve testleri farktan oku.")
w(f"4. TEMİZ büyük veri (OKUNUR; kendi kopyanı al): `{SP}/ana-kabul/` (temiz-100k).")
w(f"5. Not defteri: `{SP}/dk-t3duz-<kısa>` (ders 25). Eski kod kopyası `git -C /home/user/ofis---y-netimi archive {M}^1 ':!docs/kanit' | tar -x -C <klasör>` + node_modules bağı; eski sürüm ETİKETİ isteyen test için `git -C /home/user/ofis---y-netimi worktree add --detach <klasör> <ref>`, bitince `git -C /home/user/ofis---y-netimi worktree remove --force <o tam yol>` (ders 54: `GIT_DIR` / `GIT_WORK_TREE` VERME). Biten kopyanı TAM yoluyla sil; `df -h /` 5 GB'ın altına düşürme; aynı anda en çok BİR eski kopya.")
w("")
w("## Kapsam (DURMA KURALI — yalnız bu fark)")
w(f"`git diff {M}^1 {M} -- server client test ':!test/bagimsiz'` — altı ürün dosyası (server/lib/bank/doubtful.mjs, server/lib/bank/money-lines.mjs, server/lib/doubtful-gl.mjs, server/lib/obligation-queue.mjs, server/routes/cheques.mjs, server/routes/report-center.mjs) ve değişen / yeni testler (bir e2e senaryosunun BEKLENTİSİ değişti — test/e2e/senaryo-banka-210.mjs). Dört iş: (1) G1 — 'Banka ve POS Hareketleri' Hesap = Tüm Hesaplar'da 'Açılışta Sayıldı'; (2) B1 — şüpheli ayırıcısında aynı gün aynı sınıftaki alacakların sırası; (3) S212 — şüpheliye almadan önce bağsız ödemeyle kapanmış faturaya sonradan bağlı tahsilat; (4) DÜŞÜK'ler (N5 / N7 / N8 / N11 testleri + S181 çek yolu iletisi) ve G1 düzeltmesinin HIZ değişiklikleri (davranış DEĞİŞTİRMEMELİ). Muhasebe sürücüsü ve kâhinler (test/bagimsiz) KAPSAM DIŞI.")
w("")
w("## Düzeltilen bulgular (önceki dar kontrolün raporundan AYNEN; satır numaraları düzeltme ÖNCESİ koda göre; bu metinde 'birleşim öncesi kod' = banka türetme kurallarından (Ç7a) ÖNCEKİ kod, 'yeni kod' = bu düzeltmenin TABANI)")
w(G1)
w("")
w(B1)
w("")
w(DU)
w("")
w("## İLK MADDELER (önce bunlar)")
w("1. G1: 'Banka ve POS Hareketleri' Tüm Hesaplar — her Yol seçeneği (Banka ve POS (Tümü), Banka (Havale / EFT), POS, kart, kredi) × dönem (açılıştan önce / açılışı kapsayan / sonra) × hesap seçimi: 'Açılışta Sayıldı' satırı işaretli mi, alt TOPLAM = defter (102 / 108) = kova (hesap + Atanmamış) mı; ekran / PDF / Excel aynı sayı mı. Kasa raporları DEĞİŞMEMELİ (kalıcı ürün kararı 03.10.2026: 'Kasa raporları değişmez') — Kasa yolunun bütün çıktıları düzeltme öncesi ↔ sonrası BİREBİR mi; değişen ortak yardımcıları kullanan öbür raporlar (G2 komşu; `server/` taramasıyla) aynı mı.")
w("2. B1 (ders 31): aynı gün aynı sınıfta birden çok alacak — 2 yazım sırası × 2 kimlik sırası; iki yükleyici (SQL ↔ yevmiye) AYNI dağılımı veriyor mu. YAZIM SIRASI hangi alandan okunuyor? O alan yedek → geri yükleme, şirket kopyalama, VACUUM, eski sürümden göç ve silme → geri alma sonrasında KORUNUYOR mu (her biri betikle; korunmuyorsa dağılım değişiyor mu — sayıyla). Sınıf içi sıranın toplamı / bakiyeyi değiştirmediğini göster.")
w("3. S212: şüpheliye alma ↔ bağsız ödeme ↔ bağlı tahsilat ↔ Şüpheliden Çıkar ↔ silme / geri alma — farklı sıralarda (ders 17) 120 / 128 / 644 dağılımı ve kuyruk karar metnine uyuyor mu; serbest kalan bağsız ödeme NEREYE dağılıyor (en eski açık fatura mı, kuyruk sırası mı) — karar metniyle karşılaştır; iki yükleyici aynı mı.")
w("4. Beklentisi DEĞİŞEN e2e (test/e2e/senaryo-banka-210.mjs): eski ve yeni beklenen sayıyı KENDİN hesapla (senaryonun adımlarından, kural kitabı + S214 metninden); yeni beklenti kararla mı geldi, yoksa bir gerilemeyi mi örtüyor? Senaryoyu iki kodda koş (ders 28).")
w("5. HIZ değişikliklerinin EŞDEĞERLİĞİ: düzeltme öncesi ↔ sonrası çıktılar, G1 / B1 / S212'nin BİLEREK değiştirdiği yerler dışında BİREBİR mi (temiz büyük veri + şüpheli / bağlı tahsilatlı / çek / taksitli / silinmiş kayıtlı / iki şirketli küçük veri; iki TZ). Yeni eşdeğerlik testi (test/g1-hiz-esdegerlik-250.test.mjs) ürünle aynı elden — kâhin sayılmaz (ders 5, 32); kendi karşılaştırmanı yap.")
w("6. Testin dişi (prensip §3): yeni / değişen testler düzeltme öncesi kodda BEKLENEN NEDENLE kırmızı mı (ders 38, 51); mutasyon aracındaki mevcut mutantlar (test/supheli-kuyruk-defter-250-mutasyon.mjs) birkaç kez — ara sıra yaşayan var mı. YENİ MUTANT YAZMAK ZORUNLU DEĞİL; yaşayan mutant / eksik test aşağıdaki KULLANICI KURALIYLA 'SONRAKİ SÜRÜME (2.5.1)' başlığına yazılır, yeni tur açmaz.")
w("7. S181 çek yolu: çek VE senet yolunda ileti nakit yoluyla aynı öneriyi veriyor mu (tutar / bağ); red durumunda veri tabanında iz yok mu (ders 3); kabul edilen sınır tutarında (tam eşit) davranış.")
w("")
w("## Ne ara (sonra)")
w("- GERİLEME: raporun EN BAŞINDA ayrı başlıkla. Bu düzeltmenin dokunmadığı bütün defter / cari / banka çıktıları düzeltme öncesi ↔ sonrası BİREBİR mi (temiz büyük veri; v2.4.9 kilitli verisi — eski sürümün GERÇEK koduyla üretilmiş; iki saat dilimi).")
w("- RASTGELE SIRA (ders 17) ve tarih dönümleri (ders 13; sahte saat): ayın 1'i, yıl dönümü, açılış günü ile aynı gün hareket.")
w("- EŞZAMANLILIK: iki kullanıcı aynı cariye aynı anda bağlı tahsilat; aynı anda çek girişi ve şüpheliye alma.")
w("- YETKİ: her rol × değişen uçlar; reddedilen istek veri tabanında iz bırakıyor mu.")
w("- G2 KOMŞU: değişen işlevlerin BÜTÜN çağıranları (`test/` ve `server/` taramasıyla); değişen ekran yollarının e2e senaryoları.")
w("")
w("## BAŞ MİMAR KARARLARI — DEĞERLENDİR (karar metnine / kitaba / derse uyuyor mu; betikle göster)")
w("- K1 (B1): " + K1)
w("- K2 (S212): " + K2)
w("- K3 (DÜŞÜK'ler): " + K3)
w("- K4 (G1): önceki dar kontrol 'K2'yi (14.11 baş mimar okuması: Tüm Hesaplar toplamı) karar metnine uymaz buldu → " + K4)
w("- K5 (hız): G1 düzeltmesinin yavaşlattığı iki yol (Tüm Hesaplar raporu, bağlı çek yazımı) için yapılan hız değişiklikleri davranışı DEĞİŞTİRMEMELİ; eşdeğerlik düzeltme öncesi ↔ sonrası aynı veride gösterilmeli.")
w("")
w("DERS 31 (CLAUDE.md'den AYNEN): " + D31)
w("")
k = []
k.append("# TEK ADAY DÜZELTME DAR KONTROLÜ — KULLANICI KARARLARI (iş listesinden AYNEN; ana oturum üretti)")
k.append("Soru metinlerindeki 'program bugün' / 'bugünkü' sözleri ve sayılar soru anının bilgisidir; kural seçilen seçeneğin metnidir.")
k.append("## Bu turun kararları")
for n in YENI: k.append(soru(n))
k.append("## Şüpheli ↔ kuyruk (Ç5-A tur 3; ayırıcının kuralları)")
for n in TUR3: k.append(soru(n))
k.append("## Banka türetme kuralları (Ç7a; 'Açılışta Sayıldı', K-14 / K-15)")
for n in C7A: k.append(soru(n))
KOUT = OUT.replace('-istem.txt', '-kararlar.md'); assert KOUT != OUT
open(KOUT, 'w', encoding='utf-8').write('\n'.join(k) + '\n')
w("## KULLANICI KARARLARI")
w(f"İş listesinden AYNEN çekilmiş karar metinleri ayrı dosyada: `/home/user/ofis---y-netimi/{KOUT}` — TAMAMINI oku (bu tur: S212, S214, S215; ayırıcı: S136–S138, S141, S155, S160, S161, S167, S168, S181; banka: S175, S177–S179, S182–S184, S187–S192). Kural seçilen seçeneğin metnidir.")
w("")
w("SÜREÇ KURALI (kullanıcı kararı — bu dar kontrolde GEÇERLİ; CLAUDE.md'den AYNEN): " + SUREC[0])
w("")
w("BULGU SINIFI — KULLANICI KURALI (bu dar kontrolde GEÇERLİ; CLAUDE.md'den AYNEN): " + BIRAK[0])
w("Bu kurala göre: programın davranışını / sayılarını / hızını ya da kullanıcının gördüğünü DEĞİŞTİRMEYEN husus DÜŞÜK'tür ve raporun 'SONRAKİ SÜRÜME (2.5.1)' başlığına yazılır; programı ya da kullanıcıyı etkileyen her bozulma (yanlış para / bakiye / defter / rapor toplamı, yanlış ileti, gerileme, veri kaybı, KVKK) eskisi gibi YÜKSEK / ORTA. Ayrıntıya boğulma: önce İLK MADDELER, sonra kalan süre kadar genel liste.")
w("")
w("## Yöntem (prensip §3)")
w("- Her bulgu betikle GERÇEK programda üretilir; çıktıda sayı olur. Program başlatırken `HUKUK_LICENSE_URL=http://127.0.0.1:9`. Üretilemeyen kuşku 'DOĞRULANMADI'ya.")
w("- Eski kod yalnız ayrı kopyada (ders 23, 51).")
w(f"- Yük koşuları `flock -s -w 3600 {SP}/olcum.lock …` (tek seferlik bekleme). HER arka plan koşusu açık süre sınırıyla (`timeout -k 5 <sn> …`, en çok 2 saat; içinde bekleme döngüsü YOK — ders 50). Önce `cat /proc/loadavg`; 4'ün üstündeyse yeni koşu başlatma, tek seferlik bekle. Aynı anda en çok BİR yük koşusu.")
w("- KAPSAYICI SIK YENİLENİYOR: koşuları ≤ 40 dk parçalara böl; her parçanın bulgusunu ve sayılarını not defterindeki `rapor-taslak.md`'ye HEMEN yaz (commit YOK — çıktılar depoya girmez); kesilirsen yeni incelemeci oradan sürdürür.")
w("- `pkill` / `killall` / joker `rm` YOK; yalnız KENDİ pid'in. Tam `npm test` YOK. Koşular `KANIT_DIR=<kendi not defteri klasörün> node tools/kanit.mjs kos dkt3duz-<ad> -- <komut>`. Çıktılar depoya commit EDİLMEZ.")
w("- PARA / DEFTER KURALI AYRIŞMASI (ders 43): iki okumaya açık bir kural bulursan düzeltme önerme — KULLANICIYA SORULMALI (iki seçenek + öneri; uç durumsa üçüncü seçenek 'Uç durum böyle kalsın (BİLİNEN SINIR)'). Önce iş listesi C / D'de aynı soru sorulmuş mu ARA (yalnız C ve D; KAYIT okunmaz); sorulmuşsa numarasını yaz. Her alt durumda mizanın iki okumada aynı olup olmadığını SAYIYLA yaz.")
w("- SAKINCA SÜZGECİ: her DÜŞÜK için yaz — yanlış para / bakiye / defter, veri kaybı, KVKK ya da gerileme mi? Öyleyse ORTA say.")
w("- Kendi arka plan işin sürerken turunu rapor vermeden BİTİRME.")
w("")
w("## Rapor (prensip §3 biçimi; SubagentHandback ile)")
w("EN BAŞTA: GERİLEMELER (varsa). Sonra İLK MADDELER 1–7'nin sonucu tek tek. Sonra her bulgu — sınıf (YÜKSEK / ORTA / DÜŞÜK; SÜREÇ KURALI'na göre), dosya:satır, betik + çıktı (sayılarla), kök neden, en küçük düzeltme önerisi; sıra / eşzamanlılık / yetki tabloları; düzeltme öncesi ↔ sonrası eşdeğerlik; K1–K5 değerlendirmesi; KULLANICIYA SORULMALI; SONRAKİ SÜRÜME (2.5.1); DOĞRULANMADI; DENENMEYEN; not defteri klasörlerin (tam yol). Bulgu yoksa açıkça 'YÜKSEK / ORTA YOK'.")
open(OUT, 'w', encoding='utf-8').write('\n'.join(p) + '\n')
print(len('\n'.join(p)))
