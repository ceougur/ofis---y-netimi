# ANA OTURUM — muhasebe sürücüsü bakımı 5 (Ç7b aday kapısından önce): karar dosyası + görev metni üreteci.
# Kararlar iş listesinden AYNEN (C soruları devam satırlarıyla; D kayıtları başlığıyla). Sürücü programın kodunu GÖRÜR; kâhin klasörlerine YAZMAZ.
# Çağrı: cd <depo>; python3 -I <bu> <karar çıktısı> <görev metni çıktısı> <taban dalı> <taban ucu kısa>
import sys, re
K_OUT, I_OUT, TABAN, UC = sys.argv[1], sys.argv[2], sys.argv[3], sys.argv[4]
SP = '/tmp/claude-0/-home-user/de5e1cbf-7e68-5683-b7bb-f27655eaed4f/scratchpad'
t = open('docs/2.5.0-IS-LISTESI.md', encoding='utf-8').read()
il = t.split('\n')
D = t[t.find('\n## D'):]
dent = D.split('\n- ')[1:]

def blok(basla):
    h = [i for i, l in enumerate(il) if l.startswith(basla)]; assert len(h) == 1, (basla, len(h))
    s = h[0]; e = s + 1
    while e < len(il) and il[e].startswith('  ') and not re.match(r'  (S\d+[ =(]|\(\d+\) )', il[e]): e += 1
    return ' '.join(x.strip() for x in il[s:e])

def dkayit(onek):
    x = [e for e in dent if e.startswith(onek)]
    assert len(x) == 1, (onek, len(x))
    return '- ' + x[0].strip()

g = []; w = g.append
w("# Muhasebe sürücüsü bakımı 5 — karar dosyası (ana oturum yazdı; sınıflamada dayanak bunlar, AYNEN)")
w("")
w("## 1. Ç7b tur 3b (Kartı Kapat 'Borçta Kalsın') ve kararları")
w(dkayit('BAŞ MİMAR KARARI 20.11 13:44 UTC'))
w(dkayit('KULLANICI KARARI 20.11 13:39 UTC'))
w(blok('  S205 ('))
w(blok('  S220 ('))
w("")
w("## 2. Ç7b taksit küçük turu (Excel'den aynı adlı kişiler) ve kararları")
w(dkayit('BAŞ MİMAR KARARI 20.11 14:47 UTC'))
w(dkayit('KULLANICI KARARI 20.11 14:47 UTC'))
w(blok('  S219 ('))
w(blok('  S221 ('))
w(blok('  S222 ('))
w("")
w("## 3. Toplu kâhin bakımı 14 (muhasebe kâhini bakımı 14 + cari kâhini bakımı 22)")
w(dkayit('BAŞ MİMAR KARARI 20.11 18:26 UTC'))
for n in (200, 210, 211, 213, 225, 226, 227):
    w(blok(f'  S{n} ('))
open(K_OUT, 'w', encoding='utf-8').write('\n'.join(g) + '\n')

p = []; w = p.append
w(f"Sen DestekOfis projesinde MUHASEBE SÜRÜCÜSÜ BAKIMI 5 ajanısın (2.5.0; Ç7b tur 3b + taksit küçük turu + toplu kâhin bakımı 14 sonrası — Ç7b ADAY KAPISINDAN ÖNCEKİ son sürücü bakımı). Kodu görürsün. TEK İŞ: sürücüyü (`test/bagimsiz/muhasebe-surucu/`) programın (Ç7b'nin tamamı) ve muhasebe kâhininin (bakım 14) bugünkü hâline uyarlamak, programı kâhinle karşılaştırmak, her farkı sınıflamak. Yanıtın Türkçe. Eforun high. KENDİ dalında commit edersin; PUSH YAPMAZSIN. Her bitmiş adımı HEMEN commit et; koşuları ≤ 40 dk parçalara böl, her parçanın kanıtını hemen 'Kanıt:' commit'iyle kaydet; rapor taslağını `docs/kanit/2026-11-20/surucu5-rapor-taslak.md`'ye adım adım yaz (kapsayıcı yeniden başlayabilir). Zamanlanmış görev KURMA.")
w("")
w("## Hazırlık")
w(f"1. Worktree'de (kendi commit'in YOKKEN) `git reset --hard {TABAN}` (= {UC}: Ç7b tur 3b + taksit küçük turu + toplu kâhin bakımı 14'ün birleşimi). `git log --oneline -4` ile doğrula; değilse DUR. `ln -s /home/user/ofis---y-netimi/node_modules node_modules` (`npm ci` YOK).")
w(f"2. ÖNCE oku: `CLAUDE.md` (dersler; özellikle 5, 6, 16, 31, 40, 43, 54); `docs/BAGIMSIZ-DOGRULAMA-PRENSIBI.md`; sürücü klasörü (kos.mjs, program.mjs, karsilastir.py, siniflama.json, gerileme.py ve README); `test/bagimsiz/muhasebe/README.md` içinde 'Senaryo dili' ve 'Kâhin bakımı 14' bölümü; toplu kâhin bakımının raporu `docs/devir/2.5.0-DEVAM/kahin-toplu14-rapor.md` (özellikle 'SÜRÜCÜ İÇİN' 1–6); Ç7b tur 3b raporu `docs/devir/2.5.0-DEVAM/c7b3b-rapor.md` (C maddesi — 22 SINIFLANMADI satırının kökü) ve taksit turu raporu `docs/devir/2.5.0-DEVAM/c7bt-rapor.md` (C maddesi — s91 mz0); karar dosyası `{SP}/surucu5-kararlar.md` (sınıflamada dayanak bunlar; AYNEN). Önceki bakımın raporu `docs/devir/2.5.0-DEVAM/surucu4-rapor.md` (düzen için).")
w("")
w("## Yasaklar (bağımsızlık; ders 5, 40)")
w("- `test/bagimsiz/muhasebe/`, `test/bagimsiz/defter/`, `test/bagimsiz/cari/` (kâhin klasörleri) YAZILMAZ; kâhinin beklentisi programa uydurulmaz. Program kodu (server/, client/) DEĞİŞTİRİLMEZ — program hatası (P) yalnız raporlanır. Kâhin şüphesi (K) yalnız kural kitabı / karar metni AYNEN alıntılanarak yazılır.")
w("")
w("## İş")
w("1. Sürücüyü uyarla: (a) Kartı Kapat — güncel-program modelindeki C7b6-KAPAT değişimi (2.4.9 kuralı) KALKAR; kâhinin `eski: true` işaretli kartı programda göç işaretiyle (eski kuralla kapatılmış kart) kurulur; yeni Kartı Kapat 'Borçta Kalsın' (S205 / S220); (b) toplu kâhin bakımının 'SÜRÜCÜ İÇİN' 1–6 maddesi (S200 değer yazılır; fatura iptalinde kart kapanır; Açık Faturalar kalanı = cari + şüpheli kuyruğu ve yeni `susmalar` kuralı 'S213'; Kartı Kapat kalanı birden çok `kart_kalani`; Excel kartı programın eşlediği cariyle); (c) s91 mz0'ın UTC günü farkı — sınıflamada mz1 için yazılı UTC günü kuralının aynısı (yükleme anı 22:30Z: UTC'de bir gün önce) — yalnız sınıflama, kural değil; (d) P7 (aynı adlı Excel kartı) sınıflama kuralları KALKAR (program artık kâhinle aynı olmalı). Uygulanamayan olay kalırsa adıyla yaz; sessizce atlama.")
w(f"2. BÜTÜN senaryoları (elle + rastgele) iki saat diliminde koş (TZ=UTC, TZ=Europe/Istanbul) — sürücünün kendi `--paralel` değeriyle, `flock -s -w 3600 {SP}/olcum.lock` altında. Sınıfla: AYNI · U (henüz koda girmemiş, belgeli karar — kimlikli) · P · K · R · SINIFLANMADI. Her P / K / SINIFLANMADI için en küçük örnek ve kök neden (ders 6). Kâhinin sustuğu (BİLİNEN SINIR) alanlar karşılaştırılmaz. HEDEF: Ç7b'nin kodlanmış kuralları için U / SINIFLANMADI 0.")
w(f"3. GERİLEME DENETİMİ (gerileme.py): aynı senaryoların PROGRAM ÇIKTISI — eski = Ç7b'den önceki kod `c7b2-taban` (`git -C /home/user/ofis---y-netimi archive c7b2-taban | tar -x` ayrı kopyada {SP}/surucu5-<kısa>/eski; ders 23, 25) ↔ taban. Her fark: senaryo, alan, hangi Ç7b kuralı / kararıyla açıklanıyor. Açıklanmayan fark = bulgu.")
w("4. Testin dişi: programın ayrı kopyasında iki bilinçli hata (ör. Kartı Kapat kalanı yine 689'a; Excel'de aynı adlı ikinci kişinin kartı yine atlanır) — sürücü yakalamalı.")
w("5. TOPLU SORULAR: kararların söylemediği alt durum çıkarsa raporun 'KULLANICIYA SORULMALI' bölümünde TEK listede (durum, en küçük örnek, iki okuma, her okumada bakiye; uç durumsa üçüncü seçenek 'Uç durum böyle kalsın (BİLİNEN SINIR)').")
w("6. 2.5.1 KURALI (kullanıcı 20.11 09:00): programı / kullanıcıyı etkilemeyen sürücü iç düzeni bu bakımda KOVALANMAZ — raporun 'SONRAKİ SÜRÜME (2.5.1)' başlığına.")
w("")
w("## Yöntem")
w("- Program başlatırken `HUKUK_LICENSE_URL=http://127.0.0.1:9`. Koşular `KANIT_DIR=<kendi not defteri klasörün> node tools/kanit.mjs kos surucu5-<ad> -- <komut>`; ham çıktı `docs/kanit/2026-11-20/surucu5-*` (büyükse .gz) ayrı 'Kanıt:' commit'inde. Veri klasörleri /dev/shm'de kendi klasöründe; bitince tam yoluyla sil.")
w("- Her arka plan koşusu açık süre sınırıyla (`timeout -k 5 <sn>`, en çok 2 saat); önce `cat /proc/loadavg`, 3,5'un üstündeyse tek seferlik bekle. Hiçbir koşuya GIT_DIR / GIT_WORK_TREE VERME (ders 54). `pkill` / joker `rm` YOK. Tam `npm test` YOK. Ölçüm yapmıyorsun. Disk 5 GB'ın altına düşmez.")
w("- Commit'e yalnız kendi yolların (`git add test/bagimsiz/muhasebe-surucu docs/kanit/2026-11-20/surucu5-*`; ders 44). Commit iletisi sonunda tam olarak 'Co-Authored-By: Claude <noreply@anthropic.com>' ve 'Claude-Session: https://claude.ai/code/session_01EhegDvmPQ9hx2ibfitm6og' (model adı YOK).")
w("- Kendi arka plan işin sürerken rapor vermeden BİTİRME. Bekleme için boş döngü kurma.")
w("")
w("## Rapor (SubagentHandback, Türkçe)")
w("Yapılan eşlemeler; iki TZ sınıf tablosu (senaryo × AYNI / U / P / K / R / SINIFLANMADI, çıkış kodlarıyla; taban ↔ bakım sonrası sayılar); her P / K / SINIFLANMADI ayrıntısı (en küçük örnek, kök neden, dosya:satır); gerileme dökümü; diş denemesi; KULLANICIYA SORULMALI; SONRAKİ SÜRÜME (2.5.1); DENENMEYEN; ana oturumun yeniden koşacağı komutlar; dal ucu.")
open(I_OUT, 'w', encoding='utf-8').write('\n'.join(p) + '\n')
print(len('\n'.join(g)), len('\n'.join(p)))
