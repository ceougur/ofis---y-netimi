# Dar kontrol — openDatabase bozuk dosya tutamak düzeltmesi (02.11.2026, xhigh, bağımsız ajan)

Fark: server/lib/db.mjs openDatabase PRAGMA try/catch + hatada db.close() + yeniden fırlat; test/db-bozuk-dosya-tutamak-248.test.mjs. Taban 9533b7b9.
Kaynak: CI #944 Windows Node 24 (EPERM rmSync) ve Node 22 (EBUSY unlink) — T-Kbozuk + T-Kbozuk-yabancı.

SONUÇ: YÜKSEK yok · gerileme yok · DÜŞÜK yok · ORTA-1 (ÖNCEDEN VAR OLAN, bu farkın gerilemesi değil; yeniden üretildi).
- Kanca akışı (gerçek program, sahte Meta; betik/kanca.mjs), rmSync'ten önce /proc/self/fd: T-Kbozuk eski 1 → yeni 0; T-Kbozuk-yabancı eski 3 → yeni 0.
- Bozuk 002'den Yedekten Geri Yükle (Linux): geri yüklemeden önce açık tutamak eski 2 → yeni 0; geri yükleme 200.
- Testin dişi: eski kopyada fail 1 "bozuk dosyada 3 açık tutamak kaldı (3 deneme)" (eski-yeni-test.txt); yeni 3/3 (yeni-yeni-test.txt);
  mutasyonlar (db.close kaldır / yeniden fırlatma kaldır) ikisi de yakalandı (mut-*.txt).
- Komşular (yeni kod): whatsapp-t-durum-karar-tablosu-248 94/94, yedek-220-inceleme 9/9, banka-210-ariza 5/5, guvenilirlik-221-ariza 19/19, backup 8/8,
  db-bozuk 3/3 (komsu-*.txt). Ana oturumun komşu koşusu ayrıca 229/229 (docs/kanit/2026-11-02/db-bozuk-komsular.*).
- ORTA-1: createApp'ta openDatabase BAŞARILI olup sonraki adım (runMigrations / mirrorUsers; kilitli dosya ya da derin bozulma) düşerse bağlantı
  kapanmıyor (betik/sizinti-log.mjs: kilit 2, tablo-bozuk 3 tutamak; eski ve yeni aynı). Çöp toplamayla (gc) 0'a iner; yeniden başlatma çözer;
  Windows'ta bu arada Yedekten Geri Yükle "Veri dosyası değiştirilemedi…" 500 verebilir (koddan, DOĞRULANMADI). Kırmızıya dönen mevcut test yok.
  KULLANICI KARARI (02.11.2026 ~03:15 UTC, "a"): BİLİNEN SINIR + 2.4.9.
- DOĞRULANMADI: gerçek Windows'ta T-Kbozuk yeşili (CI'de iki Windows koşusunda görülecek, ders 18); virüs tarayıcısı yeni dosyayı kısa tutarsa rmSync.
- Kapsam dışı, önceden var olan (koddan): kilitte istek olay döngüsünü 10 sn tutar; 001 bozuksa applyStagedRestore user_version NOTADB'de düşer.
