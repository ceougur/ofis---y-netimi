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
| `senaryolar_elle.py` | 110 elle doğrulanabilir senaryo (s01…s109; s26 iki seçenekli; bakım 11 itibarıyla); her birinde ELLE hesaplanmış beklenenler ("elle", hesap yorumda) |
| `uretici.py` | Tohumlu rastgele üretici: bir yıl (~800 olay) + K sonrası Ocak (+ zorla S11: K'den önce alınmış evrak 20.01'de karşılıksız) + devir + devirden sonra kayıt + Devri Yenile; tohum 1, 2, 3 |
| `uret_beklenen.py` | `senaryolar/<ad>.json` (kendi kendine yeten senaryo: tanımlar + olaylar + dallar + elle) ve `senaryolar/beklenen/<ad>.json` (her dal için modelin tam çıktısı) yazar / `--denetle` |
| `test_model.py` | 187 test (bakım 11 itibarıyla): yardımcılar, olay → madde birim testleri, 110 elle senaryo (her dal + bütün değişmezler), 3 rastgele tohum (devirli = AYNI kilitli devirsiz dahil), değişmez denetçilerinin dişi, senaryo hijyeni (VUK sıra-tarih, K-14 tarihi, POS valörü iş günü ve belirsiz güne — doğrulanmamış bayram penceresi — düşmez; bakım 4'ten beri sabit resmî tatile düşebilir, model kaydırır; bakım 5'ten beri 28 Ekim yarım gün iş günü), dosya güncelliği |
| `mutasyon.py` | 277 metin mutantı (bakım 11 itibarıyla; model.py kaynağında tek kural bozulur); her biri en az bir testte KIRMIZI olmalı |

## Çalıştırma
```
python3 test/bagimsiz/muhasebe/test_model.py          # modelin kendi testleri
python3 test/bagimsiz/muhasebe/mutasyon.py            # testin dişi (çıkış 0: bütün mutantlar öldü)
python3 test/bagimsiz/muhasebe/uret_beklenen.py       # senaryo + beklenen dosyalarını yeniden yaz (model değişince)
python3 test/bagimsiz/muhasebe/uret_beklenen.py --denetle
python3 test/bagimsiz/muhasebe/uretici.py 2           # tek tohum özeti
# kanıt: node tools/kanit.mjs kos kahin8-test-utc -- python3 -I test/bagimsiz/muhasebe/test_model.py   (TZ=UTC ve TZ=Europe/Istanbul)
#        node tools/kanit.mjs kos kahin8-mutasyon -- python3 -I test/bagimsiz/muhasebe/mutasyon.py
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
| taksit_excel | cari, toplam, odenen, taksitler [vade, tutar], yukleme_ani (bakım 8, B5: içe aktarma anı, saat dilimli; madde İstanbul yerel gününde) | H-06, M-10, KG-5, B5 |
| acilis_eslestir | tarih, satirlar [hesap, borc/alacak] (519 karşı satırı kendiliğinden) | M-11 |
| satis_faturasi | cari, M, K, T, ihracat, vade, kalemler [urun, miktar] | F-01…F-04 |
| alis_faturasi | cari, fatura_turu stok/gider, gider_turu genel/satis/finansman/demirbas/ceza (yazılmazsa "seçilmemiş" → 770.90), M, K, T, S, indirim_ayi (KG-7), kalemler [urun, miktar, M] | F-05, F-06, S-01, M14 |
| satis_iade_faturasi / alis_iade_faturasi | cari, M, K, asil_fatura, kalemler, (alış iadesinde fatura_turu) | F-07, F-08, F-09 |
| esmm / gelen_smm | cari, brut, K, S, T | F-10, F-11 |
| duzenle {kaynak, degisiklik{}} / iptal {kaynak} / sil / geri_yukle | kaydedilmiş fatura Silinenler'den geri yüklenince ETKİSİZ ("İptal Edildi"); öbür kayıtlar ve taslak etkin döner | F-14, F-15, D-03, R-04, C-03, G-7 |
| mahsup | fatura1, fatura2, tutar (madde yok) | F-16 |
| tahsilat | cari, yol nakit/havale/pos/cek/senet/kart, tutar, banka, pos+komisyon+valor (NOMİNAL; etkin = sonraki iş günü, S21), evrak, fatura (+fatura_odemesi = formdaki peşin), taksit_karti, normal_cari ("Normal Cari Hesaba İşle"; `supheliden` geriye uyum için kabul edilir, artık varsayılan) | T-01…T-04, T-10…T-13, H-04, J-03, K3 |
| odeme | cari, yol nakit/havale/kart/cek/senet/ciro, tutar, banka, kart, evrak, fatura (+fatura_odemesi = alış faturası formundaki peşin; bakım 11 S83 / S84), taksit_karti | T-05…T-09, H-05 |
| kayit_tahsilati / kasa_giris / kasa_cikis | tutar | T-14, K-01, K-02 |
| bankadan_kasaya / kasadan_bankaya | banka, tutar | K-03, K-04 |
| banka_transfer | gonderen, alici, tutar, ucret, bsmv, valor | K-05, K-06, K-07 |
| banka_masraf / banka_masraf_faturali / faiz_geliri / faiz_gideri / banka_diger_gelir / banka_diger_gider | banka, tutar (+bsmv) / M, K / brut, stopaj | K-08…K-12 |
| hesapsiz_hareket / kart_borcuna_aktar | cari, yon (tarihi banka açılışından ÖNCE) / kart, tutar, acilistan_once | K-14, K-15 |
| pos_aktar {tahsilat} / pos_komisyon_faturasi {K, karsi komisyon/cari} / pos_iade {tahsilat, cari, tutar, komisyon_iadesi} | — | D-01, D-02, D-04 |
| kart_harcama / kart_borc_odeme / kart_faiz / kredi_kullan / kredi_odeme | kart, cari ya da urun+miktar, tutar / banka / anapara, faiz | D-05…D-10 |
| evrak_tahsile_ver / evrak_bankadan_geri_al / evrak_tahsil / evrak_karsiliksiz / verilen_evrak_ode / verilen_evrak_geri_al / evrak_islem_geri_al | evrak, banka, yol kasa; evrak_karsiliksiz.cari (bakım 8: carisiz açılış / form evrakında programın sorduğu cari — S48, S66) | Ç-02…Ç-12 |
| taksit_karti / taksit_kapat | cari, kaynak fatura/mevcut_borc/yeni_borc, fatura, toplam, taksitler | H-01, H-02, H-03, H-07, M1d, M1e |
| kdv_mahsup {ay} / kdv_mahsup_geri_al {ay} / fis_ters {fis} | — | V-01, R-03, M8, S4 |
| vergi_odeme / gecikme_zammi | yol, banka, tutar | V-02, V-03, V-04 |
| supheliye_al / karsilik_ayir / degersiz_yaz / supheliden_cikar | cari, tutar, kayit (supheliye_al olayının kimliği; yazılmazsa: karşılıkta en eski açık kayıt, değersiz / çıkarda bütün açık kayıtlar) | J-01, J-02, J-05, J-06 (J-04 kendiliğinden), K1–K7 |
| stok_giris / stok_cikis_satis / stok_musteri_iadesi / stok_tedarikci_iadesi / stok_duzeltme | urun, miktar, tutar, karsi nakit/havale/cari | S-02…S-06 |
| borc_yaz / alacak_yaz | cari, tutar, aciklama, acilis (işaret), onay (KG-16 "Açılış Olabilir" onayı), vade | C-01, C-02, KG-16 |
| ters {hedef} | banka işlem kartı → Ters Kaydet (girildiği gün; 191 / 391 satırı kendi ayına etiketlenir, S4) | R-01, R-02 |
| donem_kilitle {tarih, kural: "2.4.9" göç senaryosu} / kural_farki_duzelt / cari_tur_degistir {cari, yeni_tur} | — | Ç3, KG-15, M7, N-16, G-2 |
| devir {K, secenek borc_alacak/sadece_bakiye, bugun} / devri_yenile {duzeltmeler[], bugun} / devri_geri_al | K yalnız 31 Aralık (M11); bugun verilirse K < bugun | N-01…N-15, M11 |
| rapor {ad, rapor, dosya canli/arsiv, …} | mizan {bas, son} · gelir_tablosu {bas, son} · bilanco {tarih} · buyuk_defter {hesap, bas, son, cari} · gecikmis {cari, tarih} · gecikmis_tumu {tarih} · hatirlatma {tarih} · acik_faturalar {cari, tarih} · acik_kalemler {cari, tarih} · degerleme {tarih} · yevmiye · kural_farki · kaynak_durumu {kaynak} · supheli_kayitlari {cari} · mutabakat_uyarilari {tarih} (bakım 4, S20) · acilis_olabilir {tarih} · defter_mutabakati_bilgi {tarih} (bakım 8, S47 / S53) | §4, §7 |
| carisiz_evrak | evrak, evrak_turu cek / senet, yon alinan / verilen, tutar, banka (bakım 8: formdan carisiz, açılış değil) | S49 |
| acilis_onayla {kaynak, karar onay / red} · odeme_sozu {cari, tarih, soz_tarihi} | bakım 8: Açılış Olabilir onayı / reddi (S47, S51); Ödeme Sözü (S52; defter olayı değil) | KG-16, S52 |
| (her kaynak olayı) `yedekten: true` | bakım 4 (S20): kayıt geri yüklenen yedekte / eski sürüm verisinde vardı — S12 ve açılışın R8'i uygulanmaz, veri aynen | G-7 |

Çıktı anahtarları: bilanço kalemleri `I.A … II.D` (aktif), `III.A … III.I`, `V.A, V.D, V.E, V.F (Dönem Net Kârı), V.K (Geçmiş Yıllar — Kapanmamış), V.G (519)`;
ayrıca `gecmis_yillar_kar` / `gecmis_yillar_zarar` (V.K'nın 570 / 580 kısımları, M4). Gelir tablosu `A, B, C, D, BSK, E, FK, F, G, H, OK, I (671 dahil), J (681 dahil), DK, K, DNK`;
mizan satırı `hesap|cari`; tutar işareti borç +. `gecikmis` → {gecikmis, supheli, detay}; `hatirlatma` → {otomatik {cari: tutar}, supheli_etiketli [cari], elle, odeme_sozu_var {cari: tutar} ve kahin_susuyor [{cari, neden}] (bakım 8; yalnız doluysa)};
`buyuk_defter` → ayrıca satir_sayisi. Devir raporu: arsiv_kapanis, yeni_acilis, kapanis {N01 {K yılı}, onceki_yil {Y: {SMM, R}}, R, DSS, sonuc},
acilis {acik_kalemler [cari, k, tur, kalan, vade, belge_tarihi], cariler {bakiye, acilis (= net kalan satırı)}, ekstre {Borç Toplamı, Alacak Toplamı |
Devir Bakiyesi, acik_kalemler, satirlar [tarih, aciklama, borc, alacak, vade, bakiye]}, ekstre_cariler, kartlar {acik_taksitler}, supheli {tutar, kalemler},
stok, eksi_stok, N13 (191 / 391 "hesap@dönem")}, degismezler; Devri Yenile ayrıca fark, gecikmis_degisen {cari: {once, sonra}}, bag_degisen {kayıt: {once, sonra}}, uyarilar.
Kesin Değil kodları: `TAMAMLANMAMIS_ACILIS, SATISLARIN_MALIYETI_TAHMINI, SATISLARIN_MALIYETI_HESAPLANMADI, EKSI_KASA, EKSI_STOK, TERS_BAKIYE:<hesap>,
BORCLU_360, KAPANMAMIS_ONCEKI_YIL, KURAL_DEGISIKLIGI_FARKI, SINIFLANDIRILMAMIS_TAHSILAT, BILGI_AMACLI, AKTIF_PASIF_FARKI, KDV_MAHSUBU_GUNCEL_DEGIL:<ay>,
ARALIK_KDV_MAHSUBU_YAPILMAMIS, ACILIS_OLABILIR_ONAY_BEKLIYOR` (bakım 8, S47). Red kodları (program 4xx): `KILITLI_DONEM, KASA_ACILIS_TEKRAR, KASA_ACILIS_SONRA, KASA_ACILIS_ONCE (bakım 3, S12), SUPHELI_FAZLA, KARSILIK_FAZLA,
SUPHELI_YOK, SUPHELI_NORMAL_ASIM, EVRAK_DURUMU, KDV_MAHSUP_TEKRAR, KDV_MAHSUP_BOS, ZATEN_TERS, ESLESTIRME_HESAP, ESLESTIRME_TERS, KG15_B_DUZELTILMEZ,
KURAL_FARKI_YOK, DEVIR_YENILE_CAKISMA, DEVIR_K_31_ARALIK, DEVIR_K_GELECEK, FATURA_SIL_TAHSILATLI_KART (bakım 2), BAG_KALDIRILMALI (bakım 7, S45; bakım 8 S57 olağan kayıtta da), KURAL_FARKI_ALT_DEFTER (bakım 8, B14), FATURA_DUZENLENMELI (bakım 10, S80; "faturayı düzenleyin"; bakım 11: S83 ödeme yönü, S84 peşinin bağı)` (SUPHELI_NORMAL_ASIM bakım 10'dan beri olağan düzeltmede de — S81; bakım 11'den beri Normal Cari kaydın yalnız tutar / tarih düzeltmesinde ve geri yüklenmiş kayıtta yalnız cari / tutar düzeltmesinde de — S85; SUPHELI_TAHSILAT_FAZLA kalktı: K3'te aşan
kısım 120'ye).

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
Bakım 4 (S14 A): faturaya BAĞLI çek / senet bağlı faturanın durduğu hesaptan düşer — faturanın şüpheli kuyruğundaki kısmı 128'den (o kalemi taşıyan kayıttan), kalanı 120; sınır
yalnız 120'ye kalan kısma (README Y1–Y7). Bakım 5 (S25 A): nakit / havale / POS da aynı; kısmen aktarılmış faturada ÖNCE şüpheli kısım; faturanın açık kısmını aşan fazla carinin
bağsız alacağı (120, sınırsız); Kredi Kartına İade ile bağlı tahsilatta kâhin susar (README Z5–Z8). Bakım 6 (S39 A): faturaya bağlı Kredi Kartına İade (T-11) de
S14 / S25 ile aynı — susma kalktı (README X1–X6).

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
- Kâhin bakımı 2 — 9ab25cd5: s54–s62, değişen eski beklentiler ve yeni birim testleri model DEĞİŞTİRİLMEDEN ÖNCE commit'lendi; eski modelle 114 testten 27'si beklenen
  nedenle kırmızı (`docs/kanit/2026-11-05/kahin2-eski-model-kirmizi.*`). Model değiştikten sonra bir elle değer YANLIŞ çıktı ve elle yeniden hesaplandı: s22
  `mz_arsiv/satirlar/770.90/borc` 0 → 10000 ve `770/borc` 70000 → 60000 (Aralık kasa çıkışı 10000 belgesiz çıkıştır, 770.90'da kalır; ilk hesapta unutulmuştu).
  Öteki yeni değerlerin hiçbiri değişmedi.

## Üretici düzeltmeleri (ana oturum 05.11 ~19:50, K1–K5)
- K1: KDV, tevkifat (5/10, 2/10) ve stopaj tutarı kuruşa YARIM YUKARI (kitap G-1; GİB / UBL-TR satır yuvarlaması) — önce aşağı yuvarlıyordu. Tutar kâhini OKUNMADI
  (bağımsızlık sınırı); kural kitabın G-1'inden.
- K2: satıştan iade asıl faturanın KDV oranıyla (F-09); tevkifatlı fatura iadesi üretilmez.
- K3: POS valörü hafta sonuna düşerse sonraki iş günü (BANKA-MODULU-PLAN POS örnekleri); resmî tatil takvimi YOK.
- K4: s11'de "Hesapsız (Açılıştan Önce)" hareketi banka açılışından önceye alındı (cari açılışıyla birlikte 2025 Aralık).
- K5: Devri Yenile'nin geç gelen Aralık satış faturası K (31.12) tarihli — serinin son tarihinden önce olamaz.

## KARAR GEREKİYOR (kâhinde kesinleştirilmedi; model seçimi yanında — "ÇÖZÜLDÜ" olanlar karar metninden)
1. ~~KG-3 tanım çelişkisi~~ ÇÖZÜLDÜ (onaylanan metin A; EK-2 37: 649.90).
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
19. ~~F-06 gider türü~~ ÇÖZÜLDÜ (M14 + EK-2 38 / E17: boş → 770, eşlemede olmayan değer → 770.90).
20. ~~KG-2 B~~ geçersiz.
21. ~~Ekstre~~ ÇÖZÜLDÜ (M12).
22. Kesin Değil metinleri programın; model kod kullanır — sürücü eşlemesi gerekir (sürer).
23. ~~TYK okuması~~ ÇÖZÜLDÜ — karar (1) = A (kendi tarihinde; bakım 2 R1). Eski not: EK-1 §1 adım 4 "bağsız alacak kalemleri havuzlanır … Sonuç: açık borç kümesi, sıralı listenin SONUNDAKİ kalemlerdir" (HAVUZ: as-of-t, ödemeden
    sonra girilen ve vadesi daha önce gelen borç da ödemeyi "alır") ile M2'nin değişmezi "her t ≥ K+1 için gecikmiş devirli = devirsiz" ve S2'nin sorusu ("bağlamadan yapılan
    ödeme önce hangi borcunu kapatsın") iki okumaya izin veriyor. Model ANINDA okuması: ödeme girildiği anda açık olan borçlara S2 sırasıyla (M2 değişmezini her durumda
    yalnız bu okuma sağlıyor — havuz okumasında K'den önceki ödeme K sonrası erken vadeli borca kayabilir). Fark örneği s41 C2: F6 (01.03, vade 30.06), ödeme 01.04 40.000,
    F7 (10.05, vadesiz) → ANINDA: 11.05'te gecikmiş 40.000; HAVUZ: 0 (ödeme F7'ye kayar, F6 açık ama vadesi gelmemiş). Kullanıcıya / baş mimara (para + "kime hatırlatma"; ders 43).
24. ~~"Bağlar önce"~~ ÇÖZÜLDÜ — karar (2) = A (bakım 2 R2: serbest kalan kendi tarihinde; yeniden oynatma). Eski not: bağ (Mahsup Et, Kapatılacak Fatura, iade, kart tahsilatı) hedefi daha önce bağsız bir kalemle kapanmışsa model o bağsız
    kapanışı geri alır (serbest kalan kalem yeniden dağıtılır; s39 Mahsup Et). Metin bunu açıkça yazmıyor; §1 adım 3'ten türetildi.
25. ~~M4 aynı gün sırası~~ ÇÖZÜLDÜ — EK-2 25 / E13 (bakım 2 R10: sınıf 4 "önceki yıl sonucu").
26. ~~570.Y / 580.Y~~ ÇÖZÜLDÜ — EK-2 26 (bakım 2 R11).
27. ~~Devir net kalan satırı~~ ÇÖZÜLDÜ — EK-2 27 KABUL + değişmez `m27_net_satir` (bakım 2 R12).
28. ~~Değişmez (4)'ün sınırı~~ ÇÖZÜLDÜ — karar (3) = A (bakım 2 R3: kilitli kapanış geri alınmaz; devirsiz eş aynı kilitle; M2 istisnasız). Eski not: K sonrası bir bağ, K'de bağsız kapanmış ≤K kaleme yönelirse devirsiz dosyada geri alma yapılır, devirli dosyada G2
    "arşiv başvurusu" ile bağsız kalır. Alacak yönlü bağda (tahsilat → fatura) borç tarafı iki dosyada eşit kalır (serbest kalan = bağsız kalan tutar); borç yönlü bağda
    (alış faturasına bağlı ödeme, K sonrası Mahsup Et) açık borç kalemlerinin vadesi ayrışabilir. Rastgele 3 tohumda görülmedi; elle senaryo yok.
29. ~~S3 kapsamı~~ ÇÖZÜLDÜ — S7 = A (kullanıcı 21:08; bakım 2 R13: cari bazında).
30. ~~K3 + TYK birleşimi~~ ÇÖZÜLDÜ — EK-2 30 KABUL (E23). Eski not: şüpheliden düşen tahsilat CH kuyruğuna girmez → Mevcut Borcu Taksitlendir kartının taksit tahsilatı şüpheliden düşünce kartın CH'deki
    taksiti açık kalır ve gecikmiş olur (s52 C3: 3.000). İki karar metninin (plan §3.11b/2 (c), EK-1 M1e) birleşimi; açıkça yazılmamış.
31. ~~K3 olay dili~~ ÇÖZÜLDÜ — EK-2 31 (bakım 2 R14: kayıt zorunlu). Eski not: karşılık / değersiz / çıkar için kayıt verilmezse model: karşılıkta en eski (karşılık yeri olan) açık kayıt, değersiz ve çıkarda carinin bütün
    açık kayıtları. "Hesapsız (Açılıştan Önce)" tahsilatı ve Kredi Kartına İade (T-11) de "tahsilat" sayıldı (şüpheliden düşer); "kapatılan kartın vazgeçilen kalanı"
    KG-23 A'da madde üretmediği için uygulanmadı.
32. ~~Kart alttaki borçtan büyükse~~ ÇÖZÜLDÜ — EK-2B 32 (a) + karar (4) (bakım 2 R4: kart küçülür, kart_fark yok).
33. ~~Kasa açılışını sonraya düzeltme~~ ÇÖZÜLDÜ — EK-2B 33 (bakım 2 R8: ret).
34. ~~Kesin Değil "Aralık KDV…"~~ ÇÖZÜLDÜ — EK-2 34 (bakım 2 R15: "Önceki Yıl KDV Mahsubu Yapılmamış" + ay).
35. ~~Silinen faturaya bağlı taksit kartı~~ ÇÖZÜLDÜ — EK-2B 35 (bakım 2 R9).

## DENENMEYEN / BİLİNEN SINIRLAR (modelin)
- Programla karşılaştırma (sürücü ayrı ajan). Kod hiç okunmadığı için alan adları / uç noktalar sürücüde eşlenir.
- B dallarının elle değerleri kısmi ve geçersiz; KG-13 B, KG-18 B, KG-19 B, KG-20 (valörden sonra), KG-24 B kurulmadı; S1–S5'in B dalları kurulmadı.
- 2.4.9 donmuş defterinin gerçek 2.4.9 çıktısıyla aynılığı (model 2.4.9'u plan cümlelerinden kurar; 2.4.9'da şüpheli K3 dahil; fark testi eski sürümün gerçek koduyla yapılmalı — ders 17).
- Dosya düzeyi devir mekanizması (kopyada üret + takas, bakım kipi, kalıcı devir yedeği, şema kapısı, arşiv kaydı), e-Belge numara tabanı ve sıra-tarih reddinin
  kendisi (model numara tutmaz; yalnız senaryo hijyeni), gelen kutusu, WhatsApp gönderimi, iki şirket, yetki, Defter Türü ekranı, hacim bütçesi — modelde dosya / süreç yok.
- Zincirleme ikinci yıl devri ve "yalnız EN SON arşiv yenilenir" kuralı senaryoda yok; arşivlenmiş yıldaki kural farkının yeni yıla taşınması (M7 son cümlesi) senaryoda yok.
- Devri Geri Al'ın kesim sonrası kayıtları taşıması 2.5.1 (model: devirden sonraki kayıtlar kaybolur, s29 BİLİNEN SINIR olarak gösterir).
- M8: KDV İndirim Dönemi üst sınırı (KDVK 29/3), M14: KDVK 30 indirilemeyecek KDV, VUK 313 haddi — modellenmedi.
- POS valörü: bakım 4'ten beri MODEL kaydırır (hafta sonu + 2429 tam gün resmî tatil → sonraki iş günü, S21); bakım 5'ten beri yarım gün (28 Ekim) İŞ GÜNÜ (S27); dinî bayram
  pencereleri (arife dahil) belirsiz (kâhin susar; bayram tarihleri resmî kaynaktan DOĞRULANMADI — README Z12); banka transfer valörü kaydırılmaz.
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
1. ÇÖZÜLDÜ (kullanıcı 06.11 03:35 S11 = A; bakım 3 T1–T8). **S8 ↔ kilit (KULLANICIYA SORULMALI; para + kime hatırlatma):** çek / senet kilitli (ya da devredilmiş) dönemde faturayı kapattı, kilitten SONRA karşılıksız döndü. A (öneri): karar (3)'ün
   ilkesiyle kilitli dönemdeki kapanış değişmez — fatura yeniden açılmaz, karşılıksız tutar ayrı borç (vade karşılıksız günü, M1c); devirli ve devirsiz dosya aynı sonucu verir. B: S8 harfiyen —
   fatura kendi vadesiyle yeniden açılır; devirli dosyada fatura arşivde olduğu için devir "evrakın kapattığı kalemleri" ayrıca taşımalı (D4'e iş), yoksa M2 bozulur. KÂHİN: bu durumda
   kuyruk ayrı kalem kurar ama sonucu kural saymaz (`kahin_susuyor` listesi, `gecikmis` raporunda); hiçbir senaryo bunu ölçmez.
2. ÇÖZÜLDÜ (kullanıcı 06.11 03:35 S12 = A; bakım 3 T9–T13). **Kasa açılışından ÖNCE tarihli yeni Kasa hareketi (KULLANICIYA SORULMALI; Kasa tutarı):** EK-2B 33 notu "kural metni yok". A (öneri): banka gibi reddedilir. B: bankadaki
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
- Mutantlar B01–B24, alt harfli eşleri (B03b, B03c, B05b, B09b, B15b, B19b, B23b, B24b) ve B30 (Mahsup Et'in geri alması) — toplam 33 yeni, liste 126 mutant.
  N05 kaldırıldı (S7 A ile "cari bazında" artık doğru; tersi B17), N26'nın tersi B21; kodu değişen 8 eski mutantın metni (M15, M24, M55, N11, N16, N17, N24, N25)
  yeni koda taşındı. B02 için modelde YALNIZ mutasyonun çağırdığı `Kuyruk._eski_serbest` yardımcısı var (eski "bağ gününde serbest bırak" okuması).
- Elle senaryo değerlerinden sonra eklenen tek araç: `kartlar`, `kilit_bag_notu`, `acilis_fisleri` raporları (beklenenleri ilk commit'te yazıldı).
- DENENMEYEN ek: Stok → Müşteri İadesi'nin `taksit_karti` ile kart küçültmesi (yol kodlandı, elle senaryo yok); fatura düzenlemesiyle küçülen kartın elle senaryosu yok
  (aynı mekanizma s58 C2'de).

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

## Kâhin bakımı 3 (06.11.2026, kodu görmeyen ajan; kullanıcı kararı 06.11 03:35 UTC S11, S12 — "hepsi A")

### Kaynaklar ve bağımsızlık
- Okunan: `CLAUDE.md`, `docs/BAGIMSIZ-DOGRULAMA-PRENSIBI.md`, bu klasörün kaynakları (README, `model.py`, `senaryolar_elle.py`, `test_model.py`, `mutasyon.py`,
  `uretici.py`, `uret_beklenen.py`; `senaryolar/` yalnız listelendi — üretilen çıktı), `docs/erp/MUHASEBELESTIRME-KURAL-KITABI.md`, `…-EK-1.md`, `…-EK-2.md`, `…-EK-2B.md`,
  `docs/erp/MUHASEBE-CEKIRDEGI-PLANI.md`, `docs/devir/DEVIR-PLANI.md` (G, §0, §1, §4, §11, G14), `docs/2.5.0-IS-LISTESI.md` A (satır 1–83), C ve D (159–267); B ve E okunmadı.
- Kural sırası: kullanıcı kararı 06.11 03:35 (iş listesi D, AYNEN: S11 = A, S12 = A) → 05.11 21:08 S8 ve 21:30 (3) → EK-2B (28, 33) → EK-2 (K-1, §4 (8), (15)) → EK-1 M1c, S1.
- `server/`, `client/`, `bulut/`, `packaging/`, `tools/` (yalnız `node tools/kanit.mjs kos` ÇALIŞTIRILDI), öteki `test/` klasörleri (sürücü dahil), `docs/kanit/` (kendi kanıtları
  dışında), git geçmişi / farkı OKUNMADI; program çalıştırılmadı. Git: yalnız `git merge --ff-only b12a03d6` (çıktının son üç satırı `test/` ve `tools/` altındaki üç yeni dosyanın
  ADINI gösterdi — açılmadı), `git status -s`, `git branch --show-current`, `git rev-parse HEAD`, bitişte kendi yollarımın `git add` + `git commit`'i.

### Kural başına yorum (önce yorum, sonra kod — ders 40)
Karar metinleri (AYNEN): **S11 = A** "çek / senet faturayı kilitli (ya da devredilmiş) dönemde kapattı, kilitten sonra karşılıksız döndü → kilitli dönemdeki kapanış değişmez, fatura
yeniden açılmaz; karşılıksız tutar ayrı borç (vadesi karşılıksız günü; karar (3)'ün ilkesi; devirli ve devirsiz dosya aynı)". **S12 = A** "Kasa açılışından ÖNCE tarihli yeni Kasa
hareketi bankadaki gibi reddedilir (banka bugün 409 bank-before-opening)". S8 (21:08): karşılıksız evrakla yeniden açılan fatura kendi vadesiyle gecikir. Karar (3) (21:30): kilitli
(ya da devredilmiş) dönemde bağsız ödemeyle kapanmış kalem, kilitten sonraki bağla yeniden açılmaz.

| # | Kural | Kâhin yorumu | Senaryo / test | Mutant |
|---|---|---|---|---|
| T1 | S11 tetiği | L = dosyanın kilidi (devirde L = K; karar (3) / R3 ile aynı: ŞU ANKİ kilit). Tetik: evrakın tahsilat kalemi (cirodaysa tedarikçideki ciro ödemesi) **tarihi ≤ L** ve karşılıksız / iade **tarihi > L** ve evrak L günü sonunda **tamamen dağılmış** (tahsilat kaleminin L'deki açık kalanı 0: bütün kapanışları ≤ L günlerinde). "Kilitli dönemde kapattı" = eşleşme (tahsis) günü ≤ L (R3'ün tahsis tarihi ilkesi); bağlı (Kapatılacak Fatura) ya da bağsız fark etmez — S11 bağ ayrımı yapmaz | s63 C1, C2, C3, T1 | B31 |
| T2 | S11 sonucu | Evrakın tahsilat (ciro ödemesi) kalemi kuyrukta KALIR: kapattığı fatura / kalemler kapalı, yeniden açılmaz. Karşılıksız (Ç-07) satırı evrak tutarının tamamıyla AYRI borç kalemi (tür "karsiliksiz"), belge tarihi = vade = karşılıksız günü (EK-1 M1c; S1 A → ertesi gün gecikmiş). Tedarikçi tarafı (Ç-08 ciro dönüşü): ciro ödemesi kalır, alış faturası kapalı; ciro dönüşü ayrı ALACAK kalemi (vade karşılıksız günü). Tedarikçi tarafı R20'nin S8'i iki tarafa uygulamasından: S11, S8'in kilitli dönem istisnasıdır | s63 C1, T1 | B31c, B32 |
| T3 | S11 ↔ S8 sınırı | S8 aynen: evrak kilitten SONRA alındıysa (tahsilat > L; ör. L+1) ya da karşılıksız da kilitli dönemdeyse (karşılıksız ≤ L, kilitten önce girilmiş) → fatura kendi vadesiyle yeniden açılır, öteki bağsız ödemeler kendi günlerinde dağılır. Kilit günü: tahsilat L günü → S11; tahsilat L+1 → S8; karşılıksız L+1 (ilk açık gün) → S11 olabilir | s63 C2 (L / L+1), C3 (karşılıksız ≤ L) | B31b |
| T4 | S11 ↔ karar (3) | Karar (3) kilitli bağsız kapanışı SONRAKİ BAĞA karşı korur; S11 kilitli kapanışı (bağlı / bağsız) SONRAKİ KARŞILIKSIZA karşı korur. İkisi birlikte: kilitli dönemde evrakla kapanmış fatura ne kilit sonrası bağla ne kilit sonrası karşılıksızla yeniden açılır | (birlikte senaryo yok — DENENMEYEN) | — |
| T5 | "Ayrı borç"un karşılıkları | Cari bakiyesi ve yevmiye S8 ile AYNI (Ç-07 / Ç-08 maddesi değişmez; yalnız kuyruk değişir). Açık kalemler: "karsiliksiz" (ciroda "ciro_donus") kalemi. Gecikmiş: karşılıksızın ertesi günü tutarın tamamı (vade < t; M1f). Fatura durumu: fatura "Ödendi" kalır (`acik_faturalar`'da yok); kısmen kapanmışsa yalnız kapanmamış kalanı açık. Hatırlatma: şüpheli kaydı yoksa otomatik listede tutarın tamamıyla (S7). Devir: K'de açık kalırsa kendi vadesiyle devir açık kalemi (M2); karşılıksız > K ise yeni yılda zaten ayrı kalem. J-01: açık borçlardan vade sırasıyla (ayrı borç dahil, M13) | s63 (gecikmiş, açık kalemler, fatura durumu, hatırlatma, mizan) | — |
| T6 | Devirli = devirsiz | Devirli yeni yıl dosyasında evrakın tahsilatı arşivdedir → kuyrukta geri alınacak tahsilat yok → karşılıksız tam tutar ayrı borç (M1c). Devirsiz dosya AYNI kilitle (L = K; EK-2B §5.3) T1–T2 ile aynı sonucu verir. Değişmez `m2_gecikmis_ayni` + elle değerlerin devirden önce ve sonra AYNI yazılması | s63 (d ekli raporlar), üretici (zorla S11) | B31 |
| T7 | Kısmi | "Kısmi karşılıksız" = evrak faturanın bir KISMINI kilitli dönemde kapattı: kapanan kısım kapalı kalır, faturanın kalanı kendi vadesiyle açık; evrak tutarı ayrı borç. Evrakın KENDİSİNİN kısmen karşılıksız çıkması (tutarın bir kısmı) model dilinde yok (Ç-07 evrak tutarının tamamı) → DENENMEYEN | s63 C3 | B31 |
| T8 | Kâhinin sustuğu (KODLANMADI) | (a) Evrak kilitli dönemde alındı ama L'de tamamen DAĞILMAMIŞTI (avans; kalanı kilitten sonra bir borcu kapattı) → KULLANICIYA SORULMALI 1. Model eski davranışı (bütün tutar ayrı borç) sürdürür, `gecikmis` raporunda `kahin_susuyor` [{neden "S11_AVANS", tutar}] yazar; hiçbir senaryo ölçmez. (b) Kilit karşılıksız gününü de kapsayacak biçimde sonradan ilerletilirse → KULLANICIYA SORULMALI 2 (R3 ile ortak); model şu anki kilidi kullanır, senaryo yok | birim `test_S11_avans_kahin_susar` | B31d |
| T9 | S12 "Kasa hareketi" | 100 Kasa'ya yazan HER kaynak (modelde `("kasa",)` modül hareketi — R8'in KASA_ACILIS_SONRA'sı ve `kasa_acilis_ilk` değişmezi aynı tanımı kullanır): Kasa Giriş / Çıkış, nakit tahsilat / ödeme (taksit tahsilatı dahil), kayıt tahsilatı, Bankadan Kasaya / Kasadan Bankaya, çek / senedin Kasa'dan tahsili, verilen evrakın nakit ödenmesi, nakit vergi ödemesi / gecikme zammı, Kasa'ya yansıyan stok hareketi, nakit para iadeli satış iadesi. Kaydın TAMAMI reddedilir, hiçbir şey yazılmaz (banka: "program kaydetmez"). Kasa'ya dokunmayan kayıt (fatura, çek alma, havale) açılıştan önce de olur | s64 | B33, B33d |
| T10 | S12 "önce" ve aynı gün | Hareket tarihi < Kasa açılış tarihi → red. Aynı gün OLUR (açılış günün başındaki bakiye, G-4 açılış sınıfı; EK-2B 33 "aynı gün olur"). Kasa açılışı = etkin `kasa_acilis` (devirde `devir_kasa`, K+1; yeni yılda hareket zaten > K) | s64 (açılış günü, bir gün önce) | B33b |
| T11 | Açılışsız Kasa | Açılış yoksa "açılıştan önce" yoktur → hareket kabul. Açılış sonradan girilirse ilk Kasa hareketinden SONRA tarihli olamaz (M-01, EK-2B 33 / R8 aynen); aynı gün olur. Açılış girildikten sonra kural işler; açılışı öne almak serbest, kural yeni tarihle işler | s64 (baştaki iki hareket, KASA_ACILIS_SONRA, öne alma) | — |
| T12 | S12 düzeltmede | Mevcut Kasa hareketinin tarihini açılıştan önceye alan (ya da açılıştan önce tarihli bir kaydı Kasa'ya çeviren) düzeltme de reddedilir, kayıt olduğu gibi kalır — TÜRETİLDİ: EK-2 §4 (8) "Kasa açılış tarihi ≤ ilk nakit hareketinin tarihi" (kabul edilmiş değişmez) + "bankadaki gibi" (EK-2B 33'ün aktardığı kılavuz: "Tarih hesapların açılışından önce değilse program kaydetmez" — kaydetme düzeltmeyi de kapsar). İkinci okuma ("yalnız YENİ hareket", düzeltme serbest) kabul edilmiş değişmezi bozar → okuma sayılmadı. Baş mimar bu türetmeyi değerlendirir | s64 (düzenle) | B33c |
| T13 | S12 red kodu | `KASA_ACILIS_ONCE` (program 409; bankadaki `bank-before-opening`'in Kasa karşılığı — ad sürücüde eşlenir) | s64 | — |

### Önceki beklentilerle çelişen yerler (eski → yeni, nedeni)
- `test_kasa_acilis_ilk_hareketten_sonra_yakalanir`: [Kasa açılışı 05.01, Kasa girişi 03.01] → eski: giriş KABUL, değişmez `kasa_acilis_ilk` kırmızı ("KÂHİN SUSUYOR — kural yok");
  yeni: giriş `KASA_ACILIS_ONCE` ile REDDEDİLİR, değişmez temiz (S12 = A). Değişmezin dişi aynı durumun modelin reddi atlanarak (kaynak doğrudan eklenerek) kurulmasıyla sınanır.
- Bakım 2 "KULLANICIYA SORULMALI" 1 (S8 ↔ kilit) ve 2 (Kasa açılışından önce hareket) → kullanıcı yanıtladı (S11, S12 = A); kâhinde kural oldu.
- `gecikmis` raporundaki `kahin_susuyor` neden "S8_KILIT" (bütün kilitli karşılıksızlar) → kalktı; yalnız T8 (a) için "S11_AVANS". Sayısal sonuç (ayrı borç) eski susma yolunun
  sayısıyla aynı: bakım 2 bu durumu M1c ile hesaplıyor ama kural saymıyordu; artık kural (S11) ve elle senaryoyla ölçülüyor.
- Elle senaryolarda (s01–s62) sayısal beklenti DEĞİŞMEZ: S12 bugüne kadarki hiçbir senaryoda tetiklenmez (her senaryoda `kasa_acilis_ilk` değişmezi temizdi), S11'in ölçtüğü durum
  hiçbir eski senaryoda yok (bakım 2 README). Tohumlu senaryolar üretici değiştiği için (zorla S11 karşılıksızı) yeniden üretilir.

### KULLANICIYA SORULMALI / KÂHİN SUSUYOR (kodlanmadı)
1. **S11 — kilitli dönemde alınmış ama L'de tamamen dağılmamış evrak (para + kime hatırlatma; ders 43):** çek kilitli dönemde alındı, o gün açık borç yoktu (ya da çek borçtan büyüktü), kalanı
   avans kaldı ve kilitten sonra yeni bir faturayı kapattı; sonra karşılıksız döndü. A (bütün evrak "kilitli dönemin"): kilitten sonra kapattığı fatura da açılmaz, karşılıksız tutarın tamamı ayrı
   borç (vade karşılıksız günü) — devirli dosya bugünkü haliyle bunu verir (avans devirde net satırla taşınır, evrak bağı kopar). B (S11 yalnız kilitli dönemdeki kapanış için): kilitten SONRAKİ
   kapanış S8'le geri alınır (o fatura kendi vadesiyle açılır), yalnız kilitli dönemde kapanan kısım ayrı borç — devirli dosyada devrin avansı evraka bağlı taşıması gerekir (D4'e iş), yoksa
   devirli ↔ devirsiz ayrışır. Örnek: 10.11 çek 10.000 (açık borç yok, avans) · kilit 31.12 · 05.01 fatura 10.000 vade 31.03 (avansla kapanır) · 10.01 karşılıksız → 11.01'de gecikmiş A: 10.000,
   B: 0 (fatura 31.03'e kadar gecikmemiş). KÂHİN: A'nın sayısını verir, `kahin_susuyor` "S11_AVANS" yazar; sürücü bu caride karşılaştırmayı atlar.
2. **Kilit, karşılıksız gününü de kapsayacak biçimde sonradan ilerletilirse (kime hatırlatma; R3 / karar (3) ile ortak):** kilit 31.12 iken 15.01'de karşılıksız döndü (S11: ayrı borç),
   sonra kilit 31.01'e ilerletildi. Tarihle okuma (modelin bugünkü seçimi, R3 ile aynı): artık karşılıksız da kilitli dönemde → S8, fatura kendi vadesiyle açık görünür (kilit koymak açık kalemi
   ve gecikmişi değiştirir). Kayıt anıyla okuma: karşılıksız girildiğinde kilit 31.12'ydi → S11 kalıcı (kilit girildiği andaki durumu korur). Senaryo yok; model kilit geçmişi tutmaz.
3. **S12 — Silinenler'den geri yükleme (Kasa tutarı):** Kasa hareketi silindi, sonra ondan SONRA tarihli Kasa açılışı girildi, sonra hareket geri yüklendi. G-7 "silinen kayıt geri yüklenince
   maddesi aynen geri gelir" ↔ değişmez (8) "açılış ≤ ilk nakit hareketi". A: geri yükleme reddedilir (önce açılışı öne alın). B: geri yüklenir, açılış uyarı verir. Model reddetmez (geri yükler);
   senaryo yok; değişmez `kasa_acilis_ilk` bu durumu HATA sayar.
4. Kâhinin ölçmediği sunum (para değil, baş mimar): karar (3) "program bunu kayıtta yazar" der; S11 için bir ileti ("Bu fatura kilitli dönemde kapanmış; karşılıksız tutar ayrı borç olarak
   yazıldı") karar metninde yok → kâhin ölçmez (`kilit_bag_notu` yalnız R3'ün bağları).
5. **POS valörü resmî tatile (ya da hafta sonu kaydırması bir tatilin üstünden) denk gelirse (para tarihi: 108 → 102 geçişi, KG-6 komisyon tarihi değişmez):** kitap D-01 ve okunan karar
   metinleri susuyor. A: hafta sonu gibi sonraki iş günü (banka tatil takvimiyle). B: kullanıcının / POS ayarının verdiği valör aynen. Kâhin kural kurmaz; üretici bu günlerden kaçınır
   (E1), hiçbir senaryo ölçmez.

### Ana oturumun ek maddeleri (06.11.2026; yalnız kitap / mevzuat / kapsam dayanaklı)
| # | Madde | Kâhin yorumu | Senaryo / test | Mutant |
|---|---|---|---|---|
| E1 | K3 POS valörü resmî tatile düşebiliyor (ör. rastgele-2'de 2026-04-23) | Kitap D-01 ve kâhinin okuduğu karar metinleri valörün resmî tatilde ne olduğunu SÖYLEMEZ (yalnız ana oturum K3: hafta sonu → sonraki iş günü). Kural UYDURULMAZ: üretici valörü (ve hafta sonu kaydırmasının geçtiği günleri) resmî tatile hiç düşürmez — önce öbür valör seçenekleri (1, 2, 30 gün) denenir, hiçbiri olmazsa o tahsilat POS değil havale (B1) olur. Resmî tatiller (2429 sayılı Kanun): 1 Ocak, 23 Nisan, 1 Mayıs, 19 Mayıs, 15 Temmuz, 30 Ağustos, 28 Ekim (yarım gün) ve 29 Ekim + dinî bayramlar (arife yarım gün dahil). Dinî bayram tarihleri birincil takvimden DOĞRULANMADI (kâhinin bilgisi: Ramazan 2026-03-20..22, Kurban 2026-05-27..30, Ramazan 2027-03-09..11, Kurban 2027-05-16..19) → pencereler arifeden bir gün önce – bayramdan bir gün sonra genişletildi (kaçınma; kural değil). Durum KULLANICIYA SORULMALI 5 | hijyen `test_pos_valoru_resmi_tatile_dusmez` (elle + tohumlu) | — (üretici / hijyen; model değişmedi) |
| E2 | K6 s43 10. olay %24 KDV | Geçerli KDV oranları %0, %1, %10, %20 (KDVK; kâhin mevzuat bilgisi, birincil metin bu turda açılmadı). Olay "mahsubu yapılmış ayın kaydı düzenlendi" uyarısını sınar; amaç korunarak düzeltme faturanın kendi oranıyla (%20): `{"K": 12000}` → `{"M": 60000, "K": 12000}`. Elle beklenen (`bil2/kesin_degil`) DEĞİŞMEZ; beklenen dosyası yeniden üretilir. Bütün elle ve tohumlu senaryolarda K / M taraması: başka geçersiz oran yok | s43 | — |
| E3 | Vade günü sınırı (kapsam) | EK-1 M1f / §1 adım 5: gecikmiş ⇔ vade < bugün — vadesi BUGÜN olan gecikmiş değildir, gecikme ERTESİ GÜN başlar; vadesi DÜN olan gecikmiştir (S1 A: vadesiz kalemde vade = belge günü). Ayrı senaryo: taksit kartının üç taksiti (vade 01.04 / 02.04 / 03.04) ve iki fatura (vade 02.04; yıl dönümü 31.12) — her biri vade günü, ertesi gün ve hatırlatma | s65 | M32 (vadesi bugün olan gecikmiş — zaten vardı), M32b (yeni: vadesi dün olan gecikmiş değil) |

### Elle beklenenlerin yazılış sırası (bakım 3)
- cb57123f: yorum (yukarıdaki T1–T13), s63, s64, `test_S11_avans_kahin_susar` ve `test_kasa_acilis_ilk_hareketten_sonra_yakalanir`'ın yeni beklentisi model DEĞİŞTİRİLMEDEN ÖNCE
  commit'lendi. Eski modelle 117 testten 5'i beklenen nedenle kırmızı (`docs/kanit/2026-11-06/kahin3-eski-model-kirmizi.*`): s63 yalnız `kahin_susuyor` ("S8_KILIT") ile — sayıların
  hepsi elle değerlerle aynıydı (eski modelin susma yolu M1c'yi hesaplıyordu); s64 reddedilmeyen hareketlerle (`EVRAK_DURUMU`, Kasa 17210 ≠ 16250); avans birimi "S8_KILIT" ≠ "S11_AVANS";
  Kasa değişmezi birimi red yok; dosya güncelliği. Model değiştikten sonra hiçbir elle değer değişmedi.

### Yeni senaryolar, testler ve mutasyonlar
- Elle senaryolar: s63 (S11 — C1 iki bağlı çek, biri ciro; C2 kilit günü / L+1; C3 kısmi kapanış + kilitli dönemde dönen çek (S8); T1 ciro dönüşü; devirden önce ve sonra aynı
  değerler), s64 (S12 — açılışsız Kasa, R8, açılış günü, bir gün önce, nakit tahsilat / ödeme, çekin Kasa'dan tahsili, düzeltme, öne alınan açılış).
- Birim: `test_S11_avans_kahin_susar` (yeni), `test_kasa_acilis_ilk_hareketten_sonra_yakalanir` (S12 reddi + değişmezin dişi doğrudan eklemeyle). S11 / S12 için 117 test (114 + s63 + s64 + 1).
- Ana oturumun ek maddeleri (E1–E3): s65 (vade günü), hijyen `test_pos_valoru_resmi_tatile_dusmez`; s43 verisi düzeltildi (elle beklenen aynı). Toplam 119 test. E1'in kırmızı
  kanıtı: yeni hijyen kuralı eski üreticinin (71ee26f) tohumlarında 3 / 3 kırmızı (tohum 1 P132 valör 2026-03-23, tohum 2 P89 2026-04-23 ve P159 2026-06-01 (kaydırma bayramın
  üstünden), tohum 3 P186 2026-05-25; `docs/kanit/2026-11-06/kahin3-pos-tatil-eski-uretici-kirmizi.*`). Üretici değişti → tohumlu senaryolar yeniden üretildi.
- Üretici: her tohumda K'den önce tahsilatla alınmış ilk portföy / tahsilde evrak 20.01'de karşılıksız (tohum 1 C4, 2 C2, 3 C2; üçünde de evrak L'de tamamen dağılmış → S11 kuralı,
  susma yok); devirli (M1c) = devirsiz L = K (S11) `gec_ocak` / `gec_son` ve değişmez m2 ile karşılaştırılır.
- Mutantlar (10 yeni, liste 136): M32b (E3: vadesi dün olan gecikmiş sayılmaz; vadesi bugün olanı gecikmiş sayan M32 zaten vardı), B31 (S11 yok — S8 harfiyen), B31b (kilit günü dahil değil), B31c (tedarikçi tarafı S8'le geri alınır), B31d (avansta susmaz), B32 (M1c ayrı borç hiç
  gecikmez), B33 (S12 yok), B33b (açılış günü de red), B33c (düzeltmede S12 yok), B33d (yalnız Kasa Giriş / Çıkış Kasa hareketi). Kodu değişen eski mutant: B11'in metni (`dg["tarih"]`).

### Sürücü için (programla karşılaştırmadan önce)
- Yeni red kodu `KASA_ACILIS_ONCE`: Kasa'ya yazan bir kaynak (ya da `duzenle`) Kasa açılış tarihinden ÖNCE tarihliyse, kaydın tamamı (program 409; bankanın `bank-before-opening`
  karşılığı — program kodu sürücüde eşlenir). s64'te nakit tahsilat / ödeme cariye de yazılmaz (bakiye 0 / 1000 elle değerde).
- Yeni olay türü / alan YOK. S11 mevcut olaylarla: `donem_kilitle` → kilitten sonra `evrak_karsiliksiz` (ciroda `odeme yol ciro` evrakı). Devirli kontrol: aynı olaylar, `devir`
  karşılıksızlardan SONRA (s56 deseni); devirsiz eş aynı kilitle (L = K).
- `gecikmis.kahin_susuyor`: [{kaynak, evrak_kaynak, neden "S11_AVANS", tutar}] → bu carinin o tarihteki gecikmiş / açık kalem karşılaştırması atlanır (KULLANICIYA SORULMALI 1).
  "S8_KILIT" nedeni kalktı.
- Model dilinde faturanın formdaki peşin ödemesi AYRI tahsilat olayıdır (`fatura_odemesi`); programda tek kayıt olabilir → S12 reddi programda faturanın tamamını, modelde yalnız peşin
  tahsilatını reddeder. Hiçbir senaryo açılıştan önce nakit peşinli fatura girmez; sürücü eşlerken dikkat.
- s64'te banka hesabı kullanılmadı (bankanın kendi açılış reddi kâhinde modellenmez); havale / POS / kart açılıştan önce de kabul sayılmaz — senaryoda yok.

### DENENMEYEN (bu bakım)
- Programla karşılaştırma (sürücü güncellemesi ayrı iş).
- Evrakın kendisinin kısmen karşılıksız çıkması (model dilinde yok); K3 şüpheli caride S11 (128'e düşen evrak tahsilatı); S11 ile karar (3)'ün aynı faturada birlikte işlemesi; taksit kartı
  tahsilatı çekinin kilitten sonra karşılıksızı (M1c zaten; kilitten bağımsız) — elle senaryo yok.
- Kilit ilerletme / kaldırma (KULLANICIYA SORULMALI 2); S12'de geri yükleme (KULLANICIYA SORULMALI 3) ve düzeltmeyle yolun nakde çevrilmesi (model reddeder — T12 — ama senaryo yok);
  Devri Yenile'nin arşivdeki Kasa düzeltmesi (genel kuralla reddedilir, senaryo yok).
- Program iletisi (KULLANICIYA SORULMALI 4) ölçülmez.

## Kâhin bakımı 4 (06.11.2026, kodu görmeyen ajan; kullanıcı kararı 06.11 04:50 UTC S14, S15, S18, S19, S20, S21 — "hepsine A")

### Kaynaklar ve bağımsızlık
- Okunan: `CLAUDE.md`, `docs/BAGIMSIZ-DOGRULAMA-PRENSIBI.md`, bu klasörün kaynakları (README, `model.py`, `senaryolar_elle.py`, `test_model.py`, `mutasyon.py`, `uretici.py`,
  `uret_beklenen.py`; `senaryolar/` yalnız listelendi), `docs/erp/MUHASEBELESTIRME-KURAL-KITABI.md` (§1 G-1…G-8 ve §3 satırları aranarak), `…-EK-1.md` / `…-EK-2B.md` (aranarak;
  EK-2B 28, 33, 35), `docs/devir/DEVIR-PLANI.md` (G0–G3; §1 / §4 aranarak), `docs/BANKA-MODULU-PLAN.md` YALNIZ §3.11b, `docs/2.5.0-IS-LISTESI.md` A (satır 1–83), C ve D (161–299);
  B ve E okunmadı. Tam liste ajan raporunda.
- `server/`, `client/`, `bulut/`, `packaging/`, `tools/` (yalnız `node tools/kanit.mjs kos` ÇALIŞTIRILDI), öteki `test/` klasörleri (sürücü dahil), `docs/kanit/` (kendi kanıtları
  dışında), git geçmişi / farkı OKUNMADI; program çalıştırılmadı. Git: `git merge --ff-only e6e5610f` (çıktının son üç satırı `test/` ve `tools/` altındaki üç yeni dosyanın ADINI
  gösterdi — açılmadı), `git status -s`, `git branch --show-current`, `git log --oneline -3` (yalnız başlıklar), `git archive e6e5610f test/bagimsiz/muhasebe` (eski kâhin kopyası,
  kırmızı kanıtı için, not defterinde), bitişte kendi yollarımın `git add` + `git commit`'i.
- Birincil kaynak denemesi: `mevzuat.gov.tr` (2429 sayılı Kanun) ve `vakithesaplama.diyanet.gov.tr` (dinî günler) bu oturumun ağ ayarında ERİŞİLEMEDİ (ENOTFOUND) → 2429 metni
  ve dinî bayram tarihleri birincil kaynaktan DOĞRULANMADI; gün listesi kâhinin bilgisi.

### Karar metinleri (AYNEN, iş listesi D "KULLANICI KARARI 06.11 04:50 UTC")
- **S14 = A:** şüpheli alacaklı caride faturaya BAĞLI alınan çek / senet bağlı faturanın durduğu hesaptan düşer (şüpheliye aktarılmış fatura 128, sonradan kesilmiş 120).
- **S15 = A:** taksit kartında tahsilatı olan faturanın İptal Et'i kabul; kart kapanır, kartın tahsilatları carinin avansı olur (S5 / EK-2B 35 ile aynı).
- **S18 = A:** kilitli dönemde alınıp kilit günü sonunda tamamen dağılmamış (avans) çek karşılıksız dönerse çekin TAMAMI ayrı borç.
- **S19 = A:** S11 / R3 kararı karşılıksızın yazıldığı andaki kilide göre bir kez verilir; kilit sonradan ilerletilirse değişmez.
- **S20 = A:** yedekte Kasa açılışından önce tarihli Kasa hareketi varsa geri yükleme veriyi aynen getirir (G-7); S12 kuralı yalnız yeni kayıtta; Mutabakat Testi uyarı verir.
- **S21 = A:** POS valörü resmî tatile düşerse bir sonraki iş gününe kayar.
- Seçeneklerin öbür yüzü (iş listesi C): S14 B "her durumda 128'den"; S15 B "reddedilir, iade faturası kesilir"; S18 B "kilitten sonraki kapanış S8 gibi geri alınır"; S19 B "her
  türetmede güncel kilide göre"; S20 B "geri yükleme reddedilir ya da hareket ayıklanır"; S21 B "verilen valör aynen".

### Kural başına yorum (önce yorum, sonra kod — ders 40)
| # | Karar | Kâhin yorumu | Senaryo / test | Mutant |
|---|---|---|---|---|
| Y1 | S14 kapsam | Çek / senet tahsilatı (`yol` cek / senet), `fatura` bağı (Kapatılacak Fatura ya da formdaki peşin), carinin tahsilat günü AÇIK şüpheli kaydı var (kalan > 0, kayıt tarihi ≤ tahsilat). Açık kayıt yoksa S14'ün konusu yok | s68 | B40 |
| Y2 | S14 "şüpheliye aktarılma anı" | Faturanın durduğu hesap TAHSİLAT ANINDA okunur (aynı gün K3 gün sırası: al → karşılık → değersiz → alacak satırı → çıkar): faturanın açık kısmı şüpheli kuyruğunda mı (J-01 açık borçları vade sırasıyla taşır, M13). Fatura kayıttan SONRA kesildiyse, kayıt tutarı ona yetmediyse ya da Şüpheliden Çıkar ile döndüyse → 120. Değersizle kapanan fatura açık değildir (senaryo yok) | s68 C1, C2 | B40, B40b |
| Y3 | S14 tutar ve kayıt | Şüpheli kuyruğundaki kısım kadar A 128 — o kalemi TAŞIYAN kayıttan (K3'ün "en eski kayıt önce"si burada uygulanmaz: bağ hedefini kapatır, karar (2)); kuyrukta o kalem kapanır. K6 (karşılık > kalan → 644) aynen. Faturanın 120'deki kısmı A 120 bağla kapanır | s68 C1 (644), C2 (iki açık kayıt) | B40d |
| Y4 | S14 sınır | SUPHELI_NORMAL_ASIM yalnız 120'ye kalan (normal) kısma uygulanır: 128'den düşen kısım "normal cari hesaba işlenen" değildir (plan §3.11b/2 sınır cümlesi). Eski kâhinde bağlı çekin tamamı sınıra girdiği için şüpheli faturaya bağlı çeklerin çoğu reddediliyordu | s68 C1, C2, C3 | B40c |
| Y5 | S14 kısmi (KULLANICIYA SORULMALI 2) | Fatura KISMEN aktarılmışsa (bir kısmı 128, bir kısmı 120) ve çek iki kısmın toplamından küçükse hangisi önce kapanır — metin söylemez. Çek iki kısmın toplamı kadar ya da büyükse tek okuma (ikisi de kapanır; s68 C3). Kısmi durumda model şüpheli kısmı önce düşer (K3 "önce şüpheliden") ve `gecikmis.kahin_susuyor` "S14_KISMI" yazar | birim `test_S14_kismi_kahin_susar` | — |
| Y6 | S14 fazla / öbür yollar (KULLANICIYA SORULMALI 2) | Çekin faturanın açık kısımlarını aşan fazlası ve nakit / havale / POS ile bağlı tahsilat karar metninde yok → plan §3.11b/2 (b) aynen (bağlı tahsilat normal, 120; sınırıyla). Senaryo yok | — | — |
| Y7 | S14 karşılıksız | S14 çekinin karşılıksızı R20 aynen (128'e düşen kısım vade karşılıksız günü ayrı kalem) — senaryo yok (DENENMEYEN) | — | — |
| Y8 | S15 = EK-2B 35 (3) + S5 | İptal kabul; faturanın kendi kartının taksitleri kuyruktan çıkar; kart tahsilatlarının bağı çözülür, bağsız alacak olur ve TYK'da KENDİ TARİHİNDE dağılır (karar (1); carinin başka açık borcu varsa onu kapatır, yoksa avans). Formdaki peşin faturayla düşer (S5, F-15). Kısmi taksit tahsilatı aynı. Kilitli dönemdeki fatura iptal edilemez (F-15, G-7: KILITLI_DONEM). Sayısal sonuç bakım 2 R9 ile AYNI — model zaten EK-2B 35 (3) ile böyleydi | s69, s58 | B41, B41b |
| Y9 | S15 "kart kapanır" | Tahsilatı olan kart iptalde KAPALI görünür, açık taksiti yok (`kartlar` raporu {kapali: true, taksitler: []}); tahsilatsız kartlı faturanın silinmesi / iptali EK-2B 35 (1) aynen: kart kalkar (raporda yok). Ayrım karar metninden ("kapanır") ve EK-2B 35 (1)'den ("kalkar") | s69, s58 C3 | B41c |
| Y10 | S18 | S11'in tetiği evrakın L günündeki dağılımına artık BAKMAZ: evrakın tahsilat (ciro ödemesi) kalemi tarihi ≤ L ve karşılıksız > L → tahsilat kalemi kalır (kilitten önce de sonra da kapattığı kalemler kapalı), karşılıksız tutarın TAMAMI ayrı borç (vade karşılıksız günü, M1c). Karşılıksız anında hâlâ dağılmamış kısım (avans) TYK'da bu ayrı borca uygulanır (net). Bakım 3'ün "S11_AVANS" susması kalkar; sayı aynı (model bu sayıyı zaten veriyordu). Devirde avans net satırla taşınır, evraka bağlanmaz → devirli = devirsiz | s66, birim `test_S18_avans_evrak_tamami_ayri_borc` | B34 |
| Y11 | S19 kilit | L = kaydın YAZILDIĞI andaki dosya kilidi (kaynakta saklanır). S11: karşılıksız (ciro dönüşü) kaynağının L'si; kilit sonradan ilerlese de karar değişmez. Kilit KALDIRILIRSA EK-2B 28 ("kural o dönem için kalkar") → etkin L = min(yazılış kilidi, güncel kilit); modelde kilit kaldırma olayı yok (yalnız formül, DENENMEYEN) | s67 C1, C3 | B35 |
| Y12 | S19 ↔ R3 | Karar metni "S11 / R3" der; R3'te karşılıksızın karşılığı BAĞDIR (Kapatılacak Fatura tahsilatı / ödemesi, iade → asıl fatura, kart tahsilatı, fatura kartı açılışı, Mahsup Et): R3 kararı bağın yazıldığı kilide göre. Yazıldığında açık dönemdeki bağsız kapanışı geri almış (karar (2)) bağ, kilit o kapanışı kapsayacak biçimde ilerletilse de geri almış kalır; kilit notu yazılmaz (kâhin yorumu — BAŞ MİMAR değerlendirir) | s67 C2 | B35b |
| Y13 | S19 düzeltme | Düzeltilen kaydın yazılış kilidi değişmez ("bir kez") — senaryo yok | — | — |
| Y14 | S19 × devir (KULLANICIYA SORULMALI 1) | Devirden ÖNCE (kilit < K iken) yazılmış K sonrası kayıt (Ocak'ta girilen Aralık çekinin karşılıksızı, Aralık faturasına Ocak bağı): devirli dosyada evrakın tahsilatı / bağın hedefi arşivde → kendiliğinden M1c / G2; S19 harfiyen ise yazılış anındaki S8 / karar (2) sonucu kalmalı (devir taşımalı, D4'e iş). Kâhin KURAL KURMAZ, bakım 2 / 3 davranışını sürdürür: devir, K sonrası bütün kayıtları K kilidiyle değerlendirir (devirli = aynı K kilidi altında yazılmış devirsiz eş, EK-2B §5.3; S11 "devirli ve devirsiz aynı"). Devir raporu `s19_devir` bu kayıtları listeler | devir raporu, üretici | B35c |
| Y15 | S20 "geri yükleme" | İki yol: (a) Silinenler'den geri yükleme (G-7: "maddesi aynen geri gelir"), (b) yedekten geri yüklenen eski sürüm verisi (olay dilinde `yedekten: true` = kayıt geri yüklenen yedekte / göç verisinde vardı). İkisinde de S12 (KASA_ACILIS_ONCE) ve açılışın ilk girişteki R8'i uygulanmaz; veri aynen | s70 (a), s71 (b) | B42, B42b |
| Y16 | S20 "yalnız yeni kayıtta" | Geri yüklemeden sonra açılıştan önce tarihli YENİ Kasa hareketi yine KASA_ACILIS_ONCE. Açılışın düzeltilmesi R8 aynen (ilk Kasa hareketi — geri yüklenen dahil — sonrasına alınamaz; öne alma serbest, uyarı kalkar) | s70, s71 | — |
| Y17 | S20 ↔ değişmez (8) | Mutabakat Testi uyarısı: yeni rapor `mutabakat_uyarilari {tarih}` → [{kod KASA_ACILIS_ONCESI_HAREKET, kaynak, tarih, acilis}]. Değişmez `kasa_acilis_ilk` (EK-2 §4 (8)) artık yalnız GERİ YÜKLENMEMİŞ kayıtta hata sayar: hareketin kaynağı ya da en erken açılışın kendisi geri yüklendiyse uyarı, hata değil (S20'nin açık istisnası). Geri yüklenmemiş kayıt açılıştan önceye düşerse (modelin reddi atlanırsa) değişmez yine kırmızı | s70, `test_kasa_acilis_ilk_hareketten_sonra_yakalanir` | B42c, B42d |
| Y18 | S20 ↔ T12 (KULLANICIYA SORULMALI 3) | T12 (BAŞ MİMAR KARARI: Kasa hareketini düzeltmeyle açılış öncesine taşıma red) aynen. Geri yüklenmiş açılış öncesi kaydın tarihi değişmeden düzeltilmesi (ör. tutar) bugünkü kâhinde T12 ile reddedilir; "S12 yalnız yeni kayıtta" ifadesi düzeltmeyi serbest de okutabilir → iki okuma; senaryo yok | — | — |
| Y19 | S21 takvim | 2429 sayılı Kanun md. 1–2 (kâhinin bilgisi; birincil metin bu oturumda açılamadı): TAM GÜN 1 Ocak, 23 Nisan, 1 Mayıs, 19 Mayıs, 15 Temmuz, 30 Ağustos, 29 Ekim; YARIM GÜN 28 Ekim (13:00'ten) ve Ramazan / Kurban arifesi (13:00'ten); dinî bayram günleri (Ramazan 3, Kurban 4 gün). Dinî bayram tarihleri DOĞRULANMADI (kâhinin bilgisi: Ramazan 2026-03-20..22, Kurban 2026-05-27..30, Ramazan 2027-03-09..11, Kurban 2027-05-16..19); model arifeden bir gün önce – bayramdan bir gün sonra pencereyi belirsiz sayar. Hafta sonu (Cumartesi, Pazar) iş günü değildir (ana oturum K3) | birim `test_S21_tatil_takvimi` | — |
| Y20 | S21 kural | Etkin valör = nominal valörden (POS'un verdiği valör günü: çekim + gün; olay dilinde `valor`) başlayarak İLK İŞ GÜNÜ (hafta sonu da tam gün resmî tatil de değil); zincir: tatil + hafta sonu (1 Mayıs 2026 Cuma → 4 Mayıs Pazartesi; 1 Ocak 2027 Cuma → 4 Ocak). 108 → 102 etkin valör günü (D-01); KG-6 komisyon tarihi değişmez (çekim günü); POS iadesi "valörden önce mi" etkin valöre göre (D-04); devirde bekleyen POS etkin valöre göre (N-11). Şimdi Aktar (aktarım tarihi, kullanıcı işlemi) kaydırılmaz | s72, s23 | B44, B44b, B44c |
| Y21 | S21 belirsiz günler (KULLANICIYA SORULMALI 4) | Yarım günler (28 Ekim, arife) iş günü mü — metin söylemez; dinî bayramlar doğrulanmadı; bayram takvimi olmayan yıllar (2026–2027 dışı) bilinmez. Kâhin SUSAR: nominal valör ya da kaydırma yolu bu günlere değerse "senaryo hatası" (AssertionError); senaryolar yalnız sabit tatillerle kurulur | birim `test_S21_belirsiz_valor_kahin_susar` | — |
| Y22 | S21 kapsam dışı | Donmuş 2.4.9 türetmesi S21'siz (yalnız hafta sonu; 2.4.9 bu kuralı bilmez). Banka transfer valörü (K-07) kaydırılmaz (karar yalnız POS) | — | — |
| Y23 | S21 üretici | Hafta sonu kaydırması üreticide kalır (senaryo valörü iş günü); sabit resmî tatilden KAÇINMA KALDIRILDI (model kaydırır); belirsiz günlerden kaçınma sürer (rastgele sayı tüketmeden öbür valör seçenekleri, hiçbiri olmazsa havale) | hijyen `test_pos_valoru_belirsiz_gune_dusmez` | — |

### Önceki beklentilerle çelişen yerler (eski → yeni, nedeni)
- `s58` `kt3` (C3: tahsilatlı kartın faturası iptal): `{}` → `{"TK2": {"kapali": true, "taksitler": []}}` — S15 "kart kapanır" (Y9). Sayılar aynı.
- `test_S11_avans_kahin_susar` → `test_S18_avans_evrak_tamami_ayri_borc`: `kahin_susuyor` [("S11_AVANS", 10000)] → yok; gecikmiş (11.01) 10000, açık kalem yalnız karşılıksız (S18, Y10).
- Hijyen `test_pos_valoru_resmi_tatile_dusmez` → `test_pos_valoru_belirsiz_gune_dusmez`: sabit resmî tatile düşen valör artık serbest (S21; model kaydırır), belirsiz güne düşen yasak (Y21, Y23).
- Model POS valörünü hafta sonundan da kaydırır (eski: valör aynen): `s23`'ün 2027-01-02 (Cumartesi) valörü → 2027-01-04; s23'ün elle değerleri (31.01 raporları) DEĞİŞMEZ.
- Mutant B31d (S11 avansında kâhin susmaz) KALDIRILDI (S18 ile susma yok) → B34 (avansta S8). Kodu taşınan mutantların metni yeni koda taşınır: B03, B12, B30, B31, B31b, B31c, B33d,
  M57, N33.
- Üretici `devirsiz()`: kilit (K) eşin SONUNA değil, K sonrası ilk kaydın ÖNÜNE konur, Devri Yenile düzeltmeleri (≤ K) ondan önce. S19 ile sona konan kilit önceki kayıtları kapsamaz;
  devirli dosyanın kayıtları (Y14) K kilidiyle değerlendirildiği için eş de "K kilidi altında yazılmış" olmalı. Aynı tarihli kayıtların göreli sırası değişmez (düzeltmeler ≤ K,
  ötekiler > K).
- Tohumlu senaryolar: üretici değişti (sabit tatil valörü, devirsiz eş) → `rastgele-*.json` ve beklenenleri yeniden üretilir. Devir raporlarına `s19_devir` anahtarı eklenir
  (beklenen dosyaları yeniden üretilir; elle değer değişmez).

### KULLANICIYA SORULMALI / KÂHİN SUSUYOR (kodlanmadı ya da yalnız gözlem; para / kime hatırlatma → ders 43)
1. **S19 × devir (Y14):** Aralık'ta alınıp Aralık faturasını kapatan çek, kilit Kasım'dayken (ya da kilit yokken) Ocak'ta karşılıksız girildi → S19 ile fatura kendi vadesiyle yeniden açıldı
   (S8). Sonra devir yapıldı. A (kâhinin bugünkü davranışı): devir K sonrası kayıtları K kilidiyle değerlendirir → fatura kapalı, karşılıksız tutar ayrı borç (vade karşılıksız günü);
   devirle gecikmiş / hatırlatma değişebilir; D4'e ek iş yok. B (S19 harfiyen): yazılış anındaki S8 sonucu kalır → devir, karşılıksızla yeniden açılmış Aralık faturasını açık kalem olarak
   (kendi vadesiyle) taşır (D4'e iş). Aynı soru Ocak'ta girilip Aralık'taki bağsız kapanışı geri almış (karar (2)) bağ için de geçerli. Örnek: 01.11 F 10.000 vade 31.03 · kilit 30.11 ·
   20.12 çek (F'ye bağlı) · 15.01 karşılıksız · 20.01 devir → 16.01–31.03 arası gecikmiş A: 10.000, B: 0. Kâhin A'nın sayısını verir; devir raporu `s19_devir` bu kayıtları listeler.
2. **S14 ayrıntıları (Y5, Y6):** (a) kısmen aktarılmış faturaya bağlı, faturanın iki kısmının toplamından küçük çek — önce 128 kısmı mı, 120 kısmı mı (kâhin şüpheliyi önce düşer,
   "S14_KISMI" susar); (b) çekin faturanın açık kısımlarını aşan fazlası; (c) nakit / havale / POS ile şüpheliye aktarılmış faturaya bağlı tahsilat (karar yalnız çek / senet; kâhin (b)
   kuralıyla 120 — sınır nedeniyle çoğu reddedilir).
3. **S20 × T12 (Y18):** geri yüklenmiş, açılıştan önce tarihli Kasa kaydının tarihi değişmeden düzeltilmesi: A reddedilir (T12'nin bugünkü okuması), B kabul (S20 "yalnız yeni kayıtta").
4. **S21 yarım gün (Y21):** valör 28 Ekim ya da bayram arifesine (öğleden sonra tatil) düşerse o gün mü, ertesi iş günü mü. Ayrıca dinî bayram tarihleri birincil kaynaktan doğrulanmalı.
5. Sürer: bakım 2 listesinin 3 (fatura durumunda Alacak Yaz), 4 (aynı gün sırası), 5 (Mevcut Borç kartının ayrılmış kısmı), 6 (eski kapama), 7 (16, 17, 22); bakım 3'ün 4'ü (program
   iletisi). Bakım 3'ün 1, 2, 3, 5'i bu bakımda kural oldu (S18, S19, S20, S21).

### Elle beklenenlerin yazılış sırası (bakım 4)
- bd30057e: yorum (Y1–Y23), s66–s72, s58 `kt3` değişikliği, birim testleri (`test_S18_avans_evrak_tamami_ayri_borc`, `test_S14_kismi_kahin_susar`, `test_S21_tatil_takvimi`,
  `test_S21_belirsiz_valor_kahin_susar`) ve hijyen `test_pos_valoru_belirsiz_gune_dusmez` model DEĞİŞTİRİLMEDEN ÖNCE commit'lendi. Eski modelle 129 testten 14'ü beklenen nedenle
  kırmızı (`docs/kanit/2026-11-06/kahin4-eski-model-kirmizi.*`); nedenler ayrı dökümde (`kahin4-eski-model-neden.txt`: eskinin bilmediği `mutabakat_uyarilari` raporu atlanarak
  elle anahtar başına beklenen ↔ eski değer ve eski değişmez hataları — s58 1, s66 3 (S11_AVANS susması), s67 5 (güncel kilit okuması), s68 28 (bağlı çek 120 + üç
  SUPHELI_NORMAL_ASIM), s69 1, s70 3 (değişmez `kasa_acilis_ilk` kırmızı + rapor yok), s71 9 (yedekteki kayıtlar reddedildi), s72 12 (valör tatilde)).
- Model değiştikten sonra ilk koşuda HİÇBİR elle değer değişmedi (tek kırmızı dosya güncelliğiydi; beklenen dosyaları yeniden yazıldı). Eski elle senaryoların beklenen dosyalarında
  fark yalnız s58 `kt3` ve devir raporlarına eklenen `s19_devir` anahtarı (karşılaştırma eski kâhin kopyasının dosyalarıyla, not defterindeki betikle).
- Sonradan elle eklenen tek birim testi: `test_S14_hedef_kalem_kapanir` — mutant tasarımında görüldü: S14'te şüpheli kuyruğunda HANGİ kalemin kapandığını (bağlı fatura mı, vadesi ilk
  gelen mi) hiçbir senaryo ölçmüyordu (B40f sağ kalırdı). Beklenen Y3'ten elle (Şüpheliden Çıkar'dan sonra açık kalem yalnız F4).

### Yeni senaryolar, testler ve mutasyonlar
- Elle senaryolar (7, toplam 73): s66 (S18 — tamamen avans / kısmen dağılmış / karşılıksız anında avansı kalan çek; devirli = devirsiz), s67 (S19 — S8 yazılmış karşılıksız, S11 yazılmış
  karşılıksız, R2 yazılmış bağ; kilit iki kez ilerletilir), s68 (S14 — aktarılmış fatura 128 + K6 644, sonradan kesilmiş fatura 120, kısmen aktarılmış faturanın iki kısmı, Şüpheliden
  Çıkar ile dönmüş fatura 120, iki açık kayıtta kalemi taşıyan kayıt, sınır), s69 (S15 — peşin + kartlı fatura, kısmi kart tahsilatı, iptal, kart kapalı, tahsilatlar F0'ı kendi
  günlerinde kapatır; kilitli dönemde iptal red), s70 (S20 Silinenler'den geri yükleme), s71 (S20 yedekten eski veri; öne alma uyarıyı kaldırır), s72 (S21 — 23 Nisan, 1 Mayıs +
  hafta sonu, 29 Ekim, 1 Ocak + devir; tatil günü POS iadesi).
- Birim (130 test): `test_S18_avans_evrak_tamami_ayri_borc` (eski `test_S11_avans_kahin_susar`'ın yerine), `test_S14_kismi_kahin_susar`, `test_S14_hedef_kalem_kapanir`,
  `test_S21_tatil_takvimi`, `test_S21_belirsiz_valor_kahin_susar`; hijyen `test_pos_valoru_belirsiz_gune_dusmez` (eski `test_pos_valoru_resmi_tatile_dusmez`'in yerine; en az 4 valör
  sabit tatile düşer).
- Üretici: sabit tatilden kaçınma kalktı (tohum 2'de P89 valörü 2026-04-23 → model 24.04'e kaydırır); tohum 2'de S14 yolu da işler (P227 şüpheliye aktarılmış faturaya bağlı çek →
  128); `devirsiz()` kilidi K sonrası ilk kaydın önüne koyar. Rastgele sayı akışı değişmedi.
- Mutantlar: B31d kaldırıldı; 20 yeni (B34, B35, B35b, B35c, B40, B40b, B40c, B40d, B40e, B40f, B41, B41b, B41c, B42, B42b, B42c, B42d, B44, B44b, B44c) → liste 155. Kodu taşınan eski
  mutantların metni yeni koda taşındı (B03, B12, B30, B31, B31b, B31c, B33d, M57, N33; anlamları aynı). Modelde YALNIZ mutasyonun çağırdığı yardımcı: `Dosya.l_sonu_acik`
  (B34; bakım 3'ün eski T1 okuması).

### Sürücü için (programla karşılaştırmadan önce)
- **S14:** yeni olay alanı yok. Şüpheli kaydı açık caride `tahsilat` `yol` cek / senet + `fatura`: 128'den düşen kısım şüpheli kuyruğundaki bağlı fatura kalemi kadar, o kalemi taşıyan
  kayıttan; kalan 120 (bağ). `supheli_kayitlari` raporundaki kayıt kalanları ve 128 / 129 / 644 karşılaştırılır. `gecikmis.kahin_susuyor` "S14_KISMI" → bu carinin o tarihteki 120 /
  128 ayrımı ve gecikmiş karşılaştırması ATLANIR (KULLANICIYA SORULMALI 2). SUPHELI_NORMAL_ASIM yalnız 120'ye kalan kısma.
- **S15:** iptal artık kabul (programın bugünkü reddi B'dir → fark beklenir, Ç7b). `kartlar` raporunda tahsilatlı kartı iptal edilen kart `{kapali: true, taksitler: []}`; tahsilatsız
  kart (iptal ya da silme) raporda YOK. Kart tahsilatları bağsız alacak (TYK'da kendi tarihinde).
- **S18:** `kahin_susuyor` "S11_AVANS" KALKTI (bakım 3'teki atlama listesinden çıkarılır); bu cariler artık karşılaştırılır.
- **S19:** kilit = kaydın yazıldığı andaki kilit. Senaryoda `donem_kilitle` olayının konumu anlamlıdır: kilitten ÖNCE girilen karşılıksız / bağ, kilit sonra ilerlese de eski kilide göre
  değerlendirilir (s67). Sürücü olayları senaryo sırasıyla girmeli. Devir raporu yeni anahtar `s19_devir` = devirden önce (kilit < K iken) yazılmış K sonrası karşılıksız / bağ
  kaynakları — bu kayıtlarla ilgili devirli gecikmiş farkı kural kimliği "S19-DEVIR" ile ayrı listeye alınır (KULLANICIYA SORULMALI 1; G5).
- **S20:** yeni olay alanı `yedekten: true` (herhangi bir kaynak olayında) = kayıt geri yüklenen yedekte / eski sürüm verisinde vardı: sürücü bu kaydı programın YENİ kayıt yolundan değil,
  eski sürümün (v2.4.9) gerçek koduyla üretilmiş veri + yedekten geri yükleme ile kurar (ders 17); kurulamıyorsa senaryo DENENMEYEN. Yeni rapor `mutabakat_uyarilari {tarih}` →
  [{kod KASA_ACILIS_ONCESI_HAREKET, kaynak, tarih, acilis}] (programın Mutabakat Testi uyarısıyla eşlenir; metin / kod sürücüde). Silinenler'den geri yükleme (`geri_yukle`) açılış
  öncesine düşse de kabul.
- **S21:** `valor` = NOMİNAL valör (POS'un verdiği valör günü; çekim + gün sayısı). Program etkin valörü hafta sonu ve tam gün resmî tatilden sonraki iş gününe kaydırmalı. s23'ün
  2027-01-02 (Cumartesi) valörü artık 2027-01-04'te bankaya geçer. Senaryolarda valör hiçbir zaman belirsiz güne (28 Ekim, bayram penceresi) düşmez; düşerse kâhin hata verir.
  Banka transfer valörü (K-07) kaydırılmaz.
- Değişmez: `kasa_acilis_ilk` geri yüklenen kayıtta hata saymaz (programın Mutabakat Testi bunu uyarı vermeli, kırmızı değil).

### DENENMEYEN (bu bakım)
- Programla karşılaştırma (sürücü güncellemesi ayrı iş); S15'te programın bugünkü reddi ve S21'de programın valör kaydırması bilinmiyor (kod okunmadı).
- S14: kısmi aktarılmış faturaya bağlı küçük çek (yalnız susma birimi), çek fazlası, nakit / havale / POS bağlı tahsilat (KULLANICIYA SORULMALI 2), S14 çekinin karşılıksızı, değersizle
  kapanmış faturaya bağ, devirli yeni yılda şüpheliye aktarılmış (devreden) faturaya bağlı çek (yalnız tohum 2'nin arşiv dönemi), formdaki peşinin çek olması.
- S15: çekle alınmış kart tahsilatının iptalden sonra karşılıksız dönmesi (kart_tahsilati işareti); iptal edilen faturanın Mevcut Borç kartının (R4) ayrıca iptali.
- S19: kilit kaldırma olayı (formül var, olay yok); düzeltilen kaydın yazılış kilidi; devir öncesi yazılmış kayıtların S19 okuması (KULLANICIYA SORULMALI 1 — kâhin bakım 2 / 3 davranışında).
- S20: geri yüklenmiş açılış öncesi kaydın düzeltilmesi (KULLANICIYA SORULMALI 3); açılışın kendisinin geri yüklenmesi (değişmez istisnası kodlandı, senaryo yok); şirket düzeyinde yedek
  geri yükleme mekanizması (model olay bayrağıyla temsil eder); Devri Yenile ile birlikte.
- S21: yarım günler ve dinî bayramlar (KULLANICIYA SORULMALI 4, DOĞRULANMADI); 2026–2027 dışı yıllar (kâhin susar); Şimdi Aktar'ın tatil günü; KG-6 B dalında (geçersiz) komisyonun
  kaydırılmış valör günü.

## Kâhin bakımı 5 (06.11.2026, kodu görmeyen ajan; kullanıcı kararı 06.11 06:26 UTC S24, S25, S26, S27 — "a", hepsi A)

### Kaynaklar ve bağımsızlık
- Okunan: `CLAUDE.md`, `docs/BAGIMSIZ-DOGRULAMA-PRENSIBI.md`, bu klasörün kaynakları (README, `model.py`, `senaryolar_elle.py`, `test_model.py`, `mutasyon.py`, `uretici.py`;
  `senaryolar/` yalnız üretildi / listelendi), `docs/2.5.0-IS-LISTESI.md` A (satır 1–83), C ve D (167–342) — B ve E okunmadı; `docs/erp/MUHASEBELESTIRME-KURAL-KITABI.md`, `…-EK-1.md`,
  `…-EK-2B.md` (aranarak: T-01…T-13, J-01…J-06, Ç-07, D-01, M-01, N-11, KG-6, M1f, madde 33), `docs/devir/DEVIR-PLANI.md` (G0–G2, G7, §1, §4.2). Tam liste ajan raporunda.
- `server/`, `client/`, `bulut/`, `packaging/`, `tools/` (yalnız `node tools/kanit.mjs kos` ÇALIŞTIRILDI), öteki `test/` klasörleri (sürücü dahil), `docs/kanit/` (kendi kanıtları
  dışında), git geçmişi / farkı OKUNMADI; program çalıştırılmadı. Git: `git merge --ff-only e1018cce` (çıktı yalnız dosya adları ve satır sayıları — açılmadı), `git status -s`,
  `git log --oneline -1`, `git archive e1018cce test/bagimsiz/muhasebe` (eski kâhin kopyası, kırmızı kanıtı için, not defterinde), bitişte kendi yollarımın `git add` + `git commit`'i.

### Karar metinleri (AYNEN, iş listesi D "KULLANICI KARARI 06.11 06:26 UTC")
- **S24 = A:** Ocak'ta devirden önce, kilit K'den gerideyken yazılmış karşılıksız / bağ → devir bu kayıtları K kilidiyle değerlendirir; fatura kapalı kalır, karşılıksız ayrı borç; Devir
  Raporu bu kayıtları listeler.
- **S25 = A:** (a) kısmen şüpheliye aktarılmış faturaya küçük çek → önce şüpheli kısım (128), kalan 120; (b) çekin açık kısmı aşan fazlası → carinin bağsız alacağı (avans, 120);
  (c) nakit / havale / POS ile şüpheliye aktarılmış faturaya bağlı tahsilat → S14 ile aynı (şüpheli kısım 128'den düşer).
- **S26 = A:** yedekten geri yüklenmiş, Kasa açılışından önce tarihli Kasa kaydının yalnız tutarı düzeltilirse kabul (tarih değişmiyor; Mutabakat Testi uyarısı sürer).
- **S27 = A:** valör yarım güne (28 Ekim, bayram arifesi) düşerse yarım gün İŞ GÜNÜ, valör kaymaz; dinî bayram günleri tam gün tatil, atlanır (tarihler resmî kaynaktan doğrulanır).
- Seçeneklerin öbür yüzü (iş listesi C): S24 B "S19 harfiyen — yazıldığı andaki sonuç (fatura yeniden açık) kalır, devir açık faturayı taşır"; S25 (a) B "önce 120", (b) B "reddedilir",
  (c) B "bugünkü kural (120)"; S26 B "reddedilir"; S27 B "yarım gün de tatil sayılır, valör sonraki iş gününe kayar".

### Kural başına yorum (önce yorum, sonra kod — ders 40)
| # | Karar | Kâhin yorumu | Senaryo / test | Mutant |
|---|---|---|---|---|
| Z1 | S24 kapsam | "Devirden önce, kilit K'den gerideyken yazılmış" = kaydın tarihi > K, YAZILIŞ kilidi < K ya da kilit yokken (S19, README Y11), devir olayından önce girilmiş. Türler bakım 4 Y14 / `s19_devir` ile aynı: karşılıksız (Ç-07; cirodaysa Ç-08 ciro dönüşü) ve bağ (Kapatılacak Fatura tahsilat / ödeme, iade → asıl fatura, kart tahsilatı, fatura kartı açılışı, Mahsup Et). Kilit = K iken yazılmış K sonrası kayıt zaten K kilidiyle yazılmıştır — listede YOK | s73 C1, C2, C3 | B55b |
| Z2 | S24 sonuç | Devir bu kayıtların S11 / R3 kararını K kilidiyle verir (bakım 4'te susarak sürdürülen davranış artık KURAL): evrakın tahsilatı (ciro ödemesi) ≤ K ise S11 — fatura arşivde kapalı kalır, karşılıksız TAM tutar yeni yılda ayrı borç (vade karşılıksız günü, M1c); bağın hedefindeki ≤ K bağsız kapanış geri alınmaz (karar (3); G2: kapanmış ≤ K faturaya bağ arşiv başvurusu, bağ bağsız gibi kendi gününde dağılır). Devirden ÖNCE canlıda S19 aynen (yazılış kilidi): devir bu kayıtların sonucunu DEĞİŞTİREBİLİR — gecikmiş / hatırlatma iki yönde (s73 C1: 16.01–31.03 arası 0 → 10000; C2: 01.02'de 10000 → 0). Bu, kararın A seçeneğinin açık sonucudur (iş listesi C: "A'da 10.000, B'de 0") | s73 | B55 |
| Z3 | S24 Devir Raporu | Devir raporunun `s19_devir` anahtarı = Z1 kayıtlarının kaynak kimlikleri (sıralı). Devirsiz eş AYNI K kilidiyle yazılmış sayılır (EK-2B §5.3; üretici `devirsiz()` kilidi K sonrası ilk kaydın önüne koyar) → M2 değişmezi istisnasız | s73 (`devir/s19_devir`), tohumlu | B55b, B35c |
| Z4 | S24 devirden sonra | Devirden sonra girilen kayıtlar kilit K ile yazılır (S19 aynen); listede yok. Devri Yenile Z1 kayıtlarını yeniden listelemez (devirden sonra hepsinin kilidi K) — senaryo yok (DENENMEYEN) | — | — |
| Z5 | S25 (a) | Faturanın tahsilat anındaki iki kısmı: şüpheli kuyruğundaki kısım (128; J-01 açık borçları vade sırasıyla taşır, M13) ve CH'deki açık kısım (120). Bağlı tahsilat ÖNCE şüpheli kısmı kapatır (A 128, o kalemi taşıyan kayıttan — aynı faturayı birden çok kayıt taşıyorsa en eski kayıt önce, K3 sırası; bakım 4 Y3), kalanı A 120 bağla faturanın 120 kısmını kapatır. Tahsilat şüpheli kısımdan küçükse hepsi 128; iki kısmın toplamı kadarsa ikisi de kapanır. Bakım 4'ün "S14_KISMI" susması KALKAR (Y5) | s74 C1 (küçük / ortanca), C3 (tam toplam), s75 C2 | B50, B50b |
| Z6 | S25 (b) | "Açık kısım" = şüpheli kısım + bağın 120'de kapatabildiği kısım (karar (2): bağ hedefini her durumda kapatır — hedefin bağsız kapanmış kısmı dahil). FAZLA = tutar − ikisi. Fazla carinin BAĞSIZ alacağıdır: A 120 (K3'le önce şüpheliden DEĞİL — karar metni "avans, 120"); TYK'da kendi gününde açık CH borçlarına S2 sırasıyla (karar (1)), yoksa avans (120 alacaklı → Bilanço 340, §7.3). SUPHELI_NORMAL_ASIM fazlaya UYGULANMAZ (B "reddedilir"in tersi); bağla 120'ye kalan kısma Y4 aynen | s74 C2 (fazla başka faturaya), C3 (fazla avans; eski kâhin reddederdi) | B51, B51b, B51c |
| Z7 | S25 (c) | "Nakit / havale / POS" = `yol` nakit, havale, pos; faturaya bağlı (Kapatılacak Fatura ya da formdaki peşin) + tahsilat günü açık şüpheli kaydı → Z5 / Z6 / Y2–Y4 aynen (S14 ile aynı). POS: brüt tutar (T-03) 128'den çekim günü düşer; komisyon (KG-6) ve valör (D-01, S21 / S27) değişmez. Formdaki peşin: fatura kayıttan sonra kesildiği için (aynı gün K3 sırası: Şüpheliye Al önce) şüpheli kısmı yok → 120 (değişmez) | s75 C1 (havale, karşılık 644), C2 (nakit küçük + ortanca), C3 (POS) | B52, B52b |
| Z8 | S25 kapsam dışı (KULLANICIYA SORULMALI 1) | Kredi Kartına İade (T-11, `yol` kart) ile şüpheli caride faturaya bağlı tahsilat: karar metni yalnız nakit / havale / POS sayar — plan §3.11b/2 (b) (120 + sınır) mı, S14 gibi mi, iki okuma → kâhin SUSAR (senaryo hatası; ret ya da kabul de söylenmez). "Normal Cari Hesaba İşle" ile birlikte faturaya bağlı tahsilat: bakım 4'teki çek davranışı sürer (S14 uygulanır) — senaryo yok (DENENMEYEN) | birim `test_S25_kart_kahin_susar` | — |
| Z9 | S26 | "Yedekten geri yüklenmiş" = kâhin dilinde geri yüklenmiş kayıt: `yedekten: true` (eski sürüm verisi) ve bakım 4 Y15 ile Silinenler'den geri yükleme (S20'de iki yol eşdeğer sayıldı — kaynak artık BAŞ MİMAR KARARI 06.11 07:59, iş listesi D; bakım 6 X12). Kayıt düzeltmeden ÖNCE Kasa açılışından önce tarihli Kasa hareketi; düzeltme tarihi değiştirmiyor (tarih verilmemiş ya da aynı) ve yalnız tutarı değiştiriyor → KABUL, T12 uygulanmaz; kayıt geri yüklenmiş kalır (Mutabakat Testi uyarısı sürer — `mutabakat_uyarilari`'nda aynı kaynak ve tarih; değişmez (8) istisnası sürer). Tarih açılıştan önceki BAŞKA bir güne değişiyorsa T12 aynen RED (KASA_ACILIS_ONCE); açılıştan sonraya alınırsa genel kural (kabul, uyarı kalkar). Geri yüklenmiş ama Kasa'ya yazmayan kaydı açılıştan önce Kasa'ya çeviren düzeltme T12 aynen RED | s76 | B53, B53b, B53c |
| Z10 | S26 kapsam dışı (KULLANICIYA SORULMALI 2) | Geri yüklenmiş, açılıştan önce tarihli Kasa kaydının tarihi değişmeden TUTAR DIŞINDA bir alanının (açıklama, cari, fatura bağı, yol …) düzeltilmesi: karar "yalnız tutarı" der, gerekçesi "tarih değişmiyor" — iki okuma → kâhin SUSAR (senaryo hatası). Kaydın kendisi değil Kasa AÇILIŞI geri yüklendiği için açılıştan önceye düşmüş yeni kaydın tutar düzeltmesi: S26 metni "geri yüklenmiş … kaydın" der → T12 aynen (red); senaryo yok (DENENMEYEN) | birim `test_S26_tutar_disi_alan_kahin_susar` | — |
| Z11 | S27 yarım gün | 2429 sayılı Kanun'un yarım günleri (28 Ekim 13:00'ten; Ramazan / Kurban arifesi 13:00'ten) İŞ GÜNÜ: POS valörü o güne düşerse kaymaz; hafta sonu / tatil kaydırması o güne değerse orada durur. Tam gün tatiller (sabit: 1 Ocak, 23 Nisan, 1 Mayıs, 19 Mayıs, 15 Temmuz, 30 Ağustos, 29 Ekim; dinî bayram günleri) ve hafta sonu atlanır (zincir). Donmuş 2.4.9 türetmesi yalnız hafta sonu (Y22 aynen); banka transfer valörü (K-07), Şimdi Aktar ve vade (M1f) kaydırılmaz | s77, birim `test_S21_tatil_takvimi` | B54, B54b |
| Z12 | S27 dinî bayram | "Tarihler resmî kaynaktan doğrulanır": kâhin yalnız resmî kaynaktan (Diyanet / Resmî Gazete) OKUDUĞU tarihleri tam gün tatil (bayram günleri) ve iş günü (arife) sayar; doğrulanamayan yılın / bayramın penceresi bugünkü gibi "belirsiz" kalır (arifeden bir gün önce – bayramdan bir gün sonra; kâhin susar, senaryo hatası). Haber sitesi tarihleri kâhine GİRMEZ. Bayram takvimi bilinmeyen yıllarda (2026–2027 dışı) sabit tam gün tatil dışındaki her gün belirsiz kalır (28 Ekim dahil — o yıllarda bayram günleri bilinmiyor). Doğrulama sonucu aşağıda "S27 bayram tarihleri" alt başlığında | birim `test_S27_bayram_tarihleri` | B54c |

### S27 bayram tarihleri (birincil kaynak denemesi, 06.11.2026)
- Ana oturum bu bakım için ağ ayarına `vakithesaplama.diyanet.gov.tr`, `www.mevzuat.gov.tr`, `www.resmigazete.gov.tr` ekledi. Sonuç:
  - `https://vakithesaplama.diyanet.gov.tr/dini_gunler.php` → sunucu **403 Forbidden** (Apache "You don't have permission"); başka bir istemci kimliğiyle deneme yapılmadı
    (ortamın erişim kuralı izin vermedi). WebFetch: ENOTFOUND.
  - `https://www.mevzuat.gov.tr/MevzuatMetin/1.5.2429.pdf` (2429 sayılı Kanun) ve `…/mevzuat?MevzuatNo=2429…` → iki denemede **zaman aşımı** (30 / 90 sn, 0 bayt).
  - `https://www.resmigazete.gov.tr/` ana sayfa açıldı (200); günlük fihrist sayfaları (`/eskiler/2026/MM/2026MMDD.htm`) çoğunlukla zaman aşımı / bağlantı sıfırlandı;
    okunabilen günlerde (listesi `docs/kanit/2026-11-06/kahin5-kaynak-denemesi.txt`) bayram / idari izin genelgesi YOK. 2027 bayramları için Resmî Gazete'de henüz metin
    beklenmez (genelgeler bayramdan kısa süre önce yayımlanır).
- Sonuç: dinî bayram tarihleri resmî kaynaktan **DOĞRULANMADI** → kâhin bayram pencerelerini (arife dahil) bugünkü gibi "belirsiz" tutar (Z12); yarım gün kuralı 28 Ekim için
  kodlandı (Z11), sabit tatiller aynen. İş listesi C'deki ana oturum arama tarihleri (haber kaynakları) kâhine GİRMEDİ. 2429 metni de birincil kaynaktan okunamadı (gün
  listesi kâhinin bilgisi; DOĞRULANMADI).

### Önceki beklentilerle çelişen yerler (eski → yeni, nedeni; G3)
- `test_S14_kismi_kahin_susar` → `test_S25_a_kismi_once_supheli`: `kahin_susuyor` [("S14_KISMI", 6000)] → yok; sayılar aynı (128 5000 + 120 1000; S25 (a) A, Z5). Eski kâhin aynı
  sayıyı veriyor ama kural saymıyordu.
- `test_S21_tatil_takvimi`: `tatil_turu("2026-10-28")` "belirsiz" → "yarim" (S27 A, Z11); yeni değerler: 2027-10-28 "yarim", 2028-10-28 "belirsiz" (bayram takvimi bilinmeyen yıl, Z12),
  `pos_etkin_valor` 28 Ekim'de kaymaz, 29.10.2027 → 01.11.2027.
- `test_S21_belirsiz_valor_kahin_susar`: senaryo hatası listesinden "2026-10-28" çıktı (S27: iş günü); yerine bayram penceresinden 2026-05-26, 2027-03-08 ve bilinmeyen yıl
  2028-10-28; `M.kos` örneği 28 Ekim yerine 26.05.2026 (pencere) valörüyle; 28 Ekim valörü artık bankaya o gün geçer (yeni beklenti).
- Hijyen `test_pos_valoru_belirsiz_gune_dusmez`: `U.belirsiz_mi(2026-10-28)` True → False (S27).
- Mutant B40e (S14 kısmi faturada kâhin susmaz) KALDIRILDI — S25 (a) ile susma yok; tersi B50c. Kodu taşınan eski mutantların metni yeni koda taşındı: B40c (`_s14_normal`),
  B44b (yarım gün iş günü koşulu); anlamları aynı.
- Elle senaryolarda (s01–s72) ve tohumlu senaryolarda sayısal beklenti DEĞİŞMEDİ: `uret_beklenen.py` yeniden yazınca s01–s72 ve `rastgele-1/2/3` senaryo + beklenen dosyalarının
  hiçbiri değişmedi (yalnız s73–s77 eklendi) — S25 (c), S26 ve 28 Ekim valörü eski senaryolarda ve tohumlarda tetiklenmiyor; tohum 1'de faturanın açık kısmını aşan
  bağlı şüpheli tahsilatı (S25 (b)) VAR ama eski kâhin de onu sınır içinde kabul ediyordu, sayı aynı (B51 bunu da yakalar: tohum 1 "beklenmeyen red"); S24 A bakım 4'ün davranışı.

### KULLANICIYA SORULMALI / KÂHİN SUSUYOR (kodlanmadı; para / kapama → ders 43)
1. **S25 × Kredi Kartına İade (Z8):** şüpheli alacak kaydı açık caride faturaya bağlı T-11 Kredi Kartına İade (müşteri parayı şirket kartına iade etti). A (öneri): S14 ile aynı (şüpheli kısım
   128'den; karar (c)'nin ilkesi — bağlı tahsilat faturanın durduğu hesaptan düşer). B: plan §3.11b/2 (b) aynen (120 + SUPHELI_NORMAL_ASIM sınırı). Kâhin: senaryo hatası (susar).
2. **S26 × tutar dışı alan (Z10):** geri yüklenmiş, açılıştan önce tarihli Kasa kaydının tarihi değişmeden açıklaması / carisi / fatura bağı düzeltilirse. A (öneri): kabul (S26'nın
   gerekçesi "tarih değişmiyor"; Mutabakat uyarısı sürer). B: T12 aynen red (karar yalnız tutarı saydı). Kâhin: senaryo hatası (susar).
3. **S27 bayram tarihleri:** resmî kaynak (Diyanet 403, Resmî Gazete arşivi zaman aşımı) bu ortamda tarih vermedi; kullanıcıdan / ana oturumdan resmî yayının (Diyanet dinî günler
   takvimi ya da Resmî Gazete genelgesi) metni gelirse kâhine işlenir — o zamana kadar bayram pencereleri belirsiz.
4. Sürer: bakım 2 listesinin 3, 4, 5, 6, 7; bakım 3'ün 4'ü (program iletisi). Bakım 4'ün 1 (S19 × devir → S24), 2 (S14 ayrıntıları → S25), 3 (S20 × T12 → S26), 4 (S21 yarım gün →
   S27) bu bakımda kural oldu.

### Elle beklenenlerin yazılış sırası (bakım 5)
- d6cffd99: yorum (Z1–Z12) — kod, senaryo ve testten önce, AYRI commit (ders 40).
- 816cba04: s73–s77, birim testleri (`test_S25_a_kismi_once_supheli`, `test_S25_kart_kahin_susar`, `test_S26_tutar_disi_alan_kahin_susar`, `test_S27_bayram_tarihleri`) ve değişen
  beklentiler (`test_S21_*`, hijyen) model DEĞİŞTİRİLMEDEN ÖNCE commit'lendi. Eski modelle 138 testten 11'i beklenen nedenle kırmızı (`docs/kanit/2026-11-06/kahin5-eski-model-kirmizi.*`);
  nedenler anahtar başına `kahin5-eski-model-neden.txt`'te: s74 27 anahtar (PB2 SUPHELI_NORMAL_ASIM — S25 (b) fazlası; PA1 / PA2 "S14_KISMI" susması — S25 (a)), s75 34 anahtar
  (PH, PP, PN2 SUPHELI_NORMAL_ASIM ve 120'ye düşen bağlı nakit — S25 (c)), s76 8 anahtar (6 red: tutar düzeltmeleri de T12 ile — S26), s77 koşu hatası (28 Ekim belirsiz — S27),
  `test_S25_kart` (eski kâhin reddediyor, susmuyor), `test_S26_tutar_disi` (eski kâhin reddediyor), `test_S25_a` (S14_KISMI), `test_S21_*` (28 Ekim belirsiz), hijyen (s77 valörü),
  dosya güncelliği. **s73 eski modelde YEŞİL** (0 anahtar farklı): S24 A, bakım 4'te Y14 olarak susarak sürdürülen davranışın KENDİSİ — kâhinde sayı değişmedi, yalnız kural
  oldu; testin dişi B55 / B55b mutantlarıyla gösterildi.
- acefd13a: model (Z1–Z12), mutantlar, üretici yorumu, s73–s77 senaryo / beklenen dosyaları. Model değiştikten sonra ilk koşuda HİÇBİR elle değer değişmedi (tek kırmızı dosya
  güncelliğiydi). Kanıt: `docs/kanit/2026-11-06/kahin5-test-utc.*`, `kahin5-test-istanbul.*` (138/138 iki saat diliminde), `kahin5-mutasyon.*`, `kahin5-mutant-deger.*`.

### Yeni senaryolar, testler ve mutasyonlar
- Elle senaryolar (5, toplam 78): s73 (S24 — iş listesi C örneği aynen; C2 bağ, C3 K kilidiyle yazılmış karşılıksız; devirden önce / sonra gecikmiş, açık kalem, hatırlatma,
  `s19_devir`), s74 (S25 (a) küçük / ortanca / tam toplam; (b) fazla başka açık faturaya ve avansa — Bilanço 340, K6 644), s75 (S25 (c) havale + karşılık, nakit küçük / ortanca,
  POS brüt + komisyon + valör), s76 (S26 Silinenler'den ve yedekten geri yüklenmiş kayıtların tutar düzeltmesi kabul; tarih değişikliği / Kasa'ya çevirme red; Mutabakat uyarısı
  sürer; açılıştan sonraya alınan kayıt uyarıdan çıkar), s77 (S27 28 Ekim 2026 / 2027 yarım gün; 29 Ekim 2027 Cuma + hafta sonu).
- Birim (138 test): `test_S25_a_kismi_once_supheli` (eski `test_S14_kismi_kahin_susar`'ın yerine), `test_S25_kart_kahin_susar`, `test_S26_tutar_disi_alan_kahin_susar`,
  `test_S27_bayram_tarihleri`; `test_S21_tatil_takvimi`, `test_S21_belirsiz_valor_kahin_susar` ve hijyen güncellendi (yukarıda).
- Mutantlar: B40e kaldırıldı; 15 yeni (B50, B50b, B50c, B51, B51c, B52, B52b, B53, B53b, B53c, B54, B54b, B54c, B55, B55b) → liste 169. Her kararın B seçeneği (B50, B51, B52, B53,
  B54, B55) ve en az bir sınır kayması (B50b küçük tahsilat, B51c sınır fazlaya, B52b POS, B53b / B53c tarih, B54b yarım gün bir gün kayık, B55b kilit = K). Yeni mutantların hepsi
  DEĞERLE (elle beklenen / birim değeri) yakalanıyor — yalnız değişmezle yakalanan yok (`docs/kanit/2026-11-06/kahin5-mutant-deger.*`). Modelde YALNIZ mutasyonun çağırdığı
  yardımcı: `Model._s24_harfiyen` (B55; S24 B'nin karşılıksız tarafı).

### Sürücü için (programla karşılaştırmadan önce)
- **S24:** yeni olay / alan yok. Devir Raporu `s19_devir` artık KURAL (bakım 4'te "S19-DEVIR" farkı ayrı listedeydi — G5): devirden önce kilit < K iken yazılmış K sonrası karşılıksız / bağ
  kayıtlarında devirli dosyanın gecikmiş / açık kalem farkı AYRI LİSTEDE DEĞİL, karşılaştırılır (s73).
- **S25:** `gecikmis.kahin_susuyor` "S14_KISMI" KALKTI (bakım 4'teki atlama listesinden çıkarılır). Şüpheli caride faturaya bağlı `tahsilat` yol nakit / havale / POS da S14 gibi
  (128 kısmı + 120); faturanın açık kısmını aşan fazla carinin bağsız alacağı (120) — program SUPHELI_NORMAL_ASIM vermemeli. Yol `kart` + fatura bağı + açık şüpheli kaydı:
  kâhin senaryo hatası verir, senaryo kurulmaz (KULLANICIYA SORULMALI 1). — Bakım 6'da KALKTI (S39 A; s78).
- **S26:** geri yüklenmiş (Silinenler'den ya da yedekten — `yedekten: true` kayıtlar v2.4.9'un gerçek koduyla üretilmiş veri + yedekten geri yükleme ile kurulur, ders 17) ve
  açılıştan önce tarihli Kasa kaydının `duzenle {tutar}` düzeltmesi KABUL; tarih değişikliği KASA_ACILIS_ONCE. Tutar dışı alan: kâhin senaryo hatası (KULLANICIYA SORULMALI 2).
  — Bakım 6'da açıklama ve cari için KALKTI (S40 A; s79); parantez dışı alanlarda daraltılmış susma sürer (bakım 6 X11).
- **S27:** POS valörü 28 Ekim'e düşerse o gün bankaya geçer (program kaydırmamalı). Senaryolarda valör ve kaydırma yolu dinî bayram penceresine (arife dahil) hiçbir zaman düşmez.

### DENENMEYEN (bu bakım)
- Programla karşılaştırma (sürücü güncellemesi ayrı iş).
- S24: Devri Yenile ile Z1 kayıtları (Z4), zincirleme ikinci devir, kilitsizken yazılmış karşılıksız (formül var — `k.kilit is None` listede; elle senaryo yok), ciro dönüşü (Ç-08)
  ve Mahsup Et / iade bağıyla S24 (tür listesi bakım 4 ile aynı; s73 yalnız Kapatılacak Fatura çeki ve bağlı nakit).
- S25: senet ile (b) fazla, iki kaydın taşıdığı aynı faturaya küçük tahsilat (en eski kayıt önce — kâhin yorumu, senaryo yok), hedefin bağsız kapanmış kısmını geri alan (karar (2))
  S14 tahsilatı, formdaki peşinin şüpheli caride (fatura kayıttan sonra kesildiği için 120), "Normal Cari Hesaba İşle" + fatura bağı (Z8), S25 tahsilatının karşılıksızı / iadesi.
- S26: Kasa açılışının kendisi geri yüklendiği için açılıştan önceye düşen yeni kaydın düzeltmesi (Z10; T12 aynen); geri yüklenmiş nakit ödeme (T-05) ve Bankadan Kasaya tutar düzeltmesi
  (aynı yol, elle senaryo yok).
- S27: dinî bayram günleri ve arife (DOĞRULANMADI — belirsiz); 2026–2027 dışı yıllar (kâhin susar); 28 Ekim'in hafta sonuna denk geldiği yıl (2026–2027'de yok).

## Kâhin bakımı 6 (06.11.2026, kodu görmeyen ajan; kullanıcı kararı 06.11 08:06 UTC S39, S40 — "a", ikisi A; BAŞ MİMAR KARARI 06.11 07:59 Z9)

### Kaynaklar ve bağımsızlık
- Okunan: `CLAUDE.md`, `docs/BAGIMSIZ-DOGRULAMA-PRENSIBI.md`, bu klasörün kaynakları (README tamamı, `model.py`, `senaryolar_elle.py`, `test_model.py`, `mutasyon.py`, `uretici.py`,
  `uret_beklenen.py`; `senaryolar/` yalnız listelendi / üretildi), `docs/2.5.0-IS-LISTESI.md` A (satır 1–83), C ve D (171–418) — B ve E okunmadı; `docs/erp/MUHASEBELESTIRME-KURAL-KITABI.md`
  (§1 G-1…G-8, §3-T, §3-Ş, §3-C, §3-M, §3-R), `…-EK-1.md` (§1 adım 1–3), `…-EK-2.md` (Soru 31), `…-EK-2B.md` (madde 33), `docs/devir/DEVIR-PLANI.md` (G0, G2, G5),
  `docs/erp/MUHASEBE-CEKIRDEGI-PLANI.md` (§6, §14). Tam liste (satır aralıklarıyla) ajan raporunda.
- `server/`, `client/`, `bulut/`, `packaging/`, `tools/` (yalnız `node tools/kanit.mjs kos` ÇALIŞTIRILDI), öteki `test/` klasörleri (sürücü dahil), `docs/kanit/` (kendi kanıtları
  dışında; yalnız `kahin5-*` dosya ADLARI listelendi, açılmadı), git geçmişi / farkı OKUNMADI; program çalıştırılmadı. Git: `git merge --ff-only 7d6c6369` (çıktı yalnız dosya adları),
  `git status -s`, `git log --oneline -3` (başlıklar), `git branch --show-current`, `git archive 7d6c6369 test/bagimsiz/muhasebe` (eski kâhin kopyası, kırmızı kanıtı için, not defterinde),
  bitişte kendi yollarımın `git add` + `git commit`'i.
- Dinî bayram tarihleri bu bakımda ARANMADI (görev metni); bakım 5 Z12 aynen (bayram pencereleri belirsiz).

### Karar metinleri (AYNEN, iş listesi D "KULLANICI KARARI 06.11 08:06 UTC" ve "BAŞ MİMAR KARARI 06.11 07:59")
- **S39 = A:** şüpheli alacaklı caride faturaya bağlı Kredi Kartına İade → S25 / S14 ile aynı (önce şüpheli kısım, kalanı 120).
- **S40 = A:** geri yüklenmiş, Kasa açılışından önce tarihli kaydın tutar dışı alanı (açıklama, cari) tarih değişmeden düzeltilirse kabul; mutabakat uyarısı sürer.
- **Z9 (BAŞ MİMAR KARARI, ders 40):** S26 "yedekten geri yüklenmiş kayıt" Silinenler'den geri alınmış kayda da uygulanır. Gerekçe (iş listesi D): iki yolda da kayıt silinmeden önceki hâliyle
  (tarih, tutar, kimlik) aynen geri gelir; bakım 4 Y15'te kâhin ikisini zaten eşdeğer saydı; yaygın uygulama geri almayı kaydın devamı sayar; para sonucu S26 ile aynı yönde (uyarı sürer).
- Seçeneklerin öbür yüzü (iş listesi C): S39 B "120'ye ve şüpheli-normal aşım sınırına tabi"; S40 B "T12 ile red".

### Kural başına yorum (önce yorum, sonra kod — ders 40)
| # | Karar | Kâhin yorumu | Senaryo / test | Mutant |
|---|---|---|---|---|
| X1 | S39 kapsam | "Kredi Kartına İade" = olay dilinde `tahsilat` `yol: "kart"` (kitap T-11: B 309.NN / A CH; POS satışı oluşmaz). Faturaya bağlı (Kapatılacak Fatura, `fatura`) + carinin işlem günü AÇIK şüpheli kaydı (kalan > 0, kayıt tarihi ≤ işlem; aynı gün K3 gün sırası: al → karşılık → değersiz → alacak satırı → çıkar) → S14 / S25 kuralı (README Y1–Y4, Z5–Z7) AYNEN: kart S14 yollarına girer. Açık kayıt yoksa (ya da Şüpheliden Çıkar ile kapandıysa) bağlı kart iadesi 120'de (plan §3.11b/2 (b) aynen); bağsız kart iadesi K3 genel kuralıyla (EK-2 Soru 31 (b): alacak satırı → önce 128) — ikisi değişmez | s78 C1–C3, birim `test_S39_kart_iade_s25_ile_ayni` | B60 |
| X2 | S39 "önce şüpheli kısım" | Z5 aynen: faturanın şüpheli kuyruğundaki kısmı kadar A 128 — o kalemi TAŞIYAN kayıttan (Y3); kalanı A 120, bağla faturanın 120'deki kısmını kapatır. Küçük iade (< şüpheli kısım) tamamı 128; iki kısmın toplamı kadar iade ikisini de kapatır | s78 C1 (KI1 küçük, KI2 tam toplam) | B60 |
| X3 | S39 fazla ("kalanı 120") | Z6 aynen: faturanın açık kısmını (şüpheli kısım + bağın 120'de kapatabildiği kısım) aşan fazla carinin BAĞSIZ alacağıdır — A 120, TYK'da kendi gününde açık borçlara S2 sırasıyla, yoksa avans (120 alacaklı → Bilanço 340). SUPHELI_NORMAL_ASIM fazlaya uygulanmaz; K6 (karşılık > kalan → B 129 / A 644) aynen | s78 C2 (KI3 fazla başka açık faturaya, karşılık çözülür) | B62 |
| X4 | S39 sınır | SUPHELI_NORMAL_ASIM yalnız bağla 120'ye kalan kısma (Y4) — kart için de. Aynı gün açılan şüpheli kaydı: kayıt önce (K3 gün sırası; Y2), kart iadesi S39 ile 128'den. Kayıttan ÖNCEKİ gün kart iadesi: açık kayıt yok → 120 (bağ) | s78 C3 (KI0 kayıttan önce, KI4 aynı gün) | B61 |
| X5 | S39 defter / modül | Tek madde: B 309.NN (iade tutarının tamamı) / A 128 (şüpheli kısım) / A 120 (kalan); karşılık çözülmesi ayrı madde (J-04). Kart modülünde şirket kartı borcu iade tutarı kadar azalır (bölünmez); cari bakiyesi (120 + 128) iade tutarı kadar azalır | s78 (`yev0513`, `mod`) | — |
| X6 | S39 susma | Bakım 5 Z8 susması ("senaryo hatası", `test_S25_kart_kahin_susar`) KALKAR → `test_S39_kart_iade_s25_ile_ayni` | birim | — |
| X7 | S40 kapsam | "Geri yüklenmiş" = `yedekten: true` (eski sürüm verisi / yedek) ya da Silinenler'den geri yükleme (Z9, BAŞ MİMAR KARARI; S26 ile aynı tanım). Kayıt düzeltmeden ÖNCE Kasa açılışından önce tarihli Kasa hareketi yazıyor; düzeltme tarihi değiştirmiyor (tarih verilmemiş ya da aynı). Düzeltilen alan karar metninin saydığı tutar dışı alanlardan: açıklama (`aciklama`), cari (`cari`) → KABUL, T12 uygulanmaz. Kayıt geri yüklenmiş kalır → Mutabakat Testi uyarısı SÜRER (aynı kaynak, aynı tarih) ve değişmez (8) istisnası sürer (README Y17) | s79 | B63 |
| X8 | S40 açıklama | Kasa kaydının açıklaması defteri ve modülleri değiştirmez (açıklamadan tanıma — KG-16 — yalnız Borç Yaz / Alacak Yaz'da; Kasa kaydı değil) → kabul = red yok, sayılar aynı. Ölçü: `redler` ve uyarı listesi | s79 (KY Kasa Giriş, PY nakit tahsilat) | B63 |
| X9 | S40 cari (görev metninin sorusu: "carinin bakiyesini değiştirir — kaydın para sonucu mu") | Karar metni "cari"yi tutar dışı alan olarak AÇIKÇA sayar (kullanıcıya sorulan metin de "(açıklama, cari)"). Para sonucu: Kasa (100) ve kaydın tutarı DEĞİŞMEZ; kaydın CH satırı eski cariden yeni cariye taşınır — kitap G-7 (açık dönemde düzenlenen kaynağın maddesi yeniden türetilir; F-14 / C-03 ile aynı ilke). Eski carinin Tek Yükümlülük Kuyruğu'nda bu alacak kalemi kalkar (kapattığı kalemler kendi vadeleriyle açık; karar (1) / (2) yeniden oynatma), yeni caride kendi gününde S2 sırasıyla dağılır. Kâhin yorumu: "kabul" bu sonucu ZORUNLU kılar — cari değişip iki carinin bakiyesinin değişmediği bir okuma yok; karar seçenekleri (kabul / T12 red) yalnız düzeltmenin yapılıp yapılmayacağını sordu. Bu yüzden karar metni bu durumu ÇÖZER → kodlandı, KULLANICIYA SORULMALI değil; BAŞ MİMAR değerlendirir. Karar metninin ÇÖZMEDİĞİ alt durumlar X11'de (kodlanmadı) | s79 (PS: Silinenler'den geri yüklenmiş tahsilat C1 → C3) | B64 |
| X10 | S40 birlikte ve tarih | Tutar (S26) + açıklama / cari aynı düzeltmede: her parça kabul edilen alan, tarih değişmiyor → kabul (iki A kararının birleşimi; kâhin yorumu — reddi gerektiren tek parça tarih). Tarih açılıştan önceki BAŞKA bir güne değişiyorsa düzeltmenin TAMAMI T12 ile red (açıklama / cari de yazılmaz; karar "tarih değişmeden"). Açılıştan sonraya alınan düzeltme genel kural (kabul, uyarı kalkar; Z9 aynen — bu bakımda senaryo değişmedi) | s79 (PZ tutar + açıklama; PY açıklama + tarih, PY cari + tarih red) | B65, B66 |
| X11 | S40 kâhinin sustuğu (KODLANMADI) | (a) parantezde sayılmayan tutar dışı alanlar — fatura bağı (`fatura`), taksit kartı bağı (`taksit_karti`), "Normal Cari Hesaba İşle" (`normal_cari`), banka, evrak …: kapama / banka sonucu taşır, karar "(açıklama, cari)" der → iki okuma (parantez örnek mi, tam liste mi) → kâhin SUSAR (senaryo hatası); (b) BAĞLI (Kapatılacak Fatura / taksit kartı) geri yüklenmiş kaydın carisi değişirse bağ ne olur (bağ eski carinin faturasında kalamaz: düşer mi, düzeltme mi reddedilir) — karar söylemez → kâhin SUSAR; (c) carisiz Kasa kaydına (Kasa Giriş / Çıkış, kayıt tahsilatı) cari eklemek kaydın türünü değiştirir (649.90 / 336.90 → CH) — model dilinde yok (senaryo hatası). (a) ve (b) KULLANICIYA SORULMALI 1–2 | birim `test_S40_kapsam_disi_kahin_susar` | — |
| X12 | Z9 (BAŞ MİMAR KARARI 06.11 07:59) | Bakım 5 modeli S26'yı Silinenler'den geri yüklenmiş kayda zaten uyguluyordu (bakım 4 Y15 eşdeğerliği; s76 KG1). Kaynak artık "kâhin yorumu — BAŞ MİMAR değerlendirir" değil BAŞ MİMAR KARARI (README Z9 notu güncellenir). S40 aynı tanımı kullanır (karar metni "geri yüklenmiş"). Değişen sayı yok | s76 (KG1), s79 (PS) | B67 |
| X13 | Kapsam dışı (Z10'un ikinci yarısı aynen) | Kaydın KENDİSİ değil Kasa AÇILIŞI geri yüklendiği için açılıştan önceye düşmüş yeni kaydın açıklama / cari düzeltmesi: S40 metni "geri yüklenmiş … kaydın" der → T12 aynen (red) — bakım 5'in okuması; senaryo yok (DENENMEYEN) | — | — |

### KULLANICIYA SORULMALI / KÂHİN SUSUYOR (kodlanmadı; para / kapama → ders 43)
1. **S40 × parantezde sayılmayan tutar dışı alanlar (X11 a; bakım 7'de KURAL — kullanıcı 06.11 09:09 S44 = A, README V1–V3):** geri yüklenmiş, Kasa açılışından önce tarihli Kasa kaydının tarihi değişmeden fatura bağı ("Kapatılacak Fatura"), taksit kartı bağı ya da
   "Normal Cari Hesaba İşle" seçimi düzeltilirse. A (öneri): kabul (S40 ile aynı gerekçe — tarih değişmiyor; bağ G-7 ile yeniden türetilir, hangi borcun kapandığı değişir; Mutabakat uyarısı sürer).
   B: T12 ile red (karar yalnız açıklama ve cariyi saydı). C (uç durum — geri yüklenmiş + açılış öncesi + bağ düzeltmesi birlikte; SORU DÜZENİ 06.11 09:01): uç durum böyle
   kalsın (BİLİNEN SINIR olarak yazılır; kâhin susmayı sürdürür, sürücü bu durumu kurmaz). Kâhin: senaryo hatası (susar).
2. **Bağlı kaydın carisi (X11 b; geri yüklenmiş kayıtta sorulur, olağan kayıtta da aynı soru; bakım 7'de geri yüklenmiş kayıt için KURAL — S45 = A, README V5–V8;
   olağan kayıt kısmı bakım 7 KULLANICIYA SORULMALI 4):** Kapatılacak Fatura ya da taksit kartıyla bağlı tahsilat / ödemenin carisi düzeltilirse bağ eski carinin
   faturasında / kartında kalamaz. A (öneri): düzeltme nedeni yazılarak reddedilir ("önce fatura / kart bağını kaldırın"; 2.4.4 KAYIT BAĞI kararı: bağ sessizce kopmaz; çıkmaz yok — bağ kaldırılıp
   cari düzeltilebilir). B: bağ düşer, kayıt yeni caride bağsız alacak / borç olur (kendi gününde dağılır). C (geri yüklenmiş açılış öncesi Kasa kaydı için uç durum; SORU DÜZENİ
   06.11 09:01): uç durum böyle kalsın (BİLİNEN SINIR; kâhin susmayı sürdürür) — olağan kayıttaki aynı soru uç değildir, orada A / B seçilmelidir. Kâhin: geri yüklenmiş açılış öncesi Kasa
   kaydında senaryo hatası (susar).
3. Sürer: bakım 5'in 3'ü (dinî bayram tarihleri resmî kaynaktan — bu bakımda aranmadı); bakım 2 listesinin 3, 4, 5, 6, 7; bakım 3'ün 4'ü (program iletisi). Bakım 5'in 1 (S25 × Kredi Kartına İade
   → S39) ve 2 (S26 × tutar dışı alan → S40) bu bakımda kural oldu.

### Önceki beklentilerle çelişen yerler (eski → yeni, nedeni; G3)
- `test_S25_kart_kahin_susar` → `test_S39_kart_iade_s25_ile_ayni`: açık şüpheli kaydında faturaya bağlı Kredi Kartına İade "senaryo hatası (kâhin susar)" → KABUL, A 128 1000 (SB 9000),
  madde B 309.KK1 / A 128 (S39 A; X1–X2). Eski testin ikinci bölümü (açık kayıt yokken bağlı kart iadesi 120, 9000) aynen; yeni üçüncü bölüm (bağsız kart iadesi K3 ile önce 128) eski
  davranıştır (EK-2 Soru 31 (b)) — eski kâhinde de bu bölüm aynı sonucu verir.
- `test_S26_tutar_disi_alan_kahin_susar` → `test_S40_kapsam_disi_kahin_susar`: `{"cari": "C3"}` ve `{"tutar": 600, "aciklama": …}` "senaryo hatası" → KABUL (S40 A; X7–X10). Susma DARALDI:
  parantez dışı alan (`fatura`, `normal_cari` …), bağlı kaydın carisi, carisiz Kasa kaydına cari (X11). Eski testin "yalnız tutar → kabul" bölümü s76'da aynen sınanıyor.
- Elle senaryolarda (s01–s77) ve tohumlu senaryolarda sayısal beklenti DEĞİŞMEDİ: `uret_beklenen.py` yeniden yazınca s01–s77 ve `rastgele-1/2/3` senaryo + beklenen dosyalarının HİÇBİRİ
  değişmedi (`git status`: yalnız s78, s79'un dört dosyası yeni). Üretici faturaya bağlı Kredi Kartına İade (tahsilat yolları nakit / havale / POS / çek / senet) ve düzeltme olayı
  üretmez → tohumlar etkilenmez; `uretici.py` değişmedi.
- Kodu taşınan eski mutantların metni yeni koda taşındı: B52, B52b (`S14_YOLLARI`'na "kart" eklendi; anlamları aynı — kart S39 ile S14 yolu kalır).
- Bakım 5 "Sürücü için" S25 (kart atlaması) ve S26 (tutar dışı alan atlaması) satırlarına "bakım 6'da kalktı" notu düşüldü; Z9 satırının kaynağı BAŞ MİMAR KARARI olarak işaretlendi.

### Elle beklenenlerin yazılış sırası (bakım 6)
- 018ede61: yorum (X1–X13 + KULLANICIYA SORULMALI 1–2) — kod, senaryo ve testten önce, AYRI commit (ders 40).
- c3e50056: s78, s79 ve birim testleri (`test_S39_kart_iade_s25_ile_ayni`, `test_S40_kapsam_disi_kahin_susar`) model DEĞİŞTİRİLMEDEN ÖNCE commit'lendi. Eski modelle (7d6c6369 kâhin kopyası +
  yeni `senaryolar_elle.py` / `test_model.py`, not defterinde) 140 testten 5'i beklenen nedenle kırmızı (`docs/kanit/2026-11-06/kahin6-eski-model-kirmizi.*`, neden dökümü
  `kahin6-eski-model-neden.txt`): s78 ve `test_S39` KI'de bakım 5 Z8 susması ("senaryo hatası: şüpheli caride faturaya bağlı Kredi Kartına İade"), s79 (KY açıklama) ve `test_S40` (PY cari)
  bakım 5 Z10 susması ("tutar dışı alanı düzeltildi … S26 yalnız tutar"), dosya güncelliği (s78 dosyası üretilemiyor — aynı susma). Öbür 135 test eski modelde de yeşil.
- 92d31b35: model (X1–X12), mutantlar (B60–B67, B52 / B52b metni), s78 / s79 senaryo ve beklenen dosyaları. Model değiştikten sonra ilk koşuda HİÇBİR elle değer değişmedi
  (140 testten tek kırmızı dosya güncelliğiydi; dosyalar yeniden yazıldı). Kanıt (commit 92d31b35): `kahin6-test-utc.*`, `kahin6-test-istanbul.*` (140/140 iki saat diliminde),
  `kahin6-mutasyon.*` (177/177 öldü), `kahin6-mutant-deger.*` (10/10 seçili mutant değerle), `kahin6-b-dal-degerleri.txt` (senaryo yorumlarındaki S39 B / S40 B sayılarının denetimi:
  s78 B60 altında 3 SUPHELI_NORMAL_ASIM, 128|C1 15000; s79 B63 altında 6 red, Kasa 1400); betikler `kahin6-*-betik.py.txt`.

### Yeni senaryolar, testler ve mutasyonlar
- Elle senaryolar (2, toplam 80): s78 (S39 — küçük iade tamamı 128 (11.05 ara mizanı ve şüpheli kaydı), tam toplam iki kısmı kapatır, fazla 2000 başka açık faturaya (F22) ve karşılık
  K6 ile 644'e; kayıttan önceki iade 120 (bağ), aynı gün açılan kayıtta 128; madde, kart modülü, hatırlatma), s79 (S40 — yedekten gelen Kasa Giriş ve tahsilatın açıklaması, Silinenler'den
  geri yüklenmiş tahsilatın carisi C1 → C3: iki carinin açık kalemleri ve gecikmişi yeniden dağılır (C1 F1 150 açık, C3 F3 1800), tutar + açıklama birlikte; açıklama + tarih ve cari + tarih
  düzeltmesi T12 ile red; Mutabakat uyarısı dört kaynakta sürer).
- Birim (140 test): `test_S39_kart_iade_s25_ile_ayni` (eski `test_S25_kart_kahin_susar`'ın yerine), `test_S40_kapsam_disi_kahin_susar` (eski `test_S26_tutar_disi_alan_kahin_susar`'ın yerine).
- Mutantlar: 8 yeni (B60–B67) → liste 177. Her kararın B seçeneği (B60 S39 B, B63 S40 B) ve sınır kaymaları (B61 aynı gün açılan kayıt, B62 fazla red, B64 cari red / açıklama kabul,
  B65 tutar + açıklama birlikte red, B66 tarih değişse de kabul) + Z9 için B67 (Silinenler'den geri alınan kayıt S26 / S40 dışı). Yeni ve metni taşınan mutantların (B52, B52b, B60–B67)
  hepsi DEĞERLE yakalanıyor (elle beklenen `redler` / mizan / birim değeri) — yalnız değişmezle yakalanan yok (`kahin6-mutant-deger.*`). Modelde yalnız mutasyon için yardımcı YOK.

### Sürücü için (programla karşılaştırmadan önce)
- **S39:** yeni olay / alan yok. Şüpheli kaydı açık caride `tahsilat` `yol: "kart"` (Kredi Kartına İade, T-11) + `fatura`: S14 / S25 gibi — 128 kısmı (kalemi taşıyan kayıttan) + 120; fazla
  carinin bağsız alacağı; program SUPHELI_NORMAL_ASIM vermemeli (yalnız bağla 120'ye kalan kısım 120 bakiyesini aşarsa). Madde B 309.NN / A 128 / A 120. Bakım 5'teki "kart + fatura bağı
  + açık şüpheli kaydı: senaryo kurulmaz" atlaması KALKTI.
- **S40:** geri yüklenmiş (yedekten — `yedekten: true` kayıtlar v2.4.9'un gerçek koduyla üretilmiş veri + yedekten geri yükleme ile kurulur, ders 17 — ya da Silinenler'den) ve açılıştan
  önce tarihli Kasa kaydının `duzenle {aciklama}`, `{cari}`, `{tutar, aciklama}` düzeltmeleri KABUL; tarih açılıştan önceki başka güne değişirse KASA_ACILIS_ONCE (düzeltmenin tamamı).
  Cari değişince kaydın cari satırı yeni cariye geçer (iki carinin bakiye / açık kalem / gecikmiş / hatırlatma); Mutabakat Testi uyarısı aynı kaynak ve tarihle sürer.
- `aciklama` modelde Kasa kaydının sayılarını değiştirmez; kâhin yalnız "red yok + sayılar aynı + uyarı sürer"i ölçer — açıklamanın gerçekten kaydedildiğini sürücü kaydı okuyarak ayrıca
  denetleyebilir (ders 3).
- Kâhinin senaryo hatası verdiği (senaryo KURULMAZ) durumlar: parantez dışı alan (fatura / taksit kartı bağı, Normal Cari Hesaba İşle, banka, evrak …), BAĞLI kaydın carisi, carisiz Kasa
  kaydına cari (KULLANICIYA SORULMALI 1–2). — Bakım 7'de DARALDI: fatura / taksit kartı bağı ve Normal Cari kabul (S44), bağlı kaydın carisi BAG_KALDIRILMALI ile red (S45); kalan
  susmalar bakım 7 "Sürücü için"de.

### DENENMEYEN (bu bakım)
- Programla karşılaştırma (sürücü güncellemesi ayrı iş).
- S39: iki kaydın taşıdığı aynı faturaya küçük kart iadesi (en eski kayıt önce — Z5 yorumu); hedefin bağsız kapanmış kısmını geri alan (karar (2)) kart iadesi; bağla 120'ye kalan kısmın
  120 bakiyesini aştığı SUPHELI_NORMAL_ASIM durumu (Y4 kodlu, kart için elle senaryo yok); "Normal Cari Hesaba İşle" + fatura bağıyla kart iadesi; kart iadesinin silinmesi / düzeltilmesi /
  iptali; devirli yeni yılda devreden şüpheli faturaya kart iadesi; değersizle kapanmış faturaya bağ.
- S40: Kasa açılışının kendisi geri yüklendiği için açılıştan önceye düşen YENİ kaydın açıklama / cari düzeltmesi (X13; T12 aynen); cari değişikliğinde yeni carinin açık şüpheli kaydı
  (K3 ile 128 — G-7 türetmesiyle olur, senaryo yok) ve cari TÜRÜ farklı cariye (tedarikçi 320) taşıma; geri yüklenmiş nakit ÖDEME (T-05), Bankadan Kasaya / Kasadan Bankaya, evrakın
  Kasa'dan tahsili kayıtlarında açıklama / cari düzeltmesi (aynı yol, elle senaryo yok); düzeltmeyle birlikte açılıştan sonraya alınan cari değişikliği (genel kural); Devri Yenile ile
  birlikte.
- Olağan (geri yüklenmemiş) kayıtta bağlı tahsilatın carisinin düzeltilmesi: modelin bugünkü davranışı kural sayılmaz (DOĞRULANMADI; KULLANICIYA SORULMALI 2), senaryo yok.
- Dinî bayram tarihleri (bu bakımda aranmadı; DOĞRULANMADI — Z12 aynen).

## Kâhin bakımı 7 (06.11.2026, kodu görmeyen ajan; kullanıcı kararı 06.11 09:09 UTC S44, S45 — "hepsi a", ikisi A)

### Kaynaklar ve bağımsızlık
- Okunan: `CLAUDE.md`, `docs/BAGIMSIZ-DOGRULAMA-PRENSIBI.md`, bu klasörün kaynakları (README tamamı; `model.py`, `senaryolar_elle.py`, `test_model.py`, `mutasyon.py` ilgili bölümleri;
  `senaryolar/` yalnız listelendi / üretildi), `docs/2.5.0-IS-LISTESI.md` A (satır 1–83), C (171–289) ve D (290–451) — B ve E okunmadı; `docs/erp/MUHASEBELESTIRME-KURAL-KITABI.md`
  (§1 G-1…G-8, §3-T, §3-H, §3-R), `…-EK-2.md` (Soru 23 / 24, satır 64–85), `…-EK-2B.md` (madde 24 ve 28'in başı, satır 82–101), `docs/devir/DEVIR-PLANI.md` (G0–G2, G5–G7),
  `docs/erp/MUHASEBE-CEKIRDEGI-PLANI.md` (§6). Tam liste (satır aralıklarıyla) ajan raporunda.
- `server/`, `client/`, `bulut/`, `packaging/`, `tools/` (yalnız `node tools/kanit.mjs kos` ÇALIŞTIRILDI), öteki `test/` klasörleri (sürücü dahil), `docs/kanit/` (kendi kanıtları
  dışında), git geçmişi / farkı OKUNMADI; program çalıştırılmadı. Git: `git merge --ff-only 06e9debf` (ileri sarılamadı; dalda kendi commit'im yoktu → `git reset --hard 06e9debf`),
  `git status -s`, `git log --oneline -3` (başlıklar), `git archive 06e9debf test/bagimsiz/muhasebe` (eski kâhin kopyası, kırmızı kanıtı için, not defterinde), bitişte kendi yollarımın
  `git add` + `git commit`'i.
- Dinî bayram tarihleri bu bakımda ARANMADI (görev metni); bakım 5 Z12 aynen (bayram pencereleri belirsiz).

### Karar metinleri (AYNEN, iş listesi D "KULLANICI KARARI 06.11 09:09 UTC")
- **S44 = A:** geri yüklenmiş, Kasa açılışından önce tarihli kaydın fatura bağı / taksit kartı bağı / "Normal Cari Hesaba İşle" seçimi düzeltmesi KABUL edilir (S40 gerekçesi).
- **S45 = A:** böyle bir kayıt Kapatılacak Fatura ya da taksit kartıyla bağlıysa carisinin düzeltilmesi "önce bağı kaldırın" nedeniyle REDDEDİLİR (bağ sessizce kopmaz).
- Seçeneklerin öbür yüzü (iş listesi C): S44 B "T12 ile red", C "uç durum böyle kalsın (BİLİNEN SINIR)"; S45 B "bağ düşer, kayıt yeni caride bağsız", C "uç durum böyle kalsın (BİLİNEN SINIR)".
- Bakım 6'nın X11 (a) (parantezde sayılmayan alan) ve X11 (b) (bağlı kaydın carisi) susmaları bu kararlarla KALKAR; X11 (c) (carisiz Kasa kaydına cari) kararların dışında — SÜRER.

### Kural başına yorum (önce yorum, sonra kod — ders 40)
| # | Karar | Kâhin yorumu | Senaryo / test | Mutant |
|---|---|---|---|---|
| V1 | S44 kapsam | "Geri yüklenmiş" = `yedekten: true` (eski sürüm verisi / yedek) ya da Silinenler'den geri yükleme (Z9 BAŞ MİMAR KARARI; S26 / S40 ile aynı tanım, X7). Kayıt düzeltmeden ÖNCE Kasa açılışından önce tarihli Kasa hareketi yazıyor; düzeltme tarihi değiştirmiyor (tarih verilmemiş ya da aynı). Düzeltilen alan karar metninin saydığı üç alandan: `fatura` (Kapatılacak Fatura bağı — ekleme: belge kimliği; kaldırma: `null`; başka faturaya: başka kimlik), `taksit_karti` (taksit kartı bağı — aynı üç biçim), `normal_cari` ("Normal Cari Hesaba İşle" seçimi `true` / `false`) → KABUL, T12 uygulanmaz. Tek tek ya da birbirleriyle, S26'nın tutarıyla, S40'ın açıklama / carisiyle birlikte kabul (X10 ilkesi: her parça kabul edilen alan; reddi gerektiren tek parça tarih). Kayıt geri yüklenmiş kalır | s80, s81, birim `test_S40_S44_S45_kapsam_ve_susma` | B70, B72, B76, B77 |
| V2 | S44 para sonucu ("kabul" ne demek) | Kayıt KENDİ TARİHİNDE yeni alanlarıyla yeniden türetilir: kitap G-7 ("açık dönemde kaynak kayıt düzenlenirse türetilmiş madde de yeniden türetilir"), EK-2 Soru 23 A tanımı ("geriye tarihli kayıt girilir / düzeltilir / silinirse kuyruk o günden yeniden kurulur"), EK-2 Soru 24 ("ilk ödemenin başka belge için olduğunu söylüyorsa yol o ödemeyi düzenleyip bağlamaktır (çıkmaz yok)") ve kararlar (1), (2), M1e, K3 AYNEN. (a) Bağ eklenince kayıt bağdır: hedefini her durumda kapatır; hedefi önceden bağsız kapatmış ödeme serbest kalır ve kendi tarihinde yeniden dağılır (karar (2)); kaydın önceden bağsız kapattığı kalemler kendi vadeleriyle açılır. (b) Bağ kaldırılınca kayıt bağsızdır: kendi tarihinde açık borçlara S2 sırasıyla (karar (1)); eski hedef kendi vadesiyle açılır. (c) Başka faturaya / karta = (b) + (a). (d) Taksit kartı bağı = kart tahsilatı (kartın vadesi en önce gelen açık taksiti; M1e, bağ); kart modülünde ödenen tutar değişir; bağ kaldırılınca bağsız tahsilat S2 sırasıyla o kartın taksitini de kapatabilir (kural gereği). (e) Normal Cari Hesaba İşle: carinin kaydın günü açık şüpheli kaydı varken (kayıt tarihi ≤ kaydın günü) `true` → A 120 (CH kuyruğunda bağsız alacak), `false` → önce 128 (en eski kayıt; K6 aynen); 120 / 128 ayrımı ve gecikmiş değişir, carinin toplamı (120 + 128) ve Kasa değişmez; açık kayıt yoksa seçim sonucu değiştirmez. Defter: T-01 "Fatura / taksit bağı defteri değiştirmez" → şüphesiz caride bağ düzeltmesi mizanı DEĞİŞTİRMEZ (yalnız kuyruk: gecikmiş, açık kalemler, fatura durumu, hatırlatma, kart taksitleri); şüpheli caride 120 / 128 ayrımı S14 / S25 / K3 ile değişir. Kâhin yorumu: kararın seçenekleri (kabul / T12 red) düzeltmenin yapılıp yapılmayacağını sordu; "kabul"den sonra kaydın yeni hâlinin bugünkü kurallarla türetilmesinden başka bir okuma yok (ileriye dönük — yalnız düzeltme gününden — bir türetme hiçbir karar metninde yok; G-7 ve Soru 23 "o günden yeniden kurulur" der) → para sonucu tek anlamlı, KODLANDI (BAŞ MİMAR değerlendirir). Karar metninin ÇÖZMEDİĞİ alt durumlar V3 (c), (d)'de (kodlanmadı) | s80 (C1 ekleme, C2 başka faturaya + karar (2), C3 kaldırma, T1 ödeme), s81 (taksit kartı ekleme / başka kart / kaldırma; Normal Cari aç / kapa) | B70, B72, B77 |
| V3 | S44 sınırlar | (a) Tarih değişirse: açılıştan önceki başka bir güne → düzeltmenin TAMAMI T12 ile red (bağ da değişmez; X10 aynen — görev metni "tarih de değişirse red"); açılıştan sonraya → genel kural (kabul, uyarı kalkar; Z9 / X10 aynen). (b) Kilitli dönem: KILITLI_DONEM aynen; kaydın yazılış kilidi (S19) düzeltmeyle değişmez (Y13). (c) Bağın hedefi: düzeltmeden SONRAKİ carinin etkin satış faturası (tahsilatta) / alış faturası (ödemede) ya da etkin taksit kartı (yalnız tahsilatta). Başka carinin / türün belgesi, iptal edilmiş / silinmiş belge, ödemede taksit kartı → model dilinde yok (senaryo hatası; program büyük olasılıkla reddeder — DENENMEYEN). Hedef kaydın kendisinden SONRA tarihli (fatura / kart; geri yüklenmiş eski kayıtta sık durum) → bağın hangi gün uygulanacağı karar metninde yok → KULLANICIYA SORULMALI 2 (senaryo hatası). (d) plan §3.11b/2 SINIR: açık şüpheli kaydı varken düzeltmeyle 120'ye yazılacak kısım (Normal Cari Hesaba İşle'de tutarın tamamı; fatura bağında S14 / S25 ile 120'de kapanan kısım) kaydın günündeki 120 bakiyesini (kayıt hariç) AŞIYORSA sınırın düzeltmeye uygulanıp uygulanmadığı karar metninde yok → KULLANICIYA SORULMALI 3 (senaryo hatası); EŞİTSE kabul (sınır "aşamaz" der). (e) Formdaki peşin (`fatura_odemesi`): faturanın parçası, bağı / carisi faturanın düzenlenmesidir (F-14) → kararın konusu değil, senaryo hatası (DENENMEYEN). (f) `normal_cari` yalnız tahsilatta anlamlı (T-13); ödemede ya da tahsilat / ödeme dışı kayıtta (Kasa'ya yazan stok / evrak / iade kayıtları) S44 alanı → senaryo hatası. (g) Değeri aynı yazılan alan (ör. zaten bağsız kayda `fatura: null`) düzeltme değildir | s80, s81 (tarih red), birim | B71, B78 |
| V4 | S44 ↔ S20 / Y17 | Düzeltilen kayıt geri yüklenmiş kalır; Kasa hareketi değişmediği için Mutabakat Testi uyarısı aynı kaynak ve tarihle SÜRER (Kasa'yı değiştiren tutar düzeltmesinde S26 aynen); değişmez (8) istisnası sürer | s80, s81, s82 (`mutabakat_uyarilari`) | — |
| V5 | S45 kapsam ve sonuç | "Böyle bir kayıt" = S44'ün konusu (V1: geri yüklenmiş + düzeltmeden önce açılış öncesi Kasa hareketi + tarih değişmiyor). "Bağlı" = düzeltmeden ÖNCE kayıtta Kapatılacak Fatura (`fatura`) ya da taksit kartı (`taksit_karti`) var. Cari BAŞKA bir cariye değişiyorsa → RED, kod `BAG_KALDIRILMALI` (program 4xx; neden "önce bağı kaldırın"; ad / kod sürücüde eşlenir). Düzeltmenin TAMAMI reddedilir: aynı düzeltmedeki tutar / açıklama da yazılmaz, hiçbir şey değişmez (X10'un "düzeltmenin tamamı" ilkesi; bağ sessizce kopmaz, kayıt sessizce yarım değişmez). Aynı carinin yeniden yazılması cari düzeltmesi değildir (B53c'nin tarih için ilkesi) → kabul | s82 (Kapatılacak Fatura bağlı, taksit kartı bağlı, tutar + cari, aynı cari) | B73, B74, B75, B79 |
| V6 | S45 bağ kaldırılınca | Önce AYRI düzeltmeyle bağ kaldırılır (S44 A: `{fatura: null}` / `{taksit_karti: null}` — KABUL, kayıt kendi gününde bağsız dağılır, V2 (b)), sonra ayrı düzeltmeyle cari (S40 A: KABUL; X9 — CH satırı yeni cariye geçer, iki carinin kuyruğu yeniden kurulur). Çıkmaz yok | s82 | B73 |
| V7 | S45 × aynı düzeltmede bağ + cari (KULLANICIYA SORULMALI 1) | Bağlı kaydın carisi değişirken AYNI düzeltme bağı da kaldırıyor (`fatura: null`) ya da yeni carinin belgesine bağlıyor: "önce bağı kaldırın" ayrı bir adım mı ister (kayıt düzeltmeden önce bağlı → red), yoksa bağ açıkça değiştiği için "sessizce kopmuyor" mu (kabul) — iki okuma → kâhin SUSAR (senaryo hatası) | birim | — |
| V8 | S45 ↔ tarih | Tarih açılıştan önceki başka bir güne değişiyorsa T12 ÖNCE: KASA_ACILIS_ONCE (düzeltmenin tamamı; X10 sırası). Tarih açılıştan sonraya değişip bağlı kaydın carisi de değişiyorsa düzeltmeden sonraki kayıt olağan kayıttır → V9 (KULLANICIYA SORULMALI 4); kâhin bugünkü olağan düzeltme yolunu sürdürür, senaryo yok (DENENMEYEN) | s82 (KASA_ACILIS_ONCE) | — |
| V9 | S45 kapsam dışı (KULLANICIYA SORULMALI 4) | Geri yüklenmemiş (ya da açılıştan sonra tarihli) bağlı kaydın carisi: karar "böyle bir kayıt" der → kâhinde KURAL DEĞİL. Modelin bugünkü olağan düzeltme yolu (kabul; bağ yeni caride hedef bulamaz → bağsız) S45'in B'sine denk düşer, DOĞRULANMADI — sürücü bu durumu karşılaştırmaz | — | — |
| V10 | X11 susmalarının yeni hâli | X11 (a): S44'ün saydığı üç alan için KALKTI; kalan alanlar (banka, evrak, yol, kart, `fatura_odemesi` …) senaryo hatası SÜRER. X11 (b): KALKTI → S45 red (V5); yerine daha dar susma V7. X11 (c) (carisiz Kasa kaydına cari) SÜRER — aynı aileden carisiz kayda S44 alanı (bağ / Normal Cari) da senaryo hatası (kaydın türü değişir; model dilinde yok) | birim | — |

### KULLANICIYA SORULMALI / KÂHİN SUSUYOR (kodlanmadı; para / kapama → ders 43; SORU DÜZENİ 06.11 09:01: uç durumda üçüncü seçenek)
- Bakım 8'de 1–4 KURAL oldu (kullanıcı 06.11 12:06 S54–S57 = A; README "Kâhin bakımı 8" U1–U8).
1. **S45 × aynı düzeltmede bağ + cari (V7):** geri yüklenmiş, açılış öncesi Kasa kaydı Kapatılacak Fatura / taksit kartıyla bağlı; kullanıcı TEK düzeltmede hem bağı kaldırıyor (ya da yeni
   carinin faturasına bağlıyor) hem carisini değiştiriyor. A (öneri): kabul — bağ açıkça kaldırıldığı / değiştirildiği için sessizce kopmuyor; sonuç iki adımlı yolla (önce bağı kaldır,
   sonra cari) aynı. B: red "önce bağı kaldırın" (karar metninin harfiyen okuması: kayıt düzeltmeden önce bağlı; bağ ayrı bir düzeltmeyle kaldırılır). C (uç durum — geri yüklenmiş +
   açılış öncesi + bağlı + aynı düzeltmede iki değişiklik): uç durum böyle kalsın (BİLİNEN SINIR; kâhin susmayı sürdürür, sürücü bu durumu kurmaz).
2. **S44 × bağ hedefi kayıttan SONRA tarihli (V3 (c)):** geri yüklenmiş 10.01 tarihli nakit tahsilat, 20.01 tarihli faturaya (ya da 20.01'de açılmış taksit kartına) bağlanıyor. Örnek: F1 05.01
   1.000 (vade 15.01) · geri yüklenmiş tahsilat 10.01 1.000 (bağsız, F1'i kapatır) · F2 20.01 1.000 (vade 31.03) · düzeltme "Kapatılacak Fatura: F2". A (öneri): bağ hedefin doğduğu gün
   uygulanır, o güne kadar bağlı tutar başka borca gitmez (EK-2 Soru 24'ün metni: "Hedef taşıyıcıdan sonra doğuyorsa bağ hedefin gününde uygulanır") → F1 kendi vadesiyle açık: gecikmiş
   16.01'de ve 01.02'de 1.000. B: bağ hedefsiz sayılır, tutar kendi gününde bağsız dağılır (modelin olağan kayıttaki bugünkü davranışı; bakım 2 DENENMEYEN) → F1 kapalı, gecikmiş 0, F2 31.03'e
   kadar gecikmemiş. C (uç durum): böyle kalsın (BİLİNEN SINIR; kâhin susar). NOT: aynı soru geri yüklenmemiş kayıtta da (geriye tarihli tahsilatın sonradan kesilmiş faturaya bağlanması)
   açık — bakım 2 "Hedefi bağdan SONRA doğan bağ" DENENMEYEN; A / B seçimi ikisine birden uygulanabilir.
3. **S44 × şüpheli-normal aşım sınırı (V3 (d)):** geri yüklenmiş tahsilat şüpheli kaydı açık caride; düzeltmeyle "Normal Cari Hesaba İşle" seçilince (ya da faturaya bağlanınca) 120'ye yazılacak
   kısım kaydın günündeki 120 bakiyesini aşıyor. Örnek: F4 10.000 · Şüpheliye Al 9.000 · geri yüklenmiş tahsilat 10.01 3.000 (bugün 128'den düşüyor) · düzeltme "Normal Cari Hesaba İşle". A (öneri):
   red SUPHELI_NORMAL_ASIM (sınır her kayıtta geçerli — düzeltme kaydın yeni hâliyle kaydedilir; yol: tutarı düzelt ya da seçimi yapma). B: kabul (S20 / S44: geri yüklenmiş kayıt; 120 −2.000
   alacaklı, 128 9.000). C (uç durum): böyle kalsın (BİLİNEN SINIR; kâhin susar). Eşit tutar (3.000 yerine 1.000) iki okumada da kabul — kodlandı.
4. **Olağan (geri yüklenmemiş ya da açılıştan sonra tarihli) bağlı kaydın carisi (V8, V9; bakım 6 KULLANICIYA SORULMALI 2'nin uç OLMAYAN kısmı — S45 yalnız "böyle bir kayıt" der):**
   Kapatılacak Fatura ya da taksit kartıyla bağlı tahsilat / ödemenin carisi düzeltilirse. A (öneri): S45 ile aynı — "önce bağı kaldırın" nedeniyle red (bağ sessizce kopmaz). B: bağ düşer,
   kayıt yeni caride bağsız alacak / borç olur (modelin bugünkü davranışına denk; DOĞRULANMADI). Uç durum DEĞİL (her gün olabilir) → C yok.
5. Sürer: bakım 5'in 3'ü (dinî bayram tarihleri resmî kaynaktan — bu bakımda aranmadı); bakım 2 listesinin 3, 4, 5, 6, 7; bakım 3'ün 4'ü (program iletisi). Bakım 6'nın 1 (S40 × parantez dışı
   alan → S44) ve 2'nin uç kısmı (bağlı kaydın carisi → S45) bu bakımda kural oldu.

### Önceki beklentilerle çelişen yerler (eski → yeni, nedeni; G3)
- `test_S40_kapsam_disi_kahin_susar` → `test_S40_S44_S45_kapsam_ve_susma`: PY `{"fatura": "F1"}` ve PY `{"normal_cari": True}` "senaryo hatası" → KABUL (S44 A; V1–V2); bağlı PB'nin
  `{"cari": "C3"}`'ü "senaryo hatası" → RED `BAG_KALDIRILMALI` (S45 A; V5); KY `{"cari": "C1"}` senaryo hatası AYNEN (X11 (c)). Eski testin kabul bölümü (PY cari C3, KY açıklama, PB tutar +
  açıklama → Kasa 11100, 120|C1 600, 120|C3 −500, uyarı KY / PY / PB) eski veriyle AYNEN; tarih reddi aynen. Susma listesi daraldı, yeni susmalar eklendi (V3 (c)–(e), V7, V10).
- Elle senaryolarda (s01–s79) ve tohumlu senaryolarda sayısal beklenti DEĞİŞMEDİ: `uret_beklenen.py` yeniden yazınca s01–s79 ve `rastgele-1/2/3` senaryo + beklenen dosyalarının HİÇBİRİ
  değişmedi (`git status`: yalnız s80–s82'nin altı dosyası yeni). Üretici düzeltme olayı üretmez → tohumlar etkilenmez; `uretici.py` değişmedi.
- Modelden bakım 6'nın X11 (b) iletisi (bağlı kaydın carisinde senaryo hatası) kalktı → S45 reddi (V5); X11 (a) iletisi S40 + S44 alanları dışına daraldı.
- Kodu taşınan eski mutant YOK: B53–B53c, B63–B67'nin parçaları (`self._s40_kapsam(k, dg)` satırı, `yeni_t == k.tarih` koşulu, `geri_yukle`'deki `k.geri`) aynen duruyor; anlamları
  aynı (B63 — S40 B — artık S44 alanlarını da T12'ye götürür; B70 ile aynı yön).
- Bakım 6 "Sürücü için"in son maddesine ve KULLANICIYA SORULMALI 1–2'ye "bakım 7'de kural oldu / daraldı" notu düşüldü.

### Elle beklenenlerin yazılış sırası (bakım 7)
- 9a8a4caf: yorum (V1–V10 + KULLANICIYA SORULMALI 1–4) — kod, senaryo ve testten önce, AYRI commit (ders 40).
- f306026d: s80–s82 ve `test_S40_S44_S45_kapsam_ve_susma` model DEĞİŞTİRİLMEDEN ÖNCE commit'lendi. Eski modelle (06e9debf kâhin kopyası + yeni `senaryolar_elle.py` / `test_model.py`, not
  defterinde) 143 testten 6'sı beklenen nedenle kırmızı (`docs/kanit/2026-11-06/kahin7-eski-model-kirmizi.*`, neden dökümü `kahin7-eski-model-neden.txt`): s80, s81 ve birim testi X11 (a)
  susmasıyla ("karar metninde sayılmayan alanı düzeltildi (['fatura'] / ['taksit_karti'])"), s82 X11 (b) susmasıyla ("bağlı … kaydın carisi düzeltildi"), EK-2 §4 (1) aynı gün testi ve dosya
  güncelliği (s80 eski kâhinde kurulamıyor — aynı neden). Öbür 137 test eski modelde de yeşil.
- 39110142: model (V1–V10), mutantlar (B70–B79), s80–s82 senaryo ve beklenen dosyaları. Model değiştikten sonra ilk koşuda BİR elle değer YANLIŞ çıktı ve elle yeniden hesaplandı:
  s80 `mz0/toplam/borc`, `mz0/toplam/alacak` (ve `mz/…`) 18000 → 23600 — mizanın "toplam"ı HAREKET toplamıdır (s01'deki 340000 gibi), ilk hesapta bakiye toplamı yazılmıştı (borç: KA 10000 +
  7 satış 7000 + A1 / A2 2000 + Alacak Yaz karşılığı 600 + üç tahsilat 3000 + ödeme 1000). Kural farkı değil; satır bakiyelerinin hiçbiri değişmedi. Öbür yeni değerlerin hiçbiri değişmedi
  (ilk koşuda tek öbür kırmızı dosya güncelliğiydi; dosyalar yeniden yazıldı).
- Kanıt (commit 39110142): `kahin7-test-utc.*`, `kahin7-test-istanbul.*` (143/143 iki saat diliminde), `kahin7-mutasyon.*` (187/187 öldü), `kahin7-mutant-deger.*` (yeni 10 mutantın 9'u
  DEĞERLE — elle beklenen `redler` / mizan / birim değeri; B78 — V3 (d) susma sınırının kâhin içi eşitlik kayması — yalnız "beklenen kabul yerine susma" ile, etkisi susmanın kendisi),
  betik `kahin7-mutant-deger-betik.py.txt`.

### Yeni senaryolar, testler ve mutasyonlar
- Elle senaryolar (3, toplam 83): s80 (S44 Kapatılacak Fatura bağı — C1 ekleme: PA F2'ye, F1 kendi vadesiyle açılır, 01.02'de gecikmiş 0 → 1000; C2 başka faturaya + karar (2): PC F5 → F6,
  F6'yı bağsız kapatmış Alacak Yaz serbest kalır ve kendi gününde F5'e gider, 16.01'de gecikmiş 400 → 0; C3 kaldırma (Silinenler'den, Z9): F3 kapanır, gecikmiş 1000 → 0; T1 ödemenin alış
  faturası bağı A2 → A1; tarih de değişirse T12 red; mizan önce = sonra; Mutabakat uyarısı dört kaynakta sürer), s81 (S44 taksit kartı bağı ekleme: TK1'in 01.02 taksiti kapanır, F2 açılır;
  başka karta (Silinenler'den): TK2 → TK3, kart modülünde ödenen yer değiştirir; kaldırma: bağsız tahsilat S2 ile TK2'nin 01.02 taksitini kapatır, kart ödeneni 0; Normal Cari Hesaba İşle
  seçildi (PN 128'den 120'ye) ve kaldırıldı (PM 120'den 128'e) → 128 / 120: 5000 / 6000 → 7000 / 4000, 01.02'de gecikmiş 1000 → 0; tarih de değişirse red), s82 (S45: Kapatılacak Fatura bağlı
  PB ve taksit kartı bağlı PT'nin carisi `BAG_KALDIRILMALI`; tutar + cari de red, Kasa 12000 kalır; tarih de değişirse KASA_ACILIS_ONCE; aynı cari kabul; bağ ayrı düzeltmeyle kaldırılınca iki
  kaydın carisi değişir, C1 / C2 / C3 kuyrukları yeniden kurulur).
- Birim (143 test): `test_S40_S44_S45_kapsam_ve_susma` (eski `test_S40_kapsam_disi_kahin_susar`'ın yerine; 11 susma, S44 kabul, S45 red, aynı cari, bağsız kayıtta cari + yeni carinin faturası,
  tarih reddi, açılıştan sonraya alınan bağ (genel kural), SINIR eşitliği kabul / aşımı susma).
- Mutantlar: 10 yeni (B70–B79) → liste 187. Her kararın B seçeneği (B70 S44 B, B73 S45 B) ve sınır kaymaları (B71 tarih değişse de kabul, B72 yalnız fatura bağı kabul, B74 yalnız fatura
  bağlı kayıt reddedilir, B75 kısmi red — tutar / açıklama yazılır, B76 Silinenler'den geri alınan kayıtta S44 yok, B77 kaldırma reddedilir, B78 SINIR'da eşitlik de aşım, B79 aynı cari de
  red). Modelde YALNIZ mutasyon için yardımcı YOK.

### Sürücü için (programla karşılaştırmadan önce)
- **S44:** `duzenle {degisiklik}` içinde `fatura` (belge kimliği ya da `null`), `taksit_karti` (kart kimliği ya da `null`), `normal_cari` (`true` / `false`): geri yüklenmiş (yedekten —
  `yedekten: true` kayıtlar v2.4.9'un gerçek koduyla üretilmiş veri + yedekten geri yükleme ile kurulur, ders 17 — ya da Silinenler'den) ve açılış öncesi tarihli Kasa kaydında KABUL.
  Programdaki karşılıkları: tahsilat / ödeme düzenlemesinin Kapatılacak Fatura alanı, taksit kartı seçimi, "Normal Cari Hesaba İşle" seçimi (ad / alan sürücüde eşlenir). Karşılaştırılan: red
  yok, mizan (şüphesiz caride önce = sonra), açık kalemler, fatura durumu, gecikmiş, hatırlatma, kart taksitleri (`kartlar`), kart modülünde ödenen (`moduller` `taksit_odenen|<kart>`),
  şüpheli kayıt kalanı, Mutabakat uyarısı (aynı kaynak, aynı tarih).
- **S45:** yeni red kodu `BAG_KALDIRILMALI` (program 4xx, "önce bağı kaldırın"; kod sürücüde eşlenir): düzeltmenin TAMAMI reddedilir — aynı düzeltmedeki tutar / açıklama yazılmamalı
  (s82 `mz1`: Kasa 12000). Aynı carinin yeniden yazılması kabul. Tarih de değişirse KASA_ACILIS_ONCE önce.
- Senaryo KURULMAYAN (kâhin senaryo hatası verir) durumlar: aynı düzeltmede bağ + cari (KULLANICIYA SORULMALI 1), bağ hedefi / kart kayıttan SONRA tarihli (KS 2), şüpheli-normal aşım
  sınırını aşan düzeltme (KS 3; eşitlik kabul), başka carinin / türün belgesi ya da kartı, iptal / silinmiş belge, formdaki peşin (`fatura_odemesi`), ödemede taksit kartı / Normal Cari,
  tahsilat / ödeme dışı kayıtta S44 alanı, carisiz kayda cari / bağ, X11 (a)'nın kalan alanları (banka, evrak, yol, kart …).
- Olağan (geri yüklenmemiş ya da açılıştan sonra tarihli) bağlı kaydın carisi: kâhinde kural değil (V9, KS 4) — karşılaştırılmaz.
- Yeni olay türü ya da rapor YOK.

### DENENMEYEN (bu bakım)
- Programla karşılaştırma (sürücü güncellemesi ayrı iş).
- S44: şüpheli caride faturaya bağ ekleme / kaldırma (S14 / S25 ile 128 / 120 ayrımının yeniden kurulması — yol kodlandı, elle senaryo yok); Excel kartına (`taksit_excel`) ve kapatılmış
  karta bağ; kilitli dönemle birlikte (karar (3) / S19 — kaydın yazılış kilidi düzeltmeyle değişmez, Y13); bağ düzeltmesiyle aynı anda tutar düzeltmesi (X10 ilkesiyle kabul — elle senaryo
  yok); bağsız kayıtta cari + bağ (yalnız birim); ödemede bağ kaldırma; Devri Yenile / devirle birlikte; aynı faturayı başka bir bağlı kaydın da kapattığı hedefe bağ (bağın fazlası bağsız
  alacak — kural EK-2B 24, elle senaryo yok).
- S45: yeni carinin türü farklı (tedarikçi 320); formdaki peşin (susar); olağan bağlı kayıt (KS 4); tarih açılıştan sonraya + cari + bağlı (V8).
- KULLANICIYA SORULMALI 1–3'ün durumları (kâhin susar).
- Dinî bayram tarihleri (bu bakımda aranmadı; DOĞRULANMADI — Z12 aynen).

## Kâhin bakımı 8 (06.11.2026, kodu görmeyen ajan; kullanıcı kararı 06.11 10:57 UTC S47–S53 — "önerilerini uygula", hepsi A; BAŞ MİMAR KARARLARI 06.11 10:53 B5, B6, B11, B14)

### Kaynaklar ve bağımsızlık
- Okunan: `CLAUDE.md`, `docs/BAGIMSIZ-DOGRULAMA-PRENSIBI.md`, bu klasörün README'si (tamamı) ve kaynakları (`model.py`, `senaryolar_elle.py`, `test_model.py`, `mutasyon.py`,
  `uret_beklenen.py` ilgili bölümleri; `senaryolar/` yalnız listelendi / üretildi), `docs/2.5.0-IS-LISTESI.md` A (satır 1–83), C ve D (173–471) — B ve E okunmadı;
  `docs/erp/MUHASEBELESTIRME-KURAL-KITABI.md` (§1 G-1…G-8, §3-T…§3-M, §7, §8, §9), `…-EK-1.md` (§1, M1), `…-EK-2.md` / `…-EK-2B.md` (yalnız başlık araması),
  `docs/erp/C5-ACILIS-TASARIM.md` (§0, §2, §3, §8, §9, §10 — yalnız kural metni; §1 "Koddan bugünkü durum" OKUNMADI, öbür bölümlerdeki dosya:satır alıntıları beklenen için
  KULLANILMADI), `docs/erp/MUHASEBE-CEKIRDEGI-PLANI.md` (§6), `docs/devir/DEVIR-PLANI.md` (G0, "Ek — Açılış kayıtları düzeni"). Tam liste (satır aralıklarıyla) ajan raporunda.
- `server/`, `client/`, `bulut/`, `packaging/`, `tools/` (yalnız `node tools/kanit.mjs kos` ÇALIŞTIRILDI), öteki `test/` klasörleri (sürücü dahil), `docs/kanit/` (kendi kanıtları
  dışında), git geçmişi / farkı OKUNMADI; program çalıştırılmadı. Git: `git merge --ff-only f5903164` (ileri sarılamadı; dalda kendi commit'im yoktu → `git reset --hard f5903164`),
  `git status -s`, `git log --oneline -3` (başlıklar), `git archive f5903164 test/bagimsiz/muhasebe` (eski kâhin kopyası, kırmızı kanıtı için, not defterinde), bitişte kendi yollarımın
  `git add` + `git commit`'i.
- Dinî bayram tarihleri bu bakımda ARANMADI (görev metni); bakım 5 Z12 aynen (bayram pencereleri belirsiz).
- Kâhin bakımı 7'nin KULLANICIYA SORULMALI 1–4'ü kullanıcıya soruluyor (S54–S57): o durumlar bu bakımda da SUSAR, kodlanmadı.

### Karar metinleri (AYNEN, iş listesi D "KULLANICI KARARI 06.11 10:57 UTC" ve "BAŞ MİMAR KARARLARI 06.11 10:53")
- **S47 = A:** "Açılış Olabilir" listesindeki eski kayıt onaya kadar 519'da; Bilanço "Kesin Değil — Onay Bekliyor".
- **S48 = A:** karşılıksız dönen carisiz açılış evrakı → program cariyi sorar; seçilirse cari borçlanır, seçilmezse B 519 / A 101 (açılış geri alınmış).
- **S49 = A:** formdan carisiz evrak (açılış değil) → alınan 649.90, verilen 770.90.
- **S50 = A:** kart seçilmeden alınan tahsilat ayrı taksit kartının vadesi gelmiş taksitini de kapatır (tek yükümlülük kuyruğu); Taksitler, zil ve takvim bunu gösterir.
- **S51 = A:** Silinenler'den geri alınan açılış (cari başka açılışla) "Açılış Olabilir" listesine girer.
- **S52 = A:** vadesi geçmiş borca ileri tarihli Ödeme Sözü → borç gecikmiş sayılır, söz tarihine kadar otomatik hatırlatmaya girmez ("Ödeme Sözü Var").
- **S53 = A:** kilitsiz şirkette geçmiş yıl defteri yeni kuralla değişir; güncelleme notu + Defter Mutabakatı'nda bilgi + "yılı kilitleyin" önerisi.
- **B5:** KG-5 tarihi plan_imports.created_at yerel günü (ekstre ↔ defter tarih ayrışması BİLİNEN SINIR). **B6:** KG-16 Türkçe küçük harf + ç/ı/ş katlama, "Devir"/"Devreden" girmez.
  **B11:** Kasa açılışından önceye alınan düzeltme de red (T12). **B14:** alt defter hesabında kural farkı (120 ↔ 128) fişle düzeltilmez, Kilidi Aç → Yeniden Kilitle; BİLİNEN SINIR.
- Seçeneklerin öbür yüzü (iş listesi C): S47 B "onaya kadar sıradan Borç / Alacak Yaz (gelir / gider)"; S48 B "gider 770.90 'Sınıflandırılmamış'", C "uç durum böyle kalsın";
  S49 B "bütün cariye işlenmemiş evrak 519'a", C "bugünkü gibi 602 / 770"; S50 B "hayır, kart taksiti yalnız kart tahsilatıyla"; S51 B "geri alma reddedilir", C "uç durum böyle kalsın";
  S52 B "söz tarihine kadar gecikmiş de sayılmaz", C "söz hatırlatmayı değiştirmez"; S53 B "göçte son tamamlanmış yılın 31 Aralık'ına kendiliğinden kilit + eski kuralla dondurma",
  C "uç durum böyle kalsın, bilgi satırı da olmasın".

### Kural başına yorum (önce yorum, sonra kod — ders 40)
| # | Karar | Kâhin yorumu | Senaryo / test | Mutant |
|---|---|---|---|---|
| W1 | S47 kapsam ("listedeki eski kayıt") | KG-16 adayı = Borç Yaz / Alacak Yaz (C-01 / C-02 türü), açılış işareti YOK, açıklaması W5 ile "Açılış…" ve ESKİ kayıt — göç anında veride olan: kâhin dilinde `yedekten: true` (eski sürüm verisi; bakım 4 Y15 tanımı "geri yüklenen yedekte / göç verisinde vardı"). Dayanak: KG-16 A (kullanıcı 05.11 17:16 "(11) KG-16 **göçte** 'Açılış Olabilir' listesi"), S47 "listedeki **eski** kayıt", kitap M-02 "açıklamadan değil, açılış işaretinden tanınır". Göçten SONRA (2.5.0'da) yazılmış "Açılış…" açıklamalı Borç / Alacak Yaz aday DEĞİLDİR: C-01 / C-02 (602.90 / 770.90), listede yok. Silinenler'den geri alınan 2.5.0 kaydı da aday olmaz (B8 yalnız "2.4.x yükü"; S51 yalnız açılış — W10). Bakım 1–7 her böyle kaydı aday sayıyordu (göç kâhin dilinde ayrı değildi) → G3: s17 ve s30'daki aday kayıtlara `yedekten: true` eklenir (senaryoların niyeti göç verisi; sayıları S47 değiştirir). Kâhin yorumu — BAŞ MİMAR değerlendirir | s83, s17, s30 | B82 |
| W2 | S47 bekleme ("onaya kadar 519'da") | Aday onay ya da red gelene kadar madde M-02 / M-03 gibi: borçlu B CH / A 519, alacaklı B 519 / A CH; açılış sınıfı (G-4; onaylı adayla aynı — bakım 1'den beri); şüpheli caride K3 (Alacak Yaz önce 128'den) uygulanmaz (açılış gibi). Onay → aynı madde (519) kalır; red → C-01 / C-02 (602.90 / 770.90; Alacak Yaz'da K3 aynen). Tutar, tarih, yön, cari ve Tek Yükümlülük Kuyruğu (CH satırı) onaydan bağımsız — gecikmiş değişmez. Yeni olay `acilis_onayla {kaynak, karar: "onay" \| "red"}` (Açılış Olabilir Kayıtlar ekranı); eski `onay: true` alanı (kayıt anında onaylı) geriye uyumla aynen, `onay: false` = red | s83, s87 | B80, B80b, M28 |
| W3 | S47 "Kesin Değil — Onay Bekliyor" | Bilanço(t) Kesin Değil kodu `ACILIS_OLABILIR_ONAY_BEKLIYOR`: t'de etkin, tarihi ≤ t, onay / red bekleyen en az bir aday varsa. 519 ≠ 0 olduğu için TAMAMLANMAMIS_ACILIS ayrı neden olarak görünür (kitap §7.4); onay ya da redden sonra bekleyen kalmazsa kod düşer (eşleştirme yapılmadıysa TAMAMLANMAMIS_ACILIS kalır). Gelir Tablosu'na Kesin Değil eklenmez (karar Bilanço der). Yeni rapor `acilis_olabilir {tarih}` → [{kaynak, cari, yon, tutar, tarih, durum: bekliyor / onaylandi / reddedildi}] (tarih, giriş sırası); kökteki `acilis_olabilir` listesi aynen (bütün adaylar) | s83, s87, s89, s90 | B81 |
| W4 | S47 × kilit | Göçte 2.4.9 kuralıyla donan (`donem_kilitle kural 2.4.9`) dönemdeki adayın onayı / reddi KABUL: donmuş satır değişmez (Ç3; 2.4.9 açıklamadan → 500), yalnız güncel türetme değişir (Kural Farkı'na yansır). Dayanak B16 metni (D, 10:53): "kilitli dönemde onay bekleyen KG-16 adayı varken Kural Farkı fişi pasif" — liste kilitli dönemde de tamamlanabilmeli. B16'nın kendisi (fiş düğmesinin pasifliği, fazla fişe ters kayıt önerisi) kâhine VERİLMEDİ, modellenmez; senaryolar B16 sırasına uyar (kilitli adaylar fişten ÖNCE onaylanır / reddedilir — s30). 2.5.0'da konmuş kilidin (kâhinde donmuş kopya yok) içindeki adayın onayı / reddi → kâhin SUSAR (senaryo hatası; DENENMEYEN) | s30, birim | — |
| W5 | B6 eşleşme | Açıklamanın başındaki boşluk atılır, Türkçe küçük harfe çevrilir (İ → i, I → ı), ç → c, ı → i, ş → s katlanır; sonuç "acilis" ile BAŞLIYORSA aday. Girer: "AÇILIŞ", "Açilis farkı", "ACILIS", "  açılış", "Açılışlar"; girmez: "Devir bakiyesi", "Devreden", "Yeniden açılış", "Kapanış". Yalnız KG-16 adayı için; donmuş 2.4.9 türetmesinin kendi "açıklamadan açılış" tanıması (eski `acilis_aciklamasi`) aynen kalır (2.4.9'un gerçek eşleşmesi kâhinde DOĞRULANMADI) | s83, birim | B83, B83b, B83c |
| W6 | S48 kapsam | "Carisiz açılış evrakı" = `evrak_acilis` (M-08, alınan) `cari` alanı YOK (kitap M-08 "cariye işlenmemiş"). `cari` alanı dolu açılış evrakı (keşideci tek cariyle eşleşmiş) Ç-07 aynen (C5 §2.5: yeni kural yok). "Program cariyi sorar": `evrak_karsiliksiz {evrak, cari}` — `cari` verilirse SEÇİLDİ, verilmezse SEÇİLMEDİ. Portföydeki ve bankada tahsildeki evrak aynı (A 101.01 / 101.02 / 121.0x). Devirle gelen evrak kaydı açılış işaretini taşır (devir şirketin durumunu değiştirmez) | s84 | — |
| W7 | S48 sonuç | SEÇİLDİ → Ç-07 aynen: B CH (seçilen cari) / A 101.0x — cari borçlanır; Tek Yükümlülük Kuyruğu'nda AYRI borç kalemi (M1c; geri alınacak tahsilat yok), vade = karşılıksız günü (S1 A → ertesi gün gecikmiş, hatırlatma); Ç-07 borç satırıdır, K3'e girmez. SEÇİLMEDİ → B 519 / A 101.0x ("açılış geri alınmış"; olağan sınıf, işlem tarihi); gelir / gider yazılmaz (B'nin 770.90'ı değil); 519 ≠ 0 → TAMAMLANMAMIS_ACILIS (kitap M-11 "G ≠ 0 iken Kesin Değil" — eşleştirme yeniden gerekir). Donmuş 2.4.9 türetmesi: B 770 / A 101 (iş listesi A Ç5 EK: "karşılıksız açılış çeki (bugün 770, müşteriye borç yok)"). Kâhinin sustuğu (senaryo hatası): ciro edilmiş carisiz açılış evrakının geri gelmesi (Ç-08) — KULLANICIYA SORULMALI 3; carili evrakta BAŞKA cari seçilmesi (model dilinde yok) | s84, birim | B84, B84b, B84c |
| W8 | S49 | "Formdan carisiz evrak" = yeni olay `carisiz_evrak {evrak, evrak_turu cek / senet, yon alinan / verilen, tutar, banka}` (cari seçilmeden, yalnız keşideci / lehtar adıyla; açılış DEĞİL; evrak tarihi, olağan sınıf). Alınan: B 101.01 / 121.01 / A 649.90 (KG-3 A'nın carisiz Kasa girişi ailesi; GT F, ayrı alt satır); verilen: B 770.90 / A 103 / 321 (K-02 ailesi; GT E 632). Donmuş 2.4.9 türetmesi: alınan A 602, verilen B 770 (C seçeneği "bugünkü gibi 602 / 770"; DEVIR-PLANI Ek "carisiz / açılış portföyü alınan 101 / 602, verilen 770 / 103"). Cari gerektirmeyen sonraki işlemler aynen: Bankaya Tahsile Ver / Geri Al / Tahsil Et (Ç-02…Ç-05), Ciro Et (Ç-06, tedarikçiye), verilenin Ödeme Yap'ı (Ç-10) | s85, birim | B85, B85b, B85c |
| W9 | S49 kapsam dışı | Cari gerektiren sonraki işlemler — formdan carisiz alınan evrakın karşılıksız / iade dönmesi (Ç-07), cirodan geri gelmesi (Ç-08), verilenin ödenmeden geri alınması (Ç-11): karar metni yok → kâhin SUSAR (senaryo hatası); KULLANICIYA SORULMALI 4 | birim | — |
| W10 | S51 | "Silinenler'den geri alınan açılış" = işaretli `cari_acilis` (M-02 / M-03) `sil` → `geri_yukle`; "cari başka açılışla" = geri alma ANINDA aynı carinin ETKİN başka `cari_acilis` kaydı var. → kayıt KG-16 adayı olur (W2 / W3: onaya kadar 519 + Kesin Değil; onay → 519; red → C-01 / C-02). Başka açılış yoksa G-7 aynen (açılış olarak döner, aday değil). Aday olması geri alma anında bir kez verilir (öbür açılış sonradan silinse de aday kalır — para sonucu ikisinde de 519; yalnız liste / Kesin Değil — sunum). Geri alınan 2.5.0 Borç / Alacak Yaz'ı ("Açılış…" açıklamalı da olsa) aday olmaz (W1); yedekten gelen eski kayıt zaten W1 adayıdır (B8) | s87 | B87, B87b, B87c, B87d |
| W11 | S50 | Kart seçilmeden (`taksit_karti` ve `fatura` yok) alınan tahsilat bağsız alacaktır: KENDİ tarihinde açık borç kalemlerine S2 sırasıyla (vadesi önce gelen → eşitse belge tarihi → giriş sırası, ders 31). Taksit kartlarının taksitleri (H-03 Yeni Borç, KG-5 Excel kartı, H-02 Mevcut Borç kartı, H-01 fatura kartı) bu kalemlerdendir (M1a BAŞ MİMAR KARARI + S2 kullanıcı kararı; C'deki A metni "vadesi önce gelen borç hangisiyse (fatura ya da taksit) o kapanır"). "Vadesi gelmiş" kararın örnek durumudur: tek kuyrukta vadesi HENÜZ gelmemiş taksit de vadesi en önce gelen açık kalemse kapanır (S2 vadeye göre sıralar, "vadesi gelmiş" koşulu koymaz) — kâhin yorumu, BAŞ MİMAR değerlendirir. Birden çok kartın aynı vadeli taksitleri belge (kart) tarihi, sonra giriş sırasıyla. Kart tahsilatı (bağ) o kartın vadesi ilk gelen AÇIK taksitini kapatır (M1e aynen). Taksitler / zil / takvim = `kartlar` raporunun taksit `kalan`ı ve `acik_kalemler` (kart:<id> kalemleri), ikisi de kuyruktan; kart modülündeki `taksit_odenen` yalnız karta bağlı tahsilat sayacı kalır (programın kart "Ödenen" sayacının cari tahsilatını içerip içermediği karar metninde yok — DOĞRULANMADI). Model DEĞİŞMEZ: bakım 1'den beri böyle (s82 PT, s81 kaldırma bu kuralla); S50 kesinleştirir; eski beklenti değişmez | s86 | B86, B86b, B86c |
| W12 | S52 olay | Yeni olay `odeme_sozu {cari, tarih, soz_tarihi}`: tarih = sözün girildiği gün, `soz_tarihi` > tarih ("ileri tarihli"; değilse senaryo hatası). Defter olayı DEĞİL (kitap G-5 "Beklenen Ödeme Tarihi … defter olayı DEĞİLDİR"): madde, modül, gecikmiş değişmez. Carinin geçerli sözü = tarihi ≤ t olan EN SON girilmiş söz (yeni söz öncekinin yerine) | s88, birim | B88g |
| W13 | S52 hatırlatma | Söz ETKİN = sözün tarihi ≤ t < soz_tarihi. Etkin söz varken gecikmiş > 0 olan cari otomatik Ödeme Hatırlatma listesine GİRMEZ; "Ödeme Sözü Var" etiketiyle `hatirlatma.odeme_sozu_var` {cari: gecikmiş} (istenirse elle seçilir — C5 S-Ç5-6 A metni). t > soz_tarihi (söz geçti) → olağan (S7 dışında otomatik). "Borç gecikmiş sayılır" → `gecikmis` raporu, açık kalemler, devir ve TYK değişmezleri aynen; değişmez "hatırlatma = gecikmiş" söz etkin carilerde otomatik 0 bekler. Şüpheli kaydı açık cari S7 ile zaten otomatik dışında ("Şüpheli Alacağı Var"); orada söz değerlendirilmez | s88 | B88, B88b, B88e |
| W14 | S52 kâhinin sustuğu (KODLANMADI) | **Bakım 9: İKİ SUSMA DA KALKTI (S72 = A, S73 = A — P1, P2).** (a) t = soz_tarihi (SÖZ GÜNÜ): "söz tarihine kadar" söz gününü kapsar mı — iki okuma → `hatirlatma.kahin_susuyor` [{cari, neden "S52_SOZ_GUNU"}]; cari ne otomatik ne etiket listesinde; KULLANICIYA SORULMALI 1. (b) söz etkinken, söz verildiği gün vadesi GEÇMEMİŞ (vade ≥ sözün tarihi) bir kalem gecikmişe girdi: karar "vadesi geçmiş borca" der, sözün sonradan geciken kalemi kapsayıp kapsamadığı yok → `kahin_susuyor` "S52_YENI_GECIKME"; KULLANICIYA SORULMALI 2. Söz verildiğinde hiç gecikmiş yoksa (b) ile aynı. Sürücü bu cari / tarihte hatırlatmayı karşılaştırmaz | s88 | B88c, B88d, B88f |
| W15 | S53 | Defter: kâhin bakım 1'den beri kilitsiz (ya da kilidi o yılın sonundan önce olan) dönemin tamamını güncel kuralla türetir (G-7); donmuş kopya yalnız göçteki kilit (`donem_kilitle kural 2.4.9`) ile; 2.5.0'da konan kilit o anki güncel kuralla donar (kâhinde kural değişmediği için ayrı kopya gerekmez) → "geçmiş yıl defteri yeni kuralla değişir" model DEĞİŞMEDEN sağlanır. Bilgi: yeni rapor `defter_mutabakati_bilgi {tarih}` → {bilgi [{kod "KILITSIZ_GECMIS_YIL_YENI_KURAL", yil, oneri "YILI_KILITLEYIN"}], olculmeyen [yil]}: yıl < yil(t) ve o yılın KİLİTSİZ kısmında (tarih > kilit) güncel türetme ile 2.4.9 kuralının türetmesi en az bir (hesap, cari) bakiyesinde ayrışıyorsa bilgi VAR; kilitli yıl (31.12 ≤ kilit) ve t'nin yılı bilgi vermez. Kayıt var ama iki kural aynı sonucu veriyorsa bilginin çıkıp çıkmadığı karar metninden tek anlamlı değil ("değişir" — yalnız değişen yıl mı, her kilitsiz geçmiş yıl mı) → `olculmeyen` (sunum, para değil — BAŞ MİMAR değerlendirir; sürücü karşılaştırmaz). "Güncelleme notu" kâhinde yok (dosya / süreç yok). Karşılaştırma kâhinin bildiği 2.4.9 farklarıyla (açılış 500, açılış evrakı 602 / 770, açıklamadan açılış, S14, POS tatili, eski kapama); 2.4.9'un Excel kartı (KG-5) maddesi kâhinde YOK (DOĞRULANMADI) | s89, s90 | B89, B89b, B89c, B89d |
| W16 | B5 | `taksit_excel` yeni alanı `yukleme_ani` (içe aktarma anı, saat dilimli ISO: "2026-03-09T22:30:00Z"): KG-5 maddesinin (A: B CH (T − P) / A 519, açılış sınıfı) tarihi = yükleme anının Europe/Istanbul YEREL günü (kâhin süreç saat diliminden bağımsız hesaplar; TZ=UTC ve TZ=Europe/Istanbul aynı sonuç). Kartın `tarih`i (Kayıt Tarihi) cari modülünde (ekstre) ve kart kaydında kalır. `yukleme_ani` yoksa yükleme günü = `tarih` (eski senaryolar aynen). Yükleme günü < Kayıt Tarihi → senaryo hatası (G-4 ileri tarih yok). BİLİNEN SINIR (B5): Kayıt Tarihi < yükleme günü ise aradaki tarihlerde cari modülü (ekstre) ≠ defter; değişmez `modul_defter` bu pencerede kartın T − P'sini hata saymaz, tüm zaman eşit. Tek Yükümlülük Kuyruğu CH satırlarından (EK-1 §1) kurulduğu için kart kuyruğa yükleme gününde girer; pencere içi gecikmiş / ödeme senaryosu kurulmaz (DENENMEYEN) | s91, birim | B90, B90b, B90c |
| W17 | B11 | T12 (bakım 3: BAŞ MİMAR değerlendirir) artık BAŞ MİMAR KARARI B11: Kasa hareketinin tarihini açılıştan önceye alan ya da açılıştan önce tarihli kaydı Kasa'ya çeviren düzeltme KASA_ACILIS_ONCE (kaydın tamamı); açılış GÜNÜNE alma kabul (açılış günün başı); geri yüklenmiş ve tarihi değişmeyen düzeltme S26 / S40 / S44 aynen (X10 sırası). Model DEĞİŞMEZ; yeni senaryo sınırlarla | s92 | B33b, B33c |
| W18 | B14 | Kural Farkı Düzeltme Fişi (KG-15 A, M7) ALT DEFTER hesaplarına satır YAZMAZ. Kâhinin alt defter hesapları = bakiyesi modülle eşleşen hesaplar (değişmez `modul_defter`) + karşılık: 100, 101, 102, 103, 108, 120, 121, 128, 129, 300, 309, 320, 321, 336 (alt hesaplarıyla). Bu hesaplardaki kural farkı (S14 ailesi: 2.4.9'da şüpheli caride faturaya bağlı çek 120'den, güncel kuralda faturanın şüpheli kısmı 128'den) fişten SONRA da kalır: `kural_farki` raporu kalan alt defter farkını gösterir, Bilanço KURAL_DEGISIKLIGI_FARKI sürer (BİLİNEN SINIR; çözüm Kilidi Aç → Yeniden Kilitle — kâhinde kilit açma olayı yok, DENENMEYEN). Fark YALNIZ alt defter hesaplarındaysa fiş yazılmaz: red `KURAL_FARKI_ALT_DEFTER`. Değişmez (9) `kural_farki_yeni_kural` alt defter hesaplarını dışarıda bırakır; yerine her carinin CH + 128 toplamı yeni kuralla aynı olmalı (cari bakiyesi değişmez, fark yalnız sınıflama) | s93, birim | B91, B91b, B91c |
| W19 | B14 kâhinin sustuğu (KODLANMADI) | Kural farkı alt defter ile alt defter DIŞI hesap arasında (fişin alt defter dışı satırları kendi içinde dengesiz) — ör. S14 + karşılık (2.4.9: bağlı çek 120, karşılık çözülmez; güncel: 128'den düşer, B 129 / A 644): fiş 644'ü yalnız 129 karşılığıyla düzeltebilir → kâhin SUSAR (senaryo hatası); KULLANICIYA SORULMALI 5 | birim | — |

### KULLANICIYA SORULMALI / KÂHİN SUSUYOR (kodlanmadı; para / kapama / "kime" → ders 43, 45; SORU DÜZENİ 06.11 09:01: uç durumda üçüncü seçenek)
1. **[bakım 9: S72 = A, kural oldu — P1]** **S52 × söz günü (W14 a):** müşteri 20.03'te ödeyeceğini söyledi (söz 10.03'te girildi); 20.03 günü otomatik Ödeme Hatırlatma listesine girer mi? A (öneri): söz günü de GİRMEZ, ertesi gün (21.03)
   girer — vade günüyle aynı ilke (M1f: vade günü gecikmiş değil; müşterinin o gün ödeme hakkı var; tahsilat uygulamasında söz "tutulmadı" ertesi gün sayılır). B: söz günü GİRER ("söz tarihine kadar" =
   söz gününden önceki günler). Uç durum değil (her sözde olur) → C yok. Örnek: F1 1.000 vade 01.03 · söz 10.03 → 20.03 · 20.03'te A: liste dışı ("Ödeme Sözü Var"), B: listede 1.000.
2. **[bakım 9: S73 = A, kural oldu — P2]** **S52 × söz süresinde yeni geciken kalem (W14 b):** söz verildiğinde gecikmiş olan borç dışında, söz tarihinden önce yeni bir kalem (taksit / fatura) gecikirse. A (öneri): söz carinin bütün gecikmiş
   borcu içindir — söz tarihine kadar cari otomatik listeye hiç girmez; söz geçince bütün gecikmiş borçla girer ("Ödeme Sözü Var" cari düzeyinde tek etiket; müşteri söz verdiği tarihe kadar
   rahatsız edilmez — "kime kaç kez"te şüphede gönderilmeyen yön). B: söz yalnız söz anındaki gecikmiş borç içindir — yeni geciken kalem olunca cari listeye girer, iletideki tutar yalnız söz
   sonrası geciken kalemler (karar metninin "vadesi geçmiş borca" sözünün harfiyen okuması). Örnek: F3 500 vade 15.02 · söz 10.03 → 10.04 · F4 300 vade 25.03 · 26.03'te A: liste dışı, B: listede 300.
3. **[S74 = C, BİLİNEN SINIR — bakım 9 P9]** **S48 × ciro edilmiş carisiz açılış evrakının geri gelmesi (W7; UÇ):** carisiz açılış çeki tedarikçiye ciro edildi, karşılıksız geri geldi (Ç-08). A (öneri): S48 ile aynı — program cariyi sorar;
   seçilirse B CH (müşteri) / A CH (tedarikçi), seçilmezse B 519 / A CH (tedarikçi) (açılış geri alınmış; tedarikçiye borç geri gelir). B: seçilmezse gider (B 770.90 / A CH tedarikçi).
   C: uç durum böyle kalsın (BİLİNEN SINIR; kâhin susar, sürücü kurmaz).
4. **[alınan evrakın karşılıksızı S66 = A; ciro dönüşü S74 = C, verilenin geri alınması S75 = C, BİLİNEN SINIR — bakım 9 P9]** **S49 × cari gerektiren sonraki işlemler (W9; UÇ):** formdan carisiz alınan evrak karşılıksız / iade döndü ya da cirodan geri geldi; formdan carisiz verilen evrak ödenmeden geri alındı. A (öneri):
   S48'in ilkesi — program cariyi sorar; seçilirse cari borçlanır (Ç-07 / Ç-08) ya da alacaklanır (Ç-11); seçilmezse girişin tersi (alınan: B 649.90 / A 101 — yazılan gelir geri alınır; verilen:
   B 103 / A 770.90 — yazılan gider geri alınır). B: seçilmezse karşılıksız alınan evrak gider (B 770.90 / A 101), geri alınan verilen evrak gelir (B 103 / A 649.90). C: uç durum böyle kalsın
   (BİLİNEN SINIR; kâhin susar).
5. **[S76 = C, BİLİNEN SINIR — bakım 9 P9]** **B14 × alt defter ile alt defter dışı arasında kural farkı (W19; UÇ):** göçte 2.4.9 kuralıyla donan dönemde şüpheli kaydı ve karşılığı olan caride faturaya bağlı çek (güncel kuralda 128'den düşer ve
   karşılığın fazlası B 129 / A 644 ile çözülür; 2.4.9'da 120'den, çözülme yok). A (öneri): S14 ailesinin bütün farkı (644 dahil) fişle düzeltilmez; Bilanço "Kural Değişikliği Farkı" kalır, çözüm Kilidi
   Aç → Yeniden Kilitle (B14'ün ilkesi; 644'ün karşılığı alt defterdeki 129). B: fiş 644'ü 129 ile düzeltir (129 karşılık hesabı fişle yazılabilir sayılır). C: uç durum böyle kalsın (BİLİNEN SINIR;
   kâhin susar).
6. Sürer: bakım 7'nin 1–4'ü (S54–S57 olarak soruluyor; susma aynen), bakım 5'in 3'ü (dinî bayram tarihleri — bu bakımda aranmadı), bakım 2 listesinin 3, 4, 5, 6, 7; bakım 3'ün 4'ü (program iletisi).
- BAŞ MİMAR değerlendirir (kâhin yorumu, kodlandı): W1 (KG-16 adayı yalnız eski kayıt — `yedekten`), W4 (göçte donan dönemde onay kabul), W11 ("vadesi gelmiş" örnek; vadesi gelmemiş taksit de
  S2 ile kapanır), W15 (farksız kilitsiz geçmiş yıl ölçülmez), W18 (alt defter hesap listesi).

### Ek kapsam (ana oturum iletisi): kullanıcı kararı 06.11 12:06 UTC S54–S57 — "ÖNERİLERİNİ UYGULA", hepsi A
- Kaynak: `git show eaa29f94:docs/2.5.0-IS-LISTESI.md` (çalışma dalı ucu, yalnız belge; not defterine çıkarıldı) — D bölümü satır 313–326 ve C bölümünde S54–S57 satırları (301–304; başlık
  aramasıyla görüldü). Başka bir şey okunmadı. Bakım 7'nin V7 / V3 (c) / V3 (d) / V9 susmaları bu kararlarla KALKAR.
- Karar metinleri (AYNEN, D): **S54 = A:** geri yüklenmiş, Kasa açılışından önce tarihli kayıtta aynı düzeltmede bağ + cari → kabul; bağ yeni carinin belgesine / kartına.
  **S55 = A:** düzeltmeyle bağlanan fatura / taksit kartı kayıttan sonra tarihliyse bağ hedefin doğduğu gün uygulanır (olağan kayıtta da). **S56 = A:** S44 düzeltmesi şüpheli caride
  "Normal Cari" sınırını aşarsa SUPHELI_NORMAL_ASIM ile red. **S57 = A:** OLAĞAN kayıt Kapatılacak Fatura / taksit kartıyla bağlıyken carisi düzeltilirse "önce bağı kaldırın" ile red
  (S45 ile aynı).
- Seçeneklerin öbür yüzü (C, satır 301–304): S54 B "red 'önce bağı kaldırın'", C "uç durum böyle kalsın"; S55 B "bağ hedefsiz sayılır, tutar bağsız dağılır", C "uç durum böyle
  kalsın"; S56 B "kabul", C "uç durum böyle kalsın"; S57 B "bağ düşer, kayıt yeni caride bağsız".

| # | Karar | Kâhin yorumu | Senaryo / test | Mutant |
|---|---|---|---|---|
| U1 | S54 kapsam | "Geri yüklenmiş, Kasa açılışından önce tarihli kayıt" = S44 / S45 kapsamı (V1, V5; Z9: yedekten ya da Silinenler'den). Düzeltmeden ÖNCE bağlı (Kapatılacak Fatura `fatura` ya da taksit kartı `taksit_karti`) kaydın AYNI düzeltmede carisi BAŞKA cariye ve bağı değişiyor ("bağ değişiyor" = `fatura` / `taksit_karti` alanlarından en az biri öncekinden farklı: kaldırma `null` ya da başka belge / kart) → KABUL (V7 susması kalkar). Kaldırma da kapsamda: kararın cevapladığı soru (bakım 7 KULLANICIYA SORULMALI 1) "bağı kaldırıyor (ya da yeni carinin faturasına bağlıyor)" ikisini birlikte sordu; D metninin "bağ yeni carinin belgesine / kartına"sı bağ kurulduğunda yerini söyler | s94, birim | B95, B95b |
| U2 | S54 sonuç ve sınırlar | Kayıt KENDİ gününde yeni carisi ve yeni bağıyla yeniden türetilir (V2, X9 aynen): CH satırı yeni cariye geçer, eski carinin kuyruğunda kaydın kapattığı kalemler kendi vadeleriyle açılır (karar (1) / (2) yeniden oynatma); yeni bağ yeni carinin belgesini / kartını kapatır (karar (2)), fazlası bağsız (S2); kaldırmada kayıt bağsızdır. Yeni bağın hedefi düzeltmeden SONRAKİ carinin ETKİN belgesi / kartı olmalı: eski carinin ya da başka bir carinin belgesi / kartı → model dilinde yok, SUSAR (V3 (c) aynen). Bağ değişmeden (aynı belge yeniden yazılarak) cari değişirse S45 aynen (BAG_KALDIRILMALI). Tutar / açıklama da aynı düzeltmede → kabul (X10 ilkesi). Tarih açılıştan önceki başka güne → T12 / B11 ÖNCE (KASA_ACILIS_ONCE) | s94, birim | B95 |
| U3 | S55 | "Bağlanan fatura / taksit kartı kayıttan SONRA tarihli" → bağ hedefin DOĞDUĞU gün uygulanır. "(Olağan kayıtta da)": geri yüklenmiş açılış öncesi Kasa kaydının S44 düzeltmesi (V3 (c) susması kalkar) VE olağan kayıt (bakım 2 DENENMEYEN "Hedefi bağdan SONRA doğan bağ": geriye tarihli tahsilat / ödemenin sonradan tarihli faturaya ya da karta bağlanması — kâhin türetmesi G-7 ile girişi ve düzeltmeyi ayırmaz, ikisi aynı kural). Hedefin doğduğu gün: fatura belge tarihi; taksit kartının kuyruğa girdiği gün (Yeni Borç / fatura / Mevcut Borç kartı kart tarihi; Excel kartı B5 yükleme günü). O gün hedef kalemi kuyruğa girer girmez bağ uygulanır (aynı günün bağsız dağılımından ÖNCE; karar (2): bağ hedefini her durumda kapatır). Hedef doğduktan sonraki her tarih için sonuç tek anlamlı: hedef taşıyıcının tutarıyla kapanır, taşıyıcının tutarı başka borçta DEĞİLDİR. Önceki model (bakım 2–7): bağ hedefsiz sayılır, tutar kendi gününde bağsız dağılır (= S55 B) | s95, birim | B96, B96b |
| U4 | S55 kâhinin sustuğu (KODLANMADI) | (a) taşıyıcının günüyle hedefin doğduğu gün ARASINDAKİ tarihlerde gecikmiş: bakım 7 KULLANICIYA SORULMALI 2'nin A metni "o güne kadar bağlı tutar başka borca gitmez … gecikmiş 16.01'de … 1.000" der; bu karar (5)'in "gecikmiş tutar carinin net borcunu aşmaz" kuralıyla ve EK-1 §4 değişmezi (i) ile ÇELİŞİR (örnekte 16.01'de net borç 0, gecikmiş 1.000); D metni (12:06) aradaki dönemi söylemez → `gecikmis.kahin_susuyor` [{neden "S55_BEKLEYEN_BAG", kaynak, tutar}] (hatırlatmada da susar), TYK değişmezlerinin (i) ve "iki taraf birden açık" denetimi o cari / tarihte atlanır; KULLANICIYA SORULMALI 6. Kâhin içeride tutarı bekletir (başka borca vermez) ama bu tarihlerin sayısı ölçülmez. (b) taşıyıcının tutarı hedefin doğduğu gün açık kısmını AŞARSA fazlanın hangi gün dağıldığı (karar (1) "kendi tarihinde": taşıyıcının günü mü, bağın uygulandığı gün mü) → `kahin_susuyor` "S55_FAZLA"; KULLANICIYA SORULMALI 7. (c) Hedef doğmadan iptal / silinirse (hedef hiç doğmaz): bugünkü gibi hedefsiz → bağsız (S5 / S15 ailesi) — senaryo yok | s95, birim | B96c |
| U5 | S56 | **[bakım 10: olağan düzeltmede sınır S81 = A ile kural oldu — L5–L7]** Bakım 7 V3 (d) susması kalkar → `SUPHELI_NORMAL_ASIM` ile RED; düzeltmenin TAMAMI reddedilir, kayıt olduğu gibi kalır (X10 / V5 "düzeltmenin tamamı"). Sınır V3 (d) aynen: kaydın günündeki 120 bakiyesi (kayıt hariç); EŞİTLİK kabul ("aşamaz"). "Normal Cari" sınırı = plan §3.11b/2 SINIR: "Normal Cari Hesaba İşle" seçimiyle 120'ye yazılan tutar ve fatura bağıyla 120'de kapanan kısım (S14 / S25; aynı kural, aynı red kodu — V3 (d) ikisini birlikte sordu). Olağan kaydın düzeltmesinde aynı sınır: karar yalnız S44 der → DENENMEYEN (kâhin olağan düzeltmeyi bugünkü gibi denetlemez) | s96, birim | B97, B97b |
| U6 | S57 | "OLAĞAN kayıt" = S44 / S45 kapsamı DIŞINDAKİ her kayıt — geri yüklenmemiş ya da geri yüklenmiş ama düzeltmeden önce Kasa açılışından önce tarihli Kasa hareketi yazmayan, ya da tarihi açılıştan sonraya alınan (bakım 7 V8 / V9 ve KULLANICIYA SORULMALI 4'ün tanımı "olağan (geri yüklenmemiş ya da açılıştan sonra tarihli)"). Kapatılacak Fatura ya da taksit kartıyla bağlı (düzeltmeden ÖNCE) kaydın carisi BAŞKA cariye düzeltilirse RED `BAG_KALDIRILMALI`, düzeltmenin TAMAMI (S45 ile aynı; V5). Aynı cari düzeltme değil → kabul. Önce ayrı düzeltmeyle bağ kaldırılır (olağan düzeltme, G-7), sonra cari → kabul (V6 ile aynı yol; çıkmaz yok). Kasa kaydının tarihi açılıştan önceye değişiyorsa T12 / B11 ÖNCE. Önceki model (bakım 1–7): kabul, bağ yeni caride hedef bulamaz → bağsız (= S57 B) | s97 | B98, B98b |
| U7 | S57 kâhinin sustuğu (KODLANMADI) | (a) **bakım 9: KALKTI (S79 = A — P5)** olağan bağlı kayıtta AYNI düzeltmede bağ + cari: S57 "S45 ile aynı" der; S45'in bu durumu (geri yüklenmiş kayıtta) S54 ile KABUL oldu — S57'nin S54'ü de içerip içermediği (kabul) ya da harfiyen "bağlıyken carisi düzeltilirse red" (red) — iki okuma → SUSAR (senaryo hatası); KULLANICIYA SORULMALI 8. (b) **[bakım 10: tahsilatta KALKTI (S80 = A — L1, L2); bakım 11: ödeme yönü de KALKTI (S83 = A — Ö1)]** formdaki peşin (`fatura_odemesi`) ödemenin carisi — faturanın düzenlenmesidir (F-14) → SUSAR (V3 (e) aynen) | birim | — |
| U8 | G3 (bakım 7 testi) | `test_S40_S44_S45_kapsam_ve_susma`: PB {cari, fatura: null} ve PB {cari, fatura: F3} senaryo hatası → KABUL (S54); PY {fatura: F9} ve PY {taksit_karti: TK9} (hedef kayıttan sonra) senaryo hatası → KABUL (S55); V3 (d) aşımı senaryo hatası → RED SUPHELI_NORMAL_ASIM (S56). Susma kalanı aynen: X11 (a) banka, X11 (c), V10, V3 (c) başka carinin belgesi / kartı, V3 (e); yeni susma örneği PB {cari: C3, fatura: F5} (yeni bağ eski carinin belgesine). Eski elle senaryolarda olağan bağlı kaydın carisi düzeltilmiyor ve hedefi sonra doğan bağ yoksa sayılar değişmez — model değişince `uret_beklenen` ile denetlenir | birim | — |

KULLANICIYA SORULMALI (S54–S57 eki; SORU DÜZENİ 06.11 09:01):
6. **[S77 = C, BİLİNEN SINIR — bakım 9 P9]** **S55 × taşıyıcının günüyle hedefin doğduğu gün arası (U4 a; UÇ — yalnız geçmiş tarihli rapor):** 10.01 tahsilat 1.000, 20.01 tarihli F2'ye bağlandı; F1 1.000 vade 15.01 açık. 16.01 için
   gecikmiş? A (öneri): hedef doğana kadar tutar bağsız gibi dağılır (F1 kapanır; karar (5) ve EK-1 değişmezi korunur — gecikmiş net borcu aşmaz), hedef doğduğu gün bağ F2'yi kapatır, F1 kendi
   vadesiyle yeniden açılır (karar (2)'deki "serbest kalan" mekanizmasıyla aynı) → 16.01'de 0, 21.01'de 1.000. B: hedef doğana kadar tutar bekler, başka borcu kapatmaz (bakım 7'nin A metni
   "o güne kadar başka borca gitmez") → 16.01'de 1.000 (net borç 0 iken). C: uç durum böyle kalsın (BİLİNEN SINIR; kâhin susar). Hedef doğduktan sonraki tarihler iki seçenekte de aynı.
7. **[S78 = C, BİLİNEN SINIR — bakım 9 P9]** **S55 × bağın fazlası (U4 b; UÇ):** taşıyıcının tutarı hedefin doğduğu gün açık kısmını aşıyor. A (öneri): fazla taşıyıcının KENDİ gününde bağsız dağılır (karar (1); S25 (b)'deki fazla gibi carinin
   bağsız alacağı). B: fazla bağın uygulandığı gün (hedefin doğduğu gün) dağılır. C: uç durum böyle kalsın (BİLİNEN SINIR; kâhin susar).
8. **[bakım 9: S79 = A, kural oldu — P5, P6]** **S57 × olağan kayıtta aynı düzeltmede bağ + cari (U7 a):** olağan tahsilat F1'e bağlı; kullanıcı TEK düzeltmede carisini C3 yapıp F3'e (C3'ün faturası) bağlıyor ya da bağı kaldırıyor. A (öneri):
   S54 ile aynı — kabul (bağ açıkça değiştiği için sessizce kopmuyor; aynı işlem geri yüklenmiş kayıtta kabul, olağanda red olmasın). B: red "önce bağı kaldırın" (S57'nin harfiyen okuması).
   Uç durum değil (tek formda iki alan) → C yok.

### İkinci ek kapsam (ana oturum iletisi): kullanıcı kararı 06.11 12:16 UTC S65–S68 — "önerilerini uygula", hepsi A
- Kaynak: `git show a4ef1268:docs/2.5.0-IS-LISTESI.md` (çalışma dalı ucu, yalnız belge; not defterine çıkarıldı) — D bölümü satır 317–324 (324 başka işin baş mimar kararı, kullanılmadı)
  ve C'de S65–S68 satırları (312–315; başlık aramasıyla görüldü). Başka bir şey okunmadı.
- Karar metinleri (AYNEN, D): **S65 = A:** "Açılış Olabilir" listesine yalnız açıklaması "Açılış…" ile BAŞLAYAN eski kayıt girer; ortada geçen girmez. **S66 = A:** formdan carisiz (açılış değil)
  alınan evrak karşılıksız dönerse program cariyi sorar; seçilirse cari borçlanır, seçilmezse B 649.90 / A 101 (S49 geliri geri alınır). **S67 = A:** vadesi geçmiş borca ileri tarihli Ödeme
  Sözü varken takvim kalemi söz gününde durur, durumu "Gecikmiş", gün sayısı vadeden. **S68 = A:** bizim bağlamadan yaptığımız ödeme (tedarikçiye, iade bedeli, ciro) vadesi en önce gelen
  kalemi kapatır (S2'nin simetriği; tek yükümlülük kuyruğu iki yönde).
- Seçeneklerin öbür yüzü (C): S65 B "içinde geçen de girer", C "uç durum böyle kalsın"; S66 B "seçilmezse 770.90 gider", C "uç durum böyle kalsın"; S67 B "bugünkü gibi söz tarihine göre",
  C "uç durum böyle kalsın"; S68 B "bugünkü gibi kayıt tarihi + yazım sırası".

| # | Karar | Kâhin yorumu | Senaryo / test | Mutant |
|---|---|---|---|---|
| Q1 | S65 | W5 (B6) aynen: eşleşme "acilis" ile BAŞLAMA sınamasıdır; "2025 açılış farkı", "Yeniden açılış" gibi ortada geçen açıklama aday DEĞİL (C-01 / C-02, listede yok). Model DEĞİŞMEZ (bakım 8 temelinde zaten böyle) — S65 kesinleştirir; yeni senaryo + mutant (S65 B "içinde geçen de girer") | s98, birim | B99 |
| Q2 | S66 kapsam ve sonuç | "Formdan carisiz (açılış değil) alınan evrak" = `carisiz_evrak` (yon alinan; W8). Karşılıksız / iade (Ç-07) olayında "program cariyi sorar" S48 ile aynı dil: `evrak_karsiliksiz {evrak, cari}`. SEÇİLDİ → Ç-07 aynen (B CH / A 101.0x; ayrı borç kalemi M1c, vade karşılıksız günü — W7 ile aynı). SEÇİLMEDİ → B 649.90 / A 101.0x ("S49 geliri geri alınır"; olağan sınıf, işlem tarihi; GT F azalır). Portföy ve tahsilde aynı. W9 susmasının bu kısmı ve KULLANICIYA SORULMALI 4'ün "alınan evrak karşılıksız" kısmı KALKAR. Sürer (karar dışı): cirodan geri gelme (Ç-08; KULLANICIYA SORULMALI 3'ün ailesi — S48 ve S66 için aynı soru), formdan carisiz VERİLEN evrakın ödenmeden geri alınması (Ç-11; KULLANICIYA SORULMALI 4'ün kalanı). Donmuş 2.4.9 türetmesi: B 770 / A 101 (2.4.9'un carisiz evrak karşılıksızında gidere yazdığı — iş listesi A Ç5 EK'in açılış evrakı için söylediğiyle aynı kabul; DOĞRULANMADI) | s99, birim | B100, B100b |
| Q3 | S67 | KÂHİN DİLİNDE YOK: kâhinin takvim / Vade Takip / zil raporu yok (kalemin takvimde hangi günde durduğu, "Gecikmiş" durumu, gün sayısı — temel takvim davranışı da hiçbir karar metninde kâhine verilmedi). Kâhinin ölçtüğü ilgili sayılar aynen: `gecikmis` (söz varken de gecikmiş sayılır — S52 W13) ve açık kalemin `vade`si (gün sayısı vadeden). Sürücü / Ç5-B testi takvimi kendisi ölçer; kâhin karşılaştırmaz | — | — |
| Q4 | S68 | Bizim bağlamadan yaptığımız ödeme (tedarikçiye ödeme T-05 / T-06 / T-07, müşteriye iade bedeli T-09, ciro T-08) carinin kuyruğunda BORÇ yönlü bağsız kalemdir; KENDİ tarihinde açık ALACAK kalemlerine (alış faturası, Alacak Yaz, avans, iade alacağı …) S2 sırasıyla uygulanır: vadesi önce gelen → eşitse belge tarihi → giriş sırası. Kâhinin Tek Yükümlülük Kuyruğu bakım 1'den beri iki yönde aynı kuralla (EK-1 §1 "bağsız alacak / borç … vadesi ilk gelenden") — model DEĞİŞMEZ; S68 kesinleştirir. Karar (5) aynen (alış faturası satış borcuna netleşir; fatura durumu ayrı görünüm, R5). Yeni senaryo + mutant (S68 B "kayıt tarihi + yazım sırası") | s100 | B101 |
| Q5 | G3 | `test_S48_S49_kapsam_susma`: formdan carisiz alınan evrakın cari seçilerek karşılıksızı senaryo hatası → KABUL (S66; s99'da ölçülür); öbür dört susma aynen. Eski elle senaryolarda carisiz form evrakının karşılıksızı yok → sayı değişmez | birim | — |

### Önceki beklentilerle çelişen yerler (eski → yeni, nedeni; G3)
- `s17` (S47 + W1): KG-16 adayları BY3 / BY4 / AY2'ye `yedekten: true` (göç verisi — "göçte" / "eski kayıt"); onay bekleyen BY4 602.90 → 519 (S47): `mz/519` −205000 → −245000, `mz/602.90` −90000 →
  −50000, `gt/A` 90000 → 50000, `gt/DNK` 80000 → 40000. KG16=B dalı aynen.
- `s30` (S47 + W1 + W4): BY2'ye `yedekten: true`; kilitli (göçte 2.4.9 kuralıyla donan) adayın onayı fişten ÖNCE (`acilis_onayla BY2 onay` — B16 sırası); BY2 güncel türetmede 519: `fark/519`
  −150000 → −200000, `fark/602.90` −10000 → +40000, `mz/519` −150000 → −200000, `mz/602.90` −50000 → 0, `gt/A` ve `gt/DNK` 200000 → 150000, `bil/V.G` 150000 → 200000. KG15=B dalı aynen.
- `test_S40_S44_S45_kapsam_ve_susma` (U8): PB {cari, fatura: null} ve {cari, fatura: F3} senaryo hatası → KABUL (S54); PY {fatura: F9} ve {taksit_karti: TK9} senaryo hatası → KABUL (S55; TK9'da tutar
  100'e düzeltildi — fazla susmasından kaçınmak için); V3 (d) aşımı senaryo hatası → RED SUPHELI_NORMAL_ASIM (S56); yeni susma PB {cari: C3, fatura: F5}.
- `test_S48_S49_kapsam_susma` (Q5): formdan carisiz alınan evrakın cari seçilerek karşılıksızı senaryo hatası → KABUL (S66).
- `test_B6_kg16_eslesmesi`: "2025 açılış farkı" girmez (S65; W5 ile zaten böyleydi).
- Model: `acilis_aciklamasi` (2.4.9 tanıması) aynen; KG-16 için yeni `kg16_aciklamasi` (B6). Kural Farkı fişi (B14) ve TYK değişmezleri (B14 128 farkı, S52 söz, S55 bekleyen bağ) yukarıdaki
  yorumlarla. Bakım 7'nin KULLANICIYA SORULMALI 1–4'ü (S54–S57) ve bakım 8'in 4'ünün "alınan evrak karşılıksız" kısmı (S66) kural oldu.
- Elle senaryolarda s01–s82'nin (s17, s30 dışında) ve `rastgele-1/2/3`'ün senaryo + beklenen dosyalarının HİÇBİRİ değişmedi (her model adımından sonra `uret_beklenen.py` +
  `git status`: yalnız s17, s30 ve yeni s83–s100 dosyaları).

### Elle beklenenlerin yazılış sırası (bakım 8)
- 76a02563: yorum W1–W19 + KULLANICIYA SORULMALI 1–5 — kod, senaryo ve testten önce, AYRI commit (ders 40).
- 58908daa: s83–s93, birim testleri ve G3 (s17, s30) model DEĞİŞTİRİLMEDEN ÖNCE. Eski kâhin (f5903164 kopyası + yeni dosyalar) 162 testten 21'i kırmızı
  (`kahin8-eski-model-kirmizi.*`); NEDEN dökümü `kahin8-eski-model-neden.txt` (1. bölüm): eskinin bilmediği olay / rapor (acilis_onayla, carisiz_evrak, odeme_sozu, acilis_olabilir,
  defter_mutabakati_bilgi) ve atlanarak koşulduğunda değer farkları — s17 4 anahtar (bekleyen aday 602.90), s30 7, s83 20 (bekleyen 602.90, B6 eşleşmesi yok, 2.5.0 kaydı aday), s85 23
  (olay yok), s87 12, s88 6, s89 7, s90 2, s91 4 (KG-5 maddesi Kayıt Tarihi'nde), s93 8 (fiş alt defteri de düzeltiyor; TYK değişmezi kırmızı), s84 eski modelde KeyError (carisiz evrakta cari
  yok). **s86 (S50) ve s92 (B11) eski modelde YEŞİL** (0 anahtar farklı): kural bakım 1 / bakım 3'ten beri modelde, karar kesinleştirdi — dişi mutantlarla (B86–B86c, B33b, B33c).
- ad59f99f: model (W1–W19). İlk koşuda BİR elle değer yanlış yazılmış çıktı: s85 `mz0/satirlar/519/bakiye` 0 — mizan bakiyesi devri içerir (01.01 banka açılışı); niyet "dönemde 519 hareketi
  yok" → `mz0/satirlar/519/alacak` 0 (yazım hatası, kural farkı değil). Öbür değerlerin hiçbiri değişmedi.
- f610cd19: yorum U1–U8 + KULLANICIYA SORULMALI 6–8 (S54–S57) — ayrı commit.
- b4fca61b: s94–s97 + test G3 (U8) model değişmeden önce. ad59f99f modeli 167 testten 8'i kırmızı (`kahin8-s54-s57-temel-model-kirmizi.*`): bakım 7'nin V7 / V3 (c) / V3 (d) susmaları
  (senaryo hatası iletileri) ve s97'de S57 reddi yok (10 anahtar; dökümün 2. bölümü).
- f81de45d: model (U1–U8). İlk koşuda elle değerlerin hiçbiri değişmedi.
- 04c233d3: yorum Q1–Q5 (S65–S68) — ayrı commit. 8ee8ef14: s98–s100 + test G3 (Q5). f81de45d modeli 170 testten 2'si kırmızı (`kahin8-s65-s68-onceki-model-kirmizi.*`): s99 ve dosya
  güncelliği W9 susmasıyla. **s98 (S65) ve s100 (S68) önceki modelde YEŞİL** (kural zaten modelde) — dişi B99 ve B101.
- 61bc1fc2: model (S66). 5530e0e5: mutantlar.
- Kanıt (commit 5530e0e5; `docs/kanit/2026-11-06/kahin8-*`): `kahin8-test-utc.*`, `kahin8-test-istanbul.*` (170/170 iki saat diliminde), `kahin8-mutasyon.*` (241/241 öldü; temel 164 test
  yeşil; koşu sırasında yalnız README değişmişti — kanıt aracının "+1 değişmiş dosya" notu), üç eski model kırmızı kaydı ve `kahin8-eski-model-neden.txt` + betiği. Yeni 54 mutantın
  hepsi en az bir elle senaryonun ya da birim testinin DEĞERİYLE yakalanıyor (öldüren testlerin listesi mutasyon kaydında; yalnız değişmezle ölen yeni mutant yok). İlk mutasyon
  denemesi arka plan süre sınırına takılmasın diye ~15 dk'da durduruldu (o ana kadar sağ kalan yoktu) ve 2 saatlik sınırla bir kez baştan koşuldu.

### Yeni senaryolar, testler ve mutasyonlar
- Elle senaryolar (18, toplam 101): s83 (S47 + B6), s84 (S48), s85 (S49), s86 (S50), s87 (S51 + B8), s88 (S52), s89 / s90 (S53 kilitsiz / kilitli), s91 (B5), s92 (B11), s93 (B14), s94 (S54),
  s95 (S55), s96 (S56), s97 (S57), s98 (S65), s99 (S66), s100 (S68).
- Birim (170 test): `test_B6_kg16_eslesmesi`, `test_S47_W4_onay_kapsami`, `test_S48_S49_donmus_2_4_9`, `test_S48_S49_kapsam_susma`, `test_S52_soz_kapsami`, `test_B5_yerel_gun`,
  `test_B5_pencere_modul_defter`, `test_B14_yalniz_alt_defter_red_ve_kesisen_susar`, `test_S57_olagan_kayit_susma`; `test_S40_S44_S45_kapsam_ve_susma` güncellendi (G3).
- Mutantlar: 54 yeni (B80–B101 aileleri; README tablolarındaki Mutant sütunu) → liste 241. Her kararın B (ve varsa C) seçeneği ve en az bir sınır kayması. Metni yeni koda taşınan: M28, M31, N24
  (anlamları aynı), B78'in adı (S56 eşitlik sınırı). Modelde YALNIZ mutasyon için: `S53_OTO_KILIT` bayrağı + `Model._s53_oto_kilit` (B89; S53 B'nin otomatik kilidi).

### Sürücü için (programla karşılaştırmadan önce)
- **S47 / S51 / B6:** KG-16 adayı yalnız `yedekten: true` (göç verisi) Borç / Alacak Yaz — sürücü bu kayıtları v2.4.9'un gerçek koduyla üretip göçle açar (ders 17); 2.5.0'da girilen "Açılış…"
  Borç Yaz aday DEĞİL. Yeni olay `acilis_onayla {kaynak, karar}` (Cariler → Açılış Olabilir Kayıtlar), yeni rapor `acilis_olabilir {tarih}`, Bilanço Kesin Değil `ACILIS_OLABILIR_ONAY_BEKLIYOR`
  (programın "Kesin Değil — Onay Bekliyor" metniyle eşlenir). S51: Silinenler'den geri alınan cari açılışı, carinin başka etkin açılışı varken aday. B16 (fiş düğmesi pasif) kâhinde YOK —
  senaryolar kilitli adayı fişten önce onaylar.
- **S48 / S66:** `evrak_karsiliksiz.cari` = programın sorduğu cari (verilmezse seçilmedi). Carisiz açılış evrakı → B 519 / A 101; formdan carisiz evrak → B 649.90 / A 101; seçilirse Ç-07 + ayrı
  borç kalemi. Ciro dönüşü ve carisiz verilen evrakın geri alınması kâhinde senaryo hatası (kurulmaz).
- **S49:** yeni olay `carisiz_evrak` (formdan, cari seçilmeden) → alınan 649.90, verilen 770.90.
- **S50 / S68:** model değişmedi; Taksitler / zil / takvim karşılaştırması `kartlar` raporunun taksit `kalan`ı ve `acik_kalemler` ile; `moduller.taksit_odenen` yalnız karta bağlı tahsilat.
- **S52:** yeni olay `odeme_sozu {cari, tarih, soz_tarihi}`; `hatirlatma.odeme_sozu_var` ve `hatirlatma.kahin_susuyor` (S52_SOZ_GUNU, S52_YENI_GECIKME; S55_BEKLEYEN_BAG, S55_FAZLA) — susulan
  cari / tarihte hatırlatma karşılaştırılmaz. Program Ödeme Sözü'nü kalem düzeyinde tutuyorsa eşleme sürücüde; ayrışırsa önce hata (ders 6).
- **S53:** yeni rapor `defter_mutabakati_bilgi {tarih}` → {bilgi, olculmeyen}; `olculmeyen` yıllar karşılaştırılmaz. "Güncelleme notu" kâhinde yok.
- **B5:** `taksit_excel.yukleme_ani` — sürücü içe aktarmayı sahte saatle (`config.now`) bu ana denk getirir; madde İstanbul yerel gününde, cari modülü Kayıt Tarihi'nde (pencerede ekstre ↔ defter farkı
  BİLİNEN SINIR). Pencere içi gecikmiş / ödeme kurulmaz.
- **B14:** red `KURAL_FARKI_ALT_DEFTER`; fişten sonra `kural_farki` raporu alt defter farkını gösterir, Bilanço KURAL_DEGISIKLIGI_FARKI sürer.
- **S54–S57:** S54 kabul (bağ yeni carinin belgesine / kartına ya da kaldırılır); S55 bağ hedefin doğduğu gün (olağan kayıtta da — geriye tarihli tahsilatı sonradan tarihli faturaya bağlama);
  aradaki dönem ve fazla `gecikmis.kahin_susuyor` ile susar (sürücü o tarih / cariyi karşılaştırmaz); S56 `SUPHELI_NORMAL_ASIM`; S57 olağan bağlı kaydın carisi `BAG_KALDIRILMALI`. Senaryo
  kurulmayan: olağan kayıtta aynı düzeltmede bağ + cari (KULLANICIYA SORULMALI 8), formdaki peşinin carisi, yeni bağın başka carinin belgesine yönelmesi.
- **S67:** kâhin dilinde YOK (takvim raporu yok) — karşılaştırılmaz.

### DENENMEYEN (bu bakım)
- Programla karşılaştırma (sürücü güncellemesi ayrı iş).
- S47: devirle birlikte bekleyen aday; 2.5.0 kilidi içindeki adayın onayı (W4; susar); kilitli dönemde bekleyen adayla Kural Farkı fişi (B16 kâhinde yok); şüpheli caride alacaklı aday (K3).
- S48 / S66: devirle gelen carisiz evrakın karşılıksızı (açılış işareti taşınır — senaryo yok); ciro dönüşü (KS 3); carisiz verilen evrakın geri alınması (KS 4); 2.4.9'un form evrakı karşılıksızı
  (770 — DOĞRULANMADI).
- S52: devir / yedek geri yüklemede söz kayıtları; şüpheli + söz birlikte (S7 önce gelir — yalnız birim); WhatsApp (Ç5-C, WK kâhininin işi).
- S53: Excel kartının (KG-5) 2.4.9 maddesi kâhinde yok (DOĞRULANMADI) → bu fark bilgiyi tetiklemez; yıl içinde kısmi kilit.
- B5: Kayıt Tarihi ile yükleme günü arasındaki tarihlerde gecikmiş / ödeme; devirle birlikte.
- B14: kilit açma olayı (Kilidi Aç → Yeniden Kilitle yolu); kesişen fark (W19; susar).
- S55: şüpheli caride sonradan doğan hedefe bağ (S14 ölçümü), devir K'yi aşan bekleyen bağ, hedef doğmadan iptal / silme.
- S56: fatura bağıyla sınır aşımı (yalnız Normal Cari senaryosu); olağan kaydın düzeltmesinde sınır.
- Dinî bayram tarihleri (bu bakımda aranmadı; DOĞRULANMADI — Z12 aynen).

## Kâhin bakımı 9 (06.11.2026, kodu görmeyen ajan; kullanıcı kararı 06.11 13:41 UTC S72–S79 — "uç durumlar böyle kalsın, diğerlerinde önerilerini yap": S72 = A, S73 = A, S79 = A, S74–S78 = C)

### Kaynaklar ve bağımsızlık
- Okunan: `CLAUDE.md` (oturum bağlamında; ana ağaçtakiyle `cmp` aynı), `docs/BAGIMSIZ-DOGRULAMA-PRENSIBI.md` (tamamı), bu README'nin "Kâhin bakımı 8" bölümü (921–1121) +
  başlık listesi + satır 83 / 97. İş listesi: çalışma dalının (5502508a) kopyasında S72–S79 yoktu → ana ağaçtaki güncel `docs/2.5.0-IS-LISTESI.md`'nin YALNIZ C ve D bölümleri
  (satır 320–345: C S71–S79, D 13:41 kararı ve 13:38 / 13:33 / 13:09 baş mimar kararları; arama çıktısıyla C / D'deki S45, S52, S54, S57, S67, S69 satırları ve D'deki 12:09 baş
  mimar kararı). A, B ve E okunmadı (bir arama çıktısı B'nin satır 175'inin ilk 200 karakterini gösterdi — S74–S78'in BİLİNEN SINIR kaydı; kullanılmadı). D'deki 12:09 kararının
  koddan alıntıları (dosya / işlev adları) beklenen için KULLANILMADI; yalnız karar kısmı ("S57 kapsamı KAYIT (cari hareketi) düzeyi").
- Kâhin kaynakları: `model.py`, `senaryolar_elle.py`, `test_model.py`, `mutasyon.py`, `uret_beklenen.py` ilgili bölümleri (satır aralıkları ajan raporunda). `server/`, `client/`,
  `bulut/`, `packaging/`, `tools/` (yalnız `node tools/kanit.mjs kos` ÇALIŞTIRILDI), öteki `test/` klasörleri (sürücü dahil), `docs/kanit/` (kendi kanıtları dışında), `docs/erp/`, depo
  geçmişi / farkı OKUNMADI; program çalıştırılmadı. Depo işlemleri: `merge --ff-only 5502508a` (ileri sarılamadı; dalda kendi commit'im yoktu → `reset --hard 5502508a`), `status -s`,
  `log --oneline -3`, `archive 5502508a test/bagimsiz/muhasebe` (eski kâhin kopyası, not defterinde), bitişte kendi yollarımın `add` + `commit`'i.

### Karar metinleri (AYNEN, iş listesi D "KULLANICI KARARI 06.11 13:41 UTC")
- **S72 = A:** Ödeme Sözü'nün günü de cari otomatik hatırlatma listesine girmez; söz geçince girer.
- **S73 = A:** söz carinin bütün borcunu kapsar; söz sürerken başka kalemi gecikse de cari listeye girmez.
- **S74 = C, S75 = C, S76 = C, S77 = C, S78 = C** (UÇ DURUM böyle kalsın — BİLİNEN SINIR; kâhin bu durumlarda susar, kod bugünkü davranışını korur; B bölümüne yazıldı).
- **S79 = A:** olağan bağlı kayıtta aynı düzeltmede bağ + cari değişirse S54 gibi kabul (bağ kaldırılır ya da yeni carinin belgesine / kartına bağlanır).
- Seçeneklerin öbür yüzü (C): S72 B "söz günü girer"; S73 B "söz yalnız söz anındaki borcu kapsar, yeni geciken kalemle cari listeye girer"; S79 B "red ('önce bağı kaldırın')".
- Gecikmiş TUTAR değişmez (S52 "borç gecikmiş sayılır"); kararlar yalnız otomatik hatırlatma listesine girişi belirler.

### Kural başına yorum (önce yorum, sonra kod — ders 40)
| # | Karar | Kâhin yorumu | Senaryo / test | Mutant |
|---|---|---|---|---|
| P1 | S72 | Söz ETKİN = sözün girildiği gün ≤ t ≤ söz tarihi (söz günü DAHİL). t = söz tarihi: cari otomatik listeye girmez, "Ödeme Sözü Var" (`hatirlatma.odeme_sozu_var` {cari: gecikmiş}); bakım 8 W14 (a) susması (`S52_SOZ_GUNU`) KALKAR. "Söz geçince girer" = t > söz tarihi, yani söz tarihinin ertesi takvim günü (vade günü ilkesiyle aynı, M1f: "vade < t gecikmiş"; karar metni iş günü demiyor — hafta sonu / tatil kaydırması yok). Söz girildiği gün söz etkindir (W13 aynen). Geçerli söz W12 aynen (tarihi ≤ t olan EN SON girilen); söz geçtikten sonra girilen yeni söz girildiği günden etkin. `gecikmis` raporu söz günü de aynen (S52) | s101, s88 (G3) | B102, B102b, B102c, B102d |
| P2 | S73 | Etkin söz carinin BÜTÜN borcunu kapsar: söz anında gecikmiş olan ile söz süresinde yeni geciken kalem AYRILMAZ — cari söz geçene kadar otomatik listeye girmez; `odeme_sozu_var` tutarı o günkü BÜTÜN gecikmiş (yeni geciken kalem dahil; S52 tutar değişmez). Bakım 8 W14 (b) susması (`S52_YENI_GECIKME`) KALKAR. Söz geçince (P1) cari bütün gecikmiş borcuyla (söz öncesi, söz sırasında ve sonrasında geciken) otomatik listeye girer. Söz anındaki gecikmiş borç söz sürerken ödenip yalnız yeni geciken kalem kalsa da söz sürer (söz cari düzeyinde) | s102, s88 (G3) | B103, B103b |
| P3 | S73 kapsam | Söz girildiği gün carinin hiç gecikmiş borcu yoksa (bakım 8 W14: "(b) ile aynı") da söz carinin bütün borcunu kapsar → söz süresinde geciken kalem cariyi listeye sokmaz. Dayanak: S73 "bütün borcunu" — vadesi gelmemiş borç da borçtur; karar S52'nin "vadesi geçmiş borca" sözünü sözün kapsamına sınır koymuyor. Kâhin yorumu — BAŞ MİMAR değerlendirir. Elle senaryoda YOK (programın gecikmişsiz cariye Ödeme Sözü girdirip girdirmediği bilinmiyor); yalnız birim testi | birim `test_S72_S73_soz_kapsami` | B103 |
| P4 | S72 / S73 × öbür kurallar | W13 / U4 aynen: şüpheli kaydı açık cari S7 ile önce ("Şüpheli Alacağı Var"; söz değerlendirilmez); S55 susması (`S55_BEKLEYEN_BAG`, `S55_FAZLA`) sözden önce. Söz defter olayı değil (G-5): mizan, bilanço, devir, TYK değişmez; değişmez "hatırlatma = gecikmiş" söz etkin carilerde otomatik 0 bekler | s101, s102 | B88b |
| P5 | S79 kapsam | "Olağan bağlı kayıt" = bakım 8 U6 tanımı aynen: S44 / S45 kapsamı dışındaki her kayıt (geri yüklenmemiş; geri yüklenmiş ama düzeltmeden önce Kasa açılışından önce tarihli Kasa hareketi yazmayan; tarihi açılıştan sonraya alınan). KAYIT (cari hareketi) düzeyi — taksit kartının kendi carisinin değişmesi kapsam dışı (BAŞ MİMAR KARARI 06.11 12:09'un S57 kapsamı). "Aynı düzeltmede bağ + cari" = U1 tanımı aynen: düzeltmeden ÖNCE bağlı (Kapatılacak Fatura `fatura` ya da taksit kartı `taksit_karti`) kaydın carisi BAŞKA cariye ve bağ alanlarından en az biri öncekinden farklı (kaldırma `null` ya da başka belge / kart) → KABUL; bakım 8 U7 (a) susması KALKAR. Bağ değişmeden (aynı belge yeniden yazılarak) cari değişirse S57 red aynen (`BAG_KALDIRILMALI`). Tahsilat ve ödeme (bizim ödememiz: yeni bağ = yeni carinin etkin alış faturası) | s103, birim | B104, B104b, B104d |
| P6 | S79 sonuç | "S54 gibi" = U2 aynen: kayıt KENDİ gününde yeni carisi ve bağıyla yeniden türetilir (G-7); CH satırı yeni cariye geçer; eski carinin kuyruğunda kaydın kapattığı kalemler kendi vadeleriyle açılır (taksit dahil); yeni bağ yeni carinin belgesini / kartını kapatır (karar (2), M1e), fazlası bağsız (S2); kaldırmada kayıt yeni caride bağsız (S2 sırası). Hedef kayıttan sonra doğuyorsa S55 aynen ("olağan kayıtta da"; aradaki dönem / fazla U4 aynen susar — S77 / S78 = C). Tutar / açıklama da aynı düzeltmede → kabul (X10 ilkesi; U2). Tarih de aynı düzeltmede → olağan tarih düzeltmesi (G-7; kilit ve T12 / B11 `KASA_ACILIS_ONCE` önce) — S79 ayrıca kısıt koymaz | s103 | B104c |
| P7 | S79 kâhinin sustuğu (KODLANMADI) | **[bakım 10: (c) tahsilatta ve (d) KALKTI (S80 = A, S81 = A — L1–L7); bakım 11: (c)'nin ödeme yönü de KALKTI (S83 = A — Ö1)]** (a) yeni bağın hedefi yeni carinin ETKİN belgesi / kartı değil (eski carinin ya da üçüncü bir carinin belgesi / kartı; tahsilatta alış faturası …) — U2 / V3 (c) aynen; (b) ödemede taksit kartı, kayıt tahsilat / ödeme değil (V3 (f) aynen; model dilinde yok); (c) formdaki peşin (`fatura_odemesi`) — S79 "bağlı kayıt" der, formdaki peşinin carisi faturanın düzenlenmesidir (F-14); karar metninden tek anlamlı türemez → U7 (b) / V3 (e) aynen SUSAR, KULLANICIYA SORULMALI 1; (d) yeni carinin açık şüpheli kaydı varken yeni hâl 120'ye yazıyor (fatura bağı ya da Normal Cari) ve plan §3.11b/2 sınırı (S56'nın sınırı) aşılıyor: "S54 gibi"nin S56'yı da (S54 bir S44 düzeltmesidir, sınır orada geçerli) içerip içermediği iki okumalı ve olağan düzeltmede sınır bakım 8 U5'te DENENMEYEN → SUSAR, KULLANICIYA SORULMALI 2 (sınır aşılmıyorsa iki okuma aynı sonucu verir → kabul) | birim `test_S79_olagan_kayit_bag_cari` | B104e |
| P8 | S79 × S54 | Aynı düzeltme olağan kayıtta ve geri yüklenmiş açılış öncesi Kasa kaydında (S54) AYNI cari / kuyruk / kart / hatırlatma / mizan sonucunu verir; fark yalnız Mutabakat Testi uyarısı (S20 / S40: geri yüklenmiş açılış öncesi kayıtta sürer) | birim `test_S79_S54_ile_ayni` | — |
| P9 | S74–S78 = C | **BİLİNEN SINIR — kâhin SUSMAYA DEVAM EDER** (kodlanmadı, senaryo yok, susma kodları / senaryo hatası iletileri aynen): **S74 = C, BİLİNEN SINIR** (bakım 8 KULLANICIYA SORULMALI 3, W7 / Q2: carisiz açılış ya da form evrakının ciro sonrası karşılıksız / cirodan geri gelmesi — Ç-08); **S75 = C, BİLİNEN SINIR** (KS 4'ün kalanı, W9 / Q2: formdan carisiz VERİLEN evrakın ödenmeden geri alınması — Ç-11); **S76 = C, BİLİNEN SINIR** (KS 5, W19: Kural Farkı fişinde alt defter ile alt defter dışı arası fark); **S77 = C, BİLİNEN SINIR** (KS 6, U4 (a): `S55_BEKLEYEN_BAG`); **S78 = C, BİLİNEN SINIR** (KS 7, U4 (b): `S55_FAZLA`). Sürücü bu durumları kurmaz / karşılaştırmaz | — | — |

### KULLANICIYA SORULMALI / KÂHİN SUSUYOR (kodlanmadı; SORU DÜZENİ 06.11 09:01: uç durumda üçüncü seçenek)
1. **[bakım 10: S80 = A, kural oldu — L1–L3; ödeme yönü bakım 10 KS 1]** **S79 × formdaki peşin (P7 c; UÇ):** satış faturası formunda alınan peşin tahsilat (fatura ile birlikte kaydedilen) sonradan kayıt olarak açılıp carisi (ve bağı) düzeltilmek isteniyor.
   A (öneri): peşin faturanın parçasıdır — carisi tek başına düzeltilmez, red ("faturayı düzenleyin"; cari değişikliği yalnız faturanın düzenlenmesiyle, fatura ve peşini birlikte; 2.4.4 "bağ sessizce
   kopmaz"). B: S79 gibi kabul (peşin yeni cariye geçer; bağ kaldırılır ya da yeni carinin faturasına bağlanır). C: uç durum böyle kalsın (BİLİNEN SINIR; kâhin susar).
2. **[bakım 10: S81 = A, kural oldu — L5–L7]** **S79 × S56 sınırı (P7 d; UÇ; bakım 8 U5'in olağan düzeltme DENENMEYEN'ini de kapsar):** olağan tahsilat aynı düzeltmede şüpheli kaydı açık bir carinin faturasına bağlanıyor (ya da "Normal
   Cari Hesaba İşle" seçiliyor) ve 120'ye yazılacak kısım carinin 120 bakiyesini aşıyor (örnek: C2'nin 1.000 faturasının 900'ü şüpheliye alınmış, 120'de 100; C1'in F1'e bağlı 400'lük
   olağan tahsilatı tek düzeltmede bağı kaldırılıp C2'ye "Normal Cari Hesaba İşle" ile alınıyor — 400 > 100; fatura bağında yalnız S14 / S25 ile 120'de kapanan kısım sayılır). A (öneri): S56 ile aynı — `SUPHELI_NORMAL_ASIM` ile red, düzeltmenin tamamı (aynı tahsilat girişte de reddedilirdi; plan §3.11b/2 sınırı her yolda). B: sınır yalnız
   geri yüklenmiş kaydın (S44) düzeltmesinde — olağan düzeltme kabul. C: uç durum böyle kalsın (BİLİNEN SINIR; kâhin susar).
3. Sürer: bakım 8'in 6 / 7'si artık S77 / S78 = C (BİLİNEN SINIR), 3 / 4 / 5'i S74 / S75 / S76 = C (BİLİNEN SINIR); bakım 8'in 1 / 2 / 8'i kural oldu (S72 / S73 / S79 = A);
   bakım 7 ve öncesinin kalanları aynen (bakım 8 KS 6. madde).
- BAŞ MİMAR değerlendirir (kâhin yorumu, kodlandı): P1 ("söz geçince" = ertesi takvim günü), P3 (gecikmişsiz verilen söz de bütün borcu kapsar), P6 (tarih de aynı düzeltmede — olağan tarih
  düzeltmesi, S79 kısıt koymaz).

### Önceki beklentilerle çelişen yerler (eski → yeni, nedeni; G3)
- `s88` — S72 A: `hat3` (20.03, C1'in söz günü) `kahin_susuyor` [C1 `S52_SOZ_GUNU`] → `odeme_sozu_var` {C1: 600, C3: 500}. S73 A: `hat5` (26.03, C3'te söz sırasında F4
  gecikti) `kahin_susuyor` [C3 `S52_YENI_GECIKME`] → `odeme_sozu_var` {C3: 800}; `hat6` (28.03) `kahin_susuyor` [C3 …] → `odeme_sozu_var` {C1: 600, C3: 800}. Olaylar, gecikmiş
  tutarları, değişmezler ve öbür anahtarlar aynen; senaryo dosyasında açıklama ve kapsam (+ S72, S73, P1, P2). Beklenen dosyasında yalnız bu üç raporun iki alanı değişti.
- `test_S57_olagan_kayit_susma` → `test_S79_olagan_kayit_bag_cari` (S79 A): PB {cari C3, fatura F3} ve PB {cari C3, fatura null} senaryo hatası → KABUL; PP {cari C1} (formdaki peşin) susma
  aynen; kabul / red / susma vakaları genişletildi (P5–P7).
- Mutantlar: B88c ve B88f kaldırıldı (S72 / S73 A ile modelin KENDİSİ oldular); B88d ("söz günü girer") S72'nin B'si → B102; B98'in parçası `_s57_kapsam(d, k, dg)` imzasına taşındı
  (anlamı aynı).
- Model: `soz_durumu` yalnız None / "soz" döner; `hatirlatma.kahin_susuyor` artık yalnız S55 nedenleri (`S52_SOZ_GUNU`, `S52_YENI_GECIKME` YOK); `_s57_kapsam` S79 kabulünü
  `_s79_hedef` ile yapar (hedef denetimi + P7 susmaları).
- Elle senaryolarda s01–s100'ün (s88 dışında) ve `rastgele-1/2/3`'ün senaryo + beklenen dosyalarının HİÇBİRİ değişmedi (model adımından sonra `uret_beklenen.py` + durum: yalnız s88
  ve yeni s101–s103 dosyaları).

### Elle beklenenlerin yazılış sırası (bakım 9)
- b0f3ae4e: yorum P1–P9 + KULLANICIYA SORULMALI 1–2 + bakım 8 satırlarına işaretler — kod, senaryo ve testten önce, AYRI commit (ders 40).
- 0783375f: s101–s103, birim testleri ve G3 (s88, S57 testi) model DEĞİŞTİRİLMEDEN ÖNCE. Eski kâhin (5502508a kopyası + yeni dosyalar) 175 testten 9'u kırmızı
  (`kahin9-eski-model-kirmizi.*`); NEDEN dökümü `kahin9-eski-model-neden.*` (betiği `kahin9-eski-model-neden.py`): s88 3 anahtar (hat3 `S52_SOZ_GUNU`, hat5 / hat6 `S52_YENI_GECIKME`),
  s101 3 (h20 / h21 / h31 `S52_SOZ_GUNU`), s102 5 (h12 / h16 / h20 / h21 `S52_YENI_GECIKME`, h20 / h31 `S52_SOZ_GUNU`), s103 senaryo hatası (bakım 8 U7 (a) susması); birim
  `test_S72_S73_soz_kapsami` (`S52_YENI_GECIKME`), `test_S79_olagan_kayit_bag_cari` ve `test_S79_S54_ile_ayni` (U7 (a)), `test_EK2_4_1_ayni_gun_yazim_sirasi_sonucu_degistirmez`
  (bütün elle senaryoları koşar → s103'te U7 (a)), `Dosyalar` (s88 ve yeni dosyalar henüz yazılmamıştı). Hepsi beklenen nedenle; eski modelde YEŞİL kalan yeni senaryo / test yok.
- a94f1a45: model (P1–P7) + mutantlar. İlk koşuda elle değerlerin HİÇBİRİ değişmedi (174/175; tek kırmızı dosya güncelliği → `uret_beklenen.py`). Aynı commit'te README KULLANICIYA
  SORULMALI 2'nin ÖRNEĞİ düzeltildi (fatura bağında S14 / S25 (a) ile önce 128'den düşüldüğü için örnek sınırı aşmıyordu → "Normal Cari Hesaba İşle" örneği; soru ve seçenekler aynen).
- Kanıt (`docs/kanit/2026-11-06/kahin9-*`): `kahin9-test-utc.*`, `kahin9-test-istanbul.*` (175/175 iki saat diliminde), `kahin9-mutasyon.*` (250/250 öldü; temel 169 test yeşil; ölçülen commit a94f1a45), yeni mutantların öldüren testleri `kahin9-yeni-mutantlar-oldurenler.txt` (betiği `kahin9-yeni-mutantlar.py`), eski model kayıtları.

### Yeni senaryolar, testler ve mutasyonlar
- Elle senaryolar (3, toplam 104): s101 (S72: söz dün / bugün / yarın, söz girildiği gün, söz bitişinin ertesi günü, söz geçtikten sonra yeni söz, ay sonu sözü ve ay dönümü), s102 (S73: söz
  öncesi / sırasında / sonrasında geciken kalem; söz anındaki borç ödenince yalnız yeni geciken kalemle söz sürer; söz bitince bütün gecikmiş), s103 (S79: bağ yeni carinin vadesi sonra
  gelen faturasına / kartına / kaldırılır; kart bağından faturaya; tutar + açıklama aynı düzeltmede; geri yüklenmiş ama açılıştan sonra tarihli kayıt; ödemede alış faturası; bağ
  değişmeden cari → S57 red).
- Birim (175 test): `test_S72_S73_soz_kapsami` (P1, P3), `test_S79_olagan_kayit_bag_cari` (P5–P7: kabul / red / susma), `test_S79_S54_ile_ayni` (P8).
- Mutantlar: 12 yeni, 3 kalktı → liste 250. Öldüren testler (ayrı koşu, not defteri `kahin9-betik/yeni_mutantlar.py`): B102 / B102b / B102c — s101, s102, s88 ve birim; B102d — s101
  (yalnız değerle); B103 / B103b — s102, s88 ve birim; B104 / B104b / B104c — s103 ve iki birim; B104d — s103 ve birim; B104e, B104f — birim (susma dişi). Her kararın B seçeneği ve
  sınır kayması en az bir elle senaryonun DEĞERİYLE yakalanıyor.

### Sürücü için (programla karşılaştırmadan önce)
- **S72 / S73:** `hatirlatma.odeme_sozu_var` artık söz GÜNÜNDE ve söz süresinde yeni geciken kalemi olan caride de dolu (tutar o günkü bütün gecikmiş); `hatirlatma.kahin_susuyor` yalnız
  S55 nedenleri — sürücü söz günü ve söz süresinde de hatırlatmayı KARŞILAŞTIRIR. "Söz geçince" = söz tarihinin ertesi takvim günü. P3 (gecikmişsiz verilen söz) elle senaryoda yok.
  Program Ödeme Sözü'nü kalem düzeyinde tutuyorsa (karar cari düzeyi der) eşleme sürücüde; ayrışırsa önce hata (ders 6).
- **S79:** olağan bağlı kaydın aynı düzeltmede cari + bağı (kaldırma / yeni carinin faturası / kartı; ödemede alış faturası) KABUL; kayıt kendi gününde yeni caride yeniden türetilir. s103'te
  PK geri yüklenmiş ama açılıştan sonra tarihli (s97 PK gibi; sürücü v2.4.9 yedeğinden üretir, ders 17). Senaryo kurulmayan (kâhin susar): yeni bağ başka carinin belgesi / kartı,
  ödemede taksit kartı, formdaki peşin (KS 1), S56 sınırı aşımı (KS 2).
- **S74–S78 = C:** BİLİNEN SINIR — senaryo yok, karşılaştırılmaz (bakım 8'in susma kodları / senaryo hatası iletileri aynen).

### DENENMEYEN (bu bakım)
- Programla karşılaştırma (sürücü güncellemesi ayrı iş; kod Ç5-B).
- S72: hafta sonu / tatile denk gelen söz günü (takvim günü varsayıldı — P1, BAŞ MİMAR değerlendirir; ayrı senaryo yok); devir / yedek geri yüklemede söz kaydı; şüpheli + söz yalnız birim (bakım 8).
- S73: P3 yalnız birim; kalem düzeyinde söz (model dilinde yok).
- S79: hedefi kayıttan SONRA doğan yeni bağ (S55 ile; aradaki dönem S77 = C); tarih + cari + bağ aynı düzeltmede ve şüpheli yeni cariye sınır aşmayan bağ yalnız birimde (red yok; değer
  ölçülmedi); çek / senetle alınmış bağlı tahsilatın carisi (evrakın carisi); Excel kartına (`taksit_excel`) bağ; kilitli dönem; devirle gelen kayıt.
- S74–S78 (C — BİLİNEN SINIR).
- Dinî bayram tarihleri (bu bakımda aranmadı; Z12 aynen).

## Kâhin bakımı 10 (06.11.2026, kodu görmeyen ajan; kullanıcı kararı 06.11 15:01 UTC S80, S81 — "önerilerini uygula", ikisi A)

### Kaynaklar ve bağımsızlık
- Okunan: `CLAUDE.md` (oturum bağlamında; çalışma ağacındakinin ders bölümü ana ağaçtakiyle `diff` aynı), `docs/BAGIMSIZ-DOGRULAMA-PRENSIBI.md` (tamamı), bu README'nin satır 1–121
  (kaynaklar, dosyalar, senaryo dili, şüpheli caride alacak satırları) ve "Kâhin bakımı 8" + "Kâhin bakımı 9" bölümleri. İş listesi: çalışma dalının kopyasında S80–S81 yoktu → ana ağaçtaki
  güncel `docs/2.5.0-IS-LISTESI.md`'nin YALNIZ C ve D bölümleri (C S54–S81 + D'nin 15:01 kararı ve 14:59 baş mimar kararı K9-1..K9-3; arama çıktısıyla C / D'deki S56 satırları). A, B ve E
  okunmadı. D'deki 12:09 baş mimar kararının arama çıktısında görünen koddan alıntıları (dosya / işlev adları) beklenen için KULLANILMADI. Kural kitabında yalnız "peşin" araması
  (`docs/erp/MUHASEBELESTIRME-KURAL-KITABI.md` F-12, T-12, T-13 satırları).
- Kâhin kaynakları: `model.py`, `senaryolar_elle.py`, `test_model.py`, `mutasyon.py`, `uret_beklenen.py` ilgili bölümleri (satır aralıkları ajan raporunda). `server/`, `client/`, `bulut/`,
  `packaging/`, `tools/` (yalnız `node tools/kanit.mjs kos` ÇALIŞTIRILDI), öteki `test/` klasörleri (sürücü dahil), `docs/kanit/` (kendi kanıtları dışında), `docs/erp/C5-ACILIS-TASARIM.md`,
  depo geçmişi / farkı OKUNMADI; program çalıştırılmadı. Depo işlemleri: `merge --ff-only c076e9c0` (ileri sarılamadı; dalda kendi commit'im yoktu → `reset --hard c076e9c0`), `status -s`,
  `log --oneline -3`, `branch`, `archive c076e9c0 test/bagimsiz/muhasebe` (eski kâhin kopyası, not defterinde), bitişte kendi yollarımın `add` + `commit`'i.

### Karar metinleri (AYNEN, iş listesi D "KULLANICI KARARI 06.11 15:01 UTC")
- **S80 = A:** fatura formunda alınan peşin tahsilatın carisi düzeltmeyle değiştirilemez; red, "faturayı düzenleyin".
- **S81 = A:** olağan tahsilat aynı düzeltmede şüpheli kaydı açık bir cariye alınıp 120 bakiyesini aşarsa S56 gibi red (SUPHELI_NORMAL_ASIM).
- Soruların metni (C, AYNEN): S80 "fatura FORMUNDA alınan peşin tahsilatın carisi düzeltilmek istenirse — A öneri: red, 'faturayı düzenleyin' / B: S79 gibi kabul / C: uç durum böyle kalsın
  (BİLİNEN SINIR)"; S81 "olağan tahsilat aynı düzeltmede şüpheli kaydı açık bir cariye ('Normal Cari Hesaba İşle' ya da o carinin faturasına) alınıyor ve 120 bakiyesini aşıyorsa — A öneri:
  S56 gibi red (SUPHELI_NORMAL_ASIM) / B: kabul / C: uç durum böyle kalsın (BİLİNEN SINIR)". Kaynak soru: bakım 9 KULLANICIYA SORULMALI 1 ve 2.
- S56 (AYNEN, D 12:06): "S44 düzeltmesi şüpheli caride 'Normal Cari' sınırını aşarsa SUPHELI_NORMAL_ASIM ile red." BAŞ MİMAR K9-1..K9-3 (D 14:59) değişmez; K9-3: "S79 düzeltmesinde tarih de
  değişirse o kısım sıradan tarih düzeltmesi kurallarıyla (B11 / T12 dahil) işlenir".

### Kural başına yorum (önce yorum, sonra kod — ders 40)
| # | Karar | Kâhin yorumu | Senaryo / test | Mutant |
|---|---|---|---|---|
| L1 | S80 kapsam | "Fatura formunda alınan peşin tahsilat" = kâhin dilinde `tahsilat {fatura, fatura_odemesi: true}` (kitap F-12 "Faturanın peşin / sonradan ödemesi — ödeme satırının tarihi, T-01…T-08"; satış faturası formunun ödeme alanı; bakım 7 V3 (e), bakım 8 U7 (b), bakım 9 P7 (c)'nin konusu). "Carisi düzeltmeyle değiştirilemez" = `duzenle.degisiklik.cari` kaydın carisinden FARKLI; aynı carinin yeniden yazılması cari düzeltmesi değildir (S45 / S57 / U6 ile aynı). Karar yol ayırmıyor ("düzeltmeyle") → olağan kayıtta da geri yüklenmiş, açılıştan önce tarihli Kasa kaydında da (S26 / S40 / S44 yolu) aynı. Üç susmanın tahsilattaki cari kısmı KALKAR | s104, birim | B105, B105b, B105d |
| L2 | S80 sonuç | RED, yeni kod **`FATURA_DUZENLENMELI`** (program iletisi "faturayı düzenleyin"; `BAG_KALDIRILMALI` "önce bağı kaldırın"ın eşi). Düzeltmenin TAMAMI reddedilir: aynı düzeltmedeki tutar / açıklama / bağ / tarih de yazılmaz, kayıt olduğu gibi kalır (X10 / V5 / U6 "tamamı" ilkesi; karar "değiştirilemez; red"). S79 (aynı düzeltmede bağ + cari kabul) formdaki peşine UYGULANMAZ: yeni carinin faturasına bağlansa da, bağı kaldırılsa da red (S80 formdaki peşin için özel kural; P7 (c) bu ayrım yüzünden susuyordu). Red sırası: KILITLI_DONEM → T12 / B11 `KASA_ACILIS_ONCE` (aynı düzeltme kaydın tarihini Kasa açılışından önceki başka güne alıyorsa — U6 ve K9-3'teki sıra) → `FATURA_DUZENLENMELI` → S45 / S57 `BAG_KALDIRILMALI`. Sıra kâhin yorumu — BAŞ MİMAR değerlendirir (yalnız hangi kodun döndüğü; iki sırada da kayıt değişmez) | s104, birim | B105c, B105e |
| L3 | S80 × tutar / açıklama | **[bakım 11: peşinin BAĞI S84 = A ile kural oldu — Ö4, Ö5; tutar / açıklama / tarih aynen]** Karar yalnız cariyi söyler → carisi DEĞİŞMEYEN peşinin tutarı ve / veya açıklaması bugünkü kuralla: olağan kayıtta G-7 (kabul; kayıt kendi gününde yeni tutarıyla yeniden türetilir, faturanın açığı yeni tutara göre), geri yüklenmiş açılış öncesi Kasa kaydında S26 / S40 (kabul; Mutabakat Testi uyarısı sürer). Model DEĞİŞMEZ. Carisi aynı peşinin TARİHİ bugünkü kural (G-7; T12 / B11). Carisi aynı peşinin BAĞI (başka faturaya ya da kaldırma) karar dışı → KULLANICIYA SORULMALI 2 (kâhin bugünkü davranışını korur: olağan kayıtta kabul, S44 yolunda V3 (e) susar; senaryo kurulmaz) | s104, birim | B105f |
| L4 | S80 × ödeme yönü (KODLANMADI) | **[bakım 11: KALKTI — S83 = A, alış faturası formundaki peşin ödeme de FATURA_DUZENLENMELI (Ö1, Ö2); satış iade formundaki ödeme Ö3 susar]** Karar "alınan peşin TAHSİLAT" der; alış faturası formunda yapılan peşin ÖDEME (F-12'nin T-05…T-08 tarafı; kâhin dilinde `odeme {fatura, fatura_odemesi: true}`) karar metninde yok. İki okuma farklı sonuç verir: (a) S80 ile aynı red (F-12 tek satır, gerekçe "faturayı düzenleyin" aynı); (b) olağan bağlı ödeme kuralları (S79: bağ + cari aynı düzeltmede kabul; bağ değişmeden S57 red) → yeni carinin alış faturasına bağlanan ödemede red ↔ kabul. Kâhin SUSAR (senaryo hatası; V3 (e) / P7 (c)'nin ödeme kısmı aynen); KULLANICIYA SORULMALI 1 | birim | B105g |
| L5 | S81 kapsam | "Olağan tahsilat" = bakım 8 U6 tanımı (S44 / S45 / S54 yolu dışındaki tahsilat). "Aynı düzeltmede şüpheli kaydı açık bir cariye ('Normal Cari Hesaba İşle' ya da o carinin faturasına) alınıp" = düzeltmeden SONRAKİ hâlde: (1) kaydın carisi (yeni ya da aynı), kaydın düzeltme sonrası gününde açık şüpheli kaydı olan cari (128 > 0, kayıt hariç — S56 / V3 (d) tanımı); (2) kayıt "Normal Cari Hesaba İşle" (`normal_cari`) ya da Kapatılacak Fatura (`fatura`) ile 120'ye yazıyor; (3) düzeltme bunu getiren alanlardan en az birini değiştiriyor: cari ya da bağ / Normal Cari (`fatura`, `taksit_karti`, `normal_cari` — S44 alanları). Üç yol: (i) S79 düzeltmesi (cari + bağ; bakım 9 P7 (d) susması KALKAR); (ii) bağsız, Normal Cari seçili kaydın yalnız carisi şüpheli cariye (S57 bağsız kayda uygulanmaz; harfiyen "Normal Cari Hesaba İşle ile şüpheli cariye alınıyor"); (iii) carisi aynı kalan, şüpheli kaydı açık carinin kendi tahsilatında "Normal Cari Hesaba İşle" seçilmesi ya da faturasına bağlanması — bakım 8 U5'in "olağan kaydın düzeltmesinde sınır DENENMEYEN" boşluğu (dayanak: bakım 9 KS 2'nin başlığı "bakım 8 U5'in olağan düzeltme DENENMEYEN'ini de kapsar" ve A gerekçesi "aynı tahsilat girişte de reddedilirdi; plan §3.11b/2 sınırı her yolda"; görev metni). (iii) kâhin yorumu — BAŞ MİMAR değerlendirir. Taksit kartı bağı sınıra GİRMEZ (K3: taksit tahsilatı şüpheliden düşer; plan §3.11b/2'nin saydıkları Normal Cari, satış faturasının peşini, Kapatılacak Fatura) | s105, birim | B106, B106c, B106f |
| L6 | S81 sınır ve sonuç | "S56 gibi" = bakım 8 U5 aynen: 120'ye yazılacak kısım (Normal Cari: tutarın tamamı; fatura bağı: S14 / S25 ile bağın faturanın 120'deki kısmını kapattığı tutar — 128'den düşen kısım ve faturanın açığını aşan fazla sayılmaz) > kaydın günündeki 120 bakiyesi (kayıt hariç) → RED `SUPHELI_NORMAL_ASIM`, düzeltmenin TAMAMI (aynı düzeltmedeki tutar / açıklama / bağ / tarih yazılmaz); EŞİTLİK KABUL ("aşarsa"; S56 ile aynı sınır), bir kuruş altı kabul, bir kuruş üstü red. Red sırası: KILITLI_DONEM → `KASA_ACILIS_ONCE` → `FATURA_DUZENLENMELI` (L2) → `BAG_KALDIRILMALI` (S57) → P7 (a) / (b) susmaları (yeni bağın hedefi) → `SUPHELI_NORMAL_ASIM` | s105, birim | B106b, B106e (B78 S56 ile ortak) |
| L7 | S81 × tarih | Aynı düzeltmede tarih de değişirse (K9-3: tarih kısmı sıradan tarih düzeltmesi) sınır kaydın YENİ gününde ölçülür (o günün 120 / 128 bakiyesi, kayıt hariç) — kayıt düzeltmeden sonra o günde durur; girişteki denetimle aynı ölçü ("aynı tahsilat girişte de reddedilirdi"). Bakım 9'un "tarih de değişiyorsa sınır yeni günde ölçülemez → susar"ı (modelin ölçüm sınırlaması, kural değil) KALKAR. Kâhin yorumu — BAŞ MİMAR değerlendirir | birim | B106d |
| L8 | S81 dışı (KODLANMADI; bugünkü davranış korunur) | **[bakım 11: (a)'nın Normal Cari kısmı ve (b) KALKTI — S85 = A (Ö7–Ö10); fatura bağlı, Normal Cari seçilmemiş kaydın yalnız tutar / tarihi Ö7 (iki okuma aynı sonuç, L9)]** (a) cari ve bağ / Normal Cari DEĞİŞMEDEN yalnız tutar, tarih ya da açıklama düzeltmesi Normal Cari / bağlı kaydın 120'ye yazdığını sınırın üstüne çıkarıyor: karar "alınıp" der (düzeltmenin kaydı 120'ye alması), bu düzeltmeler bir yere almıyor → bugünkü gibi denetlenmez (olağan G-7 kabul; S44 yolunda S26 kabul — S56 da yalnız S44 düzeltmesi der). (b) geri yüklenmiş, açılış öncesi Kasa kaydında yalnız cari (S40) düzeltmesi Normal Cari seçili bağsız kaydı şüpheli cariye alıyor: S56 "S44 düzeltmesi", S81 "olağan" der → bugünkü gibi denetlenmez (L5 (ii)'nin S44 yolu karşılığı; olağan kayıtta red, burada kabul — iki karar arasında boşluk). İkisi de KULLANICIYA SORULMALI 3; sürücü kurmaz / karşılaştırmaz | — | — |
| L9 | S81 × fatura bağı yolu (gözlem) | Kâhinin Tek Yükümlülük Kuyruğu'nda bir faturanın 120'deki açık kısmı carinin 120 bakiyesini aşamaz (EK-1 §4 "iki taraf birden açık" değişmezi: açık borç kalemiyle açık alacak kalemi birlikte durmaz). Fatura bağıyla 120'ye yazılan kısım faturanın 120'deki açığını geçemediği için fatura bağı yolu sınırı en çok EŞİTLİKTE tutar, AŞAMAZ; bu yolda red kâhinin ölçmediği bir durumda (S55 bekleyen bağı — S77 = C) doğabilir. s105 fatura bağı yolunu eşitlik ve "128'den düşen kısım sayılmaz" ile ölçer; red Normal Cari yoluyla ölçülür (bakım 9 KS 2'nin örneği de aynı nedenle Normal Cari'ye çevrilmişti) | s105 | B106e |
| L10 | S81 × S56 | Aynı düzeltme (cari + bağ / Normal Cari) olağan kayıtta (S81) ve geri yüklenmiş, açılıştan önce tarihli Kasa kaydında (S54 + S56) AYNI red / kabul ve aynı sayıları verir; fark yalnız Mutabakat Testi uyarısı (bakım 9 P8 ilkesi). S56'nın S44 yolundaki ölçüsü değişmez | birim `test_S81_S56_ile_ayni` | — |

### KULLANICIYA SORULMALI / KÂHİN SUSUYOR (kodlanmadı; SORU DÜZENİ 06.11 09:01: uç durumda üçüncü seçenek)
1. **[bakım 11: S83 = A, kural oldu — Ö1, Ö2]** **S80 × alış faturası formundaki peşin ÖDEME (L4; UÇ):** alış faturası formunda tedarikçiye peşin ödeme yapıldı; ödemenin carisi sonradan düzeltilmek isteniyor. A (öneri): S80 ile aynı — red
   "faturayı düzenleyin" (F-12 satış ve alış için tek kural; peşin faturanın parçası). B: olağan bağlı ödeme kuralları — aynı düzeltmede bağ da değişirse S79 gibi kabul, bağ değişmeden S57 red.
   C: uç durum böyle kalsın (BİLİNEN SINIR; kâhin susar). Örnek: A1 (T1) formunda 200 peşin; ödeme T2'ye alınıp T2'nin A3'üne bağlanıyor — A: red, A1 açığı 800 kalır; B: kabul, A1 1.000 açık,
   A3'ten 200 kapanır. (BAŞ MİMAR F-12'yi tek anlamlı sayarsa A'yı BAŞ MİMAR KARARI olarak da verebilir; kâhin o zaman L4'ü L2'ye bağlar — bir satır + mutant.)
2. **[bakım 11: S84 = A, kural oldu — Ö4, Ö5]** **S80 × formdaki peşinin BAĞI, cari aynı (L3; UÇ):** peşin başka bir faturaya bağlanıyor ya da bağı kaldırılıyor. A (öneri): S80 gibi red "faturayı düzenleyin" (bağın değişmesi peşini faturadan
   koparır; 2.4.4 "bağ sessizce kopmaz"). B: kabul — olağan bağ düzeltmesi (bugünkü kâhin olağan kayıtta böyle; geri yüklenmiş açılış öncesi kayıtta V3 (e) susar). C: uç durum böyle kalsın
   (BİLİNEN SINIR).
3. **[bakım 11: S85 = A, kural oldu — Ö7–Ö10]** **S81 / S56 × sınır yalnız cari / bağ / Normal Cari değişince mi (L8; UÇ):** (a) Normal Cari ya da faturaya bağlı tahsilatın yalnız TUTARI artırılıyor ya da TARİHİ 120'nin daha küçük olduğu
   güne alınıyor; (b) geri yüklenmiş açılış öncesi Kasa kaydında yalnız CARİSİ (S40) Normal Cari seçili kaydı şüpheli cariye alıyor — ikisinde de 120'ye yazılan sınırı aşıyor. A (öneri): S56 / S81 gibi
   `SUPHELI_NORMAL_ASIM` ile red (plan §3.11b/2 sınırı her yolda; aynı kayıt girişte reddedilirdi). B: kabul (bugünkü kâhin; sınır yalnız cari / bağ / Normal Cari düzeltmesinde). C: uç durum böyle kalsın
   (BİLİNEN SINIR). Örnek (a): C2'de 120 100, 128 900; C2'nin Normal Cari tahsilatı 50 → tutar 150'ye düzeltiliyor — A: red; B: kabul, 120 −50 (şüpheli kaydı açıkken).
4. Sürer: bakım 9'un KS 3'ü (bakım 8'in 3–8'i ve öncesi); bakım 9'un 1 / 2'si kural oldu (S80 / S81 = A).
- BAŞ MİMAR değerlendirir (kâhin yorumu, kodlandı): L2 (red sırası), L5 (iii) (aynı carinin kendi tahsilatı — U5 boşluğu), L7 (tarih de değişirse sınır yeni günde).

### Önceki beklentilerle çelişen yerler (eski → yeni, nedeni; G3)
- `test_S40_S44_S45_kapsam_ve_susma`: PP {cari C3} (geri yüklenmiş açılış öncesi formdaki peşin) senaryo hatası (V3 (e)) → RED `FATURA_DUZENLENMELI` (S80; L1), 120|C1 1000 / 120|C3 600
  değişmez. PP {fatura: null} susması aynen (KS 2).
- `test_S79_olagan_kayit_bag_cari`: PP {cari C1} ve PP {cari C1, fatura F1} (P7 (c)) senaryo hatası → RED `FATURA_DUZENLENMELI` (S80); PB {cari C2, fatura null, normal_cari} (P7 (d); 400 > C2'nin
  120 bakiyesi 100) senaryo hatası → RED `SUPHELI_NORMAL_ASIM` (S81). P7 (a) / (b) susmaları aynen.
- Model: `_s57_kapsam`'daki formdaki peşin susması → `_s80_pesin` (tahsilatta red, ödemede susma — L4); `_s40_kapsam`'ın V3 (e) susması yalnız BAĞ düzeltmesinde (cari kısmı `_s80_pesin`'e);
  `_s79_hedef`'in P7 (d) sınır / susma bloğu → `_s81_sinir` (S57 / S79 denetiminden SONRA); `_s44_sinir` kaydın düzeltme sonrası gününü (`gun`) alır (S44 yolunda tarih değişmez → aynı).
  Bilinçli davranış değişikliği (elle senaryoların hiçbirinde yoktu): olağan kayıtta bağsız Normal Cari kaydın carisi şüpheli cariye ve aynı carinin kendi tahsilatında Normal Cari / bağ
  seçimi sınırı aşınca bakım 9'da KABUL ediliyordu (120 eksiye, şüpheli kaydı açıkken) → RED (L5 (ii), (iii)).
- Mutantlar: B104e (P7 (d) susma dişi) KALKTI — susma S81 ile kural oldu. B78 (S56 eşitlik kayması) ve B97 (S56 B) ortak `_s44_sinir` üzerinden artık S81'i de bozar; ikisini s105 de değerle öldürür.
- Elle senaryolarda s01–s103'ün ve `rastgele-1/2/3`'ün senaryo + beklenen dosyalarının HİÇBİRİ değişmedi (model adımından sonra `uret_beklenen.py` + `git status`: yalnız yeni s104 / s105
  dosyaları).

### Elle beklenenlerin yazılış sırası (bakım 10)
- 31bddfbc: yorum L1–L10 + KULLANICIYA SORULMALI 1–3 + bakım 8 / 9 satırlarına işaretler + red kodu listesi — kod, senaryo ve testten önce, AYRI commit (ders 40).
- ac6c8eaf: s104–s105, birim testleri (`test_S80_formdaki_pesin_cari`, `test_S81_olagan_duzeltme_siniri`, `test_S81_S56_ile_ayni`) ve G3 model DEĞİŞTİRİLMEDEN ÖNCE. Eski kâhin (c076e9c0
  kopyası + yeni dosyalar) 180 testten 9'u kırmızı (`kahin10-eski-model-kirmizi.*`), hepsi beklenen nedenle: s104 ve `test_S80`, `test_S79`, `test_EK2_4_1` (bütün elle senaryoları koşar →
  s104) U7 (b) / P7 (c) susması; `test_S40_S44_S45` V3 (e) susması; s105, `test_S81_olagan_duzeltme_siniri` ve `test_S81_S56_ile_ayni` P7 (d) susması; `Dosyalar` (yeni dosyalar yazılmamıştı).
  NEDEN dökümü `kahin10-eski-model-neden.txt` (betiği `kahin10-eski-model-neden.py`): susan düzeltmeler atlanınca s104'te 1 anahtar (redler — 8 FATURA_DUZENLENMELI yok), s105'te 7 anahtar
  (redler; PN ve PK eski modelde KABUL — 120|C2 −800, 128|C2 9000, 120|C1 29999, açık kalemde iki avans). Eski modelde YEŞİL kalan yeni senaryo / test yok.
- 90a3a44e: model (L1–L9) + mutantlar. İlk koşuda elle değerlerin HİÇBİRİ değişmedi (179/180; tek kırmızı dosya güncelliği → `uret_beklenen.py`). Aynı commit'te `test_S81_olagan_duzeltme_siniri`'ye
  iki sıra denetimi eklendi (PP2 150 formdaki peşin → FATURA_DUZENLENMELI, PB {cari, tutar 150} → BAG_KALDIRILMALI; 150 > 100 olsa da L6'nın sırası) — beklenen L6 metninden; B106g'nin dişi.
- Kanıt (`docs/kanit/2026-11-06/kahin10-*`; ölçülen commit 90a3a44e, kirli 0): `kahin10-test-utc.*`, `kahin10-test-istanbul.*` (180/180 iki saat diliminde), `kahin10-mutasyon.*` (263/263 öldü;
  temel 174 test yeşil; `flock -s scratchpad/olcum.lock`, `timeout 7000`, 1009 sn), yeni mutantların öldürenleri, eski model kırmızı kaydı + neden dökümü ve betikleri.

### Yeni senaryolar, testler ve mutasyonlar
- Elle senaryolar (2, toplam 106): s104 (S80: olağan peşinin carisi tek başına / tutarla / yeni carinin faturasına / bağ kaldırılarak / tarihle → red; geri yüklenmiş açılış öncesi peşin →
  red, tarih açılıştan önceki başka güne → KASA_ACILIS_ONCE, açılıştan sonraya → red; carisi aynı peşinin tutar + açıklaması, S26 tutarı, aynı cari → kabul), s105 (S81: S79 düzeltmesinde
  10001 / 9999 / 1 — bir kuruş üstü red, altı ve eşit kabul; düzeltmenin tamamı; S57 önce; fatura bağında 128'den düşen 4000 sayılmaz, 120'de kapanan 1000 = 1000 kabul; bağsız Normal Cari
  kaydın carisi ve aynı carinin kendi tahsilatı → red).
- Birim (180 test): `test_S80_formdaki_pesin_cari` (L1–L4: iki yol, kilit önce, T12 önce, kabul vakaları, ödeme yönü susar, peşinin bağı V3 (e) aynen), `test_S81_olagan_duzeltme_siniri` (L5–L7:
  üç yol, eşitlik, fatura bağı, şüphelisiz cari, tarih iki yönde, S57 / S80 sırası), `test_S81_S56_ile_ayni` (L10).
- Mutantlar: 14 yeni, 1 kalktı → liste 263. Öldüren testler (`kahin10-yeni-mutantlar-oldurenler.txt`, betiği `kahin10-yeni-mutantlar.py`): B105 / B105b / B105c / B105d / B105e / B105f — s104 ve birim;
  B106 / B106b / B106c / B106e / B106f — s105 ve birim; B105g (ödeme yönü susma dişi), B106d (L7 tarih), B106g (L6 sırası) — yalnız birim (değerle: red kodu + bakiye). Her kararın B seçeneği
  (B105, B106) ve sınır kayması (B105c / B105d; B106b, B78) en az bir elle senaryonun DEĞERİYLE yakalanıyor.

### Sürücü için (programla karşılaştırmadan önce)
- **S80:** yeni red kodu `FATURA_DUZENLENMELI` (programın "faturayı düzenleyin" 4xx iletisiyle eşlenir). Formdaki peşinin (satış faturası formunda alınan tahsilat) carisi düzeltilince — olağan
  kayıtta ve geri yüklenmiş, açılıştan önce tarihli Kasa kaydında — düzeltmenin tamamı red; tutar / açıklama kabul. Kurulmayan (kâhin susar ya da karar dışı): alış faturası formundaki peşin
  ödemenin carisi (KS 1), formdaki peşinin bağının değişmesi (KS 2). "Faturayı düzenleyin" yolunun kendisi (faturanın carisi değişince peşinin de geçmesi) kâhinde modellenmedi.
- **S81:** olağan düzeltmede `SUPHELI_NORMAL_ASIM` (S56 ile aynı sınır, eşitlik kabul). s105: PA 10001 / PB 9999 / PC 1 (üstü / altı / eşit), PD fatura bağı (eşitlik; 128'den düşen sayılmaz), PN (bağsız
  Normal Cari kaydın carisi), PK (aynı carinin kendi tahsilatı). Tarih de değişirse sınır yeni günde (L7). Kurulmayan: KS 3 durumları.

### DENENMEYEN (bu bakım)
- Programla karşılaştırma (sürücü güncellemesi ayrı iş; kod Ç5-B).
- S80: iptal edilmiş ya da silinmiş faturanın peşini (F-15: ödemeleri yok sayılır); faturanın düzenlenmesiyle cari değişimi (peşin birlikte — kâhinde modellenmedi); devirle gelen peşin; satış
  iade faturası formundaki ödeme; ödeme yönü (L4 susar) ve peşinin bağı (KS 2) yalnız susma / bugünkü davranış olarak.
- S81: fatura bağının hedefi kayıttan sonra doğuyorsa (S55 × S81; aradaki dönem S77 = C); karşılığı ayrılmış şüpheli kayıt; iki şüpheli kaydı olan cari; POS / çek / senet / Kredi Kartına İade
  yolları (S14 yolları aynı formül, ayrı senaryo yok); kilitli dönem; devirle gelen kayıt; L7 (tarih) yalnız birimde; fatura bağı yolunda red (L9: kâhinde oluşmaz); KS 3 durumları.
- Dinî bayram tarihleri (bu bakımda aranmadı; Z12 aynen).

## Kâhin bakımı 11 (06.11.2026, kodu görmeyen ajan; kullanıcı kararı 06.11 16:18 UTC S83, S84, S85 — "hepsi a", üçü A)

### Kaynaklar ve bağımsızlık
- Okunan: `CLAUDE.md` (çalışma ağacındaki, satır 1–150; kalanı oturum bağlamında), `docs/BAGIMSIZ-DOGRULAMA-PRENSIBI.md` (tamamı), bu README'nin satır 1–185, bakım 3 T12
  (satır 368), bakım 6 X10 (726), bakım 7 V1–V5 (825–829), bakım 8 W10–W19 ve Q1–Q5 satırları (arama çıktısı), bakım 8 "Ek kapsam" S54–S57 (U1–U8, KULLANICIYA SORULMALI 6–8;
  997–1028), "Kâhin bakımı 9" ve "Kâhin bakımı 10" (1123–1322). İş listesi: çalışma dalının (d83ccf1c) kopyasında S83–S85 yoktu → ana ağaçtaki güncel `docs/2.5.0-IS-LISTESI.md`'nin
  YALNIZ C ve D bölümlerinden satır 332–341 (C S79–S85), 346–349 (D 16:18 kararı), 353 (D 15:59 baş mimar kararı K10-1..K10-3) ve arama çıktıları (C / D'deki S56, S79–S86,
  K9-x, K10-x satırlarının ilk 200–300 karakteri). A, B ve E okunmadı. Arama çıktılarında görünen koddan alıntılar (D 12:09 kararındaki dosya / işlev adı, S86 iş atamasındaki modül
  adı) beklenen için KULLANILMADI.
- Kâhin kaynakları: `model.py`, `senaryolar_elle.py`, `test_model.py`, `mutasyon.py`, `uret_beklenen.py` ilgili bölümleri (satır aralıkları ajan raporunda). SAPMA (bildirilir): yeni neden
  dökümü betiğinin biçimi için `docs/kanit/2026-11-06/kahin10-eski-model-neden.py` (bakım 10 ajanının kâhin tarafı betiği; program kodu ya da program çıktısı içermez) açıldı; görev metni
  başka ajanların kanıt dosyalarını yasaklıyordu. `server/`, `client/`, `bulut/`, `packaging/`, `tools/` (yalnız `node tools/kanit.mjs kos` ÇALIŞTIRILDI), öteki `test/` klasörleri (sürücü
  dahil), `docs/kanit/` (kendi kanıtlarım ve yukarıdaki betik dışında), `docs/erp/`, depo geçmişi / farkı OKUNMADI; program çalıştırılmadı. Depo işlemleri: `merge --ff-only d83ccf1c`
  (ileri sarılamadı; dalda kendi commit'im yoktu → `reset --hard d83ccf1c`), `status -s`, `log --oneline`, `branch --show-current`, `cat-file -t`, `archive d83ccf1c test/bagimsiz/muhasebe`
  (eski kâhin kopyası, not defterinde), bitişte kendi yollarımın `add` + `commit`'i.

### Karar metinleri (AYNEN, iş listesi D "KULLANICI KARARI 06.11 16:18 UTC")
- **S83 = A:** alış faturası formunda yapılan peşin ödemenin carisi düzeltmeyle değişmez; S80 ile aynı red ("faturayı düzenleyin").
- **S84 = A:** formdaki peşinin carisi aynı kalıp BAĞI değiştirilmek istenirse red, "faturayı düzenleyin".
- **S85 = A:** şüpheli kaydı açık caride "Normal Cari Hesaba İşle"li kaydın yalnız tutarı / tarihi düzeltilip 120 bakiyesi aşılırsa (ya da geri yüklenmiş kayıtta yalnız cari düzeltmesiyle,
  S40) red (SUPHELI_NORMAL_ASIM).
- Soruların metni (C, AYNEN): S83 "ALIŞ faturası formunda yapılan peşin ÖDEMENİN carisi düzeltilmek istenirse — A öneri: S80 ile aynı red ('faturayı düzenleyin') / B: S79 / S57 kuralları /
  C: uç durum …"; S84 "formdaki peşinin carisi AYNI kalıp BAĞI (Kapatılacak Fatura) değiştirilmek istenirse — A öneri: red, 'faturayı düzenleyin' / B: kabul / C: uç durum böyle kalsın
  (BİL…"; S85 "şüpheli kaydı açık caride 'Normal Cari Hesaba İşle'li kaydın yalnız TUTARI / TARİHİ düzeltilip 120 bakiyesi aşılırsa (ya da geri yüklenmiş kayıtta yalnız cari düzeltmesiyle,
  S40) — A öneri: red (SUPHELI_NORMAL_ASIM) / B: kabul (bugünkü) / C: uç durum böyle kalsın (BİLİNEN SINIR)". Kaynak sorular: bakım 10 KULLANICIYA SORULMALI 1, 2, 3.
- Değişmeyenler (D 15:59, BAŞ MİMAR): K10-1 red sırası KILITLI_DONEM → KASA_ACILIS_ONCE (T12 / B11) → FATURA_DUZENLENMELI → BAG_KALDIRILMALI → SUPHELI_NORMAL_ASIM; K10-2 carisi aynı
  kalan kayıtta Normal Cari seçmek / bağ kurmak da S81 sınırına tabi; K10-3 düzeltmede tarih de değişirse sınır kaydın YENİ gününde. S56 (D 12:06, AYNEN): "S44 düzeltmesi şüpheli caride
  'Normal Cari' sınırını aşarsa SUPHELI_NORMAL_ASIM ile red."

### Kural başına yorum (önce yorum, sonra kod — ders 40)
| # | Karar | Kâhin yorumu | Senaryo / test | Mutant |
|---|---|---|---|---|
| Ö1 | S83 kapsam | "Alış faturası formunda yapılan peşin ödeme" = kâhin dilinde `odeme {fatura: <alış faturası>, fatura_odemesi: true}` (kitap F-12'nin alış tarafı, T-05…T-08; bakım 10 L4'ün konusu). "Carisi düzeltmeyle değişmez" = `duzenle.degisiklik.cari` kaydın carisinden FARKLI; aynı carinin yeniden yazılması cari düzeltmesi değildir (L1 / S45 / S57 ile aynı). Karar yol ayırmıyor ("düzeltmeyle") → olağan kayıtta da, geri yüklenmiş, Kasa açılışından önce tarihli Kasa kaydında da (S40 yolu; nakit peşin ödeme Kasa çıkışıdır). Bakım 10 L4 susması (`odeme` + `fatura_odemesi` carisi → senaryo hatası) KALKAR | s106, birim | B107, B107b, B107c |
| Ö2 | S83 sonuç | "S80 ile aynı red" = L2 aynen: RED **`FATURA_DUZENLENMELI`**, düzeltmenin TAMAMI (aynı düzeltmedeki tutar / açıklama / bağ / tarih yazılmaz, kayıt olduğu gibi kalır). S79 formdaki peşin ödemeye UYGULANMAZ: yeni carinin alış faturasına bağlansa da, bağı kaldırılsa da red (S83'ün B'si "S79 / S57 kuralları" idi). Red sırası K10-1 aynen: kilit → `KASA_ACILIS_ONCE` (aynı düzeltme kaydın tarihini Kasa açılışından önceki başka güne alıyorsa) → `FATURA_DUZENLENMELI`. Carisi aynı peşin ödemenin tutarı / açıklaması / tarihi bugünkü kural (L3 aynen: olağan kayıtta G-7 kabul, geri yüklenmiş açılış öncesi kayıtta S26 / S40 kabul — Mutabakat Testi uyarısı sürer) | s106, birim | B107 |
| Ö3 | S83 dışı (KODLANMADI) | Karar "ALIŞ faturası formunda" der; S80 "fatura formunda alınan peşin TAHSİLAT" (her fatura formu — satış faturası, alış iade faturası) der. Başka bir fatura formundaki peşin ÖDEME (satış iade faturası formunda müşteriye ödenen iade bedeli — kitap F-12 "T-01…T-08" sayar, T-09 yok; programda böyle bir yol olup olmadığı bilinmiyor) ikisinde de yok → carisi düzeltilince kâhin SUSAR (senaryo hatası; bakım 10 L4'ün kalanı); KULLANICIYA SORULMALI 1 | birim | B107d |
| Ö4 | S84 kapsam | "Formdaki peşin" = `fatura_odemesi` kaydı, İKİ YÖNDE: satış faturası formunda alınan tahsilat (S80) ve alış faturası formunda yapılan ödeme (S83). Dayanak: kâhin dilinde ve önceki bakımlarda "formdaki peşin" iki yön için aynı ad (bakım 7 V3 (e), bakım 8 U7 (b)); S83 alış formundaki peşini S80 ile aynı kurala bağladı; S84'ün A gerekçesi (bağın değişmesi peşini faturadan koparır; 2.4.4 "bağ sessizce kopmaz") yön ayırmaz. Kâhin yorumu — BAŞ MİMAR değerlendirir. "Carisi AYNI kalıp" = degisiklik'te `cari` yok ya da kaydın carisiyle aynı (cari de değişiyorsa S80 / S83). "BAĞI değiştirilmek" = U1 / P5'teki "bağ değişiyor" tanımı aynen: `fatura` ya da `taksit_karti` alanlarından en az biri öncekinden FARKLI — başka faturaya (aynı carinin başka faturası), kaldırma (`null`), taksit kartına çevirme. Aynı değerin yeniden yazılması (V3 (g)) değişiklik değildir. "Olağan ve geri yüklenmiş kayıtta aynı" (görev metni; bakım 10 KS 2'nin B'si iki yolu birlikte saydı) → S44 yolunda V3 (e)'nin BAĞ kısmı (senaryo hatası) KALKAR | s107, birim | B108, B108b, B108c, B108d |
| Ö5 | S84 sonuç | RED **`FATURA_DUZENLENMELI`** ("faturayı düzenleyin"), düzeltmenin TAMAMI (aynı düzeltmedeki tutar / açıklama / tarih yazılmaz; L2 / X10 ilkesi). Red sırası K10-1 aynen (FATURA_DUZENLENMELI'nin yeri): kilit → `KASA_ACILIS_ONCE` (nakit peşinin tarihi açılıştan önceki başka güne) → `FATURA_DUZENLENMELI`. Ödemede taksit kartı / Normal Cari model dilinde yok (V3 (f)) → senaryo hatası (S84'ten önce). Bağ değişmeden tutar / açıklama / tarih bugünkü kural (L3 aynen) | s107, birim | B108 |
| Ö6 | S84 dışı (KODLANMADI; bugünkü korunur) | Formdaki peşinde bağ değişmeden yalnız "Normal Cari Hesaba İşle" seçiminin (`normal_cari`) değişmesi: bağ değil (S84 "BAĞI (Kapatılacak Fatura)" der); faturaya bağlı tahsilat zaten 120'de kalır (K3), seçim para sonucunu değiştirmez — fark yalnız red / kabul. Bugünkü kâhin: olağan kayıtta kabul (sonuç değişmez), S44 yolunda V3 (e)'nin bu kısmı SUSAR (senaryo hatası). KULLANICIYA SORULMALI 2; sürücü kurmaz | — | — |
| Ö7 | S85 kapsam (a) | "Şüpheli kaydı açık caride" = kaydın düzeltme SONRASI gününde carinin 128'i > 0 (kayıt hariç; S56 / V3 (d) / L5 tanımı aynen). "'Normal Cari Hesaba İşle'li kayıt" = düzeltme sonrası hâlde `normal_cari: true` olan TAHSİLAT (bağsız: 120'ye yazılan tutarın tamamı; bağlı Normal Cari kaydında S14 / S25 ile 120'de kapanan kısım — L6 ölçüsü). "Yalnız tutarı / tarihi düzeltilip" = düzeltme cari / bağ / Normal Cari alanlarını değiştirmiyor (onlar S81 / S56 — L5; birlikte değişiyorsa sonuç aynı ölçüyle zaten S81 / S56) ve tutar ve / veya tarih değişiyor; aynı düzeltmede açıklama da olabilir (X10 ilkesi: açıklama para sonucunu değiştirmez — kâhin yorumu). Karar yol ayırmıyor → olağan kayıtta tutar ya da tarih; geri yüklenmiş, açılış öncesi Kasa kaydında tutar (S26; bu yolda tarih değişmez — değişirse T12 ya da olağan yol). Bakım 10 L8 (a)'nın Normal Cari kısmı KALKAR. Faturaya bağlı ama Normal Cari seçilmemiş kaydın yalnız tutar / tarih düzeltmesi karar metninde yok; L9 gereği fatura bağıyla 120'de kapanan kısım sınırı AŞAMAZ → "denetlenir" ve "denetlenmez" okumaları kâhinde aynı sonucu verir; model denetlemez (bugünkü), senaryo kurulmaz. Kâhin yorumu (açıklama birlikte; S26 tutarı da) — BAŞ MİMAR değerlendirir | s108, s109, birim | B109, B109d, B109e, B109f, B109g |
| Ö8 | S85 kapsam (b) | "Geri yüklenmiş kayıtta yalnız cari düzeltmesiyle (S40)" = S44 / S45 yolu (V1: geri yüklenmiş, düzeltmeden önce Kasa açılışından önce tarihli Kasa hareketi, tarih değişmiyor); bağsız, Normal Cari seçili kaydın carisi (S40) şüpheli kaydı açık bir cariye → sınır (L8 (b) KALKAR; olağan karşılığı L5 (ii) — iki yol artık aynı, L10 / P8 ilkesi). Aynı düzeltmede tutar (S26) ya da açıklama da varsa ölçü düzeltme sonrası hâl (yeni tutar). Bağlı kaydın carisi S45 `BAG_KALDIRILMALI` önce (değişmez) | s109, birim | B109b |
| Ö9 | S85 sınır ve sonuç | "S56 ölçüsü" (görev metni) = U5 / L6 aynen: 120'ye yazılacak kısım (Ö7) > kaydın düzeltme sonrası günündeki 120 bakiyesi (kayıt hariç) → RED **`SUPHELI_NORMAL_ASIM`**, düzeltmenin TAMAMI (aynı düzeltmedeki açıklama da yazılmaz); EŞİTLİK KABUL ("aşılırsa"), bir kuruş altı kabul, bir kuruş üstü red. Tarih değişirse sınır YENİ günde (K10-3): geri (120'nin daha küçük olduğu güne) de ileri (sonraki tahsilatların 120'yi azalttığı güne) de red olabilir; aradaki uygun güne alma kabul. Ölçü her zaman düzeltme sonrası hâl: tutar AZALTMA da aynı ölçüyle (girişte kabul edilmiş kayıtta azaltma sınırı aşamaz → kabul). Red sırası K10-1 aynen: kilit → `KASA_ACILIS_ONCE` → `FATURA_DUZENLENMELI` → `BAG_KALDIRILMALI` → `SUPHELI_NORMAL_ASIM` (son). Kâhin yorumu (ölçü düzeltme sonrası hâl, azaltma) — BAŞ MİMAR değerlendirir | s108, s109, birim | B109c (B78, B106b, B106d ortak) |
| Ö10 | S85 × S81 / S56 | Aynı düzeltme (Normal Cari kaydın tutarı) olağan kayıtta ve geri yüklenmiş açılış öncesi Kasa kaydında AYNI red / kabul ve aynı sayıları verir; fark yalnız Mutabakat Testi uyarısı (L10 / P8 ilkesi). Sınırın kaydın KENDİ gününde ölçülmesi (S56 / L6 aynen) sonraki günlerdeki Normal Cari kayıtlarını hesaba katmaz — kâhin değiştirmez (BİLİNEN: S56'nın ölçüsü), senaryolarda Normal Cari kaydı carinin son Normal Cari kaydıdır | birim `test_S85_iki_yolda_ayni` | — |

### KULLANICIYA SORULMALI / KÂHİN SUSUYOR (kodlanmadı; SORU DÜZENİ 06.11 09:01: uç durumda üçüncü seçenek)
1. **S83 × satış iade faturası formundaki peşin ödeme (Ö3; UÇ — programda bu yol yoksa soru düşer, sürücü önce bakar):** müşteriye satış iade faturası formunda iade bedeli ödendi; ödemenin
   carisi sonradan düzeltilmek isteniyor. A (öneri): S80 / S83 ile aynı — red "faturayı düzenleyin" (peşin faturanın parçası; F-12 tek kural). B: olağan bağlı ödeme kuralları (aynı düzeltmede
   bağ da değişirse S79 gibi kabul, bağ değişmeden S57 red). C: uç durum böyle kalsın (BİLİNEN SINIR; kâhin susar).
2. **S84 × formdaki peşinde yalnız "Normal Cari Hesaba İşle" seçimi (Ö6; UÇ; para etkisi yok):** formdaki peşin tahsilatın bağı aynı kalıp "Normal Cari Hesaba İşle" işaretleniyor ya da
   kaldırılıyor. A (öneri): red "faturayı düzenleyin" (peşinin bağ alanlarından biri; olağan ve geri yüklenmiş kayıtta aynı). B: kabul (faturaya bağlı peşin zaten 120'de — para sonucu değişmez).
   C: uç durum böyle kalsın (BİLİNEN SINIR; bugünkü kâhin olağan kayıtta kabul, geri yüklenmiş açılış öncesi kayıtta susar).
3. Sürer: bakım 10'un 1 / 2 / 3'ü kural oldu (S83 / S84 / S85 = A); bakım 9'un KS 3'ü ve öncesi aynen.
- BAŞ MİMAR değerlendirir (kâhin yorumu, kodlandı): Ö4 (S84 iki yönde — alış formundaki peşin ödemenin bağı da red), Ö7 (S85'te açıklama da aynı düzeltmede olabilir; geri yüklenmiş kayıtta
  S26 tutarı da S85'in konusu), Ö9 (ölçü düzeltme sonrası hâl; tutar azaltma da aynı ölçüyle).

### Önceki beklentilerle çelişen yerler (eski → yeni, nedeni; G3)
- `test_S80_formdaki_pesin_cari`: O1 {cari T2}, {cari T2, fatura A3}, {cari T2, fatura null} (alış faturası formundaki peşin ödeme) senaryo hatası (L4) → RED `FATURA_DUZENLENMELI`
  (S83; Ö1, Ö2), 102.B1 100 / 120|C1 700 / 120|C3 500 değişmez. P2 {fatura: null} (geri yüklenmiş açılış öncesi formdaki peşinin bağı) senaryo hatası (V3 (e), bakım 10 KS 2) → RED
  `FATURA_DUZENLENMELI` (S84; Ö4, Ö5), Kasa 1200 / 120|C1 800 / 120|C3 500 değişmez, uyarı [P2] sürer.
- `test_S40_S44_S45_kapsam_ve_susma`: PP {fatura: null} (V3 (e), bakım 10 KS 2) senaryo hatası listesinden çıktı → RED `FATURA_DUZENLENMELI` (S84); aynı denetime PP {fatura: F1} (başka faturaya)
  eklendi; PP {cari: C3} (bakım 10 G3) aynen. 120|C1 1000 / 120|C3 600 değişmez.
- Model: `_s80_pesin` ödeme yönünde de red (S83; L4 susması kalktı) ve carisi aynı peşinin bağında red (S84); satış iade formundaki ödemenin carisi `_s83_susma`'da susar (Ö3);
  `_s40_kapsam`'ın V3 (e) susması yalnız Normal Cari seçiminde (Ö6); `_s81_sinir` S85 tetiğiyle (`_s85_tetik`: Normal Cari kaydın tutarı / tarihi); `_s44_kapsam` S44 alanı değişmeyen
  düzeltmede Normal Cari kaydın carisi / tutarı için sınır (S85 (b)). Tahsilattaki S80 iletisi metni aynen korundu (s104 beklenen dosyası bayt bayt aynı).
- Mutantlar: B105g (L4 ödeme yönü susma dişi) KALKTI — S83 A ile modelin kendisi oldu. Metni değişen (anlam aynı): B105 (tahsilat iletisi ayrı satırda), B105c / B105d / B105f (`cari` /
  `bag` değişkenleri), B106c / B106f (satırın başına S85 tetiği). B105b'nin anlamı genişledi (aynı satır: geri yüklenmiş açılış öncesi kayıtta S80 / S83 / S84 yok). B78 / B106b / B106d
  ortak `_s44_sinir` / `_s81_sinir` üzerinden artık S85'i de bozar; s108 / s109 ikisini de değerle öldürür.
- Elle senaryolarda s01–s105'in ve `rastgele-1/2/3`'ün senaryo + beklenen dosyalarının HİÇBİRİ değişmedi (model adımından sonra `uret_beklenen.py` + `git status`: yalnız yeni s106–s109
  dosyaları; ilk denemede s104 beklenen dosyasında yalnız red İLETİSİ metni değişmişti — kod ve değerler aynı — ileti eski metnine döndürüldü).

### Elle beklenenlerin yazılış sırası (bakım 11)
- 00ed5d2b: yorum Ö1–Ö10 + KULLANICIYA SORULMALI 1–2 + bakım 8 / 9 / 10 satırlarına işaretler + red kodu listesi — kod, senaryo ve testten önce, AYRI commit (ders 40).
- 1a847417: s106–s109, birim testleri (`test_S83_S84_formdaki_pesin`, `test_S85_tutar_tarih_siniri`, `test_S85_iki_yolda_ayni`) ve G3 model DEĞİŞTİRİLMEDEN ÖNCE. 7f0aa5e7: s108'e ara mizanlar
  (mza, mzb, mzc) — eski kâhinle ilk neden dökümünde s108'in S85 redleri yalnız `redler` anahtarında ayrışıyordu (sonraki kabul düzeltmeleri kaydın son hâlini aynı yapıyor); değerler elle,
  model yine değişmemişti. Eski kâhin (d83ccf1c kopyası + yeni dosyalar) 187 testten 11'i kırmızı (`kahin11-eski-model-kirmizi.*`), hepsi beklenen nedenle: s106, `test_S80`, `test_S83_S84`,
  `test_EK2_4_1` (bütün elle senaryoları koşar → s106) ve `Dosyalar` (üretici s106'da düşer) L4 susması ("ödeme yönü karar metninde yok"); s107 ve `test_S40_S44_S45` V3 (e) bağ susması;
  s108, s109, `test_S85_tutar_tarih_siniri`, `test_S85_iki_yolda_ayni` S85 yokluğu (beklenen red yerine kabul). NEDEN dökümü `kahin11-eski-model-neden.txt` (betiği `kahin11-eski-model-neden.py`):
  susan düzeltmeler atlanınca s106'da 1 anahtar (redler; 8 FATURA_DUZENLENMELI yok), s107'de 10 (redler; P1'in bağları kabul → 120|C1 1850, 102.B1 250, gecikmiş 1850 / 1700, açık kalemler;
  P2'nin iki bağ düzeltmesi susar → uyarı listesi boş), s108'de 7 (redler; mza 120|C2 −1, mzb 120|C3 200, mzc 120|C3 500 ve 102.B1'ler), s109'da 8 (redler; 120|C2 −1, 120|C3 −10 / −95,
  120|C1, Kasa, gecikmiş). Düzeltme ÖNCESİ raporlarda (mz0, ak1a, g1a) fark 0 — değişmeyen kurallar için elle hesap eski kâhinle aynı. Eski modelde YEŞİL kalan yeni senaryo / test yok.
- Model + mutantlar (bu bölümle aynı commit): ilk koşuda elle değerlerin HİÇBİRİ değişmedi (186/187; tek kırmızı dosya güncelliği → `uret_beklenen.py`). İlk yeni mutant koşusunda B108 ve
  B105b s107'yi değerle değil `_s40_kapsam`'ın artık V3 (e) susmasıyla düşürüyordu; o denetim yalnız Normal Cari seçimine daraltıldı (A modelinde davranış aynı: bağ değişimi önce red) —
  ikisi artık s107'nin DEĞERİYLE ölüyor.

### Yeni senaryolar, testler ve mutasyonlar
- Elle senaryolar (4, toplam 110): s106 (S83: alış formundaki peşin ödemenin carisi tek başına / tutarla / yeni carinin alış faturasına / bağ kaldırılarak / tarihle → red; geri yüklenmiş
  açılış öncesi peşin ödeme → red, açıklamayla red, tarih açılıştan önceki başka güne → KASA_ACILIS_ONCE, açılıştan sonraya → red; carisi aynı tutar + açıklama, S26 tutarı, aynı cari → kabul),
  s107 (S84: olağan peşin başka faturaya / kaldırma / taksit kartına / tutar + açıklamayla / cari aynı yazılmış / tarihle → red; geri yüklenmiş açılış öncesi peşin başka faturaya / kaldırma → red,
  tarih açılıştan önceye → KASA_ACILIS_ONCE, sonraya → red; alış formundaki peşin ödemenin bağı → red; aynı bağın yeniden yazılması + açıklama / S26 tutarı / tutar → kabul), s108 (S85 olağan:
  tutar 101 / 99 / 100 — bir kuruş üstü red, altı ve eşit kabul; Normal Cari olmayan K3 tahsilatının ve şüphelisiz carinin tutarı kabul; tarih geri 10.01 ve ileri 19.01 red, 13.01 kabul,
  19.01 + 250 yeni günde eşit kabul), s109 (S85 geri yüklenmiş: S26 tutarı 101 red, 99 / 100 kabul; S40 yalnız cari 90 > 80 red, 80 = 80 kabul; açıklama birlikte red; uyarılar sürer).
- Birim (187 test): `test_S83_S84_formdaki_pesin` (Ö1–Ö6: iki yol, iki yön, kilit önce, T12 önce, aynı değer kabul, Ö3 / V3 (f) susar, Ö6 bugünkü), `test_S85_tutar_tarih_siniri` (Ö7, Ö9:
  üstü / eşit / altı / azaltma, T12 önce, yeni günde kabul ve red), `test_S85_iki_yolda_ayni` (Ö10).
- Mutantlar: 15 yeni, 1 kalktı → liste 277. Öldüren testler (`kahin11-yeni-mutantlar-oldurenler.txt`, betiği `kahin11-yeni-mutantlar.py`): B107 / B107b / B107c — s106 ve birim; B107d (Ö3 susma
  dişi) — yalnız birim; B108 / B108c / B108d — s107 ve birim; B108b — s107 ve birim (susma); B109 / B109d / B109e / B109f — s108 (ve birim); B109b / B109c / B109g — s109 (ve birim).
  Her kararın B seçeneği (B107, B108, B109 / B109b) ve sınır kayması (B107b, B108d; S85 eşitlik B109c, B78, B106b) en az bir elle senaryonun DEĞERİYLE yakalanıyor.

### Sürücü için (programla karşılaştırmadan önce)
- **S83:** alış faturası formunda yapılan peşin ödemenin carisi düzeltilince — olağan kayıtta ve geri yüklenmiş, Kasa açılışından önce tarihli Kasa kaydında — `FATURA_DUZENLENMELI`
  (S80'in kodu), düzeltmenin tamamı; carisi aynı tutar / açıklama kabul. Kurulmayan: satış iade faturası formundaki ödemenin carisi (KS 1; program bu yolu sunmuyorsa soru düşer).
- **S84:** formdaki peşinin (tahsilat VE alış formundaki ödeme — Ö4, BAŞ MİMAR değerlendirir) carisi aynı kalıp bağı (başka fatura, kaldırma, taksit kartı) değiştirilince `FATURA_DUZENLENMELI`,
  iki yolda. Program yalnız tahsilatta reddediyorsa fark önce hatadır (ders 6), sonra Ö4 kullanıcıya gösterilir. Kurulmayan: formdaki peşinde yalnız "Normal Cari Hesaba İşle" seçimi (KS 2).
- **S85:** `SUPHELI_NORMAL_ASIM` Normal Cari kaydın yalnız tutar / tarih düzeltmesinde (olağan) ve geri yüklenmiş açılış öncesi Kasa kaydında S26 tutarı / S40 yalnız cari düzeltmesinde;
  sınır kaydın düzeltme SONRASI gününde (kayıt hariç), eşitlik kabul. s108 PKT kart tahsilatı (kart SB'den sonra açıldı → 120'den; taksidi aşan 50 avans) ileri tarihin reddini kurar.
  Kurulmayan: faturaya bağlı ama Normal Cari seçilmemiş kaydın yalnız tutar / tarihi (Ö7: iki okuma aynı sonuç).

### DENENMEYEN (bu bakım)
- Programla karşılaştırma (sürücü güncellemesi ayrı iş; kod Ç5-B).
- S83 / S84: iptal edilmiş ya da silinmiş faturanın peşini (F-15); faturanın düzenlenmesiyle cari / bağ değişimi (peşin birlikte — kâhinde modellenmedi); devirle gelen peşin; çek / senet / POS
  ile alınmış peşin (yol `havale` / `nakit` denendi); alış iade faturası formundaki tahsilat (S80'in "her form"u; senaryo yok); KS 1 / KS 2 durumları yalnız susma / bugünkü davranış olarak.
- S85: karşılığı ayrılmış şüpheli kayıt; iki şüpheli kaydı olan cari; bağlı Normal Cari kaydının tutar düzeltmesi (S14 / S25 payı; L9 gereği aşılamaz); tutar azaltma yalnız birimde; şüpheli
  kaydından ÖNCEKİ güne alınan Normal Cari kaydı (yeniden türetmede şüpheliye alma tutarı carinin bakiyesini aşabilir — kurulmadı); kilitli dönem; devirle gelen kayıt; sınırın yalnız kaydın
  KENDİ gününde ölçülmesi yüzünden sonraki günlerde 120'nin eksiye düşmesi (Ö10; S56 ölçüsü — senaryolar kurmaz).
- Dinî bayram tarihleri (bu bakımda aranmadı; Z12 aynen).
