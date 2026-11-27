#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""İZLEYEN TUR 3 (Düzenle azaltmasının 6–7 sn sürmesi — bütünlük kapısının kapsam süzgeci; stok iadesinde kart ekranının canlı yenilenmesi) görev metni üreteci.
Kararlar iş listesinden AYNEN (ders 40). Kullanım: python3 -I docs/devir/2.5.0-DEVAM/izt3-istem-uret.py <çıktı .txt> <taban commit>"""
import sys
cikti, taban = sys.argv[1:3]
L = open("docs/2.5.0-IS-LISTESI.md", encoding="utf-8").read().split("\n")
def d_satiri(onek):
    s = [l for l in L if l.startswith("- " + onek)]
    if len(s) != 1: sys.exit("D satırı yok / çok: " + onek)
    return s[0][2:]
SP = "/tmp/claude-0/-home-user/de5e1cbf-7e68-5683-b7bb-f27655eaed4f/scratchpad"
D = d_satiri("BAŞ MİMAR KARARI 22.11 01:02 UTC")
metin = f"""Sen DestekOfis projesinde İZLEYEN TUR 3'ün KOD ajanısın (2.5.0; BÜTÜNLÜK KAPISI (kapı dışı değişikliği yakalayan güvenlik çekirdeği) + fatura Düzenle hızı; eforun high). İKİ İŞ (aşağıda). Yanıtın Türkçe. PUSH YOK. Her bitmiş adımı (kod + testi + kanıtı) HEMEN commit et. Koşuları ≤ 40 dk parçalara böl; rapor taslağını `docs/kanit/2026-11-22/izt3-rapor-taslak.md`'de adım adım tut. Zamanlanmış görev KURMA. Kendi arka plan işin sürerken rapor vermeden BİTİRME (arka plan koşusunu `timeout -k 5 7200 …` ile başlat; Bash aracının `timeout` parametresini 7200000 ver). Bağlamın daralırsa bitmiş adımların commit'leriyle ARA RAPOR ver ve dur (ders 46).

KİLİT KURALI (ders 50, 52): ölçüm DIŞINDAKİ HER koşu (tek test dahil) `flock -s -w 3600 {SP}/olcum.lock timeout -k 5 <sn> <komut>` (süre sınırı flock'un İÇİNDE); hız ÖLÇÜMÜ `flock -x -w 3600 {SP}/olcum.lock timeout -k 5 <sn> <komut>` (yine İÇERİDE — kilit beklemesi süreye SAYILMAZ). Başka bir özel kilitli ölçüm sürerken koşun bekler — bekle, kilitsiz koşma.

## Hazırlık
1. Worktree'de (kendi commit'in YOKKEN) `git reset --hard {taban}`; `git log --oneline -1` ile doğrula; değilse DUR. Bu taban = çalışma dalı (Ç6-HESAP tur 4 + 5 dahil) + izleyen tur 2 (S241, kapsam seçimi tek yardımcıda, iade Düzenle'si, faturasız stok iadesi — tasarım `docs/erp/C7B-FATURA-TASARIM.md` §20) + cari kâhini bakımı 25. `ln -s /home/user/ofis---y-netimi/node_modules node_modules` (`npm ci` YOK); tarayıcı `PLAYWRIGHT_BROWSERS_PATH={SP}/pw-1194`. ESKİ KOD = `{taban}`: `git -C /home/user/ofis---y-netimi worktree add --detach <benzersiz klasör> {taban}` (+ node_modules bağı; bitince `git -C /home/user/ofis---y-netimi worktree remove --force <o tam yol>`; ders 54). Not defteri `{SP}/izt3-<kısa>` (ders 25).
2. ÖNCE oku: `CLAUDE.md` (dersler; özellikle 3, 6, 7, 9, 10, 17, 38, 43, 44, 47, 48, 51, 53, 54); `docs/BAGIMSIZ-DOGRULAMA-PRENSIBI.md`; önceki turun raporu `docs/devir/2.5.0-DEVAM/izt2-rapor.md` ve tam raporu `.claude/worktrees/agent-a00386bc926cebc74/docs/kanit/2026-11-21/izt2-rapor-taslak.md` (İş 3 bölümü, 'BAŞ MİMAR KARARI GEREKEN' 1, 'SONRAKİ SÜRÜME'nin ikinci maddesi); önceki turun ölçüm ve tanı dosyaları `{SP}/izt2-a00/hiz/` (tani-*.txt, prof2-*.txt, hiz2.mjs, kos.sh, tablo.py — kendi klasörüne KOPYALA) ve prototip `.claude/worktrees/agent-a00386bc926cebc74/docs/kanit/2026-11-21/izt2-kos/oneri-integrity-scope.py`.

## Bu turun baş mimar kararı (iş listesi D'den AYNEN)
{D}

## İşler (her biri: önce tasarım notu §21'e kural → sonra test (eski kodda KIRMIZI, nedeni okunmuş) → kod → yeşil)
1. DÜZENLE AZALTMASININ HIZI (D (1)): temiz 100 bin veride fatura Düzenle ile azaltma 6–7 sn sürüyor, olay döngüsü kilitli; kök neden (önceki turun ölçümü): bütünlük kapısının kapsam süzgeci aynı rowid yeniden kullanılınca ('kimlik değişti' — `stock_moves`) TAM denetime düşüyor (~7,1 sn). Öneri: süzgeçte 'aynı rowid + farklı kimlik' SİLİNEN + EKLENEN iki ayrı satır sayılsın (prototip 8.004 → 228 ms). KOŞUL (güvenlik çekirdeği — pazarlıksız): kapı dışı (program dışından) yapılan HER değişiklik bugünkü gibi YAKALANMAYA DEVAM EDER. Bunu ayrıca göster: (a) kapı sınamalarının ve kapı eşdeğerliğinin (gateVerify) tamamı yeşil; (b) YENİ sınama — kapı dışından aynı rowid'e farklı kimlikli satır yazılması (kilitli dönemde ve açık dönemde), rowid'i yeniden kullanılmış satırın tutarının kapı dışından değiştirilmesi, silinip aynı rowid ile geri yazılması — her biri bugünkü gibi yakalanır (eski kodda da yakalandığı ve yenide de yakalandığı sayıyla); (c) bilerek bozulmuş süzgeç (mutant: kimlik değişimini hiç saymayan) bu sınamalarda KIRMIZI. Davranışı değiştirmeden hız: EŞDEĞERLİK — aynı veri üzerinde eski ve yeni kodun kapı sonucu (bulgu listesi) birebir aynı (Düzenle, iade, stok hareketi silme / düzeltme, geri yükleme, kilitli dönem). Dosya izni: `server/lib/integrity-scope.mjs` (ve gerekirse yalnız okuyan yardımcısı — rapora yaz).
2. STOK İADESİNDE KART EKRANININ CANLI YENİLENMESİ (D (3)): faturasız stok iadesi hareketi düzeltilince / silinince kart değişiyor ama açık kart penceresi ve Taksitler listesi canlı yenileme bildirimi almıyor (yeniden açınca doğru). Kart değiştiren öbür yollar nasıl bildiriyorsa öyle bildir; ekranda göster (ders 12 — gerçek tıklama, insan hızı; kayıttan sonra veri tabanı okunur). Dosya izni: `server/routes/stock.mjs` (yalnız iade yolu).

## Dosya sınırı
İZİNLİ: yukarıdaki iki iş için adı geçen dosyalar, yeni / değişen testler (`test/**` — `test/bagimsiz/**` HARİÇ), yeni ekran senaryosu `test/e2e/senaryo-izt3-250.mjs` + `package.json`'a `test:senaryo-izt3-250` (ci.yml / release.yml'ye ANA OTURUM ekler), `docs/erp/C7B-FATURA-TASARIM.md` (yeni §21), `docs/kanit/2026-11-22/izt3-*`. GÖÇ YOK. `YAPIM-ASAMASI.json`'a DOKUNMA. Başka dosya gerekirse DUR, raporla.

## Sınama (ders 3, 6, 7, 9, 10, 17, 38, 47, 48, 51, 53)
- Her yeni test ESKİ kodda ({taban}) KIRMIZI (hız eşdeğerliği / yakalama sınamaları eski kodda da yeşilse bunu açıkça yaz — onların dişi mutantla gösterilir), yenide yeşil; iki TZ (UTC + Europe/Istanbul).
- Komşular (ders 10): bütünlük kapısının BÜTÜN çağıranları ve kapı / bütünlük / kilit / geri yükleme / şema kapısı / donmuş defter sınamaları (`test/` taramasıyla) iki TZ'de — SON değişiklikten SONRA.
- Kâhin ↔ program: `npm run test:kahin-cari` ve `npm run test:kahin-defter` iki TZ; kendi kopyanda `--yapim-asamasi-yaz` (KAHIN_YAPIM_ASAMASI ile not defterine) — depodaki listeye DOKUNMA.
- HIZ (ders 47, 53 (a) — değişen HER yol): fatura Düzenle (aynı içerik + azaltma + kalanından fazla azaltma), iade yazımı, stok hareketi silme / düzeltme, kart penceresi GET, fatura kartı GET, Dönem Kilidi (kilitle / aç), bütünlük taraması (Yönetim › Sistem). Temiz 100 bin `{SP}/ana-kabul/temiz-100k` (OKU; TAZE kopya her ölçümde). Eski = {taban}. 3 tur dönüşümlü; her ölçüm başında yük < 1,5; olay döngüsü en çok da yazılır; /proc/loadavg rapora. KÖTÜ = ortanca VE en iyi ikisi de > +%10.
- DOSYAYA DOKUNAN TEST WINDOWS'TA (ders 48): kapı / bütünlük yolu Windows'ta da koşar — yazdığın sınamada dosya yolu / satır sonu varsayımı olmasın; ana oturum CI'de Windows'u okur.

## 2.5.1'E BIRAK (kullanıcı 20.11, AYNEN: "yapılan işlerde döngüye girmeyelim detaylara boğulup, programı yada kullanıcıyı etkileyemem hususları 2.5.1 sürümüne bırakalım")
Programın davranışını, sayılarını, hızını ya da kullanıcının gördüğünü DEĞİŞTİRMEYEN husus bu turda KOVALANMAZ; raporun 'SONRAKİ SÜRÜME (2.5.1)' başlığına. Kararın söylemediği para / kapama alt durumu (ders 43): kodla KARAR VERME, 'KULLANICIYA SORULMALI'ya (iki seçenek + öneri; uç durumsa 'Uç durum böyle kalsın (BİLİNEN SINIR)'; 'yaygın programlarda' satırı — okunmadıysa 'okunmadı').

## Rapor (SubagentHandback; Türkçe; kısa cümle, madde ve tablo)
Özet → taban / dal ucu / commit listesi → değişen yollar → her iş: kural, kod, test (eski kodda kırmızı — ileti ve NEDEN; iki TZ sayıları), YAKALAMA sınamaları ve mutant sonucu → komşular → kâhin iki TZ → hız tablosu (en iyi / ortanca, son ÷ taban, olay döngüsü, yük) → ekran (dosya + ne görüldü) → KULLANICIYA SORULMALI → BAŞ MİMAR KARARI GEREKEN → SONRAKİ SÜRÜME (2.5.1) → DENENMEYEN → BİLİNEN SINIRLAR → ana oturumun yeniden koşacağı komutlar (tam yol, kilitli) → not defteri. Ortam satırı: 'Yük X / 4 çekirdek, bellek boş Y GB, disk boş Z GB'. Disk 5 GB'ın altına düşürülmez.
Commit: yalnız kendi yolların (`git add <yol>`; `-A` / `-u` / `commit -a` YOK — ders 44); satırlar `Co-Authored-By: Claude <noreply@anthropic.com>` + `Claude-Session: https://claude.ai/code/session_01EhegDvmPQ9hx2ibfitm6og` (model adı YAZILMAZ). Başkasının sürecini öldürme, joker desenle silme (ders 36).
"""
open(cikti, "w", encoding="utf-8").write(metin)
print("yazıldı", cikti, len(metin))
