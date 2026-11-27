# ANA OTURUM — S229 + S230 KÜÇÜK PROGRAM TURU (Mevcut Borç kartının içine aldığı faturanın gösterilen açığı) DAR KONTROL görev metni üreteci (prensip §9).
# Birleşim çalışma dalına S229 + cari kâhini bakımı 23 ile TEK commit'te girer; kâhin (test/bagimsiz) kapsam DIŞI. Kararlar iş listesinden / CLAUDE.md'den AYNEN;
# baş mimar kararlarından YALNIZ karar paragrafları (raporların özetleri / ajanın sayıları VERİLMEZ — prensip §3).
# Çağrı: cd <depo>; python3 -I <bu> <çıktı -istem.txt> <birleşim commit'i>
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


def dkayit(onek, icerir=''):
    x = [e for e in dent if e.startswith(onek) and icerir in e[:260]]
    assert len(x) == 1, (onek, icerir, len(x))
    return x[0].strip()


def kes(metin, bas, son):
    i = metin.find(bas); assert i >= 0, bas
    j = metin.find(son, i); assert j >= 0, son
    return metin[i:j + len(son)].strip()


def soru(n):
    return tek(il, f'  S{n} (')


BIRAK = [l.strip() for l in cl if l.strip().startswith("2.5.1'E BIRAK")]
assert len(BIRAK) == 1
KUL = [dkayit('KULLANICI KARARI 20.11 20:14 UTC')]
SORULAR = [120, 129, 200, 213, 229, 230]
d2012 = dkayit('BAŞ MİMAR KARARI 20.11 20:12')
d0035 = dkayit('BAŞ MİMAR KARARI 21.11 00:35')
BM = [
    ('K1 (20.11 20:12 — koddan görülenler; hangi yol düşülür)', kes(d2012, 'KODDAN GÖRÜLENLER', "fatura toplamları Açık Faturalar'ı izler.")),
    ('K2 (21.11 00:35 (1) — API alanı: `open` GÖSTERİLEN açık, `ownOpen` faturanın kendi açığı)', kes(d0035, '(1) CARİ KÂHİNİNDE 46 FARK', 'kaçan yol sessizce eski sayıyı gösterir.')),
    ('K3 (21.11 00:35 (2) — tamamı alınan fatura Mahsup Et / Kapatılacak Fatura seçeneklerinde)', kes(d0035, '(2) Kartın TAMAMINI aldığı', 'tahsil edilir\' sözüyle tutarlı).')),
    ('K4 (21.11 00:35 (3) — tamamı alınan fatura her zaman Taksitte)', kes(d0035, '(3) Tamamı alınan fatura', "(karar metni 'Taksitte').")),
    ('K5 (21.11 00:35 (4) / (5) — 2.5.1 ve DENENMEYEN)', kes(d0035, "(4) 2.5.1'E:", 'birleşik şirket raporu, mobil özet).')),
]

p = []; w = p.append
w("Sen DestekOfis projesinde bağımsız DAR KONTROL incelemecisisin (2.5.0 — S229 + S230: Mevcut Borç (taksit) kartının içine aldığı faturanın Açık Faturalar raporunda, fatura kartında, Faturalar listesinde ve formların önerdiği tutarda GÖSTERİLEN açığı). Yalnız HATA ararsın. Düzeltme, commit ve push YAPMAZSIN. PARA ÇEKİRDEĞİNE KOMŞU (fatura kapama, tahsilat önerisi) — eforun high. Yanıtın Türkçe. Zamanlanmış görev KURMA.")
w("")
w("## Hazırlık")
w(f"1. Worktree'de ÖNCE `git reset --hard {M}` (incelenecek birleşim; ilk ebeveyni birleşim öncesi kod = S229 ÖNCESİ, Ç7b dahil). `git log --oneline -1` ile doğrula; değilse DUR. Kendi commit'in olmayacak.")
w(f"2. `ln -s /home/user/ofis---y-netimi/node_modules node_modules` (`npm ci` YOK). Tarayıcı: `PLAYWRIGHT_BROWSERS_PATH={SP}/pw-1194`.")
w("3. ÖNCE oku: `CLAUDE.md` (anayasa + dersler 1–54); `docs/BAGIMSIZ-DOGRULAMA-PRENSIBI.md` (tamamı; §3 senin kuralların); muhasebeleştirme kural kitabı EK-1 §6'da M1a (tek yükümlülük kuyruğu) ve M1e (taksit kartı alttaki borcu tüketir) satırları (python ile ara).")
w("   OKUNMAZ (prensip §3 bağımsızlık): `docs/devir/2.5.0-DEVAM/` altındaki *-rapor.md, *-istem.txt, *-ek.txt, *-kararlar.md dosyaları (bu görevin karar dosyası HARİÇ — aşağıda), `docs/2.5.0-IS-LISTESI-KAYIT.md`, `docs/kanit/2026-11-*/` altındaki ajan ve ana oturum çıktıları. Kodu ve testleri farktan oku.")
w(f"4. TEMİZ büyük veri (OKUNUR; kendi kopyanı al): `{SP}/ana-kabul/` (temiz-100k). v2.4.9 verisi: eski sürümün GERÇEK koduyla üret (`git -C /home/user/ofis---y-netimi worktree add --detach <klasör> v2.4.9`).")
w(f"5. Not defteri: `{SP}/dk-s229-<kısa>` (ders 25). Eski kod kopyası `git -C /home/user/ofis---y-netimi archive {M}^1 ':!docs/kanit' | tar -x -C <klasör>` + node_modules bağı; eski sürüm ETİKETİ isteyen test için `git -C /home/user/ofis---y-netimi worktree add --detach <klasör> <ref>`, bitince `git -C /home/user/ofis---y-netimi worktree remove --force <o tam yol>` (ders 54: `GIT_DIR` / `GIT_WORK_TREE` VERME). Biten kopyanı TAM yoluyla sil; `df -h /` 5 GB'ın altına düşürme; aynı anda en çok BİR eski kopya.")
w("")
w("## Kapsam (DURMA KURALI — yalnız bu fark)")
w(f"`git diff {M}^1 {M} -- server client test docs/kilavuz ':!test/bagimsiz'` — ürün dosyaları `server/routes/invoices.mjs` (gösterilen açık TEK yerde: `open` = faturanın kendi açığı − kartın aldığı kısım; yeni `ownOpen` / `inPlan` alanları), `client/assets/hof-invoices.js` (fatura kartı 'Taksit Kartında' satırı, Faturalar listesi Kalan / durum, Tahsilat Ekle / Mahsup Et önerisi), kılavuz HTML + PDF; yeni testler ve BEKLENTİSİ DEĞİŞEN komşu testler. Cari kâhini (test/bagimsiz) KAPSAM DIŞI.")
w("")
w("## İLK MADDELER (önce bunlar)")
w("1. `open` ALANININ ANLAMI DEĞİŞTİ (K2): bu alanı okuyan HER yol (`server/` ve `client/` ve mobil özet taramasıyla — `.open`, `open:`, `\"open\"`; fatura API'si, Açık Faturalar, Anlık Durum, Faturalar Excel / PDF, Mahsup Et, Kapatılacak Fatura, Tahsilat Ekle, iade / iptal, e-Belge, WhatsApp, mobil, yedek / dışa aktarma) — gösterim mi istiyor (yeni anlam doğru), yoksa SINIR / KAPAMA / PARA için faturanın kendi açığını mı istiyor (o zaman `ownOpen` okumalı; `open` okuyorsa YÜKSEK aday: girilebilecek tutarın sınırı ya da kapama değişmiş olur — S230 = A 'sınır ve kapama kuralı değişmez'). Her biri için betikle iki kodda aynı işlem: sınır / kapama aynı mı (veri tabanından, ders 3).")
w("2. S229 = A / S230 = A örneği (C'deki sayılarla, sahte saatle — ders 13): F1 50.000 (vade 10.02), Borç Yaz 30.000; 01.02'de kart 60.000; 16.02 → Açık Faturalar F1 20.000, fatura kartı 'Açık 20.000' + 'Taksit Kartında: <kart> · 30.000', Faturalar listesi Kalan 20.000, Tahsilat Ekle / Mahsup Et 20.000 ÖNERİR; girilebilecek tutar bugünkü sınırla (fazlası carinin vadesi en önce gelen açık borcuna); kart faturanın tamamını alınca 'Taksitte'; Anlık Durum'un fatura toplamları = Açık Faturalar. Ekran / PDF / Excel ve her süzgeç seçeneği (ders 11): toplam = satırlar.")
w("3. SIRALAR (ders 17): fatura önce / kart önce; kartın taksiti tahsil edilince, kart küçülünce (iade / iptal — Ç7b karar (4)), Kartı Kapat 'Borçta Kalsın' ile kapanınca, kart silinip geri alınınca, fatura Düzenle ile tutarı değişince — gösterilen açık ve önerilen tutar her adımda karar metnine uyuyor mu; kapanan faturanın durumu (Ödendi / Taksitte / Vadesi Geçti).")
w("4. İKİ KART, KISMİ ALMA, BİRDEN ÇOK FATURA: aynı caride iki Mevcut Borç kartı; bir kart iki faturayı kısmen alır (S200 = A: önce elle borçlar, eksik kısım faturalardan — hangi sırayla?); şüpheli kaydı olan cari (S213 = B); alış faturası / iade belgesi kendi tarafında kalıyor mu (K1).")
w(f"5. BEKLENTİSİ DEĞİŞEN TESTLER (ders 28, G3): `git diff --diff-filter=M {M}^1 {M} -- test ':!test/bagimsiz'` — değişen her beklenti S229 / S230 metniyle mi geldi, yoksa bir gerilemeyi mi örtüyor? Hepsini iki kodda koşup eski / yeni sayıyı KENDİN hesapla.")
w("6. TESTİN DİŞİ (prensip §3): yeni testler S229 ÖNCESİ kodda BEKLENEN NEDENLE kırmızı mı (ders 38, 51). YENİ MUTANT YAZMAK ZORUNLU DEĞİL; yaşayan mutant / eksik test aşağıdaki KULLANICI KURALIYLA 'SONRAKİ SÜRÜME (2.5.1)' başlığına yazılır.")
w("")
w("## Ne ara (sonra)")
w("- GERİLEME: raporun EN BAŞINDA ayrı başlıkla. Mevcut Borç kartı OLMAYAN faturaların bütün çıktıları birleşim öncesi ↔ sonrası BİREBİR mi (temiz büyük veri; v2.4.9 verisi; iki saat dilimi).")
w("- K5'teki DENENMEYEN'ler (kilitli dönem, ileri tarih, iki şirket, Değersiz kısım, birleşik şirket raporu, mobil özet) — süre kalırsa betikle.")
w("- YETKİ: her rol × fatura kartı / Faturalar listesi / Açık Faturalar; reddedilen istek veri tabanında iz bırakıyor mu.")
w("- HIZ (ders 47): Faturalar listesi, Açık Faturalar, Anlık Durum — fatura başına alt sorgu / kart başına ağır okuma var mı (temiz büyük veride olay döngüsü en çoğu ile).")
w("")
w("## BAŞ MİMAR KARARLARI — DEĞERLENDİR (karar metnine uyuyor mu; betikle göster)")
for ad, metin in BM:
    w(f"- {ad}: {metin}")
w("")
k = []
k.append("# S229 + S230 DAR KONTROLÜ — KULLANICI KARARLARI (iş listesinden AYNEN; ana oturum üretti)")
k.append("Soru metinlerindeki 'program bugün' / 'bugünkü' sözleri ve sayılar soru anının bilgisidir; kural seçilen seçeneğin metnidir. 'KULLANICI KURALIYLA ÖNERİ UYGULANDI' = kullanıcının 14.11 06:31 kuralı (AYNEN: \"bana sorun varsa önerilerini uygula\").")
k.append("## Karar blokları (iş listesi D)")
for e in KUL:
    k.append('- ' + e)
k.append("## Sorular (iş listesi C; seçilen seçenek satırında)")
for n in SORULAR:
    k.append(soru(n))
KOUT = OUT.replace('-istem.txt', '-kararlar.md'); assert KOUT != OUT
open(KOUT, 'w', encoding='utf-8').write('\n'.join(k) + '\n')
KYOL = KOUT if KOUT.startswith('/') else '/home/user/ofis---y-netimi/' + KOUT
w("## KULLANICI KARARLARI")
w(f"İş listesinden AYNEN çekilmiş karar metinleri ayrı dosyada: `{KYOL}` — TAMAMINI oku (S230 = A kararı; sorular: " + ', '.join(f'S{n}' for n in SORULAR) + "). Kural seçilen seçeneğin metnidir.")
w("")
w("BULGU SINIFI — KULLANICI KURALI (bu dar kontrolde GEÇERLİ; CLAUDE.md'den AYNEN): " + BIRAK[0])
w("Bu kurala göre: programın davranışını / sayılarını / hızını ya da kullanıcının gördüğünü DEĞİŞTİRMEYEN husus DÜŞÜK'tür ve raporun 'SONRAKİ SÜRÜME (2.5.1)' başlığına yazılır; programı ya da kullanıcıyı etkileyen her bozulma (yanlış para / bakiye / kapama / önerilen tutar / rapor toplamı, yanlış ileti, gerileme, veri kaybı) eskisi gibi YÜKSEK / ORTA. Ayrıntıya boğulma: önce İLK MADDELER, sonra kalan süre kadar genel liste.")
w("")
w("## Yöntem (prensip §3)")
w("- Her bulgu betikle GERÇEK programda üretilir; çıktıda sayı olur. Program başlatırken `HUKUK_LICENSE_URL=http://127.0.0.1:9`. Üretilemeyen kuşku 'DOĞRULANMADI'ya.")
w("- Eski kod yalnız ayrı kopyada (ders 23, 51).")
w(f"- Yük koşuları `flock -s -w 3600 {SP}/olcum.lock …` (tek seferlik bekleme). HER arka plan koşusu açık süre sınırıyla (`timeout -k 5 <sn> …`, en çok 2 saat — 7200 sn; bekleme süresi de bu sınırın İÇİNDE; içinde bekleme döngüsü YOK — ders 50). Önce `cat /proc/loadavg`; 4'ün üstündeyse yeni koşu başlatma, tek seferlik bekle. Aynı anda en çok BİR yük koşusu.")
w("- KAPSAYICI SIK YENİLENİYOR: koşuları ≤ 40 dk parçalara böl; her parçanın bulgusunu ve sayılarını not defterindeki `rapor-taslak.md`'ye HEMEN yaz (commit YOK); kesilirsen yeni incelemeci oradan sürdürür.")
w("- `pkill` / `killall` / joker `rm` YOK; yalnız KENDİ pid'in. Tam `npm test` YOK. Koşular `KANIT_DIR=<kendi not defteri klasörün> node tools/kanit.mjs kos dks229-<ad> -- <komut>`. Çıktılar depoya commit EDİLMEZ.")
w("- PARA / KAPAMA KURALI AYRIŞMASI (ders 43): iki okumaya açık bir kural bulursan düzeltme önerme — KULLANICIYA SORULMALI (iki seçenek + öneri; uç durumsa üçüncü seçenek 'Uç durum böyle kalsın (BİLİNEN SINIR)'). Önce iş listesi C / D'de aynı soru sorulmuş mu ARA (yalnız C ve D; KAYIT okunmaz); sorulmuşsa numarasını yaz. Her alt durumda bakiyenin iki okumada aynı olup olmadığını SAYIYLA yaz.")
w("- SAKINCA SÜZGECİ: her DÜŞÜK için yaz — yanlış para / bakiye / kapama / önerilen tutar, veri kaybı ya da gerileme mi? Öyleyse ORTA say.")
w("- Kendi arka plan işin sürerken turunu rapor vermeden BİTİRME.")
w("")
w("## Rapor (prensip §3 biçimi; SubagentHandback ile)")
w("EN BAŞTA: GERİLEMELER (varsa). Sonra İLK MADDELER 1–6'nın sonucu tek tek (1. maddede `open` okuyan her yolun listesi: dosya:satır, gösterim / sınır, sonuç). Sonra her bulgu — sınıf (YÜKSEK / ORTA / DÜŞÜK), dosya:satır, betik + çıktı (sayılarla), kök neden, en küçük düzeltme önerisi; K1–K5 değerlendirmesi; KULLANICIYA SORULMALI; SONRAKİ SÜRÜME (2.5.1); DOĞRULANMADI; DENENMEYEN; not defteri klasörlerin (tam yol). Bulgu yoksa açıkça 'YÜKSEK / ORTA YOK'.")
open(OUT, 'w', encoding='utf-8').write('\n'.join(p) + '\n')
print(len('\n'.join(p)), len('\n'.join(k)))
