# ANA OTURUM — Ç7b TUR 3b görev metni üreteci (KISA, TEK İŞ: Kartı Kapat 'Borçta Kalsın' (karar (6) / KG-23) + S205 + B-11 = A + kılavuz).
# Kararlar iş listesinden AYNEN. Çağrı: cd <depo>; python3 -I <bu> <çıktı> <taban dalı> <taban ucu>
import sys, re
OUT, TABAN, UC = sys.argv[1], sys.argv[2], sys.argv[3]
SP = '/tmp/claude-0/-home-user/de5e1cbf-7e68-5683-b7bb-f27655eaed4f/scratchpad'
t = open('docs/2.5.0-IS-LISTESI.md', encoding='utf-8').read()
il = t.split('\n')
D = t[t.find('\n## D'):]
c2 = open('docs/devir/2.5.0-DEVAM/c7b2-istem.txt', encoding='utf-8').read().split('\n')
cl = open('CLAUDE.md', encoding='utf-8').read().split('\n')


def blok(basla):
    h = [i for i, l in enumerate(il) if l.startswith(basla)]; assert len(h) == 1, (basla, len(h))
    s = h[0]; e = s + 1
    while e < len(il) and il[e].startswith('  ') and not re.match(r'  (S\d+[ =(]|\(\d+\) )', il[e]): e += 1
    return ' '.join(x.strip() for x in il[s:e])


def satir(basla):
    h = [l for l in c2 if l.startswith(basla)]; assert len(h) == 1, (basla, len(h)); return h[0]


d0415 = [x for x in D.split('\n- ') if x.startswith('BAŞ MİMAR KARARI 20.11 04:15')]; assert len(d0415) == 1
i = d0415[0].find('(1) B-11 = A'); j = d0415[0].find('(2) B-12 = A', i); assert i > 0 and j > i
B11 = d0415[0][i:j].strip()
K6 = blok('  (6) 2B-S5 / S10 = A "Borçta Kalsın"')
S205 = blok('  S205 (')
KG23 = satir('| KG-23 |')
YASAK = satir('- YAZILMAZ:'); PARA = satir('- PARA / DEFTER KURALI AYRIŞMASI')
KABUL = [l for l in c2 if re.match(r'[A-G]\. \*\*', l)]; assert len(KABUL) == 7
BIRAK = [l.strip() for l in cl if l.strip().startswith("2.5.1'E BIRAK")]; assert len(BIRAK) == 1
o = []; w = o.append
w("Sen DestekOfis projesinde Ç7b TUR 3b KOD ajanısın (2.5.0 muhasebe çekirdeği — taksit kartının Kartı Kapat'ı; PARA ÇEKİRDEĞİ; eforun high). TEK İŞ: karar (6) 'Borçta Kalsın' + S205 (B-11 = A ile) + kılavuz. Yanıtın Türkçe. PUSH YOK. Her bitmiş adımı (kod + testi + kanıtı) HEMEN commit et (kapsayıcı 20.11'de dört kez yeniden başladı; commit'siz iş kaybolur). Koşuları ≤ 40 dk parçalara böl; rapor taslağını `docs/kanit/2026-11-20/c7b3b-rapor-taslak.md`'de adım adım tut. Zamanlanmış görev KURMA. Kendi arka plan işin sürerken rapor vermeden bitirme. Bağlamın daralırsa BİTMİŞ adımların commit'leriyle ARA RAPOR ver ve dur (ders 46).")
w("")
w("## Hazırlık")
w(f"1. Worktree'de (kendi commit'in YOKKEN) `git reset --hard {TABAN}` (= {UC[:8]}: Ç7b tur 2–3 + devam 3 ile çalışma dalının — tek aday düzeltmesi dahil — birleşimi). `git log --oneline -2` ile doğrula; değilse DUR. `ln -s /home/user/ofis---y-netimi/node_modules node_modules` (`npm ci` YOK); tarayıcı `PLAYWRIGHT_BROWSERS_PATH={SP}/pw-1194`. ESKİ KOD (taban kırmızısı) = `{TABAN}`: `git -C /home/user/ofis---y-netimi archive {TABAN} ':!docs/kanit' | tar -x -C <not defteri>/taban` + node_modules bağı. Not defteri `{SP}/c7b3b-<kısa>` (ders 25). Disk 5 GB'ın altına düşmez; biten kopyanı TAM yoluyla sil.")
w("2. ÖNCE oku: `CLAUDE.md` (dersler; özellikle 6, 7, 9, 10, 12, 17, 28, 31, 38, 40, 42, 43, 44, 47, 51, 53, 54; 'Yazım düzeni', 'Kullanım kılavuzu'); `docs/BAGIMSIZ-DOGRULAMA-PRENSIBI.md`; `docs/erp/C7B-FATURA-TASARIM.md` §16.2 (okuyucu tablosu ve B-11 — bu turun haritası), §16.7, §16.8 (YENİDEN YAZMA, ek bölüm aç); muhasebe sürücüsünün sınıflaması `test/bagimsiz/muhasebe-surucu/siniflama.json` içinde kimliği 'Ç7b-(6)' olan kural(lar) (bu turdan sonra KALKMALI). Kâhin MODEL dosyaları okunmaz, `test/bagimsiz/**` YAZILMAZ.")
w("")
w("## Kararlar (iş listesinden AYNEN)")
w("KURAL KİTABI: " + KG23)
w(K6)
w(S205)
w("BAŞ MİMAR KARARI 20.11 04:15 (kullanıcıya gösterildi): " + B11)
w("KULLANICI KURALI (CLAUDE.md'den AYNEN): " + BIRAK[0])
w("")
w("## İş (sırayla; her biri ÖNCE bugünkü kodda örnek veriyle yeniden üretilir — ders 6)")
w("0. TASARIM EKİ (tasarım notuna yeni alt bölüm, koddan ÖNCE, commit): kart başına kural işaretinin adı / göç numarası (bu tabandaki SON göçten sonraki ilk numara — kendin oku) / kilit izi; TEK yardımcının adı ve imzası; §16.2 tablosundaki HER okuyucunun bu yardımcıya nasıl bağlanacağı (dosya:işlev); S205 gecikme gününün kuyruktaki yeri; 'nasıl bozulur' (eski kapalı kart + yeni kapalı kart aynı caride; Yeniden Aç → yeniden Kapat; kart kapatıldıktan sonra tahsilat / iade / şüpheliye alma; kilitli dönemde kapatılmış eski kart; yedek → geri yükleme; v2.4.9 verisinden göç; iki şirket).")
w("1. GÖÇ + İŞARET: kart başına kapanış kuralı işareti; göçte VAR OLAN kapalı kartlar eski kural (kalan carinin borcundan düşülmüş — bugünkü davranış, defterde 689), bundan sonra kapatılanlar 'Borçta Kalsın'. İşaret kilit izine girer. Yeniden Aç → yeniden Kapat yeni kuralla mı — tasarım ekinde gerekçesiyle (para kuralı belirsizse KULLANICIYA SORULMALI).")
w("2. TEK YARDIMCI: kapalı kartın 'düşülen kalanı' TEK işlevden (eski kural: tutar − net tahsilat; Borçta Kalsın: 0); §16.2 tablosundaki BÜTÜN okuyucular (cari ekstresi / bakiye, Tek Yükümlülük Kuyruğu girdisi, genel defter 689 maddesi, Defter Mutabakatı / kapı bakiye SQL'i ve carisiz kartın 127 beklenini, cari kartının Taksit Alacağı ve tarihli bakiye, kilit izi / kart toplamları denetimi, şüpheli ayırıcısının kalemi, Tablodan Aktar iletisi) bu yardımcıdan okur — ders 10: taramayla (`status === \"closed\"|p.status = 'closed'|plan-close` server/**) eksiksiz.")
w("3. S205 = A: 'Borçta Kalsın' ile kapatılan kartın kalan borcunun TAMAMI kapatma gününün ertesi gününden gecikmiş (kalemin kendi vadesine bakılmaz); hatırlatma gider; Kartı Kapat onay penceresi metni sonucu söyler (cümle düzeni; 'kalan borç carinin borcunda kalır, yarından itibaren gecikmiş sayılır; vazgeçmek için Alacak Yaz').")
w("4. KILAVUZ: 'Kartı Kapat' (kalan borçta kalır, ertesi günden gecikmiş; vazgeçmek için Alacak Yaz) — kısa 'nasıl yapılır'; `docs/kilavuz/pdf-uret.mjs` + `pdf-denetle.mjs` aynı turda (ders 42). Defter anlatımı GİRMEZ.")
w("5. BİTİŞ: kabul koşulları (aşağıda, tur 2'nin metni AYNEN) bu turun maddelerine göre — A `npm run test:kahin-defter` önce / sonra; B `npm run test:kahin-cari` önce / sonra (farklar adıyla; yeni fark çıkarsa karar numarasıyla açıkla ya da BULGU); C sürücü önce / sonra ('Ç7b-(6)' farkı KALKMALI, başka sınıf değişmemeli; sürücüyü DEĞİŞTİRME); D eski sürüm (v2.4.9 gerçek kodu: kapatılmış kart göçten sonra ESKİ kuralda — bakiye, ekstre, defter aynı); E hız (Kartı Kapat, cari ekstresi, cari kartı, gecikmiş listesi, Defter Mutabakatı; temiz 100 bin `" + SP + "/ana-kabul/temiz-100k` OKUNUR, kendi kopyan; taban ↔ yeni, kilitsiz + kilitli, ÖZEL kilit `flock -x -w 1800 " + SP + "/olcum.lock` tek seferlik; yük > 2 GEÇERSİZ); F değişmezler; G ekran (Taksitler → Kartı Kapat → cari ekstresi / gecikmiş / hatırlatma — gerçek tıklama + Tab + insan hızında; beklentisi değişen her ekran senaryosu KOŞULUR, ders 28); G2 komşu taramayla iki TZ — göç eklediğin için ŞEMA KAPISI (sema-kapisi-bs7) ve geri yükleme testleri komşudur; mutantlar DEĞERLE (en az: yeni kartı eski kuralla düş, eski kartı yeni kuralla say, bir okuyucuyu yardımcıdan kopar, gecikmeyi kalem vadesinden başlat, işareti kilit izinden çıkar), birden çok koşu.")
w("")
w("## Kabul koşulları (tur 2'nin metni AYNEN; bu turun maddeleri için okunur)")
for l in KABUL: w(l)
w("")
w("## Kurallar")
w("- DOSYA SINIRI (B-11 = A): yazabileceğin — `server/routes/plans.mjs` + `client/assets/hof-plans.js` (Kartı Kapat + onay metni), `server/lib/migrations.mjs` (YALNIZ yeni göç: kart başına kural işareti), ve §16.2 tablosundaki okuyucu dosyaları (`server/lib/accounts.mjs`, `server/lib/general-ledger.mjs`, `server/lib/account-lines.mjs`, `server/routes/ledger.mjs`, `server/routes/accounts.mjs`, `server/lib/integrity.mjs`, `server/lib/integrity-scope.mjs`, `server/lib/bank/doubtful.mjs`, `server/routes/plan-transfer.mjs`, `server/lib/obligation-input.mjs`, `server/lib/obligation-queue.mjs`) — bu dosyalarda YALNIZ kapalı kartın kalanı / kural işareti / S205 gecikme günü; kılavuz HTML + PDF, testler + `test/fixtures/**`, tasarım notu. Başka her şey YASAK (tur 2 listesinden AYNEN, yukarıda izin verilenler hariç): " + YASAK)
w(PARA)
w("- KULLANICI KURALI (yukarıda AYNEN): programı ya da kullanıcıyı etkilemeyen ayrıntıyı (test düzeni, araç, ölçüm nüansı, doğrulanmamış kuşku) KOVALAMA; raporun 'SONRAKİ SÜRÜME (2.5.1)' başlığına yaz.")
w("- Koşular `HUKUK_LICENSE_URL=http://127.0.0.1:9 KANIT_DIR=<not defterin> node tools/kanit.mjs kos c7b3b-<ad> -- <komut>`; BÜTÜN test koşuların (tek dosya dahil) `flock -s -w 3600 " + SP + "/olcum.lock` altında (tek seferlik bekleme; başka ajanın hız ölçümü kilidi ÖZEL tutuyor olabilir — beklerken okuma / tasarım / kod); her arka plan koşusu `timeout -k 5 <sn>` (en çok 2 saat); önce `cat /proc/loadavg`, 4'ün üstündeyse tek seferlik bekle. GIT_DIR / GIT_WORK_TREE VERME (ders 54). `pkill` / joker `rm` YOK. Tam `npm test` YOK. Her yeni test tabanda BEKLENEN NEDENLE kırmızı (iletisi okunur, ders 38, 51); iki TZ (UTC, Europe/Istanbul); tarihe bağlı test yok (ders 13). Yeni ekran senaryosu açabilirsin; ci.yml'ye EKLEME — raporda 'CI listesine eklenecek'. Kanıt `docs/kanit/2026-11-20/c7b3b-*` (ayrı 'Kanıt:' commit'i). Commit'e yalnız kendi yolların (`git add <yol>`; ders 44).")
w("- Commit iletisi sonunda tam olarak (model adı YOK):")
w("  Co-Authored-By: Claude <noreply@anthropic.com>")
w("  Claude-Session: https://claude.ai/code/session_01EhegDvmPQ9hx2ibfitm6og")
w("")
w("## Rapor (SubagentHandback, Türkçe)")
w("EN BAŞTA değişen her gözlenebilir davranış (önce → sonra; ekran adıyla; örnek tutarla: cari bakiyesi, gecikmiş, kart kalanı, defter); değişen dosyalar; yeni / değişen testlerin kırmızı nedeni + yeşili (iki TZ); A–G + G2 sayıları; mutant tablosu; hız tablosu (yol × kip × taban / yeni en iyi + ortanca, yük); kılavuz + PDF denetimi; KULLANICIYA SORULMALI (iki seçenek + öneri; uç durumsa üçüncü 'Uç durum böyle kalsın (BİLİNEN SINIR)'); BAŞ MİMAR KARARI GEREKİYOR; SONRAKİ SÜRÜME (2.5.1); DOĞRULANMADI; DENENMEYEN; 'CI listesine eklenecek'; commit listesi; dal ucu; ana oturumun yeniden koşacağı komutlar.")
open(OUT, 'w', encoding='utf-8').write('\n'.join(o) + '\n')
print('yazıldı', OUT, sum(len(x) + 1 for x in o))
