# 2.5.1 — Değersiz Alacak sınırı TUR 4 raporu

Taban: `t251-m2t4-taban` (74ba2a84). Görev metni: docs/devir/2.5.1-DEVAM/m2t4-istem.txt. Dal: `worktree-agent-a75255d57a32bede8`. PUSH yok.

## DEĞİŞEN GÖZLENEBİLİR DAVRANIŞ (önce → sonra)
1. **Değersiz Alacak Yaz formunun önerdiği tutar artık kabul ediliyor (ORTA-2).** Cari kartı → Şüpheli Alacak → Değersiz Alacak Yaz. Dar kontrolün vakası (Fatura 1.500 + Borç 3.400; S1 500 @01.10;
   bağlı 1.327,19 + 122,85 + 168,48 @01.10; S1'e Değersiz 500 @15.10 (sil → 14.09 bağlı 501,63 → Silinenler'den geri yükle — ya da doğrudan); S2 1.500 @19.09 Şüpheliye Al; bakiye 2.279,85):
   ÖNCE liste ve form 1.500 önerir, Kaydet → 409 "… 500,00 TL Değersiz Alacak satırı şüpheli kaydın kalanını aşar … en çok 400,00 TL"; SONRA aynı öneri (1.500 @19.09 / 25.09) → KABUL,
   bakiye 779,85, Mutabakat Testi tamam; 1.500,01 → 400 "en çok tutarı (1.500,00 TL) aşıyor". Öneri DEĞİŞMEDİ (form / liste sayıları aynı) — değişen, kapının yanlış reddi.
2. **Borç Yaz satırının silinmesi / düşürülmesi (S-DKM2T3-1 = A).** Taban T (Fatura 2.900 + Borç 3.400 · 17.09 bağlı 2.876,45 · Şüpheliye Al 3.000 · Değersiz 3.000; bakiye 423,55):
   - cari kartı → Hareketler → Borç 3.400 satırının × → "Hareketi Sil" → Sil: ÖNCE kabul, bakiye −2.976,45; SONRA bildirim "Borç hareketi silinemez: bu caride 17.09.2026 tarihli 3.000,00 TL
     Değersiz Alacak satırı var; silmeden sonra cari 2.976,45 TL alacaklı (eksi bakiye) olurdu. …", satır yerinde, bakiye 423,55.
   - ✎ Düzelt → 100: ÖNCE kabul (−2.876,45); SONRA 409 "Borç hareketi düzeltilemez: … 2.876,45 TL alacaklı … bu düzeltmeyle o kayda en çok 123,55 TL Değersiz Alacak yazılabilirdi …".
   - Borç'u Alacak'a çevirme (ÖNCE −6.376,45) ve başka cariye taşıma (ÖNCE eski cari −2.976,45): SONRA 409, satır değişmez.
   - Bakiyeyi düşürmeyen ya da eksiye götürmeyen düzeltme DEĞİŞMEDİ: 3.500 (523,55), tarih (423,55), 3.000 (23,55) kabul. Değersiz satırı olmayan caride hiçbir şey değişmedi.
3. **Taksit kartı (aynı sınıf — ölçüldü, aynı sayılar).** Borç Yaz yerine 3.400'lük taksit kartı: kartı Sil → ÖNCE kabul (−2.976,45), SONRA 409 "Taksit kartı silinemez: …"; kartın tutarını
   100'e düşürme → ÖNCE kabul (−2.876,45), SONRA 409 "Taksit kartı düzenlenemez: …"; tutar artışı (3.500 → 523,55) kabul.
4. **'Ne yapmalı' kullanıcıyı boşuna sildirmiyor (DÜŞÜK-1).** Değersiz satırı silinse de kapının S155 kuralı işlemi yine reddedecekse ileti ÖNCE "önce Değersiz Alacak satırını silin, sonra …"
   diyordu (izlenince 409 "Bu kayıt carinin borcunu açık şüpheli tutarın altına düşürür …"); SONRA: "Ne yapmalı: Değersiz Alacak satırını silmek yetmez — düzenlemeden sonra carinin borcu
   (623,55 TL) şüpheli kaydın kalanını (2.900,00 TL) karşılamaz. Önce Değersiz Alacak satırını silin (cari kartı → Şüpheli Alacak → kaydın Değersiz satırındaki × düğmesi), sonra şüpheli alacak
   kaydını silin (cari kartı → Şüpheli Alacak → kaydın satırındaki × düğmesi) ya da Şüpheliden Çıkar ile çıkarın, sonra faturayı düzenleyin; alacak hâlâ şüpheliyse kalan borç için yeniden
   Şüpheliye Alın. Hiçbir şey kaydedilmedi." (fatura Düzenle 2.900 → 100; Borç Yaz silme: borç 23,55 / şüpheli 123,55; taksit kartı silme aynı). İzlenen yol testte KABUL ettirildi
   (Düzenle → 623,55; Borç silme → 23,55, hem "kaydı sil" hem "Şüpheliden Çıkar" yoluyla). S155'e takılmayan retlerde ileti AYNEN (iptal "en çok 123,55" → Değersiz silinince iptal kabul, 523,55).
   Yanıt gövdesine `recordFirst: true` eklendi (yalnız bu durumda).
5. **Hız (ORTA-1).** Mutabakat Testi ve her yazımın kapısı Silinenler'deki fatura sayısıyla artık büyümüyor (HIZ tablosu). Değişmezin bulduğu ihlaller BİREBİR aynı.

## DEĞİŞEN DOSYALAR
- `server/lib/bank/doubtful.mjs` — (ORTA-1) değişmez (i)'nin Silinenler taraması carinin en eski Değersiz satırının yazım anından sonraki silmelere daraldı, `idx_trash_open` dizinli iki kol
  (`WRITE_OFF_TRASH_SQL`); bakiye kolunun (ii) Silinenler sorgusu da dizinli üç kol (`WRITE_OFF_ACTIVITY_TRASH_SQL`; koşul aynı). (ORTA-2) değişmez (i)'de W'den SONRA yazılmış Değersiz
  satırları W'nin dünyasının kuyruğundan da çıkarılır (`linkedShares(...).without`; yalnız W'den önceki güne düşen sonraki satır varsa — yoksa ek iş yok). (S-DKM2T3-1) `writeOffBalanceGuard`'a dört
  eylem (entry-delete / entry-edit / plan-delete / plan-edit). (DÜŞÜK-1) `s155AfterWriteOffsRemoved` + iki yollu 'ne yapmalı'. YALNIZ TEST: `WRITE_OFF_TEST.fullTrash`, `.leakLater` (hakem).
- `server/routes/accounts.mjs` — cari hareketi PUT / DELETE: `kind = 'debt'` satırda işlemin İÇİNDE `writeOffBalanceGuard` (öncesi / sonrası bakiye).
- `server/routes/plans.mjs` — taksit kartı DELETE ve PUT (tutar / cari / Kayıt Tarihi değişince): aynı denetim.
- `test/supheli-degersiz-m2t4-251.test.mjs` (YENİ, 15 `it` + tohum başına 1), `test/supheli-degersiz-m2t3-251.test.mjs` (DEĞİŞEN beklenti: Düzenle 2.900 → 100'ün 'ne yapmalı'sı),
  `test/e2e/senaryo-degersiz-iptal-m2t2-251.mjs` (adım 4 beklentisi + YENİ adım 6 Borç Yaz silme reddi), kanıt, bu rapor.
- DOKUNULMADI: tek borç sırası (lib/obligation-queue.mjs, obligation-input), defter rotası (routes/ledger.mjs), şüpheli defter türetmesi (lib/doubtful-gl.mjs), göçler, tools, package.json,
  .github, kılavuz, ci.yml (diff `t251-m2t4-taban..HEAD -- server/` yalnız üç dosya).

## 0. NASIL BOZULUR (koddan ÖNCE yazıldı — commit d5e5644f; uygulananlar: 1a–f, 2a–d, 3a–d, 3f, 3g, 3h (ölçüm), 4, 5, 6; 3e DENENMEDİ)
Eksenler ve bu turda denenecekler:
1. ORTA-1 (Silinenler taraması — değişmez (i) "sonradan değişmiş" sayımı):
   (a) Silinenler'de 0 / 5.000 / 20.000 fatura × Değersiz satırlı 1 / 10 cari — süre Silinenler'le büyümemeli;
   (b) silme Değersiz yazımından ÖNCE / SONRA — daraltma (en eski Değersiz satırının yazımından sonraki silmeler) sonucu değiştirmemeli (önceki silme hiçbir satırın dünyasını değiştirmez mi — kanıt);
   (c) geri yüklenmiş (restored_at dolu) ve taslak silinmiş fatura — bugünkü sayım AYNEN (gevşetme sonraki sürüme);
   (d) carinin kimliği başka carinin yükünde geçerse (instr) — bugünkü gibi;
   (e) Değersiz satırının yazım anı boş (eski veri) — daraltma bütün satırlara döner;
   (f) eşdeğerlik: bugünkü (eski) sayım ↔ yeni sayım rastgele tohumlarda birebir (iki TZ; Silinenler'de fatura olan tohumlar dahil).
2. ORTA-2 (önerilen tutar kapıda reddediliyor):
   (a) dar kontrolün örneği AYNEN (S1 500'e Değersiz 500 → sil → bağlı tahsilat → geri yükle; S2 1.500 Şüpheliye Al) — öneri kabul edilmeli;
   (b) formun önerisi × aynı gün / farklı gün bağlı tahsilat × ikinci şüpheli kayıt (daha eski tarihli ikinci kayıt — sonraki Değersiz satırının kuyruk payı değişir);
   (c) listenin 'yazılabilir' alanı ve formun ucu aynı öneriyi vermeli; öneriden 1 kuruş fazlası reddedilmeli (sınır gerçek mi);
   (d) rastgele tohumlarda 'önerinin yazımı kabul edilir' değişmezi (öneri > 0 ise yazım 200).
3. S-DKM2T3-1 = A (Borç Yaz silme / düzeltme):
   (a) taban T + Değersiz 3.000 → Borç Yaz 3.400 SİL → RET, 423,55 kalır; tutar 100'e düşür → RET;
   (b) tutar ARTIŞI, yalnız tarih / açıklama değişikliği → kabul (bakiyeyi düşürmeyen işlem reddedilmez);
   (c) eksiye götürmeyen silme / azaltma → kabul; Değersiz satırı olmayan caride → bugünkü gibi;
   (d) Borç Yaz'ın Alacak Yaz'a çevrilmesi ve başka cariye taşınması (eski cari eksiye düşer) → RET;
   (e) silinen Borç Yaz'ın Silinenler'den geri yüklenmesi (bakiyeyi YÜKSELTİR) → kabul;
   (f) Değersiz satırı silinince aynı silme kabul (ileti 'ne yapmalı'yı izlemek işi kabul ettirir);
   (g) taksit kartı silme ve kart tutarının düşürülmesi — ölç, aynı sınıfsa aynı kural; ayrışırsa KULLANICIYA SORULMALI;
   (h) tahsilatın tutar artışı / Alacak Yaz (yeni) — kararın kapsamı dışı (avans meşru): DOKUNULMAZ, ölçülüp rapora yazılır.
4. DÜŞÜK-1 ('ne yapmalı' kullanıcıyı boşuna sildiriyor): sınırı 0 iletili ret (Düzenle 2.900 → 100; cari değişikliği; taksitli fatura iptali) — Değersiz satırı silinse de S155 reddediyorsa ileti
   başka yolu söylemeli; ileti izlenince işlem GERÇEKTEN kabul edilmeli (testte adım adım). 'Ne yapmalı'nın S155'i geçirdiği durumda ileti AYNEN.
5. DÜŞÜK-2 (M8 sınıfı): aynı gün, kayıttan SONRA yazılmış bağlı tahsilat + S155 — kalıcı test, M8 mutantı yakalanmalı.
6. Genel: iki saat dilimi (UTC, Europe/Istanbul); kilitli dönem iletisi önce; yedek geri yükleme / iki şirket (komşu testleri); v2.5.0 gerçek verisi (komşu testlerinin gerçek veri dosyaları);
   tek borç sırası / defter rotası / şüpheli defter türetmesi DOKUNULMAZ (diff ile denetlenir).

## KÖK NEDEN — ORTA-2 (bulundu, yeniden üretildi)
Değişmez (i) her Değersiz satırını W "yazıldığı andaki dünyada" denetler; tanımı "W'den sonra yazılmış Değersiz satırları yok". Alacak satırları süzgecinde bu doğruydu, ama bağlı tahsilatın kayda
düşen payını veren kuyruk kesiti (`linkedShares`) carinin BÜTÜN satırlarını okuyordu. S2'nin sonradan yazılan Değersiz 1.500 @19.09 satırı, W'den (S1, 15.10) önceki bir güne düştüğü için
01.10 bağlı tahsilatlarının kesitini değiştirdi: W'nin dünyasında S1'in odası 500 → 400 (ajan ölçümü: sonraki satır kuyruktayken 40.000, değilken 50.000 kuruş; kalıcı test
"değişmez (i)'nin dünyası" `leakLater` ile oda 40.000, satır 50.000). Gerçekte S1'in Değersiz'i yazıldığı anda (S2 yoktu) de bugün de (gate'in tam ayırması "outside" 0) sığar → S270 "hiçbir
sırada" bozulmaz → 1.500 KARARLARDAN çıkan doğru öneridir (1.400'ün dayanağı yok — karışık dünyanın sayısı). Dar kontrolün kuşkusu ("formun denemesi değişmezin dünyasını görmüyor") yarı doğru:
form doğru dünyayı görüyordu, değişmezin dünyası sızdırıyordu. Düzeltmeden sonra yeni Değersiz satırı (her zaman en son yazılan) hiçbir eski satırın (i) dünyasına girmez → yazım eski satırları
kıramaz; yeni satırın kendi (i) dünyası formun F(S, D)'siyle aynıdır → "öneri her zaman kabul" yapısal olarak sağlanır (rastgele taramada 0 ihlal).

## TARAMA (ders 10 — komşular; `git grep`)
| Tarama | Dosya | Sonuç (UTC / Europe/Istanbul) |
|---|---|---|
| tur 3'ün 123 dosyası (docs/kanit/2026-11-28/m2t3-arac/komsu-liste.txt) | 123 | birleşik koşuda |
| cari hareketi PUT / DELETE: `git grep -l -E "(\.del|\.put|DELETE|PUT|request\(\"(PUT|DELETE)).*entries/\$\{" -- 'test/*.test.mjs'` | 65 | birleşik koşuda |
| taksit kartı PUT / DELETE: `git grep -l -E "(\.del|\.put|DELETE|PUT).*plans/\$\{" -- 'test/*.test.mjs'` | 61 | birleşik koşuda |
| BİRLEŞİK (yeni / değişen iki dosya hariç) | **184** | **2220 / 2220** · **2220 / 2220** (m2t4-komsular-*) |
| yeni + değişen + tur 2–3 Değersiz dosyaları (M2T4_TOHUM 1–40) | 5 | 101 / 101 · 101 / 101 (m2t4-son-yeni-*) |
| ekran: senaryo-degersiz-iptal-m2t2-251 (adım 6 yeni) | 1 | 33 / 33 · 33 / 33 |
| ekran: senaryo-degersiz-siniri-m2-251 | 1 | 24 / 24 · 24 / 24 |
| `npm run test:kahin-cari` (kodu okunmadı) | — | 25.957 / 25.957 (7 bilinen sınır dahil; 0 fark) |
| `npm run test:kahin-defter` | — | 187 / 187 (0 fark) |
| eski (taban, ayrı kopya) ↔ yeni: dar kontrolün a-esdeger üreticisi + fatura silme / taslak silme / geri yükleme, 40 tohum × 5 cari × 20 adım | — | aşağıda (B) |
Liste: docs/kanit/2026-11-28/m2t4-arac/komsu-liste.txt (üretici komsu-liste.py, taramalar komsu-cari.txt / komsu-kart.txt). Komşu koşusunun başında yük: 2,38 (UTC) / 4,13 (İst.).

## YENİ / DEĞİŞEN TESTLER — taban (t251-m2t4-taban; /dev/shm/m2t4-a752/eski, yalnız yeni + değişen test dosyası) kırmızısı NEDENİYLE / yeni yeşili
| Test | Taban (UTC ve İstanbul aynı) | Yeni (UTC / İst.) |
|---|---|---|
| ORTA-2 vakası (geri yüklemeli) öneri 1.500 kabul | KIRMIZI: "önerilen tutar reddedildi: 409 … kalanını aşar … en çok 400,00" | yeşil / yeşil |
| ORTA-2 vakası (doğrudan) | KIRMIZI: aynı neden | yeşil / yeşil |
| (i) dünyası: sonraki Değersiz kuyruğa girmez (leakLater → 40000 oda) | KIRMIZI: "S2 Değersiz 1.500: 409 … kalanını aşar" | yeşil / yeşil |
| Borç Yaz silme → 409 + S155'li ileti + izlenen yol 23,55 | KIRMIZI: 200 ≠ 409 (silindi) | yeşil / yeşil |
| Borç Yaz → 100 → 409 + yol (123,55; form 123,55) | KIRMIZI: 200 ≠ 409 | yeşil / yeşil |
| Borç → Alacak / başka cariye → 409 | KIRMIZI: 200 ≠ 409 | yeşil / yeşil |
| taksit kartı sil / tutar 100 → 409 | KIRMIZI: 200 ≠ 409 | yeşil / yeşil |
| DÜŞÜK-1 Düzenle 100: ileti + yol (623,55) | KIRMIZI: ileti "Değersiz Alacak satırını silmek yetmez" içermiyor | yeşil / yeşil |
| (değişen, tur 3 dosyası) Düzenle 2.900 → 100 | KIRMIZI: aynı neden | yeşil / yeşil |
| ORTA-1 sorgu planı (sabitler) | KIRMIZI: "dizinli Silinenler sorguları yok (tur 4 öncesi kod — tam tarama)" | yeşil / yeşil |
| ORTA-1 koşan sorguların planı (casus) + tam taramayla aynı | KIRMIZI: "SELECT MAX(deleted_at) … instr(payload_json, ?) > 0 → SEARCH trash" (dizinsiz) | yeşil / yeşil |
| rastgele tohum 37 / 3 | KIRMIZI: "Değersiz satırı olan caride Borç Yaz silmesi cariyi eksiye götürdü (3209.2 → -190.8 / 1900 → -1500)" | yeşil / yeşil |
| koruma: iptal yolu (123,55 → 523,55), Şüpheliden Çıkar yolu, kabul edilen düzeltmeler, M8 iki vaka, iki Değersiz arası silme, tohum 11 | yeşil (davranış değişmedi; dişleri mutantlarda) | yeşil / yeşil |
| e2e senaryo-degersiz-iptal-m2t2-251 | 27 / 33 — KIRMIZI 6: adım 4 iki ileti denetimi; adım 6 "Hareket silindi.", borç satırı silindi, bakiye −2.976,45 | 33 / 33 · 33 / 33 |
Sayılar: taban 17 / 30 iki TZ (13 kırmızı — hepsi yukarıdaki beklenen nedenler; m2t4-son-taban-*), yeni 101 / 101 iki TZ (m2t4-son-yeni-*). Ekran adım 6'da ürünün "Hareketi Sil" onayı
BEKLENEN soru olarak denetlenip Sil denir, başka soru çıkmadığı denetlenir (ders 34). Ekran görüntüsü okundu (m2t4-cikti/ekran-m2t4-6-borc-silme-reddi.png): ileti dört parça, okunaklı.

## KABUL
- A ✓ — yeni testler tabanda beklenen nedenle kırmızı, yenide yeşil, iki TZ (yukarıda).
- B ✓ — Silinenler taraması eşdeğerliği: (1) kalıcı rastgele test her adımda dizinli ↔ tam tarama (WRITE_OFF_TEST.fullTrash) BİREBİR: 40 tohum × 5 cari × 20 adım iki TZ, 3.071 karşılaştırma,
  193 fatura silme (taslak dahil), 4 geri yükleme, 0 fark; (2) GERÇEK eski kodla: a-esdeger4 (dar kontrolün üreticisi + fatura silme / taslak silme / geri yükleme), yeni kodda (i)'nin tur 3 hâli
  (SIZINTI=1) ile — 40 tohum × 5 cari × 20 adım × iki TZ: 4.000 adım, 3.452 liste, 25.483 form ucu, 191 Değersiz yazımı, 22 fatura silme, 143 taslak silme, 5 geri yükleme → **fark 0 / 0**.
  Tam yeni kodla (SIZINTI=0) aynı üretici: fark 0 / 0 (bu tohumlarda ORTA-2 sınıfı oluşmadı). Dar kontrolün özgün üreticisiyle (EXT=0): **tek durum farkı t37 c2 s17** — eski 409 "…kalanını aşar
  (en çok 400,00)", yeni 200 (ORTA-2 düzeltmesinin kendisi); kalan 42 fark aynı carinin sonraki adımları ve kilit listesi (etiketler ["t37 c2", "kilit …"]); Mutabakat 40 / 40 iki kodda yeşil.
- C ✓ — 'önerinin (ve altının) yazımı kabul edilir' rastgele (40 tohum, iki TZ): 197 önerilen / kısmi yazım, 0 ret; 77 "sınır + 1 kuruş" denemesi, 0 kabul; yeni ↔ tur 3 (i) dünyası: yeni hâlin
  bulduğu her ihlal tur 3 hâlinde de var (yeni kırmızı 0; `leakOnly` 0). Dar kontrolün tohum 37 / cari 2 vakası kalıcı testte (küçültülmüş hâli, iki varyant).
- D ✓ — mutantlar (aşağıda): tur 2–3'ün uygulanabilen 17'sinin 17'si yakalandı (M8 DAHİL — tur 3'te yaşıyordu), M9 UYGULANAMADI (tur 3'teki gibi); tur 4'ün 11 mutantından 10'u yakalandı,
  M17b yaşadı (aşağıda).
- E ✓ — komşular 2220 / 2220 iki TZ (184 dosya), iki ekran senaryosu iki TZ yeşil, kâhin cari 25.957 / 25.957, defter 187 / 187.
- F ✓ — hız: Mutabakat Silinenler'le büyümüyor (HIZ).

## MUTANTLAR (kopya /dev/shm/m2t4-a752/mut; testler: hız + tur 2 iptal / iade + M2 sınırı + tur 3 + tur 4; çıktı m2t4-cikti/mutant-cikti.txt, mutant-ozet-1/2.json)
| Mutant | Sonuç |
|---|---|
| M1 aday günler geri · M2 iade denetimi yok · M2b iade Düzenle · M2c iptal · M3 (i) fatura iptali koşulu · M4 silme iletisi eski · M4b kapı iletisi genel · M5 sonra gelen Değersiz denemesi yok · M6 S155 üst sınırı kesin · M7 budama eşitlik | YAKALANDI (10) |
| M8 önceki gün kesiti aynı günü de alır | **YAKALANDI** (DÜŞÜK-2'nin iki M8 testi; tur 2–3'te yaşıyordu) |
| M9 | UYGULANAMADI (0 adet — tur 3'ten beri kodun kendisi) |
| M10–M15 (tur 3) | YAKALANDI (6) |
| M16 Silinenler taraması eski hâline ((i) kolu) | YAKALANDI (ikinci koşuda — ilk koşuda YAŞADI: plan denetimi yalnız "SCAN trash" arıyordu, SQLite tam taramayı MAX ile "SEARCH trash" (dizinsiz) yazıyor; test "her Silinenler erişimi idx_trash_open ile" diye sıkılaştırıldı, b7e4b6d7) |
| M16b bakiye kolu Silinenler taraması eski hâline | YAKALANDI |
| M16c daraltma en SON Değersiz satırından | YAKALANDI (ikinci koşuda — yeni test "iki Değersiz satırı arasında silinen fatura") |
| M17 (i) sonraki Değersiz'i kuyruktan okur (önerinin değişmezle doğrulanması kalkar) | YAKALANDI (3 test) |
| M17b çıkarma kısa yolu aynı günü de alır (`<` → `<=`) | YAŞADI — ürün kodu korumacı olan (`<`: aynı gündeki sonraki satırda kuyruk yeniden kurulur); fark ancak aynı gün, sonradan yazılmış Değersiz satırından SONRA yazılmış bağlı tahsilatta oluşur. Eksik test → SONRAKİ SÜRÜME |
| M18 Borç Yaz silme denetimi yok · M18b düzeltme · M18c taksit kartı silme · M18d taksit kartı düzenleme | YAKALANDI (4) |
| M19 'ne yapmalı' eski hâline · M19b hep şüpheli kayıt yolu | YAKALANDI (2) |

## HIZ (h-olcum — dar kontrolün betiği AYNEN; aynı veri: önce Silinenler boş, sonra 5.000 / 20.000 silinmiş fatura gövdesi (3 KB); `flock -x`, TZ=UTC; m2t4-cikti/h-olcum-sonuc.txt)
| Kod | Veri | Mutabakat önce → sonra | tahsilat yazımı (kapı) önce → sonra | yük |
|---|---|---|---|---|
| taban | 10 Değersiz satırlı cari · Silinenler 5.000 | 15,5 → **226,3 ms** | 34,9 → 264,2 ms | 2,70 |
| taban | 1 cari · Silinenler 20.000 | 13,7 → **102,7 ms** | 29,4 → 200,2 ms | 2,44 |
| yeni | 10 cari · 5.000 | 17,9 → **17,6 ms** | 35,2 → 34,1 ms | 2,44 |
| yeni | 1 cari · 20.000 | 13,1 → **13,0 ms** | 24,7 → 24,7 ms | 2,40 |
Not (ders 52): yük 2,4–2,7, çekirdeğin yarısının (2) üstünde → ölçüm kuralına göre GEÇERSİZ sayılır; oran açık (taban Silinenler'le 7–15 kat büyüyor, yeni büyümüyor) ama kabul ölçümünü ana
oturum özel kilitle yinelemeli. Değişmez fonksiyonun kendisi (iç ölçüm, 5.000 + 10 cari): 3,3 ms Silinenler'li / Silinenler'siz (tabanda 45,6 ms). Dişli hız testi süreye değil sorgu planına bakar.
Ek iş (ORTA-2): (i)'de türetilmiş kuyruk YALNIZ W'den sonra yazılmış ve W'den önceki güne düşen Değersiz satırı varsa kurulur (ölçüm verisinde hiç kurulmadı).

## KULLANICIYA SORULMALI
1. **S-M2T4-1 (PARA KURALI — ders 43; UÇ DURUM) — Değersiz Alacak satırı olan caride ÖDEME (cari kartı "− Ödeme", kind 'out') satırının silinmesi cariyi eksiye götürürse?** Ölçüm (yeni kodda da
   bugün): taban T'de Borç Yaz yerine 3.400 Ödeme → Ödeme'yi Sil → kabul, bakiye 423,55 → −2.976,45, Mutabakat yeşil. Karar metni yalnız "Borç Yaz" ve "taksit kartı" diyor; Ödeme de borç yönlü
   kayıt (aynı kök). A (ÖNERİ): Borç Yaz gibi reddedilsin — bakiye 423,55 kalır, ileti aynı düzende ("Ödeme hareketi silinemez: …"); tek satırlık değişiklik (aynı denetim `kind = 'out'`).
   B: bugünkü gibi kabul — bakiye −2.976,45. C: uç durum böyle kalsın (BİLİNEN SINIR) — sayılar B ile aynı. Yaygın programlarda: belgesi okunmadı. KODLANMADI.

## BAŞ MİMAR KARARI GEREKİYOR (değerlendir — kodlandı, ama okuma baş mimarın)
1. **ORTA-2 okuması: öneri 1.500 (kabul) — 1.400 değil.** Görev metni "hangisinin doğru olduğu kararlardan çıkıyorsa" diyor: S270 "hiçbir sırada … aşamaz" — 1.500 yazımı hiçbir zaman noktasında
   S1'i taşırmıyor (yukarıda KÖK NEDEN); 1.400 değişmezin karışık dünyasının ürünüydü. Bu yüzden düzeltme formda değil DEĞİŞMEZDE (W'nin dünyasının kuyruğu kendi tanımına uyar). Değişmez yalnız
   GEVŞER: rastgele taramada yeni hâlin bulduğu her ihlal tur 3 hâlinde de var (0 yeni kırmızı); kâhin cari / defter 0 fark. İki okuma görürseniz sorulmalı; ben kararlardan tek okuma çıkardım.
2. **Taksit kartının DÜZENLENMESİ (tutar düşürme, başka cariye taşıma) da aynı kurala alındı** — karar "taksit kartı silme" diyor; tutar düşürmesi Borç Yaz'ın tutar düşürmesinin birebir karşılığı
   (ölçüm aynı sayılar). Daraltmak isterse tek satır (`plans.mjs` PUT'taki denetim).
3. Borç Yaz düzeltmesinde denetim yalnız `kind = 'debt'` satırda; tahsilatın tutar ARTIŞI / yeni Alacak Yaz (avans) kapsam dışı bırakıldı (tur 3'ün "peşin tahsilat eklemesi denetlenmez" çizgisi).

## SONRAKİ SÜRÜME (20.11 kuralı — programı / kullanıcıyı etkilemeyen)
- M17b yaşadı: kısa yolun aynı gün sınırını ayıran kalıcı test yok (ürün kodu korumacı yolda).
- Ekran senaryosunda önceki adımın bildirimi sonraki adımın görüntüsünde üstte kalıyor (tur 3'ten; görünüm).
- Dar kontrolün B listesi AYNEN (senaryo başlık yorumu, çok satırlı retteki tekil 'satırını silin', 'eksi bakiye -X' çift eksi, geri yüklenmiş / taslak silinmiş faturanın sayılması, alış faturası yolu).
- Kalıcı rastgele testte ORTA-2 sınıfı (sonradan yazılan, daha eski tarihli Değersiz satırı + bağlı tahsilat) rastgele oluşmadı (`leakOnly` 0) — sınıf yalnız belirlenmiş vakada kalıcı; üreticiye
  bu sınıfı zorlayan adım eklenebilir.

## DOĞRULANMADI
- DÜŞÜK-1 iletisinde "Şüpheliden Çıkar" yolu Borç Yaz silmede kanıtlandı; Düzenle 2.900 → 100'de yalnız "kaydı sil" yolu izlendi.

## DENENMEYEN
- Silinen Borç Yaz'ın Silinenler'den geri yüklenmesi (bakiyeyi yükseltir — denetim çalışmaz; denenmedi).
- DÜŞÜK-1'in "cari değişikliği" ve "taksitli fatura iptali" yolları ayrı test olarak (aynı denetim işlevi; Düzenle / Borç / kart üzerinden sınandı).
- Dönem kilidi + Borç Yaz silme sırası (kilit iletisi denetimden önce gelir — kod sırası: `period.assertOpen` işlemden önce; testi yok).
- Windows (CI'de okunur; yeni testlerden dosyaya dokunan yok — Silinenler satırları veri tabanına yazılır).
- İki şirket / yedek geri yükleme: yalnız komşu testleri üzerinden (tur 2–3'ün f-yedek-sirket betiği koşulmadı).

## BİLİNEN SINIRLAR
- Tur 2–3'ten AYNEN: değişmez (i) gevşemesi (iptal edilen faturayla ilgisiz eski bağsız tahsilat da "sonradan değişmiş"), geri yüklenmiş / taslak silinmiş faturanın sayılması.
- Daraltma `restored_at >= ''` ile geri yüklenmiş satırları dizinden okur; geri yüklenmiş Silinenler satırı sayısıyla (yalnız onunla) büyür.

## CI LİSTESİNE EKLENECEK
Yok (yeni ekran senaryosu açılmadı). `test/e2e/senaryo-degersiz-iptal-m2t2-251.mjs` tur 2'den beri listede (adım 6 eklendi — CI'de koşar). Node testi `test/*.test.mjs` deseniyle koşar.

## KILAVUZ ÖNERİSİ ("nasıl yapılır")
"Değersiz Alacak yazılmış bir caride Borç Yaz satırını ya da taksit kartını silmek veya tutarını düşürmek cariyi alacaklıya (eksi bakiyeye) götürecekse program izin vermez — fatura iptalindeki
gibi. Önce cari kartında Şüpheli Alacak bölümünde kaydın Değersiz satırındaki × ile Değersiz Alacak satırını silin, sonra işlemi yapın. Program 'Değersiz Alacak satırını silmek yetmez' diyorsa
şüpheli kaydı da silin ya da Şüpheliden Çıkar ile çıkarın; alacak hâlâ şüpheliyse kalan borç için yeniden Şüpheliye Alın."

## COMMİTLER (t251-m2t4-taban..dal ucu)
d5e5644f nasıl bozulur · 51588937 ORTA-1 + ORTA-2 + S-DKM2T3-1 + DÜŞÜK-1 + DÜŞÜK-2 (kod + testler) · 8bd2a1e5 plan testinin eski kod nedeni · 32582292 koşan sorguların planı (casus) ·
b7e4b6d7 SEARCH'ü de yakalayan plan denetimi + iki Değersiz arası silme testi · 5f08e45d ekran senaryosu adım 4 / 6 · b3c01f6b Kanıt · (son) rapor. Model adı commit'lerde / kodda 0.

## ANA OTURUMUN YENİDEN KOŞACAKLARI
- TZ=UTC ve TZ=Europe/Istanbul: `M2T4_TOHUM=$(seq -s, 1 40) HUKUK_LICENSE_URL=http://127.0.0.1:9 node tools/kanit.mjs kos m2t4-rk -- node --test test/supheli-degersiz-m2t4-251.test.mjs test/supheli-degersiz-m2t3-251.test.mjs test/supheli-degersiz-iptal-iade-m2t2-251.test.mjs test/supheli-degersiz-siniri-m2-251.test.mjs test/supheli-degersiz-hiz-m2t2-251.test.mjs`
  (101 / 101). Taban: `git worktree add --detach <yol> t251-m2t4-taban` + yalnız `test/supheli-degersiz-m2t4-251.test.mjs` ve `test/supheli-degersiz-m2t3-251.test.mjs` (17 / 30; 13 kırmızı, nedenler yukarıda).
- Ekran (PLAYWRIGHT_BROWSERS_PATH=…/pw-1194): `node test/e2e/senaryo-degersiz-iptal-m2t2-251.mjs` (33 / 33; tabanda 27 / 33) ve `node test/e2e/senaryo-degersiz-siniri-m2-251.mjs` (24 / 24).
- Eşdeğerlik (eski kod hakem): `docs/kanit/2026-11-28/m2t4-arac/esdeger-kos.sh` (YENI / ESKI yolları betikte; a-esdeger4.mjs).
- Mutasyon: `python3 -I docs/kanit/2026-11-28/m2t4-arac/mutant.py` (kopya yolu `/dev/shm/m2t4-a752/mut` betikte — dal ucunun worktree kopyası + node_modules bağı).
- Komşular: `docs/kanit/2026-11-28/m2t4-arac/komsu.sh` (184 dosya); `npm run test:kahin-cari`, `npm run test:kahin-defter`.
- Hız (özel kilit): `node <dk-m2t3>/h-olcum.mjs <kök> 5000 10` ve `… 20000 1` taban / yeni.
- Cari kâhini sonraki bakımı için beklenen fark: Değersiz satırı olan caride Borç Yaz satırının silinmesi / tutar düşürmesi / Alacak'a çevrilmesi / başka cariye taşınması ve taksit kartının
  silinmesi / tutar düşürmesi cariyi eksiye götürüyorsa RET (`doubtful-writeoff-balance`); ORTA-2 sınıfında önerilen Değersiz tutarı KABUL. Bugünkü kâhin senaryolarında bu sınıflar yok (0 fark).

