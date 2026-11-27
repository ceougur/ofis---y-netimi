# ANA OTURUM — Ç7b TAKSİT KÜÇÜK TURU görev metni üreteci (KISA, TEK İŞ: P7 / S219 = A — Excel'den taksit kartı yüklemede aynı adlı ikinci kişi; + S200 denetimi okuması).
# Kararlar iş listesinden ve CLAUDE.md'den AYNEN. Çağrı: cd <depo>; python3 -I <bu> <çıktı> <taban dalı> <taban ucu> <gün YYYY-AA-GG>
import sys, re
OUT, TABAN, UC, GUN = sys.argv[1], sys.argv[2], sys.argv[3], sys.argv[4]
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


def karar(basla):
    h = [x for x in D.split('\n- ') if x.startswith(basla)]; assert len(h) == 1, (basla, len(h)); return h[0].strip()


def anayasa(icerir):
    h = [i for i, l in enumerate(cl) if icerir in l]; assert len(h) == 1, (icerir, len(h))
    s = h[0]; e = s + 1
    while e < len(cl) and re.match(r'   +\S', cl[e]) and not re.match(r'\s*(\d+\.|-) ', cl[e]): e += 1
    return ' '.join(x.strip() for x in cl[s:e])


d0641 = karar('BAŞ MİMAR KARARI 19.11 06:41')
i = d0641.find('P (program): P7 YENİ'); j = d0641.find('P4 2.5.1.', i); assert i > 0 and j > i
P67 = d0641[i:j + len('P4 2.5.1.')]
KAPSAM = [x for x in D.split('\n- ') if x.startswith('BAŞ MİMAR KARARI 20.11') and 'TAKSİT KÜÇÜK TURU — KAPSAM' in x[:120]]; assert len(KAPSAM) == 1
S219 = blok('  S219 (')
S200 = blok('  S200 (')
AYNI_AD = anayasa('"aynı adlı iki kişi" durumu denenir')
SIKAYET3 = anayasa('3. "Kişi bir kez girilir"')
YASAK = satir('- YAZILMAZ:'); PARA = satir('- PARA / DEFTER KURALI AYRIŞMASI')
KABUL = [l for l in c2 if re.match(r'[A-G]\. \*\*', l)]; assert len(KABUL) == 7
BIRAK = [l.strip() for l in cl if l.strip().startswith("2.5.1'E BIRAK")]; assert len(BIRAK) == 1
o = []; w = o.append
w("Sen DestekOfis projesinde Ç7b TAKSİT KÜÇÜK TURU KOD ajanısın (2.5.0 muhasebe çekirdeği — Excel'den taksit kartı yükleme; PARA ÇEKİRDEĞİ: kart açılışı borç doğurur; eforun high). TEK İŞ: P7 (S219 = A ile) + S200 denetiminin okunması. Yanıtın Türkçe. PUSH YOK. Her bitmiş adımı (kod + testi + kanıtı) HEMEN commit et (kapsayıcı 20.11'de dört kez yeniden başladı; commit'siz iş kaybolur). Koşuları ≤ 40 dk parçalara böl; rapor taslağını `docs/kanit/" + GUN + "/c7bt-rapor-taslak.md`'de adım adım tut. Zamanlanmış görev KURMA. Kendi arka plan işin sürerken rapor vermeden bitirme. Bağlamın daralırsa BİTMİŞ adımların commit'leriyle ARA RAPOR ver ve dur (ders 46).")
w("")
w("## Hazırlık")
w(f"1. Worktree'de (kendi commit'in YOKKEN) `git reset --hard {TABAN}` (= {UC[:8]}). `git log --oneline -2` ile doğrula; değilse DUR. `ln -s /home/user/ofis---y-netimi/node_modules node_modules` (`npm ci` YOK); tarayıcı `PLAYWRIGHT_BROWSERS_PATH={SP}/pw-1194`. ESKİ KOD (taban kırmızısı) = `{TABAN}`: `git -C /home/user/ofis---y-netimi archive {TABAN} ':!docs/kanit' | tar -x -C <not defteri>/taban` + node_modules bağı. Not defteri `{SP}/c7bt-<kısa>` (ders 25). Disk 5 GB'ın altına düşmez; biten kopyanı TAM yoluyla sil.")
w("2. ÖNCE oku: `CLAUDE.md` (dersler; özellikle 6, 7, 9, 10, 12, 17, 28, 31, 38, 43, 44, 47, 51, 53, 54; 'Test kuralı', 'Kullanıcının tekrar eden şikâyetleri', 'Kullanım kılavuzu'); `docs/BAGIMSIZ-DOGRULAMA-PRENSIBI.md`; muhasebe sürücüsünün sınıflaması `test/bagimsiz/muhasebe-surucu/siniflama.json` içinde kodu 'P7-AYNI-ADLI-EXCEL-KARTI' ile başlayan kurallar (bu turdan sonra KALKMALI) ve 'P6-TAKSIT-BAGI-DUZELTME-YOLU' ile başlayanlar (KALIR — 2.5.1). Kâhin MODEL dosyaları okunmaz, `test/bagimsiz/**` YAZILMAZ.")
w("")
w("## Kararlar (AYNEN)")
w("ANAYASA (CLAUDE.md, test kuralı): " + AYNI_AD)
w("ANAYASA (CLAUDE.md, kullanıcının tekrar eden şikâyeti): " + SIKAYET3)
w("MUHASEBE SÜRÜCÜSÜ BAKIMI 3'ÜN BULGUSU (iş listesi D 19.11 06:41'den AYNEN): " + P67)
w(S219)
w(S200)
w(KAPSAM[0].strip())
w("KULLANICI KURALI (CLAUDE.md'den AYNEN): " + BIRAK[0])
w("")
w("## İş (sırayla; her biri ÖNCE bugünkü kodda örnek veriyle yeniden üretilir — ders 6)")
w("0. NASIL BOZULUR (rapor taslağının başına, koddan ÖNCE, commit): iki ayrı cari aynı ad + farklı telefon (satır sırası iki yönde); aynı Excel ikinci kez (çift kart / çift borç YOK); telefonsuz satır + aynı adlı tek / birden çok cari; telefonlu satır + aynı adlı telefonsuz cari; carisiz eski kart aynı adla; tablodaki kayda bağlı satır; aynı dosyada aynı kişi iki satır; grup / alt grup; Geri Al (yalnız kendi açtığı cari / kart); kilitli dönem (satır atlanır, yükleme durmaz); büyük / küçük harf.")
w("1. KOD (S219 = A): Excel taksit yüklemesinin yinelenen kart denetimi (`server/routes/plans.mjs`, 'Aynı adla açık kart var') kişiye bağlanır — aynı kişi, cari eşleştirmesinin KENDİ kuralıyla (`server/routes/accounts.mjs` createFromPlan / matchPerson: tablodaki kayıt bağı; aynı ad + aynı telefon (7+ hane); telefonsuz aynı ad + aynı grup; tek eşleşme) — kural iki yerde AYRI YAZILMAZ, tek yardımcıdan (ders 10). Kişi kesinse: o kişinin aynı adlı açık kartı varsa atla; telefonu farklı aynı adlı kişinin kartı kendi carisiyle açılır; kişi kesin seçilemiyorsa (telefonsuz satır, aynı adlı birden çok kişi ya da kart) bugünkü gibi atla, neden: 'Aynı adlı birden çok kişi var; telefonunu ekleyip yeniden yükleyin' (cümle düzeni). Ön izleme / sayım ve aynı ad-yalnız denetimi taşıyan başka yükleme yolu varsa (`grep` ile tara: Tablodan Aktar, toplu kart açma) AYNI yardımcıya bağlanır; taramanın sonucu raporda.")
w("2. TESTLER (yeni dosya, `test/` altında): P7 örneği (iki kart, iki borç; sıra iki yönde); aynı Excel ikinci kez → yeni kart 0; telefonsuz + aynı adlı iki cari → atlandı + yeni neden; Geri Al; kilitli dönem; her biri tabanda BEKLENEN NEDENLE kırmızı (iletisi okunur, ders 38, 51), yenide yeşil; iki TZ (UTC, Europe/Istanbul); göreli tarih (ders 13).")
w("3. S200 OKUMASI: muhasebe sürücüsünü önce / sonra koşarken S120 / S200 senaryosunun (s51) sonucunu (AYNI / sınıf) rapora yaz; fark varsa BULGU — KODLAMA YOK.")
w("4. KILAVUZ: Excel'den taksit kartı yükleme anlatımında aynı adlı kişiler için kısa 'nasıl yapılır' (telefon kolonunu doldurun) — kılavuz HTML'i değişirse `docs/kilavuz/pdf-uret.mjs` + `pdf-denetle.mjs` aynı turda (ders 42). Teknik anlatım GİRMEZ.")
w("5. BİTİŞ: kabul koşulları (aşağıda, tur 2'nin metni AYNEN) bu turun maddelerine göre — A `npm run test:kahin-defter` önce / sonra; B `npm run test:kahin-cari` önce / sonra (yeni fark çıkarsa karar numarasıyla açıkla ya da BULGU); C sürücü önce / sonra (P7-AYNI-ADLI-EXCEL-KARTI farkları KALKMALI, P6 kalır, başka sınıf değişmemeli; sürücüyü DEĞİŞTİRME); D eski sürüm: v2.4.9 gerçek kodunda aynı Excel'in sonucu (bugünkü davranışın 2.4.9'dan geldiğini göster); E hız (ders 47 / 53: Excel taksit yüklemesi 2.000 satır, temiz 100 bin `" + SP + "/ana-kabul/temiz-100k` OKUNUR, kendi kopyan; taban ↔ yeni, kilitsiz; ÖZEL kilit `flock -x -w 1800 " + SP + "/olcum.lock` tek seferlik; yük > 2 GEÇERSİZ; yanıt + olay döngüsü en çok); F değişmezler (Mutabakat Testi bulgusuz); G ekran (Taksitler → Excel'den Yükle → sonuç raporunda atlanan satır ve nedeni — gerçek tıklama; beklentisi değişen her ekran senaryosu KOŞULUR, ders 28); G2 komşu taramayla iki TZ (Excel taksit yüklemesine ve cari eşleştirmesine dokunan testler); mutantlar DEĞERLE (en az: denetimi yalnız ada geri döndür; telefonsuz belirsiz satırda kartı aç; grup koşulunu kaldır; kişiyi telefonsuz eşleştirmede gruba bakmadan seç), birden çok koşu.")
w("")
w("## Kabul koşulları (tur 2'nin metni AYNEN; bu turun maddeleri için okunur)")
for l in KABUL: w(l)
w("")
w("## Kurallar")
w("- DOSYA SINIRI: yazabileceğin — `server/routes/plans.mjs` (YALNIZ Excel yükleme / ön izleme yinelenen kart denetimi ve nedeni), `server/routes/accounts.mjs` (YALNIZ kişi eşleştirme kuralının dışa açılması; eşleştirmenin DAVRANIŞI DEĞİŞMEZ), taramada aynı denetimi taşıdığı görülen yükleme yolu dosyası (raporda gerekçesiyle), `client/assets/hof-plans.js` (yalnız atlanan satır nedeni gösterimi gerekirse), kılavuz HTML + PDF, testler + `test/fixtures/**`. Başka her şey YASAK (tur 2 listesinden AYNEN, yukarıda izin verilenler hariç): " + YASAK)
w(PARA)
w("- KULLANICI KURALI (yukarıda AYNEN): programı ya da kullanıcıyı etkilemeyen ayrıntıyı (test düzeni, araç, ölçüm nüansı, doğrulanmamış kuşku) KOVALAMA; raporun 'SONRAKİ SÜRÜME (2.5.1)' başlığına yaz.")
w("- Koşular `HUKUK_LICENSE_URL=http://127.0.0.1:9 KANIT_DIR=<not defterin> node tools/kanit.mjs kos c7bt-<ad> -- <komut>`; BÜTÜN test koşuların (tek dosya dahil) `flock -s -w 3600 " + SP + "/olcum.lock` altında (tek seferlik bekleme; başka işin hız ölçümü kilidi ÖZEL tutuyor olabilir — beklerken okuma / tasarım / kod); her arka plan koşusu `timeout -k 5 <sn>` (en çok 2 saat); önce `cat /proc/loadavg`, 4'ün üstündeyse tek seferlik bekle. GIT_DIR / GIT_WORK_TREE VERME (ders 54). `pkill` / joker `rm` YOK. Tam `npm test` YOK. Yeni ekran senaryosu açabilirsin; ci.yml'ye EKLEME — raporda 'CI listesine eklenecek'. Kanıt `docs/kanit/" + GUN + "/c7bt-*` (ayrı 'Kanıt:' commit'i). Commit'e yalnız kendi yolların (`git add <yol>`; ders 44).")
w("- Commit iletisi sonunda tam olarak (model adı YOK):")
w("  Co-Authored-By: Claude <noreply@anthropic.com>")
w("  Claude-Session: https://claude.ai/code/session_01EhegDvmPQ9hx2ibfitm6og")
w("")
w("## Rapor (SubagentHandback, Türkçe)")
w("EN BAŞTA değişen her gözlenebilir davranış (önce → sonra; ekran adıyla; örnek satırlarla: açılan / atlanan kart, nedeni, cari bakiyesi, defter 120); değişen dosyalar; tarama sonucu (aynı denetimi taşıyan yollar); yeni / değişen testlerin kırmızı nedeni + yeşili (iki TZ); A–G + G2 sayıları; S200 (s51) sonucu; mutant tablosu; hız tablosu (taban / yeni en iyi + ortanca, olay döngüsü en çok, yük); kılavuz + PDF denetimi; KULLANICIYA SORULMALI (iki seçenek + öneri; uç durumsa üçüncü 'Uç durum böyle kalsın (BİLİNEN SINIR)'); BAŞ MİMAR KARARI GEREKİYOR; SONRAKİ SÜRÜME (2.5.1); DOĞRULANMADI; DENENMEYEN; 'CI listesine eklenecek'; commit listesi; dal ucu; ana oturumun yeniden koşacağı komutlar.")
open(OUT, 'w', encoding='utf-8').write('\n'.join(o) + '\n')
print('yazıldı', OUT, sum(len(x) + 1 for x in o))
