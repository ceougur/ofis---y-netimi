# D3 TUR 2 raporu — devir saf hesabının eksik testleri + DOĞRULANMADI maddeleri + gerçek veri kapsamı (2.5.1)

Ajan: D3 TUR 2 KOD ajanı (high), 27.11.2026. Taban `t251-d3-tur1` (e1a6f263). Yeni özellik YOK; D3 hâlâ HİÇBİR ŞEY YAZMAZ (plan + ön izleme).
Taslak — adım adım doldurulur.

## 0. NASIL BOZULUR (koddan ÖNCE yazıldı; testler buradan)

Her satır "ne ters giderse devirli ≠ devirsiz olur ya da plan yanlış sayı / yanlış madde verir". Sağdaki numara tur 1'in 42 maddelik tablosundaki karşılığı (d3-rapor.md §0).
Test adları planlanan adlardır (son hâli §4).

### (a) K'den SONRA yazılmış, K'den ÖNCEKİ belgeye bağlı kayıt — bağ yönlendirmesi (tur 1: 1, 23, 28)
| # | Bozulma | Beklenen (plan) | Test |
|---|---|---|---|
| a1 | Ocak tahsilatı "Kapatılacak Fatura" ile Aralık'ta AÇIK faturaya bağlı | `baglar[]` satırı `tur: acik-kalem`, `yeniHedef = devir-<yıl>-kalem-inv:<fatura>`; açık kalem tutarı K'deki kalan (Ocak tahsilatı DÜŞMEZ) | devir-d3-bag |
| a2 | Ocak tahsilatı K'de KAPANMIŞ (≤K ödenmiş) faturaya bağlı | `tur: arsiv-basvurusu` + `arsiv { yil, no, tarih }`; açık kalem YOK | devir-d3-bag |
| a3 | Kısmi bağ: ≤K bağlı kısmi tahsilat + K sonrası bağlı kalan tahsilat | açık kalem = fatura − ≤K bağlı tutar; K sonrası bağ açık kaleme | devir-d3-bag |
| a4 | K sonrası Mahsup Et: `invoice_offsets.invoice_id` ≤K faturada (karşısı ≤K ya da >K) | bağ listesinde; karşı taraf ≤K ise o da (counter_id) | devir-d3-bag |
| a5 | K sonrası Mahsup Et: `invoice_id` >K fatura, KARŞI fatura (`counter_id`) ≤K | bağ listesinde (karşı tarafın yönlendirmesi) — okuyucu yalnız `invoice_id`'ye bakarsa KAÇAR | devir-d3-bag |
| a6 | K sonrası iade faturası (`invoices.original_id`) ≤K faturanın iadesi | bağ listesinde (iade → asıl fatura bağı, TYK karar (2)) — okuyucu `original_id`'ye bakmazsa KAÇAR | devir-d3-bag |
| a7 | K sonrası alınan çek "Kapatılacak Fatura" ile ≤K faturaya bağlı (`cheque_events.invoice_id`) | bağ listesinde | devir-d3-bag |
| a8 | K sonrası banka havalesi faturaya bağlı (`account_entries.invoice_id`, source 'bank') | bağ listesinde | devir-d3-bag |
| a9 | ≤K tarihli satır ≤K faturaya bağlı (bağın İKİ tarafı da K'den önce) | bağ listesinde YOK (arşivde kalır) | devir-d3-bag |
| a10 | Bağ K sonrası satırdan K sonrası faturaya (iki taraf da >K) | bağ listesinde YOK | devir-d3-bag |
| a11 | Bağlı K sonrası tahsilatın tutarı açık kalemden büyük (fazlası serbest) | bağ yine açık kaleme; devirsiz bakiye = devirli satırlar + K sonrası | devir-d3-bag (bakiye) |

### (b) Evrakın K'deki durumu (tur 1: 4, 28)
Koddaki durumlar (`lib/cheques.mjs` STATUSES): portfolio, endorsed, collected, bounced, pending, paid; bankada tahsilde (`cheque_collections`: pending / collected / withdrawn / returned).
| # | Bozulma | Beklenen | Test |
|---|---|---|---|
| b1 | Alınan çek K'de portföyde | `evraklar[]` durum portfolio, 101.01; modül farkı yok | devir-d3-evrak |
| b2 | Alınan senet K'de portföyde | portfolio, 121.01 | devir-d3-evrak |
| b3 | Çek ≤K bankaya tahsile verilmiş, K'de tahsilde | bank, 101.02 | devir-d3-evrak |
| b4 | Çek ≤K tahsile, K'den SONRA tahsil edilmiş | K'de bank (sonraki olay sayılmaz) | devir-d3-evrak |
| b5 | Çek ≤K tahsile, ≤K tahsil edilmiş | listede YOK (kapanmış) | devir-d3-evrak |
| b6 | Çek ≤K ciro edilmiş | endorsed, hesap yok (iz) | devir-d3-evrak |
| b7 | Çek ≤K ciro, K'den SONRA karşılıksız | K'de endorsed | devir-d3-evrak |
| b8 | Çek ≤K karşılıksız (carisine borç) | bounced, hesap yok; carinin açık kalemi `karsiliksiz` | devir-d3-evrak |
| b9 | Çek K'de portföyde, K'den SONRA tahsil / karşılıksız / ciro | K'de portfolio (sonraki durum TAŞINMAZ) | devir-d3-evrak |
| b10 | Verilen çek K'de ödenmemiş | pending, 103; verilen senet 321 | devir-d3-evrak |
| b11 | Verilen çek ≤K ödenmiş | listede YOK | devir-d3-evrak |
| b12 | Verilen çek K'den SONRA ödenmiş | K'de pending | devir-d3-evrak |
| b13 | Vadesi K'den sonra olan portföy çeki | vade aynen; durum portfolio | devir-d3-evrak |
| b14 | K'den SONRA alınmış çek | listede YOK | devir-d3-evrak |
| b15 | Silinmiş evrak / Geri Al'ınmış olay | silinmiş listede YOK; geri alınan olay sayılmaz | devir-d3-evrak |
| b16 | Tahsile verilip ≤K bankadan geri alınmış | K'de portfolio (101.01) | devir-d3-evrak |
| b17 | "Teminata verilmiş" | programda böyle durum YOK (STATUSES) — sınanamaz, raporda | — |

### (c) Alt hesaplı öbür hesaplar (tur 1: 5, 35)
| # | Bozulma | Beklenen | Test |
|---|---|---|---|
| c1 | Banka hesabı 102.NN havale / EFT tahsilat ve ödemeleri | `banka[]` 102.NN = K bakiyesi; modül farkı yok | devir-d3-banka |
| c2 | İki banka arası virman | iki alt hesap ayrı, Σ değişmez | devir-d3-banka |
| c3 | POS tahsilatı K'de, valörü K'den sonra | 108.NN bekleyen = brüt; K'den sonra valörlenen 102'ye geçmemiş | devir-d3-banka |
| c4 | Kredi kartıyla ödeme (309.NN) + karttan ödeme (card_payment) | 309.NN = K borcu (alacak bakiyeli) | devir-d3-banka |
| c5 | Kredi kullanımı (300.NN) | 300.NN = K borcu | devir-d3-banka |
| c6 | K'den SONRA olan banka hareketleri | K bakiyesine girmez | devir-d3-banka |
| c7 | Her alt hesap: arşiv kapanış = yeni yıl açılış | `modul-farki` yok, `banka[]` tutarları = `kapanisBakiyeleri` | devir-d3-banka |

### (d) Şablonlar ve e-Belge olguları — GERÇEK veri tabanından (tur 1: 14, 19, 22)
| # | Bozulma | Beklenen | Test |
|---|---|---|---|
| d1 | Aktif tekrarlayan fatura (≤K şablon) | `sablonlar[]` satırı + UYARIR; durdurulmuş tekrar listede YOK; >K şablon YOK | devir-d3-olgu |
| d2 | ≤K e-Belge gönderim bekliyor / Listeden Sil'inmiş / sonucu belirsiz | ön denetim DURDURUR (adet okuyucunun SQL'inden); >K olan sayılmaz | devir-d3-olgu |
| d3 | Taslak fatura ≤K | ön denetimde (adet) | devir-d3-olgu |
| d4 | Numara sayaçları | planda sayaç alanı VAR MI — yoksa raporda (D4a'nın ihtiyacı) | devir-d3-olgu (tarama) |

### (e) Şüpheli cari, K'den sonra faturaya bağlı tahsilat (tur 1 DOĞRULANMADI)
| # | Bozulma | Beklenen | Test |
|---|---|---|---|
| e1 | Fatura ≤K, Şüpheliye Al ≤K, faturaya bağlı tahsilat K'den SONRA | 128 = K'deki şüpheli kalan; `supheli-farki` YOK (yanlış DURDURMA da hata) | devir-d3-supheli |
| e2 | Aynısı, ≤K kısmi bağlı tahsilat + K sonrası bağlı tahsilat | 128 = K'deki kalan (yalnız ≤K tahsilat düşer) | devir-d3-supheli |
| e3 | Karşılık ≤K, Değersiz K'den SONRA | 129 = K'deki karşılık | devir-d3-supheli |
| e4 | BM-1: şüpheli carinin "Alacak Toplamı" (bugünkü sayılar SABİT) | ELLE yazılı sayılar | devir-d3-supheli |

### (f) K'den SONRA "Borçta Kalsın" ile kapanan kart (tur 1 BM-5)
| # | Bozulma | Beklenen | Test |
|---|---|---|---|
| f1 | Kart K'de açık, Ocak'ta Borçta Kalsın | plan K'de `acik`; taksit vadeleri kartın ASIL vadeleri (kapanış günü DEĞİL); açık kalem yok | devir-d3-supheli (kart) |
| f2 | Aynı kart devirsiz eşdeğer: gecikmiş(t) devirli = devirsiz | — | devir-d3-supheli (kart) |
| f3 | Kart ≤K Borçta Kalsın (kontrol) | `kapali`, kalan açık kalem `kart-kalani` | devir-d3-supheli (kart) |

### (g) Dönem Kilidi (tur 1 DOĞRULANMADI)
| # | Bozulma | Beklenen | Test |
|---|---|---|---|
| g1 | Kilit yok / kilit K'den önce / kilit K'yi kapsıyor (= K, > K) | plan (veriSurumu hariç) AYNI; değişmezler tutar | devir-d3-olgu |
| g2 | Ön izleme kilit geçmişine dokunur | `ledger.lockedUntil` ve denetim izindeki kilit satırları önce = sonra | devir-d3-olgu |

### (h) K günü ve K+1 günü aynı tutarlı iki kayıt (tur 1: 9)
| # | Bozulma | Beklenen | Test |
|---|---|---|---|
| h1 | 31.12 ve 01.01'de aynı cariye aynı tutarlı tahsilat / Borç Yaz | 31.12 K bakiyesinde, 01.01 yeni yılda; tablo sayımında biri ≤K biri >K | devir-d3-bag |

### BM-6 (planın ödeme satırını yazmaya yetecek alanları)
| # | Bozulma | Beklenen | Test |
|---|---|---|---|
| m1 | Ödeme rolündeki açık kalemde rol / asıl tarih / tutar / karşı kalem eksik | her ödeme kaleminde `rol: odeme`, `vade` (asıl tarih), `tutarMinor`, `belge.satirId` (karşı kalem = kaynak satır), `yon` | devir-d3-supheli (BM-6) |

### Gerçek veri (ders 17)
Tur 1 üreteci yalnız fatura / tahsilat / ödeme / stok üretiyordu → v2.5.0 GERÇEK koduyla kart, evrak, şüpheli, KDV mahsubu, vergi ödemesi, banka, iade, sil + geri yükle, pasif cari, aynı adlı iki cari
eklenir; bozulma "devirsiz eşdeğer ≠ 0" ya da sorun / değişmez kırmızısı.
