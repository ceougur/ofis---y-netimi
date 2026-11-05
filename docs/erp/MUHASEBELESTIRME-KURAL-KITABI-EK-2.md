# Muhasebeleştirme Kural Kitabı — EK-2: Kâhinin ve Hesap Planı İncelemesinin Açık Kural Soruları (DestekOfis 2.5.0)

> **Bu ek programın kodu görülmeden yazıldı.** Kaynak: kural kitabı (`docs/erp/MUHASEBELESTIRME-KURAL-KITABI.md`), EK-1 (`…-EK-1.md`), `docs/erp/MUHASEBE-CEKIRDEGI-PLANI.md`,
> `docs/devir/DEVIR-PLANI.md`, `docs/2.5.0-IS-LISTESI.md` (A, C, D), önceden yazılmış karar metinleri (`docs/2.3.0-SUPHELI-KABUL.md`, `docs/BANKA-MODULU-PLAN.md` §3.8 ve §3.11b,
> `docs/GECMIS-KARARLAR.md`, `docs/2.2.0-IS-LISTESI.md` madde 1.3), kullanım kılavuzu, `CLAUDE.md`, görev tanımı `docs/erp/MALI-MUSAVIR-AJANI.md`; ana oturumun 40 soruluk listesi (23–40).

Durum: TASLAK. Mali müşavir ajanı (kodu görmeyen), 05.11.2026 ~21:00 UTC. Baş mimar inceler.

Bağlayıcılık (kitap §0, ders 40, 43; EK-1 ile aynı):
- **TÜRETİLDİ**: kullanıcı kararından, önceden yazılmış karar metninden ya da kitabın / EK-1'in açık hükmünden çıkar; baş mimar kitaba işler, BAŞ MİMAR KARARI olarak kullanıcıya GÖSTERİLİR (§3).
- **SINIFLAMA / SUNUM**: net kârı, kişinin borcunu ve "kime kaç kez" sonucunu değiştirmez (kitap §9: baş mimar + mali müşavir).
- **SORU**: para, kapama sırası, gecikmiş tanımı ya da kime hatırlatma gideceğini değiştirir → kullanıcı yanıtlayana kadar kâhin İKİ DALLI; seçilmeyen dal kanıt sayılmaz (§5).

Bağımsızlık beyanı: `server/`, `client/`, `test/`, `tools/`, `bulut/`, `docs/kanit/`, başka ajanların çalışma ağaçları, kâhin kodu ve git geçmişi / farkı açılmadı.
Okunan: `CLAUDE.md` (oturumla yüklendi), görev tanımı, kitap, EK-1, çekirdek planı, DEVIR-PLANI (G bölümü, §4, §11, G14), iş listesi satır 1–80 (başlık + A) ve 128–174 (C + D; B ve E okunmadı),
`docs/2.3.0-SUPHELI-KABUL.md`, BANKA-MODULU-PLAN satır 396–404 ve 569–600, `docs/2.2.0-IS-LISTESI.md` satır 10–24, GECMIS-KARARLAR'da arama + satır 308–330, 370–392, 2247–2253, 2358–2386, 2823–2828,
kılavuz HTML'i (metne çevrilip anahtar sözcükle arandı), soru listesi. **Kazara görülen** (kullanılmadı): `docs/` altında bir sözcük araması `docs/DURUM-VE-DEVAM.md:801`, `docs/MIMARI.md:414`,
`docs/TEST-KAPSAMI-2.0.21.md`, `docs/2.0.17-KANIT.md` satırlarını ekrana getirdi (programın kodunu anlatan satırlar); bir başka arama iş listesi E bölümünden bir satırı (334) gösterdi — içeriği soru 37–40'ın
metnini yineliyordu. Bu ekin hiçbir hükmü o satırlara dayanmaz; ana oturum isterse bu temas için bağımsızlığı "kısmen zedelendi" sayıp ilgili maddeleri (24, 32, K-3) yeni ajanla yineletebilir.
Ağ: yalnız arama özetleri; `www.muhasebenews.com` (WebFetch) bu oturumun ağ ayarlarında izinli değil, başka site denenmedi → birincil metin DOĞRULANMADI (§6).

---

## 1. Özet

| Soru | Konu | Sınıf | Sonuç (kısaca) |
|---|---|---|---|
| 23 | TYK: ödeme anında mı, her gün yeniden mi dağıtılır | **SORU (S6)** | Öneri A: işlem günü kuralı (kâhinin ANINDA seçimi, gün içi sıra netleşti) |
| 24 | "Bağlar önce" anında okumada | TÜRETİLDİ (S6-A'ya bağlı) | Önceki bağsız kapama GERİ ALINMAZ; bağ hedefin o günkü kalanını kapatır, fazlası bağsız — kâhinin seçimi DEĞİŞİR |
| 25 | M4 aynı gün sırası | TÜRETİLDİ | EK-1 M4'ün açık sırası geçerli (Önceki Yıl Sonucu → N-01 …); G-4'e Gelir Tablosu dışı ayrı sınıf — kâhinin seçimi değişir (yalnız satır sırası) |
| 26 | 570.Y / 580.Y alt hesabı | SINIFLAMA | 570.YYYY / 580.YYYY önerilir; kâhin ana hesap düzeyinde karşılaştırır; alt hesap yoksa DÜŞÜK (2.5.1) |
| 27 | Devir net kalan satırının vade / tarih / sırası | TÜRETİLDİ | Ekranda K+1, vadesiz; seçim sonucu değiştirmez (yeni değişmez); kâhinin seçimi kabul |
| 28 | Değişmez (4)'ün sınırı | TÜRETİLDİ (24'ün sonucu) | S6-A + 24 ile sınır KALKAR: değişmez (4) istisnasız; elle senaryo yazılır |
| 29 | S3 kapsamı (tutar mı, cari mi) | **SORU (S7)** | Öneri A: cari bazında (açık şüpheli kaydı olan cari otomatik listeye girmez) |
| 30 | K3 + TYK (s52 C3) | TÜRETİLDİ | Modelin 3.000'i önceki kararların zorunlu sonucu (kuyruk muavini izler); sunum notu; S7-A'da otomatik ileti yok |
| 31 | K3 olay dili | TÜRETİLDİ | İşlemler kayıt başınadır → olay dili kaydı açıkça taşır; Hesapsız (Açılıştan Önce) ve Kredi Kartına İade alacak satırıdır → düşer; "vazgeçilen kalan" → K-3 |
| 32 | Kart alttaki borçtan büyük | TÜRETİLDİ | Fark kartın vadesi ilk gelen taksitlerinden düşer (K3 EK yönü); kâhinin seçimi kabul |
| 33 | Kasa açılışını ilk hareketten sonraya düzeltme | TÜRETİLDİ | Düzeltmede de reddedilir (409; aynı gün izinli) — kâhinin seçimi değişir |
| 34 | Kesin Değil "Aralık KDV…" kapsamı | SINIFLAMA | Kapsam kabul (t'nin yılından önceki her mahsupsuz ay); ad "Önceki Yıl KDV Mahsubu Yapılmamış" + ay listesi |
| 35 | Silinen faturanın taksit kartı | TÜRETİLDİ | Faturanın kendi kartı faturayla kalkar; tahsilatı alınmış taksitte silme / iptal engelli (2.0.17 m1) — kâhinin seçimi değişir |
| 36 | 127 alacak bakiyesi | SINIFLAMA | Pasif III.D 340 (kart bazında brüt); 127 kitaba "Diğer Ticari Alacaklar" adıyla girer |
| 37 | Carisiz Kasa girişi: 649 mu 649.90 mı | TÜRETİLDİ | 649.90 (649 grubunda kalır; KG-3 A); GT F altında ayrı satır + dipnot |
| 38 | F-06 varsayılan 770 ↔ M14 770.90 | SINIFLAMA | Belgeli gider varsayılanı 770 (ana hesap); 770.90 yalnız tanınmayan değer ve belgesiz çıkış |
| 39 | 519'un adı | TÜRETİLDİ | Hesap adı "Eşleştirilecek Açılış Bakiyeleri"; "(Geçici)" yalnız Bilanço satır adında |
| 40 | 691'in kapanışı | TÜRETİLDİ (doğrulandı) | 691 692'ye kapanır, 692 = 690 − 691 (kitap N-06) |
| K-1 | EK-1 M1c ↔ kullanıcı kararı F3 / UX18 (karşılıksız evrak) | **SORU (S8)** — kör nokta | Öneri A: evrakın kapattığı kalem yeniden açılır, kendi vadesiyle |
| K-2 | EK-1 §1 ↔ 2.0.17 "kapama yöne göre" (alış faturası, Alacak Yaz) | **SORU (S9)** — kör nokta | Öneri A: gecikmiş tutarında cari neti |
| K-3 | Kartı Kapat "vazgeçilen kalan" ↔ KG-23 A / S1 | **SORU (S10, koşullu)** — kör nokta | Öneri A: kalan borçta kalır |

Sayım (23–40): TÜRETİLDİ 12 (24, 25, 27, 28, 30, 31, 32, 33, 35, 37, 39, 40), SINIFLAMA 4 (26, 34, 36, 38), SORU 2 (23, 29). Ek kör nokta: 3 soru (K-1, K-2, K-3).

---

## 2. Ayrıntı

### Soru 23 — TYK: anında mı, havuz mu → **SORU (S6)**
**İki okuma.** EK-1 §1 adım 4 (satır 63–64) "Bağsız alacak kalemleri **havuzlanır** ve açık borç kalemlerine … S2-A: vade `v` artan …" — t itibarıyla bütün bağsız alacaklar toplanıp bütün borçlara vade sırasıyla
dağıtılır (HAVUZ). Kullanıcının S2 yanıtı (iş listesi D, 18:55) "Vadesi en önce gelen (TBK md. 102)" — TBK 102 mahsubu **ödeme sırasında** yapar (ANINDA). Metinler iki okumaya izin veriyor; sonuç kime
hatırlatma gideceğini değiştiriyor → ders 43 / 45: kullanıcıya.
**Örnek (kâhin s41 C2).** 01.03 fatura F6 40.000 (vade 30.06); 01.04 bağsız ödeme 40.000; 10.05 vadesiz fatura F7 40.000.
ANINDA: ödeme 01.04'te tek açık borç F6'yı kapatır → 11.05'te gecikmiş **40.000** (F7). HAVUZ: ödeme vadesi önce gelen F7'ye kayar, F6'nın vadesi gelmemiş → 11.05'te gecikmiş **0**; 01.07'de 40.000 (F6 için —
müşteri "F6'yı Nisan'da ödedim" der).
**Önerilen A tanımı (işlem günü kuralı; kâhinin ANINDA seçiminin gün içi sırası netleştirildi — ders 31 "sınıf içi sıra toplamları değiştirmez"):** kuyruk tarih sırasıyla kurulur; her gün G için
(1) belge tarihi G olan borç kalemleri açık listeye girer; (2) G tarihli bağlar (S. 24) hedefin o andaki kalanını kapatır; (3) G tarihli bağsız alacaklar, bağların fazlası ve önceden kalan açık alacaklar
açık borçlara S2-A sırasıyla (vade → belge tarihi → giriş sırası) uygulanır; artan açık alacak kalır ve sonraki borç geldiği gün ona uygulanır. Yapılmış dağıtımı DAHA GEÇ tarihli bir borç değiştirmez; geriye
tarihli kayıt girilir / düzeltilir / silinirse kuyruk o günden yeniden kurulur (G-7). gecikmiş(t) = t gününün sonundaki açık borçlardan v < t olanların kalanı (M1f).
**Gerekçe (A).** TBK 101–102: borçlunun beyanı yoksa ödeme, ödeme sırasında muaccel borca, birden çoksa vadesi önce gelene; hiçbiri muaccel değilse en az güvenceli olana mahsup edilir (arama özeti, §6)
— ödeme o an var olmayan borca mahsup edilemez. Sonuç kararlı: geçmiş ödemenin kapattığı belge sonradan değişmez, ileti doğru belgeyi anar. EK-1 M2 değişmezi ("gecikmiş devirle değişmez", BAŞ MİMAR KARARI olarak
kullanıcıya gösterildi) yalnız A'da her durumda sağlanır (devir, K'deki durumu dondurur — A'nın ta kendisi). Yaygın uygulama ikiye ayrılır: Logo'nun otomatik kapaması pencerede görünen bütün hareketleri vade
sırasıyla birbirine kapatır (toplu çalıştırma anındaki havuz; arama özeti) — kapama kaydı saklanır, sonra gelen belge onu değiştirmez; yani sonuç kapamanın ne zaman çalıştırıldığına bağlıdır → GÖRÜŞ.
**B'nin sonucu.** Her rapor gününde yeniden dağıtım; gecikmiş çoğu zaman daha az görünür; M2 değişmezi genel olarak düşer (BAŞ MİMAR KARARI M2 yeniden yazılır: devirden sonra bazı carilerin gecikmiş tutarı
değişebilir); S. 24 konusuz kalır (bağlar tarihten bağımsız önce kapatır).

### Soru 24 — "Bağlar önce" anında okumada → **TÜRETİLDİ (S6-A'ya bağlı)**
**Sonuç.** S6-A seçilirse önceki bağsız kapama **geri alınmaz**: bağ (Kapatılacak Fatura, Mahsup Et, çek / senet bağı, kart tahsilatı, iade bağı) taşıyıcı kaydın gününde hedefin **o günkü kalanını** kapatır;
hedef daha önce bağsız bir ödemeyle kapanmışsa bağın karşılanamayan kısmı bağsızdır ve S. 23 adım (3) ile o gün açık borçlara gider. Hedef taşıyıcıdan sonra doğuyorsa bağ hedefin gününde uygulanır; o güne kadar
bağlı tutar başka borca gitmez. Kullanıcı ilk ödemenin başka belge için olduğunu söylüyorsa yol o ödemeyi düzenleyip bağlamaktır (çıkmaz yok). Kâhinin "geri al" seçimi DEĞİŞİR.
**Dayanak (aynen).** EK-1 §1 adım 3 (satır 61–62): "… kendi hedefini kapatır (**en çok hedefin kalanı kadar**); fazlası bağsız alacak olur." — anında okumada "kalan" bağ anındaki kalandır.
DEVIR-PLANI G2 (satır 53): "KAPANMIŞ ≤K FATURA, K sonrası bir satırdan bağlıysa: bağ arşiv başvurusuna (yıl + belge no) çevrilir." — yıl sınırında kapanmış belgeye sonradan gelen bağ kapamayı geri almıyor;
aynı kuralın yıl içinde de geçerli olması M2'nin ("gecikmiş devirle değişmez", EK-1 §2 M2, kullanıcıya gösterildi) tek tutarlı okumasıdır. TBK 101: beyan ödeme sırasında ve o ödeme için yapılır; önceki ödemenin
mahsubunu değiştirmez (GÖRÜŞ; birincil metin DOĞRULANMADI).
**Not.** S6-B seçilirse bu madde konusuzdur (havuzda bağlar zaten önce kapatır).

### Soru 25 — M4 aynı gün sırası → **TÜRETİLDİ**
**Sonuç.** EK-1 M4'ün açık sırası geçerli: K gününde Önceki Yıl Sonucu Fişleri (eskiden yeniye) → N-01 → N-02 … N-07. Bakiyeler sıradan bağımsızdır; yalnız yevmiye / Büyük Defter satır sırası ve 153'ün ara
bakiyesi değişir. Kâhin G-4 sırasından M4 sırasına geçer.
**Dayanak (aynen).** EK-1 M4 (satır 172): "Aynı gün sıra: Önceki Yıl Sonucu Fişleri (eskiden yeniye) → N-01 → N-02 … N-07. **N-01 tutarı = SMM_(K yılı)** … ('153 bakiyesi − DSS' ancak önceki yıl fişlerinden
SONRA bu tutara eşittir)." Bu, G-4'ün genel kuralına karşı özel hükümdür; kitap §5.2 ("Fark (N-01) = 153'ün K bakiyesi − DSS") ancak bu sırada doğru çalışır.
**Çelişkinin giderilmesi (E13).** M4'teki "kapanış sınıfı" sözünün amacı Gelir Tablosu dışılıktır (kitap §4 satır 327: "kapanış sınıfı maddeleri hariç"). G-4'e ayrı bir sınıf eklenir:
(1) açılış → (2) olağan → (3) **önceki yıl sonucu** (yalnız devir kapanışında, K günü; Gelir Tablosu DIŞI) → (4) dönem sonu → (5) kapanış. Böylece hem M4'ün sırası hem Gelir Tablosu dışılık korunur.

### Soru 26 — 570.Y / 580.Y → **SINIFLAMA**
**Öneri.** Alt hesap yıl koduyla: 570.YYYY "YYYY Yılı Kârı", 580.YYYY "YYYY Yılı Zararı"; Önceki Yıl Sonucu Fişi Y'yi bilir; Açılış Eşleştirme Fişi'nde (M-11) yıl girilmezse 570.0000 / 580.0000
"Yılı Belirtilmemiş". Ana hesap tutarı iki seçenekte aynı.
**Dayanak.** KVK 9: geçmiş yıl zararı beyannamede **her yıla ilişkin tutarlar ayrı ayrı gösterilmek şartıyla** beş yıldan fazla nakledilmeden indirilir (arama özeti; birincil metin DOĞRULANMADI) → yıl
ayrımı vergi takibi için gerekir; uygulamada alt hesap yıl bazında açılır (örnek "580 01 2015 Yılı Zararı" — muhasebetr, arama özeti) → GÖRÜŞ (iki program belgesi yok). Not: bilançodaki 580 ile beyannamedeki
indirilecek zarar aynı şey değildir (aynı kaynak) — program mahsup önermez (EK-1 M4).
**Kâhin.** Ana hesap düzeyinde karşılaştırır; program alt hesap üretiyorsa ek denetim: Σ 570.Y = 570, her 570.Y = R_Y (580 aynı). Alt hesap 2.5.0'da yoksa DÜŞÜK → 2.5.1.

### Soru 27 — Devir net kalan satırı → **TÜRETİLDİ**
**Sonuç.** Yeni yıl dosyasında satır tarihi K+1, açılış sınıfı, vadesiz (ekranda Vade boş). Kâhinin iç seçimi (birleştirilen en eski açık alacağın tarih / vade / sırası) KABUL: sonuç değiştirmez — S6-A'da
(S9-A ile) bir caride aynı anda açık borç kalemi ile açık alacak kalemi bulunmaz; net alacak, K'den sonraki her borçtan önce sıralanır, hangi iç tarihle olursa olsun aynı borçlara aynı günde uygulanır.
**Dayanak (aynen).** EK-1 M2 (satır 143–144): "Net açılış satırı yalnız kalanı taşır: K'de açık ALACAK (avans, fazla ödeme) ya da kartların karşıladığı kısım — ikisi de gecikmiş hesabına borç kalemi olarak
girmez, **vadesi önemsizdir**." EK-1 M12 (satır 286): "Satır tarihi **K+1** (01.01)."
**Koşul.** S9-B seçilirse (ters yöndeki belge yalnız Mahsup Et ile kapanır) açık borç ve açık alacak aynı anda bulunabilir; o zaman net alacak satırı türüne göre ikiye ayrılır (tahsilat niteliğinde / Mahsup Et
bekleyen) — yoksa değişmez (4) bozulur.
**Kâhin.** Yeni değişmez §4-4.

### Soru 28 — Değişmez (4)'ün sınırı → **TÜRETİLDİ (S. 24'ün sonucu)**
**Sonuç.** S6-A + S. 24 ("geri alma yok") ile sınır KALKAR: K sonrası bağ, K'de bağsız kapanmış ≤K kaleme yönelirse devirsiz dosyada da fazlası bağsız olur — devirli dosyadaki G2 "arşiv başvurusu" ile aynı sonuç.
Borç yönlü bağda (alış faturasına bağlı ödeme, Mahsup Et) eski vadeli bir kalemin yeniden açılması da olmaz → vade ayrışması yok. Değişmez (4) istisnasız: her t ≥ K+1 için gecikmiş(t) ve açık kalem (vade,
kalan) listesi devirli = devirsiz. BİLİNEN SINIR kaydı silinir; elle senaryo yazılır (alacak yönlü ve borç yönlü birer, ≤K bağsız kapanmış hedef + K sonrası bağ).
**Dayanak.** S. 24 + DEVIR-PLANI G2 (satır 53) + EK-1 M2 değişmezi (satır 145). S6-B seçilirse değişmez (4) genel olarak geçerli değildir (S. 23 "B'nin sonucu").

### Soru 29 — S3 kapsamı → **SORU (S7)**
**İki okuma.** S3 sorusu (EK-1 §5) "Şüpheli alacağa alınmış **borç** otomatik Ödeme Hatırlatma'ya girsin mi?" → kullanıcı "Hayır, elle seçilebilir" — tutar okuması. EK-1 M13'ün gerekçesi (satır 308–309):
"otomatik Ödeme Hatırlatma'ya GİRMEZ (**dava / icra safhasında borçluyla iletişim hukuki süreçten yürür**); hatırlatma ekranında '**Şüpheli alacağı var**' etiketiyle elle seçilebilir" — kişi (cari) okuması.
Kime hatırlatma gideceği değişir → ders 45.
**Örnek (kâhin s42 h1).** Müşteri: 4.000 icrada (şüpheli kaydı açık); ayrıca vadesi geçmiş yeni fatura 3.000. Tutar bazında: otomatik ileti 3.000 ile gider. Cari bazında: otomatik ileti gitmez; ekranda
"Şüpheli Alacağı Var" etiketiyle görünür, elle seçilirse 3.000 yazar.
**Öneri A (cari bazında).** Gerekçe: VUK 323 şüpheli alacak için dava ya da icra safhasını arar (kitap §10; DOĞRULANMADI) — borçlu bu aşamada avukat / icra dairesi aracılığıyla muhatap alınır; aynı borçluya
kendiliğinden giden "gecikmiş borcunuz var" iletisi hukuki süreçle çelişebilir ve borçlu toplam borcu bildiği için yalnız CH kısmını anan tutar kafa karıştırır. "Kime kaç kez" ilke 2'nin ruhu: kuşkuda
kendiliğinden gönderme yok; ilke 4: elle seçim yolu açık (çıkmaz yok). Ek gerekçe: B'de S. 30'daki durum (taksitini ödeyen müşteri, para 2.3.0 kuralıyla şüpheli alacaktan düştüğü için hatırlatma alır) otomatik
iletiye dönüşür. "Açık şüpheli kaydı" = kalanı > 0 olan kayıt; Şüpheliden Çıkar / tam tahsil / Değersiz Alacak'tan sonra cari otomatik listeye döner.

### Soru 30 — K3 + TYK birleşimi (s52 C3) → **TÜRETİLDİ**
**Sonuç.** Modelin sonucu (kapsayan kartın taksit tahsilatı şüpheliden düşünce CH'deki taksit açık kalır, CH gecikmişi 3.000) önceki kararların zorunlu sonucudur ve KABUL. Para kuralı 2.3.0'da verilmiş: kapsayan
kartın tahsilatı defterde önce 128'i kapatır, yani müşterinin ödemesi dava / icradaki borca sayılır; CH (120) borcu azalmaz. Kuyruk muavini izler: CH kuyruğunun açık toplamı CH bakiyesine, şüpheli kuyruğunun
açık toplamı 128'e eşittir; 128'e düşen tahsilat CH kuyruğunu kapatamaz. EK-1 M1e'deki "kart tahsilatı önce o kartın vadesi ilk gelen taksitini kapatır" cümlesi CH kuyruğunda yalnız parası 120'ye düşen
kart tahsilatı için geçerlidir (E-madde E23).
**Dayanak (aynen).** 2.3.0 kabul §1 K3 EK (satır 13): "'Mevcut borcu taksitlendir' (kapsayan) kartı yeni alacak getirmediğinden tarih kapısına girmez, **taksiti her zaman düşer**". BANKA-MODULU-PLAN §3.11b/2
(satır 592): "Hiçbir seçim cari bakiyesini (120 + 128) değiştirmez; yalnız 120/128 ayrımıdır." EK-1 M13 (satır 307): "CH açılışı + Σ CH açık kalemleri = CH bakiyesi (128 hariç)". Kılavuz (Taksit): "Carinin
Mevcut Borcu (tutar bakiyeden gelir)" — kart şüpheli kısmı da kapsar.
**Sunum (SINIFLAMA).** Kart ekranında taksit "Ödendi (Şüpheli Alacaktan Düşüldü)"; cari kartında "Gecikmiş 3.000 · Şüpheli X" ayrı; elle gönderilen iletide taksit numarası değil tutar. S7-A'da bu cari
otomatik listeye zaten girmez. Bu sonuç istenmiyorsa değişecek olan 15.10.2026 para kuralıdır (yeni para kuralı → 2.5.0 kapsamı dışı, kullanıcıya ayrıca).

### Soru 31 — K3 olay dili → **TÜRETİLDİ**
**Sonuç.** (a) Karşılık Ayır, Değersiz Alacak Yaz ve Şüpheliden Çıkar **kayıt başına** işlemlerdir: olay dili kaydı açıkça taşır; üreteç rastgele bir kayıt seçerse onu olaya YAZAR, aynı kimlik programa ve modele
gider. Modelin kayıtsız varsayılanları (karşılıkta en eski yeri olan kayıt; değersiz / çıkarda bütün açık kayıtlar) kural değildir, kaldırılır. (b) "Hesapsız (Açılıştan Önce)" tahsilatı ve Kredi Kartına İade
(T-11) carinin ALACAK satırıdır → kayıt tarihinden sonraysa ve istisnalardan biri değilse şüpheliden düşer — kâhinin seçimi KABUL. (c) "Kapatılan kartın vazgeçilen kalanı": kitap KG-23 A'da madde yok
→ uygulanmaması tutarlı; ancak önceden yazılmış metinler bu satırı VAR sayıyor → K-3.
**Dayanak (aynen).** 2.3.0 kabul §1 K4 "o kayda ayrılmış karşılık", K5 "**kayıt başına** toplam karşılık ≤ o kaydın kalan şüpheli tutarı", senaryo U "çıkarılmış kayda değersiz → 409 doubtful-closed"; kılavuz
"Karşılık Ayır: **kayıt satırında**". K3 (satır 13): "Carinin alacak satırı (tahsilat, alınan evrak, Alacak Yaz, iade faturası, taksit tahsilatı, kapatılan kartın vazgeçilen kalanı) … Plan 'tahsilat' der;
**her alacak satırı için aynı kural seçildi**". Kitap K-14 ("CH (tahsilatta)") ve T-11 ("309.NN / CH") alacak satırı yazar.

### Soru 32 — Kart alttaki borçtan büyük → **TÜRETİLDİ**
**Sonuç.** Modelin seçimi KABUL: fark (kart − tükettiği kalem) ayrı alacak kalemi olur ve S2 sırasıyla kartın vadesi İLK gelen taksitlerinden düşer; Σ açık − Σ açık alacak = CH korunur.
**Dayanak.** Kılavuz (Taksit): "Carinin Mevcut Borcu (**tutar bakiyeden gelir**). Borç ikinci kez yazılmaz … **tutarı sonradan büyütülmez**"; "Borçtan düşülen iade, faturayı taksitlendiren kartı … o kadar
küçültür". Kartın borçtan büyük olmasının olağan yolu, bakiyenin (120 + 128) şüpheli kısmıdır: kart CH kuyruğunda yalnız CH kalemlerini tüketebilir, fark = şüpheli kısım. K3 EK bu kartın taksit tahsilatını önce
128'den düşürür (S. 30) → kartın İLK taksitleri şüpheli kısma karşılık gelir; farkı baştan düşmek bu yönle tutarlıdır (sondan düşülseydi ilk taksitin parası 128'e giderken CH'de aynı taksit gecikmiş görünürdü).
Öteki yollar (düzeltme / silmeyle küçülen borç; Mevcut Borç kartının kapsadığı faturanın silinmesi, S. 35) aynı kuralla — kuşkuda gecikmişi az gösteren yön (ilke 2'nin ruhu). Ayrışma görülürse önce hata (ders 6).

### Soru 33 — Kasa açılışının ilk hareketten sonraya düzeltilmesi → **TÜRETİLDİ**
**Sonuç.** Düzeltmede de geçerli: yeni açılış tarihi ilk nakit hareketinin tarihinden SONRA olamaz → reddedilir (409), hiçbir şey yazılmaz; aynı gün izinli (açılış sınıfı günün başı, G-4); öne alma serbest
(s53). Kâhinin "reddetmez" seçimi DEĞİŞİR.
**Dayanak (aynen).** `docs/2.2.0-IS-LISTESI.md` madde 1.3: "Kasa → Açılış Bakiyesi (yalnız yönetici, bir kez, **ilk hareketten önce, düzeltilir**, kilide uyar)" — kural "düzeltilir" ile birlikte yazılmış.
BANKA-MODULU-PLAN §3.8 (satır 402), aynı karşı hesaplı banka açılışı: "'Açılışı Düzelt' = ters + yeni. **Yeni tarih hesaba bağlı ilk hareketten sonra olamaz** (409 `bank-opening-after-first`)."
Kılavuz (Banka): "Açılış Tarihi ve **o günün başındaki** bakiye". Muhasebe gerekçesi: açılış dönemin ilk kaydıdır; sonraya alınırsa önceki hareketler açılışsız kasadan yapılmış olur (eksi kasa → Kesin Değil).

### Soru 34 — Kesin Değil "ARALIK_KDV_MAHSUBU_YAPILMAMIS" → **SINIFLAMA**
**Öneri.** Kapsam KABUL: t'nin yılından önceki HER ay için, o aya etiketli 191 ya da 391 bakiyesi ≠ 0 ise Kesin Değil (devirli de devirsiz de). Ad nötr: "Önceki Yıl KDV Mahsubu Yapılmamış" + ay listesi
(ör. "Mayıs 2025, Aralık 2025"). t'nin yılındaki biten aylar Kesin Değil DEĞİL, kitap §7.3'teki bilgi uyarısı.
**Dayanak.** EK-1 M8 (4) (satır 232): "Dönemi ≤ Aralık olan 191 / 391 açılışları yeni yılın HİÇBİR mahsubuna girmez; Bilanço'da brüt görünür + Kesin Değil 'Aralık KDV Mahsubu Yapılmamış'" — devirde
Aralık'ın tipik durumu; aynı mantık önceki yılın her mahsupsuz ayı için geçerli (o ayların beyannamesi verilmiş, defter beyannameyle ayrışır). Kitap §7.3 (satır 371): "biten ay mahsupsuzsa bilgi uyarısı" —
cari yıl için. Net kâr, borç ve özkaynak değişmez (191 ve 391 birlikte brüt) → sunum.

### Soru 35 — Silinen faturaya bağlı taksit kartı → **TÜRETİLDİ**
**Sonuç.** Faturanın KENDİ taksit kartı (H-01: fatura ödemesi Taksit / Bu Satışı Taksitlendir) fatura silinince ya da iptal edilince faturayla birlikte kalkar: taksitleri kuyruktan çıkar, kart_fark doğmaz.
Tahsilatı alınmış taksiti olan kartın faturası silinemez / iptal edilemez → kâhin başarı beklemez, engel bekler (hiçbir şey yazılmaz). Faturayı kapsayan Mevcut Borç kartı için yazılı karar yok → S. 32
kuralı (fark kalemi). Kâhinin seçimi DEĞİŞİR.
**Dayanak (aynen).** GECMIS-KARARLAR 2.0.17 madde 1 (satır 318–321): "kaydedilmiş belge silinirken tek işlemde iptaldeki gibi **bütün etkiler geri alınır (stok, cari, Kasa, taksit, çek/senet**; mutabakat
kapısı) … Engeller iptalle aynı (… **tahsilatı alınmış taksit** / işlem görmüş çek)."

### Soru 36 — 127 alacak bakiyesi → **SINIFLAMA**
**Öneri.** Alacaklı 127 (fazla tahsil edilmiş carisiz kart) Bilanço'da Pasif III.D **340 Alınan Sipariş Avansları**; brütleştirme kart bazında (cari yok), netleştirme yok (kitap §7.3). Kitap §2'ye 127 eklenir
(E14): ana hesap adı Tek Düzen adıyla "Diğer Ticari Alacaklar" (770'in Tek Düzen adına dönmesiyle aynı ilke, çekirdek §2), "Carisiz Taksit Kartları" alt hesap / açıklama; kalem I.C Ticari Alacaklar.
Net kâr ve borç değişmez.
**Dayanak.** Kitap §7.3 (satır 369): "alacaklı 120 cari → Pasif III.D 340" — 127 aynı Ticari Alacaklar grubunda. Yaygın uygulama: dönem sonunda ters bakiyeli ticari alacak / borç hesapları 159 / 340'a
virmanlanır (Logo "Ters Bakiyeli Hesap Kontrolü" ve Netsis belgeleri; muhasebetr — arama özeti) → GÖRÜŞ (iki ayrı ürün belgesi aynı üreticiden). Seçenek: fazla tahsilat iade edilecekse 336 Diğer Çeşitli
Borçlar — önerilmez (120 ile tutarlılık; program iade niyetini bilmez).

### Soru 37 — Carisiz Kasa girişi 649 mu 649.90 mı → **TÜRETİLDİ**
**Sonuç.** **649.90** "Sınıflandırılmamış" (ana hesap 649 grubunda kalır); Gelir Tablosu F altında "Sınıflandırılmamış Kasa Gelirleri" alt satırı + §7.5 (6) dipnotu.
**Dayanak (aynen).** Kullanıcı kararı (iş listesi D, 17:16): "(3) KG-3 kayıt (dosya) tahsilatı gelir değil → 'Sınıflandırılmamış Tahsilatlar' (**carisiz Kasa girişi 649'da kalır**)" — "kalır" = 336.90'a
gitmez, gelir grubu 649'da kalır. Kitap KG-3 (satır 398): Seçenek A "**649.90** Sınıflandırılmamış Gelir"; öneri "… Kasa + Tahsilat **A**". K-01 (satır 173): "KG-3 (öneri 649.90)". G-8 (satır 54–55): eşlemesi
kesin olmayan olay "SINIFLANDIRILMAMIŞ alt hesabıyla … ayrı satır / dipnotla". Simetri: çekirdek §13 (satır 150) carisiz Kasa çıkışı "770.90 Sınıflandırılmamış" + ayrı satır + dipnot (KABUL).

### Soru 38 — F-06 "varsayılan 770" ↔ EK-1 M14 "770.90" → **SINIFLAMA**
**Öneri.** Belgeli gider alışında (F-06, F-11) gider türü boş ya da formun varsayılanı ise **770** (ana hesap, Genel Yönetim Giderleri); 770.90 yalnız (a) eşlemede olmayan / tanınmayan gider türü değeri
(eski sürüm verisi, bozuk değer) ve (b) belgesiz, niteliği bilinmeyen çıkışlar (K-02 carisiz Kasa çıkışı, KG-4 Alacak Yaz) için. İkisi de GT E 632'de; net kâr aynı.
**Gerekçe.** G-8 ".90" alt hesabı "hesap eşlemesi kesin olmayan olay" içindir; faturalı gider alışının niteliği (gider) bellidir, yalnız alt türü varsayılan Genel Yönetim'dir — yaygın programlarda masraf / hizmet
kartının varsayılan muhasebe hesabı 770'tir (GÖRÜŞ; program belgesi açılamadı). Kasa çıkışı ise demirbaş, ortak çekişi, borç ödemesi olabilir (kitap §7.5 (3)) — .90 orada gerekli. EK-1 M14'teki
"seçilmemiş ya da tanınmayan" ifadesi daraltılır (E17).

### Soru 39 — 519'un adı → **TÜRETİLDİ**
**Sonuç.** Hesap adı **"Eşleştirilecek Açılış Bakiyeleri"** ("(Geçici)" eki YOK); Bilanço V. Özkaynaklar sonundaki satır adı "Eşleştirilecek Açılış Bakiyeleri (Geçici)" + Kesin Değil "Tamamlanmamış Açılış".
**Dayanak (aynen).** Çekirdek §13 KABUL (satır 144): "Geçici açılış hesabı kodu 519 **'Eşleştirilecek Açılış Bakiyeleri'** … Bilanço'da Özkaynaklar sonunda **uyarılı satır**." Kitap §7.2 (satır 365–366):
"G 'Eşleştirilecek Açılış Bakiyeleri (Geçici)'" — Bilanço kalemi. Tek Düzen hesap adlarında parantezli nitelik yalnız düzenleyici "(−)" içindir. Kitap §2 satır 93'teki "Ad" sütunu düzeltilir (E15).

### Soru 40 — 691'in kapanışı → **TÜRETİLDİ (doğrulandı)**
**Sonuç.** 691 kapanışta **692'ye** kapanır: kârda B 690 / A 691 / A 692 (692 = 690 − 691); zararda B 692 / A 690 ve (691 ≠ 0 ise) B 692 / A 691; ardından 692 → 590 / 591. 691 N-04'teki 690'a devredilen
hesaplar arasında DEĞİLDİR. KG-13 A'da 691 = 0 olduğundan D4'teki ayrı test 691 ≠ 0 verisiyle yapılır.
**Dayanak (aynen).** Kitap N-06 (satır 301): "690 → 692 (**691 varsa o da**) … 690 bakiyesi; **691 varsa B 692 / A 691**"; N-04 (satır 299) yalnız 60x–68x'i 690'a devreder. Doğrulama: muhasebenews örneği
"690 1.000.000 borç, 691 120.000 alacak, 692 880.000 alacak; 692 → 590" ve muhasebetr "690 ile 691'in karşılıklı kapatılmasından bulunan fark 692'ye" (arama özetleri; MSUGT birincil metni DOĞRULANMADI).

### K-1 — EK-1 M1c ↔ kullanıcı kararı F3 / UX18 (karşılıksız evrak) → **SORU (S8)** — kör nokta
**Çelişki.** EK-1 M1c (satır 108–109): "Ç-07 ayrı bir borç kalemi … vade = aynı gün … Evrakla kapanmış fatura **YENİDEN AÇILMAZ**". Önceden yazılmış kullanıcı kararları (EK-1 yazılırken okunmamıştı):
UX18 (GECMIS-KARARLAR satır 2250): "karşılıksız dönünce fatura yeniden açılır"; F3 (satır 2379–2381, kullanıcı 22.10.2026): "**BAĞSIZ evrak karşılıksız dönünce kapattığı faturalar da yeniden açılır (kalan
ödemeler en eski açıktan yeniden dağılır; cari bakiye ve yevmiye değişmez; taksitli değişmez)**"; kılavuz (Çek / Senet): "Karşılıksız / İade (müşteri yeniden borçlanır; **evrakın kapattığı fatura yeniden
açılır**)". S1'in soru metni "karşılıksız çıkan çek / senet"i M1c'nin modeliyle vadesiz borç diye saymıştı. Fark: açılan borcun vadesi (faturanınki mi, karşılıksız günü mü) → gecikmiş tarihi değişir.
**Örnek.** Fatura 01.03, vade 30.06, 20.000; 05.03 çekle ödendi; çek 02.05'te karşılıksız. A: fatura yeniden açılır, vadesi 30.06 → 01.07'ye kadar gecikmiş değil. B: ayrı borç kalemi, vade 02.05 → 03.05'ten
itibaren 20.000 gecikmiş. (Fatura vadesizse fark bir gündür: A 02.05'te, B 03.05'te gecikmiş.)
**Öneri A.** F3 / UX18'e uy: TYK'da karşılıksız / iade, evrakın alacak kalemini geri alır (Ç-07 ayrı borç kalemi DEĞİL); evrakın kapattığı kalemler kendi vadeleriyle açılır (vadesizse S1: belge günü); öteki bağsız
ödemeler S6 kuralıyla yeniden dağılır. İstisna "taksitli değişmez": evrak taksit kartı tahsilatıysa kart değişmez, borç ayrı kalem (M1c aynen; vade karşılıksız günü, S1). Gerekçe: kullanıcının açık kararı ve
gösterdiği yaygın uygulama (QuickBooks "Record a returned payment or bounced check": ödeme geri alınır, asıl fatura yeniden açılır — arama özeti); fatura ekranı ("Açık") ile gecikmiş aynı belgeyi anar
(değişmez (iii)); asıl borcun vadesi faturanınkidir.

### K-2 — EK-1 §1 ↔ 2.0.17 "kapama yöne göre" → **SORU (S9)** — kör nokta
**Çelişki.** EK-1 §1 adım 1 ve 4 (satır 56, 63): alacak kalemleri "tahsilat …, **Alacak Yaz**, alacaklı açılış, satıştan iade faturası, **alış faturası (aynı caride)** …" havuzda borçlara uygulanır. Kalıcı ürün
kararı (CLAUDE.md "Kalıcı ürün kararları": "fatura kapama **yöne göre** (hayalet kısmi ödeme yok), 'Kapatılacak Fatura' ve 'Mahsup Et' var"; GECMIS-KARARLAR 2.0.17 madde 5 satır 375–378: "alış faturasını yalnız
ödeme niteliğindeki satırlar kapatır … satış faturası, taksit kartı borcu, borç kaydı ödeme SAYILMAZ (**satış ↔ alış karşılıklı kapama yalnız açık 'Mahsup Et' işlemiyle** …; cari BAKİYESİ zaten netleşir)
… Satış tarafında simetrik"). B1 kararı (17:16) "vadesi geçmiş **fatura kalanı**" der. Hem müşteri hem tedarikçi olan carilerde ve Alacak Yaz yazılan carilerde gecikmiş değişir.
**Örnek.** Satış S1 10.000 (vadesi geçmiş), satış S2 5.000 (vadesi gelmemiş), alış A 6.000 (açık); bakiye 9.000. A: A, vadesi en önce gelen S1'den düşer → gecikmiş **4.000**. B: alış yalnız Mahsup Et ile;
S1 10.000 gecikmiş, net borç 9.000 tavanı → gecikmiş **9.000**.
**Öneri A (cari neti; EK-1 §1 aynen, fatura ekranı 2.0.17'deki gibi yöne göre kalır).** Gerekçe: hatırlatma carinin hesabı (cari ekstre) üzerinden konuşur; yaygın yaşlandırmada borç ve alacak hareketleri vade
sırasıyla birbirini kapatır (Logo, arama özeti → GÖRÜŞ); kuşkuda az gösteren yön (ilke 2'nin ruhu); değişmez (i) kendiliğinden sağlanır. B'nin dayanağı da güçlü: TBK takas için beyan arar (Mahsup Et = beyan),
B1'in "fatura kalanı" sözü ve 2.0.17 kararı. A seçilirse cari kartında "Gecikmiş 4.000 (karşı belgelerle netleşmiş)" notu; fatura listesindeki "Açık" durumu değişmez. B seçilirse S. 27'deki net alacak satırı
ikiye ayrılır.

### K-3 — Kartı Kapat "vazgeçilen kalan" ↔ KG-23 A / S1 → **SORU (S10, koşullu)** — kör nokta
**Çelişki.** Önceden yazılmış metinler kapatılan kartın kalanını bir ALACAK satırı (borçtan vazgeçme) olarak anıyor: 2.3.0 kabul K3 "…, taksit tahsilatı, **kapatılan kartın vazgeçilen kalanı**"; BANKA-MODULU-PLAN
§3.11b/2 (c) "Taksit tahsilatı (**ve kapatılan kartın vazgeçilen kalanı**)". Kitap H-07 / KG-23 A (satır 231, 418): "madde yok; **alacak CH'de kalır**"; EK-1 M1d ve kullanıcının S1 yanıtı ("kalan varken
kapatılan taksit kartı" → gecikmiş) bu okumaya dayandı. Kılavuz yalnız "kalan varken program kalan tutarı söyleyip onay ister; kapalı kart uyarı vermez" der. Kalan silinirse cari borcu azalır, hatırlatma
gitmez; kalırsa gider.
**Koşul.** Ana oturum programın Kartı Kapat'ta cari bakiyesini düşürüp düşürmediğini ekrandan görür (karşılaştırmada görülmüş olabilir). Düşürmüyorsa S10 sorulmaz (KG-23 A = bugünkü davranış); düşürüyorsa
KG-23 A bir para kuralı değişikliğidir → S10 (ders 43).
**Örnek.** 12 × 1.000 = 12.000'lik kart, 4 taksit ödendi; müşteri ödemeyi bıraktı, kart kapatıldı. A: kalan 8.000 cari borcunda kalır, ertesi gün gecikmiş, hatırlatma gider (silmek için Alacak Yaz). B: kalan 8.000
borçtan düşer; hatırlatma gitmez.
**Öneri A.** Gerekçe: tahsilatın bırakılması alacağı ortadan kaldırmaz; alacaktan vazgeçme ayrı ve izli bir işlem olmalı (Alacak Yaz / iskonto; değersiz alacak yalnız VUK 322–323 koşullarıyla gider —
DOĞRULANMADI); KG-23 A ve S1 ile tutarlı; vazgeçme yolu açık (M1d pencere metni: "Silmek için Alacak Yaz kullanın"). Not (GÖRÜŞ, DÜŞÜK, 2.5.1): kart ileride verilecek dönemlik hizmet içinse (servis, aidat)
H-03'ün bütün geliri kart gününde yazması dönemsellik ilkesine uymaz; bu durumda vazgeçilen kalan gelir düzeltmesidir (610.90) — kart türüne "Dönemlik Hizmet" eklenmesi 2.5.1 önerisi.

---

## 3. Kitaba ve EK-1'e düzeltmeler (baş mimar onayıyla; BAŞ MİMAR KARARI olarak gösterilir — SORU'ya bağlı olanlar yanıttan sonra)

| # | Yer | Düzeltme | Kaynak |
|---|---|---|---|
| E11 | EK-1 §1 adım 4 | S6-A ise "havuzlanır" yerine işlem günü kuralı (S. 23 "Önerilen A tanımı"); S6-B ise metin kalır, (iv) değişmezi kaldırılır | S. 23 |
| E12 | EK-1 §1 adım 3 | S6-A ise: bağ taşıyıcının gününde hedefin o günkü kalanını kapatır; önceki bağsız kapama geri alınmaz; hedef sonra doğarsa hedefin gününde | S. 24, 28 |
| E13 | Kitap G-4, §4; EK-1 M4 | Yeni sınıf "önceki yıl sonucu" (olağandan sonra, dönem sonundan önce; Gelir Tablosu dışı); §4 "kapanış sınıfı maddeleri hariç" → "önceki yıl sonucu ve kapanış sınıfı maddeleri hariç" | S. 25 |
| E14 | Kitap §2 | 127 Diğer Ticari Alacaklar (Carisiz Taksit Kartları) — A, I.C, ters → 340, kart bazında; 570 / 580 notu "alt hesap 570.YYYY / 580.YYYY" | S. 26, 36 |
| E15 | Kitap §2 satır 93 | Ad "Eşleştirilecek Açılış Bakiyeleri"; "(Geçici)" yalnız Bilanço satırında | S. 39 |
| E16 | Kitap K-01, KG-3 | "KG-3 (öneri 649.90)" → "649.90 (KG-3 A, kullanıcı 05.11)"; GT F alt satırı "Sınıflandırılmamış Kasa Gelirleri" | S. 37 |
| E17 | EK-1 M14 | "seçilmemiş ya da tanınmayan → 770.90" → "boş ya da varsayılan → 770; eşlemede olmayan değer → 770.90" | S. 38 |
| E18 | Kitap M-01 | Not: "Bir kez; tarihi ilk nakit hareketinden sonra olamaz — düzeltmede de (409); aynı gün izinli" | S. 33 |
| E19 | Kitap §7.4 | Kesin Değil nedeni: "Önceki Yıl KDV Mahsubu Yapılmamış (ay listesi)"; §7.3 bilgi uyarısı yalnız t'nin yılı | S. 34 |
| E20 | Kitap F-15 (+ silme) | "Fatura Sil = İptal etkisi (2.0.17 m1): faturanın kendi taksit kartı kalkar; tahsilatı alınmış taksit varsa silme / iptal engelli" | S. 35 |
| E21 | Kitap §3-Ş, kâhin olay dili | J-02, J-05, J-06 kayıt kimliği taşır; K3 "her alacak satırı" (K-14, T-11 dahil) | S. 31 |
| E22 | EK-1 M1c | S8-A ise: karşılıksız / iade kapattığı kalemleri yeniden açar (F3 / UX18); ayrı Ç-07 kalemi yalnız taksit kartı tahsilatı olan evrakta | K-1 |
| E23 | EK-1 M1e, M13 | Kuyruk muavini izler: K3 ile 128'e düşen kart tahsilatı CH kuyruğunu kapatmaz; M1e'nin "ilk taksiti kapatır" cümlesi parası 120'ye düşen tahsilat için | S. 30 |
| E24 | EK-1 §1 adım 1 | S9-B ise: alış faturası ve Alacak Yaz satış borcunu yalnız Mahsup Et ile kapatır; gecikmiş ≤ max(0, CH) tavanı | K-2 |
| E25 | Kitap H-07 / KG-23 | S10 yanıtına göre (A: madde yok, kalan CH'de; B: "vazgeçilen kalan" alacak satırı + karşı hesap kararı) | K-3 |

## 4. Kâhine yeni değişmezler

1. (S6-A) Aynı gündeki kalemlerin yazım sırası karıştırılınca gecikmiş(t) ve açık kalem listesi değişmez (ders 31).
2. (S6-A) Bir ödemenin kapattığı kalemler yalnız tarihi ≤ ödeme günü olan kalemlere ve bağlara bağlıdır: daha geç tarihli borç eklemek önceki dağıtımı değiştirmez.
3. (S6-A + S. 24) Değişmez (4) istisnasız: her t ≥ K+1 için gecikmiş(t) ve açık kalem (vade, kalan) listesi devirli = devirsiz; K sonrası bağın hedefi ≤K'de bağsız kapanmış olsa da.
4. (S. 27) Devir net alacak satırının tarih / vade / sıra seçimi hiçbir carinin açık borç kalemlerini ve gecikmiş(t)'yi değiştirmez; S9-A'da bir caride aynı anda açık borç ve açık alacak kalemi yoktur (şüpheli kuyruğu hariç).
5. (S. 25) K günündeki sınıf içi sıra hiçbir bakiyeyi değiştirmez; Önceki Yıl Sonucu Fişlerinden sonra 153 = DSS_(K−1) + alış_K − alış iadesi_K; N-01'den sonra 153 = DSS_K.
6. (S. 30) CH kuyruğunda Σ açık = CH muavini, şüpheli kuyruğunda Σ açık = 128 muavini — her an, her cari.
7. (S. 32) Kart > alttaki borç durumunda Σ açık − Σ açık alacak = CH; fark kartın vadesi ilk gelen taksitlerinden düşülmüş olur.
8. (S. 33) Kasa açılış tarihi ≤ ilk nakit hareketinin tarihi; aksi yönde düzeltme 409 ve tablo sayıları aynı.
9. (S. 35) Kendi taksit kartı olan fatura silinince / iptal edilince kartın taksitleri kuyrukta yok; tahsilatlı kartta silme / iptal reddedilir, hiçbir şey yazılmaz.
10. (S. 31) Karşılık / değersiz / çıkar olaylarında programa ve modele giden kayıt kimliği aynıdır.
11. (S. 40) 691 ≠ 0 verisinde kapanıştan sonra 690 = 691 = 692 = 0 ve (590 − 591) = 690'ın kapanış öncesi bakiyesi − 691.
12. (S. 36) 127 alacak bakiyesi Bilanço'da 340'ta; Aktif = Pasif korunur; 127 borçlu ve alacaklı kartlar netleşmez.
13. (S. 26, alt hesap varsa) Σ 570.Y = 570, Σ 580.Y = 580; her 570.Y = R_Y (Y kârlı), her 580.Y = −R_Y (Y zararlı).
14. (S. 34) Kesin Değil nedeni t'nin yılından önceki her mahsupsuz ayı adıyla listeler; t'nin yılının biten ayları yalnız bilgi uyarısıdır.
15. (S8-A) Karşılıksız / iadeden sonra evrakın kapattığı kalemler kendi vadeleriyle açıktır; cari bakiyesi ve yevmiye karşılıksızdan önceki tutarla aynı.

## 5. KULLANICIYA SORULACAKLAR (ders 43, 45 — yanıta kadar kâhin iki dallı)

- **S6 (Soru 23):** Müşteri faturaya bağlamadan ödeme yapınca bu ödeme hangi borcunu kapatsın? Örnek: 01.03 fatura 40.000 (vadesi 30.06), 01.04 bağlamadan 40.000 ödeme, 10.05 vadesiz yeni fatura 40.000.
  **A (öneri) — "Ödeme Günündeki Borcu Kapatsın":** ödeme 01.04'te o gün açık olan 01.03 faturasını kapatır; 10.05 faturası açık kalır, 11.05'te 40.000 gecikmiş görünür ve hatırlatma gider (Borçlar Kanunu
  md. 102 mahsubu ödeme anında yapar; devirden sonra da aynı sonuç).
  **B — "Her Gün Yeniden Dağıtılsın":** ödeme vadesi önce gelen 10.05 faturasına kayar; 11.05'te gecikmiş 0, hatırlatma 01.07'de 01.03 faturası için gider.
- **S7 (Soru 29):** Şüpheli alacağı (icra / dava) olan müşterinin ayrıca vadesi geçmiş başka bir borcu varsa otomatik Ödeme Hatırlatma ona gitsin mi? Örnek: 4.000 icrada, ayrıca vadesi geçmiş 3.000'lik yeni fatura.
  **A (öneri) — "Müşteri Otomatik Listeye Girmesin":** şüpheli kaydı açık olan müşteriye otomatik ileti gitmez; ekranda "Şüpheli Alacağı Var" etiketiyle görünür, istenirse elle seçilir (iletide 3.000 yazar).
  **B — "Şüphelisiz Kısım Gitsin":** otomatik ileti 3.000 ile gider; şüpheli 4.000 iletiye girmez.
- **S8 (kör nokta K-1):** Bir faturayı ödeyen çek karşılıksız çıkınca açılan borcun vadesi ne olsun? Örnek: vadesi 30.06 olan 20.000'lik fatura 05.03'te çekle ödendi, çek 02.05'te karşılıksız.
  **A (öneri) — "Faturanın Kendi Vadesi":** fatura yeniden açılır (22.10 kararınız), 30.06'ya kadar gecikmiş sayılmaz; vadesiz faturada karşılıksız günü zaten gecikmiştir.
  **B — "Karşılıksız Gününden Vade":** karşılıksız tutar ayrı borç olur, 03.05'ten itibaren gecikmiş sayılır.
- **S9 (kör nokta K-2):** Hem müşteriniz hem tedarikçiniz olan birine alış borcunuz varken onun gecikmiş borcu nasıl hesaplansın? Örnek: size 10.000 vadesi geçmiş + 5.000 vadesi gelmemiş satış borcu var, sizin ona
  6.000 alış borcunuz var (bakiye 9.000).
  **A (öneri) — "Bakiyeden Netleşsin":** alış borcunuz vadesi geçmiş satıştan düşülür; gecikmiş 4.000 (fatura listesindeki Açık / Ödendi durumu bugünkü gibi kalır).
  **B — "Yalnız Mahsup Et'le":** alış borcunuz siz Mahsup Et yapana kadar düşülmez; gecikmiş 9.000 (bakiyeyi aşamaz).
- **S10 (kör nokta K-3; yalnız program kartı kapatınca kalanı borçtan düşüyorsa sorulur):** Ödemeyi bırakan müşterinin taksit kartı kalan varken kapatılınca kalan borç ne olsun? Örnek: 12.000'lik kartın 8.000'i
  ödenmemiş.
  **A (öneri) — "Borçta Kalsın":** 8.000 carinin borcunda kalır, gecikmiş sayılır, hatırlatma gider; borçtan vazgeçmek için ayrıca Alacak Yaz.
  **B — "Borçtan Düşsün":** kart kapanınca 8.000 borçtan düşer; hatırlatma gitmez.

## 6. Kaynaklar (erişim 05.11.2026; hepsi arama özeti, sayfa açılmadı — `www.muhasebenews.com` WebFetch ile çözülemedi, oturumun ağ ayarlarında izinli olması gerekir)

- TBK 101–102 (beyan; ödeme sırasında muaccel borca, vadesi önce gelene; hiçbiri muaccel değilse en az güvenceli olana): https://av-saimincekas.com/kanun/turk-borclar-kanunu/madde-102-tbk/ ,
  Yargıtay HGK E.2017/2332 K.2021/665 (ilk takip edilen borç): https://av-saimincekas.com/?p=337829 , SMMM yazısı: https://www.yontemymm.com.tr/yorum-ve-makaleler/yapilan-odemenin-dava-takip-fatura-borcuna-mahsuben-yapilip-yapilmadigi-konuk-yazar-smmm-huseyin-yorukoglu
- Logo otomatik (FIFO) kapama — borç ve alacak hareketleri vade sırasıyla birbirini kapatır: https://docs.logo.com.tr/x/Ho2tAQ , https://docs.logo.com.tr/display/J3ERPENG/FIFO+Close
- 690 / 691 / 692 kapanışı: https://www.muhasebenews.com/donem-kari-kurumlar-vergisi-karsiligi-ile-gecmis-yil-zarari-mahsubu-nasil-olmalidir/ , https://www.muhasebetr.com/yazarlarimiz/recepselimoglu/064
- Ters bakiyeli ticari hesapların 159 / 340'a virmanı: https://docs.logo.com.tr/download/attachments/74716054/Ters%20Bakiyeli%20Hesap%20Kontrol%C3%BC.pdf?api=v2 ,
  https://www.muhasebetr.com/yazarlarimiz/koray/0614/ , https://www.muhasebenews.com/?p=165557
- KVK 9 (yıl yıl, beş yıl) ve 580'in yıl alt hesabı: https://www.muhasebetr.com/yazarlarimiz/zekeriyaaslan/0210/ , https://www.muhasebetr.com/yazarlarimiz/alirizaakbulut/0123 ,
  GİB özelgesi B.07.1.GİB.4.35.16.01-176300-210: https://www.lexpera.com.tr/mevzuat/ozelgeler/b-07-1-gib-4-35-16-01-176300-210-sayili-ozelge-1
- QuickBooks, karşılıksız çek / geri dönen ödeme — asıl fatura yeniden açılır: https://quickbooks.intuit.com/learn-support/en-us/receive-payments/record-a-bounced-check-using-an-invoice/00/186349
- Kitap §10 ve EK-1 §8 kaynakları aynen geçerli.

**DOĞRULANMADI:** TBK 101–102, KVK 9, VUK 322–323 ve MSUGT (691 / 692, 340, 127 açıklamaları) birincil metinleri; ters bakiye ve 770 varsayılanı için iki ayrı üreticinin belgesi (görev tanımı §3) — bu
maddeler GÖRÜŞ. **DENENMEYEN:** program kullanılmadı (bu temas yalnız kural metni).

## 7. Sınır

Bu ajan lisanslı bir SMMM değildir; çıktısı mali müşavir görüşü ya da onayı yerine geçmez. Bilanço ve Gelir Tablosu müşteriye sunulmadan önce gerçek bir SMMM incelemesi önerilir (görev tanımı §7).
