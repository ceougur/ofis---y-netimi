#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""İZLEYEN TUR 4 (S255 = A — kartın içine aldığı faturaya BAĞLI tahsilatın kapama sırası; TEK DAR KONTROL ORTA-1) görev metni üreteci. izt3-istem-uret.py'den türetildi.
Kararlar iş listesinden AYNEN (ders 40). Kullanım: python3 -I docs/devir/2.5.0-DEVAM/izt4-istem-uret.py <çıktı .txt> <taban commit>"""
import sys
cikti, taban = sys.argv[1:3]
L = open("docs/2.5.0-IS-LISTESI.md", encoding="utf-8").read().split("\n")
def d_satiri(onek):
    s = [l for l in L if l.startswith("- " + onek)]
    if len(s) != 1: sys.exit("D satırı yok / çok: " + onek)
    return s[0][2:]
def soru(n):
    s = [l.strip() for l in L if l.startswith(f"  S{n} (")]
    if len(s) != 1: sys.exit(f"S{n} yok / çok")
    return s[0]
SP = "/tmp/claude-0/-home-user/de5e1cbf-7e68-5683-b7bb-f27655eaed4f/scratchpad"
D = d_satiri("BAŞ MİMAR KARARI 22.11 10:26 UTC")
D = D[D.index("KARARLAR:"):]
S255, S230, S229, S254 = soru(255), soru(230), soru(229), soru(254)
metin = f"""Sen DestekOfis projesinde İZLEYEN TUR 4'ün KOD ajanısın (2.5.0; PARA ÇEKİRDEĞİ — Tek Yükümlülük Kuyruğu / kapama defteri; eforun high). TEK İŞ (aşağıda). Yanıtın Türkçe. PUSH YOK. Her bitmiş adımı (kod + testi + kanıtı) HEMEN commit et. Koşuları ≤ 40 dk parçalara böl; rapor taslağını `docs/kanit/2026-11-22/izt4-rapor-taslak.md`'de adım adım tut. Zamanlanmış görev KURMA. Kendi arka plan işin sürerken rapor vermeden BİTİRME (arka plan koşusunu `timeout -k 5 7200 …` ile başlat; Bash aracının `timeout` parametresini 7200000 ver). Bağlamın daralırsa bitmiş adımların commit'leriyle ARA RAPOR ver ve dur (ders 46).

KİLİT KURALI (ders 50, 52): ölçüm DIŞINDAKİ HER koşu (tek test dahil) `flock -s -w 3600 {SP}/olcum.lock timeout -k 5 <sn> <komut>` (süre sınırı flock'un İÇİNDE); hız ÖLÇÜMÜ `flock -x -w 3600 {SP}/olcum.lock timeout -k 5 <sn> <komut>`. Başka bir özel kilitli ölçüm sürerken koşun bekler — bekle, kilitsiz koşma. Bu sırada AYRI bir kâhin ajanı da paylaşılan kilitle koşuyor; çakışma yok.

## Hazırlık
1. Worktree'de (kendi commit'in YOKKEN) `git reset --hard {taban}`; `git log --oneline -1` ile doğrula; değilse DUR. Bu taban = çalışma dalı (izleyen tur 1–3, S229 / S230, S223 / S231, cari kâhini bakımı 27 dahil). `ln -s /home/user/ofis---y-netimi/node_modules node_modules` (`npm ci` YOK); tarayıcı `PLAYWRIGHT_BROWSERS_PATH={SP}/pw-1194`. ESKİ KOD = `{taban}`: `git -C /home/user/ofis---y-netimi worktree add --detach <benzersiz klasör> {taban}` (+ node_modules bağı; bitince `git -C /home/user/ofis---y-netimi worktree remove --force <o tam yol>`; ders 54). Not defteri `{SP}/izt4-<kısa>` (ders 25).
2. ÖNCE oku: `CLAUDE.md` (dersler; özellikle 3, 6, 7, 9, 10, 17, 38, 43, 44, 47, 51, 53, 54); `docs/BAGIMSIZ-DOGRULAMA-PRENSIBI.md`; tasarım notu `docs/erp/C7B-FATURA-TASARIM.md` (§18–§21 — kart kapsamı, gösterilen açık) ve Ç5 tasarım notu `docs/erp/C5B-TYK-TASARIM.md` (Tek Yükümlülük Kuyruğu); dar kontrolün raporu `docs/devir/2.5.0-DEVAM/dk-tek-rapor.md` (ORTA-1 ve 'İLK MADDELER 2'); dar kontrolün senaryo betiği `{SP}/dk-tek-a835/senaryo.mjs` (SC5 / SC7 — kendi klasörüne KOPYALA; `ROOT=<kod> SC=SC5,SC7 node senaryo.mjs`).

## Bu turun kararları (iş listesinden AYNEN)
- D (baş mimar, KARARLAR bölümü): {D}
- {S255}
- {S230}
- {S229}
- {S254}

## İş — S255 = A (her adım: önce tasarım notuna kural (yeni §22) → sonra test (eski kodda KIRMIZI, nedeni okunmuş) → kod → yeşil)
Mevcut Borç kartının bir kısmını (ya da tamamını) içine aldığı faturaya BAĞLI ödeme (Kapatılacak Fatura'lı cari tahsilatı, faturanın Tahsilat Ekle'si; faturaya bağlı çek / senet ve öbür bağlı yollar — `server/` taramasıyla HEPSİNİ listele) önce faturanın GÖSTERİLEN açığını (kartın / kartların almadığı kısım; S230 = A'nın gösterilen açığı) kapatır; FAZLASI tek kuyrukta bağsız ödeme gibi sıradaki açık borca (S230 = A: 'carinin vadesi en önce gelen açık borcuna' — kartın taksitleri dahil) gider. Faturanın tamamı kartta ise (gösterilen açık 0) bağlı ödemenin TAMAMI kuyruğa gider. Girilebilecek tutarın sınırı ve form önerisi DEĞİŞMEZ (S230). Sonuç: kart penceresi, Taksitler listesi, cari özeti (Tahsil / Kalan / gecikmiş), kapama defteri, Açık Faturalar ve cari bakiyesi AYNI parayı söyler (örnekteki sayılar S255 A satırında). Tedarikçi yönünde (alış faturası) aynı yapı varsa simetrik uygula; yoksa raporda 'yok' yaz. Mahsup Et'in bu kurala girip girmediği karar metninden açık değilse kodla KARAR VERME — KULLANICIYA SORULMALI'ya yaz (bugünkü davranışı sayıyla).
- ESKİ VERİ: göç YOK (gerekirse DUR, raporla). Var olan bağlı tahsilatlı veride yeni kural okumada uygulanıyorsa v2.4.9 verisiyle (eski sürümün GERÇEK koduyla üret: `git -C /home/user/ofis---y-netimi worktree add --detach <klasör> v2.4.9`) önce / sonra sınıf sınıf karşılaştır (ders 53 (b)); kartı olmayan carilerde fark 0 olmalı.
- Dosya izni: Tek Yükümlülük Kuyruğu / kapama defteri yardımcısı (`server/lib/obligation-queue.mjs` ve doğrudan çağıranlar — değiştirdiğin her dosyayı ve nedenini rapora yaz), yeni / değişen testler (`test/**` — `test/bagimsiz/**` HARİÇ), yeni ekran senaryosu `test/e2e/senaryo-izt4-250.mjs` + `package.json`'a `test:senaryo-izt4-250` (ci.yml / release.yml'ye ANA OTURUM ekler), `docs/erp/C7B-FATURA-TASARIM.md` (yeni §22), `docs/kanit/2026-11-22/izt4-*`. `YAPIM-ASAMASI.json`'a ve kâhinlere DOKUNMA. Başka dosya gerekirse DUR, raporla.

## Sınama (ders 3, 6, 7, 9, 10, 17, 38, 47, 51, 53)
- Her yeni test ESKİ kodda ({taban}) BEKLENEN NEDENLE KIRMIZI, yenide yeşil; iki TZ (UTC + Europe/Istanbul). Kollar: bağlı 300 / 600 / 900 / 1.200 (S255 A örneği), faturanın tamamı kartta, iki kart, bağsız ödeme (değişmemeli), iade / iade iptali / Düzenle sonrası bağlı ödeme, ödemenin silinmesi ve Silinenler'den geri yüklenmesi, yedek → geri yükleme, kilitli dönem, ödeme sözü / Vade Takip / Yaşlandırma / Nakit Akışı / zil.
- Komşular (ders 10): Tek Yükümlülük Kuyruğu ve kapama defterini kullanan BÜTÜN yollar (`test/` taramasıyla) iki TZ'de + şema kapısı + geri yükleme sınamaları — SON değişiklikten SONRA.
- Kâhin ↔ program: `npm run test:kahin-cari` ve `npm run test:kahin-defter` iki TZ; kendi kopyanda `--yapim-asamasi-yaz` (KAHIN_YAPIM_ASAMASI ile not defterine) — depodaki listeye DOKUNMA. (Kâhin bu kuralı ayrı bir bakımda öğreniyor; şimdiki kâhinle fark çıkarsa raporla, kâhine dokunma.)
- HIZ (ders 47, 53 (a) — değişen HER yol): cari kartı GET, kart penceresi GET, Taksitler listesi, Cari listesi, Açık Faturalar, Anlık Durum, Vade Takip, Alacak Yaşlandırma, bağlı ve bağsız tahsilat yazımı. Temiz 100 bin `{SP}/ana-kabul/temiz-100k` (OKU; TAZE kopya her ölçümde). Eski = {taban}. 3 tur dönüşümlü; her ölçüm başında yük < 1,5; olay döngüsü en çok da yazılır; /proc/loadavg rapora. KÖTÜ = ortanca VE en iyi ikisi de > +%10. Ölçüm betiğini (`hiz4.mjs`) ve tablo betiğini not defterinde bırak — ana oturum aynısıyla yeniden ölçer.
- EKRAN (ders 12): senaryo-izt4-250 — fatura kartından öneriden fazla Tahsilat Ekle ve cari tahsilatında Kapatılacak Fatura ile; sonra kart penceresi, Taksitler listesi, cari kartı; ekran görüntüleri `EKRAN_DIR` ile.

## 2.5.1'E BIRAK (kullanıcı 20.11, AYNEN: "yapılan işlerde döngüye girmeyelim detaylara boğulup, programı yada kullanıcıyı etkileyemem hususları 2.5.1 sürümüne bırakalım")
Programın davranışını, sayılarını, hızını ya da kullanıcının gördüğünü DEĞİŞTİRMEYEN husus bu turda KOVALANMAZ; raporun 'SONRAKİ SÜRÜME (2.5.1)' başlığına. Kararın söylemediği para / kapama alt durumu (ders 43): kodla KARAR VERME, 'KULLANICIYA SORULMALI'ya (iki seçenek + öneri; uç durumsa 'Uç durum böyle kalsın (BİLİNEN SINIR)'; 'yaygın programlarda' satırı — okunmadıysa 'okunmadı').

## Rapor (SubagentHandback; Türkçe; kısa cümle, madde ve tablo)
Özet → taban / dal ucu / commit listesi → değişen yollar → kural, kod, bağlı ödeme yollarının listesi, test (eski kodda kırmızı — ileti ve NEDEN; iki TZ sayıları) → v2.4.9 sınıf karşılaştırması → komşular → kâhin iki TZ → hız tablosu (en iyi / ortanca, son ÷ taban, olay döngüsü, yük) → ekran (dosya + ne görüldü) → KULLANICIYA SORULMALI → BAŞ MİMAR KARARI GEREKEN → SONRAKİ SÜRÜME (2.5.1) → DENENMEYEN → BİLİNEN SINIRLAR → ana oturumun yeniden koşacağı komutlar (tam yol, kilitli) → not defteri. Ortam satırı: 'Yük X / 4 çekirdek, bellek boş Y GB, disk boş Z GB'. Disk 5 GB'ın altına düşürülmez.
Commit: yalnız kendi yolların (`git add <yol>`; `-A` / `-u` / `commit -a` YOK — ders 44); satırlar `Co-Authored-By: Claude <noreply@anthropic.com>` + `Claude-Session: https://claude.ai/code/session_01EhegDvmPQ9hx2ibfitm6og` (model adı YAZILMAZ). Başkasının sürecini öldürme, joker desenle silme (ders 36).
"""
open(cikti, "w", encoding="utf-8").write(metin)
print("yazıldı", cikti, len(metin))
