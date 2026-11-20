# ANA OTURUM — TOPLU KÂHİN BAKIMI (Ç7b paketinin sonu): muhasebe kâhini bakımı 14 + cari kâhini bakımı 22 — karar girdisi ve görev metni üreteci.
# Kararlar iş listesinin C bölümünden AYNEN (devam satırlarıyla — bakım 21 dersi) çekilir; KAPSAM satırlarını baş mimar yazdı (kural vermez, kararın metnini kâhinin diline bağlar).
# Ders 5: girdiye programın dosya adı, kod davranışı, sınama sayısı, programın ürettiği değer GİRMEZ (soru metinlerindeki 'program bugün' sözleri OKUMA KURALI ile etkisiz).
# Çağrı: cd <depo>; python3 -I <bu> <girdi çıktısı> <görev metni çıktısı> <taban dalı>
import sys, re
G_OUT, I_OUT, TABAN = sys.argv[1], sys.argv[2], sys.argv[3]
SP = '/tmp/claude-0/-home-user/de5e1cbf-7e68-5683-b7bb-f27655eaed4f/scratchpad'
t = open('docs/2.5.0-IS-LISTESI.md', encoding='utf-8').read()
il = t.split('\n')
D = t[t.find('\n## D'):]
dent = D.split('\n- ')[1:]

def blok(basla):
    h = [i for i, l in enumerate(il) if l.startswith(basla)]; assert len(h) == 1, (basla, len(h))
    s = h[0]; e = s + 1
    while e < len(il) and il[e].startswith('  ') and not re.match(r'  (S\d+[ =(]|\(\d+\) )', il[e]): e += 1
    return ' '.join(x.strip() for x in il[s:e])

def soru(n):
    return blok(f'  S{n} (')

def dkayit(onek):
    x = [e for e in dent if e.startswith(onek)]
    assert len(x) == 1, (onek, len(x))
    return x[0].strip()

q = {n: soru(n) for n in [120, 188, 191, 193, 200, 205, 210, 211, 213, 219, 220, 221, 222]}
d0631 = dkayit('KULLANICI 14.11 06:31 UTC')
d2011 = dkayit('KULLANICI KARARI 20.11 09:00 UTC')

g = []; w = g.append
w("# Toplu kâhin bakımı — muhasebe kâhini bakımı 14 + cari kâhini bakımı 22 — karar girdisi (ana oturum yazdı; TEK girdi kaynağın)")
w("")
w("Bu dosya, muhasebe kâhininin bakım 13'ünden ve cari kâhininin bakım 21b'sinden sonra yanıtlanan, iki kâhine dokunan soruların kararlarını taşır (Ç7b paketinin son bakımı).")
w("OKUMA KURALI: soru metinlerinde geçen 'program bugün', 'koşuldu', 'tur …', 'test', 'mutant', 'kod değişmez', 'kodlanan' sözleri ve oradaki program gözlemleri KURAL KAYNAĞI DEĞİLDİR — kural")
w("yalnız KARAR satırlarıdır (seçilen seçeneğin metni ve kararın kendi örneği) ve aşağıdaki KAPSAM satırlarıdır. Kararın söylemediği alt durumda kural UYDURULMAZ: o alanda SUS ve raporun")
w("'KULLANICIYA SORULMALI' listesine yaz (ders 40, 43). Etiketler: 'KULLANICI KARARI', 'KULLANICI KURALIYLA ÖNERİ UYGULANDI' (kullanıcının 14.11 06:31 kuralıyla öneri seçildi — kullanıcı")
w("değiştirebilir), 'BAŞ MİMAR KARARI' / 'BAŞ MİMAR YORUMU' (kullanıcıya gösterildi; aynı etiketle yaz). Kullanıcının 06:31 kuralı (AYNEN):")
w(d0631)
w("Kullanıcının 20.11 09:00 kuralı (AYNEN; kâhin iç bakımı için de geçerli — bakiyeyi / sayıları değiştirmeyen kâhin iç düzeni bu bakımda KOVALANMAZ, raporun 'SONRAKİ SÜRÜME (2.5.1)' başlığına yazılır):")
w(d2011)
w("")
w("## A. MUHASEBE KÂHİNİ (`test/bagimsiz/muhasebe/`)")
w("")
w("### A1. S120'nin ölçüsü: kart tutarı elle borçların toplamından BÜYÜK (S200 = A)")
w("SORU + KARAR S120 (AYNEN):"); w(q[120])
w("SORU + KARAR S200 (AYNEN):"); w(q[200])
w("KAPSAM (baş mimar): bakım 13 bu alanda soruyu sordu; kararın metni 'Kâhin bakım 13\'te A ile kuruldu' diyor, ama kâhinin README\'sinde bu alan hâlâ SUS / soru olarak duruyorsa (kendi README\'nden doğrula, ikisinden hangisi doğruysa yorumda yaz) şimdi KUR; kuruluysa senaryoyla göster — elle açılan taksit kartı önce elle borçları eskiden yeniye içine alır, eksik kalan kısmı faturalardan "
  "(kararın örneği: F1 50.000 + elle borç 30.000, kart 60.000 → 16.02'de gecikmiş 20.000; kartın kalanının gecikmişi kartın kendi vadesinden). Kararın örneğini senaryo yap; kâhinin "
  "çıktısında fatura başına kalan (açık fatura görünümü) varsa F1'in kalanı ne olur — kararın metninden ÇIKIYORSA yaz, çıkmıyorsa o anahtar SUS + KULLANICIYA SORULMALI (ders 43; "
  "programın bu anahtardaki değeri sana VERİLMEZ).")
w("")
w("### A2. Taksitler (Mevcut Borç) kartının içine aldığı faturanın iptali (S210 = A, S211 = A)")
w("SORU + KARAR S210 (AYNEN):"); w(q[210])
w("SORU + KARAR S211 (AYNEN):"); w(q[211])
w("KAPSAM (baş mimar): iki soru cari kâhininin bakım 21b'sinden çıktı; muhasebe kâhininin dili kartı ve fatura iptalini taşıyorsa kararın iki örneğini senaryo yap (bakiye, gecikmiş, 120 / "
  "avansın hesabı); taşımıyorsa yalnız yorum + DENENMEYEN.")
w("")
w("### A3. Açık Faturalar raporu şüpheliye alınmış faturayı gösterir (S213 = B)")
w("SORU + KARAR S213 (AYNEN):"); w(q[213])
w("KAPSAM (baş mimar): şüpheliye alınmış fatura açık fatura görünümünde KALIR (kalanıyla); kâhinin dilinde satır için 'Şüpheli' işareti yoksa yalnız listeleme kuralı. Bakım 13'te bu "
  "alanda farklı bir okuma kurulduysa eski → yeni G3'te.")
w("")
w("### A4. Uç durumlar — kâhin SUSAR (S188 = C, S191 = C, S193 = C)")
w("SORU + KARAR S188 (AYNEN):"); w(q[188])
w("SORU + KARAR S191 (AYNEN):"); w(q[191])
w("SORU + KARAR S193 (AYNEN):"); w(q[193])
w("KAPSAM (baş mimar): üç alanda kâhin SUSAR (karar 'uç durum böyle kalsın'); kâhin bugün bu alanlarda beklenen yazıyorsa SUS'a çevir (anahtar adıyla), zaten susuyorsa yalnız yorumda doğrula.")
w("")
w("### A5. Kartı Kapat 'Borçta Kalsın' — önceden gecikmiş kalemin vadesi (S205 = A, S220 = A)")
w("SORU + KARAR S205 (AYNEN):"); w(q[205])
w("SORU + KARAR S220 (AYNEN):"); w(q[220])
w("KAPSAM (baş mimar): kapanıştan önce vadesi geçmiş kalem kendi vadesinde kalır; vadesi gelmemiş kalemler kapanış gününe çekilir (kapanışın ertesi gününden gecikmiş — S205). Kâhinin "
  "dili gecikmişi / gecikme yaşını taşıyorsa kararın iki durumunu (kapanış günü ve ertesi gün) senaryo yap; taşımıyorsa yalnız yorum + DENENMEYEN.")
w("")
w("### A6. Excel'den taksit kartı yüklemede aynı adlı kişiler (S219 = A, S221 = A, S222 = A)")
w("SORU + KARAR S219 (AYNEN):"); w(q[219])
w("SORU + KARAR S221 (AYNEN):"); w(q[221])
w("SORU + KARAR S222 (AYNEN):"); w(q[222])
w("KAPSAM (baş mimar): kâhinin dili Excel'den kart yüklemeyi taşıyorsa S221 / S222'nin iki durumunu senaryo yap (açılan / atlanan kart, bakiye, 120); taşımıyorsa yalnız yorum + DENENMEYEN.")
w("")
w("## B. CARİ KÂHİNİ (`test/bagimsiz/cari/`)")
w("")
w("### B1. S210 = A, S211 = A (bakım 21b'nin soruları SK-41 (a) / (b))")
w("Kararlar: yukarıda A2 (AYNEN).")
w("BİLGİ (ana oturum): cari kâhini ↔ program karşılaştırmasında bakım 21b'den beri yalnız d50'nin iki anahtarı ayrışıyor: KI2 ve KI3 toplam anahtarları (programın değerleri VERİLMEZ — ders 5). "
  "Kâhinin bu anahtarlardaki beklentisinin S210 / S211'in hangi okumasına dayandığını yorumda yaz.")
w("KAPSAM (baş mimar): bakım 21b'de bu iki alanda SUS ya da geçici okuma kurulduysa şimdi kararın A seçeneğini KUR (S210: kart kapanır, elle borç kendi vadesiyle carinin kuyruğuna döner, "
  "kartın tahsilatı avans; S211: kart kapanır); beklenenler ELLE, eski → yeni G3'te.")
w("")
w("### B2. S220 = A ve S221 / S222 — cari kâhininin dili")
w("Kararlar: yukarıda A5 ve A6 (AYNEN).")
w("KAPSAM (baş mimar): bakım 21'de Kartı Kapat cari kâhininin dilinde YOK diye SUS + 'SÜRÜCÜ İÇİN' bırakıldı (§32 C3) — DİL EKİ YAPMA; S220 için yalnız yorum. Excel'den kart yükleme dilde "
  "varsa S221 / S222 senaryosu, yoksa yalnız yorum.")
open(G_OUT, 'w', encoding='utf-8').write('\n'.join(g) + '\n')

p = []; w = p.append
w("Sen DestekOfis projesinde TOPLU KÂHİN BAKIMI ajanısın: MUHASEBE KÂHİNİ BAKIMI 14 (`test/bagimsiz/muhasebe/`) + CARİ KÂHİNİ BAKIMI 22 (`test/bagimsiz/cari/`) — 2.5.0, Ç7b paketinin son kâhin bakımı. PROGRAMIN KODUNU GÖRMEZSİN (ders 5, 40). KENDİ dalında commit edersin; PUSH YAPMAZSIN. Yanıtın Türkçe. Eforun high. Zamanlanmış görev KURMA. HER BİTMİŞ ADIM HEMEN COMMIT (kapsayıcı yeniden başlarsa commit'siz iş kaybolur); koşuları ≤ 40 dk parçalara böl, her parçanın kanıtını hemen 'Kanıt:' commit'iyle kaydet; rapor taslağını `docs/kanit/2026-11-20/kahintoplu14-rapor-taslak.md`'ye adım adım yaz.")
w("")
w("## Girdi")
w(f"Tek karar kaynağın: `{SP}/kahin-toplu14-kararlar.md` (TAMAMINI oku; A1–A6 muhasebe kâhini, B1–B2 cari kâhini). Dosyanın başındaki OKUMA KURALI bağlayıcıdır.")
w("")
w("## Hazırlık")
w(f"1. Worktree'de (dalında kendi commit'in YOKKEN) `git reset --hard {TABAN}` (yerel taban dalı; birleşim DEĞİL sıfırlama). `git log --oneline -2 -- test/bagimsiz/muhasebe` muhasebe kâhini bakımı 13'ü (e779340f), `git log --oneline -2 -- test/bagimsiz/cari` cari kâhini bakımı 21b'yi (a52d2768) göstermeli; değilse DUR ve raporla. `ln -s /home/user/ofis---y-netimi/node_modules node_modules` (`npm ci` YOK).")
w("2. ÖNCE oku: `CLAUDE.md` (dersler 1–54; özellikle 5, 6, 7, 31, 38, 40, 43, 54); `docs/BAGIMSIZ-DOGRULAMA-PRENSIBI.md`; girdi dosyası; `test/bagimsiz/muhasebe/README.md` içinde 'Kaynaklar', 'Senaryo dili', 'Model kapsamı', seçim tablosu, 'Değişmezler', 'KARAR GEREKİYOR', 'DENENMEYEN' ve bakım 12 + 13 bölümlerinin TAMAMI, ayrıca S120 / S155 / S168 / S181 / S188–S193 / KG-23 / Kartı Kapat / şüpheli geçen bölümler; `test/bagimsiz/cari/KARARLAR.md` §30–§33 TAMAMI ve S15 / S120 / S206 / Kartı Kapat / Excel geçen bölümler. Önceki kararlar YALNIZ kâhinlerin kendi README / KARARLAR.md'sinden okunur. Büyük dosyalarda tam okuma yerine başlık + arama.")
w("")
w("## Yasaklar (bağımsızlık)")
w("- `server/`, `client/`, `bulut/`, `packaging/`, `tools/` (kanit.mjs yalnız çalıştırılır), `docs/devir/**`, `docs/2.5.0-IS-LISTESI*.md` (HER sürümü — eski commit'teki hâli dahil), `docs/erp/` altında kâhinlerin kendi 'Kaynaklar' listesinde OLMAYAN her dosya, `test/bagimsiz/muhasebe-surucu/` (sürücü — programı koşar; OKUNMAZ, KOŞULMAZ), `test/bagimsiz/cari/YAPIM-ASAMASI.json` ve `BILINEN.json`, `test/` altında `test/bagimsiz/muhasebe` + `test/bagimsiz/cari` dışındaki her şey OKUNMAZ. Cari kâhininin `kos.mjs`'i programı koşar: yalnız olay / alan EŞLEMESİ için okunabilir, KOŞULMAZ, DEĞİŞTİRİLMEZ (`npm run test:kahin-cari`'yi ana oturum koşar).")
w("- `docs/kanit/` altında başka ajanların dosyaları ve git farkı / geçmiş içeriği açılmaz (kendi önceki bakım araçların HARİÇ — `docs/kanit/2026-11-19/kahinmuh13-arac/` ve cari kâhininin bakım 21b araçları; uyarlayıp `docs/kanit/2026-11-20/kahintoplu14-arac/` altına kopyala). Program KOŞULMAZ. CLAUDE.md'nin 'Açık iş' bölümünde programın durumu hakkında gördüğün hiçbir şey kural / beklenti kaynağı DEĞİLDİR.")
w("")
w("## İş")
w("1. ÖNCE YORUM (ders 40): muhasebe README'ye 'Kâhin bakımı 14', cari KARARLAR.md'ye '2.5.0 Ç5 bakımı 22' bölümü — girdinin her maddesi için kural başına yorum (hangi kural değişir, hangi alan SUS'a döner / SUS'tan çıkar, hangi beklenen değişir, kararın hangi sözüne dayanır), etiketler girdideki gibi. AYRI commit.")
w("2. Modele / senaryolara işle (girdinin KAPSAM satırlarıyla): A1 S200 (S120'nin ölçüsü); A2 S210 / S211; A3 S213; A4 SUS alanları; A5 S220; A6 S221 / S222; B1 S210 / S211; B2 yalnız yorum (dil eki YOK). Her yeni / değişen elle senaryoda beklenenler ELLE hesaplanır, hesap yorumda.")
w("3. Olay dilini değiştirmen GEREKİRSE (yeni alan / yeni olay türü) YAPMA — SUS + DENENMEYEN + raporda 'SÜRÜCÜ İÇİN' satırı. Var olan alanların anlamı değişiyorsa 'SÜRÜCÜ İÇİN'de alan alan yaz (sürücüyü ana oturum eşler).")
w("4. Mutantlar: her yeni / değişen kural için en az bir mutant (ör. 'S200: kart önce faturaları alır', 'S200: kart elle borçların toplamına küçülür', 'S210: kart açık kalır ve küçülür', 'S211: kart borçsuz açık kalır', 'S213: şüpheli fatura listeden düşer', 'S220: önceden gecikmiş kalem kapanış gününe çekilir'); önceki bakımların mutantları hâlâ yakalanıyor mu (yaşayan mutant adıyla; beklenen bedelse gerekçesiyle).")
w("5. G3: muhasebe kâhininde bakım 13'e, cari kâhininde bakım 21b'ye göre değişen / yeni / kalkan beklenenler senaryo senaryo (kendi önceki düzeninle); girdinin maddelerinin alanları DIŞINDA BEKLENMEYEN 0 olmalı. SUS'a dönen / SUS'tan çıkan her anahtar adıyla ve maddesiyle.")
w("6. TOPLU SORULAR: kararların söylemediği HER alt durumu raporun 'KULLANICIYA SORULMALI' bölümünde TEK listede ver (durum, en küçük örnek, iki okuma, her okumada bakiye; çok uç durumsa üçüncü seçenek 'Uç durum böyle kalsın (BİLİNEN SINIR)'); o alanlarda SUS. Önceki bakımlarda sorulanları YİNELEME.")
w("")
w("## Yöntem")
w(f"- Eski kâhin kopyası değişiklikten ÖNCE: `git archive HEAD test/bagimsiz/muhasebe test/bagimsiz/cari | tar -x -C {SP}/kahintoplu14-<kısa>/` (benzersiz klasör — ders 25); yeni senaryolar eski modelde BEKLENEN NEDENLE kırmızı (ders 7, 38) — iletisi okunur.")
w(f"- Kâhinlerin kendi testleri iki TZ (UTC, Europe/Istanbul): `KANIT_DIR=<kendi not defteri klasörün> node tools/kanit.mjs kos kahintoplu14-<ad> -- python3 -I -B <dosya>` (muhasebe: test_model.py, mutasyon.py; cari: oz-test ve mutasyon taraması — kendi README'sindeki komutlarla); mutasyon ve geniş tarama `flock -s -w 3600 {SP}/olcum.lock` ile (TEK SEFERLİK bekleme; döngü YOK); HER arka plan koşusu AÇIK SÜRE SINIRIYLA (`timeout -k 5 <sn> …`), uzun koşu baştan 2 saat sınırla; kanıt `docs/kanit/2026-11-20/kahintoplu14-*`.")
w("- Yük okuması ile koşu başlatma AYNI adımda gönderilmez: önce `cat /proc/loadavg`; yük > 3,5 ise koşu BAŞLATMA, tek seferlik bekleme komutuyla bekle (ör. `timeout 600 bash -c 'until [ \"$(cut -d\" \" -f1 /proc/loadavg | cut -d. -f1)\" -lt 3 ]; do sleep 20; done'`), sonra yükü yeniden oku. Başka bir ajan bellekte büyük veri tutuyor: `free -g`'de kullanılabilir bellek 2 GB'ın altındaysa yük koşusu başlatma. Bakım, kanıt koşuları (iki saat dilimi) yapılmadan BİTMİŞ sayılmaz. Disk 5 GB'ın altına düşürülmez (`df -h /`).")
w("- Test / araç koşusuna `GIT_DIR` / `GIT_WORK_TREE` VERME (ders 54); her koşudan sonra `git status -sb` + son commit oku.")
w("- Kendi arka plan işin sürerken turunu rapor vermeden BİTİRME; sonucu bekle, sonra raporla. /tmp üzerinde boyut ölçme / tarama komutu koşma. `pkill` / joker `rm` YOK. Commit'e yalnız kendi yolların (ders 44).")
w("- Commit iletisi sonunda tam olarak şu iki satır (model adı YOK):")
w("  ```")
w("  Co-Authored-By: Claude <noreply@anthropic.com>")
w("  Claude-Session: https://claude.ai/code/session_01EhegDvmPQ9hx2ibfitm6og")
w("  ```")
w("")
w("## Rapor (SubagentHandback, Türkçe)")
w("Madde madde yorum (A1–A6, B1–B2); SUS'a dönen / SUS'tan çıkan anahtarların TAM listesi (kâhin + senaryo + anahtar + madde); yeni / değişen elle senaryolar ve değerleri; SÜRÜCÜ İÇİN (anlamı değişen her şey; değişmediyse 'değişmedi'); mutantlar (yeni + eski yaşayan); test sayıları (iki TZ, çıkış kodlarıyla; eski modelde kırmızı + nedenleri); G3 dökümü; KULLANICIYA SORULMALI; SONRAKİ SÜRÜME (2.5.1); DENENMEYEN; ana oturumun yeniden koşacağı komutlar; OKUNAN DOSYALARIN TAM LİSTESİ (satır aralıklarıyla); dal ucu commit'i.")
open(I_OUT, 'w', encoding='utf-8').write('\n'.join(p) + '\n')
print(len('\n'.join(g)), len('\n'.join(p)))
