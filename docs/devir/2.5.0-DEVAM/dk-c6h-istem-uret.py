# ANA OTURUM — Ç6-HESAP (mali tabloların HESABI: değerleme, satışların maliyeti, Gelir Tablosu, Bilanço, donmuş dönem okuması) TEK DAR KONTROL görev metni üreteci (prensip §9 iskeleti).
# Ç6-HESAP tur 1–3 çalışma dalına TEK birleşimle girdi (0feb5b86) + v2.4.9 sınıf testi fikstürü (237a146e) + ana oturumun e2e beklenti düzeltmesi (01d82b6a — Ç7b'nin Kural Farkı
# Düzeltme fişi; ana oturum yazdı, dar kontrol bu yüzden ayrıca bakar). Kararlar iş listesinden AYNEN; baş mimar kararlarından YALNIZ 'KARARLAR' paragrafları (raporların özetleri,
# 'ajanın sayıları' VERİLMEZ — prensip §3).
# Çağrı: cd <depo>; python3 -I <bu> <çıktı -istem.txt> <birleşim commit'i> <son commit (e2e düzeltmesi)>
import sys
OUT, M, SON = sys.argv[1], sys.argv[2], sys.argv[3]
SP = '/tmp/claude-0/-home-user/de5e1cbf-7e68-5683-b7bb-f27655eaed4f/scratchpad'
t = open('docs/2.5.0-IS-LISTESI.md', encoding='utf-8').read()
il = t.split('\n')
D = t[t.find('\n## D'):t.find('\n## E')]
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


def kararlar(e):
    i = e.find('KARARLAR'); assert i >= 0, e[:80]
    j = e.find('SIRA:', i)
    return e[i:j].strip() if j > 0 else e[i:].strip()


def soru(n):
    return tek(il, f'  S{n} (')


BIRAK = [l.strip() for l in cl if l.strip().startswith("2.5.1'E BIRAK")]
assert len(BIRAK) == 1

KUL = [
    dkayit('KULLANICI KARARI (05.11 17:16 UTC'),
    dkayit('KULLANICI KARARI 06.11 10:57 UTC'),
    dkayit('KULLANICI KARARI 20.11 18:11 UTC'),
]
SORULAR = [47, 207, 208, 209, 224]

BM = [
    ('K1 (19.11 22:45 — Ç6-HESAP tur 1: değerleme, satışların maliyeti, Gelir Tablosu)', kararlar(dkayit('BAŞ MİMAR KARARI 19.11 22:45'))),
    ('K2 (20.11 11:37 — Ç6-HESAP tur 2: Bilanço)', kararlar(dkayit('BAŞ MİMAR KARARI 20.11 11:37'))),
    ('K3 (20.11 18:07 — Ç6-HESAP tur 3: donmuş dönem okuması, hız, v2.4.9 sınıf testi)', kararlar(dkayit('BAŞ MİMAR KARARI 20.11 18:07'))),
]
d0844 = [e for e in dent if e.startswith('BAŞ MİMAR KARARI 21.11') and 'Ç6-HESAP ÇALIŞMA DALINDA' in e[:120]]
assert len(d0844) == 1
d0844 = d0844[0]
i = d0844.find('(1) Ç6-HESAP'); j = d0844.find('ÇALIŞMA DALINA:', i); assert i > 0 and j > i
BM.append(('K4 (21.11 — Ç7b ile birleşimde v2.4.9 sınıf testine eklenen 14 fark)', d0844[i:j].strip()))
i = d0844.find('(2) CI #1087'); j = d0844.find('(3)', i); assert i > 0 and j > i
BM.append(('K5 (21.11 — ana oturumun e2e beklenti düzeltmesi; Ç7b Kural Farkı Düzeltme fişi)', d0844[i:j].strip()))

KITAP = 'KG-9, KG-10, KG-11, N-01, §3.11b, §4, §5.1, §5.2, §7.1 ve EK-1 M5 / M6'

p = []; w = p.append
w("Sen DestekOfis projesinde bağımsız DAR KONTROL incelemecisisin (2.5.0 — Ç6-HESAP: mali tabloların HESABI — stok değerlemesi, satışların maliyeti (tahmini), Gelir Tablosu, Bilanço, kilitli dönemin donmuş defterden okunması; tur 1–3 TEK birleşimle çalışma dalına girdi). Yalnız HATA ararsın. Düzeltme, commit ve push YAPMAZSIN. MUHASEBE ÇEKİRDEĞİ (mali tablolar, defter okuması) — eforun high. Yanıtın Türkçe. Zamanlanmış görev / ScheduleWakeup / CronCreate KULLANMA. Kendi arka plan işin sürerken rapor vermeden bitirme.")
w("")
w("## Hazırlık")
w(f"1. Worktree'de ÖNCE `git reset --hard {SON}` (incelenecek uç; `{M}` Ç6-HESAP birleşimi, ilk ebeveyni birleşim öncesi kod = Ç6 ÖNCESİ). `git log --oneline -1` ile doğrula; değilse DUR. Kendi commit'in olmayacak.")
w(f"2. `ln -s /home/user/ofis---y-netimi/node_modules node_modules` (`npm ci` YOK). Tarayıcı: `PLAYWRIGHT_BROWSERS_PATH={SP}/pw-1194`.")
w(f"3. ÖNCE oku: `CLAUDE.md` (anayasa + dersler 1–54); `docs/BAGIMSIZ-DOGRULAMA-PRENSIBI.md` (tamamı; §3 senin kuralların); muhasebeleştirme kural kitabında (`docs/erp/MUHASEBELESTIRME-KURAL-KITABI.md` + EK-1) {KITAP} satırları (python ile ara); tasarım notu `docs/erp/C6-HESAP-TASARIM.md` — YALNIZ KURAL / TASARIM cümleleri (§1–§10; koddan ÖNCE yazıldı); muhasebe çekirdeği planı `docs/erp/MUHASEBE-CEKIRDEGI-PLANI.md` (Ç6 satırları).")
w("   OKUNMAZ (prensip §3 bağımsızlık): `docs/devir/2.5.0-DEVAM/` altındaki *-rapor.md, *-istem.txt, *-ek.txt, *-kararlar.md dosyaları (bu görevin karar dosyası HARİÇ — aşağıda), `docs/2.5.0-IS-LISTESI-KAYIT.md`, `docs/kanit/2026-11-*/` altındaki ajan ve ana oturum çıktıları. Kodu ve testleri farktan oku.")
w(f"4. TEMİZ büyük veri (OKUNUR; kendi kopyanı al): `{SP}/ana-kabul/` (temiz-100k). v2.4.9 verisi: eski sürümün GERÇEK koduyla üret (`git -C /home/user/ofis---y-netimi worktree add --detach <klasör> v2.4.9`); fikstür `test/fixtures/c6h-v249/` de bu yolla üretilmiştir (üreteci `uret.mjs.txt`).")
w(f"5. Not defteri: `{SP}/dk-c6h-<kısa>` (ders 25). Eski kod kopyası `git -C /home/user/ofis---y-netimi archive {M}^1 ':!docs/kanit' | tar -x -C <klasör>` + node_modules bağı; eski sürüm ETİKETİ isteyen test için `git -C /home/user/ofis---y-netimi worktree add --detach <klasör> <ref>`, bitince `git -C /home/user/ofis---y-netimi worktree remove --force <o tam yol>` (ders 54: `GIT_DIR` / `GIT_WORK_TREE` VERİLMEZ). pkill / killall / joker rm YOK (ders 36). TAM npm test YOK. Ölçüm (hız) yaparsan `flock -x {SP}/olcum.lock`; yük koşusu (e2e yığını, mutasyon) `flock -s` aynı kilit (ders 52); arka plan koşusu en çok 2 saat sınırla.")
w("")
w("## Kapsam (DURMA KURALI — yalnız bu fark)")
w(f"`git diff {M}^1 {SON} -- server client test docs/erp/C6-HESAP-TASARIM.md ':!test/bagimsiz'` — ürün dosyaları: server/app.mjs (uç kaydı), server/lib/{{financial-statements, financial-statements-worker, ledger-snapshots, stock-valuation}}.mjs, server/routes/financial-statements.mjs; testler test/c6h-*.test.mjs + fikstür test/fixtures/c6h-v249/ (beklenen-farklar.json — her fark karar numarasıyla); AYRICA ana oturumun yazdığı e2e beklenti değişikliği test/e2e/senaryo-acilis-duzeni-250.mjs (K5 — bunu yazan el ana oturumdur, bağımsız gözle DEĞERLENDİR). Ç6-HESAP'ın arayüzü YOK (Ç6-EKRAN ayrı iş) — uçlar API'den sınanır.")
w("")
w("## İLK MADDELER (önce bunlar)")
w("1. MİZAN ↔ TABLO (kitap §4, §7.1): Gelir Tablosu ve Bilanço satırları aynı dönemin mizanından (6 / 7 sınıfı kapanmadan) BİREBİR türüyor mu; Aktif = Pasif her tarihte (dönem kârı Pasif'te); '.90' alt hesaplar kendi satırında; boş dönem, tek kayıt, ileri tarih, yıl dönümü (ders 13 — sahte saat); iki saat dilimi (ders 22).")
w("2. DEĞERLEME + SATIŞLARIN MALİYETİ (KG-9 A, KG-10 A, KG-11 A, §5.1, §5.2, S207–S209): dönemsel ağırlıklı ortalama; alış iadesi, satıştan iade, eksi stok, silinmiş ürün kartı, iki mali yıla taşan özel aralık, alışlardan büyük alış iadesi; tutarları ELLE hesapla ve programla karşılaştır (ders 5 — beklenen sayı programın kodundan türetilmez).")
w("3. KİLİTLİ DÖNEM (Ç3 dondurması + ledger-snapshots okuyucusu): kilitli dönemin tablosu donmuş defterden mi okunuyor, türetme kuralı değişince (Ç7b'nin kural geçiş günü dahil) kilitli yılın tablosu DEĞİŞMİYOR mu; açık dönemde canlı türetme; kilit ucu ile aynı gün hareket; Kural Farkı Düzeltme fişi yazıldıktan sonra tablo.")
w("4. v2.4.9 SINIF TESTİ (ders 53 (b)): beklenen-farklar.json'daki HER fark bir karar numarasıyla mı ve o karar metni bu farkı GERÇEKTEN söylüyor mu (yanlış etiketlenmiş fark = bulgu); sınıf listesi her kayıt türü × boş / eksik / tam × kilitli / kilitsiz'i kapsıyor mu; eksik sınıf varsa adını yaz.")
w("5. YETKİ VE ÇALIŞTIRMA (tasarım §8): rol × uç (yönetici / muhasebe / öbürleri); reddedilen istek veri tabanında iz bırakıyor mu (ders 3); worker'da koşma ve iptal; iki şirket (ders 17) — başka şirketin defterine karışma yok.")
w("6. K5 — ANA OTURUMUN E2E DÜZELTMESİ: yeni beklenti ('önce 500 / 519, sonra yalnız 6 / 7 sınıfı satırlar, borç = alacak toplam') Ç7b tasarım notunun ve kararların söylediğiyle aynı mı, bir gerilemeyi örtüyor mu, dişi var mı (fiş dengesizken / 6 / 7 dışı satır varken kırmızı olur mu — betikle göster).")
w("7. TESTİN DİŞİ (prensip §3): yeni testler Ç6 ÖNCESİ kodda BEKLENEN NEDENLE kırmızı mı (ders 38, 51). YENİ MUTANT YAZMAK ZORUNLU DEĞİL; yaşayan mutant / eksik test aşağıdaki KULLANICI KURALIYLA 'SONRAKİ SÜRÜME (2.5.1)' başlığına yazılır, yeni tur açmaz.")
w("")
w("## Ne ara (sonra)")
w("- GERİLEME: raporun EN BAŞINDA ayrı başlıkla. Ç6'nın dokunmadığı defter / mizan / cari / banka / rapor çıktıları birleşim öncesi ↔ sonrası BİREBİR mi (temiz büyük veri; v2.4.9 kilitli verisi; iki saat dilimi).")
w("- G2 KOMŞU (ders 10): ledger-snapshots.mjs'in ve financial-statements.mjs'in okuduğu ortak yardımcıların BÜTÜN çağıranları (`server/` ve `test/` taramasıyla); app.mjs'e eklenen uç başka bir yolu gölgeliyor mu.")
w("- HIZ (ders 47): öğe başına ağır okuma (ürün / hesap başına alt sorgu, bütün hareketlerin JS'e çevrilmesi) var mı — temiz büyük veride olay döngüsü en çoğu ile. Bilinen sınır: S224 = A (ilk açılış süresi) — onu YENİDEN bulgu yazma; ama başka bir yolu kilitliyorsa yaz.")
w("")
w("## BAŞ MİMAR KARARLARI — DEĞERLENDİR (karar metnine / kitaba / derse uyuyor mu; betikle göster)")
for ad, metin in BM:
    w(f"- {ad}: {metin}")
w("")
k = []
k.append("# Ç6-HESAP DAR KONTROLÜ — KULLANICI KARARLARI (iş listesinden AYNEN; ana oturum üretti)")
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
w(f"İş listesinden AYNEN çekilmiş karar metinleri ayrı dosyada: `{KYOL}` — TAMAMINI oku (karar blokları: 05.11 17:16 mali müşavir P'nin para kuralları (KG-9 / KG-10 / KG-11 dahil), 06.11 10:57 S47–S53, 20.11 18:11 S224; sorular: " + ', '.join(f'S{n}' for n in SORULAR) + "). Kural seçilen seçeneğin metnidir.")
w("")
w("BULGU SINIFI — KULLANICI KURALI (bu dar kontrolde GEÇERLİ; CLAUDE.md'den AYNEN): " + BIRAK[0])
w("Bu kurala göre: programın davranışını / sayılarını / hızını ya da kullanıcının gördüğünü DEĞİŞTİRMEYEN husus DÜŞÜK'tür ve raporun 'SONRAKİ SÜRÜME (2.5.1)' başlığına yazılır; programı ya da kullanıcıyı etkileyen her bozulma (yanlış tutar / tablo satırı / Aktif ≠ Pasif / değerleme / kilitli yılın değişmesi, gerileme, veri kaybı) eskisi gibi YÜKSEK / ORTA'dır.")
w("")
w("## Yöntem (prensip §3)")
w("- Her bulgu betikle GERÇEK programda üretilir; çıktıda sayı olur. Program başlatırken `HUKUK_LICENSE_URL=http://127.0.0.1:9`. Üretilemeyen kuşku 'DOĞRULANMADI'ya.")
w("- Eski kod yalnız ayrı kopyada (ders 23, 51); gerilemenin hangi commit'le geldiği yazılır.")
w("- Para / kapama / tablo kuralı netleştirmesi gerekirse 'KULLANICIYA SORULMALI' (iki seçenek + öneri; uç durumsa üçüncü seçenek 'Uç durum böyle kalsın (BİLİNEN SINIR)') — kendin kesinleştirme (ders 43).")
w("")
w("## Rapor (prensip §3 biçimi)")
w("En başta GERİLEME başlığı; sonra her bulgu: sınıf (YÜKSEK / ORTA / DÜŞÜK), dosya:satır, betik yolu + çıktı (sayılarla), kök neden, en küçük düzeltme önerisi; sonra KULLANICIYA SORULMALI, BAŞ MİMAR KARARLARI değerlendirmesi (K1–K5 tek tek), SONRAKİ SÜRÜME (2.5.1), DOĞRULANMADI, DENENMEYEN. Bulgu yoksa açıkça 'YÜKSEK / ORTA YOK'. Raporu SubagentHandback ile ver.")
open(OUT, 'w', encoding='utf-8').write('\n'.join(p) + '\n')
print(OUT, len('\n'.join(p)), KOUT)
