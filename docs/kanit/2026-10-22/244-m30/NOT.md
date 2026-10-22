# 2.4.4 madde 30 — CI dışı arayüz senaryoları (ders 8), son aday e070d42

Dal is/m30-e2e (aday6 = e070d42 üstüne). Linux, Node v22.22.0, Chromium (playwright, `npm ci`). Her koşu `flock …/kos.lock node tools/kanit.mjs kos
244-m30/<ad> -- …`, `HUKUK_LICENSE_URL=http://127.0.0.1:9` (ders 30). Disk: başta 13 GB, sonda 19 GB boş (ders 24).
ci.yml'deki 64 e2e burada KOŞULMADI (ana oturumun aday kapısında).

## Liste nasıl çıkarıldı
`test/e2e/*.mjs` (90 dosya) × package.json betikleri × `.github/workflows/ci.yml` (`npm run …` ve `test/e2e/…` geçişleri). CI'de geçmeyen 26 dosya:
- npm betikli senaryo (13): test:senaryo (senaryo-tablodan-aktar), test:senaryo-rapor, test:senaryo-taslak, test:senaryo-210 … 218, test:senaryo-whatsapp
- betiksiz çalıştırılabilir senaryo (1): ui-ux-217.mjs
- zorla üretme betiği, ders 20 (8): senaryo-222-yaris, senaryo-225-yaris, e2e-not-yaris, form-izolasyon-b4-yaris, banka-210-planli-yaris,
  banka-210-yaris, banka-210-analiz-yaris, banka-210-fetch-yaris
- yardımcı (4): esc-kapat.mjs, esc-kapat-ozet.mjs, tarayici-kesme.mjs (senaryoların içe aktardığı modüller), cpu-yavaslat.mjs (--import ön yüklemesi)
- test:mutabakat / test:guvenilirlik: Uzun Doğrulama'da (koşulmadı, görev gereği).

## Senaryolar (iki tur; 2. tur ESC_KAPAT_GUNLUK ile, ders 34)
| Senaryo | 1. tur | 2. tur | escClose sorusu (2. tur) |
|---|---|---|---|
| test:senaryo (tablodan aktar) | 47/47 çıkış 0 — kayıt yazılamadı (*) | 47/47 çıkış 0 | 0 |
| test:senaryo-rapor | 82/82 çıkış 0 | 82/82 çıkış 0 | 0 |
| test:senaryo-taslak | 30/30 çıkış 0 | 30/30 çıkış 0 | 0 |
| test:senaryo-210 | 57/57 çıkış 0 | 57/57 çıkış 0 | 0 |
| test:senaryo-211 | 57/57 çıkış 0 | 57/57 çıkış 0 | 0 |
| test:senaryo-212 | 24/24 çıkış 0 | 24/24 çıkış 0 | 2 ADAY-MEŞRU (Yeni Taksit Kartı: ad yazılmış / cari seçilmiş) |
| test:senaryo-213 | 64/64 çıkış 0 | 64/64 çıkış 0 | 1 ADAY-MEŞRU (Yeni Cari: ad yazılmış) |
| test:senaryo-214 | 48/48 çıkış 0 | 48/48 çıkış 0 | 1 ADAY-MEŞRU (Yeni Cari: canlı yenileme sırasında "deneme" yazılmış) |
| test:senaryo-215 | 73/73 çıkış 0 | 73/73 çıkış 0 | 0 |
| test:senaryo-216 | 54/54 çıkış 0 | 54/54 çıkış 0 | 0 |
| test:senaryo-217 | 65/65 çıkış 0 | 65/65 çıkış 0 | 1 ADAY-MEŞRU (fatura taslağı: kalem seçilmiş, kaydedilmemiş) |
| test:senaryo-218 | 50/50 çıkış 0 | 50/50 çıkış 0 | 0 |
| test:senaryo-whatsapp | 45/45 çıkış 0 | 45/45 çıkış 0 | 0 |
| ui-ux-217 (59 ekran) | 407/407 çıkış 0 | 407/407 çıkış 0 | 1 ADAY-MEŞRU (Banka Masrafı: tutar yazılmış) |

(*) Araç alt klasörü kendisi açmıyor; ilk koşuda docs/kanit/2026-10-22/244-m30 yoktu → ENOENT, kayıt yok. Ham çıktı `senaryo-ilk-kayitsiz.log`; klasör açıldı,
2. turda kayıtlı yeniden koşuldu. Her soru elle senaryo satırından doğrulandı: hepsi kullanıcının dokunduğu, kaydedilmemiş formda (meşru); ŞÜPHELİ 0.
Günlükler `esc-gunluk/*.jsonl`, özet `esc-gunluk/OZET.txt`. ui-ux-217 bulgular tablosu `ui-ux-217-bulgular.md` (407 ✅, ❌/⚠ 0).

## Zorla üretme betikleri — düzeltme tarafı kipleri (gerileme denetimi; deneme sayısı varsayılandan az)
| Betik (kip) | Sonuç | Ön koşul |
|---|---|---|
| senaryo-222-yaris MODE=forced WAIT=new TRIALS=5 | 5/5 çıkış 0 | her denemede arka plan isteği arama gecikmesinde, ağ kesilince 1 istek düştü |
| senaryo-225-yaris MODE=forced FIX=new TRIALS=3 | 3/3 çıkış 0 | 3/3 |
| e2e-not-yaris MODE=forced TRIALS=4 | 4/4 çıkış 0 | 4/4 (betik ön koşul eksikse çıkış 1 verir) |
| form-izolasyon-b4-yaris MODE=yeni,kurtarma-yeni TRIALS=3 | **1/2 çıkış 1** (yeni #2 KIRMIZI) | 3/3 — aşağıda |
| banka-210-planli-yaris (varsayılan) | 19/19 çıkış 0 | K1/K2 her denemede oluştu |
| banka-210-yaris --kip gecikme --deneme 3 | 3/3 çıkış 0 | gecikme 1500 ms |
| banka-210-analiz-yaris --kip yeni --gecikme 1500 --deneme 3 | 3/3 çıkış 0 | işaret yenilenmeden sonra duruyordu (3/3) |
| banka-210-fetch-yaris --kip yeni --gecikme 3000 --deneme 3 | 3/3 çıkış 0 | geçişte yarıda kalan istek 3/3 |

### form-izolasyon-b4-yaris "yeni" kırmızısı (ders 6, 20, 38)
- Yeniden üretildi: `yaris-b4-yeni-tani` (MODE=yeni TRIALS=10, tanı satırı eklendi): 10 denemede tek kırmızı #2; o denemede kurtarma anahtarı hatırlatması
  bildirimden 401 ms sonra denetlendi ve EKRANDA ("hatırlatma ekranda EVET"); hatırlatmasız 9 deneme yeşil.
- Neden: betiğin "yeni" kipi "senaryo B4'ün 22.10 sırası (aynı adımlar)" der, ama senaryonun bölüm B başındaki kurtarma hatırlatması "gösterildi" kaydını
  (senaryo-form-izolasyon-243.mjs `localStorage.setItem("hof.recovery.nudge.…")`) koymuyordu; açılıştan ~6 sn sonra çıkan hatırlatma 2. denemeye denk geliyor.
  Betiğin kendi kök neden notu (kurtarma-sira = kayıtsız sıra, beklenen kırmızı) ile aynı. SINIF (ii) testin kendi yarışı; ürün ve senaryo-form-izolasyon-243 doğru.
- Düzeltme (yalnız betik): yeni / yeni-gec kipleri her denemede senaryodaki kaydı koyar. `yaris-b4-duzeltme` (MODE=yeni,yeni-gec,kurtarma-sira TRIALS=10):
  yeni 10/10 yeşil (ön koşul 10/10), yeni-gec 10/10 yeşil (ön koşul 10/10), kurtarma-sira 10/10 beklenen kırmızı (kayıtsız sıranın dişi) → 3/3 çıkış 0.
- `yaris-b4-yeni` ve `yaris-b4-yeni-tani` kayıtları kırmızı kanıt olarak bırakıldı (eski betik / tanı).
- Kaynak taramaları (betik değişti): platform-tasinabilirlik + lisans-servisi-izolasyonu 11/11 çıkış 0 (`kaynak-taramalari`).

## DENENMEYEN
- ci.yml'deki 64 e2e (ana oturumun aday kapısında).
- test:mutabakat, test:guvenilirlik (Uzun Doğrulama, GitHub).
- Zorla üretme betiklerinin ESKİ/kırmızı kipleri (eski-test, gec-fare, kurtarma-eski, analiz/fetch "eski", 222 WAIT=old, 225 FIX=old, e2e-not natural) —
  2.4.3'te kapanmış yarışların kırmızı kanıtı; son aday için bilgi vermez. form-izolasyon-b4 altina/uzaklas/yeni-test kipleri koşulmadı.
- Zorla betikler varsayılandan az denemeyle (222: 5/20, e2e-not: 4/6, b4: 3–10/10, banka-210-yaris 3/10, analiz 3/5) koşuldu.
- banka-210-yaris "cpu" kipi ve CPU yavaşlatmalı (HOF_CPU_YAVASLAT / CPU>1) koşular.
- Windows'ta (yalnız Linux; bu senaryolar CI'de değil, Windows'ta hiç koşmuyor).

## BİLİNEN SINIR
- Senaryolar tek makinede, başka ajanların koşularıyla paylaşılan kilitle sırayla koşuldu; yük altında ölçüm değil.
