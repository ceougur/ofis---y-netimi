# ANA OTURUM — Ç7b (kitap türetme kuralları: fatura / KDV / taksit / kayıt) TEK DAR KONTROL görev metni üreteci (prensip §9 iskeleti).
# Ç7b tur 2–2f + tur 3 (devam 1–3) + tur 3b + taksit küçük turu + aday düzeltme turu, çalışma dalına TEK birleşimle girer → TEK dar kontrol
# (TOKEN TASARRUFU (3)). Kararlar iş listesinden / CLAUDE.md'den AYNEN; baş mimar kararlarından YALNIZ karar paragrafları (raporların özetleri,
# 'ajanın sayıları' VERİLMEZ — prensip §3). Ana oturumun ekran yürüyüşü bulgusu (düzeltme ajanının raporu DEĞİL) AYNEN.
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
D31 = tek(cl, '31. ')

# KULLANICI KARARLARI (D'den, girdi AYNEN — devam satırlarıyla)
KUL = [
    dkayit('KULLANICI KARARI (05.11 17:16 UTC'),
    dkayit('KULLANICI KARARLARI 05.11 ~18:55'),
    dkayit('KULLANICI KARARLARI 05.11 (21:30 UTC'),
    dkayit('KULLANICI KARARI 06.11 04:50 UTC'),
    dkayit('KULLANICI KARARI 06.11 06:26 UTC'),
    dkayit('KULLANICI KARARI 06.11 08:06 UTC'),
    dkayit('KULLANICI KARARI 06.11 10:57 UTC'),
    dkayit('KULLANICI KARARI 20.11 11:29 UTC (S219; AYNEN: "c")'),
    dkayit('KULLANICI KARARI 20.11 11:29 UTC (S219; AYNEN: "a tamam"'),
    dkayit('KULLANICI KARARI 20.11 13:39 UTC'),
    dkayit('KULLANICI KARARI 20.11 14:47 UTC'),
]
SORULAR = [15, 25, 49, 118, 129, 205, 206, 210, 211, 216, 217, 218, 219, 220, 221, 222, 226, 233]

# BAŞ MİMAR KARARLARI — yalnız karar paragrafları
d0340 = dkayit('BAŞ MİMAR KARARI 19.11 03:40', 'Ç7b KOD AJANI')
d0403 = dkayit('BAŞ MİMAR KARARI 19.11 04:03')
d0435 = dkayit('BAŞ MİMAR KARARI 19.11 04:35')
d0507 = dkayit('BAŞ MİMAR KARARI 19.11 05:07')
d0639 = dkayit('BAŞ MİMAR KARARI 19.11 06:39')
d0929 = dkayit('BAŞ MİMAR KARARI 19.11 09:29')
d1554 = dkayit('BAŞ MİMAR KARARI 19.11 15:54')
d0312 = dkayit('BAŞ MİMAR KARARI 20.11 03:12')
d0415 = dkayit('BAŞ MİMAR KARARI 20.11 04:15')
d1006 = dkayit('BAŞ MİMAR KARARI 20.11 10:06')
d1125 = dkayit('BAŞ MİMAR KARARI 20.11 11:25')
d2340 = dkayit('BAŞ MİMAR KARARI 20.11 23:40')
d0155 = dkayit('BAŞ MİMAR KARARI 21.11 01:55')
BM = [
    ('K1 (19.11 03:40 — carisiz Kasa girişinin alt hesabı)', kes(d0340, '(2) SINIFLAMA SORUSU', 'bunu ayrıca görür.')),
    ('K2 (19.11 04:03 — tasarım notu §0 ve B-1…B-5)', kes(d0403, 'Ç7b TASARIM NOTU §0', "metin Ç6-HESAP'ta).")),
    ('K3 (19.11 04:35 — B-6, B-7, KDV Özeti, S15)', kes(d0435, 'KARARLAR: B-6', 'aynı dosyalar);')),
    ('K4 (19.11 05:07 — B-8 kural geçiş günü, B-6 ile birleşimi, B-9, B-10, MA listesi)', kes(d0507, 'B-8 (KG-3 602', '155.990,50 TL).')),
    ('K5 (19.11 06:39 — dosya sınırı aşımı, kilit izi, Sıfırla)', kes(d0639, 'KARARLAR: (1) dosya sınırı aşımı', 'eski yön anlamsız.')),
    ('K6 (19.11 09:29 — B-11, B-12, Sıfırla ↔ KDV mahsubu, onarım eşdeğerliği)', kes(d0929, 'KARARLAR: (B-11) = A', 'Ç7b ekran yürüyüşünde.')),
    ('K7 (19.11 15:54 — B-11 gün yorumu, kural farkı kırılımı, güncelleme notu, kilit izi sürümü)', kes(d1554, 'KARARLAR: (1) B-11 GÜN YORUMU', 'yakalandı = yeterli.')),
    ('K8 (20.11 03:12 — Kural Farkı sütunu gözlemi)', kes(d0312, '(2) GÖZLEM', '(yoksa 2.5.1).')),
    ('K9 (20.11 04:15 — Borçta Kalsın dosya sınırı (B-11 = A tur 3b için), B-12, S210, S216, S217, açılış onarımı)', kes(d0415, 'KARARLARI: (1) B-11 = A', '(tek yerlik ayna; ders 10).')),
    ('K10 (20.11 10:06 — S206 / S211 kuralının iptal / silme süresi)', kes(d1006, 'KALAN: fatura iptali', '→ 2.5.1 (20.11 kuralı).')),
    ('K11 (20.11 11:25 — taksit küçük turunun kapsamı)', kes(d1125, '(1) P7 (ORTA', 'kodlama yok (Ç7b tur 2f\'de C: P = P6 + P7 + P4, K 0).')),
    ('K12 (21.11 01:55 — aday düzeltme turu: soru, 2.5.1, DENENMEYEN)', kes(d0155, 'KARARLAR: (1) KULLANICIYA SORULMALI', 'mutant yalnız UTC).')),
]
YUR = kes(d2340, 'BULGU 1 (ORTA', 'yersiz uyarı.')

KITAP = ('KG-2, KG-3, KG-4, KG-7, KG-8, KG-23, KG-24, F-06, F-08, M14, K-01, K-02, C-01, C-02, G-8, H-03, S-03, S-04 ve §7.5 (6) (.90 Sınıflandırılmamış)')

p = []; w = p.append
w("Sen DestekOfis projesinde bağımsız DAR KONTROL incelemecisisin (2.5.0 — Ç7b: kitap türetme kuralları — fatura / KDV / taksit / kayıt; Ç7b'nin bütün turları TEK birleşimle çalışma dalına girdi). Yalnız HATA ararsın. Düzeltme, commit ve push YAPMAZSIN. PARA ÇEKİRDEĞİ (defter, cari bakiye, taksit kartı, KDV mahsubu) — eforun high. Yanıtın Türkçe. Zamanlanmış görev KURMA.")
w("")
w("## Hazırlık")
w(f"1. Worktree'de ÖNCE `git reset --hard {M}` (incelenecek birleşim; ilk ebeveyni birleşim öncesi kod = Ç7b ÖNCESİ). `git log --oneline -1` ile doğrula; değilse DUR. Kendi commit'in olmayacak.")
w(f"2. `ln -s /home/user/ofis---y-netimi/node_modules node_modules` (`npm ci` YOK). Tarayıcı: `PLAYWRIGHT_BROWSERS_PATH={SP}/pw-1194`.")
w(f"3. ÖNCE oku: `CLAUDE.md` (anayasa + dersler 1–54); `docs/BAGIMSIZ-DOGRULAMA-PRENSIBI.md` (tamamı; §3 senin kuralların); muhasebeleştirme kural kitabında (`docs/erp/MUHASEBELESTIRME-KURAL-KITABI.md` + EK-1 §5 / §6) {KITAP} satırları (python ile ara); tasarım notu `docs/erp/C7B-FATURA-TASARIM.md` — YALNIZ KURAL / TASARIM cümleleri (§2, §3, §4, §13.1–13.5, §14.1–14.8, §15.1–15.5, §16.1–16.7, §17.1–17.4). Notun 'kod ve sonuç', 'kod sürerken değişen yerler', 'tur … devamı' alt bölümleri (§11, §12, §13.6, §14.10, §15.6, §16.8–16.10 ve §17'den sonrakiler) ajanların anlatımıdır, KANIT DEĞİL — kodla karşılaştır.")
w("   OKUNMAZ (prensip §3 bağımsızlık): `docs/devir/2.5.0-DEVAM/` altındaki *-rapor.md, *-istem.txt, *-ek.txt, *-kararlar.md dosyaları (bu görevin karar dosyası HARİÇ — aşağıda), `docs/2.5.0-IS-LISTESI-KAYIT.md`, `docs/kanit/2026-11-*/` altındaki ajan ve ana oturum çıktıları. Kodu ve testleri farktan oku.")
w(f"4. TEMİZ büyük veri (OKUNUR; kendi kopyanı al): `{SP}/ana-kabul/` (temiz-100k). v2.4.9 verisi: eski sürümün GERÇEK koduyla üret (`git -C /home/user/ofis---y-netimi worktree add --detach <klasör> v2.4.9`).")
w(f"5. Not defteri: `{SP}/dk-c7b-<kısa>` (ders 25). Eski kod kopyası `git -C /home/user/ofis---y-netimi archive {M}^1 ':!docs/kanit' | tar -x -C <klasör>` + node_modules bağı; eski sürüm ETİKETİ isteyen test için `git -C /home/user/ofis---y-netimi worktree add --detach <klasör> <ref>`, bitince `git -C /home/user/ofis---y-netimi worktree remove --force <o tam yol>` (ders 54: `GIT_DIR` / `GIT_WORK_TREE` VERME). Biten kopyanı TAM yoluyla sil; `df -h /` 5 GB'ın altına düşürme; aynı anda en çok BİR eski kopya.")
w("")
w("## Kapsam (DURMA KURALI — yalnız bu fark)")
w(f"`git diff {M}^1 {M} -- server client test docs/kilavuz ':!test/bagimsiz'` — 20 ürün dosyası (server/app.mjs, server/lib/{{account-lines, accounts, bank/doubtful, general-ledger, integrity-scope, integrity, ledger-rule-shift (YENİ), migrations (göç 51 / 52 / 53), obligation-input}}.mjs, server/routes/{{accounts, invoices, ledger, plan-transfer, plans, report-center, tax}}.mjs, client/assets/hof-invoices.js, client/assets/hof-plans.js, kılavuz) ve yeni / değişen testler (BEKLENTİSİ DEĞİŞEN eski testler dahil). Bölümler: (A) defter türetme — .90 alt hesapları, KG-2 (600.90 / 610.90), KG-3 (kayıt tahsilatı 336.90), KG-24 (601), KG-8 / F-08 (iade KDV'si 191 ↔ 391), S4 (mahsuptan sonra AZALTAN kayıt), Defter Mutabakatı'nın beklenen değeri (`routes/ledger.mjs expected()` — B-2 = İZİN: doğrulayıcı türetmeyle AYNI turda değişti, ayrıca ara); (B) KURAL GEÇİŞ GÜNÜ (B-8 = A + B-6; tek yardımcı `server/lib/ledger-rule-shift.mjs`; göç 51 yalnız işaret) + kilit izi ekleri (B-7, B-12, geçiş günü, göç 52 / 53 işaretleri) + Şirket Verisini Sıfırla ekleri; (C) KG-7 'KDV İndirim Dönemi' (göç 52; fatura formu; mahsup seçimi; KDV Özeti B-11 + gün yorumu); (D) taksit kartı — karar (4) kart küçülmesi, S15 / S206 / S210 / S211 / S216 / S217 İptal Et, S218 açılış onarımı; (E) Kartı Kapat 'Borçta Kalsın' — karar (6) / KG-23 / S205 / S220 (göç 53 kart başına kural işareti; tek yardımcı `server/lib/accounts.mjs`) + YB-1 eskimiş onay (409 `plan-close-stale`) — onay GÖSTERİLEN kalanla (S129 = A; ana oturumun ekran yürüyüşü bulgusu aşağıda); (F) Excel'den taksit kartı yüklemede aynı adlı iki kişi (S219 = A, S221, S222). Muhasebe sürücüsü ve kâhinler (test/bagimsiz) KAPSAM DIŞI.")
w("")
w("## Ana oturumun ekran yürüyüşü bulgusu (aday düzeltme turunun konusu; ana oturumun kaydından AYNEN — düzeltildi mi, komşusu var mı?)")
w(YUR)
w("")
w("## İLK MADDELER (önce bunlar)")
w("1. NASIL BOZULUR (kullanıcı kararı 20.11 13:39 (5) — dar kontrolün listesine AYNEN verilen iki yol): (a) 'Borçta Kalsın' ile kapanmış taksitli faturada fatura Düzenle (tutar artır / azalt, kalem sil, tarih değiştir) — kart, cari bakiye, gecikmiş, defter; (b) kapalı Mevcut Borç kartının faturası iade edilince kuyruk (iade borçtan düşülür / parası geri verilir) — gecikmiş ve kalemlerin kapanma sırası karar (4) / (6) / S205 / S220 metnine uyuyor mu.")
w("2. KARTI KAPAT (karar (6), S205, S220, S129, S233, YB-1): kartın kalanı carinin borcunda kalır mı (defter maddesi YOK — KG-23), gecikmiş günü (S205 kapanışın ertesi günü; S220 kapanıştan önce vadesi geçmiş kalem kendi vadesinde), onay penceresinin sorduğu tutar = kart penceresinin GÖSTERDİĞİ kalan (cari kartından tahsilatlı, bağsız ödemeli, iadeli, şüpheli kaydı olan, iki kartlı caride); eskimiş onay (başka oturum arada tahsilat girer) → 409 + güncel kalanla YENİDEN soru; kart kapatıldıktan sonra tahsilat / iade / şüpheliye alma / Yeniden Aç → yeniden Kapat; ÖNCEDEN (eski kuralla, 689) kapatılmış kartlar olduğu gibi kalıyor mu (göç 53 işareti; v2.4.9 verisiyle); eşzamanlı iki Kartı Kapat (aynı kart, iki oturum). WhatsApp Ödeme Hatırlatması'nın Borçta Kalsın gecikmişini henüz almaması KARARLI (13:39 (2) → Ç5-C) — bulgu sayılmaz.")
w("3. KURAL GEÇİŞ GÜNÜ (B-8 = A + B-6): v2.4.9'un GERÇEK koduyla üretilmiş KİLİTLİ dosya bu kodla açılınca — 'Kural Değişikliği Farkı' uyarısı (fark 0 / döküm boş uyarı dahil), geçişten önceki kilitli kayıt tahsilatı / iade KDV'si ESKİ yönde, geçişten sonrakiler yeni yönde; KDV mahsubu güncellemeden ÖNCE yazılmış aylar eski yönde, ters kaydedilip yeniden yazılan ay yeni yönde; kilitsiz dosyada geçiş yok (hepsi yeni). Türetme, Defter Mutabakatı'nın beklenen değeri, süzgeç ve KDV mahsubunun 'Güncel Değil' denetimi AYNI yardımcıyı mı okuyor (bir yolun eski / yeni yönde ayrışması = YÜKSEK aday). Kilit sonradan açılıp kapanınca, yedek → geri yükleme, şirket kopyalama, Şirket Verisini Sıfırla ('Hareketleri' kipi geçiş gününü de siler) ve iki şirketli kurulumda geçiş günü doğru mu.")
w("4. KİLİT İZİ (B-7, B-12, geçiş günü, göç 51 / 52 / 53): VAR OLAN kilitler (v2.4.9 ve önceki 2.5.0 ara kodu) güncellemeden sonra yanlış 'değişti' alarmı vermiyor mu; kilitli dönemde KDV İndirim Dönemi / istisna kodu / kalem hesabı / net değişince alarm VERİYOR mu (ders 7 — iki yön de betikle).")
w("5. KG-7 'KDV İndirim Dönemi' + B-11: alan doğrulaması (belge ayından önce / çok ileri / kilitli dönem), Düzenle / iade / iptal / silme / taslak / tekrarlayan fatura; mahsup seçimi (`routes/tax.mjs figureTable`) ve KDV Özeti (Beyanname Hazırlığı) ay ay AYNI mı; gün yorumu (dönem ayının ilk günü; bitişik aralıklarda çift sayım yok); ekran / PDF / Excel toplamı = satırlar (ders 11: her süzgeç seçeneği).")
w("6. S4: mahsubu yazılmış aya sonradan düşen AZALTAN kayıt (ör. faturalı banka masrafının Ters Kaydet'i) sonraki mahsuba taşınıyor mu, çift sayım yok mu; ARTIRAN fark 'Güncel Değil' + Geri Al; karışık ay; kilitli ay (fark ilk açık aya); 191 ay sonu görünümü.")
w("7. TAKSİT KARTI (4) / S15 / S206 / S210 / S211 / S216 / S217 / S218: iade / iptal / silme farklı sıralarda (ders 17) — küçülme en önce gelen açık taksitten, fazlası avans; tahsilatlı faturanın İptal Et'i (kart kapanır, tahsilat avans, iz); çok kalemli Mevcut Borç kartında iptal (S210 — elle borç kendi vadesiyle kuyruğa); iade faturası iptal edilince kart büyümez (S216 = C bugünkü); önceden Kartı Kapat'la kapanmış tahsilatlı kartın faturası (S217 = A: 409 + 'Önce kartı Yeniden Aç ile açın'); açılış onarımı (S218 = B) kilitli dönemde; e-Belge iptal kuralları DEĞİŞMEMELİ.")
w("8. EXCEL'DEN TAKSİT KARTI (S219 = A, S221 = A, S222 = A): iki ayrı 'Ahmet Yılmaz' (telefonlu / telefonsuz / aynı ve farklı grup), aynı Excel ikinci kez; atlanan satırın nedeni; kart / cari sayısı ve bakiye veri tabanından (ders 3). Aynı ad-yalnız denetimin başka yükleme yolunda kalıp kalmadığı (ders 10, taramayla).")
w(f"9. BEKLENTİSİ DEĞİŞEN TESTLER (ders 28, G3): `git diff --diff-filter=M {M}^1 {M} -- test ':!test/bagimsiz'` — değişen her beklenti bir KARAR NUMARASIYLA mı geldi (testteki 'BEKLENTİ BİLEREK DEĞİŞTİ' notu + yukarıdaki karar metni), yoksa bir gerilemeyi mi örtüyor? En az beş tanesini iki kodda koşup eski / yeni sayıyı KENDİN hesapla.")
w("10. TESTİN DİŞİ (prensip §3): yeni testler Ç7b ÖNCESİ kodda BEKLENEN NEDENLE kırmızı mı (ders 38, 51); mevcut mutasyon araçları (test/*-mutasyon.mjs, Ç7b'nin olanları) birkaç kez — ara sıra yaşayan var mı. YENİ MUTANT YAZMAK ZORUNLU DEĞİL; yaşayan mutant / eksik test aşağıdaki KULLANICI KURALIYLA 'SONRAKİ SÜRÜME (2.5.1)' başlığına yazılır, yeni tur açmaz.")
w("")
w("## Ne ara (sonra)")
w("- GERİLEME: raporun EN BAŞINDA ayrı başlıkla. Ç7b'nin dokunmadığı bütün defter / cari / banka / rapor çıktıları birleşim öncesi ↔ sonrası BİREBİR mi (temiz büyük veri; v2.4.9 kilitli verisi; iki saat dilimi — ders 13, 22).")
w("- G2 KOMŞU (ders 10, G4): değişen ortak yardımcıların (accounts.mjs, general-ledger.mjs, account-lines.mjs, integrity*.mjs, obligation-input.mjs, ledger-rule-shift.mjs) BÜTÜN çağıranları (`server/` ve `test/` taramasıyla); göç / şema değişti → şema kapısı (sema-kapisi-bs7) ve yedek geri yükleme testleri komşudur; mobil özet ve WhatsApp seçimi bu yardımcıları okuyorsa onlar da.")
w("- RASTGELE SIRA (ders 17) ve tarih dönümleri (ders 13; sahte saat): ayın 1'i, ay / yıl sonu, kilit günü, Kartı Kapat günü ile aynı gün hareket.")
w("- YETKİ: her rol × değişen uçlar (Kartı Kapat, KDV İndirim Dönemi alanı, Kural Farkı Düzeltme Fişi, Excel taksit yükleme); reddedilen istek veri tabanında iz bırakıyor mu (ders 3).")
w("- HIZ (ders 47): değişen yollarda öğe başına ağır okuma (kart başına alt sorgu, bütün hareketlerin JS'e çevrilmesi) var mı — temiz büyük veride olay döngüsü en çoğu ile.")
w("")
w("## BAŞ MİMAR KARARLARI — DEĞERLENDİR (karar metnine / kitaba / derse uyuyor mu; betikle göster)")
for ad, metin in BM:
    w(f"- {ad}: {metin}")
w("")
w("DERS 31 (CLAUDE.md'den AYNEN): " + D31)
w("")
k = []
k.append("# Ç7b DAR KONTROLÜ — KULLANICI KARARLARI (iş listesinden AYNEN; ana oturum üretti)")
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
w(f"İş listesinden AYNEN çekilmiş karar metinleri ayrı dosyada: `{KYOL}` — TAMAMINI oku (karar blokları: 05.11 17:16 KG-2 / KG-7, 05.11 ~18:55 S1–S5 (S4, S5), 05.11 21:30 (4) / (6), 06.11 04:50 S15, 06.11 06:26 S25, 06.11 08:06 S39, 06.11 10:57 S49 / S50, 20.11 S219, 13:39, 14:47; sorular: " + ', '.join(f'S{n}' for n in SORULAR) + "). Kural seçilen seçeneğin metnidir.")
w("")
w("BULGU SINIFI — KULLANICI KURALI (bu dar kontrolde GEÇERLİ; CLAUDE.md'den AYNEN): " + BIRAK[0])
w("Bu kurala göre: programın davranışını / sayılarını / hızını ya da kullanıcının gördüğünü DEĞİŞTİRMEYEN husus DÜŞÜK'tür ve raporun 'SONRAKİ SÜRÜME (2.5.1)' başlığına yazılır; programı ya da kullanıcıyı etkileyen her bozulma (yanlış para / bakiye / defter / KDV / rapor toplamı, yanlış ileti ya da tutar, gerileme, veri kaybı, yanlış kilit alarmı) eskisi gibi YÜKSEK / ORTA. Ayrıntıya boğulma: önce İLK MADDELER, sonra kalan süre kadar genel liste.")
w("")
w("## Yöntem (prensip §3)")
w("- Her bulgu betikle GERÇEK programda üretilir; çıktıda sayı olur. Program başlatırken `HUKUK_LICENSE_URL=http://127.0.0.1:9`. Üretilemeyen kuşku 'DOĞRULANMADI'ya.")
w("- Eski kod yalnız ayrı kopyada (ders 23, 51).")
w(f"- Yük koşuları `flock -s -w 3600 {SP}/olcum.lock …` (tek seferlik bekleme). HER arka plan koşusu açık süre sınırıyla (`timeout -k 5 <sn> …`, en çok 2 saat — 7200 sn; bekleme süresi de bu sınırın İÇİNDE; içinde bekleme döngüsü YOK — ders 50). Önce `cat /proc/loadavg`; 4'ün üstündeyse yeni koşu başlatma, tek seferlik bekle. Aynı anda en çok BİR yük koşusu.")
w("- KAPSAYICI SIK YENİLENİYOR: koşuları ≤ 40 dk parçalara böl; her parçanın bulgusunu ve sayılarını not defterindeki `rapor-taslak.md`'ye HEMEN yaz (commit YOK — çıktılar depoya girmez); kesilirsen yeni incelemeci oradan sürdürür.")
w("- `pkill` / `killall` / joker `rm` YOK; yalnız KENDİ pid'in. Tam `npm test` YOK. Koşular `KANIT_DIR=<kendi not defteri klasörün> node tools/kanit.mjs kos dkc7b-<ad> -- <komut>`. Çıktılar depoya commit EDİLMEZ.")
w("- PARA / DEFTER KURALI AYRIŞMASI (ders 43): iki okumaya açık bir kural bulursan düzeltme önerme — KULLANICIYA SORULMALI (iki seçenek + öneri; uç durumsa üçüncü seçenek 'Uç durum böyle kalsın (BİLİNEN SINIR)'). Önce iş listesi C / D'de aynı soru sorulmuş mu ARA (yalnız C ve D; KAYIT okunmaz); sorulmuşsa numarasını yaz. Her alt durumda bakiyenin ve mizanın iki okumada aynı olup olmadığını SAYIYLA yaz.")
w("- SAKINCA SÜZGECİ: her DÜŞÜK için yaz — yanlış para / bakiye / defter / KDV, veri kaybı, KVKK ya da gerileme mi? Öyleyse ORTA say.")
w("- Kendi arka plan işin sürerken turunu rapor vermeden BİTİRME.")
w("")
w("## Rapor (prensip §3 biçimi; SubagentHandback ile)")
w("EN BAŞTA: GERİLEMELER (varsa). Sonra İLK MADDELER 1–10'un sonucu tek tek. Sonra her bulgu — sınıf (YÜKSEK / ORTA / DÜŞÜK), dosya:satır, betik + çıktı (sayılarla), kök neden, en küçük düzeltme önerisi; sıra / eşzamanlılık / yetki tabloları; K1–K12 değerlendirmesi; KULLANICIYA SORULMALI; SONRAKİ SÜRÜME (2.5.1); DOĞRULANMADI; DENENMEYEN; not defteri klasörlerin (tam yol). Bulgu yoksa açıkça 'YÜKSEK / ORTA YOK'.")
open(OUT, 'w', encoding='utf-8').write('\n'.join(p) + '\n')
print(len('\n'.join(p)), len('\n'.join(k)))
