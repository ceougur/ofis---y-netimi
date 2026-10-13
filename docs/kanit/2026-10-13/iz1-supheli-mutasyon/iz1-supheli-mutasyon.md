# İz 1 Şüpheli Alacak — mutasyon tablosu

Kod: /home/user/ofis---y-netimi/.claude/worktrees/agent-add08b66b0506a926 · testler: test/banka-230-supheli.test.mjs, test/banka-230-supheli-bozma.test.mjs · 2026-10-13T19:28:25.531Z

| # | Mutasyon | Dosya | Çıkış | Geçen | Düşen | Sonuç | Yakalayan test (örnek) |
|---|---|---|---|---|---|---|---|
| 1 | M1 işaret: Şüpheli Alacağa Al maddesi ters (B 120 / A 128) | server/lib/doubtful-gl.mjs | 1 | 1 | 27 | YAKALANDI | F — tutar > borç bakiyesi 400; 600 tamam; 500 (600 + 500 > 1.000) 400; 400 tamam → 128 = 1.000, 120 = 0; 0 / eksi / 3 on |
| 2 | M2 tutar sınırı: alacak satırı kalanı aşsa da tamamı 128'den düşer | server/lib/doubtful-gl.mjs | 1 | 26 | 2 | YAKALANDI | D — tahsilat şüpheliyi aşınca: al 4.000 → tahsilat 5.000: A 128 4.000 + A 120 1.000; 128 = 0, 120 = 5.000 (tek madde iki |
| 3 | M3 644 kuralı: karşılık fazlası çözülmez | server/lib/doubtful-gl.mjs | 1 | 25 | 3 | YAKALANDI | adım 3: tahsilat 3.000 nakit (07.10) → B 100 / A 128 (önce şüpheliden); 644 kuralı B 129 / A 644 1.500; 128 = 1.000, 129 |
| 4 | M4 hesap: değersizde karşılık kullanılmaz (hepsi 659) | server/lib/doubtful-gl.mjs | 1 | 26 | 2 | YAKALANDI | adım 4: Değersiz Alacak Yaz 1.000 (08.10) → B 129 / A 128 (karşılıklı; 659'a 0); 128 = 0, 129 = 0, cari 6.000 (satır car |
| 5 | M5 çıkarma tutarı: kalan yerine alınan tutar | server/lib/doubtful-gl.mjs | 1 | 24 | 4 | YAKALANDI | R — audit: doubtful.take / provision / writeoff / release / deleted; S — FORBIDDEN_GL 128/129/644/654, Banka Ayarları fe |
| 6 | M6 tarih: kayıt tarihinden önceki karşılık/değersiz/çıkarma kabul edilir | server/lib/bank/doubtful.mjs | 1 | 27 | 1 | YAKALANDI | G / U / tarih — karşılık > kalan 400; değersiz > kalan 400; kayıt tarihinden önce 400 date-before-record; karşılık 700 + |
| 7 | M7 tutar sınırı: zaten şüphelideki tutar sayılmaz (bakiye − açık yerine bakiye) | server/lib/bank/doubtful.mjs | 1 | 26 | 2 | YAKALANDI | F — tutar > borç bakiyesi 400; 600 tamam; 500 (600 + 500 > 1.000) 400; 400 tamam → 128 = 1.000, 120 = 0; 0 / eksi / 3 on |
| 8 | M8 karşılık sınırı: ayrılmış karşılık sayılmaz | server/lib/bank/doubtful.mjs | 1 | 27 | 1 | YAKALANDI | G / U / tarih — karşılık > kalan 400; değersiz > kalan 400; kayıt tarihinden önce 400 date-before-record; karşılık 700 + |
| 9 | M9 beklenen: 120'den kalan şüpheli düşülmez (kapı) | server/routes/ledger.mjs | 1 | 1 | 27 | YAKALANDI | F — tutar > borç bakiyesi 400; 600 tamam; 500 (600 + 500 > 1.000) 400; 400 tamam → 128 = 1.000, 120 = 0; 0 / eksi / 3 on |
| 10 | M10 kapanış: Şüpheliden Çıkar kapanış tarihini yazmaz | server/lib/bank/doubtful.mjs | 1 | 23 | 5 | YAKALANDI | I / J — kilitli dönem 409 (al / çıkar / karşılık / değersiz / sil), ileri 400 date-future, geçersiz 400 date-invalid, bo |
| 11 | M11 cari bazında: 128 alacak satırı cariyi taşımaz (120 + 128 ≠ kart) | server/lib/doubtful-gl.mjs | 1 | 16 | 12 | YAKALANDI | R — audit: doubtful.take / provision / writeoff / release / deleted; S — FORBIDDEN_GL 128/129/644/654, Banka Ayarları fe |
| 12 | M12 hedef: Değersiz Alacak satırı kendi kaydı yerine en eski kayıttan düşer | server/lib/doubtful-gl.mjs | 1 | 24 | 4 | YAKALANDI | adım 4: Değersiz Alacak Yaz 1.000 (08.10) → B 129 / A 128 (karşılıklı; 659'a 0); 128 = 0, 129 = 0, cari 6.000 (satır car |

Toplam: 12/12 mutasyon yakalandı.