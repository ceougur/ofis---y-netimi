# e-Belge kâhini — kurallar ve kararlar (dil `destekofis-ebelge/3`, 23.10.2026; `/2` 22.10.2026; `/1` 18.10.2026)

Bu kâhin programın kodunu GÖRMEDEN yazıldı (CLAUDE.md KANIT KURALI 2, ders 5). Okunan kaynaklar: GİB mevzuatı/bilgisi, `docs/fatura/E-BELGE-EDM.md`,
`docs/FATURA-ISTEKLER.md` ("Kararlar"), `docs/FATURA-KARSILASTIRMA.md`, `docs/FATURA-QA-RAPORU.md` (yalnız grep), `CLAUDE.md` "Açık iş" 2.4.3
kararları, `test/bagimsiz/` düzeni. API yüzeyi (uç adları, gövde biçimi) yalnız `test/helpers.mjs`, `test/einvoice-mock.mjs` ve
`test/ebelge-243*.test.mjs` / `test/einvoice-edm.test.mjs` içindeki ÇAĞRI satırlarından ve kara kutu yoklamasından (yanıt alanları: `number`,
`eStatus`, `status`, `profile`, `issueDate`, `ettn`; liste sekmeleri `all`, `cancelled`, `pending`) öğrenildi. `server/` ve `client/` OKUNMADI.

Belirsiz kalan yerde sıra: plan/mevzuat → en yaygın muhasebe programlarının yerleşik çözümü → ikisi de iki davranışa izin veriyorsa
ÇATAL (model iki dünya üretir, adım sonunda gözleme en yakın olan seçilir; değişmezler çataldan bağımsız her adımda uygulanır).

## Kurallar

| No | Kural | Kaynak |
|----|-------|--------|
| K1 | Belge türü carinin e-Fatura işaretinden gelir: işaretliyse e-Fatura, değilse e-Arşiv. | CLAUDE.md 2.4.3 karar (4) |
| K2 | e-Fatura alıcısının posta kutusu (PK) seçilmemişse belge gönderilemez; "Kaydet ve Gönder" numara harcamadan durur. | CLAUDE.md 2.4.3 karar (2); GİB: e-Fatura alıcı etiketine (PK) gider |
| K3 | Gerçekte e-Fatura mükellefi olan alıcıya e-Arşiv gönderilmez. | GİB e-Arşiv uygulaması (e-Arşiv yalnız kayıtlı kullanıcı olmayanlara); FATURA-KARSILASTIRMA "e-Fatura mükellefi olmayana e-Arşiv; mükellefe e-Fatura" |
| K4 | Seriler: test ortamında e-Fatura TEF, e-Arşiv TEA; kâğıt / Müşteri Fişi FIS. Seriler birbirinden bağımsız sayılır. | E-BELGE-EDM.md, CLAUDE.md 2.4.2–2.4.3 (TEF/TEA test serisi); kara kutu: ayar `series` |
| K5 | Numara = 3 harf seri + 4 hane yıl + 9 hane sıra; seri+yıl içinde 1'den başlar, boşluksuz artar; yıl değişince 1'den. | GİB e-Fatura/e-Arşiv numara biçimi (UBL-TR `cbc:ID`, 16 karakter) |
| K6 | Aynı seri+yılda numara sırası tarih sırasını bozamaz (daha büyük numara daha eski tarihli olamaz). Kâğıt seride de. | VUK sıra-tarih uyumu; FATURA-ISTEKLER satır 77 "VUK sıra-tarih uyumu"; satır 17 "seri kronolojisi" |
| K7 | Gönderilecekler = gönderilmemiş, iptal edilmemiş, listeden silinmemiş e-Belge (numaralı ama gitmemiş belge de dahil). | FATURA-ISTEKLER satır 44, 122–123; CLAUDE.md 2.4.3 (H1, B3: bekleyen belgelerin görünürlüğü) |
| K8 | Daha eski tarihli, gönderilebilir, numarasız bekleyen belge varken (aynı seri+yıl) yeni belgeye numara verilmez; yeni belge Gönderilecekler'de numarasız kalır. Aynı tarih bekletmez (aynı günde sıra bozulmaz). Seçili turda seçilmeyen eski belge de bekletir. | CLAUDE.md (görev metnindeki 2.4.3 kararları); K6'nın sonucu: eski belge aksi hâlde kalıcı olarak gönderilemez |
| K9 | KALICI engelli (K3 alıcı mükellef, K6 tarih sırası) ya da listeden silinmiş belge seriyi BEKLETMEZ. GEÇİCİ engelli belge — posta kutusu seçilmemiş e-Fatura (K2), tarih sırasına sığıyorsa — aynı seri+yıldaki daha yeni belgeleri BEKLETİR (yeni belge numara almaz; GİB sıra kuralı korunur). Bekletilen belgenin tur sonucu ok:false olabilir ama kodu ve iletisi dolu olmalı (I19). | CLAUDE.md 2.4.3 "kalıcı engelli belge seriyi bekletmez"; baş mimar kararı 18.10.2026 — geçici/kalıcı ayrımı: kullanıcının belge üzerinde tek adımla düzeltebildiği engel geçicidir (Posta Kutusu Seçin) |
| K10 | Tümünü Gönder bütün Gönderilecekler'i eskiden yeniye (tarih, aynı tarihte yazım sırası) gönderir; seçili gönderimde yalnız seçilenler (aynı sırayla). | CLAUDE.md 2.4.3 (B1); ders 31 (aynı tarih → yazım sırası) |
| K11 | EDM'de zaten olan belgenin yeniden gönderimi ("zaten gönderildi") hata değildir; belge aynı numarayla "gönderildi" olur. | CLAUDE.md 2.4.3 "'zaten gönderildi' eşzamanlı durumda hata değildir"; FATURA-ISTEKLER satır 109–110 |
| K12 | Ağ yokken (bağlantı kurulamıyor, istek EDM'ye kesin ulaşmadı) numara verilmez; tur durur, kalanlara numara verilmez. | CLAUDE.md 2.4.3 "ağ yokken tur durur, kalanlara numara verilmez"; FATURA-ISTEKLER satır 122 "resmî numara gönderim anında verilir (GİB serisinde boşluk kalmasın)" |
| K13 | EDM'nin reddettiği (geçici hata) belge: numara korunur ve aynı numarayla yeniden gönderilir YA DA numara bırakılır (EDM görmedi) — ÇATAL; program aynı istekte yeniden denerse gidebilir. Tur sürer. | FATURA-ISTEKLER satır 109 "EDM reddederse durum Hata olur (düzeltilip yeniden gönderilir)", satır 124 "biri düşerse diğerleri sürer"; numaranın akıbeti yazılı değil → çatal |
| K14 | Bağlantı istek gönderildikten sonra koparsa (EDM işlemiş olabilir) numara KORUNUR; programın "gönderildi" bilgisi belirsiz (çatal), EDM gerçeği sahte EDM'nin kaydından alınır. | FATURA-ISTEKLER satır 109–110 "bağlantı koparsa durum değişmez (aynı ETTN ikinci kez kabul edilmez; önce Durum Sorgula)" |
| K15 | Tur sürerken Listeden Silinen belge gönderilmez (silme kabul edildiyse). Turun ilk gönderilen belgesi silinemez. | CLAUDE.md 2.4.3 "tur sürerken Listeden Silinen belge gönderilmez" |
| K16 | İleri tarihli belge kaydedilmez / tarih ileriye düzenlenmez. | FATURA-ISTEKLER satır 133 "ileri tarih reddedilir" |
| K17 | Kalıcı engelli (K2/K3) belgenin "sonra" kaydı: ekran uyarır; API kaydedebilir ya da reddedebilir — ÇATAL. | CLAUDE.md 2.4.3 karar (2) "formda kaydetmeden uyarı" (API davranışı yazılı değil) |
| K18 | Listeden silinen belge sonra kartından yine gönderilebilir. | FATURA-ISTEKLER satır 122–123 |
| K19 | İki oturum aynı anda Tümünü Gönder: sonuç tek turla aynı; bir belge için "hata" yanıtı verilmez. | CLAUDE.md 2.4.3 (K11 ile) |
| K20 | Gönderilmiş / iptal / kâğıt belge listeden silinmez. | FATURA-ISTEKLER satır 44 (yalnız Gönderilecekler'den silinir) |
| K21 | Numara almış ama gitmemiş belgenin Listeden Sil'i: reddedilir YA DA kabul (numara korunur) — ÇATAL. | Yazılı değil |
| K22 | **DÜZELTİLDİ 22.10.2026 (/2):** gönderilmiş e-Arşiv ve e-SMM, İLETİM gününden (EDM'nin belgeyi kabul ettiği gün; ilk kabul) itibaren 8 gün içinde EDM'de iptal edilir; başlangıç günü sayılmaz, 8. gün dahil; 9. gün ve sonrası İptal Et de Yalnız Programda İptal de reddedilir, belge değişmez; numara korunur. Eski metin ("kesimden ≤7 gün") yanlış dayanaklıydı: kaynak süreyi iletimden sayar. | [GİB] e-Arşiv Uygulamaları İptal/İtiraz Bildirim Kılavuzu V.1.1 §3 ("8 günlük sürenin tespiti e-belgenin alıcıya iletilme tarihinden itibaren başlar. İptal işlemi her durumda 8 günlük süre içinde yapılmalıdır"; docs/kanit/2026-10-22/244-iptal/kaynak/*.pdf sha256 2d51793b…f5ebac); [KULLANICI] CLAUDE.md KARARLAR (5) İPTAL SÜRESİ (TBK 92); "İptalde numara korunur" FATURA-ISTEKLER satır 119 |
| K23 | Gönderilmiş e-Fatura, süresi geçmiş e-Arşiv ya da ağ yokken gönderilmiş belge iptali: reddedilir YA DA yalnız programda iptal — ÇATAL. | FATURA-ISTEKLER satır 112 (e-Fatura entegratörden iptal edilmez; alıcı reddi/iade), FATURA-KARSILASTIRMA satır 44 ("programda iptal önerisi"); EK 19.10.2026: 8 günlük sınırın içindeki e-Arşivde ağ yoksa entegratöre ulaşılamaz (K22 ağa bağlı) → üçüncü dünya: iptal yapılmaz, yanıt 5xx (RFC 9110 §15.6.3) |
| K24 | Gönderilmemiş belge iptal edilir; numarası (varsa) korunur, artık gönderilmez. | FATURA-ISTEKLER satır 119 |
| K25 | Gönderilmiş ya da iptal belge düzenlenmez. | FATURA-ISTEKLER satır 119 "Kesilen belge düzeltilmez (yasal belge)"; GİB: gönderilmiş belge değiştirilemez |
| K26 | Numaralı ama gitmemiş (ya da kâğıt) belgenin tarihi: reddedilir YA DA değişir — ÇATAL (değişirse K6 değişmezi denetler). | Yazılı değil |
| K27 | Numaralı belgede Düzenle belge türünü değiştiremez. | CLAUDE.md 2.4.3 karar (1) |
| K28 | Durum Sorgula, EDM'deki belgeyi programda "gönderildi" yapar. | E-BELGE-EDM.md / FATURA-ISTEKLER (durum sorgulama) |
| K29 | Serideki son numaralı belgeden eski tarihli yeni e-Belge hiç gönderilemez (K6); kaydı reddedilebilir ya da kalıcı engelli olarak tutulabilir — ÇATAL. | K6'nın sonucu; davranış yazılı değil |
| K31 | Listeden Sil, belgeye Müşteri Fişi (FIS) serisinde numara verirken numara–tarih sırasını korur: belgenin tarihi o yılın FIS serisindeki son fişten eskiyse Listeden Sil REDDEDİLİR (409 chronology); belge Gönderilecekler'de kalır, numara verilmez. Aynı tarih reddedilmez. Tur sürerken silmede de geçerli. | Baş mimar kararı 18.10.2026 — programın kâğıt kayıt kuralıyla tutarlılık ("numara ve tarih sırası uyuşmalı") + VUK fatura/fiş seri-sıra-tarih düzeni |
| K30 | Carinin işareti (Mükellef Sorgula ya da gönderimdeki sorgu) belge türüyle çelişirse numarasız belgenin düzenlemesi reddedilir. | GİB (mükellefe e-Arşiv kesilmez); CLAUDE.md 2.4.3 karar (4) |

### /2 kuralları (22.10.2026, iş listesi 31a — kodu görmeyen kâhin; kural kaynağı ana oturumun KURALLAR-244.md A1–A6 + birincil kaynaklar)

Etiketler: [KULLANICI] = CLAUDE.md "Açık iş" kararı, [GİB] = mevzuat/kılavuz (programla fark = BULGU); [AJAN] = kodu yazan ajanın raporladığı
ayrıntı (birincil kaynakta yoksa fark = İNCELE). Belirsiz yerde ÇATAL; yalnız [AJAN] dayanaklı dünya `incele` işaretiyle seçilir ve rapora yazılır.

| No | Kural | Kaynak |
|----|-------|--------|
| K33 | Seçilenleri Gönder: aynı seri+yılda, seçilen NUMARASIZ bir bekleyenden ESKİ tarihli (aynı gün değil), seçilmemiş, numarasız, bekleyen ve kalıcı engelsiz belge varsa ilk istek gönderimden ÖNCE soru döner (yanıt 4xx; numara verilmez, EDM'ye gidilmez — I24); "onları da ekle" → seçilen ∪ eskiler K10 sırasıyla gönderilir; "vazgeç" → hiçbir şey değişmez. Aynı gün / başka seri / numaralı (belirsiz dahil) / kalıcı engelli eski sormaz; geçici engelli (PK'sız, K9) sorar. Alıcının gerçekte mükellef olduğu (K3) program ancak gönderimde öğrenir: henüz denenmemiş böyle belge sorulur, denenmiş (öğrenilmiş) sorulmaz. ÇATAL: seçilen NUMARALI bekleyen de soruyu açar mı (kaynak ayırmıyor). | [KULLANICI] CLAUDE.md "MÜŞTERİ İSTEKLERİ → 2.4.4 (1) Seçilenleri Gönder" (kronoloji, "gönderimden ÖNCE söyler", sessiz atlama/yarım tur yok); K6/K8/K9/K10; [AJAN] 17 (409, older ≤50, olderIds) |
| K34 | e-SMM makbuzu (ESMM profili): test serisi TES; TEA/TEF'ten bağımsız sayılır; seri+yıl içinde numara sırası = tarih sırası (K5/K6/K8 aynen); e-SMM servisinden gider (I20); alıcının e-Fatura mükellefiyeti ve posta kutusu e-SMM'yi engellemez; iptal K22. ÇATAL ([AJAN] 22 → İNCELE "K14-ESMM-BELIRSIZ-KALIR"): belirsiz makbuz EDM'de yoksa program 'bulunamadı'ya güvenmeyip yeniden göndermeyebilir. | [KULLANICI] CLAUDE.md e-SMM maddeleri (numarayı program verir, 2.4.4'te açılır, iptal 8 gün); [GİB] Kılavuz §3 (e-SMM de iletimden 8 gün); [AJAN] 22 |
| K35 | (/3: K41b ile e-Fatura'ya da genişledi; e-SMM "bulunamadı" çatalı kalktı) Sonucu belirsiz belgede Yalnız Programda İptal: son gönderim girişiminden 8 gün geçtiyse önce EDM'ye sorulur — EDM'de yok → iptal serbest (yalnız programda); EDM'de var → süre dolmuş, reddedilir ve sorgu belgeyi programda "gönderildi" yapar (K28); EDM'ye ulaşılamaz → 5xx ([AJAN]). 8 gün içinde: ~~2.4.3 çıkış yolu (yerel iptal) YA DA red — ÇATAL~~ → /3 K41: kabul. Olağan İptal Et belirsiz belgede: ~~red YA DA program sorup sonuca göre iptal — ÇATAL~~ → /3 K42: red. ÇATAL ([AJAN] → İNCELE "K35-ESMM-BULUNAMADI"): e-SMM'de EDM 'bulunamadı' derse program reddedebilir (kullanıcı kuralı "serbest" der — çelişki raporda). | [KULLANICI] CLAUDE.md "SORU (22.10.2026, madde 23 iptal süresi)" + KARAR "önerin uygun"; FATURA-ISTEKLER 109–110; [AJAN] 23 (502, e-SMM 409) |
| K36 | Alıcı zorunlu alanları: il her e-Belgede (e-SMM dahil); vergi dairesi e-Fatura VKN alıcısında; Nihai Tüketici (11111111111) alıcıya 30.000 TL üstü e-Arşiv kesilmez (gerçek TCKN + ad + adres). Eksik alıcılı belge EDM'ye gitmez (I21), numara harcanmaz; kayıt reddedilir YA DA kaydedilip kalıcı engelli kalır (bekletmez) — ÇATAL. Sınır (tam 30.000 TL, KDV dahil mi) DENENMEZ: senaryolar 600 / 48.000 TL. | [GİB] UBL-TR alıcı adresi/vergi dairesi; [AJAN] 11 (eşik ve nihai tüketici kuralı) |
| K37 | UX15 (fark.py `--ux15 acik`, varsayılan): R1 aynı seri+yılda son numaralının (iptal dahil) tarihi yeni tarihten büyükse kayıt reddedilir — Kes, Sonra Gönder de; aynı gün serbest (K29 çatalı daralır). R2 numaralı (gitmemiş) belgenin yeni tarihi seride önceki ile sonraki numaralının tarihleri arasında ve aynı yılda olmalı (K26 çatalı daralır; belirsiz ve kâğıt belgede red de olabilir — e-dönüşüm açıkken kâğıt belge "profile-not-allowed"); numarasız bekleyen serinin son numaralısından eski tarihe alınamaz. R5 = K8. Değişmez I23: ön hesap (calc) kronoloji/alıcı sorunu söylüyor ⇔ kayıt (chronology / einvoice-party) reddediyor, iletiler aynı. R3 (elle numara), R4 (kilit günü) senaryo dilinde YOK (DENENMEZ). | [AJAN] 12 UX15; [KULLANICI] 2.4.3 kararları (numaralı belgede tür değişmez), VUK sıra-tarih (K6) |

/2 senaryo dili (`/1` alanlarına ek; `/1` senaryoları değişmeden koşar): kaydet `"belge_turu": "esmm"` (K34) ve `"tutar": "olagan" | "buyuk"` (K36);
seçili Tümünü Gönder `"eski": "ekle" | "vazgec"` (K33; alan yoksa eski `{ ids }` yolu ve K8); iptal `"yerel": true` (Yalnız Programda İptal, K35);
cari türleri `ilsiz_kisi`, `vdsiz_mukellef`, `nihai` (K36). Gözlenen ek alanlar: `edm_iptal` (EDM'de iptal; K22/K35 yerel iptali ayırır), belirsizlik
(eStatus "none" + e-Belge numarası), iletim günü (ETTN'i EDM'nin ilk kabul ettiği adımın günü), son girişim günü (vekilin gördüğü son SendInvoice/SendSMM;
geçici hata = EDM'nin açık reddi sayılmaz), program engeli öğrendi mi (liste `eBlocked`).

#### /2 "Nasıl bozulur?" listesi → kapsayan senaryo
1. Seçim sırası / seçilmemiş eski belge (K33, K10) → hedefli-244-k33-secilen, hedefli-244-k33-esmm; üreteç seçili adım + "eski". 2. Süre sınırı (8./9. gün,
geriye tarihli kesim, e-SMM) → hedefli-244-k22-iletim-8-9, -k22-esmm; üreteç 7/8/9 gün ilerletme. 3. Yanıt kopması + sonraki girişim (iletim günü hangisi)
→ hedefli-244-k22-son-deneme(-esmm). 4. Belirsiz belgede iptal (EDM'de var/yok, ağ yok, e-SMM) → hedefli-244-k35-*. 5. Eksik alıcı (il, vergi dairesi,
nihai tüketici büyük tutar) → hedefli-244-k36-alici; I21. 6. Geriye tarih (kayıt/düzenle, kâğıt komşu) → hedefli-244-k37-ux15; I23. 7. İki oturum aynı
anda / tur sürerken sil → mevcut esz_tumunu_gonder, tur_sirasinda_sil (e-SMM de karışır). 8. Müşteri Fişi'ne bırakılan e-SMM'nin yeniden gönderimi → üreteç
listeden_sil + kart_gonder. DENENMEYEN: eski sürüm verisi (kayıt yoksa kesim günü), 002 şirketi, yetkisiz kullanıcı, R3 elle numara, R4 kilit günü,
K33 ön denetimden sonra kaydedilen eski belge (yarış), 30.000 TL sınırının kendisi.

#### /2 API yüzeyi — nereden öğrenildi (kod OKUNMADI)
- `send-pending { only: [...] }`, `{ only, check: true }`, `{ only, after }`: test/ebelge-244-secilenleri-gonder.test.mjs ÇAĞRI satırları (grep; assert
  satırları okunmadı). Yanıt (409 `einvoice-selection-older`, `count`, `older[]`, `olderIds`; `check` yanıtı `sendable/permanent/notPending`; boş seçim 400
  `einvoice-selection-empty`): kara kutu yoklaması (not defteri yokla1.mjs / yokla2.mjs). NOT: aynı uç adları E6 ajanının commit iletisinde (3a2f46a) ve
  koşucudaki "BAĞLANTI" bloğunda da geçiyordu; blok yoklamayla doğrulanıp bu elden yeniden yazıldı, kural/beklenen değer oradan alınmadı.
- `cancel { reason, localOnly: true, confirmLocal: true }`, `e-draft`, `eOptions.draftUpload`: test/ebelge-244-iptal-suresi.test.mjs ÇAĞRI satırları;
  yanıt `409 einvoice-cancel-late` (+ `start`, `lastDay`, `source: "iletim"`), belirsizde `409 einvoice-uncertain`: yoklama.
- e-SMM: `startTestServer({ esmmEnabled: true })`, ayar `esmm: true`, kayıt `scenario: "smm"` → profil ESMM, seri TES: test/esmm-gonderim-244.test.mjs ve
  ebelge-244-iptal-suresi.test.mjs ÇAĞRI satırları + yoklama. Sahte e-SMM servisi (`edm.state.smm`: sent/cancelled/calls/cutAfter; SMM'de ID/UUID çocuk
  öğe): test/esmm-mock.mjs ve einvoice-mock.mjs (test altyapısı).
- `POST invoices/calc` (ön hesap: `blockers`, `partyProblems`, `aliasBlock`, `nextNumber`): test/uiux-244-ux9.test.mjs ÇAĞRI satırı + yoklama. I23 "ön
  hesap = calc" VARSAYIMDIR: UX15 (aday 4) başka bir uç getirirse ana oturum koşmadan önce çağrı satırından bağlar.
- Alıcı alanı reddi `400 einvoice-party` (+ `problems[]`): yoklama. Belirsiz kartı: eStatus `none`, etiket "Sonucu Belirsiz", `eUnsent: true`: yoklama.

#### /2 düzeltilen kâhin hataları (ders 6: uyuşmazlık önce hata — her biri yeniden üretildi, kök neden yazıldı)
- 22.10 hedefli-244-k33-secilen adım 7: model soruya alıcısı gerçekte mükellef (K4) eski e-Arşivi KATMADI, program kattı. Kök neden kâhinde: model K3
  engelini gizli gerçekten (cari türü) okuyordu; program bunu ancak gönderimde (CheckUser) öğrenir, ön soru EDM'ye gitmez. Düzeltme: denenmemiş K3
  belgesi sorulur, denenmiş (liste `eBlocked` / model `engel_bilinen`) sorulmaz; birim testi `test_alici_mukellef_yalniz_ogrenilince_kalici_K33_K3`.
- 22.10 hedefli-244-k35-belirsiz-yerel adım 9: 8 gün sonra EDM'de olan belgenin Yalnız Programda İptali reddedildi (model de red bekliyordu) ama program
  belgeyi "gönderildi" yaptı. Kök neden kâhinde: K35'in zorunlu kıldığı EDM sorgusunun K28 sonucu (belge EDM'de → gönderildi) modelde yoktu. Düzeltme ve test
  `test_sorgu_edmde_bulursa_gonderildi_K35_K28`.
- 22.10 tohum 1–3 × 150 (UX15 açık) duzenle_tarih: e-dönüşüm kapalıyken kesilmiş kâğıt belgenin (koşucu kâğıdı ayarı kapatıp keser) tarih düzenlemesi
  `400 profile-not-allowed` ("e-Arşiv kullanıcısı … kâğıt değil e-Arşiv fatura keser") — R2 modeli kâğıt belgede yalnız kabul bekliyordu. Kâğıt belgede red
  de geçerli (çatal); kural gevşemedi (komşu dışı yine yalnız red).

#### A7 (iş listesi 31a): "tohum 2 × 150, adım 61 Listeden Sil farkı" — KÂHİN HATASI, düzeltildi (22.10.2026)
- Yeniden üretim: 2.4.3 üreteci/modeliyle tohum 2'nin 61. adımı `tur_sirasinda_sil B11` (B11 turun İLK belgesi → 409 einvoice-sending, fark yok; 12 koşu,
  yük altında da 0 fark). 2.4.4 modeliyle üretilen `--dil 1` dizisi 26. adımdan ayrışır ve 61. adım `tur_sirasinda_sil B10` olur: turun ilk belgesi B9
  (e-Arşiv) giderken B10 (e-Fatura) silinir → program silmeyi kabul eder (200, FIS2026000000003), aynı turdaki daha yeni e-Faturalar TEF…04–08 alır.
  Model silme dünyasında B13/B14/B19/B22'yi BEKLETİYORDU → 9 fark (numara, edm, gonderildi, yanıt).
- Kök neden MODELDE: silinen belge `silindi` işaretini tur BİTİNCE alıyordu; tur içinde numarasız bekleyen sayılıp K8 ile aynı serinin daha yeni
  belgelerini tutuyordu. Dayanak: K9 ("listeden silinmiş belge seriyi BEKLETMEZ") + K15 (silme turun ilk gönderimi sırasında işlenir) → silme anından
  sonra belge seriyi tutmaz. Program doğru. 2.4.3 kâhininde de vardı (bu yüzden "163dd5d'de de çıkıyor").
- Düzeltme: `tur_gonder` silme anında (ilk gönderim) hedefi `silindi` yapar. Birim testi `test_tur_sirasinda_silinen_seriyi_bekletmez_K15_K9_A7`,
  mutant M35, en kısa program senaryosu `senaryolar/kucuk-a7-tur-sirasinda-silinen-bekletmez.json` (eski kâhinle 4 fark "TUTMA-YOK", yeni kâhinle 0).

### /3 kuralları (23.10.2026, iş listesi 31a tur 2 — kodu görmeyen kâhin; kural kaynağı: ana oturumun verdiği kural metinleri E1/E4, E6, E7, MM4 alt kararı + CLAUDE.md Açık iş 22.10 gecesi kayıtları)

Etiketler /2 ile aynı. [KULLANICI] = CLAUDE.md "Açık iş" 22.10 gecesi SORU → "5 dk YETKİSİYLE UYGULANDI" kaydı (ürün sahibinin verdiği yetkiyle alınan karar) ya da
"2.4.4 kararları"; [AJAN] = kodu yazan ajanın kural metni (ana oturum kanıtla doğruladı); ayrıntısı birincil kaynakta yoksa fark = İNCELE.

| No | Kural | Kaynak |
|----|-------|--------|
| K38 | Verilmiş kâğıt/fiş/makbuz numarası (FIS, SMM, IAD) bir daha verilmez: sıradaki numara silinmişler ve emekliler dahil en büyük verilmiş numaradan sonra gelir; sıra-tarih tabanı (K6) silinen ve emekli numaralı belgenin tarihini de sayar ("yeni belge silinen son belgeden eski tarihli olamaz"). Emekli = belgeden düşen numara (Müşteri Fişi sonra e-Belge olarak gönderilince FIS numarası). Numarasız belgeyi silmek tabanı değiştirmez. e-Belge serisinin kuralı değişmedi (K5). | [KULLANICI] 2.4.4 kararları "verilmiş kâğıt/fiş numarası bir daha kullanılmaz (v32)" + MM4 alt kararı metni "verilmiş FIS numarası bir daha kullanılmaz"; [AJAN] E6 metni (silme); VUK sıra-tarih (K6) |
| K39 | Sil → Silinenler (`sil`) ve Silinenler'den Geri Yükle (`geri_yukle`): kâğıt, bırakılmış (FIS/SMM) ve numarasız bekleyen belge silinir; gönderilmiş / EDM'de olan belge silinmez; Silinenler'deki belge gönderilmez, işlem görmez, seriyi bekletmez (K8 dışı). Geri yüklenen belge KENDİ numarasıyla döner; numara başka canlı belgedeyse 409, belge Silinenler'de kalır. ÇATAL: iptal edilmiş ya da numaralı gitmemiş e-Belgenin silinmesi (kabul / red — "e-Belge serisinin eski kuralı aynı" kaynakta yazılı değil); geri yüklenen belgenin durumu (etkisiz "İptal Edildi" / önceki durumu). | [AJAN] E6 metni; [GİB] gönderilmiş belge değiştirilemez (K25) + FATURA-ISTEKLER 119 |
| K40 | Kâğıt Makbuz Olarak Bırak: bırakılan serbest meslek makbuzu SMM serisinden numara ALIR ve sonradan e-SMM olarak GÖNDERİLEMEZ (kart ve tur; kalıcı engel, belge değişmez). Müşteri Fişi Olarak Bırak (fatura): FIS numarası ALIR, sonradan e-Belge gönderilebilir (K18), FIS numarası emekli olur (K38). /2'deki "bırakılan belge numarasız kalabilir" çatalı kalktı. SMM serisinde de bırakma sıra-tarihi korur (K31'in SMM karşılığı — K6 "kâğıt seride de"). | [KULLANICI] 2.4.4 kararları "Bırakılan e-SMM 'Kâğıt Makbuz Olarak Bırak' (SMM serisi)" + MM4 alt kararı (22.10 21:34 UTC, 5 dk yetkisiyle) "bırakılan kâğıt makbuz e-SMM'e gönderilmez"; 2.4.3 "Listeden Sil → Müşteri Fişi Olarak Bırak"; SMM sıra-tarihi: K6 (çıkarım) |
| K41 | Yalnız Programda İptal yalnız sonucu belirsiz gönderimde (ya da portalda taslak belgede — senaryo dilinde YOK) yapılır. Öbür her durumda (EDM'de İşleniyor / Gönderildi / Kabul / Hata, e-Fatura, Müşteri Fişi, numarasız bekleyen, kâğıt) 409, belge değişmez, EDM'ye iptal gitmez. Belirsiz e-Arşiv / e-SMM: 8 gün içinde yalnız programda iptal (EDM'ye sorulmaz); 8 günü geçtiyse K35. **K35'in 8 gün içi çatalı (kabul / red) karara bağlandı: kabul.** Gönderilmiş belgede "süre içinde yerel iptal" çatalı kalktı: red. ~~ÇATAL (İNCELE `K41-EFATURA-BELIRSIZ-YEREL`): sonucu belirsiz e-Fatura~~ → K41b. | [KULLANICI] Açık iş 22.10 21:14 SORU E7 → 21:20 UTC "E7 sunucu K4'e göre" (5 dk yetkisiyle); [AJAN] E7 metni (durum listesi, Fatura Ayarları yetkisi, onay, süre iletisi önce) |
| K41b | **23.10.2026 01:26 UTC:** gönderim sonucu belirsiz belgede (EDM'ye ulaşıp ulaşmadığı bilinmiyor) Yalnız Programda İptal e-Arşiv, e-SMM ve **e-Fatura** için AYNI kuraldır: son gönderim girişiminden (girişim yoksa kesim gününden) 8 gün geçtiyse önce EDM'ye durum sorulur — EDM "bulunamadı" → yalnız programda iptal; EDM belgeyi bulursa durum belgeye yazılır (gönderildi) ve yerel iptal 409; EDM'ye ulaşılamazsa 502. 8 gün içinde yetkili kullanıcı onay kutusuyla yalnız programda iptal eder (K4 çıkış yolu; EDM'ye sorulmaz). e-Faturanın OLAĞAN iptali değişmez (K23). Tur 2'nin iki İNCELE çatalı (`K41-EFATURA-BELIRSIZ-YEREL`, `K35-ESMM-BULUNAMADI`) bu kuralla kalktı: programın farkı BULGU. Senaryo: hedefli-244-e7-yerel-iptal adım 31–42 (B11 EDM'de var → 409, B12 yok → iptal, B13 ağ yok → 5xx); birim test `test_efatura_belirsiz_ayni_kural_K41b`, `test_esmm_bulunamadi_yerel_iptal_K35_K41b`; mutantlar M45 (8 gün sonra sorgusuz kabul), M46 (belirsiz e-Fatura hep red), M25 (7 gün). Aday 8 kodunda (54bf0e6) kırmızı BEKLENİR (ürün düzeltmesi ayrı ajanda). | [KULLANICI] 5 dk yetkisiyle ana oturum kararı (23.10.2026 01:26 UTC; tur 2 raporunun İNCELE 1'i) |
| K42 | Sonucu Belirsiz belge (gönderim isteği EDM'ye gitti, yanıt gelmedi): Sil, Düzenle (tarih, tür), olağan İptal Et ve Listeden Sil 409, belge değişmez. Yeniden Gönder önce EDM'ye sorar: EDM'de varsa ikinci kez göndermez (aynı numarayla gönderildi — K11; değişmez I25 [AJAN]); EDM'de yoksa aynı numarayla yeniden gönderilir. İstek hiç gitmediyse (bağlantı kurulamadı) belge önceki durumuna döner (K12/K32 ile aynı). /2'deki "belirsizde olağan iptal: program sorup iptal eder" çatalı kalktı. | [KULLANICI] Açık iş 22.10 21:14 SORU E1 → 21:20 UTC "E1 (+E4) 2.4.4'te" (öneri: "kesintide Sonucu Belirsiz; Sil/Düzenle kapalı, Durum Sorgula önerilir"); [AJAN] E1/E4 metni ("Sil, Düzenle ve İptal Et 409; yeniden Gönder önce EDM'ye sorar, ikinci kez göndermez") |

/3 senaryo dili (`/2` alanlarına ek; `/1`, `/2` senaryoları değişmeden koşar): `{"islem": "sil", "belge"}` (Sil → Silinenler; programda `DELETE invoices/:id?reason=`),
`{"islem": "geri_yukle", "belge"}` (Silinenler'den Geri Yükle; `GET /api/admin/trash` → `kind: "invoice"`, `ref` = belge kimliği; `POST /api/admin/trash/restore { id }`).
Gözlenen ek alan: `cop` (belge Silinenler'de; koşucu son canlı gözlemini taşır — numarası kullanılmış sayılır). Uç adları test/numara-silinen-244.test.mjs ÇAĞRI
satırlarından, yanıt biçimi kara kutu yoklamasından (not defteri yokla1.mjs / yokla2.mjs: silinen belge hiçbir liste sekmesinde görünmez; geri yüklenen kâğıt belge
"İptal Edildi" olarak, kendi numarasıyla döner). Üreteç /3 (varsayılan): adımların ~%7'si Sil / Geri Yükle, ~%10 daha çok kâğıt belge (ayrı akış r3); Seçilenleri Gönder
Silinenler'deki belgeyi seçmez (arayüzde görünmez).

/3 değişmezleri: I1/I2 seri GEÇMİŞİ üzerinden (bir kez görülmüş her numara; Silinenler'deki ve emekli dahil — K38: boşluk sayılmaz) · I26 bir numara bir kez ve tek
belgeye verilir (başka belgede bir daha görünmez; K38) · I25 Sonucu Belirsiz ve EDM'nin önceden kabul ettiği belge için yeni EDM gönderim denemesi yok (K42, [AJAN]
→ ihlal İNCELE) · I8 ek: Silinenler'deki belge EDM'ye gitmez (K39).

#### /3 "Nasıl bozulur?" listesi → kapsayan senaryo
1. Silinen kâğıt belgenin numarası yeniden verilir / tarihi taban sayılmaz → hedefli-244-e6-silinen-numara (adım 3–5), üreteç `sil`. 2. Müşteri Fişi e-Belge olarak gidince
FIS numarası yeniden verilir / tarihi unutulur (tohum 2 × 120) → hedefli-244-mm4-kagit-makbuz (adım 9–12), birim test `test_gonderilen_musteri_fisinin_numarasi_emekli_K38`.
3. Geri yükleme numara değiştirir ya da iki belge aynı numarayı taşır → hedefli-244-e6 (adım 6, 24, 25), I26/I13. 4. Silinen numarasız belge seriyi bekletmeye devam eder →
hedefli-244-e6 (adım 7–10). 5. Bırakılan makbuz e-SMM olarak gider (kart ya da tur) → hedefli-244-mm4 (adım 3, 4, 17, 18). 6. Gönderilmiş / bekleyen / bırakılmış /
kâğıt belgede Yalnız Programda İptal geçer → hedefli-244-e7 (adım 9–14, 30); belirsiz e-Fatura'da 8 gün sonra EDM'ye sormadan geçer (K41b) → hedefli-244-e7 (adım 31–42). 7. Belirsiz belgede Sil / Düzenle / İptal Et / Listeden Sil geçer ya da yeniden gönderim EDM'de
ikinci kez kabul ettirir → hedefli-244-e1-belirsiz, I3, I25. 8. Rastgele sıra (ders 17) → üreteç /3 tohum 1–20 × 300. DENENMEYEN: geri yüklemede numara çakışması 409
(çakışma ancak eski sürüm verisiyle ya da programın K38 ihlaliyle oluşur — eski sürüm verisi bu kâhinde yok), portal taslağında yerel iptal, iptal yanıtının kopması
(E4: vekil yalnız gönderimi bozar), yetkisiz kullanıcının yerel iptali (Fatura Ayarları yetkisi), 002 şirketi, iade serisi (IAD).

#### /3 düzeltilen kâhin hataları (ders 6: uyuşmazlık önce hata — her biri yeniden üretildi, kök neden yazıldı)
- 23.10 tohum 2 × 120 (taban ad865f0'da da): 4 fark / 2 ihlal — adım 10 "Kâğıt kaydet sırasında chronology", adım 45 "Müşteri Fişi'ne bırakılan belgeye FIS numarası",
  adım 60 FIS…3 ve I1 "FIS2026 boşluklu". Yeniden üretim: adım 3'te B2 bırakıldı (FIS…1, 16.06), adım 5'te e-Arşiv olarak gönderildi; program FIS…1'i "belge sonra
  e-Belge olarak gönderildi; numara kullanılmış sayılır" diye taban saydı. Kök neden MODELDE: (a) model bırakılan belgenin FIS numarasını gönderimde sildi, emekli
  saymadı (22.10 kararı "verilmiş fiş numarası bir daha kullanılmaz" modele girmemişti); (b) bırakmada numara çatallıydı (numarasız dünya önce seçiliyordu); (c) I1
  yalnız o anki belgelere bakıyordu. Program kurala uygun. Düzeltme K38/K40, I1/I2 geçmişten, I26; birim testleri `test_gonderilen_musteri_fisinin_numarasi_emekli_K38`,
  `test_birakilan_fatura_fis_alir_tek_dunya_K40`, `test_emekli_numara_bosluk_degil_yeniden_verilirse_I26_I1`; mutantlar M36–M39. Aynı dizi (`--dil 2`) yeni kâhinle 0 fark / 0 ihlal.
- 23.10 I25 ilk yazımında EDM'nin AYNI adımda kabul ettiği belge de "önceden EDM'de" sayılıyordu (kopma_once sonrası doğru yeniden gönderim ihlal göründü; tohum 1/3 × 120,
  hedefli-244-e1 adım 17): önceki kabul kümesi adım başında alınır.
- 23.10 tohum 3 × 150 adım 150 I18: bekleyen tek atımlık arıza son Tümünü Gönder'e düştü (belge sonda haklı olarak belirsiz). Üreteç: arıza bekliyorsa son turdan önce ayrı bir
  tur arızayı tüketir.
- 23.10 tohum 2 × 120 (/3) adım 81 I19: koşucu Seçilenleri Gönder'e Silinenler'deki belgeyi seçti (arayüzde seçilemez); programın sonucu `ok:false`, kod boş, ileti "Fatura
  bulunamadı; silinmiş olabilir" — yalnız API yolu; üreteç artık seçmez, bulgu İNCELE (düşük) olarak raporda.

## Değişmezler (fark.py; YALNIZ programın gözlenen durumu + sahte EDM kaydı üzerinde, modelden bağımsız)
I1 seri+yıl boşluksuz (FIS dahil) · I2 sıra-tarih monoton (FIS dahil) · I3 her ETTN EDM'de en çok bir kez kabul · I4 EDM'nin kabul ettiği kimlik =
programdaki numara · I5 e-Belge numarası değişmez · I6 EDM'ye giden her kimlik geçerli biçim, profil serisi, belge yılı · I7 mükellef alıcıya e-Arşiv
gitmez · I8 iptal belge hiç, listeden silinmiş belge turda gönderilmez; tur sürerken kabul edilen silme → belge gitmez · I9 gönderilmiş belgenin tarih/
tür/cari alanı değişmez · I10 program "gönderildi" ⇒ EDM kabul etmiş · I11 e-Fatura posta kutusuyla gider · I12 numara yılı = belge yılı · I13 numara
benzersiz · I14 kişi (TCKN) carisi mükellef işaretlenmez · I15 eşzamanlı turda gönderilen belge için hata yanıtı yok · I16 tur yanıtındaki "gönderildi"
iddiası EDM'de var · I19 tur sonucunda gönderilmeyen belgenin kodu ve iletisi dolu (baş mimar kararı 18.10.2026) · I18 sonda (ağ var + Tümünü Gönder) program ↔ EDM tutarlı · I0 sahte EDM'nin kendi sözleşme ihlalleri.
/2: I20 belge kendi servisinden gider (ESMM → e-SMM, diğerleri → e-Fatura servisi; K34) · I21 EDM'ye giden UBL'de alıcı ili dolu, e-Fatura VKN alıcısında
vergi dairesi dolu, 30.000 TL üstü e-Arşivde 11111111111 yok (K36; UBL okunamazsa "okunamayan UBL" sayılır, ders 4) · I22 EDM'de iptal yalnız iletimden 8 gün
içinde; e-Fatura EDM'de iptal edilmez (K22, K23) · I23 ön hesap ⇔ kayıt (K36 alıcı her zaman; K37 kronoloji `--ux15 acik`) · I24 K33 sorusu gönderimden önce
(o istekte EDM denemesi ve numara değişimi yok).

## Kara kutu yoklamasından alınan ORTAM bilgisi (kural değil)
- Program gönderimde alıcıyı EDM'de sorgular (CheckUser) ve gerçekte mükellef çıkan işaretsiz cariyi kendisi işaretler (PK'sıyla). Model bunu
  ortam olarak alır: her adımdan sonra carilerin işaret/PK durumu programdan okunur (K1 sonraki belgelere uygulanır). I14 bu işaretlemenin
  kişi carisine yapılmadığını denetler.
- Listeden Sil belgeye FIS (Müşteri Fişi) numarası verebilir (FATURA-ISTEKLER satır 122–123 "belge Müşteri Fişi numarasıyla kalır") — modelde çatal;
  FIS serisi I1/I2 değişmezlerine tabidir (program kâğıt kaydında FIS'te sıra-tarihi kendisi uyguluyor: "numara ve tarih sırası uyuşmalı").
- `eStatus` değerleri: waiting, error, withdrawn, none (gitmemiş / bilinmiyor); sent, processing, cancelled (gitmiş). Tanınmayan değer
  "bilinmiyor" sayılır ve karşılaştırılmaz (ders 4).

## Düzeltilen kâhin hataları (ders 6: uyuşmazlık önce hata — her biri yeniden üretildi)
- 18.10: tohum 1 adım 62'de bir farkı "program kopmada numarayı bırakıyor" diye okuyup K14'e "numara bırakılabilir" çatalı eklendi; EDM çağrı
  kaydıyla yeniden koşulunca programın numarayı KORUDUĞU görüldü (fark aynı turdaki O1 bekletmesinin ardılıydı). Çatal geri alındı, K14 katı.
- 18.10: "tur sürerken sil" silme-kabul dünyası yalnız belge turun ilk sırasında değilse üretiliyordu; turda hiç gönderim olmayınca (belge engelli)
  silme turdan sonra işlenir — dünya her durumda üretilir, belge gittiyse elenir.
- 18.10 (4986b6f): tohum 4/5 × 300'deki sınıfsız farkların kökü kâhindeydi: (a) silinecek belge programda hiç oluşmamışken koşucu
  "tur sürerken sil" adımını tümüyle atlıyordu (model turu koşuyordu) → koşucu artık turu yine koşar; (b) eşzamanlı turda tek atımlık
  arıza iki oturumdan hangisinin önce gönderdiğine göre herhangi bir belgeye düşebilir → K19'a çatal (arıza k. gönderime); (c) O1
  bekletmesi arızayı modelde ve programda farklı belgelere düşürüyordu → "O1-ARDIL"/"ARDIL-ARIZA-KAYDI" sınıfı; (d) FIS sıra-tarih bozulduktan
  sonraki kâğıt kaydı farkı "FIS-SIRA-ARDIL". Hiçbiri kuralı gevşetmedi; değişmezler aynen.

## Sınıflar (fark.py; farkın görünen biçiminden ve modelin adım öncesi durumundan, beklenen değer üretmeden)
/2 sınıfları: UX15-YOK / UX15-YOK-I23 (farkı yalnız K37 üretir: UX15'siz model aynı adımda gözlemi tam açıklıyor — tabanda UX15 yokken beklenir, SON ADAYDA
BULGU) · BULGU-K22-KESIMDEN (program süreyi kesimden sayıyor — 2.4.3) · BULGU-K22-SURE-ASIMI (iletimden 8 gün sonra iptal kabul) · BULGU-K41b-SORGUSUZ (/3: belirsiz belgede 8 gün sonra EDM'ye sormadan yerel iptal) · BULGU-K22-SON-DENEME
(program iletim yerine sonraki girişimi saydı) · BULGU-K22-8-GUN (8. gün dahil sayılmıyor). İNCELE işaretleri ayrı listede (fark sayılmaz): K35-ESMM-BULUNAMADI,
K14-ESMM-BELIRSIZ-KALIR.
BEKLENEN-O1 (eski KALICI engelli bekleyen — K3/K6 — seriyi bekletiyor; 18.10 kararından sonra PK'sız eski belgenin bekletmesi doğru) · BEKLENEN-I19 (bekletilen belgenin tur sonucu kodsuz/iletisiz) · BEKLENEN-O1-ZINCIR / TUTMA-YOK (eski gönderilebilir bekleyen varken yeni
belge numaralandı; eski belge kalıcı tarih engeline düşer) · BEKLENEN-O2 (tur sürerken Listeden Sil kabul edildi, belge yine gitti) ·
BEKLENEN-O3 (alıcısı mükellef çıkan bekleyen e-Arşiv seriyi bekletiyor) · BEKLENEN-AG (ağ yokken numara) · BASKA-ESZ (eşzamanlı turda
"gönderiliyor" hata olarak döndü) · BASKA-FIS-SIRA (Listeden Sil eski tarihli belgeye FIS numarası verdi; 18.10'dan sonra K31 ile model de reddi bekler) · BASKA-DUZENLE-SIRA (numarasız
bekleyenin tarihi sıra-tarihi bozmadan değiştirilemiyor) · *-ARDIL (aynı adımdaki asıl farkın sonucu) · BASKA (sınıfsız: önce incelenir).

## 18.10.2026 ek kararlar (baş mimar)
- K32 — bağlantı HİÇ kurulamadıysa ve numara o istekte verilmiş ve serinin son numarasıysa program numarayı geri bırakır (belge numarasız
  Gönderilecekler'e döner); araya başka numara girdiyse belge numaralı "belirsiz" kalır. Tek oturumda K12 ile aynı sonuç (numarasız); iki oturumlu
  turda (ağ yok) her serinin en eski gönderilebilir belgesinin numaralı belirsiz kalması çatal. Kaynak: baş mimar kararı 18.10.2026.
- I15 istisnası — istek EDM'ye gönderildikten sonra kopan / zaman aşımına uğrayan belge "belirsiz" (integrator-uncertain) döner; eşzamanlı turda
  hata sayılmaz (sonunda gönderilmiş ya da belirsiz kalması ikisi de geçerli; numara/EDM tekliği değişmezleri aynen). Kaynak: baş mimar kararı
  18.10.2026, K14 ile tutarlılık.
- Koşucu: Tümünü Gönder parça parça (istek başına ≤20 belge / ~10 sn; yanıt `remaining`, `attempted`, `cursor`); istemci gibi `after: cursor` ile
  kalan bitene ya da ilerleme durana kadar döngü (kara kutu yoklamasıyla öğrenildi; uygulama kodu okunmadı).
- 18.10 kâhin düzeltmesi (ders 6): eşzamanlı turda kâhinin enjekte ettiği tek atımlık EDM hatası bir oturumun isteğine düşerse o oturumun
  "integrator-rejected" sonucu gerçek EDM yanıtıdır; belgeyi öbür oturum gönderebilir. I15 o adımda arızanın düştüğü belgeyi istisna tutar
  (duzeltme3 940516a tohum 4 adım 167'de görüldü; yeniden koşuda 0 ihlal).
