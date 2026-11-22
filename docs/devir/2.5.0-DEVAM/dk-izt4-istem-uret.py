# ANA OTURUM — İZLEYEN TUR 4 (S255 = A) + CARİ KÂHİNİ BAKIMI 28 birleşiminin DAR KONTROLÜ görev metni üreteci (prensip §9). dk-tek-istem-uret.py'den türetildi.
# Kararlar iş listesinden AYNEN; baş mimar kararlarından YALNIZ 'KARARLAR' paragraflarının karar cümleleri ('AJANIN SÖYLEDİĞİ' rapor özetleri, ajan / ana oturum sayıları, KAYIT VERİLMEZ — prensip §3).
# Çağrı: cd <depo>; python3 -I <bu> <çıktı -istem.txt> <birleşim commit'i (çalışma dalında, --no-ff izt4-sinama)>
import sys
OUT, M5 = sys.argv[1], sys.argv[2]
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
def kes(metin, bas, son):
    i = metin.find(bas); assert i >= 0, bas
    j = metin.find(son, i); assert j >= 0, son
    return metin[i:j + len(son)].strip()
def soru(n): return tek(il, f'  S{n} (')
BIRAK = [l.strip() for l in cl if l.strip().startswith("2.5.1'E BIRAK")]; assert len(BIRAK) == 1
KUL = [dkayit('KULLANICI KARARI 11.11 03:15 UTC'), dkayit('KULLANICI KARARI 11.11 06:35 UTC'), dkayit('KULLANICI KARARI 20.11 20:14 UTC')]
SORULAR = [110, 120, 200, 213, 229, 230, 241, 254, 255, 256, 257, 258, 259]
d1500 = dkayit('BAŞ MİMAR KARARI 22.11 15:00'); d1312 = dkayit('BAŞ MİMAR KARARI 22.11 13:12')
BM = [
    ('K1 (22.11 13:12 (1) — S255 = A metninin okunuşu)', kes(d1312, '(1) kâhinin okuması', 'KABUL.')),
    ('K2 (22.11 15:00 (2) — Ödeme Hatırlatma\'nın okuduğu ESKİ anlamdaki taksit gecikmişi)', kes(d1500, '(2) BAŞ MİMAR KARARI GEREKEN 1', 'karşılandı.')),
    ('K3 (22.11 15:02 — S256 ÖNERİ REVİZYONU: C → A; S256 satırının sonunda AYNEN, karar dosyasında)', kes(soru(256), 'ÖNERİ REVİZYONU', 'yalnız program sınaması B8 + dar kontrol.')),
]
k = []
k.append("# İZLEYEN TUR 4 DAR KONTROLÜ — KULLANICI KARARLARI (iş listesinden AYNEN; ana oturum üretti)")
k.append("Soru metinlerindeki 'program bugün' / 'bugünkü' sözleri ve sayılar soru anının bilgisidir; kural SEÇİLEN seçeneğin metnidir (seçim satırın sonunda: 'öneri X UYGULANIR / UYGULANDI' ya da 'KULLANICI'). 'KULLANICI KURALIYLA ÖNERİ UYGULANDI' = kullanıcının 14.11 06:31 kuralı (AYNEN: \"bana sorun varsa önerilerini uygula\").")
k.append("## Karar blokları (iş listesi D)")
k += ['- ' + e for e in KUL]
k.append("## Sorular (iş listesi C)")
k += [soru(n) for n in SORULAR]
KOUT = OUT.replace('-istem.txt', '-kararlar.md'); assert KOUT != OUT
open(KOUT, 'w', encoding='utf-8').write('\n'.join(k) + '\n')
KYOL = KOUT if KOUT.startswith('/') else REPO + '/' + KOUT
p = []; w = p.append
w("Sen DestekOfis projesinde bağımsız DAR KONTROL incelemecisisin (2.5.0 — İZLEYEN TUR 4: Mevcut Borç kartının içine aldığı faturaya BAĞLI ödemenin kapama sırası, S255 = A). Yalnız HATA ararsın. Düzeltme, commit ve push YAPMAZSIN. PARA ÇEKİRDEĞİ — eforun high. Yanıtın Türkçe. Zamanlanmış görev KURMA.")
w("")
w("## Hazırlık")
w(f"1. Worktree'de ÖNCE `git reset --hard {M5}` (incelenecek birleşim; çalışma dalı). `git log --oneline -1` ile doğrula; değilse DUR. Kendi commit'in olmayacak.")
w(f"2. `ln -s {REPO}/node_modules node_modules` (`npm ci` YOK). Tarayıcı: `PLAYWRIGHT_BROWSERS_PATH={SP}/pw-1194`.")
w("3. ÖNCE oku: `CLAUDE.md` (anayasa + dersler 1–54); `docs/BAGIMSIZ-DOGRULAMA-PRENSIBI.md` (tamamı; §3 senin kuralların); muhasebeleştirme kural kitabı EK-1 §6'da M1a (tek yükümlülük kuyruğu) ve M1e (taksit kartı alttaki borcu tüketir) satırları (python ile ara); `docs/erp/C7B-FATURA-TASARIM.md` §22'nin KURAL kısmı.")
w("   OKUNMAZ (prensip §3 bağımsızlık): `docs/devir/2.5.0-DEVAM/` altındaki *-rapor.md, *-istem.txt, *-ek.txt, *-kararlar.md dosyaları (bu görevin karar dosyası HARİÇ — aşağıda), `docs/2.5.0-IS-LISTESI-KAYIT.md`, `docs/kanit/2026-11-2*/` altındaki ajan ve ana oturum çıktıları, C7B-FATURA-TASARIM.md §18–§22'nin 'sonuç / ölçüm / sınama' alt başlıkları. Kodu ve testleri farktan oku.")
w(f"4. TEMİZ büyük veri (OKUNUR; kendi kopyanı al): `{SP}/ana-kabul/` (temiz-100k). v2.4.9 verisi: eski sürümün GERÇEK koduyla üret (`git -C {REPO} worktree add --detach <klasör> v2.4.9`).")
w(f"5. Not defteri: `{SP}/dk-izt4-<kısa>` (ders 25). Eski kod kopyası `git -C {REPO} archive {M5}^1 ':!docs/kanit' | tar -x -C <klasör>` + node_modules bağı; eski sürüm ETİKETİ isteyen test için `git -C {REPO} worktree add --detach <klasör> <ref>`, bitince `git -C {REPO} worktree remove --force <o tam yol>` (ders 54: `GIT_DIR` / `GIT_WORK_TREE` VERME). Biten kopyanı TAM yoluyla sil; `df -h /` 5 GB'ın altına düşürme; aynı anda en çok BİR eski kopya.")
w("")
w("## Kapsam (DURMA KURALI — yalnız bu fark)")
w(f"- `git diff {M5}^1 {M5} -- server client test docs/kilavuz ':!test/bagimsiz' ':!docs/kanit'` — izleyen tur 4: faturaya bağlı ödemenin (cari Tahsilat / Ödeme'de 'Kapatılacak Fatura', fatura kartında Tahsilat Ekle, çek / senet) önce faturanın GÖSTERİLEN açığını kapatması, fazlasının tek kuyruktan en erken vadeli açık borca (kartın taksitleri dahil) gitmesi; kodu Tek Yükümlülük Kuyruğu ve fatura kapama yardımcısında.")
w("Aynı birleşimdeki cari kâhini bakımı 28 (test/bagimsiz) KAPSAM DIŞI. Kapsam: değişen yardımcıları kullanan HER çağıran (ders 10) — kart penceresi, Taksitler listesi, cari kartı / Cari listesi / özet, Açık Faturalar, Vade Takip, Alacak Yaşlandırma, Nakit Akışı, Anlık Durum, mobil özet, ekstre / PDF, WhatsApp Ödeme Hatırlatma (K2'ye göre ESKİ anlam beklenir).")
w("")
w("## İLK MADDELER (önce bunlar)")
w("1. KURAL (S255 = A, S256 = A): bağlı ödeme TUTARI × kartın aldığı pay × faturanın gösterilen açığı tablosu (eksik / tam / fazla; kartın tamamını / bir kısmını aldığı fatura; kart kısmen tahsil edilmiş; taksitleri gecikmiş / gelecek; aynı caride elle borç + başka fatura daha erken vadeli) — fazla DOĞRU borca mı gidiyor (en erken vade, S120 / S200 / S241 kapsamı), carinin bakiyesi, avansı, kart Tahsil / Kalan / Geciken, taksit satırları, faturanın durumu ve açığı veri tabanından. Tahsilat (alacak) ve Ödeme (tedarikçi / alış faturası, borç kartı) iki yönde. Çek / senet (S256): portföye giriş, Tahsile Ver, karşılıksız / iade, ciro — her adımda aynı sayı mı.")
w("2. SIRA VE GERİ ALMA (ders 17): ödeme kart açılmadan ÖNCE / SONRA; ödeme silme, Düzenle (tutar / bağ değişimi — PUT ile fatura bağının değişmesi dahil), Silinenler'den geri alma, kart silme / Kartı Kapat / iade / iade iptali / fatura Düzenle ile azaltma ödemeden sonra; yedek → geri yükleme; v2.4.9 verisi göç edilip aynı işlem. Her adımdan sonra iki okumanın (veri tabanı ↔ ekran / API) aynı olduğunu göster.")
w(f"3. GERİLEME: bağsız ödeme, kartsız cari, kartın içine ALMADIĞI fatura, kart faturadan ÖNCE açılmış durumlarda bütün çıktılar {M5}^1 ↔ {M5} BİREBİR mi (temiz büyük veri; iki saat dilimi). Fark yalnız S255 = A'nın sınıflarında olmalı; başka fark = gerileme.")
w("4. ŞÜPHELİ ALACAK VE MAHSUP: S257 = C ve S258 = C (BİLİNEN SINIR) — bu iki alt durumda bulgu YAZILMAZ, yalnız bakiye BOZULUYORSA (toplam borç ↔ satırlar tutmuyor, para kayboluyor / çift sayılıyor) yazılır. S259 = C aynı.")
w("5. CANLI YENİLEME / ÖNBELLEK: bağlı ödemeden sonra açık kart penceresi, Taksitler listesi, cari kartı, fatura kartı (yönetici + gözcü iki oturum) bayat kalıyor mu.")
w(f"6. BEKLENTİSİ DEĞİŞEN TESTLER (ders 28): `git diff --diff-filter=M {M5}^1 {M5} -- test ':!test/bagimsiz'` — değişen her beklenti karar metniyle mi geldi.")
w("7. TESTİN DİŞİ (prensip §3): yeni testler ilk ebeveynde BEKLENEN NEDENLE kırmızı mı (ders 38, 51). YENİ MUTANT YAZMAK ZORUNLU DEĞİL; yaşayan mutant / eksik test KULLANICI KURALIYLA 'SONRAKİ SÜRÜME (2.5.1)'e.")
w("")
w("## Ne ara (sonra)")
w("- Gün / ay / yıl dönümü, iki saat dilimi (TZ=UTC ve Europe/Istanbul), kilitli dönem (Dönem Kilidi: kilitli döneme düşen kapama), ileri tarihli ödeme / vade, iki şirket.")
w("- YETKİ: her rol × Tahsilat / Ödeme / fatura kartı Tahsilat Ekle; reddedilen istek veri tabanında iz bırakıyor mu.")
w("- HIZ (ders 47): değişen yollarda öğe başına ağır okuma / kart başına alt sorgu var mı (ölçüm için `flock -x` kilit dışarıda — ana oturumun ölçümü sürüyorsa bekle).")
w("")
w("## BAŞ MİMAR KARARLARI — DEĞERLENDİR (karar metnine uyuyor mu; betikle göster)")
for ad, metin in BM:
    w(f"- {ad}: {metin}")
w("")
w("## KULLANICI KARARLARI")
w(f"İş listesinden AYNEN çekilmiş karar metinleri ayrı dosyada: `{KYOL}` — TAMAMINI oku (D 11.11 03:15 / 06:35 / 20.11 20:14; sorular: " + ', '.join(f'S{n}' for n in SORULAR) + "). Kural seçilen seçeneğin metnidir; S254 / S257 / S258 / S259 = C (BİLİNEN SINIR) — bu alt durumlarda bulgu YAZILMAZ, yalnız bakiye bozuluyorsa yazılır.")
w("")
w("BULGU SINIFI — KULLANICI KURALI (bu dar kontrolde GEÇERLİ; CLAUDE.md'den AYNEN): " + BIRAK[0])
w("Bu kurala göre: programın davranışını / sayılarını / hızını ya da kullanıcının gördüğünü DEĞİŞTİRMEYEN husus DÜŞÜK'tür ve raporun 'SONRAKİ SÜRÜME (2.5.1)' başlığına yazılır; programı ya da kullanıcıyı etkileyen her bozulma (yanlış para / bakiye / kapama / önerilen tutar / rapor toplamı / bayat ekran, yanlış ileti, gerileme, veri kaybı) eskisi gibi YÜKSEK / ORTA. Ayrıntıya boğulma: önce İLK MADDELER, sonra kalan süre kadar genel liste.")
w("")
w("## Yöntem (prensip §3)")
w("- Her bulgu betikle GERÇEK programda üretilir; çıktıda sayı olur. Program başlatırken `HUKUK_LICENSE_URL=http://127.0.0.1:9`. Üretilemeyen kuşku 'DOĞRULANMADI'ya.")
w("- Eski kod yalnız ayrı kopyada (ders 23, 51); bulgunun önceden var mı, bu birleşimle mi geldiğini yaz.")
w(f"- Ölçüm DIŞI HER koşu (tek test dahil) `flock -s -w 3600 {SP}/olcum.lock timeout -k 5 <sn> <komut>` (süre sınırı flock'un İÇİNDE; ana oturumun özel kilitli ölçümü sürerken koşun bekler — bekle, KİLİTSİZ KOŞMA, kısa okuma betikleri dahil). HER arka plan koşusu açık süre sınırıyla (en çok 2 saat; içinde bekleme döngüsü YOK — ders 50). Önce `cat /proc/loadavg`; 4'ün üstündeyse yeni koşu başlatma, tek seferlik bekle. Aynı anda en çok BİR yük koşusu.")
w("- KAPSAYICI SIK YENİLENİYOR: koşuları ≤ 40 dk parçalara böl; her parçanın bulgusunu ve sayılarını not defterindeki `rapor-taslak.md`'ye HEMEN yaz (commit YOK).")
w("- `pkill` / `killall` / joker `rm` YOK; yalnız KENDİ pid'in. Tam `npm test` YOK. Koşular `KANIT_DIR=<kendi not defteri klasörün> node tools/kanit.mjs kos dkizt4-<ad> -- <komut>`. Çıktılar depoya commit EDİLMEZ.")
w("- PARA / KAPAMA KURALI AYRIŞMASI (ders 43): iki okumaya açık bir kural bulursan düzeltme önerme — KULLANICIYA SORULMALI (iki seçenek + öneri; uç durumsa üçüncü seçenek 'Uç durum böyle kalsın (BİLİNEN SINIR)'). Önce iş listesi C / D'de aynı soru sorulmuş mu ARA (yalnız C ve D; KAYIT okunmaz); sorulmuşsa numarasını yaz. Her alt durumda bakiyenin iki okumada aynı olup olmadığını SAYIYLA yaz.")
w("- SAKINCA SÜZGECİ: her DÜŞÜK için yaz — yanlış para / bakiye / kapama / önerilen tutar, bayat ekran, veri kaybı ya da gerileme mi? Öyleyse ORTA say.")
w("- Kendi arka plan işin sürerken turunu rapor vermeden BİTİRME (turunu 'bekliyorum' diye kapatma).")
w("")
w("## Rapor (prensip §3 biçimi; SubagentHandback ile)")
w("EN BAŞTA: GERİLEMELER (varsa). Sonra İLK MADDELER 1–7'nin sonucu tek tek. Sonra her bulgu — sınıf (YÜKSEK / ORTA / DÜŞÜK), dosya:satır, betik + çıktı (sayılarla), kök neden, önceden var mı, en küçük düzeltme önerisi; K1–K3 değerlendirmesi; KULLANICIYA SORULMALI; SONRAKİ SÜRÜME (2.5.1); DOĞRULANMADI; DENENMEYEN; not defteri klasörlerin (tam yol). Bulgu yoksa açıkça 'YÜKSEK / ORTA YOK'.")
open(OUT, 'w', encoding='utf-8').write('\n'.join(p) + '\n')
print(len('\n'.join(p)), len('\n'.join(k)))
