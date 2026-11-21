#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""İZLEYEN TUR 2 (S241 kodu + kart kapsam SEÇİMİNİN tek yardımcıya getirilmesi + Düzenle azaltma hızı + iade Düzenle'sinde kayıtlı taksitlere büyüme + faturasız stok iadesinin kesinti kaydı) görev metni üreteci.
Karar metinleri iş listesinden AYNEN alınır (ders 40; prensip §9). Kullanım:
  python3 -I docs/devir/2.5.0-DEVAM/izt2-istem-uret.py <çıktı .txt> <taban commit>"""
import sys

cikti, taban = sys.argv[1:3]
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
    d_satiri("KULLANICI KARARI 11.11 03:15 UTC"),
    d_satiri("KULLANICI KARARI 11.11 06:35 UTC"),
] + [c_satiri(n) for n in ("S234", "S238", "S241", "S242")])
D = "\n\n".join(d_satiri(o) for o in (
    "BAŞ MİMAR KARARI 21.11 18:28 UTC",
    "BAŞ MİMAR KARARI 21.11 12:50 UTC",
))

metin = f"""Sen DestekOfis projesinde İZLEYEN TUR 2'nin KOD ajanısın (2.5.0; taksit kartı kapsamı / küçülmesi / iade / fatura Düzenle / Tek Yükümlülük Kuyruğu — PARA ÇEKİRDEĞİNE YAKIN; eforun high). BEŞ İŞ (aşağıda). Yanıtın Türkçe. PUSH YOK. Her bitmiş adımı (kod + testi + kanıtı) HEMEN commit et (kapsayıcı yeniden başlayabilir; commit'siz iş kaybolur). Koşuları ≤ 40 dk parçalara böl; rapor taslağını `docs/kanit/2026-11-21/izt2-rapor-taslak.md`'de adım adım tut. Zamanlanmış görev KURMA. Kendi arka plan işin sürerken rapor vermeden BİTİRME (arka plan koşusunu `timeout -k 5 7200 …` ile başlat; Bash aracının `timeout` parametresini 7200000 ver; bildirimini bekle). Bağlamın daralırsa bitmiş adımların commit'leriyle ARA RAPOR ver ve dur (ders 46).

KİLİT KURALI (ders 50, 52): ölçüm DIŞINDAKİ HER koşu (tek test dosyası, e2e, kâhin, komşu taraması dahil) `flock -s {SP}/olcum.lock` altında; hız ÖLÇÜMÜ `flock -x {SP}/olcum.lock` altında. Süre sınırını flock'un İÇİNE koy (`flock -s -w 3600 <kilit> timeout -k 5 2400 <komut>`) — kilit beklemesi adım süresine sayılmasın. Ana oturumun özel kilitli ölçümü sırasında kilitsiz koşu YASAK (başladığında bir ölçüm sürüyor olabilir — koşun bekler; bekle).

## Hazırlık
1. Worktree'de (kendi commit'in YOKKEN) `git reset --hard {taban}`. `git log --oneline -1` ile doğrula; değilse DUR. Bu taban = çalışma dalı + izleyen küçük tur (P-2, P-1 / S238, S234-c, BULGU-1 / 2, fatura kartı GET hızı, S239 / S240 — tasarım §19) + yapım aşaması listesi (38 kayıt, hepsi kâhinin Düzenle yoklaması). `ln -s /home/user/ofis---y-netimi/node_modules node_modules` (`npm ci` YOK); tarayıcı `PLAYWRIGHT_BROWSERS_PATH={SP}/pw-1194`. ESKİ KOD (kırmızı kanıtı) = `{taban}`: `git -C /home/user/ofis---y-netimi worktree add --detach <benzersiz klasör> {taban}` (+ node_modules bağı; bitince `git -C /home/user/ofis---y-netimi worktree remove --force <o tam yol>`; ders 54: GIT_DIR / GIT_WORK_TREE VERME). Not defteri `{SP}/izt2-<kısa>` (ders 25; başka ajanın klasörünü KULLANMA — yalnız aşağıda adı geçen betikleri kendi klasörüne KOPYALA).
2. ÖNCE oku: `CLAUDE.md` (dersler; özellikle 6, 7, 9, 10, 12, 17, 28, 34, 38, 40, 43, 44, 47, 51, 53, 54; 'Yazım düzeni'); `docs/BAGIMSIZ-DOGRULAMA-PRENSIBI.md`; önceki turun raporu `docs/devir/2.5.0-DEVAM/izt-rapor.md` ('KULLANICIYA SORULMALI' SK-42, 'BAŞ MİMAR KARARI GEREKEN' 1 ve 2, 'SONRAKİ SÜRÜME' 1. madde, 'DENENMEYEN'); `docs/erp/C7B-FATURA-TASARIM.md` §16.3, §17, §18, §19; önceki turun yoklama ve hız betikleri `{SP}/izt-a68/probe/ayr.mjs` (kapsam seçimi ayrışması), `{SP}/izt-a68/hiz/hiz.mjs` + `kos.sh` (kendi klasörüne kopyala). Kâhinin elle senaryolarını (`test/bagimsiz/cari/senaryolar/`) YALNIZ OKU — `test/bagimsiz/**` YAZMA.

## Kararlar (iş listesinden AYNEN)
{KARARLAR}

## Bu turun ve önceki turun baş mimar kararları (iş listesi D'den AYNEN)
{D}

## İşler (her biri: önce tasarım notu §20'ye kural → sonra test (eski kodda KIRMIZI, nedeni okunmuş) → kod → yeşil)
1. S241 = A: faturanın Düzenle ile kartın AÇIK KALANINDAN FAZLA azaltılması — fazlası carinin avansı, iadeyle AYNI; Düzenle kesintisi iade kesintisi gibi kayda geçer; kartın kendi hesabı ve Tek Yükümlülük Kuyruğu görünümü AYNI sayıyı verir. Örnek (önceki turun raporu SK-42 (a)): kart 900 (3 × 300), kart tahsilatı 600, Düzenle 900 → 300 ⇒ kart 600, Tahsil Edilen 600, Kalan 0 (iki görünümde de), avans 300, bakiye −300. Açık kart, Borçta Kalsın ile kapanmış kart, kendi kartı. S242 = A (artırma kartı değiştirmez) bugünkü davranıştır — bir bekçi sınamayla göster.
2. KART KAPSAM SEÇİMİ TEK YARDIMCIDA (önceki turun 'BAŞ MİMAR KARARI GEREKEN' 1; D 18:28 (2)): carinin açık borcu kart tutarından fazlayken kapama defteri kartı Tek Yükümlülük Kuyruğu'ndan FARKLI kaleme bağlıyor. Kural VAR (S110 = A, S120 = A — yukarıda AYNEN; kuyruk ve bağımsız kâhin kurala uyuyor) → kapama defterinin kapsam SEÇİMİ kuyruğunkiyle TEK yardımcıya getirilir; iade, İptal Et ve Düzenle bu seçimi okur. Beklenen (önceki turun örneği): A 600 (01.09), B 600 (02.09), elle Mevcut Borç kartı 600 (03.09) — ekranda A 'Taksitte', B 'Gecikti'; B'nin İptal Et'i kartı DEĞİŞTİRMEZ; A'nın İptal Et'i kartı karar (4) / S206 ile küçültür / kapatır; iade de seçilen kalemin kartını küçültür. Kararların söylemediği bir alt durum çıkarsa KODLA KARAR VERME (ders 43): bugünkü davranışı sayılarla yaz, 'KULLANICIYA SORULMALI'ya.
3. DÜZENLE AZALTMA HIZI (önceki turun 'BAŞ MİMAR KARARI GEREKEN' 2; D 18:28 (3); kullanıcıyı etkiler): temiz 100 bin veride fatura Düzenle ile azaltma 6,3–7 sn sürüyor, olay döngüsü ~7 sn kilitli (Ç7b öncesinde de aynı). ÖNCE CPU profiliyle kök nedeni bul ve ölç (hangi okuma / yazma, kaç satır); sonra davranışı değiştirmeden düzelt (ders 47: öğe başına ağır okuma yok, toplu SQL; atomik yazmada olay döngüsüne sıra verilmez) + EŞDEĞERLİK testi (önceki kodla aynı sonuç — kart, taksitler, kapama, defter, bakiye) + aynı veri kopyasıyla önce / sonra. Hedef: süre ve olay döngüsü en çok değeri belirgin düşer; kötüleşen yol olmaz. Düzeltme yapısal (göç, iş parçacığı) gerektiriyorsa KODLAMA — ölçümle raporla ('BAŞ MİMAR KARARI GEREKEN').
4. İADE DÜZENLE'SİNDE KENDİ KARTIN BÜYÜMESİ (önceki turun 'SONRAKİ SÜRÜME' 1. maddesi; D 18:28 (4)): iade belgesi Düzenle ile değiştirilince (azaltılınca / kaldırılınca) kendi kart kayıtlı taksitlere değil son taksite büyüyor — S238 = A'nın komşu yolu (ders 10): iadenin küçülttüğü AYNI taksitlere geri büyür (kaydı olmayan eski iade bugünkü gibi son taksite). Kapsayan kart Düzenle'de zaten kayda göre büyüyor — iki yolu tek yardımcıda birleştir.
5. FATURASIZ STOK İADESİNİN KESİNTİ KAYDI (önceki turun 'DENENMEYEN'i; kullanıcıyı etkileyebilir): faturasız stok iadesi kartı küçültüyorsa ve iptal edilince (ya da silinince) S238 = A ile aynı taksite geri büyümüyorsa — ÖNCE yokla ve sayılarla yaz; program kararın dışında davranıyorsa düzelt (aynı tek yardımcı). Ayrıca: iadeyle küçülen taksit sonradan elle düzenlenir / silinirse ve iade sonra iptal edilirse ne oluyor — yokla, sayılarla yaz; karar söylemiyorsa 'KULLANICIYA SORULMALI'.

## Dosya sınırı
İZİNLİ: `server/routes/plans.mjs`, `server/routes/invoices.mjs`, `server/routes/stock.mjs` (yalnız iade / kart küçülmesi yolu), Tek Yükümlülük Kuyruğu ve kapama defteri yardımcıları (`server/lib/obligation-*`, `server/lib/*invoice-settle*`, kart kapsamı / küçülmesi yardımcıları — hangileri olduğunu rapora yaz), yeni / değişen testler (`test/**` — `test/bagimsiz/**` HARİÇ), yeni ekran senaryosu `test/e2e/senaryo-izt2-250.mjs` + `package.json`'a `test:senaryo-izt2-250` betiği (ci.yml / release.yml'ye ANA OTURUM ekler — sen dokunma), `docs/erp/C7B-FATURA-TASARIM.md` (yeni §20), `docs/kanit/2026-11-21/izt2-*`. GÖÇ beklenmiyor; gerekirse YALNIZ `migrations.mjs` sonuna yeni göç + şema kapısı (sema-kapisi-bs7) + geri yükleme testleri (ders 10) — önce raporda gerekçe. Başka dosya gerekirse DUR, raporla.

## Sınama (ders 6, 7, 9, 10, 12, 17, 28, 34, 38, 47, 51, 53)
- Her yeni test ESKİ kodda ({taban}) KIRMIZI, iletisinde beklenen NEDEN; yenide yeşil. İki TZ (UTC + Europe/Istanbul). Göreli tarih + sahte saat (ders 13).
- Değişen kodun bütün yolları ve komşuları (ders 9, 10): komşu listesini tahminle değil `test/` taramasıyla çıkar (değişen işlevlerin adlarıyla grep), hepsini iki TZ'de koş — SON değişiklikten SONRA bir kez daha (önceki turda son değişiklik komşu taramasından sonra gelmişti); v2.4.9 altın testi (`test/banka-210-altin.test.mjs`) ve K1 farkı (`test/guvenilirlik/kapama-k1-fark.mjs`) dahil.
- Kilitli dönem + yedek → geri yükleme (D 18:28 (6)): iade / Düzenle kesinti kaydının yeni alanları yedekte taşınıyor, geri yüklemeden sonra iade iptali aynı taksite büyüyor mu; kilitli dönemdeki kart / iade reddi bugünkü gibi mi — sınamayla göster.
- Kâhin ↔ program (bağımsız beklenen): `npm run test:kahin-cari` iki TZ — fark çıkarsa nedenini yaz (kâhin bu turla PARALEL bakımda — 'cari kâhini bakımı 25'; onun yeni senaryoları bu tabanda yok). Kendi kopyanda `--yapim-asamasi-yaz` (KAHIN_YAPIM_ASAMASI ile not defterine) koş; depodaki `YAPIM-ASAMASI.json`'a DOKUNMA.
- Ekran (ders 9, 12, 28): Düzenle ile kartın kalanından fazla azaltma sonrası kart penceresi + cari kartı (iki görünüm aynı sayı, avans), iki faturalı caride elle kart + seçilmeyen faturanın İptal Et'i (kart değişmez) + seçilenin İptal Et'i, iade Düzenle'si sonrası taksit satırları. Gerçek tıklama + Tab, insan hızında; kayıttan sonra veri tabanı okunur. Görüntüler `docs/kanit/2026-11-21/izt2-ekran/` — her görüntüye BAK, ne gördüğünü yaz. Düzenle formuna / kart penceresine dokunan mevcut e2e senaryolarını ci.yml'den bul (grep; önceki turun listesi raporunda), hepsini koş (ders 9, 37).
- HIZ (ders 47, 53 (a) — değişen HER yol): fatura Düzenle kaydı (aynı içerik + azaltma + kalanından fazla azaltma), iade yazımı, iade İptal Et, fatura İptal Et (kartlı caride), kart penceresi GET, fatura kartı GET, cari kartı GET, Tek Yükümlülük Kuyruğu / gecikmiş okuması, Taksitler listesi, Faturalar listesi. Temiz 100 bin verisi `{SP}/ana-kabul` altında (OKU; TAZE kopya her ölçümde). Eski = {taban}. `flock -x`; 3 tur dönüşümlü; her ölçüm başında yük < 1,5 bekle; olay döngüsü en çok da yazılır (önceki turda 'olay döngüsü 0,0' okunan satırlar vardı — ölçüm aracını düzeltmek bu turun işi DEĞİL, yalnız böyle satırları raporda işaretle); /proc/loadavg rapora. KÖTÜ = ortanca VE en iyi ikisi de > +%10 → düzelt ya da nedenini ölçümle yaz.

## 2.5.1'E BIRAK (kullanıcı 20.11, AYNEN: "yapılan işlerde döngüye girmeyelim detaylara boğulup, programı yada kullanıcıyı etkileyemem hususları 2.5.1 sürümüne bırakalım")
Programın davranışını, sayılarını, hızını ya da kullanıcının gördüğünü / yaptığını DEĞİŞTİRMEYEN her husus (test düzeni, araç, belge, ölçüm nüansı, yaşayan mutantın gösterdiği eksik test, doğrulanmamış kuşku, sayıları doğru olan görünüm ayrıntısı — ör. silinen taksitlerden sonra kalan taksitin sıra no'su) bu turda KOVALANMAZ; raporun 'SONRAKİ SÜRÜME (2.5.1)' başlığına yazılır.
Kararın söylemediği HER alt durum (para / kapama sırası) — ders 43: kodla KARAR VERME; bugünkü davranışı sayılarla yaz, 'KULLANICIYA SORULMALI'ya (iki seçenek + öneri; uç durumsa üçüncü seçenek 'Uç durum böyle kalsın (BİLİNEN SINIR)'; 'yaygın programlarda nasıl' satırı — doğrulanmış kaynak okumadıysan 'okunmadı' yaz).

## Rapor (SubagentHandback; Türkçe; kısa cümle, madde ve tablo)
Özet → taban / dal ucu / commit listesi → değişen yollar (satır sayısı) → her iş için: kural (hangi karar), kod, test (eski kodda kırmızı — ileti ve NEDEN; yenide yeşil; iki TZ sayıları) → komşu listesi ve sayıları → kâhin ↔ program iki TZ (fark sayısı; yapım aşaması kendi kopyada) → hız tablosu (en iyi / ortanca ms, son ÷ taban, olay döngüsü, yük) → ekran (dosya adı + ne görüldü) → KULLANICIYA SORULMALI → BAŞ MİMAR KARARI GEREKEN → SONRAKİ SÜRÜME (2.5.1) → DENENMEYEN → BİLİNEN SINIRLAR → ana oturumun yeniden koşacağı komutlar (tam yol, kilitli) → not defteri. Ortam satırı: 'Yük X / 4 çekirdek, bellek boş Y GB, disk boş Z GB'. Disk 5 GB'ın altına düşürülmez; yük > 4 ise yeni yük başlatma, bekle.
Commit: yalnız kendi yolların (`git add <yol>`; `-A` / `-u` / `commit -a` YOK — ders 44); satırlar `Co-Authored-By: Claude <noreply@anthropic.com>` + `Claude-Session: https://claude.ai/code/session_01EhegDvmPQ9hx2ibfitm6og` (model adı YAZILMAZ). Başkasının sürecini öldürme, joker desenle silme (ders 36).
"""
open(cikti, "w", encoding="utf-8").write(metin)
print("yazıldı", cikti, len(metin), "karakter")
