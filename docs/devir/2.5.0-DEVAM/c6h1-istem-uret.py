# ANA OTURUM — Ç6-HESAP TUR 1 görev metni üreteci (KISA, TEK İŞ: tasarım notu + dönem sonu stok değerlemesi + Gelir Tablosu HESABI).
# Kararlar iş listesi D'den, satırlar kural kitabından / çekirdek planından AYNEN. Çağrı: cd <depo>; python3 -I <bu> <çıktı> <taban dalı> <taban ucu (kısa sha)>
import sys
SP = '/tmp/claude-0/-home-user/de5e1cbf-7e68-5683-b7bb-f27655eaed4f/scratchpad'
CIKTI, TABAN, UC = sys.argv[1], sys.argv[2], sys.argv[3]
il = open('docs/2.5.0-IS-LISTESI.md', encoding='utf-8').read().split('\n')
kk = open('docs/erp/MUHASEBELESTIRME-KURAL-KITABI.md', encoding='utf-8').read().split('\n')
pl = open('docs/erp/MUHASEBE-CEKIRDEGI-PLANI.md', encoding='utf-8').read().split('\n')
on = open('docs/devir/2.5.0-DEVAM/c5a2-istem.txt', encoding='utf-8').read().split('\n')
def tek(lines, b):
    h = [l for l in lines if l.startswith(b)]; assert len(h) == 1, (b, len(h)); return h[0].strip()
def blok(lines, b):
    h = [i for i, l in enumerate(lines) if l.startswith(b)]; assert len(h) == 1, (b, len(h))
    j = h[0] + 1
    while j < len(lines) and lines[j].startswith('  '): j += 1
    return ' '.join(x.strip() for x in lines[h[0]:j])
def blok2(lines, b):
    h = [i for i, l in enumerate(lines) if l.startswith(b)]; assert len(h) == 1, (b, len(h)); return lines[h[0]].strip() + ' ' + lines[h[0] + 1].strip()
C6 = tek(il, '| Ç6 |')
B0655 = blok(il, '- BAŞ MİMAR KARARI 06.11 07:55')
HEPSI_A = blok(il, '- KULLANICI KARARI (05.11 17:16 UTC')
KG = [tek(kk, b) for b in ('| KG-9 K |', '| KG-10 |', '| KG-11 K |', '| KG-12 K |', '| KG-13 K |', '| KG-14 |')]
PK = [tek(pl, b) for b in ('- YÜKSEK-1:', '- 7/A kalır;', '- Kasa çıkışı (hesap seçimi', '- Stok birim maliyeti DÖNEMSEL')]
TEKDAL = blok2(pl, 'KULLANICI KARARI 05.11 17:16 "hepsi A"')
assert on[36].startswith('- G2 komşu') and on[37].startswith('- Koşular') and on[42].startswith('- PARA / DEFTER') and on[44].startswith("- İşleri ayrı") and on[47].startswith('- Commit iletisi'), 'c5a2 satırları kaydı'
o = []; w = o.append
w("Sen DestekOfis projesinde Ç6-HESAP TUR 1 KOD ajanısın (2.5.0 muhasebe çekirdeği; mali tabloların HESABI — ekran DEĞİL; eforun high). TEK İŞ: Ç6-HESAP'ın tasarım notu + dönem sonu stok değerlemesi (kural kitabı §5) + Gelir Tablosu hesabı (§4, §7.1). Bilanço ve ekranlar SONRAKİ turlarda. Yanıtın Türkçe. PUSH YOK.")
w("")
w("## Hazırlık")
w(f"1. Worktree'de `git reset --hard {TABAN}` (ajan ağacı ana daldan açılmış olabilir — birleştirme DEĞİL sıfırlama); `git log --oneline -3` ucu {UC} göstermeli, değilse DUR. `ln -s /home/user/ofis---y-netimi/node_modules node_modules` (`npm ci` YOK); tarayıcı gerekirse `PLAYWRIGHT_BROWSERS_PATH={SP}/pw-1194`. ESKİ KOD (kırmızı kanıt) = `{TABAN}`. Kopyalar `git -C /home/user/ofis---y-netimi archive <ref> ':!docs/kanit' | tar -x -C <klasör>` (+ node_modules bağı); eski sürüm ETİKETİ gerekiyorsa `git -C /home/user/ofis---y-netimi worktree add --detach <klasör> <ref>` (ders 54). Not defteri `{SP}/c6h1-<kısa>` (ders 25); disk 5 GB'ın altına düşmez.")
w("2. ÖNCE oku: `CLAUDE.md` dersleri (özellikle 3, 5, 6, 7, 10, 11, 13, 17, 22, 23, 25, 38, 40, 43, 44, 47, 52, 53, 54) ve 'Yazım düzeni'; `docs/BAGIMSIZ-DOGRULAMA-PRENSIBI.md` §5; `docs/erp/MUHASEBE-CEKIRDEGI-PLANI.md` §0, §7, §8, §9 (madde 6, 8, 9, 10), §13; `docs/erp/MUHASEBELESTIRME-KURAL-KITABI.md` §1, §2, §3-S, §3-N, §4, §5, §7, §8, §9 ve eklerin (`-EK-1.md`, `-EK-2.md`, `-EK-2B.md`) değerleme / mali tablo maddeleri; `docs/devir/DEVIR-PLANI.md` §11.4 (değerleme devirde AYNI işlevle). Kodda: `server/lib/general-ledger.mjs` hesap planı (ACCOUNT_PLAN, INCOME_STATEMENT_ITEMS, BALANCE_SHEET_ITEMS, incomeStatementItemOf, trialBalance) ve `server/routes/ledger.mjs` `book()` — karma yevmiye (kilitli dönem donmuş defterden, açık dönem canlı türetmeden); Ç6 raporlarının TEK kaynağı budur, ayrı türetme / ikinci para motoru YAZILMAZ (plan §0 TEMEL İLKE).")
w("3. BEKLENENLERİN KAYNAĞI (ders 5, 32, 40): kullanıcı kararları + kural kitabı + plan. Kâhin MODEL dosyaları (`test/bagimsiz/muhasebe/**`, `test/bagimsiz/defter/kahin.py`, `test/bagimsiz/cari/model.py`) OKUNMAZ ve kodun kaynağı yapılmaz; `test/bagimsiz/**` DEĞİŞTİRİLMEZ — program ↔ muhasebe kâhini karşılaştırması bu turdan sonra ayrı sürücü bakımında yapılır.")
w(f"4. TEMİZ büyük veri (OKUNUR; kendi kopyanı al): `{SP}/ana-kabul/temiz-100k`; ölçüm betiği örnekleri `{SP}/c7a-t2b/olcum/` (kendi klasörüne kopyala).")
w("")
w("## Kaynaklar (AYNEN)")
w("İŞ LİSTESİ Ç6 SATIRI: " + C6)
w("BAŞ MİMAR KARARI (Ç6 İKİYE): " + B0655)
w("KULLANICI KARARI: " + HEPSI_A)
w("KURAL KİTABI KG SATIRLARI (KG-9 / KG-11 / KG-12 yukarıdaki kullanıcı kararıyla A; KG-13 aşağıdaki plan satırıyla A — sorulmadı; KG-10 / KG-14 sınıflama — kitabın önerisi A):")
for k in KG: w("  " + k)
w("ÇEKİRDEK PLANI §13 (kabul edilenler, AYNEN): " + ' '.join(PK))
w("ÇEKİRDEK PLANI §13 (son paragraf, AYNEN): " + TEKDAL)
w("")
w("## İş (sırayla; her biri bitince HEMEN commit)")
w("1. TASARIM NOTU `docs/erp/C6-HESAP-TASARIM.md` (koddan önce; KISA): Ç6-HESAP'ın BÜTÜNÜ (bu tur + sonraki turlar): modül sınırı ve dosya adları; değerleme işlevinin girdisi (ürün, alış / alış iadesi kalemleri, stok açılışı M-07, eksi miktar, hizmet kalemi) ve TEK işlev olarak devre (D3 / D4) nasıl verileceği; Gelir Tablosu ve Bilanço'nun `book()` + mizan üzerinden kurulması (kilitli dönem donmuş, açık dönem canlı; kapanış sınıfı maddeleri §4); ara toplamlar; '.90 Sınıflandırılmamış' alt satırlar (Ç7b'nin getireceği 600.90 / 610.90 / 602.90 / 336.90 / 649.90 / 770.90 / 601 BAŞTAN — hesap önekinden, sabit listeyle değil); 'Kesin Değil' nedenlerini TEK toplayıcının üretmesi (§7.4; bu turda GT'nin kendi nedenleri, Bilanço'nunkiler sonraki turda); dipnot tutarları (§7.5 (3), (6)); okuma ucu (yeni rota dosyası, Ana Defter raporlarıyla AYNI yetki — Muhasebe görür, personel görmez); hacim (plan §8: 100 bin satırda ≤ 3 sn, olay döngüsü en çok ≤ 50 ms; öğe başına okuma YOK — ders 47); önbellek / iş parçacığı gerekirse hangi desen; ara dönem (çeyrek, özel aralık) satışların maliyeti tahmininin kitapta nasıl tanımlandığı (§5.1 dönem = mali yıl) — kitap ve ekler söylemiyorsa KODLAMA, KULLANICIYA SORULMALI; 'nasıl bozulur' listesi (plan §9 madde 6, 8, 9, 10 + iki şirket + yedek / geri yükleme okuması).")
w("2. DEĞERLEME (§5.1, §5.2; KG-9 A, KG-10 A, KG-11 A, KG-12 A'nın 'önceki yıl sonları için de §5 değerlemesi'): ürün başına dönemsel ağırlıklı ortalama (yıl yıl, DBS = önceki yılın DSS'si); G-1 yuvarlama; toplu SQL (ürün başına sorgu YOK). Çıktı: ürün bazında miktar / birim maliyet / değer + uyarılar (KG-9, KG-10) + yıl bazında DBS / alış / alış iadesi / DSS / satışların maliyeti.")
w("3. GELİR TABLOSU HESABI (§4, §7.1; YÜKSEK-1; KG-11 A): dönem [a, b] (aylık / çeyrek / yıllık / özel aralık — hesap tek işlev), kalem → hesap → alt hesap; 7/A gider hesapları yansıtıldıkları satırda; ara toplamlar (Net Satışlar … Dönem Net Kârı); 'Satışların Maliyeti (Tahmini)' değerlemeden; K satırı (KG-13 A) boş ve açıklamalı; Kesin Değil nedenleri ve dipnot tutarları veri olarak. Okuma ucu (JSON; ekran Ç6-EKRAN'ın).")
w("4. BİTİŞ: yeni testlerin iki TZ; değiştirdiğin / kaydettiğin dosyaları anan testler (taramayla — ders 10; `server/app.mjs` rota kaydı → rota listesi / yetki testleri komşu); `npm run test:kahin-defter` ve `npm run test:kahin-cari` önce / sonra AYNI (bu tur türetmeye dokunmaz; değişen her sayı BULGU). Tam npm test YOK.")
w("KAPSAM DIŞI (DOKUNMA; sonraki turlar): Bilanço (ters bakiye brütleştirme, hesaplanmış Dönem Net Kârı / Geçmiş Yıllar — Kapanmamış satırları, Aktif = Pasif, Bilanço'nun Kesin Değil nedenleri); Ç7b tasarım notunun B-5 metni (`lib/ledger-opening.mjs` — sonraki tur); ekranlar / PDF / Excel / rapor merkezi kaydı (Ç6-EKRAN); dönem sonu kapanış fişi (D4); sürücü / kâhin eşlemesi.")
w("")
w("## Kanıt")
w("- Her yeni test: `" + TABAN + "` kopyasında KIRMIZI ve nedeni iletide okunur (ders 38, 51) — yeni uç için 'yok' kırmızısı tek başına diş sayılmaz; DİŞİ mutantlar verir; yeni kodda yeşil; iki TZ; ay / çeyrek / yıl sonu ve 29 Şubat (ders 13, 22 — sahte saat). İç tutarlılık: GT'nin hesap toplamları aynı dönemin Hesap Planı Mizanı'nın 6 / 7 hareketleriyle BİREBİR (boş dönem, tek kayıt, tam veri; kilitli ve kilitsiz dönem; iki şirket karışmaz). Değerlemenin beklenenleri ELLE hesaplanmış küçük örneklerden (kitabın formülüyle, testte açıkça yazılı) — programın çıktısından türetilmez.")
w("- Karşı mutantlar DEĞERLE (birden çok koşu): 7/A yansıtmayı yok say; iadeyi (610) ters işaretle; alış iadesini birim maliyetten düşme; KG-9'da eksi değer ver; dönem sınırını bir gün kaydır; kapanış sınıfı maddelerini dahil et; '.90' alt satırını ana satıra kat; kilitli dönemde donmuş defter yerine canlı türetmeyi oku; DBS'yi önceki yıldan alma.")
w("- HACİM (ders 47, 53 (a)): temiz-100k kopyasında GT (yıllık + çeyrek) ve değerleme süresi + olay döngüsü en çok; ölçüm `flock -x -w 3600 " + SP + "/olcum.lock -c '<komut>'` (tek seferlik bekleme, döngü YOK); ölçüm raporuna /proc/loadavg yaz (yük > 2 ise geçersiz, yinele).")
w(on[36])
w(on[37].replace('c5a2-<ad>', 'c6h1-<ad>').replace('docs/kanit/<gün>/c5a2-*', 'docs/kanit/<gün>/c6h1-*'))
w("- ÖLÇÜM KİLİDİ: ana oturum ya da başka ajan `olcum.lock`'u ÖZEL tutabilir. Yük koşusu kilit doluysa tek seferlik `flock -s -w 3600 " + SP + "/olcum.lock -c '<komut>'` (döngü YOK); beklerken okuma / kod / TEK test dosyası. Kabul koşulunu 'kilit dolu' diye ATLAMA.")
w("")
w("## Kurallar — DOSYA SINIRI (Ç7b aynı anda türetme dosyalarına yazıyor)")
w("- Yazabileceğin: YENİ `server/lib/` dosyaları (tasarım notunda adlandırdığın — ör. mali tablolar ve stok değerlemesi), YENİ `server/routes/` rota dosyası, `server/app.mjs` (YALNIZ yeni rotanın kaydı), testler (`test/c6h-*`) + `test/fixtures/**` (yeni dosya), tasarım notu.")
w("- YAZILMAZ: `server/lib/general-ledger.mjs`, `server/routes/ledger.mjs`, `server/lib/ledger-*.mjs`, `server/lib/integrity*.mjs`, `server/lib/migrations.mjs` (GÖÇ YOK), `server/routes/{invoices,tax,stock,report-center}.mjs`, `client/**`, kılavuz, `.github/**`, package.json, tools/**, `test/bagimsiz/**`. Bunlardan birinde değişiklik (ör. bir işlevi dışa açmak) gerekirse DUR, 'BAŞ MİMAR KARARI GEREKİYOR' diye raporla.")
w(on[42])
for i in (44, 45, 46, 47, 48, 49): w(on[i])
w("- KAPSAYICI YENİDEN BAŞLAYABİLİR: her bitmiş adım HEMEN commit (kanıt dahil). Bağlamın daralırsa BİTMİŞ adımların commit'leriyle ARA RAPOR ver ve dur (ders 46). Bağlamını koru: uzun çıktıyı dosyaya yaz, yalnız sayıları oku.")
w("")
w("## Rapor")
w("EN BAŞTA: tasarım notunun özeti (modül, uç, tek işlev); örnek veriyle Gelir Tablosu kalemleri ve değerleme (sayıyla); yeni testlerin kırmızı nedeni + yeşili (iki TZ); mutantlar (hangisi hangi testte, kaç koşu); iç tutarlılık; hacim ölçümü (süre, olay döngüsü, yük); komşu / kâhin önce-sonra sayıları; sürücü için (okuma ucunun adı ve çıktı alanları — kâhin eşlemesi ayrı bakımda); ana oturumun yeniden koşacağı komutlar + beklenen sayılar; commit'ler; BAŞ MİMAR KARARI GEREKİYOR; KULLANICIYA SORULMALI (iki seçenek + öneri + 'yaygın programlarda nasıl' — yalnız doğrulanmış kaynakla; uç durumsa 'Uç durum böyle kalsın (BİLİNEN SINIR)'); DOĞRULANMADI; DENENMEYEN; not defteri klasörleri.")
open(CIKTI, 'w', encoding='utf-8').write('\n'.join(o) + '\n')
print('yazıldı', CIKTI, sum(len(x) for x in o))
