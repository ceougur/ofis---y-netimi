# ANA OTURUM — TEK ADAY (Ç5-A tur 3 + Ç7a + Ç5-A tur 2f + hız düzeltmesi) TEK DAR KONTROL görev metni üreteci (prensip §9 iskeleti).
# Kararlar iş listesinden AYNEN; düzeltme ajanlarının raporları / görev metinleri / KAYIT kayıtları VERİLMEZ (prensip §3).
# Çağrı: cd <depo>; python3 -I <bu> <çıktı> <birleşim commit'i>
import sys
OUT, M = sys.argv[1], sys.argv[2]
SP = '/tmp/claude-0/-home-user/de5e1cbf-7e68-5683-b7bb-f27655eaed4f/scratchpad'
t = open('docs/2.5.0-IS-LISTESI.md', encoding='utf-8').read()
il = t.split('\n')
D = t[t.find('\n## D'):]
dent = D.split('\n- ')[1:]
cl = open('CLAUDE.md', encoding='utf-8').read().split('\n')

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

SUREC = [l.strip() for l in cl if l.strip().startswith('Ç5-A DAR KONTROL SÜREÇ KURALI')]
assert len(SUREC) == 1
d1357 = dkayit('BAŞ MİMAR KARARI 14.11 13:57')
d1213 = dkayit('BAŞ MİMAR KARARI 14.11 12:13')
d1017 = dkayit('BAŞ MİMAR KARARI 14.11 10:17')
d1637 = dkayit('BAŞ MİMAR KARARI 19.11 16:37')
K1 = kes(d1357, '(1) ajanın iki tasarım seçimi KABUL', 'yalnız çift düzeltmede fark eder).')
K2 = kes(d1213, '(1) ajanın BAŞ MİMAR KARARI 1', "BİLİNEN SINIRLAR'ına.")
K3 = kes(d1213, '(2) ajanın BAŞ MİMAR KARARI 2', 'teslim notuna yazılır.')
K4 = kes(d1017, '(2) BAŞ MİMAR — LİSTE / RAPOR TUTARLILIĞI', 'seçilmedi.')
K5 = kes(d1017, '(3) Pasif hesabın da sınırda sayılması KABUL', 'değiştirmemeli).')
K6 = kes(d1637, '(1) ALT HESAP MİZANI', "kullanıcı isterse 2.5.1'e.")
TUR3 = [136, 137, 138, 141, 155, 160, 161, 167, 168, 181]
C7A = [175, 177, 178, 179, 182, 183, 184, 187, 188, 189, 190, 191, 192]
T2F = [174, 180, 185, 186, 196]

p = []; w = p.append
w(f"Sen DestekOfis projesinde bağımsız DAR KONTROL incelemecisisin (2.5.0 — TEK ADAY: Ç5-A tur 3 (şüpheli ↔ kuyruk), Ç7a (banka türetme kuralları), Ç5-A tur 2f (Kural Farkı Düzeltme Fişi yıl kuralı), tek aday hız düzeltmesi). Yalnız HATA ararsın. Düzeltme, commit ve push YAPMAZSIN. PARA ÇEKİRDEĞİ (defter) — eforun high. Yanıtın Türkçe. Zamanlanmış görev KURMA.")
w("")
w("## Hazırlık")
w(f"1. Worktree'de ÖNCE `git reset --hard {M}` (incelenecek birleşim; ilk ebeveyni birleşim öncesi kod). Kendi commit'in olmayacak.")
w(f"2. `ln -s /home/user/ofis---y-netimi/node_modules node_modules` (`npm ci` YOK). Tarayıcı: `PLAYWRIGHT_BROWSERS_PATH={SP}/pw-1194`.")
w("3. ÖNCE oku: `CLAUDE.md` (anayasa + dersler 1–54); `docs/BAGIMSIZ-DOGRULAMA-PRENSIBI.md` (tamamı; §3 senin kuralların); muhasebeleştirme kural kitabında KG-6, KG-19, K-07, K-14, K-15, D-07, M7, M13 ve şüpheli (128 / 129) satırları (python ile ara); tasarım notlarının KURAL bölümleri: `docs/erp/C5-ACILIS-TASARIM.md` §2–§4 ve §17 (§17.x alt bölümlerindeki 'ajan yaptı' anlatımları kanıt DEĞİL — kodla karşılaştır).")
w("   OKUNMAZ (prensip §3 bağımsızlık): `docs/devir/2.5.0-DEVAM/` altındaki *-rapor.md ve *-istem.txt / *-ek.txt dosyaları (düzeltme ajanlarının raporları ve görev metinleri), `docs/2.5.0-IS-LISTESI-KAYIT.md`, `docs/kanit/2026-11-1[0-9]/` altındaki ajan ve ana oturum çıktıları. Kodu ve testleri farktan oku.")
w(f"4. TEMİZ büyük veri (OKUNUR; kendi kopyanı al): `{SP}/ana-kabul/` (temiz-100k).")
w(f"5. Not defteri: `{SP}/dk-t3c7a-<kısa>` (ders 25). Eski kod kopyası `git -C /home/user/ofis---y-netimi archive {M}^1 ':!docs/kanit' | tar -x -C <klasör>` + node_modules bağı; eski sürüm ETİKETİ isteyen test için `git -C /home/user/ofis---y-netimi worktree add --detach <klasör> <ref>`, bitince `git -C /home/user/ofis---y-netimi worktree remove --force <o tam yol>` (ders 54: `GIT_DIR` / `GIT_WORK_TREE` VERME). Biten kopyanı TAM yoluyla sil; `df -h /` 5 GB'ın altına düşürme; aynı anda en çok BİR eski kopya.")
w("")
w("## Kapsam (DURMA KURALI — yalnız bu fark)")
w(f"`git diff {M}^1 {M} -- server client test docs/kilavuz ':!test/bagimsiz'` — dört bölüm: (A) Ç5-A tur 3 — şüpheli kaydı açık caride faturaya bağlı tahsilatın 120 / 128 dağılımı (tek kuyruk), etiketin üç hâli, Alacak Yaşlandırma; (B) Ç7a — K-14 / K-15 (hesabı atanmamış eski hareketler ve açılış sınırı, 519, 'Açılışta Sayıldı'), KG-6 (POS komisyonu satış gününde), kart faizi formu; (C) Ç5-A tur 2f — Kural Farkı Düzeltme Fişi'nin kilit ileri / geri alınınca davranışı; (D) hız düzeltmesi — davranış DEĞİŞMEMELİ (cari kartı, Cari Listesi, şüpheli ↔ kuyruk ayırıcısı, cari kuyruğu). Muhasebe sürücüsü ve kâhinler (test/bagimsiz) KAPSAM DIŞI.")
w("")
w("## İLK MADDELER (önce bunlar)")
w("1. AYNI GÜN bağlı tahsilatlar (ders 31): aynı tarihte birden çok faturaya bağlı / şüpheli carisinde tahsilat — 120 / 128 dağılımı, etiket ve gecikmiş, sıranın KİMLİKLE mi yazım sırasıyla mı kurulduğuna bağlı mı? Sınıf içi sıranın toplamı değiştirmediğini betikle göster ya da çürüt.")
w("2. Tur 3'ün mutantları: kendi kopyanda test dosyalarının mutasyon araçlarını koş (`test/` altında *mutasyon*250* adlı dosyalar); her mutant birkaç kez — ARA SIRA yaşayan mutant var mı (tohum / saat / sıra bağımlılığı)?")
w("3. Ç7a'nın mutantları: yakalananlar DEĞERLE mi (sayı karşılaştırması) yoksa yalnız kapının reddiyle mi (istek reddedildi → test geçti) yakalanıyor? Yalnız redle yakalanan her mutant için kapıyı devre dışı bırakınca (kendi kopyanda) değer testi var mı?")
w("4. Mutabakat motorunun test modeli (testlerdeki banka / POS 108 modeli) KG-6 için ürünle AYNI elden değişti — kâhin sayılmaz (ders 5, 32). KG-6'yı kural kitabının satırından ELLE hesapla ve programla karşılaştır (komisyonun günü, tutarı, BSMV dahil / KDV kipi, valör günü aktarımı, iade / iptal).")
w("5. 'Banka ve POS (Tümü)' raporunun toplamı ile 'Hesabı Atanmamış' kovası / banka raporlarının toplamları — aşağıdaki BAŞ MİMAR KARARI K2 ve K4'e göre tutarlı mı?")
w("6. Hız düzeltmesinin EŞDEĞERLİĞİ: birleşim öncesi ↔ sonrası cari kartı, Cari Listesi, Alacak Yaşlandırma, Vade Takip, zil, taksit listesi çıktıları BİREBİR mi (temiz büyük veri + şüpheli / bağlı tahsilatlı / taksitli / silinmiş kayıtlı / iki şirketli küçük veri; iki TZ). Değişen sorgular ANA DALDA da çalışan yolları değiştiriyor — en riskli yer burası.")
w("")
w("## Ne ara (sonra)")
w("- GERİLEME: raporun EN BAŞINDA ayrı başlıkla. Bu işlerin dokunmadığı bütün defter ve cari çıktıları birleşim öncesi ↔ sonrası BİREBİR mi (temiz büyük veri; v2.4.9 kilitli verisi — eski sürümün GERÇEK koduyla üretilmiş; iki saat dilimi).")
w("- RASTGELE SIRA (ders 17): fatura / bağlı tahsilat / şüpheliye alma / Şüpheliden Çıkar / taksit kartı / silme-geri alma; banka hesabı açma ↔ hesapsız hareket ↔ Devir Kapanışı ↔ kilit; Kural Farkı fişi ↔ kilit ileri / geri ↔ ters kayıt — farklı permütasyonlarda defter ve ekran aynı mı; yıl dönümü ve ayın 1'i (ders 13; sahte saat).")
w("- EŞZAMANLILIK: iki kullanıcı aynı cariye aynı anda bağlı tahsilat; POS çekimi ile valör aktarımı aynı anda; aynı anda Kural Farkı fişi.")
w("- SİLİNENLER / YEDEK / İKİ ŞİRKET / GÖÇ: yedek → geri yükle → aynı sayılar; v2.4.9'dan göç; iki şirket.")
w("- YETKİ: her rol × her yeni uç; reddedilen istek veri tabanında iz bırakıyor mu.")
w("- TEST DİŞİ: yeni testler birleşim öncesi kodda BEKLENEN NEDENLE kırmızı mı (ders 38, 51); kendi kopyanda en az 8 YENİ mutant (dört bölümden en az ikişer) — yaşayan her mutant eksik testtir.")
w("- G2 KOMŞU: değişen işlevlerin BÜTÜN çağıranları (`test/` ve `server/` taramasıyla); değişen ekran yollarının e2e senaryoları.")
w("")
w("## BAŞ MİMAR KARARLARI — DEĞERLENDİR (karar metnine / kitaba uyuyor mu; betikle göster)")
w("- K1 (tur 2f): " + K1)
w("- K2 (Ç7a): " + K2)
w("- K3 (Ç7a): " + K3)
w("- K4 (Ç7a): " + K4)
w("- K5 (Ç7a): " + K5)
w("- K6 (hız): " + K6)
w("")
k = []
k.append("# TEK ADAY DAR KONTROLÜ — KULLANICI KARARLARI (iş listesinden AYNEN; ana oturum üretti)")
k.append("Soru metinlerindeki 'program bugün' / 'bugünkü' sözleri ve sayılar soru anının bilgisidir; kural seçilen seçeneğin metnidir.")
k.append("## (A) Ç5-A tur 3")
for n in TUR3: k.append(soru(n))
k.append("## (B) Ç7a")
for n in C7A: k.append(soru(n))
k.append("## (C) Ç5-A tur 2f")
for n in T2F: k.append(soru(n))
KOUT = OUT.replace('-istem.txt', '-kararlar.md'); assert KOUT != OUT
open(KOUT, 'w', encoding='utf-8').write('\n'.join(k) + '\n')
w("## KULLANICI KARARLARI")
w(f"İş listesinden AYNEN çekilmiş karar metinleri ayrı dosyada: `/home/user/ofis---y-netimi/{KOUT}` — TAMAMINI oku (tur 3: S136–S138, S141, S155, S160, S161, S167, S168, S181; Ç7a: S175, S177–S179, S182–S184, S187–S192; tur 2f: S174, S180, S185, S186, S196). Kural seçilen seçeneğin metnidir.")
w("")
w("SÜREÇ KURALI (kullanıcı kararı — bu dar kontrolde GEÇERLİ; CLAUDE.md'den AYNEN): " + SUREC[0])
w("")
w("## Yöntem (prensip §3)")
w("- Her bulgu betikle GERÇEK programda üretilir; çıktıda sayı olur. Program başlatırken `HUKUK_LICENSE_URL=http://127.0.0.1:9`. Üretilemeyen kuşku 'DOĞRULANMADI'ya.")
w("- Eski kod yalnız ayrı kopyada (ders 23, 51).")
w(f"- Yük koşuları `flock -s -w 3600 {SP}/olcum.lock …` (tek seferlik bekleme). HER arka plan koşusu açık süre sınırıyla (`timeout -k 5 <sn> …`, en çok 2 saat; içinde bekleme döngüsü YOK — ders 50). Önce `cat /proc/loadavg`; 4'ün üstündeyse yeni koşu başlatma, tek seferlik bekle. Aynı anda en çok BİR yük koşusu.")
w("- `pkill` / `killall` / joker `rm` YOK; yalnız KENDİ pid'in. Tam `npm test` YOK. Koşular `KANIT_DIR=<kendi not defteri klasörün> node tools/kanit.mjs kos dkt3-<ad> -- <komut>`. Çıktılar depoya commit EDİLMEZ.")
w("- PARA / DEFTER KURALI AYRIŞMASI (ders 43): iki okumaya açık bir kural bulursan düzeltme önerme — KULLANICIYA SORULMALI (iki seçenek + öneri; uç durumsa üçüncü seçenek 'Uç durum böyle kalsın (BİLİNEN SINIR)'). Önce iş listesi C / D'de aynı soru sorulmuş mu ARA (yalnız C ve D; KAYIT okunmaz); sorulmuşsa numarasını yaz. Her alt durumda mizanın iki okumada aynı olup olmadığını SAYIYLA yaz.")
w("- SAKINCA SÜZGECİ: her DÜŞÜK için yaz — yanlış para / bakiye / defter, veri kaybı, KVKK ya da gerileme mi? Öyleyse ORTA say.")
w("- Kapsayıcı yenilenirse kesilirsin; ara sonuçlarını not defterine düzenli yaz. Kendi arka plan işin sürerken turunu rapor vermeden BİTİRME.")
w("")
w("## Rapor (prensip §3 biçimi; SubagentHandback ile)")
w("EN BAŞTA: GERİLEMELER (varsa). Sonra İLK MADDELER 1–6'nın sonucu tek tek. Sonra her bulgu — sınıf (YÜKSEK / ORTA / DÜŞÜK; SÜREÇ KURALI'na göre), dosya:satır, betik + çıktı (sayılarla), kök neden, en küçük düzeltme önerisi; permütasyon / eşzamanlılık / yetki tabloları; birleşim öncesi ↔ sonrası eşdeğerlik; yeni mutantların sonucu; K1–K6 değerlendirmesi; KULLANICIYA SORULMALI; DOĞRULANMADI; DENENMEYEN; not defteri klasörlerin (tam yol). Bulgu yoksa açıkça 'YÜKSEK / ORTA YOK'.")
open(OUT, 'w', encoding='utf-8').write('\n'.join(p) + '\n')
print(len('\n'.join(p)))
