# 2.5.1 Değersiz Alacak sınırı — TUR 6 raporu (taslak; adım adım doldurulur)

Görev metni: `docs/devir/2.5.1-DEVAM/m2t6-istem.txt`. Taban: `t251-m2t6-taban` (3980c57d). Kapsam DAR: dar kontrol DK-M2T5 ORTA-1 (Alış Faturası Düzenle'de
peşin ödeme düşürülür / kaldırılırsa Değersiz'li cari sessizce eksiye iniyordu) — BAŞ MİMAR KARARI 28.11 11:55 UTC (1).

## 0. NASIL BOZULUR (koddan ÖNCE yazıldı)

Kural (SK-64 = A, tur 5 tabanı): Değersiz Alacak satırı olan caride işlem bakiyeyi DÜŞÜRÜR ve sonuç EKSİ ise 409; aksi her durumda kabul. Ölçü Düzenle'den
önceki ve sonraki defter bakiyesi (cari kartının satırlarıyla aynı kaynak). Taban T = 423,55 (görev metnindeki dar kontrol tabanı).

Elle beklenen sayılar (kurallardan; programın kodundan değil):

| # | Durum | Hesap | Beklenen |
|---|-------|-------|----------|
| 1 | T + alış 500 + peşin 500 (01.10) + bağsız tahsilat 1.000 (05.10) | 423,55 − 500 + 500 − 1.000 | bakiye −576,45 (kurulum; yeni tahsilat kabul — BM-M2T4-3) |
| 2 | (1)'de tutar 500 aynı, peşin 500 → 100 | −576,45 − 400 = −976,45 (düşer, eksi) | 409 'Alış faturası düzenlenemez', −576,45 kalır; fatura / cari satırları / Silinenler bayt bayt aynı |
| 3 | (1)'de tutar aynı, peşin kaldırıldı | −576,45 − 500 = −1.076,45 | 409, −576,45 kalır, atomik |
| 4 | (1)'de tutar aynı, peşin 500 → 600 (artar) | −576,45 + 100 = −476,45 (yükselir; eksi kalsa da) | kabul (bakiye düşmedi) |
| 5 | (1)'de tutar 500 → 100, peşin kaldırıldı (alacak −400, ödeme −500) | −576,45 + 400 − 500 = −676,45 | 409 (tur 5'te 'tutar düştü' diye denetim kurulmuyordu) |
| 6 | (1)'de tutar 500 → 100, peşin 500 → 100 (net +0) | −576,45 + 400 − 400 = −576,45 | kabul (bakiye aynı) |
| 7 | T + alış 500 + peşin 500 (bakiye 423,55; avans YOK): peşin 500 → 100 | 423,55 − 400 = 23,55 (düşer, eksi değil) | kabul |
| 8 | (7)'nin tabanında peşin 500 → 76,45 | 423,55 − 423,55 = 0 (tam 0) | kabul |
| 9 | (7)'nin tabanında peşin 500 → 76,44 | −0,01 | 409 |
| 10 | B4: T + alış 100 (323,55) → Düzenle 1.100 + peşin 1.000 (net 0) | 323,55 | kabul |
| 11 | T + alış 100 → Düzenle 100 → 423,55 (tutar artışı tam 0) | 0 | kabul (tur 5) |
| 12 | T + alış 100 → 1.000 | −576,45 | 409 (tur 5; ileti sözü artık 'alış faturasının düzenlenmesi') |
| 13 | Tutar ve peşin aynı, yalnız açıklama / tarih değişir | bakiye aynı | kabul |
| 14 | Değersiz satırı HİÇ olmayan cari (Şüpheli kayıt var, Değersiz yok), (1)'in benzeri, peşin kaldırıldı | eksiye iner | kabul (denetim kurulmaz) |
| 15 | Değersiz satırı SİLİNMİŞ cari, peşin kaldırıldı | eksiye iner | kabul |
| 16 | Cari DEĞİŞİR (alış Değersiz'li A'dan Değersiz'siz B'ye; peşinle birlikte) | A: −alacak −ödeme → net +tutar − peşin ≥ 0 | tur 5 davranışı AYNEN (A denetlenmez; kabul) |
| 17 | Alış faturası İPTALİ (peşinli / peşinsiz) | iptal net etkisi ≥ 0 | kabul (iptal yolu ayrı denetimde — A3) |
| 18 | Dönem kilidi faturanın tarihini kapsıyor, peşin kaldırılıyor | — | kilit iletisi önce (Değersiz iletisi değil) |
| 19 | Stoğa Mal Alışı (goods_purchase — aynı tür 'purchase', aynı Düzenle yolu): peşin kaldırıldı, eksiye iner | — | 409 (aynı kural) |
| 20 | İleti yolu: Değersiz satırı silinir → aynı Düzenle kabul | — | 200 |
| 21 | Her şey TZ=UTC ve TZ=Europe/Istanbul | — | aynı sayılar |

Aynı Düzenle yolundan geçen diğer türler (ölçülecek, kodlanmayacaksa nedeni yazılacak):
- Satıştan İade (alacak yönlü): tur 2'den beri KOŞULSUZ denetimli ('return') — değişmez.
- Satış / SMM / Alıştan İade (borç yönlü): peşin TAHSİLAT artışı bakiyeyi düşürür ama BM-M2T4-3 ("tahsilat artışı … KABUL") kapsam dışı; tutar düşüşü tur 3'ten beri denetimli — değişmez.
- 'Gider / SMM alış' ayrı tür değil: Hizmet ve Gider Alışı (expense_purchase) ve Stoğa Mal Alışı (goods_purchase) ikisi de tür 'purchase' — tek kural ikisini kapsar.

Bozulma yolları: denetim yazımdan ÖNCE kurulmazsa 'önce' bakiyesi yanlış olur; denetim istisna atınca işlem geri alınmazsa ret atomik değildir (fatura, cari satırları,
fin olayları, Değişiklik Geçmişi, Silinenler sayıları okunacak); cari değişimi koşulu tersine çevrilirse eski cari yanlış denetlenir; Değersiz'siz caride ek okuma
(ders 47: yalnız tek dizinli 'Değersiz satırı var mı' sorgusu kabul).
