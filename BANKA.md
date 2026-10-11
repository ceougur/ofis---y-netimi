# BANKA — kalan işler, sürümler, ertelenen düzeltmeler

Kullanıcı "banka sürümüne devam edelim" deyince BU dosyadan başlanır (11.10.2026 kararı). Plan: `docs/BANKA-MODULU-PLAN.md`
(her koşulda plana uyulur; plan susarsa en yaygın/modern seçenek). Ayrıntılı geçmiş: `docs/2.1.0-KANIT.md`, `docs/2.1.0-DEGISIKLIKLER.md`.

## Yayımlanan
- 2.1.0 Temel Banka Sürümü — 11.10.2026, `v2.1.0` = 7c6405f. Site kılavuzu güncel (ceougur/destekofis main f811f08).
  Kullanıcı canlıda kendisi deneyecek (12.10.2026); müşteri geri dönüşü gelirse önce o düzeltilir (2.1.1).

## Sürüm sırası (plan)
1. **2.1.1** — müşteri geri dönüşleri + aşağıdaki "2.1.1'e ertelenenler".
2. **2.2.0** — POS (tahsilat 108, komisyon + KDV/BSMV, valör, blokeli/teminatlı POS, POS iadesi ve komisyon iadesi).
3. **2.3.0** — banka ekstresi ve mutabakat (eşleştirme) + ölçek işi (tarih indeksi, 1M satır, 30 kullanıcı).
4. **3.0.0** — REAL → INTEGER kuruş (ayrı karar, Aşama 17).

## 2.1.1'e ertelenenler (kullanıcı kararlarıyla)
- Döviz/kur ve dönem sonu kur farkı değerlemesi, TCMB kuru önerisi (Aşama 13).
- Bankaya Tahsile Ver (çek/senet).
- Taksitte avans / fazla ödeme kuralları (K8: plan-paid / plan-overpay).
- Faturanın banka hesaplı iade/iptal ayrıntısı (§4.6), toplu kesimde hesap seçimi, Fatura Ayarları → Banka Hesapları, gider türleri 770/653.
- Kalan §8.10 banka raporları.
- Kasa açılış/devir yolu (K6: devreden nakit bugün 649'a yazılıyor; doğrusu 500).
- Rapor Merkezi Excel çıktısında şirket adı/kodu yok (PDF'te var) — kullanıcı kararı 11.10.2026.
- Kapsam ölçümü (satır/dal/arayüz) — yayından sonra yapılacak (kullanıcı kararı).
- 30 eşzamanlı kullanıcı + 1.000.000 para satırı ölçek testi (planlı ölçek testi; hatırlatma trig_0144BJLRwsZFizXTTYrJVszA Cuma 16.10.2026 09:00 TR).

## Bilinen sınırlar (2.1.0'da kaldı)
- Ölçek: 100.000 satırda 10 kişide Cari arama p95 1,1 sn, olay döngüsü 1,3 sn; 20 kişide rapor ~7,5 sn (kullanıcı: "yeterli").
- Hesap başı 2^53 kuruş üstünde banka raporları 500 (H6). KDV dahil iskontoda kâhinle 1 kuruş fark (program doğru).
- Banka listesi yenilemede en çok 200 satırı korur; Fatura/Stok/Çek pencerelerinde "Daha Fazla" yarışı için ayrı e2e yok.
- Bir bilgisayarda DestekOfis açıksa sunucu boşta sayılmaz; kurulum mesai dışında ya da açılışta.
- Uyarı bulgusu (3): aynı kullanıcının öbür penceresi yeni sayfa açılınca "sayfa silindi" diyor (düşük, açık).
- Tam liste: `docs/2.1.0-KANIT.md` → BİLİNEN SINIRLAR.

## Teslim notları
- Kurulum .exe 35 MiB → 30 MiB gönderim sınırını aşıyor: parçalı ver (BIRLESTIR.cmd) ya da yayın iş akışının Windows'ta sınanmış exe'sini kullan.
- Akış: testler → paket → PR → kullanıcı "birleştir" → birleştir → kullanıcı Publish → bayt bayt + güncelleyici → site kılavuz PR'ı.
- Elle kabul listesi verilmez (kullanıcı kendisi dener). Sürüm notu kısa tutulur.
