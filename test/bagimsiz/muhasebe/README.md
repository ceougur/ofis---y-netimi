# Muhasebe Çekirdeği + Yıl Sonu Devri — Kâhin (temiz oda modeli), DestekOfis 2.5.0

Programın kodunu GÖRMEDEN, yalnız yazılı kurallardan kurulmuş bağımsız Python modeli (CLAUDE.md KANIT KURALI 2, dersler 5, 40, 43).
Program (JavaScript) ayrı bir sürücü ajanıyla bu senaryolara karşı koşulup karşılaştırılır; **fark önce hatadır** (ders 6).

## Kaynaklar (yalnız bunlar okundu)
- `docs/erp/MUHASEBELESTIRME-KURAL-KITABI.md` — ANA KAYNAK (§1 genel kurallar, §2 hesap planı, §3 olay → madde tabloları, §4–§8, §9 KG).
- `docs/erp/MUHASEBE-CEKIRDEGI-PLANI.md` (§6 Ç5, §7 Ç6, §13 mali müşavir P sonuçları), `docs/devir/DEVIR-PLANI.md` (§0, §4, §11, G2, G3, G7, G13, G14),
  `docs/2.5.0-IS-LISTESI.md` (C, D), `docs/BAGIMSIZ-DOGRULAMA-PRENSIBI.md`, CLAUDE.md.
- Ana oturumun 05.11.2026 17:16 UTC iletisi: ürün sahibi açık maddelerin HEPSİNE "A" dedi (B1, KG-2, KG-3, KG-5, KG-6, KG-7, KG-9, KG-11, KG-12, KG-15,
  KG-16) ve sorudaki tanımlar. Tanımlar kitapla bir yerde çelişiyor (KG-3; aşağıda) → kesinleştirilmedi.
- Biçim örneği: `test/bagimsiz/ebelge/test_model.py`, `mutasyon.py`. `server/`, `client/`, `tools/` (yalnız `tools/kanit.mjs` ÇALIŞTIRILDI), `bulut/`,
  `docs/kanit/`, öteki testler ve git geçmişi OKUNMADI.

## Dosyalar
| Dosya | Ne |
|---|---|
| `model.py` | Model: hesap planı (§2), olay → madde (§3), mizan, büyük defter, gelir tablosu (MSUGT, 7/A), bilanço (ters bakiye brütleştirme, hesaplanmış satırlar, Kesin Değil), dönem sonu değerleme (§5), kapanış (N-01…N-08), devir açılışları (N-09…N-13), Devri Yenile (N-14), Devri Geri Al (N-15), dönem kilidi + 2.4.9 donmuş defter + Kural Farkı Düzeltme Fişi (Ç3, KG-15), gecikmiş borç (B1), değişmezler |
| `senaryolar_elle.py` | 40 elle doğrulanabilir senaryo (s01…s39; s26 iki seçenekli); her birinde ELLE hesaplanmış beklenenler ("elle", hesap yorumda) |
| `uretici.py` | Tohumlu rastgele üretici: bir yıl (~800 olay) + K sonrası Ocak + devir + devirden sonra kayıt + Devri Yenile; tohum 1, 2, 3 |
| `uret_beklenen.py` | `senaryolar/<ad>.json` (kendi kendine yeten senaryo: tanımlar + olaylar + dallar + elle) ve `senaryolar/beklenen/<ad>.json` (her dal için modelin tam çıktısı) yazar / `--denetle` |
| `test_model.py` | 74 test: yardımcılar, olay → madde birim testleri, 40 elle senaryo (her dal + bütün değişmezler), 3 rastgele tohum, değişmez denetçilerinin dişi, dosya güncelliği |
| `mutasyon.py` | 57 metin mutantı (model.py kaynağında tek kural bozulur); her biri en az bir testte KIRMIZI olmalı |

## Çalıştırma
```
python3 test/bagimsiz/muhasebe/test_model.py          # modelin kendi testleri
python3 test/bagimsiz/muhasebe/mutasyon.py            # testin dişi (çıkış 0: bütün mutantlar öldü)
python3 test/bagimsiz/muhasebe/uret_beklenen.py       # senaryo + beklenen dosyalarını yeniden yaz (model değişince)
python3 test/bagimsiz/muhasebe/uret_beklenen.py --denetle
python3 test/bagimsiz/muhasebe/uretici.py 2           # tek tohum özeti
# kanıt: node tools/kanit.mjs kos kahin-muhasebe-test -- python3 test/bagimsiz/muhasebe/test_model.py
```

## Senaryo dili (sürücü bunu programın API'sine çevirir)
Senaryo: `{ad, aciklama, kapsam[kitap satırları], defter_turu, cariler, bankalar, poslar, kartlar, krediler, urunler, olaylar[], dallar[], elle{}}`.
Tutarlar KURUŞ (100000 = 1.000,00 TL). Cari türü `musteri` → 120, `tedarikci` → 320, `diger` → 336. Alt hesap: banka `102.<banka>`, POS `108.<pos>`,
kart `309.<kart>`, kredi `300.<kredi>`; evrak `101.01/.02`, `121.01/.02`; yoldaki `108.90`; belgesiz `600.90/610.90`; Borç / Alacak Yaz `602.90/770.90`.
Her olay `{tur, tarih, …}`; `id` verilirse sonraki olaylar ona başvurur.

| tur | alanlar | kitap |
|---|---|---|
| kasa_acilis / banka_acilis / kart_acilis / kredi_acilis | tutar; banka / kart / kredi (banka eksi = KMH) | M-01, M-04, M-05, M-06 |
| cari_acilis | cari, yon borc/alacak, tutar, aciklama (açılış İŞARETLİ) | M-02, M-03 |
| stok_acilis | kalemler [urun, miktar, birim_maliyet (kuruş, kesir "10000/3" olabilir)] | M-07 |
| evrak_acilis | evrak, evrak_turu cek/senet, yon alinan/verilen, durum portfoy/tahsilde, tutar, cari, banka | M-08, M-09 |
| taksit_excel | cari, toplam, odenen, taksitler [vade, tutar] | H-06, M-10, KG-5 |
| acilis_eslestir | tarih, satirlar [hesap, borc/alacak] (519 karşı satırı kendiliğinden) | M-11 |
| satis_faturasi | cari, M, K, T, ihracat, vade, kalemler [urun, miktar] | F-01…F-04 |
| alis_faturasi | cari, fatura_turu stok/gider, gider_turu genel/satis/finansman/demirbas, M, K, T, S, indirim_ayi (KG-7), kalemler [urun, miktar, M] | F-05, F-06, S-01 |
| satis_iade_faturasi / alis_iade_faturasi | cari, M, K, asil_fatura, kalemler, (alış iadesinde fatura_turu) | F-07, F-08, F-09 |
| esmm / gelen_smm | cari, brut, K, S, T | F-10, F-11 |
| duzenle {kaynak, degisiklik{}} / iptal {kaynak} / sil / geri_yukle | — | F-14, F-15, D-03, R-04, C-03 |
| mahsup | fatura1, fatura2, tutar (madde yok) | F-16 |
| tahsilat | cari, yol nakit/havale/pos/cek/senet/kart, tutar, banka, pos+komisyon+valor, evrak, fatura (+fatura_odemesi), taksit_karti, supheliden | T-01…T-04, T-10…T-13, H-04, J-03 |
| odeme | cari, yol nakit/havale/kart/cek/senet/ciro, tutar, banka, kart, evrak, fatura, taksit_karti | T-05…T-09, H-05 |
| kayit_tahsilati / kasa_giris / kasa_cikis | tutar | T-14, K-01, K-02 |
| bankadan_kasaya / kasadan_bankaya | banka, tutar | K-03, K-04 |
| banka_transfer | gonderen, alici, tutar, ucret, bsmv, valor | K-05, K-06, K-07 |
| banka_masraf / banka_masraf_faturali / faiz_geliri / faiz_gideri / banka_diger_gelir / banka_diger_gider | banka, tutar (+bsmv) / M, K / brut, stopaj | K-08…K-12 |
| hesapsiz_hareket / kart_borcuna_aktar | cari, yon / kart, tutar, acilistan_once | K-14, K-15 |
| pos_aktar {tahsilat} / pos_komisyon_faturasi {K, karsi komisyon/cari} / pos_iade {tahsilat, cari, tutar, komisyon_iadesi} | — | D-01, D-02, D-04 |
| kart_harcama / kart_borc_odeme / kart_faiz / kredi_kullan / kredi_odeme | kart, cari ya da urun+miktar, tutar / banka / anapara, faiz | D-05…D-10 |
| evrak_tahsile_ver / evrak_bankadan_geri_al / evrak_tahsil / evrak_karsiliksiz / verilen_evrak_ode / verilen_evrak_geri_al / evrak_islem_geri_al | evrak, banka, yol kasa | Ç-02…Ç-12 |
| taksit_karti / taksit_kapat | cari, kaynak fatura/mevcut_borc/yeni_borc, fatura, toplam, taksitler | H-01, H-02, H-03, H-07 |
| kdv_mahsup {ay} / kdv_mahsup_geri_al {ay} / fis_ters {fis} | — | V-01, R-03 |
| vergi_odeme / gecikme_zammi | yol, banka, tutar | V-02, V-03, V-04 |
| supheliye_al / karsilik_ayir / degersiz_yaz / supheliden_cikar | cari, tutar | J-01, J-02, J-05, J-06 (J-04 kendiliğinden) |
| stok_giris / stok_cikis_satis / stok_musteri_iadesi / stok_tedarikci_iadesi / stok_duzeltme | urun, miktar, tutar, karsi nakit/havale/cari | S-02…S-06 |
| borc_yaz / alacak_yaz | cari, tutar, aciklama, acilis (işaret), onay (KG-16 "Açılış Olabilir" onayı), vade | C-01, C-02, KG-16 |
| ters {hedef} | banka işlem kartı → Ters Kaydet (girildiği gün) | R-01, R-02 |
| donem_kilitle {tarih, kural: "2.4.9" göç senaryosu} / kural_farki_duzelt / cari_tur_degistir {cari, yeni_tur} | — | Ç3, KG-15, N-16, G-2 |
| devir {K, secenek borc_alacak/sadece_bakiye} / devri_yenile {duzeltmeler[]} / devri_geri_al | — | N-01…N-15 |
| rapor {ad, rapor, dosya canli/arsiv, …} | mizan {bas, son} · gelir_tablosu {bas, son} · bilanco {tarih} · buyuk_defter {hesap, bas, son, cari} · gecikmis {cari, tarih} · acik_faturalar {cari, tarih} · degerleme {tarih} · yevmiye · kural_farki | §4, §7 |

Çıktı anahtarları: bilanço kalemleri `I.A … II.D` (aktif), `III.A … III.I`, `V.A, V.D, V.E, V.F (Dönem Net Kârı), V.K (Geçmiş Yıllar — Kapanmamış), V.G (519)`;
gelir tablosu `A, B, C, D, BSK, E, FK, F, G, H, OK, I, J, DK, K, DNK`; mizan satırı `hesap|cari`; tutar işareti borç +. Kesin Değil kodları:
`TAMAMLANMAMIS_ACILIS, SATISLARIN_MALIYETI_TAHMINI, SATISLARIN_MALIYETI_HESAPLANMADI, EKSI_KASA, EKSI_STOK, TERS_BAKIYE:<hesap>, BORCLU_360,
KAPANMAMIS_ONCEKI_YIL, KURAL_DEGISIKLIGI_FARKI, SINIFLANDIRILMAMIS_TAHSILAT, BILGI_AMACLI, AKTIF_PASIF_FARKI`. Red kodları (program 4xx):
`KILITLI_DONEM, KASA_ACILIS_TEKRAR, KASA_ACILIS_SONRA, SUPHELI_FAZLA, KARSILIK_FAZLA, SUPHELI_YOK, SUPHELI_TAHSILAT_FAZLA, EVRAK_DURUMU,
KDV_MAHSUP_TEKRAR, KDV_MAHSUP_BOS, ZATEN_TERS, ESLESTIRME_HESAP, ESLESTIRME_TERS, KG15_B_DUZELTILMEZ, KURAL_FARKI_YOK, DEVIR_YENILE_CAKISMA`.

## Model kapsamı
Kural kitabı §3'te 129 olay satırı; 127'si modelde (olay ya da "madde yok" kuralı olarak) ve en az bir testte geçiyor. Modellenmeyen: F-17 (Müşteri Fişi
Olarak Bırak — defter etkisi yok, olay gerekmez), S-08 (aynı mal için stok girişi + alış faturası — bağlama kuralı, arayüz düzeyi).

## Dallar
Varsayılan bütün maddeler A (ürün sahibi 05.11.2026 17:16). B dalları da kurulu (testlerde A esas; B'nin elle değerleri kısmi).
| Madde | A (varsayılan) | B |
|---|---|---|
| B1 | vadesi geçmiş fatura kalanı gecikmiş (taksitli faturada yalnız taksit) | fatura hariç |
| KG-2 | belgesiz gelir 600.90 / 610.90, KDV ayrılmaz | stok kartında oran varsa iç yüzde KDV |
| KG-3 | KİTAP §9 A: Kasa girişi ve kayıt tahsilatı 649.90 | ikisi 336.90 · ayrıca **SORU** dalı: kayıt tahsilatı 336.90, Kasa girişi 649.90 (ana oturumun soru tanımı) |
| KG-5 | Excel kartı açılış alacağı B CH (T−P) / A 519 | yeni satış 600.90 + önceden ödenen 519 |
| KG-6 | POS komisyonu satış (çekim) günü, 653 | valör günü |
| KG-7 | alış faturasında "KDV İndirim Dönemi" alanı (gider belge tarihinde) | hep belge ayı |
| KG-9 | eksi miktarlı ürün 0 değer + Kesin Değil | eksi değer |
| KG-11 | satışların maliyeti "Tahmini" — Gelir Tablosu ve Bilanço birlikte | "Hesaplanmadı" |
| KG-12 | kapanmamış önceki yıllar yıl yıl, 570 / 580 | hepsi 590 / 591 |
| KG-15 | kilitli dönemde 2.4.9 kuralıyla donmuş farka ilk açık gün "Kural Farkı Düzeltme Fişi" | yalnız "Kural Değişikliği Farkı" |
| KG-16 | açıklaması "Açılış" ama işaretsiz kayıt "Açılış Olabilir" listesine; onaylanırsa 519 | sessizce 602.90 / 770.90 |
Tek dallı (kitapta öneri / sorulmaz): KG-1 519, KG-4 A, KG-8 A (191), KG-10 A, KG-13 A (vergi karşılığı yok), KG-14 A (198), KG-17 A, KG-18 A, KG-19 A, KG-20 A
(yalnız valörden önce), KG-21 A (659), KG-22 A, KG-23 A, KG-24 A (601), KG-25 A (336); POS komisyonu 653 (760 geçişi 2.5.1, çekirdek §13).

## Değişmezler (her senaryoda, her dalda koşar)
Her madde dengeli ve > 0 · mizan Σ borç = Σ alacak, Σ bakiye = 0 · Aktif = Pasif (tutmazsa fark + Kesin Değil, denkleştirme yok) · Gelir Tablosu
(1 Ocak → t) Dönem Net Kârı = Bilanço hesaplanmış Dönem Net Kârı (kapanmış dosyada = N-07'nin 590/591 tutarı) · modül bakiyeleri (kasa, banka, kart, kredi,
POS bekleyen, yoldaki, cari = CH + 128, evrak portföyü) = defter · büyük defter = mizan (ana hesap). Devirde ayrıca: arşivde 6 / 7 sınıfı 0 ve 153 = DSS ·
her bilanço hesabı (alt hesap ve cari boyutuyla) arşiv K kapanışı = yeni yıl K+1 açılışı · yeni yıl 519 = arşiv 519 · devir maddeleri 6 / 7'ye
dokunmaz (yeni yıl Gelir Tablosu devir anında 0) · modül bakiyeleri iki dosyada eşit · arşiv ≤ K + yeni yıl > K hareket sayısı = devir öncesi.
Rastgele tohumlarda ek: devirden önceki canlı Gelir Tablosu (tahmini) = arşivin Gelir Tablosu (kesin); devir öncesi bilanço aktifi = arşiv bilançosu aktifi;
**devir şirketin durumunu değiştirmez** — aynı olaylar devirsiz koşulunca son bilanço aktifi ve 1–4 sınıfı bakiyeleri (153 defter değeri hariç) aynı.

## KARAR GEREKİYOR (kural kitabında belirsiz bulunan yerler; kâhinde kesinleştirilmedi, model seçimi yanında)
1. **KG-3 tanım çelişkisi**: kitap §9 A = K-01 ve T-14 ikisi 649.90; kullanıcıya sorulan A = kayıt tahsilatı 336.90 (gelir değil), Kasa girişi "649". Model:
   varsayılan kitap A, ayrıca SORU dalı (s11 iki dalı da taşır). Ayrıca Kasa girişi 649 mu 649.90 mı (kitap K-01 "öneri 649.90").
2. **B1 ayrıntısı**: "bağsız tahsilat en eski faturaya" — açılış ve vadeli Borç Yaz satırları da aynı kuyrukta mı (model: tek kuyruk, tarih sırası); vadesiz açılış /
   Borç Yaz gecikmiş sayılmaz (model); karşılıksız çekle yeniden borçlanan tutar (Ç-07) gecikmiş mi (model: vadesi yok → hayır); kapatılan taksit kartının
   (H-07) kalanı (model: sayılmaz); H-02 "mevcut borç" kartında kart taksiti ile alttaki borç çift sayılabilir (model ayrıştırmaz, senaryo yok); vade günü
   gecikmiş değil (vade < tarih).
3. **Devirde cari açılış satırının vadesi**: eski §4.2 "K+1" diyordu, G2 §4.2'nin YERİNE geçti ve vade yazmıyor. Model vadesiz (devirden önce ve sonra
   gecikmiş aynı — s26). K+1 olursa vadesiz eski borçlar devir ertesi gün gecikmişe girer.
4. **KG-17 "cari başına NET tek madde"**: açık kalemler bu net maddenin içinde mi ayrı mı (model: açık kalem başına ayrı N-10 maddesi + cari net madde).
   Bakiyeler etkilenmez; yeni yıl mizanının borç / alacak toplamları etkilenir.
5. **KG-12 A önceki yıl değerlemesinin tarihi**: N-08 "K" tarihli; ama önceki yılın N-01'i K tarihli yazılırsa o yılın satışların maliyeti cari yılın Gelir
   Tablosu'na düşer. Model önceki yıl değerlemesini o yılın 31.12'sine (dönem sonu sınıfı) yazar; o yıl kilitliyse fiş kilitli döneme düşer (Ç2 409 ile çelişir).
6. **KG-12 A 570 / 580 dağıtımı**: yıl yıl brüt (kâr yılı 570, zarar yılı 580) mı net mi — model yıl yıl brüt.
7. **KG-12 B**: Bilanço'nun hesaplanmış Dönem Net Kârı önceki yılları da içerir → "Gelir Tablosu kârı = Bilanço kârı" değişmezi B'de tutmaz (model B'de koşmaz);
   B'de de değerleme yıl yıl zincir mi (model: evet, §5.1 koşulsuz).
8. **KG-9 A sonraki yıl**: eksi miktarlı ürünün sonraki yıl dönem başı miktarı (model 0; eksi alınırsa ortalama şişer) — yazılı değil.
9. **KG-11 A ara tarih**: yıl ortası tahmini değerlemede ortalama 1 Ocak – t alışlarıyla (model); §5.1 "1 Ocak – K".
10. **KG-15 A**: düzeltme fişi önceki yıl(lar)ın donmuş 602 / 770 farkını cari yılın ilk açık gününe yazar → cari yılın Gelir Tablosu önceki yılın düzeltmesini taşır;
    fişin sınıfı yazılı değil (model olağan). 2.4.9 kuralının ayrıntısı planda yalnız "açılış 500, açılış evrakı 602 / 770, cari açılışı açıklamadan" — model bu
    kadarını kurar (K-14, taksit açılışı, .90 alt hesap 2.4.9'da nasıldı bilinmiyor).
11. **KG-7 A devirde**: Ocak'a ertelenmiş 191 (etiketli) yeni yılın mahsubuna girer; Aralık'ta mahsup edilmemiş etiketsiz 191 girmez (model, G4 "yalnız Devri
    Yenile ile") — s04 boş Ocak mahsubunu reddeder. İ / H "borç / alacak hareketi" brüt alınır; 191'i alacaklandıran ters kayıt (R-01) mahsup sonrası 191'i eksiye
    düşürebilir.
12. **N-09 parantezindeki "taksit"**: devirde taksit kartının defter karşılığı cari açılışının içinde (model ayrı madde yazmaz; yazılırsa çift sayım).
13. **Devri Yenile çakışması (G7)**: yalnız düzeltmeyle KAPANAN kalem (model) mi, K sonrası bağlı tutarın altına inen kalem de mi.
14. **F-15 "bağlı ödemeleri"**: yalnız fatura formundaki peşin ödeme (model) mi, Kapatılacak Fatura bağıyla ayrıca girilen tahsilat da mı.
15. **J-01 ve açık kalem**: şüpheliye alma CH'yi alacaklandırdığı için açık kalem dağıtımında faturayı kapatır gibi davranır (model); devirde bu tutar 128 açılışıyla gelir.
16. **POS komisyonu hesabı**: KG-6 önerisi 760, çekirdek §13 "653 → 760 2.5.1'e" — model 653.
17. **D-04 valörden sonra komisyon iadesi** ("B 108 / A komisyon hesabı" geçmiş POS'ta 108'i eksiye düşürür) — model desteklemez.
18. **Yıl ortası kesim tarihi** (s32: K = 29.02.2028): kitap "mali yıl = takvim yılı"; K yıl ortası olabilir mi — model izin verir.
19. **F-06 gider türü → hesap** (Ç1, DOĞRULANMADI): genel 770, satış 760, finansman 780, demirbaş 255.
20. **KG-2 B**: iç yüzde KDV ayrılınca matrah 600 mü 600.90 mı (model 600.90); stok modülü müşteri iadesinde KDV 191 (KG-8 A).
21. **Ekstre (G14 (3))**: "açık kalemler düşülmüş" — satış açık kalemi Borç Toplamı'ndan, alış açık kalemi Alacak Toplamı'ndan (model); bakiyesi 0 caride
    (§11.3) açılış maddesi yok, ama "Borç ve Alacakları Aktar"da toplamlar sıfırdan farklıysa ekstre satırı yazılır mı.
22. **Kesin Değil metinleri** programın; model kod kullanır (yukarıdaki liste) — sürücü eşlemesi gerekir.

## DENENMEYEN / BİLİNEN SINIRLAR (modelin)
- Programla karşılaştırma (sürücü ayrı ajan). Kod hiç okunmadığı için alan adları / uç noktalar sürücüde eşlenir.
- B dallarının elle değerleri kısmi; KG-13 B, KG-18 B, KG-19 B, KG-20 (valörden sonra), KG-24 B kurulmadı.
- 2.4.9 donmuş defterinin gerçek 2.4.9 çıktısıyla aynılığı (model 2.4.9'u plan cümlelerinden kurar; fark testi eski sürümün gerçek koduyla yapılmalı — ders 17).
- Dosya düzeyi devir mekanizması (kopyada üret + takas, bakım kipi, kalıcı devir yedeği, şema kapısı, arşiv kaydı), e-Belge numara tabanı, gelen kutusu,
  WhatsApp, iki şirket, yetki, Defter Türü ekranı, hacim bütçesi — modelde dosya / süreç yok.
- Zincirleme ikinci yıl devri ve "yalnız EN SON arşiv yenilenir" kuralı senaryoda yok (model tek devir zinciriyle denendi).
- Devri Geri Al'ın kesim sonrası kayıtları taşıması 2.5.1 (model: devirden sonraki kayıtlar kaybolur, s29 BİLİNEN SINIR olarak gösterir).
- F-17, S-08 modellenmedi (yukarıda).
