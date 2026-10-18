# e-Belge kâhini — kurallar ve kararlar (dil `destekofis-ebelge/1`, 18.10.2026)

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
| K22 | Gönderilmiş e-Arşiv 7 gün içinde (8 günlük sınırın içinde) iptal edilir, numara korunur. | FATURA-ISTEKLER satır 111, 133 ("e-Arşiv iptali 8 günle sınırlı"); "İptalde numara korunur" satır 119 |
| K23 | Gönderilmiş e-Fatura, süresi geçmiş e-Arşiv ya da ağ yokken gönderilmiş belge iptali: reddedilir YA DA yalnız programda iptal — ÇATAL. | FATURA-ISTEKLER satır 112 (e-Fatura entegratörden iptal edilmez; alıcı reddi/iade), FATURA-KARSILASTIRMA satır 44 ("programda iptal önerisi") |
| K24 | Gönderilmemiş belge iptal edilir; numarası (varsa) korunur, artık gönderilmez. | FATURA-ISTEKLER satır 119 |
| K25 | Gönderilmiş ya da iptal belge düzenlenmez. | FATURA-ISTEKLER satır 119 "Kesilen belge düzeltilmez (yasal belge)"; GİB: gönderilmiş belge değiştirilemez |
| K26 | Numaralı ama gitmemiş (ya da kâğıt) belgenin tarihi: reddedilir YA DA değişir — ÇATAL (değişirse K6 değişmezi denetler). | Yazılı değil |
| K27 | Numaralı belgede Düzenle belge türünü değiştiremez. | CLAUDE.md 2.4.3 karar (1) |
| K28 | Durum Sorgula, EDM'deki belgeyi programda "gönderildi" yapar. | E-BELGE-EDM.md / FATURA-ISTEKLER (durum sorgulama) |
| K29 | Serideki son numaralı belgeden eski tarihli yeni e-Belge hiç gönderilemez (K6); kaydı reddedilebilir ya da kalıcı engelli olarak tutulabilir — ÇATAL. | K6'nın sonucu; davranış yazılı değil |
| K30 | Carinin işareti (Mükellef Sorgula ya da gönderimdeki sorgu) belge türüyle çelişirse numarasız belgenin düzenlemesi reddedilir. | GİB (mükellefe e-Arşiv kesilmez); CLAUDE.md 2.4.3 karar (4) |

## Değişmezler (fark.py; YALNIZ programın gözlenen durumu + sahte EDM kaydı üzerinde, modelden bağımsız)
I1 seri+yıl boşluksuz (FIS dahil) · I2 sıra-tarih monoton (FIS dahil) · I3 her ETTN EDM'de en çok bir kez kabul · I4 EDM'nin kabul ettiği kimlik =
programdaki numara · I5 e-Belge numarası değişmez · I6 EDM'ye giden her kimlik geçerli biçim, profil serisi, belge yılı · I7 mükellef alıcıya e-Arşiv
gitmez · I8 iptal belge hiç, listeden silinmiş belge turda gönderilmez; tur sürerken kabul edilen silme → belge gitmez · I9 gönderilmiş belgenin tarih/
tür/cari alanı değişmez · I10 program "gönderildi" ⇒ EDM kabul etmiş · I11 e-Fatura posta kutusuyla gider · I12 numara yılı = belge yılı · I13 numara
benzersiz · I14 kişi (TCKN) carisi mükellef işaretlenmez · I15 eşzamanlı turda gönderilen belge için hata yanıtı yok · I16 tur yanıtındaki "gönderildi"
iddiası EDM'de var · I19 tur sonucunda gönderilmeyen belgenin kodu ve iletisi dolu (baş mimar kararı 18.10.2026) · I18 sonda (ağ var + Tümünü Gönder) program ↔ EDM tutarlı · I0 sahte EDM'nin kendi sözleşme ihlalleri.

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
BEKLENEN-O1 (eski KALICI engelli bekleyen — K3/K6 — seriyi bekletiyor; 18.10 kararından sonra PK'sız eski belgenin bekletmesi doğru) · BEKLENEN-I19 (bekletilen belgenin tur sonucu kodsuz/iletisiz) · BEKLENEN-O1-ZINCIR / TUTMA-YOK (eski gönderilebilir bekleyen varken yeni
belge numaralandı; eski belge kalıcı tarih engeline düşer) · BEKLENEN-O2 (tur sürerken Listeden Sil kabul edildi, belge yine gitti) ·
BEKLENEN-O3 (alıcısı mükellef çıkan bekleyen e-Arşiv seriyi bekletiyor) · BEKLENEN-AG (ağ yokken numara) · BASKA-ESZ (eşzamanlı turda
"gönderiliyor" hata olarak döndü) · BASKA-FIS-SIRA (Listeden Sil eski tarihli belgeye FIS numarası verdi) · BASKA-DUZENLE-SIRA (numarasız
bekleyenin tarihi sıra-tarihi bozmadan değiştirilemiyor) · *-ARDIL (aynı adımdaki asıl farkın sonucu) · BASKA (sınıfsız: önce incelenir).
