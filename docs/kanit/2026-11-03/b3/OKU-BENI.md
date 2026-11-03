# 2.4.9 B3 — dondurulmuş WhatsApp PDF'i ayrı tabloda (wa_job_pdfs, göç v45) — kanıt

Tasarım: docs/2.4.9-tasarim/B3-B4.md §B3-3 (A) + "ANA OTURUM ONAYI" (03.11.2026). Kod ajanı: B3 (worktree `agent-a972c155e62a73ec3`, dal tabanı c0149534).
Ortam: linux x64, 4 çekirdek, Node v22.22.0. Paylaşılan makine: ölçümler sırasında başka ajanların koşuları sürüyordu (yük ~4,6); süre ölçümleri `flock
/tmp/destekofis-olcum.lock` altında (B2 ajanı da aynı kilidi kullandı → sırayla). Dış istek yok (ders 30): HUKUK_LICENSE_URL=http://127.0.0.1:9, Meta yerel sahte.

## Commit'ler
| commit | içerik |
|---|---|
| 5ec72dd1 | TEST: test/whatsapp-b3-buyume-249 (T1), whatsapp-b3-pdf-249 (T2, T2b, T5×2, T6, T7, T8, T9), whatsapp-b3-goc-249 (fikstür, T3, T3 yarıda kalmış göç, T4 geri yükleme, T4 Ayır); fikstür test/fixtures/whatsapp-pdf-v248 (v2.4.8 GERÇEK koduyla API'den, üretici uret.mjs.txt; secret.key alınmadı); beklentisi değişen whatsapp-t2-6-248, whatsapp-q2 |
| f71e1e8b | DÜZELTME: migrations.mjs v45, whatsapp/queue.mjs prepare() + bakım, app.mjs MOVEMENT_TABLES (tek satır) |
| 91d2a200 | ÖLÇÜM BETİKLERİ (npm test dışı): t9-248/wa-gecmis-uret.mjs `--olc`, t9-248/b3-dosya-olcum.mjs, t9-248/b3-eski-surume-yedek.mjs |

"Eski kod" = `git archive e3f74093` ayrı kopya (sunucu/istemci v2.4.8 = 6ff09c10 ile aynı; `git diff 6ff09c10 e3f74093 -- . ':!docs'` yalnız ci.yml + kanit aracı).
Eski kopya .git'siz → o koşuların kaydında commit "undefined"; komut kopyanın yolunu taşır (b3a972-eski-e3f74093). Yeni testler kopyaya `git archive 5ec72dd1 -- <test yolları>` ile bindirildi.

## Koşular (kanit.mjs kos)
| kayıt | ne | hüküm |
|---|---|---|
| eski-e3f74093-yeni-testler | 5 dosya (yeni 3 + değişen 2) ESKİ kodda | BAŞARISIZ beklenen: 11/23, 12 kırmızı (aşağıda nedenleri) |
| yeni-f71e1e8b-yeni-testler | aynı 5 dosya yeni kodda (TZ=UTC) | GEÇTİ 23/23 |
| yeni-testler-tz-istanbul | aynısı TZ=Europe/Istanbul | GEÇTİ 23/23 |
| mutasyon-M1 … M7 | f71e1e8b'nin ayrı kopyasına tek hata (betikler/mutasyon.mjs.txt) + yeni 3 dosya | 7/7 BAŞARISIZ (öldü) |
| komsu-whatsapp-tumu | `test/whatsapp-*.test.mjs` (76 dosya) | GEÇTİ 446/446 (f71e1e8b) |
| komsu-yedek-goc-sifirlama | 43 dosya: yedek-*, backup, sirket-ayir-221, sirketler-217, migrations, goc-*, banka-210-goc*, guvenilirlik-221-*, sıfırlama kullananlar, platform-tasinabilirlik, lisans-servisi-izolasyonu, yazim-duzeni, banka-210-post-statik, maliyet-bagsizlik | GEÇTİ 319/319 (fe7b5f84 = 91d2a200 ile aynı ağaç, bir betik eksik) |
| eski-surume-v45-yedek | v45 dosyası eski kodun gerçek inspectBackup'ına → 409 | GEÇTİ 3/3 |
| olcum-* | B3-6 ölçümü (aşağıda) | GEÇTİ (betik denetimleri) |

### Eski kodda kırmızılar — nedenler (ders 38)
T1 "wa_jobs sayfa içi boş %67.5 > %10 (2.17 MB, iş başına 1140 bayt)"; T3 "göç v45: wa_job_pdfs tablosu yok (şema sürümü 44)"; T3 yarıda kalmış göç "44 !== 45";
T4 geri yükleme "geri yüklenen dosyada wa_job_pdfs yok (şema 44)"; T4 Ayır "ayrılan kopyada wa_job_pdfs yok"; T5 ×2 "wa_job_pdfs tablosu yok"; T6 "kesinti noktası
(wa_job_pdfs yazımı) çalışmadı" (yeni yol); T7 "bakımın PDF silmesi (DELETE FROM wa_job_pdfs) çalışmadı" (yeni yol); T8 "pdf_blob göç dışında anılıyor:
queue.mjs:1321, 1327, 1348, 1654, 1655"; T9 "wa_job_pdfs tablosu yok ya da boş"; whatsapp-t2-6 (beklenti değişti) "no such table: wa_job_pdfs".
Eski kodda YEŞİL (eşdeğerlik — davranış aynı): T2 (131056 → Bağlantı Bekleniyor → Duraklat → 31 gün → Devam Et: iki yükleme bayt bayt aynı, bakiye 1.250,00),
T2b (yaşam döngüsü sayıları: Bekliyor tutulur, Başarısız/kabul/İptal silinir — eski kodda pdf_blob ile aynı), fikstür sağlaması, whatsapp-q2 (6/6).

### Mutasyonlar (her biri ayrı kopya; yakalayan testler)
| | mutasyon | kırmızı |
|---|---|---|
| M1 | bakımın DELETE'i kaldır | T1 "PDF sayfaları yeniden kullanılmıyor (tur 2–10: ~1.665)", T2b, T3, T4, T7, T9 |
| M2 | prepare() store.tx kaldır | T6 "işin satırı da geri alındı" (prepared_at dolu kaldı) |
| M3 | göçte INSERT kaldır | T3, T3 yarıda, T4, T4 Ayır |
| M4 | bakımda OPEN_JOB yerine `state <> 'accepted'` | T2b (Başarısız işin PDF'i kaldı), T4 (Durduruldu işin PDF'i kaldı) |
| M5 | MOVEMENT_TABLES'tan wa_job_pdfs çıkar | T5 ×2 "sıfırlama PDF'i de sildi" 1 ≠ 0 |
| M6 | prepare() dondurulmuş PDF'i okumuyor | T2 (bayt farklı), T3 (sha farklı), T9 |
| M7 | göçte pdf_blob boşaltma kaldır | T3, T3 yarıda, T4, T8 |

## B3-6 ölçümü — önce (eski kod) / sonra (yeni kod), AYNI kaynak (t9-4c8e1d/taban-2910 taze kopyası), AYNI betik
Komut: `betikler/olcum-kos.sh.txt` adımları; üretim `test/t9-248/wa-gecmis-uret.mjs --toplam 100 --bas 0 --adet 10 --olc` (10 toplu gönderim × 2.000 kişi = 20.023 iş;
Başarısızları Yeniden Dene ve Yine de Gönder zinciri dahil); dosya ölçümü `test/t9-248/b3-dosya-olcum.mjs`. Ham: sonuc-olcum-*.json + olcum-*.log.
Taban: 185,1 MB (VACUUM INTO 176,0 MB — olcum-taban-vacuum-into.txt).

| ölçü (10 gönderimden sonra) | önce (eski) | sonra (yeni) |
|---|---|---|
| şirket dosyası | 274,7 MB (+89,6) | 267,6 MB (+82,5) |
| wa_jobs toplam / sayfa içi BOŞ / yük | 31,3 / **18,0** (%57) / 13,0 MB | 16,2 / **3,0** (%18,5) / 13,0 MB |
| iş başına wa_jobs boşluğu | ~940 bayt | ~157 bayt |
| bütün dosya boş (sayfa içi) / yük | 34,8 / 180,3 MB | 19,8 / 180,3 MB |
| boş sayfa listesi (yeniden kullanılır) | 51,3 MB | 59,2 MB |
| VACUUM INTO (yedek) | 197,5 MB, 0,98 sn | 197,5 MB, 0,80 sn |
| tepe açık PDF (bakımdan önce, en çok) | 1.733 satırda | 1.539 satır, wa_job_pdfs 49,2 MB |
| bakım sonrası PDF tutan iş | 0 | 0 (wa_job_pdfs 0 satır) |
| iş başına süre p50 / p95 (10 gönderim aralığı) | 29–32 / 44–62 ms | 29–36 / 45–70 ms (yük gürültüsü; aşağıdaki dönüşümlü ölçüme bakın) |
| gönderim sırasında olay döngüsü en çok | 141–1.064 ms | 135–717 ms |
| bakım turu (gönderim sonu) | 12–167 ms | 19–116 ms |
| yeniden açılış (b3-dosya-olcum) / olay döngüsü en çok | 5.830 / 5.859 ms | 5.703 / 5.771 ms |
| bakım ×5 (yeniden açılmış dosya) | 144–200 ms | 86–112 ms |

Dönüşümlü süre (olcum-ab-sure-donusumlu; eski/yeni sırayla 5 çift, her biri 3 tur × 200 ekstre, ayrı süreç): p50 eski 13,1–16,7 / yeni 12,5–13,3 ms; p95 eski 18,7–38,9 /
yeni 17,6–21,4 ms; ortalama eski 13,9–19,6 / yeni 13,3–14,5 ms; olay döngüsü en çok eski 30–60 / yeni 32–69 ms; bakım 4–6 ms ikisinde (yeni bir kez 27). Gerileme görülmedi.

Göç v45 (t9-4c8e1d/gecmis-40 taze kopyası: 434,2 MB, v44, 80.126 iş satırı, 1 açık iş PDF'i 33.320 bayt; olcum-goc-*): göç öncesi tam yedek 1.164 ms (259,8 MB),
v45 156 ms (toplam 1.320 ms); göçten sonra wa_job_pdfs 1 satır (33.320 bayt), pdf_blob 0, dosya 434,2 MB (DEĞİŞMEDİ — otomatik VACUUM YOK, BAŞ MİMAR KARARI B3-4).
Açılış (göç dahil) eski 6.194 ms (göç yok) / yeni 7.259 ms; bakım ×5 eski 177–217 / yeni 97–166 ms.

Tasarımın önceden yazılı kabul ölçütleri (§B3-6) ile karşılaştırma:
- "dosya artışı ≤ VACUUM INTO artışı (197,5 − 176,0 = 21,5) + tepe açık PDF (66) + %10 = 96,3 MB": yeni 82,5 ✓ — ANCAK eski 89,6 da sağlıyor (10 gönderimde ölçüt ayırt etmiyor;
  ayırt eden wa_jobs boşluğu: 18,0 → 3,0 MB).
- "wa_jobs boş ≤ %10": T1 testinde (durum bildirimi yok) %7,8 ✓; GERÇEK akışta (teslim/okundu bildirimleri satırı büyütür) **%18,5 ✗** — kalan boşluk satır büyümesi
  (iş başına ~157 bayt, PDF'ten değil; eski ~940). Ana oturuma bulgu olarak bildirildi.
- "iş başına süre ve olay döngüsü gerilemesi yok (±%10)": dönüşümlü ölçümde ✓.
40 gönderim (BULGU 3 ile birebir) ÖLÇÜLMEDİ (ölçüm kilidi B2 ile paylaşılıyordu; ~55 dk kilit tutardı).

## Betikler (betikler/*.txt — not defterinden kopya)
mutasyon.mjs / mutasyon-kos.sh (M1–M7), olcum-kos.sh (B3-6 adımları), ab-sure.mjs / ab-kos.sh (dönüşümlü süre), v0-olcum.mjs (taban VACUUM INTO), t1-deneme.mjs (T1 ön denemesi;
eşik seçimi öncesi eski/yeni ham sayılar: eski 100×3 → wa_jobs boş %72, yeni 200×10 → %7,8).
