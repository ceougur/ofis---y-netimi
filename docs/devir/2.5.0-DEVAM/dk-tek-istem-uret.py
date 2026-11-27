# ANA OTURUM — TEK DAR KONTROL (S229 + S230 + 'Ç7b DK + S229 ALTIN' birleşik küçük tur + izleyen tur 1 / 2 / 3 + S223 + S231 (S252 = A); TOKEN TASARRUFU (3)) görev metni üreteci (prensip §9). dk-s229-istem-uret.py'den türetildi.
# Kararlar iş listesinden / CLAUDE.md'den AYNEN; baş mimar kararlarından YALNIZ 'KARARLAR' / 'KAPSAM' paragrafları ('AJANIN SÖYLEDİĞİ' rapor özetleri, ajan sayıları, KAYIT VERİLMEZ — prensip §3).
# Çağrı: cd <depo>; python3 -I <bu> <çıktı -istem.txt> <izleyen tur 3 birleşim commit'i> <S223 + S231 birleşim commit'i> (ikisi de çalışma dalında)
import sys
OUT, M3, M4 = sys.argv[1], sys.argv[2], sys.argv[3]
SP = '/tmp/claude-0/-home-user/de5e1cbf-7e68-5683-b7bb-f27655eaed4f/scratchpad'
REPO = '/home/user/ofis---y-netimi'
t = open('docs/2.5.0-IS-LISTESI.md', encoding='utf-8').read()
il = t.split('\n')
D = t[t.find('\n## D'):t.find('\n## E')]
dent = D.split('\n- ')[1:]
cl = open('CLAUDE.md', encoding='utf-8').read().split('\n')
def tek(lines, basla):
    hit = [l for l in lines if l.startswith(basla)]; assert len(hit) == 1, (basla, len(hit)); return hit[0].strip()
def dkayit(onek):
    x = [e for e in dent if e.startswith(onek)]; assert len(x) == 1, (onek, len(x)); return x[0].strip()
def kes(metin, bas, son=None):
    i = metin.find(bas); assert i >= 0, bas
    if son is None: return metin[i:].strip()
    j = metin.find(son, i); assert j >= 0, son
    return metin[i:j + len(son)].strip()
def soru(n): return tek(il, f'  S{n} (')
def k0511(no):
    i = [k for k, l in enumerate(il) if l.startswith('  (%s) 2B-S' % no)]; assert len(i) == 1, no
    k = i[0]; out = [il[k].strip()]
    while il[k + 1].startswith('      '): k += 1; out.append(il[k].strip())
    return ' '.join(out)
BIRAK = [l.strip() for l in cl if l.strip().startswith("2.5.1'E BIRAK")]; assert len(BIRAK) == 1
# Birleşimler (çalışma dalının ilk ebeveyn zinciri) — her biri M^1..M farkı
BIR = [('85f70cda', "'Ç7b DK + S229 ALTIN' birleşik küçük tur + S229 / S230 (cari kâhini bakımı 23 kapsam DIŞI)"),
       ('be634617', 'izleyen küçük tur (izleyen tur 1): P-2, P-1 / S238, S234-c, BULGU-1 / 2, fatura kartı GET hızı, S239 / S240'),
       ('a2cab6c3', 'izleyen tur 2: S241 azaltma kolu, kart kapsam seçimi tek yardımcıda, iade Düzenle\'si kayıtlı taksitlere, faturasız stok iadesinin silme / düzeltme / geri yüklemesi (cari kâhini bakımı 25 kapsam DIŞI)'),
       (M3[:8], 'izleyen tur 3: bütünlük kapısının kapsam süzgecinde rowid yeniden kullanımı (yalnız bu işlemde EKLENMİŞ rowid\'de kimlik farkı iki satıra bölünür) + stok iadesinin düzeltme / silme / geri yüklemesinde öbür ekranlara plans / accounts olayı'),
       (M4[:8], 'S223 + S231: içe aktarma yollarında (cari Excel, taksit Excel, Tablodan Aktar, çek / senet) kişi ve grup adının Türkçe büyük / küçük harf katlamasıyla eşleşmesi (S228 = A önce bugünkü karşılaştırma; S232 eşleşme düzeyi), çek eşleme penceresi metni, çek yolu hızı, Tablodan Aktar Geri Al\'ın var olan grubu silmemesi')]
KUL = [dkayit('KULLANICI KARARI 20.11 20:14 UTC'), dkayit('KULLANICI KARARI 11.11 03:15 UTC'), dkayit('KULLANICI KARARI 11.11 06:35 UTC')]
SORULAR = [110, 120, 129, 200, 206, 213, 223, 228, 229, 230, 231, 232, 234, 235, 237, 238, 239, 240, 241, 242, 243, 244, 245, 246, 247, 248]
d2012 = dkayit('BAŞ MİMAR KARARI 20.11 20:12'); d0035 = dkayit('BAŞ MİMAR KARARI 21.11 00:35')
BM = [
    ('K1 (20.11 20:12 — S229: koddan görülenler; hangi yol düşülür)', kes(d2012, 'KODDAN GÖRÜLENLER', "fatura toplamları Açık Faturalar'ı izler.")),
    ('K2 (21.11 00:35 (1) — API alanı: `open` GÖSTERİLEN açık, `ownOpen` faturanın kendi açığı)', kes(d0035, '(1) CARİ KÂHİNİNDE 46 FARK', 'kaçan yol sessizce eski sayıyı gösterir.')),
    ('K3 (21.11 00:35 (2))', kes(d0035, '(2) Kartın TAMAMINI aldığı', 'tahsil edilir\' sözüyle tutarlı).')),
    ('K4 (21.11 00:35 (3))', kes(d0035, '(3) Tamamı alınan fatura', "(karar metni 'Taksitte').")),
    ('K5 (21.11 10:21 — birleşik küçük tur KARARLARI)', kes(dkayit('BAŞ MİMAR KARARI 21.11 10:21'), 'KARARLAR:')),
    ('K6 (21.11 12:50 — izleyen tur 1 KAPSAMI)', kes(dkayit('BAŞ MİMAR KARARI 21.11 12:50'), 'KAPSAM YEDİ İŞ', 'öneriden farklıysa düzeltilir.')),
    ('K7 (21.11 18:28 — izleyen tur 1 sonrası KARARLAR)', kes(dkayit('BAŞ MİMAR KARARI 21.11 18:28'), 'KARARLAR:')),
    ('K8 (22.11 01:02 — izleyen tur 2 sonrası KARARLAR)', kes(dkayit('BAŞ MİMAR KARARI 22.11 01:02'), 'KARARLAR:')),
    ('K9 (22.11 07:04 — izleyen tur 3 KARARI: süzgeç kuralının seçimi)', kes(dkayit('BAŞ MİMAR KARARI 22.11 07:04'), 'KARAR:', 'yakalandı.')),
    ('K10 (20.11 19:19 — S223 KODDAN GÖRÜLENLER ve KAPSAM DIŞI)', kes(dkayit('BAŞ MİMAR KARARI 20.11 19:19'), 'KODDAN GÖRÜLENLER')),
    ('K11 (20.11 22:45 — S223 KARARLARI)', kes(dkayit('BAŞ MİMAR KARARI 20.11 22:45'), 'KARARLAR:', 'İngilizce klavye harf değişimi.')),
    ('K12 (20.11 23:26 — S223 çek hızı KARARI)', kes(dkayit('BAŞ MİMAR KARARI 20.11 23:26'), 'KARAR:')),
    ('K13 (21.11 09:20 — S231 KARARLARI)', kes(dkayit('BAŞ MİMAR KARARI 21.11 09:20'), 'KARARLAR:', 'teslim notuna.')),
]
k = []
k.append("# TEK DAR KONTROL — KULLANICI KARARLARI (iş listesinden AYNEN; ana oturum üretti)")
k.append("Soru metinlerindeki 'program bugün' / 'bugünkü' sözleri ve sayılar soru anının bilgisidir; kural SEÇİLEN seçeneğin metnidir (seçim satırın sonunda: 'öneri X UYGULANIR / UYGULANDI' ya da 'KULLANICI'). 'KULLANICI KURALIYLA ÖNERİ UYGULANDI' = kullanıcının 14.11 06:31 kuralı (AYNEN: \"bana sorun varsa önerilerini uygula\").")
k.append("## 05.11 kararları (AYNEN)")
k += ["KULLANICI KARARI 05.11 (AYNEN): " + k0511(4), "KULLANICI KARARI 05.11 (AYNEN): " + k0511(6)]
k.append("## Karar blokları (iş listesi D)")
k += ['- ' + e for e in KUL]
k.append("## Sorular (iş listesi C)")
k += [soru(n) for n in SORULAR]
KOUT = OUT.replace('-istem.txt', '-kararlar.md'); assert KOUT != OUT
open(KOUT, 'w', encoding='utf-8').write('\n'.join(k) + '\n')
KYOL = KOUT if KOUT.startswith('/') else REPO + '/' + KOUT
p = []; w = p.append
w("Sen DestekOfis projesinde bağımsız TEK DAR KONTROL incelemecisisin (2.5.0 — Mevcut Borç / taksit kartının kapsamı, küçülmesi ve büyümesi (iade, iade iptali, faturasız stok iadesi, fatura Düzenle ile azaltma), Tek Yükümlülük Kuyruğu ↔ kapama defteri, faturanın GÖSTERİLEN açığı (S229 / S230), bütünlük kapısının kapsam süzgeci, canlı yenileme). Yalnız HATA ararsın. Düzeltme, commit ve push YAPMAZSIN. PARA ÇEKİRDEĞİ ve KAPI GÜVENLİK ÇEKİRDEĞİ — eforun high. Yanıtın Türkçe. Zamanlanmış görev KURMA.")
w("")
w("## Hazırlık")
w(f"1. Worktree'de ÖNCE `git reset --hard {M4}` (incelenecek son birleşim; çalışma dalı). `git log --oneline -1` ile doğrula; değilse DUR. Kendi commit'in olmayacak.")
w(f"2. `ln -s {REPO}/node_modules node_modules` (`npm ci` YOK). Tarayıcı: `PLAYWRIGHT_BROWSERS_PATH={SP}/pw-1194`.")
w("3. ÖNCE oku: `CLAUDE.md` (anayasa + dersler 1–54); `docs/BAGIMSIZ-DOGRULAMA-PRENSIBI.md` (tamamı; §3 senin kuralların); muhasebeleştirme kural kitabı EK-1 §6'da M1a (tek yükümlülük kuyruğu) ve M1e (taksit kartı alttaki borcu tüketir) satırları (python ile ara).")
w("   OKUNMAZ (prensip §3 bağımsızlık): `docs/devir/2.5.0-DEVAM/` altındaki *-rapor.md, *-istem.txt, *-ek.txt, *-kararlar.md dosyaları (bu görevin karar dosyası HARİÇ — aşağıda), `docs/2.5.0-IS-LISTESI-KAYIT.md`, `docs/kanit/2026-11-2*/` altındaki ajan ve ana oturum çıktıları, `docs/erp/C7B-FATURA-TASARIM.md` §18–§21'in 'sonuç / ölçüm' alt başlıkları (tasarım kuralını okuyabilirsin). Kodu ve testleri farktan oku.")
w(f"4. TEMİZ büyük veri (OKUNUR; kendi kopyanı al): `{SP}/ana-kabul/` (temiz-100k). v2.4.9 verisi: eski sürümün GERÇEK koduyla üret (`git -C {REPO} worktree add --detach <klasör> v2.4.9`).")
w(f"5. Not defteri: `{SP}/dk-tek-<kısa>` (ders 25). Eski kod kopyası `git -C {REPO} archive <commit> ':!docs/kanit' | tar -x -C <klasör>` + node_modules bağı; eski sürüm ETİKETİ isteyen test için `git -C {REPO} worktree add --detach <klasör> <ref>`, bitince `git -C {REPO} worktree remove --force <o tam yol>` (ders 54: `GIT_DIR` / `GIT_WORK_TREE` VERME). Biten kopyanı TAM yoluyla sil; `df -h /` 5 GB'ın altına düşürme; aynı anda en çok BİR eski kopya.")
w("")
w("## Kapsam (DURMA KURALI — yalnız bu beş fark; her biri birleşimin ilk ebeveynine göre)")
for c, ad in BIR:
    w(f"- `git diff {c}^1 {c} -- server client test docs/kilavuz ':!test/bagimsiz' ':!docs/kanit'` — {ad}.")
w(f"Aradaki 7af0f4b4 (Ç6-HESAP tur 4 + 5: mali tablolar, değerleme dondurma, göç 54) AYRI dar kontrolden geçti — KAPSAM DIŞI; ama beş farkın TOPLAM etkisini `{M4}` üzerinde değerlendir (bir turun düzelttiğini sonraki tur bozmuş mu). Cari kâhini (test/bagimsiz) KAPSAM DIŞI.")
w("")
w("## İLK MADDELER (önce bunlar)")
w("1. KAPI GÜVENLİK ÇEKİRDEĞİ (izleyen tur 3, K9): kapsam süzgecinin gevşetmesi kapı dışı (program dışından / store dışından) değişikliği ya da kilitli dönem yazımını kaçırıyor mu? Zorla üret: aynı rowid'e yeni kimlik (açık / kilitli), Düzenle'nin yeniden kullandığı rowid'in miktar değişimi, silinip aynı kimlikle geri yazılan kilitli satır, savepoint'te geri alınmış INSERT'ün rowid'i sonra UPDATE SET id, iç içe işlem, toplu yükleme / geri yükleme / göç yolu. Her senaryoda süzgeç yolu ↔ tam kapı (test kipinde eşdeğerlik denetimi açık) sonucu, 409 kodu ve Mutabakat Testi bulgusu iki kodda (birleşim öncesi / sonrası) aynı mı.")
w("2. `open` ALANININ ANLAMI (S229 / S230, K2): bu alanı okuyan HER yol (`server/` ve `client/` ve mobil özet taramasıyla — `.open`, `open:`, `\"open\"`) — gösterim mi istiyor, yoksa SINIR / KAPAMA / PARA için faturanın kendi açığını mı (`ownOpen`); izleyen turlarda eklenen yollar dahil. Her biri için betikle iki kodda aynı işlem: sınır / kapama aynı mı (veri tabanından, ders 3).")
w("3. KART KAPSAMI TEK YARDIMCIDA (K7 (2), S110 / S120 / S243): Tek Yükümlülük Kuyruğu, kapama defteri, iade, iptal, Düzenle ve gecikmiş aynı kapsam seçimini mi okuyor — iki faturalı cari (A 600 01.09, B 600 02.09, elle kart 600 03.09), aynı caride iki kart, elle borç + fatura karışık (S200), şüpheli kaydı (S213). Kart, kartın kendi hesabı ve kuyruk görünümü AYNI sayı mı.")
w("4. KÜÇÜLME / BÜYÜME SIRALARI (ders 17): iade → iade iptali (S238: aynı taksite), iade Düzenle'si (kayıtlı taksitlere), faturasız stok iadesi düzelt / sil / Silinenler'den geri yükle, fatura Düzenle ile azaltma (S241: kartın açık kalanını aşan kısım avans) ve artırma (S242 Mevcut Borç kartında; S246 = B kendi kartında yeniden kurulur), Kartı Kapat 'Borçta Kalsın' sonrası (S234 / S235 / S237), kart silinip geri alınınca. Her adımda kart toplamı / tahsil / kalan / gecikmiş, taksit satırları, carinin bakiyesi ve avansı veri tabanından; yedek → geri yükleme sonrası aynı mı (yeni kayıt alanları yedekte taşınıyor mu).")
w("5. CANLI YENİLEME VE ÖNBELLEK: iki oturum (yönetici + gözcü) — stok iadesi, fatura iadesi / iptali / Düzenle, Kartı Kapat sonrası gözcünün kart penceresi, Taksitler listesi, Faturalar listesi, cari kartı ve zil bayat kalıyor mu. ÖZELLİKLE: iadeden sonra kart penceresi GET önbellekten (~2 ms) dönüyor — önbellek her küçülme / büyüme / geri yükleme / Düzenle yolunda doğru anda boşalıyor mu (bayat kart = yanlış sayı).")
w(f"6. BEKLENTİSİ DEĞİŞEN TESTLER (ders 28, G3): her birleşim için `git diff --diff-filter=M <c>^1 <c> -- test ':!test/bagimsiz'` — değişen her beklenti bir karar metniyle mi geldi, yoksa bir gerilemeyi mi örtüyor? İki kodda koşup eski / yeni sayıyı KENDİN hesapla.")
w("7. TESTİN DİŞİ (prensip §3): yeni testler kendi birleşiminin ilk ebeveyninde BEKLENEN NEDENLE kırmızı mı (ders 38, 51). YENİ MUTANT YAZMAK ZORUNLU DEĞİL; yaşayan mutant / eksik test KULLANICI KURALIYLA 'SONRAKİ SÜRÜME (2.5.1)'e.")
w("8. S223 + S231 AD EŞLEŞMESİ (K10–K13, S223 / S228 / S231 / S232): Türkçe büyük / küçük harf (İ / i, I / ı, Ş, Ğ, Ü, Ö, Ç) ve kırpma / çoklu boşluk farklı yazımlarla cari Excel, taksit Excel, Tablodan Aktar ve çek / senet içe aktarması — çift cari / çift grup açılıyor mu, borç DOĞRU cariye mi yazılıyor (veri tabanından), var olan çift carilerde (S228 = A) hangi cari seçiliyor; aynı dosyada iki yazım (önbellek anahtarı); Tablodan Aktar Geri Al var olan grubu siliyor mu; kişi adı ortak yardımcısını kullanan öbür yollar (rol / kullanıcı adı) değişmedi mi (ders 10).")
w("")
w("## Ne ara (sonra)")
w(f"- GERİLEME: raporun EN BAŞINDA ayrı başlıkla. Mevcut Borç kartı OLMAYAN cari / faturaların bütün çıktıları 85f70cda^1 ↔ {M4[:8]} BİREBİR mi (temiz büyük veri; v2.4.9 verisi; iki saat dilimi) — Ç6 farkı (mali tablolar) hariç.")
w("- Gün / ay / yıl dönümü, iki saat dilimi (TZ=UTC ve Europe/Istanbul), kilitli dönem, ileri tarih, iki şirket.")
w("- YETKİ: her rol × fatura kartı / Faturalar listesi / Açık Faturalar / stok iadesi / Silinenler; reddedilen istek veri tabanında iz bırakıyor mu.")
w("- HIZ (ders 47): değişen yollarda öğe başına ağır okuma / kart başına alt sorgu var mı (temiz büyük veride olay döngüsü en çoğu ile; ölçüm için `flock -x` kilit dışarıda — ana oturumun ölçümü sürüyorsa bekle).")
w("")
w("## BAŞ MİMAR KARARLARI — DEĞERLENDİR (karar metnine uyuyor mu; betikle göster)")
for ad, metin in BM:
    w(f"- {ad}: {metin}")
w("")
w("## KULLANICI KARARLARI")
w(f"İş listesinden AYNEN çekilmiş karar metinleri ayrı dosyada: `{KYOL}` — TAMAMINI oku (05.11 (4) + (6); D 11.11 03:15 / 06:35 / 20.11 20:14; sorular: " + ', '.join(f'S{n}' for n in SORULAR) + "). Kural seçilen seçeneğin metnidir; S244 / S245 / S247 / S248 = C (BİLİNEN SINIR) — bu dört alt durumda bulgu YAZILMAZ, yalnız bakiye bozuluyorsa yazılır.")
w("")
w("BULGU SINIFI — KULLANICI KURALI (bu dar kontrolde GEÇERLİ; CLAUDE.md'den AYNEN): " + BIRAK[0])
w("Bu kurala göre: programın davranışını / sayılarını / hızını ya da kullanıcının gördüğünü DEĞİŞTİRMEYEN husus DÜŞÜK'tür ve raporun 'SONRAKİ SÜRÜME (2.5.1)' başlığına yazılır; programı ya da kullanıcıyı etkileyen her bozulma (yanlış para / bakiye / kapama / önerilen tutar / rapor toplamı / bayat ekran, yanlış ileti, gerileme, veri kaybı, kapının kaçırdığı değişiklik) eskisi gibi YÜKSEK / ORTA. Ç5-A DAR KONTROL SÜREÇ KURALI benzeri: 'veri tabanına program dışından yazılırsa fark edilmiyor' türü bulgu programın KENDİ yollarından üretilemiyorsa DÜŞÜK; ama kapı tabanda yakaladığı bir şeyi artık yakalamıyorsa (gerileme) YÜKSEK. Ayrıntıya boğulma: önce İLK MADDELER, sonra kalan süre kadar genel liste.")
w("")
w("## Yöntem (prensip §3)")
w("- Her bulgu betikle GERÇEK programda üretilir; çıktıda sayı olur. Program başlatırken `HUKUK_LICENSE_URL=http://127.0.0.1:9`. Üretilemeyen kuşku 'DOĞRULANMADI'ya.")
w("- Eski kod yalnız ayrı kopyada (ders 23, 51); gerilemenin HANGİ birleşimle geldiğini yaz.")
w(f"- Ölçüm DIŞI HER koşu (tek test dahil) `flock -s -w 3600 {SP}/olcum.lock timeout -k 5 <sn> <komut>` (süre sınırı flock'un İÇİNDE; ana oturumun özel kilitli ölçümü sürerken koşun bekler — bekle, kilitsiz koşma). HER arka plan koşusu açık süre sınırıyla (en çok 2 saat; içinde bekleme döngüsü YOK — ders 50). Önce `cat /proc/loadavg`; 4'ün üstündeyse yeni koşu başlatma, tek seferlik bekle. Aynı anda en çok BİR yük koşusu.")
w("- KAPSAYICI SIK YENİLENİYOR: koşuları ≤ 40 dk parçalara böl; her parçanın bulgusunu ve sayılarını not defterindeki `rapor-taslak.md`'ye HEMEN yaz (commit YOK).")
w("- `pkill` / `killall` / joker `rm` YOK; yalnız KENDİ pid'in. Tam `npm test` YOK. Koşular `KANIT_DIR=<kendi not defteri klasörün> node tools/kanit.mjs kos dktek-<ad> -- <komut>`. Çıktılar depoya commit EDİLMEZ.")
w("- PARA / KAPAMA KURALI AYRIŞMASI (ders 43): iki okumaya açık bir kural bulursan düzeltme önerme — KULLANICIYA SORULMALI (iki seçenek + öneri; uç durumsa üçüncü seçenek 'Uç durum böyle kalsın (BİLİNEN SINIR)'). Önce iş listesi C / D'de aynı soru sorulmuş mu ARA (yalnız C ve D; KAYIT okunmaz); sorulmuşsa numarasını yaz. Her alt durumda bakiyenin iki okumada aynı olup olmadığını SAYIYLA yaz.")
w("- SAKINCA SÜZGECİ: her DÜŞÜK için yaz — yanlış para / bakiye / kapama / önerilen tutar, bayat ekran, veri kaybı ya da gerileme mi? Öyleyse ORTA say.")
w("- Kendi arka plan işin sürerken turunu rapor vermeden BİTİRME (turunu 'bekliyorum' diye kapatma).")
w("")
w("## Rapor (prensip §3 biçimi; SubagentHandback ile)")
w("EN BAŞTA: GERİLEMELER (varsa; hangi birleşimle geldiği). Sonra İLK MADDELER 1–8'in sonucu tek tek (2. maddede `open` okuyan her yolun listesi: dosya:satır, gösterim / sınır, sonuç). Sonra her bulgu — sınıf (YÜKSEK / ORTA / DÜŞÜK), dosya:satır, betik + çıktı (sayılarla), kök neden, en küçük düzeltme önerisi; K1–K13 değerlendirmesi; KULLANICIYA SORULMALI; SONRAKİ SÜRÜME (2.5.1); DOĞRULANMADI; DENENMEYEN; not defteri klasörlerin (tam yol). Bulgu yoksa açıkça 'YÜKSEK / ORTA YOK'.")
open(OUT, 'w', encoding='utf-8').write('\n'.join(p) + '\n')
print(len('\n'.join(p)), len('\n'.join(k)))
