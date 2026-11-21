#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""İZLEYEN KÜÇÜK TUR (S234-c + BULGU-1 + BULGU-2 + fatura kartı GET + P-1 / S238 + P-2 + S239 / S240) görev metni üreteci.
Karar metinleri iş listesinden AYNEN alınır (ders 40; prensip §9). Kullanım:
  python3 -I docs/devir/2.5.0-DEVAM/izt-istem-uret.py <çıktı .txt> <taban commit> '<bu turun D kararının öneki>'"""
import sys

cikti, taban, d_onek = sys.argv[1:4]
L = open("docs/2.5.0-IS-LISTESI.md", encoding="utf-8").read().split("\n")


def c_satiri(no):
    s = [l for l in L if l.startswith("  %s (" % no)]
    if len(s) != 1:
        sys.exit("C satırı bulunamadı ya da birden çok: %s" % no)
    return s[0].strip()


def d_satiri(onek):
    s = [l for l in L if l.startswith("- " + onek)]
    if len(s) != 1:
        sys.exit("D satırı bulunamadı ya da birden çok: %s" % onek)
    return s[0][2:]


def kullanici_0511(no):
    i = [k for k, l in enumerate(L) if l.startswith("  (%s) 2B-S" % no)]
    if len(i) != 1:
        sys.exit("05.11 kararı bulunamadı: (%s)" % no)
    k = i[0]
    out = [L[k].strip()]
    while L[k + 1].startswith("      "):
        k += 1
        out.append(L[k].strip())
    return " ".join(out)


SP = "/tmp/claude-0/-home-user/de5e1cbf-7e68-5683-b7bb-f27655eaed4f/scratchpad"
KARARLAR = "\n\n".join([
    "KULLANICI KARARI 05.11 (AYNEN): " + kullanici_0511(4),
    "KULLANICI KARARI 05.11 (AYNEN): " + kullanici_0511(6),
] + [c_satiri(n) for n in ("S234", "S237", "S238", "S239", "S240")])
D = "\n\n".join(d_satiri(o) for o in (
    d_onek,
    "BAŞ MİMAR KARARI 21.11 11:40 UTC",
    "BAŞ MİMAR KARARI 21.11 10:21 UTC",
))
D_KAHIN = [l[2:] for l in L if l.startswith("- BAŞ MİMAR KARARI 21.11") and "CARİ KÂHİNİ BAKIMI 24" in l[:120]]
if len(D_KAHIN) != 1:
    sys.exit("kâhin 24 D satırı bulunamadı")

metin = f"""Sen DestekOfis projesinde İZLEYEN KÜÇÜK TURUN KOD ajanısın (2.5.0; taksit kartı küçülmesi / iade / fatura Düzenle / Tek Yükümlülük Kuyruğu — PARA ÇEKİRDEĞİNE YAKIN; eforun high). YEDİ İŞ (aşağıda). Yanıtın Türkçe. PUSH YOK. Her bitmiş adımı (kod + testi + kanıtı) HEMEN commit et (kapsayıcı yeniden başlayabilir; commit'siz iş kaybolur). Koşuları ≤ 40 dk parçalara böl; rapor taslağını `docs/kanit/2026-11-21/izt-rapor-taslak.md`'de adım adım tut. Zamanlanmış görev KURMA. Kendi arka plan işin sürerken rapor vermeden BİTİRME (arka plan koşusunu `timeout -k 5 7200 …` ile başlat; Bash aracının `timeout` parametresini 7200000 ver; bildirimini bekle). Bağlamın daralırsa bitmiş adımların commit'leriyle ARA RAPOR ver ve dur (ders 46).

KİLİT KURALI (ders 50, 52): ölçüm DIŞINDAKİ HER koşu (tek test dosyası, e2e, kâhin, komşu taraması dahil) `flock -s {SP}/olcum.lock` altında; hız ÖLÇÜMÜ `flock -x {SP}/olcum.lock` altında. Süre sınırını flock'un İÇİNE koy (`flock -s -w 3600 <kilit> timeout -k 5 2400 <komut>`) — kilit beklemesi adım süresine sayılmasın. Ana oturumun özel kilitli ölçümü sırasında kilitsiz koşu YASAK.

## Hazırlık
1. Worktree'de (kendi commit'in YOKKEN) `git reset --hard {taban}`. `git log --oneline -1` ile doğrula; değilse DUR. Bu taban = çalışma dalı + 'Ç7b DK + S229 ALTIN' birleşik küçük turu (S234 = A, S237 = A kodu) + cari kâhini bakımı 24 (S234 / S237 kâhin tarafı; P-1 / P-2 farkları ve Düzenle kayıtları bu kâhinde görünür). `ln -s /home/user/ofis---y-netimi/node_modules node_modules` (`npm ci` YOK); tarayıcı `PLAYWRIGHT_BROWSERS_PATH={SP}/pw-1194`. ESKİ KOD (kırmızı kanıtı) = `{taban}`: `git -C /home/user/ofis---y-netimi worktree add --detach <benzersiz klasör> {taban}` (+ node_modules bağı; bitince `git -C /home/user/ofis---y-netimi worktree remove --force <o tam yol>`; ders 54: GIT_DIR / GIT_WORK_TREE VERME). v2.4.9 karşılaştırması gerekirse `git worktree add --detach <klasör> v2.4.9`. Not defteri `{SP}/izt-<kısa>` (ders 25; başka ajanın klasörünü KULLANMA — yalnız aşağıda adı geçen betikleri kendi klasörüne KOPYALA).
2. ÖNCE oku: `CLAUDE.md` (dersler; özellikle 6, 7, 9, 10, 12, 17, 28, 34, 38, 40, 43, 44, 47, 51, 53, 54; 'Yazım düzeni'); `docs/BAGIMSIZ-DOGRULAMA-PRENSIBI.md`; birleşik turun raporu `docs/devir/2.5.0-DEVAM/dkfix-rapor.md` ('BAŞ MİMAR KARARI GEREKEN' 1–4, 'SONRAKİ SÜRÜME'nin ilk maddesi); cari kâhini bakımı 24'ün raporu `docs/devir/2.5.0-DEVAM/kahin-cari24-rapor.md` (P-1, P-2, SK-42 / 43 / 44); kâhinin elle senaryoları `test/bagimsiz/cari/senaryolar/d53-…`, `d54-…`, `d55-…` (YALNIZ OKU — kâhin klasörüne `test/bagimsiz/**` YAZMA; kâhinin kodunu değiştirmek bu turun işi değil); `docs/erp/C7B-FATURA-TASARIM.md` §16.3, §17, §18; birleşik turun yoklama betikleri `{SP}/dkfix-ab23/probe/pk3.mjs`, `pk4.mjs` (T8acik / T8sonra — BULGU-1; kendi klasörüne kopyala).

## Kararlar (iş listesinden AYNEN)
{KARARLAR}

## Bu turun ve önceki iki turun baş mimar kararları (iş listesi D'den AYNEN)
{D}

{D_KAHIN[0]}

## İşler (her biri: önce tasarım notu §19'a kural → sonra test (eski kodda KIRMIZI, nedeni okunmuş) → kod → yeşil)
1. P-2 (karar (4) 2B-S3 = A 'küçülme kartın açık kalanını aşarsa fazlası carinin avansı'): kâhinin d55 B2 örneği (kart 900 = 3 × 300, kart tahsilatı 600, iade 600) — kart 600, Tahsil Edilen 600, Kalan 0; fazlası 300 carinin avansı (iade belgesinin açığı 300; bakiye −300). Açık kart, Borçta Kalsın ile kapanmış kart ve taksitli faturanın KENDİ kartı. (Birleşik turun 'SONRAKİ SÜRÜME' ilk maddesi bu; baş mimar 2.5.1'den çıkardı.)
2. P-1 / S238 = A: iade İPTAL edilince kart küçülmenin TERSİYLE, iadenin küçülttüğü AYNI taksite geri büyür — kâhinin d55 B1 örneği (20.11 gecikmişi 300). Açık, kapanmış ve kendi kartı. Birleşik turun `growForInvoice`'ı bu kurala getirilir.
3. S234-c (S234 = A + kâhin KAPSAM (e) 'azaltılan tutar iade gibi'): faturanın Düzenle ile AZALTILMASI kartı iade gibi küçültür (açık ve kapanmış kart, kendi kartı). ÖNCE belirle ve raporla: Düzenle hangi faturada açık — kâhinin kara kutu yoklamasında kesilmiş faturada `PUT /api/workspace/invoices/:id` 409 `invoice-not-draft`; birleşik tur ise tabanda 'Düzenle 900 → 300' gözledi. Ekrandaki Düzenle yolunun TAM API çağrısını (yöntem, uç, gövde, hangi belge durumunda) rapora yaz (kâhinin bir sonraki bakımı eşlemesini buna göre yapar). SK-42 (a) Düzenle ile kartın açık kalanından FAZLA azaltma ve (b) Düzenle ile ARTIRMA kararda YOK → kodla belirleme, programın bugünkü davranışını sayılarla yaz, 'KULLANICIYA SORULMALI'ya koy (öneri (a): fazlası carinin avansı — iadeyle aynı; (b): artırma kartı büyütmez, artan kısım kendi vadesiyle kuyrukta; uç durum seçeneğiyle).
4. BULGU-1 (aynı caride iki Mevcut Borç kartı; kapama defteri ikinci faturayı yeni kartça kapsanmış sayıyor, Tek Yükümlülük Kuyruğu kapsamsız 'Gecikti' gösteriyor): kök neden kuyrukta; kuyruk kapama defteriyle AYNI kapsam okumasına getirilir (tek yardımcı — iki ayrı hesap kalmaz). Beklenen (birleşik turun yoklaması): açık iki kartta gecikmiş 0; kapalı kartta 08.10 0, 09.10 600. Bakiye değişmez.
5. BULGU-2 (v2.4.9'dan beri; kullanıcıyı etkiler): kaydedilmiş taksitli faturanın Düzenle formu kalan ödemeyi 'Açık Hesap (Vadeli)' seçili açıyor (istemcide kaydedilmiş belgenin `mode` 'installments'ı tanınmıyor); değiştirmeden Kaydet taksit kartını siliyor. Form kaydedilmiş belgenin ödeme biçimini doğru açar; değiştirmeden Kaydet kartı ve taksitleri AYNEN bırakır (bakiye, kart, taksit satırları önce / sonra veri tabanından okunarak). S235 onay cümlesi buna göre doğru kalır.
6. Fatura kartı GET'i Ç7b'den bu yana ~+26 ms (47 → 71 ms; tanı: iptal notunun kapsam okuması). Hedef: Ç7b öncesi koda (`af655afd`) göre ortanca VE en iyi süreden en az biri +%10'un altında; olmuyorsa nedenini ölçümle yaz.
7. S239 = A ve S240 = A: programın bugünkü davranışını birer sınamayla göster; öneri A'dan farklıysa (aynı dosyalarda kalıyorsa) düzelt; farklı ve dosya sınırı dışındaysa raporla.
Kararın söylemediği HER alt durum (para / kapama sırası) — ders 43: kodla KARAR VERME; bugünkü davranışı sayılarla yaz, 'KULLANICIYA SORULMALI'ya (iki seçenek + öneri; uç durumsa üçüncü seçenek 'Uç durum böyle kalsın (BİLİNEN SINIR)'; 'yaygın programlarda nasıl' satırı — doğrulanmış kaynak okumadıysan 'okunmadı' yaz).

## Dosya sınırı
İZİNLİ: `server/routes/plans.mjs`, `server/routes/invoices.mjs`, `server/routes/stock.mjs` (yalnız iade / kart küçülmesi yolu), Tek Yükümlülük Kuyruğu ve kapama defteri yardımcıları (`server/lib/obligation-*`, `server/lib/*invoice-settle*`, kart kapsamı / küçülmesi yardımcıları — hangileri olduğunu koddan bul, rapora yaz), `client/assets/hof-invoices.js` (Düzenle formunun ödeme biçimi + onay metni), yeni / değişen testler (`test/**` — `test/bagimsiz/**` HARİÇ), yeni ekran senaryosu `test/e2e/senaryo-izt-250.mjs` + `package.json`'a `test:senaryo-izt-250` betiği (ci.yml / release.yml'ye ANA OTURUM ekler — sen dokunma), `docs/erp/C7B-FATURA-TASARIM.md` (yeni §19), `docs/kanit/2026-11-21/izt-*`. GÖÇ beklenmiyor; gerekirse YALNIZ `migrations.mjs` sonuna yeni göç + şema kapısı (sema-kapisi-bs7) + geri yükleme testleri (ders 10) — önce raporda gerekçe. Başka dosya gerekirse DUR, raporla.

## Sınama (ders 6, 7, 9, 10, 12, 17, 28, 34, 38, 47, 51, 53)
- Her yeni test ESKİ kodda ({taban}) KIRMIZI, iletisinde beklenen NEDEN; yenide yeşil. İki TZ (UTC + Europe/Istanbul). Göreli tarih + sahte saat (ders 13).
- Değişen kodun bütün yolları ve komşuları (ders 9, 10): komşu listesini tahminle değil `test/` taramasıyla çıkar (değişen işlevlerin adlarıyla grep), hepsini iki TZ'de koş; v2.4.9 altın testi (`test/banka-210-altin.test.mjs`) ve K1 farkı (`test/guvenilirlik/kapama-k1-fark.mjs`) dahil.
- Kâhin ↔ program (bağımsız beklenen): `npm run test:kahin-cari` iki TZ — P-1'in 5 ve P-2'nin 14 farkı KAPANMALI; Düzenle'nin 38 kaydı ancak kâhinin eşlediği yol (yukarıda 3) programda açıksa kapanır — değilse nedenini yaz. Kendi kopyanda `--yapim-asamasi-yaz` (KAHIN_YAPIM_ASAMASI ile not defterine) koş, listede kalan / kapanan kayıtları rapora yaz; depodaki `YAPIM-ASAMASI.json`'a DOKUNMA (ana oturum birleşimde yeniden üretir). `npm run test:kahin-defter` iki TZ (değişmemeli).
- Ekran (ders 9, 12, 28): Düzenle formu (taksitli fatura → 'Taksitli' seçili açılır; değiştirmeden Kaydet → kart kalır), kapanmış kart + iade + iade iptali (Kalan / taksit satırları / Kartı Kapat onay tutarı), iki kartlı caride gecikmiş, Düzenle ile azaltma sonrası kart. Gerçek tıklama + Tab, insan hızında; kayıttan sonra veri tabanı okunur. Görüntüler `docs/kanit/2026-11-21/izt-ekran/` — her görüntüye BAK, ne gördüğünü yaz. Düzenle formuna dokunan mevcut e2e senaryolarını ci.yml'den bul (grep), hepsini koş (ders 9, 37).
- HIZ (ders 47, 53 (a) — değişen HER yol): kart penceresi GET, fatura kartı GET, Taksitler listesi GET, cari kartı özeti, Tek Yükümlülük Kuyruğu / gecikmiş okuması, iade yazımı, iade iptali, fatura Düzenle kaydı. Temiz 100 bin verisi `{SP}/ana-kabul` altında (OKU; TAZE kopya her ölçümde). Eski = {taban} (fatura kartı GET için ayrıca `af655afd`). `flock -x`; 3 tur dönüşümlü; her ölçüm başında yük < 1,5 bekle; olay döngüsü en çok da yazılır; /proc/loadavg rapora. KÖTÜ = ortanca VE en iyi ikisi de > +%10 → düzelt ya da nedenini ölçümle yaz.

## 2.5.1'E BIRAK (kullanıcı 20.11, AYNEN: "yapılan işlerde döngüye girmeyelim detaylara boğulup, programı yada kullanıcıyı etkileyemem hususları 2.5.1 sürümüne bırakalım")
Programın davranışını, sayılarını, hızını ya da kullanıcının gördüğünü / yaptığını DEĞİŞTİRMEYEN her husus (test düzeni, araç, belge, ölçüm nüansı, yaşayan mutantın gösterdiği eksik test, doğrulanmamış kuşku, sayıları doğru olan görünüm ayrıntısı) bu turda KOVALANMAZ; raporun 'SONRAKİ SÜRÜME (2.5.1)' başlığına yazılır.

## Rapor (SubagentHandback; Türkçe; kısa cümle, madde ve tablo)
Özet → taban / dal ucu / commit listesi → değişen yollar (satır sayısı) → her iş için: kural (hangi karar), kod, test (eski kodda kırmızı — ileti ve NEDEN; yenide yeşil; iki TZ sayıları) → komşu listesi ve sayıları → kâhin ↔ program iki TZ (fark sayısı, kapanan / kalan; yapım aşaması kendi kopyada) → hız tablosu (en iyi / ortanca ms, son ÷ taban, olay döngüsü, yük) → ekran (dosya adı + ne görüldü) → KULLANICIYA SORULMALI → BAŞ MİMAR KARARI GEREKEN → SONRAKİ SÜRÜME (2.5.1) → DENENMEYEN → BİLİNEN SINIRLAR → ana oturumun yeniden koşacağı komutlar (tam yol, kilitli) → not defteri. Ortam satırı: 'Yük X / 4 çekirdek, bellek boş Y GB, disk boş Z GB'. Disk 5 GB'ın altına düşürülmez; yük > 4 ise yeni yük başlatma, bekle.
Commit: yalnız kendi yolların (`git add <yol>`; `-A` / `-u` / `commit -a` YOK — ders 44); satırlar `Co-Authored-By: Claude <noreply@anthropic.com>` + `Claude-Session: https://claude.ai/code/session_01EhegDvmPQ9hx2ibfitm6og` (model adı YAZILMAZ). Başkasının sürecini öldürme, joker desenle silme (ders 36).
"""
open(cikti, "w", encoding="utf-8").write(metin)
print("yazıldı", cikti, len(metin), "karakter")
