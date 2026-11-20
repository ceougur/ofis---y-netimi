# ANA OTURUM — Ç6-HESAP TUR 2 görev metni üreteci (KISA, TEK İŞ: Bilanço HESABI + Kesin Değil'in Bilanço nedenleri + tur 1'den kalan üç kod maddesi).
# Kararlar iş listesi C / D'den, satırlar kural kitabından AYNEN (19.11 07:21 turlara bölme; 22:45 B-a / B-d; 23:18 uç testi; S209 = B).
# Çağrı: cd <depo>; python3 -I <bu> <çıktı> <taban dalı> <taban ucu (kısa sha)>
import sys
SP = '/tmp/claude-0/-home-user/de5e1cbf-7e68-5683-b7bb-f27655eaed4f/scratchpad'
CIKTI, TABAN, UC = sys.argv[1], sys.argv[2], sys.argv[3]
t = open('docs/2.5.0-IS-LISTESI.md', encoding='utf-8').read()
il = t.split('\n')
D = t[t.find('\n## D'):]
dent = D.split('\n- ')[1:]
kk = open('docs/erp/MUHASEBELESTIRME-KURAL-KITABI.md', encoding='utf-8').read().split('\n')
on = open('docs/devir/2.5.0-DEVAM/c5a2-istem.txt', encoding='utf-8').read().split('\n')


def tek(lines, b):
    h = [l for l in lines if l.startswith(b)]; assert len(h) == 1, (b, len(h)); return h[0].strip()


def dkayit(onek):
    x = [e for e in dent if e.startswith(onek)]; assert len(x) == 1, (onek, len(x)); return x[0].strip()


def kes(metin, bas, son):
    i = metin.find(bas); assert i >= 0, bas
    j = metin.find(son, i); assert j >= 0, son
    return metin[i:j + len(son)].strip()


def bolum(lines, bas, son):
    i = [k for k, l in enumerate(lines) if l.startswith(bas)]; assert len(i) == 1, bas
    j = [k for k, l in enumerate(lines) if l.startswith(son) and k > i[0]][0]
    return ' '.join(x.strip() for x in lines[i[0]:j] if x.strip())


D0721 = dkayit('BAŞ MİMAR KARARI 19.11 07:21')
d2245 = dkayit('BAŞ MİMAR KARARI 19.11 22:45')
d2318 = dkayit('BAŞ MİMAR KARARI 19.11 23:18')
BA = kes(d2245, '(B-a) kapanmış yılın ara dönemi', "yalnız Aralık'ta gösteriyor).")
BD = kes(d2245, "(B-d) 'Defter mutabakatı farkı'", 'KABUL.')
UC_T = kes(d2318, "'gozlem' ZORLAMA KİPİ NEDENİ OKUNDU", 'görev maddesi.')
S209 = tek(il, '  S209 (')
K4 = bolum(kk, '## 4. Rapor dönemi', '## 5.')
K72 = bolum(kk, '**7.2 Bilanço', '**7.3')
K73 = bolum(kk, '**7.3 Ters bakiye', '**7.4')
K74 = bolum(kk, '**7.4 "Kesin Değil"', '**7.5')
KG = [tek(kk, b) for b in ('| KG-12 K |', '| KG-14 |')]
cl = open('CLAUDE.md', encoding='utf-8').read().split('\n')
BIRAK = [l.strip() for l in cl if l.strip().startswith("2.5.1'E BIRAK")]
assert len(BIRAK) == 1
assert on[36].startswith('- G2 komşu') and on[37].startswith('- Koşular') and on[42].startswith('- PARA / DEFTER') and on[44].startswith("- İşleri ayrı") and on[47].startswith('- Commit iletisi'), 'c5a2 satırları kaydı'

o = []; w = o.append
w("Sen DestekOfis projesinde Ç6-HESAP TUR 2 KOD ajanısın (2.5.0 muhasebe çekirdeği; mali tabloların HESABI — ekran DEĞİL; eforun high). TEK İŞ: BİLANÇO hesabı (kitap §4, §7.2, §7.3) + Kesin Değil'in Bilanço nedenleri (§7.4, tek toplayıcı) + tur 1'den kalan iki kod maddesi (B-a, S209 = B). Ekranlar SONRAKİ iş (Ç6-EKRAN). Yanıtın Türkçe. PUSH YOK. Zamanlanmış görev KURMA.")
w("")
w("## Hazırlık")
w(f"1. Worktree'de `git reset --hard {TABAN}` (ajan ağacı ana daldan açılmış olabilir — birleştirme DEĞİL sıfırlama); `git log --oneline -3` ucu {UC} göstermeli, değilse DUR. Taban = çalışma dalı + Ç6-HESAP tur 1 (c6h1-uc) birleşimi. `ln -s /home/user/ofis---y-netimi/node_modules node_modules` (`npm ci` YOK); tarayıcı gerekirse `PLAYWRIGHT_BROWSERS_PATH={SP}/pw-1194`. ESKİ KOD (kırmızı kanıt) = `{TABAN}`. Kopyalar `git -C /home/user/ofis---y-netimi archive <ref> ':!docs/kanit' | tar -x -C <klasör>` (+ node_modules bağı); eski sürüm ETİKETİ gerekiyorsa `git -C /home/user/ofis---y-netimi worktree add --detach <klasör> <ref>` (ders 54: `GIT_DIR` / `GIT_WORK_TREE` VERME). Not defteri `{SP}/c6h2-<kısa>` (ders 25); disk 5 GB'ın altına düşmez; aynı anda en çok BİR eski kod kopyası.")
w("2. ÖNCE oku: `CLAUDE.md` dersleri (özellikle 3, 5, 6, 7, 10, 11, 13, 17, 20, 22, 23, 25, 38, 40, 43, 44, 47, 52, 53, 54) ve 'Yazım düzeni'; `docs/BAGIMSIZ-DOGRULAMA-PRENSIBI.md` §5; `docs/erp/C6-HESAP-TASARIM.md` (TAMAMI — tur 1'in notu; §6 Bilanço anahattı, §7 tek toplayıcı); `docs/erp/MUHASEBE-CEKIRDEGI-PLANI.md` §0, §7, §8, §9 (madde 6, 8, 9, 10), §13; `docs/erp/MUHASEBELESTIRME-KURAL-KITABI.md` §1, §2, §4, §5, §7, §9 ve eklerin (`-EK-1.md`, `-EK-2.md`, `-EK-2B.md`) bilanço maddeleri; `docs/devir/DEVIR-PLANI.md` §11.4. Kodda: tur 1'in dosyaları (tasarım notunun §2 tablosu), `server/lib/general-ledger.mjs` (BALANCE_SHEET_ITEMS, trialBalance) ve `server/routes/ledger.mjs` `book()` — Bilanço'nun TEK kaynağı budur (plan §0: ikinci para motoru YOK).")
w("3. BEKLENENLERİN KAYNAĞI (ders 5, 32, 40): kullanıcı kararları + kural kitabı + plan. Kâhin MODEL dosyaları (`test/bagimsiz/muhasebe/**`, `test/bagimsiz/defter/kahin.py`, `test/bagimsiz/cari/model.py`) OKUNMAZ ve kodun kaynağı yapılmaz; `test/bagimsiz/**` DEĞİŞTİRİLMEZ (program ↔ muhasebe kâhini eşlemesi ayrı sürücü bakımında).")
w(f"4. TEMİZ büyük veri (OKUNUR; kendi kopyanı al): `{SP}/ana-kabul/temiz-100k`; ölçüm betiği örnekleri `{SP}/c7a-t2b/olcum/` ve tur 1'in ölçüm kanıtı `docs/kanit/2026-11-19/c6h1-hiz-*` (kendi klasörüne kopyala).")
w("")
w("## Kaynaklar (AYNEN)")
w("BAŞ MİMAR KARARI (Ç6-HESAP TURLARA BÖLÜNDÜ): " + D0721)
w("KURAL KİTABI §4: " + K4)
w("KURAL KİTABI §7.2: " + K72)
w("KURAL KİTABI §7.3: " + K73)
w("KURAL KİTABI §7.4: " + K74)
w("KURAL KİTABI KG SATIRLARI (KG-12 kullanıcı kararıyla A — 05.11 17:16 'hepsi A'; KG-14 sınıflama — kitabın önerisi A):")
for k in KG: w("  " + k)
w("TUR 1 RAPORUNA BAŞ MİMAR KARARLARI (19.11 22:45): " + BA + " · " + BD)
w("KULLANICI KARARI (öneriyle uygulandı): " + S209)
w("")
w("## İş (sırayla; her biri bitince HEMEN commit)")
w("1. TASARIM NOTU güncellemesi (`docs/erp/C6-HESAP-TASARIM.md`; KISA): §6'yı kesinleştir (asOf, kalem → hesap → alt hesap / cari boyutu, brütleştirme kuralının hangi boyutta ve hangi toplu sorguyla yapıldığı, hesaplanmış iki satırın Gelir Tablosu işleviyle AYNI çağrıdan geldiği, Aktif = Pasif farkının satırı); §7'ye Bilanço'nun Kesin Değil nedenleri (kitap §7.4 sırası) ve B-a / S209'un yeri; okuma ucu; hacim; 'nasıl bozulur' listesi (kilitli ↔ kilitsiz t, kapanmış / kapanmamış önceki yıl, iki şirket, yedek → geri yükleme okuması, aynı gün kayıtları — ders 31).")
w("2. BİLANÇO HESABI (§4, §7.2, §7.3; KG-12 A; KG-14): asOf = t; 1–5 sınıfı t sonu bakiyeleri `book()` üzerinden (kilitli dönem donmuş, açık dönem canlı); ters bakiye BRÜTLEŞTİRME (cari / alt hesap / hesap boyutu, kitaptaki listeyle — netleştirme yok); 153 = DSS_t (tur 1'in değerleme işlevi); hesaplanmış 'Dönem Net Kârı (Zararı)' = tur 1'in Gelir Tablosu işlevinin 1 Ocak–t çağrısı (İKİ FORMÜL YOK) ve 'Geçmiş Yıllar Kârları (Zararları) — Kapanmamış' (KG-12, yıl yıl); düzenleyici hesaplar kendi kaleminde eksi; Aktif = Pasif, tutmazsa fark satırı + Kesin Değil (denkleştirme kaydı YOK). Okuma ucu: tur 1'in rota dosyasına `GET /api/workspace/financial-statements/balance-sheet?date=YYYY-MM-DD` (varsayılan bugün; yetki Gelir Tablosu ile AYNI).")
w("3. KESİN DEĞİL — Bilanço nedenleri tur 1'in TEK toplayıcısına (§7.4 sırası): G ≠ 0 (Tamamlanmamış Açılış), defter mutabakatı farkı (B-d — alt defter ↔ bilanço hesapları; Mutabakat Testi'nin aynı denetimi yeniden yazılmaz, onun sonucu okunur), eksi kasa / eksi stok / §7.3 imkânsız ters bakiyeler, borçlu 360 (KG-14), kapanmamış önceki yıl sonucu (KG-12), Defter Türü bilanço esası değil ('Bilgi Amaçlı'). Gelir Tablosu ile Bilanço AYNI işlevi çağırır; her neden kod + Türkçe metin + ayrıntı listesi.")
w("4. B-a (yukarıdaki karar AYNEN): kapanmış yılın 31.12'yi içermeyen ara döneminde satışların maliyeti T(b) − T(a−1); N-01 yalnız 31.12'yi içeren parçada. Testte ay / çeyrek parçalarının toplamı = yıllık (ELLE hesaplanmış örnek).")
w("5. S209 = B (yukarıdaki karar AYNEN): alış iadesinin değeri alışlardan büyükse birim maliyet 0'a kırpılır + Kesin Değil nedeni (kırpılan tutar ayrıntıda GÖRÜNÜR); Gelir Tablosu ve Bilanço aynı değerlemeyi okur.")
w("6. BİTİŞ: yeni / değişen testlerin iki TZ; değiştirdiğin / kaydettiğin dosyaları anan testler (taramayla — ders 10; rota listesi / yetki testleri komşu); `npm run test:kahin-defter` ve `npm run test:kahin-cari` önce / sonra AYNI (bu tur türetmeye dokunmaz; değişen her sayı BULGU). Tam npm test YOK.")
w("KAPSAM DIŞI (DOKUNMA): ekranlar / PDF / Excel / rapor merkezi kaydı (Ç6-EKRAN); dönem sonu kapanış fişi (D4); Ç7b'nin dosyaları ve Ç7b tasarım notunun B-5'i (B-5 = A — işaret listesi korunur, KOD YOK; dosyası Ç7b'nin); kilitli yılların donmuş toplamıyla hızlanma (2.5.1); tur 1 uç testinin açılış dondurmalı kurgusu (KULLANICI 20.11 kuralıyla 2.5.1 — test düzeneği); sürücü / kâhin eşlemesi; Ç6-HESAP tur 3 kabulü (hacim bütçesi 1 M, eski sürüm sınıf testi).")
w("")
w("## Kanıt")
w("- Her yeni test: `" + TABAN + "` kopyasında KIRMIZI ve nedeni iletide okunur (ders 38, 51) — 'uç yok' kırmızısı tek başına diş sayılmaz; DİŞİ mutantlar verir; yeni kodda yeşil; iki TZ; ay / çeyrek / yıl sonu ve 29 Şubat (ders 13, 22 — sahte saat). İç tutarlılık: Bilanço'nun hesap toplamları aynı t'nin Hesap Planı Mizanı 1–5 bakiyeleriyle BİREBİR (brütleştirme yalnız kalem değiştirir, toplamı değil); hesaplanmış Dönem Net Kârı = aynı dönemin Gelir Tablosu Dönem Net Kârı; Aktif = Pasif (boş veri, tek kayıt, tam veri; kilitli ve kilitsiz t; kapanmamış önceki yıl; iki şirket karışmaz). Beklenenler ELLE hesaplanmış küçük örneklerden (kitabın formülüyle, testte açıkça yazılı) — programın çıktısından türetilmez.")
w("- Karşı mutantlar DEĞERLE (birden çok koşu): brütleştirmeyi netleştirmeye çevir; alacaklı 120 cariyi 340 yerine 120'de bırak; düzenleyici hesabın işaretini çevir; hesaplanmış Dönem Net Kârı'nı Gelir Tablosu'ndan değil ayrı formülle hesapla (ya da bir gün kaydır); Geçmiş Yıllar — Kapanmamış'ta kapanmış yılı da say; 153'ü değerleme yerine defterden al; Kesin Değil nedenlerinden birini düşür; B-a'da N-01'i ara parçaya kat; S209'da kırpmayı kaldır; kilitli t'de donmuş yerine canlı türetmeyi oku.")
w("- HACİM (ders 47, 53 (a)): temiz-100k kopyasında Bilanço (t = yıl sonu ve yıl içi; kilitli / kilitsiz) süresi + olay döngüsü en çok; bütçe plan §8 (100 bin satırda ≤ 3 sn; olay döngüsü ≤ 50 ms) — tur 1'in Gelir Tablosu ölçümüyle AYNI düzenek; ölçüm `flock -x -w 3600 " + SP + "/olcum.lock -c '<komut>'` (tek seferlik bekleme, döngü YOK); ölçüm raporuna /proc/loadavg yaz (yük > 2 ise geçersiz, yinele). Gelir Tablosu'nun süresi önce / sonra AYNI veride (bu tur onun yoluna dokunuyorsa — ders 53 (a)).")
w(on[36])
w(on[37].replace('c5a2-<ad>', 'c6h2-<ad>').replace('docs/kanit/<gün>/c5a2-*', 'docs/kanit/<gün>/c6h2-*'))
w("- ÖLÇÜM KİLİDİ: ana oturum ya da başka ajan `olcum.lock`'u ÖZEL tutabilir. Yük koşusu kilit doluysa tek seferlik `flock -s -w 3600 " + SP + "/olcum.lock -c '<komut>'` (döngü YOK); beklerken okuma / kod / TEK test dosyası. Kabul koşulunu 'kilit dolu' diye ATLAMA.")
w("")
w("## Kurallar — DOSYA SINIRI (Ç7b aynı anda türetme dosyalarına yazıyor)")
w("- Yazabileceğin: tur 1'in Ç6 dosyaları (tasarım notunun §2 tablosundakiler), YENİ `server/lib/` dosyası gerekirse (tasarım notunda adlandır), testler (`test/c6h-*`) + `test/fixtures/**` (yeni dosya), tasarım notu.")
w("- YAZILMAZ: `server/lib/general-ledger.mjs`, `server/routes/ledger.mjs`, `server/lib/ledger-*.mjs`, `server/lib/integrity*.mjs`, `server/lib/migrations.mjs` (GÖÇ YOK), `server/routes/{invoices,tax,stock,report-center}.mjs`, `server/app.mjs` (yeni rota tur 1'in rota dosyasına), `client/**`, kılavuz, `.github/**`, package.json, tools/**, `test/bagimsiz/**`. Bunlardan birinde değişiklik (ör. bir işlevi dışa açmak) gerekirse DUR, 'BAŞ MİMAR KARARI GEREKİYOR' diye raporla.")
w(on[42])
w("- KULLANICI KURALI (CLAUDE.md'den AYNEN): " + BIRAK[0] + " — bu turda programı ya da kullanıcıyı etkilemeyen ayrıntıyı (test düzeni, araç, ölçüm nüansı, doğrulanmamış kuşku) KOVALAMA; raporun 'SONRAKİ SÜRÜME (2.5.1)' başlığına yaz.")
for i in (44, 45, 46, 47, 48, 49): w(on[i])
w("- KAPSAYICI SIK YENİLENİYOR (20.11'de dört kez; ajanlar ve arka plan işleri kesilir, dosya sistemi kalır): koşuları ≤ 40 dk parçalara böl; her parçanın kanıtını HEMEN 'Kanıt:' commit'iyle yaz; rapor taslağını `docs/kanit/2026-11-20/c6h2-rapor-taslak.md`'de adım adım tut (her commit'le güncel) — kesilirsen yeni ajan oradan sürdürür. Bağlamın daralırsa BİTMİŞ adımların commit'leriyle ARA RAPOR ver ve dur (ders 46). Uzun çıktıyı dosyaya yaz, yalnız sayıları oku.")
w("")
w("## Rapor")
w("EN BAŞTA: tasarım notu değişikliğinin özeti; örnek veriyle Bilanço kalemleri (brütleştirme, hesaplanmış iki satır, Aktif = Pasif — sayıyla); Kesin Değil nedenleri (hangi veride hangisi); B-a ve S209 örnekleri (sayıyla); yeni testlerin kırmızı nedeni + yeşili (iki TZ); mutantlar (hangisi hangi testte, kaç koşu); iç tutarlılık; hacim ölçümü (süre, olay döngüsü, yük; Gelir Tablosu önce / sonra); komşu / kâhin önce-sonra sayıları; sürücü için (okuma ucunun adı ve çıktı alanları); ana oturumun yeniden koşacağı komutlar + beklenen sayılar; commit'ler; BAŞ MİMAR KARARI GEREKİYOR; SONRAKİ SÜRÜME (2.5.1); KULLANICIYA SORULMALI (iki seçenek + öneri + 'yaygın programlarda nasıl' — yalnız doğrulanmış kaynakla; uç durumsa 'Uç durum böyle kalsın (BİLİNEN SINIR)'); DOĞRULANMADI; DENENMEYEN; not defteri klasörleri.")
open(CIKTI, 'w', encoding='utf-8').write('\n'.join(o) + '\n')
print('yazıldı', CIKTI, sum(len(x) for x in o))
