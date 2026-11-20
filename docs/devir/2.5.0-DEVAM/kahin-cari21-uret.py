# ANA OTURUM — cari kâhini bakımı 21 (Ç7b paketinin cari kâhinine dokunan kararları) karar girdisi ve görev metni üreteci.
# Kararlar iş listesinden ve kural kitabından AYNEN çekilir; KAPSAM satırlarını baş mimar yazdı (kural vermez, kararın metnini kâhinin diline bağlar).
# Ders 5: girdiye programın dosya adı, kod davranışı, sınama sayısı, programın ürettiği değer GİRMEZ.
# Çağrı: cd <depo>; python3 -I <bu> <girdi çıktısı> <görev metni çıktısı> <taban dalı>
import sys
G_OUT, I_OUT, TABAN = sys.argv[1], sys.argv[2], sys.argv[3]
SP = '/tmp/claude-0/-home-user/de5e1cbf-7e68-5683-b7bb-f27655eaed4f/scratchpad'
t = open('docs/2.5.0-IS-LISTESI.md', encoding='utf-8').read()
il = t.split('\n')
D = t[t.find('\n## D'):]
dent = D.split('\n- ')[1:]
kk = open('docs/erp/MUHASEBELESTIRME-KURAL-KITABI.md', encoding='utf-8').read().split('\n')

def tek(lines, basla):
    hit = [l for l in lines if l.startswith(basla)]
    assert len(hit) == 1, (basla, len(hit))
    return hit[0].strip()

import re
def blok(basla):
    # 19.11 düzeltme: iş listesindeki devam satırları ('  ' ile başlayıp yeni madde / soru olmayan) da okunur — tek satır okuma metni KESİYORDU.
    h = [i for i, l in enumerate(il) if l.startswith(basla)]; assert len(h) == 1, (basla, len(h))
    s = h[0]; e = s + 1
    while e < len(il) and il[e].startswith('  ') and not re.match(r'  (S\d+[ =(]|\(\d+\) )', il[e]): e += 1
    return ' '.join(x.strip() for x in il[s:e])

def dkayit(onek):
    x = [e for e in dent if e.startswith(onek)]
    assert len(x) == 1, (onek, len(x))
    return x[0]

def kes(metin, bas, son):
    i = metin.find(bas); assert i >= 0, bas
    j = metin.find(son, i); assert j >= 0, son
    return metin[i:j + len(son)].strip()

KG3 = tek(kk, '| KG-3 K |'); KG23 = tek(kk, '| KG-23 |')
HEPSI_A = [blok('- KULLANICI KARARI (05.11 17:16 UTC')]
BORCTA = blok('  (6) 2B-S5 / S10 = A "Borçta Kalsın"')
S15S = blok('  S15 (R5)'); S15K = blok('  S15 = A:')
S25S = blok('  S25 (S14 ayrıntıları)'); S25K = blok('  S25 = A:')
d0631 = dkayit('KULLANICI 14.11 06:31 UTC').strip()
e0507 = dkayit('BAŞ MİMAR KARARI 19.11 05:07')
B8 = kes(e0507, 'bu ÜÇ kuralın yeni yönü', 'tek tanım).')
B8b = kes(e0507, 'B-6 BUNUNLA BİRLEŞİR:', 'yeni yöne geçer).')
B8d = kes(e0507, 'BİLİNEN SINIR (teslim notuna):', 'eski yönde kalır.')

g = []; w = g.append
w("# Cari kâhini bakımı 21 — karar girdisi (ana oturum yazdı; TEK girdi kaynağın)")
w("")
w("Bu dosya, cari kâhininin bakım 20'sinden sonra çıkan ve cari kâhinine dokunan kararları taşır: Ç7b paketinin kayıt tahsilatı kuralı (KG-3) ve kural geçiş günü, taksit kartında")
w("'Kartı Kapat' (Borçta Kalsın / KG-23), taksit kartında tahsilatı olan faturanın iptali (S15) ve şüpheliye aktarılmış faturaya bağlı tahsilatın ayrıntıları (S25).")
w("OKUMA KURALI: soru metinlerinde geçen 'program bugün', 'bugünkü davranış', 'koşuldu', 'tur …', 'test' sözleri ve oradaki sayılar KURAL KAYNAĞI DEĞİLDİR — kural yalnız KARAR satırlarıdır")
w("(seçilen seçeneğin metni), kitap satırlarıdır ve aşağıdaki KAPSAM satırlarıdır. Kararın söylemediği alt durumda kural UYDURULMAZ: o alanda SUS ve raporun 'KULLANICIYA SORULMALI'")
w("listesine yaz (ders 40, 43). Etiketler: 'KULLANICI KARARI', 'KULLANICI KURALIYLA ÖNERİ UYGULANDI' (kullanıcının 14.11 06:31 kuralı — kullanıcı değiştirebilir), 'BAŞ MİMAR KARARI' /")
w("'BAŞ MİMAR YORUMU' (kullanıcıya gösterildi; aynı etiketle yaz). Kullanıcının 06:31 kuralı (AYNEN):")
w(d0631)
w("")
w("## C1. KG-3 — kayıt tahsilatının karşılığı (KULLANICI KARARI 05.11 'hepsi A')")
w("KİTAP SATIRI (AYNEN; sütunlar: kimlik | olay | bugün | seçenek A | seçenek B | karar …):"); w(KG3)
w("KULLANICI KARARI (AYNEN):"); w(HEPSI_A[0])
w("KAPSAM (baş mimar): kitabın KG-3 satırının kararlı sütunu — kayıt tahsilatının karşılığı GELİR DEĞİL, 336.90 'Sınıflandırılmamış Tahsilatlar' (pasif). Cari kâhininin mizan / defter")
w("beklentilerinde kayıt tahsilatının karşılığı hangi hesaptaysa bu sütuna geçir; eski → yeni beklentiyi G3'te yaz. 336.90'ın üst hesabı (336) mizanda göründüğü düzeyde beklenir — kâhinin")
w("mizanı ana hesap düzeyindeyse 336, alt hesap düzeyindeyse 336.90 (hangi düzeyi beklediğini yorumda yaz).")
w("")
w("## C2. Kural geçiş günü — kilitli eski veride KG-3'ün eski yönü (B-8; KULLANICI KURALIYLA ÖNERİ UYGULANDI, BAŞ MİMAR KARARI 19.11)")
w("KARAR (AYNEN; 19.11 05:07): " + B8)
w("KARAR (AYNEN; 19.11 05:07): " + B8b)
w("KARAR (AYNEN; 19.11 05:07): " + B8d)
w("KAPSAM (baş mimar): 'üç kural'dan cari kâhinine dokunan yalnız KG-3'tür (kayıt tahsilatı). 'ESKİ yön' = kitap satırının 'bugün' sütununun sözü (kayıt tahsilatı B) ve kâhinin kendi")
w("eski beklentisi; 'geçiş günü' = programın bu sürüme güncellendiği andaki kilit tarihi; güncellemede kilit yoksa geçiş YOK, bütün kayıtlar yeni yön. Kâhinin dili 'eski sürümde kilitlenmiş")
w("veri + güncelleme' sırasını kuruyorsa kur; kuramıyorsa bütün kayıtlar yeni yön (kilitsiz güncelleme) diye kur ve bunu yorumda yaz — SUS + DENENMEYEN.")
w("")
w("## C3. Taksit kartında 'Kartı Kapat' — Borçta Kalsın (KG-23 = A; 2B-S5 / S10 = A)")
w("KİTAP SATIRI (AYNEN):"); w(KG23)
w("KULLANICI KARARI (AYNEN):"); w(BORCTA)
w("KAPSAM (baş mimar): kalan varken Kartı Kapat yalnız ödeme planını bitirir — carinin bakiyesi DEĞİŞMEZ, kapatılan kartın kalan kalemleri carinin borcunda (kendi vadeleriyle) kalır,")
w("ertesi günden gecikmiş sayılır ve hatırlatmaya girer; kalan 'değersiz sayılmaz' (madde yok). Vazgeçme (alacak yazma) ayrı ve görünür işlemdir. Kâhinin dilinde Kartı Kapat yoksa")
w("EKLEME — SUS + DENENMEYEN + 'SÜRÜCÜ İÇİN' satırı.")
w("")
w("## C4. Taksit kartında tahsilatı olan faturanın İptal Et'i (S15 = A)")
w("SORU (AYNEN):"); w(S15S)
w("KARAR (AYNEN):"); w(S15K)
w("KAPSAM: iptal kabul; kart kapanır; kartın o faturaya ait tahsilatları carinin bağsız alacağı (avans) olur. Dil fatura iptalini ve taksit kartını aynı senaryoda kuramıyorsa DENENMEYEN.")
w("")
w("## C5. Şüpheliye aktarılmış faturaya bağlı tahsilatın ayrıntıları (S25 = A)")
w("SORU (AYNEN):"); w(S25S)
w("KARAR (AYNEN):"); w(S25K)
w("KAPSAM: kâhin S25'i zaten modelliyorsa yeni kural YAZMA — her kol (a, b, c) için en az bir senaryoyla beklenenin karara uyduğunu göster; modellemediği kolda kur, eski → yeni G3'te.")
open(G_OUT, 'w', encoding='utf-8').write('\n'.join(g) + '\n')

p = []; w = p.append
w("Sen DestekOfis projesinde CARİ KÂHİNİ BAKIMI 21 ajanısın (2.5.0 — cari kâhini `test/bagimsiz/cari/`). PROGRAMIN KODUNU GÖRMEZSİN (ders 5, 40). KENDİ dalında commit edersin; PUSH YAPMAZSIN. Yanıtın Türkçe. Eforun high. TEK İŞ: girdideki C1–C5 kararlarını cari kâhinine işlemek. Her bitmiş adımı HEMEN commit et (kapsayıcı yeniden başlayabilir). Zamanlanmış görev / hatırlatıcı KURMA.")
w("")
w("## Girdi")
w(f"Tek karar kaynağın: `{SP}/kahin-cari21-kararlar.md` (TAMAMINI oku). Dosyanın başındaki OKUMA KURALI bağlayıcıdır.")
w("")
w("## Hazırlık")
w(f"1. Worktree'de (dalında kendi commit'in YOKKEN) `git reset --hard {TABAN}` (yerel taban dalı; birleşim DEĞİL sıfırlama). `git log --oneline -3 -- test/bagimsiz/cari` ile cari kâhini bakımı 20'nin dalda olduğunu doğrula; değilse DUR ve raporla. `ln -s /home/user/ofis---y-netimi/node_modules node_modules` (`npm ci` YOK).")
w("2. ÖNCE oku: `CLAUDE.md` (dersler; özellikle 5, 6, 7, 31, 38, 40, 43, 54); `docs/BAGIMSIZ-DOGRULAMA-PRENSIBI.md`; girdi dosyası; `test/bagimsiz/cari/KARARLAR.md` (kaynaklar, dil, son üç bakım bölümü ve taksit / şüpheli / mizan geçen bölümler); `model.py`, `oz-test.py`, `senaryolar/` (ilgili kısımlar); kâhinin kendi kaynak listesindeki kural kitabı dosyalarından yalnız ilgili satırlar.")
w("")
w("## Yasaklar (bağımsızlık)")
w("- `server/`, `client/`, `bulut/`, `packaging/`, `tools/` (kanit.mjs yalnız çalıştırılır), `docs/devir/**`, `docs/2.5.0-IS-LISTESI*.md` (HER sürümü), `docs/erp/` altında cari kâhininin kendi kaynak listesinde OLMAYAN her dosya (tasarım notları dahil), `test/bagimsiz/cari/YAPIM-ASAMASI.json` ve `BILINEN.json` (programın değerlerini taşır), `test/bagimsiz/muhasebe-surucu/`, `test/` altında `test/bagimsiz/cari` dışındaki her şey OKUNMAZ. `kos.mjs` yalnız olay / alan EŞLEMESİ için okunabilir; DEĞİŞTİRME. Program KOŞULMAZ (`npm run test:kahin-cari` YOK — onu ana oturum koşar). `docs/kanit/` altında başka ajanların dosyaları ve git farkı / geçmiş içeriği açılmaz. CLAUDE.md'nin 'Açık iş' bölümü kural / beklenti kaynağı DEĞİLDİR.")
w("")
w("## İş")
w("1. ÖNCE YORUM (ders 40): KARARLAR.md'ye '2.5.0 bakımı 21' bölümü — C1–C5 her madde için kural başına yorum (hangi kural değişir, hangi alan SUS'a döner / SUS'tan çıkar, hangi beklenen değişir, kararın / kitabın hangi sözüne dayanır), etiketler girdideki gibi. AYRI commit.")
w("2. Senaryo + beklenen (model değişmeden ÖNCE; eski modelde BEKLENEN NEDENLE kırmızı — ders 7, 38) → AYRI commit; sonra model → AYRI commit. Olay dilini değiştirmen gerekirse (yeni alan / olay türü) YAPMA — SUS + DENENMEYEN + 'SÜRÜCÜ İÇİN'.")
w("3. Mutantlar: her yeni / değişen kural için en az bir mutant (ör. 'kayıt tahsilatı 602'de', 'geçiş günü yok sayılır', 'Kartı Kapat kalanı siler', 'Kartı Kapat bakiyeyi değiştirir', 'iptalde kartın tahsilatı kaybolur', 'şüpheli kısımdan önce 120 düşer'); yakalanmayan mutant = eksik test.")
w("4. G3: bakım 20'ye göre değişen / yeni / kalkan beklenenler senaryo senaryo; C1–C5 alanları DIŞINDA BEKLENMEYEN 0. SUS'a dönen / SUS'tan çıkan her anahtar adıyla ve maddesiyle.")
w("5. TOPLU SORULAR: kararların söylemediği HER alt durum raporun 'KULLANICIYA SORULMALI' bölümünde TEK listede (durum, en küçük örnek, iki okuma, her okumada bakiye; çok uç durumsa üçüncü seçenek 'Uç durum böyle kalsın (BİLİNEN SINIR)'); o alanlarda SUS.")
w("")
w("## Yöntem")
w(f"- Eski kâhin kopyası değişiklikten ÖNCE: `git archive HEAD test/bagimsiz/cari | tar -x -C {SP}/kahincari21-<kısa>/` (benzersiz klasör — ders 25).")
w(f"- Kendi testleri iki TZ (UTC, Europe/Istanbul): `KANIT_DIR=<kendi not defteri klasörün> node tools/kanit.mjs kos kahincari21-<ad> -- python3 -I -B test/bagimsiz/cari/oz-test.py` (+ önceki bakımların mutasyon / G3 araçları); mutasyon ve geniş tarama `flock -s -w 3600 {SP}/olcum.lock` ile (TEK SEFERLİK bekleme); her arka plan koşusu açık süre sınırıyla (`timeout -k 5 <sn> …`, en çok 2 saat). Kanıt `docs/kanit/2026-11-19/kahincari21-*`.")
w("- Önce `cat /proc/loadavg`; yük > 4 ise koşu BAŞLATMA — tek seferlik bekleme (ör. `timeout 600 bash -c 'until [ \"$(cut -d\" \" -f1 /proc/loadavg | cut -d. -f1)\" -lt 4 ]; do sleep 20; done'`), sonra yeniden oku. Disk 5 GB'ın altına düşmez. Bakım, iki TZ kanıt koşusu yapılmadan BİTMİŞ sayılmaz.")
w("- `GIT_DIR` / `GIT_WORK_TREE` VERME (ders 54); her koşudan sonra `git status -sb` + son commit oku. Kendi arka plan işin sürerken rapor vermeden BİTİRME. `pkill` / joker `rm` YOK. Commit'e yalnız kendi yolların (ders 44).")
w("- Commit iletisi sonunda tam olarak şu iki satır (model adı YOK):")
w("  ```")
w("  Co-Authored-By: Claude <noreply@anthropic.com>")
w("  Claude-Session: https://claude.ai/code/session_01EhegDvmPQ9hx2ibfitm6og")
w("  ```")
w("")
w("## Rapor (SubagentHandback ile, Türkçe)")
w("Madde madde yorum (C1–C5); SUS'a dönen / SUS'tan çıkan anahtarların TAM listesi; yeni / değişen elle senaryolar ve değerleri; SÜRÜCÜ İÇİN (kos.mjs'in eşlemesini etkileyen her şey; yoksa 'değişmedi'); mutantlar; test sayıları (iki TZ, çıkış kodlarıyla; eski modelde kırmızı + nedenleri); G3 dökümü; KULLANICIYA SORULMALI; DENENMEYEN; ana oturumun yeniden koşacağı komutlar; OKUNAN DOSYALARIN TAM LİSTESİ (satır aralıklarıyla); dal ucu commit'i.")
open(I_OUT, 'w', encoding='utf-8').write('\n'.join(p) + '\n')
print(len('\n'.join(g)), len('\n'.join(p)))
