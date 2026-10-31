# 2.4.8 son aday T5 — eski veri ve göç (v2.4.7 → 2.4.8; zincir v2.4.4 → v2.4.7 → 2.4.8; 2.4.7 yedeği 2.4.8'de)

Aday: çalışma ağacı /home/user/wt-t5-248, commit 49395f77 (göç v40: wa_batches, wa_jobs, accounts.wa_opt_out; şema 39 → 40). Ürün kodu DEĞİŞMEDİ.
Eski kod: git etiketleri v2.4.7 (151b7119, `git fetch --tags origin` ile alındı) ve v2.4.4 (5187561b) — `test/guvenilirlik/surumler.mjs` ile `git archive` kopyasında,
TMPDIR = not defterinde benzersiz `t5-248-20261030T2301/tmp` (ders 23, 25). Veri o sürümün GERÇEK koduyla kendi API'sinden (`test/guvenilirlik/m30-uretici.mjs`);
sahte EDM, sahte saat (üretimin son günü 30.10.2026 17:00; ders 13/22), `HUKUK_LICENSE_URL=http://127.0.0.1:9` (ders 30), sahte Meta Graph yalnız 127.0.0.1.
Araç: 2.4.7 tatbikatının aracı (`docs/kanit/2026-10-29/goc-247/araclar/goc247.mjs.txt`) uyarlandı → `araclar/goc248.mjs.txt` (eski v2.4.7, şema 40, `waveri` ve `wa` adımları,
sayaç artışı denetimi). Her adım `tools/kanit.mjs kos 248-t5-<ad>` (kayıtlar `docs/kanit/2026-10-30/248-t5-*.{json,log}`, tam çıktı `ham/`).

## Nasıl bozulur? (koşudan önce)
1. v40 eski tabloya/satıra dokunur → bakiye, mizan, Kasa, banka, fatura, taksit, çek, stok kayar; eski tablo düşer; e-Belge sayacı / mobil tablolar değişir.
2. wa_opt_out varsayılanı 0 değil → cariler sessizce "İstemiyor" olur; göç toplu gönderim/iş satırı yaratır.
3. wa.me yolunun hedef kuralı (alici.mjs'e taşındı) eski veride farklı sonuç verir; eski wa.me gönderim geçmişi (message_sends) kart geçmişinde kaybolur.
4. v2.4.7'de eşlenmiş telefon göçten sonra düşer; telefonun gördüğü masaüstünden ya da göçten öncekinden farklı.
5. API önizlemesi plan kararlarına uymaz: sabit hat / yurt dışı elenir (K1 A'ya aykırı), aynı telefonlu iki cariden biri düşer (K2 A'ya aykırı), telefonsuz/eksik hane gönderilir.
6. 2.4.7 yedeği 2.4.8'de geri yüklenince göç koşmaz / sayılar farklı; adayda yedek → çalış → geri yükle sayıları yedek anına döndürmez.
7. Geri dönüş: göçten sonra v2.4.7 açınca bozulur ya da şemayı geri alır. 8. Zincir: adım adım ≠ doğrudan.

## Veri
- **v2.4.7** (büyük, tohum 7; `uret-v247-buyuk` 6.156/6.156, 6.155 API isteği, 2 × 409 beklenen ret, EDM gönderim 491, iptal 12, ihlal 0, 157 sn): 30.09.2025 → 30.10.2026 (13 ay),
  2 şirket. 001: 3.223 cari, 1.211 fatura, 397 çek/senet, 247 taksit kartı, 40 stok; 002: 935 cari, 618 fatura, 180 çek/senet, 88 kart, 40 stok; tablo 12.020 satır; 10 yedek.
  `vade-v247`: 113 PUT (Vade / Beklenen) 200, 384 kilitli dönem reddi (409 period-locked, beklenen, sayıldı).
  `waveri-v247-2` (v2.4.7 API, 30/30): her şirkette 10 WhatsApp carisi — telefonsuz, aynı telefon A ("0532 111 22 33") + B ("+90 532 111 22 33"), sabit hat (0212…), yurt dışı (+49…,
  0044…), çok numaralı hücre, eksik hane, ülke kodsuz cep, pasif; açılış bakiyeli; 3 wa.me gönderim izi (message_sends). İLK KOŞU `waveri-v247` KIRMIZI = ARAÇ: açılış tarihi
  kilitli döneme düştü, v2.4.7 doğru olarak 409 period-locked verdi (kayıt yazılmadı); tarih son ayın 1'ine alındı.
- **v2.4.4** (büyük, tohum 11; `uret-v244-zincir` 6.072/6.072, 4 × 409 beklenen ret): 001 3.207 cari, 002 928 cari; 13 ay; zincir kaynağı.

## Sonuç
- `goc-v247-aday` 16/16: iki şirket şema 39 → 40, bütünlük ok, şirket başına `…-pre-migration-v40.sqlite`; yeni tablolar YALNIZ wa_batches, wa_jobs (boş); eski tablolarda satır
  farkı 0; mobil tablolar ve e-Belge sayacı izi önce = sonra (001 edoc_usage 354, 002 137); accounts.wa_opt_out INTEGER NOT NULL DEFAULT 0, 3.223 + 935 caride işaretli 0.
- Önce / sonra (`cikti/once-sonra-tablo.md`): 15 olgu × 2 şirket HEPSİ aynı (cari sayısı, Σ bakiye, mizan Σ borç = Σ alacak, Mutabakat sapma 0, Kasa, banka, fatura
  sayısı/tutar/açık, Gönderilecekler, çek portföyü, taksit kalanı, stok, KDV mahsup, Silinenler, dönem kilidi). Tek FARK: admin etkin yetki 57 → 58 = `whatsapp.send`
  (plan §189: "varsayılan yalnız yönetici; göçle mevcut rollere VERİLMEZ" — öbür 3 kullanıcı aynı).
- `fark-v247-aday` (m30-fark, profil 244-245): 92 olgu — EŞİT 81, BELGELİ 4, "BULGU" 7. Yedisi elle sınıflandı (2.4.7 tatbikatındaki gibi; sınıflayıcıda 2.4.8 profili yok):
  admin `whatsapp.send` (plan §189); "K6 kuralı tutmuyor" ×2 önce = sonra BİREBİR (Vade/Beklenen'i v2.4.7 yazdı); şema 39 → 40 ×2; yeni tablolar wa_batches + wa_jobs ×2
  (satır farkı 0). SONUÇ: BULGU 0.
- `wa-v247-aday-2` 46/46: wa.me "Hedefleri Hazırla" aynı veride v2.4.7 ↔ 2.4.8 (Son 3 Ay, Bu Ay, Mesaj) BİREBİR (yeni optOut alanı hariç, hepsi false); "Tüm Hareketler"
  aralık sonu boş → bugün (plan §7a 22), metni değişen cari 0 (veride ileri tarihli hareket yok); e-Belge sayacı v2.4.7 ↔ 2.4.8 aynı; wa.me geçmişi 6 kayıt kart geçmişinde aynı;
  v2.4.7'de eşlenen telefon göçten sonra eşli, oturum 200, Kasa = masaüstü ve = göçten önce; Elle Bağla + onay + Ekstre önizlemesi 200: 10 özel carinin hepsi PLANDAN
  beklendiği gibi (telefonsuz / eksik hane / pasif elenir; sabit hat, +49, 0044, ülke kodsuz, çok numaralı (ilki) gönderilir; aynı telefonlu iki cari ikisi de gönderilir; 250
  sınırı farklı numarayla sayılır: 3.207 gönderilebilir, 3.206 farklı numara → yarına 2.956); bütün cariler wa.me kuralıyla tutarlı (uyuşmayan 0); "İstemiyor" / "Daha Önce
  Gönderildi" / "Zaten Kuyrukta" 0; önizleme kayıt açmadı (wa_batches 0, wa_jobs 0). İLK KOŞU `wa-v247-aday` 44/46 KIRMIZI = ARAÇ: telefonun Kasa'sı tam masaüstü
  nesnesiyle karşılaştırıldı; 2.4.7 kararı "mobil Kasa yalnız bakiye/toplamlar" (server/lib/mobile.mjs transform `entries`'i atar) — v2.4.7'de de aynı; denetim hareket
  listesi hariç karşılaştıracak şekilde düzeltildi. Aynı araç hatası `yeni-aday` 10/12 → `yeni-aday-2` 12/12.
- `yeni-aday-2` 12/12: göçten sonra yeni e-Arşiv + 3 bekleyen → Tümünü Gönder 4 = sayaç 2026-10 test 56 → 60, öbür ay/ortam 100 → 100, 002 sayacı 73 → 73; mobil eşleme,
  uzak giriş, iki şirket, Kasa / cari kartı = masaüstü; 2. ve 3. cihaz 200, 4. 409; cihazlar yalnız 001'in dosyasında (3), 002'de 0.
- `yedek-v247-aday` 14/14: v2.4.7'nin aldığı son yedekler (001, 002) v2.4.7'de ve 2.4.8'de Geri Yükle → 2.4.8'de şema 40, bütünlük ok, iki sürümün gösterdiği AYNI (0 bölüm);
  eşli telefon 001'in eski yedeğinden sonra da eşli; adayda yedek → çalış → geri yükle → 0 bölüm fark → yeniden çalışma 200, Mutabakat sapma 0.
- `donus-aday-v247-aday` 6/6: göçmüş veriyi v2.4.7 açar, gösterdiği = göçten önce; şema 40 kalır; sonra 2.4.8 = göç ölçüsü.
- `zincir-v244-v247-aday` 6/6: v2.4.4 (şema 32) → v2.4.7 kendi koduyla (39) → 2.4.8 (40) = doğrudan v2.4.4 → 2.4.8 (iki şirkette fark yok; satır farkı yalnız
  audit_events/sessions). Her halkada sayılar (`cikti/zincir-tablo.md`): 15 olgu × 2 şirket ÜÇ sürümde aynı; yalnız admin yetkisi 55 → 57 (maliyet.view/manage, 2.4.6) → 58
  (whatsapp.send). Fark v2.4.7 → 2.4.8: EŞİT 81, BELGELİ 6, "BULGU" 5 (admin whatsapp.send + şema/yeni tablo ×4) → BULGU 0.

## DENENEN / DENENMEYEN / BİLİNEN SINIRLAR
- DENENEN: ders 2 (kanit kos; KIRMIZI kayıtlar silinmedi), 3 (her yanıt okundu, 409'lar sayıldı, veri tabanı sayıları okundu), 4, 5 (beklenen = eski sürümün kendi gösterdiği;
  WhatsApp elemesi plan §7a K1/K2 ve §189 metninden), 6 (üç kırmızı yeniden üretildi, eski sürümle karşılaştırıldı, kök neden araç), 10 (wa.me yolu — alici.mjs'i paylaşan komşu —
  v2.4.7 ile birebir; mobil Kasa; e-Belge sayacı), 13/22 (sabit sahte saat), 17 (eski sürümlerin gerçek verisi, yedek, geri dönüş, zincir), 23/25 (ayrı kopya, benzersiz klasör),
  24 (df başta 9,8 GB, en düşük 7,8 GB; veri kopyaları bitince silindi), 30, 36 (pkill/joker silme yok).
- DENENMEYEN: göç sırasında kesinti / disk dolu / kilitli dosya; arayüzden (Playwright) göçmüş veri gezintisi ve WhatsApp ekranı; gerçek toplu gönderim (createBatch + işçi) göçmüş
  veride (yalnız önizleme); "Tüm Hareketler"de ileri tarihli hareketli cari (veride yok; §7a 22 metin farkı sınanmadı); "WhatsApp Mesajı İstemiyor" işaretli eski cari (v2.4.7'de
  alan yok — tanım gereği 0); 2.4.8'in L1 lisans hoşgörüsü eski veride (test lisansı etkin); v2.4.5/v2.4.6 verisinden doğrudan 2.4.8; 3+ şirket; Windows.
- BİLİNEN SINIR: m30-fark sınıflayıcısında 2.4.8 profili yok — 7 (zincirde 5) satır elle sınıflandı (yukarıda, veriyle). Eleme nedeni metinleri ("Telefon yok" vb.) programın
  etiketi; elenir/gönderilir kararı plandan. Yedek dosya adları gerçek saatle (veri sahte saatle).
