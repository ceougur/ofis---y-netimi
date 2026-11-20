# ANA OTURUM — Ç7b TUR 3 görev metni üreteci (KISA, TEK İŞ: Kartı Kapat 'Borçta Kalsın' + kart küçültme (4) + S15 / S206 iptal + S205 + kılavuz).
# Kararlar iş listesinden AYNEN (blok: devam satırları dahil). Çağrı: cd <depo>; python3 -I <bu> <çıktı> <taban dalı> <taban ucu>
import sys, re
OUT, TABAN, UC = sys.argv[1], sys.argv[2], sys.argv[3]
SP = '/tmp/claude-0/-home-user/de5e1cbf-7e68-5683-b7bb-f27655eaed4f/scratchpad'
il = open('docs/2.5.0-IS-LISTESI.md', encoding='utf-8').read().split('\n')
c2 = open('docs/devir/2.5.0-DEVAM/c7b2-istem.txt', encoding='utf-8').read().split('\n')
def blok(basla):
    h = [i for i, l in enumerate(il) if l.startswith(basla)]; assert len(h) == 1, (basla, len(h))
    s = h[0]; e = s + 1
    while e < len(il) and il[e].startswith('  ') and not re.match(r'  (S\d+[ =(]|\(\d+\) )', il[e]): e += 1
    return ' '.join(x.strip() for x in il[s:e])
def satir(basla):
    h = [l for l in c2 if l.startswith(basla)]; assert len(h) == 1, (basla, len(h)); return h[0]
K4 = blok('  (4) 2B-S3 = A'); K6 = blok('  (6) 2B-S5 / S10 = A "Borçta Kalsın"')
S15S = blok('  S15 (R5)'); S15K = blok('  S15 = A:')
S205 = blok('  S205 ('); S206 = blok('  S206 (')
KG23 = satir('| KG-23 |')
M7 = satir('7. **YALNIZ YB-1'); M8 = satir('8. **S15 = A ve S25 = A')
YASAK = satir('- YAZILMAZ:'); PARA = satir('- PARA / DEFTER KURALI AYRIŞMASI')
KABUL = [l for l in c2 if re.match(r'[A-G]\. \*\*', l)]; assert len(KABUL) == 7
o = []; w = o.append
w("Sen DestekOfis projesinde Ç7b TUR 3 KOD ajanısın (2.5.0 muhasebe çekirdeği — taksit kartının kapanışı / küçülmesi / iptali; PARA ÇEKİRDEĞİ; eforun high). TEK İŞ aşağıdaki beş madde. Yanıtın Türkçe. PUSH YOK. Her bitmiş adımı (kod + testi + kanıtı) HEMEN commit et (kapsayıcı yeniden başlayabilir; commit'siz iş kaybolur). Zamanlanmış görev KURMA. Kendi arka plan işin sürerken rapor vermeden bitirme. Bağlamın daralırsa BİTMİŞ adımların commit'leriyle ARA RAPOR ver ve dur (ders 46).")
w("")
w("## Hazırlık")
w(f"1. Worktree'de (kendi commit'in YOKKEN) `git reset --hard {TABAN}` (= {UC[:8]}: Ç7b tur 2–2f + kâhin bakımları). `git log --oneline -2` ile doğrula; değilse DUR. `ln -s /home/user/ofis---y-netimi/node_modules node_modules` (`npm ci` YOK); tarayıcı `PLAYWRIGHT_BROWSERS_PATH={SP}/pw-1194`. ESKİ KOD (taban kırmızısı) = `{TABAN}`: `git -C /home/user/ofis---y-netimi archive {TABAN} ':!docs/kanit' | tar -x -C <not defteri>/taban` + node_modules bağı. Not defteri `{SP}/c7b3-<kısa>` (ders 25). Disk 5 GB'ın altına düşmez; biten kopyanı TAM yoluyla sil.")
w("2. ÖNCE oku: `CLAUDE.md` (dersler; özellikle 6, 7, 9, 10, 11, 12, 17, 28, 31, 38, 40, 42, 43, 44, 47, 51, 53, 54; 'Yazım düzeni', 'Kullanım kılavuzu'); `docs/BAGIMSIZ-DOGRULAMA-PRENSIBI.md`; `docs/erp/C7B-FATURA-TASARIM.md` (YB-1 ve Kartı Kapat bölümleri; YENİDEN YAZMA, ek bölüm aç); `docs/devir/2.5.0-DEVAM/c7b2f-rapor.md` (mutant 10 — YB-1 bitti); cari kâhininin bu kurallardaki beklentisi `test/bagimsiz/cari/KARARLAR.md` §32 ve '2.5.0 bakımı 21b' (OKUNUR; kâhin MODEL dosyaları okunmaz, kâhin klasörü YAZILMAZ); muhasebe sürücüsünün sınıflaması `test/bagimsiz/muhasebe-surucu/siniflama.json` içinde kimliği 'Ç7b-(4)' ve 'Ç7b (S15 = A)' olan kurallar (bunlar KALKMALI).")
w("")
w("## Kararlar (iş listesinden AYNEN)")
w("KURAL KİTABI: " + KG23)
w(K6); w(K4)
w("S15 SORUSU: " + S15S); w("S15 KARARI: " + S15K)
w(S205); w(S206)
w("TUR 2'NİN MADDE METİNLERİ (ana oturumun yazdığı; tur 2'de YALNIZ YB-1 yapıldı): " + M7 + " " + M8)
w("")
w("## İş (sırayla; her biri ÖNCE bugünkü kodda örnek veriyle yeniden üretilir — ders 6; zaten karara uyuyorsa yalnız KALICI testle gösterilir)")
w("0. TASARIM EKİ (tasarım notu yeni bölüm, koddan ÖNCE, commit): her madde için bugünkü davranış (örnek tutarla, cari bakiyesi + gecikmiş + kart kalanı + defter), değişecek yer (dosya:işlev), okuyucular (cari ekstresi, gecikmiş / hatırlatma, Taksitler ekranı, raporlar, mobil özet, WhatsApp hatırlatma süzgeci — taramayla), 'nasıl bozulur' listesi (sıra değiştir, sil + yeniden aç, iki kişi aynı anda, eski sürüm verisi, geri yükleme).")
w("1. (6) BORÇTA KALSIN: Kartı Kapat yalnız ödeme planını bitirir; kalan carinin borcunda kalır (defter maddesi YOK — KG-23 A; bugünkü 689 maddesi yeni kapatmalarda kalkar, eskiler eski kuralda — Kural Farkı penceresinde yanlış alarm YOK); S205 = A: kalan borcun TAMAMI kapatma gününün ertesi gününden gecikmiş (kalemin kendi vadesine bakılmaz); hatırlatma gider; vazgeçme ayrı ve görünür işlemle (Alacak Yaz / Şüpheli → Değersiz); ÖNCEDEN kapatılmış kartlar olduğu gibi kalır (eski sürüm verisiyle sına). Onay penceresi metni sonucu söyler (cümle düzeni).")
w("2. (4) KART KÜÇÜLMESİ: iade borçtan düşülünce / kartın faturası iptal ya da silinince küçülme vadesi EN ÖNCE gelen açık taksitten başlar; kartın açık kalanını aşan fazlası carinin avansı (sürücü s58: TK3 F3 40,00 — kalan toplam aynı, dağılım değişir).")
w("3. S15 = A + S206 = A: taksit kartında tahsilatı olan faturanın İptal Et'i KABUL (bugün 409 plan-has-payments); kart kapanır, kartın tahsilatları carinin avansı (bağsız alacak) olur; Taksitler'den açılmış Mevcut Borç kartına da uygulanır. e-Belge iptal kuralları DEĞİŞMEZ (numaralı belgenin iptal yolu aynen); defter: avansın maddesi kitaptaki avans kuralıyla.")
w("4. KILAVUZ: 'Kartı Kapat' (kalan borçta kalır, ertesi günden gecikmiş; vazgeçmek için Alacak Yaz) ve tahsilatlı kartın faturasını iptal (tahsilat avans olur) — kısa 'nasıl yapılır'; `docs/kilavuz/pdf-uret.mjs` + `pdf-denetle.mjs` aynı turda (ders 42). Defter anlatımı GİRMEZ.")
w("5. BİTİŞ: kabul koşulları (aşağıda, tur 2'nin metni AYNEN) bu turun maddelerine göre — A `npm run test:kahin-defter` önce / sonra; B `npm run test:kahin-cari` önce / sonra (KARARLAR §32 / 21b'nin Kartı Kapat / iptal / küçülme beklentileri program = kâhin; yapım aşaması listesi kendi kopyanda yeniden üretilir, BOŞ kalmalı); C sürücü önce / sonra ('Ç7b-(4)' ve 'Ç7b (S15 = A)' farkları KALKMALI; sürücüyü DEĞİŞTİRME — sınıflamayı ana oturum günceller); D eski sürüm (v2.4.9 gerçek kodu: kapatılmış kart, tahsilatlı kart, küçülmüş kart); E hız (Kartı Kapat, fatura iptal / sil, iade, cari ekstresi, gecikmiş listesi; temiz 100 bin `" + SP + "/ana-kabul/temiz-100k` OKUNUR, kendi kopyan; taban ↔ yeni, kilitsiz + kilitli, ÖZEL kilit `flock -x -w 1800 " + SP + "/olcum.lock` tek seferlik; yük > 2 GEÇERSİZ); F değişmezler; G ekran (Taksitler → Kartı Kapat, fatura İptal Et, cari ekstresi / gecikmiş — gerçek tıklama + Tab + insan hızında; beklentisi değişen her ekran senaryosu KOŞULUR, ders 28); G2 komşu taramayla iki TZ; mutantlar DEĞERLE (en az: kalanı sil, gecikmeyi kalem vadesinden başlat, küçülmeyi son taksitten yap, iptalde tahsilatı sil, iptali yine reddet), birden çok koşu.")
w("")
w("## Kabul koşulları (tur 2'nin metni AYNEN; bu turun maddeleri için okunur)")
for l in KABUL: w(l)
w("")
w("## Kurallar")
w("- DOSYA SINIRI: yazabileceğin — `server/routes/plans.mjs` + `client/assets/hof-plans.js` (Kartı Kapat, küçülme), `server/routes/invoices.mjs` (YALNIZ iptal / silmenin kart yolu), `server/lib/obligation-queue.mjs` ve `server/lib/obligation-input.mjs` (YALNIZ kapatılmış kartın kalanının gecikme günü ve küçülme sırası — tasarım ekinde gerekçesiyle), `server/lib/general-ledger.mjs` ve `server/lib/account-lines.mjs` (YALNIZ Kartı Kapat'ın bugünkü kalan maddesinin (689) kalkması — önceden kapatılmış kartlar ESKİ kuralda kalır, kilitli dönemde kural geçiş günü düzeniyle (tasarım notu §13, B-8); ve iptalde avansa dönen tahsilatın maddesi), kılavuz HTML + PDF, testler + `test/fixtures/**`, tasarım notu. YASAK (tur 2 listesinden AYNEN, yukarıda izin verilen üçü hariç): " + YASAK)
w(PARA)
w("- Koşular `HUKUK_LICENSE_URL=http://127.0.0.1:9 KANIT_DIR=<not defterin> node tools/kanit.mjs kos c7b3-<ad> -- <komut>`; BÜTÜN test koşuların (tek dosya dahil) `flock -s -w 3600 " + SP + "/olcum.lock` altında (tek seferlik bekleme; başka ajanın hız ölçümü kilidi ÖZEL tutuyor olabilir — beklerken okuma / tasarım / kod); her arka plan koşusu `timeout -k 5 <sn>` (en çok 2 saat); önce `cat /proc/loadavg`, 4'ün üstündeyse tek seferlik bekle. GIT_DIR / GIT_WORK_TREE VERME (ders 54). `pkill` / joker `rm` YOK. Tam `npm test` YOK. Her yeni test tabanda BEKLENEN NEDENLE kırmızı (iletisi okunur, ders 38, 51); iki TZ (UTC, Europe/Istanbul); tarihe bağlı test yok (ders 13). Yeni ekran senaryosu açabilirsin; ci.yml'ye EKLEME — raporda 'CI listesine eklenecek'. Kanıt `docs/kanit/2026-11-20/c7b3-*` (ayrı 'Kanıt:' commit'i). Commit'e yalnız kendi yolların (`git add <yol>`; ders 44).")
w("- Commit iletisi sonunda tam olarak (model adı YOK):")
w("  Co-Authored-By: Claude <noreply@anthropic.com>")
w("  Claude-Session: https://claude.ai/code/session_01EhegDvmPQ9hx2ibfitm6og")
w("")
w("## Rapor (SubagentHandback, Türkçe)")
w("EN BAŞTA değişen her gözlenebilir davranış (önce → sonra; ekran adıyla; örnek tutarla: cari bakiyesi, gecikmiş, kart kalanı, avans); değişen dosyalar; yeni / değişen testlerin kırmızı nedeni + yeşili (iki TZ); A–G + G2 sayıları; mutant tablosu; hız tablosu (yol × kip × taban / yeni en iyi + ortanca, yük); kılavuz + PDF denetimi; KULLANICIYA SORULMALI (iki seçenek + öneri; uç durumsa üçüncü 'Uç durum böyle kalsın (BİLİNEN SINIR)'); BAŞ MİMAR KARARI GEREKİYOR; DOĞRULANMADI; DENENMEYEN; 'CI listesine eklenecek'; commit listesi; dal ucu; ana oturumun yeniden koşacağı komutlar.")
open(OUT, 'w', encoding='utf-8').write('\n'.join(o) + '\n')
print('yazıldı', OUT, sum(len(x) + 1 for x in o))
