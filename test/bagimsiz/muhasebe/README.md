# Muhasebe Çekirdeği + Yıl Sonu Devri — Kâhin (temiz oda modeli), DestekOfis 2.5.0

Programın kodunu GÖRMEDEN, yalnız yazılı kurallardan kurulmuş bağımsız Python modeli (CLAUDE.md KANIT KURALI 2, dersler 5, 40, 43).
Program (JavaScript) ayrı bir sürücü ajanıyla bu senaryolara karşı koşulup karşılaştırılır; **fark önce hatadır** (ders 6).

## Kaynaklar (yalnız bunlar okundu)
- `docs/erp/MUHASEBELESTIRME-KURAL-KITABI.md` — ANA KAYNAK (§1 genel kurallar, §2 hesap planı, §3 olay → madde tabloları, §4–§8, §9 KG).
- `docs/erp/MUHASEBELESTIRME-KURAL-KITABI-EK-1.md` (BAKIM 05.11.2026) — §1 Tek Yükümlülük Kuyruğu, M1–M14 öneri (A), §3 E1–E10, §4 13 değişmez.
- `docs/erp/MUHASEBE-CEKIRDEGI-PLANI.md` (§6 Ç5, §7 Ç6, §13, §14), `docs/devir/DEVIR-PLANI.md` (§0, §1, §4, §11, G2, G3, G7, G13, G14),
  `docs/2.5.0-IS-LISTESI.md` (yalnız A, C, D; E okunmadı), `docs/BAGIMSIZ-DOGRULAMA-PRENSIBI.md`, CLAUDE.md.
- Ürün sahibinin kararları (iş listesi D): 05.11 17:16 "hepsi A" (11 para kuralı) ve 05.11 ~18:55 S1–S5 HEPSİ A. KG-3 için kullanıcıya gösterilip
  onaylanan metin AYNEN: "KG-3 kayıt (dosya) tahsilatı gelir değil → 'Sınıflandırılmamış Tahsilatlar' (carisiz Kasa girişi 649'da kalır)".
- Ana oturumun 05.11 ~19:50 ek maddeleri (yalnız önceden yazılmış karar metinleri): `docs/2.3.0-SUPHELI-KABUL.md` §1 K1–K7 ve §2 (kaynağı
  `docs/BANKA-MODULU-PLAN.md` §3.11b), `docs/BANKA-MODULU-PLAN.md` POS valör örnekleri, `docs/GECMIS-KARARLAR.md` "Fatura listesinde SİLME"
  kararı (2.0.17) ve "NUMARA" sıra-tarih kuralı; kitap M-01 / G-7 / R-04.
- Biçim örneği: `test/bagimsiz/ebelge/test_model.py`, `mutasyon.py` (ilk kurulumda). `server/`, `client/`, `tools/` (yalnız `tools/kanit.mjs`
  ÇALIŞTIRILDI), `bulut/`, `packaging/`, öteki `test/` klasörleri (sürücü klasörü `test/bagimsiz/muhasebe-surucu/` ve tutar kâhini dahil),
  `docs/kanit/` (kendi kanıtları dışında) ve git geçmişi OKUNMADI.

## Dosyalar
| Dosya | Ne |
|---|---|
| `model.py` | Model: hesap planı (§2 + 671 / 681), olay → madde (§3), mizan, büyük defter, gelir tablosu (MSUGT, 7/A), bilanço (ters bakiye brütleştirme, hesaplanmış satırlar, Kesin Değil), dönem sonu değerleme (§5), **Tek Yükümlülük Kuyruğu** (EK-1 §1: açık kalemler, gecikmiş, hatırlatma, şüpheli kuyruğu), kapanış (Önceki Yıl Sonucu Fişleri + N-01…N-07), devir açılışları (N-09…N-13; M2/M3/M12/M13), Devri Yenile (N-14, M9), Devri Geri Al (N-15), dönem kilidi + 2.4.9 donmuş defter + Kural Farkı Düzeltme Fişi (Ç3, KG-15, M7), KDV dönem etiketi (M8, S4), şüpheli kayıtları (K3), değişmezler |
| `senaryolar_elle.py` | 54 elle doğrulanabilir senaryo (s01…s53; s26 iki seçenekli); her birinde ELLE hesaplanmış beklenenler ("elle", hesap yorumda) |
| `uretici.py` | Tohumlu rastgele üretici: bir yıl (~800 olay) + K sonrası Ocak + devir + devirden sonra kayıt + Devri Yenile; tohum 1, 2, 3 |
| `uret_beklenen.py` | `senaryolar/<ad>.json` (kendi kendine yeten senaryo: tanımlar + olaylar + dallar + elle) ve `senaryolar/beklenen/<ad>.json` (her dal için modelin tam çıktısı) yazar / `--denetle` |
| `test_model.py` | 97 test: yardımcılar, olay → madde birim testleri, 54 elle senaryo (her dal + bütün değişmezler), 3 rastgele tohum (devirli = devirsiz dahil), değişmez denetçilerinin dişi, senaryo hijyeni (VUK sıra-tarih, K-14 tarihi, POS valörü iş günü), dosya güncelliği |
| `mutasyon.py` | 95 metin mutantı (model.py kaynağında tek kural bozulur); her biri en az bir testte KIRMIZI olmalı |

## Çalıştırma
```
python3 test/bagimsiz/muhasebe/test_model.py          # modelin kendi testleri
python3 test/bagimsiz/muhasebe/mutasyon.py            # testin dişi (çıkış 0: bütün mutantlar öldü)
python3 test/bagimsiz/muhasebe/uret_beklenen.py       # senaryo + beklenen dosyalarını yeniden yaz (model değişince)
python3 test/bagimsiz/muhasebe/uret_beklenen.py --denetle
python3 test/bagimsiz/muhasebe/uretici.py 2           # tek tohum özeti
# kanıt: node tools/kanit.mjs kos kahin-muhasebe-bakim-test -- python3 test/bagimsiz/muhasebe/test_model.py
```

## Senaryo dili (sürücü bunu programın API'sine çevirir)
Senaryo: `{ad, aciklama, kapsam[kitap satırları], defter_turu, cariler, bankalar, poslar, kartlar, krediler, urunler, olaylar[], dallar[], elle{}}`.
Tutarlar KURUŞ (100000 = 1.000,00 TL). Cari türü `musteri` → 120, `tedarikci` → 320, `diger` → 336. Alt hesap: banka `102.<banka>`, POS `108.<pos>`,
kart `309.<kart>`, kredi `300.<kredi>`; evrak `101.01/.02`, `121.01/.02`; yoldaki `108.90`; belgesiz `600.90/610.90`; Borç / Alacak Yaz `602.90/770.90`.
Her olay `{tur, tarih, …}`; `id` verilirse sonraki olaylar ona başvurur. Satış faturaları, satıştan iade faturaları (aynı seri) ve e-SMM'ler aynı yıl
içinde tarih sırasıyla girilir (VUK müteselsil sıra-tarih; `SenaryoHijyeni` denetler).

| tur | alanlar | kitap |
|---|---|---|
| kasa_acilis / banka_acilis / kart_acilis / kredi_acilis | tutar; banka / kart / kredi (banka eksi = KMH) | M-01, M-04, M-05, M-06 |
| cari_acilis | cari, yon borc/alacak, tutar, aciklama (açılış İŞARETLİ) | M-02, M-03 |
| stok_acilis | kalemler [urun, miktar, birim_maliyet (kuruş, kesir "10000/3" olabilir)] | M-07 |
| evrak_acilis | evrak, evrak_turu cek/senet, yon alinan/verilen, durum portfoy/tahsilde, tutar, cari, banka | M-08, M-09 |
| taksit_excel | cari, toplam, odenen, taksitler [vade, tutar] | H-06, M-10, KG-5 |
| acilis_eslestir | tarih, satirlar [hesap, borc/alacak] (519 karşı satırı kendiliğinden) | M-11 |
| satis_faturasi | cari, M, K, T, ihracat, vade, kalemler [urun, miktar] | F-01…F-04 |
| alis_faturasi | cari, fatura_turu stok/gider, gider_turu genel/satis/finansman/demirbas/ceza (yazılmazsa "seçilmemiş" → 770.90), M, K, T, S, indirim_ayi (KG-7), kalemler [urun, miktar, M] | F-05, F-06, S-01, M14 |
| satis_iade_faturasi / alis_iade_faturasi | cari, M, K, asil_fatura, kalemler, (alış iadesinde fatura_turu) | F-07, F-08, F-09 |
| esmm / gelen_smm | cari, brut, K, S, T | F-10, F-11 |
| duzenle {kaynak, degisiklik{}} / iptal {kaynak} / sil / geri_yukle | kaydedilmiş fatura Silinenler'den geri yüklenince ETKİSİZ ("İptal Edildi"); öbür kayıtlar ve taslak etkin döner | F-14, F-15, D-03, R-04, C-03, G-7 |
| mahsup | fatura1, fatura2, tutar (madde yok) | F-16 |
| tahsilat | cari, yol nakit/havale/pos/cek/senet/kart, tutar, banka, pos+komisyon+valor, evrak, fatura (+fatura_odemesi = formdaki peşin), taksit_karti, normal_cari ("Normal Cari Hesaba İşle"; `supheliden` geriye uyum için kabul edilir, artık varsayılan) | T-01…T-04, T-10…T-13, H-04, J-03, K3 |
| odeme | cari, yol nakit/havale/kart/cek/senet/ciro, tutar, banka, kart, evrak, fatura, taksit_karti | T-05…T-09, H-05 |
| kayit_tahsilati / kasa_giris / kasa_cikis | tutar | T-14, K-01, K-02 |
| bankadan_kasaya / kasadan_bankaya | banka, tutar | K-03, K-04 |
| banka_transfer | gonderen, alici, tutar, ucret, bsmv, valor | K-05, K-06, K-07 |
| banka_masraf / banka_masraf_faturali / faiz_geliri / faiz_gideri / banka_diger_gelir / banka_diger_gider | banka, tutar (+bsmv) / M, K / brut, stopaj | K-08…K-12 |
| hesapsiz_hareket / kart_borcuna_aktar | cari, yon (tarihi banka açılışından ÖNCE) / kart, tutar, acilistan_once | K-14, K-15 |
| pos_aktar {tahsilat} / pos_komisyon_faturasi {K, karsi komisyon/cari} / pos_iade {tahsilat, cari, tutar, komisyon_iadesi} | — | D-01, D-02, D-04 |
| kart_harcama / kart_borc_odeme / kart_faiz / kredi_kullan / kredi_odeme | kart, cari ya da urun+miktar, tutar / banka / anapara, faiz | D-05…D-10 |
| evrak_tahsile_ver / evrak_bankadan_geri_al / evrak_tahsil / evrak_karsiliksiz / verilen_evrak_ode / verilen_evrak_geri_al / evrak_islem_geri_al | evrak, banka, yol kasa | Ç-02…Ç-12 |
| taksit_karti / taksit_kapat | cari, kaynak fatura/mevcut_borc/yeni_borc, fatura, toplam, taksitler | H-01, H-02, H-03, H-07, M1d, M1e |
| kdv_mahsup {ay} / kdv_mahsup_geri_al {ay} / fis_ters {fis} | — | V-01, R-03, M8, S4 |
| vergi_odeme / gecikme_zammi | yol, banka, tutar | V-02, V-03, V-04 |
| supheliye_al / karsilik_ayir / degersiz_yaz / supheliden_cikar | cari, tutar, kayit (supheliye_al olayının kimliği; yazılmazsa: karşılıkta en eski açık kayıt, değersiz / çıkarda bütün açık kayıtlar) | J-01, J-02, J-05, J-06 (J-04 kendiliğinden), K1–K7 |
| stok_giris / stok_cikis_satis / stok_musteri_iadesi / stok_tedarikci_iadesi / stok_duzeltme | urun, miktar, tutar, karsi nakit/havale/cari | S-02…S-06 |
| borc_yaz / alacak_yaz | cari, tutar, aciklama, acilis (işaret), onay (KG-16 "Açılış Olabilir" onayı), vade | C-01, C-02, KG-16 |
| ters {hedef} | banka işlem kartı → Ters Kaydet (girildiği gün; 191 / 391 satırı kendi ayına etiketlenir, S4) | R-01, R-02 |
| donem_kilitle {tarih, kural: "2.4.9" göç senaryosu} / kural_farki_duzelt / cari_tur_degistir {cari, yeni_tur} | — | Ç3, KG-15, M7, N-16, G-2 |
| devir {K, secenek borc_alacak/sadece_bakiye, bugun} / devri_yenile {duzeltmeler[], bugun} / devri_geri_al | K yalnız 31 Aralık (M11); bugun verilirse K < bugun | N-01…N-15, M11 |
| rapor {ad, rapor, dosya canli/arsiv, …} | mizan {bas, son} · gelir_tablosu {bas, son} · bilanco {tarih} · buyuk_defter {hesap, bas, son, cari} · gecikmis {cari, tarih} · gecikmis_tumu {tarih} · hatirlatma {tarih} · acik_faturalar {cari, tarih} · acik_kalemler {cari, tarih} · degerleme {tarih} · yevmiye · kural_farki · kaynak_durumu {kaynak} · supheli_kayitlari {cari} | §4, §7 |

Çıktı anahtarları: bilanço kalemleri `I.A … II.D` (aktif), `III.A … III.I`, `V.A, V.D, V.E, V.F (Dönem Net Kârı), V.K (Geçmiş Yıllar — Kapanmamış), V.G (519)`;
ayrıca `gecmis_yillar_kar` / `gecmis_yillar_zarar` (V.K'nın 570 / 580 kısımları, M4). Gelir tablosu `A, B, C, D, BSK, E, FK, F, G, H, OK, I (671 dahil), J (681 dahil), DK, K, DNK`;
mizan satırı `hesap|cari`; tutar işareti borç +. `gecikmis` → {gecikmis, supheli, detay}; `hatirlatma` → {otomatik {cari: tutar}, supheli_etiketli [cari]};
`buyuk_defter` → ayrıca satir_sayisi. Devir raporu: arsiv_kapanis, yeni_acilis, kapanis {N01 {K yılı}, onceki_yil {Y: {SMM, R}}, R, DSS, sonuc},
acilis {acik_kalemler [cari, k, tur, kalan, vade, belge_tarihi], cariler {bakiye, acilis (= net kalan satırı)}, ekstre {Borç Toplamı, Alacak Toplamı |
Devir Bakiyesi, acik_kalemler, satirlar [tarih, aciklama, borc, alacak, vade, bakiye]}, ekstre_cariler, kartlar {acik_taksitler}, supheli {tutar, kalemler},
stok, eksi_stok, N13 (191 / 391 "hesap@dönem")}, degismezler; Devri Yenile ayrıca fark, gecikmis_degisen {cari: {once, sonra}}, bag_degisen {kayıt: {once, sonra}}, uyarilar.
Kesin Değil kodları: `TAMAMLANMAMIS_ACILIS, SATISLARIN_MALIYETI_TAHMINI, SATISLARIN_MALIYETI_HESAPLANMADI, EKSI_KASA, EKSI_STOK, TERS_BAKIYE:<hesap>,
BORCLU_360, KAPANMAMIS_ONCEKI_YIL, KURAL_DEGISIKLIGI_FARKI, SINIFLANDIRILMAMIS_TAHSILAT, BILGI_AMACLI, AKTIF_PASIF_FARKI, KDV_MAHSUBU_GUNCEL_DEGIL:<ay>,
ARALIK_KDV_MAHSUBU_YAPILMAMIS`. Red kodları (program 4xx): `KILITLI_DONEM, KASA_ACILIS_TEKRAR, KASA_ACILIS_SONRA, SUPHELI_FAZLA, KARSILIK_FAZLA,
SUPHELI_YOK, SUPHELI_NORMAL_ASIM, EVRAK_DURUMU, KDV_MAHSUP_TEKRAR, KDV_MAHSUP_BOS, ZATEN_TERS, ESLESTIRME_HESAP, ESLESTIRME_TERS, KG15_B_DUZELTILMEZ,
KURAL_FARKI_YOK, DEVIR_YENILE_CAKISMA, DEVIR_K_31_ARALIK, DEVIR_K_GELECEK` (SUPHELI_TAHSILAT_FAZLA kalktı: K3'te aşan kısım 120'ye).

## Model kapsamı
Kural kitabı §3'te 129 olay satırı; 127'si modelde (olay ya da "madde yok" kuralı olarak) ve en az bir testte geçiyor. Modellenmeyen: F-17 (Müşteri Fişi
Olarak Bırak — defter etkisi yok, olay gerekmez), S-08 (aynı mal için stok girişi + alış faturası — bağlama kuralı, arayüz düzeyi).

### Tek Yükümlülük Kuyruğu (EK-1 §1; S1, S2, S3 A)
Her cari için CH hareketleri (128 hariç) kalemlere çevrilir; vade yoksa vade = belge / işlem günü (S1 A). Olaylar tarih → sınıf → gün sırası → giriş sırasıyla işlenir:
bağ (Kapatılacak Fatura, iade → asıl fatura, Mahsup Et, kart tahsilatı) hedefini ÖNCE kapatır, hedefin bağsız kapanmış kısmı geri alınır; bağsız alacak / borç
o anda açık karşı kalemlere vadesi ilk gelenden (eşitse belge tarihi, sonra giriş sırası; S2 A) uygulanır. Taksit kartı alttaki kalemi tüketir, kuyruğa yalnız
taksitler girer (M1e); Kartı Kapat kalanı kapatma tarihli tek kalem (M1d); karşılıksız evrak ayrı borç kalemi (M1c); J-01 açık borçları vade sırasıyla
şüpheli kuyruğuna taşır, J-06 kendi vadeleriyle döndürür (M13). gecikmiş(t) = Σ açık borç kalemi (vade < t; M1f). Otomatik Ödeme Hatırlatma = gecikmiş > 0;
şüpheli tutarı olan cari "Şüpheli alacağı var" etiketiyle ayrı listelenir (S3 A).

### Şüpheli caride alacak satırları (2.3.0 kabul §1 K3; plan §3.11b/2)
Şüpheli kaydı açık müşteride, kayıt tarihinden sonra (aynı gün: al → karşılık → değersiz → alacak satırı → çıkar) gelen alacak satırı (tahsilat — her yol,
alınan evrak dahil; Alacak Yaz; satıştan iade; taksit tahsilatı) ÖNCE şüpheliden düşer (A 128, en eski kayıt önce; aşan A 120). 120'de kalanlar: "Normal Cari
Hesaba İşle", satış faturasının peşini, Kapatılacak Fatura bağlı tahsilat (SINIR: açık kayıt varken 120 bakiyesini aşamaz → SUPHELI_NORMAL_ASIM); taksit
tahsilatı yalnız kart açılış tarihi ≤ kayıt tarihi olan kayıtlardan düşer (Mevcut Borcu Taksitlendir kartı her zaman düşer). Karşılık kayıt başına; K6 (karşılık ≤ kalan → 644).

## Dallar
Varsayılan bütün maddeler A (ürün sahibi 05.11.2026 17:16 ve 18:55). **B dalları GEÇERSİZ (kullanıcı A seçti)**: ucuz oldukları için duruyor, kanıt sayılmaz.
| Madde | A (varsayılan) | Öbür dal (geçersiz) |
|---|---|---|
| B1 | vadesi geçmiş fatura kalanı gecikmiş (taksitli faturada yalnız taksit) | B: fatura hariç — geçersiz (kullanıcı A seçti) |
| KG-2 | belgesiz gelir 600.90 / 610.90, KDV ayrılmaz | B: iç yüzde KDV — geçersiz (kullanıcı A seçti) |
| KG-3 | ONAYLANAN metin: kayıt tahsilatı 336.90 (gelir değil, Kesin Değil), carisiz Kasa girişi 649.90 | KITAP: kitabın §9 A'sı (ikisi 649.90) — geçersiz; B: ikisi 336.90 — geçersiz. (Eski "SORU" etiketi kalktı; onaylanan metin artık A.) |
| KG-5 | Excel kartı açılış alacağı B CH (T−P) / A 519 | B: yeni satış — geçersiz (kullanıcı A seçti) |
| KG-6 | POS komisyonu satış (çekim) günü, 653 | B: valör günü — geçersiz (kullanıcı A seçti) |
| KG-7 | alış faturasında "KDV İndirim Dönemi" alanı | B: hep belge ayı — geçersiz (kullanıcı A seçti) |
| KG-9 | eksi miktarlı ürün 0 değer + Kesin Değil (miktar eksi dahil devreder, M5) | B: eksi değer — geçersiz (kullanıcı A seçti) |
| KG-11 | satışların maliyeti "Tahmini" — Gelir Tablosu ve Bilanço birlikte | B: "Hesaplanmadı" — geçersiz (kullanıcı A seçti) |
| KG-12 | önceki yıllar yıl yıl, K tarihli Önceki Yıl Sonucu Fişi, 570 / 580 brüt (M4) | B: hepsi 590 / 591 — geçersiz (kullanıcı A seçti) |
| KG-15 | ilk açık güne "Kural Farkı Düzeltme Fişi" (aynı mali yıl: eski hesabın tersi; önceki mali yıl: 671 / 681 — M7) | B: yalnız "Kural Değişikliği Farkı" — geçersiz (kullanıcı A seçti) |
| KG-16 | açıklaması "Açılış" ama işaretsiz kayıt "Açılış Olabilir" listesine; onaylanırsa 519 | B: sessizce 602.90 / 770.90 — geçersiz (kullanıcı A seçti) |
S1–S5 (EK-1 §5) yalnız A olarak kuruldu (B dalı yok). Tek dallı (kitapta öneri / sorulmaz): KG-1 519, KG-4 A, KG-8 A (191), KG-10 A, KG-13 A (vergi karşılığı yok),
KG-14 A (198), KG-17 A (M3), KG-18 A, KG-19 A, KG-20 A (yalnız valörden önce), KG-21 A (659), KG-22 A, KG-23 A, KG-24 A (601), KG-25 A (336); POS komisyonu 653 (760 geçişi 2.5.1, çekirdek §13).
Eski "seçim değişti" maddeleri (EK-1 §0 / §6): M2 (devirde her açık kalem — fatura dışı da — kendi vadesiyle; önceki model net satırı vadesiz taşıyordu), M3 (defterde cari
başına tek net satır; önceki model açık kalem başına ayrı N-10 maddesi yazıyordu), M4 (önceki yıl sonucu K tarihli; önceki model o yılın 31.12'sine değerleme yazıyordu),
M5 (miktar eksi dahil; model zaten öyleydi, değişmez eklendi), M7 (önceki mali yılda 671 / 681), M11 (yıl ortası K reddedilir; önceki model izin veriyordu), M12, M13, S1–S5.

## Değişmezler (her senaryoda, her dalda koşar)
Her madde dengeli ve > 0 · mizan Σ borç = Σ alacak, Σ bakiye = 0 · Aktif = Pasif (tutmazsa fark + Kesin Değil, denkleştirme yok) · Gelir Tablosu
(1 Ocak → t) Dönem Net Kârı = Bilanço hesaplanmış Dönem Net Kârı (kapanmış dosyada = N-07'nin 590/591 tutarı) · modül bakiyeleri (kasa, banka, kart, kredi,
POS bekleyen, yoldaki, cari = CH + 128, evrak portföyü) = defter · büyük defter = mizan (ana hesap).
EK-1 §4 (bakım): (1)–(3) `tyk` — her cari, t ve yılın her ayının 15'inde: 0 ≤ gecikmiş ≤ max(0, CH); Σ açık borç − Σ açık alacak = CH; iki taraf birden açık
değil; şüpheli kuyruğu = 128; hatırlatma = gecikmiş · (8) `tahmini_aylik_toplam` — kapanmamış yılda aylık tahmini SMM toplamı = yıllık · (9)
`kural_farki_yeni_kural` — Kural Farkı Fişi'nden sonra 1–5 sınıfı (59x hariç) = yeni kuralla baştan türetilmiş defter · (10) `kdv_mahsup` — her mahsuptan
hemen sonra dönemi o ay olan 191 ve 391 = 0 (S4 A net hareket).
Devirde ayrıca: arşivde 6 / 7 sınıfı 0 ve 153 = DSS · her bilanço hesabı (alt hesap ve cari boyutuyla) arşiv K kapanışı = yeni yıl K+1 açılışı · yeni yıl 519 =
arşiv 519 · devir maddeleri 6 / 7'ye dokunmaz · modül bakiyeleri iki dosyada eşit · arşiv ≤ K + yeni yıl > K hareket sayısı = devir öncesi · (4) `m2_gecikmis_ayni`
— her cari ve K+1, açık kalem vadeleri (ve ertesi günleri), son gün için gecikmiş ve açık borç (vade, kalan) listesi devirli = devirsiz (Devri Yenile'de devirsiz
dosya arşiv + yeni yılın kendi kayıtlarından kurulur) · (5) `m3_tek_satir` · (6) `m4_m6_kapanis` — N-07 = devir öncesi hesaplanmış Dönem Net Kârı; Önceki Yıl Sonucu
Fişlerinin 570 / 580'i = devir öncesi bilançonun geçmiş yıllar kâr / zarar kısımları; tahmini SMM (1 Ocak → K) = N-01 · (7) `m5_miktar` · (12) `m12_k_oncesi_satir`
· (13) `m13_ayri` — CH kalemleri (+ kart taksitleri) = CH K bakiyesi, şüpheli kalemleri = 128. (11) M11 olay anında red.
Rastgele tohumlarda ek: devirden önceki canlı Gelir Tablosu (tahmini) = arşivin Gelir Tablosu (kesin); devir öncesi bilanço aktifi = arşiv bilançosu aktifi;
**devir şirketin durumunu değiştirmez** — aynı olaylar devirsiz koşulunca son bilanço aktifi, 1–4 sınıfı bakiyeleri (153 defter değeri hariç) ve her carinin
gecikmiş tutarı (iki tarihte) aynı.

## Elle beklenenlerin yazılış sırası (bakım)
- 4315f513: s40–s51 ve s04 / s11 / s22 / s25 / s26 / s27 / s32 güncellemeleri model DEĞİŞTİRİLMEDEN ÖNCE yazıldı ve commit'lendi. Model değiştikten sonra
  ilk koşuda bu değerlerin HİÇBİRİ değişmedi (tek kırmızı, modelin kendi M5 değişmez denetçisindeki hataydı — devir açılışını yeni yılın 1 Ocak hareketleriyle
  karıştırıyordu; düzeltildi, senaryo değeri değil).
- b7fd9e54: ana oturumun ek maddeleri için s52 (K3), s53 (kasa açılışı düzeltmesi, silinen faturanın geri yüklenmesi) ve s11 / s41 / s42 / s46 düzeltmeleri bu
  kurallar modele girmeden ÖNCE yazıldı; ilk koşuda değişmedi. s41'in C3 bölümü (giriş sırası ≠ belge tarihi denemesi) VUK sıra-tarih kuralı yüzünden satış faturası
  yerine seri dışı Borç Yaz ile yeniden kuruldu (elle, aynı hesap); s42'de tahsilata "Normal Cari Hesaba İşle" eklendi (K3 öncesi niyet aynen).
- Sonradan elle eklenen iki birim testi: `test_K3_kabul_E_iki_kayit_en_eskisi_once` (sayılar `docs/2.3.0-SUPHELI-KABUL.md` §2 E'den, plandan önceden yazılmış) ve
  `test_TYK_bag_hedefin_bagsiz_kapanisini_geri_alir` (ilk mutasyon koşusunda N25 sağ kaldı — "bağlar önce" ikinci geçişi hiçbir senaryoda sınanmıyordu;
  beklenen KARAR GEREKİYOR 24'teki okumadan elle). İlk koşuda M54 da sağ kaldı: Excel kartının önceden ödeneni artık modül sayacında değil kuyrukta
  (`kart_ac`) düşülüyor; mutant kuralın yeni yerine taşındı.
- s07'deki kilitli tarihli satış faturası (F5) seri dışı Borç Yaz yapıldı (red kodu VUK sıra-tarihiyle karışmasın); beklenen aynı.

## Üretici düzeltmeleri (ana oturum 05.11 ~19:50, K1–K5)
- K1: KDV, tevkifat (5/10, 2/10) ve stopaj tutarı kuruşa YARIM YUKARI (kitap G-1; GİB / UBL-TR satır yuvarlaması) — önce aşağı yuvarlıyordu. Tutar kâhini OKUNMADI
  (bağımsızlık sınırı); kural kitabın G-1'inden.
- K2: satıştan iade asıl faturanın KDV oranıyla (F-09); tevkifatlı fatura iadesi üretilmez.
- K3: POS valörü hafta sonuna düşerse sonraki iş günü (BANKA-MODULU-PLAN POS örnekleri); resmî tatil takvimi YOK.
- K4: s11'de "Hesapsız (Açılıştan Önce)" hareketi banka açılışından önceye alındı (cari açılışıyla birlikte 2025 Aralık).
- K5: Devri Yenile'nin geç gelen Aralık satış faturası K (31.12) tarihli — serinin son tarihinden önce olamaz.

## KARAR GEREKİYOR (kâhinde kesinleştirilmedi; model seçimi yanında — "ÇÖZÜLDÜ" olanlar karar metninden)
1. ~~KG-3 tanım çelişkisi~~ ÇÖZÜLDÜ (onaylanan metin A). Kalan: "649'da kalır" — model alt hesap 649.90 (kitap K-01 önerisi); düz 649 da okunabilir.
2. ~~B1 ayrıntısı~~ ÇÖZÜLDÜ (EK-1 §1, S1, S2, M1a–M1f).
3. ~~Devirde cari açılış satırının vadesi~~ ÇÖZÜLDÜ (M2).
4. ~~KG-17 net tek madde~~ ÇÖZÜLDÜ (M3).
5. ~~KG-12 önceki yıl değerlemesinin tarihi~~ ÇÖZÜLDÜ (M4).
6. ~~570 / 580 dağıtımı~~ ÇÖZÜLDÜ (M4: yıl yıl brüt).
7. ~~KG-12 B~~ geçersiz (kullanıcı A seçti).
8. ~~KG-9 A sonraki yıl~~ ÇÖZÜLDÜ (M5).
9. ~~KG-11 A ara tarih~~ ÇÖZÜLDÜ (M6; model zaten [1 Ocak, t]).
10. ~~KG-15 A sınıf / hesap~~ ÇÖZÜLDÜ (M7).
11. ~~KG-7 A devirde~~ ÇÖZÜLDÜ (M8 dönem etiketi; S4 net hareket).
12. ~~N-09 "taksit"~~ ÇÖZÜLDÜ (M3 + kart taksitleri cari modülünde).
13. ~~Devri Yenile çakışması~~ ÇÖZÜLDÜ (M9).
14. ~~F-15 bağlı ödemeler~~ ÇÖZÜLDÜ (S5).
15. ~~J-01 ve açık kalem~~ ÇÖZÜLDÜ (M13).
16. POS komisyonu hesabı: 653 (760 geçişi 2.5.1, çekirdek §13) — sürer.
17. D-04 valörden sonra komisyon iadesi — model desteklemez (sürer).
18. ~~Yıl ortası K~~ ÇÖZÜLDÜ (M11).
19. ~~F-06 gider türü~~ ÇÖZÜLDÜ (M14). Kalan: kitap F-06 "varsayılan 770" ile M14 "seçilmemiş / tanınmayan → 770.90" — model: olay dilinde gider_turu
    YAZILMAMIŞSA "seçilmemiş" (770.90). Programda gider türü hep dolu geliyorsa sürücü olayı "genel" ile girmeli.
20. ~~KG-2 B~~ geçersiz.
21. ~~Ekstre~~ ÇÖZÜLDÜ (M12).
22. Kesin Değil metinleri programın; model kod kullanır — sürücü eşlemesi gerekir (sürer).
23. **YENİ — TYK okuması:** EK-1 §1 adım 4 "bağsız alacak kalemleri havuzlanır … Sonuç: açık borç kümesi, sıralı listenin SONUNDAKİ kalemlerdir" (HAVUZ: as-of-t, ödemeden
    sonra girilen ve vadesi daha önce gelen borç da ödemeyi "alır") ile M2'nin değişmezi "her t ≥ K+1 için gecikmiş devirli = devirsiz" ve S2'nin sorusu ("bağlamadan yapılan
    ödeme önce hangi borcunu kapatsın") iki okumaya izin veriyor. Model ANINDA okuması: ödeme girildiği anda açık olan borçlara S2 sırasıyla (M2 değişmezini her durumda
    yalnız bu okuma sağlıyor — havuz okumasında K'den önceki ödeme K sonrası erken vadeli borca kayabilir). Fark örneği s41 C2: F6 (01.03, vade 30.06), ödeme 01.04 40.000,
    F7 (10.05, vadesiz) → ANINDA: 11.05'te gecikmiş 40.000; HAVUZ: 0 (ödeme F7'ye kayar, F6 açık ama vadesi gelmemiş). Kullanıcıya / baş mimara (para + "kime hatırlatma"; ders 43).
24. **YENİ — "Bağlar önce" ile anında okuma:** bağ (Mahsup Et, Kapatılacak Fatura, iade, kart tahsilatı) hedefi daha önce bağsız bir kalemle kapanmışsa model o bağsız
    kapanışı geri alır (serbest kalan kalem yeniden dağıtılır; s39 Mahsup Et). Metin bunu açıkça yazmıyor; §1 adım 3'ten türetildi.
25. **YENİ — M4 aynı gün sırası:** EK-1 "Önceki Yıl Sonucu Fişleri → N-01 → N-02" der; G-4 (tarih → sınıf → yazım sırası) N-01'i (dönem sonu sınıfı) kapanış sınıfındaki
    önceki yıl fişlerinden ÖNCE sıralar. Model G-4 (bakiye etkisi yok; yalnız yevmiye / büyük defter satır sırası).
26. **YENİ — 570.Y / 580.Y alt hesabı** ("önerilir"): model düz 570 / 580 (ana hesap tutarı aynı).
27. **YENİ — devir net kalan satırı** (avans / fazla ödeme; "vadesi önemsiz"): model birleştirilen en eski açık alacağın vade / tarih / sırasını kullanır.
28. **YENİ — değişmez (4)'ün sınırı (BİLİNEN SINIR):** K sonrası bir bağ, K'de bağsız kapanmış ≤K kaleme yönelirse devirsiz dosyada geri alma yapılır, devirli dosyada G2
    "arşiv başvurusu" ile bağsız kalır. Alacak yönlü bağda (tahsilat → fatura) borç tarafı iki dosyada eşit kalır (serbest kalan = bağsız kalan tutar); borç yönlü bağda
    (alış faturasına bağlı ödeme, K sonrası Mahsup Et) açık borç kalemlerinin vadesi ayrışabilir. Rastgele 3 tohumda görülmedi; elle senaryo yok.
29. **YENİ — S3 kapsamı:** model TUTAR bazında: şüpheli tutar hatırlatmaya girmez, aynı carinin CH'deki gecikmiş borcu otomatik listede kalır (s42 h1); "şüpheli
    kaydı olan cari otomatik listeden tümüyle çıkar" okuması da mümkün ("kime hatırlatma" → kullanıcı, ders 45).
30. **YENİ — K3 + TYK birleşimi:** şüpheliden düşen tahsilat CH kuyruğuna girmez → Mevcut Borcu Taksitlendir kartının taksit tahsilatı şüpheliden düşünce kartın CH'deki
    taksiti açık kalır ve gecikmiş olur (s52 C3: 3.000). İki karar metninin (plan §3.11b/2 (c), EK-1 M1e) birleşimi; açıkça yazılmamış.
31. **YENİ — K3 olay dili:** karşılık / değersiz / çıkar için kayıt verilmezse model: karşılıkta en eski (karşılık yeri olan) açık kayıt, değersiz ve çıkarda carinin bütün
    açık kayıtları. "Hesapsız (Açılıştan Önce)" tahsilatı ve Kredi Kartına İade (T-11) de "tahsilat" sayıldı (şüpheliden düşer); "kapatılan kartın vazgeçilen kalanı"
    KG-23 A'da madde üretmediği için uygulanmadı.
32. **YENİ — kart alttaki borçtan büyükse** (fatura kartı / Mevcut Borç kartı): model farkı "kart_fark" alacak kalemi yapar (Σ açık = CH korunur); senaryo yok.
33. **YENİ — kasa açılışının tarihinin ilk hareketten SONRAYA düzeltilmesi:** M-01 "ilk hareketten önce" düzeltmede de geçerli mi yazılı değil; model reddetmez (s53 yalnız
    öne alma).
34. **YENİ — Kesin Değil "ARALIK_KDV_MAHSUBU_YAPILMAMIS":** model, dönemi t'nin yılından önceki HER ayda kalmış 191 / 391 için koyar (yalnız Aralık değil; s04 Mayıs).
35. **YENİ — silinen faturaya bağlı taksit kartı:** karar "taksit … etkileri geri alınır" der; model fatura kartını kaldırmaz (alttaki fatura yok → kart_fark). Senaryo yok.

## DENENMEYEN / BİLİNEN SINIRLAR (modelin)
- Programla karşılaştırma (sürücü ayrı ajan). Kod hiç okunmadığı için alan adları / uç noktalar sürücüde eşlenir.
- B dallarının elle değerleri kısmi ve geçersiz; KG-13 B, KG-18 B, KG-19 B, KG-20 (valörden sonra), KG-24 B kurulmadı; S1–S5'in B dalları kurulmadı.
- 2.4.9 donmuş defterinin gerçek 2.4.9 çıktısıyla aynılığı (model 2.4.9'u plan cümlelerinden kurar; 2.4.9'da şüpheli K3 dahil; fark testi eski sürümün gerçek koduyla yapılmalı — ders 17).
- Dosya düzeyi devir mekanizması (kopyada üret + takas, bakım kipi, kalıcı devir yedeği, şema kapısı, arşiv kaydı), e-Belge numara tabanı ve sıra-tarih reddinin
  kendisi (model numara tutmaz; yalnız senaryo hijyeni), gelen kutusu, WhatsApp gönderimi, iki şirket, yetki, Defter Türü ekranı, hacim bütçesi — modelde dosya / süreç yok.
- Zincirleme ikinci yıl devri ve "yalnız EN SON arşiv yenilenir" kuralı senaryoda yok; arşivlenmiş yıldaki kural farkının yeni yıla taşınması (M7 son cümlesi) senaryoda yok.
- Devri Geri Al'ın kesim sonrası kayıtları taşıması 2.5.1 (model: devirden sonraki kayıtlar kaybolur, s29 BİLİNEN SINIR olarak gösterir).
- M8: KDV İndirim Dönemi üst sınırı (KDVK 29/3), M14: KDVK 30 indirilemeyecek KDV, VUK 313 haddi — modellenmedi.
- POS valörü üreticide yalnız hafta sonu kaydırması (resmî tatil yok); banka transfer valörü kaydırılmaz.
- K3: kabul §2 C / F / G / I–Y satırlarının çoğu (süreç, yetki, istek kimliği, eski sürüm) modelde yok; şüpheli caride borç satırları (ödeme / H-05) K3'e girmez.
- F-17, S-08 modellenmedi (yukarıda).

## Kâhin bakımı 2 (05.11.2026, kodu görmeyen ajan; EK-2 / EK-2B + kullanıcı kararları 05.11 21:08 ve 21:30)

### Kaynaklar ve bağımsızlık
- Okunan: `CLAUDE.md`, `docs/BAGIMSIZ-DOGRULAMA-PRENSIBI.md`, bu klasörün tamamı, `docs/erp/MUHASEBELESTIRME-KURAL-KITABI.md`, `…-EK-1.md`, `…-EK-2.md`,
  `…-EK-2B.md`, `docs/erp/MUHASEBE-CEKIRDEGI-PLANI.md`, `docs/devir/DEVIR-PLANI.md` (G, §0, §1, §4, §11, G14), `docs/2.5.0-IS-LISTESI.md` satır 1–80 ve 129–201 (A, C, D).
- Kural sırası: kullanıcı kararları (iş listesi D, 21:08 S7 / S8 ve 21:30 (1)–(7), AYNEN) → EK-2B (23, 24, 28, 32, 33, 35, K-2, K-3) → EK-2'nin geçerli maddeleri
  (25, 26, 27, 29, 30, 31, 34, 36–40, K-1, E11–E25, §4'ün 15 değişmezi). EK-2'nin 23 / 24 / 28 / 32 / 33 / 35 / K-2 / K-3 metinleri ve onlardan türeyen E11, E12, E18, E20, E24,
  E25 ile §4 (2), (3), (7), (8), (9) değişmezleri EK-2B ve kullanıcı kararlarıyla ÇELİŞTİĞİ yerde EK-2B / karar uygulandı (aşağıda her biri yazılı).
- `server/`, `client/`, `tools/` (yalnız `tools/kanit.mjs kos` ÇALIŞTIRILDI), `bulut/`, `docs/kanit/` (kendi kanıtları dışında), öteki `test/` klasörleri (sürücü dahil), git geçmişi /
  farkı OKUNMADI. Program çalıştırılmadı. Tam okuma / arama listesi ajan raporunda.

### Kural başına yorum (önce yorum, sonra kod)
| # | Kural (kaynak) | Kâhin yorumu | Senaryo / test | Mutant |
|---|---|---|---|---|
| R1 | 23 = A (karar (1); EK-2B 23): bağsız ödeme KENDİ TARİHİNDE (o gün dahil) açık borçlara S2 sırasıyla; sonradan doğan borca kaymaz; aynı gün önce borç kalemleri | Kuyruk olay sırası: tarih → defter sınıfı → K3 gün sınıfı → **taraf sınıfı** (0 borç satırı, 1 kart açılışı, 2 alacak satırı / bağ / Mahsup Et, 3 Kartı Kapat) → giriş sırası. Kart açılışı aynı günün borcundan SONRA, alacağından ÖNCE ("kart açıldığı günkü borcu taksitlendirir", kılavuz; sıra EK-2B'de yazılı değil → yorum) | s54, s41 C2, birim `test_R1_sonradan_dogan_borc_dagitimi_degistirmez` | B01 |
| R2 | 24 = A (karar (2); EK-2B 24): bağ hedefini her durumda kapatır; hedefi önceden kapatmış bağsız ödeme serbest kalır ve KENDİ TARİHİNDE yeniden dağılır | Rezervli yeniden oynatma: bağ (Kapatılacak Fatura, iade → asıl fatura, Mahsup Et, kart tahsilatı, fatura kartı açılışı) hedefinde bağsız kapanmış kısım bulursa o kısım hedefte bağ için AYRILIR ve kuyruk baştan oynatılır; bağsız ödemeler ayrılmış kısmı almaz, kendi günlerinde başka açık borçlara gider (eski model serbest kalanı bağ gününün açık borçlarına dağıtıyordu) | s55, `test_TYK_bag_hedefin_bagsiz_kapanisini_geri_alir`, s39 | B02, N25 |
| R3 | 28 = A (karar (3); EK-2B 28): kilitli / devredilmiş dönemde bağsız ödemeyle kapanmış kalem kilitten sonraki bağla yeniden açılmaz; bağ bağsız gibi dağılır, program kayıtta yazar | Tarihi > L (dosyanın kilidi; devirde K) olan bağ, tahsis tarihi ≤ L olan bağsız kapanışı geri ALMAZ; tahsis tarihi = eşleşmenin olduğu gün (ödemenin tarihi değil). Geri alınamayan kısım `kilit_bag_notu` raporunda. M2 karşılaştırması devirli ↔ AYNI kilitli (L = K) devirsiz dosya (EK-2B §5.3) | s56 (kilitli + devir + açık dönem karşılığı) | B03 |
| R4 | 2B-S3 = A + 32 (a) (karar (4); EK-2B 32): iade borçtan düşülünce / kartın faturası iptal-silinince kart küçülür, vadesi en önce gelen açık taksitten; aşarsa fazlası avans; paralı iadede kart değişmez; "kart_fark" yok | Asıl faturası bir kartça tüketilmiş iade önce faturanın açık kısmını, sonra kartı (en erken açık taksitten) küçültür; Mevcut Borç / fatura kartı alttaki borçtan büyük kalırsa açılışta en erken taksitlerden küçülür. Paralı iade olay dilinde `para_iadesi` (iade + T-09 ödeme tek olay; iade kendi ödeme satırına bağlı) | s57, s58 C2 | B04, B05, B06 |
| R5 | K-2 = A "Bakiyeden Netleşsin" (karar (5); EK-2B K-2) | Kuyrukta alış faturası satış borcuna kendi tarihinde uygulanır (EK-1 §1 aynen; gecikmiş ≤ net borç). **Fatura durumu** (`acik_faturalar`) ayrı görünümle: karşı yönlü iki fatura birbirini bağsız kapatmaz, yalnız Mahsup Et | s59 | B07, B08 |
| R6 | K-3 = A "Borçta Kalsın" (karar (6); EK-2B K-3): Kartı Kapat yalnız planı bitirir, kalan borçta, ertesi gün gecikmiş; önceden kapatılmış kartlar olduğu gibi kalır | Yeni kapama madde yok (M1d aynen). Olay dilinde `eski: true` = 2.5.0'dan önce kapatılmış kart: B 689 / A CH (2.4.9 davranışı, EK-2B'nin aktardığı plan metinlerinden; K3'te önce 128), kalan kuyrukta borç değil. Donmuş 2.4.9 türetmesi bütün kapamaları 689 sayar | s60, s40 | B09 |
| R7 | Devri Yenile (karar (7)): yalnız devrin ürettiği fişler silinip yeniden yazılır; yevmiyede tek açılış fişi | Devrin bütün açılış maddeleri `fis_grubu = devir_acilis:<devir>` taşır; değişmez `tek_acilis_fisi`: yeni yılda devir kaynakları = son üretimin kaynakları, N-13 fişi en çok bir | s28 | B10, M23 |
| R8 | 33 (EK-2B 33): Kasa açılışı ilk Kasa hareketinden sonraya düzeltilemez; aynı gün izinli; öne alma serbest | `duzenle` kasa açılışının tarihini ilk açılış dışı Kasa hareketinden SONRAYA alırsa KASA_ACILIS_SONRA, hiçbir şey değişmez. Değişmez `kasa_acilis_ilk` | s53 | B11 |
| R9 | 35 (EK-2B 35): faturanın kendi kartı faturayla kalkar; silmede tahsilatlı kart engeller; iptalde tahsilat avans; Mevcut Borç kartı dalı R4'e bağlı | Kaynağı silinmiş / iptal edilmiş faturanın kartı hiç kurulmaz; silme FATURA_SIL_TAHSILATLI_KART ile reddedilir; iptalde kart tahsilatının bağı boşa düşer (avans). Rapor `kartlar` | s58 | B12, B13 |
| R10 | 25 (EK-2; E13): K günü sıra Önceki Yıl Sonucu → N-01 → N-02 … | Yeni defter sınıfı kodu **4 = önceki yıl sonucu**, sıra değeri olağan (1) ile dönem sonu (2) arası; Gelir Tablosu dışı. Değişmez: önceki yıl fişlerinden sonra 153 = DSS_(K−1) + K yılı 153 hareketleri; K günü tür sırası | s47 `yevK` | B14 |
| R11 | 26 (EK-2): 570.YYYY / 580.YYYY; eşleştirmede yıl yoksa .0000 | Önceki Yıl Sonucu Fişi `570.<Y>` / `580.<Y>`; Açılış Eşleştirme'de düz "570" / "580" → `.0000`. Değişmez: her 570.Y = R_Y, 580.Y = −R_Y | s47, s25, s31 | B15 |
| R12 | 27 (EK-2): devir net kalan satırının tarih / vade seçimi sonucu değiştirmez | Değişmez `m27_net_satir` (net satır K+1 / en önce sıralanmış hâliyle yeniden kurulan kuyruk aynı gecikmiş ve açık borç listesini verir); ekstre toplam satırları vadesiz | s46, s21 | B16 |
| R13 | 29 + S7 = A (karar 21:08): şüpheli kaydı açık müşteri otomatik hatırlatmaya girmez; etiketle görünür, elle seçilirse şüphelisiz gecikmiş | `hatirlatma`: otomatik yalnız 128 = 0 olan cariler; `supheli_etiketli` liste aynen; yeni `elle` {cari: şüphelisiz gecikmiş}. Açık kayıt = 128 > 0; kapanınca listeye döner | s42 (h1, h3) | N05 yerine B17 |
| R14 | 31 (EK-2): karşılık / değersiz / çıkar kayıt başına; olay dili kaydı taşır; kayıtsız varsayılan kaldırılır | `karsilik_ayir`, `degersiz_yaz`, `supheliden_cikar` olayında `kayit` zorunlu (yoksa senaryo hatası); Hesapsız (Açılıştan Önce) ve Kredi Kartına İade alacak satırıdır (değişmedi) | s15, s27, s42, s50, s52, üretici, birim | B18 |
| R15 | 34 (EK-2; E19): "Önceki Yıl KDV Mahsubu Yapılmamış" + ay listesi; t'nin yılı yalnız bilgi | Kesin Değil kodu `ONCEKI_YIL_KDV_MAHSUBU_YAPILMAMIS:<ay>` (her ay ayrı); bilanço `bilgi` listesinde `KDV_MAHSUBU_YAPILMAMIS:<ay>` (t'nin yılında biten, mahsupsuz ay) | s04 | B19 |
| R16 | 36 (EK-2; E14): 127 "Diğer Ticari Alacaklar", I.C; alacaklı 127 → III.D 340, kart (alt hesap) bazında brüt | Hesap planına 127; TERS 127 → III.D | s62 | B20 |
| R17 | 37, 38 (EK-2; E16, E17): Kasa girişi 649.90; belgeli gider türü boşsa 770, eşlemede olmayan değer 770.90 | `gider_turu` yok / boş → 770; bilinmeyen değer → 770.90 (KARAR GEREKİYOR 19 kapandı) | birim F06, s22 | N26 yerine B21 |
| R18 | 39 (EK-2; E15): hesap adı "Eşleştirilecek Açılış Bakiyeleri" ("(Geçici)" yalnız Bilanço satırında) | HESAPLAR adı düzeltildi; bilanço kalem adı aynen | birim | B22 |
| R19 | 40 (EK-2; kitap N-06): 691 → 692; 692 = 690 − 691 | N-06: B 690 / A 692 (kâr) + 691 ≠ 0 ise B 692 / A 691; N-07 692'nin neti | birim `test_N06_691_692ye_kapanir` | B23 |
| R20 | K-1 + S8 = A (karar 21:08; EK-2 K-1, E22): karşılıksız evrakla yeniden açılan fatura kendi vadesiyle gecikir; taksit kartı tahsilatı olan evrakta M1c | Kuyrukta karşılıksız / iade, evrakın tahsilat (cirodaysa tedarikçideki ciro ödemesi) kalemini geri alır; kapattığı kalemler kendi vadeleriyle açık, öteki bağsız ödemeler kendi günlerinde yeniden dağılır; K3'le 128'e düşen kısım ayrı kalem (vade karşılıksız günü). Taksit kartı tahsilatı evrakta M1c aynen | s61, s40 | B24 |
| R21 | EK-2 §4 değişmezleri | (1) aynı gün yazım sırası karıştırılınca gecikmiş ve vade bazında açık borç aynı (birim); (2) R1 birimi (karar (2) yüzünden "bağ hariç": sonra gelen bağ önceki dağıtımı değiştirebilir); (3) R3 ile M2 istisnasız; (4) R12; (5) R10; (6) tyk; (7) `kart_alttaki_borc` (tyk); (8) `kasa_acilis_ilk`; (9) `kaldirilan_kart` (tyk); (10) R14; (11) R19; (12) R16; (13) R11; (14) R15; (15) s61 | — | — |

### Değişen eski beklentiler (eski → yeni, nedeni)
- `test_F06_M14_gider_turu_esleme`: gider türü yazılmamış 770.90 → 770 (R17). `s22`: `mz_arsiv/satirlar/770.90/borc` 70000 → 0, `770/borc` 0 → 70000 (R17).
- `s04`: `bil_yeni/kesin_degil` "ARALIK_KDV_MAHSUBU_YAPILMAMIS" → "ONCEKI_YIL_KDV_MAHSUBU_YAPILMAMIS:2026-05" (R15); yeni `bil0630/bilgi`.
- `s25`, `s31`, `s47`: 570 / 580 satırları yıl alt hesabına: `570` → `570.2025` (s25, s47), `580` → `580.2024` (s47), eşleştirmedeki `570` → `570.0000` (s31); ana hesap tutarları
  aynı (`mz/ana/570`) (R11).
- `s40`: `g8` (C3, 01.04) 30000 → 0 (çekle kapanan F2 karşılıksızla yeniden açılır, vadesi 30.06; R20); yeni `g8b` (01.07) 30000.
- `s42`: `h1/otomatik` {C1 30000, C3 20000} → {C3 20000}; yeni `h1/elle/C1` 30000, `h3` (R13).
- `s53`: `redler` [KASA_ACILIS_TEKRAR] → [KASA_ACILIS_TEKRAR, KASA_ACILIS_SONRA] (yeni olaylar; R8).
- `s15`, `s27`, `s42`, `s50`, `s52`, `test_J04`: şüpheli olaylarına `id` / `kayit` eklendi; sayılar aynı (R14).
- Tohumlu senaryolar: üretici değişti (kayıt kimliği, devirsiz koşu L = K) → `rastgele-*.json` ve beklenenleri yeniden üretildi (sayı değil, değişmez denetlenir).

### KULLANICIYA SORULMALI / KÂHİN SUSUYOR (kodlanmadı ya da yalnız gözlem)
1. **S8 ↔ kilit (KULLANICIYA SORULMALI; para + kime hatırlatma):** çek / senet kilitli (ya da devredilmiş) dönemde faturayı kapattı, kilitten SONRA karşılıksız döndü. A (öneri): karar (3)'ün
   ilkesiyle kilitli dönemdeki kapanış değişmez — fatura yeniden açılmaz, karşılıksız tutar ayrı borç (vade karşılıksız günü, M1c); devirli ve devirsiz dosya aynı sonucu verir. B: S8 harfiyen —
   fatura kendi vadesiyle yeniden açılır; devirli dosyada fatura arşivde olduğu için devir "evrakın kapattığı kalemleri" ayrıca taşımalı (D4'e iş), yoksa M2 bozulur. KÂHİN: bu durumda
   kuyruk ayrı kalem kurar ama sonucu kural saymaz (`kahin_susuyor` listesi, `gecikmis` raporunda); hiçbir senaryo bunu ölçmez.
2. **Kasa açılışından ÖNCE tarihli yeni Kasa hareketi (KULLANICIYA SORULMALI; Kasa tutarı):** EK-2B 33 notu "kural metni yok". A (öneri): banka gibi reddedilir. B: bankadaki
   "Hesapsız (Açılıştan Önce)" gibi karşılığı 519. Model reddetmiyor; değişmez `kasa_acilis_ilk` böyle bir hareketi HATA sayar (senaryo yok).
3. **Fatura durumunda Alacak Yaz / Borç Yaz (sunum, baş mimar):** 2.0.17 "borç kaydı ödeme sayılmaz … satış tarafında simetrik" ifadesi Alacak Yaz'ın satış faturasını kapatıp kapatmadığını
   açık bırakıyor. Model: karar (5) yalnız karşı yönlü FATURA eşleşmesini Mahsup Et'e bağladı → Alacak Yaz fatura durumunu kapatır (eski beklentiler korunur). Gecikmişi değiştirmez.
4. **Aynı gün sırası (R1) — kart açılışı / J-01:** EK-2B "aynı gün önce borç kalemleri" der; kart açılışının ve Şüpheliye Al'ın aynı günün ödemesine göre yeri yazılı değil. Model: kart açılışı
   borçtan sonra, alacaktan önce; J-01 (2.3.0 K3 gün sırası) en başta. Ayrışırsa önce hata (ders 6).
5. **Mevcut Borç kartı / J-01'in gelecekteki bir bağa ayrılmış kısmı tüketmesi:** model önce ayrılmamış kısımdan tüketir, yetmezse ayrılmışı da (bağın fazlası bağsız olur). Yazılı kural yok; senaryo yok.
6. Eski kapama (R6 `eski`): kalan = kart toplamı − taksit tahsilatları (Excel'de önceden ödenen dahil); kartın iadeyle küçülmüş kısmı hesaba girmez (2.4.9 kodu görülmedi — DOĞRULANMADI).
7. Sürer: 16 (POS komisyonu 653), 17 (valörden sonra komisyon iadesi), 22 (Kesin Değil metinleri).

### Yeni senaryolar ve mutasyonlar
- Yeni elle senaryolar: s54 (R1), s55 (R2), s56 (R3), s57 (R4), s58 (R9 + R4 Mevcut Borç), s59 (R5), s60 (R6), s61 (R20), s62 (R16). Beklenenler model değiştirilmeden ÖNCE yazıldı
  (ilk commit), hesaplar senaryoda yorum satırında.
- Yeni birim testleri: R1 (2. değişmez), R19 (691), R18 (ad), R14 (kayıtsız olay senaryo hatası), §4 (1) aynı gün karıştırma, değişmez denetçilerinin dişi (tek açılış fişi, m27).
- Mutantlar B01–B24 (mutasyon.py'de adlarıyla); N05 ve N26 eski davranışın yeni kuralla doğru hâline döndüğü için TERSİNE çevrildi (B17, B21); kodu değişen eski mutantların metni yeni koda taşındı.

### Sürücü için (programla karşılaştırmadan önce)
- Yeni / değişen olay alanları: `satis_iade_faturasi.para_iadesi` ("nakit" | "havale" + `banka`) = iade + müşteriye para iadesi; `stok_musteri_iadesi.taksit_karti` (borçtan düşülen stok
  iadesi kartı küçültür); `taksit_kapat.eski` (2.5.0'dan önce kapatılmış kart — göç verisi); `karsilik_ayir` / `degersiz_yaz` / `supheliden_cikar` için `kayit` ZORUNLU (supheliye_al `id`'si).
- Yeni red kodu `FATURA_SIL_TAHSILATLI_KART` (silme); `KASA_ACILIS_SONRA` artık düzeltmede de.
- Yeni raporlar: `kartlar {cari, tarih}` → {kart: {kapali, taksitler [vade, tutar, kalan]}}; `kilit_bag_notu {cari, tarih}` → [{kaynak, hedef, tutar, tarih}] (programın "Bu fatura kilitli
  dönemde kapanmış…" iletisi); `acilis_fisleri {tarih}` → açılış fiş grupları. `hatirlatma` → ayrıca `elle`. Bilanço → ayrıca `bilgi`.
- Değişen çıktı: yevmiye madde sınıfı `4` = önceki yıl sonucu (sıra: olağan ile dönem sonu arası); devir açılış maddelerinde `fis_grubu`; Kesin Değil `ONCEKI_YIL_KDV_MAHSUBU_YAPILMAMIS:<ay>`;
  570.YYYY / 580.YYYY; satır ekinde `evrak_kaynak`, `kart_tahsilati`, `ciro_kaynak` (kâhin içi; programla eşlenmez).
- Fatura durumu (`acik_faturalar`) gecikmiş kuyruğundan AYRI görünüm (R5); gecikmiş, açık kalemler ve devir yine Tek Yükümlülük Kuyruğu'ndan.
- M2 karşılaştırmasında devirsiz koşu kilitli (L = K) olmalı (R3); tohumlu üreticinin `devirsiz()`'i düzeltmelerden sonra `donem_kilitle K` ekler.

### DENENMEYEN (bu bakım)
- Programla karşılaştırma (sürücü güncellemesi ayrı iş). Gerçek 2.4.9 verisiyle eski kart kapaması (R6 `eski`) ve donmuş 2.4.9 kapama türetmesi.
- Hedefi bağdan SONRA doğan bağ (geriye tarihli fatura): model bağı bağsız sayar; senaryo yok.
- Kilit kaldırma olayı modelde yok (R3'ün "kilit kaldırılınca kural kalkar" kısmı yalnız kilitsiz eş cariyle gösterildi).
- Devri Yenile'nin "tek açılış fişi" kuralı fiş grubu düzeyinde; programın fiş numarası / tek kayıt biçimi sürücüde eşlenir.
- KG-13 B (vergi karşılığı) yok; 691 yalnız birim testinde elle verilen fişle.
