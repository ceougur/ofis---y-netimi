# Yıl Sonu Devri — Uygulama Planı

Durum: **2.5.0'DA UYGULANIYOR** — 05.11.2026 D0 güncellemesi aşağıdaki "G" bölümünde ve ÇELİŞKİDE GEÇERLİDİR (mali müşavir P incelemesinden geçer). Eski durum: **PLAN — 2.4.4'ten SONRA uygulanacak** (kullanıcı, 20.10.2026: "2.4.4'ten sonrası için planlayalım, devir dosyası olarak tüm
detayları ile yazalım; yeni bir sohbet penceresinden de yazsam oradan bulup yapabil"). Kod henüz değişmedi.

Bu dosya tek başına yeterli olacak biçimde yazıldı: yeni bir oturum bunu okuyup işe başlayabilir. Arka plan ve kararların kaynağı
`docs/devir/DEVIR-MODULU.md` (§1–§10). Kod olguları 20.10.2026'da koddan çıkarıldı (dosya:satır); uygulamaya başlamadan önce **yeniden
doğrulanır** (2.4.4 kodu değiştirmiş olabilir).

---

## G. 2.5.0 D0 GÜNCELLEMESİ (05.11.2026) — aşağıdaki bölümlerle ÇELİŞİRSE GEÇERLİ OLAN BUDUR

Kaynak: D0 doğrulaması (P1 ajanı, xhigh, salt okuma; ana oturum yedi kritik iddiayı koddan yeniden doğruladı), kullanıcı kararları 05.11 (kapsam A, S2–S4),
`docs/erp/MUHASEBE-CEKIRDEGI-PLANI.md` (çekirdek: fiş defteri Ç2, dondurma Ç3, açılış düzeni Ç5 — devir bunlara dayanır). Mali müşavir P incelemesinden geçer.
Aşağıdaki maddeler BAŞ MİMAR KARARI'dır (ders 40); para / kapama kuralına dokunan açık sorular G13'te (ders 43).

### G0. Değişen kararlar
- "Devri Güncelle YOK" ve "eski yıla yazma YOK" → **Devri Yenile VAR** (kullanıcı 05.11 "en güncel mevzuat + en yaygın uygulama"; gerekçe: yıl sonu düzeltmeleri beyanname
  dönemine (Mart / Nisan) kadar sürer, geç gelen Aralık faturası olağan). Eski yıla yazım yalnız Devri Yenile içinden, yetkili + gerekçeli (G7).
- Açılışların karşı hesabı 500 değil geçici "Eşleştirilecek Açılış Bakiyeleri"; devir açılış fişi onu arşivin kapanış bilançosuyla kendiliğinden eşleştirir (S4; çekirdek Ç5).
- Kapanış fişi yalnız 6xx'i değil 7/A giderlerini de (760 / 770 / 780) kapatır; 7/A ↔ 7/B ve yansıtma mali müşavir P'de (çekirdek §12).
- §4.1 / §7.1'deki "account_entries.is_opening eklenir" YANLIŞ: sütun 2.4.6'da var (göç 35); eksik olan defterin onu okuması (çekirdek Ç5).
- §4.2'deki "devir faturası" (fatura yeni yılda işaretle kalır) yöntemi BIRAKILDI → AYRI AÇIK KALEM (G2). §7.1'deki invoices.devir_year / devir_remaining sütunları YOK.
- Kapanış / açılış fişleri çekirdeğin saklanan fiş defterine (ledger_vouchers, Ç2) yazılır; arşivin ≤K dönemi kilitlenir ve DONAR (Ç3) → beyan edilmiş yıl sonraki sürümlerde değişmez.

### G1. Mekanizma: KOPYADA ÜRET, DOĞRULA, TAKAS ET
P1 olguları: 001'de appFor meşgul denetiminden önce döner (app.mjs:629 → 001'e 503 yok), closeCompany 001'i kapatmaz (app.mjs:781-789); yedek / geri yükleme / ayırma / göç ana
iş parçacığında; veri tabanına yazan worker deseni yok; güncelleme sessiz saatte uygulamadaki işi bilmeden kurulur (update-orchestrator.mjs:159).
1. BAKIM KİPİ: şirket "Devir yapılıyor" kipine alınır — bütün yazma istekleri 503 (001 dahil: appFor'un 001 yolu da bakım bayrağını okur); arka plan yazıcıları durur (yedek
   zamanlayıcı, e-Belge turları, WhatsApp kuyruğu, tekrarlayan fatura, belge temizliği, mobil yükleme); güncelleme kurulumu bakım bayrağı varken başlamaz.
2. KALICI DEVİR YEDEĞİ (G5) alınır.
3. Worker'da, `VACUUM INTO` ile alınmış tutarlı kopyadan İKİ dosya üretilir: arşiv (≤K, kapanış fişi, kilit + donma) ve yeni yıl (>K + açılışlar + açık kalemler + kilit = K).
   Canlı dosya takasa kadar DEĞİŞMEZ.
4. Değişmezler KOPYALARDA koşulur: her bilanço hesabı arşiv K kapanışı = yeni yıl K+1 açılışı (kuruşu kuruşuna); modül bakiyeleri (cari, kasa, banka, stok, çek, taksit) K'de
   eşit; hareket sayıları (arşiv ≤K + yeni yıl >K = devir öncesi); iki dosyada tam Mutabakat yeşil. Biri tutmazsa kopyalar atılır, canlı dosya aynen kalır, rapor nedeni gösterir.
5. TAKAS: 002 ve sonrası `swapInRestoredFile` deseniyle; 001 yeniden başlatmada uygulanan hazırlıkla (`stageRootRestore` deseni; kullanıcıya "program yeniden başlatılacak").
6. Arşiv kaydı (`sirketler.json` archives[] + sha256); arşiv klasörü diskten yeniden kurmada tanınır (bugün yalnız `sirketler/<klasör>` ilk düzeyi taranıyor, companies.mjs:157-186).
Kazanç: yarıda kesilme / disk dolu / kilitli dosya → canlı veri devir öncesiyle aynı (ROLLBACK = kopyayı at); olay döngüsü kilitlenmez (ders 47); dosya takası yazıldığı gün
Windows CI'de denenir (ders 48).

### G2. Açık faturalar: AYRI AÇIK KALEM (§4.2'nin YERİNE)
- Gerekçe (P1 §3): invoices 19 dosyada 144 yerde okunuyor. İşaret yönteminde en az 12 zorunlu dışlama + 5 kapama çekirdeği + ~12 rapor yeri; unutulan tek yer KDV / gelir / stokta
  SESSİZ çift sayar ve Mutabakat yakalamaz (yevmiye ile beklenen tutar aynı faturayı birlikte sayar). Ayrı kalemde ~6–8 değişiklik; varsayılan davranış "görmemek" → hata
  gürültülü (Mutabakat kırmızı). Ek kazanç: eski sürüm (2.4.9) devredilmiş dosyayı açsa bile açık kalemler sıradan cari satırı olduğu için çift sayım olmaz (G6).
- Biçim: yeni yıl dosyasında açık fatura başına `account_entries` satırı — source = 'devir', source_id = fatura kimliği, due_date = faturanın vadesi, tutar = K'deki kalan (yön
  işaretli), açıklama "Devir: <belge no> (<belge tarihi>)", devir çalışma kimliği (G7). Fatura ve satırları yeni yılda YOK; resmî görüntü, PDF ve XML "Arşivde Aç" ile.
  Kalan, 2.4.5'ten beri tarihli elle borç satırlarının kapandığı tek yükümlülük kuyruğunda kapanır (invoice-settle.mjs:166-180).
- Cari açılışı = cari K bakiyesi − Σ (o carinin açık kalemleri) (yön işaretli) → yeni yılda cari bakiye = K bakiyesi. "Borç ve Alacakları Aktar": iki açılış satırı (borç toplamı,
  alacak toplamı) + açık kalemler; "Sadece Bakiyeyi Aktar": tek net satır + açık kalemler. 2.4.6 "cari başına tek açılış" kuralı (accounts.mjs:577) devir satırlarını kapsamaz.
- K SONRASI BAĞLAR açık kaleme yönlenir: Kapatılacak Fatura (account_entries.invoice_id), mahsup (invoice_offsets), çek (cheque_events / cheques.invoice_id), fin_events.invoice_id,
  plans.invoice_id (taksit kartına bağlı faturada kalan taksitte izlenir; çift sayım yok — kâhinle).
- KAPANMIŞ ≤K FATURA, K sonrası bir satırdan bağlıysa: bağ arşiv başvurusuna (yıl + belge no) çevrilir. Aktif tekrarlayan faturanın ≤K şablonu yeni yıla TASLAK kopya olarak
  taşınır, tekrar ona bağlanır (taslak defter / KDV / stoka girmez). Ayrıca bugünkü hata düzeltilir: şablonu bulunamayan tekrar sessizce atlanıyor (invoices.mjs:2751) →
  pasife alınır + uyarı.

### G3. Tablo sınıflaması (§3'ün TAMAMI bununla; §8.16 testi bu listeye karşı — yeni tablo eklenince kırılır)
Şemada 75 canlı tablo (göç 1–45) + geri yüklemede gelen 2 koşullu (backup_meta, edoc_usage_defter) + makine düzeyinde 17 (e-Belge kullanım `usage`, WhatsApp defteri 16 tablo).
- DOKUNULMAZ (yeni yılda aynen; arşivde kopya): users, roles (ortak katman), settings (yıla bağlı anahtarlar aşağıda), records, overrides, deleted_records, case_notes,
  source_snapshots, notes, phones, liens, tasks, messages, chat_*, free_*, dataset_rows, dataset_imports, case_documents (+ `belgeler/`), plan_groups, accounts (silinmişler dahil),
  stock_items (unit_price son alışla eziliyor → ağırlıklı ortalama stock_moves'tan), invoice_repeats (şablon kuralı G2), **edoc_usage + edoc_usage_meta (SİLİNEMEZ: UPDATE / DELETE
  tetikleyicisi, budama DELETE gönderirse bütün işlem düşer)**, **einvoice_inbox** (çekme son 30 günü uuid ile eliyor; silinirse Aralık belgeleri "yeni" döner), **audit_events**
  (e-Belge iletim / iptal izi, numara tutucu, banka işlem geçmişi okuyor), **integrity_log**, wa_batches, wa_jobs, wa_job_pdfs, message_sends, maliyet_*, staff_members,
  pos_terminals, pos_rates, fx_rates, bank_holidays, bank_accounts (opening_date K+1'e — kural D2'de), bank_statements / bank_statement_lines / bank_matches (yazan kod yok),
  request_keys (30 günde kendiliğinden), backup_meta, edoc_usage_defter; makine: usage, WhatsApp defteri (şirket ve cari kimlikleri değişmediği için eleme sürer), sirketler.json.
  Arşivde boşaltılır: sessions, mobile_access / codes / devices / sessions.
- ≤K SİLİNİR, yeni yılda AÇILIŞ: payments (Kasa açılışı kapsar), cash_entries (açılış K+1), account_entries (cari açılışı + açık kalemler; K sonrası satırlar kalır), stock_moves
  (açılış K+1, miktar K'deki, değer ağırlıklı ortalama), plan_entries (açık kart: tek açılış, taksit dağılımı korunur), fin_events / bank_lines (hesap açılışı K+1; K sonrası ters
  kayıtların reversal_of bağı çözülür), vat_offsets (≤K; Aralık mahsubu ay sonu tarihli → G4), invoice_offsets (≤K), pos_sales (BEKLEYEN KALEMİ OLAN satış KALIR — valör işi
  pos_items ↔ pos_sales INNER JOIN, pos.mjs:890), bank_plans (tamamlanmış ve tekrarsız ≤K), bank_jobs (biten ≤K; bekleyen G4'te durdurur), trash (YALNIZ yük tarihi ≤K para
  kalemleri), plan_imports (≤K içe aktarmanın Geri Al'ı kapatılır).
- AÇIK OLAN KALIR: invoices / invoice_lines (açık → G2 açık kalem; kapanmış ≤K silinir, bağ kuralı G2), cheques (açık kalır, kapanmış ≤K silinir), cheque_events (≤K olaylar tek
  "devir" olayına; kind CHECK kısıtı (migrations.mjs:729-732) nedeniyle TABLOYU YENİDEN KURAN göç), cheque_collections (bekleyen kalır), doubtful_receivables / provisions
  (açık kalır; ≤K olay bağı çözülür), plans / plan_items (kart kalır), pos_items (valörü K'den sonraya kalan bekleyen kalem açık kalem).
- settings'te yıla bağlı: meta.bank.seq.<yıl> (dokunulmaz), invoice.numberFloor{seri+yıl} → YENİ: yeni yıl dosyasına her (seri, K) için MAX(seq) TABANI yazılır (budama K yılının
  MAX'ını düşürür; ≤K bekleyen belge gönderilirse çift e-Belge numarası riski), invoice.settings.start{…}, plans.receiptSeq (yıla bağlı değil, sürer), ledger.lockedUntil = K,
  bank.pos.draftMonth, invoice.restoreNotice. Sıfırlama listesindeki `ledger_snapshots` (app.mjs:962) bugün ölü ad; çekirdek Ç3 bu adı kullanacaksa uyumlu.

### G4. Ön denetim ekleri (§5'e)
- DURDURUR: ≤K tarihli "waiting" ve "withdrawn" (Listeden Sil) e-Belge; ayrıca gönderim yoluna (sendBlockOf, invoices.mjs:3708 — bugün kilit denetimi yok) yeni yılda ≤K / arşiv
  belgesi denetimi; bekleyen bank_jobs; yarım POS gün sonu.
- UYARIR: Aralık KDV mahsubu yapılmamış (ay sonu tarihli; devirden sonra yalnız Devri Yenile ile); ≤K içe aktarmaların Geri Al'ı kapanacak; aktif tekrarın ≤K şablonu taşınacak;
  001'de devir program yeniden başlatması ister.

### G5. Yedek ve geri yükleme
- KALICI DEVİR YEDEĞİ sınıfı: budanmaz (bugün "devir-oncesi" etiketi SAFETY_LABEL'de yok → rutin sayılır, ~7,5 iş gününde silinir; etiket eklemek de yetmez, güvenlik yedekleri
  30'luk kuyruğu paylaşır). Devri Yenile ve Geri Al öncesi de aynı sınıf. Yedekler ekranında ayrı "Devir Yedekleri".
- Devir yedeği arşiv klasörünü + `belgeler/` + `secret.key` + `mesaj-arsivi/` içerir (bugün hiçbiri yedekte değil).
- "Yedekten Geri Yükle" arşiv kaydını bilir: devir öncesi tarihli yedek seçilirse Devri Geri Al akışına yönlendirilir ya da engellenir (K yılı iki dosyada birden olmasın).
- Geri Al / geri yüklemede WhatsApp "kime kaç kez" (ilke 5): makine defteri dokunulmaz; dosyadaki wa_jobs ile defter birleşir (iş listesi D6).

### G6. Şema sürüm kapısı (iş listesi BS-7)
- user_version > LATEST_VERSION ise şirket / arşiv YAZILABİLİR açılmaz: salt okunur + "Bu veri programın daha yeni bir sürümüyle açılmış" uyarısı. Bootstrap'ın eski sürüme dönüşü
  (bootstrap.mjs:79-97) ve başarısız güncellemenin geri alması (yalnız 001'i geri yüklüyor) 002 ve arşivleri de kapsar. BİLİNEN SINIR: kapı 2.5.0 ile gelir, 2.4.9 bilmez — G2'nin
  açık kalem yöntemi bu yüzden seçildi (eski kod da doğru bakiye görür).

### G7. Devri Yenile ve Devri Geri Al
- Devrin ürettiği her satıra DEVİR ÇALIŞMA KİMLİĞİ (açılışlar, açık kalemler, çek "devir" olayı, ledger_vouchers); kullanıcının kendi açılışları bundan ayrılır (ör. devirden sonra
  açılan banka hesabının açılışı yenilemede silinmez). Deterministik kimlik `devir-<yıl>-<varlık>` + yerinde güncelleme; düzeltmeyle kapanan bir kalemin K sonrası bağı varsa
  ÇAKIŞMA LİSTESİ gösterilir, işlem durur.
- Devir satırları normal ekranlardan düzenlenemez / silinemez (K+1 tarihli oldukları için kilit dışında kalırlar); yalnız Devri Yenile / Geri Al değiştirir.
- Devri Yenile akışı: yetki system.manage + gerekçe (denetim izi) → arşiv BAKIM KİPİNDE yazılabilir tam şirket örneği (arka plan yazıcıları ve GET'te yazan yollar kapalı:
  runRepeats, ensureTestStart) → düzeltme (geç gelen Aralık faturası, Aralık KDV mahsubu) → arşiv yeniden kilitlenir ve donar → yeni yılın devir satırları G1 mekanizmasıyla
  yeniden üretilir → değişmezler → Devir Raporu (önceki ↔ yeni farkı). K sonrası girilmiş kayıtlar korunur; kapama okumada yeniden hesaplanır; Kasa / banka eksiye düşerse
  uyarı raporu. Yalnız EN SON arşiv yenilenir; sonraki yılın devri varsa durur (zincirleme yenileme BİLİNEN SINIR).
- Devri Geri Al: §6 + kalıcı yedek (G5) + WhatsApp ilke 5.

### G8. Arşiv örneği
- GET'te yazan yollar ve arka plan işleri arşivde kapalı; `belgeler/`, `secret.key`, `mesaj-arsivi/` şirket klasörüne çözülür (arşiv kendi klasöründen açılırsa belgeler ve şifreli
  ayarlar okunamaz); belge temizliği arşivin başvurularını görür (documents.mjs:89-108 — yoksa yeni yılda silinen belge 30 gün sonra diskten gider, arşivin gösterdiği dosya da);
  arşivde meta.instanceId yenilenir (ayırma deseni); sessions ve mobile_* boşaltılır; users ortak katmandan okunur (DOĞRULANACAK).

### G9. Hacim bütçesi (ders 47)
- Ön izleme (saf hesap) 100.000 satırda ≤ 10 sn worker'da; 1.000.000'da ölçülür. Devir (kopyada üretim + değişmezler) 1.000.000 satırda ≤ 5 dk; olay döngüsü en çok ≤ 50 ms
  (bakım kipinde istekler 503 alır). Ölçüm D3'te programın kendi ürettiği büyük veride, önce / sonra aynı kopyayla (ders 15).

### G10. Nasıl bozulur? ekleri (§8'in devamı)
17. 001'de devir (yeniden başlatma) ve 002'de devir; devir sırasında güncelleme denemesi; mobil özetin 503 davranışı.
18. Devir öncesi yedeğin "Yedekten Geri Yükle" ile dönmesi.
19. ≤K "Listeden Sil"inmiş e-Belge'nin yeni yılda gönderilmesi — çift numara olmamalı.
20. Aralık KDV mahsubu devirden sonra (Devri Yenile ile); 190 devri açılış fişinde.
21. Gelen kutusu: devirden sonra Aralık belgesi yeniden "yeni" görünmemeli.
22. Aktif tekrarlayan faturanın ≤K şablonu; şablonu bulunamayan tekrar.
23. Ocak'ta Aralık faturasının iadesi (G13 kararından sonra).
24. Devri Yenile: devirden sonra açılan banka hesabının açılışı korunur; K sonrası Kapatılacak Fatura bağı korunur; çakışma listesi; Kasa eksiye düşme uyarısı.
25. Eski sürüme dönüş (bootstrap geri dönüşü, başarısız güncelleme) → şema kapısı; 002 ve arşiv.
26. Arşiv klasörü silinmiş / bozulmuş (sha256 uyarısı); sirketler.json'da arşiv kaydı kaybı → diskten kurtarma.
27. edoc_usage'a silme gitmez; einvoice_inbox, audit_events, integrity_log korunur; trash seçici.
28. Bekleyen POS kalemi olan ≤K satış; bekleyen tahsildeki çek; açık şüpheli alacağın ≤K olay bağı.

### G11. Plan başvurularının güncel yerleri (P1 §2 — D2 başında yeniden okunur)
§2: company-separate.mjs VACUUM INTO :57; db.mjs openDatabase :7; app.mjs readOnly :198, appFor :628, assertWritable :578; license.mjs :727; companies.mjs create :331; routes/companies.mjs
select :86. §4.1: general-ledger.mjs :208, :254-255, :284-286, :308; routes/accounts.mjs :611, :1453; stock.mjs openingFlag :343; lib/accounts.mjs stockLevel :154; cheques.mjs :754;
routes/ledger.mjs :191-198. §4.2: openItems :4980, paymentStates :785, settleTables :690-716, accountSettleInput :762-783, settleInvoices invoice-settle.mjs:163. §4.3: rows :29,
trialBalance :502, reconcile :539, expected :209. §4.4: nextNumber :1909, assertChronology :1939, yıl :2213/:2220, receiptSeq plans.mjs:793. §5: eUnsent :868, unsentSql :1402,
busyCompanies app.mjs:250. §6: admin.mjs :379, restoreCompany :662, stageRootRestore :631. §7: LATEST_VERSION :1932, accounts list() :264, createMoneyLines :222, summary :507,
balanceAt cash.mjs:43, leftOf/signedLeftOf :475/:480, overview compute :146, subBalances :465, partyBalances :495, LOCK_SQL :117, lockDigestOf :225, rangeOf :224.
§11.4: unitCost stock.mjs:718-727 + alış faturası invoices.mjs:2310-2326.

### G12. Sıra (D aşamaları, iş listesi D2–D6)
Çekirdek Ç1 → Ç2 → Ç3 → Ç5 bitmeden devir kodu (D2–D4) başlamaz. D2 göç + arşiv + şema kapısı + kalıcı yedek → D3 saf hesap + Devir Raporu (kâhinle) → D4 kopyada üretim +
değişmezler + takas + Devri Yenile / Geri Al → D5 sihirbaz + arşiv görünümü → D6 WhatsApp ilke 5. Göç numaralarını ana oturum dağıtır.

### G13. Açık sorular (mali müşavir P → para / kapama kuralıysa kullanıcıya, ders 43)
1. Ocak'ta Aralık faturasının iadesi: iade belgesi arşivdeki faturaya nasıl bağlanır (bugün iade yalnız aynı dosyadaki faturadan seçilir), stok ve KDV etkisi yeni yılda.
2. Kapanış akışı: 7/A giderleri, 690 → (691) → 692 → 590 / 591; açılışta 590 / 591'in aynen açılması (§11.1) ile açılış eşleştirmesindeki 570 / 580 dağıtımının ilişkisi.
3. "Borç ve Alacakları Aktar"ın iki satırı ile açık kalemlerin cari ekstrede gösterim düzeni.
4. Devri Yenile'nin kullanıcıya açıklaması: beyanname verilmiş bir yıl yenilenirse ne olur (uyarı metni).

---

## 0. Karar özeti (kullanıcı onaylı)

| Konu | Karar | Kaynak |
|---|---|---|
| Yöntem | **Wolvox yöntemi**: "Devir Yap" dosyayı kesim tarihinde ikiye ayırır | Arkadaş yanıtı + kullanıcı, 20.10.2026 |
| Varsayılan | Devir yapmak ZORUNLU DEĞİL. Devir yapmayan müşteri tek dosyada çalışmaya devam eder (dönem kilidiyle) | DEVIR-MODULU §5 |
| Ne zaman | Ocak–Şubat'ta, Aralık kayıtları tamamlanınca. Kesim tarihi seçilir (ör. 31.12.2026) | Arkadaş yanıtı |
| Kesime kadar | Eski yıl dosyasında kalır → **salt okunur arşiv** | Arkadaş yanıtı |
| Kesimden sonra | Ocak–Şubat'ta girilmiş kayıtlar yeni yıla **hareket olarak aynen** geçer | Kullanıcı teyidi, 20.10.2026 |
| Eski yıla yazma | ~~Devirden sonra YOK~~ → yalnız Devri Yenile içinden, yetkili + gerekçeli (G0, G7) | Arkadaş yanıtı; DEĞİŞTİ 05.11 (kullanıcı: en güncel mevzuat + en yaygın) |
| Devri Güncelle | ~~İlk sürümde YOK~~ → **Devri Yenile VAR** (G7) | Arkadaş yanıtı; DEĞİŞTİ 05.11 |
| Devri Geri Al | VAR (zorunlu yedekle; yanlışlıkla devir için güvence) | Baş mimar |
| Kapanış/açılış fişi | Program yapar: 6'lı hesaplar kapanır, yeni yıla yalnız bilanço hesapları geçer | Baş mimar |
| Stok değeri | **Ağırlıklı ortalama alış fiyatı** (Wolvox varsayılanı, en yaygın); fark arşivde dönem sonu değerleme kaydıyla (§4.3) | Kullanıcı: "en yaygın", 20.10.2026 (§11) |
| Kuruş toleransı | YOK. Kapanış = açılış kuruşu kuruşuna; fark = hata | Baş mimar (para kuruş tamsayı) |
| Arşiv ve şirket sınırı | Arşiv "001 · 2026 (Arşiv)" görünür, 2 şirket sınırına SAYILMAZ | DEVIR-MODULU §5 |

Açık sorular KAPANDI (kullanıcı, 20.10.2026: "verilecek bu 5 kararı en yaygın ve uygun hali neyse öyle yapalım") — kararlar §11'de.

---

## 1. Kullanıcı gözüyle akış

1. Yönetici: Ayarlar → **Yıl Sonu Devri** (yalnız yönetici, yetki `system.manage`).
2. **Sihirbaz 1 — Başlangıç:** Oluşturulacak Çalışma Yılı `2027` · Devir İçin Son İşlem Tarihi `31.12.2026` (yalnız geçmiş bir yıl sonu
   seçilebilir; ileri tarih yok) · bilgi: "Bu tarihe kadarki kayıtlar 2026 arşivine, sonrası 2027'ye geçer."
3. **Sihirbaz 2 — Ön Denetim** (§5; engel varsa İleri pasif, nedeni görünür yazı): bekleyen e-Belge, sonucu belirsiz gönderim, kesim
   öncesi tarihli taslak, banka/POS bekleyen işler, Mutabakat Testi.
4. **Sihirbaz 3 — Seçenekler:** Cari bakiye tipi (◉ Borç ve alacakları aktar · ○ Sadece bakiyeyi aktar), stok değeri (◉ Ağırlıklı Ortalama
   Alış Fiyatı — tek seçenek, bilgi olarak gösterilir). Minimum bakiye alanı YOK (§11.3).
5. **Sihirbaz 4 — Ön İzleme:** aktarılacak sayılar (cari, açık fatura, taksit kartı, çek/senet, banka hesabı, stok kalemi) + tutarlar +
   kesimden sonra yeni yıla taşınacak hareket sayısı + tahmini süre.
6. **Sihirbaz 5 — Onay:** zorunlu yedek bilgisi, onay kutusu şirket koduyla dolu gelir (Şirket Verisini Sıfırla düzeni), "Devri Başlat".
7. **İşlem:** ilerleme çubuğu; bu sırada o şirkete öbür kullanıcıların isteği 503 "Devir yapılıyor" (§7.6).
8. **Sonuç:** **Devir Raporu** (2026 kapanış = 2027 açılış, hesap hesap ve modül modül, PDF/Excel) + Devir Özeti; "2027'ye Geç" /
   "2026 Arşivini Aç".
9. Şirket seçicide: `001 · Firma` (2027, çalışma) ve `001 · Firma · 2026 (Arşiv)` (salt okunur; raporlar, ekstre, belge görüntüleme,
   PDF/Excel çalışır; kaydet/düzenle/sil yok).

Devirden sonra: yeni yılda kesim tarihi ve öncesine kayıt girilemez (dönem kilidi `ledger.lockedUntil` = kesim tarihi).

---

## 2. Mimari: "yerinde budama + arşiv kopyası"

Yeni boş dosya kurup her şeyi taşımak yerine **çalışan dosya yeni yıl olur**, eski yıl onun **kopyasıdır**:

1. Zorunlu yedek: `createBackup` (server/lib/backup.mjs:130), etiket `devir-oncesi-<kod>-<yıl>`.
2. Arşiv kopyası: `VACUUM INTO <arşiv yolu>` (company-separate.mjs:36'daki düzen).
3. **Arşivde:** kesimden SONRAKİ hareketler silinir (arşiv = 31.12'ye kadar), kapanış fişi yazılır (§4.3), arşiv işareti konur.
4. **Çalışan dosyada (tek işlem / transaction):** kesime kadarki hareketler silinir ya da devre dönüştürülür (§3), açılış kayıtları
   yazılır (§4), dönem kilidi = kesim tarihi, devir kaydı (`settings` `devir.history`) yazılır.
5. Devir Raporu iki dosyadan hesaplanır; fark varsa işlem GERİ ALINIR (yedekten) ve rapor hatayı gösterir (kuruş toleransı yok).

Neden bu yol: kayıt kimlikleri (cari, kayıt, taksit kartı, çek, açık fatura, kullanıcı) **değişmez** → kesimden sonraki hareketlerin
eski kayıtlara bağları (Ocak tahsilatının Aralık faturasına `account_entries.invoice_id` bağı, taksit kartı, çek olayları) kırılmaz;
ayarlar, kullanıcılar, yetkiler, entegratör ayarları, kayıtlar (icra/dava dosyaları), notlar, telefonlar, görevler, belgeler, haciz,
mesajlar yeni yılda olduğu gibi kalır (arşivde de kopyası durur).

### 2.1 Arşiv dosyasının yeri ve kaydı
- Yol: `<şirket klasörü>/arsiv/<yıl>/destekofis.sqlite` (001 için `<dataDir>/arsiv/<yıl>/`). Dosya adı `resolveDbPath`
  (db-path.mjs:12) düzeninde.
- Kayıt defteri `<dataDir>/sirketler.json` (companies.mjs:6, kopyası `sirketler.yedek.json` :26, hub `company.registry`): şirket
  kaydına `archives: [{ year, dir, cutoff, createdAt, createdBy, backup }]`. Arşiv AYRI şirket değildir → `MAX_COMPANIES = 2`
  (companies.mjs:30, `limit()` :327, `create` :332) sayımına girmez.
- Açılış: `openDatabase(path, { readOnly: true })` (db.mjs:4; bugün app.mjs:127, report-worker.mjs:22 kullanıyor).
- Şirket seçimi kullanıcıya özel (companies.mjs `select` :435, `POST /api/companies/select` routes/companies.mjs:73, `appFor`
  app.mjs:406) → seçimde `{ companyId, archiveYear }` taşınır.

### 2.2 Arşivde yazma yasağı (merkezî)
- Lisansın salt okunur kipi örnek alınır: `license.assertWritable` (app.mjs:362, license.mjs:659 → 403 LICENSE_READ_ONLY).
  Arşiv seçiliyken bütün yazma uçları 403 `archive-read-only` ("2026 arşivi yalnız görüntülenir"). Ek güvence: bağlantı zaten readOnly.
- İstemci: arşivde ekleme/düzenleme/silme düğmeleri görünmez; üstte sabit şerit "2026 Arşivi — salt okunur · 2027'ye Dön".
- Arşivde açılabilenler: raporlar, mizan, ekstre, Ana Defter, fatura/makbuz PDF, e-Belge resmî görüntü ve XML, belgeler.

### 2.3 Arşiv ve güncelleme (göç)
- Program güncellenince arşiv dosyası da `runMigrations` (migrations.mjs; göçten önce yedek alır) görmelidir; aksi hâlde yeni kod eski
  şemayı okuyamaz. Arşiv yalnız göç için kısa süre yazılabilir açılır, sonra yeniden readOnly. Test: eski sürümde devir → güncelle →
  arşiv raporları açılıyor (ders 17).

---

## 3. Modül modül: kesimde ne olur

Gösterim: K = kesim tarihi (dahil). "Silinir" = çalışan (yeni yıl) dosyadan silinir, arşivde durur.

| Modül | Tablo (göç) | Kesime kadar (≤ K) | Kesimden sonra (> K) |
|---|---|---|---|
| Cari | accounts (v12), account_entries `date` (v12) | Hareketler silinir; cari başına açılış satırı (§4.1) | Aynen kalır |
| Fatura | invoices `issue_date` (v18), invoice_lines, invoice_offsets `date` (v19) | **Kapanmış** faturalar silinir. **Açık** fatura (kalan > 0) kalır, "devir faturası" olur (§4.2) | Aynen kalır |
| Kasa | cash_entries `date` (v5) | Silinir; tek açılış `is_opening=1` tarihi K+1 (§4.1) | Aynen |
| Kayıt tahsilatı | payments `date` (v1; Kasa'ya düşer) | Silinir (Kasa açılışı tutarı kapsar) | Aynen |
| Taksit | plans (v7), plan_items `due_date`, plan_entries `date` | Ödenmiş/kapanmış kart: hareketleri silinir, kart kalır (arşivde tam). Açık kart: ≤ K hareketleri silinir, tek açılış `plan_entries.opening=1` (göç 14) = K'ye kadar ödenen | Aynen |
| Çek/Senet | cheques `issue_date/due_date/status_date` (v13), cheque_events `date`, cheque_collections `given_date/closed_date` (v20) | Kapanmış evrak (tahsil, ödendi, iade…) silinir. Açık evrak (portföy, tahsilde, ciroda, karşılıksız) kalır; ≤ K olayları tek "devir" olayına indirilir (durum korunur) (§4.1) | Aynen |
| Banka/POS/Kart | fin_events `date/value_date` (v20), bank_lines, bank_accounts `opening_date`, pos_sales `date`, bank_plans | ≤ K olaylar silinir; hesap başına açılış `fin_events.type='opening'` (`writeOpening` bank/accounts.mjs:464) tarihi K+1. Valörü K'den sonraya sarkan POS alacakları **açık kalem** olarak taşınır (§4.1) | Aynen |
| Stok | stock_items, stock_moves `date` (v12) | Hareketler silinir; ürün başına açılış `stock_moves.is_opening=1` (göç 30) miktar = K'deki miktar | Aynen |
| Şüpheli alacak | doubtful_receivables `date/closed_date`, doubtful_provisions (v23) | Kapanmış silinir; açık olan kalır (128/129 açılışı) | Aynen |
| KDV | vat_offsets `month/date` (v30) | ≤ K silinir; 191/391/360 bakiyesi açılış fişine (§4.3) | Aynen |
| e-Belge gelen kutusu | einvoice_inbox (v18) | Alınmış olanlar silinir; alınmamış ≤ K tarihli varsa ÖN DENETİM uyarısı (§5) | Aynen |
| Kayıtlar, notlar, telefon, görev, belge, haciz, mesaj, sohbet | records, notes, phones, tasks, case_documents, liens, messages, chat_* | **Dokunulmaz** (yeni yılda aynen; arşivde kopya) | — |
| Kullanıcı, rol, ayar, entegratör | users, roles, settings | Dokunulmaz | — |
| Denetim izi | audit_events, integrity_log | Yeni yılda ≤ K silinir (arşivde tam); devir olayı yazılır | Aynen |
| Çöp | trash (v6) | Boşaltılır (arşivde durur) | — |
| Tablolar | dataset_rows/imports (v4), free_* | Dokunulmaz | — |

Uygulamaya başlarken: `migrations.mjs`'te tabloların TAMAMI tek tek bu tabloya işlenir; listede olmayan tablo varsa (2.4.4 eklemiş
olabilir) önce sınıflanır. Hiçbir tablo "unutulmuş" kalmaz — denetim testi: şemadaki her tablo bu sınıflamada var (§9).

---

## 4. Açılış kayıtları

### 4.1 Modül açılışları (var olan mekanizmalarla)
| Modül | Mekanizma (bugün) | Defter (general-ledger.mjs) | Devirde |
|---|---|---|---|
| Kasa | `cash_entries.is_opening` (cash-opening.mjs:16) | :203 B 100 / A 500 | Tutar = K'deki nakit; kural "bir kez, ilk hareketten önce" korunur (tarih K+1) |
| Cari | `addEntry(... note: "Açılış bakiyesi")` (routes/accounts.mjs:491, :1187); notla tanınır (general-ledger.mjs:77) | :246–247 120/320/336 ↔ 500 | §4.2 formülüyle; "Borç ve alacakları aktar" → iki satır (borç toplamı, alacak toplamı), "Sadece bakiye" → tek satır. **Ayrı bir `is_opening` sütunu eklenir** (notla tanıma kırılgan; göç) |
| Taksit | `plan_entries.opening` (göç 14) | :274–276 B 500 / A kontrol | K'ye kadar ödenen tek satır; Kasa'ya girmez (routes/plans.mjs:919) |
| Stok | `stock_moves.is_opening` (göç 30), `openingFlag` routes/stock.mjs:340 | :295 B 153 / A 500, değer `stockOpeningValue` :109 | Miktar = `stockLevel` (lib/accounts.mjs:148) K'de; değer = K'deki ağırlıklı ortalama alış fiyatı (§11.4) |
| Banka | `fin_events.type='opening'` (`writeOpening` bank/accounts.mjs:464, `setOpening` :687) | bank_lines hesap kodu saklı | Hesap başına K bakiyesi; "Devir Kapanışı" `carry_close` (bank/accounts.mjs:1175) ile çakışma kuralları (module-ref.mjs:80, post.mjs:360) denenir |
| Çek/Senet | Ayrı açılış işareti YOK; Excel "Açılış portföyü" (routes/cheques.mjs:697) karşı hesabı 602/770 (routes/ledger.mjs:186–195) | — | **Yeni**: `cheque_events` "devir" olay türü; açık evrakın K'deki durumu ve hesabı (101.01/101.02/103/121.01/121.02/321) açılışla gelir, karşı hesap 500. Kâhin ile (ders 5) |

### 4.2 Cari ve açık faturalar (çift sayım YOK)
- Açık fatura: `openItems` (routes/invoices.mjs:4238), `paymentStates` (:602; bağlar :622–645: `source='invoice'`, `invoice_id`,
  `cheque_events.invoice_id`, `invoice_offsets`, `plan_id`), dağıtım `settleInvoices` (invoice-settle.mjs:128; önce bağlı ödeme, kalan
  FIFO).
- Devir faturası: faturanın satırı, kalemleri ve kimliği yeni yılda KALIR; yeni sütunlar `devir_year`, `devir_remaining` (K'deki kalan,
  işaretli). Bu fatura yeni yılda **stok, KDV, gelir ve deftere ETKİ ETMEZ** (etkisi arşivde); yalnız açık kalem olarak listelenir ve
  kesimden sonraki tahsilat ona bağlanabilir (Kapatılacak Fatura). Kalan = `devir_remaining − (K sonrası bağlı ödemeler)`.
- **Cari açılış tutarı = cari K bakiyesi − Σ (o carinin devir faturalarının `devir_remaining`)** (yön işaretli). Böylece yeni yılda
  cari bakiye = açılış + devir faturaları kalanı = K bakiyesi.
- Taksit kartına bağlı fatura (`plan_id`): kalan taksitte izlenir; çift sayılmaması için kural ayrıca yazılır ve kâhinle denenir.
- Yaşlandırma/vade: devir faturası kendi vadesiyle; açılış satırının vadesi K+1 (faturasız eski borç; MM5 düzeltmesiyle görünür).

### 4.3 Muhasebe: kapanış (arşivde) ve açılış fişi (yeni yılda)
- Defter fiş saklamaz; her istekte kaynak kayıtlardan türetilir (general-ledger.mjs:1–8, `journal` :157, `rows` routes/ledger.mjs:27).
  Tek istisna banka (bank_lines hesap kodu saklı, :375). Hesap planı `CHART` general-ledger.mjs:15 — **690, 590, 591, 570, 580, 692 YOK**
  (eklenir).
- **Yeni tablo `ledger_vouchers` / `ledger_voucher_lines`** (hesap kodu, borç, alacak, tür `closing`|`opening`|`opening-diff`): defter
  bu satırları bank_lines gibi aynen alır.
- **Arşivde kapanış fişi (K tarihli):** 6xx hesaplar → 690 Dönem Kârı/Zararı; 690 → 590 Dönem Net Kârı / 591 Dönem Net Zararı (vergi
  karşılığı 691/370 ve öbür yıl sonu düzeltmeleri programda YOK — §11.5). Kapanıştan ÖNCE stok değerleme kaydı (§11.4): arşivdeki 153 bakiyesi
  ile "K miktarı × ağırlıklı ortalama" farkı 153 ↔ 621 Satılan Malın Maliyeti (CHART'a eklenir) ile kaydedilir; 621 de 690'a kapanır.
- **Yeni yılda açılış farkı fişi (K+1):** modül açılışları (§4.1) karşı hesap olarak 500 kullanır. Fiş, **arşivin K kapanış mizanındaki
  her bilanço hesabı (1xx–5xx)** ile yeni yıl açılış mizanını hesap hesap eşitleyecek fark satırlarını yazar: modül açılışının kapsamadığı
  hesaplar (191, 391, 360, 193, 128/129, 159, 340… — ne çıkarsa) + 500 ile 590/591'in arşivdeki bakiyelerine eşitlenmesi. 590/591 yeni yılda AYNEN açılır; 570/580'e aktarım
  (kâr dağıtımı/genel kurul) mali müşavirin işidir (§11.1).
- **Değişmez (kâhinin ana denetimi):** her bilanço hesabı için `arşiv K kapanış bakiyesi = yeni yıl K+1 açılış bakiyesi`, kuruşu kuruşuna;
  arşivde 6xx toplamı kapanıştan sonra 0.
- Mizan: `trialBalance` general-ledger.mjs:441, `reconcile` :478; beklenen bakiyeler `expected()` routes/ledger.mjs:204.

### 4.4 Numaralar
- e-Belge: `nextNumber` routes/invoices.mjs:1657 seri+yıl `MAX(seq)`; yıl `issue_date`'ten (:3297) → yeni yılda kendiliğinden 1'den.
  Devir faturası eski yıl numarasını korur; yeni yıl sayacını ETKİLEMEZ (sorgu `year`'a göre — test edilir). Kronoloji
  `assertChronology` :1675: devir faturası (eski yıl) yeni yıl belgeleri için engel olmamalı — test.
- Banka İşlem No yıl bazlı (bank/event-no.mjs, `meta.bank.seq.<yıl>`) → değişmez. Taksit makbuz sayacı `plans.receiptSeq` yıl bazlı
  DEĞİL (routes/plans.mjs:783) → olduğu gibi sürer (makbuzlar arşivde de var).

---

## 5. Ön denetim (devri durduran / uyaran)

DURDURUR (İleri pasif, neden + "Git" bağlantısı):
- Gönderilecekler'de ≤ K tarihli bekleyen e-Belge (`e_status='waiting'`, `eUnsent` routes/invoices.mjs:703, `unsentSql` :1196).
- Sonucu belirsiz e-Belge gönderimi.
- ≤ K tarihli taslak fatura (kaydedilsin ya da silinsin).
- Banka/POS bekleyen iş (bank_jobs), yarım "Devir Kapanışı".
- Mutabakat Testi (integrity `run/scan`) kırmızı.
- Yetki: `system.manage` değil.
- Şirket meşgul (`busyCompanies` app.mjs:135 — geri yükleme/ayırma sürüyor).

UYARIR (onayla geçilir, Devir Raporu'na yazılır):
- Gelen e-Faturalar'da alınmamış ≤ K tarihli belge ("Aralık faturası 2026'ya girmeli; devirden sonra giremezsiniz").
- ≤ K tarihli e-Arşiv belgesi iptal süresi içinde (iptal arşivde YAPILAMAZ — önce iptal edin ya da devri erteleyin).
- Eksi stok, eksi kasa.
- Kesim tarihi bugünden 60+ gün önce değilse bilgi: "Aralık faturaları geldi mi, beyanname verildi mi?"

---

## 6. Devri Geri Al

- Yalnız yönetici; yalnız SON devir; onay: şirket kodu + "GERİ AL" yazımı + parola (restore ucu düzeni, routes/admin.mjs:373).
- Önce zorunlu yedek `geri-al-oncesi-<kod>-<yıl>` (yanlışlıkla geri alma kurtarılabilir).
- İşlem: devir öncesi yedekten çalışan dosya geri yüklenir (`restoreCompany` company-backups.mjs:643; 001'de yeniden başlatmada uygulanır
  `stageRootRestore` :612), arşiv kaydı kaldırılır (dosya `arsiv/silinen/` altına taşınır, silinmez).
- **Devirden sonra yeni yıla girilmiş kayıt varsa** pencere sayısını söyler ("devirden sonra 37 kayıt girildi; geri alınırsa bunlar
  kaybolur — 'geri-al-oncesi' yedeğinde durur") ve ancak ikinci onayla sürer. (Kesim sonrası kayıtları taşıyarak geri alma — ilk sürümde
  YOK; BİLİNEN SINIR.)

---

## 7. Teknik ayrıntılar

1. **Göç (sıradaki numara; bugün son göç 30, `LATEST_VERSION` migrations.mjs:1578):** `account_entries.is_opening`, `invoices.devir_year`,
   `invoices.devir_remaining`, `cheque_events` "devir" türü, `ledger_vouchers` + `ledger_voucher_lines`, (gerekirse) `plans`/`cheques`
   devir işareti. Eski açılış satırları (notla tanınan) göçte `is_opening=1` yapılır; tanıma kuralı aynı kalır (gerileme testi).
2. **Kod yeri:** `server/lib/devir/` — `plan.mjs` (ön izleme sayıları, saf), `split.mjs` (budama + açılışlar, tek transaction), `report.mjs`
   (kapanış = açılış), `archive.mjs` (kayıt defteri, readOnly açma, yazma yasağı); uç `server/routes/devir.mjs`; istemci
   `client/assets/hof-devir.js`.
3. **Saf hesap + tek yazma:** açılış tutarları önce SAF fonksiyonla (veritabanına yazmadan) hesaplanır — ön izleme ve rapor aynı fonksiyonu
   kullanır; yazma tek transaction; hata → ROLLBACK + yedek olduğu gibi.
4. **Bakiye kaynakları (yeniden kullanılacak):** cari `accountLedger` lib/accounts.mjs:42 / `list()` routes/accounts.mjs:178; kasa-banka
   `createMoneyLines` bank/money-lines.mjs:220 (`balances`, `summary(day)` :739), `balanceAt` routes/cash.mjs:42, `totalsOf`
   bank/accounts.mjs:764; stok `stockLevel` lib/accounts.mjs:148; açık fatura `openItems`/`paymentStates`; taksit `leftOf`/`signedLeftOf`
   routes/plans.mjs:467/472; çek `portfolioSummary` lib/cheques.mjs:106; hepsi `compute()` routes/overview.mjs:135; defter `expected()`,
   `subBalances` :404, `partyBalances` :434.
5. **Dönem kilidi:** `setLock` period.mjs:68 (ileri tarih kilitlenemez — K geçmiş, sorun yok); kilit izi integrity.mjs:116 `LOCK_SQL`,
   `lockDigestOf` :224 → devirden sonra iz YENİDEN hesaplanır (budama kilitli dönemi değiştirir; aksi hâlde kapı "kilitli dönem değişti"
   der). Kilidi kaldırmak yeni yılda K'yi açmaz: K öncesi kayıt girilmesi ayrıca `devir` kuralıyla 409 `devir-closed`.
6. **Özel kip:** `busyCompanies` (app.mjs:135, :409 → 503) devir boyunca o şirkete konur; arka plan işleri (yedek zamanlayıcı, e-Belge
   turları, güncelleme kurulumu) o süre beklenir. Güncelleme kurulumu devir sürerken başlamaz.
7. **Rapor ekranları:** "Bu Yıl" (finance-report.mjs:164 `presetRange`, report-center.mjs `rangeOf` :203) yeni yılda doğal çalışır;
   yeni yılda K öncesi seçilirse ipucu: "2026 kayıtları arşivde — Arşivi Aç".
8. **Birleşik şirket raporu** (overview compute) arşivleri SAYMAZ.
9. **Yedek:** arşiv klasörü şirket yedeğine girmez (bir kez, devir öncesi yedekte tam hâl var); arşiv dosyasının sha256'sı devir kaydında
   tutulur, açılışta denetlenir (bozulmuşsa uyarı).
10. **Hız hedefi:** 1.000.000 para satırlı şirkette devir < 5 dk; ön izleme < 10 sn (ölçülür, Uzun Doğrulama'da).

---

## 8. "Nasıl bozulur?" listesi (testler buradan çıkar)
1. Aralık faturası Ocak'ta tahsil edilmiş (bağlı ödeme K sonrası) → yeni yılda fatura kapanmalı, cari 0.
2. Kısmi ödenmiş fatura + FIFO dağılan serbest tahsilat → açık kalan doğru, cari açılışla çift sayım yok.
3. Taksit kartına bağlı fatura, kısmi ödenmiş taksit, avans (fazla tahsilat), Kasa Dışı açılışlı kart.
4. Çek: portföyde, bankada tahsilde (101.02), ciro edilmiş, karşılıksız; K'den sonra tahsil/karşılıksız olan çek.
5. POS valörü K'den sonraya sarkan satış; kredi kartı borcu; banka "Devir Kapanışı" yapılmış hesap.
6. Eksi stok, sıfır stoklu ürün, silinmiş ürünün açılışı (153'te kalır — 2.4.3 bilinçli kararı).
7. Aynı adlı iki cari; pasif cari; bakiyesi 0 ama açık faturası olan cari (+ ve − kalemler).
8. İade faturası, mahsup (invoice_offsets), KDV Mahsup (vat_offsets), Vergi Ödemesi, şüpheli alacak.
9. K tarihinde (31.12 23:59) ve K+1'de (01.01 00:00) kayıt; sahte saat (`config.now`) 31.12→01.01, Şubat'ta devir (ders 13, 22).
10. İki kullanıcı devir sırasında yazmaya çalışır (503); devir yarıda kesilir (süreç öldür, disk dolu, kilitli dosya) → ROLLBACK, veri
    devir öncesiyle aynı.
11. Devir → Geri Al → yeniden devir; devir → güncelleme (göç) → arşiv açılır; devir → yedek → geri yükle.
12. İki şirket (001, 002) — yalnız seçilen devredilir; arşiv sınıra sayılmaz; 002'de devir.
13. Eski sürüm verisi (v2.4.3, v2.3.0 gerçek kodla üretilmiş, ders 17) üzerinde devir.
14. e-Belge: bekleyen gönderim (durdurur), devir faturası numarası yeni yıl sayacını etkilemez, kronoloji engeli çıkmaz.
15. Arşivde her yazma ucu 403 (kaynak tarama testi: bütün POST/PUT/DELETE uçları); arşivde bütün raporlar açılır.
16. Şemadaki her tablo §3 sınıflamasında (yeni tablo eklenince test kırılır).

---

## 9. Test ve kanıt planı (anayasa: KANIT KURALI 1–5, dersler)
- **Kâhin (ders 5):** Python temiz oda modeli, programın kodunu GÖRMEDEN bu plandan ve TDHP'den yazılır (`test/bagimsiz/devir/`): rastgele
  bir yıllık veri (cari, fatura, tahsilat, taksit, çek, banka/POS, stok, KDV) + kesim → beklenen: modül açılışları, açık kalemler, hesap
  hesap açılış mizanı. Program kara kutu (API) ile karşılaştırılır. Fark = hata (ders 6).
- **Değişmez denetimler:** bilanço hesabı kapanış = açılış; cari/kasa/banka/stok/çek/taksit modül bakiyeleri K'de eşit; arşiv + yeni yıl
  hareket sayıları = devir öncesi (silinen ≤ K hareketlerin tamamı arşivde).
- **Kırmızı kanıt (ders 7, 23):** her test eski kodda (ayrı `git archive` kopyası) kırmızı. **Mutasyon:** açılış formülü, devir faturası
  kalanı, kapanış fişi, arşiv yazma yasağı — bilerek bozulur, testler yakalar.
- **e2e:** sihirbaz baştan sona ekrandan (insan hızı + klavye, ders 12), arşivi aç → rapor/ekstre/PDF, yazma düğmesi yok, Geri Al.
- **Uzun Doğrulama (yalnız son aday, GitHub):** kâhin 5 tohum × 1 yıllık veri; 1.000.000 satırda devir süresi; Windows'ta da (ders 1, 18).
- **Dar kontrol (ders 32):** para çekirdeği → bağımsız gözden geçirme + düzeltmelerden sonra dar kontrol.
- **İnsan (KANIT 5):** kullanıcıya kısa elle kabul listesi (adım + beklenen sayı) — kendi test şirketinde devir.

---

## 10. Aşamalar ve tahmin
| Aşama | İş | Çıktı |
|---|---|---|
| D0 | Bu planı koda karşı yeniden doğrula (2.4.4 sonrası), tablo sınıflamasını tamamla, §11 kararları; **KÂHİN ÖNCE** (kullanıcı kararı 23.10.2026): devir kâhini (ayrı ajan, programın kodunu GÖRMEDEN, yalnız bu plandan ve §11 kararlarından; Python temiz oda + kara kutu API koşucusu + mutantlar, test/bagimsiz/devir/) kod yazılmadan ÖNCE kurulur; her D adımı ona karşı geliştirilir, CI'de ve Uzun Doğrulama'da koşar; kâhinle program ayrışınca kural yalnız karar metninden netleştirilir (CLAUDE.md ders 40) | Güncel plan + devir kâhini |
| D1 | Kâhin modeli (ayrı ajan, kodu görmeden) + "Nasıl bozulur" testleri (kırmızı) | test/bagimsiz/devir, test/devir-*.test.mjs |
| D2 | Göç + `ledger_vouchers` + CHART (690/590/591/570/580/621) + cari `is_opening` | Gerileme yok (tam npm test) |
| D3 | Saf hesap (`plan.mjs`) + Devir Raporu (`report.mjs`) | Ön izleme = kâhin |
| D4 | Budama + açılışlar (`split.mjs`), arşiv (`archive.mjs`), yazma yasağı, kilit izi | Değişmezler yeşil |
| D5 | Sihirbaz + arşiv görünümü + Geri Al (istemci) + kılavuz hap bilgisi | e2e yeşil |
| D6 | Mutasyon, bağımsız gözden geçirme, dar kontrol, Uzun Doğrulama, elle kabul listesi | Sürüm adayı |

Tahmin: ~4–6 iş günü, ~4–7 M token (para çekirdeği; kâhin ve mutasyon dahil). Sürüm: 2.5.0 (yeni modül).

---

## 11. Kararlar (kullanıcı, 20.10.2026: "verilecek bu 5 kararı en yaygın ve uygun hali neyse öyle yapalım")
Her biri yerli programların (Logo, Mikro, Netsis, Wolvox) yaygın uygulaması ve TDHP'ye göre baş mimarca seçildi.
1. **Sermaye / dönem sonucu:** Arşivde 6xx → 690 → 590 (kâr) / 591 (zarar). Yeni yıl açılış fişi bilanço hesaplarını AYNEN taşır; 590/591 de
   olduğu gibi açılır. 570 Geçmiş Yıllar Kârları / 580 Geçmiş Yıllar Zararları'na aktarım ve kâr dağıtımı mali müşavirin işidir (yaygın uygulama:
   genel kurul / beyanname sonrası); program bunu YAPMAZ. Gerekçe: değişmez "her bilanço hesabı kapanış = açılış" kuruşu kuruşuna korunur.
2. **Cari bakiye tipi:** iki seçenek — ◉ Borç ve Alacakları Aktar (VARSAYILAN, Wolvox varsayılanı) · ○ Sadece Bakiyeyi Aktar. İkisinde de kalan
   bakiye aynı; fark ekstrede görünüşte (DEVIR-MODULU §5 örneği). Açık faturalar her iki seçenekte de tek tek gelir (§4.2).
3. **Cari kartlar ve minimum bakiye:** BÜTÜN cari kartlar yeni yılda kalır (Wolvox "Cari Kartlarını Aktar" varsayılan işaretli; kimlik bağları
   için de şart); bakiyesi 0 olan cariye açılış satırı yazılmaz. "Minimum Bakiye" alanı ilk sürümde YOK: altındaki bakiyeyi atlamak kapanış ≠
   açılış farkı doğurur; küçük bakiyeler devirden önce Mahsup / Kapatma ile temizlenir.
4. **Stok değeri:** Ağırlıklı Ortalama Alış Fiyatı (Wolvox devir ekranının varsayılanı, Türkiye'de en yaygın; VUK md. 274 maliyet bedeli,
   ortalama maliyet yöntemi kabul görür). Hesap: K'ye kadarki alışların (açılış dahil) miktar ağırlıklı ortalaması; alışı olmayan üründe kayıtlı
   birim fiyat. Arşivde fark 153 ↔ 621 değerleme kaydıyla kapanıştan önce yazılır (§4.3). Programın günlük stok değerlemesi (son alış) BU İŞTE
   değişmez (ayrı iş). D0'da: alış hareketlerinde birim maliyetin (`unitCost`, routes/stock.mjs:692–701) güvenilir saklandığı doğrulanır.
5. **Vergi karşılığı ve yıl sonu düzeltmeleri** (691/370, amortisman, reeskont, kur farkı, KKEG): program YAPMAZ — ön muhasebe programlarında
   yaygın uygulama; mali müşavir resmî defterde yapar. 590/591 vergi ÖNCESİ dönem sonucudur; Devir Raporu bunu açıkça yazar.

## Ek — Açılış kayıtları düzeni (2.5.0; 30.10.2026)

KARAR → 2.5.0 (kullanıcı, 30.10.2026 ~19:10 UTC: "bunu devirle beraber 2.5.0'da yapalım, o sürüm için planladığımız muhasebe çekirdeğini de eklemeyi düşünüyorum zaten"): AÇILIŞ KAYITLARI DÜZENİ 2.5.0'da devir + muhasebe çekirdeğiyle — (1) açılış çekleri gelir/gidere yazılmaz (bugün carisiz/açılış portföyü alınan 101/602, verilen 770/103: server/routes/ledger.mjs build() 602/770 eşlemesi); (2) bütün açılışların (cari, kasa, banka, taksit, stok, çek) karşı hesabı 500 Sermaye DEĞİL — geçici "Eşleştirilecek Açılış Bakiyeleri" (server/lib/general-ledger.mjs CHART 500 "Açılış ve Devir Bakiyeleri"); (3) açılış bilançosuyla eşleştirme + öz sermaye (500/570/580) dağıtımı; karşı hesap belirlenemezse "tamamlanmamış açılış" bekler. Dayanak (kullanıcının VUK listesi, baş mimar mali müşavir incelemesiyle ilkede AYNI sonuç): VUK 3/B, 174, 182–186, 192. 2.4.8'de bu konuda kod DEĞİŞMEZ.

### G14. Mali müşavir P sonuçları (05.11.2026 17:12 UTC; ayrıntı docs/erp/MUHASEBE-CEKIRDEGI-PLANI.md §13 ve kural kitabı)
- KABUL (BAŞ MİMAR KARARI): açık kalemin defter karşılığı açılış sınıfında B cari / A 519 (geçici) — sıradan Borç Yaz gibi 602'ye GİTMEZ (yoksa gelir iki kez sayılır); değişmez: devirden hemen
  sonra yeni yılın Gelir Tablosu = 0. "Borç ve Alacakları Aktar": ekstrede iki satır, DEFTERDE cari başına NET tek madde (KG-17; yeni yıl mizanında önceki yılın cirosu taşınmaz).
- G13 yanıtları: (1) Ocak'ta Aralık faturasının iadesi — arşivdeki faturaya salt okunur başvuru (yıl, belge no, tarih, kalemler); iade yeni yılda 610 / 191 ↔ cari; açık kalem varsa önce onu kapatır;
  KDV iade ayında; stok yeni yıla girer; e-Belge'de asıl belgeye başvuru. (2) kapanış sırası çekirdek §13. (3) ekstre: "Borç Toplamı" / "Alacak Toplamı" (açık kalemler düşülmüş) + açık kalemler
  kendi tarih ve vadesiyle. (4) Devri Yenile uyarısı: "Bu yılın beyannamesi verildiyse ya da e-Defter beratı yüklendiyse burada yapacağınız düzeltme yasal defterinizi ve beyannamenizi değiştirmez;
  düzeltme beyannamesi gerekebilir. Mali müşavirinizle görüşün." + 30 Nisan'dan sonra ikinci onay.
- Mevzuat (kaynaklı): enflasyon düzeltmesi 2025–2027 yapılmaz (VUK geçici 37, 7571 s. K., RG 25.12.2025) → 31.12.2026 devrinde düzeltme kaydı yok; kurumlar vergisi beyanı 1–30 Nisan, gelir
  vergisi 1–31 Mart → Devri Yenile'nin olağan penceresi Ocak–Nisan.
- Aralık KDV'si: KG-7 kararına bağlı (geç gelen faturada KDV indirim dönemi alanı önerisi, KDVK 29/3).
