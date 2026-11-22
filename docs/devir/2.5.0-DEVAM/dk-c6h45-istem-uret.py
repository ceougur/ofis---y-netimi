# ANA OTURUM — Ç6-HESAP DÜZELTME TURU 4 + 5 (dar kontrolün ORTA-1 / ORTA-2 / S236 = A düzeltmesi + Gelir Tablosu tek okuma) DAR KONTROL görev metni üreteci; temel üreteç dk-c6h-istem-uret.py. Ç6-HESAP (mali tabloların HESABI: değerleme, satışların maliyeti, Gelir Tablosu, Bilanço, donmuş dönem okuması) TEK DAR KONTROL görev metni üreteci (prensip §9 iskeleti).
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
    dkayit('KULLANICI KARARI 20.11 18:11 UTC'),
    dkayit('KULLANICI KARARI 21.11 21:35 UTC'),
]
SORULAR = [207, 208, 209, 224, 236]
BM = [
    ('K1 (21.11 09:49 — Ç6-HESAP dar kontrolü: ORTA-1 / ORTA-2 / S236 düzeltme kararları)', kararlar(dkayit('BAŞ MİMAR KARARI 21.11 09:49'))),
]
e = dkayit('BAŞ MİMAR KARARI 21.11 10:19'); i = e.find('KARARLARI'); j = e.find('SIRA:', i); assert i > 0
BM.append(('K2 (21.11 10:19 — düzeltme turunun dosya sınırı, süreklilik ve göç kararları)', (e[i:j] if j > 0 else e[i:]).strip()))
BM.append(('K3 (21.11 13:59 — tur 4 raporu: hız, göç numarası beklentisi)', kararlar(dkayit('BAŞ MİMAR KARARI 21.11 13:59'))))
KITAP = 'KG-9, KG-10, KG-11, N-01, §4, §5.1, §5.2, §7.1 ve EK-1 M5 / M6 / M8'
p = []; w = p.append
w("Sen DestekOfis projesinde bağımsız DAR KONTROL incelemecisisin (2.5.0 — Ç6-HESAP DÜZELTME TURU 4 + 5: önceki Ç6 dar kontrolünün ORTA-1 (kural farkı anahtarına alt hesap / cari), ORTA-2 (Kural Farkı Düzeltme Fişi'nden sonra 'Kesin Değil' nedeni ve kalan) ve S236 = A (kilitli yılın değerlemesi kilit anında dondurulur — yeni göç) düzeltmeleri + Gelir Tablosu'nun donmuş toplam okumasının tek çağrıya indirilmesi (hız)). Yalnız HATA ararsın. Düzeltme, commit ve push YAPMAZSIN. MUHASEBE ÇEKİRDEĞİ (mali tablolar, donmuş defter, göç) — eforun high. Yanıtın Türkçe; kısa cümle, madde, tablo. Zamanlanmış görev KURMA. Kendi arka plan işin sürerken rapor vermeden BİTİRME (arka plan koşusunu `timeout -k 5 7200 …` ile başlat; Bash aracının `timeout` parametresini 7200000 ver). Bağlamın daralırsa bitmiş bulgularla ARA RAPOR ver ve dur (ders 46).")
w(f"KİLİT KURALI (ders 50, 52): ölçüm DIŞINDAKİ HER koşu (tek test dahil) `flock -s -w 3600 {SP}/olcum.lock timeout -k 5 <sn> <komut>` (süre sınırı flock'un İÇİNDE); hız ÖLÇÜMÜ `flock -x` ile ve yine süre sınırı İÇERİDE. Ana oturumun ya da başka ajanın özel kilitli ölçümü sürerken koşun bekler — bekle, kilitsiz koşma.")
w("")
w("## Hazırlık")
w(f"1. Worktree'de ÖNCE `git reset --hard {SON}` (incelenecek uç; `{M}` tur 4 + 5'in çalışma dalına birleşimi, ilk ebeveyni birleşim ÖNCESİ kod). `git log --oneline -1` ile doğrula; değilse DUR. Kendi commit'in olmayacak.")
w(f"2. `ln -s /home/user/ofis---y-netimi/node_modules node_modules` (`npm ci` YOK). Tarayıcı gerekirse `PLAYWRIGHT_BROWSERS_PATH={SP}/pw-1194`.")
w(f"3. ÖNCE oku: `CLAUDE.md` (anayasa + dersler 1–54); `docs/BAGIMSIZ-DOGRULAMA-PRENSIBI.md` (tamamı; §3 senin kuralların); muhasebeleştirme kural kitabında (`docs/erp/MUHASEBELESTIRME-KURAL-KITABI.md` + EK-1) {KITAP} satırları (python ile ara); tasarım notu `docs/erp/C6-HESAP-TASARIM.md` — YALNIZ KURAL / TASARIM cümleleri (§11 dahil; koddan ÖNCE yazıldı). OKUNMAZ (prensip §3 bağımsızlık): `docs/devir/2.5.0-DEVAM/` altındaki *-rapor.md, *-istem.txt, *-ek.txt, *-kararlar.md (bu görevin karar dosyası HARİÇ — aşağıda), `docs/2.5.0-IS-LISTESI-KAYIT.md`, `docs/kanit/2026-11-2*/` altındaki ajan ve ana oturum çıktıları. Kodu ve testleri farktan oku.")
w(f"4. TEMİZ büyük veri (OKUNUR; TAZE kendi kopyanı al): `{SP}/ana-kabul/temiz-100k`. v2.4.9 verisi: eski sürümün GERÇEK koduyla üret (`git -C /home/user/ofis---y-netimi worktree add --detach <klasör> v2.4.9`); fikstür `test/fixtures/c6h-v249/`.")
w(f"5. Not defteri: `{SP}/dk-c6h45-<kısa>` (ders 25). Eski kod kopyası `git -C /home/user/ofis---y-netimi archive {M}^1 ':!docs/kanit' | tar -x -C <klasör>` + node_modules bağı; bitince kendi tam yollarını sil (ders 36). `GIT_DIR` / `GIT_WORK_TREE` VERME (ders 54). Disk 5 GB'ın altına düşürülmez (`df -h /`).")
w("")
w("## Kapsam (DURMA KURALI — yalnız bu fark)")
w(f"`git diff {M}^1 {SON} -- server client test docs/erp/C6-HESAP-TASARIM.md ':!test/bagimsiz' ':!docs/kanit'` — ürün dosyaları: server/lib/{{financial-statements, ledger-snapshots, migrations, stock-valuation}}.mjs; testler test/c6h-*.test.mjs ve beklentisi değişen komşular (donmus-defter-*, kural-farki-kapi-disi-250, göç numarası beklentileri).")
w("")
w("## İLK MADDELER (önce bunlar)")
w("1. ORTA-1 (K1): kural farkı alt hesap (ve Bilanço'da cari) düzeyinde mi; alt hesaplar arası yer değiştiren tutar (toplam aynı) artık fark veriyor mu; kasa / banka / cari sınıfında 'Kesin Değil' nedeni doğru tutarla mı.")
w("2. ORTA-2 (K1 metin kararı): fiş tarihinden sonra Yönetim'in düzeltme planının KALANI 0 ise neden düşüyor ve bilgi satırı 'Kural Farkı Düzeltildi (Fiş <numara>)' mı; kalan ≠ 0 ise neden KALAN tutarla mı; fişten önceki tarihte ve fişin dönem dışında olduğu tabloda davranış.")
w("3. S236 = A + K2 (göç): kilit anında değerleme dondurulur; kilitten sonra ürün kartı / birim maliyet düzeltmesi kilitli yılı DEĞİŞTİRMİYOR, açık yıl güncel kartla; dönem başı stok = kilitli yılın DONMUŞ dönem sonu (süreklilik); kilit açılıp yeniden kapanınca dondurma yenileniyor mu; şirket sıfırlama / kopyalama yeni tabloyu temizliyor / taşıyor mu; GÖÇ: şema kapısı, yedek → geri yükleme, eski sürümden (v2.4.9) zincirleme göç, iki şirket (ders 10, 17) — betikle göster.")
w("4. TUR 5 EŞDEĞERLİĞİ: tek çağrıya indirilen donmuş toplam okuması tur 4'ün iki okumasıyla AYNI sonucu mu veriyor — fişten önce / sonra / kilit fiş tarihinden önce, kasa KALAN ≠ 0, ters kayıt; alt defter kümesi boşken (yaşayan bir mutant bu dalı sınamıyor — alt defter farkı olan bir kurgu kur ve sonucu karşılaştır).")
w("5. TESTİN DİŞİ: yeni testler birleşim öncesi kodda BEKLENEN NEDENLE kırmızı mı (ders 38, 51). Yaşayan mutant / eksik test aşağıdaki KULLANICI KURALIYLA 'SONRAKİ SÜRÜME (2.5.1)'.")
w("")
w("## Ne ara (sonra)")
w("- GERİLEME: raporun EN BAŞINDA ayrı başlıkla. Bu farkın dokunmadığı defter / mizan / cari / banka çıktıları ve DÖNEM KİLİDİ (dondurma süresi dahil — kullanıcının gördüğü yol) birleşim öncesi ↔ sonrası BİREBİR mi (temiz büyük veri; v2.4.9 kilitli verisi; iki saat dilimi).")
w("- G2 KOMŞU (ders 10): ledger-snapshots.mjs'in ve migrations.mjs'in değişen işlevlerinin BÜTÜN çağıranları (`server/` ve `test/` taramasıyla).")
w("- HIZ (ders 47): BİLİNEN SINIR — 'dönem içinde etkin Kural Farkı Düzeltme Fişi varken Gelir Tablosu ×1,12–1,20' (2.5.0'da Gelir Tablosu ekranı yok; Ç6-EKRAN 2.5.1'e) — onu YENİDEN bulgu yazma; ama Dönem Kilidi / dondurma ya da başka bir yolu yavaşlatıyorsa yaz (temiz büyük veride, olay döngüsü en çoğu ile).")
w("")
w("## BAŞ MİMAR KARARLARI — DEĞERLENDİR (karar metnine / kitaba / derse uyuyor mu; betikle göster)")
for ad, metin in BM:
    w(f"- {ad}: {metin}")
w("")
k = []
k.append("# Ç6-HESAP TUR 4 + 5 DAR KONTROLÜ — KULLANICI KARARLARI (iş listesinden AYNEN; ana oturum üretti)")
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
w(f"İş listesinden AYNEN çekilmiş karar metinleri ayrı dosyada: `{KYOL}` — TAMAMINI oku (karar blokları: 05.11 17:16 mali müşavir P'nin para kuralları, 20.11 18:11 S224, 21.11 21:35 Ç6-EKRAN 2.5.1'e; sorular: " + ', '.join(f'S{n}' for n in SORULAR) + "). Kural seçilen seçeneğin metnidir.")
w("")
w("BULGU SINIFI — KULLANICI KURALI (bu dar kontrolde GEÇERLİ; CLAUDE.md'den AYNEN): " + BIRAK[0])
w("Bu kurala göre: programın davranışını / sayılarını / hızını ya da kullanıcının gördüğünü DEĞİŞTİRMEYEN husus DÜŞÜK'tür ve raporun 'SONRAKİ SÜRÜME (2.5.1)' başlığına yazılır; programı ya da kullanıcıyı etkileyen her bozulma (yanlış tutar / tablo satırı / Aktif ≠ Pasif / değerleme / kilitli yılın değişmesi, göçte veri kaybı, gerileme) eskisi gibi YÜKSEK / ORTA'dır.")
w("")
w("## Yöntem (prensip §3)")
w("- Her bulgu betikle GERÇEK programda üretilir; çıktıda sayı olur. Program başlatırken `HUKUK_LICENSE_URL=http://127.0.0.1:9`. Üretilemeyen kuşku 'DOĞRULANMADI'ya.")
w("- Eski kod yalnız ayrı kopyada (ders 23, 51).")
w("- Para / kapama / tablo kuralı netleştirmesi gerekirse 'KULLANICIYA SORULMALI' (iki seçenek + öneri; uç durumsa üçüncü seçenek 'Uç durum böyle kalsın (BİLİNEN SINIR)'; 'yaygın programlarda' satırı — doğrulanmış kaynak okunmadıysa 'okunmadı') — kendin kesinleştirme (ders 43).")
w("")
w("## Rapor (prensip §3 biçimi; SubagentHandback)")
w("En başta GERİLEME başlığı; sonra her bulgu: sınıf (YÜKSEK / ORTA / DÜŞÜK), dosya:satır, betik yolu + çıktı (sayılarla), kök neden, en küçük düzeltme önerisi; sonra KULLANICIYA SORULMALI, BAŞ MİMAR KARARLARI değerlendirmesi (K1–K3 tek tek), SONRAKİ SÜRÜME (2.5.1), DOĞRULANMADI, DENENMEYEN, ana oturumun yeniden koşacağı komutlar (tam yol, kilitli). Bulgu yoksa açıkça 'YÜKSEK / ORTA YOK'. Ortam satırı: 'Yük X / 4 çekirdek, bellek boş Y GB, disk boş Z GB'.")
open(OUT, 'w', encoding='utf-8').write('\n'.join(p) + '\n')
print(OUT, len('\n'.join(p)), KOUT)
