# Müşteri İstekleri Tur 3 — Rapor (taslak; adım adım doldurulur)

Taban: `t251-mi3-taban` (bb6be861). Kapsam: dar kontrol Mİ ORTA-1 (dönem 'Tarih Aralığı'na çevrilip günler seçilmeden 'Bu Dönemde Ödeme
Yapanlar' açıkken eski ödeyenler + 'Tümüne WhatsApp' + dönemsiz PDF / Excel), kalıcı ekran adımı (DK-PROBE), Grup Özeti testinde 'Diğer' dişi.

## 0. NASIL BOZULUR (koddan ÖNCE yazıldı)

Değişmez kurallar (her satırda denetlenir):
- K1 Ekranda görünen satırlar = PDF'in satırları = Excel'in satırları (aynı dönem, aynı 'ödeme yapanlar' süzgeci, aynı grup / tür / arama / bakiye).
- K2 Toplu WhatsApp (ekstre / mesaj) ekranda görünenden FAZLA kişiye gidemez; 'Bu Dönemde Ödeme Yapanlar' kutusu işaretliyken 'Tümüne WhatsApp' düğmesi hiç görünmez
  (karar (5)) ve başlık kutusu yalnız ekrandaki carileri seçer.
- K3 Ekranın gösterdiği dönem her zaman yazılıdır (Tahsilat kartındaki dönem metni); seçicide yazan dönem henüz uygulanmamışsa bu açıkça söylenir.
- K4 Sayılar değişmez: Grup Özeti, Liste, rapor eşdeğerliği aynı (yalnız görünüm / düğme / süzgeç taşıma).

Bozulma listesi (testler buradan çıkar):
1. Dönem seçicinin her seçeneği (Yok, Bugün, Dün, Bu Hafta, Bu Ay, Tarih Aralığı) × 'ödeme yapanlar' kapalı / açık.
2. Tarih Aralığı: iki gün boş; yalnız başlangıç; yalnız bitiş; başlangıç bitişten sonra (elle yazılarak — min / max atlatılır); geçerli aralık.
   Her birinde: ekrandaki satırlar, Tahsilat kartının dönem metni, PDF ve Excel bağlantısının dönem / paid değeri, 'Tümüne WhatsApp' var mı.
3. 'Ödeme yapanlar' açıkken aralık eksikken kutunun işareti kaldırılır / yeniden konur (bekleyen değişiklik); sonra günler seçilir.
4. Aralık eksikken başka süzgeç değişir (grup, tür, arama, bakiye, durum sekmesi) → yeniden yükleme hangi dönemle?
5. Aralık eksikken Grup Özeti'ne geçip dönmek (Liste ↔ Grup Özeti); hiç uygulanmış dönem yokken (Yok → Tarih Aralığı) Grup Özeti'ne geçmek.
6. Pencereyi kapatıp yeniden açmak (görünüm modül içinde kalır); sayfa yenileme (her şey varsayılana döner).
7. Toplu WhatsApp ekstre / mesaj: seçim yok (Tümüne), tek tek seçim, başlık kutusu ('Hepsini seç' — Daha Fazla Göster varken), 'Hepsi eksi birkaçı'.
8. PDF / Yazdır / Excel (Liste ve Grup Özeti) her durumda ekranla aynı dönem.
9. Arka plan yenilemesi (başka bilgisayardan değişiklik) aralık eksikken: hangi dönemle?
10. Klavye: dönem seçicide Tab + ok tuşlarıyla seçim, tarih kutularına yazma (ders 12).
11. Grup Özeti 'Diğer' sütunu (POS Komisyon İadesi / Kredi Kartına İade): değer varken sütun ve TOPLAM; 'Diğer' sınıfı kapatılınca test kırmızı olmalı.

## 1. DEĞİŞEN GÖZLENEBİLİR DAVRANIŞ (önce → sonra)

Cari penceresi → Liste, 'Tahsilat Dönemi: Bugün' + 'Bu Dönemde Ödeme Yapanlar' işaretli (3 aktif cari; bugün ödeyen 2: Can, Elif), sonra dönem 'Tarih Aralığı'na
çevrilir, günler seçilmez:

| | ÖNCE (taban bb6be861) | SONRA |
|---|---|---|
| Ekrandaki satırlar | Can, Elif (Bugün'ün ödeyenleri; seçici 'Tarih Aralığı' derken açıklama yok) | Can, Elif — AYNI, ama açıkça yazılı: "Başlangıç ve bitiş günlerini seçin. Seçim tamamlanana kadar ekran, PDF ve Excel: Bugün · 28.11.2026 · Bu Dönemde Ödeme Yapanlar." |
| 'Tümüne WhatsApp Ekstre / Mesaj' | GÖRÜNÜYOR ("Süzgeçteki 2 cariye ekstre") | YOK (kutu işaretliyken hiç görünmez — karar (5)) |
| Tıklanınca giden istek | `{all:true, status:"active", …}` dönem / süzgeç YOK → pencere "3 Cari" (Deniz dahil, ödemesi yok) | düğme yok; başlık kutusu (Space) yalnız ekrandaki 2 cariyi seçer → istek `ids:[Can, Elif]`, pencere "2 Cari" |
| PDF / Excel bağlantısı | dönemsiz (period / paid yok) → dosyada 3 cari (Deniz dahil) | `period=today&paid=1` → dosyada 2 cari (= ekran) |
| Grup Özeti'ne geçince | kart "Bugün", PDF / Excel dönemsiz | kart, PDF, Excel üçü de Bugün |
| Başlangıç > bitiş (elle yazılırsa) | açıklama yok; ekran 3 cari (dönemsiz) | "Başlangıç tarihi bitiş tarihinden sonra olamaz. Seçim tamamlanana kadar …: Bugün …"; ekran 2 cari; Tümüne yok |
| Geçerli aralık seçilince | aralıkla yüklenir | aynı; açıklama kalkar; PDF / Excel `period=range&from&to&paid=1` |

SEÇİM 1 (gerekçe): "son geçerli dönemle tutarlı kalır" — liste boşaltılmadı. (a) kullanıcı gün seçerken ekran boşalmaz; (b) ekranın gösterdiği dönem Tahsilat
kartında zaten yazılı, bekleyen seçim satırı bunu açıkça tekrarlar; (c) tek "uygulanan dönem" durumu ekranı, PDF'i, Excel'i, Grup Özeti'ni ve arka plan yenilemesini
AYNI koşula bağlar (ders 11); boşaltma seçeneğinde PDF / Excel ayrıca kapatılmalıydı. Aynı kök 'ödeme yapanlar' KAPALIYKEN de ekran (Bugün tahsilat sütunu) ≠ PDF
(dönemsiz) yapıyordu — o da düzeldi.
SEÇİM 2: toplu WhatsApp için "düğme hiç görünmez" — WhatsApp hedef ucuna süzgeç / dönem TAŞINMADI, gönderim çekirdeğine ve hedef ucuna dokunulmadı. 'Ödeme yapanlar'
kutusu işaretliyken YA DA ekrandaki liste bu süzgeçle yüklenmişken toplu seçim yalnız tek tek işaretlenenlerle (başlık kutusu ekrandakileri seçer).

## 2. DEĞİŞEN DOSYALAR
- `client/assets/hof-accounts.js` — 'uygulanan dönem' (applied) + syncApplied (yalnız taze Liste / Grup Özeti yüklemesinde; Daha Fazla ve arka plan yenilemesi
  ekrandaki dönemle sürer), periodParams uygulanan dönemden, explicitOnly = kutu işaretli || uygulanan paid, bekleyen seçim yazısı (data-period-pending).
- `test/e2e/senaryo-mi2-251.mjs` — kalıcı adım 5b (DK-PROBE + PDF / Excel içeriği, toplu istek gövdesi, Grup Özeti, başlangıç > bitiş, geçerli aralık).
- `test/mi2-grup-ozeti-251.test.mjs` — son test: 'Diğer' (Kredi Kartına İade 45).
- Sunucu, WhatsApp çekirdeği / hedef ucu, tek borç sırası, defter rotası, Rapor Merkezi, ci.yml, package.json, tools: DOKUNULMADI.

## 3. TARAMA (ders 10 — `git grep`)
| Değişen | Çağıran / okuyan | Koşulan |
|---|---|---|
| periodParams / query / groupsQuery / explicitOnly / syncApplied / periodPending | yalnız hof-accounts.js içi (listPdfUrl, listXlsxUrl, groupPdfUrl, groupXlsxUrl, loadListOnce, loadGroups, selectBar, renderList, başlık kutusu) | senaryo-mi2-251 (iki TZ) |
| hof-accounts.js kaynağını okuyan birim testleri | kalan-metin-246, tyk-birlesik8-ekranlar-250, uiux-244-ux9 (+ yazim-duzeni, disa-aktarim-dugmeleri, liste-kapisi-daha-fazla, form-izolasyon) | komşu birim 83 / 83 iki TZ |
| toplu WhatsApp (waStatement / data-select-all) ekran senaryoları (CI listesinde) | senaryo-whatsapp-gonder-248, senaryo-222; dönem: senaryo-whatsapp-donem-248 | 189 / 189, 60 / 60, 37 / 37 (UTC) |
| müşteri istekleri tur 1–2 testleri | mi1-taksit-no, mi2-grup-ozeti, mi2-kuyruk-girdisi, mi2-tek-numara + senaryo-mi1-251 / mi2-251 | birim (yukarıda) + mi1 12 / 12, mi2 42 / 42 iki TZ |

## 4. YENİ / DEĞİŞEN TESTLER — kırmızı nedeni (taban) ve yeşil (yeni)
| Test | Taban (bb6be861) UTC / İstanbul | Kırmızı NEDENİ (ileti okundu) | Yeni (f9e0982f) UTC / İstanbul |
|---|---|---|---|
| senaryo-mi2-251 adım 5b | 34 / 43 (9 kırmızı) / 34 / 43 (9 kırmızı) | 'Tümüne WhatsApp' VAR ("Süzgeçteki 2 cariye ekstre"); tıklanınca istek `{"all":true,…,"status":"active"}` dönemsiz, pencere "3 Cari"; PDF / Excel period=yok paid=yok, dosyada Deniz dahil 3 cari; bekleyen yazı yok; Grup Özeti PDF / Excel dönemsiz; başlangıç > bitiş'te ekran 3 cari | 42 / 42 / 42 / 42 |
| mi2-grup-ozeti 'Diğer' testi | 14 / 14 YEŞİL (iki TZ) — beklenen: ürün tabanda doğru, test dişsizdi; dişi M3 mutantıyla gösterildi | — | 14 / 14 (iki TZ) |

Not: eski kod koşularında kanit aracının "commit" alanı çalışma dizininin commit'ini (f9e0982) yazar; kod eski kopyadan (`git worktree add --detach … t251-mi3-taban`,
dosya yoluyla) yüklendi; eski kopyaya yalnız iki yeni test dosyası girdi (ders 51).

## 5. KABUL
- A: §4 (taban kırmızı, nedeni beklenen; yeni yeşil, iki TZ). 'Diğer' testi tabanda yeşil (dişsiz testin düzeltmesi — ürün doğru); diş B'de.
- B: mutantlar 5 / 5 yakalandı (§6).
- C: komşular yeşil (§3).
- D: sayılar değişmez — sunucu kodu değişmedi; mi2-grup-ozeti'nin önceki 13 testi (eşdeğerlik, her süzgeçte satırlar = TOPLAM, PDF / Excel) ve senaryo-mi2'nin önceki
  27 denetimi aynen yeşil (Grup Özeti A 600 / B 900 / Grupsuz 0, TOPLAM 1.500, Excel 1.500).
- E: yeni sorgu yok — yalnız istemci; bekleyen seçimde istek gitmez (tabanla aynı), geçerli seçimde aynı tek istek.

## 6. MUTANT TABLOSU (ayrı kopya /dev/shm; her mutanttan sonra dosya geri alındı)
| Mutant | Değişiklik | Sonuç | Yakalayan |
|---|---|---|---|
| M1 koşul eski | explicitOnly = paid && periodReady() | KIRMIZI | 'Tümüne WhatsApp' VAR; istek all:true, pencere 3 cari |
| M2 PDF dönemsiz | listPdfUrl dönem / paid olmadan | KIRMIZI | PDF period=yok; PDF'te 3 cari |
| M3 'Diğer' kapalı | account-collections: Kredi Kartına İade yolu POS'a | KIRMIZI | mi2-grup-ozeti test 14 |
| M4 bekleme yok | syncApplied bekleyen aralığı da uygular | KIRMIZI | Grup Özeti Excel / PDF period=range (boş gün); başlangıç > bitiş'te ekran boş |
| M5 bekleyen yazı yok | yalnız "günleri seçin" (görünen dönem yazılmaz) | KIRMIZI | "bekleyen seçim açıkça yazılı" |

M1–M4 8824da16 kopyasında; M5 son metinle (f9e0982f) yeniden koşuldu (ilk koşu da kırmızı). Ham çıktı docs/kanit/2026-11-28/mi3-mutant/.

## 7. HIZ
Yeni sorgu / istek yok (E); ölçüm gerekmedi.

## KULLANICIYA SORULMALI
Yok.

## BAŞ MİMAR KARARI GEREKİYOR
Yok. (Bilgi: iki seçim §1'de gerekçesiyle — "son geçerli dönemle tutarlı" ve "düğme hiç görünmez"; değiştirilmek istenirse küçük iş.)

## SONRAKİ SÜRÜME (20.11 kuralı)
- 'Diğer'in öbür kaynağı POS Komisyon İadesi (banka kaynaklı satır) testte değer olarak girmedi (POS gün sonu akışı kurmak gerekir); sınıf aynı koşulla 'Diğer'e gidiyor,
  M3 Kredi Kartına İade koluyla yakalandı. Yalnız test kapsamı.
- Dönem seçicide ok tuşlarıyla inmek (Chromium) aradaki her dönemi (Dün, Bu Hafta, Bu Ay) sırayla UYGULAR — her biri bir yükleme; tabanla aynı, doğru (son uygulanan
  dönem yazılı). Ekran senaryosu bu yüzden 'Tarih Aralığı'nı doğrudan seçer.
- Kutu işaretli ama uygulanan dönem hiç yokken (Yok → Tarih Aralığı → kutu) ekran dönemsiz tüm carileri gösterir, Tümüne gizli (karar (5) harfiyen); senaryoda ayrıca
  denetlenmedi (explicitOnly'nin kutu kolu için öldürülmemiş mutant olası).

## DOĞRULANMADI
- Windows'ta ekran senaryosu (CI e2e Linux'ta); dosyaya dokunan yeni test yok.

## DENENMEYEN
- Pencereyi kapatıp açma ve arka plan yenilemesi bekleyen seçimdeyken — kod okundu (arka plan yenilemesi syncApplied çağırmaz, uygulanan dönemle sürer), koşulmadı.
  Sayfa yenileme: durum varsayılana döner (modül içi).
- Tam `npm test` (ana oturum koşar); mi1 / mi2 dışındaki e2e'ler İstanbul TZ'de.
- 'Daha Fazla Göster' varken (300+ ödeyen) başlık kutusu — kod: explicitOnly'de selectAll kurulmaz (tabanla aynı kural).

## CI LİSTESİNE EKLENECEK
Yeni senaryo dosyası yok (senaryo-mi2-251 zaten listede, genişledi).

## KILAVUZ METNİ ÖNERİSİ (Cari → Tahsilat Dönemi)
"Tarih Aralığı'nı seçtiğinizde başlangıç ve bitiş günlerini seçene kadar liste, PDF ve Excel bir önceki dönemi gösterir; hangi dönemin göründüğü seçicinin altında yazar.
'Bu Dönemde Ödeme Yapanlar' işaretliyken WhatsApp toplu gönderimi yalnız işaretlediğiniz carilere yapılır; başlıktaki kutu ekrandaki carilerin hepsini seçer."

## COMMIT'LER (taban t251-mi3-taban = bb6be861)
f037508f 'nasıl bozulur' · f86a0624 düzeltme + adım 5b · 8824da16 'Diğer' testi · f9e0982f bekleyen yazı tarafsız · a4e45d62 Kanıt · bu rapor commit'i (dal ucu).

## ANA OTURUMUN YENİDEN KOŞACAĞI KOMUTLAR
```
TZ=UTC HUKUK_LICENSE_URL=http://127.0.0.1:9 node tools/kanit.mjs kos mi3-senaryo-mi2-yeni-utc -- npm run test:senaryo-mi2-251    # 42/42 (İstanbul da)
TZ=UTC HUKUK_LICENSE_URL=http://127.0.0.1:9 node tools/kanit.mjs kos mi3-grup-ozeti -- node --test test/mi2-grup-ozeti-251.test.mjs  # 14/14
# eski kod: git worktree add --detach <kopya> t251-mi3-taban; iki yeni test dosyasını kopyaya koy, kopyanın dosyasıyla koş → senaryo 34/43 (9 kırmızı, nedenleri §4)
# mutantlar: docs/kanit/2026-11-28/mi3-betik/mutant.py (kopyada, adla tek tek); komşular: docs/kanit/2026-11-28/mi3-betik/komsu.sh
```
